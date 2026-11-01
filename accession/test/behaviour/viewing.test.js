// ACCESSION — viewing the Centrepiece and its dust sheet (BUILD.md §4.1, §4.2, §8.2, §8.4, §8.7;
// M4 plan A4, A8, A11's lectern row, D4.8, D4.9, D4.18, Q9; PG-VIEW), joined up: real actions in
// a hall with a test-only Centrepiece core (as ARCH-CP-CORE's tests make one: a pack T9, made in
// each test's own core, never in the game, whose archetype test_cp has the core's hooks), every
// invariant checked after every step (viewing.inv.js among them), the main runs clone-checked.
// No department of the game places a Centrepiece until its own package marks its core ready, so
// these tests are how viewing is played before then. The figures expected are worked out here
// from BUILD's sentences:
//   - four views in a row on the reading tile while it sleeps earn the Certificate before the
//     world acts, and its dust sheet closes it, which is no defeat; each view is told with the
//     count still to come; the steps that bring you within its ring add pips, the views none;
//   - any other action that takes time starts the count again, an action that takes none does
//     not, and a pip that wakes it (your ring's with a lit Lamp, a noise's) interrupts it;
//   - a sealed hall opens at the boundary after the sheet (why sheet);
//   - nothing under the sheet can be viewed, struck, stepped onto or aimed at, and a bolt passes
//     over it;
//   - the lectern ('lectern'): placed with the Centrepiece, read for nothing, its words the
//     gateway label, the rule (FIXTURES 'lectern') and what your ring does from its reading tile
//     ('lectern_ring_reach', 'lectern_ring_lamp', 'lectern_ring_short'), true whatever you
//     carry; the sheet's words (FIXTURES 'sheet').
'use strict';
const H = require('./_harness.js');
const Inv = require('../../tools/invariants.js');

