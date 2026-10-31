#!/usr/bin/env node
// ACCESSION — test runner. Each test file gets the core loaded into a hardened vm context
// (tools/core-context.js), then runs its tests against it (BUILD.md §10.2).
// The test files are test/*.test.js and every *.test.js under test/behaviour/ and
// test/arena/, at any depth. The filter matches a file's path relative to test/, written
// with '/', so `node test/run.js behaviour` runs that folder and `node test/run.js m0` the
// files whose path contains "m0"; `--file=<path>` runs exactly that file (check-all's pool
// runs each test file of the reverted copy so, as a job of its own).
// A file in ALONE is a check-all step of its own (test/m3-battery.test.js is the short sims,
// BUILD.md §10.2): a run with no filter leaves it out, and a filter that matches it runs it
// (`node test/run.js m3-battery`).
// Usage: node test/run.js [filter] [--file=<path>]... [--write-timings]
// (ACCESSION_TEST_DIR names another folder to run in place of test/; test/m3-infra uses it.)
// The files are shared out among worker processes, one per CPU up to 4 (ACCESSION_TEST_JOBS
// sets the number; 1 runs everything in this process), the longest first, each to the worker
// with the least work so far, by the CPU time test/timings.json records for each file (a file
// it does not list yet is reckoned from its size). A file always runs whole in one worker, and
// the output is printed file by file in path order, as a single run prints it. The last line
// gives the wall time and the CPU time of every process the run used. `--write-timings`
// records each file's CPU time in test/timings.json (BUILD.md §10.2; the file is generated).
// A run has an os.tmpdir() of its own (TMPDIR, which every process a test starts inherits), a
// folder for each process that runs tests, removed when the run ends. A test removes every
// temporary folder it makes in a finally block, so whatever is new there when a test ends, or
// when a file has loaded, fails that test or file.
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..');

// The folders searched: test/ itself (its files only), and these subfolders in full.
const FOLDERS = ['behaviour', 'arena'];
// The files a run with no filter leaves out (above).
const ALONE = ['m3-battery.test.js'];
// The generated record of how long each file and each check-all job takes (BUILD.md §10.2).
const TIMINGS = 'timings.json';

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

// dir's timings.json: {files: {path: CPU-ms}, jobs: {name: ms}}, or empty sections if there is none.
// The times only order the work, so one that cannot be read (a merge left in it) is said on
// stderr and ignored, never a reason for the run to stop: `./check-all.sh --timings` rewrites it.
function timings(dir) {
  const f = path.join(dir, TIMINGS);
  let t = {};
  if (fs.existsSync(f)) {
    try { t = JSON.parse(fs.readFileSync(f, 'utf8')) || {}; }
    catch (e) { process.stderr.write(`run.js: ${f} cannot be read (${e.message}), so the times are ignored; ./check-all.sh --timings rewrites it\n`); t = {}; }
  }
  const obj = x => x && typeof x === 'object' && !Array.isArray(x) ? x : {};
  return { files: obj(t.files), jobs: obj(t.jobs) };
}

// Each file's expected CPU-ms: what timings.json records for it, or, for a file it does not
// list yet, its size times the median CPU-ms a byte of the files it does list (its size alone
// when it lists none).
function estimates(dir, list, t) {
  const known = (t || timings(dir)).files, size = f => fs.statSync(path.join(dir, f)).size;
  const rates = list.filter(f => known[f] > 0).map(f => known[f] / size(f)).sort((a, b) => a - b);
  const rate = rates.length ? rates[rates.length >> 1] : 1;
  const out = {};
  for (const f of list) out[f] = known[f] > 0 ? known[f] : Math.max(1, Math.round(size(f) * rate));
  return out;
}

// The files of each of n workers: the longest first (ties by path), each to the worker with the
// least expected work so far (ties to the first such worker).
function share(dir, list, n, est) {
  est = est || estimates(dir, list);
  const load = new Array(n).fill(0), out = load.map(() => []);
  const sorted = list.slice().sort((a, b) => est[b] - est[a] || (a < b ? -1 : 1));
  for (const f of sorted) {
    let k = 0;
    for (let i = 1; i < n; i++) if (load[i] < load[k]) k = i;
    load[k] += est[f]; out[k].push(f);
  }
  return out;
}

