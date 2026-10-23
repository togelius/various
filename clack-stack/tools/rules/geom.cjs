'use strict';
// Independent exact geometry for the invariants (DESIGN §18.8 I10, I13, the gap of SPEC §5a and the balance of SPEC §5c),
// revision 5c: it shares no code with rules.js and reads
// only the public results (tiles(), drop()). Coordinates are scaled by 2: a point [X, p, q] is (X, p + q√3), so every
// x is an integer and every y is in ℤ[√3]; numbers a + b√3 are pairs [a, b] and compared exactly.

// ---- ℤ[√3] ----
function sgn(a, b) { // sign of a + b√3
  if (a === 0 && b === 0) return 0;
  if (a >= 0 && b >= 0) return 1;
  if (a <= 0 && b <= 0) return -1;
  const l = a * a, r = 3 * b * b;
  return a > 0 ? (l > r ? 1 : -1) : (l > r ? -1 : 1);
}
const add = (u, v) => [u[0] + v[0], u[1] + v[1]];
const sub = (u, v) => [u[0] - v[0], u[1] - v[1]];
const mul = (u, v) => [u[0] * v[0] + 3 * u[1] * v[1], u[0] * v[1] + u[1] * v[0]];
const cmp = (u, v) => sgn(u[0] - v[0], u[1] - v[1]);
const Y = p => [p[1], p[2]];

// ---- shapes ----
// a tile's corners, counter-clockwise, from its piece, way, col and lowest y [p, q]
function shape(piece, way, col, y) {
  const [p, q] = y;
  if (piece === 'sq') return [[col, p, q], [col + 2, p, q], [col + 2, p + 2, q], [col, p + 2, q]];
  if (way === 'up') return [[col, p, q], [col + 2, p, q], [col + 1, p, q + 1]];
  return [[col + 1, p, q], [col + 2, p, q + 1], [col, p, q + 1]];
}
function edges(poly) { return poly.map((v, i) => [v, poly[(i + 1) % poly.length]]); }
// the vector from P to Q: [dx (integer), dy (ℤ[√3])]
function vec(P, Q) { return [Q[0] - P[0], sub(Y(Q), Y(P))]; }
// cross(u, v) = ux·vy − uy·vx, in ℤ[√3]
function cross(u, v) { return sub([u[0] * v[1][0], u[0] * v[1][1]], [u[1][0] * v[0], u[1][1] * v[0]]); }
function dot(u, v) { return add([u[0] * v[0], 0], mul(u[1], v[1])); }

// do the insides of two convex polygons overlap? (exact separating axes; touching is not overlap)
function overlap(A, B) {
  for (const poly of [A, B]) for (const [P, Q] of edges(poly)) {
    const d = vec(P, Q);
    // projection on the edge's normal (−dy, dx): −dy·x + dx·y
    const proj = V => add(mul([-d[1][0], -d[1][1]], [V[0], 0]), [d[0] * V[1], d[0] * V[2]]);
    let aLo = null, aHi = null, bLo = null, bHi = null;
    for (const V of A) { const t = proj(V); if (!aLo || cmp(t, aLo) < 0) aLo = t; if (!aHi || cmp(t, aHi) > 0) aHi = t; }
    for (const V of B) { const t = proj(V); if (!bLo || cmp(t, bLo) < 0) bLo = t; if (!bHi || cmp(t, bHi) > 0) bHi = t; }
    if (cmp(aHi, bLo) <= 0 || cmp(bHi, aLo) <= 0) return false;
  }
  return true;
}
// the positive-length segment where edge e1 and edge e2 lie on each other, or null
function edgeOverlap(e1, e2) {
  const [P1, Q1] = e1, [P2, Q2] = e2, d = vec(P1, Q1);
  if (sgn(...cross(d, vec(P2, Q2))) !== 0) return null;
  if (sgn(...cross(d, vec(P1, P2))) !== 0) return null;
  const t = V => dot(d, vec(P1, V));
  const pts = [[P1, t(P1)], [Q1, t(Q1)], [P2, t(P2)], [Q2, t(Q2)]];
  const lo1 = cmp(pts[0][1], pts[1][1]) <= 0 ? pts[0] : pts[1], hi1 = lo1 === pts[0] ? pts[1] : pts[0];
  const lo2 = cmp(pts[2][1], pts[3][1]) <= 0 ? pts[2] : pts[3], hi2 = lo2 === pts[2] ? pts[3] : pts[2];
  const lo = cmp(lo1[1], lo2[1]) >= 0 ? lo1 : lo2, hi = cmp(hi1[1], hi2[1]) <= 0 ? hi1 : hi2;
  if (cmp(lo[1], hi[1]) >= 0) return null;
  return [lo[0], hi[0]];
}
function lex(a, b) { return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]; }
function normSeg(s) { return lex(s[0], s[1]) <= 0 ? [s[0], s[1]] : [s[1], s[0]]; }
// the positive-length contacts of polygon A with polygon B, merged into maximal segments
function contactSegs(A, B) {
  const segs = [];
  for (const e1 of edges(A)) for (const e2 of edges(B)) { const s = edgeOverlap(e1, e2); if (s) segs.push(s); }
  return mergeSegs(segs);
}
// with the car top: the edge y = 0 from x = −half to half (scaled: X from −2·half to 2·half)
function carSegs(A, half) {
  const car = [[-2 * half, 0, 0], [2 * half, 0, 0]], segs = [];
  for (const e of edges(A)) { const s = edgeOverlap(e, car); if (s) segs.push(s); }
  return mergeSegs(segs);
}
// collinear touching pieces of one contact become one (two edges of one convex tile never share a line)
function mergeSegs(segs) {
  segs = segs.map(normSeg).sort((a, b) => lex(a[0], b[0]) || lex(a[1], b[1]));
  const out = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (last && lex(last[1], s[0]) === 0 && sgn(...cross(vec(last[0], last[1]), vec(s[0], s[1]))) === 0) last[1] = s[1];
    else if (!last || lex(last[0], s[0]) || lex(last[1], s[1])) out.push([s[0], s[1]]);
  }
  return out;
}