module.exports = ({ test, assert, loadCore }) => {
  const json = JSON.stringify;
  const DEPTHS = H.DEPTHS;
  const V = { a: 'view' }, WAIT = { a: 'wait' };
  const W = d => ({ a: 'move', dir: d });
  // The hall (x 1–12, y 1–4) and a gallery south of it (y 6–7), joined by a door (3,5). The
  // Centrepiece's footprint is 2–3 × 2–3; the lectern stands at (6,1) against the north wall,
  // its reading tile (6,2) 3 walking tiles from the footprint, in its sight; a screen of columns
  // (8,1–3) hides the tiles east of it (9–12 × 1–3) from it. You start at (7,2), a step east of
  // the reading tile, 4 walking tiles from it, outside your moving ring.
  const MAP = ['##############', '#.....l.o....#', '#.......o....#', '#.......o....#', '#............#', '###+##########', '#............#', '#............#', '##############'];
  const ROOMS = [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 12, y1: 4 }, { key: 's1', role: 'section', x0: 1, y0: 6, x1: 12, y1: 7 }];
  const AT = [2, 2], LECTERN = [6, 1], READ = [6, 2], START = [7, 2];
  const FOOT = [[2, 2], [3, 2], [2, 3], [3, 3]];
  const SIG = { id: 'T9.11', kind: 'weapon', form: 'light', prims: [{ id: 'dmg', cls: 'S' }], name: 'The Test Pen',
    tomb: { maker: 'Made for the tests', date: 'Now', medium: 'Steel', dims: 'L. 14 cm', credit: 'The tests' }, paragraph: 'It exists so that something can drop.' };
  const GATEWAY = 'The Test Centrepiece stands at the heart of the hall, as every Centrepiece does.';
  const DUMMY = { hp: 99, acc: -99, eva: -99, pad: 0, dmin: 1, dmax: 1 };
  const LAMP = { uid: 'lamp', kind: 'curio', where: { at: 'kit', slot: 'curio0' }, prims: [{ id: 'observing', cls: 'M' }] };

  // The test-only core, in a fresh core X (o.rec overrides the record's fields: undefined drops
  // one; o.still: its archetype never steps, as the Great Board's).
  function core(o) {
    o = o || {};
    const X = loadCore(o.numbers ? null : undefined, o.numbers ? { numbers: o.numbers } : undefined), R = X.Registry;
    R.define('ARCHETYPES', 'test_cp', { built: 'M4', ready: 'unit', clause: 'Walks a tile at a time and strikes from beside you for {dmg}.', params: { dmg: 'role:DMG' }, covers: ['attacked', 'missed'] });
    X.Archetypes.add('test_cp', X.Centrepiece.hooks('test_cp', o.still ? { mayStep: () => false } : {}));
    const rec = Object.assign({ id: 'T9.12', name: 'The Test Centrepiece', archetype: 'test_cp', role: 'centrepiece', form: 'fight', size: 2, specials: ['cp_burst'],
      signature: 'T9.11', gateway: GATEWAY, tomb: { maker: 'Made for the tests', date: 'Now', medium: 'Plaster', dims: 'H. 2 m', credit: 'The tests' }, paragraph: 'It stands for every Centrepiece.' }, o.rec || {});
    for (const k of Object.keys(rec)) if (rec[k] === undefined) delete rec[k];
    X.Packs.add({ acc: 'T9', species: [], modules: [], items: [SIG], centrepiece: rec });
    return { X, rec, pack: X.Packs.get('T9') };
  }
  const ENSEMBLE = { specials: undefined, pieces: [{ at: [0, 0], specials: ['cp_burst'] }, { at: [1, 0] }, { at: [0, 1] }, { at: [1, 1] }] };
  // A room with the hall, the test core placed on its footprint (Centrepiece.place) and its
  // lectern (dept.lectern, dept.viewTile, as a department has them; Viewing.place). o: you
  // (START), map, more exhibits, items, pips (the Centrepiece's to start with).
  function room(K, depth, o) {
    o = o || {};
    const X = K.X, s = H.room(X, o.seed || 1, { acc: 'T9', depth, map: o.map || MAP, you: o.you || START, exhibits: o.more || [], rooms: ROOMS,
      clock: { B: 300, G: 60 }, entrance: [12, 6], items: o.items || [] }, o.options || {});
    X.Centrepiece.place(s, { cpl: AT }, K.pack);
    s.dept.lectern = LECTERN.slice(); s.dept.viewTile = READ.slice();
    X.Viewing.place(s);
    if (o.pips) for (const a of X.Centrepiece.pieces(s)) a.pips = o.pips;
    return s;
  }
  const bad = (r, tag) => r.violations.map(v => `${tag}: ${v.id}: ${v.text}`);
  const names = (X, s) => X.Labels.nameOf(s);
  const say = (X, s, e) => X.Text.event(e, names(X, s));
  const views = r => r.events.filter(e => e.k === 'viewed').map(e => e.n);
  const refusals = r => r.events.filter(e => e.k === 'refused').map(e => e.reason);
  // The pips the Centrepiece gained in a step's events.
  const gained = (X, s, ev) => ev.filter(e => e.k === 'pip' && e.delta > 0 && s.dept.cp.uids.includes(e.who));
  // Answer the perk offer a Certificate makes, if one waits.
  const answer = s => (s.ui.pendingChoice ? [{ a: 'choose', index: 0 }] : []);

  // ---- Four views in a row, and the dust sheet ----

  test('four views in a row from the reading tile while it sleeps earn the Certificate before the world acts, and a dust sheet closes it: its pieces gone with no death, no drop and no defeat, its footprint low furniture with a sheet fixture a tile; each view is told with the count still to come; the arrival\'s ring adds 1 pip and the views none; a fight, an ensemble and a treasure, at depths 1–7, clone-checked', () => {
    const problems = [];
    for (const [form, recOf] of [['fight', {}], ['ensemble', ENSEMBLE], ['treasure', { form: 'treasure' }]]) for (const depth of DEPTHS) {
      const tag = `${form} d${depth}`, K = core({ rec: recOf }), X = K.X, s = room(K, depth), uids = s.dept.cp.uids.slice();
      const hp = s.actors[0].hp, max = s.actors[0].maxHp, grade = s.run.grade;
      const r = H.play(X, s, [W(6), V, V, V, V], { inv: 'all', clone: true });
      problems.push(...bad(r, tag));
      if (json(views(r)) !== '[1,2,3,4]' || refusals(r).length) { problems.push(`${tag}: views ${json(views(r))}, refused ${json(refusals(r))}`); continue; }
      // The arrival: one pip, from your moving ring (3), to each piece 3 walking tiles away (the
      // body; an ensemble's two nearer pieces), none to a piece farther off; the views, none.
      const arrival = gained(X, s, r.steps[0].events), near = form === 'ensemble' ? [uids[1], uids[3]] : [uids[0]];
      if (json(arrival.map(e => [e.who, e.delta, e.cause.k, e.cause.r, e.cause.dist])) !== json(near.map(u => [u, 1, 'ring', X.N.RING_MOVING, X.N.VIEW_DISTANCE]))) problems.push(`${tag}: the arrival gave ${json(arrival)}`);
      for (const st of r.steps.slice(1)) if (gained(X, s, st.events).length) problems.push(`${tag}: a view added a pip: ${json(gained(X, s, st.events))}`);
      // Each view told, with the count still to come.
      for (let n = 1; n <= 3; n++) {
        const e = r.steps[n].events.find(x => x.k === 'viewed'), left = 4 - n;
        const want = `You viewed the Test Centrepiece: ${n} of 4 turns. ${left} more ${left === 1 ? 'turn' : 'turns'} of viewing in a row while it sleeps ${left === 1 ? 'earns' : 'earn'} the Certificate.${n === 1 ? ' Any other action that takes time starts the count again, and so does its waking.' : ''}`;
        if (say(X, s, e) !== want) problems.push(`${tag}: view ${n} reads ${json(say(X, s, e))}`);
        if (!X.Text.log(r.steps[n].events, names(X, s)).includes(want)) problems.push(`${tag}: view ${n} is not in the log`);
        if (e.of !== uids[0] || e.who !== 'you' || e.cause.k !== 'view') problems.push(`${tag}: view ${n} is ${json(e)}`);
      }
      // The last: told, then the Certificate at once, before any event of the world's.
      const last = r.steps[4].events, done = last.find(x => x.k === 'viewed'), at = last.indexOf(done);
      if (say(X, s, done) !== 'You viewed the Test Centrepiece: 4 of 4 turns. The view is complete: a dust sheet now covers it for the night, and it will neither wake nor fight.') problems.push(`${tag}: ${say(X, s, done)}`);
      if (json(last.slice(at, at + 4).map(e => e.k + '.' + e.cause.k)) !== json(['viewed.view', 'certificate.view', 'grade.certificate', 'healed.certificate'])) problems.push(`${tag}: the last view's events ${json(last.map(e => e.k))}`);
      if (json(X.Progress.cert(s)) !== json({ how: 'view', turn: r.steps[4].events[0].turn }) || s.run.certificates.length !== 1 || s.run.grade !== grade + 1) problems.push(`${tag}: the Certificate ${json(X.Progress.cert(s))}`);
      if (s.actors[0].maxHp !== max + X.N.HP_PER_GRADE || s.actors[0].hp < Math.min(hp + X.N.CERT_HEAL, max + X.N.HP_PER_GRADE) - 0) problems.push(`${tag}: your health ${s.actors[0].hp}/${s.actors[0].maxHp}`);
      if (!s.ui.pendingChoice || s.ui.pendingChoice.k !== 'perk') problems.push(`${tag}: no perk offer waits`);
      // The sheet: every piece gone, none died; nothing dropped, no defeat; the footprint f.
      if (!uids.every(u => X.Actors.byUid(s, u).gone) || r.events.some(e => e.k === 'died' || e.k === 'dropped' || (e.k === 'certificate' && e.cause.k === 'defeat'))) problems.push(`${tag}: the sheet killed or dropped`);
      if (json(X.Viewing.sheeted(s)) !== json({ turn: done.turn, uids })) problems.push(`${tag}: the sheet is ${json(X.Viewing.sheeted(s))}`);
      const sheets = s.dept.fixtures.filter(f => f.k === 'sheet');
      const want = FOOT.map(([x, y]) => ({ k: 'sheet', x, y, of: form === 'ensemble' ? uids[FOOT.findIndex(t => t[0] === x && t[1] === y)] : uids[0] }));
      if (json(sheets) !== json(want) || !FOOT.every(([x, y]) => s.dept.tiles[y][x] === 'f')) problems.push(`${tag}: the sheet lies ${json(sheets)} over ${json(FOOT.map(([x, y]) => s.dept.tiles[y][x]))}`);
      if (X.Centrepiece.health(s).hp !== 0 || X.Viewing.legal(s).length || X.Step.legal(s).some(a => a.a === 'view')) problems.push(`${tag}: it can still be viewed`);
      // Nothing more comes of it: the hall never seals, and no view, phase or Certificate follows.
      const more = H.play(X, s, answer(s).concat([W(6), W(6), WAIT, WAIT]), { inv: 'all', clone: true });
      problems.push(...bad(more, `${tag} after`));
      if (more.events.some(e => ['viewed', 'certificate', 'phase', 'stage'].includes(e.k)) || s.dept.cp.sealed) problems.push(`${tag}: after the sheet ${json(more.events.map(e => e.k))}`);
    }
    assert.deepEqual(problems, []);
  });

  test('the count is VIEW_TURNS\'s: at 2, the second view completes the row; at 1, the first, and its sentence says "1 of 1 turn"', () => {
    for (const turns of [1, 2]) {
      const K = core({ numbers: { VIEW_TURNS: turns } }), X = K.X, s = room(K, 3);
      const r = H.play(X, s, [W(6)].concat(Array.from({ length: turns }, () => V)), { inv: 'all', clone: true });
      assert.deepEqual(bad(r, `at ${turns}`), []);
      assert.equal(json(views(r)), json(Array.from({ length: turns }, (_, i) => i + 1)));
      assert.ok(X.Viewing.sheeted(s) && X.Progress.cert(s), `at ${turns}: no sheet or Certificate`);
      const done = r.events.find(e => e.k === 'viewed' && e.n === turns);
      assert.equal(say(X, s, done), `You viewed the Test Centrepiece: ${turns} of ${turns === 1 ? '1 turn' : `${turns} turns`}. The view is complete: a dust sheet now covers it for the night, and it will neither wake nor fight.`);
      if (turns === 2) assert.equal(say(X, s, r.events.find(e => e.k === 'viewed' && e.n === 1)), 'You viewed the Test Centrepiece: 1 of 2 turns. 1 more turn of viewing in a row while it sleeps earns the Certificate. Any other action that takes time starts the count again, and so does its waking.');
    }
  });

  // ---- In a row ----

  test('any other action that takes time starts the count again (a wait, a step off and back, lighting the Lamp); an action that takes none (reading the lectern, answering nothing) does not; at depths 1–7', () => {
    const problems = [];
    const CASES = [
      ['a wait', [W(6), V, V, WAIT, V], [1, 2, 1]],
      ['a rest', [W(6), V, { a: 'rest' }, V], [1, 1]],
      ['a step off and back', [W(6), V, V, W(2), W(6), V], [1, 2, 1]],
      ['lighting the Lamp', [W(6), V, V, { a: 'use', uid: 'lamp' }], [1, 2]],
      ['reading the lectern', [W(6), V, V, { a: 'read', x: LECTERN[0], y: LECTERN[1] }, V, { a: 'read', x: LECTERN[0], y: LECTERN[1] }, V], [1, 2, 3, 4]],
      ['a refused action', [W(6), V, { a: 'move', dir: 0 }, V, V, V], [1, 2, 3, 4]],
    ];
    for (const [what, acts, want] of CASES) for (const depth of DEPTHS) {
      const K = core(), X = K.X, s = room(K, depth, { items: [LAMP] });
      const r = H.play(X, s, acts, { inv: 'all', clone: depth === 4 });
      problems.push(...bad(r, `${what} d${depth}`));
      if (json(views(r)) !== json(want)) problems.push(`${what} d${depth}: views ${json(views(r))}, not ${json(want)}`);
      // The free ones cost nothing and change nothing (the read) or nothing at all (the refusal).
      for (const st of r.steps) if (st.action.a === 'read' && st.events.length) problems.push(`${what} d${depth}: the read made ${json(st.events)}`);
      if (json(X.Viewing.of(s)) !== json({ n: want[want.length - 1], turn: r.steps.filter(st => st.action.a === 'view').pop().events[0].turn })) problems.push(`${what} d${depth}: Viewing.of is ${json(X.Viewing.of(s))}`);
    }
    assert.deepEqual(problems, []);
  });

  test('a waking interrupts the count even when it sleeps again before your next view (a planted waking at the last view\'s turn); one before the row began does not', () => {
    for (const [woke, want] of [[0, 3], [null, 3], ['now', 1]]) {
      const K = core(), X = K.X, s = room(K, 3);
      let r = H.play(X, s, [W(6), V, V], { inv: 'all' });
      assert.deepEqual(bad(r, 'before'), []);
      const p = X.Centrepiece.pieces(s)[0];
      if (woke === 'now') p.woke = { turn: X.Viewing.of(s).turn, cause: { k: 'ring', dist: 3, r: 3 } };
      else if (woke !== null) p.woke = { turn: woke, cause: { k: 'ring', dist: 3, r: 3 } };
      r = H.play(X, s, [V], { inv: 'all' });
      assert.deepEqual(bad(r, 'after'), []);
      assert.equal(views(r)[0], want, `woke ${json(woke)}`);
    }
  });

  // ---- A pip that wakes it ----

  test('with a lit Lamp a view adds a pip, and the lectern says so: hooded, your ring (2) from the reading tile does not reach it and the views add none; lit, your ring (3) does, each view adds a pip, the third wakes it, and the next view is refused not_asleep; at depths 1–7', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const K = core(), X = K.X, s = room(K, depth, { items: [LAMP] }), tag = `d${depth}`;
      const words = () => X.Viewing.words(s);
      const hooded = X.Clauses.fill(X.Registry.CLAUSES.lectern_ring_lamp.clause, { ring: 2, lamp: 1 });
      if (hooded !== 'Standing on the reading tile, your ring (2) does not reach the Centrepiece, so viewing adds no pips to it; a lit Lamp makes your ring 1 larger, enough to reach the Centrepiece, and then each turn of viewing adds a pip.') problems.push(`${tag}: ${hooded}`);
      let r = H.play(X, s, [W(6), V], { inv: 'all', clone: true });
      problems.push(...bad(r, tag));
      if (words()[2] !== hooded || gained(X, s, r.steps[1].events).length || X.Vision.ringRadius(s) !== 2 || X.Viewing.ring(s) !== 2) problems.push(`${tag} hooded: ${json(words())}, ring ${X.Vision.ringRadius(s)}`);
      // Lit: the lighting (an action that takes time, so the count starts again) and the views.
      r = H.play(X, s, [{ a: 'use', uid: 'lamp' }, V, V], { inv: 'all', clone: true });
      problems.push(...bad(r, tag));
      const lit = 'Standing on the reading tile, your ring (3) reaches the Centrepiece, so each turn of viewing adds a pip to it.';
      if (words()[2] !== lit) problems.push(`${tag} lit: ${json(words())}`);
      const p = X.Centrepiece.pieces(s)[0], pips = r.steps.map(st => gained(X, s, st.events).map(e => [e.pips, e.cause.k, e.cause.r]));
      if (json(pips) !== json([[[2, 'ring', 4]], [[3, 'ring', 3]], []]) || p.mode === 'dormant') problems.push(`${tag} lit: pips ${json(pips)}, ${p.mode}`);
      if (json(views(r)) !== '[1]' || json(refusals(r)) !== '["not_asleep"]') problems.push(`${tag} lit: views ${json(views(r))}, refused ${json(refusals(r))}`);
      if (!r.steps[1].events.some(e => e.k === 'woke' && e.who === p.uid && e.cause.k === 'ring')) problems.push(`${tag} lit: the view's pip did not wake it`);
      if (X.Viewing.sheeted(s) || X.Progress.cert(s)) problems.push(`${tag} lit: earned`);
    }
    assert.deepEqual(problems, []);
  });

  test('a noise that wakes it interrupts the count: two views, then a door opened by an exhibit beside the hall gives it its third pip, and the next view is refused not_asleep; at depths 1–7, clone-checked', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const K = core(), X = K.X, tag = `d${depth}`;
      // An exhibit in the gallery, set out awake to look into the hall, first acting at tick 250.
      const s = room(K, depth, { pips: 1, more: [{ sp: 'dummy', at: [3, 6], mode: 'awake', target: [3, 3], next: 250, stats: DUMMY, room: 's1' }] });
      const r = H.play(X, s, [W(6), V, V, V], { inv: 'all', clone: true });
      problems.push(...bad(r, tag));
      const p = X.Centrepiece.pieces(s)[0], wake = r.steps[2].events.find(e => e.k === 'woke' && e.who === p.uid);
      if (json(views(r)) !== '[1,2]' || json(refusals(r)) !== '["not_asleep"]') problems.push(`${tag}: views ${json(views(r))}, refused ${json(refusals(r))}`);
      if (!wake || wake.cause.k !== 'noise' || !r.steps[2].events.some(e => e.k === 'opened')) problems.push(`${tag}: it woke by ${json(wake)}`);
      if (X.Text.refusal('not_asleep') !== 'You can view the Centrepiece only while it sleeps, every piece of it, and it is not asleep now.') problems.push(`${tag}: ${X.Text.refusal('not_asleep')}`);
    }
    assert.deepEqual(problems, []);
  });

  // ---- The hall ----

  test('a hall sealed while the Centrepiece sleeps again opens at the turn boundary after its sheet, and says why; the seal\'s sentence names the sheet among the ways the shutters open; at depths 1–7', () => {
    const problems = [];
    // Hunted, you hide behind the screen until it sleeps again, then go back and view it.
    const hide = [W(3), W(4), W(2), W(2), W(0)], back = [W(4), W(6), W(6), W(0), W(7)];
    for (const depth of DEPTHS) {
      const K = core({ still: true, rec: { specials: undefined } }), X = K.X, s = room(K, depth, { pips: 2 }), tag = `d${depth}`;
      let r = H.play(X, s, [W(6)].concat(hide), { inv: 'all' });
      problems.push(...bad(r, tag));
      const sealed = r.events.find(e => e.k === 'stage' && e.stage === 'sealed');
      if (!sealed || !/once it falls or goes under its dust sheet or none of it is left in the hall/.test(say(X, s, sealed))) problems.push(`${tag}: sealed ${json(sealed && say(X, s, sealed))}`);
      r = H.play(X, s, () => (X.Centrepiece.pieces(s)[0].mode === 'dormant' ? null : WAIT), { inv: 'all', cap: 40 });
      problems.push(...bad(r, tag));
      r = H.play(X, s, back.concat([V, V, V]), { inv: 'all' });
      problems.push(...bad(r, tag));
      if (!X.Clock.sealed(s) || json(views(r)) !== '[1,2,3]') { problems.push(`${tag}: before the last view, sealed ${X.Clock.sealed(s)}, views ${json(views(r))}`); continue; }
      r = H.play(X, s, [V], { inv: 'all', clone: true });
      problems.push(...bad(r, tag));
      const ev = r.events, lift = ev.find(e => e.k === 'stage' && e.stage === 'unsealed');
      if (!lift || lift.cause.why !== 'sheet' || ev.indexOf(lift) < ev.findIndex(e => e.k === 'certificate') || lift.turn !== ev[0].turn + 1) problems.push(`${tag}: the lift ${json(lift)}`);
      if (lift && say(X, s, lift) !== 'The shutters opened: the Centrepiece went under its dust sheet.') problems.push(`${tag}: ${say(X, s, lift)}`);
      if (X.Clock.sealed(s) || s.dept.tiles[5][3] !== '+') problems.push(`${tag}: still shut`);
      if (X.Text.confirm('hall', { by: null, form: 'fight', seals: false }, null).line.indexOf('once it falls or goes under its dust sheet') < 0) problems.push(`${tag}: the hall's confirmation leaves out the sheet`);
    }
    assert.deepEqual(problems, []);
  });

  // ---- Under the sheet ----

  test('nothing under the sheet can be viewed, struck, stepped onto or aimed at (sheeted), and a bolt passes over it to what lies beyond, striking nothing under it; a piece that fell before the sheet is refused as any fallen exhibit is; at depths 1–7', () => {
    const problems = [];
    const PD = { uid: 'pd', kind: 'instrument', form: 'pin_driver', tier: 1, where: { at: 'kit', slot: 'instrument' } };
    for (const depth of DEPTHS) {
      const K = core(), X = K.X, tag = `d${depth}`;
      // A dummy asleep beyond the footprint, in line with the reading tile.
      const s = room(K, depth, { items: [PD], more: [{ sp: 'dummy', at: [1, 2], mode: 'dormant', stats: DUMMY, room: 'centre' }] });
      const dummy = s.actors.find(a => a.sp === 'dummy').uid, uid = s.dept.cp.uids[0];
      let r = H.play(X, s, [W(6), V, V, V, V], { inv: 'all' });
      problems.push(...bad(r, tag));
      r = H.play(X, s, answer(s), { inv: 'all' });
      // Refused from the reading tile: a view, a blow at it, the Pin-Driver aimed at it.
      for (const act of [V, { a: 'attack', uid }, { a: 'use', uid: 'pd', x: 3, y: 2 }]) {
        const before = X.State.hash(s);
        if (X.Step.legal(s).some(a => json(a) === json(act))) problems.push(`${tag}: ${json(act)} is offered`);
        r = H.play(X, s, [act], { inv: 'all', clone: true });
        problems.push(...bad(r, tag));
        if (json(r.events.map(e => [e.k, e.reason])) !== json([['refused', 'sheeted']]) || X.State.hash(s) !== before) problems.push(`${tag}: ${json(act)} answered ${json(r.events)}`);
      }
      // A step into it, from beside it (two steps west of the reading tile).
      r = H.play(X, s, [W(6), W(6)], { inv: 'all' });
      const step = H.play(X, s, [W(6)], { inv: 'all', clone: true });
      problems.push(...bad(r, tag), ...bad(step, tag));
      if (s.actors[0].x !== 4 || json(step.events.map(e => [e.k, e.reason])) !== json([['refused', 'sheeted']])) problems.push(`${tag}: a step into it answered ${json(step.events)} from ${s.actors[0].x},${s.actors[0].y}`);
      // A bolt across it, at the dummy beyond: it passes over the sheet and strikes the dummy.
      r = H.play(X, s, [W(2), W(2), { a: 'use', uid: 'pd', x: 1, y: 2 }], { inv: 'all', clone: true });
      problems.push(...bad(r, tag));
      const shot = r.steps[2].events, under = s.dept.cp.uids;
      if (!shot.some(e => e.k === 'used') || !shot.some(e => (e.k === 'damaged' || e.k === 'missed') && (e.who === dummy || e.target === dummy))) problems.push(`${tag}: the bolt ${json(shot)}`);
      if (shot.some(e => under.includes(e.who) || under.includes(e.target) || (e.cause && under.includes(e.cause.at)))) problems.push(`${tag}: the bolt named a piece under the sheet: ${json(shot)}`);
      if (X.Text.refusal('sheeted') !== 'The Centrepiece is under its dust sheet for the night: you cannot view it, strike it, step onto it or aim an instrument at it.') problems.push(`${tag}: ${X.Text.refusal('sheeted')}`);
    }
    assert.deepEqual(problems, []);
  });

  test('around the sheet: a Solution thrown onto it is not refused, and its square reaches whoever stands in it and no piece under it; a fork aimed at it is refused sheeted, as the Pin-Driver is; a beam crosses it, striking you beyond and nothing under it; at depths 1–7', () => {
    const problems = [];
    const FORK = { uid: 'fork', kind: 'instrument', form: 'fork', tier: 1, where: { at: 'kit', slot: 'instrument' } };
    for (const depth of DEPTHS) {
      const K = core(), X = K.X, tag = `d${depth}`;
      const sniper = H.species(X, 'axis_sniper')[0].sp;
      // A dummy asleep by the footprint's north side, out of your ring; a Heliograph in the reading tile's
      // row beyond the footprint, hunting but first acting at tick 800, after the views.
      const s = room(K, depth, { items: [FORK], more: [
        { sp: 'dummy', at: [2, 1], mode: 'dormant', stats: DUMMY, room: 'centre' },
        { sp: sniper.id, at: [1, 2], mode: 'hunting', next: 800, stats: X.Roles.stats(sniper.role, depth), room: 'centre' }] });
      s.actors[0].hp = s.actors[0].maxHp = 999;
      const dummy = s.actors.find(a => a.sp === 'dummy').uid, heliograph = s.actors.find(a => a.sp === sniper.id).uid, under = s.dept.cp.uids.slice();
      let r = H.play(X, s, [W(6), V, V, V, V], { inv: 'all' });
      problems.push(...bad(r, tag));
      r = H.play(X, s, answer(s), { inv: 'all' });
      if (!X.Viewing.sheeted(s)) { problems.push(`${tag}: not sheeted`); continue; }
      // A known Fixative, thrown onto the sheet's north-east tile: its square takes in the dummy.
      X.Consumables.startRun(s);
      const fx = X.Consumables.make(s, 'fixative', { at: 'floor', x: 6, y: 2 });
      fx.where = { at: 'tote' }; fx.n = 1; s.you.tote.push(fx.uid);
      s.run.knownSeals.push(X.Consumables.sealFor(s, 'fixative'));
      const toss = { a: 'throw', uid: fx.uid, x: 3, y: 2 };
      if (!X.Step.legal(s).some(a => json(a) === json(toss))) problems.push(`${tag}: a throw onto the sheet is not offered`);
      r = H.play(X, s, [toss], { inv: 'all', clone: true });
      problems.push(...bad(r, tag));
      const fixed = r.events.filter(e => e.k === 'status' && e.id === 'fixed').map(e => e.who);
      if (json(fixed) !== json([dummy]) || r.events.some(e => e.k === 'refused')) problems.push(`${tag}: the throw ${json(r.events.map(e => [e.k, e.who || e.reason]))}`);
      // The fork, aimed at a tile under the sheet: refused, and not offered.
      const fork = { a: 'use', uid: 'fork', x: 3, y: 3 }, before = X.State.hash(s);
      if (X.Step.legal(s).some(a => json(a) === json(fork))) problems.push(`${tag}: the fork at the sheet is offered`);
      r = H.play(X, s, [fork], { inv: 'all' });
      if (json(r.events.map(e => [e.k, e.reason])) !== json([['refused', 'sheeted']]) || X.State.hash(s) !== before) problems.push(`${tag}: the fork answered ${json(r.events)}`);
      // The Heliograph's beam along the row: over the sheet, to you on the reading tile.
      r = H.play(X, s, (st, i) => (i < 12 && !st.over ? WAIT : null), { inv: 'all' });
      problems.push(...bad(r, tag));
      const marked = r.events.find(e => e.k === 'telegraphed' && e.who === heliograph), hit = r.events.find(e => e.k === 'damaged' && e.who === 'you' && e.cause.k === 'special' && e.cause.by === heliograph);
      if (!marked || !marked.tiles.some(t => t[0] === 2 && t[1] === 2) || !marked.tiles.some(t => t[0] === 3 && t[1] === 2) || !hit) problems.push(`${tag}: the beam ${json(marked)} ${json(hit)}`);
      if (r.events.some(e => under.includes(e.who) || under.includes(e.target) || (e.cause && (under.includes(e.cause.by) || under.includes(e.cause.at))))) problems.push(`${tag}: an event named a piece under the sheet`);
    }
    assert.deepEqual(problems, []);
  });

  test('the sheet lies over its pieces\' home tiles, as BUILD says, wherever they sleep: a piece asleep off its home (as a pole or "Quiet, Please" can leave one) is gone from where it stands, and its home is covered; a home tile someone else stands on keeps its tile, and stays open once they leave; at depths 1–7', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const K = core({ rec: ENSEMBLE }), X = K.X, tag = `d${depth}`;
      const s = room(K, depth, { more: [{ sp: 'dummy', at: [10, 4], mode: 'dormant', stats: DUMMY, room: 'centre' }] });
      const [p1, p2, p3, p4] = X.Centrepiece.pieces(s), d = s.actors.find(a => a.sp === 'dummy');
      // Planted, as earlier play could leave them: the south-east piece asleep a tile south of
      // its home, (3,4), and the dummy asleep on the south-west piece's home, which that piece
      // left for the tile west of it, (1,3).
      p4.x = 3; p4.y = 4; p3.x = 1; p3.y = 3; d.x = 2; d.y = 3;
      const r = H.play(X, s, [W(6), V, V, V, V], { inv: 'all', clone: true });
      problems.push(...bad(r, tag));
      if (json(views(r)) !== '[1,2,3,4]') { problems.push(`${tag}: views ${json(views(r))}`); continue; }
      if (![p1, p2, p3, p4].every(a => X.Actors.byUid(s, a.uid).gone) || d.gone) problems.push(`${tag}: who is gone`);
      const sheets = s.dept.fixtures.filter(f => f.k === 'sheet').map(f => [f.x, f.y, f.of]);
      if (json(sheets) !== json([[2, 2, p1.uid], [3, 2, p2.uid], [3, 3, p4.uid]])) problems.push(`${tag}: the sheet lies ${json(sheets)}`);
      const at = (x, y) => s.dept.tiles[y][x];
      if (json([at(2, 2), at(3, 2), at(3, 3), at(2, 3), at(3, 4), at(1, 3)]) !== json(['f', 'f', 'f', '.', '.', '.'])) problems.push(`${tag}: tiles ${json([at(2, 2), at(3, 2), at(3, 3), at(2, 3), at(3, 4), at(1, 3)])}`);
      // Once the dummy is off it (moved by hand, as if it walked), its tile is floor in the
      // sheet's corner, and you can walk onto it.
      d.x = 1; d.y = 4;
      const back = H.play(X, s, answer(s).concat([W(5), W(5), W(6), W(6), W(0)]), { inv: 'all' });
      problems.push(...bad(back, tag));
      if (s.actors[0].x !== 2 || s.actors[0].y !== 3 || at(2, 3) !== '.' || back.events.some(e => e.k === 'refused')) problems.push(`${tag}: walking to the open tile ${json(back.events.filter(e => e.k === 'refused'))} at ${s.actors[0].x},${s.actors[0].y}`);
    }
    assert.deepEqual(problems, []);
  });

  // ---- The lectern ----

  test('the lectern: Dept.create places it with the Centrepiece and only then (no real department places either yet, at any depth, so a view on its reading tile is refused no_centrepiece), on the plan\'s lectern tile, and nothing else changes; reading it is free and changes nothing; four views from its reading tile in a real department earn the Certificate', () => {
    const C = loadCore();
    // No real department places a Centrepiece yet, so in hand play every view is refused
    // no_centrepiece and no Certificate can be earned (PG-CORE's ordering constraint: none until
    // the perk packages and the perk sheet have landed). The package that readies a core
    // changes this check, having met that constraint.
    for (const p of C.Packs.list()) for (const depth of DEPTHS) {
      const s = C.Dept.create(1, p.acc, depth);
      assert.ok(!s.dept.cp && !s.dept.fixtures.some(f => f.k === 'lectern'), `${p.acc} d${depth} placed a Centrepiece or a lectern`);
      s.actors[0].x = s.dept.viewTile[0]; s.actors[0].y = s.dept.viewTile[1];
      assert.equal(json(C.Step.step(s, V).map(e => [e.k, e.reason])), json([['refused', 'no_centrepiece']]), `${p.acc} d${depth}`);
    }
    for (const acc of ['S9', 'A4', 'M11']) for (const seed of [1, 2, 3]) {
      const K = core(), X = K.X, pack = X.Packs.get(acc), tag = `${acc} seed ${seed}`;
      pack.galleries = [];
      const plain = X.Dept.create(seed, acc, 3);
      // The planted record names the pack's own Signature piece, as centrepiece.test.js's does
      // (D-PACKS): the stand-in places no Signature piece as loot (§8.5), so naming another
      // would change what it places.
      pack.centrepiece = Object.assign({}, K.rec, { id: pack.centrepiece.id, form: pack.centrepiece.form, signature: pack.centrepiece.signature });
      const s = X.Dept.create(seed, acc, 3), m = s.dept, lect = m.fixtures.filter(f => f.k === 'lectern');
      assert.equal(json(lect), json([{ k: 'lectern', x: m.lectern[0], y: m.lectern[1] }]), tag);
      assert.equal(m.tiles[m.lectern[1]][m.lectern[0]], 'l', tag);
      assert.equal(json(plain.dept.fixtures), json(m.fixtures.filter(f => f.k !== 'lectern')), `${tag}: the other fixtures changed`);
      X.Viewing.place(s);
      assert.equal(m.fixtures.filter(f => f.k === 'lectern').length, 1, `${tag}: placed twice`);
      // On the reading tile (put there), read the lectern, then view it four times.
      s.actors[0].x = m.viewTile[0]; s.actors[0].y = m.viewTile[1];
      const read = { a: 'read', x: m.lectern[0], y: m.lectern[1] };
      assert.ok(X.Step.legal(s).some(a => json(a) === json(read)), `${tag}: the lectern cannot be read`);
      // (The first read, after the move by hand, also takes in what you see from there.)
      let r = H.play(X, s, [read], { inv: 'all' });
      const before = X.State.hash(s);
      r = H.play(X, s, [read], { inv: 'all' });
      assert.deepEqual(bad(r, tag), []);
      assert.equal(json(r.events), '[]', `${tag}: reading made ${json(r.events)}`);
      assert.equal(X.State.hash(s), before, `${tag}: reading changed the state`);
      const f = X.Fixtures.at(s, m.lectern[0], m.lectern[1]);
      assert.equal(X.Fixtures.read(s, f).text, X.Viewing.words(s).join(' '), tag);
      r = H.play(X, s, [V, V, V, V], { inv: 'all', clone: seed === 1 });
      assert.deepEqual(bad(r, tag), []);
      assert.equal(json(views(r)), '[1,2,3,4]', `${tag}: ${json(r.events.filter(e => e.k === 'refused' || e.k === 'woke'))}`);
      assert.ok(X.Viewing.sheeted(s) && X.Progress.cert(s).how === 'view', tag);
    }
  });

  test('the lectern\'s words are true whatever you carry: the gateway label, the rule (FIXTURES \'lectern\'), and the ring you would have viewing on its reading tile, which a view\'s pips bear out: hooded (\'lectern_ring_lamp\'), lit (\'lectern_ring_reach\'), with Soft Soles planted (\'lectern_ring_short\'), lit with Soft Soles, on shards, in a quiet garment (which a view does not count), read on the step onto the reading tile; under the sheet, the sheet\'s (FIXTURES \'sheet\')', () => {
    const R = loadCore().Registry;
    const RULE = 'While the Centrepiece sleeps and this department’s Certificate is still to be earned, view it from the reading tile beside the lectern for 4 turns in a row: the last view earns the Certificate and puts the Centrepiece under a dust sheet for the night, so no fight follows. Any other action that takes time starts the count again, and so does its waking.';
    const SHEET = 'The Centrepiece is under its dust sheet for the night: it no longer wakes, moves or fights, and you cannot view it, strike it, step onto it or aim an instrument at it.';
    const ring = (id, n) => loadCore().Clauses.fill(R.CLAUSES[id].clause, { ring: n, lamp: 1 });
    // [what, map, lit, soft soles rank, quiet garment, the ring line, does a view add a pip]
    const shards = MAP.map((row, y) => (y === READ[1] ? row.slice(0, READ[0]) + 'x' + row.slice(READ[0] + 1) : row));
    const QUIET = { uid: 'quiet', kind: 'garment', form: 'standard', tier: 1, where: { at: 'kit', slot: 'garment' }, prims: [{ id: 'quiet', cls: 'M' }] };
    const CASES = [
      ['hooded', MAP, false, 0, false, ring('lectern_ring_lamp', 2), false],
      ['lit', MAP, true, 0, false, ring('lectern_ring_reach', 3), true],
      ['Soft Soles 1, hooded', MAP, false, 1, false, ring('lectern_ring_short', 1), false],
      ['Soft Soles 2, hooded', MAP, false, 2, false, ring('lectern_ring_short', 1), false],
      ['Soft Soles 1, lit', MAP, true, 1, false, ring('lectern_ring_short', 2), false],
      ['on shards', shards, false, 0, false, ring('lectern_ring_reach', 4), true],
      ['a quiet garment, hooded', MAP, false, 0, true, ring('lectern_ring_lamp', 2), false],
      ['a quiet garment, lit', MAP, true, 0, true, ring('lectern_ring_reach', 3), true],
    ];
    const problems = [];
    for (const [what, map, lit, soft, quiet, line, pip] of CASES) {
      const K = core(), X = K.X;
      // Soft Soles, planted as its package will build it: your ring 1 smaller a rank.
      X.Perks.add('soft_soles', { ringDelta: (st, rank) => -rank });
      const s = room(K, 3, { map, items: [Object.assign({}, LAMP, lit ? { lit: true } : {})].concat(quiet ? [QUIET] : []) });
      if (lit) s.items.find(i => i.uid === 'lamp').lit = true;
      if (soft) s.run.perks.push({ id: 'soft_soles', rank: soft });
      // The step onto the reading tile (your last action a move, which a quiet garment counts),
      // then its words, as you would be viewing there.
      H.play(X, s, [W(6)], { inv: false });
      const got = X.Viewing.words(s);
      if (json(got) !== json([GATEWAY, RULE, line])) problems.push(`${what}: ${json(got)}`);
      // Soft Soles is not built yet (PG-PERKS-A), so the waking invariants, which know no perk,
      // are left out where it is planted.
      const r = H.play(X, s, [V], { inv: soft ? ['viewing', 'system', 'centrepiece', 'hall', 'progress'] : 'all' });
      problems.push(...bad(r, what));
      if (gained(X, s, r.events).length !== (pip ? 1 : 0)) problems.push(`${what}: the view added ${gained(X, s, r.events).length} pips`);
      if (X.Vision.ringRadius(s) !== X.Viewing.ring(s)) problems.push(`${what}: viewing, your ring is ${X.Vision.ringRadius(s)}, and the lectern says ${X.Viewing.ring(s)}`);
    }
    assert.equal(ring('lectern_ring_short', 1), 'Standing on the reading tile, your ring (1) does not reach the Centrepiece, so viewing adds no pips to it.');
    // Under the sheet; and none where no Centrepiece was placed.
    const K = core(), X = K.X, s = room(K, 3, { you: READ });
    H.play(X, s, [V, V, V, V], { inv: false });
    assert.equal(json(X.Viewing.words(s)), json([GATEWAY, RULE, SHEET]));
    assert.equal(json(X.Viewing.words(X.TestRoom.create(1))), '[]');
    assert.deepEqual(problems, []);
  });

  test('Viewing.place puts the lectern only where a Centrepiece stands placed and the department has a lectern tile, once; Viewing.of and Viewing.sheeted are absent (null) until written, and copies', () => {
    const K = core(), X = K.X;
    const t = H.room(X, 1, { acc: 'T9', depth: 3, map: MAP, you: START, rooms: ROOMS });
    t.dept.lectern = LECTERN.slice();
    X.Viewing.place(t);
    assert.equal(t.dept.fixtures.length, 0, 'a lectern with no Centrepiece');
    const s = room(K, 3);
    assert.equal(json(s.dept.fixtures), json([{ k: 'lectern', x: 6, y: 1 }]));
    X.Viewing.place(s);
    assert.equal(s.dept.fixtures.length, 1, 'placed twice');
    assert.equal(X.Viewing.of(s), null); assert.equal(X.Viewing.sheeted(s), null);
    assert.ok(!('view' in s.dept) && s.dept.cp.sheet === null, 'a part written before it is used');
    H.play(X, s, [W(6), V], { inv: false });
    const v = X.Viewing.of(s);
    v.n = 99;
    assert.equal(X.Viewing.of(s).n, 1, 'Viewing.of gives the state itself');
  });

  // ---- The invariants against planted states ----

  test('the invariants of viewing.inv.js hold on real views and fail on planted faults, each caught by its own', () => {
    const K = core(), X = K.X, s = room(K, 3), invs = Inv.select(X, ['viewing']);
    assert.equal(json(invs.map(i => i.id)), json(['viewing.view', 'viewing.earn', 'viewing.sheet']));
    const check = (pre, action, ev, post) => Inv.checker(X, invs)(pre, action, ev, post).map(v => v.inv);
    // A step played on a clone: [pre, action, events, post].
    const stepOf = (st, action) => { const pre = X.State.clone(st), post = X.State.clone(st); return [pre, action, X.Step.step(post, action), post]; };
    H.play(X, s, [W(6), V], { inv: false });
    const second = stepOf(s, V);
    H.play(X, s, [V], { inv: false });
    const third = stepOf(s, V);
    H.play(X, s, [V], { inv: false });
    const last = stepOf(s, V);
    assert.equal(json([second, third, last].map(st => st[2].find(e => e.k === 'viewed').n)), '[2,3,4]');
    H.play(X, s, [V, { a: 'choose', index: 0 }], { inv: false });
    const after = stepOf(s, WAIT);
    for (const [pre, a, ev, post] of [second, third, last, after]) assert.deepEqual(check(pre, a, ev, post), [], json(a));
    const plant = ([pre, a, ev, post], fn) => { const Q = X.State.clone(pre), P = X.State.clone(post), E = JSON.parse(json(ev)); fn(P, E, Q); return check(Q, a, E, P); };
    const PLANTS = [
      ['viewing.view', second, (P, E) => { E.find(e => e.k === 'viewed').n = 1; P.dept.view.n = 1; }, 'a row\'s second view counted 1'],
      ['viewing.view', second, (P, E) => { P.dept.view.turn += 1; }, 'dept.view with another turn'],
      ['viewing.view', after, (P) => { P.dept.view = { n: 1, turn: 0 }; }, 'dept.view changed with no view'],
      ['viewing.view', second, (P, E, pre) => { pre.actors[0].x += 1; }, 'a view told off the reading tile'],
      ['viewing.earn', third, (P, E) => { E.push({ k: 'certificate', turn: 1, tick: 100, acc: 'T9', how: 'view', cause: { k: 'view' } }); }, 'a Certificate by view before the row is complete'],
      ['viewing.earn', last, (P) => { P.actors[1].gone = 0; }, 'a piece left standing under the sheet'],
      ['viewing.earn', last, (P, E) => { E.splice(2, 0, { k: 'died', turn: 1, tick: 100, who: P.actors[1].uid, cause: { k: 'view' } }); }, 'a piece that died under the sheet'],
      ['viewing.earn', last, (P) => { P.dept.tiles[2] = P.dept.tiles[2].slice(0, 2) + '.' + P.dept.tiles[2].slice(3); }, 'a sheet tile left floor'],
      ['viewing.earn', last, (P) => { P.dept.fixtures.pop(); }, 'a sheet fixture missing'],
      ['viewing.earn', last, (P, E) => { const i = E.findIndex(e => e.k === 'certificate'); E.push(E.splice(i, 1)[0]); }, 'the Certificate after the world acted'],
      ['viewing.sheet', after, (P) => { P.actors[1].gone = 0; }, 'a piece out from under the sheet'],
      ['viewing.sheet', after, (P) => { P.dept.tiles[3] = P.dept.tiles[3].slice(0, 3) + '.' + P.dept.tiles[3].slice(4); }, 'a sheet tile turned back to floor'],
      ['viewing.sheet', after, (P) => { P.dept.cp.sealed = { turn: 0, by: null, why: 'hunt', at: 0, last: 0, seen: '' }; }, 'the hall sealed after a boundary under the sheet'],
      ['viewing.sheet', after, (P, E) => { E.push({ k: 'moved', turn: 9, tick: 900, who: P.actors[1].uid, from: [2, 2], to: [2, 1] }); }, 'a piece under the sheet acting'],
    ];
    for (const [want, base, fn, what] of PLANTS) assert.deepEqual(plant(base, fn), [want], what);
  });
};
