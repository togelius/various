'use strict';
// The plausibility gallery (DESIGN §18.8 G4's plausibility review, here in the sandbox style for G2.3): pictures of
// builds and of tiles falling off, every tile numbered, for three fresh reviewers who have seen no spec. They flag any
// picture that does not look like what real magnet tiles would do. A reviewer counts only if they flag at least 3 of
// the 4 planted defects and at most 1 of the 4 golden good pictures; a round passes when no unplanted picture is
// flagged by 2 or more reviewers.
//
// One round's gallery (52 pictures, shuffled, labelled G01…):
// - 16 extremes: 14 from the exhaustive walk of reachable builds (rules.js, fitting drops only, mirror images merged,
//   to --depth, default 10 as in the rules tier: 164,051 builds), the best builds by each measure, a second pick only
//   if it shares at most 60% of its tiles with every earlier pick: longest chain of hung ▼ (2), farthest reach past the
//   car (highest point past it; most tiles past it), most ▼ held by one side (2), tallest for width (all builds;
//   builds with 3+ triangles), most near-miss steps on the top outline (2), smallest support among fits (most tiles
//   resting on a ▼ held by one side over air; on a ▲ half over air), squares across two ▼ tops over a ▲'s point (most
//   of them; highest); and 2 from the enumeration's own extremes.json (most neighbours touched by one fit, fewest
//   fitting places);
// - 8 minimal pairs from the enumeration's minimal-pairs.json, each one picture with the two cases shown apart: on the
//   left or right the tile stayed, on the other it touched (dashed outline) and fell off onto the rug;
// - 8 filmstrips of a tile falling off (5 frames: held, touching, tipping or sliding, falling, on the rug);
// - 8 random builds and 4 bot-like end states, from a seeded box of 42 squares and 18 triangles;
// - 4 planted defects drawn directly (bypassing the rules), from a pool of 14: revision 4's triangle on a point and its
//   half-off square every round, and 2 more drawn by the seed;
// - 4 golden good pictures (§18.9 cases 12, 2, 4 and 8, built).
// The key (which pictures are plants, which golden, and what every picture is) goes to --key, never to reviewers.
//   node tools/review/gallery.cjs [--seed=1] [--depth=10] [--out=dir] [--key=file] [--enum=dir (enumerate.cjs output)]
//   node tools/review/gallery.cjs --pool=file.png   (the whole pool of planted defects, labelled, for checking)
// A new round: a new --seed draws new plants, random builds, bot runs and a new order.
const fs = require('fs');
const path = require('path');
const lib = require('./lib.cjs');
const { CASES } = require('../rules/golden.cjs');

const SCRATCH = '/tmp/claude-0/-home-user-various/eea7fc80-8598-5a7a-a3e6-cdbd34e6e76d/scratchpad/rev5';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const SEED = +(args.seed || 1), DEPTH = +(args.depth || 10);
const OUT = args.out || path.join(SCRATCH, 'gallery'), KEY = args.key || path.join(SCRATCH, 'gallery-key', 'key.json');
const ENUM = args.enum || path.join(SCRATCH, 'enum');
const R = lib.rules(), yv = lib.yv, H = lib.H, HALF = 2;
const rnd = lib.rng(SEED * 2654435761 + 17);
const typeOf = lib.typeOf;
const fmtLog = log => log.map(e => lib.fmtHand(e.piece, e.col, e.way));
const eqY = (a, b) => a[0] === b[0] && a[1] === b[1];
function built(log) { const B = lib.tryReplay(log); if (!B) throw new Error('does not replay: ' + fmtLog(log).join(' ')); return { B, T: R.tiles(B) }; }

