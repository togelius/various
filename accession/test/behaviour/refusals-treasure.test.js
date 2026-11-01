// ACCESSION — the dust sheet closing a treasure's case, joined up (BUILD.md §4.2, §5.5, §8.7; M4
// plan A4, D3.6, decided without play; revisit once M4 is playable; rules/treasure.js): once a
// view has put the Composite under its dust sheet (four views from the lectern's reading tile),
// the Lamp's case is closed with it, so no view earns a Certificate and then the treasure too:
// taking the Lamp from it (dissolved before the views, as Solvent leaves a case, planted: no
// touch, so it slept on), opening it, bashing it, aiming the Window Pole at it, throwing Solvent
// onto it or a Fixative beside it are each refused `sheeted`, made to happen by real actions at
// every depth 1–7 in completing_guardian-phases.test.js's hall with a lectern. For each: the
// action is not among Step.legal's (the buttons), step() answers with exactly one refused event
// with that code, every invariant holds (system.inv.js: a refused step has no other event and
// changes nothing, not even a stream), the run is clone-checked, and the refusal's sentence is a
// clean one that says why. A throw two tiles from it, whose square does not hold it, is not
// refused; before the sheet, none of them is refused `sheeted`.
'use strict';
const H = require('./_harness.js');

module.exports = ({ test, assert, loadCore }) => {
  const json = x => JSON.stringify(x);
  const C = loadCore(), { N } = C;
  const V = { a: 'view' }, W = d => ({ a: 'move', dir: d });
  // The hall (x 1–11, y 1–7), the Lamp's case at (1,7), the Composite on 5–6 × 3–4, the lectern
  // (10,3) and its reading tile (9,3), 3 walking tiles from it; the archway (12,2) to a gallery.
  const MAP = ['#################', '#...........#...#', '#...........,...#', '#.........l.#...#', '#...........#...#', '#...........#...#',
    '#...........#...#', '#v..........#...#', '#################'];
  const ROOMS = [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 11, y1: 7 }, { key: 's1', role: 'section', x0: 13, y0: 1, x1: 15, y1: 7 }];
  const CASE = [1, 7];
  const POLE = { uid: 'pole', kind: 'instrument', form: 'pole', tier: 1, where: { at: 'kit', slot: 'instrument' } };
  // You on the reading tile, the Composite asleep, the Lamp in its case (dissolved first, as
  // Solvent leaves it, when `dissolved`), a known Solvent and Fixative and the Window Pole on you.
  function hall(depth, dissolved) {
    const s = H.room(C, 1, { acc: 'S9', depth, map: MAP, you: [9, 3], rooms: ROOMS, clock: { B: 300, G: 60 }, entrance: [15, 4], items: [POLE],
      fixtures: [C.Cases.make({ x: CASE[0], y: CASE[1], glass: 3, lock: 1 })] }, {});
    s.actors[0].hp = s.actors[0].maxHp = 999;
    s.dept.walked = [];
    C.Centrepiece.place(s, { cpl: [5, 3] }, C.Packs.get('S9'));
    s.dept.lectern = [10, 3]; s.dept.viewTile = [9, 3];
    C.Viewing.place(s);
    C.Kit.make(s, C.Packs.get('S9').items.find(i => i.id === 'S9.11'), { at: 'case', x: CASE[0], y: CASE[1] });
    for (const ck of ['solvent', 'fixative']) { C.Consumables.make(s, ck, { at: 'tote' }); s.run.knownSeals.push(C.Consumables.sealFor(s, ck)); }
    if (dissolved) C.Cases.dissolve(s, C.Cases.at(s, CASE[0], CASE[1]), { k: 'solvent', by: 'you' }, []);
    return s;
  }
  const answer = s => (s.ui.pendingChoice ? [{ a: 'choose', index: 0 }] : []);
  const lamp = s => s.items.find(i => i.ref === 'S9.11').uid;
  const solution = (s, ck) => s.items.find(i => i.ck === ck && i.where.at === 'tote').uid;
  // From the reading tile to beside the case (2,7), round the sheet over the footprint.
  const TO_CASE = [W(5), W(5), W(5), W(6), W(6), W(6), W(5)];
  const CASES = [
    { what: 'a take of the Lamp from its dissolved case', dissolved: true, act: s => ({ a: 'take', uid: lamp(s) }) },
    { what: 'opening its case', act: () => ({ a: 'open', x: CASE[0], y: CASE[1] }) },
    { what: 'bashing its case', act: () => ({ a: 'bash', x: CASE[0], y: CASE[1] }) },
    { what: 'the Window Pole aimed at its case, to take from it', act: () => ({ a: 'use', uid: 'pole', x: CASE[0], y: CASE[1], how: 'take' }) },
    { what: 'Solvent thrown onto its case', act: s => ({ a: 'throw', uid: solution(s, 'solvent'), x: CASE[0], y: CASE[1] }) },
    { what: 'a Fixative thrown beside its case', act: s => ({ a: 'throw', uid: solution(s, 'fixative'), x: CASE[0] + 1, y: CASE[1] - 1 }) },
  ];

  test('under the dust sheet, the Lamp\'s case is closed too: a take from it, opening it, bashing it, the Window Pole aimed at it, Solvent thrown onto it and a Fixative beside it are each refused sheeted, by real actions at depths 1–7: not offered, one refused event, nothing changed, clone-stable, a clean sentence', () => {
    const problems = [];
    for (const c of CASES) for (const depth of H.DEPTHS) {
      const tag = `${c.what} at depth ${depth}`, s = hall(depth, c.dissolved);
      let r = H.play(C, s, [V, V, V, V], { inv: 'all', clone: true });
      problems.push(...r.violations.map(v => `${tag}, viewing: ${v.text}`));
      if (!C.Viewing.sheeted(s) || !s.dept.cert) { problems.push(`${tag}: not under its sheet ${json(r.events.map(e => e.k))}`); continue; }
      r = H.play(C, s, answer(s).concat(TO_CASE), { inv: 'all', clone: true });
      problems.push(...r.violations.map(v => `${tag}, walking: ${v.text}`));
      for (const st of r.steps) if (st.events.some(e => e.k === 'refused')) problems.push(`${tag}: a step before it was refused: ${json(st.action)} ${json(st.events)}`);
      if (json([s.actors[0].x, s.actors[0].y]) !== json([2, 7])) { problems.push(`${tag}: you are at ${s.actors[0].x},${s.actors[0].y}`); continue; }
      const action = c.act(s);
      if (C.Step.legal(s).some(a => json(a) === json(action))) problems.push(`${tag}: offered among the legal actions`);
      const before = C.State.hash(s), rng = json(s.rng);
      r = H.play(C, s, [action], { inv: 'all', clone: true });
      const ev = r.steps[0].events;
      if (json(ev.map(e => [e.k, e.reason])) !== json([['refused', 'sheeted']])) problems.push(`${tag}: answered ${json(ev)}`);
      if (C.State.hash(s) !== before || json(s.rng) !== rng) problems.push(`${tag}: the state changed`);
      problems.push(...r.violations.map(v => `${tag}: ${v.text}`));
    }
    const said = C.Text.refusal('sheeted');
    assert.equal(said, 'The Centrepiece is under its dust sheet for the night: you cannot view it, strike it, step onto it or aim an instrument at it, nor open, bash, take from or aim at the case of a treasure it guards, or throw a Solution onto or beside that case.');
    assert.deepEqual(problems, []);
  });

  test('the sheet closes only its case, and only once it lies: a throw two tiles from the case (its square not holding it) is not refused; before the views none of those actions is refused sheeted; with no treasure (a fight), the refuser leaves cases alone', () => {
    for (const depth of [1, 4, 7]) {
      const s = hall(depth);
      for (const c of CASES.slice(1)) assert.notEqual(C.Actions.refusal(s, c.act(s)), 'sheeted', `before the views: ${c.what}`);
      H.play(C, s, [V, V, V, V], { inv: 'all' });
      H.play(C, s, answer(s).concat(TO_CASE), { inv: 'all' });
      const far = { a: 'throw', uid: solution(s, 'fixative'), x: CASE[0] + 2, y: CASE[1] - 2 };
      assert.equal(C.Actions.refusal(s, far), null, `d${depth}: two tiles off`);
      const r = H.play(C, s, [far], { inv: 'all', clone: true });
      assert.deepEqual(r.violations, []);
      assert.ok(r.events.some(e => e.k === 'used'), json(r.events));
      // A fight's sheet (planted: the form) leaves the case alone.
      s.dept.cp.form = 'fight';
      assert.equal(C.Actions.refusal(s, { a: 'bash', x: CASE[0], y: CASE[1] }), null);
    }
    assert.equal(C.Treasure.caseOf(C.TestRoom.create(1)), null);
  });
};
