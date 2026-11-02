// ACCESSION — the mp_tableau archetype's hooks (M.11's Centrepiece, the Great Board of the Central
// Station; BUILD.md §5.1, §5.3, §5.5, §8.1; rules/archetypes.js), added with the hooks every
// Centrepiece shares (Centrepiece.hooks: its specials in turn, its phases, its fall). Its
// registry entry is in js/core/reg/cp-tableau.js, its sentences in js/core/text/cp-tableau.js
// and its record in content/M11-cp.js. Owned by TABLEAU-CORE (its body); TABLEAU-PHASES added
// its attachments (the Repeater Arm, the Board Dish), which bring the hall's rain case into play.
//
// The rule, as its line says it (design/samples.md §2.8, trimmed; decided without play; revisit
// once M4 is playable):
//   - It never moves (neverSteps, so mayStep is false: no rule moves it, and the Window Pole
//     moves only a one-tile exhibit). It hunts as any exhibit does, and strikes from beside you
//     with the role's blow; every change of its mode takes place where it stands, as the log
//     tells it (Wake.stands, how: 'stands').
//   - Its specials take turns (Centrepiece.act, Specials.markNext: one every CP_SPECIAL_EVERY of
//     its actions, each waiting until it can be marked), in the order it has them: from the
//     start its beam (cp_line), then its burst (cp_burst, reg/centrepiece.js); from phase 2 its
//     summons too (the record's phases[1].specials, which Centrepiece.advance gives it).
//   - Its beam (the shape cp_line): while it sees you (AI.sees) and you stand in one of its
//     rows or columns (a row or a column of its footprint), outside it, it marks the line from
//     its footprint's tile in that row or column toward you, up to AXIS_BEAM_RANGE tiles: a
//     §8.1 beam (Ranged.beam), through glass, stopping before what blocks sight, turned back by
//     a reflector along itself, the way back counting toward its range (and reaching it, as a
//     sniper's own beam sent back reaches the sniper). Its gross is the Centrepiece's (cp:).
//   - Its summons (the special summon, the shape summon): with CP_SUMMON[0] or more free tiles
//     of its room (its hall) beside it, it marks up to CP_SUMMON[1] of them, those nearest
//     where it last knew you were (a.lastKnown, else your tile; Chebyshev, ties in row-major
//     order). At its next action (Specials' resolve, a hook: onResolve) a body of the species
//     its record names (`summons`: M.11's Logbook Trolley) comes onto each marked tile still
//     free, in row-major order: <its uid>/<k>, k its count of bodies made (kids, §3.2), with
//     that species' numbers at the depth, hunting you, its story the creation cause summoned
//     {how: 'summon', from: it, parent: its own woke} (Wake.created: it first acts one action
//     after it comes). One that options.without names is made and at once marked gone, with no
//     event. A free tile: one an exhibit can step onto (no staff door), not a closed door, with
//     no one on it, in its own room (so never an opening of the hall, which is in no room).
//   - While its summons is marked (its pending telegraph), it takes CP_SUMMON_DMG_PCT% of all
//     the damage dealt to it (adjustDamage, which the odds readout and the Attack button count:
//     Combat.netRolls), and its odds readout says so (readout: taken).
//   - A body it summons is no piece of it (dept.cp.uids is its own body alone): the body's
//     blows, and its standing beside you, neither restart a sealed hall's quiet count nor keep
//     the hall sealed (Hall.onHurt and Hall.boundary count its pieces only; BUILD §8.4), and its
//     fall is no part of the Board's.
//   - Its attachments (TABLEAU-PHASES; the record's `attachments`, below): set out as it is
//     placed (its init), exhibits of their own and no pieces of it. The Repeater Arm, a station
//     (M11.2's archetype, modifier, trigger and flags, so its line), stands beside the hall's
//     case, within its weather (the hall's case holds rain: weather_cases), its line never
//     across the Board; the Board Dish, a reflector, stands apart until the Board's second
//     phase wakes it (onPhase), then, hunting, keeps in front of the Board (MODIFIERS.
//     tab_screen, a modifier registered here).
// The beam, the summons and the attachments' placing draw nothing.
//
// Tableau, for the module that forecasts the chime's lines, the view and the tests:
//   Tableau.line(state, a) → [[x, y]…]      the tiles its beam would take if marked now, in the
//                                            order it crosses them ([] when it would mark none)
//   Tableau.callTiles(state, a) → [[x, y]…] the tiles its summons would mark now
//   Tableau.calls(state, a) → species | null  the species a's summons calls (its record's)
//   Tableau.summoning(a) → bool              is a's summons marked (it takes more damage)
//   Tableau.callsReflector(state) → bool     has an exhibit present, or will one gain with its
//                                            Centrepiece's phases, a summons that calls a body
//                                            that reflects (HourlyDemonstration.reach widens
//                                            for it: such a body comes with no step)
//   Tableau.attachments(state) → [actor]     the Board's attachments set out in this visit, in
//                                            spawn order, fallen ones included
//   Tableau.front(state, a, b) → [x, y] | null  the tile the Board Dish a keeps to in front of
//                                            the Board b (tab_screen)
'use strict';
const Tableau = (() => {
  const ID = 'mp_tableau', LINE = 'cp_line', SUMMON = 'summon';
  const key = (x, y) => `${x},${y}`;

  // ---- Its beam ----
  // Where its beam starts and which way it goes (Grid's direction: N 0, E 2, S 4, W 6): you
  // stand in one of its rows or one of its columns, outside it, and it sees you; its beam starts
  // on its footprint's tile in that row or column nearest you. null otherwise.
  function aim(state, a) {
    const you = state.actors[0], s = a.size || 1;
    if (!AI.sees(state, a)) return null;
    const row = you.y >= a.y && you.y < a.y + s, col = you.x >= a.x && you.x < a.x + s;
    if (row === col) return null;
    if (row) return you.x > a.x ? { x: a.x + s - 1, y: you.y, d: 2 } : { x: a.x, y: you.y, d: 6 };
    return you.y > a.y ? { x: you.x, y: a.y + s - 1, d: 4 } : { x: you.x, y: a.y, d: 0 };
  }
  // Its beam's tiles, each with the tile it came from and the reflector that turned it (Ranged).
  function trace(state, a) {
    const t = aim(state, a);
    if (!t) return { tiles: [], from: [], via: [] };
    const o = { x: t.x, y: t.y }, R = N.AXIS_BEAM_RANGE;
    return { tiles: Ranged.beam(state, o, t.d, R), from: Ranged.beamFrom(state, o, t.d, R), via: Ranged.beamVia(state, o, t.d, R) };
  }
  const line = (state, a) => trace(state, a).tiles.map(t => t.slice());
  Specials.addShape(LINE, {
    tiles: (state, a) => line(state, a),
    from(state, a, list) { const t = trace(state, a), at = new Map(t.tiles.map((p, i) => [key(p[0], p[1]), t.from[i]])); return list.map(p => at.get(key(p[0], p[1])).slice()); },
    via(state, a, list) { const t = trace(state, a), at = new Map(t.tiles.map((p, i) => [key(p[0], p[1]), t.via[i]])); return list.map(p => at.get(key(p[0], p[1]))); },
    glass: true,
  });

  // ---- Its summons ----
  // A tile a body may come onto: inside the map, one an exhibit can step onto, not a closed
  // door, with no one on it, in a's own room (a map with no rooms, a test's, has no rooms to
  // keep to).
  function free(state, a, x, y) {
    const m = state.dept, rooms = Array.isArray(m.roomOf) && m.roomOf.length ? m.roomOf : null;
    if (!Grid.inside(m, x, y) || !Grid.walkable(m, x, y, 'exhibit') || Grid.closedDoor(m, x, y) || Actors.at(state, x, y)) return false;
    return !rooms || rooms[y][x] === rooms[a.y][a.x];
  }
  // The free tiles beside a's footprint, nearest where it last knew you were (ties in row-major
  // order), up to CP_SUMMON[1] of them; none with fewer than CP_SUMMON[0] free.
  function callTiles(state, a) {
    const you = state.actors[0], at = Array.isArray(a.lastKnown) ? a.lastKnown : [you.x, you.y], s = a.size || 1, list = [];
    for (let y = a.y - 1; y <= a.y + s; y++) for (let x = a.x - 1; x <= a.x + s; x++) if (Actors.dist(a, x, y) === 1 && free(state, a, x, y)) list.push([x, y]);
    if (list.length < N.CP_SUMMON[0]) return [];
    const far = p => Grid.chebyshev(p[0], p[1], at[0], at[1]);
    return list.sort((p, q) => far(p) - far(q) || p[1] - q[1] || p[0] - q[0]).slice(0, N.CP_SUMMON[1]);
  }
  Specials.addShape(SUMMON, { tiles: (state, a) => callTiles(state, a) });

  // The species a's summons calls: its record's `summons` (Packs.speciesFor reads a's record),
  // a species of the packs, never a Centrepiece; null if it names none.
  function calls(state, a) {
    const rec = Packs.speciesFor(state, a);
    if (!rec || typeof rec.summons !== 'string') return null;
    const sp = Packs.speciesFor(state, { sp: rec.summons });
    return sp && sp.id === rec.summons && typeof sp.form !== 'string' ? sp : null;
  }
  // Its summons goes off: a body onto each marked tile still free, in row-major order.
  function onResolve(state, a, tel, ev) {
    if (!tel || tel.sp !== SUMMON) return;
    const sp = calls(state, a);
    if (!sp) throw new Error(`Tableau: ${a.uid}'s summons calls no species (its record names none in summons)`);
    const stats = Roles.stats(sp.role, state.dept.depth);
    // The bodies it calls (one made and at once gone counted too): none only when every marked
    // tile was taken; the special event says so (Specials' fire reads it from the mark).
    tel.called = 0;
    for (const [x, y] of tel.tiles) {
      if (!free(state, a, x, y)) continue;
      a.kids += 1;
      tel.called += 1;
      const b = Actors.spawn(state, Object.assign({}, stats, {
        uid: `${a.uid}/${a.kids}`, sp: sp.id, size: 1, x, y, maxHp: stats.hp, mode: 'hunting',
        arch: sp.archetype || 'plodder', role: sp.role, mods: (sp.modifiers || []).slice(), modParams: sp.modParams || {}, trigger: sp.trigger || null, group: sp.group || null,
      }));
      if ((state.options.without || []).includes(b.uid)) { b.gone = 1; continue; }
      const extra = { how: 'summon', from: a.uid };
      if (a.woke) extra.parent = a.woke;
      Wake.created(state, b, 'summoned', extra, ev);
    }
  }

  // ---- Its body ----
  const summoning = a => !!a && !a.gone && !!a.telegraph && a.telegraph.sp === SUMMON;
  const adjustDamage = (state, def, amount) => summoning(def) ? Int.pct(amount, N.CP_SUMMON_DMG_PCT) : amount;
  const readout = (state, a) => summoning(a) ? [{ k: 'taken', pct: N.CP_SUMMON_DMG_PCT, sp: SUMMON }] : [];
  const neverSteps = () => true;

  // Does any exhibit present have a summons now, or will a piece of its Centrepiece gain one
  // with a phase (dept.cp.gains), whose body reflects (Ranged.isReflector: a reflector, or a
  // body with the glass modifier while it is on)?
  function callsReflector(state) {
    const cp = Hall.cp(state), later = !!cp && Array.isArray(cp.gains) && cp.gains.includes(SUMMON);
    for (let i = 1; i < state.actors.length; i++) {
      const a = state.actors[i];
      if (a.gone) continue;
      const has = (a.ax && Array.isArray(a.ax.specials) && a.ax.specials.includes(SUMMON)) || (later && cp.uids.includes(a.uid));
      if (!has) continue;
      const sp = calls(state, a);
      if (sp && Ranged.isReflector(state, { arch: sp.archetype || 'plodder', mods: sp.modifiers || [], gone: 0 })) return true;
    }
    return false;
  }

  // ---- Its attachments (TABLEAU-PHASES) ----
  const DIRS = ['N', 'E', 'S', 'W'], DIR = { N: 0, E: 2, S: 4, W: 6 };
  const roomAt = (m, x, y) => Array.isArray(m.roomOf) && m.roomOf.length && m.roomOf[y] ? m.roomOf[y][x] : null;
  const rowMajor = (p, q) => p[1] - q[1] || p[0] - q[0];
  // Its record, when a is the Great Board placed (dept.cp's first piece, its record this core's).
  function recordOf(state, a) {
    const cp = Hall.cp(state);
    if (!cp || !Array.isArray(cp.uids) || cp.uids[0] !== a.uid) return null;
    const rec = Packs.speciesFor(state, a);
    return rec && rec.archetype === ID ? rec : null;
  }
  const attachmentsOf = rec => rec && Array.isArray(rec.attachments) ? rec.attachments : [];
  // A tile of room `room` an exhibit may be set on: plain floor (`.`, as population sets every
  // exhibit: never a bench, a pool, a rope line or a doorway), with no one on it.
  function open(state, room, x, y) {
    const m = state.dept;
    return Grid.inside(m, x, y) && roomAt(m, x, y) === room && Grid.ch(m, x, y) === '.' && !Actors.at(state, x, y);
  }
  // The rule a tile keeps for an exhibit that never leaves it (the Repeater Arm, a station),
  // as a mimic's case keeps it (population's LV1 and LV10, plan DE8): it is not the hall's
  // reading tile (dept.viewTile), and standing there, with the Board's footprint (which never
  // moves either), it cuts no tile off from the entrance (your tile in a room for tests with
  // none) and leaves every case a tile beside it you can reach. fixedOk(state, b) → (x, y) →
  // bool; the walk without it is measured once.
  function fixedOk(state, b) {
    const m = state.dept, big = m.w * m.h, from = Array.isArray(m.entrance) ? [m.entrance] : [[state.actors[0].x, state.actors[0].y]];
    const walk = also => Grid.distances(m, from, big, (x, y) => Actors.covers(b, x, y) || (also && also[0] === x && also[1] === y) ? big + 1 : 0);
    const was = walk(null), cases = (m.fixtures || []).filter(f => f.k === 'case' && Grid.reachDist(was, m, f.x, f.y) >= 0);
    return (x, y) => {
      if (Array.isArray(m.viewTile) && m.viewTile[0] === x && m.viewTile[1] === y) return false;
      const now = walk([x, y]);
      for (let i = 0; i < now.length; i++) if (was[i] >= 0 && now[i] < 0 && i !== y * m.w + x) return false;
      return cases.every(f => Grid.reachDist(now, m, f.x, f.y) >= 0);
    };
  }
  // Population's rule for a hall exhibit's tile (M4 plan A10; Populate's `keeps`): never within
  // RING_STILL + 1 walking tiles of the hall's reading tile (dept.viewTile; a room for tests has
  // none), so that viewing, standing still there, wakes none. Its other rules hold of every hall
  // tile: the safe zone lies within the Intro, whose onward openings are INTRO_DEPTH or more
  // walking tiles from the entrance, the footprint is the Board's own, and a tile is plain
  // floor (open). The Repeater Arm, a station, keeps to its case instead (attach), off the
  // reading tile itself (fixedOk): a station never hunts, so your ring there at most wakes it,
  // and it marks its line at each chime awake or asleep.
  function keeper(state) {
    const m = state.dept, view = Array.isArray(m.viewTile) ? Grid.distances(m, [m.viewTile], N.RING_STILL + 1) : null;
    return (x, y) => { if (!view) return true; const v = Grid.reachDist(view, m, x, y); return v < 0 || v > N.RING_STILL + 1; };
  }
  // A run from (x, y) in direction k (Grid's: N 0, E 2, S 4, W 6): each tile of room `room` that
  // sight passes, up to the first that it does not, or that is not the room's (a station's
  // line, rules/modules/hourly_demonstration.js, takes no other).
  function run(m, room, x, y, k) {
    const out = [];
    for (let i = x + Grid.DX[k], j = y + Grid.DY[k]; Grid.inside(m, i, j) && roomAt(m, i, j) === room && Grid.seeThrough(m, i, j); i += Grid.DX[k], j += Grid.DY[k]) out.push([i, j]);
    return out;
  }
  // The Repeater Arm's tile: beside the hall's real case (the first in dept.fixtures' order with
  // a tile to spare), within its weather's square (WEATHER_SIZE, centred on it), so the hall's
  // rain falls on it (rules/modules/weather_cases.js: the hall's case holds rain); the tile
  // nearest the Board, ties in row-major order. With no such tile, beside the Board, the first
  // in row-major order; null with none. Each keeps the rule of a tile no one leaves (ok:
  // fixedOk), checked in that order, so the walk is measured only for the tiles tried.
  function byCase(state, b, ok) {
    const m = state.dept, hall = roomAt(m, b.x, b.y), h = Int.idiv(N.WEATHER_SIZE, 2);
    for (const f of m.fixtures || []) {
      if (f.k !== 'case' || f.mimic || roomAt(m, f.x, f.y) !== hall) continue;
      const near = [];
      for (let y = f.y - h; y <= f.y + h; y++) for (let x = f.x - h; x <= f.x + h; x++) if (open(state, hall, x, y)) near.push([x, y]);
      const at = near.sort((p, q) => Actors.dist(b, p[0], p[1]) - Actors.dist(b, q[0], q[1]) || rowMajor(p, q)).find(p => ok(p[0], p[1]));
      if (at) return at;
    }
    for (let y = b.y - 1; y <= b.y + (b.size || 1); y++) for (let x = b.x - 1; x <= b.x + (b.size || 1); x++) if (Actors.dist(b, x, y) === 1 && open(state, hall, x, y) && ok(x, y)) return [x, y];
    return null;
  }
  // The Repeater Arm's line (its route.dir, which the station's init keeps): of N, E, S and W,
  // those whose line, out and back along itself (a reflector turns a beam back, §8.1), never
  // crosses the Board, so the Arm never strikes the Board it repeats; of them, the longest run
  // that no other exhibit stands on, the first in that order on a tie, else the longest
  // (population's rule for a station's line, Populate's lineDir). One of its two axes always
  // misses the Board, which it does not stand on.
  function armLine(state, a, b) {
    const m = state.dept, room = roomAt(m, a.x, a.y);
    let best = null, most = -1, clear = null, longest = -1;
    for (const dir of DIRS) {
      const k = DIR[dir], fwd = run(m, room, a.x, a.y, k);
      if (fwd.concat(run(m, room, a.x, a.y, (k + 4) % 8)).some(([x, y]) => Actors.covers(b, x, y))) continue;
      const met = fwd.some(([x, y]) => { const o = Actors.at(state, x, y); return !!o && o !== a && o.uid !== 'you'; });
      if (fwd.length > most) { most = fwd.length; best = dir; }
      if (!met && fwd.length > longest) { longest = fwd.length; clear = dir; }
    }
    return clear !== null && longest > 0 ? clear : best;
  }
  // The Board Dish's tile: apart from the Board, so that hunting the Board does not wake it, and
  // out of the Repeater Arm's way (avoid: its line's runs): of the hall's free tiles, those in
  // none of the Board's rows and columns first (where its beam would go); of them, the nearest
  // the Board by walking (Grid.distances from its footprint) at least FAR from it, else the
  // farthest; ties in row-major order. FAR is one more than the most of RING_MOVING and
  // NOISE_SOFT from every tile beside the Board, so your ring and the soft noise of your blows
  // there never reach it.
  const FAR = () => Math.max(N.RING_MOVING, N.NOISE_SOFT) + 2;
  function apart(state, b, ok, avoid) {
    const m = state.dept, hall = roomAt(m, b.x, b.y), d = Grid.distances(m, Actors.footprint(b), m.w * m.h, null, 'exhibit'), s = b.size || 1, far = FAR();
    const list = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const v = d[y * m.w + x];
      if (v < 1 || !open(state, hall, x, y) || !ok(x, y) || avoid.has(key(x, y))) continue;
      const axis = (x >= b.x && x < b.x + s) || (y >= b.y && y < b.y + s) ? 1 : 0;
      list.push({ x, y, rank: [axis, v >= far ? 0 : 1, v >= far ? v : -v] });
    }
    list.sort((p, q) => p.rank[0] - q.rank[0] || p.rank[1] - q.rank[1] || p.rank[2] - q.rank[2] || p.y - q.y || p.x - q.x);
    return list.length ? [list[0].x, list[0].y] : null;
  }
  // init (Setup.settleActors, as Centrepiece.place settles its pieces): the Board, placed, sets
  // out its attachments (its record's `attachments`, in order), each an exhibit of its own and
  // no piece of it (dept.cp.uids is its body alone): asleep, with its role's numbers at the
  // depth, its uid the hall's next (<acc>.<depth>.<roleKey>.<n>, counting on from the Board's,
  // §3.2), each only once its archetype, modifiers and trigger are past ready false
  // (Populate.ready, plan A10), each on its tile (`stands`: 'case' beside the hall's case,
  // byCase, on a tile no one leaves may take, fixedOk; 'apart', apart), plain floor either way
  // (open); a station's line set (armLine) before its archetype's init, which
  // keeps it. One that options.without names is made and at once marked gone, as a summoned
  // body is. Nothing is drawn. A department made without the Board itself has no attachments
  // either: its init is never run.
  function attach(state, b) {
    const list = attachmentsOf(recordOf(state, b));
    if (!list.length || state.actors.some(a => list.some(q => q.id === a.sp))) return;
    const m = state.dept, cp = Hall.cp(state), prefix = `${m.acc}.${m.depth}.${cp.room}.`, keeps = keeper(state), fixed = fixedOk(state, b), without = state.options.without || [], avoid = new Set();
    let n = 0;
    for (const a of state.actors) if (a.uid.startsWith(prefix) && /^\d+$/.test(a.uid.slice(prefix.length))) n = Math.max(n, Number(a.uid.slice(prefix.length)));
    for (const q of list) {
      if (!Populate.ready(q)) continue;
      const at = q.stands === 'case' ? byCase(state, b, fixed) : apart(state, b, keeps, avoid);
      if (!at) continue;
      const stats = Roles.stats(q.role, m.depth);
      const a = Actors.spawn(state, Object.assign({}, stats, { uid: prefix + (++n), sp: q.id, size: 1, x: at[0], y: at[1], maxHp: stats.hp, mode: 'dormant',
        arch: q.archetype || 'plodder', mods: (q.modifiers || []).slice(), modParams: q.modParams || {}, trigger: q.trigger || null, group: q.group || null }));
      // A station's tile and its line's runs are kept clear of those set out after it whether
      // it is made or not, so a department made without it moves no other exhibit (§3.6; M4 FU3:
      // without the Repeater Arm, the Board Dish took a tile on its line, M.11 seed 3 depth 5).
      if (a.arch === 'demonstrator') {
        const dir = armLine(state, a, b), room = roomAt(m, a.x, a.y), k = DIR[dir];
        avoid.add(key(a.x, a.y));
        for (const [x, y] of run(m, room, a.x, a.y, k).concat(run(m, room, a.x, a.y, (k + 4) % 8))) avoid.add(key(x, y));
        if (!without.includes(a.uid)) a.route = { dir };
      }
      if (without.includes(a.uid)) { a.gone = 1; continue; }
      Archetypes.init(state, a);
    }
  }
  const init = (state, a) => attach(state, a);
  // Tableau.attachments(state) → [actor]: the Board's attachments set out in this visit, in
  // spawn order, fallen ones included ([] with no Board placed).
  function attachments(state) {
    const cp = Hall.cp(state), b = cp && Array.isArray(cp.uids) ? Actors.byUid(state, cp.uids[0]) : null, list = b ? attachmentsOf(recordOf(state, b)) : [];
    return state.actors.filter(a => list.some(q => q.id === a.sp));
  }

  // ---- The Board Dish's rule: MODIFIERS.tab_screen ----
  const SCREEN = 'tab_screen', WAKES = 'tab_phase';
  const screens = (state, a) => Array.isArray(a.mods) && a.mods.includes(SCREEN) && !Options.off(state, SCREEN);
  // The Great Board standing (placed and not fallen), or null.
  function standingBoard(state) {
    const cp = Hall.cp(state), b = cp && Array.isArray(cp.uids) ? Actors.byUid(state, cp.uids[0]) : null;
    return b && !b.gone && b.arch === ID ? b : null;
  }
  // onPhase (Centrepiece.hooks): as the Board enters its second phase, every exhibit present
  // with the modifier on (the Board Dish) that is not hunting you starts to, at once, in spawn
  // order, its cause tab_phase {by: the Board}: one asleep wakes into its hunt (Wake.wake), one
  // awake, searching or going back (woken sooner, by your ring, a noise or the bell, §8.2)
  // turns to it (Wake.setMode); either hunt knows your tile (§8.2).
  function onPhase(state, k, ev) {
    if (k !== 2) return;
    const b = standingBoard(state);
    if (!b) return;
    for (let i = 1; i < state.actors.length; i++) {
      const a = state.actors[i];
      if (a.gone || a.mode === 'hunting' || !screens(state, a)) continue;
      if (a.mode === 'dormant') Wake.wake(state, a, 'hunting', { k: WAKES, by: b.uid }, ev);
      else Wake.setMode(state, a, 'hunting', { k: WAKES, by: b.uid }, ev);
    }
  }
  // The tile a screen keeps to (MODIFIERS.tab_screen): of the free tiles of the Board's hall
  // beside its footprint (one an exhibit can stand on, not a closed door, no one but a on it),
  // the nearest where a last knew you were (a.lastKnown, else your tile; by squared distance,
  // so the tile straight between, then row-major order); null with none.
  function front(state, a, b) {
    const m = state.dept, you = state.actors[0], at = Array.isArray(a.lastKnown) ? a.lastKnown : [you.x, you.y], s = b.size || 1, hall = roomAt(m, b.x, b.y), list = [];
    for (let y = b.y - 1; y <= b.y + s; y++) for (let x = b.x - 1; x <= b.x + s; x++) {
      if (Actors.dist(b, x, y) !== 1 || !Grid.inside(m, x, y) || roomAt(m, x, y) !== hall || !Grid.walkable(m, x, y, 'exhibit') || Grid.closedDoor(m, x, y)) continue;
      const o = Actors.at(state, x, y);
      if (!o || o === a) list.push([x, y]);
    }
    const sq = p => (p[0] - at[0]) * (p[0] - at[0]) + (p[1] - at[1]) * (p[1] - at[1]);
    return list.length ? list.sort((p, q) => sq(p) - sq(q) || rowMajor(p, q))[0] : null;
  }
  // A step toward a tile, walking round the other actors where they stand now (AI.around: the
  // first step of a shortest walk over tiles no other actor stands on, §8.2's walk to anything
  // but you), the ties broken on its own ai stream (ai/<uid>, as every exhibit's step is), then
  // AI.afterStep; null when it has arrived or the others leave it no step there.
  function stepRound(state, a, goal, ev) {
    const w = AI.around(state, a, goal, 'onto');
    if (w.arrived || !w.options.length) return null;
    const d = w.options.length === 1 ? w.options[0] : Rng.stream(state, 'ai/' + a.uid).pick(w.options);
    const x = a.x, y = a.y, r = Step.moveInto(state, a, d, ev);
    if (typeof r !== 'number') return null;
    if (a.x !== x || a.y !== y) AI.afterStep(state, a, ev);
    return r;
  }
  // Its act: hunting you while the Board stands, it strikes you if it can (Combat.canStrike, a
  // blow from beside you), and otherwise steps toward the tile it keeps to, going round the
  // others (stepRound: the Repeater Arm, a summoned trolley, never stand in its way for good),
  // and waits once there, with none free, or with no step there. Out of sight for its hunt's
  // turns (AI.loseTrackTurns), or in any other mode, or once the Board has fallen, it acts as
  // its archetype does (null: AI.byMode, a reflector's walk, which also loses you then).
  function screenAct(state, a, ev) {
    const b = standingBoard(state);
    if (a.mode !== 'hunting' || !b || Cases.encased(state, a)) return null;
    if (!AI.sees(state, a) && state.turn - a.stim >= AI.loseTrackTurns(state, a)) return null;
    const r = AI.strike(state, a, state.actors[0], ev);
    if (r !== null) return r;
    const goal = front(state, a, b), t = goal ? stepRound(state, a, goal, ev) : null;
    return t !== null ? t : AI.wait(state, a, ev);
  }
  Archetypes.addModifier(SCREEN, { act: screenAct });

  Archetypes.add(ID, Centrepiece.hooks(ID, { neverSteps, adjustDamage, onResolve, readout, init, onPhase }));

  return { line, callTiles, calls, summoning, callsReflector, attachments, front };
})();
