// ACCESSION — registry fragment: A.4's Centrepiece, mp_ensemble (the Ordinance) (BUILD.md §5.1,
// §5.5), owned by ENSEMBLE-CORE. M4's skeleton made it; M4's Wave 0 (W0a) moved here, verbatim
// from reg/system.js, the archetype's placeholder (its M2 clause, at ready false), and gave the
// phase event its cause for a special taken on (M4 plan A5). ENSEMBLE-CORE fills the rest.
'use strict';
(() => {
  const R = Registry;

  // Placeholder: M2's clause (design/vocabulary.md §2.1), kept as a fixed sentence until its
  // owner builds the archetype; lint-registry's word rules apply once it is past ready false.
  R.define('ARCHETYPES', 'mp_ensemble', { built: 'M4', ready: false, clause: 'Several pieces share one health pool. When a piece falls, the others take on its special.', params: {}, covers: [], tests: [], inv: null });

  // Its phase event's cause (reg/centrepiece.js): `inherited`, a piece took on the special of
  // one that fell (from).
  R.defineCause('phase', 'inherited', { fields: { from: 'uid?' }, built: 'M4' });
})();