// ---- the state of a build (I10) ----
// T: rules.tiles(build). Returns a list of problems (empty when the build is sound: no overlap, on the lattice, squares
// on whole tiles, joined to the car, every tile held by half an edge or more, every part balanced) and, per tile, how it holds:
// {by: 'car' | tile indexes, len: the length of bottom edge held, in half tiles (1 or 2), sides: ▼ sides held (0..2)}.
// Revision 5b (SPEC §5): a square or ▲ holds when part of its bottom edge (at least half) lies on a flat top below it:
// the car top, a square's top or a ▼'s top; a ▼ holds when a lower side lies whole on a ▲'s side.
function checkState(T, half) {
  const errs = [], n = T.length;
  const polys = T.map(t => shape(t.piece, t.way, t.col, t.y));
  T.forEach((t, i) => {
    const want = polys[i].slice().sort(lex), got = t.verts.slice().sort(lex);
    if (JSON.stringify(want) !== JSON.stringify(got)) errs.push(`tile ${i}: verts ${JSON.stringify(got)} are not its shape ${JSON.stringify(want)}`);
    for (const v of t.verts) if (!v.every(Number.isInteger) || v[1] % 2 !== 0) errs.push(`tile ${i}: vertex ${JSON.stringify(v)} is off the lattice`);
    for (const v of polys[i]) if (sgn(v[1], v[2]) < 0) errs.push(`tile ${i}: below the car top`);
    if (t.piece === 'sq' && (t.col % 2 !== 0 || t.col < -2 * half || t.col > 2 * half - 2)) errs.push(`tile ${i}: square at col ${t.col}`);
    if (t.piece === 'tri' && (t.col < -2 * half - 1 || t.col > 2 * half - 1)) errs.push(`tile ${i}: triangle at col ${t.col}, outside the hand's range`);
  });
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (overlap(polys[i], polys[j])) errs.push(`tiles ${i} and ${j} overlap`);
  // joined to the car by positive-length contacts
  const adj = T.map(() => []), reached = T.map(() => false), queue = [];
  T.forEach((t, i) => { if (carSegs(polys[i], half).length) { reached[i] = true; queue.push(i); } });
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (contactSegs(polys[i], polys[j]).length) { adj[i].push(j); adj[j].push(i); }
  while (queue.length) { const i = queue.shift(); for (const j of adj[i]) if (!reached[j]) { reached[j] = true; queue.push(j); } }
  reached.forEach((r, i) => { if (!r) errs.push(`tile ${i} is not joined to the car`); });
  // every tile holds by at least half an edge (never only at points)
  const holds = T.map((t, i) => holdOf(T, polys, i, half));
  holds.forEach((h, i) => {
    const t = T[i];
    if (t.way === 'down') { if (!h.sides) errs.push(`tile ${i} (▼ col ${t.col}): no lower side lies whole on a ▲'s side`); }
    else if (!h.len) errs.push(`tile ${i} (${t.piece === 'sq' ? '■' : '▲'} col ${t.col}): its bottom touches no flat top along an edge`);
    else if (h.short) errs.push(`tile ${i}: a bottom contact shorter than half an edge`);
  });
  // every part balanced within its grip (SPEC §5c)
  let parts = null, rests = null;
  if (n && !errs.length) {
    ({ parts, rests } = balanceOf(T, half));
    for (const p of parts) {
      if (!p.supported) errs.push(`tile ${p.t}: its part rests on nothing`);
      else if (p.tips) errs.push(`tile ${p.t}'s part (${p.members.join(',')}) leans ${p.side} by 8m = ${p.m8[0]} + ${p.m8[1]}√3, past its grip L2 = ${p.L2}`);
    }
  }
  return { errs, holds, parts, rests };
}
// how tile i holds, from the geometry alone (see checkState)
function holdOf(T, polys, i, half) {
  const t = T[i], P = polys[i], r = { by: [], len: 0, sides: 0, short: false };
  if (t.way === 'down') {
    const sides = [[P[2], P[0]], [P[0], P[1]]]; // [top-left, point], [point, top-right]
    sides.forEach((sd, k) => {
      for (let j = 0; j < T.length; j++) {
        if (j === i || T[j].way !== 'up') continue;
        if (covers(sd, contactSegs(P, polys[j]))) { r.sides |= 1 << k; r.by.push(j); }
      }
    });
    r.sides = (r.sides & 1) + ((r.sides >> 1) & 1);
    return r;
  }
  const bottom = [P[0], P[1]];
  const take = segs => { for (const s of segs) { const L = Math.abs(s[1][0] - s[0][0]); r.len += L; if (L < 1) r.short = true; } return segs.length > 0; };
  if (take(carSegs(P, half).filter(s => onLine(s, bottom)))) r.by.push('car');
  for (let j = 0; j < T.length; j++) {
    if (j === i || T[j].way === 'up') continue; // a ▲'s top is two slants, never flat
    const Q = polys[j], top = T[j].piece === 'sq' ? [Q[3], Q[2]] : [Q[2], Q[1]];
    const s = edgeOverlap(bottom, top);
    if (s && take([normSeg(s)])) r.by.push(j);
  }
  return r;
}
// does segment s lie on the line of edge e?
function onLine(s, e) { const d = vec(e[0], e[1]); return sgn(...cross(d, vec(e[0], s[0]))) === 0 && sgn(...cross(d, vec(e[0], s[1]))) === 0; }

