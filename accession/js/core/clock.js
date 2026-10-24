// ACCESSION — the closing clock (BUILD.md §8.4): the bell at B, the night watch at B + G,
// from the department's tour length. These are the clock's reads; its turn-boundary step,
// the night watch and the Watchman are in rules/clock.js (ClockRules).
//
// dept.clock = { B, G, stage, count, pausedSince, nightBells, watch: { k, back } }, or null
// where there is no clock (the test room):
//   stage        0 open, 1 after the bell, 2 the night watch;
//   count        clock turns since entry, which a sealed hall stops (§8.4);
//   pausedSince  the turn a Centrepiece hall sealed, or null (M3 never seals: M4 sets it);
//   nightBells   the night-watch bells rung so far;
//   watch        k, the Night Watchmen that have entered so far; back, the count at which the
//                next one enters after one is defeated, or null.
'use strict';
const Clock = (() => {
  function budget(ltour) {
    const B = Int.round10(N.CLOCK_MULT_PCT * ltour + N.CLOCK_ADD * 100, 100);
    const G = Math.max(N.STAGE_GAP_MIN, Int.round10(N.STAGE_GAP_PCT * B, 100));
    return { B, G };
  }

  // A department's clock at entry, from its tour length. over ({B?, G?, count?}) sets the
  // budget or the count directly, for arenas and tests; the stage follows from the count,
  // with no events.
  function init(ltour, over) {
    over = over || {};
    const b = budget(ltour);
    const B = over.B !== undefined ? over.B : b.B, G = over.G !== undefined ? over.G : b.G, count = over.count || 0;
    return { B, G, stage: count >= B + G ? 2 : count >= B ? 1 : 0, count, pausedSince: null, nightBells: 0, watch: { k: 0, back: null } };
  }

  const clock = state => (state.dept && state.dept.clock) || null;
  // 0 open, 1 after the bell, 2 the night watch; 0 where there is no clock.
  const stage = state => { const c = clock(state); return c ? c.stage : 0; };
  // Is a Centrepiece hall sealed (§8.4)? Never in M3.
  const sealed = state => { const c = clock(state); return !!c && c.pausedSince !== null && c.pausedSince !== undefined; };
  // Do pips decay (§8.2)? Only before the bell. (M4 adds: and no alarm is running.)
  const pipsDecay = state => stage(state) === 0;
  // Regeneration units a turn (§8.1): 2 open, 1 after the bell, 0 in the night watch or
  // while a hall is sealed. A bench doubles it (BENCH_MULT), which regeneration applies.
  const regenRate = state => sealed(state) ? 0 : [2, 1, 0][stage(state)];

  // [stub → W1-CLOCK] The clock as the view model shows it: {count, B, G, stage, toBell,
  // toWatch, toNightBell, watchBack}; null for now.
  const view = state => null;

  return { budget, init, stage, sealed, pipsDecay, regenRate, view };
})();
