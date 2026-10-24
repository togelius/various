// Crash cards (BUILD.md §10.2): ddmin over an action list, replaying from the seed, within its
// time limit; the JSON-path diff of the state; and the card itself, in words, for planted
// failures: a rule that throws, an invariant that breaks, and a monkey failure in a later
// visit, each shrunk well within 60 s to a list from which no action can be removed.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const Shrink = require(path.join(root, 'tools/shrink.js'));
  const ReplayNode = require(path.join(root, 'tools/replay.js'));
  const Hashes = require(path.join(root, 'tools/core-hash.js'));
  const EXTRA = ['tools/monkey.js', 'tools/replay.js'];
  const json = x => JSON.stringify(x);
  const clean = s => !/undefined|NaN|\[object/.test(s);
  const C = loadCore(EXTRA);
  const first = C.Replay.record({ kind: 'monkey', seed: 20261023, actions: 1000, make: null }, 1000);

  // Removing any one action makes the list pass: checked here, not taken from ddmin.
  const oneMinimal = (list, fails) => list.every((_, i) => !fails(list.slice(0, i).concat(list.slice(i + 1))));

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

  test('a planted rule that throws is shrunk to a 1-minimal replay well within 60 s, and its card says what happened in words', () => {
    // The plant: a move made from the east room (x of 8 or more) throws. The monkey's first
    // visit first gets there at its 404th action.
    const K = loadCore(EXTRA), h = K.Actions.get('move'), f = h.apply;
    h.apply = (state, action, ev) => { if (state.actors[0].x >= 8) throw new Error('planted crash in the east room'); return f(state, action, ev); };
    const replay = K.Replay.make(first.start, first.options, first.actions, Hashes.coreHash());
    const t0 = Date.now();
    const s = Shrink.shrinkReplay(K, replay, null);
    const ms = Date.now() - t0;
    assert.ok(ms < 60000, `${ms} ms`);
    assert.ok(s.result.minimal && !s.result.timedOut, json(s.result));
    assert.equal(s.first.message, 'threw planted crash in the east room');
    assert.equal(s.failure.message, s.first.message);
    assert.ok(s.first.step > s.replay.actions.length, `from failing at action ${s.first.step} to ${s.replay.actions.length} actions`);
    assert.ok(s.replay.actions.length <= 40, `${s.replay.actions.length} actions`);
    assert.equal(s.failure.step, s.replay.actions.length, 'the last action is the one that fails');
    assert.equal(s.replay.actions[s.replay.actions.length - 1].a, 'move');
    const fails = list => !!K.Replay.play(Object.assign({}, replay, { actions: list })).failure;
    assert.ok(oneMinimal(s.replay.actions, fails));
    const card = Shrink.card(s.replay, s.failure, s.result);
    assert.equal(card.seed, 20261023); assert.equal(card.coreHash, Hashes.coreHash()); assert.equal(card.actions, s.replay.actions.length);
    assert.equal(card.from, 419); assert.equal(card.firstStep, s.first.step); assert.equal(card.step, s.failure.step); assert.equal(card.link, 'pending M5');
    assert.ok(card.text.startsWith('Crash card: threw planted crash in the east room\nSeed 20261023, start {"room":"T0","seed":20261023}, coreHash ' + Hashes.coreHash()), card.text);
    assert.ok(card.text.includes(`Shrunk to ${card.actions} actions from 419 (the full list first failed at action ${s.first.step}), in ${s.result.tests} replays`), card.text);
    assert.ok(card.text.includes('\nIt made no events.\n'), card.text);
    assert.ok(card.text.includes(`The first bad step is step ${card.step}: {"a":"move","dir":`) && card.text.includes('Replay link: pending M5.'), card.text);
    assert.ok(card.text.includes('It changed nothing in the state that can be compared.'), 'a rule that throws before it changes anything');
    assert.ok(card.text.includes('node tools/replay.js <file> --log'));
    assert.ok(clean(card.text), card.text);
    // The card's replay, read back, fails the same way.
    const back = JSON.parse(card.text.split('\n').find(l => l.startsWith('{"coreHash"')));
    assert.equal(json(back), json(s.replay));
    assert.equal(K.Replay.play(back).failure.message, s.first.message);
  });

  test('a planted invariant that breaks is shrunk the same way, and the card lists what the bad step changed', () => {
    // The plant: the first training dummy never loses health. Your blows take some.
    const inv = { id: 'planted_unhurt', applies: a => a.uid === 'T0.1.room.1', check: (pre, events, post, ctx) => ctx.before && ctx.actor.hp < ctx.before.hp ? `lost health (${ctx.before.hp} to ${ctx.actor.hp})` : null };
    const check = ReplayNode.invariants(C, [inv]);
    const replay = C.Replay.make(first.start, first.options, first.actions, Hashes.coreHash());
    const t0 = Date.now();
    const s = Shrink.shrinkReplay(C, replay, check);
    assert.ok(Date.now() - t0 < 60000);
    assert.ok(s.result.minimal, json(s.result));
    assert.ok(s.failure.message.startsWith('planted_unhurt: lost health'), s.failure.message);
    assert.ok(s.replay.actions.length <= s.first.step);
    assert.equal(s.replay.actions[s.replay.actions.length - 1].a, 'attack');
    assert.ok(oneMinimal(s.replay.actions, list => { const f = C.Replay.play(Object.assign({}, replay, { actions: list }), { check }).failure; return !!f && Shrink.sameFailure(f, s.first); }));
    const card = Shrink.card(s.replay, s.failure, s.result);
    const i = s.failure.post.actors.findIndex(a => a.uid === 'T0.1.room.1'), hp = [s.failure.pre.actors[i].hp, s.failure.post.actors[i].hp];
    assert.ok(hp[1] < hp[0]);
    assert.ok(card.changes.some(c => c.path === `state.actors[${i}].hp` && c.from === String(hp[0]) && c.to === String(hp[1])), json(card.changes));
    assert.ok(card.events.some(e => e.k === 'damaged' && e.who === 'T0.1.room.1'));
    assert.ok(card.text.includes(`  state.actors[${i}].hp: ${hp[0]} → ${hp[1]}`) && card.text.includes('"k":"damaged"'), card.text);
    assert.ok(clean(card.text), card.text);
  });

  test('a monkey failure in a later visit is replayed from that visit\'s seed and shrunk', () => {
    // The plant: the monkey's 600th action fails (it falls in the second visit, seed + 1).
    const g = { kind: 'monkey', seed: 20261023, actions: 600, make: null };
    const v = C.Replay.visit(g, 600);
    assert.equal(v.replay.start.seed, 20261024);
    const target = C.State.hash(C.Replay.play(v.replay).state);
    const check = (pre, action, events, post) => C.State.hash(post) === target ? 'planted: the state of the monkey\'s 600th action' : null;
    const p = C.Replay.play(v.replay, { check });
    assert.equal(p.failure.step, v.index);
    const s = Shrink.shrinkReplay(C, v.replay, (pre, action, events, post) => post.actors[0].x === p.failure.post.actors[0].x && post.actors[0].y === p.failure.post.actors[0].y && post.turn >= 3 ? 'planted: there after turn 3' : null);
    assert.ok(s.result.minimal);
    const card = Shrink.card(s.replay, s.failure, s.result);
    assert.equal(card.seed, 20261024);
    assert.ok(card.text.startsWith('Crash card: planted: there after turn 3\nSeed 20261024'), card.text);
    assert.ok(clean(card.text));
  });
};
