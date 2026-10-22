'use strict';
// Exhaustive enumeration (DESIGN §18.8, the rules tier): every build reachable by fitting drops on the real base,
// mirror images merged, to a given depth (default 10). At every build, every piece × way × col is dropped (squares;
// triangles forced up, forced down, and with no way given), and the invariants that need no oracle are checked:
//   I2 fitsAll equals drop          I3 drop is pure                  I4 tile order makes no difference
//   I5 mirror symmetry              I6 translation on a wide base    I7 locality
//   I8 replaying the log rebuilds   I9 re-dropping a top tile        I10 the state is sound
//   I11 at most one way up fits     I12 pull obeys §18.6             I13 the shine explains the outcome
// plus the prototype's claims (§18.2): a fitted ▼'s point rests on a flat top; some triangle fits on every build; the
// outcome depends only on the top outline and the over-air strips (OUTLINE). I1 (the game equals the oracle) is the
// pluggable compare hook: --compare=<module exporting {newBuild, drop, place}> (tools/oracle/oracle.cjs), or
// --compare=rules (a second copy of rules.js, to test the plumbing), or --compare=mutant:<name>.
//
// I1 compares every drop at every build (squares, ▲ and ▼ forced, and no way given) on SPEC §8's eight fields, field
// by field and exactly as each side returns them (no re-sorting: §8 fixes the order). The oracle builds its own copy of
// every build through its own place(). Disagreements are grouped into classes by pattern (mode, both outcomes and
// reasons, the fields that differ), each with its shallowest examples. --oracle-depth=N compares only to depth N.
// Speed: an oracle drop costs about 1 ms (exact BigInt geometry), so its results are cached per worker by the drop and
// the oracle's own tiles within two cols of it (with their recorded strips), which is all an oracle drop can depend on
// (it only looks at tiles whose x-range meets the dropped tile's). The cache is checked by recomputing a sample of
// its hits without it (I1CACHE). The oracle's builds are made once per parent within a chunk of siblings.
// Coverage, near misses, extremes and minimal pairs are written as JSON.
//
//   node tools/rules/enumerate.cjs [--depth=10] [--workers=4] [--compare=path] [--oracle-depth=N] [--out=dir] [--fail-fast]
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const canon = require('../lib/canon.cjs');
const geom = require('./geom.cjs');
const rulesVm = require('../lib/rules-vm.cjs');

const OUT_DEFAULT = '/tmp/claude-0/-home-user-various/eea7fc80-8598-5a7a-a3e6-cdbd34e6e76d/scratchpad/rev5/enum';
const INVS = ['I1', 'I1CACHE', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'I9', 'I10', 'I11', 'I12', 'I13', 'FORMAT', 'POINT', 'SOME_TRI', 'OUTLINE', 'AUTO', 'THROWS'];
// Disagreement classes already triaged as open questions for the designer (SPEC.md does not decide them). They are
// still counted and reported on every run, as OPEN, but do not fail I1. Each entry: the class's id, a test on a
// class label, and the question.
const OPEN = [
  // only the class as triaged: the game evaluates the col and the tile falls off, the oracle throws. A game fit (or a
  // game throw against an oracle result) outside §2's cols is a new class and fails I1.
  { id: 'A1', test: k => k.startsWith('outside §2 cols:') && /: game returns [▲▼] off [A-Z ]+ \/ oracle throws$/.test(k),
    what: 'SPEC §2 ("Allowed cols ... throw outside them": triangles −2·half−1 … 2·half−1) contradicts SPEC §9 golden 5 (▼2 is col 4 and expects off, TOO FAR OUT). The oracle throws there; rules.js evaluates any col with something below.' }
];
const openOf = k => OPEN.find(o => o.test(k)) || null;
const NEAR = { '2,-1': '0.134', '4,-2': '0.268' };

// the hand's cols (SPEC §2), from the spec, not from the rules under test
function colsOf(half, piece) {
  const out = [];
  if (piece === 'sq') for (let c = -2 * half; c <= 2 * half - 2; c += 2) out.push(c);
  else for (let c = -2 * half - 1; c <= 2 * half - 1; c++) out.push(c);
  return out;
}
const MODES = [['sq', undefined], ['tri', 'up'], ['tri', 'down'], ['tri', undefined]];
const modeName = (piece, way) => piece === 'sq' ? 'sq' : way || 'auto';

