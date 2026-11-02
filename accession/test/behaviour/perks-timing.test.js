// ACCESSION — the Artillery perks Duck and Cover ('duck_and_cover') and Close the Distance
// ('close_the_distance') (BUILD.md §8.1, §8.7; M4 plan PG-PERKS-TIMING, A6, A11's Close the
// Distance row, D4.3, D4.4; the PROGRESS map's PR2, PR3), joined up: real actions in rooms at
// depths 1–7, every invariant checked after every step (perks-timing.inv.js among them), the
// main runs clone-checked. A perk is held by planting it in run.perks (PG-CORE: the perk sheet is
// UI-PROGRESS's). Each scenario of what a perk does is run at both ranks, and again with its perk
// switched off (rulesOff), when it must fail (§5.3, check 3: the harness's sweep does it); one of
// what a perk leaves as it is says why (holdsWithout). The figures expected are worked out here
// from BUILD's sentences:
//   - Duck and Cover: a damaging special marked on your tile that goes off with you off it leaves
//     one discount (the log says so), so your next action that takes time takes
//     PERK_DUCK_AND_COVER ticks less; at the second rank a surprise attack waits too, and your
//     next blow at anything but the Night Watchman catches it by surprise, whatever it is doing
//     (a hunter), for the figure its odds and its Attack button show; a mark that struck you, or
//     that was never on your tile, gives nothing;
//   - Close the Distance: a step toward an exhibit whose damaging mark covers your tile takes no
//     time, PERK_CLOSE_STEPS[rank − 1] times for each exhibit; a step away, or beside it at the
//     same walking distance, or with no mark on your tile, takes its time.
// A6's time (the floor, the threat, the ring, statuses) is test/m4-timing.test.js's.
'use strict';
const H = require('./_harness.js');

