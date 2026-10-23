'use strict';
// GhostReaderBot (DESIGN §18.8 G3): it believes the ghost. It sees only percepts (tools/bots/harness.cjs) and acts only
// by real input. For each tile it aims somewhere over the car (at a fit marker seven times in ten, else anywhere the
// hand reaches), reads the ghost there and lets go, then watches what happens, and counts a surprise whenever the
// screen does not do what the ghost said:
//  - a white ghost (it fits): the tile must join the tower exactly where the ghost was drawn (the tower's own move
//    between the two pictures taken out), and nothing else may change;
//  - a red, dashed ghost (it falls off): the tile must not join the tower, and the ghost must say why (its label) and
//    show it (red dots, or the part that would tip);
//  - the tile must leave from the hand, where the ghost's column starts;
//  - the fit markers must agree with the ghost: a fit has its marker (a square's outline, a ▼'s chevron, a ▲'s caret
//    inside it), a tile that falls off has none;
//  - a ghost is either solid (white; amber when the drop may take the tower over, gold where THE TOPPER tops out) or
//    red and dashed; an amber ghost says PAST THE WHEEL! by it and goes with a red ghost weight, a white one with a
//    white ghost weight.
// A crash (the tower goes over: the tiles leave, PAST THE WHEEL! is shown) is no surprise of the ghost; the ghost
// weight's colour at the last drop before it is counted (white ones that tipped the tower, red ones that did not).
// A finger: when the fuse lets go of the tile while the bot's finger is down aiming it, the bot lifts that finger
// before it aims the next tile, as a player does (the game drops at most one tile per lift: lifting the finger the fuse
// already spent lets nothing go, and the bot does not count that lift as a drop).
// The gate: zero surprises.
const P = require('./percept.cjs');

function shapeOf(poly) {
  if (poly.length === 4) return 'sq';
  const ys = poly.map(p => p[1]).sort((a, b) => a - b);
  return ys[1] - ys[0] > ys[2] - ys[1] ? 'up' : 'down';
}
function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// does a fit marker mark the ghost's place
function marked(p, L) {
  const g = p.ghost.poly, kind = shapeOf(g);
  for (const m of p.markers) {
    if (kind === 'sq' && m.kind === 'outline' && P.polyDist(m.pts, g) < 1.5) return true;
    if (kind === 'down' && m.kind === 'chevron' && m.pts.every(q => inside(q, g))) return true;
    if (kind === 'up' && m.kind === 'caret' && m.pts.every(q => inside(q, g))) return true;
  }
  return false;
}

