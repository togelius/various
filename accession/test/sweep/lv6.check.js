// LV6, the entrance's safe zone (M4 plan D-LV6; js/core/layout/lv6.js), over the shared sweep
// (test/m4-sweep.test.js: seeds 1–100 of each department at each depth 1–7, as Dept.create
// makes them). For every department:
//   - LV6 passes it (LV6.check is null), unless it is the certified fallback, taken despite
//     LV6's rejection (Dept.generate says so: fallback, rejected by lv6), which is counted;
//   - an oracle written apart from lv6.js finds nothing: you are stood on each tile of the
//     safe zone (every tile you could stand on within SAFE_ZONE walking tiles of the
//     entrance), with the doors as made and with every ordinary door open, and the rules
//     themselves are asked:
//       - no exhibit stands within SAFE_ZONE walking tiles of the entrance;
//       - no sleeper's axis (Wake.onAxis) or tether (Wake.inTether) holds you;
//       - no exhibit that would stir hears a door beside the zone opened (Noise.reach,
//         NOISE_SOFT): a sleeper, or one awake that would come to look (Wake.hear: not one
//         that never hunts, a station, nor one in a case);
//     and, on seeds 1–ORACLE_SEEDS of each depth (they cost more):
//       - no sleeper is inside your ring there (Vision.ringDist, at RING_MOVING, RING_LOUD_FLOOR
//         more on a loud floor, and LAMP_RING more in a department whose pack holds a curio
//         with `observing`, the Lamp);
//       - no Wader on its round sees you (AI.sees) from where it stands at any of its actions
//         over SAFE_ZONE_TURNS turns (Patrol.timeline);
//       - no station's line can strike you within SAFE_ZONE_TURNS turns
//         (HourlyDemonstration.reach for its chimes by then);
// and over the whole sweep: LV6's fallbacks at most 1% of each department's departments.
'use strict';
module.exports = C => {
  const { N, Grid, Actors, Archetypes, Wake, Vision, AI, Patrol, Noise, HourlyDemonstration, LV6, Packs, Dept, Cases } = C;
  const ORACLE_SEEDS = 10;
  const tally = { S9: 0, A4: 0, M11: 0, fallback: { S9: 0, A4: 0, M11: 0 }, oracle: 0, tiles: 0 };

  // A view of the department: the doors as made, or every ordinary door open; no surface.
  const view = (s, open) => Object.assign({}, s, { dept: Object.assign({}, s.dept, { surfaces: [], tiles: open ? s.dept.tiles.map(r => r.replace(/\+/g, "'")) : s.dept.tiles }) });
  // The view with you in it, moving (your ring is the moving one): a copy of you that the
  // oracle stands on each tile in turn (put).
  const withYou = v => Object.assign({}, v, { actors: [Object.assign({}, v.actors[0], { still: false })].concat(v.actors.slice(1)) });
  const put = (you, x, y) => { you.actors[0].x = x; you.actors[0].y = y; return you; };
  const lampy = s => (Packs.get(s.dept.acc).items || []).some(it => it.kind === 'curio' && (it.prims || []).some(p => p.id === 'observing'));
  const cheb = (a, x, y) => { let c = -1; for (const [u, v] of Actors.footprint(a)) { const e = Math.max(Math.abs(u - x), Math.abs(v - y)); if (c < 0 || e < c) c = e; } return c; };
  const loud = (m, x, y) => { const t = Grid.TILES[Grid.ch(m, x, y)]; return !!(t && t.loud); };

  // The oracle on one department (all of it when full): its problems, as sentences.
  function oracle(s, full) {
    const m = s.dept, out = [], d = Grid.distances(m, [m.entrance], N.SAFE_ZONE), T = N.SAFE_ZONE_TURNS;
    const R0 = N.RING_MOVING + (lampy(s) ? N.LAMP_RING : 0);
    const ex = s.actors.slice(1).filter(a => !a.gone);
    for (const a of ex) for (const [x, y] of Actors.footprint(a)) { const e = Grid.reachDist(d, m, x, y); if (e >= 0) out.push(`${a.uid} stands ${e} walking tiles from the entrance`); }
    const told = (full && Patrol.timeline(s, T)) || [], walks = new Map(told.map(p => [p.uid, p.at]));
    const lines = full ? ex.filter(a => a.mode === 'dormant' && HourlyDemonstration.isStation(s, a) && HourlyDemonstration.strikesWithin(s, a, T)) : [];
    // The exhibits the rules asked here could apply to: all that can be woken or see you, or,
    // in the cheaper pass, the sleepers with an axis or a tether.
    const asked = ex.filter(a => !Archetypes.pipless(s, a) && (full || (a.mode === 'dormant' && (a.trigger === 'axis' || a.trigger === 'tether'))));
    // Who would stir on hearing a door: a sleeper, or one awake that would come to look.
    const hearers = ex.filter(a => a.mode !== 'hunting' && !Archetypes.pipless(s, a) && (a.mode === 'dormant' || (Archetypes.huntsOnSight(s, a) && !Cases.encased(s, a))));
    for (const open of [false, true]) {
      const v = view(s, open), vm = v.dept, where = open ? ' (doors open)' : '', heard = new Set(), me = asked.length ? withYou(v) : null;
      const reach = new Map(lines.map(a => [a.uid, HourlyDemonstration.reach(v, a, s.turn + T)]));
      for (let k = 0; k < d.length; k++) {
        if (d[k] < 0) continue;
        const x = k % m.w, y = (k - x) / m.w;
        if (!Grid.walkable(vm, x, y) || Grid.closedDoor(vm, x, y)) continue;
        tally.tiles++;
        const you = me && put(me, x, y), R = R0 + (loud(vm, x, y) ? N.RING_LOUD_FLOOR : 0);
        let f = null;
        for (const a of asked) {
          if (a.mode === 'dormant') {
            if (full && cheb(a, x, y) <= R + 1) {
              if (!f) f = { r: R, x, y, dist: Grid.distances(vm, [[x, y]], R) };
              if (Actors.footprint(a).some(([u, w]) => Vision.ringDist(you, u, w, f) >= 0)) out.push(`at ${x},${y}${where} ${a.uid} is inside your ring (${R})`);
            }
            if (a.trigger === 'axis' && Wake.onAxis(you, a)) out.push(`at ${x},${y}${where} you are on ${a.uid}'s axis`);
            if (a.trigger === 'tether' && Wake.inTether(you, a)) out.push(`at ${x},${y}${where} you are within ${a.uid}'s tether`);
            if (reach.has(a.uid) && reach.get(a.uid).some(t => t[0] === x && t[1] === y)) out.push(`at ${x},${y}${where} ${a.uid}'s line can strike you`);
          }
          if (walks.has(a.uid) && walks.get(a.uid).some(p => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= N.SIGHT_EXHIBIT + 1 && AI.sees(you, Object.assign({}, a, { x: p.x, y: p.y }))))
            out.push(`at ${x},${y}${where} ${a.uid} sees you from its round`);
        }
        // The doors beside the zone, each opened once: who hears it.
        for (let dir = 0; dir < 8; dir++) {
          const dx = x + Grid.DX[dir], dy = y + Grid.DY[dir], c = Grid.ch(vm, dx, dy), key = dy * m.w + dx;
          if ((c !== '+' && c !== "'") || heard.has(key) || !Grid.canStep(vm, x, y, dir)) continue;
          heard.add(key);
          const t = Object.assign({}, vm, { tiles: vm.tiles.slice() });
          Grid.set(t, dx, dy, "'");
          const r = Noise.reach(t, dx, dy, N.NOISE_SOFT);
          for (const a of hearers) if (Actors.footprint(a).some(([u, w]) => { const e = Grid.reachDist(r, t, u, w, 'noise'); return e >= 0 && e <= N.NOISE_SOFT; }))
            out.push(`${a.uid} hears the door at ${dx},${dy}${where} opened`);
        }
      }
    }
    return out;
  }

  function each(d) {
    const { state: s, acc, seed, depth } = d;
    tally[acc]++;
    const no = LV6.check(s, null);
    if (no) {
      const g = Dept.generate(seed, acc, depth);
      if (!(g.fallback && g.rejected && g.rejected.id === 'lv6')) return `LV6 rejects the department made: ${no.reason}`;
      tally.fallback[acc]++;
      return null;
    }
    if (seed <= ORACLE_SEEDS) tally.oracle++;
    const out = oracle(s, seed <= ORACLE_SEEDS);
    return out.length ? `LV6 passes it, but ${out.slice(0, 3).join('; ')}` : null;
  }

  function done() {
    const out = [];
    for (const acc of ['S9', 'A4', 'M11']) if (tally[acc] && tally.fallback[acc] * 100 > tally[acc]) out.push(`${acc}: LV6 sends ${tally.fallback[acc]} of ${tally[acc]} departments to the fallback, over 1%`);
    if (tally.oracle && !tally.tiles) out.push('the oracle stood on no tile');
    return out.length ? out.join('; ') : null;
  }
  return { each, done, tally };
};