module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { N, Registry: R, Clauses, Labels, Text, Perks } = C;
  const json = JSON.stringify;
  const DEPTHS = H.DEPTHS.map(depth => ({ sp: null, depth }));
  const ok = (results, name) => { const f = H.failures(results); assert.equal(f.length, 0, `${name}:\n${f.slice(0, 5).join('\n')}`); };
  const TOUGH = { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 };
  const WAIT = { a: 'wait' };
  const hold = (s, perks) => { s.run.perks = perks.map(([id, rank]) => ({ id, rank })); return s; };
  const say = (s, e) => Text.event(e, Labels.nameOf(s));
  const perkEv = (events, k) => events.filter(e => e.k === 'perk' && e.cause && e.cause.k === k);

  // A room with you at (2, 4) and a hunting sniper (axis_sniper) at (9, 4), in your row: at its
  // first action, at tick 0, it marks its line along the row, your tile among its tiles, and
  // its next action, at your next decision's tick (100), sets it off.
  const OPEN = ['################', ...Array.from({ length: 7 }, () => '#..............#'), '################'];
  const SNIPER = { sp: 'dummy', arch: 'axis_sniper', at: [9, 4], mode: 'hunting', stats: TOUGH };
  const sniperRoom = (depth, opts, perks, extra) => hold(C.Setup.room(opts.seed, Object.assign({ acc: 'T0', depth, map: OPEN, you: [2, 4],
    exhibits: [Object.assign({}, SNIPER)] }, extra || {}), { rulesOff: opts.rulesOff, invulnerable: true }), perks);

  // ---- The registry ----

  test('the registry: both perks at ready true, their clauses naming their numbers as parameters (no digit, a rank in words), their rules added', () => {
    const fill = e => Clauses.fill(e.clause, Clauses.params(e.params, null, { depth: 1 }));
    for (const id of ['duck_and_cover', 'close_the_distance']) {
      const e = R.PERKS[id];
      assert.equal(json([e.built, e.ready, e.tests, e.inv, e.family]), json(['M4', true, ['behaviour/perks-timing.test.js', 'm4-timing.test.js'], 'perks-timing', 'artillery']), id);
      assert.ok(Perks.added(id), `${id} registers its rules`);
      assert.ok(!/[0-9]/.test(e.clause.replace(/\{[^}]*\}/g, '')), `${id}: a digit in "${e.clause}"`);
    }
    assert.equal(fill(R.PERKS.duck_and_cover), `When a damaging special marked on your tile goes off and misses you, your next action that takes time costs ${N.PERK_DUCK_AND_COVER} ticks less, however many miss you before it. At the second rank your next blow or shot at anything but the Night Watchman (never caught by surprise) is also a surprise attack, whatever its target is doing.`);
    assert.equal(fill(R.PERKS.close_the_distance), `A step that brings you nearer, in walking tiles, to an exhibit whose damaging special is marked on your tile takes no time, up to ${N.PERK_CLOSE_STEPS[0]} such step toward each exhibit in a visit, or ${N.PERK_CLOSE_STEPS[1]} at the second rank. Damaging specials are never marked on the same tile, so the step is counted for that exhibit alone.`);
    // "such step" is singular at the first rank: one free step an exhibit.
    assert.equal(N.PERK_CLOSE_STEPS[0], 1);
  });

  // ---- Duck and Cover ----

  // You wait (it marks), step south off its line (at 100; it goes off and misses you), then wait
  // twice: the first wait takes PERK_DUCK_AND_COVER ticks less, the second a turn. With the perk
  // your next decision ends at 350 (100 + 100 + 50 + 100), without it at 400.
  const dodge = rank => H.scenario({
    name: `Duck and Cover at rank ${rank}: a special marked on your tile that misses you makes your next action that takes time cheaper${rank === 2 ? ', and a surprise attack waits' : ''}`,
    id: 'PERKS.duck_and_cover', clone: true,
    build: (params, sp, depth, opts) => sniperRoom(depth, opts, [['duck_and_cover', rank]]),
    actions: [WAIT, { a: 'move', dir: 4 }, WAIT, WAIT],
    expect(r) {
      const uid = r.start.actors[1].uid, ducks = perkEv(r.events, 'duck'), sures = perkEv(r.events, 'sure');
      const missed = r.steps[1].events.find(e => e.k === 'special' && e.who === uid);
      if (!missed || missed.hits.includes('you')) return `its line did not go off missing you at your step off it: ${json(missed)}`;
      if (ducks.length !== 1 || ducks[0].cause.who !== uid || r.steps[1].events.indexOf(ducks[0]) !== r.steps[1].events.indexOf(missed) + 1) return `the discount was not said once, at once after the miss: ${json(ducks)}`;
      if (sures.length !== (rank === 2 ? 1 : 0)) return `${sures.length} surprise attacks given at rank ${rank}`;
      const you = r.state.actors[0], want = 3 * N.TICKS_PER_TURN + N.TICKS_PER_TURN - N.PERK_DUCK_AND_COVER;
      if (you.next !== want) return `your next decision is at ${you.next}, not ${want}: the wait after the miss took ${N.TICKS_PER_TURN - N.PERK_DUCK_AND_COVER} ticks, the next a turn`;
      const charge = Perks.charges(r.state).find(p => p.id === 'duck_and_cover').charge;
      if (json(charge) !== json(rank === 2 ? { ticks: 0, surprise: true } : null)) return `what waits after the discount is spent: ${json(charge)}`;
      return null;
    },
  });
  test('Duck and Cover, joined up, at both ranks: a special marked on your tile that misses you makes your next action that takes time PERK_DUCK_AND_COVER ticks cheaper, once (and at the second rank leaves a surprise attack waiting); with it switched off it does not', () => {
    for (const rank of [1, 2]) ok(H.sweep(C, dodge(rank), DEPTHS), `rank ${rank}`);
    // Its sentences name the perk, never its id, and say what waits.
    const s = sniperRoom(3, { seed: 1, rulesOff: [] }, [['duck_and_cover', 2]]), ev = H.play(C, s, [WAIT, { a: 'move', dir: 4 }]).events;
    assert.equal(say(s, perkEv(ev, 'duck')[0]), `Duck and Cover: a special marked on your tile went off and missed you, so your next action that takes time costs ${N.PERK_DUCK_AND_COVER} ticks less.`);
    assert.equal(say(s, perkEv(ev, 'sure')[0]), 'Duck and Cover: your next blow or shot at anything but the Night Watchman is also a surprise attack.');
    assert.equal(json(Perks.charges(s)), json([{ id: 'duck_and_cover', rank: 2, charge: { ticks: N.PERK_DUCK_AND_COVER, surprise: true } }]));
  });

  // A mark that struck you (you stay on the line), and one that was never on your tile (planted
  // on two tiles south of the row, which it then sets off as it would its own), give nothing.
  const nothing = H.scenario({
    name: 'Duck and Cover: a mark that struck you, or was never on your tile, gives nothing',
    id: 'PERKS.duck_and_cover', clone: true,
    holdsWithout: 'it shows what Duck and Cover leaves as it is: no miss of a mark on your tile, no discount',
    build(params, sp, depth, opts) {
      const s = sniperRoom(depth, opts, [['duck_and_cover', 2]], { exhibits: [Object.assign({}, SNIPER), Object.assign({}, SNIPER, { at: [12, 7] })] });
      C.Specials.mark(s, s.actors[2], 'line', [[12, 6], [12, 5]], []);
      return s;
    },
    actions: [WAIT, WAIT, WAIT],
    expect(r) {
      const [, a, b] = r.state.actors;
      const went = uid => r.events.find(e => e.k === 'special' && e.who === uid && !e.cancelled);
      if (!went(a.uid) || !went(a.uid).hits.includes('you')) return 'the line on your tile did not strike you';
      if (!went(b.uid) || went(b.uid).hits.includes('you')) return 'the mark off your tile did not go off missing you';
      if (perkEv(r.events, 'duck').length || perkEv(r.events, 'sure').length) return `Duck and Cover answered: ${json(perkEv(r.events, 'duck'))}`;
      return r.state.actors[0].next === 3 * N.TICKS_PER_TURN ? null : `your waits took ${r.state.actors[0].next} ticks, not ${3 * N.TICKS_PER_TURN}`;
    },
  });
  test('Duck and Cover gives nothing for a mark that struck you, or one never on your tile', () => ok(H.sweep(C, nothing, DEPTHS), 'nothing'));

  // At the second rank, the surprise waiting (as a miss leaves it: dept.perk.sure), your blow at a
  // hunter beside you, which no blow surprises otherwise, catches it by surprise: certain, at your
  // weapon's most less its Padding, the figure its odds and its Attack button show; and spends it.
  // A blow at the Night Watchman beside you first is no surprise and spends nothing.
  const HUNTER = { sp: 'dummy', at: [3, 4], mode: 'hunting', sawYou: true, stats: { hp: 999, acc: -99, eva: 0, pad: 1, dmin: 1, dmax: 1 } };
  const WATCHMAN = { sp: 'night_watchman', at: [1, 4], mode: 'hunting', sawYou: true, stats: { hp: 999, acc: -99, eva: 0, pad: 0, dmin: 1, dmax: 1 } };
  const shown = new Map();
  const surprise = rank => H.scenario({
    name: `Duck and Cover at rank ${rank}: with a surprise attack waiting, your blow at a hunter is a surprise, for what its odds show; the Night Watchman is never surprised`,
    id: 'PERKS.duck_and_cover', clone: true,
    build(params, sp, depth, opts) {
      const s = hold(C.Setup.room(opts.seed, { acc: 'T0', depth, map: OPEN, you: [2, 4], exhibits: [HUNTER, WATCHMAN] }, { rulesOff: opts.rulesOff, invulnerable: true }), [['duck_and_cover', rank]]);
      s.dept.perk = { sure: true };
      return s;
    },
    actions(state, i) {
      const [, hunter, watchman] = state.actors;
      if (i === 0) { shown.clear(); return { a: 'attack', uid: watchman.uid }; }
      if (i === 1) {
        const label = Labels.of(state, hunter.uid);
        shown.set('odds', label.odds.find(l => l.startsWith('A surprise attack now')) || null);
        shown.set('button', label.actions.map(x => x.text).find(t => t.startsWith('Attack')) || null);
        return { a: 'attack', uid: hunter.uid };
      }
      return null;
    },
    expect(r) {
      const [, hunter, watchman] = r.start.actors, you = r.start.actors[0];
      const blowAt = (i, uid) => r.steps[i].events.find(e => (e.k === 'damaged' || e.k === 'missed') && (e.who === uid || e.at === uid) && e.cause && e.cause.by === 'you');
      const atWatch = blowAt(0, watchman.uid);
      if (!atWatch || atWatch.cause.surprise) return `your blow at the Night Watchman: ${json(atWatch)}, which must be no surprise`;
      const hit = blowAt(1, hunter.uid), want = Math.max(N.DMG_MIN_ON_HIT, C.Combat.surpriseRaw(you, { kind: 'melee' }) - HUNTER.stats.pad);
      if (!hit || hit.k !== 'damaged' || hit.cause.surprise !== 1 || hit.amount !== want) return `your blow at the hunter: ${json(hit)}, not a surprise for ${want}`;
      if (shown.get('odds') !== `A surprise attack now would hit for certain, for ${want}.`) return `its odds said ${json(shown.get('odds'))}`;
      if (shown.get('button') !== `Attack: certain hit, ${want} damage`) return `its Attack button said ${json(shown.get('button'))}`;
      if (Perks.charges(r.state)[0].charge !== null) return `the surprise still waits after the blow: ${json(Perks.charges(r.state))}`;
      return null;
    },
  });
  test('Duck and Cover at the second rank: a surprise attack waiting catches a hunter by surprise, for the figure its odds and Attack button show, and is spent; the Night Watchman is never caught by it', () => {
    ok(H.sweep(C, surprise(2), DEPTHS), 'rank 2');
    // At the first rank a surprise never waits (a miss leaves none): planted, it counts for nothing.
    const r = surprise(1).run(C, null, 3, { seed: 1 });
    assert.match(r.failure || '', /not a surprise/);
  });

  // ---- Close the Distance ----

  // You wait (it marks its line along your row), then step east toward it three times along the
  // line: the first step (and at the second rank the second) takes no time; the rest a turn.
  const closing = rank => H.scenario({
    name: `Close the Distance at rank ${rank}: ${N.PERK_CLOSE_STEPS[rank - 1]} step(s) toward an exhibit whose mark covers your tile take no time`,
    id: 'PERKS.close_the_distance', clone: true,
    build: (params, sp, depth, opts) => sniperRoom(depth, opts, [['close_the_distance', rank]]),
    actions: [WAIT, { a: 'move', dir: 2 }, { a: 'move', dir: 2 }, { a: 'move', dir: 2 }],
    expect(r) {
      const uid = r.start.actors[1].uid, free = N.PERK_CLOSE_STEPS[rank - 1], said = perkEv(r.events, 'close');
      if (json(said.map(e => [e.cause.who, e.cause.n, e.cause.of])) !== json(Array.from({ length: free }, (x, i) => [uid, i + 1, free]))) return `the free steps said: ${json(said.map(e => e.cause))}`;
      for (let i = 1; i <= free; i++) {
        const ks = r.steps[i].events.map(e => e.k);
        if (json(ks) !== json(['moved', 'perk'])) return `step ${i} was free, but more happened in it: ${json(ks)}`;
      }
      const want = (4 - free) * N.TICKS_PER_TURN;
      return r.state.actors[0].next === want ? null : `your next decision is at ${r.state.actors[0].next}, not ${want}`;
    },
  });
  test('Close the Distance, joined up, at both ranks: PERK_CLOSE_STEPS[rank − 1] steps toward an exhibit whose mark covers your tile take no time, and no more; with it switched off they do not', () => {
    for (const rank of [1, 2]) ok(H.sweep(C, closing(rank), DEPTHS), `rank ${rank}`);
    const s = sniperRoom(3, { seed: 1, rulesOff: [] }, [['close_the_distance', 2]]);
    H.play(C, s, [WAIT]);
    assert.equal(json(Perks.charges(s)), json([{ id: 'close_the_distance', rank: 2, charge: { who: s.actors[1].uid, steps: 2 } }]));
    const ev = H.play(C, s, [{ a: 'move', dir: 2 }]).events;
    assert.equal(say(s, perkEv(ev, 'close')[0]), 'Close the Distance: your step toward the training dummy, whose special was marked on your tile, took no time (free step 1 of 2 toward it).');
    assert.equal(json(Perks.charges(s)[0].charge), json({ who: s.actors[1].uid, steps: 1 }));
  });

  // A step away from it, one beside it that keeps your walking distance (north: 7 either way),
  // and one before any mark lies on your tile, take their time.
  const notToward = (name, first, actions, want) => H.scenario({
    name: `Close the Distance: ${name} takes its time`,
    id: 'PERKS.close_the_distance', clone: true,
    holdsWithout: 'it shows what Close the Distance leaves as it is: a step that is not toward an exhibit targeting you',
    build: (params, sp, depth, opts) => sniperRoom(depth, opts, [['close_the_distance', 2]]),
    actions: (first ? [WAIT] : []).concat(actions),
    expect: r => perkEv(r.events, 'close').length ? `a free step: ${json(perkEv(r.events, 'close'))}` : r.state.actors[0].next === want ? null : `your next decision is at ${r.state.actors[0].next}, not ${want}`,
  });
  // "Nearer, in walking tiles" (§8.2's measure, as the ring's), never as the crow flies: a wall
  // (x = 7, rows 2–6) stands between you and an exhibit at (8, 4) whose mark (planted, its owner
  // acting at 500) covers (5, 4), (6, 4) and (6, 3). From (6, 4) the way round the wall is as long
  // over the top as under it; a step north to (6, 3) shortens the way over the top by one, though
  // it is no nearer as the crow flies (2 tiles either way): free. From (5, 4), a step east to
  // (6, 4) is a tile nearer as the crow flies (3 to 2), but the way round the wall from either
  // starts by the same tile, (6, 3) or (6, 5), one step off: no nearer in walking tiles, so it
  // takes its time.
  const WALLED = ['################', '#..............#', ...Array.from({ length: 5 }, () => '#......#.......#'), '#..............#', '################'];
  const walled = (you, perks) => {
    const s = hold(C.Setup.room(1, { acc: 'T0', depth: 3, map: WALLED, you, exhibits: [{ sp: 'dummy', at: [8, 4], mode: 'hunting', sawYou: true, stats: TOUGH }] }, { invulnerable: true }), perks);
    const a = s.actors[1], tiles = [[6, 3], [5, 4], [6, 4]];
    a.telegraph = { sp: 'line', tiles, from: tiles.map(() => [8, 4]), via: tiles.map(() => null), gross: 1, effect: 'damage', turn: 0, tick: 0 };
    a.next = 5 * N.TICKS_PER_TURN; a.notBefore = null;
    return s;
  };
  test('Close the Distance counts walking tiles, as the ring does, never tiles as the crow flies: round a wall, a step nearer only in walking tiles is free, one nearer only as the crow flies takes its time', () => {
    for (const rank of [1, 2]) {
      const p = [['close_the_distance', rank]];
      let s = walled([6, 4], p), r = H.play(C, s, [{ a: 'move', dir: 0 }]);
      assert.equal(json([r.violations.length, perkEv(r.events, 'close').length, s.actors[0].next]), json([0, 1, 0]), `rank ${rank}: north from (6, 4)`);
      s = walled([5, 4], p); r = H.play(C, s, [{ a: 'move', dir: 2 }]);
      assert.equal(json([r.violations.length, perkEv(r.events, 'close').length, s.actors[0].next]), json([0, 0, N.TICKS_PER_TURN]), `rank ${rank}: east from (5, 4)`);
    }
  });

  test('Close the Distance: a step away, a step that keeps the walking distance, and a step with no mark on your tile take their time', () => {
    const list = [{ sp: null, depth: 2 }, { sp: null, depth: 6 }];
    ok(H.sweep(C, notToward('a step away from it', true, [{ a: 'move', dir: 6 }], 2 * N.TICKS_PER_TURN), list), 'away');
    ok(H.sweep(C, notToward('a step that keeps the walking distance', true, [{ a: 'move', dir: 0 }], 2 * N.TICKS_PER_TURN), list), 'beside');
    ok(H.sweep(C, notToward('a step toward it before it marks', false, [{ a: 'move', dir: 2 }], N.TICKS_PER_TURN), list), 'unmarked');
  });
};
