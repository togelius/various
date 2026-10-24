'use strict';
/*
 * Clack Stack placement oracle, written only from SPEC.md (revision 5e).
 *
 * Numbers. Every coordinate is used at twice its size: the point [X, p, q] of the spec is
 * x' = X, y' = p + q*sqrt3. Scaling both axes by 2 changes no decision, so every coordinate is an
 * integer (x') or an element a + b*sqrt3 of Z[sqrt3] (y'), held as two JS integers. Every
 * intermediate value is an integer far below 2^53 (coordinates are guarded at 2^20), so +, -, *
 * are exact; signs of a + b*sqrt3 are decided by comparing a^2 with 3b^2 (BigInt when the squares
 * could pass 2^53). Divisions only happen where the quotient is exact, and that is checked.
 * No floating point value is ever part of a decision.
 *
 * Geometry is done on convex polygons with exact vertices (square, up and down triangle, and the
 * car as the rectangle x in [-half, half], y in [-1, 0], which is exact because nothing is ever
 * below y = 0):
 *  - resting height (section 3): for each obstacle whose x-range overlaps the tile's open x-range,
 *    the tile first meets it at the shift max over the common range of top_obstacle(x) -
 *    bottom_tile(x); that is concave minus convex, so it is evaluated at the range ends and at the
 *    vertex xs inside. The tile stops at the largest such shift. (An exact SAT check of "free at
 *    rest, blocked just below" can be switched on with _selfCheck(true).)
 *  - contacts (section 4): exact segment-segment intersection of every edge pair, per neighbour;
 *  - fit (sections 5a, 5b): length of the bottom edge on horizontal top edges at its height; for a
 *    down triangle, a lower side equal to a slanted side of a placed up triangle;
 *  - balance (section 5c): "rests on" from the shared boundary of each touching pair: along a
 *    non-vertical segment, the tile whose interior lies above the segment's line rests on the
 *    other; at a single point, the two interior cones at that point are compared on vertical lines
 *    just right and just left of it (slope intervals, exact). A shared segment of length exactly 1
 *    (dX^2 + (dp + dq*sqrt3)^2 = 4 in the doubled frame, decided on integers) is a lock; the car
 *    locks to nothing. Pieces are the components of the locks (union-find), a group is its piece
 *    plus every piece reachable upward through "rests on" (a search over the piece graph), and
 *    W, M and the support's ends are summed exactly. A group leans right iff M > W*xmax (left iff
 *    M < W*xmin); its pivot is the support point at that end with the least y.
 *  - props (5e): every vertical shared segment between two tiles is kept with the tile on its left
 *    (the segment is that tile's right side) and the tile on its right, and its two ends. A group
 *    leaning right is propped iff some kept segment has its left tile in the group, its right tile
 *    outside it (never the car), and its upper end strictly higher than the pivot; leaning left
 *    the same with left and right exchanged. Balanced iff it does not lean, or leans and is propped.
 * No lattice keys, edge hashing or precomputed column profiles: every query walks the polygons.
 *
 * API: newBuild({ half = 2 }), drop(build, piece, col, way?), place(build, result).
 * Test hooks (not part of the spec): _details(result), _stats, _resetStats(), _selfCheck(on), _record(on),
 * _variant(opts) (other readings of 5c, for the census only; never on by default), _proppedBy (the prop rule
 * on its own, for a synthetic test).
 */

// ---------------------------------------------------------------- exact numbers
const LIM = 33554432; // 2^25: below this, a*a and 3*b*b are exact doubles
function sgn2(a, b) { // sign of a + b*sqrt3, a and b integers
  if (a >= 0 && b >= 0) return a === 0 && b === 0 ? 0 : 1;
  if (a <= 0 && b <= 0) return -1;
  if (a < LIM && a > -LIM && b < LIM && b > -LIM) {
    const a2 = a * a, b2 = 3 * b * b;
    return a > 0 ? (a2 > b2 ? 1 : -1) : (a2 > b2 ? -1 : 1);
  }
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) throw new Error('internal: integer out of exact range');
  const A = BigInt(a), B = BigInt(b), a2 = A * A, b2 = 3n * B * B;
  return a > 0 ? (a2 > b2 ? 1 : -1) : (a2 > b2 ? -1 : 1);
}
const ycmp = (p1, q1, p2, q2) => sgn2(p1 - p2, q1 - q2);
const COORD_LIM = 1048576; // 2^20

// ---------------------------------------------------------------- polygons (CCW, vertices [X, p, q])
function mkPoly(v) {
  let Xmin = v[0][0], Xmax = v[0][0], lo = v[0], hi = v[0];
  for (let i = 1; i < v.length; i++) {
    const w = v[i];
    if (w[0] < Xmin) Xmin = w[0];
    if (w[0] > Xmax) Xmax = w[0];
    if (ycmp(w[1], w[2], lo[1], lo[2]) < 0) lo = w;
    if (ycmp(w[1], w[2], hi[1], hi[2]) > 0) hi = w;
  }
  return { v, Xmin, Xmax, loP: lo[1], loQ: lo[2], hiP: hi[1], hiQ: hi[2] };
}
function tileVerts(kind, col, p, q) {
  if (kind === 'sq') return [[col, p, q], [col + 2, p, q], [col + 2, p + 2, q], [col, p + 2, q]];
  if (kind === 'up') return [[col, p, q], [col + 2, p, q], [col + 1, p, q + 1]];
  if (kind === 'down') return [[col + 1, p, q], [col + 2, p, q + 1], [col, p, q + 1]];
  throw new Error('internal: kind');
}
function carPoly(half) {
  const L = -2 * half, R = 2 * half;
  return mkPoly([[L, -2, 0], [R, -2, 0], [R, 0, 0], [L, 0, 0]]);
}

// vertical cross-section of a closed convex polygon at x' = X, written to SEC = [loP, loQ, hiP, hiQ]
const SEC = [0, 0, 0, 0];
function section(poly, X) {
  if (X < poly.Xmin || X > poly.Xmax) return false;
  const v = poly.v, n = v.length;
  let have = false, lp = 0, lq = 0, hp = 0, hq = 0;
  for (let i = 0; i < n; i++) {
    const A = v[i], B = v[i + 1 === n ? 0 : i + 1];
    let yp, yq;
    if (A[0] === X) { yp = A[1]; yq = A[2]; }
    else if ((A[0] < X && X < B[0]) || (B[0] < X && X < A[0])) {
      const d = B[0] - A[0], t = X - A[0];
      const np = A[1] * d + (B[1] - A[1]) * t, nq = A[2] * d + (B[2] - A[2]) * t;
      if (np % d !== 0 || nq % d !== 0) throw new Error('internal: section off the half grid');
      yp = np / d + 0; yq = nq / d + 0;
    } else continue;
    if (!have) { lp = hp = yp; lq = hq = yq; have = true; continue; }
    if (sgn2(yp - lp, yq - lq) < 0) { lp = yp; lq = yq; }
    if (sgn2(yp - hp, yq - hq) > 0) { hp = yp; hq = yq; }
  }
  SEC[0] = lp; SEC[1] = lq; SEC[2] = hp; SEC[3] = hq;
  return have;
}

