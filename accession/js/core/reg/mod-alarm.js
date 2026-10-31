// ACCESSION — registry fragment: the module alarm_network and its archetype, patrol_guard (the
// Wader): the alarm, its call and the patrol (BUILD.md §5.1, §5.4, §8.2), owned by MOD-ALARM.
// M4's skeleton made it; M4's Wave 0 (W0a) moved here, verbatim from reg/system.js, the
// placeholders that are its (the archetype's M2 clause, at ready false; the module's panel
// sentence; the alarm and patrol wake causes with their woke and hunting causes), and gave the
// alarm event, the module event's cause and the module's keywords their schemas (M4 plan A5).
// MOD-ALARM fills the rest.
'use strict';
(() => {
  const R = Registry;

  // Placeholder: M2's clause (design/vocabulary.md §2.1), kept as a fixed sentence until its
  // owner builds the archetype; lint-registry's word rules apply once it is past ready false.
  R.define('ARCHETYPES', 'patrol_guard', { built: 'M4', ready: false, clause: 'Walks a fixed round. On seeing you it raises the alarm for one turn, then gives chase; after 20 turns without you it goes back to its round.', params: {}, covers: [], tests: [], inv: null });

  // The module (§5.4), its panel sentence and the words that name its rule (the Intro lint).
  R.define('MODULES', 'alarm_network', { built: 'M4', sentence: 'The waders raise the alarm when they see you; then the whole court is awake.', keywords: ['alarm', 'alarmed'] });

  // Wake causes (§8.2): the alarm wakes exhibits awake; a patrol is created awake on its round.
  R.define('WAKE_CAUSES', 'alarm', { built: 'M4', mode: 'awake', creation: false });
  R.define('WAKE_CAUSES', 'patrol', { built: 'M4', mode: 'awake', creation: true });
  const wake = { by: 'uid?', dist: 'int?', x: 'int?', y: 'int?', from: 'tile?', how: 'str?' };
  for (const k of ['alarm', 'patrol']) for (const kind of ['woke', 'hunting']) R.defineCause(kind, k, { fields: wake, built: 'M4' });

  // The alarm (§4.3, §5.4): who raised it, and the turn it ends (until); its cause is the module.
  R.defineEvent('alarm', { fields: { by: 'uid', until: 'int' }, built: 'M4' });
  R.defineCause('alarm', 'alarm_network', { fields: {}, built: 'M4' });

  // Its module event (reg/system.js): rules `alarm_shown` (a Wader shows its call for a turn;
  // who), `call` (it calls: the crash, and every sleeper that can hear but the Centrepiece
  // wakes; who, n woken) and `alarm_over` (turns after it began).
  R.defineCause('module', 'alarm_network', { fields: {}, built: 'M4' });
})();
