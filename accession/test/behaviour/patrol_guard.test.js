// ACCESSION — the Wader's Behaviour line, its archetype's part (BUILD.md §5.3, §5.5; MOD-ALARM):
// "Walks its round and strikes from beside you for {dmg}. On seeing you it chases you; losing
// you, it searches, then resumes its round." (with alarm_network on, its slot holds the
// module's part, test/behaviour/alarm_network.test.js), and "It never sleeps." (its trigger).
// Each scenario runs for every pack Wader (S9.2) at depths 1–7, joined up, every invariant
// checked after every step, a clone checked where it says so. What is expected is worked out
// here from the clause, not from the rule: in an open room a shortest walk is a Chebyshev one,
// and a Wader's step is the first, in the compass order N, NE, E, SE, S, SW, W, NW, that
// shortens it. Also its wake region (plan A8: its round's sight), against its round played,
// and against standing there; and that its round and its wake region draw on no stream.
'use strict';
const H = require('./_harness.js');
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Setup, Step, Roles, N, Grid, Noise, Wake, Archetypes, State } = C;
  const json = x => JSON.stringify(x);
  const waits = n => Array.from({ length: n }, () => ({ a: 'wait' }));
  const range = s => s.split('–').map(Number).concat(s.includes('–') ? [] : [Number(s)]).slice(0, 2);
  const wader = s => s.actors.find(a => a.arch === 'patrol_guard');
  const ok = (results, name) => { const f = H.failures(results); assert.equal(f.length, 0, `${name}:\n${f.slice(0, 5).join('\n')}`); };
  const list = id => { const l = H.species(C, id); assert.ok(l.length >= 7, `${id}: ${l.length} species and depths`); return l; };
  const tough = { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 };

  // A room in S.9 (so a Wader's species is the pack's, flagged with alarm_network), with you
  // made hard to kill, and the Wader given its round and told it walks it (its story, as
  // population and Setup.settleActors give a patrol). modules: whether the visit runs S.9's
  // modules (Modules.init, as a department does); a room for tests runs none.
  function room(depth, opts, spec, round, modules) {
    const s = Setup.room(opts.seed, Object.assign({ acc: 'S9', depth }, spec), { rulesOff: opts.rulesOff });
    s.actors[0].hp = s.actors[0].maxHp = 999;
    const a = wader(s);
    if (round) { a.route = JSON.parse(json(round)); if (a.mode !== 'dormant') Wake.created(s, a, 'patrol', {}, null); }
    if (modules) C.Modules.init(s, C.Packs.get('S9'));
    return s;
  }

  // ---- Its round ----
  // A room, and a pocket you stand in that it cannot see or reach.
  const OPEN = ['######################', '#..............#.....#', '#..............#.....#', '#..............#.....#', '#..............#.....#', '#..............#.....#', '######################'];
  const POSTS = [[1, 1], [14, 1], [14, 5], [1, 5]];
  const cheb = (p, q) => Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]));
  // Where the clause puts it after each of its actions, from (x, y) heading for post i.
  function walked(from, i, n) {
    let at = from.slice(), k = i;
    const out = [];
    for (let t = 0; t < n; t++) {
      if (at[0] === POSTS[k][0] && at[1] === POSTS[k][1]) k = (k + 1) % POSTS.length;
      for (let d = 0; d < 8; d++) {
        const to = [at[0] + Grid.DX[d], at[1] + Grid.DY[d]];
        if (to[0] >= 1 && to[0] <= 14 && to[1] >= 1 && to[1] <= 5 && cheb(to, POSTS[k]) === cheb(at, POSTS[k]) - 1) { at = to; break; }
      }
      out.push([at.slice(), k]);
    }
    return out;
  }
  const rounds = H.scenario({
    name: 'it walks its round: post to post, each in turn, one step a turn along a shortest walk, round and round',
    id: 'patrol_guard', clone: true,
    build: (params, sp, depth, opts) => room(depth, opts, { map: OPEN, you: [18, 3], exhibits: [{ sp: sp.id, at: [7, 3], stats: Roles.stats(sp.role, depth) }] }, { posts: POSTS, i: 2 }, true),
    actions: waits(70),
    expect(r) {
      const a = wader(r.start), want = walked([7, 3], 2, 70);
      for (let t = 0; t < r.steps.length; t++) {
        // After your wait t + 1, it has made t + 1 actions: where it stands after the last.
        const moves = r.events.filter(e => e.k === 'moved' && e.who === a.uid && e.tick <= t * N.TICKS_PER_TURN);
        const at = moves.length ? moves[moves.length - 1].to : [7, 3];
        if (json(at) !== json(want[t][0])) return `after its action ${t + 1} it stands on ${at}, not on ${want[t][0]} (heading for post ${want[t][1]})`;
      }
      const seen = new Set(want.map(w => w[1]));
      if (seen.size !== 4) return 'the round did not come to every post';
      if (r.events.some(e => e.who === a.uid && (e.k === 'hunting' || e.k === 'alerted' || e.k === 'lost' || e.k === 'telegraphed'))) return 'it left its round, though it never saw you';
      if (Object.keys(r.state.rng).some(k => k.includes(a.uid))) return `its round drew on a stream (${Object.keys(r.state.rng).filter(k => k.includes(a.uid))})`;
      return null;
    },
  });
  test('it walks its round, post to post in turn, along a shortest walk, drawing on no stream', () => {
    ok(H.sweep(C, rounds, list('patrol_guard')), rounds.name);
  });

  // A closed door on its round is opened as one action, as any exhibit opens one; then it walks
  // on through. A post another actor stands on counts as reached from beside it.
  const DOOR = ['##############', '#.....#......#', '#.....+......#', '#.....#......#', '##############', '#............#', '##############'];
  const doorway = H.scenario({
    name: 'a closed door on its round it opens, as an action, and walks on through; a post someone stands on is reached from beside it',
    id: 'patrol_guard', clone: true,
    build: (params, sp, depth, opts) => room(depth, opts, { map: DOOR, you: [6, 5], exhibits: [{ sp: sp.id, at: [9, 2], stats: Roles.stats(sp.role, depth) },
      { sp: 'dummy', at: [12, 2], mode: 'dormant', stats: tough }] }, { posts: [[2, 2], [12, 2]], i: 0 }, true),
    actions: waits(20),
    expect(r) {
      const a = wader(r.start), mine = r.events.filter(e => e.who === a.uid);
      const opened = mine.findIndex(e => e.k === 'opened'), through = mine.findIndex(e => e.k === 'moved' && e.to[0] === 6 && e.to[1] === 2);
      if (opened < 0 || through < opened) return 'it did not open the door and walk through it';
      if (!mine.some(e => e.k === 'moved' && e.to[0] === 2 && e.to[1] === 2)) return 'it did not reach the far post';
      // Back toward (12, 2), where the dummy stands: it gets beside it, then sets off again.
      const back = mine.filter(e => e.k === 'moved' && e.to[0] >= 11);
      if (!back.length) return 'it did not come back to the post the dummy stands on';
      if (!mine.some((e, k) => e.k === 'moved' && k > mine.indexOf(back[0]) && e.to[0] < 11)) return 'beside the occupied post, it did not set off again';
      return null;
    },
  });
  test('a closed door on its round it opens and walks through; a post someone stands on is reached from beside it', () => {
    ok(H.sweep(C, doorway, list('patrol_guard')), doorway.name);
  });

  // ---- On seeing you it chases you (alarm_network off, or a room without it) ----
  const HALL = ['####################', '#..................#', '#..................#', '#..................#', '#..................#', '#..................#', '####################'];
  const chase = modules => H.scenario({
    name: `on seeing you it chases you and strikes from beside you for its damage, and never shows the alarm (${modules ? 'alarm_network switched off' : 'a room without the module'})`,
    id: 'patrol_guard', clone: true,
    build: (params, sp, depth, opts) => room(depth, { seed: opts.seed, rulesOff: modules ? opts.rulesOff.concat(['alarm_network']) : opts.rulesOff },
      { map: HALL, you: [12, 3], exhibits: [{ sp: sp.id, at: [6, 3], stats: Roles.stats(sp.role, depth) }] }, { posts: [[1, 1], [18, 1]], i: 0 }, modules),
    actions: waits(30),
    expect(r, params) {
      const a = wader(r.start), [lo, hi] = range(params.dmg), first = r.steps[0].events;
      const hunt = first.find(e => e.k === 'hunting' && e.who === a.uid);
      if (!hunt || hunt.cause.k !== 'seen') return 'it did not begin hunting you on seeing you';
      if (!first.some(e => e.k === 'moved' && e.who === a.uid && e.to[0] > e.from[0])) return 'it did not come after you at once';
      const blows = r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.by === a.uid);
      if (blows.length < 5) return `only ${blows.length} blows in 30 turns`;
      const bad = blows.find(e => e.cause.k !== 'attack' || e.cause.raw < lo || e.cause.raw > hi);
      if (bad) return `a blow rolled ${bad.cause.raw} (${bad.cause.k}), outside ${params.dmg}`;
      const struck = r.events.filter(e => e.k === 'attacked' && e.by === a.uid);
      if (struck.some(e => !e.cause.how || e.cause.how.kind !== 'melee')) return 'it struck but not from beside you';
      if (r.events.some(e => e.k === 'telegraphed' || e.k === 'alarm' || (e.k === 'module' && e.id === 'alarm_network'))) return 'with the module off it showed or raised the alarm';
      return null;
    },
  });
  const chaseOff = chase(true), chaseAbsent = chase(false);
  test('with alarm_network off, on seeing you it only chases you, striking from beside you for {dmg}; and its line says so', () => {
    ok(H.sweep(C, chaseOff, list('patrol_guard')), chaseOff.name);
    ok(H.sweep(C, chaseAbsent, list('patrol_guard')), chaseAbsent.name);
    for (let depth = 1; depth <= 7; depth++) {
      const sp = C.Packs.species('S9', 'S9.2'), [lo, hi] = range(C.Clauses.of(sp, { depth }).find(p => p.id === 'patrol_guard').params.dmg);
      const st = Roles.stats(sp.role, depth);
      assert.equal(json([lo, hi]), json([st.dmin, st.dmax]));
      for (const ctx of [{ depth, rulesOff: ['alarm_network'] }, { depth, modules: [] }])
        assert.equal(C.Clauses.line(sp, ctx), `Walks its round and strikes from beside you for ${lo}–${hi}. On seeing you it chases you; losing you, it searches, then resumes its round. It never sleeps.`);
    }
  });

  // ---- Losing you, it searches, then resumes its round ----
  const LOST = ['###################', '#.........#.......#', '#.........#.......#', '#.........+.......#', '#.........#.......#', '#.........#.......#', '###################'];
  const lost = H.scenario({
    name: 'losing you, it searches where it last knew you were, then resumes its round, never wandering nor sleeping',
    id: 'patrol_guard', clone: true,
    build: (params, sp, depth, opts) => {
      const s = room(depth, opts, { map: LOST, you: [16, 1], exhibits: [{ sp: sp.id, at: [3, 3], mode: 'hunting', lastKnown: [8, 3], stim: 0, stats: Roles.stats(sp.role, depth) }] },
        { posts: [[1, 1], [9, 1], [9, 5], [1, 5]], i: 3 }, true);
      return s;
    },
    actions: waits(30),
    expect(r) {
      const a = wader(r.start), mine = r.events.filter(e => e.who === a.uid);
      const lostAt = mine.find(e => e.k === 'lost' && e.to === 'searching');
      if (!lostAt || lostAt.cause.k !== 'out_of_sight' || lostAt.turn !== N.LOSE_TRACK_TURNS) return `it did not lose you after ${N.LOSE_TRACK_TURNS} turns out of sight (${json(lostAt)})`;
      const back = mine.find(e => e.k === 'alerted');
      if (!back || back.cause.k !== 'round' || back.from !== 'searching' || back.to !== 'awake') return `its search done, it did not go back to its round: ${json(back)}`;
      if (json([back.x, back.y]) !== json([1, 5])) return `it went back toward ${back.x},${back.y}, not its next post 1,5`;
      if (back.turn - lostAt.turn < N.SEARCH_TURNS) return `it searched for ${back.turn - lostAt.turn} turns, fewer than ${N.SEARCH_TURNS}`;
      if (mine.some(e => (e.k === 'lost' && (e.to === 'returning' || e.to === 'dormant')) || (e.k === 'alerted' && e.cause.k === 'searched'))) return 'it went back to sleep, or wandered';
      const after = mine.filter(e => e.k === 'moved' && e.tick > back.tick);
      if (!after.length || !after.some(e => e.to[0] === 1 && e.to[1] === 5)) return 'it did not walk on to its post';
      if (r.state.actors[1].mode !== 'awake') return `it ended ${r.state.actors[1].mode}`;
      return null;
    },
  });
  test('losing you, it searches, then resumes its round (alerted, cause round), never going back to sleep or wandering', () => {
    ok(H.sweep(C, lost, list('patrol_guard')), lost.name);
  });

  // Sent to look at a noise (a noise planted at a tile, as §8.2's awake exhibit hears one), it
  // goes there, then resumes its round from where it stands.
  test('sent to look at a noise, it goes there, then resumes its round from where it stands', () => {
    for (const { sp, depth } of list('patrol_guard')) {
      const s = room(depth, { seed: depth, rulesOff: [] }, { map: OPEN, you: [18, 3], exhibits: [{ sp: sp.id, at: [7, 3], stats: Roles.stats(sp.role, depth) }] }, { posts: POSTS, i: 0 }, true);
      const a = wader(s), ev = [];
      Noise.emit(s, 10, 5, 'loud', { k: 'attack', by: 'you' }, ev);
      assert.equal(json(a.target), json([10, 5]), 'it was sent to look');
      const r = H.play(C, s, waits(12));
      assert.deepEqual(r.violations.map(v => v.text), []);
      const moves = r.events.filter(e => e.k === 'moved' && e.who === a.uid).map(e => e.to);
      const there = moves.findIndex(t => t[0] === 10 && t[1] === 5);
      assert.ok(there >= 0, `${sp.id} d${depth}: it went to look`);
      assert.ok(moves.slice(there + 1).some(t => cheb(t, POSTS[0]) < cheb([10, 5], POSTS[0])), 'then it walked on to its post');
      assert.equal(a.target, null);
    }
  });

  // ---- Its wake region: its round's sight (plan A8), for D-LV6's safe zone ----
  // A round through a door, a pillar in the way, and you in a pocket nothing reaches.
  const WR = ['###########################', '#.......#.......#.......#.#', '#.......#...............#.#', '#.......+.......#.......#.#', '#...o...#...o...#.......#.#', '#.......#.......#.......#.#', '###########################'];
  const WR_POSTS = [[10, 1], [14, 5], [2, 4]], YOU_AWAY = [25, 3];
  const wrRoom = (depth, you) => room(depth, { seed: 1, rulesOff: [] }, { map: WR, you: you || YOU_AWAY, exhibits: [{ sp: 'S9.2', at: [12, 2], stats: Roles.stats('warden', depth) }] }, { posts: WR_POSTS, i: 0 }, true);
  // Every tile you could stand on (floor, not the Wader's own).
  const standable = s => { const out = []; for (let y = 0; y < s.dept.h; y++) for (let x = 0; x < s.dept.w; x++) if (Grid.walkable(s.dept, x, y) && !Grid.closedDoor(s.dept, x, y) && !(x === 12 && y === 2) && !(x === 25)) out.push([x, y]); return out; };

  // At 13 turns it has just opened the door, from (9, 3), and looks through it at its last
  // action; at 20 it has walked through.
  test('its wake region is its round\'s sight: the tiles it would see from where it walks over the next turns, through the door once it opens it', () => {
    for (const depth of [1, 4, 7]) for (const turns of [0, 5, 13, N.SAFE_ZONE_TURNS]) {
      const s = wrRoom(depth), a = wader(s), before = State.hash(s);
      const region = Archetypes.wakeRegion(s, a, turns);
      assert.equal(State.hash(s), before, 'reading the region changes nothing');
      assert.ok(!Object.keys(s.rng).length, 'it draws on no stream');
      // The oracle: its round played (you out of the way), and from where it stood at each of
      // its actions up to `turns` turns from now, every tile within its sight then.
      const play = State.clone(s), seenFrom = [{ x: 12, y: 2, tiles: play.dept.tiles.slice() }];
      for (let t = 0; t < turns; t++) {
        Step.step(play, { a: 'wait' });
        const w = wader(play);
        seenFrom.push({ x: w.x, y: w.y, tiles: play.dept.tiles.slice() });
      }
      const want = [];
      for (const [x, y] of standable(s)) if (seenFrom.some(p => Grid.disc(x - p.x, y - p.y, N.SIGHT_EXHIBIT) && Grid.los({ w: s.dept.w, h: s.dept.h, tiles: p.tiles, surfaces: [] }, p.x, p.y, x, y))) want.push([x, y]);
      want.sort((p, q) => p[1] - q[1] || p[0] - q[0]);
      assert.equal(json(region), json(want), `depth ${depth}, ${turns} turns`);
      if (turns === N.SAFE_ZONE_TURNS) {
        assert.ok(region.some(([x]) => x < 8), 'over its first turns it sees into the room beyond the door');
        assert.ok(seenFrom.some(p => p.x < 8), 'and walks there');
      }
    }
  });

  test('standing on a tile of its wake region over 20 turns, you are seen by then; on any other tile of its rooms you are not', () => {
    for (const depth of [2, 6]) {
      const region = Archetypes.wakeRegion(wrRoom(depth), wader(wrRoom(depth)), N.SAFE_ZONE_TURNS), inside = new Set(region.map(t => t.join(',')));
      for (const t of standable(wrRoom(depth))) {
        if (t[0] > 23) continue;
        const s = wrRoom(depth, t), a = wader(s);
        // Seen at one of its actions up to SAFE_ZONE_TURNS turns from now: you wait one turn more.
        const r = H.play(C, s, waits(N.SAFE_ZONE_TURNS + 1), { inv: [] });
        const seen = r.events.some(e => e.k === 'hunting' && e.who === a.uid && e.tick <= N.SAFE_ZONE_TURNS * N.TICKS_PER_TURN);
        assert.equal(seen, inside.has(t.join(',')), `depth ${depth}: standing on ${t}, seen ${seen}, in its region ${inside.has(t.join(','))}`);
      }
    }
  });

  test('a Wader hunting you has no wake region, nor one that is gone; searching or sent to look, its region is the sight from anywhere it has the time to walk to', () => {
    const s = wrRoom(3), a = wader(s), round = Archetypes.wakeRegion(s, a, 10), has = (R, t) => R.some(u => u[0] === t[0] && u[1] === t[1]);
    assert.ok(round.length > 0);
    a.target = WR_POSTS[0].slice();
    assert.equal(json(Archetypes.wakeRegion(s, a, 10)), json(round), 'its next post is its round');
    // Off its round it may come back to it, or walk anywhere else first: every tile it could
    // walk to in the time is a tile it may look from, so its region holds its round's and more.
    for (const b of [Object.assign({}, a, { target: [3, 3] }), Object.assign({}, a, { mode: 'searching', target: null, lastKnown: [3, 3] })]) {
      const R = Archetypes.wakeRegion(s, b, 10);
      assert.ok(round.every(t => has(R, t)) && R.length > round.length, `${b.mode} ${json(b.target)}: ${R.length} tiles, its round's ${round.length}`);
      // In 10 turns it could be through the door (4 steps away) and in the room beyond, which
      // its round does not reach by then; the pocket you stand in it never sees.
      assert.ok(has(R, [1, 1]) && !has(round, [1, 1]) && !R.some(t => t[0] === 25), `${b.mode}: ${json(R.filter(t => t[0] < 2 || t[0] > 23))}`);
    }
    assert.equal(json(Archetypes.wakeRegion(s, Object.assign({}, a, { mode: 'hunting', target: null }), 10)), '[]', 'hunting');
    assert.equal(json(Archetypes.wakeRegion(s, Object.assign({}, a, { gone: 1, target: null }), 10)), '[]');
  });

  // Where its walk cannot be told from the state, its region is the sight from anywhere it has
  // the time to walk to, as while it searches: with another exhibit awake on no round (it may
  // stand anywhere in its way), or a door on its round within the earshot of another exhibit
  // (whose noise would stir it, and might wake it). A sleeper out of earshot changes nothing.
  test('where its walk cannot be told (another exhibit awake on no round, a door on its round within another\'s earshot), its region is the sight from anywhere it has the time to walk to', () => {
    const T = N.SAFE_ZONE_TURNS, with_ = more => { const s = wrRoom(3); for (const e of more) s.actors.push(Object.assign(JSON.parse(json(s.actors[1])), e)); return s; };
    const plain = wrRoom(3), a = wader(plain), round = json(Archetypes.wakeRegion(plain, a, T));
    const anywhere = json(Archetypes.wakeRegion(plain, Object.assign({}, a, { mode: 'searching', target: null, lastKnown: [12, 2] }), T));
    assert.notEqual(round, anywhere);
    const dummy = (at, mode) => ({ uid: 'S9.3.room.9', sp: 'dummy', arch: 'plodder', trigger: null, mode, x: at[0], y: at[1], home: at.slice(), route: null, target: null, telegraph: null, pips: 0 });
    // A sleeper by the door it opens (8, 3), within its earshot; and one out of it.
    assert.equal(json(Archetypes.wakeRegion(with_([dummy([7, 3], 'dormant')]), a, T)), anywhere, 'a sleeper within earshot of its door');
    assert.equal(json(Archetypes.wakeRegion(with_([dummy([14, 1], 'dormant')]), a, T)), round, 'a sleeper out of earshot');
    // An exhibit awake on no round, anywhere.
    assert.equal(json(Archetypes.wakeRegion(with_([dummy([22, 5], 'awake')]), a, T)), anywhere, 'an exhibit awake');
  });

  // ---- Whatever stands in its way, its wake region holds all it sees ----
  // What a Wader actually sees over `turns` turns, played joined up with you never seen (sight
  // of you switched off, in a core of its own): every tile you could stand on (as at the start,
  // not its own tile then) within SIGHT_EXHIBIT of where it stands at each of its actions, in
  // line of sight on the map as it is then. Also the tiles it stood on.
  let unseen = null;
  function seenOver(s, uid, turns) {
    if (!unseen) { unseen = loadCore(); unseen.AI.sees = () => false; }
    const X = unseen, play = X.State.clone(s), from = [], act = X.AI.act, until = s.tick + turns * N.TICKS_PER_TURN;
    X.AI.act = (st, b, ev) => { if (b.uid === uid && st.tick <= until) from.push({ x: b.x, y: b.y, tiles: st.dept.tiles.slice() }); return act(st, b, ev); };
    try { for (let t = 0; t <= turns && !play.over; t++) X.Step.step(play, { a: 'wait' }); } finally { X.AI.act = act; }
    const a = s.actors.find(b => b.uid === uid), m = s.dept, out = new Set();
    for (const p of from) for (let y = Math.max(0, p.y - N.SIGHT_EXHIBIT); y <= Math.min(m.h - 1, p.y + N.SIGHT_EXHIBIT); y++) for (let x = Math.max(0, p.x - N.SIGHT_EXHIBIT); x <= Math.min(m.w - 1, p.x + N.SIGHT_EXHIBIT); x++) {
      if (!Grid.disc(x - p.x, y - p.y, N.SIGHT_EXHIBIT) || (x === a.x && y === a.y) || !Grid.walkable(m, x, y) || Grid.closedDoor(m, x, y)) continue;
      if (Grid.los({ w: m.w, h: m.h, tiles: p.tiles, surfaces: [] }, p.x, p.y, x, y)) out.add(x + ',' + y);
    }
    return { seen: out, stood: from.map(p => p.x + ',' + p.y) };
  }
  const regionOf = (s, a, turns) => new Set(Archetypes.wakeRegion(s, a, turns).map(t => t.join(',')));
  const outside = (seen, R) => [...seen].filter(k => !R.has(k));

  // A long room, its round along the top row, and a passage going down from (6, 3) to (6, 10):
  // only from (6, 2) is its far end, (6, 10), within its sight (8 tiles).
  const PASS = ['######################', '#....................#', '#....................#'].concat(Array.from({ length: 8 }, () => '######.###############'), ['######################']);
  const passRoom = (depth, exhibits, rounds) => {
    const s = Setup.room(depth, { acc: 'S9', depth, map: PASS, you: [20, 2], exhibits }, { rulesOff: [] });
    s.actors.filter(b => b.arch === 'patrol_guard').forEach((b, k) => { b.route = JSON.parse(json(rounds[k])); Wake.created(s, b, 'patrol', {}, null); });
    C.Modules.init(s, C.Packs.get('S9'));
    return s;
  };
  test('a sleeper in its way: it steps round it, and its wake region holds what it sees from there, and nothing more', () => {
    for (let depth = 1; depth <= 7; depth++) {
      const s = passRoom(depth, [{ sp: 'S9.2', at: [1, 1], stats: Roles.stats('warden', depth) }, { sp: 'dummy', at: [6, 1], mode: 'dormant', stats: tough }], [{ posts: [[1, 1], [19, 1]], i: 1 }]);
      const a = wader(s), R = regionOf(s, a, N.SAFE_ZONE_TURNS), { seen, stood } = seenOver(s, a.uid, N.SAFE_ZONE_TURNS);
      assert.ok(stood.includes('6,2') && !stood.includes('6,1'), `depth ${depth}: it stood on ${stood.join(' ')}`);
      assert.ok(seen.has('6,10') && R.has('6,10'), `depth ${depth}: (6, 10) seen from (6, 2)`);
      assert.deepEqual(outside(seen, R), [], `depth ${depth}: tiles it saw outside its region`);
      assert.deepEqual(outside(R, seen), [], `depth ${depth}: with only sleepers in its way, its region is exactly what it sees`);
    }
  });
  test('its post taken by a sleeper: it turns back from beside it, and its wake region holds what it sees on the way back', () => {
    for (let depth = 1; depth <= 7; depth++) {
      // Back from (11, 1) along the second row, it passes (6, 2), from which (6, 10) is in sight.
      const s = passRoom(depth, [{ sp: 'S9.2', at: [3, 1], stats: Roles.stats('warden', depth) }, { sp: 'dummy', at: [12, 1], mode: 'dormant', stats: tough }], [{ posts: [[3, 1], [12, 1]], i: 1 }]);
      const a = wader(s), R = regionOf(s, a, N.SAFE_ZONE_TURNS), { seen, stood } = seenOver(s, a.uid, N.SAFE_ZONE_TURNS);
      assert.ok(stood.includes('11,1') && !stood.includes('12,1') && stood.includes('6,2'), `depth ${depth}: it stood on ${stood.join(' ')}`);
      assert.ok(R.has('6,10'), `depth ${depth}: (6, 10), seen on the way back`);
      assert.deepEqual([outside(seen, R), outside(R, seen)], [[], []], `depth ${depth}`);
    }
  });
  test('another patrol in its way: its wake region holds what it sees, stepping round the other on its post', () => {
    for (let depth = 1; depth <= 7; depth++) {
      // The other Wader reaches its post (6, 1) as the first comes to step onto it.
      const s = passRoom(depth, [{ sp: 'S9.2', at: [1, 1], stats: Roles.stats('warden', depth) }, { sp: 'S9.2', at: [6, 5], stats: Roles.stats('warden', depth) }],
        [{ posts: [[1, 1], [19, 1]], i: 1 }, { posts: [[6, 1], [6, 9]], i: 0 }]);
      for (const a of s.actors.filter(b => b.arch === 'patrol_guard')) {
        const R = regionOf(s, a, N.SAFE_ZONE_TURNS), { seen, stood } = seenOver(s, a.uid, N.SAFE_ZONE_TURNS);
        if (a === s.actors[1]) assert.ok(stood.includes('6,2') && seen.has('6,10') && R.has('6,10'), `depth ${depth}: it stepped round the other (${stood.join(' ')})`);
        assert.deepEqual(outside(seen, R), [], `depth ${depth}, ${a.uid}: tiles it saw outside its region`);
      }
    }
  });

  // S.9 with a gallery list (fixture galleries, as D-PACKS will give it; the Grazers left out
  // until their archetype is built), Waders placed by population among sleepers.
  const GALLERIES = [
    { key: 'intro', name: 'The Lamp Corridor', contents: [] },
    { key: 's1', where: 'central', name: 'The Mount Court', contents: [{ sp: 'S9.2' }, { sp: 'S9.3' }, { sp: 'S9.6', count: 2 }] },
    { key: 's2', where: 'band', name: 'The Brooders\' Bay', contents: [{ sp: 'S9.4', guards: 'case' }, { sp: 'S9.5', near: 'case' }, { sp: 'S9.2' }] },
    { key: 'last', name: 'The Round-Book Room', contents: [{ sp: 'S9.6' }] },
    { key: 'centre', name: 'The Day Curator\'s Case', contents: [] },
    { key: 'coda', name: 'The Night Staff\'s Tea Room', contents: [] },
  ];
  test('in S.9 departments, each Wader\'s wake region over SAFE_ZONE_TURNS holds every tile it sees, played joined up with you unseen; alone, exactly those', () => {
    const X = loadCore();
    X.Packs.get('S9').galleries = JSON.parse(json(GALLERIES));
    let waders = 0;
    for (let seed = 1; seed <= 16; seed++) {
      const s = X.Dept.create(seed, 'S9', 1 + ((seed - 1) % 7)), ws = s.actors.filter(b => b.arch === 'patrol_guard' && !b.gone);
      for (const a of ws) {
        waders++;
        const R = regionOf(s, a, N.SAFE_ZONE_TURNS), { seen } = seenOver(s, a.uid, N.SAFE_ZONE_TURNS);
        assert.deepEqual(outside(seen, R), [], `seed ${seed}, ${a.uid}: tiles it saw outside its region`);
        // With the other patrols gone, nothing but sleepers stands in its way: exactly what it sees.
        const alone = State.clone(s);
        for (const b of alone.actors) if (b.arch === 'patrol_guard' && b.uid !== a.uid) b.gone = 1;
        const Ra = regionOf(alone, alone.actors.find(b => b.uid === a.uid), N.SAFE_ZONE_TURNS), sa = seenOver(alone, a.uid, N.SAFE_ZONE_TURNS).seen;
        assert.deepEqual([outside(sa, Ra), outside(Ra, sa)], [[], []], `seed ${seed}, ${a.uid} alone`);
      }
    }
    assert.ok(waders >= 24, `${waders} Waders`);
  });
};
