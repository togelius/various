'use strict';
/*
 * Clack Stack placement oracle, written only from SPEC.md (revision 5b).
 *
 * - Exact arithmetic in Q(sqrt 3): every number is (A + B*sqrt3) / D with BigInt A, B, D,
 *   D > 0 and gcd(A, B, D) = 1, so the representation is canonical. No floating point is
 *   used in any decision.
 * - Geometry is done on convex polygons with exact vertices (square, up triangle, down
 *   triangle, and the car as the region x in [-half, half], y <= 0).
 * - Overlap of interiors: exact separating-axis test (touching is not overlap).
 * - Resting height: for each placed tile (and the car) whose x-range overlaps the falling
 *   tile's open x-range, the overlapping y-shifts form an open interval whose upper end is
 *   max over the common x-range of (top_of_obstacle(x) - bottom_of_tile(x)). That function
 *   is concave and piecewise linear, so it is evaluated only at range ends and vertex xs.
 *   The tile stops at the largest upper end. The result is re-checked with the SAT test.
 * - Fit (section 5): a square or up triangle fits iff a positive length of its bottom edge
 *   lies on a horizontal top edge (square top, down-triangle top, car top) at exactly its
 *   height. A down triangle fits iff one of its lower sides is exactly a slanted side of a
 *   placed up triangle. The only reason is 'ONLY A POINT'.
 * - No lattice keys, edge hashing or precomputed column profiles: every query walks the
 *   placed polygons.
 *
 * API: newBuild({ half = 2 }), drop(build, piece, col, way?), place(build, result).
 */

// ---------------------------------------------------------------- exact numbers
function bgcd(a, b) {
  if (a < 0n) a = -a;
  if (b < 0n) b = -b;
  while (b !== 0n) { const t = a % b; a = b; b = t; }
  return a;
}
function num(A, B, D) {
  if (D === 0n) throw new Error('internal: zero denominator');
  if (D < 0n) { A = -A; B = -B; D = -D; }
  const g = bgcd(bgcd(A, B), D);
  if (g > 1n) { A /= g; B /= g; D /= g; }
  return { A, B, D };
}
const rat = (n, d = 1) => num(BigInt(n), 0n, BigInt(d));
const ZERO = rat(0), ONE = rat(1), HALF = rat(1, 2), H = num(0n, 1n, 2n); // H = sqrt3/2
const add = (u, v) => num(u.A * v.D + v.A * u.D, u.B * v.D + v.B * u.D, u.D * v.D);
const sub = (u, v) => num(u.A * v.D - v.A * u.D, u.B * v.D - v.B * u.D, u.D * v.D);
const mul = (u, v) => num(u.A * v.A + 3n * u.B * v.B, u.A * v.B + u.B * v.A, u.D * v.D);
function div(u, v) {
  const n = v.A * v.A - 3n * v.B * v.B; // nonzero unless v == 0, since sqrt3 is irrational
  if (n === 0n) throw new Error('internal: division by zero');
  return num((u.A * v.A - 3n * u.B * v.B) * v.D, (u.B * v.A - u.A * v.B) * v.D, u.D * n);
}
// sign of A + B*sqrt3, decided by comparing A^2 with 3B^2
function sgn(u) {
  const A = u.A, B = u.B;
  if (A >= 0n && B >= 0n) return (A === 0n && B === 0n) ? 0 : 1;
  if (A <= 0n && B <= 0n) return -1;
  const a2 = A * A, b2 = 3n * B * B;
  if (A > 0n) return a2 > b2 ? 1 : -1; // B < 0
  return a2 > b2 ? -1 : 1;             // A < 0, B > 0
}
const cmp = (u, v) => sgn(sub(u, v));
const eq = (u, v) => u.A === v.A && u.B === v.B && u.D === v.D;
const kmax = (u, v) => (cmp(u, v) >= 0 ? u : v);
const kmin = (u, v) => (cmp(u, v) <= 0 ? u : v);

// x = X/2, y = (p + q sqrt3)/2 -> integers
function toX(x) {
  if (x.B !== 0n || (2n * x.A) % x.D !== 0n) throw new Error('internal: x off the half grid');
  return Number((2n * x.A) / x.D);
}
function toPQ(y) {
  if ((2n * y.A) % y.D !== 0n || (2n * y.B) % y.D !== 0n) throw new Error('internal: y off the lattice');
  return [Number((2n * y.A) / y.D), Number((2n * y.B) / y.D)];
}
const pt = (x, y) => ({ x, y });
const triple = (p) => [toX(p.x), ...toPQ(p.y)];
function cmpTriple(a, b) { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; }
function cmpSeg(s, t) { return cmpTriple(s[0], t[0]) || cmpTriple(s[1], t[1]); }

