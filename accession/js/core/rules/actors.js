// ACCESSION — actors: lookup, occupancy, action costs and the scheduler.
'use strict';
const Actors = (() => {
  const at = (state, x, y) => { for (const a of state.actors) if (!a.gone && a.x === x && a.y === y) return a; return null; };
  const byUid = (state, uid) => { for (const a of state.actors) if (a.uid === uid) return a; return null; };
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
  return { at, byUid, cost, attackCost, scheduled, next };
})();
