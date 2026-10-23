#!/usr/bin/env node
// ACCESSION — test runner. Each test file gets the core loaded into a hardened vm context
// (tools/core-context.js), then runs its tests against it.
// Usage: node test/run.js [filter]
'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..');

const { loadCore } = require('../tools/core-context.js');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const filter = process.argv[2] || '';
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && f.includes(filter)).sort();
for (const f of files) {
  const before = tests.length;
  require(path.join(__dirname, f))({ test, assert, loadCore, root, fs, path });
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
