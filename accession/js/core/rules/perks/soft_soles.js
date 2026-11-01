// ACCESSION — Soft Soles, a Guarded perk (BUILD.md §8.7): "Your ring is 1 smaller; 2 smaller at
// rank 2." Its rules register here with Perks.add (rules/perks.js); its entry and clause are in
// js/core/reg/perks-a.js and its sentences in js/core/text/perks-a.js. Owned by PG-PERKS-A.
//
// The rule: your ring (§8.2) is PERK_SOFT_SOLES[rank − 1] smaller at either rank, whatever your
// last action was, wherever you stand and whatever you wear, and never below RING_MIN. It is a
// change to the one radius every ring reads (Vision.actionRing, through Perks.ringDelta): the
// ring drawn, the ring pip at each turn boundary, the largest ring owed after a free or cheaper
// action (you.ringMax, plan A6), and the ring the lectern tells you you would have viewing
// (Viewing.ring). Vision keeps it at RING_MIN or more.
'use strict';
(() => {
  Perks.add('soft_soles', {
    ringDelta: (state, rank) => -N.PERK_SOFT_SOLES[rank - 1],
  });
})();
