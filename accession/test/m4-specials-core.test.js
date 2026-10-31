// M4 W0d2: specials of several shapes, taking turns, and lines that fall due at a turn
// boundary (BUILD.md §8.1; M4 plan A8, W0d2, D1.9, D7.3). Shown here, with planted exhibits,
// a planted shape and a planted chime standing in for the packages that fill them:
//   - a Centrepiece's gross (`cp:` curves), against an oracle written out here;
//   - Specials.addShape: what it refuses, and a planted shape's tiles, damage sides,
//     reflectors and glass carried into the mark and the strike;
//   - the burst (cp_burst's shape), and cp_burst's mark equal to its damage at depths 1–7,
//     joined up with every invariant on and a clone checked after every step;
//   - two specials taking turns, at CP_SPECIAL_EVERY's cadence by phase, and what the turns
//     do when a special is held back, lost or begun again by a new waking;
//   - a mark while awake for an exhibit whose archetype says so (marksAwake), and only then;
//   - a due line: it goes off at its boundary, never at its owner's action; it is shown, and
//     warned of before every decision that could let it go off, a 300-tick equip during
//     which it is marked and goes off included ("no unseen special"); its sentence says when;
//   - the threat with the perks' cost (Perks.adjust), module marks (Modules.threat), an
//     owner the action destroys, several marks in order, and Perks.onResolve with atYou.
// The planted chime (PERIOD 4, WARNING 2): at each boundary, after Modules.turn has set off
// the due lines (Specials.resolveDue), at turns ≡ 2 (mod 4) the station marks its row, due 2
// turns later; Modules.threat gives that line before the chime sounds.
'use strict';
module.exports = ({ test, assert, loadCore, root, path }) => {
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const C = loadCore(), N = C.N;
  const json = JSON.stringify;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const TPT = N.TICKS_PER_TURN;
  const OPEN = ['############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '############'];
  const ROW = ['################', '#..............#', '#..............#', '################'];
  const DEPTHS = [1, 2, 3, 4, 5, 6, 7];
  const HP = 999;
  const wait = { a: 'wait' };
  const BODY = { hp: 400, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 };

  // A core with cp_burst: the registry's once ARCH-CP-CORE defines it, else a planted entry
  // with the plan's shape and curve (A8; map-ARCH §3).
  function core() {
    const X = loadCore();
    if (!own(X.Registry.SPECIALS, 'cp_burst'))
      X.Registry.define('SPECIALS', 'cp_burst', { icon: 'special', shape: 'burst', effect: 'damage', curve: 'cp:ROLE_CENTREPIECE_SPECIAL_PCT', range: null, every: null, built: 'M4' });
    return X;
  }
  // A planted archetype; its act, if given, comes first.
  function arch(X, id, hooks, special) {
    X.Registry.define('ARCHETYPES', id, { special: special || null });
    X.Archetypes.add(id, hooks || {});
  }
  function room(X, map, you, exhibits, more) {
    const s = X.Setup.room(1, Object.assign({ acc: 'T0', depth: 1, map, you, exhibits }, more || {}));
    s.actors[0].hp = s.actors[0].maxHp = HP;
    return s;
  }
  const violations = r => r.violations.map(v => v.text || v.message || json(v));
  const ofYou = e => e.k === 'damaged' && e.who === 'you' && e.cause && e.cause.k === 'special';

  // ---- cp: gross ----
  // The oracle: a role curve read at depth d from its anchors 1/4/8, by linear steps rounded
  // down, and pct(hp, p) as floor(hp × p / 100).
  function curve(v, d) {
    if (d <= 1) return v[0];
    if (d <= 4) return v[0] + Math.floor((v[1] - v[0]) * (d - 1) / 3);
    return v[1] + Math.floor((v[2] - v[1]) * (d - 4) / 4);
  }
  test('cp: gross is pct(MEDIAN_MAX_HP, the curve) + MEDIAN_PADDING at each depth: 6, 12 and 18 at depths 1, 4 and 7', () => {
    const X = core(), s = room(X, OPEN, [2, 2], []);
    const got = [], want = [];
    for (const d of DEPTHS) {
      want.push(Math.floor(N.MEDIAN_MAX_HP[d - 1] * curve(N.ROLE_CENTREPIECE_SPECIAL_PCT, d) / 100) + curve(N.MEDIAN_PADDING, d));
      got.push(X.Specials.cpGross('ROLE_CENTREPIECE_SPECIAL_PCT', d));
      s.dept.depth = d;
      assert.equal(X.Specials.info(s, 'cp_burst').gross, got[got.length - 1], `info at depth ${d}`);
    }
    assert.equal(json(got), json(want));
    assert.equal(json([got[0], got[3], got[6]]), json([6, 12, 18]));
    // Another curve gives its own: the key is read, not assumed.
    X.Registry.define('SPECIALS', 'planted_cp', { shape: 'ring', effect: 'damage', curve: 'cp:ROLE_WARDEN_SPECIAL', range: null, every: null });
    s.dept.depth = 4;
    assert.equal(X.Specials.info(s, 'planted_cp').gross, Math.floor(N.MEDIAN_MAX_HP[3] * curve(N.ROLE_WARDEN_SPECIAL, 4) / 100) + curve(N.MEDIAN_PADDING, 4));
    assert.equal(json(Object.keys(X.Specials.info(s, 'planted_cp'))), json(['id', 'shape', 'effect', 'gross', 'every', 'range']), 'info keeps its shape');
    assert.throws(() => X.Specials.cpGross('NO_SUCH_KEY', 2), /names no number/);
  });

  // ---- Shapes added by the rules that use them ----
  test('Specials.addShape: refused twice, for a written shape, without tiles, with a part it does not know, and with parts of the wrong kind', () => {
    const X = core(), S = X.Specials;
    const tiles = () => [];
    for (const [id, def, why] of [['ring', { tiles }, /twice/], ['burst', { tiles }, /twice/], ['Bad Name', { tiles }, /not a shape/], ['planted_a', {}, /needs tiles/],
      ['planted_b', { tiles, reach: 3 }, /no part called reach/], ['planted_c', { tiles, from: 4 }, /not a function/], ['planted_d', { tiles, glass: 'yes' }, /not true or false/]])
      assert.throws(() => S.addShape(id, def), why, id);
    S.addShape('planted_ok', { tiles });
    assert.throws(() => S.addShape('planted_ok', { tiles }), /twice/);
    assert.equal(json(S.shapes()), json(['ring', 'call', 'line', 'burst', 'planted_ok']));
    assert.equal(json(S.SHAPES), json(['ring', 'call', 'line']), 'the written shapes, as before');
    assert.throws(() => S.tiles(room(X, OPEN, [2, 2], []), { x: 1, y: 1 }, 'planted_none'), /no shape/);
  });

  // A planted shape: the tiles two steps from it along each axis, and their damage sides and
  // reflectors as given here, so the mark and the strike can be seen to carry them.
  function crossShape(X, opts) {
    const o = opts || {};
    X.Specials.addShape('planted_cross', Object.assign({
      tiles: (state, a) => [[a.x, a.y + 2], [a.x + 2, a.y], [a.x - 2, a.y], [a.x, a.y - 2]].filter(([x, y]) => X.Grid.inside(state.dept, x, y) && X.Grid.hold(state.dept, x, y)),
      from: (state, a, list) => list.map(([x, y]) => [x - Math.sign(x - a.x), y - Math.sign(y - a.y)]),
    }, o.glass ? { glass: true } : {}, o.via ? { via: o.via } : {}));
    X.Registry.define('SPECIALS', 'planted_cross', { shape: 'planted_cross', effect: 'damage', curve: 'ROLE_ARTILLERY_SPECIAL', range: null, every: null });
  }
  test('an added shape\'s tiles (row-major, each once), damage sides and reflectors go into the mark, and its strike comes from them', () => {
    const X = core(), S = X.Specials;
    crossShape(X, { via: (state, a, list) => list.map(([x]) => (x === a.x + 2 ? 'T0.1.room.2' : null)) });
    arch(X, 'planted_holder', {});
    const s = room(X, OPEN, [5, 3], [{ sp: 'dummy', at: [3, 3], arch: 'planted_holder', mode: 'hunting', stats: BODY }, { sp: 'dummy', at: [9, 1], mode: 'dormant', stats: BODY }]);
    const a = s.actors[1], t = S.tiles(s, a, 'planted_cross');
    assert.equal(json(t), json([[3, 1], [1, 3], [5, 3], [3, 5]]));
    S.mark(s, a, 'planted_cross', t, []);
    assert.equal(json([a.telegraph.from, a.telegraph.via]), json([[[3, 2], [2, 3], [4, 3], [3, 4]], [null, null, 'T0.1.room.2', null]]));
    assert.equal(a.telegraph.offYou, undefined, 'you stand on it');
    // A planted shape that gives a tile outside the map, or the wrong number of sides, is a bug.
    const Y = core();
    Y.Specials.addShape('planted_out', { tiles: (state, b) => [[-1, b.y]] });
    Y.Specials.addShape('planted_sides', { tiles: (state, b) => [[b.x + 1, b.y]], from: () => [] });
    Y.Registry.define('SPECIALS', 'planted_sides', { shape: 'planted_sides', effect: 'damage', curve: null, range: null, every: null });
    arch(Y, 'planted_holder', {});
    const u = room(Y, OPEN, [5, 3], [{ sp: 'dummy', at: [3, 3], arch: 'planted_holder', mode: 'hunting', stats: BODY }]);
    assert.throws(() => Y.Specials.tiles(u, u.actors[1], 'planted_out'), /not a tile in the map/);
    assert.throws(() => Y.Specials.mark(u, u.actors[1], 'planted_sides', [[4, 3]], []), /gave 0 tiles for 1/);
  });

  test('glass: an exhibit in an intact case marks only a shape that passes glass, and only such a shape strikes one in a case', () => {
    for (const glass of [false, true]) {
      const X = core(), S = X.Specials;
      crossShape(X, { glass });
      arch(X, 'planted_holder', {});
      const s = room(X, OPEN, [5, 3], [{ sp: 'dummy', at: [3, 3], arch: 'planted_holder', mode: 'hunting', stats: BODY }, { sp: 'dummy', at: [3, 1], mode: 'dormant', stats: BODY }]);
      const [, a, b] = s.actors, inCase = new Set();
      X.Cases.encased = (state, who) => inCase.has(who.uid);
      inCase.add(a.uid);
      assert.equal(S.canMark(s, a, 'planted_cross', S.tiles(s, a, 'planted_cross')), glass, `encased, glass ${glass}`);
      inCase.delete(a.uid);
      inCase.add(b.uid);
      S.mark(s, a, 'planted_cross', S.tiles(s, a, 'planted_cross'), []);
      const ev = [];
      S.resolveDue(s, ev);
      assert.equal(ev.length, 0, 'not a due line: nothing goes off at a boundary');
      S.resolve(s, a, ev);
      assert.equal(json(ev.find(e => e.k === 'special').hits), json(glass ? ['you', b.uid] : ['you']), `the one in a case, glass ${glass}`);
    }
  });

  // ---- The burst and cp_burst ----
  test('the burst: the 3×3 square on your tile, without walls, an intact case\'s tile or its owner\'s own, and only while its owner sees you', () => {
    const X = core(), S = X.Specials;
    arch(X, 'planted_holder', {});
    const map = ['#########', '#.......#', '#v.....##', '#......##', '#########'];
    // You at (1,1) in a corner, beside a vitrine at (1,2); a 2×2 owner at (2,2)–(3,3).
    const s = room(X, map, [1, 1], [{ sp: 'dummy', at: [2, 2], size: 2, arch: 'planted_holder', mode: 'hunting', stats: BODY }]);
    const a = s.actors[1];
    assert.equal(json(S.tiles(s, a, 'burst')), json([[1, 1], [2, 1]]), 'not the walls, the vitrine nor its own tiles');
    s.actors[0].x = 4; s.actors[0].y = 2;
    assert.equal(json(S.tiles(s, a, 'burst')), json([[3, 1], [4, 1], [5, 1], [4, 2], [5, 2], [4, 3], [5, 3]]), 'beside it: not its own tiles');
    a.mode = 'dormant';
    assert.equal(json(S.tiles(s, a, 'burst')), '[]', 'a sleeper sees nothing');
    a.mode = 'hunting';
    s.actors[0].x = 6; s.actors[0].y = 1;
    assert.equal(json(S.tiles(s, a, 'burst')), json([[5, 1], [6, 1], [7, 1], [5, 2], [6, 2]]), 'in sight, by the walls');
    s.dept.tiles = ['#########', '#...#...#', '#v..#..##', '#...#..##', '#########'];
    assert.equal(json(S.tiles(s, a, 'burst')), '[]', 'behind a wall it does not see you');
  });

  // A planted Centrepiece piece whose specials take turns (Specials.markNext), blows otherwise.
  // log.marks keeps [acts, id] for each mark it made in log.state (not the clone's twin).
  function rotator(X, id, log) {
    arch(X, id, { act(state, a, ev) { const r = X.Specials.markNext(state, a, ev); if (r !== null && log && state === log.state) log.marks.push([a.acts, a.telegraph.sp]); return r; } });
  }
  test('cp_burst on a Centrepiece piece: what it deals you is the mark shown the moment before, at depths 1–7, every invariant on and a clone checked each step', () => {
    const problems = [];
    let resolved = 0;
    for (const depth of DEPTHS) {
      const X = core(), S = X.Specials;
      rotator(X, 'planted_cp');
      const s = room(X, OPEN, [4, 3], [{ sp: 'dummy', at: [5, 3], arch: 'planted_cp', mode: 'hunting', stats: X.Roles.stats('centrepiece', depth), ax: { specials: ['cp_burst'] } }], { depth });
      const gross = S.cpGross('ROLE_CENTREPIECE_SPECIAL_PCT', depth);
      if (S.info(s, 'cp_burst').gross !== gross && X.Registry.SPECIALS.cp_burst.curve === 'cp:ROLE_CENTREPIECE_SPECIAL_PCT') problems.push(`d${depth}: info's gross ${S.info(s, 'cp_burst').gross}, not ${gross}`);
      const shown = [];
      const r = H.play(X, s, (st, i) => { if (i >= 14) return null; shown.push(S.marks(st)); return i % 3 === 2 ? { a: 'move', dir: i % 2 ? 2 : 6 } : wait; }, { inv: 'all', clone: true });
      problems.push(...violations(r).map(v => `d${depth}: ${v}`));
      let here = 0;
      r.steps.forEach((step, i) => {
        for (const e of step.events.filter(ofYou)) {
          if (e.cause.sp !== 'cp_burst') continue;
          const m = shown[i].find(k => k.by === e.cause.by && k.x === e.cause.x && k.y === e.cause.y);
          if (!m) problems.push(`d${depth} step ${i}: cp_burst struck you at ${e.cause.x},${e.cause.y}, unshown`);
          else if (m.dmg !== e.amount || e.amount !== S.net(gross, e.cause.pad)) problems.push(`d${depth} step ${i}: shown ${m.dmg}, dealt ${e.amount}, gross ${gross}`);
          here++;
        }
      });
      if (here < 2) problems.push(`d${depth}: cp_burst struck you ${here} times in 14 steps, too few to show anything`);
      resolved += here;
    }
    assert.deepEqual(problems, []);
    assert.ok(resolved >= 14);
  });

  // ---- Several specials, taking turns ----
  test('two specials take turns in the order gained, one every CP_SPECIAL_EVERY actions: its first value in phases 1–2, its second from phase 3', () => {
    for (const [phase, every] of [[1, N.CP_SPECIAL_EVERY[0]], [2, N.CP_SPECIAL_EVERY[0]], [3, N.CP_SPECIAL_EVERY[1]]]) {
      const X = core(), log = { marks: [] }, marks = log.marks;
      rotator(X, 'planted_two', log);
      const s = room(X, OPEN, [4, 3], [{ sp: 'dummy', at: [5, 3], arch: 'planted_two', mode: 'hunting', stats: X.Roles.stats('centrepiece', 3), ax: { specials: ['ring', 'cp_burst'], phase } }], { depth: 3 });
      log.state = s;
      const r = H.play(X, s, (st, i) => (i < 16 ? wait : null), { inv: 'all', clone: true });
      assert.deepEqual(violations(r), [], `phase ${phase}`);
      const want = [];
      for (let k = 1; k <= marks.length; k++) want.push([k * every, k % 2 ? 'ring' : 'cp_burst']);
      assert.ok(marks.length >= 4, `phase ${phase}: only ${marks.length} marks`);
      assert.equal(json(marks), json(want), `phase ${phase}: [its count of actions, the special] at each mark`);
      const tel = r.events.filter(e => e.k === 'telegraphed').map(e => e.sp);
      assert.equal(json(tel), json(want.map(w => w[1])));
      // Its readout: a line for each, each at most one action in every × 2.
      assert.equal(json(X.Specials.readout(s, s.actors[1], s.actors[0]).map(l => [l.sp, l.every])), json([['ring', every * 2], ['cp_burst', every * 2]]));
    }
  });

  test('the turns: a special held back is tried again next action; one lost starts the turns again from the first; a new waking counts again from it', () => {
    const X = core(), S = X.Specials;
    arch(X, 'planted_holder', {});
    const s = room(X, OPEN, [4, 3], [{ sp: 'dummy', at: [5, 3], arch: 'planted_holder', mode: 'hunting', stats: BODY, ax: { specials: ['ring', 'cp_burst', 'line'] } },
      { sp: 'dummy', at: [3, 3], arch: 'planted_holder', mode: 'hunting', stats: BODY }]);
    const [you, a, b] = s.actors, every = S.cadence(s, a);
    assert.equal(json([S.list(s, a), S.list(s, b), S.list(s, you)]), json([['ring', 'cp_burst', 'line'], [], []]));
    a.acts = every - 1;
    assert.equal(S.nextUp(s, a), null, 'not yet');
    a.acts = every;
    assert.equal(S.nextUp(s, a), 'ring');
    // Held back: b's pending ring covers your tile, which a's ring would mark too.
    S.mark(s, b, 'ring', S.tiles(s, b, 'ring'), []);
    assert.equal(S.markNext(s, a, []), null);
    assert.equal(json([a.telegraph, a.ax.rot, S.nextUp(s, a)]), json([null, undefined, 'ring']), 'nothing marked, the same one still due');
    b.telegraph = null;
    a.acts = every + 1;
    assert.ok(S.markNext(s, a, []) > 0);
    assert.equal(json(a.ax.rot), json({ last: 'ring', at: every + 1, woke: a.woke.turn }));
    a.telegraph = null;
    a.acts = 2 * every;
    assert.equal(S.nextUp(s, a), null, 'counted from the mark');
    a.acts = 2 * every + 1;
    assert.equal(S.nextUp(s, a), 'cp_burst');
    // It loses the one it marked last: it starts again from the first.
    a.ax.specials = ['cp_burst', 'line'];
    assert.equal(S.nextUp(s, a), 'cp_burst');
    a.ax.rot.last = 'line';
    assert.equal(S.nextUp(s, a), 'cp_burst', 'after the last, back to the first');
    // A new waking: its count of actions starts again, and so does the wait for its first.
    a.woke = { turn: s.turn + 5, cause: { k: 'damage' } };
    a.acts = 1;
    assert.equal(S.nextUp(s, a), null);
    a.acts = every;
    assert.equal(S.nextUp(s, a), 'cp_burst');
    a.ax.phase = 3;
    assert.equal(S.cadence(s, a), N.CP_SPECIAL_EVERY[1]);
  });

  // ---- Marking while awake ----
  test('only a hunting exhibit marks, or an awake one whose archetype marks while awake (marksAwake); never a sleeping one', () => {
    const X = core(), S = X.Specials;
    arch(X, 'planted_station', { marksAwake: () => true });
    arch(X, 'planted_holder', {});
    const s = room(X, OPEN, [4, 3], [{ sp: 'dummy', at: [5, 3], arch: 'planted_station', mode: 'awake', stats: BODY }, { sp: 'dummy', at: [3, 3], arch: 'planted_holder', mode: 'awake', stats: BODY }]);
    const [, st, plain] = s.actors, can = a => S.canMark(s, a, 'ring', S.tiles(s, a, 'ring'));
    assert.equal(json([can(st), can(plain), S.marking(s, st), S.marking(s, plain)]), json([true, false, true, false]));
    plain.mode = 'hunting';
    st.mode = 'dormant';
    assert.equal(json([can(st), can(plain)]), json([false, true]));
    st.mode = 'searching';
    assert.equal(can(st), false, 'awake means the mode awake');
  });

  // ---- Due lines ----
  // The planted station: it marks a beam east along its row (a planted shape through
  // Ranged.beam, so it passes glass and turns at a reflector), never moves, and marks while
  // awake. The planted chime (above) marks it and sets it off; its forecast is Modules.threat.
  const PERIOD = 4, WARNING = 2;
  function chime(X, opts) {
    const o = opts || {}, S = X.Specials, R = 14;
    S.addShape('planted_row', {
      tiles: (state, a) => X.Ranged.beam(state, a, 2, R), from: (state, a) => X.Ranged.beamFrom(state, a, 2, R), via: (state, a) => X.Ranged.beamVia(state, a, 2, R), glass: true,
    });
    X.Registry.define('SPECIALS', 'planted_due', { shape: 'planted_row', effect: 'damage', curve: 'ROLE_ARTILLERY_SPECIAL', range: null, every: null });
    arch(X, 'planted_station', Object.assign({ act: (state, a, ev) => X.AI.wait(state, a, ev) }, o.awake === false ? {} : { marksAwake: () => true }));
    const stations = state => state.actors.filter(a => a.arch === 'planted_station' && !a.gone);
    const turn = X.Modules.turn;
    X.Modules.turn = (state, ev) => {
      turn(state, ev);
      if ((state.turn + WARNING) % PERIOD) return;
      for (const st of stations(state)) {
        const t = S.tiles(state, st, 'planted_row');
        if (S.canMark(state, st, 'planted_due', t)) S.mark(state, st, 'planted_due', t, ev, { due: (state.turn + WARNING) * TPT });
      }
    };
    // Its lines due before `until`: those marked, and those of the chimes not yet sounded.
    X.Modules.threat = (state, until) => {
      const out = [];
      if (o.silent) return out;
      for (const st of stations(state)) {
        const t = st.telegraph;
        if (t && Number.isInteger(t.due) && t.due < until) out.push({ by: st.uid, sp: t.sp, tiles: t.tiles, gross: t.gross, due: t.due });
        for (let T = state.turn + 1; (T + WARNING) * TPT < until; T++)
          if ((T + WARNING) % PERIOD === 0) out.push({ by: st.uid, sp: 'planted_due', tiles: S.tiles(state, st, 'planted_row'), gross: S.info(state, 'planted_due').gross, due: (T + WARNING) * TPT });
      }
      return out;
    };
  }
  const GARMENT = { uid: 'g2', kind: 'garment', form: 'standard', tier: 3, where: { at: 'tote' } };
  // The station at the west end of a long row, out of sight of you at its east end.
  function rowRoom(X, depth, more) {
    return room(X, ROW, [12, 1], [{ sp: 'dummy', at: [1, 1], arch: 'planted_station', mode: 'awake', stats: BODY, next: 100 }], Object.assign({ depth, items: [GARMENT] }, more || {}));
  }

  test('a due line goes off at its boundary, not at its owner\'s action, and is shown, and warned of, before every decision that could let it go off', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const X = core(), S = X.Specials;
      chime(X);
      const s = rowRoom(X, depth), st = s.actors[1], gross = S.info(s, 'planted_due').gross;
      const seen = [];
      const r = H.play(X, s, (state, i) => {
        if (i >= 12) return null;
        seen.push({ tick: state.tick, threat: S.threat(state, wait), shown: S.marks(state).filter(k => k.x === 12 && k.y === 1) });
        return wait;
      }, { inv: 'all', clone: true });
      problems.push(...violations(r).map(v => `d${depth}: ${v}`));
      const dmg = S.net(gross, s.actors[0].pad), hit = { x: 12, y: 1, dmg, by: st.uid, sp: 'planted_due' };
      // Chimes at turns 2, 6 and 10 mark lines due at 400, 800 and 1200; you decide at 0, 100, …
      const want = seen.map(d => {
        const due = [400, 800, 1200].find(t => t > d.tick && t <= d.tick + TPT);
        return due ? Object.assign({}, hit, { due }) : null;
      });
      if (json(seen.map(d => d.threat)) !== json(want)) problems.push(`d${depth}: the threats of a wait were ${json(seen.map(d => d.threat))}`);
      const shownAt = seen.filter(d => d.shown.length).map(d => [d.tick, d.shown[0].dmg, d.shown[0].due]);
      if (json(shownAt) !== json([[200, dmg, 400], [300, dmg, 400], [600, dmg, 800], [700, dmg, 800], [1000, dmg, 1200], [1100, dmg, 1200]])) problems.push(`d${depth}: shown ${json(shownAt)}`);
      const marked = r.events.filter(e => e.k === 'telegraphed').map(e => [e.tick, e.cause.due]);
      const struck = r.events.filter(ofYou).map(e => [e.tick, e.amount]);
      const fired = r.events.filter(e => e.k === 'special' && e.who === st.uid).map(e => e.tick);
      if (json(marked) !== json([[200, 400], [600, 800], [1000, 1200]])) problems.push(`d${depth}: marked ${json(marked)}`);
      if (json(struck) !== json([[400, dmg], [800, dmg], [1200, dmg]])) problems.push(`d${depth}: struck ${json(struck)}`);
      if (json(fired) !== json([400, 800, 1200])) problems.push(`d${depth}: went off at ${json(fired)}`);
      if (st.next < 1200 || st.mode !== 'awake') problems.push(`d${depth}: the station did not keep acting, awake (next ${st.next}, ${st.mode})`);
      // Its sentence says when it goes off, not "at its next action".
      const said = X.Text.event(r.events.find(e => e.k === 'telegraphed'), X.Labels.nameOf(s));
      if (!/before your Padding, in 2 turns\.$/.test(said)) problems.push(`d${depth}: the mark reads ${json(said)}`);
    }
    assert.deepEqual(problems, []);
  });

  test('no unseen special: a 300-tick equip begun before the chime is warned of the line it will mark and set off before your next decision, through the Padding you had', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const X = core(), S = X.Specials;
      chime(X);
      const s = rowRoom(X, depth), [you, st] = s.actors;
      s.tick = 150; s.turn = 1; you.next = 150; st.next = 200;
      const pad = you.pad, dmg = S.net(S.info(s, 'planted_due').gross, pad), equip = { a: 'equip', uid: 'g2' };
      const before = X.State.hash(s), threat = S.threat(s, equip);
      if (json(threat) !== json({ x: 12, y: 1, dmg, by: st.uid, sp: 'planted_due', due: 400 })) problems.push(`d${depth}: the equip's threat is ${json(threat)}`);
      if (S.threat(s, wait) !== null) problems.push(`d${depth}: a wait (to 250) is warned of a line due at 400`);
      if (X.State.hash(s) !== before) problems.push(`d${depth}: the threat changed the state`);
      if (S.marks(s).length) problems.push(`d${depth}: a mark is shown before the chime`);
      const r = H.play(X, s, [equip], { inv: 'all', clone: true });
      problems.push(...violations(r).map(v => `d${depth}: ${v}`));
      const ev = r.steps[0].events, tel = ev.find(e => e.k === 'telegraphed'), hit = ev.find(ofYou);
      // The line held nothing of its owner's: it acted at 200, 300 and 400, waiting, as before.
      if (st.next !== 500 || st.notBefore !== null) problems.push(`d${depth}: the station's next action is at ${st.next} (notBefore ${st.notBefore}), not 500`);
      if (!tel || tel.tick !== 200 || tel.cause.due !== 400) problems.push(`d${depth}: marked ${json(tel)}`);
      if (!hit || hit.tick !== 400 || hit.amount !== dmg || hit.cause.pad !== pad) problems.push(`d${depth}: struck ${json(hit)}, warned ${dmg} through Padding ${pad}`);
      if (you.pad === pad) problems.push(`d${depth}: the garment did not change your Padding, so this shows nothing`);
      // Begun after the chime, with the line shown and pending: warned of by its mark, once.
      const u = rowRoom(X, depth), [, su] = u.actors;
      H.play(X, u, [wait, wait], { inv: 'all' });
      u.actors[0].next = 250; u.tick = 250; su.next = 300;
      const t2 = S.threat(u, equip);
      if (json(t2) !== json({ x: 12, y: 1, dmg: S.net(su.telegraph.gross, u.actors[0].pad), by: su.uid, sp: 'planted_due', due: 400 })) problems.push(`d${depth}: begun after the chime: ${json(t2)}`);
    }
    assert.deepEqual(problems, []);
  });

  test('the invariant holds the rule: a due line that struck you unwarned is a violation, as is one an awake exhibit could not have marked', () => {
    // A chime whose module forgets to warn: the line still goes off during the equip.
    const X = core(), S = X.Specials;
    chime(X, { silent: true });
    const s = rowRoom(X, 3), [you, st] = s.actors;
    s.tick = 150; s.turn = 1; you.next = 150; st.next = 200;
    assert.equal(S.threat(s, { a: 'equip', uid: 'g2' }), null);
    const r = H.play(X, s, [{ a: 'equip', uid: 'g2' }], { inv: ['combat_special_shown'] });
    assert.equal(r.violations.length, 1);
    assert.match(r.violations[0].text, /a line due at 400, struck you at 12,1, and the threat of your action did not warn of it/);
    // Without marksAwake the awake station marks nothing, and nothing goes off.
    const Y = core();
    chime(Y, { awake: false });
    const u = rowRoom(Y, 3);
    const q = H.play(Y, u, Array(6).fill(wait), { inv: 'all' });
    assert.equal(json([q.events.filter(e => e.k === 'telegraphed').length, q.events.filter(ofYou).length, q.violations.length]), json([0, 0, 0]));
  });

  test('a due line\'s owner waits until its boundary, and resolveDue sets off only lines whose tick has come; a due tick must be a boundary to come', () => {
    const X = core(), S = X.Specials;
    chime(X);
    const s = rowRoom(X, 2), [you, st] = s.actors;
    const r = H.play(X, s, [wait, wait, wait], { inv: 'all', clone: true });
    assert.deepEqual(violations(r), []);
    assert.equal(json([st.telegraph && st.telegraph.due, s.tick]), json([400, 300]));
    const ev = [];
    assert.equal(json(S.resolveDue(s, ev)), '[]', 'not yet due');
    assert.equal(ev.length, 0);
    assert.equal(S.resolve(s, st, ev), N.COST_WAIT, 'its own action waits');
    assert.equal(json([ev.length, st.telegraph.due]), json([0, 400]));
    assert.throws(() => S.mark(s, you, 'planted_due', [[2, 1]], [], { due: 450 }), /may not mark|not a turn boundary/);
    st.telegraph = null;
    assert.throws(() => S.mark(s, st, 'planted_due', S.tiles(s, st, 'planted_row'), [], { due: 450 }), /not a turn boundary/);
    assert.throws(() => S.mark(s, st, 'planted_due', S.tiles(s, st, 'planted_row'), [], { due: s.tick }), /not a turn boundary/);
  });

  // ---- The threat ----
  // A planted ringer: an exhibit whose ring is marked on demand.
  function ringRoom(X, more) {
    arch(X, 'planted_ringer', {}, 'ring');
    const s = room(X, OPEN, [4, 2], [{ sp: 'dummy', at: [5, 2], arch: 'planted_ringer', mode: 'hunting', stats: X.Roles.stats('warden', 2) }], Object.assign({ depth: 2 }, more || {}));
    s.actors[0].hp = s.actors[0].maxHp = HP;
    return s;
  }
  test('the threat counts your action\'s cost as the perks make it (Perks.adjust, on its copy): a step made free has none, a discounted one decides sooner', () => {
    const X = core(), S = X.Specials, s = ringRoom(X), [you, w] = s.actors;
    S.mark(s, w, 'ring', S.tiles(s, w, 'ring'), []);
    s.tick = 100; you.next = 100; w.next = 160;
    const dmg = S.net(S.info(s, 'ring').gross, you.pad), on = { x: 4, y: 2, dmg, by: w.uid };
    assert.equal(json(S.threat(s, wait)), json(on), 'a wait: your next decision at 200');
    const asked = [];
    let to = 50;
    X.Perks.adjust = (state, action, r, ev) => { asked.push([state === s, action.a, r]); return action.a === 'wait' ? { r: to, why: 'planted' } : { r, why: null }; };
    const h = X.State.hash(s);
    assert.equal(S.threat(s, wait), null, 'discounted to 50: your decision at 150 comes first');
    to = 0;
    assert.equal(S.threat(s, wait), null, 'made free: nothing goes off before your next decision');
    to = 100;
    assert.equal(json(S.threat(s, wait)), json(on));
    assert.equal(X.State.hash(s), h, 'nothing changed');
    assert.equal(json(asked), json([[false, 'wait', 100], [false, 'wait', 100], [false, 'wait', 100]]), 'asked of a copy, with the action\'s own cost');
  });

  test('the threat\'s order: what goes off first, then the rest (more); a boundary before an exhibit at the same tick; a module line for an owner the action destroys still counts', () => {
    const X = core(), S = X.Specials;
    chime(X);
    arch(X, 'planted_ringer', {}, 'ring');
    // You at (12,1) on the station's row, a ringer beside you at (12,2), first in spawn order,
    // so that at a tie only the boundary's coming first puts the line first.
    const s = rowRoom(X, 2, { exhibits: [{ sp: 'dummy', at: [12, 2], arch: 'planted_ringer', mode: 'hunting', stats: X.Roles.stats('warden', 2), next: 300 },
      { sp: 'dummy', at: [1, 1], arch: 'planted_station', mode: 'awake', stats: BODY, next: 200 }] });
    const [you, w, st] = s.actors;
    s.tick = 150; s.turn = 1; you.next = 150;
    S.mark(s, w, 'ring', S.tiles(s, w, 'ring'), []);
    w.next = 300;
    const ring = { x: 12, y: 1, dmg: S.net(S.info(s, 'ring').gross, you.pad), by: w.uid };
    const line = { x: 12, y: 1, dmg: S.net(S.info(s, 'planted_due').gross, you.pad), by: st.uid, sp: 'planted_due', due: 400 };
    const equip = { a: 'equip', uid: 'g2' };
    assert.equal(json(S.threat(s, equip)), json(Object.assign({}, ring, { more: [line] })), 'the ring at 300, then the line at 400');
    w.next = 400;
    assert.equal(json(S.threat(s, equip)), json(Object.assign({}, line, { more: [ring] })), 'at 400 the boundary goes first');
    w.next = 500;
    assert.equal(json(S.threat(s, equip)), json(line), 'the ring after your decision at 450');
    // An action that destroys the station (planted in use's place: 300 ticks): its line still
    // counts, as the same action leaving it standing gives.
    X.Actions.get('use').apply = (state, action) => { if (action.uid === 'smite') state.actors[2].gone = 1; return 300; };
    assert.equal(json([S.threat(s, { a: 'use', uid: 'smite' }), S.threat(s, { a: 'use', uid: 'spare' })]), json([line, line]));
    // A module mark that is not plain data as a telegraph is, is a bug.
    X.Modules.threat = () => [{ by: st.uid, tiles: [[12, 1]], gross: 5, due: 400 }];
    assert.throws(() => S.threat(s, equip), /not \{by, sp, tiles, gross, due\}/);
  });

  test('a mark notes whether it covered you (atYou: offYou kept only when not), and the perks hear of each resolve with it (Perks.onResolve)', () => {
    const X = core(), S = X.Specials, heard = [];
    X.Perks.onResolve = (state, a, tel, struckYou, ev) => heard.push([a.uid, tel.sp, tel.atYou, struckYou, 'offYou' in tel ? tel.offYou : null]);
    const s = ringRoom(X), [you, w] = s.actors;
    // Marked on you; you step off: a dodge.
    S.mark(s, w, 'ring', S.tiles(s, w, 'ring'), []);
    assert.equal(json(['offYou' in w.telegraph, S.atYou(w.telegraph)]), json([false, true]));
    you.x = 2;
    S.resolve(s, w, []);
    // Marked off you; you step on: struck, but not a mark that covered you.
    S.mark(s, w, 'ring', S.tiles(s, w, 'ring'), []);
    assert.equal(json([w.telegraph.offYou, S.atYou(w.telegraph)]), json([true, false]));
    you.x = 4;
    S.resolve(s, w, []);
    // A call is never at you, and stores nothing.
    arch(X, 'planted_caller', {}, 'call');
    const u = room(X, OPEN, [4, 2], [{ sp: 'dummy', at: [8, 4], arch: 'planted_caller', mode: 'hunting', stats: BODY }]), c = u.actors[1];
    S.mark(u, c, 'call', S.tiles(u, c, 'call'), []);
    assert.equal(json(['offYou' in c.telegraph, S.atYou(c.telegraph)]), json([false, false]));
    S.resolve(u, c, []);
    assert.equal(json(heard), json([[w.uid, 'ring', true, false, null], [w.uid, 'ring', false, true, true], [c.uid, 'call', false, false, null]]));
  });
};