// ---------------------------------------------------------------- the drop (section 3)
function restAt(obs, P0) {
  let have = false, bp = 0, bq = 0;
  for (let k = 0; k < obs.length; k++) {
    const Q = obs[k];
    const l = P0.Xmin > Q.Xmin ? P0.Xmin : Q.Xmin, r = P0.Xmax < Q.Xmax ? P0.Xmax : Q.Xmax;
    if (l >= r) continue; // no common open x-range: the tile slides past
    const xs = [l, r];
    for (const w of P0.v) if (w[0] > l && w[0] < r) xs.push(w[0]);
    for (const w of Q.v) if (w[0] > l && w[0] < r) xs.push(w[0]);
    for (let i = 0; i < xs.length; i++) {
      section(Q, xs[i]); const hp = SEC[2], hq = SEC[3];
      section(P0, xs[i]); const dp = hp - SEC[0], dq = hq - SEC[1];
      if (!have || sgn2(dp - bp, dq - bq) > 0) { bp = dp; bq = dq; have = true; }
    }
  }
  if (!have) throw new Error('drop: nothing at all below the tile');
  return [bp + 0, bq + 0];
}

// optional exact SAT check at 64x resolution: free at rest, overlapping 1/128 lower
let SELF_CHECK = false, RECORD = false;
function overlapsScaled(P, Q, K, dp) { // P shifted by dp (in p units of the K-scaled frame)
  const sp = P.map((w) => [w[0] * K, w[1] * K + dp, w[2] * K]), sq = Q.map((w) => [w[0] * K, w[1] * K, w[2] * K]);
  for (const poly of [sp, sq]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const nxp = a[1] - b[1], nxq = a[2] - b[2], ny = b[0] - a[0];
      const proj = (S) => {
        let mn = null, mx = null;
        for (const w of S) {
          const d = [w[0] * nxp + w[1] * ny, w[0] * nxq + w[2] * ny];
          if (mn === null || sgn2(d[0] - mn[0], d[1] - mn[1]) < 0) mn = d;
          if (mx === null || sgn2(d[0] - mx[0], d[1] - mx[1]) > 0) mx = d;
        }
        return [mn, mx];
      };
      const [pmn, pmx] = proj(sp), [qmn, qmx] = proj(sq);
      if (sgn2(pmx[0] - qmn[0], pmx[1] - qmn[1]) <= 0 || sgn2(qmx[0] - pmn[0], qmx[1] - pmn[1]) <= 0) return false;
    }
  }
  return true;
}
function checkRest(obs, poly) {
  let blocked = false;
  for (const Q of obs) {
    if (overlapsScaled(poly.v, Q.v, 64, 0)) throw new Error('internal: resting tile overlaps');
    if (overlapsScaled(poly.v, Q.v, 64, -1)) blocked = true;
  }
  if (!blocked) throw new Error('internal: resting tile is not blocked');
}

// ---------------------------------------------------------------- segments
const samePt = (P, Q) => P[0] === Q[0] && P[1] === Q[1] && P[2] === Q[2];
function onSegment(P, A, B) {
  const rx = B[0] - A[0], rp = B[1] - A[1], rq = B[2] - A[2];
  const wx = P[0] - A[0], wp = P[1] - A[1], wq = P[2] - A[2];
  if (rx * wp - rp * wx !== 0 || rx * wq - rq * wx !== 0) return false; // cross(r, w) = 0 exactly
  if (P[0] < Math.min(A[0], B[0]) || P[0] > Math.max(A[0], B[0])) return false;
  const s1 = ycmp(P[1], P[2], A[1], A[2]), s2 = ycmp(P[1], P[2], B[1], B[2]);
  return s1 * s2 <= 0;
}
// intersection of closed segments AB, CD. Returns null, {pt}, or {seg: [P, Q]} (positive length).
function segInter(A, B, C, D) {
  const rx = B[0] - A[0], rp = B[1] - A[1], rq = B[2] - A[2];
  const sx = D[0] - C[0], sp = D[1] - C[1], sq = D[2] - C[2];
  const qx = C[0] - A[0], qp = C[1] - A[1], qq = C[2] - A[2];
  const dp = rx * sp - rp * sx, dq = rx * sq - rq * sx; // r x s
  if (dp === 0 && dq === 0) {
    if (qx * rp - qp * rx !== 0 || qx * rq - qq * rx !== 0) return null; // parallel, apart
    // collinear: the overlap is spanned by the endpoints that lie in both segments
    const vertical = rx === 0;
    let lo = null, hi = null;
    for (const P of [A, B, C, D]) {
      if (!onSegment(P, A, B) || !onSegment(P, C, D)) continue;
      const before = (U, V) => (vertical ? ycmp(U[1], U[2], V[1], V[2]) < 0 : U[0] < V[0]);
      if (lo === null || before(P, lo)) lo = P;
      if (hi === null || before(hi, P)) hi = P;
    }
    if (lo === null) return null;
    return samePt(lo, hi) ? { pt: lo } : { seg: [lo, hi] };
  }
  const sg = sgn2(dp, dq);
  const tp = qx * sp - qp * sx, tq = qx * sq - qq * sx; // q x s  (t = that / den)
  const up = qx * rp - qp * rx, uq = qx * rq - qq * rx; // q x r  (u = that / den)
  if (sgn2(tp, tq) * sg < 0 || sgn2(dp - tp, dq - tq) * sg < 0) return null;
  if (sgn2(up, uq) * sg < 0 || sgn2(dp - up, dq - uq) * sg < 0) return null;
  if (tp === 0 && tq === 0) return { pt: A };
  if (tp === dp && tq === dq) return { pt: B };
  if (up === 0 && uq === 0) return { pt: C };
  if (up === dp && uq === dq) return { pt: D };
  throw new Error('internal: two boundaries cross'); // would mean overlapping interiors
}

// shared boundary of the resting tile with one neighbour (a convex set: a point or a segment)
function touch(poly, nb) {
  if (poly.Xmax < nb.poly.Xmin || poly.Xmin > nb.poly.Xmax) return null;
  if (ycmp(poly.hiP, poly.hiQ, nb.poly.loP, nb.poly.loQ) < 0 || ycmp(poly.loP, poly.loQ, nb.poly.hiP, nb.poly.hiQ) > 0) return null;
  const v = poly.v, n = v.length, E = nb.edges;
  let seg = null;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const A = v[i], B = v[i + 1 === n ? 0 : i + 1];
    for (let j = 0; j < E.length; j++) {
      const r = segInter(A, B, E[j][0], E[j][1]);
      if (r === null) continue;
      if (r.seg) {
        if (seg !== null && !(samePt(seg[0], r.seg[0]) && samePt(seg[1], r.seg[1]))) throw new Error('internal: two contact segments with one neighbour');
        seg = r.seg;
      } else if (!pts.some((P) => samePt(P, r.pt))) pts.push(r.pt);
    }
  }
  if (seg !== null) {
    for (const P of pts) if (!onSegment(P, seg[0], seg[1])) throw new Error('internal: contact with one neighbour is not convex');
    return { seg, pt: null };
  }
  if (pts.length > 1) throw new Error('internal: two separate contact points with one neighbour');
  return pts.length === 1 ? { seg: null, pt: pts[0] } : null;
}

