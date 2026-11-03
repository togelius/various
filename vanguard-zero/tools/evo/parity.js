/* Is the headless game the same game?
 *
 * Drives the browser build (Playwright) and the Node build (headless.js) with
 * identical scripted inputs from identical RNG state, and compares the player's
 * position and the enemy roster frame by frame. Any divergence means a score
 * earned headless is not a score in the real game.
 *
 *   node tools/evo/parity.js
 */
'use strict';
const path = require('path');
const { chromium } = require('playwright');
const H = require('./headless');

// A few deliberately different input scripts: run-and-gun, jump spam, stop-go.
const SCRIPTS = [
  'f => ({ right: true, jump: (f % 40) < 12, fire: (f % 8) < 4 })',
  'f => ({ right: (f % 90) < 70, left: (f % 90) >= 80, jump: (f % 23) < 9, dash: f % 61 === 0 })',
  'f => ({ right: (f % 50) < 30, jump: (f % 31) < 15, fire: (f % 20) < 18, down: (f % 200) > 190 })'
];
const CASES = [];
for (let stage = 0; stage < 3; stage++) {
  SCRIPTS.forEach((s, i) => CASES.push({ stage, script: s, seed: 1000 + stage * 10 + i }));
}
const FRAMES = 900;

// Runs in either world; `VZ` is that world's game namespace.
const TRACE = (VZ, { stage, script, seed, frames }) => {
  const g = VZ.game;
  const inp = eval(script); // eslint-disable-line no-eval
  if (g.loop) g.loop.stop();
  VZ.audio.enabled = false;
  g.lives = 3; g.score = 0; g.player = null;
  VZ.rand.setState(seed);
  g.loadStage(stage, false);
  g.setState('play');
  g.fade = 0; g.fadeTarget = 0; g.fadeCb = null;
  const out = [];
  for (let f = 0; f < frames; f++) {
    VZ.input.virtual = inp(f);
    g.update();
    const p = g.player;
    out.push([+p.x.toFixed(4), +p.y.toFixed(4), p.hp, g.enemies.length,
      g.projectiles.length, VZ.rand.state()]);
  }
  VZ.input.virtual = {};
  return out;
};

async function main() {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.goto('file://' + path.join(H.ROOT, 'index.html'));
  await page.waitForFunction('window.VZ && window.VZ.game');
  await page.waitForTimeout(300);

  const node = H.boot();
  let worst = 0, failures = 0;
  for (const c of CASES) {
    const a = await page.evaluate(
      ({ fn, c }) => (new Function('return ' + fn)())(window.VZ, c),
      { fn: TRACE.toString(), c: { ...c, frames: FRAMES } });
    const b = TRACE(node.VZ, { ...c, frames: FRAMES });
    let firstBad = -1, maxd = 0;
    for (let f = 0; f < FRAMES; f++) {
      const d = Math.max(Math.abs(a[f][0] - b[f][0]), Math.abs(a[f][1] - b[f][1]));
      maxd = Math.max(maxd, d);
      const same = d === 0 && a[f][2] === b[f][2] && a[f][3] === b[f][3] &&
                   a[f][4] === b[f][4] && a[f][5] === b[f][5];
      if (!same && firstBad < 0) firstBad = f;
    }
    worst = Math.max(worst, maxd);
    if (firstBad >= 0) failures++;
    console.log('stage ' + (c.stage + 1) + '  seed ' + c.seed + '  ' +
      (firstBad < 0 ? 'identical over ' + FRAMES + ' frames'
                    : 'DIVERGES at frame ' + firstBad + ' (max ' + maxd.toFixed(4) + ' px)') +
      '   end x ' + b[FRAMES - 1][0]);
  }
  console.log('\nworst positional divergence: ' + worst.toFixed(4) + ' px; ' +
    failures + ' of ' + CASES.length + ' traces differ in any field');
  await browser.close();
  process.exitCode = failures ? 1 : 0;
}

main();
