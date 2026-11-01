// ACCESSION — what every Centrepiece shares (BUILD.md §5.3, §5.5, §8.1, §8.2, §8.7; M4 plan A8,
// D3, R4; ARCH-CP-CORE), shown with a test-only core: a pack T9 (made in each test's own core,
// never in the game) whose Centrepiece, 'T9.12', has the archetype test_cp, added with the
// core's hooks (Centrepiece.hooks), a burst from the start and the warden's ring from phase 2,
// and a Signature piece, the weapon 'T9.11'. No department of the game places a Centrepiece
// until its own package marks its core past ready false; this test core is how the shared
// rules are played before then. Joined up: real actions in a room with a hall (the harness's
// rooms), every invariant checked after every step (centrepiece.inv.js among them), the main
// runs clone-checked. The figures expected are worked out here from BUILD's sentences:
//   - placement: on the plan's footprint, in the hall, of role centrepiece with that role's
//     numbers, asleep, its health shared among its pieces, dept.cp written, nothing drawn;
//     no real department places one until its core is ready, and Dept.create does once it is;
//   - phases at CP_PHASE_PCT of its full health, which never go back, each with its event and
//     what it gains; its specials in turn (Specials.markNext), each mark equal to its damage;
//   - the fight form's fall: the Signature piece on the floor at its footprint's top-left tile,
//     where it first stood (a full tote too), the Certificate once, the seal lifted; the
//     treasure form's: the seal lifted and nothing else, and its line says so
//     ('CLAUSES.cp_fight', 'CLAUSES.cp_treasure');
//   - its hall with an ensemble split by its openings: a piece outside never seals you in
//     alone, and the last piece inside falling opens the shutters (alone);
//   - the burst ('cp_burst'): its readout and its marks;
//   - the wake: pips and damage wake it; a herald's call, the night-watch bell and the alarm
//     pass over it.
'use strict';
const H = require('./_harness.js');