// ---------------------------------------------------------------- ordering for output
function cmpTriple(a, b) { return a[0] !== b[0] ? a[0] - b[0] : a[1] !== b[1] ? a[1] - b[1] : a[2] - b[2]; }
const cmpSeg = (s, t) => cmpTriple(s[0], t[0]) || cmpTriple(s[1], t[1]);
const triple = (P) => [P[0] + 0, P[1] + 0, P[2] + 0];
const sortedTriples = (v) => v.map(triple).sort(cmpTriple);

// ---------------------------------------------------------------- builds
const BUILD = Symbol('clack-build');
const STATE = Symbol('clack-state');
function tileInfo(kind, col, poly) {
  const v = poly.v, n = v.length;
  let w8p = 0, w8q = 0; // shoelace sum in the doubled frame = 8 * area
  for (let i = 0; i < n; i++) {
    const A = v[i], B = v[(i + 1) % n];
    w8p += A[0] * B[1] - B[0] * A[1];
    w8q += A[0] * B[2] - B[0] * A[2];
  }
  if (sgn2(w8p, w8q) <= 0) throw new Error('internal: polygon not counter-clockwise');
  const edges = [];
  for (let i = 0; i < n; i++) edges.push([v[i], v[(i + 1) % n]]);
  // xc4 = 4 * middle x = Xmin + Xmax (the middle col/2 + 1/2 of section 5c)
  return { kind, col, poly, edges, w8p, w8q, xc4: poly.Xmin + poly.Xmax, lowP: poly.loP, lowQ: poly.loQ };
}
function makeBuild(half, tiles, rels, locks, vcs, spts, pid) {
  const car = carPoly(half);
  const st = {
    half, tiles, rels, locks, vcs, spts, pid, car, // pid: the piece of each tile (census only)
    obs: tiles.map((t) => t.poly).concat([car]),
    // the car touches tiles only along its top (nothing is below y = 0)
    nbs: tiles.map((t, i) => ({ idx: i, poly: t.poly, edges: t.edges })).concat([{ idx: -1, poly: car, edges: [[car.v[2], car.v[3]]] }]),
  };
  const pub = tiles.map((t) => Object.freeze({ kind: t.kind, col: t.col, y0: Object.freeze([t.poly.loP, t.poly.loQ]), verts: Object.freeze(sortedTriples(t.poly.v).map(Object.freeze)) }));
  const b = { [BUILD]: true, half, tiles: Object.freeze(pub) };
  Object.defineProperty(b, STATE, { value: st, enumerable: false });
  return Object.freeze(b);
}
function newBuild(opts) {
  const o = opts == null ? {} : opts;
  if (typeof o !== 'object') throw new Error('newBuild: expects an options object');
  const half = o.half === undefined ? 2 : o.half;
  if (!Number.isInteger(half) || half < 1 || half > 100000) throw new Error('newBuild: half must be a positive integer');
  return makeBuild(half, [], [], [], [], [], new Int32Array(0));
}
function checkBuild(b) {
  if (!b || b[BUILD] !== true || !b[STATE]) throw new Error('not a build made by newBuild/place');
}

// ---------------------------------------------------------------- fit (section 5a, 5b)
function judgeFlat(st, col, p0, q0) {
  const X0 = col, X1 = col + 2;
  let on = 0;
  for (const E of st.obs) { // horizontal top edges: walked in -x direction, interior below
    const v = E.v, n = v.length;
    for (let i = 0; i < n; i++) {
      const A = v[i], B = v[(i + 1) % n];
      if (B[0] < A[0] && A[1] === B[1] && A[2] === B[2] && A[1] === p0 && A[2] === q0) {
        const l = Math.max(B[0], X0), r = Math.min(A[0], X1);
        if (l < r) on += r - l;
      }
    }
  }
  if (on === 0) return { fit: false, gap: null };
  const low = lowestSupport(st.obs, X0, X1, p0, q0);
  return { fit: true, gap: low !== null && ycmp(low[0], low[1], p0, q0) < 0 ? [p0 - low[0] + 0, q0 - low[1] + 0] : null };
}

// S at one x: the highest boundary point at or below y0 of an element whose closed x-range holds x
// (a vertical side at an end of an x-range counts along its whole length)
function supportAt(obs, X, p0, q0) {
  let have = false, bp = 0, bq = 0;
  const take = (p, q) => { if (!have || ycmp(p, q, bp, bq) > 0) { bp = p; bq = q; have = true; } };
  for (const E of obs) {
    if (!section(E, X)) continue;
    const lp = SEC[0], lq = SEC[1], hp = SEC[2], hq = SEC[3];
    if (X === E.Xmin || X === E.Xmax) {
      if (ycmp(lp, lq, p0, q0) <= 0) { if (ycmp(hp, hq, p0, q0) <= 0) take(hp, hq); else take(p0, q0); }
    } else if (ycmp(hp, hq, p0, q0) <= 0) take(hp, hq);
    else if (ycmp(lp, lq, p0, q0) <= 0) take(lp, lq);
  }
  return have ? [bp, bq] : null;
}

// inf of S over the bottom edge [X0, X1] where S is defined: the one-sided limits of the top element
// on each piece between breakpoints, and the exact S at every breakpoint. null if S is nowhere defined.
function lowestSupport(obs, X0, X1, p0, q0) {
  const bset = [X0, X1];
  for (const E of obs) for (const w of E.v) if (w[0] > X0 && w[0] < X1) bset.push(w[0]);
  bset.sort((a, b) => a - b);
  const bps = bset.filter((x, i) => i === 0 || x !== bset[i - 1]);
  let have = false, lp = 0, lq = 0;
  const take = (p, q) => { if (!have || ycmp(p, q, lp, lq) < 0) { lp = p; lq = q; have = true; } };
  for (let i = 0; i + 1 < bps.length; i++) {
    const a = bps[i], b = bps[i + 1];
    let top = false, ap = 0, aq = 0, bp = 0, bq = 0;
    for (const E of obs) {
      if (E.Xmin > a || E.Xmax < b) continue;
      section(E, a); const hap = SEC[2], haq = SEC[3];
      section(E, b); const hbp = SEC[2], hbq = SEC[3];
      // on the open piece the upper boundary is linear; compare at the middle (sum of the ends)
      if (!top || sgn2(hap + hbp - ap - bp, haq + hbq - aq - bq) > 0) { top = true; ap = hap; aq = haq; bp = hbp; bq = hbq; }
    }
    if (!top) continue;
    if (sgn2(ap + bp - 2 * p0, aq + bq - 2 * q0) > 0) throw new Error('internal: something above the resting bottom edge');
    take(ap, aq); take(bp, bq);
  }
  for (const X of bps) { const s = supportAt(obs, X, p0, q0); if (s) take(s[0], s[1]); }
  return have ? [lp, lq] : null;
}

function judgeDown(st, col, p0, q0) {
  const L = [[col, p0, q0 + 1], [col + 1, p0, q0]], R = [[col + 1, p0, q0], [col + 2, p0, q0 + 1]];
  const same = (s, A, B) => (samePt(s[0], A) && samePt(s[1], B)) || (samePt(s[0], B) && samePt(s[1], A));
  for (const t of st.tiles) {
    if (t.kind !== 'up') continue;
    for (const [A, B] of t.edges) {
      if (A[1] === B[1] && A[2] === B[2]) continue; // the base is not a slanted side
      if (same(L, A, B) || same(R, A, B)) return { fit: true, gap: null };
    }
  }
  return { fit: false, gap: null };
}

