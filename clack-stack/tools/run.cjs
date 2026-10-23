'use strict';
// node tools/run.cjs --tier=N (DESIGN §18.8): the test tiers. Tiers 1 and 2, the rules tiers, live in tools/rules/run.cjs;
// tier 3, the browser tests (G3), in tools/g3.cjs (its options pass through: [outDir] [--only=a,b] [--quick]).
const tierArg = process.argv.find(a => a.startsWith('--tier='));
if (tierArg && tierArg.slice(7) === '3') {
  const { spawn } = require('child_process');
  const args = process.argv.slice(2).filter(a => a !== tierArg);
  console.log('tier 3: the browser tests (G3), tools/g3.cjs');
  const p = spawn(process.execPath, [require('path').join(__dirname, 'g3.cjs')].concat(args), { stdio: 'inherit' });
  p.on('close', code => process.exit(code === null ? 1 : code));
} else require('./rules/run.cjs');
