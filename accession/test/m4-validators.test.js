// M4's other layout validators (M4 plan D-VALIDATORS, D1.12, D2.11, D3.9; design/layout.md §9.1;
// BUILD.md §5.5; js/core/layout/lv-m4.js), each registered after LV11:
//   - LV7, no unrewarded long dead end: planted rooms drawn as text maps (the tiles LV7 names
//     marked !): a dead-end corridor of DEAD_END_REWARD walking tiles beyond its junction with
//     nothing in it fails, one a tile shorter passes; an item or a Highlight in it, an exit at
//     its end, the Centrepiece hall's role, or a staff door before it (no public way in)
//     passes; a long empty dead end off a branch that holds the hall fails all the same (the
//     hall rewards its own walk, not this one); on a real department (A.4) the hall is the
//     only dead end, and with its role
//     planted plain it fails, in words; vacuous at Cabinet size (the shared sweep holds it);
//   - LV13 for the chime: a station's line along a corridor that every way must walk: in a
//     section (period 12) a run of 9 passes and 10 fails; in the Intro (period 8) 5 passes and
//     6 fails; a way around it, or a corridor two tiles wide, passes, but not round past an
//     exhibit asleep; a way that steps off the line into a niche and back starts its count
//     again; two stations of one room are judged together, their lines striking on the same
//     turn; the shortcut (a way can step off its line wherever it has a step off) agrees
//     with the full search; the same
//     with the chime switched off (judged as made); on M.11 with DEMO_WINDOW planted at 8 the
//     First Landing's line (window 7) fails every attempt and the department falls back,
//     rejected, in words;
//   - the hall's case, with the Great Board's core planted ready: a hall with its case passes;
//     its case taken away, or a mimic's, fails; the Repeater Arm moved out of its rain fails;
//     the core at ready false is never judged, nor a hall in a department with no weather in
//     its cases (S.9, its core planted ready); M.11 seed 111 at depth 1, whose first attempt
//     has no hall case, reseeds to one with the Arm in its rain;
//   - none draws or changes the department.
// test/sweep/lv-m4.check.js holds every department of the shared sweep to them.
'use strict';
module.exports = ({ test, assert, loadCore, root, path }) => {
  const C = loadCore();
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const { LVM4, Populate, Packs, Modules, Roles, N, Dept, State } = C;
  const json = x => JSON.stringify(x);
  // A map as text with the tiles marked !, for a failure's message.
  const text = (s, tiles) => s.dept.tiles.map((r, y) => r.split('').map((c, x) => (tiles || []).some(t => t[0] === x && t[1] === y) ? '!' : c).join('')).join('\n');

  test('LV7, LV13 and the hall\'s case are registered after LV11, in that order', () => {
    const ids = Populate.validatorIds();
    assert.equal(json(ids.slice(ids.indexOf('lv11'))), json(['lv11', 'lv7', 'lv13', 'hall_case']));
  });

  // ---- LV7 ----

  // Two rooms joined by an archway, the entrance west and the exit east; a door in the west
  // room's south wall opens on a dead-end corridor of len tiles (its own room, role role),
  // walking tiles 2 … len + 1 beyond the west room (the door is 1). o: door (its character),
  // end (the corridor's last tile's character), items, role.
  function deadEnd(len, o) {
    o = o || {};
    const rows = ['####################', '#........#.........#', '#........#.........#', 'E........,.........X', '#........#.........#', `####${o.door || '+'}###############`];
    for (let i = 0; i < len; i++) rows.push(i === len - 1 && o.end ? `####${o.end}###############` : '####.###############');
    rows.push('####################');
    const exits = [[19, 3]];
    if (o.end === 'X') { rows[rows.length - 2] = '####.###############'; rows[rows.length - 1] = '####X###############'; exits.push([4, rows.length - 1]); }
    return H.room(C, 1, { acc: 'S9', depth: 3, map: rows, you: [1, 3], entrance: [0, 3], exits, items: o.items || [],
      rooms: [{ key: 'a', role: 'intro', x0: 1, y0: 1, x1: 8, y1: 4 }, { key: 'b', role: 'section', x0: 10, y0: 1, x1: 18, y1: 4 }, { key: 'd', role: o.role || 'study', x0: 4, y0: 6, x1: 4, y1: 5 + len }] });
  }

  test('LV7 (planted): a dead end reaching DEAD_END_REWARD walking tiles beyond its junction with nothing in it fails, its farthest tile and its room named; a tile shorter passes; an item, a Highlight, an exit at its end, the Centrepiece hall\'s role or a staff door before it passes', () => {
    const R = N.DEAD_END_REWARD, problems = [];
    const at = len => [4, 5 + len];
    // Fails: the door is walk 1, so a corridor of R − 1 tiles reaches R beyond the west room.
    const s = deadEnd(R - 1), r = LVM4.lv7(s, null);
    if (!r) problems.push(`no rejection:\n${text(s)}`);
    else {
      assert.equal(json(r.tiles), json([at(R - 1)]), `${r.reason}\n${text(s, r.tiles)}`);
      assert.equal(r.reason, `the dead end beyond the Intro (a room) reaches ${R} walking tiles past it, at 4,${5 + R - 1}, and holds nothing to find there: no item, no Highlight, no Centrepiece (a dead end of ${R} walking tiles or more must reward the walk)`, text(s, r.tiles));
      const b = LVM4.deadEnds(s, true);
      assert.equal(json(b.map(x => [x.junction, x.depth, x.reward])), json([[1, R, null]]));
    }
    // Passes: a tile shorter; each reward; an exit at its end (a way through, no dead end); the
    // hall's role (the set piece's room); a staff door (no public way in).
    const passes = [
      ['a tile shorter', deadEnd(R - 2)],
      ['a weapon on its last tile', deadEnd(R - 1, { items: [{ uid: 't.w', kind: 'weapon', form: 'balanced', tier: 1, where: { at: 'floor', x: 4, y: 5 + R - 1 } }] })],
      ['a Restoration kit (a Highlight) half way', deadEnd(R - 1, { items: [{ uid: 't.k', kind: 'kit', where: { at: 'floor', x: 4, y: 9 } }] })],
      ['an exit at its end', deadEnd(R - 1, { end: 'X' })],
      ['the Centrepiece hall', deadEnd(R - 1, { role: 'centre' })],
      ['a staff door before it', deadEnd(R - 1, { door: 'S' })],
      ['an archway before it, a tile shorter', deadEnd(R - 2, { door: ',' })],
    ];
    for (const [what, p] of passes) { const q = LVM4.lv7(p, null); if (q) problems.push(`${what}: ${q.reason}\n${text(p, q.tiles)}`); }
    // An archway instead of the door is a dead end all the same.
    const arch = deadEnd(R - 1, { door: ',' });
    if (!LVM4.lv7(arch, null)) problems.push(`an archway before it passes:\n${text(arch)}`);
    assert.deepEqual(problems, []);
  });

  test('LV7 on a real department: A.4\'s (seed 2, depth 3) only dead end is its Centrepiece hall, rewarded as the set piece\'s room; with the hall\'s role planted plain it fails, in words naming the room it leaves and the hall; LV7 draws nothing and changes nothing', () => {
    const s = Dept.create(2, 'A4', 3), before = json(s), hash = State.hash(s);
    const b = LVM4.deadEnds(s, true), hall = s.dept.rooms.find(r => r.role === 'centre');
    assert.equal(json(b.map(x => [x.rooms, x.reward])), json([[[hall.id], 'centrepiece']]));
    assert.ok(b[0].depth >= N.DEAD_END_REWARD, `the hall reaches ${b[0].depth}`);
    assert.equal(LVM4.lv7(s, null), null);
    assert.equal(json(s), before); assert.equal(State.hash(s), hash);
    const p = State.clone(s);
    p.dept.rooms.find(r => r.id === hall.id).role = 'section';
    const r = LVM4.lv7(p, null);
    const named = Populate.galleryOf(s, hall.id).name.replace(/^The /, 'the ');
    assert.ok(r && r.reason.startsWith('the dead end beyond the ') && r.reason.includes(` (${named}) reaches ${b[0].depth} walking tiles past it, at ${b[0].far[0]},${b[0].far[1]}, and holds nothing to find there`), r && r.reason);
    assert.equal(json(r.tiles[0]), json(b[0].far));
  });

  test('LV7 (planted): a long empty dead end off a branch that holds the Centrepiece hall fails, named from its own junction; the hall rewards the walk to it, not this one', () => {
    // Room a (entrance) to room b (exit) by an archway; a door (4,5) south of room a into room
    // j, whose west door (2,6) opens on the hall (x 1) and whose south door (4,8) on an empty
    // corridor (x 4) of len tiles.
    const ends = len => {
      const rows = ['####################', '#........#.........#', '#........#.........#', 'E........,.........X', '#........#.........#', '####+###############', '#.+...##############', '#.#...##############', '#.##+###############'];
      for (let i = 0; i < len; i++) rows.push('#.##.###############');
      rows.push('####################');
      return H.room(C, 1, { acc: 'S9', depth: 3, map: rows, you: [1, 3], entrance: [0, 3], exits: [[19, 3]], items: [],
        rooms: [{ key: 'a', role: 'intro', x0: 1, y0: 1, x1: 8, y1: 4 }, { key: 'b', role: 'section', x0: 10, y0: 1, x1: 18, y1: 4 }, { key: 'j', role: 'study', x0: 3, y0: 6, x1: 5, y1: 7 },
          { key: 'h', role: 'centre', x0: 1, y0: 6, x1: 1, y1: 8 + len }, { key: 'd', role: 'study', x0: 4, y0: 9, x1: 4, y1: 8 + len }] });
    };
    const R = N.DEAD_END_REWARD, s = ends(R - 1), b = LVM4.deadEnds(s, true), j = s.dept.roomOf[6][3], d = s.dept.roomOf[9][4];
    // The door (4,8) is walk 1 beyond room j, so a corridor of R − 1 tiles reaches R.
    assert.equal(json(b.map(x => [x.junction, x.rooms.includes(d), x.reward ? null : x.depth, x.reward])), json([[1, true, null, 'centrepiece'], [j, true, R, null]]));
    const r = LVM4.lv7(s, null);
    assert.ok(r && r.reason.startsWith('the dead end beyond a room (a room) reaches ' + R + ' walking tiles past it, at 4,' + (8 + R - 1)), r && r.reason);
    assert.equal(LVM4.lv7(ends(R - 2), null), null);
  });

  // ---- LV13 for the chime ----

  // Room a (the entrance's, x 1–4) opens by an archway (5,2) on a corridor (room c, role role):
  // its row 2 from x 6 to 5 + run, which every way walks, the station (the First Landing's,
  // M11.12) at its east end (6 + run, 2) with its line west along it; the way leaves it south
  // at its last tile, by (5 + run, 3) and an archway (5 + run, 4), into room b, whose east wall
  // holds the exit. o: role, around (an archway from room a to room b at 2,4: a way around the
  // line), sleeper (an exhibit asleep on that archway), wide (the corridor two rows wide),
  // niche (a tile of row 3 at that x opened beside the line), mate (a second station of the
  // corridor's room, in a niche of row 1 at 5 + run, its line south over the corridor's last
  // tile and the tile the way leaves by), options (Options).
  function corridor(run, o) {
    o = o || {};
    const W = run + 8, wall = '#'.repeat(W);
    let r3 = '#....#' + (o.wide ? '.'.repeat(run) : '#'.repeat(run - 1) + '.') + '##';
    if (o.niche !== undefined) r3 = r3.slice(0, o.niche) + '.' + r3.slice(o.niche + 1);
    const rows = [wall, '#....#' + '#'.repeat(run - 1) + (o.mate ? '.' : '#') + '##', 'E....,' + '.'.repeat(run + 1) + '#', r3.slice(0, W),
      '#' + (o.around ? '#,##' : '####') + '#' + '#'.repeat(run - 1) + ',' + '##', '#' + '.'.repeat(W - 2) + '#', '#' + '.'.repeat(W - 2) + 'X', '#' + '.'.repeat(W - 2) + '#', wall];
    const rooms = [{ key: 'a', role: 'section', x0: 1, y0: 1, x1: 4, y1: 3 }, { key: 'c', role: o.role || 'section', x0: 6, y0: 1, x1: 6 + run, y1: 3 }, { key: 'b', role: 'coda', x0: 1, y0: 5, x1: W - 2, y1: 7 }];
    const stats = sp => Roles.stats(Packs.speciesFor({ dept: { acc: 'M11' } }, { sp }).role, 3), exhibits = [{ sp: 'M11.12', at: [6 + run, 2], stats: stats('M11.12') }];
    if (o.mate) exhibits.push({ sp: 'M11.2', at: [5 + run, 1], stats: stats('M11.2') });
    if (o.sleeper) exhibits.push({ sp: 'M11.1', at: [2, 4], stats: stats('M11.1') });
    const s = H.room(C, 1, { acc: 'M11', depth: 3, map: rows, you: [1, 2], entrance: [0, 2], exits: [[W - 1, 6]], rooms, exhibits }, o.options || {});
    s.actors[1].route = { dir: 'W' };
    if (o.mate) s.actors[2].route = { dir: 'S' };
    Modules.init(s, Packs.get('M11'));
    return s;
  }

  test('LV13 (planted): a station\'s line that every way must walk along: in a section (period 12) a run of 9 leaves a window of 3 and passes, 10 leaves 2 and fails; in the Intro (period 8) 5 passes and 6 fails; a way around the line, or a corridor two tiles wide, passes; in words, with the station and its line marked', () => {
    const problems = [];
    const cases = [['section', 12, 9, false], ['section', 12, 10, true], ['section', 12, 14, true], ['intro', 8, 5, false], ['intro', 8, 6, true]];
    for (const [role, P, run, fails] of cases) {
      const s = corridor(run, { role }), r = LVM4.lv13(s, null), tag = `${role}, a run of ${run}`;
      // A line no longer than its period less DEMO_WINDOW is not searched: it cannot fail.
      const f = LVM4.windows(s, true), short = run <= P - N.DEMO_WINDOW;
      if (short ? f.length : !f.length || f[0].run !== run || f[0].period !== P || f[0].fails !== fails) problems.push(`${tag}: windows ${json(f.map(x => [x.run, x.period, x.window, x.fails]))}`);
      if (!!r !== fails) { problems.push(`${tag}: ${r ? r.reason : 'passes'}\n${text(s, r && r.tiles)}`); continue; }
      if (!r) continue;
      const st = s.actors[1], want = `every way from the entrance to an exit, but through the Centrepiece hall, a staff door or an exhibit that stands still, crosses the line of ${C.Labels.nameOf(s)(st.uid)} (at ${st.x},${st.y}, in ${role === 'intro' ? 'the Intro' : 'a room'}), and the best of them stands on it ${run} turns running: its line goes off every ${P} turns, which leaves ${P - run > 0 ? `${P - run} turn${P - run === 1 ? '' : 's'}` : 'no turn'} to start across (at least ${N.DEMO_WINDOW})`;
      if (r.reason !== want) problems.push(`${tag}: ${r.reason}`);
      const line = []; for (let x = 6; x < 6 + run; x++) line.push([x, 2]);
      if (json(r.tiles) !== json([[st.x, st.y]].concat(line))) problems.push(`${tag}: tiles\n${text(s, r.tiles)}`);
    }
    for (const [what, s] of [['a way around', corridor(14, { around: true })], ['two tiles wide', corridor(14, { wide: true })]]) {
      const r = LVM4.lv13(s, null), f = LVM4.windows(s, true);
      if (r) problems.push(`${what}: ${r.reason}\n${text(s, r.tiles)}`);
      if (!f.length || f[0].run > 2) problems.push(`${what}: ${json(f.map(x => [x.run, x.window]))}`);
    }
    // The way round, past an exhibit asleep on its archway, is no way: the line fails.
    const asleep = corridor(14, { around: true, sleeper: true }), q = LVM4.lv13(asleep, null);
    if (!q || LVM4.windows(asleep, true)[0].run !== 14) problems.push(`round past a sleeper: ${q ? q.reason : 'passes'}`);
    // A niche beside the line (row 3) lets a way step off and back onto the tile it left,
    // which starts its count again: of a run of 14 (x 6–19), a niche at x 11 leaves 6 then 9
    // (passes, window 3); one at x 10, 5 then 10 (fails, window 2), which the full search,
    // past the shortcut, finds.
    for (const [niche, run, fails] of [[11, 9, false], [10, 10, true]]) {
      const s = corridor(14, { niche }), f = LVM4.windows(s, true), r = LVM4.lv13(s, null);
      if (!f.length || f[0].run !== run || f[0].fails !== fails || !!r !== fails) problems.push(`a niche at ${niche}: ${json(f.map(x => [x.run, x.window, x.fails]))} ${r ? r.reason : 'passes'}`);
    }
    // Two stations of one room strike on the same turn: a run of 9 on the First Landing's line
    // passes alone (window 3); with a second station whose line takes the tile the way leaves
    // by, the way stands on one and then the other 10 turns running, and fails, in words.
    const two = corridor(9, { mate: true }), f2 = LVM4.windows(two, true), r2 = LVM4.lv13(two, null), nm = C.Labels.nameOf(two);
    if (LVM4.windows(corridor(9), true).length || LVM4.lv13(corridor(9), null)) problems.push('a run of 9 alone fails');
    if (f2.length !== 2 || f2[0].run !== 10 || json(f2[0].mates) !== json([two.actors[2].uid])) problems.push(`two stations: ${json(f2.map(x => [x.uid, x.mates, x.run, x.window]))}`);
    const both = `every way from the entrance to an exit, but through the Centrepiece hall, a staff door or an exhibit that stands still, crosses the line of ${nm(two.actors[1].uid)} (at 15,2, in a room), whose line strikes on the same turn as that of ${nm(two.actors[2].uid)} (at 14,1) in the same room, and the best of them stands on those lines 10 turns running: its line goes off every 12 turns, which leaves 2 turns to start across (at least ${N.DEMO_WINDOW})`;
    if (!r2 || r2.reason !== both || json(r2.tiles.slice(-2)) !== json([[14, 1], [14, 3]])) problems.push(`two stations: ${r2 ? r2.reason + json(r2.tiles) : 'passes'}`);
    assert.deepEqual(problems, []);
  });

  test('LV13 judges the department as made: with the chime switched off, or the station left out, the same line fails the same way; with no exit to reach at all it leaves the judging to LV11; it draws nothing and changes nothing', () => {
    const on = LVM4.lv13(corridor(10), null);
    const off = corridor(10, { options: { rulesOff: ['hourly_demonstration'] } });
    assert.equal(json(LVM4.lv13(off, null)), json(on));
    const s = corridor(10, { options: { without: [] } });
    s.options.without = [s.actors[1].uid]; s.actors[1].gone = 1;
    assert.equal(json(LVM4.lv13(s, null)), json(on));
    const shut = corridor(10);
    shut.dept.tiles[6] = shut.dept.tiles[6].replace('X', '#');
    assert.equal(LVM4.lv13(shut, null), null);
    const t = corridor(10), before = json(t);
    LVM4.lv13(t, null); LVM4.windows(t, true); LVM4.lv7(t, null); LVM4.hallCase(t, null);
    assert.equal(json(t), before);
  });

  test('LV13 on M.11 with DEMO_WINDOW planted at 8: the First Landing\'s line, which every way crosses with a window of 7, fails every attempt, and the department falls back, rejected, in words', () => {
    const X = loadCore(null, { numbers: { DEMO_WINDOW: 8 } });
    const g = X.Dept.generate(1, 'M11', 1);
    assert.ok(g.fallback && g.rejected && g.rejected.id === 'lv13', json(g.rejected));
    assert.ok(/^every way from the entrance to an exit, but through the Centrepiece hall, a staff door or an exhibit that stands still, crosses the line of the Semaphore Station, First Landing \(at \d+,\d+, in the First Landing\), and the best of them stands on it 1 turn running: its line goes off every 8 turns, which leaves 7 turns to start across \(at least 8\)$/.test(g.rejected.why), g.rejected.why);
    assert.ok(g.tries.length >= 1 && g.tries.every(t => t.some(f => f.id === 'lv13')));
  });

  // ---- The hall's case ----

  test('the hall\'s case (the Great Board\'s core planted ready, M.11): a hall with its case passes; its case taken away or a mimic\'s fails; the Repeater Arm moved out of its rain fails; at ready false nothing is judged; each in words', () => {
    const X = loadCore();
    X.Registry.ARCHETYPES.mp_tableau.ready = 'unit';
    const s = X.Dept.create(1, 'M11', 3), m = s.dept, cp = X.Hall.cp(s), hall = m.rooms.find(r => r.key === cp.room);
    const cases = m.fixtures.filter(f => f.k === 'case' && !f.mimic && m.roomOf[f.y][f.x] === hall.id), arm = X.Tableau.attachments(s).find(a => a.arch === 'demonstrator');
    assert.ok(cases.length && arm, 'a hall with a case and the Arm');
    assert.equal(X.LVM4.hallCase(s, null), null);
    const none = X.State.clone(s);
    none.dept.fixtures = none.dept.fixtures.filter(f => !cases.some(c => c.x === f.x && c.y === f.y));
    const r1 = X.LVM4.hallCase(none, null);
    assert.equal(r1 && r1.reason, 'the hall of the Great Board of the Central Station holds no real case, so no rain can fall there to stop the Board’s Repeater Arm (the hall\'s case holds rain)');
    const mimic = X.State.clone(s);
    for (const f of mimic.dept.fixtures) if (cases.some(c => c.x === f.x && c.y === f.y)) f.mimic = 'planted';
    assert.equal(json(X.LVM4.hallCase(mimic, null)), json(r1));
    // The Arm on the hall's floor tile farthest from every case.
    const away = X.State.clone(s), a = away.actors.find(b => b.uid === arm.uid);
    let far = null;
    for (let y = hall.y0; y <= hall.y1; y++) for (let x = hall.x0; x <= hall.x1; x++) {
      if (m.tiles[y][x] !== '.' || X.Actors.at(away, x, y)) continue;
      const d = Math.min(...cases.map(c => Math.max(Math.abs(c.x - x), Math.abs(c.y - y))));
      if (!far || d > far[2]) far = [x, y, d];
    }
    a.x = far[0]; a.y = far[1];
    const r2 = X.LVM4.hallCase(away, null);
    assert.equal(r2 && r2.reason, `the Board’s Repeater Arm stands at ${far[0]},${far[1]}, out of the rain of every case in the hall of the Great Board of the Central Station, so rain can never stop its line`);
    assert.equal(json(r2.tiles), json([[far[0], far[1]]].concat(cases.map(c => [c.x, c.y]))));
    // At ready false no department places the Board, so nothing is judged.
    const plain = Dept.create(1, 'M11', 3);
    assert.equal(C.Hall.cp(plain), null);
    plain.dept.fixtures = [];
    assert.equal(LVM4.hallCase(plain, null), null);
    // S.9 keeps no weather in its cases: its hall is never judged, case or none.
    const Y = loadCore(), core = Y.Packs.get('S9').centrepiece.archetype;
    Y.Registry.ARCHETYPES[core].ready = 'unit';
    const s9 = Y.Dept.create(1, 'S9', 3);
    assert.ok(Y.Hall.cp(s9), 'S.9 places its Centrepiece with the core planted ready');
    s9.dept.fixtures = [];
    assert.equal(Y.LVM4.hallCase(s9, null), null);
  });

  test('the hall\'s case on a real department (the core planted ready): M.11 seed 111 at depth 1 has no case in its hall at its first attempt, so it reseeds, to a hall whose case\'s rain falls on the Repeater Arm; the same with the weather and the chime switched off', () => {
    const X = loadCore();
    X.Registry.ARCHETYPES.mp_tableau.ready = 'unit';
    const g = X.Dept.generate(111, 'M11', 1);
    const first = g.tries[0] || [];
    assert.ok(g.attempt >= 1 && first.some(f => f.id === 'hall_case' && /holds no real case/.test(f.why)), json(g.tries));
    const s = g.state, cp = X.Hall.cp(s), hall = s.dept.rooms.find(r => r.key === cp.room), arm = X.Tableau.attachments(s).find(a => a.arch === 'demonstrator');
    const cases = s.dept.fixtures.filter(f => f.k === 'case' && !f.mimic && s.dept.roomOf[f.y][f.x] === hall.id);
    assert.ok(cases.some(f => X.Grid.covers({ x: f.x, y: f.y, size: N.WEATHER_SIZE }, arm.x, arm.y)));
    const off = X.Dept.generate(111, 'M11', 1, { rulesOff: ['weather_cases', 'hourly_demonstration'] });
    assert.equal(off.attempt, g.attempt);
  });
};
