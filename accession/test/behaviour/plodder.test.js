// The plodder's Behaviour line (BUILD.md §5.3; plan W1-WAKE-B), "Walks one tile at a time and
// strikes from beside you for {dmg}.", proved for every pack species whose line has it, at
// every depth 1–7, as functions of the clause's {dmg}, with every invariant checked after
// every step and each run replayed with a clone after every step.
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const H = require('./_harness.js');
  const { Setup, Roles, Actors } = C;
  const MAP = ['#############', '#...........#', '#...........#', '#...........#', '#############'];
  const range = d => { const [lo, hi] = String(d).split('–').map(Number); return [lo, hi === undefined ? lo : hi]; };
  const build = at => (params, sp, depth, opts) => {
    const s = Setup.room(opts.seed, { acc: 'T0', depth, map: MAP, you: [2, 2], exhibits: [{ sp: sp.id, at, mode: 'hunting', stats: Roles.stats(sp.role, depth) }] }, { rulesOff: opts.rulesOff });
    s.actors[0].hp = s.actors[0].maxHp = 999;
    return s;
  };
  const blows = (r, uid) => r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.by === uid);
  const inRange = (r, params, uid) => {
    const [lo, hi] = range(params.dmg), hits = blows(r, uid);
    if (!hits.length) return 'it never landed a blow';
    const bad = hits.find(e => e.cause.raw < lo || e.cause.raw > hi);
    return bad ? `a blow rolled ${bad.cause.raw}, outside ${params.dmg}` : null;
  };

  const strikes = H.scenario({
    name: 'a plodder beside you strikes from there for its damage range', id: 'plodder', clone: true,
    build: build([3, 2]),
    actions: Array.from({ length: 16 }, () => ({ a: 'wait' })),
    expect(r, params) {
      const a = r.state.actors[1];
      if (r.events.some(e => e.k === 'moved' && e.who === a.uid)) return 'beside you, it moved instead of striking';
      const swings = r.events.filter(e => e.k === 'attacked' && e.by === a.uid);
      if (swings.some(e => e.how.kind !== 'melee')) return 'it attacked other than with a blow';
      return inRange(r, params, a.uid);
    },
  });

  const walks = H.scenario({
    name: 'a plodder walks to you one tile at a time, along a shortest path, then strikes', id: 'plodder', clone: true,
    build: build([10, 2]),
    actions: Array.from({ length: 30 }, () => ({ a: 'wait' })),
    expect(r, params) {
      const a = r.state.actors[1], you = r.state.actors[0], far = Math.max(Math.abs(10 - you.x), Math.abs(2 - you.y));
      const first = r.events.findIndex(e => e.k === 'attacked' && e.by === a.uid);
      if (first < 0) return 'it never reached you';
      const steps = r.events.slice(0, first).filter(e => e.k === 'moved' && e.who === a.uid);
      // In an open room the walking distance is the Chebyshev distance: each step one tile
      // nearer, and it strikes once beside you.
      let d = far;
      for (const e of steps) {
        const n = Math.max(Math.abs(e.to[0] - you.x), Math.abs(e.to[1] - you.y));
        if (Math.max(Math.abs(e.to[0] - e.from[0]), Math.abs(e.to[1] - e.from[1])) !== 1) return `a step from ${e.from} to ${e.to} is not one tile`;
        if (n !== d - 1) return `a step to ${e.to} left it ${n} tiles away, not ${d - 1}`;
        d = n;
      }
      if (d !== 1) return `it struck from ${d} tiles away`;
      if (steps.length !== far - 1) return `it took ${steps.length} steps to cover ${far - 1}`;
      const ticks = new Set(steps.map(e => e.tick));
      if (ticks.size !== steps.length) return 'it took two steps in one action';
      return inRange(r, params, a.uid);
    },
  });

  for (const sc of [strikes, walks]) test(`plodder: ${sc.name}, for every species and depth`, () => {
    const list = H.species(C, 'plodder');
    assert.ok(list.length >= 21, `${list.length} species and depths`);
    assert.ok(new Set(list.map(x => x.sp.id)).size >= 3);
    const results = H.sweep(C, sc, list);
    assert.equal(JSON.stringify(H.failures(results)), '[]');
    for (const r of results) assert.ok(r.clause.includes(`strikes from beside you for ${r.params.dmg}`), r.clause);
  });

  test('plodder: the scenarios bite: a plodder that steps two tiles, or strikes from two tiles away, fails them', () => {
    const X = loadCore(), A41 = X.Packs.species('A4', 'A4.1');
    // A plodder that strides: two tiles a step when it can.
    const stride = X.AI.towards;
    X.AI.towards = (state, a, goal, how, ev) => {
      const r = stride(state, a, goal, how, ev);
      if (r !== null && a.arch === 'plodder' && X.Actors.between(a, state.actors[0]) > 2) stride(state, a, goal, how, ev);
      return r;
    };
    const rw = H.run(X, walks, A41, 3, { inv: [] });
    assert.ok(rw.failure && /not 1[0-9]* tiles away|steps to cover|two steps/.test(rw.failure), rw.failure);
    const ri = H.run(X, walks, A41, 3);
    assert.ok(ri.failure && /plodder_one_thing/.test(ri.failure), ri.failure);
    // A plodder that hits for one more than its range.
    const Y = loadCore(), M115 = Y.Packs.species('M11', 'M11.5');
    const strike = Y.Combat.strike;
    Y.Combat.strike = (state, att, def, ev) => { if (att.arch === 'plodder') { const d = att.dmax; att.dmin = att.dmax = d + 1; const c = strike(state, att, def, ev); att.dmin = att.dmax = d; return c; } return strike(state, att, def, ev); };
    assert.match(H.run(Y, strikes, M115, 4, { inv: [] }).failure, /outside/);
  });
};
