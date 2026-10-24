'use strict';
// What a percept-only bot may use (DESIGN §18.8 G3): plain geometry on what it sees. A percept is the display list as
// drawn (CS.display(), cut down by tools/bots/harness.cjs to what is visible on the screen): polygons and points in
// CSS px, colours, dashes and the words on the screen. Nothing here reads the game.

// the box round a list of points
function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return { x0, y0, x1, y1 };
}
function centre(pts) { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; }
// the largest distance from a point of A to the nearest point of B, both ways
function polyDist(A, B) {
  if (!A || !B || !A.length || !B.length) return Infinity;
  const one = (P, Q) => { let m = 0; for (const p of P) { let b = Infinity; for (const q of Q) b = Math.min(b, Math.hypot(p[0] - q[0], p[1] - q[1])); m = Math.max(m, b); } return m; };
  return Math.max(one(A, B), one(B, A));
}
// an affine map fitted to pairs of points (a list of [from, to]), by least squares: {map, resid}; null with fewer than
// three points not on a line
function fitAffine(pairs) {
  const n = pairs.length;
  if (n < 3) return null;
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bx = [0, 0, 0], by = [0, 0, 0];
  for (const [a, b] of pairs) {
    const v = [a[0], a[1], 1];
    for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) M[i][j] += v[i] * v[j]; bx[i] += v[i] * b[0]; by[i] += v[i] * b[1]; }
  }
  const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  if (Math.abs(D) < 1e-6) return null;
  const solve = b => [0, 1, 2].map(c => det(M.map((row, i) => row.map((v, j) => (j === c ? b[i] : v)))) / D);
  const X = solve(bx), Y = solve(by), map = p => [X[0] * p[0] + X[1] * p[1] + X[2], Y[0] * p[0] + Y[1] * p[1] + Y[2]];
  let resid = 0;
  for (const [a, b] of pairs) { const m = map(a); resid = Math.max(resid, Math.hypot(m[0] - b[0], m[1] - b[1])); }
  return { map, resid };
}
// How the screen moved between two pictures of the same tower: from the tiles both show (in the order they are drawn)
// or, with none, from the car (its top's ends and its wheels). {map, resid} or null
function towerMove(before, after) {
  const pairs = [];
  const n = Math.min(before.tiles.length, after.tiles.length);
  for (let i = 0; i < n; i++) {
    const a = before.tiles[i].poly, b = after.tiles[i].poly;
    if (a.length !== b.length) return null;
    for (let k = 0; k < a.length; k++) pairs.push([a[k], b[k]]);
  }
  if (pairs.length < 3) {
    if (!before.car || !after.car) return null;
    for (const k of ['top', 'wheels']) for (let j = 0; j < 2; j++) pairs.push([before.car[k][j], after.car[k][j]]);
  }
  return fitAffine(pairs);
}
// the car on the screen: its top's ends, the px per tile, its middle
function carFrame(p) {
  if (!p.car) return null;
  const [a, b] = p.car.top, L = Math.hypot(b[0] - a[0], b[1] - a[1]) / 4;
  return { L, x0: a[0], x1: b[0], y: (a[1] + b[1]) / 2, mid: (a[0] + b[0]) / 2 };
}
// what the ghost says: 'fit' (solid: white; amber when it may take the tower over; gold where THE TOPPER tops out) or
// 'off' (red, dashed), as drawn
const FIT_COLORS = new Set(['white', 'amber', 'gold']);
function ghostSays(p) { return !p.ghost ? null : FIT_COLORS.has(p.ghost.color) && !p.ghost.dashed ? 'fit' : p.ghost.color === 'red' && p.ghost.dashed ? 'off' : 'unclear'; }
// a deterministic random stream for a bot's choices
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---- for the strategy bots (DESIGN §18.8 G4): the hand's columns, a look at the ghost, a still tower, the fuse ---- */
// The hand's columns for the tile drawn in it, as the tile's left x in half tiles from the car's middle: a square's
// whole tiles (left x −2…1), a triangle's half tiles (left x −2.5…1.5). The hand is drawn at a column's middle.
function handCols(piece) { const out = []; if (piece === 'sq') for (let c = -4; c <= 2; c += 2) out.push(c); else for (let c = -5; c <= 3; c++) out.push(c); return out; }
// the screen x of a column's middle, from the car as drawn
function colX(p, c) { const f = carFrame(p); return f.mid + (c / 2 + 0.5) * f.L; }
// the column the hand is drawn at
function handColOf(p) { const f = carFrame(p); return Math.round(2 * ((p.hand.x - f.mid) / f.L - 0.5)); }
// what a look at the ghost shows, in L on the car (x from its middle, heights above its top): what it says ('fit' or
// 'off'), gold (THE TOPPER tops out there), red (the ghost weight says it may take the tower over), where the tile would
// be (its foot and top, its middle), how much of it rests on a flat top it lands on (the shine along its bottom, in
// tiles), and the ghost weight (where it settles, its swing: lo..hi; the wheels at ±wheel)
function look(p) {
  if (!p.ghost || !p.car) return null;
  const f = carFrame(p), b = bbox(p.ghost.poly), m = centre(p.ghost.poly), says = ghostSays(p);
  const wl = p.car.wheels, wheel = Math.abs(wl[1][0] - wl[0][0]) / 2 / f.L;
  const o = { says, gold: p.ghost.color === 'gold', red: !!(p.ghostWeight && p.ghostWeight.color === 'red'), x: (m[0] - f.mid) / f.L,
    foot: (f.y - b.y1) / f.L, top: (f.y - b.y0) / f.L, wheel, settle: 0, lo: 0, hi: 0, held: 0, at: p.hand ? handColOf(p) : null };
  if (p.weight && p.weight.strip) {
    const zero = (p.weight.strip.x0 + p.weight.strip.x1) / 2;
    if (p.ghostWeight) {
      o.settle = (p.ghostWeight.x - zero) / f.L;
      const s = p.ghostWeight.swing || [p.ghostWeight.x, p.ghostWeight.x];
      o.lo = (s[0] - zero) / f.L; o.hi = (s[1] - zero) / f.L;
    } else o.settle = o.lo = o.hi = (p.weight.x - zero) / f.L;
  }
  // (the contacts that shine along its bottom: within a few px of its lowest line)
  // ([x1, y1, x2, y2] each; a swaying ghost's bottom is tilted a little)
  const tol = Math.max(3, 0.3 * f.L);
  for (const sg of p.ghost.shine || []) {
    if (sg.length === 4 && Math.abs(sg[1] - b.y1) < tol && Math.abs(sg[3] - b.y1) < tol) o.held += Math.hypot(sg[2] - sg[0], sg[3] - sg[1]) / f.L;
  }
  return o;
}
// How still the tower is, from what is drawn: the middle of its highest tile (across the car, in L) and the car top's
// tilt, over the reads a bot makes (t: the bot's own clock, s). The watch starts over when a tile joins or leaves.
// still(t): for the last `win` s the highest tile's middle has stayed within `tol` L and the car top has lain level
// (both wheels down). An empty car is still when it lies level.
function stillWatch(win, tol) {
  let hist = [], n = -1, idx = -1;
  return {
    see(p, t) {
      if (!p.car) { hist = []; n = -1; return; }
      if (p.tiles.length !== n) {
        hist = []; n = p.tiles.length; idx = -1;
        let best = Infinity;
        p.tiles.forEach((tl, i) => { const y = bbox(tl.poly).y0; if (y < best - 0.5) { best = y; idx = i; } });
      }
      const f = carFrame(p), level = Math.abs(p.car.top[1][1] - p.car.top[0][1]) < 0.5;
      const x = idx >= 0 && p.tiles[idx] ? (centre(p.tiles[idx].poly)[0] - f.mid) / f.L : 0;
      hist.push({ t, x, level });
      while (hist.length > 1 && hist[1].t <= t - win + 1e-9) hist.shift();
    },
    still(t) {
      if (!hist.length || t - hist[0].t < win - 1e-9) return false;
      let lo = Infinity, hi = -Infinity;
      for (const h of hist) { if (!h.level) return false; if (h.x < lo) lo = h.x; if (h.x > hi) hi = h.x; }
      return hi - lo <= tol;
    },
  };
}
// How long the fuse has left, from the ring drawn round the tile in the hand (u: how much of it has emptied) and how fast
// it empties between the bot's reads (t: the bot's own clock). Infinity while no fuse is drawn; until it has been seen
// to move, the most it could have left (3 s from full).
function fuseWatch() {
  let t0 = 0, u0 = -1, rate = 0;
  return {
    see(p, t) {
      if (!p.fuse) { u0 = -1; rate = 0; return; }
      const u = p.fuse.u;
      if (u0 < 0 || u < u0 - 1e-6) { t0 = t; u0 = u; rate = 0; return; }
      if (t > t0 + 1e-6 && u > u0 + 1e-6) rate = (u - u0) / (t - t0);
    },
    left(p) { if (!p.fuse) return Infinity; const u = p.fuse.u; return rate > 0 ? (1 - u) / rate : 3 * (1 - u); },
  };
}
// THE TOPPER is in the hand: the box's counter says so
function topperInHand(p) { return !!(p.counter && /TOPPER: NOW/.test(p.counter.text || '')); }
// the shape of a tile's outline: 'sq', 'up' (▲) or 'down' (▼)
function shapeOf(poly) {
  if (poly.length === 4) return 'sq';
  const ys = poly.map(q => q[1]).sort((a, b) => a - b);
  return ys[1] - ys[0] > ys[2] - ys[1] ? 'up' : 'down';
}
// the look's tile is held by half an edge (half its bottom edge on a top, or a ▼ by one side: it kicks the tower more)
function halfHeld(p, l) { return shapeOf(p.ghost.poly) === 'down' ? (p.ghost.shine || []).length < 2 : l.held < 0.9; }

