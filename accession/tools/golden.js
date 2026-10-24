#!/usr/bin/env node
// ACCESSION — regenerates test/golden/golden.js (BUILD.md §3.5). Run only when a rule changed
// on purpose, and say why in DEVELOPMENT.md's validation log.
// Usage:
//   node tools/golden.js                     re-pin: run every golden run and write its hash and
//                                            checkpoints; a re-pin ends any pending stretch
//   node tools/golden.js --pending "reason"  keep the pins and mark every run pending, with the
//                                            reason, while a wave changes the state on purpose
//   node tools/golden.js --check             compare the runs with the file and write nothing;
//                                            fails on any difference in a pinned run, and
//                                            reports each pending run's hash against its old pin
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..');
const { readGolden } = require('./hash-compare.js');
const RUNS = { m0Monkey: { seed: 20261023, actions: 10000 } };
const file = path.join(root, 'test/golden/golden.js');
const write = out => fs.writeFileSync(file, "// ACCESSION — golden runs: expected hashes for fixed seeds and action lists (BUILD.md §3.5).\n// Regenerate only on purpose (node tools/golden.js), and log why in DEVELOPMENT.md.\n'use strict';\nconst GOLDEN = " + JSON.stringify(out, null, 1) + ';\n');
const old = fs.existsSync(file) ? readGolden(file) : {};

const at = process.argv.indexOf('--pending');
if (at >= 0) {
  const reason = process.argv[at + 1];
  if (!reason || reason.startsWith('--')) { console.log('golden: --pending needs a reason'); process.exit(2); }
  for (const name of Object.keys(old)) { old[name].pending = reason; console.log(`golden: ${name} pending (pin ${old[name].hash} kept): ${reason}`); }
  write(old);
  process.exit(0);
}

const C = require('./core-context.js').loadCore(['tools/monkey.js']);
const out = {};
for (const [name, r] of Object.entries(RUNS)) {
  const res = C.Monkey.run(r.seed, r.actions);
  out[name] = { seed: r.seed, actions: r.actions, hash: res.hash, checkpoints: Array.from(res.checkpoints), visits: res.visits };
}
if (process.argv.includes('--check')) {
  let bad = 0;
  for (const name of Object.keys(out)) {
    const o = old[name], n = out[name];
    const same = o && o.seed === n.seed && o.actions === n.actions && o.hash === n.hash && JSON.stringify(o.checkpoints) === JSON.stringify(n.checkpoints);
    if (o && o.pending) console.log(`golden: ${name} is pending (${o.pending}): hash ${n.hash}, pin ${o.hash}${same ? ', unchanged' : ''}`);
    else if (!same) { bad++; console.log(`golden: ${name} differs from test/golden/golden.js: hash ${n.hash}, pin ${o ? o.hash : 'none'}`); }
  }
  for (const name of Object.keys(old)) if (!out[name]) { bad++; console.log(`golden: ${name} is in the file but not a run here`); }
  if (bad) process.exit(1);
  const open = Object.keys(old).filter(n => old[n].pending).length;
  console.log('golden: every pinned run matches test/golden/golden.js' + (open ? ` (${open} pending)` : ''));
} else {
  for (const name of Object.keys(out)) console.log(`golden: ${name} ${old[name] ? old[name].hash : 'new'} → ${out[name].hash}${old[name] && old[name].pending ? ' (was pending: ' + old[name].pending + ')' : ''}`);
  write(out);
}
