// ACCESSION — placing a department's exhibits, and the checks a populated plan must pass
// (BUILD.md §5.2, §5.5; plan A10). M4's skeleton made each function with its signature; W0c
// moved M3's stand-in placement here from dept.js and built the validator registry; D-POP
// placed exhibits from gallery lists. Frozen once D-POP has landed.
//
// A validator registers with Populate.addValidator(id, fn) from its own file
// (js/core/layout/lv6.js, treasure.js, runner.js, lv-m4.js, in that load order), so none
// edits this file or dept.js: fn(state, plan, log) → null, or {reason, tiles} (a sentence, and
// the tiles to mark on the plan's text); log is the layout attempt's log, to which a validator
// may add what it did ({check: <its id>, room, op: a sentence}). Populate.validate runs them in
// the order added and gives the first rejection with its id, which makes the layout attempt
// fail and reseed.
//
// plan.intro, the stamped Intro, has the shape js/core/layout/stamp.js gives (LStamp.shape).
'use strict';
const Populate = (() => {
  const own = (o, k) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
  const rowMajor = (p, q) => (p[1] - q[1]) || (p[0] - q[0]);
  const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const LINE_DIRS = ['N', 'E', 'S', 'W'];

  // ---- The stand-in (M3's, moved verbatim from dept.js), for a pack with no gallery list ----

  // A species is placed only once its archetype is built: M3's, until D-POP's readiness rule
  // (M4 plan A10). M4's species and the Centrepiece are left out, since their Behaviour lines
  // would not yet be true (§5.5).
  const built = sp => { const A = Registry.ARCHETYPES[sp.archetype || 'plodder']; return !!A && A.built === 'M3'; };

  // The stand-in placement of M2, unchanged in its draws: one of each species whose archetype
  // M3 builds, in pack order (a swarm as SWARM_BODIES[0] bodies): the free floor tiles of the
  // sections and studies beyond the safe zone (SAFE_ZONE walking tiles from the entrance),
  // shuffled once on the place/<acc>/d<depth> stream; each species takes the first that is 3
  // or more tiles from every actor placed. A swarm's further bodies take the nearest free
  // floor tiles of the same room to its first, with no draw (nearest by Chebyshev distance,
  // then row-major).
  function standIn(state, plan, pack) {
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
  // is placed awake. extra gives what a gallery list sets beyond the species (the group's
  // instance, guards), as Actors.spawn takes it. Returns the actor.
  function add(state, sp, at, counts, extra) {
    const m = state.dept, rid = m.roomOf[at[1]][at[0]], rm = m.rooms.find(q => q.id === rid), key = rm ? rm.key : 'room';
    counts[key] = (counts[key] || 0) + 1;
    const stats = Roles.stats(sp.role, m.depth), T = sp.trigger ? Registry.TRIGGERS[sp.trigger] : null;
    return Actors.spawn(state, Object.assign({}, stats, {
      uid: `${m.acc}.${m.depth}.${key}.${counts[key]}`, sp: sp.id, size: sp.size || 1, x: at[0], y: at[1],
      mode: T && T.replacesWake ? 'awake' : 'dormant',
      maxHp: stats.hp, arch: sp.archetype || 'plodder', mods: sp.modifiers || [], modParams: sp.modParams || {}, trigger: sp.trigger || null,
      group: sp.group || null,
    }, extra || {}));
  }

  // ---- Readiness (plan A10) ----

  // Populate.ready(rec): may a gallery list place this species (or a Centrepiece record, by its
  // core)? Only once its archetype, each of its modifiers and its trigger are past `ready:
  // false` in the registry (§5.1), so that no Behaviour line describes a rule not yet built.
  // An exhibit with no archetype is a plodder.
  function ready(rec) {
    const R = Registry, ok = (table, id) => own(R[table], id) && R[table][id].ready !== false;
    if (!rec || !ok('ARCHETYPES', rec.archetype || 'plodder')) return false;
    for (const id of rec.modifiers || []) if (!ok('MODIFIERS', id)) return false;
    return !rec.trigger || ok('TRIGGERS', rec.trigger);
  }

  // ---- The gallery list (§5.2) ----

  // A pack's gallery list, pack.galleries: [{key, where?, name, contents}], in the sample's
  // order. key is 'intro', 'centre' (the Centrepiece hall), 'coda', 'last' (the samples' study
  // room: the last section in tour order), or s1, s2 … (the sample's section galleries, in
  // its order); a section gallery's where names a programme element, a tag the plan gives its
  // rooms ('central', 'band', 'row'). contents lists, in placement order, exhibits
  //   {sp, count?, case?, near?, guards?, dir?}
  //     sp      a species of the pack;
  //     count   how many (1 if absent); a swarm counts its swarms, each SWARM_BODIES[0] bodies;
  //     case    true: each stands in an empty case of its room (on the floor if none is left);
  //     near    'case': each stands beside a real case of its room (anywhere if none can);
  //     guards  'case' (a tethered_warden): it guards a case of its room (below);
  //     dir     (a demonstrator) its line's direction, N, E, S or W, instead of the longest;
  // and items, {item, case?}, which population leaves to the item placement.
  // The Intro stamp's legend (pack.intro.legend, a letter → a record) names an exhibit as
  // {sp, guards?, dir?}: it stands on each tile the plan marks with that letter. No such letter
  // stands on a stretch row, and a copy group the stamp places keeps a gallery's rule (one of
  // its original, COPY_GROUP in all), its marks counted on the stamp's map (D-STAMPS).
  //
  // Populate.check(pack) → the problems with its gallery list and its stamp's exhibits, as
  // sentences ([] when there are none, or when it has no gallery list). Population refuses a
  // pack with any (an error), since each is a content fault no layout can mend.
  const KEYS = ['intro', 'centre', 'coda', 'last'];
  const ENTRY = ['sp', 'count', 'case', 'near', 'guards', 'dir', 'apart'], ITEM = ['item', 'case'], LEGEND = ['sp', 'guards', 'dir'];
  const isSection = key => typeof key === 'string' && /^s[1-9][0-9]*$/.test(key);
  function check(pack) {
    const out = [];
    if (!pack || pack.galleries === undefined) return out;
    if (!Array.isArray(pack.galleries)) return [`${pack.acc}'s galleries are not a list`];
    const species = id => (pack.species || []).find(s => s.id === id) || null;
    const arch = sp => sp.archetype || 'plodder';
    const fields = (what, rec, allowed) => { for (const k of Object.keys(rec)) if (!allowed.includes(k)) out.push(`${what} has the unknown field ${k}`); };
    // An exhibit's own options, wherever it is named (a gallery entry or the legend).
    const options = (what, e, sp) => {
      if ((sp.size || 1) !== 1) out.push(`${what}: ${sp.id} is ${sp.size} tiles across, and population places one-tile exhibits (a Centrepiece by its own rule)`);
      if (e.guards !== undefined && !(e.guards === 'case' && arch(sp) === 'tethered_warden')) out.push(`${what}: guards is 'case', and only for a tethered_warden`);
      if (e.dir !== undefined && !(LINE_DIRS.includes(e.dir) && arch(sp) === 'demonstrator')) out.push(`${what}: dir is one of ${LINE_DIRS.join(', ')}, and only for a demonstrator`);
      if (e.apart !== undefined && !(e.apart === true && arch(sp) === 'herald')) out.push(`${what}: apart is true, and only for a herald`);
    };
    const keys = [];
    pack.galleries.forEach((g, i) => {
      const what = `${pack.acc}'s gallery ${i + 1}`;
      if (!g || typeof g !== 'object') { out.push(`${what} is not a record`); return; }
      fields(what, g, ['key', 'where', 'name', 'contents']);
      if (!KEYS.includes(g.key) && !isSection(g.key)) out.push(`${what} has the key ${JSON.stringify(g.key)}, not intro, centre, coda, last or s1, s2 …`);
      else if (keys.includes(g.key)) out.push(`${what} has the key ${g.key}, which another gallery has`);
      keys.push(g.key);
      if (g.where !== undefined && !(isSection(g.key) && typeof g.where === 'string' && g.where)) out.push(`${what}: where names a programme element, and only for a section gallery`);
      if (typeof g.name !== 'string' || !g.name) out.push(`${what} has no name`);
      if (!Array.isArray(g.contents)) { out.push(`${what}'s contents are not a list`); return; }
      const bodies = {}, originals = {};
      g.contents.forEach((e, j) => {
        const at = `${what} (${g.name}), entry ${j + 1}`;
        if (!e || typeof e !== 'object') { out.push(`${at} is not a record`); return; }
        if (e.item !== undefined) {
          fields(at, e, ITEM);
          if (!(pack.items || []).some(it => it.id === e.item)) out.push(`${at} names ${JSON.stringify(e.item)}, which is no item of ${pack.acc}`);
          return;
        }
        fields(at, e, ENTRY);
        const sp = species(e.sp);
        if (!sp) { out.push(`${at} names ${JSON.stringify(e.sp)}, which is no species of ${pack.acc}`); return; }
        const n = e.count === undefined ? 1 : e.count;
        if (!Number.isInteger(n) || n < 1) out.push(`${at}: the count of ${sp.id} is not a whole number of 1 or more`);
        if (e.case !== undefined && e.case !== true) out.push(`${at}: case is true or absent`);
        if (e.near !== undefined && e.near !== 'case') out.push(`${at}: near is 'case' or absent`);
        if (e.case === true && arch(sp) === 'mimic_vitrine') out.push(`${at}: ${sp.id} cannot stand in a case (a mimic is its own case)`);
        if (arch(sp) === 'mimic_vitrine' && g.key === 'centre') out.push(`${at}: no mimic stands in the Centrepiece hall`);
        options(at, e, sp);
        if (sp.group) bodies[sp.group] = (bodies[sp.group] || 0) + (Number.isInteger(n) ? n : 0);
        if (sp.copyOf) originals[sp.group || ''] = originals[sp.group || ''] || sp.copyOf;
      });
      // A copy group (§4.1, plan DE5) is one instance a room: its spares with their original,
      // once, in the same gallery, COPY_GROUP[0]–COPY_GROUP[1] in all.
      for (const e of g.contents) {
        const sp = e && species(e.sp);
        if (!sp || !sp.copyOf) continue;
        const orig = g.contents.filter(q => q && q.sp === sp.copyOf).reduce((s, q) => s + (q.count === undefined ? 1 : q.count), 0);
        if (orig !== 1) out.push(`${what} (${g.name}) holds ${sp.id}, a spare of ${sp.copyOf}, with ${orig} of its original, not 1`);
      }
      for (const e of g.contents) {
        const sp = e && species(e.sp);
        if (!sp || !sp.group || !own(originals, sp.group) || e.sp !== originals[sp.group]) continue;
        const n = bodies[sp.group];
        if (n < N.COPY_GROUP[0] || n > N.COPY_GROUP[1]) out.push(`${what} (${g.name}) holds a copy group of ${n} (${sp.group}), not ${N.COPY_GROUP[0]}–${N.COPY_GROUP[1]}`);
      }
    });
    const legend = pack.intro && pack.intro.legend;
    if (legend && typeof legend === 'object') {
      // The stamp's exhibits, each letter with how many tiles of its map hold it (the floor
      // columns of every row, each row once).
      const rows = Array.isArray(pack.intro.map) ? pack.intro.map.filter(r => typeof r === 'string') : [];
      const stretch = Array.isArray(pack.intro.stretch) ? pack.intro.stretch : [];
      const marks = [];
      for (const ch of Object.keys(legend).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
        const e = legend[ch];
        if (!e || typeof e !== 'object' || e.sp === undefined) continue;
        const at = `${pack.acc}'s stamp legend ${JSON.stringify(ch)}`, sp = species(e.sp);
        if (!sp) { out.push(`${at} names ${JSON.stringify(e.sp)}, which is no species of ${pack.acc}`); continue; }
        if (Object.keys(e).some(k => !LEGEND.includes(k) && k !== 'tile')) out.push(`${at} gives an exhibit fields beyond sp, guards and dir (and its tile)`);
        options(at, e, sp);
        // A stretch row is repeated as often as the Intro is tall, so an exhibit on one would
        // stand there that many times: the stamp's count would not be the department's.
        for (const r of stretch) if (typeof rows[r] === 'string' && rows[r].slice(1).includes(ch)) out.push(`${at}: ${sp.id} stands on the stamp's stretch row ${r}, which repeats it as often as the Intro is tall`);
        marks.push({ sp, n: rows.reduce((k, row) => k + row.slice(1).split(ch).length - 1, 0) });
      }
      // A copy group the stamp places is one instance (the Intro's, §4.1), held to the rule a
      // gallery's is: each spare with exactly one of its original, COPY_GROUP[0]–COPY_GROUP[1] in all.
      const named = id => marks.filter(q => q.sp.id === id).reduce((k, q) => k + q.n, 0);
      const spares = [], groups = [];
      for (const { sp } of marks) {
        if (sp.copyOf && !spares.includes(sp.id)) {
          spares.push(sp.id);
          const orig = named(sp.copyOf);
          if (orig !== 1) out.push(`${pack.acc}'s stamp holds ${sp.id}, a spare of ${sp.copyOf}, with ${orig} of its original, not 1`);
        }
        if (sp.copyOf && sp.group && !groups.includes(sp.group)) {
          groups.push(sp.group);
          const n = marks.filter(q => q.sp.group === sp.group).reduce((k, q) => k + q.n, 0);
          if (n < N.COPY_GROUP[0] || n > N.COPY_GROUP[1]) out.push(`${pack.acc}'s stamp holds a copy group of ${n} (${sp.group}), not ${N.COPY_GROUP[0]}–${N.COPY_GROUP[1]}`);
        }
      }
    }
    return out;
  }

  // Populate.mapping(plan, pack) → for each gallery, in the pack's order, {room, how}: the id
  // of the room it fills (null if the plan has none for it) and how it was chosen (§5.5):
  //   'role'    intro, centre and coda go to the room of that role;
  //   'where'   a section gallery naming a programme element takes the first section, in tour
  //             order, with that tag that no gallery has yet taken (galleries in pack order);
  //   'tour'    then every section gallery still without a room takes the first section, in
  //             tour order, that none has taken;
  //   'merged'  a section gallery beyond the plan's sections joins the last section in tour
  //             order, and so does 'last' (the samples' study room).
  // Sections are keyed s1, s2 … in tour order (§3.2), so the last is the highest. No draw.
  function mapping(plan, pack) {
    const gs = pack.galleries || [], out = gs.map(() => ({ room: null, how: null }));
    const sections = plan.rooms.filter(r => r.role === 'section' && isSection(r.key))
      .sort((a, b) => Number(a.key.slice(1)) - Number(b.key.slice(1)));
    const last = sections.length ? sections[sections.length - 1] : null, taken = new Set();
    gs.forEach((g, i) => {
      if (g.key === 'intro' || g.key === 'centre' || g.key === 'coda') {
        const rm = plan.rooms.find(r => r.role === g.key);
        out[i] = { room: rm ? rm.id : null, how: 'role' };
      } else if (g.key === 'last') out[i] = { room: last ? last.id : null, how: 'merged' };
    });
    gs.forEach((g, i) => {
      if (!isSection(g.key) || !g.where) return;
      const rm = sections.find(r => !taken.has(r.id) && (r.tags || []).includes(g.where));
      if (rm) { taken.add(rm.id); out[i] = { room: rm.id, how: 'where' }; }
    });
    gs.forEach((g, i) => {
      if (!isSection(g.key) || out[i].how) return;
      const rm = sections.find(r => !taken.has(r.id));
      if (rm) { taken.add(rm.id); out[i] = { room: rm.id, how: 'tour' }; } else out[i] = { room: last ? last.id : null, how: 'merged' };
    });
    return out;
  }

  // ---- Placing from a gallery list ----

  // The tiles of each room, row-major, by room id.
  function roomTiles(m) {
    const by = new Map();
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const id = m.roomOf[y][x];
      if (!id) continue;
      if (!by.has(id)) by.set(id, []);
      by.get(id).push([x, y]);
    }
    return by;
  }

  // Would a case on (x, y), with the disguises of the mimics already placed (each a case on its
  // tile, [[x, y]…]), cut any tile off from the entrance, or leave a case with no tile beside
  // it to stand on (layout's LV1 and LV10, run again for a mimic's disguise, plan DE8)? reach
  // is the walking distances from the entrance as the department stands before any disguise.
  // The disguises are made at the mimics' init, after population, so they are counted
  // together here: two mimics that each cut nothing alone may close a passage between them.
  function cuts(m, x, y, reach, disguises) {
    const all = (disguises || []).concat([[x, y]]), rows = all.map(([, ty]) => [ty, m.tiles[ty]]);
    for (const [tx, ty] of all) m.tiles[ty] = m.tiles[ty].slice(0, tx) + 'v' + m.tiles[ty].slice(tx + 1);
    const d = Grid.distances(m, [m.entrance], 99999);
    let cut = false;
    for (let i = 0; i < d.length && !cut; i++) if (reach[i] >= 0 && d[i] < 0 && !all.some(([tx, ty]) => i === ty * m.w + tx)) cut = true;
    for (let k = -1; k < 8 && !cut; k++) {
      const cx = k < 0 ? x : x + Grid.DX[k], cy = k < 0 ? y : y + Grid.DY[k];
      if (!(k < 0 || Grid.ch(m, cx, cy) === 'v')) continue;
      let ok = false;
      for (let j = 0; j < 8 && !ok; j++) { const nx = cx + Grid.DX[j], ny = cy + Grid.DY[j]; if (Grid.inside(m, nx, ny) && d[ny * m.w + nx] >= 0) ok = true; }
      if (!ok) cut = true;
    }
    for (let i = rows.length - 1; i >= 0; i--) m.tiles[rows[i][0]] = rows[i][1];
    return cut;
  }

  // Populate.takeOk(state, x, y): may a tethered_warden guard (x, y) with something there to
  // take? Only if no tile you could take it from (the tile itself if you can stand on it, and
  // each one beside it you can stand on) lies one step from outside its tether (TETHER_RANGE
  // of (x, y), Grid.disc), so that coming close enough to take it wakes the warden a step
  // before you can (plan A10). No draw.
  function takeOk(state, x, y) {
    const m = state.dept;
    for (let k = -1; k < 8; k++) {
      const tx = k < 0 ? x : x + Grid.DX[k], ty = k < 0 ? y : y + Grid.DY[k];
      if (!Grid.walkable(m, tx, ty)) continue;
      for (let d = 0; d < 8; d++) if (Grid.canStep(m, tx, ty, d) && !Grid.disc(tx + Grid.DX[d] - x, ty + Grid.DY[d] - y, N.TETHER_RANGE)) return false;
    }
    return true;
  }

  // A station's line (plan D1.10) runs from its tile along one of N, E, S and W, through
  // tiles of its own room that sight passes: the longest of the four that no other exhibit
  // stands on, the first in that order on a tie; only if every one of them meets an exhibit,
  // the longest of the four. No draw. (A sleeper the line struck would wake at the chime and
  // hunt you from a room you may never have seen, §8.2's damage waking it; a reflector on it
  // would send the line back into its station at every chime. M4's first integration review.)
  function lineDir(state, m, a) {
    let best = null, most = -1, clear = null, longest = -1;
    for (const dir of LINE_DIRS) {
      const k = COMPASS.indexOf(dir), id = m.roomOf[a.y][a.x];
      let n = 0, x = a.x + Grid.DX[k], y = a.y + Grid.DY[k], met = false;
      while (Grid.inside(m, x, y) && m.roomOf[y][x] === id && Grid.seeThrough(m, x, y)) {
        const b = Actors.at(state, x, y);
        if (b && b !== a) met = true;
        n++; x += Grid.DX[k]; y += Grid.DY[k];
      }
      if (n > most) { most = n; best = dir; }
      if (!met && n > longest) { longest = n; clear = dir; }
    }
    return clear !== null && longest > 0 ? clear : best;
  }

  // Place the exhibits of a pack's gallery list (§5.5), and return null when every one stood
  // where its list says, or why not, {reason, tiles}, which fails the layout attempt (Dept.create
  // takes it as the rejection `population`): the first exhibit that could not be placed. log,
  // given, gets a line for each thing worth knowing ({check: 'population', room, op}), and one
  // for every exhibit not placed, saying why. An exhibit that cannot be placed never stops the
  // rest: every other one is still placed and fixed (its round, line or guarded case), so a
  // certified fallback taken despite the rejection holds every exhibit that fits, and its log
  // names each one that does not.
  function fromGalleries(state, plan, pack, base, log) {
    const problems = check(pack);
    if (problems.length) throw new Error(`Populate: ${pack.acc}'s gallery list is not sound:\n${problems.join('\n')}`);
    if (typeof base !== 'string' || !base) throw new Error('Populate.exhibits: a gallery list needs the layout attempt\'s stream key, base');
    const intro = plan.intro === undefined ? null : plan.intro, bad = LStamp.shape(intro);
    if (bad) throw new Error(`Populate.exhibits: ${bad}`);
    const m = state.dept, say = (rm, op) => { if (log) log.push({ check: 'population', room: rm ? rm.id : null, op }); };
    const reach = Grid.distances(m, [m.entrance], 99999);
    const view = plan.viewTile ? Grid.distances(m, [plan.viewTile], N.RING_STILL + 1) : null;
    const dist = (d, x, y) => Grid.reachDist(d, m, x, y);
    const tilesOf = roomTiles(m), roomById = id => m.rooms.find(r => r.id === id) || null;
    const counts = {}, holder = { seed: state.seed, rng: {} }, claimed = new Set(), placed = [], instances = new Map();
    // The rules every exhibit's tile keeps (A10): beyond the safe zone; off the Centrepiece's
    // footprint; never within RING_STILL + 1 walking tiles of the hall's reading tile.
    const keeps = (x, y, as) => {
      const d = (as || dist)(reach, x, y);
      if (d < 0 || d <= N.SAFE_ZONE) return false;
      if (plan.tiles[y][x] === 'C') return false;
      if (view) { const v = (as || dist)(view, x, y); if (v >= 0 && v <= N.RING_STILL + 1) return false; }
      return true;
    };
    // The walking distance to (x, y) once a case stands there, as a mimic's disguise will
    // (§8.2: 1 + the distance of its nearest neighbour you could step onto, a diagonal past a
    // corner included), from distances d on the map before it. It can be shorter than the
    // floor tile's own (a tile round a doorway's corner), so a mimic's tile keeps the rules
    // above as the case it becomes. Disguises only lengthen other ways, so this never
    // understates the distance in the department as it is made.
    const asCase = (d, x, y) => {
      let best = -1;
      for (let k = 0; k < 8; k++) {
        const nx = x + Grid.DX[k], ny = y + Grid.DY[k];
        if (!Grid.walkable(m, nx, ny)) continue;
        const v = d[ny * m.w + nx];
        if (v >= 0 && (best < 0 || v + 1 < best)) best = v + 1;
      }
      return best;
    };
    // Each room's floor tiles the rules keep, row-major, found once (no tile changes while
    // exhibits are placed); and which tiles an actor already covers (occ, by tile index).
    const floors = new Map(), occ = new Uint8Array(m.w * m.h);
    const floorOf = rm => {
      if (!floors.has(rm.id)) floors.set(rm.id, (tilesOf.get(rm.id) || []).filter(([x, y]) => m.tiles[y][x] === '.' && keeps(x, y)));
      return floors.get(rm.id);
    };
    // gapTo: each tile's Chebyshev distance to the nearest exhibit's tile, up to 3, the widest
    // spacing asked for.
    const gapTo = new Uint8Array(m.w * m.h).fill(3);
    const mark = a => {
      for (const [x, y] of Actors.footprint(a)) occ[y * m.w + x] = 1;
      if (a.uid === 'you') return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = a.x + dx, y = a.y + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
        if (Grid.inside(m, x, y) && d < gapTo[y * m.w + x]) gapTo[y * m.w + x] = d;
      }
    };
    for (const a of state.actors) mark(a);
    const covered = (x, y, but) => occ[y * m.w + x] === 1 && !(but && Actors.covers(but, x, y));
    const spaced = (x, y, gap) => gapTo[y * m.w + x] >= gap;
    const caseOk = f => f && f.k === 'case' && f.st === 'shut' && !f.loan && f.mimic === null && f.holds === null && !claimed.has(f.x + ',' + f.y);
    const realCase = f => f && f.k === 'case' && f.mimic === null;
    // The group's instance in its room (§4.1, plan DE5): one copy group a room, so a group two
    // galleries bring into one room is a fault of this plan.
    const groupOf = (sp, rm, gallery) => {
      if (!sp.group) return null;
      const name = `${sp.group}@${rm ? rm.key : 'room'}`;
      if (instances.has(name) && instances.get(name) !== gallery) return { clash: name };
      instances.set(name, gallery);
      return name;
    };
    const spawn = (sp, at, rm, gallery, opts) => {
      const g = groupOf(sp, rm, gallery);
      if (g && g.clash) return { reason: `two galleries put the copy group ${g.clash} in room ${rm.key}: one copy group a room`, tiles: [at] };
      const a = add(state, sp, at, counts, { group: g });
      mark(a);
      placed.push({ a, rm, opts });
      return null;
    };

    // The tiles of one set an exhibit may take, by spacing: those on no one at least 3 tiles
    // from every exhibit, then at least 2, then at least 1 (Chebyshev); the empty levels left out.
    const levels = tiles => {
      const free = tiles.filter(([x, y]) => !covered(x, y));
      return [3, 2, 1].map(gap => free.filter(([x, y]) => spaced(x, y, gap))).filter(p => p.length);
    };
    // A guarded case nearest (x, y) of nests (squared distance, then row-major).
    const nearest = (nests, x, y) => {
      const sq = ([gx, gy]) => (gx - x) * (gx - x) + (gy - y) * (gy - y);
      return nests.slice().sort((p, q) => (sq(p) - sq(q)) || rowMajor(p, q))[0];
    };
    const nestsIn = tiles => tiles.filter(([x, y]) => m.tiles[y][x] === 'v' && caseOk(Cases.at(state, x, y)) && takeOk(state, x, y));
    // The tiles the mimics placed so far will take as their disguises (at their init).
    const disguises = [];
    // The first exhibit not placed, which the attempt is rejected for; each one is logged.
    let first = null;
    const miss = (rm, no, what) => { say(rm, what ? `${no.reason}: ${what}` : no.reason); if (!first) first = no; };
    // A swarm's further bodies: the nearest tiles to its first of tiles (no draw), or null when
    // there are too few, checked before its first body stands, so a swarm is never part-made.
    const rest = (tiles, x, y) => {
      const near = tiles.filter(([tx, ty]) => !covered(tx, ty) && !(tx === x && ty === y))
        .sort((p, q) => (Grid.chebyshev(p[0], p[1], x, y) - Grid.chebyshev(q[0], q[1], x, y)) || rowMajor(p, q));
      return near.length < N.SWARM_BODIES[0] - 1 ? null : near.slice(0, N.SWARM_BODIES[0] - 1);
    };

    // One exhibit (a swarm's bodies) of entry e in room rm, on rm's exhibits stream: the tiles
    // its option asks for (an empty case, a tile beside a case, a tile within the tether of a
    // case it could guard), or, when none is left, the room's floor; kept by the rules above,
    // and as far from every exhibit as the set allows: one drawn from the widest level. A mimic
    // takes only a tile that keeps those rules as the case it becomes and whose disguise cuts
    // nothing off, counting the mimics placed before it: each level in turn, its tiles shuffled
    // on the stream, the first that does. Then a swarm's further bodies on the nearest such
    // floor tiles to the first (no draw). Returns null, or why it could not be placed (nothing
    // then stands).
    function placeOne(sp, e, rm, gallery) {
      const all = tilesOf.get(rm.id) || [], rng = Rng.stream(holder, `${base}/room/${rm.key}/exhibits`);
      const swarm = (sp.archetype || 'plodder') === 'mote_swarm';
      const fits = new Map(), fit = ([x, y]) => {
        const i = y * m.w + x;
        if (!fits.has(i)) fits.set(i, keeps(x, y, asCase) && !cuts(m, x, y, reach, disguises));
        return fits.get(i);
      };
      const mimic = (sp.archetype || 'plodder') === 'mimic_vitrine';
      const take = tiles => {
        const ls = levels(tiles);
        if (!mimic) return ls.length ? ls[0][rng.int(0, ls[0].length - 1)] : null;
        for (const pool of ls) { const t = rng.shuffle(pool).find(fit); if (t) return t; }
        return null;
      };
      const floor = floorOf(rm);
      let at = null, nests = null;
      if (e.case) {
        at = take(all.filter(([x, y]) => m.tiles[y][x] === 'v' && caseOk(Cases.at(state, x, y)) && keeps(x, y)));
        if (!at) say(rm, `${sp.id} found no empty case in ${rm.key} and stands on the floor`);
      } else if (e.near === 'case') {
        at = take(floor.filter(([x, y]) => { for (let k = 0; k < 8; k++) if (realCase(Cases.at(state, x + Grid.DX[k], y + Grid.DY[k]))) return true; return false; }));
        if (!at) say(rm, `${sp.id} found no tile beside a case in ${rm.key} and stands elsewhere in it`);
      } else if (e.apart) {
        // A herald kept apart (CP1 review): where its call (every tile within HERALD_RANGE)
        // reaches no exhibit placed before it, so its call wakes no one beside it.
        const others = state.actors.filter(o => o.uid !== 'you' && !o.gone);
        at = take(floor.filter(([x, y]) => !others.some(o => Actors.footprint(o).some(([u, v]) => Grid.disc(u - x, v - y, N.HERALD_RANGE)))));
        if (!at) say(rm, `${sp.id} found no tile in ${rm.key} out of call of every exhibit and stands elsewhere in it`);
      } else if (e.guards === 'case') {
        nests = nestsIn(all);
        at = take(floor.filter(([x, y]) => nests.some(([gx, gy]) => Grid.disc(x - gx, y - gy, N.TETHER_RANGE))));
        if (!at) { nests = null; say(rm, `${sp.id} found no case in ${rm.key} it could guard and guards its own tile`); }
      }
      if (!at) at = take(floor);
      const name = (pack.galleries[gallery] || {}).name || 'its gallery';
      if (!at) return { reason: `no tile in room ${rm.key} could take ${sp.id} (${name})`, tiles: [[rm.x0, rm.y0], [rm.x1, rm.y1]] };
      const more = swarm ? rest(floor, at[0], at[1]) : [];
      if (!more) return { reason: `room ${rm.key} has no room for the rest of the swarm ${sp.id} (${name})`, tiles: [at] };
      const opts = e.dir ? { dir: e.dir } : {};
      if (nests) opts.guards = nearest(nests, at[0], at[1]);
      const no = spawn(sp, at, rm, gallery, opts);
      if (no) return no;
      if (m.tiles[at[1]][at[0]] === 'v') claimed.add(at[0] + ',' + at[1]);
      if (opts.guards) claimed.add(opts.guards[0] + ',' + opts.guards[1]);
      if (mimic) disguises.push(at.slice());
      for (const t of more) spawn(sp, t, rm, gallery, {});
      return null;
    }

    // The Intro stamp (plan.intro): each mark whose letter the legend names an exhibit puts
    // that exhibit on its tile, in the marks' order, with no draw; a swarm's further bodies
    // take the nearest tiles of the Intro the rules keep. Where the stamp is the pack's own, the
    // Intro gallery's contents are then not placed again: the stamp is the Intro's (§5.2). The
    // fixture stamp, which every plan of a pack that gives none takes (layout version 3), names
    // no exhibit, so there the Intro gallery is placed as any other.
    const legend = pack.intro && pack.intro.legend, ownStamp = !!intro && !!pack.intro;
    if (intro) for (const mk of intro.marks) {
      const e = legend && own(legend, mk.ch) ? legend[mk.ch] : null, sp = e && e.sp !== undefined ? (pack.species || []).find(s => s.id === e.sp) : null;
      if (!sp) continue;
      const rm = roomById(m.roomOf[mk.y][mk.x]), at = [[mk.x, mk.y]];
      if (!ready(sp)) { say(rm, `${sp.id} (stamp ${mk.ch}) is not placed: its archetype, a modifier or its trigger is not ready`); continue; }
      if (!Grid.hold(m, mk.x, mk.y) || covered(mk.x, mk.y)) { miss(rm, { reason: `the stamp's ${mk.ch} at ${mk.x},${mk.y} is no free tile an exhibit can stand on`, tiles: at }, 'not placed'); continue; }
      const mimic = (sp.archetype || 'plodder') === 'mimic_vitrine', d = (mimic ? asCase : dist)(reach, mk.x, mk.y);
      if (d >= 0 && d <= N.SAFE_ZONE) { miss(rm, { reason: `the stamp puts ${sp.id} ${d} walking tiles from the entrance, inside the safe zone (${N.SAFE_ZONE})`, tiles: at }, 'not placed'); continue; }
      if (mimic && cuts(m, mk.x, mk.y, reach, disguises)) { miss(rm, { reason: `the stamp's ${mk.ch} at ${mk.x},${mk.y} would cut a way off as a mimic's case`, tiles: at }, 'not placed'); continue; }
      const more = (sp.archetype || 'plodder') === 'mote_swarm' ? rest(rm ? floorOf(rm) : [], mk.x, mk.y) : [];
      if (!more) { miss(rm, { reason: `the Intro has no room for the rest of the swarm ${sp.id}`, tiles: at }, 'not placed'); continue; }
      const opts = e.dir ? { dir: e.dir } : {};
      if (e.guards === 'case') {
        const nests = nestsIn(tilesOf.get(rm ? rm.id : 0) || []).filter(([x, y]) => Grid.disc(x - mk.x, y - mk.y, N.TETHER_RANGE));
        if (nests.length) { const g = nearest(nests, mk.x, mk.y); claimed.add(g[0] + ',' + g[1]); opts.guards = g; }
        else say(rm, `${sp.id} (stamp ${mk.ch}) found no case it could guard and guards its own tile`);
      }
      const no = spawn(sp, [mk.x, mk.y], rm, -1, opts);
      if (no) { miss(rm, no, 'not placed'); continue; }
      if (mimic) disguises.push([mk.x, mk.y]);
      for (const t of more) spawn(sp, t, rm, -1, {});
    }

    // Each gallery, in the pack's order, in the room it maps to: its entries in order, each
    // as many times as its count; an entry one of whose exhibits cannot be placed places no
    // more of them (the log says how many are missing), and the next entry goes on. Its room
    // keeps the gallery's index (dept.rooms[].galleries).
    const map = mapping(plan, pack);
    for (let i = 0; i < map.length; i++) {
      const g = pack.galleries[i], rm = roomById(map[i].room);
      const exhibitsIn = g.contents.filter(e => e.item === undefined).length;
      if (!rm) { say(null, `${g.name} (${g.key}) has no room in this plan${exhibitsIn ? ', so its exhibits are not placed' : ''}`); continue; }
      if (!rm.galleries) rm.galleries = [];
      rm.galleries.push(i);
      if (g.where && map[i].how !== 'where') say(rm, `${g.name} (${g.key}) names ${g.where}, which no section left has in this plan, and ${map[i].how === 'merged' ? 'joins' : 'takes'} room ${rm.key}`);
      else if (map[i].how === 'merged') say(rm, `${g.name} (${g.key}) joins room ${rm.key}`);
      if (g.key === 'intro' && ownStamp) { if (exhibitsIn) say(rm, `${g.name} (intro): the stamp places the Intro's exhibits, not its gallery`); continue; }
      for (const e of g.contents) {
        if (e.item !== undefined) continue;
        const sp = (pack.species || []).find(s => s.id === e.sp), n = e.count === undefined ? 1 : e.count;
        if (!ready(sp)) { say(rm, `${sp.id} (${g.name}) is not placed: its archetype, a modifier or its trigger is not ready`); continue; }
        for (let k = 0; k < n; k++) { const no = placeOne(sp, e, rm, i); if (no) { miss(rm, no, `${n - k} of ${n} not placed`); break; } }
      }
    }

    // What placement fixes with no draw, once every exhibit stands: what a warden guards, the
    // Waders' rounds (route {posts, i}), and then, with every Wader where it starts, a
    // station's line (route {dir}: lineDir, a run no exhibit stands on). A Wader's round
    // (CP1 review; decided without play, revisit once M4 is playable):
    //   - keeps to the half of its room farther from the Intro's onward openings (the room cut
    //     across its longer side; the whole room in a plan with no stamped Intro), so that no
    //     Wader walks past the Intro's mouth, from where it would see into the safe zone;
    //   - is its own: a room's k Waders cut that half into k strips across its longer side,
    //     the j-th Wader in spawn order taking the j-th (north to south, or west to east), as
    //     the sample gives each of its Waders a route of its own, with a line of tiles kept
    //     between two strips, so no two meet;
    //   - has for posts the free tiles nearest its strip's corners, north-west, north-east,
    //     south-east, south-west, each once, and the Wader starts the visit on the first;
    //   - leaves out a post the Wader's walk would stall on for good (its way there blocked
    //     only by exhibits that stand still: Patrol.timeline's stuck), or the post it started
    //     on if it never left it, and is fixed again without it, until every Wader walks its
    //     whole round;
    //   - when its strip gives it fewer than two posts, is the whole half's round instead
    //     (the free tiles nearest the half's corners), once.
    // A Wader left with fewer than two posts keeps no round (route null), which the log says.
    // No draw.
    const mouths = intro && Array.isArray(intro.openings) ? intro.openings : [];
    const walkers = new Map();
    for (const { a, rm, opts } of placed) {
      if (opts.guards) a.guards = opts.guards.slice();
      if (a.arch === 'patrol_guard' && rm) { if (!walkers.has(rm.id)) walkers.set(rm.id, { rm, list: [] }); walkers.get(rm.id).list.push(a); }
    }
    const rounds = [];
    for (const { rm, list } of walkers.values()) {
      const half = farHalf(rm, mouths), mine = (x, y) => list.some(a => Actors.covers(a, x, y));
      const postsOf = box => {
        const free = floorOf(rm).filter(([x, y]) => (!covered(x, y) || mine(x, y)) && x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3]), posts = [];
        for (const [cx, cy] of [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]]) {
          let best = null;
          for (const t of free) if (!best || Grid.chebyshev(t[0], t[1], cx, cy) < Grid.chebyshev(best[0], best[1], cx, cy)) best = t;
          if (best && !posts.some(p => p[0] === best[0] && p[1] === best[1])) posts.push(best.slice());
        }
        return posts;
      };
      // Its strip's round; one left with fewer than two posts, the whole half's (once).
      list.forEach((a, j) => rounds.push({ rm, a, posts: postsOf(strip(half, j, list.length)), wider: list.length > 1 ? () => postsOf(half) : null }));
    }
    const widen = r => { if (r.posts.length < 2 && r.wider) { r.posts = r.wider(); r.wider = null; say(r.rm, `${r.a.uid} walks the whole half's round: its strip's has fewer than two posts`); } };
    rounds.forEach(widen);
    // Each Wader on its first post, walking its round; or none.
    const walk = r => {
      if (r.posts.length < 2) { r.a.route = null; return; }
      r.a.x = r.posts[0][0]; r.a.y = r.posts[0][1]; r.a.home = r.posts[0].slice();
      r.a.route = { posts: r.posts.map(q => q.slice()), i: 0 };
    };
    rounds.forEach(walk);
    // The rounds are walked on the map as the visit will have it: each mimic's tile its case
    // already (its init makes it one), so the walk is the one the Wader will take.
    const mimics = state.actors.filter(a => !a.gone && a.arch === 'mimic_vitrine');
    const asMade = () => {
      if (!mimics.length) return state;
      const d = Object.assign({}, m, { tiles: m.tiles.slice() });
      for (const a of mimics) Grid.set(d, a.x, a.y, 'v');
      return Object.assign({}, state, { dept: d });
    };
    for (let tries = 0; rounds.length && tries < 4 * rounds.length; tries++) {
      const t = Patrol.timeline(asMade(), ROUND_TURNS), stuck = t ? t.filter(p => p.stuck) : [];
      if (!stuck.length) break;
      for (const p of stuck) {
        const r = rounds.find(q => q.a.uid === p.uid);
        if (!r || !r.a.route) continue;
        // One that never left the post it started on is walled in there: that post goes.
        const trapped = p.at.every(q => q.x === p.at[0].x && q.y === p.at[0].y);
        const gone = r.posts.splice(trapped ? 0 : p.stuck.post, 1)[0];
        say(r.rm, `${r.a.uid}'s round leaves out its post at ${gone[0]},${gone[1]}: its walk there would stall`);
        widen(r);
        walk(r);
      }
    }
    for (const r of rounds) if (r.posts.length < 2) miss(r.rm, { reason: `room ${r.rm.key} has no round for ${r.a.uid}`, tiles: [[r.a.x, r.a.y]] }, 'it keeps none');
    // The stations' lines last, once every Wader stands where it starts.
    for (const { a, opts } of placed) if (a.arch === 'demonstrator') a.route = { dir: opts.dir || lineDir(state, m, a) };
    return first;
  }
  // The turns over which the Waders' rounds are walked to see whether one stalls: three times
  // any round of a strip of a Cabinet room (its four posts at most about 40 steps apart in
  // all), since two Waders on rounds of their own may first meet on a later lap.
  const ROUND_TURNS = 120;
  // The j-th of k strips of a box [x0, y0, x1, y1], cut across its longer side (west to east
  // when it is at least as wide as it is tall, else north to south), as even as whole tiles
  // allow, each a tile short of where it meets the next, so that two Waders walking strips
  // side by side never stand in each other's way.
  function strip(b, j, k) {
    const wide = b[2] - b[0] >= b[3] - b[1], lo = wide ? b[0] : b[1], n = (wide ? b[2] : b[3]) - lo + 1;
    const from = lo + Int.idiv(j * n, k) + (j > 0 ? 1 : 0), to = lo + Int.idiv((j + 1) * n, k) - 1 - (j < k - 1 ? 1 : 0);
    return wide ? [from, b[1], to, b[3]] : [b[0], from, b[2], to];
  }
  // The half of a room's box [x0, y0, x1, y1] farther from the Intro's onward openings: the
  // room cut across its longer side (west and east halves when it is at least as wide as it is
  // tall), the half whose centre's nearest opening is farther (the first half on a tie); the
  // whole box when there are no openings.
  function farHalf(rm, mouths) {
    if (!mouths.length) return [rm.x0, rm.y0, rm.x1, rm.y1];
    const wide = rm.x1 - rm.x0 >= rm.y1 - rm.y0, mid = wide ? Int.idiv(rm.x0 + rm.x1, 2) : Int.idiv(rm.y0 + rm.y1, 2);
    const halves = wide ? [[rm.x0, rm.y0, mid, rm.y1], [mid + 1, rm.y0, rm.x1, rm.y1]] : [[rm.x0, rm.y0, rm.x1, mid], [rm.x0, mid + 1, rm.x1, rm.y1]];
    // Twice the distance, squared, from the half's centre to its nearest opening.
    const far = h => { let best = -1; for (const o of mouths) { const dx = h[0] + h[2] - 2 * o[0], dy = h[1] + h[3] - 2 * o[1], d = dx * dx + dy * dy; if (best < 0 || d < best) best = d; } return best; };
    return far(halves[1]) > far(halves[0]) ? halves[1] : halves[0];
  }
  // The post nearest a (Grid.chebyshev; the first on a tie).
  function nearestPost(posts, a) {
    let i = 0;
    for (let k = 1; k < posts.length; k++) if (Grid.chebyshev(posts[k][0], posts[k][1], a.x, a.y) < Grid.chebyshev(posts[i][0], posts[i][1], a.x, a.y)) i = k;
    return i;
  }

  // Place the pack's exhibits (§5.5): from its gallery list when it has one, else the
  // stand-in. base (the attempt's stream key, …/a<k>) names the room streams; log (the layout
  // attempt's log), given, gets population's notes. Returns null, or why this plan cannot be
  // populated as the list says, {reason, tiles} (never for the stand-in).
  function exhibits(state, plan, pack, base, log = null) {
    if (!pack || pack.galleries === undefined) { standIn(state, plan, pack); return null; }
    return fromGalleries(state, plan, pack, base, log);
  }

  // ---- The validators (M4 plan A10) ----

  const validators = [];
  // Register validator `id`, once: fn(state, plan, log) → null, or {reason, tiles} (a sentence
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
  // but null or {reason, tiles} is an error, so a fault in one is never read as a pass. log
  // (the layout attempt's), given, is handed to each validator.
  function validate(state, plan, log = null) {
    for (const v of validators) {
      const r = v.fn(state, plan, log);
      if (r === null) continue;
      if (!r || typeof r.reason !== 'string' || !r.reason || !Array.isArray(r.tiles)) throw new Error(`Populate.validate: ${v.id} answered ${JSON.stringify(r)}, not null or {reason, tiles}`);
      return { id: v.id, reason: r.reason, tiles: r.tiles.map(t => [t[0], t[1]]) };
    }
    return null;
  }

  // The galleries a gallery list placed in room roomId (its pack's records, in the pack's
  // order: the first names the room, and any after it joined it), or [] (§5.5). A room keeps
  // them as dept.rooms[].galleries, indices into its pack's list, only when a list filled it
  // (M4 plan A3).
  function galleriesOf(state, roomId) {
    const m = state && state.dept, rm = m && Array.isArray(m.rooms) ? m.rooms.find(r => r.id === roomId) : null;
    const pack = rm && Array.isArray(rm.galleries) ? Packs.get(m.acc) : null;
    return pack && Array.isArray(pack.galleries) ? rm.galleries.map(i => pack.galleries[i]).filter(g => !!g) : [];
  }
  // The gallery placed in room roomId, the one that names it, or null.
  function galleryOf(state, roomId) { return galleriesOf(state, roomId)[0] || null; }

  return { exhibits, ready, check, mapping, takeOk, addValidator, validatorIds, validate, galleryOf, galleriesOf };
})();
