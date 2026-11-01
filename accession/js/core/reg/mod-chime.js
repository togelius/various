// ACCESSION — registry fragment: the module hourly_demonstration and its archetype, demonstrator
// (the stations): the chime and its lines (BUILD.md §5.1, §5.4, §8.1, §8.2), owned by MOD-CHIME.
// M4's skeleton made it; M4's Wave 0 (W0a) moved here, verbatim from reg/system.js, M2's
// placeholders (the archetype's clause and the period trigger's, the module's panel sentence,
// the period wake cause with its woke and hunting causes), and gave the module its keywords and
// its event's cause. MOD-CHIME built the rest: the rules are in
// js/core/rules/modules/hourly_demonstration.js, js/core/rules/arch/demonstrator.js and
// js/core/rules/wake.js (the performance); the scenarios that prove each clause in
// test/behaviour/{hourly_demonstration,demonstrator}.test.js, and the invariants in
// test/behaviour/chime.inv.js.
'use strict';
(() => {
  const R = Registry;
  // ready true: the scenarios pass joined up, every package's invariants on, and the chime's
  // fail with hourly_demonstration switched off.
  const proved = tests => ({ built: 'M4', ready: true, tests, inv: 'chime' });
  const STATION = ['behaviour/demonstrator.test.js', 'behaviour/hourly_demonstration.test.js'], CHIME = ['behaviour/hourly_demonstration.test.js', 'behaviour/demonstrator.test.js'];

  // The station (§5.5's Semaphore Station): fixed on its tile, it never steps and never strikes,
  // and never hunts, whatever wakes it (§8.2). This is all it does with its module off, which
  // takes away its chime and its line (Q3: "a station never strikes"); what the module gives it
  // is the module's part, set in the period trigger's slot, after its waking.
  R.define('ARCHETYPES', 'demonstrator', Object.assign({ icon: null,
    clause: 'Stands fixed on its tile, never hunts you and has no blow.', params: {}, covers: [] }, proved(STATION)));

  // The period trigger (§8.2's table): the chime wakes a station for its performance. Joined to
  // the wake clause, it says what the chime makes it do while the module is on, and with the
  // module off that no chime wakes it.
  R.define('TRIGGERS', 'period', Object.assign({ icon: 'period', clause: '{module:hourly_demonstration|no chime wakes it here}', params: {},
    covers: ['woke'] }, proved(STATION)));

  // The module (§5.4), its panel sentence (§5.4's table, as the panel teaches it: M2's "the
  // stations exchange signals down the length of the gallery" said neither that a line is
  // marked first nor that it strikes) and the words that name its rule (the Intro lint); its part
  // on a station's line, set in the period trigger's slot: the rule, in the order it acts. Its
  // periods are the room's the station stands in (one room, one period, D1.10); the overlap is
  // §8.1's (no two pending damage marks share a tile); "awake before" keeps it awake (D1.9).
  R.define('MODULES', 'hourly_demonstration', Object.assign({ icon: 'period', special: 'demo_line',
    sentence: 'On the chime, every station marks its line across its room, and two turns later the line strikes everything on it.',
    phrases: { 'two turns': 'N:DEMO_WARNING' }, keywords: ['chime', 'demonstration'],
    clause: 'on each chime, every {DEMO_PERIOD} turns ({DEMO_PERIOD_INTRO} in the Intro, {DEMO_PERIOD_HALL} in the hall), it wakes and, unless another mark lies on its line, {special}; then it sleeps again with its pips, unless it was awake before',
    params: { DEMO_PERIOD: 'N:DEMO_PERIOD', DEMO_PERIOD_INTRO: 'N:DEMO_PERIOD_INTRO', DEMO_PERIOD_HALL: 'N:DEMO_PERIOD_HALL' },
    covers: ['module'] }, proved(CHIME)));

  // The station's line (§8.1, D1.10): a beam from its tile along its direction to the edge of
  // its room, marked at the chime, due DEMO_WARNING turns later, gross DEMO_LINE_DMG (a curve at
  // depth anchors 1/4/8, MO11). Its shape is the module's (Specials.addShape('demo_line'),
  // glass: a beam passes glass). Named a line in sentences (noun).
  R.define('SPECIALS', 'demo_line', Object.assign({ icon: 'special', shape: 'demo_line', effect: 'damage', curve: 'DEMO_LINE_DMG', range: null, every: null, noun: 'line',
    clause: 'marks its line: a beam across its room, through glass and back from a reflector, that strikes all on it {DEMO_WARNING} turns later for {gross} before Padding',
    params: { DEMO_WARNING: 'N:DEMO_WARNING', gross: 'curve:DEMO_LINE_DMG' }, covers: ['telegraphed', 'special', 'damaged'] }, proved(CHIME)));

  // Wake cause (§8.2): the chime makes a station perform (awake, keeping its pips) and sleep again.
  R.define('WAKE_CAUSES', 'period', Object.assign({ mode: 'perform', creation: false }, proved(CHIME)));
  const wake = { by: 'uid?', dist: 'int?', x: 'int?', y: 'int?', from: 'tile?', how: 'str?' };
  for (const kind of ['woke', 'hunting']) R.defineCause(kind, 'period', { fields: wake, built: 'M4' });

  // Its module event (reg/system.js): rules `chime` (the chime sounds, its lines due in turns;
  // n stations), `line` (a station marks its line; who), `blocked` (a station's line is not
  // marked, since another mark lies on it; who) and `settle` (a station goes back to sleep
  // with the pips it had; who, n those pips).
  R.defineCause('module', 'hourly_demonstration', { fields: {}, built: 'M4' });
})();
