// ACCESSION — LV6, the entrance's safe zone (design/layout.md §7.1, §9.1; BUILD.md §5.5): no hostile
// within SAFE_ZONE walking tiles of the entrance, and no exhibit's wake region
// (Archetypes.wakeRegion, a patrol's over its first SAFE_ZONE_TURNS turns) reaching that zone.
// It registers as a validator with Populate.addValidator('lv6', …) from here. M4's skeleton
// made it with its signature and a neutral body; D-LV6 fills it.
'use strict';
const LV6 = (() => {
  // D-LV6 fills: null, or {reason, tiles} naming the hostile or wake region in the safe zone.
  function check(state, plan) { return null; }
  return { check };
})();
