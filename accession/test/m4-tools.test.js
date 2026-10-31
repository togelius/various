// M4's tools (plan W0f): the visitor a replay or a sim run carries (start.carry, --carry); an
// arena's rooms and the archetypes an arena may draw; the harness's switches, species, rooms
// and Centrepiece hall; the patrol's starting story and the doers of M4's event kinds; and
// the golden tools: pending by name, a retired run played in its release build, and a replay
// recorded from its recipe, whose story is checked while it is pending.
// Every expectation about what a visit does is worked out from the same core, never written in
// as a number, since every M4 package changes the rules.
'use strict';
module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const os = require('node:os'), cp = require('node:child_process');
  const Golden = require(path.join(root, 'tools/golden.js'));
  const Sim = require(path.join(root, 'tools/sim.js'));
  const Battery = require(path.join(root, 'tools/battery.js'));
  const Hashes = require(path.join(root, 'tools/core-hash.js'));
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const json = x => JSON.stringify(x);
  const C = loadCore(['tools/monkey.js', 'tools/replay.js', 'tools/arena.js']);
  // One temporary folder for every test here, removed when the process ends, whatever failed.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'accession-m4-tools-'));
  process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
  const tool = (...args) => cp.spawnSync(process.execPath, [path.join(root, 'tools/golden.js')].concat(args), { encoding: 'utf8' });
  const refusedText = /^golden: .+; nothing was written \(node tools\/golden\.js --help lists the usage\)\n$/;

  // ---- The carry (M4 plan A2) ----

  test('a replay\'s start.carry is the visit\'s visitor: Replay.begin gives it to Dept.create, make keeps it, and a carry on a start that is no department visit is refused', () => {
    const X = loadCore(['tools/monkey.js', 'tools/replay.js']), seen = [], real = X.Dept.create;
    X.Dept.create = (seed, acc, depth, o) => { seen.push([seed, acc, depth, o && o.carry !== undefined ? json(o.carry) : 'none', !!(o && o.invulnerable)]); return real(seed, acc, depth, o); };
    const items = { grade: 3, items: [{ ref: 'S9.10', slot: 'curio0' }] };
    for (const carry of ['start', 'median', items, undefined]) X.Replay.begin(Object.assign({ seed: 4, dept: 'S9', depth: 3 }, carry === undefined ? {} : { carry }), { invulnerable: true });
    assert.deepEqual(seen, [[4, 'S9', 3, '"start"', true], [4, 'S9', 3, '"median"', true], [4, 'S9', 3, json(items), true], [4, 'S9', 3, 'none', true]]);
    // As the core builds it: the start's state is Dept.create's with that carry.
    for (const carry of ['start', 'median', items]) {
      const begun = C.Replay.begin({ seed: 7, dept: 'S9', depth: 4, carry }, {}), made = C.Dept.create(7, 'S9', 4, { carry });
      assert.equal(C.State.hash(begun), C.State.hash(made), json(carry));
    }
    // make keeps the carry in the start, so the replay rebuilds its visit alone.
    const r = C.Replay.make({ seed: 7, dept: 'S9', depth: 4, carry: items }, {}, [{ a: 'wait' }, { a: 'wait' }], 'test');
    assert.equal(C.State.canon(r.start), C.State.canon({ seed: 7, dept: 'S9', depth: 4, carry: items }));
    const again = C.Replay.play(JSON.parse(json(r)));
    assert.equal(again.hash, C.Replay.play(r).hash);
    assert.equal(again.startHash, C.State.hash(C.Dept.create(7, 'S9', 4, { carry: items })));
    for (const start of [{ seed: 1, room: 'T0', carry: 'start' }, { state: C.Dept.create(1, 'S9', 2), carry: 'start' }]) {
      assert.throws(() => C.Replay.begin(start, {}), /a carry gives the visitor of a department visit/);
    }
    // M3's replay starts as M3's visitor did.
    const m3 = Golden.read(Golden.FILE).m3Replay;
    if (m3) {
      assert.equal(m3.start.carry, 'start');
      assert.equal(C.State.hash(C.Replay.begin(m3.start, m3.options)), C.State.hash(C.Dept.create(m3.start.seed, m3.start.dept, m3.start.depth, { carry: 'start' })));
    }
  });

  test('sim --carry: median, start, JSON or grade=,tier=,perks=,items= are read as Dept.create\'s carry; a run\'s replay keeps it and rebuilds its visit; an arena refuses one', () => {
    assert.equal(Sim.parseCarry('median'), 'median');
    assert.equal(Sim.parseCarry(' start '), 'start');
    assert.deepEqual(Sim.parseCarry('{"grade":4,"items":[{"ref":"S9.10","slot":"tote"}]}'), { grade: 4, items: [{ ref: 'S9.10', slot: 'tote' }] });
    assert.deepEqual(Sim.parseCarry('grade=4,tier=2,perks=soft_soles:2+elbow_room:1,items=S9.10:curio0+S9.4:tote'),
      { grade: 4, tier: 2, perks: [{ id: 'soft_soles', rank: 2 }, { id: 'elbow_room', rank: 1 }], items: [{ ref: 'S9.10', slot: 'curio0' }, { ref: 'S9.4', slot: 'tote' }] });
    for (const bad of ['', 'medium', 'grade=IV', 'grade=4,grade=5', 'colour=red', 'perks=soft_soles', 'items=S9.10', 'perks=soft_soles:two', '{"grade":', '[1]', 'tier=']) {
      assert.throws(() => Sim.parseCarry(bad), /^Error: sim: --carry is median, start/, json(bad));
    }
    assert.deepEqual(Sim.parseArgs(['--dept', 'S9', '--policy', 'wander', '--carry', 'grade=2']).carry, { grade: 2 });
    assert.throws(() => Sim.parseArgs(['--carry', 'start', '--carry', 'median']), /--carry is given twice/);
    const S = Sim.context();
    for (const carry of [undefined, 'start', { grade: 5, items: [{ ref: 'S9.10', slot: 'curio0' }] }]) {
      const r = Sim.runArena({ dept: 'S9' }, 'wander', 3, { C: S, depth: 2, cap: 12, carry });
      assert.equal(json(r.replay.start), json(Object.assign({ dept: 'S9', seed: 3, depth: 2 }, carry === undefined ? {} : { carry })));
      // The start alone rebuilds the visit, and the replay plays to the run's end.
      assert.equal(S.State.hash(Sim.rebuild(r.replay.start, r.replay.options, S)), r.startHash, json(carry));
      assert.equal(r.startHash, S.State.hash(S.Dept.create(3, 'S9', 2, carry === undefined ? {} : { carry })), json(carry));
      assert.equal(S.Replay.play(r.replay).hash, r.endHash, json(carry));
    }
    assert.throws(() => Sim.runArena('dummy', 'basic.idle', 1, { C: S, carry: 'start' }), /a carry gives the visitor of a department visit; the arena dummy gives its own kit/);
  });

  // ---- Arenas: rooms, and the archetypes an arena may draw ----

  const ROOMED = [
    'arena: roomed',
    'goal: kill',
    'species: plodder',
    'depths: 3',
    'rooms: hall centre 1,1-5,3; s1 section 7,1-11,3',
    'legend: P exhibit sp',
    '',
    '#############',
    '#@...,.....P#',
    '#....,......#',
    '#....+......#',
    '#############',
  ].join('\n');

  test('an arena\'s rooms: line gives the rooms a department has (dept.rooms, dept.roomOf), the same as the harness\'s; a wanderer keeps to its room; a bad rooms line is refused', () => {
    const spec = C.Arena.parse(ROOMED);
    assert.equal(json(spec.rooms), json([{ key: 'hall', role: 'centre', x0: 1, y0: 1, x1: 5, y1: 3 }, { key: 's1', role: 'section', x0: 7, y0: 1, x1: 11, y1: 3 }]));
    const s = C.Arena.build(spec, 1, {});
    assert.equal(json(s.dept.rooms), json([{ id: 1, key: 'hall', role: 'centre', number: 0, x0: 1, y0: 1, x1: 5, y1: 3 }, { id: 2, key: 's1', role: 'section', number: 0, x0: 7, y0: 1, x1: 11, y1: 3 }]));
    assert.equal(json(s.dept.roomOf[1]), json([0, 1, 1, 1, 1, 1, 0, 2, 2, 2, 2, 2, 0]));
    assert.equal(json(s.dept.roomOf[0]), json(new Array(13).fill(0)));
    // The harness writes the same rooms from the same rectangles.
    const h = H.room(C, 1, { acc: 'T0', depth: 3, map: spec.map.map(r => r.replace(/[@P]/g, '.')), you: [1, 1], rooms: spec.rooms });
    assert.equal(json([h.dept.rooms, h.dept.roomOf]), json([s.dept.rooms, s.dept.roomOf]));
    assert.equal(json(H.ROOM_ROLES), json(C.Arena.ROOM_ROLES));
    // Rooms change no uid, and a stamp without them has none, as before.
    const plain = C.Arena.build(C.Arena.parse(ROOMED.replace(/^rooms:.*\n/m, '')), 1, {});
    assert.equal(json(plain.actors.map(a => a.uid)), json(s.actors.map(a => a.uid)));
    assert.equal(plain.dept.rooms, undefined);
    // A wanderer with nothing to look at wanders its own room once there are rooms (AI.wanderGoal).
    const p = s.actors.find(a => a.uid !== 'you');
    p.mode = 'awake';
    for (let i = 0; i < 20; i++) { const g = C.AI.wanderGoal(s, p); assert.equal(s.dept.roomOf[g[1]][g[0]], 2, json(g)); }
    for (const [line, why] of [['rooms: hall centre 0,1-5,3', /not inside the map's outer walls/], ['rooms: hall centre 1,1-5,4', /not inside the map's outer walls/],
      ['rooms: hall centre 1,1-5,3; hall section 7,1-11,3', /the room hall is given twice/], ['rooms: hall centre 1,1-7,3; s1 section 7,1-11,3', /the rooms hall and s1 overlap/],
      ['rooms: hall lobby 1,1-5,3', /a room's role is one of intro, section, study, centre, coda, staff/], ['rooms: hall centre 1,1-5', /a room is <key> <role> <x0>,<y0>-<x1>,<y1>/],
      ['rooms: Hall centre 1,1-5,3', /lower-case letters and digits/], ['rooms: hall centre 5,1-1,3', /runs backwards/]]) {
      assert.throws(() => C.Arena.parse(ROOMED.replace(/^rooms:.*$/m, line)), why, line);
    }
  });

  // A core with an M4 archetype whose code is not added yet, and a species of it in S.9's
  // pack, planted (every real one is added once its package lands): its id.
  function unadded(X) {
    X.Registry.ARCHETYPES.planted_arch = { built: 'M4', ready: false, clause: 'Planted.', params: {}, covers: [], tests: [], inv: null };
    X.Packs.get('S9').species.push({ id: 'S9.99', archetype: 'planted_arch', role: 'fodder' });
    return 'planted_arch';
  }

  test('an arena\'s species may be an M4 archetype once its package has added its code (Archetypes.added), and not before', () => {
    const X = loadCore(['tools/arena.js']), m4 = unadded(X);
    assert.ok(!X.Archetypes.added(m4));
    const spec = { species: [m4] };
    assert.throws(() => X.Arena.speciesList(spec), /is neither built in M3 nor added by its M4 package/);
    X.Archetypes.add(m4, {});
    const got = X.Arena.speciesList(spec).map(sp => sp.id);
    assert.ok(got.length > 0);
    assert.equal(json(got), json(X.Packs.list().flatMap(p => p.species).filter(sp => sp.archetype === m4).map(sp => sp.id)));
  });

  // ---- The harness ----

  test('the harness: rulesOff can switch off a modifier (M3\'s and clockwork), a module or a perk, and a module\'s scenario is rerun with it off; its species are those whose archetype is added', () => {
    const R = C.Registry;
    for (const id of R.order('MODIFIERS')) assert.equal(H.switchable(C, { id }), id, id);
    assert.ok(R.order('MODIFIERS').some(id => R.MODIFIERS[id].built === 'M4'), 'clockwork is an M4 modifier');
    assert.ok(R.order('MODULES').length >= 5);
    for (const id of R.order('MODULES')) { assert.equal(H.switchable(C, { id }), id, id); assert.equal(H.switchable(C, { id: 'MODULES.' + id }), id); assert.equal(H.switchable(C, { id: 'MODIFIERS.' + id }), null); }
    // Perks: every one the registry has (and a planted one, so the check bites before PERKS exists).
    const X = loadCore();
    if (!X.Registry.PERKS) X.Registry.PERKS = {};
    X.Registry.PERKS.planted_perk = { built: 'M4', ready: false };
    for (const id of Object.keys(X.Registry.PERKS)) assert.equal(H.switchable(X, { id }), id, id);
    assert.equal(H.switchable(X, { id: 'PERKS.planted_perk' }), 'planted_perk');
    for (const id of ['plodder', 'rooted', 'STATUSES.rooted', 'awake', 'wake', null]) assert.equal(H.switchable(C, { id }), null, id);
    // A module's scenario that its module decides passes with it on and fails with it off,
    // which the sweep counts; one that holds either way fails its sweep.
    const room = (p, sp, depth, o) => H.room(C, o.seed, { acc: 'T0', depth, map: ['#####', '#...#', '#####'], you: [1, 1] }, { rulesOff: o.rulesOff });
    const decided = H.scenario({ name: 'a planted alarm scenario', id: 'MODULES.alarm_network', build: room, actions: [{ a: 'wait' }],
      expect: r => r.state.options.rulesOff.includes('alarm_network') ? 'the alarm is off' : null });
    const before = H.reruns('alarm_network');
    assert.deepEqual(H.failures(H.sweep(C, decided, [{ sp: null, depth: 2 }, { sp: null, depth: 5 }])), []);
    assert.equal(H.reruns('alarm_network') - before, 2);
    const blind = H.scenario({ name: 'a planted scenario that shows nothing', id: 'MODULES.alarm_network', build: room, actions: [{ a: 'wait' }], expect: () => null });
    assert.match(H.failures(H.sweep(C, blind, [{ sp: null, depth: 2 }]))[0], /with alarm_network switched off it still passed, so it does not test alarm_network/);
    // Species: an M4 archetype's species are swept once its code is added, and not before.
    const Y = loadCore(), m4 = unadded(Y);
    assert.equal(H.species(Y, m4).length, 0);
    assert.equal(H.species(Y, m4, { m4: true }).length, 7);
    Y.Archetypes.add(m4, {});
    const ids = Y.Packs.list().flatMap(p => p.species).filter(sp => sp.archetype === m4).map(sp => sp.id);
    assert.equal(json(H.species(Y, m4).map(x => `${x.sp.id}@${x.depth}`)), json(ids.flatMap(id => H.DEPTHS.map(d => `${id}@${d}`))));
  });

  test('the harness\'s room: rooms as a department has them, and a Centrepiece\'s hall (dept.cp) with its openings, which Hall.cp and Centrepiece.pieces read; what it does not know is refused', () => {
    // (5, 5), a corner of the ring round the hall, is an archway too: no way in, since a
    // diagonal step may not cut past the walls beside it (Grid), so it is no opening.
    const map = ['###########', '#....,....#', '#....#....#', '#....+....#', '#....#....#', '#S###,#####'];
    const spec = { acc: 'T0', depth: 3, map, you: [7, 2], exhibits: [{ sp: 'M11.5', at: [2, 2], stats: C.Roles.stats('fodder', 3) }, { sp: 'M11.5', at: [3, 3], stats: C.Roles.stats('fodder', 3) }],
      rooms: [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 4, y1: 4 }, { key: 's1', role: 'section', x0: 6, y0: 1, x1: 9, y1: 4 }],
      cp: { uids: ['T0.3.room.1', 'T0.3.room.2'], room: 'centre' } };
    const s = H.room(C, 1, spec, {});
    assert.equal(s.dept.roomOf[2][2], 1); assert.equal(s.dept.roomOf[2][7], 2); assert.equal(s.dept.roomOf[1][5], 0);
    // The openings: every tile one can walk on in the ring round the hall, corners left out,
    // row-major: the archway, the door, and the staff door below; not the corner's archway.
    assert.equal(json(s.dept.cp), json({ uids: ['T0.3.room.1', 'T0.3.room.2'], room: 'centre', openings: [{ x: 5, y: 1, ch: ',' }, { x: 5, y: 3, ch: '+' }, { x: 1, y: 5, ch: 'S' }],
      form: 'fight', sealed: null, touched: false, sheet: null, treasure: null }));
    assert.equal(C.Hall.cp(s), s.dept.cp);
    assert.equal(json(C.Centrepiece.pieces(s).map(a => a.uid)), json(['T0.3.room.1', 'T0.3.room.2']));
    assert.equal(C.State.plainData(s), null);
    // Given fields are kept; the room plays as any other (a wait), and a clone is the same.
    const given = H.room(C, 1, Object.assign({}, spec, { cp: Object.assign({}, spec.cp, { form: 'treasure', openings: [{ x: 5, y: 1, ch: ',' }], touched: true }) }), {});
    assert.equal(json([given.dept.cp.form, given.dept.cp.openings.length, given.dept.cp.touched]), json(['treasure', 1, true]));
    const r = H.play(C, given, [{ a: 'wait' }, { a: 'wait' }], { clone: true });
    assert.deepEqual(r.violations, []);
    // Without rooms or a cp it is Setup.room's room exactly.
    const bare = Object.assign({}, spec); delete bare.rooms; delete bare.cp;
    assert.equal(C.State.hash(H.room(C, 1, bare, {})), C.State.hash(C.Setup.room(1, bare, {})));
    for (const [change, why] of [[{ rooms: [{ key: 'a', role: 'section', x0: 0, y0: 1, x1: 3, y1: 3 }] }, /not inside the map's outer walls/],
      [{ rooms: [{ key: 'a', role: 'section', x0: 1, y0: 1, x1: 3, y1: 3 }, { key: 'b', role: 'section', x0: 3, y0: 1, x1: 4, y1: 3 }] }, /the rooms a and b overlap/],
      [{ rooms: [{ key: 'a', role: 'hall', x0: 1, y0: 1, x1: 3, y1: 3 }] }, /role is one of/], [{ rooms: [{ key: 'a', role: 'section', x0: 1, y0: 1, x1: 3, y1: 3, n: 1 }] }, /unknown field n/],
      [{ cp: { uids: ['T0.3.room.1'], room: 'hall' } }, /hall "hall" is not among the rooms/], [{ cp: { uids: ['T0.3.room.9'], room: 'centre' } }, /no exhibit of the room/],
      [{ cp: { uids: ['T0.3.room.1'], room: 'centre', form: 'duel' } }, /fight or treasure/], [{ cp: { uids: ['T0.3.room.1'], room: 'centre', lamp: 1 } }, /unknown field lamp/],
      [{ rooms: undefined }, /a cp needs rooms/]]) {
      const bad = Object.assign({}, spec, change);
      if (Object.prototype.hasOwnProperty.call(change, 'rooms') && change.rooms === undefined) delete bad.rooms;
      assert.throws(() => H.room(C, 1, bad, {}), why, json(change));
    }
  });

  // ---- The patrol's starting story and M4's doers ----

  // A room with one exhibit set out awake as a patrol would be: a patrol_guard on a round
  // (route.posts), told cause k at its creation; or one with no round.
  function patrolRoom(X, k, round) {
    const s = H.room(X, 1, { acc: 'T0', depth: 3, map: ['##########', '#........#', '##########'], you: [1, 1],
      exhibits: [{ sp: 'S9.2', at: [6, 1], stats: X.Roles.stats('warden', 3), mode: 'awake' }] }, {});
    const a = s.actors[1];
    if (round) a.route = { posts: [[6, 1], [8, 1]], i: 0 };
    X.Wake.created(s, a, k, {}, null);
    return s;
  }

  test('the patrol\'s starting story (WO9): a patrol on its round starts told "it walks its round" (patrol), and the battery and waking.awake_story hold it to that, as they hold every other story', () => {
    assert.equal(C.Packs.species('S9', 'S9.2').archetype, 'patrol_guard');
    const start = s => { const chk = Battery.checks(C, { invs: [] }); return chk.check(C.State.clone(s), { a: 'wait' }, C.Step.step(s, { a: 'wait' }), s).filter(v => v.id === 'start_story').map(v => v.text); };
    assert.deepEqual(start(patrolRoom(C, 'patrol', true)), []);
    assert.match(start(patrolRoom(C, 'awake', true))[0], /starts awake, but its story says it woke by awake, not 'patrol'/);
    assert.match(start(patrolRoom(C, 'patrol', false))[0], /its story says it woke by patrol, not 'awake'/);
    assert.deepEqual(start(patrolRoom(C, 'awake', false)), []);
    assert.ok(Battery.isPatrol({ arch: 'patrol_guard', route: { posts: [[1, 1]], i: 0 } }) && !Battery.isPatrol({ arch: 'patrol_guard', route: { dir: 2 } }) && !Battery.isPatrol({ arch: 'plodder', route: { posts: [[1, 1]], i: 0 } }));
    // The invariant, after every step: patrol only for a patrol, and a patrol never "never sleeps".
    const inv = s => H.play(C, s, [{ a: 'wait' }], { inv: ['waking.awake_story'] }).violations.map(v => v.text);
    assert.deepEqual(inv(patrolRoom(C, 'patrol', true)), []);
    assert.match(inv(patrolRoom(C, 'awake', true))[0], /a patrol on its round, its story says it never sleeps \(cause awake\)/);
    assert.match(inv(patrolRoom(C, 'patrol', false))[0], /its story says it walks its round \(cause patrol\), but it is no patrol_guard with a round/);
    assert.deepEqual(inv(patrolRoom(C, 'awake', false)), []);
    // A log-only reader takes the story from the starting state, as for any exhibit set out awake.
    const s = patrolRoom(C, 'patrol', true), a = s.actors[1];
    const f = Battery.Recap.fromLog(s, [{ k: 'died', who: 'you', turn: 3, cause: { k: 'attack', by: a.uid } }]);
    assert.equal(json([f.killer, f.wakeTrigger, f.wakeTurn]), json([a.uid, 'patrol', 0]));
  });

  test('the doers of M4\'s event kinds, for the battery\'s completeness: a Wader\'s alarm, your view, a Centrepiece\'s phase and the exhibit a module event is about; certificates, grades and perks are no exhibit\'s', () => {
    const u = 'S9.3.s1.1';
    assert.equal(Battery.causer({ k: 'alarm', by: u, until: 9, turn: 1, cause: { k: 'alarm_network' } }), u);
    assert.equal(Battery.causer({ k: 'viewed', who: 'you', of: u, n: 1, turn: 1, cause: { k: 'view' } }), 'you');
    assert.equal(Battery.causer({ k: 'phase', who: u, phase: 2, turn: 1, cause: { k: 'damaged' } }), u);
    assert.equal(Battery.causer({ k: 'module', id: 'copies_weaken', rule: 'weaken', who: u, turn: 1, cause: { k: 'copies_weaken' } }), u);
    assert.equal(Battery.causer({ k: 'module', id: 'weather_cases', rule: 'release', turn: 1, cause: { k: 'weather_cases', by: 'you' } }), 'you');
    for (const k of ['certificate', 'grade', 'perk']) assert.equal(Battery.causer({ k, turn: 1, cause: { k: 'view' } }), null, k);
    // Each M3 kind a DOER names is an event kind the registry has, with that field; M4's are
    // A5's kinds with the fields A5 gives them (each fragment's owner writes their schemas).
    const A5 = { alarm: ['by', 'until'], viewed: ['who', 'of', 'n'], phase: ['who', 'phase', 'stage', 'gained'], module: ['id', 'rule', 'who', 'at', 'n', 'turns'] };
    for (const [k, f] of Object.entries(Battery.DOER)) {
      const E = C.Registry.EVENTS[k];
      if (Object.prototype.hasOwnProperty.call(A5, k)) { assert.ok(A5[k].includes(f), `${k} has no field ${f} in A5`); continue; }
      assert.ok(E && E.built === 'M3', `${k} is no M3 event kind`);
      assert.ok(Object.prototype.hasOwnProperty.call(E.fields, f), `${k} has no field ${f}`);
    }
    for (const k of Object.keys(A5)) assert.ok(Object.prototype.hasOwnProperty.call(Battery.DOER, k), `${k} has a doer`);
  });

  // ---- The golden tools ----

  const mk = (seed, actions) => ({ kind: 'monkey', seed, actions, make: null });

  test('golden --pending "reason" <name…> marks only the runs it names: the others stay held to their pins; a name not in the file, a name twice or none is refused, writing nothing', () => {
    const file = path.join(tmp, 'pending.js');
    Golden.write(file, { a: mk(3, 60), b: mk(4, 60), c: mk(5, 60) });
    Golden.repin(C, file);
    const lines = Golden.markPending(file, 'a stretch that moves b', ['b']);
    assert.deepEqual(lines, ['golden: b pending (pin ' + Golden.read(file).b.hash + ' kept): a stretch that moves b', 'golden: still held to their pins: a, c']);
    let g = Golden.read(file);
    assert.deepEqual([g.a.pending, g.b.pending, g.c.pending], [undefined, 'a stretch that moves b', undefined]);
    // A pinned run that moves fails; the pending one does not.
    g.b.actions = 61; Golden.write(file, g);
    assert.equal(Golden.check(C, file).bad, 0);
    g.a.actions = 61; Golden.write(file, g);
    const c = Golden.check(C, file);
    assert.equal(c.bad, 1); assert.ok(c.lines.some(l => l.startsWith('golden: a differs from')), c.lines.join('\n'));
    g.a.actions = 60; Golden.write(file, g);
    // From the command line, and its refusals.
    const kept = fs.readFileSync(file, 'utf8');
    const ok = tool('--golden', file, '--pending', 'two more', 'a', 'c');
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.ok(ok.stdout.endsWith('golden: every run is now pending\n'), ok.stdout);
    g = Golden.read(file);
    assert.deepEqual([g.a.pending, g.b.pending, g.c.pending], ['two more', 'a stretch that moves b', 'two more']);
    fs.writeFileSync(file, kept);
    for (const args of [['--pending', 'why', 'zz'], ['--pending', 'why'], ['--pending', 'why', 'a', 'a'], ['--pending', '  ', 'a']]) {
      const r = tool('--golden', file, ...args);
      assert.equal(r.status, 2, `${args.join(' ')}: ${r.stdout}${r.stderr}`);
      assert.match(r.stdout, refusedText);
      assert.equal(fs.readFileSync(file, 'utf8'), kept, `${args.join(' ')} wrote the file`);
    }
    assert.throws(() => Golden.markPending(file, 'why', []), /needs the names of the runs/);
  });

  // A release build of this tree's core, as tools/build-single.py --release writes one, made
  // here (dist/ is not in every copy of the tree, and git's history not in the revert test's):
  // each script of index.html inlined in order (a stand-in for the rest), stamped with the
  // coreHash of the core it holds (tools/core-hash.js's rule). edit(file, text) may change a
  // core file first. Returns {file, rel (from dir), index, coreHash}; the build is under
  // dir/dist/builds/.
  function plantBuild(dir, edit) {
    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), texts = {};
    const blocks = Golden.indexScripts(index).map(f => {
      const core = !!f && (f.startsWith('js/core/') || f.startsWith('content/'));
      const text = core ? (edit ? edit(f, fs.readFileSync(path.join(root, f), 'utf8')) : fs.readFileSync(path.join(root, f), 'utf8')) : '// not the core';
      if (core) texts[f] = text;
      return `<script>\n${text.replace(/<\/script/g, '<\\/script')}\n</script>`;
    });
    const files = Object.keys(texts).filter(f => f !== Hashes.VIEW_MODEL).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const coreHash = Hashes.fnv1a(files.map(f => f + '\n' + texts[f] + '\n').join('')).toString(16).padStart(8, '0');
    const html = `<!DOCTYPE html>\n<html>\n<head>\n<meta name="accession-core-hash" content="${coreHash}">\n</head>\n<body>\n${blocks.join('\n')}\n</body>\n</html>\n`;
    const out = path.join(dir, 'dist', 'builds', coreHash + '.html');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    return { file: out, rel: path.relative(dir, out).split(path.sep).join('/'), index, coreHash };
  }
  // A checkout of its own: the tools a build's core is played with, and index.html.
  function checkout(dir) {
    fs.mkdirSync(path.join(dir, 'tools'), { recursive: true });
    for (const f of ['core-context.js', 'monkey.js', 'replay.js']) fs.copyFileSync(path.join(root, 'tools', f), path.join(dir, 'tools', f));
    fs.copyFileSync(path.join(root, 'index.html'), path.join(dir, 'index.html'));
    return dir;
  }
  const waits = n => Array.from({ length: n }, () => ({ a: 'wait' }));
  const visit = () => ({ kind: 'replay', start: { seed: 116, dept: 'M11', depth: 3, carry: 'start' }, options: { rulesOff: [], without: [], invulnerable: false }, actions: waits(30) });
  // A wait that also marks the department (added to the core's last file, once every action is
  // defined): a core that plays the visit otherwise.
  const LAST = Golden.indexScripts(fs.readFileSync(path.join(root, 'index.html'), 'utf8')).filter(f => f && (f.startsWith('js/core/') || f.startsWith('content/'))).pop();
  const markWaits = (f, text) => f === LAST ? text + "\n;(() => { const h = Actions.get('wait'), f = h.apply; h.apply = (state, action, ev) => { state.dept.planted = state.turn; return f(state, action, ev); }; })();\n" : text;

  test('golden --retire moves a run to test/golden/retired.js with the release build it plays in (named by the index.html git has where it was added), pinned in that build\'s own core; a retired run plays against its build', () => {
    const repo = checkout(path.join(tmp, 'retire-repo')), b = plantBuild(repo);
    const git = (...args) => cp.execFileSync('git', ['-C', repo, '-c', 'user.name=test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false'].concat(args), { encoding: 'utf8' }).trim();
    git('init', '-q'); git('add', '-A'); git('commit', '-q', '-m', 'the release build');
    assert.equal(Golden.indexAtBuild(repo, b.rel), b.index);
    const file = path.join(repo, 'golden.js'), rfile = path.join(repo, 'retired.js');
    Golden.write(file, { rp: visit(), stays: mk(2, 50) });
    Golden.repin(C, file);
    const pinned = Golden.read(file);
    const kept = [fs.readFileSync(file, 'utf8'), fs.existsSync(rfile)];
    // Refused, writing nothing: a run not in the file; no build; a build that is not there.
    for (const [args, why] of [[['zz', b.rel], /there is no run zz/], [['rp', ''], /needs the release build/], [['rp', 'dist/builds/00000000.html'], /there is no build dist\/builds\/00000000\.html/]]) {
      assert.throws(() => Golden.retire(file, rfile, args[0], args[1], { root: repo }), why);
      assert.deepEqual([fs.readFileSync(file, 'utf8'), fs.existsSync(rfile)], kept);
    }
    const line = Golden.retire(file, rfile, 'rp', b.rel, { root: repo });
    assert.equal(line, `golden: rp retired to retired.js: it plays in ${b.rel} (coreHash ${b.coreHash}) to hash ${pinned.rp.hash}, its pin`);
    assert.deepEqual(Object.keys(Golden.read(file)), ['stays']);
    const r = Golden.readRetired(rfile);
    assert.deepEqual(Object.keys(r), ['rp']);
    assert.deepEqual([r.rp.hash, r.rp.steps, json(r.rp.start), r.rp.build.file, r.rp.build.coreHash], [pinned.rp.hash, pinned.rp.steps, json(visit().start), b.rel, b.coreHash]);
    const names = Golden.indexScripts(b.index).map(f => f && (f.startsWith('js/core/') || f.startsWith('content/')) ? f : null);
    assert.deepEqual(r.rp.build.blocks, names.slice(0, r.rp.build.blocks.length));
    assert.ok(names.slice(r.rp.build.blocks.length).every(f => f === null));
    assert.equal(fs.readFileSync(rfile, 'utf8'), Golden.formatRetired(r));
    assert.throws(() => Golden.retire(file, rfile, 'rp', b.rel, { root: repo }), /there is no run rp/);
    const left = Golden.read(file);
    Golden.write(file, Object.assign({}, left, { rp: visit() }));
    assert.throws(() => Golden.retire(file, rfile, 'rp', b.rel, { root: repo }), /rp is already retired/);
    Golden.write(file, left);
    // The retired run plays against its build, and is held to its pin there.
    assert.deepEqual(Golden.checkRetired(rfile, { root: repo }), { bad: 0, lines: [`golden: the retired rp plays in ${b.rel} to its pin ${pinned.rp.hash}`] });
    const g = Golden.readRetired(rfile); g.rp.hash += 1; Golden.writeRetired(rfile, g);
    const bad = Golden.checkRetired(rfile, { root: repo });
    assert.equal(bad.bad, 1); assert.match(bad.lines[0], /^golden: the retired rp differs in its build/);
    const all = Golden.check(C, file, { retired: rfile, root: repo });
    assert.equal(all.bad, 1); assert.ok(all.lines.some(l => l.startsWith('golden: the retired rp differs')));
  });

  test('a retired run is played in its build\'s own core, never this tree\'s: a build whose rules differ pins it otherwise, and a build whose core does not hash to its stamp, or that is gone, fails', () => {
    const dir = checkout(path.join(tmp, 'moved-repo')), b = plantBuild(dir, markWaits);
    assert.notEqual(b.coreHash, Hashes.coreHash());
    const file = path.join(dir, 'golden.js'), rfile = path.join(dir, 'retired.js');
    Golden.write(file, { rp: visit() });
    Golden.repin(C, file);
    const here = Golden.read(file).rp.hash, line = Golden.retire(file, rfile, 'rp', b.rel, { root: dir, index: b.index });
    const there = Golden.readRetired(rfile).rp.hash;
    assert.notEqual(there, here);
    assert.equal(line, `golden: rp retired to retired.js: it plays in ${b.rel} (coreHash ${b.coreHash}) to hash ${there}; its pin in golden.js was ${here}, on another core`);
    assert.equal(Golden.checkRetired(rfile, { root: dir }).bad, 0);
    // The core, from the build alone: the planted rule is there.
    const K = Golden.buildCore(dir, Golden.readRetired(rfile).rp.build), s = K.Replay.play(Golden.readRetired(rfile).rp).state;
    assert.equal(s.dept.planted, s.turn - 1);
    // A build edited after it was stamped, or an index.html that lists other scripts, names no core.
    const html = fs.readFileSync(b.file, 'utf8');
    assert.throws(() => Golden.nameBuild(html.replace("state.dept.planted = state.turn", "state.dept.planted = 0"), b.index, 'x'), /hashes to [0-9a-f]{8}, not to the coreHash/);
    assert.throws(() => Golden.nameBuild(html, b.index.replace(/<script src="js\/main\.js"><\/script>/, ''), 'x'), /scripts, and the index.html it was built from lists/);
    assert.throws(() => Golden.nameBuild(html.replace(/<meta name="accession-core-hash"[^>]*>/, ''), b.index, 'x'), /carries no coreHash/);
    fs.writeFileSync(b.file, html.replace("state.dept.planted = state.turn", "state.dept.planted = 0"));
    assert.match(Golden.checkRetired(rfile, { root: dir }).lines[0], /cannot be played in its build: golden: the scripts of .+ named as its core hash to/);
    fs.rmSync(b.file);
    assert.match(Golden.checkRetired(rfile, { root: dir }).lines[0], /cannot be played in its build: golden: the build .+ is not there/);
    // The command line asks for the build.
    for (const args of [['--retire', 'rp'], ['--build', b.rel], ['--retire', 'rp', '--build', b.rel, 'extra'], ['--retire', 'rp', '--check']]) {
      const r = tool('--golden', file, '--retired', rfile, '--root', dir, ...args);
      assert.equal(r.status, 2, `${args.join(' ')}: ${r.stdout}${r.stderr}`);
      assert.match(r.stdout, refusedText);
    }
  });

  // A recipe, written to dir/<name>.js: a visit with a use at its first chance, then waits; its
  // story asks for the use. extra is more of the module's text.
  function writeRecipe(dir, name, body) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name + '.js'), `'use strict';\n${body}\n`);
  }
  const USES = `module.exports = {
  about: 'M.11 at depth 3 as a run starts: a Restoration kit used at its first chance, waits, then the wander policy',
  start: { seed: 116, dept: 'M11', depth: 3, carry: 'start' },
  cap: 60,
  next(C, state, ctx) {
    if (ctx.i >= 40) return null;
    const use = !ctx.memory.used && C.Step.legal(state).find(a => a.a === 'use');
    if (use) { ctx.memory.used = true; return use; }
    return ctx.i < 10 ? { a: 'wait' } : ctx.policy('wander');
  },
  story(C, run) { return run.events.some(e => e.k === 'used' && e.who === 'you') ? null : 'you never use an item'; },
};`;

  test('golden --record makes a replay from its recipe: a recorded replay equals its recipe\'s, twice over, and its story is checked; a pending run with a broken story fails', () => {
    const dir = path.join(tmp, 'recipes'), file = path.join(tmp, 'recorded.js');
    writeRecipe(dir, 'uses', USES);
    Golden.write(file, { m0: mk(3, 40) });
    Golden.repin(C, file);
    const line = Golden.recordInto(file, dir, 'uses', null, { C: Sim.context() });
    let g = Golden.read(file);
    assert.equal(line, `golden: uses recorded from its recipe: ${g.uses.actions.length} actions, hash ${g.uses.hash}, a new run; pinned; its story holds`);
    // The file's replay is the recipe's, as the recipe makes it on this tree, and pinned on it.
    const again = Golden.recordOnce(Sim.context(), Golden.loadRecipe(dir, 'uses'), 'uses');
    assert.deepEqual(Golden.definition('uses', g.uses), again.def);
    assert.ok(g.uses.actions.length > 10 && g.uses.actions.length <= 40);
    assert.ok(g.uses.actions.some(a => a.a === 'use'));
    assert.equal(g.uses.hash, C.Replay.play(again.def).hash);
    assert.deepEqual(g.uses.start, { seed: 116, dept: 'M11', depth: 3, carry: 'start' });
    assert.equal(Golden.check(C, file, { recipes: dir }).bad, 0);
    // Pending: --record keeps a run's reason, or takes a new one; it stays checked by its story.
    Golden.markPending(file, 'rules moving', ['uses']);
    assert.match(Golden.recordInto(file, dir, 'uses', null, { C: Sim.context() }), /, as it was; pending: rules moving; its story holds$/);
    assert.match(Golden.recordInto(file, dir, 'uses', 'another stretch', { C: Sim.context() }), /pending: another stretch/);
    g = Golden.read(file);
    assert.equal(g.uses.pending, 'another stretch');
    // A pending run whose story no longer holds fails, in --check and as the golden test asks it.
    const broken = Object.assign({}, g.uses, { actions: g.uses.actions.filter(a => a.a !== 'use') });
    Golden.write(file, Object.assign({}, g, { uses: broken }));
    const c = Golden.check(C, file, { recipes: dir });
    assert.equal(c.bad, 1);
    assert.ok(c.lines.includes("golden: uses's story does not hold (it is pending, and its story is still held): you never use an item"), c.lines.join('\n'));
    assert.equal(Golden.story(C, 'uses', broken, Golden.loadRecipe(dir, 'uses')), 'you never use an item');
    // A recipe whose run is not recorded fails --check, as the golden test fails it.
    writeRecipe(dir, 'unrecorded', USES);
    assert.ok(Golden.check(C, file, { recipes: dir }).lines.some(l => l.startsWith('golden: the recipe unrecorded has no run')));
    fs.rmSync(path.join(dir, 'unrecorded.js'));
    // From the command line.
    Golden.write(file, g);
    const r = tool('--golden', file, '--recipes', dir, '--record', 'uses');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /^golden: uses recorded from its recipe: \d+ actions, hash \d+, as it was; pending: another stretch; its story holds\n$/);
    const chk = tool('--golden', file, '--recipes', dir, '--retired', path.join(tmp, 'none.js'), '--check');
    assert.equal(chk.status, 0, chk.stdout + chk.stderr);
    assert.ok(chk.stdout.includes("golden: uses's story holds (pending)"), chk.stdout);
  });

  test('golden --record refuses a recipe whose story fails, one that decides otherwise when recorded again, one with no story or past its cap, and a recipe that is not there, writing nothing', () => {
    const dir = path.join(tmp, 'bad-recipes'), file = path.join(tmp, 'bad-recorded.js');
    Golden.write(file, { m0: mk(3, 40) });
    const kept = fs.readFileSync(file, 'utf8'), S = Sim.context();
    writeRecipe(dir, 'nouse', USES.replace("const use = !ctx.memory.used && C.Step.legal(state).find(a => a.a === 'use');", 'const use = null;'));
    assert.throws(() => Golden.recordInto(file, dir, 'nouse', null, { C: S }), /nouse's recipe records \d+ actions, but its story does not hold: you never use an item; nothing was written/);
    writeRecipe(dir, 'fickle', 'let n = 0;\n' + USES.replace("if (ctx.i >= 40) return null;", 'if (ctx.i >= 40) return null;\n    if (ctx.i === 5) { n++; if (n > 1) return { a: \'move\', dir: 2 }; }'));
    assert.throws(() => Golden.recordInto(file, dir, 'fickle', null, { C: S }), /the recipe fickle recorded two different replays \(first at action 6\)/);
    writeRecipe(dir, 'tellsnothing', USES.replace(/story\(C, run\)[^\n]*\n/, ''));
    assert.throws(() => Golden.recordInto(file, dir, 'tellsnothing', null, { C: S }), /the recipe tellsnothing: it has no story/);
    writeRecipe(dir, 'endless', USES.replace('if (ctx.i >= 40) return null;', '').replace('cap: 60', 'cap: 15'));
    assert.throws(() => Golden.recordInto(file, dir, 'endless', null, { C: S }), /the recipe endless still had an action after its cap of 15/);
    assert.throws(() => Golden.recordInto(file, dir, 'absent', null, { C: S }), /there is no recipe absent/);
    assert.equal(fs.readFileSync(file, 'utf8'), kept);
    const r = tool('--golden', file, '--recipes', dir, '--record', 'nouse');
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.equal(fs.readFileSync(file, 'utf8'), kept);
    for (const args of [['--record'], ['--record', 'nouse', 'extra'], ['--record', 'nouse', '--check'], ['--record', 'nouse', '--add', 'x', 'y']]) {
      const q = tool('--golden', file, '--recipes', dir, ...args);
      assert.equal(q.status, 2, `${args.join(' ')}: ${q.stdout}${q.stderr}`);
      assert.match(q.stdout, refusedText);
    }
  });
};
