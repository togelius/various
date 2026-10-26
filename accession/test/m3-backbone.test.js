// M3's action core (BUILD.md §3.4, §4.1, §4.2, §8.1, §8.2): the action table and its parity
// with step(), the actor fields, the cost floor, the turn boundary's order, the exhibit's
// turn, the status timing rule, events against their schemas, refusals, the exhibits' step
// rule and noise through doors. The expected figures are worked out here from BUILD.md's
// text, never from the rule code.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const C = loadCore(['tools/monkey.js']);
  const { Step, State, Setup, TestRoom, Dept, Actions, Actors, Status, Causes, Grid, Noise, Text, N } = C;
  const key = a => JSON.stringify(a);
  const json = x => JSON.stringify(x);
  const OPEN = ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#########'];
  const ex = (at, extra) => Object.assign({ sp: 'dummy', at, mode: 'hunting', stats: { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } }, extra);
  const room = (Ctx, map, you, exhibits, options) => Ctx.Setup.room(1, { acc: 'T0', depth: 1, map, you, exhibits: exhibits || [] }, options);
  // A status put on an actor by hand, already settled: held until turn `until`.
  const held = (a, id, until) => a.statuses.push({ id, until, turns: null, from: 0 });

  // Every candidate of every handler, refused or not, against Step.legal; and a refused one
  // leaves the state and every random stream as they were (§4.2), whatever handler refused
  // it. The streams live in state.rng, so comparing canonical JSON covers both.
  function parity(s, where) {
    const legal = Step.legal(s), keys = new Set(legal.map(key)), cands = new Set(), base = State.canon(s);
    for (const id of Actions.ORDER) {
      const h = Actions.get(id);
      if (!h) continue;
      for (const c of h.candidates(s)) {
        cands.add(key(c));
        const t = JSON.parse(base), ev = Step.step(t, c), refused = ev.length === 1 && ev[0].k === 'refused';
        assert.equal(!refused, keys.has(key(c)), `${where}: ${key(c)} ${refused ? 'refused (' + ev[0].reason + ')' : 'accepted'}`);
        if (refused) assert.ok(State.canon(t) === base, `${where}: ${key(c)} refused (${ev[0].reason}) but changed the state or a stream`);
      }
    }
    for (const k of keys) assert.ok(cands.has(k), `${where}: legal ${k} is no handler's candidate`);
    return legal.length;
  }

  test('Step.legal lists exactly the actions step() accepts, over every handler\'s candidates', () => {
    let states = 0, legalSeen = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const s = TestRoom.create(seed);
      s.actors[0].hp = s.actors[0].maxHp = 999;
      for (let k = 0; k < 40 && !s.over; k++) {
        legalSeen += parity(s, `test room ${seed}, step ${k}`); states++;
        const legal = Step.legal(s);
        Step.step(s, legal[(k * 5 + seed) % legal.length]);
      }
    }
    // A department, with its doors.
    const d = Dept.create(3, 'M11', 2);
    for (let k = 0; k < 8; k++) { parity(d, `M11 step ${k}`); states++; const legal = Step.legal(d); Step.step(d, legal[(k * 3) % legal.length]); }
    // Planted states: you fixed; you rooted beside a door and an exhibit; an exhibit in a case
    // beside you; a choice waiting; the visit over.
    const fixed = room(C, OPEN, [2, 2], [ex([3, 2], { mode: 'dormant' })]); held(fixed.actors[0], 'fixed', 9);
    const whileFixed = Step.legal(fixed);
    assert.ok(whileFixed.some(a => a.a === 'wait') && whileFixed.every(a => a.a === 'wait' || a.a === 'rest'), 'fixed: only wait and rest: ' + json(whileFixed));
    parity(fixed, 'fixed');
    const doorMap = ['#######', '#.....#', '#..+..#', '#.....#', '#######'];
    const rooted = room(C, doorMap, [3, 1], [ex([4, 1], { mode: 'dormant' })]); held(rooted.actors[0], 'rooted', 9);
    assert.equal(json(Step.legal(rooted).filter(a => a.a === 'move').map(a => a.dir)), json([2, 4]), 'rooted: the blow and the door only');
    parity(rooted, 'rooted');
    const caseMap = ['#######', '#.....#', '#..v..#', '#.....#', '#######'];
    const encased = room(C, caseMap, [3, 1], [ex([3, 2])]);
    assert.ok(!Step.legal(encased).some(a => a.a === 'attack' || (a.a === 'move' && a.dir === 4)), 'nothing strikes into a case');
    parity(encased, 'encased');
    const pending = TestRoom.create(2); pending.ui.pendingChoice = { k: 'seal', options: [] };
    assert.equal(parity(pending, 'pending choice'), 0);
    const over = TestRoom.create(2); over.over = { k: 'died', turn: 0, by: null, door: null, cause: {} };
    assert.equal(parity(over, 'visit over'), 0);
    // Reserved and unknown actions are refused as unknown.
    for (const a of [{ a: 'push', x: 1, y: 1, dir: 0 }, { a: 'view' }, { a: 'dance' }, {}, null]) assert.equal(Step.step(TestRoom.create(1), a)[0].reason, 'unknown_action', key(a));
    assert.ok(states > 150 && legalSeen > 500, `${states} states, ${legalSeen} legal actions`);
  });

  test('the action table is closed, each id defined once, and Step.legal follows Actions.ORDER', () => {
    const X = loadCore();
    assert.throws(() => X.Actions.define('dance', { legal: () => [], candidates: () => [], apply: () => 0 }), /not in Actions\.ORDER/);
    assert.throws(() => X.Actions.define('wait', { legal: () => [], candidates: () => [], apply: () => 0 }), /defined twice/);
    assert.throws(() => X.Actions.define('push', { legal: () => [] }), /needs candidates/);
    assert.equal(X.Actions.get('push'), null); assert.equal(X.Actions.get('view'), null); assert.equal(X.Actions.get('toString'), null);
    X.Actions.defineChoice('planted', () => 0);
    assert.throws(() => X.Actions.defineChoice('planted', () => 0), /defined twice/);
    assert.equal(typeof X.Actions.choice('planted'), 'function'); assert.equal(X.Actions.choice('nothing'), null);
    const s = TestRoom.create(4), order = Step.legal(s).map(a => Actions.ORDER.indexOf(a.a));
    assert.ok(order.every((v, i) => i === 0 || order[i - 1] <= v), 'in ORDER');
    assert.equal(json(Actions.ORDER), json(['wait', 'rest', 'sit', 'move', 'attack', 'close', 'open', 'bash', 'push', 'take', 'drop', 'equip', 'unequip', 'use', 'throw', 'read', 'view', 'choose', 'leave']));
  });

  test('Actors.spawn gives plain data with every actor field, appended in spawn order', () => {
    const FIELDS = ['uid', 'sp', 'arch', 'role', 'mods', 'modParams', 'trigger', 'group', 'size', 'x', 'y', 'hp', 'maxHp', 'acc', 'eva', 'pad', 'dmin', 'dmax',
      'speed', 'next', 'notBefore', 'mode', 'pips', 'stim', 'pipTurns', 'sawYou', 'home', 'target', 'lastKnown', 'guards', 'route', 'plan', 'facing',
      'statuses', 'telegraph', 'acts', 'woke', 'hunted', 'kids', 'gen', 'gone', 'ax'];
    const YOU = FIELDS.concat(['still', 'lastAct', 'seated', 'regen', 'weaponForm', 'reach', 'quiet', 'breaker']);
    const s = room(C, OPEN, [2, 2], [ex([5, 2], { mode: 'dormant' })]);
    s.turn = 7;
    const a = Actors.spawn(s, { uid: 'T0.1.room.9', sp: 'x', x: 6, y: 3, hp: 5, acc: 1, eva: 2, pad: 0, dmin: 1, dmax: 2, mode: 'dormant' });
    assert.equal(s.actors[s.actors.length - 1], a, 'appended');
    for (const [who, want] of [[s.actors[0], YOU], [s.actors[1], FIELDS], [a, FIELDS]]) {
      assert.equal(json(Object.keys(who).sort()), json(want.slice().sort()), who.uid);
      for (const k of want) assert.notEqual(who[k], undefined, `${who.uid}.${k}`);
    }
    assert.equal(State.plainData(s), null);
    assert.equal(json([a.arch, a.mods, a.trigger, a.speed, a.notBefore, a.home, a.stim, a.gone, a.woke, a.route, a.plan, a.facing]),
      json(['plodder', [], null, null, null, [6, 3], 7, 0, null, null, null, null]), 'the defaults');
    assert.equal(s.actors[0].home, null); assert.equal(s.actors[0].mode, null);
    // The species' fields are copied, and its archetype's speed (or a modifier's, unless it is switched off).
    const d = Dept.create(5, 'S9', 2);
    for (const x of d.actors.slice(1)) {
      const sp = C.Packs.species('S9', x.sp) || C.Packs.get('S9').centrepiece;
      assert.equal(json([x.arch, x.mods, x.trigger]), json([sp.archetype, sp.modifiers || [], sp.trigger || null]), x.uid);
    }
    const dart = d.actors.find(x => x.arch === 'darter');
    assert.ok(dart && dart.speed === 'fast', 'a darter is fast');
    const marble = Actors.make(s, { uid: 'm', x: 1, y: 1, hp: 1, mods: ['marble'] }), off = room(C, OPEN, [2, 2], [], { rulesOff: ['marble'] });
    assert.equal(marble.speed, 'slow');
    assert.equal(Actors.make(off, { uid: 'm', x: 1, y: 1, hp: 1, mods: ['marble'] }).speed, null, 'marble switched off');
    assert.equal(Actors.make(s, { uid: 'm', x: 1, y: 1, hp: 1, arch: 'darter', mods: ['marble'] }).speed, null, 'fast and slow cancel');
  });

  test('every action of yours that costs time costs at least a turn, and a handler that costs less is caught', () => {
    let costly = 0;
    const states = [[TestRoom.create(6), 40], [Dept.create(2, 'A4', 1), 8], [Dept.create(4, 'S9', 3), 8]];
    for (const [s, steps] of states) {
      s.actors[0].hp = s.actors[0].maxHp = 999;
      for (let k = 0; k < steps && !s.over; k++) {
        for (const id of Actions.ORDER) {
          const h = Actions.get(id);
          if (!h) continue;
          for (const c of h.candidates(s)) {
            const t = State.clone(s), before = t.actors[0].next, ev = Step.step(t, c);
            if (ev[0].k === 'refused') { assert.equal(t.actors[0].next, before); continue; }
            const cost = t.actors[0].next - before;
            assert.ok(cost === 0 || cost >= N.TICKS_PER_TURN, `${key(c)} cost ${cost}`);
            if (cost > 0) costly++;
          }
        }
        const legal = Step.legal(s);
        Step.step(s, legal[(k * 7) % legal.length]);
      }
    }
    assert.ok(costly > 300, `${costly} actions`);
    const X = loadCore(), s = room(X, OPEN, [2, 2]);
    X.Actions.get('wait').apply = () => 50;
    assert.throws(() => X.Step.step(s, { a: 'wait' }), /wait cost 50 ticks/);
    X.Actions.get('wait').apply = (state, action, ev) => { ev.push({ k: 'waited' }); return 'blocked'; };
    assert.throws(() => X.Step.step(s, { a: 'wait' }), /refused \(blocked\) after emitting events/);
  });

  test('the turn boundary runs its eight steps in §8.1\'s order, statuses\' per-turn effects after the wake checks, before anyone who acts on that tick', () => {
    const X = loadCore(), log = [];
    const steps = [['Surfaces', 'tick'], ['Status', 'tick'], ['Kit', 'recharge'], ['Health', 'regenerate'], ['Wake', 'boundary'], ['Status', 'effects'], ['Wake', 'decay'],
      ['ClockRules', 'boundary'], ['Modules', 'alarmDecay'], ['Modules', 'turn']];
    for (const [ns, fn] of steps) { const orig = X[ns][fn]; X[ns][fn] = (...args) => { log.push(`${ns}.${fn}@${args[0].tick}`); return orig(...args); }; }
    const s = room(X, OPEN, [2, 2], [ex([6, 2], { stats: { hp: 999, acc: -99, eva: 0, pad: 0, dmin: 1, dmax: 1 } })]);
    const actedAt = [];
    const act = X.AI.act;
    X.AI.act = (state, a, ev) => { log.push(`act@${state.tick}`); actedAt.push(state.tick); return act(state, a, ev); };
    X.Step.step(s, { a: 'wait' });
    // The exhibit acts at 0; then turn 1's boundary at tick 100, before your decision at 100.
    assert.equal(json(log), json(['act@0'].concat(steps.map(([ns, fn]) => `${ns}.${fn}@100`))));
    log.length = 0;
    X.Step.step(s, { a: 'wait' });
    assert.equal(json(log), json(['act@100'].concat(steps.map(([ns, fn]) => `${ns}.${fn}@200`))), 'the exhibit at 100 acts after you, then the boundary at 200');
    // Step.boundary itself, called directly, runs the same eight in the same order.
    log.length = 0; X.Step.boundary(s, []);
    assert.equal(json(log.map(l => l.split('@')[0])), json(steps.map(([ns, fn]) => `${ns}.${fn}`)));
  });

  test('an exhibit\'s action is charged after it acts: next + cost, or notBefore if later, which is then cleared', () => {
    const X = loadCore();
    const s = room(X, OPEN, [2, 2], [ex([6, 2]), ex([6, 4])]);
    const [, a, b] = s.actors;
    let calls = 0;
    // a marks something and must not act again before 750; b writes nothing and pays 130.
    X.AI.act = (state, who) => { calls++; if (who === a) { a.notBefore = 750; return 100; } return 130; };
    X.Step.step(s, { a: 'wait' });
    assert.equal(a.next, 750); assert.equal(a.notBefore, null);
    assert.equal(b.next, 130, 'nothing written: next + cost');
    // A notBefore earlier than next + cost changes nothing.
    X.AI.act = (state, who) => { if (who === a) a.notBefore = 10; return 100; };
    a.next = 0; b.next = 200; s.tick = 0; s.turn = 0; s.actors[0].next = 0;
    X.Step.step(s, { a: 'wait' });
    assert.equal(a.next, 100, 'max(0 + 100, 10)');
    // notBefore = your next: on the tie you decide first, so it acts only after you have seen it.
    X.AI.act = (state, who) => { who.notBefore = state.actors[0].next; return 50; };
    const order = [];
    const t = room(X, OPEN, [2, 2], [ex([6, 2])]);
    const act = X.AI.act;
    X.AI.act = (state, who, ev) => { order.push(`it@${state.tick}`); return act(state, who, ev); };
    X.Step.step(t, { a: 'wait' }); order.push(`you@${t.tick}`);
    X.Step.step(t, { a: 'wait' }); order.push(`you@${t.tick}`);
    assert.equal(json(order), json(['it@0', 'you@100', 'it@100', 'you@200']));
    // An exhibit's action that returns no whole number of ticks is a bug, and says so.
    X.AI.act = () => 12.5;
    assert.throws(() => X.Step.step(room(X, OPEN, [2, 2], [ex([6, 2])]), { a: 'wait' }), /action cost 12\.5/);
    assert.ok(calls > 0);
  });

  // Plant a status on you at the end of an action of `cost` ticks: the wait, patched.
  function after(X, s, cost, id, turns) {
    const h = X.Actions.get('wait'), apply = h.apply;
    h.apply = (state, action, ev) => { apply(state, action, ev); X.Status.apply(state, state.actors[0], id, turns, { k: 'status', id }, ev); return cost; };
    const ev = X.Step.step(s, { a: 'wait' });
    h.apply = apply;
    return ev;
  }

  test('status timing: Fixative after a 100-, 150-, 200- or 300-tick action gives exactly 4 forced waits', () => {
    for (const cost of [100, 150, 200, 300]) {
      const X = loadCore(), s = room(X, OPEN, [2, 2]);
      const ev = after(X, s, cost, 'fixed', N.FIXATIVE_TURNS);
      assert.ok(ev.some(e => e.k === 'status' && e.who === 'you' && e.id === 'fixed' && e.on === true));
      // until = idiv(your next, 100) + 4, worked out here.
      assert.equal(s.actors[0].statuses[0].until, Math.floor(cost / 100) + N.FIXATIVE_TURNS);
      let forced = 0;
      const ticks = [];
      while (!X.Step.legal(s).some(a => a.a === 'move')) {
        assert.equal(X.Step.step(X.State.clone(s), { a: 'move', dir: 2 })[0].reason, 'fixed');
        ticks.push(s.tick); X.Step.step(s, { a: 'wait' }); forced++;
        assert.ok(forced < 10);
      }
      assert.equal(forced, 4, `after ${cost}: forced at ${ticks}`);
      assert.equal(json(ticks), json([0, 1, 2, 3].map(i => cost + 100 * i)));
    }
  });

  test('status timing: rooted 2 blocks your steps for two turns and still lets you open a door or strike', () => {
    const doorMap = ['#######', '#.....#', '#..+..#', '#.....#', '#######'];
    for (const cost of [100, 150, 200]) {
      const X = loadCore(), s = room(X, doorMap, [3, 1], [ex([4, 1], { mode: 'dormant' })]);
      after(X, s, cost, 'rooted', N.MIMIC_GRIP_TURNS);
      let rootedFor = 0;
      for (;;) {
        const legal = X.Step.legal(s), steps = legal.filter(a => a.a === 'move' && a.dir !== 2 && a.dir !== 4);
        if (steps.length) break;
        rootedFor++;
        assert.equal(X.Step.step(X.State.clone(s), { a: 'move', dir: 6 })[0].reason, 'rooted');
        const c = X.State.clone(s), ev = X.Step.step(c, { a: 'move', dir: 4 });
        assert.ok(ev.some(e => e.k === 'opened') && c.actors[0].x === 3 && c.actors[0].y === 1, 'the door opens and you stay');
        const b = X.State.clone(s), blow = X.Step.step(b, { a: 'move', dir: 2 });
        assert.ok(blow.some(e => e.k === 'damaged' && e.who === s.actors[1].uid) && b.actors[0].x === 3, 'the blow lands and you stay');
        X.Step.step(s, { a: 'wait' });
        assert.ok(rootedFor < 6);
      }
      assert.equal(rootedFor, 2, `after a ${cost}-tick action`);
      assert.ok(X.Step.step(s, { a: 'move', dir: 6 }).some(e => e.k === 'moved'));
    }
  });

  test('status timing: a 5-turn status runs its effect on exactly 5 boundaries, the first before your next decision', () => {
    for (const cost of [100, 150, 200, 300]) {
      const X = loadCore(), s = room(X, OPEN, [2, 2]), turns = [];
      X.Status.EFFECTS.coughing = (state, a) => { if (a.uid === 'you') turns.push(state.turn); };
      after(X, s, cost, 'coughing', N.COUGH_TURNS);
      const next = s.actors[0].next;
      for (let i = 0; i < 10; i++) X.Step.step(s, { a: 'wait' });
      const first = Math.floor(next / 100);
      assert.equal(json(turns), json([0, 1, 2, 3, 4].map(i => first + i)), `after ${cost}`);
      assert.ok(first * 100 <= next, 'the first boundary is at or before your next decision');
      assert.ok(!s.actors[0].statuses.length, 'ended');
    }
    // A sleeping exhibit's status starts at the next boundary; applied again, it lasts to the later end.
    const X = loadCore(), s = room(X, OPEN, [2, 2], [ex([5, 2], { mode: 'dormant' })]), a = s.actors[1], ev = [];
    s.turn = 3; X.Status.apply(s, a, 'slowed', 2, { k: 'status', id: 'slowed' }, ev); X.Status.settle(s);
    assert.equal(json([a.statuses[0].from, a.statuses[0].until]), json([4, 6]));
    X.Status.apply(s, a, 'slowed', 5, { k: 'status', id: 'slowed' }, ev); X.Status.settle(s);
    assert.equal(json([a.statuses.length, a.statuses[0].from, a.statuses[0].until]), json([1, 4, 9]));
    X.Status.apply(s, a, 'slowed', 1, { k: 'status', id: 'slowed' }, ev); X.Status.settle(s);
    assert.equal(a.statuses[0].until, 9, 'a shorter one does not cut it short');
    assert.ok(X.Status.has(a, 'slowed') && X.Status.harmful('slowed') && !X.Status.harmful('restoring') && !X.Status.harmful('nothing'));
    assert.equal(ev.filter(e => e.k === 'status').length, 3);
  });

  test('every event of 3,000 monkey steps, refusals included, passes Causes.check against its schemas', () => {
    let n = 0;
    const kinds = new Set(), causes = new Set();
    const play = (s, steps, seed) => {
      const pick = C.Rng.stream({ seed, rng: {} }, 'pick');
      for (let i = 0; i < steps; i++) {
        if (s.over) break;
        const legal = Step.legal(s);
        const a = pick.int(0, 9) === 0 ? { a: 'move', dir: pick.int(0, 8) } : pick.int(0, 19) === 0 ? { a: 'attack', uid: 'nobody' } : legal[pick.int(0, legal.length - 1)];
        for (const e of Step.step(s, a)) {
          const bad = Causes.check(e);
          assert.equal(bad, null, `${bad}: ${key(e)}`);
          const line = Text.event(e, C.Labels.nameOf(s));
          assert.ok(line && !/undefined|NaN|\[object/.test(line), `${e.k}: ${line}`);
          kinds.add(e.k); if (e.cause) causes.add(e.k + '.' + e.cause.k);
          n++;
        }
      }
    };
    for (let seed = 1; seed <= 6; seed++) { const s = TestRoom.create(seed); s.actors[0].hp = s.actors[0].maxHp = 999; play(s, 500, seed); }
    for (const [acc, depth] of [['S9', 1], ['A4', 4], ['M11', 7]]) { const s = Dept.create(depth, acc, depth); s.actors[0].hp = s.actors[0].maxHp = 999; play(s, 400, depth); }
    for (const k of ['moved', 'opened', 'attacked', 'missed', 'damaged', 'died', 'pip', 'woke', 'hunting', 'noise', 'waited', 'regenerated', 'refused']) assert.ok(kinds.has(k), `no ${k} event`);
    // Sleepers now wake in your ring (W0d) before a blow can surprise them; damage wakes are in m3-backbone-ai.
    for (const c of ['damaged.attack', 'noise.attack', 'noise.door', 'noise.destroyed', 'pip.ring', 'woke.ring', 'hunting.ring', 'opened.door']) assert.ok(causes.has(c), `no ${c}`);
    assert.ok(n > 4000, `${n} events`);
  });

  test('Causes.check names the first thing wrong with an event', () => {
    const ok = { k: 'damaged', turn: 1, tick: 100, who: 'you', amount: 3, hp: 17,
      cause: { k: 'attack', by: 'x.1', at: 'you', chance: 80, roll: 12, raw: 4, pad: 1, how: { kind: 'melee' }, from: [2, 1] } };
    assert.equal(Causes.check(ok), null);
    const with_ = f => { const e = JSON.parse(json(ok)); f(e); return Causes.check(e); };
    assert.equal(with_(e => delete e.cause.roll), null, 'roll is optional');
    assert.equal(with_(e => { e.cause.roll = null; }), null, 'optional may be null');
    assert.equal(with_(e => { e.cause.roll = 'x'; }), 'damaged.cause.roll: "x" is not a int');
    assert.equal(with_(e => delete e.cause.raw), 'damaged.cause.raw: missing int');
    assert.equal(with_(e => { e.cause.from = [1]; }), 'damaged.cause.from: [1] is not a tile');
    assert.equal(with_(e => { e.cause.extra = 1; }), 'damaged.cause.extra: not in the schema');
    assert.equal(with_(e => { e.extra = 1; }), 'damaged.extra: not in the schema');
    assert.equal(with_(e => delete e.hp), 'damaged.hp: missing int');
    assert.equal(with_(e => delete e.tick), 'damaged.tick: missing int');
    assert.equal(with_(e => { e.cause.k = 'magic'; }), 'damaged.cause: no schema for the cause magic');
    assert.equal(with_(e => delete e.cause), 'damaged.cause: missing');
    assert.equal(with_(e => { e.k = 'teleported'; }), 'teleported: not an event kind');
    // The exempt kinds have their fields checked, not their cause.
    assert.equal(Causes.check({ k: 'moved', turn: 0, tick: 0, who: 'you', from: [1, 1], to: [2, 1] }), null);
    assert.equal(Causes.check({ k: 'moved', turn: 0, tick: 0, who: 'you', from: [1, 1] }), 'moved.to: missing tile');
    assert.equal(Causes.check({ k: 'refused', turn: 0, tick: 0, reason: 'blocked' }), null);
    // emit stamps the turn and tick, copies what it is given, and records the recorded kinds.
    const s = room(C, OPEN, [2, 2]), ev = [], cause = { k: 'regen', units: 4, need: 4, bench: false }, from = [1, 2];
    s.turn = 3; s.tick = 300;
    const e = Causes.emit(s, ev, 'regenerated', { who: 'you', hp: 5 }, cause);
    assert.equal(json(e), json({ k: 'regenerated', turn: 3, tick: 300, who: 'you', hp: 5, cause }));
    assert.equal(ev[0], e); assert.equal(s.causes.length, 0, 'regenerated is not recorded');
    const d = Causes.emit(s, ev, 'moved', { who: 'you', from, to: [2, 2] });
    from[0] = 9; cause.units = 9;
    assert.equal(json([d.from, e.cause.units]), json([[1, 2], 4]), 'copied');
    Causes.emit(s, ev, 'died', { who: 'x' }, { k: 'attack' });
    assert.equal(s.causes.length, 1); assert.equal(s.causes[0].k, 'died');
  });

  test('a refusal changes nothing and draws nothing, whatever its code, and every code has a sentence', () => {
    const cases = [];
    const add = (code, s, action, X) => cases.push({ code, s, action, X: X || C });
    add('visit_over', Object.assign(TestRoom.create(1), { over: { k: 'died', turn: 0, by: null, door: null, cause: {} } }), { a: 'wait' });
    const p = TestRoom.create(1); p.ui.pendingChoice = { k: 'seal', options: [] }; add('choice_pending', p, { a: 'wait' });
    add('unknown_action', TestRoom.create(1), { a: 'dance' });
    add('bad_direction', TestRoom.create(1), { a: 'move', dir: 8 });
    const col = ['#######', '#.o...#', '#.....#', '#######'];
    add('corner', room(C, col, [2, 2], [ex([3, 1], { mode: 'dormant' })]), { a: 'move', dir: 1 });
    add('corner', room(C, col, [2, 2], [ex([3, 1], { mode: 'dormant' })]), { a: 'attack', uid: 'T0.1.room.1' });
    add('blocked', room(C, OPEN, [1, 1]), { a: 'move', dir: 0 });
    add('no_target', TestRoom.create(1), { a: 'attack', uid: 'nobody' });
    add('out_of_reach', room(C, OPEN, [2, 2], [ex([4, 2])]), { a: 'attack', uid: 'T0.1.room.1' });
    const caseMap = ['#######', '#.....#', '#..v..#', '#.....#', '#######'];
    add('behind_glass', room(C, caseMap, [3, 1], [ex([3, 2], { mode: 'dormant' })]), { a: 'move', dir: 4 });
    add('behind_glass', room(C, caseMap, [3, 1], [ex([3, 2], { mode: 'dormant' })]), { a: 'attack', uid: 'T0.1.room.1' });
    add('behind_glass', room(C, caseMap, [3, 1]), { a: 'move', dir: 4 });
    const f = room(C, OPEN, [2, 2]); held(f.actors[0], 'fixed', 5); add('fixed', f, { a: 'move', dir: 2 });
    const r = room(C, OPEN, [2, 2]); held(r.actors[0], 'rooted', 5); add('rooted', r, { a: 'move', dir: 2 });
    // not_built, from a handler planted to refuse with it (no handler keeps it once Wave 1 is done).
    const P = loadCore(); P.Actions.get('wait').apply = () => 'not_built';
    add('not_built', P.TestRoom.create(1), { a: 'wait' }, P);
    add('no_use', TestRoom.create(1), { a: 'use', uid: 'nothing' });
    const seen = new Set();
    for (const c of cases) {
      const X = c.X, h = X.State.hash(c.s), rng = json(c.s.rng), ev = X.Step.step(c.s, c.action);
      assert.equal(ev.length, 1, c.code); assert.equal(ev[0].k, 'refused');
      assert.equal(ev[0].reason, c.code, key(c.action));
      assert.equal(X.State.hash(c.s), h, `${c.code}: the state changed`);
      assert.equal(json(c.s.rng), rng);
      assert.equal(X.Causes.check(ev[0]), null);
      const line = X.Text.event(ev[0]);
      assert.ok(X.Text.refusalDefined(c.code) && line && line !== c.code && /[.:]/.test(line), `${c.code}: ${line}`);
      seen.add(c.code);
    }
    for (const code of C.Registry.order('REFUSALS')) if (['visit_over', 'choice_pending', 'unknown_action', 'bad_direction', 'corner', 'blocked', 'no_target', 'out_of_reach', 'behind_glass', 'fixed', 'rooted', 'not_built', 'no_use'].includes(code)) assert.ok(seen.has(code), code);
  });

  // The backbone's refusal codes are proved here (§5.1): each entry names this file, and has
  // its invariant (test/behaviour/system.inv.js), which catches a refusal that comes with
  // other events, draws, or changes the state; each the real game can give is at true, made
  // to happen joined up in behaviour/refusals.test.js (W2a-BEHAVIOUR), and not_built, which
  // no M3 action gives, stays at 'unit'.
  test('the backbone refusal codes are proved here and joined up, with the system invariant, which catches a refusal that changes anything', () => {
    const BACKBONE = ['visit_over', 'choice_pending', 'unknown_action', 'bad_direction', 'corner', 'blocked', 'no_target', 'out_of_reach', 'not_built', 'no_use'];
    for (const code of BACKBONE) {
      const e = C.Registry.REFUSALS[code];
      const want = code === 'not_built' ? ['M3', 'unit', ['m3-backbone.test.js'], 'system'] : ['M3', true, ['m3-backbone.test.js', 'behaviour/refusals.test.js'], 'system'];
      assert.equal(json([e.built, e.ready, e.tests, e.inv]), json(want), code);
    }
    const Inv = require(path.join(root, 'tools/invariants.js'));
    const check = Inv.checker(C, Inv.select(C, ['system']));
    const s = TestRoom.create(1), pre = C.State.clone(s), ev = C.Step.step(s, { a: 'dance' });
    assert.equal(json(check(pre, { a: 'dance' }, ev, s)), '[]', 'a true refusal holds');
    const moved = C.State.clone(s); moved.actors[0].hp -= 1;
    assert.ok(check(pre, { a: 'dance' }, ev, moved).some(v => /changed the state/.test(v.text)), 'a refusal that changes the state');
    const drew = C.State.clone(s); C.Rng.stream(drew, 'combat/you').u32();
    assert.ok(check(pre, { a: 'dance' }, ev, drew).some(v => /drew on a stream/.test(v.text)), 'a refusal that draws');
    const more = ev.concat([{ k: 'waited', turn: 0, tick: 0, who: 'you', how: 'wait', cause: { k: 'action', how: 'wait' } }]);
    assert.ok(check(pre, { a: 'dance' }, more, s).some(v => /other event/.test(v.text)), 'a refusal with other events');
  });

  test('Combat.canStrike throws on a kind of blow nothing makes, so not_built comes only from a handler that returns it', () => {
    const s = room(C, OPEN, [2, 2], [ex([3, 2])]);
    assert.throws(() => C.Combat.canStrike(s, s.actors[0], s.actors[1], { kind: 'kick' }), /no blow of kind kick/);
    for (const kind of ['melee', 'reach', 'shot']) assert.notEqual(C.Combat.canStrike(s, s.actors[0], s.actors[1], { kind }), 'not_built', kind);
  });

  test('exhibits\' steps: never out of an intact case, never into a staff door, open or closed; yours go through staff doors', () => {
    const map = { w: 7, h: 5, tiles: ['#######', '#.v.S.#', '#..s..#', '#.u...#', '#######'] };
    for (let d = 0; d < 8; d++) assert.equal(Grid.canStep(map, 2, 1, d, 'exhibit'), false, `out of the case, dir ${d}`);
    assert.equal(Grid.canStep(map, 2, 1, 4), true, 'the step rule never looks at the tile you leave');
    assert.equal(Grid.canStep(map, 3, 1, 2, 'exhibit'), false, 'into S'); assert.equal(Grid.canStep(map, 3, 1, 2), true);
    assert.equal(Grid.canStep(map, 2, 2, 2, 'exhibit'), false, 'into s'); assert.equal(Grid.canStep(map, 2, 2, 2), true);
    assert.equal(Grid.canStep(map, 4, 3, 7, 'exhibit'), false, 'diagonally past s'); assert.equal(Grid.canStep(map, 4, 3, 7), true);
    assert.equal(Grid.canStep(map, 1, 3, 2, 'exhibit'), true, 'an opened case u is walkable');
    // The new tiles and flags (§8.3): u and s are walkable and see-through; hold covers walkable, v and p.
    assert.ok(Grid.walkable(map, 2, 3) && Grid.seeThrough(map, 2, 3) && Grid.walkable(map, 3, 2) && Grid.seeThrough(map, 3, 2) && Grid.TILES.s.staff && Grid.TILES.s.door);
    assert.ok(!Grid.TILES.u.loud && !Grid.walkable(map, 3, 2, 'exhibit'));
    const hold = Object.keys(Grid.TILES).filter(c => Grid.hold({ w: 1, h: 1, tiles: [c] }, 0, 0));
    assert.equal(hold.sort().join(''), Object.keys(Grid.TILES).filter(c => Grid.TILES[c].walk || c === 'v' || c === 'p').sort().join(''));
    assert.ok(Grid.closedDoor({ w: 2, h: 1, tiles: ['+S'] }, 0, 0) && Grid.closedDoor({ w: 2, h: 1, tiles: ['+S'] }, 1, 0) && !Grid.closedDoor(map, 3, 2));
    // A bolt passes what can be seen through and is not glass.
    for (const c of Object.keys(Grid.TILES)) assert.equal(Grid.bolt({ w: 1, h: 1, tiles: [c] }, 0, 0), !!Grid.TILES[c].see && c !== 'v', c);
    // An exhibit in a case never steps out, whatever it is told to do.
    const caseMap = ['#######', '#.....#', '#..v..#', '#.....#', '#######'];
    const s = room(C, caseMap, [1, 1], [ex([3, 2], { stats: { hp: 999, acc: 9, eva: 0, pad: 0, dmin: 1, dmax: 1 } })]);
    for (let i = 0; i < 20; i++) Step.step(s, { a: 'wait' });
    assert.equal(json([s.actors[1].x, s.actors[1].y]), json([3, 2]));
    s.actors[0].x = 3; s.actors[0].y = 1;
    const ev = []; for (let i = 0; i < 10; i++) ev.push(...Step.step(s, { a: 'wait' }));
    assert.ok(!ev.some(e => e.k === 'damaged' || e.k === 'attacked'), 'and never strikes out of it');
    for (let d = 0; d < 8; d++) assert.equal(Step.moveInto(s, s.actors[1], d, null), d === 0 ? 'behind_glass' : 'blocked', `dir ${d}`);
  });

  test('walking distance onto a tile you cannot step on, and line of sight blocked by a sight-blocking surface, symmetrically', () => {
    const m = { w: 7, h: 5, tiles: ['#######', '#.....#', '#..v..#', '#.....#', '#######'] };
    const d = Grid.distances(m, [[1, 1]], 20);
    assert.equal(d[2 * 7 + 3], -1);
    assert.equal(Grid.reachDist(d, m, 3, 2), 2, 'one beyond its nearest neighbour at distance 1');
    assert.equal(Grid.reachDist(d, m, 1, 1), 0);
    assert.equal(Grid.reachDist(Grid.distances(m, [[1, 1]], 0), m, 3, 2), -1, 'unreached');
    assert.ok(Grid.disc(2, 1, 2) && Grid.disc(0, 2, 2) && !Grid.disc(2, 2, 2) && !Grid.disc(3, 0, 2), 'dx² + dy² ≤ r² + r');
    const fog = { w: 9, h: 5, tiles: ['#########', '#.......#', '#.......#', '#.......#', '#########'], surfaces: [{ kind: 'dust', x: 4, y: 2, size: 1, until: 9, by: 'x' }] };
    assert.equal(Grid.los(fog, 1, 2, 7, 2), false, 'through the dust');
    assert.equal(Grid.los(fog, 1, 1, 7, 1), true, 'beside it');
    assert.equal(Grid.los(fog, 4, 2, 7, 2), true, 'from inside: endpoints never block');
    fog.surfaces[0].size = 3;
    assert.equal(Grid.los(fog, 1, 1, 7, 1), false, 'a 3×3 square covers the row above');
    assert.ok(Grid.covers(fog.surfaces[0], 3, 1) && Grid.covers(fog.surfaces[0], 5, 3) && !Grid.covers(fog.surfaces[0], 6, 2));
    for (let y0 = 1; y0 < 4; y0++) for (let x0 = 1; x0 < 8; x0++) for (let y1 = 1; y1 < 4; y1++) for (let x1 = 1; x1 < 8; x1++)
      assert.equal(Grid.los(fog, x0, y0, x1, y1), Grid.los(fog, x1, y1, x0, y0), `asymmetric ${x0},${y0}-${x1},${y1}`);
    fog.surfaces[0].kind = 'planted_puddle';
    assert.equal(Grid.los(fog, 1, 2, 7, 2), true, 'a surface not in the registry, or not sight-blocking, does not block');
  });

  test('noise carries its class\'s walking distance, 3 more through a closed door, and is heard by each exhibit in reach in spawn order', () => {
    const m = { w: 11, h: 3, tiles: ['###########', '#....+....#', '###########'] };
    const r = Noise.reach(m, 1, 1, 20);
    assert.equal(r[1 * 11 + 4], 3); assert.equal(r[1 * 11 + 5], 4 + N.NOISE_DOOR, 'into the door'); assert.equal(r[1 * 11 + 6], 5 + N.NOISE_DOOR);
    const open = { w: 11, h: 3, tiles: ['###########', "#....'....#", '###########'] };
    assert.equal(Noise.reach(open, 1, 1, 20)[1 * 11 + 6], 5, 'an open door adds nothing');
    const staff = { w: 11, h: 3, tiles: ['###########', '#....S....#', '###########'] };
    assert.equal(Noise.reach(staff, 1, 1, 20)[1 * 11 + 6], 5 + N.NOISE_DOOR, 'a closed staff door counts as a door');
    // Who hears: within range by walking distance, one beyond a neighbour into a case; not
    // the gone; in spawn order.
    const X = loadCore(), heard = [];
    X.Wake.hear = (state, a, noise, dist) => heard.push(`${a.uid}:${dist}:${noise.cls}:${noise.range}:${noise.by}`);
    const map = ['##########', '#........#', '#..v.....#', '#........#', '##########'];
    const s = room(X, map, [1, 1], [ex([4, 1], { mode: 'dormant' }), ex([3, 2], { mode: 'dormant' }), ex([8, 3], { mode: 'dormant' }), ex([2, 3], { mode: 'dormant' })]);
    s.actors[4].gone = 1;
    const ev = [];
    X.Noise.emit(s, 1, 1, 'soft', { k: 'attack', by: 'you' }, ev);
    assert.equal(json(heard), json(['T0.1.room.1:3:soft:3:you', 'T0.1.room.2:2:soft:3:you']));
    assert.equal(json(ev.map(e => [e.k, e.x, e.y, e.cls, e.range, e.cause.k])), json([['noise', 1, 1, 'soft', N.NOISE_SOFT, 'attack']]));
    heard.length = 0; X.Noise.emit(s, 1, 1, 'crash', { k: 'attack', by: 'x' }, []);
    assert.equal(heard.length, 3, 'the crash reaches the far one too');
    assert.throws(() => X.Noise.emit(s, 1, 1, 'whisper', { k: 'attack' }, []), /no noise class whisper/);
  });

  test('one blow, in order: attacked, the roll or surprise, damage and its wake, death, and the blow\'s noise last', () => {
    const s = room(C, OPEN, [2, 2], [ex([3, 2], { mode: 'dormant', stats: { hp: 3, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } })]);
    const uid = s.actors[1].uid;
    s.rng['ai/' + uid] = 5;
    const ev = Step.step(s, { a: 'move', dir: 2 });
    assert.equal(json(ev.map(e => e.k)), json(['attacked', 'damaged', 'woke', 'hunting', 'died', 'noise', 'noise']));
    const [att, dmg, woke, hunt, , loud, soft] = ev;
    assert.equal(json([woke.was, woke.mode, woke.cause.k]), json(['dormant', 'hunting', 'damage']), 'a sleeper struck wakes, then hunts');
    assert.equal(json([att.by, att.at, att.how, att.cause.dist]), json(['you', uid, { kind: 'melee' }, 1]));
    assert.equal(json([dmg.cause.from, dmg.cause.surprise, dmg.cause.how]), json([[2, 2], 1, { kind: 'melee' }]));
    assert.equal(json([hunt.cause.k, hunt.cause.by, hunt.cause.dist]), json(['damage', 'you', 1]));
    assert.equal(json([loud.cls, loud.x, loud.y, loud.cause.k]), json(['loud', 3, 2, 'destroyed']));
    assert.equal(json([soft.cls, soft.x, soft.y, soft.cause.k, soft.cause.by]), json(['soft', 2, 2, 'attack', 'you']), 'the noise of the blow, at the attacker, last');
    assert.ok(!('ai/' + uid in s.rng) && !('combat/' + uid in s.rng), 'its streams are deleted at its death');
    // The determinism contract says so (§3.2, Storage), since it changes state.rng's keys.
    const storage = require('node:fs').readFileSync(path.join(root, 'BUILD.md'), 'utf8').split('\n').find(l => l.startsWith('- **Storage.**'));
    assert.ok(/When an actor is destroyed, its own `combat\/` and `ai\/` streams are deleted/.test(storage), `§3.2 does not say a destroyed actor's streams are deleted: ${storage}`);
    // A miss: attacked, missed, noise.
    const m = room(C, OPEN, [2, 2], [ex([3, 2], { stats: { hp: 99, acc: 0, eva: 99, pad: 0, dmin: 1, dmax: 1 } })]);
    m.actors[1].next = 999;
    const mv = Step.step(m, { a: 'attack', uid: m.actors[1].uid });
    assert.equal(json(mv.map(e => e.k)), json(['attacked', 'missed', 'noise']));
    assert.equal(json(Object.keys(mv[1].cause).sort()), json(['at', 'by', 'chance', 'how', 'k', 'roll']));
    // Invulnerable: your health stays at 1, and the cause says so; dying ends the visit with its cause.
    const hit = { hp: 99, acc: 99, eva: 0, pad: 0, dmin: 50, dmax: 50 };
    const until = (s, k) => { for (let i = 0; i < 30; i++) { const e = Step.step(s, { a: 'wait' }).find(x => x.k === k); if (e) return e; } return null; };
    const inv = room(C, OPEN, [2, 2], [ex([3, 2], { stats: hit })], { invulnerable: true });
    const iv = until(inv, 'damaged');
    assert.equal(json([iv.hp, iv.cause.saved, inv.actors[0].hp, inv.over]), json([1, 1, 1, null]));
    const mortal = room(C, OPEN, [2, 2], [ex([3, 2], { stats: hit })]);
    until(mortal, 'died');
    assert.equal(json([mortal.over.k, mortal.over.by, mortal.over.door, mortal.over.cause.raw]), json(['died', 'T0.1.room.1', null, 50]));
    assert.ok(mortal.causes.some(c => c.k === 'died' && c.who === 'you'));
  });

  test('archetype and modifier hooks: the archetype first, then modifiers in order, skipping one switched off', () => {
    const X = loadCore(), R = X.Registry, A = X.Archetypes, log = [];
    R.define('ARCHETYPES', 'planted_arch', {}); R.define('MODIFIERS', 'planted_a', {}); R.define('MODIFIERS', 'planted_b', {});
    A.add('planted_arch', { costPct: () => 50, adjustDamage: (st, d, n) => { log.push('arch'); return n + 1; }, onDied: () => log.push('died:arch'), act: () => null });
    A.addModifier('planted_a', { costPct: () => 50, adjustDamage: (st, d, n) => { log.push('a'); return n * 2; }, act: () => 70, pipless: () => true });
    A.addModifier('planted_b', { adjustDamage: (st, d, n) => { log.push('b'); return n * 3; }, act: () => 90, mayStep: () => false, readout: () => [{ k: 'b' }] });
    assert.throws(() => A.add('planted_arch', {}), /added twice/);
    assert.throws(() => A.add('no_such_arch', {}), /not in Registry\.ARCHETYPES/);
    assert.throws(() => A.addModifier('planted_c', {}), /not in Registry\.MODIFIERS/);
    R.define('MODIFIERS', 'planted_c', {});
    assert.throws(() => A.addModifier('planted_c', { onHit: () => 0 }), /no hook called onHit/);
    const s = room(X, OPEN, [2, 2], [ex([5, 2], { arch: 'planted_arch', mods: ['planted_a', 'planted_b'] })]), a = s.actors[1];
    assert.equal(A.adjustDamage(s, a, 2, {}), ((2 + 1) * 2) * 3); assert.equal(log.join(), 'arch,a,b');
    assert.equal(A.costPct(s, a, 'move'), 25); assert.equal(X.Actors.cost(s, a, 100, 'move'), 25);
    assert.equal(A.act(s, a, []), 70, 'the first that is not null');
    assert.equal(A.mayStep(s, a, 1, 1), false); assert.equal(A.pipless(s, a), true);
    assert.equal(json(A.readout(s, a, s.actors[0])), json([{ k: 'b' }]));
    assert.equal(json(A.speedApplies(s, a)), json(['move']), 'steps only, by default');
    s.options.rulesOff.push('planted_a');
    log.length = 0;
    assert.equal(A.adjustDamage(s, a, 2, {}), (2 + 1) * 3); assert.equal(log.join(), 'arch,b');
    assert.equal(A.act(s, a, []), 90); assert.equal(A.pipless(s, a), false); assert.equal(A.costPct(s, a, 'act'), 50);
    // Defaults for an actor whose archetype registered nothing, and for you.
    const plain = s.actors[0];
    assert.equal(json([A.act(s, plain, []), A.present(s, plain), A.mayStep(s, plain, 1, 1), A.costPct(s, plain, 'act'), A.adjustDamage(s, plain, 4, {}), A.pipless(s, plain), A.readout(s, plain, plain)]),
      json([null, null, true, 100, 4, false, []]));
    assert.equal(X.Options.off(s, 'planted_a'), true); assert.equal(X.Options.off(s, 'planted_b'), false);
    assert.equal(json(X.Options.make()), json({ rulesOff: [], without: [], invulnerable: false }));
    assert.equal(json(X.Options.make({ rulesOff: ['x'], invulnerable: 1 })), json({ rulesOff: ['x'], without: [], invulnerable: true }));
  });

  // A stub's contract is its name and signature until its owner fills it; only the M4 hooks
  // stay neutral through M3 (plan A17), each checked on its own line, by owner.
  test('the M4 hooks are present and neutral; the stubs Wave 1 fills are present, with their signatures', () => {
    const X = loadCore(), s = TestRoom.create(1), ev = [], h = State.hash(s), a = s.actors[1];
    // M4 hooks, by owner: Modules (system).
    X.Modules.onEvent(s, { k: 'waited', turn: 0, tick: 0, who: 'you', how: 'wait' }, ev); X.Modules.alarmDecay(s, ev); X.Modules.turn(s, ev);
    assert.equal(State.hash(s), h, 'Modules: onEvent, alarmDecay and turn change nothing'); assert.equal(ev.length, 0);
    // W1-COMBAT's file: Health.onLow (Second Wind).
    X.Health.onLow(s, s.actors[0], ev);
    assert.equal(State.hash(s), h, 'Health.onLow changes nothing'); assert.equal(ev.length, 0);
    // Wave 1 stubs and refinable impls: present and named; the number of arguments is checked
    // where the review set a signature that parallel packages call (null: not checked).
    const NAMED = [
      ['Surfaces', 'tick', null], ['ClockRules', 'boundary', null], ['Kit', 'recharge', null], ['Wake', 'hear', null], ['Wake', 'allyHit', null], ['Wake', 'decay', null],
      ['Kit', 'ringDelta', null], ['Kit', 'useLegal', null], ['Kit', 'useAction', null], ['Kit', 'useCandidates', 1],
      ['Consumables', 'useLegal', null], ['Consumables', 'useAction', null], ['Consumables', 'useCandidates', 1],
      ['Combat', 'reachTargets', null], ['Health', 'maxHp', null], ['Health', 'heal', null], ['Health', 'interval', null],
      ['Status', 'effects', 2], ['Noise', 'hold', 1], ['Archetypes', 'speedApplies', 2],
    ];
    for (const [ns, fn, n] of NAMED) {
      assert.equal(typeof X[ns][fn], 'function', `${ns}.${fn}`);
      if (n !== null) assert.equal(X[ns][fn].length, n, `${ns}.${fn} takes ${n} arguments`);
    }
    assert.equal(X.Health.interval(20), 20); assert.equal(X.Health.interval(150), N.REGEN_MIN);
    // A step reaches Modules.onEvent once for each event, after it is pushed.
    const seen = [];
    X.Modules.onEvent = (state, e, list) => seen.push(list[list.length - 1] === e ? e.k : 'not last');
    const out = X.Step.step(X.TestRoom.create(1), { a: 'wait' });
    assert.equal(json(seen), json(out.map(e => e.k)));
  });
};
