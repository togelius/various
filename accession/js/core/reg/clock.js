// ACCESSION — registry fragment: the clock and leaving (BUILD.md §8.4, §8.9), owned by
// W1-CLOCK. The Night Watchman, the stage, entered and left events, the wake causes of the
// night watch, and leave's refusals.
'use strict';
(() => {
  const R = Registry;
  // ready true (W2a-BEHAVIOUR): the scenarios pass joined up, every package's invariants on.
  const TESTS = ['m3-clock.test.js', 'behaviour/night_watchman.test.js'];

  R.define('ARCHETYPES', 'night_watchman', { icon: null,
    clause: 'Comes for you across the whole department, always knowing where you are, and strikes from beside you for {dmg}; it is never caught by surprise. ' +
      'Staff doors stop it: when it cannot reach you, it waits as near to you as it can. If defeated, another comes {WATCHMAN_RETURN} turns later.',
    params: { dmg: 'role:DMG', WATCHMAN_RETURN: 'N:WATCHMAN_RETURN' }, covers: ['attacked', 'missed', 'entered'],
    ready: true, tests: TESTS, inv: 'night_watchman' });

  // Events (§4.3). A stage is 'bell', 'night_watch' or 'night_bell'; a night-watch bell
  // carries its number (n, from 1) and the exhibits it woke.
  R.defineEvent('stage', { fields: { stage: 'str', n: 'int?', woke: 'uids?' }, record: true });
  R.defineEvent('entered', { fields: { who: 'uid', at: 'tile' }, record: true });
  R.defineEvent('left', { fields: { who: 'uid', door: 'int', at: 'tile' }, record: true });

  R.defineCause('stage', 'clock', { fields: { count: 'int', B: 'int', G: 'int' } });
  // The n-th Night Watchman comes in at clock count `count`; near is true when someone stood
  // on the entrance, so it came in on the free tile nearest it.
  R.defineCause('entered', 'night_watch', { fields: { n: 'int', count: 'int', near: 'bool?' } });
  R.defineCause('entered', 'visit', { fields: {} });
  // You leave by exit door `door`, at clock stage `stage` (0 open, 1 after the bell, 2 the night watch).
  R.defineCause('left', 'leave', { fields: { door: 'int', stage: 'int' } });

  // The night-watch bell wakes the sleepers nearest you, hunting (n: the bell's number, dist:
  // the walking distance); the Watchman is made hunting (n: which Watchman it is).
  R.define('WAKE_CAUSES', 'night_bell', { mode: 'hunting', creation: false, ready: true, tests: TESTS, inv: 'night_watchman' });
  R.define('WAKE_CAUSES', 'night_watch', { mode: 'hunting', creation: true, ready: true, tests: TESTS, inv: 'night_watchman' });
  const wake = { by: 'uid?', n: 'int?', dist: 'int?', x: 'int?', y: 'int?', from: 'tile?', how: 'str?' };
  for (const k of ['night_bell', 'night_watch']) for (const kind of ['woke', 'hunting']) R.defineCause(kind, k, { fields: wake });

  // leave(i)'s refusals (§4.2): no exit door i, or you are not standing on it. Their
  // invariant is clock.leave, in night_watchman.inv.js: a leave is refused with exactly the
  // code its door and your tile give, and a refused leave changes nothing.
  for (const code of ['no_exit', 'not_on_exit']) R.define('REFUSALS', code, { ready: true, tests: ['m3-clock.test.js', 'behaviour/refusals.test.js'], inv: 'night_watchman' });
})();
