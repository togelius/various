// ACCESSION — a department visit's starting state: the generated plan from a pack's
// programme, you at the entrance, the pack's exhibits placed asleep. M2's placement is a
// stand-in for M4's population pass: one of each species, in the sections, outside the
// safe zone, never on a gate cell.
'use strict';
const Dept = (() => {
  const SAFE = 8;

  function create(seed, acc, depth, options) {
    const pack = Packs.get(acc);
    const r = Layout.generate(pack.programme, 0, seed, { acc, depth });
    const plan = r.plan, nums = Layout.number(plan, depth);
    const tiles = plan.tiles.map(row => row.replace(/C/g, '.'));
    const state = {
      v: Setup.SAVE_VERSION, coreHash: null, runId: null, seed, rng: {}, tick: 0, turn: 0, options: Options.make(options),
      dept: { acc, depth, pin: plan.pin, programme: plan.programme, w: plan.w, h: plan.h, tiles, ltour: plan.ltour,
        rooms: plan.rooms.map(rm => ({ id: rm.id, role: rm.role, number: nums[rm.id] || 0, x0: rm.x0, y0: rm.y0, x1: rm.x1, y1: rm.y1 })),
        roomOf: plan.roomOf, entrance: plan.entrance, exits: plan.exits, lectern: plan.lectern, seen: '' },
      actors: [Setup.you(plan.entrance[0] + 1, plan.entrance[1])],
      items: [],
      causes: [], over: null,
      ui: { pendingChoice: null },
    };
    const m = state.dept, d = Grid.distances(m, [plan.entrance], 999);
    const free = [];
    for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
      const i = y * m.w + x, rm = plan.rooms.find(q => q.id === plan.roomOf[y][x]);
      if (m.tiles[y][x] === '.' && d[i] > SAFE && rm && (rm.role === 'section' || rm.role === 'study')) free.push([x, y]);
    }
    const holder = { seed, rng: {} }, pick = Rng.stream(holder, `place/${acc}/d${depth}`);
    pick.shuffle(free);
    let n = 0;
    for (const sp of pack.species) {
      const at = free.find(([x, y]) => !state.actors.some(a => Math.abs(a.x - x) < 3 && Math.abs(a.y - y) < 3));
      if (!at) break;
      add(state, sp, at, ++n, Roles.stats(sp.role, depth));
    }
    // The Centrepiece stands where the plan put its plinth.
    const c = pack.centrepiece;
    add(state, c, plan.cpl, ++n, Roles.stats('centrepiece', depth));
    return state;
  }

  // Every field from the species is copied onto the actor (§4.1), so rules never read the pack.
  function add(state, sp, at, n, stats) {
    const m = state.dept, rid = m.roomOf[at[1]][at[0]], rm = m.rooms.find(q => q.id === rid);
    Actors.spawn(state, Object.assign({}, stats, {
      uid: `${m.acc}.${m.depth}.${rm ? rm.role : 'room'}${rid}.${n}`, sp: sp.id, size: sp.size || 1, x: at[0], y: at[1], mode: 'dormant',
      maxHp: stats.hp, arch: sp.archetype || 'plodder', mods: sp.modifiers || [], modParams: sp.modParams || {}, trigger: sp.trigger || null,
      group: sp.group || null,
    }));
  }

  return { create };
})();
