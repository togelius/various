/* CLACK STACK rules, revision 5d (DESIGN.md §18.1–18.3 and §18.7; the precise reading is tools/oracle/SPEC.md, which
   wins on rules). The one source of where a tile can go and why it falls off. Pure: no DOM, no time, no randomness,
   no globals but the language's own. It runs in an empty vm context (tools/lib/rules-vm.cjs) and is inlined into
   index.html between the RULES markers by tools/build.cjs.

   Two rules, tested in this order (SPEC §5):
   1. Edge to edge (§5a, §5b): a tile stays only if it meets the tower edge to edge along at least half an edge.
      - A square or ▲ needs part of its bottom edge (on this lattice, half of it or all of it) on a flat top: the car,
        a square's top or a ▼'s top. The rest may be over a lower top, a slant or nothing.
      - A ▼ needs one of its lower sides whole against a ▲'s side (two such sides: it sits in a notch).
      Otherwise it falls off: ONLY A POINT.
   2. Everything balances (§5c, revision 5d): tiles that share a whole edge are locked together and move as one piece
      (half an edge or a point holds a piece up but does not lock it; the car locks to nothing). With the tile added,
      the group of every piece (the piece, everything resting on it and everything locked to that, all the way up)
      must have its weight over what it rests on, exactly over an end included. There is no grip. Otherwise: TIPS OVER.

   Numbers are exact. A point is a lattice point (X, a, b): x = X/2, y = a + b·h with h = √3/2. The comparison format
   writes it as SPEC's [X, p, q] with y = (p + q√3)/2, so p = 2a and q = b. Two heights are compared in integers
   (sign of 2·Δa + Δb·√3), and every balance sum is an integer pair (u + v√3), never a float.

   A tile is { t: 'sq' | 'up' | 'dn', c: col, a, b, i: its index in the build }:
   - 'sq' its lower-left corner at (c, a, b);
   - 'up' (▲) its base from (c, a, b) to (c + 2, a, b), apex (c + 1, a, b + 1);
   - 'dn' (▼) its point at (c + 1, a, b), its top edge from (c, a, b + 1) to (c + 2, a, b + 1).
   Every tile spans two half-tile columns: column s is x from s/2 to s/2 + 1/2, and a tile at col c spans c and c + 1.
   Over one column a tile's top is a straight line, and the topmost thing in a column lies above every other thing in
   it at both of the column's ends (two tiles that span a column and don't overlap can't cross inside it). */