// The CPU time so far, in ms, of this process (every thread of it: process.cpuUsage) and of the
// processes it has started and waited for (a test that runs a tool: on Linux, /proc/self/stat's
// cutime and cstime, in clock ticks of 10 ms; elsewhere they are not counted).
const childCpu = () => {
  try { const s = fs.readFileSync('/proc/self/stat', 'utf8'), f = s.slice(s.lastIndexOf(')') + 2).split(' '); return (Number(f[13]) + Number(f[14])) * 10; }
  catch (e) { return 0; }
};
const ownCpu = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };
const cpuNow = () => ownCpu() + childCpu();

// The names in this process's os.tmpdir() (the run's own, see main).
const tmpNames = () => new Set(fs.readdirSync(os.tmpdir()));
// What is in os.tmpdir() now and was not in `before`: null if nothing, else why that fails.
function leftBehind(before) {
  const left = [...tmpNames()].filter(n => !before.has(n)).sort();
  return left.length ? `left ${left.join(', ')} in os.tmpdir(): a test removes each temporary folder it makes, in a finally block` : null;
}

// Runs the given files' tests here. With capture, what each file prints is kept per file. Each
// file's CPU-ms (loading it and running its tests) is kept in cpu. A file that leaves anything
// in os.tmpdir() as it loads counts as one more test, failed.
function runFiles(dir, list, capture) {
  const { loadCore } = require('../tools/core-context.js');
  const tests = [], printed = {}, cpu = {};
  const test = (name, fn) => tests.push({ name, fn });
  let current = null, failed = 0, loads = 0;
  const fail = (file, name, why) => { failed++; console.log(`FAIL ${file} :: ${name}\n  ${why.split('\n').join('\n  ')}`); };
  if (capture) {
    const keep = s => { printed[current] = (printed[current] || '') + s; };
    console.log = (...a) => keep(a.map(String).join(' ') + '\n');
    process.stdout.write = chunk => { keep(String(chunk)); return true; };
  }
  for (const f of list) {
    const before = tests.length, c = cpuNow(), had = tmpNames();
    current = f;
    require(path.join(dir, f))({ test, assert, loadCore, root, fs, path });
    for (let i = before; i < tests.length; i++) tests[i].file = f;
    const left = leftBehind(had);
    if (left) { loads++; fail(f, 'loading the file', left); }
    cpu[f] = cpuNow() - c;
  }
  for (const t of tests) {
    current = t.file;
    const c = cpuNow(), had = tmpNames();
    let why = null;
    try { t.fn(); }
    catch (e) { why = e && e.message || String(e); }
    const left = leftBehind(had);
    if (why !== null || left) fail(t.file, t.name, [why, left].filter(x => x !== null).join('\n'));
    cpu[t.file] += cpuNow() - c;
  }
  return { total: tests.length + loads, failed, printed, cpu };
}

// Writes the files' CPU-ms into dir's timings.json, rounded to 10 ms, keeping the other files'
// and the jobs' (a run of every file drops the files that are no longer there).
function writeTimings(dir, cpu, all) {
  const t = timings(dir), present = new Set(files(dir, ''));
  const merged = Object.assign({}, t.files);
  for (const f of Object.keys(cpu)) merged[f] = Math.max(10, Math.round(cpu[f] / 10) * 10);
  const sorted = o => { const out = {}; for (const k of Object.keys(o).sort()) out[k] = o[k]; return out; };
  const kept = {};
  for (const f of Object.keys(merged)) if (!all || present.has(f)) kept[f] = merged[f];
  const out = { about: 'Generated: the CPU-ms of each Node test file (node test/run.js --write-timings) and the ms of each job of check-all\'s pool (./check-all.sh --timings), measured alone, so that the longest start first (BUILD.md §10.2). Do not edit by hand.', files: sorted(kept), jobs: sorted(t.jobs) };
  fs.writeFileSync(path.join(dir, TIMINGS), JSON.stringify(out, null, 1) + '\n');
}

