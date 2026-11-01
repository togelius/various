// ACCESSION — sentences: the perks' statuses, staggered and second_wind (BUILD.md §3.4, §8.1,
// §8.7), owned by PG-PERKS-A, then PG-PERKS-B. M4's skeleton made it; text/system.js held no
// sentence of its to move here (M4's Wave 0). It gives a sentence for each event cause its
// registry fragment (reg/perk-status.js) adds: second_wind's heal.
//
// A perk's status is put on with the status event's perk cause ("The Plodder is now staggered
// for 1 turn: Single File.", "You are now getting your second wind for 5 turns: Second Wind.",
// text/perks.js) and ends with its own ("… is no longer staggered.", text/status.js), each in
// its registry words; staggered's lost action is a wait, which is told by nothing.
'use strict';
(() => {
  // A share of Second Wind's heal, at a turn boundary (Status.effects): never past your
  // maximum, and nothing said when nothing is regained (Health.heal).
  Text.defineCause('healed', 'second_wind', (e, w) => `${w.Name(e.who)} healed ${e.amount} with Second Wind: health ${e.hp}.`);
})();
