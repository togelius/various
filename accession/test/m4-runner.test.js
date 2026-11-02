// The worst-case runner's charge, measured early (M4 plan D-RUNNER-EST, D2.3, Q2; layout.md
// §9.2), in report mode (js/core/layout/runner.js, LRunner; tools/runner-sweep.js):
//   - a worked charge for each option, (a), (b) and (c), counted by hand from the odds readout
//     (Labels.odds) of four exhibits at depth 3 against the runner (the median visitor less one
//     Certificate: grade II, 25 HP, a T2 Balanced weapon and Standard garment a grade short of
//     it), and the fight of two (b) charges together in the cheapest order;
//   - the wake model on rooms drawn here: the ring's pips over the route (cumulative, never
//     decaying, the pips held counted), the tether through a wall, an axis pip, a herald's call,
//     ally_hit (not from one in a case), the alarm (on real S.9 departments), the Intro's
//     exhibits and a mimic left out, an exhibit in a case woken but never fought; the fights
//     (woken within RUNNER_TOGETHER_TURNS of each other, or apart);
//   - the route: from the entrance to an exit, never through the hall, a staff door or a
//     sleeper, the cheaper of two ways when one wakes nothing;
//   - on real departments: legal routes, (a) never above (b), nothing drawn or changed, the
//     same report twice, LRunner.check's verdict, and the axis and tether tiles never fewer
//     than Wake.onAxis and Wake.inTether give;
//   - the sweep tool's arguments and report;
//   - (CP1 review) the patrols timed: Patrol.timeline against the game; a route that waits
//     out a patrol, played in the game, wakes nothing and reaches an exit, where an untimed
//     patrol sees it; after a fight a timed patrol sees whatever it could; a station's line
//     charged once when the route stands on it as it goes off, and waited out; the Waders'
//     rounds (each its own, away from the Intro's mouth, never stalling); the Copying-Room
//     Bell kept out of call of every exhibit;
//   - (D-RUNNER) LV11 as a validator: a corridor of wardens fails (two moves tried, then
//     undone, the state as it was) and, planted in S.9's coda, reseeds; a move repairs a
//     planted department with its sentence, and with RUNNER_MOVES 0 the same is rejected; the
//     moves never leave LV6 rejecting; the verdict LV11 reaches early is the full report's; an
//     accept that skips LV11 is caught by the sweep's check and the tool's gate; LV11 is the
//     same under any switch and with an exhibit left out, and so is LV6; a Brooder with no case
//     to guard stands where a keeper can walk round it; (review) a tethered warden is charged
//     only once the route stands within its tether, played and checked by the oracle; the gate
//     judges at RUNNER_PASS_PCT whatever --pct prints.
'use strict';
module.exports = ({ test, assert, loadCore, root, path }) => {
  const C = loadCore();
  const { LRunner, Labels, Setup, Roles, Dept, Archetypes, Wake, Grid, N, State, Patrol, Step, Modules, Packs, Populate } = C;
  const S = Roles.stats;
  const KIT3 = { weapon: { form: 'balanced', tier: 2 }, garment: { form: 'standard', tier: 2 } };
  // Values from the core's context have its own prototypes, so they are compared as JSON.
  const same = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);

  // A room for tests made a department the runner can read: rooms [{id, role, cells}], each
  // cell a tile the room holds; the rest of roomOf null.
  function dept(spec, rooms, entrance, exits, Y) {
    const st = (Y || C).Setup.room(5, Object.assign({ acc: 'S9', depth: 3, grade: 2, kit: KIT3 }, spec));
    const m = st.dept;
    m.roomOf = m.tiles.map(row => row.split('').map(() => null));
    m.rooms = rooms.map(r => ({ id: r.id, key: r.id, role: r.role, number: 0, x0: 0, y0: 0, x1: 0, y1: 0 }));
    for (const r of rooms) for (const [x, y] of r.cells) m.roomOf[y][x] = r.id;
    m.entrance = entrance; m.exits = exits;
    return st;
  }
  const cellsOf = (map, x0, y0, x1, y1) => { const out = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]); return out; };
  const along = (m, tiles) => tiles.map(([x, y]) => y * m.w + x);
  const row = (y, x0, x1) => { const out = []; for (let x = x0; x <= x1; x++) out.push([x, y]); return out; };
  const wokeOf = (rep, uid) => rep.woken.find(w => w.uid === uid) || null;

  // ---- The worked charge (D2.3, Q2) against the odds readout ----

  // Four exhibits at depth 3, you as the runner (grade II at depth 3, in the depth's T2 kit).
  const MAP = ['###########', '#.........#', '#.........#', '#.........#', '#.........#', '#.........#', '###########'];
  function worked() {
    return Setup.room(7, { acc: 'S9', depth: 3, map: MAP, you: [5, 3], grade: 2, kit: KIT3, exhibits: [
      { sp: 'S9.6', at: [3, 2], stats: S('skirmisher', 3) }, // a Hopper (darter)
      { sp: 'A4.4', at: [7, 2], stats: S('brute', 3) }, // a Proposing Trustee (splitter, marble): blows of 150 ticks
      { sp: 'S9.4', at: [3, 4], stats: S('warden', 3), guards: [3, 4] }, // a Brooder (tethered_warden): its ring special
      { sp: 'M11.1', at: [7, 4], stats: S('artillery', 3) }, // a Heliograph (axis_sniper): no blow, its beam
    ] });
  }
  // What the readout says: {chance, typ, worst, yours, need, special} (numbers, or null).
  function readout(st, a) {
    const lines = Labels.odds(st, a), num = (re, i) => { for (const l of lines) { const m = re.exec(l); if (m) return Number(m[i || 1]); } return null; };
    return { chance: num(/^It has an? (\d+)% chance to hit you/), typ: num(/typically hits for (\d+)% of your current health/), worst: num(/could defeat you in (\d+) hits?/),
      yours: num(/^You have an? (\d+)% chance to hit it/), need: num(/typically need (\d+) hits?/), special: num(/would deal you (\d+) \(/) };
  }

  test('the runner is the median visitor less one Certificate, as the readout sees you at grade II in the depth-3 kit', () => {
    const st = worked(), you = st.actors[0], run = LRunner.runner(st);
    // Depth 3: the median is grade III in T2; the runner is grade II (25 HP), a grade short of
    // the T2 Balanced weapon and Standard garment (each needs grade III): Acc 3 − 2 = 1, Padding
    // 2 − 1 = 1, damage 2 + 1 to 3·2 + 3, Eva 2.
    same([run.grade, run.hp, run.acc, run.eva, run.pad, run.dmin, run.dmax], [2, 25, 1, 2, 1, 3, 9]);
    same([you.maxHp, you.acc, you.eva, you.pad, you.dmin, you.dmax], [run.hp, run.acc, run.eva, run.pad, run.dmin, run.dmax]);
    // At depths 1 and 2 the runner is grade I (no Certificate to lose at depth 1).
    for (const [d, g, hp] of [[1, 1, 20], [2, 1, 20], [4, 3, 30], [7, 6, 45]]) {
      const r = LRunner.runner(Setup.room(1, { acc: 'S9', depth: d, map: MAP, you: [5, 3] }));
      same([r.grade, r.hp], [g, hp], `depth ${d}`);
    }
    // --runner hp keeps the median's kit stats at depth 3 (grade III, not short).
    const h = LRunner.runner(st, { runner: 'hp' });
    same([h.hp, h.acc, h.pad], [25, 3, 2]);
  });

  test('a worked charge for each option equals the hand count from the odds readout', () => {
    const st = worked(), run = LRunner.runner(st), [hop, bust, brood, helio] = st.actors.slice(1);
    // The Hopper (skirmisher, depth 3: 20 HP, Acc 3, Eva 3, Padding 0, 3–7).
    //   Its chance 75 + 5·(3 − 2) = 80%; its net hits 2–6 (sum 20 over 5: mean 4 = 16% of 25),
    //   at worst 6, so 5 hits defeat you. Your chance 75 + 5·(1 − 3) = 65%; your mean 6, so
    //   ⌈20 / 6⌉ = 4 hits; your least 3, so 7 hits.
    same(readout(st, hop), { chance: 80, typ: 16, worst: 5, yours: 65, need: 4, special: null });
    //   Your time: 4 hits at 65% = 6.15… turns → ⌈40000 / 65⌉ = 616 hundredths.
    //   (a) 6.16 turns × 80% × 4 = 19.712 → 1972 hundredths of a hit point (rounded up).
    //   (b) 6.16 × 80% × 6 = 29.568 → 2957.
    //   (c) 7 turns × 6, always hitting = 42 → 4200.
    const tHop = LRunner.terms(st, hop, run);
    same(['a', 'b', 'c'].map(h => LRunner.alone(tHop, h)), [1972, 2957, 4200]);
    // The Trustee (brute, depth 3: 28 HP, Acc 1, Eva 0, Padding 1, 5–11; blows of 150 ticks;
    // a splitter, whose readout counts the hits on it and every half: 7).
    //   Its chance 75 + 5·(1 − 2) = 70%; net 4–10 (mean 7 = 28%), at worst 10: 3 hits.
    //   Your chance 75 + 5·(1 − 0) = 80%.
    same(readout(st, bust), { chance: 70, typ: 28, worst: 3, yours: 80, need: 7, special: null });
    //   Your time: 7 hits at 80% = 8.75 turns; it blows every 1.5 turns.
    //   (a) 8.75 × 70% × 7 / 1.5 = 28.583… → 2859.  (b) 8.75 × 70% × 10 / 1.5 = 40.833… → 4084.
    //   (c) 7 hits (the readout's count) × 10 / 1.5 = 46.666… → 4667.
    const tBust = LRunner.terms(st, bust, run);
    same(['a', 'b', 'c'].map(h => LRunner.alone(tBust, h)), [2859, 4084, 4667]);
    // The Brooder (warden, depth 3: 39 HP, Acc 3, Eva 2, Padding 1, 3–8), its ring of blows 9
    // net (10 gross, ROLE_WARDEN_SPECIAL at depth 3), counted once.
    //   Its chance 80%; net 2–7 (sum 27 over 6: mean 4.5 = 18%), at worst 7: 4 hits. Your
    //   chance 75 + 5·(1 − 2) = 70%; your net 2–8, mean 5: ⌈39 / 5⌉ = 8 hits; your least 2: 20.
    same(readout(st, brood), { chance: 80, typ: 18, worst: 4, yours: 70, need: 8, special: 9 });
    //   Your time: 8 at 70% = 11.43 turns → ⌈80000 / 70⌉ = 1143 hundredths.
    //   (a) 11.43 × 80% × 4.5 = 41.148 → 4115, + 9 = 5015.  (b) 11.43 × 80% × 7 = 64.008 → 6401,
    //   + 900 = 7301.  (c) 20 × 7 = 140, + 9 = 149 → 14900.
    const tBrood = LRunner.terms(st, brood, run);
    same(['a', 'b', 'c'].map(h => LRunner.alone(tBrood, h)), [5015, 7301, 14900]);
    // The Heliograph has no blow (no line on its hitting you): its beam alone, 8 net, once.
    same(readout(st, helio), { chance: null, typ: null, worst: null, yours: 75, need: 3, special: 8 });
    const tHel = LRunner.terms(st, helio, run);
    same(['a', 'b', 'c'].map(h => LRunner.alone(tHel, h)), [800, 800, 800]);
    // The runner's hit numbers are the readout's, whatever tile you stand on (your blows are
    // taken from the exhibit's own tile).
    for (const a of [hop, bust, brood, helio]) {
      const t = LRunner.terms(st, a, run), r = readout(st, a);
      assert.equal(t.yourChance, r.yours); assert.equal(t.need, r.need);
      if (r.chance !== null) { assert.equal(t.chance, r.chance); assert.equal(Math.ceil(run.hp / t.max), r.worst); assert.equal(Math.round(100 * t.sum / t.n / run.hp), r.typ); }
    }
  });

  test('(b) charges exhibits woken together as one fight, in the order that costs least', () => {
    const st = worked(), run = LRunner.runner(st), [hop, bust, brood, helio] = st.actors.slice(1).map((a, i) => Object.assign(LRunner.terms(st, a, run), { i }));
    // The Hopper first (6.16 turns for 4.8 a turn), then the Trustee (8.75 turns for 4.67):
    //   the Hopper deals 29.568 → 2957 until it falls at 6.16 turns; the Trustee deals until
    //   14.91 turns (616 + 875 hundredths): 14.91 × 0.7 × 10 / 1.5 = 69.58 → 6958; 9915 in all.
    //   The other way round: 4084 + ⌈14.91 × 4.8⌉ hundredths = 4084 + 7157 = 11241.
    same(LRunner.fight([bust, hop], 'b'), { cost: 9915, order: [hop.uid, bust.uid] });
    // Every order of three tried by hand: the one taken costs the least.
    const three = [hop, bust, brood], perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    const byHand = p => { let at = 0, c = 0; for (const k of p) { const t = three[k]; at += Math.ceil(100 * t.need * t.yourCost / t.yourChance); c += Math.ceil(at * t.chance * t.max / t.cost) + 100 * t.specials.reduce((s, x) => s + x.net, 0); } return c; };
    assert.equal(LRunner.fight(three, 'b').cost, Math.min(...perms.map(byHand)));
    // An exhibit with no blow costs only its special, and is destroyed last.
    same(LRunner.fight([helio, hop], 'b').order, [hop.uid, helio.uid]);
    // (a) and (c) charge each alone, whatever wakes with it.
    for (const h of ['a', 'c']) assert.equal(LRunner.fight([hop, bust], h).cost, LRunner.alone(hop, h) + LRunner.alone(bust, h));
    assert.ok(LRunner.fight([hop, bust], 'b').cost > LRunner.alone(hop, 'b') + LRunner.alone(bust, 'b'));
  });

  // ---- The wake model ----

  // A corridor room: y 1–3 open, 25 wide; the route walks row 1 from the entrance (0, 1) to
  // the exit (24, 1), one tile a turn, so it stands on (x, 1) at turn x.
  const HALL = ['#########################', 'E.......................X', '#.......................#', '#.......................#', '#########################'];
  const ROUTE = row(1, 0, 24);
  const open = exhibits => dept({ map: HALL, you: [0, 1], exhibits }, [{ id: 1, role: 'section', cells: cellsOf(HALL, 1, 1, 23, 3) }], [0, 1], [[24, 1]]);

  test('the ring wakes a sleeper on the turn the route has given it the pips it lacks, never decaying', () => {
    const st = open([{ sp: 'S9.6', at: [12, 3], stats: S('skirmisher', 3) }, { sp: 'S9.6', at: [20, 3], stats: S('skirmisher', 3), pips: 1 }]);
    const M = LRunner.model(st), rep = LRunner.cost(M, along(st.dept, ROUTE));
    // RING_MOVING 3 from (12, 3) reaches row 1 at x 9–15: the third pip is at x 11.
    same(wokeOf(rep, 'S9.3.room.1'), { uid: 'S9.3.room.1', sp: 'S9.6', turn: 11, how: 'ring', fights: true, at: 11 });
    // One pip held already: the second, at x 18.
    assert.equal(wokeOf(rep, 'S9.3.room.2').turn, 18);
    // The region read is Archetypes.wakeRegion's.
    const a = st.actors[1], k = Archetypes.wakeRegion(st, a, N.PIPS_TO_WAKE).filter(([, y]) => y === 1).map(([x]) => x);
    same(k, [9, 10, 11, 12, 13, 14, 15]);
    // Pips gathered apart add up: two turns in its ring, out, then a third.
    const gap = LRunner.cost(M, along(st.dept, [[0, 1], [9, 1], [10, 1], [5, 1], [6, 1], [7, 1], [8, 1], [14, 1]]));
    assert.equal(wokeOf(gap, 'S9.3.room.1').turn, 7);
    // Two turns in it wake nothing.
    assert.equal(wokeOf(LRunner.cost(M, along(st.dept, [[0, 1], [9, 1], [10, 1], [5, 1]])), 'S9.3.room.1'), null);
  });

  test('a tether wakes at once through a wall; an axis pip adds to the pips held', () => {
    // Row 1 is the route; a wall below it, and a room beyond holding a Brooder guarding its own
    // tile and a Heliograph two pips short of waking, neither in sight of row 1.
    const map = HALL.slice(0, 2).concat(['#########################', '#.......................#', '#.......................#', '#########################']);
    const st = dept({ map, you: [0, 1], exhibits: [
      { sp: 'S9.4', at: [12, 3], stats: S('warden', 3), guards: [12, 3] },
      { sp: 'M11.1', at: [6, 3], stats: S('artillery', 3), pips: 2 },
    ] }, [{ id: 1, role: 'section', cells: row(1, 1, 23) }, { id: 2, role: 'section', cells: cellsOf(map, 1, 3, 23, 4) }], [0, 1], [[24, 1]]);
    const rep = LRunner.cost(LRunner.model(st), along(st.dept, ROUTE));
    // TETHER_RANGE 2 of (12, 3): row 1 at x 11–13, through the wall, no sight needed.
    same([wokeOf(rep, 'S9.3.room.1').turn, wokeOf(rep, 'S9.3.room.1').how], [11, 'tether']);
    assert.equal(wokeOf(rep, 'S9.3.room.2'), null, 'no ring or axis of row 1 through the wall');
    // A Heliograph at the end of a one-tile corridor off row 1: its ring (3 walking tiles)
    // stops short of row 1, and its column reaches it at (12, 1), 4 tiles off, in sight.
    const col = ['#########################', 'E.......................X'].concat([2, 3, 4, 5].map(() => '#'.repeat(12) + '.' + '#'.repeat(12)), ['#'.repeat(25)]);
    const heli = pips => dept({ map: col, you: [0, 1], exhibits: [{ sp: 'M11.1', at: [12, 5], stats: S('artillery', 3), pips }] },
      [{ id: 1, role: 'section', cells: row(1, 1, 23) }, { id: 2, role: 'section', cells: [[12, 2], [12, 3], [12, 4], [12, 5]] }], [0, 1], [[24, 1]]);
    const two = heli(2), M = LRunner.model(two), w = two.dept.w;
    same([M.ex[0].ring[w + 12], M.ex[0].axis[w + 12], M.ex[0].axis[w + 11]], [0, 1, 0]);
    const r = LRunner.cost(M, along(two.dept, ROUTE));
    same([wokeOf(r, 'S9.3.room.1').turn, wokeOf(r, 'S9.3.room.1').how], [12, 'axis']);
    // One pip short of that, its one axis turn wakes nothing.
    const one = heli(1);
    assert.equal(wokeOf(LRunner.cost(LRunner.model(one), along(one.dept, ROUTE)), 'S9.3.room.1'), null);
  });

  test('a herald calls the sleepers on its call\'s tiles two turns after it wakes; ally_hit wakes a group, not from a case', () => {
    const st = open([
      { sp: 'S9.3', at: [12, 3], stats: S('support', 3) }, // a Dawn-Caller (herald)
      { sp: 'S9.6', at: [17, 3], stats: S('skirmisher', 3) }, // within HERALD_RANGE of it
      { sp: 'S9.6', at: [21, 3], stats: S('skirmisher', 3) }, // beyond
    ]);
    const rep = LRunner.cost(LRunner.model(st), along(st.dept, ROUTE));
    same(rep.woken.map(w => [w.uid.split('.').pop(), w.turn, w.how]), [['1', 11, 'ring'], ['2', 13, 'herald'], ['3', 20, 'ring']]);
    // Clerks of one group: the second, 4 tiles from the first, wakes as the runner's first blow
    // lands on it (a turn after it wakes); the third, 6 tiles from the second (ALLY_HIT_RANGE 5),
    // by its own ring. A clerk in a case wakes but is never fought, so its group's are woken
    // only by their own rings.
    const cl = open([{ sp: 'A4.1a', at: [12, 3], stats: S('fodder', 3) }, { sp: 'A4.1a', at: [16, 3], stats: S('fodder', 3) }, { sp: 'A4.1a', at: [22, 3], stats: S('fodder', 3) }]);
    const c = LRunner.cost(LRunner.model(cl), along(cl.dept, ROUTE));
    same(c.woken.map(w => [w.uid.split('.').pop(), w.turn, w.how]), [['1', 11, 'ring'], ['2', 12, 'ally_hit'], ['3', 21, 'ring']]);
    cl.dept.tiles[3] = cl.dept.tiles[3].slice(0, 12) + 'v' + cl.dept.tiles[3].slice(13);
    const cm = LRunner.model(cl), cc = LRunner.cost(cm, along(cl.dept, ROUTE));
    assert.equal(cm.ex[0].fights, false);
    same(cc.woken.map(w => [w.uid.split('.').pop(), w.turn, w.how, w.fights]), [['1', 11, 'ring', false], ['2', 15, 'ring', true], ['3', 21, 'ring', true]]);
    same(cc.fights.map(f => f.uids.length), [1, 1], 'the encased clerk is in no fight');
  });

  test('exhibits woken within RUNNER_TOGETHER_TURNS of each other are one fight; further apart, two', () => {
    const one = open([{ sp: 'S9.6', at: [12, 3], stats: S('skirmisher', 3) }, { sp: 'S9.6', at: [15, 3], stats: S('skirmisher', 3) }]);
    const r1 = LRunner.cost(LRunner.model(one), along(one.dept, ROUTE));
    same(r1.woken.map(w => w.turn), [11, 14]);
    assert.equal(N.RUNNER_TOGETHER_TURNS, 3);
    same(r1.fights.map(f => [f.turn, f.uids.length]), [[11, 2]]);
    const two = open([{ sp: 'S9.6', at: [12, 3], stats: S('skirmisher', 3) }, { sp: 'S9.6', at: [16, 3], stats: S('skirmisher', 3) }]);
    const r2 = LRunner.cost(LRunner.model(two), along(two.dept, ROUTE));
    same(r2.fights.map(f => [f.turn, f.uids.length]), [[11, 1], [15, 1]]);
    assert.ok(r1.b > r2.b, 'fought together costs more');
    assert.equal(r1.a, r2.a, '(a) fights each alone');
  });

  test('the Intro\'s exhibits and a mimic are left out', () => {
    const st = dept({ map: HALL, you: [0, 1], exhibits: [{ sp: 'S9.6', at: [3, 2], stats: S('skirmisher', 3) }, { sp: 'S9.5', at: [12, 2], stats: S('ambusher', 3) }] },
      [{ id: 1, role: 'intro', cells: cellsOf(HALL, 1, 1, 6, 3) }, { id: 2, role: 'section', cells: cellsOf(HALL, 7, 1, 23, 3) }], [0, 1], [[24, 1]]);
    const M = LRunner.model(st);
    assert.equal(M.ex.length, 0, 'the Intro\'s Hopper and the Tortoise (pipless in its disguise) are not read');
    const rep = LRunner.measure(st);
    same([rep.best.b.b, rep.best.b.woken.length], [0, 0]);
  });

  // ---- The route ----

  test('the route avoids the hall, a staff door and a sleeper, and takes the way that wakes nothing', () => {
    // Two ways from the entrance to the exit: row 1, short, past a Hopper's ring, and round by
    // row 7. Then the long way's row 4 shortcut is made the hall, then a staff door.
    const map = [
      '#########################',
      'E.......................X',
      '#.......................#',
      '#.......................#',
      '#.##################.####',
      '#.##################.####',
      '#.##################.####',
      '#.......................#',
      '#########################'];
    const rooms = [{ id: 1, role: 'section', cells: cellsOf(map, 1, 1, 23, 3) }, { id: 2, role: 'section', cells: cellsOf(map, 1, 4, 23, 7) }];
    const st = dept({ map, you: [0, 1], exhibits: [{ sp: 'S9.6', at: [12, 2], stats: S('skirmisher', 3) }] }, rooms, [0, 1], [[24, 1]]);
    const rep = LRunner.measure(st), m = st.dept, b = rep.best.b;
    assert.equal(rep.short, 24);
    assert.equal(b.b, 0, 'the way round wakes nothing');
    assert.ok(b.route.some(k => Int(k, m)[1] === 7), 'it goes round by row 7');
    // The shortest route alone would wake the Hopper and fail (one skirmisher costs more than
    // 80% of the runner at depth 3: 29.57 of 20).
    const M = LRunner.model(st), straight = LRunner.cost(M, along(m, ROUTE));
    assert.equal(wokeOf(straight, 'S9.3.room.1').how, 'ring');
    assert.ok(straight.b > N.RUNNER_PASS_PCT * rep.hp);
    // The hall: the way round comes back by column 20; made the hall's, it is shut, and the
    // runner goes by row 1, waking the Hopper, rather than through the hall.
    const routeOf = s => LRunner.measure(s).best.b.route.map(k => Int(k, s.dept));
    const hopper = () => [{ sp: 'S9.6', at: [12, 2], stats: S('skirmisher', 3) }];
    const viaHall = routeOf(dept({ map, you: [0, 1], exhibits: hopper() }, rooms.concat([{ id: 3, role: 'centre', cells: [[20, 4], [20, 5], [20, 6]] }]), [0, 1], [[24, 1]]));
    assert.ok(viaHall.every(([, y]) => y <= 3), 'never in the hall, at any cost');
    // A staff door on column 20 likewise.
    const staff = map.map((r, y) => y === 5 ? r.slice(0, 20) + 'S' + r.slice(21) : r);
    const viaStaff = routeOf(dept({ map: staff, you: [0, 1], exhibits: hopper() }, rooms, [0, 1], [[24, 1]]));
    assert.ok(viaStaff.every(([, y]) => y <= 3), 'never through a staff door, at any cost');
    // A sleeper standing in the only way: no route.
    const shut = dept({ map: ['#####', 'E...X', '#####'], you: [0, 1], exhibits: [{ sp: 'S9.6', at: [2, 1], stats: S('skirmisher', 3) }] }, [{ id: 1, role: 'section', cells: row(1, 1, 3) }], [0, 1], [[4, 1]]);
    assert.match(LRunner.measure(shut).none, /^no way to an exit but through/);
    assert.match(LRunner.check(shut, null).reason, /^the worst-case runner finds no way to an exit but through the hall, a staff door or an exhibit that stands still$/);
  });
  const Int = (k, m) => [k % m.w, (k - (k % m.w)) / m.w];

  test('a closed door on the route takes a turn to open: the route stands a turn before it, and played, it reaches the exit', () => {
    const map = ['###########', 'E....+....X', '###########'];
    const st = dept({ map, you: [0, 1], exhibits: [] }, [{ id: 1, role: 'section', cells: row(1, 1, 4) }, { id: 2, role: 'section', cells: row(1, 6, 9) }], [0, 1], [[10, 1]]);
    const b = LRunner.measure(st).best.b, m = st.dept;
    same(b.route.map(k => k % m.w), [0, 1, 2, 3, 4, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(LRunner.model(st).short, 11);
    const g = State.clone(st);
    assert.equal(play(g, b.route), null);
    same([g.actors[0].x, g.actors[0].y, g.tick], [10, 1, 1100]);
  });

  // ---- Real departments ----

  const ACCS = ['S9', 'A4', 'M11'];
  const made = [];
  for (const acc of ACCS) for (let s = 1; s <= 7; s++) made.push({ acc, seed: s, depth: s, state: Dept.create(s, acc, s) });

  test('on real departments: legal routes from the entrance to an exit, (a) never above (b), nothing drawn or changed, the same twice', () => {
    for (const d of made) {
      const where = `${d.acc} seed ${d.seed}`, st = d.state, m = st.dept, before = JSON.stringify(st);
      const rep = LRunner.measure(st), again = LRunner.measure(st);
      assert.equal(JSON.stringify(st), before, `${where}: the state is unchanged`);
      same(again, rep, `${where}: the same report twice`);
      assert.ok(!rep.none, `${where}: ${rep.none}`);
      const hall = m.rooms.filter(r => r.role === 'centre').map(r => r.id);
      for (const how of LRunner.CHARGES) {
        const r = rep.best[how].route.map(k => Int(k, m));
        same(r[0], [st.actors[0].x, st.actors[0].y], `${where}: starts where you stand, inside the entrance`);
        assert.ok(m.exits.some(e => e[0] === r[r.length - 1][0] && e[1] === r[r.length - 1][1]), `${where}: ends on an exit`);
        for (let i = 1; i < r.length; i++) {
          const [x, y] = r[i], dir = [0, 1, 2, 3, 4, 5, 6, 7].find(k => r[i - 1][0] + Grid.DX[k] === x && r[i - 1][1] + Grid.DY[k] === y);
          // A turn is a step or a wait (a timed route waits for a patrol, and to open a door).
          assert.ok((x === r[i - 1][0] && y === r[i - 1][1]) || (dir !== undefined && Grid.canStep(m, r[i - 1][0], r[i - 1][1], dir)), `${where}: turn ${i} is a step or a wait`);
          assert.ok(!'Ss'.includes(Grid.ch(m, x, y)) && !hall.includes(m.roomOf[y][x]), `${where}: (${x}, ${y}) is no staff door and not the hall`);
          assert.ok(!st.actors.some((a, j) => j > 0 && !a.gone && a.mode === 'dormant' && C.Actors.covers(a, x, y)), `${where}: (${x}, ${y}) holds no sleeper`);
        }
        assert.ok(rep.best[how].length <= rep.horizon);
      }
      // (a) is never above (b) on a route, so the cheapest (a) is never above the cheapest (b).
      assert.ok(rep.best.a.a <= rep.best.b.b, where);
      for (const f of rep.best.b.fights) assert.ok(f.a <= f.b, where);
      // check() is (b) at RUNNER_PASS_PCT.
      const v = LRunner.check(st, null);
      assert.equal(v === null, LRunner.passes(rep, 'b', N.RUNNER_PASS_PCT), where);
      if (v) assert.match(v.reason, new RegExp(`costs ${Math.ceil(rep.best.b.b / 100)} of its ${rep.hp} HP \\(at most ${Math.floor(N.RUNNER_PASS_PCT * rep.hp / 100)}, ${N.RUNNER_PASS_PCT}%\\): (the .+ (wakes|sees it).* at turn \\d+(, and \\d+ more join the fight)?|the line of .+ strikes it at turn \\d+)$`), where);
      if (v) assert.ok(!/undefined|NaN|\[object|null/.test(v.reason), v.reason);
    }
  });

  test('on S.9 the alarm wakes every sleeper that can hear two turns after a Wader sees the runner', () => {
    // With no patrol timed, each Wader sees whatever it could on its round, so most routes are seen.
    let seen = 0;
    for (const d of made.filter(x => x.acc === 'S9')) {
      const M = LRunner.model(d.state, { timing: 'off' }), b = LRunner.measure(d.state, { timing: 'off' }).best.b, w = b.woken.filter(x => x.how === 'sight' && x.sp === 'S9.2');
      if (!w.length) continue;
      seen++;
      const t = Math.min(...w.map(x => x.turn));
      for (const e of M.ex) if (e.a.mode === 'dormant') {
        const got = b.woken.find(x => x.uid === e.a.uid);
        assert.ok(got && got.turn <= t + 2, `${d.seed}: ${e.a.uid} woken by turn ${t + 2}`);
      }
    }
    assert.ok(seen >= 5, 'most S.9 departments put the runner in a Wader\'s sight');
    // With no chain wakings (D2.3's list), only the Waders and what the route itself wakes.
    const d = made.find(x => x.acc === 'S9' && x.seed === 1), off = LRunner.measure(d.state, { chain: 'off', timing: 'off' });
    assert.ok(off.best.b.woken.every(x => ['ring', 'axis', 'tether', 'sight'].includes(x.how)));
  });

  test('the axis and tether tiles are never fewer than Wake.onAxis and Wake.inTether give, with you standing on each', () => {
    let axes = 0, tethers = 0;
    for (const d of made) {
      const st = State.clone(d.state), m = st.dept, M = LRunner.model(st), you = st.actors[0], home = [you.x, you.y];
      for (const e of M.ex) {
        if (!e.axis && !e.tether) continue;
        if (e.axis) axes++; if (e.tether) tethers++;
        for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
          if (!Grid.walkable(m, x, y)) continue;
          you.x = x; you.y = y;
          const k = y * m.w + x;
          if (e.axis && Wake.onAxis(st, e.a)) assert.ok(e.axis[k], `${d.acc} ${d.seed}: ${e.a.uid}'s axis at (${x}, ${y})`);
          if (e.tether) assert.equal(!!e.tether[k], Wake.inTether(st, e.a), `${d.acc} ${d.seed}: ${e.a.uid}'s tether at (${x}, ${y})`);
        }
      }
      [you.x, you.y] = home;
    }
    assert.ok(axes >= 5 && tethers >= 3, `axes ${axes}, tethers ${tethers}`);
  });

  // ---- Timed patrols (CP1 review) ----

  // Plays a route in the game: a wait where it stays (or, before a closed door it then steps
  // onto, the step that opens it), else the step onto its next tile. Returns null, or why not.
  function play(st, route) {
    const m = st.dept, w = m.w, xy = k => [k % w, (k - (k % w)) / w];
    for (let i = 1; i < route.length; i++) {
      const k = route[i - 1];
      let q = route[i];
      if (q === k) {
        const nx = route[i + 1];
        if (nx === undefined || nx === k || Grid.ch(m, ...xy(nx)) !== '+') { if (Step.step(st, { a: 'wait' }).some(e => e.k === 'refused')) return `turn ${i}: the wait refused`; continue; }
        q = nx;
      }
      const [x, y] = xy(k), [u, v] = xy(q), dir = [0, 1, 2, 3, 4, 5, 6, 7].find(d => x + Grid.DX[d] === u && y + Grid.DY[d] === v);
      const r = Step.step(st, { a: 'move', dir });
      if (r.some(e => e.k === 'refused')) return `turn ${i}: the step refused (${r.find(e => e.k === 'refused').reason})`;
      if (st.over) return `turn ${i}: the visit is over`;
    }
    return null;
  }
  const waits = route => route.filter((k, i) => i > 0 && k === route[i - 1]).length;
  // The Intro's exhibits, which the runner leaves out (D2.3), taken away for a game played.
  const noIntro = st => { const id = st.dept.rooms.find(r => r.role === 'intro').id; for (const a of st.actors.slice(1)) if (st.dept.roomOf[a.y][a.x] === id) a.gone = true; return st; };

  // A corridor (row 1, the route), a doorway at (9, 2), and a side room below where a Wader
  // walks its round, west to east and back, seeing up through the doorway only near it.
  const SIDE = ['#########################', 'E.......................X', '#########.###############', '#.......................#', '#.......................#', '#########################'];
  const SIDE2 = ['#########################', 'E.......................X', '#.......................#', '#########.###############', '#.......................#', '#.......................#', '#########################'];
  function side(map, more) {
    const top = map === SIDE ? [1] : [1, 2], low = map === SIDE ? [3, 4] : [4, 5], door = map === SIDE ? 2 : 3;
    const st = dept({ map, you: [0, 1], exhibits: [{ sp: 'S9.2', at: [1, low[0]], stats: S('warden', 3) }].concat(more || []) },
      [{ id: 1, role: 'section', cells: [].concat(...top.map(y => row(y, 1, 23))) }, { id: 2, role: 'section', cells: [].concat(...low.map(y => row(y, 1, 23))) }], [0, 1], [[24, 1]]);
    const a = st.actors[1];
    a.route = { posts: [[1, low[0]], [23, low[0]]], i: 1 };
    assert.equal(a.mode, 'awake'); assert.equal(Grid.ch(st.dept, 9, door), '.');
    return st;
  }

  test('Patrol.timeline is the game: each Wader stands where it says at every turn while you wait unseen', () => {
    let compared = 0;
    const check = (st, where, turns) => {
      const t = Patrol.timeline(st, turns), pats = st.actors.filter(a => a.arch === 'patrol_guard');
      assert.ok(t && t.length === pats.length, `${where}: a timeline for each patrol`);
      for (let k = 1; k <= turns - 2; k++) {
        Step.step(st, { a: 'wait' });
        if (pats.some(a => a.mode !== 'awake')) return;
        for (const p of t) {
          const a = pats.find(b => b.uid === p.uid), at = p.at.find(q => q.t >= st.tick);
          same([a.x, a.y], [at.x, at.y], `${where}: ${a.uid} at tick ${st.tick}`);
        }
      }
      compared++;
    };
    check(side(SIDE), 'the side room', 60);
    for (const d of made.filter(x => x.acc === 'S9')) check(noIntro(State.clone(d.state)), `S9 seed ${d.seed}`, 80);
    assert.ok(compared >= 6, `${compared} compared to the end`);
    // Where it cannot be told (another exhibit awake on no round): null. Asked again of the
    // same state, the same answer; of a Wader moved, worked out again.
    const st = side(SIDE, [{ sp: 'S9.6', at: [20, 4], stats: S('skirmisher', 3), mode: 'awake' }]);
    assert.equal(Patrol.timeline(st, 20), null);
    const s2 = side(SIDE), t1 = Patrol.timeline(s2, 30);
    same(Patrol.timeline(s2, 30), t1);
    s2.actors[1].x = 5;
    assert.equal(Patrol.timeline(s2, 30)[0].at[0].x, 5);
  });

  test('a timed patrol sees, at each of its actions, every tile you could stand on within SIGHT_EXHIBIT in line of sight (Grid.los, every door open), and walks by AI.field', () => {
    let checked = 0;
    for (const d of made.filter(x => x.acc === 'S9')) {
      const st = d.state, m = st.dept, M = LRunner.model(st), open = Object.assign({}, m, { tiles: m.tiles.map(r => r.replace(/\+/g, "'")), surfaces: [] });
      for (const p of Patrol.timeline(st, M.horizon)) {
        const e = M.ex.find(x => x.a.uid === p.uid), want = new Uint8Array(m.w * m.h);
        const R = N.SIGHT_EXHIBIT, at = new Set();
        for (const q of p.at) at.add(q.y * m.w + q.x);
        for (const k of at) for (let y = Math.max(0, (k - (k % m.w)) / m.w - R); y <= Math.min(m.h - 1, (k - (k % m.w)) / m.w + R); y++) for (let x = Math.max(0, (k % m.w) - R); x <= Math.min(m.w - 1, (k % m.w) + R); x++)
          if (Grid.walkable(open, x, y) && !Grid.closedDoor(open, x, y) && Grid.disc(x - (k % m.w), y - (k - (k % m.w)) / m.w, R) && Grid.los(open, k % m.w, (k - (k % m.w)) / m.w, x, y)) want[y * m.w + x] = 1;
        same(Array.from(e.sight), Array.from(want), `S9 seed ${d.seed}: ${p.uid}'s sight`);
        // And the walking field of each of its posts is AI.field's.
        const a = st.actors.find(x => x.uid === p.uid);
        for (const q of a.route.posts) same(Array.from(Patrol.walkField(m, q)), Array.from(C.AI.field(st, a, q, 'onto')), `S9 seed ${d.seed}: ${p.uid}'s field to ${q}`);
        checked++;
      }
    }
    assert.ok(checked >= 10, `${checked} patrols`);
  });

  test('a patrol whose way to a post is blocked for good by an exhibit that stands still is stuck; one behind another patrol is not', () => {
    // Its east post (23, 3) walled in by a sleeper at (22, 3) and a case at (23, 4)... here, a
    // sleeper on the only tile beside a post in a dead end.
    const map = ['#########################', 'E.......................X', '#########.###############', '#.....................###', '#.......................#', '#########################'];
    const st = dept({ map, you: [0, 1], exhibits: [{ sp: 'S9.2', at: [1, 3], stats: S('warden', 3) }, { sp: 'S9.6', at: [22, 4], stats: S('skirmisher', 3), mode: 'dormant' }] },
      [{ id: 1, role: 'section', cells: row(1, 1, 23) }, { id: 2, role: 'section', cells: row(3, 1, 21).concat(row(4, 1, 23)) }], [0, 1], [[24, 1]]);
    st.actors[1].route = { posts: [[1, 3], [23, 4]], i: 1 };
    const t = Patrol.timeline(st, 80);
    same(t[0].stuck, { post: 1 });
    // Free, it walks the round and is not stuck.
    st.actors[2].gone = true;
    assert.equal(Patrol.timeline(st, 80)[0].stuck, null);
    // Two Waders head on in a one-tile corridor, each walking to the other's end: the one whose
    // action it is steps aside, back the way it came (M4 FU3), until one stands beside its post
    // with the other on it, and so heads for the next: neither is stuck; nor is one following
    // another. Hemmed in, each with a sleeper at its back, neither can step aside: each waits on
    // the other for good, and the later in spawn order is stuck.
    const lane = ['############', 'E..........X', '############'];
    const two = (a, b, more) => {
      const s2 = dept({ map: lane, you: [0, 1], exhibits: [{ sp: 'S9.2', at: a.at, stats: S('warden', 3) }, { sp: 'S9.2', at: b.at, stats: S('warden', 3) }].concat(more || []) }, [{ id: 1, role: 'section', cells: row(1, 1, 10) }], [0, 1], [[11, 1]]);
      s2.actors[1].route = { posts: a.posts, i: 1 }; s2.actors[2].route = { posts: b.posts, i: 1 };
      return Patrol.timeline(s2, 40).map(p => p.stuck);
    };
    same(two({ at: [2, 1], posts: [[2, 1], [10, 1]] }, { at: [9, 1], posts: [[9, 1], [1, 1]] }), [null, null]);
    same(two({ at: [3, 1], posts: [[3, 1], [10, 1]] }, { at: [2, 1], posts: [[2, 1], [9, 1]] }), [null, null]);
    const asleep = x => ({ sp: 'S9.6', at: [x, 1], stats: S('skirmisher', 3), mode: 'dormant' });
    same(two({ at: [4, 1], posts: [[4, 1], [10, 1]] }, { at: [5, 1], posts: [[5, 1], [1, 1]] }, [asleep(3), asleep(6)]), [null, { post: 1 }]);
  });

  test('the runner times a patrol: it waits for the gap, and the route, played, wakes nothing; untimed, the patrol sees it', () => {
    const st = side(SIDE), rep = LRunner.measure(st), b = rep.best.b;
    same([b.b, b.woken.length], [0, 0]);
    assert.ok(waits(b.route) > 0, 'it waits');
    const off = LRunner.measure(st, { timing: 'off' });
    assert.ok(!LRunner.passes(off, 'b', N.RUNNER_PASS_PCT) && off.best.b.woken.some(w => w.how === 'sight'), 'untimed, seen');
    // Straight through, it is seen as the Wader passes the doorway.
    assert.equal(LRunner.cost(LRunner.model(st), along(st.dept, ROUTE)).woken[0].how, 'sight');
    const game = State.clone(st);
    assert.equal(play(game, b.route), null);
    same([game.actors[0].x, game.actors[0].y, game.actors[0].hp], [24, 1, game.actors[0].maxHp]);
    assert.equal(game.actors[1].mode, 'awake', 'the Wader never saw you');
    // On S.9: routes that wait, played in the game (the Intro's exhibits taken away), reach an
    // exit with every exhibit as it was, where the untimed model has a Wader see them.
    let played = 0, seen = 0;
    for (const seed of [4, 8, 10, 12, 13, 16]) {
      const s9 = noIntro(Dept.create(seed, 'S9', 1 + ((seed - 1) % 7))), r = LRunner.measure(s9).best.b;
      if (r.b !== 0 || !waits(r.route)) continue;
      const modes = s9.actors.map(a => a.mode), g = State.clone(s9);
      assert.equal(play(g, r.route), null, `S9 seed ${seed}`);
      assert.ok(g.dept.exits.some(e => e[0] === g.actors[0].x && e[1] === g.actors[0].y), `S9 seed ${seed}: at an exit`);
      same(g.actors.map(a => a.mode), modes, `S9 seed ${seed}: nothing woke, no Wader hunts`);
      played++;
      if (!LRunner.passes(LRunner.measure(s9, { timing: 'off' }), 'b', N.RUNNER_PASS_PCT)) seen++;
    }
    assert.ok(played >= 4 && seen >= 3, `played ${played}, seen untimed ${seen}`);
  });

  test('once the runner has a fight, a timed patrol finds it wherever it could see it on its round', () => {
    // The same route through both rooms: wait, then straight along row 1. Without a sleeper,
    // the Wader never sees it; with a Hopper woken on the way, the Wader is taken to find it as
    // it passes the doorway later.
    const free = side(SIDE2), M0 = LRunner.model(free);
    let route = null;
    for (let w = 0; w < 40 && !route; w++) {
      const r = along(free.dept, Array.from({ length: w }, () => [0, 1]).concat(ROUTE));
      if (!LRunner.cost(M0, r).woken.length) route = r;
    }
    assert.ok(route, 'a wait that misses the Wader');
    const st = side(SIDE2, [{ sp: 'S9.6', at: [4, 2], stats: S('skirmisher', 3), mode: 'dormant' }]), rep = LRunner.cost(LRunner.model(st), route);
    const hop = wokeOf(rep, 'S9.3.room.2'), wader = wokeOf(rep, 'S9.3.room.1');
    same([hop.how, wader && wader.how], ['ring', 'sight']);
    assert.ok(wader.turn > hop.turn);
    // Untimed patrols (timing off) are the same either way: seen at once.
    assert.ok(wokeOf(LRunner.cost(LRunner.model(free, { timing: 'off' }), route), 'S9.3.room.1'));
  });

  // ---- A station's line (M.11) ----

  // A corridor of M.11 with a station at (12, 2) whose line runs north across row 1.
  function station() {
    const map = ['#########################', 'E.......................X', '#.......................#', '#########################'];
    const st = dept({ acc: 'M11', map, you: [0, 1], exhibits: [{ sp: 'M11.2', at: [12, 2], stats: S('controller', 3), mode: 'dormant' }] },
      [{ id: 1, role: 'section', cells: cellsOf(map, 1, 1, 23, 2) }], [0, 1], [[24, 1]]);
    st.actors[1].route = { dir: 'N' };
    Modules.init(st, Packs.get('M11'));
    return st;
  }

  test('a station\'s line is charged once when the route stands on it as it goes off, and a timed route waits it out', () => {
    const st = station(), M = LRunner.model(st), e = M.ex[0];
    // Its chimes at turns 10, 22, … (count ≡ 12 − 2), its line going off at 12, 24, …
    same(e.lines.slice(0, 2).map(([j, mask]) => [j, mask[st.dept.w + 12]]), [[12, 1], [24, 1]]);
    const net = Math.max(N.DMG_MIN_ON_HIT, C.Specials.info(st, 'demo_line').gross - M.run.pad);
    assert.equal(M.lineNet, net);
    // Straight along row 1, on (12, 1) at turn 12 as it goes off: charged once, in every charge.
    const straight = LRunner.cost(M, along(st.dept, ROUTE));
    same([straight.lines, straight.a, straight.b, straight.c], [[{ uid: st.actors[1].uid, turn: 12 }], 100 * net, 100 * net, 100 * net]);
    // A turn later it is not.
    assert.equal(LRunner.cost(M, along(st.dept, [[0, 1]].concat(ROUTE))).lines.length, 0);
    // The cheapest route waits; played in the game, the line misses you; straight, it strikes.
    const b = LRunner.measure(st).best.b;
    same([b.b, b.lines.length], [0, 0]);
    const g = State.clone(st), you = g.actors[0];
    assert.equal(play(g, b.route), null);
    assert.equal(you.hp, you.maxHp, 'the waited route is never struck');
    const g2 = State.clone(st);
    assert.equal(play(g2, along(st.dept, ROUTE)), null);
    assert.equal(g2.actors[0].maxHp - g2.actors[0].hp, net, 'the straight route is struck for the charged net');
    // With the module switched off, no line.
    const off = State.clone(st);
    off.options = Object.assign({}, off.options, { rulesOff: ['hourly_demonstration'] });
    assert.equal(LRunner.model(off).ex[0].lines, undefined);
    same(LRunner.measure(off).best.b.lines, []);
  });

  // ---- Content: the Waders' rounds and the Copying-Room Bell (CP1 review) ----

  test('S.9\'s Waders walk the court, each its own round, never past the Intro\'s mouth and never stalling', () => {
    for (let seed = 1; seed <= 7; seed++) {
      const g = Dept.generate(seed, 'S9', 1 + ((seed - 1) % 7)), st = g.state, m = st.dept, where = `S9 seed ${seed}`;
      const pats = st.actors.filter(a => a.arch === 'patrol_guard'), court = m.rooms.find(r => r.id === m.roomOf[pats[0].y][pats[0].x]);
      assert.equal(pats.length, 2, where);
      assert.equal(Populate.galleryOf(st, court.id).key, 's1', `${where}: in the Mount Court's room`);
      // Each starts on its first post; their posts apart, and in the court's half farther from
      // the Intro (its centre's column or row, as the court is wide or tall).
      const intro = m.rooms.find(r => r.role === 'intro'), wide = court.x1 - court.x0 >= court.y1 - court.y0;
      const mid = wide ? (court.x0 + court.x1) / 2 : (court.y0 + court.y1) / 2, from = wide ? (intro.x0 + intro.x1) / 2 : (intro.y0 + intro.y1) / 2;
      for (const a of pats) {
        same([a.x, a.y], a.route.posts[0], `${where}: ${a.uid} on its first post`);
        for (const p of a.route.posts) assert.ok(from < mid ? (wide ? p[0] : p[1]) > mid : (wide ? p[0] : p[1]) < mid, `${where}: ${a.uid}'s post ${p} in the far half`);
      }
      assert.ok(!pats[0].route.posts.some(p => pats[1].route.posts.some(q => p[0] === q[0] && p[1] === q[1])), `${where}: rounds of their own`);
      // Walking its round, none stalls, and none sees the safe zone (every door open) in its
      // first SAFE_ZONE_TURNS turns.
      const t = Patrol.timeline(st, 120);
      for (const p of t) assert.equal(p.stuck, null, `${where}: ${p.uid} walks its whole round`);
      const open = Object.assign({}, m, { tiles: m.tiles.map(r => r.replace(/\+/g, "'")), surfaces: [] }), dz = Grid.distances(open, [m.entrance], N.SAFE_ZONE), zone = [];
      for (let k = 0; k < dz.length; k++) if (dz[k] >= 0) zone.push(k);
      for (const p of Patrol.timeline(st, N.SAFE_ZONE_TURNS)) for (const q of p.at) for (const k of zone) {
        const x = k % m.w, y = (k - x) / m.w;
        assert.ok(!(Grid.disc(x - q.x, y - q.y, N.SIGHT_EXHIBIT) && Grid.los(open, q.x, q.y, x, y)), `${where}: ${p.uid} at ${q.x},${q.y} sees the safe zone at ${x},${y}`);
      }
    }
    // A post its walk would stall on is left out, and the log says so (seeds 1, 6 and 7 here).
    const g = Dept.generate(6, 'S9', 6);
    assert.ok(g.log.some(l => /round leaves out its post at \d+,\d+: its walk there would stall$/.test(l.op || '')));
  });

  test('the Copying-Room Bell stands out of call of every exhibit; apart is a herald\'s option only', () => {
    let apart = 0;
    for (let seed = 1; seed <= 14; seed++) {
      const g = Dept.generate(seed, 'A4', 1 + ((seed - 1) % 7)), st = g.state, bell = st.actors.find(a => a.sp === 'A4.3');
      if (!bell) continue;
      const near = st.actors.filter(a => a !== bell && a.uid !== 'you' && !a.gone && !C.Actors.centrepiece(a) && C.Actors.footprint(a).some(([x, y]) => Grid.disc(x - bell.x, y - bell.y, N.HERALD_RANGE)));
      const said = g.log.some(l => /found no tile in \S+ out of call of every exhibit/.test(l.op || ''));
      if (!said) { same(near.map(a => a.uid), [], `A4 seed ${seed}`); apart++; }
      assert.equal(Populate.galleryOf(st, st.dept.roomOf[bell.y][bell.x]).key, 's2', `A4 seed ${seed}: in the Copying Room`);
    }
    assert.ok(apart >= 12, `${apart} apart`);
    const pack = JSON.parse(JSON.stringify(Packs.get('A4')));
    pack.galleries[1].contents[1].apart = true;
    assert.ok(Populate.check(pack).some(p => /apart is true, and only for a herald/.test(p)));
  });

  test('LRunner.check is neutral where there is no department, and the sweep tool reports each charge', () => {
    assert.equal(LRunner.check(C.TestRoom.create(1), null), null);
    same(LRunner.measure(Setup.room(1, { acc: 'S9', map: MAP, you: [5, 3] })), { none: 'not a department' });
    const T = require(path.join(root, 'tools/runner-sweep.js'));
    assert.throws(() => T.parse(['--seeds', '5']), /--seeds takes a range/);
    assert.throws(() => T.parse(['--pct', '0']), /--pct takes whole numbers/);
    assert.throws(() => T.parse(['--runner', 'x']), /--runner takes hp/);
    assert.throws(() => T.parse(['--timing', 'on']), /--timing takes off/);
    assert.equal(T.parse(['--timing', 'off']).timing, 'off');
    const opt = T.parse(['--dept', 'M11', '--seeds', '1-3', '--pct', '80,50']), rows = T.sweep(C, 'M11', opt);
    same(rows.map(r => [r.seed, r.depth]), [[1, 1], [2, 2], [3, 3]]);
    const lines = T.report('M11', rows, opt, T.waiting(C, 'M11'));
    assert.match(lines[0], /^M11: 3 seeds \(1–3\)/);
    assert.match(lines[1], /^ {2}pass at 80%: {2}\(a\) [\d.]+% {2}\(b\) [\d.]+% {2}\(c\) [\d.]+%$/);
    assert.match(lines[2], /^ {2}pass at 50%/);
    // The stations are placed once clockwork is ready (ARCH-CLOCKWORK); the Centrepiece waits.
    assert.ok(lines.some(l => /not placed yet: M11\.11 \(the Centrepiece, mp_tableau\)$/.test(l)), lines.join('\n'));
  });

  // ---- LV11, the validator, its moves and its gate (D-RUNNER) ----

  // A corridor five tiles tall from the entrance (0, 1) to the exit (34, 1), one room, with
  // Brooders (tethered wardens, each guarding its own tile) at the given tiles, beyond the
  // safe zone.
  function corridor(at, Y) {
    const wall = '#'.repeat(35), floor = '#' + '.'.repeat(33) + '#', map = [wall, 'E' + '.'.repeat(33) + 'X', floor, floor, floor, floor, wall];
    return dept({ map, you: [0, 1], exhibits: at.map(t => ({ sp: 'S9.4', at: t, stats: S('warden', 3), guards: t.slice() })) },
      [{ id: 1, role: 'section', cells: cellsOf(map, 1, 1, 33, 5) }], [0, 1], [[34, 1]], Y);
  }

  test('a corridor of wardens fails LV11: two moves are tried and undone, and the state is as it was; planted in S.9\'s coda, an attempt reseeds', () => {
    // Each Brooder in row 3 holds every row of the corridor within its tether (2 tiles), so no
    // way through misses all three; two moves clear two of them, never the third.
    const st = corridor([[14, 3], [20, 3], [26, 3]]), before = JSON.stringify(st), log = [];
    const no = LRunner.check(st, null, log);
    assert.ok(no, 'rejected');
    assert.match(no.reason, /^the worst-case runner's cheapest route costs \d+ of its 25 HP \(at most 20, 80%\): the Ground-Nesting Brooder, With Its Nest wakes as it nears what it guards at turn \d+; with the Ground-Nesting Brooder, With Its Nest, moved from 14,3 to \d+,5, then with the Ground-Nesting Brooder, With Its Nest, moved from 20,3 to \d+,5, it still costs \d+$/);
    assert.equal(JSON.stringify(st), before, 'every move undone');
    same(log, []);
    // With RUNNER_MOVES 3 a third move clears the way.
    const Y3 = loadCore(null, { numbers: { RUNNER_MOVES: 3 } }), st3 = corridor([[14, 3], [20, 3], [26, 3]], Y3), log3 = [];
    assert.equal(Y3.LRunner.check(st3, null, log3), null);
    assert.equal(log3.length, 3);
    // Nine more Brooders planted in S.9's coda, through which every way to an exit runs: an
    // attempt the moves cannot repair is rejected and reseeds; a department made passes LV11 run
    // again, or is the certified fallback with LV11's rejection kept; none has an exhibit removed.
    const coda = Packs.get('S9').galleries.find(g => g.key === 'coda'), had = coda.contents;
    coda.contents = had.concat([{ sp: 'S9.4', count: 9 }]);
    try {
      let reseeded = 0;
      for (let seed = 2; seed <= 3; seed++) {
        const g = Dept.generate(seed, 'S9', 3), lv11 = g.tries.flat().filter(f => f.id === 'lv11');
        for (const f of lv11) assert.match(f.why, /^the worst-case runner(?: finds no way to an exit but through .+|'s cheapest route costs \d+ of its 25 HP \(at most 20, 80%\): the .+)$/);
        if (lv11.length) reseeded++;
        assert.ok(LRunner.passes(LRunner.measure(g.state), 'b', N.RUNNER_PASS_PCT) || (g.fallback && g.rejected.id === 'lv11'), `S9 seed ${seed}`);
        assert.equal(g.state.actors.filter(a => a.sp === 'S9.4' && !a.gone).length, 10, `S9 seed ${seed}: no Brooder removed`);
      }
      assert.equal(reseeded, 2);
    } finally { coda.contents = had; }
  });

  test('a move repairs a planted department: the costliest exhibit the route wakes goes to the nearest tile clear of it, said in a sentence; with RUNNER_MOVES 0 it is rejected', () => {
    // A Brooder at (14, 3) holds every way along the corridor within its tether.
    const st = corridor([[14, 3]]), b = st.actors[1], log = [];
    assert.ok(!LRunner.passes(LRunner.measure(st), 'b', N.RUNNER_PASS_PCT));
    assert.equal(LRunner.check(st, null, log), null);
    same([b.x, b.y, b.home, b.guards], [13, 5, [13, 5], [13, 5]]);
    same(log, [{ check: 'LV11', room: 1, op: 'moved the Ground-Nesting Brooder, With Its Nest, from 14,3 to 13,5: the worst-case runner\'s way came within 2 tiles of what it guards, which wakes it at once; from 13,5 it passes clear of it' }]);
    const rep = LRunner.measure(st);
    same([rep.best.b.b, rep.best.b.woken.length], [0, 0]);
    // Played in the game, the way the runner now takes wakes nothing.
    const g = State.clone(st);
    assert.equal(play(g, rep.best.b.route), null);
    same(g.actors.map(a => a.mode), st.actors.map(a => a.mode));
    // With no move allowed, the same department is rejected, as it stands.
    const Y0 = loadCore(null, { numbers: { RUNNER_MOVES: 0 } }), st0 = corridor([[14, 3]], Y0);
    assert.match(Y0.LRunner.check(st0, null, []).reason, /: the Ground-Nesting Brooder, With Its Nest wakes as it nears what it guards at turn \d+$/);
    same([st0.actors[1].x, st0.actors[1].y], [14, 3]);
    // On real departments a move is made only where LV6 still passes, and never onto a tile a
    // patrol walks or a station's line takes (A.4 seed 10, M.11 seeds 13 and 37 move).
    for (const [acc, seed] of [['A4', 10], ['M11', 13], ['M11', 37]]) {
      const made = Dept.generate(seed, acc, 1 + ((seed - 1) % 7)), s2 = made.state, moves = made.log.filter(l => l.check === 'LV11');
      assert.ok(moves.length >= 1 && moves.length <= N.RUNNER_MOVES, `${acc} seed ${seed}: ${moves.length} moves`);
      assert.equal(C.LV6.check(s2, null), null, `${acc} seed ${seed}`);
      for (const l of moves) {
        const q = /from (\d+),(\d+) to (\d+),(\d+)/.exec(l.op), a = s2.actors.find(x => x.x === +q[3] && x.y === +q[4]);
        assert.ok(a && a.mode === 'dormant' && C.Labels.nameOf(s2)(a.uid) && l.op.startsWith(`moved ${C.Labels.nameOf(s2)(a.uid)}`), l.op);
        assert.ok(!(C.Patrol.timeline(s2, 120) || []).some(p => p.at.some(t => t.x === a.x && t.y === a.y)), l.op);
        for (const st2 of s2.actors.filter(x => C.HourlyDemonstration.isStation(s2, x))) assert.ok(!C.HourlyDemonstration.reach(s2, st2).some(t => t[0] === a.x && t[1] === a.y), l.op);
      }
    }
  });

  test('a tethered warden strikes only within its tether: woken outside it, it is charged nothing and, played, never strikes; reached later, it fights from then, and the oracle agrees', () => {
    const check = require(path.join(root, 'test/sweep/runner.check.js'))(C);
    // A corridor `rows` tall, with one Brooder (a tethered warden guarding its own tile).
    const hall = (at, rows, more) => {
      const wall = '#'.repeat(35), floor = '#' + '.'.repeat(33) + '#', map = [wall, 'E' + '.'.repeat(33) + 'X'].concat(Array(rows - 1).fill(floor), [wall]);
      return dept({ map, you: [0, 1], exhibits: [Object.assign({ sp: 'S9.4', at, stats: S('warden', 3), guards: at.slice() }, more || {})] },
        [{ id: 1, role: 'section', cells: cellsOf(map, 1, 1, 33, rows) }], [0, 1], [[34, 1]]);
    };
    const agrees = (st, rep) => { const o = check.oracle(st, rep.best.b.route, rep.horizon); same([o.b, o.woken], [rep.best.b.b, rep.best.b.woken.map(w => [w.uid, w.turn])]); };
    // At (14, 2) in five rows, its tether (rows 0 to 4 at its column) leaves row 5 free: the way
    // along it passes within its ring and wakes it, but never stands where it strikes (§8.2).
    const st = hall([14, 2], 5), rep = LRunner.measure(st), b = rep.best.b;
    same([b.b, b.woken.map(w => [w.how, w.fights, w.at]), b.fights.length], [0, [['ring', false, null]], 0]);
    agrees(st, rep);
    const log = [];
    assert.equal(LRunner.check(State.clone(st), null, log), null);
    same(log, []);
    // Played in the game, the way wakes it hunting as it passes below (turn 13), it walks back
    // to what it guards, and it never strikes you: you leave with full health.
    const g = State.clone(st), you = g.actors[0], w = g.dept.w, seen = [];
    for (let i = 1; i < b.route.length; i++) {
      const k = b.route[i - 1], q = b.route[i], dir = [0, 1, 2, 3, 4, 5, 6, 7].find(d => k % w + Grid.DX[d] === q % w && Math.floor(k / w) + Grid.DY[d] === Math.floor(q / w));
      for (const e of Step.step(g, { a: 'move', dir })) seen.push(e);
    }
    same([you.x, you.y], [34, 1]);
    assert.ok(seen.some(e => e.k === 'woke' && e.who === g.actors[1].uid && e.mode === 'hunting'), 'the way woke it');
    const uid = g.actors[1].uid;
    assert.ok(!seen.some(e => e.k === 'refused' || ((e.k === 'attacked' || e.k === 'missed') && e.by === uid) || ((e.k === 'telegraphed' || e.k === 'special') && e.who === uid)), 'it never struck at you');
    assert.equal(you.hp, you.maxHp);
    // Charged as before LV11 knew its leash (every waking a fight), the same way would cost its
    // whole fight: the leash is what spares it.
    assert.ok(LRunner.alone(LRunner.terms(st, st.actors[1], LRunner.runner(st)), 'b') > N.RUNNER_PASS_PCT * rep.hp);
    // In four rows every way crosses its tether. With no tether trigger and two pips already,
    // its ring wakes it a turn before the way reaches the tether, and it fights from then.
    const st2 = hall([14, 2], 4, { trigger: null, pips: 2 }), rep2 = LRunner.measure(st2), w2 = rep2.best.b.woken[0];
    same([w2.how, w2.turn, w2.at, rep2.best.b.fights.map(f => f.turn)], ['ring', 11, 12, [12]]);
    agrees(st2, rep2);
    assert.equal(LRunner.check(State.clone(st2), null, []).reason, 'the worst-case runner\'s cheapest route costs 74 of its 25 HP (at most 20, 80%): the Ground-Nesting Brooder, With Its Nest wakes as it passes at turn 11, and strikes once the runner comes within 2 tiles of what it guards, at turn 12');
    // And a move says so: in five rows, at (14, 3), it is moved clear of both.
    const st3 = hall([14, 3], 5, { trigger: null, pips: 2 }), log3 = [];
    assert.equal(LRunner.check(st3, null, log3), null);
    same(log3.map(l => l.op), ['moved the Ground-Nesting Brooder, With Its Nest, from 14,3 to 13,5: the worst-case runner\'s way passed within 3 walking tiles of it, in its sight, for 1 turn, which wakes it, and came within 2 tiles of what it guards, where it strikes; from 13,5 it passes clear of it']);
  });

  test('a tethered warden reached after it wakes: ally_hit and the patrols\' fallback come from the fight it joins, not its waking', () => {
    // The four-row corridor of the test above (woken at turn 11, fighting from 12), with a
    // Hopper far off; its record is made a sleeper only ally_hit can wake, then a patrol whose
    // timeline sees nothing and whose round sees the route's tile at turn 11 only.
    const wall = '#'.repeat(35), floor = '#' + '.'.repeat(33) + '#', map = [wall, 'E' + '.'.repeat(33) + 'X', floor, floor, floor, wall];
    const st = dept({ map, you: [0, 1], exhibits: [{ sp: 'S9.4', at: [14, 2], stats: S('warden', 3), guards: [14, 2], trigger: null, pips: 2 }, { sp: 'S9.6', at: [31, 4], stats: S('skirmisher', 3) }] },
      [{ id: 1, role: 'section', cells: cellsOf(map, 1, 1, 33, 4) }], [0, 1], [[34, 1]]);
    const route = LRunner.measure(st).best.b.route, M = LRunner.model(st), [w, h] = M.ex;
    same(LRunner.wakes(M, route).F.slice(0, 1), [12]);
    h.ring = new Uint8Array(h.ring.length); h.axis = null; w.wakes.push([1, 1, 'ally_hit']);
    const ally = LRunner.wakes(M, route);
    same([ally.T[1], ally.how[1]], [13, 'ally_hit']);
    w.wakes.pop();
    h.turns = route.map(() => []); h.sight = new Uint8Array(h.ring.length); h.sight[route[11]] = 1;
    same(LRunner.wakes(M, route).T[1], -1, 'the round sees the runner only before its first fight');
    h.sight[route[12]] = 1;
    same(LRunner.wakes(M, route).T[1], 12, 'and from the fight on');
  });

  test('LV11\'s early verdict is the full report\'s, and LV11 is the same under any switch and with an exhibit left out', () => {
    // On departments made with LV11 stood aside (some fail), check accepts one as it stands
    // (no move logged) exactly when the full report passes it.
    const keep = LRunner.check;
    let failed = 0;
    for (const [acc, seed] of [['S9', 9], ['A4', 10], ['M11', 13], ['A4', 2]]) {
      LRunner.check = () => null;
      const st = Dept.create(seed, acc, 1 + ((seed - 1) % 7));
      LRunner.check = keep;
      const pass = LRunner.passes(LRunner.measure(st), 'b', N.RUNNER_PASS_PCT), log = [], v = LRunner.check(st, null, log);
      assert.equal(v === null && !log.length, pass, `${acc} seed ${seed}`);
      if (!pass) failed++;
    }
    assert.equal(failed, 3);
    // Where LV11 reseeds (S.9 seed 9) or moves (M.11 seed 37), a module switched off or an
    // exhibit left out changes no exhibit's place (M4 plan A10: paired runs share rooms).
    const where = s => JSON.stringify(s.actors.map(a => [a.uid, a.x, a.y, a.home, a.route]));
    for (const [acc, seed] of [['S9', 9], ['M11', 37]]) {
      const depth = 1 + ((seed - 1) % 7), made = Dept.generate(seed, acc, depth), base = made.state;
      for (const m of Packs.get(acc).modules) assert.equal(where(Dept.create(seed, acc, depth, { rulesOff: [m.id] })), where(base), `${acc} seed ${seed}, ${m.id} off`);
      for (const q of made.log.filter(l => l.check === 'LV11').map(l => /from (\d+),(\d+) to (\d+),(\d+)/.exec(l.op))) {
        const out = base.actors.find(x => x.x === +q[3] && x.y === +q[4]);
        const s = Dept.create(seed, acc, depth, { without: [out.uid] }), rest = q2 => JSON.stringify(q2.actors.filter(x => x.uid !== out.uid).map(x => [x.uid, x.x, x.y]));
        assert.equal(rest(s), rest(base), `${acc} seed ${seed} without ${out.uid}`);
      }
    }
    // LV6 judges as made too (Populate.asMade): M.11 seed 118's first attempt is rejected for
    // a Heliograph whose axis holds the Intro's open doorway; with that Heliograph left out the
    // same attempt is still rejected, so every other exhibit stands where it stood (§3.6).
    const made = Dept.generate(118, 'M11', 6), lv6 = made.tries.flat().filter(f => f.id === 'lv6');
    assert.equal(lv6.length, 1);
    const helio = made.state.actors.find(a => a.arch === 'axis_sniper' && lv6[0].why.includes(C.Labels.nameOf(made.state)(a.uid)));
    const left = Dept.generate(118, 'M11', 6, { without: [helio.uid] }), rest = q2 => JSON.stringify(q2.actors.filter(x => x.uid !== helio.uid).map(x => [x.uid, x.x, x.y]));
    same([left.attempt, left.tries.flat().map(f => f.id)], [made.attempt, ['lv6']]);
    assert.equal(rest(left.state), rest(made.state));
  });

  test('an accept that skips LV11 is caught: the sweep\'s check and the tool\'s gate find the departments it fails', () => {
    const keep = LRunner.check, measure = LRunner.measure, check = require(path.join(root, 'test/sweep/runner.check.js'))(C), T = require(path.join(root, 'tools/runner-sweep.js'));
    const record = (acc, seed) => { const depth = 1 + ((seed - 1) % 7), g = Dept.generate(seed, acc, depth); return { state: g.state, seed, acc, depth, made: { attempt: g.attempt, fallback: g.fallback, tries: g.tries, rejected: g.rejected, log: g.log } }; };
    const opt = T.parse(['--dept', 'M11', '--seeds', '13-13', '--pct', '80', '--check']);
    LRunner.check = () => null;
    try {
      const found = [];
      for (const [acc, seed] of [['S9', 9], ['A4', 10], ['M11', 13]]) { const p = check.each(record(acc, seed)); if (p && /^LV11 fails the department made/.test(p)) found.push(acc); }
      same(found, ['S9', 'A4', 'M11']);
      // The gate on M.11's seed 13, as the tool's --check prints it. (LV11 never ran, so it
      // never reseeded: its first-attempt share alone would pass.)
      const g = T.gate('M11', T.sweep(C, 'M11', opt), opt, check.oracle);
      assert.ok(!g.ok);
      assert.match(g.lines[0], /^M11 gate: every final department passes LV11 at 80%: 0 of 1 \(failing: seeds 13\)$/);
      assert.match(g.lines[1], /^ {2}at the first attempt LV11 judged: 1 of 1 /);
      assert.match(g.lines[g.lines.length - 1], /^ {2}FAILS: a final department fails$/);
    } finally { LRunner.check = keep; }
    // With LV11, the same seed holds, and the oracle agrees.
    const g2 = T.gate('M11', T.sweep(C, 'M11', opt), opt, check.oracle);
    assert.ok(g2.ok, g2.lines.join('\n'));
    // Asked to print 50% first, the gate still judges at LV11's own 80%.
    const opt50 = T.parse(['--dept', 'M11', '--seeds', '13-13', '--pct', '50', '--check']), g50 = T.gate('M11', T.sweep(C, 'M11', opt50), opt50, check.oracle);
    assert.match(g50.lines[0], /^M11 gate: every final department passes LV11 at 80%: 1 of 1$/);
    assert.match(g2.lines[3], /^ {2}the oracle agrees on 1 of 1 \(seeds 1–100\)$/);
    // A runner whose charge is halved is caught by the oracle: A.4 seed 1 passes, its cheapest
    // route waking a fight of three that the oracle charges as LRunner does, until halved.
    const d1 = record('A4', 1), rep = LRunner.measure(d1.state);
    assert.ok(rep.best.b.b > 0 && rep.best.b.fights.some(f => f.uids.length === 3));
    assert.equal(check.each(d1), null);
    LRunner.measure = (st, o) => { const r = measure(st, o); if (!r.none) r.best.b = Object.assign({}, r.best.b, { b: Math.floor(r.best.b.b / 2) }); return r; };
    try { assert.match(check.each(d1), /^the oracle's charge of the reported route is \d+ \(woken .+\), LRunner's \d+ \(woken .+\)$/); } finally { LRunner.measure = measure; }
  });

  test('a Brooder with no case to guard stands where a keeper can walk round it: its tether off the safe zone, every way into its room joined outside its tether and ring', () => {
    let own = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const g = Dept.generate(seed, 'S9', 1 + ((seed - 1) % 7)), s = g.state, m = s.dept, b = s.actors.find(a => a.sp === 'S9.4');
      if (b.guards[0] !== b.x || b.guards[1] !== b.y) continue;
      own++;
      const rm = m.roomOf[b.y][b.x], cells = [];
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.roomOf[y][x] === rm && Grid.walkable(m, x, y)) cells.push([x, y]);
      const zone = Grid.distances(m, [m.entrance], N.SAFE_ZONE);
      for (let y = b.y - 2; y <= b.y + 2; y++) for (let x = b.x - 2; x <= b.x + 2; x++) if (Grid.inside(m, x, y) && Grid.disc(x - b.x, y - b.y, N.TETHER_RANGE) && Grid.walkable(m, x, y)) assert.ok(Grid.reachDist(zone, m, x, y) < 0, `S9 seed ${seed}: its tether holds ${x},${y} of the safe zone`);
      // You, standing on each tile of the room, wake it at once (Wake.inTether) or would be
      // inside your ring of it (Vision.ringDist at RING_MOVING): those tiles are off-limits;
      // every way in is reached from the first through the rest.
      const me = Object.assign({}, s, { actors: [Object.assign({}, s.actors[0])].concat(s.actors.slice(1)) }), near = new Set();
      for (const [x, y] of cells) {
        me.actors[0].x = x; me.actors[0].y = y;
        const f = { r: N.RING_MOVING, x, y, dist: Grid.distances(m, [[x, y]], N.RING_MOVING) };
        if (Wake.inTether(me, b) || C.Vision.ringDist(me, b.x, b.y, f) >= 0) near.add(y * m.w + x);
      }
      const ways = cells.filter(([x, y]) => [0, 2, 4, 6].some(d => { const nx = x + Grid.DX[d], ny = y + Grid.DY[d]; return Grid.walkable(m, nx, ny) && m.roomOf[ny][nx] !== rm; })).map(([x, y]) => y * m.w + x);
      for (const k of ways) assert.ok(!near.has(k), `S9 seed ${seed}: a way in at ${k % m.w},${(k - k % m.w) / m.w} wakes it`);
      const free = new Set(cells.map(([x, y]) => y * m.w + x).filter(k => !near.has(k) && !s.actors.some((a, i) => i > 0 && a !== b && a.mode === 'dormant' && C.Actors.covers(a, k % m.w, (k - k % m.w) / m.w)))), seen = new Set([ways[0]]), todo = [ways[0]];
      while (todo.length) { const k = todo.pop(), x = k % m.w, y = (k - x) / m.w; for (let d = 0; d < 8; d++) { const j = (y + Grid.DY[d]) * m.w + x + Grid.DX[d]; if (Grid.canStep(m, x, y, d) && free.has(j) && !seen.has(j)) { seen.add(j); todo.push(j); } } }
      for (const k of ways) assert.ok(seen.has(k), `S9 seed ${seed}: the way in at ${k % m.w},${(k - k % m.w) / m.w} is cut off by it`);
      assert.ok(g.log.some(l => /S9\.4 found no case in \S+ it could guard and guards its own tile$/.test(l.op)), `S9 seed ${seed}`);
    }
    assert.ok(own >= 12, `${own} of 40 with no case`);
  });
};