// ---------------------------------------------------------------------------------------------------------------
// Measures of a build (exact where it matters)
function analyse(T) {
  const n = T.length, ty = T.map(typeOf);
  const flatTop = i => ty[i] === 'sq' ? [T[i].y[0] + 2, T[i].y[1]] : ty[i] === 'dn' ? [T[i].y[0], T[i].y[1] + 1] : null;
  const sup = T.map(() => []), sides = T.map(() => 0);
  for (let i = 0; i < n; i++) {
    const t = T[i];
    if (ty[i] === 'dn') {
      for (let j = 0; j < n; j++) if (ty[j] === 'up' && eqY(T[j].y, t.y) && (T[j].col === t.col - 1 || T[j].col === t.col + 1)) { sup[i].push(j); sides[i]++; }
      for (let j = 0; j < n; j++) { const f = flatTop(j); if (j !== i && f && eqY(f, t.y) && Math.abs(T[j].col - t.col) <= 1) sup[i].push(j); }
    } else {
      for (let j = 0; j < n; j++) { const f = flatTop(j); if (j !== i && f && eqY(f, t.y) && Math.abs(T[j].col - t.col) <= 1) sup[i].push(j); }
    }
  }
  const above = T.map(() => []);
  sup.forEach((s, i) => s.forEach(j => above[j].push(i)));
  const load = j => { const seen = new Set(), st = [j]; while (st.length) for (const k of above[st.pop()]) if (!seen.has(k)) { seen.add(k); st.push(k); } return seen.size; };
  // the longest chain of ▼ hung on ▲ that sit on ▼ tops
  const memoD = new Map(), memoU = new Map();
  const chainD = i => { if (memoD.has(i)) return memoD.get(i); let m = 0; for (const j of sup[i]) if (ty[j] === 'up') m = Math.max(m, chainU(j)); memoD.set(i, 1 + m); return 1 + m; };
  const chainU = j => { if (memoU.has(j)) return memoU.get(j); let m = 0; for (const k of sup[j]) if (ty[k] === 'dn') m = Math.max(m, chainD(k)); memoU.set(j, m); return m; };
  const polys = T.map(lib.polyOf);
  let chain = 0, oneSided = 0, loadDn = 0, loadUp = 0, sqApex = 0, sqApexY = -1, pastN = 0, pastTop = -1, tris = 0;
  for (let i = 0; i < n; i++) {
    if (ty[i] !== 'sq') tris++;
    const past = T[i].col <= -5 || T[i].col >= 3;
    if (past) { pastN++; pastTop = Math.max(pastTop, ...polys[i].map(v => v.y)); }
    if (ty[i] === 'dn') {
      chain = Math.max(chain, chainD(i));
      if (sides[i] === 1) { oneSided++; if (!(T[i].strips[0] && T[i].strips[1])) loadDn = Math.max(loadDn, 1 + load(i)); }
    }
    if (ty[i] === 'up' && !(T[i].strips[0] && T[i].strips[1])) loadUp = Math.max(loadUp, 1 + load(i));
    if (ty[i] === 'sq') {
      // its two halves on the tops of two different ▼, meeting over the point of a ▲ just below
      const tops = [0, 1].map(j => lib.stripTop(T.filter((_, k) => k !== i), HALF, T[i].col + j));
      const others = T.filter((_, k) => k !== i);
      if (tops[0].kind === 'dn' && tops[1].kind === 'dn' && tops[0].idx !== tops[1].idx && tops.every(s => eqY(s.e[0], T[i].y) && eqY(s.e[1], T[i].y)) &&
          others.some(u => typeOf(u) === 'up' && u.col === T[i].col && eqY([u.y[0], u.y[1] + 1], T[i].y))) {
        sqApex++; sqApexY = Math.max(sqApexY, yv(T[i].y));
      }
    }
  }
  // tallest for width: height / the narrowest horizontal extent below the top 0.9 tiles
  let Ht = 0;
  for (const p of polys) for (const v of p) Ht = Math.max(Ht, v.y);
  let w = Infinity;
  for (let y = 0.05; y <= Math.max(0.05, Ht - 0.9) + 1e-9; y += 0.1) {
    let lo = Infinity, hi = -Infinity;
    for (const p of polys) {
      const ys = p.map(v => v.y);
      if (y <= Math.min(...ys) || y >= Math.max(...ys)) continue;
      // the polygon's cross-section at y
      const xs = [];
      for (let k = 0; k < p.length; k++) {
        const a = p[k], b = p[(k + 1) % p.length];
        if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) xs.push(a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y));
      }
      if (xs.length) { lo = Math.min(lo, ...xs); hi = Math.max(hi, ...xs); }
    }
    if (hi > lo) w = Math.min(w, hi - lo);
  }
  const lambda = n && isFinite(w) ? Ht / w : 0;
  // near-miss steps on the top outline: neighbouring half-tile strips with flat tops 0.134 or 0.268 apart
  let near = 0;
  const strip = s => { const t = lib.stripTop(T, HALF, s); return t.e && eqY(t.e[0], t.e[1]) ? t.e[0] : null; };
  let prev = strip(-2 * HALF - 1);
  for (let s = -2 * HALF; s <= 2 * HALF; s++) {
    const cur = strip(s);
    if (prev && cur) { const d = Math.abs(yv(prev) - yv(cur)); if (d > 1e-9 && d < 0.27) near++; }
    prev = cur;
  }
  return { n, tris, chain, oneSided, loadDn, loadUp, sqApex, sqApexY, pastN, pastTop, lambda, height: Ht, near };
}

// the exhaustive walk, keeping the best few builds per measure (mirror images merged)
const MEASURES = [
  { id: 'dn-chain', name: 'longest chain of ▼ hung on ▲ on ▼ tops', v: a => a.chain },
  { id: 'reach-high', name: 'highest point of a tile past the car', v: a => a.pastN ? a.pastTop : -1 },
  { id: 'reach-count', name: 'most tiles past the car', v: a => a.pastN },
  { id: 'one-sided', name: 'most ▼ held by one side', v: a => a.oneSided },
  { id: 'tall-thin', name: 'tallest for its narrowest width', v: a => a.lambda },
  { id: 'tall-thin-tri', name: 'tallest for its narrowest width, with 3+ triangles', v: a => a.tris >= 3 ? a.lambda : -1 },
  { id: 'near-steps', name: 'most near-miss steps (0.134 or 0.268) on the top outline', v: a => a.near },
  { id: 'support-dn', name: 'smallest support: most tiles resting on a ▼ held by one side, half over air', v: a => a.loadDn },
  { id: 'support-up', name: 'smallest support: most tiles resting on a ▲ half over air', v: a => a.loadUp },
  { id: 'sq-apex', name: 'most squares across two ▼ tops over a ▲ point', v: a => a.sqApex },
  { id: 'sq-apex-high', name: 'highest square across two ▼ tops over a ▲ point', v: a => a.sqApex ? a.sqApexY : -1 }
];
const PER = { 'dn-chain': 2, 'reach-high': 1, 'reach-count': 1, 'one-sided': 2, 'tall-thin': 1, 'tall-thin-tri': 1, 'near-steps': 2, 'support-dn': 1, 'support-up': 1, 'sq-apex': 1, 'sq-apex-high': 1 };
function extremesWalk(maxDepth) {
  const t0 = Date.now();
  let frontier = [{ B: R.newBuild({ half: HALF }), log: [] }];
  const seen = new Set([lib.keysOf([]).ck]);
  const top = Object.fromEntries(MEASURES.map(m => [m.id, []]));
  const K = 40;
  let count = 1;
  for (let d = 1; d <= maxDepth; d++) {
    const next = [];
    for (const nd of frontier) {
      for (const [piece, way] of [['sq', undefined], ['tri', 'up'], ['tri', 'down']]) for (const col of R.cols(nd.B, piece)) {
        const r = R.drop(nd.B, piece, col, way);
        if (r.outcome !== 'fit') continue;
        const B = R.place(nd.B, r), T = R.tiles(B), ck = lib.keysOf(T).ck;
        if (seen.has(ck)) continue;
        seen.add(ck); count++;
        const log = nd.log.concat([{ piece, col, way: way || null }]);
        if (d < maxDepth) next.push({ B, log });
        const a = analyse(T);
        for (const m of MEASURES) {
          const v = m.v(a);
          if (v <= 0) continue;
          const L = top[m.id];
          // better: higher value, then fewer tiles, then lower
          const better = (x, y) => x.v > y.v + 1e-9 || (Math.abs(x.v - y.v) < 1e-9 && (x.a.n < y.a.n || (x.a.n === y.a.n && x.a.height < y.a.height - 1e-9)));
          const e = { v, a, log, ck };
          if (L.length < K || better(e, L[L.length - 1])) { L.push(e); L.sort((x, y) => better(x, y) ? -1 : better(y, x) ? 1 : 0); if (L.length > K) L.pop(); }
        }
      }
    }
    frontier = next;
    console.log(`  depth ${d}: ${count} builds (${Date.now() - t0} ms)`);
  }
  return { top, count };
}

