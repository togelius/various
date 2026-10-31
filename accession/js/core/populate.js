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
  // {sp, guards?, dir?}: it stands on each tile the plan marks with that letter.
  //
  // Populate.check(pack) → the problems with its gallery list and its stamp's exhibits, as
  // sentences ([] when there are none, or when it has no gallery list). Population refuses a
  // pack with any (an error), since each is a content fault no layout can mend.
  const KEYS = ['intro', 'centre', 'coda', 'last'];
  const ENTRY = ['sp', 'count', 'case', 'near', 'guards', 'dir'], ITEM = ['item', 'case'], LEGEND = ['sp', 'guards', 'dir'];
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
      if (e.guards !== undefined && !(e.guards === 'case' && arch(sp) === 'tethered_warden')) out.push(`${what}: guards is 'case', and only for a tethered_warden`);
      if (e.dir !== undefined && !(LINE_DIRS.includes(e.dir) && arch(sp) === 'demonstrator')) out.push(`${what}: dir is one of ${LINE_DIRS.join(', ')}, and only for a demonstrator`);
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
        if (e.case === true && (arch(sp) === 'mimic_vitrine' || (sp.size || 1) !== 1)) out.push(`${at}: ${sp.id} cannot stand in a case (a mimic is its own case; a case holds one tile)`);
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
      for (const ch of Object.keys(legend).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
        const e = legend[ch];
        if (!e || typeof e !== 'object' || e.sp === undefined) continue;
        const at = `${pack.acc}'s stamp legend ${JSON.stringify(ch)}`, sp = species(e.sp);
        if (!sp) { out.push(`${at} names ${JSON.stringify(e.sp)}, which is no species of ${pack.acc}`); continue; }
        if (Object.keys(e).some(k => !LEGEND.includes(k) && k !== 'tile')) out.push(`${at} gives an exhibit fields beyond sp, guards and dir (and its tile)`);
        options(at, e, sp);
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

  // Would a case on (x, y) cut any tile off from the entrance, or leave a case with no tile
  // beside it to stand on (layout's LV1 and LV10, run again for a mimic's disguise, plan
  // DE8)? reach is the walking distances from the entrance as the department stands.
  function cuts(m, x, y, reach) {
    const was = m.tiles[y];
    m.tiles[y] = was.slice(0, x) + 'v' + was.slice(x + 1);
    const d = Grid.distances(m, [m.entrance], 99999);
    m.tiles[y] = was;
    for (let i = 0; i < d.length; i++) if (reach[i] >= 0 && d[i] < 0 && i !== y * m.w + x) return true;
    for (let k = -1; k < 8; k++) {
      const cx = k < 0 ? x : x + Grid.DX[k], cy = k < 0 ? y : y + Grid.DY[k];
      if (!(k < 0 || Grid.ch(m, cx, cy) === 'v')) continue;
      let ok = false;
      for (let j = 0; j < 8 && !ok; j++) { const nx = cx + Grid.DX[j], ny = cy + Grid.DY[j]; if (Grid.inside(m, nx, ny) && !(nx === x && ny === y) && d[ny * m.w + nx] >= 0) ok = true; }
      if (!ok) return true;
    }
    return false;
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
  // tiles of its own room that sight passes: the longest of the four, the first in that order
  // on a tie. No draw.
  function lineDir(m, a) {
    let best = null, most = -1;
    for (const dir of LINE_DIRS) {
      const k = COMPASS.indexOf(dir), id = m.roomOf[a.y][a.x];
      let n = 0, x = a.x + Grid.DX[k], y = a.y + Grid.DY[k];
      while (Grid.inside(m, x, y) && m.roomOf[y][x] === id && Grid.seeThrough(m, x, y)) { n++; x += Grid.DX[k]; y += Grid.DY[k]; }
      if (n > most) { most = n; best = dir; }
    }
    return best;
  }

  // Place the exhibits of a pack's gallery list (§5.5), and return null when every one stood
  // where its list says, or why not, {reason, tiles}, which fails the layout attempt (Dept.create
  // takes it as the rejection `population`). log, given, gets a line for each thing worth
  // knowing that is no fault ({check: 'population', room, op}).
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
    const keeps = (x, y) => {
      const d = dist(reach, x, y);
      if (d < 0 || d <= N.SAFE_ZONE) return false;
      if (plan.tiles[y][x] === 'C') return false;
      if (view) { const v = dist(view, x, y); if (v >= 0 && v <= N.RING_STILL + 1) return false; }
      return true;
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

    // The tiles of one set an exhibit may take: on no one, and as far from every exhibit as
    // the set allows (3 or more tiles, else 2, else 1, Chebyshev).
    const spread = tiles => {
      const free = tiles.filter(([x, y]) => !covered(x, y));
      for (const gap of [3, 2, 1]) { const pool = free.filter(([x, y]) => spaced(x, y, gap)); if (pool.length) return pool; }
      return [];
    };
    // A guarded case nearest (x, y) of nests (squared distance, then row-major).
    const nearest = (nests, x, y) => {
      const sq = ([gx, gy]) => (gx - x) * (gx - x) + (gy - y) * (gy - y);
      return nests.slice().sort((p, q) => (sq(p) - sq(q)) || rowMajor(p, q))[0];
    };
    const nestsIn = tiles => tiles.filter(([x, y]) => m.tiles[y][x] === 'v' && caseOk(Cases.at(state, x, y)) && takeOk(state, x, y));

    // One exhibit (a swarm's first body) of entry e in room rm, on rm's exhibits stream: the
    // tiles its option asks for (an empty case, a tile beside a case, a tile within the tether
    // of a case it could guard), or, when none is left, the room's floor; kept by the rules
    // above and spread as far as the set allows; one drawn (a mimic: the set shuffled, and the
    // first whose disguise cuts nothing off). Then a swarm's further bodies on the nearest such
    // floor tiles to the first (no draw).
    function placeOne(sp, e, rm, gallery) {
      const all = tilesOf.get(rm.id) || [], rng = Rng.stream(holder, `${base}/room/${rm.key}/exhibits`);
      const mimic = (sp.archetype || 'plodder') === 'mimic_vitrine';
      const floor = floorOf(rm);
      let pool = [], nests = null;
      if (e.case) {
        pool = spread(all.filter(([x, y]) => m.tiles[y][x] === 'v' && caseOk(Cases.at(state, x, y)) && keeps(x, y)));
        if (!pool.length) say(rm, `${sp.id} found no empty case in ${rm.key} and stands on the floor`);
      } else if (e.near === 'case') {
        pool = spread(floor.filter(([x, y]) => { for (let k = 0; k < 8; k++) if (realCase(Cases.at(state, x + Grid.DX[k], y + Grid.DY[k]))) return true; return false; }));
        if (!pool.length) say(rm, `${sp.id} found no tile beside a case in ${rm.key} and stands elsewhere in it`);
      } else if (e.guards === 'case') {
        nests = nestsIn(all);
        pool = spread(floor.filter(([x, y]) => nests.some(([gx, gy]) => Grid.disc(x - gx, y - gy, N.TETHER_RANGE))));
        if (!pool.length) { nests = null; say(rm, `${sp.id} found no case in ${rm.key} it could guard and guards its own tile`); }
      }
      if (!pool.length) pool = spread(floor);
      let at = null;
      if (mimic) { rng.shuffle(pool); at = pool.find(([x, y]) => !cuts(m, x, y, reach)) || null; }
      else if (pool.length) at = pool[rng.int(0, pool.length - 1)];
      if (!at) return { reason: `no tile in room ${rm.key} could take ${sp.id} (${(pack.galleries[gallery] || {}).name || 'its gallery'})`, tiles: [[rm.x0, rm.y0], [rm.x1, rm.y1]] };
      if (m.tiles[at[1]][at[0]] === 'v') claimed.add(at[0] + ',' + at[1]);
      const opts = e.dir ? { dir: e.dir } : {};
      if (nests) { const g = nearest(nests, at[0], at[1]); claimed.add(g[0] + ',' + g[1]); opts.guards = g; }
      const no = spawn(sp, at, rm, gallery, opts);
      if (no) return no;
      if ((sp.archetype || 'plodder') !== 'mote_swarm') return null;
      const near = floor.filter(([x, y]) => !covered(x, y)).sort((p, q) => (Grid.chebyshev(p[0], p[1], at[0], at[1]) - Grid.chebyshev(q[0], q[1], at[0], at[1])) || rowMajor(p, q));
      if (near.length < N.SWARM_BODIES[0] - 1) return { reason: `room ${rm.key} has no room for the rest of the swarm ${sp.id}`, tiles: [at] };
      for (const t of near.slice(0, N.SWARM_BODIES[0] - 1)) { const n2 = spawn(sp, t, rm, gallery, {}); if (n2) return n2; }
      return null;
    }

    // The Intro stamp (plan.intro): each mark whose letter the legend names an exhibit puts
    // that exhibit on its tile, in the marks' order, with no draw; a swarm's further bodies
    // take the nearest tiles of the Intro the rules keep. The Intro gallery's own contents are
    // then not placed again: the stamp is the Intro's (§5.2).
    const legend = pack.intro && pack.intro.legend;
    if (intro) for (const mk of intro.marks) {
      const e = legend && own(legend, mk.ch) ? legend[mk.ch] : null, sp = e && e.sp !== undefined ? (pack.species || []).find(s => s.id === e.sp) : null;
      if (!sp) continue;
      const rm = roomById(m.roomOf[mk.y][mk.x]);
      if (!ready(sp)) { say(rm, `${sp.id} (stamp ${mk.ch}) is not placed: its archetype, a modifier or its trigger is not ready`); continue; }
      if (!Grid.hold(m, mk.x, mk.y) || covered(mk.x, mk.y)) return { reason: `the stamp's ${mk.ch} at ${mk.x},${mk.y} is no free tile an exhibit can stand on`, tiles: [[mk.x, mk.y]] };
      const d = dist(reach, mk.x, mk.y);
      if (d >= 0 && d <= N.SAFE_ZONE) return { reason: `the stamp puts ${sp.id} ${d} walking tiles from the entrance, inside the safe zone (${N.SAFE_ZONE})`, tiles: [[mk.x, mk.y]] };
      const opts = e.dir ? { dir: e.dir } : {};
      if (e.guards === 'case') {
        const nests = nestsIn(tilesOf.get(rm ? rm.id : 0) || []).filter(([x, y]) => Grid.disc(x - mk.x, y - mk.y, N.TETHER_RANGE));
        if (nests.length) { const g = nearest(nests, mk.x, mk.y); claimed.add(g[0] + ',' + g[1]); opts.guards = g; }
        else say(rm, `${sp.id} (stamp ${mk.ch}) found no case it could guard and guards its own tile`);
      }
      const no = spawn(sp, [mk.x, mk.y], rm, -1, opts);
      if (no) return no;
      if ((sp.archetype || 'plodder') === 'mote_swarm') {
        const near = (rm ? floorOf(rm) : []).filter(([x, y]) => !covered(x, y))
          .sort((p, q) => (Grid.chebyshev(p[0], p[1], mk.x, mk.y) - Grid.chebyshev(q[0], q[1], mk.x, mk.y)) || rowMajor(p, q));
        if (near.length < N.SWARM_BODIES[0] - 1) return { reason: `the Intro has no room for the rest of the swarm ${sp.id}`, tiles: [[mk.x, mk.y]] };
        for (const t of near.slice(0, N.SWARM_BODIES[0] - 1)) { const n2 = spawn(sp, t, rm, -1, {}); if (n2) return n2; }
      }
    }

    // Each gallery, in the pack's order, in the room it maps to: its entries in order, each
    // as many times as its count. Its room keeps the gallery's index (dept.rooms[].galleries).
    const map = mapping(plan, pack);
    for (let i = 0; i < map.length; i++) {
      const g = pack.galleries[i], rm = roomById(map[i].room);
      if (!rm) { say(null, `${g.name} (${g.key}) has no room in this plan`); continue; }
      if (!rm.galleries) rm.galleries = [];
      rm.galleries.push(i);
      if (map[i].how === 'merged') say(rm, `${g.name} (${g.key}) joins room ${rm.key}`);
      if (g.key === 'intro' && intro) continue;
      for (const e of g.contents) {
        if (e.item !== undefined) continue;
        const sp = (pack.species || []).find(s => s.id === e.sp);
        if (!ready(sp)) { say(rm, `${sp.id} (${g.name}) is not placed: its archetype, a modifier or its trigger is not ready`); continue; }
        for (let k = 0; k < (e.count === undefined ? 1 : e.count); k++) { const no = placeOne(sp, e, rm, i); if (no) return no; }
      }
    }

    // What placement fixes with no draw, once every exhibit stands: a station's line (route
    // {dir}), a Wader's round (route {posts, i}: the free tiles nearest its room's corners,
    // north-west, north-east, south-east, south-west, each once, starting at the post nearest
    // it), and what a warden guards.
    for (const { a, rm, opts } of placed) {
      if (opts.guards) a.guards = opts.guards.slice();
      if (a.arch === 'demonstrator') a.route = { dir: opts.dir || lineDir(m, a) };
      if (a.arch !== 'patrol_guard' || !rm) continue;
      const free = floorOf(rm).filter(([x, y]) => !covered(x, y, a));
      const posts = [];
      for (const [cx, cy] of [[rm.x0, rm.y0], [rm.x1, rm.y0], [rm.x1, rm.y1], [rm.x0, rm.y1]]) {
        let best = null;
        for (const t of free) if (!best || Grid.chebyshev(t[0], t[1], cx, cy) < Grid.chebyshev(best[0], best[1], cx, cy)) best = t;
        if (best && !posts.some(p => p[0] === best[0] && p[1] === best[1])) posts.push(best.slice());
      }
      if (posts.length < 2) return { reason: `room ${rm.key} has no round for ${a.uid}`, tiles: [[a.x, a.y]] };
      let i = 0;
      for (let k = 1; k < posts.length; k++) if (Grid.chebyshev(posts[k][0], posts[k][1], a.x, a.y) < Grid.chebyshev(posts[i][0], posts[i][1], a.x, a.y)) i = k;
      a.route = { posts, i };
    }
    return null;
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
