'use strict';
// Exhaustive enumeration (DESIGN §18.8, the rules tier), revision 5c: every build reachable by fitting drops on the
// real base, mirror images merged, to a given depth (tier 1: 7; tier 2: 10). At every build, every piece × way × col is
// dropped (squares; triangles forced up, forced down, and with no way given), and the invariants that need no oracle
// are checked:
//   I2 fitsAll equals drop          I3 drop is pure                  I4 tile order makes no difference
//   I5 mirror symmetry              I6 translation on a wide base    I7 locality (balance aside: see there)
//   I8 replaying the log rebuilds   I9 re-dropping a top tile        I10 the state is sound, every part balanced
//   I11 at most one way up fits     I12 pull obeys §18.6             I13 the shine and the tips explain the outcome
// plus FORMAT (SPEC §8, tips included), GAP (the gap of SPEC §5a, recomputed from the polygons), AUTO (the way of SPEC
// §6, the neither-fits rule included), THROWS (SPEC §2's cols) and OUTLINE (whether the tile meets the tower edge to
// edge depends only on the top outline under it; under 5c whether it then balances does not). I1 (the game equals the
// oracle) is the pluggable compare hook: --compare=<module exporting {newBuild, drop, place}> (an oracle for SPEC 5c),
// --compare=rules (a second copy of rules.js, to test the plumbing), or --compare=mutant:<name>. Without it the run is
// rules-only. The balance is checked against tools/rules/geom.cjs balanceOf(), exact polygon geometry that shares
// nothing with rules.js: I10 on every build, I13 on every TIPS OVER (the part named really leans past its grip, and it
// is SPEC's base) and, on heavy builds, on every fit (with it, everything balances).
//
// Size. Under 5b about 8.8 million builds were reachable to depth 10 (×4.2 a depth); 5c's balance rule removes some.
// The frontier is kept compact: a build is its set of tiles, one UTF-16 code per tile (type, col, height), sorted; the
// smaller of a build's two mirror forms is its key (ck). A build is rebuilt from its key by dropping its tiles lowest
// first (▲ and ■ before a ▼ at the same height): a tile that shares a column with an earlier one always rests at
// least as high, so under 5b this order was always a valid one. Under 5c it may not be: a counterweight can be needed
// before the tile it balances, and the lower of the two may be the one that would tip alone. So rebuild() goes lowest
// first and backs up when a tile falls off (rarely needed; see rebuild), and rebuilding is itself a check of I4.
// Heavy checks (I2, I3 sampled, I6, I7, I9, I12, OUTLINE, the contact geometry, the balance of fits) run on every
// build to depth --full-to (6) and on 1 in --sample (8) builds past it.
//
// Coverage (per outcome × piece × way × reason; TIPS OVER by piece and way, by side, by number of members, and by
// where the base is: the new tile's own part, a tile it rests on, or lower down), how tiles hold, thin gaps (0.134,
// 0.268) under staying tiles, how often a triangle fits both ways, how often no square fits and how often nothing fits
// at all, extremes (among them the largest lean that stays, the most tiles in a part leaning within its grip, the
// tallest structure standing on a hung ▼ and the farthest overhang) and minimal pairs are written as JSON.
//
//   node tools/rules/enumerate.cjs [--depth=10] [--workers=4] [--compare=path] [--oracle-depth=N] [--out=dir]
//                                  [--fail-fast] [--full-to=6] [--sample=8] [--cache-cap=N] [--checkpoint=dir [--resume]]
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const canon = require('../lib/canon.cjs');
const geom = require('./geom.cjs');
const rulesVm = require('../lib/rules-vm.cjs');

const OUT_DEFAULT = '/tmp/claude-0/-home-user-various/eea7fc80-8598-5a7a-a3e6-cdbd34e6e76d/scratchpad/rev5c/enum';
const INVS = ['I1', 'I1CACHE', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'I9', 'I10', 'I11', 'I12', 'I13', 'FORMAT', 'GAP', 'AUTO', 'THROWS', 'OUTLINE'];
// Disagreement classes already triaged as open questions for the designer (SPEC.md does not decide them): counted and
// reported on every run as OPEN, but they do not fail I1. Revision 5b settled revision 5's only one (A1, the col range);
// revision 5c has none.
const OPEN = [];
const openOf = k => OPEN.find(o => o.test(k)) || null;
const THIN = { '2,-1': '0.134', '4,-2': '0.268' };
const REASONS = ['ONLY A POINT', 'TIPS OVER'];

// the hand's cols (SPEC §2), from the spec, not from the rules under test
function colsOf(half, piece) {
  const out = [];
  if (piece === 'sq') for (let c = -2 * half; c <= 2 * half - 2; c += 2) out.push(c);
  else for (let c = -2 * half - 1; c <= 2 * half - 1; c++) out.push(c);
  return out;
}
const MODES = [['sq', undefined], ['tri', 'up'], ['tri', 'down'], ['tri', undefined]];
const modeName = (piece, way) => piece === 'sq' ? 'sq' : way || 'auto';
const sgn = geom.sgn;
const R3 = Math.sqrt(3);
const yOf = y => (y[0] + y[1] * R3) / 2;

function fnv(s, seed) { let h = seed || 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// the oracle cache's value: a 30-bit hash of the oracle's strict string (a small integer, so millions fit in a worker)
function valueHash(s) { return fnv(s, 0x9747b28c) & 0x3fffffff; }
// a 53-bit hash of a string (for key() comparisons across millions of builds; a collision is re-checked in full)
function hash53(s) { return fnv(s) * 2097152 + (fnv(s, 0x811c9dc5 ^ 0x5bd1e995) & 0x1fffff); }

// ---- compact builds: one UTF-16 code per tile ----
// code = ((type·13 + col + 7)·32 + p/2)·32 + q for a tile whose lowest point is at y = (p + q√3)/2; valid for
// half ≤ 3 (cols −7 … 5) and heights a = p/2 < 32, q < 32
const TYPES = ['sq', 'up', 'down'];
function codeOf(t) {
  const ty = t.piece === 'sq' ? 0 : t.way === 'up' ? 1 : 2, a = t.y[0] / 2, q = t.y[1];
  if (!(t.col >= -7 && t.col <= 5 && a >= 0 && a < 32 && q >= 0 && q < 32 && Number.isInteger(a))) throw new Error('codeOf: tile out of range ' + JSON.stringify(t));
  return ((ty * 13 + t.col + 7) * 32 + a) * 32 + q;
}
function decode(code) {
  const q = code % 32; code = (code - q) / 32;
  const a = code % 32; code = (code - a) / 32;
  const c = code % 13, ty = (code - c) / 13;
  const type = TYPES[ty];
  return { piece: type === 'sq' ? 'sq' : 'tri', way: type === 'sq' ? null : type, col: c - 7, y: [2 * a, q] };
}
const mirrorTile = t => ({ piece: t.piece, way: t.way, col: -t.col - 2, y: t.y });
function strOf(tiles) { return tiles.map(codeOf).sort((x, y) => x - y).map(c => String.fromCharCode(c)).join(''); }
// a build's own form, its mirror form, and its key: the smaller of the two
function formsOf(T) {
  const k = strOf(T), m = strOf(T.map(mirrorTile));
  return { k, m, ck: k <= m ? k : m, mirrored: m < k };
}
function tilesOfStr(s) { const T = []; for (let i = 0; i < s.length; i++) T.push(decode(s.charCodeAt(i))); return T; }
// lowest first; ▲ and ■ before a ▼ at the same height (a ▼ hangs on a ▲ whose base is at its point's height)
function dropOrder(T) {
  return T.slice().sort((u, v) => sgn(u.y[0] - v.y[0], u.y[1] - v.y[1]) || ((u.way === 'down') - (v.way === 'down')) || u.col - v.col);
}
// Rebuild a build from its tiles: drop them lowest first, each fitting and landing where it was; when one does not
// (under 5c a tile can need a counterweight that is higher, or further right, than it), skip it for now and try the
// next, depth first, never trying the same set of placed tiles twice. Throws when no order works.
// Returns {B, log, reordered: true when lowest first did not work}.
function rebuild(R, half, T) {
  const order = dropOrder(T), n = order.length, dead = new Set();
  let reordered = false, why = null;
  function go(B, used, log) {
    if (log.length === n) return { B, log };
    let first = -1;
    for (let k = 0; k < n; k++) {
      if (used & (1 << k)) continue;
      if (first < 0) first = k;
      const u = used | (1 << k);
      if (dead.has(u)) continue;
      const t = order[k];
      const r = R.drop(B, t.piece, t.col, t.piece === 'sq' ? undefined : t.way);
      if (r.outcome !== 'fit' || r.pose.y[0] !== t.y[0] || r.pose.y[1] !== t.y[1]) {
        if (!why) why = `${canon.fmtDrop(t)} ${r.outcome === 'fit' ? 'lands at ' + r.pose.y + ', not ' + t.y : 'falls off (' + r.reason + ')'} after ${log.map(canon.fmtDrop).join(' ') || 'nothing'}`;
        continue;
      }
      if (k !== first) reordered = true;
      const got = go(R.place(B, r), u, log.concat([{ piece: t.piece, col: t.col, way: t.way }]));
      if (got) return got;
      dead.add(u);
    }
    return null;
  }
  if (n > 30) throw new Error('rebuild: too many tiles for the search');
  const got = go(R.newBuild({ half }), 0, []);
  if (!got) throw new Error('no order of its tiles builds it: ' + why);
  got.reordered = reordered;
  return got;
}

// ---- stats ----
function newStats() {
  return {
    builds: {}, drops: 0, cover: {}, thin: {}, gaps: {}, holds: {}, notchDown: 0, oneSideDown: 0, pointAir: 0, pointFlat: 0,
    bothWays: 0, bothWaysCols: 0, triCols: 0, fitsPerBuild: { sq: {}, up: {}, down: {}, tri: {} }, noSquare: 0, noTriangle: 0, noFit: 0, byDepth: {},
    tips: {}, reordered: 0, leaning: {},
    checks: Object.fromEntries(INVS.map(k => [k, 0])), fails: [], failCount: Object.fromEntries(INVS.map(k => [k, 0])),
    ext: {}, pairsCol: {}, pairsTile: {}, examples: {}, outline: {},
    i1: {}, oracleCache: { hits: 0, misses: 0, verified: 0, unsound: 0, builds: 0 }, oracleDrops: 0
  };
}
// I1 disagreement classes: {label: {n, open, ex: [{log, drop, diff}] (shallowest first)}}
const I1_EX = 6;
function addI1(st, label, ex) {
  const c = st.i1[label] || (st.i1[label] = { n: 0, open: (openOf(label) || {}).id || null, ex: [] });
  c.n++;
  if (c.ex.length < I1_EX || ex.log.length < c.ex[c.ex.length - 1].log.length) {
    c.ex.push(ex); c.ex.sort((a, b) => a.log.length - b.log.length); if (c.ex.length > I1_EX) c.ex.pop();
  }
}
function bump(o, k, n) { o[k] = (o[k] || 0) + (n === undefined ? 1 : n); }
function mergeStats(A, B) {
  for (const k in B.builds) bump(A.builds, k, B.builds[k]);
  A.drops += B.drops;
  for (const w of ['cover', 'thin', 'gaps', 'holds', 'tips', 'leaning']) for (const k in B[w]) bump(A[w], k, B[w][k]);
  for (const k of ['notchDown', 'oneSideDown', 'pointAir', 'pointFlat', 'bothWays', 'bothWaysCols', 'triCols', 'noSquare', 'noTriangle', 'noFit', 'oracleDrops', 'reordered']) A[k] += B[k];
  for (const p in B.fitsPerBuild) for (const k in B.fitsPerBuild[p]) bump(A.fitsPerBuild[p], k, B.fitsPerBuild[p][k]);
  for (const d in B.byDepth) { const a = A.byDepth[d] || (A.byDepth[d] = {}); for (const k in B.byDepth[d]) bump(a, k, B.byDepth[d][k]); }
  for (const k in B.checks) bump(A.checks, k, B.checks[k]);
  for (const k in B.failCount) bump(A.failCount, k, B.failCount[k]);
  for (const f of B.fails) if (A.fails.length < 200) A.fails.push(f);
  for (const k in B.ext) if (!A.ext[k] || B.ext[k].v > A.ext[k].v || (B.ext[k].v === A.ext[k].v && B.ext[k].depth < A.ext[k].depth)) A.ext[k] = B.ext[k];
  for (const which of ['pairsCol', 'pairsTile', 'examples']) for (const k in B[which]) {
    const a = A[which][k] || (A[which][k] = []);
    for (const x of B[which][k]) if (a.length < 8) a.push(x);
  }
  for (const k in B.i1) {
    const b = B.i1[k], a = A.i1[k] || (A.i1[k] = { n: 0, open: b.open, ex: [] });
    a.n += b.n;
    a.ex = a.ex.concat(b.ex).sort((x, y) => x.log.length - y.log.length).slice(0, I1_EX);
  }
  for (const k in B.oracleCache) A.oracleCache[k] += B.oracleCache[k];
  for (const k in B.outline) {
    if (!(k in A.outline)) { A.outline[k] = B.outline[k]; continue; }
    A.checks.OUTLINE++;
    if (A.outline[k].o !== B.outline[k].o) { bump(A.failCount, 'OUTLINE'); if (A.fails.length < 200) A.fails.push({ inv: 'OUTLINE', msg: `same outline (${k}), different outcomes: ${A.outline[k].o} vs ${B.outline[k].o}`, a: A.outline[k].log, b: B.outline[k].log }); }
  }
}

// ---- how a build stands: support (holding contacts) from the tiles, exactly ----
// i rests on j: a square or ▲ on the flat top (square, ▼) of j at its bottom's height with the two overlapping; a ▼
// on a ▲ beside it whose base is at its point's height. 'car' when a square or ▲ sits on the car top.
function supports(T) {
  const n = T.length, below = T.map(() => []);
  const top = t => t.piece === 'sq' ? [t.y[0] + 2, t.y[1]] : t.way === 'down' ? [t.y[0], t.y[1] + 1] : null;
  for (let i = 0; i < n; i++) {
    const t = T[i];
    if (t.way === 'down') {
      for (let j = 0; j < n; j++) { const u = T[j]; if (u.way === 'up' && u.y[0] === t.y[0] && u.y[1] === t.y[1] && Math.abs(u.col - t.col) === 1) below[i].push(j); }
    } else {
      if (t.y[0] === 0 && t.y[1] === 0) below[i].push(-1);
      for (let j = 0; j < n; j++) { const f = j !== i && top(T[j]); if (f && f[0] === t.y[0] && f[1] === t.y[1] && Math.abs(T[j].col - t.col) <= 1) below[i].push(j); }
    }
  }
  return below;
}
// the tiles that stand on tile k: those no longer joined to the car by supports once k is gone
function standingOn(below, k) {
  const n = below.length, ok = new Array(n).fill(false);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < n; i++) if (!ok[i] && i !== k && below[i].some(j => j === -1 || (j !== k && ok[j]))) { ok[i] = true; changed = true; }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (i !== k && !ok[i]) out.push(i);
  return out;
}
// per build: the tallest structure standing on a ▼ held by one side, and the farthest overhang (a tile's middle past
// where its own supports, all the way down, meet the car)
function standing(T, half) {
  const below = supports(T), n = T.length;
  const topY = t => t.piece === 'sq' ? yOf(t.y) + 1 : yOf(t.y) + R3 / 2;
  let hung = { h: -1, n: 0, air: false, k: -1 }, hungN = { h: -1, n: 0, air: false, k: -1 };
  for (let k = 0; k < n; k++) {
    if (T[k].way !== 'down' || below[k].length !== 1) continue;
    const dep = standingOn(below, k);
    const h = dep.length ? Math.max(...dep.map(i => topY(T[i]))) - topY(T[k]) : 0;
    // its point in the air: no flat top (car, square, ▼) at its point under it
    const P = [T[k].col + 1, T[k].y];
    const air = !(T[k].y[0] === 0 && T[k].y[1] === 0) && !T.some((u, j) => j !== k && u.way !== 'up' &&
      (u.piece === 'sq' ? u.y[0] + 2 === P[1][0] && u.y[1] === P[1][1] : u.y[0] === P[1][0] && u.y[1] + 1 === P[1][1]) && P[0] >= u.col && P[0] <= u.col + 2);
    if (h > hung.h + 1e-9) hung = { h, n: dep.length, air, k };
    if (dep.length > hungN.n || (dep.length === hungN.n && h > hungN.h + 1e-9)) hungN = { h, n: dep.length, air, k };
  }
  // overhang
  let over = 0, overK = -1;
  const memo = new Map();
  const base = i => {
    if (memo.has(i)) return memo.get(i);
    let lo = Infinity, hi = -Infinity;
    for (const j of below[i]) {
      if (j === -1) { lo = Math.min(lo, Math.max(T[i].col / 2, -half)); hi = Math.max(hi, Math.min(T[i].col / 2 + 1, half)); }
      else { const b = base(j); lo = Math.min(lo, b[0]); hi = Math.max(hi, b[1]); }
    }
    const r = [lo, hi]; memo.set(i, r); return r;
  };
  for (let i = 0; i < n; i++) {
    const [lo, hi] = base(i), cx = T[i].col / 2 + 0.5;
    const d = Math.max(0, lo - cx, cx - hi);
    if (d > over + 1e-9) { over = d; overK = i; }
  }
  return { hung, hungN, over, overK };
}

