// M3's kit (BUILD.md §3.2, §4.2, §8.1, §8.5): your derived stats with every form, tier,
// grade, level, primitive and curio; the tote; take, drop, equip and unequip and what they
// cost; a garment's Padding counting once its ticks are done; Restoration on every slot; the
// instruments' charges, recharge, targets and effects; the quiet ring; legal ⇔ step for every
// item action; the stand-in placement (the tier draw, item uids, the Highlights); and what the
// view model and the labels read. The expected figures are worked out here from BUILD.md's
// text and §8.10's rows, never from the kit's own code.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const Stats = require(path.join(root, 'tools/stats.js'));
  // A core with the hooks the kit calls planted as their owners build them: a bolt that hits
  // the first actor on its line through Combat.attack (W1-ARCH-B's Ranged.shoot), and a case's
  // contents within reach once it is opened or broken (W1-CASES's Cases.reach).
  function planted() {
    const X = loadCore();
    X.Ranged.shoot = (state, att, x, y, how, ev) => {
      let via = [att.x, att.y], target = null;
      for (const [tx, ty] of X.Ranged.line(state, att.x, att.y, x, y, 99, X.Grid.bolt)) { const a = X.Actors.at(state, tx, ty, att); if (a) { target = a; break; } via = [tx, ty]; }
      if (!target) return 'no_target';
      X.Combat.attack(state, att, target, ev, Object.assign({}, how, { range: X.Actors.between(att, target), via }));
      return X.Actors.attackCost(state, att);
    };
    X.Cases.reach = (state, it) => { const f = X.Cases.at(state, it.where.x, it.where.y); return !!f && (f.st === 'open' || f.st === 'broken'); };
    return X;
  }
  const C = planted();
  const { Step, State, Setup, Dept, Kit, Cases, Packs, Registry, Grid, Actors, Actions, Causes, Text, Vision, Layout, Rng, N } = C;
  const json = x => JSON.stringify(x);
  const key = a => JSON.stringify(a);
  const clean = s => typeof s === 'string' && s.length > 0 && !/undefined|NaN|\[object/.test(s);
  const MAP = ['#############', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#############'];
  const dummy = (at, mode, stats) => ({ sp: 'dummy', at, mode: mode || 'hunting', stats: Object.assign({ hp: 999, acc: -99, eva: 0, pad: 0, dmin: 1, dmax: 1 }, stats || {}) });
  const room = (spec, options, X) => (X || C).Setup.room(1, Object.assign({ acc: 'T0', depth: 1, map: MAP, you: [3, 3], exhibits: [] }, spec), options);
  const item = (s, uid) => s.items.find(i => i.uid === uid);
  const you = s => s.actors[0];
  const step = (s, a) => Step.step(s, a);
  const reason = ev => ev.length === 1 && ev[0].k === 'refused' ? ev[0].reason : null;
  // A refused action leaves the state and every stream as they were (§4.2).
  function refuses(s, a, code) {
    const before = State.canon(s), ev = Step.step(s, a);
    assert.equal(reason(ev), code, `${key(a)}: ${json(ev[0])}`);
    assert.equal(State.canon(s), before, `${key(a)} refused (${code}) but changed the state`);
  }
  // Every event passes its schema and has a clean sentence.
  function checked(events) {
    for (const e of events) {
      assert.equal(Causes.check(e), null, json(e));
      const sentence = Text.event(e, null);
      assert.ok(clean(sentence) && /^[A-Z“]/.test(sentence) && /[.)]$/.test(sentence), `${e.k}: ${sentence}`);
    }
    return events;
  }
  // Legal ⇔ not refused over every handler's candidates (§4.2), and a refused one changes nothing.
  function parity(s, where, X) {
    const K = X || C, legal = K.Step.legal(s), keys = new Set(legal.map(key)), cands = new Set(), base = K.State.canon(s);
    for (const id of K.Actions.ORDER) {
      const h = K.Actions.get(id);
      if (!h) continue;
      for (const c of h.candidates(s)) {
        if (cands.has(key(c))) continue;
        cands.add(key(c));
        const t = JSON.parse(base), ev = K.Step.step(t, c), refused = ev.length === 1 && ev[0].k === 'refused';
        assert.equal(!refused, keys.has(key(c)), `${where}: ${key(c)} ${refused ? 'refused (' + ev[0].reason + ')' : 'accepted'}`);
        if (refused) assert.ok(K.State.canon(t) === base, `${where}: ${key(c)} refused (${ev[0].reason}) but changed the state or a stream`);
      }
    }
    for (const k of keys) assert.ok(cands.has(k), `${where}: legal ${k} is no handler's candidate`);
    return legal;
  }

  // §8.1 and §8.5, written out again. Weapons [min, max, Acc, grade offset] by form; garments
  // [Padding, Eva, grade offset]; a tier t item needs grade 2t − 1 + offset; each grade short
  // −2 Acc (weapon) or −1 Padding (garment); each level +1 damage, +1 Acc at even levels, +1
  // Padding; bonuses S 1, M 2, L 3, a curio's rank 1 more each; Padding never below 0.
  const WEAPON = { light: [t => t, t => 3 * t + 1, 2, -1], balanced: [t => t + 1, t => 3 * t + 3, 0, 0], heavy: [t => t + 2, t => 4 * t + 4, -1, 1], reach: [t => t, t => 3 * t + 1, 0, 0] };
  const GARMENT = { light: [t => t - 1, 1, 0], standard: [t => t, 0, 0], heavy: [t => t + 1, -1, 1] };
  const SIZE = { S: 1, M: 2, L: 3 };

  test('Kit.derive follows §8.1 and §8.5 for every form, tier 1–4, grade 1–7 and level 0–3, with the bonuses of every slot and a curio\'s rank', () => {
    const s = room({ items: [{ uid: 'c0', kind: 'curio', where: { at: 'kit', slot: 'curio0' } }, { uid: 'c1', kind: 'curio', where: { at: 'kit', slot: 'curio1' } },
      { uid: 'in', kind: 'instrument', form: 'fork', tier: 1, where: { at: 'kit', slot: 'instrument' } }] });
    const [w, g, c0, c1, inst] = ['you.w', 'you.g', 'c0', 'c1', 'in'].map(u => item(s, u));
    // Primitive sets: none; one on each slot; and a large curio Padding malus test (Padding
    // never below 0 even when a garment is far short).
    const SETS = [
      { w: [], g: [], c0: [], c1: [], inst: [] },
      { w: [['dmg', 'S'], ['acc', 'M']], g: [['pad', 'M'], ['eva', 'L']], c0: [['acc', 'L'], ['dmg', 'M']], c1: [['pad', 'S'], ['quiet', 'S']], inst: [['eva', 'S'], ['breaker', 'M']] },
      { w: [['reach', 'L']], g: [], c0: [['pad', 'L'], ['quiet', 'M']], c1: [['quiet', 'L'], ['breaker', 'S'], ['breaker', 'L']], inst: [['dmg', 'L']] },
    ];
    let n = 0;
    for (const set of SETS) for (let grade = 1; grade <= 7; grade++) for (let t = 1; t <= 4; t++) for (let L = 0; L <= 3; L++) {
      s.run.grade = grade;
      const rank = (L + grade) % 3;
      for (const [it, ps] of [[w, set.w], [g, set.g], [c0, set.c0], [c1, set.c1], [inst, set.inst]]) it.prims = ps.map(([id, cls]) => ({ id, cls }));
      c0.level = rank; c1.level = 2 - rank % 3;
      const sum = (id) => {
        let v = 0;
        for (const [it, ps, r] of [[w, set.w, 0], [g, set.g, 0], [c0, set.c0, c0.level], [c1, set.c1, c1.level], [inst, set.inst, 0]]) for (const [pid, cls] of ps) if (pid === id) v += SIZE[cls] + r;
        return v;
      };
      const has = id => [set.w, set.g, set.c0, set.c1, set.inst].some(ps => ps.some(([pid]) => pid === id));
      for (const [wf, [lo, hi, acc, woff]] of Object.entries(WEAPON)) for (const [gf, [pad, eva, goff]] of Object.entries(GARMENT)) {
        Object.assign(w, { form: wf, tier: t, level: L }); Object.assign(g, { form: gf, tier: t, level: L });
        const sw = Math.max(0, 2 * t - 1 + woff - grade), sg = Math.max(0, 2 * t - 1 + goff - grade), d = Kit.derive(s);
        const want = {
          acc: 3 + acc + Math.floor(L / 2) - 2 * sw + sum('acc'), eva: 2 + eva + sum('eva'), pad: Math.max(0, pad(t) + L - sg + sum('pad')),
          dmin: lo(t) + L + sum('dmg'), dmax: hi(t) + L + sum('dmg'), weaponForm: wf, reach: wf === 'reach' || has('reach'),
          quiet: has('quiet') ? 1 : 0, breaker: has('breaker') ? 1 : 0,
        };
        assert.equal(json(d), json(want), `${wf} weapon and ${gf} garment T${t} L${L} at grade ${grade}, set ${SETS.indexOf(set)}`);
        n++;
      }
    }
    assert.equal(n, 3 * 7 * 4 * 4 * 12);
    // A primitive with no size, or an unknown one, is an error, never a silent 0.
    c0.prims = [{ id: 'acc', cls: 'XL' }]; assert.throws(() => Kit.derive(s), /size/);
    c0.prims = [{ id: 'fire', cls: 'S' }]; assert.throws(() => Kit.derive(s), /unknown primitive/);
  });

  test('the tote holds 16: an item takes a slot, a kind of consumable one slot however many; a full tote refuses a take and an unequip, never an equip', () => {
    const items = Array.from({ length: N.TOTE_SLOTS - 2 }, (_, i) => ({ uid: 't' + i, kind: 'curio', where: { at: 'tote' } }));
    items.push({ uid: 'b1', kind: 'consumable', ck: 'card', seal: 'ink1', n: 2, where: { at: 'tote' } }, { uid: 'w2', kind: 'weapon', form: 'heavy', tier: 1, where: { at: 'tote' } },
      { uid: 'b2', kind: 'consumable', ck: 'card', seal: 'ink1', n: 3, where: { at: 'floor', x: 4, y: 3 } }, { uid: 'b3', kind: 'consumable', ck: 'plan', seal: 'ink2', n: 1, where: { at: 'floor', x: 4, y: 3 } },
      { uid: 'x', kind: 'curio', where: { at: 'floor', x: 3, y: 3 } });
    const s = room({ items });
    assert.equal(Kit.slots(s), 16);
    refuses(s, { a: 'take', uid: 'x' }, 'tote_full');
    refuses(s, { a: 'take', uid: 'b3' }, 'tote_full');
    refuses(s, { a: 'unequip', slot: 'garment' }, 'tote_full');
    // A second bottle of a kind you carry joins its stack, taking no slot.
    const ev = checked(step(s, { a: 'take', uid: 'b2' }));
    assert.equal(json([item(s, 'b1').n, item(s, 'b2').where, Kit.slots(s)]), json([5, { at: 'gone' }, 16]));
    assert.equal(ev[0].cause.stack, 'b1');
    assert.equal(item(s, 'b1').from, null, 'a stack keeps the department it came from (none here: it was given)');
    // Equipping from a full tote swaps the item worn into the tote, in the same place.
    const at = s.you.tote.indexOf('w2');
    checked(step(s, { a: 'equip', uid: 'w2' }));
    assert.equal(json([s.you.kit.weapon, s.you.tote[at], Kit.slots(s), item(s, 'you.w').where]), json(['w2', 'you.w', 16, { at: 'tote' }]));
    // Dropping makes room.
    checked(step(s, { a: 'drop', uid: 't0' }));
    assert.equal(Kit.slots(s), 15);
    checked(step(s, { a: 'take', uid: 'x' }));
    assert.equal(json([Kit.slots(s), item(s, 'x').where, item(s, 'x').from]), json([16, { at: 'tote' }, 'T0']), 'taken in T0, its first department');
  });

  test('take, drop, equip and unequip cost what §8.1 says, double while slowed, and work only where §8.5 says', () => {
    const map = ['#########', '#.....v.#', '#...#...#', '#.......#', '#########'];
    const s = room({ map, you: [3, 1], fixtures: [Cases.make({ x: 6, y: 1, room: 'room', num: '1.1.1', st: 'shut', holds: 'shut' })],
      items: [{ uid: 'near', kind: 'weapon', form: 'light', tier: 1, where: { at: 'floor', x: 2, y: 1 } }, { uid: 'far', kind: 'curio', where: { at: 'floor', x: 5, y: 1 } },
        { uid: 'past', kind: 'curio', where: { at: 'floor', x: 4, y: 1 } }, { uid: 'shut', kind: 'curio', where: { at: 'case', x: 6, y: 1 } },
        { uid: 'g2', kind: 'garment', form: 'heavy', tier: 1, where: { at: 'tote' } }, { uid: 'c1', kind: 'curio', where: { at: 'tote' } }, { uid: 'c2', kind: 'curio', where: { at: 'tote' } },
        { uid: 'c3', kind: 'curio', where: { at: 'tote' } }, { uid: 'rk', kind: 'kit', ref: 'restoration', where: { at: 'tote' } }] });
    const cost = a => { const before = you(s).next, ev = checked(step(s, a)); assert.equal(reason(ev), null, key(a) + ' ' + json(ev[0])); return you(s).next - before; };
    refuses(s, { a: 'take', uid: 'far' }, 'out_of_reach');
    refuses(s, { a: 'take', uid: 'nothing' }, 'no_item');
    refuses(s, { a: 'take', uid: 'g2' }, 'carried');
    refuses(s, { a: 'equip', uid: 'near' }, 'not_carried');
    refuses(s, { a: 'equip', uid: 'you.g' }, 'worn');
    refuses(s, { a: 'drop', uid: 'you.w' }, 'worn');
    refuses(s, { a: 'drop', uid: 'near' }, 'not_carried');
    refuses(s, { a: 'equip', uid: 'rk' }, 'not_equippable');
    refuses(s, { a: 'unequip', slot: 'weapon' }, 'weapon_slot');
    refuses(s, { a: 'unequip', slot: 'curio0' }, 'slot_empty');
    refuses(s, { a: 'unequip', slot: 'hat' }, 'bad_slot');
    refuses(s, { a: 'unequip' }, 'bad_slot');
    assert.equal(cost({ a: 'take', uid: 'near' }), N.COST_TAKE);
    assert.equal(cost({ a: 'equip', uid: 'near' }), N.COST_EQUIP);
    assert.equal(cost({ a: 'equip', uid: 'g2' }), N.COST_EQUIP_GARMENT);
    assert.equal(cost({ a: 'equip', uid: 'c1' }), N.COST_EQUIP);
    assert.equal(cost({ a: 'equip', uid: 'c2' }), N.COST_EQUIP);
    assert.equal(json(s.you.kit.curio), json(['c1', 'c2']), 'curios fill the first empty curio slot');
    refuses(s, { a: 'equip', uid: 'c3' }, 'curio_slots_full');
    assert.equal(cost({ a: 'unequip', slot: 'curio0' }), N.COST_EQUIP);
    assert.equal(cost({ a: 'unequip', slot: 'garment' }), N.COST_EQUIP_GARMENT);
    assert.equal(s.you.kit.garment, null);
    assert.equal(cost({ a: 'drop', uid: 'g2' }), N.COST_TAKE);
    assert.equal(json(item(s, 'g2').where), json({ at: 'floor', x: 3, y: 1 }), 'dropped on your tile');
    // Slowed: every item action costs double (Actors.cost).
    s.actors[0].statuses.push({ id: 'slowed', until: 999, turns: null, from: 0 });
    assert.equal(cost({ a: 'take', uid: 'g2' }), 2 * N.COST_TAKE);
    assert.equal(cost({ a: 'equip', uid: 'g2' }), 2 * N.COST_EQUIP_GARMENT);
    s.actors[0].statuses = [];
    // Past a corner: from (3, 2), (4, 1) is diagonal, and the wall at (4, 2) is in the way.
    s.actors[0].x = 3; s.actors[0].y = 2;
    refuses(s, { a: 'take', uid: 'past' }, 'corner');
    // An intact case: glass is in the way; opened, its item is within reach, and it leaves the case.
    s.actors[0].x = 6; s.actors[0].y = 2;
    refuses(s, { a: 'take', uid: 'shut' }, 'behind_glass');
    s.dept.fixtures[0].st = 'open'; s.dept.tiles[1] = '#.....u.#';
    assert.equal(cost({ a: 'take', uid: 'shut' }), N.COST_TAKE);
    assert.equal(json([item(s, 'shut').where, s.dept.fixtures[0].holds]), json([{ at: 'tote' }, null]));
    // There is no picking up by walking over an item.
    const w = room({ items: [{ uid: 'lying', kind: 'curio', where: { at: 'floor', x: 4, y: 3 } }] });
    checked(step(w, { a: 'move', dir: 2 }));
    assert.equal(json([you(w).x, item(w, 'lying').where.at]), json([4, 'floor']));
  });

  test('a garment\'s Padding counts once its 300 ticks are done: blows during them meet the old Padding', () => {
    let during = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const s = C.Setup.room(seed, { acc: 'T0', depth: 1, map: MAP, you: [3, 3], exhibits: [dummy([4, 3], 'hunting', { acc: 99, dmin: 2, dmax: 2 })],
        items: [{ uid: 'g', kind: 'garment', form: 'heavy', tier: 1, where: { at: 'tote' } }], grade: 3 });
      const ev = checked(step(s, { a: 'equip', uid: 'g' })), pads = ev.filter(e => e.k === 'damaged' && e.who === 'you').map(e => e.cause.pad);
      assert.equal(you(s).next, N.COST_EQUIP_GARMENT);
      during += pads.length;
      assert.ok(pads.every(p => p === 1), `seed ${seed}: struck during the equip against ${pads}, not the old 1`);
      assert.equal(you(s).pad, 2, 'a Heavy T1 garment: tier + 1');
      const next = checked(step(s, { a: 'wait' })).filter(e => e.k === 'damaged' && e.who === 'you').map(e => e.cause.pad);
      assert.ok(next.every(p => p === 2), `then against the new Padding: ${next}`);
    }
    assert.ok(during >= 16, `${during} blows during the equips`);
  });

  test('Restoration adds a level to one item you carry: a weapon +1 damage and +1 Acc at even levels, a garment +1 Padding, a curio +1 rank, an instrument +1 charge', () => {
    const kits = Array.from({ length: 12 }, (_, i) => ({ uid: 'k' + i, kind: 'kit', ref: 'restoration', where: { at: 'tote' } }));
    const s = room({ items: kits.concat([{ uid: 'c', kind: 'curio', where: { at: 'kit', slot: 'curio0' }, prims: [{ id: 'acc', cls: 'M' }, { id: 'pad', cls: 'S' }, { id: 'quiet', cls: 'S' }] },
      { uid: 'f', kind: 'instrument', form: 'pole', tier: 1, where: { at: 'kit', slot: 'instrument' } }, { uid: 'spare', kind: 'weapon', form: 'light', tier: 2, where: { at: 'tote' } },
      { uid: 'lying', kind: 'weapon', form: 'light', tier: 1, where: { at: 'floor', x: 4, y: 3 } }, { uid: 'bottle', kind: 'consumable', ck: 'card', seal: 'ink1', n: 1, where: { at: 'tote' } },
      { uid: 'kfloor', kind: 'kit', ref: 'restoration', where: { at: 'floor', x: 3, y: 3 } }]) });
    let k = 0;
    const use = on => { const ev = checked(step(s, { a: 'use', uid: 'k' + k++, on })); assert.equal(reason(ev), null, json(ev[0])); assert.equal(you(s).next % 100, 0); return ev; };
    // The weapon, four levels: damage 2–6 → 3–7 … 6–10; Acc 3, 3, 4, 4, 5, plus the curio's
    // medium Acc bonus (2).
    const seen = [[you(s).dmin, you(s).dmax, you(s).acc]];
    for (let L = 1; L <= 4; L++) { const before = you(s).next; use('you.w'); assert.equal(you(s).next - before, N.COST_USE); seen.push([you(s).dmin, you(s).dmax, you(s).acc]); }
    assert.equal(json(seen), json([[2, 6, 5], [3, 7, 5], [4, 8, 6], [5, 9, 6], [6, 10, 7]]));
    assert.equal(item(s, 'you.w').level, 4);
    // The garment: Padding 1 + 1 (the curio's S) → 3.
    assert.equal(you(s).pad, 2); use('you.g'); assert.equal(you(s).pad, 3);
    // The curio: rank 1 adds 1 to each numeric bonus (Acc and Padding), nothing to quiet.
    const acc = you(s).acc; use('c'); assert.equal(json([you(s).acc, you(s).pad, you(s).quiet]), json([acc + 1, 4, 1]));
    // The instrument: one more charge, filled at once.
    const f = item(s, 'f'); f.charges = 2; f.rechargeAt = 50;
    use('f'); assert.equal(json([f.max, f.charges, f.rechargeAt, f.level]), json([5, 3, 50, 1]));
    f.charges = 4; use('f'); assert.equal(json([f.max, f.charges, f.rechargeAt]), json([6, 5, 50]));
    f.charges = 6; use('f'); assert.equal(json([f.max, f.charges, f.rechargeAt]), json([7, 7, null]), 'full: no longer recharging');
    // An item in the tote; each kit is used up.
    use('spare'); assert.equal(item(s, 'spare').level, 1);
    for (let i = 0; i < k; i++) { assert.equal(item(s, 'k' + i).where.at, 'gone'); assert.ok(!s.you.tote.includes('k' + i)); }
    // Refused: a kit you are not carrying; an item you are not carrying; a consumable or
    // another kit; nothing; a tile; and the use of a kit with a how.
    refuses(s, { a: 'use', uid: 'kfloor', on: 'you.w' }, 'not_carried');
    refuses(s, { a: 'use', uid: 'k' + k, on: 'lying' }, 'not_carried');
    refuses(s, { a: 'use', uid: 'k' + k, on: 'bottle' }, 'cannot_restore');
    refuses(s, { a: 'use', uid: 'k' + k, on: 'k' + (k + 1) }, 'cannot_restore');
    refuses(s, { a: 'use', uid: 'k' + k, on: 'nobody' }, 'no_item');
    refuses(s, { a: 'use', uid: 'k' + k }, 'no_aim');
    refuses(s, { a: 'use', uid: 'k' + k, on: 'you.w', x: 4, y: 3 }, 'bad_use');
    // The weapon's numbers settle at the end of the step, as an equip's do.
    const r = room({ exhibits: [dummy([4, 3], 'hunting', { acc: 99 })], items: [{ uid: 'k', kind: 'kit', where: { at: 'tote' } }] });
    const ev = step(r, { a: 'use', uid: 'k', on: 'you.g' });
    assert.ok(ev.filter(e => e.k === 'damaged' && e.who === 'you').every(e => e.cause.pad === 1));
    assert.equal(you(r).pad, 2);
  });

  test('instruments: each use spends a charge; one comes back every recharge turns until full, in the tote too; a refused use spends none', () => {
    const s = room({ items: [{ uid: 'f', kind: 'instrument', form: 'fork', tier: 1, where: { at: 'kit', slot: 'instrument' } }] });
    const f = item(s, 'f'), [CH, RE] = N.TUNING_FORK;
    assert.equal(json([f.charges, f.max, f.rechargeAt]), json([CH, CH, null]), 'it starts full, from its row');
    const used = [];
    for (let i = 0; i < CH; i++) { used.push(s.turn); checked(step(s, { a: 'use', uid: 'f', x: 6, y: 3 })); }
    assert.equal(json([f.charges, f.rechargeAt]), json([0, used[0] + RE]));
    refuses(s, { a: 'use', uid: 'f', x: 6, y: 3 }, 'no_charges');
    // Carried in the tote, it still recharges.
    checked(step(s, { a: 'unequip', slot: 'instrument' }));
    const back = [];
    while (f.charges < CH) { const c = f.charges; step(s, { a: 'wait' }); if (f.charges !== c) back.push(s.turn); }
    assert.equal(json(back), json([used[0] + RE, used[0] + 2 * RE, used[0] + 3 * RE]), 'one charge every recharge turns after the first use');
    assert.equal(f.rechargeAt, null);
    // A Pin-Driver and a pole start full too, with their rows' charges.
    const t = room({ items: [{ uid: 'p', kind: 'instrument', form: 'pin_driver', tier: 2, where: { at: 'tote' } }, { uid: 'w', kind: 'instrument', form: 'pole', tier: 1, level: 2, where: { at: 'tote' } }] });
    assert.equal(json([item(t, 'p').charges, item(t, 'w').max]), json([N.PIN_DRIVER[0], N.WINDOW_POLE[0] + 2 * N.RESTORE_CHARGES]));
    // In the tote it cannot be used: only from the instrument slot.
    refuses(t, { a: 'use', uid: 'p', x: 5, y: 3 }, 'not_equipped');
  });

  test('the fork can be struck at any tile an exhibit could stand on within 8 tiles (the disc) in your line of sight, and its noise is soft and yours, at that tile', () => {
    const map = ['####################', '#..................#', '#.....#............#', '#.....#....v.......#', '#..................#', '#..........##......#', '#..................#', '#..................#', '#..................#', '####################'];
    const s = room({ map, you: [8, 4], items: [{ uid: 'f', kind: 'instrument', form: 'fork', tier: 1, where: { at: 'kit', slot: 'instrument' } }] });
    const m = s.dept, want = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const dx = x - 8, dy = y - 4, ch = map[y][x];
      if ((dx || dy) && dx * dx + dy * dy <= 8 * 8 + 8 && Grid.los(m, 8, 4, x, y) && ch !== '#') want.push([x, y]);
    }
    assert.equal(json(Kit.targets(s, 'f')), json(want));
    assert.ok(want.some(([x, y]) => x === 11 && y === 3), 'a case can be struck at');
    const ev = checked(step(s, { a: 'use', uid: 'f', x: 14, y: 3 })), noise = ev.find(e => e.k === 'noise');
    assert.equal(json([noise.x, noise.y, noise.cls, noise.range, noise.cause]), json([14, 3, 'soft', N.NOISE_SOFT, { k: 'fork', by: 'you', item: 'f' }]));
    assert.equal(ev[0].k, 'used');
    refuses(s, { a: 'use', uid: 'f', x: 17, y: 4 }, 'out_of_range');
    refuses(s, { a: 'use', uid: 'f', x: 4, y: 3 }, 'no_line');
    refuses(s, { a: 'use', uid: 'f', x: 6, y: 2 }, 'no_aim');
    refuses(s, { a: 'use', uid: 'f', x: -1, y: -1 }, 'no_aim');
    refuses(s, { a: 'use', uid: 'f', x: 8, y: 4 }, 'no_aim');
    refuses(s, { a: 'use', uid: 'f' }, 'no_aim');
    refuses(s, { a: 'use', uid: 'f', x: 9, y: 4, how: 'push' }, 'bad_use');
    refuses(s, { a: 'use', uid: 'f', x: 9, y: 4, on: 'you.w' }, 'bad_use');
  });

  test('the Pin-Driver fires a bolt of tier + 0 to 2 × tier + 2 with your Acc without the weapon\'s, at an exhibit you can see within 5 with a clear line, stopping at glass', () => {
    const shots = [], X = planted(), keep = X.Ranged.shoot;
    X.Ranged.shoot = (state, att, x, y, how, ev) => { shots.push(how); return keep(state, att, x, y, how, ev); };
    let hits = 0;
    for (let t = 1; t <= 4; t++) for (const [form, level, grade, cls] of [['heavy', 3, 1, 'S'], ['light', 0, 7, 'L'], ['balanced', 2, 3, null]]) {
      const curio = cls ? [{ uid: 'c', kind: 'curio', level: 1, where: { at: 'kit', slot: 'curio0' }, prims: [{ id: 'acc', cls }, { id: 'dmg', cls: 'L' }] }] : [];
      const s = X.Setup.room(t, { acc: 'T0', depth: 1, map: MAP, you: [3, 3], grade, kit: { weapon: { form, tier: 4, level } }, exhibits: [dummy([7, 3], 'hunting', { eva: -10 })],
        items: [{ uid: 'p', kind: 'instrument', form: 'pin_driver', tier: t, where: { at: 'kit', slot: 'instrument' } }].concat(curio) });
      shots.length = 0;
      const ev = X.Step.step(s, { a: 'use', uid: 'p', x: 7, y: 3 });
      for (const e of ev) assert.equal(X.Causes.check(e), null, json(e));
      const acc = 3 + (cls ? SIZE[cls] + 1 : 0);
      assert.equal(json(shots), json([{ kind: 'shot', item: 'p', dmin: t, dmax: 2 * t + 2, acc }]), `T${t} with a ${form} weapon`);
      const bolt = ev.find(e => e.k === 'damaged' && e.cause.k === 'item');
      if (bolt) { hits++; assert.ok(bolt.cause.raw >= t && bolt.cause.raw <= 2 * t + 2 && bolt.cause.item === 'p', json(bolt.cause)); }
      assert.equal(json([item(s, 'p').charges, X.Step.legal(s).length > 0]), json([N.PIN_DRIVER[0] - 1, true]));
      assert.equal(ev[ev.length - 1].k === 'used' || ev.some(e => e.k === 'used'), true);
      assert.equal(you(s).next, N.COST_USE, 'a use costs COST_USE, whatever the weapon');
    }
    assert.ok(hits >= 10, `${hits} bolts hit`);
    // Where it may be aimed: within 5 by the disc, at an exhibit in sight with a clear line.
    const map = ['#############', '#...........#', '#.....v.....#', '#...........#', '#...........#', '#...........#', '#############'];
    const s = X.Setup.room(1, { acc: 'T0', depth: 1, map, you: [3, 2], exhibits: [dummy([8, 2]), dummy([7, 5]), dummy([8, 5]), dummy([5, 4])],
      items: [{ uid: 'p', kind: 'instrument', form: 'pin_driver', tier: 1, where: { at: 'kit', slot: 'instrument' } }] });
    assert.equal(json(X.Kit.targets(s, 'p')), json([[7, 5], [5, 4]].sort((a, b) => a[1] - b[1] || a[0] - b[0])), 'behind glass, and (8, 5) beyond the disc, cannot be aimed at');
    const refused = (a, code) => { const before = X.State.canon(s), ev = X.Step.step(s, a); assert.equal(reason(ev), code, key(a)); assert.equal(X.State.canon(s), before); };
    refused({ a: 'use', uid: 'p', x: 8, y: 2 }, 'no_line');
    refused({ a: 'use', uid: 'p', x: 8, y: 5 }, 'out_of_range');
    refused({ a: 'use', uid: 'p', x: 4, y: 4 }, 'no_target');
    // A mimic in its disguise shows as a case, so it cannot be aimed at.
    X.Archetypes.present = (state, a) => a.uid === 'T0.1.room.4' ? { as: 'case' } : null;
    refused({ a: 'use', uid: 'p', x: 5, y: 4 }, 'no_target');
    // With W1-ARCH-B's bolt not yet built, a use is refused and spends nothing.
    const Y = loadCore(), s2 = room({ exhibits: [dummy([6, 3])], items: [{ uid: 'p', kind: 'instrument', form: 'pin_driver', tier: 1, where: { at: 'kit', slot: 'instrument' } }] }, null, Y);
    const before = Y.State.canon(s2);
    assert.equal(reason(Y.Step.step(s2, { a: 'use', uid: 'p', x: 6, y: 3 })), 'not_built');
    assert.equal(Y.State.canon(s2), before);
  });

  test('the Window Pole pushes or pulls a one-tile exhibit one tile, where it could step itself, without waking it; or takes from an opened or broken case within 2', () => {
    const map = ['#########', '#.......#', '#.......#', '#...+...#', '#.......#', '#.u.k.v.#', '#########'];
    const make = (exhibits, extra) => room(Object.assign({ map, you: [3, 2], exhibits, items: [{ uid: 'w', kind: 'instrument', form: 'pole', tier: 1, where: { at: 'kit', slot: 'instrument' } },
      { uid: 'a', kind: 'curio', where: { at: 'case', x: 2, y: 5 } }, { uid: 'b', kind: 'curio', where: { at: 'case', x: 4, y: 5 } }, { uid: 'c', kind: 'curio', where: { at: 'case', x: 6, y: 5 } }],
      fixtures: [Cases.make({ x: 2, y: 5, room: 'room', st: 'open', holds: 'a' }), Cases.make({ x: 4, y: 5, room: 'room', st: 'broken', holds: 'b' }), Cases.make({ x: 6, y: 5, room: 'room', st: 'shut', holds: 'c' })] }, extra));
    // Push straight, from one and two tiles; pull diagonally from two; never into a wall or
    // onto your own tile.
    for (const [at, how, to] of [[[4, 2], 'push', [5, 2]], [[5, 2], 'push', [6, 2]], [[5, 1], 'pull', [4, 2]], [[4, 1], 'push', null], [[1, 1], 'push', null], [[3, 1], 'pull', null], [[2, 1], 'push', null]]) {
      const s = make([dummy(at, 'dormant')]), a = s.actors[1], act = { a: 'use', uid: 'w', x: at[0], y: at[1], how };
      if (!to) { refuses(s, act, 'cannot_move'); continue; }
      const ev = checked(step(s, act));
      assert.equal(json([a.x, a.y, a.mode]), json([to[0], to[1], 'dormant']), `${how} from ${at}`);
      assert.ok(!ev.some(e => e.k === 'woke' || (e.k === 'pip' && e.who === a.uid && e.cause.k !== 'ring')), 'the pole wakes nothing');
      assert.equal(json(ev.find(e => e.k === 'moved').cause), json({ k: 'pole', by: 'you', item: 'w' }));
    }
    // Not onto another exhibit or a closed door; not a 2×2 exhibit or one in a case; not where
    // its archetype would not step (mayStep).
    refuses(make([dummy([4, 2]), dummy([5, 2])]), { a: 'use', uid: 'w', x: 4, y: 2, how: 'push' }, 'cannot_move');
    refuses(make([dummy([4, 2])], { map: map.map((r, y) => y === 2 ? '#....+..#' : r) }), { a: 'use', uid: 'w', x: 4, y: 2, how: 'push' }, 'cannot_move');
    refuses(make([Object.assign(dummy([4, 1]), { size: 2 })]), { a: 'use', uid: 'w', x: 4, y: 1, how: 'push' }, 'no_target');
    refuses(make([dummy([4, 3])], { map: map.map((r, y) => y === 3 ? '#...v...#' : r) }), { a: 'use', uid: 'w', x: 4, y: 3, how: 'push' }, 'no_target');
    const X = planted();
    X.Archetypes.mayStep = (state, a, x, y) => !(x === 5 && y === 2);
    const kept = room({ map, you: [3, 2], exhibits: [dummy([4, 2])], items: [{ uid: 'w', kind: 'instrument', form: 'pole', tier: 1, where: { at: 'kit', slot: 'instrument' } }] }, null, X);
    const before = X.State.canon(kept);
    assert.equal(reason(X.Step.step(kept, { a: 'use', uid: 'w', x: 4, y: 2, how: 'push' })), 'cannot_move');
    assert.equal(X.State.canon(kept), before);
    // Take: from an opened and a broken case within 2 (the disc), never a shut one.
    const s = make([]);
    s.actors[0].x = 3; s.actors[0].y = 3; s.dept.tiles[3] = '#.......#';
    for (const [x, uid] of [[2, 'a'], [4, 'b']]) {
      const ev = checked(step(s, { a: 'use', uid: 'w', x, y: 5, how: 'take' }));
      assert.equal(json([item(s, uid).where, s.dept.fixtures.find(f => f.x === x).holds]), json([{ at: 'tote' }, null]));
      assert.equal(json(ev.map(e => e.k)), json(['used', 'took']));
      assert.equal(json([ev[1].cause.inCase, ev[1].cause.tool]), json([true, 'w']));
    }
    refuses(s, { a: 'use', uid: 'w', x: 6, y: 5, how: 'take' }, 'out_of_range');
    s.actors[0].x = 5;
    refuses(s, { a: 'use', uid: 'w', x: 6, y: 5, how: 'take' }, 'nothing_to_take');
    refuses(s, { a: 'use', uid: 'w', x: 4, y: 5, how: 'take' }, 'nothing_to_take');
    refuses(s, { a: 'use', uid: 'w', x: 6, y: 5, how: 'lift' }, 'bad_use');
    refuses(s, { a: 'use', uid: 'w', x: 6, y: 5 }, 'bad_use');
    assert.equal(item(s, 'w').charges, N.WINDOW_POLE[0] - 2);
    // A full tote refuses the take.
    const full = make([], { you: [3, 3] });
    full.dept.tiles[3] = '#.......#';
    for (let i = 0; i < N.TOTE_SLOTS; i++) { full.items.push(Kit.item({ uid: 'z' + i, kind: 'curio', where: { at: 'tote' } })); full.you.tote.push('z' + i); }
    refuses(full, { a: 'use', uid: 'w', x: 2, y: 5, how: 'take' }, 'tote_full');
  });

  test('quiet: your ring is QUIET_RING smaller after a move while you wear a quiet item, and the same otherwise', () => {
    const s = room({ items: [{ uid: 'q', kind: 'curio', where: { at: 'tote' }, prims: [{ id: 'quiet', cls: 'S' }] }, { uid: 'q2', kind: 'curio', where: { at: 'tote' }, prims: [{ id: 'quiet', cls: 'L' }] }] });
    const r = () => Vision.ringRadius(s);
    step(s, { a: 'move', dir: 2 }); assert.equal(r(), N.RING_MOVING);
    step(s, { a: 'equip', uid: 'q' }); assert.equal(r(), N.RING_MOVING, 'an equip is not a move');
    step(s, { a: 'move', dir: 6 }); assert.equal(r(), N.RING_MOVING - N.QUIET_RING);
    step(s, { a: 'equip', uid: 'q2' }); step(s, { a: 'move', dir: 2 }); assert.equal(r(), N.RING_MOVING - N.QUIET_RING, 'two quiet items do no more than one');
    step(s, { a: 'wait' }); assert.equal(r(), N.RING_STILL, 'still: the ring is not made smaller');
    step(s, { a: 'unequip', slot: 'curio0' }); step(s, { a: 'unequip', slot: 'curio1' }); step(s, { a: 'move', dir: 6 }); assert.equal(r(), N.RING_MOVING);
    // On a loud floor the ring is larger, and quiet still takes its 1.
    const t = room({ map: MAP.map((row, y) => y === 3 ? '#..xx.......#' : row), items: [{ uid: 'q', kind: 'curio', where: { at: 'kit', slot: 'curio0' }, prims: [{ id: 'quiet', cls: 'S' }] }] });
    step(t, { a: 'move', dir: 2 });
    assert.equal(Vision.ringRadius(t), N.RING_MOVING + N.RING_LOUD_FLOOR - N.QUIET_RING);
  });

  test('Step.legal lists exactly the item actions step() accepts, over every candidate, in rooms full of items and in the departments', () => {
    const X = planted();
    const map = ['###########', '#.........#', '#....u....#', '#.........#', '#....+....#', '#.........#', '###########'];
    let states = 0, itemActs = 0;
    for (let seed = 1; seed <= 3; seed++) {
      const s = X.Setup.room(seed, { acc: 'T0', depth: 2, map, you: [3, 3], exhibits: [dummy([7, 1], 'dormant'), dummy([7, 5], 'dormant')],
        fixtures: [X.Cases.make({ x: 5, y: 2, room: 'room', st: 'open', holds: 'cased' })],
        items: [{ uid: 'f', kind: 'instrument', form: ['fork', 'pin_driver', 'pole'][seed - 1], tier: 2, where: { at: 'kit', slot: 'instrument' } },
          { uid: 'i2', kind: 'instrument', form: ['pole', 'fork', 'pin_driver'][seed - 1], tier: 1, where: { at: 'floor', x: 2, y: 3 } },
          { uid: 'cased', kind: 'garment', form: 'light', tier: 2, where: { at: 'case', x: 5, y: 2 } }, { uid: 'k1', kind: 'kit', ref: 'restoration', where: { at: 'tote' } },
          { uid: 'k2', kind: 'kit', ref: 'restoration', where: { at: 'floor', x: 4, y: 3 } }, { uid: 'cu', kind: 'curio', prims: [{ id: 'acc', cls: 'S' }], where: { at: 'floor', x: 3, y: 4 } },
          { uid: 'bt', kind: 'consumable', ck: 'card', seal: 'ink1', n: 1, where: { at: 'floor', x: 2, y: 2 } }] });
      s.actors[0].hp = s.actors[0].maxHp = 999;
      for (let k = 0; k < 11 && !s.over; k++) {
        const legal = parity(s, `room ${seed}, step ${k}`, X);
        states++;
        const items = legal.filter(a => ['take', 'drop', 'equip', 'unequip', 'use'].includes(a.a));
        itemActs += items.length;
        const a = items.length && k % 3 !== 2 ? items[(k * 7 + seed) % items.length] : legal[(k * 5 + seed) % legal.length];
        for (const e of X.Step.step(s, a)) assert.equal(X.Causes.check(e), null, json(e));
      }
    }
    // Departments, where the stand-in placement puts items: walk to some and act on them.
    for (const acc of ['S9', 'A4', 'M11']) {
      const d = X.Dept.create(2, acc, 3);
      const it = d.items.find(i => i.where.at === 'floor');
      d.actors[0].x = it.where.x; d.actors[0].y = it.where.y;
      for (let k = 0; k < 3; k++) { const legal = parity(d, `${acc} step ${k}`, X); states++; const items = legal.filter(a => ['take', 'equip', 'use', 'drop'].includes(a.a)); X.Step.step(d, items.length ? items[0] : legal[0]); }
    }
    assert.ok(states >= 40 && itemActs > 100, `${states} states, ${itemActs} legal item actions`);
  });

  test('the tier of a placed weapon, garment or instrument is the lower tier on offer with 60 in 100, else the next up: over 1,000 placements, inside the Wilson interval', () => {
    // Kit.drawTier, on its own stream: the share at the lower tier.
    for (let depth = 1; depth <= 7; depth++) {
      const r = Rng.stream({ seed: depth, rng: {} }, 'tier'), low = N.TIER_LOW_BY_DEPTH[depth - 1];
      let k = 0;
      for (let i = 0; i < 10000; i++) { const t = Kit.drawTier(r, depth); assert.ok(t === low || t === Math.min(4, low + 1)); if (t === low) k++; }
      if (depth < 7) { const w = Stats.wilson(k, 10000, Stats.Z999); assert.ok(w.lo <= 0.6 && 0.6 <= w.hi, `depth ${depth}: ${k} of 10000 low`); }
      else assert.equal(k, 10000, 'at depth 7 the lower tier is T4, and there is none higher');
    }
    // The stand-in placement itself, rerun on a department with fresh placement holders (pop),
    // until 1,000 weapons, garments and instruments are placed: the share at the lower tier.
    let n = 0, low = 0;
    for (const [acc, depth] of [['A4', 1], ['M11', 3], ['S9', 5], ['A4', 6]]) {
      const base = Dept.create(depth, acc, depth), lo = N.TIER_LOW_BY_DEPTH[depth - 1], key = Layout.generate(Packs.get(acc).programme, 0, depth, { acc, depth }).base;
      for (let k = 1; n < 250 * (['A4', 'M11', 'S9'].indexOf(acc) + (depth === 6 ? 4 : 1)) && k < 2000; k++) {
        const t = State.clone(base);
        t.items = t.items.filter(i => i.uid.startsWith('you.')); t.dept.highlights = [];
        Kit.standIn(t, key, { seed: k, rng: {} });
        for (const it of t.items) {
          if (it.uid.startsWith('you.') || !['weapon', 'garment', 'instrument'].includes(it.kind)) continue;
          assert.ok(it.tier === lo || it.tier === lo + 1, `${it.uid}: T${it.tier} at depth ${depth}`);
          n++; if (it.tier === lo) low++;
        }
      }
    }
    const w = Stats.wilson(low, n, Stats.Z999);
    assert.ok(n >= 1000 && w.lo <= 0.6 && 0.6 <= w.hi, `${low} of ${n} placements at the lower tier: [${w.lo.toFixed(3)}, ${w.hi.toFixed(3)}]`);
    // And in departments as they are made.
    for (let seed = 1; seed <= 12; seed++) {
      const acc = ['S9', 'A4', 'M11'][seed % 3], depth = 1 + seed % 7, s = Dept.create(seed, acc, depth), lo = N.TIER_LOW_BY_DEPTH[depth - 1];
      for (const it of s.items) if (!it.uid.startsWith('you.') && ['weapon', 'garment', 'instrument'].includes(it.kind)) assert.ok(it.tier === lo || it.tier === Math.min(4, lo + 1), it.uid);
    }
  });

  // A core whose Cases.place makes a case of every in-room vitrine, drawing glass, lock and
  // loan on its room's populate stream (as W1-CASES's will), and whose highlightOk lets a
  // Highlight into a case whose lock is within your entry grade; optionally one more draw on
  // one room's stream, to perturb it.
  const casesCores = new Map();
  function withCases(perturb) {
    if (casesCores.has(perturb)) return casesCores.get(perturb);
    const X = loadCore();
    casesCores.set(perturb, X);
    X.Cases.place = (state, plan, base, pop) => {
      const m = state.dept;
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        if (m.tiles[y][x] !== 'v') continue;
        const rm = m.rooms.find(r => r.id === m.roomOf[y][x]);
        if (!rm) continue;
        const d = X.Cases.draw(X.Rng.stream(pop, `${base}/room/${rm.key}/populate`), m.depth);
        m.fixtures.push(X.Cases.make({ x, y, room: rm.key, num: `${rm.number}.${m.fixtures.length + 1}`, glass: d.glass, lock: d.lock, loan: d.loan }));
      }
      if (perturb) X.Rng.stream(pop, `${base}/room/${perturb}/populate`).u32();
    };
    X.Cases.highlightOk = (state, f) => f.lock <= state.dept.entryGrade;
    return X;
  }

  test('item uids are <acc>.<depth>.<roleKey>.i<n>, n counted per room in placement order, and stay as they are when another room is perturbed or an exhibit removed', () => {
    const X = withCases(null);
    let checked = 0, moved = 0;
    for (const acc of ['S9', 'A4', 'M11']) for (const depth of [1, 4, 7]) for (const seed of [1, 2]) {
      const s = X.Dept.create(seed, acc, depth), count = {};
      for (const it of s.items.filter(i => !i.uid.startsWith('you.'))) {
        const k = X.Cases.roomKey(s, it.where.x, it.where.y);
        count[k] = (count[k] || 0) + 1;
        assert.equal(it.uid, `${acc}.${depth}.${k}.i${count[k]}`);
        assert.ok(['section', 'study'].includes(s.dept.rooms.find(r => r.key === k).role), `${it.uid} is in a section or study`);
        checked++;
      }
      // Perturb one room: the items of every other room keep their uid, place and tier.
      const rooms = [...new Set(s.items.filter(i => !i.uid.startsWith('you.')).map(i => i.uid.split('.')[2]))];
      for (const r of rooms) {
        const t = withCases(r).Dept.create(seed, acc, depth), other = it => it.uid.startsWith('you.') || it.uid.split('.')[2] !== r;
        assert.equal(json(t.items.filter(other)), json(s.items.filter(other)), `${acc} d${depth}: perturbing ${r}`);
        if (json(t.items.filter(i => !other(i))) !== json(s.items.filter(i => !other(i)))) moved++;
      }
      // Remove an exhibit: every item stays.
      const gone = s.actors[1 + seed % (s.actors.length - 1)].uid;
      assert.equal(json(X.Dept.create(seed, acc, depth, { without: [gone] }).items), json(s.items), `${acc} d${depth}: without ${gone}`);
    }
    assert.ok(checked > 60 && moved > 5, `${checked} uids; ${moved} perturbed rooms changed their own items`);
    // Kit.make numbers on from the highest uid in the room, so nothing placed later shares one.
    const s = X.Dept.create(1, 'M11', 2), it = s.items.find(i => i.where.at === 'floor' && !i.uid.startsWith('you.')), k = it.uid.split('.')[2];
    const max = Math.max(...s.items.filter(i => i.uid.split('.')[2] === k).map(i => +i.uid.split('i').pop()));
    assert.equal(X.Kit.nextUid(s, k), `M11.2.${k}.i${max + 1}`);
    const made = X.Kit.make(s, { kind: 'kit' }, { at: 'floor', x: it.where.x, y: it.where.y });
    assert.equal(json([made.uid, made.ref, made.where]), json([`M11.2.${k}.i${max + 1}`, 'restoration', it.where]));
    assert.throws(() => X.Kit.make(s, { id: 'M11.9', kind: 'weapon', form: 'reach', prims: [] }, { at: 'floor', x: 1, y: 1 }), /tier/);
    assert.throws(() => X.Kit.make(s, { kind: 'consumable' }, { at: 'floor', x: 1, y: 1 }), /not consumable/);
    assert.throws(() => X.Kit.make(s, Object.assign({ uid: made.uid }, { kind: 'kit' }), { at: 'tote' }), /already exists/);
  });

  test('a department places 2 pieces of equipment, a curio or instrument and 2 Restoration kits, the kits its Highlights: never behind a staff door, and in a case only where highlightOk holds', () => {
    const X = withCases(null);
    let inCase = 0, kitsInCase = 0, depts = 0;
    for (const acc of ['S9', 'A4', 'M11']) for (const depth of [1, 3, 5, 7]) for (const seed of [1, 2, 3, 4, 5]) {
      const s = X.Dept.create(seed, acc, depth), m = s.dept, pack = Packs.get(acc), placed = s.items.filter(i => !i.uid.startsWith('you.'));
      depts++;
      const gear = pack.items.filter(i => i.kind === 'weapon' || i.kind === 'garment'), extra = pack.items.filter(i => i.kind === 'curio' || i.kind === 'instrument');
      const kinds = placed.map(i => i.kind);
      assert.equal(kinds.filter(k => k === 'weapon' || k === 'garment').length, gear.length ? N.EQUIPMENT_PER_DEPT : 0, `${acc}: equipment`);
      assert.equal(kinds.filter(k => k === 'curio' || k === 'instrument').length, extra.length ? N.CURIO_OR_INSTRUMENT_PER_DEPT : 0, `${acc}: curio or instrument`);
      assert.equal(kinds.filter(k => k === 'kit').length, N.KITS_PER_DEPT);
      for (const it of placed) {
        if (it.kind !== 'kit') { const rec = pack.items.find(r => r.id === it.ref); assert.ok(rec, `${it.uid} comes from the pack`); assert.equal(it.form, rec.instrument || rec.form || null); assert.equal(json(it.prims), json(rec.prims)); }
        if (it.where.at === 'case') { inCase++; const f = m.fixtures.find(f => f.x === it.where.x && f.y === it.where.y); assert.ok(f && f.holds === it.uid && !f.loan && f.mimic === null, `${it.uid}'s case`); }
        else assert.equal(m.tiles[it.where.y][it.where.x], '.', `${it.uid} lies on a floor tile`);
        assert.ok(!s.actors.some(a => Actors.covers(a, it.where.x, it.where.y)), `${it.uid}: no actor stands on it`);
      }
      // The Highlights: each kit, with its room's key; walkable to without a staff door.
      assert.equal(json(m.highlights.map(h => h.uid)), json(placed.filter(i => i.kind === 'kit').map(i => i.uid)));
      const walk = new Int32Array(m.w * m.h).fill(-1), q = [m.entrance];
      walk[m.entrance[1] * m.w + m.entrance[0]] = 0;
      const open = (x, y) => '.,+\'EXuk xwb='.includes(m.tiles[y][x]) && m.tiles[y][x] !== ' ' || s.dept.fixtures.some(f => f.mimic && f.x === x && f.y === y);
      while (q.length) {
        const [x, y] = q.shift();
        for (let d = 0; d < 8; d++) {
          const nx = x + Grid.DX[d], ny = y + Grid.DY[d];
          if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || walk[ny * m.w + nx] >= 0 || !open(nx, ny)) continue;
          if (Grid.DX[d] && Grid.DY[d] && !(open(nx, y) && open(x, ny))) continue;
          walk[ny * m.w + nx] = 0; q.push([nx, ny]);
        }
      }
      for (const h of m.highlights) {
        const it = item(s, h.uid), { x, y } = it.where;
        assert.equal(h.room, X.Cases.roomKey(s, x, y));
        const near = it.where.at === 'case' ? [0, 1, 2, 3, 4, 5, 6, 7].some(d => walk[(y + Grid.DY[d]) * m.w + x + Grid.DX[d]] >= 0) : walk[y * m.w + x] >= 0;
        assert.ok(near, `${h.uid} can be walked to from the entrance without a staff door`);
        if (it.where.at === 'case') { kitsInCase++; assert.ok(m.fixtures.find(f => f.x === x && f.y === y).lock <= m.entryGrade, `${h.uid}'s case is within the entry grade`); }
      }
    }
    assert.ok(depts === 60 && inCase > 3, `${inCase} items and ${kitsInCase} kits placed in cases`);
    // One section with no free floor: a dormant exhibit on each floor tile but one beside the
    // door, and two cases, one locked at grade I, one at grade III; behind a staff door, a
    // study with free floor. Two pieces of equipment, the pack's instrument and two kits are
    // placed: the kits go to the case your entry grade opens and to the floor tile left
    // (never behind the staff door), the others wherever there is room.
    const Z = withCases(null), map = ['##########', '#....v.v.#', '#........#', 'E........#', '#####S####', '#........#', '##########'];
    const t = Z.Setup.room(3, { acc: 'S9', depth: 2, map, you: [1, 3], entrance: [0, 3], fixtures: [Z.Cases.make({ x: 5, y: 1, room: 's1', lock: 1 }), Z.Cases.make({ x: 7, y: 1, room: 's1', lock: 3 })],
      exhibits: [] });
    const roomOf = map.map((row, y) => Array.from(row, (ch, x) => y >= 1 && y <= 3 && x >= 1 && x <= 8 ? 1 : y === 5 && x >= 1 && x <= 8 ? 2 : 0));
    Object.assign(t.dept, { roomOf, rooms: [{ id: 1, key: 's1', role: 'section', number: 302, x0: 1, y0: 1, x1: 8, y1: 3 }, { id: 2, key: 'study1', role: 'study', number: 303, x0: 1, y0: 5, x1: 8, y1: 5 }] });
    let n = 0;
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 8; x++) if (map[y][x] === '.' && !(x === 1 && y === 3) && !(x === 2 && y === 3)) Z.Actors.spawn(t, { uid: 'S9.2.s1.' + ++n, sp: 'dummy', x, y, hp: 9, mode: 'dormant' });
    Z.Kit.standIn(t, 'layout/S9@1/d2/a0', { seed: 3, rng: {} });
    const kits = t.dept.highlights.map(h => item(t, h.uid).where);
    assert.equal(json(kits.map(w => [w.at, w.x, w.y]).sort()), json([['case', 5, 1], ['floor', 2, 3]]), 'the kits: the case at grade I and the one free floor tile in reach');
    assert.equal(json(t.dept.highlights.map(h => h.room)), json(['s1', 's1']));
    const others = t.items.filter(i => !i.uid.startsWith('you.') && i.kind !== 'kit');
    assert.ok(others.every(i => (i.where.at === 'case' && i.where.x === 7) || i.where.y === 5), `the rest: ${json(others.map(i => i.where))}`);
    assert.equal(t.dept.fixtures.find(f => f.x === 5).holds, t.dept.highlights.find(h => item(t, h.uid).where.at === 'case').uid);
  });

  test('Kit.view shows what you wear and carry, your instrument\'s charges, the items in sight and the Highlights not yet taken; Kit.describe gives an item\'s label data', () => {
    const s = room({ map: MAP.map((r, y) => y === 2 ? '#...#.......#' : r), you: [3, 3], items: [
      { uid: 'f', kind: 'instrument', form: 'fork', tier: 2, where: { at: 'kit', slot: 'instrument' } }, { uid: 'c', kind: 'curio', level: 2, where: { at: 'tote' }, prims: [{ id: 'acc', cls: 'M' }] },
      { uid: 'w', kind: 'weapon', form: 'heavy', tier: 3, level: 1, where: { at: 'floor', x: 5, y: 3 }, ref: 'A4.7', prims: [{ id: 'dmg', cls: 'L' }] },
      { uid: 'hid', kind: 'garment', form: 'light', tier: 1, where: { at: 'floor', x: 5, y: 1 } }, { uid: 'bt', kind: 'consumable', ck: 'card', seal: 'ink1', n: 1, where: { at: 'floor', x: 4, y: 3 } }] });
    s.dept.highlights.push({ uid: 'w', room: 'room' });
    checked(step(s, { a: 'use', uid: 'f', x: 6, y: 3 }));
    const v = Kit.view(s);
    assert.equal(json([v.kit, v.tote]), json([{ weapon: 'you.w', garment: 'you.g', curio: [null, null], instrument: 'f' }, ['c']]));
    assert.equal(json(v.charges), json({ uid: 'f', charges: N.TUNING_FORK[0] - 1, max: N.TUNING_FORK[0], back: N.TUNING_FORK[1] - 1 }));
    assert.equal(json(v.items), json([{ uid: 'w', x: 5, y: 3, icon: 'weapon', kind: 'weapon', inCase: false }]), 'out of sight (behind the wall) and consumables are not listed');
    assert.equal(json(v.highlights), json([{ uid: 'w', room: 'room' }]));
    // describe: a pack weapon at grade I, one tier too high and then some.
    const d = Kit.describe(s, 'w');
    assert.equal(json([d.title, d.kind, d.form, d.tier, d.level, d.needs, d.short]), json([Packs.get('A4').items[0].name, 'weapon', 'heavy', 3, 1, 6, 5]));
    assert.equal(json(d.stats), json({ dmin: 3 + 2 + 1, dmax: 4 * 3 + 4 + 1, acc: 3 - 1 + 0 - 2 * 5, cost: 150 }), 'its own numbers, before its bonus');
    assert.equal(json(d.bonuses), json([{ id: 'dmg', cls: 'L', n: 3 }]));
    assert.equal(json(d.parts.map(p => p.table + '.' + p.id)), json(['CLAUSES.weapon_heavy', 'CLAUSES.item_grade', 'ITEM_PRIMS.dmg']));
    assert.ok(d.line.includes('A Heavy weapon strikes for tier + 2 to 4 × tier + 4 damage') && d.line.includes('adds 1, 2 or 3') && clean(d.line), d.line);
    const c = Kit.describe(s, 'c'), f = Kit.describe(s, 'f');
    assert.equal(json([c.rank, c.bonuses, c.needs, c.short]), json([2, [{ id: 'acc', cls: 'M', n: 4 }], null, 0]));
    assert.equal(json([f.instrument.id, f.instrument.charges, f.instrument.range, f.parts.map(p => p.id)]), json(['fork', N.TUNING_FORK[0] - 1, 8, ['fork']]));
    assert.ok(f.line.startsWith('Struck, it makes a soft noise') && f.line.includes('within 8 tiles') && f.line.includes('every 40 turns'), f.line);
    assert.equal(Kit.describe(s, 'nobody'), null);
    // Every clause of reg/items.js fills from its numbers of record, cleanly.
    for (const t of ['ITEM_PRIMS', 'INSTRUMENTS', 'KITS', 'CLAUSES', 'REFUSALS']) for (const id of Registry.order(t)) {
      const e = Registry[t][id];
      if (typeof e.clause !== 'string') continue;
      const text = C.Clauses.fill(e.clause, C.Clauses.params(e.params, null, { depth: 1 }));
      assert.ok(clean(text) && !/[{}]/.test(text), `${t}.${id}: ${text}`);
    }
  });

  test('the kit\'s invariants hold over a walk with every item action, and each catches a planted fault', () => {
    const Inv = require(path.join(root, 'tools/invariants.js')), invs = Inv.load(C).filter(i => i.file === 'kit');
    assert.equal(json(invs.map(i => i.id)), json(['kit.one_place', 'kit.tote', 'kit.slots', 'kit.derived', 'kit.charges', 'kit.costs', 'kit.uses', 'kit.quiet', 'kit.highlights']));
    const check = (pre, action, events, post) => Inv.checker(C, invs)(pre, action, events, post).map(v => v.inv);
    const base = room({ fixtures: [Cases.make({ x: 5, y: 3, st: 'open', holds: 'cased' })], items: [{ uid: 'f', kind: 'instrument', form: 'fork', tier: 1, where: { at: 'kit', slot: 'instrument' } },
      { uid: 'c', kind: 'curio', where: { at: 'tote' }, prims: [{ id: 'quiet', cls: 'S' }] }, { uid: 'k', kind: 'kit', where: { at: 'tote' } },
      { uid: 'cased', kind: 'curio', where: { at: 'case', x: 5, y: 3 } }, { uid: 'b', kind: 'consumable', ck: 'card', seal: 'ink1', n: 1, where: { at: 'tote' } }] });
    base.dept.highlights.push({ uid: 'k', room: 'room' });
    const s = State.clone(base);
    for (const a of [{ a: 'equip', uid: 'c' }, { a: 'move', dir: 2 }, { a: 'use', uid: 'f', x: 8, y: 3 }, { a: 'use', uid: 'k', on: 'you.w' }, { a: 'unequip', slot: 'garment' }, { a: 'drop', uid: 'you.g' }, { a: 'move', dir: 6 }]) {
      const pre = State.clone(s), ev = Step.step(s, a);
      assert.notEqual(ev[0].k, 'refused', key(a));
      assert.equal(json(check(pre, a, ev, s)), '[]', key(a));
    }
    // Planted faults, each on a clean step: what each invariant must catch.
    const faults = [
      ['kit.one_place', t => { t.you.tote.push('c'); }],
      ['kit.one_place', t => { item(t, 'cased').where = { at: 'floor', x: 99, y: 1 }; }],
      ['kit.tote', t => { for (let i = 0; i < 16; i++) { t.items.push(Kit.item({ uid: 'z' + i, kind: 'curio', where: { at: 'tote' } })); t.you.tote.push('z' + i); } }],
      ['kit.tote', t => { t.items.push(Kit.item({ uid: 'b2', kind: 'consumable', ck: 'card', seal: 'ink1', n: 1, where: { at: 'tote' } })); t.you.tote.push('b2'); }],
      ['kit.slots', t => { item(t, 'c').where = { at: 'kit', slot: 'instrument' }; item(t, 'f').where = { at: 'tote' }; t.you.tote.splice(t.you.tote.indexOf('c'), 1, 'f'); t.you.kit.instrument = 'c'; }],
      ['kit.derived', t => { t.actors[0].pad = 9; }],
      ['kit.charges', t => { item(t, 'f').charges = 7; }],
      ['kit.highlights', t => { t.dept.highlights.push({ uid: 'c', room: 'room' }); }],
    ];
    for (const [id, plant] of faults) {
      const t = State.clone(base), pre = State.clone(t), ev = Step.step(t, { a: 'wait' });
      plant(t);
      assert.ok(check(pre, { a: 'wait' }, ev, t).includes(id), `${id} misses a planted fault`);
    }
    // A step that charges the wrong cost, a fork that makes no noise, a quiet ring not taken.
    const t = State.clone(base), pre = State.clone(t), ev = Step.step(t, { a: 'use', uid: 'f', x: 8, y: 3 });
    t.actors[0].next += 1;
    assert.ok(check(pre, { a: 'use', uid: 'f', x: 8, y: 3 }, ev, t).includes('kit.costs'));
    assert.ok(check(pre, { a: 'use', uid: 'f', x: 8, y: 3 }, ev.filter(e => e.k !== 'noise'), t).includes('kit.uses'));
    const q = State.clone(base); Step.step(q, { a: 'equip', uid: 'c' });
    const qp = State.clone(q), qe = Step.step(q, { a: 'move', dir: 2 });
    const keep = C.Kit.ringDelta; C.Kit.ringDelta = () => 0;
    try { assert.ok(check(qp, { a: 'move', dir: 2 }, qe, q).includes('kit.quiet')); } finally { C.Kit.ringDelta = keep; }
  });

  test('every item event passes its schema, and every sentence and refusal of the kit is clean', () => {
    const codes = Registry.order('REFUSALS').filter(c => Registry.REFUSALS[c].tests.includes('m3-kit.test.js'));
    assert.ok(codes.length >= 19);
    for (const c of codes) { const s = Text.refusal(c); assert.ok(clean(s) && /^[A-Z]/.test(s) && /\.$/.test(s), `${c}: ${s}`); }
    // Sentences over a walk with every kind of item event, with and without names.
    const X = planted(), map = ['###########', '#.........#', '#....u....#', '#.........#', '###########'];
    const s = X.Setup.room(4, { acc: 'T0', depth: 1, map, you: [3, 2], exhibits: [dummy([8, 2], 'dormant', { acc: -50 })], fixtures: [X.Cases.make({ x: 5, y: 2, st: 'open', holds: 'g' })],
      items: [{ uid: 'p', kind: 'instrument', form: 'pole', tier: 1, where: { at: 'kit', slot: 'instrument' } }, { uid: 'g', kind: 'garment', form: 'heavy', tier: 2, where: { at: 'case', x: 5, y: 2 } },
        { uid: 'k', kind: 'kit', where: { at: 'tote' } }, { uid: 'pd', kind: 'instrument', form: 'pin_driver', tier: 1, where: { at: 'tote' } }, { uid: 'ff', kind: 'instrument', form: 'fork', tier: 1, where: { at: 'tote' } }] });
    const seen = new Set();
    const walk = [{ a: 'use', uid: 'p', x: 5, y: 2, how: 'take' }, { a: 'equip', uid: 'g' }, { a: 'use', uid: 'k', on: 'g' }, { a: 'equip', uid: 'pd' }, { a: 'use', uid: 'pd', x: 8, y: 2 },
      { a: 'equip', uid: 'ff' }, { a: 'use', uid: 'ff', x: 6, y: 1 }, { a: 'unequip', slot: 'instrument' }, { a: 'drop', uid: 'p' }, { a: 'take', uid: 'p' }, { a: 'equip', uid: 'p' }, 'pull'];
    for (let a of walk) {
      // The exhibit, awake by now, stood where the pole can pull it toward you.
      if (a === 'pull') { Object.assign(s.actors[1], { x: 5, y: 1 }); a = { a: 'use', uid: 'p', x: 5, y: 1, how: 'pull' }; }
      const ev = X.Step.step(s, a);
      assert.notEqual(ev[0].k, 'refused', key(a) + ' ' + json(ev[0]));
      for (const e of ev) {
        assert.equal(X.Causes.check(e), null, json(e));
        for (const names of [null, uid => uid.startsWith('T0') ? 'the Lantern-Crop Wader' : null]) { const t = X.Text.event(e, names); assert.ok(clean(t), `${e.k}: ${t}`); }
        seen.add(e.k + (e.cause ? '.' + e.cause.k : '') + (e.k === 'used' ? ':' + e.how : ''));
      }
    }
    for (const k of ['took.take', 'equipped.equip', 'equipped.unequip', 'dropped.drop', 'used.use:take', 'used.use:restore', 'used.use:pin_driver', 'used.use:fork', 'used.use:pull', 'noise.fork'])
      assert.ok(seen.has(k), `${k} was seen: ${[...seen].join(' ')}`);
    assert.equal(X.Text.event(s.items && { k: 'used', turn: 1, tick: 100, who: 'you', item: 'p', how: 'push', cause: { k: 'use', x: 1, y: 1, at: 'T0.4.room.1', charges: 1 } }, uid => uid === 'T0.4.room.1' ? 'the Lantern-Crop Wader' : null),
      'You pushed the Lantern-Crop Wader one tile with the Window Pole (1 charge left).');
  });
};
