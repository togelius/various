// ACCESSION — building a fresh state (BUILD.md §4.1).
'use strict';
const Setup = (() => {
  const SAVE_VERSION = 1;

  // The visitor at the start of a run: a T1 Balanced weapon and a T1 Standard garment
  // (BUILD.md §8.1), from the forms in the numbers table. `form` ('light', 'balanced',
  // 'heavy' or 'reach'; Balanced if absent) swaps the T1 weapon, for tests and scenarios.
  // You carry every actor field (Actors.make), and also: still (your ring's radius comes
  // from your last action that cost time, §8.2), lastAct, seated (on a bench, §8.1), regen
  // (the regeneration store), and your derived stats, which Kit.settle keeps up to date.
  const FORMS = { light: N.FORM_LIGHT, balanced: N.FORM_BALANCED, heavy: N.FORM_HEAVY, reach: N.FORM_REACH };
  function you(x, y, form) {
    form = form || 'balanced';
    const t = 1, F = FORMS[form], G = N.GARMENT_STANDARD;
    if (!F) throw new Error('Setup.you: no weapon form ' + form);
    return Object.assign(Actors.make(null, {
      uid: 'you', sp: 'visitor', size: 1, x, y, hp: N.PLAYER_HP, maxHp: N.PLAYER_HP,
      acc: N.PLAYER_ACC + F[4], eva: N.PLAYER_EVA + G[1], pad: t + G[0], dmin: t + F[0], dmax: F[1] * t + F[2],
    }), { still: false, lastAct: null, seated: false, regen: 0, weaponForm: form, reach: form === 'reach', quiet: 0, breaker: 0 });
  }

  // A state for one room: map rows, your position, and exhibit records. An exhibit record
  // gives its species id, tile, mode and stats (a role's, Roles.stats), and may give its
  // size (2 for a Centrepiece, §4.1) and any field Actors.make takes (arch, mods, trigger,
  // group, home, guards, ax, speed). options: Options.make's (rulesOff, without, invulnerable).
  function room(seed, spec, options) {
    const state = {
      v: SAVE_VERSION, coreHash: null, runId: null, seed, rng: {}, tick: 0, turn: 0,
      options: Options.make(options),
      dept: { acc: spec.acc, depth: spec.depth || 1, w: spec.map[0].length, h: spec.map.length, tiles: spec.map.slice() },
      actors: [you(spec.you[0], spec.you[1])],
      items: [],
      causes: [], over: null,
      ui: { pendingChoice: null },
    };
    let n = 0;
    for (const e of spec.exhibits) {
      n++;
      const rec = Object.assign({}, e, e.stats, {
        uid: spec.acc + '.' + state.dept.depth + '.' + (e.room || 'room') + '.' + n,
        x: e.at[0], y: e.at[1], mode: e.mode || 'dormant', maxHp: e.stats.hp,
      });
      delete rec.stats; delete rec.at; delete rec.room;
      Actors.spawn(state, rec);
    }
    return state;
  }

  return { SAVE_VERSION, you, room };
})();
