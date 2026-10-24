// ACCESSION — the tile grid: what each tile character means, line of sight, walking
// distance and steps. A department's map is an array of row strings (BUILD.md §4.1). Every
// rule's geometry is defined here once (§8.2), frozen after M3's Wave 0.
'use strict';
const Grid = (() => {
  // Tile characters. Movement and sight follow the movement × sight matrix
  // (design/vocabulary.md §7.1); the registry describes each one to the player. `hold`
  // marks a tile an exhibit can stand on: every walkable tile, a vitrine and a plinth.
  const TILES = {
    '#': { name: 'wall' },
    '.': { name: 'floor', walk: 1, see: 1 },
    ',': { name: 'archway', walk: 1, see: 1 },
    '+': { name: 'closed door', walk: 1, door: 1 },
    "'": { name: 'open door', walk: 1, see: 1, door: 1 },
    'S': { name: 'staff door', walk: 1, door: 1, staff: 1 },
    's': { name: 'open staff door', walk: 1, see: 1, door: 1, staff: 1 },
    'E': { name: 'entrance', walk: 1, see: 1 },
    'X': { name: 'exit door', walk: 1, see: 1 },
    'v': { name: 'vitrine', see: 1, glass: 1, hold: 1 },
    'u': { name: 'opened case', walk: 1, see: 1 },
    'k': { name: 'broken case', walk: 1, see: 1, loud: 1 },
    'x': { name: 'shards', walk: 1, see: 1, loud: 1 },
    'w': { name: 'pool', walk: 1, see: 1, loud: 1, slow: 1 },
    'p': { name: 'plinth', see: 1, hold: 1 },
    'f': { name: 'low furniture', see: 1 },
    'l': { name: 'lectern', see: 1 },
    'b': { name: 'bench', walk: 1, see: 1, bench: 1 },
    'o': { name: 'column' },
    'H': { name: 'shelving' },
    '|': { name: 'partition' },
    '~': { name: 'balustrade', see: 1 },
    '=': { name: 'rope line', walk: 1, see: 1 },
  };
  const WALK = new Uint8Array(128), SEE = new Uint8Array(128), STAFF = new Uint8Array(128), HOLD = new Uint8Array(128), BOLT = new Uint8Array(128);
  for (const ch of Object.keys(TILES)) {
    const c = ch.charCodeAt(0), t = TILES[ch];
    WALK[c] = t.walk ? 1 : 0;
    SEE[c] = t.see ? 1 : 0;
    STAFF[c] = t.staff ? 1 : 0;
    HOLD[c] = t.walk || t.hold ? 1 : 0;
    BOLT[c] = t.see && !t.glass ? 1 : 0;
  }
  const V = 'v'.charCodeAt(0), PLUS = '+'.charCodeAt(0), S = 'S'.charCodeAt(0);

  // Directions in a fixed order: N, NE, E, SE, S, SW, W, NW.
  const DX = [0, 1, 1, 1, 0, -1, -1, -1], DY = [-1, -1, 0, 1, 1, 1, 0, -1];

  const inside = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;
  const code = (m, x, y) => inside(m, x, y) ? m.tiles[y].charCodeAt(x) : 35; // '#'
  const ch = (m, x, y) => String.fromCharCode(code(m, x, y));
  // Can `who` stand on (x, y) by walking? For an exhibit ('exhibit') a staff door, closed or
  // open, is a wall (§8.2); for you (the default) it is a door.
  const walkable = (m, x, y, who) => { const c = code(m, x, y); return WALK[c] === 1 && !(who === 'exhibit' && STAFF[c] === 1); };
  const seeThrough = (m, x, y) => SEE[code(m, x, y)] === 1;
  // A tile an exhibit can stand on: walkable, or a vitrine or a plinth (BUILD.md §8.2).
  const hold = (m, x, y) => HOLD[code(m, x, y)] === 1;
  // A bolt (a kiter's shot, the Pin-Driver's) passes a tile it can see through that is not
  // glass; only beams pass glass (§8.3).
  const bolt = (m, x, y) => BOLT[code(m, x, y)] === 1;
  // A closed door, ordinary or staff: noise reaching through one counts NOISE_DOOR extra (§8.2).
  const closedDoor = (m, x, y) => { const c = code(m, x, y); return c === PLUS || c === S; };
  function set(m, x, y, c) { const row = m.tiles[y]; m.tiles[y] = row.slice(0, x) + c + row.slice(x + 1); }

  // A step from (x, y) in direction d: the target must be walkable, and a diagonal step may
  // not cut past a tile you could not step onto. For an exhibit, staff doors are walls and
  // a step out of an intact case (a `v`, where an encased exhibit stands) is refused (§8.3).
  function canStep(m, x, y, d, who) {
    const nx = x + DX[d], ny = y + DY[d];
    if (!walkable(m, nx, ny, who)) return false;
    if (who === 'exhibit' && code(m, x, y) === V) return false;
    if (DX[d] !== 0 && DY[d] !== 0) return walkable(m, nx, y, who) && walkable(m, x, ny, who);
    return true;
  }

  // Within r (§8.2: sight, axis, tether, ally_hit, a herald's call): dx² + dy² ≤ r² + r,
  // the layout prototype's disc.
  const disc = (dx, dy, r) => dx * dx + dy * dy <= r * r + r;

  // A surface ({kind, x, y, size, until, by} in dept.surfaces) covers the size × size square
  // centred on its tile. Surfaces.tick removes expired ones at the turn boundary, so every
  // surface in the list is active.
  const covers = (s, x, y) => { const h = Int.idiv(s.size, 2); return Math.abs(x - s.x) <= h && Math.abs(y - s.y) <= h; };
  function veiled(m, x, y) {
    for (const s of m.surfaces) { const r = Registry.SURFACES[s.kind]; if (r && r.blocksSight && covers(s, x, y)) return true; }
    return false;
  }

  // Line of sight between two tiles: a Bresenham line, always traced from the endpoint
  // that comes first in row-major order, so sight is symmetric. Endpoints never block; a
  // tile between them blocks if it cannot be seen through or a sight-blocking surface (a
  // Fumigant cloud, plaster dust) covers it.
  function los(m, x0, y0, x1, y1) {
    if (y1 < y0 || (y1 === y0 && x1 < x0)) { let t = x0; x0 = x1; x1 = t; t = y0; y0 = y1; y1 = t; }
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1;
    const fog = !!(m.surfaces && m.surfaces.length);
    let err = dx - dy, x = x0, y = y0;
    for (;;) {
      if (x === x1 && y === y1) return true;
      if (!(x === x0 && y === y0) && (!seeThrough(m, x, y) || (fog && veiled(m, x, y)))) return false;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  const chebyshev = (x0, y0, x1, y1) => Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));

  // Walking distance from one or more start tiles, by the step rule for `who`, out to
  // maxDist (no other cap). extra(x, y) may add a cost for entering a tile (closed doors
  // for noise). Returns an Int32Array of distances, -1 where unreached. Not part of the state.
  function distances(m, starts, maxDist, extra, who) {
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
          if (!canStep(m, x, y, k, who)) continue;
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

  // The walking distance to (x, y) from a distances() result (§8.2): its own entry; or, for
  // a tile `who` cannot step onto (a case, a plinth, a lectern), 1 + the distance of its
  // nearest neighbour that it can. -1 if neither is reached.
  function reachDist(dist, m, x, y, who) {
    const own = dist[y * m.w + x];
    if (own >= 0 || walkable(m, x, y, who)) return own;
    let best = -1;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k];
      if (!inside(m, nx, ny) || !walkable(m, nx, ny, who)) continue;
      const nd = dist[ny * m.w + nx];
      if (nd >= 0 && (best < 0 || nd + 1 < best)) best = nd + 1;
    }
    return best;
  }

  return { TILES, DX, DY, inside, code, ch, walkable, seeThrough, hold, bolt, closedDoor, set, canStep, disc, covers, los, chebyshev, distances, reachDist };
})();
