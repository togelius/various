// ACCESSION — the module hourly_demonstration (M.11; BUILD.md §5.4): "On the chime, every
// station marks its line across its room, and two turns later the line strikes everything on
// it." Its rules register here with Modules.define (rules/modules.js) in the form of §5.4; its
// archetype: rules/arch/demonstrator.js (the stations); its entries in js/core/reg/mod-chime.js
// and its sentences in js/core/text/mod-chime.js. Owned by MOD-CHIME.
//
// The rule (§5.4; M4 plan MO9–MO11, D1.9–D1.10), as the station's line says it:
//   - The count. The module counts turns from department entry (m.since, the turn its state was
//     made), not the clock, so it keeps counting in a sealed hall. All stations share it.
//   - A station is a demonstrator the module acts on (Modules.flagged), not gone. Its period is
//     its own room's: DEMO_PERIOD_INTRO in the Intro (a room of role intro), DEMO_PERIOD_HALL in
//     the Centrepiece's hall (role centre), DEMO_PERIOD anywhere else (and in a map with no
//     rooms). It never leaves its tile, so its room, and its period, never change.
//   - Its chime: the boundary at which the count is DEMO_WARNING short of a multiple of its
//     period (count ≡ p − DEMO_WARNING, mod p). There, in this order:
//       boundary step 4 (Wake.boundary, the period trigger's waking): each station still asleep
//         and not held fixed wakes, awake, for its performance, keeping its pips
//         (Wake.perform, ax.perform);
//       boundary step 8 (the module's rules, in pack order and in the order written):
//         `chime`  the chime sounds, once, for every station whose chime it is (module {rule:
//                  'chime', turns: DEMO_WARNING, n}); the module keeps the turn it last sounded
//                  (chimed);
//         `line`   each such station, in spawn order, awake and not held fixed, marks its line
//                  (the special demo_line, due DEMO_WARNING turns later, at the multiple), as
//                  Specials.mark allows: no mark of its own pending, a tile to mark, and no
//                  tile of it already marked for damage by another (§8.1's no overlaps), so a
//                  line that would overlap a mark already lying is not marked;
//         `blocked` each such station whose line was not marked for that overlap alone says
//                  so (module {rule: 'blocked', who}); the module keeps the last (blocked).
//   - At the multiple (count ≡ 0, mod p), boundary step 8: its line goes off first
//     (Specials.resolveDue: DEMO_LINE_DMG gross, through each Padding, on all on it), then
//     (the module's turn, bespoke) each station that woke for its performance sleeps again
//     where it stands, with the pips it had (module {rule: 'settle', who, n: those pips}, then
//     Wake.resleep). A station awake before its chime marks its line and stays awake.
//   - Its line (the shape demo_line, below): a §8.1 beam from its tile along its direction
//     (route.dir, N, E, S or W: population's, or the archetype's init), through glass, stopping
//     at what blocks sight, turned back along itself by a reflector, as every beam is; and it
//     stays in its room: it stops at the first tile that is not its room's (an opening, an
//     archway or a door between rooms), so the countdown of the room you stand in is true for
//     every line that can reach you (one room, one period, D1.10). Its tiles are fixed when it
//     is marked (§8.1).
// With the module off (rulesOff, or a visit without it) none of this happens: no chime, no
// line; a station never strikes (its archetype's clause).
//
// Bespoke (plan A7, MO18; the validation log, Modules.bespoke):
//   turn            the line's end at the multiple: each station that woke for its
//                   performance sleeps again with its pips (no effect of the form puts an
//                   exhibit to sleep);
//   threat          the lines its chimes will mark, before they sound (below);
//   Wake.perform    the performance's waking at boundary step 4, keeping the pips the
//                   station had (the form's wake effect, Wake.wake, starts a waking with none);
//   Wake.resleep    its going back to sleep with them.
//
// Its threat (Modules.threat; §8.1's due lines; D7.3): the lines its chimes not yet sounded
// will mark and make due before untilTick, so that a long action is never begun without
// warning of one. A line not yet marked has no tiles yet: they are fixed only when the chime
// marks it, and what stands or lies in its way may change before then (an exhibit that
// reflects steps into or out of it, a door on it opens, a cloud clears). So the forecast is
// every tile it could take then (HourlyDemonstration.reach): along its direction, every tile
// of its room up to the first that sight can never pass (a wall, a column: not a door, a cloud
// or an exhibit); and, while an exhibit that reflects stands anywhere in the department, its
// station's tile and every such tile behind it, where a reflector in its way would send it.
// A chime its station will still be held fixed through (a fixed status whose end is after it)
// marks nothing, and is left out. It reads nothing an action's roll could change but whether a
// reflector stands, so
// Specials.threat asks it on the state as it was before your action (§8.1): the forecast is the
// same whether your blow destroys a reflector or misses, and never smaller than the line the
// chime will mark.
//
// HourlyDemonstration, for the archetype, the view model and the tests:
//   HourlyDemonstration.of(state) → the module's state (its dept.modules entry), on, or null
//   HourlyDemonstration.isStation(state, a) → bool     a demonstrator the module acts on
//   HourlyDemonstration.stations(state) → [actor]      every station present, in spawn order
//   HourlyDemonstration.period(state, a) → int         the period of a's room
//   HourlyDemonstration.periodOfRoom(state, id) → int  a room's period (id null: no room)
//   HourlyDemonstration.chimesAt(state, a, turn) → bool   a's chime is the boundary of turn
//   HourlyDemonstration.next(state, roomId) → null | {next, period}   the turns until the next
//                                                      chime of a room's period, and the
//                                                      period (for the dial: the room you
//                                                      stand in); null with the module off
//   HourlyDemonstration.line(state, a) → [[x, y]]      the tiles a's line would take if marked now
//   HourlyDemonstration.reach(state, a) → [[x, y]]     every tile a line of a's could take (above)
//   HourlyDemonstration.strikesWithin(state, a, turns) → bool   a line of a's goes off within
//                                                      the next `turns` turn boundaries
//   HourlyDemonstration.performing(a) → bool           a woke for its performance (ax.perform)
'use strict';
const HourlyDemonstration = (() => {
  const ID = 'hourly_demonstration', SP = 'demo_line';
  const DIRS = { N: 0, E: 2, S: 4, W: 6 };
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

  // The module's state while it is on, or null (absent from the visit, or switched off).
  const of = state => Modules.on(state, ID) ? Modules.of(state, ID) : null;
  const isStation = (state, a) => !!a && !a.gone && a.uid !== 'you' && a.arch === 'demonstrator' && Modules.flagged(state, a, ID);
  const stations = state => state.actors.filter((a, i) => i > 0 && isStation(state, a));
  const performing = a => !!a && !!a.ax && !!a.ax.perform;

  // ---- The count and the periods ----
  // The room id at a tile (dept.roomOf), or null where the map has no rooms (a room for tests).
  const roomAt = (m, x, y) => Array.isArray(m.roomOf) && m.roomOf.length && m.roomOf[y] ? m.roomOf[y][x] : null;
  function periodOfRoom(state, id) {
    const rooms = Array.isArray(state.dept.rooms) ? state.dept.rooms : [];
    const rm = id === null ? null : rooms.find(r => r.id === id) || null;
    if (rm && rm.role === 'intro') return N.DEMO_PERIOD_INTRO;
    if (rm && rm.role === 'centre') return N.DEMO_PERIOD_HALL;
    return N.DEMO_PERIOD;
  }
  const period = (state, a) => periodOfRoom(state, roomAt(state.dept, a.x, a.y));
  // Is the count at the boundary of `turn` DEMO_WARNING short of a multiple of p?
  const chimeOf = (m, p, turn) => { const c = turn - m.since; return c >= 0 && c % p === p - N.DEMO_WARNING; };
  function chimesAt(state, a, turn) {
    const m = of(state);
    return !!m && isStation(state, a) && chimeOf(m, period(state, a), turn);
  }
  // The stations whose chime is this boundary, in spawn order.
  const due = (state, m) => stations(state).filter(a => chimeOf(m, period(state, a), state.turn));
  function next(state, roomId) {
    const m = of(state);
    if (!m) return null;
    const p = periodOfRoom(state, roomId === undefined ? null : roomId);
    let k = 1;
    while (!chimeOf(m, p, state.turn + k)) k++;
    return { next: k, period: p };
  }

  // ---- The line ----
  const dirOf = a => a.route && own(DIRS, a.route.dir) ? DIRS[a.route.dir] : -1;
  // A beam from a can travel at most this far: out to its room's edge and back the length of a
  // row or a column (each tile is listed once, so a longer range adds none).
  const rangeOf = m => 2 * Math.max(m.w, m.h);
  // a's beam (Ranged: its tiles in the order it crosses them, each with where it came from and
  // the reflector that turned it), cut at the first tile that is not a's room's.
  function trace(state, a) {
    const d = dirOf(a), m = state.dept;
    if (d < 0) return { tiles: [], from: [], via: [] };
    const R = rangeOf(m), tiles = Ranged.beam(state, a, d, R), from = Ranged.beamFrom(state, a, d, R), via = Ranged.beamVia(state, a, d, R);
    const room = roomAt(m, a.x, a.y);
    let n = tiles.length;
    if (room !== null) for (let i = 0; i < tiles.length; i++) if (roomAt(m, tiles[i][0], tiles[i][1]) !== room) { n = i; break; }
    return { tiles: tiles.slice(0, n), from: from.slice(0, n), via: via.slice(0, n) };
  }
  const key = (x, y) => `${x},${y}`;
  const line = (state, a) => trace(state, a).tiles.map(t => t.slice());
  // The shape: the tiles a's line takes (Specials.tiles makes them row-major), and, for each
  // tile, where its damage comes from and the reflector that turned the beam before it.
  Specials.addShape(SP, {
    tiles: (state, a) => line(state, a),
    from(state, a, list) { const t = trace(state, a), at = new Map(t.tiles.map((p, i) => [key(p[0], p[1]), t.from[i]])); return list.map(p => at.get(key(p[0], p[1])).slice()); },
    via(state, a, list) { const t = trace(state, a), at = new Map(t.tiles.map((p, i) => [key(p[0], p[1]), t.via[i]])); return list.map(p => at.get(key(p[0], p[1]))); },
    glass: true,
  });

  // Every tile a line of a's could take when it is marked: along its direction, each tile of
  // its room up to the first that sight can never pass (a door, closed or not, and whatever
  // stands or lies on a tile, can change before then); and, while an exhibit that reflects
  // stands in the department, a's own tile and the same run behind it. Row-major, each once.
  function reach(state, a) {
    const d = dirOf(a), m = state.dept, out = [];
    if (d < 0) return out;
    const room = roomAt(m, a.x, a.y);
    const passes = (x, y) => Grid.inside(m, x, y) && (room === null || roomAt(m, x, y) === room) && (Grid.seeThrough(m, x, y) || Grid.closedDoor(m, x, y));
    const run = k => { for (let x = a.x + Grid.DX[k], y = a.y + Grid.DY[k]; passes(x, y); x += Grid.DX[k], y += Grid.DY[k]) out.push([x, y]); };
    run(d);
    if (state.actors.some(b => b.uid !== 'you' && Ranged.isReflector(state, b))) { out.push([a.x, a.y]); run((d + 4) % 8); }
    return out.sort((p, q) => p[1] - q[1] || p[0] - q[0]);
  }
  // Does a line of a's go off within the next `turns` boundaries: one marked now, or one a
  // chime of its will mark (its chime after now, its multiple within them)?
  function strikesWithin(state, a, turns) {
    const m = of(state);
    if (!m || !isStation(state, a) || !Number.isInteger(turns) || turns < 1) return false;
    if (a.telegraph && a.telegraph.sp === SP) return true;
    const p = period(state, a);
    for (let c = state.turn + 1; c + N.DEMO_WARNING <= state.turn + turns; c++) if (chimeOf(m, p, c)) return true;
    return false;
  }

  // ---- The rules ----
  const W = N.DEMO_WARNING;
  const lineTiles = (state, a) => Specials.tiles(state, a, SP);
  const held = a => Status.has(a, 'fixed');
  // Will a still be held fixed at the boundary of turn c? A fixed status ends at the boundary
  // its until has come (Status.tick, step 2, before the chime's steps 4 and 8); one for the
  // rest of the visit never does. Only you can end one sooner, and not in the middle of an action.
  const fixedAt = (a, c) => (a.statuses || []).some(s => s.id === 'fixed' && (s.perm === true || (Number.isInteger(s.until) && s.until > c)));
  // a, its chime come, marks its line now: awake (for its performance, or before), not held
  // fixed, and Specials.canMark allows it (no mark of its own pending, a tile to mark, none of
  // its tiles marked for damage by another).
  const marks = (state, a) => !held(a) && a.mode === 'awake' && Specials.canMark(state, a, SP, lineTiles(state, a));
  // a, its chime come, awake, not held fixed, with no mark pending and a tile to mark, may not
  // mark its line only because another damage mark lies on a tile of it.
  function overlapped(state, a) {
    if (held(a) || a.mode !== 'awake' || a.telegraph) return false;
    const t = lineTiles(state, a);
    return t.length > 0 && !Specials.canMark(state, a, SP, t);
  }
  const every = (state, m, a) => period(state, a), at = (state, m, a) => period(state, a) - W;

  Modules.define(ID, {
    rules: [
      // The chime sounds for every station whose chime this boundary is.
      { rule: 'chime', on: 'turn', when: (state, e, m) => due(state, m).length > 0,
        fields: (state, e, m) => ({ turns: W, n: due(state, m).length }),
        do: [{ k: 'flag', name: 'chimed', value: state => state.turn }] },
      // Each station marks its line, due at the multiple, in spawn order.
      { rule: 'line', on: 'period', every, at, who: state => stations(state), when: (state, e, m, a) => marks(state, a),
        telegraph: { turns: W, shown: SP },
        do: [{ k: 'special', sp: SP, due: state => (state.turn + W) * N.TICKS_PER_TURN }] },
      // A line that would overlap a mark already lying is not marked, and the log says so.
      { rule: 'blocked', on: 'period', every, at, who: state => stations(state), when: (state, e, m, a) => overlapped(state, a),
        do: [{ k: 'flag', name: 'blocked', value: (state, e, m, a) => ({ by: a.uid, turn: state.turn }) }] },
    ],
    bespoke: ['turn', 'threat', 'Wake.perform', 'Wake.resleep'],
    // At the multiple, after its line has gone off: each station that woke for its performance
    // sleeps again, with the pips it had.
    turn(state, ev) {
      for (const a of state.actors.slice(1)) {
        if (state.over) return;
        if (a.gone || !performing(a) || state.turn < a.ax.perform.turn + W) continue;
        Causes.emit(state, ev, 'module', { id: ID, rule: 'settle', who: a.uid, n: a.ax.perform.pips }, { k: ID });
        Wake.resleep(state, a, ev);
      }
    },
    // The lines its chimes not yet sounded will mark, due before untilTick, at their reach;
    // none for a chime its station will be held fixed through.
    threat(state, untilTick, m) {
      const out = [], T = N.TICKS_PER_TURN, gross = Specials.info(state, SP).gross;
      for (const a of stations(state)) {
        const p = period(state, a), tiles = reach(state, a);
        if (!tiles.length) continue;
        for (let c = state.turn + 1; (c + W) * T < untilTick; c++) if (chimeOf(m, p, c) && !fixedAt(a, c)) out.push({ by: a.uid, sp: SP, tiles: tiles.map(t => t.slice()), gross, due: (c + W) * T });
      }
      return out;
    },
  });

  return { of, isStation, stations, period, periodOfRoom, chimesAt, next, line, reach, strikesWithin, performing };
})();