// ---------------------------------------------------------------- rests on (section 5c)
// interior cone of a convex CCW polygon at a boundary point P: the edge vectors e with cross(e, d) > 0
function coneAt(poly, P) {
  const v = poly.v, n = v.length;
  for (let i = 0; i < n; i++) {
    if (samePt(v[i], P)) {
      const pr = v[(i + n - 1) % n], nx = v[(i + 1) % n];
      return [[P[0] - pr[0], P[1] - pr[1], P[2] - pr[2]], [nx[0] - P[0], nx[1] - P[1], nx[2] - P[2]]];
    }
  }
  for (let i = 0; i < n; i++) {
    const A = v[i], B = v[(i + 1) % n];
    if (onSegment(P, A, B)) return [[B[0] - A[0], B[1] - A[1], B[2] - A[2]]];
  }
  throw new Error('internal: contact point not on the boundary');
}
// a fraction [a, b, d] = (a + b*sqrt3) / d with d > 0
const fcmp = (u, w) => sgn2(u[0] * w[2] - w[0] * u[2], u[1] * w[2] - w[1] * u[2]);
// the slopes k with direction (s, k) inside the cone (s = +1: just right of P, s = -1: just left;
// on the line x = P.x + s*delta the cone holds y = P.y + delta*k). null if empty; lo/hi null = infinite.
function slopes(cone, s) {
  let lo = null, hi = null;
  for (const e of cone) {
    const ex = e[0], ep = s * e[1], eq = s * e[2]; // cross(e, (s, k)) = ex*k - s*ey > 0
    if (ex === 0) { if (sgn2(ep, eq) < 0) continue; return null; }
    if (ex > 0) { const f = [ep, eq, ex]; if (lo === null || fcmp(f, lo) > 0) lo = f; }
    else { const f = [-ep, -eq, -ex]; if (hi === null || fcmp(f, hi) < 0) hi = f; }
  }
  if (lo !== null && hi !== null && fcmp(lo, hi) >= 0) return null;
  return { lo, hi };
}
// some interior point of U lies directly above some interior point of V, arbitrarily close to P
function aboveAtPoint(U, V, P) {
  const cu = coneAt(U, P), cv = coneAt(V, P);
  for (const s of [1, -1]) {
    const iu = slopes(cu, s), iv = slopes(cv, s);
    if (iu === null || iv === null) continue;
    if (iu.hi === null || iv.lo === null || fcmp(iu.hi, iv.lo) > 0) return true;
  }
  return false;
}
// +1 if the polygon's interior is above the line through the non-vertical segment AB, -1 if below
function sideOf(poly, A, B) {
  const L = A[0] < B[0] ? A : B, R = A[0] < B[0] ? B : A;
  const rx = R[0] - L[0], rp = R[1] - L[1], rq = R[2] - L[2];
  for (const w of poly.v) {
    const wx = w[0] - L[0], wp = w[1] - L[1], wq = w[2] - L[2];
    const s = sgn2(rx * wp - rp * wx, rx * wq - rq * wx);
    if (s !== 0) return s;
  }
  throw new Error('internal: degenerate polygon');
}
// ---------------------------------------------------------------- locks (section 5c)
// A shared segment AB is a whole edge iff its length is exactly 1. In the doubled frame that is
// dX^2 + (dp + dq*sqrt3)^2 = 4, i.e. dp*dq = 0 (no sqrt3 part) and dX^2 + dp^2 + 3*dq^2 = 4: all on
// integers. Returns the direction ('h' horizontal, 'v' vertical, 's' slanted) or null.
function lockDir(A, B) {
  const dx = B[0] - A[0], dp = B[1] - A[1], dq = B[2] - A[2];
  if (dp * dq !== 0 || dx * dx + dp * dp + 3 * dq * dq !== 4) return null;
  return dx === 0 ? 'v' : dp === 0 && dq === 0 ? 'h' : 's';
}
// rests-on relations, the lock and the vertical contact between tile u (polygon U) and neighbour v
// (polygon V, -1 = car), from their shared boundary t. vcs gets every vertical shared segment as
// { l, r, X, loP, loQ, hiP, hiQ, seg }: l is the tile on its left (the segment lies on l's right side),
// r the tile on its right, lo and hi its ends by y. spts (test hooks only, no decision uses it) gets every
// single contact point P on a vertical line x' = X with the tile l wholly left of it and r wholly right.
function relate(u, U, v, V, t, out, locks, vcs, spts) {
  let uv, vu;
  if (t.seg) {
    const [A, B] = t.seg;
    if (v >= 0) { const d = lockDir(A, B); if (d !== null) locks.push({ a: v, b: u, dir: d }); } // the car locks to nothing
    if (A[0] === B[0]) { // vertical: side by side, neither rests on the other; kept for the props of 5e
      const X = A[0];
      let l, r;
      if (U.Xmax === X && V.Xmin === X) { l = u; r = v; } else if (U.Xmin === X && V.Xmax === X) { l = v; r = u; } else throw new Error('internal: a vertical contact that is not a right side against a left side');
      const lo = ycmp(A[1], A[2], B[1], B[2]) < 0 ? A : B, hi = lo === A ? B : A;
      if (v < 0) { stats.carVertical++; return; } // cannot happen (nothing is below y = 0); the car never props
      vcs.push({ l, r, X, loP: lo[1], loQ: lo[2], hiP: hi[1], hiQ: hi[2], seg: t.seg });
      return;
    }
    const su = sideOf(U, A, B), sv = sideOf(V, A, B);
    if (su === sv) throw new Error('internal: both tiles on one side of their contact');
    uv = su > 0; vu = sv > 0;
  } else {
    uv = aboveAtPoint(U, V, t.pt); vu = aboveAtPoint(V, U, t.pt);
    const X = t.pt[0];
    if (U.Xmax === X && V.Xmin === X) spts.push({ l: u, r: v, P: t.pt });
    else if (U.Xmin === X && V.Xmax === X) spts.push({ l: v, r: u, P: t.pt });
  }
  if (uv && vu) stats.bothWays++;
  if (uv) out.push({ u, v, seg: t.seg, pt: t.pt });
  if (vu) {
    if (v < 0) throw new Error('internal: the car rests on a tile');
    out.push({ u: v, v: u, seg: t.seg, pt: t.pt });
  }
}