// ---- one build ----
function makeVisitor(R, opts) {
  const half = opts.half, cmpHook = opts.compare || null;
  const sampleHeavy = opts.sampleHeavy || 8; // 1 in N builds past depth `fullTo` get the heavy checks
  const fullTo = opts.fullTo === undefined ? 6 : opts.fullTo;
  // only: check just these invariants (e.g. ['I1'], to see whether the oracle alone kills a mutant); the heavy checks are skipped
  const only = opts.only ? new Set(opts.only) : null;
  const outlineOn = opts.outline !== false && !only;
  const oracleDepth = opts.oracleDepth === undefined || opts.oracleDepth === null ? Infinity : opts.oracleDepth;

  return function visit(node, st) {
    const { B, MB, log, depth, ck } = node;
    const hsh = fnv(ck);
    const heavy = !only && (depth <= fullTo || hsh % sampleHeavy === 0);
    bump(st.builds, depth);
    const fail = (inv, msg, extra) => {
      if (only && !only.has(inv)) return;
      st.failCount[inv]++;
      if (st.fails.length < 60) st.fails.push(Object.assign({ inv, msg, log: log.map(canon.fmtDrop).join(' '), depth }, extra || {}));
      if (opts.failFast) throw Object.assign(new Error('FAILFAST ' + inv + ': ' + msg), { failFast: true });
    };
    const check = (inv, ok, msg, extra) => { if (only && !only.has(inv)) return true; st.checks[inv]++; if (!ok) fail(inv, typeof msg === 'function' ? msg() : msg, extra); return ok; };
    const T = R.tiles(B), MT = R.tiles(MB);
    const keyBefore = R.key(B);
    // I4: the rules' key of this build (rebuilt from its tiles in drop order) is the key it had when it was made in
    // the order it was first reached
    if (node.rkh !== undefined && node.rkh !== null) check('I4', hash53(keyBefore) === node.rkh, () => `key() of the build rebuilt lowest first differs from its key when first made: ${keyBefore}`);
    const polys = T.map(t => geom.shape(t.piece, t.way, t.col, t.y));
    // the build's flat tops (for where a ▼'s point is): car, square tops, ▼ tops, as [y p, y q, X from, X to]
    const flats = [[0, 0, -2 * half, 2 * half]];
    for (const t of T) {
      if (t.piece === 'sq') flats.push([t.y[0] + 2, t.y[1], t.col, t.col + 2]);
      else if (t.way === 'down') flats.push([t.y[0], t.y[1] + 1, t.col, t.col + 2]);
    }
    // I10: the state is sound (independent geometry), at every build: every part balanced among the rest (its rests
    // are reused for the balance checks of every drop below)
    let baseRests = null;
    {
      const st10 = geom.checkState(T, half), { errs, parts } = st10;
      baseRests = st10.rests || (T.length ? null : []);
      check('I10', errs.length === 0, () => errs.slice(0, 3).join('; '));
      // how far parts lean within their grip: the largest lean that stays (m ÷ (L/4)), the most tiles in a leaning part
      if (parts) for (const pt of parts) {
        if (!pt.side) continue;
        bump(st.leaning, 'parts leaning'); bump(st.leaning, 'parts leaning, ' + pt.members.length + ' tiles');
        if (cmp8(pt.m8, pt.L2) === 0) bump(st.leaning, 'parts leaning exactly as far as their grip holds');
        const info = { ratio: +pt.ratio.toFixed(4), m: fmt8(pt.m8), grip: pt.L2 + '/8', tiles: pt.members.length, base: canon.fmtDrop(T[pt.t]), side: pt.side };
        ext(st, 'largest lean that stays (lean ÷ grip)', pt.ratio, depth, log, info);
        ext(st, 'most tiles in a part leaning within its grip', pt.members.length + pt.ratio / 100, depth, log, info);
      }
    }
    const throws = (b, piece, col, way) => { try { R.drop(b, piece, col, way); return false; } catch (e) { return true; } };
    // THROWS: on the bare car, the API throws exactly where SPEC §2 says (odd or off-car square cols, triangle cols
    // past the hand's range) and nowhere else; the hand's cols are SPEC §2's
    if (depth === 0) {
      for (let col = -2 * half - 4; col <= 2 * half + 3; col++) {
        const sqOk = col % 2 === 0 && col >= -2 * half && col <= 2 * half - 2, triOk = col >= -2 * half - 1 && col <= 2 * half - 1;
        check('THROWS', throws(B, 'sq', col) === !sqOk, `square at col ${col} ${sqOk ? 'throws' : 'does not throw'}`);
        for (const w of ['up', 'down', undefined]) check('THROWS', throws(B, 'tri', col, w) === !triOk, `triangle ${w || ''} at col ${col} ${triOk ? 'throws' : 'does not throw'}`);
      }
      check('THROWS', throws(B, 'sq', 0, 'up') && throws(B, 'tri', 0, 'sideways') && throws(B, 'circle', 0) && throws(B, 'sq', 0.5), 'bad arguments are accepted');
      let placedOff = false;
      try { R.place(B, R.drop(B, 'tri', 0, 'down')); } catch (e) { placedOff = true; }
      check('THROWS', placedOff, 'placing a tile that falls off does not throw');
      if (R.cols) for (const p of ['sq', 'tri']) check('THROWS', JSON.stringify(R.cols(B, p)) === JSON.stringify(colsOf(half, p)), `cols(${p}) is not SPEC §2's: ${JSON.stringify(R.cols(B, p))}`);
      check('THROWS', JSON.stringify(R.REASONS) === JSON.stringify(REASONS), `REASONS is ${JSON.stringify(R.REASONS)}`);
      // I1 on the API: the game and the oracle throw on the same calls, and agree where neither throws
      if (cmpHook && node.oh) {
        const calls = [];
        for (let col = -2 * half - 4; col <= 2 * half + 3; col++) for (const [p, w] of [['sq', undefined], ['sq', null], ['tri', 'up'], ['tri', 'down'], ['tri', undefined], ['tri', null]]) calls.push([p, col, w]);
        calls.push(['sq', 0, 'up'], ['sq', 0, 'down'], ['tri', 0, 'sideways'], ['circle', 0, undefined], ['sq', 0.5, undefined], ['tri', 0.5, 'up'], ['tri', '0', 'up']);
        for (const [p, col, w] of calls) i1(p, col, w, true);
      }
    } else if (heavy) {
      // past the hand's range a drop throws on any build, even where tiles past the car's end lie below
      for (const col of [-2 * half - 2, 2 * half]) for (const w of ['up', 'down', undefined]) check('THROWS', throws(B, 'tri', col, w), `triangle ${w || ''} at col ${col}, past the hand's range, does not throw`);
      check('THROWS', throws(B, 'sq', -2 * half - 2) && throws(B, 'sq', 2 * half) && throws(B, 'sq', 1), 'a square past the car or at an odd col does not throw');
    }
    const res = {}; // mode -> [result per col]
    const fitPoses = new Map();
    const cmpH = cmpHook && node.oh && depth <= oracleDepth ? node.oh : null;
    if (cmpH) st.oracleCache.builds++;
    // I1 for one drop: the game's result (or throw) against the oracle's, field by field
    function i1(piece, col, way, verify, r) {
      let gr = r, gThrew = null;
      if (gr === undefined) { try { gr = R.drop(B, piece, col, way); } catch (e) { gThrew = e.message; } }
      let o = cmpHook.drop(node.oh, piece, col, way, verify);
      st.oracleDrops++;
      if (o.hs !== undefined) {
        // a cache hit holds only a 30-bit hash of the oracle's string: equal hashes are agreement (a disagreement
        // hidden by a hash clash has odds of 1 in 10^9 per disagreeing drop); otherwise ask the oracle afresh, for
        // the full diff, and if the fresh answer is not the one the cache held, the cache was wrong (I1CACHE)
        if (gThrew === null && valueHash(strictStr(canon.spec(gr, T))) === o.hs) { st.checks.I1++; return true; }
        const hs = o.hs;
        o = cmpHook.fresh(node.oh, piece, col, way);
        if (o.threw === undefined && valueHash(o.s) !== hs) o.unsound = 'hash ' + hs;
      }
      if (o.unsound !== undefined) check('I1CACHE', false, () => `cached oracle result for ${piece} ${col} ${way || ''} differs from a fresh one: ${o.unsound} vs ${o.s}`);
      else if (verify) st.checks.I1CACHE++;
      const mode = typeof piece === 'string' && piece === 'sq' ? 'sq' : (way || 'auto');
      const ex = d => ({ log: log.map(canon.fmtDrop), drop: { piece, col, way: way === undefined ? '(none)' : way }, diff: d });
      let label = null, d = null;
      if (gThrew !== null || o.threw !== undefined) {
        if (gThrew !== null && o.threw !== undefined) { st.checks.I1++; return true; }
        d = { game: gThrew !== null ? 'throws: ' + gThrew : canon.fmtOutcome(gr), oracle: o.threw !== undefined ? 'throws: ' + o.threw : canon.fmtOutcome(JSON.parse(o.s)) };
        label = `${mode}: game ${gThrew !== null ? 'throws' : 'returns ' + canon.fmtOutcome(gr)} / oracle ${o.threw !== undefined ? 'throws' : 'returns'}`;
      } else {
        const gs = strictStr(canon.spec(gr, T));
        if (gs === o.s) { st.checks.I1++; return true; }
        const G = JSON.parse(gs), O = JSON.parse(o.s);
        d = {};
        for (const f of Object.keys(O)) if (JSON.stringify(G[f]) !== JSON.stringify(O[f])) d[f] = [G[f], O[f]];
        const fields = Object.keys(d), cg = canon.canon(G, T), co = canon.canon(O, T);
        const orderOnly = fields.every(f => f !== 'keys' && JSON.stringify(cg[f]) === JSON.stringify(co[f]));
        label = `${mode}: game ${canon.fmtOutcome(G)} / oracle ${canon.fmtOutcome(O)}; differ in ${fields.join(', ')}` +
          (fields.includes('gap') ? ` (gap ${JSON.stringify(G.gap)} vs ${JSON.stringify(O.gap)})` : '') + (orderOnly ? ' (order only)' : '');
      }
      addI1(st, label, ex(d));
      if (openOf(label)) { st.checks.I1++; return true; }
      check('I1', false, () => `game and oracle differ: ${label}: ${JSON.stringify(d)}`);
      return false;
    }
    if (cmpH) for (const col of [-2 * half - 2, 2 * half]) for (const w of ['up', 'down', undefined]) i1('tri', col, w, false);
    for (const [piece, way] of MODES) {
      const m = modeName(piece, way), cols = colsOf(half, piece), arr = [];
      for (const col of cols) {
        let r;
        try { r = R.drop(B, piece, col, way); } catch (e) { fail('THROWS', `drop ${piece} ${col} ${way || ''} threw: ${e.message}`); continue; }
        st.drops++;
        arr.push(r);
        // FORMAT: the comparison format, sorted, plus pose
        check('FORMAT', formatOk(r, piece, way, col, T.length), () => `bad result format for ${piece} ${col} ${way || ''}: ${JSON.stringify(r)}`);
        bump(st.cover, `${r.outcome}|${piece}|${r.way || '-'}|${r.reason || 'FIT'}|${m === 'auto' ? 'auto' : 'forced'}`);
        if (r.outcome === 'fit' && m !== 'auto') fitPoses.set(r.pose.type + r.pose.col, r);
        // I3: pure (sampled: the same drop again gives the same result)
        if (heavy && col % 3 === 0) check('I3', canon.str(R.drop(B, piece, col, way), T) === canon.str(r, T), () => `drop ${piece} ${col} ${way || ''} differs on a second call`);
        // I13: the shine explains the outcome
        check('I13', shineOk(r), () => `shine does not explain ${r.outcome}/${r.reason} for ${piece} ${col} ${way || ''}: ${JSON.stringify({ shine: r.shine, contacts: r.contacts })}`);
        // I13, the balance: a TIPS OVER names SPEC's base part, and that part really leans past its grip (exact
        // polygon geometry, every one); a fit leaves every part balanced (heavy builds)
        if (r.reason === 'TIPS OVER' || (heavy && r.outcome === 'fit')) {
          const TN = T.concat([{ piece, way: r.way, col, y: r.pose.y, verts: r.verts }]);
          let g = null, err = null;
          try { g = geom.tipsReportOf(TN, half, baseRests); } catch (e) { err = e.message; }
          check('I13', !err && tipsOk(r, g, T.length) && comOk(r, TN), () => `the balance does not explain ${r.outcome}/${r.reason} for ${piece} ${col} ${way || ''}: game ${JSON.stringify(r.tips)}, geometry ${err || JSON.stringify(g && (g.none ? 'every part balances' : { base: g.base, members: g.members, side: g.side, pivot: g.pivot, m8: g.m8, L2: g.L2, failing: g.failing }))}`);
          if (g && !g.none && r.reason === 'TIPS OVER' && m !== 'auto') {
            const pc = piece === 'sq' ? '■' : r.way === 'up' ? '▲' : '▼', n = T.length;
            const where = g.base === n ? "the new tile's own part" : g.rests[n].some(x => x.j === g.base) ? 'a part it rests on' : 'a part lower down';
            bump(st.tips, pc + ' ' + g.side); bump(st.tips, pc + ' ' + g.members.length + ' tiles'); bump(st.tips, pc + ' ' + where); bump(st.tips, pc);
            bump(st.tips, 'members ' + g.members.length); bump(st.tips, 'side ' + g.side); bump(st.tips, 'base ' + where);
            addEx(st, `TIPS OVER ${pc}, ${g.members.length} tiles, ${where}`, log, { piece, col, way });
          }
        }
        if (heavy) check('I13', contactsMatch(polys, r, half), () => `contact segments of ${piece} ${col} ${way || ''} differ from the edge geometry: ${JSON.stringify(r.contacts.segments)}`);
        // GAP: SPEC §5a's gap, recomputed from the polygons (a fitting square or ▲ only; null otherwise)
        if (m !== 'auto' || r.way === 'up') {
          const want = r.outcome === 'fit' && r.way !== 'down' ? geom.gapOf(T, half, col, r.pose.y) : null;
          check('GAP', JSON.stringify(r.gap) === JSON.stringify(want), () => `gap of ${piece} ${col} ${way || ''} is ${JSON.stringify(r.gap)}, the polygons give ${JSON.stringify(want)}`);
        }
        // I1: the oracle (its cache checked by a fresh oracle drop on 1 in 16 drops, and on every drop to depth 3)
        if (cmpH) i1(piece, col, way, depth <= 3 || ((hsh >>> 4) + col * 7 + m.length) % 16 === 0, r);
        if (r.outcome === 'fit' && m !== 'auto') {
          const pc = piece === 'sq' ? '■' : r.way === 'up' ? '▲' : '▼';
          if (r.gap) {
            bump(st.gaps, pc + ' ' + canon.fmtH(r.gap));
            const g = THIN[r.gap.join(',')];
            if (g) { bump(st.thin, g); bump(st.thin, g + ' ' + pc); addEx(st, 'thin gap ' + g + ' under a staying ' + pc, log, { piece, col, way }); }
          }
          if (r.way === 'down') {
            const sides = downSides(r);
            if (sides === 2) st.notchDown++; else st.oneSideDown++;
            const P = r.verts.find(v => v[0] === col + 1 && v[1] === r.pose.y[0] && v[2] === r.pose.y[1]);
            const onFlat = P && flats.some(f => f[0] === P[1] && f[1] === P[2] && P[0] >= f[2] && P[0] <= f[3]);
            if (onFlat) st.pointFlat++; else { st.pointAir++; if (sides === 1) addEx(st, '▼ hung by one side, its point in the air', log, { piece, col, way }); }
            bump(st.holds, '▼ ' + (sides === 2 ? 'notch (both sides)' : 'one side') + (onFlat ? ', point on a flat top' : ', point in the air'));
          } else {
            const hb = bottomHold(r);
            bump(st.holds, pc + ' ' + hb);
            if (hb === 'half an edge') addEx(st, pc + ' held by half an edge' + (r.gap ? ' (gap ' + canon.fmtH(r.gap) + ')' : ' (half over nothing)'), log, { piece, col, way });
          }
        }
        if (r.outcome === 'fit' && r.shine.length >= 3) addEx(st, 'fit touching ' + r.shine.length + ' neighbours', log, { piece, col, way });
        if (r.outcome === 'fit' && r.shine.length > ((st.ext['most neighbours touched by one fit'] || {}).v || 0)) st.ext['most neighbours touched by one fit'] = { v: r.shine.length, value: r.shine.length, depth, log: log.map(canon.fmtDrop), drop: { piece, col, way } };
      }
      res[m] = arr;
    }
    check('I3', R.key(B) === keyBefore, 'the build changed while dropping');
    // I11 and AUTO (§6)
    const triCols = colsOf(half, 'tri');
    let triFits = 0, upFits = 0, downFits = 0, sqFits = 0, both = 0;
    triCols.forEach((col, i) => {
      const u = res.up[i], d = res.down[i], a = res.auto[i];
      if (!u || !d || !a) return;
      st.triCols++;
      if (u.outcome === 'fit' && d.outcome === 'fit') { both++; addEx(st, 'a triangle fits both ways', log, { piece: 'tri', col }); }
      check('I11', !(u.outcome === 'fit' && d.outcome === 'fit'), `both ways fit at col ${col}`);
      // SPEC §6, from the two forced results: the way that fits; both: the lower, ▼ when equal; neither: the one that
      // tips over if exactly one does, else ▲
      let want;
      if (u.outcome === 'fit' && d.outcome === 'fit') { const c = sgn(u.pose.y[0] - d.pose.y[0], u.pose.y[1] - d.pose.y[1]); want = c < 0 ? u : d; }
      else if (u.outcome === 'fit') want = u;
      else if (d.outcome === 'fit') want = d;
      else if ((u.reason === 'TIPS OVER') !== (d.reason === 'TIPS OVER')) want = u.reason === 'TIPS OVER' ? u : d;
      else want = u;
      if (u.outcome !== 'fit' && d.outcome !== 'fit') bump(st.tips, 'neither way fits: ' + (u.reason === 'TIPS OVER' ? 'TIPS' : 'POINT') + ' up, ' + (d.reason === 'TIPS OVER' ? 'TIPS' : 'POINT') + ' down');
      check('AUTO', canon.str(a, T) === canon.str(want, T) && a.pose.type === want.pose.type, () => `no way given at col ${col}: ${a.way} ${a.outcome} ${a.reason || ''}, §6 says ${want.way} ${want.outcome} ${want.reason || ''}`);
      if (u.outcome === 'fit') upFits++;
      if (d.outcome === 'fit') downFits++;
      if (a.outcome === 'fit') triFits++;
      // minimal pairs: neighbouring cols with different outcomes
      if (i > 0) for (const m of ['up', 'down']) {
        const p = res[m][i - 1], q = res[m][i];
        if (p && q && p.outcome !== q.outcome) addPair(st.pairsCol, `${m}: ${p.reason || 'FIT'} | ${q.reason || 'FIT'}`, { log: log.map(canon.fmtDrop), piece: 'tri', way: m, cols: [col - 1, col] });
      }
    });
    if (both) { st.bothWays++; st.bothWaysCols += both; }
    res.sq.forEach((r, i) => {
      if (r.outcome === 'fit') sqFits++;
      if (i > 0) { const p = res.sq[i - 1]; if (p.outcome !== r.outcome) addPair(st.pairsCol, `sq: ${p.reason || 'FIT'} | ${r.reason || 'FIT'}`, { log: log.map(canon.fmtDrop), piece: 'sq', cols: [r.pose.col - 2, r.pose.col] }); }
    });
    bump(st.fitsPerBuild.sq, sqFits); bump(st.fitsPerBuild.up, upFits); bump(st.fitsPerBuild.down, downFits); bump(st.fitsPerBuild.tri, triFits);
    const bd = st.byDepth[depth] || (st.byDepth[depth] = {});
    bump(bd, 'builds'); bump(bd, 'sqFits', sqFits); bump(bd, 'upFits', upFits); bump(bd, 'downFits', downFits); bump(bd, 'triCols', triFits);
    if (!sqFits) { bump(bd, 'noSquare'); st.noSquare++; addEx(st, 'no square fits', log); }
    if (!triFits) { bump(bd, 'noTriangle'); st.noTriangle++; addEx(st, 'no triangle fits', log); }
    if (!sqFits && !triFits) { st.noFit++; addEx(st, 'nothing fits', log); }
    // extremes
    let topY = 0, minX = 0, maxX = 0;
    for (const t of T) for (const v of t.verts) { topY = Math.max(topY, canon.yOf(v[1], v[2])); minX = Math.min(minX, v[0] / 2); maxX = Math.max(maxX, v[0] / 2); }
    ext(st, 'tallest (top, in tiles)', topY, depth, log);
    ext(st, 'most fitting places (■ + ▲ + ▼ columns)', sqFits + upFits + downFits, depth, log);
    ext(st, 'fewest fitting places (■ + ▲ + ▼ columns)', -(sqFits + upFits + downFits), depth, log, sqFits + upFits + downFits);
    ext(st, 'farthest reach past the car\'s end (tiles)', Math.max(-minX, maxX) - half, depth, log);
    if (depth >= 6) ext(st, 'flattest at depth ' + depth + ' (top, in tiles)', -topY, depth, log, topY);
    if (depth >= 6) ext(st, 'tallest at depth ' + depth + ' (top, in tiles)', topY, depth, log);
    if (T.length) {
      const sd = standing(T, half);
      if (sd.hung.k >= 0) {
        ext(st, 'tallest structure standing on a ▼ held by one side (its height above the ▼\'s top, tiles)', sd.hung.h, depth, log, { height: +sd.hung.h.toFixed(3), tiles: sd.hung.n, down: canon.fmtDrop(T[sd.hung.k]), pointInAir: sd.hung.air });
        ext(st, 'most tiles standing on a ▼ held by one side', sd.hungN.n + sd.hungN.h / 100, depth, log, { tiles: sd.hungN.n, height: +sd.hungN.h.toFixed(3), down: canon.fmtDrop(T[sd.hungN.k]), pointInAir: sd.hungN.air });
        if (sd.hung.air) ext(st, 'tallest structure standing on a ▼ hung by one side with its point in the air (tiles)', sd.hung.h, depth, log, { height: +sd.hung.h.toFixed(3), tiles: sd.hung.n, down: canon.fmtDrop(T[sd.hung.k]) });
      }
      if (sd.overK >= 0) ext(st, 'farthest overhang (a tile\'s middle past where its supports meet the car, tiles)', sd.over, depth, log, { overhang: +sd.over.toFixed(3), tile: canon.fmtDrop(T[sd.overK]) });
    }
    // OUTLINE: whether a tile meets the tower edge to edge depends only on the visible top outline under it (whether
    // it then balances depends on the whole part under it, so not on the outline). Every drop is keyed by the outline
    // over its own two columns (the topmost top's ends, relative to the first one, and its kind); one key must always
    // give one edge outcome (ONLY A POINT or not) and way, and every fit under it the same gap.
    if (outlineOn && heavy) {
      const parts = outlineParts(T, half);
      for (const [piece, way] of MODES) {
        const m = modeName(piece, way);
        for (const r of res[m]) {
          const k = m + ' ' + localSig(parts, r.pose.col), from = log.map(canon.fmtDrop).join(' ') + ' then ' + m + '@' + r.pose.col;
          const keys = [[k, `${r.reason === 'ONLY A POINT' ? 'ONLY A POINT' : 'EDGE'} ${r.way}`]];
          if (r.outcome === 'fit') keys.push([k + ' gap', String(r.gap)]);
          for (const [kk, o] of keys) {
            const prev = st.outline[kk];
            if (prev) check('OUTLINE', prev.o === o, () => `same outline as after ${prev.log} (${kk}): ${o} there ${prev.o}`);
            else st.outline[kk] = { o, log: from };
          }
        }
      }
    }
    // I2: fitsAll equals drop
    if (heavy) for (const [piece, way] of MODES) {
      const all = R.fitsAll(B, piece, way), arr = res[modeName(piece, way)];
      check('I2', all.length === arr.length && all.every((r, i) => canon.str(r, T) === canon.str(arr[i], T) && JSON.stringify(r.pose) === JSON.stringify(arr[i].pose) && JSON.stringify(r.tips) === JSON.stringify(arr[i].tips)), `fitsAll(${piece}, ${way || ''}) differs from drop`);
    }
    // I5: mirror symmetry (every build): every drop on the mirror build is the mirror of this one
    const mres = {};
    for (const [piece, way] of MODES) {
      const m = modeName(piece, way), arr = res[m], marr = [];
      for (const r of arr) {
        const mc = canon.mirrorCol(r.pose.col);
        let mr;
        try { mr = R.drop(MB, piece, mc, way); } catch (e) { fail('I5', 'mirror drop threw: ' + e.message); marr.push(null); continue; }
        marr.push(mr);
        check('I5', mirrorOk(mr, MT, r, T) && mr.pose.type === r.pose.type, () => `mirror of ${piece} ${r.pose.col} ${way || ''} differs: ${JSON.stringify(canon.diff(mr, canon.mirrorResult(r, T), MT))}`);
      }
      mres[m] = marr;
    }
    // I12: pull obeys §18.6
    if (heavy) for (const piece of ['sq', 'tri']) {
      const arr = piece === 'sq' ? res.sq : res.auto, cols = colsOf(half, piece), step = piece === 'sq' ? 2 : 1;
      cols.forEach((col, i) => {
        let want = arr[i];
        if (want.outcome !== 'fit') {
          for (let d = step; d <= 2; d += step) {
            const c = [col - d, col + d].map(x => cols.indexOf(x)).filter(j => j >= 0).map(j => arr[j]).filter(r => r.outcome === 'fit');
            if (!c.length) continue;
            c.sort((a, b) => sgn(a.pose.y[0] - b.pose.y[0], a.pose.y[1] - b.pose.y[1]) || a.pose.col - b.pose.col);
            want = c[0]; break;
          }
        }
        const got = R.pull(B, piece, col);
        check('I12', canon.str(got, T) === canon.str(want, T) && got.pose.col === want.pose.col, () => `pull ${piece} ${col}: got col ${got.pose.col} ${got.outcome}, want col ${want.pose.col} ${want.outcome}`);
      });
    }
    // I6: translation on a wide base (sampled): the same build on half = 50, shifted, gives shifted results
    if (heavy && hsh % 4 === 0 && log.length) {
      const W = 50, shift = 2 * ((hsh >> 3) % 30) - 30; // an even shift of −30 … 28 half tiles
      let B0, B1;
      try { B0 = canon.replay(R, W, log); B1 = canon.replay(R, W, canon.translateLog(log, shift)); } catch (e) { fail('I6', 'replay on the wide base threw: ' + e.message); }
      if (B0 && B1) {
        const T0 = R.tiles(B0), T1 = R.tiles(B1);
        for (const [piece, way] of MODES) {
          for (let col = -8; col <= 7; col++) {
            if (piece === 'sq' && col % 2) continue;
            const a = R.drop(B0, piece, col, way), b = R.drop(B1, piece, col + shift, way);
            check('I6', canon.str(b, T1) === JSON.stringify(canon.translateResult(a, shift, T0)), () => `translated by ${shift}: ${piece} ${col} ${way || ''} differs: ${JSON.stringify(canon.diff(b, canon.translateResult(a, shift, T0), T1))}`);
          }
        }
      }
    }
    // children: each fitting drop placed, with the rules' key of the child in its key's orientation (I4)
    const children = [];
    if (depth < opts.depth) {
      for (const r of fitPoses.values()) {
        const piece = r.pose.type === 'sq' ? 'sq' : 'tri', way = r.way || undefined;
        const C = R.place(B, r);
        check('I3', R.key(B) === keyBefore, 'place changed its argument');
        const TC = R.tiles(C), F = formsOf(TC);
        let rk = R.key(C);
        if (F.mirrored) {
          // the key is the mirror form: the key() of the mirror build, made through its own drops
          const m = modeName(piece, way), mr = mres[m][res[m].indexOf(r)];
          if (!mr || mr.outcome !== 'fit') { fail('I5', `the mirror of a fit does not fit (${piece} ${r.pose.col} ${way || ''})`); continue; }
          rk = R.key(R.place(MB, mr));
        }
        // I8: replaying the child's drop log (this build's log, then the new tile) rebuilds it
        if (heavy) {
          let RB = null;
          try { RB = canon.replay(R, half, C.log || log.concat([{ piece, col: r.pose.col, way: r.way }])); } catch (e) { fail('I8', 'replay threw: ' + e.message); }
          if (RB) check('I8', R.key(RB) === R.key(C) && JSON.stringify(R.tiles(RB)) === JSON.stringify(TC), 'replaying the log gives another build');
        }
        children.push({ ck: F.ck, rkh: hash53(rk), C, t: { piece, col: r.pose.col, way: r.way } });
      }
      // I7 locality and one-tile minimal pairs (sampled: one child per heavy build). A tile X added away from the
      // drop's columns leaves the drop as it was, and one beside them changes only its contacts, unless (5c) X shares
      // a part with the dropped tile: X rests, all the way down, on a tile the dropped tile rests on. Then X's weight
      // is in a part the drop tests, and whether it fits or tips over may change, but nothing else.
      if (heavy && children.length) {
        const ch = children[hsh % children.length], t = ch.t;
        const s0 = t.col, s1 = t.col + 1;
        const TC = R.tiles(ch.C), X = TC.length - 1, restsC = geom.balanceOf(TC, half, baseRests).rests;
        const downX = downOf(restsC, X), polysB = T.map(u => geom.shape(u.piece, u.way, u.col, u.y)), boundsB = polysB.map(geom.boundsOf);
        for (const [piece, way] of MODES) {
          const m = modeName(piece, way);
          res[m].forEach(r => {
            const col = r.pose.col, rc = R.drop(ch.C, piece, col, way);
            const near = s1 >= col - 1 && s0 <= col + 2, under = s1 >= col && s0 <= col + 1;
            let share = false;
            if (r.reason !== 'ONLY A POINT') {
              const P = geom.shape(piece, r.way, col, r.pose.y), bP = geom.boundsOf(P), down = new Set();
              polysB.forEach((Q, j) => { if (geom.restsOnPoly(P, Q, bP, boundsB[j])) { down.add(j); for (const k of downOf(restsC, j)) down.add(k); } });
              share = [...downX].some(k => down.has(k));
            }
            if (!near && !share) check('I7', canon.str(rc, TC) === canon.str(r, T), () => `a tile at col ${t.col} changed the drop at col ${col} (${piece} ${way || ''})`);
            else if (!under) {
              const a = canon.canon(r, T), b = canon.canon(rc, TC);
              const strip = (near ? ['contacts', 'shine'] : []).concat(share ? ['outcome', 'reason', 'shine', 'gap', 'tips'] : []);
              for (const f of strip) { delete a[f]; delete b[f]; }
              const edge = x => x.reason === 'ONLY A POINT' ? 'point' : 'edge';
              check('I7', JSON.stringify(a) === JSON.stringify(b) && edge(r) === edge(rc), () => `a tile ${near ? 'beside' : 'away from'} col ${col}${share ? ', in a part under the drop,' : ''} changed more than ${strip.join(', ')} (${piece} ${way || ''})`);
              if (share && !near) bump(st.tips, 'I7: a tile away from the drop changed its balance' + (r.outcome !== rc.outcome ? ' and its outcome' : ''));
            }
            if (r.outcome !== rc.outcome) addPair(st.pairsTile, `${m}: ${r.reason || 'FIT'} -> ${rc.reason || 'FIT'}`, { log: log.map(canon.fmtDrop), add: canon.fmtDrop(t), piece, way: way || null, col });
          });
        }
      }
    }
    // I9: re-dropping a top tile puts it back (sampled)
    if (heavy && T.length && hsh % 2 === 0) {
      const L = B.log || log;
      for (let i = 0; i < L.length; i++) {
        const cols = [T[i].col, T[i].col + 1];
        if (T.some((u, j) => j > i && (u.col === cols[0] || u.col === cols[1] || u.col + 1 === cols[0]))) continue; // something later in its columns
        let P;
        try { P = canon.replay(R, half, L.filter((e, j) => j !== i)); } catch (e) { continue; } // something leaned on it
        const TP = R.tiles(P);
        if (TP.some((u, j) => JSON.stringify(u) !== JSON.stringify(T[j < i ? j : j + 1]))) continue;
        const e = L[i], r = R.drop(P, e.piece, e.col, e.piece === 'sq' ? undefined : e.way);
        const ok = r.outcome === 'fit' && r.pose.y.join() === T[i].y.join() && R.key(R.place(P, r)) === R.key(B);
        check('I9', ok, () => `re-dropping top tile ${i} (${canon.fmtDrop(e)}) gives ${r.outcome} ${r.reason || ''} at ${r.pose.y}`);
      }
    }
    return children;
  };
}