function fnv(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// own canonical forms from tiles(): geometry (ck) and geometry with strips (sig), each the smaller of the two mirror images
function forms(T) {
  const g = [], gm = [], s = [], sm = [];
  for (const t of T) {
    const id = (t.piece === 'sq' ? 'sq' : t.way) + '@';
    g.push(id + t.col + ',' + t.y); gm.push(id + (-t.col - 2) + ',' + t.y);
    s.push(id + t.col + ',' + t.y + ':' + +t.strips[0] + +t.strips[1]); sm.push(id + (-t.col - 2) + ',' + t.y + ':' + +t.strips[1] + +t.strips[0]);
  }
  const a = g.sort().join(' '), b = gm.sort().join(' ');
  return a <= b ? { ck: a, sig: s.sort().join(' '), mirrored: false } : { ck: b, sig: sm.sort().join(' '), mirrored: true };
}

// ---- stats ----
function newStats() {
  return {
    builds: {}, drops: 0, cover: {}, nearMiss: { '0.134': 0, '0.268': 0 }, gaps: {}, notchDown: 0, oneSideDown: 0, pocketDown: 0,
    fitsPerBuild: { sq: {}, up: {}, down: {}, tri: {} }, noSquare: 0, noTriangle: 0, noFit: 0, byDepth: {},
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
  for (const k in B.cover) bump(A.cover, k, B.cover[k]);
  for (const k in B.nearMiss) bump(A.nearMiss, k, B.nearMiss[k]);
  for (const k in B.gaps) bump(A.gaps, k, B.gaps[k]);
  A.notchDown += B.notchDown; A.oneSideDown += B.oneSideDown; A.pocketDown += B.pocketDown;
  for (const p in B.fitsPerBuild) for (const k in B.fitsPerBuild[p]) bump(A.fitsPerBuild[p], k, B.fitsPerBuild[p][k]);
  A.noSquare += B.noSquare; A.noTriangle += B.noTriangle; A.noFit += B.noFit;
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
  A.oracleDrops += B.oracleDrops;
  for (const k in B.outline) {
    if (!(k in A.outline)) { A.outline[k] = B.outline[k]; continue; }
    A.checks.OUTLINE++;
    if (A.outline[k].o !== B.outline[k].o) { bump(A.failCount, 'OUTLINE'); if (A.fails.length < 200) A.fails.push({ inv: 'OUTLINE', msg: `same outline (${k}), different outcomes: ${A.outline[k].o} vs ${B.outline[k].o}`, a: A.outline[k].log, b: B.outline[k].log }); }
  }
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
    const { B, MB, log, depth } = node;
    const F = forms(R.tiles(B));
    const hsh = fnv(F.ck);
    const heavy = !only && (depth <= fullTo || hsh % sampleHeavy === 0);
    bump(st.builds, depth);
    const fail = (inv, msg, extra) => {
      if (only && !only.has(inv)) return;
      st.failCount[inv]++;
      if (st.fails.length < 60) st.fails.push(Object.assign({ inv, msg, log: log.map(canon.fmtDrop).join(' '), depth }, extra || {}));
      if (opts.failFast) throw Object.assign(new Error('FAILFAST ' + inv + ': ' + msg), { failFast: true });
    };
    const check = (inv, ok, msg, extra) => { if (only && !only.has(inv)) return true; st.checks[inv]++; if (!ok) fail(inv, typeof msg === 'function' ? msg() : msg, extra); return ok; };
    const T = R.tiles(B);
    const keyBefore = R.key(B);
    // the build's flat tops (for POINT): car, square tops, ▼ tops, as [y p, y q, X from, X to]
    const flats = [[0, 0, -2 * half, 2 * half]];
    for (const t of T) {
      if (t.piece === 'sq') flats.push([t.y[0] + 2, t.y[1], t.col, t.col + 2]);
      else if (t.way === 'down') flats.push([t.y[0], t.y[1] + 1, t.col, t.col + 2]);
    }
    // THROWS: on the bare car, the API throws exactly where SPEC §2 says (odd or off-car square cols, triangles with
    // nothing below), and nowhere else
    if (depth === 0) {
      const throws = (piece, col, way) => { try { R.drop(B, piece, col, way); return false; } catch (e) { return true; } };
      for (let col = -2 * half - 4; col <= 2 * half + 3; col++) {
        const sqOk = col % 2 === 0 && col >= -2 * half && col <= 2 * half - 2, triOk = col >= -2 * half - 1 && col <= 2 * half - 1;
        check('THROWS', throws('sq', col) === !sqOk, `square at col ${col} ${sqOk ? 'throws' : 'does not throw'}`);
        for (const w of ['up', 'down', undefined]) check('THROWS', throws('tri', col, w) === !triOk, `triangle ${w || ''} at col ${col} ${triOk ? 'throws' : 'does not throw'}`);
      }
      check('THROWS', throws('sq', 0, 'up') && throws('tri', 0, 'sideways') && throws('circle', 0) && throws('sq', 0.5), 'bad arguments are accepted');
      let placedOff = false;
      try { R.place(B, R.drop(B, 'tri', 0, 'down')); } catch (e) { placedOff = true; }
      check('THROWS', placedOff, 'placing a tile that falls off does not throw');
      // I1 on the API: the game and the oracle throw on the same calls, and agree where neither throws
      if (cmpHook && node.oh) {
        const calls = [];
        for (let col = -2 * half - 4; col <= 2 * half + 3; col++) for (const [p, w] of [['sq', undefined], ['sq', null], ['tri', 'up'], ['tri', 'down'], ['tri', undefined], ['tri', null]]) calls.push([p, col, w]);
        calls.push(['sq', 0, 'up'], ['sq', 0, 'down'], ['tri', 0, 'sideways'], ['circle', 0, undefined], ['sq', 0.5, undefined], ['tri', 0.5, 'up'], ['tri', '0', 'up']);
        for (const [p, col, w] of calls) i1(p, col, w, true);
      }
    }
    const res = {}; // mode -> [result per col]
    const fitPoses = new Map();
    const cmpH = cmpHook && node.oh && depth <= oracleDepth ? node.oh : null;
    if (cmpH) st.oracleCache.builds++;
    // I1 for one drop: the game's result (or throw) against the oracle's, field by field
    function i1(piece, col, way, verify, r) {
      let gr = r, gThrew = null;
      if (gr === undefined) { try { gr = R.drop(B, piece, col, way); } catch (e) { gThrew = e.message; } }
      const o = cmpHook.drop(node.oh, piece, col, way, verify);
      st.oracleDrops++;
      if (o.unsound !== undefined) check('I1CACHE', false, () => `cached oracle result for ${piece} ${col} ${way || ''} differs from a fresh one: ${o.unsound} vs ${o.s}`);
      else if (verify) st.checks.I1CACHE++;
      const mode = typeof piece === 'string' && piece === 'sq' ? 'sq' : (way || 'auto');
      const ex = d => ({ log: log.map(canon.fmtDrop), drop: { piece, col, way: way === undefined ? '(none)' : way }, diff: d });
      const outside = piece === 'tri' && Number.isInteger(col) && (col < -2 * half - 1 || col > 2 * half - 1);
      let label = null, d = null;
      if (gThrew !== null || o.threw !== undefined) {
        if (gThrew !== null && o.threw !== undefined) { st.checks.I1++; return true; }
        d = { game: gThrew !== null ? 'throws: ' + gThrew : canon.fmtOutcome(gr), oracle: o.threw !== undefined ? 'throws: ' + o.threw : canon.fmtOutcome(JSON.parse(o.s)) };
        label = `${outside ? 'outside §2 cols: ' : ''}${mode}: game ${gThrew !== null ? 'throws' : 'returns ' + canon.fmtOutcome(gr)} / oracle ${o.threw !== undefined ? 'throws' : 'returns'}`;
      } else {
        const gs = strictStr(gr);
        if (gs === o.s) { st.checks.I1++; return true; }
        const G = JSON.parse(gs), O = JSON.parse(o.s);
        d = {};
        for (const f of Object.keys(O)) if (JSON.stringify(G[f]) !== JSON.stringify(O[f])) d[f] = [G[f], O[f]];
        const fields = Object.keys(d), cg = canon.canon(G), co = canon.canon(O);
        const orderOnly = fields.every(f => f !== 'keys' && JSON.stringify(cg[f]) === JSON.stringify(co[f]));
        label = `${outside ? 'outside §2 cols: ' : ''}${mode}: game ${canon.fmtOutcome(G)} / oracle ${canon.fmtOutcome(O)}; differ in ${fields.join(', ')}` +
          (fields.includes('strips') ? ` (strips ${JSON.stringify(G.strips)} vs ${JSON.stringify(O.strips)})` : '') + (orderOnly ? ' (order only)' : '');
      }
      addI1(st, label, ex(d));
      if (openOf(label)) { st.checks.I1++; return true; } // an open question for the designer: counted, reported as OPEN
      check('I1', false, () => `game and oracle differ: ${label}: ${JSON.stringify(d)}`);
      return false;
    }
    // I1 outside the hand's cols: one col past each end, where the oracle throws (SPEC §2) and the game evaluates
    // whatever has something below it (golden 5); counted as the open question A1
    if (cmpH) for (const col of [-2 * half - 2, 2 * half]) for (const w of ['up', 'down', undefined]) i1('tri', col, w, false);
    for (const [piece, way] of MODES) {
      const m = modeName(piece, way), cols = colsOf(half, piece), arr = [];
      for (const col of cols) {
        let r;
        try { r = R.drop(B, piece, col, way); } catch (e) { fail('THROWS', `drop ${piece} ${col} ${way || ''} threw: ${e.message}`); continue; }
        st.drops++;
        arr.push(r);
        // FORMAT: the comparison format, sorted, plus pose
        check('FORMAT', formatOk(r, piece, way, col), () => `bad result format for ${piece} ${col} ${way || ''}: ${JSON.stringify(r)}`);
        const reason = r.reason || 'FIT';
        bump(st.cover, `${r.outcome}|${piece}|${r.way || '-'}|${reason}|${m === 'auto' ? 'auto' : 'forced'}`);
        if (r.outcome === 'fit' && m !== 'auto') fitPoses.set(r.pose.type + r.pose.col, r);
        // I3: pure (sampled: the same drop again gives the same result)
        if (heavy && col % 3 === 0) check('I3', canon.str(R.drop(B, piece, col, way)) === canon.str(r), () => `drop ${piece} ${col} ${way || ''} differs on a second call`);
        // I13: the shine explains the outcome
        check('I13', shineOk(r), () => `shine does not explain ${r.outcome}/${r.reason} for ${piece} ${col} ${way || ''}: ${JSON.stringify({ shine: r.shine, contacts: r.contacts })}`);
        if (heavy) check('I13', contactsMatch(T, r, half), () => `contact segments of ${piece} ${col} ${way || ''} differ from the edge geometry: ${JSON.stringify(r.contacts.segments)}`);
        // I1: the oracle (its cache checked by a fresh oracle drop on 1 in 16 drops, and on every drop to depth 3)
        if (cmpH) i1(piece, col, way, depth <= 3 || ((hsh >>> 4) + col * 7 + m.length) % 16 === 0, r);
        if (r.reason === 'NOT LEVEL' && r.gap) {
          const g = r.gap.join(',');
          bump(st.gaps, canon.fmtH(r.gap));
          if (NEAR[g] && m !== 'auto') { st.nearMiss[NEAR[g]]++; addEx(st, 'nearMiss ' + NEAR[g], log, { piece, col, way }); }
        }
        if (r.outcome === 'fit' && r.way === 'down' && m === 'down') {
          const sides = downSides(r);
          if (sides === 2) st.notchDown++; else st.oneSideDown++;
          if (sides === 1 && r.strips[0] && r.strips[1]) { st.pocketDown++; addEx(st, 'pocket ▼ (free half on a flat top)', log, { piece, col, way }); }
          // POINT: a fitted ▼'s point rests on a flat top
          const P = r.verts.find(v => v[0] === r.pose.col + 1 && v[1] === r.pose.y[0] && v[2] === r.pose.y[1]);
          check('POINT', P && flats.some(f => f[0] === P[1] && f[1] === P[2] && P[0] >= f[2] && P[0] <= f[3]), () => `fitted ▼ at col ${col}: its point is on no flat top`);
        }
        if (r.outcome === 'off' && r.reason === 'TOO FAR OUT' && piece === 'sq') addEx(st, '■ TOO FAR OUT', log, { piece, col, way });
        if (r.outcome === 'fit' && r.shine.length >= 3) addEx(st, 'fit touching ' + r.shine.length + ' neighbours', log, { piece, col, way });
        if (r.outcome === 'fit' && r.shine.length > ((st.ext['most neighbours touched by one fit'] || {}).v || 0)) st.ext['most neighbours touched by one fit'] = { v: r.shine.length, value: r.shine.length, depth, log: log.map(canon.fmtDrop), drop: { piece, col, way } };
      }
      res[m] = arr;
    }
    check('I3', R.key(B) === keyBefore, 'the build changed while dropping');
    // I11 and AUTO (§6)
    const triCols = colsOf(half, 'tri');
    let triFits = 0, upFits = 0, downFits = 0, sqFits = 0;
    triCols.forEach((col, i) => {
      const u = res.up[i], d = res.down[i], a = res.auto[i];
      if (!u || !d || !a) return;
      check('I11', !(u.outcome === 'fit' && d.outcome === 'fit'), `both ways fit at col ${col}`);
      const want = d.outcome === 'fit' ? d : u.outcome === 'fit' ? u : d.reason === 'TOO FAR OUT' ? d : u;
      check('AUTO', canon.str(a) === canon.str(want) && a.pose.type === want.pose.type, () => `no way given at col ${col}: ${a.way} ${a.reason}, §6 says ${want.way} ${want.reason}`);
      if (u.outcome === 'fit') upFits++;
      if (d.outcome === 'fit') downFits++;
      if (a.outcome === 'fit') triFits++;
      // minimal pairs: neighbouring cols with different outcomes
      if (i > 0) for (const m of ['up', 'down']) {
        const p = res[m][i - 1], q = res[m][i];
        if (p && q && (p.reason || 'FIT') !== (q.reason || 'FIT')) addPair(st.pairsCol, `${m}: ${p.reason || 'FIT'} | ${q.reason || 'FIT'}`, { log: log.map(canon.fmtDrop), piece: 'tri', way: m, cols: [col - 1, col] });
      }
    });
    res.sq.forEach((r, i) => {
      if (r.outcome === 'fit') sqFits++;
      if (i > 0) { const p = res.sq[i - 1]; if ((p.reason || 'FIT') !== (r.reason || 'FIT')) addPair(st.pairsCol, `sq: ${p.reason || 'FIT'} | ${r.reason || 'FIT'}`, { log: log.map(canon.fmtDrop), piece: 'sq', cols: [r.pose.col - 2, r.pose.col] }); }
    });
    bump(st.fitsPerBuild.sq, sqFits); bump(st.fitsPerBuild.up, upFits); bump(st.fitsPerBuild.down, downFits); bump(st.fitsPerBuild.tri, triFits);
    const bd = st.byDepth[depth] || (st.byDepth[depth] = {});
    bump(bd, 'builds'); bump(bd, 'sqFits', sqFits); bump(bd, 'upFits', upFits); bump(bd, 'downFits', downFits); bump(bd, 'triCols', triFits); if (!sqFits) bump(bd, 'noSquare');
    if (!sqFits) { st.noSquare++; addEx(st, 'no square fits', log); }
    check('SOME_TRI', triFits > 0, 'no triangle fits anywhere');
    if (!triFits) st.noTriangle++;
    if (!sqFits && !triFits) st.noFit++;
    // extremes
    let topY = 0, minX = 0, maxX = 0;
    for (const t of T) for (const v of t.verts) { topY = Math.max(topY, canon.yOf(v[1], v[2])); minX = Math.min(minX, v[0] / 2); maxX = Math.max(maxX, v[0] / 2); }
    ext(st, 'tallest (top, in tiles)', topY, depth, log);
    ext(st, 'most fitting places (■ + ▲ + ▼ columns)', sqFits + upFits + downFits, depth, log);
    ext(st, 'fewest fitting places (■ + ▲ + ▼ columns)', -(sqFits + upFits + downFits), depth, log, sqFits + upFits + downFits);
    ext(st, 'reaches furthest from the middle (x, in tiles)', Math.max(-minX, maxX), depth, log);
    if (depth >= 6) ext(st, 'flattest at depth ' + depth + ' (top, in tiles)', -topY, depth, log, topY);
    if (depth >= 6) ext(st, 'tallest at depth ' + depth + ' (top, in tiles)', topY, depth, log);
    // OUTLINE: whether a tile fits depends only on the visible top outline and the over-air strips. Every drop is
    // keyed by the outline over its own two strips (the highest top's ends, relative to the left one, its kind and
    // whether its strip is on the tower); one key must always give one outcome, reason, way, strips and gap.
    if (outlineOn && heavy) {
      const parts = outlineParts(T, half);
      for (const [piece, way] of MODES) {
        const m = modeName(piece, way);
        for (const r of res[m]) {
          const k = m + ' ' + localSig(parts, half, r.pose.col), o = `${r.reason || 'FIT'} ${r.way} ${r.strips} ${r.gap}`;
          const prev = st.outline[k];
          if (prev) check('OUTLINE', prev.o === o, () => `same outline as after ${prev.log} (${k}): ${o} there ${prev.o}`);
          else st.outline[k] = { o, log: log.map(canon.fmtDrop).join(' ') + ' then ' + m + '@' + r.pose.col };
        }
      }
    }
    // I2: fitsAll equals drop
    if (heavy) for (const [piece, way] of MODES) {
      const all = R.fitsAll(B, piece, way), arr = res[modeName(piece, way)];
      check('I2', all.length === arr.length && all.every((r, i) => canon.str(r) === canon.str(arr[i]) && JSON.stringify(r.pose) === JSON.stringify(arr[i].pose)), `fitsAll(${piece}, ${way || ''}) differs from drop`);
    }
    // I5: mirror symmetry (every build): every drop on the mirror build is the mirror of this one
    const mres = {};
    for (const [piece, way] of MODES) {
      const m = modeName(piece, way), arr = res[m], marr = [];
      for (const r of arr) {
        const mc = canon.mirrorCol(r.pose.col);
        let mr;
        try { mr = R.drop(MB, piece, mc, way); } catch (e) { fail('I5', 'mirror drop threw: ' + e.message); continue; }
        marr.push(mr);
        check('I5', canon.str(mr) === JSON.stringify(canon.mirrorResult(r)) && mr.pose.type === r.pose.type, () => `mirror of ${piece} ${r.pose.col} ${way || ''} differs: ${JSON.stringify(canon.diff(mr, canon.mirrorResult(r)))}`);
      }
      mres[m] = marr;
    }
    // I8: replaying the drop log rebuilds the same build
    let RB = null;
    try { RB = canon.replay(R, half, B.log || log); } catch (e) { fail('I8', 'replay threw: ' + e.message); }
    if (RB) check('I8', R.key(RB) === R.key(B) && JSON.stringify(R.tiles(RB)) === JSON.stringify(T), 'replaying the log gives another build');
    // I10: the state is sound (independent geometry), at every build
    {
      const { errs } = geom.checkState(T, half);
      check('I10', errs.length === 0, () => errs.slice(0, 3).join('; '));
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
            c.sort((a, b) => canon.yOf(a.pose.y[0], a.pose.y[1]) - canon.yOf(b.pose.y[0], b.pose.y[1]) || a.pose.col - b.pose.col);
            want = c[0]; break;
          }
        }
        const got = R.pull(B, piece, col);
        check('I12', canon.str(got) === canon.str(want) && got.pose.col === want.pose.col, () => `pull ${piece} ${col}: got col ${got.pose.col} ${got.outcome}, want col ${want.pose.col} ${want.outcome}`);
      });
    }
    // I6: translation on a wide base (sampled): the same build on half = 50, shifted, gives shifted results
    if (heavy && hsh % 4 === 0 && log.length) {
      const W = 50, shift = 2 * ((hsh >> 3) % 30) - 30; // an even shift of −30 … 28 half tiles
      let B0, B1;
      try { B0 = canon.replay(R, W, log); B1 = canon.replay(R, W, canon.translateLog(log, shift)); } catch (e) { fail('I6', 'replay on the wide base threw: ' + e.message); }
      if (B0 && B1) for (const [piece, way] of MODES) {
        for (let col = -8; col <= 7; col++) {
          if (piece === 'sq' && col % 2) continue;
          const a = R.drop(B0, piece, col, way), b = R.drop(B1, piece, col + shift, way);
          check('I6', canon.str(b) === JSON.stringify(canon.translateResult(a, shift)), () => `translated by ${shift}: ${piece} ${col} ${way || ''} differs: ${JSON.stringify(canon.diff(b, canon.translateResult(a, shift)))}`);
        }
      }
    }
    // children (and the mirror of each, through the mirror build's own drops)
    const children = [];
    if (depth < opts.depth) {
      for (const r of fitPoses.values()) {
        const piece = r.pose.type === 'sq' ? 'sq' : 'tri', way = r.way || undefined;
        const C = R.place(B, r);
        const m = modeName(piece, way), mi = res[m].indexOf(r), mr = mres[m][mi];
        let MC = null;
        if (mr && mr.outcome === 'fit') MC = R.place(MB, mr); else { fail('I5', `the mirror of a fit does not fit (${piece} ${r.pose.col} ${way || ''})`); continue; }
        check('I3', R.key(B) === keyBefore, 'place changed its argument');
        const Fc = forms(R.tiles(C));
        const k1 = R.key(C), k2 = R.key(MC);
        children.push({ ck: Fc.ck, sig: Fc.sig, rk: k1 < k2 ? k1 : k2, log: log.concat([{ piece, col: r.pose.col, way: r.way }]), C, MC });
      }
      // I7 locality and one-tile minimal pairs (sampled: one child per heavy build)
      if (heavy && children.length) {
        const ch = children[hsh % children.length], t = ch.log[ch.log.length - 1];
        const s0 = t.col, s1 = t.col + 1;
        for (const [piece, way] of MODES) {
          const m = modeName(piece, way);
          res[m].forEach(r => {
            const col = r.pose.col, rc = R.drop(ch.C, piece, col, way);
            const near = s1 >= col - 1 && s0 <= col + 2, under = s1 >= col && s0 <= col + 1;
            if (!near) check('I7', canon.str(rc) === canon.str(r), () => `a tile at col ${t.col} changed the drop at col ${col} (${piece} ${way || ''})`);
            else if (!under) {
              const a = canon.canon(r), b = canon.canon(rc);
              delete a.contacts; delete b.contacts; delete a.shine; delete b.shine;
              check('I7', JSON.stringify(a) === JSON.stringify(b), () => `a tile beside col ${col} changed more than its contacts (${piece} ${way || ''})`);
            }
            if ((r.reason || 'FIT') !== (rc.reason || 'FIT')) addPair(st.pairsTile, `${m}: ${r.reason || 'FIT'} -> ${rc.reason || 'FIT'}`, { log: log.map(canon.fmtDrop), add: canon.fmtDrop(t), piece, way: way || null, col });
          });
        }
      }
    }
    // I9: re-dropping a top tile puts it back (sampled)
    if (heavy && T.length && hsh % 2 === 0) {
      const L = B.log || log;
      for (let i = 0; i < L.length; i++) {
        const strips = [T[i].col, T[i].col + 1];
        if (T.some((u, j) => j > i && (u.col === strips[0] || u.col === strips[1] || u.col + 1 === strips[0]))) continue; // something later in its strips
        let P;
        try { P = canon.replay(R, half, L.filter((e, j) => j !== i)); } catch (e) { continue; } // something leaned on it
        const TP = R.tiles(P);
        if (TP.some((u, j) => JSON.stringify(u) !== JSON.stringify(T[j < i ? j : j + 1]))) continue;
        const e = L[i], r = R.drop(P, e.piece, e.col, e.piece === 'sq' ? undefined : e.way);
        const ok = r.outcome === 'fit' && r.pose.y.join() === T[i].y.join() && JSON.stringify(r.strips) === JSON.stringify(T[i].strips) && R.key(R.place(P, r)) === R.key(B);
        check('I9', ok, () => `re-dropping top tile ${i} (${canon.fmtDrop(e)}) gives ${r.outcome} ${r.reason || ''} at ${r.pose.y}`);
      }
    }
    return children;
  };
}

