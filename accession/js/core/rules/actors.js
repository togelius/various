// ACCESSION — actors: lookup, occupancy, action costs and the scheduler.
'use strict';
const Actors = (() => {
  // An actor covers size × size tiles from its top-left anchor (BUILD.md §4.1): a
  // Centrepiece is 2×2. Occupancy, distance, reach and sight all use the footprint.
  const covers = (a, x, y) => { const s = a.size || 1; return x >= a.x && y >= a.y && x < a.x + s && y < a.y + s; };
  // The actor whose footprint covers (x, y), skipping `except` if given.
  const at = (state, x, y, except) => { for (const a of state.actors) if (a !== except && !a.gone && covers(a, x, y)) return a; return null; };
  const byUid = (state, uid) => { for (const a of state.actors) if (a.uid === uid) return a; return null; };
  // Chebyshev distance from (x, y) to the nearest tile of a's footprint (§4.1).
  function dist(a, x, y) {
    const s = a.size || 1, nx = Math.min(Math.max(x, a.x), a.x + s - 1), ny = Math.min(Math.max(y, a.y), a.y + s - 1);
    return Math.max(Math.abs(nx - x), Math.abs(ny - y));
  }
  // Is any tile of a's footprint in line of sight from (x, y)? It is observed if any is (§4.1).
  function inSight(state, a, x, y) {
    const s = a.size || 1;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (Grid.los(state.dept, x, y, a.x + dx, a.y + dy)) return true;
    return false;
  }
  // A Centrepiece is known by its role (Roles.stats('centrepiece', …)), whatever its size.
  const centrepiece = a => a.role === 'centrepiece';
  // Speed scales every action's cost (BUILD.md §8.1).
  const cost = (a, base) => a.speed === 'fast' ? Int.pct(base, N.SPEED_FAST_PCT) : a.speed === 'slow' ? Int.pct(base, N.SPEED_SLOW_PCT) : base;
  // A blow with a Heavy weapon, or from a brute, costs more (§8.1, §8.10).
  const attackCost = a => cost(a, a.weaponForm === 'heavy' || a.role === 'brute' ? N.COST_ATTACK_HEAVY : N.COST_ATTACK);
  // Sleeping exhibits are not scheduled (§8.1).
  const scheduled = a => !a.gone && a.mode !== 'dormant';
  // The scheduler: the smallest next tick; ties to you, then to spawn order (array order).
  function next(state) {
    let best = null;
    for (const a of state.actors) if (scheduled(a) && (best === null || a.next < best.next)) best = a;
    return best;
  }
  return { covers, at, byUid, dist, inSight, centrepiece, cost, attackCost, scheduled, next };
})();
