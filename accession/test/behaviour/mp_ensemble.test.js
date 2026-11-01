// ACCESSION — A.4's Centrepiece, the Ordinance (mp_ensemble; BUILD.md §5.3, §5.4, §5.5, §8.1,
// §8.7; M4 plan A8, D3.3, Q8, decided without play; revisit once M4 is playable): its record
// (content/A4-cp.js), its core (rules/arch/mp_ensemble.js) and its line. Its core stays at
// ready false, so no department places it: these tests place the real record with
// Centrepiece.place in a room with a hall (the harness's rooms), with A.4's modules running
// (Modules.init, as a department does), every invariant checked after every step
// (centrepiece.inv.js and copies.inv.js among them), the main runs clone-checked. What each
// test expects is worked out here from BUILD's sentences, not from the code:
//   - four one-tile pieces on its footprint, the signed original first, on its top-left tile,
//     then copies a, b and c; each holds its own share of the role's health (an equal whole
//     share, the original also the rest); copies a and b carry the burst; none ever steps;
//   - which is the original: its label's title and number say so, and the board draws it
//     with its own sprite; every piece's line says the rule;
//   - the original first: its fall, with copies_weaken on, weakens and slows each copy
//     (§5.4's numbers) and with the module off changes nothing; a copy's fall weakens no one;
//   - per-piece health in the odds: each piece's readout counts its own health;
//   - phases on the total, never going back (a conservator's restore does not undo one);
//     phase 2's burst going to its first piece still standing; its phase sentence naming
//     that piece only when you see it;
//   - marks equal damage: every burst that strikes you deals what its mark showed;
//   - its strip within the budget in every phase (m4-lines' model), its line at length on
//     its label;
//   - a view names a piece still standing.
'use strict';
const H = require('./_harness.js');