function formatOk(r, piece, way, col) {
  const isPt = p => Array.isArray(p) && p.length === 3 && p.every(Number.isInteger);
  const isSeg = s => Array.isArray(s) && s.length === 2 && isPt(s[0]) && isPt(s[1]) && canon.lex(s[0], s[1]) < 0;
  const sorted = (a, f) => a.every((x, i) => i === 0 || f(a[i - 1], x) < 0);
  const segLex = (s, t) => canon.lex(s[0], t[0]) || canon.lex(s[1], t[1]);
  if (r.outcome !== 'fit' && r.outcome !== 'off') return false;
  if (piece === 'sq' ? r.way !== null : (r.way !== 'up' && r.way !== 'down')) return false;
  if (way && r.way !== way) return false;
  if (!Array.isArray(r.verts) || r.verts.length !== (piece === 'sq' ? 4 : 3) || !r.verts.every(isPt) || !sorted(r.verts, canon.lex)) return false;
  if (r.outcome === 'fit' ? r.reason !== null : !['NO SIDE', 'ONLY A POINT', 'OVER THE EDGE', 'NOT LEVEL', 'TOO FAR OUT'].includes(r.reason)) return false;
  if (r.way === 'down' && r.outcome === 'off' && !['NO SIDE', 'TOO FAR OUT'].includes(r.reason)) return false;
  if (r.way !== 'down' && r.reason === 'NO SIDE') return false;
  const C = r.contacts;
  if (!C || !Array.isArray(C.segments) || !Array.isArray(C.points) || !C.segments.every(isSeg) || !C.points.every(isPt)) return false;
  if (!sorted(C.segments, segLex) || !sorted(C.points, canon.lex)) return false;
  if (C.points.some(q => C.segments.some(s => geom.onSegment(q, s)))) return false; // §8: points exclude those on a segment
  if (!Array.isArray(r.strips) || r.strips.length !== 2 || !r.strips.every(b => b === true || b === false)) return false;
  if (r.reason === 'NOT LEVEL' ? !(Array.isArray(r.gap) && r.gap.length === 2 && r.gap.every(Number.isInteger) && geom.sgn(r.gap[0], r.gap[1]) > 0) : r.gap !== null) return false;
  if (!r.pose || r.pose.col !== col || !Array.isArray(r.pose.y)) return false;
  return true;
}
// I13: the shine explains the outcome. Shine is the contact segments when it fits and nothing when it falls off; the
// tile rests on something; every contact lies on its boundary. For a square or ▲, a contact along its bottom line
// exists exactly when the reason is not ONLY A POINT, and a fit has its whole bottom edge shining. For a ▼, a whole
// lower side in contact exists exactly when the reason is not NO SIDE, and a fit has it shining.
function shineOk(r) {
  if (r.outcome === 'off') { if (r.shine.length) return false; }
  else if (JSON.stringify(r.shine) !== JSON.stringify(r.contacts.segments) || !r.shine.length) return false;
  if (!r.contacts.segments.length && !r.contacts.points.length) return false; // it rests on nothing
  const poly = geom.shape(r.way === null ? 'sq' : 'tri', r.way, r.pose.col, r.pose.y);
  for (const s of r.contacts.segments) if (!geom.onBoundary(poly, s)) return false;
  const [c, p, q] = [r.pose.col, r.pose.y[0], r.pose.y[1]], segs = r.contacts.segments;
  // the strips explain TOO FAR OUT and the fit: a square needs both on the tower, a triangle one
  const ons = r.strips.filter(Boolean).length, need = r.way === null ? 2 : 1;
  if (r.outcome === 'fit' && ons < need) return false;
  if (r.reason === 'TOO FAR OUT' && ons >= need) return false;
  if (r.way === 'down') {
    const side = geom.covers([[c, p, q + 1], [c + 1, p, q]], segs) || geom.covers([[c + 1, p, q], [c + 2, p, q + 1]], segs);
    return r.reason === 'NO SIDE' ? !side : side;
  }
  const atBottom = v => v[1] === p && v[2] === q && v[0] >= c && v[0] <= c + 2;
  const bottomSeg = segs.some(s => atBottom(s[0]) && atBottom(s[1]));
  if (r.outcome === 'fit') return geom.covers([[c, p, q], [c + 2, p, q]], segs);
  // ONLY A POINT: it touches its bottom line only at points (a contact point, or the end of a side contact: SPEC §8
  // leaves a point off the list when it lies on a contact segment)
  if (r.reason === 'ONLY A POINT') return !bottomSeg && (r.contacts.points.some(atBottom) || segs.some(s => atBottom(s[0]) || atBottom(s[1])));
  return bottomSeg;
}
// I13 (sampled): the contact segments equal the positive-length edge overlaps with every tile and the car top
function contactsMatch(T, r, half) {
  const poly = geom.shape(r.way === null ? 'sq' : 'tri', r.way, r.pose.col, r.pose.y), segs = [];
  for (const t of T) for (const s of geom.contactSegs(poly, geom.shape(t.piece, t.way, t.col, t.y))) segs.push(geom.normSeg(s));
  for (const s of geom.carSegs(poly, half)) segs.push(geom.normSeg(s));
  segs.sort((a, b) => geom.lex(a[0], b[0]) || geom.lex(a[1], b[1]));
  return JSON.stringify(segs) === JSON.stringify(r.contacts.segments);
}
function downSides(r) {
  const [c, p, q] = [r.pose.col, r.pose.y[0], r.pose.y[1]];
  const left = geom.covers([[c, p, q + 1], [c + 1, p, q]], r.shine), right = geom.covers([[c + 1, p, q], [c + 2, p, q + 1]], r.shine);
  return (left ? 1 : 0) + (right ? 1 : 0);
}
// the visible top outline: per strip, the highest top's two ends, its kind (a ▲ slant or flat) and its strip's
// 'on the tower'; null over nothing
function outlineParts(T, half) {
  const parts = {};
  for (let s = -2 * half - 2; s <= 2 * half + 1; s++) {
    let best = s >= -2 * half && s < 2 * half ? { a: [0, 0], b: [0, 0], kind: 'flat', on: true } : null;
    for (const t of T) {
      if (s !== t.col && s !== t.col + 1) continue;
      const j = s - t.col, [p, q] = t.y;
      let a, b;
      if (t.piece === 'sq') { a = [p + 2, q]; b = [p + 2, q]; }
      else if (t.way === 'down') { a = [p, q + 1]; b = [p, q + 1]; }
      else { a = j ? [p, q + 1] : [p, q]; b = j ? [p, q] : [p, q + 1]; }
      const mid = [a[0] + b[0], a[1] + b[1]];
      if (!best || geom.sgn(mid[0] - best.a[0] - best.b[0], mid[1] - best.a[1] - best.b[1]) > 0) best = { a, b, kind: t.way === 'up' ? 'slant' : 'flat', on: t.strips[j] };
    }
    parts[s] = best;
  }
  return parts;
}
// the outline over strips col and col + 1, with heights relative to the first top found (the rules don't depend on
// where the tiles are, only on how the tops under the tile stand to each other)
function localSig(parts, half, col) {
  const P = [parts[col], parts[col + 1]], base = (P[0] || P[1]).a;
  return P.map(x => x ? `${x.a[0] - base[0]},${x.a[1] - base[1]}/${x.b[0] - base[0]},${x.b[1] - base[1]}/${x.kind}${x.on ? '+' : '-'}` : '_').join(' ');
}
function addEx(st, k, log, drop) { const a = st.examples[k] || (st.examples[k] = []); if (a.length < 8) a.push({ log: log.map(canon.fmtDrop), drop: drop || null }); }
function addPair(o, k, x) { const a = o[k] || (o[k] = []); if (a.length < 8) a.push(x); }
function ext(st, k, v, depth, log, shown) { const e = st.ext[k]; if (!e || v > e.v || (v === e.v && depth < e.depth)) st.ext[k] = { v, value: shown === undefined ? v : shown, depth, log: log.map(canon.fmtDrop) }; }

