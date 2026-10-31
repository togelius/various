// ACCESSION — registry fragment: the perks Soft Soles, Vanishing Act and Light Fingers (BUILD.md
// §5.1, §8.7), owned by PG-PERKS-A. M4's skeleton made it; M4's Wave 0 (W0a) gave each perk its
// entry in Registry.PERKS (its name and family, §8.7's table: Perks.add takes only an id defined
// there), at ready false, and the lost event its cause for Vanishing Act (M4 plan A5).
// PG-PERKS-A fills the rest: each perk's clause, params, covers, tests and inv.
'use strict';
(() => {
  const R = Registry;
  const perk = (name, family) => ({ built: 'M4', ready: false, name, family });
  R.define('PERKS', 'soft_soles', perk('Soft Soles', 'guarded'));
  R.define('PERKS', 'vanishing_act', perk('Vanishing Act', 'guarded'));
  R.define('PERKS', 'light_fingers', perk('Light Fingers', 'guarded'));

  // Vanishing Act (§8.7): a hunter that loses sight of you searches at once, not after
  // LOSE_TRACK_TURNS (rules/perks.js, Perks.onLoseTrack); turns, as out_of_sight's, are the
  // turns it had been out of sight (rules/ai.js).
  R.defineCause('lost', 'vanished', { fields: { turns: 'int' }, built: 'M4' });
})();