module.exports = ({ test, assert, loadCore, root, path }) => {
  const json = JSON.stringify;
  const DEPTHS = H.DEPTHS;
  const B = require(path.join(root, 'tools/battery.js'));
  const LINES = require(path.join(root, 'test/m4-lines.test.js'));
  const C = loadCore(), { N, Int, Roles } = C;
  const WAIT = { a: 'wait' };
  // The hall (x 1–7, y 1–5) and a gallery east of it (x 9–11), joined by an archway (8,2) and a
  // staff door (8,4); the footprint's top-left tile (2,2): the original stands on (2,2), copy a
  // on (3,2), copy b on (2,3), copy c on (3,3).
  const MAP = ['#############', '#.......#...#', '#.......,...#', '#.......#...#', '#.......S...#', '#.......#...#', '#############'];
  const ROOMS = [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 7, y1: 5 }, { key: 's1', role: 'section', x0: 9, y0: 1, x1: 11, y1: 5 }];
  const AT = [2, 2], TILES = [[2, 2], [3, 2], [2, 3], [3, 3]], IDS = ['A4.12', 'A4.12a', 'A4.12b', 'A4.12c'];
  const COPY = ['a', 'b', 'c'];
  // §5.4: a number of a spare that loses heart loses COPY_WEAKEN_PCT% of itself, at least 1,
  // never below 1.
  const lose = v => v > 1 ? Math.max(1, v - Math.max(1, Int.pct(v, N.COPY_WEAKEN_PCT))) : v;
  const span = (lo, hi) => lo === hi ? String(lo) : `${lo}–${hi}`;
  const gross = d => C.Specials.cpGross('ROLE_CENTREPIECE_SPECIAL_PCT', d);

  // A room with the hall, the Ordinance placed on its footprint (Centrepiece.place) and A.4's
  // modules running (Modules.init). o: you ([1, 2], beside the original), map, more exhibits,
  // items, options (rulesOff), core (X).
  function room(depth, o) {
    o = o || {};
    const X = o.core || C, s = H.room(X, o.seed || 1, { acc: 'A4', depth, map: o.map || MAP, you: o.you || [1, 2], exhibits: o.more || [], rooms: o.rooms || ROOMS,
      clock: { B: 300, G: 60 }, entrance: [11, 3], fixtures: o.fixtures || [{ k: 'staff', x: 8, y: 4, grade: 1 }], items: o.items || [] }, o.options || {});
    s.actors[0].maxHp = 999; s.actors[0].hp = 999;
    const pack = X.Packs.get('A4');
    X.Centrepiece.place(s, { cpl: AT }, pack);
    if (o.lectern) { s.dept.lectern = o.lectern.slice(); s.dept.viewTile = o.read.slice(); X.Viewing.place(s); }
    X.Modules.init(s, pack);
    return s;
  }
  const pieces = (X, s) => X.Centrepiece.pieces(s);
  const bad = (r, tag) => r.violations.map(v => `${tag}: ${v.id}: ${v.text}`);
  const say = (X, s, e) => X.Text.event(e, X.Labels.nameOf(s));
  const numbers = a => ({ maxHp: a.maxHp, hp: a.hp, dmin: a.dmin, dmax: a.dmax, acc: a.acc });
  // A blow straight to a piece (Combat.hurt, as your blow lands), for a planted state.
  const blow = (X, s, a, n) => { const ev = []; X.Combat.hurt(s, a, n, { k: 'attack', by: 'you', at: a.uid, chance: 100, raw: n, pad: 0, how: { kind: 'melee' }, from: [s.actors[0].x, s.actors[0].y] }, ev); return ev; };
  // Every event a piece caused is one its own line allows it (the soak's completeness, B.causer):
  // the universal kinds and its line's covers, its line read from its own species
  // (Packs.speciesFor: the piece's) with the visit's rules off.
  function covered(X, s, events) {
    const out = [], rulesOff = (s.options && s.options.rulesOff) || [];
    for (const e of events) {
      const by = B.causer(e), a = by && s.dept.cp.uids.includes(by) ? X.Actors.byUid(s, by) : null;
      if (!a) continue;
      const allow = new Set(X.Clauses.UNIVERSAL);
      for (const p of X.Clauses.of(X.Packs.speciesFor(s, a), { depth: s.dept.depth, rulesOff })) for (const k of p.covers) allow.add(k);
      if (!allow.has(e.k)) out.push(`${by} caused ${e.k}, which its line does not cover`);
    }
    return out;
  }
  // Strike the first piece of `order` (uids) still standing, from a tile beside it, stepping
  // along a shortest walk to a free tile beside it when you are not; null once none stands.
  const fightIn = (X, order, cap) => (st, i) => {
    if (i > (cap || 600)) return null;
    const p = order.map(u => X.Actors.byUid(st, u)).find(a => a && !a.gone), you = st.actors[0], m = st.dept;
    if (!p) return null;
    if (X.Actors.dist(p, you.x, you.y) <= 1) return { a: 'attack', uid: p.uid };
    const free = (x, y) => X.Grid.walkable(m, x, y) && !X.Actors.at(st, x, y, you);
    const goals = [];
    for (let y = p.y - 1; y <= p.y + 1; y++) for (let x = p.x - 1; x <= p.x + 1; x++) if (free(x, y)) goals.push([x, y]);
    const dist = X.Grid.distances(m, goals, 99), here = dist[you.y * m.w + you.x];
    const d = [0, 1, 2, 3, 4, 5, 6, 7].find(k => { const x = you.x + X.Grid.DX[k], y = you.y + X.Grid.DY[k]; return free(x, y) && X.Grid.canStep(m, you.x, you.y, k, 'you') && dist[y * m.w + x] >= 0 && dist[y * m.w + x] < here; });
    return d === undefined ? WAIT : { a: 'move', dir: d };
  };

  // ---- Its record and its placement ----

  test('its record (content/A4-cp.js): ENSEMBLE_PIECES one-tile pieces on its 2×2 footprint, the signed original first on the top-left tile, then copies a, b and c, copies a and b with the burst; phase 2 gives the burst; a fight whose Signature piece is the Repealing Pen; flagged with copies_weaken; its core at ready false, so no department of the game places it', () => {
    const pack = C.Packs.get('A4'), rec = pack.centrepiece;
    C.Centrepiece.check(rec, pack);
    assert.equal(rec.pieces.length, N.ENSEMBLE_PIECES);
    assert.equal(json(rec.pieces.map(p => [p.id, p.at, p.specials || [], p.sprite])), json([['A4.12', [0, 0], [], 'ordinance_original'], ['A4.12a', [1, 0], ['cp_burst'], 'ordinance_copy'],
      ['A4.12b', [0, 1], ['cp_burst'], 'ordinance_copy'], ['A4.12c', [1, 1], [], 'ordinance_copy']]));
    assert.equal(json([rec.id, rec.archetype, rec.role, rec.form, rec.size, rec.signature, rec.flags, rec.phases]),
      json(['A4.12', 'mp_ensemble', 'centrepiece', 'fight', 2, 'A4.11', ['copies_weaken'], [{ parts: ['CLAUSES.ens_burst'] }, { parts: ['CLAUSES.ens_gain'], specials: ['cp_burst'] }, {}]]));
    assert.ok(typeof rec.gateway === 'string' && rec.gateway.split(/\s+/).length >= 40 && rec.gateway.split(/\s+/).length <= 120, 'its gateway label is 40–120 words (D3.8)');
    assert.equal(C.Registry.ARCHETYPES.mp_ensemble.ready, false);
    assert.equal(C.Populate.ready(rec), false);
    assert.ok(C.Centrepiece.wired('mp_ensemble'), 'its core is added with the shared rules');
    for (const depth of [1, 4, 7]) for (const seed of [1, 2]) assert.equal(C.Hall.cp(C.Dept.create(seed, 'A4', depth)), null, `A4 seed ${seed} depth ${depth} placed its Centrepiece`);
  });

  test('placed, at depths 1–7: four exhibits of the role centrepiece on its footprint, asleep, each its own share of the role\'s health (an equal whole share, the original the rest too), copies a and b with the burst, phase 1; the copies the original\'s spares (CopiesWeaken.addGroup); nothing drawn; and a department places it so once its core is planted ready', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const s = room(depth), ps = pieces(C, s), role = Roles.stats('centrepiece', depth), share = Math.floor(role.hp / N.ENSEMBLE_PIECES);
      const want = IDS.map((id, i) => [`A4.${depth}.centre.${i + 1}`, id, TILES[i][0], TILES[i][1], 1, 'mp_ensemble', 'centrepiece', 'dormant', i ? share : role.hp - 3 * share,
        i === 1 || i === 2 ? ['cp_burst'] : [], 1, i ? `A4.${depth}.centre.1` : null]);
      const got = ps.map(a => [a.uid, a.sp, a.x, a.y, a.size, a.arch, a.role, a.mode, a.maxHp, a.ax.specials, a.ax.phase, a.ax.copyOf || null]);
      if (json(got) !== json(want)) problems.push(`d${depth}: ${json(got)}`);
      if (ps.reduce((n, a) => n + a.maxHp, 0) !== role.hp || ps.some(a => a.hp !== a.maxHp)) problems.push(`d${depth}: the shares are not the role's ${role.hp}`);
      for (const k of ['acc', 'eva', 'pad', 'dmin', 'dmax']) if (ps.some(a => a[k] !== role[k])) problems.push(`d${depth}: a piece's ${k} is not the role's`);
      if (json(s.dept.cp.gains) !== json([null, 'cp_burst', null]) || json(s.dept.cp.at) !== json(AT) || s.dept.cp.signature !== 'A4.11') problems.push(`d${depth}: dept.cp ${json(s.dept.cp)}`);
      if (json(ps.slice(1).map(a => C.CopiesWeaken.originalOf(s, a))) !== json([ps[0].uid, ps[0].uid, ps[0].uid]) || C.CopiesWeaken.originalOf(s, ps[0]) !== null) problems.push(`d${depth}: the copy group`);
      if (json(s.rng) !== '{}') problems.push(`d${depth}: placing it drew on ${json(Object.keys(s.rng))}`);
    }
    // Planted ready, a department places it on the plan's footprint, its copies the original's.
    const X = loadCore();
    X.Registry.ARCHETYPES.mp_ensemble.ready = 'unit';
    for (const seed of [1, 2]) {
      const s = X.Dept.create(seed, 'A4', 3), cpl = X.Layout.generate('case_labyrinth', 0, seed, { acc: 'A4', depth: 3 }).plan.cpl, ps = pieces(X, s);
      if (json(ps.map(a => [a.sp, a.x - cpl[0], a.y - cpl[1]])) !== json(IDS.map((id, i) => [id, TILES[i][0] - 2, TILES[i][1] - 2]))) problems.push(`A4 seed ${seed}: placed ${json(ps.map(a => [a.sp, a.x, a.y]))} at ${cpl}`);
      if (ps.slice(1).some(a => X.CopiesWeaken.originalOf(s, a) !== ps[0].uid) || !X.CopiesWeaken.of(s)) problems.push(`A4 seed ${seed}: its group, or the module`);
    }
    assert.deepEqual(problems, []);
  });

  // ---- Which piece is the original ----

  test('which piece is the original: its label\'s title and number say so (A.4.12, no letter; the copies A.4.12a–c, Certified Copy a–c), its tombstone and paragraph too, and the board draws it with its own sprite; every piece\'s line is the Ordinance\'s and says which is the original', () => {
    const s = room(4), ps = pieces(C, s), vm = C.ViewModel.derive(s, {});
    const titles = ['The Duplicate Ordinance, Signed Original', 'The Duplicate Ordinance, Certified Copy a', 'The Duplicate Ordinance, Certified Copy b', 'The Duplicate Ordinance, Certified Copy c'];
    const line = C.Clauses.line(C.Packs.get('A4').centrepiece, { depth: 4, modules: C.Modules.active(s) });
    ps.forEach((a, i) => {
      const l = C.Labels.of(s, a.uid);
      assert.equal(json([l.title, l.number]), json([titles[i], ['A.4.12', 'A.4.12a', 'A.4.12b', 'A.4.12c'][i]]), a.uid);
      assert.ok(i ? /CERTIFIED TRUE COPY/.test(l.tomb.medium) && /typing pool, after A\.4\.12/.test(l.tomb.maker) : /signed/.test(l.tomb.medium) && !/COPY/.test(l.tomb.medium), `${a.uid}: ${l.tomb.medium}`);
      assert.ok(i ? /Certified copy/.test(l.paragraph) : /Its number has no letter/.test(l.paragraph), `${a.uid}: ${l.paragraph}`);
      // A label as any species' (§5.2): every tombstone field, and a paragraph of 40–70 words.
      const words = l.paragraph.split(/\s+/).length;
      assert.ok(['maker', 'date', 'medium', 'dims', 'credit'].every(k => l.tomb[k]) && words >= 40 && words <= 70, `${a.uid}: ${words} words`);
      assert.equal(l.behaviour, line, a.uid);
      assert.equal(vm.actors.find(v => v.uid === a.uid).sprite, i ? 'ordinance_copy' : 'ordinance_original', a.uid);
      assert.equal(C.Labels.nameOf(s)(a.uid), titles[i].replace(/^The /, 'the '));
    });
    assert.ok(line.includes('The original’s number has no letter; its copies, its spares, have one.'), line);
    // The Centrepiece as a whole keeps its own name, which its gateway label (the lectern) speaks for.
    assert.equal(C.Packs.get('A4').centrepiece.name, 'The Duplicate Ordinance, With Its Three Certified Copies');
    // The board draws the original and a copy differently.
    const art = name => require('node:fs').readFileSync(path.join(root, 'art/sprites', name + '.txt'), 'utf8').split('\n').filter(r => !r.startsWith('#'));
    assert.notEqual(json(art('ordinance_original')), json(art('ordinance_copy')));
  });

  // ---- Its line and its strip ----

  // Its whole line at a depth, from BUILD's sentences: §5.5's Ordinance, §5.3's form rule
  // (cp_fight), §5.4's copies part (module on), its phase parts and the wake clause.
  function wantLine(d, on) {
    const r = Roles.stats('centrepiece', d), dmg = span(r.dmin, r.dmax), weak = span(lose(r.dmin), lose(r.dmax));
    return [`Its ${N.ENSEMBLE_PIECES} pieces stand fixed, each striking from beside you for ${dmg} and holding its own equal whole share of its ${r.hp} health, the original also any left over.`,
      'The original’s number has no letter; its copies, its spares, have one.',
      'Its phases count all its pieces’ health, and their full health, together.',
      `Its second phase starts at ${N.CP_PHASE_PCT[0]}% of its full health or less, its third at ${N.CP_PHASE_PCT[1]}%, for good.`,
      'Hunting you in its hall, it seals you in with it once no one stands in an opening.',
      'Its fall drops its Signature piece where it first stood and earns the Certificate, unless you have it.',
      ...(on ? [`When its group’s original is destroyed, each spare loses ${N.COPY_WEAKEN_PCT}% of its health and damage, never its last point (blows then ${weak}), and ${N.COPY_WEAKEN_ACC} Acc, and is slowed until you leave.`] : []),
      `Copies a and b each mark your tile and the tiles round it while they see you, then strike everything on them for ${gross(d)} before Padding.`,
      'From phase 2: its first piece standing as the phase begins, the original or else the first copy left by letter, has the burst too.',
      'Wakes when you stay inside your ring or make noise near it.'].join(' ');
  }
  const FIGHT = 'Its fall earns the Certificate, unless you have it.', REST = 'Its label has the rest.';
  const wantStrip = (d, k) => [`Phase ${k} of 3.`, FIGHT,
    ...(k === 1 ? [`Copies a and b each mark your tile and the tiles round it while they see you, then strike everything on them for ${gross(d)} before Padding.`]
      : k === 2 ? ['Its first piece standing as the phase begins, the original or else the first copy left by letter, has the burst too.'] : []), REST].join(' ');

  test('its line (\'ARCHETYPES.mp_ensemble\', \'CLAUSES.ens_burst\', \'CLAUSES.ens_gain\', with \'MODULES.copies_weaken\' while on) says each piece\'s share, that its phases count its health together, the copies rule and where phase 2\'s special goes; its strip, in every phase, its phase\'s own part within the budget (m4-lines\' model), module on and off, at depths 1–7; a planted long part fails in its own phase alone', () => {
    const rec = C.Packs.get('A4').centrepiece, problems = [];
    for (const d of DEPTHS) {
      if (C.Clauses.line(rec, { depth: d }) !== wantLine(d, true)) problems.push(`d${d} on: ${C.Clauses.line(rec, { depth: d })}`);
      if (C.Clauses.line(rec, { depth: d, rulesOff: ['copies_weaken'] }) !== wantLine(d, false)) problems.push(`d${d} off: ${C.Clauses.line(rec, { depth: d, rulesOff: ['copies_weaken'] })}`);
      for (const k of [1, 2, 3]) for (const off of [[], ['copies_weaken']]) {
        const t = C.Clauses.strip(rec, { depth: d, phase: k, rulesOff: off });
        if (t !== wantStrip(d, k)) problems.push(`d${d} phase ${k}: ${t}`);
        if (LINES.rows(t) > LINES.METRICS.budgetRows) problems.push(`d${d} phase ${k}: ${LINES.rows(t)} rows`);
      }
    }
    // The whole line is long (the label scrolls, FU1): more rows than the strip's budget.
    assert.ok(LINES.rows(C.Clauses.line(rec, { depth: 7 })) > LINES.METRICS.budgetRows);
    // Its words: no digit outside a parameter, each a sentence or a phase's continuation.
    const R = C.Registry;
    for (const [t, id] of [['ARCHETYPES', 'mp_ensemble'], ['CLAUSES', 'ens_burst'], ['CLAUSES', 'ens_gain']]) {
      const cl = R[t][id].clause;
      if (/[0-9]/.test(cl.replace(/\{[^}]*\}/g, ''))) problems.push(`${t}.${id}: a digit outside a parameter`);
      if (t === 'ARCHETYPES' ? !/^[A-Z].*\.$/.test(cl) : /^[A-Z]|\.$/.test(cl)) problems.push(`${t}.${id}: "${cl}"`);
    }
    // A planted long phase-2 part: its strip fails in phase 2 alone.
    const X = loadCore(), cp = X.Packs.get('A4').centrepiece;
    X.Registry.define('CLAUSES', 'planted_long', { built: 'M4', clause: Array(20).fill('it strikes every tile of its hall').join(', '), params: {}, covers: [] });
    cp.phases = [cp.phases[0], { parts: ['CLAUSES.planted_long'], specials: ['cp_burst'] }, {}];
    assert.equal(json([1, 2, 3].map(k => LINES.rows(X.Clauses.strip(cp, { depth: 4, phase: k })) > LINES.METRICS.budgetRows)), '[false,true,false]');
    assert.deepEqual(problems, []);
  });

  // ---- The original first ----

  // Strike the original down first, then the copies in turn, from beside each, at a depth:
  // with the module on, its fall weakens and slows each copy (§5.4); with it off, nothing.
  // Returns {r, s, snaps, problems}: problems, what the rules said and the run did not.
  function originalFirst(depth, opts) {
    const s = room(depth, { options: opts }), ps = pieces(C, s), ids = ps.map(a => a.uid), [o, ...copies] = ps, snaps = [];
    const plan = fightIn(C, ids);
    const r = H.play(C, s, (st, i, x) => { snaps[i] = copies.map(a => numbers(C.Actors.byUid(st, a.uid))); return plan(st, i, x); }, { inv: 'all', clone: true, cap: 900 });
    const problems = [...bad(r, `d${depth}`), ...covered(C, s, r.events).map(l => `d${depth}: ${l}`)];
    const tag = `d${depth}${opts && opts.rulesOff ? ' off' : ''}`;
    // (A copy struck by another's burst, which strikes everything on its tiles, may fall before
    // its turn in the order: the original falls first, and all four fall.)
    const deaths = r.events.filter(e => e.k === 'died' && ids.includes(e.who)).map(e => e.who);
    if (deaths[0] !== o.uid || json(deaths.slice().sort()) !== json(ids.slice().sort())) { problems.push(`${tag}: the pieces fell ${json(deaths)}`); return { r, s, problems }; }
    if (r.events.some(e => e.k === 'moved' && ids.includes(e.who))) problems.push(`${tag}: a piece moved`);
    // The step of the original's fall.
    const k = r.steps.findIndex(st => st.events.some(e => e.k === 'died' && e.who === o.uid)), ev = r.steps[k].events;
    const at = ev.findIndex(e => e.k === 'died' && e.who === o.uid);
    const mine = ev.filter(e => (e.k === 'module' && e.id === 'copies_weaken') || (e.k === 'status' && e.cause && e.cause.k === 'copies_weaken'));
    const want = copies.flatMap(b => [['module', 'weaken', b.uid, o.uid], ['status', 'slowed', b.uid, o.uid]]);
    if (json(mine.map(e => [e.k, e.rule || e.id, e.who, e.cause.by])) !== json(want)) problems.push(`${tag}: its fall told ${json(mine.map(e => [e.k, e.rule || e.id, e.who]))}`);
    else if (ev.indexOf(mine[0]) < at || mine.some(e => e.k === 'status' && (e.turns !== null || !e.on))) problems.push(`${tag}: the weakening's order or its slowing`);
    // Their numbers: §5.4's, from theirs before the step (a copy hurt or healed later in the
    // step keeps its maximum, damage and Acc as weakened, its health no more than weakened).
    copies.forEach((b, j) => {
      const was = snaps[k][j], now = snaps[k + 1][j], dmax = lose(was.dmax);
      const w = { maxHp: lose(was.maxHp), hp: Math.min(lose(was.maxHp), lose(was.hp)), dmin: Math.min(dmax, lose(was.dmin)), dmax, acc: was.acc - N.COPY_WEAKEN_ACC };
      const later = ev.slice(ev.indexOf(mine[2 * j])).some(e => e.who === b.uid && ['damaged', 'healed', 'regenerated'].includes(e.k));
      if (now.maxHp !== w.maxHp || now.dmin !== w.dmin || now.dmax !== w.dmax || now.acc !== w.acc) problems.push(`${tag}: ${b.uid} is ${json(now)}, not weakened from ${json(was)} to ${json(w)}`);
      if (!later && now.hp !== w.hp) problems.push(`${tag}: ${b.uid}'s health ${now.hp}, not ${w.hp}`);
      if (!(C.Actors.byUid(s, b.uid).statuses || []).some(t => t.id === 'slowed' && t.perm === true)) problems.push(`${tag}: ${b.uid} is not slowed for the rest of the visit`);
    });
    // The log, every piece in view: the copies in one line, their slowing in one.
    const said = C.Text.log(ev, C.Labels.nameOf(s), () => true);
    if (!said.includes(`An original was destroyed, and ${copies.length} of its spares lost heart.`)) problems.push(`${tag}: the log says ${json(said)}`);
    // Its phases, on its pieces' health together, each once, in order, each naming the first
    // piece still standing as it came (you see every piece here), phase 2 with its burst.
    const ph = r.events.filter(e => e.k === 'phase');
    if (json(ph.map(e => [e.phase, e.cause.k, e.cause.seen, e.gained || null])) !== json([[2, 'ensemble', true, 'cp_burst'], [3, 'ensemble', true, null]])) problems.push(`${tag}: phases ${json(ph)}`);
    for (const e of ph) {
      const before = r.events.slice(0, r.events.indexOf(e)), first = ids.find(u => !before.some(x => x.k === 'died' && x.who === u));
      if (e.who !== first) problems.push(`${tag}: phase ${e.phase} names ${e.who}, not the first piece standing, ${first}`);
      const name = C.Labels.nameOf(s)(e.who);
      const want2 = `The Centrepiece is now in phase ${e.phase} of 3: its pieces’ health together has fallen to ${N.CP_PHASE_PCT[e.phase - 2]}% of their full health or below.${e.gained ? ` ${name.charAt(0).toUpperCase() + name.slice(1)}, the first of them still standing, has a burst.` : ''}`;
      if (say(C, s, e) !== want2) problems.push(`${tag}: ${say(C, s, e)}`);
    }
    // Its fall: the Repealing Pen on its footprint's top-left tile, the Certificate by its first
    // piece, the hall open.
    const drop = r.events.filter(e => e.k === 'dropped'), cert = r.events.filter(e => e.k === 'certificate');
    if (drop.length !== 1 || drop[0].x !== AT[0] || drop[0].y !== AT[1] || s.items.find(i => i.uid === drop[0].item).ref !== 'A4.11') problems.push(`${tag}: dropped ${json(drop)}`);
    if (cert.length !== 1 || cert[0].cause.by !== o.uid) problems.push(`${tag}: certificate ${json(cert)}`);
    if (C.Clock.sealed(s)) problems.push(`${tag}: the hall is still sealed`);
    // Marks equal damage (centrepiece.marks checks each): its bursts struck you.
    if (!r.events.some(e => e.k === 'damaged' && e.who === 'you' && e.cause.k === 'special' && e.cause.sp === 'cp_burst' && ids.includes(e.cause.by))) problems.push(`${tag}: no burst of its struck you`);
    return { r, s, problems };
  }

  test('the original first, joined up at depths 1–7, clone-checked: struck down first, its fall weakens each copy by §5.4 (COPY_WEAKEN_PCT% of its health and damage, never its last point, and COPY_WEAKEN_ACC Acc) and slows it for the rest of the visit, told in one line; its phases come on its pieces\' health together, each naming the first piece standing; its bursts strike as they marked; no piece ever steps; its fall drops the Pen where it first stood and earns the Certificate. With copies_weaken off, its fall weakens no one, and the run fails as it must', () => {
    const problems = [];
    for (const depth of DEPTHS) problems.push(...originalFirst(depth).problems);
    assert.deepEqual(problems, []);
    for (const depth of [1, 4]) {
      const off = originalFirst(depth, { rulesOff: ['copies_weaken'] });
      assert.ok(off.problems.some(l => /its fall told \[\]/.test(l)), `d${depth} off: ${json(off.problems)}`);
      assert.deepEqual(bad(off.r, 'off'), []);
    }
  });

  test('a copy first weakens no one: copy a struck down first, then the original, whose fall weakens only the copies still standing; joined up at depths 2 and 6', () => {
    for (const depth of [2, 6]) {
      const s = room(depth, { you: [4, 2] }), [o, a, b, c] = pieces(C, s);
      const r = H.play(C, s, fightIn(C, [a.uid, o.uid]), { inv: 'all', cap: 600 });
      assert.deepEqual([...bad(r, `d${depth}`), ...covered(C, s, r.events)], []);
      const k = r.steps.findIndex(st => st.events.some(e => e.k === 'died' && e.who === a.uid));
      assert.ok(k >= 0 && !r.steps[k].events.some(e => e.k === 'module'), `d${depth}: copy a's fall`);
      // The copies still standing when the original fell (one struck down by a burst before then
      // is not), and only they, lose heart, after its fall.
      const fall = r.events.findIndex(e => e.k === 'died' && e.who === o.uid), up = [b, c].filter(q => !r.events.slice(0, fall).some(e => e.k === 'died' && e.who === q.uid));
      const weak = r.events.filter(e => e.k === 'module' && e.rule === 'weaken').map(e => e.who);
      assert.ok(fall >= 0 && up.length >= 1, `d${depth}: the original's fall`);
      assert.equal(json(weak), json(up.map(q => q.uid)), `d${depth}`);
      assert.ok(fall < r.events.findIndex(e => e.k === 'module'), `d${depth}`);
    }
  });

  // ---- Per-piece health in the odds ----

  test('per-piece health in the odds: each piece\'s readout and its Attack button count its own health, not the Ordinance\'s, and its pictogram shows it; once the copies lose heart, their weakened numbers; at depths 1, 4 and 7 (m3-odds\' independent model)', () => {
    const M = require(path.join(root, 'test/m3-odds.test.js')).model(C);
    for (const depth of [1, 4, 7]) {
      const s = room(depth, { you: [3, 1] }), you = s.actors[0], total = Roles.stats('centrepiece', depth).hp;
      const check = tag => {
        for (const a of pieces(C, s)) {
          if (a.gone) continue;
          const l = C.Labels.of(s, a.uid), e = M.expected(s, you, a), got = M.numbers(l.odds);
          assert.deepEqual(got.slice(0, 5), e.nums.slice(0, 5), `${tag} ${a.uid}: ${l.odds.join(' ')}`);
          const m = C.Combat.netRolls(you, a, s, [you.x, you.y]);
          assert.ok(l.odds[1].includes(`typically need ${Math.ceil(a.hp * m.n / m.sum)} hit`), `${tag} ${a.uid}: ${l.odds[1]}`);
          assert.notEqual(Math.ceil(a.hp * m.n / m.sum), Math.ceil(total * m.n / m.sum), `${tag}: the total would read the same`);
          assert.equal(l.pictos.find(p => p.icon === 'heart').text, `${a.hp}/${a.maxHp}`);
          assert.equal(json(l.actions), json(M.button(s, you, a)), `${tag} ${a.uid}`);
        }
      };
      check(`d${depth}`);
      blow(C, s, pieces(C, s)[0], 999);
      for (const a of pieces(C, s).slice(1)) assert.ok(a.maxHp === lose(Math.floor(total / N.ENSEMBLE_PIECES)) && (a.statuses || []).some(t => t.id === 'slowed'), `d${depth}: ${a.uid} did not lose heart`);
      check(`d${depth} weakened`);
    }
  });

  // ---- Phase 2's special and its sentence ----

  // Planted blows (Combat.hurt) on the pieces in `order`, each as much as takes its pieces'
  // health together to CP_PHASE_PCT[0]% of their full health, no more than it has: the events.
  function toPhase2(X, s, order) {
    const out = [];
    for (const a of order) {
      const h = X.Centrepiece.health(s), n = h.hp - Int.pct(h.max, N.CP_PHASE_PCT[0]);
      if (n <= 0) break;
      out.push(...blow(X, s, a, Math.min(n, a.hp)));
    }
    return out;
  }
  test('phase 2\'s burst goes to its first piece still standing as the phase begins: the original (which gains it), else copy a, else copy b (which have it already); told with its cause, ensemble, naming that piece in your sight; planted blows at depth 3, copies_weaken off so that only the blows move its health', () => {
    const off = { rulesOff: ['copies_weaken'] }, named = (s, uid) => { const n = C.Labels.nameOf(s)(uid); return n.charAt(0).toUpperCase() + n.slice(1); };
    // [pieces struck down first (by index), the gainer].
    for (const [fallen, gainer] of [[[], 0], [[0], 1], [[0, 1], 2]]) {
      const s = room(3, { options: off }), ps = pieces(C, s), before = ps.map(a => a.ax.specials.slice()), ev = [];
      for (const i of fallen) ev.push(...blow(C, s, ps[i], 999));
      ev.push(...toPhase2(C, s, [ps[3], ps[2]]));
      const ph = ev.filter(e => e.k === 'phase');
      assert.equal(json(ph.map(e => [e.phase, e.who, e.gained, e.cause.k, e.cause.seen])), json([[2, ps[gainer].uid, 'cp_burst', 'ensemble', true]]), json(fallen));
      assert.equal(json(ps[gainer].ax.specials), json(gainer === 0 ? ['cp_burst'] : before[gainer]), json(fallen));
      assert.ok(say(C, s, ph[0]).endsWith(` ${named(s, ps[gainer].uid)}, the first of them still standing, has a burst.`), say(C, s, ph[0]));
      for (const [i, a] of ps.entries()) if (i !== gainer) assert.equal(json(a.ax.specials), json(before[i]), `${json(fallen)}: ${a.uid}`);
    }
  });

  // A hall in which the original's corner (7,5) is closed off by columns (6,4), (7,4), (6,5):
  // a piece moved there (pieces never step, so it stays) is out of your sight.
  const CORNER = ['#############', '#.......#...#', '#.......,...#', '#.......#...#', '#.....oo#...#', '#.....o.#...#', '#############'];
  test('its phase sentence names the piece that gains only when you see it: the original out of your sight, its phase 2 says only that the first piece still standing, out of your sight, has the burst, and the log never names it; in sight, it is named; joined up at depths 1, 4 and 7', () => {
    const problems = [];
    for (const depth of [1, 4, 7]) for (const hidden of [true, false]) {
      const s = room(depth, { map: CORNER, you: [4, 3], fixtures: [] }), [o, a, , c] = pieces(C, s), tag = `d${depth}${hidden ? ' hidden' : ''}`;
      if (hidden) Object.assign(o, { x: 7, y: 5 });
      const r = H.play(C, s, (st, i) => i > 500 || C.Centrepiece.phase(st) >= 2 ? null : fightIn(C, [c.uid, a.uid])(st, i), { inv: 'all', clone: true, cap: 600 });
      problems.push(...bad(r, tag));
      const step = r.steps.find(st => st.events.some(e => e.k === 'phase')), e = step && step.events.find(x => x.k === 'phase');
      if (!e) { problems.push(`${tag}: no phase 2`); continue; }
      const inView = new Set(C.ViewModel.derive(s, {}).actors.map(x => x.uid)), name = C.Labels.nameOf(s)(o.uid), Name = name.charAt(0).toUpperCase() + name.slice(1);
      if (e.who !== o.uid || e.gained !== 'cp_burst' || e.cause.seen !== !hidden || inView.has(o.uid) === hidden) problems.push(`${tag}: ${json(e)}; in view ${inView.has(o.uid)}`);
      const now = `The Centrepiece is now in phase 2 of 3: its pieces’ health together has fallen to ${N.CP_PHASE_PCT[0]}% of their full health or below.`;
      const want = hidden ? `${now} The first of them still standing, out of your sight, has a burst.` : `${now} ${Name}, the first of them still standing, has a burst.`;
      if (say(C, s, e) !== want) problems.push(`${tag}: ${say(C, s, e)}`);
      const log = C.Text.log(step.events, C.Labels.nameOf(s), uid => inView.has(uid));
      if (!log.includes(want) || (hidden && log.some(l => l.includes(name) || l.includes(Name)))) problems.push(`${tag}: the log says ${json(log)}`);
    }
    assert.deepEqual(problems, []);
  });

  // ---- Phases never go back: A.4.5, the conservator, restores pieces ----

  test('phases never go back: A.4.5 (the Countersigning Clerk, conservator_healer) restores a piece it sees, a copy that lost heart only up to its weakened maximum, and the Ordinance keeps its phase, telling none; struck back down, no phase comes again; joined up at depths 2 and 5', () => {
    for (const depth of [2, 5]) {
      const clerk = C.Packs.species('A4', 'A4.5');
      const s = room(depth, { you: [6, 5], more: [{ sp: 'A4.5', at: [6, 1], mode: 'hunting', stats: Roles.stats(clerk.role, depth), room: 'centre' }] });
      const [o, a] = pieces(C, s), healer = s.actors.find(x => x.sp === 'A4.5');
      // Planted: the original falls (its copies lose heart; phase 2 comes), then copy a is hurt.
      blow(C, s, o, 999);
      blow(C, s, a, Math.floor(a.hp / 2));
      const phase = C.Centrepiece.phase(s), max = a.maxHp, was = a.hp;
      assert.ok(phase >= 2 && max === lose(Math.floor(Roles.stats('centrepiece', depth).hp / N.ENSEMBLE_PIECES)), `d${depth}: phase ${phase}, ${a.uid} at ${was}/${max}`);
      const isHeal = e => e.k === 'healed' && e.who === a.uid && e.cause.k === 'restore' && e.cause.by === healer.uid;
      const r = H.play(C, s, (st, i, x) => i > 40 || x.events.some(isHeal) ? null : WAIT, { inv: 'all', cap: 60 });
      const healed = r.events.find(isHeal);
      assert.deepEqual(bad(r, `d${depth}`), []);
      assert.ok(healed, `d${depth}: the clerk never restored ${a.uid}: ${json(r.events.filter(e => e.k === 'healed' || e.k === 'telegraphed').map(e => [e.k, e.who]))}`);
      assert.ok(a.hp > was && a.hp <= a.maxHp && a.maxHp === max, `d${depth}: ${a.hp}/${a.maxHp}`);
      assert.equal(C.Centrepiece.phase(s), phase);
      assert.ok(!r.events.some(e => e.k === 'phase'), `d${depth}: a phase was told`);
      // Struck back down past where it was: no phase is told again.
      const back = blow(C, s, a, a.hp - 1);
      assert.ok(!back.some(e => e.k === 'phase' && e.phase <= phase), `d${depth}: ${json(back.filter(e => e.k === 'phase'))}`);
    }
  });

  // ---- Its pieces never step ----

  test('its pieces never step: neither a rule nor the Window Pole moves one (cannot_move), and each keeps its tile', () => {
    const s = room(3, { you: [4, 2], items: [{ uid: 'w', kind: 'instrument', form: 'pole', tier: 1, where: { at: 'kit', slot: 'instrument' } }] }), a = pieces(C, s)[1];
    for (const how of ['push', 'pull']) {
      const r = H.play(C, s, [{ a: 'use', uid: 'w', x: a.x, y: a.y, how }], { inv: 'all' });
      assert.deepEqual(bad(r, how), []);
      const refused = r.events.find(e => e.k === 'refused');
      assert.ok(refused && refused.reason === 'cannot_move', `${how}: ${json(r.events.map(e => e.k))}`);
      assert.equal(json([a.x, a.y]), json([3, 2]));
    }
    for (const p of pieces(C, s)) assert.equal(C.Archetypes.mayStep(s, p, p.x, p.y - 1), false);
  });

  // ---- A view names a piece still standing ----

  test('a view names the first of its pieces still standing: with the original fallen and its copies asleep, viewed.of is copy a and its sentence names it; four views earn the Certificate under the dust sheet, at depths 1 and 5', () => {
    // The viewing test's hall (x 1–12, y 1–4), its lectern (6,1) and reading tile (6,2), 3
    // walking tiles from the footprint (2,2).
    const VMAP = ['##############', '#.....l.o....#', '#.......o....#', '#.......o....#', '#............#', '###+##########', '#............#', '#............#', '##############'];
    const VROOMS = [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 12, y1: 4 }, { key: 's1', role: 'section', x0: 1, y0: 6, x1: 12, y1: 7 }];
    for (const depth of [1, 5]) {
      const s = room(depth, { map: VMAP, rooms: VROOMS, you: [6, 2], fixtures: [], lectern: [6, 1], read: [6, 2] }), [o, a] = pieces(C, s);
      // Planted: the original struck down; its copies (which lost heart) asleep again; a turn
      // waited on the reading tile, whose ring (RING_STILL) does not reach them.
      blow(C, s, o, 999);
      for (const p of pieces(C, s).slice(1)) { p.mode = 'dormant'; p.pips = 0; }
      const r = H.play(C, s, [WAIT, { a: 'view' }, { a: 'view' }, { a: 'view' }, { a: 'view' }], { inv: 'all', clone: true });
      assert.deepEqual(bad(r, `d${depth}`), []);
      const views = r.events.filter(e => e.k === 'viewed');
      assert.equal(json(views.map(e => [e.n, e.of])), json([1, 2, 3, 4].map(n => [n, a.uid])), `d${depth}`);
      assert.ok(say(C, s, views[0]).startsWith('You viewed the Duplicate Ordinance, Certified Copy a: 1 of 4 turns.'), say(C, s, views[0]));
      assert.ok(!r.events.some(e => JSON.stringify(e).includes(o.uid)), `d${depth}: an event names the fallen original`);
      assert.equal(json(C.Progress.cert(s) && C.Progress.cert(s).how), json('view'));
      assert.equal(json(C.Viewing.sheeted(s).uids), json(pieces(C, s).slice(1).map(p => p.uid)));
    }
  });
};
