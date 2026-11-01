// The packs as population places them (M4 plan D-PACKS; BUILD.md §5.2, §5.5), over the shared
// sweep (test/m4-sweep.test.js: seeds 1–100 of each department at each depth 1–7, as
// Dept.create makes them). For every department:
//   - counts: each room holds exactly the exhibits its galleries name (each entry `count`
//     times, a swarm as SWARM_BODIES[0] bodies a swarm), of the species past ready false
//     (Populate.ready), and the Intro exactly its stamp's marks of them; nothing else stands
//     anywhere, so a species that waits for its package is placed nowhere;
//   - groups: each copy group is one instance a room, <group>@<room key>, with exactly one
//     original and COPY_GROUP[0]–COPY_GROUP[1] members;
//   - encased originals: every exhibit a gallery puts in a case (`case: true`) stands in one,
//     which A.4.4's paragraph says ("kept under glass"), as A.4.1's does of its gallery's;
//   - the placement claims the packs' paragraphs make (CLAIMS here, which test/m4-packs.test.js
//     holds to the paragraphs);
//   - Signature presence: each pack's Centrepiece names an item of its pack, and that item
//     lies nowhere in the department as loot (no stand-in places it), nor does any item lie in
//     a case an exhibit stands in;
//   - the Intro lint: the Intro holds at most 3 exhibits, each flagged with nothing but its
//     department's signature module, and each fodder, a skirmisher or the signature's
//     teaching instance (BUILD.md §5.1);
//   - the safe zone: no exhibit within SAFE_ZONE walking tiles of the entrance;
//   - what D-LV6 will read: a Wader's wake region over its first SAFE_ZONE_TURNS turns
//     (Archetypes.wakeRegion) reaching a tile of the safe zone with every door of the
//     department open (and, on every fifth seed, as generated) is counted, on seeds 1–30 of
//     each depth; no warden's tether (TETHER_RANGE of what it guards, which needs no sight)
//     reaches a tile of the safe zone you could stand on; and a Heliograph's axis
//     (AXIS_RANGE along its row or column, in sight) reaching the safe zone with the doors
//     open is counted;
// and over the whole sweep: the Waders' and the axes' shares at most 5% of their departments,
// and S.9's Brooder guarding a case (its nest) in at least half of S.9's departments.
'use strict';
module.exports = C => {
  const { N, Grid, Populate, Packs, Cases, Archetypes, State } = C;
  // A pack's signature module: the one with role signature, else its first (§5.1).
  const signature = pack => (pack.modules.find(q => q.role === 'signature') || pack.modules[0]).id;
  const tally = { S9: 0, A4: 0, M11: 0, waderDepts: 0, wader: 0, axis: 0, nests: 0 }, WADER_SEEDS = 30;
  const bodies = sp => (sp.archetype === 'mote_swarm' ? N.SWARM_BODIES[0] : 1);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  // What keeps each placement claim a paragraph makes (test/m4-packs.test.js's CLAIMS): null,
  // or why it does not hold for exhibit a.
  const CLAIMS = {
    // A.4.4, "kept under glass": it stands in a case.
    'A4.4': (s, a) => (Cases.encased(s, a) && Cases.at(s, a.x, a.y) ? null : 'it is not under glass'),
    // M.11.12, its timetable "kept in the cabinet in front of it": a low cabinet on the tile its
    // line takes first.
    'M11.12': (s, a) => {
      const dir = a.route && a.route.dir, k = ['N', 'E', 'S', 'W'].indexOf(dir);
      return k >= 0 && s.dept.tiles[a.y + [-1, 0, 1, 0][k]][a.x + [0, 1, 0, -1][k]] === 'f' ? null : `no cabinet in front of it (${dir})`;
    },
  };

  // The tiles of the safe zone you could stand on: walking distance from the entrance at most
  // SAFE_ZONE (Grid.reachDist, as population measures it).
  function safeZone(m) {
    const d = Grid.distances(m, [m.entrance], m.w * m.h), out = new Uint8Array(m.w * m.h);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const v = Grid.reachDist(d, m, x, y);
      if (v >= 0 && v <= N.SAFE_ZONE && Grid.walkable(m, x, y)) out[y * m.w + x] = 1;
    }
    return out;
  }
  // The department with every closed door open (staff doors stay shut: they need a grade).
  function opened(state) {
    const s = State.clone(state);
    s.dept.tiles = s.dept.tiles.map(r => r.replace(/\+/g, "'"));
    return s;
  }
  // Does a's axis (the `axis` trigger: its row or column within AXIS_RANGE, in its sight)
  // hold a tile of the safe zone?
  function axisInto(s, a, safe) {
    const m = s.dept;
    for (let k = 0; k < 4; k++) {
      const dx = [0, 1, 0, -1][k], dy = [-1, 0, 1, 0][k];
      for (let n = 1; n <= N.AXIS_RANGE; n++) {
        const x = a.x + dx * n, y = a.y + dy * n;
        if (!Grid.inside(m, x, y)) break;
        if (safe[y * m.w + x] && !Grid.closedDoor(m, x, y) && Grid.los(m, a.x, a.y, x, y)) return true;
      }
    }
    return false;
  }
  // How many of each species the stamp's map marks (each row once; no exhibit stands on a
  // stretch row, Populate.check).
  function stampCounts(pack) {
    const out = {}, I = pack.intro;
    if (!I || !I.legend) return out;
    for (const ch of Object.keys(I.legend)) {
      const e = I.legend[ch];
      if (!e || e.sp === undefined) continue;
      out[e.sp] = (out[e.sp] || 0) + I.map.reduce((k, row) => k + row.slice(1).split(ch).length - 1, 0);
    }
    return out;
  }

  function each(d) {
    const { state: s, acc, seed } = d, m = s.dept, pack = Packs.get(acc), where = [];
    const roomOf = a => m.rooms.find(r => r.id === m.roomOf[a.y][a.x]);
    const ex = s.actors.filter(a => a.uid !== 'you' && a.role !== 'centrepiece');
    const spOf = id => pack.species.find(q => q.id === id);
    tally[acc]++;
    // Counts: what each room's galleries ask for, of the species that are ready.
    const want = new Map(), got = new Map();
    const add = (map, key, n) => map.set(key, (map.get(key) || 0) + n);
    for (const rm of m.rooms) {
      const gs = Populate.galleriesOf(s, rm.id);
      if (rm.role === 'intro' && pack.intro) {
        const marks = stampCounts(pack);
        for (const id of Object.keys(marks)) if (Populate.ready(spOf(id))) add(want, `${rm.key} ${id}`, marks[id] * bodies(spOf(id)));
        continue;
      }
      for (const g of gs) for (const e of g.contents) {
        if (e.item !== undefined || !Populate.ready(spOf(e.sp))) continue;
        add(want, `${rm.key} ${e.sp}`, (e.count === undefined ? 1 : e.count) * bodies(spOf(e.sp)));
      }
    }
    for (const a of ex) add(got, `${roomOf(a).key} ${a.sp}`, 1);
    const keys = [...new Set([...want.keys(), ...got.keys()])].sort();
    for (const k of keys) if ((want.get(k) || 0) !== (got.get(k) || 0)) where.push(`${k}: ${got.get(k) || 0} placed, ${want.get(k) || 0} listed`);
    // Copy groups: one instance a room, one original, COPY_GROUP in all.
    const inst = new Map();
    for (const a of ex) {
      const sp = spOf(a.sp);
      if (!sp || !sp.group) continue;
      if (a.group !== `${sp.group}@${roomOf(a).key}`) where.push(`${a.uid} is in ${a.group}, not ${sp.group}@${roomOf(a).key}`);
      if (!inst.has(a.group)) inst.set(a.group, []);
      inst.get(a.group).push(sp);
    }
    for (const [g, ms] of inst) {
      if (ms.filter(sp => !sp.copyOf).length !== 1) where.push(`${g} has ${ms.filter(sp => !sp.copyOf).length} originals`);
      if (ms.length < N.COPY_GROUP[0] || ms.length > N.COPY_GROUP[1]) where.push(`${g} has ${ms.length} members`);
    }
    // Encased: every exhibit its gallery puts in a case stands in one (§5.5: "on the floor if
    // none is left", which the maze never comes to).
    for (const a of ex) {
      const gs = Populate.galleriesOf(s, roomOf(a).id);
      if (gs.some(g => g.contents.some(e => e.sp === a.sp && e.case === true)) && !(Cases.encased(s, a) && Cases.at(s, a.x, a.y))) where.push(`${a.uid} (${a.sp}) is not in a case`);
    }
    // The placement claims of the packs' paragraphs (CLAIMS, test/m4-packs.test.js), each on
    // every exhibit of its species.
    for (const a of ex) if (own(CLAIMS, a.sp)) { const no = CLAIMS[a.sp](s, a); if (no) where.push(`${a.uid}: ${no}`); }
    // Signature presence, and no item in a case an exhibit stands in. The Signature piece is
    // never loot: a fight's comes only when its Centrepiece falls, and a treasure lies only in
    // a case of its hall (the item placement's treasure case, D-ITEMS).
    const cp = pack.centrepiece, sig = cp && cp.signature;
    if (!sig || !pack.items.some(it => it.id === sig)) where.push(`${acc}'s Centrepiece names no Signature piece of its pack`);
    for (const it of s.items) {
      const inHall = it.where.at === 'case' && m.rooms.some(r => r.role === 'centre' && r.id === m.roomOf[it.where.y][it.where.x]);
      if (it.ref === sig && it.where.at !== 'kit' && it.where.at !== 'tote' && !(cp.form === 'treasure' && inHall)) where.push(`its Signature piece lies at ${it.where.at} ${it.where.x},${it.where.y}`);
      if (it.where.at === 'case' && s.actors.some(a => a.uid !== 'you' && a.x === it.where.x && a.y === it.where.y)) where.push(`${it.uid} lies in a case with an exhibit`);
    }
    // The Intro lint.
    const intro = ex.filter(a => roomOf(a).role === 'intro'), SIG = signature(pack);
    if (intro.length > 3) where.push(`the Intro holds ${intro.length} exhibits`);
    for (const a of intro) {
      const sp = spOf(a.sp), flags = sp.flags || [];
      if (flags.some(f => f !== SIG)) where.push(`${a.uid} in the Intro is flagged ${flags.join(', ')}`);
      if (!(sp.role === 'fodder' || sp.role === 'skirmisher' || flags.includes(SIG))) where.push(`${a.uid} in the Intro is a ${sp.role}, not fodder, a skirmisher or the teaching instance`);
    }
    // The safe zone, and what LV6 will read.
    const safe = safeZone(m);
    for (const a of ex) if (safe[a.y * m.w + a.x]) where.push(`${a.uid} stands in the safe zone`);
    const waders = ex.filter(a => a.arch === 'patrol_guard'), axes = ex.filter(a => a.trigger === 'axis');
    // A Wader's region costs a few CPU-ms (MOD-ALARM), so it is measured on seeds 1–30 of each
    // depth (210 of S.9's 700), with the doors open, and as generated on every fifth of them;
    // D-LV6 reads it on every department it makes.
    const waderSeed = seed <= WADER_SEEDS;
    if ((waders.length && waderSeed) || axes.length) {
      const so = opened(s), reach = (st, a) => Archetypes.wakeRegion(st, st.actors.find(b => b.uid === a.uid), N.SAFE_ZONE_TURNS).some(([x, y]) => safe[y * m.w + x]);
      if (waders.length && waderSeed) {
        tally.waderDepts++;
        if (waders.some(a => reach(so, a) || (seed % 5 === 1 && reach(s, a)))) tally.wader++;
      }
      if (axes.some(a => axisInto(so, a, safe))) tally.axis++;
    }
    for (const a of ex.filter(q => q.arch === 'tethered_warden' && Array.isArray(q.guards))) {
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (safe[y * m.w + x] && Grid.disc(x - a.guards[0], y - a.guards[1], N.TETHER_RANGE)) { where.push(`${a.uid}'s tether reaches the safe zone at ${x},${y}`); y = m.h; break; }
      if (a.guards[0] !== a.x || a.guards[1] !== a.y) tally.nests++;
    }
    return where.length ? where.slice(0, 4).join('; ') : null;
  }

  function done() {
    const out = [];
    if (tally.wader * 20 > tally.waderDepts) out.push(`a Wader's wake region reaches the safe zone in ${tally.wader} of ${tally.waderDepts} S.9 departments, over 5%`);
    if (tally.M11 && tally.axis * 20 > tally.M11) out.push(`a Heliograph's axis reaches the safe zone with the doors open in ${tally.axis} of ${tally.M11} M.11 departments, over 5%`);
    if (tally.S9 && tally.nests * 2 < tally.S9) out.push(`S.9's Brooder has its nest in ${tally.nests} of ${tally.S9} departments, under half`);
    return out.length ? out.join('; ') : null;
  }
  return { each, done, tally, claims: Object.keys(CLAIMS).sort() };
};