// ---------------------------------------------------------------------------------------------------------------
// Falling off: how a tile that does not fit leaves (tipping about the edge of what holds it, or a ▼ sliding off a slant)
const CAR = [{ x: -HALF, y: -0.36 }, { x: HALF, y: -0.36 }, { x: HALF, y: 0 }, { x: -HALF, y: 0 }];
function overlap(P, Q) {
  const eps = 2e-3;
  for (const poly of [P, Q]) for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], nx = -(b.y - a.y), ny = b.x - a.x;
    let p0 = Infinity, p1 = -Infinity, q0 = Infinity, q1 = -Infinity;
    for (const v of P) { const d = v.x * nx + v.y * ny; p0 = Math.min(p0, d); p1 = Math.max(p1, d); }
    for (const v of Q) { const d = v.x * nx + v.y * ny; q0 = Math.min(q0, d); q1 = Math.max(q1, d); }
    const len = Math.hypot(nx, ny);
    if (p1 <= q0 + eps * len || q1 <= p0 + eps * len) return false;
  }
  return true;
}
const clear = (poly, obst) => !obst.some(o => overlap(poly, o)) && Math.min(...poly.map(v => v.y)) >= lib.FLOOR - 1e-6;
function fallOf(B, T, piece, col, res) {
  const type = res.way === null ? 'sq' : res.way === 'up' ? 'up' : 'dn';
  const y0 = yv(res.pose.y), x0 = col / 2, xc = x0 + 0.5;
  const rest = lib.shape(type, col, y0);
  const obst = T.map(lib.polyOf).concat([CAR]);
  const d = lib.describe(B, piece, col, res);
  const outward = xc > 1e-9 ? 1 : xc < -1e-9 ? -1 : 1;
  let dir, pivot, mode;
  if (type === 'dn') {
    mode = 'slide';
    dir = d.sideL && !d.sideR ? 1 : d.sideR && !d.sideL ? -1 : outward;
    pivot = { x: xc, y: y0 };
  } else {
    mode = 'tip';
    const xs = [];
    d.strips.forEach((s, j) => {
      const a = x0 + j / 2, b = a + 0.5;
      if (s.at0) xs.push(a, b);
      else if (s.e) { if (eqY(s.e[0], res.pose.y)) xs.push(a); if (eqY(s.e[1], res.pose.y)) xs.push(b); }
    });
    if (!xs.length) xs.push(xc);
    const smin = Math.min(...xs), smax = Math.max(...xs);
    if (res.reason === 'TOO FAR OUT') dir = !res.strips[1] && res.strips[0] ? 1 : !res.strips[0] && res.strips[1] ? -1 : outward;
    else if (smax <= xc + 1e-9 && smin < xc - 1e-9) dir = 1;
    else if (smin >= xc - 1e-9 && smax > xc + 1e-9) dir = -1;
    else dir = outward;
    pivot = { x: dir > 0 ? smax : smin, y: y0 };
  }
  // frame 3: tipped as far as it goes (up to 30°), or slid down the slant
  let f3 = rest;
  if (mode === 'tip') {
    for (let deg = 1; deg <= 30; deg++) { const p = lib.rotate(rest, pivot, -dir * deg * Math.PI / 180); if (!clear(p, obst)) break; f3 = p; }
    if (f3 === rest) { const p = lib.shift(rest, dir * 0.2, 0); if (clear(p, obst)) f3 = p; }
  } else {
    for (let s = 0.05; s <= 0.45; s += 0.05) { const p = lib.shift(rest, dir * 0.5 * s, -H * 2 * s * 0.5); if (!clear(p, obst)) break; f3 = p; }
  }
  // frame 4: falling, turned well over and clear of everything
  let f4 = mode === 'tip' ? lib.rotate(rest, pivot, -dir * 70 * Math.PI / 180) : lib.rotate(rest, lib.centroid(rest), -dir * 45 * Math.PI / 180);
  f4 = lib.shift(f4, dir * 0.35, -0.55);
  const lift = p => { const m = Math.min(...p.map(v => v.y)); return m < lib.FLOOR + 0.3 ? lib.shift(p, 0, lib.FLOOR + 0.3 - m) : p; };
  f4 = lift(f4);
  let pushed = 0;
  while (!clear(f4, obst) && pushed < 5) { f4 = lib.shift(f4, dir * 0.1, 0); pushed += 0.1; }
  // frame 5: lying on the rug beside the car
  let ex = dir > 0 ? HALF + 0.3 : -HALF - 1.3;
  const rug = () => type === 'sq' ? lib.shape('sq', ex * 2, lib.FLOOR) : lib.shape('up', ex * 2, lib.FLOOR);
  let f5 = rug();
  while (!clear(f5, obst) && Math.abs(ex) < 6) { ex += dir * 0.1; f5 = rug(); }
  return { type, dir, pivot, mode, rest, f3, f4, f5, pushed, outward: dir === outward, y0 };
}

