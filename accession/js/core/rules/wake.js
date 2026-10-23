// ACCESSION — waking (BUILD.md §8.2). M0 holds only the transitions; the ring, noise,
// pips and special triggers arrive in M3.
//
// An exhibit's `sawYou` (true, or absent) says it has seen you since it last woke; an awake
// exhibit without it is surprised by a blow (§8.1, Combat.surprised). M3's sight check sets
// it where an exhibit sees you, and every waking clears it. M2 has no exhibit sight and no
// 'awake' mode, so nothing sets it yet.
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