const KEYS = 'contacts,gap,outcome,pose,reason,shine,tips,verts,way';
function formatOk(r, piece, way, col, n) {
  const isPt = p => Array.isArray(p) && p.length === 3 && p.every(Number.isInteger);
  const isSeg = s => Array.isArray(s) && s.length === 2 && isPt(s[0]) && isPt(s[1]) && canon.lex(s[0], s[1]) < 0;
  const sorted = (a, f) => a.every((x, i) => i === 0 || f(a[i - 1], x) < 0);
  const segLex = (s, t) => canon.lex(s[0], t[0]) || canon.lex(s[1], t[1]);
  if (r.outcome !== 'fit' && r.outcome !== 'off') return false;
  if (piece === 'sq' ? r.way !== null : (r.way !== 'up' && r.way !== 'down')) return false;
  if (way && r.way !== way) return false;
  if (!Array.isArray(r.verts) || r.verts.length !== (piece === 'sq' ? 4 : 3) || !r.verts.every(isPt) || !sorted(r.verts, canon.lex)) return false;
  if (r.outcome === 'fit' ? r.reason !== null : !REASONS.includes(r.reason)) return false;
  const C = r.contacts;
  if (!C || !Array.isArray(C.segments) || !Array.isArray(C.points) || !C.segments.every(isSeg) || !C.points.every(isPt)) return false;
  if (!sorted(C.segments, segLex) || !sorted(C.points, canon.lex)) return false;
  if (C.points.some(q => C.segments.some(s => geom.onSegment(q, s)))) return false; // §8: points exclude those on a segment
  // the gap: a positive [p, q] or null; always null for a ▼ and for a tile that falls off
  if (r.gap !== null && !(r.outcome === 'fit' && r.way !== 'down' && Array.isArray(r.gap) && r.gap.length === 2 && r.gap.every(Number.isInteger) && sgn(r.gap[0], r.gap[1]) > 0)) return false;
  if (Object.keys(r).sort().join() !== KEYS) return false; // SPEC §8's fields and pose, nothing else (revision 5's strips are gone)
  if (!r.pose || r.pose.col !== col || !Array.isArray(r.pose.y)) return false;
  // tips (DESIGN §18.7): null unless TIPS OVER; then {base: an index in the build (n is the new tile), members: sorted
  // indices with the base and the new tile among them, side, pivot: a lattice point [X, p, q] (p even), com: a number}
  if (r.reason !== 'TIPS OVER') return r.tips === null;
  const t = r.tips;
  if (!t || typeof t !== 'object' || Object.keys(t).sort().join() !== 'base,com,members,pivot,side') return false;
  if (!Number.isInteger(t.base) || t.base < 0 || t.base > n) return false;
  if (!Array.isArray(t.members) || !t.members.every((i, k) => Number.isInteger(i) && i >= 0 && i <= n && (k === 0 || i > t.members[k - 1]))) return false;
  if (!t.members.includes(t.base) || !t.members.includes(n)) return false;
  if (t.side !== 'left' && t.side !== 'right') return false;
  if (!isPt(t.pivot) || t.pivot[1] % 2 !== 0) return false;
  return typeof t.com === 'number' && isFinite(t.com);
}
// I13, the balance: rules.js's tips against SPEC §5c worked out from the polygons (geom.tipsReportOf on the build with
// the new tile, index n, added): a fit leaves every part balanced; a TIPS OVER names SPEC's base (the lowest failing
// tile, the smaller col on a tie), exactly its part's members, its side and pivot, the part really leans past its grip
// (8m > L2), and com is its centre of weight in x
function tipsOk(r, g, n, TN) {
  if (!g) return false;
  if (r.outcome === 'fit') return !!g.none;
  if (r.reason !== 'TIPS OVER') return true;
  if (g.none) return false;
  const t = r.tips;
  if (!t || t.base !== g.base || JSON.stringify(t.members) !== JSON.stringify(g.members) || t.side !== g.side || JSON.stringify(t.pivot) !== JSON.stringify(g.pivot)) return false;
  if (!(cmp8(g.m8, g.L2) > 0)) return false;
  return true;
}
function comOk(r, TN) {
  if (r.reason !== 'TIPS OVER') return true;
  let W = 0, M = 0;
  for (const i of r.tips.members) { const w = TN[i].piece === 'sq' ? 1 : R3 / 4; W += w; M += w * (TN[i].col / 2 + 0.5); }
  return Math.abs(M / W - r.tips.com) < 1e-9;
}
// 8m against L2 (both 8 × SPEC's numbers): the sign of 8m − L2
function cmp8(m8, L2) { return sgn(m8[0] - L2, m8[1]); }
// 8m as SPEC's m, in words: (a + b√3)/8
function fmt8(m8) { const [a, b] = m8; return '(' + (a ? a + (b ? (b > 0 ? ' + ' : ' − ') : '') : '') + (b ? (Math.abs(b) === 1 ? '' : Math.abs(b)) + '√3' : '') + ')/8'; }
// the tiles tile i rests on, all the way down (rests: geom.balanceOf's)
function downOf(rests, i) {
  const out = new Set(), stack = [i];
  while (stack.length) for (const x of rests[stack.pop()]) if (x.j >= 0 && !out.has(x.j)) { out.add(x.j); stack.push(x.j); }
  return out;
}
// I5 for one drop: the drop on the mirror build is the mirror of the drop. SPEC's base is the lowest failing tile and,
// on a tie, the one with the smaller col: mirrored, the tie goes the other way, so there the base (and with it the
// members and pivot) may be another failing tile at the same height; everything else must be the mirror image.
function mirrorOk(mr, MT, r, T) {
  const a = canon.canon(mr, MT), b = canon.mirrorResult(r, T);
  if (JSON.stringify(a) === JSON.stringify(b)) return true;
  if (!a.tips || !b.tips || JSON.stringify(Object.assign({}, a, { tips: null })) !== JSON.stringify(Object.assign({}, b, { tips: null }))) return false;
  const low = vs => vs.reduce((m, v) => !m || sgn(v[1] - m[1], v[2] - m[2]) < 0 ? v : m, null);
  const la = low(a.tips.base), lb = low(b.tips.base);
  return la[1] === lb[1] && la[2] === lb[2] && JSON.stringify(a.tips.base) !== JSON.stringify(b.tips.base);
}
// I13: the shine explains the outcome. Shine is the contact segments when it fits and nothing when it falls off; the
// tile rests on something; every contact lies on its boundary. A square or ▲ meets the tower edge to edge (fits, or
// tips over) exactly when a contact segment lies along its bottom edge, and every such segment is half the edge or all
// of it; when it is off with ONLY A POINT, its bottom touches only at points. A ▼ meets the tower edge to edge exactly
// when a whole lower side is in contact; off with ONLY A POINT it has no contact segment.
function shineOk(r) {
  if (r.outcome === 'off') { if (r.shine.length) return false; }
  else if (JSON.stringify(r.shine) !== JSON.stringify(r.contacts.segments) || !r.shine.length) return false;
  if (!r.contacts.segments.length && !r.contacts.points.length) return false; // it rests on nothing
  if (r.outcome === 'fit' ? r.reason !== null : !REASONS.includes(r.reason)) return false;
  const poly = geom.shape(r.way === null ? 'sq' : 'tri', r.way, r.pose.col, r.pose.y);
  for (const s of r.contacts.segments) if (!geom.onBoundary(poly, s)) return false;
  const [c, p, q] = [r.pose.col, r.pose.y[0], r.pose.y[1]], segs = r.contacts.segments;
  if (r.way === 'down') {
    const side = geom.covers([[c, p, q + 1], [c + 1, p, q]], segs) || geom.covers([[c + 1, p, q], [c + 2, p, q + 1]], segs);
    return r.outcome === 'fit' || r.reason === 'TIPS OVER' ? side : !segs.length;
  }
  const atBottom = v => v[1] === p && v[2] === q && v[0] >= c && v[0] <= c + 2;
  const bottomSegs = segs.filter(s => atBottom(s[0]) && atBottom(s[1]));
  if (bottomSegs.some(s => s[1][0] - s[0][0] < 1)) return false; // shorter than half an edge
  // a fit, or a TIPS OVER (it met the tower edge to edge first), holds by half its bottom edge or more
  if (r.outcome === 'fit' || r.reason === 'TIPS OVER') return bottomSegs.length > 0;
  // ONLY A POINT: it touches its bottom line only at points (a contact point, or the end of a side contact: SPEC §8
  // leaves a point off the list when it lies on a contact segment)
  return !bottomSegs.length && (r.contacts.points.some(atBottom) || segs.some(s => atBottom(s[0]) || atBottom(s[1])));
}
// how a fitting square or ▲ holds: half an edge, a whole edge on one top, or a whole edge across two tops
function bottomHold(r) {
  const [p, q] = r.pose.y, bs = r.shine.filter(s => s[0][1] === p && s[0][2] === q && s[1][1] === p && s[1][2] === q);
  const len = bs.reduce((a, s) => a + s[1][0] - s[0][0], 0);
  return len >= 2 ? (bs.length === 1 ? 'a whole edge, on one top' : 'a whole edge, across two tops') : 'half an edge';
}
// I13 (sampled): the contact segments equal the positive-length edge overlaps with every tile and the car top
function contactsMatch(polys, r, half) {
  const poly = geom.shape(r.way === null ? 'sq' : 'tri', r.way, r.pose.col, r.pose.y), segs = [];
  for (const P of polys) for (const s of geom.contactSegs(poly, P)) segs.push(geom.normSeg(s));
  for (const s of geom.carSegs(poly, half)) segs.push(geom.normSeg(s));
  segs.sort((a, b) => geom.lex(a[0], b[0]) || geom.lex(a[1], b[1]));
  return JSON.stringify(segs) === JSON.stringify(r.contacts.segments);
}
function downSides(r) {
  const [c, p, q] = [r.pose.col, r.pose.y[0], r.pose.y[1]];
  const left = geom.covers([[c, p, q + 1], [c + 1, p, q]], r.shine), right = geom.covers([[c + 1, p, q], [c + 2, p, q + 1]], r.shine);
  return (left ? 1 : 0) + (right ? 1 : 0);
}
// the visible top outline: per half-tile column, the topmost top's two ends and its kind (a ▲ slant or flat); null
// over nothing
function outlineParts(T, half) {
  const parts = {};
  for (let s = -2 * half - 2; s <= 2 * half + 1; s++) {
    let best = s >= -2 * half && s < 2 * half ? { a: [0, 0], b: [0, 0], kind: 'flat' } : null;
    for (const t of T) {
      if (s !== t.col && s !== t.col + 1) continue;
      const j = s - t.col, [p, q] = t.y;
      let a, b;
      if (t.piece === 'sq') { a = [p + 2, q]; b = [p + 2, q]; }
      else if (t.way === 'down') { a = [p, q + 1]; b = [p, q + 1]; }
      else { a = j ? [p, q + 1] : [p, q]; b = j ? [p, q] : [p, q + 1]; }
      const mid = [a[0] + b[0], a[1] + b[1]];
      if (!best || sgn(mid[0] - best.a[0] - best.b[0], mid[1] - best.a[1] - best.b[1]) > 0) best = { a, b, kind: t.way === 'up' ? 'slant' : 'flat' };
    }
    parts[s] = best;
  }
  return parts;
}
// the outline over columns col and col + 1, with heights relative to the first top found (the rules don't depend on
// where the tiles are, only on how the tops under the tile stand to each other)
function localSig(parts, col) {
  const P = [parts[col], parts[col + 1]], base = (P[0] || P[1]).a;
  return P.map(x => x ? `${x.a[0] - base[0]},${x.a[1] - base[1]}/${x.b[0] - base[0]},${x.b[1] - base[1]}/${x.kind}` : '_').join(' ');
}
function addEx(st, k, log, drop) { const a = st.examples[k] || (st.examples[k] = []); if (a.length < 8) a.push({ log: log.map(canon.fmtDrop), drop: drop || null }); }
function addPair(o, k, x) { const a = o[k] || (o[k] = []); if (a.length < 8) a.push(x); }
function ext(st, k, v, depth, log, shown) { const e = st.ext[k]; if (!e || v > e.v + 1e-9 || (Math.abs(v - e.v) <= 1e-9 && depth < e.depth)) st.ext[k] = { v, value: shown === undefined ? v : shown, depth, log: log.map(canon.fmtDrop) }; }

