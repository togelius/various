// ACCESSION — registry fragment: the system (BUILD.md §5.1), frozen after M3's Wave 0. The
// backbone refusal codes and the `refused` event; and every entry M4 builds (seven
// archetypes, the clockwork modifier, the period trigger, the five modules, three wake
// causes and six event kinds), each marked built: 'M4', which M3 departments leave out.
'use strict';
(() => {
  const R = Registry;

  // Refusal codes (§4.2). step() refuses an illegal action with a code, and text/system.js
  // gives each its sentence. A rule that refuses with a code of its own defines it in its
  // own fragment. not_built is the code of an action whose rules a later part builds (no
  // M3 handler returns it; m3-backbone plants one that does); no_use is use(uid) of
  // something that is not an instrument, a kit or a consumable. m3-backbone makes each one
  // refuse, with nothing changed and nothing drawn; their invariant is
  // test/behaviour/system.inv.js (a refused step has no other event and changes nothing).
  // The real game makes each refuse in test/behaviour/refusals.test.js (ready true), all but
  // not_built, which no M3 action can give (ready 'unit', with its follow-up).
  for (const code of ['visit_over', 'choice_pending', 'unknown_action', 'bad_direction', 'corner', 'blocked', 'no_target', 'out_of_reach',
    'not_built', 'no_use']) R.define('REFUSALS', code, code === 'not_built' ? { ready: 'unit', tests: ['m3-backbone.test.js'], inv: 'system' }
    : { ready: true, tests: ['m3-backbone.test.js', 'behaviour/refusals.test.js'], inv: 'system' });
  R.defineEvent('refused', { fields: { reason: 'str', data: 'obj?' }, exempt: true });

  // The M4 archetypes and modifier keep the clauses M2 gave them, as fixed sentences, until
  // M4 builds them (design/vocabulary.md §2.1, trimmed per BUILD.md §5.5).
  const m4 = clause => ({ built: 'M4', ready: false, clause, params: {}, covers: [], tests: [], inv: null });
  R.define('ARCHETYPES', 'unobserved_mover', m4('Moves two tiles a turn, but only while you cannot see it; strikes hard from beside you.'));
  R.define('ARCHETYPES', 'patrol_guard', m4('Walks a fixed round. On seeing you it raises the alarm for one turn, then gives chase; after 20 turns without you it goes back to its round.'));
  R.define('ARCHETYPES', 'demonstrator', m4('Keeps to its track and never chases. On the chime it performs the demonstration on its label.'));
  R.define('ARCHETYPES', 'conservator_healer', m4('Stays behind its allies and spends a turn, shown, restoring one; backs away when you come close.'));
  R.define('ARCHETYPES', 'completing_guardian', m4('Grows one limb for every two galleries you have walked, up to four; each limb is a special. Leaving its room heals it and drops one limb.'));
  R.define('ARCHETYPES', 'mp_ensemble', m4('Several pieces share one health pool. When a piece falls, the others take on its special.'));
  R.define('ARCHETYPES', 'mp_tableau', m4('Stays in its frame and alternates shown lines and bursts; takes double damage while it summons.'));
  R.define('MODIFIERS', 'clockwork', m4('Shows its next move as an arrow and cannot be dazed; rain stops it for 2 turns.'));
  R.define('TRIGGERS', 'period', Object.assign(m4('wakes on the chime to perform, then sleeps again'), { icon: 'period' }));

  // The five slice modules (§5.4), each with the sentence its department's panel teaches.
  R.define('MODULES', 'unobserved_motion', { built: 'M4', sentence: 'The animals move only when you cannot see them.' });
  R.define('MODULES', 'alarm_network', { built: 'M4', sentence: 'The waders raise the alarm when they see you; then the whole court is awake.' });
  R.define('MODULES', 'copies_weaken', { built: 'M4', sentence: 'When an original is broken, its spares lose heart.' });
  R.define('MODULES', 'hourly_demonstration', { built: 'M4', sentence: 'On the chime, the stations exchange signals down the length of the gallery.' });
  R.define('MODULES', 'weather_cases', { built: 'M4', sentence: 'Some cases hold weather. Break one, and the weather gets out.' });

  // Wake causes M4 brings (§8.2): the chime makes a station perform and sleep again; the
  // alarm wakes exhibits awake; a patrol is created awake on its round.
  R.define('WAKE_CAUSES', 'period', { built: 'M4', mode: 'perform', creation: false });
  R.define('WAKE_CAUSES', 'alarm', { built: 'M4', mode: 'awake', creation: false });
  R.define('WAKE_CAUSES', 'patrol', { built: 'M4', mode: 'awake', creation: true });
  const wake = { by: 'uid?', dist: 'int?', x: 'int?', y: 'int?', from: 'tile?', how: 'str?' };
  for (const k of ['period', 'alarm', 'patrol']) for (const kind of ['woke', 'hunting']) R.defineCause(kind, k, { fields: wake, built: 'M4' });

  // The M4 event kinds (§4.3).
  R.defineEvent('alarm', { fields: { by: 'uid' }, built: 'M4' });
  R.defineEvent('certificate', { fields: { acc: 'str' }, built: 'M4' });
  R.defineEvent('grade', { fields: { grade: 'int' }, built: 'M4' });
  R.defineEvent('perk', { fields: { id: 'str', rank: 'int' }, built: 'M4' });
  R.defineEvent('viewed', { fields: { who: 'uid', turns: 'int' }, built: 'M4' });
  R.defineEvent('module', { fields: { id: 'str', rule: 'str' }, built: 'M4' });
})();
