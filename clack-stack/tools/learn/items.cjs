'use strict';
// The learner quiz's items (DESIGN §18.8 G4), made from rules.js when the quiz is built, so they follow whatever rules
// it holds (revision 5d once that lands). Pure Node: rules.js through tools/lib/rules-vm.cjs, the exhaustive walk of
// reachable builds and the exact "what is under it" description from tools/review/lib.cjs. The tip items need the
// game itself (its weight and sway) and are made in quiz.cjs.
//
// Fit items: 12 strata of 4 minimal pairs each (96 items), in each pair one tile that stays and one that falls off.
// A pair is the same tile dropped on two builds that differ by one tile (`add`: same column; the tile may land at the
// same place or not), the same build with the hand one step over (`col`), or the same place with a square instead of a
// ▲ (`piece`). Triangles are dropped a given way up (the quiz says which; the hand does not turn them). The strata:
//   sq-flat     a square whose whole bottom lies on flat tops, against a square on points (ONLY A POINT)
//   sq-half     a square held by half its bottom edge (the rest over a lower step, a slant or the air), against a
//               square on points
//   up-flat     a ▲ with its whole base on flat tops, against a ▲ on points
//   up-half     a ▲ held by half its base (some of them half past the car's end), against a ▲ on points
//   dn-side     a ▼ hung by one side on a ▲'s side, against a ▼ on its point
//   dn-notch    a ▼ in a notch (both sides held), against a ▼ on its point
//   near-miss   a square or ▲ held by half an edge with a thin gap (0.134 or 0.268) under its other half, against one
//               that falls off on points with a top just below it
//   pocket      only from above: a tile that stops on an overhang (ONLY A POINT) where, without that overhang, it
//               would drop into the pocket below and stay
//   tips-dn     a ▼ that meets the tower edge to edge but tips part of it (TIPS OVER), against one that stays
//   tips-sq     the same for a square (also: a square tips where a ▲ at the same place stays)
//   tips-up     the same for a ▲
//   lock        whole edges lock: the two builds differ by one tile that shares a whole edge with the part that tips
//               (with it the part is held, or with it the part is bigger and tips)
// Which way up (16): a triangle at a column where exactly one way up stays; 8 ▲, 8 ▼.
// Where can it go (12): a build and a tile (6 squares, 6 triangles either way up); the answer is the set of columns
// where it stays.
// Ghost items (24): one more pair per stratum, shown with the ghost (the pass bar "with the ghost shown").
const lib = require('../review/lib.cjs');
const canon = require('../lib/canon.cjs');

const HALF = 2;
const R = () => lib.rules();
const typeOf = (piece, way) => piece === 'sq' ? 'sq' : way === 'down' ? 'dn' : 'up';
const fmt = (piece, col, way) => lib.fmtHand(piece, col, way);
const DROPS = [['sq', null], ['tri', 'up'], ['tri', 'down']];