// ---- the compare hook (I1) ----
// SPEC §8's fields of a result, in §8's order and exactly as given (nothing re-sorted), as one string. Extra fields
// on the game's side (pose, DESIGN §18.7) are left out; on the oracle's side, a missing or extra field is a
// disagreement (the 'keys' field).
function strictStr(r, exact) {
  const o = {};
  for (const f of canon.FIELDS) o[f] = r[f] === undefined ? '(missing)' : r[f];
  if (exact) { const ks = Object.keys(r).sort(); if (ks.join() !== canon.FIELDS.slice().sort().join()) o.keys = ks; }
  return JSON.stringify(o);
}
// What the oracle's answer for a drop at col can depend on (revision 5c), from the oracle's own tiles: the tiles
// within two cols of col (all a drop at col can touch or rest on: where it lands and how it meets the tower), and for
// the balance, every tile under those all the way down, every tile in the parts of all of them (everything resting on
// them, all the way up) and every tile those rest on (their parts' supports). Under 5b only the first set mattered;
// the balance is not local, so a cache keyed by it alone would be unsound. Returns a Set of tile indexes, or null when
// the tiles are of an unknown form (then nothing is cached). Kept per handle.
const RELEVANT = new WeakMap();
// an integer pair [p, q], y = (p + q√3)/2 (the SPEC 5c oracle's y0)
const isPQ = y => Array.isArray(y) && y.length === 2 && Number.isInteger(y[0]) && Number.isInteger(y[1]);
function tileForm(t) {
  if (t && 'kind' in t && Array.isArray(t.y0)) {
    if (!isPQ(t.y0)) return null;
    const kind = t.kind === 'dn' ? 'down' : t.kind;
    return { piece: kind === 'sq' ? 'sq' : 'tri', way: kind === 'sq' ? null : kind, col: t.col, y: [t.y0[0], t.y0[1]] };
  }
  if (t && t.y0 && 'kind' in t) {
    const { A, B, D } = t.y0;
    if (typeof A !== 'bigint' || typeof B !== 'bigint' || typeof D !== 'bigint' || D <= 0n || (2n * A) % D !== 0n || (2n * B) % D !== 0n) return null;
    const kind = t.kind === 'dn' ? 'down' : t.kind;
    return { piece: kind === 'sq' ? 'sq' : 'tri', way: kind === 'sq' ? null : kind, col: t.col, y: [Number(2n * A / D), Number(2n * B / D)] };
  }
  if (t && 't' in t && 'c' in t && 'a' in t) return { piece: t.t === 'sq' ? 'sq' : 'tri', way: t.t === 'sq' ? null : t.t === 'up' ? 'up' : 'down', col: t.c, y: [2 * t.a, t.b] };
  return null;
}
function relevantTiles(h, col) {
  const T = h && h.tiles;
  if (!Array.isArray(T)) return null;
  let info = RELEVANT.get(h);
  if (info === undefined) {
    const G = T.map(tileForm);
    if (G.some(g => !g || !Number.isInteger(g.col))) info = null;
    else {
      const polys = G.map(g => geom.shape(g.piece, g.way, g.col, g.y)), below = G.map(() => []), above = G.map(() => []);
      for (let u = 0; u < G.length; u++) for (let v = 0; v < G.length; v++) if (u !== v && geom.restsOnPoly(polys[u], polys[v])) { below[u].push(v); above[v].push(u); }
      info = { G, below, above, byCol: new Map() };
    }
    RELEVANT.set(h, info);
  }
  if (!info) return null;
  let set = info.byCol.get(col);
  if (set) return set;
  set = new Set();
  const { G, below, above } = info, close = (start, next) => { const st = [...start]; while (st.length) for (const j of next[st.pop()]) if (!set.has(j)) { set.add(j); st.push(j); } };
  G.forEach((g, i) => { if (g.col >= col - 2 && g.col <= col + 2) set.add(i); });
  close([...set], below);
  close([...set], above);
  for (const i of [...set]) for (const j of below[i]) set.add(j);
  info.byCol.set(col, set);
  return set;
}
// The oracle's own tiles that a drop at col can depend on (relevantTiles) as a cache key; null when the build's
// tiles are of an unknown form (then nothing is cached).
function localKey(h, piece, col, way) {
  const T = h && h.tiles;
  if (!Array.isArray(T) || typeof col !== 'number' || !Number.isInteger(col)) return null;
  const rel = relevantTiles(h, col);
  if (!rel) return null;
  const parts = [];
  for (let i = 0; i < T.length; i++) {
    const t = T[i];
    let c, s;
    if (t && 'kind' in t && Array.isArray(t.y0)) { if (!isPQ(t.y0)) return null; c = t.col; s = t.kind + c + ':' + t.y0[0] + ',' + t.y0[1]; }
    else if (t && t.y0 && 'kind' in t) { c = t.col; s = t.kind + c + ':' + t.y0.A + ',' + t.y0.B + ',' + t.y0.D; }
    else if (t && 't' in t && 'c' in t && 'a' in t) { c = t.c; s = t.t + c + ':' + t.a + ',' + t.b; }
    else return null;
    if (rel.has(i)) parts.push(s);
  }
  parts.sort();
  return h.half + '|' + piece + '|' + (way === undefined ? '' : String(way)) + '|' + col + '|' + parts.join(' ');
}
// The same key, compact (the cache holds millions): two UTF-16 units per tile (kind and col offset −32 … 31; height
// as p·256 + q, y = (p + q√3)/2), after a prefix for half, piece, way and col. Exactly as discriminating as localKey:
// it falls back to localKey's text (marked apart) whenever a value is outside the compact ranges.
const KIND = { sq: 0, up: 1, down: 2, dn: 2 }, WAYC = { sq: 0, up: 1, down: 2, '': 3 };
function compactKey(h, piece, col, way) {
  const T = h && h.tiles, half = h && h.half;
  if (!Array.isArray(T) || typeof col !== 'number' || !Number.isInteger(col) || Math.abs(col) > 1000 || !Number.isInteger(half) || half < 1 || half > 1000) return null;
  const pw = piece === 'sq' && way === undefined ? 0 : piece === 'tri' ? WAYC[way === undefined ? '' : way] : undefined;
  const long = () => { const k = localKey(h, piece, col, way); return k === null ? null : '\u0002' + k; };
  if (pw === undefined) return long();
  const rel = relevantTiles(h, col);
  if (!rel) return null;
  const parts = [];
  for (let i = 0; i < T.length; i++) {
    const t = T[i];
    let c, k, p, q;
    if (t && 'kind' in t && Array.isArray(t.y0)) {
      if (!isPQ(t.y0)) return long();
      c = t.col; k = KIND[t.kind]; p = t.y0[0]; q = t.y0[1];
    } else if (t && t.y0 && 'kind' in t) {
      c = t.col; k = KIND[t.kind];
      const { A, B, D } = t.y0;
      if (typeof A !== 'bigint' || typeof B !== 'bigint' || typeof D !== 'bigint' || D <= 0n || (2n * A) % D !== 0n || (2n * B) % D !== 0n) return long();
      p = Number(2n * A / D); q = Number(2n * B / D);
    } else if (t && 't' in t && 'c' in t && 'a' in t) { c = t.c; k = KIND[t.t]; p = 2 * t.a; q = t.b; }
    else return null;
    if (!Number.isInteger(c)) return long();
    if (!rel.has(i)) continue;
    if (k === undefined || c - col < -32 || c - col > 31 || !(p >= 0 && p < 256 && q >= 0 && q < 256 && Number.isInteger(p) && Number.isInteger(q))) return long();
    parts.push(String.fromCharCode(0x100 + k * 64 + (c - col + 32), p * 256 + q));
  }
  parts.sort();
  return '\u0001' + String.fromCharCode(half, pw, col + 1000) + parts.join('');
}
// a hook is {name, root(half) -> handle, child(handle, {piece, col, way}) -> handle,
//   drop(handle, piece, col, way, verify) -> {s: strict string, o?: result} | {hs: hash of the strict string} |
//   {threw: message}, plus unsound when a verified cache hit differs from a fresh drop; fresh(handle, piece, col, way)}
// The I1 cache maps a drop's compact key (the tiles it can depend on, relevantTiles) to a 30-bit hash of the oracle's
// strict string (or the throw message);
// a hit is checked by hash, and every 16th hit (every hit to depth 3) is verified against a fresh oracle drop
// (I1CACHE). Placing (child) keeps its own small cache of whole strings, since place needs the oracle's result.
function hookFromModule(spec, hopts) {
  let O, cacheOn = !(hopts && hopts.cache === false);
  if (spec === 'rules') O = rulesVm.load(); // a second copy of rules.js: tests the plumbing (always agrees)
  else if (spec.startsWith('mutant:')) { // a mutant of rules.js as the "oracle": shows that I1 catches a disagreement
    const M = require('./mutants.cjs'), m = M.list().find(x => x.name === spec.slice(7));
    O = rulesVm.load({ from: { source: M.patch(fs.readFileSync(rulesVm.RULES_JS, 'utf8'), m), file: spec } });
    cacheOn = false; // a mutant need not be local
  } else O = require(path.resolve(spec));
  const exact = !(spec === 'rules' || spec.startsWith('mutant:'));
  const cache = new Map(), CAP = (hopts && hopts.cacheCap) || 8000000;
  const placeCache = new Map(), PCAP = 300000;
  const stats = { hits: 0, misses: 0, verified: 0, unsound: 0 };
  function fresh(h, piece, col, way) {
    // a second copy of rules.js (or a mutant) gives tips in the game's form: map them to SPEC §8's with its own tiles
    try { const o = O.drop(h, piece, col, way); return { s: strictStr(exact ? o : canon.spec(o, O.tiles(h)), exact), o }; }
    catch (e) { return { threw: String(e && e.message) }; }
  }
  // cached value: the throw message (a string) or the hash of the strict string (a number)
  const enc = x => (x.threw !== undefined ? x.threw : valueHash(x.s));
  function drop(h, piece, col, way, verify) {
    const k = cacheOn ? compactKey(h, piece, col, way) : null;
    if (k === null) return fresh(h, piece, col, way);
    const c = cache.get(k);
    if (c !== undefined) {
      stats.hits++;
      if (!verify) return typeof c === 'string' ? { threw: c } : { hs: c };
      stats.verified++;
      const x = fresh(h, piece, col, way);
      if (enc(x) !== c) { stats.unsound++; x.unsound = typeof c === 'string' ? 'throws: ' + c : 'hash ' + c; }
      return x;
    }
    stats.misses++;
    const x = fresh(h, piece, col, way);
    if (cache.size >= CAP) cache.delete(cache.keys().next().value);
    cache.set(k, enc(x));
    return x;
  }
  return {
    name: spec, stats,
    root: half => O.newBuild({ half }),
    // the oracle's own build, one more tile: its own result for that drop, placed (whole strings cached by local key)
    child: (h, e) => {
      const way = e.piece === 'sq' ? undefined : e.way, k = cacheOn ? compactKey(h, e.piece, e.col, way) : null;
      let x = k === null ? undefined : placeCache.get(k);
      if (x === undefined) {
        x = fresh(h, e.piece, e.col, way);
        x = x.threw !== undefined ? '!' + x.threw : x.s;
        if (k !== null) { if (placeCache.size >= PCAP) placeCache.delete(placeCache.keys().next().value); placeCache.set(k, x); }
      }
      if (x[0] === '!') throw new Error('the oracle throws on ' + canon.fmtDrop(e) + ': ' + x.slice(1));
      const p = JSON.parse(x);
      const r = p.keys || !exact ? O.drop(h, e.piece, e.col, way) : p;
      return O.place(h, r);
    },
    drop, fresh
  };
}

