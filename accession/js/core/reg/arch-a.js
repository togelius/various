// ACCESSION — registry fragment: the darter, the splitter and the mote swarm, and the marble
// and plaster modifiers (BUILD.md §5.5), owned by W1-ARCH-A; and the wake cause `summoned`,
// which a splitter's halves are made with. The rules are in rules/arch/{darter,splitter,
// mote_swarm}.js and rules/mods/{marble,plaster}.js; the scenarios that prove each clause in
// test/behaviour/<id>.test.js, and the invariants in test/behaviour/arch-a.inv.js.
'use strict';
(() => {
  const R = Registry;
  const proved = id => ({ ready: 'unit', tests: [`behaviour/${id}.test.js`], inv: 'arch-a' });

  R.define('ARCHETYPES', 'darter', Object.assign({ icon: null, speed: 'fast',
    clause: 'Moves two tiles a turn; strikes from beside you for {dmg}, then at once steps back {DARTER_STEP_BACK} tile if it has room.',
    params: { dmg: 'role:DMG', DARTER_STEP_BACK: 'N:DARTER_STEP_BACK' }, covers: ['attacked', 'missed'] }, proved('darter')));
  R.define('ARCHETYPES', 'splitter', Object.assign({ icon: null,
    clause: 'Walks one tile at a time and strikes from beside you for {dmg}. Each hit it survives with 2 or more health splits it into two halves of that health, if there is room beside it; halves split again, up to {SPLIT_MAX} splits deep.',
    params: { dmg: 'role:DMG', SPLIT_MAX: 'N:SPLIT_MAX' }, covers: ['attacked', 'missed'] }, proved('splitter')));
  R.define('ARCHETYPES', 'mote_swarm', Object.assign({ icon: null, speed: 'fast',
    clause: 'Comes as several bodies that each fall to a single hit; they move two tiles a turn and strike from beside you for {dmg}.',
    params: { dmg: 'role:DMG' }, covers: ['attacked', 'missed'] }, proved('mote_swarm')));

  R.define('MODIFIERS', 'marble', Object.assign({ icon: null, speed: 'slow', clause: 'Moves at half speed.', params: {}, covers: [] }, proved('marble')));
  R.define('MODIFIERS', 'plaster', Object.assign({ icon: null,
    clause: 'A cast: it has {PLASTER_HP_PCT}% of the usual health, and when destroyed it crumbles into dust that blocks sight round it for {PLASTER_DUST_TURNS} turns.',
    params: { PLASTER_HP_PCT: 'N:PLASTER_HP_PCT', PLASTER_DUST_TURNS: 'N:PLASTER_DUST_TURNS' }, covers: [] }, proved('plaster')));

  // A body made from another (a splitter's half) wakes in its parent's mode; its story
  // names how it was made (how: 'split'), its parent (from), who hit the parent (by), and a
  // copy of the parent's own waking (parent: {turn, cause}).
  R.define('WAKE_CAUSES', 'summoned', Object.assign({ mode: 'parent', creation: true }, { ready: 'unit', tests: ['behaviour/splitter.test.js'], inv: 'arch-a' }));
  for (const kind of ['woke', 'hunting']) R.defineCause(kind, 'summoned', { fields: { by: 'uid?', how: 'str', from: 'uid', parent: 'obj?' } });
})();