// ---------------------------------------------------------------- polygons (CCW)
function tilePoly(kind, col, y0) {
  const xl = rat(col, 2), xr = add(xl, ONE), xm = add(xl, HALF);
  if (kind === 'sq') return [pt(xl, y0), pt(xr, y0), pt(xr, add(y0, ONE)), pt(xl, add(y0, ONE))];
  if (kind === 'up') return [pt(xl, y0), pt(xr, y0), pt(xm, add(y0, H))];
  if (kind === 'down') return [pt(xm, y0), pt(xr, add(y0, H)), pt(xl, add(y0, H))];
  throw new Error('internal: kind');
}
const CAR_DEPTH = rat(-1000000); // the car is y <= 0; nothing ever comes near this depth
function carPoly(half) {
  const l = rat(-half), r = rat(half);
  return [pt(l, CAR_DEPTH), pt(r, CAR_DEPTH), pt(r, ZERO), pt(l, ZERO)];
}
const shift = (poly, dy) => poly.map((p) => pt(p.x, add(p.y, dy)));
function edges(poly) { const e = []; for (let i = 0; i < poly.length; i++) e.push([poly[i], poly[(i + 1) % poly.length]]); return e; }
function xRange(poly) {
  let l = poly[0].x, r = poly[0].x;
  for (const p of poly) { l = kmin(l, p.x); r = kmax(r, p.x); }
  return [l, r];
}
// vertical cross-section of a closed convex polygon at x: {lo, hi} or null
function section(poly, x) {
  let lo = null, hi = null;
  const take = (y) => {
    if (lo === null || cmp(y, lo) < 0) lo = y;
    if (hi === null || cmp(y, hi) > 0) hi = y;
  };
  for (const [p, q] of edges(poly)) {
    const c1 = cmp(p.x, x), c2 = cmp(q.x, x);
    if (c1 === 0) take(p.y);
    if (c2 === 0) take(q.y);
    if (c1 !== 0 && c2 !== 0 && c1 !== c2) take(add(p.y, div(mul(sub(q.y, p.y), sub(x, p.x)), sub(q.x, p.x))));
  }
  return lo === null ? null : { lo, hi };
}
// exact separating axis test: true iff the interiors share positive area
function overlaps(P, Q) {
  for (const poly of [P, Q]) {
    for (const [a, b] of edges(poly)) {
      const nx = sub(a.y, b.y), ny = sub(b.x, a.x); // normal of edge a->b
      const proj = (S) => {
        let mn = null, mx = null;
        for (const p of S) {
          const d = add(mul(p.x, nx), mul(p.y, ny));
          if (mn === null || cmp(d, mn) < 0) mn = d;
          if (mx === null || cmp(d, mx) > 0) mx = d;
        }
        return [mn, mx];
      };
      const [pmn, pmx] = proj(P), [qmn, qmx] = proj(Q);
      if (cmp(pmx, qmn) <= 0 || cmp(qmx, pmn) <= 0) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------- segments
const cross = (ux, uy, vx, vy) => sub(mul(ux, vy), mul(uy, vx));
// intersection of closed segments AB and CD: null | {point} | {seg:[P,Q]} (positive length)
function segInter(A, B, C, D) {
  const rx = sub(B.x, A.x), ry = sub(B.y, A.y), sx = sub(D.x, C.x), sy = sub(D.y, C.y);
  const qx = sub(C.x, A.x), qy = sub(C.y, A.y);
  const den = cross(rx, ry, sx, sy);
  if (sgn(den) === 0) {
    if (sgn(cross(qx, qy, rx, ry)) !== 0) return null; // parallel, not collinear
    const rr = add(mul(rx, rx), mul(ry, ry));
    const t0 = div(add(mul(qx, rx), mul(qy, ry)), rr);
    const t1 = div(add(mul(sub(D.x, A.x), rx), mul(sub(D.y, A.y), ry)), rr);
    const lo = kmax(ZERO, kmin(t0, t1)), hi = kmin(ONE, kmax(t0, t1));
    const c = cmp(lo, hi);
    if (c > 0) return null;
    const at = (t) => pt(add(A.x, mul(t, rx)), add(A.y, mul(t, ry)));
    if (c === 0) return { point: at(lo) };
    return { seg: [at(lo), at(hi)] };
  }
  const t = div(cross(qx, qy, sx, sy), den), u = div(cross(qx, qy, rx, ry), den);
  if (sgn(t) < 0 || cmp(t, ONE) > 0 || sgn(u) < 0 || cmp(u, ONE) > 0) return null;
  return { point: pt(add(A.x, mul(t, rx)), add(A.y, mul(t, ry))) };
}
function onSeg(P, A, B) {
  if (sgn(cross(sub(B.x, A.x), sub(B.y, A.y), sub(P.x, A.x), sub(P.y, A.y))) !== 0) return false;
  return cmp(P.x, kmin(A.x, B.x)) >= 0 && cmp(P.x, kmax(A.x, B.x)) <= 0 &&
         cmp(P.y, kmin(A.y, B.y)) >= 0 && cmp(P.y, kmax(A.y, B.y)) <= 0;
}
const samePt = (p, q) => eq(p.x, q.x) && eq(p.y, q.y);
const sameSeg = (s, t) => (samePt(s[0], t[0]) && samePt(s[1], t[1])) || (samePt(s[0], t[1]) && samePt(s[1], t[0]));

// ---------------------------------------------------------------- builds
const BUILD = Symbol('clack-build');
function newBuild(opts) {
  const o = opts == null ? {} : opts;
  if (typeof o !== 'object') throw new Error('newBuild: expects an options object');
  const half = o.half === undefined ? 2 : o.half;
  if (!Number.isInteger(half) || half < 1) throw new Error('newBuild: half must be a positive integer');
  return Object.freeze({ [BUILD]: true, half, tiles: Object.freeze([]) });
}
function checkBuild(b) {
  if (!b || b[BUILD] !== true) throw new Error('not a build made by newBuild/place');
}
function obstacles(build) { return build.tiles.map((t) => t.poly).concat([carPoly(build.half)]); }

// horizontal top edges: the car top, the top edge of a square, the top edge of a down triangle.
// Generic: a horizontal edge walked in -x direction in a CCW polygon has the interior below it.
function flatTops(build) {
  const tops = [{ y: ZERO, l: rat(-build.half), r: rat(build.half) }];
  for (const t of build.tiles) {
    for (const [p, q] of edges(t.poly)) {
      if (eq(p.y, q.y) && cmp(q.x, p.x) < 0) tops.push({ y: p.y, l: q.x, r: p.x });
    }
  }
  return tops;
}

// ---------------------------------------------------------------- the drop
const DELTA = rat(1, 1000);
function rest(build, kind, col) {
  const P0 = tilePoly(kind, col, ZERO);
  const [pl, pr] = xRange(P0);
  const obs = obstacles(build);
  let best = null;
  for (const Q of obs) {
    const [ql, qr] = xRange(Q);
    const l = kmax(pl, ql), r = kmin(pr, qr);
    if (cmp(l, r) >= 0) continue; // no common open x-range: the tile slides past
    const xs = [l, r];
    for (const v of P0.concat(Q)) if (cmp(v.x, l) > 0 && cmp(v.x, r) < 0) xs.push(v.x);
    for (const x of xs) {
      const d = sub(section(Q, x).hi, section(P0, x).lo);
      if (best === null || cmp(d, best) > 0) best = d;
    }
  }
  if (best === null) throw new Error('drop: nothing at all below the tile');
  // exact double check with SAT: free at rest, blocked just below
  const P = shift(P0, best), Pdown = shift(P0, sub(best, DELTA));
  let blocked = false;
  for (const Q of obs) {
    if (overlaps(P, Q)) throw new Error('internal: resting tile overlaps');
    if (overlaps(Pdown, Q)) blocked = true;
  }
  if (!blocked) throw new Error('internal: resting tile is not blocked');
  return { y0: best, poly: P };
}

function contactsOf(build, poly) {
  const half = build.half;
  const neigh = build.tiles.map((t) => edges(t.poly));
  neigh.push([[pt(rat(-half), ZERO), pt(rat(half), ZERO)]]); // the car top
  const segs = [], pts = [];
  for (const nEdges of neigh) {
    for (const [a, b] of edges(poly)) {
      for (const [c, d] of nEdges) {
        const r = segInter(a, b, c, d);
        if (!r) continue;
        if (r.seg) segs.push(r.seg); else pts.push(r.point);
      }
    }
  }
  const segments = segs.map((s) => s.map(triple).sort(cmpTriple)).sort(cmpSeg);
  const points = [];
  for (const p of pts) {
    if (segs.some(([a, b]) => onSeg(p, a, b))) continue;
    const t = triple(p);
    if (!points.some((u) => cmpTriple(u, t) === 0)) points.push(t);
  }
  points.sort(cmpTriple);
  return { segments, points };
}

// S at one x: the highest boundary point at or below y0 of any element whose closed x-range
// contains x (a vertical side at an x-range end counts as boundary along its whole length).
function supportAt(elems, x, y0) {
  let best = null;
  const take = (y) => { if (best === null || cmp(y, best) > 0) best = y; };
  for (const E of elems) {
    const [l, r] = xRange(E);
    if (cmp(x, l) < 0 || cmp(x, r) > 0) continue;
    const s = section(E, x);
    if (eq(x, l) || eq(x, r)) { if (cmp(s.lo, y0) <= 0) take(kmin(s.hi, y0)); continue; }
    if (cmp(s.hi, y0) <= 0) take(s.hi);
    else if (cmp(s.lo, y0) <= 0) take(s.lo);
  }
  return best;
}

// S(x) over the bottom edge [x0, x1] at height y0, as linear pieces between breakpoints
function supportPieces(elems, x0, x1, y0) {
  const inside = (x) => cmp(x, x0) > 0 && cmp(x, x1) < 0;
  const uniq = (xs) => {
    xs.sort(cmp);
    return xs.filter((x, i) => i === 0 || !eq(x, xs[i - 1]));
  };
  const covering = (a, b) => elems.filter((E) => { const [l, r] = xRange(E); return cmp(l, a) <= 0 && cmp(r, b) >= 0; });
  let bps = [x0, x1];
  for (const E of elems) for (const v of E) if (inside(v.x)) bps.push(v.x);
  bps = uniq(bps);
  // add crossings of the upper boundaries, so that one element is on top on every piece
  const extra = [];
  for (let i = 0; i + 1 < bps.length; i++) {
    const a = bps[i], b = bps[i + 1];
    const vals = covering(a, b).map((E) => [section(E, a).hi, section(E, b).hi]);
    for (let j = 0; j < vals.length; j++) for (let k = j + 1; k < vals.length; k++) {
      const da = sub(vals[j][0], vals[k][0]), db = sub(vals[j][1], vals[k][1]);
      if (sgn(da) * sgn(db) < 0) extra.push(add(a, div(mul(sub(b, a), da), sub(da, db))));
    }
  }
  bps = uniq(bps.concat(extra));
  const pieces = [];
  for (let i = 0; i + 1 < bps.length; i++) {
    const a = bps[i], b = bps[i + 1], mid = div(add(a, b), rat(2));
    const cov = covering(a, b);
    if (cov.length === 0) { pieces.push({ a, b, covered: false }); continue; }
    let top = null, topMid = null;
    for (const E of cov) {
      const m = section(E, mid).hi;
      if (cmp(m, y0) > 0) throw new Error('internal: something above the resting bottom edge');
      if (top === null || cmp(m, topMid) > 0) { top = E; topMid = m; }
    }
    pieces.push({ a, b, covered: true, fa: section(top, a).hi, fb: section(top, b).hi });
  }
  return { bps, pieces };
}

// inf of S over the x in [x0, x1] where S is defined (null if nowhere). Where S jumps up at a
// vertical side the infimum is a one-sided limit; it is then a supremum of y0 - S, not a maximum.
function lowestSupport(build, x0, x1, y0) {
  const elems = obstacles(build);
  const { bps, pieces } = supportPieces(elems, x0, x1, y0);
  let low = null;
  const take = (v) => { if (v !== null && (low === null || cmp(v, low) < 0)) low = v; };
  for (const pc of pieces) if (pc.covered) { take(pc.fa); take(pc.fb); }
  for (const x of bps) take(supportAt(elems, x, y0));
  return low;
}

// section 5a: square and up triangle
function judgeFlat(build, col, y0) {
  const x0 = rat(col, 2), x1 = add(x0, ONE);
  let onLen = ZERO;
  for (const t of flatTops(build)) {
    if (!eq(t.y, y0)) continue;
    const l = kmax(t.l, x0), r = kmin(t.r, x1);
    if (cmp(l, r) < 0) onLen = add(onLen, sub(r, l));
  }
  if (sgn(onLen) === 0) return { fit: false, gap: null };
  const low = lowestSupport(build, x0, x1, y0);
  return { fit: true, gap: low !== null && cmp(low, y0) < 0 ? toPQ(sub(y0, low)) : null };
}

// section 5b: down triangle
function judgeDown(build, col, y0) {
  const xl = rat(col, 2), xm = add(xl, HALF), xr = add(xl, ONE), yt = add(y0, H);
  const sides = [[pt(xl, yt), pt(xm, y0)], [pt(xm, y0), pt(xr, yt)]]; // lower left, lower right
  for (const t of build.tiles) {
    if (t.kind !== 'up') continue;
    for (const e of edges(t.poly)) {
      if (eq(e[0].y, e[1].y)) continue; // the base is not a slanted side
      if (sides.some((s) => sameSeg(s, e))) return { fit: true, gap: null };
    }
  }
  return { fit: false, gap: null };
}

function evaluate(build, kind, col) {
  const { y0, poly } = rest(build, kind, col);
  const j = kind === 'down' ? judgeDown(build, col, y0) : judgeFlat(build, col, y0);
  const contacts = contactsOf(build, poly);
  return {
    y0,
    res: {
      outcome: j.fit ? 'fit' : 'off',
      way: kind === 'sq' ? null : kind,
      verts: poly.map(triple).sort(cmpTriple),
      reason: j.fit ? null : 'ONLY A POINT',
      contacts,
      shine: j.fit ? contacts.segments.map((s) => s.map((p) => p.slice())) : [],
      gap: j.fit ? j.gap : null,
    },
  };
}

function colOk(build, piece, col) {
  const h = build.half;
  return piece === 'sq' ? (col >= -2 * h && col <= 2 * h - 2) : (col >= -2 * h - 1 && col <= 2 * h - 1);
}

function drop(build, piece, col, way) {
  checkBuild(build);
  if (piece !== null && typeof piece === 'object' && col === undefined && way === undefined) {
    ({ piece, col, way } = piece);
  }
  if (piece !== 'sq' && piece !== 'tri') throw new Error(`drop: unknown piece ${String(piece)}`);
  if (!Number.isInteger(col)) throw new Error(`drop: col must be an integer, got ${String(col)}`);
  if (piece === 'sq') {
    if (way !== undefined && way !== null) throw new Error('drop: way is only for triangles');
    if (col % 2 !== 0) throw new Error(`drop: a square needs an even col, got ${col}`);
    if (!colOk(build, piece, col)) throw new Error(`drop: col ${col} outside the allowed square cols`);
    return evaluate(build, 'sq', col).res;
  }
  if (way !== undefined && way !== null && way !== 'up' && way !== 'down') throw new Error(`drop: bad way ${String(way)}`);
  if (!colOk(build, piece, col)) throw new Error(`drop: col ${col} outside the allowed triangle cols`);
  if (way === 'up' || way === 'down') return evaluate(build, way, col).res;
  // section 6
  const dn = evaluate(build, 'down', col), up = evaluate(build, 'up', col);
  const dFit = dn.res.outcome === 'fit', uFit = up.res.outcome === 'fit';
  if (dFit && uFit) return cmp(up.y0, dn.y0) < 0 ? up.res : dn.res; // lower wins; equal -> down
  if (dFit) return dn.res;
  if (uFit) return up.res;
  return up.res;
}

function sameJSON(a, b) {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => sameJSON(x, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(b)) {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    return sameJSON(ka, kb) && ka.every((k) => sameJSON(a[k], b[k]));
  }
  return false;
}

function place(build, result) {
  checkBuild(build);
  if (!result || result.outcome !== 'fit') throw new Error('place: only a fit result can be placed');
  const way = result.way;
  if (way !== null && way !== 'up' && way !== 'down') throw new Error('place: bad way in result');
  const piece = way === null ? 'sq' : 'tri';
  if (!Array.isArray(result.verts) || result.verts.length !== (piece === 'sq' ? 4 : 3)) throw new Error('place: bad verts');
  const col = Math.min(...result.verts.map((v) => v[0]));
  // the result must be exactly what this build gives for that drop
  const again = drop(build, piece, col, piece === 'sq' ? undefined : way);
  if (!sameJSON(again, result)) throw new Error('place: the result does not belong to this build');
  const kind = piece === 'sq' ? 'sq' : way;
  const { y0, poly } = rest(build, kind, col);
  const tile = Object.freeze({ kind, col, y0, poly });
  return Object.freeze({ [BUILD]: true, half: build.half, tiles: Object.freeze(build.tiles.concat([tile])) });
}

module.exports = { newBuild, drop, place };