// ---- which oracle ----
// The I1 oracle by default: tools/oracle/oracle.cjs, but only if it answers SPEC 5c (golden 1, ■1 then ▲1.5, fits;
// golden 16, ▲−1 ▼−0.5 then ■0, tips over; and its results have SPEC 5c's eight fields, tips among them). Returns
// {path, why}; path is null when there is no 5c oracle to compare with.
const ORACLE = path.join(__dirname, '..', 'oracle', 'oracle.cjs');
function defaultOracle() {
  if (!fs.existsSync(ORACLE)) return { path: null, why: 'no tools/oracle/oracle.cjs' };
  try {
    const O = require(ORACLE);
    let b = O.newBuild({ half: 2 });
    b = O.place(b, O.drop(b, 'sq', 2));
    const r = O.drop(b, 'tri', 3, 'up');
    const ks = Object.keys(r).sort().join();
    let c = O.newBuild({ half: 2 });
    c = O.place(c, O.drop(c, 'tri', -2, 'up'));
    c = O.place(c, O.drop(c, 'tri', -1, 'down'));
    const t = O.drop(c, 'sq', 0);
    if (r.outcome !== 'fit' || ks !== canon.FIELDS.slice().sort().join() || t.reason !== 'TIPS OVER') return { path: null, why: `tools/oracle/oracle.cjs is not a SPEC 5c oracle (golden 1 gives ${r.outcome} ${r.reason || ''} with fields ${ks}; golden 16 gives ${t.outcome} ${t.reason || ''}); I1 needs a 5c oracle` };
    return { path: ORACLE, why: 'tools/oracle/oracle.cjs answers SPEC 5c' };
  } catch (e) { return { path: null, why: 'tools/oracle/oracle.cjs fails the 5c probe: ' + e.message }; }
}