// ---------------------------------------------------------------- balance (section 5c)
const stats = {};
function resetStats() {
  Object.assign(stats, {
    balanceRuns: 0, pieces: 0, groups: 0, emptySupport: 0, bothWays: 0, relAgainstOrder: 0,
    pieceCycles: 0, pieceCycleDrops: 0, knifeEdge: 0, failingGroups: 0, failExcludesNew: 0, tips: 0,
    multiFail: 0, lowTie: 0, sizeDecides: 0, sizeNarrows: 0, colDecides: 0, sameGroupTie: 0, baseTileTie: 0, baseIsNew: 0,
    pivotChoice: 0, altLowestDiffers: 0, altLowestCycle: 0, newLocks: 0, lockH: 0, lockV: 0, lockS: 0, mergeDrops: 0, vMergeDrops: 0,
    groupBelowPiece: 0, neitherTipsWay: 0, neitherTipsDown: 0, bothFit: 0,
    // 5e props. leaning: groups that lean (unbalanced under 5d); propped: of those, propped
    leaning: 0, propped: 0, proppedRight: 0, proppedLeft: 0, propContacts: 0, multiProp: 0, carVertical: 0,
    propUIsNew: 0, propVInSupport: 0, propXInside: 0, propXAtPivot: 0, propXOutside: 0, propStraddles: 0,
    propNeedsLowPivot: 0, propLength1: 0, propBothSides: 0, propByFailing: 0, propByFailingReport: 0, propMutual: 0,
    leanOtherSide: 0, leanPoint: 0, leanVerticalBelow: 0, leanVerticalAtPivot: 0,
    propDrops: 0, propRescues: 0, propTipsAnyway: 0, propReportDiffers: 0,
  });
}
resetStats();
// other readings, for the census only: verticalLocks false drops the locks along vertical sides;
// lowestOf 'group' compares the lowest point of the group instead of the piece's; props false is 5d;
// other readings of "propped": propHeight 'atOrAbove' (upper end at or above the pivot), 'whollyAbove' (lower
// end above it), 'any' (any height); propSide 'either' (a vertical contact on either side); propPivot
// 'highest' (compared with the highest support point at the leaning end instead of the pivot)
const VARIANT = { verticalLocks: true, lowestOf: 'piece', props: true, propHeight: 'strict', propSide: 'leaning', propPivot: 'lowest' };
let firstCycle = null;

// the pivot of a group G (by piece: G[pid[i]] === 1) leaning towards the support end X: the support
// point with x' = X and the least y. Also the greatest y there, and whether they differ.
function pivotOf(rels, pid, G, X) {
  let lo = null, hi = null;
  for (let k = 0; k < rels.length; k++) {
    const r = rels[k];
    if (G[pid[r.u]] === 0 || (r.v >= 0 && G[pid[r.v]] === 1)) continue;
    const ps = r.seg ? r.seg : [r.pt];
    for (let j = 0; j < ps.length; j++) {
      const P = ps[j];
      if (P[0] !== X) continue;
      if (lo === null || ycmp(P[1], P[2], lo[1], lo[2]) < 0) lo = P;
      if (hi === null || ycmp(P[1], P[2], hi[1], hi[2]) > 0) hi = P;
    }
  }
  if (lo === null) throw new Error('internal: no support point at the leaning end');
  return { pivot: lo, top: hi, choice: !samePt(lo, hi) };
}
// the props of a group G leaning to side ('right' | 'left') about pivot pv: every kept vertical
// contact with its tile on the leaning side's far end outside G (never the car), its other tile in G,
// and its upper end strictly higher than the pivot. With all false, only the first is returned.
function proppedBy(vcs, pid, G, side, pv, all) {
  const out = [];
  for (let k = 0; k < vcs.length; k++) {
    const c = vcs[k];
    if (c.l < 0 || c.r < 0) continue; // never the car
    let U = side === 'right' ? c.l : c.r, V = side === 'right' ? c.r : c.l; // U in G, V beyond U's leaning side
    if (G[pid[U]] !== 1 || G[pid[V]] === 1) {
      if (VARIANT.propSide !== 'either') continue;
      const t = U; U = V; V = t; // census only: the other side
      if (G[pid[U]] !== 1 || G[pid[V]] === 1) continue;
    }
    if (VARIANT.propHeight === 'strict') { if (ycmp(c.hiP, c.hiQ, pv[1], pv[2]) <= 0) continue; } // wholly at or below the pivot's height
    else if (VARIANT.propHeight === 'atOrAbove') { if (ycmp(c.hiP, c.hiQ, pv[1], pv[2]) < 0) continue; }
    else if (VARIANT.propHeight === 'whollyAbove') { if (ycmp(c.loP, c.loQ, pv[1], pv[2]) <= 0) continue; }
    out.push(c);
    if (!all) break;
  }
  return out;
}

