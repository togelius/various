// ACCESSION — every refusal code, joined up (BUILD.md §4.2, §5.1; W2a-BEHAVIOUR). Each M3
// code in Registry.REFUSALS is made to happen here by a real action in the real core, with
// nothing stubbed: a room is made, the state got ready by real actions where it needs them
// (a visit ended, a Card's choice waiting, a ring marked), and then the action is refused.
// For each: the action is not among Step.legal's (the buttons), step() answers with exactly
// one refused event with that code, every invariant holds (system.inv.js: a refused step has
// no other event and changes nothing, not even a stream), the run is clone-checked, and the
// refusal's sentence is a clean one. A code with no way to happen in M3 is named in
// UNREACHABLE with why, and is not promoted (test/behaviour/follow-ups.json holds it).
'use strict';
const H = require('./_harness.js');
const Inv = require('../../tools/invariants.js');

module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Setup, Step, Text, Labels, Registry: R, Consumables, N, Roles, Cases, Specials } = C;
  const json = x => JSON.stringify(x);
  const OPEN = ['#############', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#############'];
  const dummy = (at, more) => Object.assign({ sp: 'dummy', at, mode: 'dormant', stats: { hp: 999, acc: -99, eva: 0, pad: 0, dmin: 1, dmax: 1 } }, more || {});
  const room = (spec, opts) => Setup.room(1, Object.assign({ acc: 'T0', depth: 3, map: OPEN, you: [3, 3] }, spec || {}), opts);
  const carry = (s, tote, known) => {
    Consumables.startRun(s);
    for (const [ck, n] of tote) for (let k = 0; k < n; k++) Consumables.make(s, ck, { at: 'tote' });
    for (const ck of known || []) s.run.knownSeals.push(Consumables.sealFor(s, ck));
    return s;
  };
  const uidOf = (s, ck) => s.items.find(i => i.kind === 'consumable' && i.ck === ck && i.where.at === 'tote').uid;
  const fork = (where, more) => Object.assign({ uid: 'r.fork', kind: 'instrument', form: 'fork', tier: 1, where: where || { at: 'kit', slot: 'instrument' } }, more || {});
  const pole = (where, more) => Object.assign({ uid: 'r.pole', kind: 'instrument', form: 'pole', tier: 1, where: where || { at: 'kit', slot: 'instrument' } }, more || {});
  const curio = (uid, where) => ({ uid, kind: 'curio', where, prims: [{ id: 'acc', cls: 'S' }] });
  const shut = (x, y, glass, lock) => Cases.make({ x, y, room: null, glass, lock });

  // Codes that no M3 action can give, with why (they are left below ready true, each with a
  // follow-up in follow-ups.json).
  const UNREACHABLE = {
    not_built: 'no M3 action refuses with it: push and view, reserved in Actions.ORDER, have no handler, so step() refuses them unknown_action; only m3-backbone\'s planted handler shows it',
  };

  // Each case: build() → the state, ready (real actions in pre, played first, each must not
  // be refused); act(state) → the action refused with `code`.
  const CASES = [
    // The backbone (§4.2).
    { code: 'visit_over', build: () => room({ map: ['#######', '#....X#', '#######'], you: [5, 1], exits: [[5, 1]] }), pre: [{ a: 'leave', i: 0 }], act: () => ({ a: 'wait' }) },
    { code: 'choice_pending', build: () => carry(room(), [['card', 1]], ['card']), pre: s => [{ a: 'use', uid: uidOf(s, 'card') }], act: () => ({ a: 'wait' }) },
    { code: 'unknown_action', build: () => room(), act: () => ({ a: 'dance' }) },
    { code: 'bad_direction', build: () => room(), act: () => ({ a: 'move', dir: 9 }) },
    // A blow past a corner: the exhibit is diagonal from you, with a wall on one side between.
    { code: 'corner', build: () => room({ map: ['#######', '##....#', '#.....#', '#######'], you: [1, 2], exhibits: [dummy([2, 1])] }), act: s => ({ a: 'attack', uid: s.actors[1].uid }) },
    { code: 'blocked', build: () => room({ you: [1, 1] }), act: () => ({ a: 'move', dir: 0 }) },
    { code: 'no_target', build: () => room(), act: () => ({ a: 'attack', uid: 'nobody' }) },
    { code: 'out_of_reach', build: () => room({ exhibits: [dummy([7, 3])] }), act: s => ({ a: 'attack', uid: s.actors[1].uid }) },
    { code: 'no_use', build: () => room(), act: () => ({ a: 'use', uid: 'you.w' }) },
    // Doors (W1-WAKE-B).
    { code: 'no_door', build: () => room(), act: () => ({ a: 'close', x: 4, y: 3 }) },
    { code: 'doorway_occupied', build: () => room({ map: ['#######', "#..'..#", '#######'], you: [2, 1], exhibits: [dummy([3, 1])] }), act: () => ({ a: 'close', x: 3, y: 1 }) },
    // Sitting (W1-COMBAT).
    { code: 'no_bench', build: () => room(), act: () => ({ a: 'sit' }) },
    { code: 'seated', build: () => room({ map: ['#######', '#..b..#', '#######'], you: [3, 1] }), pre: [{ a: 'sit' }], act: () => ({ a: 'sit' }) },
    // Cases and staff doors (W1-CASES).
    { code: 'behind_glass', build: () => room({ map: ['#######', '#..v..#', '#######'], you: [2, 1], fixtures: [shut(3, 1, 1, 1)] }), act: () => ({ a: 'move', dir: 2 }) },
    { code: 'no_case', build: () => room(), act: () => ({ a: 'open', x: 4, y: 3 }) },
    { code: 'case_locked', build: () => room({ map: ['#######', '#..v..#', '#######'], you: [2, 1], fixtures: [shut(3, 1, 2, 3)] }), act: () => ({ a: 'open', x: 3, y: 1 }) },
    { code: 'glass_too_strong', build: () => room({ map: ['#######', '#..v..#', '#######'], you: [2, 1], fixtures: [shut(3, 1, 2, 2)], kit: { weapon: { form: 'light', tier: 1 } } }), act: () => ({ a: 'bash', x: 3, y: 1 }) },
    { code: 'staff_grade', build: () => room({ map: ['#######', '#..S..#', '#######'], you: [2, 1], fixtures: [{ k: 'staff', x: 3, y: 1, grade: 3 }] }), act: () => ({ a: 'move', dir: 2 }) },
    // Leaving (W1-CLOCK).
    { code: 'no_exit', build: () => room({ map: ['#######', '#....X#', '#######'], you: [5, 1], exits: [[5, 1]] }), act: () => ({ a: 'leave', i: 3 }) },
    { code: 'not_on_exit', build: () => room({ map: ['#######', '#....X#', '#######'], you: [2, 1], exits: [[5, 1]] }), act: () => ({ a: 'leave', i: 0 }) },
    // Items (W1-KIT).
    { code: 'no_item', build: () => room(), act: () => ({ a: 'take', uid: 'nothing' }) },
    { code: 'carried', build: () => room({ items: [curio('r.c', { at: 'tote' })] }), act: () => ({ a: 'take', uid: 'r.c' }) },
    { code: 'not_carried', build: () => room({ items: [curio('r.c', { at: 'floor', x: 4, y: 3 })] }), act: () => ({ a: 'drop', uid: 'r.c' }) },
    { code: 'worn', build: () => room(), act: () => ({ a: 'drop', uid: 'you.w' }) },
    { code: 'tote_full', build: () => room({ items: Array.from({ length: N.TOTE_SLOTS }, (_, k) => curio('r.t' + k, { at: 'tote' })).concat([curio('r.c', { at: 'floor', x: 4, y: 3 })]) }), act: () => ({ a: 'take', uid: 'r.c' }) },
    { code: 'not_equippable', build: () => room({ items: [{ uid: 'r.k', kind: 'kit', where: { at: 'tote' } }] }), act: () => ({ a: 'equip', uid: 'r.k' }) },
    { code: 'curio_slots_full', build: () => room({ items: [curio('r.c0', { at: 'kit', slot: 'curio0' }), curio('r.c1', { at: 'kit', slot: 'curio1' }), curio('r.c2', { at: 'tote' })] }), act: () => ({ a: 'equip', uid: 'r.c2' }) },
    { code: 'weapon_slot', build: () => room(), act: () => ({ a: 'unequip', slot: 'weapon' }) },
    { code: 'slot_empty', build: () => room(), act: () => ({ a: 'unequip', slot: 'curio0' }) },
    { code: 'bad_slot', build: () => room(), act: () => ({ a: 'unequip', slot: 'hat' }) },
    { code: 'not_equipped', build: () => room({ items: [fork({ at: 'tote' })] }), act: () => ({ a: 'use', uid: 'r.fork', x: 5, y: 3 }) },
    { code: 'no_charges', build: () => room({ items: [fork(null, { charges: 0 })] }), act: () => ({ a: 'use', uid: 'r.fork', x: 5, y: 3 }) },
    { code: 'out_of_range', build: () => room({ map: ['####################', '#..................#', '####################'], you: [1, 1], items: [fork()] }), act: () => ({ a: 'use', uid: 'r.fork', x: 1 + N.TUNING_FORK[2] + 1, y: 1 }) },
    { code: 'no_line', build: () => room({ map: ['#########', '#...#...#', '#########'], you: [1, 1], items: [fork()] }), act: () => ({ a: 'use', uid: 'r.fork', x: 6, y: 1 }) },
    { code: 'no_aim', build: () => room({ items: [fork()] }), act: () => ({ a: 'use', uid: 'r.fork' }) },
    { code: 'own_tile', build: () => room({ items: [fork()] }), act: s => ({ a: 'use', uid: 'r.fork', x: s.actors[0].x, y: s.actors[0].y }) },
    { code: 'not_a_place', build: () => room({ items: [fork()] }), act: () => ({ a: 'use', uid: 'r.fork', x: 3, y: 0 }) },
    { code: 'bad_use', build: () => room({ items: [fork()] }), act: () => ({ a: 'use', uid: 'r.fork', x: 5, y: 3, how: 'push' }) },
    { code: 'no_exhibit', build: () => room({ items: [pole()] }), act: () => ({ a: 'use', uid: 'r.pole', x: 4, y: 3, how: 'push' }) },
    { code: 'too_big', build: () => room({ items: [pole()], exhibits: [dummy([4, 3], { size: 2 })] }), act: () => ({ a: 'use', uid: 'r.pole', x: 4, y: 3, how: 'push' }) },
    { code: 'in_case', build: () => room({ map: ['#######', '#..v..#', '#######'], you: [2, 1], items: [pole()], fixtures: [shut(3, 1, 1, 1)], exhibits: [dummy([3, 1])] }), act: () => ({ a: 'use', uid: 'r.pole', x: 3, y: 1, how: 'push' }) },
    // A pack warden beside you marks its ring (its ROLE_WARDEN_SPECIAL_EVERY-th action); the
    // pole is refused at a body with a mark of its own (it would move it off what it showed).
    { code: 'marked', build: () => room({ acc: 'S9', items: [pole()], exhibits: [{ sp: 'S9.4', at: [4, 3], mode: 'hunting', stats: Roles.stats('warden', 3) }] }, { invulnerable: true }),
      pre: Array.from({ length: 6 }, () => st => st.actors[1].telegraph ? null : { a: 'wait' }),
      act: s => ({ a: 'use', uid: 'r.pole', x: s.actors[1].x, y: s.actors[1].y, how: 'push' }), ready: s => !!s.actors[1].telegraph },
    { code: 'cannot_move', build: () => room({ map: ['######', '#...##', '######'], you: [2, 1], items: [pole()], exhibits: [dummy([3, 1])] }), act: () => ({ a: 'use', uid: 'r.pole', x: 3, y: 1, how: 'push' }) },
    { code: 'nothing_to_take', build: () => room({ map: ['#######', '#..v..#', '#######'], you: [1, 1], items: [pole()], fixtures: [shut(3, 1, 1, 1)] }), act: () => ({ a: 'use', uid: 'r.pole', x: 3, y: 1, how: 'take' }) },
    { code: 'cannot_restore', build: () => carry(room({ items: [{ uid: 'r.k', kind: 'kit', where: { at: 'tote' } }] }), [['quiet', 1]]), act: s => ({ a: 'use', uid: 'r.k', on: uidOf(s, 'quiet') }) },
    // Statuses (W1-STATUS).
    { code: 'fixed', build: () => room({ youStatuses: [{ id: 'fixed', turns: 3 }] }), act: () => ({ a: 'move', dir: 2 }) },
    { code: 'rooted', build: () => room({ youStatuses: [{ id: 'rooted', turns: 3 }] }), act: () => ({ a: 'move', dir: 2 }) },
    // Consumables (W1-CONSUMABLES).
    { code: 'consumable_not_carried', build: () => carry(room(), [['fixative', 1]]), act: () => ({ a: 'throw', uid: 'nothing', x: 6, y: 3 }) },
    { code: 'use_no_target', build: () => carry(room(), [['fixative', 1]]), act: s => ({ a: 'use', uid: uidOf(s, 'fixative'), x: 4, y: 3 }) },
    { code: 'throw_not_solution', build: () => carry(room(), [['quiet', 1]]), act: s => ({ a: 'throw', uid: uidOf(s, 'quiet'), x: 6, y: 3 }) },
    { code: 'throw_far', build: () => carry(room({ map: ['####################', '#..................#', '####################'], you: [1, 1] }), [['fixative', 1]], ['fixative']), act: s => ({ a: 'throw', uid: uidOf(s, 'fixative'), x: 1 + N.THROW_RANGE + 1, y: 1 }) },
    { code: 'throw_unseen', build: () => carry(room({ map: ['#########', '#...#...#', '#########'], you: [1, 1] }), [['fixative', 1]], ['fixative']), act: s => ({ a: 'throw', uid: uidOf(s, 'fixative'), x: 6, y: 1 }) },
    { code: 'throw_unknown_near', build: () => carry(room(), [['fixative', 1]]), act: s => ({ a: 'throw', uid: uidOf(s, 'fixative'), x: 4, y: 3 }) },
    { code: 'label_none', build: () => carry(room(), []), act: () => ({ a: 'read', x: 4, y: 3 }) },
    { code: 'label_far', build: () => carry(room({ fixtures: [{ k: 'plaque', x: 9, y: 0, ck: 'quiet' }] }), []), act: () => ({ a: 'read', x: 9, y: 0 }) },
    { code: 'label_known', build: () => carry(room({ you: [3, 1], fixtures: [{ k: 'plaque', x: 3, y: 0, ck: 'quiet' }] }), [], ['quiet']), act: () => ({ a: 'read', x: 3, y: 0 }) },
    { code: 'card_all_known', build: () => carry(room(), [['card', 1]], R.order('CONSUMABLES')), act: s => ({ a: 'use', uid: uidOf(s, 'card') }) },
    { code: 'ticket_no_entrance', build: () => carry(room(), [['ticket', 1]], ['ticket']), act: s => ({ a: 'use', uid: uidOf(s, 'ticket') }) },
    { code: 'choice_none', build: () => room(), act: () => ({ a: 'choose', index: 0 }) },
    { code: 'choice_bad', build: () => carry(room(), [['card', 1]], ['card']), pre: s => [{ a: 'use', uid: uidOf(s, 'card') }], act: () => ({ a: 'choose', index: 99 }) },
  ];

  const clean = t => typeof t === 'string' && t.length > 0 && !/undefined|NaN|\[object|null/.test(t);

  test('every M3 refusal code has a joined-up case here, or is named unreachable with why; and every case is a code of the registry', () => {
    const codes = R.order('REFUSALS').filter(c => R.REFUSALS[c].built === 'M3'), cased = CASES.map(c => c.code);
    assert.equal(new Set(cased).size, cased.length, 'a code is cased twice');
    for (const c of codes) assert.ok(cased.includes(c) !== Object.prototype.hasOwnProperty.call(UNREACHABLE, c), `${c}: ${cased.includes(c) ? 'cased and named unreachable' : 'neither cased nor named unreachable'}`);
    for (const c of cased.concat(Object.keys(UNREACHABLE))) assert.ok(R.REFUSALS[c] && R.REFUSALS[c].built === 'M3', `${c} is no M3 refusal`);
    for (const c of Object.keys(UNREACHABLE)) assert.ok(R.REFUSALS[c].ready !== true, `${c} is unreachable but at ready true`);
  });

  for (const k of CASES) {
    test(`refused ${k.code}: the action is no button, step() refuses it with that code and changes nothing, and its sentence is clean`, () => {
      const s = k.build();
      const pre = typeof k.pre === 'function' ? k.pre(s) : (k.pre || []);
      for (const p of pre) {
        const a = typeof p === 'function' ? p(s) : p;
        if (a === null) break;
        const ev = Step.step(s, a);
        assert.ok(!(ev.length === 1 && ev[0].k === 'refused'), `${k.code}: getting ready, ${json(a)} was refused ${json(ev[0])}`);
      }
      if (k.ready) assert.ok(k.ready(s), `${k.code}: the state is not ready for the case`);
      const action = k.act(s);
      assert.ok(!Step.legal(s).some(a => json(a) === json(action)), `${k.code}: ${json(action)} is among the legal actions`);
      // A visit already over is played no further by the harness, so that one step is taken
      // here, with the same checks: every invariant, plain data, and a clone that agrees.
      let r;
      if (s.over) {
        const pre = C.State.clone(s), twin = C.State.clone(s), events = Step.step(s, action), check = Inv.checker(C, Inv.select(C, 'all'));
        Step.step(twin, action);
        r = { events, violations: check(pre, action, events, s).concat(C.State.plainData(s) ? [{ text: 'not plain data' }] : [], C.State.hash(twin) !== C.State.hash(s) ? [{ text: 'a clone differs' }] : []) };
      } else r = H.play(C, s, [action], { clone: true });
      assert.equal(json(r.violations.map(v => v.text)), '[]', k.code);
      assert.equal(json(r.events.map(e => [e.k, e.reason])), json([['refused', k.code]]), `${k.code}: ${json(action)}`);
      const said = Text.event(r.events[0], Labels.nameOf(s)), direct = Text.refusal(k.code, r.events[0].data || {});
      assert.ok(clean(said) && clean(direct), `${k.code}: "${said}" / "${direct}"`);
    });
  }
};
