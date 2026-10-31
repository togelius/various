// ACCESSION — registry fragment: the module unobserved_motion and its archetype, unobserved_mover
// (the Grazer) (BUILD.md §5.1, §5.4), owned by MOD-UNOBSERVED. M4's skeleton made it; M4's Wave 0
// (W0a) moved here, verbatim from reg/system.js, the placeholders that are its (the archetype's
// M2 clause, at ready false, and the module's panel sentence), and gave the module its event's
// cause and the words the Intro lint looks for. MOD-UNOBSERVED fills the rest.
'use strict';
(() => {
  const R = Registry;

  // Placeholder: M2's clause (design/vocabulary.md §2.1), kept as a fixed sentence until its
  // owner builds the archetype; lint-registry's word rules (no digit outside {}, every
  // phrase of PHRASES tied to its row) apply once it is past ready false.
  R.define('ARCHETYPES', 'unobserved_mover', { built: 'M4', ready: false, clause: 'Moves two tiles a turn, but only while you cannot see it; strikes hard from beside you.', params: {}, covers: [], tests: [], inv: null });

  // The module (§5.4), with the sentence its department's panel teaches, and `keywords`: the
  // words that name its rule, which lint-registry's Intro rule fails in another department's
  // intro panel when this module is not that department's signature.
  R.define('MODULES', 'unobserved_motion', { built: 'M4', sentence: 'The animals move only when you cannot see them.', keywords: ['unobserved', 'while you cannot see'] });

  // Its module event (reg/system.js): rule `stride`, an unobserved mover's steps (who; n tiles).
  R.defineCause('module', 'unobserved_motion', { fields: {}, built: 'M4' });
})();
