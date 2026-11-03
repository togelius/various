/* Can an evolved controller play the actual game?
 *
 * Quality is measured on isolated runs from chosen starts. This plays the game
 * the way a person does instead: the real flow from stage 1 through the final
 * boss - stage intros, checkpoints, deaths and respawns, results screens - with
 * three lives and a fresh random seed per game that selection never saw. The
 * harness only presses through menus; during play the controller has the pad.
 * Its memory is cleared at each new life and each new stage, as at the start
 * of a scored run.
 *
 *   node tools/evo/fullgame.js FILE.js [FILE.js ...] [--games=20] [--lives=3]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./headless');
const S = require('./sandbox');

function arg(n, d) {
  const a = process.argv.find(s => s.startsWith('--' + n + '='));
  return a ? a.split('=').slice(1).join('=') : d;
}
const GAMES = +arg('games', 20), LIVES = +arg('lives', 3), MAX_FRAMES = 90000;

function playGame(world, ctrl, seed) {
  const { VZ, game: g } = world;
  if (g.loop) g.loop.stop();
  VZ.audio.enabled = false;
  VZ.rand.setState(seed);
  g.setState('title');
  g.beginGame(0);
  g.lives = LIVES - 1;   // `lives` counts spares: 2 spare + the one in play = 3
  const deaths = [];
  let cleared = 0, f = 0, wasAlive = false, lastStage = -1, menuT = 0, errors = 0, slow = false;
  for (; f < MAX_FRAMES; f++) {
    let inp = {};
    if (g.state === 'play' && g.player && !g.player.dead && g.playerControl !== false) {
      if (!wasAlive || g.stageIndex !== lastStage) { ctrl.reset(seed + f); lastStage = g.stageIndex; }
      wasAlive = true;
      try { inp = S.decode(ctrl.step(S.observe(VZ, g, f))); }
      catch (e) { if (/timed out/.test(e.message)) { slow = true; break; } errors++; }
    } else {
      if (g.state === 'play' && g.player && g.player.dead && wasAlive) {
        deaths.push({ stage: g.stageIndex, x: Math.round(g.player.x), cause: g.player.deathCause || 'damage' });
        wasAlive = false;
      }
      // Menus: tap jump every 20 frames.
      menuT++;
      if (g.state !== 'play') inp = { jump: menuT % 20 < 3 };
    }
    VZ.input.virtual = inp;
    const before = g.stageIndex;
    g.update();
    if (g.stageIndex > before) cleared++;
    if (g.state === 'ending') { cleared = 3; break; }
    if (g.state === 'gameOver') break;
  }
  VZ.input.virtual = {};
  return { seed, beaten: g.state === 'ending', cleared, deaths, frames: f, errors, slow };
}

function main() {
  const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const world = H.boot();
  S.setupTask(world, { stage: 0, x: 24, y: 100, seed: 1, frames: 0, kind: 'run' });  // installs the recorders
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const ctrl = new S.Controller(src);
    const games = [];
    for (let i = 0; i < GAMES; i++) games.push(playGame(world, ctrl, 90000 + i * 7919));
    const beaten = games.filter(r => r.beaten).length;
    const byStage = [0, 1, 2, 3].map(k => games.filter(r => r.cleared >= k).length);
    const deaths = games.flatMap(r => r.deaths);
    const where = {};
    for (const d of deaths) {
      const k = 'stage ' + (d.stage + 1) + (d.x > 3080 ? ' boss' : ' x~' + Math.round(d.x / 256) * 256) + ' (' + d.cause + ')';
      where[k] = (where[k] || 0) + 1;
    }
    console.log(path.basename(file).padEnd(28) + 'beat the game ' + beaten + '/' + GAMES +
      '   reached stage 2: ' + byStage[1] + ', stage 3: ' + byStage[2] +
      '   deaths/game ' + (deaths.length / GAMES).toFixed(2) +
      '   mean game ' + (games.reduce((s, r) => s + r.frames, 0) / GAMES / 3600).toFixed(1) + ' min' +
      (games.some(r => r.errors || r.slow) ? '   (errors in ' + games.filter(r => r.errors || r.slow).length + ' games)' : ''));
    const top = Object.entries(where).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (top.length) console.log('    where lives were lost: ' + top.map(([k, v]) => k + ' x' + v).join(', '));
  }
}

main();
