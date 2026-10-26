// The policy plumbing (tools/policies/lib.js and cards.js; BUILD.md §10.2): what a policy
// sees, the helpers on what it sees, the registry and its cards, the README they generate,
// and the determinism of bots (the plan's R29): the hardened context, the lint, and their
// own streams.
module.exports = ({ test, assert, root, path, fs }) => {
  const Sim = require(path.join(root, 'tools/sim.js'));
  const C = Sim.load();
  const J = v => JSON.parse(JSON.stringify(v)), eq = (a, b, m) => assert.deepEqual(J(a), J(b), m);
  const plainVm = vm => J(Object.assign({}, vm, { vis: Array.from(vm.vis), ring: Array.from(vm.ring) }));
  const stamp = (head, map) => C.Arena.parse(head.join('\n') + '\n\n' + map.join('\n') + '\n');
  // You at (2,2); a sleeping fodder beside you; another 3 tiles off; a third behind a wall.
  const ROOM = stamp(['arena: look', 'goal: kill', 'species: plodder', 'depths: 2', 'legend: N exhibit sp; F exhibit sp; Z exhibit role=fodder'],
    ['##########', '#........#', '#.@N..F.##', '#.......#Z', '##########']);
  const os = require('node:os'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'accession-policies-'));
  const planted = (name, src) => { const f = path.join(tmp, name); fs.writeFileSync(f, "'use strict';\n" + src + '\n'); return f; };

  test('Obs.make shows what a player sees: the view model with the events, the legal actions, the log and the stream', () => {
    const s = C.Arena.build(ROOM, 1);
    const ev = C.Step.step(s, { a: 'wait' });
    const rng = C.Rng.stream({ seed: 1, rng: {} }, 'policy/test/1'), reads = [];
    const obs = C.Obs.make(s, ev, reads, rng);
    eq(Object.keys(obs).sort(), ['legal', 'log', 'read', 'rng', 'vm']);
    eq(plainVm(obs.vm), plainVm(C.ViewModel.derive(s, { events: ev })));
    eq(obs.legal, C.Step.legal(s));
    const shown = obs.vm.actors.map(a => a.uid);
    eq(obs.log, C.Text.log(ev, C.Labels.nameOf(s), uid => shown.includes(uid)));
    assert.equal(obs.rng, rng);
    assert.ok(!shown.includes(s.actors[3].uid), 'the exhibit behind the wall is not in the view model');
    assert.ok(shown.includes(s.actors[1].uid) && shown.includes(s.actors[2].uid));
    // The one-turn cues a player sees come from the last step's events (the plan's D7.7): a
    // hunting exhibit in view steps toward you, then strikes you.
    const H = C.Arena.parse('arena: cue\ngoal: kill\ndepths: 3\nlegend: Q exhibit role=fodder mode=hunting\n\n########\n#@..Q..#\n########\n');
    const h = C.Arena.build(H, 1), q = h.actors[1].uid;
    const cue = (movedFrom, hit) => ({ movedFrom, hit, broke: [], special: [] });
    for (const want of [cue([{ uid: q, x: 4, y: 1 }], []), cue([{ uid: q, x: 3, y: 1 }], []), cue([], ['you'])]) {
      const e = C.Step.step(h, { a: 'wait' }), o = C.Obs.make(h, e, null, null);
      eq(o.vm.cues, want);
      eq(o.vm.cues, C.ViewModel.derive(h, { events: e }).cues);
      assert.notDeepEqual(J(o.vm.cues), J(C.ViewModel.derive(h, {}).cues), 'without the events the cues are gone');
      if (want.hit.length) assert.ok(o.log.length > 0, 'and the log says you were hit');
    }
  });

  test("what a policy is handed is its own: a frozen copy, so nothing it writes reaches the game", () => {
    const s = C.Arena.build(ROOM, 1), obs = C.Obs.make(s, [], null, null);
    assert.notEqual(obs.vm.tiles, s.dept.tiles, 'not the state\'s own tiles');
    for (const v of [obs.vm, obs.vm.tiles, obs.vm.vis, obs.vm.ring, obs.vm.actors, obs.vm.actors[0], obs.vm.you, obs.vm.cues, obs.legal, obs.legal[0], obs.log])
      assert.ok(Object.isFrozen(v));
    assert.ok(Array.isArray(obs.vm.vis) && Array.isArray(obs.vm.ring), 'typed arrays become plain lists');
    const was = C.State.hash(s);
    assert.equal(Reflect.set(obs.vm.tiles, 2, '##########'), false);
    assert.equal(Reflect.set(obs.vm.actors[0], 'x', 9), false);
    assert.equal(Reflect.set(obs.legal[0], 'a', 'fly'), false);
    assert.equal(C.State.hash(s), was);
    s.over = { k: 'died', turn: 0, by: null, door: null, cause: null };
    const ended = C.Obs.make(s, [], null, null);
    assert.equal(Reflect.set(ended.vm.over, 'k', 'left'), false);
    assert.equal(s.over.k, 'died');
  });

  test("read gives a label's text for what is in view, the paragraph only within reach, and nothing for the rest", () => {
    const s = C.Arena.build(ROOM, 1), reads = [];
    const obs = C.Obs.make(s, [], reads, null);
    const [near, far, hidden] = [s.actors[1], s.actors[2], s.actors[3]];
    const sp = C.Packs.speciesFor(s, near);
    const t = obs.read(near.uid);
    assert.ok(t.includes(sp.name) && t.includes(C.Labels.of(s, near.uid).behaviour), t);
    assert.ok(t.includes(sp.paragraph), 'within reading distance the paragraph is there');
    const f = obs.read(far.uid);
    assert.ok(f.includes('Come closer to read the label.') && !f.includes(sp.paragraph), f);
    assert.equal(obs.read(hidden.uid), null, 'out of view');
    assert.equal(obs.read('nobody'), null); assert.equal(obs.read(42), null); assert.equal(obs.read('case:x,y'), null);
    eq(reads.map(r => [r.turn, r.target, r.text === null]), [[0, near.uid, false], [0, far.uid, false], [0, hidden.uid, true], [0, 'nobody', true], [0, '42', true], [0, 'case:x,y', true]]);
    for (const r of reads) if (r.text) assert.doesNotMatch(r.text, /undefined|NaN|\[object/);
  });

  test("read asks the labels of cases, items, plaques and staff doors only for what is in view", () => {
    const C2 = Sim.load(), calls = [];
    // The four labels are W2a-LABELS's; here they are planted, to see when they are asked.
    C2.Labels.ofCase = (state, f) => { calls.push('case ' + f.x + ',' + f.y); return { title: 'Case', num: f.num }; };
    C2.Labels.ofItem = (state, uid) => { calls.push('item ' + uid); return { title: 'Item ' + uid }; };
    C2.Labels.ofPlaque = (state, f) => { calls.push('plaque'); return 'A plaque.'; };
    C2.Labels.ofStaffDoor = (state, f) => { calls.push('staff'); return 'A staff door.'; };
    const spec = C2.Arena.parse('arena: c\ngoal: open R\nlegend: R case + item curio; Q case; I item weapon\n\n#########\n#@.R.#.Q#\n#..I.#..#\n#########\n');
    const s = C2.Arena.build(spec, 1);
    const obs = C2.Obs.make(s, [], null, null);
    const shownCase = s.dept.fixtures[0], hiddenCase = s.dept.fixtures[1];
    assert.equal(obs.read(`case:${shownCase.x},${shownCase.y}`), `Case\n${shownCase.num}`);
    assert.equal(obs.read(`case:${hiddenCase.x},${hiddenCase.y}`), null, 'a case out of view');
    assert.equal(obs.read('case:2,2'), null, 'no case there');
    assert.equal(obs.read(`plaque:${shownCase.x},${shownCase.y}`), null, 'that fixture is not a plaque');
    const inCase = s.items.find(i => i.where.at === 'case'), onFloor = s.items.find(i => i.where.at === 'floor');
    assert.equal(obs.read('item:' + onFloor.uid), 'Item ' + onFloor.uid);
    assert.equal(obs.read('item:' + inCase.uid), 'Item ' + inCase.uid);
    assert.equal(obs.read('item:you.w'), 'Item you.w', 'what you wear is always in view');
    assert.equal(obs.read('item:nothing'), null);
    eq(calls, [`case ${shownCase.x},${shownCase.y}`, 'item ' + onFloor.uid, 'item ' + inCase.uid, 'item you.w']);
  });

  test("Obs.text writes a label in the panel's order", () => {
    const label = { uid: 'x', title: 'The Thing', stateIcons: ['asleep'], tomb: { maker: 'M', date: 'D' }, number: 'S.9.1',
      pictos: [{ icon: 'heart', text: '5/5' }], behaviour: 'Walks.', odds: ['One.', 'Two.'], paragraph: 'Para.', far: '', closeup: { sprite: 's' },
      actions: [{ id: 'attack', text: 'Attack: 50%' }], extra: 'Last.' };
    assert.equal(C.Obs.text(label), ['The Thing', 'S.9.1', 'asleep', 'M', 'D', 'heart 5/5', 'Walks.', 'One.', 'Two.', 'Para.', 'Attack: 50%', 'Last.'].join('\n'));
    assert.equal(C.Obs.text(null), null); assert.equal(C.Obs.text('Plain.'), 'Plain.');
  });

  test('the helpers read only the view model: paths, steps, blows, retreat, lines, marks, hostiles', () => {
    const s = C.Arena.build(ROOM, 1), obs = C.Obs.make(s, [], null, null), vm = obs.vm;
    const me = C.Obs.you(vm), [N, F] = [s.actors[1], s.actors[2]];
    eq([me.x, me.y], [2, 2]);
    eq(C.Obs.hostiles(vm).map(a => a.uid), [N.uid, F.uid], 'nearest first');
    // Where the view model shows the whole room, its path is the tap's (Path.to on the state).
    for (const [x, y] of [[7, 1], [1, 3], [F.x, F.y], [5, 3]]) eq(C.Obs.path(vm, x, y), C.Path.to(s, x, y), `path to ${x},${y}`);
    const st = C.Obs.step(obs, 7, 1);
    eq(st, { a: 'move', dir: C.Path.dirTo([2, 2], C.Path.to(s, 7, 1)[0]) });
    assert.ok(obs.legal.some(l => C.Obs.same(l, st)));
    eq(C.Obs.attack(obs, N.uid), { a: 'attack', uid: N.uid });
    assert.equal(C.Obs.attack(obs, F.uid), null, 'too far to strike');
    const aw = C.Obs.away(obs, N.x, N.y);
    assert.ok(aw && C.Grid.chebyshev(2 + C.Grid.DX[aw.dir], 2 + C.Grid.DY[aw.dir], N.x, N.y) === 2, JSON.stringify(aw));
    assert.equal(C.Obs.inLine(me, N), true); assert.equal(C.Obs.inLine(me, { x: 5, y: 5 }), false);
    assert.equal(C.Obs.inLine(me, F, 3), false, 'F is 4 along the row'); assert.equal(C.Obs.inLine(me, F, 4), true);
    assert.equal(C.Obs.inLine({ x: 3, y: 3, size: 2 }, { x: 4, y: 9 }), true, 'a 2×2 shares column 4');
    const marked = { marks: [{ kind: 'telegraph', x: 3, y: 2, dmg: 4 }, { kind: 'telegraph', x: 3, y: 2, dmg: 2 }, { kind: 'call', x: 3, y: 2, dmg: null }] };
    assert.equal(C.Obs.marked(marked, 3, 2), 6); assert.equal(C.Obs.marked(marked, 4, 2), 0);
    eq(['wait', 'move', 'attack', 'use'].map((a, i) => C.Obs.say([{ a: 'wait' }, { a: 'move', dir: 2 }, { a: 'attack', uid: 'u' }, { a: 'use', uid: 'f', x: 3, y: 4 }][i])), ['wait', 'move east', 'attack u', 'use f at 3,4']);
    // A step toward a tile with no way to it is none.
    assert.equal(C.Obs.step(obs, 9, 3), null);
  });

  // A wall with two staff doors in it, both in view: grade 3 at (4,2) on the short way east,
  // grade 1 at (4,4) on the way round. You are at (2,2), at grade 2; the whole room is
  // remembered, so the view model shows the far side.
  const STAFF = { map: ['#######', '#...#.#', '#...S.#', '#...#.#', '#...S.#', '#######'], doors: [[4, 2, 3], [4, 4, 1]] };
  const staffSpec = { acc: 'A4', depth: 2, map: STAFF.map, you: [2, 2], grade: 2, fixtures: STAFF.doors.map(([x, y, grade]) => ({ k: 'staff', x, y, grade })) };
  const staffRoom = (K) => { const s = (K || C).Setup.room(1, staffSpec, {}); s.dept.seen = s.dept.tiles.join(''); return s; };
  // The view model with the staff doors in view as W2a-VM lists them (the plan's A14) and
  // your grade from run.grade.
  const withStaff = (s, vm) => Object.assign({}, vm, { you: Object.assign({}, vm.you, { grade: s.run.grade }),
    staff: s.dept.fixtures.filter(f => f.k === 'staff' && vm.vis[f.y * vm.w + f.x] === 2).map(f => ({ x: f.x, y: f.y, grade: f.grade, open: false })) });

  test("a policy's path carries the staff doors it sees and your grade, so it is the tap's", () => {
    const C2 = Sim.load(), boards = [], to = C2.Path.to;
    C2.Path.to = (b, x, y) => { boards.push(b); return to(b, x, y); };
    const s = staffRoom(C2), obs = C2.Obs.make(s, [], null, null), vm = withStaff(s, obs.vm);
    assert.equal(vm.staff.length, 2, 'both doors are in view');
    C2.Obs.path(vm, 5, 2);
    const b = boards[0];
    eq([b.run.grade, b.dept.fixtures], [2, [{ k: 'staff', x: 4, y: 2, grade: 3 }, { k: 'staff', x: 4, y: 4, grade: 1 }]]);
    eq([C2.Cases.at(b, 4, 2).grade, C2.Cases.at(b, 4, 4).grade], [3, 1], "the case rules find each door's grade on the board");
    eq([b.dept.w, b.dept.h, b.dept.tiles, b.actors.map(a => a.uid)], [vm.w, vm.h, vm.tiles, vm.actors.map(a => a.uid)]);
    // The view model itself lists the staff doors in view and your grade from the run, so
    // the policy's own board is that one.
    C2.Obs.path(obs.vm, 5, 2);
    eq([boards[1].dept.fixtures, boards[1].run.grade], [b.dept.fixtures, 2]);
  });

  test('round staff doors, Obs.path and Obs.step go where the tap goes', () => {
    const s = staffRoom(), obs = C.Obs.make(s, [], null, null), vm = withStaff(s, obs.vm);
    for (const [x, y] of [[5, 2], [5, 1], [5, 4], [3, 4], [1, 1]]) eq(C.Obs.path(vm, x, y), C.Path.to(s, x, y), `path to ${x},${y}`);
    // Walk the policy's steps toward (5, 2): each is the tap's first step, none is refused,
    // and it arrives.
    for (let i = 0; i < 12 && !(s.actors[0].x === 5 && s.actors[0].y === 2); i++) {
      const o = C.Obs.make(s, [], null, null), st = C.Obs.step(Object.assign({}, o, { vm: withStaff(s, o.vm) }), 5, 2), at = `${s.actors[0].x},${s.actors[0].y}`;
      assert.ok(st, `a step at ${at}`);
      eq(st, { a: 'move', dir: C.Path.dirTo([s.actors[0].x, s.actors[0].y], C.Path.to(s, 5, 2)[0]) }, `the tap's step at ${at}`);
      const ev = C.Step.step(s, st);
      assert.ok(!(ev.length === 1 && ev[0].k === 'refused'), `refused at ${at}: ${JSON.stringify(ev)}`);
    }
    eq([s.actors[0].x, s.actors[0].y], [5, 2], 'it arrives');
  });

  test('policies run in the hardened context: Math.random and the clock throw', () => {
    const f = planted('chance.js', [
      "Policies.add('chance', {",
      "  dice: { card: { summary: 'Rolls a die it may not have.', rules: ['Roll.'] }, decide: obs => ({ action: { a: 'wait' }, reason: 'rolled ' + Math.random() }) },",
      "  clock: { card: { summary: 'Reads a clock it may not have.', rules: ['Look at the time.'] }, decide: obs => ({ action: { a: 'wait' }, reason: 'at ' + Date.now() }) },",
      '});',
    ].join('\n'));
    const C2 = Sim.load([f]);
    const make = (s, o) => C2.Arena.build(ROOM, s, { options: o });
    const a = Sim.run({ C: C2, make, policy: 'chance.dice', seed: 1, cap: 5 });
    assert.equal(a.stopped, 'error'); assert.match(a.error, /chance\.dice failed to decide at turn 0: .*random/);
    const b = Sim.run({ C: C2, make, policy: 'chance.clock', seed: 1, cap: 5 });
    assert.equal(b.stopped, 'error'); assert.match(b.error, /Date is not allowed in the deterministic core/);
  });

  test('lint-core passes the policy files and the arena tool, and fails a planted policy', () => {
    const { spawnSync } = require('node:child_process');
    const lint = files => spawnSync(process.execPath, [path.join(root, 'tools/lint-core.js'), ...files], { encoding: 'utf8' });
    const ours = fs.readdirSync(Sim.POLICY_DIR).filter(f => f.endsWith('.js')).map(f => path.join(Sim.POLICY_DIR, f));
    const r = lint(ours.concat([path.join(root, 'tools/arena.js')]));
    assert.equal(r.status, 0, r.stdout);
    for (const bad of ['for (const k in obs) {}', 'const r = Math.random();', "['b', 'a'].sort();", 'const t = Date.now();', 'const x = Math.sqrt(2);']) {
      const f = planted('bad.js', `Policies.add('bad', { p: { card: { summary: 'Bad.', rules: ['Bad.'] }, decide(obs) { ${bad} return { action: { a: 'wait' }, reason: 'bad' }; } } });`);
      assert.equal(lint([f]).status, 1, 'not caught: ' + bad);
    }
  });

  test('Policies.add refuses a policy without a card in words or a decide, and get resolves names', () => {
    const C2 = Sim.load();
    const card = { summary: 'Does a thing.', rules: ['Do it.'] }, decide = obs => ({ action: { a: 'wait' }, reason: 'r' });
    const bad = [
      [['Bad', { p: { card, decide } }], /a group id is lower-case/],
      [['basic', { p: { card, decide } }], /the group basic is added twice/],
      [['g', {}], /g has no policies/],
      [['g', { P: { card, decide } }], /a policy name is lower-case/],
      [['g', { p: { decide } }], /g\.p has no card/],
      [['g', { p: { card: { rules: ['x'] }, decide } }], /needs a card summary/],
      [['g', { p: { card: { summary: 'x', rules: [] }, decide } }], /needs card rules/],
      [['g', { p: { card: { summary: 'x', rules: ['undefined'] }, decide } }], /needs card rules/],
      [['g', { p: { card: Object.assign({ weights: [['a']] }, card), decide } }], /weights that are not \[name, value\] pairs/],
      [['g', { p: { card } }], /needs decide/],
      [['g', { p: { card, decide, kit: { instrument: {} } } }], /only the weapon and garment/],
    ];
    for (const [args, re] of bad) assert.throws(() => C2.Policies.add(...args), re);
    C2.Policies.add('g', { naive: { card, decide }, counter: { card: Object.assign({ weights: [['patience', 3], ['style', 'calm']] }, card), decide, kit: { weapon: { form: 'heavy' } } } });
    assert.equal(C2.Policies.get('g.naive').name, 'g.naive');
    assert.equal(C2.Policies.get('counter', 'g').name, 'g.counter');
    assert.equal(C2.Policies.get('fighter', 'g').name, 'basic.fighter', 'then the basic group');
    assert.equal(C2.Policies.get('naive'), null, 'a bare name outside its group');
    assert.equal(C2.Policies.get('g.none'), null);
    const text = C2.Cards.text('g.counter', C2.Policies.get('g.counter').policy);
    assert.equal(text, 'g.counter: Does a thing.\n  1. Do it.\n  Weights: patience 3, style calm.\n  Kit: weapon heavy.');
    const md = C2.Cards.readme();
    assert.ok(md.includes('### g.counter') && md.includes('Weights: patience 3, style calm.') && md.includes('Kit: weapon heavy.'));
  });

  test('tools/policies/README.md is the cards, regenerated', () => {
    const want = C.Cards.readme(), have = fs.readFileSync(Sim.README, 'utf8');
    assert.equal(have, want, 'tools/policies/README.md is out of date: run node tools/sim.js --cards --write');
    for (const p of C.Policies.list()) {
      assert.ok(have.includes(`### ${p.name}`) && have.includes(p.policy.card.summary), p.name);
      for (const r of p.policy.card.rules) assert.ok(have.includes(r), `${p.name}: ${r}`);
    }
    assert.doesNotMatch(have, /undefined|NaN|\[object/);
  });

  test("a policy's stream is its own: never in the state, the same on one seed, different on another", () => {
    const make = (s, o) => C.Arena.build(ROOM, s, { options: o });
    let last = null;
    const r1 = Sim.run({ make, policy: 'random', seed: 3, cap: 30, check: (pre, a, ev, post) => { last = post; return []; } });
    assert.ok(!Object.keys(last.rng).some(k => k.startsWith('policy/')), 'no policy stream in the state');
    const r2 = Sim.run({ make, policy: 'random', seed: 3, cap: 30 });
    eq([r2.reasons, r2.replay.actions, r2.reads, r2.endHash], [r1.reasons, r1.replay.actions, r1.reads, r1.endHash], 'two runs, one decision log');
    // The first decision is the stream's first draw over the legal actions.
    const s = make(3, {}), legal = C.Step.legal(s), first = C.Rng.stream({ seed: 3, rng: {} }, 'policy/basic.random/3').pick(legal);
    eq(r1.replay.actions[0], first);
    const r3 = Sim.run({ make: (s2, o) => C.Arena.build(ROOM, 3, { options: o }), policy: 'random', seed: 4, cap: 30 });
    assert.notDeepEqual(J(r3.replay.actions), J(r1.replay.actions), 'another seed, another stream');
    // The fighter, which draws nothing, is as repeatable in a department.
    const d = (s2, o) => C.Dept.create(s2, 'A4', 2, o);
    const f1 = Sim.run({ make: d, policy: 'fighter', seed: 2, cap: 40 }), f2 = Sim.run({ make: d, policy: 'fighter', seed: 2, cap: 40 });
    eq([f1.reasons, f1.endHash], [f2.reasons, f2.endHash]);
  });
};
