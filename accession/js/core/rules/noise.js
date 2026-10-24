// ACCESSION — noise (BUILD.md §8.2): how far a noise carries and who hears it. Owned by
// W1-WAKE-A after M3's Wave 0; these signatures stay.
'use strict';
const Noise = (() => {
  const RANGE = { soft: 'NOISE_SOFT', loud: 'NOISE_LOUD', crash: 'NOISE_CRASH' };

  // The walking distance a noise from (x, y) covers within `range` (§8.2): the step rule,
  // staff doors included, with NOISE_DOOR extra for entering a closed door. An Int32Array,
  // -1 beyond its reach. The view model's noise rings read it too.
  const reach = (m, x, y, range) => Grid.distances(m, [[x, y]], range, (nx, ny) => Grid.closedDoor(m, nx, ny) ? N.NOISE_DOOR : 0);

  // A noise of class cls (soft, loud or crash) at (x, y), with its cause. It is an event
  // (noise {x, y, cls, range}); then every exhibit that is not gone and not pipless and
  // stands within its reach hears it, in spawn order: Wake.hear(state, a, noise, dist, ev),
  // with noise = {x, y, cls, range, by, k} (by and k from the cause) and dist the walking
  // distance to the exhibit's nearest tile (one beyond a neighbour, on a tile it cannot be
  // walked onto, such as a case).
  function emit(state, x, y, cls, cause, ev) {
    if (!RANGE[cls]) throw new Error('Noise.emit: no noise class ' + cls);
    const m = state.dept, range = N[RANGE[cls]];
    Causes.emit(state, ev, 'noise', { x, y, cls, range }, cause);
    const d = reach(m, x, y, range), noise = { x, y, cls, range, by: (cause && cause.by) || null, k: cause ? cause.k : null };
    for (let i = 1; i < state.actors.length; i++) {
      const a = state.actors[i];
      if (a.gone || Archetypes.pipless(state, a)) continue;
      let dist = -1;
      for (const [tx, ty] of Actors.footprint(a)) { const t = Grid.reachDist(d, m, tx, ty); if (t >= 0 && (dist < 0 || t < dist)) dist = t; }
      if (dist >= 0 && dist <= range) Wake.hear(state, a, noise, dist, ev);
    }
  }

  return { reach, emit };
})();
