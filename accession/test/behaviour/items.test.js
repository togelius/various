// ACCESSION — the kit's clauses as scenarios (BUILD.md §5.3 checks 1–2; §8.1, §8.5): one
// scenario per entry of reg/items.js, written as a function of that entry's numbers of
// record (its params, filled at the depth), run at every depth 1–7 with every invariant
// checked after every step and the run clone-checked. Items belong to no species, so each
// scenario is run with no species; its depth picks the tier on offer there
// (TIER_LOW_BY_DEPTH), a primitive's size and a curio's rank, so that the seven runs cover
// every size and several tiers and levels. Where a clause names another system's rule (a
// bolt, a case that can be reached), it is that system's real rule: every scenario runs
// joined up, with no hook stood in for (W2a-BEHAVIOUR).
'use strict';
const H = require('./_harness.js');

module.exports = ({ test, assert, loadCore }) => {
  // The real core: the kit's bolt is W1-ARCH-B's Ranged.shoot, and a case's contents are
  // within reach as W1-CASES's Cases.reach says, with nothing stood in for (W2a-BEHAVIOUR).
  const C = loadCore();
  const { Setup, Registry: R, Clauses, Kit, Cases, Vision, Roles, N } = C;
  const json = JSON.stringify;
  const CLS = ['S', 'M', 'L'];
  const P = (table, id, depth) => Clauses.params(R[table][id].params, null, { depth });
  // A signed term a clause leaves out because it is 0 has no parameter (reg/items.js): read as 0.
  const or0 = v => v === undefined ? 0 : v;
  const tierAt = depth => N.TIER_LOW_BY_DEPTH[depth - 1];
  const MAP = ['#############', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#############'];
  // A training exhibit that never lands a blow and never falls, unless stats are given.
  const dummy = (at, mode, stats) => ({ sp: 'dummy', at, mode: mode || 'hunting', stats: Object.assign({ hp: 999, acc: -99, eva: 0, pad: 0, dmin: 1, dmax: 1 }, stats || {}) });
  const room = (depth, rulesOff, spec) => Setup.room(depth, Object.assign({ acc: 'T0', depth, map: MAP, you: [3, 3], exhibits: [] }, spec), { rulesOff });
  const at = (s, uid) => s.items.find(i => i.uid === uid);
  const you = s => s.actors[0];
  const ev = (r, k, f) => r.events.filter(e => e.k === k && (!f || f(e)));

  // Run a scenario at depths 1–7 (seed = depth), all invariants, clone-checked.
  function every(sc) {
    const results = [];
    for (const depth of H.DEPTHS) results.push(H.run(C, sc, null, depth, { seed: depth, clone: true }));
    assert.deepEqual(H.failures(results), [], sc.name);
    return results;
  }
  const scenario = def => H.scenario(Object.assign({ inv: 'all', clone: true }, def));

  test('the sized primitives: a damage, Acc, Eva or Padding bonus adds its size\'s number, and a curio\'s rank 1 more each', () => {
    for (const id of ['dmg', 'acc', 'eva', 'pad']) {
      every(scenario({
        name: `ITEM_PRIMS.${id}`,
        build: (params, sp, depth, { rulesOff }) => room(depth, rulesOff, {
          items: [{ uid: 'c', kind: 'curio', where: { at: 'tote' }, prims: [{ id, cls: CLS[depth % 3] }], level: depth % 2 }],
          exhibits: [dummy([4, 3], 'hunting', { acc: 50 })] }),
        actions: (s, i) => [{ a: 'equip', uid: 'c' }, { a: 'attack', uid: s.actors[1].uid }, { a: 'wait' }][i] || null,
        expect(r, params, sp, depth) {
          const p = P('ITEM_PRIMS', id, depth), n = p[CLS[depth % 3]] + depth % 2, a = you(r.start), b = you(r.state);
          const want = { dmg: [a.dmin + n, a.dmax + n, a.acc, a.eva, a.pad], acc: [a.dmin, a.dmax, a.acc + n, a.eva, a.pad], eva: [a.dmin, a.dmax, a.acc, a.eva + n, a.pad], pad: [a.dmin, a.dmax, a.acc, a.eva, a.pad + n] }[id];
          if (json([b.dmin, b.dmax, b.acc, b.eva, b.pad]) !== json(want)) return `with a ${CLS[depth % 3]} ${id} bonus of rank ${depth % 2}, your stats are ${json([b.dmin, b.dmax, b.acc, b.eva, b.pad])}, not ${json(want)}`;
          // Your blow is rolled with them, and the exhibit's blows meet them.
          const mine = ev(r, 'attacked', e => e.by === 'you').length ? r.events.find(e => (e.k === 'damaged' || e.k === 'missed') && e.cause && e.cause.by === 'you') : null;
          if (!mine) return 'your blow was not struck';
          const chance = Math.min(95, Math.max(10, 75 + 5 * (b.acc - 0)));
          if (mine.cause.chance !== chance) return `your blow had ${mine.cause.chance}% to hit, not ${chance}%`;
          if (mine.k === 'damaged' && (mine.cause.raw < b.dmin || mine.cause.raw > b.dmax)) return `your blow rolled ${mine.cause.raw}, outside ${b.dmin}–${b.dmax}`;
          const theirs = r.events.filter(e => (e.k === 'damaged' || e.k === 'missed') && e.cause && e.cause.by === r.state.actors[1].uid && e.turn >= 1);
          for (const e of theirs) {
            if (e.cause.chance !== Math.min(95, Math.max(10, 75 + 5 * (50 - b.eva)))) return `its blow had ${e.cause.chance}% to hit you at Eva ${b.eva}`;
            if (e.k === 'damaged' && e.cause.pad !== b.pad) return `its blow met Padding ${e.cause.pad}, not ${b.pad}`;
          }
          return null;
        },
      }));
    }
  });

  test('reach, quiet and breaker: a reach primitive makes your blows Reach blows; quiet makes your ring smaller after a move, so a sleeper at its edge gains nothing; breaker adds a bash', () => {
    every(scenario({
      name: 'ITEM_PRIMS.reach', build: (params, sp, depth, { rulesOff }) => room(depth, rulesOff, { items: [{ uid: 'c', kind: 'curio', where: { at: 'tote' }, prims: [{ id: 'reach', cls: CLS[depth % 3] }] }] }),
      actions: [{ a: 'equip', uid: 'c' }],
      expect: (r, params, sp, depth) => P('ITEM_PRIMS', 'reach', depth).REACH_RANGE === 2 && you(r.state).reach === true && you(r.start).reach === false ? null : `reach: ${you(r.start).reach} then ${you(r.state).reach}`,
    }));
    every(scenario({
      name: 'ITEM_PRIMS.breaker', build: (params, sp, depth, { rulesOff }) => room(depth, rulesOff, { items: [{ uid: 'c', kind: 'curio', where: { at: 'tote' }, prims: [{ id: 'breaker', cls: CLS[depth % 3] }] }, { uid: 'd', kind: 'curio', where: { at: 'tote' }, prims: [{ id: 'breaker', cls: 'S' }] }] }),
      actions: [{ a: 'equip', uid: 'c' }, { a: 'equip', uid: 'd' }],
      expect: (r, params, sp, depth) => you(r.state).breaker === P('ITEM_PRIMS', 'breaker', depth).BREAKER_BASHES && you(r.start).breaker === 0 ? null : `breaker ${you(r.state).breaker}, and two breaker items give no more than one`,
    }));
    // A sleeper three walking tiles from you, in sight: you step back and forth beside it. With
    // a quiet curio your moving ring (RING_MOVING) is QUIET_RING smaller, and it gains no pip;
    // the same walk without the curio wakes it.
    const walk = [0, 4, 0, 4, 0, 4].map(dir => ({ a: 'move', dir }));
    const quiet = (on, depth, rulesOff) => room(depth, rulesOff, { you: [3, 4], exhibits: [dummy([6, 4], 'dormant')],
      items: on ? [{ uid: 'q', kind: 'curio', where: { at: 'kit', slot: 'curio0' }, prims: [{ id: 'quiet', cls: CLS[depth % 3] }] }] : [] });
    every(scenario({
      name: 'ITEM_PRIMS.quiet', build: (params, sp, depth, { rulesOff }) => quiet(true, depth, rulesOff), actions: walk,
      expect(r, params, sp, depth) {
        const q = P('ITEM_PRIMS', 'quiet', depth).QUIET_RING;
        if (Vision.ringRadius(r.state) !== N.RING_MOVING - q) return `your ring after a move is ${Vision.ringRadius(r.state)}, not ${N.RING_MOVING} − ${q}`;
        if (ev(r, 'pip').length) return 'the sleeper at the edge of your moving ring gained a pip';
        const control = H.play(C, quiet(false, depth, []), walk, { inv: [] });
        if (!control.events.some(e => e.k === 'pip' && e.cause.k === 'ring')) return 'without quiet the same walk gains it no pip, so this shows nothing';
        return null;
      },
    }));
  });

  // Reach (CLAUSES.weapon_reach: "it also hits {reach} tiles away in a straight line, over a
  // tile you could step onto that no one stands on"; ITEM_PRIMS.reach: "your blows reach
  // {REACH_RANGE} tiles away in a straight line, as a Reach weapon's do"), played with real
  // attacks, three ways: a Reach weapon at the tier on offer; a Balanced weapon and a curio
  // with the reach primitive, put on first; and the Long-Handled Date Stamp (A4.6, a Light
  // weapon with the primitive). The hunters are scheduled far ahead, so they stay put.
  const REACH_WAYS = {
    form: { id: 'CLAUSES.weapon_reach', range: p => p.reach, kit: depth => ({ weapon: { form: 'reach', tier: tierAt(depth) } }), items: () => [], first: [] },
    curio: { id: 'ITEM_PRIMS.reach', range: p => p.REACH_RANGE, kit: () => undefined,
      items: depth => [{ uid: 'c', kind: 'curio', where: { at: 'tote' }, prims: [{ id: 'reach', cls: CLS[depth % 3] }] }], first: [{ a: 'equip', uid: 'c' }] },
    stamp: { id: 'ITEM_PRIMS.reach', range: p => p.REACH_RANGE, kit: () => undefined, first: [],
      items: depth => { const rec = C.Packs.get('A4').items.find(i => i.id === 'A4.6'); return [{ uid: 'w', kind: 'weapon', ref: rec.id, form: rec.form, tier: tierAt(depth), where: { at: 'kit', slot: 'weapon' }, prims: rec.prims.map(q => ({ id: q.id, cls: q.cls })) }]; } },
  };
  const still = (at, extra) => Object.assign(dummy(at, 'hunting', { eva: 0 }), { next: 1000000, sawYou: true }, extra || {});
  // The blows a run's attack steps struck: each a Reach blow at its target from exactly the
  // clause's range, then its hit or miss, a hit from your tile.
  function reachBlows(r, range) {
    const from = [you(r.start).x, you(r.start).y];
    for (const st of r.steps.filter(q => q.action.a === 'attack')) {
      const a = st.events.find(e => e.k === 'attacked' && e.by === 'you');
      if (!a || a.at !== st.action.uid || a.how.kind !== 'reach' || a.cause.dist !== range) return `no Reach blow from ${range} tiles at ${st.action.uid}: ${json(st.events.map(e => [e.k, e.reason || (e.how && e.how.kind) || null]))}`;
      const res = st.events.find(e => (e.k === 'damaged' || e.k === 'missed') && e.cause && e.cause.by === 'you');
      if (!res || res.cause.how.kind !== 'reach') return `its hit or miss: ${json(res)}`;
      if (res.k === 'damaged' && json(res.cause.from) !== json(from)) return `the blow came from ${json(res.cause.from)}, not your tile ${json(from)}`;
    }
    return null;
  }

  test('Reach, played: a Reach weapon, a curio with the reach primitive and the Long-Handled Date Stamp each strike a hunter exactly {reach} tiles off, straight and diagonal; a body or a wall between, or a corner on either half of a diagonal, refuses it with no blow; without Reach it is out of reach', () => {
    for (const [way, W] of Object.entries(REACH_WAYS)) {
      // You at (3, 3); hunters exactly the range off east and south-east.
      every(scenario({
        name: `${W.id}: ${way}, a hunter the clause's range off east and one south-east, each struck`, id: W.id,
        build: (params, sp, depth, { rulesOff }) => {
          const d = W.range(params);
          return room(depth, rulesOff, { grade: 7, kit: W.kit(depth), items: W.items(depth), exhibits: [still([3 + d, 3]), still([3 + d, 3 + d])] });
        },
        actions: (s, i) => W.first.concat([{ a: 'attack', uid: 'T0.' + s.dept.depth + '.room.1' }, { a: 'attack', uid: 'T0.' + s.dept.depth + '.room.2' }])[i] || null,
        expect(r, params) {
          if (W.range(params) !== N.REACH_RANGE) return `the clause says ${W.range(params)} tiles`;
          if (!you(r.state).reach) return 'you have no Reach';
          if (r.steps.length !== W.first.length + 2) return `${r.steps.length} steps`;
          return reachBlows(r, W.range(params));
        },
      }));
      // The refusals, each a single refused event with no blow, no noise and no time spent:
      // east, a body between (blocked); west, a wall between (blocked); south-east, a wall
      // on the first half's corner (corner); north-east, a wall on the second half's (corner).
      // The curio is worn from the start here.
      const worn = depth => W.items(depth).map(it => it.kind === 'curio' ? Object.assign({}, it, { where: { at: 'kit', slot: 'curio0' } }) : it);
      every(scenario({
        name: `${W.id}: ${way}, a body or a wall between, or a corner on either half, refuses it`, id: W.id,
        build: (params, sp, depth, { rulesOff }) => {
          const map = MAP.slice(), wall = (x, y) => { map[y] = map[y].slice(0, x) + '#' + map[y].slice(x + 1); };
          wall(2, 3); wall(3, 4); wall(5, 2);
          return room(depth, rulesOff, { grade: 7, map, kit: W.kit(depth), items: worn(depth),
            exhibits: [still([5, 3]), still([4, 3]), still([1, 3]), still([5, 5]), still([5, 1])] });
        },
        actions: (s, i) => [1, 3, 4, 5].map(n => ({ a: 'attack', uid: `T0.${s.dept.depth}.room.${n}` }))[i] || null,
        expect(r) {
          const want = ['blocked', 'blocked', 'corner', 'corner'];
          if (!you(r.start).reach) return 'you have no Reach';
          for (let k = 0; k < want.length; k++) {
            const ev = r.steps[k] && r.steps[k].events;
            if (!ev || ev.length !== 1 || ev[0].k !== 'refused' || ev[0].reason !== want[k]) return `attack ${k + 1}: ${json(ev)}, not one refusal ${want[k]}`;
          }
          return you(r.state).next === you(r.start).next && r.state.tick === r.start.tick ? null : `the refusals cost ${you(r.state).next - you(r.start).next} ticks`;
        },
      }));
    }
    // Without Reach (a Balanced weapon, no curio), the same blow is out of reach: the control
    // that shows the scenarios above would fail with Reach switched off.
    every(scenario({
      name: 'without Reach, a hunter 2 tiles off is out of reach', id: 'CLAUSES.weapon_reach',
      build: (params, sp, depth, { rulesOff }) => room(depth, rulesOff, { grade: 7, exhibits: [still([5, 3])] }),
      actions: (s, i) => i === 0 ? { a: 'attack', uid: `T0.${s.dept.depth}.room.1` } : null,
      expect(r) {
        const ev = r.steps[0].events;
        return you(r.state).reach === false && ev.length === 1 && ev[0].k === 'refused' && ev[0].reason === 'out_of_reach' ? null : `without Reach: ${json(ev)}`;
      },
    }));
  });

  test('the instruments: the fork rings where it is aimed, the Pin-Driver\'s bolt has its own damage and your Acc without the weapon\'s, and the pole pushes, pulls and takes; each spends a charge and gets it back', () => {
    // The fork, at a tile within its range, then waited on until its charge comes back.
    every(scenario({
      name: 'INSTRUMENTS.fork', build: (params, sp, depth, { rulesOff }) => room(depth, rulesOff, { items: [{ uid: 'f', kind: 'instrument', form: 'fork', tier: tierAt(depth), where: { at: 'kit', slot: 'instrument' } }] }),
      // Struck at the tile 8 east of you, then waited on until its charge comes back.
      actions: (s, i, ctx) => i === 0 ? { a: 'use', uid: 'f', x: 11, y: 3 } : i <= P('INSTRUMENTS', 'fork', ctx.depth).recharge ? { a: 'wait' } : null,
      expect(r, params, sp, depth) {
        const p = P('INSTRUMENTS', 'fork', depth), noise = ev(r, 'noise', e => e.cause.k === 'fork');
        if (p.range < 8) return 'the tile is beyond the fork';
        if (noise.length !== 1 || noise[0].x !== 11 || noise[0].y !== 3) return `the fork's noise: ${json(noise)}`;
        if (noise[0].cls !== 'soft' || noise[0].cause.by !== 'you' || noise[0].range !== N.NOISE_SOFT) return `the fork's noise is ${noise[0].cls}, by ${noise[0].cause.by}`;
        if (ev(r, 'used')[0].cause.charges !== p.charges - 1) return `the use left ${ev(r, 'used')[0].cause.charges} charges`;
        const f = at(r.state, 'f');
        return f.charges === p.charges && f.rechargeAt === null ? null : `after ${p.recharge} turns the fork has ${f.charges} of ${p.charges} charges`;
      },
    }));
    // The Pin-Driver, at tier t, worn with a Heavy weapon you are short of and a curio with an
    // Acc bonus: the bolt is rolled with PLAYER_ACC and the curio's bonus only.
    let hows = [];
    const keep = C.Ranged.shoot;
    C.Ranged.shoot = (state, att, x, y, how, e) => { hows.push(how); return keep(state, att, x, y, how, e); };
    every(scenario({
      name: 'INSTRUMENTS.pin_driver',
      build(params, sp, depth, { rulesOff }) {
        hows = [];
        return room(depth, rulesOff, { exhibits: [dummy([7, 3], 'hunting', { eva: -20 })], kit: { weapon: { form: 'heavy', tier: 4 } },
          items: [{ uid: 'p', kind: 'instrument', form: 'pin_driver', tier: tierAt(depth), where: { at: 'kit', slot: 'instrument' } }, { uid: 'c', kind: 'curio', where: { at: 'kit', slot: 'curio1' }, prims: [{ id: 'acc', cls: CLS[depth % 3] }] }] });
      },
      actions: [{ a: 'use', uid: 'p', x: 7, y: 3 }],
      expect(r, params, sp, depth) {
        const p = P('INSTRUMENTS', 'pin_driver', depth), t = tierAt(depth), acc = N.PLAYER_ACC + P('ITEM_PRIMS', 'acc', depth)[CLS[depth % 3]];
        const want = { kind: 'shot', item: 'p', dmin: t + or0(p.a), dmax: p.b * t + or0(p.c), acc };
        if (!hows.length || hows.some(h => json(h) !== json(want))) return `the bolt was fired with ${json(hows)}, not ${json(want)}`;
        const hit = r.events.find(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.k === 'item');
        if (!hit || hit.cause.item !== 'p') return 'no bolt reached the exhibit';
        if (r.steps[0].events[0].k !== 'used') return `the use is told after what it did: ${json(r.steps[0].events.map(e => e.k))}`;
        if (hit.k === 'damaged' && (hit.cause.raw < want.dmin || hit.cause.raw > want.dmax)) return `the bolt rolled ${hit.cause.raw}, outside ${want.dmin}–${want.dmax}`;
        if (you(r.state).next - you(r.start).next !== N.COST_USE) return 'the use did not cost COST_USE';
        return at(r.state, 'p').charges === p.charges - 1 ? null : 'the bolt did not spend one charge';
      },
    }));
    C.Ranged.shoot = keep;
    // The pole: a sleeper beside you pushed one tile away, then pulled back from two tiles,
    // then the item in an opened case two tiles away taken. Neither push nor pull wakes it.
    const POLE_MAP = MAP.slice(0, 5).concat(['#..u........#', '#############']);
    every(scenario({
      name: 'INSTRUMENTS.pole',
      build: (params, sp, depth, { rulesOff }) => room(depth, rulesOff, { map: POLE_MAP,
        exhibits: [dummy([4, 3], 'dormant')], fixtures: [Cases.make({ x: 3, y: 5, room: 'room', num: '1.1.1', st: 'open', holds: 'gem' })],
        items: [{ uid: 'w', kind: 'instrument', form: 'pole', tier: tierAt(depth), where: { at: 'kit', slot: 'instrument' } }, { uid: 'gem', kind: 'curio', where: { at: 'case', x: 3, y: 5 } }] }),
      actions: [{ a: 'use', uid: 'w', x: 4, y: 3, how: 'push' }, { a: 'use', uid: 'w', x: 5, y: 3, how: 'pull' }, { a: 'use', uid: 'w', x: 3, y: 5, how: 'take' }],
      expect(r, params, sp, depth) {
        const p = P('INSTRUMENTS', 'pole', depth), moves = ev(r, 'moved', e => e.cause && e.cause.k === 'pole').map(e => [e.from, e.to]);
        if (p.range !== 2) return 'the pole reaches 2 tiles';
        if (json(moves) !== json([[[4, 3], [5, 3]], [[5, 3], [4, 3]]])) return `the pole moved it ${json(moves)}`;
        if (r.steps.slice(0, 2).some(st => st.events.some(e => e.k === 'woke' || (e.k === 'pip' && e.cause.k !== 'ring')))) return 'the pole woke it, or gave it a pip';
        if (at(r.state, 'gem').where.at !== 'tote' || r.state.dept.fixtures[0].holds !== null) return `the item in the case is ${json(at(r.state, 'gem').where)}`;
        return at(r.state, 'w').charges === p.charges - 3 ? null : 'three uses did not spend three charges';
      },
    }));
  });

  test('a Restoration kit is used up and its item gains a level: damage and Acc at even levels on a weapon, Padding on a garment, rank on a curio, a charge on an instrument', () => {
    every(scenario({
      name: 'KITS.restoration',
      build: (params, sp, depth, { rulesOff }) => room(depth, rulesOff, { items: [
        { uid: 'c', kind: 'curio', where: { at: 'kit', slot: 'curio0' }, prims: [{ id: 'eva', cls: CLS[depth % 3] }] },
        { uid: 'f', kind: 'instrument', form: 'fork', tier: 1, where: { at: 'kit', slot: 'instrument' } },
        ...[1, 2, 3, 4, 5, 6, 7].map(n => ({ uid: 'k' + n, kind: 'kit', ref: 'restoration', where: { at: 'tote' } }))] }),
      // Two levels on the weapon, then the garment, the curio and the instrument.
      actions: [['k1', 'you.w'], ['k2', 'you.w'], ['k3', 'you.g'], ['k4', 'c'], ['k5', 'f']].map(([uid, on]) => ({ a: 'use', uid, on })),
      expect(r, params, sp, depth) {
        const p = P('KITS', 'restoration', depth), a = you(r.start), b = you(r.state), f0 = at(r.start, 'f'), f1 = at(r.state, 'f');
        const want = [a.dmin + 2 * p.DMG, a.dmax + 2 * p.DMG, a.acc + Math.floor(2 / p.EVERY), a.pad + p.PAD, a.eva + p.RANK];
        if (json([b.dmin, b.dmax, b.acc, b.pad, b.eva]) !== json(want)) return `after the kits your stats are ${json([b.dmin, b.dmax, b.acc, b.pad, b.eva])}, not ${json(want)}`;
        if (f1.max !== f0.max + p.CHARGES || f1.charges !== f0.charges + p.CHARGES) return `the fork has ${f1.charges} of ${f1.max} charges`;
        if (['k1', 'k2', 'k3', 'k4', 'k5'].some(k => at(r.state, k).where.at !== 'gone' || r.state.you.tote.includes(k))) return 'a kit was not used up';
        return ev(r, 'used').every(e => e.how === 'restore') && r.steps.every(s => s.events[0].k !== 'refused') ? null : 'a kit was refused';
      },
    }));
  });

  test('the weapon and garment forms: damage, Acc and blow cost by form at the tier on offer; Padding and Eva by form, counting once the garment\'s ticks are done', () => {
    for (const form of ['light', 'balanced', 'heavy', 'reach']) {
      every(scenario({
        name: `CLAUSES.weapon_${form}`,
        // Worn at the tier on offer, at grade VII: a surprise blow on a
        // sleeper first, then a rolled one on a hunter.
        build: (params, sp, depth, { rulesOff }) => room(depth, rulesOff, { grade: 7, kit: { weapon: { form, tier: tierAt(depth) } },
          exhibits: [dummy([4, 3], 'hunting', { eva: -20 }), dummy([2, 3], 'dormant')] }),
        actions: (s, i) => i === 0 ? { a: 'attack', uid: s.actors[2].uid } : i === 1 ? { a: 'attack', uid: s.actors[1].uid } : null,
        expect(r, params, sp, depth) {
          const p = P('CLAUSES', 'weapon_' + form, depth), t = tierAt(depth), b = you(r.state);
          // At grade VII only a T4 Heavy weapon (grade VIII) is short, by one (item_grade).
          const short = Math.max(0, 2 * t - 1 + (form === 'light' ? -1 : form === 'heavy' ? 1 : 0) - 7);
          if (json([b.dmin, b.dmax, b.acc, b.weaponForm]) !== json([t + or0(p.a), p.b * t + or0(p.c), N.PLAYER_ACC + or0(p.acc) - N.SHORT_ACC * short, form])) return `a ${form} T${t} weapon gives ${json([b.dmin, b.dmax, b.acc])}`;
          const blows = r.events.filter(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.by === 'you');
          if (blows.length !== 2) return `${blows.length} blows were struck`;
          const most = form === 'light' ? Math.floor(b.dmax * p.surprise / 100) : b.dmax;
          if (!blows[0].cause.surprise || blows[0].cause.raw !== most) return `the surprise blow dealt ${blows[0].cause.raw}, not ${most}`;
          if (blows[1].k === 'damaged' && (blows[1].cause.raw < b.dmin || blows[1].cause.raw > b.dmax)) return `the blow rolled ${blows[1].cause.raw}, outside ${b.dmin}–${b.dmax}`;
          if (you(r.state).next - you(r.start).next !== 2 * p.cost) return `two blows cost ${you(r.state).next - you(r.start).next} ticks, not 2 × ${p.cost}`;
          return form === 'reach' && !b.reach ? 'a Reach weapon does not make Reach blows' : null;
        },
      }));
    }
    // A Light weapon's surprise figure is for a blow from beside (§8.1: "×1.5, rounded down,
    // with a Light weapon's melee blow"). The Long-Handled Date Stamp, a Light weapon with the
    // reach primitive, also strikes 2 tiles off, and a surprise Reach blow deals its most
    // damage, not more: so the clause, which its label shows, must not say that every
    // surprise blow with it deals SURPRISE_LIGHT_PCT%.
    every(scenario({
      name: 'CLAUSES.weapon_light: the surprise figure is a blow from beside; a surprise Reach blow with the Date Stamp deals its most damage', id: 'CLAUSES.weapon_light',
      build: (params, sp, depth, { rulesOff }) => room(depth, rulesOff, { grade: 7, items: REACH_WAYS.stamp.items(depth),
        exhibits: [dummy([5, 3], 'dormant'), dummy([2, 3], 'dormant')] }),
      actions: (s, i) => i < 2 ? { a: 'attack', uid: s.actors[1 + i].uid } : null,
      expect(r, params, sp, depth) {
        const p = P('CLAUSES', 'weapon_light', depth), b = you(r.state), line = Clauses.fill(R.CLAUSES.weapon_light.clause, p);
        const blows = r.events.filter(e => e.k === 'damaged' && e.cause.by === 'you');
        if (blows.length !== 2 || !blows.every(e => e.cause.surprise) || blows[0].cause.how.kind !== 'reach' || blows[1].cause.how.kind !== 'melee') return `the blows: ${json(blows.map(e => [e.cause.how.kind, e.cause.surprise]))}`;
        const most = Math.floor(b.dmax * p.surprise / 100);
        if (blows[1].cause.raw !== most) return `the surprise blow from beside dealt ${blows[1].cause.raw}, not ${p.surprise}% of ${b.dmax}`;
        if (blows[0].cause.raw !== b.dmax) return `the surprise Reach blow dealt ${blows[0].cause.raw}, not its most, ${b.dmax}`;
        const claim = /a surprise blow with it( from beside its target)? deals (\d+)% of its most damage/.exec(line);
        if (!claim) return `the clause gives no surprise figure: ${line}`;
        return claim[1] ? null : `the clause says every surprise blow with it deals ${claim[2]}%, and the Reach one dealt ${blows[0].cause.raw} of ${b.dmax}: ${line}`;
      },
    }));
    // The cost of a blow, by form, from the ticks it takes.
    for (const form of ['light', 'balanced', 'heavy', 'reach']) {
      const s = room(1, [], { grade: 7, exhibits: [dummy([4, 3])], kit: { weapon: { form, tier: 1 } } }), before = you(s).next;
      C.Step.step(s, { a: 'attack', uid: 'T0.1.room.1' });
      assert.equal(you(s).next - before, P('CLAUSES', 'weapon_' + form, 1).cost, form);
    }
    for (const form of ['light', 'standard', 'heavy']) {
      every(scenario({
        name: `CLAUSES.garment_${form}`,
        build: (params, sp, depth, { rulesOff }) => room(depth, rulesOff, { grade: 7, exhibits: [dummy([4, 3], 'hunting', { acc: 99, dmin: 2, dmax: 2 })],
          items: [{ uid: 'g', kind: 'garment', form, tier: tierAt(depth), where: { at: 'tote' } }] }),
        actions: [{ a: 'equip', uid: 'g' }, { a: 'wait' }, { a: 'wait' }],
        expect(r, params, sp, depth) {
          const p = P('CLAUSES', 'garment_' + form, depth), t = tierAt(depth), a = you(r.start), b = you(r.state);
          const short = Math.max(0, 2 * t - 1 + (form === 'heavy' ? 1 : 0) - 7);
          if (json([b.pad, b.eva]) !== json([Math.max(0, t + or0(p.a) - N.SHORT_PAD * short), N.PLAYER_EVA + or0(p.eva)])) return `a ${form} T${t} garment gives ${json([b.pad, b.eva])}`;
          if (r.steps[0].events.length === 0) return 'the equip did nothing';
          const during = r.steps[0].events.filter(e => e.k === 'damaged' && e.who === 'you').map(e => e.cause.pad);
          const after = r.steps.slice(1).flatMap(st => st.events).filter(e => e.k === 'damaged' && e.who === 'you').map(e => e.cause.pad);
          if (!during.length || during.some(x => x !== a.pad)) return `blows during the ${p.cost} ticks met Padding ${json(during)}, not the old ${a.pad}`;
          return after.every(x => x === b.pad) ? null : `blows after met Padding ${json(after)}`;
        },
      }));
    }
  });

  test('the grade rule: each grade short costs a weapon 2 Acc and a garment 1 Padding, and levels add damage, Padding and Acc at every second level', () => {
    every(scenario({
      name: 'CLAUSES.item_grade',
      // A T4 Balanced weapon (grade VII) and a T4 Heavy garment (grade VIII) at a grade that
      // varies with the depth, each at a level that does too.
      build: (params, sp, depth, { rulesOff }) => room(depth, rulesOff, { grade: depth, kit: { weapon: { form: 'balanced', tier: 4, level: depth % 4 }, garment: { form: 'heavy', tier: 4, level: depth % 3 } } }),
      actions: [{ a: 'wait' }],
      expect(r, params, sp, depth) {
        const p = P('CLAUSES', 'item_grade', depth), b = you(r.state), sw = Math.max(0, 7 - depth), sg = Math.max(0, 8 - depth);
        const want = [5 + depth % 4 * p.DMG, 15 + depth % 4 * p.DMG, N.PLAYER_ACC + Math.floor(depth % 4 / p.EVERY) - p.SHORT_ACC * sw, Math.max(0, 5 + depth % 3 * p.PAD - p.SHORT_PAD * sg)];
        return json([b.dmin, b.dmax, b.acc, b.pad]) === json(want) ? null : `at grade ${depth}: ${json([b.dmin, b.dmax, b.acc, b.pad])}, not ${json(want)}`;
      },
    }));
  });

  test('the tote: one slot an item, one a kind of consumable, TOTE_SLOTS in all; take and drop from beside you; the weapon slot never empties', () => {
    every(scenario({
      name: 'CLAUSES.item_tote',
      build: (params, sp, depth, { rulesOff }) => room(depth, rulesOff, { items: [
        ...Array.from({ length: N.TOTE_SLOTS - 2 }, (_, i) => ({ uid: 't' + i, kind: 'curio', where: { at: 'tote' } })),
        { uid: 'bottle', kind: 'consumable', ck: 'card', seal: 'ink1', n: 2, where: { at: 'tote' } },
        { uid: 'more', kind: 'consumable', ck: 'card', seal: 'ink1', n: 3, where: { at: 'floor', x: 4, y: 3 } },
        { uid: 'one', kind: 'curio', where: { at: 'floor', x: 4, y: 4 } }, { uid: 'two', kind: 'curio', where: { at: 'floor', x: 3, y: 4 } }] }),
      actions: [{ a: 'take', uid: 'more' }, { a: 'take', uid: 'one' }, { a: 'take', uid: 'two' }, { a: 'unequip', slot: 'weapon' }, { a: 'drop', uid: 'one' }, { a: 'take', uid: 'two' }],
      expect(r, params, sp, depth) {
        const p = P('CLAUSES', 'item_tote', depth), reasons = r.steps.map(s => s.events[0].k === 'refused' ? s.events[0].reason : 'ok');
        if (json(reasons) !== json(['ok', 'ok', 'tote_full', 'weapon_slot', 'ok', 'ok'])) return `the steps went ${json(reasons)}`;
        if (p.TOTE !== 16 || r.state.you.tote.length !== p.TOTE) return `the tote holds ${r.state.you.tote.length}`;
        if (at(r.state, 'bottle').n !== 5 || at(r.state, 'more').where.at !== 'gone') return 'the second bottle did not join its stack';
        return json(at(r.state, 'one').where) === json({ at: 'floor', x: 3, y: 3 }) ? null : 'the dropped item is not on your tile';
      },
    }));
  });
};
