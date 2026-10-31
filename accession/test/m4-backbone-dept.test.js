// M4's department core (M4 plan A2, A3, A9, A10, A13; W0c): the visitor of a single visit
// (the carry, the median visitor), M4's state parts absent until used (the test room
// untouched, dept.walked a department's only), the layout attempt's accept and the
// validators, the pack's parts, flags and sprites, Status.define with `perm` and immunity,
// and the shutter tile. The expected figures are worked out here from the plan's and BUILD's
// text (§5.5, §8.1, §8.2, §8.10), never from the rule code.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const C = loadCore(['tools/monkey.js', 'tools/replay.js', 'tools/arena.js', 'test/golden/golden.js']);
  const { Dept, Setup, Step, State, Progress, Packs, Populate, Layout, Status, Grid, Noise, N, Health, TestRoom } = C;
  const json = x => JSON.stringify(x);
  // Values made in the core's context compared as plain data (their prototypes are the context's).
  const eq = (a, b, m) => assert.deepEqual(a === undefined ? a : JSON.parse(json(a)), b === undefined ? b : JSON.parse(json(b)), m);
  const ACCS = ['S9', 'A4', 'M11'];
  const without = (s, k) => { const c = State.clone(s); delete c.dept[k]; return c; };

  // ---- The test room is untouched (A3) ----

  test('the test room has none of M4\'s parts, and m0Monkey still gives its pinned hash after each of its first 1,000 steps', () => {
    const s = TestRoom.create(20261023);
    for (const k of ['walked', 'cp', 'cert', 'offer', 'view', 'perk']) assert.ok(!(k in s.dept), `the test room has dept.${k}`);
    assert.equal(Progress.cert(s), null);
    eq(Dept.walked(s), []);
    assert.equal(Dept.walk(s), false, 'walk writes nothing outside a department');
    assert.ok(!('walked' in s.dept));
    const g = C.GOLDEN.m0Monkey, want = C.Replay.decode(g.steps);
    assert.ok(!g.pending && want.length === g.actions, 'm0Monkey is pinned with its per-step hashes');
    const r = C.Replay.golden(Object.assign({}, g, { actions: 1000 }), { against: want });
    assert.equal(r.diverged, null, r.diverged && C.Replay.describe('m0Monkey', r.diverged, 1000));
  });

  // ---- The visitor of a single visit (A2) ----

  test('Progress.median at depths 1–7 is grade d (at most VII) with the lower tier on offer at d, no perks and no items, and equals Arena.gradeAt', () => {
    const LOW = [1, 1, 2, 2, 3, 3, 4]; // §8.10 TIER_LOW_BY_DEPTH
    for (let d = 1; d <= 7; d++) {
      eq(Progress.median(d), { grade: d, perks: [], tier: LOW[d - 1], items: [] }, `depth ${d}`);
      assert.equal(Progress.median(d).grade, C.Arena.gradeAt(d), `depth ${d}`);
    }
    const a = Progress.median(3); a.perks.push({ id: 'x', rank: 1 });
    eq(Progress.median(3).perks, [], 'a fresh record each call');
    for (const d of [0, 8, 2.5, '3']) assert.throws(() => Progress.median(d), /no depth/);
  });

  test('a department\'s visitor is the median one unless the carry says otherwise: its grade, health, the grade it came in with and its kit\'s tier', () => {
    for (const acc of ACCS) for (let d = 1; d <= 7; d++) {
      const s = Dept.create(d, acc, d), you = s.actors[0], tier = [1, 1, 2, 2, 3, 3, 4][d - 1];
      const items = s.items.filter(i => i.uid === 'you.w' || i.uid === 'you.g').map(i => [i.uid, i.form, i.tier, i.level]);
      eq([s.run.grade, s.dept.entryGrade, you.maxHp, you.hp, s.run.perks], [d, d, 20 + 5 * (d - 1), 20 + 5 * (d - 1), []], `${acc} at depth ${d}`);
      eq(items, [['you.w', 'balanced', tier, 0], ['you.g', 'standard', tier, 0]], `${acc} at depth ${d}`);
      assert.equal(you.maxHp, Health.maxHp(d));
    }
    // At depth 1 the median visitor is the run's start, so a first visit is as it was.
    for (const acc of ACCS) assert.equal(State.hash(Dept.create(5, acc, 1)), State.hash(Dept.create(5, acc, 1, { carry: 'start' })), acc);
    // 'median' said aloud is the default.
    assert.equal(State.hash(Dept.create(5, 'M11', 4, { carry: 'median' })), State.hash(Dept.create(5, 'M11', 4)));
  });

  // M3's starting state, hashed at W0c's base (a33bbd7) as Dept.create(1, acc, depth) made it.
  // A package that changes a department's start on purpose re-pins these with its reason, as
  // it does the golden runs.
  const M3_START = { 'S9/2': 2432457489, 'S9/5': 3437461748, 'A4/2': 4034716962, 'A4/5': 1349062711, 'M11/2': 324451422, 'M11/5': 690195461 };
  test('with carry \'start\' a department is M3\'s start but for dept.walked; the median visitor changes only what the visitor decides', () => {
    for (const key of Object.keys(M3_START)) {
      const [acc, d] = key.split('/'), s = Dept.create(1, acc, Number(d), { carry: 'start' });
      assert.equal(State.hash(without(s, 'walked')), M3_START[key], `${key}: carry 'start' is M3's start`);
      eq([s.run.grade, s.actors[0].maxHp, s.items[0].tier, s.items[1].tier], [1, 20, 1, 1], key);
      // The plan, the cases and the exhibits do not depend on the visitor; the items may, since
      // one goes in a case only if its lock is within the grade you came in with (§8.5).
      const m = Dept.create(1, acc, Number(d));
      assert.equal(json(m.dept.tiles), json(s.dept.tiles), key);
      assert.equal(json(m.dept.fixtures.filter(f => f.k !== 'case').concat(m.dept.fixtures.filter(f => f.k === 'case').map(f => [f.x, f.y, f.glass, f.lock, f.loan, f.mimic]))),
        json(s.dept.fixtures.filter(f => f.k !== 'case').concat(s.dept.fixtures.filter(f => f.k === 'case').map(f => [f.x, f.y, f.glass, f.lock, f.loan, f.mimic]))), key);
      assert.equal(json(m.actors.slice(1)), json(s.actors.slice(1)), `${key}: the exhibits`);
    }
  });

  test('the carry: perks to the run, items worn or carried at the carry\'s tier as you.c1…, any field left out taken from the median, and anything malformed refused', () => {
    const lamp = Packs.get('S9').items.find(i => i.kind === 'curio'), weapon = Packs.get('S9').items.find(i => i.kind === 'weapon');
    const s = Dept.create(2, 'S9', 4, { carry: { perks: [{ id: 'soft_soles', rank: 2 }], items: [{ ref: lamp.id, slot: 'curio0' }, { ref: weapon.id, slot: 'weapon' }, { ref: weapon.id, slot: 'tote' }] } });
    eq(s.run.perks, [{ id: 'soft_soles', rank: 2 }]);
    eq([s.run.grade, s.actors[0].maxHp], [4, 35], 'the grade left out is the median\'s');
    const it = uid => s.items.find(i => i.uid === uid);
    eq([it('you.c1').ref, it('you.c1').where, it('you.c1').tier, it('you.c1').level], [lamp.id, { at: 'kit', slot: 'curio0' }, null, 0]);
    eq([it('you.c2').ref, it('you.c2').where, it('you.c2').tier, it('you.c2').form], [weapon.id, { at: 'kit', slot: 'weapon' }, 2, weapon.form]);
    eq(it('you.c3').where, { at: 'tote' });
    eq(it('you.w').where, { at: 'gone' }, 'a carried weapon takes the place of the one you start with');
    eq(s.you, { kit: { weapon: 'you.c2', garment: 'you.g', curio: ['you.c1', null], instrument: null }, tote: ['you.c3'] });
    eq(it('you.c1').prims, lamp.prims.map(p => ({ id: p.id, cls: p.cls })));
    assert.equal(s.actors[0].dmax, C.Kit.derive(s).dmax, 'your stats are settled from what you wear');
    const g = Dept.create(2, 'S9', 4, { carry: { grade: 7, tier: 4 } });
    eq([g.run.grade, g.dept.entryGrade, g.actors[0].maxHp, g.items[0].tier], [7, 7, 50, 4]);
    assert.ok(!('carry' in g.options), 'the carry is not kept in the state');
    const bad = (carry, re) => assert.throws(() => Dept.create(1, 'S9', 2, { carry }), re, json(carry));
    bad('first', /is not 'median', 'start'/);
    bad({ grade: 2, hp: 30 }, /unknown field hp/);
    bad({ grade: 8 }, /grade 8 is not 1–7/);
    bad({ grade: 0 }, /grade 0/);
    bad({ tier: 5 }, /tier 5 is not 1–4/);
    bad({ perks: [{ id: 'soft_soles', rank: 3 }] }, /not \{id, rank 1 or 2\}/);
    bad({ perks: [{ id: 'soft_soles', rank: 1 }, { id: 'soft_soles', rank: 2 }] }, /soft_soles twice/);
    bad({ items: [{ ref: 'M11.6', slot: 'tote' }] }, /no item of S9/);
    bad({ items: [{ ref: lamp.id, slot: 'pocket' }] }, /not a slot/);
    bad({ items: [{ ref: lamp.id, slot: 'weapon' }] }, /the weapon slot holds a weapon/);
    bad({ items: [{ ref: lamp.id, slot: 'curio0' }, { ref: lamp.id, slot: 'curio0' }] }, /curio0 is given twice/);
    assert.throws(() => Dept.create(1, 'Z9', 2), /no department Z9/);
  });

  // ---- dept.walked (A3) ----

  test('a department visit starts with the room you stand in walked, and Dept.walk adds each new room once, in the order entered', () => {
    for (const acc of ACCS) {
      const s = Dept.create(3, acc, 2), you = s.actors[0], m = s.dept, intro = m.rooms.find(r => r.role === 'intro');
      assert.equal(m.roomOf[you.y][you.x], intro.id, `${acc}: you start in the Intro`);
      eq(Dept.walked(s), [intro.id]);
      assert.equal(Dept.walk(s), false, 'the Intro is walked already');
      const others = m.rooms.filter(r => r.role === 'section').slice(0, 2);
      for (const r of others) {
        const t = (() => { for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (m.roomOf[y][x] === r.id && Grid.walkable(m, x, y)) return [x, y]; return null; })();
        [you.x, you.y] = t;
        assert.equal(Dept.walk(s), true);
        assert.equal(Dept.walk(s), false, 'once');
      }
      eq(Dept.walked(s), [intro.id].concat(others.map(r => r.id)));
      assert.equal(State.plainData(s), null);
    }
  });

  test('in play, every step keeps dept.walked equal to the rooms you have stood in, in the order entered', () => {
    for (const acc of ACCS) {
      const s = Dept.create(4, acc, 2, { invulnerable: true }), m = s.dept, oracle = [];
      // The oracle: the room of each tile you stand on, once, from the department's own map.
      const stood = () => { const y = s.actors[0], id = m.roomOf[y.y][y.x]; if (m.rooms.some(r => r.id === id) && !oracle.includes(id)) oracle.push(id); };
      stood();
      for (let i = 0; i < 600 && !s.over; i++) {
        const moves = Step.legal(s).filter(a => a.a === 'move');
        Step.step(s, moves.length ? moves[(i * 7919 + (i >> 3)) % moves.length] : { a: 'wait' });
        stood();
        eq(Dept.walked(s), oracle, `${acc}, after step ${i + 1}`);
      }
      assert.ok(oracle.length >= 2, `${acc}: the walk left its first room (${json(oracle)})`);
    }
  });

  // ---- The layout attempt's accept and the validators (A10) ----

  test('a planted validator that rejects an attempt makes it fail and reseed; one that always rejects reaches the certified fallback, populated', () => {
    const acc = 'M11', seed = 7, depth = 3, P = Packs.get(acc).programme, plain = Layout.generate(P, 0, seed, { acc, depth });
    assert.equal(plain.attempt, 0, 'the plain plan is the first attempt');
    // Through generate: the first plan rejected, so attempt 1 is taken, with the rejection in tries.
    const once = Layout.generate(P, 0, seed, { acc, depth, accept: r => r.attempt === 0 ? { id: 'planted', reason: 'planted', tiles: [[1, 1]] } : null });
    eq([once.attempt, once.fallback, once.tries[0]], [1, false, [{ id: 'planted', why: 'planted', tiles: [[1, 1]] }]]);
    const never = Layout.generate(P, 0, seed, { acc, depth, accept: () => ({ id: 'planted', reason: 'never', tiles: [] }) });
    eq([never.attempt, never.fallback, never.tries.length, never.rejected], [5, true, 5, { id: 'planted', why: 'never', tiles: [] }]);
    const certified = Layout.fallback(P, 0).L.G.rows();
    eq(never.plan.tiles, certified);
    assert.equal(Layout.generate(P, 0, seed, { acc, depth }).rejected, undefined, 'no accept, no answer kept');
    // Through Dept.create, with validators registered as their files register them.
    const X = loadCore(), seen = [];
    X.Populate.addValidator('first', (state, plan) => {
      seen.push([plan.tiles.join('').length, state.actors.length > 1, state.items.some(i => i.uid === 'you.w'), state.actors[0].maxHp, state.actors[0].dmax === X.Kit.derive(state).dmax]);
      return seen.length === 1 ? { reason: 'planted rejection', tiles: [[2, 3]] } : null;
    });
    X.Populate.addValidator('second', () => null);
    const s = X.Dept.create(seed, acc, depth);
    assert.equal(seen.length, 2, 'asked of attempt 0, then of attempt 1');
    assert.ok(seen.every(v => v[1] && v[2] && v[3] === 30 && v[4]), `each validator sees the populated department, your kit and settled stats: ${json(seen)}`);
    assert.equal(json(s.dept.tiles), json(once.plan.tiles.map(r => r.replace(/C/g, '.'))), 'the department is attempt 1\'s');
    eq(X.Populate.validatorIds(), ['first', 'second']);
    const Y = loadCore();
    Y.Populate.addValidator('never', () => ({ reason: 'never', tiles: [] }));
    const f = Y.Dept.create(seed, acc, depth);
    eq(f.dept.tiles, certified.map(r => r.replace(/C/g, '.')), 'the certified fallback\'s plan');
    assert.ok(f.actors.length > 1 && f.items.length > 2, 'the fallback is populated');
    // validate: the first rejection in the order added, with its id; a malformed answer throws.
    const Z = loadCore();
    Z.Populate.addValidator('a', () => null);
    Z.Populate.addValidator('b', () => ({ reason: 'b says no', tiles: [[1, 2]] }));
    Z.Populate.addValidator('c', () => ({ reason: 'c says no', tiles: [] }));
    eq(Z.Populate.validate(TestRoom.create(1), null), { id: 'b', reason: 'b says no', tiles: [[1, 2]] });
    assert.throws(() => Z.Populate.addValidator('a', () => null), /a is added twice/);
    assert.throws(() => Z.Populate.addValidator('d', null), /not a function/);
    const W = loadCore();
    for (const no of [false, 'no', { tiles: [] }, { reason: 'x' }, undefined]) {
      W.Populate.addValidator('w' + json(no), () => no);
      assert.throws(() => W.Populate.validate(TestRoom.create(1), null), /answered/, json(no));
      W.Populate.addValidator('ok' + json(no), () => null);
    }
  });

  test('a department is made in A10\'s order, the Centrepiece, the panels and the modules each told of it', () => {
    const X = loadCore(), calls = [];
    const spy = (ns, fn) => { const real = X[ns][fn]; X[ns][fn] = (...a) => { calls.push(`${ns}.${fn}`); return real(...a); }; };
    for (const [ns, fn] of [['Cases', 'place'], ['Populate', 'exhibits'], ['Setup', 'settleActors'], ['Centrepiece', 'place'], ['Kit', 'start'], ['Setup', 'carry'],
      ['Kit', 'standIn'], ['Consumables', 'startRun'], ['Consumables', 'standIn'], ['Panels', 'place'], ['Modules', 'init'], ['Kit', 'settle'], ['Populate', 'validate']]) spy(ns, fn);
    // The Centrepiece is placed only from a gallery list, once its core is ready (D-POP).
    X.Packs.get('A4').galleries = [];
    X.Registry.ARCHETYPES.mp_ensemble.ready = 'unit';
    X.Dept.create(2, 'A4', 2);
    eq(calls, ['Cases.place', 'Populate.exhibits', 'Setup.settleActors', 'Centrepiece.place', 'Kit.start', 'Setup.carry', 'Kit.standIn',
      'Consumables.startRun', 'Consumables.standIn', 'Panels.place', 'Modules.init', 'Kit.settle', 'Populate.validate']);
  });

  // ---- The pack's parts, flags and sprites (A9) ----

  test('a pack\'s part is given once, to a pack already added; a flag must name one of its own department\'s modules, and a copy one of its species', () => {
    const X = loadCore();
    X.Packs.part('S9', 'intro', { map: ['E..'] });
    eq(X.Packs.get('S9').intro, { map: ['E..'] }, 'merged into the pack');
    assert.ok(X.Packs.list().find(p => p.acc === 'S9').intro);
    assert.throws(() => X.Packs.part('S9', 'intro', { map: [] }), /S9's intro is given twice/);
    assert.throws(() => X.Packs.part('A4', 'centrepiece', { id: 'A4.12' }), /A4's centrepiece is given twice/, 'the card already holds one');
    assert.throws(() => X.Packs.part('S9', 'galleries', {}), /not a part of a pack/);
    assert.throws(() => X.Packs.part('Z9', 'panels', {}), /no pack Z9/);
    assert.throws(() => X.Packs.part('M11', 'panels', null), /not a record/);
    const pack = (species, modules) => ({ acc: 'T9', modules: modules || [{ id: 'alarm_network', role: 'signature', params: {} }], species });
    assert.throws(() => X.Packs.add(pack([{ id: 'T9.1', flags: ['copies_weaken'] }])), /T9.1 is flagged for copies_weaken, which is not one of T9's modules/);
    assert.throws(() => X.Packs.add(pack([{ id: 'T9.1', flags: 'alarm_network' }])), /flags are not a list/);
    assert.throws(() => X.Packs.add(pack([{ id: 'T9.1', copyOf: 'A4.1' }])), /copy of A4.1, which is not another species of T9/);
    assert.throws(() => X.Packs.add(pack([{ id: 'T9.1', copyOf: 'T9.1' }])), /not another species/);
    assert.throws(() => X.Packs.add({ acc: 'S9', species: [] }), /S9 is added twice/);
    X.Packs.add(pack([{ id: 'T9.1', flags: ['alarm_network'] }, { id: 'T9.2', copyOf: 'T9.1' }]));
    assert.ok(X.Packs.get('T9'));
    // The slice's packs: every flag names one of the department's own modules, each module a role.
    for (const p of Packs.list()) {
      for (const sp of p.species) for (const f of sp.flags || []) assert.ok(p.modules.some(m => m.id === f), `${sp.id}: ${f}`);
      for (const m of p.modules) assert.ok(['signature', 'secondary'].includes(m.role) && m.params && typeof m.params === 'object', `${p.acc}: ${m.id}`);
      assert.equal(p.modules.filter(m => m.role === 'signature').length, 1, p.acc);
    }
    eq(Packs.get('A4').species.filter(sp => sp.copyOf).map(sp => [sp.id, sp.copyOf]), [['A4.1a', 'A4.1'], ['A4.4a', 'A4.4']]);
  });

  test('Packs.sprites lists every species, Centrepiece, Centrepiece piece and attachment, and shared species, each with its archetype and size', () => {
    const own = Packs.sprites();
    for (const p of Packs.list()) {
      for (const sp of p.species) assert.ok(own.some(u => u.id === sp.id && u.sprite === sp.sprite && u.archetype === sp.archetype), sp.id);
      if (p.centrepiece) assert.ok(own.some(u => u.id === p.centrepiece.id && u.size === p.centrepiece.size), p.centrepiece.id);
    }
    for (const sp of Packs.sharedList()) assert.ok(own.some(u => u.id === sp.id), sp.id);
    const X = loadCore();
    X.Packs.add({ acc: 'T9', modules: [], species: [{ id: 'T9.1', sprite: 'a', archetype: 'plodder' }] });
    X.Packs.part('T9', 'centrepiece', { id: 'T9.9', sprite: 'b', archetype: 'mp_ensemble', size: 2,
      pieces: [{ id: 'T9.9/a', sprite: 'c' }, { id: 'T9.9/b', sprite: 'd', archetype: 'plodder', size: 1 }], attachments: [{ id: 'T9.9/arm', sprite: 'e' }] });
    const t9 = X.Packs.sprites().filter(u => u.id.startsWith('T9'));
    eq(t9, [{ id: 'T9.1', sprite: 'a', archetype: 'plodder', size: 1 }, { id: 'T9.9', sprite: 'b', archetype: 'mp_ensemble', size: 2 },
      { id: 'T9.9/a', sprite: 'c', archetype: 'mp_ensemble', size: 1 }, { id: 'T9.9/b', sprite: 'd', archetype: 'plodder', size: 1 }, { id: 'T9.9/arm', sprite: 'e', archetype: 'mp_ensemble', size: 1 }]);
  });

  // ---- Statuses (A3, A16.3) ----

  test('Status.define holds M3\'s statuses\' rules; a status is defined once, after its registry entry, with only effect, blocks and skipsAction', () => {
    eq(Status.defined(), ['fixed', 'rooted', 'coughing', 'restoring', 'slowed', 'dazed']);
    eq(Object.keys(Status.EFFECTS).sort(), ['coughing', 'restoring']);
    // Of M3's statuses only fixed makes its bearer only wait (§8.1), and only fixed and rooted
    // forbid you anything.
    for (const id of Status.defined()) {
      const r = Setup.room(1, { acc: 'T0', map: ['#####', '#...#', '#####'], you: [1, 1], exhibits: [{ sp: 'x', at: [3, 1], stats: C.Roles.stats('fodder', 1) }] });
      Status.apply(r, r.actors[1], id, 2, { k: 'status', id }, []);
      Status.apply(r, r.actors[0], id, 2, { k: 'status', id }, []);
      assert.equal(Status.skips(r, r.actors[1]), id === 'fixed', id);
      assert.equal(Status.blocks(r, r.actors[0], { a: 'move', dir: 2 }), id === 'fixed' || id === 'rooted' ? id : null, id);
    }
    const X = loadCore();
    assert.throws(() => X.Status.define('fixed', {}), /fixed is defined twice/);
    assert.throws(() => X.Status.define('planted', {}), /not in Registry.STATUSES/);
    X.Registry.define('STATUSES', 'planted', { icon: 'planted', harmful: true, words: 'planted', clause: 'is planted', params: {}, covers: ['status'], ready: true, tests: [], inv: 'status' });
    assert.throws(() => X.Status.define('planted', { effect: 1 }), /effect is not a function/);
    assert.throws(() => X.Status.define('planted', { skipsAction: 'yes' }), /skipsAction is not true or false/);
    assert.throws(() => X.Status.define('planted', { lasts: 3 }), /unknown part lasts/);
    // A planted status that refuses every step, and makes its bearer only wait.
    X.Status.define('planted', { blocks: (state, a, action) => action.a === 'move' ? 'planted_code' : null, skipsAction: true });
    const s = X.Setup.room(1, { acc: 'T0', map: ['#####', '#...#', '#####'], you: [1, 1], exhibits: [] });
    X.Status.apply(s, s.actors[0], 'planted', 3, { k: 'status', id: 'planted' }, []);
    assert.equal(X.Status.blocks(s, s.actors[0], { a: 'move', dir: 2 }), 'planted_code');
    assert.equal(X.Status.blocks(s, s.actors[0], { a: 'wait' }), null);
    assert.equal(X.Status.skips(s, s.actors[0]), true);
    // fixed's code comes before rooted's, as the rules were defined.
    X.Status.apply(s, s.actors[0], 'rooted', 3, { k: 'status', id: 'rooted' }, []);
    X.Status.apply(s, s.actors[0], 'fixed', 3, { k: 'status', id: 'fixed' }, []);
    assert.equal(X.Status.blocks(s, s.actors[0], { a: 'move', dir: 2 }), 'fixed');
    // An exhibit holding a status defined with skipsAction only waits (AI.act asks
    // Status.skips), as a fixed one does; without it, the same exhibit strikes you.
    const struck = withStatus => {
      const r = X.Setup.room(1, { acc: 'T0', map: ['#####', '#...#', '#####'], you: [1, 1], exhibits: [{ sp: 'x', at: [2, 1], mode: 'hunting', stats: C.Roles.stats('fodder', 1) }] });
      if (withStatus) { X.Status.apply(r, r.actors[1], 'planted', 5, { k: 'status', id: 'planted' }, []); X.Status.settle(r); }
      const ev = [];
      for (let i = 0; i < 3; i++) ev.push(...X.Step.step(r, { a: 'wait' }));
      return ev.filter(e => (e.k === 'attacked' || e.k === 'damaged' || e.k === 'missed') && e.cause && e.cause.by === r.actors[1].uid).length;
    };
    assert.ok(struck(false) > 0, 'the control exhibit strikes you');
    assert.equal(struck(true), 0, 'a skipping exhibit only waits');
  });

  test('a status for the rest of the visit (perm) outlives 10,000 turns and every timed renewal, and ends with the visit when you leave', () => {
    const s = Setup.room(3, { acc: 'T0', map: ['#######', '#E..X.#', '#######', '#.....#', '#######'], you: [2, 1], entrance: [1, 1], exits: [[4, 1]],
      exhibits: [{ sp: 'x', at: [3, 3], stats: C.Roles.stats('fodder', 1) }] }), you = s.actors[0], dummy = s.actors[1];
    const ev = [];
    assert.equal(Status.apply(s, you, 'coughing', 'perm', { k: 'status', id: 'coughing' }, ev), true);
    Status.apply(s, dummy, 'slowed', 'perm', { k: 'status', id: 'slowed' }, ev);
    eq(ev.map(e => [e.k, e.who, e.id, e.on, e.turns]), [['status', 'you', 'coughing', true, null], ['status', dummy.uid, 'slowed', true, null]]);
    Status.settle(s);
    eq(you.statuses, [{ id: 'coughing', until: null, turns: null, from: 0, perm: true }]);
    eq([Status.left(s, you, 'coughing'), Status.perm(you, 'coughing'), Status.perm(dummy, 'slowed'), Status.perm(you, 'slowed')], [null, true, true, false]);
    let coughs = 0, ended = 0;
    for (let i = 0; i < 10000; i++) {
      if (i === 5000) Status.apply(s, you, 'coughing', 2, { k: 'status', id: 'coughing' }, []);
      for (const e of Step.step(s, { a: 'wait' })) { if (e.k === 'noise' && e.cause.k === 'cough') coughs++; if (e.k === 'status' && !e.on) ended++; }
    }
    assert.equal(s.turn, 10000);
    eq([coughs, ended], [10000, 0], 'a cough at each of 10,000 boundaries, and nothing ended');
    eq([you.statuses, dummy.statuses.map(q => [q.id, q.perm, q.until])], [[{ id: 'coughing', until: null, turns: null, from: 0, perm: true }], [['slowed', true, null]]]);
    // The labels say so: until you leave, never a count of turns.
    assert.ok(C.Labels.you(s).odds.includes('You are coughing until you leave.'), json(C.Labels.you(s).odds));
    assert.ok(C.Labels.of(s, dummy.uid).pictos.some(p => p.text === 'slowed, until you leave'), json(C.Labels.of(s, dummy.uid).pictos));
    // A timed status made perm lasts for good; perm survives a clone; and Setup.room keeps it.
    const t = Setup.room(1, { acc: 'T0', map: ['#####', '#...#', '#####'], you: [1, 1], exhibits: [], youStatuses: [{ id: 'dazed', perm: true }] });
    eq(t.actors[0].statuses, [{ id: 'dazed', until: null, turns: null, from: 0, perm: true }]);
    Status.apply(t, t.actors[0], 'slowed', 2, { k: 'status', id: 'slowed' }, []); Status.settle(t);
    Status.apply(t, t.actors[0], 'slowed', 'perm', { k: 'status', id: 'slowed' }, []); Status.settle(t);
    eq(t.actors[0].statuses[1], { id: 'slowed', until: null, turns: null, from: 0, perm: true });
    assert.equal(State.hash(State.clone(t)), State.hash(t));
    assert.throws(() => Status.apply(t, t.actors[0], 'slowed', 'forever', { k: 'status', id: 'slowed' }, []), /slowed for forever turns/);
    // Leaving ends the visit, and with it every status: nothing more runs, and the next visit's
    // visitor (its carry has no statuses) starts with none.
    you.x = 4; you.y = 1;
    assert.equal(Step.step(s, { a: 'leave', i: 0 })[0].k, 'left');
    eq(Step.step(s, { a: 'wait' }).map(e => e.reason), ['visit_over']);
    const next = Dept.create(4, 'A4', 2, { carry: { grade: 2 } });
    assert.ok(next.actors.every(a => a.statuses.length === 0));
  });

  test('a status an actor is immune to (Archetypes.immune) is not put on it: no record, no event, and false', () => {
    const X = loadCore();
    X.Archetypes.immune = (state, a, id) => a.uid !== 'you' && id === 'dazed';
    const s = X.Setup.room(1, { acc: 'T0', map: ['#####', '#...#', '#####'], you: [1, 1], exhibits: [{ sp: 'x', at: [3, 1], stats: C.Roles.stats('fodder', 1) }] }), ev = [];
    assert.equal(X.Status.apply(s, s.actors[1], 'dazed', 2, { k: 'status', id: 'dazed' }, ev), false);
    eq([s.actors[1].statuses, ev], [[], []]);
    assert.equal(X.Status.apply(s, s.actors[1], 'slowed', 2, { k: 'status', id: 'slowed' }, ev), true);
    assert.equal(X.Status.apply(s, s.actors[0], 'dazed', 2, { k: 'status', id: 'dazed' }, ev), true);
    eq(ev.map(e => e.id), ['slowed', 'dazed']);
  });

  // ---- The shutter (A13) ----

  test('a shutter (Z) blocks steps, sight and bolts for you and exhibits, and a noise passes it with NOISE_DOOR extra, as through a closed door', () => {
    const mk = c => ({ w: 7, h: 3, tiles: ['#######', `#..${c}..#`, '#######'], surfaces: [] });
    const z = mk('Z'), door = mk('+');
    for (const who of [undefined, 'you', 'exhibit']) {
      assert.equal(Grid.walkable(z, 3, 1, who), false, who);
      assert.equal(Grid.canStep(z, 2, 1, 2, who), false, who);
    }
    eq([Grid.seeThrough(z, 3, 1), Grid.los(z, 1, 1, 5, 1), Grid.bolt(z, 3, 1), Grid.hold(z, 3, 1), Grid.closedDoor(z, 3, 1)], [false, false, false, false, true]);
    assert.equal(Grid.TILES.Z.name, 'shutter');
    const far = (m, range) => Noise.reach(m, 1, 1, range)[1 * 7 + 5];
    // From (1,1) to (5,1) is 4 steps; entering the shutter costs NOISE_DOOR more.
    assert.equal(far(z, 99), 4 + N.NOISE_DOOR);
    assert.equal(far(z, 99), far(door, 99), 'as through a closed door');
    assert.equal(far(z, 3 + N.NOISE_DOOR), -1, 'not past its range');
    assert.equal(Grid.distances(z, [[1, 1]], 99)[1 * 7 + 5], -1, 'no one walks through it');
    // In a room: a step into it is refused and leaves you where you are.
    const s = Setup.room(1, { acc: 'T0', map: ['#######', '#..Z..#', '#######'], you: [2, 1], exhibits: [] });
    eq(Step.step(s, { a: 'move', dir: 2 }).map(e => [e.k, e.reason]), [['refused', 'blocked']]);
    eq([s.actors[0].x, s.actors[0].y], [2, 1]);
  });

  // ---- Dept.create's cost (A17) ----

  test('tools/dept-p95.js: the p95 of Dept.create in CPU-ms over every department, depth 1–7 and seed, and OVER past the budget of 40', () => {
    const P = require(path.join(root, 'tools/dept-p95.js'));
    assert.equal(P.BUDGET_MS, 40);
    // Nearest rank: of 1–20, p50 is the 10th and p95 the 19th; of 1–21, the 11th and the 20th
    // (the rank rounded up, never down).
    const t = Array.from({ length: 20 }, (_, i) => i + 1), t21 = t.concat([21]);
    assert.deepEqual([P.rank(t, 50), P.rank(t, 95), P.rank([7], 95), P.rank(t21, 50), P.rank(t21, 95)], [10, 19, 7, 11, 20]);
    assert.equal(P.line(t, 40), 'Dept.create: 20 departments, CPU-ms p50 10.0, p95 19.0, max 20.0; budget p95 40');
    assert.equal(P.line(t, 18), 'Dept.create: 20 departments, CPU-ms p50 10.0, p95 19.0, max 20.0; budget p95 18 OVER');
    const m = P.measure(C, 1);
    assert.ok(m.length === 21 && m.every((x, i) => x >= 0 && (i === 0 || x >= m[i - 1])), 'one time a department, 3 × 7, sorted');
    const { spawnSync } = require('node:child_process');
    const r = spawnSync(process.execPath, [path.join(root, 'tools/dept-p95.js'), '--seeds', '1', '--budget', '0'], { encoding: 'utf8' });
    assert.ok(r.status === 0 && /^Dept\.create: 21 departments, CPU-ms p50 [\d.]+, p95 [\d.]+, max [\d.]+; budget p95 0 OVER\n$/.test(r.stdout), r.stdout + r.stderr);
    assert.equal(spawnSync(process.execPath, [path.join(root, 'tools/dept-p95.js'), '--seeds', 'x'], { encoding: 'utf8' }).status, 2);
  });
};
