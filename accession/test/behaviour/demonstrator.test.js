// ACCESSION — the demonstrator archetype, M.11's stations (BUILD.md §5.4, §8.2; M4 plan D1.10;
// MOD-CHIME): its line, "Stands fixed on its tile, never hunts you and has no blow.", true with
// its module on or off, and its hooks: a station's line from population or from its own init,
// its wake region (the ring's, and every tile its line could take), and its waking (never into
// a hunt). Joined up: the real core, real actions only, every invariant checked after every step
// (chime.inv.js among them), the main scenario clone-checked, for every pack station (M11.2) at
// depths 1–7. The figures expected are worked out here from BUILD's sentences, not from
// rules/arch/demonstrator.js.
'use strict';
const H = require('./_harness.js');
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Roles, N, Archetypes, Specials, Modules, Packs, Text, Labels, Wake } = C;
  const json = x => JSON.stringify(x);
  const ok = (results, name) => { const f = H.failures(results); assert.equal(f.length, 0, `${name}:\n${f.slice(0, 5).join('\n')}`); };
  const list = () => { const l = H.species(C, 'demonstrator'); assert.ok(l.length >= 7, `${l.length} species and depths`); return l; };
  const key = t => `${t[0]},${t[1]}`;

  // A room of M.11 running its modules (Modules.init, as a department does), you hard to kill.
  // stations: [{at, dir?, pips?, mode?}], each the pack's station, M11.2; more: other exhibits.
  function room(X, opts, o) {
    const depth = o.depth || 3, sp = Packs.species('M11', 'M11.2');
    const exhibits = (o.stations || []).map(st => Object.assign({ sp: 'M11.2', at: st.at, stats: Roles.stats(sp.role, depth) }, st.pips !== undefined ? { pips: st.pips } : {}, st.mode ? { mode: st.mode } : {}));
    const s = H.room(X, opts.seed || 1, Object.assign({ acc: 'M11', depth, map: o.map, you: o.you, exhibits: exhibits.concat(o.more || []) },
      o.rooms ? { rooms: o.rooms } : {}, o.items ? { items: o.items } : {}, o.clock ? { clock: o.clock } : {}), { rulesOff: opts.rulesOff || [] });
    s.actors[0].hp = s.actors[0].maxHp = 999;
    (o.stations || []).forEach((st, i) => { if (st.dir) s.actors[1 + i].route = { dir: st.dir }; });
    X.Modules.init(s, X.Packs.get('M11'));
    return s;
  }
  const ROW = ['################', '#..............#', '#..............#', '#..............#', '#..............#', '#..............#', '################'];
  const SECTION = [{ key: 'sone', role: 'section', x0: 1, y0: 1, x1: 14, y1: 5 }];

  // ---- Its line ----
  const stands = H.scenario({
    name: 'it stands fixed on its tile, never hunts you and has no blow: your ring wakes it awake, not hunting; struck, it stays awake; beside you it never strikes or steps',
    id: 'demonstrator', clone: true,
    build: (params, sp, depth, opts) => room(C, opts, { depth, map: ROW, you: [6, 3], rooms: SECTION, stations: [{ at: [5, 3], dir: 'N' }] }),
    // Beside it: three waits wake it by your ring; then three blows; then waits to turn 14.
    actions: (s, i) => i < 4 ? { a: 'wait' } : i < 7 ? { a: 'attack', uid: s.actors[1].uid } : i < 14 ? { a: 'wait' } : null,
    expect(r) {
      const a = r.start.actors[1], end = r.state.actors[1];
      const woke = r.events.find(e => e.k === 'woke' && e.who === a.uid);
      if (!woke || woke.cause.k !== 'ring' || woke.mode !== 'awake') return `your ring woke it as ${json(woke)}, not awake`;
      if (r.events.some(e => e.k === 'hunting' && e.who === a.uid)) return 'it began hunting you';
      if (end.x !== 5 || end.y !== 3 || end.mode !== 'awake') return `it ended ${end.mode} at ${end.x},${end.y}`;
      if (r.events.some(e => (e.k === 'attacked' && e.by === a.uid) || (e.k === 'moved' && e.who === a.uid))) return 'it struck or stepped';
      if (!r.events.some(e => e.k === 'damaged' && e.who === a.uid)) return 'your blows never landed';
      // Its labels' line says so whatever its module does.
      if (!r.clause || !r.clause.startsWith('Stands fixed on its tile, never hunts you and has no blow.')) return `its line reads "${r.clause}"`;
      return null;
    },
  });
  test('the station stands fixed on its tile, never hunts you and has no blow: woken by your ring and struck, it stays awake on its tile, at depths 1–7, clone-checked', () => {
    ok(H.sweep(C, stands, list()), stands.name);
  });

  test('whatever would start another exhibit hunting wakes a station awake instead: a blow, a night-watch bell, a broken case\'s release, being seen; and it says so truly', () => {
    for (const depth of [1, 4, 7]) {
      // A blow on a sleeping station: it wakes, awake, and the log says it was struck.
      const s = room(C, {}, { depth, map: ROW, you: [6, 3], rooms: SECTION, stations: [{ at: [5, 3], dir: 'N' }] });
      const r = H.play(C, s, [{ a: 'attack', uid: s.actors[1].uid }], { inv: 'all' });
      assert.deepEqual(r.violations, []);
      const w = r.events.find(e => e.k === 'woke' && e.who === s.actors[1].uid);
      assert.equal(json([w.mode, w.cause.k]), json(['awake', 'damage']), `depth ${depth}`);
      assert.equal(Text.event(w, Labels.nameOf(r.state)), 'The Semaphore Station, Two-Armed woke: it was struck.');
      assert.ok(!r.events.some(e => e.k === 'hunting'), 'no hunt');
      // A night-watch bell names it, and it wakes awake (Wake.wake into hunting, for a station, is awake).
      const t = room(C, {}, { depth, map: ROW, you: [12, 3], rooms: SECTION, stations: [{ at: [5, 3], dir: 'N' }] }), a = t.actors[1], ev = [];
      assert.equal(Wake.wake(t, a, 'hunting', { k: 'night_bell', n: 1, dist: 7 }, ev, { lastKnown: [12, 3] }), true);
      assert.equal(json([a.mode, ev.map(e => e.k)]), json(['awake', ['woke']]));
      // Awake and seeing you, it does not hunt; asked to hunt (Wake.setMode, as a blow asks), it changes nothing.
      assert.equal(Wake.setMode(t, a, 'hunting', { k: 'seen', dist: 7 }, ev), false);
      assert.equal(a.mode, 'awake');
      // Searching (as nothing in the rules makes it, but a test may), it goes awake, looking where it stands.
      a.mode = 'searching';
      assert.equal(Wake.setMode(t, a, 'hunting', { k: 'damage' }, ev), true);
      assert.equal(json([a.mode, a.target]), json(['awake', [5, 3]]));
    }
  });

  test('neither a rule nor the Window Pole moves a station: the pole is refused, cannot_move, and the station keeps its tile', () => {
    for (const depth of [2, 5]) {
      const s = room(C, {}, { depth, map: ROW, you: [3, 3], rooms: SECTION, stations: [{ at: [4, 3], dir: 'N' }],
        items: [{ uid: 'w', kind: 'instrument', form: 'pole', tier: 1, where: { at: 'kit', slot: 'instrument' } }] });
      for (const how of ['push', 'pull']) {
        const r = H.play(C, s, [{ a: 'use', uid: 'w', x: 4, y: 3, how }], { inv: 'all' });
        assert.deepEqual(r.violations, []);
        const refused = r.events.find(e => e.k === 'refused');
        assert.ok(refused && refused.reason === 'cannot_move', `${how}: ${json(r.events.map(e => e.k))}`);
        assert.equal(key([s.actors[1].x, s.actors[1].y]), '4,3');
      }
      assert.equal(Archetypes.mayStep(s, s.actors[1], 5, 3), false);
    }
  });

  // ---- Its line's direction ----
  test('a station placed with no line takes the longest straight run of its room that sight passes, N, E, S or W, the first on a tie; one with a line keeps it', () => {
    // The harness writes a room's rooms after Setup.room has run each archetype's init (as a
    // department's population fixes a line before it does): so its init runs again here, with
    // the rooms in place and no line yet, as a department's would.
    const at = (map, xy, rooms) => {
      const s = room(C, {}, { map, you: [1, 1], rooms, stations: [{ at: xy }] }), a = s.actors[1];
      a.route = null;
      Archetypes.init(s, a);
      return a.route.dir;
    };
    // In a long row: east, the longer way; west of the middle, west is shorter.
    assert.equal(at(ROW, [3, 3], SECTION), 'E');
    assert.equal(at(ROW, [12, 3], SECTION), 'W');
    // A column at (5,3) cuts the east run to 1 tile: west, north and south are 2 each, so the first of them, north.
    const pillared = ROW.map((r, y) => y === 3 ? r.slice(0, 5) + 'o' + r.slice(6) : r);
    assert.equal(at(pillared, [3, 3], SECTION), 'N');
    // A column at (6,3): east is 2 too, a tie of four, north first; at (7,3), east is 3, the longest.
    assert.equal(at(ROW.map((r, y) => y === 3 ? r.slice(0, 6) + 'o' + r.slice(7) : r), [3, 3], SECTION), 'N');
    assert.equal(at(ROW.map((r, y) => y === 3 ? r.slice(0, 7) + 'o' + r.slice(8) : r), [3, 3], SECTION), 'E');
    // A square room's middle: every run 2, so the first, north.
    assert.equal(at(['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'], [3, 3], [{ key: 'sq', role: 'section', x0: 1, y0: 1, x1: 5, y1: 5 }]), 'N');
    // The run stays in its room: a room of the row's west half only.
    assert.equal(at(ROW, [3, 3], [{ key: 'west', role: 'section', x0: 1, y0: 1, x1: 4, y1: 5 }, { key: 'east', role: 'section', x0: 6, y0: 1, x1: 14, y1: 5 }]), 'N');
    // A route already given (population's, from its gallery's dir) is kept.
    const s = room(C, {}, { map: ROW, you: [1, 1], rooms: SECTION, stations: [{ at: [3, 3], dir: 'S' }] });
    assert.equal(s.actors[1].route.dir, 'S');
  });

  // ---- Its wake region ----
  test('its wake region adds every tile its line could take when a line of its goes off within the turns asked, and nothing with its module off; standing still on any tile of the room, you are struck there only if the region holds it', () => {
    const OPEN = ['##########', '#........#', '#........#', '#........#', '##########'], ROOM = [{ key: 'sone', role: 'section', x0: 1, y0: 1, x1: 8, y1: 3 }];
    for (const depth of [1, 4, 7]) {
      const make = (opts, more, you) => room(C, opts, { depth, map: OPEN, you: you || [1, 1], rooms: ROOM, stations: [{ at: [3, 2], dir: 'E' }], more });
      const s = make({}), a = s.actors[1];
      const ring = Archetypes.wakeRegion(make({ rulesOff: ['hourly_demonstration'] }), make({ rulesOff: ['hourly_demonstration'] }).actors[1], 20).map(key);
      const region = Archetypes.wakeRegion(s, a, 20).map(key);
      const out = ['4,2', '5,2', '6,2', '7,2', '8,2'];
      for (const t of out) assert.ok(region.includes(t), `depth ${depth}: ${t} on its line is in its region`);
      assert.ok(ring.every(t => region.includes(t)), 'the ring\'s region is in it');
      assert.ok(!ring.includes('8,2'), 'the line adds a tile the ring does not reach');
      // No reflector stands: its line cannot come back, so nothing behind it is added.
      assert.ok(!region.includes('1,2') || ring.includes('1,2'));
      // Over too few turns for a line to go off (its first at count 12, after the chime at 10), nothing is added.
      assert.equal(json(Archetypes.wakeRegion(s, a, 11).map(key).filter(t => !ring.includes(t))), '[]');
      assert.ok(Archetypes.wakeRegion(s, a, 12).map(key).includes('8,2'));
      // A reflector standing anywhere: the run behind it, and its own tile, are added.
      const dish = { sp: 'M11.4', at: [8, 1], mode: 'dormant', stats: Roles.stats('controller', depth) };
      const t = make({}, [dish]), back = Archetypes.wakeRegion(t, t.actors[1], 20).map(key);
      for (const k of ['1,2', '2,2', '3,2']) assert.ok(back.includes(k), `with a reflector, ${k}`);
      // Joined up: standing still on each tile of the room for 14 turns, struck by its line only on a tile of its region.
      for (let y = 1; y <= 3; y++) for (let x = 1; x <= 8; x++) {
        if (x === 3 && y === 2) continue;
        const u = make({}, [], [x, y]), r = H.play(C, u, Array.from({ length: 14 }, () => ({ a: 'wait' })), { inv: [] });
        const struck = r.events.some(e => e.k === 'damaged' && e.who === 'you' && e.cause.sp === 'demo_line');
        if (struck) assert.ok(region.includes(`${x},${y}`), `depth ${depth}: struck at ${x},${y}, outside its region`);
        assert.equal(struck, out.includes(`${x},${y}`), `depth ${depth}: at ${x},${y}`);
      }
    }
  });

  test('its line\'s words: true with the module on and off, and its odds name no blow', () => {
    const sp = Packs.species('M11', 'M11.2');
    for (const depth of [1, 4, 7]) {
      const on = C.Clauses.line(sp, { depth }), off = C.Clauses.line(sp, { depth, rulesOff: ['hourly_demonstration'] });
      assert.ok(on.startsWith('Stands fixed on its tile, never hunts you and has no blow.') && off.startsWith('Stands fixed on its tile, never hunts you and has no blow.'));
      assert.match(off, /Wakes when you stay inside your ring or make noise near it; no chime wakes it here\.$/);
      assert.doesNotMatch(off, /chime,|strikes all/);
      const gross = Roles.at(N.DEMO_LINE_DMG, depth);
      assert.ok(on.includes(`Wakes when you stay inside your ring or make noise near it; on each chime, every ${N.DEMO_PERIOD} turns (${N.DEMO_PERIOD_INTRO} in the Intro, ${N.DEMO_PERIOD_HALL} in the hall), it wakes and, unless another mark lies on its line, marks its line: a beam across its room, through glass and back from a reflector, that strikes all on it ${N.DEMO_WARNING} turns later for ${gross} before Padding; then it sleeps again with its pips, unless it was awake before.`), on);
    }
    // Its label: the odds give no chance of a blow, and no Attack button is its.
    const s = room(C, {}, { map: ROW, you: [6, 3], rooms: SECTION, stations: [{ at: [5, 3], dir: 'N' }] });
    const l = Labels.of(s, s.actors[1].uid);
    assert.ok(l && l.behaviour.startsWith('Stands fixed on its tile'), json(l && l.behaviour));
    // It has no blow, so nothing on its label gives one: no chance of its hitting you, no
    // blow's Acc or damage (M4's first integration review: the readout said "It has an 85%
    // chance to hit you … could defeat you in 12 hits").
    assert.ok(!l.odds.some(t => /chance to hit you|defeat you|hits for/.test(t)), json(l.odds));
    assert.ok(!l.pictos.some(p => p.icon === 'acc' || p.icon === 'damage'), json(l.pictos));
  });
};