// ---- the compare hook (I1) ----
// SPEC §8's eight fields of a result, in §8's order and exactly as given (nothing re-sorted), as one string. Extra
// fields on the game's side (pose, DESIGN §18.7) are left out; on the oracle's side, a missing or extra field is a
// disagreement (the 'keys' field).
function strictStr(r, exact) {
  const o = {};
  for (const f of canon.FIELDS) o[f] = r[f] === undefined ? '(missing)' : r[f];
  if (exact) { const ks = Object.keys(r).sort(); if (ks.join() !== canon.FIELDS.slice().sort().join()) o.keys = ks; }
  return JSON.stringify(o);
}
// The oracle's own tiles within two cols of col (all a drop at col can touch or rest on), with their recorded
// strips, as a cache key; null when the build's tiles are of an unknown form (then nothing is cached).
function localKey(h, piece, col, way) {
  const T = h && h.tiles;
  if (!Array.isArray(T) || typeof col !== 'number' || !Number.isInteger(col)) return null;
  const parts = [];
  for (const t of T) {
    let c, s;
    if (t && t.y0 && 'kind' in t) { c = t.col; s = t.kind + c + ':' + t.y0.A + ',' + t.y0.B + ',' + t.y0.D + ':' + +t.strips[0] + +t.strips[1]; }
    else if (t && 't' in t && 'on' in t) { c = t.c; s = t.t + c + ':' + t.a + ',' + t.b + ':' + +t.on[0] + +t.on[1]; }
    else return null;
    if (c >= col - 2 && c <= col + 2) parts.push(s);
  }
  parts.sort();
  return h.half + '|' + piece + '|' + (way === undefined ? '' : String(way)) + '|' + col + '|' + parts.join(' ');
}
// a hook is {name, root(half) -> handle, child(handle, {piece, col, way}) -> handle,
//   drop(handle, piece, col, way, verify) -> {s: strict string, o?: result} | {threw: message}, plus unsound when a
//   verified cache hit differs from a fresh drop}
function hookFromModule(spec, hopts) {
  let O, cacheOn = !(hopts && hopts.cache === false);
  if (spec === 'rules') O = rulesVm.load(); // a second copy of rules.js: tests the plumbing (always agrees)
  else if (spec.startsWith('mutant:')) { // a mutant of rules.js as the "oracle": shows that I1 catches a disagreement
    const M = require('./mutants.cjs'), m = M.list().find(x => x.name === spec.slice(7));
    O = rulesVm.load({ from: { source: M.patch(fs.readFileSync(rulesVm.RULES_JS, 'utf8'), m), file: spec } });
    cacheOn = false; // a mutant need not be local
  } else O = require(path.resolve(spec));
  // a copy of rules.js as the reference returns pose as well (DESIGN §18.7); the real oracle must return exactly §8's fields
  const exact = !(spec === 'rules' || spec.startsWith('mutant:'));
  const cache = new Map(), CAP = (hopts && hopts.cacheCap) || 1500000;
  const stats = { hits: 0, misses: 0, verified: 0, unsound: 0 };
  function fresh(h, piece, col, way) {
    try { const o = O.drop(h, piece, col, way); return { s: strictStr(o, exact), o }; }
    catch (e) { return { threw: String(e && e.message) }; }
  }
  const enc = x => (x.threw !== undefined ? '!' + x.threw : x.s);
  function drop(h, piece, col, way, verify) {
    const k = cacheOn ? localKey(h, piece, col, way) : null;
    if (k === null) return fresh(h, piece, col, way);
    const c = cache.get(k);
    if (c !== undefined) {
      stats.hits++;
      if (!verify) return c[0] === '!' ? { threw: c.slice(1) } : { s: c };
      stats.verified++;
      const x = fresh(h, piece, col, way);
      if (enc(x) !== c) { stats.unsound++; x.unsound = c; }
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
    // the oracle places the tile from its own result (taken from the cache when the parent's drops put it there)
    child: (h, e) => {
      const way = e.piece === 'sq' ? undefined : e.way, x = drop(h, e.piece, e.col, way, false);
      if (x.threw !== undefined) throw new Error('the oracle throws on ' + canon.fmtDrop(e) + ': ' + x.threw);
      let r = x.o;
      if (!r) { const p = JSON.parse(x.s); r = p.keys || !exact ? O.drop(h, e.piece, e.col, way) : p; }
      return O.place(h, r);
    },
    drop
  };
}

// ---- the walk ----
function loadRules(o) { return o.source ? rulesVm.load({ from: { source: o.source, file: o.file || 'rules (mutant)' } }) : rulesVm.load(); }

function processChunk(R, visit, items, opts, hook) {
  const st = newStats(), kids = [];
  const s0 = hook ? Object.assign({}, hook.stats) : null;
  // the oracle's builds, made once per log prefix (siblings sit together in a chunk, so a parent is made once)
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
  try {
    for (const it of items) {
      const B = canon.replay(R, opts.half, it.log), MB = canon.replay(R, opts.half, canon.mirrorLog(it.log));
      let oh = null;
      if (hook && it.log.length <= od) {
        // the oracle builds the same tiles; if it can't place one the game placed, that is already a disagreement
        try { oh = handleFor(it.log); }
        catch (e) {
          oh = null; st.checks.I1++; st.failCount.I1++;
          addI1(st, 'the oracle cannot build what the game built', { log: it.log.map(canon.fmtDrop), drop: null, diff: String(e.message).slice(0, 200) });
          if (st.fails.length < 60) st.fails.push({ inv: 'I1', msg: 'the oracle cannot build what the game built: ' + String(e.message).slice(0, 120), log: it.log.map(canon.fmtDrop).join(' ') });
          if (opts.failFast) return { st, kids, failFast: 'I1' };
        }
      }
      const ch = visit({ B, MB, log: it.log, depth: it.log.length, oh }, st);
      for (const c of ch) kids.push({ ck: c.ck, sig: c.sig, rk: c.rk, log: c.log });
    }
  } catch (e) {
    if (!e.failFast && !opts.failFast) throw e;
    // fail fast: report what failed (a crash counts as a failure too)
    if (!e.failFast) { st.failCount.THROWS++; st.fails.push({ inv: 'THROWS', msg: 'crashed: ' + String(e.message).slice(0, 200) }); }
    return { st, kids, failFast: e.message };
  } finally {
    if (hook) for (const k in s0) st.oracleCache[k] += hook.stats[k] - s0[k];
  }
  return { st, kids };
}

// in-process or with worker threads; returns {stats, perDepth, ms}
async function enumerate(opts) {
  opts = Object.assign({ depth: 10, half: 2, workers: 0, fullTo: 6, sampleHeavy: 8 }, opts || {});
  const t0 = Date.now();
  const R = loadRules(opts);
  const hook = opts.compare ? hookFromModule(opts.compare, opts) : null;
  const visit = makeVisitor(R, Object.assign({}, opts, { compare: hook }));
  const stats = newStats();
  let frontier = [{ log: [] }];
  const perDepth = [];
  let pool = null;
  if (opts.workers > 0) pool = makePool(opts);
  try {
    for (let d = 0; d <= opts.depth; d++) {
      const td = Date.now();
      let results;
      if (pool && frontier.length > 200) {
        // contiguous slices, so siblings (and their oracle parent) share a chunk; many chunks, for balance
        const n = Math.min(frontier.length, pool.size * 16), size = Math.ceil(frontier.length / n), chunks = [];
        for (let i = 0; i < frontier.length; i += size) chunks.push(frontier.slice(i, i + size));
        results = await Promise.all(chunks.map(c => pool.run({ items: c })));
      } else {
        results = [processChunk(R, visit, frontier, opts, hook)];
      }
      const next = new Map(), rkeys = new Map();
      for (const r of results) {
        if (r.failFast) { stats.failFast = r.failFast; }
        mergeStats(stats, r.st);
        for (const k of r.kids) {
          const prev = next.get(k.ck);
          if (prev) {
            stats.checks.I4++;
            if ((prev.sig !== k.sig || prev.rk !== k.rk) && !(opts.only && !opts.only.includes('I4'))) { stats.failCount.I4++; if (stats.fails.length < 200) stats.fails.push({ inv: 'I4', msg: 'the same tiles in another order (or mirrored) give another state or key', a: prev.log.map(canon.fmtDrop).join(' '), b: k.log.map(canon.fmtDrop).join(' ') }); }
            continue;
          }
          const other = rkeys.get(k.rk);
          stats.checks.I4++;
          if (other !== undefined && other !== k.ck && !(opts.only && !opts.only.includes('I4'))) { stats.failCount.I4++; if (stats.fails.length < 200) stats.fails.push({ inv: 'I4', msg: 'key() gives two different builds the same key', a: k.rk }); }
          rkeys.set(k.rk, k.ck);
          next.set(k.ck, { log: k.log, sig: k.sig, rk: k.rk });
        }
      }
      perDepth.push({ depth: d, builds: frontier.length, ms: Date.now() - td });
      if (opts.onDepth) opts.onDepth(perDepth[perDepth.length - 1], stats);
      if (stats.failFast || (opts.failFast && Object.values(stats.failCount).some(x => x))) { stats.failFast = stats.failFast || 'failure'; break; }
      frontier = [...next.values()].map(x => ({ log: x.log }));
      if (d === opts.depth) break;
    }
  } finally { if (pool) await pool.close(); }
  return { stats, perDepth, ms: Date.now() - t0 };
}

function makePool(opts) {
  const size = opts.workers;
  const ws = [], idle = [], queue = [];
  for (let i = 0; i < size; i++) {
    const w = new Worker(__filename, { workerData: { opts: { depth: opts.depth, half: opts.half, fullTo: opts.fullTo, sampleHeavy: opts.sampleHeavy, failFast: opts.failFast, compare: opts.compare, only: opts.only, oracleDepth: opts.oracleDepth, cache: opts.cache, cacheCap: opts.cacheCap, source: opts.source, file: opts.file, outline: opts.outline } } });
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
  ['fit', 'sq', '-', 'FIT'], ['off', 'sq', '-', 'ONLY A POINT'], ['off', 'sq', '-', 'OVER THE EDGE'], ['off', 'sq', '-', 'NOT LEVEL'], ['off', 'sq', '-', 'TOO FAR OUT'],
  ['fit', 'tri', 'up', 'FIT'], ['off', 'tri', 'up', 'ONLY A POINT'], ['off', 'tri', 'up', 'OVER THE EDGE'], ['off', 'tri', 'up', 'NOT LEVEL'], ['off', 'tri', 'up', 'TOO FAR OUT'],
  ['fit', 'tri', 'down', 'FIT'], ['off', 'tri', 'down', 'NO SIDE'], ['off', 'tri', 'down', 'TOO FAR OUT']
];
// squares never reach past the car, so nothing is ever missing under one
const IMPOSSIBLE = { 'off|sq|-|OVER THE EDGE': 'squares never reach past the car' };
function coverageTable(stats) {
  return POSSIBLE.map(([o, p, w, r]) => {
    const k = `${o}|${p}|${w}|${r}`;
    return { outcome: o, piece: p, way: w, reason: r, forced: stats.cover[k + '|forced'] || 0, auto: stats.cover[k + '|auto'] || 0, impossible: IMPOSSIBLE[k] || null };
  });
}
function floors(stats) {
  const out = [];
  for (const row of coverageTable(stats)) {
    if (row.impossible) continue;
    out.push({ what: `${row.outcome} ${row.piece} ${row.way} ${row.reason}`, n: row.forced, min: 100 });
  }
  out.push({ what: 'notch ▼ fits', n: stats.notchDown, min: 1000 });
  out.push({ what: 'one-sided ▼ fits', n: stats.oneSideDown, min: 10000 });
  out.push({ what: 'near miss 0.134', n: stats.nearMiss['0.134'], min: 100 });
  out.push({ what: 'near miss 0.268', n: stats.nearMiss['0.268'], min: 100 });
  return out;
}
// the I1 classes, most frequent first
function i1Classes(s) {
  return Object.entries(s.i1).map(([label, c]) => ({ label, n: c.n, open: c.open, examples: c.ex })).sort((a, b) => b.n - a.n);
}
function writeReports(dir, res, opts) {
  fs.mkdirSync(dir, { recursive: true });
  const s = res.stats;
  const totalBuilds = Object.values(s.builds).reduce((a, b) => a + b, 0);
  const summary = {
    depth: opts.depth, half: opts.half, ms: res.ms, builds: totalBuilds, buildsPerDepth: s.builds, drops: s.drops, perDepth: res.perDepth,
    checks: s.checks, failCount: s.failCount, fails: s.fails.slice(0, 50), failFast: s.failFast || null,
    nearMiss: s.nearMiss, gaps: s.gaps, notchDown: s.notchDown, oneSideDown: s.oneSideDown, pocketDown: s.pocketDown,
    fitsPerBuild: s.fitsPerBuild, byDepth: s.byDepth, noSquare: s.noSquare, noTriangle: s.noTriangle, noFit: s.noFit, floors: floors(s),
    outlineClasses: Object.keys(s.outline).length, compare: opts.compare || null,
    oracleDepth: opts.compare ? (opts.oracleDepth === undefined || opts.oracleDepth === null ? opts.depth : Math.min(opts.depth, opts.oracleDepth)) : null,
    oracleDrops: s.oracleDrops, oracleCache: s.oracleCache, i1: i1Classes(s)
  };
  fs.writeFileSync(path.join(dir, 'stats.json'), JSON.stringify(summary, null, 1));
  if (opts.compare) fs.writeFileSync(path.join(dir, 'i1.json'), JSON.stringify({ compare: opts.compare, oracleDepth: summary.oracleDepth, checks: s.checks.I1, failed: s.failCount.I1, oracleDrops: s.oracleDrops, cache: s.oracleCache, classes: summary.i1, open: OPEN.map(o => ({ id: o.id, what: o.what })) }, null, 1));
  fs.writeFileSync(path.join(dir, 'coverage.json'), JSON.stringify({ table: coverageTable(s), raw: s.cover, floors: floors(s), nearMiss: s.nearMiss, gaps: s.gaps, notchDown: s.notchDown, oneSideDown: s.oneSideDown, pocketDown: s.pocketDown }, null, 1));
  fs.writeFileSync(path.join(dir, 'extremes.json'), JSON.stringify({ extremes: s.ext, examples: s.examples }, null, 1));
  fs.writeFileSync(path.join(dir, 'minimal-pairs.json'), JSON.stringify({ neighbouringCols: s.pairsCol, oneTileAdded: s.pairsTile }, null, 1));
  return summary;
}

module.exports = { enumerate, writeReports, coverageTable, floors, colsOf, forms, makeVisitor, newStats, INVS, OPEN, OUT_DEFAULT, strictStr, localKey, hookFromModule };

if (isMainThread && require.main === module) {
  const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
  const opts = {
    depth: +arg('depth', 10), half: 2, workers: +arg('workers', Math.min(4, os.cpus().length)),
    compare: arg('compare', null), failFast: process.argv.includes('--fail-fast'), fullTo: +arg('full-to', 6), sampleHeavy: +arg('sample', 8),
    oracleDepth: arg('oracle-depth', null) === null ? null : +arg('oracle-depth', null), cache: !process.argv.includes('--no-cache')
  };
  const out = arg('out', OUT_DEFAULT);
  enumerate(Object.assign({}, opts, { onDepth: (p) => console.log(`depth ${p.depth}: ${p.builds} builds, ${p.ms} ms`) })).then(res => {
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
    process.exit(bad.length ? 1 : 0);
  }).catch(e => { console.error(e); process.exit(2); });
}
