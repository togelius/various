// ACCESSION — the night_watchman archetype's hooks (BUILD.md §5.1, §5.3, §8.4; rules/archetypes.js),
// owned by W1-CLOCK. Its Behaviour-line clause and registry entry are in js/core/reg/clock.js;
// it comes in through ClockRules.spawnWatchman.
//
// What its clause promises, and where each part is kept:
//   it comes for you across the whole department, always knowing where you are: each action
//     it takes is a blow from beside you, or the first step of a shortest walk to your actual
//     tile over the whole map (AI.towards, no limit on distance), never towards a tile it
//     only last knew you at; it never searches or goes back (it acts here on every turn, so
//     the timers of AI.byMode never apply to it), and if anything else has made it stop
//     hunting, its next action takes the hunt up again;
//   it is never caught by surprise: it is made hunting and stays so (§8.1's surprise needs
//     an exhibit that sleeps or has not seen you);
//   staff doors stop it, as they stop every exhibit (§8.2): when no walk reaches you, it goes
//     to the tile it can reach that is nearest you, and waits there;
//   if defeated, another comes WATCHMAN_RETURN turns later (onDied → ClockRules.fell).
// A fixed Watchman waits, as any fixed exhibit does (AI.act, before this hook).
'use strict';
(() => {
  // The tile a's own walk can reach that is nearest you: nearest by your walking distance
  // (staff doors count as doors), then by a's own, then in row-major order. Where your walk
  // reaches none of them either, the nearest by Chebyshev distance.
  function nearestReachable(state, a) {
    const m = state.dept, you = state.actors[0], far = m.w * m.h;
    const mine = Grid.distances(m, [[a.x, a.y]], far, null, 'exhibit'), yours = Grid.distances(m, [[you.x, you.y]], far);
    let best = null, bk = -1, bm = -1;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const p = y * m.w + x, dm = mine[p];
      if (dm < 0) continue;
      const k = yours[p] >= 0 ? yours[p] : far + Grid.chebyshev(x, y, you.x, you.y);
      if (best === null || k < bk || (k === bk && dm < bm)) { best = [x, y]; bk = k; bm = dm; }
    }
    return best;
  }

  function act(state, a, ev) {
    const you = state.actors[0];
    if (a.mode !== 'hunting') Wake.setMode(state, a, 'hunting', { k: 'night_watch' }, ev);
    a.lastKnown = [you.x, you.y];
    const blow = AI.strike(state, a, you, ev);
    if (blow !== null) return blow;
    const step = AI.towards(state, a, you, 'beside', ev);
    if (step !== null) return step;
    const m = state.dept;
    if (AI.field(state, a, you, 'beside')[a.y * m.w + a.x] < 0) {
      const goal = nearestReachable(state, a);
      if (goal && (goal[0] !== a.x || goal[1] !== a.y)) {
        const t = AI.towards(state, a, goal, 'onto', ev);
        if (t !== null) return t;
      }
    }
    return AI.wait(state, a, ev);
  }

  Archetypes.add('night_watchman', {
    act,
    onDied: (state, a, cause, ev) => ClockRules.fell(state, a, ev),
  });
})();
