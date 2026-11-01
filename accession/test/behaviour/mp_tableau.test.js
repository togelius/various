// ACCESSION — M.11's Centrepiece, the Great Board of the Central Station (mp_tableau; BUILD.md
// §5.3, §5.5, §8.1, §8.2, §8.4, §8.7; M4 plan A8, TABLEAU-CORE; decided without play; revisit once
// M4 is playable): its record (content/M11-cp.js), its body (rules/arch/mp_tableau.js) and its
// line; and the story every hunter that never steps tells (Wake.stands, how: 'stands'), the
// Ordinance's pieces' too. Its core stays at ready false, so no department places it: these
// tests place the real record with Centrepiece.place in a room with a hall (the harness's
// rooms), every invariant checked after every step (centrepiece.inv.js among them), the main
// runs clone-checked. What each test expects is worked out here from BUILD's sentences, not
// from the code:
//   - one 2×2 body on its footprint, asleep, with the role's numbers, its beam and its burst
//     from the start ('cp_line', 'cp_burst'), its summons ('summon') gained in phase 2; it
//     never moves (no step, no Window Pole), and its line says so;
//   - its beam: while it sees you in one of its rows or columns, the line from its footprint
//     toward you, up to AXIS_BEAM_RANGE tiles, a beam (a reflector turns it back onto it);
//     its beam and its burst take turns, each waiting until it can be marked;
//   - its summons: up to CP_SUMMON[1] free tiles of its hall beside it, nearest where it last
//     knew you were, at least CP_SUMMON[0]; a Logbook Trolley on each still free at its next
//     action; while marked it takes CP_SUMMON_DMG_PCT% of the damage dealt to it, which its
//     odds readout and its Attack button count and say;
//   - a body it summons is no piece of it: its blows do not stop a sealed hall's quiet count;
//   - a hunter that never steps changes mode where it stands, and the log says so
//     ('CLAUSES.tab_summon' and 'CLAUSES.tab_quick' are its phases' own words);
//   - a summons that calls a body that reflects widens the chime's forecast.
'use strict';
const H = require('./_harness.js');

