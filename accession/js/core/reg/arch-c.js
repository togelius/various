// ACCESSION — registry fragment: the herald, the tethered_warden and the mimic_vitrine, and
// the `ring` and `call` specials (BUILD.md §5.5, §8.1), owned by W1-ARCH-C; with the wake
// clause of a pipless species and the wake cause `herald`.
'use strict';
(() => {
  const R = Registry;

  R.define('ARCHETYPES', 'herald', { icon: null, special: 'call',
    clause: 'Once awake, on seeing you it {special}; it strikes from beside you for {dmg}.',
    params: { dmg: 'role:DMG' }, covers: ['telegraphed', 'special', 'attacked', 'missed'], ready: false, tests: [], inv: null });
  R.define('ARCHETYPES', 'tethered_warden', { icon: null, special: 'ring',
    clause: 'Never goes more than {TETHER_RANGE} tiles from what it guards; strikes from beside you for {dmg}, and every {ROLE_WARDEN_SPECIAL_EVERY}rd action beside you {special}. When you leave, it goes back, heals and settles.',
    params: { TETHER_RANGE: 'N:TETHER_RANGE', dmg: 'role:DMG', ROLE_WARDEN_SPECIAL_EVERY: 'N:ROLE_WARDEN_SPECIAL_EVERY' },
    covers: ['attacked', 'missed', 'telegraphed', 'special', 'healed'], ready: false, tests: [], inv: null });
  // A disguised mimic gains no pips (§8.2), so its line takes the pipless wake clause.
  R.define('ARCHETYPES', 'mimic_vitrine', { icon: null, speed: 'slow', inflicts: ['rooted'], wake: 'wake_pipless',
    clause: 'Looks like a case, but its label has no accession number. Opened or bashed, it grips you ({status:rooted}) and strikes for {dmg}, then fights slowly.',
    params: { dmg: 'role:DMG' }, covers: ['attacked', 'missed', 'status'], ready: false, tests: [], inv: null });

  R.define('SPECIALS', 'ring', { icon: 'special', shape: 'ring', effect: 'damage', curve: 'ROLE_WARDEN_SPECIAL', range: null, every: 'ROLE_WARDEN_SPECIAL_EVERY',
    clause: 'marks the 8 tiles round it for a turn, then strikes them for {gross} before your Padding',
    params: { gross: 'curve:ROLE_WARDEN_SPECIAL' }, covers: ['telegraphed', 'special', 'damaged'], ready: false, tests: [], inv: null });
  R.define('SPECIALS', 'call', { icon: 'special', shape: 'call', effect: 'hook', curve: null, range: 'HERALD_RANGE', every: null,
    clause: 'calls for a turn, shown, then wakes every sleeping exhibit within {HERALD_RANGE} tiles, which come to look where you were',
    params: { HERALD_RANGE: 'N:HERALD_RANGE' }, covers: ['telegraphed', 'special', 'woke'], ready: false, tests: [], inv: null });

  R.define('CLAUSES', 'wake_pipless', { icon: null, clause: 'Wakes only when it is opened, bashed or struck.', params: {},
    covers: ['woke', 'hunting'], ready: false, tests: [], inv: null });

  R.defineCause('status', 'grip', { fields: { by: 'uid' } });
  R.defineCause('healed', 'home', { fields: { by: 'uid' } });
  R.defineCause('lost', 'tether', { fields: {} });

  // A herald's call wakes sleepers awake, to look where you were (§8.2); `by` is the herald.
  R.define('WAKE_CAUSES', 'herald', { mode: 'awake', creation: false });
  const wake = { by: 'uid', dist: 'int?', x: 'int?', y: 'int?' };
  for (const kind of ['woke', 'hunting']) R.defineCause(kind, 'herald', { fields: wake });
})();
