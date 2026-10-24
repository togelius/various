'use strict';
// RandomBot (DESIGN §18.8 G4): for each tile, after a 0.3 s reaction, a column the hand reaches picked at random
// (every one alike), and it lets go there. It sees only percepts (tools/bots/harness.cjs: the tile in the hand, the car
// it aims over) and acts only by real input: a click at the column's middle.
const P = require('./percept.cjs');

function create(o) {
  const rnd = P.rng(o.seed || 1), Y = (o.h || 844) * 0.6, maxT = o.maxT || 1200;
  const R = { name: 'RandomBot', tiles: 0, drops: 0, timedOut: false };
  let mode = 'idle', t = 0;
  const wait = s => { t += s; return { wait: s }; };
  function act(p) {
    if (p.results) return { done: true };
    if (t > maxT) { R.timedOut = true; return { done: true }; }
    const ready = !!(p.hand && p.hand.ready && p.hand.piece && !p.swap && p.car);
    if (!ready) { mode = 'idle'; return wait(1 / 60); }
    if (mode === 'idle') { mode = 'react'; R.tiles++; return wait(0.3); }
    const cols = P.handCols(p.hand.piece), c = cols[Math.floor(rnd() * cols.length)];
    mode = 'idle'; R.drops++;
    return { release: true, at: [P.colX(p, c), Y] };
  }
  return { name: 'RandomBot', act, report: () => R };
}

module.exports = { create, name: 'RandomBot' };
