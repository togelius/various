#!/usr/bin/env node
// ACCESSION — test runner. Each test file gets the core loaded into a hardened vm context
// (tools/core-context.js), then runs its tests against it (BUILD.md §10.2).
// The test files are test/*.test.js and every *.test.js under test/behaviour/ and
// test/arena/, at any depth. The filter matches a file's path relative to test/, written
// with '/', so `node test/run.js behaviour` runs that folder and `node test/run.js m0` the
// files whose path contains "m0".
// Usage: node test/run.js [filter]
// (ACCESSION_TEST_DIR names another folder to run in place of test/; test/m3-infra uses it.)
'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..');

// The folders searched: test/ itself (its files only), and these subfolders in full.
const FOLDERS = ['behaviour', 'arena'];

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

function main() {
  const { loadCore } = require('../tools/core-context.js');
  const dir = process.env.ACCESSION_TEST_DIR ? path.resolve(process.env.ACCESSION_TEST_DIR) : __dirname;
  const tests = [];
  const test = (name, fn) => tests.push({ name, fn });
  for (const f of files(dir, process.argv[2] || '')) {
    const before = tests.length;
    require(path.join(dir, f))({ test, assert, loadCore, root, fs, path });
    for (let i = before; i < tests.length; i++) tests[i].file = f;
  }

  let failed = 0;
  const t0 = process.hrtime.bigint();
  for (const t of tests) {
    try { t.fn(); }
    catch (e) { failed++; console.log(`FAIL ${t.file} :: ${t.name}\n  ${(e && e.message || String(e)).split('\n').join('\n  ')}`); }
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`tests: ${tests.length - failed}/${tests.length} passed in ${ms.toFixed(0)} ms` + (failed ? ` — ${failed} FAILED` : ''));
  process.exit(failed ? 1 : 0);
}

// Exported before main runs, since a test file run by main may require this file.
module.exports = { files, FOLDERS };
if (require.main === module) main();