// ---- items ----
const vkey = v => v[0] + ',' + v[1] + ',' + v[2];
// two tiles share a whole edge: two common corners (on this lattice every edge is one tile long, and two tiles that
// share two corners without overlapping share the edge between them)
function shareEdge(va, vb) { const s = new Set(va.map(vkey)); let n = 0; for (const v of vb) if (s.has(vkey(v))) n++; return n >= 2; }
function buildOf(log) { return canon.replay(R(), HALF, log); }
function height(T) { let h = 0; for (const t of T) for (const v of lib.polyOf(t)) h = Math.max(h, v.y); return h; }
// a square or ▲ that falls off with a top within 0.3 below part of its bottom (a near miss that falls)
function nearOff(d) {
  if (d.type === 'dn' || d.outcome !== 'off') return null;
  let best = null;
  for (const h of d.halves) {
    if (!h.e) continue;
    const hi = lib.cmp(h.e[0], h.e[1]) >= 0 ? h.e[0] : h.e[1], g = lib.yv(lib.sub(d.y0, hi));
    if (g > 1e-9 && g < 0.3 && (best === null || g < best)) best = g;
  }
  return best;
}
function makeItem(log, B, T, piece, col, way) {
  const res = R().drop(B, piece, col, piece === 'sq' ? undefined : way);
  const d = lib.describe(B, piece, col, res);
  d.nearOff = nearOff(d);
  const K = lib.keysOf(T);
  return { log, B, T, piece, col, way: piece === 'sq' ? null : way, type: typeOf(piece, way), res, d, fit: res.outcome === 'fit', reason: res.reason,
    n: T.length, h: height(T), ck: K.ck, id: K.key + '|' + piece + col + (way || '') };
}
// revision 5e: a fit that stands only by a prop (a part it joins leans past what it rests on, and the side of a square
// beside it holds it up): RULES.props of the build it makes has a group with the new tile in it
function proppedOf(it) {
  const Rr = R();
  if (!it.fit || typeof Rr.props !== 'function') return false;
  const n = it.B.tiles.length;
  return Rr.props(Rr.place(it.B, it.res)).some(g => g.members.includes(n));
}
// the members of a TIPS OVER's part as tiles' corners (the dropped tile's own for the build's length)
function memberVerts(it) {
  if (!it.res.tips) return [];
  const T = it.T;
  return it.res.tips.members.map(i => i === T.length ? it.res.verts : T[i] ? T[i].verts : null).filter(Boolean);
}

// ---- the pool: every drop on every build reachable by fitting drops to `depth` tiles, and its minimal pairs ----
function pool(depth) {
  const W = lib.walk(depth, HALF), out = { nodes: W.nodes, items: [], pairs: [] };
  const Rr = R();
  for (const nd of W.nodes) {
    const T = nd.T || Rr.tiles(nd.B);
    nd.items = new Map();
    for (const [piece, way] of DROPS) for (const col of Rr.cols(nd.B, piece)) {
      const it = makeItem(nd.log, nd.B, T, piece, col, way);
      nd.items.set(piece + col + (way || ''), it);
      out.items.push(it);
    }
  }
  const pair = (a, b, kind, extra) => {
    if (a.fit === b.fit) return;
    const A = a.fit ? a : b, Bo = a.fit ? b : a;
    out.pairs.push(Object.assign({ A, B: Bo, kind }, extra || {}));
  };
  for (const nd of W.nodes) {
    // the hand one step over
    for (const [piece, way] of DROPS) {
      const step = piece === 'sq' ? 2 : 1, cols = Rr.cols(nd.B, piece);
      for (const col of cols) if (cols.includes(col + step)) pair(nd.items.get(piece + col + (way || '')), nd.items.get(piece + (col + step) + (way || '')), 'col');
    }
    // a square instead of a ▲ at the same place
    for (const col of Rr.cols(nd.B, 'sq')) pair(nd.items.get('sq' + col), nd.items.get('tri' + col + 'up'), 'piece');
    // one tile more (the extra tile at the end of the log; the build rebuilt exactly, never its mirror image)
    if (nd.depth >= depth) continue;
    for (const [piece, way] of DROPS) for (const col of Rr.cols(nd.B, piece)) {
      const r = Rr.drop(nd.B, piece, col, piece === 'sq' ? undefined : way);
      if (r.outcome !== 'fit') continue;
      const B2 = Rr.place(nd.B, r), T2 = Rr.tiles(B2), log2 = nd.log.concat([{ piece, col, way }]), t = T2[T2.length - 1];
      for (const [p2, w2] of DROPS) for (const c2 of Rr.cols(B2, p2)) {
        const a = nd.items.get(p2 + c2 + (w2 || ''));
        if ((Rr.drop(B2, p2, c2, p2 === 'sq' ? undefined : w2).outcome === 'fit') === a.fit) continue;
        const b = makeItem(log2, B2, T2, p2, c2, w2);
        // which side has the extra tile, and its corners
        pair(a, b, 'add', { extra: { drop: { piece, col, way }, verts: t.verts, on: a.fit ? 'B' : 'A' } });
      }
    }
  }
  return out;
}

