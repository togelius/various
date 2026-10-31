// ACCESSION — registry fragment: the perks Duck and Cover and Close the Distance (BUILD.md §5.1,
// §8.1, §8.7), owned by PG-PERKS-TIMING. M4's skeleton made it; M4's Wave 0 (W0a) gave each perk
// its entry in Registry.PERKS (its name and family, §8.7's table), at ready false, and the perk
// event its causes for their activations (M4 plan A5). PG-PERKS-TIMING fills the rest: each
// perk's clause, params, covers, tests and inv.
'use strict';
(() => {
  const R = Registry;
  const perk = (name, family) => ({ built: 'M4', ready: false, name, family });
  R.define('PERKS', 'duck_and_cover', perk('Duck and Cover', 'artillery'));
  R.define('PERKS', 'close_the_distance', perk('Close the Distance', 'artillery'));

  // Duck and Cover (§8.7): a special (by) resolved and missed you, so your next action costs
  // less (`duck`), and at rank 2 your next attack is a surprise attack (`sure`). Close the
  // Distance: your step toward an exhibit targeting you (by) cost no time (`close`).
  R.defineCause('perk', 'duck', { fields: { by: 'uid?' }, built: 'M4' });
  R.defineCause('perk', 'sure', { fields: { by: 'uid?' }, built: 'M4' });
  R.defineCause('perk', 'close', { fields: { by: 'uid?' }, built: 'M4' });
})();
