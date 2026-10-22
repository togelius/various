/* CLACK STACK rules, revision 5 (DESIGN.md §18.1–18.3 and §18.7; the precise reading is tools/oracle/SPEC.md).
   The one source of where a tile can go and why it falls off. Pure: no DOM, no time, no randomness, no globals but
   the language's own. It runs in an empty vm context (tools/lib/rules-vm.cjs) and is inlined into index.html between
   the RULES markers by tools/build.cjs.

   Numbers are exact. A point is a lattice point (X, a, b): x = X/2, y = a + b·h with h = √3/2. The comparison format
   writes it as SPEC's [X, p, q] with y = (p + q√3)/2, so p = 2a and q = b. Two heights are compared in integers
   (sign of 2·Δa + Δb·√3), never in floating point.

   A tile is { t: 'sq' | 'up' | 'dn', c: col, a, b, on: [left strip on the tower, right strip on the tower] }:
   - 'sq' its lower-left corner at (c, a, b);
   - 'up' (▲) its base from (c, a, b) to (c + 2, a, b), apex (c + 1, a, b + 1);
   - 'dn' (▼) its point at (c + 1, a, b), its top edge from (c, a, b + 1) to (c + 2, a, b + 1).
   Every tile covers two half-tile strips: strip s is x from s/2 to s/2 + 1/2, and a tile at col c covers c and c + 1. */
