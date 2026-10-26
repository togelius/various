// ACCESSION — the closing clock (BUILD.md §8.4): the bell at B, the night watch at B + G,
// from the department's tour length. These are the clock's reads, owned by W1-CLOCK; its
// turn-boundary step, the night watch and the Watchman are in rules/clock.js (ClockRules).
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
  // and so do the night-watch bells already rung, with no events. A clock made already in
  // the night watch has no Night Watchman yet: the first boundary lets one in
  // (ClockRules.boundary).
  function init(ltour, over) {
    over = over || {};
    const b = budget(ltour);
    const B = over.B !== undefined ? over.B : b.B, G = over.G !== undefined ? over.G : b.G, count = over.count || 0;
    const night = count >= B + G, nightBells = night ? Int.idiv(count - B - G, N.NIGHT_WAKE_EVERY) : 0;
    return { B, G, stage: night ? 2 : count >= B ? 1 : 0, count, pausedSince: null, nightBells, watch: { k: 0, back: null } };
  }

  // The count at which the next night-watch bell rings: every NIGHT_WAKE_EVERY counts after
  // the night watch begins, the first NIGHT_WAKE_EVERY after it (the Watchman alone marks its
  // start, §8.4).
  const nextNightBell = c => c.B + c.G + N.NIGHT_WAKE_EVERY * (c.nightBells + 1);

  const clock = state => (state.dept && state.dept.clock) || null;
  // 0 open, 1 after the bell, 2 the night watch; 0 where there is no clock.
  const stage = state => { const c = clock(state); return c ? c.stage : 0; };
  // Is a Centrepiece hall sealed (§8.4)? Never in M3.
  const sealed = state => { const c = clock(state); return !!c && c.pausedSince !== null && c.pausedSince !== undefined; };
  // Do pips decay (§8.2)? Only before the bell. (M4 adds: and no alarm is running.)
  const pipsDecay = state => stage(state) === 0;
  // Regeneration units a turn (§8.1): REGEN_BELL_MULT (2) open, 1 after the bell, 0 in the
  // night watch or while a hall is sealed; regeneration needs REGEN_BELL_MULT times your
  // interval, so after the bell the interval is multiplied by REGEN_BELL_MULT. A bench
  // doubles the rate (BENCH_MULT), which regeneration applies.
  const regenRate = state => sealed(state) ? 0 : [N.REGEN_BELL_MULT, 1, 0][stage(state)];

  // The clock as the view model shows it (vm.clock), or null where there is no clock:
  //   count, B, G, stage  as in dept.clock;
  //   toBell       turns until the bell, while it is still to come, else null;
  //   toWatch      turns until the night watch, while it is still to come, else null;
  //   toNightBell  in the night watch, turns until the next night-watch bell, else null;
  //   watchBack    turns until the next Night Watchman comes after one was defeated, else null.
  // Turns here are clock counts, which a sealed hall stops (M4).
  function view(state) {
    const c = clock(state);
    if (!c) return null;
    const left = at => Math.max(0, at - c.count);
    return {
      count: c.count, B: c.B, G: c.G, stage: c.stage,
      toBell: c.stage < 1 ? left(c.B) : null,
      toWatch: c.stage < 2 ? left(c.B + c.G) : null,
      toNightBell: c.stage === 2 ? left(nextNightBell(c)) : null,
      watchBack: c.watch.back !== null ? left(c.watch.back) : null,
    };
  }

  return { budget, init, nextNightBell, stage, sealed, pipsDecay, regenRate, view };
})();
