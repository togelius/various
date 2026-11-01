// ACCESSION — the Grazer's Behaviour line, its archetype's part (BUILD.md §5.3, §5.5; MOD-UNOBSERVED):
// "Walks a tile at a time, and strikes from beside you for {dmg}." (with unobserved_motion on,
// its slot holds the module's part, test/behaviour/unobserved_motion.test.js). Each scenario
// runs for every pack Grazer (S9.1) at depths 1–7, joined up, every invariant checked after every
// step, a clone checked where it says so. Also its wake region (plan A8): asleep, the default's
// ring; awake, the sight from anywhere it has the time to walk to, at its pace (2 tiles a turn
// with the module on, a tile a turn with it off), never smaller than what it sees when played;
// hunting, none.
'use strict';
const H = require('./_harness.js');
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Roles, N, Grid, Archetypes, State, Modules } = C;
  const json = x => JSON.stringify(x);
  const waits = n => Array.from({ length: n }, () => ({ a: 'wait' }));
  const ok = (results, name) => { const f = H.failures(results); assert.equal(f.length, 0, `${name}:\n${f.slice(0, 5).join('\n')}`); };
  const list = () => { const l = H.species(C, 'unobserved_mover'); assert.ok(l.length >= 7, `${l.length} species and depths`); return l; };
  const grazer = s => s.actors.find(a => a.arch === 'unobserved_mover');
  const ID = 'unobserved_motion';

  // A room in S.9 (the Grazer's species flagged with unobserved_motion), you hard to kill;
  // modules: whether the visit runs S.9's modules (as a department does).
  function room(opts, spec, modules) {
    const s = H.room(C, opts.seed, Object.assign({ acc: 'S9' }, spec), { rulesOff: opts.rulesOff });
    s.actors[0].hp = s.actors[0].maxHp = 999;
    if (modules) Modules.init(s, C.Packs.get('S9'));
    return s;
  }

  // ---- Walks a tile at a time, and strikes from beside you (the module off) ----
  const OPEN = ['##############', '#............#', '#............#', '#............#', '#............#', '#............#', '##############'];
  const walk = modules => H.scenario({
    name: `it walks a tile a turn after you, in your sight too, and strikes from beside you for its damage (${modules ? 'unobserved_motion switched off' : 'a room without the module'})`,
    id: 'unobserved_mover', clone: true,
    build: (params, sp, depth, opts) => room({ seed: opts.seed, rulesOff: modules ? opts.rulesOff.concat([ID]) : opts.rulesOff },
      { depth, map: OPEN, you: [2, 3], exhibits: [{ sp: sp.id, at: [10, 3], mode: 'hunting', lastKnown: [2, 3], stim: 0, stats: Roles.stats(sp.role, depth) }] }, modules),
    actions: waits(14),
    expect(r, params, sp, depth) {
      const g = grazer(r.start), steps = r.events.filter(e => e.k === 'moved' && e.who === g.uid);
      // A tile a turn: one step at each of its actions, each a turn apart, until beside you.
      if (json(steps.map(e => e.turn)) !== json(steps.map((e, k) => k))) return `it stepped in turns ${json(steps.map(e => e.turn))}, not one a turn`;
      if (steps.length !== 7 || Grid.chebyshev(steps[6].to[0], steps[6].to[1], 2, 3) !== 1) return `it took ${steps.length} steps, to ${json(steps.map(e => e.to))}, not 7 to beside you`;
      const blows = r.events.filter(e => e.k === 'attacked' && e.by === g.uid);
      if (blows.length < 5 || blows.some(e => e.how.kind !== 'melee')) return `${blows.length} blows from beside you`;
      const st = Roles.stats(sp.role, depth), hits = r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.by === g.uid);
      if (hits.some(e => e.cause.k !== 'attack' || e.cause.raw < st.dmin || e.cause.raw > st.dmax)) return `a blow outside ${params.dmg}`;
      if (r.events.some(e => e.k === 'module' && e.id === ID)) return 'with the module off it told a stride';
      return null;
    },
  });
  test('with unobserved_motion off, or in a room without it, it walks a tile a turn and strikes from beside you for {dmg}; its line says so', () => {
    for (const modules of [true, false]) { const sc = walk(modules); ok(H.sweep(C, sc, list()), sc.name); }
    for (let depth = 1; depth <= 7; depth++) {
      const sp = C.Packs.species('S9', 'S9.1'), st = Roles.stats(sp.role, depth), part = C.Clauses.of(sp, { depth }).find(p => p.id === 'unobserved_mover');
      assert.equal(part.params.dmg, `${st.dmin}–${st.dmax}`);
      for (const ctx of [{ depth, rulesOff: [ID] }, { depth, modules: [] }, { depth, modules: ['alarm_network'] }])
        assert.equal(C.Clauses.line(sp, ctx), `Walks a tile at a time, and strikes from beside you for ${st.dmin}–${st.dmax}. Wakes when you stay inside your ring or make noise near it.`);
    }
    // A species of the archetype not flagged with the module walks a tile a turn even in a
    // visit that runs it (Modules.flagged), and its line says so.
    const X = loadCore(), sp = Object.assign({}, X.Packs.species('S9', 'S9.1'), { flags: [] });
    assert.equal(X.Clauses.line(sp, { depth: 3, modules: [ID] }), 'Walks a tile at a time, and strikes from beside you for 4–9. Wakes when you stay inside your ring or make noise near it.');
    X.Packs.species('S9', 'S9.1').flags = [];
    const s = H.room(X, 1, { acc: 'S9', depth: 3, map: OPEN, you: [2, 3], exhibits: [{ sp: 'S9.1', at: [10, 3], mode: 'hunting', lastKnown: [2, 3], stim: 0, stats: Roles.stats('ambusher', 3) }] });
    X.Modules.init(s, X.Packs.get('S9'));
    const r = H.play(X, s, waits(4));
    assert.equal(json(r.events.filter(e => e.k === 'moved').map(e => e.turn)), json([0, 1, 2, 3]));
  });

  // ---- Its wake region (plan A8), for D-LV6's safe zone and the runner ----
  // What a Grazer actually sees over `turns` turns, played joined up with you never seen by it
  // (its sight of you switched off, in a core of its own): every tile you could stand on (as at
  // the start, not its own tile then) within SIGHT_EXHIBIT of where it stands at each of its
  // actions, in line of sight on the map as it is then. Also the tiles it stood on.
  let unseen = null;
  function seenOver(s, uid, turns) {
    if (!unseen) { unseen = loadCore(); unseen.AI.sees = () => false; }
    const X = unseen, play = X.State.clone(s), from = [], act = X.AI.act, until = s.tick + turns * N.TICKS_PER_TURN;
    X.AI.act = (st, b, ev) => { if (b.uid === uid && st.tick <= until) from.push({ x: b.x, y: b.y, tiles: st.dept.tiles.slice() }); return act(st, b, ev); };
    try { for (let t = 0; t <= turns && !play.over; t++) X.Step.step(play, { a: 'wait' }); } finally { X.AI.act = act; }
    const a = s.actors.find(b => b.uid === uid), m = s.dept, out = new Set();
    for (const p of from) for (let y = Math.max(0, p.y - N.SIGHT_EXHIBIT); y <= Math.min(m.h - 1, p.y + N.SIGHT_EXHIBIT); y++) for (let x = Math.max(0, p.x - N.SIGHT_EXHIBIT); x <= Math.min(m.w - 1, p.x + N.SIGHT_EXHIBIT); x++) {
      if (!Grid.disc(x - p.x, y - p.y, N.SIGHT_EXHIBIT) || (x === a.x && y === a.y) || !Grid.walkable(m, x, y) || Grid.closedDoor(m, x, y)) continue;
      if (Grid.los({ w: m.w, h: m.h, tiles: p.tiles, surfaces: [] }, p.x, p.y, x, y)) out.add(x + ',' + y);
    }
    return { seen: out, stood: from.map(p => p.x + ',' + p.y) };
  }
  const regionOf = (s, a, turns) => new Set(Archetypes.wakeRegion(s, a, turns).map(t => t.join(',')));
  const outside = (seen, R) => [...seen].filter(k => !R.has(k));

  // A long gallery (x 1–42), a room below it through a door at (16, 4), and a pocket walled off
  // from both (x 44–48), where you stand: nothing reaches it or sees into it.
  const LONG = ['#'.repeat(50)].concat([1, 2, 3].map(() => '#' + '.'.repeat(42) + '#' + '.'.repeat(5) + '#'),
    ['#'.repeat(16) + '+' + '#'.repeat(27) + '.'.repeat(5) + '#', '#' + '.'.repeat(42) + '#' + '.'.repeat(5) + '#', '#'.repeat(50)]);
  const longRoom = (opts, mode, more, modules) => room(opts, { depth: 3, map: LONG, you: [46, 3], exhibits: [Object.assign({ sp: 'S9.1', at: [2, 2], mode, stats: Roles.stats('ambusher', 3) }, more)] }, modules);
  test('asleep, its wake region is the default\'s ring; hunting you or gone, it has none', () => {
    for (const modules of [true, false]) {
      const s = longRoom({ seed: 1, rulesOff: [] }, 'dormant', {}, modules), a = grazer(s);
      const plodder = Object.assign({}, a, { arch: 'plodder', sp: 'dummy' });
      const R = Archetypes.wakeRegion(s, a, N.SAFE_ZONE_TURNS);
      assert.ok(R.length > 0);
      assert.equal(json(R), json(Archetypes.wakeRegion(s, plodder, N.SAFE_ZONE_TURNS)), 'asleep: the ring, as any sleeper\'s');
      assert.equal(json(Archetypes.wakeRegion(s, Object.assign({}, a, { mode: 'hunting', lastKnown: [3, 2] }), N.SAFE_ZONE_TURNS)), '[]');
      assert.equal(json(Archetypes.wakeRegion(s, Object.assign({}, a, { mode: 'awake', gone: 1 }), N.SAFE_ZONE_TURNS)), '[]');
    }
  });

  test('awake, its wake region is the sight from anywhere it has the time to walk to: 2 tiles a turn with the module on, a tile a turn with it off; it reads nothing and draws on no stream', () => {
    const far = (R, y) => Math.max(...[...R].filter(k => Number(k.split(',')[1]) === y).map(k => Number(k.split(',')[0])));
    for (const turns of [0, 3, 6, 10]) {
      const on = longRoom({ seed: 1, rulesOff: [] }, 'awake', { target: [40, 2] }, true), off = longRoom({ seed: 1, rulesOff: [ID] }, 'awake', { target: [40, 2] }, true);
      const before = State.hash(on), Ron = regionOf(on, grazer(on), turns), Roff = regionOf(off, grazer(off), turns);
      assert.equal(State.hash(on), before, 'reading the region changes nothing');
      assert.ok(!Object.keys(on.rng).length, 'it draws on no stream');
      // Along the gallery's top rows it reaches from 2 + its steps + SIGHT_EXHIBIT.
      assert.equal(far(Ron, 1), Math.min(42, 2 + 2 * turns + N.SIGHT_EXHIBIT), `on, ${turns} turns`);
      assert.equal(far(Roff, 1), Math.min(42, 2 + turns + N.SIGHT_EXHIBIT), `off, ${turns} turns`);
      assert.ok([...Roff].every(k => Ron.has(k)));
      assert.ok(![...Ron].some(k => Number(k.split(',')[0]) >= 44), 'the pocket you stand in it never sees');
    }
    // Through the door it may open, the side room; in a case, only from its own tile.
    const s = longRoom({ seed: 1, rulesOff: [] }, 'awake', { at: [14, 2], target: [16, 4] }, true), R = regionOf(s, grazer(s), 5);
    assert.ok(R.has('16,5') && R.has('8,5'), 'through the door into the room below');
  });

  test('awake (sent to look, searching, going home), its wake region holds every tile it sees when played, with the module on or off', () => {
    const cases = [['awake', { target: [40, 2] }], ['awake', { target: [16, 5] }], ['searching', { lastKnown: [30, 1] }], ['returning', { at: [30, 2], home: [3, 5] }]];
    for (const modules of [true, false]) for (const [mode, more] of cases) for (const turns of [5, N.SAFE_ZONE_TURNS]) {
      const s = longRoom({ seed: 1, rulesOff: [] }, mode, Object.assign({ stim: 0 }, more), modules), a = grazer(s);
      const R = regionOf(s, a, turns), { seen, stood } = seenOver(s, a.uid, turns);
      assert.ok(stood.length > 1, `${mode} ${json(more)}: it acted`);
      assert.deepEqual(outside(seen, R), [], `${modules ? 'on' : 'off'}, ${mode} ${json(more)}, ${turns} turns: tiles it saw outside its region`);
    }
  });

  // A door another exhibit opens lets it see through, where it has no time to reach the door
  // itself: it walks west from beside the door's room, and a plodder opens the door at once.
  test('a door another opens lets it see through before it could reach the door: its wake region counts every door open', () => {
    for (const modules of [true, false]) {
      const s = room({ seed: 1, rulesOff: [] }, { depth: 3, map: LONG, you: [46, 3], exhibits: [{ sp: 'S9.1', at: [16, 1], mode: 'awake', target: [2, 1], stim: 0, stats: Roles.stats('ambusher', 3) },
        { sp: 'dummy', at: [16, 3], mode: 'awake', target: [16, 5], stim: 0, stats: { hp: 99, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } }] }, modules);
      const a = grazer(s), R = regionOf(s, a, 1), { seen } = seenOver(s, a.uid, 1);
      assert.ok(seen.has('16,5'), `${modules}: it saw through the opened door (${[...seen].filter(k => Number(k.split(',')[1]) === 5).join(' ')})`);
      assert.deepEqual(outside(seen, R), [], `${modules ? 'on' : 'off'}: tiles it saw outside its region`);
    }
  });

  // S.9 with a gallery list (fixture galleries, as D-PACKS will give it): Grazers placed by
  // population, asleep; each made awake (sent to look at a far tile of its room, as a noise
  // would send it), and its region over SAFE_ZONE_TURNS holds all it sees, played joined up.
  const GALLERIES = [
    { key: 'intro', name: 'The Lamp Corridor', contents: [] },
    { key: 's1', where: 'central', name: 'The Mount Court', contents: [{ sp: 'S9.1' }, { sp: 'S9.2' }, { sp: 'S9.3' }, { sp: 'S9.6', count: 2 }] },
    { key: 's2', where: 'band', name: 'The Brooders\' Bay', contents: [{ sp: 'S9.1' }, { sp: 'S9.4', guards: 'case' }, { sp: 'S9.5', near: 'case' }] },
    { key: 'last', name: 'The Round-Book Room', contents: [{ sp: 'S9.6' }] },
    { key: 'centre', name: 'The Day Curator\'s Case', contents: [{ sp: 'S9.1', count: 2 }] },
    { key: 'coda', name: 'The Night Staff\'s Tea Room', contents: [] },
  ];
  test('in S.9 departments, each Grazer\'s wake region holds every tile it sees, asleep (the ring) and awake (played joined up, you unseen)', () => {
    const X = loadCore();
    X.Packs.get('S9').galleries = JSON.parse(json(GALLERIES));
    let n = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = X.Dept.create(seed, 'S9', 1 + ((seed - 1) % 7));
      for (const a of s.actors.filter(b => b.arch === 'unobserved_mover')) {
        n++;
        assert.equal(a.mode, 'dormant');
        assert.ok(X.Archetypes.wakeRegion(s, a, N.SAFE_ZONE_TURNS).length > 0, `seed ${seed}: ${a.uid} asleep has its ring`);
        const w = X.State.clone(s), b = w.actors.find(o => o.uid === a.uid), goal = X.AI.wanderGoal(w, b);
        X.Wake.wake(w, b, 'awake', { k: 'noise', x: goal[0], y: goal[1], dist: 1 }, [], { target: goal });
        const R = regionOf(w, b, N.SAFE_ZONE_TURNS), { seen } = seenOver(w, b.uid, N.SAFE_ZONE_TURNS);
        assert.deepEqual(outside(seen, R), [], `seed ${seed}, ${a.uid}: tiles it saw outside its region`);
      }
    }
    assert.ok(n >= 12, `${n} Grazers`);
  });
};
