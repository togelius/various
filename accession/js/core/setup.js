// ACCESSION — building a fresh state (BUILD.md §4.1).
'use strict';
const Setup = (() => {
  const SAVE_VERSION = 1;

  // The visitor at the start of a run: a T1 Balanced weapon and a T1 Standard garment
  // (BUILD.md §8.1), from the forms in the numbers table.
  function you(x, y) {
    const t = 1, F = N.FORM_BALANCED, G = N.GARMENT_STANDARD;
    return {
      uid: 'you', sp: 'visitor', size: 1, x, y, hp: N.PLAYER_HP, maxHp: N.PLAYER_HP, next: 0, still: false,
      acc: N.PLAYER_ACC + F[4], eva: N.PLAYER_EVA + G[1], pad: t + G[0], dmin: t + F[0], dmax: F[1] * t + F[2],
      weaponForm: 'balanced', statuses: [],
    };
  }

  // A state for one room: map rows, your position, and exhibit records from a pack.
  function room(seed, spec) {
    const state = {
      v: SAVE_VERSION, seed, rng: {}, tick: 0, turn: 0,
      dept: { acc: spec.acc, depth: spec.depth || 1, w: spec.map[0].length, h: spec.map.length, tiles: spec.map.slice() },
      actors: [you(spec.you[0], spec.you[1])],
      causes: [], over: null,
    };
    let n = 0;
    for (const e of spec.exhibits) {
      n++;
      state.actors.push(Object.assign({
        uid: spec.acc + '.' + state.dept.depth + '.' + (e.room || 'room') + '.' + n,
        size: 1, next: 0, pips: 0, statuses: [],
      }, e.stats, { sp: e.sp, x: e.at[0], y: e.at[1], mode: e.mode || 'dormant', maxHp: e.stats.hp }));
    }
    return state;
  }

  return { SAVE_VERSION, you, room };
})();