// A strategy bot's run, from what it sees (DESIGN §18.8 G4). For each tile in the hand it reacts (o.react s, 0.3 by
// default), then, if o.patient, waits for a still tower (stillWatch(o.win, o.tol): 0.6 s, 0.2 L) as long as the fuse
// allows, keeping o.spare s (0.45) of it, then looks at the columns plan.cols(ctx) names, each look a pointer move and a
// glance (o.glance s, a frame) at the ghost and the ghost weight there, and lets go where plan.choose(looks, ctx) says:
// {go: column} or {more: [columns]} (look at those too, then choose again). With plan.recheck(now, then, ctx) it looks
// once more as it lets go and, if that says no, looks again from the start (once a tile). ctx: {piece, topper, p (the
// percept it began to look from)}; a look is look(p) with its column c and half (held by half an edge). It acts by
// pointer moves and clicks at the column's middle, 0.6 of the way down the screen.
function lookingBot(name, o, plan) {
  const react = o.react === undefined ? 0.3 : o.react, glance = o.glance || 1 / 60, patient = !!o.patient, spare = o.spare === undefined ? 0.45 : o.spare;
  const maxWait = o.maxWait || 6, Y = (o.h || 844) * 0.6, maxT = o.maxT || 1200;
  const sw = stillWatch(o.win || 0.6, o.tol || 0.2), fw = fuseWatch();
  const R = { name, tiles: 0, drops: 0, looks: 0, waited: 0, settled: 0, fuseCut: 0, byFuse: 0, replans: 0, timedOut: false };
  let mode = 'idle', t = 0, ctx = null, cols = [], k = 0, looks = [], chosen = null, waitT = 0, tries = 0, replanned = false;
  const wait = s => { t += s; return { wait: s }; };
  const moveTo = (p, c) => { t += glance; return { move: [colX(p, c), Y], wait: glance }; };
  function begin(p) {
    ctx.p = p; cols = plan.cols(ctx).slice(); k = 0; looks = []; mode = 'look';
    return moveTo(p, cols[0]);
  }
  function act(p) {
    sw.see(p, t); fw.see(p, t);
    if (p.results) return { done: true };
    if (t > maxT) { R.timedOut = true; return { done: true }; }
    const ready = !!(p.hand && p.hand.ready && p.hand.piece && !p.swap && p.car && p.ghost);
    // (the fuse let go while it waited or looked)
    if (!ready && mode !== 'idle') { mode = 'idle'; R.byFuse++; return wait(1 / 60); }
    if (mode === 'idle') {
      if (!ready) return wait(1 / 60);
      ctx = { piece: p.hand.piece, topper: topperInHand(p), p }; replanned = false; waitT = 0;
      R.tiles++;
      mode = patient ? 'settle' : 'react';
      if (react > 0) return wait(react);
    }
    if (mode === 'react') return begin(p);
    if (mode === 'settle') {
      if (sw.still(t) && !p.falling.length) { R.settled++; return begin(p); }
      if (fw.left(p) < spare) { R.fuseCut++; return begin(p); }
      if (waitT >= maxWait) return begin(p);
      waitT += 0.05; R.waited += 0.05;
      return wait(0.05);
    }
    if (mode === 'look') {
      const l = look(p);
      l.c = cols[k]; l.half = halfHeld(p, l);
      looks.push(l); R.looks++;
      if (++k < cols.length) return moveTo(p, cols[k]);
      const ch = plan.choose(looks, ctx);
      if (ch.more && ch.more.length) { cols = ch.more.slice(); k = 0; return moveTo(p, cols[0]); }
      chosen = ch.go; tries = 0; mode = 'aim';
      if (l.at !== chosen) return moveTo(p, chosen);
    }
    if (mode === 'aim') {
      if (handColOf(p) !== chosen && tries++ < 3) return moveTo(p, chosen);
      // (a careful bot's last look, as it lets go)
      if (plan.recheck && !replanned) {
        const now = look(p);
        now.c = chosen; now.half = halfHeld(p, now);
        if (!plan.recheck(now, looks.find(l => l.c === chosen) || null, ctx)) { replanned = true; R.replans++; return begin(p); }
      }
      mode = 'idle'; R.drops++;
      return { release: true, at: [colX(p, chosen), Y] };
    }
    return wait(1 / 60);
  }
  return { name, act, report: () => R };
}
// the look of a list with the least f(look)
function leastBy(list, f) { let b = null, bv = Infinity; for (const l of list) { const v = f(l); if (v < bv) { bv = v; b = l; } } return b; }

module.exports = { bbox, centre, polyDist, fitAffine, towerMove, carFrame, ghostSays, rng, handCols, colX, handColOf, look, stillWatch, fuseWatch, topperInHand, shapeOf, halfHeld, lookingBot, leastBy };