// ---------------------------------------------------------------------------------------------------------------
// Drawing
const UNIT = 300, VX = [-3.3, 3.3];
const tilesOf = T => T.map((t, i) => ({ poly: lib.polyOf(t), color: lib.colorOf(i), num: i + 1 }));
function viewFor(polyLists, extraTop) {
  let x0 = VX[0], x1 = VX[1], top = 0.6;
  for (const ps of polyLists) for (const p of ps) for (const v of p) { x0 = Math.min(x0, v.x - 0.2); x1 = Math.max(x1, v.x + 0.2); top = Math.max(top, v.y); }
  return { x0, x1, y0: -0.8, y1: top + (extraTop || 0.45) };
}
function fitL(view, maxW, maxH, Lmax) { return Math.min(Lmax, maxW / (view.x1 - view.x0), maxH / (view.y1 - view.y0)); }
// a build alone
function buildPicture(tiles, extra) {
  const view = viewFor([tiles.map(t => t.poly)]);
  const L = fitL(view, UNIT, 340, 45);
  return lib.svgRow([lib.scene(Object.assign({ L, view, tiles }, extra || {}))]);
}
// a pair shown apart: two scenes, each either the tile in place or the tile's touch (dashed) and the tile on the rug
function pairScene(side, view, L) {
  const tiles = tilesOf(side.T);
  const num = side.T.length + 1, color = lib.colorOf(side.T.length);
  const arcs = [];
  if (side.res.outcome === 'fit') tiles.push({ poly: side.fall ? null : lib.shape(side.type, side.col, yv(side.res.pose.y)), color, num });
  else {
    tiles.push({ poly: side.fall.rest, style: 'ghost' });
    tiles.push({ poly: side.fall.f5, color, num });
    const a = lib.centroid(side.fall.rest), b = lib.centroid(side.fall.f5);
    arcs.push({ a, b: { x: b.x, y: b.y + 0.55 }, bend: { x: 0, y: 0.9 } });
  }
  return lib.scene({ L, view, tiles, arcs });
}
function filmstrip(T, piece, col, res, fall) {
  const base = tilesOf(T), num = T.length + 1, color = lib.colorOf(T.length);
  const held = lib.shape(fall.type, col, fall.y0 + 1.0);
  const frames = [held, fall.rest, fall.f3, fall.f4, fall.f5];
  let x0 = -HALF - 0.25, x1 = HALF + 0.25, top = 0.6;
  for (const p of base.map(t => t.poly).concat(frames)) for (const v of p) { x0 = Math.min(x0, v.x - 0.2); x1 = Math.max(x1, v.x + 0.2); top = Math.max(top, v.y); }
  const view = { x0, x1, y0: -0.8, y1: top + 0.75 };
  const L = fitL(view, 180, 260, 36);
  const polys = T.map(lib.polyOf);
  return lib.svgRow(frames.map((f, i) => {
    const tiles = base.concat([{ poly: f, color, num }]);
    const sc = { L, view, tiles };
    if (i === 0) {
      const lx = col / 2, rx = lx + 1, yb = fall.type === 'dn' ? fall.y0 + 1.0 + H : fall.y0 + 1.0;
      sc.lines = [[lx, 1e-6], [rx, -1e-6]].map(([x, e]) => { const o = lib.outlineAt(polys, HALF, x + e); return { a: { x, y: yb - 0.04 }, b: { x, y: o === null ? lib.FLOOR : o }, dotted: true }; });
      sc.grip = { x: lx + 0.5, y: Math.max(...f.map(v => v.y)) };
    }
    return lib.scene(sc);
  }), { gap: 12, arrows: true });
}

