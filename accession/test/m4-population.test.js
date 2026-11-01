// M4's population (M4 plan A10, D-POP; BUILD.md §3.2, §4.1, §5.2, §5.5): placing a pack's
// exhibits from its gallery list. Mapping galleries onto rooms by programme element, then
// tour order; each room's exhibits on its own stream; counts, encased exhibits and copy-group
// instances; Wader rounds, station lines, what a warden guards and the Intro stamp's marks,
// none of them drawing; the placement rules (the safe zone, the hall's reading tile, the
// Centrepiece's footprint, no mimic in the hall and none cutting a way off, the take tile);
// readiness; plain data, clones, `without` and independence of rulesOff; and Dept.generate,
// which says how a department was made.
//
// The real packs have no gallery list until D-PACKS, so these tests give fixture galleries to
// the real packs (in a core of their own). That core takes away the packs' own Intro stamps
// (content/*-intro.js, D-STAMPS), so its plans take the generator's fixture stamp, which names
// no exhibit, and gives M11 a stamp of its own where a test needs one; test/m4-intro.test.js
// places the packs' own stamps' exhibits. The expected figures are worked out here from the
// plan's and BUILD's text, never from the rule code.
'use strict';
module.exports = ({ test, assert, loadCore }) => {
  const json = x => JSON.stringify(x);
  const ACCS = ['S9', 'A4', 'M11'];
  const SEEDS = 100;
  const depthOf = seed => 1 + ((seed - 1) % 7);

  // Fixture gallery lists, after design/samples.md §§2–4, sized for today's plans: the Intro's
  // exhibits come from its stamp, so S.9's and A.4's Intro galleries hold none here.
  const GALLERIES = {
    S9: [
      { key: 'intro', name: 'The Lamp Corridor', contents: [] },
      { key: 's1', where: 'central', name: 'The Mount Court', contents: [{ sp: 'S9.1' }, { sp: 'S9.2' }, { sp: 'S9.3' }, { sp: 'S9.6', count: 2 }] },
      { key: 's2', where: 'band', name: 'The Brooders\' Bay', contents: [{ sp: 'S9.4', guards: 'case' }, { sp: 'S9.5', near: 'case' }, { sp: 'S9.2' }] },
      { key: 'last', name: 'The Round-Book Room', contents: [{ sp: 'S9.6' }] },
      { key: 'centre', name: 'The Day Curator\'s Case', contents: [{ sp: 'S9.1', count: 2 }] },
      { key: 'coda', name: 'The Night Staff\'s Tea Room', contents: [] },
    ],
    A4: [
      { key: 'intro', name: 'The Office Counter', contents: [] },
      { key: 's1', where: 'central', name: 'Originals Under Glass', contents: [{ sp: 'A4.1', case: true }, { sp: 'A4.1a', count: 3 }, { sp: 'A4.4', case: true }, { sp: 'A4.4a', count: 2 }, { sp: 'A4.5' }] },
      { key: 's2', where: 'band', name: 'The Copying Room', contents: [{ sp: 'A4.2', count: 2 }, { sp: 'A4.3' }, { item: 'A4.6', case: true }] },
      { key: 'centre', name: 'The Lectern Hall', contents: [] },
      { key: 'coda', name: 'The Forms Counter', contents: [] },
    ],
    M11: [
      { key: 'intro', name: 'The First Landing', contents: [{ sp: 'M11.5' }] },
      { key: 's1', name: 'The Line, rooms 1–3', contents: [{ sp: 'M11.1', count: 2 }, { sp: 'M11.3' }] },
      { key: 's2', name: 'Weather Kept for Trials', contents: [{ sp: 'M11.4' }, { sp: 'M11.3' }, { sp: 'M11.2' }] },
      { key: 'last', name: 'The Logbook Room', contents: [{ sp: 'M11.5' }] },
      { key: 'centre', name: 'The Central Station', contents: [] },
      { key: 'coda', name: 'The Linesmen\'s Canteen', contents: [] },
    ],
  };
  const M4_READY = { ARCHETYPES: ['unobserved_mover', 'patrol_guard', 'demonstrator', 'conservator_healer'], MODIFIERS: ['clockwork'], TRIGGERS: ['period'] };

  // A core whose real packs carry the fixture galleries and no stamp of their own (the fixture
  // stamp's Intro); with every M4 species' archetype,
  // modifier and trigger set past ready false when ready is true. Populate.exhibits is watched
  // so a test sees the plan each attempt was populated from (the last is the department's).
  function core(ready, galleries) {
    const X = loadCore(), plans = [];
    for (const acc of ACCS) { X.Packs.get(acc).galleries = JSON.parse(json((galleries || GALLERIES)[acc])); delete X.Packs.get(acc).intro; }
    if (ready) for (const t of ['ARCHETYPES', 'MODIFIERS', 'TRIGGERS']) for (const id of M4_READY[t]) X.Registry[t][id].ready = 'unit';
    const real = X.Populate.exhibits;
    X.Populate.exhibits = (state, plan, pack, base, log) => { plans.push(plan); return real(state, plan, pack, base, log); };
    return { X, plans };
  }
  const exhibitsOf = s => s.actors.filter(a => a.uid !== 'you');
  const roomAt = (s, x, y) => s.dept.rooms.find(r => r.id === s.dept.roomOf[y][x]) || null;
  const bodies = (X, sp) => (sp.archetype === 'mote_swarm' ? X.N.SWARM_BODIES[0] : 1);

  // ---- Mapping (§5.5; plan D2.2) ----

  test('galleries map onto rooms by role, then a section gallery\'s programme element, then tour order; extras and the study\'s contents join the last section', () => {
    const X = loadCore();
    const room = (id, key, role, tags) => ({ id, key, role, tags });
    const plan = { rooms: [room(1, 'intro', 'intro', []), room(2, 's1', 'section', ['band']), room(3, 's2', 'section', ['central', 'filled']), room(4, 's3', 'section', ['row']),
      room(5, 'centre', 'centre', ['apse']), room(6, 'coda', 'coda', ['band']), room(7, 'staff', 'staff', ['staff'])] };
    const g = (key, where) => Object.assign({ key, name: key, contents: [] }, where ? { where } : {});
    // The galleries that name an element claim first, in the list's order: s1 the court (tour
    // room s2), s3 the band section (s1; the coda is a band room too, but no section), s4 the
    // row (s3). Then s2, which names none, finds every section taken and joins the last section
    // in tour order (s3), as the study's contents ('last') do.
    const pack = { galleries: [g('coda'), g('s1', 'central'), g('s2'), g('s3', 'band'), g('s4', 'row'), g('last'), g('intro'), g('centre')] };
    assert.equal(json(X.Populate.mapping(plan, pack)), json([{ room: 6, how: 'role' }, { room: 3, how: 'where' }, { room: 4, how: 'merged' }, { room: 2, how: 'where' },
      { room: 4, how: 'where' }, { room: 4, how: 'merged' }, { room: 1, how: 'role' }, { room: 5, how: 'role' }]));
    // A plain gallery takes the first section left in tour order; an element no section has
    // falls back to tour order too.
    assert.equal(json(X.Populate.mapping(plan, { galleries: [g('s1'), g('s2', 'apse'), g('s3')] })), json([{ room: 2, how: 'tour' }, { room: 3, how: 'tour' }, { room: 4, how: 'tour' }]));
    // A where-gallery claims before a plain one, even later in the list: tour order is the fallback.
    assert.equal(json(X.Populate.mapping(plan, { galleries: [g('s1'), g('s2', 'row')] }).map(m => m.room)), json([2, 4]));
    // Over real plans the court and the labyrinth hold their gallery whichever tour key they get
    // (map-DEPTS P3: tour order alone sent it to the band room in a third of S.9's seeds at layout
    // version 2; at version 3, whose wider Intro puts a band room first in the tour, it does so in
    // every seed). The same list with its where taken away, mapped by tour order alone, sends the
    // court's gallery elsewhere in those seeds, so the where is what holds it there.
    const keys = { S9: new Set(), A4: new Set() }, astray = { S9: 0, A4: 0 };
    const plain = acc => ({ galleries: GALLERIES[acc].map(g => { const c = Object.assign({}, g); delete c.where; return c; }) });
    for (const acc of ['S9', 'A4']) for (let seed = 1; seed <= 60; seed++) {
      const p = X.Layout.generate(X.Packs.get(acc).programme, 0, seed, { acc, depth: depthOf(seed) }).plan, m = X.Populate.mapping(p, { galleries: GALLERIES[acc] });
      const central = p.rooms.find(r => r.tags.includes('central')), band = p.rooms.find(r => r.role === 'section' && r.tags.includes('band'));
      assert.equal(m[1].room, central.id, `${acc} seed ${seed}`);
      assert.equal(m[2].room, band.id, `${acc} seed ${seed}`);
      keys[acc].add(central.key);
      const t = X.Populate.mapping(p, plain(acc));
      assert.equal(t[1].room === central.id, central.key === 's1', `${acc} seed ${seed}: tour order alone takes the central room exactly when it is s1`);
      if (t[1].room !== central.id) astray[acc]++;
    }
    for (const acc of ['S9', 'A4']) assert.ok(astray[acc] > 0 && keys[acc].has('s2'), `${acc}: tour order alone sends the court's gallery astray in ${astray[acc]} of 60 seeds (the central room's tour keys: ${[...keys[acc]].sort().join(', ')})`);
  });

  // ---- The sweep: 100 seeds of each department, depths 1–7 ----

  // Every department of the sweep, built once with the fixture galleries and every M4 species
  // ready: {acc, seed, depth, out (Dept.generate's), plan (the one it was populated from)}.
  let sweep = null;
  function built() {
    if (sweep) return sweep;
    const { X, plans } = core(true);
    const list = [];
    for (const acc of ACCS) for (let seed = 1; seed <= SEEDS; seed++) {
      plans.length = 0;
      const depth = depthOf(seed), out = X.Dept.generate(seed, acc, depth);
      list.push({ acc, seed, depth, out, plan: plans[plans.length - 1] });
    }
    return (sweep = { X, list });
  }

  test('on 100 seeds of each department, every gallery entry stands in its room, in its count, and nothing else is placed', () => {
    const { X, list } = built();
    let fallbacks = 0, first = 0;
    for (const d of list) {
      const s = d.out.state, pack = X.Packs.get(d.acc), where = `${d.acc} seed ${d.seed}`;
      if (d.out.fallback) { fallbacks++; continue; }
      if (d.out.attempt === 0) first++;
      // The rooms, as the gallery list's keys say (§5.5), worked out from the plan's tags.
      const sections = d.plan.rooms.filter(r => r.role === 'section').sort((a, b) => Number(a.key.slice(1)) - Number(b.key.slice(1)));
      const want = new Map();
      const roomFor = g => {
        if (['intro', 'centre', 'coda'].includes(g.key)) return d.plan.rooms.find(r => r.role === g.key);
        if (g.key === 'last') return sections[sections.length - 1];
        if (g.where) return sections.find(r => r.tags.includes(g.where));
        return sections[Number(g.key.slice(1)) - 1];
      };
      for (const g of pack.galleries) {
        const rm = roomFor(g), list2 = want.get(rm.id) || [];
        for (const e of g.contents) if (e.sp) { const sp = pack.species.find(q => q.id === e.sp); for (let k = 0; k < (e.count || 1) * bodies(X, sp); k++) list2.push(e.sp); }
        want.set(rm.id, list2);
        assert.ok(s.dept.rooms.find(r => r.id === rm.id).galleries.includes(pack.galleries.indexOf(g)), `${where}: room ${rm.key} keeps ${g.name}`);
        assert.ok(X.Populate.galleriesOf(s, rm.id).includes(g), where);
      }
      for (const rm of s.dept.rooms) {
        const got = exhibitsOf(s).filter(a => roomAt(s, a.x, a.y) === rm).map(a => a.sp).sort();
        assert.equal(json(got), json((want.get(rm.id) || []).slice().sort()), `${where}: room ${rm.key}`);
        if (!want.has(rm.id)) assert.ok(!('galleries' in rm) && X.Populate.galleryOf(s, rm.id) === null, `${where}: ${rm.key} has no gallery`);
      }
      assert.equal(X.Populate.galleryOf(s, d.plan.rooms.find(r => r.role === 'centre').id), pack.galleries.find(g => g.key === 'centre'));
    }
    // A plan the list cannot fill is reseeded (counted in D-RUNNER's gate, A1.4); here at most 1%
    // of departments fall back, and most take their first plan.
    assert.ok(fallbacks <= list.length / 100, `${fallbacks} fallbacks of ${list.length}`);
    assert.ok(first >= list.length * 80 / 100, `${first} of ${list.length} at the first attempt`);
  });

  test('each exhibit\'s uid is <acc>.<depth>.<room>.<n>, n per room in placement order, and its group the copy group\'s instance in that room, one original a group', () => {
    const { X, list } = built();
    let instances = 0;
    for (const d of list) {
      const s = d.out.state, pack = X.Packs.get(d.acc), count = {}, groups = new Map();
      for (const a of exhibitsOf(s)) {
        const key = roomAt(s, a.x, a.y).key, sp = pack.species.find(q => q.id === a.sp);
        count[key] = (count[key] || 0) + 1;
        assert.equal(a.uid, `${d.acc}.${d.depth}.${key}.${count[key]}`);
        assert.equal(a.group, sp.group ? `${sp.group}@${key}` : null, a.uid);
        if (a.group) { if (!groups.has(a.group)) groups.set(a.group, []); groups.get(a.group).push(sp); }
      }
      for (const [name, members] of groups) {
        const spares = members.filter(sp => sp.copyOf);
        if (!spares.length) continue;
        instances++;
        assert.equal(members.filter(sp => sp.id === spares[0].copyOf).length, 1, `${d.acc} seed ${d.seed}: ${name} has one original`);
        assert.ok(members.length >= X.N.COPY_GROUP[0] && members.length <= X.N.COPY_GROUP[1], `${name}: ${members.length}`);
      }
    }
    assert.ok(instances >= 2 * SEEDS * 95 / 100, `${instances} copy-group instances in A.4`);
  });

  test('the placement rules hold on every department: the safe zone, the reading tile\'s still ring, the footprint, encased originals, and no way cut off', () => {
    const { X, list } = built(), { Grid, N } = X;
    let encased = 0, originals = 0;
    for (const d of list) {
      const s = d.out.state, m = s.dept, where = `${d.acc} seed ${d.seed}`;
      const from = Grid.distances(m, [m.entrance], 9999), view = Grid.distances(m, [d.plan.viewTile], 9999);
      for (const a of exhibitsOf(s)) {
        assert.ok(Grid.reachDist(from, m, a.x, a.y) > N.SAFE_ZONE, `${where}: ${a.uid} is in the safe zone`);
        const v = Grid.reachDist(view, m, a.x, a.y);
        assert.ok(v < 0 || v > N.RING_STILL + 1, `${where}: ${a.uid} is ${v} walking tiles from the reading tile`);
        assert.notEqual(d.plan.tiles[a.y][a.x], 'C', `${where}: ${a.uid} on the Centrepiece's footprint`);
        assert.equal(exhibitsOf(s).filter(b => b.x === a.x && b.y === a.y).length, 1, `${where}: one exhibit a tile`);
        if (a.sp === 'A4.1' || a.sp === 'A4.4') {
          originals++;
          const f = X.Cases.at(s, a.x, a.y);
          if (m.tiles[a.y][a.x] === 'v') { encased++; assert.ok(f && f.k === 'case' && f.mimic === null && !f.loan, `${where}: ${a.uid}'s case`); }
        }
      }
      // A mimic's disguise (made at its init, after population) cuts no tile off from the
      // entrance, and leaves every case a tile beside it to stand on (LV1, LV10 again: DE8).
      const before = d.plan.tiles.map(r => r.replace(/C/g, '.')), was = Grid.distances(Object.assign({}, m, { tiles: before }), [m.entrance], 9999);
      for (let i = 0; i < was.length; i++) {
        const x = i % m.w, y = (i - x) / m.w;
        if (was[i] >= 0 && m.tiles[y][x] !== 'v') assert.ok(from[i] >= 0, `${where}: ${x},${y} is cut off`);
      }
      for (const f of m.fixtures) if (f.k === 'case' && m.tiles[f.y][f.x] === 'v') assert.ok(Grid.reachDist(from, m, f.x, f.y) >= 0, `${where}: the case at ${f.x},${f.y} cannot be reached`);
    }
    // The labyrinth holds cases enough: almost every original stands in one (the rest on the floor).
    assert.ok(encased >= originals * 90 / 100, `${encased} of ${originals} originals encased`);
  });

  test('a Wader\'s round, a station\'s line and what a warden guards are fixed from the room, with no draw', () => {
    const { X, list } = built(), { Grid, N } = X;
    const LINE = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
    let rounds = 0, lines = 0, nests = 0, wardens = 0;
    for (const d of list) {
      const s = d.out.state, m = s.dept, where = `${d.acc} seed ${d.seed}`, from = Grid.distances(m, [m.entrance], 9999);
      for (const a of exhibitsOf(s)) {
        const rm = roomAt(s, a.x, a.y);
        if (a.arch === 'patrol_guard') {
          rounds++;
          // Its round (CP1 review): the half of its room farther from the Intro's onward
          // openings (the room cut across its longer side), the j-th of the k strips of it its
          // room's k Waders take in spawn order (cut across the half's longer side, each a tile
          // short of the next); its posts the floor tiles of the room beyond the safe zone and
          // the reading tile's ring that no exhibit but its room's Waders stands on, nearest
          // that strip's corners (NW, NE, SE, SW), each once, less those the log says it left
          // out (its walk there would stall); it starts on the first.
          const ops = d.plan.intro ? d.plan.intro.openings : [], mates = exhibitsOf(s).filter(b => b.arch === 'patrol_guard' && roomAt(s, b.x, b.y) === rm);
          const cut = (b, j, k) => { const wide = b[2] - b[0] >= b[3] - b[1], lo = wide ? b[0] : b[1], n = (wide ? b[2] : b[3]) - lo + 1, from = lo + Math.floor(j * n / k) + (j > 0 ? 1 : 0), to = lo + Math.floor((j + 1) * n / k) - 1 - (j < k - 1 ? 1 : 0); return wide ? [from, b[1], to, b[3]] : [b[0], from, b[2], to]; };
          let half = [rm.x0, rm.y0, rm.x1, rm.y1];
          if (ops.length) {
            const wide = rm.x1 - rm.x0 >= rm.y1 - rm.y0, mid = Math.floor((wide ? rm.x0 + rm.x1 : rm.y0 + rm.y1) / 2);
            const hs = wide ? [[rm.x0, rm.y0, mid, rm.y1], [mid + 1, rm.y0, rm.x1, rm.y1]] : [[rm.x0, rm.y0, rm.x1, mid], [rm.x0, mid + 1, rm.x1, rm.y1]];
            const gap = h => Math.min(...ops.map(o => (h[0] + h[2] - 2 * o[0]) ** 2 + (h[1] + h[3] - 2 * o[1]) ** 2));
            half = gap(hs[1]) > gap(hs[0]) ? hs[1] : hs[0];
          }
          const box = cut(half, mates.indexOf(a), mates.length), free = [];
          for (let y = box[1]; y <= box[3]; y++) for (let x = box[0]; x <= box[2]; x++) {
            if (m.roomOf[y][x] !== rm.id || d.plan.tiles[y][x] !== '.' || from[y * m.w + x] <= N.SAFE_ZONE) continue;
            if (exhibitsOf(s).some(b => !mates.includes(b) && b.x === x && b.y === y)) continue;
            const v = Grid.distances(m, [d.plan.viewTile], N.RING_STILL + 1)[y * m.w + x];
            if (v >= 0) continue;
            free.push([x, y]);
          }
          const posts = [];
          for (const [cx, cy] of [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]]) {
            const best = free.reduce((b, t) => (!b || Grid.chebyshev(t[0], t[1], cx, cy) < Grid.chebyshev(b[0], b[1], cx, cy) ? t : b), null);
            if (best && !posts.some(p => json(p) === json(best))) posts.push(best);
          }
          const left = (d.out.log || []).filter(l => l.op && l.op.startsWith(`${a.uid}'s round leaves out its post at `)).map(l => l.op.split(' at ')[1].split(':')[0]);
          const kept = posts.filter(p => !left.includes(`${p[0]},${p[1]}`));
          assert.equal(json(a.route), json({ posts: kept, i: 0 }), `${where}: ${a.uid}'s round`);
          assert.equal(json([a.x, a.y]), json(kept[0]), `${where}: ${a.uid} starts on its first post`);
        } else if (a.arch === 'demonstrator') {
          lines++;
          // The longest run of its room that sight passes and no other exhibit stands on (N, E,
          // S, W on a tie), else the longest (M4's first integration review); the Intro's
          // station takes its stamp's, which is its longest.
          const DIRS = ['N', 'E', 'S', 'W'];
          const tiles = dir => { const out = []; let x = a.x + LINE[dir][0], y = a.y + LINE[dir][1]; while (m.roomOf[y] && m.roomOf[y][x] === rm.id && Grid.TILES[m.tiles[y][x]].see) { out.push([x, y]); x += LINE[dir][0]; y += LINE[dir][1]; } return out; };
          const run = dir => tiles(dir).length, met = dir => tiles(dir).some(([x, y]) => s.actors.some(b => b !== a && !b.gone && b.x === x && b.y === y));
          const pick = ks => { const most = Math.max(...ks.map(run)); return ks.find(k => run(k) === most); };
          const clear = a.uid.includes('.intro.') ? [] : DIRS.filter(k => !met(k) && run(k) > 0);
          assert.equal(json(a.route), json({ dir: clear.length ? pick(clear) : pick(DIRS) }), `${where}: ${a.uid}'s line`);
          if (!a.uid.includes('.intro.') && clear.length) assert.ok(!met(a.route.dir), `${where}: ${a.uid}'s line meets an exhibit though a clear one exists`);
        } else assert.equal(a.route, null, `${where}: ${a.uid} has no route`);
        if (a.arch === 'tethered_warden') {
          wardens++;
          const [gx, gy] = a.guards;
          if (gx === a.x && gy === a.y) continue;
          nests++;
          const f = X.Cases.at(s, gx, gy);
          assert.ok(f && f.k === 'case' && !f.loan && f.mimic === null && roomAt(s, gx, gy) === rm, `${where}: ${a.uid} guards a case of its room`);
          assert.ok(Grid.disc(a.x - gx, a.y - gy, N.TETHER_RANGE), `${where}: ${a.uid} stands within its tether`);
          // No tile you could take from is a step from outside its tether (A10).
          for (let k = -1; k < 8; k++) {
            const tx = k < 0 ? gx : gx + Grid.DX[k], ty = k < 0 ? gy : gy + Grid.DY[k];
            if (!Grid.walkable(m, tx, ty)) continue;
            for (let j = 0; j < 8; j++) if (Grid.canStep(m, tx, ty, j)) assert.ok(Grid.disc(tx + Grid.DX[j] - gx, ty + Grid.DY[j] - gy, N.TETHER_RANGE), `${where}: ${tx},${ty} is a step from outside the tether`);
          }
        }
      }
      // What the log says of a warden that found no case it could guard.
      for (const a of exhibitsOf(s).filter(b => b.arch === 'tethered_warden' && b.guards[0] === b.x && b.guards[1] === b.y)) {
        assert.ok(d.out.log.some(l => l.check === 'population' && l.op === `${a.sp} found no case in ${roomAt(s, a.x, a.y).key} it could guard and guards its own tile`), `${where}: ${a.uid}`);
      }
    }
    assert.ok(rounds >= 2 * SEEDS * 95 / 100 && lines >= SEEDS * 95 / 100 && wardens >= SEEDS * 95 / 100, `${rounds} rounds, ${lines} lines, ${wardens} wardens`);
    // A note for D-PACKS (BUILD §5.5): at TETHER_RANGE 2 a case passes the take rule only in a nook.
    assert.ok(nests >= 0);
  });

  test('a department with a gallery list is plain data and clone-stable, and removing an exhibit leaves every other one as it was', () => {
    const { X, list } = built(), { State } = X;
    for (const d of list.filter(q => q.seed <= 10)) {
      const s = d.out.state;
      assert.equal(State.plainData(s), null, `${d.acc} seed ${d.seed}`);
      assert.equal(State.hash(State.clone(s)), State.hash(s));
    }
    // Every other actor is compared whole; the one removed keeps who and where it is, and is
    // gone. (It is not compared whole: a removed exhibit gets no archetype init, so a removed
    // warden guards nothing, where the one present guards its own tile.) Every exhibit is
    // removed in turn, wardens, stations and patrols among them.
    const fields = a => [a.uid, a.sp, a.x, a.y, a.group, a.route, a.guards, a.home, a.gone || 0];
    let removals = 0;
    const kinds = new Set();
    for (const [acc, seed] of [['S9', 3], ['A4', 4], ['M11', 5]]) {
      const base = X.Dept.create(seed, acc, depthOf(seed));
      for (const gone of exhibitsOf(base)) {
        const s = X.Dept.create(seed, acc, depthOf(seed), { without: [gone.uid] }), rest = q => q.actors.filter(a => a.uid !== gone.uid).map(fields);
        assert.equal(json(rest(s)), json(rest(base)), `${acc}: without ${gone.uid}`);
        const g = X.Actors.byUid(s, gone.uid);
        assert.equal(json([g.uid, g.sp, g.x, g.y, g.gone]), json([gone.uid, gone.sp, gone.x, gone.y, 1]), `${acc}: ${gone.uid} removed`);
        kinds.add(gone.arch);
        removals++;
      }
    }
    assert.ok(removals >= 20, `${removals} removals`);
    for (const k of ['tethered_warden', 'patrol_guard', 'demonstrator']) assert.ok(kinds.has(k), `no ${k} was removed`);
  });

  test('population is the same under any module switched off: the same exhibits, tiles, groups, routes, cases and items', () => {
    const { X } = built();
    // (A case's weather is weather_cases' own, which its init gives only while it is on, from the
    // same draws either way, MOD-WEATHER: so the cases are compared without it.)
    const cases = s => s.dept.fixtures.map(f => { const c = Object.assign({}, f); delete c.weather; return c; });
    const fields = s => json([s.actors.map(a => [a.uid, a.sp, a.x, a.y, a.group, a.route, a.guards, a.home]), cases(s), s.dept.tiles, s.items, s.dept.rooms]);
    let pairs = 0;
    for (const acc of ACCS) for (let seed = 1; seed <= 6; seed++) {
      const base = fields(X.Dept.create(seed, acc, depthOf(seed)));
      for (const m of X.Packs.get(acc).modules) { assert.equal(fields(X.Dept.create(seed, acc, depthOf(seed), { rulesOff: [m.id] })), base, `${acc} seed ${seed} with ${m.id} off`); pairs++; }
    }
    assert.ok(pairs >= 18);
  });

  // ---- Draws ----

  // The paths of the streams population opens (Rng.stream inside Populate.exhibits), in a core
  // watched for them.
  function watched(X) {
    const paths = [], ex = X.Populate.exhibits, real = X.Rng.stream;
    let inside = false;
    X.Populate.exhibits = (...a) => { inside = true; try { return ex(...a); } finally { inside = false; } };
    X.Rng.stream = (holder, path) => { if (inside) paths.push(path); return real(holder, path); };
    return paths;
  }

  test('population draws only on each room\'s …/room/<key>/exhibits stream, local to the department', () => {
    const { X } = core(true), paths = watched(X);
    for (const acc of ACCS) for (let seed = 1; seed <= 5; seed++) {
      paths.length = 0;
      const out = X.Dept.generate(seed, acc, depthOf(seed));
      const ok = new RegExp(`^layout/${acc}@\\d+/d${depthOf(seed)}/a\\d/room/(s\\d|intro|centre|coda)/exhibits$`);
      assert.ok(paths.length > 0, `${acc} seed ${seed}: population drew`);
      for (const p of new Set(paths)) assert.match(p, ok, `${acc} seed ${seed}`);
      assert.ok(paths.every(p => p.startsWith(out.base + '/') || out.tries.length > 1), 'the taken attempt\'s streams');
      assert.ok(!Object.keys(out.state.rng).some(k => k.endsWith('/exhibits')), 'the exhibits streams are local, never stored');
    }
  });

  // ---- Readiness (A10) ----

  test('a gallery list places a species only once its archetype, modifiers and trigger are past ready false, and says so in the log', () => {
    const { X } = core(false);
    const m4 = sp => X.Registry.ARCHETYPES[sp.archetype || 'plodder'].ready === false || (sp.modifiers || []).some(id => X.Registry.MODIFIERS[id].ready === false) || (sp.trigger && X.Registry.TRIGGERS[sp.trigger].ready === false);
    for (const acc of ACCS) {
      const pack = X.Packs.get(acc), out = X.Dept.generate(2, acc, 3);
      const held = pack.species.filter(m4).map(sp => sp.id);
      // Every gallery species is built now (the Grazer, MOD-UNOBSERVED's; the Wader, MOD-ALARM's;
      // the station, MOD-CHIME's; the Countersigning Clerk and clockwork, ARCH-CLOCKWORK's), so
      // nothing waits; the Countersigning Clerk and M.11's station are placed.
      assert.equal(json(held), '[]', acc);
      if (acc !== 'S9') assert.ok(exhibitsOf(out.state).some(a => a.sp === (acc === 'A4' ? 'A4.5' : 'M11.2')), `${acc}: its clockwork species is placed`);
      assert.ok(!out.log.some(l => l.check === 'population' && / is not placed: its archetype, a modifier or its trigger is not ready$/.test(l.op)), `${acc}: nothing waits`);
      assert.ok(exhibitsOf(out.state).length > 0, `${acc}: the ready ones are placed`);
      for (const sp of pack.species) assert.equal(X.Populate.ready(sp), !m4(sp), sp.id);
      // A Centrepiece is placed only once its core is (ARCH-CP-CORE asks Populate.ready).
      assert.equal(X.Populate.ready(pack.centrepiece), false, acc);
    }
    // One readiness flips back (planted): only that species waits, and says so; the Countersigning
    // Clerk waits on its modifier as on its archetype.
    X.Registry.MODIFIERS.clockwork.ready = false;
    const clerk = X.Packs.get('A4').species.find(sp => sp.id === 'A4.5');
    assert.equal(X.Populate.ready(clerk), false, 'clockwork is not ready');
    const out = X.Dept.generate(2, 'A4', 3);
    assert.ok(!exhibitsOf(out.state).some(a => a.sp === 'A4.5'));
    assert.ok(out.log.some(l => l.check === 'population' && l.op.startsWith('A4.5 (') && l.op.endsWith('is not placed: its archetype, a modifier or its trigger is not ready')), 'A4.5 logged');
    X.Registry.MODIFIERS.clockwork.ready = true;
    X.Registry.ARCHETYPES.conservator_healer.ready = false;
    assert.equal(X.Populate.ready(clerk), false, 'its archetype is not ready');
    X.Registry.ARCHETYPES.conservator_healer.ready = 'unit';
    assert.ok(X.Populate.ready(clerk));
    assert.ok(exhibitsOf(X.Dept.create(2, 'A4', 3)).some(a => a.sp === 'A4.5'));
    X.Registry.ARCHETYPES.mp_ensemble.ready = 'unit';
    assert.ok(X.Populate.ready(X.Packs.get('A4').centrepiece));
  });

  test('the Centrepiece is placed only for a pack with a gallery list, once its core is past ready false', () => {
    const calls = X => { const seen = [], real = X.Centrepiece.place; X.Centrepiece.place = (state, plan, pack) => { seen.push([pack.acc, plan.rooms.length > 0, state.actors.length > 0]); return real(state, plan, pack); }; return seen; };
    const plain = loadCore(), none = calls(plain);
    for (const acc of ACCS) plain.Dept.create(1, acc, 2);
    assert.equal(json(none), '[]', 'no gallery list: the stand-in places no Centrepiece');
    const { X } = core(true), seen = calls(X);
    for (const acc of ACCS) X.Dept.create(1, acc, 2);
    assert.equal(json(seen), '[]', 'no core is ready');
    // (Its core is added with the shared rules, which a core is placed only with: ARCH-CP-CORE,
    // TABLEAU-CORE.)
    X.Registry.ARCHETYPES.mp_tableau.ready = 'unit';
    for (const acc of ACCS) X.Dept.create(1, acc, 2);
    assert.equal(json(seen), json([['M11', true, true]]), 'M.11\'s core is ready: placed, once, after the exhibits');
  });

  // The packs have gallery lists since D-PACKS, so the stand-in is met in a core whose packs
  // have had theirs taken away.
  test('with no gallery list, the stand-in places exactly as before, and Dept.generate gives Dept.create\'s department', () => {
    const X = loadCore();
    for (const acc of ACCS) delete X.Packs.get(acc).galleries;
    for (const acc of ACCS) for (const seed of [1, 2]) {
      const out = X.Dept.generate(seed, acc, 3), s = X.Dept.create(seed, acc, 3);
      assert.equal(X.State.hash(out.state), X.State.hash(s));
      assert.ok(!s.dept.rooms.some(r => 'galleries' in r), 'no room keeps a gallery');
      assert.equal(X.Populate.check(X.Packs.get(acc)).length, 0);
      assert.ok(exhibitsOf(s).every(a => X.Registry.ARCHETYPES[a.arch].built === 'M3' && !/@/.test(a.group || '')), 'M3\'s archetypes, M3\'s groups');
    }
  });

  // ---- Dept.generate (the follow-up D-RUNNER's sweep needs) ----

  test('Dept.generate says which attempt was taken, whether it was the fallback, each try\'s failures, the fallback\'s rejection and the log', () => {
    const X = loadCore();
    const out = X.Dept.generate(7, 'M11', 3);
    assert.equal(json([out.attempt, out.fallback, out.rejected]), json([0, false, null]));
    assert.match(out.base, /^layout\/M11@\d+\/d3\/a0$/);
    assert.ok(Array.isArray(out.log) && Array.isArray(out.tries));
    // A validator that rejects attempt 0: attempt 1, with the rejection in tries[0]; the log
    // handed to it is the attempt's, and what it writes there comes back.
    const Y = loadCore();
    let n = 0;
    Y.Populate.addValidator('planted', (state, plan, log) => { log.push({ check: 'planted', room: null, op: `asked ${++n}` }); return n === 1 ? { reason: 'planted', tiles: [[1, 1]] } : null; });
    const once = Y.Dept.generate(7, 'M11', 3);
    assert.equal(json([once.attempt, once.fallback, once.tries[0]]), json([1, false, [{ id: 'planted', why: 'planted', tiles: [[1, 1]] }]]));
    assert.ok(once.log.some(l => l.op === 'asked 2') && !once.log.some(l => l.op === 'asked 1'), 'the taken attempt\'s log');
    // A gallery list no plan can hold: every attempt is rejected as `population`, and the
    // fallback is taken with what fitted, its rejection kept.
    const { X: Z } = core(true, Object.assign({}, GALLERIES, { M11: [{ key: 'coda', name: 'Too Many', contents: [{ sp: 'M11.5', count: 400 }] }] }));
    const full = Z.Dept.generate(7, 'M11', 3);
    assert.equal(json([full.fallback, full.attempt, full.tries.length]), json([true, 5, 5]));
    for (const t of full.tries) assert.equal(t[0].id, 'population');
    assert.equal(full.rejected.id, 'population');
    assert.match(full.rejected.why, /^no tile in room coda could take M11\.5 \(Too Many\)$/);
    assert.ok(exhibitsOf(full.state).length > 0, 'the fallback is populated with what fitted');
  });

  // ---- The gallery list's own faults ----

  test('Populate.check names every fault of a gallery list and of the stamp\'s exhibits, and population refuses such a pack', () => {
    const X = loadCore(), A4 = X.Packs.get('A4'), S9 = X.Packs.get('S9');
    const big = Object.assign({}, A4.species.find(sp => sp.id === 'A4.3'), { id: 'A4.big', size: 2 });
    const with4 = galleries => Object.assign({}, A4, { galleries, species: A4.species.concat([big]) });
    const ok = [{ key: 's1', name: 'Fine', contents: [{ sp: 'A4.1', case: true }, { sp: 'A4.1a', count: 2 }] }];
    assert.equal(json(X.Populate.check(with4(ok))), '[]');
    const plants = [
      [[{ key: 'hall', name: 'x', contents: [] }], 'has the key "hall", not intro, centre, coda, last or s1, s2'],
      [[{ key: 's1', name: 'x', contents: [] }, { key: 's1', name: 'y', contents: [] }], 'has the key s1, which another gallery has'],
      [[{ key: 'intro', where: 'band', name: 'x', contents: [] }], 'where names a programme element, and only for a section gallery'],
      [[{ key: 's1', contents: [] }], 'has no name'],
      [[{ key: 's1', name: 'x', contents: [{ sp: 'S9.1' }] }], 'names "S9.1", which is no species of A4'],
      [[{ key: 's1', name: 'x', contents: [{ sp: 'A4.3', count: 0 }] }], 'the count of A4.3 is not a whole number of 1 or more'],
      [[{ key: 's1', name: 'x', contents: [{ sp: 'A4.3', colour: 'red' }] }], 'has the unknown field colour'],
      [[{ key: 's1', name: 'x', contents: [{ sp: 'A4.1a', count: 3 }] }], 'holds A4.1a, a spare of A4.1, with 0 of its original, not 1'],
      [[{ key: 's1', name: 'x', contents: [{ sp: 'A4.1', count: 2 }, { sp: 'A4.1a', count: 2 }] }], 'holds A4.1a, a spare of A4.1, with 2 of its original, not 1'],
      [[{ key: 's1', name: 'x', contents: [{ sp: 'A4.1' }, { sp: 'A4.1a', count: 4 }] }], 'holds a copy group of 5 (clerks), not 3–4'],
      [[{ key: 's1', name: 'x', contents: [{ sp: 'A4.3', guards: 'case' }] }], 'guards is \'case\', and only for a tethered_warden'],
      [[{ key: 's1', name: 'x', contents: [{ sp: 'A4.3', dir: 'E' }] }], 'dir is one of N, E, S, W, and only for a demonstrator'],
      [[{ key: 's1', name: 'x', contents: [{ item: 'A4.99' }] }], 'names "A4.99", which is no item of A4'],
      [[{ key: 's1', name: 'x', contents: [{ sp: 'A4.big' }] }], 'A4.big is 2 tiles across, and population places one-tile exhibits'],
    ];
    for (const [galleries, want] of plants) {
      const got = X.Populate.check(with4(galleries));
      assert.ok(got.some(l => l.includes(want)), `not caught: ${want}\n${got.join('\n')}`);
    }
    const s9 = galleries => Object.assign({}, S9, { galleries });
    assert.ok(X.Populate.check(s9([{ key: 'centre', name: 'x', contents: [{ sp: 'S9.5' }] }])).some(l => l.endsWith('no mimic stands in the Centrepiece hall')));
    assert.ok(X.Populate.check(s9([{ key: 's1', name: 'x', contents: [{ sp: 'S9.5', case: true }] }])).some(l => l.includes('cannot stand in a case')));
    assert.ok(X.Populate.check(Object.assign(s9([]), { intro: { legend: { g: { sp: 'S9.9' }, p: { tile: 'p' } } } })).some(l => l.includes('stamp legend "g" names "S9.9"')));
    assert.ok(X.Populate.check(Object.assign(s9([]), { intro: { legend: { h: { sp: 'S9.6', dir: 'E' } } } })).some(l => l.includes('only for a demonstrator')));
    // Population refuses the pack outright: the fault is the content's, which no reseed mends.
    const { X: Y } = core(true, Object.assign({}, GALLERIES, { A4: [{ key: 's1', name: 'x', contents: [{ sp: 'A4.1a' }] }] }));
    assert.throws(() => Y.Dept.create(1, 'A4', 3), /A4's gallery list is not sound:\nA4's gallery 1 \(x\) holds A4\.1a, a spare of A4\.1, with 0 of its original, not 1/);
  });


  // ---- The stamped Intro: a pack's own stamp, written by the generator (layout version 3) ----

  // A core whose M11 pack gives its own Intro stamp (§5.2): the fixture stamp's rows (its
  // partition, the door on the entrance row its cut, its two plinths), each row r replaced by
  // rows[r] where given, with the legend given; the generator writes it, and plan.intro carries
  // its marks.
  function stamped(legend, rows) {
    const { X, plans } = core(true);
    const F = X.LStamp.FIXTURE, map = F.map.map((row, r) => (rows && rows[r]) || row);
    X.Packs.part('M11', 'intro', { map, legend, stretch: F.stretch.slice(), cut: F.cut, invariants: [] });
    return { X, plans };
  }

  test('a stamped Intro: each mark the legend names an exhibit puts it on its tile, with no draw; other letters place nothing; the Intro gallery adds nothing', () => {
    // g and h on rows that do not stretch, east of the cut and beyond the safe zone; p, the
    // fixture's plinths, a letter that names no exhibit.
    const { X, plans } = stamped({ g: { sp: 'M11.5' }, h: { sp: 'M11.2', dir: 'W' }, p: { tile: 'p' } }, { 2: '#......|.....g.', 4: '#......|....h..' }), paths = watched(X);
    let placed = 0;
    for (let seed = 1; seed <= 30; seed++) {
      plans.length = 0; paths.length = 0;
      const out = X.Dept.generate(seed, 'M11', depthOf(seed)), s = out.state, plan = plans[plans.length - 1];
      assert.equal(out.fallback, false);
      assert.equal(X.LStamp.shape(plan.intro), null);
      const intro = s.dept.rooms.find(r => r.role === 'intro'), inIntro = exhibitsOf(s).filter(a => roomAt(s, a.x, a.y) === intro);
      const want = plan.intro.marks.filter(k => k.ch !== 'p').map(k => [k.ch === 'g' ? 'M11.5' : 'M11.2', k.x, k.y]);
      assert.equal(json(plan.intro.marks.map(k => [k.ch, k.x])), json([['p', 11], ['g', 13], ['h', 12], ['p', 11]]), `seed ${seed}: the stamp's marks`);
      assert.equal(json(inIntro.map(a => [a.sp, a.x, a.y])), json(want), `seed ${seed}: the marks, in their order, and not the Intro gallery's M11.5`);
      for (const a of inIntro) if (a.sp === 'M11.2') assert.equal(json(a.route), json({ dir: 'W' }), 'the legend gives the station its direction');
      assert.equal(json(inIntro.map(a => a.uid)), json(inIntro.map((a, i) => `M11.${depthOf(seed)}.intro.${i + 1}`)));
      assert.ok(!paths.some(p => p.endsWith('/room/intro/exhibits')), `seed ${seed}: the stamped Intro opens no stream`);
      assert.ok(out.log.some(l => l.op === 'The First Landing (intro): the stamp places the Intro\'s exhibits, not its gallery'), `seed ${seed}: the log says why`);
      placed += inIntro.length;
    }
    assert.equal(placed, 60);
  });

  test('a stamp that puts an exhibit in the safe zone fails every attempt as `population`, with its tile; a plan.intro of the wrong shape is an error', () => {
    const { X } = stamped({ g: { sp: 'M11.5' } }, { 3: 'E.g....+.......' });
    const out = X.Dept.generate(4, 'M11', 2);
    assert.equal(json([out.fallback, out.tries.length]), json([true, 5]));
    const why = `the stamp puts M11.5 2 walking tiles from the entrance, inside the safe zone (${X.N.SAFE_ZONE})`;
    for (const t of out.tries) assert.equal(json([t.length, t[0].id, t[0].why, t[0].tiles.length, t[0].tiles[0][0]]), json([1, 'population', why, 1, 2]));
    assert.equal(json([out.rejected.id, out.rejected.why]), json(['population', why]));
    // A plan.intro of the wrong shape is an error (LStamp.shape), never read as no stamp.
    const Y = loadCore();
    Y.Packs.get('M11').galleries = [];
    const gen = Y.Layout.generate;
    Y.Layout.generate = (p, size, seed, opts) => gen(p, size, seed, Object.assign({}, opts, { accept: res => { res.plan.intro = { x0: 1 }; return opts.accept(res); } }));
    assert.throws(() => Y.Dept.create(1, 'M11', 2), /plan\.intro has the fields x0, not x0, y0, x1, y1, cut, marks and openings/);
  });

  // ---- A hand-drawn fixture plan, for the rules a sweep meets too rarely to prove ----

  // Five rooms in a row, joined by doorways on row 4 (which belong to no room), entered from
  // the west at 0,4:
  //   the Intro, x 1–9: only column 9 lies beyond the safe zone (9 walking tiles);
  //   s1, x 11–20, rows 2–7: two cases in its north wall, at 15,1 in a one-tile nook (its one
  //     take tile, 15,2, is two steps from outside a tether round it) and at 19,1, open;
  //   s2, x 22–31: open;
  //   the hall, x 33–44: the Centrepiece's footprint C at 42–43,2–3, the reading tile 37,3;
  //   the coda, a one-tile corridor x 46–53 on row 4, to the exit at 54,4.
  // edit(t, roomOf), given, redraws tiles first (t[y][x], a character; roomOf[y][x], a room id).
  function handMap(edit) {
    const w = 55, h = 9, t = Array.from({ length: h }, () => Array(w).fill('#')), roomOf = Array.from({ length: h }, () => Array(w).fill(0));
    const rooms = [];
    const room = (id, key, role, x0, y0, x1, y1) => {
      rooms.push({ id, key, role, x0, y0, x1, y1, tags: [] });
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { t[y][x] = '.'; roomOf[y][x] = id; }
    };
    room(1, 'intro', 'intro', 1, 1, 9, 7); room(2, 's1', 'section', 11, 2, 20, 7); room(3, 's2', 'section', 22, 1, 31, 7);
    room(4, 'centre', 'centre', 33, 1, 44, 7); room(5, 'coda', 'coda', 46, 4, 53, 4);
    rooms[1].y0 = 1;
    for (const [x, c] of [[15, 'v'], [19, 'v']]) { t[1][x] = c; roomOf[1][x] = 2; }
    t[2][14] = '#'; t[2][16] = '#'; roomOf[2][14] = 0; roomOf[2][16] = 0;
    for (const [x, y] of [[42, 2], [43, 2], [42, 3], [43, 3]]) t[y][x] = 'C';
    t[4][0] = 'E'; t[4][10] = '.'; t[4][21] = ','; t[4][32] = ','; t[4][45] = ','; t[4][54] = 'X';
    if (edit) edit(t, roomOf);
    return { w, h, tiles: t.map(r => r.join('')), roomOf, rooms };
  }
  // opts: edit (above); intro, a plan.intro, with legend, the stamp legend it reads.
  function hand(galleries, seed, opts = {}) {
    const X = loadCore(), { w, h, tiles, roomOf, rooms } = handMap(opts.edit);
    const plan = { programme: 'enfilade', pin: 2, w, h, tiles, rooms, roomOf, entrance: [0, 4], exits: [[54, 4]], cpl: [42, 2], lectern: null, viewTile: [37, 3], ltour: 60, tourOrder: [1, 2, 3, 4], intro: opts.intro || null };
    const dept = Object.assign({ acc: 'M11', depth: 3, pin: 2, programme: 'enfilade', w, h, tiles: tiles.map(r => r.replace(/C/g, '.')), ltour: 60,
      rooms: rooms.map(r => ({ id: r.id, key: r.key, role: r.role, number: 300 + r.id, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 })), roomOf, entrance: [0, 4], exits: [[54, 4]], lectern: null, viewTile: [37, 3], seen: '' }, X.Setup.deptParts(3));
    const s = X.Setup.base(seed, dept, 1, 4, {}, 3), base = 'layout/M11@2/d3/a0', log = [];
    X.Cases.place(s, plan, base, { seed, rng: {} });
    for (const f of s.dept.fixtures) f.loan = false;
    for (const tb of ['ARCHETYPES', 'MODIFIERS', 'TRIGGERS']) for (const id of M4_READY[tb]) X.Registry[tb][id].ready = 'unit';
    const extra = [...X.Packs.get('S9').species, ...X.Packs.get('A4').species].filter(sp => ['S9.2', 'S9.4', 'S9.5', 'A4.2'].includes(sp.id));
    const pack = Object.assign({}, X.Packs.get('M11'), { galleries, species: X.Packs.get('M11').species.concat(extra) }, opts.legend ? { intro: { legend: opts.legend } } : {});
    const short = X.Populate.exhibits(s, plan, pack, base, log);
    return { X, s, plan, log, short };
  }
  const cheb = (a, x, y) => Math.max(Math.abs(a.x - x), Math.abs(a.y - y));

  test('on a hand-drawn plan: the safe zone, the reading tile\'s ring and the footprint keep their tiles; a warden guards the nook\'s case; a round takes the corners; a line the longest run', () => {
    let rounds = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { X, s, log, short } = hand([
        { key: 'intro', name: 'Intro', contents: [{ sp: 'M11.5', count: 3 }] },
        { key: 's1', name: 'Nook', contents: [{ sp: 'S9.4', guards: 'case' }] },
        { key: 's2', name: 'Court', contents: [{ sp: 'S9.2' }, { sp: 'M11.2' }] },
        { key: 'centre', name: 'Hall', contents: [{ sp: 'M11.5', count: 4 }] },
      ], seed);
      assert.equal(short, null, `seed ${seed}: ${short && short.reason}`);
      const at = sp => exhibitsOf(s).filter(a => a.sp === sp);
      // The Intro's floor beyond 8 walking tiles from the entrance is column 9 alone, and 3 fit 3 apart there.
      const intro = exhibitsOf(s).filter(b => b.uid.includes('.intro.'));
      assert.ok(intro.length === 3 && intro.every(a => a.x === 9), `seed ${seed}: ${json(intro.map(a => [a.x, a.y]))}`);
      // In the hall: never within 3 walking tiles of the reading tile (37,3), nor on the footprint.
      for (const a of exhibitsOf(s).filter(b => b.uid.includes('.centre.'))) {
        assert.ok(cheb(a, 37, 3) > X.N.RING_STILL + 1, `seed ${seed}: ${a.uid} at ${a.x},${a.y}`);
        assert.ok(!(a.x >= 42 && a.x <= 43 && a.y >= 2 && a.y <= 3), `seed ${seed}: ${a.uid} on the footprint`);
      }
      // The warden guards the nook's case (15,1), from within its tether; the open wall case (19,1) never.
      const [warden] = at('S9.4');
      assert.equal(json(warden.guards), json([15, 1]), `seed ${seed}`);
      assert.ok(X.Grid.disc(warden.x - 15, warden.y - 1, X.N.TETHER_RANGE));
      assert.equal(json([X.Populate.takeOk(s, 15, 1), X.Populate.takeOk(s, 19, 1)]), json([true, false]));
      assert.ok(!log.some(l => l.op.includes('guards its own tile')));
      // The Wader's round: s2's corners, where free, are its posts; it starts at the nearest.
      const [wader] = at('S9.2'), posts = [[22, 1], [31, 1], [31, 7], [22, 7]];
      if (!exhibitsOf(s).some(a => a !== wader && posts.some(p => p[0] === a.x && p[1] === a.y))) {
        const near = posts.reduce((bi, p, i) => (cheb(wader, p[0], p[1]) < cheb(wader, posts[bi][0], posts[bi][1]) ? i : bi), 0);
        assert.equal(json(wader.route), json({ posts, i: near }), `seed ${seed}`);
        rounds++;
      }
      // The station's line: the longest straight run of s2 from its tile that no other exhibit
      // stands on (N, E, S, W on a tie), or, if each meets one, the longest (M4's first
      // integration review: a sleeper on it would wake at the chime and hunt you).
      const [st] = at('M11.2'), runs = { N: st.y - 1, E: 31 - st.x, S: 7 - st.y, W: st.x - 22 };
      const STEP = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
      const met = k => { for (let i = 1; i <= runs[k]; i++) { const x = st.x + STEP[k][0] * i, y = st.y + STEP[k][1] * i; if (s.actors.some(q => q !== st && !q.gone && q.x === x && q.y === y)) return true; } return false; };
      const dirs = ['N', 'E', 'S', 'W'], clear = dirs.filter(k => !met(k) && runs[k] > 0);
      const pick = list => { const most = Math.max(...list.map(k => runs[k])); return list.find(k => runs[k] === most); };
      assert.equal(json(st.route), json({ dir: clear.length ? pick(clear) : pick(dirs) }), `seed ${seed}`);
    }
    assert.ok(rounds >= 30, `${rounds} rounds checked`);
  });

  test('on a hand-drawn plan: a mimic never cuts a way off; encased exhibits take the empty cases, then the floor; a swarm stands together; spacing gives way only as it must', () => {
    // The coda is a one-tile corridor to the exit: a mimic there would cut it off, so none is placed.
    const cut = hand([{ key: 'coda', name: 'Corridor', contents: [{ sp: 'S9.5' }] }], 1);
    assert.equal(json(cut.short), json({ reason: 'no tile in room coda could take S9.5 (Corridor)', tiles: [[46, 4], [53, 4]] }));
    for (let seed = 1; seed <= 30; seed++) {
      const { s, log, short } = hand([
        { key: 's1', name: 'Cases', contents: [{ sp: 'M11.5', case: true, count: 3 }, { sp: 'S9.5', near: 'case' }] },
        { key: 's2', name: 'Bundles', contents: [{ sp: 'M11.3', count: 4 }, { sp: 'A4.2' }] },
        { key: 'coda', name: 'Corridor', contents: [{ sp: 'M11.4', count: 2 }] },
      ], seed);
      assert.equal(short, null, `seed ${seed}: ${short && short.reason}`);
      // s1's two cases each take one; the third stands on the floor, and the log says so.
      const clerks = exhibitsOf(s).filter(a => a.sp === 'M11.5');
      assert.equal(json(clerks.slice(0, 2).map(a => [a.x, a.y]).sort()), json([[15, 1], [19, 1]]), `seed ${seed}`);
      assert.equal(s.dept.tiles[clerks[2].y][clerks[2].x], '.');
      assert.ok(log.some(l => l.op === 'M11.5 found no empty case in s1 and stands on the floor'));
      // The mimic stands beside a real case, but never on 15,2, the nook case's one tile beside it (LV10).
      const [mimic] = exhibitsOf(s).filter(a => a.sp === 'S9.5');
      assert.ok([[15, 1], [19, 1]].some(([x, y]) => cheb(mimic, x, y) === 1) && !(mimic.x === 15 && mimic.y === 2), `seed ${seed}: the mimic at ${mimic.x},${mimic.y}`);
      // Four artillery in s2, 3 or more tiles apart (s2 holds that many), then a swarm: its first
      // body drawn, the other two on the nearest free floor tiles of s2 (Chebyshev, then row-major).
      const four = exhibitsOf(s).filter(a => a.sp === 'M11.3');
      for (const a of four) for (const b of four) if (a !== b) assert.ok(cheb(a, b.x, b.y) >= 3, `seed ${seed}`);
      const [first, ...rest] = exhibitsOf(s).filter(a => a.sp === 'A4.2'), free = [];
      for (let y = 1; y <= 7; y++) for (let x = 22; x <= 31; x++) if (!s.actors.some(a => a.x === x && a.y === y)) free.push([x, y]);
      const want = free.concat(rest.map(a => [a.x, a.y])).sort((p, q) => (cheb(first, p[0], p[1]) - cheb(first, q[0], q[1])) || (p[1] - q[1]) || (p[0] - q[0])).slice(0, 2);
      assert.equal(json(rest.map(a => [a.x, a.y])), json(want), `seed ${seed}`);
      // Two in the one-tile corridor, 3 apart: it has room for that.
      const two = exhibitsOf(s).filter(a => a.sp === 'M11.4');
      assert.ok(two.every(a => a.y === 4) && Math.abs(two[0].x - two[1].x) >= 3, `seed ${seed}`);
    }
    // Spacing gives way: five in the corridor's eight tiles cannot stand 3 apart, nor 2, so they stand 1 apart.
    const { s, short } = hand([{ key: 'coda', name: 'Corridor', contents: [{ sp: 'M11.4', count: 5 }] }], 2);
    assert.equal(short, null);
    assert.equal(exhibitsOf(s).filter(a => a.y === 4 && a.x >= 46).length, 5);
    // And a ninth has no tile: the attempt fails, saying which.
    assert.equal(hand([{ key: 'coda', name: 'Corridor', contents: [{ sp: 'M11.4', count: 9 }] }], 2).short.reason, 'no tile in room coda could take M11.4 (Corridor)');
  });

  // ---- Review: mimics, and what a rejected plan still holds ----

  // The tiles cut off from the entrance once every mimic's disguise is made (at its init).
  const cutOff = (X, s) => {
    X.Setup.settleActors(s, 1);
    const m = s.dept, d = X.Grid.distances(m, [m.entrance], 9999), out = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (X.Grid.walkable(m, x, y) && m.roomOf[y][x] && d[y * m.w + x] < 0) out.push([x, y]);
    if (d[4 * m.w + 54] < 0) out.push([54, 4]);
    return out;
  };

  test('on a hand-drawn plan: a mimic keeps the safe zone as the case it becomes, and two mimics never close a passage between them', () => {
    // A partition across the Intro at column 7, open only at 7,4 (walk 7): 8,3 and 8,5 are 9
    // walking tiles away round its corner, but as cases 8 (1 + 7,4's walk), inside the safe zone.
    const partition = t => { for (let y = 1; y <= 7; y++) if (y !== 4) t[y][7] = '#'; };
    let corner = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { X, s, short } = hand([{ key: 'intro', name: 'Intro', contents: [{ sp: 'S9.5' }] }], seed, { edit: partition });
      assert.equal(short, null, `seed ${seed}`);
      const [mimic] = exhibitsOf(s);
      X.Setup.settleActors(s, 1);
      const m = s.dept, d = X.Grid.distances(m, [m.entrance], 9999);
      assert.equal(m.tiles[mimic.y][mimic.x], 'v', `seed ${seed}: the disguise is made`);
      assert.ok(X.Grid.reachDist(d, m, mimic.x, mimic.y) > X.N.SAFE_ZONE, `seed ${seed}: the mimic's case at ${mimic.x},${mimic.y} is ${X.Grid.reachDist(d, m, mimic.x, mimic.y)} walking tiles from the entrance`);
      if (mimic.x === 9 && (mimic.y === 3 || mimic.y === 5)) corner++;
    }
    assert.ok(corner > 0, 'the tiles beside the corner ones are taken');
    // The coda two tiles wide at x 46–48: each tile there cuts nothing off alone (but 46,4, the
    // only way in, and 48,4, the only way on), yet 47,4 with 47,5 or 46,5 would close it. Two
    // mimics stand there only where both together leave the way open; after a first on 47,4
    // there is no such tile, and the attempt is rejected for the second.
    const wide = (t, roomOf) => { for (let x = 46; x <= 48; x++) { t[5][x] = '.'; roomOf[5][x] = 5; } };
    let both = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { X, s, short, log } = hand([{ key: 'coda', name: 'Corridor', contents: [{ sp: 'S9.5', count: 2 }] }], seed, { edit: wide });
      const at = exhibitsOf(s).map(a => [a.x, a.y]);
      assert.equal(json(cutOff(X, s)), '[]', `seed ${seed}: the mimics at ${json(at)} cut a way off`);
      if (short === null) { both++; assert.equal(at.length, 2); continue; }
      assert.equal(json([short.reason, at]), json(['no tile in room coda could take S9.5 (Corridor)', [[47, 4]]]), `seed ${seed}`);
      assert.ok(log.some(l => l.op === 'no tile in room coda could take S9.5 (Corridor): 1 of 2 not placed'));
    }
    assert.ok(both >= 20, `${both} of 40 hold both`);
  });

  test('on a hand-drawn plan: a mimic asked to stand beside a case stands elsewhere when every tile beside one would cut it off; a stamp\'s mimic that would cut a way off is not placed', () => {
    // Without the open case at 19,1, s1's only case is the nook's, whose one tile beside it
    // (15,2) a mimic would take from it.
    const nookOnly = t => { t[1][19] = '#'; };
    for (let seed = 1; seed <= 20; seed++) {
      const { X, s, log, short } = hand([{ key: 's1', name: 'Nook', contents: [{ sp: 'S9.5', near: 'case' }] }], seed, { edit: nookOnly });
      assert.equal(short, null, `seed ${seed}: ${short && short.reason}`);
      const [mimic] = exhibitsOf(s);
      assert.ok(!(mimic.x === 15 && mimic.y === 2) && mimic.x >= 11 && mimic.x <= 20, `seed ${seed}: ${mimic.x},${mimic.y}`);
      assert.ok(log.some(l => l.op === 'S9.5 found no tile beside a case in s1 and stands elsewhere in it'), `seed ${seed}`);
      assert.equal(json(cutOff(X, s)), '[]');
    }
    // The stamp's marks: a mimic on 9,4, the Intro's only way on, would cut the rest off; on 9,1 it stands.
    const intro = (x, y) => ({ intro: { x0: 1, y0: 1, x1: 9, y1: 7, cut: [[1, 4]], marks: [{ ch: 't', x, y }], openings: [] }, legend: { t: { sp: 'S9.5' } } });
    const cut = hand([{ key: 's2', name: 'Court', contents: [{ sp: 'S9.2' }] }], 1, intro(9, 4));
    assert.equal(json(cut.short), json({ reason: 'the stamp\'s t at 9,4 would cut a way off as a mimic\'s case', tiles: [[9, 4]] }));
    assert.equal(json(exhibitsOf(cut.s).map(a => a.sp)), json(['S9.2']), 'the rest is placed');
    assert.ok(cut.log.some(l => l.op === 'the stamp\'s t at 9,4 would cut a way off as a mimic\'s case: not placed'));
    const ok = hand([], 1, intro(9, 1));
    assert.equal(ok.short, null);
    assert.equal(json(exhibitsOf(ok.s).map(a => [a.sp, a.x, a.y])), json([['S9.5', 9, 1]]));
    // A section gallery whose element no section has here takes its room in tour order, and says so.
    assert.ok(hand([{ key: 's1', where: 'central', name: 'Court', contents: [] }], 1).log.some(l => l.op === 'Court (s1) names central, which no section left has in this plan, and takes room s1'));
  });

  test('a plan the list cannot fill is rejected for its first missing exhibit, yet the department holds every other exhibit, fixed, and the log names each one missing', () => {
    // S.9's court is asked for 400 Hoppers; the band room's Wader and herald and the hall's two
    // Grazers come after it in the list.
    const { X } = core(true, Object.assign({}, GALLERIES, { S9: [
      { key: 's1', where: 'central', name: 'Court', contents: [{ sp: 'S9.6', count: 400 }] },
      { key: 's2', where: 'band', name: 'Bay', contents: [{ sp: 'S9.2' }, { sp: 'S9.3' }] },
      { key: 'centre', name: 'Hall', contents: [{ sp: 'S9.1', count: 2 }] },
    ] }));
    // Seeds whose five attempts each pass every layout check (at layout version 3; seeds 3 and 8
    // each have an attempt that fails LV8), so every try fails as population.
    for (const seed of [4, 10]) {
      const out = X.Dept.generate(seed, 'S9', 3), ex = exhibitsOf(out.state);
      assert.equal(json([out.fallback, out.tries.length]), json([true, 5]), `seed ${seed}`);
      for (const t of out.tries) assert.equal(json(t.map(f => f.id)), json(['population']));
      assert.match(out.rejected.why, /^no tile in room s\d could take S9\.6 \(Court\)$/);
      const n = sp => ex.filter(a => a.sp === sp).length, hoppers = n('S9.6');
      assert.equal(json([n('S9.2'), n('S9.3'), n('S9.1')]), json([1, 1, 2]), `seed ${seed}: the galleries after the shortfall are placed`);
      assert.ok(hoppers > 0 && hoppers < 400);
      const [wader] = ex.filter(a => a.sp === 'S9.2');
      assert.ok(wader.route && wader.route.posts.length >= 2, `seed ${seed}: the Wader keeps its round`);
      const short = out.log.filter(l => l.check === 'population' && / not placed$/.test(l.op));
      assert.equal(json(short.map(l => l.op)), json([`${out.rejected.why}: ${400 - hoppers} of 400 not placed`]), `seed ${seed}: one line for the one entry short, with its count`);
    }
  });
};
