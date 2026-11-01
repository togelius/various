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

  test('its wake region is its round\'s sight: the tiles it would see from where it walks over the next turns, through the door once it opens it', () => {
    for (const depth of [1, 4, 7]) for (const turns of [0, 5, N.SAFE_ZONE_TURNS]) {
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

  test('a Wader hunting, searching or sent to look at a noise has no wake region; nor one that is gone', () => {
    const s = wrRoom(3), a = wader(s);
    assert.ok(Archetypes.wakeRegion(s, a, 10).length > 0);
    a.target = [3, 3];
    assert.equal(json(Archetypes.wakeRegion(s, a, 10)), '[]');
    a.target = WR_POSTS[0].slice();
    assert.ok(Archetypes.wakeRegion(s, a, 10).length > 0, 'its next post is its round');
    for (const mode of ['hunting', 'searching']) { const b = Object.assign({}, a, { mode, target: null }); assert.equal(json(Archetypes.wakeRegion(s, b, 10)), '[]', mode); }
    assert.equal(json(Archetypes.wakeRegion(s, Object.assign({}, a, { gone: 1, target: null }), 10)), '[]');
  });
};
