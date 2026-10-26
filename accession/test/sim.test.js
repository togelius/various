// The sim (tools/sim.js; BUILD.md §10.2, §10.3): runs with a reason for every decision and
// a replay that replays, paired runs on shared seeds, the counterfactual switches, the
// statistics of a comparison in words, and the command line end to end.
module.exports = ({ test, assert, root, path, fs }) => {
  const Sim = require(path.join(root, 'tools/sim.js'));
  const C = Sim.load();
  const { spawnSync } = require('node:child_process');
  const J = v => JSON.parse(JSON.stringify(v)), eq = (a, b, m) => assert.deepEqual(J(a), J(b), m);
  const clean = s => assert.doesNotMatch(String(s), /undefined|NaN|\[object|\bnull\b/, `not a clean sentence: ${s}`);
  const DUMMY = C.Arena.parse(C.Arena.DUMMY);
  const dummy = (s, o) => C.Arena.build(DUMMY, s, { options: o }), judged = (s, ev) => C.Arena.outcome(DUMMY, s, ev);
  const cli = args => spawnSync(process.execPath, [path.join(root, 'tools/sim.js'), ...args], { encoding: 'utf8', cwd: root });
  const policy = (decide, extra) => Object.assign({ card: { summary: 'A planted policy.', rules: ['As planted.'] }, decide }, extra || {});

  test('a run plays a policy to its outcome, with a reason for every decision', () => {
    const r = Sim.run({ make: dummy, outcome: judged, policy: 'fighter', seed: 1 });
    assert.equal(r.policy, 'basic.fighter'); assert.equal(r.seed, 1);
    assert.equal(r.stopped, 'won'); assert.equal(r.outcome.won, true); assert.equal(r.outcome.done, true);
    assert.equal(r.reasons.length, r.steps); assert.equal(r.replay.actions.length, r.steps);
    r.reasons.forEach(line => { assert.match(line, /^turn \d+: \S/); clean(line); });
    eq(r.violations, []); assert.equal(r.error, null);
    assert.equal(r.turns, r.outcome.turns); assert.equal(r.hpLost, r.outcome.hpLost); assert.equal(r.deaths, r.outcome.deaths);
    eq(r.replay.options, { rulesOff: [], without: [], invulnerable: false });
    assert.equal('events' in r, false, 'events only when asked for');
    const logged = Sim.run({ make: dummy, outcome: judged, policy: 'fighter', seed: 1, log: true });
    // Without an arena's outcome a run goes on until the visit is over or the cap, as a
    // department's does.
    assert.equal(Sim.run({ make: dummy, policy: 'fighter', seed: 1, cap: 30 }).stopped, 'cap');
    // runArena builds and judges from the stamp, with the seed's depth and species.
    const ra = Sim.runArena('dummy', 'fighter', 1);
    eq([ra.stopped, ra.reasons, ra.depth, ra.sp, ra.replay.start.arena], ['won', r.reasons, 2, C.Arena.speciesFor(DUMMY, 1).id, 'dummy']);
    assert.ok(logged.events.length > r.steps && logged.events.every(e => typeof e.k === 'string'));
  });

  test('a policy sees the noise rings a player sees: those of its last action that took time, kept across a refused step that took none', () => {
    // You at (1, 1), a sleeping fodder beside you: strike it (a soft noise), step into the
    // wall to the north (refused, no time), then wait.
    const spec = C.Arena.parse('arena: rings\ngoal: kill\ndepths: 2\nlegend: F exhibit role=fodder\n\n#######\n#@F...#\n#.....#\n#######\n');
    const seen = [], plan = [{ a: 'attack', uid: 'T0.2.room.1' }, { a: 'move', dir: 0 }, { a: 'wait' }, { a: 'wait' }];
    const rings = vm => JSON.stringify(vm.marks.filter(m => m.kind === 'noise'));
    const p = policy(obs => { seen.push({ rings: rings(obs.vm), log: obs.log.join(' '), vm: obs.vm }); return { action: plan[seen.length - 1], reason: 'as planned' }; });
    Sim.run({ make: (seed, o) => C.Arena.build(spec, seed, { options: o }), policy: p, name: 'test.rings', seed: 1, maxSteps: plan.length });
    assert.equal(seen.length, plan.length);
    assert.equal(seen[0].rings, '[]', 'nothing heard yet');
    assert.notEqual(seen[1].rings, '[]', 'the blow\'s noise is drawn');
    assert.equal(seen[2].log, 'Something is in the way.', 'the log tells the refusal');
    assert.equal(seen[2].rings, seen[1].rings, 'a refused step that took no time leaves the rings as they were');
    assert.notEqual(seen[3].rings, seen[1].rings, 'a wait, which takes time, replaces them');
  });

  test('a replay replays: its actions on a fresh state end on the same hash', () => {
    for (const seed of [1, 2, 3]) {
      const r = Sim.run({ make: dummy, policy: 'random', seed, cap: 60 });
      const s = dummy(seed, r.replay.options);
      assert.equal(C.State.hash(s), r.startHash);
      for (const a of r.replay.actions) C.Step.step(s, a);
      assert.equal(C.State.hash(s), r.endHash, `seed ${seed}`);
    }
  });

  test('the cap, the step limit, refusals, a failing policy and a missing reason each stop or mark a run', () => {
    const waits = policy(() => ({ action: { a: 'wait' }, reason: 'waits' }));
    const capped = Sim.run({ make: dummy, policy: waits, name: 'test.waits', seed: 1, cap: 7 });
    assert.deepEqual([capped.stopped, capped.turns, capped.steps], ['cap', 7, 7]);
    // A 0-tick refusal costs no time: the step limit (cap × 10) or the stuck rule stops it.
    const refused = Sim.run({ make: dummy, policy: policy(() => ({ action: { a: 'fly' }, reason: 'tries to fly' })), name: 'test.fly', seed: 1, cap: 3 });
    assert.equal(refused.stopped, 'steps'); assert.equal(refused.steps, 30); assert.equal(refused.refusals, 30);
    assert.match(refused.violations[0].text, /test\.fly chose fly at turn 0, which is not legal then/);
    const stuck = Sim.run({ make: dummy, policy: policy(() => ({ action: { a: 'fly' }, reason: 'tries to fly' })), name: 'test.fly', seed: 1 });
    assert.deepEqual([stuck.stopped, stuck.steps], ['stuck', 50]);
    const throws = Sim.run({ make: dummy, policy: policy(() => { throw new Error('lost its map'); }), name: 'test.lost', seed: 1 });
    assert.equal(throws.stopped, 'error'); assert.match(throws.error, /test\.lost failed to decide at turn 0: lost its map/);
    const mute = Sim.run({ make: dummy, policy: policy(() => ({ action: { a: 'wait' }, reason: '' })), name: 'test.mute', seed: 1 });
    assert.equal(mute.stopped, 'error'); assert.match(mute.error, /gave no reason in words for wait/);
    const vague = Sim.run({ make: dummy, policy: policy(() => ({ action: { a: 'wait' }, reason: 'waits for undefined' })), name: 'test.vague', seed: 1 });
    assert.equal(vague.stopped, 'error');
    const none = Sim.run({ make: dummy, policy: policy(() => ({ reason: 'nothing' })), name: 'test.none', seed: 1 });
    assert.match(none.error, /decided no action/);
    assert.throws(() => Sim.run({ make: dummy, policy: 'nobody', seed: 1 }), /no policy nobody/);
    assert.throws(() => Sim.run({ policy: 'idle', seed: 1 }), /needs make/);
  });

  test('check runs a checker after every step, and its violations are listed with their step, counted from 1', () => {
    let calls = 0;
    const r = Sim.run({ make: dummy, outcome: judged, policy: 'fighter', seed: 1, check: (pre, action, events, post) => {
      calls++;
      assert.ok(pre.tick <= post.tick && Array.isArray(events));
      return post.turn === 3 ? [{ inv: 'planted', text: 'turn 3 is planted', step: 99 }] : [];
    } });
    assert.equal(calls, r.steps);
    assert.equal(r.violations.length, 1); assert.equal(r.violations[0].inv, 'planted');
    assert.equal(r.violations[0].step, 3, 'the third step, whatever the checker says');
    eq(r.replay.actions[2], r.replay.actions[r.violations[0].step - 1]);
    // check: true loads every *.inv.js of test/behaviour/ (here a planted folder) through
    // tools/invariants.js, and runs each after every step.
    const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'accession-inv-'));
    fs.writeFileSync(path.join(dir, 'planted.inv.js'), [
      "module.exports = (C) => [",
      "  { id: 'still_far', check: (pre, events, post) => post.actors[0].x >= 4 ? 'you came within reach of the plodder' : null },",
      "  { id: 'never_hunts', applies: a => a.uid !== 'you', check: (pre, events, post, ctx) => ctx.actor.mode === 'hunting' ? 'it hunts' : null },",
      '];',
    ].join('\n'));
    const all = Sim.run({ make: dummy, outcome: judged, policy: 'fighter', seed: 1, check: true, invDir: dir });
    const far = all.violations.filter(v => v.inv === 'still_far');
    assert.ok(far.length > 0, 'the planted invariant was run');
    const again = dummy(1, all.replay.options);
    const reached = all.replay.actions.findIndex(a => { C.Step.step(again, a); return again.actors[0].x >= 4; }) + 1;
    assert.ok(reached >= 1); assert.equal(far[0].step, reached, 'at the step that took you to x = 4');
    assert.ok(far.every(v => v.step >= 1 && v.step <= all.steps && /^still_far: you came within reach/.test(v.text)));
    assert.ok(all.violations.some(v => v.inv === 'never_hunts' && v.uid === C.Arena.layout(DUMMY, 1).exhibits[0].uid));
    // A list selects among them; the real folder's invariants all hold on the dummy arena.
    const one = Sim.run({ make: dummy, outcome: judged, policy: 'fighter', seed: 1, check: ['never_hunts'], invDir: dir });
    assert.ok(one.violations.length > 0 && one.violations.every(v => v.inv === 'never_hunts'));
    eq(Sim.run({ make: dummy, outcome: judged, policy: 'fighter', seed: 2, check: true }).violations, []);
    assert.throws(() => Sim.run({ make: dummy, policy: 'idle', seed: 1, check: 'some' }), /check is true/);
  });

  test("a run stops with an error when the state stops being plain data, or a policy changes it while deciding", () => {
    const C2 = Sim.load(), step = C2.Step.step;
    // A planted fault in the core: after the third step, a Map in the state.
    C2.Step.step = (state, action) => { const ev = step(state, action); if (state.turn === 3) state.ui.x = new Map(); return ev; };
    const make2 = (s, o) => C2.Arena.build(C2.Arena.parse(C2.Arena.DUMMY), s, { options: o });
    const r = Sim.run({ C: C2, make: make2, policy: 'idle', seed: 1, cap: 10 });
    eq([r.stopped, r.steps, r.endHash], ['error', 3, null]);
    eq(r.violations.map(v => [v.id, v.step]), [['plain_data', 3]]);
    assert.match(r.error, /^the state is not plain data at state\.ui\.x after step 3, wait$/);
    // A policy that reaches the state by some route of its own (here, one the test gives it)
    // and changes it while deciding: with a check on, the run stops and says so.
    let held = null;
    const grab = (s, o) => (held = dummy(s, o));
    const meddler = policy(() => { held.actors[1].hp = 1; return { action: { a: 'wait' }, reason: 'waits' }; });
    const m = Sim.run({ make: grab, policy: meddler, name: 'test.meddler', seed: 1, cap: 5, check: () => [] });
    eq([m.stopped, m.steps, m.error], ['error', 0, 'test.meddler changed the game state while deciding at turn 0']);
    eq(m.violations.map(v => [v.id, v.step]), [['policy', 1]]);
  });

  test('a policy that writes into what it sees changes nothing, and in a policy file it is stopped', () => {
    // In code that is not strict, the write is lost: the view model is a frozen copy.
    const vandal = policy(obs => { const t = obs.vm.tiles; t[2] = t[2].slice(0, 6) + '#' + t[2].slice(7); obs.vm.over = { k: 'won' }; return { action: { a: 'wait' }, reason: 'waits' }; });
    const r = Sim.run({ make: dummy, policy: vandal, name: 'test.vandal', seed: 1, cap: 5, check: () => [] });
    eq([r.stopped, r.violations, r.error], ['cap', [], null]);
    const s = dummy(1, r.replay.options);
    for (const a of r.replay.actions) C.Step.step(s, a);
    assert.equal(C.State.hash(s), r.endHash, 'its replay replays');
    assert.equal(s.dept.tiles[2], C.Arena.parse(C.Arena.DUMMY).map[2].replace('@', '.').replace('P', '.'));
    // Policy files are strict, so there the write fails at once, naming the policy.
    const f = path.join(fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'accession-vandal-')), 'vandal.js');
    fs.writeFileSync(f, "'use strict';\nPolicies.add('vandal', { walls: { card: { summary: 'Draws walls on the map it sees.', rules: ['Draw a wall.'] }, " +
      "decide(obs) { obs.vm.tiles[2] = '#'; return { action: { a: 'wait' }, reason: 'waits' }; } } });\n");
    const C2 = Sim.load([f]);
    const v = Sim.run({ C: C2, make: (sd, o) => C2.Arena.build(C2.Arena.parse(C2.Arena.DUMMY), sd, { options: o }), policy: 'vandal.walls', seed: 1, cap: 5 });
    eq([v.stopped, v.steps], ['error', 0]);
    assert.match(v.error, /^vandal\.walls failed to decide at turn 0: .*read.only/);
  });

  test('paired runs share seeds: both arms build the same room, with the same streams, from each seed', () => {
    const p = Sim.paired('dummy', 'idle', 'fighter', [1, 2, 3, 4]);
    eq(p.seeds, [1, 2, 3, 4]); assert.equal(p.arena, 'dummy');
    for (let i = 0; i < 4; i++) {
      const a = p.a.runs[i], b = p.b.runs[i];
      eq([a.seed, a.depth, a.sp, a.variant], [b.seed, b.depth, b.sp, b.variant]);
      assert.equal(a.startHash, b.startHash, `seed ${a.seed}: the same starting state`);
      assert.equal(a.depth, a.seed % 2 ? 2 : 5);
    }
    assert.equal(p.a.name, 'basic.idle'); assert.equal(p.b.name, 'basic.fighter');
    assert.ok(p.a.card.startsWith('basic.idle: '));
    // The verdict is the stamp's metric, in words.
    assert.equal(p.verdict.metric, 'hpLost <= 90%'); clean(p.verdict.sentence);
    for (const k of ['hpLost', 'woken', 'turns']) assert.equal(p.stats[k].n, 4);
    // Two option sets as arms: the same policy with a rule switched off differs only there.
    const q = Sim.paired('dummy', 'fighter', 'fighter@rules-off=marble+plaster,invulnerable', [1]);
    eq(q.b.runs[0].replay.options, { rulesOff: ['marble', 'plaster'], without: [], invulnerable: true });
    eq(q.a.runs[0].replay.options, { rulesOff: [], without: [], invulnerable: false });
    assert.throws(() => Sim.paired('dummy', 'fighter', 'fighter@colour=red', [1]), /an arm's switch is/);
  });

  test("--without X leaves an independent Y's combat/ and ai/ draws unchanged", () => {
    // Two hunting fodder, X and Y, come for you from either end while you wait.
    const spec = C.Arena.parse('arena: pair\ngoal: kill\ndepths: 3\nlegend: Q exhibit role=fodder mode=hunting; Y exhibit role=fodder mode=hunting\n\n##########\n#Q......Y#\n#...@....#\n##########\n');
    const X = 'T0.3.room.1', Y = 'T0.3.room.2';
    const seen = { with: [], without: [] };
    const mentions = e => e.who === X || e.by === X || (e.cause && e.cause.by === X);
    const record = k => (pre, a, ev, post) => {
      const x = C.Actors.byUid(post, X), y = C.Actors.byUid(post, Y);
      seen[k].push({ xGone: x.gone, xEvents: ev.filter(mentions).map(e => e.k), y: [post.rng['combat/' + Y], post.rng['ai/' + Y], y.x, y.y, y.hp, y.mode] });
      return [];
    };
    const make = (s, o) => C.Arena.build(spec, s, { options: o });
    const w = Sim.run({ make, policy: 'idle', seed: 9, cap: 40, check: record('with'), options: { invulnerable: true } });
    const wo = Sim.run({ make, policy: 'idle', seed: 9, cap: 40, check: record('without'), options: { invulnerable: true, without: [X] } });
    eq([w.steps, wo.steps, wo.replay.options.without], [40, 40, [X]]);
    eq(wo.violations, [], 'X was there to remove');
    // With X: it moves and strikes. Without X: it is gone from the start, and no event of the
    // run has it act or suffer.
    assert.ok(seen.with.every(r => r.xGone === 0));
    const acts = [].concat(...seen.with.map(r => r.xEvents));
    assert.ok(acts.includes('moved') && acts.includes('attacked'), `X acted: ${acts.join(', ')}`);
    assert.ok(seen.without.every(r => r.xGone === 1 && r.xEvents.length === 0), 'X is gone at every step, and does nothing');
    // Y's dice and its whole course are the same, step by step, with X or without it.
    for (let i = 0; i < 40; i++) eq(seen.without[i].y, seen.with[i].y, `Y at step ${i + 1}`);
    const first = C.Rng.hash32('9/combat/' + Y), last = seen.with[39].y[0];
    assert.ok(typeof last === 'number' && last !== first, 'Y struck, so its combat draws were made and compared');
    assert.ok(typeof seen.with[39].y[1] === 'number', "Y's ai stream was used");
    // Y keeps its uid and tile in the state as made.
    const a = make(9, {}), b = make(9, { without: [X] });
    eq([C.Actors.byUid(a, Y).x, C.Actors.byUid(a, Y).y], [C.Actors.byUid(b, Y).x, C.Actors.byUid(b, Y).y]);
  });

  test('without names an exhibit by its letter in an arena, and a uid that removes nothing is reported', () => {
    const seeds = [1, 2, 3, 4, 5, 6], uidOn = sd => C.Arena.layout(DUMMY, sd).exhibits[0].uid;
    // A letter removes the exhibit drawn with it on every seed, whatever its uid there.
    const p = Sim.paired('dummy', 'fighter', 'fighter@without=P', seeds);
    for (const r of p.b.runs) { eq(r.replay.options.without, [uidOn(r.seed)]); eq([r.stopped, r.steps, r.violations], ['won', 0, []]); }
    eq([p.a.said, p.b.said, p.notes], ['basic.fighter', 'basic.fighter without P', []]);
    assert.match(p.verdict.sentence, /^dummy: the ratio of HP lost, basic\.fighter without P over basic\.fighter, is /); clean(p.verdict.sentence);
    // A uid names the exhibit only on the seeds whose depth and species give it; on the
    // others it removes nothing, each such run says so, and so does the verdict.
    const uid = uidOn(1), want = seeds.filter(sd => uidOn(sd) !== uid);
    assert.ok(want.length >= 1 && want.length < seeds.length);
    const q = Sim.paired('dummy', 'fighter', `fighter@without=${uid}`, seeds);
    eq(q.b.runs.filter(r => r.violations.length).map(r => r.seed), want);
    for (const r of q.b.runs.filter(x => want.includes(x.seed))) {
      eq(r.violations, [{ id: 'without', step: null, text: `without=${uid} removed nothing on seed ${r.seed}: no actor in this visit has that uid` }]);
      const twin = q.a.runs.find(x => x.seed === r.seed);
      // The same visit as the other arm (the states differ only in their options).
      eq([r.reasons, r.replay.actions, r.outcome], [twin.reasons, twin.replay.actions, twin.outcome]);
    }
    const note = `for basic.fighter without ${uid}, without=${uid} removed nothing on ${want.length === 1 ? 'seed' : 'seeds'} ${want.length === 1 ? want[0] : want.slice(0, -1).join(', ') + ' and ' + want[want.length - 1]}, where no actor had that uid`;
    eq(q.notes, [note]); assert.ok(q.verdict.sentence.endsWith(` Note: ${note}.`)); clean(q.verdict.sentence);
    // In a department and in one run alike.
    const d = Sim.runArena({ dept: 'A4' }, 'idle', 1, { cap: 3, options: { without: ['no.such.uid'] } });
    eq(d.violations, [{ id: 'without', step: null, text: 'without=no.such.uid removed nothing on seed 1: no actor in this visit has that uid' }]);
    const one = Sim.single('dummy', 'fighter', [1, 2], { options: { without: [uid] } });
    eq(one.notes, [`for basic.fighter, without=${uid} removed nothing on seed 2, where no actor had that uid`]);
    // Refused in words.
    for (const [fn, re] of [[() => Sim.paired('dummy', 'fighter', 'fighter@without=Q', [1]), /without=Q: Q is not the letter of an exhibit in the arena dummy/],
      [() => Sim.paired('dummy', 'fighter', 'fighter@without=@', [1]), /@ is not the letter of an exhibit/],
      [() => Sim.runArena({ dept: 'A4' }, 'idle', 1, { options: { without: ['P'] } }), /a letter names an exhibit only in an arena/],
      [() => Sim.paired('dummy', 'fighter', 'fighter@without', [1]), /without names no uid or letter/],
      [() => Sim.paired('dummy', 'fighter', 'fighter@rules-off=', [1]), /rules-off names no rule/],
      [() => Sim.paired('dummy', 'fighter', 'fighter@invulnerable=yes', [1]), /not invulnerable=yes/],
      [() => Sim.run({ make: dummy, policy: 'idle', seed: 1, options: { without: ['you'] } }), /without may remove exhibits, not you/]]) {
      let msg = null;
      try { fn(); } catch (e) { msg = e.message; }
      assert.match(String(msg), re); clean(msg);
    }
  });

  test("a run's replay rebuilds its room from its start alone, in an arena or a department", () => {
    const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'accession-stamp-')), file = path.join(tmp, 'pick.txt');
    const stamp = map => ['arena: pick', 'goal: kill', 'species: plodder', 'kit: weapon heavy', 'legend: P exhibit sp; F exhibit role=fodder', 'variants: swap P F', '', ...map].join('\n') + '\n';
    fs.writeFileSync(file, stamp(['#########', '#.@..P.F#', '#.......#', '#########']));
    for (const seed of [1, 2, 3, 4]) {
      const r = Sim.runArena(file, 'random', seed, { cap: 30 });
      // The stamp's file changes (or goes): the replay still holds its room.
      fs.writeFileSync(file, stamp(['#########', '#F.@...P#', '#.......#', '#########']));
      const start = JSON.parse(JSON.stringify(r.replay.start)), options = JSON.parse(JSON.stringify(r.replay.options));
      eq([start.arena, start.seed, start.depth, start.sp, start.variant, start.arenaHash], ['pick', seed, r.depth, r.sp, r.variant, Sim.arenaHash(C)]);
      const s = Sim.rebuild(start, options, C);
      assert.equal(C.State.hash(s), r.startHash, `seed ${seed}: the same room`);
      for (const a of r.replay.actions) C.Step.step(s, a);
      assert.equal(C.State.hash(s), r.endHash, `seed ${seed}: the same end`);
      if (C.Replay) assert.equal(C.State.hash(C.Replay.begin(start, options)), r.startHash, 'tools/replay.js makes it too');
      fs.writeFileSync(file, stamp(['#########', '#.@..P.F#', '#.......#', '#########']));
    }
    const r = Sim.runArena(file, 'random', 1, { cap: 10 });
    assert.throws(() => Sim.rebuild(Object.assign({}, r.replay.start, { arenaHash: '00000000' }), r.replay.options, C), /built by another tools\/arena\.js \(00000000, now [0-9a-f]{8}\)/);
    assert.throws(() => Sim.rebuild(Object.assign({}, r.replay.start, { spec: null }), r.replay.options, C), /holds no parsed stamp/);
    assert.throws(() => Sim.rebuild({ seed: 1 }, {}, C), /a replay start is/);
    const d = Sim.runArena({ dept: 'A4' }, 'fighter', 2, { cap: 20, depth: 2 });
    const s = Sim.rebuild(d.replay.start, d.replay.options, C);
    assert.equal(C.State.hash(s), d.startHash);
    for (const a of d.replay.actions) C.Step.step(s, a);
    assert.equal(C.State.hash(s), d.endHash);
  });

  test('--invulnerable keeps you at 1 HP and counts the blows that would have killed you', () => {
    // A grade-I visitor in the T1 kit (the stamp says so, not the arena's kit), whom a depth-7
    // brute kills.
    const spec = C.Arena.parse('arena: brute\ngoal: kill\ncap: 60\ndepths: 7\ngrade: 1\nkit: weapon tier=1; garment tier=1\nlegend: B exhibit role=brute mode=hunting\n\n#######\n#@...B#\n#######\n');
    const make = (s, o) => C.Arena.build(spec, s, { options: o });
    const mortal = Sim.run({ make, policy: 'idle', seed: 1 });
    assert.equal(mortal.stopped, 'died'); assert.deepEqual([mortal.deaths, mortal.hpLost], [1, 20]);
    const r = Sim.run({ make, policy: 'idle', seed: 1, options: { invulnerable: true } });
    assert.equal(r.stopped, 'cap'); assert.ok(r.deaths >= 2, `deaths ${r.deaths}`); assert.equal(r.outcome.died, false);
    assert.ok(r.hpLost <= 20);
  });

  test("the statistics of a comparison, and the verdict in words for each kind of metric", () => {
    const runs = vals => vals.map(([hpLost, died, woken]) => ({ outcome: { hpLost, died, deaths: died ? 1 : 0, woken, turns: 10, won: !died } }));
    const naive = runs(Array.from({ length: 40 }, (_, i) => [10 + (i % 5), i % 3 === 0, 3]));
    const counter = runs(Array.from({ length: 40 }, (_, i) => [5 + (i % 4), false, 1]));
    const hp = Sim.compare('test', naive, counter, { name: 'hpLost', test: 'ratio', at: 'most', pct: 90 }, ['n', 'c']);
    assert.equal(hp.verdict.pass, true); assert.match(hp.verdict.sentence, /^test: the ratio of HP lost, c over n, is 0\.\d\d \(95% interval/); clean(hp.verdict.sentence);
    const wk = Sim.compare('test', naive, counter, { name: 'woken', test: 'ratio', at: 'most', pct: 50 }, ['n', 'c']);
    assert.equal(wk.stats.woken.ratio, 1 / 3); assert.equal(wk.verdict.pass, true, '1/3 meets 50%, and every seed differs by -2');
    eq([wk.stats.woken.lo, wk.stats.woken.hi], [-2, -2]);
    const died = Sim.compare('test', naive, counter, { name: 'died', test: 'lower', at: null, pct: null }, ['n', 'c']);
    assert.equal(died.verdict.pass, true); assert.match(died.verdict.sentence, /n died on 14 of 40 seeds \(35\.0%\) and c on 0/); clean(died.verdict.sentence);
    const never = Sim.compare('test', counter, counter, { name: 'died', test: 'lower', at: null, pct: null }, ['n', 'c']);
    assert.equal(never.verdict.pass, false); assert.match(never.verdict.sentence, /neither ever had the outcome/);
    const zero = Sim.compare('test', runs([[0, false, 0], [0, false, 0]]), runs([[3, false, 0], [1, false, 0]]), { name: 'hpLost', test: 'ratio', at: 'most', pct: 90 }, ['n', 'c']);
    assert.equal(zero.verdict.pass, false); clean(zero.verdict.sentence);
    assert.match(zero.verdict.sentence, /there is no ratio of HP lost, c over n, because the total for n is 0 over 2 seeds;.*because the total for n is zero, so there is no ratio to compare\.$/);
    const worse = Sim.compare('test', counter, naive, { name: 'died', test: 'lower', at: null, pct: null }, ['c', 'n']);
    assert.match(worse.verdict.sentence, /because the rate for n is not lower than that for c\.$/);
    for (const v of [hp, wk, died, never, zero, worse]) assert.doesNotMatch(v.verdict.sentence, /\b[AB]'s\b/, 'the arms are named');
    assert.equal(Sim.compare('test', naive, counter, null).verdict, null);
  });

  test('seeds, arms and flags are read as written, and refused in words otherwise', () => {
    eq(Sim.parseSeeds('1-3,7,9-10'), [1, 2, 3, 7, 9, 10]);
    assert.throws(() => Sim.parseSeeds('5-1'), /runs backwards/);
    assert.throws(() => Sim.parseSeeds('one'), /seeds are written like/);
    const o = Sim.parseArgs(['--arena', 'dummy', '--paired', 'naive', 'counter', '--seeds', '1-200', '--depth', '5', '--rules-off', 'marble,plaster', '--without', 'a.1', '--without', 'b.2', '--invulnerable', '--cap', '50', '--check', '--log']);
    eq([o.arena, o.paired, o.seeds, o.depth, o.rulesOff, o.without, o.invulnerable, o.cap, o.check, o.log], ['dummy', ['naive', 'counter'], '1-200', 5, ['marble', 'plaster'], ['a.1', 'b.2'], true, 50, true, true]);
    assert.throws(() => Sim.parseArgs(['--depth', '9']), /--depth is a whole number from 1 to 7/);
    assert.throws(() => Sim.parseArgs(['--fly']), /unknown flag --fly/);
    assert.throws(() => Sim.parseArgs(['--policy']), /--policy needs a value/);
  });

  test("coreHash covers the core and content but not viewmodel.js, and vmHash is viewmodel.js's", () => {
    const h = Sim.hashes(C);
    assert.match(h.coreHash, /^[0-9a-f]{8}$|^\S+$/); assert.ok(h.vmHash && h.coreHash !== h.vmHash);
    eq(Sim.hashes(C), h, 'stable');
    if (h.from === 'tools/sim.js') {
      const { coreFiles } = require(path.join(root, 'tools/core-context.js'));
      const src = f => f + '\n' + fs.readFileSync(path.join(root, f), 'utf8');
      const hex = v => (v >>> 0).toString(16).padStart(8, '0');
      assert.equal(h.coreHash, hex(C.State.fnv1a(coreFiles().filter(f => f !== 'js/core/viewmodel.js').map(src).join('\n'))));
      assert.equal(h.vmHash, hex(C.State.fnv1a(src('js/core/viewmodel.js'))));
    } else assert.equal(h.from, 'tools/core-hash.js');
  });

  test('the command line: --help lists the §10.2 flags, and the dummy arena runs end to end', () => {
    const help = cli(['--help']);
    assert.equal(help.status, 0);
    for (const f of ['--policy', '--seeds', '--depth', '--dept', '--rules-off', '--without', '--paired', '--invulnerable', '--arena', '--cards'])
      assert.ok(help.stdout.includes(f), `--help does not list ${f}`);
    const r = cli(['--arena', 'dummy', '--paired', 'idle', 'fighter', '--seeds', '1-4']);
    assert.equal(r.status, 0, r.stderr);
    const j = JSON.parse(r.stdout);
    assert.equal(j.tool, 'sim'); assert.ok(j.coreHash && j.vmHash); eq(j.seeds, [1, 2, 3, 4]);
    eq([j.a.runs.length, j.b.runs.length, j.arena], [4, 4, 'dummy']);
    for (const run of j.a.runs.concat(j.b.runs)) { assert.equal(run.replay.coreHash, j.coreHash); assert.ok(run.reasons.length === run.steps); }
    assert.match(r.stderr, /^dummy: /); clean(r.stderr);
    // One policy, written to a file; a department; the cards.
    const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'accession-sim-')), out = path.join(tmp, 'out.json');
    const one = cli(['--arena', 'dummy', '--policy', 'fighter', '--seeds', '2', '--out', out, '--rules-off', 'marble']);
    assert.equal(one.status, 0, one.stderr);
    const k = JSON.parse(fs.readFileSync(out, 'utf8'));
    eq([k.policy, k.runs.length, k.options.rulesOff, k.runs[0].replay.options.rulesOff], ['basic.fighter', 1, ['marble'], ['marble']]);
    assert.ok(k.summary.n === 1 && 'won' in k.summary); clean(one.stderr);
    const dept = cli(['--dept', 'A4', '--policy', 'idle', '--seeds', '1', '--cap', '5', '--depth', '2']);
    assert.equal(dept.status, 0, dept.stderr);
    const d = JSON.parse(dept.stdout);
    eq([d.dept, d.runs[0].turns, d.runs[0].stopped, d.runs[0].replay.start], ['A4', 5, 'cap', { dept: 'A4', seed: 1, depth: 2 }]);
    // Two arms of one policy are told apart; a limit without bound is written "Infinity",
    // while a ratio that does not exist stays null.
    const same = cli(['--arena', 'dummy', '--paired', 'fighter', 'fighter', '--seeds', '1-2']);
    assert.match(same.stderr, /the ratio of HP lost, basic\.fighter \(arm B\) over basic\.fighter \(arm A\), is/); clean(same.stderr);
    const hp = j.stats.hpLost;
    eq([hp.ratio, hp.ratioHi], [null, 'Infinity'], 'idle loses no HP, the fighter some');
    assert.ok(hp.ratioLo === 'Infinity' || typeof hp.ratioLo === 'number');
    assert.equal(JSON.stringify({ a: Infinity, b: -Infinity, c: null, d: 2 }, Sim.jsonValue), '{"a":"Infinity","b":"-Infinity","c":null,"d":2}');
    const noop = cli(['--arena', 'dummy', '--policy', 'idle', '--without', 'no.such.uid', '--seeds', '1', '--cap', '3']);
    assert.equal(noop.status, 0, noop.stderr);
    assert.match(noop.stderr, /Note: for basic\.idle, without=no\.such\.uid removed nothing on seed 1, where no actor had that uid\.$/m);
    const cards = cli(['--cards']);
    assert.equal(cards.stdout, fs.readFileSync(Sim.README, 'utf8'));
    // Mistakes are refused in words, with a failing status.
    for (const [args, re] of [[['--arena', 'nowhere', '--policy', 'idle'], /no arena nowhere/], [['--arena', 'dummy'], /one of --policy/], [['--policy', 'idle'], /one of --arena/],
      [['--arena', 'dummy', '--policy', 'nobody'], /no policy nobody/], [['--dept', 'Z9', '--policy', 'idle'], /no department Z9/]]) {
      const e = cli(args);
      assert.equal(e.status, 1, args.join(' ')); assert.match(e.stderr, re); clean(e.stderr);
    }
  });

  // §10.3's gate in a script (Wave 3's criterion 4): with --check, a paired verdict that is not
  // a pass fails the command, and so does a run's error or violation; without --check the
  // command only reports, for exploring. A without that removed nothing stays a note.
  test('with --check the command line is a gate: status 1 for a verdict that is not a pass, an error or a violation, 0 for a pass', () => {
    const pass = cli(['--arena', 'dummy', '--paired', 'fighter', 'idle', '--seeds', '1-4', '--check']);
    assert.equal(pass.status, 0, pass.stderr); assert.match(pass.stderr, /that is a pass/); clean(pass.stderr);
    const fail = cli(['--arena', 'dummy', '--paired', 'fighter', 'fighter', '--seeds', '1-4', '--check']);
    assert.equal(fail.status, 1, fail.stderr); assert.match(fail.stderr, /that is not a pass[^]*\nsim: the verdict is not a pass\.$/m); clean(fail.stderr);
    assert.equal(cli(['--arena', 'dummy', '--paired', 'fighter', 'fighter', '--seeds', '1-4']).status, 0, 'without --check it only reports');
    const noop = cli(['--arena', 'dummy', '--policy', 'idle', '--without', 'no.such.uid', '--seeds', '1', '--cap', '3', '--check']);
    assert.equal(noop.status, 0, noop.stderr); assert.match(noop.stderr, /won on 0 and died on 0 of 1 seeds; mean HP lost 0\.00; 1 violation\. Note: /);
    // What fails a check, from a command's output: each kind of failure on its own.
    const run = (error, ids) => ({ error, violations: ids.map(id => ({ id, step: 1, text: `${id} broke` })) });
    const verdict = pass => ({ pass, sentence: '' });
    eq(Sim.failures({ verdict: verdict(true), a: { runs: [run(null, [])] }, b: { runs: [run(null, ['without'])] } }), []);
    eq(Sim.failures({ verdict: verdict(false), a: { runs: [run(null, [])] }, b: { runs: [run(null, [])] } }), ['the verdict is not a pass.']);
    eq(Sim.failures({ verdict: verdict(true), a: { runs: [run('basic.x failed to decide at turn 3', [])] }, b: { runs: [run(null, [])] } }), ['1 run stopped on an error, the first: basic.x failed to decide at turn 3.']);
    eq(Sim.failures({ runs: [run(null, ['without', 'invariant']), run(null, ['policy'])] }), ['2 runs have a violation, the first: invariant broke.']);
  });
};
