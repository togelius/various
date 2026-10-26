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
  // The stand-in Pin-Driver: use(uid, x, y) fires a bolt with damage 1–4 and Acc 1 (its own
  // numbers, as KIT's Pin-Driver has: not your weapon's) through Ranged.shoot.
  const PD = 'arch_b.pd', PD_HOW = { kind: 'shot', dmin: 1, dmax: 4, acc: 1 };
  C.Kit.useAction = (state, action, ev) => Ranged.shoot(state, state.actors[0], action.x, action.y, Object.assign({ item: action.uid }, PD_HOW), ev);
  const pinDriver = [{ uid: PD, kind: 'instrument', where: { at: 'kit', slot: 'instrument' }, tier: 1, charges: N.PIN_DRIVER[0], max: N.PIN_DRIVER[0] }];
  function track(r, uid) {
    const a = r.start.actors.find(x => x.uid === uid);
    let p = [a.x, a.y];
    const out = [p];
    for (const s of r.steps) { for (const e of s.events) if (e.k === 'moved' && e.who === uid) p = e.to; out.push(p); }
    return out;
  }
  const hurt = (r, who) => r.events.filter(e => e.k === 'damaged' && e.who === who);
  // The kinds of the events an actor causes (by) or suffers (who) that neither Clauses.UNIVERSAL
  // nor any part of its species' Behaviour line covers (§5.3: each clause covers its kinds).
  const uncovered = (r, sp, depth, uid) => {
    const covers = new Set(C.Clauses.UNIVERSAL);
    for (const p of C.Clauses.of(sp, { depth, rulesOff: r.rulesOff })) for (const k of p.covers || []) covers.add(k);
    return [...new Set(r.events.filter(e => (e.by === uid || e.who === uid) && !covers.has(e.k)).map(e => e.k))];
  };
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
    expect(r, params, sp, depth) {
      const dish = r.start.actors[1].uid, behind = r.start.actors[2].uid;
      const back = r.events.filter(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.k === 'reflected');
      const loose = uncovered(r, sp, depth, dish);
      if (loose.length) return `the dish caused ${json(loose)}, which its Behaviour line does not cover`;
      if (back.length !== 6) return `${back.length} of 6 bolts came back`;
      if (back.some(e => (e.who || e.at) !== 'you' || e.cause.by !== dish || e.cause.shooter !== 'you')) return `a bolt came back as ${json(back.find(e => (e.who || e.at) !== 'you'))}`;
      if (!back.some(e => e.k === 'damaged')) return 'no bolt that came back hurt you';
      // Rolled with the Pin-Driver's own Acc and damage, not your weapon's: the chance its Acc
      // gives against your Eva, a hit on a roll at or below it, damage in its range.
      const you = r.start.actors[0], chance = C.Combat.hitChance(you, you, { acc: PD_HOW.acc });
      if (chance === C.Combat.hitChance(you, you)) return 'the stand-in\'s Acc must differ from your weapon\'s to show which is used';
      for (const e of back) {
        if (e.cause.chance !== chance) return `a bolt came back at ${e.cause.chance}%, not the ${chance}% the Pin-Driver's Acc gives`;
        if ((e.k === 'damaged') !== (e.cause.roll <= e.cause.chance)) return `a bolt that rolled ${e.cause.roll} against ${e.cause.chance}% ${e.k === 'damaged' ? 'hit' : 'missed'}`;
        if (e.k === 'damaged' && !(e.cause.raw >= PD_HOW.dmin && e.cause.raw <= PD_HOW.dmax)) return `a bolt came back for ${e.cause.raw}, outside the Pin-Driver's ${PD_HOW.dmin}–${PD_HOW.dmax}`;
      }
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
      // Its own beam, back from the dish, is the dish's (§8.1: a line a reflector sends back is
      // the reflector's on the tiles it reaches only on its way back), naming the sniper.
      const own = hurt(r, sn.uid).filter(e => e.cause.sp === 'line' && e.cause.k === 'reflected' && e.cause.by === dish.uid && e.cause.shooter === sn.uid);
      if (own.length !== 1 || hurt(r, sn.uid).length !== 1) return `the sniper took its own beam ${own.length} times (${json(hurt(r, sn.uid).map(e => e.cause))})`;
      if (hurt(r, 'you').filter(e => e.cause.k === 'special').length !== 1) return 'you were not hit once';
      return hurt(r, behind.uid).length ? 'the exhibit behind the dish was hit' : null;
    },
  })));

  // Behind the sniper, the beam sent back strikes on, as the dish's: the sniper and a body
  // beyond it are hit by the dish (reflected, shooter the sniper), you by the sniper's beam on
  // its way out; and the sentences say so.
  test('a beam sent back is the reflector\'s on every tile it reaches only on its way back, the sniper\'s tile and those behind it', () => sweep(H.scenario({
    name: 'a beam sent back by a dish strikes the sniper and what stands behind it as the dish\'s, naming the sniper', id: 'reflector', clone: true,
    build: (params, sp, depth, opts) => room(sp, depth, opts, CORRIDOR, [4, 1], [body(sp, depth, [2, 1], { mode: 'dormant', stats: Object.assign(Roles.stats(sp.role, depth), { hp: 999 }) }), sniper(depth, [6, 1]), fodder(depth, [8, 1])]),
    actions: waits(2),
    expect(r) {
      const [, dish, sn, beyond] = r.start.actors, names = C.Labels.nameOf(r.state);
      const tel = r.steps[0].events.find(e => e.k === 'telegraphed' && e.who === sn.uid);
      if (!tel) return 'the sniper did not aim';
      for (const [who, k, by] of [['you', 'special', sn.uid], [sn.uid, 'reflected', dish.uid], [beyond.uid, 'reflected', dish.uid]]) {
        const hit = hurt(r, who).filter(e => e.cause.sp === 'line');
        if (hit.length !== 1 || hit[0].cause.k !== k || hit[0].cause.by !== by || (k === 'reflected' && hit[0].cause.shooter !== sn.uid)) return `${who} was struck ${json(hit.map(e => [e.cause.k, e.cause.by, e.cause.shooter]))}; once, ${k} by ${by}, was expected`;
        if (k === 'reflected' && !/sent .* beam back into/.test(C.Text.event(hit[0], names))) return `the sentence does not name the dish: ${C.Text.event(hit[0], names)}`;
      }
      return null;
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
    let hits = 0, misses = 0;
    // A bolt sent back is rolled as a shot (§8.1): it hits on a roll at or below its chance.
    const rolledRight = out => assert.equal(out.k, out.cause.roll <= out.cause.chance ? 'damaged' : 'missed', `rolled ${out.cause.roll} against ${out.cause.chance}%`);
    for (let seed = 1; seed <= 40; seed++) {
      // You shoot west at a tile past a dish: the bolt meets it, and comes back along 5 and 6 into you.
      const a = Setup.room(seed, { acc: 'T0', depth: 1, map: CORRIDOR, you: [7, 1], exhibits: [ex([4, 1], { arch: 'reflector', mode: 'dormant' })] });
      const f = Ranged.flight(a, a.actors[0], 1, 1, 6);
      assert.equal(json([f.code, f.at, f.reflector, f.victim, f.dist, f.via, f.viaOut, f.tiles]), json([null, a.actors[1].uid, a.actors[1].uid, 'you', 3, [6, 1], [5, 1], [[6, 1], [5, 1], [4, 1], [7, 1]]]));
      // An instrument's bolt sent back is made with the instrument's Acc and damage (how.acc,
      // how.dmin, how.dmax), not your weapon's: here Acc 0 and 9 damage, which your weapon
      // (Acc 3, 2–6) could not give.
      const you = a.actors[0], how = { kind: 'shot', item: 'arch_b.pd', dmin: 9, dmax: 9, acc: 0 }, pv = [];
      assert.notEqual(C.Combat.hitChance(you, you, how), C.Combat.hitChance(you, you));
      assert.ok(you.dmax < 9);
      const youRoll = C.Rng.stream(State.clone(a), 'combat/you').d100();
      assert.equal(Ranged.shoot(a, you, 3, 1, how, pv), N.COST_USE);
      for (const e of pv) assert.equal(Causes.check(e), null, json(e));
      const mine = pv.find(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.k === 'reflected');
      assert.equal(json([mine.cause.shooter, mine.cause.roll, mine.cause.chance]), json(['you', youRoll, C.Combat.hitChance(you, you, how)]));
      rolledRight(mine);
      if (mine.k === 'damaged') assert.equal(json([mine.who, mine.cause.raw, mine.amount]), json(['you', 9, 9 - you.pad]));
      // A gunner at 1 shoots east at you: its bolt meets the dish at 4 and comes back into it;
      // the exhibit at 6, behind the dish, and you are untouched.
      const s = Setup.room(seed, { acc: 'T0', depth: 1, map: CORRIDOR, you: [7, 1], exhibits: [ex([1, 1], { stats: Object.assign({}, tough, { acc: 2, eva: 1, pad: 1 }) }), ex([4, 1], { arch: 'reflector', mode: 'dormant' }), ex([6, 1], { mode: 'dormant' })] });
      const [, k, dish, behind] = s.actors;
      const ev = [], roll = C.Rng.stream(State.clone(s), 'combat/' + k.uid).d100();
      assert.equal(Ranged.shoot(s, k, s.actors[0].x, s.actors[0].y, { kind: 'shot' }, ev), N.COST_ATTACK);
      for (const e of ev) assert.equal(Causes.check(e), null, json(e));
      const att = ev.find(e => e.k === 'attacked'), out = ev.find(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.k === 'reflected');
      assert.equal(json([att.by, att.at, att.cause.dist, att.how.range, att.how.via]), json([k.uid, dish.uid, 3, 3, [3, 1]]));
      assert.equal(json([out.cause.by, out.cause.shooter, out.cause.roll, out.cause.chance, out.cause.range]), json([dish.uid, k.uid, roll, C.Combat.hitChance(k, k), 3]));
      rolledRight(out);
      if (out.k === 'damaged') {
        hits++;
        assert.equal(json([out.who, out.cause.from, out.amount]), json([k.uid, [2, 1], Math.max(N.DMG_MIN_ON_HIT, out.cause.raw - 1)]));
        assert.ok(out.cause.raw >= 2 && out.cause.raw <= 5);
      } else { misses++; assert.equal(out.at, k.uid); }
      assert.ok(!ev.some(e => e.k === 'damaged' && (e.who === dish.uid || e.who === behind.uid || e.who === 'you')), 'only the shooter is hit');
      const noise = ev.filter(e => e.k === 'noise');
      assert.equal(json([noise[noise.length - 1].x, noise[noise.length - 1].cause.k]), json([1, 'attack']), 'the shot\'s soft noise, at the shooter, last');
      assert.ok(ev.indexOf(noise[noise.length - 1]) > ev.indexOf(out));
    }
    assert.ok(hits > 20 && misses > 0, `${hits} of 40 came back and hit, ${misses} missed`);
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

  // A beam a reflector sends back is the reflector's on the tiles it reaches only on its way
  // back (§8.1; D2.16): Ranged.beamVia names, for each tile of the beam, the reflector that
  // turned it before it entered that tile, or null on its way out. The cause, sentence and
  // invariant for that beam (cause reflected with sp) are ready for Specials.resolve.
  test('Ranged.beamVia names the reflector for each tile a beam reaches on its way back, and nothing on its way out', () => {
    const map = ['############', '#..........#', '############'];
    const s = Setup.room(1, { acc: 'T0', depth: 1, map, you: [4, 1], exhibits: [ex([2, 1], { arch: 'reflector', mode: 'dormant' }), { sp: 'arch_b_sniper', arch: 'axis_sniper', at: [6, 1], mode: 'hunting', stats: tough }] });
    const [, dish, sn] = s.actors;
    assert.equal(json(Ranged.beam(s, sn, 6, N.AXIS_BEAM_RANGE)), json([[5, 1], [4, 1], [3, 1], [2, 1], [6, 1], [7, 1], [8, 1]]), 'out 4 steps, back 6: the way back counts toward its range');
    assert.equal(json(Ranged.beamVia(s, sn, 6, N.AXIS_BEAM_RANGE)), json([null, null, null, null, dish.uid, dish.uid, dish.uid]), 'the dish\'s own tile is on the way out');
    assert.equal(json(Ranged.beamVia(s, sn, 2, N.AXIS_BEAM_RANGE)), json([null, null, null, null]), 'east, to the wall, nothing turns it');
    // A glass sniper sends its own beam back again at its own tile, so the beam lists no tile
    // past it: its own tile is the last new one, reached on the way back from the dish.
    const g = Setup.room(1, { acc: 'T0', depth: 1, map, you: [4, 1], exhibits: [ex([2, 1], { arch: 'reflector', mode: 'dormant' }), { sp: 'arch_b_sniper', arch: 'axis_sniper', mods: ['glass'], at: [6, 1], mode: 'hunting', stats: tough }] });
    assert.equal(json([Ranged.beam(g, g.actors[2], 6, N.AXIS_BEAM_RANGE), Ranged.beamVia(g, g.actors[2], 6, N.AXIS_BEAM_RANGE)]), json([[[5, 1], [4, 1], [3, 1], [2, 1], [6, 1]], [null, null, null, null, g.actors[1].uid]]));
  });

  test('a beam sent back has its cause, sentences and invariant: the reflector\'s, naming its shooter, checked against the shooter\'s mark', () => {
    const names = uid => ({ 'd.1': 'the Reflecting Dish', 'h.1': 'the Heliograph', 't.1': 'the Logbook Trolley' })[uid] || null;
    const cause = { k: 'reflected', by: 'd.1', shooter: 'h.1', sp: 'line', gross: 9, pad: 0, net: 9, x: 6, y: 1, from: [5, 1] };
    const own = { k: 'damaged', turn: 3, tick: 300, who: 'h.1', amount: 9, hp: 0, cause };
    assert.equal(Causes.check(own), null);
    assert.equal(C.Text.event(own, names), 'The Reflecting Dish sent the Heliograph’s beam back into itself: 9 damage (9 − 0 Padding).');
    const other = { k: 'damaged', turn: 3, tick: 300, who: 't.1', amount: 2, hp: 7, cause: Object.assign({}, cause, { pad: 1, gross: 2, net: 1, x: 7, side: 'W' }) };
    other.amount = 2;
    assert.equal(C.Text.event(other, names), 'The Reflecting Dish sent the Heliograph’s beam back into the Logbook Trolley: 2 damage (2 − 1 Padding, doubled through its repaired west side).');
    const floor = { k: 'damaged', turn: 3, tick: 300, who: 't.1', amount: 1, hp: 8, cause: Object.assign({}, cause, { pad: 3, gross: 2, net: 1, x: 7 }) };
    assert.equal(C.Text.event(floor, names), 'The Reflecting Dish sent the Heliograph’s beam back into the Logbook Trolley: 1 damage (2 − 3 Padding, at least 1).');
    assert.equal(C.Text.event({ k: 'died', turn: 3, tick: 300, who: 'h.1', cause }, names), 'The Heliograph broke apart on its own beam, sent back by the Reflecting Dish.');
    // The invariant checks a beam sent back against its shooter's mark.
    const inv = require(path.join(root, 'test/behaviour/arch-b.inv.js'))(C).find(i => i.id === 'arch_b_line_hits_marked_tiles');
    const pre = Setup.room(1, { acc: 'T0', depth: 1, map: ['##########', '#........#', '##########'], you: [4, 1], exhibits: [ex([2, 1], { arch: 'reflector', mode: 'dormant' }), { sp: 'arch_b_sniper', arch: 'axis_sniper', at: [6, 1], mode: 'hunting', stats: tough }] });
    const sn = pre.actors[2], tiles = C.Specials.tiles(pre, sn, 'line');
    C.Specials.mark(pre, sn, 'line', tiles, []);
    const hit = (x, gross) => [{ k: 'damaged', turn: 1, tick: 100, who: sn.uid, amount: 9, hp: 1, cause: { k: 'reflected', by: pre.actors[1].uid, shooter: sn.uid, sp: 'line', gross, pad: 0, net: gross, x, y: 1, from: [5, 1] } }];
    const g = sn.telegraph.gross;
    assert.equal(inv.check(pre, hit(6, g), pre), null);
    assert.ok(/never marked/.test(inv.check(pre, hit(9, g), pre)), 'a tile off the mark');
    assert.ok(/its mark said/.test(inv.check(pre, hit(6, g + 1), pre)), 'a gross other than the mark\'s');
    // The mark records, per tile, who sent the beam back (via): the dish on the sniper's tile
    // and behind it, nobody on its way out; and COMBAT's combat_special_shown holds a hit to it,
    // so a returned tile struck as the sniper's own special, or a tile on the way out struck as
    // the dish's, is caught.
    const dish = pre.actors[1].uid;
    assert.equal(json(sn.telegraph.tiles.map((t, i) => [t[0], sn.telegraph.via[i]])), json([[2, null], [3, null], [4, null], [5, null], [6, dish], [7, dish], [8, dish]]));
    const shown = require(path.join(root, 'test/behaviour/combat.inv.js'))(C).find(i => i.id === 'combat_special_shown');
    assert.equal(shown.check(pre, hit(6, g), pre), null);
    const asOwn = hit(6, g); asOwn[0].cause = { k: 'special', by: sn.uid, sp: 'line', gross: g, pad: 0, net: g, x: 6, y: 1, from: [5, 1] };
    assert.ok(/as special, but its mark there was sent back by/.test(shown.check(pre, asOwn, pre)), 'a returned tile struck as the sniper\'s own');
    const outbound = hit(5, g);
    assert.ok(/but its mark there was on its way out/.test(shown.check(pre, outbound, pre)), 'a tile on its way out struck as the dish\'s');
  });
};
