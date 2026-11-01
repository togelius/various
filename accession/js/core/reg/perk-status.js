// ACCESSION — registry fragment: the perks' statuses, staggered and second_wind (BUILD.md §5.1,
// §8.1, §8.7), owned by PG-PERKS-A, then PG-PERKS-B. M4's skeleton made it; reg/system.js held no
// placeholder of its to move here (M4's Wave 0), so its owner fills it. It loads after
// js/core/rules/status.js (index.html), so that it can give each status its rule with
// Status.define beside its entry.
'use strict';
(() => {
  const R = Registry;

  // staggered (PG-PERKS-A; M4 plan D4.6, PR5: "loses its next action"): its bearer only waits
  // (skipsAction: AI.act asks Status.skips first, so it neither looks for you, nor lets a mark
  // it shows go off at its action, nor acts; a mark it shows waits with it, as §8.1 calls off
  // only a fixed exhibit's, and a line due at a boundary, the chime's, goes off there as ever).
  // It is put on for STAGGER_TURNS turns, and a status of N turns covers the N
  // turns from its bearer's next decision (§8.1's timing rule, Status.settle); no exhibit's
  // wait takes less than a turn (COST_WAIT, which no speed halves: Actors.cost), so a bearer
  // makes exactly one decision in one such turn, and loses exactly that action, its next.
  // Vanishing Act puts it on at the second rank (rules/perks/vanishing_act.js), with the
  // status event's perk cause (reg/perks.js). It is harmful, as fixed is. Its clause continues
  // the clause of what puts it on, as every status's does; its pictogram is keyed by its id
  // (js/view/pictograms.js).
  R.define('STATUSES', 'staggered', { built: 'M4', ready: true, tests: ['behaviour/perks-a.test.js'], inv: 'perks-a',
    icon: 'staggered', harmful: true, words: 'staggered', clause: 'loses its next action, and only waits instead', params: {}, covers: ['status'] });
  Status.define('staggered', { skipsAction: true });
})();
