// The axis_sniper's Behaviour-line clause and its special, the `line` beam (BUILD.md §5.3, §5.5,
// §8.1): "Moves to share your row or column with no reflector between you, then {special}. It
// never strikes.", the special being "aims along it for a turn, with the line shown, then
// fires a beam up to {AXIS_BEAM_RANGE} tiles that passes through glass, for {gross} before
// your Padding". Each scenario is a function of its clause's parameters, run for every
// species whose line has it (the Heliographs), at every depth 1–7, with every invariant
// checked after every step and a clone check.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const C = loadCore();
  const { Setup, Roles, Specials, N } = C;
  const json = x => JSON.stringify(x);
  const accOf = sp => C.Packs.list().find(p => p.species.includes(sp)).acc;
  const waits = n => Array.from({ length: n }, () => ({ a: 'wait' }));
  const OPEN = ['################', ...Array.from({ length: 7 }, () => '#..............#'), '################'];
  const room = (sp, depth, opts, map, you, exhibits) => Setup.room(opts.seed, { acc: accOf(sp), depth, map, you, exhibits }, { rulesOff: opts.rulesOff, invulnerable: true });
  const sniper = (sp, depth, at, extra) => Object.assign({ sp: sp.id, at, mode: 'hunting', stats: Roles.stats(sp.role, depth) }, extra || {});
  function track(r, uid) {
    const a = r.start.actors.find(x => x.uid === uid);
    let p = [a.x, a.y];
    const out = [p];
    for (const s of r.steps) { for (const e of s.events) if (e.k === 'moved' && e.who === uid) p = e.to; out.push(p); }
    return out;
  }
  const marksBy = (r, uid) => r.steps.map((s, i) => ({ i, e: s.events.find(e => e.k === 'telegraphed' && e.who === uid) })).filter(x => x.e);
  const beamHits = (r, uid, who) => r.steps.map((s, i) => ({ i, e: s.events.find(e => e.k === 'damaged' && e.who === who && e.cause.k === 'special' && e.cause.by === uid) })).filter(x => x.e);
  const struck = (r, uid) => r.events.some(e => e.k === 'attacked' && e.by === uid);
  const sweep = (sc, list) => {
    const res = H.sweep(C, sc, list);
    assert.ok(res.length >= 7, `${sc.name}: ${res.length} runs`);
    assert.deepEqual(H.failures(res), []);
    return res;
  };

  test('the axis_sniper\'s clause, and its line special\'s, are on the Heliographs, at every depth', () => {
    const list = H.species(C, 'axis_sniper'), line = H.species(C, 'line');
    assert.ok(list.length >= 7 && json(list.map(x => x.sp.id + x.depth)) === json(line.map(x => x.sp.id + x.depth)));
    assert.equal(json([C.Registry.ARCHETYPES.axis_sniper.ready, C.Registry.SPECIALS.line.ready]), json(['unit', 'unit']));
    const text = C.Clauses.line(list[0].sp, { depth: 3 });
    assert.ok(text.startsWith('Moves to share your row or column with no reflector between you, then aims along it') && text.includes(`up to ${N.AXIS_BEAM_RANGE} tiles`), text);
  });

  // The beam's timing and damage: marked at its first action, resolved at its next (no
  // earlier than your next decision), what you take is what its mark showed the moment
  // before, and its next action comes an attack plus SPECIAL_RECOVERY after the resolve.
  const shown = new Map();
  test('sharing your row, it aims, then its beam deals what the mark showed, and its next action comes 200 ticks later', () => sweep(H.scenario({
    name: 'a sniper in your row marks the line, then deals max(1, gross − Padding) at its next action', id: 'line', clone: true, seeds: [1, 2],
    build: (params, sp, depth, opts) => room(sp, depth, opts, OPEN, [2, 4], [sniper(sp, depth, [9, 4])]),
    actions(state, i) {
      // What the floor shows at your tile before each step (Specials.marks, as the view model reads it).
      if (i === 0) shown.clear();
      const you = state.actors[0], m = Specials.marks(state).find(k => k.x === you.x && k.y === you.y && k.kind === 'telegraph');
      shown.set(i, m ? m.dmg : null);
      return i < 5 ? { a: 'wait' } : null;
    },
    expect(r, params) {
      const uid = r.start.actors[1].uid, marks = marksBy(r, uid), hits = beamHits(r, uid, 'you');
      if (marks.length < 2 || hits.length < 2) return `${marks.length} marks and ${hits.length} hits in 5 turns`;
      for (const { e } of marks) {
        if (!e.tiles.every(t => t[1] === 4)) return `it marked off its row: ${json(e.tiles)}`;
        if (!e.tiles.some(t => t[0] === 2)) return 'its line did not reach you';
        if (e.cause.gross !== params.gross) return `it marked gross ${e.cause.gross}, not ${params.gross}`;
      }
      for (const { i, e } of hits) {
        const want = Math.max(N.DMG_MIN_ON_HIT, params.gross - e.cause.pad);
        if (e.amount !== want || shown.get(i) !== want) return `step ${i}: it dealt ${e.amount}; the mark showed ${shown.get(i)}; the clause gives ${want}`;
      }
      const [m1, m2] = marks.map(x => x.e.tick), t1 = hits[0].e.tick;
      if (t1 !== m1 + N.COST_ATTACK) return `marked at ${m1}, it resolved at ${t1}`;
      if (m2 !== t1 + N.COST_ATTACK + N.SPECIAL_RECOVERY) return `resolved at ${t1}, its next action was at ${m2}`;
      return struck(r, uid) ? 'it struck' : null;
    },
  })));

  test('its beam passes through glass', () => sweep(H.scenario({
    name: 'a sniper with a case between it and you in your row still marks you, and hits you', id: 'line', clone: true,
    build: (params, sp, depth, opts) => room(sp, depth, opts, ['############', '#..........#', '#..v.......#', '#..........#', '############'], [1, 2], [sniper(sp, depth, [8, 2])]),
    actions: waits(2),
    expect(r) {
      const uid = r.start.actors[1].uid, m = marksBy(r, uid)[0];
      if (!m || m.i !== 0 || !m.e.tiles.some(t => t[0] === 3 && t[1] === 2) || !m.e.tiles.some(t => t[0] === 1)) return `its first mark was ${json(m)}`;
      return beamHits(r, uid, 'you').length === 1 ? null : 'its beam did not reach you through the glass';
    },
  })));

  test('its beam reaches AXIS_BEAM_RANGE tiles along the line, past you, and no farther', () => sweep(H.scenario({
    name: 'a sniper 3 tiles along a long corridor marks AXIS_BEAM_RANGE tiles, the farthest that far off', id: 'line', clone: true,
    build: (params, sp, depth, opts) => { const R = params.AXIS_BEAM_RANGE, map = ['#'.repeat(R + 6), '#' + '.'.repeat(R + 4) + '#', '#'.repeat(R + 6)];
      return room(sp, depth, opts, map, [R, 1], [sniper(sp, depth, [R + 3, 1])]); },
    actions: waits(2),
    expect(r, params) {
      const uid = r.start.actors[1].uid, m = marksBy(r, uid)[0], R = params.AXIS_BEAM_RANGE, x0 = r.start.actors[1].x;
      if (!m || m.i !== 0) return 'it did not aim at once';
      const far = Math.max(...m.e.tiles.map(t => x0 - t[0]));
      if (m.e.tiles.length !== R || far !== R) return `it marked ${m.e.tiles.length} tiles, the farthest ${far} off`;
      return beamHits(r, uid, 'you').length === 1 ? null : 'it did not hit you';
    },
  })));

  test('off your row and column, it moves to share one, never striking, then aims', () => sweep(H.scenario({
    name: 'a sniper off your axes walks onto one before it marks; it never attacks', id: 'axis_sniper', clone: true, seeds: [1, 2, 3],
    build: (params, sp, depth, opts) => room(sp, depth, opts, OPEN, [3, 2], [sniper(sp, depth, [9, 6])]),
    actions: waits(8),
    expect(r) {
      const uid = r.start.actors[1].uid, me = track(r, uid), you = track(r, 'you'), m = marksBy(r, uid);
      if (!m.length) return 'it never aimed';
      const p = me[m[0].i], q = you[m[0].i];
      if (p[0] !== q[0] && p[1] !== q[1]) return `it aimed from ${p}, sharing neither your row nor your column (${q})`;
      for (let i = 0; i < m[0].i; i++) if (me[i + 1][0] === me[i][0] && me[i + 1][1] === me[i][1]) return `step ${i}: off your axes, it did not move`;
      return struck(r, uid) ? 'it struck' : null;
    },
  })));

  test('beside you, it never strikes: it steps onto your row or column and aims', () => sweep(H.scenario({
    name: 'a sniper diagonally beside you never attacks, and aims from beside you', id: 'axis_sniper', clone: true, seeds: [1, 2, 3],
    build: (params, sp, depth, opts) => room(sp, depth, opts, OPEN, [5, 4], [sniper(sp, depth, [6, 5])]),
    actions: waits(6),
    expect(r) {
      const uid = r.start.actors[1].uid;
      if (struck(r, uid)) return 'it struck';
      return marksBy(r, uid).length && beamHits(r, uid, 'you').length ? null : 'it never aimed and fired';
    },
  })));

  test('with a reflector between it and you, it does not aim along that line', () => sweep(H.scenario({
    name: 'a sniper in a corridor with a dish between it and you never marks', id: 'axis_sniper', clone: true,
    build: (params, sp, depth, opts) => room(sp, depth, opts, ['###########', '#.........#', '###########'], [1, 1],
      [sniper(sp, depth, [7, 1]), { sp: 'M11.4', at: [4, 1], mode: 'dormant', stats: Object.assign(Roles.stats('controller', depth), { hp: 999 }) }]),
    actions: waits(4),
    expect(r) {
      const uid = r.start.actors[1].uid;
      if (marksBy(r, uid).length) return 'it aimed into the dish';
      return r.events.some(e => e.k === 'damaged' && e.cause && e.cause.k === 'special') ? 'a beam struck' : null;
    },
  })));

  test('a wall in the way: it does not aim through what blocks sight', () => sweep(H.scenario({
    name: 'a sniper in a corridor with a pillar between it and you never marks', id: 'line', clone: true,
    build: (params, sp, depth, opts) => room(sp, depth, opts, ['###########', '#...o.....#', '###########'], [1, 1], [sniper(sp, depth, [7, 1])]),
    actions: waits(4),
    expect(r) { return marksBy(r, r.start.actors[1].uid).length ? 'it aimed through the pillar' : null; },
  })));

  // A beam stops before what blocks sight, your own tile included (§8.1), so dust over your
  // tile leaves it no line on you from anywhere, though it still sees you (sight is not
  // stopped by what covers its far end): it neither aims nor walks, and never strikes.
  test('with dust over your own tile it has no line on you: it does not aim, and with nowhere to aim from it waits', () => sweep(H.scenario({
    name: 'a sniper in your row, with dust over your tile, neither marks nor moves nor strikes', id: 'axis_sniper', clone: true,
    build: (params, sp, depth, opts) => { const s = room(sp, depth, opts, OPEN, [3, 4], [sniper(sp, depth, [8, 4])]); C.Surfaces.add(s, 'dust', 3, 4, 1, 20, null, []); return s; },
    actions: waits(8),
    expect(r) {
      const a = r.start.actors[1], me = track(r, a.uid);
      if (!C.AI.sees(r.start, a) || C.Grid.clear(r.start.dept, 3, 4)) return 'the scenario needs it to see you, with your tile not clear';
      if (marksBy(r, a.uid).length) return 'it aimed a beam that would stop short of you';
      if (me.some(p => p[0] !== me[0][0] || p[1] !== me[0][1])) return `with no line on you from anywhere it moved: ${json(me)}`;
      return struck(r, a.uid) ? 'it struck' : null;
    },
  })));

  test('Specials.tiles for a line: its row or column only, through glass, stopping at what blocks sight, each tile once', () => {
    const s = Setup.room(1, { acc: 'T0', depth: 3, map: ['##########', '#...v..o.#', '#........#', '#........#', '##########'], you: [1, 1],
      exhibits: [{ sp: 'x', arch: 'axis_sniper', at: [6, 1], mode: 'hunting', stats: Roles.stats('artillery', 3) }] });
    const a = s.actors[1];
    assert.equal(json(Specials.tiles(s, a, 'line')), json([[1, 1], [2, 1], [3, 1], [4, 1], [5, 1]]), 'west to the wall, through the case, never east past the pillar');
    s.actors[0].x = 6; s.actors[0].y = 3;
    assert.equal(json(Specials.tiles(s, a, 'line')), json([[6, 2], [6, 3]]), 'south down its column');
    s.actors[0].x = 3; s.actors[0].y = 3;
    assert.equal(json(Specials.tiles(s, a, 'line')), '[]', 'no line on a diagonal');
  });
};
