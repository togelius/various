// The arena stamp (tools/arena.js; BUILD.md §10.3): its format, what each seed builds
// (the plan's D6.2), variants, goals and outcomes.
module.exports = ({ test, assert, loadCore, root, path, fs }) => {
  const C = loadCore([path.join(root, 'tools/arena.js')]);
  const A = C.Arena;
  const clean = s => assert.doesNotMatch(String(s), /undefined|NaN|\[object|\bnull\b/, `not a clean sentence: ${s}`);
  // Values made in the core's context have that context's prototypes, so compare as JSON.
  const J = v => JSON.parse(JSON.stringify(v)), eq = (a, b, m) => assert.deepEqual(J(a), J(b), m);
  const stamp = (head, map) => head.join('\n') + '\n\n' + map.join('\n') + '\n';

  test('the dummy stamp parses to its header and map; a minimal one gets the defaults', () => {
    const d = A.parse(A.DUMMY);
    assert.equal(d.arena, 'dummy');
    eq(d.goal, { k: 'kill', chars: [] });
    eq([d.cap, d.species, d.depths, d.seen], [200, ['plodder'], [2, 5], 'all']);
    eq(d.metric, { name: 'hpLost', test: 'ratio', at: 'most', pct: 90 });
    assert.equal(d.map.length, 5);
    assert.equal(C.State.plainData(d), null, 'a spec is plain data, so it can go into sim output whole');
    const m = A.parse(stamp(['arena: tiny', 'goal: leave'], ['#####', '#@.X#', '#####']));
    eq([m.cap, m.depths, m.seen, m.clock, m.metric, m.variants, m.kit, m.species], [200, [2, 5], 'none', null, null, [], [], []]);
    eq(m.legend, [{ ch: '@', parts: [{ what: 'you', on: null }] }]);
    // Comments in the header, and blank lines before it, are skipped.
    const c = A.parse('\n// a note\narena: tiny\n// another\ngoal: leave\n\n#####\n#@.X#\n#####\n\n');
    eq(c.map, ['#####', '#@.X#', '#####']);
  });

  test('a malformed stamp is refused with a sentence that says what is wrong', () => {
    const ok = ['arena: t', 'goal: kill', 'species: plodder', 'legend: P exhibit sp'];
    const room = ['#####', '#@.P#', '#####'];
    const cases = [
      [stamp(['goal: kill', 'legend: P exhibit sp'], room), /needs arena/],
      [stamp(['arena: t', 'legend: P exhibit sp'], room), /needs goal/],
      [stamp(ok.concat(['colour: red']), room), /no key colour/],
      [stamp(ok.concat(['cap: 100', 'cap: 200']), room), /cap is given twice/],
      [stamp(['arena: t', 'goal: win'].concat(ok.slice(2)), room), /goal is one of kill, reach, leave, take, open, not win/],
      [stamp(['arena: t', 'goal: reach'].concat(ok.slice(2)), room), /reach names the letters/],
      [stamp(['arena: t', 'goal: kill Q'].concat(ok.slice(2)), room), /the goal's Q is not in the legend/],
      [stamp(['arena: t', 'goal: open P'].concat(ok.slice(2)), room), /open P: that letter is not a case/],
      [stamp(['arena: t', 'goal: take P'].concat(ok.slice(2)), room), /take P: that letter holds no item/],
      [stamp(ok, ['#####', '#@.Q#', '#####']), /"Q" is neither a tile nor in the legend/],
      [stamp(ok.concat(['legend: o exhibit sp']), room), /o is already a tile \(column\)/],
      [stamp(ok, ['#####', '#@.P##', '#####']), /every map row is 5 characters wide; this one is 6/],
      [stamp(ok, ['#####', '#..P#', '#####']), /show you exactly once, not 0/],
      [stamp(ok, ['#####', '#@@P#', '#####']), /show you exactly once, not 2/],
      [stamp(ok.concat(['legend: Q mark']), room), /legend's Q is not on the map/],
      [stamp(ok.concat(['legend: P exhibit sp']), room), /gives P twice/],
      [stamp(['arena: t', 'goal: kill', 'legend: P exhibit'], room), /needs sp \(the species in turn\), sp=<id> or role=<role>/],
      [stamp(['arena: t', 'goal: kill', 'legend: P exhibit role=boss'], room), /role is one of/],
      [stamp(['arena: t', 'goal: kill', 'legend: P exhibit role=fodder mode=asleep'], room), /mode is one of dormant/],
      [stamp(['arena: t', 'goal: kill', 'legend: P exhibit role=fodder colour=red'], room), /an exhibit takes sp, role/],
      [stamp(ok.concat(['legend: C case glass=4']), ['######', '#@.PC#', '######']), /glass is 1, 2 or 3, not 4/],
      [stamp(ok.concat(['legend: C item curio + item curio']), ['######', '#@.PC#', '######']), /only a case may hold something/],
      [stamp(ok.concat(['legend: C case + exhibit sp on=.']), ['######', '#@.PC#', '######']), /stands on its vitrine, so it takes no on=/],
      [stamp(ok.concat(['kit: weapon heavy; weapon light']), room), /the kit slot weapon is given twice/],
      [stamp(ok.concat(['kit: hat red']), room), /a kit entry starts with a slot/],
      [stamp(ok.concat(['kit: weapon heavy charges=3']), room), /takes form, tier and level, not charges/],
      [stamp(ok.concat(['kit: instrument fork colour=red']), room), /an item has no field colour/],
      [stamp(ok.concat(['metric: hpLost < 90']), room), /the metric is <name> <= <p>%/],
      [stamp(ok.concat(['clock: soon']), room), /the clock is none, ltour=<n>, or B=<b> G=<g> count=<c>/],
      [stamp(ok.concat(['seen: some']), room), /seen is none or all, not some/],
      [stamp(ok.concat(['depths: 2 9']), room), /depths are whole numbers from 1 to 7/],
      [stamp(ok.concat(['variants: swap P']), room), /a variant is swap <ch> <ch>/],
      [stamp(ok.concat(['variants: swap P Q']), room), /the variant's Q is not in the legend/],
      [ok.join('\n') + '\n#####\n#@.P#\n#####\n', /a header line is key: value, not #####/],
      // A word left out is named, never written as "undefined".
      [stamp(ok.concat(['legend: Q sp=A4.1']), room), /a legend entry says first what its letter is \(you, exhibit, case, item, mark\): sp=A4\.1/],
      [stamp(ok.concat(['kit: form=heavy']), room), /a kit entry starts with its slot \(weapon, garment, curio0, curio1, instrument, tote\): form=heavy/],
      [stamp(ok.concat(['kit: tote']), room), /a tote entry names the kind of item it puts in the tote/],
      [stamp(['arena: t', 'goal:', 'legend: P exhibit sp'], room), /line 2: the header's goal has no value/],
      [stamp(ok.concat(['legend: Q item']), room), /an item names its kind after the word item/],
      [stamp(ok.concat(['clock:']), room), /the header's clock has no value/],
      [stamp(ok.concat(['legend: Q exhibit role=']), room), /role has no value after its =/],
      [stamp(ok.concat(['kit: weapon form=']), room), /form has no value after its =/],
      [stamp(ok.concat(['legend: Q case on=']), room), /on has no value after its =/],
      [stamp(ok.concat(['variants: swap P @ |']), room), /a variant is swap <ch> <ch>, and one here is empty/],
      [ok.join('\n') + '\n', /no map after its header/],
    ];
    // Every header key given nothing.
    for (const k of A.KEYS) cases.push([stamp(ok.filter(l => !l.startsWith(k + ':')).concat([`${k}:`]), room), new RegExp(`the header's ${k} has no value`)]);
    for (const [text, re] of cases) {
      let msg = null;
      try { A.parse(text); } catch (e) { msg = e.message; }
      assert.ok(msg, `accepted: ${text}`);
      assert.match(msg, re);
      assert.match(msg, /^Arena\.parse: /);
      clean(msg);
    }
  });

  test("each seed's depth and species follow the plan's D6.2: depth 2 on odd seeds and 5 on even, every species at both", () => {
    const d = A.parse(A.DUMMY), list = A.speciesList(d).map(s => s.id);
    const want = [];
    for (const p of C.Packs.list()) for (const sp of p.species) if (sp.archetype === 'plodder') want.push(sp.id);
    eq(list, want, 'an archetype names its pack species in pack order');
    assert.ok(list.length >= 2);
    const met = new Set();
    for (let s = 1; s <= 4 * list.length; s++) {
      const depth = A.depthFor(d, s), sp = A.speciesFor(d, s);
      assert.equal(depth, s % 2 ? 2 : 5, `seed ${s}`);
      assert.equal(sp.id, list[Math.floor((s - 1) / 2) % list.length], `seed ${s}`);
      met.add(sp.id + '@' + depth);
      const L = A.layout(d, s);
      const acc = C.Packs.list().find(p => p.species.includes(sp)).acc;
      eq([L.depth, L.sp, L.acc], [depth, sp.id, acc]);
      eq(L.exhibits.map(e => e.uid), [`${acc}.${depth}.room.1`]);
    }
    assert.equal(met.size, 2 * list.length, 'every species meets both depths');
    // Fixed species ids rotate the same way; an id that is neither is refused.
    const f = A.parse(stamp(['arena: t', 'goal: kill', 'species: M11.5 A4.1', 'depths: 3', 'legend: P exhibit sp'], ['#####', '#@.P#', '#####']));
    eq([1, 2, 3].map(s => A.speciesFor(f, s).id), ['M11.5', 'A4.1', 'M11.5']);
    assert.throws(() => A.speciesList(A.parse(stamp(['arena: t', 'goal: kill', 'species: nobody', 'legend: P exhibit sp'], ['#####', '#@.P#', '#####']))), /neither an archetype nor a species/);
    assert.throws(() => A.layout(A.parse(stamp(['arena: t', 'goal: kill', 'legend: P exhibit sp'], ['#####', '#@.P#', '#####'])), 1), /the header names no species/);
  });

  const FULL = stamp([
    '// every kind of legend entry',
    'arena: full',
    'goal: take I',
    'cap: 120',
    'species: kiter',
    'depths: 4',
    'kit: weapon heavy tier=2; garment standard level=1',
    'kit: instrument form=fork charges=3 max=3; tote consumable ck=fixative n=2',
    'clock: B=220 G=60 count=279',
    'seen: all',
    'metric: woken <= 50%',
    'legend: K exhibit sp; F exhibit role=fodder group=g1 guards=I; W exhibit sp=A4.1 mode=hunting',
    'legend: C case glass=2 lock=3 + item curio prims=dmg:M; I item weapon light tier=1; L case loan; D mark on=,',
  ], [
    '############',
    '#E..@...+..#',
    '#.K..F..#.C#',
    '#..W....#..#',
    '#.I.D...#.LX',
    '############',
  ]);

  test('a full stamp builds through Setup.room: tiles, exhibits, cases, items, kit, clock and memory', () => {
    const spec = A.parse(FULL), state = A.build(spec, 3);
    assert.equal(C.State.plainData(state), null);
    assert.equal(C.State.hash(C.State.clone(state)), C.State.hash(state));
    const m = state.dept, sp = A.speciesFor(spec, 3), acc = C.Packs.list().find(p => p.species.includes(sp)).acc;
    assert.equal(m.acc, acc); assert.equal(m.depth, 4);
    eq(m.tiles, ['############', '#E......+..#', '#.......#.v#', '#.......#..#', '#...,...#.vX', '############']);
    eq(m.entrance, [1, 1]); eq(m.exits, [[11, 4]]);
    assert.equal(m.seen, m.tiles.join(''), 'seen: all remembers the map as it is built');
    eq([m.clock.B, m.clock.G, m.clock.count, m.clock.stage], [220, 60, 279, 1]);
    const you = state.actors[0];
    eq([you.x, you.y], [4, 1]);
    // Exhibits in row-major order: K (the species in turn), F (an unnamed fodder), W (A4.1, hunting).
    const ex = state.actors.slice(1);
    eq(ex.map(a => a.uid), [1, 2, 3].map(n => `${acc}.4.room.${n}`));
    eq(ex.map(a => [a.sp, a.x, a.y, a.mode]), [[sp.id, 2, 2, 'dormant'], ['training_dummy', 5, 2, 'dormant'], ['A4.1', 3, 3, 'hunting']]);
    assert.equal(ex[0].arch, 'kiter'); assert.equal(ex[1].arch, 'plodder'); assert.equal(ex[1].group, 'g1');
    eq(ex[1].guards, [2, 4], "guards=I is the item's tile");
    const fod = C.Roles.stats('fodder', 4);
    eq([ex[1].hp, ex[1].maxHp, ex[1].acc, ex[1].eva, ex[1].pad, ex[1].dmin, ex[1].dmax], [fod.hp, fod.hp, fod.acc, fod.eva, fod.pad, fod.dmin, fod.dmax]);
    assert.equal(ex[0].hp, C.Roles.stats(sp.role, 4).hp);
    // Cases, numbered in the pack's number; what the first holds; the loan case holds nothing.
    const num = C.Packs.get(acc).number;
    eq(m.fixtures.map(f => [f.k, f.x, f.y, f.num, f.glass, f.lock, f.loan, f.st]),
      [['case', 10, 2, `${num}.1.1`, 2, 3, false, 'shut'], ['case', 10, 4, `${num}.1.2`, 1, 1, true, 'shut']]);
    // Items: the kit's first (instrument, tote), then the map's, row-major (the case's, then I).
    const i = n => `${acc}.4.room.i${n}`;
    eq(state.items.filter(it => !/^you\./.test(it.uid)).map(it => [it.uid, it.kind, it.where.at]),
      [[i(1), 'instrument', 'kit'], [i(2), 'consumable', 'tote'], [i(3), 'curio', 'case'], [i(4), 'weapon', 'floor']]);
    assert.equal(m.fixtures[0].holds, i(3)); assert.equal(m.fixtures[1].holds, null);
    const it = id => state.items.find(x => x.uid === id);
    eq([it(i(1)).form, it(i(1)).charges, it(i(1)).max, it(i(1)).tier], ['fork', 3, 3, C.N.TIER_LOW_BY_DEPTH[3]], 'given no tier, the fork has the lower tier on offer at depth 4');
    eq([it(i(2)).ck, it(i(2)).n], ['fixative', 2]);
    eq(it(i(3)).prims, [{ id: 'dmg', cls: 'M' }]);
    eq([it(i(4)).form, it(i(4)).tier, it(i(4)).where.x, it(i(4)).where.y], ['light', 1, 2, 4]);
    assert.equal(state.you.kit.instrument, i(1)); eq(state.you.tote, [i(2)]);
    eq([it('you.w').form, it('you.w').tier, it('you.g').form, it('you.g').level], ['heavy', 2, 'standard', 1]);
    // A policy's kit overrides the stamp's weapon (§10.3's splitter: naive's Light weapon).
    const light = A.build(spec, 3, { kit: { weapon: { form: 'light' } } });
    eq([light.items.find(x => x.uid === 'you.w').form, light.items.find(x => x.uid === 'you.w').tier], ['light', 2]);
    // The goal and the marks.
    const g = A.goal(spec, state);
    eq([g.k, g.items], ['take', [i(4)]]);
    const L = A.layout(spec, 3);
    eq(L.marks, [{ ch: 'D', x: 4, y: 4 }]);
  });

  test('a case may hold an exhibit, encased on its vitrine, numbered and judged with the others', () => {
    const spec = A.parse(stamp(['arena: enc', 'goal: kill T', 'species: plodder', 'legend: P exhibit sp; T case glass=1 lock=2 + exhibit role=fodder; I item curio'],
      ['########', '#@.T.PI#', '########']));
    const s = A.build(spec, 1), acc = s.dept.acc;
    const t = s.actors[1], f = s.dept.fixtures[0];
    eq([t.uid, t.x, t.y, s.dept.tiles[1].charAt(3), f.x, f.y, f.lock, f.holds], [`${acc}.2.room.1`, 3, 1, 'v', 3, 1, 2, null]);
    assert.equal(C.Cases.encased(s, t), true);
    eq(s.actors.slice(1).map(a => a.uid), [`${acc}.2.room.1`, `${acc}.2.room.2`]);
    const g = A.goal(spec, s);
    eq([g.uids, g.arena.map(x => x.uid)], [[t.uid], [t.uid, `${acc}.2.room.2`]]);
    eq(s.items.filter(i => !/^you\./.test(i.uid)).map(i => i.uid), [`${acc}.2.room.i1`]);
  });

  test("options reach the state, and removing an exhibit moves nothing else", () => {
    const spec = A.parse(FULL);
    const full = A.build(spec, 5), sp = A.speciesFor(spec, 5), acc = full.dept.acc;
    const gone = `${acc}.4.room.1`;
    const s = A.build(spec, 5, { options: { rulesOff: ['marble'], without: [gone], invulnerable: true } });
    eq(s.options, { rulesOff: ['marble'], without: [gone], invulnerable: true });
    assert.equal(C.Actors.byUid(s, gone).gone, 1);
    for (const a of full.actors) if (a.uid !== gone) {
      const b = C.Actors.byUid(s, a.uid);
      eq([b.x, b.y, b.hp, b.mode], [a.x, a.y, a.hp, a.mode], a.uid);
    }
    eq(s.items.map(x => x.uid), full.items.map(x => x.uid));
    eq(s.dept.fixtures, full.dept.fixtures);
    assert.ok(sp);
  });

  // The mimic arena of §10.3 ("two cases, one a mimic; open the real one"): the real case
  // must differ from the mimic's only in its accession number (§8.3, D3.10), so `case
  // like=M` copies the glass, lock and loan of the case the mimic M shows as, wherever the
  // variant puts it; and `grade:` sets your grade (the tools' own tests; §10.3's arenas give
  // none and have the depth's, the arena's kit).
  test('a case like a mimic\'s differs from it only in its number, whatever the seed and the variant; grade: sets your grade', () => {
    const text = stamp(['arena: mimic_probe', 'goal: open R', 'species: mimic_vitrine', 'grade: 7', 'legend: M exhibit sp; R case like=M', 'variants: swap M R'],
      ['#########', '#.......#', '#.M.@.R.#', '#.......#', '#########']);
    const spec = A.parse(text);
    eq([spec.grade, spec.legend.find(e => e.ch === 'R').parts[0].like], [7, 'M']);
    const seen = new Set(), variants = new Set();
    for (let seed = 1; seed <= 40; seed++) {
      const s = A.build(spec, seed), v = C.Cases.view(s), real = v.find(c => c.num !== null), mim = v.find(c => c.num === null);
      assert.ok(real && mim, `seed ${seed}: one real case and the mimic's`);
      const drop = c => { const o = J(c); delete o.x; delete o.y; delete o.num; return o; };
      eq(drop(real), drop(mim), `seed ${seed}: the two cases differ beyond their number`);
      const describe = (x, y) => { const d = J(C.Cases.describe(s, C.Cases.at(s, x, y))); delete d.x; delete d.y; delete d.num; return d; };
      eq(describe(real.x, real.y), describe(mim.x, mim.y), `seed ${seed}: their labels differ beyond the number`);
      assert.equal(s.run.grade, 7, 'your grade is the stamp\'s');
      seen.add(JSON.stringify([real.glass, real.lock, real.loan])); variants.add(real.x);
    }
    assert.ok(seen.size > 3 && variants.size === 2, `the cases are drawn as a mimic's are, per seed (${seen.size} kinds), in both places`);
    // Without grade:, your grade is the depth's (the arena's kit: seed 1 is at depth 2); like=
    // must name a letter that is a case or an exhibit.
    eq([1, 2].map(seed => A.build(A.parse(text.replace('grade: 7\n', '')), seed).run.grade), [2, 5]);
    assert.throws(() => A.parse(text.replace('grade: 7', 'grade: 9')), /grade is a whole number from 1 to 7/);
    assert.throws(() => A.parse(text.replace('like=M', 'like=Q')), /like=Q: that letter is not in the legend/);
    assert.throws(() => A.parse(text.replace('like=M', 'like=M glass=2')), /a case like another takes its glass, lock and loan from it/);
  });

  test("variants are drawn per seed on the arena's own stream and swap the letters", () => {
    const spec = A.parse(stamp(['arena: pick', 'goal: open R', 'species: plodder', 'legend: M exhibit sp; R case', 'variants: swap M R'], ['#######', '#M.@.R#', '#######']));
    const seen = new Set();
    for (let s = 1; s <= 40; s++) {
      const v = A.variant(spec, s);
      assert.equal(v, C.Rng.stream({ seed: s, rng: {} }, 'arena/pick/variant').int(0, 1), `seed ${s}`);
      seen.add(v);
      const state = A.build(spec, s), ex = state.actors[1], f = state.dept.fixtures[0];
      eq([ex.x, f.x], v ? [5, 1] : [1, 5], `seed ${s}, variant ${v}`);
      assert.ok(!Object.keys(state.rng).some(k => k.startsWith('arena/')), 'the draw is not in the state');
      eq(A.goal(spec, state).cases, [[f.x, f.y]], 'the goal follows its letter');
    }
    eq([...seen].sort(), [0, 1], 'both variants occur');
    // Forced: the variant can be chosen; an unknown one is refused.
    assert.equal(A.build(spec, 1, { variant: 1 }).actors[1].x, 5);
    assert.throws(() => A.layout(spec, 1, { variant: 2 }), /has no variant 2/);
  });

  test('each goal is judged on the state', () => {
    const kill = A.parse(stamp(['arena: k', 'goal: kill P', 'species: plodder', 'legend: P exhibit sp; Q exhibit role=fodder'], ['#######', '#@.P.Q#', '#######']));
    let s = A.build(kill, 1);
    let g = A.goal(kill, s);
    eq(g.uids, [s.actors[1].uid]);
    assert.equal(A.won(g, s), false);
    s.actors[1].gone = 1;
    assert.equal(A.won(g, s), true, 'the other exhibit is not a target');
    // Something split from a target must be destroyed too.
    s.actors.push(C.Actors.make(s, { uid: s.actors[1].uid + '/1', x: 3, y: 1, hp: 1 }));
    assert.equal(A.won(g, s), false);
    s.actors[3].gone = 1;
    assert.equal(A.won(g, s), true);
    // kill with no letters: every exhibit the stamp placed.
    const all = A.parse(stamp(['arena: k', 'goal: kill', 'species: plodder', 'legend: P exhibit sp; Q exhibit role=fodder'], ['#######', '#@.P.Q#', '#######']));
    s = A.build(all, 1); g = A.goal(all, s);
    assert.equal(g.uids.length, 2);
    s.actors[1].gone = 1; assert.equal(A.won(g, s), false); s.actors[2].gone = 1; assert.equal(A.won(g, s), true);
    // reach
    const reach = A.parse(stamp(['arena: r', 'goal: reach D', 'legend: D mark'], ['######', '#@..D#', '######']));
    s = A.build(reach, 1); g = A.goal(reach, s);
    eq(g.tiles, [[4, 1]]);
    assert.equal(A.won(g, s), false); s.actors[0].x = 4; assert.equal(A.won(g, s), true);
    // take
    const take = A.parse(stamp(['arena: t', 'goal: take I', 'legend: I item curio'], ['######', '#@..I#', '######']));
    s = A.build(take, 1); g = A.goal(take, s);
    assert.equal(A.won(g, s), false); s.items.find(x => x.uid === g.items[0]).where = { at: 'tote' }; assert.equal(A.won(g, s), true);
    // open
    const open = A.parse(stamp(['arena: o', 'goal: open R', 'legend: R case'], ['######', '#@..R#', '######']));
    s = A.build(open, 1); g = A.goal(open, s);
    assert.equal(A.won(g, s), false);
    for (const st of ['open', 'broken', 'dissolved']) { s.dept.fixtures[0].st = st; assert.equal(A.won(g, s), true, st); }
    // leave
    const leave = A.parse(stamp(['arena: l', 'goal: leave'], ['#####', '#@.X#', '#####']));
    s = A.build(leave, 1); g = A.goal(leave, s);
    assert.equal(A.won(g, s), false);
    s.over = { k: 'left', turn: 3, by: null, door: 0, cause: null };
    assert.equal(A.won(g, s), true);
    const o = A.outcome(leave, s, []);
    eq([o.done, o.won, o.left, o.died], [true, true, true, false]);
  });

  test('the outcome counts HP lost, deaths and wakings from the events', () => {
    // At grade I (the stamp says so), so that you have PLAYER_HP (20) whatever the depth.
    const spec = A.parse(stamp(['arena: o', 'goal: kill', 'species: plodder', 'grade: 1', 'legend: P exhibit sp; Q exhibit role=fodder; R exhibit role=fodder mode=awake'], ['########', '#@.PQR.#', '########']));
    assert.equal(A.build(spec, 1).actors[0].maxHp, C.N.PLAYER_HP);
    const s = A.build(spec, 1), [P, Q] = [s.actors[1].uid, s.actors[2].uid];
    const dmg = (hp, amount, saved) => ({ k: 'damaged', who: 'you', amount, hp, cause: saved ? { k: 'attack', saved: 1 } : { k: 'attack' } });
    const ev = [dmg(15, 5), { k: 'regenerated', who: 'you', hp: 17 }, dmg(13, 4), { k: 'damaged', who: P, amount: 9, hp: 1 },
      { k: 'woke', who: P, was: 'dormant', mode: 'hunting' }, { k: 'woke', who: P, was: 'dormant', mode: 'awake' }, { k: 'woke', who: 'x/1', was: null, mode: 'hunting' },
      { k: 'healed', who: 'you', amount: 2, hp: 15 }, dmg(10, 5)];
    let o = A.outcome(spec, s, ev);
    eq([o.hpLost, o.deaths, o.died, o.woken, o.sleepers, o.done], [14, 0, false, 1, 2, false]);
    assert.equal(A.outcome(spec, s, [dmg(0, 30)]).hpLost, 20, 'never more than your maximum');
    // An invulnerable run: the blows that would have killed you count as deaths.
    o = A.outcome(spec, s, [dmg(1, 25, true), dmg(1, 5, true)]);
    eq([o.hpLost, o.deaths], [19, 2]);
    // Dying counts your maximum HP and one death.
    s.over = { k: 'died', turn: 4, by: P, door: null, cause: { k: 'attack' } };
    o = A.outcome(spec, s, [dmg(18, 2)]);
    eq([o.hpLost, o.deaths, o.died, o.done, o.won], [20, 1, true, true, false]);
    // A removed sleeper is not counted as one.
    const w = A.build(spec, 1, { options: { without: [Q] } });
    assert.equal(A.outcome(spec, w, []).sleepers, 1);
  });

  // A label reads its species (§5.3), so a stamp may not give an exhibit of a species another
  // archetype, role, trigger or modifiers than the species' own: its label would state a rule
  // the exhibit does not follow. A role-only exhibit (no species) has no Behaviour line.
  test('an exhibit of a species keeps the species\' archetype, role, trigger and modifiers, so its label says what it does', () => {
    const room = ['#######', '#@...P#', '#######'];
    const refused = [['sp=M11.5 role=brute', /M11\.5's role .*brute.*its label would not say so/], ['sp=M11.5 arch=darter', /M11\.5's archetype .*darter/],
      ['sp=M11.5 mods=glass', /M11\.5's modifiers .*glass/], ['sp=A4.1 trigger=awake', /A4\.1's trigger .*awake/], ['sp=A4.1 mods=marble,glass', /A4\.1's modifiers/]];
    for (const [args, re] of refused) {
      let msg = null;
      try { A.build(A.parse(stamp(['arena: t', 'goal: kill', `legend: P exhibit ${args}`], room)), 1); } catch (e) { msg = e.message; }
      assert.ok(msg, `accepted: ${args}`);
      assert.match(msg, re); assert.match(msg, /BUILD\.md §5\.3/); clean(msg);
    }
    // The species in turn too.
    assert.throws(() => A.build(A.parse(stamp(['arena: t', 'goal: kill', 'species: M11.5', 'legend: P exhibit sp role=brute'], room)), 1), /role .*brute/);
    // The species' own values are not an override; a role-only exhibit may take any.
    for (const args of ['sp=M11.5', 'sp=M11.5 role=fodder arch=plodder', 'sp=A4.1 mods=marble trigger=ally_hit', 'role=artillery arch=kiter']) {
      const s = A.build(A.parse(stamp(['arena: t', 'goal: kill', `legend: P exhibit ${args}`], room)), 1), a = s.actors[1], l = C.Labels.of(s, a.uid);
      const sp = C.Packs.speciesFor(s, a);
      if (sp) {
        assert.equal(l.behaviour, C.Clauses.line(sp, { depth: s.dept.depth }), args);
        eq([a.arch, a.role, a.trigger, a.mods], [sp.archetype, sp.role, sp.trigger || null, sp.modifiers || []]);
      } else assert.equal(l.behaviour, '', `${args}: no species, no Behaviour line`);
    }
  });

  test('a swarm is stamped as the number of bodies its Behaviour line says (SWARM_BODIES[0]), or refused', () => {
    const n = C.N.SWARM_BODIES[0], line = k => ['#########', '#@' + 'm'.repeat(k) + '.'.repeat(6 - k) + '#', '#########'];
    const head = ['arena: swarm', 'goal: kill', 'species: mote_swarm', 'legend: m exhibit sp'];
    for (const k of [n - 1, n + 1, 6]) assert.throws(() => A.build(A.parse(stamp(head, line(k))), 1), new RegExp(`places ${k} bodies of the swarm A4\\.2, but its Behaviour line says it comes as ${n}`), `${k} bodies`);
    const s = A.build(A.parse(stamp(head, line(n))), 1), bodies = s.actors.filter(a => a.arch === 'mote_swarm');
    assert.equal(bodies.length, n);
    for (const b of bodies) assert.ok(C.Labels.of(s, b.uid).behaviour.startsWith(`Comes as ${bodies.length} bodies`), C.Labels.of(s, b.uid).behaviour);
  });

  test('a weapon, garment or instrument the stamp gives no tier gets the lower tier on offer at the depth, so its label and its numbers agree; a tier that is not 1–4 is refused', () => {
    const room = ['#######', '#@.W..#', '#######'];
    for (const depth of [1, 2, 4, 5, 7]) {
      const spec = A.parse(stamp(['arena: t', 'goal: take W', `depths: ${depth}`, 'kit: instrument pin_driver; tote garment heavy; curio0 prims=dmg:S', 'legend: W item weapon heavy'], room));
      const s = A.build(spec, 1), want = C.N.TIER_LOW_BY_DEPTH[depth - 1];
      for (const it of s.items.filter(i => !/^you\./.test(i.uid))) {
        const l = C.Labels.ofItem(s, it.uid), text = JSON.stringify(l);
        if (it.kind === 'curio') { assert.equal(it.tier, null, 'a curio has no tier'); continue; }
        assert.equal(it.tier, want, `depth ${depth}: ${it.kind}`);
        assert.match(l.pictos[0].text, new RegExp(`tier ${want}\\b`), `depth ${depth}: ${it.kind}`);
        assert.doesNotMatch(text, /tier null/);
      }
      // The Pin-Driver's bolt deals its tier's damage, as its label says.
      const pin = s.items.find(i => i.form === 'pin_driver'), d = C.Kit.describe(s, pin.uid);
      assert.ok(C.Labels.ofItem(s, pin.uid).odds.includes(`Its bolt deals ${d.instrument.dmin === d.instrument.dmax ? d.instrument.dmin : d.instrument.dmin + '–' + d.instrument.dmax} damage, rolled with Acc ${d.instrument.acc < 0 ? '−' + -d.instrument.acc : d.instrument.acc}.`));
    }
    for (const bad of ['tier=null', 'tier=0', 'tier=5', 'tier=two']) assert.throws(() => A.parse(stamp(['arena: t', 'goal: take W', `legend: W item weapon heavy ${bad}`], room)), /tier is a whole number from 1 to 4/, bad);
  });

  // The arena's kit (§10.3): at depth d you are the visitor with a Certificate from each
  // earlier department, grade d with its health (MEDIAN_MAX_HP), wearing a weapon and a
  // garment of the lower tier on offer at d, Balanced and Standard unless the stamp or a
  // policy names a form, at level 0. Grade d meets that tier's base grade, so only a Heavy
  // form is short, by one grade at odd depths.
  test('with no grade: and no tier, you carry the arena\'s kit at the depth: grade d, the lower tier on offer, worn at the grade it needs', () => {
    const room = ['#####', '#@..#', '#####'];
    for (let depth = 1; depth <= 7; depth++) {
      const spec = A.parse(stamp(['arena: t', 'goal: leave', `depths: ${depth}`], room)), s = A.build(spec, 1), you = s.actors[0];
      const t = C.N.TIER_LOW_BY_DEPTH[depth - 1], w = s.items.find(i => i.uid === s.you.kit.weapon), g = s.items.find(i => i.uid === s.you.kit.garment);
      eq([s.run.grade, A.gradeAt(depth), you.hp, you.maxHp], [depth, depth, C.N.MEDIAN_MAX_HP[depth - 1], C.N.MEDIAN_MAX_HP[depth - 1]], `depth ${depth}: grade and health`);
      eq([w.form, w.tier, w.level, g.form, g.tier, g.level], ['balanced', t, 0, 'standard', t, 0], `depth ${depth}: the weapon and garment`);
      eq([C.Kit.short(w, s.run.grade), C.Kit.short(g, s.run.grade)], [0, 0], `depth ${depth}: worn at the grade they need`);
      assert.ok(2 * t - 1 <= depth, `depth ${depth}: grade ${depth} meets tier ${t}'s base grade`);
      // A form a policy names keeps the arena's tier; only a Heavy one can be short, and only
      // at an odd depth (where the tier's Heavy needs one grade more than you have).
      for (const form of ['light', 'heavy', 'reach']) {
        const gform = form === 'reach' ? 'standard' : form, k = A.build(spec, 1, { kit: { weapon: { form }, garment: { form: gform } } });
        const kw = k.items.find(i => i.uid === k.you.kit.weapon), kg = k.items.find(i => i.uid === k.you.kit.garment);
        eq([kw.form, kw.tier, kg.form, kg.tier], [form, t, gform, t], `depth ${depth}: a ${form} weapon and a ${gform} garment of the arena's tier`);
        const short = form === 'heavy' && depth % 2 === 1 ? 1 : 0;
        eq([C.Kit.short(kw, k.run.grade), C.Kit.short(kg, k.run.grade)], [short, short], `depth ${depth}: ${form} is ${short} grades short`);
      }
    }
    // The stamp may still say another grade or tier, for the tools' own tests.
    const own = A.build(A.parse(stamp(['arena: t', 'goal: leave', 'depths: 5', 'grade: 1', 'kit: weapon tier=1; garment tier=1'], room)), 1);
    eq([own.run.grade, own.actors[0].maxHp, own.items.find(i => i.uid === 'you.w').tier, own.items.find(i => i.uid === 'you.g').tier], [1, C.N.PLAYER_HP, 1, 1]);
  });

  test('tools/arena.js passes the determinism lint, like the core', () => {
    const { spawnSync } = require('node:child_process');
    const r = spawnSync(process.execPath, [path.join(root, 'tools/lint-core.js'), path.join(root, 'tools/arena.js')], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout);
  });
};
