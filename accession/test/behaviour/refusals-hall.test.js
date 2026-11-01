// ACCESSION — the hall's refusal, joined up (BUILD.md §4.2, §8.4; M4 plan A4): `sealed`, a step
// into a shutter or a take of an item lying under one, made to happen by real actions in the
// real core at every depth 1–7: a room with a Centrepiece's hall (the harness's rooms and cp),
// the hall sealed by real actions (a piece hunting you, you inside), then the action refused.
// For each: the action is not among Step.legal's (the buttons), step() answers with exactly
// one refused event with that code, every invariant holds (system.inv.js: a refused step has no
// other event and changes nothing, not even a stream), the run is clone-checked, and the
// refusal's sentence is a clean one; the same action with the hall open is not refused so.
'use strict';
const H = require('./_harness.js');
const Inv = require('../../tools/invariants.js');

module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Step, Text, State, Clock } = C;
  const json = x => JSON.stringify(x);
  const MAP = ['#############', '#.......#...#', '#.......,...#', '#.......#...#', '#.......S...#', '#.......#...#', '#############'];
  const ROOMS = [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 7, y1: 5 }, { key: 's1', role: 'section', x0: 9, y0: 1, x1: 11, y1: 5 }];
  const BODY = { hp: 60, acc: -99, eva: 0, pad: 0, dmin: 1, dmax: 1 };
  const ITEM = { uid: 'r.curio', kind: 'curio', where: { at: 'tote' }, prims: [{ id: 'acc', cls: 'S' }] };
  function hall(depth, you) {
    const s = H.room(C, 1, { acc: 'T0', depth, map: MAP, you, rooms: ROOMS, cp: { uids: [`T0.${depth}.room.1`], room: 'centre' }, clock: { B: 300, G: 60 }, items: [ITEM],
      exhibits: [{ sp: 'dummy', at: [1, 4], size: 2, role: 'centrepiece', mode: 'hunting', stats: BODY, statuses: [{ id: 'fixed', turns: 9999 }] }] }, {});
    s.actors[0].hp = s.actors[0].maxHp = 999;
    return s;
  }

  // Each case: pre, real actions that seal the hall (each must not be refused); act(state), the
  // action then refused with `code`; open(state), the same action's answer with the hall open.
  const CASES = [
    // A step into the archway's shutter, from beside it.
    { code: 'sealed', what: 'a step into a shutter', you: [7, 3], pre: [{ a: 'move', dir: 0 }], act: () => ({ a: 'move', dir: 2 }) },
    // A step into the staff door's shutter, diagonally.
    { code: 'sealed', what: 'a step into a shuttered staff door', you: [7, 3], pre: [{ a: 'wait' }], act: () => ({ a: 'move', dir: 3 }) },
    // A take of an item dropped in the archway before you stepped in.
    { code: 'sealed', what: 'a take from under a shutter', you: [8, 2], pre: [{ a: 'drop', uid: ITEM.uid }, { a: 'move', dir: 6 }], act: () => ({ a: 'take', uid: ITEM.uid }) },
  ];

  test('every refusal the hall gives is made to happen by real actions at depths 1–7: not offered, one refused event, nothing changed, clone-stable, a clean sentence', () => {
    const problems = [];
    for (const c of CASES) for (const depth of H.DEPTHS) {
      const tag = `${c.code} (${c.what}) at depth ${depth}`;
      const s = hall(depth, c.you);
      const pre = H.play(C, s, c.pre, { inv: 'all', clone: true });
      for (const st of pre.steps) if (st.events.some(e => e.k === 'refused')) problems.push(`${tag}: a step before it was refused: ${json(st.action)}`);
      problems.push(...pre.violations.map(v => `${tag}, before: ${v.text}`));
      if (!Clock.sealed(s)) { problems.push(`${tag}: the hall did not seal`); continue; }
      const action = c.act(s);
      if (Step.legal(s).some(a => json(a) === json(action))) problems.push(`${tag}: offered among the legal actions`);
      const before = State.hash(s), r = H.play(C, s, [action], { inv: 'all', clone: true });
      const ev = r.steps[0].events;
      if (json(ev.map(e => [e.k, e.reason])) !== json([['refused', c.code]])) problems.push(`${tag}: answered ${json(ev)}`);
      if (State.hash(s) !== before) problems.push(`${tag}: the state changed`);
      problems.push(...r.violations.map(v => `${tag}: ${v.text}`));
      const said = Text.refusal(c.code);
      if (typeof said !== 'string' || !/^[A-Z].*\.$/.test(said) || /undefined|NaN|\[object|null/.test(said)) problems.push(`${tag}: its sentence ${json(said)}`);
      // With the hall open again, the same action is not refused as sealed.
      C.Hall.onDefeat(s, []);
      const open = Step.step(State.clone(s), action);
      if (open.some(e => e.k === 'refused' && e.reason === c.code)) problems.push(`${tag}: still refused with the hall open`);
    }
    assert.deepEqual(problems, []);
    assert.ok(Inv.load(C).some(i => i.id === 'system_refused' || i.file === 'system'), 'system.inv.js is loaded');
  });
};