// ---- the gap (SPEC §5a), from the polygons ----
// For a square or ▲ resting with its bottom at y0 = [p, q] (scaled: p + q√3) over cols col..col+2: over each half-tile
// column the topmost thing below (the car, or the tile whose upper boundary over the column is highest) gives S at the
// column's two ends; the gap is y0 minus the lowest of those, as SPEC's [p, q], or null when nothing is below y0.
// Columns with nothing below are skipped. (S is straight over a column, so its deepest point is at an end; where S
// jumps at a vertical side this is the supremum of y0 − S(x).)
function gapOf(T, half, col, y0) {
  const polys = T.map(t => shape(t.piece, t.way, t.col, t.y));
  let lo = null;
  for (let s = col; s <= col + 1; s++) {
    let best = s >= -2 * half && s < 2 * half ? [[0, 0], [0, 0]] : null;
    for (const P of polys) {
      const e = upperOver(P, s);
      if (!e) continue;
      if (!best || cmp(add(e[0], e[1]), add(best[0], best[1])) > 0) best = e;
    }
    if (!best) continue;
    for (const v of best) if (!lo || cmp(v, lo) < 0) lo = v;
  }
  if (!lo || cmp(lo, y0) >= 0) return null;
  return sub(y0, lo);
}
// the upper boundary of polygon P over the column X s..s+1, as its heights at the two ends, or null if P doesn't span it
function upperOver(P, s) {
  let best = null;
  for (const [A, B] of edges(P)) {
    if (A[0] === B[0]) continue;
    const [L, R] = A[0] < B[0] ? [A, B] : [B, A];
    if (L[0] > s || R[0] < s + 1) continue;
    // the edge's heights at s and s + 1 (lattice edges span 1 or 2 columns; a 2-column edge is flat)
    const at = X => X === L[0] ? Y(L) : X === R[0] ? Y(R) : Y(L);
    const e = [at(s), at(s + 1)];
    if (!best || cmp(add(e[0], e[1]), add(best[0], best[1])) > 0) best = e;
  }
  return best;
}

