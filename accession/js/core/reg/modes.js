// ACCESSION — registry fragment: modes and movement (BUILD.md §8.2), owned by W1-WAKE-B. The
// plodder, which is every exhibit's default behaviour; moving and doors; and the changes of
// mode after waking: losing you, being alerted, going home.
'use strict';
(() => {
  const R = Registry;
  const TESTS = ['behaviour/plodder.test.js', 'm3-modes.test.js', 'm3-movement.test.js'];

  // The plodder is AI.byMode with nothing of its own (rules/arch/plodder.js): one step or one
  // blow per action, the blow from beside you.
  R.define('ARCHETYPES', 'plodder', { icon: null, clause: 'Walks one tile at a time and strikes from beside you for {dmg}.',
    params: { dmg: 'role:DMG' }, covers: ['attacked', 'missed'], ready: 'unit', tests: TESTS, inv: 'modes' });

  // Events (§4.3). Moving and closing are exempt from the cause check (§3.4).
  R.defineEvent('moved', { fields: { who: 'uid', from: 'tile', to: 'tile' }, exempt: true });
  R.defineEvent('opened', { fields: { who: 'uid', x: 'int', y: 'int', staff: 'bool?', grade: 'int?' } });
  R.defineEvent('closed', { fields: { who: 'uid', x: 'int', y: 'int' }, exempt: true });
  R.defineEvent('lost', { fields: { who: 'uid', from: 'str', to: 'str' }, record: true });
  R.defineEvent('alerted', { fields: { who: 'uid', from: 'str', to: 'str', x: 'int', y: 'int' } });
  R.defineEvent('returned', { fields: { who: 'uid', phase: 'str' } });

  R.defineCause('opened', 'door', { fields: { by: 'uid' } });
  // Changes of mode by the modes' own timers (rules/ai.js): a hunter out of sight for
  // `turns` searches; an awake exhibit undisturbed for `turns` goes back; a search ends; a
  // reinstalling exhibit moved off its home goes back to it.
  R.defineCause('lost', 'out_of_sight', { fields: { turns: 'int' } });
  R.defineCause('lost', 'idle', { fields: { turns: 'int' } });
  R.defineCause('lost', 'searched', { fields: {} });
  R.defineCause('lost', 'displaced', { fields: {} });
  // A search that ends for an exhibit that may not go back (no home, or it never sleeps), one
  // going back that has no home left, and one going back that other actors leave no step
  // home: it wanders, from where it is (x, y: where it goes).
  R.defineCause('alerted', 'searched', { fields: {} });
  R.defineCause('alerted', 'homeless', { fields: {} });
  R.defineCause('alerted', 'blocked', { fields: {} });
  R.defineCause('returned', 'home', { fields: { x: 'int', y: 'int' } });
  R.defineCause('noise', 'door', { fields: { by: 'uid?', item: 'uid?' } });
  R.defineCause('noise', 'close', { fields: { by: 'uid?', item: 'uid?' } });

  // Being seen turns any waking mode into a hunt (§8.2).
  R.define('WAKE_CAUSES', 'seen', { mode: 'hunting', creation: false, ready: 'unit', tests: TESTS, inv: 'modes' });
  R.defineCause('woke', 'seen', { fields: { dist: 'int' } });
  R.defineCause('hunting', 'seen', { fields: { dist: 'int' } });

  // Closing a door (rules/doors.js): refused if there is no open door beside you, or an actor
  // stands in its doorway. A door past a corner is refused with the backbone's corner.
  for (const code of ['no_door', 'doorway_occupied']) R.define('REFUSALS', code, { ready: 'unit', tests: ['m3-movement.test.js'], inv: 'modes' });
})();
