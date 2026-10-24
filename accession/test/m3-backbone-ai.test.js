// M3's exhibit core (BUILD.md §8.1, §8.2): the order of an exhibit's turn, waking and changing
// mode, pips, the ring pip against an independent oracle, specials and their telegraphs,
// beams, moving toward and away, and encased exhibits. The expected figures are worked out
// here from BUILD.md's text, never from the rule code.
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Step, State, Setup, Actors, Status, Causes, Wake, Vision, Specials, Ranged, AI, Combat, Roles, Registry, Archetypes, N } = C;
  const json = x => JSON.stringify(x);
  const OPEN = ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#########'];
  const tough = { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 };
  const ex = (at, extra) => Object.assign({ sp: 'dummy', at, mode: 'hunting', stats: tough }, extra);
  const room = (X, map, you, exhibits, options) => {
    const s = X.Setup.room(1, { acc: 'T0', depth: 1, map, you, exhibits: exhibits || [] }, options);
    s.actors[0].hp = s.actors[0].maxHp = 999;
    return s;
  };
  const held = (a, id, until) => a.statuses.push({ id, until, turns: null, from: 0 });
  const checked = ev => { for (const e of ev) { const bad = Causes.check(e); assert.equal(bad, null, `${bad}: ${json(e)}`); } return ev; };
  const kinds = ev => ev.map(e => e.k);

  test('an exhibit\'s turn runs in order: fixed (cancel, wait), look, a pending mark, its archetype, its mode', () => {
    const X = loadCore(), log = [];
    for (const [ns, fn] of [['AI', 'look'], ['Specials', 'resolve'], ['Archetypes', 'act'], ['AI', 'byMode'], ['Specials', 'cancel'], ['AI', 'wait']]) {
      const orig = X[ns][fn]; X[ns][fn] = (...args) => { log.push(fn); return orig(...args); };
    }
    X.Registry.define('ARCHETYPES', 'planted_actor', {});
    X.Archetypes.add('planted_actor', { act: () => 140 });
    const s = room(X, OPEN, [2, 2], [ex([5, 2]), ex([5, 4], { arch: 'planted_actor' })]), [, a, b] = s.actors, ev = [];
    const run = who => { log.length = 0; const c = X.AI.act(s, who, ev); return [log.join(), c]; };
    // Nothing pending: it looks, its archetype (a plodder) has nothing to do, so it acts by mode.
    assert.equal(json(run(a)), json(['look,act,byMode', N.COST_STEP]));
    assert.equal(a.acts, 1, 'acts counts its actions since it woke');
    // A pending mark resolves, and nothing else runs.
    a.telegraph = { sp: 'ring', tiles: [[6, 1]], from: [[5, 2]], gross: 5, effect: 'damage', turn: 0, tick: 0 };
    assert.equal(json(run(a)), json(['look,resolve', N.COST_ATTACK + N.SPECIAL_RECOVERY]));
    assert.equal(a.telegraph, null);
    // An archetype that acts is not followed by the generic behaviour.
    assert.equal(json(run(b)), json(['look,act', 140]));
    // Fixed: the pending mark is cancelled and it waits, without looking.
    a.telegraph = { sp: 'ring', tiles: [[6, 1]], from: [[5, 2]], gross: 5, effect: 'damage', turn: 0, tick: 0 };
    held(a, 'fixed', 99);
    ev.length = 0;
    assert.equal(json(run(a)), json(['cancel,wait', N.COST_WAIT]));
    assert.equal(a.telegraph, null);
    assert.equal(json(checked(ev).map(e => [e.k, e.cancelled, e.cause.k, e.cause.why])), json([['special', true, 'cancel', 'fixed']]));
    assert.equal(json(run(a)), json(['wait', N.COST_WAIT]), 'fixed with nothing pending: it only waits');
    assert.equal(a.acts, 4);
  });

  test('Wake.wake: only from dormant; it resets, calls onWake, costs a beat, starts the story and emits two recorded events', () => {
    const X = loadCore(), seen = [];
    X.Registry.define('ARCHETYPES', 'planted_slowpoke', {});
    X.Archetypes.add('planted_slowpoke', { onWake: (st, a) => seen.push(`${a.uid}:${a.mode}:${a.pips}:${a.acts}`), speedApplies: () => ['move', 'act'] });
    const s = room(X, OPEN, [2, 2], [ex([5, 2], { mode: 'dormant' }), ex([6, 3], { mode: 'dormant', arch: 'planted_slowpoke', speed: 'slow' })]);
    s.turn = 3; s.tick = 300;
    const [, a, b] = s.actors, ev = [], cause = { k: 'ring', dist: 2, r: 3 };
    a.pips = 2; a.sawYou = true; a.acts = 7;              // left from an earlier waking
    assert.equal(X.Wake.wake(s, a, 'hunting', cause, ev), true);
    assert.equal(json([a.mode, a.pips, a.sawYou, a.acts, a.stim, a.next, a.lastKnown, a.target]),
      json(['hunting', 0, false, 0, 3, 300 + N.COST_STEP, [2, 2], null]), 'a hunter knows your tile');
    assert.equal(json([a.woke, a.hunted]), json([{ turn: 3, cause }, { turn: 3, cause }]));
    assert.equal(json(checked(ev).map(e => [e.k, e.who, e.was, e.mode || null, e.cause.k])), json([['woke', a.uid, 'dormant', 'hunting', 'ring'], ['hunting', a.uid, 'dormant', null, 'ring']]));
    assert.equal(json(s.causes.slice(-2).map(c => c.k)), json(['woke', 'hunting']), 'both recorded');
    assert.equal(X.Wake.wake(s, a, 'hunting', cause, ev), false, 'an exhibit already awake is not woken again');
    assert.equal(ev.length, 2);
    // Awake, to investigate: no hunt, so no hunted; onWake sees the new mode; a slow exhibit
    // whose speed covers every action takes a beat of two turns.
    const noise = { k: 'noise', by: 'you', dist: 3, cls: 'soft' };
    ev.length = 0;
    assert.equal(X.Wake.wake(s, b, 'awake', noise, ev, { target: [1, 1] }), true);
    assert.equal(json([b.mode, b.target, b.lastKnown, b.hunted, b.next]), json(['awake', [1, 1], null, null, 300 + N.COST_STEP * N.SPEED_SLOW_PCT / 100]));
    assert.equal(json(checked(ev).map(e => [e.k, e.mode])), json([['woke', 'awake']]));
    assert.equal(json(seen), json([`${b.uid}:awake:0:0`]));
    assert.throws(() => X.Wake.wake(s, a, 'searching', cause, ev), /cannot wake into searching/);
  });

  test('a pipless sleeper (a mimic in its disguise) is woken only by damage, its case touched or its case dissolved, and gains no pips', () => {
    const X = loadCore();
    X.Registry.define('MODIFIERS', 'planted_disguise', {});
    X.Archetypes.addModifier('planted_disguise', { pipless: () => true });
    const s = room(X, OPEN, [2, 2], [ex([3, 2], { mode: 'dormant', mods: ['planted_disguise'] })]);
    const wakes = X.Registry.order('WAKE_CAUSES').filter(k => ['hunting', 'awake'].includes(X.Registry.WAKE_CAUSES[k].mode));
    assert.ok(wakes.length >= 12, wakes.join());
    for (const k of wakes) {
      const t = X.State.clone(s), m = t.actors[1], ev = [];
      const woke = X.Wake.wake(t, m, X.Registry.WAKE_CAUSES[k].mode, { k }, ev);
      assert.equal(woke, ['damage', 'touch_case', 'dissolved'].includes(k), k);
      assert.equal(m.mode === 'dormant', !woke, k); assert.equal(ev.length > 0, woke, k);
    }
    const ev = [];
    for (const k of ['ring', 'noise', 'axis']) assert.equal(X.Wake.addPips(s, s.actors[1], 1, { k, dist: 1, r: 3, cls: 'soft' }, ev), false);
    X.Wake.boundary(s, ev);
    assert.equal(json([s.actors[1].pips, ev.length]), json([0, 0]), 'standing beside you, it gains no ring pip');
    // Switched off, the modifier no longer hides it.
    s.options.rulesOff.push('planted_disguise');
    X.Wake.boundary(s, ev);
    assert.equal(s.actors[1].pips, 1);
  });

  test('Wake.setMode resets nothing and emits each change\'s event; a returning exhibit set awake, then struck, is not surprised', () => {
    const s = room(C, OPEN, [2, 2], [ex([6, 4], { mode: 'dormant' })]), a = s.actors[1], ev = [];
    Wake.wake(s, a, 'hunting', { k: 'ring', dist: 3, r: 3 }, ev);
    a.sawYou = true; a.acts = 4;
    const woke = json(a.woke);
    const out = { k: 'out_of_sight', turns: N.LOSE_TRACK_TURNS }, idle = { k: 'idle', turns: N.AWAKE_IDLE_TURNS }, home = { k: 'home', x: 6, y: 4 };
    const heard = (x, y) => [{ k: 'noise', by: 'you', dist: 2, cls: 'soft' }, { target: [x, y] }];
    const seen = { k: 'seen', dist: 4 }, quiet = { k: 'quiet', by: 'you' };
    const changes = [
      ['searching', out, {}, 'lost', { from: 'hunting', to: 'searching' }],
      ['hunting', seen, {}, 'hunting', { was: 'searching' }],
      ['searching', out, {}, 'lost', { from: 'hunting', to: 'searching' }],
      ['returning', { k: 'searched' }, {}, 'lost', { from: 'searching', to: 'returning' }],
      ['awake', ...heard(3, 3), 'alerted', { from: 'returning', to: 'awake', x: 3, y: 3 }],
      ['awake', ...heard(4, 1), 'alerted', { from: 'awake', to: 'awake', x: 4, y: 1 }],
      ['returning', idle, {}, 'lost', { from: 'awake', to: 'returning' }],
      ['reinstalling', home, {}, 'returned', { phase: 'arrived' }],
      ['awake', ...heard(5, 3), 'alerted', { from: 'reinstalling', to: 'awake', x: 5, y: 3 }],
      ['hunting', seen, {}, 'hunting', { was: 'awake' }],
      ['awake', quiet, {}, 'lost', { from: 'hunting', to: 'awake' }],
      ['returning', idle, {}, 'lost', { from: 'awake', to: 'returning' }],
      ['reinstalling', home, {}, 'returned', { phase: 'arrived' }],
      ['dormant', home, {}, 'returned', { phase: 'reinstalled' }],
    ];
    for (const [mode, cause, opts, k, fields] of changes) {
      s.turn++; ev.length = 0;
      assert.equal(Wake.setMode(s, a, mode, cause, ev, opts), true, mode);
      assert.equal(ev.length, 1, mode);
      const e = checked(ev)[0];
      assert.equal(e.k, k, `into ${mode}`);
      for (const f of Object.keys(fields)) assert.equal(json(e[f]), json(fields[f]), `${mode}: ${f}`);
      assert.equal(json([a.mode, a.sawYou, a.acts, json(a.woke), a.stim]), json([mode, true, 4, woke, s.turn]), `into ${mode}: nothing reset`);
      if (mode === 'hunting') assert.equal(json([a.hunted.turn, a.hunted.cause.k, a.lastKnown]), json([s.turn, 'seen', [2, 2]]));
    }
    assert.ok(!Actors.scheduled(a), 'back asleep, it is not scheduled');
    assert.throws(() => Wake.setMode(s, a, 'awake', quiet, ev), /Wake\.wake wakes it/);
    Wake.wake(s, a, 'awake', heard(1, 1)[0], ev, { target: [1, 1] });
    ev.length = 0;
    assert.equal(Wake.setMode(s, a, 'awake', quiet, ev), false, 'no change, no event');
    assert.equal(ev.length, 0);
    Wake.setMode(s, a, 'returning', idle, ev);
    assert.throws(() => Wake.setMode(s, a, 'awake', quiet, ev), /alerted with no target/);
    assert.equal(a.mode, 'returning', 'refused before anything changed');
    // R6: a returning exhibit that has seen you, sent to look by a noise, is not surprised by a blow.
    const r = room(C, OPEN, [2, 2], [ex([3, 2], { mode: 'dormant' }), ex([2, 3], { mode: 'dormant' })]), [, b, c] = r.actors;
    Wake.wake(r, b, 'awake', heard(2, 2)[0], [], { target: [2, 2] });
    assert.equal(AI.look(r, b, []), true);
    assert.equal(json([b.mode, b.sawYou]), json(['hunting', true]), 'AI.look: it saw you and hunts, and sawYou stays true after the change');
    Wake.setMode(r, b, 'searching', out, []); Wake.setMode(r, b, 'returning', { k: 'searched' }, []);
    Wake.setMode(r, b, 'awake', ...heard(2, 2).slice(0, 1), [], { target: [2, 2] });
    Wake.wake(r, c, 'awake', heard(2, 2)[0], [], { target: [2, 2] });
    assert.equal(json([Combat.surprised(r.actors[0], b), Combat.surprised(r.actors[0], c)]), json([false, true]));
    const blow = Step.step(State.clone(r), { a: 'attack', uid: b.uid }).find(e => e.k === 'damaged' || e.k === 'missed');
    assert.ok(blow.cause.roll !== undefined && blow.cause.surprise === undefined, 'rolled, not a surprise: ' + json(blow.cause));
    const caught = Step.step(State.clone(r), { a: 'attack', uid: c.uid }).find(e => e.k === 'damaged');
    assert.equal(caught.cause.surprise, 1, 'one that has not seen you since it woke is surprised');
  });

  test('Wake.addPips: each trigger once a turn, between 0 and 3; the third wakes in its cause\'s mode; Wake.toHunting and Wake.created', () => {
    const s = room(C, OPEN, [2, 2], [ex([6, 1], { mode: 'dormant' }), ex([6, 4], { mode: 'dormant' })]), [, a, b] = s.actors, ev = [];
    const ring = { k: 'ring', dist: 2, r: 3 }, noise = { k: 'noise', by: 'you', dist: 3, cls: 'soft' };
    s.turn = 1;
    assert.equal(Wake.addPips(s, a, 1, ring, ev), false);
    assert.equal(Wake.addPips(s, a, 1, ring, ev), false, 'the ring again this turn adds nothing');
    assert.equal(a.pips, 1);
    Wake.addPips(s, a, 1, noise, ev);
    assert.equal(json([a.pips, a.stim]), json([2, 1]), 'another trigger this turn does');
    Wake.addPips(s, a, 1, noise, ev);
    assert.equal(a.pips, 2);
    s.turn = 2;
    assert.equal(Wake.addPips(s, a, 1, ring, ev), true, 'the third pip wakes it');
    assert.equal(json(checked(ev).map(e => e.k === 'pip' ? `pip ${e.pips} ${e.delta} ${e.cause.k}` : `${e.k} ${e.cause.k}`)),
      json(['pip 1 1 ring', 'pip 2 1 noise', 'pip 3 1 ring', 'woke ring', 'hunting ring']));
    assert.equal(json([a.mode, a.pips]), json(['hunting', 0]), 'the ring wakes into a hunt');
    ev.length = 0;
    b.pips = 2;
    assert.equal(Wake.addPips(s, b, 1, noise, ev, { target: [4, 4] }), true);
    assert.equal(json([b.mode, b.target]), json(['awake', [4, 4]]), 'noise wakes it awake, to look at the noise');
    // Losing pips floors at 0, and a change of nothing is no event.
    const t = room(C, OPEN, [2, 2], [ex([6, 1], { mode: 'dormant', pips: 1 })]), c = t.actors[1], lost = [];
    t.turn = 5;
    Wake.addPips(t, c, -2, { k: 'decay' }, lost);
    assert.equal(json([c.pips, c.stim, lost.map(e => e.delta)]), json([0, 0, [-1]]), 'a loss is not a stimulus');
    t.turn = 6; Wake.addPips(t, c, -1, { k: 'decay' }, lost);
    assert.equal(lost.length, 1);
    assert.equal(Wake.addPips(t, s.actors[0], 1, ring, lost), false, 'you have no pips');
    assert.throws(() => Wake.addPips(t, c, 3, { k: 'decay' }, lost), /decay cannot wake an exhibit/);
    assert.equal(json([c.pips, lost.length]), json([0, 1]), 'refused before anything changed');
    // toHunting wakes a sleeper, or changes the mode of one awake.
    const h = room(C, OPEN, [2, 2], [ex([6, 1], { mode: 'dormant' }), ex([6, 4], { mode: 'awake' })]), hv = [];
    Wake.toHunting(h, h.actors[1], { k: 'damage', by: 'you', dist: 1 }, hv);
    Wake.toHunting(h, h.actors[2], { k: 'damage', by: 'you', dist: 1 }, hv);
    assert.equal(json(checked(hv).map(e => `${e.k} ${e.was}`)), json(['woke dormant', 'hunting dormant', 'hunting awake']));
    // An actor made awake during the visit: a creation woke, and a beat before it acts.
    const w = room(C, OPEN, [2, 2]), cv = [];
    w.tick = 350; w.turn = 3;
    const watch = Actors.spawn(w, { uid: 'T0.1.watch.1', sp: 'watch', x: 6, y: 3, hp: 9, mode: 'hunting', next: 350 });
    Wake.created(w, watch, 'night_watch', {}, cv);
    assert.equal(json([watch.woke, watch.hunted, watch.next]), json([{ turn: 3, cause: { k: 'night_watch' } }, { turn: 3, cause: { k: 'night_watch' } }, 350 + N.COST_STEP]));
    assert.equal(json(watch.lastKnown), json([2, 2]), 'its hunt begins with your tile as its last-known tile');
    assert.equal(json(checked(cv).map(e => [e.k, e.was, e.mode])), json([['woke', null, 'hunting']]));
    const half = Actors.spawn(w, { uid: 'T0.1.watch.1/1', sp: 'watch', x: 6, y: 4, hp: 4, mode: 'awake', next: 0 });
    Wake.created(w, half, 'summoned', { how: 'split', from: watch.uid, parent: watch.woke }, null);
    assert.equal(json([half.woke.cause.how, half.hunted, half.next, half.lastKnown, cv.length]), json(['split', null, 0, null, 1]), 'made with the department: no event, no beat; awake, it knows no tile');
    assert.throws(() => Wake.created(w, half, 'ring', {}, cv), /not a cause an actor is created with/);
  });

  // An independent ring: walking distance by BFS over 8 neighbours (a diagonal only where both
  // orthogonal tiles can be stepped on), one beyond the nearest steppable neighbour for a tile
  // that cannot be, and Bresenham line of sight traced from the endpoint first in row-major
  // order; drawn on tiles an exhibit can stand on (BUILD.md §8.2).
  const WALK = new Set(['.', ',', '+', "'", 'S', 's', 'E', 'X', 'u', 'k', 'x', 'w', 'b', '=']);
  const SEE = new Set(['.', ',', "'", 's', 'E', 'X', 'v', 'u', 'k', 'x', 'w', 'p', 'f', 'l', 'b', '~', '=']);
  const LOUD = new Set(['k', 'x', 'w']);
  const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  function oracle(map, yx, yy, still) {
    const h = map.length, w = map[0].length, at = (x, y) => x < 0 || y < 0 || x >= w || y >= h ? '#' : map[y][x];
    const r = Math.max(N.RING_MIN, (still ? 2 : 3) + (LOUD.has(at(yx, yy)) ? 2 : 0));
    const dist = new Map([[`${yx},${yy}`, 0]]), queue = [[yx, yy]];
    while (queue.length) {
      const [x, y] = queue.shift(), d = dist.get(`${x},${y}`);
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!WALK.has(at(nx, ny)) || dist.has(`${nx},${ny}`)) continue;
        if (dx && dy && !(WALK.has(at(nx, y)) && WALK.has(at(x, ny)))) continue;
        dist.set(`${nx},${ny}`, d + 1); queue.push([nx, ny]);
      }
    }
    const reach = (x, y) => {
      if (WALK.has(at(x, y))) return dist.has(`${x},${y}`) ? dist.get(`${x},${y}`) : -1;
      let best = -1;
      for (const [dx, dy] of DIRS) { const k = `${x + dx},${y + dy}`; if (WALK.has(at(x + dx, y + dy)) && dist.has(k) && (best < 0 || dist.get(k) + 1 < best)) best = dist.get(k) + 1; }
      return best;
    };
    const los = (x0, y0, x1, y1) => {
      if (y1 < y0 || (y1 === y0 && x1 < x0)) [x0, y0, x1, y1] = [x1, y1, x0, y0];
      const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1;
      let err = dx - dy, x = x0, y = y0;
      while (!(x === x1 && y === y1)) {
        if (!(x === x0 && y === y0) && !SEE.has(at(x, y))) return false;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 < dx) { err += dx; y += sy; }
      }
      return true;
    };
    const out = new Map();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!(WALK.has(at(x, y)) || at(x, y) === 'v' || at(x, y) === 'p')) continue;
      const d = reach(x, y);
      if (d >= 0 && d <= r && los(yx, yy, x, y)) out.set(`${x},${y}`, d);
    }
    return { r, out };
  }

  test('ring pips at the turn boundary, and the ring drawn, are exactly an independent walking-distance and line-of-sight ring', () => {
    const map = [
      '############',
      '#....#.....#',
      '#.o..+..p..#',
      '#..v.#.....#',
      '#,...S...x.#',
      '#....#..b..#',
      '#.......o..#',
      '############',
    ];
    const hold = [];
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[0].length; x++) if (WALK.has(map[y][x]) || map[y][x] === 'v' || map[y][x] === 'p') hold.push([x, y]);
    let compared = 0, pipped = 0;
    for (const [yx, yy] of [[2, 1], [4, 4], [6, 2], [9, 4], [1, 6], [7, 5], [10, 1]]) for (const still of [false, true]) {
      const exhibits = hold.filter(([x, y]) => x !== yx || y !== yy).map(at => ex(at, { mode: 'dormant', stats: { hp: 5, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } }));
      const s = room(C, map, [yx, yy], exhibits);
      s.actors[0].still = still; s.turn = 1;
      const want = oracle(map, yx, yy, still), ev = [];
      Wake.boundary(s, ev);
      const got = new Map(checked(ev).filter(e => e.k === 'pip').map(e => { const a = Actors.byUid(s, e.who); assert.equal(e.cause.r, want.r); return [`${a.x},${a.y}`, e.cause.dist]; }));
      want.out.delete(`${yx},${yy}`);
      assert.equal(json([...got].sort()), json([...want.out].sort()), `you at ${yx},${yy}, still ${still}`);
      const drawn = Vision.ring(s), cells = [];
      for (let i = 0; i < drawn.length; i++) if (drawn[i]) cells.push(`${i % s.dept.w},${Math.floor(i / s.dept.w)}`);
      const full = oracle(map, yx, yy, still).out;
      assert.equal(json(cells.sort()), json([...full.keys()].sort()), `the drawn ring, you at ${yx},${yy}`);
      for (const k of full.keys()) { const [x, y] = k.split(',').map(Number); assert.ok(Vision.inRing(s, x, y)); }
      assert.ok(!Vision.inRing(s, 0, 0) && !Vision.inRing(s, 2, 2), 'never on a wall or a column');
      compared += hold.length; pipped += got.size;
    }
    assert.ok(compared > 500 && pipped > 60, `${compared} tiles, ${pipped} pips`);
    // Through a step: a wait (radius 2) is followed by turn 1's boundary, whose pips are the
    // ring the view model then draws; a 2×2 body gains one pip if any of its tiles is inside.
    const s = room(C, OPEN, [2, 2], [ex([4, 1], { mode: 'dormant' }), ex([5, 3], { mode: 'dormant', size: 2 }), ex([7, 4], { mode: 'dormant' })]);
    const ev = Step.step(s, { a: 'wait' });
    assert.equal(json(ev.filter(e => e.k === 'pip').map(e => [e.who, e.turn, e.cause.dist, e.cause.r])), json([[s.actors[1].uid, 1, 2, N.RING_STILL]]));
    s.actors[0].still = false;
    const ev2 = []; s.turn = 2; Wake.boundary(s, ev2);
    assert.equal(json(ev2.filter(e => e.k === 'pip').map(e => [e.who, e.cause.dist, e.cause.r])), json([[s.actors[1].uid, 2, 3], [s.actors[2].uid, 3, 3]]), 'the 2×2 body at distance 3');
    // The ring's radius: still or not, a loud floor, and what your kit takes away, never below RING_MIN.
    const X = loadCore(), t = room(X, ['#######', '#..x..#', '#######'], [3, 1]);
    t.actors[0].still = true;
    assert.equal(X.Vision.ringRadius(t), N.RING_STILL + N.RING_LOUD_FLOOR);
    X.Kit.ringDelta = () => -9;
    assert.equal(X.Vision.ringRadius(t), N.RING_MIN);
  });

  // A planted exhibit that marks its special whenever it can, and otherwise does as a plodder.
  function marker(X, id, special, hooks) {
    X.Registry.define('ARCHETYPES', id, { special });
    X.Archetypes.add(id, Object.assign({
      act(state, a, ev) { const t = X.Specials.tiles(state, a, X.Registry.SPECIALS[special].shape); return X.Specials.canMark(state, a, special, t) ? X.Specials.mark(state, a, special, t, ev) : null; },
    }, hooks || {}));
  }

  test('a special: one action marks, the next resolves through Padding with no roll, and the next comes after cost + 100; what resolves is what was marked', () => {
    const X = loadCore();
    marker(X, 'planted_warden', 'ring');
    const s = room(X, OPEN, [2, 2], [ex([3, 2], { arch: 'planted_warden' })]), [you, a] = s.actors;
    s.tick = 400; s.turn = 4; you.next = 400; a.next = 400;
    you.pad = 1;
    const ev1 = checked(X.Step.step(s, { a: 'wait' }));
    const tel = ev1.find(e => e.k === 'telegraphed');
    assert.equal(json([tel.tick, tel.who, tel.sp, tel.cause.gross, tel.cause.every]), json([400, a.uid, 'ring', Roles.at(N.ROLE_WARDEN_SPECIAL, 1), N.ROLE_WARDEN_SPECIAL_EVERY]));
    // The 8 tiles round it, in row-major order: (2..4, 1), (2, 2), (4, 2), (2..4, 3).
    assert.equal(json(tel.tiles), json([[2, 1], [3, 1], [4, 1], [2, 2], [4, 2], [2, 3], [3, 3], [4, 3]]));
    assert.equal(json([a.next, a.notBefore, s.tick]), json([500, null, 500]), 'its next action no earlier than your next decision');
    const gross = Roles.at(N.ROLE_WARDEN_SPECIAL, 1), shown = X.Specials.marks(s).find(m => m.x === 2 && m.y === 2);
    assert.equal(json(shown), json({ x: 2, y: 2, dmg: Math.max(N.DMG_MIN_ON_HIT, gross - 1), by: a.uid, kind: 'telegraph' }));
    assert.equal(X.Specials.marks(s).length, 8);
    const ev2 = checked(X.Step.step(s, { a: 'wait' }));
    assert.equal(json(kinds(ev2).filter(k => k !== 'waited')), json(['damaged', 'noise', 'special']));
    const hit = ev2.find(e => e.k === 'damaged');
    assert.equal(json([hit.tick, hit.who, hit.amount, hit.cause]), json([500, 'you', shown.dmg,
      { k: 'special', by: a.uid, sp: 'ring', gross, pad: 1, net: shown.dmg, x: 2, y: 2, from: [3, 2] }]), 'the damage dealt is the number shown');
    assert.equal(hit.cause.roll, undefined);
    const sp = ev2.find(e => e.k === 'special'), noise = ev2.find(e => e.k === 'noise');
    assert.equal(json([sp.hits, sp.cancelled, noise.cls, noise.x, noise.y, noise.cause.k]), json([['you'], undefined, 'soft', 3, 2, 'special']));
    assert.equal(json([a.telegraph, X.Specials.marks(s).length, a.next]), json([null, 0, 500 + N.COST_ATTACK + N.SPECIAL_RECOVERY]), 'mark 400, resolve 500, next 700');
    X.Step.step(s, { a: 'wait' });
    const ev4 = X.Step.step(s, { a: 'wait' });
    assert.equal(ev4.find(e => e.k === 'telegraphed').tick, 700);
  });

  test('no unseen special: a fast exhibit that marks during your 300-tick action resolves just after your next decision', () => {
    const X = loadCore();
    marker(X, 'planted_quick', 'ring', { speedApplies: () => ['move', 'act'] });
    const s = room(X, OPEN, [2, 2], [ex([3, 2], { arch: 'planted_quick', speed: 'fast' })]), a = s.actors[1];
    assert.equal(X.Actors.cost(s, a, N.COST_ATTACK, 'act'), N.COST_ATTACK * N.SPEED_FAST_PCT / 100, 'its mark costs half a turn');
    const h = X.Actions.get('wait'), apply = h.apply;
    h.apply = (state, action, ev) => { apply(state, action, ev); return 300; };
    const ev1 = X.Step.step(s, { a: 'wait' });
    h.apply = apply;
    assert.ok(ev1.some(e => e.k === 'telegraphed' && e.tick === 0) && !ev1.some(e => e.k === 'damaged'), 'marked at 0, not resolved at 50');
    assert.equal(json([s.tick, a.next]), json([300, 300]), 'you decide at 300 with the mark shown');
    const shown = X.Specials.marks(s).find(m => m.x === 2 && m.y === 2).dmg;
    const ev2 = X.Step.step(s, { a: 'wait' }), hit = ev2.find(e => e.k === 'damaged');
    assert.ok(ev2.findIndex(e => e.k === 'waited') < ev2.indexOf(hit), 'your action at 300 comes first');
    assert.equal(json([hit.tick, hit.amount]), json([300, shown]));
  });

  test('no overlaps: a damage mark may not share a tile with another pending damage mark; a call neither blocks nor is blocked', () => {
    const s = room(C, OPEN, [2, 2], [ex([3, 2]), ex([4, 2]), ex([5, 3]), ex([7, 4])]), [, a, b, c, d] = s.actors, ev = [];
    const ring = x => Specials.tiles(s, x, 'ring');
    assert.ok(Specials.canMark(s, a, 'ring', ring(a)));
    Specials.mark(s, a, 'ring', ring(a), ev);
    assert.equal(Specials.canMark(s, b, 'ring', ring(b)), false, 'its ring shares tiles with the pending one');
    assert.equal(Specials.canMark(s, a, 'ring', ring(a)), false, 'one mark pending at a time');
    const call = Specials.tiles(s, c, 'call');
    assert.ok(call.some(([x, y]) => ring(a).some(t => t[0] === x && t[1] === y)));
    assert.ok(Specials.canMark(s, c, 'call', call), 'a call over a damage mark');
    Specials.mark(s, c, 'call', call, ev);
    assert.ok(Specials.canMark(s, d, 'ring', ring(d)), 'a damage mark over a call');
    const marks = Specials.marks(s);
    assert.equal(json([marks.filter(m => m.kind === 'telegraph').length, marks.filter(m => m.kind === 'call').every(m => m.dmg === null && m.by === c.uid)]), json([8, true]));
    // Only a hunter marks; nothing marks no tiles; the encased mark only a line or a call.
    const t = room(C, ['#######', '#.....#', '#..v..#', '#.....#', '#######'], [1, 2], [ex([3, 2]), ex([5, 1], { mode: 'awake' })]), [, e, f] = t.actors;
    assert.equal(json(['ring', 'line', 'call'].map(id => Specials.canMark(t, e, id, [[3, 1]]))), json([false, true, true]));
    assert.equal(json([Specials.canMark(t, f, 'ring', [[5, 2]]), Specials.canMark(t, t.actors[1], 'line', [])]), json([false, false]));
    assert.throws(() => Specials.mark(t, f, 'ring', [[5, 2]], []), /may not mark ring/);
  });

  test('a beam turned back by a reflector lists each tile once and hits each actor once, the shooter included', () => {
    const X = loadCore();
    const map = ['#########', '#.......#', '#.......#', '#########'];
    const s = room(X, map, [5, 2], [ex([3, 2]), ex([6, 2]), ex([7, 2])]), [you, sn, e, r] = s.actors;
    assert.equal(json(X.Ranged.beam(s, sn, 2, N.AXIS_BEAM_RANGE)), json([[4, 2], [5, 2], [6, 2], [7, 2]]), 'straight to the wall');
    assert.equal(json(X.Ranged.beam(s, sn, 2, 2)), json([[4, 2], [5, 2]]), 'at most its range');
    X.Ranged.reflectorAt = (state, x, y) => x === r.x && y === r.y;
    // Out 4, 5, 6, 7; back over 6, 5, 4 (listed already), then 3 (the shooter), 2 and 1: ten steps.
    assert.equal(json(X.Ranged.beam(s, sn, 2, N.AXIS_BEAM_RANGE)), json([[4, 2], [5, 2], [6, 2], [7, 2], [3, 2], [2, 2], [1, 2]]));
    assert.equal(json(X.Ranged.beamFrom(s, sn, 2, N.AXIS_BEAM_RANGE)), json([[3, 2], [4, 2], [5, 2], [6, 2], [4, 2], [3, 2], [2, 2]]));
    const tiles = X.Specials.tiles(s, sn, 'line'), ev = [];
    assert.equal(json(tiles), json([[1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2]]), 'row-major, each once');
    X.Specials.mark(s, sn, 'line', tiles, ev);
    X.Specials.resolve(s, sn, ev);
    const hits = ev.filter(e => e.k === 'damaged');
    assert.equal(json(hits.map(h => [h.who, h.cause.from])), json([['you', [4, 2]], [sn.uid, [4, 2]], [e.uid, [5, 2]], [r.uid, [6, 2]]]), 'once each, in spawn order, from where the beam came');
    assert.equal(json(ev.find(e => e.k === 'special').hits), json(['you', sn.uid, e.uid, r.uid]));
    const gross = Roles.at(N.ROLE_ARTILLERY_SPECIAL, 1);
    assert.ok(hits.every(h => h.cause.gross === gross && h.amount === Math.max(N.DMG_MIN_ON_HIT, gross - h.cause.pad)));
    // A beam passes glass and stops at what blocks sight; with no shared row or column there is no line.
    const g = room(X, ['#########', '#..v.o..#', '#########'], [7, 1], [ex([1, 1])]);
    assert.equal(json(X.Ranged.beam(g, g.actors[1], 2, 10)), json([[2, 1], [3, 1], [4, 1]]));
    const off = room(X, OPEN, [2, 2], [ex([5, 4])]);
    assert.equal(json(X.Specials.tiles(off, off.actors[1], 'line')), '[]');
    // A line (a bolt's path) follows line of sight's tiles and stops before what it may not pass.
    const l = room(X, ['#########', '#.......#', '#...v...#', '#.......#', '#########'], [1, 1]);
    assert.equal(json(X.Ranged.line(l, 1, 1, 7, 3, 10)), json([[2, 1], [3, 2], [4, 2], [5, 2], [6, 3], [7, 3]]));
    assert.equal(json(X.Ranged.line(l, 1, 1, 7, 3, 10, X.Grid.bolt)), json([[2, 1], [3, 2]]), 'a bolt stops at glass');
    assert.equal(json(X.Ranged.line(l, 7, 3, 1, 1, 3)), json([[6, 3], [5, 2], [4, 2]]), 'the same tiles from the other end, at most its range');
  });

  test('a pending mark is cancelled when its owner is fixed, leaves hunting or is destroyed', () => {
    const s = room(C, OPEN, [2, 2], [ex([3, 2]), ex([5, 3]), ex([6, 1], { stats: { hp: 3, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } })]), [, a, b, c] = s.actors;
    for (const x of [a, b, c]) Specials.mark(s, x, x === b ? 'call' : 'ring', Specials.tiles(s, x, x === b ? 'call' : 'ring'), []);
    assert.equal(json(Specials.marks(s).map(m => m.by).filter((u, i, all) => all.indexOf(u) === i)), json([a.uid, b.uid, c.uid]));
    const ev = [];
    held(a, 'fixed', 99);
    AI.act(s, a, ev);
    Wake.setMode(s, b, 'searching', { k: 'out_of_sight', turns: N.LOSE_TRACK_TURNS }, ev);
    Combat.hurt(s, c, 5, { k: 'attack', by: 'you', at: c.uid, chance: 80, roll: 3, raw: 5, pad: 0, how: { kind: 'melee' }, from: [5, 1] }, ev);
    assert.equal(json(checked(ev).filter(e => ['special', 'lost', 'died'].includes(e.k)).map(e => [e.k, e.who, e.cancelled || null, e.cause.why || null])),
      json([['special', a.uid, true, 'fixed'], ['special', b.uid, true, 'out_of_sight'], ['lost', b.uid, null, null], ['died', c.uid, null, null], ['special', c.uid, true, 'died']]));
    assert.equal(json([a.telegraph, b.telegraph, c.telegraph, Specials.marks(s)]), json([null, null, null, []]));
    assert.ok(!ev.some(e => e.k === 'damaged' && e.cause.k === 'special'), 'nothing resolved');
  });

  test('Specials.of reads each archetype\'s special from the registry, at the department\'s depth', () => {
    const s = room(C, OPEN, [2, 2], [ex([5, 2], { arch: 'axis_sniper' }), ex([5, 3], { arch: 'tethered_warden' }), ex([5, 4], { arch: 'herald' }), ex([6, 2])]);
    for (const depth of [1, 4, 7]) {
      s.dept.depth = depth;
      assert.equal(json(s.actors.slice(1).map(a => Specials.of(s, a))), json([
        { id: 'line', shape: 'line', effect: 'damage', gross: Roles.at(N.ROLE_ARTILLERY_SPECIAL, depth), every: null, range: N.AXIS_BEAM_RANGE },
        { id: 'ring', shape: 'ring', effect: 'damage', gross: Roles.at(N.ROLE_WARDEN_SPECIAL, depth), every: N.ROLE_WARDEN_SPECIAL_EVERY, range: null },
        { id: 'call', shape: 'call', effect: 'hook', gross: 0, every: null, range: N.HERALD_RANGE },
        null]), `depth ${depth}`);
    }
    assert.equal(json([Specials.net(5, 9), Specials.net(9, 2)]), json([N.DMG_MIN_ON_HIT, 7]));
    // A ring's tiles are those an exhibit could stand on; a call's are within HERALD_RANGE.
    const w = room(C, ['#######', '#.o...#', '#..p..#', '#######'], [5, 1], [ex([2, 2])]), a = w.actors[1];
    assert.equal(json(Specials.tiles(w, a, 'ring')), json([[1, 1], [3, 1], [1, 2], [3, 2]]), 'not the column, nor the walls');
    const wide = room(C, ['###############', '#.............#', '#.............#', '###############'], [13, 1], [ex([1, 1])]);
    const call = Specials.tiles(wide, wide.actors[1], 'call');
    assert.equal(json(call.filter(t => t[1] === 1).map(t => t[0])), json([1, 2, 3, 4, 5, 6, 7]), 'within 6 by dx² + dy² ≤ r² + r');
  });

  test('an exhibit steps toward a goal along a shortest walking path, ties on its own stream, away when told, and never where its archetype says not', () => {
    const map = ['#######', '#.....#', '#..#..#', '#.....#', '#######'];
    const s = room(C, map, [5, 3], [ex([1, 1])]);
    const bfs = (gx, gy) => { const d = new Map([[`${gx},${gy}`, 0]]), q = [[gx, gy]];
      while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy;
        if (map[ny][nx] !== '.' || d.has(`${nx},${ny}`) || (dx && dy && (map[y][nx] !== '.' || map[ny][x] !== '.'))) continue; d.set(`${nx},${ny}`, d.get(`${x},${y}`) + 1); q.push([nx, ny]); } }
      return (x, y) => d.get(`${x},${y}`); };
    const toYou = bfs(5, 3), chosen = new Set();
    for (let seed = 1; seed <= 12; seed++) {
      const t = State.clone(s); t.seed = seed;
      const a = t.actors[1], before = toYou(a.x, a.y);
      assert.equal(AI.towards(t, a, t.actors[0], 'beside', []), N.COST_STEP);
      assert.equal(toYou(a.x, a.y), before - 1, 'one step nearer by walking distance');
      chosen.add(`${a.x},${a.y}`);
      const u = State.clone(s); u.seed = seed; AI.towards(u, u.actors[1], u.actors[0], 'beside', []);
      assert.equal(`${u.actors[1].x},${u.actors[1].y}`, `${a.x},${a.y}`, 'the same seed, the same step');
    }
    assert.equal(json([...chosen].sort()), json(['1,2', '2,1', '2,2']), 'each of the three shortest first steps occurs');
    // Beside you it has arrived; onto a tile, it walks to it; away, it goes further.
    const b = room(C, map, [5, 3], [ex([4, 3])]);
    assert.equal(AI.towards(b, b.actors[1], b.actors[0], 'beside', []), null);
    assert.equal(AI.towards(b, b.actors[1], [4, 3], 'onto', []), null);
    const fromYou = bfs(5, 3), was = fromYou(4, 3);
    assert.equal(AI.away(b, b.actors[1], b.actors[0], []), N.COST_STEP);
    assert.ok(fromYou(b.actors[1].x, b.actors[1].y) > was);
    // A modifier that forbids every step leaves it where it is.
    const X = loadCore();
    X.Registry.define('MODIFIERS', 'planted_rooted', {}); X.Archetypes.addModifier('planted_rooted', { mayStep: () => false });
    const r = room(X, map, [5, 3], [ex([1, 1], { mods: ['planted_rooted'] })]);
    assert.equal(json([X.AI.towards(r, r.actors[1], r.actors[0], 'beside', []), X.AI.away(r, r.actors[1], r.actors[0], [])]), json([null, null]));
    // AI.sees: within SIGHT_EXHIBIT with line of sight, and never asleep.
    const v = room(C, ['##############', '#............#', '#....#.......#', '##############'], [1, 1], [ex([9, 1]), ex([10, 1]), ex([7, 2]), ex([2, 2], { mode: 'dormant' })]);
    assert.equal(json(v.actors.slice(1).map(a => AI.sees(v, a))), json([true, false, false, false]), '8 tiles away; 9; behind the column; asleep');
  });

  test('an encased exhibit never leaves its tile and never strikes out, whatever it is told', () => {
    const X = loadCore();
    X.Registry.define('ARCHETYPES', 'planted_restless', {});
    X.Archetypes.add('planted_restless', { act(state, a, ev) { return X.AI.towards(state, a, state.actors[0], 'beside', ev) || X.AI.away(state, a, state.actors[0], ev) || X.AI.strike(state, a, state.actors[0], ev); } });
    const map = ['#########', '#.......#', '#..v.v..#', '#.......#', '#########'];
    const s = room(X, map, [1, 1], [ex([3, 2], { stats: { hp: 999, acc: 9, eva: 0, pad: 0, dmin: 1, dmax: 1 } }), ex([5, 2], { arch: 'planted_restless' })]);
    const ev = [], pick = X.Rng.stream({ seed: 4, rng: {} }, 'pick');
    for (let i = 0; i < 300 && !s.over; i++) {
      const legal = X.Step.legal(s);
      ev.push(...X.Step.step(s, legal[pick.int(0, legal.length - 1)]));
    }
    assert.equal(json(s.actors.slice(1).map(a => [a.x, a.y])), json([[3, 2], [5, 2]]));
    assert.ok(!ev.some(e => (e.k === 'attacked' || e.k === 'moved') && (e.by || e.who) !== 'you'), 'no blow and no step of theirs');
    assert.ok(ev.some(e => e.k === 'moved' && e.who === 'you'), 'you walked about beside them');
  });

  // A stub's contract is its name and signature until its owner fills it; only the M4 hooks
  // stay neutral through M3 (plan A17), each checked on its own line, by owner.
  test('the M4 hooks are present and neutral; the stubs Wave 1 fills are present, with their signatures; every archetype and modifier file is registered', () => {
    const X = loadCore(), s = X.TestRoom.create(1), ev = [], h = State.hash(s), a = s.actors[1];
    // W1-WAKE-A's file: the chime (Wake.perform, Wake.resleep) and the Lamp (Vision.observed).
    X.Wake.perform(s, a, { k: 'period' }, ev); X.Wake.resleep(s, a, ev);
    assert.equal(State.hash(s), h, 'Wake.perform and Wake.resleep change nothing'); assert.equal(ev.length, 0);
    assert.equal(X.Vision.observed(s, a), false, 'Vision.observed');
    // W1-WAKE-B's file: the alarm's hold on returning, Single File, Vanishing Act.
    X.AI.afterStep(s, a, ev);
    assert.equal(State.hash(s), h, 'AI.afterStep changes nothing'); assert.equal(ev.length, 0);
    assert.equal(X.AI.mayReturn(s, a), true, 'AI.mayReturn');
    assert.equal(X.AI.loseTrackTurns(s, a), N.LOSE_TRACK_TURNS, 'AI.loseTrackTurns');
    // Wave 1 stubs: present and named; the number of arguments where the review set a
    // signature that parallel packages call (null: not checked).
    const NAMED = [
      ['Wake', 'axis', null], ['Wake', 'tether', null], ['Wake', 'decay', null], ['Wake', 'hear', null], ['Wake', 'allyHit', null], ['Wake', 'quiet', null], ['Wake', 'lose', null],
      ['AI', 'wanderGoal', null], ['AI', 'byMode', null], ['Specials', 'readout', null], ['Specials', 'threat', null],
      ['Ranged', 'shoot', 6], ['Ranged', 'reflectorAt', 3], ['Grid', 'clear', 3],
    ];
    for (const [ns, fn, n] of NAMED) {
      assert.equal(typeof X[ns][fn], 'function', `${ns}.${fn}`);
      if (n !== null) assert.equal(X[ns][fn].length, n, `${ns}.${fn} takes ${n} arguments`);
    }
    // close(x, y) is named, with a legal list and candidates.
    const close = X.Actions.get('close');
    assert.ok(close && typeof close.legal === 'function' && typeof close.candidates === 'function' && close.candidates(s).length > 0);
    for (const id of ['plodder', 'darter', 'kiter', 'axis_sniper', 'splitter', 'mote_swarm', 'herald', 'tethered_warden', 'reflector', 'mimic_vitrine', 'night_watchman'])
      assert.ok(X.Archetypes.added(id), id);
    for (const id of ['glass', 'old_repair', 'marble', 'plaster']) assert.ok(X.Archetypes.addedModifier(id), id);
    // Every M3 archetype in the registry has its file.
    for (const id of X.Registry.order('ARCHETYPES')) assert.equal(X.Archetypes.added(id), X.Registry.ARCHETYPES[id].built === 'M3', id);
  });
};
