'use strict';
// The plausibility gallery (DESIGN §18.8 G4's plausibility review, here in the sandbox style for G2.3), revision 5d:
// pictures of builds and of tiles falling off, every tile numbered, for three fresh reviewers who have seen no spec.
// They flag any picture that does not look like what real magnet tiles would do. A reviewer counts only if they flag
// at least 3 of the 4 planted defects and at most 1 of the 4 golden good pictures; a round passes when no unplanted
// picture is flagged by 2 or more reviewers.
//
// One round's gallery (about 50 pictures, shuffled, labelled G01…):
// - extremes: from a walk of every reachable build to --depth (default 8; rules.js, fitting drops only, mirror images
//   merged), the best build by each measure (longest chain of hung ▼, farthest reach past the car, most ▼ held by one
//   side, tallest for width, most thin gaps under tiles, most tiles held by half an edge, tallest structure standing
//   on a ▼ held by one side, farthest overhang, squares across two ▼ tops over a ▲'s point), and from the
//   enumeration's own extremes.json (to its depth: most neighbours touched by one fit, fewest fitting places, the
//   tallest structure on a hung ▼, the farthest overhang, and revision 5d's balance extremes: the largest locked piece,
//   the tallest group standing on half an edge, the most tiles in a group exactly over an end of its support). The
//   balance extremes are picked first and always shown; one picture per measure; any other pick is skipped when it is
//   too like an earlier one: more than half its tiles in common, or more than 60% of its tiles in the same columns
//   whatever their heights (a column of squares with a ▲ on it and the same column with a ▲ and a ▼ in it), with builds
//   compared under translation and mirroring (a stair moved half a tile is the same stair), the enumeration's picks
//   against the walk's too. --enum defaults to this revision's tier 1 to depth 8 (rev5d/r3/tier1-d8-final);
// - 8 minimal pairs from the enumeration's minimal-pairs.json, each one picture of two separate builds side by side,
//   labelled A and B (not before and after), numbered alike; in one the dropped tile stays, in the other it falls off
//   (ONLY A POINT or TIPS OVER);
// - 8 filmstrips of a tile falling off (5 frames). ONLY A POINT: held, touching, tipping a little about the point it
//   touched, falling out of the wall toward the viewer, and lying on the rug below the car. TIPS OVER: held, touching
//   with the group that would tip drawn as one piece (tinted, one red outline round it), its pivot dot and plumb line,
//   the group rocked a few degrees toward its pivot, the group back where it was while the new tile falls out of the
//   wall, and the new tile on the rug;
// - 8 random builds (more when near-duplicate extremes were skipped, to keep about 50 pictures) and 4 bot-like end
//   states, from a seeded box of 42 squares and 18 triangles;
// - 4 planted defects drawn directly (bypassing the rules), from a pool of 18: every round revision 4's triangle on a
//   point and one of the two groups leaning past what holds it, which revision 5b allowed and 5c and 5d do not (5b's
//   stair leaning past its foot, or a column of squares on a ▼ hung off a half-held ▲), and 2 more drawn by the seed,
//   one each of two of three kinds (a tile floating or hanging in the air; tiles overlapping or one through another; a
//   tile standing on a point or a corner, or with its middle off its support). Revision 4's half-off square and the
//   other square at a half step stay in the pool but are not drawn: a tile held by half an edge is ordinary, so a
//   reviewer who sees no spec has no reason to flag a square doing it, and a plant must be a plain defect;
// - 4 golden good pictures (§18.9 cases 12, 2, 4 and 8, built).
// How a fall is drawn (lib.fall, §18.2): a tile that falls off never comes to rest in the wall. It tips a little about
// the point it touched (a knife-edge to its free side), then falls out of the wall toward the viewer onto the rug, drawn
// below the car, foreshortened and fading. Placed tiles never move: for TIPS OVER the whole group (revision 5d: the
// piece of tiles locked by whole edges and everything resting on it) rocks a little toward its pivot and back, as a tell.
// Falls whose drawn tip would push the tile or the group into a tile beside it (a real tile would lean on it, as in
// round 3's G47B; or come to rest crooked on a top just below, the near-catch) are not filmed or paired.
// Near misses at a point (a corner or point 0.134 or 0.268 above another tile's point or corner) get a small dotted
// ring, as thin gaps under flat tiles get their dotted outline (round 3's G21B and G32A had no marker).
// The wheels are drawn where the game has them, 0.2 tile in from each end of the car.
// The key (which pictures are plants, which golden, and what every picture is) goes to --key, never to reviewers.
//   node tools/review/gallery.cjs [--seed=1] [--depth=8] [--out=dir] [--key=file] [--enum=dir (enumerate.cjs output)]
//   node tools/review/gallery.cjs --pool=file.png   (the whole pool of planted defects, labelled, for checking)
// A new round: a new --seed draws new plants, random builds, bot runs and a new order. The run's log is written next
// to the key (run.log), so a stale log from another draw can't be mistaken for this one.
// these keep hundreds of thousands of builds and results: run with a larger heap than Node's default
if (require.main === module && !process.execArgv.some(a => a.startsWith('--max-old-space-size'))) {
  const r = require('child_process').spawnSync(process.execPath, ['--max-old-space-size=' + (process.env.REVIEW_HEAP_MB || 4096), __filename].concat(process.argv.slice(2)), { stdio: 'inherit' });
  process.exit(r.status === null ? 1 : r.status);
}
const fs = require('fs');
const path = require('path');
const lib = require('./lib.cjs');
const { CASES } = require('../rules/golden.cjs');
const E = require('../rules/enumerate.cjs');

