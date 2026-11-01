// ACCESSION — the refusals of viewing and of the dust sheet, joined up (BUILD.md §4.2, §8.7; M4
// plan A4): no_centrepiece, already_earned, not_at_lectern, not_asleep and sheeted, each made to
// happen by real actions in the real core at every depth 1–7: a hall with a test-only
// Centrepiece core and its lectern (as behaviour/viewing.test.js makes one), or the test room,
// which has no Centrepiece. For each: the action is not among Step.legal's (the buttons),
// step() answers with exactly one refused event with that code, every invariant holds
// (system.inv.js: a refused step has no other event and changes nothing, not even a stream),
// the run is clone-checked, and the refusal's sentence is a clean one that says why.
'use strict';
const H = require('./_harness.js');

module.exports = ({ test, assert, loadCore }) => {
  const json = x => JSON.stringify(x);
  const V = { a: 'view' }, W = d => ({ a: 'move', dir: d });
  // The hall of behaviour/viewing.test.js: the footprint 2–3 × 2–3, the lectern (6,1), its
  // reading tile (6,2); you start at (7,2), a step east of it.
  const MAP = ['##############', '#.....l.o....#', '#.......o....#', '#.......o....#', '#............#', '###+##########', '#............#', '#............#', '##############'];
  const ROOMS = [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 12, y1: 4 }, { key: 's1', role: 'section', x0: 1, y0: 6, x1: 12, y1: 7 }];
  function core(rec) {
    const X = loadCore(), R = X.Registry;
    R.define('ARCHETYPES', 'test_cp', { built: 'M4', ready: 'unit', clause: 'Walks a tile at a time and strikes from beside you for {dmg}.', params: { dmg: 'role:DMG' }, covers: ['attacked', 'missed'] });
    X.Archetypes.add('test_cp', X.Centrepiece.hooks('test_cp', {}));
    X.Packs.add({ acc: 'T9', species: [], modules: [], items: [{ id: 'T9.11', kind: 'weapon', form: 'light', prims: [{ id: 'dmg', cls: 'S' }], name: 'The Test Pen',
      tomb: { maker: 'Made for the tests', date: 'Now', medium: 'Steel', dims: 'L. 14 cm', credit: 'The tests' }, paragraph: 'It exists so that something can drop.' }],
    centrepiece: Object.assign({ id: 'T9.12', name: 'The Test Centrepiece', archetype: 'test_cp', role: 'centrepiece', form: 'fight', size: 2, specials: ['cp_burst'], signature: 'T9.11',
      tomb: { maker: 'Made for the tests', date: 'Now', medium: 'Plaster', dims: 'H. 2 m', credit: 'The tests' }, paragraph: 'It stands for every Centrepiece.' }, rec || {}) });
    return X;
  }
  // o: you, pips (the Centrepiece's), scale (its health), rec (its record's fields).
  function hall(depth, o) {
    const X = core(o.rec), s = H.room(X, 1, { acc: 'T9', depth, map: MAP, you: o.you || [7, 2], rooms: ROOMS, clock: { B: 300, G: 60 }, entrance: [12, 6] }, {});
    s.actors[0].hp = s.actors[0].maxHp = 999;
    X.Centrepiece.place(s, { cpl: [2, 2] }, X.Packs.get('T9'));
    s.dept.lectern = [6, 1]; s.dept.viewTile = [6, 2];
    X.Viewing.place(s);
    for (const a of X.Centrepiece.pieces(s)) { if (o.pips) a.pips = o.pips; if (o.scale) a.hp = a.maxHp = o.scale; }
    return { X, s };
  }
  // Strike the Centrepiece's first standing piece, from beside it, until none stands.
  const fight = X => (s, i) => { if (i > 300) return null; const p = X.Centrepiece.pieces(s).find(a => !a.gone); return p ? { a: 'attack', uid: p.uid } : null; };
  const answer = s => (s.ui.pendingChoice ? { a: 'choose', index: 0 } : null);

  // Each case: make(depth) → {X, s}, with real actions that bring it about (pre: a list, or a
  // function played until it gives null; none may be refused but those listed in may), then
  // act, the action refused with `code`.
  const CASES = [
    // The test room: no Centrepiece was placed.
    { code: 'no_centrepiece', what: 'a view in the test room', make: () => { const X = loadCore(); return { X, s: X.TestRoom.create(1) }; }, pre: [{ a: 'wait' }], act: V },
    // A treasure's guardian killed: none of it stands, and it earned nothing.
    { code: 'no_centrepiece', what: 'a view once a treasure\'s guardian is dead', make: d => hall(d, { you: [4, 2], scale: 3, rec: { form: 'treasure' } }), pre: X => fight(X), then: [W(2), W(2)], act: V },
    // The Certificate earned by defeating it, then a view from the reading tile.
    { code: 'already_earned', what: 'a view after the Certificate, earned by its defeat', make: d => hall(d, { you: [4, 2], scale: 3 }), pre: X => fight(X), then: [W(2), W(2)], act: V },
    // Off the reading tile: a step short of it, and on the lectern's other side.
    { code: 'not_at_lectern', what: 'a view a step from the reading tile', make: d => hall(d, {}), pre: [{ a: 'wait' }], act: V },
    { code: 'not_at_lectern', what: 'a view beside the lectern', make: d => hall(d, { you: [5, 1] }), pre: [{ a: 'wait' }], act: V },
    // Awake: the step onto the reading tile gives it its third pip.
    { code: 'not_asleep', what: 'a view while it is awake', make: d => hall(d, { pips: 2 }), pre: [W(6)], act: V },
    // Under its sheet: a view, a blow at it, and a step into it from beside it.
    { code: 'sheeted', what: 'a view under the sheet', make: d => hall(d, {}), pre: [W(6), V, V, V, V], act: V },
    { code: 'sheeted', what: 'a blow at it under the sheet', make: d => hall(d, {}), pre: [W(6), V, V, V, V], then: [W(6), W(6)], act: s => ({ a: 'attack', uid: s.dept.cp.uids[0] }) },
    { code: 'sheeted', what: 'a step into the sheet', make: d => hall(d, {}), pre: [W(6), V, V, V, V], then: [W(6), W(6)], act: W(6) },
  ];

  test('every refusal of viewing and of the dust sheet is made to happen by real actions at depths 1–7: not offered, one refused event, nothing changed, clone-stable, a clean sentence', () => {
    const problems = [];
    for (const c of CASES) for (const depth of H.DEPTHS) {
      const tag = `${c.code} (${c.what}) at depth ${depth}`, { X, s } = c.make(depth);
      const steps = [];
      let r = H.play(X, s, typeof c.pre === 'function' ? c.pre(X) : c.pre, { inv: 'all', clone: true });
      steps.push(...r.steps); problems.push(...r.violations.map(v => `${tag}, before: ${v.text}`));
      const ans = answer(s);
      r = H.play(X, s, (ans ? [ans] : []).concat(c.then || []), { inv: 'all', clone: true });
      steps.push(...r.steps); problems.push(...r.violations.map(v => `${tag}, before: ${v.text}`));
      for (const st of steps) if (st.events.some(e => e.k === 'refused')) problems.push(`${tag}: a step before it was refused: ${json(st.action)} ${json(st.events)}`);
      if (s.over) { problems.push(`${tag}: the visit ended`); continue; }
      const action = typeof c.act === 'function' ? c.act(s) : c.act;
      if (X.Step.legal(s).some(a => json(a) === json(action))) problems.push(`${tag}: offered among the legal actions`);
      const before = X.State.hash(s), rng = json(s.rng);
      r = H.play(X, s, [action], { inv: 'all', clone: true });
      const ev = r.steps[0].events;
      if (json(ev.map(e => [e.k, e.reason])) !== json([['refused', c.code]])) problems.push(`${tag}: answered ${json(ev)}`);
      if (X.State.hash(s) !== before || json(s.rng) !== rng) problems.push(`${tag}: the state changed`);
      problems.push(...r.violations.map(v => `${tag}: ${v.text}`));
      const said = X.Text.refusal(c.code);
      if (typeof said !== 'string' || !/^[A-Z].*\.$/.test(said) || /undefined|NaN|\[object|null/.test(said)) problems.push(`${tag}: its sentence ${json(said)}`);
    }
    assert.deepEqual(problems, []);
  });

  test('each refusal says why in plain words, and the order of the reasons: under the sheet before the Certificate, the Certificate before the reading tile, the reading tile before its waking', () => {
    const X = loadCore(), T = X.Text;
    assert.equal(T.refusal('no_centrepiece'), 'There is no Centrepiece here to view.');
    assert.equal(T.refusal('already_earned'), 'You have this department’s Certificate already, and a visit gives only one: viewing cannot earn another.');
    assert.equal(T.refusal('not_at_lectern'), 'You can view the Centrepiece only from the reading tile beside its lectern.');
    assert.equal(T.refusal('not_asleep'), 'You can view the Centrepiece only while it sleeps, every piece of it, and it is not asleep now.');
    assert.equal(T.refusal('sheeted'), 'The Centrepiece is under its dust sheet for the night: you cannot view it, strike it, step onto it or aim an instrument at it.');
    // Awake and off the reading tile: the tile first, since walking there is the first thing to do.
    let { X: Y, s } = hall(3, { pips: 2, you: [8, 4] });
    H.play(Y, s, [W(6), W(7)], { inv: false });
    assert.notEqual(Y.Centrepiece.pieces(s)[0].mode, 'dormant');
    assert.equal(Y.Viewing.refusal(s), 'not_at_lectern');
    ({ X: Y, s } = hall(3, {}));
    H.play(Y, s, [W(6), V, V, V, V], { inv: false });
    assert.equal(Y.Viewing.refusal(s), 'sheeted');
    s.dept.cp.sheet = null;
    assert.equal(Y.Viewing.refusal(s), 'already_earned');
  });
};
