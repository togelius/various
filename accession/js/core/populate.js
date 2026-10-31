// ACCESSION — placing a department's exhibits, and the checks a populated plan must pass
// (BUILD.md §5.5; plan A10). M4's skeleton made each function with its signature and a
// neutral body: W0c moved M3's stand-in placement here from dept.js and built the
// validator registry, and D-POP fills the placement from gallery lists. Frozen once D-POP
// has landed.
//
// A validator registers with Populate.addValidator(id, fn) from its own file
// (js/core/layout/lv6.js, treasure.js, runner.js, lv-m4.js, in that load order), so none
// edits this file or dept.js: fn(state, plan) → null, or {reason, tiles} (a sentence, and
// the tiles to mark on the plan's text). Populate.validate runs them in the order added and
// gives the first rejection with its id, which makes the layout attempt fail and reseed.
//
// plan.intro, the stamped Intro, has the shape js/core/layout/stamp.js gives (LStamp.shape).
'use strict';
const Populate = (() => {
  // ---- The stand-in (M3's, moved verbatim from dept.js; D-POP replaces it) ----

  // A species is placed only once its archetype is built: M3's, until D-POP's readiness rule
  // (M4 plan A10). M4's species and the Centrepiece are left out, since their Behaviour lines
  // would not yet be true (§5.5).
  const built = sp => { const A = Registry.ARCHETYPES[sp.archetype || 'plodder']; return !!A && A.built === 'M3'; };

  // Place the pack's exhibits (§5.5): the stand-in placement of M2, unchanged in its draws.
  // One of each species whose archetype M3 builds, in pack order (a swarm as SWARM_BODIES[0]
  // bodies): the free floor tiles of the sections and studies beyond the safe zone
  // (SAFE_ZONE walking tiles from the entrance), shuffled once on the place/<acc>/d<depth>
  // stream; each species takes the first that is 3 or more tiles from every actor placed. A
  // swarm's further bodies take the nearest free floor tiles of the same room to its first,
  // with no draw (nearest by Chebyshev distance, then row-major). base (the attempt's
  // stream key, …/a<k>) names D-POP's room streams; the stand-in does not use it.
  function exhibits(state, plan, pack, base) {
    const m = state.dept, d = Grid.distances(m, [plan.entrance], 999), free = [];
    const roomAt = (x, y) => plan.rooms.find(q => q.id === plan.roomOf[y][x]);
    const ok = (x, y) => { const rm = roomAt(x, y); return m.tiles[y][x] === '.' && d[y * m.w + x] > N.SAFE_ZONE && !!rm && (rm.role === 'section' || rm.role === 'study'); };
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

  // ---- The validators (M4 plan A10) ----

  const validators = [];
  // Register validator `id`, once: fn(state, plan) → null, or {reason, tiles} (a sentence
  // saying what is wrong, and the tiles at fault, [[x, y]…], to mark on the plan's text).
  function addValidator(id, fn) {
    if (typeof id !== 'string' || !id) throw new Error('Populate.addValidator: a validator needs an id');
    if (typeof fn !== 'function') throw new Error(`Populate.addValidator: ${id} is not a function`);
    if (validators.some(v => v.id === id)) throw new Error(`Populate.addValidator: ${id} is added twice`);
    validators.push({ id, fn });
  }
  // The validators' ids, in the order added.
  const validatorIds = () => validators.map(v => v.id);

  // Run every validator on a populated department, in the order added; the first rejection,
  // as {id, reason, tiles}, or null when every one passes. A validator that answers anything
  // but null or {reason, tiles} is an error, so a fault in one is never read as a pass.
  function validate(state, plan) {
    for (const v of validators) {
      const r = v.fn(state, plan);
      if (r === null) continue;
      if (!r || typeof r.reason !== 'string' || !r.reason || !Array.isArray(r.tiles)) throw new Error(`Populate.validate: ${v.id} answered ${JSON.stringify(r)}, not null or {reason, tiles}`);
      return { id: v.id, reason: r.reason, tiles: r.tiles.map(t => [t[0], t[1]]) };
    }
    return null;
  }

  // D-POP fills: the gallery placed in room roomId, or null.
  function galleryOf(state, roomId) { return null; }

  return { exhibits, addValidator, validatorIds, validate, galleryOf };
})();
