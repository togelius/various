// ACCESSION — registry fragment: the perks Single File, Elbow Room and Second Wind (BUILD.md
// §5.1, §8.7), owned by PG-PERKS-B. M4's skeleton made it; M4's Wave 0 (W0a) gave each perk its
// entry in Registry.PERKS (its name and family, §8.7's table), at ready false, and the perk and
// healed events their causes for Single File and Second Wind (M4 plan A5). PG-PERKS-B fills the
// rest: each perk's clause, params, covers, tests and inv.
'use strict';
(() => {
  const R = Registry;
  const perk = (name, family) => ({ built: 'M4', ready: false, name, family });
  R.define('PERKS', 'single_file', perk('Single File', 'swarm'));
  R.define('PERKS', 'elbow_room', perk('Elbow Room', 'swarm'));
  R.define('PERKS', 'second_wind', perk('Second Wind', 'attrition'));

  // Single File (§8.7): an enemy (by) that stepped into a doorway beside you loses its next
  // action. Second Wind: falling below PERK_SECOND_WIND_BELOW_PCT of your health, you heal over
  // PERK_SECOND_WIND_TURNS turns, once a department.
  R.defineCause('perk', 'single_file', { fields: { by: 'uid?' }, built: 'M4' });
  R.defineCause('perk', 'wind', { fields: {}, built: 'M4' });
  R.defineCause('healed', 'second_wind', { fields: {}, built: 'M4' });
})();
