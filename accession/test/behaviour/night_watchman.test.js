// The night_watchman's Behaviour line (BUILD.md §5.3, §8.4), clause by clause, as scenarios
// run for the shared species at every depth 1–7 with every invariant checked after every
// step, each written as a function of the clause's parameters ({dmg}, {WATCHMAN_RETURN}).
// The clause: "Comes for you across the whole department, always knowing where you are, and
// strikes from beside you for {dmg}; it is never caught by surprise. Staff doors stop it:
// when it cannot reach you, it waits as near to you as it can. If defeated, another comes
// {WATCHMAN_RETURN} turns later." Then: the invariants catch planted faults.
const H = require('./_harness.js');

module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const json = x => JSON.stringify(x);
  const watchmen = s => s.actors.filter(a => a.arch === 'night_watchman');
  const range = dmg => { const m = /^(\d+)(?:–(\d+))?$/.exec(dmg); return m ? [+m[1], +(m[2] || m[1])] : null; };

  const ROOM = ['############', 'E..........#', '#..........#', '#..........X', '############'];
  // From the entrance to (38, 5), a winding walk of well over 64 tiles, out of sight all the way.
  const LONG = [
    '########################################',
    'E......................................#',
    '######################################.#',
    '#......................................#',
    '#.######################################',
    '#......................................#',
    '########################################',
  ];
  // A staff door at (6, 2): you can pass it, the Watchman cannot.
  const STAFF = ['############', 'E.....#....#', '#.....S....#', '#.....#....#', '############'];
  // The night watch begins at the second boundary (B 1, G 1), and the Watchman comes in at the entrance.
  const make = (map, you, depth, o) => C.Setup.room(o.seed, { acc: 'T0', depth, map, you, exhibits: [], clock: { B: 1, G: 1 }, entrance: [0, 1] },
    { rulesOff: o.rulesOff, invulnerable: true });
  const waits = n => Array.from({ length: n }, () => ({ a: 'wait' }));
  // Walking distance for an exhibit (§8.2), written here: 8-way steps, a diagonal only past
  // two steppable tiles, staff doors walls.
  function walk(map, from, to) {
    const ok = (x, y) => y >= 0 && y < map.length && x >= 0 && x < map[0].length && ".,+'EXukxwb=".includes(map[y][x]);
    const seen = new Map([[from.join(), 0]]), q = [from];
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i], d = seen.get(q[i].join());
      if (x === to[0] && y === to[1]) return d;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if ((!dx && !dy) || !ok(nx, ny) || seen.has(nx + ',' + ny) || (dx && dy && !(ok(nx, y) && ok(x, ny)))) continue;
        seen.set(nx + ',' + ny, d + 1); q.push([nx, ny]);
      }
    }
    return -1;
  }
  const sweep = sc => {
    const list = H.species(C, 'night_watchman');
    assert.equal(json(list.map(r => [r.sp.id, r.depth])), json([1, 2, 3, 4, 5, 6, 7].map(d => ['night_watchman', d])), 'the shared species at every depth');
    const results = H.sweep(C, sc, list);
    assert.equal(json(H.failures(results)), '[]');
    return results;
  };

  test('night_watchman: "strikes from beside you for {dmg}" — every blow it lands is a roll in {dmg}, less your Padding, from beside you', () => {
    sweep(H.scenario({
      name: 'it strikes from beside you for {dmg}', id: 'night_watchman', clone: true,
      build: (p, sp, depth, o) => make(ROOM, [1, 1], depth, o),
      actions: waits(14),
      expect(r, p) {
        const [lo, hi] = range(p.dmg), [w] = watchmen(r.state), you = r.state.actors[0];
        const hits = r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.by === w.uid);
        if (hits.length < 3) return `it landed ${hits.length} blows in 12 turns beside you`;
        for (const e of hits) {
          if (e.cause.raw < lo || e.cause.raw > hi) return `a blow rolled ${e.cause.raw}, outside ${p.dmg}`;
          if (e.cause.pad !== you.pad || e.amount !== Math.max(1, e.cause.raw - you.pad)) return `a blow of ${e.cause.raw} took ${e.amount}, with your Padding ${you.pad}`;
        }
        const blows = r.events.filter(e => e.k === 'attacked' && e.by === w.uid);
        return blows.every(e => e.at === 'you' && e.cause.dist === 1) ? null : 'a blow not from beside you';
      },
    }));
  });

  test('night_watchman: "comes for you across the whole department, always knowing where you are" — across more than 64 tiles, out of sight, it never loses you', () => {
    const far = walk(LONG, [0, 1], [38, 5]);
    assert.ok(far > 64, `${far} tiles`);
    sweep(H.scenario({
      name: 'it comes the whole way to you, out of sight', id: 'night_watchman', clone: true,
      build: (p, sp, depth, o) => make(LONG, [38, 5], depth, o),
      actions: waits(far + 6),
      expect(r) {
        const [w] = watchmen(r.state), first = r.events.find(e => e.k === 'attacked' && e.by === w.uid);
        if (!first) return `it never reached you over ${far} tiles`;
        if (first.turn > far + 2) return `it reached you at turn ${first.turn}, not one step a turn from turn 2 over ${far} tiles`;
        if (r.events.some(e => (e.k === 'lost' || e.k === 'alerted') && e.who === w.uid)) return 'it lost you or went to look elsewhere';
        return w.mode === 'hunting' ? null : `it is ${w.mode}`;
      },
    }));
  });

  test('night_watchman: "it is never caught by surprise" — your blow at it before it has acted is still rolled', () => {
    sweep(H.scenario({
      name: 'it is never caught by surprise', id: 'night_watchman',
      build: (p, sp, depth, o) => make(ROOM, [1, 1], depth, o),
      actions: (s, i) => { const w = watchmen(s)[0]; return i > 4 ? null : w ? { a: 'attack', uid: w.uid } : { a: 'wait' }; },
      expect(r) {
        const blows = r.events.filter(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.by === 'you');
        if (!blows.length) return 'you struck nothing';
        return blows.every(e => Number.isInteger(e.cause.roll) && e.cause.surprise === undefined) ? null : `a surprise blow: ${json(blows[0].cause)}`;
      },
    }));
  });

  test('night_watchman: "Staff doors stop it: when it cannot reach you, it waits as near to you as it can"', () => {
    sweep(H.scenario({
      name: 'it waits at the staff door', id: 'night_watchman', clone: true,
      build: (p, sp, depth, o) => make(STAFF, [9, 2], depth, o),
      actions: waits(30),
      expect(r) {
        const [w] = watchmen(r.state);
        if (w.x !== 5 || w.y !== 2) return `it stands at ${w.x},${w.y}, not at 5,2, the tile on its side of the door nearest you`;
        const late = r.steps.slice(-12).flatMap(t => t.events).filter(e => e.who === w.uid || e.by === w.uid);
        if (late.length) return `it did not wait: ${late.map(e => e.k).join(', ')}`;
        return w.mode === 'hunting' ? null : `it is ${w.mode}`;
      },
    }));
  });

  test('night_watchman: "If defeated, another comes {WATCHMAN_RETURN} turns later"', () => {
    sweep(H.scenario({
      name: 'another comes {WATCHMAN_RETURN} turns after it falls', id: 'night_watchman', clone: true,
      // A Watchman already in the night watch, beside you, on its last health.
      build(p, sp, depth, o) {
        const s = C.Setup.room(o.seed, { acc: 'T0', depth, map: ROOM, you: [1, 1], clock: { B: 1, G: 1, count: 2 }, entrance: [0, 1],
          exhibits: [{ sp: 'night_watchman', at: [2, 2], mode: 'hunting', stats: C.Roles.stats('warden', depth), hp: 1, uid: `T0.${depth}.watch.1` }] },
        { rulesOff: o.rulesOff, invulnerable: true });
        s.dept.clock.watch.k = 1;
        return s;
      },
      actions(s, i, c) {
        if (c.events.some(e => e.k === 'entered')) return null;
        const w = watchmen(s).find(a => !a.gone);
        return w && w.uid.endsWith('.1') ? { a: 'attack', uid: w.uid } : { a: 'wait' };
      },
      cap: 80,
      expect(r, p) {
        const fell = r.events.find(e => e.k === 'died'), came = r.events.find(e => e.k === 'entered');
        if (!fell || !came) return 'it did not fall, or no other came';
        const at = fell.turn + 2;   // the clock was made at count 2
        if (came.cause.count !== at + p.WATCHMAN_RETURN) return `it fell at count ${at}; the next came at ${came.cause.count}, not ${at + p.WATCHMAN_RETURN}`;
        if (came.turn - fell.turn !== p.WATCHMAN_RETURN) return `the next came ${came.turn - fell.turn} turns later`;
        return json([came.who, came.cause.n]) === json([`T0.${r.depth}.watch.2`, 2]) ? null : `the next is ${came.who}, number ${came.cause.n}`;
      },
    }));
  });

  test('the Night Watchman\'s invariants catch planted faults: two at once, a wait with a step free, a step away, a hunt dropped, a return a count early, an act on arrival', () => {
    const Inv = require('../../tools/invariants.js');
    const run = (patch, n) => {
      const X = loadCore();
      patch(X);
      const s = X.Setup.room(1, { acc: 'T0', depth: 3, map: LONG, you: [20, 5], exhibits: [], clock: { B: 1, G: 1 }, entrance: [0, 1] }, { invulnerable: true });
      const check = Inv.checker(X, Inv.select(X, ['night_watchman'])), found = new Set();
      for (let i = 0; i < (n || 40) && !s.over; i++) {
        const pre = X.State.clone(s), ev = X.Step.step(s, { a: 'wait' });
        for (const v of check(pre, { a: 'wait' }, ev, s)) found.add(v.inv);
      }
      return [...found].sort();
    };
    assert.equal(json(run(() => {})), '[]', 'the rules as built break none');
    assert.equal(json(run(X => { const f = X.ClockRules.boundary; X.ClockRules.boundary = (s, ev) => { f(s, ev); if (s.dept.clock.count === 3) X.ClockRules.spawnWatchman(s, ev); }; })),
      json(['night_watchman.one', 'night_watchman.return']));
    assert.equal(json(run(X => { const f = X.AI.towards; X.AI.towards = (s, a, g, how, ev) => a.arch === 'night_watchman' && s.turn % 5 === 0 ? null : f(s, a, g, how, ev); })),
      json(['night_watchman.acts']));
    assert.equal(json(run(X => { const f = X.AI.towards; X.AI.towards = (s, a, g, how, ev) => a.arch === 'night_watchman' && s.turn === 9 ? X.AI.away(s, a, s.actors[0], ev) : f(s, a, g, how, ev); })),
      json(['night_watchman.acts']));
    assert.equal(json(run(X => { const f = X.AI.strike; X.AI.strike = (s, a, b, ev) => { if (a.arch === 'night_watchman' && s.turn === 6) a.mode = 'searching'; return f(s, a, b, ev); }; })),
      json(['night_watchman.hunts']));
    const early = (() => {
      const X = loadCore();
      X.ClockRules.fell = (s, a) => { s.dept.clock.watch.back = s.dept.clock.count + X.N.WATCHMAN_RETURN - 1; };
      const s = X.Setup.room(1, { acc: 'T0', depth: 3, map: ROOM, you: [1, 1], clock: { B: 1, G: 1, count: 2 }, entrance: [0, 1],
        exhibits: [{ sp: 'night_watchman', at: [2, 2], mode: 'hunting', stats: X.Roles.stats('warden', 3), hp: 1, uid: 'T0.3.watch.1' }] }, { invulnerable: true });
      s.dept.clock.watch.k = 1;
      const check = Inv.checker(X, Inv.select(X, ['night_watchman'])), found = new Set();
      for (let i = 0; i < 60; i++) {
        const w = s.actors[1], act = w.gone ? { a: 'wait' } : { a: 'attack', uid: w.uid };
        const pre = X.State.clone(s), ev = X.Step.step(s, act);
        for (const v of check(pre, act, ev, s)) found.add(v.inv);
      }
      return [...found].sort();
    })();
    assert.equal(json(early), json(['night_watchman.return']), 'a return due a count early');
    // An act on arrival: the Watchman made to act at the tick it comes in.
    assert.equal(json(run(X => { const f = X.ClockRules.spawnWatchman; X.ClockRules.spawnWatchman = (s, ev) => { const a = f(s, ev); if (a) a.next = s.tick; return a; }; })),
      json(['night_watchman.acts']));
  });
};
