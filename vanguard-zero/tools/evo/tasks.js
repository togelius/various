/* Where runs start, and which starts the search is never shown.
 *
 * A controller evolved from one starting position learns that position: the
 * first jump at frame 40 lands on the ledge at frame 81 because it always has.
 * So every candidate is scored from many starts spread through all three
 * stages, each with its own random seed, and a second, interleaved set of
 * starts is held out entirely - selection never sees it. The gap between the
 * two is the measure of overfitting, the way a trading strategy is judged on
 * the period it was not fitted to.
 *
 * Starts are not hand-picked. Every tile column is scanned for footing a
 * player could stand on, each candidate is checked by simulation (drop the
 * player there, idle for a second: still alive, still standing, not sliding
 * off), and positions are taken at even spacing along the stage.
 *
 *   node tools/evo/tasks.js            -> writes tools/evo/tasks.json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./headless');
const S = require('./sandbox');

const PER_STAGE = 16;     // run starts per stage, alternately train and test
/* Each start is run under several seeds. One seed per start under-samples
 * the game: enemy timing varies from seed to seed, and the first run of this
 * search produced controllers that crossed a lava pit with the one training
 * seed that reached it and fell in under most others. */
const SEEDS = 3;
const TRAIN_SEED = 1000, TEST_SEED = 5000;

function standable(lv, TL, tx, ty) {
  const g = lv.at(tx, ty);
  const ground = g === TL.SOLID || g === TL.PLATFORM || g === TL.CONV_R || g === TL.CONV_L;
  if (!ground) return false;
  for (let k = 1; k <= 2; k++) {
    const b = lv.at(tx, ty - k);
    if (b !== TL.EMPTY) return false;
  }
  return true;
}

function candidates(world, stage) {
  const { VZ, game: g } = world;
  S.setupTask(world, { stage, x: 0, y: 0, seed: 1, frames: 0, kind: 'run' });
  const lv = g.level, TL = VZ.tiles, T = VZ.TILE;
  const gate = lv.bossGate ? lv.bossGate.x : g.arena.x0;
  const out = [];
  for (let tx = 1; tx * T < gate - 3 * T; tx++) {
    for (let ty = 3; ty < lv.h; ty++) {
      if (standable(lv, TL, tx, ty)) out.push({ x: tx * T + T / 2, y: ty * T - 11, tx, ty });
    }
  }
  return { list: out, gate, start: lv.start };
}

// Drop the player there and leave it alone for a second.
function verify(world, stage, c) {
  const { VZ, game: g } = world;
  S.setupTask(world, { stage, x: c.x, y: c.y, seed: 7, frames: 0, kind: 'run' });
  const p = g.player;
  for (let f = 0; f < 60; f++) {
    VZ.input.virtual = {};
    g.update();
    if (p.dead) return false;
  }
  return p.grounded && Math.abs(p.y - c.y) < 3 && Math.abs(p.x - c.x) < 6 && p.hp === p.maxHp;
}

function budget(dist) {
  // Enough for an average of ~1.1 px/frame against a run speed of 1.95.
  return Math.min(3000, Math.round(300 + dist / 1.1));
}

function build() {
  const world = H.boot();
  const tasks = { train: [], test: [], meta: { perStage: PER_STAGE, seeds: SEEDS, made: 'tools/evo/tasks.js' } };
  for (let stage = 0; stage < 3; stage++) {
    const { list, gate } = candidates(world, stage);
    const ok = list.filter(c => verify(world, stage, c));
    ok.sort((a, b) => a.x - b.x);
    const lo = ok[0].x, hi = gate - 160;
    const picked = [];
    for (let i = 0; i < PER_STAGE; i++) {
      const want = lo + (hi - lo) * (i / (PER_STAGE - 1));
      let best = null, bd = Infinity;
      for (const c of ok) {
        if (picked.includes(c)) continue;
        const d = Math.abs(c.x - want);
        if (d < bd) { bd = d; best = c; }
      }
      picked.push(best);
    }
    picked.sort((a, b) => a.x - b.x);
    picked.forEach((c, i) => {
      const set = i % 2 === 0 ? 'train' : 'test';
      for (let k = 0; k < SEEDS; k++) {
        const n = tasks[set].length;
        tasks[set].push({
          id: set[0] + 's' + (stage + 1) + '-' + Math.round(c.x) + (SEEDS > 1 ? '.' + k : ''),
          kind: 'run', stage, x: c.x, y: c.y,
          seed: (set === 'train' ? TRAIN_SEED : TEST_SEED) + n,
          frames: budget(gate - c.x)
        });
      }
    });
    // The boss: start just short of the gate, so walking in is part of it.
    const nearGate = ok.filter(c => c.x < gate - 24 && c.x > gate - 200).pop() || ok[ok.length - 1];
    for (const set of ['train', 'test']) {
      for (let k = 0; k < SEEDS; k++) {
        tasks[set].push({
          id: set[0] + 'b' + (stage + 1) + (SEEDS > 1 ? '.' + k : ''), kind: 'boss', stage,
          x: nearGate.x, y: nearGate.y,
          seed: (set === 'train' ? TRAIN_SEED : TEST_SEED) + 100 + stage * 10 + k,
          frames: 2700
        });
      }
    }
    console.log('stage ' + (stage + 1) + ': ' + list.length + ' footholds, ' + ok.length +
      ' verified; starts at x = ' + picked.map(c => Math.round(c.x)).join(', ') +
      '; boss from x = ' + Math.round(nearGate.x) + ' (gate ' + gate + ')');
  }
  return tasks;
}

if (require.main === module) {
  const t = build();
  const out = path.join(__dirname, 'tasks.json');
  fs.writeFileSync(out, JSON.stringify(t, null, 1));
  console.log('train ' + t.train.length + ' tasks, test ' + t.test.length + ' tasks -> ' + path.relative(process.cwd(), out));
}

module.exports = { build };
