// The mote swarm's Behaviour line (BUILD.md §5.3, §5.5; W1-ARCH-A): "Comes as several bodies
// that each fall to a single hit; they move two tiles a turn and strike from beside you for
// {dmg}." Each scenario is run for every pack species with the clause (A.4's Carbon Flimsies)
// at depths 1–7, with the invariants checked and a clone after every step; the one-hit
// scenario is shown to fail on a core where hits are not raised to a body's health.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const Inv = require(path.join(root, 'tools/invariants.js'));
  const C = loadCore();
  const { N, Int, Dept, Packs, Options } = C;
  const ROOM = ['#############', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#############'];
  const range = d => { const [lo, hi] = String(d).split('–').map(Number); return [lo, hi === undefined ? lo : hi]; };
  const waits = n => Array.from({ length: n }, () => ({ a: 'wait' }));
  // A room with you (hard to kill, so every action is played) and the bodies of a swarm, hunting.
  const make = (X, at, kit) => (params, sp, depth, opts) => X.Setup.room(opts.seed, { acc: 'T0', depth, map: ROOM, you: [5, 3], kit,
    exhibits: at.map(t => ({ sp: sp.id, at: t, mode: 'hunting', stats: X.Roles.stats(sp.role, depth) })) }, { rulesOff: opts.rulesOff, invulnerable: true });
  const bodies = r => r.start.actors.slice(1).map(a => a.uid);

  const scenarios = X => ({
    single: H.scenario({
      name: 'every body of a swarm falls to a single hit, even one too weak to destroy it', id: 'mote_swarm',
      // A T1 Light weapon (1–4) cannot destroy a body of 2 or more health in one blow by its damage alone.
      build: make(X, [[6, 3], [4, 3], [5, 2]], { weapon: { form: 'light', tier: 1 } }), seeds: [1, 2, 3, 4], clone: true, cap: 40,
      actions(state) {
        const att = X.Step.legal(state).filter(a => a.a === 'attack');
        return att.length ? att[0] : { a: 'wait' };
      },
      expect(r) {
        const ids = bodies(r), hits = r.events.filter(e => e.k === 'damaged' && ids.includes(e.who));
        for (const uid of ids) {
          const mine = hits.filter(e => e.who === uid), before = r.start.actors.find(a => a.uid === uid).hp;
          if (mine.length !== 1) return `${uid} was hit ${mine.length} times`;
          if (mine[0].hp !== 0 || mine[0].amount !== before) return `${uid} lost ${mine[0].amount} of its ${before} health to one hit`;
          if (!r.events.some(e => e.k === 'died' && e.who === uid)) return `${uid} was hit and not destroyed`;
        }
        return null;
      },
    }),
    swarming: H.scenario({
      name: 'a swarm\'s bodies move two tiles a turn and strike from beside you for their damage', id: 'mote_swarm',
      build: make(X, [[11, 1], [11, 3], [11, 5]]), actions: waits(14), seeds: [1, 2], clone: true,
      expect(r, params) {
        const [lo, hi] = range(params.dmg), fast = Int.pct(N.COST_STEP, N.SPEED_FAST_PCT);
        for (const uid of bodies(r)) {
          const ticks = r.events.filter(e => e.k === 'moved' && e.who === uid).map(e => e.tick);
          if (ticks.length < 4) return `${uid} took ${ticks.length} steps`;
          const gaps = ticks.slice(1).map((t, i) => t - ticks[i]);
          if (Math.min(...gaps) !== fast) return `${uid}'s steps were never half a turn apart: ${gaps.join(', ')}`;
        }
        // Bodies crowd each other round you, so not every one need reach you; those that do strike.
        const blows = r.events.filter(e => e.k === 'damaged' && e.who === 'you');
        if (!blows.length) return 'no body landed a blow';
        const bad = blows.find(e => e.cause.raw < lo || e.cause.raw > hi);
        return bad ? `a blow rolled ${bad.cause.raw}, outside ${params.dmg}` : null;
      },
    }),
  });
  const S = scenarios(C), list = H.species(C, 'mote_swarm');

  test('the swarm\'s scenarios cover every species with its clause, at depths 1–7', () => {
    assert.ok(list.length >= 7 && list.every(x => x.sp.archetype === 'mote_swarm'), JSON.stringify(list.map(x => x.sp.id)));
    assert.deepEqual([...new Set(list.map(x => x.depth))], H.DEPTHS);
  });

  for (const key of ['single', 'swarming']) {
    test(`mote_swarm: ${S[key].name}, for every species at depths 1–7, invariants and clone checked`, () => {
      const results = H.sweep(C, S[key], list);
      assert.equal(results.length, list.length * S[key].seeds.length);
      assert.deepEqual(H.failures(results), []);
      if (key !== 'single') return;
      // At every depth some hit was too weak to destroy its body by its damage alone, so the
      // rule, not the weapon, destroyed it.
      for (const d of H.DEPTHS) {
        const weak = results.filter(r => r.depth === d).some(r => r.events.some(e => e.k === 'damaged' && e.who !== 'you' && e.cause.raw - e.cause.pad < r.start.actors.find(a => a.uid === e.who).hp));
        assert.ok(weak, `depth ${d}: every hit was strong enough anyway`);
      }
    });
  }

  test('mote_swarm: a department places a swarm as several bodies, SWARM_BODIES[0] of them, at every depth', () => {
    assert.ok(N.SWARM_BODIES[0] >= 2);
    for (const { sp, depth, acc } of list) {
      if (!acc) continue;
      const s = Dept.create(1, acc, depth), got = s.actors.filter(a => a.sp === sp.id && !a.gone);
      assert.equal(got.length, N.SWARM_BODIES[0], `${sp.id} at depth ${depth}`);
      assert.ok(got.every(a => a.arch === 'mote_swarm' && a.speed === 'fast'), `${sp.id} at depth ${depth}: fast bodies`);
    }
  });

  test('mote_swarm: with hits no longer raised to a body\'s health, the one-hit scenario fails, and so does its invariant', () => {
    const X = loadCore();
    X.Archetypes.adjustDamage = (state, def, amount) => amount;
    const T = scenarios(X), sp = list[list.length - 1].sp;
    const fails = H.DEPTHS.map(d => H.run(X, T.single, sp, d, { inv: [] }).failure);
    assert.ok(fails.filter(Boolean).length >= 5, fails.join(' | '));
    const r = H.run(X, T.single, sp, 7, { inv: Inv.select(X, ['swarm_single_hit']) });
    assert.match(r.failure || '', /^swarm_single_hit: took \d+ damage at tick \d+ and was left \d+ health/);
  });
};
