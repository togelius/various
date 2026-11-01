// ACCESSION — registry fragment: the module alarm_network and its archetype, patrol_guard (the
// Wader): the alarm, its call and the patrol (BUILD.md §5.1, §5.4, §8.2), owned by MOD-ALARM.
// M4's skeleton made it; M4's Wave 0 (W0a) moved here, verbatim from reg/system.js, M2's
// clause for the archetype, the module's panel sentence and the alarm and patrol wake causes,
// and gave the alarm event, the module event's cause and the module's keywords their schemas
// (M4 plan A5). MOD-ALARM built the rest: the rules are in js/core/rules/arch/patrol_guard.js
// and js/core/rules/modules/alarm_network.js; the scenarios that prove each clause in
// test/behaviour/{patrol_guard,alarm_network}.test.js, and the invariants in
// test/behaviour/alarm.inv.js.
'use strict';
(() => {
  const R = Registry;
  // ready true: the scenarios pass joined up, every package's invariants on, and the alarm's
  // fail with alarm_network switched off.
  const proved = tests => ({ built: 'M4', ready: true, tests, inv: 'alarm' });
  const PATROL = ['behaviour/patrol_guard.test.js', 'behaviour/alarm_network.test.js'], ALARM = ['behaviour/alarm_network.test.js', 'behaviour/patrol_guard.test.js'];

  // The Wader (§5.5: "exhibits on two patrol routes, with no lamp cone: they see as every
  // exhibit sees"). Awake from the start, it walks its round: its posts (route {posts, i},
  // placed by population with no draw), each in turn, one step a turn along a shortest walk,
  // the next post i; it never sleeps (its trigger, `awake`). On seeing you it hunts you, as a
  // plodder does; having lost you and searched, it goes back to its round, not to sleep. What
  // alarm_network adds is the module's own part, set in the slot: with the module off the
  // line reads "On seeing you it chases you" (§5.3, Q3).
  R.define('ARCHETYPES', 'patrol_guard', Object.assign({ icon: null,
    clause: 'Walks its round and strikes from beside you for {dmg}. On seeing you it {module:alarm_network|chases you}; losing you, it searches, then resumes its round.',
    params: { dmg: 'role:DMG' }, covers: ['attacked', 'missed'] }, proved(PATROL)));

  // The module (§5.4), its panel sentence (§5.4's table, as the panel teaches it) and the words
  // that name its rule (the Intro lint); its part on a Wader's line, set in the archetype's
  // slot: the rule, in the order it acts. "Shown or running": only one alarm is shown at a
  // time, and none while one runs. The call wakes only those still asleep after its crash
  // (one the crash woke went to look at the crash), that can hear (a mimic in its disguise
  // hears nothing), and never the Centrepiece (§8.2: only pips and damage wake it), wherever
  // they are in the department. The panel sentence says just that: M2's "then the whole court
  // is awake" claimed more than the call does, since the Centrepiece and a mimic sleep on. For
  // its turns no pip decays (§8.2's decay) and no exhibit goes back to its place for having
  // been left undisturbed or done searching (Modules.mayReturn; one already going back goes
  // on, and a tethered warden still goes back when you leave its tether, its own rule, so the
  // line names the two reasons, not "none awake or searching"); and the clock's next stage
  // comes nearer by up to its advance: the bell (and the night watch with it), or after the
  // bell the night watch, never sooner than the next turn, and nothing in the night watch
  // (ClockRules.advance, whose stage sentence says which).
  R.define('MODULES', 'alarm_network', Object.assign({ icon: 'alarm', special: 'alarm',
    sentence: 'The waders raise the alarm when they see you; then every sleeping exhibit in the department that can hear, but the Centrepiece, wakes.', keywords: ['alarm', 'alarmed'],
    clause: 'chases you, first {special} and raising it unless one is shown or running: a crash, then every exhibit still asleep that can hear, but the Centrepiece, wakes, sent to look where you stood; for {ALARM_TURNS} turns no pips fade, none left undisturbed or done searching goes back and no other alarm is raised, and the bell, or after it the night watch, comes up to {ALARM_CLOCK_ADVANCE} turns sooner',
    params: { ALARM_TURNS: 'N:ALARM_TURNS', ALARM_CLOCK_ADVANCE: 'N:ALARM_CLOCK_ADVANCE' },
    covers: ['module', 'alarm', 'stage'] }, proved(ALARM)));

  // The alarm's telegraph (MO8): the Wader's special, a call that marks only its own tile,
  // shown for a turn as every mark is (§8.1), then resolved at its next action: the call
  // (AlarmNetwork.call, through the archetype's onResolve). It deals no damage (effect hook).
  // Its mark and its going off are told by its name, the alarm, and what it marks, its own
  // tile ("… marks its own tile for its alarm, at its next action."; noun and marks, which
  // text/combat.js reads), not as "1 tile for its special".
  R.define('SPECIALS', 'alarm', Object.assign({ icon: 'alarm', shape: 'alarm', effect: 'hook', curve: null, range: null, every: null, noun: 'alarm', marks: 'its own tile',
    clause: 'showing the alarm for a turn', params: {}, covers: ['telegraphed', 'special'] }, proved(ALARM)));

  // Wake causes (§8.2): the alarm wakes exhibits awake; a patrol is created awake on its round.
  R.define('WAKE_CAUSES', 'alarm', Object.assign({ mode: 'awake', creation: false }, proved(ALARM)));
  R.define('WAKE_CAUSES', 'patrol', Object.assign({ mode: 'awake', creation: true }, proved(PATROL)));
  const wake = { by: 'uid?', dist: 'int?', x: 'int?', y: 'int?', from: 'tile?', how: 'str?' };
  for (const k of ['alarm', 'patrol']) for (const kind of ['woke', 'hunting']) R.defineCause(kind, k, { fields: wake, built: 'M4' });

  // The alarm (§4.3, §5.4): who raised it, and the turn it ends (until); its cause is the module.
  R.defineEvent('alarm', { fields: { by: 'uid', until: 'int' }, built: 'M4' });
  R.defineCause('alarm', 'alarm_network', { fields: {}, built: 'M4' });

  // Its module event (reg/system.js): rules `alarm_shown` (a Wader shows the alarm for a turn;
  // who), `call` (it raised the alarm, its call having gone off: the crash, and every sleeper
  // that can hear but the Centrepiece woke; who, at its tile, n woken) and `alarm_over` (the
  // alarm's turns are up; turns it ran, and in its cause whether pips fade again, fade: not
  // after the bell). The call's wakes are told by their own events, woke
  // with cause alarm, never as module events naming the exhibits woken, whose lines do not
  // carry the module (§10.3's completeness).
  R.defineCause('module', 'alarm_network', { fields: { fade: 'bool?' }, built: 'M4' });

  // Other events the alarm makes, by cause: the call's crash, at the Wader's tile (noise);
  // the clock brought nearer (stage, ClockRules.advance: bell_sooner, watch_sooner or
  // nothing_sooner, with the turns it moved), by the Wader that raised it; sealed while a hall
  // is sealed, when the clock is stopped and those are turns it counts once it starts again.
  R.defineCause('noise', 'alarm', { fields: { by: 'uid' }, built: 'M4' });
  R.defineCause('stage', 'alarm_network', { fields: { by: 'uid', sealed: 'bool?' }, built: 'M4' });
  // A patrol done searching goes back to its round, not to sleep (§8.2's searching, for an
  // exhibit that never sleeps): alerted, to look at its next post.
  R.defineCause('alerted', 'round', { fields: {}, built: 'M4' });
})();