function create(o) {
  const rnd = P.rng(o.seed || 1), max = o.drops || 5000;
  const R = { drops: 0, fits: 0, offs: 0, surprises: 0, kinds: {}, examples: [], crashes: 0, runs: 1, unread: 0, whiteDrops: 0, redDrops: 0, whiteTips: 0, whiteEx: [], redTips: 0, labels: {}, tipsMarked: 0, warned: 0, lifts: 0 };
  const st = { mode: 'idle', i: -1, pre: null, tries: 0, waited: 0, lastGW: null, seenCrash: false, spent: false };
  const surprise = (kind, what) => { R.surprises++; R.kinds[kind] = (R.kinds[kind] || 0) + 1; if (R.kinds[kind] <= 2) R.examples.push(kind + ': ' + what); };
  const crashed = (p, pre) => !!(p.results || (p.weight && p.weight.label) || (pre && p.tiles.length < pre.tiles.length));
  function againButton(p) { return p.buttons.find(b => b.text === 'AGAIN' && !b.disabled); }
  function act(p) {
    st.i++;
    switch (st.mode) {
      case 'idle': {
        if (p.results) {
          if (!st.seenCrash && st.lastGW) { st.seenCrash = true; }
          const b = againButton(p);
          if (!b) return { wait: 0.2 };
          if (R.drops >= max) return { done: true };
          R.runs++; st.lastGW = null;
          return { tap: [(b.box.x0 + b.box.x1) / 2, (b.box.y0 + b.box.y1) / 2] };
        }
        // the tower went over while nothing was in the air: the last drop's ghost weight answers for it
        if (st.lastGW && crashed(p, st.after)) { R.crashes++; if (st.lastGW === 'white') { R.whiteTips++; if (R.whiteEx.length < 3) R.whiteEx.push({ idle: true, results: !!p.results, label: p.weight && p.weight.label, tiles: [st.after.tiles.length, p.tiles.length] }); } st.lastGW = null; return { wait: 0.3 }; }
        if (R.drops >= max) return { done: true };
        if (!p.hand || !p.hand.ready || !p.ghost || p.swap || p.falling.length || !p.car) return { wait: 0.05 };
        // (the fuse let go while the finger was down: lift it first)
        if (st.spent) { st.spent = false; R.lifts++; return { release: true, meta: { lift: true } }; }
        const car = P.carFrame(p);
        let x;
        if (p.markers.length && rnd() < 0.7) {
          const m = p.markers[Math.floor(rnd() * p.markers.length)];
          x = P.centre(m.pts)[0];
        } else x = car.x0 + (rnd() * 5 - 0.5) * car.L;
        // (and a tenth of a second to look: the hand has slid over and a triangle has turned)
        st.mode = 'aim';
        return { move: [Math.max(1, Math.min(p.w - 1, x)), p.h * 0.55], wait: 0.1 };
      }
      case 'aim': {
        // (the hand let go without the bot: the fuse, while the bot's finger was down)
        if (!p.hand || !p.hand.ready || !p.ghost) { st.mode = 'idle'; if (o.touch && p.hand && !p.hand.ready) st.spent = true; return { wait: 0.05 }; }
        const says = P.ghostSays(p), L = P.carFrame(p).L;
        if (says === 'unclear') surprise('unclear ghost', `${p.ghost.color}${p.ghost.dashed ? ' dashed' : ''}`);
        const mk = marked(p, L);
        if (says === 'fit' && !mk) surprise('a fit without its marker', shapeOf(p.ghost.poly) + ' ' + JSON.stringify({ ghost: p.ghost.poly, markers: p.markers.filter(m => m.kind === 'caret').map(m => m.pts) }));
        // the drop that may take the tower over is said at the ghost too: amber, PAST THE WHEEL! by it, with the red ghost
        // weight (and only then)
        if (says === 'fit' && p.ghostWeight) {
          const amber = p.ghost.color === 'amber', red = p.ghostWeight.color === 'red';
          if (amber !== red) surprise('the ghost and the ghost weight disagree', `${p.ghost.color} ghost, ${p.ghostWeight.color} ghost weight`);
          else if (amber && p.ghost.callout !== 'PAST THE WHEEL!') surprise('no callout', 'an amber ghost without PAST THE WHEEL!');
          if (amber) R.warned++;
        }
        if (says === 'off' && mk) surprise('a marker where it falls off', shapeOf(p.ghost.poly) + ' (' + p.ghost.label + ')');
        if (says === 'off') {
          const m = p.ghost.marks, label = p.ghost.label;
          R.labels[label] = (R.labels[label] || 0) + 1;
          if (!label) surprise('no reason', 'a red ghost without its reason');
          else if (label === 'ONLY A POINT' && !(m && m.dots.length)) surprise('no red dot', 'ONLY A POINT without a red dot where it touches');
          else if (label === 'TIPS OVER') { if (!(m && m.part.length && m.pivot && m.plumb)) surprise('no tip marks', 'TIPS OVER without its part, corner and plumb line'); else R.tipsMarked++; }
        }
        if (p.ghostWeight) { if (p.ghostWeight.color === 'white') R.whiteDrops++; else R.redDrops++; }
        st.pre = { p, says, handX: p.hand.x, gw: p.ghostWeight ? p.ghostWeight.color : null, read: st.i };
        st.mode = 'released';
        return { release: true, meta: { read: st.i, says, gw: st.pre.gw } };
      }
      case 'released': {
        const pre = st.pre;
        // the tile leaves from the hand: the one now falling starts under it
        const f = p.falling.length ? p.falling.reduce((b, q) => (Math.abs(q.x - pre.handX) < Math.abs(b.x - pre.handX) ? q : b)) : null;
        if (!f) surprise('nothing let go', 'no tile falling after the release');
        else if (Math.abs(f.x - pre.handX) > 2) surprise('left from elsewhere', `${f.x} vs the hand at ${pre.handX} ` + JSON.stringify({ falling: p.falling, ghost: pre.p.ghost.poly, hand: pre.p.hand, says: pre.says }));
        st.mode = 'watch'; st.waited = 0; st.tries = 0; st.lastGW = pre.gw;
        return { wait: pre.says === 'fit' ? 0.42 : 0.5 };
      }
      case 'watch': {
        const pre = st.pre;
        if (crashed(p, pre.p)) {
          R.crashes++;
          if (pre.gw === 'white') { R.whiteTips++; if (R.whiteEx.length < 3) R.whiteEx.push({ read: pre.read, results: !!p.results, label: p.weight && p.weight.label, tiles: [pre.p.tiles.length, p.tiles.length], says: pre.says }); }
          st.lastGW = null; R.drops++; st.mode = 'idle'; return { wait: 0.3 };
        }
        if (p.falling.length) { st.waited += 0.1; if (st.waited > 3) { surprise('never settled', 'a tile still falling 3 s on'); st.mode = 'idle'; R.drops++; } return { wait: 0.1 }; }
        const M = P.towerMove(pre.p, p);
        if (!M || M.resid > 1.5) { if (++st.tries < 6) return { wait: 0.05 }; R.unread++; R.drops++; st.mode = 'idle'; return { wait: 0.05 }; }
        if (pre.says === 'fit') {
          R.fits++;
          if (p.tiles.length !== pre.p.tiles.length + 1) surprise('a white ghost that did not join', `${pre.p.tiles.length} tiles, then ${p.tiles.length}`);
          else {
            const d = P.polyDist(pre.p.ghost.poly.map(M.map), p.tiles[p.tiles.length - 1].poly);
            if (d > 1.5) surprise('landed away from its ghost', `${d.toFixed(1)} px`);
          }
        } else if (pre.says === 'off') {
          R.offs++;
          if (p.tiles.length !== pre.p.tiles.length) surprise('a red ghost that stayed', `${pre.p.tiles.length} tiles, then ${p.tiles.length}`);
        }
        R.drops++;
        st.after = p;
        // then the next one at once, or a moment later
        st.mode = 'idle';
        const v = rnd();
        if (v < 0.3) { st.i--; return act(p); }
        return { wait: 0.05 + 0.35 * rnd() };
      }
    }
    return { wait: 0.1 };
  }
  return { name: 'GhostReaderBot', act, report: () => R };
}

module.exports = { create };
