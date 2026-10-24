#!/usr/bin/env node
'use strict';
// The G3 browser tests (DESIGN §18.8, tier 3), one line each with its time: every one at 390x844, 844x390 and
// 1366x1024 through real input, failing on any console error.
//   build      tools/build.cjs --check: the page's rules block is the rules file
//   selftest   the in-page selftest and real mouse drops (tools/selftest.cjs)
//   input      the hand, the ghost, the fit markers, the reasons and their marks against the rules, the release and the
//              landing (tools/input.cjs)
//   tips       TIPS OVER: golden cases 14–18 and the neither-fits way through real input, the part (the whole group of
//              a locked piece), corner and plumb line in the display list as the rules have them, the rock (one rigid
//              body; no whole-edge joint opens, a tile landing on the part meanwhile included), the hint, BIG MAGNETS'
//              pull (tools/tips.cjs)
//   falls      every tile that falls off lands on the rug on the side it tipped to (tools/falls.cjs)
//   flow       the box, THE TOPPER, the dead-tile swap, each hint once, BIG MAGNETS (tools/flow.cjs)
//   nearmiss   every near miss at the zoom floor, its gap visibly marked (tools/nearmiss.cjs)
//   ghostweight  no white drop tips the tower (tools/ghostweight.cjs)
//   display    the display-list audit: hiding each layer changes the pixels it claims (tools/display.cjs)
//   bots       the percept-only lint, GhostReaderBot and HumanishBot (tools/bots.cjs)
//   feel       feel and flow by mouse, touch and keys (tools/feel.cjs)
//   screens    every screen, with its contact sheet (tools/screens.cjs)
// Logs go to outDir/<test>.log; the screens and the near-miss sheets to outDir/shots and outDir/nearmiss.
//   [CLACK_GAME=page.html] node clack-stack/tools/g3.cjs [outDir] [--rules=path] [--only=a,b] [--quick]
//     CLACK_GAME  another page to test (tools/lib.cjs), built from --rules
//     --rules  the rules file the page was built from (for build and selftest; default rules.js)
//     --quick  fewer drops (bots 600 / 120, input 80, ghostweight 300): a smoke run, not the gate
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const argv = process.argv.slice(2);
const OUT = path.resolve(argv.find(a => !a.startsWith('--')) || path.join(os.tmpdir(), 'clack-g3'));
const RULES = argv.find(a => a.startsWith('--rules='));
const ONLY = ((argv.find(a => a.startsWith('--only=')) || '').slice(7)).split(',').filter(Boolean);
const QUICK = argv.includes('--quick');
const T = n => path.join(__dirname, n);

const TESTS = [
  ['build', [T('build.cjs'), '--check'].concat(RULES ? [RULES] : []).concat(process.env.CLACK_GAME ? ['--html=' + process.env.CLACK_GAME] : [])],
  ['selftest', [T('selftest.cjs')].concat(RULES ? [RULES] : [])],
  ['input', [T('input.cjs')].concat(QUICK ? ['--drops=80', '--keys=10', '--big=20'] : [])],
  ['tips', [T('tips.cjs')]],
  ['falls', [T('falls.cjs')]],
  ['flow', [T('flow.cjs')]],
  ['nearmiss', [T('nearmiss.cjs'), path.join(OUT, 'nearmiss')]],
  ['ghostweight', [T('ghostweight.cjs')].concat(QUICK ? ['--drops=300'] : [])],
  ['display', [T('display.cjs')]],
  ['bots', [T('bots.cjs')].concat(QUICK ? ['--ghost=600', '--humanish=120'] : [])],
  ['feel', [T('feel.cjs')]],
  ['screens', [T('screens.cjs'), path.join(OUT, 'shots')]],
];

function runOne(name, args) {
  return new Promise(res => {
    const t0 = Date.now(), log = fs.createWriteStream(path.join(OUT, name + '.log'));
    const p = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let last = '';
    const keep = d => { log.write(d); const s = d.toString().trim().split('\n').filter(Boolean); if (s.length) last = s[s.length - 1]; };
    p.stdout.on('data', keep); p.stderr.on('data', keep);
    p.on('close', code => { log.end(); res({ name, code, s: (Date.now() - t0) / 1000, last }); });
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const t0 = Date.now(), results = [];
  for (const [name, args] of TESTS) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    const r = await runOne(name, args);
    results.push(r);
    console.log(`${r.code === 0 ? 'PASS' : 'FAIL'} ${name.padEnd(12)} ${r.s.toFixed(0).padStart(5)} s  ${r.last}`);
  }
  const bad = results.filter(r => r.code !== 0);
  console.log(`G3: ${bad.length ? bad.length + ' of ' + results.length + ' FAILED (' + bad.map(r => r.name).join(', ') + ')' : 'all ' + results.length + ' passed'} in ${((Date.now() - t0) / 60000).toFixed(1)} min; logs in ${OUT}`);
  process.exitCode = bad.length ? 1 : 0;
})();
