// The item placement from gallery lists and S.9's treasure case (M4 plan D-ITEMS, A10, D2;
// BUILD.md §5.2, §5.5, §8.5, §8.6). The figures expected are worked out here from BUILD's
// sentences, never from the placement code:
//   - the sweep's items check (test/sweep/items.check.js, run on every department of the
//     shared sweep by test/m4-sweep.test.js) holds on departments as they are made, and catches
//     each planted fault: an item out of its room or its nest, a case left empty under an item
//     on the floor, the treasure out of its case, its glass or its loan wrong, its case too near
//     an opening, a count off, a kit in the hall, an item placed twice;
//   - the item placement: the treasure in the hall's case, an item listed after a warden in
//     its nest, `case: true` in an empty case of its room or on its floor, the rest on the
//     floor; the rest of §8.5's counts drawn; the log saying what was not where its entry
//     asked; a gallery with no room; a Signature piece listed as loot refused; draws only on
//     `…/items` and the rooms' populate streams; nothing moved by removing an exhibit or by
//     switching a module off;
//   - the treasure validator (js/core/layout/treasure.js): LAMP_CASE_MIN_WALK from every
//     opening of the hall, at 5 and 6 walking tiles; the treasure out of a case, no case,
//     a case no opening reaches; a rejected attempt reseeds; and over S.9's seeds, its
//     reseed rate, the first-attempt share and the fallbacks;
//   - the curation follow-up (js/core/layout/curate.js): a treasure's hall has its wall case
//     deep in the hall, and without it most first plans would be rejected;
//   - the case with the test-only Centrepiece core (as ARCH-CP-CORE's and PG-VIEW's tests make
//     one) standing as S.9's Composite: the case, the Lamp in it and its walk as the hall's
//     openings give them, the items as without it; the case bashed open, the Lamp taken, worn
//     and lit, joined up with every invariant;
//   - the item lint: a record's text that says where an item lies, or names one, is listed
//     with what keeps it, and the sweep checks each;
//   - `lint-registry --report S9` lists the treasure case's glass.
'use strict';
const H = require('./behaviour/_harness.js');

