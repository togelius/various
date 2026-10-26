// M3's view model (BUILD.md §6.1; the plan's A14): what it lists, and that it shows what a
// player sees and nothing more, since the bots read only it (§10.2). The actors it lists are
// exactly the ones in view and never a mimic in its disguise, whose case differs from a real
// empty case in its number alone (R17); unseen tiles are masked; marks are unique by kind and
// tile, and a noise ring keeps the loudest class where two noises reach a tile (R30d); and
// the cases, staff doors, items, labels, surfaces, your kit, the clock, the floor plan, the
// cues, the aim and the camera each say what the state says.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const C = loadCore();
  const { Setup, Dept, ViewModel, Step, State, Vision, Actors, Archetypes, Specials, Roles, N, Registry, Grid } = C;
  const json = JSON.stringify, same = (a, b, m) => assert.equal(json(a), json(b), m);
  const OPEN = ['############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '############'];
  const DEPTS = ['S9', 'A4', 'M11'];
  // A walk through a department: each step the first legal move toward the far side, else a
  // wait, so the view model is tried in many rooms. Your health is kept high.
  function walk(s, n, fn) {
    s.actors[0].hp = s.actors[0].maxHp = 999;
    let last = [];
    for (let i = 0; i < n && !s.over; i++) {
      fn(ViewModel.derive(s, { events: last }), last, i);
      const legal = Step.legal(s), moves = legal.filter(a => a.a === 'move');
      last = Step.step(s, moves.length ? moves[(i * 7 + 3) % moves.length] : { a: 'wait' });
    }
  }
  const seenNow = s => Vision.visible(s);

  test('vm.actors is exactly you and the actors in view, in spawn order, and never one that shows as a case', () => {
    let checked = 0, hidden = 0;
    for (const acc of DEPTS) for (const depth of [1, 4, 7]) {
      const s = Dept.create(depth, acc, depth);
      walk(s, 60, vm => {
        const now = seenNow(s), want = s.actors.filter(a => a.uid === 'you' || (!a.gone && Archetypes.present(s, a) === null && Actors.footprint(a).some(([x, y]) => now[y * s.dept.w + x]))).map(a => a.uid);
        same(vm.actors.map(a => a.uid), want, `${acc} d${depth}`);
        for (const a of s.actors) if (!a.gone && Archetypes.present(s, a) !== null) {
          hidden++;
          assert.ok(!json(vm).includes(`"${a.uid}"`), `${acc} d${depth}: the view model names ${a.uid}, a mimic in its disguise`);
        }
        for (const v of vm.actors) {
          const a = Actors.byUid(s, v.uid);
          same([v.x, v.y, v.mode === 'you' ? 'you' : a.mode, v.telegraphing, v.statuses, v.encased], [a.x, a.y, v.uid === 'you' ? 'you' : a.mode, a.telegraph ? a.telegraph.sp : null, a.statuses.map(t => t.id), C.Cases.encased(s, a)]);
          assert.ok(['you', 'dormant', 'awake', 'hunting', 'searching', 'returning', 'reinstalling'].includes(v.mode), v.mode);
        }
        checked++;
      });
    }
    assert.ok(checked > 400 && hidden > 0, `${checked} view models, ${hidden} disguised mimics passed by`);
  });

  test('a mimic in its disguise and a real empty case with the same glass, lock and loan differ in the view model in their number alone (R17)', () => {
    let n = 0;
    for (const { sp, depth } of H.species(C, 'mimic_vitrine')) for (const seed of [1, 2, 3, 4, 5]) {
      const s = Setup.room(seed, { acc: 'S9', depth, map: OPEN, you: [5, 3], exhibits: [{ sp: sp.id, at: [7, 3], stats: Roles.stats(sp.role, depth), mode: 'dormant' }] });
      const m = s.dept.fixtures.find(f => f.k === 'case' && f.mimic);
      assert.ok(m && m.num === null, 'the mimic is a case with no number');
      s.dept.fixtures.push(C.Cases.make({ x: 3, y: 3, room: m.room, num: 'S.9.1.1', glass: m.glass, lock: m.lock, loan: m.loan }));
      Grid.set(s.dept, 3, 3, 'v');
      const vm = ViewModel.derive(s, {}), mine = vm.cases.find(c => c.x === 7), real = vm.cases.find(c => c.x === 3);
      assert.ok(mine && real, 'both cases are in view');
      const strip = c => Object.assign({}, c, { x: 0, y: 0, num: null });
      same(strip(mine), strip(real), `${sp.id} d${depth} seed ${seed}`);
      same([mine.num, real.num], [null, 'S.9.1.1']);
      assert.ok(!vm.actors.some(a => a.uid === s.actors[1].uid));
      // Once touched it shows itself: it is in vm.actors, and its case is gone from vm.cases.
      s.actors[0].x = 6;
      const ev = Step.step(s, { a: 'open', x: 7, y: 3 });
      assert.ok(!ev.some(e => e.k === 'refused') || ev[0].reason === 'case_locked', json(ev[0]));
      if (ev[0].k === 'refused') continue;
      const after = ViewModel.derive(s, { events: ev });
      assert.ok(after.actors.some(a => a.uid === s.actors[1].uid), 'shown, it is listed');
      assert.ok(!after.cases.some(c => c.x === 7 && c.y === 3), 'and its case is not');
      n++;
    }
    assert.ok(n >= 7, `${n} mimics opened`);
  });

  test('unseen tiles are masked: every tile you have not seen is \' \', every other one is the map\'s, and a board rebuilt from the view model walks only where you have seen', () => {
    for (const acc of DEPTS) {
      const s = Dept.create(2, acc, 3);
      walk(s, 40, vm => {
        for (let y = 0; y < s.dept.h; y++) for (let x = 0; x < s.dept.w; x++) {
          const v = vm.vis[y * vm.w + x], ch = vm.tiles[y][x];
          if (v === 0) assert.equal(ch, ' ', `${acc}: ${x},${y} is unseen and shows ${json(ch)}`);
          else assert.equal(ch, s.dept.tiles[y][x], `${acc}: ${x},${y}`);
        }
        assert.notEqual(vm.tiles, s.dept.tiles, 'the view model hands out its own rows');
      });
      // A path for a policy (Obs.path) stays on tiles you have seen.
      const vm = ViewModel.derive(s, {});
      for (let i = 0; i < vm.vis.length; i += 7) {
        if (vm.vis[i]) continue;
        const x = i % vm.w, y = (i - x) / vm.w;
        same(C.Path.to({ dept: { w: vm.w, h: vm.h, tiles: vm.tiles, fixtures: [] }, actors: vm.actors, run: { grade: vm.you.grade } }, x, y), [], `${acc}: a path to the unseen ${x},${y}`);
      }
    }
    // Deriving changes nothing, and gives the same view model twice.
    const s = Dept.create(5, 'A4', 4), h = State.hash(s);
    const a = ViewModel.derive(s, {}), b = ViewModel.derive(s, {});
    assert.equal(State.hash(s), h);
    same(Object.assign({}, a, { vis: [...a.vis], ring: [...a.ring] }), Object.assign({}, b, { vis: [...b.vis], ring: [...b.ring] }));
  });

  // The tiles a noise from (x, y) reaches within range, found independently: walking steps
  // of one tile in eight directions, a diagonal only past two open tiles, entering a closed
  // door costs NOISE_DOOR more; and a tile an exhibit can stand on but not walk onto (a case)
  // is one beyond its nearest reached open neighbour.
  function heard(m, x0, y0, range) {
    const open = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && '.,+\'Ss=EXukxwb'.includes(m.tiles[y][x]);
    const dist = new Map([[x0 + ',' + y0, 0]]);
    for (let changed = true; changed;) {
      changed = false;
      for (const [k, d] of [...dist]) {
        const [x, y] = k.split(',').map(Number);
        for (const [dx, dy] of [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!open(nx, ny) || (dx && dy && !(open(nx, y) && open(x, ny)))) continue;
          const nd = d + 1 + ('+S'.includes(m.tiles[ny][nx]) ? N.NOISE_DOOR : 0);
          if (nd <= range && (!dist.has(nx + ',' + ny) || dist.get(nx + ',' + ny) > nd)) { dist.set(nx + ',' + ny, nd); changed = true; }
        }
      }
    }
    const out = new Set([...dist.keys()]);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (!'vp'.includes(m.tiles[y][x])) continue;
      for (const [dx, dy] of [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]) {
        const d = dist.get((x + dx) + ',' + (y + dy));
        if (d !== undefined && d + 1 <= range) out.add(x + ',' + y);
      }
    }
    return out;
  }

  test('noise rings: the tiles each noise of the step reached, on tiles you see or remember, one mark a tile, the loudest class where two reach it (R30d)', () => {
    const map = ['##############', '#......#.....#', '#..v...+.....#', '#......#..p..#', '#......#.....#', '##############'];
    const s = Setup.room(1, { acc: 'T0', depth: 1, map, you: [2, 2] });
    s.dept.seen = '1'.repeat(s.dept.w * s.dept.h);
    const soft = { k: 'noise', x: 5, y: 2, cls: 'soft', range: N.NOISE_SOFT, cause: {} }, loud = { k: 'noise', x: 9, y: 2, cls: 'loud', range: N.NOISE_LOUD, cause: {} };
    const vm = ViewModel.derive(s, { events: [soft, loud] }), noise = vm.marks.filter(k => k.kind === 'noise');
    const S = heard(s.dept, 5, 2, N.NOISE_SOFT), L = heard(s.dept, 9, 2, N.NOISE_LOUD);
    const want = [...new Set([...S, ...L])].map(k => k.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0])
      .map(([x, y]) => ({ kind: 'noise', x, y, cls: L.has(x + ',' + y) ? 'loud' : 'soft' }));
    same(noise, want);
    assert.ok(noise.some(k => k.cls === 'soft') && noise.some(k => k.cls === 'loud') && [...S].some(k => L.has(k)), 'the two noises overlap, and each has tiles of its own');
    assert.ok(noise.some(k => k.x === 3 && k.y === 2) && noise.some(k => k.x === 10 && k.y === 3), 'a case and a plinth an exhibit could stand on are heard');
    const ids = vm.marks.map(k => k.kind + ':' + k.x + ',' + k.y);
    assert.equal(new Set(ids).size, ids.length, 'mark ids are unique');
    // Only on tiles you have seen.
    s.dept.seen = '';
    const fresh = ViewModel.derive(s, { events: [soft, loud] });
    for (const k of fresh.marks) assert.ok(fresh.vis[k.y * fresh.w + k.x] > 0, `a noise mark on the unseen ${k.x},${k.y}`);
    assert.ok(fresh.marks.length < noise.length);
    // From a real step: a bash's loud noise from the case tile, and the crash when it breaks.
    const t = Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [4, 3], fixtures: [C.Cases.make({ x: 5, y: 3, room: 'room', num: '1.1.1', glass: 1, lock: 1 })] });
    Grid.set(t.dept, 5, 3, 'v');
    const ev = Step.step(t, { a: 'bash', x: 5, y: 3 }), n = ev.find(e => e.k === 'noise');
    assert.ok(n && n.cls === 'crash', json(ev.map(e => e.k)));
    const v2 = ViewModel.derive(t, { events: ev });
    assert.ok(v2.marks.filter(k => k.kind === 'noise').every(k => k.cls === 'crash') && v2.marks.some(k => k.kind === 'noise' && k.x === 5 && k.y === 3));
    same(v2.cues.broke, [{ x: 5, y: 3 }], 'the glass that broke is a cue');
  });

  test('telegraph and call marks: on tiles in view, one a tile; two calls over one tile make one mark; the camera leans towards a telegraph on you', () => {
    const her = H.species(C, 'herald').find(x => x.depth === 3).sp, sn = H.species(C, 'axis_sniper').find(x => x.depth === 3).sp;
    const s = Setup.room(1, { acc: 'S9', depth: 3, map: OPEN, you: [2, 3], exhibits: [
      { sp: her.id, at: [5, 2], mode: 'hunting', stats: Roles.stats(her.role, 3) }, { sp: her.id, at: [6, 4], mode: 'hunting', stats: Roles.stats(her.role, 3) },
      { sp: sn.id, at: [9, 3], mode: 'hunting', stats: Roles.stats(sn.role, 3) }] });
    for (const a of s.actors.slice(1, 3)) Specials.mark(s, a, 'call', Specials.tiles(s, a, 'call'), []);
    const b = s.actors[3];
    Specials.mark(s, b, 'line', Specials.tiles(s, b, 'line'), []);
    const vm = ViewModel.derive(s, {}), ids = vm.marks.map(k => k.kind + ':' + k.x + ',' + k.y);
    assert.equal(new Set(ids).size, ids.length, 'mark ids are unique');
    const calls = vm.marks.filter(k => k.kind === 'call'), raw = Specials.marks(s).filter(k => k.kind === 'call');
    assert.ok(raw.length > calls.length, 'the two calls share tiles');
    same([...new Set(raw.map(k => k.x + ',' + k.y))].sort(), calls.map(k => k.x + ',' + k.y).sort(), 'one call mark a tile');
    for (const k of calls) assert.equal(k.by, raw.find(r => r.x === k.x && r.y === k.y).by, 'the first herald\'s');
    const tele = vm.marks.filter(k => k.kind === 'telegraph');
    same(tele, Specials.marks(s).filter(k => k.kind === 'telegraph').map(k => ({ kind: 'telegraph', x: k.x, y: k.y, dmg: k.dmg, by: k.by })));
    same(vm.actors.filter(a => a.telegraphing).map(a => [a.uid, a.telegraphing]), [[s.actors[1].uid, 'call'], [s.actors[2].uid, 'call'], [b.uid, 'line']]);
    // The beam covers you, so the camera leans along it, towards the sniper, by at most LEAN.
    same(vm.camera, { x: 2 + ViewModel.LEAN, y: 3 });
    // Off the beam it stays on you; and a telegraph on a tile out of view is not drawn.
    s.actors[0].y = 1;
    same(ViewModel.derive(s, {}).camera, { x: 2, y: 1 });
    const walled = ['############', '#....#.....#', '#....#.....#', '############'];
    const w = Setup.room(1, { acc: 'M11', depth: 3, map: walled, you: [2, 1], exhibits: [{ sp: sn.id, at: [9, 2], mode: 'hunting', stats: Roles.stats(sn.role, 3) }] });
    w.actors[1].telegraph = { sp: 'line', tiles: [[8, 2], [7, 2], [6, 2]], from: [[9, 2], [8, 2], [7, 2]], via: [null, null, null], gross: 9, effect: 'damage', turn: 0, tick: 0 };
    same(ViewModel.derive(w, {}).marks, [], 'marks behind a wall are not shown');
  });

  test('cases, staff doors, items, labels and surfaces: what stands or lies on the tiles in view, as the state has it', () => {
    const map = ['############', '#...v...S..#', '#..........#', '#..v..#....#', '#.....#..v.#', '############'];
    const s = Setup.room(1, { acc: 'S9', depth: 3, map, you: [2, 2], grade: 2, fixtures: [
      C.Cases.make({ x: 4, y: 1, room: 'room', num: '1.1.1', glass: 2, lock: 3, hits: 1, holds: 'held' }), C.Cases.make({ x: 3, y: 3, room: 'room', num: '1.1.2', loan: true }),
      C.Cases.make({ x: 9, y: 4, room: 'room', num: '1.1.3' }), { k: 'staff', x: 8, y: 1, grade: 4 }, { k: 'plaque', x: 0, y: 2, ck: 'plan' }],
      items: [{ uid: 'held', kind: 'curio', where: { at: 'case', x: 4, y: 1 } }, { uid: 'floor', kind: 'weapon', form: 'light', tier: 1, where: { at: 'floor', x: 5, y: 2 } },
        { uid: 'far', kind: 'garment', form: 'standard', tier: 1, where: { at: 'floor', x: 10, y: 4 } }] });
    C.Consumables.startRun(s);
    const pot = C.Consumables.make(s, 'solvent', { at: 'floor', x: 6, y: 2 });
    C.Surfaces.add(s, 'dust', 5, 4, 3, 3, null, []);
    const vm = ViewModel.derive(s, {}), now = seenNow(s), shown = (x, y) => !!now[y * s.dept.w + x];
    same(vm.cases.map(c => [c.x, c.y]), s.dept.fixtures.filter(f => f.k === 'case' && shown(f.x, f.y)).map(f => [f.x, f.y]));
    const c = vm.cases.find(q => q.x === 4);
    same([c.glass, c.hits, c.need, c.lock, c.st, c.loan, c.holds.uid, c.canOpen, c.num], [2, 1, 2, 3, 'shut', false, 'held', false, '1.1.1']);
    assert.ok(vm.cases.find(q => q.x === 3).loan);
    same(vm.staff, s.dept.fixtures.filter(f => f.k === 'staff' && shown(f.x, f.y)).map(f => ({ x: f.x, y: f.y, grade: 4, open: false, canOpen: false })));
    same(vm.plaques.map(p => [p.x, p.y]), shown(0, 2) ? [[0, 2]] : []);
    const want = s.items.filter(i => (i.where.at === 'floor' || i.where.at === 'case') && shown(i.where.x, i.where.y)).map(i => i.uid);
    same(vm.items.map(i => i.uid), want, 'items on tiles in view, in state order');
    assert.ok(want.includes(pot.uid) && want.includes('floor') && want.includes('held'), json(want));
    assert.equal(want.includes('far'), shown(10, 4), 'the garment behind the wall is listed only if in view');
    const it = vm.items.find(i => i.uid === pot.uid);
    same([it.icon, it.kind, it.shape, it.ck], ['seal', 'consumable', Registry.SEALS[C.Consumables.sealFor(s, 'solvent')].shape, null], 'a consumable shows its seal\'s shape, not its kind');
    // Surfaces: every tile in view that one covers, once a kind.
    const covered = [];
    for (let y = 3; y <= 5; y++) for (let x = 4; x <= 6; x++) if (shown(x, y)) covered.push({ kind: 'dust', x, y });
    assert.ok(covered.length > 0);
    same(vm.surfaces, covered);
  });

  test('you, the clock and the floor plan: your grade from the run, your kit, tote, charges, statuses and stats; the clock as Clock.view gives it; the plan once read', () => {
    const s = Dept.create(3, 'M11', 2);
    s.run.grade = 3;
    s.actors[0].statuses.push({ id: 'slowed', until: 9, turns: null, from: 0 });
    let vm = ViewModel.derive(s, {});
    const you = s.actors[0];
    same(vm.you, { x: you.x, y: you.y, hp: you.hp, maxHp: you.maxHp, grade: 3, statuses: ['slowed'], kit: { weapon: 'you.w', garment: 'you.g', curio: [null, null], instrument: null },
      tote: [], consumables: [], charges: null, seated: false, acc: you.acc, eva: you.eva, pad: you.pad });
    same(vm.clock, Object.assign({ turn: s.dept.clock.count }, C.Clock.view(s)));
    for (const k of ['count', 'B', 'G', 'stage', 'toBell', 'toWatch', 'toNightBell', 'watchBack']) assert.ok(k in vm.clock, k);
    assert.equal(ViewModel.derive(C.TestRoom.create(1), {}).clock, null, 'no clock in the test room');
    assert.equal(vm.plan, null);
    same([vm.known, vm.pending], [[], null]);
    // A Floor Plan read: the rooms whose Highlight is still there, with where they are.
    s.dept.planRead = s.turn;
    vm = ViewModel.derive(s, {});
    const rooms = C.Consumables.planRooms(s);
    assert.ok(rooms.length > 0);
    same(vm.plan, rooms.map(k => { const r = s.dept.rooms.find(q => q.key === k); return { key: k, number: r.number, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 }; }));
    // Highlights are not in the view model except through the plan.
    for (const h of s.dept.highlights) assert.ok(!json(Object.assign({}, vm, { items: [] })).includes(h.uid), `${h.uid} is named`);
  });

  test('the aim: the tile aimed at, and a thrown Solution\'s square round it, its kind\'s once known and the largest one while it is not', () => {
    const s = Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [2, 3], items: [{ uid: 'f', kind: 'consumable', ck: 'fumigant', where: { at: 'tote' } }, { uid: 'w', kind: 'weapon', form: 'light', tier: 1, where: { at: 'tote' } }] });
    C.Consumables.startRun(s);
    const marks = ui => ViewModel.derive(s, ui).marks;
    const square = (x, y, size) => { const h = Math.floor(size / 2), out = []; for (let j = y - h; j <= y + h; j++) for (let i = x - h; i <= x + h; i++) out.push({ kind: 'area', x: i, y: j }); return out; };
    same(marks({ aim: { x: 6, y: 3, uid: 'f' } }), square(6, 3, C.Consumables.AREA).concat([{ kind: 'aim', x: 6, y: 3 }]), 'unknown: the largest Solution\'s square');
    s.run.knownSeals.push(C.Consumables.sealFor(s, 'fumigant'));
    same(marks({ aim: { x: 6, y: 3, uid: 'f' } }), square(6, 3, N[Registry.CONSUMABLES.fumigant.area]).concat([{ kind: 'aim', x: 6, y: 3 }]), 'known: its own');
    same(marks({ aim: { x: 6, y: 3, uid: 'w' } }), [{ kind: 'aim', x: 6, y: 3 }], 'no square for what is not a Solution');
    same(marks({ aim: { x: 6, y: 3, size: 1 } }), [{ kind: 'area', x: 6, y: 3 }, { kind: 'aim', x: 6, y: 3 }]);
    same(marks({ aim: { x: 99, y: 3 } }), [], 'off the map');
  });

  test('the one-turn cues: who moved and from where, who was hit, glass that broke in view, and whose special went off', () => {
    const sn = H.species(C, 'axis_sniper').find(x => x.depth === 2).sp;
    const s = Setup.room(1, { acc: 'M11', depth: 2, map: OPEN, you: [2, 2], exhibits: [{ sp: sn.id, at: [8, 2], mode: 'hunting', stats: Roles.stats(sn.role, 2) }] });
    s.actors[0].hp = s.actors[0].maxHp = 999;
    let ev = Step.step(s, { a: 'wait' });
    assert.ok(ev.some(e => e.k === 'telegraphed'));
    ev = Step.step(s, { a: 'wait' });
    const vm = ViewModel.derive(s, { events: ev });
    same([vm.cues.hit, vm.cues.special], [['you'], [s.actors[1].uid]]);
    // A cancelled special is no cue; a special by an actor out of view is none either.
    same(ViewModel.derive(s, { events: [{ k: 'special', who: s.actors[1].uid, sp: 'line', cancelled: true }] }).cues.special, []);
    same(ViewModel.derive(s, { events: [{ k: 'glass_broke', x: 99, y: 99 }, { k: 'glass_broke', x: 3, y: 2 }, { k: 'glass_broke', x: 3, y: 2 }] }).cues.broke, [{ x: 3, y: 2 }]);
  });
};
