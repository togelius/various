'use strict';
// HumanishBot (DESIGN §18.8 G3): a player with a human's limits, who sees only percepts (tools/bots/harness.cjs) and
// acts only by real input. For each tile: it reacts after 0.3 s; it looks at no more than 4 columns, the places the fit
// markers show, lowest and nearest the middle first, each look a pointer move and a glance (0.12 s) at the ghost and
// the ghost weight, stopping at the first where both are white; then it lets go there, its release off by up to 6 px
// (uniform, either way). It reports how often a tile left from another column than the one it chose: the tile falling
// from somewhere other than under the hand of that look (in tiles along the car), or a fit landing away from that
// look's ghost. The gate is 5% for squares.
const P = require('./percept.cjs');

function create(o) {
  const rnd = P.rng(o.seed || 1), max = o.drops || 800, JIT = o.jitter === undefined ? 6 : o.jitter;
  const REACT = 0.3, LOOK = 0.12, LOOKS = 4;
  const R = { drops: 0, by: { sq: { n: 0, wrong: 0 }, tri: { n: 0, wrong: 0 } }, looks: [0, 0, 0, 0, 0], fuse: 0, crashes: 0, runs: 1, offs: 0, examples: [], jitter: JIT };
  const st = { mode: 'idle', i: -1, cands: [], looks: [], k: 0, chosen: null };
  const again = p => p.buttons.find(b => b.text === 'AGAIN' && !b.disabled);
  // where a fit marker asks the tile to go (its middle across the screen), lowest first, then nearest the middle
  function candidates(p) {
    const car = P.carFrame(p), out = [];
    for (const m of p.markers) {
      const c = P.centre(m.pts);
      out.push({ x: c[0], y: c[1] });
    }
    out.sort((a, b) => (b.y - a.y) || (Math.abs(a.x - car.mid) - Math.abs(b.x - car.mid)));
    const pick = [];
    for (const c of out) if (!pick.some(q => Math.abs(q.x - c.x) < 0.3 * car.L)) pick.push(c);
    if (!pick.length) pick.push({ x: car.mid, y: car.y });
    return pick.slice(0, LOOKS);
  }
  const inCar = (p, x) => { const c = P.carFrame(p); return (x - c.x0) / c.L; };
  function act(p) {
    st.i++;
    switch (st.mode) {
      case 'idle': {
        if (p.results) { const b = again(p); if (!b) return { wait: 0.2 }; if (R.drops >= max) return { done: true }; R.runs++; return { tap: [(b.box.x0 + b.box.x1) / 2, (b.box.y0 + b.box.y1) / 2] }; }
        if (R.drops >= max) return { done: true };
        if (!p.hand || !p.hand.ready || !p.ghost || p.swap || p.falling.length || !p.car) return { wait: 0.05 };
        st.mode = 'plan';
        return { wait: REACT };
      }
      case 'plan': {
        if (!p.hand || !p.hand.ready || !p.car) { st.mode = 'idle'; return { wait: 0.05 }; }
        st.cands = candidates(p); st.looks = []; st.k = 0; st.piece = p.hand.piece;
        st.mode = 'look';
        return { move: [st.cands[0].x, p.h * 0.6], wait: LOOK };
      }
      case 'look': {
        // the fuse let go while it looked
        if (p.falling.length || !p.hand || !p.hand.ready) { R.fuse++; st.mode = 'idle'; return { wait: 0.6 }; }
        const says = P.ghostSays(p);
        const look = { x: st.cands[st.k].x, p, says, gw: p.ghostWeight ? p.ghostWeight.color : null, handX: p.hand.x, read: st.i };
        st.looks.push(look);
        const good = says === 'fit' && look.gw !== 'red';
        if (!good && st.k + 1 < st.cands.length) { st.k++; return { move: [st.cands[st.k].x, p.h * 0.6], wait: LOOK }; }
        R.looks[st.looks.length]++;
        st.chosen = st.looks.find(l => l.says === 'fit' && l.gw !== 'red') || st.looks.find(l => l.says === 'fit') || st.looks[st.looks.length - 1];
        st.mode = 'released';
        const jx = (rnd() * 2 - 1) * JIT, jy = (rnd() * 2 - 1) * JIT;
        return { release: true, at: [st.chosen.x + jx, p.h * 0.6 + jy], meta: { read: st.chosen.read, piece: st.piece, jitter: jx } };
      }
      case 'released': {
        const c = st.chosen, f = p.falling.length ? p.falling.reduce((b, q) => (Math.abs(q.x - c.handX) < Math.abs(b.x - c.handX) ? q : b)) : null;
        // how far from the chosen look's column it left, in tiles along the car
        st.off = f ? Math.abs(inCar(p, f.x) - inCar(c.p, c.handX)) : 99;
        st.mode = 'watch'; st.waited = 0; st.tries = 0;
        return { wait: 0.45 };
      }
      case 'watch': {
        const c = st.chosen, pre = c.p;
        const crashed = p.results || (p.weight && p.weight.label) || p.tiles.length < pre.tiles.length;
        if (!crashed && p.falling.length && st.waited < 3) { st.waited += 0.1; return { wait: 0.1 }; }
        let wrong = st.off > 0.24, landedAway = false;
        if (!crashed && c.says === 'fit' && p.tiles.length === pre.tiles.length + 1) {
          const M = P.towerMove(pre, p);
          if (M && M.resid < 1.5) landedAway = P.polyDist(pre.ghost.poly.map(M.map), p.tiles[p.tiles.length - 1].poly) > 1.5;
          else if (++st.tries < 6) return { wait: 0.05 };
        }
        if (landedAway) wrong = true;
        if (crashed) R.crashes++;
        if (p.tiles.length === pre.tiles.length && !crashed) R.offs++;
        const b = R.by[st.piece === 'sq' ? 'sq' : 'tri'];
        b.n++; if (wrong) { b.wrong++; if (R.examples.length < 6) R.examples.push(`${st.piece}: left ${st.off.toFixed(2)} tiles from the chosen column${landedAway ? ', landed away from its ghost' : ''}`); }
        R.drops++;
        st.mode = 'idle';
        return { wait: 0.05 };
      }
    }
    return { wait: 0.1 };
  }
  return { name: 'HumanishBot', act, report: () => R };
}

module.exports = { create };
