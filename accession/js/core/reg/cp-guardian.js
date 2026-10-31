// ACCESSION — registry fragment: S.9's Centrepiece, completing_guardian (the Composite), with its
// limbs and its treasure (BUILD.md §5.1, §5.5), owned by COMPOSITE-CORE. M4's skeleton made it;
// M4's Wave 0 (W0a) moved here, verbatim from reg/system.js, the archetype's placeholder (its M2
// clause, at ready false), and gave the phase event its causes for the limbs (M4 plan A5).
// COMPOSITE-CORE fills the rest.
'use strict';
(() => {
  const R = Registry;

  // Placeholder: M2's clause (design/vocabulary.md §2.1), kept as a fixed sentence until its
  // owner builds the archetype; lint-registry's word rules apply once it is past ready false.
  R.define('ARCHETYPES', 'completing_guardian', { built: 'M4', ready: false, clause: 'Grows one limb for every two galleries you have walked, up to four; each limb is a special. Leaving its room heals it and drops one limb.', params: {}, covers: [], tests: [], inv: null });

  // Its phase event's causes (reg/centrepiece.js): `walked`, a limb grown for the galleries you
  // have walked (n of them); `left`, you left its hall while it hunted you, so it healed and
  // dropped a limb.
  R.defineCause('phase', 'walked', { fields: { n: 'int?' }, built: 'M4' });
  R.defineCause('phase', 'left', { fields: {}, built: 'M4' });
})();