// ---- the strata ----
const POINT = 'ONLY A POINT', TIPS = 'TIPS OVER';
const samePose = p => lib.eq(p.A.res.pose.y, p.B.res.pose.y) && p.A.col === p.B.col && p.A.type === p.B.type;
const STRATA = [
  { id: 'sq-flat', name: 'a square whose whole bottom lies on flat tops, against a square on points',
    is: p => p.A.type === 'sq' && p.B.type === 'sq' && p.A.d.held === 2 && p.B.reason === POINT && p.kind !== 'piece' },
  { id: 'sq-half', name: 'a square held by half its bottom edge, against a square on points',
    is: p => p.A.type === 'sq' && p.B.type === 'sq' && p.A.d.held === 1 && p.A.d.thin === null && p.B.reason === POINT && p.kind !== 'piece' },
  { id: 'up-flat', name: 'a ▲ with its whole base on flat tops, against a ▲ on points',
    is: p => p.A.type === 'up' && p.B.type === 'up' && p.A.d.held === 2 && p.B.reason === POINT },
  { id: 'up-half', name: 'a ▲ held by half its base (some half past the car\'s end), against a ▲ on points',
    is: p => p.A.type === 'up' && p.B.type === 'up' && p.A.d.held === 1 && p.A.d.thin === null && p.B.reason === POINT, mix: p => p.A.d.outside ? 'past the car' : 'over the car' },
  { id: 'dn-side', name: 'a ▼ hung by one side on a ▲\'s side, against a ▼ on its point',
    is: p => p.A.type === 'dn' && p.B.type === 'dn' && p.A.d.sides === 1 && p.B.reason === POINT },
  { id: 'dn-notch', name: 'a ▼ in a notch, both sides held, against a ▼ on its point',
    is: p => p.A.type === 'dn' && p.B.type === 'dn' && p.A.d.sides === 2 && p.B.reason === POINT },
  { id: 'near-miss', name: 'a tile held by half an edge with a thin gap under its other half, against one that falls off on points (best: with a top just below)',
    is: p => p.A.type !== 'dn' && p.A.type === p.B.type && p.A.d.thin !== null && p.B.reason === POINT, pref: p => p.B.d.nearOff !== null ? -3 : 0 },
  // (the extra tile is an overhang: all of it above where the tile sits without it)
  { id: 'pocket', name: 'only from above: a tile stopped on an overhang, against the same tile dropping into the pocket below without it',
    is: p => p.kind === 'add' && p.extra.on === 'B' && p.B.reason === POINT && p.A.col === p.B.col && p.A.type === p.B.type &&
      lib.cmp(p.B.res.pose.y, p.A.res.pose.y) > 0 && p.extra.verts.every(v => lib.cmp([v[1], v[2]], p.A.res.pose.y) > 0) },
  { id: 'tips-dn', name: 'a ▼ that meets the tower edge to edge but tips part of it, against one that stays',
    is: p => p.A.type === 'dn' && p.B.type === 'dn' && p.B.reason === TIPS },
  { id: 'tips-sq', name: 'a square that meets the tower edge to edge but tips part of it, against one that stays (or a ▲ there that stays)',
    is: p => p.B.type === 'sq' && (p.A.type === 'sq' || p.kind === 'piece') && p.B.reason === TIPS },
  { id: 'tips-up', name: 'a ▲ that meets the tower edge to edge but tips part of it, against one that stays',
    is: p => p.A.type === 'up' && p.B.type === 'up' && p.B.reason === TIPS },
  { id: 'lock', name: 'whole edges lock: the builds differ by one tile that shares a whole edge with the part that tips',
    is: p => p.kind === 'add' && p.B.reason === TIPS && samePose(p) && memberVerts(p.B).some(v => shareEdge(v, p.extra.verts)) }
];
// the lock stratum first: its pairs are not also TIPS OVER pairs of the plain kind
const ORDER = ['lock', 'pocket', 'near-miss', 'sq-flat', 'sq-half', 'up-flat', 'up-half', 'dn-side', 'dn-notch', 'tips-dn', 'tips-sq', 'tips-up'];