module.exports = ({ test, assert, loadCore, root, path }) => {
  const json = JSON.stringify;
  const DEPTHS = H.DEPTHS;
  const B = require(path.join(root, 'tools/battery.js'));
  const LINES = require(path.join(root, 'test/m4-lines.test.js'));
  const C = loadCore(), { N, Int, Roles } = C;
  const WAIT = { a: 'wait' };
  // The hall (x 1–9, y 1–6) and a gallery east of it (x 11–13), joined by an archway (10,2) and
  // a staff door (10,5); the footprint's top-left tile (4,3), so the Board stands on 4–5 × 3–4:
  // its rows are 3 and 4, its columns 4 and 5.
  const MAP = ['###############', '#.........#...#', '#.........,...#', '#.........#...#', '#.........#...#', '#.........S...#', '#.........#...#', '###############'];
  const ROOMS = [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 9, y1: 6 }, { key: 's1', role: 'section', x0: 11, y0: 1, x1: 13, y1: 6 }];
  const AT = [4, 3];
  const gross = d => C.Specials.cpGross('ROLE_CENTREPIECE_SPECIAL_PCT', d);
  const span = (lo, hi) => lo === hi ? String(lo) : `${lo}–${hi}`;
  const net = (g, pad) => Math.max(N.DMG_MIN_ON_HIT, g - pad);

  // A room with the hall and pack acc's Centrepiece placed on its footprint (Centrepiece.place).
  // o: you ([8, 3], in its row), map, rooms, more exhibits, items, fixtures, options, core (X).
  function room(depth, o) {
    o = o || {};
    const X = o.core || C, acc = o.acc || 'M11';
    const s = H.room(X, o.seed || 1, { acc, depth, map: o.map || MAP, you: o.you || [8, 3], exhibits: o.more || [], rooms: o.rooms || ROOMS,
      clock: { B: 300, G: 60 }, entrance: o.entrance || [13, 3], fixtures: o.fixtures || [{ k: 'staff', x: 10, y: 5, grade: 1 }], items: o.items || [] }, o.options || {});
    s.actors[0].maxHp = 999; s.actors[0].hp = 999;
    X.Centrepiece.place(s, { cpl: o.at || AT }, X.Packs.get(acc));
    return s;
  }
  const board = (X, s) => X.Centrepiece.pieces(s)[0];
  const bad = (r, tag) => r.violations.map(v => `${tag}: ${v.id}: ${v.text}`);
  const say = (X, s, e) => X.Text.event(e, X.Labels.nameOf(s));
  const log = (X, s, events) => X.Text.log(events, X.Labels.nameOf(s), () => true);
  // A blow straight to the Board (Combat.hurt, as your blow lands), for a planted state.
  const blow = (X, s, a, n) => { const ev = []; X.Combat.hurt(s, a, n, { k: 'attack', by: 'you', at: a.uid, chance: 100, raw: n, pad: 0, how: { kind: 'melee' }, from: [s.actors[0].x, s.actors[0].y] }, ev); return ev; };
  // Into phase 2 by a planted blow (the Board wakes hunting from it, as any blow wakes).
  const toPhase2 = (X, s, a) => blow(X, s, a, a.hp - Int.pct(a.maxHp, N.CP_PHASE_PCT[0]));
  // Every event the Board caused is one its line allows it (the soak's completeness, B.causer).
  function covered(X, s, events) {
    const rec = X.Packs.get(s.dept.acc).centrepiece, allow = new Set(X.Clauses.UNIVERSAL), uids = s.dept.cp.uids, out = [];
    for (const p of X.Clauses.of(rec, { depth: s.dept.depth })) for (const k of p.covers) allow.add(k);
    for (const e of events) { const by = B.causer(e); if (uids.includes(by) && !allow.has(e.k)) out.push(`${by} caused ${e.k}, which its line does not cover`); }
    return out;
  }
  // The Board never moves: no moved event of its, and it stands on its footprint.
  const still = (X, s, r, tag) => {
    const b = board(X, s), out = [];
    if (r.events.some(e => e.k === 'moved' && e.who === b.uid)) out.push(`${tag}: the Board moved`);
    if (b.x !== AT[0] || b.y !== AT[1]) out.push(`${tag}: the Board stands at ${b.x},${b.y}`);
    return out;
  };
  const marksOf = (r, uid) => r.events.filter(e => e.k === 'telegraphed' && e.who === uid);

  // ---- Its record and its placement ----

  test('its record (content/M11-cp.js): one 2×2 body, a fight whose Signature piece is the Pocket Heliograph (M11.10), its beam and its burst from the start, its summons from phase 2 calling Logbook Trolleys (M11.5), phase 3 its quicker specials; its gateway label; its core at ready false, so no department of the game places it', () => {
    const pack = C.Packs.get('M11'), rec = pack.centrepiece;
    C.Centrepiece.check(rec, pack);
    assert.equal(json([rec.id, rec.archetype, rec.role, rec.form, rec.size, rec.signature, rec.specials, rec.summons, 'pieces' in rec, 'flags' in rec]),
      json(['M11.11', 'mp_tableau', 'centrepiece', 'fight', 2, 'M11.10', ['cp_line', 'cp_burst'], 'M11.5', false, false]));
    assert.equal(json(rec.phases), json([{ parts: ['SPECIALS.cp_line', 'SPECIALS.cp_burst'] }, { parts: ['CLAUSES.tab_summon'], specials: ['summon'] }, { parts: ['CLAUSES.tab_quick'] }]));
    const words = rec.gateway.split(/\s+/).length;
    assert.ok(words >= 40 && words <= 120 && rec.gateway.startsWith(`${rec.name}. `), `its gateway label is 40–120 words (D3.8), and names it: ${words}`);
    // The summons calls the pack's Logbook Trolley, a plodder that reflects nothing, and its
    // phase-2 words name that body.
    const sp = C.Packs.species('M11', 'M11.5');
    assert.equal(json([sp.archetype, sp.role, sp.modifiers]), json(['plodder', 'fodder', []]));
    assert.ok(C.Registry.CLAUSES.tab_summon.clause.includes(`calls a ${sp.name.split(',')[0]} out of its frame`));
    assert.equal(C.Registry.ARCHETYPES.mp_tableau.ready, false);
    assert.equal(C.Populate.ready(rec), false);
    assert.ok(C.Centrepiece.wired('mp_tableau'), 'its core is added with the shared rules');
    for (const depth of [1, 4, 7]) for (const seed of [1, 2]) assert.equal(C.Hall.cp(C.Dept.create(seed, 'M11', depth)), null, `M11 seed ${seed} depth ${depth} placed its Centrepiece`);
  });

  test('placed, at depths 1–7: one exhibit of the role centrepiece on its 2×2 footprint, asleep, with the role\'s numbers, its beam and its burst, phase 1, its summons the special phase 2 gives; nothing drawn; and a department places it so once its core is planted ready', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const s = room(depth), b = board(C, s), role = Roles.stats('centrepiece', depth);
      const got = [s.dept.cp.uids, b.uid, b.sp, b.x, b.y, b.size, b.arch, b.role, b.mode, b.hp, b.maxHp, b.dmin, b.dmax, b.ax];
      const want = [[`M11.${depth}.centre.1`], `M11.${depth}.centre.1`, 'M11.11', 4, 3, 2, 'mp_tableau', 'centrepiece', 'dormant', role.hp, role.hp, role.dmin, role.dmax, { specials: ['cp_line', 'cp_burst'], phase: 1 }];
      if (json(got) !== json(want)) problems.push(`d${depth}: ${json(got)}`);
      if (json(s.dept.cp.gains) !== json([null, 'summon', null]) || json(s.dept.cp.at) !== json(AT) || s.dept.cp.signature !== 'M11.10') problems.push(`d${depth}: dept.cp ${json(s.dept.cp)}`);
      if (json(s.rng) !== '{}') problems.push(`d${depth}: placing it drew on ${json(Object.keys(s.rng))}`);
    }
    // Planted ready, a department places it, one body, on its hall's footprint.
    const X = loadCore();
    X.Registry.ARCHETYPES.mp_tableau.ready = 'unit';
    for (const seed of [1, 2]) {
      const s = X.Dept.create(seed, 'M11', 3), cp = X.Hall.cp(s), b = cp && board(X, s);
      if (!b || cp.uids.length !== 1 || b.size !== 2 || b.x !== cp.at[0] || b.y !== cp.at[1] || b.sp !== 'M11.11') { problems.push(`M11 seed ${seed}: ${json(cp)}`); continue; }
      const hall = s.dept.rooms.find(q => q.key === cp.room);
      if (!hall || hall.role !== 'centre' || X.Actors.footprint(b).some(([x, y]) => s.dept.roomOf[y][x] !== hall.id)) problems.push(`M11 seed ${seed}: not on its hall's floor`);
    }
    assert.deepEqual(problems, []);
  });

  // ---- Its line and its strip ----

  // Its whole line at a depth, from BUILD's sentences: §5.5's Great Board, §5.3's form rule
  // (cp_fight), its phase parts and the wake clause.
  function wantLine(d) {
    const r = Roles.stats('centrepiece', d), g = gross(d);
    return [`Never moves, and strikes from beside you for ${span(r.dmin, r.dmax)}.`,
      `Its specials take turns in the order given here, each waiting until it can be marked, at most one every ${N.CP_SPECIAL_EVERY[0]} of its actions.`,
      `Its second phase starts at ${N.CP_PHASE_PCT[0]}% of its full health or less, its third at ${N.CP_PHASE_PCT[1]}%, for good.`,
      'Hunting you in its hall, it seals you in with it once no one stands in an opening.',
      'Its fall drops its Signature piece where it first stood and earns the Certificate, unless you have it.',
      PHASE[1](d), `From phase 2: ${PHASE[2]().charAt(0).toLowerCase()}${PHASE[2]().slice(1)}`, `From phase 3: ${PHASE[3]().charAt(0).toLowerCase()}${PHASE[3]().slice(1)}`,
      'Wakes when you stay inside your ring or make noise near it.'].join(' ');
  }
  const PHASE = {
    1: d => `While it sees you in one of its rows or columns, marks that line toward you as a beam, through glass, up to ${N.AXIS_BEAM_RANGE} tiles from it, then strikes everything on it for ${gross(d)} before Padding; marks your tile and the tiles round it while it sees you, then strikes everything on them for ${gross(d)} before Padding.`,
    2: () => `With ${N.CP_SUMMON[0]} or more free tiles of its hall beside it, marks up to ${N.CP_SUMMON[1]} of them, those nearest where it last knew you were, then calls a Logbook Trolley out of its frame onto each still free; while they are marked it takes double damage.`,
    3: () => `It marks a special at most once every ${N.CP_SPECIAL_EVERY[1]} of its actions, not ${N.CP_SPECIAL_EVERY[0]}.`,
  };
  test('its line (\'ARCHETYPES.mp_tableau\', \'SPECIALS.cp_line\', \'SPECIALS.cp_burst\', \'CLAUSES.tab_summon\', \'CLAUSES.tab_quick\') says it never moves, its specials in turn, its beam and its burst, its summons and its double damage while marked, and its quicker specials in phase 3; its strip, in every phase, its phase\'s own part within the budget (m4-lines\' model), at depths 1–7', () => {
    const rec = C.Packs.get('M11').centrepiece, problems = [], FIGHT = 'Its fall earns the Certificate, unless you have it.', REST = 'Its label has the rest.';
    for (const d of DEPTHS) {
      if (C.Clauses.line(rec, { depth: d }) !== wantLine(d)) problems.push(`d${d}: ${C.Clauses.line(rec, { depth: d })}`);
      for (const k of [1, 2, 3]) {
        const t = C.Clauses.strip(rec, { depth: d, phase: k });
        if (t !== [`Phase ${k} of 3.`, FIGHT, PHASE[k](d), REST].join(' ')) problems.push(`d${d} phase ${k}: ${t}`);
        if (LINES.rows(t) > LINES.METRICS.budgetRows) problems.push(`d${d} phase ${k}: ${LINES.rows(t)} rows`);
      }
    }
    // Its double damage is tied to its row, as the words rule asks.
    assert.equal(N.CP_SUMMON_DMG_PCT, 200);
    assert.equal(json(C.Registry.CLAUSES.tab_summon.phrases), json({ 'double damage': 'N:CP_SUMMON_DMG_PCT' }));
    // The whole line is long (the label scrolls, FU1): 30 rows, more than the strip's budget;
    // its strip at most 11 (BUILD §5.5 says both).
    assert.equal(LINES.rows(C.Clauses.line(rec, { depth: 7 })), 30);
    assert.equal(Math.max(...DEPTHS.flatMap(d => [1, 2, 3].map(k => LINES.rows(C.Clauses.strip(rec, { depth: d, phase: k }))))), 11);
    // Its words: no digit outside a parameter, each a sentence or a phase's continuation.
    const R = C.Registry;
    for (const [t, id] of [['ARCHETYPES', 'mp_tableau'], ['SPECIALS', 'cp_line'], ['SPECIALS', 'summon'], ['CLAUSES', 'tab_summon'], ['CLAUSES', 'tab_quick']]) {
      const cl = R[t][id].clause;
      if (/[0-9]/.test(cl.replace(/\{[^}]*\}/g, ''))) problems.push(`${t}.${id}: a digit outside a parameter`);
      if (t === 'ARCHETYPES' ? !/^[A-Z].*\.$/.test(cl) : /^[A-Z]|\.$/.test(cl)) problems.push(`${t}.${id}: "${cl}"`);
    }
    assert.deepEqual(problems, []);
  });

  // ---- It never moves ----

  test('it never moves: it hunts and never steps (neverSteps; mayStep false every way), the Window Pole does not move it (too_big), and joined up it keeps its footprint while it hunts you round its hall and loses you', () => {
    const s = room(3, { you: [8, 1], items: [{ uid: 'w', kind: 'instrument', form: 'pole', tier: 1, where: { at: 'kit', slot: 'instrument' } }] }), b = board(C, s);
    assert.ok(C.Archetypes.neverSteps(s, b) && C.Wake.stands(s, b));
    for (let d = 0; d < 8; d++) assert.equal(C.Archetypes.mayStep(s, b, b.x + C.Grid.DX[d], b.y + C.Grid.DY[d]), false, `direction ${d}`);
    // The pole: refused, from 2 tiles off its corner (6,1), push and pull.
    const p = H.play(C, s, [{ a: 'move', dir: 6 }, { a: 'move', dir: 6 }, { a: 'use', uid: 'w', x: 5, y: 3, how: 'push' }, { a: 'use', uid: 'w', x: 5, y: 3, how: 'pull' }], { inv: 'all' });
    assert.deepEqual(bad(p, 'pole'), []);
    assert.equal(json(p.events.filter(e => e.k === 'refused').map(e => e.reason)), json(['too_big', 'too_big']));
    // Woken, it hunts you while you walk round it, then out through the archway to the gallery's
    // far corner (13,6), out of its sight, until it is asleep again: it never moves.
    const t = room(3, { you: [7, 1] }), tb = board(C, t);
    blow(C, t, tb, 1);
    // (Sealed in with it, round it: south, west, north and east again.)
    const route = [4, 4, 4, 4, 6, 6, 6, 6, 6, 6, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2];
    const r = H.play(C, t, (st, i) => i < route.length ? { a: 'move', dir: route[i] } : i > route.length + 8 ? null : WAIT, { inv: 'all', clone: true, cap: 40 });
    assert.deepEqual([...bad(r, 'walk'), ...still(C, t, r, 'walk'), ...covered(C, t, r.events)], []);
    assert.ok(r.events.filter(e => e.k === 'moved' && e.who === 'you').length === route.length && marksOf(r, tb.uid).length >= 2, 'you walked round it while it hunted you');
  });

  // ---- Its beam and its burst ----

  // The beam a model of §8.1 gives: from its footprint's tile in your row or column toward you,
  // each tile one can see through, up to AXIS_BEAM_RANGE (no reflector in these rooms).
  function beam(s, you) {
    const row = you.y >= AT[1] && you.y <= AT[1] + 1, out = [];
    const [dx, dy] = row ? [Math.sign(you.x - AT[0]), 0] : [0, Math.sign(you.y - AT[1])];
    let x = row ? (dx > 0 ? AT[0] + 1 : AT[0]) : you.x, y = row ? you.y : (dy > 0 ? AT[1] + 1 : AT[1]);
    for (let k = 0; k < N.AXIS_BEAM_RANGE; k++) { x += dx; y += dy; if (!C.Grid.seeThrough(s.dept, x, y)) break; out.push([x, y]); }
    return out.sort((p, q) => p[1] - q[1] || p[0] - q[0]);
  }
  // The burst a model of §8.1 gives: your tile and those round it an exhibit could stand on,
  // none of the Board's own.
  const square = (s, you) => { const out = []; for (let y = you.y - 1; y <= you.y + 1; y++) for (let x = you.x - 1; x <= you.x + 1; x++) if (C.Grid.hold(s.dept, x, y) && !(x >= AT[0] && x <= AT[0] + 1 && y >= AT[1] && y <= AT[1] + 1)) out.push([x, y]); return out; };
  test('its beam and its burst take turns, joined up at depths 1–7, clone-checked: woken, it marks its beam along the row or column of it you stand in (your row east of it; your column north of it), then its burst on your tile and round it, in turn, one every CP_SPECIAL_EVERY[0] of its actions, each striking you for what it showed; standing in neither, its beam waits, and so its burst', () => {
    const problems = [];
    for (const depth of DEPTHS) for (const you of depth === 2 || depth === 6 ? [[8, 3], [5, 1]] : [[8, 3]]) {
      const s = room(depth, { you }), b = board(C, s), tag = `d${depth} ${you}`;
      blow(C, s, b, 1);
      const r = H.play(C, s, Array(16).fill(WAIT), { inv: 'all', clone: true });
      problems.push(...bad(r, tag), ...still(C, s, r, tag), ...covered(C, s, r.events).map(l => `${tag}: ${l}`));
      const marks = marksOf(r, b.uid), at = { x: you[0], y: you[1] };
      if (marks.length < 4 || marks.some((e, i) => e.sp !== (i % 2 ? 'cp_burst' : 'cp_line'))) problems.push(`${tag}: it marked ${json(marks.map(e => e.sp))}`);
      // One every CP_SPECIAL_EVERY[0] of its actions: between two marks, that many actions less
      // the one that resolves the first, spent as it otherwise would (here, waits).
      const acts = r.events.filter(e => e.k === 'telegraphed' || e.k === 'special').filter(e => e.who === b.uid).map(e => e.k);
      if (json(acts.slice(0, 4)) !== json(['telegraphed', 'special', 'telegraphed', 'special'])) problems.push(`${tag}: ${json(acts)}`);
      for (const e of marks) {
        const want = e.sp === 'cp_line' ? beam(s, at) : square(s, at);
        if (json(e.tiles) !== json(want)) problems.push(`${tag}: its ${e.sp} marked ${json(e.tiles)}, not ${json(want)}`);
      }
      const hits = r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.k === 'special' && e.cause.by === b.uid);
      if (hits.length < marks.length - 1 || hits.some((e, i) => e.cause.sp !== marks[i].sp || e.amount !== net(gross(depth), s.actors[0].pad))) problems.push(`${tag}: it struck ${json(hits.map(e => [e.cause.sp, e.amount]))}`);
    }
    // In its sight but in none of its rows and columns: its beam cannot be marked, so it waits,
    // and so does its burst (its specials take turns); it strikes nothing from there.
    for (const depth of [1, 5]) {
      const s = room(depth, { you: [7, 1] }), b = board(C, s);
      blow(C, s, b, 1);
      const r = H.play(C, s, Array(12).fill(WAIT), { inv: 'all' });
      problems.push(...bad(r, `d${depth} aside`));
      if (!C.AI.sees(s, b) || b.mode !== 'hunting' || marksOf(r, b.uid).length) problems.push(`d${depth} aside: it marked ${json(marksOf(r, b.uid))}`);
    }
    assert.deepEqual(problems, []);
  });

  test('its beam is a beam (§8.1): a Reflecting Dish standing in it turns it back along itself, through the Board and on behind it, and the Board is struck by its own beam, the dish\'s doing; at depths 1 and 4', () => {
    for (const depth of [1, 4]) {
      const dish = C.Packs.species('M11', 'M11.4');
      const s = room(depth, { you: [8, 3], more: [{ sp: 'M11.4', at: [7, 3], mode: 'dormant', stats: Roles.stats(dish.role, depth), room: 'centre' }] }), b = board(C, s), d = s.actors.find(a => a.sp === 'M11.4');
      blow(C, s, b, 1);
      // Out: (6,3), the dish (7,3); back: the Board's own tiles (5,3), (4,3), and on behind it to the wall.
      assert.equal(json(C.Tableau.line(s, b)), json([[6, 3], [7, 3], [5, 3], [4, 3], [3, 3], [2, 3], [1, 3]]));
      const r = H.play(C, s, (st, i, x) => i > 12 || x.events.some(e => e.k === 'special' && e.who === b.uid && e.sp === 'cp_line') ? null : WAIT, { inv: 'all', clone: true });
      assert.deepEqual(bad(r, `d${depth}`), []);
      const own = r.events.find(e => e.k === 'damaged' && e.who === b.uid && e.cause.k === 'reflected');
      assert.ok(own && own.cause.by === d.uid && own.cause.shooter === b.uid && own.cause.sp === 'cp_line', `d${depth}: ${json(r.events.filter(e => e.k === 'damaged').map(e => [e.who, e.cause]))}`);
      assert.ok(!r.events.some(e => e.k === 'damaged' && e.who === 'you' && e.cause.sp === 'cp_line'), `d${depth}: its beam reached you behind the dish`);
    }
  });

  // ---- Its summons ----

  test('its summons marks up to CP_SUMMON[1] free tiles of its hall beside it, nearest where it last knew you were (ties in row-major order), and none with fewer than CP_SUMMON[0] free: never a tile someone stands on, an opening of the hall or a tile outside it', () => {
    const s = room(3, { you: [7, 3] }), b = board(C, s);
    toPhase2(C, s, b);
    const tiles = () => C.Specials.tiles(s, b, 'summon');
    b.lastKnown = [7, 3];
    assert.equal(json(tiles()), json([[6, 2], [6, 3]]));
    b.lastKnown = [1, 6];
    assert.equal(json(tiles()), json([[3, 4], [3, 5]]));
    b.lastKnown = [6, 1];
    assert.equal(json(tiles()), json([[6, 2], [5, 2]].sort((p, q) => p[1] - q[1] || p[0] - q[0])));
    // Taken tiles are passed over; with one free, it marks one; with none, it cannot mark.
    const fixed = (x, y) => C.Actors.spawn(s, Object.assign({}, Roles.stats('fodder', 3), { uid: `dummy.${x}.${y}`, sp: 'M11.5', x, y, mode: 'dormant' }));
    const ring = [];
    for (let y = 2; y <= 5; y++) for (let x = 3; x <= 6; x++) if (C.Actors.dist(b, x, y) === 1) ring.push([x, y]);
    assert.equal(ring.length, 12);
    for (const [x, y] of ring.slice(0, 11)) fixed(x, y);
    b.lastKnown = [7, 3];
    assert.equal(json(tiles()), json([ring[11]]));
    fixed(...ring[11]);
    assert.equal(json(tiles()), '[]');
    assert.equal(C.Specials.canMark(s, b, 'summon', tiles()), false);
    // Beside an archway: the opening (in no room) and the gallery beyond are never marked.
    const t = room(3, { at: [8, 2], you: [7, 5] }), tb = board(C, t);
    for (const lk of [[13, 2], [11, 3], [9, 6]]) {
      tb.lastKnown = lk;
      for (const [x, y] of C.Specials.tiles(t, tb, 'summon')) assert.ok(t.dept.roomOf[y][x] === t.dept.roomOf[2][8] && C.Grid.ch(t.dept, x, y) === '.', `${json(lk)}: ${x},${y}`);
    }
  });

  test('its summons, joined up at depths 1–7, clone-checked: from phase 2 its specials are its beam, its burst and its summons in turn; a Logbook Trolley comes onto each marked tile still free at its next action, hunting you, its own exhibit (<its uid>/<k>, the trolley\'s numbers, its story summoned from the Board); one you stand on gets none; while the summons is marked your blows deal it CP_SUMMON_DMG_PCT% (and only then); the log tells it', () => {
    const problems = [];
    let allDoubled = 0;
    for (const depth of DEPTHS) {
      const s = room(depth, { you: [7, 3] }), b = board(C, s), tag = `d${depth}`, marked = [], snaps = [];
      toPhase2(C, s, b);
      if (json(b.ax.specials) !== json(['cp_line', 'cp_burst', 'summon']) || b.mode !== 'hunting') { problems.push(`${tag}: ${json(b.ax)} ${b.mode}`); continue; }
      let summons = 0;
      const r = H.play(C, s, (st, i, x) => {
        const bb = board(C, st), you = st.actors[0], on = !!bb.telegraph && bb.telegraph.sp === 'summon';
        if (x.last.some(e => e.k === 'special' && e.who === bb.uid && e.sp === 'summon')) summons++;
        if (summons >= 2 || i > 60) return null;
        marked[i] = on;
        snaps[i] = { woke: JSON.parse(JSON.stringify(bb.woke)), kids: bb.kids };
        // At its first summons, step onto its mark beside you (6,3); at its second, strike it.
        if (on && you.x === 7 && bb.telegraph.tiles.some(t => t[0] === 6 && t[1] === 3)) return { a: 'move', dir: 6 };
        if (on || you.x === 6) return { a: 'attack', uid: bb.uid };
        return WAIT;
      }, { inv: 'all', clone: true, cap: 70 });
      problems.push(...bad(r, tag), ...still(C, s, r, tag), ...covered(C, s, r.events).map(l => `${tag}: ${l}`));
      const sps = marksOf(r, b.uid).map(e => e.sp);
      if (json(sps.slice(0, 3)) !== json(['cp_line', 'cp_burst', 'summon']) || sps.filter(x => x === 'summon').length !== 2) problems.push(`${tag}: it marked ${json(sps)}`);
      // Each summons' bodies: on its marked tiles still free when it went off.
      for (const [k, st] of r.steps.entries()) {
        const went = st.events.find(e => e.k === 'special' && e.who === b.uid && e.sp === 'summon');
        if (!went) continue;
        const mark = marksOf({ events: r.steps.slice(0, k).flatMap(q => q.events) }, b.uid).filter(e => e.sp === 'summon').pop();
        const made = st.events.filter(e => e.k === 'woke' && e.was === null && e.cause.k === 'summoned');
        // Its first: you stepped onto (6,3), so a body comes onto (6,2) alone. Any: onto its
        // marked tiles, in their order, numbered on from the Board's count.
        const bodies = made.map(e => { const a = C.Actors.byUid(s, e.who); return [e.who, a.home[0], a.home[1]]; });
        const first = r.steps[k].action.a === 'move', want = first ? [[`${b.uid}/1`, 6, 2]] : null;
        if (first && json(mark.tiles) !== json([[6, 2], [6, 3]])) problems.push(`${tag}: its first summons marked ${json(mark.tiles)}`);
        if (want ? json(bodies) !== json(want) : bodies.some(([uid, x, y], j) => uid !== `${b.uid}/${snaps[k].kids + j + 1}` || !mark.tiles.some(t => t[0] === x && t[1] === y))) problems.push(`${tag}: its summons at step ${k} made ${json(bodies)} on ${json(mark.tiles)}`);
        if (mark.tiles.length < N.CP_SUMMON[0] || mark.tiles.length > N.CP_SUMMON[1] || mark.tiles.some(([x, y]) => C.Actors.dist(b, x, y) !== 1)) problems.push(`${tag}: it marked ${json(mark.tiles)}`);
        const fodder = Roles.stats('fodder', depth);
        for (const e of made) {
          const a = C.Actors.byUid(s, e.who);
          if (a.sp !== 'M11.5' || a.arch !== 'plodder' || a.maxHp !== fodder.hp || a.dmin !== fodder.dmin || a.dmax !== fodder.dmax || e.mode !== 'hunting') problems.push(`${tag}: ${e.who} is ${json([a.sp, a.arch, a.maxHp, a.dmin, a.dmax, e.mode])}`);
          if (json(e.cause) !== json({ k: 'summoned', how: 'summon', from: b.uid, parent: snaps[k].woke })) problems.push(`${tag}: ${e.who}'s story is ${json(e.cause)}`);
          if (s.dept.cp.uids.includes(e.who)) problems.push(`${tag}: ${e.who} is a piece of it`);
        }
        const said = log(C, s, st.events), name = C.Labels.nameOf(s), Board = name(b.uid).replace(/^the/, 'The');
        const words = made.length === 1 ? `${name(made[0].who).replace(/^the/, 'The')} came from ${name(b.uid)} and began hunting you.` : `${Board} called ${made.length} bodies onto the tiles it marked, and they began hunting you.`;
        if (made.length && (!said.includes(words) || said.some(l => l.includes('used its summons')))) problems.push(`${tag}: the log says ${json(said)}`);
      }
      if (r.steps.filter((st, k) => st.events.some(e => e.k === 'special' && e.sp === 'summon')).length !== 2) problems.push(`${tag}: two summonses did not go off`);
      // Your blows on it: CP_SUMMON_DMG_PCT% of the blow's damage while its summons was marked.
      let doubled = 0;
      for (const [k, st] of r.steps.entries()) for (const e of st.events) {
        if (e.k !== 'damaged' || e.who !== b.uid || e.cause.by !== 'you') continue;
        const base = Math.max(N.DMG_MIN_ON_HIT, e.cause.raw - e.cause.pad), want = marked[k] ? Int.pct(base, N.CP_SUMMON_DMG_PCT) : base;
        if (marked[k]) doubled++;
        if (e.amount !== want) problems.push(`${tag}: your blow at step ${k} dealt ${e.amount}, not ${want} (${marked[k] ? 'marked' : 'not marked'})`);
      }
      allDoubled += doubled;
    }
    assert.ok(allDoubled >= 3, `${allDoubled} blows of yours landed while its summons was marked`);
    assert.deepEqual(problems, []);
  });

  // ---- Its double damage in the odds and the Attack button ----

  // Your rolls against it after its Padding (§8.1), and the hits you need, from BUILD's words.
  function mine(you, a, pct) {
    const nets = [];
    for (let r = you.dmin; r <= you.dmax; r++) nets.push(Int.pct(Math.max(N.DMG_MIN_ON_HIT, r - a.pad), pct));
    const sum = nets.reduce((p, q) => p + q, 0);
    return { lo: Math.min(...nets), hi: Math.max(...nets), need: Math.ceil(a.hp * nets.length / sum) };
  }
  test('while its summons is marked it takes CP_SUMMON_DMG_PCT% of the damage dealt to it, and its odds readout and its Attack button say so: the hits you need, your blow\'s damage and a line saying why; with no summons marked, the plain figures and no such line (m3-odds\' model); at depths 1, 4 and 7', () => {
    const M = require(path.join(root, 'test/m3-odds.test.js')).model(C);
    for (const depth of [1, 4, 7]) {
      const s = room(depth, { you: [6, 3] }), b = board(C, s), you = s.actors[0];
      toPhase2(C, s, b);
      const plain = tag => {
        const l = C.Labels.of(s, b.uid), m = mine(you, b, 100), chance = C.Combat.hitChance(you, b);
        assert.ok(l.odds[1].includes(`typically need ${m.need} hit`) && !l.odds.some(x => /is marked:/.test(x)), `${tag}: ${l.odds.join(' ')}`);
        assert.equal(json(l.actions), json(M.button(s, you, b)), tag);
        assert.equal(l.actions[0].text, `Attack: ${chance}%, ${span(m.lo, m.hi)} damage`, tag);
      };
      plain(`d${depth}`);
      C.Specials.mark(s, b, 'summon', C.Specials.tiles(s, b, 'summon'), []);
      const l = C.Labels.of(s, b.uid), m = mine(you, b, N.CP_SUMMON_DMG_PCT), chance = C.Combat.hitChance(you, b);
      assert.ok(l.odds[1].includes(`typically need ${m.need} hit`), `d${depth}: ${l.odds[1]}`);
      assert.equal(l.odds[2], `Its summons is marked: until it goes off, it takes ${N.CP_SUMMON_DMG_PCT}% of the damage dealt to it, and your figures count it.`);
      assert.equal(l.actions[0].text, `Attack: ${chance}%, ${span(m.lo, m.hi)} damage`);
      assert.notEqual(m.need, mine(you, b, 100).need, `d${depth}: the doubled figures read as the plain ones`);
      // Its summons' own line: what it does, its double damage and its cadence (three specials).
      const every = N.CP_SPECIAL_EVERY[0] * 3;
      assert.ok(l.odds.includes(`Its summons deals no damage: it marks up to ${N.CP_SUMMON[1]} free tiles beside it, then calls a body onto each still free; while they are marked, it takes ${N.CP_SUMMON_DMG_PCT}% of the damage dealt to it, at most one action in ${every}.`), json(l.odds));
      C.Specials.cancel(s, b, 'fixed', []);
      plain(`d${depth} called off`);
    }
  });

  // ---- A body it summons and the hall's quiet count ----

  test('a body it summons is no piece of it: sealed in its hall, hidden where the Board can neither see you nor stand beside you, its Logbook Trolleys\' blows do not stop the quiet count, and the shutters open (quiet) SEAL_LIFT_TURNS turns after it last hurt you; at depths 2 and 5', () => {
    // Columns (7,4), (8,4), (7,5) hide (8,5) from the Board.
    const QMAP = ['###############', '#.........#...#', '#.........,...#', '#.........#...#', '#......oo.#...#', '#......o..S...#', '#.........#...#', '###############'];
    for (const depth of [2, 5]) {
      const s = room(depth, { map: QMAP, you: [8, 6] }), b = board(C, s);
      toPhase2(C, s, b);
      b.lastKnown = [8, 6];
      C.Specials.mark(s, b, 'summon', C.Specials.tiles(s, b, 'summon'), []);
      assert.ok(!C.AI.sees(s, b), `d${depth}: it sees you`);
      const r = H.play(C, s, (st, i) => i > N.SEAL_LIFT_TURNS + 20 || st.dept.cp.lifted ? null : WAIT, { inv: 'all', cap: N.SEAL_LIFT_TURNS + 30 });
      assert.deepEqual(bad(r, `d${depth}`), []);
      const sealed = r.events.find(e => e.k === 'stage' && e.stage === 'sealed'), lift = r.events.find(e => e.k === 'stage' && e.stage === 'unsealed');
      const bodies = r.events.filter(e => e.k === 'woke' && e.cause.k === 'summoned').map(e => e.who);
      const theirs = r.events.filter(e => e.k === 'damaged' && e.who === 'you' && bodies.includes(e.cause.by));
      const its = r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.by === b.uid);
      assert.ok(sealed && bodies.length >= 1 && its.length === 0, `d${depth}: sealed ${json(sealed)}, bodies ${json(bodies)}, the Board hurt you ${its.length} times`);
      assert.ok(theirs.filter(e => sealed && e.turn > sealed.turn).length >= 10, `d${depth}: the trolleys struck ${theirs.length} times`);
      assert.ok(lift && lift.cause.why === 'quiet' && lift.turn === sealed.turn + N.SEAL_LIFT_TURNS, `d${depth}: sealed at ${sealed.turn}, lifted ${json(lift)}`);
      // A body's blow tells the hall nothing; the Board's would restart the count.
      const t = room(depth, { map: QMAP, you: [8, 6] });
      t.dept.cp.sealed = { turn: 0, by: board(C, t).uid, why: 'hunt', at: 3, last: 0, seen: '' };
      C.Hall.onHurt(t, { k: 'attack', by: bodies[0] });
      assert.equal(t.dept.cp.sealed.last, 0);
      C.Hall.onHurt(t, { k: 'attack', by: board(C, t).uid });
      assert.equal(t.dept.cp.sealed.last, 4);
    }
  });

  // ---- The story a hunter that never steps tells (Wake.stands) ----

  const FORBIDDEN = /set off to look|searches where it last knew|searching where it last knew|going back|back in its place|wanders/;
  const STANDS = ['out_of_sight', 'searched', 'idle', 'home', 'ticket', 'hall', 'noise'];
  // Its mode changes' causes say how: 'stands', and none of its sentences sends it anywhere.
  function story(X, s, r, uid, tag) {
    const out = [], mine_ = r.events.filter(e => e.who === uid && ['lost', 'returned', 'alerted', 'woke'].includes(e.k) && e.cause && STANDS.includes(e.cause.k));
    for (const e of mine_) if (e.cause.how !== 'stands') out.push(`${tag}: ${e.k}.${e.cause.k} says how ${json(e.cause.how)}`);
    for (const st of r.steps) for (const l of log(X, s, st.events)) if (FORBIDDEN.test(l) && l.startsWith(X.Labels.nameOf(s)(uid).replace(/^the/, 'The'))) out.push(`${tag}: "${l}"`);
    return out;
  }
  test('a hunter that never steps changes mode where it stands, and the log says so: the Great Board and the Ordinance\'s original, hunting you out of their sight, keep watch where they stand, settle there and sleep; never set off to look, search where they last knew you were, or go back to a place they never left; at depths 1, 4 and 7', () => {
    const problems = [];
    for (const depth of [1, 4, 7]) for (const acc of ['M11', 'A4']) {
      const s = room(depth, { acc, you: [13, 6] }), b = board(C, s), tag = `${acc} d${depth}`, Name = C.Labels.nameOf(s)(b.uid).replace(/^the/, 'The');
      if (!C.Wake.stands(s, b) || C.AI.sees(s, b)) { problems.push(`${tag}: stands ${C.Wake.stands(s, b)}, sees you`); continue; }
      blow(C, s, b, 1);
      const r = H.play(C, s, st => board(C, st).mode === 'dormant' ? null : WAIT, { inv: 'all', clone: true, cap: 60 });
      problems.push(...bad(r, tag), ...story(C, s, r, b.uid, tag));
      if (r.events.some(e => e.k === 'moved' && e.who === b.uid) || b.mode !== 'dormant') problems.push(`${tag}: it moved, or is ${b.mode}`);
      const said = r.steps.flatMap(st => log(C, s, st.events)).filter(l => l.startsWith(Name));
      const want = [`${Name} lost you: it has not seen you for ${N.LOSE_TRACK_TURNS} turns, and keeps watch where it stands.`,
        `${Name} stopped keeping watch for you, and is settling where it stands.`, `${Name} settled back to sleep.`];
      if (json(said) !== json(want)) problems.push(`${tag}: the log says ${json(said)}`);
    }
    // Searching where it stands, a noise makes it awake where it stands, looking at its own tile.
    {
      const s = room(3, { you: [13, 6] }), b = board(C, s), ev = [], Name = C.Labels.nameOf(s)(b.uid).replace(/^the/, 'The');
      blow(C, s, b, 1);
      C.Wake.setMode(s, b, 'searching', { k: 'out_of_sight', turns: N.LOSE_TRACK_TURNS }, ev);
      C.Wake.hear(s, b, { x: 6, y: 1, cls: 'soft', range: 3, by: 'you' }, 2, ev);
      const e = ev.find(x => x.k === 'alerted');
      assert.equal(json([b.mode, b.target, e && e.cause.how, e && e.x, e && e.y]), json(['awake', AT, 'stands', AT[0], AT[1]]));
      assert.equal(say(C, s, e), `${Name} heard a soft noise 2 tiles away, and is awake where it stands.`);
    }
    // A hunter that steps keeps its story (a sentence that names how: 'stands' only for one).
    const e = { k: 'lost', turn: 9, who: 'x', from: 'hunting', to: 'searching', cause: { k: 'out_of_sight', turns: 8 } };
    assert.equal(C.Text.event(e, () => 'the dummy'), 'The dummy lost you: it has not seen you for 8 turns, and searches where it last knew you were.');
    // Who stands: a station (which never hunts), the Board and the Ordinance's pieces; not a plodder.
    const t = room(2, { more: [{ sp: 'M11.2', at: [2, 6], mode: 'dormant', stats: Roles.stats('controller', 2), room: 'centre' }, { sp: 'M11.5', at: [2, 1], mode: 'dormant', stats: Roles.stats('fodder', 2), room: 'centre' }] });
    assert.equal(json(t.actors.slice(1).map(a => [a.sp, C.Wake.stands(t, a)])), json([['M11.2', true], ['M11.5', false], ['M11.11', true]]));
    assert.deepEqual(problems, []);
  });

  test('woken by noise out of its sight, it wakes where it stands and is sent nowhere; undisturbed, it settles where it stands and sleeps; a Re-admission Ticket read in its sealed hall leaves it keeping watch, then settling, where it stands; joined up at depth 3', () => {
    // A small hall (x 1–4) behind a closed door (5,2), and a room east of it: the Board on (3,1),
    // three fixed casts beside you at (7,1–3), each destroyed with a loud noise it hears.
    const DMAP = ['##########', '#....#...#', '#....+...#', '#....#...#', '##########'];
    const DROOMS = [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 4, y1: 3 }, { key: 's1', role: 'section', x0: 6, y0: 1, x1: 8, y1: 3 }];
    const cast = y => ({ sp: 'dummy', at: [7, y], mode: 'dormant', statuses: [{ id: 'fixed', turns: 9999 }], stats: { hp: 1, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } });
    const s = room(3, { map: DMAP, rooms: DROOMS, at: [3, 1], you: [8, 2], fixtures: [], entrance: [8, 2], more: [cast(1), cast(2), cast(3)] }), b = board(C, s);
    const Name = C.Labels.nameOf(s)(b.uid).replace(/^the/, 'The');
    const casts = s.actors.filter(a => a.sp === 'dummy').map(a => a.uid);
    const r = H.play(C, s, (st, i) => i < 3 ? { a: 'attack', uid: casts[i] } : board(C, st).mode === 'dormant' || i > 40 ? null : WAIT, { inv: 'all', clone: true, cap: 45 });
    assert.deepEqual([...bad(r, 'noise'), ...story(C, s, r, b.uid, 'noise')], []);
    const said = r.steps.flatMap(st => log(C, s, st.events)).filter(l => l.startsWith(Name) && !/stirs/.test(l));
    assert.equal(json(said), json([`${Name} woke: it heard a loud noise.`, `${Name} is settling where it stands: nothing has disturbed it for ${N.AWAKE_IDLE_TURNS} turns.`, `${Name} settled back to sleep.`]));
    const woke = r.events.find(e => e.k === 'woke' && e.who === b.uid);
    assert.equal(json([woke.mode, woke.cause.how, b.x, b.y]), json(['awake', 'stands', 3, 1]));
    // The Ticket, read sealed in the hall (MAP) with it hunting you: it loses you and keeps watch
    // where it stands, the shutters open and it settles where it stands, settling in there at its
    // next action (in the Ticket's step, so told once, by the shutters' sentence), then sleeps.
    const t = room(3, { you: [7, 3] }), tb = board(C, t), TName = C.Labels.nameOf(t)(tb.uid).replace(/^the/, 'The');
    C.Consumables.startRun(t);
    const tk = C.Consumables.make(t, 'ticket', { at: 'tote' });
    t.run.knownSeals.push(C.Consumables.sealFor(t, 'ticket'));
    blow(C, t, tb, 1);
    const q = H.play(C, t, (st, i) => i === 0 ? WAIT : i === 1 ? { a: 'use', uid: tk.uid } : board(C, st).mode === 'dormant' || i > 20 ? null : WAIT, { inv: 'all', clone: true, cap: 25 });
    assert.deepEqual([...bad(q, 'ticket'), ...story(C, t, q, tb.uid, 'ticket')], []);
    const told = q.steps.flatMap(st => log(C, t, st.events)).filter(l => l.startsWith(TName) && !/regained|hunting you/.test(l));
    assert.equal(json(told), json([`${TName} lost you, and keeps watch where it stands: you went back to the entrance.`, `${TName} is settling where it stands, since the shutters opened.`,
      `${TName} settled back to sleep.`]));
    const step = q.steps.find(st => st.events.some(e => e.k === 'returned' && e.who === tb.uid && e.phase === 'arrived'));
    assert.ok(step && step.events.some(e => e.k === 'lost' && e.who === tb.uid && e.cause.k === 'hall'), 'it settled in at once, in the step the shutters opened');
    assert.equal(say(C, t, step.events.find(e => e.k === 'returned')), `${TName} is settling in where it stands.`);
  });

  // ---- The chime's forecast, which a summons that calls a reflector widens ----

  test('the chime\'s forecast (HourlyDemonstration.reach) counts a body a summons could call: with the Board\'s Logbook Trolleys (no reflector) a station\'s forecast is its forward run; with a planted summons that calls a Reflecting Dish, now or from phase 2, its tile and the run behind it too', () => {
    const forecast = (X, phase2) => {
      const s = room(3, { core: X, you: [8, 1], more: [{ sp: 'M11.2', at: [3, 6], mode: 'dormant', stats: Roles.stats('controller', 3), room: 'centre', ax: {} }] });
      const st = s.actors.find(a => a.sp === 'M11.2'), b = board(X, s);
      st.route = { dir: 'E' };
      if (phase2) toPhase2(X, s, b);
      return { reach: X.HourlyDemonstration.reach(s, st, s.turn + 2), calls: X.Tableau.callsReflector(s) };
    };
    const fwd = [[4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6]], back = [[1, 6], [2, 6], [3, 6]];
    for (const phase2 of [false, true]) assert.equal(json(forecast(C, phase2)), json({ reach: fwd, calls: false }), `trolleys, phase 2 ${phase2}`);
    const X = loadCore();
    X.Packs.get('M11').centrepiece.summons = 'M11.4';
    for (const phase2 of [false, true]) assert.equal(json(forecast(X, phase2)), json({ reach: back.concat(fwd).sort((p, q) => p[1] - q[1] || p[0] - q[0]), calls: true }), `a dish, phase 2 ${phase2}`);
  });
};
