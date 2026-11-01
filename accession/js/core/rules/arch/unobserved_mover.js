// ACCESSION — the unobserved_mover archetype's hooks (S.9's Grazers; BUILD.md §5.1, §5.3, §5.5,
// §8.2; rules/archetypes.js), owned by MOD-UNOBSERVED. Its registry entry is in
// js/core/reg/mod-unobserved.js and its sentences in js/core/text/mod-unobserved.js; the rule
// that makes it a Grazer is the module's, js/core/rules/modules/unobserved_motion.js.
//
// The rule, as its line says it ("{module:unobserved_motion|Walks a tile at a time}, and strikes
// from beside you for {dmg}."): with the module off, or for one not flagged with it, it is a
// plodder (AI.byMode): it walks a tile a turn, after you, to look, to wander and home, and
// strikes from beside you. With the module on for it, its slot holds the module's part, and
// each hook below asks the module (UnobservedMotion): its action (the gate in your sight, the
// stride and the stop on coming into view), whether it may step (not while you can see it),
// and what a step costs (UNOBSERVED_STEP steps a turn).
//
// Its wake region (plan A8; D-LV6's safe zone and the runner read it, so it must never hold
// fewer tiles than the truth): asleep, the default's ring (Archetypes.wakeRegion adds nothing
// here). Awake but not hunting you, the tiles where, standing for `turns` turns, you would be
// seen by it (AI.sees: within SIGHT_EXHIBIT of it, in line of sight), from anywhere it could
// stand at one of its actions by then: every tile within the steps it has the time for, at
// its quickest (each step at what a step costs it now, UNOBSERVED_STEP a turn while the module
// acts on it, else a tile a turn; no status slowing it), whatever it does on the way (an exhibit
// walking only while unseen, or going home and back to sleep, stands on no tile it could not
// walk to), and seeing through every door, since one may be opened by then (an ordinary door
// by anyone, a shutter by the hall lifting). Sleeping again at home within the time, its ring
// lies within that sight (RING_MOVING walking tiles are fewer than SIGHT_EXHIBIT). In an
// intact case it only waits: its own tile. Hunting you, none: it has found you. It draws on
// no stream.
'use strict';
(() => {
  // Every tile you could stand on (walkable, not a closed door, none of a's own now) within
  // SIGHT_EXHIBIT of, and in line of sight from, a tile a could stand on at one of its actions
  // over the next `turns` turns (above).
  function wakeRegion(state, a, turns) {
    const m = state && state.dept;
    if (!m || !a || a.gone || a.mode === 'dormant' || a.mode === 'hunting' || !Number.isInteger(turns) || turns < 0) return [];
    // Where it may stand at its actions up to the horizon: within n steps of where it stands.
    const horizon = state.tick + turns * N.TICKS_PER_TURN, start = Math.max(a.next, state.tick);
    const step = Actors.cost(state, Object.assign({}, a, { statuses: [] }), N.COST_STEP, 'move');
    const n = Cases.encased(state, a) ? 0 : Int.idiv(horizon - start, Math.max(1, step));
    if (n < 0) return [];
    // Every door and shutter open: each may be by then, to walk through and to see through.
    const open = Object.assign({}, m, { surfaces: [], tiles: m.tiles.map(row => row.replace(/[+Z]/g, "'")) });
    const reach = Grid.distances(open, [[a.x, a.y]], n, null, 'exhibit');
    const r = N.SIGHT_EXHIBIT, s = a.size || 1, on = new Uint8Array(m.w * m.h), out = [];
    const mine = (x, y) => x >= a.x && y >= a.y && x < a.x + s && y < a.y + s;
    for (let k = 0; k < reach.length; k++) {
      if (reach[k] < 0) continue;
      const px = k % m.w, py = Int.idiv(k, m.w);
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
        const fx = px + dx, fy = py + dy;
        for (let y = Math.max(0, fy - r); y <= Math.min(m.h - 1, fy + r); y++) for (let x = Math.max(0, fx - r); x <= Math.min(m.w - 1, fx + r); x++) {
          const i = y * m.w + x;
          if (on[i] || !Grid.disc(x - fx, y - fy, r) || mine(x, y) || !Grid.walkable(m, x, y) || Grid.closedDoor(m, x, y)) continue;
          if (Grid.los(open, fx, fy, x, y)) on[i] = 1;
        }
      }
    }
    for (let i = 0; i < on.length; i++) if (on[i]) out.push([i % m.w, Int.idiv(i, m.w)]);
    return out;
  }

  Archetypes.add('unobserved_mover', {
    act: (state, a, ev) => UnobservedMotion.act(state, a, ev),
    mayStep: (state, a) => UnobservedMotion.mayStep(state, a),
    costPct: (state, a, kind) => UnobservedMotion.costPct(state, a, kind),
    wakeRegion,
  });
})();
