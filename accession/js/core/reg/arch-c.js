// ACCESSION — registry fragment: the herald, the tethered_warden and the mimic_vitrine, and
// the `ring` and `call` specials (BUILD.md §5.5, §8.1), owned by W1-ARCH-C; with the wake
// clause of a pipless species and the wake cause `herald`. The rules are in
// js/core/rules/arch/{herald,tethered_warden,mimic_vitrine}.js; the scenarios that prove each
// clause in test/behaviour/<id>.test.js, and their invariants in test/behaviour/arch-c.inv.js.
'use strict';
(() => {
  const R = Registry;
  const unit = tests => ({ ready: 'unit', tests, inv: 'arch-c' });
  const HERALD = ['behaviour/herald.test.js'], WARDEN = ['behaviour/tethered_warden.test.js'], MIMIC = ['behaviour/mimic_vitrine.test.js'];

  // The herald calls once each time it wakes, the first time it then sees you (§8.2); its
  // blows are the plodder's.
  R.define('ARCHETYPES', 'herald', Object.assign({ icon: null, special: 'call',
    clause: 'Each time it wakes, the first time it sees you it {special}; it strikes from beside you for {dmg}.',
    params: { dmg: 'role:DMG' }, covers: ['telegraphed', 'special', 'attacked', 'missed'] }, unit(HERALD)));
  // The tethered_warden keeps within TETHER_RANGE of what it guards; hunting you (searching
  // for you included: §8.2's hunting row) while you are outside its tether, it goes back: it
  // waits at its place while it sees you, and heals and settles once it does not (an exhibit
  // with no home never settles, §8.2). It rings you at most one action in
  // ROLE_WARDEN_SPECIAL_EVERY from its waking.
  R.define('ARCHETYPES', 'tethered_warden', Object.assign({ icon: null, special: 'ring',
    clause: 'Stays within {TETHER_RANGE} tiles of what it guards; if it hunts you and you are not, it goes back instead of fighting, waits there while it sees you, then heals fully and settles, unless it has no home. It strikes from beside you for {dmg}; beside you, at most one action in {ROLE_WARDEN_SPECIAL_EVERY} since it woke, it {special}.',
    params: { TETHER_RANGE: 'N:TETHER_RANGE', dmg: 'role:DMG', ROLE_WARDEN_SPECIAL_EVERY: 'N:ROLE_WARDEN_SPECIAL_EVERY' },
    covers: ['attacked', 'missed', 'telegraphed', 'special', 'healed'] }, unit(WARDEN)));
  // A mimic is a case until it is touched (§8.3), and gains no pips while it sleeps (§8.2), so
  // its line takes the pipless wake clause; it is slow at everything (§8.1).
  R.define('ARCHETYPES', 'mimic_vitrine', Object.assign({ icon: null, speed: 'slow', inflicts: ['rooted'], wake: 'wake_pipless',
    clause: 'Looks like a case, but its label has no accession number. Opened or bashed, it grips you ({status:rooted}) and strikes for {dmg}; it does everything at half speed.',
    params: { dmg: 'role:DMG' }, covers: ['attacked', 'missed', 'status'] }, unit(MIMIC)));

  // Specials (§8.1). Each actor on a marked tile is hit once, through its own Padding.
  R.define('SPECIALS', 'ring', Object.assign({ icon: 'special', shape: 'ring', effect: 'damage', curve: 'ROLE_WARDEN_SPECIAL', range: null, every: 'ROLE_WARDEN_SPECIAL_EVERY',
    clause: 'marks the tiles round it for a turn, then strikes everything on them for {gross} before Padding',
    params: { gross: 'curve:ROLE_WARDEN_SPECIAL' }, covers: ['telegraphed', 'special', 'damaged'] }, unit(WARDEN)));
  R.define('SPECIALS', 'call', Object.assign({ icon: 'special', shape: 'call', effect: 'hook', curve: null, range: 'HERALD_RANGE', every: null,
    clause: 'calls for a turn, shown, then wakes every sleeping exhibit within {HERALD_RANGE} tiles of it, which come to look where you stood as the call went off',
    params: { HERALD_RANGE: 'N:HERALD_RANGE' }, covers: ['telegraphed', 'special', 'woke'] }, unit(HERALD)));

  // A pipless species' wake clause, in place of the generic one (§5.3): only these wake it.
  R.define('CLAUSES', 'wake_pipless', Object.assign({ icon: null, clause: 'Wakes only when it is opened, bashed, dissolved or struck.', params: {},
    covers: ['woke', 'hunting'] }, unit(MIMIC)));

  // Causes this fragment's rules give events of other kinds (§4.3): the mimic's grip
  // (rooted), the warden's heal at home, and its going back when you leave its tether.
  R.defineCause('status', 'grip', { fields: { by: 'uid' } });
  R.defineCause('healed', 'home', { fields: { by: 'uid' } });
  R.defineCause('lost', 'tether', { fields: {} });

  // A herald's call wakes sleepers awake, to look where you were (§8.2): `by` is the herald,
  // dist its distance, x and y the tile they go to look at.
  R.define('WAKE_CAUSES', 'herald', Object.assign({ mode: 'awake', creation: false }, unit(HERALD)));
  const wake = { by: 'uid', dist: 'int?', x: 'int?', y: 'int?' };
  for (const kind of ['woke', 'hunting']) R.defineCause(kind, 'herald', { fields: wake });
})();