// a pair as items to show: two {log, piece, col, way}, maybe mirrored
function mirrorSide(it, m) {
  const log = m ? canon.mirrorLog(it.log) : it.log;
  return { log: log.map(e => ({ piece: e.piece, col: e.col, way: e.piece === 'sq' ? null : e.way })), piece: it.piece, col: m ? canon.mirrorCol(it.col) : it.col, way: it.way };
}
// choose `per` pairs for every stratum: small, low builds first, a mix of pair kinds, no build or item twice
function choose(P, per, rnd, opts) {
  opts = opts || {};
  const used = opts.used || new Set(), usedB = opts.usedB || new Set(), byStratum = {};
  const cost = p => Math.max(p.A.n, p.B.n) + 0.6 * Math.max(p.A.h, p.B.h) + 0.5 * rnd();
  for (const sid of ORDER) {
    const S = STRATA.find(s => s.id === sid), cands = P.pairs.filter(p => !used.has(p.A.id) && !used.has(p.B.id) && S.is(p));
    cands.forEach(p => { p.c = cost(p) + (p.A.n === 0 && p.B.n === 0 ? 3 : 0) + (S.pref ? S.pref(p) : 0); });
    cands.sort((a, b) => a.c - b.c);
    const got = [], kinds = {}, mixes = {};
    const take = (p) => {
      got.push(p); used.add(p.A.id); used.add(p.B.id); usedB.add(p.A.ck); usedB.add(p.B.ck);
      kinds[p.kind] = (kinds[p.kind] || 0) + 1;
      if (S.mix) mixes[S.mix(p)] = (mixes[S.mix(p)] || 0) + 1;
    };
    // first pass: no build already shown, no more than half of one pair kind, the stratum's mix spread
    for (const p of cands) {
      if (got.length >= per) break;
      if (used.has(p.A.id) || used.has(p.B.id) || usedB.has(p.A.ck) || usedB.has(p.B.ck)) continue;
      if ((kinds[p.kind] || 0) >= Math.ceil(per / 2)) continue;
      if (S.mix && (mixes[S.mix(p)] || 0) >= Math.ceil(per / 2)) continue;
      take(p);
    }
    for (const p of cands) { if (got.length >= per) break; if (!used.has(p.A.id) && !used.has(p.B.id) && !usedB.has(p.A.ck) && !usedB.has(p.B.ck)) take(p); }
    for (const p of cands) { if (got.length >= per) break; if (!used.has(p.A.id) && !used.has(p.B.id)) take(p); }
    byStratum[sid] = { S, pairs: got, candidates: cands.length };
  }
  return byStratum;
}
// the fit items of the chosen pairs, each pair maybe mirrored (both items alike)
function fitItems(byStratum, rnd, prefix) {
  const out = [];
  let k = 0;
  for (const sid of STRATA.map(s => s.id)) {
    const { S, pairs } = byStratum[sid];
    pairs.forEach((p, i) => {
      const m = rnd() < 0.5, pid = (prefix || '') + sid + '#' + (i + 1);
      for (const [it, role] of [[p.A, 'stays'], [p.B, 'falls']]) {
        const show = mirrorSide(it, m);
        out.push({ kind: prefix ? 'ghost' : 'fit', stratum: sid, stratumName: S.name, pair: pid, pairKind: p.kind, mirrored: m,
          build: show.log, hand: { piece: show.piece, col: show.col, way: show.way }, answer: it.fit ? 'STAYS' : 'FALLS OFF', reason: it.reason || null,
          tips: it.res.tips ? { side: m ? (it.res.tips.side === 'left' ? 'right' : 'left') : it.res.tips.side, members: it.res.tips.members.length } : null, propped: proppedOf(it),
          extra: p.kind === 'add' ? { tile: fmt(p.extra.drop.piece, m ? canon.mirrorCol(p.extra.drop.col) : p.extra.drop.col, p.extra.drop.way), in: (p.extra.on === 'A') === (role === 'stays') ? 'this build' : 'the partner' } : null,
          held: it.d.held, sides: it.d.sides === undefined ? null : it.d.sides, gap: it.d.thin, uid: it.id + (m ? '|m' : '') });
        k++;
      }
    });
  }
  return out;
}

