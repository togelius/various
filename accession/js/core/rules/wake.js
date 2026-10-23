// ACCESSION — waking (BUILD.md §8.2). M0 holds only the transitions; the ring, noise,
// pips and special triggers arrive in M3.
'use strict';
const Wake = (() => {
  // Straight to hunting (damage, the ring, being seen). An exhibit that was asleep is
  // scheduled one action from now: waking costs a beat. Each actor keeps its own story.
  function toHunting(state, a, cause, ev) {
    const was = a.mode;
    a.mode = 'hunting';
    a.pips = 0;
    if (was === 'dormant') { a.next = state.tick + Actors.cost(a, N.COST_STEP); a.woke = { turn: state.turn, cause: copy(cause) }; }
    a.hunted = { turn: state.turn, cause: copy(cause) };
    ev.push({ k: 'hunting', turn: state.turn, who: a.uid, was, cause: copy(cause) });
    Causes.record(state, { turn: state.turn, k: 'hunting', who: a.uid, was, cause });
  }
  const copy = c => JSON.parse(JSON.stringify(c));
  return { toHunting };
})();