// ---------------------------------------------------------------------------------------------------------------
// The box and the bots (§18.5's box, simplified: no fuse, no sway, no weight)
function makeBox(r) {
  for (;;) {
    const box = r.shuffle(Array(41).fill('sq').concat(Array(17).fill('tri'), ['sq']));
    let ok = true, run = 0;
    for (const p of box) { run = p === 'tri' ? run + 1 : 0; if (run > 2) { ok = false; break; } }
    if (ok) return box.concat(['tri']);
  }
}
const center = r => r.pose.col / 2 + 0.5;
const POLICIES = {
  random: (B, opts, r) => r.pick(opts),
  stack: (B, opts) => opts.slice().sort((a, b) => yv(a.pose.y) - yv(b.pose.y) || Math.abs(center(a)) - Math.abs(center(b)))[0],
  spire: (B, opts) => opts.slice().sort((a, b) => yv(b.pose.y) - yv(a.pose.y) || Math.abs(center(a)) - Math.abs(center(b)))[0],
  spire2: (B, opts) => { const mid = opts.filter(o => Math.abs(center(o)) <= 1); return (mid.length ? mid : opts).slice().sort((a, b) => yv(b.pose.y) - yv(a.pose.y))[0]; },
  careful: (B, opts) => {
    const T = R.tiles(B);
    const comx = T.reduce((s, t) => s + lib.centroid(lib.polyOf(t)).x, 0);
    return opts.slice().sort((a, b) => score(a) - score(b))[0];
    function score(o) { const c = (comx + center(o)) / (T.length + 1); return yv(o.pose.y) * 1.0 + Math.abs(c) * 3 + Math.abs(center(o)) * 0.4 - o.shine.length * 0.6 + (o.strips[0] && o.strips[1] ? 0 : 0.8); }
  }
};
function runBot(policy, r, maxTiles) {
  let B = R.newBuild({ half: HALF });
  const box = makeBox(r), log = [];
  while (box.length && log.length < maxTiles) {
    let piece = box.shift();
    let opts = R.fitsAll(B, piece).filter(x => x.outcome === 'fit');
    if (!opts.length) {
      // no dead tiles: put it back and take the next tile of the other shape
      const other = piece === 'sq' ? 'tri' : 'sq', i = box.indexOf(other);
      if (i >= 0) { box.splice(i, 1); box.push(piece); piece = other; opts = R.fitsAll(B, piece).filter(x => x.outcome === 'fit'); }
    }
    if (!opts.length) break;
    const res = POLICIES[policy](B, opts, r);
    B = R.place(B, res);
    log.push({ piece, col: res.pose.col, way: res.way });
  }
  return log;
}

// ---------------------------------------------------------------------------------------------------------------
// Planted defects: drawn directly, bypassing the rules. Each: a small ordinary build (from the rules) plus the defect.
const sqAt = (x, y) => lib.shape('sq', x * 2, y);
const upAt = (x, y) => lib.shape('up', x * 2, y);
const dnAt = (x, y) => lib.shape('dn', x * 2, y); // x: its top edge's left end, y: its point's height
const PLANTS = [
  { id: 'P01', rev4: true, name: "revision 4's triangle balanced on a triangle's point", base: ['■-1', '■0', '▲-0.5', '■1'], add: () => [upAt(-0.5, 1 + H)] },
  { id: 'P02', rev4: true, name: "revision 4's square half a tile off the top of a column", base: ['■-2', '■0', '■0', '▲-2'], add: () => [sqAt(0.5, 2)] },
  { id: 'P03', name: 'a square floating above the build, touching nothing', base: ['■-2', '■-1', '▲-1.5', '■1'], add: () => [sqAt(1, 1.42)] },
  { id: 'P04', name: 'two squares overlapping by 0.4 tile', base: ['■-2', '■-1', '▲-2'], add: () => [sqAt(-0.4, 0)] },
  { id: 'P05', name: 'a square at a half step, half over the gap between two columns', base: ['■-2', '■0', '▲0', '■1'], add: () => [sqAt(-1.5, 1)] },
  { id: 'P06', name: '▼ standing on its point alone on a flat top', base: ['■-1', '■0', '▲-2'], add: () => [dnAt(-0.5, 1)] },
  { id: 'P07', name: '▲ with only a quarter of its base on the square under it', base: ['■1', '■-1', '▲-1'], add: () => [upAt(1.75, 1)] },
  { id: 'P08', name: 'a square hanging in mid-air beside a column, touching it only at a corner', base: ['■-1', '■-1', '■-1', '▲0'], add: () => [sqAt(0, 3)] },
  { id: 'P09', name: 'a chain of hung triangles carrying a square out over the rug', base: ['■-1', '▲1', '▼1.5', '▲1.5'], add: () => [dnAt(2, H), sqAt(2, 2 * H)] },
  { id: 'P10', name: 'a square sunk 0.3 tile into the square under it', base: ['■-2', '■-1', '▲0'], add: () => [sqAt(-1, 0.7)] },
  { id: 'P11', name: '▼ balanced point to point on a ▲', base: ['▲0', '■-2', '■-1'], add: () => [dnAt(0, H)] },
  { id: 'P12', name: 'two triangles overlapping, one off the lattice', base: ['▲-1', '■1'], add: () => [upAt(-0.6, 0)] },
  { id: 'P13', name: 'a square on top of a ▼ that stands on its point', base: ['■-2', '■1', '▲1'], add: () => [dnAt(-0.5, 0), sqAt(-0.5, H)] },
  { id: 'P14', name: 'a triangle floating in the air past the end of the car', base: ['■0', '■1', '▲-1'], add: () => [upAt(2.25, 0.1)] }
];

// What the pictures show, for the reviewers (nothing about the rules): written next to the sheets as legend.txt
const LEGEND = [
  'How to read the gallery pictures. Each picture has a label (G01, G02, ...) at its top left.',
  '- The grey plate with two wheels is a toy car seen from the side; the line below it is the rug. Tiles are magnetic',
  '  building tiles (squares and triangles with equal sides) standing in one flat wall on the car. Each tile is numbered',
  '  in the order it was put on.',
  '- A single scene shows a build as it stands.',
  '- A wide picture split by a grey line shows two separate cases side by side. In each, the highest-numbered tile was',
  '  the last one dropped: either it is where it stayed, or a dashed grey outline marks where it touched the build',
  '  and a dotted arrow leads to where it ended up, on the rug.',
  '- A row of five small frames (with grey arrows between them) is a filmstrip, left to right: a tile held above the',
  '  build (the small grey box is the hand, the dotted lines show where it falls), the tile touching the build, then',
  '  what happens to it next.',
  'Flag any picture where something does not look like what real magnetic tiles would do, and say which tile numbers.'
].join('\n');

