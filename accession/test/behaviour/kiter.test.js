// The kiter's Behaviour-line clause (BUILD.md §5.3, §5.5, §8.1): "Keeps {KITER_HOLD0} to
// {KITER_HOLD1} tiles from you and shoots within {ROLE_ARTILLERY_RANGE} tiles for {dmg}; its
// shots hit the first body in their way and stop at glass; backs away when you are beside
// it." "Within r" is the disc of §8.2, as for sight and every instrument. Each scenario is a
// function of the clause's parameters, run for every species whose line has it (the Signal
// Lamps), at every depth 1–7, with every invariant checked after every step and a clone
// check; and the shot itself (Ranged.shoot, Ranged.flight) is checked against BUILD.md's
// rules on small maps.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const C = loadCore();
  const { Setup, Roles, Ranged, State, Causes, N } = C;
  const json = x => JSON.stringify(x);
  const accOf = sp => C.Packs.list().find(p => p.species.includes(sp)).acc;
  const range = d => { const [lo, hi] = String(d).split('–').map(Number); return [lo, hi === undefined ? lo : hi]; };
  const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
  const waits = n => Array.from({ length: n }, () => ({ a: 'wait' }));
  // A room 17 wide and 9 high, open, unless rows are given.
  const OPEN = ['#################', ...Array.from({ length: 7 }, () => '#...............#'), '#################'];
  // You are kept alive (invulnerable), so that every step is played.
  const room = (sp, depth, opts, map, you, exhibits) => Setup.room(opts.seed, { acc: accOf(sp), depth, map, you, exhibits }, { rulesOff: opts.rulesOff, invulnerable: true });
  const kiter = (sp, depth, at, extra) => Object.assign({ sp: sp.id, at, mode: 'hunting', stats: Roles.stats(sp.role, depth) }, extra || {});
  // Where an actor stood before each step and after the last, rebuilt from the run's start
  // and its moved events.
  function track(r, uid) {
    const a = r.start.actors.find(x => x.uid === uid);
    let p = [a.x, a.y];
    const out = [p];
    for (const s of r.steps) { for (const e of s.events) if (e.k === 'moved' && e.who === uid) p = e.to; out.push(p); }
    return out;
  }
  // The posts BUILD.md §8.1 gives a kiter k: tiles an exhibit could stand on, with no actor
  // on them, KITER_HOLD steps from you by walking, with a clear shot at you (you within
  // ROLE_ARTILLERY_RANGE, the disc dx² + dy² ≤ r² + r; in line of sight; the first body on
  // the bolt's line); each with d, its distance from k by a way that never comes nearer than
  // KITER_HOLD0 steps to you, and w, its walking distance from you. In row-major order.
  function posts(s, k) {
    const m = s.dept, you = s.actors[0], [lo, hi] = N.KITER_HOLD, R = N.ROLE_ARTILLERY_RANGE, far = m.w * m.h;
    const fromYou = C.Grid.distances(m, [[you.x, you.y]], far, null, 'exhibit');
    const fromK = C.Grid.distances(m, [[k.x, k.y]], far, (x, y) => { const w = fromYou[y * m.w + x]; return w >= 0 && w < lo ? far + 1 : 0; }, 'exhibit');
    const out = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const i = y * m.w + x, w = fromYou[i], dx = you.x - x, dy = you.y - y;
      if (!C.Grid.walkable(m, x, y, 'exhibit') || w < lo || w > hi || fromK[i] < 0 || C.Actors.at(s, x, y, k)) continue;
      if (dx * dx + dy * dy > R * R + R || !C.Grid.los(m, x, y, you.x, you.y)) continue;
      let first = null;
      for (const [tx, ty] of Ranged.bresenham(x, y, you.x, you.y).slice(1)) {
        if (!C.Grid.bolt(m, tx, ty)) { first = 'glass'; break; }
        const b = C.Actors.at(s, tx, ty, k);
        if (b) { first = b.uid; break; }
      }
      if (first === 'you') out.push({ x, y, d: fromK[i], w });
    }
    return out;
  }
  const shotsBy = (r, uid) => r.steps.map((s, i) => ({ i, e: s.events.filter(e => e.k === 'attacked' && e.by === uid) })).filter(x => x.e.length);
  const sweep = sc => {
    const res = H.sweep(C, sc);
    assert.ok(res.length >= 7, `${sc.name}: ${res.length} runs`);
    assert.deepEqual(H.failures(res), []);
    return res;
  };

  test('the kiter\'s clause is on the Signal Lamps, at every depth', () => {
    const list = H.species(C, 'kiter');
    assert.ok(list.length >= 7 && list.every(x => x.sp.archetype === 'kiter'), json(list.map(x => x.sp.id)));
    assert.equal(C.Registry.ARCHETYPES.kiter.ready, true);
    const line = C.Clauses.line(list[0].sp, { depth: 3 });
    assert.ok(line.includes(`Keeps ${N.KITER_HOLD[0]} to ${N.KITER_HOLD[1]} tiles from you and shoots within ${N.ROLE_ARTILLERY_RANGE} tiles`), line);
  });

  test('from its band it shoots you for its damage, and stays there', () => sweep(H.scenario({
    name: 'a kiter KITER_HOLD1 tiles away shoots you for dmg and holds its ground', id: 'kiter', clone: true, seeds: [1, 2],
    build: (params, sp, depth, opts) => room(sp, depth, opts, OPEN, [2, 4], [kiter(sp, depth, [2 + params.KITER_HOLD1, 4])]),
    actions: waits(8),
    expect(r, params) {
      const [lo, hi] = range(params.dmg), uid = r.start.actors[1].uid, me = track(r, uid), you = track(r, 'you');
      const shots = shotsBy(r, uid);
      if (shots.length < 6) return `it shot ${shots.length} times in 8 turns`;
      for (let i = 0; i < me.length; i++) { const d = cheb(me[i], you[i]); if (d < params.KITER_HOLD0 || d > params.KITER_HOLD1) return `it stood ${d} tiles from you before step ${i}`; }
      const hits = r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.by === uid);
      for (const e of hits) {
        if (e.cause.k !== 'shot' || e.cause.range > params.ROLE_ARTILLERY_RANGE) return `a hit's cause is ${json(e.cause)}`;
        if (e.cause.raw < lo || e.cause.raw > hi) return `a shot rolled ${e.cause.raw}, outside ${params.dmg}`;
        if (e.amount !== Math.max(N.DMG_MIN_ON_HIT, e.cause.raw - e.cause.pad)) return `a shot of ${e.cause.raw} through Padding ${e.cause.pad} dealt ${e.amount}`;
      }
      return hits.length ? null : 'it never hit';
    },
  })));

  test('beside you it backs away, and shoots once it is KITER_HOLD0 tiles off', () => sweep(H.scenario({
    name: 'a kiter beside you backs away to KITER_HOLD0, then shoots', id: 'kiter', clone: true, seeds: [1, 2],
    build: (params, sp, depth, opts) => room(sp, depth, opts, OPEN, [6, 4], [kiter(sp, depth, [7, 4])]),
    actions: waits(6),
    expect(r, params) {
      const uid = r.start.actors[1].uid, me = track(r, uid), you = track(r, 'you'), shots = shotsBy(r, uid);
      if (!(cheb(me[1], you[1]) > 1) || shotsBy(r, uid).some(s => s.i === 0)) return 'beside you, its first action was not to back away';
      if (!shots.length) return 'it never shot';
      const first = shots[0].i, d = cheb(me[first], you[first]);
      if (d < params.KITER_HOLD0) return `it shot from ${d} tiles, nearer than ${params.KITER_HOLD0}, with room to back away`;
      for (let i = 1; i < first; i++) if (!(cheb(me[i + 1], you[i + 1]) > cheb(me[i], you[i]))) return `step ${i}: nearer than ${params.KITER_HOLD0}, it did not back away`;
      return null;
    },
  })));

  test('farther than its band, it comes nearer before it shoots', () => sweep(H.scenario({
    name: 'a kiter KITER_HOLD1 + 3 tiles away walks into its band, then shoots', id: 'kiter', clone: true,
    build: (params, sp, depth, opts) => room(sp, depth, opts, OPEN, [2, 4], [kiter(sp, depth, [2 + params.KITER_HOLD1 + 3, 4])]),
    actions: waits(8),
    expect(r, params) {
      const uid = r.start.actors[1].uid, me = track(r, uid), you = track(r, 'you'), shots = shotsBy(r, uid);
      if (!shots.length) return 'it never shot';
      for (const s of shots) { const d = cheb(me[s.i], you[s.i]); if (d > params.KITER_HOLD1 || d < params.KITER_HOLD0) return `it shot from ${d} tiles, outside ${params.KITER_HOLD0}–${params.KITER_HOLD1}`; }
      return shots[0].i === 3 ? null : `it first shot at step ${shots[0].i}, not after its 3 steps in`;
    },
  })));

  // Across a balustrade (seen through, not walked over) the kiter cannot walk to you, so its
  // band is out of reach: it shoots from ROLE_ARTILLERY_RANGE tiles along and 2 across, within
  // the range disc, and never from one tile farther.
  const GALLERY = R => ['#'.repeat(R + 6), '#' + '.'.repeat(R + 4) + '#', '#' + '~'.repeat(R + 4) + '#', '#' + '.'.repeat(R + 4) + '#', '#'.repeat(R + 6)];
  test('it shoots from ROLE_ARTILLERY_RANGE tiles along and 2 across, and never from farther', () => {
    for (const extra of [0, 1]) sweep(H.scenario({
      name: `a kiter that cannot walk to you, ROLE_ARTILLERY_RANGE + ${extra} tiles away, ${extra ? 'never shoots' : 'shoots'}`, id: 'kiter', clone: true,
      build: (params, sp, depth, opts) => {
        // You at the west end of the far walk; the kiter R (or R + 1) tiles east on the near one.
        const R = params.ROLE_ARTILLERY_RANGE;
        return room(sp, depth, opts, GALLERY(R), [1, 3], [kiter(sp, depth, [1 + R + extra, 1])]);
      },
      actions: waits(6),
      expect(r, params) {
        const uid = r.start.actors[1].uid, shots = shotsBy(r, uid), me = track(r, uid), you = track(r, 'you');
        if (me.some((p, i) => p[0] !== me[0][0] || p[1] !== me[0][1]) && extra === 0) return 'with a shot in range it moved';
        for (const s of shots) if (cheb(me[s.i], you[s.i]) > params.ROLE_ARTILLERY_RANGE) return `it shot from ${cheb(me[s.i], you[s.i])} tiles`;
        if (extra === 0 && shots.length < 5) return `in range, it shot ${shots.length} times in 6 turns`;
        if (extra === 1 && shots.length) return 'out of range, it shot';
        return null;
      },
    }));
  });

  test('its shots stop at glass: behind a glass wall it never hits you', () => sweep(H.scenario({
    name: 'a kiter that sees you through glass, and cannot walk round it, never shoots', id: 'kiter', clone: true,
    build: (params, sp, depth, opts) => room(sp, depth, opts, ['#########', '#.......#', '#vvvvvvv#', '#.......#', '#########'], [2, 3], [kiter(sp, depth, [2 + params.KITER_HOLD0, 1])]),
    actions: waits(6),
    expect(r) {
      const uid = r.start.actors[1].uid, k = r.start.actors[1], you = r.start.actors[0];
      if (Ranged.canShoot(r.start, k, you.x, you.y, {}) !== 'behind_glass') return `a shot through the glass was not refused as behind_glass: ${Ranged.canShoot(r.start, k, you.x, you.y, {})}`;
      if (!C.AI.sees(r.start, k)) return 'it does not see you through the glass';
      if (shotsBy(r, uid).length) return 'it shot into the glass';
      return r.events.some(e => e.k === 'damaged' && e.who === 'you') ? 'you were hurt' : null;
    },
  })));

  test('with a case on its line to you, it steps to a tile with a clear shot, and shoots', () => sweep(H.scenario({
    name: 'a kiter in its band with a case between it and you moves round the case\'s line, then shoots', id: 'kiter', clone: true, seeds: [1, 2],
    build: (params, sp, depth, opts) => { const map = OPEN.slice(); map[4] = '#...v...........#'; return room(sp, depth, opts, map, [2, 4], [kiter(sp, depth, [2 + params.KITER_HOLD0 + 1, 4])]); },
    actions: waits(4),
    expect(r) {
      const uid = r.start.actors[1].uid, shots = shotsBy(r, uid), me = track(r, uid);
      if (!shots.length) return 'it never shot';
      if (me[1][0] === me[0][0] && me[1][1] === me[0][1]) return 'with the case in its way it did not move';
      return r.events.some(e => e.k === 'damaged' && e.who === 'you' && e.cause.by === uid) || r.events.some(e => e.k === 'missed' && e.by === uid) ? null : 'its shot did not reach you';
    },
  })));

  test('its shots hit the first body in their way: it never shoots through another exhibit', () => sweep(H.scenario({
    name: 'a kiter with an exhibit between it and you in a corridor never shoots it', id: 'kiter', clone: true,
    build: (params, sp, depth, opts) => room(sp, depth, opts, ['###########', '#.........#', '###########'], [1, 1],
      [kiter(sp, depth, [1 + params.KITER_HOLD0 + 1, 1]), { sp: 'arch_b_block', arch: 'plodder', at: [3, 1], mode: 'dormant', stats: Object.assign(Roles.stats('fodder', depth), { hp: 999 }) }]),
    actions: waits(6),
    expect(r) {
      const uid = r.start.actors[1].uid, block = r.start.actors[2].uid;
      if (shotsBy(r, uid).length) return 'it shot with an exhibit in its way';
      return r.events.some(e => e.k === 'damaged' && e.who === block) ? 'the exhibit in its way was hit' : null;
    },
  })));

  // Within r is a disc (§8.2): a tile ROLE_ARTILLERY_RANGE along one axis and k along the
  // other, with k the least that puts it outside the disc, is out of range though it is no
  // farther along either axis; a tile one nearer along the first is in. Across a balustrade
  // the kiter cannot walk to you, so it shoots from where it stands or not at all.
  const offDisc = R => { let k = 1; while (R * R + k * k <= R * R + R) k++; return k; };
  test('it shoots within ROLE_ARTILLERY_RANGE tiles, a disc: never from a tile outside it, however near along each axis', () => {
    for (const inside of [true, false]) sweep(H.scenario({
      name: `a kiter that cannot walk to you, ${inside ? 'inside' : 'just outside'} the ROLE_ARTILLERY_RANGE disc, ${inside ? 'shoots' : 'never shoots'}`, id: 'kiter', clone: true,
      build: (params, sp, depth, opts) => {
        const R = params.ROLE_ARTILLERY_RANGE, k = offDisc(R), w = R + 3;
        const map = ['#'.repeat(w), '#' + '.'.repeat(w - 2) + '#', '#' + '~'.repeat(w - 2) + '#', ...Array.from({ length: k }, () => '#' + '.'.repeat(w - 2) + '#'), '#'.repeat(w)];
        return room(sp, depth, opts, map, [1, 1], [kiter(sp, depth, [1 + R - (inside ? 1 : 0), 1 + k])]);
      },
      actions: waits(6),
      expect(r, params) {
        const R = params.ROLE_ARTILLERY_RANGE, k = r.start.actors[1], you = r.start.actors[0], dx = k.x - you.x, dy = k.y - you.y, shots = shotsBy(r, k.uid);
        if (Math.max(Math.abs(dx), Math.abs(dy)) > R) return `the kiter stands ${dx},${dy} from you, farther than ${R} along an axis`;
        if (!C.AI.sees(r.start, k)) return 'it does not see you';
        if (inside) return shots.length >= 5 ? null : `inside the disc it shot ${shots.length} times in 6 turns`;
        return shots.length ? `it shot from ${dx},${dy}, outside the disc of ${R} (${dx * dx + dy * dy} > ${R * R + R})` : null;
      },
    }));
  });

  // A tile KITER_HOLD1 steps off along both axes is in its band but outside the range disc,
  // so it is no post: a kiter KITER_HOLD1 + 1 off along both walks on past it to a post
  // within range, and shoots from there.
  test('a post is within range by the disc: from a tile in its band but out of range it does not stop, it walks on to shoot', () => sweep(H.scenario({
    name: 'a kiter KITER_HOLD1 + 1 tiles off along both axes walks to a post within range, not to the nearer tile out of range, and shoots', id: 'kiter', clone: true,
    build: (params, sp, depth, opts) => room(sp, depth, opts, OPEN, [1, 1], [kiter(sp, depth, [2 + params.KITER_HOLD1, 2 + params.KITER_HOLD1])]),
    actions: waits(5),
    expect(r, params) {
      const R = params.ROLE_ARTILLERY_RANGE, h = params.KITER_HOLD1, uid = r.start.actors[1].uid, me = track(r, uid), shots = shotsBy(r, uid);
      if (h * h * 2 <= R * R + R) return `a tile ${h} off along both axes is within range here; the scenario shows nothing`;
      if (!shots.length) return `it never shot (it stood at ${json(me)})`;
      const at = me[shots[0].i], dx = at[0] - 1, dy = at[1] - 1;
      return dx * dx + dy * dy <= R * R + R ? null : `it shot from ${at}, outside the range disc`;
    },
  })));

  test('in its band with no shot and nowhere to shoot from, it waits there: it never comes nearer than KITER_HOLD0', () => sweep(H.scenario({
    name: 'a kiter in a corridor with an exhibit between it and you keeps KITER_HOLD0 steps or more from you and never shoots', id: 'kiter', clone: true,
    build: (params, sp, depth, opts) => room(sp, depth, opts, ['###########', '#.........#', '###########'], [1, 1],
      [kiter(sp, depth, [1 + params.KITER_HOLD0 + 1, 1]), { sp: 'arch_b_block', arch: 'plodder', at: [3, 1], mode: 'dormant', stats: Object.assign(Roles.stats('fodder', depth), { hp: 999 }) }]),
    actions: waits(10),
    expect(r, params) {
      const uid = r.start.actors[1].uid, me = track(r, uid), you = track(r, 'you');
      for (let i = 0; i < me.length; i++) if (me[i][0] - you[i][0] < params.KITER_HOLD0) return `before step ${i} it stood ${me[i][0] - you[i][0]} steps from you, nearer than ${params.KITER_HOLD0}`;
      return shotsBy(r, uid).length ? 'it shot with an exhibit in its way' : null;
    },
  })));

  test('in its band with no clear shot, it steps to the nearest post (ties in row-major order), not toward you, and shoots from there', () => sweep(H.scenario({
    name: 'a kiter KITER_HOLD0 steps off with a case on its line steps sideways onto the first of its nearest posts, then shoots', id: 'kiter', clone: true, seeds: [1, 2],
    build: (params, sp, depth, opts) => { const map = OPEN.slice(); map[4] = '#...v...........#'; return room(sp, depth, opts, map, [2, 4], [kiter(sp, depth, [2 + params.KITER_HOLD0, 4])]); },
    actions: waits(3),
    expect(r, params) {
      const k = r.start.actors[1], ps = posts(r.start, k), best = Math.min(...ps.map(p => p.d)), near = ps.filter(p => p.d === best), want = near[0];
      // The map must make this a test of the choice: two or more posts one step off, the
      // first of them no nearer you than the kiter is (a step toward you is not one).
      if (best !== 1 || near.length < 2 || want.w < params.KITER_HOLD0) return `the map gives the posts ${json(ps)}`;
      const me = track(r, k.uid), shots = shotsBy(r, k.uid);
      if (me[1][0] !== want.x || me[1][1] !== want.y) return `it stepped to ${me[1]}, not to ${want.x},${want.y}, the first of its nearest posts ${json(near.map(p => [p.x, p.y]))}`;
      return shots.length && shots[0].i === 1 ? null : `it did not shoot from the post at its next action (${json(shots.map(x => x.i))})`;
    },
  })));

  // Its way to a post keeps KITER_HOLD0 steps or more from you. Here a case south of you
  // blocks its line, and the post nearest it by any way (8,5) can be walked to only past
  // 7,5, two steps from you, since a step never cuts a case's corner; so it goes round by
  // 7,7 to the post at 8,7 instead.
  const ROUND = ['#############', '#...........#', '#...........#', '#...........#', '#.......#...#', '#.....v.....#', '#.......v...#', '#...........#', '#############'];
  test('on its way to a post it never comes nearer than KITER_HOLD0 steps to you', () => sweep(H.scenario({
    name: 'a kiter KITER_HOLD0 steps off with a case on its line walks round to a post, keeping its distance, then shoots', id: 'kiter', clone: true, seeds: [1, 2],
    build: (params, sp, depth, opts) => room(sp, depth, opts, ROUND, [6, 4], [kiter(sp, depth, [7, 6])]),
    actions: waits(4),
    expect(r, params) {
      const k = r.start.actors[1], m = r.start.dept, walk = C.Grid.distances(m, [[6, 4]], m.w * m.h, null, 'exhibit'), me = track(r, k.uid);
      if (walk[k.y * m.w + k.x] !== params.KITER_HOLD0) return `the kiter starts ${walk[k.y * m.w + k.x]} steps from you, not ${params.KITER_HOLD0}`;
      for (let i = 0; i < me.length; i++) { const w = walk[me[i][1] * m.w + me[i][0]]; if (w < params.KITER_HOLD0) return `before step ${i} it stood at ${me[i]}, ${w} steps from you`; }
      const shots = shotsBy(r, k.uid);
      if (!shots.length) return 'it never shot';
      const at = me[shots[0].i];
      return at[0] === 8 && at[1] === 7 ? null : `it first shot from ${at}, not from the post at 8,7`;
    },
  })));

  // The shot itself, on small maps, against BUILD.md §8.1 and §8.3.
  const tough = { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 2, dmax: 5 };
  const ex = (at, extra) => Object.assign({ sp: 'arch_b_target', at, mode: 'hunting', stats: tough }, extra || {});
  const plain = (map, you, exhibits, options) => Setup.room(1, { acc: 'T0', depth: 1, map, you, exhibits }, options);

  test('Ranged.flight refuses as a shot would, in order, and stops at glass whatever stands behind it', () => {
    const map = ['##########', '#........#', '#..v.....#', '#.#......#', '#........#', '##########'];
    const s = plain(map, [1, 2], [ex([6, 2]), ex([3, 2], { mode: 'dormant' }), ex([8, 4])]), [you, behind, encased, far] = s.actors;
    const code = (x, y, r) => Ranged.flight(s, you, x, y, r).code;
    assert.equal(code(1, 2, 9), 'no_target', 'your own tile');
    assert.equal(code(-1, 2, 9), 'no_target', 'off the map');
    assert.equal(code(8, 4, 5), 'out_of_reach', 'seven tiles off, past a range of 5');
    assert.equal(json([code(8, 4, 6), code(8, 4, 7)]), json(['out_of_reach', null]), 'a range of 6 falls one short; 7 reaches');
    assert.equal(code(6, 2, 9), 'behind_glass', 'the case at 3,2 is in the way');
    assert.equal(code(3, 2, 9), 'behind_glass', 'an exhibit in a case looks as an empty case does');
    assert.equal(code(3, 4, 9), 'blocked', 'no line of sight past the wall at 2,3');
    assert.equal(code(5, 4, 9), 'no_target', 'nothing there');
    assert.equal(code(0, 2, 9), 'no_target', 'a wall');
    assert.equal(Ranged.flight(s, encased, 5, 2, 9).code, 'behind_glass', 'nothing shoots out of a case');
    const ok = Ranged.flight(s, you, 8, 4, 9);
    assert.equal(json([ok.code, ok.victim, ok.reflector, ok.dist, ok.via, ok.tiles.length]), json([null, far.uid, null, 7, [7, 4], 7]));
    // A refusal changes nothing.
    const h = State.hash(s);
    assert.equal(Ranged.shoot(s, you, 8, 4, { kind: 'shot', item: 'pd', dmin: 1, dmax: 2 }, []), 'out_of_reach', 'the Pin-Driver reaches PIN_DRIVER[2] tiles');
    assert.equal(Ranged.shoot(s, you, 6, 2, { kind: 'shot' }, []), 'behind_glass');
    assert.equal(State.hash(s), h);
    assert.equal(json([Ranged.maxRange(you, {}), Ranged.maxRange(behind, {}), Ranged.maxRange(behind, { max: 2 })]), json([N.PIN_DRIVER[2], N.ROLE_ARTILLERY_RANGE, 2]));
    assert.throws(() => Ranged.shoot(s, Object.assign({}, far, { gone: 1 }), 1, 2, { kind: 'shot' }, []), /not there to shoot/);
    // Within range is the disc of §8.2, dx² + dy² ≤ r² + r, not the larger of the distances.
    const o = plain(['############', ...Array.from({ length: 6 }, () => '#..........#'), '############'], [1, 1], [ex([5, 5]), ex([6, 3]), ex([6, 4])]);
    const oc = (x, y, r) => Ranged.flight(o, o.actors[0], x, y, r).code;
    assert.equal(json([oc(5, 5, 5), oc(5, 5, 6)]), json(['out_of_reach', null]), '4 and 4 off: 32 is past 30, within 42');
    assert.equal(json([oc(6, 3, 5), oc(6, 4, 5), oc(6, 4, 6)]), json([null, 'out_of_reach', null]), '5 and 2 off is within 5; 5 and 3 off is not');
    assert.equal(json([Ranged.within(o.actors[0], 5, 5, 5), Ranged.within(o.actors[0], 6, 3, 5), Ranged.within({ x: 4, y: 4, size: 2 }, 9, 5, 4)]), json([false, true, true]), 'from the nearest tile of a footprint');
  });

  test('a shot hits the first actor on its line, rolled as a blow, from the last tile its bolt crossed, then makes a soft noise at the shooter', () => {
    const map = ['##########', '#........#', '#........#', '##########'];
    let hits = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = Setup.room(seed, { acc: 'T0', depth: 1, map, you: [1, 1], exhibits: [ex([7, 1]), ex([4, 1], { mode: 'awake' }), ex([5, 2], { mode: 'awake' })] });
      const [, k, mid] = s.actors, ev = [];
      k.sawYou = mid.sawYou = true;
      const before = C.Rng.stream(State.clone(s), 'combat/' + k.uid).d100();
      assert.equal(Ranged.shoot(s, k, 1, 1, { kind: 'shot' }, ev), N.COST_ATTACK);
      for (const e of ev) assert.equal(Causes.check(e), null, json(e));
      const kinds = ev.map(e => e.k).filter(k => ['attacked', 'missed', 'damaged', 'noise'].includes(k));
      assert.equal(json(kinds), json(['attacked', ev.some(e => e.k === 'missed') ? 'missed' : 'damaged', 'noise']));
      assert.equal(json([ev[0].at, ev[0].how.range, ev[0].how.via]), json([mid.uid, 3, [5, 1]]), 'the exhibit at 4,1 stands first on the line');
      const out = ev.find(e => e.k === 'damaged' || e.k === 'missed');
      assert.equal(out.cause.roll, before, 'rolled on the shooter\'s own combat stream');
      assert.equal(out.cause.chance, C.Combat.hitChance(k, mid));
      if (out.k === 'damaged') { hits++; assert.equal(json([out.who, out.cause.k, out.cause.from, out.cause.range]), json([mid.uid, 'shot', [5, 1], 3])); }
      const noise = ev.find(e => e.k === 'noise');
      assert.equal(json([noise.x, noise.y, noise.cls, noise.cause.k, noise.cause.by]), json([7, 1, 'soft', 'attack', k.uid]));
    }
    assert.ok(hits > 15, `${hits} of 30 landed`);
  });
};
