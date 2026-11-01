// ACCESSION — registry fragment: the conservator_healer archetype and the clockwork modifier
// (BUILD.md §5.1, §5.5), owned by ARCH-CLOCKWORK. M4's skeleton made it; M4's Wave 0 (W0a)
// moved here, verbatim from reg/system.js, the placeholders that are its: their M2 clauses, at
// ready false. ARCH-CLOCKWORK fills the rest.
'use strict';
(() => {
  const R = Registry;
  const m4 = clause => ({ built: 'M4', ready: false, clause, params: {}, covers: [], tests: [], inv: null });

  // Placeholders: M2's clauses (design/vocabulary.md §2.1), kept as fixed sentences until their
  // owner builds them; lint-registry's word rules apply once each is past ready false, or is on
  // the line of a species whose archetype is (clockwork's is on M.11's station's since MOD-CHIME
  // built the demonstrator). Clockwork's lost M2's "; rain stops it for 2 turns" then: a bare
  // digit, and a rule that is M.11's weather flag's, not clockwork's (M4 plan D1.3).
  R.define('ARCHETYPES', 'conservator_healer', m4('Stays behind its allies and spends a turn, shown, restoring one; backs away when you come close.'));
  R.define('MODIFIERS', 'clockwork', m4('Shows its next move as an arrow and cannot be dazed.'));
})();