// ---- which way up ----
// Half ▲, half ▼. A ▼ that stays never has a flat top under its point (it hangs at a ▲'s corner), so the "flat under
// the middle" baseline gets every ▼ right; most of the ▲ are ones it gets wrong (its middle over a point, a slant or a
// step: held by half its base). Builds of 2 to 5 tiles first.
function wayItems(P, n, rnd, used) {
  const Rr = R(), cands = [];
  for (const nd of P.nodes) {
    if (nd.depth < 1) continue;
    for (const col of Rr.cols(nd.B, 'tri')) {
      const u = nd.items.get('tri' + col + 'up'), d = nd.items.get('tri' + col + 'down');
      if (u.fit === d.fit) continue;
      if (used.has(u.id) || used.has(d.id)) continue;
      const right = u.fit ? u : d, wrong = u.fit ? d : u;
      cands.push({ nd, col, answer: u.fit ? 'UP' : 'DOWN', wrongReason: wrong.reason, ck: nd.ck, c: 0.6 * Math.abs(nd.depth - 3.5) + 0.3 * lib.yv(right.res.pose.y) + rnd(), right, wrong });
    }
  }
  cands.sort((a, b) => a.c - b.c);
  const got = [], seen = new Set(), quota = {};
  const q = c => c.answer + (c.flatRight ? '+' : '-');
  for (const pass of [0, 1]) for (const c of cands) {
    if (got.length >= n) break;
    if (seen.has(c.ck)) continue;
    if (c.flatRight === undefined) { const flat = flatUnderMiddle(c.nd.log, { piece: 'tri', col: c.col }); c.flatRight = flat === (c.answer === 'UP'); }
    // pass 0: the quotas (▲ the flat test gets wrong: 3/8 of the items, right: 1/8; ▼: half); pass 1: what is missing,
    // by answer only
    const max = { 'UP-': Math.round(3 * n / 8), 'UP+': Math.round(n / 8), 'DOWN+': n / 2, 'DOWN-': n / 2 }[q(c)];
    if (pass === 0 && (quota[q(c)] || 0) >= max) continue;
    if (pass === 1 && got.filter(g => g.answer === c.answer).length >= n / 2) continue;
    seen.add(c.ck); quota[q(c)] = (quota[q(c)] || 0) + 1; got.push(c);
  }
  return got.map(c => {
    const m = rnd() < 0.5, show = mirrorSide(c.right, m);
    used.add(c.right.id); used.add(c.wrong.id);
    return { kind: 'way', build: show.log, hand: { piece: 'tri', col: show.col, way: null }, answer: c.answer, wrongReason: c.wrongReason, mirrored: m, uid: c.right.id + (m ? '|m' : '') };
  });
}

