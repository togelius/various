// M0: the scheduler, step(), combat arithmetic, refusals, plain data, clone stability and
// the cross-engine hash (BUILD.md §3, §8.1, §11 M0). Each test checks what its name says.
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore(['tools/monkey.js', 'test/golden/golden.js']);
  const { Step, State, TestRoom, Setup, Monkey, GOLDEN, N, Combat, Actors } = C;

  // A bare room for scenarios: you at (2,2) and exhibits as given.
  function room(exhibits, map) {
    return Setup.room(1, { acc: 'T0', depth: 1, map: map || ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#########'], you: [2, 2],
      exhibits: exhibits.map(e => Object.assign({ sp: 'dummy', mode: 'hunting', stats: { hp: 7, acc: 2, eva: 1, pad: 0, dmin: 1, dmax: 4 } }, e)) });
  }

  test('ties go to you, then to actors in spawn order', () => {
    const s = room([{ at: [5, 2] }, { at: [5, 4] }]);
    const ev = Step.step(s, { a: 'wait' });
    const order = ev.filter(e => e.k === 'waited' || e.k === 'moved').map(e => e.who);
    assert.equal(JSON.stringify(order.slice(0, 3)), JSON.stringify(['you', 'T0.1.room.1', 'T0.1.room.2']));
  });

  test('turn boundaries resolve before anyone who acts on that tick', () => {
    const s = room([]);
    s.actors[0].hp = 10; s.actors[0].maxHp = 20;      // regeneration every max(4, 400/20) = 20 turns
    for (let i = 0; i < 19; i++) Step.step(s, { a: 'wait' });
    assert.equal(s.actors[0].hp, 10);
    const ev = Step.step(s, { a: 'wait' });
    assert.equal(s.turn, 20);
    assert.ok(ev.some(e => e.k === 'regenerated' && e.turn === 20), 'regenerated on turn 20');
    assert.equal(s.actors[0].hp, 11);
  });

  test('a sleeping exhibit is not scheduled; struck awake, it first acts one action later', () => {
    const s = room([{ at: [3, 2], mode: 'dormant', stats: { hp: 30, acc: 2, eva: 1, pad: 0, dmin: 1, dmax: 4 } }]);
    for (let i = 0; i < 5; i++) { const ev = Step.step(s, { a: 'wait' }); assert.ok(!ev.some(e => e.who === 'T0.1.room.1' || e.by === 'T0.1.room.1'), 'asleep: it does nothing'); }
    const t = s.tick;
    const ev = Step.step(s, { a: 'move', dir: 2 });          // a surprise blow
    const woke = ev.find(e => e.k === 'hunting');
    assert.ok(woke && woke.was === 'dormant');
    const ex = s.actors[1];
    assert.equal(ex.woke.turn, s.turn - 1);
    assert.equal(ex.next, t + N.COST_STEP + 0, 'scheduled one action after the blow');
    assert.ok(!ev.some(e => (e.k === 'missed' || e.k === 'damaged') && (e.by === ex.uid || e.cause.by === ex.uid)), 'it does not act in the same instant');
    const ev2 = Step.step(s, { a: 'wait' });
    const first = ev2.findIndex(e => e.k === 'waited'), its = ev2.findIndex(e => (e.k === 'missed' || e.k === 'damaged') && (e.by === ex.uid || e.cause.by === ex.uid));
    assert.ok(its > first && first >= 0, 'on the tie at its first tick, you act first and then it strikes');
  });

  test('a surprise blow hits for maximum damage, and Padding still applies with a floor of 1', () => {
    const s = room([{ at: [3, 2], mode: 'dormant', stats: { hp: 30, acc: 2, eva: 1, pad: 9, dmin: 1, dmax: 4 } }]);
    const ev = Step.step(s, { a: 'move', dir: 2 });
    const d = ev.find(e => e.k === 'damaged');
    assert.equal(d.cause.surprise, 1);
    assert.equal(d.cause.raw, s.actors[0].dmax);
    assert.equal(d.amount, N.DMG_MIN_ON_HIT, 'raw 6 − Padding 9 is floored at 1');
    assert.equal(d.cause.floor, N.DMG_MIN_ON_HIT);
  });

  test('the shown hit chance is exactly the d100 faces that hit', () => {
    const you = { acc: 3, eva: 2, statuses: [] };
    for (let acc = -20; acc <= 30; acc++) {
      const ex = { acc, eva: 1, statuses: [] }, c = Combat.hitChance(ex, you);
      assert.equal(c, Math.min(N.HIT_MAX, Math.max(N.HIT_MIN, N.HIT_BASE + N.HIT_PER_POINT * (acc - 2))));
    }
    // A roll equal to the chance hits; one above misses.
    const s = room([{ at: [3, 2], mode: 'hunting' }]);
    let hits = 0, misses = 0;
    for (let i = 0; i < 400 && !s.over; i++) for (const e of Step.step(s, { a: 'wait' })) {
      if (e.k === 'damaged' && e.cause.roll !== undefined) { assert.ok(e.cause.roll <= e.cause.chance); hits++; }
      if (e.k === 'missed') { assert.ok(e.cause.roll > e.cause.chance); misses++; }
    }
    assert.ok(hits > 0 && misses > 0);
  });

  test('action costs: speed scales waiting, and brutes and Heavy weapons strike at 150', () => {
    const fast = { speed: 'fast' }, slow = { speed: 'slow' };
    assert.equal(Actors.cost(fast, N.COST_WAIT), N.COST_WAIT * N.SPEED_FAST_PCT / 100);
    assert.equal(Actors.cost(slow, N.COST_WAIT), N.COST_WAIT * N.SPEED_SLOW_PCT / 100);
    assert.equal(Actors.attackCost({ weaponForm: 'heavy' }), N.COST_ATTACK_HEAVY);
    assert.equal(Actors.attackCost({ role: 'brute' }), N.COST_ATTACK_HEAVY);
    const s = room([{ at: [4, 2], mode: 'dormant' }]);
    s.actors[0].weaponForm = 'heavy';
    s.actors[0].x = 3;
    Step.step(s, { a: 'move', dir: 2 });
    assert.equal(s.actors[0].next, N.COST_ATTACK_HEAVY);
  });

  test('a refused action costs nothing, draws nothing and changes nothing', () => {
    const s = room([{ at: [5, 2] }]);
    s.actors[0].x = 1; s.actors[0].y = 1;
    const h = State.hash(s);
    const ev = Step.step(s, { a: 'move', dir: 7 });
    assert.equal(ev.map(e => e.k).join(), 'refused');
    assert.equal(State.hash(s), h);
  });

  test('Step.legal lists exactly the actions step() accepts', () => {
    const s = TestRoom.create(9);
    for (let k = 0; k < 60 && !s.over; k++) {
      const legal = Step.legal(s), key = a => JSON.stringify(a);
      const candidates = [{ a: 'wait' }];
      for (let d = 0; d < 8; d++) candidates.push({ a: 'move', dir: d });
      for (const a of s.actors) if (a.uid !== 'you') candidates.push({ a: 'attack', uid: a.uid });
      for (const c of candidates) {
        const copy = State.clone(s), ok = Step.step(copy, c)[0];
        const refused = ok && ok.k === 'refused';
        assert.equal(!refused, legal.some(l => key(l) === key(c)), `at step ${k}, ${key(c)}`);
      }
      Step.step(s, legal[k % legal.length]);
    }
  });

  test('bumping a closed door opens it and you stay put', () => {
    const s = TestRoom.create(3);
    s.actors[0].x = 6; s.actors[0].y = 3;
    s.actors.splice(1);
    const ev = Step.step(s, { a: 'move', dir: 2 });
    assert.ok(ev.some(e => e.k === 'opened'));
    assert.equal(s.actors[0].x, 6);
    assert.equal(s.dept.tiles[3][7], "'");
  });

  test('the state stays plain data after every step, and returned events cannot reach into it', () => {
    Monkey.run(11, 3000, { check(state) { const p = State.plainData(state); if (p) throw new Error('not plain data at ' + p); } });
    const s = room([{ at: [3, 2], mode: 'hunting' }]);
    let ev = [];
    for (let i = 0; i < 50 && !ev.some(e => e.k === 'damaged'); i++) ev = Step.step(s, { a: 'wait' });
    const h = State.hash(s), d = ev.find(e => e.k === 'damaged');
    d.cause.tampered = 1;
    assert.equal(State.hash(s), h);
  });

  test('the plain-data check rejects what JSON would silently change', () => {
    assert.equal(State.plainData({ a: [1, 2, { b: 'x', c: null, d: true }] }), null);
    assert.equal(State.plainData({ a: [1, 2.5] }), 'state.a[1]');
    assert.equal(State.plainData({ a: { b: NaN } }), 'state.a.b');
    assert.equal(State.plainData({ a: undefined }), 'state.a');
    assert.equal(State.plainData({ a: [1, , 3] }), 'state.a[1]');
    assert.equal(State.plainData({ a: new Map() }), 'state.a');
    assert.equal(State.plainData({ a: new Uint8Array(2) }), 'state.a');
    assert.throws(() => State.canon({ a: new Set([1]) }));
  });

  test('every damage event carries its cause', () => {
    const s = TestRoom.create(5);
    let damaged = 0;
    for (let i = 0; i < 300 && !s.over; i++) for (const e of Step.step(s, { a: 'wait' })) if (e.k === 'damaged') {
      damaged++;
      assert.ok(e.cause && e.cause.by && typeof e.cause.chance === 'number', 'cause recorded');
    }
    assert.ok(damaged > 0);
    assert.ok(s.causes.length > 0 && s.causes.length <= N.CAUSE_RECORDS);
  });

  test('10,000 monkey actions give the golden hash, twice, and again when cloned after every step', () => {
    const a = Monkey.run(GOLDEN.m0Monkey.seed, GOLDEN.m0Monkey.actions), b = Monkey.run(GOLDEN.m0Monkey.seed, GOLDEN.m0Monkey.actions);
    assert.equal(a.hash, b.hash);
    assert.equal(a.hash, GOLDEN.m0Monkey.hash, 'golden hash changed: if a rule changed on purpose, run node tools/golden.js and log why');
    assert.deepEqual(a.checkpoints, GOLDEN.m0Monkey.checkpoints);
    const c = Monkey.run(GOLDEN.m0Monkey.seed, GOLDEN.m0Monkey.actions, { cloneEachStep: true });
    assert.deepEqual(c.checkpoints, GOLDEN.m0Monkey.checkpoints, 'a cloned state behaves exactly like the original');
  });
};
