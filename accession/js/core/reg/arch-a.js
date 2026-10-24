// ACCESSION — registry fragment: the darter, the splitter and the mote swarm, and the marble
// and plaster modifiers (BUILD.md §5.5), owned by W1-ARCH-A; and the wake cause `summoned`,
// which a splitter's halves are made with.
'use strict';
(() => {
  const R = Registry;

  R.define('ARCHETYPES', 'darter', { icon: null, speed: 'fast',
    clause: 'Moves two tiles a turn; strikes from beside you for {dmg}, then steps back {DARTER_STEP_BACK}.',
    params: { dmg: 'role:DMG', DARTER_STEP_BACK: 'N:DARTER_STEP_BACK' }, covers: ['attacked', 'missed'], ready: false, tests: [], inv: null });
  R.define('ARCHETYPES', 'splitter', { icon: null,
    clause: 'Walks one tile at a time and strikes from beside you for {dmg}. A blow that does not destroy it splits it in two, each with half its remaining health, at most {SPLIT_MAX} times.',
    params: { dmg: 'role:DMG', SPLIT_MAX: 'N:SPLIT_MAX' }, covers: ['attacked', 'missed'], ready: false, tests: [], inv: null });
  R.define('ARCHETYPES', 'mote_swarm', { icon: null, speed: 'fast',
    clause: 'Comes as several bodies that each fall to one blow; they move two tiles a turn and strike from beside you for {dmg}.',
    params: { dmg: 'role:DMG' }, covers: ['attacked', 'missed'], ready: false, tests: [], inv: null });

  R.define('MODIFIERS', 'marble', { icon: null, speed: 'slow', clause: 'Moves at half speed.', params: {}, covers: [], ready: false, tests: [], inv: null });
  R.define('MODIFIERS', 'plaster', { icon: null,
    clause: 'A cast: it has {PLASTER_HP_PCT}% of the usual health, and when destroyed it crumbles into dust that blocks sight round it for {PLASTER_DUST_TURNS} turns.',
    params: { PLASTER_HP_PCT: 'N:PLASTER_HP_PCT', PLASTER_DUST_TURNS: 'N:PLASTER_DUST_TURNS' }, covers: [], ready: false, tests: [], inv: null });

  // A body made from another (a splitter's half) wakes in its parent's mode; its story
  // names how it was made (how: 'split'), its parent (from), and a copy of the parent's own
  // waking (parent: {turn, cause}).
  R.define('WAKE_CAUSES', 'summoned', { mode: 'parent', creation: true });
  for (const kind of ['woke', 'hunting']) R.defineCause(kind, 'summoned', { fields: { by: 'uid?', how: 'str', from: 'uid', parent: 'obj?' } });
})();
