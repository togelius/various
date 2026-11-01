// ACCESSION — the mp_tableau archetype's hooks (M.11's Centrepiece, the Great Board of the Central
// Station; BUILD.md §5.1, §5.3, §5.5, §8.1; rules/archetypes.js), added with the hooks every
// Centrepiece shares (Centrepiece.hooks: its specials in turn, its phases, its fall). Its
// registry entry is in js/core/reg/cp-tableau.js, its sentences in js/core/text/cp-tableau.js
// and its record in content/M11-cp.js. Owned by TABLEAU-CORE (its body); TABLEAU-PHASES adds
// its attachments (the Repeater Arm, the Board Dish) and the hall's rain case.
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
// The beam and the summons draw nothing.
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
    for (const [x, y] of tel.tiles) {
      if (!free(state, a, x, y)) continue;
      a.kids += 1;
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

  Archetypes.add(ID, Centrepiece.hooks(ID, { neverSteps, adjustDamage, onResolve, readout }));

  return { line, callTiles, calls, summoning, callsReflector };
})();
