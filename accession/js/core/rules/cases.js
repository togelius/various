// ACCESSION — cases, glass, locks and staff doors (BUILD.md §8.3). W0c names the two calls
// the action core makes; W0e builds the case fixtures and W1-CASES the rest.
'use strict';
const Cases = (() => {
  // Does a stand in an intact case? An exhibit on a `v` is encased (and so is a mimic in its
  // disguise): it cannot step out (Grid.canStep) or strike out, and nothing strikes in.
  const encased = (state, a) => Actors.footprint(a).some(([x, y]) => Grid.ch(state.dept, x, y) === 'v');

  // Cases.enter(state, a, x, y, d, ev): your step from your tile in direction d onto (x, y),
  // which holds no actor, when that tile is a fixture: null if it is not one (the step goes
  // on), a refusal code, or ticks (W1-CASES: a staff door opened at your grade). With ev
  // null it changes nothing and says what it would return, for Step.legal. W0c: a bump into
  // an intact case is refused with behind_glass, as a blow at anything standing in one is
  // (Combat.canStrike).
  function enter(state, a, x, y, d, ev) {
    return Grid.ch(state.dept, x, y) === 'v' ? 'behind_glass' : null;
  }

  return { encased, enter };
})();