var RULES = (function () {
  'use strict';

  // the reasons a tile falls off, in the order they are tested (DESIGN §18.2)
  var REASONS = ['ONLY A POINT', 'TIPS OVER'];
  var R3 = Math.sqrt(3); // for drawing only (tips.com); never in a decision

  // sign of (a1 + b1·h) − (a2 + b2·h), h = √3/2: the sign of 2·da + db·√3, decided in integers
  function cmpH(a1, b1, a2, b2) { return sgn3(2 * (a1 - a2), b1 - b2); }
  // sign of p + q·√3
  function sgn3(p, q) {
    if (p === 0 && q === 0) return 0;
    if (p >= 0 && q >= 0) return 1;
    if (p <= 0 && q <= 0) return -1;
    var l = p * p, r = 3 * q * q; // never equal: √3 is irrational
    return p > 0 ? (l > r ? 1 : -1) : (l > r ? -1 : 1);
  }

  // Over each of its two columns (0 left, 1 right) a tile's top and underside are straight, so each is given by its
  // height at the column's left and right end, as lattice offsets [a_left, b_left, a_right, b_right] from (a, b).
  var TOP = {
    sq: [[1, 0, 1, 0], [1, 0, 1, 0]],
    up: [[0, 0, 0, 1], [0, 1, 0, 0]],
    dn: [[0, 1, 0, 1], [0, 1, 0, 1]]
  };
  var BOT = {
    sq: [[0, 0, 0, 0], [0, 0, 0, 0]],
    up: [[0, 0, 0, 0], [0, 0, 0, 0]],
    dn: [[0, 1, 0, 0], [0, 0, 0, 1]]
  };
  // a top is flat (and so can hold a bottom edge) for squares and ▼; a ▲'s top is two slants
  var FLAT = { sq: true, up: false, dn: true };
  var WAY = { sq: null, up: 'up', dn: 'down' };

  // ---- builds (immutable) ----
  // { half, tiles: [tile] in placing order, log: [{piece, col, way}], idx: per half-tile column the tiles spanning it,
  //   rests: per tile, what it rests on ([{i: a tile's index or −1 for the car, lo, hi: the contact's ends, hi null for
  //   a point}]; a tile only ever rests on tiles placed before it), locks: per tile, the tiles locked to it, and the
  //   pieces and groups those make (pc: per tile its piece; pieces: see structure) }
  function off(B) { return 2 * B.half + 1; }
  function freezeBuild(B) {
    for (var k = 0; k < B.idx.length; k++) if (B.idx[k]) Object.freeze(B.idx[k]);
    Object.freeze(B.idx); Object.freeze(B.tiles); Object.freeze(B.log); Object.freeze(B.rests); Object.freeze(B.locks);
    Object.freeze(B.pc); Object.freeze(B.pieces);
    return Object.freeze(B);
  }
  function newBuild(opts) {
    var half = opts && opts.half !== undefined ? opts.half : 2;
    if (typeof half !== 'number' || half !== Math.floor(half) || half < 1) throw new Error('newBuild: half must be a whole number of tiles, at least 1');
    var idx = [];
    for (var k = 0; k < 4 * half + 2; k++) idx.push(null);
    return freezeBuild({ half: half, tiles: [], log: [], idx: idx, rests: [], locks: [], pc: [], pieces: [] });
  }
  function inCol(B, s) { var k = s + off(B); return k >= 0 && k < B.idx.length ? B.idx[k] : null; }
  function carIn(B, s) { return s >= -2 * B.half && s < 2 * B.half; }

  // ---- the drop and the fit ----
  // The topmost thing in column s: whether there is anything (any), its top at the column's two ends (e0, e1), and
  // whether it is a flat top (the car, a square, a ▼).
  function colTop(B, s) {
    var any = false, e0a = 0, e0b = 0, e1a = 0, e1b = 0, flat = false;
    if (carIn(B, s)) { any = true; flat = true; }
    var list = inCol(B, s);
    if (list) for (var k = 0; k < list.length; k++) {
      var t = list[k], top = TOP[t.t][s - t.c];
      var ta0 = t.a + top[0], tb0 = t.b + top[1], ta1 = t.a + top[2], tb1 = t.b + top[3];
      // the topmost tile is above the others at both ends, so comparing the left end decides (ties: the same height
      // at the left end means touching there, and then the right end decides)
      var c0 = any ? cmpH(ta0, tb0, e0a, e0b) : 1;
      if (c0 > 0 || (c0 === 0 && cmpH(ta1, tb1, e1a, e1b) > 0)) { e0a = ta0; e0b = tb0; e1a = ta1; e1b = tb1; flat = FLAT[t.t]; }
      any = true;
    }
    return { any: any, e0a: e0a, e0b: e0b, e1a: e1a, e1b: e1b, flat: flat };
  }
  // the ▲ at col c whose base is at (a, b), or null
  function upAt(B, c, a, b) {
    var list = inCol(B, c + 1);
    if (list) for (var k = 0; k < list.length; k++) {
      var t = list[k];
      if (t.t === 'up' && t.c === c && t.a === a && t.b === b) return t;
    }
    return null;
  }
  // Where a tile of type `type` at col stops, and whether it meets the tower edge to edge there. The tile falls from
  // far above; over each of its columns the gap between its underside and a thing's top is linear, so it stops at the
  // largest (top − underside) over its two columns, both ends of each, and every thing in them (the car and the tiles).
  function core(B, type, col) {
    var bot = BOT[type], ra = 0, rb = 0, hit = false;
    for (var j = 0; j < 2; j++) {
      var s = col + j, u = bot[j];
      if (carIn(B, s)) for (var e = 0; e < 2; e++) {
        var ca = -u[2 * e], cb = -u[2 * e + 1];
        if (!hit || cmpH(ca, cb, ra, rb) > 0) { ra = ca; rb = cb; hit = true; }
      }
      var list = inCol(B, s);
      if (list) for (var k = 0; k < list.length; k++) {
        var t = list[k], top = TOP[t.t][s - t.c];
        for (var e2 = 0; e2 < 2; e2++) {
          var na = t.a + top[2 * e2] - u[2 * e2], nb = t.b + top[2 * e2 + 1] - u[2 * e2 + 1];
          if (!hit || cmpH(na, nb, ra, rb) > 0) { ra = na; rb = nb; hit = true; }
        }
      }
    }
    if (!hit) throw new Error('drop: nothing at all below col ' + col);
    if (type === 'dn') {
      // a ▼ hangs on a ▲'s side: its left side on the right side of a ▲ at col − 1, its right side on the left side
      // of a ▲ at col + 1, both with their base at the ▼'s point
      var sides = (upAt(B, col - 1, ra, rb) ? 1 : 0) + (upAt(B, col + 1, ra, rb) ? 2 : 0);
      return { a: ra, b: rb, fit: sides > 0, gap: null, held: sides };
    }
    // a square or a ▲: its bottom edge is flat at (ra, rb); it stays when a flat top lies at exactly that height
    // under one of its columns (half its bottom edge) or both (all of it)
    var held = 0, lo = null;
    for (var j2 = 0; j2 < 2; j2++) {
      var T = colTop(B, col + j2);
      if (!T.any) continue; // nothing below here: no gap is measured over the air
      if (T.flat && T.e0a === ra && T.e0b === rb && T.e1a === ra && T.e1b === rb) held |= 1 << j2;
      if (!lo || cmpH(T.e0a, T.e0b, lo[0], lo[1]) < 0) lo = [T.e0a, T.e0b];
      if (cmpH(T.e1a, T.e1b, lo[0], lo[1]) < 0) lo = [T.e1a, T.e1b];
    }
    var fit = held > 0, gap = null;
    // the gap (SPEC §5a): how far the deepest part of what lies under the bottom edge is below it, for drawing the
    // thin gap open; the deepest is at an end of a column (the tops are straight over a column)
    if (fit && lo && cmpH(lo[0], lo[1], ra, rb) < 0) gap = [2 * (ra - lo[0]), rb - lo[1]];
    return { a: ra, b: rb, fit: fit, gap: gap, held: held };
  }

  // ---- geometry for the contacts ----
  function vertsOf(t, c, a, b) {
    if (t === 'sq') return [[c, a, b], [c + 2, a, b], [c + 2, a + 1, b], [c, a + 1, b]];
    if (t === 'up') return [[c, a, b], [c + 2, a, b], [c + 1, a, b + 1]];
    return [[c + 1, a, b], [c + 2, a, b + 1], [c, a, b + 1]];
  }
  // is lattice point (X, a, b) in the closed tile?
  function inside(t, X, a, b) {
    var c = t.c;
    if (X < c || X > c + 2) return false;
    if (t.t === 'sq') return cmpH(a, b, t.a, t.b) >= 0 && cmpH(a, b, t.a + 1, t.b) <= 0;
    var k = X - c; if (k > 1) k = 2 - k; // half tiles from the nearer end: 0 at an end, 1 in the middle
    if (t.t === 'up') return cmpH(a, b, t.a, t.b) >= 0 && cmpH(a, b, t.a, t.b + k) <= 0;
    return cmpH(a, b, t.a, t.b + 1) <= 0 && cmpH(a, b, t.a, t.b + 1 - k) >= 0;
  }
  // order along a line: by x, then by y
  function cmpPt(p, q) { return p[0] !== q[0] ? p[0] - q[0] : cmpH(p[1], p[2], q[1], q[2]); }
  // [X, a, b] -> SPEC's [X, p, q]
  function out(p) { return [p[0], 2 * p[1], p[2]]; }
  function lex(p, q) { return p[0] - q[0] || p[1] - q[1] || p[2] - q[2]; }
  function lexSeg(s, r) { return lex(s[0], r[0]) || lex(s[1], r[1]); }
  function seg(p, q) { var A = out(p), B = out(q); return lex(A, B) <= 0 ? [A, B] : [B, A]; }
  // Two convex tiles whose insides don't overlap meet in a segment, a point or not at all, and every end of that is a
  // corner of one of them (a crossing inside two edges would mean overlap): so it is spanned by the corners of each
  // that lie on the other.
  function meet(T, VT, N) {
    var pts = [], VN = vertsOf(N.t, N.c, N.a, N.b), k, p;
    for (k = 0; k < VT.length; k++) { p = VT[k]; if (inside(N, p[0], p[1], p[2])) pts.push(p); }
    for (k = 0; k < VN.length; k++) { p = VN[k]; if (inside(T, p[0], p[1], p[2])) pts.push(p); }
    if (!pts.length) return null;
    var lo = pts[0], hi = pts[0];
    for (k = 1; k < pts.length; k++) {
      if (cmpPt(pts[k], lo) < 0) lo = pts[k];
      if (cmpPt(pts[k], hi) > 0) hi = pts[k];
    }
    return cmpPt(lo, hi) === 0 ? { pt: lo } : { seg: [lo, hi] };
  }
  function onSeg(q, s) {
    var p1 = s[0], p2 = s[1];
    var dx = p2[0] - p1[0], dA = 2 * (p2[1] - p1[1]), dB = p2[2] - p1[2];
    var wx = q[0] - p1[0], wA = 2 * (q[1] - p1[1]), wB = q[2] - p1[2];
    if (dx * wA - wx * dA !== 0 || dx * wB - wx * dB !== 0) return false; // not on the line
    if (dx !== 0) return (q[0] - p1[0]) * (q[0] - p2[0]) <= 0;
    return cmpH(q[1], q[2], p1[1], p1[2]) * cmpH(q[1], q[2], p2[1], p2[2]) <= 0;
  }
  // every contact of tile T (resting, not yet placed) with the car top and the tiles that reach its x range: the
  // comparison format's {segments, points}, and per touching tile what they share (nb: [{t, m}], for the balance)
  function contacts(B, T) {
    var VT = vertsOf(T.t, T.c, T.a, T.b), segs = [], pts = [], nb = [], c = T.c, h2 = 2 * B.half, k, m;
    // the car: the region x in [−half, half], y ≤ 0; tiles never go below y = 0
    if (T.a === 0 && T.b === 0) {
      if (T.t === 'dn') { if (c + 1 >= -h2 && c + 1 <= h2) pts.push([c + 1, 0, 0]); }
      else {
        var lo = Math.max(c, -h2), hi = Math.min(c + 2, h2);
        if (lo < hi) segs.push([[lo, 0, 0], [hi, 0, 0]]);
        else if (lo === hi) pts.push([lo, 0, 0]);
      }
    }
    // T's height range, to skip the tiles wholly above or below it: [a, b] of its lowest and highest points
    var ta = T.a, tb = T.b, ua = T.t === 'sq' ? T.a + 1 : T.a, ub = T.t === 'sq' ? T.b : T.b + 1;
    for (var s = c - 1; s <= c + 2; s++) {
      var list = inCol(B, s);
      if (list) for (k = 0; k < list.length; k++) {
        var N = list[k];
        if (s !== Math.max(N.c, c - 1)) continue; // each neighbour once
        if (cmpH(N.a, N.b, ua, ub) > 0 || cmpH(N.t === 'sq' ? N.a + 1 : N.a, N.t === 'sq' ? N.b : N.b + 1, ta, tb) < 0) continue;
        m = meet(T, VT, N);
        if (!m) continue;
        nb.push({ t: N, m: m });
        if (m.seg) segs.push(m.seg); else pts.push(m.pt);
      }
    }
    var S = [], P = [], seen = {};
    for (k = 0; k < segs.length; k++) S.push(seg(segs[k][0], segs[k][1]));
    S.sort(lexSeg);
    for (k = 0; k < pts.length; k++) {
      var q = pts[k], key = q.join(',');
      if (seen[key]) continue;
      seen[key] = true;
      var on = false;
      for (m = 0; m < segs.length && !on; m++) on = onSeg(q, segs[m]);
      if (!on) P.push(out(q));
    }
    P.sort(lex);
    return { segments: S, points: P, nb: nb };
  }

  // ---- BALANCE (SPEC §5c, revision 5d) ----
  // U rests on V when, over a half-tile column both span, U's underside meets V's top at an end of the column: they
  // touch there and, just inside the column, U's inside lies straight above V's (over one column two tiles are two
  // stacked intervals, so equal ends mean touching, never crossing). Side by side, two tiles share no column. This
  // is only ever asked with U the tile being dropped, which is above every placed tile it shares a column with (it
  // came down from above, so no placed tile ever rests on it); for two tiles in either order it would also need U on
  // top, because where a ▲ sits on a ▼'s top their corners meet at the column's end with the ▼ below.
  function restsOn(U, V) {
    for (var s = Math.max(U.c, V.c); s <= Math.min(U.c, V.c) + 1; s++) {
      var u = BOT[U.t][s - U.c], v = TOP[V.t][s - V.c];
      if ((U.a + u[0] === V.a + v[0] && U.b + u[1] === V.b + v[1]) || (U.a + u[2] === V.a + v[2] && U.b + u[3] === V.b + v[3])) return true;
    }
    return false;
  }
  // U rests on the car: its underside at height 0 at an end of a column over the car
  function restsOnCar(B, U) {
    for (var s = U.c; s <= U.c + 1; s++) {
      if (!carIn(B, s)) continue;
      var u = BOT[U.t][s - U.c];
      if ((U.a + u[0] === 0 && U.b + u[1] === 0) || (U.a + u[2] === 0 && U.b + u[3] === 0)) return true;
    }
    return false;
  }
  // Two tiles are locked together when they share a whole edge: their contact (meet()) is a segment of length 1. On
  // this lattice that is a flat segment one tile long (a tile seated squarely on a top), a slanted one half a tile
  // across and h high (a ▼ hung on a ▲), or an upright one a tile high (two level squares side by side). Half an edge,
  // any shorter upright contact and a point do not lock; the car locks to nothing (its contact is never asked).
  // Returns the lock's direction, or null.
  function lockOf(m) {
    if (!m.seg) return null;
    var p = m.seg[0], q = m.seg[1], dX = Math.abs(q[0] - p[0]), da = Math.abs(q[1] - p[1]), db = Math.abs(q[2] - p[2]);
    if (dX === 2 && da === 0 && db === 0) return 'flat';
    if (dX === 1 && da === 0 && db === 1) return 'slant';
    if (dX === 0 && da === 1 && db === 0) return 'side';
    return null;
  }
  function num(x, y) { return x - y; }
  // The pieces and groups of a build (SPEC §5c), from each tile's rests and locks. A piece is a set of tiles joined by
  // a chain of locks; the group of a piece is the smallest set that holds the piece, every tile resting on a tile of
  // the set and every tile locked to one, so it is made of whole pieces. Returns pc (per tile, its piece) and pieces:
  // per piece its tiles (sorted), its base (the lowest tile, the smaller col on a tie: SPEC's base, and the tile whose
  // col breaks a tie between pieces), its group G (sorted) and inG (per tile, 1 when it is in the group).
  function structure(T, rests, locks) {
    var n = T.length, pc = [], pieces = [], above = [], i, j, k, h;
    for (i = 0; i < n; i++) { pc.push(-1); above.push([]); }
    for (i = 0; i < n; i++) for (k = 0; k < rests[i].length; k++) if (rests[i][k].i >= 0) above[rests[i][k].i].push(i);
    for (i = 0; i < n; i++) {
      if (pc[i] >= 0) continue;
      var id = pieces.length, tl = [i];
      pc[i] = id;
      for (k = 0; k < tl.length; k++) {
        var LK = locks[tl[k]];
        for (j = 0; j < LK.length; j++) if (pc[LK[j]] < 0) { pc[LK[j]] = id; tl.push(LK[j]); }
      }
      tl.sort(num);
      var base = tl[0];
      for (k = 1; k < tl.length; k++) {
        var t = T[tl[k]], bt = T[base], c = cmpH(t.a, t.b, bt.a, bt.b);
        if (c < 0 || (c === 0 && t.c < bt.c)) base = tl[k];
      }
      pieces.push({ tiles: tl, base: base, G: null, inG: null });
    }
    for (k = 0; k < pieces.length; k++) {
      var inG = [], G = pieces[k].tiles.slice();
      for (i = 0; i < n; i++) inG.push(0);
      for (i = 0; i < G.length; i++) inG[G[i]] = 1;
      // everything resting on a tile of the group joins it, with its whole piece (so the group stays closed under locks)
      for (h = 0; h < G.length; h++) {
        var A = above[G[h]];
        for (j = 0; j < A.length; j++) if (!inG[A[j]]) { var P2 = pieces[pc[A[j]]].tiles; for (var m2 = 0; m2 < P2.length; m2++) if (!inG[P2[m2]]) { inG[P2[m2]] = 1; G.push(P2[m2]); } }
      }
      G.sort(num);
      pieces[k].G = Object.freeze(G); pieces[k].inG = Object.freeze(inG);
      Object.freeze(pieces[k].tiles); Object.freeze(pieces[k]);
    }
    return { pc: pc, pieces: pieces };
  }
  // A group's sums, all integers. Weights are taken ×4 (a square 4, a triangle √3) and x in half tiles (X, a tile's
  // middle at X = col + 1), so W·x past X0 is 4·(sS − nS·X0) + √3·(sT − nT·X0) in those units, 8 times SPEC's. Its
  // support is kept as its least and greatest X (x0, x1) and the lowest support point at each (pL, pR, the pivots).
  function newAgg() { return { nS: 0, nT: 0, sS: 0, sT: 0, x0: 0, x1: 0, pL: null, pR: null }; }
  function addWeight(g, T) { if (T.t === 'sq') { g.nS++; g.sS += T.c + 1; } else { g.nT++; g.sT += T.c + 1; } }
  function addPoint(g, p) {
    if (!g.pL || p[0] < g.x0 || (p[0] === g.x0 && cmpH(p[1], p[2], g.pL[1], g.pL[2]) < 0)) { g.x0 = p[0]; g.pL = p; }
    if (!g.pR || p[0] > g.x1 || (p[0] === g.x1 && cmpH(p[1], p[2], g.pR[1], g.pR[2]) < 0)) { g.x1 = p[0]; g.pR = p; }
  }
  function addContact(g, d) { addPoint(g, d.lo); if (d.hi) addPoint(g, d.hi); }
  // a group is balanced when W·xmin ≤ M ≤ W·xmax (exactly over an end included; no grip): null then, else the side
  // it leans to
  function leanOf(g) {
    var A = 4 * (g.sS - g.nS * g.x1), Q = g.sT - g.nT * g.x1;
    if (sgn3(A, Q) > 0) return 'right';
    A = 4 * (g.nS * g.x0 - g.sS); Q = g.nT * g.x0 - g.sT;
    if (sgn3(A, Q) > 0) return 'left';
    return null;
  }
  // The balance with tile N (not placed yet; it met the tower edge to edge) added to build B: D, what N rests on, with
  // each contact; L, the tiles N is locked to. Every group of B is balanced (place() only adds tiles that fit), and a
  // group N does not join is the same set with the same support as before, so only the groups N joins are tested:
  // - N's own piece: N and every piece it locks to, merged; its group X is N and those pieces' groups;
  // - every other piece of B whose group holds a tile N rests on or is locked to: its group gains X.
  // Returns {D, L, fails: [{base, members, g, side}] for the groups that are not balanced}.
  function balance(B, N, nb) {
    var n = B.tiles.length, D = [], L = [], h2 = 2 * B.half, j, k, u;
    if (restsOnCar(B, N)) {
      if (N.t === 'dn') D.push({ i: -1, lo: [N.c + 1, 0, 0], hi: null });
      else {
        var lo = Math.max(N.c, -h2), hi = Math.min(N.c + 2, h2);
        D.push(lo < hi ? { i: -1, lo: [lo, 0, 0], hi: [hi, 0, 0] } : { i: -1, lo: [lo, 0, 0], hi: null });
      }
    }
    for (k = 0; k < nb.length; k++) {
      var V = nb[k].t, m = nb[k].m;
      if (lockOf(m)) L.push(V.i);
      if (!restsOn(N, V)) continue;
      D.push(m.pt ? { i: V.i, lo: m.pt, hi: null } : { i: V.i, lo: m.seg[0], hi: m.seg[1] });
    }
    var P = B.pieces, merged = [], inX = [], X = [n], base = n, bt = N;
    for (j = 0; j < n; j++) inX.push(0);
    inX.push(1);
    for (k = 0; k < L.length; k++) {
      var q = B.pc[L[k]];
      if (merged.indexOf(q) >= 0) continue;
      merged.push(q);
      var G = P[q].G, t = B.tiles[P[q].base], c = cmpH(t.a, t.b, bt.a, bt.b);
      for (j = 0; j < G.length; j++) if (!inX[G[j]]) { inX[G[j]] = 1; X.push(G[j]); }
      if (c < 0 || (c === 0 && t.c < bt.c)) { base = P[q].base; bt = t; }
    }
    var groups = [{ base: base, members: X, inA: null }];
    for (k = 0; k < P.length; k++) {
      if (merged.indexOf(k) >= 0) continue;
      var inG = P[k].inG, hit = false;
      for (j = 0; j < D.length && !hit; j++) if (D[j].i >= 0 && inG[D[j].i]) hit = true;
      for (j = 0; j < L.length && !hit; j++) if (inG[L[j]]) hit = true;
      if (!hit) continue;
      var M2 = P[k].G.slice();
      for (j = 0; j < X.length; j++) if (!inG[X[j]]) M2.push(X[j]);
      groups.push({ base: P[k].base, members: M2, inA: inG });
    }
    var fails = [];
    for (k = 0; k < groups.length; k++) {
      var gr = groups[k], g = newAgg(), mem = gr.members, inA = gr.inA;
      for (j = 0; j < mem.length; j++) addWeight(g, mem[j] === n ? N : B.tiles[mem[j]]);
      // its support: what a tile of the group rests on outside it (a tile inside the group holds nothing up from outside)
      for (j = 0; j < mem.length; j++) {
        var rs = mem[j] === n ? D : B.rests[mem[j]];
        for (u = 0; u < rs.length; u++) { var ri = rs[u].i; if (ri < 0 || !(inX[ri] || (inA && inA[ri]))) addContact(g, rs[u]); }
      }
      var side = g.pL ? leanOf(g) : null;
      if (side) fails.push({ base: gr.base, members: mem, g: g, side: side });
    }
    return { D: D, L: L, fails: fails };
  }
  // what the result says when something tips (DESIGN §18.7, SPEC §5c): of the pieces whose group is not balanced, the
  // one whose lowest point is lowest; on a tie, the one whose group has more tiles; then the one with the smaller col
  // among its lowest tiles. Its base (that piece's lowest tile, the smaller col on a tie; N's index is the build's
  // length), its group's members (sorted), the side it leans to, the lowest support point at that end (the pivot,
  // SPEC's [X, p, q]) and its centre of weight in x (a number, for drawing)
  function tipsReport(B, N, bal) {
    var n = B.tiles.length, best = null, k;
    for (k = 0; k < bal.fails.length; k++) {
      var f = bal.fails[k];
      if (!best) { best = f; continue; }
      var t = f.base === n ? N : B.tiles[f.base], bt = best.base === n ? N : B.tiles[best.base];
      var c = cmpH(t.a, t.b, bt.a, bt.b) || (best.members.length - f.members.length) || (t.c - bt.c);
      if (c < 0) best = f;
    }
    var g = best.g, members = best.members.slice().sort(num);
    var W = g.nS + g.nT * R3 / 4, M = (g.sS + g.sT * R3 / 4) / 2;
    return { base: best.base, members: members, side: best.side, pivot: out(best.side === 'right' ? g.pR : g.pL), com: M / W };
  }

  // ---- the API ----
  function colsFor(B, piece) {
    var h2 = 2 * B.half, cols = [], c;
    if (piece === 'sq') for (c = -h2; c <= h2 - 2; c += 2) cols.push(c);
    else for (c = -h2 - 1; c <= h2 - 1; c++) cols.push(c);
    return cols;
  }
  function checkDrop(B, piece, col, way) {
    if (!B || typeof B.half !== 'number' || !B.idx || !B.pieces) throw new Error('drop: not a build');
    if (piece !== 'sq' && piece !== 'tri') throw new Error("drop: piece must be 'sq' or 'tri'");
    if (typeof col !== 'number' || col !== Math.floor(col)) throw new Error('drop: col must be a whole number of half tiles');
    var h2 = 2 * B.half;
    if (piece === 'sq') {
      if (col % 2 !== 0) throw new Error('drop: a square only goes at whole tiles (even col), not col ' + col);
      if (col < -h2 || col > h2 - 2) throw new Error('drop: square col ' + col + ' is off the car');
      if (way !== undefined && way !== null) throw new Error('drop: a square has no way up');
    } else {
      // the hand aims a triangle at most half a tile past either end of the car (SPEC §2)
      if (col < -h2 - 1 || col > h2 - 1) throw new Error('drop: triangle col ' + col + ' is outside the hand\'s range');
      if (way !== undefined && way !== null && way !== 'up' && way !== 'down') throw new Error("drop: way must be 'up' or 'down'");
    }
  }
  // Everything about a tile of type `type` dropped at col on B (evaluate1), kept for the last few builds asked about
  // (MEMO_N), so the hand's every-frame fitsAll and ghost drop cost nothing
  // after the first, without the cache growing with the number of builds a caller keeps. A build never changes, so a
  // kept answer is always right; results are copied out of it, so nothing a caller does to a result can reach it.
  var MEMO = [], MEMO_N = 8;
  function evaluate(B, type, col) {
    var memo = null, i;
    for (i = 0; i < MEMO.length; i++) if (MEMO[i].B === B) { memo = MEMO[i].m; break; }
    if (!memo) { memo = {}; MEMO.push({ B: B, m: memo }); if (MEMO.length > MEMO_N) MEMO.shift(); }
    var mk = type + col, e = memo[mk];
    if (!e) e = memo[mk] = evaluate1(B, type, col);
    return e;
  }
  // where it stops (k), its contacts (C), and whether it fits: it meets the tower edge to edge (core) and, with it,
  // everything balances (when not, k.fit is false and k.tips says what tips)
  function evaluate1(B, type, col) {
    var k = core(B, type, col), T = { t: type, c: col, a: k.a, b: k.b, i: B.tiles.length };
    var C = contacts(B, T);
    k.tips = null; k.bal = null;
    if (k.fit) {
      k.bal = balance(B, T, C.nb);
      if (k.bal.fails.length) { k.tips = tipsReport(B, T, k.bal); k.fit = false; k.gap = null; }
    }
    return { T: T, k: k, C: C };
  }
  function result(B, e) {
    var k = e.k, type = e.T.t, col = e.T.c;
    var V = vertsOf(type, col, k.a, k.b), verts = [];
    for (var i = 0; i < V.length; i++) verts.push(out(V[i]));
    verts.sort(lex);
    var C = { segments: [], points: [] }, shine = [], j, tp = k.tips;
    for (j = 0; j < e.C.segments.length; j++) C.segments.push([e.C.segments[j][0].slice(), e.C.segments[j][1].slice()]);
    for (j = 0; j < e.C.points.length; j++) C.points.push(e.C.points[j].slice());
    if (k.fit) for (var j = 0; j < C.segments.length; j++) shine.push([C.segments[j][0].slice(), C.segments[j][1].slice()]);
    return {
      outcome: k.fit ? 'fit' : 'off',
      way: WAY[type],
      pose: { type: type === 'dn' ? 'down' : type, col: col, y: [2 * k.a, k.b] },
      verts: verts,
      reason: k.fit ? null : k.tips ? REASONS[1] : REASONS[0],
      contacts: C,
      shine: shine,
      gap: k.gap ? k.gap.slice() : null,
      tips: tp ? { base: tp.base, members: tp.members.slice(), side: tp.side, pivot: tp.pivot.slice(), com: tp.com } : null
    };
  }
  // SPEC §6: the way a triangle takes when no way is given, from whether each way fits, where each rests (its lowest
  // point, [p, q]) and whether each tips over: the one that fits; if both fit, the lower, and ▼ when they are equally
  // low; if neither fits, the one that tips over if exactly one does (it meets the tower edge to edge), else ▲
  function pickWay(upFit, upY, downFit, downY, upTips, downTips) {
    if (upFit && downFit) return sgn3(upY[0] - downY[0], upY[1] - downY[1]) < 0 ? 'up' : 'down';
    if (upFit) return 'up';
    if (!downFit && !upTips !== !downTips) return upTips ? 'up' : 'down';
    if (downFit) return 'down';
    return 'up';
  }
  // the same choice from two drop results (forced 'up' and forced 'down' at one col)
  function chooseWay(up, down) {
    return pickWay(up.outcome === 'fit', up.pose.y, down.outcome === 'fit', down.pose.y, up.reason === REASONS[1], down.reason === REASONS[1]);
  }
  // drop(build, piece, col, way?): where the tile stops and whether it stays (SPEC §8's format, plus pose; tips as
  // DESIGN §18.7 gives it)
  function drop(B, piece, col, way) {
    checkDrop(B, piece, col, way);
    if (piece === 'sq') return result(B, evaluate(B, 'sq', col));
    if (way === 'up') return result(B, evaluate(B, 'up', col));
    if (way === 'down') return result(B, evaluate(B, 'dn', col));
    var u = evaluate(B, 'up', col), d = evaluate(B, 'dn', col);
    return pickWay(u.k.fit, [2 * u.k.a, u.k.b], d.k.fit, [2 * d.k.a, d.k.b], !!u.k.tips, !!d.k.tips) === 'up' ? result(B, u) : result(B, d);
  }
  // place(build, result): a new build with the fitted tile added; the old build is unchanged
  function place(B, r) {
    if (!r || r.outcome !== 'fit') throw new Error('place: only a tile that fits can be placed');
    var p = r.pose, type = p && (p.type === 'down' ? 'dn' : p.type);
    if (type !== 'sq' && type !== 'up' && type !== 'dn') throw new Error('place: no pose');
    checkDrop(B, type === 'sq' ? 'sq' : 'tri', p.col, type === 'sq' ? null : WAY[type]);
    var k = evaluate(B, type, p.col).k;
    if (!k.fit || 2 * k.a !== p.y[0] || k.b !== p.y[1]) throw new Error('place: that result is not a fit on this build');
    var n = B.tiles.length, t = Object.freeze({ t: type, c: p.col, a: k.a, b: k.b, i: n });
    var idx = B.idx.slice(), o = off(B), j;
    for (j = 0; j < 2; j++) idx[p.col + j + o] = (idx[p.col + j + o] || []).concat([t]);
    var log = B.log.concat([Object.freeze({ piece: type === 'sq' ? 'sq' : 'tri', col: p.col, way: WAY[type] })]);
    // what the new tile rests on and is locked to, and the pieces and groups of the new build
    var D = k.bal.D, L = k.bal.L, rests = B.rests.concat([Object.freeze(D.map(function (d) { return Object.freeze({ i: d.i, lo: Object.freeze(d.lo), hi: d.hi && Object.freeze(d.hi) }); }))]);
    var locks = B.locks.slice();
    for (j = 0; j < L.length; j++) locks[L[j]] = Object.freeze(locks[L[j]].concat([n]));
    locks.push(Object.freeze(L.slice()));
    var tiles2 = B.tiles.concat([t]), S = structure(tiles2, rests, locks);
    return freezeBuild({ half: B.half, tiles: tiles2, log: log, idx: idx, rests: rests, locks: locks, pc: S.pc, pieces: S.pieces });
  }
  // every column's result for a piece, left to right
  function fitsAll(B, piece, way) {
    var cols = colsFor(B, piece), res = [];
    for (var i = 0; i < cols.length; i++) res.push(drop(B, piece, cols[i], way));
    return res;
  }
  // canonical, independent of the order the tiles were placed in
  function tileKey(t) { return t.t + t.c + '@' + t.a + ',' + t.b; }
  function key(B) {
    var ks = [];
    for (var i = 0; i < B.tiles.length; i++) ks.push(tileKey(B.tiles[i]));
    ks.sort();
    return 'h' + B.half + '|' + ks.join(' ');
  }
  // BIG MAGNETS (§18.6): the hand's column if it fits there, else the fitting column nearest the hand within one
  // tile (ties: the lower landing, then the left one); if none, the hand's column, where it falls off
  function pull(B, piece, col) {
    var here = drop(B, piece, col);
    if (here.outcome === 'fit') return here;
    var lo = piece === 'sq' ? -2 * B.half : -2 * B.half - 1, hi = piece === 'sq' ? 2 * B.half - 2 : 2 * B.half - 1;
    for (var d = piece === 'sq' ? 2 : 1; d <= 2; d += piece === 'sq' ? 2 : 1) {
      var best = null;
      for (var side = -1; side <= 1; side += 2) {
        var c = col + side * d;
        if (c < lo || c > hi) continue;
        var r = drop(B, piece, c);
        if (r.outcome !== 'fit') continue;
        if (!best || sgn3(r.pose.y[0] - best.pose.y[0], r.pose.y[1] - best.pose.y[1]) < 0) best = r;
      }
      if (best) return best;
    }
    return here;
  }
  // the placed tiles, for drawing and checking: piece, way, col, y ([p, q] of its lowest point) and verts, in placing order
  function tiles(B) {
    var res = [];
    for (var i = 0; i < B.tiles.length; i++) {
      var t = B.tiles[i], V = vertsOf(t.t, t.c, t.a, t.b), verts = [];
      for (var k = 0; k < V.length; k++) verts.push(out(V[k]));
      res.push({ piece: t.t === 'sq' ? 'sq' : 'tri', way: WAY[t.t], col: t.c, y: [2 * t.a, t.b], verts: verts });
    }
    return res;
  }

  return { REASONS: REASONS, newBuild: newBuild, drop: drop, place: place, fitsAll: fitsAll, key: key, pull: pull, tiles: tiles, cols: colsFor, chooseWay: chooseWay };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = RULES;
