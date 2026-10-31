// M4's routing (plan A4, A6, A8, A18; W0d1): every hook M4's rules use, routed into the M3
// files that must ask it, with nothing changed while no perk is held and no module is on.
// Each part is driven here with planted perks, refusers, readers and Centrepieces, since the
// packages that fill them come later:
//   - time (A6): the floor at 0, 50 and 49 ticks; the ring a boundary applies after a free
//     step and across a long action (you.ringMax), and the ring drawn, which is the ring the
//     next boundary applies; any change of tile unseats you;
//   - Actions.addRefuser, Actions.free and the generic choose with Progress.afterChoice;
//   - Fixtures and read(x, y) for a planted kind;
//   - the perks' hooks where the M3 rules ask them (loss of track, steps, low health,
//     surprise, a case's cost, noise and lock, Padding, the ring), and the modules' (pip
//     decay, going back);
//   - Vision.observed against an oracle, and the Lamp (an `observing` curio) lit and hooded;
//   - ClockRules.advance at stages 0, 1 and 2; Hall.boundary first in step 6 and
//     Hall.onTicket after a Ticket; the bell and a herald's call sparing a Centrepiece;
//   - the A8 hooks: huntsOnSight, and wakeRegion's default against an oracle.
// The expected figures are worked out here from BUILD.md and the plan, never from the code.
'use strict';
module.exports = ({ test, assert, loadCore, root, path }) => {
  const C = loadCore();
  const json = x => JSON.stringify(x);
  const N = C.N;
  const OPEN = ['############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '############'];
  const tough = { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 };
  const ex = (at, extra) => Object.assign({ sp: 'dummy', at, mode: 'dormant', stats: tough }, extra);
  const room = (X, spec, options) => {
    const s = X.Setup.room(1, Object.assign({ acc: 'T0', depth: 1, map: OPEN, you: [2, 3], exhibits: [] }, spec), options);
    s.actors[0].hp = s.actors[0].maxHp = 999;
    return s;
  };
  // A planted perk, held at rank 1 by every state that lists it (once the registry has its
  // PERKS table, the id goes in it first).
  const perk = (X, id, hooks) => { if (X.Registry.TABLES.includes('PERKS')) X.Registry.define('PERKS', id, { built: 'M4' }); X.Perks.add(id, hooks); };
  const hold = (s, ...ids) => { s.run.perks = ids.map(id => ({ id, rank: 1 })); };
  const checked = ev => { for (const e of ev) { const bad = C.Causes.check(e); assert.equal(bad, null, `${bad}: ${json(e)}`); } return ev; };
  // The ring radius the next boundary applies: what Wake.boundary measures with (its field).
  const applied = X => { const out = []; const orig = X.Wake.boundary; X.Wake.boundary = (st, ev) => { out.push([st.tick, X.Vision.field(st).r]); return orig(st, ev); }; return out; };

  // ---- Time (plan A6) ----

  test('the floor: 0 ticks only for a step Close the Distance made free, from 50 for an action Duck and Cover discounted, else a turn', () => {
    const X = loadCore(), asked = [];
    let give = null;
    perk(X, 'planted_time', { adjust: (s, action, r, ev, rank) => { asked.push([action.a, r]); return give ? give(action, r) : null; } });
    const map = ['#########', '#.......#', '#...+...#', '#.......#', '#########'];
    const fresh = () => { const s = room(X, { map, you: [2, 2], fixtures: [{ k: 'plaque', x: 2, y: 0, ck: 'card' }] }); hold(s, 'planted_time'); return s; };
    const free = (action, r) => (action.a === 'move' ? { r: 0, why: 'close_the_distance' } : null);
    // A free step: no time passes, you stand on the new tile, and the ring is the step's.
    give = free;
    let s = fresh();
    const ev = checked(X.Step.step(s, { a: 'move', dir: 2 }));
    assert.equal(json([s.tick, s.actors[0].next, s.actors[0].x, s.actors[0].still, s.actors[0].lastAct, s.actors[0].ringMax]), json([0, 0, 3, false, 'move', N.RING_MOVING]));
    assert.equal(json(ev.map(e => e.k)), json(['moved']));
    // A bump into a door changes no tile, so it is no step: made free, it is refused by the floor.
    s = fresh(); s.actors[0].x = 3;
    assert.throws(() => X.Step.step(s, { a: 'move', dir: 2 }), /move cost 0 ticks \(100 before close_the_distance\)/);
    // Free for any other reason, or a wait made free, is caught.
    give = (action, r) => ({ r: 0, why: action.a === 'wait' ? 'close_the_distance' : 'planted_time' });
    assert.throws(() => X.Step.step(fresh(), { a: 'wait' }), /wait cost 0 ticks/);
    assert.throws(() => X.Step.step(fresh(), { a: 'move', dir: 2 }), /move cost 0 ticks \(100 before planted_time\)/);
    // Duck and Cover: 50 is allowed, 49 is not, and 50 for another perk is not.
    for (const [r, why, ok] of [[50, 'duck_and_cover', true], [N.TICKS_PER_TURN - N.PERK_DUCK_AND_COVER - 1, 'duck_and_cover', false], [50, 'planted_time', false], [0, 'duck_and_cover', false], [100, 'planted_time', true]]) {
      give = () => ({ r, why });
      const t = fresh();
      if (ok) { X.Step.step(t, { a: 'wait' }); assert.equal(t.actors[0].next, r, `${r} for ${why}`); }
      else assert.throws(() => X.Step.step(t, { a: 'wait' }), new RegExp(`wait cost ${r} ticks`), `${r} for ${why}`);
    }
    // An action that costs no time (read, choose, leave) is not adjusted; any other that costs
    // none without a perk is a fault, as M3's floor says.
    give = () => { throw new Error('a free action was adjusted'); };
    asked.length = 0;
    s = fresh();
    checked(X.Step.step(s, { a: 'read', x: 2, y: 0 }));
    assert.equal(json([asked, s.tick, s.actors[0].next]), json([[], 0, 0]));
    assert.equal(json(['read', 'choose', 'leave', 'wait', 'move', 'use', 'view'].map(X.Actions.free)), json([true, true, true, false, false, false, false]));
    give = null;
    X.Actions.get('rest').apply = () => 0;
    assert.throws(() => X.Step.step(fresh(), { a: 'rest' }), /rest cost 0 ticks/);
    // With no perk held, the handler's cost stands and adjust is asked with it.
    asked.length = 0;
    s = fresh(); s.run.perks = [];
    X.Step.step(s, { a: 'wait' });
    assert.equal(json([asked, s.actors[0].next, s.actors[0].ringMax]), json([[], N.COST_WAIT, undefined]));
  });

  // Sleepers 2, 3 and 4 walking tiles east of you, in sight: the ring a boundary applies is
  // read off which of them gain a ring pip, and from the boundary's own field.
  const RING = ['#############', '#...........#', '#...........#', '#...........#', '#############'];
  const ringRoom = (X, extra) => {
    const s = room(X, Object.assign({ map: RING, you: [2, 2], exhibits: [ex([4, 2]), ex([5, 2]), ex([6, 2])] }, extra));
    return s;
  };
  const pipped = (s, ev) => ev.filter(e => e.k === 'pip' && e.cause.k === 'ring').map(e => [e.tick, s.actors.findIndex(a => a.uid === e.who), e.cause.r]);

  test('the ring a boundary applies is the largest of your actions since the last one: after a free step, and across a long action', () => {
    const X = loadCore();
    let once = null;
    perk(X, 'planted_ring', { adjust: (s, action, r) => { const g = once; once = null; return g ? g(action, r) : null; } });
    const seen = applied(X);
    // A free step east (ring 3), then a wait (ring 2): the boundary at 100 applies 3, and the
    // next applies 2. Without the free step, the wait's 2 alone.
    let s = ringRoom(X); hold(s, 'planted_ring');
    once = () => ({ r: 0, why: 'close_the_distance' });
    X.Step.step(s, { a: 'move', dir: 6 });
    assert.equal(json([s.actors[0].x, s.actors[0].ringMax, X.Vision.ringRadius(s)]), json([1, 3, 3]), 'the ring drawn after the free step is the step\'s');
    let ev = X.Step.step(s, { a: 'wait' });
    assert.equal(s.actors[0].ringMax, undefined, 'the boundary cleared it');
    assert.equal(X.Vision.ringRadius(s), N.RING_STILL);
    // From (1, 2) the sleepers stand 3, 4 and 5 tiles away: only the first is within 3.
    assert.equal(json(pipped(s, ev)), json([[100, 1, 3]]));
    ev = X.Step.step(s, { a: 'wait' });
    assert.equal(json(pipped(s, ev)), json([]), 'radius 2 at the next boundary');
    // A discounted step (50 ticks) east, then a 300-tick wait: the boundary at 100 applies
    // the step's 3; those at 200 and 300 the wait's 2.
    s = ringRoom(X); hold(s, 'planted_ring'); seen.length = 0;
    once = (action, r) => ({ r: r - N.PERK_DUCK_AND_COVER, why: 'duck_and_cover' });
    X.Step.step(s, { a: 'move', dir: 2 });
    assert.equal(json([s.tick, s.actors[0].next, s.actors[0].x, s.actors[0].ringMax]), json([50, 50, 3, 3]), 'your next decision is mid-turn, and the step\'s ring is kept');
    const wait = X.Actions.get('wait'), apply = wait.apply;
    wait.apply = (st, action, e) => { apply(st, action, e); return 300; };
    try { ev = X.Step.step(s, { a: 'wait' }); } finally { wait.apply = apply; }
    assert.equal(json(seen), json([[100, 3], [200, 2], [300, 2]]));
    // From (3, 2) the sleepers stand 1, 2 and 3 away: all three at 100, the first two after.
    assert.equal(json(pipped(s, ev).map(p => p.slice(0, 2))), json([[100, 1], [100, 2], [100, 3], [200, 1], [200, 2], [300, 1], [300, 2]]));
    // A full-cost action writes nothing (M3's ring, the last action's).
    s = ringRoom(X); hold(s, 'planted_ring');
    X.Step.step(s, { a: 'move', dir: 2 });
    assert.equal(s.actors[0].ringMax, undefined);
    // A cheaper action that reaches a boundary is applied there, and owes nothing after
    // (BUILD §8.2, Which turn): a cheaper wait (0 to 50), then a cheaper step east (50 to 100),
    // whose boundary at 100 applies the step's 3. At 100 the ring drawn is the step's 3, but
    // nothing is owed, so a wait's boundary at 200 applies its own 2, less than drawn.
    s = ringRoom(X); hold(s, 'planted_ring'); seen.length = 0;
    once = (action, r) => ({ r: r - N.PERK_DUCK_AND_COVER, why: 'duck_and_cover' });
    X.Step.step(s, { a: 'wait' });
    assert.equal(json([s.tick, s.actors[0].ringMax, X.Vision.ringRadius(s)]), json([50, N.RING_STILL, N.RING_STILL]));
    once = (action, r) => ({ r: r - N.PERK_DUCK_AND_COVER, why: 'duck_and_cover' });
    X.Step.step(s, { a: 'move', dir: 2 });
    assert.equal(json([s.tick, s.actors[0].ringMax, X.Vision.ringRadius(s), seen]), json([100, undefined, N.RING_MOVING, [[100, N.RING_MOVING]]]));
    X.Step.step(s, { a: 'wait' });
    assert.equal(json(seen), json([[100, N.RING_MOVING], [200, N.RING_STILL]]));
  });

  test('any change of tile unseats you, a free step included; a free step still sets your ring', () => {
    const X = loadCore();
    perk(X, 'planted_seat', { adjust: (s, action) => (action.a === 'move' ? { r: 0, why: 'close_the_distance' } : null) });
    const map = ['#######', '#.b...#', '#######'];
    const s = room(X, { map, you: [2, 1] });
    X.Step.step(s, { a: 'sit' });
    assert.equal(s.actors[0].seated, true);
    hold(s, 'planted_seat');
    X.Step.step(s, { a: 'move', dir: 2 });
    assert.equal(json([s.actors[0].seated, s.actors[0].still, s.actors[0].x]), json([false, false, 3]));
    // The Ticket moves you without a step: seated or not, it unseats.
    const t = room(X, { map, you: [2, 1], entrance: [5, 1] });
    X.Step.step(t, { a: 'sit' });
    t.items.push(X.Kit.item({ uid: 'tk', kind: 'consumable', where: { at: 'tote' }, ck: 'ticket', n: 1 })); t.you.tote.push('tk');
    X.Step.step(t, { a: 'use', uid: 'tk' });
    assert.equal(json([t.actors[0].x, t.actors[0].seated]), json([5, false]));
    // An action that costs no time and changes your tile (a planted reader that moves you)
    // unseats you too, though it sets no ring.
    X.Fixtures.addReader('planted_door', (st, f) => ({ text: null, effects: st2 => { st2.actors[0].x = 4; } }));
    const u = room(X, { map, you: [2, 1], fixtures: [{ k: 'planted_door', x: 3, y: 1 }] });
    X.Step.step(u, { a: 'sit' });
    const still = u.actors[0].still;
    X.Step.step(u, { a: 'read', x: 3, y: 1 });
    assert.equal(json([u.actors[0].x, u.actors[0].seated, u.actors[0].still, u.tick]), json([4, false, still, 100]));
  });

  // ---- Refusers, free actions, choose ----

  test('a refuser refuses before the handler and after a status, Step.legal leaves out what it refuses, and the first code wins', () => {
    const X = loadCore(), calls = [];
    const wait = X.Actions.get('wait'), apply = wait.apply;
    wait.apply = (st, action, ev) => { calls.push('handler'); return apply(st, action, ev); };
    X.Actions.addRefuser((st, action) => { calls.push('first'); return action.a === 'wait' ? 'planted_no' : null; });
    X.Actions.addRefuser((st, action) => { calls.push('second'); return action.a === 'wait' || action.a === 'rest' ? 'planted_late' : null; });
    const s = room(X, {}), h = X.State.hash(s), rng = json(s.rng);
    const ev = X.Step.step(s, { a: 'wait' });
    assert.equal(json(ev.map(e => [e.k, e.reason])), json([['refused', 'planted_no']]));
    assert.equal(json(calls), json(['first']), 'the handler never ran, and the first code won');
    assert.equal(X.State.hash(s), h); assert.equal(json(s.rng), rng);
    assert.equal(X.Step.step(s, { a: 'rest' })[0].reason, 'planted_late');
    const legal = X.Step.legal(s).map(a => a.a);
    assert.ok(!legal.includes('wait') && !legal.includes('rest') && legal.includes('move'), json(legal));
    // A status forbids first: fixed, a move is refused fixed, not by a refuser.
    const f = room(X, { youStatuses: [{ id: 'fixed', turns: 3 }] });
    X.Actions.addRefuser((st, action) => (action.a === 'move' ? 'planted_move' : null));
    assert.equal(X.Step.step(f, { a: 'move', dir: 2 })[0].reason, 'fixed');
    assert.equal(X.Step.step(room(X, {}), { a: 'move', dir: 2 })[0].reason, 'planted_move');
    // A label offers only what step() would take (Labels: "exactly when Step.legal would list
    // it"): refused, the wait and the rest are not offered on your own label.
    const offered = X.Labels.you(s).actions.map(a => a.id);
    assert.ok(!offered.includes('wait') && !offered.includes('rest'), json(offered));
    // Nor is a refused action forecast as if it ran (Specials.threat): a hunter's ring marked
    // round you threatens a wait, until a refuser refuses the wait.
    const Z = loadCore();
    const w = room(Z, { exhibits: [ex([3, 3], { arch: 'tethered_warden', mode: 'hunting', sawYou: true, lastKnown: [2, 3], stats: { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 5, dmax: 5 } })] });
    Z.Specials.mark(w, w.actors[1], 'ring', Z.Specials.tiles(w, w.actors[1], 'ring'), []);
    assert.ok(Z.Specials.threat(w, { a: 'wait' }), 'the ring threatens a wait');
    Z.Actions.addRefuser((st, action) => (action.a === 'wait' ? 'planted_no' : null));
    assert.equal(Z.Specials.threat(w, { a: 'wait' }), null, 'a refused wait has no threat');
    // A refuser that gives anything but a code (or null) is a fault.
    const Y = loadCore();
    Y.Actions.addRefuser(() => 7);
    assert.throws(() => Y.Step.step(room(Y, {}), { a: 'wait' }), /a refuser gave 7/);
    assert.throws(() => Y.Actions.addRefuser('no'), /a function/);
  });

  test('choose answers the choice waiting, then Progress.afterChoice raises what waited behind it, only once none waits', () => {
    const X = loadCore(), after = [];
    X.Progress.afterChoice = (st, ev) => after.push(st.ui.pendingChoice);
    X.Actions.defineChoice('planted_one', (st, i, ev) => (i === 1 ? 'choice_bad' : 0));
    X.Actions.defineChoice('planted_two', (st, i, ev) => { st.ui.pendingChoice = { k: 'planted_one', options: ['a', 'b'] }; return 0; });
    const s = room(X, {});
    s.ui.pendingChoice = { k: 'planted_two', options: ['x'] };
    assert.equal(json(X.Step.legal(s)), json([{ a: 'choose', index: 0 }]));
    X.Step.step(s, { a: 'choose', index: 0 });
    assert.equal(json([s.ui.pendingChoice, after]), json([{ k: 'planted_one', options: ['a', 'b'] }, []]), 'a new choice waits, so nothing is raised yet');
    assert.equal(X.Step.step(s, { a: 'choose', index: 1 })[0].reason, 'choice_bad');
    assert.equal(after.length, 0, 'a refused answer raises nothing');
    X.Step.step(s, { a: 'choose', index: 0 });
    assert.equal(json([s.ui.pendingChoice, after, s.tick]), json([null, [null], 0]), 'answered, at no cost in time, with none waiting');
    assert.equal(X.Step.step(s, { a: 'choose', index: 0 })[0].reason, 'choice_none');
  });

  // ---- Fixtures ----

  test('read(x, y) reads any fixture kind with a reader: its refusals, then reach, then its effects, at no cost in time', () => {
    const X = loadCore(), done = [];
    let say = null;
    X.Fixtures.addReader('planted_sign', (st, f) => (say ? say : { text: `the sign at ${f.x},${f.y}`, effects: (s2, ev) => done.push([f.x, f.y, s2.tick]) }));
    assert.throws(() => X.Fixtures.addReader('planted_sign', () => null), /has a reader already/);
    assert.throws(() => X.Fixtures.addReader('', () => null), /fixture kind/);
    const map = ['#########', '#.......#', '#...#...#', '#.......#', '#########'];
    const signs = [{ k: 'planted_sign', x: 2, y: 0 }, { k: 'planted_sign', x: 7, y: 2 }, { k: 'planted_post', x: 1, y: 4 }];
    const s = room(X, { map, you: [2, 1], fixtures: signs });
    assert.equal(json(X.Step.legal(s).filter(a => a.a === 'read')), json([{ a: 'read', x: 2, y: 0 }]));
    assert.equal(X.Fixtures.at(s, 1, 4), null, 'a kind with no reader is not readable');
    const read0 = X.Fixtures.read(s, s.dept.fixtures[0]);
    assert.equal(json([read0.text, typeof read0.effects]), json(['the sign at 2,0', 'function']));
    const h = X.State.hash(s);
    X.Fixtures.read(s, s.dept.fixtures[0]); X.Fixtures.at(s, 2, 0);
    assert.equal(X.State.hash(s), h, 'asking changes nothing');
    const ev = X.Step.step(s, { a: 'read', x: 2, y: 0 });
    assert.equal(json([ev, done, s.tick, s.actors[0].next]), json([[], [[2, 0, 0]], 0, 0]));
    // Out of reach (behind the pillar, or too far), it is refused label_far, whatever the reader says.
    for (const [x, y, code] of [[7, 2, 'label_far'], [1, 4, 'label_none'], [3, 1, 'label_none'], [2.5, 0, 'label_none']]) assert.equal(X.Step.step(s, { a: 'read', x, y })[0].reason, code, `${x},${y}`);
    // The reader's own refusal comes first, and so does it out of reach.
    say = 'label_known';
    assert.equal(X.Step.step(s, { a: 'read', x: 2, y: 0 })[0].reason, 'label_known');
    assert.equal(X.Step.step(s, { a: 'read', x: 7, y: 2 })[0].reason, 'label_known');
    assert.ok(!X.Step.legal(s).some(a => a.a === 'read'));
    say = { text: 5 };
    assert.equal(X.Fixtures.read(s, s.dept.fixtures[0]).text, null, 'text is a string or null');
    say = { effects: 'run' };
    assert.throws(() => X.Fixtures.read(s, s.dept.fixtures[0]), /not \{text, effects\}/);
    // The plaque is read through its reader (rules/consumables.js).
    assert.equal(X.Fixtures.read(room(X, { map, you: [2, 1], fixtures: [{ k: 'plaque', x: 2, y: 0, ck: 'card' }] }), { k: 'plaque', x: 2, y: 0, ck: 'card' }).effects !== null, true);
  });

  // ---- The perks' and modules' hooks in the M3 rules ----

  test('a hunter loses you after the perks\' turns: cause vanished when sooner than LOSE_TRACK_TURNS, then Perks.onLoseTrack; out_of_sight otherwise', () => {
    const X = loadCore(), told = [];
    perk(X, 'planted_vanish', { loseTrack: (s, a, r) => 2, onLoseTrack: (s, a, ev, r) => told.push([a.uid, s.turn, ev.length > 0 && ev[ev.length - 1].k]) });
    const map = ['##########', '#....#...#', '#....#...#', '#....#...#', '##########'];
    const play = perks => {
      const s = room(X, { map, you: [1, 2], exhibits: [ex([7, 2], { mode: 'hunting', lastKnown: [7, 2], stim: 0, sawYou: true })] });
      s.run.perks = perks;
      const lost = [];
      for (let k = 0; k < 12 && !lost.length; k++) for (const e of checked(X.Step.step(s, { a: 'wait' }))) if (e.k === 'lost') lost.push([e.turn, e.to, e.cause.k, e.cause.turns]);
      return lost;
    };
    assert.equal(json(play([{ id: 'planted_vanish', rank: 1 }])), json([[2, 'searching', 'vanished', 2]]));
    assert.equal(json(told), json([['T0.1.room.1', 2, 'lost']]), 'told once it began to search, after its lost event');
    told.length = 0;
    assert.equal(json(play([])), json([[N.LOSE_TRACK_TURNS, 'searching', 'out_of_sight', N.LOSE_TRACK_TURNS]]));
    assert.equal(json(told), json([]), 'a perk not held is not told');
    assert.equal(X.AI.loseTrackTurns(room(X, {}), room(X, {}).actors[0]), N.LOSE_TRACK_TURNS);
  });

  test('an exhibit\'s step tells the perks where it stepped from; low health tells them the health before; a perk can make your blow a surprise', () => {
    const X = loadCore(), steps = [], lows = [];
    let surprise = false;
    perk(X, 'planted_body', {
      afterStep: (s, a, from, ev, r) => steps.push([a.uid, from, [a.x, a.y]]),
      onLow: (s, who, before, ev, r) => lows.push([who.uid, before, who.hp]),
      surprise: (s, att, def, r) => surprise && att.uid === 'you',
    });
    const s = room(X, { exhibits: [ex([6, 3], { mode: 'hunting', stats: { hp: 999, acc: 99, eva: 0, pad: 0, dmin: 3, dmax: 3 } })] });
    hold(s, 'planted_body');
    for (let k = 0; k < 8; k++) X.Step.step(s, { a: 'wait' });
    // Each step it took, from the tile before it to the tile after (three steps to reach you).
    assert.equal(steps.length, 3, json(steps));
    steps.forEach(([uid, from, to], i) => {
      assert.equal(uid, 'T0.1.room.1');
      assert.equal(json(from), json(i ? steps[i - 1][2] : [6, 3]));
      assert.equal(Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1])), 1);
    });
    // Each blow takes 3 less your Padding; the hook sees the health before it and after.
    const blow = Math.max(N.DMG_MIN_ON_HIT, 3 - s.actors[0].pad);
    assert.ok(lows.length >= 2 && lows.every(([who, before, hp], i) => who === 'you' && before === hp + blow && (!i || before === lows[i - 1][2])), json(lows));
    // Your blow on a hunter: rolled without the perk, a certain maximum blow with it.
    const a = s.actors[1], roll = X.Step.step(X.State.clone(s), { a: 'attack', uid: a.uid }).find(e => e.k === 'damaged' || e.k === 'missed');
    assert.ok(roll && roll.cause.roll !== undefined && roll.cause.surprise === undefined);
    surprise = true;
    assert.equal(X.Combat.surprised(s.actors[0], a, s), true); assert.equal(X.Combat.surprised(s.actors[0], a), false, 'without the state, M3\'s rule alone');
    const hit = X.Step.step(s, { a: 'attack', uid: a.uid }).find(e => e.k === 'damaged' && e.who === a.uid);
    assert.equal(json([hit.cause.surprise, hit.cause.raw]), json([1, s.actors[0].dmax]));
    assert.equal(X.Combat.surprised(a, s.actors[0], s), false, 'you are never surprised');
  });

  test('opening a case asks the perks its cost, its noise and the locks your grade opens; staff doors take your grade alone', () => {
    const X = loadCore();
    perk(X, 'planted_fingers', { openCost: (s, base, r) => base - 100, openQuiet: () => true, lockBonus: (s, r) => 1 });
    const map = ['#######', '#.....#', '#..v..#', '#..S..#', '#.....#', '#######'];
    const make = held => {
      const s = room(X, { map, you: [3, 1], fixtures: [{ k: 'case', x: 3, y: 2, room: 'room', num: 'T.0.1.1', glass: 1, lock: 2, hits: 0, st: 'shut', loan: false, holds: null, mimic: null }, { k: 'staff', x: 3, y: 3, grade: 2 }] });
      s.run.perks = held ? [{ id: 'planted_fingers', rank: 1 }] : [];
      return s;
    };
    const s0 = make(false);
    assert.equal(X.Step.step(s0, { a: 'open', x: 3, y: 2 })[0].reason, 'case_locked', 'grade I against lock II');
    assert.equal(X.Cases.describe(s0, s0.dept.fixtures[0]).canOpen, false);
    const s1 = make(true);
    assert.equal(X.Cases.describe(s1, s1.dept.fixtures[0]).canOpen, true);
    // Its label says what opens it: not your grade alone.
    assert.equal(json([X.Labels.ofCase(s0, s0.dept.fixtures[0]).odds[0], X.Labels.ofCase(s1, s1.dept.fixtures[0]).odds[0]]),
      json(['Its lock needs Grade II; you are Grade I.', 'Your perks open its lock (Grade II), above your grade (Grade I).']));
    assert.ok(X.Labels.ofCase(s1, s1.dept.fixtures[0]).actions.some(a => a.id === 'open'));
    const ev = X.Step.step(s1, { a: 'open', x: 3, y: 2 });
    assert.equal(json([ev.some(e => e.k === 'case_opened'), ev.some(e => e.k === 'noise'), s1.actors[0].next]), json([true, false, N.COST_OPEN_CASE - 100]));
    // The staff door's grade II is still above your grade I.
    const t = make(true); t.actors[0].x = 3; t.actors[0].y = 4;
    assert.equal(X.Step.step(t, { a: 'move', dir: 0 })[0].reason, 'staff_grade');
    // Without the perk, the noise is made and the cost is COST_OPEN_CASE.
    const u = make(false); u.run.grade = 2;
    const ev2 = X.Step.step(u, { a: 'open', x: 3, y: 2 });
    assert.equal(json([ev2.some(e => e.k === 'noise' && e.cause.k === 'case_opened'), u.actors[0].next]), json([true, N.COST_OPEN_CASE]));
  });

  test('the perks\' Padding and ring change are counted, the ring never below RING_MIN', () => {
    const X = loadCore();
    perk(X, 'planted_pad', { padding: (s, r) => 4, ringDelta: (s, r) => -9 });
    const s = room(X, {}), pad = s.actors[0].pad;
    assert.equal(X.Vision.ringRadius(s), N.RING_MOVING);
    hold(s, 'planted_pad');
    assert.equal(X.Vision.ringRadius(s), N.RING_MIN);
    assert.equal(s.actors[0].pad, pad, 'counted when you act');
    X.Step.step(s, { a: 'wait' });
    assert.equal(s.actors[0].pad, pad + 4);
    assert.equal(X.Kit.derive(s).pad, pad + 4);
  });

  test('the modules say whether pips decay and whether an idle awake exhibit goes back', () => {
    const X = loadCore();
    let decay = true, back = true;
    X.Modules.pipsDecay = () => decay; X.Modules.mayReturn = () => back;
    // A sleeper at 2 pips beyond your still ring, and an awake exhibit at home in an alcove,
    // out of sight, with nowhere else to wander.
    const map = ['############', '#....#######', '#....##.####', '#....#######', '############'];
    const make = () => room(X, { map, clock: { B: 500, G: 60 }, you: [1, 1], exhibits: [ex([4, 3], { pips: 2, stim: 0 }), ex([7, 2], { mode: 'awake', stim: 0, home: [7, 2] })] });
    const run = () => {
      const s = make(), out = [];
      for (let k = 0; k < N.PIP_DECAY_TURNS + 1; k++) for (const e of X.Step.step(s, { a: 'wait' })) if (e.k === 'pip' && e.cause.k === 'decay') out.push('decay');
      for (let k = 0; k < N.AWAKE_IDLE_TURNS; k++) for (const e of X.Step.step(s, { a: 'wait' })) if (e.k === 'lost' && e.to === 'returning') out.push('back');
      return out;
    };
    assert.ok(run().includes('decay') && run().includes('back'));
    decay = false; back = false;
    assert.equal(json(run()), json([]));
    assert.equal(X.Clock.pipsDecay(make()), false);
  });

  // ---- Seeing and the Lamp ----

  // An independent line of sight (§8.2: Bresenham from the endpoint first in row-major order,
  // blocked by a tile between that cannot be seen through).
  const SEE = new Set(['.', ',', "'", 's', 'E', 'X', 'v', 'u', 'k', 'x', 'w', 'p', 'f', 'l', 'b', '~', '=']);
  function los(map, x0, y0, x1, y1) {
    if (y1 < y0 || (y1 === y0 && x1 < x0)) [x0, y0, x1, y1] = [x1, y1, x0, y0];
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    while (!(x === x1 && y === y1)) {
      if (!(x === x0 && y === y0) && !SEE.has(map[y][x])) return false;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return true;
  }
  const foot = a => { const out = []; for (let dy = 0; dy < (a.size || 1); dy++) for (let dx = 0; dx < (a.size || 1); dx++) out.push([a.x + dx, a.y + dy]); return out; };
  const near = (dx, dy, r) => dx * dx + dy * dy <= r * r + r;

  test('observed: a tile of the exhibit in your sight within SIGHT_PLAYER, against an oracle over departments', () => {
    let yes = 0, no = 0;
    for (const acc of ['S9', 'A4', 'M11']) for (const seed of [1, 2]) {
      const s = C.Dept.create(seed, acc, 3), m = s.dept, you = s.actors[0];
      const spots = [];
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (C.Grid.walkable(m, x, y) && !C.Grid.closedDoor(m, x, y)) spots.push([x, y]);
      for (let i = 0; i < spots.length; i += 11) {
        [you.x, you.y] = spots[i];
        for (const a of s.actors.slice(1)) {
          const want = !a.gone && foot(a).some(([x, y]) => near(x - you.x, y - you.y, N.SIGHT_PLAYER) && los(m.tiles, you.x, you.y, x, y));
          assert.equal(C.Vision.observed(s, a), want, `${acc} seed ${seed}: ${a.uid} with you at ${you.x},${you.y}`);
          if (want) yes++; else no++;
        }
      }
    }
    assert.ok(yes > 300 && no > 300, `${yes} observed, ${no} not`);
  });

  const lamp = (where, extra) => Object.assign({ uid: 'lamp', kind: 'curio', where, prims: [{ id: 'observing', cls: 'M' }] }, extra);
  const WALL = ['###########', '#...#.....#', '#...#.....#', '#...#.....#', '###########'];

  test('the Lamp: lit or hooded where you wear it, for COST_USE; lit, exhibits within LAMP_OBSERVE_RANGE are observed behind a wall, and your ring is LAMP_RING larger', () => {
    const X = loadCore();
    // You at (2, 2); behind the wall, exhibits 4 tiles away (6, 2) and 5 away (7, 2).
    const s = room(X, { map: WALL, you: [2, 2], exhibits: [ex([6, 2]), ex([7, 2])], items: [lamp({ at: 'kit', slot: 'curio0' })] });
    const [, a, b] = s.actors, it = s.items.find(i => i.uid === 'lamp');
    assert.equal(json([X.Vision.observed(s, a), X.Vision.observed(s, b), X.Kit.observing(s), 'lit' in it]), json([false, false, 0, false]), 'hooded');
    assert.ok(X.Step.legal(s).some(x => x.a === 'use' && x.uid === 'lamp' && x.x === undefined));
    let ev = checked(X.Step.step(s, { a: 'use', uid: 'lamp' }));
    assert.equal(json(ev.slice(0, 1).map(e => [e.k, e.item, e.how, e.cause.k])), json([['used', 'lamp', 'light', 'use']]));
    assert.match(X.Text.event(ev[0]), /^You lit the lamp: every exhibit within 4 tiles of you counts as seen, even out of sight, and your ring is 1 larger\.$/);
    assert.equal(json([it.lit, X.Kit.observing(s), s.actors[0].next, X.Vision.observed(s, a), X.Vision.observed(s, b)]), json([true, N.LAMP_OBSERVE_RANGE, N.COST_USE, true, false]));
    // The ring: a use is not still, so 3, and 1 more lit; still, 2 and 1 more.
    assert.equal(X.Vision.ringRadius(s), N.RING_MOVING + N.LAMP_RING);
    X.Step.step(s, { a: 'wait' });
    assert.equal(X.Vision.ringRadius(s), N.RING_STILL + N.LAMP_RING);
    ev = checked(X.Step.step(s, { a: 'use', uid: 'lamp' }));
    assert.equal(json([ev[0].how, 'lit' in it, X.Kit.observing(s), X.Vision.ringRadius(s)]), json(['hood', false, 0, N.RING_MOVING]));
    assert.equal(X.Text.event(ev[0]), 'You hooded the lamp.');
    // Taking it off hoods it; in the tote it cannot be lit.
    X.Step.step(s, { a: 'use', uid: 'lamp' });
    X.Step.step(s, { a: 'unequip', slot: 'curio0' });
    assert.equal(json(['lit' in it, X.Kit.observing(s)]), json([false, 0]));
    assert.equal(X.Step.step(s, { a: 'use', uid: 'lamp' })[0].reason, 'not_equipped');
    assert.ok(!X.Step.legal(s).some(x => x.a === 'use' && x.uid === 'lamp'));
    // Aimed, it is refused; a curio that does not observe has no use, as before.
    const t = room(X, { items: [lamp({ at: 'kit', slot: 'curio1' }), { uid: 'ring', kind: 'curio', where: { at: 'kit', slot: 'curio0' }, prims: [{ id: 'acc', cls: 'S' }] }] });
    assert.equal(X.Step.step(t, { a: 'use', uid: 'lamp', x: 1, y: 1 })[0].reason, 'bad_use');
    assert.equal(X.Step.step(t, { a: 'use', uid: 'ring' })[0].reason, 'no_use');
    // Slowed, it takes twice as long, as every item action does.
    const u = room(X, { items: [lamp({ at: 'kit', slot: 'curio0' })], youStatuses: [{ id: 'slowed', turns: 5 }] });
    X.Step.step(u, { a: 'use', uid: 'lamp' });
    assert.equal(u.actors[0].next, 2 * N.COST_USE);
    // Its reach is a disc ("within r", §8.2), as sight's is, not a square: behind a wall, 4
    // east and 2 south is within 4, 4 east and 3 south is not.
    const DISC = ['##########', '#...#....#', '#...#....#', '#...#....#', '#...#....#', '#...#....#', '##########'];
    const v = room(X, { map: DISC, you: [1, 1], exhibits: [ex([5, 3]), ex([5, 4])], items: [lamp({ at: 'kit', slot: 'curio0' })] });
    X.Step.step(v, { a: 'use', uid: 'lamp' });
    assert.equal(json(v.actors.slice(1).map(e => [X.Vision.observed(v, e), near(e.x - 1, e.y - 1, N.LAMP_OBSERVE_RANGE)])), json([[true, true], [false, false]]));
    // Its Behaviour line states the rule with its numbers.
    assert.match(X.Kit.describe(t, 'lamp').line, /^Observing: worn as a curio, it is lit or hooded for 100 ticks, and taking it off hoods it; while it is lit, every exhibit within 4 tiles of you counts as seen by you, even out of your sight, and your ring is 1 larger\.$/);
  });

  // ---- The clock, the hall, the Centrepiece ----

  test('ClockRules.advance brings the next stage n turns closer, never before the next boundary: the bell in stage 0, the night watch in stage 1, nothing in stage 2', () => {
    const X = loadCore(), cause = { k: 'planted_alarm', by: 'nobody' };
    X.Registry.defineCause('stage', 'planted_alarm', { fields: { by: 'str' } });
    X.Text.defineCause('stage', 'planted_alarm', e => `planted ${e.stage} ${e.n}`);
    const at = (B, G, count) => room(X, { clock: { B, G, count } });
    const go = (s, n) => { const ev = []; X.ClockRules.advance(s, n, cause, ev); const c = s.dept.clock; return [c.stage, c.B, c.G, ev.map(e => [e.k, e.stage, e.n, e.cause.k])]; };
    assert.equal(json(go(at(100, 60, 10), N.ALARM_CLOCK_ADVANCE)), json([0, 70, 60, [['stage', 'bell_sooner', 30, 'planted_alarm']]]), 'the watch moves with the bell');
    assert.equal(json(go(at(100, 60, 10), 200)), json([0, 11, 60, [['stage', 'bell_sooner', 89, 'planted_alarm']]]), 'no closer than the next boundary');
    assert.equal(json(go(at(100, 60, 120), 30)), json([1, 100, 30, [['stage', 'watch_sooner', 30, 'planted_alarm']]]));
    assert.equal(json(go(at(100, 60, 120), 50)), json([1, 100, 21, [['stage', 'watch_sooner', 39, 'planted_alarm']]]));
    assert.equal(json(go(at(100, 60, 170), 30)), json([2, 100, 60, [['stage', 'nothing_sooner', 0, 'planted_alarm']]]));
    const none = room(X, {}), ev0 = [];
    X.ClockRules.advance(none, 30, cause, ev0);
    assert.equal(json(ev0), '[]', 'no clock, nothing');
    assert.throws(() => X.ClockRules.advance(at(100, 60, 10), -1, cause, []), /not a number of turns/);
    assert.throws(() => X.ClockRules.advance(at(100, 60, 10), 5, null, []), /for a cause/);
    // The bell then comes at the boundary where the count reaches the new B; the event reads.
    const s = at(100, 60, 10), ev = [];
    X.ClockRules.advance(s, 89, cause, ev);
    assert.equal(X.Text.event(ev[0]), 'planted bell_sooner 89');
    assert.equal(json(checked(X.Step.step(s, { a: 'wait' })).filter(e => e.k === 'stage').map(e => [e.stage, e.cause.count])), json([['bell', 11]]));
  });

  test('Hall.boundary runs first in boundary step 6, before the clock; a Ticket read calls Hall.onTicket after the hunters lose you', () => {
    const X = loadCore(), log = [];
    for (const [ns, fn] of [['Wake', 'decay'], ['Hall', 'boundary'], ['ClockRules', 'boundary'], ['Modules', 'alarmDecay'], ['Wake', 'lose'], ['Hall', 'onTicket']]) {
      const orig = X[ns][fn]; X[ns][fn] = (...args) => { log.push(`${ns}.${fn}`); return orig(...args); };
    }
    const s = room(X, { clock: { B: 300, G: 60 }, entrance: [9, 3] });
    X.Step.step(s, { a: 'wait' });
    assert.equal(json(log), json(['Wake.decay', 'Hall.boundary', 'ClockRules.boundary', 'Modules.alarmDecay']));
    log.length = 0;
    s.items.push(X.Kit.item({ uid: 'tk', kind: 'consumable', where: { at: 'tote' }, ck: 'ticket', n: 1 })); s.you.tote.push('tk');
    const ev = X.Step.step(s, { a: 'use', uid: 'tk' });
    assert.equal(json(log.slice(0, 2)), json(['Wake.lose', 'Hall.onTicket']));
    assert.ok(ev.some(e => e.k === 'used'));
  });

  test('a Centrepiece sleeps through the night-watch bell and a herald\'s call; only pips and damage wake it', () => {
    const X = loadCore();
    const cp = (at, extra) => ex(at, Object.assign({ role: 'centrepiece', size: 2 }, extra));
    // The bell: the Centrepiece is nearest, then a plain sleeper; the bell names only the sleeper.
    const s = room(X, { clock: { B: 10, G: 10, count: 49 }, you: [2, 3], exhibits: [cp([4, 2]), ex([8, 3]), ex([9, 1])] });
    assert.equal(json(X.ClockRules.nearestSleepers(s, 3).map(r => r.a.uid)), json(['T0.1.room.2', 'T0.1.room.3']));
    const ev = X.Step.step(s, { a: 'wait' }).filter(e => e.k === 'stage' && e.stage === 'night_bell');
    assert.equal(json(ev.map(e => e.woke)), json([['T0.1.room.2', 'T0.1.room.3']]));
    assert.equal(s.actors[1].mode, 'dormant');
    // The call: a herald beside you calls; the Centrepiece in its reach sleeps on, the other wakes.
    const h = room(X, { you: [2, 3], exhibits: [ex([3, 3], { arch: 'herald', mode: 'hunting', sawYou: false }), cp([5, 2]), ex([5, 5])] });
    const before = h.actors[2].pips;
    const tiles = X.Specials.tiles(h, h.actors[1], 'call');
    assert.ok(tiles.some(([x, y]) => x === 5 && y === 2) && tiles.some(([x, y]) => x === 5 && y === 5), 'both stand on marked tiles');
    // Every Behaviour-line invariant holds through it: the herald's clause says "never a
    // Centrepiece", and its invariant judges the call by the clause.
    const Inv = require(path.join(root, 'tools/invariants.js')), check = Inv.checker(X, Inv.select(X, 'all'));
    let woke = [];
    for (let k = 0; k < 3; k++) {
      const pre = X.State.clone(h), ev = X.Step.step(h, { a: 'wait' });
      assert.equal(json(check(pre, { a: 'wait' }, ev, h).map(v => v.text)), '[]');
      woke = woke.concat(ev.filter(e => e.k === 'woke').map(e => [e.who, e.cause.k]));
    }
    assert.equal(json(woke), json([['T0.1.room.3', 'herald']]));
    assert.match(X.Registry.SPECIALS.call.clause, /that can hear \(never a Centrepiece\)/);
    assert.equal(json([h.actors[2].mode, h.actors[2].pips]), json(['dormant', before]));
    // Damage still wakes it, hunting.
    X.Combat.hurt(h, h.actors[2], 1, { k: 'attack', by: 'you', at: h.actors[2].uid, chance: 75, roll: 1, raw: 1, pad: 0, how: { kind: 'melee' }, from: [4, 2] }, []);
    assert.equal(h.actors[2].mode, 'hunting');
  });

  // ---- The A8 hooks ----

  test('an exhibit whose archetype does not hunt on sight sees you, and stays as it was', () => {
    const X = loadCore();
    X.Registry.define('ARCHETYPES', 'planted_watcher', {});
    X.Archetypes.add('planted_watcher', { huntsOnSight: () => false });
    const s = room(X, { exhibits: [ex([6, 3], { mode: 'awake', arch: 'planted_watcher', target: [6, 3], stim: 0 }), ex([6, 1], { mode: 'awake', target: [6, 1], stim: 0 })] });
    const ev = X.Step.step(s, { a: 'wait' });
    assert.equal(json(s.actors.slice(1).map(a => [a.mode, a.sawYou])), json([['awake', true], ['hunting', true]]));
    assert.equal(json(ev.filter(e => e.k === 'hunting').map(e => e.who)), json(['T0.1.room.2']));
  });

  // An independent ring at RING_MOVING (§8.2): walking distance by the step rule from where you
  // would stand, one beyond the nearest tile you could step onto for a tile you cannot, and
  // line of sight; the tiles you could stand on from which a tile of the exhibit is inside it.
  const WALK = new Set(['.', ',', '+', "'", 'S', 's', 'E', 'X', 'u', 'k', 'x', 'w', 'b', '=']);
  const HOLD = new Set([...WALK, 'v', 'p']);
  const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  function region(map, a, r) {
    const h = map.length, w = map[0].length, at = (x, y) => x < 0 || y < 0 || x >= w || y >= h ? '#' : map[y][x];
    const mine = foot(a), out = [];
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      if (!WALK.has(at(px, py)) || at(px, py) === '+' || at(px, py) === 'S' || mine.some(([x, y]) => x === px && y === py)) continue;
      if (Math.max(...mine.map(([x, y]) => Math.max(Math.abs(x - px), Math.abs(y - py)))) > r + 2 && mine.every(([x, y]) => Math.max(Math.abs(x - px), Math.abs(y - py)) > r + 1)) continue;
      const dist = new Map([[`${px},${py}`, 0]]), queue = [[px, py]];
      for (let q = 0; q < queue.length; q++) {
        const [x, y] = queue[q], d = dist.get(`${x},${y}`);
        if (d >= r) continue;
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy;
          if (!WALK.has(at(nx, ny)) || dist.has(`${nx},${ny}`) || (dx && dy && !(WALK.has(at(nx, y)) && WALK.has(at(x, ny))))) continue;
          dist.set(`${nx},${ny}`, d + 1); queue.push([nx, ny]);
        }
      }
      const reach = (x, y) => {
        if (WALK.has(at(x, y))) return dist.has(`${x},${y}`) ? dist.get(`${x},${y}`) : -1;
        let best = -1;
        for (const [dx, dy] of DIRS) { const k = `${x + dx},${y + dy}`; if (WALK.has(at(x + dx, y + dy)) && dist.has(k) && (best < 0 || dist.get(k) + 1 < best)) best = dist.get(k) + 1; }
        return best;
      };
      if (mine.some(([x, y]) => HOLD.has(at(x, y)) && reach(x, y) >= 0 && reach(x, y) <= r && los(map, px, py, x, y))) out.push([px, py]);
    }
    return out;
  }

  test('wakeRegion\'s default is the ring at RING_MOVING with line of sight, once standing there gives the pips it needs, against an oracle over departments', () => {
    let tiles = 0, exhibits = 0;
    for (const acc of ['S9', 'A4', 'M11']) for (const seed of [1, 2, 3]) {
      const s = C.Dept.create(seed, acc, 4), m = s.dept;
      for (const a of s.actors.slice(1)) {
        if (a.mode !== 'dormant' || C.Archetypes.pipless(s, a)) continue;
        // The default alone: an exhibit with no hook of its own (a plodder's archetype file
        // adds none), so the combined region is the default's.
        const own = C.Archetypes.wakeRegion(s, a, N.PIPS_TO_WAKE);
        assert.equal(json(own), json(region(m.tiles, a, N.RING_MOVING)), `${acc} seed ${seed}: ${a.uid} (${a.arch})`);
        tiles += own.length; exhibits++;
        assert.equal(json(C.Archetypes.wakeRegion(s, a, N.PIPS_TO_WAKE - 1)), '[]', 'two turns give two pips, not three');
        const was = a.pips; a.pips = 1;
        assert.equal(json(C.Archetypes.wakeRegion(s, a, N.PIPS_TO_WAKE - 1)), json(own), 'with a pip already, two turns are enough');
        a.pips = was;
      }
    }
    assert.ok(exhibits > 40 && tiles > 400, `${exhibits} exhibits, ${tiles} tiles`);
    // Awake, gone or pipless: none.
    const X = loadCore();
    const s = room(X, { exhibits: [ex([6, 3]), ex([6, 1], { mode: 'awake' }), ex([8, 3], { arch: 'mimic_vitrine' })] });
    assert.ok(X.Archetypes.wakeRegion(s, s.actors[1], 3).length > 0);
    assert.equal(json(X.Archetypes.wakeRegion(s, s.actors[2], 3)), '[]');
    s.actors[1].gone = 1;
    assert.equal(json(X.Archetypes.wakeRegion(s, s.actors[1], 3)), '[]');
    // A closed door 2 tiles from it is within the ring and in its sight, but no tile to stand
    // on (a step into it opens it and leaves you where you were); it also blocks sight, so the
    // tiles beyond it are out.
    const d = room(X, { map: ['#########', '#...+...#', '#########'], you: [1, 1], exhibits: [ex([6, 1])] });
    const dr = X.Archetypes.wakeRegion(d, d.actors[1], 3);
    assert.equal(json(dr), json(region(d.dept.tiles, d.actors[1], N.RING_MOVING)));
    assert.equal(json(dr), json([[5, 1], [7, 1]]));
    // A 2×2 body is reached by any of its tiles.
    const t = room(X, { exhibits: [ex([6, 2], { size: 2 })] });
    assert.equal(json(X.Archetypes.wakeRegion(t, t.actors[1], 3)), json(region(t.dept.tiles, t.actors[1], N.RING_MOVING)));
  });
  // What waking does (§8.2), played: you on a tile with your ring at RING_MOVING (your last
  // action a use, so no Quiet), at turn boundaries, with the ring pip and pip decay as the
  // boundary runs them. A sleeper wakes at the boundary that gives it the pips it still needs
  // exactly when you stand in its region for that many turns, and from no other tile near it.
  test('wakeRegion\'s default is where waking happens: standing in it with a moving ring wakes it at the turn it says, and nowhere else near it', () => {
    let inside = 0, outside = 0;
    for (const acc of ['S9', 'A4', 'M11']) for (const seed of [1, 2]) {
      const base = C.Dept.create(seed, acc, 4), m = base.dept;
      base.actors.slice(1).forEach((a, i) => {
        if (a.mode !== 'dormant' || C.Archetypes.pipless(base, a) || a.trigger === 'axis' || a.trigger === 'tether') return;
        for (const pips of [0, N.PIPS_TO_WAKE - 1]) {
          const need = N.PIPS_TO_WAKE - pips, region = C.Archetypes.wakeRegion(Object.assign(C.State.clone(base), {}), Object.assign({}, a, { pips }), need);
          const key = t => t[0] + ',' + t[1], set = new Set(region.map(key));
          assert.equal(json(C.Archetypes.wakeRegion(base, Object.assign({}, a, { pips }), need - 1)), '[]');
          const near = [];
          for (const [x, y] of foot(a)) for (let dy = -N.RING_MOVING - 2; dy <= N.RING_MOVING + 2; dy++) for (let dx = -N.RING_MOVING - 2; dx <= N.RING_MOVING + 2; dx++) {
            const t = [x + dx, y + dy];
            if (C.Grid.inside(m, t[0], t[1]) && C.Grid.walkable(m, t[0], t[1]) && !C.Grid.closedDoor(m, t[0], t[1]) && !foot(a).some(f => key(f) === key(t)) && !near.some(n => key(n) === key(t))) near.push(t);
          }
          near.forEach((t, k) => {
            if (k % 3) return;
            const s = C.State.clone(base), b = s.actors[i + 1], you = s.actors[0], ev = [];
            [you.x, you.y] = t; you.still = false; you.lastAct = 'use'; b.pips = pips; b.stim = s.turn;
            let at = null;
            for (let n = 1; n <= need && at === null; n++) { s.turn++; C.Wake.boundary(s, ev); C.Wake.decay(s, ev); if (b.mode !== 'dormant') at = n; }
            const where = `${acc} seed ${seed}: ${a.uid} (${a.arch}) at ${pips} pips, you at ${key(t)}`;
            if (set.has(key(t))) { inside++; assert.equal(at, need, `${where}: in its region, it wakes at turn ${need}`); }
            else { outside++; assert.equal(at, null, `${where}: outside its region, it sleeps`); }
          });
        }
      });
    }
    assert.ok(inside > 300 && outside > 300, `${inside} tiles inside, ${outside} outside`);
  });
};
