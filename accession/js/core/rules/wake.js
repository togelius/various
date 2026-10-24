// ACCESSION — waking (BUILD.md §8.2). M3's Wave 0 builds it in two parts: W0c keeps M2's one
// transition (toHunting) and names the hooks the action core calls, as no-ops; W0d builds
// waking, modes and the ring; W1-WAKE-A owns it after.
//
// An exhibit's `sawYou` says it has seen you since it last woke; an awake exhibit without it
// is surprised by a blow (§8.1, Combat.surprised).
'use strict';
const Wake = (() => {
  const copy = c => JSON.parse(JSON.stringify(c));

  // Straight to hunting (damage, the ring, being seen). An exhibit that was asleep is
  // scheduled one action from now: waking costs a beat (§8.1). Each actor keeps its own story.
  function toHunting(state, a, cause, ev) {
    const was = a.mode;
    a.mode = 'hunting';
    a.pips = 0;
    if (was === 'dormant') {
      a.next = state.tick + Actors.cost(state, a, N.COST_STEP, 'act');
      a.woke = { turn: state.turn, cause: copy(cause) };
      a.sawYou = false; a.acts = 0; a.stim = state.turn;
    }
    a.hunted = { turn: state.turn, cause: copy(cause) };
    Causes.emit(state, ev, 'hunting', { who: a.uid, was }, cause);
  }

  // Hooks the action core calls; W0d and W1-WAKE-A fill them.
  function hear(state, a, noise, dist, ev) {}          // Noise.emit: a heard a noise dist away
  function allyHit(state, victim, cause, ev) {}        // Combat.hurt: victim took damage
  function boundary(state, ev) {}                      // turn boundary step 4: the ring, axis, tether
  function decay(state, ev) {}                         // turn boundary step 5: pip decay

  return { toHunting, hear, allyHit, boundary, decay };
})();