// the tile's boundary edges; does segment s lie on one of them?
function onBoundary(poly, s) {
  for (const e of edges(poly)) {
    const d = vec(e[0], e[1]);
    if (sgn(...cross(d, vec(e[0], s[0]))) !== 0 || sgn(...cross(d, vec(e[0], s[1]))) !== 0) continue;
    const t = V => dot(d, vec(e[0], V)), L = dot(d, d);
    const a = t(s[0]), b = t(s[1]);
    if (sgn(...a) >= 0 && cmp(a, L) <= 0 && sgn(...b) >= 0 && cmp(b, L) <= 0) return true;
  }
  return false;
}
// is point P on the closed segment s?
function onSegment(P, s) {
  const d = vec(s[0], s[1]), w = vec(s[0], P);
  if (sgn(...cross(d, w)) !== 0) return false;
  const t = dot(d, w), L = dot(d, d);
  return sgn(...t) >= 0 && cmp(t, L) <= 0;
}
// the total length² test helpers for I13: does the union of segments cover segment E exactly (as a set of params)?
function covers(E, segs) {
  const d = vec(E[0], E[1]), L = dot(d, d), t = V => dot(d, vec(E[0], V));
  const iv = [];
  for (const s of segs) {
    if (sgn(...cross(d, vec(E[0], s[0]))) !== 0 || sgn(...cross(d, vec(E[0], s[1]))) !== 0) continue;
    let a = t(s[0]), b = t(s[1]);
    if (cmp(a, b) > 0) [a, b] = [b, a];
    iv.push([a, b]);
  }
  iv.sort((u, v) => cmp(u[0], v[0]));
  let reach = [0, 0];
  for (const [a, b] of iv) { if (cmp(a, reach) > 0) return false; if (cmp(b, reach) > 0) reach = b; }
  return cmp(reach, L) >= 0;
}

