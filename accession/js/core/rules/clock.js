// ACCESSION — the clock's rules (BUILD.md §8.4): turn boundary step 6, the night watch, the
// Night Watchman, and leaving by an exit door. W0e names each call with a neutral body;
// W1-CLOCK builds them. The clock's reads are in clock.js (Clock).
'use strict';
const ClockRules = (() => {
  // [stub → W1-CLOCK] Turn boundary step 6 (§8.1): the count, the bell, the night watch,
  // the Watchman's entry and return, the night-watch bells. Does nothing for now.
  function boundary(state, ev) {}
  // [stub → W1-CLOCK] The n sleeping exhibits nearest you by walking distance that a
  // night-watch bell may wake, as [{a, dist}], nearest first, ties in spawn order. [] for now.
  const nearestSleepers = (state, n) => [];
  // [stub → W1-CLOCK] A Night Watchman enters at the department entrance and returns the
  // actor (uid <acc>.<depth>.watch.<k>, created hunting, after a beat). null for now.
  const spawnWatchman = (state, ev) => null;
  // [stub → W1-CLOCK] A Night Watchman was destroyed: the next comes WATCHMAN_RETURN counts
  // later. Does nothing for now.
  function fell(state, a, ev) {}

  // leave(i) (§4.2, §8.9): through exit door i, legal only on it. [stub → W1-CLOCK]: nothing
  // is legal yet, and every candidate is refused as not built.
  Actions.define('leave', {
    legal: state => [],
    candidates: state => ((state.dept && state.dept.exits) || []).map((e, i) => ({ a: 'leave', i })).concat([{ a: 'leave', i: -1 }, { a: 'leave' }]),
    apply: (state, action, ev) => 'not_built',
  });

  return { boundary, nearestSleepers, spawnWatchman, fell };
})();