// ---- the walk ----
function loadRules(o) { return o.source ? rulesVm.load({ from: { source: o.source, file: o.file || 'rules (mutant)' } }) : rulesVm.load(); }

// items: [{ck, rkh}]; returns {st, kids: [[ck, rkh], ...] (deduplicated within the chunk), failFast?}
function processChunk(R, visit, items, opts, hook) {
  const st = newStats(), kids = new Map();
  const s0 = hook ? Object.assign({}, hook.stats) : null;
  const handles = new Map(), od = opts.oracleDepth === undefined || opts.oracleDepth === null ? Infinity : opts.oracleDepth;
  const handleFor = log => {
    const k = log.map(canon.fmtDrop).join(' ');
    let h = handles.get(k);
    if (h !== undefined) return h;
    h = log.length ? hook.child(handleFor(log.slice(0, -1)), log[log.length - 1]) : hook.root(opts.half);
    if (handles.size >= 4000) handles.delete(handles.keys().next().value);
    handles.set(k, h);
    return h;
  };
  const failI4 = (msg, log) => { st.checks.I4++; st.failCount.I4++; if (st.fails.length < 60) st.fails.push({ inv: 'I4', msg, log }); };
  try {
    for (const it of items) {
      const T = tilesOfStr(it.ck);
      let made, mmade;
      // I4: the build rebuilds from its tiles alone, lowest first (and so does its mirror image)
      try { made = rebuild(R, opts.half, T); mmade = rebuild(R, opts.half, T.map(mirrorTile)); st.checks.I4 += 2; if (made.reordered || mmade.reordered) st.reordered++; }
      catch (e) { failI4('the build does not rebuild from its tiles in any order: ' + e.message, T.map(canon.fmtDrop).join(' ')); if (opts.failFast) return { st, kids: [], failFast: 'I4' }; continue; }
      const log = made.log;
      let oh = null;
      if (hook && log.length <= od) {
        try { oh = handleFor(log); }
        catch (e) {
          oh = null; st.checks.I1++; st.failCount.I1++;
          addI1(st, 'the oracle cannot build what the game built', { log: log.map(canon.fmtDrop), drop: null, diff: String(e.message).slice(0, 200) });
          if (st.fails.length < 60) st.fails.push({ inv: 'I1', msg: 'the oracle cannot build what the game built: ' + String(e.message).slice(0, 120), log: log.map(canon.fmtDrop).join(' ') });
          if (opts.failFast) return { st, kids: [], failFast: 'I1' };
        }
      }
      const ch = visit({ B: made.B, MB: mmade.B, log, depth: log.length, oh, ck: it.ck, rkh: it.rkh }, st);
      for (const c of ch) {
        const prev = kids.get(c.ck);
        if (prev === undefined) kids.set(c.ck, c.rkh);
        else { st.checks.I4++; if (prev !== c.rkh) failI4('the same tiles reached in another order give another key()', log.map(canon.fmtDrop).join(' ') + ' + ' + canon.fmtDrop(c.t)); }
      }
    }
  } catch (e) {
    if (!e.failFast && !opts.failFast) throw e;
    if (!e.failFast) { st.failCount.THROWS++; st.fails.push({ inv: 'THROWS', msg: 'crashed: ' + String(e.stack || e.message).slice(0, 300) }); }
    return { st, kids: [...kids], failFast: e.message };
  } finally {
    if (hook) for (const k in s0) st.oracleCache[k] += hook.stats[k] - s0[k];
  }
  return { st, kids: [...kids] };
}

