// M3 W1-COMBAT: health (BUILD.md §8.1, §8.4). Your maximum health by grade; regeneration by
// a store of units, timed against §8.1's interval at the four rates (open, a bench, after the
// bell, both) and none in the night watch, exact on odd intervals; its place at the turn
// boundary, before the clock; no store at full health; healing and its cause; and the
// actions wait, rest and sit, with legal ⇔ step.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const C = loadCore();
  const { Step, State, Setup, N, Health, Causes, Text, Clock, Status } = C;
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const json = JSON.stringify;
  // A bench at (2,1), floor round it; no exhibits, so every wait is one turn boundary.
  const BENCH = ['######', '#.b..#', '#....#', '######'];
  // A core whose clock stays where a test puts it: the clock's own turn step (W1-CLOCK's) is
  // stood down, so these tests time regeneration alone.
  function core() { const X = loadCore(); X.ClockRules.boundary = () => {}; return X; }
  function you(X, opts) {
    const s = X.Setup.room(1, Object.assign({ acc: 'T0', depth: 1, map: BENCH, you: opts.at || [3, 1], exhibits: [] }, opts.clock ? { clock: opts.clock } : {}));
    const me = s.actors[0];
    me.maxHp = opts.maxHp; me.hp = opts.hp !== undefined ? opts.hp : Math.max(1, opts.maxHp - 20);
    return s;
  }
  // The turns on which you regenerated, over `turns` waits (after sitting, if on the bench).
  function regenTurns(X, opts) {
    const s = you(X, opts), out = [];
    if (opts.sit) { s.actors[0].x = 2; for (const e of X.Step.step(s, { a: 'sit' })) if (e.k === 'regenerated') out.push(e.turn); }
    while (s.turn < opts.turns) for (const e of X.Step.step(s, { a: 'wait' })) {
      if (e.k !== 'regenerated') continue;
      assert.equal(Causes.check(e), null, json(e));
      assert.equal(json([e.cause.need, e.cause.bench]), json([2 * Health.interval(opts.maxHp), !!opts.sit]));
      out.push(e.turn);
    }
    return { turns: out, state: s };
  }
  const gaps = turns => turns.map((t, i) => t - (i ? turns[i - 1] : 0));
  const B = 1000, G = 60;
  const OPEN = { B, G, count: 0 }, BELL = { B, G, count: B }, WATCH = { B, G, count: B + G };

  test('your maximum health is 20, and 5 more for each grade above I; the interval is max(4, floor(400 ÷ maximum))', () => {
    assert.equal(json([1, 2, 3, 4, 5, 6, 7].map(Health.maxHp)), json([20, 25, 30, 35, 40, 45, 50]));
    assert.equal(json([20, 30, 45, 50, 99, 100, 150, 400].map(Health.interval)), json([20, 13, 8, 8, 4, 4, 4, 4]));
    assert.equal(Setup.you(1, 1).maxHp, Health.maxHp(N.GRADE_START), 'you start at grade I\'s maximum');
  });

  test('regeneration: at 20 health, 1 every 20 turns; 10 on a bench; 40 after the bell; 20 on a bench after the bell; none in the night watch', () => {
    const X = core();
    const cases = [
      ['open', { maxHp: 20, clock: OPEN, turns: 100 }, [20, 20, 20, 20, 20]],
      ['on a bench', { maxHp: 20, clock: OPEN, sit: true, turns: 50 }, [10, 10, 10, 10, 10]],
      ['after the bell', { maxHp: 20, clock: BELL, turns: 120 }, [40, 40, 40]],
      ['on a bench after the bell', { maxHp: 20, clock: BELL, sit: true, turns: 60 }, [20, 20, 20]],
      ['in the night watch', { maxHp: 20, clock: WATCH, turns: 120 }, []],
      ['in the night watch, on a bench', { maxHp: 20, clock: WATCH, sit: true, turns: 120 }, []],
      ['with no clock (a test room)', { maxHp: 20, turns: 60 }, [20, 20, 20]],
    ];
    for (const [name, opts, want] of cases) assert.equal(json(gaps(regenTurns(X, opts).turns)), json(want), name);
    // The rate a turn, as Health.rate reads it.
    const s = you(X, { maxHp: 20, clock: BELL });
    assert.equal(Health.rate(s), 1);
    s.actors[0].x = 2; X.Step.step(s, { a: 'sit' });
    assert.equal(json([Health.rate(s), Health.onBench(s)]), json([2, true]));
  });

  test('regeneration is exact on odd intervals: 45 health every 8 turns, 30 every 13, and on a bench 6.5 on average (7, 6, 7, 6); 100 or more every 4', () => {
    const X = core();
    assert.equal(json(gaps(regenTurns(X, { maxHp: 45, turns: 40 }).turns)), json([8, 8, 8, 8, 8]));
    assert.equal(json(gaps(regenTurns(X, { maxHp: 30, turns: 65 }).turns)), json([13, 13, 13, 13, 13]));
    const bench = regenTurns(X, { maxHp: 30, sit: true, turns: 52 }).turns;
    assert.equal(json(gaps(bench)), json([7, 6, 7, 6, 7, 6, 7, 6]));
    assert.equal(bench[bench.length - 1], 52, '8 health in 52 turns: 6.5 a health');
    for (const m of [100, 150, 999]) assert.equal(json(gaps(regenTurns(X, { maxHp: m, turns: 20 }).turns)), json([4, 4, 4, 4, 4]), `maximum ${m}`);
  });

  test('regeneration runs at boundary step 3, before the clock: on the bell\'s own boundary it is still the open rate', () => {
    const X = loadCore(), log = [];
    // The clock's turn step as §8.4 describes it: the count goes up, and at B the bell rings.
    X.ClockRules.boundary = state => { const c = state.dept.clock; c.count++; if (c.count >= c.B && c.stage === 0) c.stage = 1; };
    const regen = X.Health.regenerate;
    X.Health.regenerate = (state, ev) => { const before = state.actors[0].regen; regen(state, ev); log.push([state.turn, state.actors[0].regen - before]); };
    const s = you(X, { maxHp: 20, clock: { B: 5, G: 60, count: 0 } });
    for (let k = 0; k < 7; k++) X.Step.step(s, { a: 'wait' });
    assert.equal(json(log), json([[1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 1], [7, 1]]), 'the bell rang at turn 5, after that turn\'s regeneration');
    assert.equal(s.dept.clock.stage, 1);
  });

  test('no store builds up at full health; the store empties when you are whole again', () => {
    const X = core(), s = you(X, { maxHp: 20, hp: 20, clock: OPEN }), me = s.actors[0];
    for (let k = 0; k < 60; k++) assert.ok(!X.Step.step(s, { a: 'wait' }).some(e => e.k === 'regenerated'));
    assert.equal(me.regen, 0);
    me.hp = 19;
    const start = s.turn, got = [];
    while (s.turn < start + 25) for (const e of X.Step.step(s, { a: 'wait' })) if (e.k === 'regenerated') got.push(e.turn - start);
    assert.equal(json([got, me.hp, me.regen]), json([[20], 20, 0]), 'the first health comes a full interval after the hurt');
    // Whole again with units to spare: the spare units are dropped.
    me.hp = 19; me.regen = 39;
    X.Step.step(s, { a: 'wait' });
    assert.equal(json([me.hp, me.regen]), json([20, 0]));
    // Healed to full with units in the store: the store empties at the next boundary, so the
    // next hurt waits a full interval again.
    me.hp = 19; me.regen = 30;
    X.Health.heal(s, me, 1, { k: 'status', id: 'restoring' }, []);
    X.Step.step(s, { a: 'wait' });
    assert.equal(me.regen, 0);
    me.hp = 19;
    const from = s.turn, next = [];
    while (s.turn < from + 25) for (const e of X.Step.step(s, { a: 'wait' })) if (e.k === 'regenerated') next.push(e.turn - from);
    assert.equal(json(next), json([20]));
  });

  test('Health.heal gives health up to your maximum, with healed and the cause it is given; nothing for a whole or destroyed actor', () => {
    const s = you(C, { maxHp: 20, hp: 12 }), me = s.actors[0], ev = [];
    assert.equal(Health.heal(s, me, 5, { k: 'item', by: 'you', item: 'x.1' }, ev), 5);
    assert.equal(json(ev.map(e => [e.k, e.who, e.amount, e.hp, e.cause])), json([['healed', 'you', 5, 17, { k: 'item', by: 'you', item: 'x.1' }]]));
    assert.equal(Causes.check(ev[0]), null);
    assert.equal(Health.heal(s, me, 9, { k: 'status', id: 'restoring' }, ev), 3, 'never past the maximum');
    assert.equal(me.hp, 20);
    assert.equal(Health.heal(s, me, 4, { k: 'status', id: 'restoring' }, ev), 0);
    assert.equal(ev.length, 2, 'nothing regained, nothing said');
    for (const e of ev) { const line = Text.event(e); assert.ok(/^[A-Z].*\.$/.test(line) && !/undefined|NaN|\[object/.test(line), line); }
    assert.equal(Text.event({ k: 'healed', turn: 1, tick: 100, who: 'you', amount: 3, hp: 15, cause: { k: 'unknown' } }), 'You regained 3 health: now 15.');
    const t = C.Setup.room(1, { acc: 'T0', depth: 1, map: BENCH, you: [3, 1], exhibits: [{ sp: 'dummy', at: [4, 2], mode: 'hunting', stats: { hp: 9, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 2 } }] });
    t.actors[1].hp = 4; t.actors[1].gone = 1;
    assert.equal(Health.heal(t, t.actors[1], 3, { k: 'home', by: t.actors[1].uid }, []), 0);
    assert.throws(() => Health.heal(s, me, -1, { k: 'item', by: 'you', item: 'x' }, []), /cannot regain -1/);
    assert.throws(() => Health.heal(s, me, 1, null, []), /needs a cause/);
  });

  test('wait and rest cost a turn, are always legal (even fixed) and keep you seated; sit needs a bench and you not seated, costs COST_SIT, and any other action gets you up', () => {
    const s = you(C, { maxHp: 20, hp: 20, at: [2, 1] }), me = s.actors[0];
    const legal = () => Step.legal(s).filter(a => ['wait', 'rest', 'sit'].includes(a.a)).map(a => a.a);
    assert.equal(json(legal()), json(['wait', 'rest', 'sit']));
    let ev = Step.step(s, { a: 'sit' });
    assert.equal(json([me.seated, me.next, ev.find(e => e.k === 'waited').how]), json([true, N.COST_SIT, 'sit']));
    assert.equal(json(legal()), json(['wait', 'rest']), 'seated: no second sit');
    const h = State.hash(s);
    assert.equal(json(Step.step(s, { a: 'sit' }).map(e => [e.k, e.reason])), json([['refused', 'seated']]));
    assert.equal(State.hash(s), h);
    for (const a of ['rest', 'wait', 'rest']) { const t = me.next; ev = Step.step(s, { a }); assert.equal(json([me.seated, me.next - t, ev[0].k, ev[0].how]), json([true, N.COST_WAIT, 'waited', a])); }
    assert.equal(json([me.still, me.lastAct]), json([true, 'rest']), 'rest keeps your ring still');
    Step.step(s, { a: 'move', dir: 2 });
    assert.equal(json([me.x, me.seated]), json([3, false]), 'a step gets you up');
    const g = State.hash(s);
    assert.equal(json(Step.step(s, { a: 'sit' }).map(e => [e.k, e.reason])), json([['refused', 'no_bench']]));
    assert.equal(State.hash(s), g, 'refused off the bench: nothing changes');
    assert.equal(Text.refusal('no_bench'), 'There is no bench here to sit on.');
    assert.equal(Text.refusal('seated'), 'You are already sitting down.');
    // Fixed: wait and rest are still legal (Status.blocks), sit is not.
    const f = you(C, { maxHp: 20, hp: 20, at: [2, 1] });
    f.actors[0].statuses.push({ id: 'fixed', until: 9, turns: null, from: 0 });
    assert.equal(json(Step.legal(f).map(a => a.a)), json(['wait', 'rest']));
    // Sentences.
    assert.equal(Text.event({ k: 'waited', turn: 1, tick: 100, who: 'you', how: 'sit', cause: { k: 'action', how: 'sit' } }), 'You sat down on the bench.');
    assert.equal(Text.event({ k: 'regenerated', turn: 9, tick: 900, who: 'you', hp: 12, cause: { k: 'regen', units: 40, need: 40, bench: true } }), 'You recovered 1 health on the bench: now 12.');
  });

  test('legal ⇔ step for wait, rest and sit, on and off a bench, seated or not, and the health invariants hold over a sitting walk', () => {
    // A walk that mostly sits and rests on the bench, and now and then walks off and back.
    const pick = seed => { let i = 0; return state => {
      i++;
      const legal = Step.legal(state), has = a => legal.find(l => l.a === a);
      if (i % 40 < 30) return has('sit') || has('rest');
      const moves = legal.filter(l => l.a === 'move');
      return moves[(i * 7 + seed) % moves.length];
    }; };
    for (const at of [[2, 1], [3, 1], [1, 2]]) for (const seated of [false, true]) {
      const s = you(C, { maxHp: 20, hp: 9, at });
      s.actors[0].seated = seated && at[0] === 2;
      const legal = Step.legal(s), key = a => json(a);
      for (const c of ['wait', 'rest', 'sit'].flatMap(id => C.Actions.get(id).candidates(s))) {
        const copy = State.clone(s), h = State.hash(copy), ev = Step.step(copy, c), refused = ev[0].k === 'refused';
        assert.equal(!refused, legal.some(l => key(l) === key(c)), `${json(at)} seated ${seated}: ${key(c)}`);
        if (refused) assert.equal(State.hash(copy), h);
      }
    }
    const s = you(C, { maxHp: 30, hp: 5, at: [2, 1] });
    const p = H.play(C, s, pick(3), { inv: ['combat'], cap: 300 });
    assert.deepEqual(p.violations.map(v => v.text), []);
    assert.ok(p.events.some(e => e.k === 'regenerated' && e.cause.bench), 'it sat on the bench at some point');
  });
};
