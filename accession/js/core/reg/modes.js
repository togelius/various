// ACCESSION — registry fragment: modes and movement (BUILD.md §8.2), owned by W1-WAKE-B. The
// plodder, which is every exhibit's default behaviour; moving and doors; and the changes of
// mode after waking: losing you, being alerted, going home.
'use strict';
(() => {
  const R = Registry;

  R.define('ARCHETYPES', 'plodder', { icon: null, clause: 'Walks one tile at a time and strikes from beside you for {dmg}.',
    params: { dmg: 'role:DMG' }, covers: ['attacked', 'missed'], ready: false, tests: [], inv: null });

  // Events (§4.3). Moving and closing are exempt from the cause check (§3.4).
  R.defineEvent('moved', { fields: { who: 'uid', from: 'tile', to: 'tile' }, exempt: true });
  R.defineEvent('opened', { fields: { who: 'uid', x: 'int', y: 'int', staff: 'bool?', grade: 'int?' } });
  R.defineEvent('closed', { fields: { who: 'uid', x: 'int', y: 'int' }, exempt: true });
  R.defineEvent('lost', { fields: { who: 'uid', from: 'str', to: 'str' }, record: true });
  R.defineEvent('alerted', { fields: { who: 'uid', from: 'str', to: 'str', x: 'int', y: 'int' } });
  R.defineEvent('returned', { fields: { who: 'uid', phase: 'str' } });

  R.defineCause('opened', 'door', { fields: { by: 'uid' } });
  R.defineCause('lost', 'out_of_sight', { fields: { turns: 'int' } });
  R.defineCause('lost', 'idle', { fields: { turns: 'int' } });
  R.defineCause('lost', 'searched', { fields: {} });
  R.defineCause('returned', 'home', { fields: { x: 'int', y: 'int' } });
  R.defineCause('noise', 'door', { fields: { by: 'uid?', item: 'uid?' } });
  R.defineCause('noise', 'close', { fields: { by: 'uid?', item: 'uid?' } });

  // Being seen turns any waking mode into a hunt (§8.2).
  R.define('WAKE_CAUSES', 'seen', { mode: 'hunting', creation: false });
  R.defineCause('woke', 'seen', { fields: { dist: 'int' } });
  R.defineCause('hunting', 'seen', { fields: { dist: 'int' } });
})();