// ---- where can it go ----
const LETTERS = 'ABCDEFGHI';
function whereItems(P, n, rnd, used) {
  const Rr = R(), cands = [];
  for (const nd of P.nodes) {
    if (nd.depth < 3) continue;
    for (const piece of ['sq', 'tri']) {
      const cols = Rr.cols(nd.B, piece);
      const fits = cols.map(col => piece === 'sq' ? nd.items.get('sq' + col).fit : nd.items.get('tri' + col + 'up').fit || nd.items.get('tri' + col + 'down').fit);
      const k = fits.filter(Boolean).length;
      if (k < 1 || k > cols.length - 1) continue;
      // not one run of neighbours only, for triangles (a set worth working out)
      cands.push({ nd, piece, cols, fits, k, c: Math.abs(k - (piece === 'sq' ? 2 : 3.5)) + 0.4 * nd.depth + rnd() });
    }
  }
  cands.sort((a, b) => a.c - b.c);
  const got = [], seen = new Set();
  for (const piece of ['sq', 'tri']) {
    for (const c of cands) {
      if (got.filter(g => g.piece === piece).length >= n / 2) break;
      if (c.piece !== piece || seen.has(c.nd.ck)) continue;
      seen.add(c.nd.ck); got.push(c);
    }
  }
  return got.map(c => {
    const m = rnd() < 0.5, log = m ? canon.mirrorLog(c.nd.log) : c.nd.log;
    const cols = c.cols.map(col => m ? canon.mirrorCol(col) : col);
    const order = cols.map((col, i) => ({ col, fit: c.fits[i] })).sort((a, b) => a.col - b.col);
    return { kind: 'where', build: log.map(e => ({ piece: e.piece, col: e.col, way: e.piece === 'sq' ? null : e.way })), hand: { piece: c.piece, col: null, way: null },
      columns: order.map((o, i) => ({ label: LETTERS[i], col: o.col })), answer: order.map((o, i) => o.fit ? LETTERS[i] : null).filter(Boolean), mirrored: m,
      uid: c.nd.ck + '|' + c.piece + (m ? '|m' : '') };
  });
}

// ---- geometry for probes and the flat-under-the-middle baseline ----
// what is directly under x (a float, L) in a build: the topmost tile there (its index), or the car (-1), or nothing
// (-2), and its top there; ambiguous when the two sides of x see different things
function topAtX(T, x) {
  const look = xx => {
    let best = { i: xx >= -HALF && xx <= HALF ? -1 : -2, y: xx >= -HALF && xx <= HALF ? 0 : -Infinity };
    T.forEach((t, i) => {
      const p = lib.polyOf(t);
      let top = -Infinity;
      for (let k = 0; k < p.length; k++) {
        const a = p[k], b = p[(k + 1) % p.length];
        if (xx < Math.min(a.x, b.x) - 1e-9 || xx > Math.max(a.x, b.x) + 1e-9 || Math.abs(b.x - a.x) < 1e-12) continue;
        top = Math.max(top, a.y + (b.y - a.y) * (xx - a.x) / (b.x - a.x));
      }
      if (top > best.y + 1e-9) best = { i, y: top };
    });
    return best;
  };
  const l = look(x - 1e-4), r = look(x + 1e-4);
  return { left: l, right: r, same: l.i === r.i && Math.abs(l.y - r.y) < 1e-3 };
}
// the baseline "it stays if the thing under its middle is flat": the topmost thing under the middle of the tile's
// bottom (a ▼: under its point) has a flat top there (the car, a square's top, a ▼'s top); an apex, a slant, a corner
// where two tops meet at different heights, or nothing (the air past the car) is not flat
function flatUnderMiddle(build, hand) {
  const B = buildOf(build), T = R().tiles(B), x = hand.col / 2 + 0.5, s = topAtX(T, x);
  if (!s.same) return false;
  if (s.left.i === -2) return false;
  if (s.left.i === -1) return true;
  const t = T[s.left.i];
  return t.piece === 'sq' || t.way === 'down';
}
// tiles touching the car top (their bottom, or a ▼'s point, on it)
function onCar(T) { return T.filter(t => t.y[0] === 0 && t.y[1] === 0 && (t.way === 'down' ? Math.abs(t.col / 2 + 0.5) <= HALF : t.col / 2 < HALF && t.col / 2 + 1 > -HALF)).length; }

module.exports = { pool, STRATA, ORDER, choose, fitItems, wayItems, whereItems, topAtX, flatUnderMiddle, onCar, buildOf, shareEdge, LETTERS, fmt, typeOf, HALF };
