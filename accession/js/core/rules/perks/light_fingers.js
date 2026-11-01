// ACCESSION — Light Fingers, a Guarded perk (BUILD.md §8.7): "Opening a case costs 100 ticks and
// makes no noise; at rank 2 it also opens locks one grade above yours." Its rules register here
// with Perks.add (rules/perks.js); its entry and clause are in js/core/reg/perks-a.js and its
// sentences in js/core/text/perks-a.js. Owned by PG-PERKS-A.
//
// The rule (PR7), for your opening of a case only (Cases.open; an exhibit's is as it always was):
//   - at either rank it costs PERK_LIGHT_FINGERS_COST ticks (Perks.openCost; slowed still
//     doubles it, as it does every action of yours) and makes no noise (Perks.openQuiet);
//   - nothing else of the open changes: the touch is made first (touch_case wakes what it
//     wakes, a mimic grips you and shows itself), then the case opens and is told;
//   - at rank 2 you also open case locks up to PERK_LIGHT_FINGERS_ABOVE grades above yours
//     (Perks.lockBonus, Cases.lockGrade); a staff door takes your grade alone (Cases.enter),
//     so it never opens one.
// The case's label and its rules read it (Cases.rules: the case's first sentence becomes
// CLAUSES.case_light_fingers, or case_light_fingers2 at rank 2, filled with what opening it
// costs you; Labels.ofCase: a lock your perks open says so).
'use strict';
(() => {
  Perks.add('light_fingers', {
    openCost: (state, base, rank) => N.PERK_LIGHT_FINGERS_COST,
    openQuiet: (state, rank) => true,
    lockBonus: (state, rank) => rank >= 2 ? N.PERK_LIGHT_FINGERS_ABOVE : 0,
  });
})();
