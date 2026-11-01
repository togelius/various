// ACCESSION — M.11's Centrepiece, the Great Board of the Central Station: its attachments and its
// hall's rain case (BUILD.md §5.4, §5.5, §8.1, §8.2, §8.4; M4 plan TABLEAU-PHASES, D3.7, D3.9,
// D3.12; decided without play; revisit once M4 is playable). Its core stays at ready false, so no
// department places it: these tests place the real record with Centrepiece.place in a room with
// a hall and its case (the harness's rooms; M.11's modules made as a department makes them,
// the hall's case given rain as weather_cases gives it), or plant the core ready for departments,
// every invariant checked after every step, the main runs clone-checked. What each test expects
// is worked out here from BUILD's sentences, not from the code:
//   - the Repeater Arm (M11.11a): a station (demonstrator + clockwork, flagged with the chime and
//     the weather, so M.11.2's line, word for word), standing beside the hall's case within its
//     weather's square, its line along N, E, S or W, out and back never across the Board, the
//     longest no other exhibit stands on; it performs on every chime, every DEMO_PERIOD_HALL
//     turns counted from entry, sealed or not, and the rain from its case stops it;
//   - the Board Dish (M11.11b): a reflector with the Board's own rule (MODIFIERS.tab_screen):
//     set apart from the Board (beyond your ring and a soft noise from every tile beside it,
//     out of its rows and columns and of the Arm's line), the Board's second phase wakes it,
//     hunting you, and hunting while the Board stands it strikes you if it can, else walks
//     toward the free tile of the hall beside the Board nearest where it last knew you were and
//     waits there, so it stands between you and the Board and sends your shots back;
//   - neither is a piece of the Board (dept.cp.uids is its body alone); nothing is drawn;
//   - the chime's forecast never under-warns when the Dish steps into a line;
//   - the sample's side-door Heliographs of phase 3 are cut: nothing promises them.
'use strict';
const H = require('./_harness.js');
const Inv = require('../../tools/invariants.js');

