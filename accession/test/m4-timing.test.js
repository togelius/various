// M4's time with the two cheap-action perks (plan A6, D4.2, D7.2; BUILD §8.1, §8.2; PG-PERKS-TIMING),
// with the real Duck and Cover and Close the Distance (rules/perks/{duck_and_cover,
// close_the_distance}.js), every invariant checked after every step (perks-timing.inv.js among
// them). A6's table:
//   - the floor: the real discount takes exactly PERK_DUCK_AND_COVER ticks off and step()
//     accepts it; one planted a tick deeper (49 ticks) throws;
//   - statuses count turns: Fixative with a discounted wait gives one more forced wait, and ends
//     at the same boundary; Fixative drunk with the discount keeps its start, your next decision
//     (mid-turn), and gives FIXATIVE_TURNS forced waits; a Consolidant or a Fumigant drunk with the discount, your next
//     decision then mid-turn after its turn's boundary, still heals every share and coughs every
//     turn (rules/status.js counts them from the next turn), at the ticks a full drink gives;
//   - the threat counts the discounted cost: a mark (or a due line) that would go off between
//     your discounted decision and a full turn's is no threat, and indeed does not go off
//     before your next decision; a step made free is no threat;
//   - the drawn ring after a free step is the ring the next boundary applies;
// and the perks together and where their sentences must stay true:
//   - both on one action: Close the Distance frees the step before Duck and Cover's discount is
//     asked (Perks.adjust's order), so the discount waits for your next action that takes time;
//   - Close the Distance's tie (planted, since no two damaging marks share a tile in play): the
//     first in spawn order with free steps left pays;
//   - a Centrepiece's burst marked on your tile (cp_burst, the Ordinance's and the Board's), which
//     no single step leaves: Close the Distance's free steps take you out of it, and its miss
//     leaves the discount; a due line (the chime's) missed at its boundary does too; a call never;
//   - two misses before the discount is spent leave one discount and one surprise, each said
//     once ("however many miss you before it");
//   - your death: a special that kills you leaves nothing waiting;
//   - Light Fingers' opening, discounted, takes its own ticks less PERK_DUCK_AND_COVER.
// The expected figures are worked out here from BUILD.md and the plan, never from the code.
'use strict';
module.exports = ({ test, assert, loadCore, root, path }) => {
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const C = loadCore();
  const { N } = C, X0 = C;
  const json = x => JSON.stringify(x);
  const T = N.TICKS_PER_TURN, CUT = N.PERK_DUCK_AND_COVER;
  const TOUGH = { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 };
  const WAIT = { a: 'wait' };
  const OPEN = ['################', ...Array.from({ length: 7 }, () => '#..............#'), '################'];
  const SNIPER = { sp: 'dummy', arch: 'axis_sniper', at: [9, 4], mode: 'hunting', stats: TOUGH };
  const room = (X, perks, spec, options) => {
    const s = X.Setup.room(1, Object.assign({ acc: 'T0', depth: 3, map: OPEN, you: [2, 4], exhibits: [Object.assign({}, SNIPER)] }, spec || {}), Object.assign({ invulnerable: true }, options || {}));
    s.run.perks = perks.map(([id, rank]) => ({ id, rank }));
    return s;
  };
  // Play actions with every invariant checked; fail on a violation.
  const play = (X, s, actions) => {
    const r = H.play(X, s, actions);
    assert.equal(r.violations.length, 0, json(r.violations.slice(0, 2).map(v => v.text)));
    return r;
  };
  const perkEv = (events, k) => events.filter(e => e.k === 'perk' && e.cause && e.cause.k === k);
  const waiting = s => (s.dept.perk && s.dept.perk.duck === true) || false;
  // Wait for the sniper's mark, step south off its line: it goes off missing you, and the
  // discount waits.
  const dodged = (X, perks, spec) => {
    const s = room(X, perks, spec);
    play(X, s, [WAIT, { a: 'move', dir: 4 }]);
    assert.ok(waiting(s), 'the miss left the discount waiting');
    return s;
  };

  test('A6 floor: the real discount takes exactly PERK_DUCK_AND_COVER ticks off a turn and step() accepts it; one planted a tick deeper (49 ticks) throws', () => {
    let X = loadCore(), s = dodged(X, [['duck_and_cover', 1]]);
    const before = s.actors[0].next;
    play(X, s, [WAIT]);
    assert.equal(s.actors[0].next - before, T - CUT);
    assert.equal(waiting(s), false, 'spent');
    // The same, with Perks.adjust planted to take one tick more off what Duck and Cover gives.
    X = loadCore(); s = dodged(X, [['duck_and_cover', 1]]);
    const adjust = X.Perks.adjust;
    X.Perks.adjust = (st, action, r, ev) => { const o = adjust(st, action, r, ev); return o.why === 'duck_and_cover' ? { r: o.r - 1, why: o.why } : o; };
    assert.throws(() => X.Step.step(s, WAIT), new RegExp(`wait cost ${T - CUT - 1} ticks \\(${T} before duck_and_cover\\)`));
  });

  test('A6 statuses count turns: Fixative with a discounted wait gives one more forced wait than without, and ends at the same boundary', () => {
    const forced = discounted => {
      const X = loadCore(), s = room(X, [['duck_and_cover', 1]], { exhibits: [] });
      X.Consumables.startRun(s);
      const it = X.Consumables.make(s, 'fixative', { at: 'floor', x: 2, y: 4 });
      it.where = { at: 'tote' }; s.you.tote.push(it.uid);
      s.run.knownSeals.push(X.Consumables.sealFor(s, 'fixative'));
      play(X, s, [{ a: 'use', uid: it.uid }]);
      const until = s.actors[0].statuses.find(t => t.id === 'fixed').until;
      assert.equal(until, X.Int.idiv(s.actors[0].next, T) + N.FIXATIVE_TURNS);
      // The discount a miss would leave, waiting as you begin your forced waits.
      if (discounted) s.dept.perk = { duck: true };
      const ticks = [];
      let ended = null;
      while (!X.Step.legal(s).some(a => a.a === 'move')) {
        ticks.push(s.tick);
        const e = play(X, s, [WAIT]).events.find(x => x.k === 'status' && x.who === 'you' && x.id === 'fixed' && !x.on);
        if (e) ended = e.tick;
        assert.ok(ticks.length < 10);
      }
      return { n: ticks.length, ticks, ended, until };
    };
    const full = forced(false), cut = forced(true);
    assert.equal(full.n, N.FIXATIVE_TURNS);
    assert.equal(cut.n, N.FIXATIVE_TURNS + 1, json(cut.ticks));
    assert.equal(json(cut.ticks.slice(0, 2)), json([T, T + T - CUT]));
    assert.equal(json([cut.until, cut.ended, full.ended]), json([full.until, full.until * T, full.until * T]), 'the same turns: it ends at the same boundary');
  });

  // Every other status keeps its start (BUILD §8.1): Fixative drunk with the discount (at 100, so
  // your next decision is at 150, after turn 1's boundary) holds you from that decision, for its
  // FIXATIVE_TURNS turns: forced waits at 150, 250, 350 and 450, and it ends at turn 5's boundary,
  // one turn before the full drink's (which holds you at 200 … 500 and ends at turn 6's).
  test('A6 statuses keep their start: Fixative drunk with the discount holds you from your next decision, mid-turn, for FIXATIVE_TURNS forced waits', () => {
    const drunk = discounted => {
      const X = loadCore(), s = room(X, [['duck_and_cover', 1]], { exhibits: [] });
      X.Consumables.startRun(s);
      const it = X.Consumables.make(s, 'fixative', { at: 'floor', x: 2, y: 4 });
      it.where = { at: 'tote' }; s.you.tote.push(it.uid);
      s.run.knownSeals.push(X.Consumables.sealFor(s, 'fixative'));
      play(X, s, [WAIT]);
      if (discounted) s.dept.perk = { duck: true };
      play(X, s, [{ a: 'use', uid: it.uid }]);
      const ticks = [];
      let ended = null;
      while (!X.Step.legal(s).some(a => a.a === 'move')) {
        ticks.push(s.tick);
        const e = play(X, s, [WAIT]).events.find(x => x.k === 'status' && x.who === 'you' && x.id === 'fixed' && !x.on);
        if (e) ended = e.tick;
        assert.ok(ticks.length < 10);
      }
      return { ticks, ended };
    };
    const want = first => Array.from({ length: N.FIXATIVE_TURNS }, (x, i) => first + i * T);
    assert.equal(json(drunk(false)), json({ ticks: want(2 * T), ended: (2 + N.FIXATIVE_TURNS) * T }));
    assert.equal(json(drunk(true)), json({ ticks: want(2 * T - CUT), ended: (1 + N.FIXATIVE_TURNS) * T }));
  });

  test('A6 statuses with a per-turn effect: a Consolidant or a Fumigant drunk with the discount, your next decision then mid-turn after its turn\'s boundary, heals every share and coughs every turn, at the ticks a full drink gives', () => {
    // Drunk at 100: with the discount your next decision is at 150, after turn 1's boundary.
    const course = (ck, discounted) => {
      const X = loadCore(), s = room(X, [['duck_and_cover', 1]], { map: ['#########', '#.......#', '#########'], you: [2, 1], exhibits: [] });
      s.actors[0].hp = 10; s.actors[0].maxHp = 40;
      X.Consumables.startRun(s);
      const it = X.Consumables.make(s, ck, { at: 'floor', x: 2, y: 1 });
      it.where = { at: 'tote' }; s.you.tote.push(it.uid);
      s.run.knownSeals.push(X.Consumables.sealFor(s, ck));
      play(X, s, [WAIT]);
      if (discounted) s.dept.perk = { duck: true };
      let ev = play(X, s, [{ a: 'use', uid: it.uid }]).events;
      assert.equal(s.actors[0].next, discounted ? 2 * T - CUT : 2 * T);
      const st = s.actors[0].statuses[0];
      for (let i = 0; i < 7; i++) ev = ev.concat(play(X, s, [WAIT]).events);
      const ended = ev.find(e => e.k === 'status' && e.who === 'you' && !e.on);
      return { heals: ev.filter(e => e.k === 'healed' && e.cause.k === 'status').map(e => [e.tick, e.amount]), coughs: ev.filter(e => e.k === 'noise' && e.cause.k === 'cough').map(e => e.tick), ended: ended && ended.tick, left: X.Status.left(s, s.actors[0], st.id) };
    };
    for (const ck of ['consolidant', 'fumigant']) {
      const full = course(ck, false), cut = course(ck, true), turns = ck === 'consolidant' ? N.CONSOLIDANT_HOT_TURNS : N.COUGH_TURNS;
      assert.equal(json(cut), json(full), ck);
      assert.equal((ck === 'consolidant' ? full.heals : full.coughs).length, turns, ck);
    }
    const shares = course('consolidant', true).heals.reduce((n, [, a]) => n + a, 0);
    assert.equal(shares, X0.Int.pct(40, N.CONSOLIDANT_HOT_PCT), 'every share');
  });

  test('A6 the threat counts the discounted cost: a mark due to go off before a full turn but after the discounted one is no threat, and indeed waits; a free step is no threat', () => {
    // A hunter marks a ring round it, your tile among its tiles, and acts next at tick 75.
    const marked = (X, perks, due) => {
      const s = X.Setup.room(1, { acc: 'T0', depth: 3, map: OPEN, you: [2, 4], exhibits: [{ sp: 'dummy', at: [3, 4], mode: 'hunting', sawYou: true, stats: { hp: 999, acc: -99, eva: 0, pad: 0, dmin: 1, dmax: 1 } }] }, { invulnerable: true });
      s.run.perks = perks.map(([id, rank]) => ({ id, rank }));
      const a = s.actors[1];
      X.Specials.mark(s, a, 'ring', X.Specials.tiles(s, a, 'ring'), [], due ? { due: T } : undefined);
      if (!due) { a.next = 75; a.notBefore = null; }
      return s;
    };
    for (const due of [false, true]) {
      const X = loadCore();
      // Without a discount: your wait ends at 100, after it goes off (at 75, or at the boundary
      // at 100, which runs before your decision there): a threat, which comes true.
      let s = marked(X, [['duck_and_cover', 1]], due);
      const t = X.Specials.threat(s, WAIT);
      assert.ok(t && t.x === 2 && t.y === 4 && t.by === s.actors[1].uid, `${due ? 'due' : 'marked'}: ${json(t)}`);
      let r = play(X, s, [WAIT]);
      assert.ok(r.events.some(e => e.k === 'damaged' && e.who === 'you' && e.amount === t.dmg), 'the threat came true, for its number');
      // With the discount waiting: your wait ends at 50, before it goes off: no threat, and
      // nothing struck you by your next decision.
      s = marked(X, [['duck_and_cover', 1]], due); s.dept.perk = { duck: true };
      assert.equal(X.Specials.threat(s, WAIT), null, due ? 'due' : 'marked');
      r = play(X, s, [WAIT]);
      assert.equal(json([s.tick, r.events.some(e => e.k === 'damaged')]), json([T - CUT, false]));
      assert.ok(s.actors[1].telegraph, 'still pending at your discounted decision');
    }
    // Close the Distance: a step toward the sniper whose line is on your tile is free, so nothing
    // can go off before your next decision: no threat; a step away is a full turn: a threat.
    const X = loadCore(), s = room(X, [['close_the_distance', 1]]);
    play(X, s, [WAIT]);
    assert.equal(X.Specials.threat(s, { a: 'move', dir: 2 }), null);
    assert.ok(X.Specials.threat(s, { a: 'move', dir: 6 }), 'stepping along it, away');
  });

  test('A6 the ring drawn after a free step is the ring the next boundary applies: after a wait (ring 2), a free step draws the moving ring, and a wait then applies it', () => {
    const run = perks => {
      const X = loadCore(), seen = [];
      // A sleeper 3 walking tiles from the tile you step onto, 4 from where you wait.
      const s = room(X, perks, { exhibits: [Object.assign({}, SNIPER), { sp: 'dummy', at: [6, 6], mode: 'dormant', pips: 0, stats: TOUGH }] });
      const wb = X.Wake.boundary;
      X.Wake.boundary = (st, ev) => { seen.push([st.tick, X.Vision.field(st).r]); return wb(st, ev); };
      play(X, s, [WAIT]);
      const r1 = play(X, s, [{ a: 'move', dir: 2 }]);
      const drawn = X.Vision.ringRadius(s), at = s.tick;
      const r2 = play(X, s, [WAIT]);
      const pips = r2.events.filter(e => e.k === 'pip' && e.who === s.actors[2].uid && e.cause.k === 'ring').map(e => [e.tick, e.cause.r]);
      return { free: perkEv(r1.events, 'close').length, drawn, at, seen, pips };
    };
    const on = run([['close_the_distance', 1]]);
    assert.equal(json([on.free, on.at, on.drawn]), json([1, T, N.RING_MOVING]), 'the free step at 100 draws the moving ring');
    assert.equal(json(on.seen.slice(1)), json([[2 * T, N.RING_MOVING]]), 'the boundary at 200 (in the wait) applies it');
    assert.equal(json(on.pips), json([[2 * T, N.RING_MOVING]]));
  });

  test('both perks on one action: Close the Distance frees the step before Duck and Cover\'s discount is asked, so the discount waits for your next action that takes time', () => {
    const X = loadCore(), s = room(X, [['duck_and_cover', 2], ['close_the_distance', 1]]);
    play(X, s, [WAIT]);
    // The discount a miss would leave, waiting as you step toward the sniper on its line.
    s.dept.perk = { duck: true };
    let r = play(X, s, [{ a: 'move', dir: 2 }]);
    assert.equal(json([s.tick, s.actors[0].next, perkEv(r.events, 'close').length, waiting(s)]), json([T, T, 1, true]), 'free, and the discount still waits');
    r = play(X, s, [WAIT]);
    assert.equal(json([s.actors[0].next, waiting(s)]), json([2 * T - CUT, false]), 'the wait took the discount');
    // The order of Perks.adjust's hooks makes it so: whatever order you took them in.
    const t = room(X, [['close_the_distance', 1], ['duck_and_cover', 2]]);
    play(X, t, [WAIT]); t.dept.perk = { duck: true };
    play(X, t, [{ a: 'move', dir: 2 }]);
    assert.equal(json([t.actors[0].next, waiting(t)]), json([T, true]));
  });

  test('Close the Distance\'s tie, which no two damaging marks sharing a tile leaves to arise in play: planted so, the first in spawn order with free steps left pays', () => {
    const X = loadCore();
    const s = X.Setup.room(1, { acc: 'T0', depth: 3, map: OPEN, you: [2, 4], exhibits: [Object.assign({}, SNIPER), Object.assign({}, SNIPER, { at: [9, 6] })] }, { invulnerable: true });
    s.run.perks = [{ id: 'close_the_distance', rank: 1 }];
    const [, a, b] = s.actors, line = [[2, 4], [3, 4], [4, 4], [5, 4]];
    // Two marks on one row (an impossible state, §8.1's no overlaps), both covering your tiles.
    for (const e of [a, b]) e.telegraph = { sp: 'line', tiles: line.map(t => t.slice()), from: line.map(() => [9, 4]), via: line.map(() => null), gross: 1, effect: 'damage', turn: 0, tick: 0 };
    a.next = b.next = 500;
    const close = ev => ev.filter(e => e.k === 'perk' && e.cause.k === 'close').map(e => e.cause.who);
    assert.equal(json(close(X.Step.step(s, { a: 'move', dir: 2 }))), json([a.uid]), 'the first pays');
    assert.equal(json(close(X.Step.step(s, { a: 'move', dir: 2 }))), json([b.uid]), 'then, its step spent, the next');
    assert.equal(json([s.actors[0].next, close(X.Step.step(s, { a: 'move', dir: 2 }))]), json([0, []]), 'then none');
  });

  test('a Centrepiece\'s burst on your tile, which no single step leaves: Close the Distance\'s free steps take you out, and its miss leaves Duck and Cover\'s discount; a due line missed at its boundary does too; a call never', () => {
    const X = loadCore();
    // A hunter two tiles east marks the burst (cp_burst) on your tile and round it.
    const s = X.Setup.room(1, { acc: 'T0', depth: 3, map: OPEN, you: [2, 4], exhibits: [{ sp: 'dummy', at: [5, 4], mode: 'hunting', sawYou: true, stats: TOUGH }] }, { invulnerable: true });
    s.run.perks = [{ id: 'duck_and_cover', rank: 1 }, { id: 'close_the_distance', rank: 2 }];
    const a = s.actors[1];
    X.Specials.mark(s, a, 'cp_burst', X.Specials.tiles(s, a, 'burst'), []);
    assert.equal(a.telegraph.tiles.length, 9);
    // Two free steps toward it, the second off the burst's square, then a wait while it goes off.
    let r = play(X, s, [{ a: 'move', dir: 2 }, { a: 'move', dir: 3 }]);
    assert.equal(json([s.tick, perkEv(r.events, 'close').map(e => e.cause.n)]), json([0, [1, 2]]));
    assert.ok(!a.telegraph.tiles.some(([x, y]) => x === s.actors[0].x && y === s.actors[0].y), 'off the square');
    r = play(X, s, [WAIT]);
    const went = r.events.find(e => e.k === 'special' && e.who === a.uid);
    assert.ok(went && !went.hits.includes('you'));
    assert.equal(json(perkEv(r.events, 'duck').map(e => e.cause.who)), json([a.uid]));
    // A due line (the chime's form: due at a boundary), marked on your tile; you step off it, and
    // it goes off at its boundary, inside your step: the discount waits.
    const d = X.Setup.room(1, { acc: 'T0', depth: 3, map: OPEN, you: [2, 4], exhibits: [Object.assign({}, SNIPER, { mode: 'hunting' })] }, { invulnerable: true });
    d.run.perks = [{ id: 'duck_and_cover', rank: 1 }];
    X.Specials.mark(d, d.actors[1], 'line', X.Specials.tiles(d, d.actors[1], 'line'), [], { due: 2 * T });
    r = play(X, d, [WAIT, { a: 'move', dir: 4 }]);
    assert.equal(json(perkEv(r.events, 'duck').map(e => [e.tick, e.cause.who])), json([[2 * T, d.actors[1].uid]]));
    // A call on your tile is no damaging special: nothing.
    const c = X.Setup.room(1, { acc: 'T0', depth: 3, map: OPEN, you: [2, 4], exhibits: [{ sp: 'dummy', arch: 'herald', at: [4, 4], mode: 'hunting', sawYou: true, stats: TOUGH }] }, { invulnerable: true });
    c.run.perks = [{ id: 'duck_and_cover', rank: 2 }, { id: 'close_the_distance', rank: 2 }];
    X.Specials.mark(c, c.actors[1], 'call', X.Specials.tiles(c, c.actors[1], 'call'), []);
    r = play(X, c, [{ a: 'move', dir: 2 }, { a: 'move', dir: 6 }, WAIT, WAIT]);
    assert.ok(r.events.some(e => e.k === 'special' && e.who === c.actors[1].uid));
    assert.equal(json([perkEv(r.events, 'duck').length, perkEv(r.events, 'close').length]), json([0, 0]));
  });

  // "However many miss you before it" (the clause): two marks that covered your tiles when they
  // were made (planted: one on your tile, one on the tile east of it, as if you stood there when
  // it was marked; their owners act at 50, inside your step) both go off as you step south off
  // them, both missing you: one discount and, at the second rank, one surprise attack, each said
  // once, after the first miss; your next wait takes PERK_DUCK_AND_COVER ticks less, the one
  // after it a turn.
  test('two misses before the discount is spent leave one discount, and one surprise attack, each said once', () => {
    const X = loadCore(), DUMMY = { sp: 'dummy', mode: 'hunting', sawYou: true, stats: TOUGH };
    const s = X.Setup.room(1, { acc: 'T0', depth: 3, map: OPEN, you: [2, 4], exhibits: [Object.assign({ at: [9, 2] }, DUMMY), Object.assign({ at: [9, 6] }, DUMMY)] }, { invulnerable: true });
    s.run.perks = [{ id: 'duck_and_cover', rank: 2 }];
    const [, a, b] = s.actors;
    for (const [e, tile] of [[a, [2, 4]], [b, [3, 4]]]) {
      e.telegraph = { sp: 'line', tiles: [tile], from: [[e.x, e.y]], via: [null], gross: 1, effect: 'damage', turn: 0, tick: 0 };
      e.next = CUT; e.notBefore = null;
    }
    const r = play(X, s, [{ a: 'move', dir: 4 }]);
    const went = r.events.filter(e => e.k === 'special').map(e => [e.who, e.hits]);
    assert.equal(json(went), json([[a.uid, []], [b.uid, []]]), 'both went off, missing you');
    assert.equal(json(['duck', 'sure'].map(k => perkEv(r.events, k).map(e => e.cause.who))), json([[a.uid], [a.uid]]));
    play(X, s, [WAIT]);
    assert.equal(s.actors[0].next, 2 * T - CUT, 'one discount');
    play(X, s, [WAIT]);
    assert.equal(json([s.actors[0].next, X.Perks.charges(s)[0].charge]), json([3 * T - CUT, { ticks: 0, surprise: true }]), 'spent; the surprise waits');
  });

  test('your death: a special that kills you leaves nothing waiting', () => {
    const X = loadCore(), s = X.Setup.room(1, { acc: 'T0', depth: 3, map: OPEN, you: [2, 4], exhibits: [Object.assign({}, SNIPER)] });
    s.run.perks = [{ id: 'duck_and_cover', rank: 2 }, { id: 'close_the_distance', rank: 2 }];
    s.actors[0].hp = 1;
    const r = play(X, s, [WAIT, WAIT]);
    assert.equal(json([!!s.over, perkEv(r.events, 'duck').length, perkEv(r.events, 'sure').length, json(X.Perks.charges(s).map(p => p.charge))]), json([true, 0, 0, json([null, null])]));
  });

  test('Light Fingers\' opening, with the discount waiting, takes its own ticks less PERK_DUCK_AND_COVER', () => {
    const X = loadCore();
    const s = X.Setup.room(1, { acc: 'T0', depth: 3, map: ['#######', '#.v...#', '#######'], you: [3, 1], fixtures: [{ k: 'case', x: 2, y: 1, room: 'room', num: 'T.1', glass: 1, lock: 1, hits: 0, st: 'shut', loan: false, holds: null, mimic: null }] });
    s.run.perks = [{ id: 'light_fingers', rank: 1 }, { id: 'duck_and_cover', rank: 1 }];
    s.dept.perk = { duck: true };
    play(X, s, [{ a: 'open', x: 2, y: 1 }]);
    assert.equal(json([s.actors[0].next, waiting(s)]), json([N.PERK_LIGHT_FINGERS_COST - CUT, false]));
  });
};
