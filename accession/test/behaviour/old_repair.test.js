// The old_repair modifier's Behaviour-line clause (BUILD.md §5.3, §5.5, §8.1): "Its {side} side
// is a later repair: blows, shots and beams from that side deal double damage." Each scenario
// is a function of the clause's parameter (the side, as a word), run for every species whose
// line has it (the Signal Lamps, repaired on the west), at every depth 1–7, with every
// invariant checked after every step and a clone check; those that show the doubling must
// fail with old_repair switched off (rulesOff, §5.3 check 3). Your Pin-Driver is W1-KIT's;
// here, in this test's own core, a stand-in fires it through Ranged.shoot as the plan says
// KIT's does.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const C = loadCore();
  const { Setup, Roles, Ranged, Int, N } = C;
  const json = x => JSON.stringify(x);
  const accOf = sp => C.Packs.list().find(p => p.species.includes(sp)).acc;
  const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], DX = [0, 1, 1, 1, 0, -1, -1, -1], DY = [-1, -1, 0, 1, 1, 1, 0, -1];
  const WORDS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  // The side the clause names, as a direction index; and the straight direction nearest it,
  // along which a beam can come (a beam runs along a row or a column).
  const dirOf = word => { const d = WORDS.indexOf(word); if (d < 0) throw new Error('no side ' + word); return d; };
  const straight = d => d % 2 === 0 ? d : d - 1;
  const OPEN = ['#############', ...Array.from({ length: 7 }, () => '#...........#'), '#############'];
  const LAMP = [6, 4];
  const room = (sp, depth, opts, you, exhibits, items) => Setup.room(opts.seed, { acc: accOf(sp), depth, map: OPEN, you, exhibits, items: items || [] }, { rulesOff: opts.rulesOff, invulnerable: true });
  const lamp = (sp, depth) => ({ sp: sp.id, at: LAMP, mode: 'dormant', stats: Object.assign(Roles.stats(sp.role, depth), { hp: 999 }) });
  const off = (d, k) => [LAMP[0] + DX[d] * k, LAMP[1] + DY[d] * k];
  const PD = 'arch_b.pd';
  // The stand-in fires with its own damage (1–4) and Acc (1), as an instrument's bolt is made.
  C.Kit.useAction = (state, action, ev) => Ranged.shoot(state, state.actors[0], action.x, action.y, { kind: 'shot', item: action.uid, dmin: 1, dmax: 4, acc: 1 }, ev);
  const pinDriver = [{ uid: PD, kind: 'instrument', where: { at: 'kit', slot: 'instrument' }, tier: 1, charges: N.PIN_DRIVER[0], max: N.PIN_DRIVER[0] }];
  // The first damage the lamp takes, and what it would be without the repair: the damage
  // less its Padding, at least DMG_MIN_ON_HIT (a beam's net).
  function first(r) {
    const uid = r.start.actors[1].uid, e = r.events.find(x => x.k === 'damaged' && x.who === uid);
    if (!e) return { e: null, base: null };
    return { e, base: e.cause.net !== undefined ? e.cause.net : Math.max(N.DMG_MIN_ON_HIT, e.cause.raw - e.cause.pad) };
  }
  const doubled = (r, params) => {
    const { e, base } = first(r), code = POINTS[dirOf(params.side)];
    if (!e) return 'it was never struck';
    if (e.amount !== Int.pct(base, N.OLD_REPAIR_PCT)) return `from its ${params.side} side it took ${e.amount}, not double ${base}`;
    return e.cause.side === code ? null : `its damage's cause says side ${e.cause.side}`;
  };
  const sweep = (sc, sensitive) => {
    const res = H.sweep(C, sc);
    assert.ok(res.length >= 7, `${sc.name}: ${res.length} runs`);
    assert.deepEqual(H.failures(res), []);
    if (sensitive) { const s = H.sensitivity(C, sc, 'old_repair'); assert.ok(s.sensitive, s.problems.join('\n')); assert.ok(s.runs.length >= 7); }
  };

  test('the old_repair clause is on the Signal Lamps, naming the side their pack gives', () => {
    const list = H.species(C, 'old_repair');
    assert.ok(list.length >= 7, json(list.map(x => x.sp.id)));
    for (const { sp } of list) assert.ok(C.Clauses.line(sp, { depth: 3 }).includes(`Its ${WORDS[POINTS.indexOf(sp.modParams.old_repair.side)]} side is a later repair`), sp.id);
    assert.equal(C.Registry.MODIFIERS.old_repair.ready, 'unit');
  });

  test('a blow from its repaired side deals double damage', () => sweep(H.scenario({
    name: 'your blow from beside its repaired side deals double', id: 'old_repair', clone: true,
    build: (params, sp, depth, opts) => room(sp, depth, opts, off(dirOf(params.side), 1), [lamp(sp, depth)]),
    actions: state => state.actors[1].hp === 999 ? { a: 'attack', uid: state.actors[1].uid } : null,
    expect: doubled,
  }), true));

  test('a blow from either corner of its repaired side deals double damage too', () => {
    for (const turn of [1, 7]) sweep(H.scenario({
      name: `your blow from the corner ${turn === 1 ? 'clockwise' : 'anticlockwise'} of its repaired side deals double`, id: 'old_repair', clone: true,
      build: (params, sp, depth, opts) => room(sp, depth, opts, off((dirOf(params.side) + turn) % 8, 1), [lamp(sp, depth)]),
      actions: state => state.actors[1].hp === 999 ? { a: 'attack', uid: state.actors[1].uid } : null,
      expect: doubled,
    }), true);
  });

  test('a blow from the opposite side deals the usual damage', () => sweep(H.scenario({
    name: 'your blow from beside the side opposite the repair deals the usual damage', id: 'old_repair', clone: true,
    build: (params, sp, depth, opts) => room(sp, depth, opts, off((dirOf(params.side) + 4) % 8, 1), [lamp(sp, depth)]),
    actions: state => state.actors[1].hp === 999 ? { a: 'attack', uid: state.actors[1].uid } : null,
    expect(r) {
      const { e, base } = first(r);
      if (!e) return 'it was never struck';
      return e.amount === base && e.cause.side == null ? null : `from the far side it took ${e.amount} (${json(e.cause)}), not ${base}`;
    },
  })));

  test('a shot from its repaired side deals double damage', () => sweep(H.scenario({
    name: 'your Pin-Driver bolt from 3 tiles off its repaired side deals double', id: 'old_repair', clone: true,
    build: (params, sp, depth, opts) => room(sp, depth, opts, off(dirOf(params.side), 3), [lamp(sp, depth)], pinDriver),
    actions: state => state.actors[1].hp === 999 ? { a: 'use', uid: PD, x: LAMP[0], y: LAMP[1] } : null,
    expect: doubled,
  }), true));

  test('a beam from its repaired side deals double damage', () => sweep(H.scenario({
    name: 'a sniper\'s beam that crosses it from its repaired side deals double', id: 'old_repair', clone: true,
    build: (params, sp, depth, opts) => {
      const d = straight(dirOf(params.side));
      return room(sp, depth, opts, off((d + 4) % 8, 2), [lamp(sp, depth), { sp: 'arch_b_sniper', arch: 'axis_sniper', at: off(d, 3), mode: 'hunting', stats: Roles.stats('artillery', depth) }]);
    },
    actions: [{ a: 'wait' }, { a: 'wait' }],
    expect: doubled,
  }), true));

  // The rule on every side (BUILD.md §5.5): the side is a compass point in modParams, and
  // damage doubles when its `from` tile lies toward that point or either point beside it,
  // seen from the body (each axis of the direction −1, 0 or +1). Restated here: the
  // direction's dot product with the side's own is 1 or more. Each side is tried with blows
  // from all 8 tiles beside a test body and from the 16 tiles 2 off (a Reach blow, a shot).
  test('the repaired side is the species\' point and the two beside it, on every side, from beside it or 2 tiles off', () => {
    const map = ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'], sg = v => v < 0 ? -1 : v > 0 ? 1 : 0;
    for (let d = 0; d < 8; d++) {
      const side = POINTS[d], s = Setup.room(1, { acc: 'T0', depth: 1, map, you: [1, 1],
        exhibits: [{ sp: 'arch_b_repair', mods: ['old_repair'], modParams: { old_repair: { side } }, at: [3, 3], mode: 'hunting', stats: { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } }] });
      let beside = 0;
      for (let fy = 1; fy <= 5; fy++) for (let fx = 1; fx <= 5; fx++) {
        if (fx === 3 && fy === 3) continue;
        const c = C.State.clone(s), a = c.actors[1], ev = [];
        C.Combat.hurt(c, a, 5, { k: 'attack', by: 'you', at: a.uid, chance: 75, roll: 1, raw: 5, pad: 0, how: { kind: 'melee' }, from: [fx, fy] }, ev);
        const e = ev.find(x => x.k === 'damaged'), on = sg(fx - 3) * DX[d] + sg(fy - 3) * DY[d] >= 1;
        assert.equal(json([e.amount, e.cause.side === undefined ? null : e.cause.side]), json(on ? [Int.pct(5, N.OLD_REPAIR_PCT), side] : [5, null]), `side ${side}, from ${fx},${fy}`);
        if (on && Math.max(Math.abs(fx - 3), Math.abs(fy - 3)) === 1) beside++;
      }
      assert.equal(beside, 3, `side ${side}: 3 of the 8 tiles beside it are on that side`);
      // Switched off, no side doubles.
      const o = Setup.room(1, { acc: 'T0', depth: 1, map, you: [1, 1], exhibits: [{ sp: 'arch_b_repair', mods: ['old_repair'], modParams: { old_repair: { side } }, at: [3, 3], mode: 'hunting', stats: { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } }] }, { rulesOff: ['old_repair'] });
      const ev = [];
      C.Combat.hurt(o, o.actors[1], 5, { k: 'attack', by: 'you', at: o.actors[1].uid, chance: 75, roll: 1, raw: 5, pad: 0, how: { kind: 'melee' }, from: [3 + DX[d], 3 + DY[d]] }, ev);
      assert.equal(ev.find(x => x.k === 'damaged').amount, 5);
    }
  });
};