// ---------------------------------------------------------------------------------------------------------------
function plantPicture(P) {
  const { T } = built(P.base.map(lib.parse));
  const tiles = tilesOf(T);
  for (const poly of P.add()) tiles.push({ poly, color: lib.colorOf(tiles.length), num: tiles.length + 1 });
  return buildPicture(tiles);
}
// --pool=file.png: the whole pool of planted defects on one sheet, labelled, for checking the drawings
async function poolSheet(file) {
  const html = PLANTS.map(P => `<div class="pic"><span class="id">${P.id} ${lib.esc(P.name)}</span>${plantPicture(P).svg}</div>`).join('');
  const png = await lib.shoot(`<div style="display:grid;grid-template-columns:repeat(4,auto);gap:12px">${html}</div>`, `.pic{position:relative;border:1px solid #dfe2e8;border-radius:8px;padding:30px 4px 4px;line-height:0;width:310px}.id{position:absolute;left:6px;top:4px;font-size:11px;line-height:12px;color:#5a6075}`, 1.2);
  fs.writeFileSync(file, png);
  await lib.close();
  console.log('wrote ' + file);
}

async function main() {
  if (args.pool) return poolSheet(args.pool);
  const t0 = Date.now();
  const pics = [];
  // 1. extremes
  console.log(`walking every reachable build to depth ${DEPTH} …`);
  const W = extremesWalk(DEPTH);
  const usedCk = new Set(), picked = [];
  // how alike two builds are: the share of tiles they have in common, either way round (mirror images)
  const tileSet = log => { const T = built(log).T; return { a: new Set(lib.keysOf(T).key.split(' ')), b: new Set(lib.keysOf(T.map(t => Object.assign({}, t, { col: -t.col - 2 }))).key.split(' ')) }; };
  const alike = (x, y) => Math.max(...[x.a, x.b].map(s => [...s].filter(k => y.a.has(k)).length)) / Math.max(x.a.size, y.a.size);
  for (const m of MEASURES) {
    let k = 0;
    for (const e of W.top[m.id]) {
      if (k >= PER[m.id]) break;
      if (usedCk.has(e.ck)) continue;
      const ts = tileSet(e.log);
      if (picked.some(p => alike(ts, p) > 0.6)) continue;
      usedCk.add(e.ck); picked.push(ts); k++;
      const { T } = built(e.log);
      pics.push({ kind: 'extreme', what: m.name + ' (' + (Number.isInteger(e.v) ? e.v : e.v.toFixed(3)) + ')', measure: m.id, value: e.v, build: fmtLog(e.log), svg: buildPicture(tilesOf(T)) });
    }
    if (k < PER[m.id]) console.log(`!! ${m.id}: only ${k} builds`);
  }
  const EX = JSON.parse(fs.readFileSync(path.join(ENUM, 'extremes.json'), 'utf8')).extremes;
  for (const name of ['most neighbours touched by one fit', 'fewest fitting places (■ + ▲ + ▼ columns)']) {
    const e = EX[name];
    let log = e.log.map(lib.parse);
    if (e.drop) { const B = lib.tryReplay(log), r = R.drop(B, e.drop.piece, e.drop.col, e.drop.way); log = log.concat([{ piece: e.drop.piece, col: e.drop.col, way: r.way }]); }
    const { T } = built(log);
    pics.push({ kind: 'extreme', what: name + ' (' + e.value + ', from enumerate.cjs)', measure: 'enum:' + name, value: e.value, build: fmtLog(log), svg: buildPicture(tilesOf(T)) });
  }
  // 2. minimal pairs, from the enumeration's minimal-pairs.json, checked here with the hand's own way up
  const MP = JSON.parse(fs.readFileSync(path.join(ENUM, 'minimal-pairs.json'), 'utf8'));
  const WANT = [['oneTileAdded', 'sq: FIT -> NOT LEVEL'], ['oneTileAdded', 'auto: FIT -> ONLY A POINT'], ['oneTileAdded', 'auto: OVER THE EDGE -> FIT'],
    ['oneTileAdded', 'auto: NOT LEVEL -> FIT'], ['neighbouringCols', 'sq: TOO FAR OUT | FIT'], ['neighbouringCols', 'down: TOO FAR OUT | FIT'],
    ['oneTileAdded', 'sq: ONLY A POINT -> FIT'], ['neighbouringCols', 'up: FIT | NOT LEVEL'], ['oneTileAdded', 'up: NOT LEVEL -> FIT'],
    ['neighbouringCols', 'sq: NOT LEVEL | FIT'], ['oneTileAdded', 'auto: ONLY A POINT -> FIT'], ['neighbouringCols', 'up: FIT | TOO FAR OUT']];
  let nPairs = 0;
  for (const [kind, cls] of WANT) {
    if (nPairs >= 8) break;
    const exs = (MP[kind][cls] || []).slice().sort((a, b) => (a.log.length < 2 ? 10 : a.log.length) - (b.log.length < 2 ? 10 : b.log.length));
    for (const ex of exs) {
      const log = ex.log.map(lib.parse);
      const way = ex.piece === 'sq' ? undefined : undefined; // the hand's own choice (auto-turn)
      let sides;
      if (kind === 'neighbouringCols') sides = ex.cols.map(col => ({ log, col }));
      else sides = [{ log, col: ex.col }, { log: log.concat([lib.parse(ex.add)]), col: ex.col }];
      sides = sides.map(s => {
        const { B, T } = built(s.log), res = R.drop(B, ex.piece, s.col, way);
        return Object.assign(s, { B, T, res, type: res.way === null ? 'sq' : res.way === 'up' ? 'up' : 'dn' });
      });
      if (sides[0].res.outcome === sides[1].res.outcome) continue;
      // the forced way of the class must be the hand's own choice
      if (ex.way && sides.some(s => s.res.way !== ex.way)) continue;
      for (const s of sides) s.fall = s.res.outcome === 'fit' ? null : fallOf(s.B, s.T, ex.piece, s.col, s.res);
      if (rnd() < 0.5) sides.reverse();
      const all = [];
      for (const s of sides) { all.push(...s.T.map(lib.polyOf)); if (s.fall) all.push(s.fall.rest, s.fall.f5); else all.push(lib.shape(s.type, s.col, yv(s.res.pose.y))); }
      const view = viewFor([all], 0.5), L = fitL(view, UNIT, 340, 45);
      const svg = lib.svgRow(sides.map(s => pairScene(s, view, L)), { gap: 18, divider: 2 });
      pics.push({ kind: 'pair', what: 'minimal pair ' + cls + ' (' + kind + ')', units: 2, build: sides.map(s => fmtLog(s.log)), hand: sides.map(s => lib.fmtHand(ex.piece, s.col, s.res.way)),
        outcomes: sides.map(s => s.res.outcome === 'fit' ? 'stays (left in place)' : 'falls off: ' + s.res.reason), svg });
      nPairs++;
      break;
    }
  }
  if (nPairs < 8) console.log('!! only ' + nPairs + ' minimal pairs');
  // 3. filmstrips: tiles falling off outward, one of each kind, from small builds
  const small = lib.walk(6).nodes.filter(n => n.depth >= 2);
  const KINDS = [
    { what: '▲ on a point', ok: (t, r, g) => t === 'up' && r.reason === 'ONLY A POINT' },
    { what: '■ on points', ok: (t, r) => t === 'sq' && r.reason === 'ONLY A POINT' },
    { what: '▲ half past the car', ok: (t, r) => t === 'up' && r.reason === 'OVER THE EDGE' },
    { what: '■ half over a lower top or slant', ok: (t, r, g) => t === 'sq' && r.reason === 'NOT LEVEL' && g > 0.5 },
    { what: '▲ near miss (0.134 or 0.268)', ok: (t, r, g) => t === 'up' && r.reason === 'NOT LEVEL' && g < 0.3 },
    { what: '▼ hung by one side, too far out', ok: (t, r) => t === 'dn' && r.reason === 'TOO FAR OUT' },
    { what: '■ on a ▼ that is half over air (too far out)', ok: (t, r) => t === 'sq' && r.reason === 'TOO FAR OUT' },
    { what: '▲ half over a lower step', ok: (t, r, g) => t === 'up' && r.reason === 'NOT LEVEL' && g > 0.5 }
  ];
  const order = rnd.shuffle(small.slice());
  for (const K of KINDS) {
    let found = null;
    for (const nd of order) {
      for (const piece of ['sq', 'tri']) {
        for (const col of R.cols(nd.B, piece)) {
          const res = R.drop(nd.B, piece, col);
          if (res.outcome === 'fit') continue;
          const t = res.way === null ? 'sq' : res.way === 'up' ? 'up' : 'dn';
          if (!K.ok(t, res, res.gap ? yv(res.gap) : 0)) continue;
          const fall = fallOf(nd.B, nd.T, piece, col, res);
          if (!fall.outward || fall.pushed > 0.8) continue;
          if (Math.max(...nd.T.map(x => Math.max(...lib.polyOf(x).map(v => v.y)))) > 3.2) continue;
          found = { nd, piece, col, res, fall }; break;
        }
        if (found) break;
      }
      if (found) break;
    }
    if (!found) { console.log('!! no filmstrip for ' + K.what); continue; }
    const { nd, piece, col, res, fall } = found;
    pics.push({ kind: 'filmstrip', what: 'falls off: ' + K.what + ' (' + res.reason + (res.gap ? ', gap ' + yv(res.gap).toFixed(3) : '') + ')', units: 3,
      build: fmtLog(nd.log), hand: lib.fmtHand(piece, col, res.way), outcome: res.reason, svg: filmstrip(nd.T, piece, col, res, fall) });
  }
  // 4. random builds and bot end states
  for (let i = 0; i < 8; i++) {
    const log = runBot('random', rnd, 8 + rnd.int(9));
    pics.push({ kind: 'random', what: 'random build of ' + log.length + ' tiles (random fitting drops from a shuffled box)', build: fmtLog(log), svg: buildPicture(tilesOf(built(log).T)) });
  }
  for (const [bot, n] of [['stack', 20], ['careful', 20], ['spire', 12], ['spire2', 14]]) {
    const log = runBot(bot, rnd, n);
    pics.push({ kind: 'bot', what: bot + '-like bot after ' + log.length + ' tiles', build: fmtLog(log), svg: buildPicture(tilesOf(built(log).T)) });
  }
  // 5. planted defects: revision 4's two every round, two more by the seed
  const rest = rnd.shuffle(PLANTS.filter(p => !p.rev4).slice());
  const drawn = PLANTS.filter(p => p.rev4).concat(rest.slice(0, 2));
  for (const P of drawn) pics.push({ kind: 'plant', plant: P.id, what: 'PLANTED DEFECT ' + P.id + ': ' + P.name, build: P.base.concat(['+ defect drawn directly']), svg: plantPicture(P) });
  // 6. golden good pictures
  for (const n of [12, 2, 4, 8]) {
    const c = CASES[n - 1], { B } = built(c.log), r = R.drop(B, c.lastDrop.piece, c.lastDrop.col, c.lastDrop.way || undefined);
    if (r.outcome !== 'fit') throw new Error('golden ' + n + ' does not fit');
    const T = R.tiles(R.place(B, r));
    pics.push({ kind: 'golden', golden: n, what: 'golden case ' + n + ': ' + c.title + ' (every tile fits)', build: fmtLog(c.log.concat([{ piece: c.lastDrop.piece, col: c.lastDrop.col, way: r.way }])), svg: buildPicture(tilesOf(T)) });
  }
  for (const p of pics) p.units = p.units || 1;
  console.log(`${pics.length} pictures: ` + ['extreme', 'pair', 'filmstrip', 'random', 'bot', 'plant', 'golden'].map(k => k + ' ' + pics.filter(p => p.kind === k).length).join(', '));

  // shuffle and pack into rows of 3 units, 3 rows a sheet; plants on different sheets, golden pictures too
  let sheets;
  for (let attempt = 0; attempt < 500; attempt++) {
    const list = rnd.shuffle(pics.slice()), rows = [];
    while (list.length) {
      const row = [];
      let left = 3;
      for (let i = 0; i < list.length && left > 0;) { if (list[i].units <= left) { left -= list[i].units; row.push(list.splice(i, 1)[0]); } else i++; }
      rows.push(row);
    }
    sheets = [];
    for (let i = 0; i < rows.length; i += 3) sheets.push(rows.slice(i, i + 3));
    const per = k => sheets.map(s => s.flat().filter(p => p.kind === k).length);
    if (Math.max(...per('plant')) <= 1 && Math.max(...per('golden')) <= 1) break;
  }
  let id = 0;
  for (const [si, s] of sheets.entries()) for (const row of s) for (const p of row) { p.id = 'G' + String(++id).padStart(2, '0'); p.sheet = si + 1; }
  // render
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (/^sheet-\d+\.png$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  const CSS = `.row{display:flex;gap:14px;margin-bottom:14px;align-items:stretch}.pic{position:relative;border:1px solid #dfe2e8;border-radius:8px;padding:22px 4px 4px;line-height:0;display:flex;justify-content:center;align-items:flex-end}
.u1{width:310px}.u2{width:634px}.u3{width:958px}.id{position:absolute;left:8px;top:5px;font-size:13px;line-height:14px;font-weight:700;color:#5a6075}`;
  const files = [];
  for (const [si, s] of sheets.entries()) {
    const html = s.map(row => `<div class="row">${row.map(p => `<div class="pic u${p.units}"><span class="id">${p.id}</span>${p.svg.svg}</div>`).join('')}</div>`).join('');
    const png = await lib.shoot(html, CSS, 1.5);
    const f = path.join(OUT, 'sheet-' + String(si + 1).padStart(2, '0') + '.png');
    fs.writeFileSync(f, png); files.push(f);
  }
  await lib.close();
  // the key
  const all = sheets.flat(2);
  const key = {
    what: 'Key for the CLACK STACK revision 5 plausibility gallery (DESIGN §18.8). Never show this to reviewers.',
    seed: SEED, depth: DEPTH, buildsWalked: W.count, made: new Date().toISOString(), galleryDir: OUT, sheets: files.map(f => path.basename(f)),
    plants: all.filter(p => p.kind === 'plant').map(p => p.id), golden: all.filter(p => p.kind === 'golden').map(p => p.id),
    scoring: 'A reviewer counts only if they flag at least 3 of the 4 plants and at most 1 golden picture. The round passes when no other picture is flagged by 2 or more counted reviewers.',
    plantPool: PLANTS.map(p => ({ id: p.id, name: p.name, alwaysDrawn: !!p.rev4, drawnThisRound: drawn.includes(p) })),
    pictures: all.map(p => {
      const o = { id: p.id, sheet: p.sheet, kind: p.kind, plant: p.kind === 'plant', golden: p.golden || null, what: p.what };
      for (const k of ['plant', 'measure', 'value', 'build', 'hand', 'outcome', 'outcomes']) if (p[k] !== undefined && !(k === 'plant')) o[k] = p[k];
      if (p.kind === 'plant') o.plantId = p.plant;
      return o;
    })
  };
  key.reviewerLegend = LEGEND;
  fs.writeFileSync(path.join(OUT, 'legend.txt'), LEGEND + '\n');
  fs.mkdirSync(path.dirname(KEY), { recursive: true });
  fs.writeFileSync(KEY, JSON.stringify(key, null, 1));
  console.log(`${all.length} pictures on ${files.length} sheets in ${OUT}; plants ${key.plants.join(' ')}, golden ${key.golden.join(' ')}; key ${KEY} (${Date.now() - t0} ms)`);
}
if (require.main === module) main().catch(async e => { console.error(e); await lib.close(); process.exit(1); });
module.exports = { analyse, fallOf, PLANTS, MEASURES };