function balance(tiles, rels, locks, vcs, spts, newIdx) {
  stats.balanceRuns++;
  const n = tiles.length;
  // pieces: union-find over the locks, numbered 0.. in the order of their first tile
  const par = new Int32Array(n);
  for (let i = 0; i < n; i++) par[i] = i;
  const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  for (let k = 0; k < locks.length; k++) {
    const L = locks[k];
    if (L.dir === 'v' && !VARIANT.verticalLocks) continue;
    const a = find(L.a), b = find(L.b);
    if (a !== b) { if (a < b) par[b] = a; else par[a] = b; }
  }
  const pid = new Int32Array(n), num = new Int32Array(n).fill(-1);
  let np = 0;
  for (let i = 0; i < n; i++) { const r = find(i); if (num[r] < 0) num[r] = np++; pid[i] = num[r]; }
  stats.pieces += np;
  // per piece: size, weight sums, lowest point, the lowest tile with the smallest col
  const size = new Array(np).fill(0), Wp = new Array(np).fill(0), Wq = new Array(np).fill(0), Mp = new Array(np).fill(0), Mq = new Array(np).fill(0);
  const lowT = new Array(np).fill(-1), lowTies = new Array(np).fill(0);
  for (let i = 0; i < n; i++) {
    const P = pid[i], ti = tiles[i];
    size[P]++; Wp[P] += ti.w8p; Wq[P] += ti.w8q; Mp[P] += ti.w8p * ti.xc4; Mq[P] += ti.w8q * ti.xc4;
    const b = lowT[P];
    if (b < 0) { lowT[P] = i; lowTies[P] = 1; continue; }
    const tb = tiles[b], c = ycmp(ti.lowP, ti.lowQ, tb.lowP, tb.lowQ);
    if (c < 0) { lowT[P] = i; lowTies[P] = 1; } else if (c === 0) { lowTies[P]++; if (ti.col < tb.col) lowT[P] = i; }
  }
  // piece graph: up[P] lists the other pieces with a tile resting on a tile of P
  const up = [];
  for (let P = 0; P < np; P++) up.push([]);
  const seen = new Uint8Array(np * np);
  for (let k = 0; k < rels.length; k++) {
    const r = rels[k];
    if (r.v < 0) continue;
    if (r.u < r.v) stats.relAgainstOrder++;
    const a = pid[r.u], b = pid[r.v];
    if (a === b || seen[b * np + a] === 1) continue;
    seen[b * np + a] = 1; up[b].push(a);
  }
  const failing = [], propped = [], record = RECORD ? [] : null;
  const inG = new Uint8Array(np), stack = new Int32Array(np);
  let cycleHere = false, propR = false, propL = false;
  for (let P = 0; P < np; P++) {
    // the group: P and every piece reachable upward (locks keep pieces whole)
    inG.fill(0); inG[P] = 1;
    let sp = 0, gs = size[P], gWp = Wp[P], gWq = Wq[P], gMp = Mp[P], gMq = Mq[P], gLow = lowT[P];
    stack[sp++] = P;
    while (sp > 0) {
      const Q = stack[--sp], uq = up[Q];
      for (let k = 0; k < uq.length; k++) {
        const R = uq[k];
        if (inG[R] === 1) continue;
        inG[R] = 1; stack[sp++] = R;
        gs += size[R]; gWp += Wp[R]; gWq += Wq[R]; gMp += Mp[R]; gMq += Mq[R];
        const a = tiles[lowT[R]], b = tiles[gLow];
        if (ycmp(a.lowP, a.lowQ, b.lowP, b.lowQ) < 0) gLow = lowT[R];
      }
    }
    stats.groups++;
    // the support: contacts of a group tile resting on a tile outside the group, or on the car
    let have = false, xmin = 0, xmax = 0, cyc = false;
    for (let k = 0; k < rels.length; k++) {
      const r = rels[k];
      if (inG[pid[r.u]] === 0) continue;
      if (r.v >= 0 && inG[pid[r.v]] === 1) {
        if (pid[r.u] === P && pid[r.v] !== P) cyc = true; // P rests on a piece above it: a cycle
        continue;
      }
      if (r.seg) {
        const a = r.seg[0][0], b = r.seg[1][0];
        if (!have) { xmin = xmax = a; have = true; }
        if (a < xmin) xmin = a; if (a > xmax) xmax = a; if (b < xmin) xmin = b; if (b > xmax) xmax = b;
      } else {
        const a = r.pt[0];
        if (!have) { xmin = xmax = a; have = true; }
        if (a < xmin) xmin = a; if (a > xmax) xmax = a;
      }
    }
    if (cyc) {
      stats.pieceCycles++; cycleHere = true;
      if (firstCycle === null) firstCycle = { tiles: tiles.map((t) => t.kind + t.col + '@' + t.lowP + ',' + t.lowQ), piece: P };
    }
    if (!have) { stats.emptySupport++; throw new Error('internal: a group with an empty support (SPEC 5c gives it no balance)'); }
    // leaning: 32*M against 32*W*x = W8 * 2X
    const rp = gMp - 2 * xmax * gWp, rq = gMq - 2 * xmax * gWq;
    const lp = 2 * xmin * gWp - gMp, lq = 2 * xmin * gWq - gMq;
    const sr = sgn2(rp, rq), sl = sgn2(lp, lq);
    const side = sr > 0 ? 'right' : sl > 0 ? 'left' : null;
    if (side === null && gs > 1 && (sr === 0 || sl === 0)) stats.knifeEdge++;
    const tb = tiles[lowT[P]], tg = tiles[gLow];
    if (ycmp(tg.lowP, tg.lowQ, tb.lowP, tb.lowQ) < 0) stats.groupBelowPiece++;
    // the pivot and the props (5e)
    let pv = null, props = null;
    if (side !== null) {
      stats.leaning++;
      pv = pivotOf(rels, pid, inG, side === 'right' ? xmax : xmin);
      props = VARIANT.props ? proppedBy(vcs, pid, inG, side, VARIANT.propPivot === 'highest' ? pv.top : pv.pivot, true) : [];
      if (props.length > 0) propStats(props, side, pv, rels, pid, inG, newIdx);
      else leanStats(side, pv, vcs, spts, pid, inG);
    }
    const fails = side !== null && props.length === 0;
    if (record) {
      const pt = [], gt = [];
      for (let i = 0; i < n; i++) { if (pid[i] === P) pt.push(i); if (inG[pid[i]] === 1) gt.push(i); }
      const vside = [], pside = [];
      for (const c of vcs) {
        const a = inG[pid[c.l]] === 1, b = c.r >= 0 && inG[pid[c.r]] === 1;
        if (a !== b) vside.push({ side: a ? 'right' : 'left', u: a ? c.l : c.r, v: a ? c.r : c.l, seg: c.seg.map(triple) });
      }
      for (const c of spts) {
        const a = c.l >= 0 && inG[pid[c.l]] === 1, b = c.r >= 0 && inG[pid[c.r]] === 1;
        if (a !== b) pside.push({ side: a ? 'right' : 'left', u: a ? c.l : c.r, v: a ? c.r : c.l, pt: triple(c.P) });
      }
      record.push({
        piece: pt, group: gt, size: gs, W8: [gWp, gWq], M32: [gMp, gMq], xmin, xmax, side, fails, base: lowT[P], cycle: cyc,
        pivot: pv && triple(pv.pivot), props: props && props.map((c) => ({ u: side === 'right' ? c.l : c.r, v: side === 'right' ? c.r : c.l, seg: c.seg.map(triple) })), vside, pside,
      });
    }
    if (side !== null) {
      const entry = { P, G: inG.slice(), size: gs, side, xmin, xmax, gLow, low: tb, pivot: pv.pivot, choice: pv.choice, props };
      if (fails) {
        stats.failingGroups++;
        if (inG[pid[newIdx]] === 0) stats.failExcludesNew++;
        failing.push(entry);
      } else {
        propped.push(entry);
        if (side === 'right') propR = true; else propL = true;
      }
    }
  }
  if (cycleHere) stats.pieceCycleDrops++;
  // the reported group: the piece with the lowest lowest point, then the larger group, then the
  // smaller col among its lowest tiles
  const better = (f, g, useGroupLow) => {
    const a = useGroupLow ? tiles[f.gLow] : f.low, b = useGroupLow ? tiles[g.gLow] : g.low;
    const c = ycmp(a.lowP, a.lowQ, b.lowP, b.lowQ);
    if (c !== 0) return c < 0;
    if (f.size !== g.size) return f.size > g.size;
    return tiles[lowT[f.P]].col < tiles[lowT[g.P]].col;
  };
  const pick = (L, useGroupLow) => { let best = L[0]; for (let i = 1; i < L.length; i++) if (better(L[i], best, useGroupLow)) best = L[i]; return best; };
  if (propped.length > 0) {
    stats.propDrops++;
    if (propR && propL) {
      stats.propBothSides++;
      // two groups leaning towards each other, each propped by a tile of the other
      const into = (f, g) => f.props.some((c) => g.G[pid[f.side === 'right' ? c.r : c.l]] === 1);
      if (propped.some((f) => f.side === 'right' && propped.some((g) => g.side === 'left' && into(f, g) && into(g, f)))) stats.propMutual++;
    }
    if (failing.length === 0) stats.propRescues++;
    else {
      stats.propTipsAnyway++;
      if (pick(failing.concat(propped), VARIANT.lowestOf === 'group') !== pick(failing, VARIANT.lowestOf === 'group')) stats.propReportDiffers++;
      // props whose far tile V is in a failing group; if such props did not count (one pass), would the
      // report change?
      const vIn = (f, c) => failing.some((g) => g.G[pid[f.side === 'right' ? c.r : c.l]] === 1);
      if (propped.some((f) => f.props.some((c) => vIn(f, c)))) {
        stats.propByFailing++;
        const fallen = propped.filter((f) => f.props.every((c) => vIn(f, c)));
        if (fallen.length > 0 && pick(failing.concat(fallen), VARIANT.lowestOf === 'group') !== pick(failing, VARIANT.lowestOf === 'group')) stats.propByFailingReport++;
      }
    }
  }
  if (failing.length === 0) return { tips: null, failing, propped, record, pid };
  const best = pick(failing, VARIANT.lowestOf === 'group');
  const alt = pick(failing, VARIANT.lowestOf !== 'group');
  if (alt !== best) { stats.altLowestDiffers++; if (alt.G.every((x, i) => x === best.G[i])) stats.altLowestCycle++; }
  if (failing.length > 1) stats.multiFail++;
  // which tie rule decided
  const tied = failing.filter((f) => ycmp(f.low.lowP, f.low.lowQ, best.low.lowP, best.low.lowQ) === 0);
  let tie = null;
  if (tied.length > 1) {
    stats.lowTie++;
    const top = tied.filter((f) => f.size === best.size);
    if (top.length === 1) { stats.sizeDecides++; tie = 'size'; } else {
      stats.colDecides++; tie = 'col';
      if (top.length < tied.length) stats.sizeNarrows++;
      if (top.some((f) => f !== best && f.G.every((x, i) => x === best.G[i]))) stats.sameGroupTie++;
    }
  }
  if (lowTies[best.P] > 1) stats.baseTileTie++;
  const baseIdx = lowT[best.P];
  if (baseIdx === newIdx) stats.baseIsNew++;
  if (best.choice) stats.pivotChoice++;
  stats.tips++;
  return {
    tips: { base: sortedTriples(tiles[baseIdx].poly.v), members: best.size, side: best.side, pivot: triple(best.pivot) },
    failing, propped, best, baseIdx, tie, baseTileTie: lowTies[best.P] > 1, record, pid,
  };
}

