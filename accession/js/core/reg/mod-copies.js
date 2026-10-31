// ACCESSION — registry fragment: the module copies_weaken: the weakened spares (BUILD.md §5.1,
// §5.4), owned by MOD-COPIES. M4's skeleton made it; M4's Wave 0 (W0a) moved here, verbatim
// from reg/system.js, the module's panel sentence, and gave it its keywords and its event's
// cause. MOD-COPIES fills the rest.
'use strict';
(() => {
  const R = Registry;

  // The module (§5.4), its panel sentence and the words that name its rule (the Intro lint).
  R.define('MODULES', 'copies_weaken', { built: 'M4', sentence: 'When an original is broken, its spares lose heart.', keywords: ['spare', 'lose heart'] });

  // Its module event (reg/system.js): rule `weaken`, a spare whose original was destroyed
  // losing heart (who); its cause names the original (by), so that the log tells the spares
  // of one original in one line, and those of two originals in two.
  R.defineCause('module', 'copies_weaken', { fields: { by: 'uid?' }, built: 'M4' });
})();