module.exports = ({ test, assert, loadCore, root, path }) => {
  const json = JSON.stringify;
  const wait = { a: 'wait' };
  const DEPTHS = H.DEPTHS;
  const B = require(path.join(root, 'tools/battery.js'));
  // The hall (x 1–7, y 1–5) and a gallery east of it (x 9–11), joined by an archway (8,2) and a
  // staff door (8,4); the footprint's top-left tile (2,2), so the Centrepiece stands on 2–3 × 2–3.
  const MAP = ['#############', '#.......#...#', '#.......,...#', '#.......#...#', '#.......S...#', '#.......#...#', '#############'];
  const ROOMS = [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 7, y1: 5 }, { key: 's1', role: 'section', x0: 9, y0: 1, x1: 11, y1: 5 }];
  const OPENINGS = [{ x: 8, y: 2, ch: ',' }, { x: 8, y: 4, ch: 'S' }];
  const AT = [2, 2];
  const SIG = { id: 'T9.11', kind: 'weapon', form: 'light', prims: [{ id: 'dmg', cls: 'S' }], name: 'The Test Pen',
    tomb: { maker: 'Made for the tests', date: 'Now', medium: 'Steel', dims: 'L. 14 cm', credit: 'The tests' }, paragraph: 'It exists so that something can drop.' };
  const TOUGH = { hp: 999, acc: -99, eva: -999, pad: 0, dmin: 1, dmax: 1 };

  // The test-only core, in a fresh core X: its archetype (whose init marks ax.inited, and whose
  // onPhase is recorded in `phases`), its pack T9 with the record (o.rec overrides its fields:
  // undefined drops one) and, for a treasure, a planted seal rule standing in for its owner's
  // (COMPOSITE-PHASES'): its hall seals while one of its pieces hunts you, why 'touched',
  // naming no one (a rule that names its guardian as by needs a line of its that covers stage).
  // o.still: its archetype never steps (mayStep false), as the Great Board's.
  function core(o) {
    o = o || {};
    const X = loadCore(), R = X.Registry, phases = [];
    R.define('ARCHETYPES', 'test_cp', { built: 'M4', ready: 'unit', clause: 'Walks a tile at a time and strikes from beside you for {dmg}.', params: { dmg: 'role:DMG' }, covers: ['attacked', 'missed'] });
    // (A clone-checked run steps a twin in the same core, so each call names its state.)
    X.Archetypes.add('test_cp', X.Centrepiece.hooks('test_cp', Object.assign({ init: (s, a) => { a.ax.inited = true; }, onPhase: (s, k) => phases.push([s, k]) }, o.still ? { mayStep: () => false } : {})));
    const rec = Object.assign({ id: 'T9.12', name: 'The Test Centrepiece', archetype: 'test_cp', role: 'centrepiece', form: 'fight', size: 2, specials: ['cp_burst'],
      phases: [{ parts: ['SPECIALS.cp_burst'] }, { parts: ['SPECIALS.ring'], specials: ['ring'] }, {}], signature: 'T9.11',
      tomb: { maker: 'Made for the tests', date: 'Now', medium: 'Plaster', dims: 'H. 2 m', credit: 'The tests' }, paragraph: 'It stands for every Centrepiece.' }, o.rec || {});
    for (const k of Object.keys(rec)) if (rec[k] === undefined) delete rec[k];
    X.Packs.add({ acc: 'T9', species: [], modules: [], items: [SIG], centrepiece: rec });
    if (rec.form === 'treasure') X.Hall.defineSeal('treasure', (s, c) => { for (const u of c.uids) { const a = X.Actors.byUid(s, u); if (a && !a.gone && a.mode === 'hunting') return { why: 'touched' }; } return null; });
    return { X, rec, phases, pack: X.Packs.get('T9') };
  }
  // A room with the hall, the test core placed on its footprint (Centrepiece.place). o: you
  // ([4, 3], beside it); more exhibits; items; clock; scale (each piece's health and maximum
  // set to this many, so a fight is short; its phases go by shares, which this keeps).
  function room(K, depth, o) {
    o = o || {};
    const X = K.X, s = H.room(X, o.seed || 1, { acc: 'T9', depth, map: o.map || MAP, you: o.you || [4, 3], exhibits: o.more || [], rooms: o.rooms || ROOMS,
      clock: o.clock || { B: 300, G: 60 }, entrance: [11, 3], fixtures: o.fixtures || [{ k: 'staff', x: 8, y: 4, grade: 1 }], items: o.items || [] }, o.options || {});
    s.actors[0].maxHp = 999; s.actors[0].hp = 999;
    X.Centrepiece.place(s, { cpl: o.at || AT }, K.pack);
    if (o.scale) for (const a of X.Centrepiece.pieces(s)) { a.maxHp = o.scale; a.hp = o.scale; }
    return s;
  }
  const bad = (r, tag) => r.violations.map(v => `${tag}: ${v.id}: ${v.text}`);
  const say = (X, s, e) => X.Text.event(e, X.Labels.nameOf(s));
  // Strike the Centrepiece's first standing piece from beside it until it falls (or cap steps).
  const fight = (X, cap) => (s, i) => {
    if (i >= (cap || 400)) return null;
    const p = X.Centrepiece.pieces(s).find(a => !a.gone);
    return p ? { a: 'attack', uid: p.uid } : null;
  };
  // Every event a piece of the Centrepiece caused is a kind its line allows it (the soak's
  // completeness, B.causer and its DOER table): the universal kinds and its line's covers.
  function covered(X, s, events) {
    const rec = X.Packs.get('T9').centrepiece, allow = new Set(X.Clauses.UNIVERSAL);
    for (const p of X.Clauses.of(rec, { depth: s.dept.depth })) for (const k of p.covers) allow.add(k);
    const uids = s.dept.cp.uids, out = [];
    for (const e of events) { const by = B.causer(e); if (uids.includes(by) && !allow.has(e.k)) out.push(`${by} caused ${e.k}, which its line does not cover`); }
    return out;
  }

  // ---- Placement ----

  test('Centrepiece.place stands the test core on its footprint in its hall: role centrepiece with that role\'s numbers, asleep, its health shared among its pieces (the first takes the rest), its specials and phase 1; dept.cp records it; each archetype\'s init runs, without applies, and nothing is drawn; at depths 1–7', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const role = loadCore().Roles.stats('centrepiece', depth);
      // One 2×2 body.
      const K = core(), X = K.X, s = room(K, depth), a = s.actors[1];
      const want = { uid: `T9.${depth}.centre.1`, sp: 'T9.12', arch: 'test_cp', role: 'centrepiece', size: 2, x: 2, y: 2, hp: role.hp, maxHp: role.hp, acc: role.acc, eva: role.eva, pad: role.pad, dmin: role.dmin, dmax: role.dmax, mode: 'dormant', home: [2, 2] };
      for (const k of Object.keys(want)) if (json(a[k]) !== json(want[k])) problems.push(`d${depth}: its ${k} is ${json(a[k])}, not ${json(want[k])}`);
      if (json(a.ax) !== json({ specials: ['cp_burst'], phase: 1, inited: true })) problems.push(`d${depth}: its ax is ${json(a.ax)}`);
      const cp = s.dept.cp;
      if (json(cp) !== json({ uids: [want.uid], room: 'centre', openings: OPENINGS, form: 'fight', sealed: null, touched: false, sheet: null, treasure: null, at: AT, signature: 'T9.11', gains: [null, 'ring', null] }))
        problems.push(`d${depth}: dept.cp is ${json(cp)}`);
      if (json(s.rng) !== '{}') problems.push(`d${depth}: placing it drew on ${json(Object.keys(s.rng))}`);
      if (X.Centrepiece.form(s) !== 'fight' || X.Centrepiece.phase(s) !== 1 || json(X.Centrepiece.pieces(s).map(p => p.uid)) !== json([want.uid])) problems.push(`d${depth}: its form, phase or pieces`);
      if (json(X.Hall.openings(s)) !== json(OPENINGS) || !X.Hall.inside(s, 3, 3)) problems.push(`d${depth}: the hall reads it otherwise`);
      // Four one-tile pieces on the footprint, counting on from an exhibit already in the hall,
      // the third left out (without).
      const E = core({ rec: { size: 2, specials: undefined, pieces: [{ at: [0, 0], specials: ['cp_burst'] }, { at: [1, 0] }, { at: [0, 1], specials: ['ring', 'cp_burst'] }, { at: [1, 1] }], form: 'treasure', phases: undefined } });
      const t = room(E, depth, { more: [{ sp: 'dummy', at: [6, 5], mode: 'dormant', stats: TOUGH, room: 'centre' }], options: { without: [`T9.${depth}.centre.4`] } });
      const ps = E.X.Centrepiece.pieces(t), share = Math.floor(role.hp / 4);
      if (json(ps.map(p => [p.uid, p.x, p.y, p.size, p.maxHp, p.ax.specials, p.gone])) !== json([[`T9.${depth}.centre.2`, 2, 2, 1, role.hp - 3 * share, ['cp_burst'], 0],
        [`T9.${depth}.centre.3`, 3, 2, 1, share, [], 0], [`T9.${depth}.centre.4`, 2, 3, 1, share, ['ring', 'cp_burst'], 1], [`T9.${depth}.centre.5`, 3, 3, 1, share, [], 0]]))
        problems.push(`d${depth}: the pieces are ${json(ps.map(p => [p.uid, p.x, p.y, p.size, p.maxHp, p.ax.specials, p.gone]))}`);
      if (ps.reduce((n, p) => n + p.maxHp, 0) !== role.hp) problems.push(`d${depth}: the pieces' health is not the role's total`);
      if (ps.some(p => p.gone ? !!p.ax.inited : !p.ax.inited)) problems.push(`d${depth}: init ran on ${json(ps.filter(p => p.ax.inited).map(p => p.uid))}`);
      if (t.dept.cp.form !== 'treasure' || t.dept.cp.signature !== 'T9.11' || 'gains' in t.dept.cp) problems.push(`d${depth}: the treasure's dept.cp is ${json(t.dept.cp)}`);
    }
    assert.deepEqual(problems, []);
  });

  test('what Centrepiece.place refuses, each with a sentence: a record that is not one, an archetype added without the core\'s hooks, a footprint it cannot stand on, a second placing; a pack with none places nothing', () => {
    const cases = [
      [{ form: 'battle' }, /form is fight or treasure/], [{ archetype: 'nobody' }, /not in the registry/], [{ size: 3 }, /3 tiles across/],
      [{ specials: ['nothing'] }, /no special/], [{ pieces: [] }, /pieces are not a list of one or more/], [{ specials: undefined, pieces: [{ at: [2, 0] }] }, /not a tile of its 2×2 footprint/],
      [{ specials: undefined, pieces: [{ at: [0, 0] }, { at: [0, 0] }] }, /another's tile/], [{ pieces: [{ at: [0, 0] }] }, /names its own specials/],
      [{ specials: undefined, pieces: [{ at: [1, 0] }, { at: [0, 1] }, { at: [1, 1] }] }, /leave its footprint's top-left tile empty, where its Signature piece drops/],
      [{ phases: [{ specials: ['ring'] }] }, /first phase gains nothing/], [{ phases: [{}, { specials: ['ring', 'cp_burst'] }] }, /at most one/],
      [{ phases: [{}, {}, {}, {}] }, /at most 3/], [{ signature: 'S9.1' }, /no weapon, garment, curio or instrument/],
      [{ role: 'brute' }, /role is centrepiece/],
    ];
    for (const [rec, why] of cases) assert.throws(() => room(core({ rec })), why, json(rec));
    const K = core();
    assert.throws(() => room(K, 3, { at: [0, 0] }), /in no room/);
    assert.throws(() => room(K, 3, { at: [7, 1] }), /footprint tile 8,1 is not floor of its hall/);
    assert.throws(() => room(K, 3, { more: [{ sp: 'dummy', at: [3, 3], mode: 'dormant', stats: TOUGH }] }), /stands on T9\.12's footprint tile 3,3/);
    const s = room(K, 3);
    assert.throws(() => K.X.Centrepiece.place(s, { cpl: [5, 2] }, K.pack), /already has its Centrepiece/);
    // An archetype in the registry but added without Centrepiece.hooks.
    const Y = core();
    Y.X.Registry.define('ARCHETYPES', 'test_plain', { built: 'M4', ready: 'unit', clause: 'Waits.', params: {}, covers: [] });
    Y.X.Archetypes.add('test_plain', {});
    Y.pack.centrepiece.archetype = 'test_plain';
    assert.throws(() => room(Y, 3), /was not added with Centrepiece\.hooks/);
    assert.throws(() => Y.X.Centrepiece.hooks('test_cp', {}), /twice/);
    // No record: nothing.
    const Z = core(), u = H.room(Z.X, 1, { acc: 'T9', depth: 3, map: MAP, you: [4, 3], exhibits: [], rooms: ROOMS }), before = json(u);
    Z.X.Centrepiece.place(u, { cpl: AT }, { acc: 'T0', species: [] });
    assert.equal(json(u), before);
    assert.equal(Z.X.Centrepiece.form(u), null);
    assert.equal(Z.X.Centrepiece.phase(u), null);
  });

  test('its hall\'s openings are the tiles one steps into it from: an archway, a door, a staff door; never a tile beside it only past a corner, from which no step reaches it', () => {
    // The hall x 1–4, y 1–3; a door (5,2) and a staff door (2,4) out of it; the floor (5,4) of
    // the room beyond touches its corner (4,3) only diagonally, past two walls.
    const map = ['#########', '#....#..#', '#....+..#', '#....#..#', '##S##...#', '#.......#', '#########'];
    const rooms = [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 4, y1: 3 }, { key: 's1', role: 'section', x0: 6, y0: 1, x1: 7, y1: 3 }, { key: 's2', role: 'section', x0: 1, y0: 5, x1: 7, y1: 5 }];
    const K = core(), X = K.X, s = room(K, 3, { map, rooms, you: [1, 3], fixtures: [{ k: 'staff', x: 2, y: 4, grade: 1 }], at: [2, 1] });
    assert.equal(json(s.dept.cp.openings), json([{ x: 5, y: 2, ch: '+' }, { x: 2, y: 4, ch: 'S' }]));
    assert.equal(X.Grid.canStep(s.dept, 5, 4, 7, 'you'), false, 'a step from the corner\'s diagonal reaches the hall');
  });

  // The openings of a rectangle room, written out from §8.4's words: every tile one can walk on
  // in the ring just outside it, corners left out, in row-major order (the harness's rule).
  function ringOpenings(X, m, r) {
    const out = [];
    for (let y = r.y0 - 1; y <= r.y1 + 1; y++) for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
      const ring = x === r.x0 - 1 || x === r.x1 + 1 || y === r.y0 - 1 || y === r.y1 + 1, corner = (x === r.x0 - 1 || x === r.x1 + 1) && (y === r.y0 - 1 || y === r.y1 + 1);
      if (ring && !corner && X.Grid.TILES[m.tiles[y][x]] && X.Grid.TILES[m.tiles[y][x]].walk) out.push({ x, y, ch: m.tiles[y][x] });
    }
    return out;
  }

  test('no department of the game places its Centrepiece until its own package marks its core past ready false; with a gallery list and a ready core added with the core\'s hooks, Dept.create places it on the plan\'s footprint in the hall, its openings the hall\'s, staff doors too, and changes nothing else', () => {
    const C = loadCore();
    for (const p of C.Packs.list()) {
      assert.equal(C.Populate.ready(p.centrepiece), false, `${p.acc}'s core is ready before its package`);
      for (const seed of [1, 2]) assert.equal(C.Hall.cp(C.Dept.create(seed, p.acc, 3)), null, `${p.acc} seed ${seed} placed its Centrepiece`);
    }
    let staff = 0;
    for (const acc of ['S9', 'A4', 'M11']) for (const seed of [1, 2, 3]) {
      const K = core(), X = K.X, pack = X.Packs.get(acc);
      pack.galleries = [];
      const plain = X.Dept.create(seed, acc, 3);
      // The planted record names the pack's own Signature piece, as the pack's record does (a
      // fight needs one of its pack): the stand-in places no Signature piece as loot (BUILD.md
      // §8.5), so naming another would change the items it places, which is no part of placing it.
      pack.centrepiece = Object.assign({}, K.rec, { id: pack.centrepiece.id, form: pack.centrepiece.form, signature: pack.centrepiece.signature });
      const s = X.Dept.create(seed, acc, 3), cpl = X.Layout.generate(pack.programme, 0, seed, { acc, depth: 3 }).plan.cpl, m = s.dept;
      const hall = m.rooms.find(r => r.key === 'centre'), cp = X.Hall.cp(s), a = X.Centrepiece.pieces(s)[0];
      assert.ok(cp && a, `${acc} seed ${seed}: no Centrepiece`);
      assert.equal(json([a.x, a.y, a.size, cp.room, cp.at]), json([cpl[0], cpl[1], 2, 'centre', cpl]), `${acc} seed ${seed}`);
      assert.equal(json(cp.openings), json(ringOpenings(X, m, hall)), `${acc} seed ${seed}: openings`);
      assert.ok(cp.openings.length >= 1, `${acc} seed ${seed}: a hall with no way in`);
      staff += cp.openings.filter(o => o.ch === 'S').length;
      for (const [x, y] of X.Actors.footprint(a)) assert.ok(X.Hall.inside(s, x, y));
      // Everything else as the department made without it: the actors before it, items, tiles, streams.
      const strip = st => ({ actors: st.actors.filter(b => !(st.dept.cp && st.dept.cp.uids.includes(b.uid))), items: st.items, tiles: st.dept.tiles, rng: st.rng, fixtures: st.dept.fixtures });
      assert.equal(json(strip(s)), json(strip(plain)), `${acc} seed ${seed}: placing it changed the rest of the department`);
    }
    assert.ok(staff >= 1, 'no hall in these seeds has a staff door, so none was seen shuttered with the rest');
  });

  // Every pack whose Centrepiece's core is past ready false (so a department places it) has its
  // core added with Centrepiece.hooks, a record Centrepiece.check accepts, and, for a fight, its
  // Signature piece, an item of its pack: the problems, as sentences.
  function readiness(X) {
    const out = [];
    for (const p of X.Packs.list()) {
      const rec = p.centrepiece;
      if (!rec || !X.Populate.ready(rec)) continue;
      if (!X.Centrepiece.wired(rec.archetype)) out.push(`${p.acc}: ${rec.archetype} is ready but not added with Centrepiece.hooks`);
      try { X.Centrepiece.check(rec, p); } catch (e) { out.push(`${p.acc}: ${e.message}`); }
      if (rec.form === 'fight' && !(p.items || []).some(it => it.id === rec.signature)) out.push(`${p.acc}: its fight names no Signature piece of its own pack`);
    }
    return out;
  }
  test('a department\'s Centrepiece, once its core is ready, has the core\'s hooks, a sound record and, for a fight, a Signature piece of its pack (planted: a ready fight with none, and a core without the hooks)', () => {
    assert.deepEqual(readiness(loadCore()), []);
    const K = core(), X = K.X;
    X.Registry.ARCHETYPES.mp_tableau.ready = 'unit';
    X.Archetypes.add('mp_tableau', {});
    delete X.Packs.get('M11').centrepiece.signature;
    const got = readiness(X);
    assert.ok(got.some(l => /M11: mp_tableau is ready but not added with Centrepiece\.hooks/.test(l)) && got.some(l => /M11: its fight names no Signature piece/.test(l)), json(got));
  });

  // ---- Phases, its specials in turn, and its fall ----

  test('a fight, joined up: struck down from beside it, it enters phase 2 at CP_PHASE_PCT[0]% of its full health and phase 3 at [1]%, once each, in order, gaining its phase-2 special; its specials come in turn, each mark equal to what it deals; when it falls its Signature piece drops at its footprint\'s top-left tile, the Certificate follows once, and the hall opens; at depths 1–7, clone-checked', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const K = core(), X = K.X, s = room(K, depth, { scale: 60 }), uid = s.actors[1].uid;
      const r = H.play(X, s, fight(X), { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth}`), ...covered(X, s, r.events).map(l => `d${depth}: ${l}`));
      const ev = r.events, ph = ev.filter(e => e.k === 'phase');
      if (json(ph.map(e => [e.who, e.phase, e.gained || null, e.cause.k, e.cause.by])) !== json([[uid, 2, 'ring', 'damaged', 'you'], [uid, 3, null, 'damaged', 'you']])) problems.push(`d${depth}: phases ${json(ph)}`);
      // Each phase came in the step whose blow took its health to its threshold or below.
      for (const e of ph) {
        const hurt = ev.slice(0, ev.indexOf(e)).filter(d => d.k === 'damaged' && d.who === uid).pop();
        const limit = Math.floor(60 * X.N.CP_PHASE_PCT[e.phase - 2] / 100), before = ev.slice(0, ev.indexOf(hurt)).filter(d => d.k === 'damaged' && d.who === uid).pop();
        if (!hurt || hurt.hp > limit || (before && before.hp <= limit)) problems.push(`d${depth}: phase ${e.phase} came after the blow to ${hurt && hurt.hp}, the threshold ${limit}`);
        if (!/^The Test Centrepiece is now in phase \d of 3(, and has a ring of blows)?: the Centrepiece’s health has fallen to \d+% of its full health or below\.$/.test(say(X, s, e))) problems.push(`d${depth}: ${say(X, s, e)}`);
      }
      if (json(K.phases.filter(p => p[0] === s).map(p => p[1])) !== '[2,3]') problems.push(`d${depth}: its onPhase heard ${json(K.phases.filter(p => p[0] === s).map(p => p[1]))}`);
      // Its specials took turns: the burst, then the ring, each a CP_SPECIAL_EVERY's cadence apart.
      const marks = ev.filter(e => e.k === 'telegraphed' && e.who === uid).map(e => e.sp);
      if (marks[0] !== 'cp_burst' || (marks.includes('ring') && marks.indexOf('ring') < marks.indexOf('cp_burst'))) problems.push(`d${depth}: it marked ${json(marks)}`);
      if (!ev.some(e => e.k === 'damaged' && e.who === 'you' && e.cause.k === 'special' && e.cause.by === uid)) problems.push(`d${depth}: none of its specials struck you`);
      // Its fall.
      const died = ev.find(e => e.k === 'died' && e.who === uid), drop = ev.filter(e => e.k === 'dropped'), cert = ev.filter(e => e.k === 'certificate');
      if (!died) { problems.push(`d${depth}: it never fell`); continue; }
      const after = ev.slice(ev.indexOf(died) + 1);
      const order = after.filter(e => ['dropped', 'certificate', 'grade', 'stage'].includes(e.k)).map(e => e.k + (e.k === 'stage' ? ':' + e.stage + ':' + e.cause.why : ''));
      if (json(order) !== json(['dropped', 'certificate', 'grade', 'stage:unsealed:defeat'])) problems.push(`d${depth}: after its fall ${json(order)}`);
      if (drop.length !== 1 || drop[0].who !== uid || drop[0].x !== 2 || drop[0].y !== 2 || drop[0].cause.by !== 'you') problems.push(`d${depth}: dropped ${json(drop)}`);
      const it = drop[0] && s.items.find(i => i.uid === drop[0].item);
      if (!it || it.uid !== `T9.${depth}.centre.i1` || it.ref !== 'T9.11' || it.kind !== 'weapon' || it.form !== 'light' || it.tier !== X.N.TIER_LOW_BY_DEPTH[depth - 1] || json(it.where) !== json({ at: 'floor', x: 2, y: 2 }))
        problems.push(`d${depth}: the Signature piece is ${json(it)}`);
      if (cert.length !== 1 || json(cert[0].cause) !== json({ k: 'defeat', by: uid }) || json(s.dept.cert) !== json({ how: 'defeat', turn: died.turn }) || s.run.certificates.length !== 1) problems.push(`d${depth}: certificate ${json(cert)}`);
      if (drop[0] && say(X, s, drop[0]) !== 'The Test Centrepiece fell, and the Centrepiece’s Signature piece dropped to the floor where the Centrepiece first stood.') problems.push(`d${depth}: ${say(X, s, drop[0])}`);
      if (cert[0] && say(X, s, cert[0]) !== 'You earned this department’s Certificate: you defeated the Test Centrepiece.') problems.push(`d${depth}: ${say(X, s, cert[0])}`);
      if (X.Clock.sealed(s) || s.dept.tiles[2][8] !== ',' || s.dept.tiles[4][8] !== 'S') problems.push(`d${depth}: the hall is still shut`);
      // The hall opened at once, at the tick it fell, not at the next turn boundary.
      const lift = after.find(e => e.k === 'stage' && e.stage === 'unsealed');
      if (!lift || lift.tick !== died.tick) problems.push(`d${depth}: it fell at tick ${died.tick}, and the hall opened ${json(lift)}`);
      // Once: nothing more comes of it, and you can take the piece from beside its tile.
      if (s.ui.pendingChoice) s.ui.pendingChoice = null;
      const more = H.play(X, s, [wait, { a: 'move', dir: 6 }, { a: 'take', uid: it.uid }], { inv: 'all' });
      problems.push(...bad(more, `d${depth} after`));
      if (more.events.some(e => ['certificate', 'dropped', 'phase'].includes(e.k)) || it.where.at !== 'tote') problems.push(`d${depth}: after its fall ${json(more.events.filter(e => e.k !== 'moved'))}`);
    }
    assert.deepEqual(problems, []);
  });

  test('its Signature piece drops to the floor with your tote full: take is refused (tote_full) until you drop something, then taken; a Certificate earned before (a planted view) gives none again, and the piece still drops', () => {
    const K = core(), X = K.X, n = X.N.TOTE_SLOTS;
    const items = Array.from({ length: n }, (_, i) => ({ uid: `t${i + 1}`, kind: 'curio', where: { at: 'tote' } }));
    const s = room(K, 3, { scale: 20, items });
    s.dept.cert = { how: 'view', turn: 0 };
    s.run.certificates.push({ acc: 'T9', depth: 3, how: 'view', turn: 0 });
    let r = H.play(X, s, fight(X), { inv: 'all', clone: true });
    assert.deepEqual(bad(r, 'fight'), []);
    const drop = r.events.find(e => e.k === 'dropped');
    assert.ok(drop, 'nothing dropped');
    assert.equal(r.events.filter(e => e.k === 'certificate').length, 0);
    assert.equal(json(s.items.find(i => i.uid === drop.item).where), json({ at: 'floor', x: 2, y: 2 }));
    assert.equal(s.you.tote.length, n);
    r = H.play(X, s, [{ a: 'move', dir: 7 }, { a: 'take', uid: drop.item }], { inv: 'all' });
    assert.equal(json(r.events.filter(e => e.k === 'refused').map(e => e.reason)), json(['tote_full']));
    r = H.play(X, s, [{ a: 'drop', uid: 't1' }, { a: 'take', uid: drop.item }], { inv: 'all' });
    assert.deepEqual(bad(r, 'take'), []);
    assert.equal(s.items.find(i => i.uid === drop.item).where.at, 'tote');
  });

  test('an ensemble of pieces: phases on their total, a piece\'s fall counted in it; only the last piece\'s fall drops the Signature piece, at the footprint\'s top-left tile, not where it stood, and earns the Certificate', () => {
    const problems = [];
    for (const depth of [1, 4, 7]) {
      const K = core({ still: true, rec: { specials: undefined, pieces: [{ at: [0, 0], specials: ['cp_burst'] }, { at: [1, 0] }, { at: [0, 1] }, { at: [1, 1] }] } }), X = K.X;
      const s = room(K, depth, { you: [4, 4], scale: 15 }), ids = X.Centrepiece.pieces(s).map(a => a.uid);
      // Each piece in turn, in the order placed (the one on the top-left tile first), struck
      // from a tile beside it, stepping toward it when it is not.
      const r = H.play(X, s, (st, i) => {
        if (i > 600) return null;
        const p = X.Centrepiece.pieces(st).find(a => !a.gone), you = st.actors[0], m = st.dept;
        if (!p) return null;
        if (X.Actors.dist(p, you.x, you.y) <= 1) return { a: 'attack', uid: p.uid };
        // A step along a shortest walk to a free tile beside it.
        const free = (x, y) => X.Grid.walkable(m, x, y) && !X.Actors.at(st, x, y, you);
        const goals = [];
        for (let y = p.y - 1; y <= p.y + 1; y++) for (let x = p.x - 1; x <= p.x + 1; x++) if (free(x, y)) goals.push([x, y]);
        const dist = X.Grid.distances(m, goals, 99), here = dist[you.y * m.w + you.x];
        const d = [0, 1, 2, 3, 4, 5, 6, 7].find(k => { const x = you.x + X.Grid.DX[k], y = you.y + X.Grid.DY[k]; return free(x, y) && X.Grid.canStep(m, you.x, you.y, k, 'you') && dist[y * m.w + x] >= 0 && dist[y * m.w + x] < here; });
        return d === undefined ? wait : { a: 'move', dir: d };
      }, { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth}`), ...covered(X, s, r.events).map(l => `d${depth}: ${l}`));
      const deaths = r.events.filter(e => e.k === 'died' && ids.includes(e.who)), ph = r.events.filter(e => e.k === 'phase');
      if (deaths.length !== 4) { problems.push(`d${depth}: ${deaths.length} pieces fell`); continue; }
      // The phases, on the total (the invariant holds each step to it), in order, before the last fall.
      const at = e => r.events.indexOf(e);
      if (ph.length !== 2 || at(ph[1]) > at(deaths[3])) problems.push(`d${depth}: phases ${json(ph.map(e => [e.phase, at(e)]))}, deaths at ${json(deaths.map(at))}`);
      const drops = r.events.filter(e => e.k === 'dropped'), certs = r.events.filter(e => e.k === 'certificate');
      if (drops.length !== 1 || at(drops[0]) < at(deaths[3]) || drops[0].who !== deaths[3].who || drops[0].x !== 2 || drops[0].y !== 2) problems.push(`d${depth}: drops ${json(drops)}`);
      const last = s.actors.find(a => a.uid === deaths[3].who);
      if (last.x === 2 && last.y === 2) problems.push(`d${depth}: the last piece stood on the top-left tile, so this shows nothing of where the piece drops`);
      if (certs.length !== 1 || certs[0].cause.by !== ids[0]) problems.push(`d${depth}: certificates ${json(certs)}`);
    }
    assert.deepEqual(problems, []);
  });

  test('an ensemble split by its hall\'s openings: a piece outside never seals you in alone; struck awake inside, a piece seals you in with it and the others outside are shut out; when the last piece inside falls, the shutters open (alone) and nothing more: no drop, no Certificate; at depths 1, 4 and 7, clone-checked', () => {
    const problems = [];
    for (const depth of [1, 4, 7]) {
      const K = core({ rec: { specials: undefined, pieces: [{ at: [0, 0] }, { at: [1, 0] }, { at: [0, 1] }, { at: [1, 1] }] } }), X = K.X;
      const s = room(K, depth, { you: [2, 1], scale: 12 }), ps = X.Centrepiece.pieces(s), [p1, p2, p3, p4] = ps;
      // Two of its pieces stand in the gallery, held still; one of them hunts you from there:
      // the boundaries pass (two, before your ring wakes those beside you) and the hall does not
      // seal you in alone.
      Object.assign(p3, { x: 10, y: 1 }); Object.assign(p4, { x: 10, y: 5 });
      for (const p of [p3, p4]) X.Status.apply(s, p, 'fixed', 9999, { k: 'planted' }, []);
      X.Wake.wake(s, p3, 'hunting', { k: 'damage', by: 'you' }, []);
      if (p3.mode !== 'hunting') { problems.push(`d${depth}: the piece outside is ${p3.mode}, so this shows nothing`); continue; }
      let r = H.play(X, s, [wait, wait], { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth} outside`));
      if (r.events.some(e => e.k === 'stage') || X.Clock.sealed(s) || p1.mode !== 'dormant') problems.push(`d${depth}: with a piece hunting you from outside: ${json(r.events.filter(e => e.k === 'stage'))}`);
      // Struck, the first wakes hunting you inside: the hall seals for it.
      r = H.play(X, s, [{ a: 'attack', uid: p1.uid }, wait], { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth} seal`), ...covered(X, s, r.events).map(l => `d${depth}: ${l}`));
      const sealed = r.events.filter(e => e.k === 'stage' && e.stage === 'sealed');
      if (sealed.length !== 1 || sealed[0].cause.by !== p1.uid || !X.Clock.sealed(s)) { problems.push(`d${depth}: sealed ${json(sealed)}`); continue; }
      // Both pieces inside struck down; then the shutters open, alone, at the next boundary.
      r = H.play(X, s, (st, i) => {
        if (i > 400) return null;
        const q = [p1, p2].map(p => X.Actors.byUid(st, p.uid)).find(a => !a.gone);
        return q ? { a: 'attack', uid: q.uid } : X.Clock.sealed(st) ? wait : null;
      }, { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth} fight`), ...covered(X, s, r.events).map(l => `d${depth}: ${l}`));
      const lift = r.events.filter(e => e.k === 'stage' && e.stage === 'unsealed'), last = r.events.filter(e => e.k === 'died').pop();
      if (json(lift.map(e => e.cause.why)) !== '["alone"]' || !last || last.who !== p2.uid || lift[0].turn !== Math.floor(last.tick / X.N.TICKS_PER_TURN) + 1) problems.push(`d${depth}: lifted ${json(lift)} after ${json(last)}`);
      if (r.events.some(e => ['dropped', 'certificate'].includes(e.k)) || X.Progress.cert(s)) problems.push(`d${depth}: something came of half its pieces falling`);
      if (lift[0] && say(X, s, lift[0]) !== 'The shutters opened: none of the Centrepiece is left in the hall with you. They do not close again until you have stepped out of the hall.') problems.push(`d${depth}: ${say(X, s, lift[0])}`);
    }
    assert.deepEqual(problems, []);
  });

  test('phases never go back: a Re-admission Ticket heals it past its threshold and it stays in its phase, struck again it says nothing more; one blow past both thresholds gives phase 2 then phase 3, in that order (planted: Combat.hurt called directly)', () => {
    const K = core(), X = K.X, s = room(K, 3, { scale: 100 }), uid = s.actors[1].uid;
    X.Consumables.startRun(s);
    const tk = X.Consumables.make(s, 'ticket', { at: 'tote' });
    s.run.knownSeals.push(X.Consumables.sealFor(s, 'ticket'));
    let r = H.play(X, s, (st, i) => i < 300 && st.actors[1].hp > 60 ? { a: 'attack', uid } : null, { inv: 'all', clone: true });
    assert.deepEqual(bad(r, 'down'), []);
    assert.equal(X.Centrepiece.phase(s), 2);
    assert.ok(X.Clock.sealed(s), 'the hall did not seal');
    r = H.play(X, s, [{ a: 'use', uid: tk.uid }], { inv: 'all', clone: true });
    assert.deepEqual(bad(r, 'ticket'), []);
    assert.ok(s.actors[1].hp > 67, `the Ticket healed it to ${s.actors[1].hp}`);
    assert.equal(X.Centrepiece.phase(s), 2);
    assert.equal(r.events.filter(e => e.k === 'phase').length, 0);
    // A planted blow straight to it from beyond 67% to 34% or below.
    const L = core(), Y = L.X, t = room(L, 3, { scale: 100 }), p = t.actors[1], ev = [];
    Y.Combat.hurt(t, p, 70, { k: 'attack', by: 'you', at: p.uid, chance: 100, raw: 70, pad: 0, how: { kind: 'melee' }, from: [4, 3] }, ev);
    assert.equal(json(ev.filter(e => e.k === 'phase').map(e => [e.phase, e.gained || null])), json([[2, 'ring'], [3, null]]));
    assert.equal(json(p.ax.specials), json(['cp_burst', 'ring']));
    assert.equal(Y.Specials.cadence(t, p), Y.N.CP_SPECIAL_EVERY[1]);
    Y.Health.heal(t, p, 100, { k: 'hall', why: 'ticket' }, ev);
    assert.equal(Y.Centrepiece.phase(t), 3);
    assert.equal(Y.Centrepiece.advance(t, 2, { k: 'damaged' }, ev), false);
    // A piece's fall counts in the total (planted blows): four pieces of 25, the first falls
    // (75 left, phase 1), the second falls (50 left: phase 2, in the step it fell, after it).
    const E = core({ rec: { specials: undefined, pieces: [{ at: [0, 0] }, { at: [1, 0] }, { at: [0, 1] }, { at: [1, 1] }] } }), u = room(E, 3, { scale: 25 });
    const blow = (q, n) => { const e = []; E.X.Combat.hurt(u, q, n, { k: 'attack', by: 'you', at: q.uid, chance: 100, raw: n, pad: 0, how: { kind: 'melee' }, from: [4, 3] }, e); return e; };
    const [q1, q2] = E.X.Centrepiece.pieces(u);
    assert.equal(blow(q1, 25).filter(e => e.k === 'phase').length, 0);
    const fell = blow(q2, 25), died = fell.findIndex(e => e.k === 'died'), ph2 = fell.findIndex(e => e.k === 'phase');
    assert.ok(died >= 0 && ph2 > died && fell[ph2].phase === 2 && fell[ph2].who === E.X.Centrepiece.pieces(u)[2].uid, json(fell));
    // The thresholds, at and just above: health at a threshold is the next phase's.
    for (const max of [45, 60, 101, 195]) for (const [i, p] of Y.N.CP_PHASE_PCT.entries()) {
      const at = Math.floor(max * p / 100);
      assert.equal(Y.Centrepiece.phaseFor(at, max), i + 2, `${at} of ${max}`);
      assert.equal(Y.Centrepiece.phaseFor(at + 1, max), i + 1, `${at + 1} of ${max}`);
    }
  });

  test('a treasure\'s guardian, joined up: struck down in its sealed hall, the shutters open (why treasure) and nothing else: no Signature piece, no Certificate, your grade as it was; its line says killing it earns nothing; at depths 1–7, clone-checked', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      // (It names its Signature piece, its treasure, which its own rules would judge: its fall drops none.)
      const K = core({ rec: { form: 'treasure' } }), X = K.X, s = room(K, depth, { scale: 30 }), grade = s.run.grade;
      const r = H.play(X, s, fight(X), { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth}`), ...covered(X, s, r.events).map(l => `d${depth}: ${l}`));
      if (!r.events.some(e => e.k === 'stage' && e.stage === 'sealed')) problems.push(`d${depth}: its hall never sealed`);
      const died = r.events.find(e => e.k === 'died' && e.who === s.actors[1].uid);
      if (!died) { problems.push(`d${depth}: it never fell`); continue; }
      // (Its own pending mark is called off as it dies: special, cancelled.)
      const after = r.events.slice(r.events.indexOf(died) + 1).filter(e => !['noise', 'pip', 'regenerated'].includes(e.k) && !(e.k === 'special' && e.cancelled)).map(e => e.k + (e.k === 'stage' ? ':' + e.stage + ':' + e.cause.why : ''));
      if (json(after) !== json(['stage:unsealed:treasure'])) problems.push(`d${depth}: after its fall ${json(after)}`);
      if (s.items.some(i => i.ref === 'T9.11') || X.Progress.cert(s) || s.run.grade !== grade || s.run.certificates.length) problems.push(`d${depth}: it gave something`);
    }
    const K = core({ rec: { form: 'treasure', signature: undefined } });
    for (const d of DEPTHS) assert.match(K.X.Clauses.line(K.rec, { depth: d }), /Its second phase starts at 67% of its full health or less, its third at 34%, for good\. Killing it opens its hall but earns nothing: carry the treasure it guards out of the hall\. /);
    for (const d of DEPTHS) for (const k of [1, 2, 3]) assert.match(K.X.Clauses.strip(K.rec, { depth: d, phase: k }), new RegExp(`^Phase ${k} of 3\\. Killing it earns nothing: carry the Lamp out\\. `));
    assert.deepEqual(problems, []);
  });

  // ---- Its line and the burst ----

  test('every Centrepiece\'s line says its form\'s rule (\'CLAUSES.cp_fight\' or \'CLAUSES.cp_treasure\'), after its archetype\'s, and every phase\'s strip its short sentence; the burst (\'cp_burst\') reads its gross, and its readout names it with its tiles and its cadence', () => {
    const C = loadCore(), R = C.Registry;
    for (const p of C.Packs.list()) for (const d of DEPTHS) {
      const parts = C.Clauses.of(p.centrepiece, { depth: d }), id = 'cp_' + p.centrepiece.form;
      assert.equal(json(parts.filter(q => q.id.startsWith('cp_') && q.kind === 'clause').map(q => q.id)), json([id]), `${p.acc} d${d}`);
      assert.ok(C.Clauses.line(p.centrepiece, { depth: d }).includes(parts.find(q => q.id === id).text), `${p.acc} d${d}`);
    }
    const K = core(), X = K.X, g = d => X.Specials.cpGross('ROLE_CENTREPIECE_SPECIAL_PCT', d);
    for (const d of DEPTHS) {
      const line = X.Clauses.line(K.rec, { depth: d });
      assert.equal(line, `Walks a tile at a time and strikes from beside you for ${X.Roles.stats('centrepiece', d).dmin}–${X.Roles.stats('centrepiece', d).dmax}. Its second phase starts at 67% of its full health or less, its third at 34%, for good. Hunting you in its hall, it seals you in with it once no one stands in an opening. Its fall drops its Signature piece where it first stood and earns the Certificate, unless you have it. `
        + `Marks your tile and the tiles round it while it sees you, then strikes everything on them for ${g(d)} before Padding. From phase 2: marks the tiles round it for a turn, then strikes everything on them for ${X.Roles.at(X.N.ROLE_WARDEN_SPECIAL, d)} before Padding. Wakes when you stay inside your ring or make noise near it.`);
      // Its strip (FU1): in every phase, the phase, the form's short sentence, what that phase
      // itself adds, and the rest on its label.
      const own = [`Marks your tile and the tiles round it while it sees you, then strikes everything on them for ${g(d)} before Padding.`, `Marks the tiles round it for a turn, then strikes everything on them for ${X.Roles.at(X.N.ROLE_WARDEN_SPECIAL, d)} before Padding.`, null];
      for (const k of [1, 2, 3]) assert.equal(X.Clauses.strip(K.rec, { depth: d, phase: k }), [`Phase ${k} of 3.`, 'Its fall earns the Certificate, unless you have it.', own[k - 1], 'Its label has the rest.'].filter(Boolean).join(' '), `phase ${k}`);
    }
    assert.equal(json([R.SPECIALS.cp_burst.shape, R.SPECIALS.cp_burst.curve, R.CLAUSES.cp_fight.covers, R.CLAUSES.cp_treasure.covers]), json(['burst', 'cp:ROLE_CENTREPIECE_SPECIAL_PCT', ['phase', 'stage', 'dropped', 'certificate'], ['phase']]));
    // Its readout, beside it while it hunts: the burst by name, where it strikes, and how often.
    const s = room(K, 4, { you: [4, 3] });
    s.actors[1].mode = 'hunting';
    const odds = X.Labels.of(s, s.actors[1].uid).odds, net = Math.max(X.N.DMG_MIN_ON_HIT, g(4) - s.actors[0].pad);
    assert.ok(odds.includes(`Its burst would deal you ${net} (${g(4)} before your Padding), with no roll, on your tile and the tiles round it, at most one action in ${X.N.CP_SPECIAL_EVERY[0]}.`), json(odds));
  });

  // ---- The wake: pips and damage only ----

  const OPEN = ['################', '#..............#', '#..............#', '#..............#', '#..............#', '#..............#', '################'];
  const HALL_ALL = [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 14, y1: 5 }];
  test('it wakes from pips and damage: your ring\'s pips and a blow each wake it; a herald\'s call, the night-watch bell and the alarm pass over it while they wake sleepers beside it; at depths 1–7', () => {
    const problems = [];
    const sleeper = at => ({ sp: 'dummy', at, mode: 'dormant', stats: TOUGH });
    for (const depth of DEPTHS) {
      // Pips: you stand beside it until it wakes.
      let K = core(), X = K.X, s = room(K, depth, { map: OPEN, rooms: HALL_ALL, fixtures: [], you: [5, 3] });
      let r = H.play(X, s, (st, i) => i < 10 && st.actors[1].mode === 'dormant' ? wait : null, { inv: 'all' });
      problems.push(...bad(r, `d${depth} ring`));
      const w = r.events.find(e => e.k === 'woke' && e.who === s.actors[1].uid);
      if (!w || w.cause.k !== 'ring') problems.push(`d${depth}: your ring woke it by ${json(w && w.cause)}`);
      // The call: a herald awake at (9,1) sees you at (8,3); the sleeper at (12,5) and it are in range.
      K = core(); X = K.X;
      const herald = X.Packs.species('S9', 'S9.3');
      s = room(K, depth, { map: OPEN, rooms: HALL_ALL, fixtures: [], you: [8, 3], more: [{ sp: 'S9.3', at: [9, 1], mode: 'awake', stats: X.Roles.stats(herald.role, depth) }, sleeper([12, 5])] });
      r = H.play(X, s, [wait, wait], { inv: 'all' });
      problems.push(...bad(r, `d${depth} call`));
      const called = r.events.filter(e => e.k === 'woke' && e.cause.k === 'herald').map(e => e.who), piece = X.Centrepiece.pieces(s)[0];
      if (json(called) !== json([s.actors[2].uid]) || piece.mode !== 'dormant') problems.push(`d${depth}: the call woke ${json(called)}; the Centrepiece is ${piece.mode}`);
      if (!X.Grid.disc(3 - 9, 2 - 1, X.N.HERALD_RANGE)) problems.push('the Centrepiece is out of the call\'s range, so this shows nothing');
      // The bell: it is the sleeper nearest you, and the bell wakes the next three instead.
      K = core(); X = K.X;
      s = room(K, depth, { map: OPEN, rooms: HALL_ALL, fixtures: [], you: [7, 3], clock: { B: 1, G: 1, count: 1 + 1 + X.N.NIGHT_WAKE_EVERY - 1 }, more: [sleeper([12, 1]), sleeper([13, 3]), sleeper([12, 5]), sleeper([14, 5])] });
      r = H.play(X, s, [wait], { inv: 'all' });
      problems.push(...bad(r, `d${depth} bell`));
      const bell = r.events.find(e => e.k === 'stage' && e.stage === 'night_bell'), cp = X.Centrepiece.pieces(s)[0];
      // It is the sleeper nearest you; the bell wakes the next NIGHT_WAKE_COUNT, the dummies, instead.
      const near = [1, 2, 3, 4].map(i => s.actors[i].uid).filter(u => u !== s.actors[4].uid);
      if (!bell || json(bell.woke.slice().sort()) !== json(near.slice().sort()) || cp.mode !== 'dormant' || near.length !== X.N.NIGHT_WAKE_COUNT) problems.push(`d${depth}: the bell ${json(bell)}; the Centrepiece is ${cp.mode}`);
      // The alarm (MOD-ALARM): its call wakes every sleeper that can hear but a Centrepiece's piece.
      K = core(); X = K.X;
      if (X.Modules.defined('alarm_network')) {
        s = room(K, depth, { map: OPEN, rooms: HALL_ALL, fixtures: [], you: [8, 3], more: [sleeper([12, 5]), { sp: 'dummy', at: [10, 1], mode: 'awake', stats: TOUGH }] });
        X.Modules.init(s, { acc: 'T9', modules: [{ id: 'alarm_network', role: 'signature', params: {} }] });
        const [, asleep, caller, cp] = s.actors, ev = [], n = X.AlarmNetwork.call(s, caller, ev);
        if (n < 1 || asleep.mode === 'dormant' || cp.mode !== 'dormant' || cp.role !== 'centrepiece') problems.push(`d${depth}: the alarm woke ${n}; the Centrepiece is ${cp.mode}`);
      } else if (typeof X.AlarmNetwork !== 'undefined') problems.push('AlarmNetwork exists, but its module is not defined');
    }
    assert.deepEqual(problems, []);
  });

  test('the invariants catch what they guard (planted): a phase gone back, a phase with no event, a mark that deals other than it showed, a treasure that drops its piece, a Certificate by defeat with no fall, a piece woken by the bell', () => {
    const X = loadCore(), invs = require('./centrepiece.inv.js')(X), by = id => invs.find(i => i.id === id);
    const K = core(), s = room(K, 3, { scale: 60 }), pre = K.X.State.clone(s), uid = s.actors[1].uid;
    s.actors[1].ax.phase = 2;
    assert.match(by('centrepiece.phase').check(pre, [], s), /phase events say \[\]/);
    const post = K.X.State.clone(s), back = K.X.State.clone(s);
    back.actors[1].ax.phase = 1;
    assert.match(by('centrepiece.phase').check(post, [], back), /went back/);
    const low = K.X.State.clone(pre);
    low.actors[1].hp = 10;
    assert.match(by('centrepiece.phase').check(pre, [], low), /its health gives phase 3/);
    assert.match(by('centrepiece.marks').check(pre, [{ k: 'damaged', who: 'you', amount: 5, hp: 994, cause: { k: 'special', by: uid, sp: 'cp_burst', x: 4, y: 3 } }], s), /did not show/);
    const t = room(core({ rec: { form: 'treasure', signature: undefined } }), 3), tp = K.X.State.clone(t);
    t.actors[1].gone = 1;
    assert.match(by('centrepiece.fall').check(tp, [{ k: 'died', who: t.actors[1].uid }, { k: 'dropped', who: t.actors[1].uid, item: 'x', cause: { k: 'defeated' } }], t), /killing it earns nothing/);
    assert.match(by('centrepiece.fall').check(pre, [{ k: 'certificate', acc: 'T9', how: 'defeat', cause: { k: 'defeat', by: uid } }], s), /did not fall/);
    assert.match(by('centrepiece.sleep').check(pre, [{ k: 'woke', who: uid, cause: { k: 'night_bell' } }], s), /woke by night_bell/);
  });
};