// census only: what the props of a propped group look like
function propStats(props, side, pv, rels, pid, G, newIdx) {
  stats.propped++;
  if (side === 'right') stats.proppedRight++; else stats.proppedLeft++;
  stats.propContacts += props.length;
  if (props.length > 1) stats.multiProp++;
  const uOf = (x) => (side === 'right' ? x.l : x.r), vOf = (x) => (side === 'right' ? x.r : x.l);
  if (props.some((x) => uOf(x) === newIdx)) stats.propUIsNew++;
  // V is a tile the group rests on
  if (props.some((x) => rels.some((r) => r.v === vOf(x) && G[pid[r.u]] === 1))) stats.propVInSupport++;
  // where the prop is, across the pivot (leaning right: X < pivot X is over the support's span)
  const beyond = (x) => (side === 'right' ? x.X - pv.pivot[0] : pv.pivot[0] - x.X);
  if (props.every((x) => beyond(x) < 0)) stats.propXInside++;
  else if (props.some((x) => beyond(x) === 0)) stats.propXAtPivot++;
  else stats.propXOutside++;
  // every prop reaches down to or below the pivot's height (none would prop if it had to lie wholly above)
  if (props.every((x) => ycmp(x.loP, x.loQ, pv.pivot[1], pv.pivot[2]) <= 0)) stats.propStraddles++;
  // it props only because the pivot is the lowest support point at that end
  if (props.every((x) => ycmp(x.hiP, x.hiQ, pv.top[1], pv.top[2]) <= 0)) stats.propNeedsLowPivot++;
  if (props.some((x) => lockDir([x.X, x.loP, x.loQ], [x.X, x.hiP, x.hiQ]) !== null)) stats.propLength1++;
}
// census only: why a leaning group is not propped (vertical contacts on the other side only, a point on
// the leaning side, vertical contacts on the leaning side wholly at or below the pivot, or ending exactly there)
function leanStats(side, pv, vcs, spts, pid, G) {
  let other = false, below = false, atPivot = false, point = false;
  for (const c of vcs) {
    const a = G[pid[c.l]] === 1, b = c.r >= 0 && G[pid[c.r]] === 1;
    if (a === b) continue;
    const leaningSide = (side === 'right') === a;
    if (!leaningSide) { other = true; continue; }
    const s = ycmp(c.hiP, c.hiQ, pv.pivot[1], pv.pivot[2]);
    if (s === 0) atPivot = true; else if (s < 0) below = true;
  }
  for (const c of spts) {
    const a = c.l >= 0 && G[pid[c.l]] === 1, b = c.r >= 0 && G[pid[c.r]] === 1;
    if (a !== b && (side === 'right') === a) point = true;
  }
  if (other) stats.leanOtherSide++;
  if (point) stats.leanPoint++;
  if (below) stats.leanVerticalBelow++;
  if (atPivot) stats.leanVerticalAtPivot++;
}

// ---------------------------------------------------------------- one evaluation
const cat = (a, b) => (b.length === 0 ? a : a.concat(b)); // the lists are never changed in place
const MEMO = new WeakMap(); // result object -> internal record

function evaluate(build, kind, col) {
  const st = build[STATE];
  const P0 = mkPoly(tileVerts(kind, col, 0, 0));
  const [p0, q0] = restAt(st.obs, P0);
  if (Math.abs(p0) > COORD_LIM || Math.abs(q0) > COORD_LIM) throw new Error('drop: build too tall for exact integer arithmetic');
  const poly = mkPoly(tileVerts(kind, col, p0, q0));
  if (SELF_CHECK) checkRest(st.obs, poly);
  const edge = kind === 'down' ? judgeDown(st, col, p0, q0) : judgeFlat(st, col, p0, q0);
  // contacts, per neighbour
  const touches = [];
  for (const nb of st.nbs) { const t = touch(poly, nb); if (t) touches.push({ nb, t }); }
  const segs = [], pts = [];
  for (const { t } of touches) if (t.seg) segs.push(t.seg); else pts.push(t.pt);
  const segments = segs.map((s) => sortedTriples(s)).sort(cmpSeg);
  const points = [];
  for (const P of pts) {
    if (segs.some((s) => onSegment(P, s[0], s[1]))) continue;
    if (!points.some((w) => samePt(w, P))) points.push(triple(P));
  }
  points.sort(cmpTriple);
  let outcome = 'off', reason = 'ONLY A POINT', gap = null, tips = null, newRels = null, newLocks = null, newVcs = null, newSpts = null, bal = null, tile = null;
  if (edge.fit) {
    tile = tileInfo(kind, col, poly);
    const n = st.tiles.length;
    newRels = []; newLocks = []; newVcs = []; newSpts = [];
    for (const { nb, t } of touches) relate(n, poly, nb.idx, nb.poly, t, newRels, newLocks, newVcs, newSpts);
    bal = balance(st.tiles.concat([tile]), st.rels.concat(newRels), st.locks.concat(newLocks), cat(st.vcs, newVcs), cat(st.spts, newSpts), n);
    if (bal.tips) { reason = 'TIPS OVER'; tips = bal.tips; }
    else {
      outcome = 'fit'; reason = null; gap = edge.gap;
      stats.newLocks += newLocks.length;
      const old = new Set();
      for (const L of newLocks) { if (L.dir === 'h') stats.lockH++; else if (L.dir === 'v') stats.lockV++; else stats.lockS++; old.add(st.pid[L.a]); }
      if (old.size > 1) { stats.mergeDrops++; if (newLocks.some((L) => L.dir === 'v')) stats.vMergeDrops++; }
    }
  }
  const res = {
    outcome,
    way: kind === 'sq' ? null : kind,
    verts: sortedTriples(poly.v),
    reason,
    contacts: { segments, points },
    shine: outcome === 'fit' ? segments.map((s) => s.map(triple)) : [],
    gap,
    tips,
  };
  const rec = { build, kind, col, y0: [p0, q0], tile, newRels, newLocks, newVcs, newSpts, bal, edgeFit: edge.fit, json: null };
  MEMO.set(res, rec);
  return { res, rec };
}

function colOk(half, piece, col) {
  return piece === 'sq' ? (col >= -2 * half && col <= 2 * half - 2) : (col >= -2 * half - 1 && col <= 2 * half - 1);
}

