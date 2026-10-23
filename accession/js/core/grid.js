// ACCESSION — the tile grid: what each tile character means, line of sight, walking
// distance and steps. A department's map is an array of row strings (BUILD.md §4.1).
'use strict';
const Grid = (() => {
  // Tile characters. Movement and sight follow the movement × sight matrix
  // (design/vocabulary.md §7.1); the registry describes each one to the player.
  const TILES = {
    '#': { name: 'wall' },
    '.': { name: 'floor', walk: 1, see: 1 },
    ',': { name: 'archway', walk: 1, see: 1 },
    '+': { name: 'closed door', walk: 1, door: 1 },
    "'": { name: 'open door', walk: 1, see: 1, door: 1 },
    'S': { name: 'staff door', walk: 1, door: 1, staff: 1 },
    'E': { name: 'entrance', walk: 1, see: 1 },
    'X': { name: 'exit door', walk: 1, see: 1 },
    'v': { name: 'vitrine', see: 1, glass: 1 },
    'k': { name: 'broken case', walk: 1, see: 1, loud: 1 },
    'x': { name: 'shards', walk: 1, see: 1, loud: 1 },
    'w': { name: 'pool', walk: 1, see: 1, loud: 1, slow: 1 },
    'p': { name: 'plinth', see: 1 },
    'f': { name: 'low furniture', see: 1 },
    'l': { name: 'lectern', see: 1 },
    'b': { name: 'bench', walk: 1, see: 1, bench: 1 },
    'o': { name: 'column' },
    'H': { name: 'shelving' },
    '|': { name: 'partition' },
    '~': { name: 'balustrade', see: 1 },
    '=': { name: 'rope line', walk: 1, see: 1 },
  };
  const WALK = new Uint8Array(128), SEE = new Uint8Array(128);
  for (const ch of Object.keys(TILES)) {
    const c = ch.charCodeAt(0);
    WALK[c] = TILES[ch].walk ? 1 : 0;
    SEE[c] = TILES[ch].see ? 1 : 0;
  }

  // Directions in a fixed order: N, NE, E, SE, S, SW, W, NW.
  const DX = [0, 1, 1, 1, 0, -1, -1, -1], DY = [-1, -1, 0, 1, 1, 1, 0, -1];

  const inside = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;
  const code = (m, x, y) => inside(m, x, y) ? m.tiles[y].charCodeAt(x) : 35; // '#'
  const ch = (m, x, y) => String.fromCharCode(code(m, x, y));
  const walkable = (m, x, y) => WALK[code(m, x, y)] === 1;
  const seeThrough = (m, x, y) => SEE[code(m, x, y)] === 1;
  function set(m, x, y, c) { const row = m.tiles[y]; m.tiles[y] = row.slice(0, x) + c + row.slice(x + 1); }

  // A step from (x, y) in direction d: the target must be walkable, and a diagonal step
  // may not cut past a tile you could not step onto.
  function canStep(m, x, y, d) {
    const nx = x + DX[d], ny = y + DY[d];
    if (!walkable(m, nx, ny)) return false;
    if (DX[d] !== 0 && DY[d] !== 0) return walkable(m, nx, y) && walkable(m, x, ny);
    return true;
  }

  // Line of sight between two tiles: a Bresenham line, always traced from the endpoint
  // that comes first in row-major order, so sight is symmetric. Endpoints never block.
  function los(m, x0, y0, x1, y1) {
    if (y1 < y0 || (y1 === y0 && x1 < x0)) { let t = x0; x0 = x1; x1 = t; t = y0; y0 = y1; y1 = t; }
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    for (;;) {
      if (x === x1 && y === y1) return true;
      if (!(x === x0 && y === y0) && !seeThrough(m, x, y)) return false;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  const chebyshev = (x0, y0, x1, y1) => Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));

  // Walking distance from one or more start tiles, by the step rule, out to maxDist.
  // extra(x, y) may add a cost for entering a tile (closed doors for noise). Returns an
  // Int32Array of distances, -1 where unreached. Not part of the state.
  function distances(m, starts, maxDist, extra) {
    const n = m.w * m.h, dist = new Int32Array(n).fill(-1);
    // Bucketed Dijkstra: costs are small integers.
    const buckets = [[]];
    for (const [x, y] of starts) { dist[y * m.w + x] = 0; buckets[0].push(y * m.w + x); }
    for (let d = 0; d < buckets.length && d <= maxDist; d++) {
      const b = buckets[d];
      if (!b) continue;
      for (let i = 0; i < b.length; i++) {
        const p = b[i];
        if (dist[p] !== d) continue;
        const x = p % m.w, y = (p - x) / m.w;
        for (let k = 0; k < 8; k++) {
          if (!canStep(m, x, y, k)) continue;
          const nx = x + DX[k], ny = y + DY[k], q = ny * m.w + nx;
          const nd = d + 1 + (extra ? extra(nx, ny) : 0);
          if (nd > maxDist || (dist[q] !== -1 && dist[q] <= nd)) continue;
          dist[q] = nd;
          while (buckets.length <= nd) buckets.push([]);
          buckets[nd].push(q);
        }
      }
    }
    return dist;
  }

  return { TILES, DX, DY, inside, code, ch, walkable, seeThrough, set, canStep, los, chebyshev, distances };
})();