// ---- checkpoints ----
// A long run (depth 10 with the oracle takes hours) can be resumed after the machine restarts: with
// opts.checkpoint = dir, each finished chunk's result and, at the end of each depth, the merged stats and the next
// frontier are written there; with opts.resume, a run whose settings, rules.js and oracle are the same starts from
// what is there (the chunks of a depth are the same slices of the same frontier, so a saved chunk stands for its
// slice). Without opts.resume an old checkpoint is discarded. The directory is removed when the run finishes.
// what a saved chunk or state means: bump it whenever a change to this file changes what a chunk computes (a change
// that only makes it faster, such as heap sizes, leaves it)
const CHECKPOINT_FORMAT = 'rev5c-1';
function makeCheckpoint(opts, srcText) {
  const dir = opts.checkpoint, crypto = require('crypto');
  const sha = t => crypto.createHash('sha256').update(t).digest('hex');
  const sig = JSON.stringify({
    depth: opts.depth, half: opts.half, workers: opts.workers, fullTo: opts.fullTo, sampleHeavy: opts.sampleHeavy, failFast: !!opts.failFast,
    only: opts.only || null, oracleDepth: opts.oracleDepth === undefined ? null : opts.oracleDepth, cache: opts.cache !== false, cacheCap: opts.cacheCap || null,
    outline: opts.outline !== false, rules: sha(srcText),
    compare: opts.compare || null, oracle: opts.compare && fs.existsSync(path.resolve(opts.compare)) ? sha(fs.readFileSync(path.resolve(opts.compare))) : null,
    enumerate: CHECKPOINT_FORMAT
  });
  const stateFile = path.join(dir, 'state.json'), frontFile = path.join(dir, 'frontier.txt');
  const chunkFile = (d, i) => path.join(dir, `chunk-${d}-${i}.json`);
  const clear = () => fs.rmSync(dir, { recursive: true, force: true });
  if (!opts.resume) clear();
  fs.mkdirSync(dir, { recursive: true });
  function atomic(file, text) { fs.writeFileSync(file + '.tmp', text); fs.renameSync(file + '.tmp', file); }
  return {
    load() {
      if (!fs.existsSync(stateFile)) return null;
      const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      if (s.sig !== sig) { clear(); fs.mkdirSync(dir, { recursive: true }); return null; }
      const frontier = [];
      for (const ln of fs.readFileSync(frontFile, 'utf8').split('\n')) {
        if (!ln) continue;
        const i = ln.lastIndexOf(' ');
        frontier.push({ ck: JSON.parse(ln.slice(0, i)), rkh: +ln.slice(i + 1) });
      }
      if (frontier.length !== s.frontierLength) throw new Error('checkpoint: the frontier file is incomplete');
      return { d: s.d, stats: s.stats, perDepth: s.perDepth, elapsed: s.elapsed, frontier };
    },
    chunk(d, i) {
      const f = chunkFile(d, i);
      if (!fs.existsSync(f)) return null;
      try { const c = JSON.parse(fs.readFileSync(f, 'utf8')); return c.sig === sig ? c.r : null; } catch (e) { return null; }
    },
    saveChunk(d, i, r) { atomic(chunkFile(d, i), JSON.stringify({ sig, r })); },
    // after depth d: the merged stats and the frontier of depth d + 1
    saveDepth(d, stats, perDepth, elapsed, next) {
      const fd = fs.openSync(frontFile + '.tmp', 'w');
      let buf = [];
      for (const [ck, rkh] of next) { buf.push(JSON.stringify(ck) + ' ' + rkh); if (buf.length >= 100000) { fs.writeSync(fd, buf.join('\n') + '\n'); buf = []; } }
      if (buf.length) fs.writeSync(fd, buf.join('\n') + '\n');
      fs.closeSync(fd);
      fs.renameSync(frontFile + '.tmp', frontFile);
      atomic(stateFile, JSON.stringify({ sig, d, stats, perDepth, elapsed, frontierLength: next.size }));
      for (const f of fs.readdirSync(dir)) if (f.startsWith(`chunk-${d}-`)) fs.rmSync(path.join(dir, f), { force: true });
    },
    clear
  };
}

// in-process or with worker threads; returns {stats, perDepth, ms, resumed}
async function enumerate(opts) {
  opts = Object.assign({ depth: 10, half: 2, workers: 0, fullTo: 6, sampleHeavy: 8 }, opts || {});
  if (opts.half > 3) throw new Error('enumerate: the compact build codes take half ≤ 3');
  const t0 = Date.now();
  const R = loadRules(opts);
  const hook = opts.compare ? hookFromModule(opts.compare, opts) : null;
  const visit = makeVisitor(R, Object.assign({}, opts, { compare: hook }));
  let stats = newStats();
  let frontier = [{ ck: '', rkh: hash53(R.key(R.newBuild({ half: opts.half }))) }];
  let perDepth = [], d0 = 0, elapsed0 = 0, resumed = null;
  const ckpt = opts.checkpoint ? makeCheckpoint(opts, opts.source || fs.readFileSync(rulesVm.RULES_JS, 'utf8')) : null;
  if (ckpt) {
    const s = ckpt.load();
    if (s) {
      stats = s.stats; perDepth = s.perDepth; frontier = s.frontier; d0 = s.d + 1; elapsed0 = s.elapsed;
      resumed = { fromDepth: d0, elapsedBefore: s.elapsed };
      if (opts.onDepth) for (const p of perDepth) opts.onDepth(p, stats, true);
    }
  }
  let pool = null;
  if (opts.workers > 0) pool = makePool(opts);
  const ostats = () => Object.assign({ drops: stats.oracleDrops }, stats.oracleCache);
  try {
    for (let d = d0; d <= opts.depth; d++) {
      const td = Date.now(), o0 = ostats();
      let results, reused = 0;
      if (pool && frontier.length > 200) {
        // 24 chunks a worker, and no chunk over 16,000 builds (so a run cut short loses little; a checkpoint keeps
        // finished chunks)
        const n = Math.min(frontier.length, Math.max(pool.size * 24, Math.ceil(frontier.length / 16000))), size = Math.ceil(frontier.length / n), chunks = [];
        for (let i = 0; i < frontier.length; i += size) chunks.push(frontier.slice(i, i + size));
        results = await Promise.all(chunks.map((c, i) => {
          const saved = ckpt && ckpt.chunk(d, i);
          if (saved) { reused++; return saved; }
          return pool.run({ items: c }).then(r => { if (ckpt && !r.failFast) ckpt.saveChunk(d, i, r); return r; });
        }));
      } else {
        results = [processChunk(R, visit, frontier, opts, hook)];
      }
      frontier = null;
      // the next depth: children deduplicated by key; the same tiles must give the same key() (I4), and different
      // tiles different keys (a 53-bit hash of key(); a clash is re-checked in full)
      const next = new Map(), byRk = new Map();
      let i4n = 0, i4f = 0;
      for (const r of results) {
        if (r.failFast) stats.failFast = r.failFast;
        mergeStats(stats, r.st);
        for (const [ck, rkh] of r.kids) {
          const prev = next.get(ck);
          if (prev !== undefined) {
            i4n++;
            if (prev !== rkh && !(opts.only && !opts.only.includes('I4'))) { i4f++; if (stats.fails.length < 200) stats.fails.push({ inv: 'I4', msg: 'the same tiles reached from two builds give another key()', a: tilesOfStr(ck).map(canon.fmtDrop).join(' ') }); }
            continue;
          }
          next.set(ck, rkh);
          const other = byRk.get(rkh);
          i4n++;
          if (other !== undefined && !(opts.only && !opts.only.includes('I4'))) {
            // re-check in full: are the two keys really equal?
            const k1 = R.key(rebuild(R, opts.half, tilesOfStr(ck)).B), k2 = R.key(rebuild(R, opts.half, tilesOfStr(other)).B);
            const m1 = R.key(rebuild(R, opts.half, tilesOfStr(ck).map(mirrorTile)).B), m2 = R.key(rebuild(R, opts.half, tilesOfStr(other).map(mirrorTile)).B);
            if (k1 === k2 || k1 === m2 || m1 === k2) { i4f++; if (stats.fails.length < 200) stats.fails.push({ inv: 'I4', msg: 'key() gives two different builds the same key', a: k1 }); }
          } else byRk.set(rkh, ck);
        }
        r.kids = null;
      }
      results = null;
      stats.checks.I4 += i4n; stats.failCount.I4 += i4f;
      const o1 = ostats(), od = {};
      for (const k in o1) od[k] = o1[k] - o0[k];
      perDepth.push({ depth: d, builds: stats.builds[d] || 0, ms: Date.now() - td, oracle: hook ? od : null, chunksReused: reused });
      if (opts.onDepth) opts.onDepth(perDepth[perDepth.length - 1], stats);
      if (stats.failFast || (opts.failFast && Object.values(stats.failCount).some(x => x))) { stats.failFast = stats.failFast || 'failure'; break; }
      if (d === opts.depth) break;
      if (ckpt) ckpt.saveDepth(d, stats, perDepth, elapsed0 + Date.now() - t0, next);
      frontier = [];
      for (const [ck, rkh] of next) frontier.push({ ck, rkh });
    }
  } finally { if (pool) await pool.close(); }
  if (ckpt && !stats.failFast) ckpt.clear();
  return { stats, perDepth, ms: elapsed0 + Date.now() - t0, resumed };
}

