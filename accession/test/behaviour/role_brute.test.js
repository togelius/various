// The brute role's Behaviour-line clause (BUILD.md §5.3, §8.1, §8.10; the role's own rule):
// "Each of its blows takes {COST_ATTACK_HEAVY} ticks, not {COST_ATTACK}." ('CLAUSES.role_brute').
// A role adds a part to the line only when it has a rule of its own, and the brute is the only
// one that has (Actors.attackCost). Run for every pack species of the role (A.4's Busts of the
// Proposing Trustee, marble and plaster) at depths 1–7, with every invariant checked after
// every step and a clone check; the invariant combat_brute_blow catches a brute's blow that
// costs anything else.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const C = loadCore();
  const { N, Setup, Roles } = C;
  const HALL = ['#################', '#...............#', '#################'];
  const waits = n => Array.from({ length: n }, () => ({ a: 'wait' }));
  const build = (params, sp, depth, opts) => Setup.room(opts.seed, { acc: 'T0', depth, map: HALL, you: [1, 1],
    exhibits: [{ sp: sp.id, at: [2, 1], mode: 'hunting', stats: Object.assign(Roles.stats(sp.role, depth), { hp: 999 }) }] }, { rulesOff: opts.rulesOff, invulnerable: true });
  const blows = (r, uid) => r.events.filter(e => e.k === 'attacked' && e.by === uid).map(e => e.tick);
  const list = H.species(C, 'role_brute');

  test('the brute\'s clause is on every brute in the packs, and only on brutes, at every depth', () => {
    assert.ok(list.length >= 14 && list.every(x => x.sp.role === 'brute'), JSON.stringify(list.map(x => x.sp.id)));
    for (const p of C.Packs.list()) for (const sp of p.species) {
      const ids = C.Clauses.of(sp, { depth: 4 }).map(q => q.id);
      assert.equal(ids.includes('role_brute'), sp.role === 'brute', `${sp.id} (${sp.role}): ${ids.join(', ')}`);
    }
    assert.equal(C.Registry.CLAUSES.role_brute.ready, 'unit');
  });

  test('a brute beside you strikes once every COST_ATTACK_HEAVY ticks, as its line says, for every species at depths 1–7', () => {
    const sc = H.scenario({
      name: 'a brute beside you strikes every COST_ATTACK_HEAVY ticks', id: 'role_brute', clone: true, seeds: [1, 2],
      build, actions: waits(12),
      expect(r, params) {
        if (params.COST_ATTACK_HEAVY !== N.COST_ATTACK_HEAVY || params.COST_ATTACK !== N.COST_ATTACK) return `its clause's numbers are ${JSON.stringify(params)}`;
        if (!/Each of its blows takes \d+ ticks, not \d+\./.test(r.clause)) return `its clause reads "${r.clause}"`;
        const ticks = blows(r, r.start.actors[1].uid);
        if (ticks.length < 6) return `it struck ${ticks.length} times in 12 turns`;
        const gap = ticks.slice(1).map((t, i) => t - ticks[i]).find(g => g !== N.COST_ATTACK_HEAVY);
        return gap === undefined ? null : `two of its blows came ${gap} ticks apart, not ${N.COST_ATTACK_HEAVY}`;
      },
    });
    const res = H.sweep(C, sc, list);
    assert.ok(res.length >= 28, `${res.length} runs`);
    assert.deepEqual(H.failures(res), []);
  });

  test('the invariant combat_brute_blow catches a brute\'s blow that costs an ordinary blow\'s ticks', () => {
    const X = loadCore();
    const real = X.Actors.attackCost;
    X.Actors.attackCost = (state, a) => a.role === 'brute' ? X.Actors.cost(state, a, N.COST_ATTACK, 'act') : real(state, a);
    const sp = list[0].sp, s = Setup.room(1, { acc: 'T0', depth: 3, map: HALL, you: [1, 1], exhibits: [{ sp: sp.id, at: [2, 1], mode: 'hunting', stats: Object.assign(Roles.stats('brute', 3), { hp: 999 }) }] }, { invulnerable: true });
    const r = H.play(X, X.State.clone(s), waits(6), { inv: ['combat_brute_blow'] });
    assert.ok(r.violations.length && /combat_brute_blow/.test(JSON.stringify(r.violations[0])), JSON.stringify(r.violations));
    const ok = H.play(C, C.State.clone(s), waits(6), { inv: ['combat_brute_blow'] });
    assert.deepEqual(ok.violations, []);
  });
};