var RULES = (function () {
  'use strict';

  // the reasons a tile falls off, in precedence order (DESIGN §18.2)
  var REASONS = ['NO SIDE', 'ONLY A POINT', 'OVER THE EDGE', 'NOT LEVEL', 'TOO FAR OUT'];

  // sign of (a1 + b1·h) − (a2 + b2·h), h = √3/2: the sign of 2·da + db·√3, decided in integers
  function cmpH(a1, b1, a2, b2) {
    var da = a1 - a2, db = b1 - b2;
    if (da === 0 && db === 0) return 0;
    if (da >= 0 && db >= 0) return 1;
    if (da <= 0 && db <= 0) return -1;
    var l = 4 * da * da, r = 3 * db * db; // never equal: √3 is irrational
    return da > 0 ? (l > r ? 1 : -1) : (l > r ? -1 : 1);
  }

  // Over each of its two strips (0 left, 1 right) a tile's top and underside are straight, so each is given by its
  // height at the strip's left and right end, as lattice offsets [a_left, b_left, a_right, b_right] from the tile's (a, b).
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
  var WAY = { sq: null, up: 'up', dn: 'down' };

  // ---- builds (immutable) ----
  // { half, tiles: [tile] in placing order, log: [{piece, col, way}], idx: per strip the tiles covering it }
  function off(B) { return 2 * B.half + 1; }
  function freezeBuild(B) {
    for (var k = 0; k < B.idx.length; k++) if (B.idx[k]) Object.freeze(B.idx[k]);
    Object.freeze(B.idx); Object.freeze(B.tiles); Object.freeze(B.log);
    return Object.freeze(B);
  }
  function newBuild(opts) {
    var half = opts && opts.half !== undefined ? opts.half : 2;
    if (typeof half !== 'number' || half !== Math.floor(half) || half < 1) throw new Error('newBuild: half must be a whole number of tiles, at least 1');
    var idx = [];
    for (var k = 0; k < 4 * half + 2; k++) idx.push(null);
    return freezeBuild({ half: half, tiles: [], log: [], idx: idx });
  }
  function inStrip(B, s) { var k = s + off(B); return k >= 0 && k < B.idx.length ? B.idx[k] : null; }
  function carIn(B, s) { return s >= -2 * B.half && s < 2 * B.half; }

  // ---- the drop and the fit ----
  // One strip s under a tile whose underside starts at height (ra, rb): is anything there (any), the highest top at
  // the strip's two ends (env), and whether a single flat top lies at exactly (ra, rb) across the whole strip (flat)
  // and whether that top's own strip is on the tower (on).
  function stripAt(B, s, ra, rb) {
    var any = false, e0a = 0, e0b = 0, e1a = 0, e1b = 0, flatOn = null;
    if (carIn(B, s)) {
      any = true;
      if (ra === 0 && rb === 0) flatOn = true;
    }
    var list = inStrip(B, s);
    if (list) for (var k = 0; k < list.length; k++) {
      var t = list[k], jt = s - t.c, top = TOP[t.t][jt];
      var ta0 = t.a + top[0], tb0 = t.b + top[1], ta1 = t.a + top[2], tb1 = t.b + top[3];
      if (!any || cmpH(ta0, tb0, e0a, e0b) > 0) { e0a = ta0; e0b = tb0; }
      if (!any || cmpH(ta1, tb1, e1a, e1b) > 0) { e1a = ta1; e1b = tb1; }
      any = true;
      if (ta0 === ra && tb0 === rb && ta1 === ra && tb1 === rb) flatOn = t.on[jt];
    }
    return { any: any, e0a: e0a, e0b: e0b, e1a: e1a, e1b: e1b, flat: flatOn !== null, on: flatOn === true };
  }
  // the ▲ at col c whose base is at (a, b), or null
  function upAt(B, c, a, b) {
    var list = inStrip(B, c + 1);
    if (list) for (var k = 0; k < list.length; k++) {
      var t = list[k];
      if (t.t === 'up' && t.c === c && t.a === a && t.b === b) return t;
    }
    return null;
  }
  // Where a tile of type `type` at col stops, and whether it fits there. The tile falls from far above; over each of
  // its strips the gap between its underside and a thing's top is linear, so it stops at the largest
  // (top − underside) over its two strips, both ends of each, and every thing in them (the car and the tiles).
  function core(B, type, col) {
    var bot = BOT[type], ra = 0, rb = 0, hit = false;
    for (var j = 0; j < 2; j++) {
      var s = col + j, u = bot[j];
      if (carIn(B, s)) for (var e = 0; e < 2; e++) {
        var ca = -u[2 * e], cb = -u[2 * e + 1];
        if (!hit || cmpH(ca, cb, ra, rb) > 0) { ra = ca; rb = cb; hit = true; }
      }
      var list = inStrip(B, s);
      if (list) for (var k = 0; k < list.length; k++) {
        var t = list[k], top = TOP[t.t][s - t.c];
        for (var e2 = 0; e2 < 2; e2++) {
          var na = t.a + top[2 * e2] - u[2 * e2], nb = t.b + top[2 * e2 + 1] - u[2 * e2 + 1];
          if (!hit || cmpH(na, nb, ra, rb) > 0) { ra = na; rb = nb; hit = true; }
        }
      }
    }
    if (!hit) throw new Error('drop: nothing at all below col ' + col);
    var L, R, reason = null, gap = null, onL, onR;
    if (type === 'dn') {
      // a ▼ hangs on a ▲'s slant: its left side on the right slant of a ▲ at col − 1, its right side on the left
      // slant of a ▲ at col + 1, both with their base at the ▼'s point
      var upL = upAt(B, col - 1, ra, rb), upR = upAt(B, col + 1, ra, rb);
      onL = upL ? upL.on[1] : stripAt(B, col, ra, rb).on;
      onR = upR ? upR.on[0] : stripAt(B, col + 1, ra, rb).on;
      if (!upL && !upR) reason = 'NO SIDE';
      else if (!onL && !onR) reason = 'TOO FAR OUT';
      return { a: ra, b: rb, reason: reason, gap: null, on0: onL, on1: onR, sides: (upL ? 1 : 0) + (upR ? 2 : 0) };
    }
    // a square or a ▲: its bottom edge is flat at (ra, rb)
    L = stripAt(B, col, ra, rb); R = stripAt(B, col + 1, ra, rb);
    onL = L.on; onR = R.on;
    if (!L.flat && !R.flat) reason = 'ONLY A POINT';
    else if (!L.any || !R.any) reason = 'OVER THE EDGE';
    else if (!L.flat || !R.flat) {
      reason = 'NOT LEVEL';
      // the deepest point under the bottom edge: the lowest strip end (a flat strip's ends are at the edge itself)
      var ga = L.e0a, gb = L.e0b;
      if (cmpH(L.e1a, L.e1b, ga, gb) < 0) { ga = L.e1a; gb = L.e1b; }
      if (cmpH(R.e0a, R.e0b, ga, gb) < 0) { ga = R.e0a; gb = R.e0b; }
      if (cmpH(R.e1a, R.e1b, ga, gb) < 0) { ga = R.e1a; gb = R.e1b; }
      gap = [2 * (ra - ga), rb - gb];
    }
    else if (type === 'sq' ? !(onL && onR) : !(onL || onR)) reason = 'TOO FAR OUT';
    return { a: ra, b: rb, reason: reason, gap: gap, on0: onL, on1: onR, sides: 0 };
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
  // every contact of tile T (resting, not yet placed) with the car top and the tiles that reach its x range
  function contacts(B, T) {
    var VT = vertsOf(T.t, T.c, T.a, T.b), segs = [], pts = [], c = T.c, h2 = 2 * B.half, k, m;
    // the car: the region x in [−half, half], y ≤ 0; tiles never go below y = 0
    if (T.a === 0 && T.b === 0) {
      if (T.t === 'dn') { if (c + 1 >= -h2 && c + 1 <= h2) pts.push([c + 1, 0, 0]); }
      else {
        var lo = Math.max(c, -h2), hi = Math.min(c + 2, h2);
        if (lo < hi) segs.push([[lo, 0, 0], [hi, 0, 0]]);
        else if (lo === hi) pts.push([lo, 0, 0]);
      }
    }
    for (var s = c - 1; s <= c + 2; s++) {
      var list = inStrip(B, s);
      if (list) for (k = 0; k < list.length; k++) {
        var N = list[k];
        if (s !== Math.max(N.c, c - 1)) continue; // each neighbour once
        m = meet(T, VT, N);
        if (!m) continue;
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
    return { segments: S, points: P };
  }

  // ---- the API ----
  function colsFor(B, piece) {
    var h2 = 2 * B.half, cols = [], c;
    if (piece === 'sq') for (c = -h2; c <= h2 - 2; c += 2) cols.push(c);
    else for (c = -h2 - 1; c <= h2 - 1; c++) cols.push(c);
    return cols;
  }
  function checkDrop(B, piece, col, way) {
    if (!B || typeof B.half !== 'number' || !B.idx) throw new Error('drop: not a build');
    if (piece !== 'sq' && piece !== 'tri') throw new Error("drop: piece must be 'sq' or 'tri'");
    if (typeof col !== 'number' || col !== Math.floor(col)) throw new Error('drop: col must be a whole number of half tiles');
    var h2 = 2 * B.half;
    if (piece === 'sq') {
      if (col % 2 !== 0) throw new Error('drop: a square only goes at whole tiles (even col), not col ' + col);
      if (col < -h2 || col > h2 - 2) throw new Error('drop: square col ' + col + ' is off the car');
      if (way !== undefined && way !== null) throw new Error('drop: a square has no way up');
    } else {
      // The hand aims triangles at cols −2·half − 1 … 2·half − 1 (SPEC §2, cols()), but golden case 5 drops a ▼
      // at col 2·half, wholly past the car, and expects TOO FAR OUT: so a triangle is evaluated at any col with
      // something below it, and throws only over nothing at all (SPEC §3).
      if (way !== undefined && way !== null && way !== 'up' && way !== 'down') throw new Error("drop: way must be 'up' or 'down'");
    }
  }
  function result(B, type, col, k) {
    var T = { t: type, c: col, a: k.a, b: k.b };
    var V = vertsOf(type, col, k.a, k.b), verts = [];
    for (var i = 0; i < V.length; i++) verts.push(out(V[i]));
    verts.sort(lex);
    var C = contacts(B, T), fit = k.reason === null, shine = [];
    if (fit) for (var j = 0; j < C.segments.length; j++) shine.push([C.segments[j][0].slice(), C.segments[j][1].slice()]);
    return {
      outcome: fit ? 'fit' : 'off',
      way: WAY[type],
      pose: { type: type === 'dn' ? 'down' : type, col: col, y: [2 * k.a, k.b] },
      verts: verts,
      reason: k.reason,
      contacts: C,
      shine: shine,
      strips: [k.on0, k.on1],
      gap: k.gap
    };
  }
  // drop(build, piece, col, way?): where the tile stops and whether it fits (SPEC §8's format, plus pose)
  function drop(B, piece, col, way) {
    checkDrop(B, piece, col, way);
    if (piece === 'sq') return result(B, 'sq', col, core(B, 'sq', col));
    if (way === 'up') return result(B, 'up', col, core(B, 'up', col));
    if (way === 'down') return result(B, 'dn', col, core(B, 'dn', col));
    // no way given: the way that fits (at most one can), else what §18.3's hand shows
    var d = core(B, 'dn', col);
    if (d.reason === null) return result(B, 'dn', col, d);
    var u = core(B, 'up', col);
    if (u.reason === null) return result(B, 'up', col, u);
    if (d.reason === 'TOO FAR OUT') return result(B, 'dn', col, d);
    return result(B, 'up', col, u);
  }
  // place(build, result): a new build with the fitted tile added; the old build is unchanged
  function place(B, r) {
    if (!r || r.outcome !== 'fit') throw new Error('place: only a tile that fits can be placed');
    var p = r.pose, type = p && (p.type === 'down' ? 'dn' : p.type);
    if (type !== 'sq' && type !== 'up' && type !== 'dn') throw new Error('place: no pose');
    checkDrop(B, type === 'sq' ? 'sq' : 'tri', p.col, type === 'sq' ? null : WAY[type]);
    var k = core(B, type, p.col);
    if (k.reason !== null || 2 * k.a !== p.y[0] || k.b !== p.y[1]) throw new Error('place: that result is not a fit on this build');
    var t = Object.freeze({ t: type, c: p.col, a: k.a, b: k.b, on: Object.freeze([k.on0, k.on1]) });
    var idx = B.idx.slice(), o = off(B);
    for (var j = 0; j < 2; j++) idx[p.col + j + o] = (idx[p.col + j + o] || []).concat([t]);
    var log = B.log.concat([Object.freeze({ piece: type === 'sq' ? 'sq' : 'tri', col: p.col, way: WAY[type] })]);
    return freezeBuild({ half: B.half, tiles: B.tiles.concat([t]), log: log, idx: idx });
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
        if (!best || cmpH(r.pose.y[0] / 2, r.pose.y[1], best.pose.y[0] / 2, best.pose.y[1]) < 0) best = r;
      }
      if (best) return best;
    }
    return here;
  }
  // the placed tiles, for drawing and checking: piece, way, col, y, verts and strips, in placing order
  function tiles(B) {
    var res = [];
    for (var i = 0; i < B.tiles.length; i++) {
      var t = B.tiles[i], V = vertsOf(t.t, t.c, t.a, t.b), verts = [];
      for (var k = 0; k < V.length; k++) verts.push(out(V[k]));
      res.push({ piece: t.t === 'sq' ? 'sq' : 'tri', way: WAY[t.t], col: t.c, y: [2 * t.a, t.b], verts: verts, strips: [t.on[0], t.on[1]] });
    }
    return res;
  }

  return { REASONS: REASONS, newBuild: newBuild, drop: drop, place: place, fitsAll: fitsAll, key: key, pull: pull, tiles: tiles, cols: colsFor };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = RULES;
