// ACCESSION — lines, bolts and beams (BUILD.md §8.1, §8.3). W0d builds the geometry of a line
// and of a beam; W1-ARCH-B owns the file after, and builds shots (the kiter's, the
// Pin-Driver's) and the reflector.
//
// A bolt (a shot) passes what can be seen through and is not glass (Grid.bolt); only beams
// pass glass. A beam stops at what blocks sight: a tile that cannot be seen through, or one a
// sight-blocking surface (a Fumigant cloud, plaster dust) covers (Grid.clear). A beam's tiles
// are fixed when it is marked, so a cloud laid while it is shown does not cut it. A reflector
// sends a bolt or beam back along its line toward where it came from, so nothing behind the
// reflector is hit, and the shooter's own tile is on the way back.
'use strict';
const Ranged = (() => {
  // The tiles of the Bresenham line between two tiles, both ends included, traced as
  // Grid.los traces it (from the end that comes first in row-major order), so that a line
  // and line of sight cross the same tiles; listed from (x0, y0).
  function bresenham(x0, y0, x1, y1) {
    const flip = y1 < y0 || (y1 === y0 && x1 < x0);
    let ax = x0, ay = y0, bx = x1, by = y1;
    if (flip) { ax = x1; ay = y1; bx = x0; by = y0; }
    const dx = Math.abs(bx - ax), dy = Math.abs(by - ay), sx = bx > ax ? 1 : -1, sy = by > ay ? 1 : -1, out = [];
    let err = dx - dy, x = ax, y = ay;
    for (;;) {
      out.push([x, y]);
      if (x === bx && y === by) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return flip ? out.reverse() : out;
  }

  // Ranged.line(state, x0, y0, x1, y1, range, pass) → [[x, y]…]: the tiles a line from (x0, y0)
  // toward (x1, y1) enters, in order, up to and including (x1, y1), at most `range` of them,
  // stopping before the first tile pass(m, x, y) refuses (Grid.seeThrough if pass is not
  // given; Grid.bolt for a shot, which stops at glass). The tile it starts on is not listed.
  // It looks at tiles only, not surfaces: a shot is made only with line of sight (Grid.los,
  // which surfaces block), so a bolt never needs to cross a cloud.
  function line(state, x0, y0, x1, y1, range, pass) {
    const m = state.dept, ok = pass || Grid.seeThrough, out = [];
    const pts = bresenham(x0, y0, x1, y1);
    for (let i = 1; i < pts.length && out.length < range; i++) {
      const [x, y] = pts[i];
      if (!Grid.inside(m, x, y) || !ok(m, x, y)) break;
      out.push([x, y]);
    }
    return out;
  }

  // The path of a beam from a's tile in direction d, at most `range` steps: it goes straight,
  // through glass, and stops before a tile sight cannot pass (Grid.clear: one it cannot see
  // through, or one a Fumigant cloud or plaster dust covers). On a tile where
  // Ranged.reflectorAt holds it turns back the way it came, and its later steps still count
  // toward the range. Each tile is listed once, at the first step that enters it, with the
  // tile that step came from, so the way back lists only the tiles the way out did not: the
  // shooter's own tile, then those behind it.
  function trace(state, a, d, range) {
    if (!(Number.isInteger(d) && d >= 0 && d < 8)) throw new Error('Ranged.beam: no direction ' + d);
    const m = state.dept, crossed = new Uint8Array(m.w * m.h), tiles = [], from = [];
    let x = a.x, y = a.y, dx = Grid.DX[d], dy = Grid.DY[d];
    for (let s = 0; s < range; s++) {
      const nx = x + dx, ny = y + dy;
      if (!Grid.clear(m, nx, ny)) break;
      const i = ny * m.w + nx;
      if (!crossed[i]) { crossed[i] = 1; tiles.push([nx, ny]); from.push([x, y]); }
      x = nx; y = ny;
      if (Ranged.reflectorAt(state, x, y)) { dx = -dx; dy = -dy; }
    }
    return { tiles, from };
  }

  // Ranged.beam(state, a, d, range) → [[x, y]…]: the tiles of a's beam in direction d, in the
  // order it crosses them, each once (trace, above).
  const beam = (state, a, d, range) => trace(state, a, d, range).tiles;
  // Ranged.beamFrom(state, a, d, range) → [[x, y]…]: for each tile of beam(…), at the same
  // index, the tile the beam entered it from (where its damage comes from, §8.1).
  const beamFrom = (state, a, d, range) => trace(state, a, d, range).from;

  // [stub → W1-ARCH-B] Is there a reflector at (x, y) that turns a bolt or beam back? Its
  // uid, or null; false (no reflector anywhere) until built.
  const reflectorAt = (state, x, y) => false;
  // [stub → W1-ARCH-B] att shoots a rolled bolt toward (x, y), with how {kind: 'shot', dmin?,
  // dmax?, acc?, item?} (W1-KIT's Pin-Driver passes its own damage and Acc): ticks, or a
  // refusal code. It hits the first actor on its line through Combat.attack, with how.range
  // and how.via (the last tile the bolt crossed) filled in.
  const shoot = (state, att, x, y, how, ev) => 'not_built';

  return { bresenham, line, beam, beamFrom, reflectorAt, shoot };
})();
