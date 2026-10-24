// Crash cards (BUILD.md §10.2): ddmin over an action list, replaying from the seed, within its
// time limit; the JSON-path diff of the state; and the card itself, in words, for planted
// failures: a rule that throws before it does anything, one that throws after it has
// changed the state, an invariant that breaks, a monkey failure in a later visit, and a
// golden run that throws, each shrunk well within 60 s to a list from which no action can
// be removed. Which monkey visit each plant is tried on is found by playing visits by hand,
// since how a visit goes depends on the rules, which every wave changes.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const Shrink = require(path.join(root, 'tools/shrink.js'));
  const ReplayNode = require(path.join(root, 'tools/replay.js'));
  const Hashes = require(path.join(root, 'tools/core-hash.js'));
  const Golden = require(path.join(root, 'tools/golden.js'));
  const EXTRA = ['tools/monkey.js', 'tools/replay.js'];
  const json = x => JSON.stringify(x);
  const clean = s => !/undefined|NaN|\[object/.test(s);
  const C = loadCore(EXTRA);
  const monkey = (seed, actions) => ({ kind: 'monkey', seed, actions, make: null });

  // Removing any one action makes the list pass: checked here, not taken from ddmin.
  const oneMinimal = (list, fails) => list.every((_, i) => !fails(list.slice(0, i).concat(list.slice(i + 1))));
  // The first monkey visit (up to 1,000 actions, on the first of 20 seeds from 20261023 that
  // has one) with a step where pred(pre, action, post) holds, played by hand on the honest
  // core: {replay, step, pre, post}, with the first such step.
  const visitWhere = (pred, what) => {
    for (let seed = 20261023; seed < 20261043; seed++) {
      const v = C.Replay.record(monkey(seed, 1000), 1000), s = C.Replay.begin(v.start, v.options);
      for (let i = 0; i < v.actions.length; i++) {
        const pre = C.State.clone(s);
        C.Step.step(s, v.actions[i]);
        if (pred(pre, v.actions[i], s)) return { replay: C.Replay.make(v.start, v.options, v.actions, Hashes.coreHash()), step: i + 1, pre, post: C.State.clone(s) };
      }
    }
    throw new Error(`no monkey visit on 20 seeds ${what}`);
  };
  // The east room of the test room: x of 8 or more, past the wall with the door.
  const EAST = 8;

  test('ddmin finds a smallest failing list, uses a failure\'s step to drop what comes after, and keeps to its time limit', () => {
    const list = Array.from({ length: 40 }, (_, i) => i + 1);
    const both = l => l.includes(3) && l.includes(29);
    const r = Shrink.ddmin(list, both);
    assert.equal(json(r.actions), json([3, 29]));
    assert.ok(r.minimal && !r.timedOut && r.from === 40 && r.tests > 0 && r.tests < 100, json(r));
    assert.ok(oneMinimal(r.actions, both));
    // A failure at a step: 29 after 3 fails at 29's place, and nothing after it is kept.
    const ordered = l => { const a = l.indexOf(3), b = l.indexOf(29); return a >= 0 && b > a ? b + 1 : false; };
    const s = Shrink.ddmin(list, ordered);
    assert.equal(json(s.actions), json([3, 29]));
    // Three that must all be there.
    const three = l => [5, 6, 31].every(x => l.includes(x));
    assert.equal(json(Shrink.ddmin(list, three).actions), json([5, 6, 31]));
    assert.throws(() => Shrink.ddmin(list, () => false), /the full action list does not fail/);
    // Out of time: the smallest failing list found so far.
    let calls = 0;
    // Each test here takes about 2 ms, and a full shrink needs more than 20 of them.
    const slow = l => { calls++; const t0 = process.hrtime.bigint(); while (process.hrtime.bigint() - t0 < 2000000n); return both(l); };
    const t = Shrink.ddmin(list, slow, { ms: 5 });
    assert.ok(t.timedOut && !t.minimal, json(t));
    assert.ok(both(t.actions) && t.actions.length <= 40);
    assert.ok(calls < 10, `stopped after ${calls} tests`);
  });

  test('the state diff lists each changed JSON path in key order, with absent keys, and stops at its limit', () => {
    const a = { actors: [{ x: 1, y: 2, mode: 'dormant' }], dept: { tiles: ['#.#'], 'odd key': 1 }, gone: 1 };
    const b = { actors: [{ x: 1, y: 3, mode: 'hunting' }, { x: 0 }], dept: { tiles: ['#\'#'], 'odd key': 2 }, added: [1] };
    assert.equal(json(Shrink.diff(a, b)), json([
      { path: 'state.actors[0].mode', from: '"dormant"', to: '"hunting"' },
      { path: 'state.actors[0].y', from: '2', to: '3' },
      { path: 'state.actors[1]', from: 'absent', to: '{"x":0}' },
      { path: 'state.added', from: 'absent', to: '[1]' },
      { path: 'state.dept["odd key"]', from: '1', to: '2' },
      { path: 'state.dept.tiles[0]', from: '"#.#"', to: '"#\'#"' },
      { path: 'state.gone', from: '1', to: 'absent' },
    ]));
    assert.equal(Shrink.diff(a, b, { limit: 2 }).length, 2);
    assert.equal(json(Shrink.diff(a, a)), '[]');
    assert.ok(Shrink.diff({ s: 'x'.repeat(200) }, { s: 'y' })[0].from.endsWith('...'));
  });

  test('a planted rule that throws before it does anything is shrunk to a 1-minimal replay well within 60 s, and its card says what happened in words', () => {
    // The plant: a move made from the east room throws.
    const found = visitWhere((pre, a) => a.a === 'move' && pre.actors[0].x >= EAST, 'moves from the east room');
    const K = loadCore(EXTRA), h = K.Actions.get('move'), f = h.apply;
    h.apply = (state, action, ev) => { if (state.actors[0].x >= EAST) throw new Error('planted crash in the east room'); return f(state, action, ev); };
    const replay = found.replay, t0 = Date.now();
    const s = Shrink.shrinkReplay(K, replay, null);
    const ms = Date.now() - t0;
    assert.ok(ms < 60000, `${ms} ms`);
    assert.ok(s.result.minimal && !s.result.timedOut, json(s.result));
    assert.equal(s.first.message, 'threw planted crash in the east room');
    assert.equal(s.first.step, found.step, 'the full list first fails where the honest visit first moves from the east room');
    assert.equal(s.failure.message, s.first.message); assert.equal(s.failure.threw, true);
    assert.ok(s.replay.actions.length < s.first.step, `from failing at action ${s.first.step} to ${s.replay.actions.length} actions`);
    assert.equal(s.failure.step, s.replay.actions.length, 'the last action is the one that fails');
    assert.equal(s.replay.actions[s.replay.actions.length - 1].a, 'move');
    const fails = list => !!K.Replay.play(Object.assign({}, replay, { actions: list })).failure;
    assert.ok(oneMinimal(s.replay.actions, fails));
    const card = Shrink.card(s.replay, s.failure, s.result), seed = replay.start.seed;
    assert.equal(card.seed, seed); assert.equal(card.coreHash, Hashes.coreHash()); assert.equal(card.actions, s.replay.actions.length);
    assert.equal(card.from, replay.actions.length); assert.equal(card.firstStep, s.first.step); assert.equal(card.step, s.failure.step); assert.equal(card.link, 'pending M5');
    assert.equal(card.threw, true);
    assert.ok(card.text.startsWith(`Crash card: threw planted crash in the east room\nSeed ${seed}, start {"room":"T0","seed":${seed}}, coreHash ${Hashes.coreHash()}`), card.text);
    assert.ok(card.text.includes(`Shrunk to ${card.actions} actions from ${replay.actions.length} (the full list first failed at action ${s.first.step}), in ${s.result.tests} replays`), card.text);
    assert.ok(card.text.includes('\nIt threw before emitting any event.\n'), card.text);
    assert.ok(card.text.includes(`The first bad step is step ${card.step}: {"a":"move","dir":`) && card.text.includes('Replay link: pending M5.'), card.text);
    assert.ok(card.text.includes('It changed nothing in the state that can be compared up to the point where it threw.'), 'a rule that throws before it changes anything');
    assert.equal(json(card.changes), '[]');
    assert.ok(card.text.includes('node tools/replay.js <file> --log'));
    assert.ok(clean(card.text), card.text);
    // The card's replay, read back, fails the same way.
    const back = JSON.parse(card.text.split('\n').find(l => l.startsWith('{"coreHash"')));
    assert.equal(json(back), json(s.replay));
    assert.equal(K.Replay.play(back).failure.message, s.first.message);
  });

  test('a planted rule that changes the state and then throws gets a card with what the step changed and the events it emitted', () => {
    // The plant: a move into the east room is made, and then throws.
    const found = visitWhere((pre, a, post) => a.a === 'move' && pre.actors[0].x < EAST && post.actors[0].x >= EAST, 'moves into the east room');
    const K = loadCore(EXTRA), h = K.Actions.get('move'), f = h.apply;
    h.apply = (state, action, ev) => { const r = f(state, action, ev); if (typeof r === 'number' && state.actors[0].x >= EAST) throw new Error('planted crash after moving'); return r; };
    const s = Shrink.shrinkReplay(K, found.replay, null);
    assert.ok(s.result.minimal, json(s.result));
    assert.equal(s.first.step, found.step);
    const card = Shrink.card(s.replay, s.failure, s.result);
    // By hand, on the honest core: the shrunk list up to its last action, then the honest
    // move handler alone on that state, which is what the plant did before it threw.
    const st = C.Replay.begin(s.replay.start, s.replay.options);
    for (const a of s.replay.actions.slice(0, -1)) C.Step.step(st, a);
    const pre = C.State.clone(st), ev = [];
    assert.equal(typeof C.Actions.get('move').apply(st, s.replay.actions[s.replay.actions.length - 1], ev), 'number');
    const changes = Shrink.diff(JSON.parse(C.State.canon(pre)), JSON.parse(C.State.canon(st)));
    assert.ok(changes.some(c => c.path === 'state.actors[0].x' && Number(c.from) < EAST && Number(c.to) >= EAST), json(changes));
    assert.equal(json(card.changes), json(changes), 'the card lists what the step changed before it threw');
    assert.ok(ev.length > 0);
    assert.equal(json(card.events), json(ev));
    assert.ok(card.text.includes(`\nIt threw before returning its events; it had emitted these (${ev.length}):\n  ${json(ev[0])}`), card.text);
    assert.ok(card.text.includes(`What it changed in the state up to the point where it threw (${changes.length}):`), card.text);
    const xs = changes.find(c => c.path === 'state.actors[0].x');
    assert.ok(card.text.includes(`  state.actors[0].x: ${xs.from} → ${xs.to}`), card.text);
    assert.ok(clean(card.text), card.text);
  });

  test('a planted invariant that breaks is shrunk the same way, and the card lists what the bad step changed', () => {
    // The plant: the first training dummy never loses health. Blows take some.
    const D = 'T0.1.room.1', hp = s => s.actors.find(a => a.uid === D).hp;
    const found = visitWhere((pre, a, post) => hp(post) < hp(pre), 'harms the first training dummy');
    const inv = { id: 'planted_unhurt', applies: a => a.uid === D, check: (pre, events, post, ctx) => ctx.before && ctx.actor.hp < ctx.before.hp ? `lost health (${ctx.before.hp} to ${ctx.actor.hp})` : null };
    const check = ReplayNode.invariants(C, [inv]);
    const replay = found.replay, t0 = Date.now();
    const s = Shrink.shrinkReplay(C, replay, check);
    assert.ok(Date.now() - t0 < 60000);
    assert.ok(s.result.minimal, json(s.result));
    assert.equal(s.first.step, found.step);
    assert.ok(s.failure.message.startsWith('planted_unhurt: lost health'), s.failure.message);
    assert.ok(s.replay.actions.length <= s.first.step);
    assert.ok(oneMinimal(s.replay.actions, list => { const f = C.Replay.play(Object.assign({}, replay, { actions: list }), { check }).failure; return !!f && Shrink.sameFailure(f, s.first); }));
    const card = Shrink.card(s.replay, s.failure, s.result);
    const i = s.failure.post.actors.findIndex(a => a.uid === D), was = [s.failure.pre.actors[i].hp, s.failure.post.actors[i].hp];
    assert.ok(was[1] < was[0]);
    assert.ok(card.changes.some(c => c.path === `state.actors[${i}].hp` && c.from === String(was[0]) && c.to === String(was[1])), json(card.changes));
    assert.ok(card.events.some(e => e.k === 'damaged' && e.who === D));
    assert.ok(card.text.includes(`  state.actors[${i}].hp: ${was[0]} → ${was[1]}`) && card.text.includes('"k":"damaged"'), card.text);
    assert.ok(card.text.includes(`Its events (${card.events.length}):`), card.text);
    assert.ok(clean(card.text), card.text);
  });

  test('a monkey failure in a later visit is replayed from that visit\'s seed and shrunk', () => {
    // Where the monkey's visits end, seen through Monkey.run's own check.
    const g = monkey(20261023, 3000), ends = [];
    C.Monkey.run(g.seed, g.actions, { check: (s, i) => { if (s.over || s.actors.every(a => a.gone || a.uid === 'you')) ends.push(i); } });
    assert.ok(ends.length >= 1 && ends[0] < 3000, 'the monkey finishes a visit within 3,000 actions');
    // The plant: an action halfway through the second visit fails.
    const k = Math.max(1, Math.floor(((ends.length > 1 ? ends[1] : 3000) - ends[0]) / 2)), step = ends[0] + k;
    const v = C.Replay.visit(g, step);
    assert.equal(v.replay.start.seed, 20261024); assert.equal(v.index, k);
    const target = C.State.hash(C.Replay.play(v.replay).state);
    const check = (pre, action, events, post) => C.State.hash(post) === target ? 'planted: the state of the monkey\'s chosen action' : null;
    const p = C.Replay.play(v.replay, { check });
    assert.equal(p.failure.step, v.index);
    const s = Shrink.shrinkReplay(C, v.replay, (pre, action, events, post) => post.actors[0].x === p.failure.post.actors[0].x && post.actors[0].y === p.failure.post.actors[0].y && post.turn >= 3 ? 'planted: there after turn 3' : null);
    assert.ok(s.result.minimal);
    const card = Shrink.card(s.replay, s.failure, s.result);
    assert.equal(card.seed, 20261024);
    assert.ok(card.text.startsWith('Crash card: planted: there after turn 3\nSeed 20261024'), card.text);
    assert.ok(clean(card.text));
  });

  test('a golden run that throws, a monkey in a later visit or a replay, fails the golden test with the crash card of the visit it threw in', () => {
    const SEED = 20261023, N = 3000;
    // Independently of the replay player: each step of the honest monkey run, with the seed of
    // the visit it is in, the turn and the action's kind.
    const seen = [], real = C.Step.step;
    C.Step.step = (s, a) => { seen.push({ seed: s.seed, turn: s.turn, a: a && a.a }); return real(s, a); };
    try { C.Monkey.run(SEED, N); } finally { C.Step.step = real; }
    // The plant: a wait at turn 5 or later in any visit but the first throws.
    const at = seen.findIndex(x => x.a === 'wait' && x.seed !== SEED && x.turn >= 5) + 1;
    assert.ok(at > 0, 'the monkey waits in a later visit');
    const vseed = seen[at - 1].seed, index = at - seen.findIndex(x => x.seed === vseed);
    const K = loadCore(EXTRA), h = K.Actions.get('wait'), f = h.apply;
    h.apply = (state, action, ev) => { if (state.seed !== SEED && state.turn >= 5) throw new Error('planted crash in a later visit'); return f(state, action, ev); };
    // The visit is kept up to and including the action that threw.
    const g = monkey(SEED, N), v = K.Replay.visit(g, N);
    assert.equal(json(v.threw), json({ step: at, message: 'planted crash in a later visit' }));
    assert.equal(v.index, index); assert.equal(v.replay.start.seed, vseed);
    assert.equal(v.replay.actions[index - 1].a, 'wait');
    assert.equal(K.Replay.play(v.replay).failure.step, index);
    // A monkey run that starts on that seed throws in its first visit, at its first wait from
    // turn 5 on, as the honest run of the same monkey shows: record keeps that action too.
    const honest = C.Replay.record(monkey(vseed, 1000), 1000), hs = C.Replay.begin(honest.start, honest.options);
    const firstWait = honest.actions.findIndex(a => { const turn = hs.turn; C.Step.step(hs, a); return a.a === 'wait' && turn >= 5; });
    assert.ok(firstWait >= 0);
    assert.equal(json(K.Replay.record(monkey(vseed, 1000), 1000).actions), json(honest.actions.slice(0, firstWait + 1)), 'record keeps the action that threw too');
    // The golden test's check: where it threw, and the card.
    const c = Golden.selfCheck(K, 'mk', g);
    assert.equal(c.run, null);
    assert.ok(c.problem.startsWith(`mk: the monkey threw at action ${at} of ${N}: planted crash in a later visit\nIt happens at action ${index} of the visit with seed ${vseed}. Replayed from that seed and shrunk:\nCrash card: threw planted crash in a later visit\nSeed ${vseed}, start {"room":"T0","seed":${vseed}}`), c.problem);
    assert.ok(c.problem.includes('\nIt threw before emitting any event.\n'), c.problem);
    assert.ok(clean(c.problem), c.problem);
    const back = JSON.parse(c.problem.split('\n').find(l => l.startsWith('{"coreHash"')));
    assert.equal(back.coreHash, Hashes.coreHash());
    assert.equal(back.actions[back.actions.length - 1].a, 'wait');
    assert.ok(oneMinimal(back.actions, list => !!K.Replay.play(Object.assign({}, back, { actions: list })).failure));
    assert.equal(K.Replay.play(back).failure.message, 'threw planted crash in a later visit');
    // The same visit as a replay run.
    const rp = Object.assign({ kind: 'replay' }, v.replay), cr = Golden.selfCheck(K, 'rp', rp);
    assert.ok(cr.problem.startsWith(`rp: the replay threw at action ${index} of ${index}: planted crash in a later visit\nIt happens at action ${index} of the visit with seed ${vseed}.`), cr.problem);
    assert.ok(cr.problem.includes('\nCrash card: threw planted crash in a later visit\n'), cr.problem);
    // On the honest core the run passes.
    assert.equal(Golden.selfCheck(C, 'mk', g).problem, null);
    // test/golden.test.js itself, given the planted core with this run as its only golden run:
    // its one test fails with the card.
    const tests = [];
    require(path.join(root, 'test/golden.test.js'))({ test: (name, fn) => tests.push({ name, fn }), assert, root, path,
      loadCore: () => Object.assign({}, K, { GOLDEN: { mk: Object.assign({ hash: null, checkpoints: [], visits: null, steps: null, pending: 'planted' }, g) } }) });
    assert.equal(tests.length, 1);
    assert.throws(() => tests[0].fn(), e => e.message.startsWith(`mk: the monkey threw at action ${at} of ${N}`) && e.message.includes('\nCrash card: threw planted crash in a later visit\n'));
  });
};
