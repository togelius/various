// ACCESSION — registry fragment: the clock and leaving (BUILD.md §8.4, §8.9), owned by
// W1-CLOCK. The Night Watchman, the stage, entered and left events, and the wake causes
// of the night watch.
'use strict';
(() => {
  const R = Registry;

  R.define('ARCHETYPES', 'night_watchman', { icon: null,
    clause: 'Comes for you wherever you can be walked to and strikes from beside you for {dmg}; if defeated, another comes {WATCHMAN_RETURN} turns later.',
    params: { dmg: 'role:DMG', WATCHMAN_RETURN: 'N:WATCHMAN_RETURN' }, covers: ['attacked', 'missed'], ready: false, tests: [], inv: null });

  // Events (§4.3). A stage is 'bell', 'night_watch' or 'night_bell'.
  R.defineEvent('stage', { fields: { stage: 'str', n: 'int?', woke: 'uids?' }, record: true });
  R.defineEvent('entered', { fields: { who: 'uid', at: 'tile' }, record: true });
  R.defineEvent('left', { fields: { who: 'uid', door: 'int', at: 'tile' }, record: true });

  R.defineCause('stage', 'clock', { fields: { count: 'int', B: 'int', G: 'int' } });
  R.defineCause('entered', 'night_watch', { fields: { n: 'int' } });
  R.defineCause('entered', 'visit', { fields: {} });
  R.defineCause('left', 'leave', { fields: { door: 'int', stage: 'int' } });

  // The night-watch bell wakes the sleepers nearest you; the Watchman is made hunting.
  R.define('WAKE_CAUSES', 'night_bell', { mode: 'hunting', creation: false });
  R.define('WAKE_CAUSES', 'night_watch', { mode: 'hunting', creation: true });
  const wake = { by: 'uid?', dist: 'int?', x: 'int?', y: 'int?', from: 'tile?', how: 'str?' };
  for (const k of ['night_bell', 'night_watch']) for (const kind of ['woke', 'hunting']) R.defineCause(kind, k, { fields: wake });
})();
