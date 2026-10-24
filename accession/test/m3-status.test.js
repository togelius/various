// W1-STATUS: statuses and surfaces (BUILD.md §8.1, §8.6). The status timing rule as a table
// (Fixative after 100-, 150-, 200- and 300-tick actions; the mimic's grip after an open, a
// bash and a Heavy bash; a status put on twice in one action), each status's effect (a
// cough's noises, restoring's healing, also when put on again, the fixed, slowed and dazed
// numbers), statuses on exhibits (Fixative calling off a pending mark), a cloud that blocks
// sight both ways with the ring still equal to the pips, Fumigant's pips (a 2×2 body partly
// under the cloud too), dust's expiry, the registry entries and sentences (a status ends in
// the words it began with), and the invariants of test/behaviour/status.inv.js catching
// planted faults (a fixed exhibit's own step while the pole moves it among them).
// Expected figures are worked out here from BUILD.md's text, never read from the rule code.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const C = loadCore();
  const { N, Registry: R, Text, Clauses, Packs } = C;
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const json = x => JSON.stringify(x);
  const floor = (a, b) => Math.floor(a / b);
  const OPEN = ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#########'];
  const WIDE = ['###############', '#.............#', '#.............#', '#.............#', '#.............#', '#.............#',
    '#.............#', '#.............#', '###############'];
  // Two rooms with no way between: nothing in the right one is in your ring or hears you.
  const APART = ['###############', '#.....#.......#', '#.....#.......#', '#.....#.......#', '#.....#.......#', '###############'];
  const stats = o => Object.assign({ hp: 50, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 }, o);
  const ex = (at, extra) => Object.assign({ sp: 'dummy', at, mode: 'dormant', stats: stats() }, extra);
  const room = (X, map, you, exhibits, extra, options) => X.Setup.room(1, Object.assign({ acc: 'T0', depth: 1, map, you, exhibits: exhibits || [] }, extra), options);
  const of = (ev, k, f) => ev.filter(e => e.k === k && (!f || f(e)));

  // A wait that costs `cost` ticks and puts statuses on, or lays surfaces, at its end: the
  // core's wait, patched in this context only. Its action is {a: 'wait', cost?, mark?: uid,
  // put?: [{who, id, turns, cause?}], lay?: [{kind, size, turns}]} (a surface laid on your
  // tile); the exhibit `mark` first marks its archetype's special (Specials.mark).
  function plant(X) {
    const h = X.Actions.get('wait'), orig = h.apply;
    h.apply = (state, action, ev) => {
      const c = orig(state, action, ev), you = state.actors[0];
      if (action.mark) {
        const a = X.Actors.byUid(state, action.mark), id = R.ARCHETYPES[a.arch].special;
        X.Specials.mark(state, a, id, X.Specials.tiles(state, a, R.SPECIALS[id].shape), ev);
      }
      for (const p of action.put || []) X.Status.apply(state, X.Actors.byUid(state, p.who), p.id, p.turns, p.cause || { k: 'status', id: p.id }, ev);
      for (const l of action.lay || []) X.Surfaces.add(state, l.kind, you.x, you.y, l.size, l.turns, 'you', ev);
      return action.cost === undefined ? c : action.cost;
    };
    return X;
  }
  const put = (cost, who, id, turns, cause) => ({ a: 'wait', cost, put: [{ who, id, turns, cause }] });

  // Restoring heals through Health.heal (W1-COMBAT's). While that is still Wave 0's stub, which
  // heals nothing, a stand-in that heals up to the maximum and says so is used in this context.
  function healing(X) {
    if (!/^function heal\([^)]*\)\s*\{\s*return 0;\s*\}$/.test(String(X.Health.heal))) return 'built';
    X.Health.heal = (state, who, n, cause, ev) => {
      const amount = Math.min(n, who.maxHp - who.hp);
      if (amount <= 0) return 0;
      who.hp += amount;
      X.Causes.emit(state, ev, 'healed', { who: who.uid, amount, hp: who.hp }, cause);
      return amount;
    };
    return 'stand-in';
  }

  test('status timing: Fixative after a 100-, 150-, 200- or 300-tick action gives exactly 4 forced waits, then ends with its sentence', () => {
    for (const cost of [100, 150, 200, 300]) {
      const X = plant(loadCore()), s = room(X, OPEN, [2, 2]), you = s.actors[0];
      const ev = X.Step.step(s, put(cost, 'you', 'fixed', N.FIXATIVE_TURNS));
      const on = of(ev, 'status', e => e.id === 'fixed')[0];
      assert.equal(json([on.who, on.on, on.turns]), json(['you', true, N.FIXATIVE_TURNS]));
      assert.equal(X.Text.event(on), `You are now fixed in place for ${N.FIXATIVE_TURNS} turns.`);
      // Your next decision is at `cost`, in turn floor(cost / 100): the 4 turns from there.
      const first = floor(cost, 100), st = you.statuses[0];
      assert.equal(json([st.from, st.until, st.turns]), json([first, first + N.FIXATIVE_TURNS, null]), `after ${cost}`);
      assert.equal(X.Status.left(s, you, 'fixed'), N.FIXATIVE_TURNS);
      const forced = [];
      let off = null;
      while (!X.Step.legal(s).some(a => a.a === 'move')) {
        assert.equal(X.Step.step(X.State.clone(s), { a: 'move', dir: 2 })[0].reason, 'fixed');
        assert.equal(X.Text.refusal('fixed'), 'You are fixed in place: you can only wait.');
        forced.push(s.tick);
        const e = X.Step.step(s, { a: 'wait' });
        off = of(e, 'status', x => x.id === 'fixed' && !x.on)[0] || off;
        assert.ok(forced.length < 9);
      }
      assert.equal(json(forced), json([0, 1, 2, 3].map(i => cost + 100 * i)), `after ${cost}: forced at ${forced}`);
      assert.equal(json([off.turn, off.until]), json([first + N.FIXATIVE_TURNS, first + N.FIXATIVE_TURNS]), 'it ends at the boundary of the turn after its last');
      assert.equal(X.Text.event(off), 'You are no longer fixed in place.');
      assert.equal(X.Status.left(s, you, 'fixed'), 0);
    }
  });

  test('status timing: the mimic\'s grip (rooted 2) after an open (200), a bash (100) or a Heavy bash (150) holds your next two turns\' moves only', () => {
    const DOOR = ['#######', '#.....#', '#.v+..#', '#.....#', '#######'];
    for (const [act, cost] of [['open', N.COST_OPEN_CASE], ['bash', N.COST_BASH], ['bash', N.COST_BASH_HEAVY]]) {
      const X = loadCore();
      // The case's own rules are W1-CASES': the open or bash is planted here, gripping you at its end.
      // The grip names its mimic; the actor beside you is a plain hunter, so the blow below lands.
      const s = room(X, DOOR, [3, 1], [ex([4, 1], { mode: 'hunting', stats: stats({ acc: -99 }) })]), you = s.actors[0], mimic = 'S9.1.room.5';
      X.Actions.get(act).apply = (state, action, ev) => { X.Status.apply(state, you, 'rooted', N.MIMIC_GRIP_TURNS, { k: 'grip', by: mimic }, ev); return cost; };
      const ev = X.Step.step(s, { a: act, x: 2, y: 2 });
      assert.ok(of(ev, 'status', e => e.id === 'rooted' && e.on && e.turns === N.MIMIC_GRIP_TURNS && e.cause.k === 'grip').length === 1, json(ev));
      let held = 0;
      for (;;) {
        const steps = X.Step.legal(s).filter(a => a.a === 'move' && [0, 6, 7].includes(a.dir));
        if (steps.length) break;
        held++;
        assert.equal(X.Step.step(X.State.clone(s), { a: 'move', dir: 6 })[0].reason, 'rooted');
        assert.equal(X.Text.refusal('rooted'), 'You are rooted to the spot: you cannot step off this tile.');
        // A bump that leaves you where you are is still yours: the door opens, the blow is
        // struck, and a bump into the case is refused for its own reason (glass), not as rooted.
        const d = X.State.clone(s), dv = X.Step.step(d, { a: 'move', dir: 4 });
        assert.ok(of(dv, 'opened').length && d.actors[0].x === 3 && d.actors[0].y === 1, 'the door opens and you stay');
        const b = X.State.clone(s), bv = X.Step.step(b, { a: 'move', dir: 2 });
        assert.ok(of(bv, 'attacked', e => e.by === 'you').length && b.actors[0].x === 3, 'the blow is struck and you stay');
        const glass = X.Step.step(X.State.clone(s), { a: 'move', dir: 5 })[0];
        assert.ok(glass.k === 'refused' && glass.reason !== 'rooted', json(glass));
        X.Step.step(s, { a: 'wait' });
        assert.ok(held < 6);
      }
      assert.equal(held, N.MIMIC_GRIP_TURNS, `after a ${cost}-tick ${act}`);
      assert.ok(of(X.Step.step(s, { a: 'move', dir: 6 }), 'moved').length, 'free again');
    }
  });

  test('coughing: exactly 5 soft noises at your tile, one at each of the boundaries of your next 5 turns, after the ring', () => {
    for (const cost of [100, 150, 200, 300]) {
      const X = plant(loadCore()), s = room(X, WIDE, [6, 4], [ex([12, 1])]), you = s.actors[0], all = [];
      all.push(...X.Step.step(s, put(cost, 'you', 'coughing', N.COUGH_TURNS)));
      for (let i = 0; i < 10; i++) {
        if (i === 3) { all.push(...X.Step.step(s, { a: 'move', dir: 2 })); continue; }
        all.push(...X.Step.step(s, { a: 'wait' }));
      }
      const coughs = of(all, 'noise', e => e.cause.k === 'cough');
      const first = floor(cost, 100);
      assert.equal(json(coughs.map(e => e.turn)), json([0, 1, 2, 3, 4].map(i => first + i)), `after ${cost}`);
      assert.ok(coughs.every(e => e.cls === 'soft' && e.range === N.NOISE_SOFT && e.cause.by === 'you'));
      assert.ok(coughs.every(e => e.tick === e.turn * 100), 'at turn boundaries');
      assert.equal(X.Text.event(coughs[0]), `You cough: a soft noise, heard ${N.NOISE_SOFT} tiles away.`);
      assert.ok(!you.statuses.length && of(all, 'status', e => e.id === 'coughing' && !e.on).length === 1);
    }
    // At its tile at that boundary: a cough after a step is heard from the tile you stepped to.
    const X = plant(loadCore()), s = room(X, WIDE, [6, 4]);
    X.Step.step(s, put(100, 'you', 'coughing', 2));
    const ev = X.Step.step(s, { a: 'move', dir: 2 });
    assert.equal(json(of(ev, 'noise').map(e => [e.x, e.y, e.cause.k])), json([[7, 4, 'cough']]));
    // Within a boundary the cough comes after the wake checks: a sleeper in your ring gains its ring pip first.
    const Y = plant(loadCore()), t = room(Y, WIDE, [6, 4], [ex([7, 4])]);
    const evs = Y.Step.step(t, put(100, 'you', 'coughing', 1)).concat(Y.Step.step(t, { a: 'wait' }));
    const order = evs.filter(e => (e.k === 'pip' || e.k === 'noise') && e.turn === 1).map(e => e.k + ':' + e.cause.k);
    assert.ok(order.includes('pip:ring') && order.indexOf('pip:ring') < order.indexOf('noise:cough'), json(order));
  });

  test('restoring: 25% of maximum health over 5 turns, a share each turn within 1 of the others, summing to the total, never past full health', () => {
    const X = plant(loadCore()), how = healing(X);
    let checked = 0;
    for (let max = 4; max <= 160; max += 3) {
      const s = room(X, OPEN, [2, 2]), you = s.actors[0];
      you.maxHp = max; you.hp = 1;
      const all = X.Step.step(s, put(150, 'you', 'restoring', N.CONSOLIDANT_HOT_TURNS));
      for (let i = 0; i < 8; i++) all.push(...X.Step.step(s, { a: 'wait' }));
      const heals = of(all, 'healed', e => e.cause.k === 'status' && e.cause.id === 'restoring');
      const total = floor(max * N.CONSOLIDANT_HOT_PCT, 100), first = 1;
      const byTurn = [0, 1, 2, 3, 4].map(i => heals.filter(e => e.turn === first + i).reduce((n, e) => n + e.amount, 0));
      assert.equal(byTurn.reduce((a, b) => a + b, 0), total, `max ${max}: ${json(byTurn)} (${how})`);
      assert.equal(heals.length, byTurn.filter(n => n > 0).length, 'one healing a turn, and none for nothing');
      assert.ok(Math.max(...byTurn) - Math.min(...byTurn) <= 1, `max ${max}: ${json(byTurn)}`);
      assert.ok(heals.every(e => e.who === 'you' && e.turn >= first && e.turn < first + 5 && e.hp <= max));
      checked++;
    }
    assert.ok(checked > 40);
    // Never past full health: two short of it, it heals 2 and stops.
    const s = room(X, OPEN, [2, 2]), you = s.actors[0];
    you.maxHp = 80; you.hp = 78;
    const all = X.Step.step(s, put(100, 'you', 'restoring', N.CONSOLIDANT_HOT_TURNS));
    for (let i = 0; i < 6; i++) all.push(...X.Step.step(s, { a: 'wait' }));
    const heals = of(all, 'healed', e => e.cause.k === 'status'), healed = heals.reduce((n, e) => n + e.amount, 0);
    assert.ok(healed >= 1 && healed <= 2 && heals.every(e => e.hp <= 80), json(heals));
    assert.equal(you.hp, 80);
    assert.equal(X.Text.event(heals[0]), `You healed ${heals[0].amount} while recovering health: health ${heals[0].hp}.`);
    // Put on again while held, it lasts to the later end from the same start and heals at the
    // same rate: every 5 turns in a row of the longer course heal exactly the total, at
    // maxima whose shares differ (87: 21 in all, as 4, 4, 4, 4 and 5) as at one whose do not.
    for (const max of [87, 133, 47, 100]) {
      const t = room(X, OPEN, [2, 2]), me = t.actors[0];
      me.maxHp = max; me.hp = 1;
      const ev2 = X.Step.step(t, put(100, 'you', 'restoring', 5));
      for (let i = 0; i < 2; i++) ev2.push(...X.Step.step(t, { a: 'wait' }));
      ev2.push(...X.Step.step(t, put(100, 'you', 'restoring', 5)));
      assert.equal(json([me.statuses[0].from, me.statuses[0].until]), json([1, 9]), 'from turn 1; again in turn 3, so to turn 4 + 5');
      for (let i = 0; i < 8; i++) ev2.push(...X.Step.step(t, { a: 'wait' }));
      const rate = of(ev2, 'healed', e => e.cause.k === 'status'), total = floor(max * N.CONSOLIDANT_HOT_PCT, 100);
      assert.equal(json(rate.map(e => e.turn)), json([1, 2, 3, 4, 5, 6, 7, 8]), `max ${max}`);
      const shares = rate.map(e => e.amount);
      for (let k = 0; k + 5 <= shares.length; k++) assert.equal(shares.slice(k, k + 5).reduce((a, b) => a + b, 0), total, `max ${max}: turns ${k + 1}–${k + 5} of ${json(shares)}`);
      assert.ok(Math.max(...shares) - Math.min(...shares) <= 1, `max ${max}: ${json(shares)}`);
    }
    assert.equal(X.Status.restoreShare(100, 0) + X.Status.restoreShare(100, 4), 10);
  });

  test('a status put on twice in one action covers the longer of the two, from its bearer\'s next decision', () => {
    for (const [first, second] of [[4, 2], [2, 4], [3, 3]]) {
      const X = plant(loadCore()), s = room(X, OPEN, [2, 2]), you = s.actors[0];
      const ev = X.Step.step(s, { a: 'wait', put: [{ who: 'you', id: 'fixed', turns: first }, { who: 'you', id: 'fixed', turns: second }] });
      assert.equal(json(of(ev, 'status').map(e => [e.id, e.on, e.turns])), json([['fixed', true, first], ['fixed', true, second]]));
      assert.equal(you.statuses.length, 1, 'one record');
      const st = you.statuses[0], longer = Math.max(first, second);
      assert.equal(json([st.from, st.until]), json([1, 1 + longer]), `${first} then ${second}`);
      let waits = 0;
      while (!X.Step.legal(s).some(a => a.a === 'move')) { X.Step.step(s, { a: 'wait' }); waits++; assert.ok(waits < 9); }
      assert.equal(waits, longer, `${first} then ${second}: ${waits} forced waits`);
    }
  });

  test('statuses on exhibits: a fixed slow exhibit makes 2 forced waits, 400 ticks in all; a sleeping one\'s turns start at the next boundary', () => {
    const X = plant(loadCore());
    const s = room(X, OPEN, [2, 2], [ex([3, 2], { mode: 'hunting', stats: stats({ acc: 99 }), statuses: [{ id: 'slowed', turns: 30 }] })]), a = s.actors[1];
    const acts = [], act = X.AI.act;
    X.AI.act = (state, who, ev) => { const fixed = X.Status.has(who, 'fixed'), r = act(state, who, ev); if (who === a) acts.push([state.tick, fixed, r]); return r; };
    const all = X.Step.step(s, put(100, a.uid, 'fixed', N.FIXATIVE_TURNS));
    assert.equal(json([a.statuses[1].from, a.statuses[1].until]), json([0, N.FIXATIVE_TURNS]), 'its next decision is at 0: turns 0–3');
    while (s.tick < 600) all.push(...X.Step.step(s, { a: 'wait' }));
    const fixedActs = acts.filter(x => x[1]);
    assert.equal(json(fixedActs), json([[0, true, 200], [200, true, 200]]), json(acts));
    assert.equal(fixedActs.reduce((n, x) => n + x[2], 0), 400);
    assert.ok(!of(all, 'attacked', e => e.by === a.uid && e.tick < 400).length && a.x === 3, 'no blow and no step while fixed');
    assert.ok(of(all, 'attacked', e => e.by === a.uid && e.tick === 400).length === 1, 'it strikes once free');
    // A sleeping exhibit fixed in turn 3 is fixed for turns 4–7, whenever it wakes: woken in
    // turn 5, it first acts at 600, after its beat, and waits in turns 6 and 7.
    const Y = plant(loadCore()), t = room(Y, APART, [1, 2], [ex([10, 2], { stats: stats({ acc: 99 }) })]), b = t.actors[1];
    for (let i = 0; i < 3; i++) Y.Step.step(t, { a: 'wait' });
    Y.Step.step(t, put(100, b.uid, 'fixed', N.FIXATIVE_TURNS));
    assert.equal(json([b.statuses[0].from, b.statuses[0].until]), json([4, 4 + N.FIXATIVE_TURNS]));
    assert.equal(Y.Status.left(t, b, 'fixed'), N.FIXATIVE_TURNS);
    Y.Step.step(t, { a: 'wait' });
    Y.Wake.wake(t, b, 'hunting', { k: 'damage', by: 'you', dist: 9 }, []);
    const waits = [], bact = Y.AI.act;
    Y.AI.act = (state, who, ev) => { if (who === b) waits.push([state.turn, Y.Status.has(b, 'fixed')]); return bact(state, who, ev); };
    for (let i = 0; i < 6; i++) Y.Step.step(t, { a: 'wait' });
    assert.equal(json(waits.filter(w => w[1]).map(w => w[0])), json([6, 7]), json(waits));
    assert.equal(waits.find(w => !w[1])[0], 8);
  });

  test('Fixative on an exhibit with a mark pending calls the mark off at once, in the action that fixed it, and the mark never goes off', () => {
    for (const [arch, at] of [['axis_sniper', [7, 2]], ['tethered_warden', [3, 2]], ['herald', [5, 3]]]) {
      // Its next decision is at 150, after yours at 100: the mark is called off at once all the same.
      const X = plant(loadCore()), s = room(X, OPEN, [2, 2], [ex(at, { mode: 'hunting', arch, next: 150, stats: stats({ acc: 99, hp: 999 }) })], {}, { invulnerable: true }), a = s.actors[1];
      const ev = X.Step.step(s, { a: 'wait', mark: a.uid, put: [{ who: a.uid, id: 'fixed', turns: N.FIXATIVE_TURNS }] });
      const ks = ev.filter(e => e.who === a.uid && ['telegraphed', 'status', 'special'].includes(e.k)).map(e => e.k + (e.cancelled ? ':cancelled' : ''));
      assert.equal(json(ks.slice(0, 3)), json(['telegraphed', 'status', 'special:cancelled']), `${arch}: ${json(ks)}`);
      const cancel = of(ev, 'special', e => e.cancelled)[0];
      assert.equal(json([cancel.sp, cancel.cause.k, cancel.cause.why]), json([R.ARCHETYPES[arch].special, 'cancel', 'fixed']));
      assert.ok(!a.telegraph && !X.Specials.marks(s).length && !ev.some(e => e.who === a.uid && e.k === 'waited'), `${arch}: no mark is held or shown, before it has had a turn`);
      // While it is fixed nothing goes off (once free, it may mark again).
      const all = ev.slice();
      while (!of(all, 'status', e => e.who === a.uid && !e.on).length) { all.push(...X.Step.step(s, { a: 'wait' })); assert.ok(all.length < 500); }
      const held = all.slice(0, all.findIndex(e => e.k === 'status' && e.who === a.uid && !e.on));
      assert.ok(!of(held, 'special', e => !e.cancelled).length && !of(held, 'damaged', e => e.cause.k === 'special').length, `${arch}: the mark never went off`);
    }
  });

  test('slowed doubles every action\'s cost; dazed takes 20 off the bearer\'s chance to hit; blows against a fixed target gain 20', () => {
    const X = loadCore();
    const s = room(X, OPEN, [2, 2], [ex([4, 2], { mode: 'hunting', stats: stats({ eva: 0, hp: 999 }), statuses: [{ id: 'slowed', turns: 9 }] })], { youStatuses: [{ id: 'slowed', turns: 3 }] });
    const you = s.actors[0], a = s.actors[1];
    X.Step.step(s, { a: 'wait' });
    assert.equal(you.next, 2 * N.COST_WAIT, 'your wait takes 200');
    assert.equal(X.Actors.cost(s, a, N.COST_STEP, 'move'), N.COST_STEP * N.SPEED_SLOW_PCT / 100);
    assert.equal(X.Actors.cost(s, a, N.COST_ATTACK, 'act'), N.COST_ATTACK * N.SPEED_SLOW_PCT / 100);
    // Your Acc is 3 (§8.1); its Eva 0: 75 + 15 = 90, dazed 70; at Eva 4, 70, and +20 fixed, 90.
    const chance = (dazed, fixed, eva) => {
      const Y = loadCore(), t = room(Y, OPEN, [2, 2], [ex([3, 2], { mode: 'hunting', stats: stats({ eva, hp: 999 }), statuses: fixed ? [{ id: 'fixed', turns: 4 }] : [] })],
        { youStatuses: dazed ? [{ id: 'dazed', turns: 4 }] : [] });
      const ev = Y.Step.step(t, { a: 'attack', uid: t.actors[1].uid }), e = ev.find(x => (x.k === 'damaged' || x.k === 'missed') && x.cause.by === 'you');
      return e.cause.chance;
    };
    assert.equal(json([chance(false, false, 0), chance(true, false, 0), chance(false, false, 4), chance(false, true, 4), chance(true, true, 4)]),
      json([90, 90 + N.HIT_DAZED_ATTACKER, 70, 70 + N.HIT_FIXED_TARGET, 70 + N.HIT_FIXED_TARGET + N.HIT_DAZED_ATTACKER]));
    assert.ok(X.Status.harmful('slowed') && X.Status.harmful('dazed') && X.Status.harmful('fixed') && X.Status.harmful('rooted') && X.Status.harmful('coughing') && !X.Status.harmful('restoring'));
  });

  // An independent ring (§8.2): in an open room walking distance is Chebyshev distance; a tile
  // is in the ring within RING_STILL of you, in line of sight by a Bresenham line traced from
  // the end first in row-major order, blocked between its ends by a wall or a tile a
  // sight-blocking surface's square covers.
  function oracleRing(m, ux, uy, r) {
    const veiled = (x, y) => (m.surfaces || []).some(s => ['fumigant', 'dust'].includes(s.kind) && Math.abs(x - s.x) <= floor(s.size, 2) && Math.abs(y - s.y) <= floor(s.size, 2));
    const sees = (x0, y0, x1, y1) => {
      if (y1 < y0 || (y1 === y0 && x1 < x0)) [x0, y0, x1, y1] = [x1, y1, x0, y0];
      const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1;
      let err = dx - dy, x = x0, y = y0;
      for (;;) {
        if (x === x1 && y === y1) return true;
        if (!(x === x0 && y === y0) && (m.tiles[y][x] === '#' || veiled(x, y))) return false;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 < dx) { err += dx; y += sy; }
      }
    };
    const out = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.tiles[y][x] === '.' && Math.max(Math.abs(x - ux), Math.abs(y - uy)) <= r && sees(ux, uy, x, y)) out.push(x + ',' + y);
    return out;
  }

  test('a cloud blocks sight both ways, and with one on the map the ring still marks exactly the sleepers that gain a ring pip', () => {
    for (const [kind, x, y, size] of [['dust', 8, 4, 1], ['dust', 6, 3, 3], ['fumigant', 7, 4, N.FUMIGANT_SIZE], ['fumigant', 10, 6, N.FUMIGANT_SIZE]]) {
      const X = loadCore(), exhibits = [];
      for (let ty = 1; ty <= 7; ty++) for (let tx = 4; tx <= 10; tx++) if (!(tx === 7 && ty === 4)) exhibits.push(ex([tx, ty], { uid: `T0.1.room.${tx}_${ty}` }));
      const s = room(X, WIDE, [7, 4], exhibits);
      const before = oracleRing(s.dept, 7, 4, N.RING_STILL);
      X.Surfaces.add(s, kind, x, y, size, 5, 'you', []);
      const ev = X.Step.step(s, { a: 'wait' });
      const gained = of(ev, 'pip', e => e.cause.k === 'ring').map(e => { const a = X.Actors.byUid(s, e.who); return a.x + ',' + a.y; }).sort();
      const ring = X.Vision.ring(s), drawn = [];
      for (let ty = 0; ty < s.dept.h; ty++) for (let tx = 0; tx < s.dept.w; tx++) if (ring[ty * s.dept.w + tx] && !(tx === 7 && ty === 4)) drawn.push(tx + ',' + ty);
      const oracle = oracleRing(s.dept, 7, 4, N.RING_STILL).filter(t => t !== '7,4').sort();
      assert.equal(json(gained), json(drawn.sort()), `${kind} at ${x},${y}: the pips and the drawn ring`);
      assert.equal(json(gained), json(oracle), `${kind} at ${x},${y}: the pips and the independent ring`);
      assert.ok(gained.length < before.length - 1, `${kind} at ${x},${y} takes tiles out of the ring (${gained.length} of ${before.length - 1})`);
    }
    // Both ways: you do not see past it and an exhibit behind it does not see you; gone, both do.
    const X = loadCore(), s = room(X, WIDE, [2, 4], [ex([9, 4], { mode: 'hunting' })]), a = s.actors[1];
    assert.ok(X.Grid.los(s.dept, 2, 4, 9, 4) && X.AI.sees(s, a) && X.Vision.visible(s)[4 * s.dept.w + 9]);
    X.Surfaces.add(s, 'fumigant', 6, 4, N.FUMIGANT_SIZE, 2, 'you', []);
    assert.ok(!X.Grid.los(s.dept, 2, 4, 9, 4) && !X.Grid.los(s.dept, 9, 4, 2, 4), 'blocked both ways');
    assert.ok(!X.AI.sees(s, a) && !X.Vision.visible(s)[4 * s.dept.w + 9], 'neither sees the other');
    for (let i = 0; i < 3; i++) X.Step.step(s, { a: 'wait' });
    assert.equal(s.dept.surfaces.length, 0);
    assert.ok(X.Grid.los(s.dept, s.actors[0].x, s.actors[0].y, a.x, a.y) && X.AI.sees(s, a));
  });

  test('Fumigant: each sleeper inside the cloud loses 1 pip a turn, for its 10 turns; one outside, an awake one or a second cloud changes nothing', () => {
    const X = loadCore();
    const s = room(X, APART, [1, 2], [
      ex([9, 2], { pips: 2 }), ex([11, 4], { pips: 2 }), ex([13, 1], { pips: 2 }), ex([10, 1], { pips: 1, size: 2 }),
      ex([8, 1], { pips: 2 }), ex([8, 4], { mode: 'awake' }),
    ]);
    const [, inside, edge, outside, big, kept, awake] = s.actors;
    X.Surfaces.add(s, 'fumigant', 9, 2, N.FUMIGANT_SIZE, N.FUMIGANT_TURNS, 'you', []);
    X.Surfaces.add(s, 'fumigant', 10, 3, N.FUMIGANT_SIZE, 2, 'you', []);
    const all = [];
    for (let i = 0; i < N.FUMIGANT_TURNS + 2; i++) { kept.pips = 2; all.push(...X.Step.step(s, { a: 'wait' })); }
    const pips = who => of(all, 'pip', e => e.who === who.uid && e.cause.k === 'fumigant');
    assert.equal(json(pips(inside).map(e => [e.turn, e.pips, e.delta])), json([[1, 1, -1], [2, 0, -1]]));
    assert.equal(json(pips(edge).map(e => e.turn)), json([1, 2]), 'the square\'s edge is inside');
    assert.equal(pips(outside).length, 0);
    assert.equal(json(pips(big).map(e => e.turn)), json([1]), 'a 2×2 body under the cloud loses a pip; at 0 pips nothing more');
    assert.equal(json(pips(kept).map(e => e.turn)), json([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 'one a turn, two clouds or one, for 10 turns');
    assert.equal(pips(awake).length, 0);
    assert.ok(pips(kept).every(e => e.cause.by === 'you'));
    assert.equal(X.Text.event(pips(inside)[0], u => u === inside.uid ? 'the Tortoise' : null), 'The Tortoise settles (1 of 3 pips): the Fumigant cloud calms it.');
    assert.equal(json([inside.mode, inside.pips, s.dept.surfaces.length]), json(['dormant', 0, 0]));
    // It takes no pips from a sleeper that has none, so it says nothing about one.
    assert.ok(of(all, 'pip', e => e.cause.k === 'fumigant').every(e => e.delta === -1 && e.pips >= 0));
    // A 2×2 body is inside if any of its tiles is: here only its right-hand tiles are under
    // the cloud, not the tile it is placed by (its top left), nor its lower row's left tile.
    const Y = loadCore(), t = room(Y, APART, [1, 2], [ex([7, 1], { pips: 2, size: 2 }), ex([12, 3], { pips: 2, size: 2 })]);
    const [, left, right] = t.actors;
    const cloud = Y.Surfaces.add(t, 'fumigant', 10, 2, N.FUMIGANT_SIZE, 3, 'you', []), h = floor(N.FUMIGANT_SIZE, 2);
    const under = (a, dx, dy) => Math.abs(a.x + dx - cloud.x) <= h && Math.abs(a.y + dy - cloud.y) <= h;
    assert.ok(!under(left, 0, 0) && !under(left, 0, 1) && under(left, 1, 0) && under(left, 1, 1), 'the cloud covers only the body\'s right-hand tiles');
    assert.ok(under(right, 0, 0) && !under(right, 1, 0), 'the cloud covers only the other body\'s left-hand tiles');
    const evs = [];
    for (let i = 0; i < 4; i++) evs.push(...Y.Step.step(t, { a: 'wait' }));
    assert.equal(json(of(evs, 'pip', e => e.cause.k === 'fumigant').map(e => [e.who, e.turn, e.pips])),
      json([[left.uid, 1, 1], [right.uid, 1, 1], [left.uid, 2, 0], [right.uid, 2, 0]]), 'each body loses a pip a turn while any tile of it is under the cloud');
  });

  test('plaster dust blocks sight for its 3 turns, is cleared at the boundary after them, and takes no pips', () => {
    const X = loadCore(), s = room(X, WIDE, [2, 4], [ex([8, 4], { pips: 2, stats: stats() })]);
    X.Surfaces.add(s, 'dust', 6, 4, N.PLASTER_DUST_SIZE, N.PLASTER_DUST_TURNS, s.actors[1].uid, []);
    const blocked = [];
    const all = [];
    for (let t = 1; t <= N.PLASTER_DUST_TURNS + 2; t++) { all.push(...X.Step.step(s, { a: 'wait' })); blocked.push([s.turn, s.dept.surfaces.length, !X.Grid.los(s.dept, 2, 4, 10, 4)]); }
    assert.equal(json(blocked), json([[1, 1, true], [2, 1, true], [3, 1, true], [4, 0, false], [5, 0, false]]));
    assert.equal(of(all, 'pip', e => e.who === s.actors[1].uid && e.delta < 0).length, 0);
  });

  test('the registry: six statuses and two surfaces at ready unit, with clauses that name their numbers, and the mimic\'s line embedding rooted', () => {
    const want = {
      fixed: [`${N.FIXATIVE_TURNS} turns`, `+${N.HIT_FIXED_TARGET} to hit`], rooted: [`${N.MIMIC_GRIP_TURNS} turns`], coughing: [`${N.COUGH_TURNS} turns`, `${N.NOISE_SOFT} tiles`],
      restoring: [`${N.CONSOLIDANT_HOT_PCT}%`, `${N.CONSOLIDANT_HOT_TURNS} turns`], slowed: [`${N.SPEED_SLOW_PCT}%`], dazed: [`${N.HIT_DAZED_ATTACKER} to hit`],
    };
    assert.equal(json(R.order('STATUSES')), json(Object.keys(want)));
    for (const id of R.order('STATUSES')) {
      const e = R.STATUSES[id], text = Clauses.fill(e.clause, Clauses.params(e.params, null, { depth: 4 }));
      assert.equal(json([e.ready, e.tests, e.inv, e.built]), json(['unit', ['m3-status.test.js', 'behaviour/status.test.js'], 'status', 'M3']), id);
      for (const w of want[id]) assert.ok(text.includes(w), `${id}: "${text}" names ${w}`);
      assert.ok(/^[a-z]/.test(text) && !/\.$/.test(text) && !/undefined|NaN|\[object/.test(text), text);
    }
    const surf = { fumigant: [`${N.FUMIGANT_SIZE} tiles`, `${N.FUMIGANT_TURNS} turns`, 'pip'], dust: [`${N.PLASTER_DUST_SIZE} tiles`, `${N.PLASTER_DUST_TURNS} turns`] };
    for (const id of R.order('SURFACES')) {
      const e = R.SURFACES[id], text = Clauses.fill(e.clause, Clauses.params(e.params, null, { depth: 1 }));
      assert.equal(json([e.ready, e.inv, e.blocksSight, N[e.size] > 0, N[e.turns] > 0]), json(['unit', 'status', true, true, true]), id);
      for (const w of surf[id]) assert.ok(text.includes(w), `${id}: "${text}" names ${w}`);
      assert.ok(/^[A-Z].*\.$/.test(text), text);
    }
    for (const code of ['fixed', 'rooted']) assert.equal(R.REFUSALS[code].ready, 'unit');
    // Every species that inflicts rooted (the mimic) reads its grip in its line, at every depth.
    const users = H.species(C, 'rooted');
    assert.ok(users.length >= 7 && users.every(u => u.sp.archetype === 'mimic_vitrine'), json(users.map(u => u.sp.id)));
    for (const { sp, depth } of users) assert.ok(Clauses.line(sp, { depth }).includes(`you cannot move for ${N.MIMIC_GRIP_TURNS} turns`), Clauses.line(sp, { depth }));
  });

  test('the sentences: each status put on (with its turns and what it does) and ended, for you and an exhibit; Status.apply refuses an unknown status or length', () => {
    const name = u => u === 'x.1' ? 'the Tortoise' : null;
    const say = (who, id, on, turns) => Text.event({ k: 'status', turn: 1, tick: 100, who, id, on, turns, cause: { k: 'status', id } }, name);
    assert.equal(say('you', 'rooted', true, 2), 'You are now rooted to the spot for 2 turns.');
    assert.equal(say('x.1', 'fixed', true, 4), 'The Tortoise is now fixed in place for 4 turns.');
    assert.equal(say('you', 'coughing', true, 1), 'You are now coughing for 1 turn.');
    assert.equal(say('you', 'restoring', true, 5), `You are now recovering health for 5 turns (${N.CONSOLIDANT_HOT_PCT}% of your maximum health in all, a share each turn).`);
    assert.equal(say('x.1', 'restoring', false), 'The Tortoise is no longer recovering health.');
    assert.equal(say('x.1', 'slowed', true, 3), `The Tortoise is now slowed for 3 turns (every action takes ${N.SPEED_SLOW_PCT}% of its usual time).`);
    assert.equal(say('you', 'dazed', true, 3), `You are now dazed for 3 turns (your blows have ${N.HIT_DAZED_ATTACKER} to hit).`);
    assert.equal(say('x.1', 'dazed', false), 'The Tortoise is no longer dazed.');
    for (const id of R.order('STATUSES')) for (const who of ['you', 'x.1']) for (const on of [true, false]) {
      const s = say(who, id, on, on ? 3 : undefined);
      assert.ok(/^[A-Z].*\.$/.test(s) && !/undefined|NaN|\[object|null/.test(s), s);
    }
    // Each status has its words, and ends in the words it began with: put on and timed out,
    // with or without its turns, each sentence reads "now <words>" or "no longer <words>".
    for (const id of R.order('STATUSES')) {
      const words = R.STATUSES[id].words;
      assert.ok(typeof words === 'string' && /^[a-z][a-z ]*[a-z]$/.test(words), `${id}: ${words}`);
      for (const who of ['you', 'x.1']) {
        assert.ok(say(who, id, true, 4).includes(` now ${words} for 4 turns`), say(who, id, true, 4));
        assert.ok(say(who, id, true).includes(` now ${words}`), say(who, id, true));
        assert.ok(say(who, id, false).endsWith(` no longer ${words}.`), say(who, id, false));
      }
    }
    // Statuses on exhibits out of view stay out of your log, as their pips do.
    assert.equal(Text.logs('status'), 'seen');
    const X = loadCore(), s = room(X, OPEN, [2, 2], [ex([5, 2])]);
    assert.throws(() => X.Status.apply(s, s.actors[0], 'sleepy', 2, { k: 'status', id: 'sleepy' }, []), /no status sleepy/);
    assert.throws(() => X.Status.apply(s, s.actors[0], 'fixed', 0, { k: 'status', id: 'fixed' }, []), /fixed for 0 turns/);
    assert.throws(() => X.Status.apply(s, s.actors[0], 'fixed', 1.5, { k: 'status', id: 'fixed' }, []), /fixed for 1\.5 turns/);
    assert.equal(X.Status.left(s, s.actors[1], 'fixed'), 0);
  });

  // A small run that touches every invariant of status.inv.js: you fixed, then rooted beside a
  // hunter, then coughing and restoring, with a Fumigant cloud over a sleeper and dust between.
  function run(X, inv) {
    healing(X); plant(X);
    // The 2×2 sleeper at (7, 3) has only its right-hand tiles under the cloud.
    const s = room(X, APART, [2, 2], [ex([3, 2], { mode: 'hunting', stats: stats({ acc: -99, hp: 999 }) }), ex([9, 2], { pips: 2 }), ex([11, 3], { pips: 2 }),
      ex([7, 3], { pips: 2, size: 2 })]);
    s.actors[0].hp = 12;
    const a = s.actors[1];
    X.Surfaces.add(s, 'fumigant', 10, 2, N.FUMIGANT_SIZE, 4, 'you', []);
    X.Surfaces.add(s, 'dust', 2, 3, 1, 2, a.uid, []);
    // You are fixed twice in one action, for 2 turns and then 1: it covers the longer.
    const acts = [put(150, a.uid, 'fixed', 3), { a: 'wait', put: [{ who: 'you', id: 'fixed', turns: 2 }, { who: 'you', id: 'fixed', turns: 1 }] }, { a: 'move', dir: 6 }, { a: 'wait' }, { a: 'wait' },
      put(200, 'you', 'rooted', 2), { a: 'move', dir: 6 }, { a: 'move', dir: 6 }, { a: 'wait' }, { a: 'move', dir: 6 },
      { a: 'wait', put: [{ who: 'you', id: 'coughing', turns: 3 }, { who: 'you', id: 'restoring', turns: 5 }] }, { a: 'wait' }, { a: 'wait' }, { a: 'wait' }, { a: 'wait' }, { a: 'wait' }];
    return H.play(X, s, acts, { inv, clone: true });
  }

  test('the invariants hold on the rules as built, and each catches its planted fault', () => {
    const ids = ['status_timing', 'fixed_only_waits', 'rooted_never_steps', 'coughing_noise', 'restoring_share', 'fumigant_pips', 'surface_timing', 'los_symmetric'];
    const clean = run(loadCore(), ids);
    assert.equal(json(clean.violations.map(v => v.text)), '[]');
    assert.ok(of(clean.events, 'status').length >= 10 && of(clean.events, 'noise', e => e.cause.k === 'cough').length === 3);
    assert.ok(of(clean.events, 'healed').length >= 3 && of(clean.events, 'pip', e => e.cause.k === 'fumigant').length >= 3);
    // Each invariant's planted faults, as [invariant, what is wrong, plant].
    const faults = [
      ['status_timing', 'the start rounded up instead of down, so a status put on during a 150-tick action starts a turn late',
        X => { X.Status.settle = state => { for (const a of state.actors) for (const s of a.statuses) if (s.turns !== null) { const st = X.Int.ceilDiv(a.next, 100); if (s.until === null) { s.from = st; s.until = st + s.turns; } else s.until = Math.max(s.until, st + s.turns); s.turns = null; } }; }],
      ['status_timing', 'put on twice in one action, the second length replaces the first',
        X => { const apply = X.Status.apply; X.Status.apply = (state, a, id, turns, cause, ev) => { const s = (a.statuses || []).find(q => q.id === id && q.until === null); apply(state, a, id, turns, cause, ev); if (s) s.turns = turns; }; }],
      ['fixed_only_waits', 'a fixed exhibit acts as if it were free',
        X => { const act = X.AI.act; X.AI.act = (state, a, ev) => { const keep = a.statuses; a.statuses = keep.filter(s => s.id !== 'fixed'); try { return act(state, a, ev); } finally { a.statuses = keep; } }; }],
      ['rooted_never_steps', 'rooted forgotten by the step rule',
        X => { const blocks = X.Status.blocks; X.Status.blocks = (state, a, action) => { const c = blocks(state, a, action); return c === 'rooted' ? null : c; }; }],
      ['coughing_noise', 'two coughs a turn',
        X => { const f = X.Status.EFFECTS.coughing; X.Status.EFFECTS.coughing = (state, a, s, ev) => { f(state, a, s, ev); f(state, a, s, ev); }; }],
      ['restoring_share', 'the whole course healed at once',
        X => { X.Status.EFFECTS.restoring = (state, a, s, ev) => { if (state.turn === s.from) X.Health.heal(state, a, X.Int.pct(a.maxHp, 25), { k: 'status', id: 'restoring' }, ev); }; }],
      ['fumigant_pips', 'two pips a turn',
        X => { X.Surfaces.EFFECTS.fumigant = (state, s, ev) => { for (const a of state.actors.slice(1)) if (a.mode === 'dormant' && X.Grid.covers(s, a.x, a.y)) X.Wake.addPips(state, a, -2, { k: 'fumigant', by: s.by }, ev); }; }],
      ['fumigant_pips', 'only the tile a sleeper is placed by counts, so a 2×2 body with its other tiles under the cloud keeps its pips',
        X => { X.Surfaces.EFFECTS.fumigant = (state, s, ev) => { for (const a of state.actors.slice(1)) if (a.mode === 'dormant' && a.pips && X.Grid.covers(s, a.x, a.y)) X.Wake.addPips(state, a, -1, { k: 'fumigant', by: s.by }, ev); }; }],
      ['fumigant_pips', 'the cloud takes no pips at all', X => { X.Surfaces.EFFECTS.fumigant = () => {}; }],
      ['surface_timing', 'surfaces never cleared', X => { X.Surfaces.tick = () => {}; }],
      ['los_symmetric', 'sight traced from its first end only, ignoring surfaces one way',
        X => { const los = X.Grid.los; X.Grid.los = (m, x0, y0, x1, y1) => (x1 < x0 && m.surfaces && m.surfaces.length) ? false : los(m, x0, y0, x1, y1); }],
      ['los_symmetric', 'from the fifth step on, when the check no longer looks at every tile round a surface, sight into a surface\'s square from its east is blocked one way only',
        X => { const los = X.Grid.los, step = X.Step.step; let calls = 0; X.Step.step = (st, a) => { calls++; return step(st, a); };
          X.Grid.los = (m, x0, y0, x1, y1) => (calls > 8 && x1 < x0 && (m.surfaces || []).some(s => X.Grid.covers(s, x1, y1))) ? false : los(m, x0, y0, x1, y1); }],
    ];
    for (const id of ids) assert.ok(faults.some(f => f[0] === id), `${id} has a planted fault`);
    for (const [id, what, fault] of faults) {
      const X = loadCore();
      fault(X);
      const r = run(X, [id]);
      assert.ok(r.violations.some(v => v.inv === id), `${id} misses its planted fault: ${what}`);
    }
    // The fixed you: the step rule forgotten, you walk while fixed.
    const X = loadCore(); X.Status.blocks = () => null;
    const r = run(X, ['fixed_only_waits']);
    assert.ok(r.violations.some(v => v.inv === 'fixed_only_waits' && v.uid === 'you'), json(r.violations.map(v => v.text)));
  });

  test('fixed_only_waits: the pole may move a fixed exhibit, but a step of its own while you use an instrument is caught', () => {
    // The pole is W1-KIT's: planted here as a use of 100 ticks that pushes the exhibit `push`
    // one tile in direction `dir`, with the pole's cause naming you, and puts statuses on.
    const pole = X => {
      X.Actions.get('use').apply = (state, action, ev) => {
        const a = action.push ? X.Actors.byUid(state, action.push) : null;
        if (a) {
          const to = [a.x + X.Grid.DX[action.dir], a.y + X.Grid.DY[action.dir]];
          X.Causes.emit(state, ev, 'moved', { who: a.uid, from: [a.x, a.y], to }, { k: 'pole', by: 'you', item: 'pole' });
          a.x = to[0]; a.y = to[1];
        }
        for (const p of action.put || []) X.Status.apply(state, X.Actors.byUid(state, p.who), p.id, p.turns, { k: 'status', id: p.id }, ev);
        return 100;
      };
      return X;
    };
    // A hunter three tiles east of you, fixed and pushed east by the pole, then left fixed
    // while you use the pole on nothing: each of its turns while fixed falls in a use.
    const go = X => {
      const s = room(X, WIDE, [1, 4], [ex([4, 4], { mode: 'hunting' })]), a = s.actors[1];
      const acts = [{ a: 'use', push: a.uid, dir: 2, put: [{ who: a.uid, id: 'fixed', turns: 3 }] }, { a: 'use', push: a.uid, dir: 2 }, { a: 'use' }, { a: 'use' }, { a: 'wait' }];
      return { a, r: H.play(X, s, acts, { inv: ['fixed_only_waits'], clone: true }) };
    };
    const clean = go(pole(loadCore()));
    assert.equal(json(clean.r.violations.map(v => v.text)), '[]');
    const pushed = of(clean.r.events, 'moved', e => e.who === clean.a.uid && e.cause && e.cause.k === 'pole');
    assert.equal(json(pushed.map(e => e.to)), json([[5, 4], [6, 4]]), 'the pole moved it twice');
    assert.ok(!of(clean.r.events, 'moved', e => e.who === clean.a.uid && !e.cause && e.tick < 300).length, 'it did not step while fixed');
    // A fixed exhibit that steps as if free, during your use of the pole, is caught.
    const X = pole(loadCore()), act = X.AI.act;
    X.AI.act = (state, a, ev) => { const keep = a.statuses; a.statuses = keep.filter(s => s.id !== 'fixed'); try { return act(state, a, ev); } finally { a.statuses = keep; } };
    const bad = go(X);
    assert.ok(bad.r.steps.every((st, i) => i > 3 || st.action.a === 'use'), 'every step while it is fixed is a use');
    assert.ok(!of(bad.r.events, 'attacked', e => e.by === bad.a.uid && e.tick < 300).length, 'it made no blow while fixed, only steps');
    assert.ok(bad.r.violations.some(v => v.inv === 'fixed_only_waits' && v.uid === bad.a.uid && /stepped/.test(v.message)), json(bad.r.violations.map(v => v.text)));
  });

  test('statuses and surfaces are plain data and clone-stable, and the department monkey holds every status invariant', () => {
    const r = run(loadCore(), 'all');
    assert.equal(json(r.violations.map(v => v.text)), '[]');
    // A department with Fixative and Fumigant laid by hand partway through, monkeyed.
    const X = plant(loadCore()), s = X.Dept.create(5, 'S9', 3, { invulnerable: true }), pick = X.Rng.stream({ seed: 9, rng: {} }, 'pick');
    const acts = (state, i) => {
      if (i === 5) return { a: 'wait', lay: [{ kind: 'fumigant', size: N.FUMIGANT_SIZE, turns: N.FUMIGANT_TURNS }] };
      if (i === 9) return put(100, 'you', 'fixed', N.FIXATIVE_TURNS);
      if (i === 30) return put(150, 'you', 'coughing', N.COUGH_TURNS);
      const legal = X.Step.legal(state);
      return legal[pick.int(0, legal.length - 1)];
    };
    const p = H.play(X, s, acts, { inv: ['status'], cap: 120, clone: true });
    assert.equal(json(p.violations.map(v => v.text)), '[]');
    assert.ok(p.steps.length > 20);
  });
};