const SCRATCH = '/tmp/claude-0/-home-user-various/eea7fc80-8598-5a7a-a3e6-cdbd34e6e76d/scratchpad/rev5d';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const SEED = +(args.seed || 1), DEPTH = +(args.depth || 8);
const OUT = args.out || path.join(SCRATCH, 'gallery'), KEY = args.key || path.join(SCRATCH, 'gallery-key', 'key.json');
// the enumeration's reports: this revision's tier 1 to depth 8 (tools/rules/run.cjs), else the default tier 1 output
const ENUM = args.enum || [path.join(SCRATCH, 'r3', 'tier1-d8-final'), path.join(SCRATCH, 'r3', 'tier1-d8'), path.join(SCRATCH, 'tier1')].find(d => fs.existsSync(path.join(d, 'extremes.json')));
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
  const below = E.supports(T); // who rests on whom (holding contacts); -1 is the car
  const above = T.map(() => []);
  below.forEach((s, i) => s.forEach(j => { if (j >= 0) above[j].push(i); }));
  // the longest chain of ▼ hung on ▲ that sit on ▼ tops
  const memoD = new Map(), memoU = new Map();
  const chainD = i => { if (memoD.has(i)) return memoD.get(i); let m = 0; for (const j of below[i]) if (j >= 0 && ty[j] === 'up') m = Math.max(m, chainU(j)); memoD.set(i, 1 + m); return 1 + m; };
  const chainU = j => { if (memoU.has(j)) return memoU.get(j); let m = 0; for (const k of below[j]) if (k >= 0 && ty[k] === 'dn') m = Math.max(m, chainD(k)); memoU.set(j, m); return m; };
  const polys = T.map(lib.polyOf);
  let chain = 0, oneSided = 0, halfHeld = 0, sqApex = 0, sqApexY = -1, pastN = 0, pastTop = -1, tris = 0;
  for (let i = 0; i < n; i++) {
    if (ty[i] !== 'sq') tris++;
    const past = T[i].col <= -5 || T[i].col >= 3;
    if (past) { pastN++; pastTop = Math.max(pastTop, ...polys[i].map(v => v.y)); }
    if (ty[i] === 'dn') {
      chain = Math.max(chain, chainD(i));
      if (below[i].length === 1) oneSided++;
    } else {
      // held by half an edge: what it rests on covers one half of its bottom only
      const halves = new Set();
      for (const j of below[i]) {
        if (j === -1) { for (const s of [T[i].col, T[i].col + 1]) if (s >= -2 * HALF && s < 2 * HALF) halves.add(s); }
        else for (const s of [T[j].col, T[j].col + 1]) if (s === T[i].col || s === T[i].col + 1) halves.add(s);
      }
      if (halves.size === 1) halfHeld++;
    }
    if (ty[i] === 'sq') {
      // its two halves on the tops of two different ▼, meeting over the point of a ▲ just below
      const ds = below[i].filter(j => j >= 0 && ty[j] === 'dn');
      if (ds.length === 2 && T.some(u => typeOf(u) === 'up' && u.col === T[i].col && eqY([u.y[0], u.y[1] + 1], T[i].y))) { sqApex++; sqApexY = Math.max(sqApexY, yv(T[i].y)); }
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
  const thin = n ? lib.buildSlivers(T, HALF).length : 0;
  const sd = n ? E.standing(T, HALF) : { hung: { h: -1, n: 0, air: false, k: -1 }, over: 0 };
  return { n, tris, chain, oneSided, halfHeld, sqApex, sqApexY, pastN, pastTop, lambda, height: Ht, thin,
    hungH: sd.hung.k >= 0 && sd.hung.n ? sd.hung.h : -1, hungAirH: sd.hung.k >= 0 && sd.hung.n && sd.hung.air ? sd.hung.h : -1, over: sd.over };
}

// the exhaustive walk, keeping the best few builds per measure (mirror images merged)
const MEASURES = [
  { id: 'dn-chain', name: 'longest chain of ▼ hung on ▲ on ▼ tops', v: a => a.chain },
  { id: 'reach-high', name: 'highest point of a tile past the car', v: a => a.pastN ? a.pastTop : -1 },
  { id: 'reach-count', name: 'most tiles past the car', v: a => a.pastN },
  { id: 'one-sided', name: 'most ▼ held by one side', v: a => a.oneSided },
  { id: 'tall-thin', name: 'tallest for its narrowest width', v: a => a.lambda },
  { id: 'tall-thin-tri', name: 'tallest for its narrowest width, with 3+ triangles', v: a => a.tris >= 3 ? a.lambda : -1 },
  { id: 'thin-gaps', name: 'most thin gaps (0.134 or 0.268) under tiles', v: a => a.thin },
  { id: 'half-held', name: 'most tiles held by half an edge', v: a => a.halfHeld },
  { id: 'hung-load', name: 'tallest structure standing on a ▼ held by one side', v: a => a.hungH },
  { id: 'hung-air-load', name: 'tallest structure standing on a ▼ hung by one side with its point in the air', v: a => a.hungAirH },
  { id: 'overhang', name: 'farthest overhang (a tile\'s middle past where its supports meet the car)', v: a => a.over },
  { id: 'sq-apex', name: 'most squares across two ▼ tops over a ▲ point', v: a => a.sqApex }
];
// one picture per measure (round 3 drew two for dn-chain, and they were near duplicates)
const PER = Object.fromEntries(MEASURES.map(m => [m.id, 1]));
function extremesWalk(maxDepth) {
  const t0 = Date.now();
  let frontier = [{ B: R.newBuild({ half: HALF }), log: [] }];
  const seen = new Set([lib.keysOf([]).ck]);
  const top = Object.fromEntries(MEASURES.map(m => [m.id, []]));
  const K = 150; // (deep enough that a measure whose best builds are all too like an earlier pick still finds a different one)
  let count = 1;
  const better = (x, y) => x.v > y.v + 1e-9 || (Math.abs(x.v - y.v) < 1e-9 && (x.a.n < y.a.n || (x.a.n === y.a.n && x.a.height < y.a.height - 1e-9)));
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
          const L = top[m.id], e = { v, a, log, ck };
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
// Drawing
const UNIT = 300, VX = [-3.3, 3.3];
// tiles numbered 1…n (or by `nums`), coloured by their number
const tilesOf = (T, nums) => T.map((t, i) => { const n = nums ? nums[i] : i + 1; return { poly: lib.polyOf(t), color: lib.colorOf(n - 1), num: n }; });
function viewFor(polyLists, extraTop) {
  let x0 = VX[0], x1 = VX[1], top = 0.6;
  for (const ps of polyLists) for (const p of ps) for (const v of p) { x0 = Math.min(x0, v.x - 0.2); x1 = Math.max(x1, v.x + 0.2); top = Math.max(top, v.y); }
  return { x0, x1, y0: -0.8, y1: top + (extraTop || 0.45) };
}
function fitL(view, maxW, maxH, Lmax) { return Math.min(Lmax, maxW / (view.x1 - view.x0), maxH / (view.y1 - view.y0)); }
// a build alone (slivers: the thin gaps under its tiles, when it is a rules build)
function buildPicture(tiles, extra) {
  const view = viewFor([tiles.map(t => t.poly)]);
  const L = fitL(view, UNIT, 340, 45);
  return lib.svgRow([lib.scene(Object.assign({ L, view, tiles }, extra || {}))]);
}
// one side of a pair: its build, and the dropped tile where it stayed, or touching (grey dashed), its path (dotted)
// and, faint, where it would next hit something
function pairScene(side, view, L, tag) {
  const tiles = tilesOf(side.T, side.nums), color = lib.colorOf(side.num - 1);
  const sc = { L, view, tiles, tag, slivers: lib.buildSlivers(side.T, HALF), pointGaps: lib.buildPointGaps(side.T, HALF) };
  if (side.res.outcome === 'fit') {
    const T2 = side.T.concat([{ piece: side.res.way === null ? 'sq' : 'tri', way: side.res.way, col: side.col, y: side.res.pose.y }]);
    tiles.push({ poly: lib.shape(side.type, side.col, yv(side.res.pose.y)), color, num: side.num });
    sc.slivers = lib.buildSlivers(T2, HALF);
    sc.pointGaps = lib.buildPointGaps(T2, HALF);
  } else {
    // where it stopped (grey dashed), its path out of the wall (dotted) and where it lies on the rug, out of play; for
    // TIPS OVER the whole group that would tip (revision 5d), the dropped tile where it stopped among it, drawn as one
    // piece: tinted, one red outline round it, with its pivot and plumb line
    const f = side.fall;
    if (f.tips) {
      for (const p of f.tips.part) if (p.i < side.T.length) tiles[p.i] = Object.assign({}, tiles[p.i], { style: 'tint' });
      sc.groups = [f.tips.part.map(p => p.poly)];
      sc.dots = [f.pivot];
      sc.plumb = { x: f.tips.com.x, y: f.tips.com.y, y1: Math.min(f.pivot.y, f.tips.com.y) - 0.4 };
    }
    tiles.push({ poly: f.rest, style: f.tips ? 'tintGhost' : 'ghost' });
    tiles.push({ poly: f.rug, color, num: side.num, style: 'rug' });
    sc.paths = [f.path];
    sc.rug = true;
  }
  sc.rug = true;
  return lib.scene(sc);
}
// Five frames. ONLY A POINT: held above, touching, tipping a little about the point it touched (the dot), falling out
// of the wall toward the viewer, lying on the rug below the car. TIPS OVER: held above, touching with the part that
// would tip tinted (its pivot dot and plumb line), the part rocked a few degrees toward its pivot, the part back where
// it was while the new tile falls out of the wall, and the new tile on the rug. Placed tiles never move.
function filmstrip(T, col, fall) {
  const base = tilesOf(T), num = T.length + 1, color = lib.colorOf(T.length);
  const held = lib.shape(fall.type, col, lib.centroid(fall.rest).y - lib.centroid(lib.shape(fall.type, col, 0)).y + 1.0);
  const tp = fall.tips, path = fall.path;
  const frames = tp ? [
    { poly: held },
    { poly: fall.rest, tint: true, mark: true },
    { poly: fall.tipped, tint: true, rock: true, mark: true, upto: 1 },
    { poly: fall.out, style: 'out', upto: 2 },
    { poly: fall.rug, style: 'rug', upto: 3 }
  ] : [
    { poly: held },
    { poly: fall.rest, dot: true },
    { poly: fall.tipped, dot: true, upto: 1 },
    { poly: fall.out, style: 'out', upto: 2 },
    { poly: fall.rug, style: 'rug', upto: 3 }
  ];
  let x0 = -HALF - 0.25, x1 = HALF + 0.25, top = 0.6;
  const all = base.map(t => t.poly).concat(frames.map(f => f.poly), tp ? tp.rocked : []);
  for (const p of all) for (const v of p) { x0 = Math.min(x0, v.x - 0.2); x1 = Math.max(x1, v.x + 0.2); top = Math.max(top, v.y); }
  const view = { x0, x1, y0: lib.RUG_Y - 0.4, y1: top + 0.75 };
  const L = fitL(view, 180, 280, 36);
  const polys = T.map(lib.polyOf), slivers = lib.buildSlivers(T, HALF), pointGaps = lib.buildPointGaps(T, HALF);
  return lib.svgRow(frames.map((f, i) => {
    let tiles = base.slice();
    const sc = { L, view, tiles, slivers, pointGaps, rug: true };
    if (tp && f.tint) {
      // the whole group tinted and drawn as one piece; rocked: turned a few degrees about the pivot toward its side, all
      // of it together (a tell: it rocks back)
      tp.part.forEach((p, k) => { if (p.i < T.length) tiles[p.i] = Object.assign({}, tiles[p.i], { poly: f.rock ? tp.rocked[k] : tiles[p.i].poly, style: 'tint' }); });
      sc.groups = [f.rock ? tp.rocked : tp.part.map(p => p.poly)];
      sc.slivers = f.rock ? [] : slivers;
      sc.pointGaps = f.rock ? [] : pointGaps;
    }
    tiles.push({ poly: f.poly, color, num, style: f.style || (tp && f.tint ? 'tint' : undefined) });
    if (f.mark) { sc.dots = [fall.pivot]; sc.plumb = { x: tp.com.x, y: tp.com.y, y1: Math.min(fall.pivot.y, tp.com.y) - 0.4 }; }
    if (f.dot) sc.dots = [fall.pivot];
    if (f.upto !== undefined) sc.paths = [path.slice(0, f.upto + 1)];
    if (i === 0) {
      const lx = col / 2, rx = lx + 1, yb = Math.min(...f.poly.map(v => v.y)) + (fall.type === 'dn' ? H : 0);
      sc.lines = [[lx, 1e-6], [rx, -1e-6]].map(([x, e]) => { const o = lib.outlineAt(polys, HALF, x + e); return { a: { x, y: yb - 0.04 }, b: { x, y: o === null ? lib.FLOOR : o }, dotted: true }; });
      sc.grip = { x: lx + 0.5, y: Math.max(...f.poly.map(v => v.y)) };
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
// how much of its bottom edge holds (squares and ▲: 1 half or 2; a ▼: 1 side or 2), from the shine
function hold(o) {
  const [p, q] = o.pose.y;
  if (o.way === 'down') return o.shine.length >= 2 ? 2 : 1;
  return o.shine.filter(s => s[0][1] === p && s[0][2] === q && s[1][1] === p && s[1][2] === q).reduce((a, s) => a + s[1][0] - s[0][0], 0);
}
const POLICIES = {
  random: (B, opts, r) => r.pick(opts),
  stack: (B, opts) => opts.slice().sort((a, b) => yv(a.pose.y) - yv(b.pose.y) || Math.abs(center(a)) - Math.abs(center(b)))[0],
  spire: (B, opts) => opts.slice().sort((a, b) => yv(b.pose.y) - yv(a.pose.y) || Math.abs(center(a)) - Math.abs(center(b)))[0],
  spire2: (B, opts) => { const mid = opts.filter(o => Math.abs(center(o)) <= 1); return (mid.length ? mid : opts).slice().sort((a, b) => yv(b.pose.y) - yv(a.pose.y))[0]; },
  careful: (B, opts) => {
    const T = R.tiles(B);
    const comx = T.reduce((s, t) => s + lib.centroid(lib.polyOf(t)).x, 0);
    return opts.slice().sort((a, b) => score(a) - score(b))[0];
    function score(o) { const c = (comx + center(o)) / (T.length + 1); return yv(o.pose.y) * 1.0 + Math.abs(c) * 3 + Math.abs(center(o)) * 0.4 - o.shine.length * 0.6 + (hold(o) >= 2 ? 0 : 0.8); }
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
// Every one breaks revision 5d (a point instead of an edge, off the lattice, a square off whole tiles or past the car,
// overlap, floating, or a group leaning past what holds it).
const sqAt = (x, y) => lib.shape('sq', x * 2, y);
const upAt = (x, y) => lib.shape('up', x * 2, y);
const dnAt = (x, y) => lib.shape('dn', x * 2, y); // x: its top edge's left end, y: its point's height
// kind: 'air' (floating or hanging in the air), 'overlap' (overlapping, or one tile through another), 'point' (on a
// point or a corner, or its middle off what holds it), 'lean' (a group hanging past what holds it: allowed by revision
// 5b, TIPS OVER under 5c and 5d; the two the round-2 reviewers rejected); weak: not drawn (see above)
const PLANTS = [
  { id: 'P01', rev4: true, kind: 'point', name: "revision 4's triangle balanced on a triangle's point", base: ['■-1', '■0', '▲-0.5', '■1'], add: () => [upAt(-0.5, 1 + H)] },
  { id: 'P02', rev4: true, weak: true, name: "revision 4's square half a tile off the top of a column", base: ['■-2', '■0', '■0', '▲-2'], add: () => [sqAt(0.5, 2)] },
  { id: 'P03', kind: 'air', name: 'a square floating above the build, touching nothing', base: ['■-2', '■-1', '▲-1.5', '■1'], add: () => [sqAt(1, 1.42)] },
  { id: 'P04', kind: 'overlap', name: 'two squares overlapping by 0.4 tile', base: ['■-2', '■-1', '▲-2'], add: () => [sqAt(-0.4, 0)] },
  { id: 'P05', weak: true, name: 'a square at a half step, half over the gap between two columns', base: ['■-2', '■0', '▲0', '■1'], add: () => [sqAt(-1.5, 1)] },
  { id: 'P06', kind: 'point', name: '▼ standing on its point alone on a flat top', base: ['■-1', '■0', '▲-2'], add: () => [dnAt(-0.5, 1)] },
  { id: 'P07', kind: 'point', name: '▲ with only a quarter of its base on the square under it, its middle past the square', base: ['■1', '■-1', '▲-1'], add: () => [upAt(1.75, 1)] },
  { id: 'P08', kind: 'air', name: 'a square hanging in mid-air beside a column, touching it only at a corner', base: ['■-1', '■-1', '■-1', '▲0'], add: () => [sqAt(0, 3)] },
  { id: 'P09', weak: true, name: 'a chain of hung triangles carrying a square out over the rug', base: ['■-1', '▲1', '▼1.5', '▲1.5'], add: () => [dnAt(2, H), sqAt(2, 2 * H)] },
  { id: 'P10', kind: 'overlap', name: 'a square sunk 0.3 tile into the square under it', base: ['■-2', '■-1', '▲0'], add: () => [sqAt(-1, 0.7)] },
  { id: 'P11', kind: 'point', name: '▼ balanced point to point on a ▲', base: ['▲0', '■-2', '■-1'], add: () => [dnAt(0, H)] },
  { id: 'P12', kind: 'overlap', name: 'two triangles overlapping, one off the lattice', base: ['▲-1', '■1'], add: () => [upAt(-0.6, 0)] },
  { id: 'P13', kind: 'point', name: 'a square on top of a ▼ that stands on its point', base: ['■-2', '■1', '▲1'], add: () => [dnAt(-0.5, 0), sqAt(-0.5, H)] },
  { id: 'P14', kind: 'air', name: 'a triangle floating in the air past the end of the car', base: ['■0', '■1', '▲-1'], add: () => [upAt(2.25, 0.1)] },
  { id: 'P15', kind: 'point', name: 'a square held only at a corner: its corner on a triangle\'s point, the rest of it over the empty car', base: ['■-2', '▲-0.5'], add: () => [sqAt(0, H)] },
  { id: 'P16', kind: 'overlap', name: 'a triangle\'s point poking up through the square on it', base: ['■1', '▲-1'], add: () => [sqAt(-1, 0.55)] },
  { id: 'P17', kind: 'lean', name: "revision 5b's stair leaning past its foot: four diamonds, each on the right half of the one below, from a triangle half off the car", base: ['▲-2.5', '▼-2', '▲-1.5'], add: () => [dnAt(-1, H), upAt(-0.5, 2 * H), dnAt(0, 2 * H), upAt(0.5, 3 * H), dnAt(1, 3 * H)] },
  { id: 'P18', kind: 'lean', name: 'a column of squares on a ▼ hung off a triangle that is half on a square', base: ['■-2', '▲-1.5'], add: () => [dnAt(-1, 1), sqAt(-1, 1 + H), sqAt(-1, 2 + H), sqAt(-1, 3 + H)] }
];

// What the pictures show, for the reviewers (nothing about the rules): written next to the sheets as legend.txt
const LEGEND = [
  'How to read the gallery pictures. Each picture has a label (G01, G02, ...) at its top left.',
  '- The grey plate with two wheels is a toy car seen from the side; the line below it is the floor, and the pale band',
  '  below that is the rug in front of the car. Tiles are magnetic building tiles (squares and triangles with equal',
  '  sides) standing in one flat wall on the car. Each tile is numbered in the order it was put on.',
  '- A fine dotted outline under part of a tile marks a thin gap of air between that tile and the tile below it. It is',
  '  not a piece and not a joint. A small dotted ring marks the same where a corner or point of one tile is just above',
  '  a corner or point of another: a thin gap of air, so the two do not touch there.',
  '- A single scene shows a build as it stands.',
  '- A wide picture with two scenes marked A and B shows two separate builds side by side. They are not before and',
  '  after: they differ in one thing (where the last tile was dropped, or one extra tile in one of them). A tile that is',
  '  in both builds has the same number in both; a number that appears in only one of them is a tile only that build',
  '  has. The highest-numbered tile was the last one dropped. In one build it stays where it is drawn. In the other a',
  '  dashed grey outline marks where it first touched the wall, a dotted line shows the path of its middle as it came',
  '  off the wall toward you, and a faint flattened shape on the rug below the car shows it lying there, out of play.',
  '  When red shading with one red outline round it marks a group of tiles (the last one\'s outline among them), those',
  '  tiles would have tipped over together, the last one with them: the red dot is the corner they would tip over and',
  '  the small red line hangs straight down from their centre of weight.',
  '- A row of five small frames (with grey arrows between them) is a filmstrip, left to right. The small grey box in',
  '  the first frame is the hand, and the dotted lines show where the tile falls. Either: the tile held above the',
  '  build, the tile touching the build (a red dot where it touches), the tile tipping a little about that point, the',
  '  tile falling out of the wall toward you, and the tile lying flat on the rug, out of play. Or: the tile held',
  '  above, the tile touching with the group of tiles that would tip over together with it shaded red, one red outline',
  '  round the group (the red dot is the corner they would tip over, the red line hangs from their centre of weight),',
  '  the group rocking a little toward that corner, the group back where it was while the new tile falls out of the',
  '  wall toward you, and the new tile on the rug.',
  '  Tiles already in the wall never move.',
  'Flag any picture where something does not look like what real magnetic tiles would do, and say which tile numbers.'
].join('\n');

// ---------------------------------------------------------------------------------------------------------------
function plantPicture(P) {
  const { T } = built(P.base.map(lib.parse));
  const tiles = tilesOf(T);
  for (const poly of P.add()) tiles.push({ poly, color: lib.colorOf(tiles.length), num: tiles.length + 1 });
  return buildPicture(tiles, { slivers: lib.buildSlivers(T, HALF), pointGaps: lib.buildPointGaps(T, HALF) });
}
const rulesPicture = T => buildPicture(tilesOf(T), { slivers: lib.buildSlivers(T, HALF), pointGaps: lib.buildPointGaps(T, HALF) });
// --pool=file.png: the whole pool of planted defects on one sheet, labelled, for checking the drawings
async function poolSheet(file) {
  const html = PLANTS.map(P => `<div class="pic"><span class="id">${P.id} ${lib.esc(P.name)}</span>${plantPicture(P).svg}</div>`).join('');
  const png = await lib.shoot(`<div style="display:grid;grid-template-columns:repeat(4,auto);gap:12px">${html}</div>`, `.pic{position:relative;border:1px solid #dfe2e8;border-radius:8px;padding:30px 4px 4px;line-height:0;width:310px}.id{position:absolute;left:6px;top:4px;font-size:11px;line-height:12px;color:#5a6075}`, 1.2);
  fs.writeFileSync(file, png);
  await lib.close();
  console.log('wrote ' + file);
}

// a minimal pair as two separate builds, A and B, numbered alike. sides: [{log, col, extra?: the index in log of a
// tile only this build has}]
function pairPicture(sides, piece) {
  const n = Math.max(...sides.map(s => s.log.length));
  for (const s of sides) {
    const { B, T } = built(s.log);
    const res = R.drop(B, piece, s.col);
    Object.assign(s, { B, T, res, type: res.way === null ? 'sq' : res.way === 'up' ? 'up' : 'dn' });
    // shared tiles keep their numbers; a tile only one build has gets the next number; the dropped tile n + 1 in both
    s.nums = s.log.map((e, i) => i + 1);
    s.num = n + 1;
    if (res.outcome !== 'fit') s.fall = lib.fall(T, HALF, res);
  }
  return sides;
}

async function main() {
  if (args.pool) return poolSheet(args.pool);
  const t0 = Date.now();
  const pics = [];
  // 1. extremes
  console.log(`walking every reachable build to depth ${DEPTH} …`);
  const W = extremesWalk(DEPTH);
  const usedCk = new Set(), picked = [];
  // how alike two builds are: the largest share of tiles they have in common, with one moved sideways by any number
  // of half tiles, as it is or mirrored (a stair moved half a tile is the same stair); and, whatever their heights, the
  // largest share of tiles of the same kind in the same columns (a column of squares with a ▲ on top and the same
  // column with a ▲ and a ▼ in it, round 3's G03 and G38). Too alike: half the tiles in common, or 60% of the columns.
  const tileSet = log => { const T = built(log).T; return { a: T.map(t => [lib.typeOf(t), t.col, t.y.join()]), b: T.map(t => [lib.typeOf(t), -t.col - 2, t.y.join()]) }; };
  const share = (x, y, withY) => {
    const key = (t, d) => t[0] + '|' + (t[1] + d) + (withY ? '|' + t[2] : '');
    let best = 0;
    for (const form of [x.a, x.b]) for (let d = -16; d <= 16; d++) {
      const ys = new Map();
      for (const t of y.a) { const k = key(t, 0); ys.set(k, (ys.get(k) || 0) + 1); }
      let k = 0;
      for (const t of form) { const kk = key(t, d), c = ys.get(kk) || 0; if (c) { k++; ys.set(kk, c - 1); } }
      best = Math.max(best, k);
    }
    return best / Math.max(x.a.length, y.a.length);
  };
  const tooAlike = (x, y) => share(x, y, true) >= 0.5 || share(x, y, false) > 0.6;
  let EX = {};
  try { EX = JSON.parse(fs.readFileSync(path.join(ENUM, 'extremes.json'), 'utf8')).extremes; } catch (e) { console.log('!! no ' + path.join(ENUM, 'extremes.json') + ': ' + e.message); }
  // one of the enumeration's extremes; must: never skipped as too like another (they are picked first)
  const enumPick = (name, must) => {
    const e = EX[name];
    let log = e.log.map(lib.parse);
    if (e.drop) { const B = lib.tryReplay(log), r = R.drop(B, e.drop.piece, e.drop.col, e.drop.way); log = log.concat([{ piece: e.drop.piece, col: e.drop.col, way: r.way }]); }
    const { T } = built(log), ck = lib.keysOf(T).ck;
    if (usedCk.has(ck)) return;
    // the enumeration's picks against the walk's (and each other), under translation and mirroring too
    const ts = tileSet(log);
    if (!must && picked.some(p => tooAlike(ts, p))) { console.log(`   (skipped the enumeration's "${name}": too like an earlier pick)`); return; }
    picked.push(ts); usedCk.add(ck);
    pics.push({ kind: 'extreme', what: name + ' (' + JSON.stringify(e.value) + ', depth ' + e.depth + ', from enumerate.cjs)', measure: 'enum:' + name, value: e.value, build: fmtLog(log), svg: rulesPicture(T) });
  };
  // the balance rule's own extremes (revision 5d) come first and are always shown: the tallest group standing on half an
  // edge, the most tiles in a group exactly over an end of its support, the largest locked piece
  const MUST = /^(tallest group standing on half an edge|most tiles in a group exactly over an end of its support|largest locked piece)/;
  for (const name of Object.keys(EX).filter(k => MUST.test(k))) enumPick(name, true);
  if (Object.keys(EX).filter(k => MUST.test(k)).length < 3) console.log('!! the enumeration\'s extremes lack one of revision 5d\'s balance extremes');
  for (const m of MEASURES) {
    let k = 0;
    for (const e of W.top[m.id]) {
      if (k >= PER[m.id]) break;
      if (usedCk.has(e.ck)) continue;
      const ts = tileSet(e.log);
      if (picked.some(p => tooAlike(ts, p))) continue;
      usedCk.add(e.ck); picked.push(ts); k++;
      const { T } = built(e.log);
      pics.push({ kind: 'extreme', what: m.name + ' (' + (Number.isInteger(e.v) ? e.v : e.v.toFixed(3)) + ')', measure: m.id, value: e.v, build: fmtLog(e.log), svg: rulesPicture(T) });
    }
    if (k < PER[m.id]) console.log(`!! ${m.id}: only ${k} builds (the others too like an earlier pick)`);
  }
  for (const name of Object.keys(EX).filter(k => !MUST.test(k) && /^(most neighbours touched by one fit|fewest fitting places|tallest structure standing on a ▼ held by one side|farthest overhang|tallest group of a locked piece)/.test(k))) enumPick(name, false);
  // 2. minimal pairs, from the enumeration's minimal-pairs.json, checked here with the hand's own way up
  let MP = { neighbouringCols: {}, oneTileAdded: {} };
  try { MP = JSON.parse(fs.readFileSync(path.join(ENUM, 'minimal-pairs.json'), 'utf8')); } catch (e) { console.log('!! no minimal-pairs.json: ' + e.message); }
  // half falls at a point, half TIPS OVER (both orders of A and B, both ways a tile can be added)
  const WANT = [['oneTileAdded', 'sq: FIT -> ONLY A POINT'], ['neighbouringCols', 'down: FIT | TIPS OVER'], ['neighbouringCols', 'up: FIT | ONLY A POINT'],
    ['oneTileAdded', 'sq: FIT -> TIPS OVER'], ['oneTileAdded', 'auto: ONLY A POINT -> FIT'], ['neighbouringCols', 'sq: TIPS OVER | FIT'],
    ['neighbouringCols', 'sq: ONLY A POINT | FIT'], ['oneTileAdded', 'auto: TIPS OVER -> FIT'], ['oneTileAdded', 'up: FIT -> TIPS OVER'],
    ['neighbouringCols', 'down: TIPS OVER | FIT'], ['oneTileAdded', 'up: FIT -> ONLY A POINT'], ['neighbouringCols', 'sq: FIT | TIPS OVER'],
    ['oneTileAdded', 'auto: FIT -> TIPS OVER'], ['neighbouringCols', 'up: TIPS OVER | FIT'], ['oneTileAdded', 'sq: ONLY A POINT -> FIT']];
  let nPairs = 0;
  for (const [kind, cls] of WANT) {
    if (nPairs >= 8) break;
    const exs = (MP[kind][cls] || []).slice().sort((a, b) => (a.log.length < 2 ? 10 : a.log.length) - (b.log.length < 2 ? 10 : b.log.length));
    for (const ex of exs) {
      const log = ex.log.map(lib.parse);
      let sides;
      if (kind === 'neighbouringCols') sides = ex.cols.map(col => ({ log, col }));
      else sides = [{ log, col: ex.col }, { log: log.concat([lib.parse(ex.add)]), col: ex.col }];
      if (sides.some(s => !lib.tryReplay(s.log))) continue;
      sides = pairPicture(sides, ex.piece);
      if (sides[0].res.outcome === sides[1].res.outcome) continue;
      // the class's way must be the hand's own choice (the hand turns a triangle itself)
      if (ex.way && sides.some(s => s.res.way !== ex.way)) continue;
      // only falls that can be drawn honestly: none that would push into a tile beside it (round 3's G47B) or come to
      // rest crooked on a top just below
      if (sides.some(s => s.fall && (!s.fall.ok || s.fall.blocked))) continue;
      if (rnd() < 0.5) sides.reverse();
      const all = [];
      for (const s of sides) { all.push(...s.T.map(lib.polyOf)); if (s.fall) all.push(s.fall.rest, s.fall.rug); else all.push(lib.shape(s.type, s.col, yv(s.res.pose.y))); }
      const view = viewFor([all], 0.5);
      view.y0 = Math.min(view.y0, lib.RUG_Y - 0.4);
      const L = fitL(view, UNIT, 340, 45);
      const svg = lib.svgRow(sides.map((s, i) => pairScene(s, view, L, i ? 'B' : 'A')), { gap: 24, divider: 3 });
      pics.push({ kind: 'pair', what: 'minimal pair ' + cls + ' (' + kind + ')', units: 2, build: sides.map(s => fmtLog(s.log)), hand: sides.map(s => lib.fmtHand(ex.piece, s.col, s.res.way)),
        outcomes: sides.map((s, i) => (i ? 'B: ' : 'A: ') + (s.res.outcome === 'fit' ? 'stays' : 'falls off: ' + s.res.reason + (s.fall.knife ? ' (knife-edge)' : '') + ', drawn falling out of the wall onto the rug' + (s.fall.tips ? ', the group that would tip drawn as one piece (' + s.res.tips.members.length + ' tiles, ' + s.res.tips.side + ')' : ''))), svg });
      nPairs++;
      break;
    }
  }
  if (nPairs < 8) console.log('!! only ' + nPairs + ' minimal pairs');
  // 3. filmstrips: tiles falling off (the hand's own way up), one of each kind, from small builds
  const small = lib.walk(5).nodes.filter(n => n.depth >= 1);
  const POINT = 'ONLY A POINT', TIPS = 'TIPS OVER';
  const KINDS = [
    { what: '▲ on a point under its middle (a knife-edge)', ok: (t, f, d) => f.reason === POINT && t === 'up' && f.knife && !d.outside },
    { what: '▲ with one corner on a point, its middle past it', ok: (t, f, d) => f.reason === POINT && t === 'up' && !f.knife },
    { what: '■ on a point under its middle (a knife-edge)', ok: (t, f, d) => f.reason === POINT && t === 'sq' && f.knife },
    { what: '■ with one corner on a point, its middle past it', ok: (t, f, d) => f.reason === POINT && t === 'sq' && !f.knife },
    { what: '▲ past the car\'s end on a point', ok: (t, f, d) => f.reason === POINT && t === 'up' && d.outside },
    { what: '▼ hung on a triangle held by half an edge, which would tip (TIPS OVER)', ok: (t, f, d) => f.reason === TIPS && t === 'dn' },
    { what: '■ on top of a hung ▼, which would tip with it and the triangle it hangs on (TIPS OVER)', ok: (t, f, d) => f.reason === TIPS && t === 'sq' && f.tips.members.length >= 3 },
    { what: '▲ that would tip the group under it (TIPS OVER)', ok: (t, f, d) => f.reason === TIPS && t === 'up' }
  ];
  const order = rnd.shuffle(small.slice()).sort((a, b) => a.depth - b.depth);
  const usedFilm = new Set();
  for (const K of KINDS) {
    let found = null;
    for (const nd of order) {
      if (usedFilm.has(nd.ck)) continue;
      if (Math.max(0, ...nd.T.map(x => Math.max(...lib.polyOf(x).map(v => v.y)))) > 3.2) continue;
      for (const piece of ['sq', 'tri']) {
        for (const col of R.cols(nd.B, piece)) {
          const res = R.drop(nd.B, piece, col);
          if (res.outcome === 'fit') continue;
          const t = res.way === null ? 'sq' : res.way === 'up' ? 'up' : 'dn';
          // a tile resting on two points either side of its middle (golden case 3) shows no way to tip: not filmed; nor
          // a fall that would push into a tile beside it or come to rest crooked on a top just below
          const fall = lib.fall(nd.T, HALF, res);
          if (fall.two || !fall.ok || fall.blocked) continue;
          const d = lib.describe(nd.B, piece, col, res);
          if (!K.ok(t, fall, d)) continue;
          found = { nd, piece, col, res, fall }; break;
        }
        if (found) break;
      }
      if (found) break;
    }
    if (!found) { console.log('!! no filmstrip for ' + K.what); continue; }
    const { nd, piece, col, res, fall } = found;
    usedFilm.add(nd.ck);
    pics.push({ kind: 'filmstrip', what: 'falls off: ' + K.what + ' (' + res.reason + (fall.knife ? ', knife-edge: tips a little outward' : '') + ')', units: 3,
      build: fmtLog(nd.log), hand: lib.fmtHand(piece, col, res.way), outcome: res.reason, fall: { dir: fall.dir > 0 ? 'right' : 'left', pivot: [+fall.pivot.x.toFixed(3), +fall.pivot.y.toFixed(3)], knife: fall.knife, tips: res.tips ? { members: res.tips.members.length, side: res.tips.side } : null }, svg: filmstrip(nd.T, col, fall) });
  }
  // 4. random builds and bot end states
  // (at least 8; more when near-duplicate extremes were skipped, so the gallery keeps about 50 pictures)
  const nRandom = Math.max(8, 50 - pics.length - 4 - 4 - 4);
  for (let i = 0; i < nRandom; i++) {
    const log = runBot('random', rnd, 8 + rnd.int(9));
    pics.push({ kind: 'random', what: 'random build of ' + log.length + ' tiles (random fitting drops from a shuffled box)', build: fmtLog(log), svg: rulesPicture(built(log).T) });
  }
  for (const [bot, n] of [['stack', 20], ['careful', 20], ['spire', 12], ['spire2', 14]]) {
    const log = runBot(bot, rnd, n);
    pics.push({ kind: 'bot', what: bot + '-like bot after ' + log.length + ' tiles', build: fmtLog(log), svg: rulesPicture(built(log).T) });
  }
  // 5. planted defects: revision 4's triangle on a point and one of the two groups leaning past what holds it every
  // round (the balance rule), and one each of two of the other three kinds, by the seed
  const always = PLANTS.filter(p => p.rev4 && !p.weak);
  const kinds = ['lean'].concat(rnd.shuffle(['air', 'overlap', 'point']).slice(0, 2));
  const drawn = always.concat(kinds.map(k => rnd.pick(PLANTS.filter(p => p.kind === k && !p.weak && !always.includes(p)))));
  for (const P of drawn) pics.push({ kind: 'plant', plant: P.id, what: 'PLANTED DEFECT ' + P.id + ': ' + P.name, build: P.base.concat(['+ defect drawn directly']), svg: plantPicture(P) });
  // 6. golden good pictures
  for (const n of [12, 2, 4, 8]) {
    const c = CASES[n - 1], { B } = built(c.log), r = R.drop(B, c.lastDrop.piece, c.lastDrop.col, c.lastDrop.way || undefined);
    if (r.outcome !== 'fit') throw new Error('golden ' + n + ' does not fit');
    const T = R.tiles(R.place(B, r));
    pics.push({ kind: 'golden', golden: n, what: 'golden case ' + n + ': ' + c.title + ' (every tile stays)', build: fmtLog(c.log.concat([{ piece: c.lastDrop.piece, col: c.lastDrop.col, way: r.way }])), svg: rulesPicture(T) });
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
    what: 'Key for the CLACK STACK revision 5d plausibility gallery (DESIGN §18.8). Never show this to reviewers.',
    seed: SEED, depth: DEPTH, buildsWalked: W.count, made: new Date().toISOString(), galleryDir: OUT, sheets: files.map(f => path.basename(f)),
    plants: all.filter(p => p.kind === 'plant').map(p => p.id), golden: all.filter(p => p.kind === 'golden').map(p => p.id),
    scoring: 'A reviewer counts only if they flag at least 3 of the 4 plants and at most 1 golden picture. The round passes when no other picture is flagged by 2 or more counted reviewers.',
    falls: 'Falls (filmstrips, pairs) are drawn by tools/review/lib.cjs fall() (DESIGN §18.2, revision 5d): a tile that falls off never comes to rest in the wall. It tips a little about the point it touched (toward the side its middle is on; a knife-edge tips to its free side, outward when both are free), then falls out of the wall toward the viewer and lies on the rug below the car, drawn foreshortened and faded. For TIPS OVER the whole group of the reported piece (rules tips.members: every tile locked to it by a whole edge and everything resting on it, the new tile among them) is drawn as one piece, tinted red with one red outline, its pivot dot and plumb line, rocks a few degrees toward the pivot and back, and the new tile falls out of the wall. Placed tiles never move. Not filmed or paired: tiles resting on points either side of their middle, and falls whose drawn tip would push into a tile beside them or onto a top just below (blocked).',
    drawing: 'Sandbox style. Thin gaps (0.134, 0.268) under flat tiles: a dotted outline; near misses at a point (a corner or point that close above another tile\'s point or corner): a small dotted ring. The wheels are 0.2 tile in from each end of the car, as in the game (index.html CFG: HALF − WHEEL_IN = 1.8).',
    plantPool: PLANTS.map(p => ({ id: p.id, name: p.name, kind: p.kind || null, alwaysDrawn: always.includes(p), notDrawn: p.weak ? 'held by half an edge or hung like real tiles: not a plain defect under 5c or 5d' : null, drawnThisRound: drawn.includes(p) })),
    pictures: all.map(p => {
      const o = { id: p.id, sheet: p.sheet, kind: p.kind, plant: p.kind === 'plant', golden: p.golden || null, what: p.what };
      for (const k of ['measure', 'value', 'build', 'hand', 'outcome', 'outcomes', 'fall']) if (p[k] !== undefined) o[k] = p[k];
      if (p.kind === 'plant') o.plantId = p.plant;
      return o;
    })
  };
  key.reviewerLegend = LEGEND;
  fs.writeFileSync(path.join(OUT, 'legend.txt'), LEGEND + '\n');
  fs.mkdirSync(path.dirname(KEY), { recursive: true });
  fs.writeFileSync(KEY, JSON.stringify(key, null, 1));
  // this draw's log, next to its key (never a log from another draw)
  fs.writeFileSync(path.join(path.dirname(KEY), 'run.log'), [`seed ${SEED}, depth ${DEPTH}, ${W.count} builds walked, made ${key.made}`, `${all.length} pictures on ${files.length} sheets in ${OUT}`,
    `plants ${key.plants.join(' ')} (${drawn.map(p => p.id).join(' ')}), golden ${key.golden.join(' ')}`].concat(all.map(p => `${p.id} ${p.kind}: ${p.what}`)).join('\n') + '\n');
  console.log(`${all.length} pictures on ${files.length} sheets in ${OUT}; plants ${key.plants.join(' ')}, golden ${key.golden.join(' ')}; key ${KEY} (${Date.now() - t0} ms)`);
}
if (require.main === module) main().catch(async e => { console.error(e); await lib.close(); process.exit(1); });
module.exports = { analyse, PLANTS, MEASURES, LEGEND, pairPicture, filmstrip };
