#!/usr/bin/env node
// ACCESSION — regenerates test/golden/golden.js. Run only when a rule changed on purpose,
// and say why in DEVELOPMENT.md's validation log.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..');
const C = require('./core-context.js').loadCore(['tools/monkey.js']);
const RUNS = { m0Monkey: { seed: 20261023, actions: 10000 } };
const out = {};
for (const [name, r] of Object.entries(RUNS)) {
  const res = C.Monkey.run(r.seed, r.actions);
  out[name] = { seed: r.seed, actions: r.actions, hash: res.hash, checkpoints: res.checkpoints, visits: res.visits };
  console.log(name, res.hash);
}
fs.writeFileSync(path.join(root, 'test/golden/golden.js'),
  "// ACCESSION — golden runs: expected hashes for fixed seeds and action lists (BUILD.md §3.5).\n// Regenerate only on purpose (node tools/golden.js), and log why in DEVELOPMENT.md.\n'use strict';\nconst GOLDEN = " + JSON.stringify(out, null, 1) + ';\n');
