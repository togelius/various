'use strict';
// What a percept-only bot may use (DESIGN §18.8 G3): plain geometry on what it sees. A percept is the display list as
// drawn (CS.display(), cut down by tools/bots/harness.cjs to what is visible on the screen): polygons and points in
// CSS px, colours, dashes and the words on the screen. Nothing here reads the game.

// the box round a list of points
function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return { x0, y0, x1, y1 };
}
function centre(pts) { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; }
// the largest distance from a point of A to the nearest point of B, both ways
function polyDist(A, B) {
  if (!A || !B || !A.length || !B.length) return Infinity;
  const one = (P, Q) => { let m = 0; for (const p of P) { let b = Infinity; for (const q of Q) b = Math.min(b, Math.hypot(p[0] - q[0], p[1] - q[1])); m = Math.max(m, b); } return m; };
  return Math.max(one(A, B), one(B, A));
}
// an affine map fitted to pairs of points (a list of [from, to]), by least squares: {map, resid}; null with fewer than
// three points not on a line
function fitAffine(pairs) {
  const n = pairs.length;
  if (n < 3) return null;
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bx = [0, 0, 0], by = [0, 0, 0];
  for (const [a, b] of pairs) {
    const v = [a[0], a[1], 1];
    for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) M[i][j] += v[i] * v[j]; bx[i] += v[i] * b[0]; by[i] += v[i] * b[1]; }
  }
  const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  if (Math.abs(D) < 1e-6) return null;
  const solve = b => [0, 1, 2].map(c => det(M.map((row, i) => row.map((v, j) => (j === c ? b[i] : v)))) / D);
  const X = solve(bx), Y = solve(by), map = p => [X[0] * p[0] + X[1] * p[1] + X[2], Y[0] * p[0] + Y[1] * p[1] + Y[2]];
  let resid = 0;
  for (const [a, b] of pairs) { const m = map(a); resid = Math.max(resid, Math.hypot(m[0] - b[0], m[1] - b[1])); }
  return { map, resid };
}
// How the screen moved between two pictures of the same tower: from the tiles both show (in the order they are drawn)
// or, with none, from the car (its top's ends and its wheels). {map, resid} or null
function towerMove(before, after) {
  const pairs = [];
  const n = Math.min(before.tiles.length, after.tiles.length);
  for (let i = 0; i < n; i++) {
    const a = before.tiles[i].poly, b = after.tiles[i].poly;
    if (a.length !== b.length) return null;
    for (let k = 0; k < a.length; k++) pairs.push([a[k], b[k]]);
  }
  if (pairs.length < 3) {
    if (!before.car || !after.car) return null;
    for (const k of ['top', 'wheels']) for (let j = 0; j < 2; j++) pairs.push([before.car[k][j], after.car[k][j]]);
  }
  return fitAffine(pairs);
}
// the car on the screen: its top's ends, the px per tile, its middle
function carFrame(p) {
  if (!p.car) return null;
  const [a, b] = p.car.top, L = Math.hypot(b[0] - a[0], b[1] - a[1]) / 4;
  return { L, x0: a[0], x1: b[0], y: (a[1] + b[1]) / 2, mid: (a[0] + b[0]) / 2 };
}
// what the ghost says: 'fit' (solid: white; amber when it may take the tower over; gold where THE TOPPER tops out) or
// 'off' (red, dashed), as drawn
const FIT_COLORS = new Set(['white', 'amber', 'gold']);
function ghostSays(p) { return !p.ghost ? null : FIT_COLORS.has(p.ghost.color) && !p.ghost.dashed ? 'fit' : p.ghost.color === 'red' && p.ghost.dashed ? 'off' : 'unclear'; }
// a deterministic random stream for a bot's choices
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

module.exports = { bbox, centre, polyDist, fitAffine, towerMove, carFrame, ghostSays, rng };
