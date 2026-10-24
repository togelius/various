// M3's modes and their timers (BUILD.md §8.2's table; plan W1-WAKE-B): awake 20 turns →
// returning → reinstalling 3 → dormant with 1 pip; hunting 8 turns out of sight → searching
// 3 → returning; seeing you starts a hunt from every waking mode; homeless exhibits and
// exhibits that never sleep never go back; fixed and encased exhibits; a 2×2 body gets home;
// the sentences; the invariants on planted faults. The expected turns are worked out here
// from BUILD.md's numbers (§8.10) and an independent walking distance, never from the rule code.
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Step, State, Setup, Wake, AI, Specials, Causes, Text, N } = C;
  const H = require('./behaviour/_harness.js');
  const json = x => JSON.stringify(x);
  const tough = { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 };
  const ex = (at, extra) => Object.assign({ sp: 'dummy', at, mode: 'awake', stats: tough }, extra);
  const room = (map, you, exhibits, extra, options) => {
    const s = Setup.room(1, Object.assign({ acc: 'T0', depth: 1, map, you, exhibits }, extra || {}), options);
    s.actors[0].hp = s.actors[0].maxHp = 999;
    return s;
  };
  const checked = ev => { for (const e of ev) { const bad = Causes.check(e); assert.equal(bad, null, `${bad}: ${json(e)}`); } return ev; };
  // You on the left, behind a wall with no way through: nothing on the right can see you or
  // walk to you, and your waits make no noise, so only the modes' own timers change a mode.
  const SPLIT = ['##############', '#....#.......#', '#....#.......#', '#....#.......#', '#....#.......#', '##############'];
  // Waits until the visit, the cap or `stop` ends it; every step's events, with their turns.
  function waits(s, n, stop) {
    const all = [];
    for (let i = 0; i < n && !s.over; i++) { const ev = checked(Step.step(s, { a: 'wait' })); all.push(...ev); if (stop && stop(ev, s)) break; }
    return all;
  }
  const changes = (ev, uid) => ev.filter(e => e.who === uid && ['woke', 'hunting', 'lost', 'alerted', 'returned'].includes(e.k));
  const show = e => `${e.turn} ${e.k} ${e.cause.k}` + (e.k === 'lost' ? ` ${e.from}>${e.to}` : e.k === 'returned' ? ` ${e.phase}` : e.k === 'alerted' ? ` ${e.from}>${e.to}` : '');

  // An independent walking distance by the exhibits' step rule (BUILD.md §8.2): 8 neighbours,
  // a diagonal only where both orthogonal tiles can be walked on, staff doors walls.
  const WALK = new Set(['.', ',', '+', "'", 'E', 'X', 'u', 'k', 'x', 'w', 'b', '=']);
  const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  function walk(map, from, to) {
    const at = (x, y) => (map[y] && map[y][x]) || '#', key = (x, y) => `${x},${y}`;
    const d = new Map([[key(...from), 0]]), q = [from];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === to[0] && y === to[1]) return d.get(key(x, y));
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!WALK.has(at(nx, ny)) || d.has(key(nx, ny)) || (dx && dy && !(WALK.has(at(nx, y)) && WALK.has(at(x, ny))))) continue;
        d.set(key(nx, ny), d.get(key(x, y)) + 1); q.push([nx, ny]);
      }
    }
    return -1;
  }
  // Where an actor stood just before event index i, from the moved events before it.
  function whereBefore(ev, start, uid, i) {
    let p = start.slice();
    for (let j = 0; j < i; j++) if (ev[j].k === 'moved' && ev[j].who === uid) p = ev[j].to.slice();
    return p;
  }

  test('awake: 20 turns without a stimulus, then returning; on arriving it reinstalls for 3 turns, then sleeps with 1 pip', () => {
    for (const seed of [1, 2, 3]) {
      const s = room(SPLIT, [2, 2], [ex([10, 3], { home: [7, 1] })]);
      s.seed = seed;
      const a = s.actors[1], ev = waits(s, 60, (e, t) => t.actors[1].mode === 'dormant');
      const got = changes(ev, a.uid).map(show);
      const lost = ev.findIndex(e => e.k === 'lost' && e.who === a.uid);
      assert.equal(got[0], `${N.AWAKE_IDLE_TURNS} lost idle awake>returning`, `seed ${seed}: ${got}`);
      assert.equal(ev[lost].cause.turns, N.AWAKE_IDLE_TURNS);
      // Before that it wandered its room (the whole map, in a room made for a test), never going back.
      assert.ok(ev.slice(0, lost).some(e => e.k === 'moved' && e.who === a.uid), 'it wandered');
      // It walks home by a shortest path: its first step home is in the same action.
      const from = whereBefore(ev, [10, 3], a.uid, lost), far = walk(SPLIT, from, [7, 1]), arrive = N.AWAKE_IDLE_TURNS + Math.max(0, far - 1);
      assert.equal(json(got.slice(1)), json([`${arrive} returned home arrived`, `${arrive + N.REINSTALL_TURNS} returned home reinstalled`]), `seed ${seed}, ${far} tiles from home`);
      assert.equal(json([a.mode, a.x, a.y, a.pips, a.stim]), json(['dormant', 7, 1, 1, arrive + N.REINSTALL_TURNS]));
      assert.ok(!C.Actors.scheduled(a), 'asleep, it is not scheduled');
    }
  });

  test('hunting: 8 turns out of sight, then it searches your last-known tile for 3 turns, then goes back; sight resets the count', () => {
    // It knows you were at (7, 3); out of sight from the start, it walks there and waits.
    const s = room(SPLIT, [2, 2], [ex([11, 3], { mode: 'hunting', lastKnown: [7, 3], home: [12, 1] })]), a = s.actors[1];
    const ev = waits(s, 40, (e, t) => t.actors[1].mode === 'dormant');
    const got = changes(ev, a.uid).map(show);
    const back = N.LOSE_TRACK_TURNS + N.SEARCH_TURNS, far = walk(SPLIT, [7, 3], [12, 1]);
    assert.equal(json(got), json([`${N.LOSE_TRACK_TURNS} lost out_of_sight hunting>searching`, `${back} lost searched searching>returning`,
      `${back + far - 1} returned home arrived`, `${back + far - 1 + N.REINSTALL_TURNS} returned home reinstalled`]));
    assert.equal(ev.find(e => e.k === 'lost').cause.turns, N.LOSE_TRACK_TURNS);
    const steps = ev.filter(e => e.k === 'moved' && e.who === a.uid && e.turn < N.LOSE_TRACK_TURNS);
    assert.equal(json(steps.map(e => e.to).pop()), json([7, 3]), 'it walked to where it last knew you were');
    assert.equal(steps.length, walk(SPLIT, [11, 3], [7, 3]));
    // Searching starts on arrival: a last-known tile further off is reached first.
    const t = room(SPLIT, [2, 2], [ex([12, 4], { mode: 'hunting', lastKnown: [6, 1], home: [12, 4], stim: -5 })]), b = t.actors[1];
    const ev2 = waits(t, 40, (e, u) => u.actors[1].mode === 'returning');
    const lost2 = ev2.filter(e => e.k === 'lost' && e.who === b.uid).map(show);
    const reach = walk(SPLIT, [12, 4], [6, 1]), out = N.LOSE_TRACK_TURNS - 5;
    // Out of sight since turn -5, it searches at turn 3, still on its way; it arrives at the
    // turn of its last step and searches 3 turns from then.
    assert.ok(reach - 1 > out, 'it is still walking when it loses you');
    assert.equal(json(lost2), json([`${out} lost out_of_sight hunting>searching`, `${reach - 1 + N.SEARCH_TURNS} lost searched searching>returning`]));
    // Sight resets the count: an encased hunter watches you through its glass; once you walk
    // out of its sight, it searches LOSE_TRACK_TURNS after the last turn it saw you.
    const map = ['##########', '#........#', '#...v....#', '#........#', '######.###', '#........#', '##########'];
    const u = room(map, [6, 3], [ex([4, 2], { mode: 'hunting' })]), c = u.actors[1];
    const walkOut = [{ a: 'wait' }, { a: 'wait' }, { a: 'wait' }, { a: 'move', dir: 4 }, { a: 'move', dir: 4 }, { a: 'move', dir: 6 }, { a: 'move', dir: 6 }, { a: 'move', dir: 6 }];
    let last = -1;
    const ev3 = [];
    for (let i = 0; i < 30; i++) {
      ev3.push(...checked(Step.step(u, walkOut[i] || { a: 'wait' })));
      // Each of your steps takes a turn, and it acts in that turn, after you: it saw you if
      // it sees you now.
      if (AI.sees(u, c) && c.mode === 'hunting') last = u.turn - 1;
    }
    assert.ok(last >= 3, `it saw you until turn ${last}`);
    assert.equal(ev3.find(e => e.k === 'lost' && e.who === c.uid).turn, last + N.LOSE_TRACK_TURNS);
  });

  test('seeing you starts a hunt from awake, searching, returning and reinstalling, and a sleeper sees nothing', () => {
    const OPEN = ['#########', '#.......#', '#.......#', '#.......#', '#########'];
    for (const mode of ['awake', 'searching', 'returning', 'reinstalling']) {
      const s = room(OPEN, [1, 2], [ex([6, 2], { mode, home: [6, 2], lastKnown: [6, 2] })]), a = s.actors[1];
      const ev = checked(Step.step(s, { a: 'wait' })), h = ev.find(e => e.k === 'hunting');
      assert.ok(h, `${mode}: it hunts`);
      assert.equal(json([h.who, h.was, h.cause.k, h.cause.dist]), json([a.uid, mode, 'seen', 5]), mode);
      assert.equal(json([a.mode, a.sawYou, a.lastKnown]), json(['hunting', true, [1, 2]]), mode);
      assert.ok(ev.some(e => e.k === 'moved' && e.who === a.uid), `${mode}: then it comes for you`);
    }
    const d = room(OPEN, [1, 2], [ex([3, 2], { mode: 'dormant' })]);
    assert.equal(AI.sees(d, d.actors[1]), false);
    assert.ok(!waits(d, 1).some(e => e.k === 'hunting' && e.cause.k === 'seen'));
  });

  test('a homeless exhibit, and one that never sleeps, never go back: they wander; one going back that loses its home wanders', () => {
    for (const extra of [{ home: null }, { trigger: 'awake' }]) {
      const s = room(SPLIT, [2, 2], [ex([10, 3], extra)]), a = s.actors[1];
      const ev = waits(s, 3 * N.AWAKE_IDLE_TURNS);
      assert.ok(!changes(ev, a.uid).length, json(extra) + ': ' + changes(ev, a.uid).map(show));
      assert.ok(ev.filter(e => e.k === 'moved' && e.who === a.uid).length > 10, 'it wanders');
      assert.equal(a.mode, 'awake');
      // Its search ends and it wanders (alerted, searched), instead of going back.
      const t = room(SPLIT, [2, 2], [ex([10, 3], Object.assign({ mode: 'hunting', lastKnown: [10, 3] }, extra))]), b = t.actors[1];
      const ev2 = waits(t, 30);
      assert.equal(json(changes(ev2, b.uid).map(show)), json([`${N.LOSE_TRACK_TURNS} lost out_of_sight hunting>searching`, `${N.LOSE_TRACK_TURNS + N.SEARCH_TURNS} alerted searched searching>awake`]));
      const al = ev2.find(e => e.k === 'alerted');
      assert.ok(Number.isInteger(al.x) && Number.isInteger(al.y) && t.dept.tiles[al.y][al.x] === '.', 'it goes to a floor tile of its room');
    }
    // Going back, or settling in, with its home gone (a broken case): it wanders.
    for (const mode of ['returning', 'reinstalling']) {
      const s = room(SPLIT, [2, 2], [ex([10, 3], { mode, home: null })]), a = s.actors[1];
      const e = changes(waits(s, 1), a.uid);
      assert.equal(json(e.map(show)), json([`0 alerted homeless ${mode}>awake`]));
      assert.equal(a.mode, 'awake');
    }
  });

  test('an exhibit moved off its home while reinstalling goes back to it; one that arrives home runs its archetype\'s onHome', () => {
    const X = loadCore(), homed = [];
    X.Registry.define('ARCHETYPES', 'planted_homebody', {});
    X.Archetypes.add('planted_homebody', { onHome: (state, a) => homed.push(`${a.uid}:${a.mode}:${a.x},${a.y}`) });
    const s = X.Setup.room(1, { acc: 'T0', depth: 1, map: SPLIT, you: [2, 2], exhibits: [ex([10, 3], { mode: 'reinstalling', home: [9, 3], arch: 'planted_homebody' })] });
    const a = s.actors[1], ev = [];
    for (let i = 0; i < 3; i++) ev.push(...X.Step.step(s, { a: 'wait' }));
    assert.equal(json(changes(ev, a.uid).map(show)), json(['0 lost displaced reinstalling>returning', '0 returned home arrived']));
    assert.equal(json([a.mode, a.x, a.y, homed]), json(['reinstalling', 9, 3, [`${a.uid}:reinstalling:9,3`]]));
  });

  test('a fixed exhibit only waits, and its pending mark is called off', () => {
    const OPEN = ['#########', '#.......#', '#.......#', '#.......#', '#########'];
    const s = room(OPEN, [1, 2], [ex([2, 2], { mode: 'hunting', statuses: [{ id: 'fixed', turns: 3 }] }), ex([6, 2], { mode: 'hunting', statuses: [{ id: 'fixed', turns: 3 }] })]);
    const [, a, b] = s.actors;
    Specials.mark(s, a, 'ring', Specials.tiles(s, a, 'ring'), []);
    a.statuses = []; C.Status.apply(s, a, 'fixed', 3, { k: 'status', id: 'fixed' }, []); C.Status.settle(s);
    assert.equal(a.telegraph, null, 'fixing it calls its mark off at once');
    const ev = waits(s, 2);
    assert.ok(!ev.some(e => (e.k === 'attacked' || e.k === 'moved' || e.k === 'telegraphed') && (e.by === a.uid || e.who === a.uid || e.by === b.uid || e.who === b.uid)), 'neither moves nor strikes');
    assert.equal(json([a.x, b.x, a.acts > 0, b.acts > 0]), json([2, 6, true, true]), 'they took their turns, waiting');
  });

  test('an encased hunter waits in its case and never strikes out; it loses you, searches, goes back and sleeps there, by the same timers', () => {
    const map = ['#########', '#.......#', '#...v...#', '#.......#', '#########'];
    const s = room(map, [3, 2], [ex([4, 2], { mode: 'hunting' })]), a = s.actors[1];
    const ev = waits(s, 10);
    assert.ok(!ev.some(e => (e.k === 'attacked' || e.k === 'moved') && (e.by === a.uid || e.who === a.uid)), 'beside you, it neither strikes nor steps out');
    assert.equal(a.mode, 'hunting', 'it still sees you');
    // You walk out of its sight: behind the wall of a side room.
    const t = room(['##########', '#........#', '#...v....#', '#........#', '######.###', '#........#', '##########'], [1, 5], [ex([4, 2], { mode: 'hunting', lastKnown: [6, 4] })]), b = t.actors[1];
    const ev2 = waits(t, 30, (e, u) => u.actors[1].mode === 'dormant');
    assert.equal(json(changes(ev2, b.uid).map(show)), json([`${N.LOSE_TRACK_TURNS} lost out_of_sight hunting>searching`,
      `${N.LOSE_TRACK_TURNS + N.SEARCH_TURNS} lost searched searching>returning`, `${N.LOSE_TRACK_TURNS + N.SEARCH_TURNS} returned home arrived`,
      `${N.LOSE_TRACK_TURNS + N.SEARCH_TURNS + N.REINSTALL_TURNS} returned home reinstalled`]));
    assert.equal(json([b.x, b.y, b.mode, b.pips]), json([4, 2, 'dormant', 1]));
    assert.ok(!ev2.some(e => e.k === 'moved' && e.who === b.uid));
  });

  test('a 2×2 body walks home with its anchor onto its home tile, and reinstalls there', () => {
    const map = ['##############', '#..........#.#', '#..........#.#', '#....#.....#.#', '#..........#.#', '#..........#.#', '##############'];
    const s = room(['############', '#....#.....#', '#....#.....#', '#....#.....#', '#....#.....#', '#....#.....#', '############'], [1, 1],
      [ex([8, 4], { mode: 'returning', size: 2, home: [6, 1] })]), a = s.actors[1];
    const ev = waits(s, 20, (e, u) => u.actors[1].mode === 'reinstalling');
    assert.equal(json([a.x, a.y, a.mode]), json([6, 1, 'reinstalling']));
    assert.equal(ev.filter(e => e.k === 'moved' && e.who === a.uid).length, 3, 'three steps of its whole body, anchor (8,4) to (6,1)');
    // Round a column: a body that cannot cut the corner goes round it.
    const t = room(map, [12, 1], [ex([6, 4], { mode: 'returning', size: 2, home: [3, 1] })]), b = t.actors[1];
    waits(t, 30, (e, u) => u.actors[1].mode === 'reinstalling');
    assert.equal(json([b.x, b.y, b.mode]), json([3, 1, 'reinstalling']));
    assert.equal(json(AI.anchorDistances(t, b, 3, 1)[1 * t.dept.w + 3]), '0');
  });

  test('every sentence of the modes is clean and says what happened', () => {
    const clean = s => typeof s === 'string' && s.length > 0 && !/undefined|NaN|\[object|null/.test(s);
    const name = uid => uid === 'you' ? 'you' : 'the Marble Faun';
    const ev = (k, fields, cause) => Object.assign({ k, turn: 3, tick: 300 }, fields, cause ? { cause } : {});
    const cases = [
      ev('moved', { who: 'x', from: [1, 1], to: [2, 1] }),
      ev('opened', { who: 'x', x: 1, y: 2 }, { k: 'door', by: 'x' }),
      ev('closed', { who: 'you', x: 1, y: 2 }),
      ev('lost', { who: 'x', from: 'hunting', to: 'searching' }, { k: 'out_of_sight', turns: 8 }),
      ev('lost', { who: 'x', from: 'hunting', to: 'searching' }, { k: 'out_of_sight', turns: 1 }),
      ev('lost', { who: 'x', from: 'awake', to: 'returning' }, { k: 'idle', turns: 20 }),
      ev('lost', { who: 'x', from: 'searching', to: 'returning' }, { k: 'searched' }),
      ev('lost', { who: 'x', from: 'reinstalling', to: 'returning' }, { k: 'displaced' }),
      ev('alerted', { who: 'x', from: 'searching', to: 'awake', x: 3, y: 4 }, { k: 'searched' }),
      ev('alerted', { who: 'x', from: 'returning', to: 'awake', x: 3, y: 4 }, { k: 'homeless' }),
      ev('returned', { who: 'x', phase: 'arrived' }, { k: 'home', x: 3, y: 4 }),
      ev('returned', { who: 'x', phase: 'reinstalled' }, { k: 'home', x: 3, y: 4 }),
      ev('hunting', { who: 'x', was: 'awake' }, { k: 'seen', dist: 4 }),
      ev('woke', { who: 'x', was: 'dormant', mode: 'hunting' }, { k: 'seen', dist: 4 }),
      ev('noise', { x: 1, y: 2, cls: 'soft', range: 3 }, { k: 'door', by: 'x' }),
      ev('noise', { x: 1, y: 2, cls: 'soft', range: 3 }, { k: 'close', by: 'you' }),
    ];
    const said = cases.map(e => { assert.equal(Causes.check(e), null, json(e)); const s = Text.event(e, name); assert.ok(clean(s), `${e.k}: ${s}`); return s; });
    assert.equal(said[3], 'The Marble Faun lost you: it has not seen you for 8 turns, and searches where it last saw you.');
    assert.equal(said[4], 'The Marble Faun lost you: it has not seen you for 1 turn, and searches where it last saw you.');
    assert.equal(said[5], 'The Marble Faun is going back: nothing has disturbed it for 20 turns.');
    assert.equal(said[11], 'The Marble Faun settled back to sleep.');
    assert.equal(said[15], 'Soft: a door closing, heard 3 tiles away.');
    for (const code of ['no_door', 'doorway_occupied']) assert.ok(clean(Text.refusal(code)) && Text.refusal(code) !== code, code);
    // Every pair of the kinds this package owns has its sentence, distinct from the kind's default where it says more.
    for (const k of ['lost', 'alerted', 'returned']) for (const c of Object.keys(C.Registry.CAUSES[k])) assert.ok(Text.defined(k, c), `${k}.${c}`);
  });

  test('the modes invariants hold on the timers above and fail on planted faults', () => {
    const invs = require('../tools/invariants.js').select(C, ['modes']);
    assert.equal(json(invs.map(i => i.id)), json(['modes_known', 'modes_dormant_never_acts', 'modes_no_staff_door', 'modes_homeless_stays_awake', 'modes_reinstall_at_home',
      'modes_search_after_out_of_sight', 'modes_exhibit_steps', 'plodder_one_thing']));
    const clean = H.play(C, room(SPLIT, [2, 2], [ex([10, 3], { mode: 'hunting', lastKnown: [7, 3], home: [12, 1] }), ex([3, 3], { mode: 'dormant' })]), Array(40).fill({ a: 'wait' }), { inv: ['modes'], clone: true });
    assert.equal(json(clean.violations.map(v => v.text)), '[]');
    // Each planted fault, on its own core, must break its invariant.
    const bites = (id, plant, build, n) => {
      const X = loadCore();
      plant(X);
      const r = H.play(X, build(X), Array(n || 30).fill({ a: 'wait' }), { inv: ['modes'] });
      assert.ok(r.violations.some(v => v.inv === id), `${id}: ${json(r.violations.map(v => v.text))}`);
    };
    const mk = (X, exhibits, map) => X.Setup.room(1, { acc: 'T0', depth: 1, map: map || SPLIT, you: [2, 2], exhibits });
    const STAFF = ['##############', '#....S.......#', '#....S.......#', '#....#.......#', '##############'];
    const by = fn => X => { X.AI.byMode = (s, a, ev) => fn(X, s, a, ev); };
    // A sleeper that acts; an unknown mode; a step onto a staff door; going back with no
    // home; reinstalling away from home; searching too soon; a step of two tiles; a plodder
    // that strikes twice in one action.
    bites('modes_dormant_never_acts', X => { X.Wake.boundary = state => { state.actors[1].acts++; }; }, X => mk(X, [ex([10, 3], { mode: 'dormant' })]), 2);
    bites('modes_known', by((X, s, a, ev) => { a.mode = 'lost'; return X.AI.wait(s, a, ev); }), X => mk(X, [ex([10, 3])]), 1);
    bites('modes_no_staff_door', by((X, s, a, ev) => { a.x = 5; a.y = 1; return X.AI.wait(s, a, ev); }), X => mk(X, [ex([6, 1])], STAFF), 1);
    bites('modes_homeless_stays_awake', by((X, s, a, ev) => { a.mode = 'returning'; return X.AI.wait(s, a, ev); }), X => mk(X, [ex([10, 3], { home: null })]), 1);
    bites('modes_reinstall_at_home', by((X, s, a, ev) => { X.Wake.setMode(s, a, 'reinstalling', { k: 'home', x: 1, y: 1 }, ev); return X.AI.wait(s, a, ev); }),
      X => mk(X, [ex([10, 3], { mode: 'returning', home: [12, 1] })]), 1);
    bites('modes_search_after_out_of_sight', X => {
      const r = X.AI.byMode, lose = X.AI.loseTrackTurns;
      X.AI.byMode = (s, a, ev) => { X.AI.loseTrackTurns = () => 2; try { return r(s, a, ev); } finally { X.AI.loseTrackTurns = lose; } };
    }, X => mk(X, [ex([10, 3], { mode: 'hunting', lastKnown: [10, 3] })]), 6);
    bites('modes_exhibit_steps', by((X, s, a, ev) => { X.Causes.emit(s, ev, 'moved', { who: a.uid, from: [a.x, a.y], to: [a.x - 2, a.y] }); a.x -= 2; return X.AI.wait(s, a, ev); }), X => mk(X, [ex([10, 3])]), 1);
    bites('plodder_one_thing', by((X, s, a, ev) => { X.Combat.strike(s, a, s.actors[0], ev); return X.Combat.strike(s, a, s.actors[0], ev); }), X => mk(X, [ex([3, 2], { mode: 'hunting' })]), 1);
  });
};