module.exports = ({ test, assert, loadCore, root, path }) => {
  const json = JSON.stringify;
  const DEPTHS = H.DEPTHS;
  const LINES = require(path.join(root, 'test/m4-lines.test.js'));
  const C = loadCore(), { N, Int, Roles } = C;
  const WAIT = { a: 'wait' };
  const ARM = 'M11.11a', DISH = 'M11.11b', SCREEN = 'tab_screen';
  // The hall (x 1–13, y 1–10) with its case on the north wall (4,1), and a gallery east of it
  // (x 15–19), joined by an archway (14,5) and a staff door (14,8); the footprint's top-left
  // tile (6,5), so the Board stands on 6–7 × 5–6: its rows 5 and 6, its columns 6 and 7.
  const MAP = ['#####################', '#...v.........#.....#', '#.............#.....#', '#.............#.....#', '#.............#.....#', '#.............,.....#',
    '#.............#.....#', '#.............#.....#', '#.............S.....#', '#.............#.....#', '#.............#.....#', '#####################'];
  const ROOMS = [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 13, y1: 10 }, { key: 's1', role: 'section', x0: 15, y0: 1, x1: 19, y1: 10 }];
  const AT = [6, 5], CASE = [4, 1];
  const GARMENT = { uid: 'g2', kind: 'garment', form: 'standard', tier: 3, where: { at: 'tote' } };
  const PD = 'tab.pd', PIN = { uid: PD, kind: 'instrument', form: 'pin_driver', where: { at: 'kit', slot: 'instrument' }, tier: 1 };

  // A room with the hall, its case and the Board placed on its footprint (Centrepiece.place,
  // which sets out its attachments), then M.11's modules made (Modules.init, as a department
  // makes them after the Centrepiece) and the hall's case given rain (weather_cases' rule for
  // the hall; a room for tests draws none). o: you, more exhibits, items, options, case (false:
  // none), weather (null: none), at (the footprint), core (X).
  function room(depth, o) {
    o = o || {};
    const X = o.core || C;
    const at = o.caseAt || CASE;
    const fixtures = (o.case === false ? [] : [X.Cases.make({ x: at[0], y: at[1], room: 'centre', glass: 1, lock: 1, num: 'M.11.1.1' })]).concat([{ k: 'staff', x: 14, y: 8, grade: 1 }]);
    const s = H.room(X, o.seed || 1, { acc: 'M11', depth, map: o.map || MAP, you: o.you || [10, 8], exhibits: o.more || [], rooms: ROOMS, clock: o.clock || { B: 300, G: 60 }, entrance: [17, 5],
      fixtures, items: o.items || [] }, o.options || {});
    s.actors[0].maxHp = 999; s.actors[0].hp = 999;
    X.Centrepiece.place(s, { cpl: o.at || AT }, X.Packs.get('M11'));
    X.Modules.init(s, X.Packs.get('M11'));
    const f = o.case === false ? null : X.Cases.at(s, at[0], at[1]);
    if (f && o.weather !== null && X.WeatherCases.of(s)) f.weather = 'rain';
    return s;
  }
  const board = (X, s) => X.Centrepiece.pieces(s)[0];
  const one = (s, sp) => s.actors.find(a => a.sp === sp) || null;
  const bad = (r, tag) => r.violations.map(v => `${tag}: ${v.id || v.inv}: ${v.text}`);
  const log = (X, s, events) => X.Text.log(events, X.Labels.nameOf(s), () => true);
  const Name = (X, s, uid) => X.Labels.nameOf(s)(uid).replace(/^the/, 'The');
  // A blow straight to the Board (Combat.hurt, as your blow lands), for a planted state.
  const blow = (X, s, a, n) => { const ev = []; X.Combat.hurt(s, a, n, { k: 'attack', by: 'you', at: a.uid, chance: 100, raw: n, pad: 0, how: { kind: 'melee' }, from: [s.actors[0].x, s.actors[0].y] }, ev); return ev; };
  const toPhase2 = (X, s, a) => blow(X, s, a, a.hp - Int.pct(a.maxHp, N.CP_PHASE_PCT[0]));
  const rowMajor = (p, q) => p[1] - q[1] || p[0] - q[0];
  const key = t => `${t[0]},${t[1]}`;

  // ---- Its record, the attachments' lines, and what nothing promises ----

  // A sentence's first letter made large.
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  // The Board Dish's line, from BUILD's words (§5.5): a reflector's (M11.4's archetype, at its
  // role), then the Board's rule for it, then the wake clause.
  function dishLine(d) {
    const r = Roles.stats('controller', d), dmg = r.dmin === r.dmax ? String(r.dmin) : `${r.dmin}–${r.dmax}`;
    return [`Walks one tile at a time; sends beams back along their line, and shots back into whoever fired them, so nothing behind it is hit; a beam marked before it stepped into its line goes on through it; strikes from beside you for only ${dmg}.`,
      'The Great Board’s second phase wakes it at once, hunting you; hunting while the Board stands, it strikes you if it can, else walks toward the free tile of the hall beside the Board nearest where it last knew you were, and waits there.',
      'Wakes when you stay inside your ring or make noise near it.'].join(' ');
  }
  const CTXS = [[], ['hourly_demonstration'], ['weather_cases'], ['hourly_demonstration', 'weather_cases'], ['clockwork'], [SCREEN]];
  test('its attachments (content/M11-cp.js): the Repeater Arm (M11.11a), a station with M.11.2\'s archetype, modifier, trigger and flags, and so M.11.2\'s line word for word; the Board Dish (M11.11b), a reflector with the Board\'s rule (MODIFIERS.tab_screen); each a species found by its id; each line within the strip\'s 14 rows at depths 1–7, every module and modifier on or off', () => {
    const pack = C.Packs.get('M11'), rec = pack.centrepiece, st = C.Packs.species('M11', 'M11.2'), dish = C.Packs.species('M11', 'M11.4');
    const [arm, dsh] = rec.attachments;
    assert.equal(json(rec.attachments.map(q => [q.id, q.archetype, q.role, q.modifiers, q.trigger, q.flags || [], q.stands, q.sprite])),
      json([[ARM, 'demonstrator', 'controller', ['clockwork'], 'period', ['hourly_demonstration', 'weather_cases'], 'case', 'semaphore'], [DISH, 'reflector', 'controller', [SCREEN], null, [], 'apart', 'reflecting_dish']]));
    assert.equal(json([arm.archetype, arm.role, arm.modifiers, arm.trigger, arm.flags]), json([st.archetype, st.role, st.modifiers, st.trigger, st.flags]));
    assert.equal(json([dsh.archetype, dsh.role, dsh.sprite]), json([dish.archetype, dish.role, dish.sprite]));
    // Their labels' words (§5.2): a name, a tombstone, a paragraph of 40–70 words.
    for (const q of rec.attachments) { const n = q.paragraph.split(/\s+/).length; assert.ok(q.name && q.tomb.maker && q.tomb.credit && n >= 40 && n <= 70, `${q.id}: ${n} words`); }
    // Found by its id (Packs.speciesFor), in its department and in another's room.
    const s = room(3);
    for (const q of rec.attachments) {
      assert.equal(C.Packs.speciesFor(s, one(s, q.id)), q);
      assert.equal(C.Packs.speciesFor({ dept: { acc: 'S9' } }, { sp: q.id }), q);
    }
    assert.ok(C.Packs.sprites().some(u => u.id === ARM && u.archetype === 'demonstrator') && C.Packs.sprites().some(u => u.id === DISH && u.archetype === 'reflector'));
    const problems = [];
    let most = 0;
    for (const d of DEPTHS) for (const off of CTXS) {
      const ctx = { depth: d, rulesOff: off }, a = C.Clauses.line(arm, ctx), b = C.Clauses.line(dsh, ctx);
      if (a !== C.Clauses.line(st, ctx)) problems.push(`d${d} off ${off}: the Arm's line is not M.11.2's: ${a}`);
      if (b !== (off.includes(SCREEN) ? C.Clauses.line(dish, ctx) : dishLine(d))) problems.push(`d${d} off ${off}: the Dish's line: ${b}`);
      for (const [who, l] of [['Arm', a], ['Dish', b]]) { most = Math.max(most, LINES.rows(l)); if (LINES.rows(l) > LINES.METRICS.budgetRows) problems.push(`d${d} off ${off}: the ${who}'s line takes ${LINES.rows(l)} rows`); }
    }
    assert.deepEqual(problems, []);
    assert.equal(most, 14);
    // The Board's rule for the Dish: a sentence, no digit, ready; with the modifier switched off
    // the Dish's line is a plain reflector's (above), and so is what it does (below).
    const M = C.Registry.MODIFIERS[SCREEN];
    assert.ok(/^[A-Z].*\.$/.test(M.clause) && !/[0-9]/.test(M.clause) && M.ready === true && M.built === 'M4');
    assert.equal(json([C.Registry.WAKE_CAUSES.tab_phase.mode, C.Registry.WAKE_CAUSES.tab_phase.creation]), json(['hunting', false]));
  });

  test('the side-door Heliographs of the sample\'s phase 3 are cut (plan D3.7): no line, strip, label text, name or paragraph of the Board or its attachments speaks of a side door, of anything mounted, or of Heliographs; the Board\'s own line and strips are as TABLEAU-CORE left them', () => {
    const rec = C.Packs.get('M11').centrepiece, texts = [rec.name, rec.paragraph, rec.gateway];
    for (const q of rec.attachments) texts.push(q.name, q.paragraph, q.tomb.medium);
    for (const d of DEPTHS) {
      texts.push(C.Clauses.line(rec, { depth: d }));
      for (const k of [1, 2, 3]) texts.push(C.Clauses.strip(rec, { depth: d, phase: k }));
      for (const q of rec.attachments) texts.push(C.Clauses.line(q, { depth: d }));
    }
    for (const t of texts) assert.ok(!/side[- ]door|mounted|heliographs/i.test(t), t);
    // Its phases' parts are TABLEAU-CORE's: the Dish's waking is the Dish's own rule, on its label.
    assert.equal(json(rec.phases), json([{ parts: ['SPECIALS.cp_line', 'SPECIALS.cp_burst'] }, { parts: ['CLAUSES.tab_summon'], specials: ['summon'] }, { parts: ['CLAUSES.tab_quick'] }]));
    assert.equal(LINES.rows(C.Clauses.line(rec, { depth: 7 })), 30);
    assert.equal(Math.max(...DEPTHS.flatMap(d => [1, 2, 3].map(k => LINES.rows(C.Clauses.strip(rec, { depth: d, phase: k }))))), 11);
    // The attachments' paragraphs claim no place (m4-packs' paragraph lint's words).
    for (const q of rec.attachments) assert.ok(!/\bin front of it\b|\b(in|at|into|inside) the Central Station\b|\b(in|inside) (a|the|its|this) (case|vitrine|cabinet)\b|\b(beside|next to|by) the (north|south|east|west)\b/i.test(q.paragraph), q.paragraph);
  });

  // ---- Where they stand ----

  // Where BUILD's sentences put them (§5.5), worked out from the state: occupied, the tiles any
  // actor but the attachments stands on (and the Arm's, for the Dish).
  const roomAt = (m, x, y) => m.roomOf[y] ? m.roomOf[y][x] : null;
  function runOf(m, room, x, y, k) {
    const out = [];
    for (let i = x + C.Grid.DX[k], j = y + C.Grid.DY[k]; C.Grid.inside(m, i, j) && roomAt(m, i, j) === room && C.Grid.seeThrough(m, i, j); i += C.Grid.DX[k], j += C.Grid.DY[k]) out.push([i, j]);
    return out;
  }
  function model(X, s) {
    const m = s.dept, b = board(X, s), hall = roomAt(m, b.x, b.y), mine = [ARM, DISH];
    const takenBy = (x, y, but) => s.actors.some(a => !a.gone && !(but || []).includes(a.sp) && X.Actors.covers(a, x, y));
    const free = (x, y, but) => X.Grid.inside(m, x, y) && roomAt(m, x, y) === hall && X.Grid.walkable(m, x, y, 'exhibit') && !X.Grid.closedDoor(m, x, y) && !takenBy(x, y, but);
    // The Arm: beside the hall's first real case, within its weather's square, nearest the Board.
    const f = m.fixtures.find(c => c.k === 'case' && !c.mimic && roomAt(m, c.x, c.y) === hall);
    let arm = null;
    if (f) {
      const near = [];
      for (let y = f.y - 1; y <= f.y + 1; y++) for (let x = f.x - 1; x <= f.x + 1; x++) if (free(x, y, mine)) near.push([x, y]);
      arm = near.sort((p, q) => X.Actors.dist(b, p[0], p[1]) - X.Actors.dist(b, q[0], q[1]) || rowMajor(p, q))[0] || null;
    }
    if (!arm) for (let y = b.y - 1; y <= b.y + 2 && !arm; y++) for (let x = b.x - 1; x <= b.x + 2 && !arm; x++) if (X.Actors.dist(b, x, y) === 1 && free(x, y, mine)) arm = [x, y];
    // Its line: N, E, S, W, out and back never on the Board; the longest no one stands on.
    let dir = null, most = -1, clear = null, longest = -1, runs = [];
    for (const [d, k] of [['N', 0], ['E', 2], ['S', 4], ['W', 6]]) {
      const fwd = runOf(m, hall, arm[0], arm[1], k), back = runOf(m, hall, arm[0], arm[1], (k + 4) % 8);
      if (fwd.concat(back).some(t => X.Actors.covers(b, t[0], t[1]))) continue;
      const met = fwd.some(t => s.actors.some(a => !a.gone && a.uid !== 'you' && !mine.includes(a.sp) && X.Actors.covers(a, t[0], t[1])));
      if (fwd.length > most) { most = fwd.length; dir = d; }
      if (!met && fwd.length > longest) { longest = fwd.length; clear = d; }
    }
    dir = clear !== null && longest > 0 ? clear : dir;
    const k = { N: 0, E: 2, S: 4, W: 6 }[dir];
    runs = runOf(m, hall, arm[0], arm[1], k).concat(runOf(m, hall, arm[0], arm[1], (k + 4) % 8)).map(key);
    // The Dish: apart; out of the Board's rows and columns first; then the nearest at FAR or
    // more walking tiles from the footprint, else the farthest; never within RING_STILL + 1 of
    // the reading tile, nor on the Arm's runs.
    const FAR = Math.max(N.RING_MOVING, N.NOISE_SOFT) + 2, d = X.Grid.distances(m, X.Actors.footprint(b), m.w * m.h, null, 'exhibit');
    const view = m.viewTile ? X.Grid.distances(m, [m.viewTile], 99) : null, list = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const v = d[y * m.w + x];
      if (v < 1 || !free(x, y, [DISH]) || runs.includes(key([x, y])) || (arm[0] === x && arm[1] === y)) continue;
      if (view) { const r = X.Grid.reachDist(view, m, x, y); if (r >= 0 && r <= N.RING_STILL + 1) continue; }
      const axis = (x >= b.x && x < b.x + 2) || (y >= b.y && y < b.y + 2) ? 1 : 0;
      list.push([axis, v >= FAR ? 0 : 1, v >= FAR ? v : -v, y, x]);
    }
    list.sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2] || p[3] - q[3] || p[4] - q[4]);
    return { arm, dir, dish: list.length ? [list[0][4], list[0][3]] : null, caseAt: f ? [f.x, f.y] : null, runs };
  }
  // Each of them, as placed: who, where, asleep, the role's numbers, no piece of the Board.
  function placed(X, s, tag) {
    const out = [], b = board(X, s), want = model(X, s), m = s.dept, n = Number(b.uid.split('.').pop());
    const arm = one(s, ARM), dish = one(s, DISH);
    if (!arm || !dish) return [`${tag}: placed ${json(s.actors.map(a => a.sp))}`];
    const role = Roles.stats('controller', m.depth);
    for (const [a, i] of [[arm, 1], [dish, 2]]) {
      if (a.uid !== `${m.acc}.${m.depth}.${s.dept.cp.room}.${n + i}` || a.mode !== 'dormant' || a.hp !== role.hp || a.maxHp !== role.hp || a.dmin !== role.dmin || a.dmax !== role.dmax || a.role !== 'controller')
        out.push(`${tag}: ${a.sp} is ${json([a.uid, a.mode, a.hp, a.dmin, a.dmax, a.role])}`);
    }
    if (json([arm.x, arm.y, arm.route, arm.arch, arm.mods]) !== json([want.arm[0], want.arm[1], { dir: want.dir }, 'demonstrator', ['clockwork']])) out.push(`${tag}: the Arm at ${json([arm.x, arm.y, arm.route])}, not ${json(want)}`);
    if (json([dish.x, dish.y, dish.arch, dish.mods]) !== json([want.dish[0], want.dish[1], 'reflector', [SCREEN]])) out.push(`${tag}: the Dish at ${json([dish.x, dish.y])}, not ${json(want.dish)}`);
    if (json(s.dept.cp.uids) !== json([b.uid])) out.push(`${tag}: its pieces ${json(s.dept.cp.uids)}`);
    // The Arm's line, marked now or at any chime, out and back (a reflector present, the Dish,
    // could turn it: HourlyDemonstration.reach with no chime given), never takes a tile of the Board.
    if (X.HourlyDemonstration.line(s, arm).concat(X.HourlyDemonstration.reach(s, arm)).some(t => X.Actors.covers(b, t[0], t[1]))) out.push(`${tag}: the Arm's line can cross the Board`);
    return out;
  }

  test('placed with the Board, at depths 1–7: the Repeater Arm beside the hall\'s case, nearest the Board, its line out and back never across the Board (east here, along the hall\'s second row); the Board Dish apart, out of the Board\'s rows and columns and the Arm\'s line, beyond your ring and a soft noise from every tile beside the Board; each asleep with its role\'s numbers, its uid the hall\'s next after the Board\'s, no piece of the Board; nothing drawn', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const s = room(depth), tag = `d${depth}`;
      problems.push(...placed(C, s, tag));
      if (json([one(s, ARM).x, one(s, ARM).y, one(s, ARM).route.dir, one(s, DISH).x, one(s, DISH).y]) !== json([3, 2, 'E', 1, 1])) problems.push(`${tag}: ${json(C.Tableau.attachments(s).map(a => [a.x, a.y, a.route]))}`);
      if (json(s.rng) !== '{}') problems.push(`${tag}: placing them drew on ${json(Object.keys(s.rng))}`);
      if (json(C.Tableau.attachments(s).map(a => a.sp)) !== json([ARM, DISH])) problems.push(`${tag}: Tableau.attachments`);
    }
    // The Arm stands within its case's weather (WEATHER_SIZE, centred on the case).
    const s = room(4);
    assert.ok(C.Grid.covers({ x: CASE[0], y: CASE[1], size: N.WEATHER_SIZE }, one(s, ARM).x, one(s, ARM).y));
    // Beside a case in the Board's row, columns north and south of it: its longest run, west
    // (4 tiles), would come back across the Board from a reflector, so its line runs south (2).
    const MAP2 = MAP.map((row, y) => [...row].map((c, x) => (x === 4 && y === 4) ? 'v' : (x === 5 && (y === 3 || y === 4 || y === 8)) ? 'o' : c).join(''));
    const u = room(4, { map: MAP2, caseAt: [4, 4] });
    problems.push(...placed(C, u, 'in its row'));
    assert.equal(json([one(u, ARM).x, one(u, ARM).y, one(u, ARM).route]), json([5, 5, { dir: 'S' }]));
    // With no case in the hall, the Arm stands beside the Board (the first such tile, row-major),
    // its line still missing the Board.
    const t = room(4, { case: false });
    problems.push(...placed(C, t, 'no case'));
    assert.equal(json([one(t, ARM).x, one(t, ARM).y]), json([5, 4]));
    // One that options.without names is made and at once gone: the other keeps its uid and tile.
    const w = room(4, { options: { without: ['M11.4.centre.2'] } });
    assert.equal(json(C.Tableau.attachments(w).map(a => [a.uid, a.gone, a.x, a.y])), json([['M11.4.centre.2', 1, 3, 2], ['M11.4.centre.3', 0, 1, 1]]));
    // An attachment waits while its archetype, a modifier or its trigger is at ready false.
    const X = loadCore();
    X.Registry.MODIFIERS[SCREEN].ready = false;
    assert.equal(json(X.Tableau.attachments(room(4, { core: X })).map(a => a.sp)), json([ARM]));
    // Placed only with the Board: a room with no Centrepiece, and a real department (its core at
    // ready false), have none.
    assert.equal(json(C.Tableau.attachments(C.Dept.create(1, 'M11', 3))), '[]');
    assert.deepEqual(problems, []);
  });

  test('departments, with the Board\'s core planted ready (M.11, seeds 1–8, depths 1, 4 and 7): every hall with a case has the Repeater Arm within that case\'s rain (the hall\'s case holds rain), and the Board Dish keeps population\'s rule for the reading tile; both stand where BUILD\'s rule puts them, the same with weather_cases and the chime switched off', () => {
    const X = loadCore();
    X.Registry.ARCHETYPES.mp_tableau.ready = 'unit';
    const problems = [];
    let rain = 0, halls = 0;
    for (let seed = 1; seed <= 8; seed++) for (const depth of [1, 4, 7]) {
      const s = X.Dept.create(seed, 'M11', depth), tag = `seed ${seed} d${depth}`, want = model(X, s), arm = one(s, ARM);
      halls++;
      problems.push(...placed(X, s, tag));
      if (want.caseAt) {
        const f = X.Cases.at(s, want.caseAt[0], want.caseAt[1]);
        if (f.weather !== 'rain' || !X.Grid.covers({ x: f.x, y: f.y, size: N.WEATHER_SIZE }, arm.x, arm.y)) problems.push(`${tag}: the case ${json(f)} and the Arm at ${arm.x},${arm.y}`);
        else rain++;
      }
      const off = X.Dept.create(seed, 'M11', depth, { rulesOff: ['weather_cases', 'hourly_demonstration'] });
      if (json(X.Tableau.attachments(off).map(a => [a.uid, a.x, a.y, a.route])) !== json(X.Tableau.attachments(s).map(a => [a.uid, a.x, a.y, a.route]))) problems.push(`${tag}: placed otherwise with the modules off`);
    }
    assert.deepEqual(problems, []);
    assert.ok(rain >= halls - 1, `${rain} of ${halls} halls have the Arm in their case's rain`);
  });

  // ---- The Repeater Arm: its line on every chime, sealed or not; rain stops it ----

  const SP = 'demo_line', W = N.DEMO_WARNING, P = N.DEMO_PERIOD_HALL;
  const upTo = (n, f) => { const out = []; for (let t = 1; t <= n; t++) if (f(t)) out.push(t); return out; };
  const armMarks = (r, uid) => r.events.filter(e => e.k === 'telegraphed' && e.who === uid && e.sp === SP);
  const armHits = (r, uid) => r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.k === 'special' && e.cause.by === uid && e.cause.sp === SP);
  // The Arm's line on this map: east from (3,2), along the hall's second row to its east wall.
  const ARM_LINE = upTo(13, x => x >= 4).map(x => [x, 2]);

  test('the Repeater Arm performs its line on every chime: while the Great Board hunts you in its sealed hall (the clock stopped), its chime still comes every DEMO_PERIOD_HALL (8) turns counted from entry, marked DEMO_WARNING turns before each multiple and going off on it, striking you on its line for what it showed; at depths 1–7, clone-checked at 1, 4 and 7', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const s = room(depth, { you: [10, 2] }), b = board(C, s), arm = one(s, ARM), tag = `d${depth}`;
      blow(C, s, b, 1);
      const turns = 3 * P + 2, r = H.play(C, s, Array(turns).fill(WAIT), { inv: 'all', clone: depth % 3 === 1 });
      problems.push(...bad(r, tag));
      const sealed = r.events.find(e => e.k === 'stage' && e.stage === 'sealed');
      if (!sealed || sealed.turn !== 1 || r.events.some(e => e.k === 'stage' && e.stage === 'unsealed') || !C.Clock.sealed(r.state) || r.state.dept.clock.count !== 0) problems.push(`${tag}: sealed ${json(sealed)}, the clock at ${r.state.dept.clock.count}`);
      const marks = armMarks(r, arm.uid), hits = armHits(r, arm.uid), gross = C.Specials.info(r.state, SP).gross;
      if (json(marks.map(e => e.turn)) !== json(upTo(turns, t => t % P === P - W))) problems.push(`${tag}: marked at ${json(marks.map(e => e.turn))}`);
      if (marks.some(e => json(e.tiles) !== json(ARM_LINE))) problems.push(`${tag}: marked ${json(marks.map(e => e.tiles))}`);
      if (json(hits.map(e => [e.turn, e.amount])) !== json(upTo(turns, t => t % P === 0).map(t => [t, Math.max(N.DMG_MIN_ON_HIT, gross - s.actors[0].pad)]))) problems.push(`${tag}: struck ${json(hits.map(e => [e.turn, e.amount]))}`);
      if (b.mode !== 'hunting' || r.events.some(e => e.who === b.uid && e.k === 'moved')) problems.push(`${tag}: the Board ${b.mode}`);
      // The dial of the hall (vm's chime): its period and its next chime, sealed or not; the
      // chip says the chime still sounds.
      const nx = C.HourlyDemonstration.next(r.state, roomAt(r.state.dept, b.x, b.y));
      if (json(nx) !== json({ next: P - W - (turns % P) + (turns % P > P - W ? P : 0), period: P })) problems.push(`${tag}: the dial ${json(nx)}`);
    }
    const s = room(3, { you: [10, 2] }), b = board(C, s);
    blow(C, s, b, 1);
    const r = H.play(C, s, Array(3).fill(WAIT), { inv: 'all' });
    const v = Object.assign({ sealed: C.Clock.sealed(r.state), chime: C.Modules.on(r.state, 'hourly_demonstration') }, C.Clock.view(r.state));
    assert.equal(json(C.Text.stage(v)), json({ name: 'Sealed:', next: 'the clock is stopped, the chime still sounds' }));
    assert.deepEqual(problems, []);
  });

  test('rain stops the Repeater Arm: its hall\'s case, opened, lets rain out over it, which calls off the line it had marked ("it was fixed in place") and holds it fixed while it stands in rain and RAIN_STOP_TURNS turns after, so the next chime marks nothing and the one after marks again; with weather_cases switched off the case lets nothing out and the line goes off; at depths 1–7, clone-checked at 1, 4 and 7', () => {
    const problems = [];
    for (const depth of DEPTHS) for (const off of [false, true]) {
      const tag = `d${depth}${off ? ' off' : ''}`;
      const s = room(depth, { you: [5, 1], options: off ? { rulesOff: ['weather_cases'] } : {} }), arm = one(s, ARM);
      // Wait until the Arm has marked its line, then open its case.
      let opened = -1;
      const r = H.play(C, s, (st, i) => {
        if (i > 3 * P + 2) return null;
        if (opened < 0 && one(st, ARM).telegraph) { opened = st.turn; return { a: 'open', x: CASE[0], y: CASE[1] }; }
        return WAIT;
      }, { inv: 'all', clone: depth % 3 === 1, cap: 3 * P + 5 });
      problems.push(...bad(r, tag));
      const marks = armMarks(r, arm.uid).map(e => e.turn), gone = r.events.filter(e => e.k === 'special' && e.who === arm.uid && e.sp === SP && !e.cancelled).map(e => e.turn);
      const rain = r.events.find(e => e.k === 'surface' && e.kind === 'rain');
      if (off) {
        if (rain || json(marks) !== json(upTo(3 * P + 3, t => t % P === P - W && t <= r.state.turn)) || !gone.includes(P)) problems.push(`${tag}: rain ${json(rain)}, marks ${json(marks)}, gone off ${json(gone)}`);
        continue;
      }
      // Fixed from its next turn to the boundary RAIN_STOP_TURNS after the rain's last turn
      // (the rain laid in turn t lies through t + WEATHER_TURNS).
      const fixed = r.events.find(e => e.k === 'status' && e.who === arm.uid && e.id === 'fixed');
      const called = r.events.find(e => e.k === 'cancelled' || (e.k === 'special' && e.who === arm.uid && e.cancelled));
      const free = opened + 1 + N.WEATHER_TURNS + N.RAIN_STOP_TURNS;
      if (!rain || !fixed || fixed.cause.k !== 'weather_cases' || json(fixed.cause.case) !== json(CASE)) problems.push(`${tag}: rain ${json(rain)}, fixed ${json(fixed)}`);
      if (!called) problems.push(`${tag}: its line was not called off: ${json(r.events.filter(e => e.who === arm.uid).map(e => [e.k, e.turn]))}`);
      const said = r.steps.flatMap(st => log(C, r.state, st.events)).filter(l => l.startsWith(Name(C, r.state, arm.uid)));
      if (!said.some(l => /line was called off: it was fixed in place/.test(l))) problems.push(`${tag}: the log says ${json(said)}`);
      // Its marks: the first (called off), none while fixed, then on time again.
      const want = upTo(3 * P + 3, t => t % P === P - W && t <= r.state.turn && (t <= opened || t >= free));
      if (json(marks) !== json(want)) problems.push(`${tag}: marked at ${json(marks)}, not ${json(want)} (opened at ${opened}, free at ${free})`);
      if (gone.includes(P)) problems.push(`${tag}: the called-off line went off`);
    }
    // The case's label, before it is opened, names the Arm as Labels does ("the Board’s Repeater
    // Arm", never "the The …").
    const s = room(4), f = C.Cases.at(s, CASE[0], CASE[1]), words = C.WeatherCases.words(s, f);
    assert.equal(words[1], `While the Board’s Repeater Arm stands in rain, and for ${N.RAIN_STOP_TURNS} turns after, it only waits, and any mark it has made is called off.`);
    assert.ok(C.Labels.ofCase(s, f).odds.includes(words[1]) && !json(C.Labels.ofCase(s, f)).includes('the The'), json(C.Labels.ofCase(s, f)));
    assert.deepEqual(problems, []);
  });

  // ---- The Board Dish: woken by the Board's second phase, it keeps in front of the Board ----

  // The tile it keeps to, from BUILD's words: of the free tiles of the hall beside the Board
  // (no one on them but the Dish), the nearest where it last knew you were (squared distance,
  // then row-major).
  function frontOf(X, s, d) {
    const b = board(X, s), at = d.lastKnown, list = [];
    for (let y = b.y - 1; y <= b.y + 2; y++) for (let x = b.x - 1; x <= b.x + 2; x++) {
      if (X.Actors.dist(b, x, y) !== 1 || roomAt(s.dept, x, y) !== roomAt(s.dept, b.x, b.y) || !X.Grid.walkable(s.dept, x, y, 'exhibit')) continue;
      if (s.actors.some(a => a !== d && !a.gone && X.Actors.covers(a, x, y))) continue;
      list.push([x, y]);
    }
    const sq = p => (p[0] - at[0]) ** 2 + (p[1] - at[1]) ** 2;
    return list.sort((p, q) => sq(p) - sq(q) || rowMajor(p, q))[0] || null;
  }
  const cheb = (p, q) => Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]));
  // Every step of the Dish while it hunts you and the Board stands: a blow at you from beside
  // you, a step that brings it nearer the tile it keeps to (worked out on the state after the
  // step, where it last knew you were), walking round the others where they stand (§8.2), or
  // none (it waits). A test-local invariant.
  const screening = X => ({
    id: 'tab.screen',
    check(pre, events, post) {
      const d = one(post, DISH), b = board(X, post);
      if (!d || d.gone || b.gone || d.mode !== 'hunting') return null;
      const was = one(pre, DISH);
      if (!was || was.mode !== 'hunting' || events.some(e => e.k === 'woke' && e.who === d.uid)) return null;
      const goal = frontOf(X, post, d), m = post.dept, far = m.w * m.h;
      const taken = (x, y) => post.actors.some(a => a !== d && !a.gone && X.Actors.covers(a, x, y));
      const walk = goal ? X.Grid.distances(m, [goal], far, (x, y) => taken(x, y) ? far + 1 : 0, 'exhibit') : null;
      const at = t => walk[t[1] * m.w + t[0]];
      for (const e of events) {
        if (e.k === 'moved' && e.who === d.uid && goal && !(at(e.to) >= 0 && at(e.to) < at(e.from)) && !(e.from[0] === goal[0] && e.from[1] === goal[1])) return `it stepped from ${e.from} to ${e.to}, no nearer ${goal}`;
        if ((e.k === 'attacked' || e.k === 'missed') && e.cause && e.cause.by === d.uid && e.cause.k === 'attack' && cheb([post.actors[0].x, post.actors[0].y], [d.x, d.y]) > 1) return 'it struck you from afar';
      }
      return null;
    },
  });
  const ALL = X => Inv.select(X, 'all').concat([screening(X)]);

  test('the Board Dish sleeps apart until the Board\'s second phase wakes it, hunting you ("… woke and began hunting you: the Great Board … entered its second phase."); then it walks to the free tile of the hall beside the Board nearest where it last knew you were and waits there, moves round the Board as you do, and strikes you when you pass beside it; at depths 1–7, clone-checked at 1, 4 and 7', () => {
    const problems = [];
    let blows = 0;
    for (const depth of DEPTHS) {
      const s = room(depth, { you: [10, 8] }), b = board(C, s), d = one(s, DISH), tag = `d${depth}`;
      // Phase 1: a blow wakes the Board; the Dish sleeps on.
      blow(C, s, b, 1);
      const r1 = H.play(C, s, Array(3).fill(WAIT), { inv: ALL(C) });
      problems.push(...bad(r1, `${tag} phase 1`));
      if (d.mode !== 'dormant' || d.x !== 1 || d.y !== 1) problems.push(`${tag}: in phase 1 the Dish is ${d.mode} at ${d.x},${d.y}`);
      // Phase 2: the Board's second phase wakes it at once, hunting you, by the Board.
      const ev = toPhase2(C, s, b), woke = ev.find(e => e.k === 'woke' && e.who === d.uid), hunt = ev.find(e => e.k === 'hunting' && e.who === d.uid);
      const ph = ev.findIndex(e => e.k === 'phase');
      if (!woke || !hunt || json(woke.cause) !== json({ k: 'tab_phase', by: b.uid }) || ev.indexOf(woke) < ph || d.mode !== 'hunting' || json(d.lastKnown) !== json([10, 8])) problems.push(`${tag}: ${json(ev.map(e => [e.k, e.who, e.cause]))}`);
      const said = log(C, s, ev);
      if (!said.includes(`${Name(C, s, d.uid)} woke and began hunting you: ${C.Labels.nameOf(s)(b.uid)} entered its second phase.`)) problems.push(`${tag}: the log says ${json(said)}`);
      // It walks to the tile beside the Board nearest you (8,7), and waits there.
      const r2 = H.play(C, s, Array(14).fill(WAIT), { inv: ALL(C), clone: depth % 3 === 1 });
      problems.push(...bad(r2, tag));
      if (json([d.x, d.y]) !== json([8, 7]) || json(frontOf(C, s, d)) !== json([8, 7])) problems.push(`${tag}: it stands at ${d.x},${d.y}`);
      const late = r2.events.filter(e => e.k === 'moved' && e.who === d.uid && e.turn > r2.state.turn - 4);
      if (late.length) problems.push(`${tag}: it kept moving: ${json(late)}`);
      // You walk west round the Board's south side, past it, to (2,8): it strikes you as you
      // pass beside it, and keeps to the tile nearest you, (5,7) there.
      const walk = [6, 6, 6, 6, 6, 6, 6, 6];
      const r3 = H.play(C, s, (st, i) => i < walk.length ? { a: 'move', dir: walk[i] } : i < walk.length + 10 ? WAIT : null, { inv: ALL(C), clone: depth % 3 === 1, cap: 30 });
      problems.push(...bad(r3, `${tag} walk`));
      blows += r3.events.filter(e => (e.k === 'attacked' || e.k === 'damaged' || e.k === 'missed') && e.cause && e.cause.k === 'attack' && e.cause.by === d.uid).length;
      if (json([s.actors[0].x, s.actors[0].y]) !== json([2, 8]) || json([d.x, d.y]) !== json([5, 7])) problems.push(`${tag}: you at ${s.actors[0].x},${s.actors[0].y}, it at ${d.x},${d.y}`);
    }
    assert.ok(blows >= DEPTHS.length, `it struck at you ${blows} times`);
    assert.deepEqual(problems, []);
  });

  test('the Board Dish stands between you and the Board: your Pin-Driver\'s bolts at the Board come back into you, and the Board\'s own beam, marked while the Dish stands in it, turns back into the Board (the Dish\'s doing); at depths 1, 4 and 7', () => {
    const problems = [];
    for (const depth of [1, 4, 7]) {
      const s = room(depth, { you: [11, 6], items: [PIN] }), b = board(C, s), d = one(s, DISH), tag = `d${depth}`;
      toPhase2(C, s, b);
      // It comes to stand in your row, in front of the Board (8,6).
      const r1 = H.play(C, s, st => one(st, DISH).x === 8 && one(st, DISH).y === 6 ? null : WAIT, { inv: ALL(C), cap: 20 });
      problems.push(...bad(r1, tag));
      if (d.x !== 8 || d.y !== 6) { problems.push(`${tag}: it stands at ${d.x},${d.y}`); continue; }
      const own = r1.events.filter(e => e.k === 'damaged' && e.who === b.uid && e.cause.k === 'reflected' && e.cause.by === d.uid && e.cause.shooter === b.uid);
      // Your bolts at the Board: each comes back into you.
      const r2 = H.play(C, s, (st, i) => i < N.PIN_DRIVER[0] ? { a: 'use', uid: PD, x: 7, y: 6 } : null, { inv: ALL(C) });
      problems.push(...bad(r2, `${tag} bolts`));
      const back = r2.events.filter(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.k === 'reflected' && e.cause.shooter === 'you');
      if (back.length !== N.PIN_DRIVER[0] || back.some(e => (e.who || e.at) !== 'you' || e.cause.by !== d.uid)) problems.push(`${tag}: bolts back ${json(back)}`);
      if (r2.events.some(e => e.k === 'damaged' && e.who === b.uid && e.cause.by === 'you')) problems.push(`${tag}: a bolt reached the Board`);
      // The Board's beam toward you, marked with the Dish in its way, struck the Board.
      const r3 = H.play(C, s, (st, i) => i > 12 ? null : WAIT, { inv: ALL(C) });
      problems.push(...bad(r3, `${tag} beam`));
      own.push(...r3.events.filter(e => e.k === 'damaged' && e.who === b.uid && e.cause.k === 'reflected' && e.cause.by === d.uid && e.cause.shooter === b.uid && e.cause.sp === 'cp_line'));
      if (!own.length) problems.push(`${tag}: its beam never came back into it`);
      if (r3.events.some(e => e.k === 'damaged' && e.who === 'you' && e.cause.sp === 'cp_line')) problems.push(`${tag}: its beam reached you behind the Dish`);
    }
    assert.deepEqual(problems, []);
  });

  test('with its rule switched off (rulesOff tab_screen) the Board Dish is a reflector like any other: the Board\'s second phase leaves it asleep, and its line says nothing of the Board; and once the Board has fallen, the Dish, hunting, comes for you as a reflector does', () => {
    for (const depth of [2, 6]) {
      const s = room(depth, { options: { rulesOff: [SCREEN] } }), b = board(C, s), d = one(s, DISH);
      const ev = toPhase2(C, s, b);
      assert.ok(d.mode === 'dormant' && !ev.some(e => e.who === d.uid), json(ev));
      const r = H.play(C, s, Array(6).fill(WAIT), { inv: 'all' });
      assert.deepEqual(bad(r, `off d${depth}`), []);
      assert.equal(d.mode, 'dormant');
      assert.ok(!C.Labels.of(s, d.uid).behaviour.includes('Board'), C.Labels.of(s, d.uid).behaviour);
    }
    // The Board falls: the Dish, hunting, walks to you and strikes you, wherever the Board stood.
    for (const depth of [2, 6]) {
      const s = room(depth, { you: [10, 8] }), b = board(C, s), d = one(s, DISH);
      toPhase2(C, s, b);
      const fell = blow(C, s, b, b.hp);
      assert.ok(b.gone && fell.some(e => e.k === 'died' && e.who === b.uid), json(fell.map(e => e.k)));
      // (The Certificate's perk is chosen first: a choice waits for its answer.)
      const r = H.play(C, s, st => st.ui.pendingChoice ? { a: 'choose', index: 0 } : cheb([one(st, DISH).x, one(st, DISH).y], [st.actors[0].x, st.actors[0].y]) <= 1 && st.turn > 12 ? null : WAIT, { inv: ALL(C), cap: 30 });
      assert.deepEqual(bad(r, `fallen d${depth}`), []);
      assert.ok(cheb([d.x, d.y], [10, 8]) === 1 && r.events.some(e => e.cause && e.cause.k === 'attack' && e.cause.by === d.uid), `it is at ${d.x},${d.y}`);
    }
  });

  test('the chime\'s forecast never under-warns when the Board Dish steps into the Repeater Arm\'s line: hunting toward the Board across the line in the turn before the chime, while you equip behind the Arm, it sends the line back onto you, and you were warned (no line goes off on you unwarned: combat_special_shown); at depths 1, 4 and 7', () => {
    let struck = 0;
    for (const depth of [1, 4, 7]) {
      const s = room(depth, { you: [1, 2], items: [GARMENT] }), b = board(C, s), d = one(s, DISH), arm = one(s, ARM);
      toPhase2(C, s, b);
      d.next = 100000;
      H.play(C, s, Array(P - W - 1).fill(WAIT), { inv: [] });
      // Planted: it stands just north of the line, its next action before the chime's boundary.
      d.x = 5; d.y = 1; d.next = (P - W) * N.TICKS_PER_TURN - 50;
      const t = C.Specials.threat(s, { a: 'equip', uid: 'g2' });
      const warned = t ? [t].concat(t.more || []) : [];
      assert.ok(warned.some(h => h.by === arm.uid && h.sp === SP && h.x === 1 && h.y === 2), `d${depth}: not warned behind the Arm: ${json(t)}`);
      const r = H.play(C, s, [{ a: 'equip', uid: 'g2' }], { inv: ALL(C) });
      assert.deepEqual(bad(r, `d${depth}`), []);
      if (r.events.some(e => e.k === 'damaged' && e.who === 'you' && e.cause.k === 'reflected' && e.cause.sp === SP && e.cause.by === d.uid)) struck++;
    }
    assert.equal(struck, 3, 'the Dish stepped into the line and sent it back onto you each time');
  });

  // ---- The night watch, your death, and the rain case in a department ----

  test('the night-watch bell wakes the Repeater Arm (awake: a station never hunts) and the Board Dish (hunting: it comes to stand in front of the Board, which the bell passes over); killed by the Arm\'s line or by the Dish, the death recap names it and tells how it woke; at depths 1 and 7', () => {
    for (const depth of [1, 7]) {
      const tag = `d${depth}`;
      // A night-watch bell (NIGHT_WAKE_EVERY counts into the night watch, which starts at B + G).
      const s = room(depth, { clock: { B: 2, G: 1, count: 3 + N.NIGHT_WAKE_EVERY - 2 }, you: [10, 8] }), b = board(C, s), arm = one(s, ARM), d = one(s, DISH);
      const r = H.play(C, s, Array(12).fill(WAIT), { inv: ALL(C) });
      assert.deepEqual(bad(r, `${tag} bell`), []);
      const woke = uid => r.events.find(e => e.k === 'woke' && e.who === uid);
      assert.equal(json([woke(arm.uid).cause.k, woke(arm.uid).mode, woke(d.uid).cause.k, woke(d.uid).mode, b.mode]), json(['night_bell', 'awake', 'night_bell', 'hunting', 'dormant']), tag);
      assert.equal(json([d.x, d.y]), json([8, 7]), `${tag}: the Dish stands at ${d.x},${d.y}`);
      // Killed by the Arm's line at its first strike (turn DEMO_PERIOD_HALL).
      const t = room(depth, { you: [10, 2] }), ta = one(t, ARM);
      t.actors[0].hp = 1;
      const q = H.play(C, t, st => st.over ? null : WAIT, { inv: 'all', cap: P + 2 });
      assert.deepEqual(bad(q, `${tag} line`), []);
      const rc = C.Text.recap(q.state);
      assert.ok(q.state.over && rc.killer === ta.uid && rc.lines[0] === `${Name(C, t, ta.uid)} defeated you on turn ${P}.`, json(rc));
      assert.ok(rc.lines.length >= 3 && rc.lines.every(l => typeof l === 'string' && l && !/undefined|NaN|\[object|\bnull\b|the The/.test(l)), json(rc.lines));
      // Killed by the Dish, woken by the Board's second phase.
      const u = room(depth, { you: [9, 8] }), ub = board(C, u), ud = one(u, DISH);
      toPhase2(C, u, ub);
      u.actors[0].hp = 1;
      const z = H.play(C, u, st => st.over ? null : WAIT, { inv: ALL(C), cap: 60 });
      assert.deepEqual(bad(z, `${tag} dish`), []);
      const rz = C.Text.recap(z.state);
      assert.ok(z.state.over && rz.killer === ud.uid, json(rz));
      assert.ok(rz.lines.includes(`On turn 0, the Board Dish woke and began hunting you: ${C.Labels.nameOf(u)(ub.uid)} entered its second phase.`), json(rz.lines));
    }
  });

  test('the hall\'s one rain case is in play in a department (the Board\'s core planted ready; M.11 seeds 1–3 at depth 3): opened or broken from beside it, it lets its rain out over the Repeater Arm, which is held fixed for it (weather_cases {case})', () => {
    const X = loadCore();
    X.Registry.ARCHETYPES.mp_tableau.ready = 'unit';
    let stopped = 0;
    for (let seed = 1; seed <= 3; seed++) {
      const s = X.Dept.create(seed, 'M11', 3), arm = one(s, ARM), f = X.Cases.at(s, model(X, s).caseAt[0], model(X, s).caseAt[1]), m = s.dept;
      // You, planted beside the case on a tile no one stands on.
      let at = null;
      for (let y = f.y - 1; y <= f.y + 1 && !at; y++) for (let x = f.x - 1; x <= f.x + 1 && !at; x++) if (X.Grid.walkable(m, x, y) && !X.Actors.at(s, x, y) && !X.Grid.closedDoor(m, x, y)) at = [x, y];
      s.actors[0].x = at[0]; s.actors[0].y = at[1]; s.actors[0].hp = s.actors[0].maxHp = 999;
      const r = H.play(X, s, st => X.Cases.at(st, f.x, f.y).st !== 'shut' ? null : X.Cases.describe(st, X.Cases.at(st, f.x, f.y)).canOpen ? { a: 'open', x: f.x, y: f.y } : { a: 'bash', x: f.x, y: f.y }, { inv: 'all', cap: 12 });
      assert.deepEqual(bad(r, `seed ${seed}`), []);
      const st = r.events.find(e => e.k === 'status' && e.who === arm.uid && e.id === 'fixed');
      assert.ok(r.events.some(e => e.k === 'surface' && e.kind === 'rain') && st && st.cause.k === 'weather_cases' && json(st.cause.case) === json([f.x, f.y]), `seed ${seed}: ${json(r.events.map(e => [e.k, e.who, e.cause && e.cause.k]))}`);
      stopped++;
    }
    assert.equal(stopped, 3);
  });
};
