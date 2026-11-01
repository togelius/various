// LV6, the entrance's safe zone (M4 plan D-LV6, A10; design/layout.md §7.1; BUILD.md §5.5;
// js/core/layout/lv6.js):
//   - it is registered, the first validator, and reads nothing from the plan;
//   - planted faults, each a room drawn as a text map, with LV6's tiles marked on it (the
//     exhibit at fault in capitals, the safe zone's tiles it reaches as *), its sentence, and
//     a control a tile or a turn away that passes: an exhibit at walk 7; an axis into the
//     vestibule (an archway), and the same with the partition's door shut as made; a Wader's
//     round in view of it; a station's line into the safe zone; a tether through a wall; a
//     sleeper reached only from the open doorway; a door's noise; an exhibit awake from the
//     start whose rules tell nothing of where it walks; a lit Lamp's ring, in S.9 (whose pack
//     holds the Lamp) and not in M.11 (whose does not), unless you carry it; a loud floor's
//     ring, from that tile only; a Centrepiece's piece, its name ("The …") said once; and a
//     door's noise heard by an awake exhibit that never steps (a station) or waits in its
//     case, which never brings it, so passes;
//   - each planted finding is true in the game: from the tile LV6 names, played with the real
//     rules, the exhibit wakes, sees you, or its line strikes you, within SAFE_ZONE_TURNS turns
//     (and the Wader at the very turn LV6 names), every event with a clean sentence;
//   - a Wader is read from Patrol.timeline (a planted timeline is what LV6 reports; with none
//     told, its wake region), over SAFE_ZONE_TURNS turns: a round that first sees the zone
//     24 turns on passes, and fails with SAFE_ZONE_TURNS planted at 30;
//   - on real departments: a rejection reseeds (M.11 seed 120 at depth 1, a Heliograph's axis
//     into the open doorway; S.9 with its stretch row planted plain, the Brooder's tether
//     through the vestibule's wall), a stamp planted to fail every attempt falls back,
//     rejected; LV6 draws nothing and changes nothing; and a sleeper's wake region with the
//     doors open holds every tile it holds with them shut (the reading LV6 relies on); and
//     M.11's Logbook Trolley stands where a lit Lamp's ring from the safe zone does not reach
//     it, so the Lamp may be carried there (M5's run) without LV6 rejecting every attempt.
// The shared sweep's test/sweep/lv6.check.js holds every department made to LV6 against an
// oracle written apart from it.
'use strict';
module.exports = ({ test, assert, loadCore, root, path }) => {
  const C = loadCore();
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const { LV6, Roles, Actors, Dept, Populate, N, State, Packs, Modules, Archetypes, Grid, Cases } = C;
  const json = x => JSON.stringify(x);
  const same = (a, b, msg) => assert.equal(json(a), json(b), msg);

  // ---- Rooms drawn for the planted faults ----

  // The vestibule (the safe zone: every tile of the west room, walk 1–7, and the partition's
  // doorway at 8,4, walk 8) and the room beyond it, through a door (DOOR) or an archway (ARCH).
  const DOOR = [
    '########################',
    '#.......|..............#',
    '#.......|..............#',
    '#.......|..............#',
    'E.......+..............#',
    '#.......|..............#',
    '#.......|..............#',
    '#.......|..............#',
    '########################',
  ];
  const ARCH = DOOR.map(r => r.replace('+', ','));
  // DOOR with a column beyond the door, which hides 10,3 from the doorway.
  const COLUMN = DOOR.map((r, y) => (y === 3 ? '#.......|o.............#' : r));
  // A vestibule whose south wall is a room's north wall, and a case in that room.
  const NEST = [
    '##################',
    '#.......|........#',
    '#.......|........#',
    '#.......|........#',
    'E.......,........#',
    '#########........#',
    '#...v............#',
    '#................#',
    '##################',
  ];
  const NEST_AWAY = NEST.map((r, y) => (y === 6 ? '#................#' : y === 7 ? '#...v............#' : r));
  // ARCH with a pool (a loud floor) at 7,4, beside the archway.
  const POOL = ARCH.map((r, y) => (y === 4 ? r.slice(0, 7) + 'w' + r.slice(8) : r));
  // COLUMN with a case at 10,3, beyond the column.
  const CASED = COLUMN.map((r, y) => (y === 3 ? r.slice(0, 10) + 'v' + r.slice(11) : r));
  // One room, the Intro, the safe zone its west tiles (walk 8 or less: columns 1–8).
  const HALL = ['################', '#..............#', '#..............#', 'E..............#', '#..............#', '################'];
  const HALL_ROOMS = [{ key: 'intro', role: 'intro', x0: 1, y0: 1, x1: 14, y1: 4 }];

  // A room of department acc at depth 3, you just inside the entrance (as a visit begins),
  // each exhibit {sp, at, …} with its species' role's stats.
  function plant(acc, map, exhibits, extra) {
    const e = map.findIndex(r => r[0] === 'E');
    return H.room(C, 1, Object.assign({ acc, depth: 3, map, you: [1, e], entrance: [0, e],
      exhibits: exhibits.map(x => Object.assign({ stats: Roles.stats(Packs.speciesFor({ dept: { acc } }, { sp: x.sp }).role, 3) }, x)) }, extra || {}));
  }
  // A station of the First Landing (M11.12) at 13,1 with its line dir, the chime running.
  function station(dir) {
    const s = plant('M11', HALL, [{ sp: 'M11.12', at: [13, 1] }], { rooms: HALL_ROOMS });
    s.actors[1].route = { dir };
    Modules.init(s, Packs.get('M11'));
    return s;
  }
  // A Wader (S9.2) on its round, starting on its first post, beyond the archway.
  function wader(posts, X) {
    const K = X || C, s = H.room(K, 1, { acc: 'S9', depth: 3, map: ARCH, you: [1, 4], entrance: [0, 4], exhibits: [{ sp: 'S9.2', at: posts[0], stats: K.Roles.stats('warden', 3) }] });
    const a = s.actors[1];
    a.route = { posts: posts.map(p => p.slice()), i: 0 };
    K.Wake.created(s, a, 'patrol', {}, null);
    return s;
  }
  // An awake station at 10,3 (its line east, away from the zone), and an awake Trolley in a
  // case at 10,3, each within the partition door's soft noise.
  function awakeStation() {
    const s = plant('M11', COLUMN, [{ sp: 'M11.12', at: [10, 3], mode: 'awake' }]);
    s.actors[1].route = { dir: 'E' };
    Modules.init(s, Packs.get('M11'));
    return s;
  }
  const awakeCased = () => plant('M11', CASED, [{ sp: 'M11.5', at: [10, 3], mode: 'awake' }], { fixtures: [Cases.make({ x: 10, y: 3, room: null, num: 'T.0.101.103' })] });
  const LAMP = { uid: 'you.c1', kind: 'curio', ref: 'S9.11', where: { at: 'kit', slot: 'curio0' }, prims: [{ id: 'observing', cls: 'L' }] };

  // The room's text map with LV6's tiles marked: each exhibit by its letter, the one at fault
  // (its own tiles among those marked) in capitals, and the safe zone's tiles it reaches as *.
  const LETTER = { 'M11.1': 'h', 'M11.5': 't', 'M11.12': 's', 'S9.2': 'w', 'S9.4': 'b', 'S9.6': 'p', 'A4.12': 'd' };
  function marked(s, tiles) {
    const rows = s.dept.tiles.map(r => r.split(''));
    for (const a of s.actors.slice(1)) if (!a.gone) for (const [x, y] of Actors.footprint(a)) rows[y][x] = LETTER[a.sp] || '?';
    for (const [x, y] of tiles) rows[y][x] = s.actors.some(a => a.uid !== 'you' && Actors.covers(a, x, y)) ? rows[y][x].toUpperCase() : '*';
    return rows.map(r => r.join(''));
  }

  // [name, the room, LV6's sentence, the map it marks, the control (passes)]
  const W_ = 'Lantern-Crop Wader', T_ = 'Logbook Trolley, Self-Propelled', H_ = 'Heliograph, Landing Pattern';
  const FAULTS = [
    ['an exhibit at walk 7', () => plant('M11', DOOR, [{ sp: 'M11.5', at: [7, 1] }]),
      `the ${T_} stands at 7,1, 7 walking tiles from the entrance, inside the safe zone (the first 8)`,
      ['########################',
       '#......T|..............#',
       '#.......|..............#',
       '#.......|..............#',
       'E.......+..............#',
       '#.......|..............#',
       '#.......|..............#',
       '#.......|..............#',
       '########################'],
      () => plant('M11', DOOR, [{ sp: 'M11.5', at: [9, 1] }])],
    ['an axis into the vestibule', () => plant('M11', ARCH, [{ sp: 'M11.1', at: [15, 4] }]),
      `standing at 7,4, in the safe zone, you would wake the ${H_}: you are in its row or column within 8 tiles, in its sight`,
      ['########################',
       '#.......|..............#',
       '#.......|..............#',
       '#.......|..............#',
       'E......**......H.......#',
       '#.......|..............#',
       '#.......|..............#',
       '#.......|..............#',
       '########################'],
      () => plant('M11', ARCH, [{ sp: 'M11.1', at: [17, 4] }])],
    ['an axis into the vestibule through its door, open', () => plant('M11', DOOR, [{ sp: 'M11.1', at: [15, 4] }]),
      `standing at 7,4, in the safe zone, once the doors are open, you would wake the ${H_}: you are in its row or column within 8 tiles, in its sight`,
      ['########################',
       '#.......|..............#',
       '#.......|..............#',
       '#.......|..............#',
       'E......**......H.......#',
       '#.......|..............#',
       '#.......|..............#',
       '#.......|..............#',
       '########################'],
      () => plant('M11', DOOR, [{ sp: 'M11.1', at: [15, 3] }])],
    ['a Wader\'s round in view of it', () => wader([[22, 1], [12, 1]]),
      `standing at 8,4, in the safe zone, the ${W_} would see you from its round within 6 turns`,
      ['########################',
       '#.......|.............W#',
       '#.......|..............#',
       '#.......|..............#',
       'E.......*..............#',
       '#.......|..............#',
       '#.......|..............#',
       '#.......|..............#',
       '########################'],
      () => wader([[22, 1], [16, 1]])],
    ['a station\'s line into the safe zone', () => station('W'),
      'standing at 1,1, in the safe zone, the line of the Semaphore Station, First Landing would strike you within 20 turns',
      ['################',
       '#********....S.#',
       '#..............#',
       'E..............#',
       '#..............#',
       '################'],
      () => station('S')],
    ['a tether through a wall', () => plant('S9', NEST, [{ sp: 'S9.4', at: [4, 7], guards: [4, 6] }]),
      'standing at 3,4, in the safe zone, you are within 2 tiles of what the Ground-Nesting Brooder, With Its Nest guards: it would wake at once, and it feels you through walls',
      ['##################',
       '#.......|........#',
       '#.......|........#',
       '#.......|........#',
       'E..***..,........#',
       '#########........#',
       '#...v............#',
       '#...B............#',
       '##################'],
      () => plant('S9', NEST_AWAY, [{ sp: 'S9.4', at: [5, 7], guards: [4, 7] }])],
    ['a sleeper reached only from the open doorway', () => plant('M11', DOOR, [{ sp: 'M11.5', at: [11, 4] }]),
      `standing at 8,4, in the safe zone, once the doors are open, you would wake the ${T_}: it is inside your ring (3 walking tiles, in sight)`,
      ['########################',
       '#.......|..............#',
       '#.......|..............#',
       '#.......|..............#',
       'E.......*..T...........#',
       '#.......|..............#',
       '#.......|..............#',
       '#.......|..............#',
       '########################'],
      () => plant('M11', DOOR, [{ sp: 'M11.5', at: [12, 4] }])],
    ['a door\'s noise', () => plant('M11', COLUMN, [{ sp: 'M11.5', at: [10, 3] }]),
      `opening or closing the door at 8,4, beside the safe zone, you would wake the ${T_}: it hears the door, a pip each turn, and wakes at 3`,
      ['########################',
       '#.......|..............#',
       '#.......|..............#',
       '#.......|oT............#',
       'E.......*..............#',
       '#.......|..............#',
       '#.......|..............#',
       '#.......|..............#',
       '########################'],
      () => plant('M11', COLUMN, [{ sp: 'M11.5', at: [11, 2] }])],
    ['an exhibit awake from the start whose rules tell nothing of where it walks', () => plant('M11', DOOR, [{ sp: 'M11.5', at: [20, 6], mode: 'awake' }]),
      `the ${T_} is awake from the start and nothing tells where it walks, so it is taken to find you in the safe zone (at 8,4, the nearest tile of it)`,
      ['########################',
       '#.......|..............#',
       '#.......|..............#',
       '#.......|..............#',
       'E.......*..............#',
       '#.......|..............#',
       '#.......|...........T..#',
       '#.......|..............#',
       '########################'],
      () => plant('M11', DOOR, [{ sp: 'M11.5', at: [20, 6] }])],
    ['a lit Lamp\'s ring, in S.9', () => plant('S9', ARCH, [{ sp: 'S9.6', at: [12, 4] }]),
      'standing at 8,4, in the safe zone, with the Lamp lit you would wake the Long-Footed Hopper: it is inside your ring (4 walking tiles, in sight)',
      ['########################',
       '#.......|..............#',
       '#.......|..............#',
       '#.......|..............#',
       'E.......*...P..........#',
       '#.......|..............#',
       '#.......|..............#',
       '#.......|..............#',
       '########################'],
      () => plant('M11', ARCH, [{ sp: 'M11.5', at: [12, 4] }])],
    ['a lit Lamp\'s ring, in M.11 with the Lamp carried', () => plant('M11', ARCH, [{ sp: 'M11.5', at: [12, 4] }], { items: [LAMP] }),
      `standing at 8,4, in the safe zone, with the Lamp lit you would wake the ${T_}: it is inside your ring (4 walking tiles, in sight)`,
      ['########################',
       '#.......|..............#',
       '#.......|..............#',
       '#.......|..............#',
       'E.......*...T..........#',
       '#.......|..............#',
       '#.......|..............#',
       '#.......|..............#',
       '########################'],
      () => plant('M11', ARCH, [{ sp: 'M11.5', at: [13, 4] }], { items: [LAMP] })],
    // A loud floor widens your ring only while you stand on it (Vision.actionRing): from the
    // pool, 5 walking tiles; from the archway beside it, 3. No Lamp in M.11.
    ['a loud floor\'s ring, from the pool only', () => plant('M11', POOL, [{ sp: 'M11.5', at: [12, 4] }]),
      `standing at 7,4, in the safe zone, on the pool (a loud floor), you would wake the ${T_}: it is inside your ring there (5 walking tiles, in sight)`,
      ['########################',
       '#.......|..............#',
       '#.......|..............#',
       '#.......|..............#',
       'E......*,...T..........#',
       '#.......|..............#',
       '#.......|..............#',
       '#.......|..............#',
       '########################'],
      () => plant('M11', POOL, [{ sp: 'M11.5', at: [13, 4] }])],
    ['a Centrepiece\'s piece at walk 6, its name said once', () => plant('A4', DOOR, [{ sp: 'A4.12', at: [6, 1], size: 2 }]),
      'the Duplicate Ordinance, Signed Original stands at 6,1, 6 walking tiles from the entrance, inside the safe zone (the first 8)',
      ['########################',
       '#.....DD|..............#',
       '#.....DD|..............#',
       '#.......|..............#',
       'E.......+..............#',
       '#.......|..............#',
       '#.......|..............#',
       '#.......|..............#',
       '########################'],
      () => plant('A4', DOOR, [{ sp: 'A4.12', at: [20, 5], size: 2 }])],
  ];

  test('LV6 is registered as a validator, the first (plan A10), and a room with no entrance has nothing to check', () => {
    assert.equal(Populate.validatorIds()[0], 'lv6');
    assert.equal(LV6.check.length, 2);
    const s = plant('M11', DOOR, [{ sp: 'M11.5', at: [7, 1] }]);
    s.dept.entrance = null;
    assert.equal(LV6.check(s, null), null);
    same(LV6.findings(s), []);
  });

  test('planted faults: each is rejected with its tiles marked on the room\'s text map and its sentence; each control a tile or a turn away passes', () => {
    for (const [name, make, reason, map, control] of FAULTS) {
      const s = make(), no = LV6.check(s, null);
      assert.ok(no, `${name}: not rejected`);
      assert.equal(no.reason, reason, name);
      assert.equal(marked(s, no.tiles).join('\n'), map.join('\n'), `${name}: the marked map`);
      assert.ok(!/undefined|NaN|\[object|\bnull\b/.test(no.reason), name);
      assert.equal(LV6.check(control(), null), null, `${name}: its control`);
      // Through Populate.validate, as a department's attempt asks it: its id with it.
      same(Populate.validate(s, null), Object.assign({ id: 'lv6' }, no), name);
    }
    // A door's noise heard by an awake exhibit that never steps (a station, its line along its
    // row away from the zone) or that only waits in its case never brings it (Wake.hear): it
    // is no finding, though each stands within the door's soft noise.
    for (const s of [awakeStation(), awakeCased()]) {
      assert.equal(LV6.check(s, null), null, s.actors[1].sp);
      assert.ok(Grid.reachDist(C.Noise.reach(s.dept, 8, 4, N.NOISE_SOFT), s.dept, 10, 3) <= N.NOISE_SOFT, 'it hears the door');
    }
    // The smallest ring that reaches is the one said: in S.9 (the Lamp) a Hopper 5 walking
    // tiles from the pool is the pool's finding, not the Lamp's; one 6 tiles off, the Lamp's,
    // on the pool (its ring there 6).
    const by = s => LV6.findings(s).map(f => [f.how, f.tiles]);
    same(by(plant('S9', POOL, [{ sp: 'S9.6', at: [12, 4] }])), [['loud', [[7, 4]]]]);
    same(by(plant('S9', POOL, [{ sp: 'S9.6', at: [13, 4] }])), [['lamp', [[7, 4]]]]);
    assert.equal(LV6.check(plant('S9', POOL, [{ sp: 'S9.6', at: [13, 4] }]), null).reason,
      'standing at 7,4, in the safe zone, with the Lamp lit and on the pool (a loud floor) you would wake the Long-Footed Hopper: it is inside your ring (6 walking tiles, in sight)');
  });

  // From the tile LV6 names, played with the real rules (every event a clean sentence): who
  // wakes (or starts hunting you), and when (the event's turn: the turns passed), as [k,
  // turn, cause].
  const E = 2, W = 6, wait = { a: 'wait' }, step = d => ({ a: 'move', dir: d }), shut = { a: 'close', x: 8, y: 4 };
  function played(s, at, actions) {
    const you = s.actors[0];
    you.x = at[0]; you.y = at[1]; you.hp = you.maxHp = 999;
    const r = H.play(C, s, actions, { inv: [] });
    assert.equal(r.violations.length, 0, json(r.violations.slice(0, 3)));
    return r;
  }
  const first = (r, uid, kinds) => { const e = r.events.find(v => kinds.includes(v.k) && v.who === uid); return e ? [e.k, e.turn, e.cause.k] : null; };

  test('each planted finding is true in the game: from the tile LV6 names, the exhibit wakes, sees you or strikes you within SAFE_ZONE_TURNS turns', () => {
    const T = N.SAFE_ZONE_TURNS, waits = n => Array(n).fill(wait);
    // The tile LV6 names (at), played from there, or from the tile beside it (from) where
    // the play opens a door first.
    const check = (name, s, at, actions, want, from) => {
      const no = LV6.check(s, null);
      assert.ok(no && no.tiles.some(t => t[0] === at[0] && t[1] === at[1]), `${name}: LV6 names ${json(at)}`);
      const r = played(s, from || at, actions), got = want(r, s.actors[1].uid);
      assert.ok(got && got[1] <= T, `${name}: ${json(got)}`);
      return got;
    };
    // The axis: standing still on it, a pip a turn.
    same(check('axis', plant('M11', ARCH, [{ sp: 'M11.1', at: [15, 4] }]), [7, 4], waits(3), (r, u) => first(r, u, ['woke'])), ['woke', 3, 'axis']);
    // The axis through the door: you open it (its boundary already counts), then stand.
    same(check('axis, door', plant('M11', DOOR, [{ sp: 'M11.1', at: [15, 4] }]), [7, 4], [step(E)].concat(waits(3)), (r, u) => first(r, u, ['woke'])), ['woke', 3, 'axis']);
    // The open doorway, its door left open (as you leave it once through; opening it here
    // would be a noise it hears too): stepping between the doorway, whose ring, moving,
    // reaches, and the tile west of it, whose does not.
    const doorway = plant('M11', DOOR, [{ sp: 'M11.5', at: [11, 4] }]);
    Grid.set(doorway.dept, 8, 4, "'");
    same(check('doorway', doorway, [8, 4], [step(E), step(W), step(E), step(W), step(E)], (r, u) => first(r, u, ['woke']), [7, 4]), ['woke', 5, 'ring']);
    // The Wader: you stand in the archway; it sees you at the turn LV6 names (6 turns on).
    same(check('Wader', wader([[22, 1], [12, 1]]), [8, 4], waits(10), (r, u) => first(r, u, ['hunting'])), ['hunting', 6, 'seen']);
    // The station's line: you stand still on it.
    const line = check('station', station('W'), [1, 1], waits(T), (r) => { const e = r.events.find(v => v.k === 'damaged' && v.who === 'you'); return e ? ['damaged', e.turn, e.cause.sp] : null; });
    assert.equal(line[2], 'demo_line');
    // The tether: one step onto the tile LV6 names, through the wall.
    same(check('tether', plant('S9', NEST, [{ sp: 'S9.4', at: [4, 7], guards: [4, 6] }]), [3, 4], [step(E)], (r, u) => first(r, u, ['woke'])), ['woke', 1, 'tether']);
    // The door's noise: opened, closed, opened from the tile west of it.
    const noisy = plant('M11', COLUMN, [{ sp: 'M11.5', at: [10, 3] }]), heard = LV6.check(noisy, null);
    same(heard.tiles, [[10, 3], [8, 4]]);
    const r = played(noisy, [7, 4], [step(E), shut, step(E)]);
    same(first(r, noisy.actors[1].uid, ['woke']), ['woke', 2, 'noise']);
    // The Lamp, lit (use), then stepping between the archway and the tile west of it.
    same(check('Lamp', plant('S9', ARCH, [{ sp: 'S9.6', at: [12, 4] }], { items: [LAMP] }), [8, 4], [{ a: 'use', uid: 'you.c1' }, step(E), step(W), step(E), step(W), step(E)],
      (r, u) => { const e = r.events.find(v => v.k === 'woke' && v.who === u); return e ? ['woke', e.turn, e.cause.k, e.cause.r] : null; }, [7, 4]), ['woke', 6, 'ring', 4]);
    // The pool: stepping on and off it from the tile west of it, the ring 5 there, 3 off it.
    same(check('pool', plant('M11', POOL, [{ sp: 'M11.5', at: [12, 4] }]), [7, 4], [step(E), step(W), step(E), step(W), step(E)],
      (r, u) => { const e = r.events.find(v => v.k === 'woke' && v.who === u); return e ? ['woke', e.turn, e.cause.k, e.cause.r] : null; }, [6, 4]), ['woke', 5, 'ring', 5]);
    // A door's noise heard by an awake station or an awake exhibit in its case: opened,
    // closed, opened, it never comes (the one in its case only waits there, its log says so),
    // never hunts you, and nothing strikes you.
    for (const s of [awakeStation(), awakeCased()]) {
      const r = played(s, [7, 4], [step(E), shut, step(E)].concat(waits(T - 3))), a = r.state.actors[1];
      assert.ok(r.events.some(e => e.k === 'noise' && e.cause.k === 'door'), 'the door is heard');
      same(r.events.filter(e => (e.who === a.uid && (['woke', 'hunting', 'moved'].includes(e.k) || (e.k === 'alerted' && e.cause.how !== 'case'))) || (e.k === 'damaged' && e.who === 'you')), [], a.sp);
      same([a.x, a.y], [10, 3], a.sp);
    }
  });

  test('a Wader is read from Patrol.timeline over SAFE_ZONE_TURNS turns: a planted timeline is what LV6 reports; none told, its wake region; a round that first sees the zone 24 turns on passes, and fails at 30 turns', () => {
    // The round that first sees the zone 24 turns on (played: it starts hunting you then).
    const late = [[22, 7], [22, 1], [22, 7], [22, 1], [12, 1]];
    assert.equal(LV6.check(wader(late), null), null);
    const r = played(wader(late), [8, 4], Array(30).fill(wait));
    same(first(r, r.state.actors[1].uid, ['hunting']), ['hunting', 24, 'seen']);
    const X = loadCore(null, { numbers: { SAFE_ZONE_TURNS: 30 } });
    assert.equal(X.LV6.check(wader(late, X), null).reason, `standing at 8,4, in the safe zone, the ${W_} would see you from its round within 24 turns`);
    // A planted timeline (the Wader standing at 16,4 at its action 2 turns on) is what it reads.
    const Y = loadCore(), s = wader([[22, 1], [16, 1]], Y), uid = s.actors[1].uid, told = Y.Patrol.timeline;
    Y.Patrol.timeline = (st, turns) => [{ uid, at: [{ x: 22, y: 1, t: 0 }, { x: 16, y: 4, t: 2 * N.TICKS_PER_TURN }], stuck: null }];
    assert.equal(Y.LV6.check(s, null).reason, `standing at 8,4, in the safe zone, the ${W_} would see you from its round within 2 turns`);
    // None told: its wake region (Archetypes.wakeRegion, never smaller than what it sees).
    let asked = 0;
    const region = Y.Archetypes.wakeRegion;
    Y.Patrol.timeline = () => null;
    Y.Archetypes.wakeRegion = (st, a, turns) => { if (a.uid === uid) { asked++; assert.equal(turns, N.SAFE_ZONE_TURNS); } return region(st, a, turns); };
    assert.equal(Y.LV6.check(s, null), null);
    assert.equal(asked, 2, 'asked with the doors shut, then open');
    Y.Archetypes.wakeRegion = region; Y.Patrol.timeline = told;
  });

  test('on real departments: a rejection reseeds, a stamp planted to fail every attempt falls back rejected, and LV6 draws nothing and changes nothing', () => {
    // M.11 seed 120 at depth 1: its first attempt's Heliograph has the open doorway on its axis.
    const g = Dept.generate(120, 'M11', 1);
    assert.equal(g.attempt, 1);
    assert.equal(g.tries[0].length, 1);
    assert.equal(g.tries[0][0].id, 'lv6');
    assert.match(g.tries[0][0].why, /^standing at \d+,\d+, in the safe zone, once the doors are open, you would wake the Heliograph, Landing Pattern: you are in its row or column within 8 tiles, in its sight$/);
    assert.equal(LV6.check(g.state, null), null);
    // M.11's Trolley planted beside the Intro's doorway (walk 10): every attempt is rejected,
    // and the certified fallback is taken, its rejection kept.
    const X = loadCore(), I = X.Packs.get('M11').intro;
    I.map[4] = 'E.......+.t....'; I.map[6] = '#..b....|......';
    const f = X.Dept.generate(3, 'M11', 3);
    same([f.attempt, f.fallback, f.tries.length, f.rejected.id], [5, true, 5, 'lv6']);
    assert.ok(f.tries.every(t => t.length === 1 && t[0].id === 'lv6' && /Logbook Trolley/.test(t[0].why)));
    // S.9's Lamp Corridor with its stretch row 10 plain (D-PACKS made it low cabinets): the
    // Brooder's tether, guarding a case on the band room's north wall, reaches the vestibule's
    // last row through the wall, and LV6 reseeds every such attempt (6, of seeds 1–28).
    const Z = loadCore(), J = Z.Packs.get('S9').intro, depthOf = q => 1 + ((q - 1) % 7);
    J.map = J.map.map((row, i) => (i === 10 ? '#.......|......' : row));
    let tethers = 0;
    for (let seed = 1; seed <= 28; seed++) {
      const t = Z.Dept.generate(seed, 'S9', depthOf(seed));
      for (const f of t.tries.flat()) if (f.id === 'lv6') { assert.match(f.why, /you are within 2 tiles of what the Ground-Nesting Brooder, With Its Nest guards: it would wake at once, and it feels you through walls$/); tethers++; }
      assert.ok(!t.fallback && Z.LV6.check(t.state, null) === null, `S9 seed ${seed}`);
    }
    assert.equal(tethers, 6);
    // M.11's Logbook Trolley stands where a lit Lamp's ring (RING_MOVING + LAMP_RING) from the
    // safe zone, the open doorway included, does not reach it (its stamp's column 13, walk 13),
    // so a Lamp carried into M.11 (M5's run) leaves the departments as they are; at column 12
    // it reached it from the doorway in every M.11 department.
    for (let depth = 1; depth <= 7; depth++) {
      const s = State.clone(Dept.create(depth, 'M11', depth));
      s.items.push(Object.assign({}, LAMP, { uid: 'you.lamp', where: { at: 'kit', slot: 'curio1' }, lit: true }));
      s.you.kit.curio[1] = 'you.lamp';
      same(LV6.findings(s), [], `M.11 depth ${depth}, a lit Lamp carried`);
    }
    // Nothing drawn, nothing changed; the same answer twice.
    for (const [acc, seed, depth] of [['S9', 4, 2], ['A4', 5, 5], ['M11', 120, 1]]) {
      const s = Dept.create(seed, acc, depth), before = json(s), hash = State.hash(s);
      const a = LV6.findings(s), b = LV6.findings(s);
      same(a, b, `${acc} seed ${seed}`);
      assert.equal(json(s), before, `${acc} seed ${seed}: changed`);
      assert.equal(State.hash(s), hash);
    }
  });

  test('a sleeper\'s wake region with the doors open holds every tile it holds with them shut (LV6 asks it open), on real departments', () => {
    const open = s => Object.assign({}, s, { dept: Object.assign({}, s.dept, { tiles: s.dept.tiles.map(r => r.replace(/\+/g, "'")) }) });
    let sleepers = 0;
    for (const acc of ['S9', 'A4', 'M11']) for (let seed = 1; seed <= 3; seed++) for (const depth of [1, 4, 7]) {
      const s = Dept.create(seed, acc, depth), o = open(s);
      for (const a of s.actors.slice(1)) {
        if (a.gone || a.mode !== 'dormant') continue;
        sleepers++;
        const shutR = Archetypes.wakeRegion(s, a, N.SAFE_ZONE_TURNS), openR = new Set(Archetypes.wakeRegion(o, a, N.SAFE_ZONE_TURNS).map(t => t.join(',')));
        for (const t of shutR) assert.ok(openR.has(t.join(',')), `${acc} seed ${seed} depth ${depth}: ${a.uid} (${a.arch}) reaches ${t} shut, not open`);
      }
    }
    assert.ok(sleepers > 300, `${sleepers} sleepers`);
  });
};
