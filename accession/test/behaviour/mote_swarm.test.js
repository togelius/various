// The mote swarm's Behaviour line (BUILD.md §5.3, §5.5; W1-ARCH-A): "Comes as {SWARM_BODIES}
// bodies (SWARM_BODIES[0]) that each fall to a single hit; they move two tiles a turn and strike from beside you for
// {dmg}." Each scenario is run for every pack species with the clause (A.4's Carbon Flimsies)
// at depths 1–7, with the invariants checked and a clone after every step; the one-hit
// scenario is shown to fail on a core where hits are not raised to a body's health, and the
// striking scenario on one whose speed covers its blows. Hits of every kind, from you and
// from exhibits, are also made directly with Combat.hurt.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const Inv = require(path.join(root, 'tools/invariants.js'));
  const C = loadCore();
  const { N, Int, Dept, Packs, Options, Setup, Roles, Combat, Causes } = C;
  const json = x => JSON.stringify(x);
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
    // Only its steps are fast (§8.1: "attacks and every other action cost the usual"): a body
    // beside you strikes once a blow's time, not twice.
    strikes: H.scenario({
      name: 'a body of a swarm beside you strikes at the usual pace: only its steps are fast', id: 'mote_swarm',
      build: make(X, [[6, 3]]), actions: waits(10), seeds: [1, 2], clone: true,
      expect(r) {
        const a = r.start.actors[1], want = a.role === 'brute' ? N.COST_ATTACK_HEAVY : N.COST_ATTACK;
        const blows = r.events.filter(e => e.k === 'attacked' && e.by === a.uid).map(e => e.tick);
        if (blows.length < 8) return `it struck ${blows.length} times in 10 turns beside you`;
        if (r.events.some(e => e.k === 'moved' && e.who === a.uid)) return 'it stepped, though it was beside you';
        const gaps = blows.slice(1).map((t, i) => t - blows[i]), bad = gaps.find(g => g !== want);
        return bad === undefined ? null : `two of its blows came ${bad} ticks apart, not ${want}`;
      },
    }),
  });
  const S = scenarios(C), list = H.species(C, 'mote_swarm');

  test('the swarm\'s scenarios cover every species with its clause, at depths 1–7', () => {
    assert.ok(list.length >= 7 && list.every(x => x.sp.archetype === 'mote_swarm'), JSON.stringify(list.map(x => x.sp.id)));
    assert.deepEqual([...new Set(list.map(x => x.depth))], H.DEPTHS);
  });

  for (const key of ['single', 'swarming', 'strikes']) {
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

  test('mote_swarm: a department places a swarm as SWARM_BODIES[0] bodies at every depth, the number its line gives', () => {
    assert.ok(N.SWARM_BODIES[0] >= 2);
    for (const { sp, depth, acc } of list) {
      if (!acc) continue;
      const s = Dept.create(1, acc, depth), got = s.actors.filter(a => a.sp === sp.id && !a.gone);
      assert.equal(got.length, N.SWARM_BODIES[0], `${sp.id} at depth ${depth}`);
      // The line names the number of record, as §5.3 asks of every clause ("Vague words are not allowed").
      const line = C.Clauses.line(sp, { depth });
      assert.ok(line.startsWith(`Comes as ${got.length} bodies that each fall to a single hit;`), `${sp.id} at depth ${depth}: ${line}`);
      assert.ok(got.every(a => a.arch === 'mote_swarm' && a.speed === 'fast'), `${sp.id} at depth ${depth}: fast bodies`);
    }
  });

  // "Each fall to a single hit", of whatever kind (§8.1): a blow, a special, a shot, a
  // reflected line or an item's bolt, from you or from an exhibit, each of 1 damage on a body
  // of 9 health, destroys it, and the damage told is all its health.
  const hit = (k, a, by) => ({
    attack: { k, by: 'you', at: a.uid, chance: 75, roll: 10, raw: 1, pad: 0, how: { kind: 'melee' }, from: [a.x - 1, a.y] },
    special: { k, by: by.uid, sp: 'ring', gross: 1, pad: 0, net: 1, x: a.x, y: a.y, from: [by.x, by.y] },
    shot: { k, by: by.uid, at: a.uid, chance: 75, roll: 10, raw: 1, pad: 0, how: { kind: 'shot' }, from: [a.x + 1, a.y], range: 3 },
    reflected: { k, by: by.uid, shooter: 'you', raw: 1, pad: 0, from: [a.x + 1, a.y] },
    item: { k, by: 'you', at: a.uid, chance: 75, roll: 10, raw: 1, pad: 0, how: { kind: 'shot' }, from: [a.x - 1, a.y], range: 2, item: 'you.i' },
  })[k];
  test('mote_swarm: any hit destroys a body, a blow, a special, a shot, a reflected line or an item, from you or from an exhibit', () => {
    const sp = list[0].sp, other = Packs.speciesFor(null, { sp: 'A4.1' });
    for (const k of ['attack', 'special', 'shot', 'reflected', 'item']) {
      const s = Setup.room(1, { acc: 'T0', depth: 3, map: ROOM, you: [3, 3], exhibits: [
        { sp: sp.id, at: [6, 3], mode: 'hunting', stats: Roles.stats(sp.role, 3), hp: 9 },
        { sp: 'A4.1', at: [9, 5], mode: 'hunting', stats: Roles.stats(other.role, 3) }] });
      const [, a, by] = s.actors, cause = hit(k, a, by), ev = [];
      Combat.hurt(s, a, 1, cause, ev);
      const dmg = ev.find(e => e.k === 'damaged' && e.who === a.uid);
      assert.equal(json([dmg.amount, dmg.hp, a.hp, a.gone, ev.some(e => e.k === 'died' && e.who === a.uid)]), json([9, 0, 0, 1, true]), k);
      for (const e of ev) assert.equal(Causes.check(e), null, json(e));
    }
  });

  test('mote_swarm: with its speed made to cover its blows too, the striking scenario fails, and so does the speed invariant', () => {
    const X = loadCore(), real = X.Archetypes.speedApplies;
    X.Archetypes.speedApplies = (state, a) => a.arch === 'mote_swarm' ? ['move', 'act'] : real(state, a);
    const T = scenarios(X), sp = list[0].sp, half = Int.pct(N.COST_ATTACK, N.SPEED_FAST_PCT);
    const fails = H.DEPTHS.map(d => H.run(X, T.strikes, sp, d, { inv: [] }).failure);
    assert.ok(fails.every(f => f && f.includes(`came ${half} ticks apart, not ${N.COST_ATTACK}`)), fails.join(' | '));
    // The invariant does not ask the code what a blow costs, so it sees the fault too.
    const r = H.run(X, T.strikes, sp, 3, { inv: Inv.select(X, ['arch_a_speed']) });
    assert.match(r.failure || '', new RegExp(`^arch_a_speed: its blow at tick \\d+ took ${half} ticks; it takes ${N.COST_ATTACK}`));
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