function makePool(opts) {
  const size = opts.workers;
  const ws = [], idle = [], queue = [];
  for (let i = 0; i < size; i++) {
    const w = new Worker(__filename, { workerData: { opts: { depth: opts.depth, half: opts.half, fullTo: opts.fullTo, sampleHeavy: opts.sampleHeavy, failFast: opts.failFast, compare: opts.compare, only: opts.only, oracleDepth: opts.oracleDepth, cache: opts.cache, cacheCap: opts.cacheCap, source: opts.source, file: opts.file, outline: opts.outline } }, resourceLimits: { maxOldGenerationSizeMb: 3072, maxYoungGenerationSizeMb: 192 } });
    w.unref();
    ws.push(w); idle.push(w);
  }
  function pump() {
    while (idle.length && queue.length) {
      const w = idle.pop(), job = queue.shift();
      const onMsg = m => { w.off('message', onMsg); w.off('error', onErr); idle.push(w); job.resolve(m); pump(); };
      const onErr = e => { w.off('message', onMsg); w.off('error', onErr); job.reject(e); };
      w.on('message', onMsg); w.on('error', onErr);
      w.postMessage(job.msg);
    }
  }
  return {
    size,
    run: msg => new Promise((resolve, reject) => { queue.push({ msg, resolve, reject }); pump(); }),
    close: async () => { await Promise.all(ws.map(w => w.terminate())); }
  };
}

if (!isMainThread && workerData && workerData.opts) {
  const opts = workerData.opts;
  const R = loadRules(opts);
  const hook = opts.compare ? hookFromModule(opts.compare, opts) : null;
  const visit = makeVisitor(R, Object.assign({}, opts, { compare: hook }));
  parentPort.on('message', m => { parentPort.postMessage(processChunk(R, visit, m.items, opts, hook)); });
}

// ---- reports ----
const POSSIBLE = [
  ['fit', 'sq', '-', 'FIT'], ['off', 'sq', '-', 'ONLY A POINT'], ['off', 'sq', '-', 'TIPS OVER'],
  ['fit', 'tri', 'up', 'FIT'], ['off', 'tri', 'up', 'ONLY A POINT'], ['off', 'tri', 'up', 'TIPS OVER'],
  ['fit', 'tri', 'down', 'FIT'], ['off', 'tri', 'down', 'ONLY A POINT'], ['off', 'tri', 'down', 'TIPS OVER']
];
function coverageTable(stats) {
  return POSSIBLE.map(([o, p, w, r]) => {
    const k = `${o}|${p}|${w}|${r}`;
    return { outcome: o, piece: p, way: w, reason: r, forced: stats.cover[k + '|forced'] || 0, auto: stats.cover[k + '|auto'] || 0 };
  });
}
function floors(stats) {
  const out = [];
  for (const row of coverageTable(stats)) out.push({ what: `${row.outcome} ${row.piece} ${row.way} ${row.reason}`, n: row.forced, min: 100 });
  for (const pc of ['■', '▲']) for (const h of ['half an edge', 'a whole edge, on one top', 'a whole edge, across two tops']) out.push({ what: `${pc} held by ${h}`, n: stats.holds[pc + ' ' + h] || 0, min: 100 });
  out.push({ what: 'notch ▼ fits', n: stats.notchDown, min: 1000 });
  out.push({ what: 'one-sided ▼ fits', n: stats.oneSideDown, min: 10000 });
  out.push({ what: 'thin gap 0.134 under a staying tile', n: stats.thin['0.134'] || 0, min: 100 });
  out.push({ what: 'thin gap 0.268 under a staying tile', n: stats.thin['0.268'] || 0, min: 100 });
  return out;
}
// TIPS OVER (forced ways), per piece and way: by side, by number of tiles in the part, by where its base is
function tipsTable(stats) {
  const t = stats.tips || {}, out = {};
  for (const pc of ['■', '▲', '▼']) {
    // the new tile's own part never tips (it rests on its own support, which always reaches its middle): listed at 0
    const row = { all: t[pc] || 0, side: {}, members: {}, base: { "the new tile's own part": 0, 'a part it rests on': 0, 'a part lower down': 0 } };
    for (const k in t) {
      if (!k.startsWith(pc + ' ')) continue;
      const rest = k.slice(pc.length + 1);
      if (rest === 'left' || rest === 'right') row.side[rest] = t[k];
      else if (/^\d+ tiles$/.test(rest)) row.members[rest] = t[k];
      else row.base[rest] = t[k];
    }
    out[pc] = row;
  }
  out.neitherWayFits = Object.fromEntries(Object.entries(t).filter(([k]) => k.startsWith('neither way fits')).map(([k, v]) => [k.replace('neither way fits: ', ''), v]));
  out.locality = Object.fromEntries(Object.entries(t).filter(([k]) => k.startsWith('I7:')).map(([k, v]) => [k.slice(4), v]));
  return out;
}
function i1Classes(s) {
  return Object.entries(s.i1).map(([label, c]) => ({ label, n: c.n, open: c.open, examples: c.ex })).sort((a, b) => b.n - a.n);
}
function writeReports(dir, res, opts) {
  fs.mkdirSync(dir, { recursive: true });
  const s = res.stats;
  const totalBuilds = Object.values(s.builds).reduce((a, b) => a + b, 0);
  const summary = {
    rules: 'revision 5c', depth: opts.depth, half: opts.half, ms: res.ms, builds: totalBuilds, buildsPerDepth: s.builds, drops: s.drops, perDepth: res.perDepth,
    checks: s.checks, failCount: s.failCount, fails: s.fails.slice(0, 50), failFast: s.failFast || null,
    thin: s.thin, gaps: s.gaps, holds: s.holds, notchDown: s.notchDown, oneSideDown: s.oneSideDown, pointFlat: s.pointFlat, pointAir: s.pointAir,
    bothWays: { builds: s.bothWays, cols: s.bothWaysCols, ofTriangleCols: s.triCols },
    noSquare: s.noSquare, noTriangle: s.noTriangle, noFit: s.noFit, fitsPerBuild: s.fitsPerBuild, byDepth: s.byDepth, floors: floors(s),
    tips: tipsTable(s), leaning: s.leaning, reordered: s.reordered,
    extremes: Object.fromEntries(['largest lean that stays (lean ÷ grip)', 'most tiles in a part leaning within its grip', 'tallest structure standing on a ▼ held by one side (its height above the ▼\'s top, tiles)', 'most tiles standing on a ▼ held by one side', 'farthest overhang (a tile\'s middle past where its supports meet the car, tiles)'].filter(k => s.ext[k]).map(k => [k, s.ext[k]])),
    nothingFits: (s.examples['nothing fits'] || []).slice(0, 4),
    outlineClasses: Object.keys(s.outline).length, compare: opts.compare || null,
    oracleDepth: opts.compare ? (opts.oracleDepth === undefined || opts.oracleDepth === null ? opts.depth : Math.min(opts.depth, opts.oracleDepth)) : null,
    oracleDrops: s.oracleDrops, oracleCache: s.oracleCache, i1: i1Classes(s)
  };
  fs.writeFileSync(path.join(dir, 'stats.json'), JSON.stringify(summary, null, 1));
  if (opts.compare) fs.writeFileSync(path.join(dir, 'i1.json'), JSON.stringify({ compare: opts.compare, oracleDepth: summary.oracleDepth, checks: s.checks.I1, failed: s.failCount.I1, oracleDrops: s.oracleDrops, cache: s.oracleCache, classes: summary.i1, open: OPEN.map(o => ({ id: o.id, what: o.what })) }, null, 1));
  fs.writeFileSync(path.join(dir, 'coverage.json'), JSON.stringify({ table: coverageTable(s), tips: tipsTable(s), raw: s.cover, floors: floors(s), thin: s.thin, gaps: s.gaps, holds: s.holds, notchDown: s.notchDown, oneSideDown: s.oneSideDown, pointFlat: s.pointFlat, pointAir: s.pointAir, bothWays: summary.bothWays, noSquare: s.noSquare, noTriangle: s.noTriangle }, null, 1));
  fs.writeFileSync(path.join(dir, 'extremes.json'), JSON.stringify({ extremes: s.ext, examples: s.examples }, null, 1));
  fs.writeFileSync(path.join(dir, 'minimal-pairs.json'), JSON.stringify({ neighbouringCols: s.pairsCol, oneTileAdded: s.pairsTile }, null, 1));
  return summary;
}

module.exports = { enumerate, writeReports, defaultOracle, ORACLE, coverageTable, floors, tipsTable, colsOf, formsOf, tilesOfStr, rebuild, dropOrder, standing, supports, makeVisitor, newStats, INVS, OPEN, OUT_DEFAULT, strictStr, localKey, hookFromModule };

if (isMainThread && require.main === module) {
  const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
  const cmp = arg('compare', null);
  const opts = {
    depth: +arg('depth', 10), half: 2, workers: +arg('workers', Math.min(4, os.cpus().length)),
    compare: cmp === 'none' ? null : cmp, failFast: process.argv.includes('--fail-fast'), fullTo: +arg('full-to', 6), sampleHeavy: +arg('sample', 8),
    oracleDepth: arg('oracle-depth', null) === null ? null : +arg('oracle-depth', null), cache: !process.argv.includes('--no-cache'),
    cacheCap: arg('cache-cap', null) === null ? undefined : +arg('cache-cap', null),
    checkpoint: arg('checkpoint', null), resume: process.argv.includes('--resume')
  };
  const out = arg('out', OUT_DEFAULT);
  enumerate(Object.assign({}, opts, { onDepth: (p, s, restored) => console.log(`depth ${p.depth}: ${p.builds} builds, ${(p.ms / 1000).toFixed(1)} s${p.oracle ? '; oracle ' + JSON.stringify(p.oracle) : ''}${restored ? ' [from the checkpoint]' : p.chunksReused ? ' [' + p.chunksReused + ' chunks from the checkpoint]' : ''}`) })).then(res => {
    const sum = writeReports(out, res, opts);
    const bad = Object.entries(sum.failCount).filter(([, n]) => n);
    console.log(`${sum.builds} builds, ${sum.drops} drops in ${(res.ms / 1000).toFixed(1)} s; reports in ${out}`);
    for (const k of INVS) if (sum.checks[k] || sum.failCount[k]) console.log(`${sum.failCount[k] ? 'FAIL' : 'PASS'} ${k}: ${sum.checks[k]} checks${sum.failCount[k] ? ', ' + sum.failCount[k] + ' failed' : ''}`);
    for (const f of sum.fails.slice(0, 10)) console.log('  ' + JSON.stringify(f));
    if (opts.compare) {
      console.log(`I1 to depth ${sum.oracleDepth}: ${sum.oracleDrops} oracle drops; cache ${JSON.stringify(sum.oracleCache)}; ${sum.i1.length} disagreement class(es)`);
      for (const c of sum.i1) console.log(`  ${c.open ? 'OPEN ' + c.open : 'DIFF'} ${c.n}× ${c.label}; e.g. ${c.examples[0].log.join(' ')} then ${JSON.stringify(c.examples[0].drop)}`);
    }
    for (const f of sum.floors) console.log(`${f.n >= f.min ? 'PASS' : 'FAIL'} floor ${f.what}: ${f.n} (min ${f.min})`);
    console.log(`both ways fit: ${sum.bothWays.cols} of ${sum.bothWays.ofTriangleCols} triangle columns (${sum.bothWays.builds} builds); no square fits on ${sum.noSquare} builds, no triangle on ${sum.noTriangle}`);
    process.exit(bad.length ? 1 : 0);
  }).catch(e => { console.error(e); process.exit(2); });
}
