// ACCESSION — registry fragment: the module unobserved_motion and its archetype, unobserved_mover
// (the Grazer) (BUILD.md §5.1, §5.4), owned by MOD-UNOBSERVED. M4's skeleton made it; M4's Wave 0
// (W0a) moved here, verbatim from reg/system.js, the placeholders that were its (the
// archetype's M2 clause and the module's panel sentence), and gave the module its event's
// cause and the words the Intro lint looks for. MOD-UNOBSERVED built the rest: the rules are in
// js/core/rules/arch/unobserved_mover.js and js/core/rules/modules/unobserved_motion.js; the
// scenarios that prove each clause in test/behaviour/{unobserved_mover,unobserved_motion}.test.js,
// and the invariants in test/behaviour/unobserved.inv.js.
'use strict';
(() => {
  const R = Registry;
  // ready true: the scenarios pass joined up, every package's invariants on, and the module's
  // fail with unobserved_motion switched off.
  const proved = tests => ({ built: 'M4', ready: true, tests, inv: 'unobserved' });
  const MOVER = ['behaviour/unobserved_mover.test.js', 'behaviour/unobserved_motion.test.js'], MODULE = ['behaviour/unobserved_motion.test.js', 'behaviour/unobserved_mover.test.js'];

  // The Grazer (§5.5). With the module off (or not flagged with it) it is a plodder: it walks a
  // tile a turn, after you, to look, to wander and home, and strikes from beside you for its
  // role's damage. What unobserved_motion adds is the module's own part, set in the slot: with
  // it off the line reads "Walks a tile at a time, and strikes from beside you for …" (§5.3, Q3;
  // "a tile", not "one tile": a number in words would have to be tied to a row).
  R.define('ARCHETYPES', 'unobserved_mover', Object.assign({ icon: null,
    clause: '{module:unobserved_motion|Walks a tile at a time}, and strikes from beside you for {dmg}.',
    params: { dmg: 'role:DMG' }, covers: ['attacked', 'missed'] }, proved(MOVER)));

  // The module (§5.4), with the sentence its department's panel teaches, and `keywords`: the
  // words that name its rule, which lint-registry's Intro rule fails in another department's
  // intro panel when this module is not that department's signature. Its part on a Grazer's
  // line, set in the archetype's slot, says the rule as it acts (rules/modules/
  // unobserved_motion.js): its pace, UNOBSERVED_STEP tiles a turn; the gate, no step begun
  // while you can see it (Vision.observed: in your line of sight within your sight range, or
  // within a lit Lamp's range, which the Lamp's own line says counts as seen); and the stop,
  // a step that brings it into your view ends its turn. Seeing is your sight, so a Fumigant
  // cloud between you hides it, as a wall does.
  R.define('MODULES', 'unobserved_motion', Object.assign({ icon: null,
    sentence: 'The animals move only when you cannot see them.', keywords: ['unobserved', 'while you cannot see'],
    clause: 'Moves {UNOBSERVED_STEP} tiles a turn, but only while you cannot see it (it takes no step in your sight, and stops for the turn once a step brings it into view)',
    params: { UNOBSERVED_STEP: 'N:UNOBSERVED_STEP' }, covers: ['module'] }, proved(MODULE)));

  // Its module event (reg/system.js): rule `stride`, one step a mover took while you could not
  // see it (who; n, the tiles of it: 1), made after the step; logged only while the mover is in
  // view at the end of your step (the module kind's log is 'seen').
  R.defineCause('module', 'unobserved_motion', { fields: {}, built: 'M4' });
})();
