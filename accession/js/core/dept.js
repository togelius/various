// ACCESSION — a department visit's starting state (BUILD.md §4.1, §5.5): the generated plan
// from a pack's programme, you at the entrance, the pack's exhibits placed asleep, then the
// cases, your kit and the department's items and consumables. The exhibits' placement is a
// stand-in for M4's population pass: one of each species whose archetype M3 builds (a swarm
// as SWARM_BODIES[0] bodies), in the sections, outside the safe zone, never on a gate cell.
// M4's species and the Centrepiece are left out, since their Behaviour lines would not yet
// be true (§5.5).
'use strict';
const Dept = (() => {
  const SAFE = 8;

  const built = sp => { const A = Registry.ARCHETYPES[sp.archetype || 'plodder']; return !!A && A.built === 'M3'; };

  // In this order: the state, with the plan; the cases (Cases.place); the exhibits, on the
  // place/<acc>/d<depth> stream; options.without marks its actors gone; each archetype's init;
  // your starting kit; the stand-in equipment and kits (Kit.standIn); the run's seals
  // (Consumables.startRun); the stand-in consumables (Consumables.standIn); your stats. The
  // three placement calls share one local holder, pop, so a room's
  // `${base}/room/<key>/populate` stream runs on from cases to items to consumables instead
  // of starting again for each (§3.2).
  function create(seed, acc, depth, options) {
    const pack = Packs.get(acc);
    const r = Layout.generate(pack.programme, 0, seed, { acc, depth });
    const plan = r.plan, nums = Layout.number(plan, depth), grade = N.GRADE_START;
    const tiles = plan.tiles.map(row => row.replace(/C/g, '.'));
    const dept = Object.assign({ acc, depth, pin: plan.pin, programme: plan.programme, w: plan.w, h: plan.h, tiles, ltour: plan.ltour,
      rooms: plan.rooms.map(rm => ({ id: rm.id, key: rm.key, role: rm.role, number: nums[rm.id] || 0, x0: rm.x0, y0: rm.y0, x1: rm.x1, y1: rm.y1 })),
      roomOf: plan.roomOf, entrance: plan.entrance, exits: plan.exits, lectern: plan.lectern, viewTile: plan.viewTile, seen: '' }, Setup.deptParts(grade));
    dept.clock = Clock.init(plan.ltour);
    const state = Setup.base(seed, dept, plan.entrance[0] + 1, plan.entrance[1], options, grade);
    const pop = { seed, rng: {} };
    Cases.place(state, plan, r.base, pop);
    place(state, pack, plan);
    Setup.settleActors(state, 1);
    Kit.start(state, 'balanced');
    Kit.standIn(state, r.base, pop);
    Consumables.startRun(state);
    Consumables.standIn(state, r.base, pop);
    Kit.settle(state);
    return state;
  }

  // The stand-in placement of exhibits (M2's, unchanged in its draws): the free floor tiles
  // of the sections and studies beyond the safe zone, shuffled once on the place/<acc>/d<depth>
  // stream; each species in pack order takes the first that is 3 or more tiles from every
  // actor placed. A swarm's further bodies take the nearest free floor tiles of the same room
  // to its first, with no draw (nearest by Chebyshev distance, then row-major).
  function place(state, pack, plan) {
    const m = state.dept, d = Grid.distances(m, [plan.entrance], 999), free = [];
    const roomAt = (x, y) => plan.rooms.find(q => q.id === plan.roomOf[y][x]);
    const ok = (x, y) => { const rm = roomAt(x, y); return m.tiles[y][x] === '.' && d[y * m.w + x] > SAFE && !!rm && (rm.role === 'section' || rm.role === 'study'); };
    for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) if (ok(x, y)) free.push([x, y]);
    const holder = { seed: state.seed, rng: {} }, pick = Rng.stream(holder, `place/${pack.acc}/d${m.depth}`);
    pick.shuffle(free);
    const counts = {};
    for (const sp of pack.species) {
      if (!built(sp)) continue;
      const at = free.find(([x, y]) => !state.actors.some(a => Math.abs(a.x - x) < 3 && Math.abs(a.y - y) < 3));
      if (!at) break;
      const bodies = [at];
      if ((sp.archetype || 'plodder') === 'mote_swarm') {
        const rid = plan.roomOf[at[1]][at[0]], near = [];
        for (const [x, y] of free) if (plan.roomOf[y][x] === rid && !(x === at[0] && y === at[1]) && !state.actors.some(a => Actors.covers(a, x, y))) near.push([x, y]);
        near.sort((p, q) => (Grid.chebyshev(p[0], p[1], at[0], at[1]) - Grid.chebyshev(q[0], q[1], at[0], at[1])) || (p[1] - q[1]) || (p[0] - q[0]));
        for (const t of near.slice(0, N.SWARM_BODIES[0] - 1)) bodies.push(t);
      }
      for (const b of bodies) add(state, sp, b, counts);
    }
  }

  // Every field from the species is copied onto the actor (§4.1), so rules never read the
  // pack. Its uid is <acc>.<depth>.<roleKey>.<n>, n counted per room in placement order
  // (§3.2). A species that never sleeps (a trigger that stands for the wake clause, `awake`)
  // is placed awake.
  function add(state, sp, at, counts) {
    const m = state.dept, rid = m.roomOf[at[1]][at[0]], rm = m.rooms.find(q => q.id === rid), key = rm ? rm.key : 'room';
    counts[key] = (counts[key] || 0) + 1;
    const stats = Roles.stats(sp.role, m.depth), T = sp.trigger ? Registry.TRIGGERS[sp.trigger] : null;
    Actors.spawn(state, Object.assign({}, stats, {
      uid: `${m.acc}.${m.depth}.${key}.${counts[key]}`, sp: sp.id, size: sp.size || 1, x: at[0], y: at[1],
      mode: T && T.replacesWake ? 'awake' : 'dormant',
      maxHp: stats.hp, arch: sp.archetype || 'plodder', mods: sp.modifiers || [], modParams: sp.modParams || {}, trigger: sp.trigger || null,
      group: sp.group || null,
    }));
  }

  return { create };
})();