module.exports = ({ test, assert, loadCore, root, path }) => {
  const C = loadCore();
  const { Packs, Dept, Cases, LTreasure, Layout, Grid, N, State, Rng, Kit } = C;
  const json = x => JSON.stringify(x);
  const depthOf = seed => 1 + ((seed - 1) % 7);
  const ACCS = ['S9', 'A4', 'M11'];
  const CHECK = path.join(root, 'test/sweep/items.check.js');
  const check = X => require(CHECK)(X);
  // Every M4 species' archetype, modifier and trigger past ready false, as their packages
  // leave them (m4-packs' planting).
  const M4_READY = { ARCHETYPES: ['unobserved_mover', 'patrol_guard', 'demonstrator', 'conservator_healer'], MODIFIERS: ['clockwork'], TRIGGERS: ['period'] };
  function readyCore() {
    const X = loadCore();
    for (const t of Object.keys(M4_READY)) for (const id of M4_READY[t]) if (X.Registry[t][id].ready === false) X.Registry[t][id].ready = 'unit';
    return X;
  }
  const hallOf = s => s.dept.rooms.find(r => r.role === 'centre');
  const itemOf = (s, ref) => s.items.find(i => i.ref === ref);
  // Set a tile of a department's map.
  const setTile = (m, x, y, ch) => { m.tiles[y] = m.tiles[y].slice(0, x) + ch + m.tiles[y].slice(x + 1); };
  // The hall's ways in, and a tile's walking distance from the nearest as a case's (1 + the
  // nearest tile beside it that can be walked on, a diagonal past a corner included, as §5.5
  // measures a case): written here from §5.5, apart from LTreasure.
  function caseWalkAt(m, hall, x, y) {
    const inHall = (u, v) => Grid.inside(m, u, v) && m.roomOf[v][u] === hall.id, ops = [];
    for (let v = 0; v < m.h; v++) for (let u = 0; u < m.w; u++) if (!inHall(u, v) && Grid.walkable(m, u, v) && [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => inHall(u + dx, v + dy))) ops.push([u, v]);
    const d = Grid.distances(m, ops, m.w * m.h);
    let best = -1;
    for (let k = 0; k < 8; k++) {
      const u = x + Grid.DX[k], v = y + Grid.DY[k];
      if (Grid.walkable(m, u, v) && d[v * m.w + u] >= 0 && (best < 0 || d[v * m.w + u] + 1 < best)) best = d[v * m.w + u] + 1;
    }
    return { walk: best, ops };
  }

  // ---- The sweep's items check ----

  test('the sweep\'s items check holds on departments as they are made, every M4 archetype ready or not, and S.9\'s Round Book 9 lies in the Brooder\'s nest whenever it has one', () => {
    for (const X of [C, readyCore()]) {
      const chk = check(X);
      for (const acc of ACCS) for (let seed = 1; seed <= 8; seed++) assert.equal(chk.each({ state: X.Dept.create(seed, acc, depthOf(seed)), seed, acc, depth: depthOf(seed) }), null, `${acc} seed ${seed}`);
      assert.equal(chk.done(), null);
      assert.ok(chk.tally.nests > 0 && chk.tally.nests < chk.tally.S9 && chk.tally.treasures === chk.tally.S9, json(chk.tally));
    }
  });

  test('the sweep\'s items check catches each planted fault', () => {
    const chk = check(C), at = (s, acc, seed) => chk.each({ state: s, seed, acc, depth: s.dept.depth });
    const S9 = seed => Dept.create(seed, 'S9', depthOf(seed));
    // A department where the Brooder has its nest, and one where it has none.
    let nested = null, bare = null;
    for (let seed = 1; seed <= 20 && !(nested && bare); seed++) {
      const s = S9(seed), w = s.actors.find(a => a.sp === 'S9.4'), f = Cases.at(s, w.guards[0], w.guards[1]);
      if (f && f.k === 'case') nested = nested || seed; else bare = bare || seed;
    }
    assert.ok(nested && bare, `${nested} ${bare}`);
    const plants = [
      // Round Book 9 out of the nest, on a free floor tile of its room.
      [nested, 'S9', s => {
        const rb = itemOf(s, 'S9.10'), f = Cases.at(s, rb.where.x, rb.where.y), m = s.dept, rm = m.roomOf[rb.where.y][rb.where.x];
        const t = [];
        for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.roomOf[y][x] === rm && m.tiles[y][x] === '.' && !s.actors.some(a => a.x === x && a.y === y) && !s.items.some(i => i.where.x === x && i.where.y === y)) t.push([x, y]);
        f.holds = null; rb.where = { at: 'floor', x: t[0][0], y: t[0][1] };
      }, /not in .*nest at .*S9\.4: Round Book 9 lies at/],
      // Round Book 9 gone from the department.
      [bare, 'S9', s => { itemOf(s, 'S9.10').where = { at: 'gone' }; }, /S9\.10 is placed 0 times.*S9\.4: Round Book 9 is not in the department/],
      // The Lamp out of its case, on the case's tile's neighbour.
      [1, 'S9', s => { const it = itemOf(s, 'S9.11'), f = LTreasure.caseOf(s); f.holds = null; const n = Grid.DX.map((dx, k) => [f.x + dx, f.y + Grid.DY[k]]).find(([x, y]) => s.dept.tiles[y][x] === '.'); it.where = { at: 'floor', x: n[0], y: n[1] }; }, /S9\.11 is not in the hall's case/],
      [3, 'S9', s => { LTreasure.caseOf(s).glass = 1; }, /the treasure case is glass 1, lock \d+; it should be glass 3/],
      [3, 'S9', s => { LTreasure.caseOf(s).loan = true; }, /, on loan; it should be/],
      // The case moved onto a floor tile of the hall beside an opening.
      [4, 'S9', s => {
        const m = s.dept, f = LTreasure.caseOf(s), it = itemOf(s, 'S9.11'), { ops } = caseWalkAt(m, hallOf(s), f.x, f.y);
        const [ox, oy] = ops[0], to = Grid.DX.map((dx, k) => [ox + dx, oy + Grid.DY[k]]).find(([x, y]) => m.roomOf[y][x] === hallOf(s).id && m.tiles[y][x] === '.' && !s.actors.some(a => a.x === x && a.y === y));
        setTile(m, f.x, f.y, '.'); setTile(m, to[0], to[1], 'v'); f.x = to[0]; f.y = to[1]; it.where = { at: 'case', x: to[0], y: to[1] };
      }, /the treasure case at \d+,\d+ is [1-3] walking tiles from the hall's nearest opening, under 6/],
      // A.4's Date Stamp (case: true) on the floor, its case left empty.
      [5, 'A4', s => { const it = itemOf(s, 'A4.6'), f = Cases.at(s, it.where.x, it.where.y); assert.ok(f, 'the Date Stamp is in a case'); f.holds = null; const n = Grid.DX.map((dx, k) => [f.x + dx, f.y + Grid.DY[k]]).find(([x, y]) => s.dept.tiles[y][x] === '.' && !s.items.some(i => i.where.x === x && i.where.y === y) && !s.actors.some(a => a.x === x && a.y === y)); it.where = { at: 'floor', x: n[0], y: n[1] }; },
        /A4\.6\) lies on the floor while s\d has an empty case at/],
      // An item drawn too many: a Restoration kit's place given to a second Apron.
      [2, 'M11', s => { const k = s.items.find(i => i.kind === 'kit'); Kit.make(s, { id: 'M11.7', kind: 'garment', form: 'standard', tier: 1, prims: [{ id: 'pad', cls: 'M' }] }, { at: 'floor', x: k.where.x, y: k.where.y }); s.items.splice(s.items.indexOf(k), 1); },
        /^2 weapons and garments and 1 curios and instruments drawn, for 1 and 1; 1 Restoration kits/],
      // A kit carried into the hall.
      [2, 'A4', s => { const k = s.items.find(i => i.kind === 'kit'), h = hallOf(s), m = s.dept; for (let y = h.y0; y <= h.y1; y++) for (let x = h.x0; x <= h.x1; x++) if (m.tiles[y][x] === '.' && !s.actors.some(a => a.x === x && a.y === y)) { k.where = { at: 'floor', x, y }; return; } },
        /\.i\d+ \(restoration\) lies in centre, not a section or study; the Highlights are not the kits with their rooms/],
      // A listed item placed twice.
      [6, 'A4', s => { const it = itemOf(s, 'A4.10'); s.items.push(Object.assign(JSON.parse(json(it)), { uid: it.uid + 'x' })); }, /A4\.10 is placed 2 times/],
    ];
    for (const [seed, acc, plant, want] of plants) {
      const s = acc === 'S9' ? S9(seed) : Dept.create(seed, acc, depthOf(seed));
      assert.equal(at(s, acc, seed), null, `${acc} seed ${seed} before the plant`);
      plant(s);
      assert.match(at(s, acc, seed) || '', want, `${acc} seed ${seed}`);
    }
  });

  // ---- The item placement ----

  test('the item placement: the treasure in the hall\'s case, Round Book 9 in the Brooder\'s nest or else its room, each case: true item in an empty case of its room or on its floor, the rest on the floor; then the rest of §8.5\'s counts; and the log says what is not where its entry first asked', () => {
    let floored = 0, unnested = 0;
    for (let seed = 1; seed <= 14; seed++) {
      const g = Dept.generate(seed, 'S9', depthOf(seed)), s = g.state, m = s.dept, items = s.items.filter(i => !i.uid.startsWith('you.') && i.kind !== 'consumable');
      const roomOf = it => m.rooms.find(r => r.id === m.roomOf[it.where.y][it.where.x]), named = rm => (C.Populate.galleryOf(s, rm.id) || { name: rm.role }).name;
      // S.9's list: the Overshoes in the court (no cases there: its floor), Round Book 9, the
      // Tongs and the Pin-Driver in the band room, the Lamp in the hall; nothing to draw beyond
      // them but the kits.
      assert.equal(json(items.filter(i => i.kind !== 'kit').map(i => [i.ref, named(roomOf(i))]).sort()),
        json([['S9.10', 'The Brooders’ Bay'], ['S9.11', 'The Day Curator’s Case'], ['S9.7', 'The Mount Court'], ['S9.8', 'The Brooders’ Bay'], ['S9.9', 'The Brooders’ Bay']]), `seed ${seed}`);
      const lamp = itemOf(s, 'S9.11'), f = LTreasure.caseOf(s);
      assert.equal(json([lamp.where, f.holds, f.loan, 'lit' in lamp]), json([{ at: 'case', x: f.x, y: f.y }, lamp.uid, false, false]), `seed ${seed}: the Lamp, hooded, in its case`);
      assert.equal(lamp.uid, `S9.${depthOf(seed)}.centre.i1`);
      const say = g.log.filter(l => l.check === 'items').map(l => l.op);
      const court = m.rooms.find(r => named(r) === 'The Mount Court'), shoes = itemOf(s, 'S9.7');
      if (shoes.where.at === 'floor') { floored++; assert.ok(say.includes(`S9.7 finds no empty case in ${court.key} and lies on its floor`), json(say)); }
      const w = s.actors.find(a => a.sp === 'S9.4'), nest = Cases.at(s, w.guards[0], w.guards[1]);
      if (!nest) { unnested++; assert.ok(say.includes(`S9.10 is not in a nest: ${w.uid} guards no case, so it lies in its room as its entry says`), json(say)); }
      else assert.equal(json(itemOf(s, 'S9.10').where), json({ at: 'case', x: nest.x, y: nest.y }), `seed ${seed}: in the nest`);
    }
    assert.ok(floored > 0 && unnested > 0, `${floored} ${unnested}`);
    // A.4: the Date Stamp in a case of the Copying Room, the Register on the last section's
    // floor, and one more weapon or garment drawn from the two no gallery lists; M.11: the
    // Signal Flag on the Logbook Room's section's floor, the Apron drawn (the one weapon or
    // garment left) and the Hand Lamp (the one curio or instrument but the Signature piece).
    for (let seed = 1; seed <= 7; seed++) {
      const a = Dept.create(seed, 'A4', seed), m = a.dept, last = m.rooms.filter(r => r.role === 'section').sort((p, q) => Number(p.key.slice(1)) - Number(q.key.slice(1))).pop();
      const roomOf = it => m.rooms.find(r => r.id === m.roomOf[it.where.y][it.where.x]), names = rm => C.Populate.galleriesOf(a, rm.id).map(q => q.name);
      assert.ok(names(roomOf(itemOf(a, 'A4.6'))).includes('The Copying Room') && roomOf(itemOf(a, 'A4.10')) === last && names(last).includes('The Registry') && itemOf(a, 'A4.10').where.at === 'floor', `A4 seed ${seed}`);
      assert.equal(a.items.filter(i => ['A4.7', 'A4.8'].includes(i.ref)).length, 1, `A4 seed ${seed}: one drawn`);
      const b = Dept.create(seed, 'M11', seed);
      assert.equal(json(b.items.filter(i => i.ref && i.kind !== 'kit').map(i => i.ref).sort()), json(['M11.6', 'M11.7', 'M11.9']), `M11 seed ${seed}`);
    }
  });

  test('the item placement draws only on …/items and the rooms\' populate streams; removing an exhibit, or switching a module off, moves no item; a department is made the same twice', () => {
    const X = loadCore(), paths = [];
    let on = false;
    const stream = X.Rng.stream, place = X.Kit.place;
    X.Rng.stream = (h, p) => { if (on) paths.push(p); return stream(h, p); };
    X.Kit.place = (...a) => { on = true; try { return place(...a); } finally { on = false; } };
    for (const acc of ACCS) X.Dept.create(3, acc, 4);
    assert.ok(paths.length > 10 && paths.every(p => /^layout\/[A-Z0-9]+@\d+\/d4\/a\d\/(items|room\/[a-z0-9]+\/populate)$/.test(p)), json([...new Set(paths)]));
    for (const [acc, seed, depth] of [['S9', 1, 3], ['A4', 2, 5]]) {
      const base = Dept.create(seed, acc, depth);
      assert.equal(State.hash(Dept.create(seed, acc, depth)), State.hash(base), 'the same twice');
      for (const a of base.actors.slice(1)) assert.equal(json(Dept.create(seed, acc, depth, { without: [a.uid] }).items), json(base.items), `${acc}: without ${a.uid} (${a.sp})`);
      const off = Dept.create(seed, acc, depth, { rulesOff: Packs.get(acc).modules.map(q => q.id) });
      assert.equal(json([off.items, off.dept.fixtures]), json([base.items, base.dept.fixtures]), `${acc}: every module off`);
    }
  });

  test('a listed item whose gallery has no room here is placed as the stand-in places one, and logged; a Signature piece listed as loot is refused', () => {
    const X = loadCore(), exhibits = X.Populate.exhibits;
    // The band room keeps no record of its gallery (as if the list mapped none there).
    X.Populate.exhibits = (state, plan, pack, base, log) => { const r = exhibits(state, plan, pack, base, log); for (const rm of state.dept.rooms) if ((X.Populate.galleryOf(state, rm.id) || {}).key === 's2') delete rm.galleries; return r; };
    const g = X.Dept.generate(2, 'S9', 3), s = g.state, m = s.dept;
    for (const ref of ['S9.10', 'S9.8', 'S9.9']) {
      const it = s.items.find(i => i.ref === ref), rm = m.rooms.find(r => r.id === m.roomOf[it.where.y][it.where.x]);
      assert.ok(rm.role === 'section' || rm.role === 'study', ref);
      assert.ok(g.log.some(l => l.check === 'items' && l.op === `${ref} (The Brooders’ Bay) is placed as the stand-in places an item: its gallery has no room here`), ref);
    }
    assert.equal(s.items.filter(i => i.kind === 'kit').length, N.KITS_PER_DEPT);
    const Y = loadCore();
    Y.Packs.get('A4').galleries.find(q => q.key === 's2').contents.push({ item: 'A4.11' });
    assert.throws(() => Y.Dept.create(1, 'A4', 3), /lists its Signature piece A4\.11, which is no loot/);
    const Z = loadCore();
    Z.Packs.get('S9').galleries.find(q => q.key === 's1').contents.push({ item: 'S9.11', case: true });
    Z.Packs.get('S9').galleries.find(q => q.key === 'centre').contents.pop();
    assert.throws(() => Z.Dept.create(1, 'S9', 3), /lists its Signature piece S9\.11, which is no loot/);
  });

  // ---- The treasure validator ----

  test('the treasure validator: the Lamp in the hall\'s case, at least LAMP_CASE_MIN_WALK walking tiles from every opening of the hall; at 5 it is rejected, naming the case and the opening, at 6 it passes; the Lamp out of a case, no case, a case no opening reaches, each rejected; no treasure, no concern', () => {
    assert.ok(C.Populate.validatorIds().includes('treasure'));
    assert.equal(LTreasure.check(C.TestRoom.create(1), null), null);
    for (const acc of ['A4', 'M11']) assert.equal(LTreasure.check(Dept.create(1, acc, 3), null), null, acc);
    let at5 = 0, at6 = 0;
    for (let seed = 1; seed <= 7; seed++) {
      const base = Dept.create(seed, 'S9', depthOf(seed)), hall = hallOf(base), f0 = LTreasure.caseOf(base);
      assert.equal(LTreasure.check(base, null), null, `seed ${seed}`);
      const mine = caseWalkAt(base.dept, hall, f0.x, f0.y);
      assert.equal(json(LTreasure.walk(base).walk), json(mine.walk));
      assert.equal(json(LTreasure.openings(base)), json(mine.ops), `seed ${seed}: the openings`);
      assert.ok(mine.walk >= N.LAMP_CASE_MIN_WALK, `seed ${seed}: ${mine.walk}`);
      // Move the case to each floor tile of the hall in turn: rejected below 6, passing at 6+.
      const m0 = base.dept;
      for (let y = hall.y0; y <= hall.y1; y++) for (let x = hall.x0; x <= hall.x1; x++) {
        if (m0.roomOf[y][x] !== hall.id || m0.tiles[y][x] !== '.' || base.actors.some(a => C.Actors.covers(a, x, y))) continue;
        const s = State.clone(base), m = s.dept, f = LTreasure.caseOf(s), it = itemOf(s, 'S9.11');
        setTile(m, f.x, f.y, '.'); setTile(m, x, y, 'v'); f.x = x; f.y = y; it.where = { at: 'case', x, y };
        const w = caseWalkAt(m, hall, x, y).walk, r = LTreasure.check(s, null);
        if (w === 5) {
          at5++;
          assert.match(r.reason, /^the case of The Day Curator’s Lamp at \d+,\d+ is 5 walking tiles from the hall's opening at \d+,\d+, nearer than LAMP_CASE_MIN_WALK \(6\)$/);
          const o = r.tiles[1];
          assert.equal(json(r.tiles[0]), json([x, y]));
          assert.equal(caseWalkAt(m, hall, x, y).walk, Grid.reachDist(Grid.distances(m, [o], m.w * m.h), m, x, y), 'the opening named is the nearest');
        } else if (w >= 6) { if (w === 6) at6++; assert.equal(r, null, `${x},${y} at ${w}`); }
        else if (w > 0) assert.ok(r && r.tiles.length === 2, `${x},${y} at ${w}`);
      }
    }
    assert.ok(at5 > 3 && at6 > 3, `${at5} at 5, ${at6} at 6`);
    // The Lamp on the floor; no case in the hall; a case no opening reaches.
    const s1 = Dept.create(2, 'S9', 3), f1 = LTreasure.caseOf(s1), l1 = itemOf(s1, 'S9.11');
    f1.holds = null; l1.where = { at: 'floor', x: 1, y: 1 };
    assert.equal(json(LTreasure.check(s1, null)), json({ reason: 'The Day Curator’s Lamp lies in no case of the hall (centre)', tiles: [[1, 1]] }));
    const s2 = Dept.create(2, 'S9', 3), f2 = LTreasure.caseOf(s2);
    setTile(s2.dept, f2.x, f2.y, '.'); s2.dept.fixtures.splice(s2.dept.fixtures.indexOf(f2), 1); itemOf(s2, 'S9.11').where = { at: 'floor', x: f2.x, y: f2.y };
    assert.match(LTreasure.check(s2, null).reason, /lies in no case of the hall/);
    assert.equal(LTreasure.caseOf(s2), null);
    const s3 = Dept.create(2, 'S9', 3), f3 = LTreasure.caseOf(s3);
    for (let k = 0; k < 8; k++) if (Grid.walkable(s3.dept, f3.x + Grid.DX[k], f3.y + Grid.DY[k])) setTile(s3.dept, f3.x + Grid.DX[k], f3.y + Grid.DY[k], 'o');
    assert.equal(json(LTreasure.check(s3, null)), json({ reason: `no opening of the hall reaches the case of The Day Curator’s Lamp at ${f3.x},${f3.y}`, tiles: [[f3.x, f3.y]] }));
  });

  test('S.9\'s treasure case: the glass the pack overrides, Security, Laminated at depths 1–2 where the mix holds none; its lock drawn for it, never on loan; and an attempt the validator rejects reseeds', () => {
    for (let depth = 1; depth <= 7; depth++) {
      assert.equal(LTreasure.glass(Packs.get('S9'), depth), depth <= 2 ? 2 : 3, `depth ${depth}`);
      for (const seed of [1, 2, 3]) {
        const f = LTreasure.caseOf(Dept.create(seed, 'S9', depth)), g = depth <= 2 ? 2 : 3;
        assert.equal(json([f.glass, f.loan]), json([g, false]));
        assert.ok(f.lock >= N.GLASS_LOCK_MIN[g - 1] && f.lock <= Math.max(N.GLASS_LOCK_MIN[g - 1], Math.min(N.GLASS_LOCK_MAX[g - 1], depth + 1)), `depth ${depth}: lock ${f.lock}`);
      }
    }
    assert.equal(LTreasure.glass(Packs.get('A4'), 3), null, 'A.4 overrides nothing');
    const X = loadCore();
    X.Packs.get('S9').centrepiece.treasure.case.glass = 4;
    assert.throws(() => X.LTreasure.glass(X.Packs.get('S9'), 3), /the glass 4, not 1–3/);
    // A rejected attempt: the first (seed, depth) whose first passing plan the validator turns down.
    let found = null;
    for (let seed = 1; seed <= 80 && !found; seed++) {
      const g = Dept.generate(seed, 'S9', 3);
      if (g.tries.some(t => t.some(f => f.id === 'treasure'))) found = { seed, g };
    }
    assert.ok(found, 'no treasure rejection in 80 seeds');
    const k = found.g.tries.findIndex(t => t.some(f => f.id === 'treasure')), no = found.g.tries[k].find(f => f.id === 'treasure');
    assert.match(no.why, /walking tiles from the hall's opening at \d+,\d+, nearer than LAMP_CASE_MIN_WALK/);
    assert.equal(no.tiles.length, 2);
    assert.ok(found.g.attempt > k && !found.g.fallback && LTreasure.check(found.g.state, null) === null, json([found.seed, found.g.attempt]));
  });

  test('over S.9\'s seeds the treasure validator turns down few first plans: at least 90% of departments come from the first layout attempt, at most 1% fall back; without the curation of a treasure\'s hall (its wall case deep in it) most first plans would be turned down', () => {
    let n = 0, first = 0, fallbacks = 0, rejected = 0, attempts = 0;
    for (let depth = 1; depth <= 7; depth++) for (let seed = 1; seed <= 15; seed++) {
      const g = Dept.generate(seed, 'S9', depth);
      n++; attempts += g.attempt + 1;
      if (g.attempt === 0) first++;
      if (g.fallback) fallbacks++;
      rejected += g.tries.filter(t => t.some(f => f.id === 'treasure')).length;
    }
    console.log(`  S.9, ${n} departments: ${first} from the first attempt, ${fallbacks} fallbacks, ${rejected} plans turned down by the treasure validator in ${attempts} attempts`);
    assert.ok(first * 10 >= n * 9 && fallbacks * 100 <= n && rejected * 10 <= attempts, `${first} ${fallbacks} ${rejected}`);
    // Each plan's hall case, as the first plan that passes layout has it, with and without the
    // treasure hall's curation (planted: Layout's flag cleared before curation).
    const share = X => {
      let ok = 0, total = 0, gap = true;
      for (let depth = 1; depth <= 7; depth++) for (let seed = 1; seed <= 10; seed++) {
        const plan = X.Layout.generate('sculpture_court', 0, seed, { acc: 'S9', depth }).plan, hall = plan.rooms.find(r => r.role === 'centre');
        const m = { w: plan.w, h: plan.h, tiles: plan.tiles.map(r => r.replace(/C/g, '.')), roomOf: plan.roomOf };
        const cases = [];
        for (let y = hall.y0; y <= hall.y1; y++) for (let x = hall.x0; x <= hall.x1; x++) if (plan.roomOf[y][x] === hall.id && m.tiles[y][x] === 'v') cases.push([x, y]);
        total++;
        if (cases.length === 1 && caseWalkAt(m, hall, cases[0][0], cases[0][1]).walk >= N.LAMP_CASE_MIN_WALK) ok++;
        const [px, py] = plan.cpl, [x, y] = cases[0];
        if (Math.max(x < px ? px - x : Math.max(0, x - px - 1), y < py ? py - y : Math.max(0, y - py - 1)) < 3) gap = false;
      }
      return { ok, total, gap };
    };
    const real = share(C), P = loadCore(), curate = P.LCurate.curate;
    P.LCurate.curate = (L, ...a) => { L.meta.treasure = false; return curate(L, ...a); };
    const plain = share(P);
    console.log(`  S.9's first plans with the hall's case at walk ${N.LAMP_CASE_MIN_WALK}+: ${real.ok} of ${real.total} curated as a treasure's hall, ${plain.ok} of ${plain.total} without`);
    assert.ok(real.ok * 10 >= real.total * 9 && real.gap, json(real));
    assert.ok(plain.ok * 2 < plain.total, json(plain));
    // Only a treasure's hall is curated so: A.4's and M.11's plans are as they were.
    for (const acc of ['A4', 'M11']) for (let seed = 1; seed <= 5; seed++) {
      const p = Packs.get(acc).programme;
      assert.equal(json(Layout.generate(p, 0, seed, { acc, depth: depthOf(seed) }).plan.tiles), json(P.Layout.generate(p, 0, seed, { acc, depth: depthOf(seed) }).plan.tiles), `${acc} seed ${seed}`);
    }
  });

  // ---- The case with the test-only Centrepiece core ----

  // S.9 with its own gallery list, every M4 archetype ready, and its Centrepiece's archetype the
  // test-only core (as ARCH-CP-CORE's tests make one: test_cp, added with the core's hooks),
  // a treasure guarding the Lamp, with a planted seal rule standing in for COMPOSITE-PHASES'.
  function cpCore() {
    const X = readyCore(), R = X.Registry;
    R.define('ARCHETYPES', 'test_cp', { built: 'M4', ready: 'unit', clause: 'Walks a tile at a time and strikes from beside you for {dmg}.', params: { dmg: 'role:DMG' }, covers: ['attacked', 'missed'] });
    X.Archetypes.add('test_cp', X.Centrepiece.hooks('test_cp', {}));
    const pack = X.Packs.get('S9');
    pack.centrepiece = Object.assign({}, pack.centrepiece, { archetype: 'test_cp', role: 'centrepiece', specials: ['cp_burst'] });
    X.Hall.defineSeal('treasure', (s, c) => { for (const u of c.uids) { const a = X.Actors.byUid(s, u); if (a && !a.gone && a.mode === 'hunting') return { why: 'touched' }; } return null; });
    return X;
  }

  test('with the test-only core as S.9\'s Composite, the hall holds it and the treasure case: the Lamp in the case, the case at least LAMP_CASE_MIN_WALK from every opening the hall records and 3 tiles from the footprint, the items as without it; the case bashed open, the Lamp taken, worn and lit, joined up', () => {
    const X = cpCore(), plainX = readyCore();
    for (const depth of [1, 3, 7]) for (const seed of [1, 2, 3]) {
      const s = X.Dept.create(seed, 'S9', depth, { invulnerable: true }), plain = plainX.Dept.create(seed, 'S9', depth, { invulnerable: true }), tag = `seed ${seed} d${depth}`;
      const cp = X.Hall.cp(s), f = X.LTreasure.caseOf(s), lamp = s.items.find(i => i.ref === 'S9.11');
      assert.ok(cp && cp.form === 'treasure' && cp.signature === 'S9.11', tag);
      assert.equal(json(cp.openings.map(o => [o.x, o.y])), json(X.LTreasure.openings(s)), `${tag}: the openings the hall records`);
      assert.equal(json([lamp.where, f.holds]), json([{ at: 'case', x: f.x, y: f.y }, lamp.uid]), tag);
      assert.ok(X.LTreasure.walk(s).walk >= N.LAMP_CASE_MIN_WALK && X.LTreasure.check(s, null) === null, tag);
      const [px, py] = cp.at;
      assert.ok(Math.max(f.x < px ? px - f.x : Math.max(0, f.x - px - 1), f.y < py ? py - f.y : Math.max(0, f.y - py - 1)) >= 3, `${tag}: the case at ${f.x},${f.y}, the footprint at ${cp.at}`);
      // Placing it changes no item, no case and no other exhibit.
      assert.equal(json([s.items, s.dept.fixtures.filter(q => q.k !== 'lectern'), s.actors.filter(a => !cp.uids.includes(a.uid))]), json([plain.items, plain.dept.fixtures, plain.actors]), `${tag}: the rest as without it`);
      if (depth !== 3) continue;
      // Beside the case (put there), bash it until it breaks, take the Lamp, wear it, light it.
      const you = s.actors[0], beside = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => [f.x + dx, f.y + dy]).find(([x, y]) => Grid.walkable(s.dept, x, y) && !X.Actors.at(s, x, y));
      you.x = beside[0]; you.y = beside[1];
      const r = H.play(X, s, st => {
        const c = X.LTreasure.caseOf(st), it = st.items.find(i => i.uid === lamp.uid);
        if (c.st === 'shut') return { a: 'bash', x: c.x, y: c.y };
        if (it.where.at === 'case') return { a: 'take', uid: lamp.uid };
        if (it.where.at === 'tote') return { a: 'equip', uid: lamp.uid };
        return it.lit ? null : { a: 'use', uid: lamp.uid };
      }, { inv: 'all', clone: seed === 1, cap: 40 });
      assert.deepEqual(r.violations.map(v => `${v.id}: ${v.text}`), [], tag);
      assert.equal(json([X.LTreasure.caseOf(s).st, s.items.find(i => i.uid === lamp.uid).where, X.Kit.observing(s)]), json(['broken', { at: 'kit', slot: 'curio0' }, N.LAMP_OBSERVE_RANGE]), tag);
      assert.equal(r.events.filter(e => e.k === 'glass_cracked' || e.k === 'glass_broke').length, N.GLASS_BASHES[2], `${tag}: Security takes ${N.GLASS_BASHES[2]} bashes`);
    }
  });

  // ---- The item lint ----

  // A placement claim about an item: words that say where it lies now, in its own paragraph or
  // tombstone, or in the text of another record that names it (by name or number). Each one a
  // pack makes is listed in ITEM_CLAIMS, with what keeps it, and the sweep's items check
  // (its own ITEM_CLAIMS) checks it on every department of the sweep.
  // (Past events are no claim: the Brooder's "which a keeper had left on a bench" says where the
  // book was, not where it lies; a claim is in the present, or a cross-reference.)
  const PLACEMENT = [/\bsee the case\b/i, /\bsee [A-Z]+\.\d+\.\d+\b/, /\bat the end of (this|the|each) row\b/i, /\b(in|inside) (a|the|its|this) (case|vitrine|cabinet|nest|drawer)\b/i,
    /\b(behind|under) glass\b/i, /\b(beside|next to|by) the (north|south|east|west)\b/i, /\b(on|along) the (north|south|east|west) wall\b/i, /\bat the side of the gallery\b/i,
    /\bin front of it\b/i, /\b(displayed|shown|kept) (\w+ ){0,2}together\b/i, /\b(displayed|kept|shown) (with|beside|next to)\b/i,
    /\b(lies|lie|rests|rest|stands|stand|is kept|are kept|is displayed|are displayed|is shown|are shown) (on|in|inside|beside|by|under|with|next to)\b/i];
  const ITEM_CLAIMS = {
    'S9.4': ['displayed the two together'], // the Brooder's paragraph, naming Round Book 9: the book lies in its nest, or with no nest in its room (the sweep)
    'S9.10': ['see S.9.4', 'in the nest'], // Round Book 9's Medium: "pages 40–112 in the nest (see S.9.4)": the Brooder's own nest, wherever it stands (the sweep)
  };
  const textOf = r => [r.paragraph].concat(r.tomb ? Object.keys(r.tomb).sort().map(k => r.tomb[k]) : []).filter(t => typeof t === 'string').join(' | ');
  const said = text => { const out = []; for (const re of PLACEMENT) { const m = re.exec(text); if (m) out.push(m[0]); } return out; };
  const NAMED = new RegExp(`\\b(in|at|into|inside) the (${Packs.list().flatMap(p => p.galleries.map(g => g.name.replace(/^The /, ''))).join('|')})\\b`);
  // The claims of a pack's records about its items: each item's own, and each other record's
  // that names one of them.
  function itemClaims(pack) {
    const out = {}, names = pack.items.map(i => [i.name.replace(/^The /, ''), i.id.replace(/^([A-Z]+)(\d+)\./, '$1.$2.')]);
    for (const r of [...pack.species, pack.centrepiece, ...pack.items].filter(Boolean)) {
      const t = textOf(r), isItem = pack.items.includes(r);
      if (!isItem && !names.some(([n, num]) => t.includes(n) || new RegExp(`\\b${num.replace(/\./g, '\\.')}\\b`).test(t))) continue;
      const c = said(t).concat(isItem && NAMED.exec(t) ? [NAMED.exec(t)[0]] : []);
      if (c.length) out[r.id] = c;
    }
    return out;
  }
  test('the item lint: a record says where an item lies only where the item placement keeps it, and the sweep checks each such claim', () => {
    const found = {};
    for (const p of Packs.list()) Object.assign(found, itemClaims(p));
    assert.equal(json(Object.keys(found).sort().map(k => [k, found[k].sort()])), json(Object.keys(ITEM_CLAIMS).sort().map(k => [k, ITEM_CLAIMS[k].slice().sort()])));
    assert.equal(json(check(C).claims), json(Object.keys(ITEM_CLAIMS).sort()), 'the sweep checks every claim listed here');
    // Planted texts, each caught.
    for (const [text, want] of [['The overshoes are kept in the case by the north lectern.', 'in the case'], ['Displayed with the brooder, the two kept together.', 'kept together'],
      ['Pages 1–39 in the nest (see S.9.4).', 'see S.9.4'], ['It lies on the bench by the door.', 'lies on'], ['Kept beside the tongs in the Brooders’ Bay.', 'Kept beside']]) assert.ok(said(text).includes(want), `${text}: ${json(said(text))}`);
    // A species naming an item, planted: its claim is the item's to keep.
    const X = loadCore(), q = X.Packs.get('S9');
    q.species.find(sp => sp.id === 'S9.3').paragraph += ' The Spring Pin-Driver is displayed with it.';
    q.items.find(i => i.id === 'S9.7').paragraph += ' They are kept in the Mount Court.';
    const got = itemClaims(q);
    assert.equal(json([got['S9.3'], got['S9.7']]), json([['displayed with', 'is displayed with'], ['are kept in', 'in the Mount Court']]));
  });

  test('lint-registry --report S9 lists the treasure case\'s glass, the one value the pack gives the item placement', () => {
    const r = require('node:child_process').spawnSync(process.execPath, [path.join(root, 'tools/lint-registry.js'), '--report', 'S9'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /^REPORT S9: centrepiece S9\.12\.treasure\.case\.glass = 3$/m);
  });
};
