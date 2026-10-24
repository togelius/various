// The plaster modifier's Behaviour clause (BUILD.md §5.3, §5.5, §8.1, §8.2; W1-ARCH-A): "A
// cast: it has {PLASTER_HP_PCT}% of the usual health, and when destroyed it crumbles into dust
// that blocks sight round it for {PLASTER_DUST_TURNS} turns." Run for every pack species with
// the clause (A.4's Seated Clerk and Bust of the Proposing Trustee, Certified Spares) at depths
// 1–7, with the invariants checked and a clone after every step; rerun with plaster switched
// off (rulesOff), each scenario must fail, for its health and for its dust (§5.3, check 3).
module.exports = ({ test, assert, loadCore, root, path }) => {
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const Inv = require(path.join(root, 'tools/invariants.js'));
  const C = loadCore();
  const { N, Int, Setup, Roles, Grid, Dept, State, Step, Combat, Causes, Packs } = C;
  const json = x => JSON.stringify(x);
  const ROOM = ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#########'];
  const make = extra => (params, sp, depth, opts) => Setup.room(opts.seed, { acc: 'T0', depth, map: ROOM, you: [2, 3],
    exhibits: [Object.assign({ sp: sp.id, at: [3, 3], mode: 'dormant', stats: Roles.stats(sp.role, depth) }, extra || {})] }, { rulesOff: opts.rulesOff, invulnerable: true });

  const health = H.scenario({
    name: 'a plaster cast has PLASTER_HP_PCT% of its role\'s health', id: 'plaster',
    build: make(), actions: [{ a: 'wait' }], clone: true,
    expect(r, params, sp, depth) {
      const a = r.start.actors[1], want = Math.max(1, Int.pct(Roles.stats(sp.role, depth).hp, params.PLASTER_HP_PCT));
      return a.maxHp === want && a.hp === want ? null : `it has ${a.hp} of ${a.maxHp} health; ${params.PLASTER_HP_PCT}% of a ${sp.role}'s ${Roles.stats(sp.role, depth).hp} is ${want}`;
    },
  });
  // What line of sight across the cast's tile, and along a row the dust does not reach, is at
  // each of your decisions after the blow: a replay of the run from its start.
  function sight(r) {
    const s = State.clone(r.start), out = [];
    for (const st of r.steps) {
      Step.step(s, st.action);
      out.push({ turn: s.turn, across: Grid.los(s.dept, 1, 3, 5, 3), past: Grid.los(s.dept, 1, 5, 7, 5) });
    }
    return out;
  }
  const dust = H.scenario({
    name: 'a plaster cast, destroyed, crumbles into dust that blocks sight round it for PLASTER_DUST_TURNS turns', id: 'plaster',
    // One health, so that the surprise blow destroys it at every depth (the share of health is the other scenario's).
    build: make({ hp: 1 }), clone: true,
    actions: (state, i, ctx) => i === 0 ? { a: 'attack', uid: state.actors[1].uid } : i <= ctx.params.PLASTER_DUST_TURNS + 3 ? { a: 'wait' } : null,
    expect(r, params) {
      const uid = r.start.actors[1].uid, died = r.events.find(e => e.k === 'died' && e.who === uid);
      if (!died) return 'the blow did not destroy it';
      const seen = sight(r), blocked = seen.filter(o => !o.across);
      if (seen.some(o => !o.past)) return 'the dust blocked sight along a row it does not reach';
      if (blocked.length !== params.PLASTER_DUST_TURNS) return `sight across its tile was blocked at ${blocked.length} of your decisions, not ${params.PLASTER_DUST_TURNS}`;
      if (seen.findIndex(o => o.across) !== params.PLASTER_DUST_TURNS) return 'the dust did not block sight at the decisions straight after the blow';
      const kept = State.clone(r.start);
      Step.step(kept, r.steps[0].action);
      const s = kept.dept.surfaces;
      return json(s.map(x => [x.kind, x.x, x.y, x.size, x.by])) === json([['dust', 3, 3, N.PLASTER_DUST_SIZE, uid]]) ? null : `the surfaces after the blow are ${json(s)}`;
    },
  });
  const list = H.species(C, 'plaster');

  test('plaster\'s scenarios cover every species with its clause, at depths 1–7', () => {
    assert.ok(list.length >= 14 && list.every(x => x.sp.modifiers.includes('plaster')), json(list.map(x => x.sp.id)));
    assert.deepEqual([...new Set(list.map(x => x.depth))], H.DEPTHS);
  });

  for (const sc of [health, dust]) {
    test(`plaster: ${sc.name}, for every species at depths 1–7, invariants and clone checked`, () => {
      assert.deepEqual(H.failures(H.sweep(C, sc, list)), []);
    });
    test(`plaster: switched off (rulesOff), "${sc.name}" fails at every species and depth`, () => {
      const s = H.sensitivity(C, sc, 'plaster', list);
      assert.ok(s.sensitive, s.problems.join('\n'));
      assert.equal(s.runs.length, list.length);
    });
  }

  test('plaster: in a department, every cast has PLASTER_HP_PCT% of its role\'s health at the depth, and switched off, its role\'s', () => {
    let casts = 0;
    for (const depth of H.DEPTHS) for (const off of [false, true]) {
      const s = Dept.create(1, 'A4', depth, off ? { rulesOff: ['plaster'] } : undefined);
      for (const a of s.actors.slice(1).filter(x => x.mods.includes('plaster'))) {
        const role = Roles.stats(a.role, depth).hp, want = off ? role : Math.max(1, Int.pct(role, N.PLASTER_HP_PCT));
        assert.equal(json([a.hp, a.maxHp]), json([want, want]), `${a.uid} at depth ${depth}${off ? ', plaster off' : ''}`);
        casts++;
      }
    }
    assert.ok(casts >= 14, `${casts} casts placed`);
  });

  // "When destroyed it crumbles into dust" (§8.1: "Destroyed, it leaves dust"), whatever
  // destroyed it: a special, a shot, a reflected line or an item's bolt, from an exhibit or
  // from you, leaves the same dust as your blow, made by the cast.
  const hit = (k, a, by, n) => ({
    special: { k, by: by.uid, sp: 'ring', gross: n, pad: 0, net: n, x: a.x, y: a.y, from: [by.x, by.y] },
    shot: { k, by: by.uid, at: a.uid, chance: 75, roll: 10, raw: n, pad: 0, how: { kind: 'shot' }, from: [a.x + 1, a.y], range: 3 },
    reflected: { k, by: by.uid, shooter: 'you', raw: n, pad: 0, from: [a.x + 1, a.y] },
    item: { k, by: 'you', at: a.uid, chance: 75, roll: 10, raw: n, pad: 0, how: { kind: 'shot' }, from: [a.x - 1, a.y], range: 2, item: 'you.i' },
  })[k];
  test('plaster: a cast destroyed by any hit, a special, a shot, a reflected line or an item, from an exhibit or from you, leaves its dust', () => {
    const sp = Packs.speciesFor(null, { sp: 'A4.1a' }), other = Packs.speciesFor(null, { sp: 'A4.1' });
    for (const k of ['special', 'shot', 'reflected', 'item']) {
      const s = Setup.room(1, { acc: 'T0', depth: 3, map: ROOM, you: [1, 1], exhibits: [
        { sp: 'A4.1a', at: [3, 3], mode: 'hunting', stats: Roles.stats(sp.role, 3) },
        { sp: 'A4.1', at: [6, 5], mode: 'hunting', stats: Roles.stats(other.role, 3) }] });
      const [, a, by] = s.actors, ev = [];
      Combat.hurt(s, a, a.hp, hit(k, a, by, a.hp), ev);
      assert.ok(a.gone, `${k}: not destroyed`);
      assert.equal(json(s.dept.surfaces.map(x => [x.kind, x.x, x.y, x.size, x.by])), json([['dust', 3, 3, N.PLASTER_DUST_SIZE, a.uid]]), k);
      for (const e of ev) assert.equal(Causes.check(e), null, json(e));
    }
  });

  test('plaster: the invariant catches a cast with the usual health in a department, a maximum that changes, and a death with no dust', () => {
    const inv = Inv.select(C, ['plaster_cast'])[0];
    const s = Dept.create(1, 'A4', 3), cast = s.actors.find(a => a.mods.includes('plaster'));
    const check = (pre, events, post, a) => inv.check(pre, events, post, { uid: a.uid, actor: a, before: pre.actors.find(x => x.uid === a.uid), action: { a: 'wait' }, step: 1 });
    assert.equal(check(State.clone(s), [], s, cast), null);
    const wrong = State.clone(s), w = wrong.actors.find(a => a.uid === cast.uid);
    w.maxHp = Roles.stats(w.role, 3).hp;
    assert.match(check(State.clone(wrong), [], wrong, w), /^has \d+ maximum health; a cast of a \S+ at depth 3 has \d+$/);
    const grown = State.clone(s), g = grown.actors.find(a => a.uid === cast.uid);
    g.maxHp++;
    assert.match(check(State.clone(s), [], grown, g), /^its maximum health went from/);
    const gone = State.clone(s), d = gone.actors.find(a => a.uid === cast.uid);
    d.gone = 1;
    assert.match(check(State.clone(s), [{ k: 'died', turn: s.turn, tick: s.tick, who: d.uid, cause: { k: 'attack' } }], gone, d), /^was destroyed at turn \d+ and left no dust$/);
  });
};