function main() {
  const dir = process.env.ACCESSION_TEST_DIR ? path.resolve(process.env.ACCESSION_TEST_DIR) : __dirname;
  const args = process.argv.slice(2), shard = args.find(a => a.startsWith('--shard=')), filter = args.find(a => !a.startsWith('--')) || '';
  const named = args.filter(a => a.startsWith('--file=')).map(a => a.slice(7)), record = args.includes('--write-timings');
  const all = files(dir, '');
  for (const f of named) if (!all.includes(f)) { console.log(`run.js: there is no test file ${f} in ${dir}`); process.exit(1); }
  const list = named.length ? named.slice().sort() : files(dir, filter).filter(f => filter || !ALONE.includes(f));
  const t0 = process.hrtime.bigint();
  let finished = false;
  const done = (total, failed, cpu, workers) => {
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log(`tests: ${total - failed}/${total} passed in ${ms.toFixed(0)} ms (${(cpu / 1000).toFixed(1)} CPU-s, ${workers} ${workers === 1 ? 'process' : 'workers'})` + (failed ? ` — ${failed} FAILED` : ''));
    finished = true;
    process.exit(failed ? 1 : 0);
  };
  // A run that ends before its last line (a test that ends the process, as process.exit(0)
  // does) fails, whatever the code: a worker's is caught by the run that started it, and a
  // run in one process (one file, as each of check-all's revert jobs is) here.
  if (!shard) process.on('exit', code => {
    if (finished) return;
    console.log(`FAIL the test run stopped before its end (exit code ${code}), so not every test ran`);
    process.exitCode = 1;
  });
  // A worker: run its share and hand back what each file printed, each file's CPU time and its own.
  if (shard) {
    const mine = JSON.parse(Buffer.from(shard.slice(8), 'base64').toString('utf8'));
    const write = process.stdout.write.bind(process.stdout);
    const r = runFiles(dir, mine, true);
    r.proc = cpuNow();
    write('@@SHARD ' + JSON.stringify(r) + '\n');
    process.exit(0);
  }
  const want = parseInt(process.env.ACCESSION_TEST_JOBS || '', 10);
  const jobs = Math.max(1, Math.min(list.length, want > 0 ? want : Math.min(4, os.cpus().length)));
  // The run's own os.tmpdir(): what another run or another worker makes in its own is never
  // seen as this test's (runFiles). It goes when the run ends, however it ends.
  const tmpRun = fs.mkdtempSync(path.join(os.tmpdir(), 'accession-tests-'));
  process.on('exit', () => fs.rmSync(tmpRun, { recursive: true, force: true }));
  const tmpFor = k => { const d = path.join(tmpRun, String(k)); fs.mkdirSync(d); return d; };
  if (jobs === 1) {
    process.env.TMPDIR = tmpFor(0);
    const r = runFiles(dir, list, false);
    if (record && !r.failed) writeTimings(dir, r.cpu, !filter && !named.length);
    return done(r.total, r.failed, cpuNow(), 1);
  }
  // With workers, this process only waits, so an interrupt ends it at once, and by its exit.
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(sig === 'SIGINT' ? 130 : 143));
  const { spawn } = require('node:child_process');
  const parts = share(dir, list, jobs).filter(p => p.length);
  let left = parts.length, total = 0, failed = 0, cpu = 0;
  const printed = {}, each = {};
  parts.forEach((part, k) => {
    const arg = '--shard=' + Buffer.from(JSON.stringify(part)).toString('base64');
    const child = spawn(process.execPath, [__filename, arg], { env: Object.assign({}, process.env, { TMPDIR: tmpFor(k) }) });
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
        total += r.total; failed += r.failed; cpu += r.proc; Object.assign(printed, r.printed); Object.assign(each, r.cpu);
        if (err) process.stderr.write(err);
      }
      if (--left === 0) {
        for (const f of list) if (printed[f]) process.stdout.write(printed[f]);
        if (record && !failed) writeTimings(dir, each, !filter && !named.length);
        // The workers' own and their children's, and this process's own (its children are the workers).
        done(total, failed, cpu + ownCpu(), parts.length);
      }
    });
  });
}

// Exported before main runs, since a test file run by main may require this file.
module.exports = { files, share, estimates, timings, FOLDERS, ALONE, TIMINGS };
if (require.main === module) main();
