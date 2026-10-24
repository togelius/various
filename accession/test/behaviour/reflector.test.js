// The reflector's Behaviour-line clause (BUILD.md §5.3, §5.5, §8.1): "Walks one tile at a time;
// sends beams back along their line, and shots back into whoever fired them, so nothing behind
// it is hit; strikes from beside you for only {dmg}." Each scenario is a function of the
// clause's parameters, run for every species whose line has it (the Reflecting Dishes), at
// every depth 1–7, with every invariant checked after every step and a clone check. Your
// Pin-Driver is W1-KIT's; here, in this test's own core, a stand-in fires it through
// Ranged.shoot as the plan says KIT's does, so the reflector's rule is tested on its own.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const C = loadCore();
  const { Setup, Roles, Ranged, State, Causes, N } = C;
  const json = x => JSON.stringify(x);
  const accOf = sp => C.Packs.list().find(p => p.species.includes(sp)).acc;
  const range = d => { const [lo, hi] = String(d).split('–').map(Number); return [lo, hi === undefined ? lo : hi]; };
  const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
  const waits = n => Array.from({ length: n }, () => ({ a: 'wait' }));
  const OPEN = ['############', ...Array.from({ length: 5 }, () => '#..........#'), '############'];
  const CORRIDOR = ['##########', '#........#', '##########'];
  const room = (sp, depth, opts, map, you, exhibits, items) => Setup.room(opts.seed, { acc: accOf(sp), depth, map, you, exhibits, items: items || [] }, { rulesOff: opts.rulesOff, invulnerable: true });
  const body = (sp, depth, at, extra) => Object.assign({ sp: sp.id, at, mode: 'hunting', stats: Roles.stats(sp.role, depth) }, extra || {});
  const fodder = (depth, at) => ({ sp: 'arch_b_fodder', arch: 'plodder', at, mode: 'dormant', stats: Object.assign(Roles.stats('fodder', depth), { hp: 999 }) });
  const sniper = (depth, at) => ({ sp: 'arch_b_sniper', arch: 'axis_sniper', at, mode: 'hunting', stats: Roles.stats('artillery', depth) });
  // The stand-in Pin-Driver: use(uid, x, y) fires a bolt with damage 1–4 through Ranged.shoot.
  const PD = 'arch_b.pd';
  C.Kit.useAction = (state, action, ev) => Ranged.shoot(state, state.actors[0], action.x, action.y, { kind: 'shot', item: action.uid, dmin: 1, dmax: 4 }, ev);
  const pinDriver = [{ uid: PD, kind: 'instrument', where: { at: 'kit', slot: 'instrument' }, tier: 1, charges: N.PIN_DRIVER[0], max: N.PIN_DRIVER[0] }];
  function track(r, uid) {
    const a = r.start.actors.find(x => x.uid === uid);
    let p = [a.x, a.y];
    const out = [p];
    for (const s of r.steps) { for (const e of s.events) if (e.k === 'moved' && e.who === uid) p = e.to; out.push(p); }
    return out;
  }
  const hurt = (r, who) => r.events.filter(e => e.k === 'damaged' && e.who === who);
  const sweep = sc => {
    const res = H.sweep(C, sc);
    assert.ok(res.length >= 7, `${sc.name}: ${res.length} runs`);
    assert.deepEqual(H.failures(res), []);
    return res;
  };

  test('the reflector\'s clause is on the Reflecting Dishes, at every depth', () => {
    const list = H.species(C, 'reflector');
    assert.ok(list.length >= 7 && list.every(x => x.sp.archetype === 'reflector'), json(list.map(x => x.sp.id)));
    assert.equal(C.Registry.ARCHETYPES.reflector.ready, 'unit');
  });

  test('it walks one tile at a time, and strikes from beside you for its damage', () => sweep(H.scenario({
    name: 'a hunting dish walks to you a tile a turn, then strikes for dmg', id: 'reflector', clone: true, seeds: [1, 2],
    build: (params, sp, depth, opts) => room(sp, depth, opts, OPEN, [2, 3], [body(sp, depth, [7, 3])]),
    actions: waits(10),
    expect(r, params) {
      const [lo, hi] = range(params.dmg), uid = r.start.actors[1].uid, me = track(r, uid), you = track(r, 'you');
      for (let i = 0; i + 1 < me.length; i++) if (cheb(me[i], me[i + 1]) > 1) return `step ${i}: it moved ${cheb(me[i], me[i + 1])} tiles`;
      const hits = hurt(r, 'you').filter(e => e.cause.by === uid);
      if (!hits.length) return 'it never struck';
      for (const e of hits) if (e.cause.k !== 'attack' || e.cause.raw < lo || e.cause.raw > hi) return `a blow's cause was ${json(e.cause)}, outside ${params.dmg}`;
      return cheb(me[me.length - 1], you[you.length - 1]) === 1 ? null : 'it did not come beside you';
    },
  })));

  test('your shots at it come back into you, and nothing behind it is hit', () => sweep(H.scenario({
    name: 'your Pin-Driver bolts at a dish come back into you; the dish and an exhibit behind it are untouched', id: 'reflector', clone: true, seeds: [1, 2],
    build: (params, sp, depth, opts) => room(sp, depth, opts, CORRIDOR, [1, 1], [body(sp, depth, [4, 1], { mode: 'dormant' }), fodder(depth, [6, 1])], pinDriver),
    actions(state, i) {
      const dish = state.actors[1];
      return i < 6 ? { a: 'use', uid: PD, x: dish.x, y: dish.y } : null;
    },
    expect(r) {
      const dish = r.start.actors[1].uid, behind = r.start.actors[2].uid;
      const back = r.events.filter(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.k === 'reflected');
      if (back.length !== 6) return `${back.length} of 6 bolts came back`;
      if (back.some(e => (e.who || e.at) !== 'you' || e.cause.by !== dish || e.cause.shooter !== 'you')) return `a bolt came back as ${json(back.find(e => (e.who || e.at) !== 'you'))}`;
      if (!back.some(e => e.k === 'damaged')) return 'no bolt that came back hurt you';
      if (hurt(r, dish).some(e => e.cause.k !== 'attack')) return 'a shot struck the dish';
      return hurt(r, behind).length ? 'the exhibit behind the dish was hit' : null;
    },
  })));

  test('a beam that reaches it goes back along its line: past you, into the sniper that fired it, and never behind it', () => sweep(H.scenario({
    name: 'a sniper\'s beam, with you between it and a dish, comes back into the sniper; nothing behind the dish is hit', id: 'reflector', clone: true,
    build: (params, sp, depth, opts) => room(sp, depth, opts, CORRIDOR, [4, 1], [body(sp, depth, [2, 1], { mode: 'dormant', stats: Object.assign(Roles.stats(sp.role, depth), { hp: 999 }) }), fodder(depth, [1, 1]), sniper(depth, [6, 1])]),
    actions: waits(2),
    expect(r) {
      const [, dish, behind, sn] = r.start.actors;
      const mark = r.steps[0].events.find(e => e.k === 'telegraphed' && e.who === sn.uid);
      if (!mark) return 'the sniper did not aim';
      if (json(mark.tiles) !== json([[2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1]])) return `its line was ${json(mark.tiles)}`;
      const own = hurt(r, sn.uid).filter(e => e.cause.k === 'special' && e.cause.by === sn.uid);
      if (own.length !== 1) return `the sniper took its own beam ${own.length} times`;
      if (hurt(r, 'you').filter(e => e.cause.k === 'special').length !== 1) return 'you were not hit once';
      return hurt(r, behind.uid).length ? 'the exhibit behind the dish was hit' : null;
    },
  })));

  // The rule itself, on small maps (BUILD.md §8.1).
  const tough = { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 2, dmax: 5 };
  const ex = (at, extra) => Object.assign({ sp: 'arch_b_target', at, mode: 'hunting', stats: tough }, extra || {});

  test('Ranged.reflectorAt finds a reflector or a glass body, unless glass is switched off; nothing else, and nothing gone', () => {
    const spec = { acc: 'T0', depth: 1, map: CORRIDOR, you: [1, 1], exhibits: [ex([3, 1], { arch: 'reflector' }), ex([5, 1], { mods: ['glass'] }), ex([7, 1])] };
    const s = Setup.room(1, spec), [, d, g, p] = s.actors;
    assert.equal(json([2, 3, 4, 5, 7].map(x => Ranged.reflectorAt(s, x, 1))), json([null, d.uid, null, g.uid, null]));
    assert.equal(json([Ranged.isReflector(s, s.actors[0]), Ranged.isReflector(s, p)]), json([false, false]));
    const off = Setup.room(1, spec, { rulesOff: ['glass'] });
    assert.equal(json([Ranged.reflectorAt(off, 3, 1), Ranged.reflectorAt(off, 5, 1)]), json([off.actors[1].uid, null]), 'glass switched off reflects nothing; a reflector still does');
    d.gone = 1;
    assert.equal(Ranged.reflectorAt(s, 3, 1), null);
  });

  test('a bolt that meets a reflector comes back along its tiles, each listed once, into its shooter, and is rolled as a shot at it', () => {
    let hits = 0;
    for (let seed = 1; seed <= 40; seed++) {
      // You shoot west at a tile past a dish: the bolt meets it, and comes back along 5 and 6 into you.
      const a = Setup.room(seed, { acc: 'T0', depth: 1, map: CORRIDOR, you: [7, 1], exhibits: [ex([4, 1], { arch: 'reflector', mode: 'dormant' })] });
      const f = Ranged.flight(a, a.actors[0], 1, 1, 6);
      assert.equal(json([f.code, f.at, f.reflector, f.victim, f.dist, f.via, f.viaOut, f.tiles]), json([null, a.actors[1].uid, a.actors[1].uid, 'you', 3, [6, 1], [5, 1], [[6, 1], [5, 1], [4, 1], [7, 1]]]));
      // A gunner at 1 shoots east at you: its bolt meets the dish at 4 and comes back into it;
      // the exhibit at 6, behind the dish, and you are untouched.
      const s = Setup.room(seed, { acc: 'T0', depth: 1, map: CORRIDOR, you: [7, 1], exhibits: [ex([1, 1], { stats: Object.assign({}, tough, { acc: 2, eva: 1, pad: 1 }) }), ex([4, 1], { arch: 'reflector', mode: 'dormant' }), ex([6, 1], { mode: 'dormant' })] });
      const [you, k, dish, behind] = s.actors;
      const ev = [], roll = C.Rng.stream(State.clone(s), 'combat/' + k.uid).d100();
      assert.equal(Ranged.shoot(s, k, you.x, you.y, { kind: 'shot' }, ev), N.COST_ATTACK);
      for (const e of ev) assert.equal(Causes.check(e), null, json(e));
      const att = ev.find(e => e.k === 'attacked'), out = ev.find(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.k === 'reflected');
      assert.equal(json([att.by, att.at, att.cause.dist, att.how.range, att.how.via]), json([k.uid, dish.uid, 3, 3, [3, 1]]));
      assert.equal(json([out.cause.by, out.cause.shooter, out.cause.roll, out.cause.chance, out.cause.range]), json([dish.uid, k.uid, roll, C.Combat.hitChance(k, k), 3]));
      if (out.k === 'damaged') {
        hits++;
        assert.equal(json([out.who, out.cause.from, out.amount]), json([k.uid, [2, 1], Math.max(N.DMG_MIN_ON_HIT, out.cause.raw - 1)]));
        assert.ok(out.cause.raw >= 2 && out.cause.raw <= 5);
      } else assert.equal(out.at, k.uid);
      assert.ok(!ev.some(e => e.k === 'damaged' && (e.who === dish.uid || e.who === behind.uid || e.who === 'you')), 'only the shooter is hit');
      const noise = ev.filter(e => e.k === 'noise');
      assert.equal(json([noise[noise.length - 1].x, noise[noise.length - 1].cause.k]), json([1, 'attack']), 'the shot\'s soft noise, at the shooter, last');
      assert.ok(ev.indexOf(noise[noise.length - 1]) > ev.indexOf(out));
    }
    assert.ok(hits > 20, `${hits} of 40 came back and hit`);
  });

  test('the sentences of a shot sent back name the reflector and the shooter', () => {
    const names = uid => ({ 'd.1': 'the Reflecting Dish', 'k.1': 'the Signal Lamp' })[uid] || null;
    const how = { kind: 'shot', range: 3, via: [3, 1] };
    const hit = { k: 'damaged', turn: 1, tick: 100, who: 'k.1', amount: 4, hp: 6, cause: { k: 'reflected', by: 'd.1', shooter: 'k.1', chance: 80, roll: 12, how, range: 3, raw: 5, pad: 1, from: [2, 1] } };
    assert.equal(C.Text.event(hit, names), 'The Reflecting Dish sent the Signal Lamp’s shot back into itself: 4 damage (rolled 12 against 80%; 5 − 1 Padding).');
    const you = Object.assign({}, hit, { who: 'you', cause: Object.assign({}, hit.cause, { shooter: 'you', side: 'W' }) });
    assert.equal(C.Text.event(you, names), 'The Reflecting Dish sent your shot back into you: 4 damage (rolled 12 against 80%; 5 − 1 Padding, doubled through its repaired west side).');
    assert.equal(C.Text.event({ k: 'missed', turn: 1, tick: 100, by: 'd.1', at: 'you', cause: { k: 'reflected', by: 'd.1', shooter: 'you', chance: 80, roll: 92, how, range: 3 } }, names),
      'The Reflecting Dish sent your shot back, and it missed you (rolled 92 against 80%).');
    assert.equal(C.Text.event({ k: 'died', turn: 1, tick: 100, who: 'you', cause: you.cause }, names), 'You fell to your own shot, sent back by the Reflecting Dish.');
    assert.equal(C.Text.event({ k: 'died', turn: 1, tick: 100, who: 'k.1', cause: hit.cause }, names), 'The Signal Lamp broke apart on its own shot, sent back by the Reflecting Dish.');
  });
};
