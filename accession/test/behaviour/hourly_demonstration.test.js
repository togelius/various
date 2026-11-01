// ACCESSION — the module hourly_demonstration (BUILD.md §5.4, §8.1, §8.2; M4 plan MO9–MO11,
// D1.9–D1.10, D7.3; MOD-CHIME): its part on the station's line, "on each chime, every
// {DEMO_PERIOD} turns ({DEMO_PERIOD_INTRO} in the Intro, {DEMO_PERIOD_HALL} in the hall), it
// wakes and, unless another mark lies on its line, marks its line: a beam across its room,
// through glass and back from a reflector, that strikes all on it {DEMO_WARNING} turns later for
// {gross} before Padding; then it sleeps again with its pips, unless it was awake before", and
// its panel sentence. Joined up: the real core, real actions only, every invariant checked after
// every step (chime.inv.js among them), clone-checked where it says so. The main scenario runs
// for every pack station (M11.2) at depths 1–7 and is rerun with the module switched off, when
// it must fail (§5.3 check 3). The count, the periods and the rooms are worked out here from
// §5.4, not from the module's code. Also: two crossing lines, a station awake before its chime,
// a 300-tick equip warned of the chime's line and the confirmation's words (D7.3), the chime in
// a sealed hall, a station's line kept when a noise sends it to look elsewhere and called off,
// truly, when it is quieted, the threat's forecast the same whatever a roll does, a reflector
// stepping into a line during a long action, the Intro's station, the dial, the words and the
// module's form.
'use strict';
const H = require('./_harness.js');
module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const C = loadCore();
  const { Roles, N, Specials, Modules, Packs, Text, Labels, Clock, HourlyDemonstration: HD } = C;
  const json = x => JSON.stringify(x);
  const ID = 'hourly_demonstration', SP = 'demo_line', W = N.DEMO_WARNING, T = N.TICKS_PER_TURN;
  const waits = n => Array.from({ length: n }, () => ({ a: 'wait' }));
  const ok = (results, name) => { const f = H.failures(results); assert.equal(f.length, 0, `${name}:\n${f.slice(0, 5).join('\n')}`); };
  const list = () => { const l = H.species(C, 'MODULES.hourly_demonstration'); assert.ok(l.length >= 7, `${l.length} species and depths`); return l; };
  const tough = more => Object.assign({ hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 }, more || {});
  const key = t => `${t[0]},${t[1]}`;
  const clean = s => typeof s === 'string' && s.length > 0 && !/undefined|NaN|\[object|\bnull\b/.test(s);
  // The turns at whose boundary a station's chime sounds and its line goes off, from §5.4: the
  // count from entry (turn 0) DEMO_WARNING short of a multiple of p, and the multiple.
  const chimes = (p, upTo) => { const out = []; for (let t = 1; t <= upTo; t++) if (t % p === p - W) out.push(t); return out; };
  const multiples = (p, upTo) => { const out = []; for (let t = 1; t <= upTo; t++) if (t % p === 0) out.push(t); return out; };

  // A room of M.11 running its modules (Modules.init, as a department does), you hard to kill.
  // stations: [{at, dir, pips?, mode?}], each the pack's station, M11.2; more: other exhibits.
  function room(X, opts, o) {
    const depth = o.depth || 3, sp = X.Packs.species('M11', 'M11.2');
    const exhibits = (o.stations || []).map(st => Object.assign({ sp: 'M11.2', at: st.at, stats: X.Roles.stats(sp.role, depth) }, st.pips !== undefined ? { pips: st.pips } : {}, st.mode ? { mode: st.mode } : {}));
    const s = H.room(X, opts.seed || 1, Object.assign({ acc: 'M11', depth, map: o.map, you: o.you, exhibits: exhibits.concat(o.more || []) },
      o.rooms ? { rooms: o.rooms } : {}, o.items ? { items: o.items } : {}, o.clock ? { clock: o.clock } : {}, o.cp ? { cp: o.cp } : {}, o.fixtures ? { fixtures: o.fixtures } : {}), { rulesOff: opts.rulesOff || [] });
    s.actors[0].hp = s.actors[0].maxHp = 999;
    (o.stations || []).forEach((st, i) => { s.actors[1 + i].route = { dir: st.dir }; });
    X.Modules.init(s, X.Packs.get('M11'));
    return s;
  }
  const ROW = ['################', '#..............#', '#..............#', '#..............#', '#..............#', '#..............#', '################'];
  const SECTION = [{ key: 'sone', role: 'section', x0: 1, y0: 1, x1: 14, y1: 5 }];
  const GARMENT = { uid: 'g2', kind: 'garment', form: 'standard', tier: 3, where: { at: 'tote' } };
  const lineEvents = (events, uid, k) => events.filter(e => e.k === k && (e.who === uid) && e.sp === SP);
  const ruleEvents = (events, rule, uid) => events.filter(e => e.k === 'module' && e.id === ID && e.rule === rule && (uid === undefined || e.who === uid));

  // ---- The chime, the line and the settle ----
  const chime = H.scenario({
    name: 'on each chime, every 12 turns in a gallery, it wakes and marks its line across its room, which strikes all on it 2 turns later for its gross; then it sleeps again with its pips',
    id: 'MODULES.hourly_demonstration', clone: true,
    // The station at the west end of a row; you on its line, six tiles off (out of your ring),
    // and a trolley asleep on it beyond you.
    build: (params, sp, depth, opts) => room(C, opts, { depth, map: ROW, you: [8, 1], rooms: SECTION, stations: [{ at: [2, 1], dir: 'E', pips: 1 }],
      more: [{ sp: 'M11.5', at: [13, 1], mode: 'dormant', stats: Roles.stats('fodder', depth) }] }),
    actions: waits(25),
    expect(r, params, sp, depth) {
      const st = r.start.actors[1], trolley = r.start.actors[2].uid, gross = Roles.at(N.DEMO_LINE_DMG, depth), p = N.DEMO_PERIOD;
      const marked = lineEvents(r.events, st.uid, 'telegraphed');
      if (json(marked.map(e => e.turn)) !== json(chimes(p, 25))) return `it marked its line on turns ${json(marked.map(e => e.turn))}, not ${json(chimes(p, 25))}`;
      for (const e of marked) {
        if (e.cause.due !== (e.turn + W) * T || e.cause.gross !== gross) return `its line on turn ${e.turn} is due at ${e.cause.due} for ${e.cause.gross}, not at ${(e.turn + W) * T} for ${gross}`;
        if (json(e.tiles) !== json([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(x => [x, 1]))) return `its line is ${json(e.tiles)}, not its room's row east of it`;
      }
      const hits = r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.sp === SP);
      if (json(hits.map(e => e.turn)) !== json(multiples(p, 25))) return `its line struck you on turns ${json(hits.map(e => e.turn))}, not ${json(multiples(p, 25))}`;
      const net = Specials.net(gross, r.start.actors[0].pad);
      if (hits.some(e => e.amount !== net || e.cause.gross !== gross)) return `it struck you for ${json(hits.map(e => e.amount))}, not ${net} (${gross} before your Padding)`;
      if (!r.events.some(e => e.k === 'damaged' && e.who === trolley && e.cause.sp === SP && e.turn === p)) return 'the trolley on its line was not struck';
      // The chime: once a chime, about no exhibit, before the line; the station woke for it.
      const said = ruleEvents(r.events, 'chime');
      if (json(said.map(e => [e.turn, e.turns, e.n])) !== json(chimes(p, 25).map(t => [t, W, 1]))) return `the chime sounded ${json(said.map(e => [e.turn, e.turns, e.n]))}`;
      const woke = r.events.filter(e => e.k === 'woke' && e.who === st.uid && e.cause.k === 'period');
      if (json(woke.map(e => [e.turn, e.mode])) !== json(chimes(p, 25).map(t => [t, 'awake']))) return `it woke ${json(woke.map(e => [e.turn, e.mode]))}`;
      // Then it sleeps again with the pip it had, at each multiple, after its line went off.
      const settled = ruleEvents(r.events, 'settle', st.uid);
      if (json(settled.map(e => [e.turn, e.n])) !== json(multiples(p, 25).map(t => [t, 1]))) return `it went back to sleep ${json(settled.map(e => [e.turn, e.n]))}`;
      const off = r.events.findIndex(e => e.k === 'special' && e.who === st.uid && e.turn === p);
      if (off < 0 || r.events.indexOf(settled[0]) < off) return 'it went back to sleep before its line went off';
      const end = r.state.actors[1];
      if (end.mode !== 'dormant' || end.pips !== 1 || end.x !== 2 || end.y !== 1) return `it ended ${end.mode} with ${end.pips} pips at ${end.x},${end.y}`;
      // The log tells the chime, and the mark as its line.
      const log = Text.log(r.steps[9].events, Labels.nameOf(r.state));
      if (!log.includes(`The chime sounded: any line marked at it strikes in ${Text.count(W, 'turn')}.`)) return `the log at the chime: ${json(log)}`;
      if (!log.some(l => / marks 12 tiles for its line: \d+ before your Padding, in 2 turns\.$/.test(l))) return `the log at the chime: ${json(log)}`;
      if (!r.clause || !r.clause.includes(`every ${params.DEMO_PERIOD} turns`)) return `the line does not give its period: "${r.clause}"`;
      return null;
    },
  });
  test('the chime: it marks its line only where the count is 2 short of a multiple of its period, the line goes off only on the multiple, for what the mark showed, and it sleeps again with its pips; at depths 1–7, clone-checked, and failing with the module off', () => {
    ok(H.sweep(C, chime, list()), chime.name);
  });

  test('both periods: a station in the Intro or the hall marks every 8 turns, one elsewhere every 12, each line kept in its own room; the dial gives each room\'s next chime', () => {
    // Three rooms in a row joined by archways on row 1: the Intro, the hall, a section.
    const MAP = ['#####################', '#.....,.....,.......#', '#.....#.....#.......#', '#.....#.....#.......#', '#####################'];
    const ROOMS = [{ key: 'intro', role: 'intro', x0: 1, y0: 1, x1: 5, y1: 3 }, { key: 'centre', role: 'centre', x0: 7, y0: 1, x1: 11, y1: 3 }, { key: 'sone', role: 'section', x0: 13, y0: 1, x1: 19, y1: 3 }];
    for (const depth of H.DEPTHS) {
      // Each station on row 1, its line east toward the archway out of its room.
      const s = room(C, {}, { depth, map: MAP, you: [19, 3], rooms: ROOMS, stations: [{ at: [1, 1], dir: 'E' }, { at: [7, 1], dir: 'E' }, { at: [13, 1], dir: 'E' }] });
      const [, a, b, c] = s.actors;
      assert.equal(json([1, 2, 3].map(id => HD.next(s, id))), json([{ next: 6, period: 8 }, { next: 6, period: 8 }, { next: 10, period: 12 }]));
      const r = H.play(C, s, waits(31), { inv: 'all', clone: depth === 4 });
      assert.deepEqual(r.violations, [], `depth ${depth}`);
      for (const [st, p, row] of [[a, N.DEMO_PERIOD_INTRO, [2, 3, 4, 5]], [b, N.DEMO_PERIOD_HALL, [8, 9, 10, 11]], [c, N.DEMO_PERIOD, [14, 15, 16, 17, 18, 19]]]) {
        const m = lineEvents(r.events, st.uid, 'telegraphed');
        assert.equal(json(m.map(e => e.turn)), json(chimes(p, 31)), `${st.uid} at depth ${depth}`);
        for (const e of m) assert.equal(json(e.tiles), json(row.map(x => [x, 1])), 'its line stops at its room\'s archway');
        assert.equal(json(r.events.filter(e => e.k === 'special' && e.who === st.uid && !e.cancelled).map(e => e.turn)), json(multiples(p, 31)));
      }
      // Each chime sounded once, for the stations it was due for.
      assert.equal(json(ruleEvents(r.events, 'chime').map(e => [e.turn, e.n])), json([[6, 2], [10, 1], [14, 2], [22, 3], [30, 2]]));
    }
  });

  test('its line is a beam: it passes the glass of a case on it, striking the exhibit inside and you beyond, as combat_glass allows a beam', () => {
    for (const depth of [1, 4, 7]) {
      const map = ROW.map((r, y) => y === 1 ? r.slice(0, 6) + 'v' + r.slice(7) : r);
      const s = room(C, {}, { depth, map, you: [10, 1], rooms: SECTION, stations: [{ at: [2, 1], dir: 'E' }], fixtures: [C.Cases.make({ x: 6, y: 1, glass: 1, lock: 1 })],
        more: [{ sp: 'dummy', at: [6, 1], mode: 'dormant', stats: tough() }] });
      assert.ok(C.Cases.encased(s, s.actors[2]), 'the dummy stands in its case');
      const r = H.play(C, s, waits(12), { inv: 'all' });
      assert.deepEqual(r.violations, [], `depth ${depth}`);
      const hits = r.events.filter(e => e.k === 'damaged' && e.cause.sp === SP).map(e => e.who);
      assert.equal(json(hits), json(['you', s.actors[2].uid]), 'you, and the exhibit in the case (in spawn order, §8.1)');
      assert.ok(Specials.passesGlass(C.Registry.SPECIALS[SP].shape));
    }
  });

  test('two crossing lines: the first placed marks its line; the second, which would overlap it, is not marked, and the log says so; each still wakes and sleeps again', () => {
    for (const depth of [1, 4, 7]) for (const order of [0, 1]) {
      // A's line along row 2, east; B's up column 6 from row 4: they cross at (6,2).
      const A = { at: [1, 2], dir: 'E' }, B = { at: [6, 4], dir: 'N' };
      const s = room(C, {}, { depth, map: ROW, you: [12, 5], rooms: SECTION, stations: order ? [B, A] : [A, B] });
      const [first, second] = [s.actors[1].uid, s.actors[2].uid];
      const r = H.play(C, s, waits(13), { inv: 'all', clone: true });
      assert.deepEqual(r.violations, [], `depth ${depth}`);
      assert.equal(json(lineEvents(r.events, first, 'telegraphed').map(e => e.turn)), json([10]), 'the first marks');
      assert.equal(json(lineEvents(r.events, second, 'telegraphed').map(e => e.turn)), '[]', 'the second does not');
      const blocked = ruleEvents(r.events, 'blocked', second);
      assert.equal(json(blocked.map(e => e.turn)), json([10]));
      assert.equal(Text.event(blocked[0], Labels.nameOf(r.state)), 'The Semaphore Station, Two-Armed did not mark its line: another mark already lies on it.');
      assert.equal(json(ruleEvents(r.events, 'blocked', first)), '[]');
      for (const uid of [first, second]) assert.equal(json(ruleEvents(r.events, 'settle', uid).map(e => e.turn)), json([12]), `${uid} sleeps again`);
      assert.equal(json(r.state.actors.slice(1).map(a => a.mode)), json(['dormant', 'dormant']));
    }
  });

  test('a station awake before its chime marks its line at the chime and stays awake after it; one asleep at 2 pips sleeps again at 2', () => {
    for (const depth of [2, 6]) {
      // You stand beside the first for three turns: your ring wakes it. Then you walk off its line.
      const s = room(C, {}, { depth, map: ROW, you: [3, 4], rooms: SECTION, stations: [{ at: [2, 3], dir: 'E' }, { at: [2, 5], dir: 'E', pips: 2 }] });
      const [, a, b] = s.actors;
      // Then you wait off its line, out of its sight, past AWAKE_IDLE_TURNS and two more chimes.
      const acts = [...waits(3), ...Array.from({ length: 9 }, () => ({ a: 'move', dir: 2 })), ...waits(33)];
      const r = H.play(C, s, acts, { inv: 'all', clone: true });
      assert.deepEqual(r.violations, []);
      const ring = r.events.find(e => e.k === 'woke' && e.who === a.uid);
      assert.equal(json([ring.cause.k, ring.mode]), json(['ring', 'awake']));
      // b had 2 pips and was beside you too: your ring's first pip woke it. Both awake before the chime.
      for (const st of [a, b]) {
        assert.equal(json(lineEvents(r.events, st.uid, 'telegraphed').map(e => e.turn)), json(chimes(N.DEMO_PERIOD, 45)));
        assert.ok(!r.events.some(e => e.k === 'woke' && e.cause.k === 'period' && e.who === st.uid), 'the chime did not wake it: it was awake');
        assert.equal(json(ruleEvents(r.events, 'settle', st.uid)), '[]');
        // Awake before, it stays awake: it never goes back on its own, however long it is left (it acts only on the chime).
        assert.ok(!r.events.some(e => (e.k === 'lost' || e.k === 'returned') && e.who === st.uid), json(r.events.filter(e => e.who === st.uid).map(e => e.k)));
      }
      assert.equal(json(r.state.actors.slice(1).map(x => x.mode)), json(['awake', 'awake']), 'awake before, they stay awake');
      // Alone (no other station's line to hear), left out of its sight longer than an idle exhibit stays awake: still awake.
      const lone = room(C, {}, { depth, map: ROW, you: [3, 4], rooms: SECTION, stations: [{ at: [2, 3], dir: 'E' }] });
      const l = H.play(C, lone, acts, { inv: 'all' });
      assert.deepEqual(l.violations, []);
      assert.equal(json([l.state.actors[0].x, l.state.actors[0].y, l.state.actors[1].mode]), json([12, 4, 'awake']));
      assert.ok(l.state.turn - l.state.actors[1].stim > N.AWAKE_IDLE_TURNS, `left ${l.state.turn - l.state.actors[1].stim} turns, longer than an idle exhibit stays awake`);
      assert.ok(!l.events.some(e => (e.k === 'lost' || e.k === 'returned') && e.who === lone.actors[1].uid));
      // A station asleep at 2 pips, out of your ring: the chime wakes it, and it sleeps again at 2.
      const t = room(C, {}, { depth, map: ROW, you: [12, 5], rooms: SECTION, stations: [{ at: [2, 3], dir: 'E', pips: 2 }] });
      const u = H.play(C, t, waits(13), { inv: 'all' });
      assert.deepEqual(u.violations, []);
      assert.equal(json(ruleEvents(u.events, 'settle').map(e => [e.turn, e.n])), json([[12, 2]]));
      assert.equal(json([u.state.actors[1].mode, u.state.actors[1].pips]), json(['dormant', 2]));
    }
  });

  test('a station held fixed at its chime neither wakes for it nor marks its line (fixed: it can only wait); one fixed after marking has its line called off', () => {
    for (const depth of [1, 4, 7]) {
      // Fixed at turn 8 for 4 turns (a thrown Fixative's, Status.apply): its chime at 10 passes; its next, at 22, wakes it.
      const s = room(C, {}, { depth, map: ROW, you: [8, 1], rooms: SECTION, stations: [{ at: [2, 1], dir: 'E' }] });
      H.play(C, s, waits(8), { inv: [] });
      assert.ok(C.Status.apply(s, s.actors[1], 'fixed', 4, { k: 'item', by: 'you' }, []));
      C.Status.settle(s);
      // Held through its chime at 10 (its status ends at 13): nothing to warn of then; the one
      // at 22 is forecast.
      assert.equal(s.actors[1].statuses[0].until, 13);
      assert.equal(json(Modules.threat(s, 1300)), '[]');
      assert.equal(json(Modules.threat(s, 2500).map(f => f.due)), json([2400]));
      const g = room(C, {}, { depth, map: ROW, you: [8, 1], rooms: SECTION, stations: [{ at: [2, 1], dir: 'E' }] });
      H.play(C, g, waits(7), { inv: [] });
      assert.ok(C.Status.apply(g, g.actors[1], 'fixed', 2, { k: 'item', by: 'you' }, []));
      C.Status.settle(g);
      assert.equal(g.actors[1].statuses[0].until, 10, 'one ending at the chime\'s own boundary is gone by its steps');
      assert.equal(json(Modules.threat(g, 1300).map(f => f.due)), json([1200]));
      const gr = H.play(C, g, waits(6), { inv: 'all' });
      assert.deepEqual(gr.violations, []);
      assert.equal(json(lineEvents(gr.events, g.actors[1].uid, 'telegraphed').map(e => e.turn)), json([10]), 'its status gone at 10, it marks at its chime');
      const r = H.play(C, s, waits(15), { inv: 'all' });
      assert.deepEqual(r.violations, []);
      const st = s.actors[1].uid;
      assert.equal(json(r.events.filter(e => e.k === 'woke' && e.who === st).map(e => e.turn)), json([22]));
      assert.equal(json(lineEvents(r.events, st, 'telegraphed').map(e => e.turn)), json([22]));
      assert.equal(json(ruleEvents(r.events, 'chime').map(e => e.turn)), json([10, 22]), 'the chime sounds on its schedule; the station held fixed does nothing at it');
      // A station awake before its chime, held fixed through it: it marks nothing.
      const v = room(C, {}, { depth, map: ROW, you: [8, 1], rooms: SECTION, stations: [{ at: [2, 1], dir: 'E', mode: 'awake' }] });
      H.play(C, v, waits(8), { inv: [] });
      assert.ok(C.Status.apply(v, v.actors[1], 'fixed', 4, { k: 'item', by: 'you' }, []));
      const w = H.play(C, v, waits(15), { inv: 'all' });
      assert.deepEqual(w.violations, []);
      assert.equal(json(lineEvents(w.events, v.actors[1].uid, 'telegraphed').map(e => e.turn)), json([22]));
      // Fixed at turn 11, after it marked: its line is called off at once, and it sleeps again at 12.
      const t = room(C, {}, { depth, map: ROW, you: [8, 1], rooms: SECTION, stations: [{ at: [2, 1], dir: 'E' }] });
      H.play(C, t, waits(11), { inv: [] });
      const ev = [];
      C.Status.apply(t, t.actors[1], 'fixed', 3, { k: 'item', by: 'you' }, ev);
      assert.ok(ev.some(e => e.k === 'special' && e.cancelled && e.cause.why === 'fixed'), json(ev.map(e => e.k)));
      const u = H.play(C, t, waits(2), { inv: 'all' });
      assert.deepEqual(u.violations, []);
      assert.ok(!u.events.some(e => e.k === 'damaged' && e.cause.sp === SP));
      assert.equal(json(ruleEvents(u.events, 'settle').map(e => e.turn)), json([12]));
    }
  });

  // ---- The threat and the confirmation (D7.3) ----
  // main.js's threatPart, run on the core's namespaces (the browser's globals), as hall.test.js does.
  function threatPart(X) {
    const acorn = require(path.join(root, 'tools/vendor/acorn/acorn.js')), vm = require('node:vm');
    const src = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8'), ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' });
    let fn = null;
    (function walk(n) { if (!n || typeof n.type !== 'string' || fn) return; if (n.type === 'FunctionDeclaration' && n.id && n.id.name === 'threatPart') { fn = n; return; } for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); } })(ast);
    assert.ok(fn, 'main.js has threatPart');
    return s => vm.runInNewContext('(' + src.slice(fn.start, fn.end) + ')', { state: s, Actors: X.Actors, Registry: X.Registry, Object });
  }
  const confirmOf = (X, part, s, t) => { const p = part(s), you = s.actors[0]; return t && X.Text.confirm('threat', Object.assign(p(t), { stay: t.x === you.x && t.y === you.y, more: (t.more || []).map(p) }), X.Labels.nameOf(s)); };

  test('a 300-tick equip begun the turn before the chime is warned of the station\'s line, by its owner, with its damage, as a line not yet marked that can strike there (D7.3); the line strikes during it for that number', () => {
    const part = threatPart(C);
    for (const depth of H.DEPTHS) {
      const s = room(C, {}, { depth, map: ROW, you: [8, 1], rooms: SECTION, stations: [{ at: [2, 1], dir: 'E' }], items: [GARMENT] });
      H.play(C, s, waits(9), { inv: [] });
      const st = s.actors[1], you = s.actors[0], dmg = Specials.net(Roles.at(N.DEMO_LINE_DMG, depth), you.pad);
      assert.equal(s.tick, 900);
      // A wait now: your next decision at 1000, before the line goes off at 1200.
      assert.equal(Specials.threat(s, { a: 'wait' }), null);
      const equip = { a: 'equip', uid: 'g2' }, t = Specials.threat(s, equip);
      assert.equal(json(t), json({ x: 8, y: 1, dmg, by: st.uid, sp: SP, due: 1200 }), `depth ${depth}`);
      const c = confirmOf(C, part, s, t);
      assert.equal(c.title, 'Stay where a line can strike?');
      assert.equal(c.line, `The Semaphore Station, Two-Armed is to mark its line before your next turn; it can reach that tile, and it goes off before then: it would deal you ${dmg}, with no roll.`);
      const r = H.play(C, s, [equip, { a: 'wait' }], { inv: 'all' });
      assert.deepEqual(r.violations, [], `depth ${depth}`);
      const hit = r.steps[0].events.find(e => e.k === 'damaged' && e.who === 'you' && e.cause.sp === SP);
      assert.ok(hit && hit.amount === dmg && hit.turn === 12, `the line struck during the equip for ${hit && hit.amount}, warned as ${dmg}`);
    }
    // Once marked, a wait that lets it go off is warned of as a marked tile.
    const s = room(C, {}, { depth: 3, map: ROW, you: [8, 1], rooms: SECTION, stations: [{ at: [2, 1], dir: 'E' }] });
    H.play(C, s, waits(11), { inv: [] });
    const t = Specials.threat(s, { a: 'wait' });
    assert.equal(json([t.by, t.sp, t.due]), json([s.actors[1].uid, SP, 1200]));
    assert.equal(confirmOf(C, part, s, t).title, 'Stay on the marked tile?');
  });

  test('the forecast gives nothing away: a 300-tick action that would destroy the reflector turning a line back is warned of as one that would not; the line it forecasts holds every tile the chime\'s line then takes', () => {
    for (const depth of [2, 5]) {
      const X = loadCore(), S = X.Specials;
      // The station at (4,1), east; a dish asleep on its line at (9,1); you behind the station.
      const make = () => room(X, {}, { depth, map: ROW, you: [2, 1], rooms: SECTION, stations: [{ at: [4, 1], dir: 'E' }],
        more: [{ sp: 'M11.4', at: [9, 1], mode: 'dormant', stats: X.Roles.stats('controller', depth) }] });
      const s = make();
      H.play(X, s, waits(9), { inv: [] });
      // A planted 300-tick action: 'smite' destroys the dish (as a blow that rolls well would), 'spare' does not.
      X.Actions.get('use').apply = (state, action) => { if (action.uid === 'smite') state.actors[2].gone = 1; return 300; };
      const smite = S.threat(s, { a: 'use', uid: 'smite' }), spare = S.threat(s, { a: 'use', uid: 'spare' });
      assert.equal(json(smite), json(spare), 'the same answer whether or not the dish falls');
      assert.equal(json([smite.x, smite.y, smite.sp, smite.due]), json([2, 1, SP, 1200]), 'behind the station, where the dish would send it back');
      // The forecast: its row east to the room's edge, its own tile, and its row behind it.
      const f = X.Modules.threat(s, 1300);
      assert.equal(json(f.map(m => [m.by, m.due])), json([[s.actors[1].uid, 1200]]));
      assert.equal(json(f[0].tiles), json([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(x => [x, 1])));
      // Played: the dish standing, the line comes back over the station and strikes you, as the dish's.
      const u = make(), r = H.play(X, u, waits(12), { inv: 'all' });
      assert.deepEqual(r.violations, []);
      const back = r.events.find(e => e.k === 'damaged' && e.who === 'you' && e.cause.sp === SP);
      assert.equal(json([back.turn, back.cause.k, back.cause.by, back.cause.shooter]), json([12, 'reflected', u.actors[2].uid, u.actors[1].uid]));
      const marked = lineEvents(r.events, u.actors[1].uid, 'telegraphed')[0];
      assert.ok(marked.tiles.every(t => f[0].tiles.some(q => key(q) === key(t))), 'the line marked lies within the forecast');
    }
  });

  test('a reflector that steps into a station\'s line in the turn before the chime, while you equip behind the station, sends it back onto you, and you were warned (no line goes off on you unwarned)', () => {
    let struck = 0;
    for (const depth of [1, 3, 5, 7]) for (const at of [[8, 2], [9, 2], [10, 2], [8, 3]]) {
      // The dish awake, sent to look at a tile of the line; its next action before the chime's boundary.
      const s = room(C, {}, { depth, map: ROW, you: [2, 1], rooms: SECTION, stations: [{ at: [4, 1], dir: 'E' }], items: [GARMENT],
        more: [{ sp: 'M11.4', at, mode: 'awake', target: [at[0], 1], next: 100000, stats: Roles.stats('controller', depth) }] });
      H.play(C, s, waits(9), { inv: [] });
      s.actors[2].next = 950;
      const t = Specials.threat(s, { a: 'equip', uid: 'g2' });
      assert.ok(t && t.sp === SP && t.x === 2 && t.y === 1, `warned behind the station: ${json(t)}`);
      const r = H.play(C, s, [{ a: 'equip', uid: 'g2' }], { inv: 'all' });
      assert.deepEqual(r.violations, [], `depth ${depth}, the dish from ${at}`);
      if (r.events.some(e => e.k === 'damaged' && e.who === 'you' && e.cause.k === 'reflected' && e.cause.sp === SP)) struck++;
    }
    assert.ok(struck >= 4, `the dish stepped into the line and sent it back onto you in ${struck} runs`);
  });

  // ---- A sealed hall ----
  test('the chime still sounds in a sealed hall: the count from entry runs on while the clock is stopped, and its line strikes on time; the chip says so', () => {
    // ARCH-HALL's hall (x 1–7, y 1–5), its archway (8,2) and staff door (8,4); its 2×2 piece hunting you, held still.
    const MAP = ['#############', '#.......#...#', '#.......,...#', '#.......#...#', '#.......S...#', '#.......#...#', '#############'];
    const ROOMS = [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 7, y1: 5 }, { key: 'sone', role: 'section', x0: 9, y0: 1, x1: 11, y1: 5 }];
    for (const depth of [1, 4, 7]) {
      const piece = { sp: 'dummy', at: [1, 4], size: 2, role: 'centrepiece', mode: 'hunting', stats: tough(), statuses: [{ id: 'fixed', turns: 9999 }] };
      const s = room(C, {}, { depth, map: MAP, you: [6, 1], rooms: ROOMS, stations: [{ at: [2, 1], dir: 'E' }], more: [piece],
        clock: { B: 300, G: 60 }, cp: { uids: [`M11.${depth}.room.2`], room: 'centre' }, fixtures: [{ k: 'staff', x: 8, y: 4, grade: 1 }] });
      const r = H.play(C, s, waits(17), { inv: 'all', clone: depth === 4 });
      assert.deepEqual(r.violations, [], `depth ${depth}`);
      assert.ok(Clock.sealed(r.state), 'the hall is sealed');
      assert.equal(json([r.state.dept.clock.pausedSince, r.state.dept.clock.count]), json([1, 0]), 'sealed at the first boundary, before the clock counted it');
      const p = N.DEMO_PERIOD_HALL;
      assert.equal(json(ruleEvents(r.events, 'chime').map(e => e.turn)), json(chimes(p, 17)));
      assert.equal(json(r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.sp === SP).map(e => e.turn)), json(multiples(p, 17)));
      const v = Object.assign({ sealed: Clock.sealed(r.state), chime: Modules.on(r.state, ID) }, Clock.view(r.state));
      assert.equal(json(Text.stage(v)), json({ name: 'Sealed:', next: 'the clock is stopped, the chime still sounds' }));
    }
  });

  // ---- The mark kept and called off ----
  test('a noise that sends a station marking its line to look elsewhere (awake to awake) leaves its line, which goes off; "Quiet, Please" puts it to sleep, and its line is called off because it went to sleep, never "it stopped hunting you"', () => {
    for (const depth of [1, 4, 7]) {
      // You three tiles from the station, out of your still ring; a dummy asleep beside you.
      const s = room(C, {}, { depth, map: ROW, you: [5, 3], rooms: SECTION, stations: [{ at: [2, 1], dir: 'E' }],
        more: [{ sp: 'dummy', at: [4, 4], mode: 'dormant', stats: tough() }] });
      const st = s.actors[1].uid;
      // Turn 10: the chime; then your blow's noise reaches it.
      const r = H.play(C, s, [...waits(10), { a: 'attack', uid: s.actors[2].uid }, ...waits(2)], { inv: 'all', clone: true });
      assert.deepEqual(r.violations, [], `depth ${depth}`);
      const alerted = r.events.find(e => e.k === 'alerted' && e.who === st);
      assert.ok(alerted && alerted.turn === 10 && alerted.cause.k === 'noise', `the noise sent it to look: ${json(alerted)}`);
      assert.ok(!r.events.some(e => e.k === 'special' && e.who === st && e.cancelled), 'its line was not called off');
      assert.ok(r.events.some(e => e.k === 'special' && e.who === st && !e.cancelled && e.turn === 12), 'its line went off');
      // "Quiet, Please", read at turn 10 beside it: it goes to sleep, and its line is called off.
      // You six tiles off, out of your ring and within its reach.
      const q = room(C, {}, { depth, map: ROW, you: [8, 4], rooms: SECTION, stations: [{ at: [2, 1], dir: 'E' }] });
      C.Consumables.startRun(q);
      const it = C.Consumables.make(q, 'quiet', { at: 'floor', x: 8, y: 4 });
      it.where = { at: 'tote' }; it.n = 1; q.you.tote.push(it.uid); q.run.knownSeals.push(C.Consumables.sealFor(q, 'quiet'));
      const u = H.play(C, q, [...waits(10), { a: 'use', uid: it.uid }, ...waits(14)], { inv: 'all' });
      assert.deepEqual(u.violations, []);
      const cancel = u.events.find(e => e.k === 'special' && e.who === st && e.cancelled);
      assert.ok(cancel && cancel.turn === 10 && cancel.cause.why === 'asleep', json(cancel));
      assert.equal(Text.event(cancel, Labels.nameOf(u.state)), 'The Semaphore Station, Two-Armed’s line was called off: it went to sleep.');
      // Quieted, it has no performance left to end at 12; the next chime wakes it again, and
      // it sleeps again at 24 with the pips the quiet left it (none).
      assert.equal(json(ruleEvents(u.events, 'settle', st).map(e => [e.turn, e.n])), json([[24, 0]]));
      assert.equal(json(u.events.filter(e => e.k === 'woke' && e.who === st).map(e => [e.turn, e.cause.k])), json([[10, 'period'], [22, 'period']]));
    }
  });

  // ---- The Intro's station ----
  test('a station in the Intro beside its partition: its line, and every tile it could take, stay in the Intro and east of the partition, every 8 turns', () => {
    // The Intro as M.11's stamp lays it out: the first room (x 1–7) behind a partition (x 8) with
    // one door on the entrance row; the station east of it at (9,2), its line south.
    const STAMP = ['#fffffff|......', '#.......|......', '#.......|s.....', '#.......|......', 'E.......+......', '#.......|......', '#..b....|......', '#.......|......', '#fffffff|......'];
    const MAP = ['#################', ...STAMP.map(r => r.replace('s', '.') + '#'), '#################'];
    for (const depth of [1, 7]) {
      const s = room(C, {}, { depth, map: MAP, you: [2, 5], rooms: [{ key: 'intro', role: 'intro', x0: 1, y0: 1, x1: 15, y1: 9 }], stations: [{ at: [9, 3], dir: 'S' }],
        more: [{ sp: 'M11.4', at: [14, 9], mode: 'dormant', stats: Roles.stats('controller', depth) }] });
      const a = s.actors[1];
      assert.equal(HD.period(s, a), N.DEMO_PERIOD_INTRO);
      const line = HD.line(s, a), reach = HD.reach(s, a);
      assert.equal(json(line), json([4, 5, 6, 7, 8, 9].map(y => [9, y])));
      assert.equal(json(reach), json([1, 2, 3, 4, 5, 6, 7, 8, 9].map(y => [9, y])));
      for (const t of reach) assert.ok(t[0] > 8, `${t} is east of the partition`);
      const r = H.play(C, s, waits(9), { inv: 'all' });
      assert.deepEqual(r.violations, []);
      assert.equal(json(lineEvents(r.events, a.uid, 'telegraphed').map(e => e.turn)), json([6]));
    }
  });

  // ---- Words, form and switches ----
  test('its words: the chime, the line, the blocked line and the settle, the panel sentence, never "the bell"; its form for the validation log', () => {
    const NAMES = uid => uid === 'x.1' ? 'the Semaphore Station, Two-Armed' : null;
    const ev = (rule, more) => Object.assign({ k: 'module', turn: 3, tick: 300, id: ID, rule, cause: { k: ID } }, more || {});
    const said = [
      Text.event(ev('chime', { turns: 2, n: 3 }), NAMES), Text.event(ev('line', { who: 'x.1' }), NAMES),
      Text.event(ev('blocked', { who: 'x.1' }), NAMES), Text.event(ev('settle', { who: 'x.1', n: 2 }), NAMES),
      Text.event({ k: 'woke', turn: 3, who: 'x.1', was: 'dormant', mode: 'awake', cause: { k: 'period' } }, NAMES),
      Text.event({ k: 'telegraphed', turn: 3, tick: 300, who: 'x.1', sp: SP, tiles: [[1, 1], [2, 1]], cause: { k: 'special', by: 'x.1', sp: SP, gross: 7, due: 500 } }, NAMES),
      Text.event({ k: 'special', turn: 5, tick: 500, who: 'x.1', sp: SP, hits: ['you'], cause: { k: 'special', by: 'x.1', sp: SP } }, NAMES),
      C.Clauses.sentence(ID, { depth: 3 }),
    ];
    assert.equal(json(said), json(['The chime sounded: any line marked at it strikes in 2 turns.', 'The Semaphore Station, Two-Armed marked its line at the chime.',
      'The Semaphore Station, Two-Armed did not mark its line: another mark already lies on it.', 'The Semaphore Station, Two-Armed went back to sleep, with the pips it had.',
      'The Semaphore Station, Two-Armed woke: the chime sounded.', 'The Semaphore Station, Two-Armed marks 2 tiles for its line: 7 before your Padding, in 2 turns.',
      'The Semaphore Station, Two-Armed used its line: it struck you.',
      'On the chime, every station marks its line across its room, and two turns later the line strikes everything on it.']));
    for (const s of said) { assert.ok(clean(s), s); assert.doesNotMatch(s, /\bbell\b/i, s); }
    // A rule about a station that names none is not told (it could be one out of view); the chime always is.
    for (const rule of ['line', 'blocked', 'settle']) assert.equal(Text.event(ev(rule), NAMES), null, rule);
    assert.equal(json(Modules.form(ID)), json({ rules: [{ rule: 'chime', on: 'turn', do: ['flag'], telegraph: null }, { rule: 'line', on: 'period', do: ['special'], telegraph: { turns: W, shown: SP } },
      { rule: 'blocked', on: 'period', do: ['flag'], telegraph: null }], bespoke: ['turn', 'threat', 'Wake.perform', 'Wake.resleep'] }));
    assert.ok(Modules.bespoke().some(b => b.id === ID));
    // Its registry entries are at ready true, with these files.
    for (const [t, id] of [['MODULES', ID], ['ARCHETYPES', 'demonstrator'], ['TRIGGERS', 'period'], ['SPECIALS', SP], ['WAKE_CAUSES', 'period']])
      assert.equal(C.Registry[t][id].ready, true, `${t}.${id}`);
  });

  test('switched off (rulesOff), or in a room without the module, no chime sounds, no station wakes for it or marks a line, and its threat warns of nothing', () => {
    for (const depth of [1, 7]) {
      const off = room(C, { rulesOff: [ID] }, { depth, map: ROW, you: [8, 1], rooms: SECTION, stations: [{ at: [2, 1], dir: 'E' }], items: [GARMENT] });
      const r = H.play(C, off, waits(25), { inv: 'all' });
      assert.deepEqual(r.violations, []);
      assert.ok(!r.events.some(e => (e.k === 'module' && e.id === ID) || e.k === 'telegraphed' || (e.k === 'woke' && e.cause.k === 'period')), json(r.events.map(e => e.k)));
      assert.equal(HD.next(off, 1), null);
      assert.equal(json(Modules.threat(off, 99999)), '[]');
      // A room made without the pack's modules (no Modules.init): the same.
      const bare = H.room(C, 1, { acc: 'M11', depth, map: ROW, you: [8, 1], rooms: SECTION, exhibits: [{ sp: 'M11.2', at: [2, 1], stats: Roles.stats('controller', depth) }] }, {});
      bare.actors[1].route = { dir: 'E' };
      const u = H.play(C, bare, waits(25), { inv: 'all' });
      assert.deepEqual(u.violations, []);
      assert.ok(!u.events.some(e => e.k === 'telegraphed' || (e.k === 'woke' && e.cause.k === 'period')));
    }
  });

  test('a department of M.11 holds the module\'s state, counting from entry; its stations\' chimes run at every depth', () => {
    for (const depth of H.DEPTHS) {
      const s = C.Dept.create(3, 'M11', depth);
      assert.equal(json(s.dept.modules.find(m => m.id === ID)), json({ id: ID, role: 'signature', on: true, since: 0, params: {} }));
      assert.equal(json(HD.next(s, s.dept.roomOf[s.actors[0].y][s.actors[0].x])), json({ next: N.DEMO_PERIOD_INTRO - W, period: N.DEMO_PERIOD_INTRO }), 'you stand in the Intro');
    }
  });
};
