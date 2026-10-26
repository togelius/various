// The marble modifier's Behaviour clause (BUILD.md §5.3, §5.5, §8.1; W1-ARCH-A): "Moves at
// half speed." Run for every pack species with the clause (A.4's Seated Clerk, a plodder, and
// the Bust of the Proposing Trustee, a splitter) at depths 1–7, with the invariants checked
// and a clone after every step; rerun with marble switched off (rulesOff), the walking
// scenario must fail (§5.3, check 3).
module.exports = ({ test, assert, loadCore, root, path }) => {
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const Inv = require(path.join(root, 'tools/invariants.js'));
  const C = loadCore();
  const { N, Int, Setup, Roles, Actors } = C;
  const HALL = ['#################', '#...............#', '#################'];
  const waits = n => Array.from({ length: n }, () => ({ a: 'wait' }));
  const make = (map, you, at) => (params, sp, depth, opts) => Setup.room(opts.seed, { acc: 'T0', depth, map, you,
    exhibits: [{ sp: sp.id, at, mode: 'hunting', stats: Roles.stats(sp.role, depth) }] }, { rulesOff: opts.rulesOff, invulnerable: true });
  const own = (r, k) => { const uid = r.start.actors[1].uid; return r.events.filter(e => e.k === k && (k === 'attacked' ? e.by : e.who) === uid).map(e => e.tick); };
  const gaps = ticks => ticks.slice(1).map((t, i) => t - ticks[i]);

  const walks = H.scenario({
    name: 'a marble body walks at half speed: a step every two turns', id: 'marble',
    build: make(HALL, [1, 1], [9, 1]), actions: waits(14), clone: true,
    expect(r) {
      const slow = Int.pct(N.COST_STEP, N.SPEED_SLOW_PCT), steps = own(r, 'moved');
      if (steps.length < 5) return `it took ${steps.length} steps in 14 turns`;
      const bad = gaps(steps).find(g => g !== slow);
      return bad === undefined ? null : `two of its steps came ${bad} ticks apart, not ${slow}`;
    },
  });
  const strikes = H.scenario({
    name: 'a marble body beside you strikes at the usual pace: only its steps are slow', id: 'marble',
    holdsWithout: 'it shows what marble leaves as it is (a blow\'s cost), which is the same with marble off',
    build: make(HALL, [1, 1], [2, 1]), actions: waits(10), clone: true,
    expect(r) {
      const blows = own(r, 'attacked'), want = r.start.actors[1].role === 'brute' ? N.COST_ATTACK_HEAVY : N.COST_ATTACK;
      if (blows.length < 5) return `it struck ${blows.length} times in 10 turns`;
      const bad = gaps(blows).find(g => g !== want);
      return bad === undefined ? null : `two of its blows came ${bad} ticks apart, not ${want}`;
    },
  });
  const list = H.species(C, 'marble');

  test('marble\'s scenarios cover every species with its clause, at depths 1–7', () => {
    assert.ok(list.length >= 14 && list.every(x => x.sp.modifiers.includes('marble')), JSON.stringify(list.map(x => x.sp.id)));
    assert.deepEqual([...new Set(list.map(x => x.depth))], H.DEPTHS);
    assert.ok(list.some(x => x.sp.archetype === 'plodder') && list.some(x => x.sp.archetype === 'splitter'));
  });

  for (const sc of [walks, strikes]) {
    test(`marble: ${sc.name}, for every species at depths 1–7, invariants and clone checked`, () => {
      assert.deepEqual(H.failures(H.sweep(C, sc, list)), []);
    });
  }

  test('marble: switched off (rulesOff), the walking scenario fails at every species and depth', () => {
    const s = H.sensitivity(C, walks, 'marble', list);
    assert.ok(s.sensitive, s.problems.join('\n'));
    assert.equal(s.runs.length, list.length);
    assert.ok(s.runs.every(x => /came 100 ticks apart, not 200/.test(x.off.failure)), s.runs.map(x => x.off.failure).join(' | '));
  });

  test('marble: its speed is the registry\'s, fixed at spawn; a fast archetype with marble moves at the usual speed', () => {
    const s = Setup.room(1, { acc: 'T0', depth: 1, map: HALL, you: [1, 1], exhibits: [
      { sp: 'A4.1', at: [5, 1], mode: 'hunting', stats: Roles.stats('fodder', 1) },
      { sp: 'A4.1', at: [7, 1], mode: 'hunting', stats: Roles.stats('fodder', 1), arch: 'darter' }] });
    const [, plodder, darter] = s.actors;
    assert.equal(JSON.stringify([plodder.speed, darter.speed]), JSON.stringify(['slow', null]));
    assert.equal(Actors.cost(s, plodder, N.COST_STEP, 'move'), Int.pct(N.COST_STEP, N.SPEED_SLOW_PCT));
    assert.equal(Actors.cost(s, plodder, N.COST_ATTACK, 'act'), N.COST_ATTACK);
    assert.equal(Actors.cost(s, darter, N.COST_STEP, 'move'), N.COST_STEP);
  });

  test('marble: a marble body that walks at the usual speed breaks the speed invariant', () => {
    const X = loadCore();
    const real = X.Actors.cost;
    X.Actors.cost = (state, a, base, kind) => (a.mods || []).includes('marble') && kind === 'move' ? base : real(state, a, base, kind);
    const r = H.run(X, walks, list[0].sp, 2, { inv: Inv.select(X, ['arch_a_speed']) });
    assert.match(r.failure || '', /^arch_a_speed: its step at tick \d+ took 100 ticks; it takes 200/);
  });
};
