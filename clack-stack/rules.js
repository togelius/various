/* CLACK STACK rules, revision 5b (DESIGN.md §18.1–18.3 and §18.7; the precise reading is tools/oracle/SPEC.md, which
   wins on rules). The one source of where a tile can go and why it falls off. Pure: no DOM, no time, no randomness,
   no globals but the language's own. It runs in an empty vm context (tools/lib/rules-vm.cjs) and is inlined into
   index.html between the RULES markers by tools/build.cjs.

   The one rule (SPEC §5): a tile stays if it meets the tower edge to edge along at least half an edge.
   - A square or ▲ stays when part of its bottom edge (on this lattice, half of it or all of it) lies on a flat top:
     the car, a square's top or a ▼'s top. The rest may be over a lower top, a slant or nothing.
   - A ▼ stays when one of its lower sides lies whole against a ▲'s side (two such sides: it sits in a notch).
   Otherwise it falls off, and there is one reason: ONLY A POINT.

   Numbers are exact. A point is a lattice point (X, a, b): x = X/2, y = a + b·h with h = √3/2. The comparison format
   writes it as SPEC's [X, p, q] with y = (p + q√3)/2, so p = 2a and q = b. Two heights are compared in integers
   (sign of 2·Δa + Δb·√3), never in floating point.

   A tile is { t: 'sq' | 'up' | 'dn', c: col, a, b }:
   - 'sq' its lower-left corner at (c, a, b);
   - 'up' (▲) its base from (c, a, b) to (c + 2, a, b), apex (c + 1, a, b + 1);
   - 'dn' (▼) its point at (c + 1, a, b), its top edge from (c, a, b + 1) to (c + 2, a, b + 1).
   Every tile spans two half-tile columns: column s is x from s/2 to s/2 + 1/2, and a tile at col c spans c and c + 1.
   Over one column a tile's top is a straight line, and the topmost thing in a column lies above every other thing in
   it at both of the column's ends (two tiles that span a column and don't overlap can't cross inside it). */
var RULES = (function () {
  'use strict';

  // the reasons a tile falls off (DESIGN §18.2): one
  var REASONS = ['ONLY A POINT'];

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
  // { half, tiles: [tile] in placing order, log: [{piece, col, way}], idx: per half-tile column the tiles spanning it }
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
  // Where a tile of type `type` at col stops, and whether it stays there. The tile falls from far above; over each of
  // its columns the gap between its underside and a thing's top is linear, so it stops at the largest
  // (top − underside) over its two columns, both ends of each, and every thing in them (the car and the tiles).
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
    // sliver; the deepest is at an end of a column (the tops are straight over a column)
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
      var list = inCol(B, s);
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
      // the hand aims a triangle at most half a tile past either end of the car (SPEC §2)
      if (col < -h2 - 1 || col > h2 - 1) throw new Error('drop: triangle col ' + col + ' is outside the hand\'s range');
      if (way !== undefined && way !== null && way !== 'up' && way !== 'down') throw new Error("drop: way must be 'up' or 'down'");
    }
  }
  function result(B, type, col, k) {
    var T = { t: type, c: col, a: k.a, b: k.b };
    var V = vertsOf(type, col, k.a, k.b), verts = [];
    for (var i = 0; i < V.length; i++) verts.push(out(V[i]));
    verts.sort(lex);
    var C = contacts(B, T), shine = [];
    if (k.fit) for (var j = 0; j < C.segments.length; j++) shine.push([C.segments[j][0].slice(), C.segments[j][1].slice()]);
    return {
      outcome: k.fit ? 'fit' : 'off',
      way: WAY[type],
      pose: { type: type === 'dn' ? 'down' : type, col: col, y: [2 * k.a, k.b] },
      verts: verts,
      reason: k.fit ? null : REASONS[0],
      contacts: C,
      shine: shine,
      gap: k.gap
    };
  }
  // SPEC §6: the way a triangle takes when no way is given, from whether each way fits and where each rests (its
  // lowest point, [p, q]): the one that fits; if both fit, the lower, and ▼ when they are equally low; if neither, ▲
  function pickWay(upFit, upY, downFit, downY) {
    if (upFit && downFit) return sgn3(upY[0] - downY[0], upY[1] - downY[1]) < 0 ? 'up' : 'down';
    if (upFit) return 'up';
    if (downFit) return 'down';
    return 'up';
  }
  // the same choice from two drop results (forced 'up' and forced 'down' at one col)
  function chooseWay(up, down) {
    return pickWay(up.outcome === 'fit', up.pose.y, down.outcome === 'fit', down.pose.y);
  }
  // drop(build, piece, col, way?): where the tile stops and whether it stays (SPEC §8's format, plus pose)
  function drop(B, piece, col, way) {
    checkDrop(B, piece, col, way);
    if (piece === 'sq') return result(B, 'sq', col, core(B, 'sq', col));
    if (way === 'up') return result(B, 'up', col, core(B, 'up', col));
    if (way === 'down') return result(B, 'dn', col, core(B, 'dn', col));
    var u = core(B, 'up', col), d = core(B, 'dn', col);
    return pickWay(u.fit, [2 * u.a, u.b], d.fit, [2 * d.a, d.b]) === 'up' ? result(B, 'up', col, u) : result(B, 'dn', col, d);
  }
  // place(build, result): a new build with the fitted tile added; the old build is unchanged
  function place(B, r) {
    if (!r || r.outcome !== 'fit') throw new Error('place: only a tile that fits can be placed');
    var p = r.pose, type = p && (p.type === 'down' ? 'dn' : p.type);
    if (type !== 'sq' && type !== 'up' && type !== 'dn') throw new Error('place: no pose');
    checkDrop(B, type === 'sq' ? 'sq' : 'tri', p.col, type === 'sq' ? null : WAY[type]);
    var k = core(B, type, p.col);
    if (!k.fit || 2 * k.a !== p.y[0] || k.b !== p.y[1]) throw new Error('place: that result is not a fit on this build');
    var t = Object.freeze({ t: type, c: p.col, a: k.a, b: k.b });
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