// ---- the balance (SPEC §5c), from the polygons ----
// Every polygon here is counter-clockwise, so an edge running right (+x) has the inside above it (part of the lower
// boundary) and an edge running left has it below (the upper boundary). chainAt(P, X0, s, lower) is the lower (or
// upper) edge of P that spans side s of X0 (s = +1: just right of X0, −1: just left); lattice edges have integer
// ends, so it spans the whole column from X0 to X0 + s. U rests on V iff for some vertex x X0 of either and some side
// s, U's lower edge and V's upper edge both span side s of X0, meet at X0 (they touch there), and in the middle of that
// column U's lower edge is not below V's upper edge (so just beside the touching point U's inside lies right above
// V's: SPEC "arbitrarily close to a point where they touch, some point of U's interior lies directly above some point
// of V's interior"). The middle check matters where a ▼'s top corner meets a ▲'s base corner with the ▲ on the ▼: all
// four boundaries meet at that corner, and only beside it is it clear which is on top. The car is V with an upper
// boundary y = 0 over X −2·half … 2·half.
function chainAt(P, X0, s, lower) {
  for (const [A, B] of edges(P)) {
    if (A[0] === B[0]) continue;
    if ((B[0] > A[0]) !== lower) continue;
    const lo = Math.min(A[0], B[0]), hi = Math.max(A[0], B[0]);
    if (s > 0 ? !(lo <= X0 && X0 < hi) : !(lo < X0 && X0 <= hi)) continue;
    return [A, B];
  }
  return null;
}
// the y of edge E at x = Xn / Xd, as [num (ℤ[√3]), den > 0]: (A.y·d·Xd + (B.y − A.y)·(Xn − A.x·Xd)) / (d·Xd)
function yAt(E, Xn, Xd) {
  const [A, B] = E, t = Xn - A[0] * Xd;
  let d = (B[0] - A[0]) * Xd, num = add([A[1] * d, A[2] * d], [(B[1] - A[1]) * t, (B[2] - A[2]) * t]);
  if (d < 0) { d = -d; num = [-num[0], -num[1]]; }
  return [num, d];
}
const fracCmp = (u, v) => sgn(u[0][0] * v[1] - v[0][0] * u[1], u[0][1] * v[1] - v[0][1] * u[1]);
// exact bounds of a polygon: least and greatest X, lowest and highest y ([p, q])
function boundsOf(P) {
  let x0 = Infinity, x1 = -Infinity, y0 = null, y1 = null;
  for (const v of P) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); const y = Y(v); if (!y0 || cmp(y, y0) < 0) y0 = y; if (!y1 || cmp(y, y1) > 0) y1 = y; }
  return { x0, x1, y0, y1 };
}
function restsOnPoly(U, V, bu, bv) {
  // two tiles that share no column, or whose heights don't meet, rest on nothing of each other (exact, a shortcut)
  if (bu && bv && (bu.x1 <= bv.x0 || bv.x1 <= bu.x0 || cmp(bu.y0, bv.y1) > 0 || cmp(bv.y0, bu.y1) > 0)) return false;
  const xs = new Set(U.map(v => v[0]).concat(V.map(v => v[0])));
  for (const X0 of xs) for (const s of [-1, 1]) {
    const a = chainAt(U, X0, s, true), b = chainAt(V, X0, s, false);
    if (!a || !b || fracCmp(yAt(a, X0, 1), yAt(b, X0, 1)) !== 0) continue;
    if (fracCmp(yAt(a, 2 * X0 + s, 2), yAt(b, 2 * X0 + s, 2)) >= 0) return true;
  }
  return false;
}
function restsOnCarPoly(U, half) {
  const h2 = 2 * half;
  for (const X0 of new Set(U.map(v => v[0]))) for (const s of [-1, 1]) {
    if (s > 0 ? !(-h2 <= X0 && X0 < h2) : !(-h2 < X0 && X0 <= h2)) continue;
    const a = chainAt(U, X0, s, true);
    if (!a) continue;
    const y = yAt(a, X0, 1);
    if (y[0][0] === 0 && y[0][1] === 0) return true; // the car's top is at 0, and nothing is below it
  }
  return false;
}
// the whole shared boundary of two touching polygons (SPEC: one segment of positive length, or one point): [P, Q] with
// P = Q for a point, or null
function contactOf(A, B) {
  const segs = contactSegs(A, B);
  if (segs.length) return segs.length === 1 ? segs[0] : null; // two convex tiles share at most one segment
  for (const v of A) if (edges(B).some(e => onSegment(v, e))) return [v, v];
  for (const v of B) if (edges(A).some(e => onSegment(v, e))) return [v, v];
  return null;
}
function carContactOf(A, half) {
  const segs = carSegs(A, half);
  if (segs.length) return segs[0];
  const car = [[-2 * half, 0, 0], [2 * half, 0, 0]];
  for (const v of A) if (onSegment(v, car)) return [v, v];
  return null;
}
// twice a contact's length, an integer for any segment between lattice points at 0° or 60° (SPEC: |Δx| flat, 2·|Δx|
// on a slant); scaled coordinates give 2·length = √(ΔX² + Δy²)
function len2(s) {
  const dX = s[1][0] - s[0][0], dp = s[1][1] - s[0][1], dq = s[1][2] - s[0][2];
  if (dp && dq) throw new Error('len2: not a lattice direction ' + JSON.stringify(s));
  const sq = dX * dX + dp * dp + 3 * dq * dq, r = Math.round(Math.sqrt(sq));
  if (r * r !== sq) throw new Error('len2: length is not a whole number of half tiles ' + JSON.stringify(s));
  return r;
}
// The balance of every tile's part in build T (rules.tiles()), as SPEC §5c says, in exact numbers:
//   rests: per tile, [{j: tile index or −1 (the car), c: contact}] of what it rests on;
//   parts: per tile t, {members (sorted), x0, x1 (support's least and greatest X), L2 (2·L), m8: 8·m as [a, b] (a + b√3),
//     side ('left' | 'right' | null), tips (m > L/4), ratio (m / (L/4) as a float, 0 when not leaning), pivot}.
// Weights ×4 (a square's area 1 → 4, a triangle's √3/4 → √3) at each tile's middle X ((least + greatest X)/2), so with
// x in half tiles, 8m = Σ w·(X − Xend) and the grip L/4 is L2/8: it tips when 8m > L2.
// baseRests (optional): the rests of T without its last tile (balanceOf(T minus the last).rests), to add one tile to a
// build without working out the rest again; the last tile's relations to every other are worked out either way.
function balanceOf(T, half, baseRests) {
  const n = T.length, polys = T.map(t => shape(t.piece, t.way, t.col, t.y)), bounds = polys.map(boundsOf);
  const add1 = (u, v) => { if (restsOnPoly(polys[u], polys[v], bounds[u], bounds[v])) rests[u].push({ j: v, c: contactOf(polys[u], polys[v]) }); };
  let rests;
  if (baseRests && baseRests.length === n - 1) {
    rests = baseRests.map(r => r.slice());
    rests.push([]);
    const u = n - 1;
    if (restsOnCarPoly(polys[u], half)) rests[u].push({ j: -1, c: carContactOf(polys[u], half) });
    for (let v = 0; v < u; v++) { add1(u, v); add1(v, u); }
  } else {
    rests = polys.map(() => []);
    for (let u = 0; u < n; u++) {
      if (restsOnCarPoly(polys[u], half)) rests[u].push({ j: -1, c: carContactOf(polys[u], half) });
      for (let v = 0; v < n; v++) if (v !== u) add1(u, v);
    }
  }
  const above = polys.map(() => []);
  rests.forEach((rs, u) => rs.forEach(r => { if (r.j >= 0) above[r.j].push(u); }));
  const w = polys.map((P, i) => T[i].piece === 'sq' ? [4, 0] : [0, 1]);
  const mid = polys.map(P => { const xs = P.map(v => v[0]); return (Math.min(...xs) + Math.max(...xs)) / 2; });
  const parts = [];
  for (let t = 0; t < n; t++) {
    const inG = new Array(n).fill(false), stack = [t];
    inG[t] = true;
    while (stack.length) { const u = stack.pop(); for (const v of above[u]) if (!inG[v]) { inG[v] = true; stack.push(v); } }
    const members = [];
    for (let i = 0; i < n; i++) if (inG[i]) members.push(i);
    let x0 = Infinity, x1 = -Infinity, L2 = 0;
    const pts = [];
    for (const u of members) for (const r of rests[u]) {
      if (r.j >= 0 && inG[r.j]) continue;
      if (!r.c) throw new Error('balanceOf: tile ' + u + ' rests on ' + r.j + ' with no contact');
      pts.push(r.c[0], r.c[1]);
      if (lex(r.c[0], r.c[1])) L2 += len2(r.c);
    }
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
    // 8m past each end: Σ w·(X − x1) (right) and Σ w·(x0 − X) (left)
    let right = [0, 0], left = [0, 0];
    for (const u of members) { right = add(right, mul(w[u], [mid[u] - x1, 0])); left = add(left, mul(w[u], [x0 - mid[u], 0])); }
    let side = null, m8 = [0, 0];
    if (sgn(...right) > 0) { side = 'right'; m8 = right; } else if (sgn(...left) > 0) { side = 'left'; m8 = left; }
    const tips = side !== null && cmp(m8, [L2, 0]) > 0;
    let pivot = null;
    if (side) for (const p of pts) if (p[0] === (side === 'right' ? x1 : x0) && (!pivot || cmp(Y(p), Y(pivot)) < 0)) pivot = p;
    parts.push({ t, members, x0, x1, L2, m8, side, tips, pivot, ratio: side ? (m8[0] + m8[1] * Math.sqrt(3)) / L2 : 0, supported: pts.length > 0 });
  }
  return { rests, parts };
}
// SPEC §5c's report for a build whose last tile is the new one: the failing tile whose lowest point is lowest (ties:
// the smaller col), as {base (index), members (list), side, pivot, m8, L2, failing (every failing tile)}, or
// {none: true} when every part balances; both with the build's parts and rests (balanceOf)
function tipsReportOf(T, half, baseRests) {
  const { parts, rests } = balanceOf(T, half, baseRests);
  const fails = parts.filter(p => p.tips);
  if (!fails.length) return { none: true, parts, rests };
  const low = i => T[i].y;
  fails.sort((a, b) => cmp(low(a.t), low(b.t)) || T[a.t].col - T[b.t].col);
  const f = fails[0];
  return { base: f.t, members: f.members, side: f.side, pivot: f.pivot, m8: f.m8, L2: f.L2, failing: fails.map(p => p.t), parts, rests };
}

module.exports = { sgn, onSegment, shape, edges, overlap, contactSegs, carSegs, checkState, holdOf, gapOf, onBoundary, covers, lex, normSeg, balanceOf, tipsReportOf, restsOnPoly, boundsOf, cmp, add, mul };