function drop(build, piece, col, way) {
  checkBuild(build);
  if (piece !== null && typeof piece === 'object' && col === undefined && way === undefined) ({ piece, col, way } = piece);
  if (piece !== 'sq' && piece !== 'tri') throw new Error(`drop: unknown piece ${String(piece)}`);
  if (!Number.isInteger(col)) throw new Error(`drop: col must be an integer, got ${String(col)}`);
  const half = build.half;
  let out;
  if (piece === 'sq') {
    if (way !== undefined && way !== null) throw new Error('drop: way is only for triangles');
    if (col % 2 !== 0) throw new Error(`drop: a square needs an even col, got ${col}`);
    if (!colOk(half, piece, col)) throw new Error(`drop: col ${col} outside the allowed square cols`);
    out = evaluate(build, 'sq', col);
  } else {
    if (way !== undefined && way !== null && way !== 'up' && way !== 'down') throw new Error(`drop: bad way ${String(way)}`);
    if (!colOk(half, piece, col)) throw new Error(`drop: col ${col} outside the allowed triangle cols`);
    if (way === 'up' || way === 'down') out = evaluate(build, way, col);
    else { // section 6
      const dn = evaluate(build, 'down', col), up = evaluate(build, 'up', col);
      const dFit = dn.res.outcome === 'fit', uFit = up.res.outcome === 'fit';
      if (dFit && uFit) { stats.bothFit++; out = ycmp(up.rec.y0[0], up.rec.y0[1], dn.rec.y0[0], dn.rec.y0[1]) < 0 ? up : dn; }
      else if (dFit) out = dn;
      else if (uFit) out = up;
      else {
        const dT = dn.res.reason === 'TIPS OVER', uT = up.res.reason === 'TIPS OVER';
        if (dT !== uT) { stats.neitherTipsWay++; if (dT) stats.neitherTipsDown++; out = dT ? dn : up; }
        else out = up;
      }
    }
  }
  if (out.res.outcome === 'fit') out.rec.json = JSON.stringify(out.res);
  return out.res;
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
  let rec = MEMO.get(result);
  if (!(rec && rec.build === build && rec.json !== null && rec.json === JSON.stringify(result))) {
    // not the very result this build gave: it must equal what this build gives for that drop
    const way = result.way;
    if (way !== null && way !== 'up' && way !== 'down') throw new Error('place: bad way in result');
    const piece = way === null ? 'sq' : 'tri';
    if (!Array.isArray(result.verts) || result.verts.length !== (piece === 'sq' ? 4 : 3)) throw new Error('place: bad verts');
    const col = Math.min(...result.verts.map((v) => v[0]));
    const again = drop(build, piece, col, piece === 'sq' ? undefined : way);
    if (!sameJSON(again, result)) throw new Error('place: the result does not belong to this build');
    rec = MEMO.get(again);
  }
  const st = build[STATE];
  for (const w of rec.tile.poly.v) if (Math.abs(w[0]) > COORD_LIM || Math.abs(w[1]) > COORD_LIM || Math.abs(w[2]) > COORD_LIM) throw new Error('place: build too tall');
  return makeBuild(st.half, st.tiles.concat([rec.tile]), st.rels.concat(rec.newRels), st.locks.concat(rec.newLocks), cat(st.vcs, rec.newVcs), cat(st.spts, rec.newSpts), rec.bal.pid);
}

// ---------------------------------------------------------------- test hooks (not part of the spec)
function _details(result) {
  const rec = MEMO.get(result);
  if (!rec) return null;
  const st = rec.build[STATE];
  return {
    y0: rec.y0, edgeFit: rec.edgeFit,
    relsNew: rec.newRels && rec.newRels.map((r) => ({ u: r.u, v: r.v, seg: r.seg, pt: r.pt })),
    relsAll: rec.newRels && st.rels.concat(rec.newRels).map((r) => ({ u: r.u, v: r.v })),
    locksNew: rec.newLocks && rec.newLocks.map((L) => ({ a: L.a, b: L.b, dir: L.dir })),
    locksAll: rec.newLocks && st.locks.concat(rec.newLocks).map((L) => [L.a, L.b]),
    pieces: rec.bal ? Array.from(rec.bal.pid) : null, // the piece number of every tile of the new build
    // failing groups, by piece: tiles of the piece, size of the group, side
    failing: rec.bal ? rec.bal.failing.map((f) => ({ piece: f.P, size: f.size, side: f.side, pivot: triple(f.pivot), groupPieces: Array.from(f.G) })) : null,
    // leaning groups that are propped (5e), by piece
    propped: rec.bal ? rec.bal.propped.map((f) => ({ piece: f.P, size: f.size, side: f.side, pivot: triple(f.pivot), groupPieces: Array.from(f.G) })) : null,
    vcsNew: rec.newVcs && rec.newVcs.map((c) => ({ l: c.l, r: c.r, seg: c.seg.map(triple) })), // vertical contacts of the new tile: l on the left
    vcsAll: rec.newVcs && st.vcs.concat(rec.newVcs).map((c) => ({ l: c.l, r: c.r, seg: c.seg.map(triple) })),
    chosen: rec.bal && rec.bal.tips ? rec.bal.best.P : null,
    baseIdx: rec.bal && rec.bal.tips ? rec.bal.baseIdx : null,
    tie: rec.bal ? rec.bal.tie || null : null, // null, 'size' or 'col': the tie rule that decided
    baseTileTie: rec.bal ? !!rec.bal.baseTileTie : false,
    groups: rec.bal ? rec.bal.record : null, // with _record(true): every piece's group, W8 = 8W, M32 = 32M, ends in X
  };
}
function _selfCheck(on) { SELF_CHECK = !!on; }
function _record(on) { RECORD = !!on; }
function _variant(opts) {
  const o = opts || {};
  VARIANT.verticalLocks = o.verticalLocks === undefined ? true : !!o.verticalLocks;
  VARIANT.lowestOf = o.lowestOf === 'group' ? 'group' : 'piece';
  VARIANT.props = o.props === undefined ? true : !!o.props;
  VARIANT.propHeight = ['atOrAbove', 'whollyAbove', 'any'].includes(o.propHeight) ? o.propHeight : 'strict';
  VARIANT.propSide = o.propSide === 'either' ? 'either' : 'leaning';
  VARIANT.propPivot = o.propPivot === 'highest' ? 'highest' : 'lowest';
}
// the prop rule alone: contacts [{ l, r, lo, hi }] (l, r tile indices, -1 = the car; lo, hi the ends as
// [X, p, q]), the piece of each tile, the pieces of the group, the side and the pivot [X, p, q];
// returns the indices of the propping contacts
function _proppedBy(contacts, pieceOf, groupPieces, side, pivot) {
  const vcs = contacts.map((c) => ({ l: c.l, r: c.r, X: c.hi[0], loP: c.lo[1], loQ: c.lo[2], hiP: c.hi[1], hiQ: c.hi[2], seg: [c.lo, c.hi] }));
  const G = new Uint8Array(Math.max(0, ...pieceOf) + 1);
  for (const P of groupPieces) G[P] = 1;
  return proppedBy(vcs, Int32Array.from(pieceOf), G, side, pivot, true).map((c) => vcs.indexOf(c));
}
const _firstCycle = () => firstCycle;

module.exports = { newBuild, drop, place, _details, _stats: stats, _resetStats: resetStats, _selfCheck, _record, _variant, _firstCycle, _proppedBy };
