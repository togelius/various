// ACCESSION — M4's other layout validators (design/layout.md §9.1): LV7, no unrewarded long
// dead end (a dead end reaching DEAD_END_REWARD walking tiles beyond its junction holds a
// reward), and LV13 for the chime, a station's line cutting the entrance from every exit
// leaving a window of at least DEMO_WINDOW turns. Each registers as a validator with
// Populate.addValidator from here. M4's skeleton made them with their signatures and neutral
// bodies; D-VALIDATORS fills them.
'use strict';
const LVM4 = (() => {
  // D-VALIDATORS fills: LV7: null, or {reason, tiles} naming the dead end.
  function lv7(state, plan) { return null; }
  // D-VALIDATORS fills: LV13 for the chime: null, or {reason, tiles} naming the crossing.
  function lv13(state, plan) { return null; }
  return { lv7, lv13 };
})();
