#!/usr/bin/env node
// ACCESSION — test runner. Each test file gets the core loaded into a hardened vm context
// (tools/core-context.js), then runs its tests against it (BUILD.md §10.2).
// The test files are test/*.test.js and every *.test.js under test/behaviour/ and
// test/arena/, at any depth. The filter matches a file's path relative to test/, written
// with '/', so `node test/run.js behaviour` runs that folder and `node test/run.js m0` the
// files whose path contains "m0".
// A file in ALONE is a check-all step of its own (test/m3-battery.test.js is the short sims,
// BUILD.md §10.2 step 4), run alone so that the time it measures is its own: a run with no
// filter leaves it out, and a filter that matches it runs it (`node test/run.js m3-battery`).
// Usage: node test/run.js [filter]
// (ACCESSION_TEST_DIR names another folder to run in place of test/; test/m3-infra uses it.)
// The files are shared out among worker processes, one per CPU up to 4 (ACCESSION_TEST_JOBS
// sets the number; 1 runs everything in this process). A file always runs whole in one
// worker, and the output is printed file by file in path order, as a single run prints it.
'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..');

// The folders searched: test/ itself (its files only), and these subfolders in full.
const FOLDERS = ['behaviour', 'arena'];
// The files a run with no filter leaves out (above).
const ALONE = ['m3-battery.test.js'];

// The test files under dir whose relative path contains filter, sorted by that path.
function files(dir, filter) {
  const out = [];
  const walk = rel => {
    const abs = path.join(dir, rel);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { if (rel) walk(r); }
      else if (e.isFile() && e.name.endsWith('.test.js')) out.push(r);
    }
  };
  walk('');
  for (const f of FOLDERS) walk(f);
  return out.filter(f => f.includes(filter || '')).sort();
}

// The files of one worker: the biggest first, each to the worker with the least so far.
function share(dir, list, n) {
  const load = new Array(n).fill(0), out = list.map(() => []);
  const sized = list.map(f => ({ f, size: fs.statSync(path.join(dir, f)).size })).sort((a, b) => b.size - a.size || (a.f < b.f ? -1 : 1));
  for (const { f, size } of sized) {
    let k = 0;
    for (let i = 1; i < n; i++) if (load[i] < load[k]) k = i;
    load[k] += size; out[k].push(f);
  }
  return out;
}

// Runs the given files' tests here. With capture, what each file prints is kept per file.
function runFiles(dir, list, capture) {
  const { loadCore } = require('../tools/core-context.js');
  const tests = [], printed = {};
  const test = (name, fn) => tests.push({ name, fn });
  let current = null;
  if (capture) {
    const keep = s => { printed[current] = (printed[current] || '') + s; };
    console.log = (...a) => keep(a.map(String).join(' ') + '\n');
    process.stdout.write = chunk => { keep(String(chunk)); return true; };
  }
  for (const f of list) {
    const before = tests.length;
    current = f;
    require(path.join(dir, f))({ test, assert, loadCore, root, fs, path });
    for (let i = before; i < tests.length; i++) tests[i].file = f;
  }
  let failed = 0;
  for (const t of tests) {
    current = t.file;
    try { t.fn(); }
    catch (e) { failed++; console.log(`FAIL ${t.file} :: ${t.name}\n  ${(e && e.message || String(e)).split('\n').join('\n  ')}`); }
  }
  return { total: tests.length, failed, printed };
}

function main() {
  const dir = process.env.ACCESSION_TEST_DIR ? path.resolve(process.env.ACCESSION_TEST_DIR) : __dirname;
  const args = process.argv.slice(2), shard = args.find(a => a.startsWith('--shard=')), filter = args.find(a => !a.startsWith('--')) || '';
  const list = files(dir, filter).filter(f => filter || !ALONE.includes(f));
  const t0 = process.hrtime.bigint();
  const done = (total, failed) => {
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log(`tests: ${total - failed}/${total} passed in ${ms.toFixed(0)} ms` + (failed ? ` — ${failed} FAILED` : ''));
    process.exit(failed ? 1 : 0);
  };
  // A worker: run its share and hand back what each file printed.
  if (shard) {
    const mine = JSON.parse(Buffer.from(shard.slice(8), 'base64').toString('utf8'));
    const write = process.stdout.write.bind(process.stdout);
    const r = runFiles(dir, mine, true);
    write('@@SHARD ' + JSON.stringify(r) + '\n');
    process.exit(0);
  }
  const want = parseInt(process.env.ACCESSION_TEST_JOBS || '', 10);
  const jobs = Math.max(1, Math.min(list.length, want > 0 ? want : Math.min(4, require('node:os').cpus().length)));
  if (jobs === 1) { const r = runFiles(dir, list, false); return done(r.total, r.failed); }
  const { spawn } = require('node:child_process');
  const parts = share(dir, list, jobs).filter(p => p.length);
  let left = parts.length, total = 0, failed = 0;
  const printed = {};
  parts.forEach(part => {
    const arg = '--shard=' + Buffer.from(JSON.stringify(part)).toString('base64');
    const child = spawn(process.execPath, [__filename, arg], { env: process.env });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('close', code => {
      const line = out.split('\n').find(l => l.startsWith('@@SHARD '));
      if (code !== 0 || !line) {
        failed++; total++;
        console.log(`FAIL a test worker (files ${part.join(', ')}) stopped with code ${code}\n  ${(out + err).split('\n').join('\n  ')}`);
      } else {
        const r = JSON.parse(line.slice(8));
        total += r.total; failed += r.failed; Object.assign(printed, r.printed);
        if (err) process.stderr.write(err);
      }
      if (--left === 0) {
        for (const f of list) if (printed[f]) process.stdout.write(printed[f]);
        done(total, failed);
      }
    });
  });
}

// Exported before main runs, since a test file run by main may require this file.
module.exports = { files, share, FOLDERS, ALONE };
if (require.main === module) main();
