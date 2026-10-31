// ACCESSION — registry fragment: the module hourly_demonstration and its archetype, demonstrator
// (the stations): the chime and its lines (BUILD.md §5.1, §5.4, §8.1), owned by MOD-CHIME. M4's
// skeleton made it; M4's Wave 0 (W0a) moved here, verbatim from reg/system.js, the placeholders
// that are its (the archetype's M2 clause and the period trigger's, at ready false; the
// module's panel sentence; the period wake cause with its woke and hunting causes), and gave
// the module its keywords and its event's cause. MOD-CHIME fills the rest.
'use strict';
(() => {
  const R = Registry;
  const m4 = clause => ({ built: 'M4', ready: false, clause, params: {}, covers: [], tests: [], inv: null });

  // Placeholders: M2's clauses (design/vocabulary.md §2.1), kept as fixed sentences until their
  // owner builds them; lint-registry's word rules apply once each is past ready false.
  R.define('ARCHETYPES', 'demonstrator', m4('Keeps to its track and never chases. On the chime it performs the demonstration on its label.'));
  R.define('TRIGGERS', 'period', Object.assign(m4('wakes on the chime to perform, then sleeps again'), { icon: 'period' }));

  // The module (§5.4), its panel sentence and the words that name its rule (the Intro lint).
  R.define('MODULES', 'hourly_demonstration', { built: 'M4', sentence: 'On the chime, the stations exchange signals down the length of the gallery.', keywords: ['chime', 'demonstration'] });

  // Wake cause (§8.2): the chime makes a station perform and sleep again.
  R.define('WAKE_CAUSES', 'period', { built: 'M4', mode: 'perform', creation: false });
  const wake = { by: 'uid?', dist: 'int?', x: 'int?', y: 'int?', from: 'tile?', how: 'str?' };
  for (const kind of ['woke', 'hunting']) R.defineCause(kind, 'period', { fields: wake, built: 'M4' });

  // Its module event (reg/system.js): rules `chime` (the chime sounds, its lines due in turns;
  // n stations), `line` (a station marks its line; who), `blocked` (a station's line is not
  // marked, since another mark lies on it; who) and `settle` (a station goes back to sleep
  // with the pips it had; who).
  R.defineCause('module', 'hourly_demonstration', { fields: {}, built: 'M4' });
})();
