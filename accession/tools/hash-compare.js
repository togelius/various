// ACCESSION — the Node side of the hash page's check (BUILD.md §3.5). A golden run marked
// `pending` has no pin to compare with while a wave of work changes the state on purpose,
// so the page prints PENDING with its hash and checkpoints, and tools/browser/check-hash.mjs
// passes only if they equal those of the same run in Node on the same tree: the browser and
// Node must still agree, run for run, while the pin is suspended.
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { loadCore, root } = require('./core-context.js');

const GOLDEN_FILE = path.join(root, 'test/golden/golden.js');

// The golden runs as test/golden/golden.js records them (a plain object, read outside the core).
function readGolden(file) {
  const src = fs.readFileSync(file || GOLDEN_FILE, 'utf8');
  return JSON.parse(JSON.stringify(vm.runInNewContext(src + '\n;GOLDEN', {}, { filename: file || GOLDEN_FILE })));
}

// Each pending run of golden, played in Node through the hardened core context:
// {name: {hash, checkpoints}}. C is a loaded core with tools/monkey.js (loaded if omitted).
function nodeRuns(golden, C) {
  const out = {};
  for (const name of Object.keys(golden)) {
    if (!golden[name].pending) continue;
    C = C || loadCore(['tools/monkey.js']);
    const g = golden[name], r = C.Monkey.run(g.seed, g.actions);
    out[name] = { hash: r.hash, checkpoints: Array.from(r.checkpoints) };
  }
  return out;
}

// What the page found, against Node. page is {name: {hash, checkpoints, pending, ok}} (the
// page's HASH_RESULTS); node is nodeRuns(golden). Returns the problems, one line each:
// every golden run must be on the page; a pinned run must have passed there; a pending
// run must be marked pending and equal Node's run in hash and every checkpoint.
function compare(golden, page, node) {
  const problems = [];
  page = page || {};
  for (const name of Object.keys(golden)) {
    const g = golden[name], p = page[name];
    if (!p) { problems.push(`${name}: not on the page`); continue; }
    if (!g.pending) { if (!p.ok) problems.push(`${name}: the page does not match its pin`); continue; }
    if (!p.pending) { problems.push(`${name}: pending in golden.js, but the page did not run it as pending`); continue; }
    const n = node[name];
    if (!n) { problems.push(`${name}: no Node run to compare with`); continue; }
    const pc = p.checkpoints || [], nc = n.checkpoints;
    let first = -1;
    for (let i = 0; i < Math.max(pc.length, nc.length); i++) if (pc[i] !== nc[i]) { first = i; break; }
    if (p.hash !== n.hash || first >= 0) {
      problems.push(`${name}: the page gives hash ${p.hash}, Node ${n.hash}` +
        (first >= 0 ? `; checkpoint ${first + 1} (action ${(first + 1) * 1000}) differs: page ${pc[first]}, Node ${nc[first]}` : '; every checkpoint agrees'));
    }
  }
  for (const name of Object.keys(page)) if (!Object.prototype.hasOwnProperty.call(golden, name)) problems.push(`${name}: on the page but not in golden.js`);
  return problems;
}

module.exports = { GOLDEN_FILE, readGolden, nodeRuns, compare };
