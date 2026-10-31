// ACCESSION — the treasure case's validator (BUILD.md §5.5): S.9's Lamp lies in a case at least
// LAMP_CASE_MIN_WALK walking tiles from every opening of the Centrepiece hall, or the layout
// reseeds. This is the only place that rule is written. It registers as a validator with
// Populate.addValidator('treasure', …) from here. M4's skeleton made it with its signature
// and a neutral body; D-ITEMS fills it.
'use strict';
const LTreasure = (() => {
  // D-ITEMS fills: null, or {reason, tiles} naming the case and the opening too near it.
  function check(state, plan) { return null; }
  return { check };
})();
