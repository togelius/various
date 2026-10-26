// M3's clock (BUILD.md §8.4; §8.1's turn boundary, steps 3, 5 and 6; §3.2's Watchman uids):
// the budget, the bell and the night watch, the night-watch bells and whom they wake, the
// Night Watchman's entry, numbers, pursuit and return, leaving by an exit door, the dial's
// view and sentence, and clone stability through the night watch. The expected figures are
// worked out here from BUILD.md's text (walking distances by a search written in this file,
// role numbers by §8.10's anchors), never from the rule code. No test seals a hall (M4).
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore(['tools/monkey.js']);
  const { Step, State, Setup, Dept, Clock, ClockRules, Roles, Text, Causes, Labels, Packs, Combat, Grid, Registry, N } = C;
  const H = require('./behaviour/_harness.js');
  const json = x => JSON.stringify(x);
  const clean = s => typeof s === 'string' && s.length > 0 && !/undefined|NaN|\[object/.test(s);
  const W = s => s.actors.filter(a => a.arch === 'night_watchman');

  // A room with an entrance in its west wall and an exit door in its east wall.
  const ROOM = [
    '############',
    'E..........#',
    '#..........#',
    '#..........X',
    '############',
  ];
  const room = (spec, options) => Setup.room(1, Object.assign({ acc: 'T0', depth: 2, map: ROOM, you: [6, 2], exhibits: [], clock: { B: 5, G: 4 },
    entrance: [0, 1], exits: [[11, 3]] }, spec), options || { invulnerable: true });
  const waits = (s, n) => { const out = []; for (let i = 0; i < n && !s.over; i++) for (const e of Step.step(s, { a: 'wait' })) out.push(e); return out; };

  // Walking distance by §8.2, written here: 8-way steps, a diagonal only if both orthogonal
  // neighbours can be stepped onto; staff doors are doors for you and walls for exhibits; a
  // tile no one can step onto is 1 + its nearest neighbour one can.
  const WALK = ".,+'SsEXukxwb=";
  function walking(map, from, who) {
    const h = map.length, w = map[0].length, ok = (x, y) => x >= 0 && y >= 0 && x < w && y < h && WALK.includes(map[y][x]) && !(who === 'exhibit' && 'Ss'.includes(map[y][x]));
    const d = map.map(r => [...r].map(() => -1)), q = [from];
    d[from[1]][from[0]] = 0;
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if ((!dx && !dy) || !ok(nx, ny) || d[ny][nx] >= 0) continue;
        if (dx && dy && !(ok(nx, y) && ok(x, ny))) continue;
        d[ny][nx] = d[y][x] + 1; q.push([nx, ny]);
      }
    }
    return (x, y) => {
      if (d[y][x] >= 0 || ok(x, y)) return d[y][x];
      let best = -1;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if ((dx || dy) && ok(nx, ny) && d[ny][nx] >= 0 && (best < 0 || d[ny][nx] + 1 < best)) best = d[ny][nx] + 1; }
      return best;
    };
  }
  // A role's number at a depth (§8.10): anchored at depths 1, 4 and 8, linear between, rounded down.
  const curve = (v, d) => d <= 4 ? v[0] + Math.floor((v[1] - v[0]) * (d - 1) / 3) : v[1] + Math.floor((v[2] - v[1]) * (d - 4) / 4);

  test('the budget: B is 220, 250 and 300 for tour lengths 49, 59 and 81, and G is 60 for every tour length from 40 to 100', () => {
    const near10 = x => Math.floor((x + 5) / 10) * 10;   // to the nearest 10, halves up (x a multiple of 0.5)
    assert.equal(json([49, 59, 81].map(l => Clock.budget(l).B)), json([220, 250, 300]));
    for (let l = 40; l <= 100; l++) {
      const B = near10(2.5 * l + 100), G = Math.max(60, near10(15 * B / 100));
      assert.equal(json(Clock.budget(l)), json({ B, G }), `L_tour ${l}`);
      assert.equal(G, 60, `L_tour ${l}: G is 60, since 15% of B stays below 55 while B is below 367`);
    }
  });

  test('the bell comes once at count B and the night watch once at B + G, each told by a stage event with the count in its cause', () => {
    const s = room({});
    const ev = waits(s, 38), stages = ev.filter(e => e.k === 'stage');
    assert.equal(json(stages.map(e => [e.stage, e.turn, e.cause])), json([['bell', 5, { k: 'clock', count: 5, B: 5, G: 4 }], ['night_watch', 9, { k: 'clock', count: 9, B: 5, G: 4 }]]));
    for (const e of stages) assert.equal(Causes.check(e), null);
    assert.equal(json([s.dept.clock.count, s.dept.clock.stage, s.turn]), json([38, 2, 38]), 'the count goes up by one at every boundary');
    // A clock made mid-way knows its stage and the bells already rung, and starts with no events.
    assert.equal(json([Clock.init(0, { B: 5, G: 4, count: 4 }).stage, Clock.init(0, { B: 5, G: 4, count: 5 }).stage, Clock.init(0, { B: 5, G: 4, count: 9 }).stage]), json([0, 1, 2]));
    assert.equal(json([39, 68, 69].map(count => Clock.init(0, { B: 5, G: 4, count }).nightBells)), json([1, 1, 2]));
  });

  test('at the bell\'s own boundary, regeneration and pip decay still run by the open stage; the bell takes effect from the next boundary (§8.1, steps 3, 5, 6)', () => {
    const X = loadCore(), seen = [];
    const wrap = (ns, fn) => { const f = X[ns][fn]; X[ns][fn] = (state, ev) => { seen.push([state.turn, fn, X.Clock.stage(state), X.Clock.regenRate(state), X.Clock.pipsDecay(state)]); return f(state, ev); }; };
    wrap('Health', 'regenerate'); wrap('Wake', 'decay'); wrap('ClockRules', 'boundary');
    const s = X.Setup.room(1, { acc: 'T0', depth: 2, map: ROOM, you: [6, 2], exhibits: [], clock: { B: 5, G: 4 }, entrance: [0, 1], exits: [[11, 3]] }, { invulnerable: true });
    for (let i = 0; i < 10; i++) X.Step.step(s, { a: 'wait' });
    const at = t => json(seen.filter(r => r[0] === t).map(r => r.slice(1)));
    assert.equal(at(5), json([['regenerate', 0, 2, true], ['decay', 0, 2, true], ['boundary', 0, 2, true]]), 'turn 5, the bell: steps 3 and 5 see the open clock');
    assert.equal(at(6), json([['regenerate', 1, 1, false], ['decay', 1, 1, false], ['boundary', 1, 1, false]]), 'turn 6: half the regeneration, no decay');
    assert.equal(at(9), json([['regenerate', 1, 1, false], ['decay', 1, 1, false], ['boundary', 1, 1, false]]), 'turn 9, the night watch: still after the bell');
    assert.equal(at(10), json([['regenerate', 2, 0, false], ['decay', 2, 0, false], ['boundary', 2, 0, false]]), 'turn 10: no regeneration');
  });

  // A hall for the night-watch bells. You stand at (8, 4); the sleepers, all outside your
  // ring and beyond the reach of a blow's noise beside you, are a–g: e is in an intact case
  // (v), f a sleeper made pipless (as a mimic in its disguise is), g walled off where no walk
  // reaches; h is awake, walled off with g so that it never comes near. The wall beside you makes f nearest in a straight line but not by
  // walking; b and c are at the same walking distance, b placed first though c comes first in
  // row-major order. A Night Watchman is taken to be in the department already, so none comes
  // in during these tests.
  const HALL = [
    '####################',
    'E.v................#',
    '#..................#',
    '#........#.........#',
    '#........#.........#',
    '#........#.........#',
    '#........#......####',
    '#..............#...#',
    '####################',
  ];
  const ORDER = ['f', 'b', 'd', 'e', 'c', 'a', 'g', 'h'];
  const SLEEPERS = { f: [10, 4], b: [2, 6], d: [14, 4], e: [2, 1], c: [12, 2], a: [3, 4], g: [18, 7], h: [16, 7] };
  function hall(X, seed) {
    const st = X.Roles.stats('fodder', 2);
    const s = X.Setup.room(seed, { acc: 'T0', depth: 2, map: HALL, you: [8, 4], clock: { B: 2, G: 2, count: 4 }, entrance: [0, 1], exits: [],
      exhibits: ORDER.map(k => ({ sp: 'x', at: SLEEPERS[k], stats: st, uid: 'T0.2.room.' + k, mode: k === 'h' ? 'awake' : 'dormant', speed: null })) }, { invulnerable: true });
    s.dept.clock.watch.k = 1;
    return s;
  }
  const plantPipless = X => { const f = X.Archetypes.pipless; X.Archetypes.pipless = (state, a) => a.uid === 'T0.2.room.f' || f(state, a); };

  test('a night-watch bell rings every NIGHT_WAKE_EVERY counts after the night watch begins and wakes the NIGHT_WAKE_COUNT sleepers nearest you by walking distance, ties in spawn order', () => {
    const X = loadCore(); plantPipless(X);
    const s = hall(X, 1), d = walking(HALL, [8, 4]), uid = k => 'T0.2.room.' + k;
    // The oracle: dormant, not in a case, not pipless, reached by a walk; nearest first, then spawn order.
    const eligible = ORDER.filter(k => !['e', 'f', 'g', 'h'].includes(k) && d(...SLEEPERS[k]) >= 0);
    eligible.sort((p, q) => d(...SLEEPERS[p]) - d(...SLEEPERS[q]) || ORDER.indexOf(p) - ORDER.indexOf(q));
    assert.equal(json(eligible), json(['a', 'b', 'c', 'd']));
    assert.equal(json(['a', 'b', 'c', 'd', 'e', 'f'].map(k => d(...SLEEPERS[k]))), json([5, 6, 6, 8, 6, 6]), 'e and f would be among the three nearest');
    assert.equal(Grid.chebyshev(8, 4, ...SLEEPERS.f), 2);
    assert.equal(d(...SLEEPERS.g), -1);
    const nearest = X.ClockRules.nearestSleepers(s, 9);
    assert.equal(json(nearest.map(r => [r.a.uid, r.dist])), json(eligible.map(k => [uid(k), d(...SLEEPERS[k])])));
    assert.equal(json(X.ClockRules.nearestSleepers(s, 2).map(r => r.a.uid)), json([uid('a'), uid('b')]));
    // The bells, at counts B + G + 30n: 34, 64, 94, which are turns 30, 60 and 90, since the
    // clock was made at count 4.
    const bells = [];
    for (let i = 0; i < 95; i++) for (const e of X.Step.step(s, { a: 'wait' })) if (e.k === 'stage' || e.k === 'woke' || e.k === 'hunting') bells.push(e);
    const rung = bells.filter(e => e.k === 'stage');
    assert.equal(json(rung.map(e => [e.turn, e.stage, e.n, e.woke])), json([
      [30, 'night_bell', 1, [uid('a'), uid('b'), uid('c')]], [60, 'night_bell', 2, [uid('d')]], [90, 'night_bell', 3, []]]));
    assert.equal(json(rung.map(e => e.cause)), json([34, 64, 94].map(count => ({ k: 'clock', count, B: 2, G: 2 }))));
    for (const e of bells) assert.equal(X.Causes.check(e), null, json(e));
    // Each woke hunting, by the bell, with its walking distance, in the bell's order.
    const woke = bells.filter(e => e.k === 'woke');
    assert.equal(json(woke.map(e => [e.who, e.mode, e.cause])), json(['a', 'b', 'c', 'd'].map((k, i) => [uid(k), 'hunting', { k: 'night_bell', n: i < 3 ? 1 : 2, dist: d(...SLEEPERS[k]) }])));
    for (const k of ['e', 'f', 'g']) assert.equal(s.actors.find(a => a.uid === uid(k)).mode, 'dormant', `${k} sleeps through every bell`);
    assert.equal(json(s.dept.clock.nightBells), '3');
    // Sentences. They name only the sleepers the bell can reach: e (in a case), f (pipless)
    // and g (walled off) are nearer than some it woke, and still sleep at the last bell, so
    // the last bell must not say that no sleeper is left.
    const names = X.Labels.nameOf(s);
    assert.equal(X.Text.event(rung[0], names), 'A night-watch bell rings: the 3 sleeping exhibits nearest you that it can reach wake and hunt you.');
    assert.equal(X.Text.event(rung[1], names), 'A night-watch bell rings: the sleeping exhibit nearest you that it can reach wakes and hunts you.');
    assert.ok(['e', 'f', 'g'].every(k => s.actors.find(a => a.uid === uid(k)).mode === 'dormant'), 'sleepers remain at the last bell');
    assert.equal(X.Text.event(rung[2], names), 'A night-watch bell rings, but there is no sleeping exhibit it can reach to wake.');
  });

  test('a night-watch bell measures walking distance as the ring does, staff doors counting as doors whatever their grade: it wakes a sleeper behind a staff door you cannot open, and none that no walk reaches', () => {
    // A staff door of grade VII at (5, 3), above your grade; "behind" sleeps beyond it, and
    // "pocket" in a walled-off pocket that no walk reaches.
    const MAP = ['##########', 'E........#', '#........#', '#####S####', '#...#....#', '##########'];
    const st = Roles.stats('fodder', 2), uid = k => 'T0.2.room.' + k;
    const s = Setup.room(1, { acc: 'T0', depth: 2, map: MAP, you: [1, 1], clock: { B: 2, G: 2, count: 33 }, entrance: [0, 1], exits: [],
      fixtures: [{ k: 'staff', x: 5, y: 3, grade: 7 }],
      exhibits: [{ sp: 'x', at: [7, 4], stats: st, uid: uid('behind'), mode: 'dormant' }, { sp: 'x', at: [2, 4], stats: st, uid: uid('pocket'), mode: 'dormant' }] }, { invulnerable: true });
    s.dept.clock.watch.k = 1;
    const grade = s.dept.fixtures.find(f => f.k === 'staff').grade;
    assert.ok(grade > s.run.grade, `the staff door's grade ${grade} is above yours, ${s.run.grade}`);
    const yours = walking(MAP, [1, 1]), theirs = walking(MAP, [7, 4], 'exhibit');
    assert.equal(json([yours(7, 4) > 0, yours(2, 4), theirs(1, 1)]), json([true, -1, -1]), 'a walk reaches behind the door, none the pocket; behind cannot walk to you');
    assert.equal(json(ClockRules.nearestSleepers(s, 3).map(r => [r.a.uid, r.dist])), json([[uid('behind'), yours(7, 4)]]));
    const ev = Step.step(s, { a: 'wait' }), bell = ev.find(e => e.k === 'stage');
    assert.equal(json([bell.stage, bell.woke]), json(['night_bell', [uid('behind')]]));
    assert.equal(json(s.actors.slice(1).map(a => [a.uid, a.mode])), json([[uid('behind'), 'hunting'], [uid('pocket'), 'dormant']]));
  });

  test('the bell is not a noise: those it wakes know your tile, first act a beat later, and nothing is heard', () => {
    const X = loadCore(); plantPipless(X);
    const s = hall(X, 2);
    let ev = [];
    for (let i = 0; i < 30; i++) ev = X.Step.step(s, { a: 'wait' });
    assert.ok(ev.some(e => e.k === 'stage' && e.stage === 'night_bell'), 'the first bell rings in the 30th step, at count 34');
    assert.ok(!ev.some(e => e.k === 'noise'), 'no noise');
    for (const k of ['a', 'b', 'c']) {
      const a = s.actors.find(x => x.uid === 'T0.2.room.' + k);
      assert.equal(json([a.mode, a.lastKnown, a.next, a.woke.turn, a.woke.cause.k, a.hunted.turn]), json(['hunting', [8, 4], 3000 + N.COST_STEP, 30, 'night_bell', 30]), k);
    }
  });

  test('the Night Watchman comes in at the entrance when the night watch begins, hunting, as <acc>.<depth>.watch.1, and first acts a beat later', () => {
    const s = room({ you: [3, 2] });
    let ev = waits(s, 8);
    assert.equal(W(s).length, 0, 'not before the night watch');
    ev = Step.step(s, { a: 'wait' });
    const [w] = W(s);
    assert.ok(w, 'it came in at count 9');
    assert.equal(json([w.uid, w.sp, w.x, w.y, w.mode, w.home, w.trigger]), json(['T0.2.watch.1', 'night_watchman', 0, 1, 'hunting', null, 'awake']));
    assert.equal(json([w.woke, w.hunted]), json([{ turn: 9, cause: { k: 'night_watch', n: 1 } }, { turn: 9, cause: { k: 'night_watch', n: 1 } }]));
    assert.equal(json(w.lastKnown), json([3, 2]), 'its hunt starts from your tile');
    assert.equal(w.next, 900 + N.COST_STEP, 'its first action is one action after it came in');
    const kinds = ev.filter(e => e.who === w.uid || e.by === w.uid).map(e => [e.k, e.tick, e.cause]);
    assert.equal(json(kinds), json([['entered', 900, { k: 'night_watch', n: 1, count: 9 }], ['woke', 900, { k: 'night_watch', n: 1 }]]), 'it does nothing in the instant it comes in');
    for (const e of ev) assert.equal(Causes.check(e), null, json(e));
    const names = Labels.nameOf(s);
    assert.equal(json(Text.log(ev, names).slice(-3)), json([
      `The night watch begins: you no longer recover health, and every ${N.NIGHT_WAKE_EVERY} turns a bell will wake the ${N.NIGHT_WAKE_COUNT} sleeping exhibits nearest you that it can reach (by a walk from you; never one in a case, or one that cannot hear).`,
      'The Night Watchman comes in at the entrance.', 'The Night Watchman is on its rounds, hunting you from the start.']));
    ev = Step.step(s, { a: 'wait' });
    assert.ok(!ev.some(e => e.who === w.uid || e.by === w.uid), 'nothing yet: your decision at 1000 comes first');
    ev = Step.step(s, { a: 'wait' });
    assert.ok(ev.some(e => e.k === 'moved' && e.who === w.uid && e.tick === 1000), 'it acts at its beat, at 1000, after your decision there');
    assert.ok(Combat.surprised(s.actors[0], w) === false);
  });

  test('with someone on the entrance, the Night Watchman comes in on the nearest free tile by walking, ties row-major', () => {
    // You on the entrance (0, 1) and an exhibit on (1, 1), the one tile at 1; at 2 lie (1, 2)
    // and (2, 1), (2, 2): (1, 2) is reached from (1, 1) by a straight step? No: the diagonal
    // from (0, 1) to (1, 2) cuts the corner of the wall at (0, 2), so (1, 2) is at 2 as well,
    // and the first at 2 in row-major order is (2, 1).
    const d = walking(ROOM, [0, 1], 'exhibit');
    assert.equal(json([d(1, 1), d(1, 2), d(2, 1), d(2, 2), d(1, 3)]), json([1, 2, 2, 2, 3]));
    const s = room({ you: [0, 1], exhibits: [{ sp: 'x', at: [1, 1], stats: Roles.stats('fodder', 2), mode: 'awake' }] });
    assert.equal(json(ClockRules.entryTile(s)), json([2, 1]));
    s.actors[1].x = 5; s.actors[1].y = 3;
    assert.equal(json(ClockRules.entryTile(s)), json([1, 1]), 'the first free tile at 1');
    s.actors[0].x = 6;
    assert.equal(json(ClockRules.entryTile(s)), json([0, 1]), 'the entrance itself when it is free');
    // A closed door is never a tile to come in on: a step into one only opens it, so no one
    // stands on one. With you on the entrance and a closed door beside it, the nearest free
    // tile is beyond the door, and the sentence says it came in near the entrance.
    const DOOR = ['#####', 'E+..#', '#...#', '#####'];
    const dd = walking(DOOR, [0, 1], 'exhibit');
    assert.equal(json([dd(1, 1), dd(2, 1), dd(1, 2), dd(2, 2)]), json([1, 2, 2, 2]));
    const door = Setup.room(1, { acc: 'T0', depth: 2, map: DOOR, you: [0, 1], exhibits: [], clock: { B: 1, G: 1 }, entrance: [0, 1] }, { invulnerable: true });
    assert.equal(json(ClockRules.entryTile(door)), json([2, 1]), 'beyond the closed door at (1, 1), first at 2 in row-major order');
    const came = waits(door, 2).find(e => e.k === 'entered');
    assert.equal(json([came.at, came.cause]), json([[2, 1], { k: 'night_watch', n: 1, count: 2, near: true }]));
    assert.equal(Causes.check(came), null);
    assert.equal(Text.event(came, Labels.nameOf(door)), 'The Night Watchman comes in near the entrance, since someone is standing on it.');
    const again = Object.assign({}, came, { cause: Object.assign({}, came.cause, { n: 2 }) });
    assert.equal(Text.event(again, Labels.nameOf(door)), 'The Night Watchman comes in near the entrance, since someone is standing on it, in place of the one that fell.');
    for (let i = 0; i < 6; i++) {
      Step.step(door, { a: 'wait' });
      const w = W(door)[0];
      assert.notEqual(Grid.ch(door.dept, w.x, w.y), '+', 'it never stands on a closed door');
    }
    const none = Setup.room(1, { acc: 'T0', depth: 2, map: ROOM, you: [6, 2], exhibits: [], clock: { B: 1, G: 1 } });
    assert.equal(ClockRules.spawnWatchman(none, []), null, 'no entrance, no Night Watchman');
    assert.equal(ClockRules.spawnWatchman(Setup.room(1, { acc: 'T0', depth: 2, map: ROOM, you: [6, 2], exhibits: [], entrance: [0, 1] }), []), null, 'no clock, no Night Watchman');
  });

  test('a visit without the Night Watchman (options.without, §3.6): it is made gone, with no event, and none comes after it', () => {
    const s = room({ you: [3, 2] }, { invulnerable: true, without: ['T0.2.watch.1'] });
    const ev = waits(s, 60);
    const ws = W(s);
    assert.equal(json(ws.map(a => [a.uid, a.gone])), json([['T0.2.watch.1', 1]]));
    assert.ok(!ev.some(e => e.k === 'entered' || e.who === 'T0.2.watch.1'), 'no event about it');
    assert.equal(json(s.dept.clock.watch), json({ k: 1, back: null }));
  });

  test('the Night Watchman has the warden curve\'s numbers at every depth 1–7 (§8.10), and its Behaviour line names them', () => {
    for (let depth = 1; depth <= 7; depth++) {
      const s = Setup.room(1, { acc: 'T0', depth, map: ROOM, you: [6, 2], exhibits: [], clock: { B: 1, G: 1 }, entrance: [0, 1] }, { invulnerable: true });
      waits(s, 2);
      const [w] = W(s), dm = N.ROLE_WARDEN_DMG;
      const want = [curve(N.ROLE_WARDEN_HP, depth), curve(N.ROLE_WARDEN_HP, depth), curve(N.ROLE_WARDEN_ACC, depth), curve(N.ROLE_WARDEN_EVA, depth),
        curve(N.ROLE_WARDEN_PAD, depth), curve(dm.map(r => r[0]), depth), curve(dm.map(r => r[1]), depth)];
      assert.equal(json([w.uid, w.hp, w.maxHp, w.acc, w.eva, w.pad, w.dmin, w.dmax]), json([`T0.${depth}.watch.1`, ...want]), `depth ${depth}`);
      const line = C.Clauses.line(Packs.shared('night_watchman'), { depth }), dmg = want[5] === want[6] ? String(want[5]) : `${want[5]}–${want[6]}`;
      assert.ok(line.includes(`strikes from beside you for ${dmg}`) && line.includes(`another comes ${N.WATCHMAN_RETURN} turns later`) && clean(line), line);
    }
  });

  test('the Night Watchman is never caught by surprise: your first blow at it, before it has acted, is rolled', () => {
    const s = room({ you: [1, 1] });
    waits(s, 9);
    const [w] = W(s);
    assert.equal(json([w.x, w.y, w.next > s.tick]), json([0, 1, true]), 'it has come in and not yet acted');
    assert.equal(Combat.surprised(s.actors[0], w), false);
    const ev = Step.step(s, { a: 'attack', uid: w.uid }), blow = ev.find(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.by === 'you');
    assert.ok(blow && Number.isInteger(blow.cause.roll) && blow.cause.surprise === undefined, json(blow));
  });

  // A winding corridor: from the entrance to you is more than 64 tiles of walking.
  const LONG = [
    '########################################',
    'E......................................#',
    '######################################.#',
    '#......................................#',
    '#.######################################',
    '#......................................#',
    '########################################',
  ];

  test('the Night Watchman comes for you across more than 64 tiles, out of sight all the way, and never loses you', () => {
    const d = walking(LONG, [38, 5], 'exhibit'), far = d(0, 1);
    assert.ok(far > 64, `walking distance ${far}`);
    const s = Setup.room(3, { acc: 'T0', depth: 3, map: LONG, you: [38, 5], exhibits: [], clock: { B: 1, G: 1 }, entrance: [0, 1] }, { invulnerable: true });
    const r = H.play(C, s, Array.from({ length: far + 6 }, () => ({ a: 'wait' })), { inv: ['night_watchman'] });
    assert.equal(json(r.violations), '[]');
    const [w] = W(s), first = r.events.find(e => e.k === 'attacked' && e.by === w.uid);
    assert.ok(first, 'it reached you and struck');
    assert.ok(first.turn <= 2 + far, `it struck at turn ${first.turn}, one step a turn over ${far} tiles from turn 2`);
    assert.equal(w.mode, 'hunting');
    assert.ok(!r.events.some(e => e.k === 'lost' && e.who === w.uid), 'it never lost you');
  });

  // A staff door between you and the Watchman: you can pass it, it cannot.
  const STAFF = [
    '############',
    'E.....#....#',
    '#.....S....#',
    '#.....#....#',
    '############',
  ];

  test('staff doors stop the Night Watchman: it waits at the tile it can reach nearest you, hunting, and strikes when you come to the door', () => {
    const yours = walking(STAFF, [9, 2]);
    assert.equal(json([yours(5, 2), yours(5, 1), yours(5, 3)]), json([4, 5, 5]), '(5, 2) is the nearest tile on its side');
    const s = Setup.room(4, { acc: 'T0', depth: 2, map: STAFF, you: [9, 2], exhibits: [], clock: { B: 1, G: 1 }, entrance: [0, 1] }, { invulnerable: true });
    const r = H.play(C, s, Array.from({ length: 30 }, () => ({ a: 'wait' })), { inv: ['night_watchman'] });
    assert.equal(json(r.violations), '[]');
    const [w] = W(s);
    assert.equal(json([w.x, w.y, w.mode]), json([5, 2, 'hunting']));
    const last = r.steps.slice(-15).flatMap(t => t.events).filter(e => e.who === w.uid || e.by === w.uid);
    assert.equal(json(last), '[]', 'it waits there, never on the staff door');
    // You on the staff door itself: it strikes you from beside it.
    s.actors[0].x = 6;
    const r2 = H.play(C, s, [{ a: 'wait' }, { a: 'wait' }], { inv: ['night_watchman'] });
    assert.equal(json(r2.violations), '[]');
    assert.ok(r2.events.some(e => e.k === 'attacked' && e.by === w.uid), 'it strikes you on the door');
  });

  test('a defeated Night Watchman is followed by the next exactly WATCHMAN_RETURN counts later, never before, as watch.2', () => {
    const s = room({ you: [1, 1] });
    waits(s, 9);
    const [w] = W(s);
    w.hp = 1;
    let fell = null;
    for (let i = 0; i < 20 && !w.gone; i++) {
      const before = s.dept.clock.count, ev = Step.step(s, { a: 'attack', uid: w.uid });
      if (ev.some(e => e.k === 'died' && e.who === w.uid)) fell = before;
    }
    assert.ok(w.gone && fell !== null, 'you defeated it');
    assert.equal(json([s.dept.clock.watch, Clock.view(s).watchBack]), json([{ k: 1, back: fell + N.WATCHMAN_RETURN }, fell + N.WATCHMAN_RETURN - s.dept.clock.count]));
    let came = null;
    for (let i = 0; i < 40 && !came; i++) {
      const ev = Step.step(s, { a: 'wait' });
      came = ev.find(e => e.k === 'entered');
      if (!came) assert.equal(W(s).filter(a => !a.gone).length, 0, `no Night Watchman at count ${s.dept.clock.count}`);
    }
    assert.ok(came);
    assert.equal(json([came.who, came.cause]), json(['T0.2.watch.2', { k: 'night_watch', n: 2, count: fell + N.WATCHMAN_RETURN }]));
    assert.equal(json(s.dept.clock.watch), json({ k: 2, back: null }));
    assert.equal(Text.event(came, Labels.nameOf(s)), 'The Night Watchman comes in at the entrance, in place of the one that fell.');
    assert.equal(s.rng['combat/' + w.uid], undefined, 'the fallen one\'s streams are gone (§3.2)');
  });

  test('leave is legal only on an exit door; it costs no time and ends the visit; a refused leave changes nothing', () => {
    const s = room({ you: [10, 3], exits: [[11, 3], [11, 1]], map: ['############', 'E..........X', '#..........#', '#..........X', '############'] });
    const legal = () => Step.legal(s).filter(a => a.a === 'leave');
    assert.equal(json(legal()), '[]');
    const h = State.hash(s), rng = json(s.rng);
    for (const [act, code] of [[{ a: 'leave', i: 0 }, 'not_on_exit'], [{ a: 'leave', i: 1 }, 'not_on_exit'], [{ a: 'leave', i: 2 }, 'no_exit'], [{ a: 'leave', i: -1 }, 'no_exit'], [{ a: 'leave' }, 'no_exit']]) {
      const ev = Step.step(s, act);
      assert.equal(json(ev.map(e => [e.k, e.reason])), json([['refused', code]]));
      assert.ok(clean(Text.event(ev[0])), code);
    }
    assert.equal(State.hash(s), h); assert.equal(json(s.rng), rng);
    Step.step(s, { a: 'move', dir: 2 });
    assert.equal(json(legal()), json([{ a: 'leave', i: 0 }]));
    const tick = s.tick, ev = Step.step(s, { a: 'leave', i: 0 });
    assert.equal(json(ev.map(e => [e.k, e.who, e.door, e.at, e.cause])), json([['left', 'you', 0, [11, 3], { k: 'leave', door: 0, stage: 0 }]]));
    assert.equal(Causes.check(ev[0]), null);
    assert.equal(json(s.over), json({ k: 'left', turn: s.turn, by: null, door: 0, cause: { k: 'leave', door: 0, stage: 0 } }));
    assert.equal(json([s.tick, s.actors[0].next]), json([tick, tick]), 'no time passes');
    assert.equal(Text.event(ev[0]), 'You left the department during open hours.');
    assert.equal(json(Step.step(s, { a: 'wait' }).map(e => e.reason)), json(['visit_over']));
    assert.equal(json(Step.legal(s)), '[]');
    // The stage in the cause, and the left event in the cause records.
    const t = room({ you: [11, 3], clock: { B: 1, G: 1 } });
    waits(t, 3);
    const e2 = Step.step(t, { a: 'leave', i: 0 });
    assert.equal(json([e2[0].cause.stage, Text.event(e2[0])]), json([2, 'You left the department during the night watch.']));
    assert.ok(t.causes.some(c => c.k === 'left'), 'leaving is recorded');
  });

  test('the leaving invariant (clock.leave) holds for leave and its refusals, and catches a leave that takes time, a leave from off the door, a wrong refusal and a refusal that changes something', () => {
    const MAP = ['############', 'E..........X', '#..........#', '#..........X', '############'];
    const ACTS = [{ a: 'leave', i: 0 }, { a: 'leave', i: 2 }, { a: 'leave' }, { a: 'move', dir: 2 }, { a: 'leave', i: 1 }, { a: 'leave', i: 0 }];
    const play = patch => {
      const X = loadCore();
      if (patch) patch(X, X.Actions.get('leave'));
      const s = X.Setup.room(1, { acc: 'T0', depth: 2, map: MAP, you: [10, 3], exhibits: [], clock: { B: 5, G: 4 }, entrance: [0, 1], exits: [[11, 3], [11, 1]] }, { invulnerable: true });
      const r = H.play(X, s, ACTS, { inv: ['clock.leave'] });
      return { r, s, found: [...new Set(r.violations.map(v => v.inv))] };
    };
    const ok = play(null);
    assert.equal(json(ok.r.violations), '[]');
    assert.equal(json([ok.s.over && ok.s.over.k, ok.r.steps.map(t => t.events.map(e => e.reason || e.k).join())]),
      json(['left', ['not_on_exit', 'no_exit', 'no_exit', 'moved', 'not_on_exit', 'left']]));
    assert.equal(json(play((X, h) => { const f = h.apply; h.apply = (s, a, ev) => { const r = f(s, a, ev); return r === 0 ? N.TICKS_PER_TURN : r; }; }).found), json(['clock.leave']), 'a leave that takes a turn');
    assert.equal(json(play((X, h) => {
      const f = h.apply;
      h.apply = (s, a, ev) => {
        const you = s.actors[0], d = Number.isInteger(a.i) && s.dept.exits[a.i];
        if (!d) return f(s, a, ev);
        const x = you.x, y = you.y; you.x = d[0]; you.y = d[1];
        const r = f(s, a, ev); you.x = x; you.y = y; return r;
      };
    }).found), json(['clock.leave']), 'a leave from off the door');
    assert.equal(json(play((X, h) => { const f = h.apply; h.apply = (s, a, ev) => { const r = f(s, a, ev); return r === 'no_exit' ? 'not_on_exit' : r; }; }).found), json(['clock.leave']), 'the wrong refusal');
    assert.equal(json(play((X, h) => { const f = h.apply; h.apply = (s, a, ev) => { const r = f(s, a, ev); if (typeof r === 'string') s.actors[0].lastAct = 'leave'; return r; }; }).found), json(['clock.leave']), 'a refusal that changes the state');
  });

  test('the dial: Clock.view gives the stage and the turns to the next of the bell, the night watch, a night-watch bell and a returning Watchman, and Text.clock says it', () => {
    const s = room({ you: [1, 1] });
    assert.equal(json(Clock.view(s)), json({ count: 0, B: 5, G: 4, stage: 0, toBell: 5, toWatch: 9, toNightBell: null, watchBack: null }));
    assert.equal(Text.clock(Clock.view(s)), 'The clock: open hours, turn 0; the bell rings in 5 turns.');
    waits(s, 4);
    assert.equal(Text.clock(Clock.view(s)), 'The clock: open hours, turn 4; the bell rings in 1 turn.');
    waits(s, 1);
    assert.equal(json(Clock.view(s)), json({ count: 5, B: 5, G: 4, stage: 1, toBell: null, toWatch: 4, toNightBell: null, watchBack: null }));
    assert.equal(Text.clock(Clock.view(s)), 'The clock: after the bell, turn 5; the night watch begins in 4 turns.');
    waits(s, 4);
    assert.equal(json(Clock.view(s)), json({ count: 9, B: 5, G: 4, stage: 2, toBell: null, toWatch: null, toNightBell: 30, watchBack: null }));
    assert.equal(Text.clock(Clock.view(s)), 'The clock: the night watch, turn 9; the next night-watch bell rings in 30 turns.');
    s.dept.clock.watch.back = 12;
    assert.equal(Text.clock(Clock.view(s)), 'The clock: the night watch, turn 9; the next night-watch bell rings in 30 turns. Another Night Watchman comes in 3 turns.');
    assert.equal(Clock.view(Setup.room(1, { acc: 'T0', depth: 1, map: ROOM, you: [6, 2], exhibits: [] })), null);
    assert.equal(Text.clock(null), 'The clock: this room has no closing time.');
    for (let count = 0; count < 120; count++) {
      const t = { dept: { clock: Clock.init(0, { B: 30, G: 20, count }) } };
      if (count % 7 === 0) t.dept.clock.watch.back = count + 5;
      const v = Clock.view(t), say = Text.clock(v);
      assert.ok(clean(say) && /^The clock: .*\.$/.test(say), say);
      for (const k of ['toBell', 'toWatch', 'toNightBell', 'watchBack']) assert.ok(v[k] === null || (Number.isInteger(v[k]) && v[k] > 0), `${k} at ${count}: ${v[k]}`);
    }
  });

  test('in a department, through the bell, the night watch and its bells: every event passes its schema and has a clean sentence, and a clone after every step changes nothing', () => {
    for (const [acc, depth] of [['M11', 3], ['S9', 2], ['A4', 5]]) {
      const make = seed => {
        const s = Dept.create(seed, acc, depth, { invulnerable: true }), c = s.dept.clock;
        s.dept.clock = Clock.init(0, { B: c.B, G: c.G, count: c.B - 3 });
        return s;
      };
      const play = clone => {
        let s = make(7);
        const names = () => Labels.nameOf(s), hashes = [], kinds = {};
        for (let i = 0; i < 160 && !s.over; i++) {
          const legal = Step.legal(s), moves = legal.filter(a => a.a === 'move');
          const act = i % 4 === 3 && moves.length ? moves[i % moves.length] : (legal.find(a => a.a === 'attack') || { a: 'wait' });
          const ev = Step.step(s, act);
          if (!clone) for (const e of ev) {
            assert.equal(Causes.check(e), null, `${acc}: ${json(e)}`);
            const say = Text.event(e, names());
            assert.ok(clean(say), `${acc}: ${json(e)} → ${say}`);
            if (e.k === 'stage') kinds[e.stage] = (kinds[e.stage] || 0) + 1;
            if (e.k === 'entered') kinds.entered = (kinds.entered || 0) + 1;
          }
          if (clone) s = State.clone(s);
          assert.equal(State.plainData(s), null);
          hashes.push(State.hash(s));
        }
        return { hashes, kinds };
      };
      const a = play(false), b = play(true);
      assert.equal(json(a.hashes), json(b.hashes), `${acc}: a clone after every step`);
      assert.ok(a.kinds.bell === 1 && a.kinds.night_watch === 1 && a.kinds.entered >= 1 && a.kinds.night_bell >= 2, `${acc}: ${json(a.kinds)}`);
    }
  });

  test('the Night Watchman\'s label: its name, a tombstone, and a paragraph of 40–70 words with no number in it', () => {
    const w = Packs.shared('night_watchman');
    assert.equal(w.name, 'The Night Watchman');
    for (const f of ['maker', 'date', 'medium', 'dims', 'credit']) assert.ok(typeof w.tomb[f] === 'string' && w.tomb[f].length > 3, f);
    const words = w.paragraph.split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 40 && words <= 70, `${words} words`);
    assert.ok(!/\d/.test(w.paragraph), 'no number, so it states no rule');
    assert.ok(!/\bstaff\b/i.test(w.paragraph + json(w.tomb)), 'it is never called staff (§8.4)');
  });

  test('the registry: the Night Watchman\'s clause, its wake causes and leave\'s refusals are at ready true (joined up, W2a-BEHAVIOUR), with their tests and invariant', () => {
    const e = Registry.ARCHETYPES.night_watchman;
    assert.equal(json([e.ready, e.inv, e.covers]), json([true, 'night_watchman', ['attacked', 'missed', 'entered']]));
    for (const id of ['night_bell', 'night_watch']) assert.equal(json([Registry.WAKE_CAUSES[id].ready, Registry.WAKE_CAUSES[id].mode]), json([true, 'hunting']));
    for (const code of ['no_exit', 'not_on_exit']) assert.ok(Registry.REFUSALS[code] && Text.refusalDefined(code), code);
    // Each names an invariant file that checks what it says: leave's refusals, clock.leave.
    const Inv = require('../tools/invariants.js'), byFile = file => Inv.load(C).filter(i => i.file === file).map(i => i.id);
    for (const code of ['no_exit', 'not_on_exit']) assert.ok(byFile(Registry.REFUSALS[code].inv).includes('clock.leave'), code);
    assert.ok(byFile(e.inv).includes('night_watchman.hunts') && byFile(e.inv).includes('night_watchman.unsurprised'));
  });
};
