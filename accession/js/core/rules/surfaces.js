// ACCESSION — surfaces on the floor (BUILD.md §8.1, §8.6): a Fumigant cloud, plaster dust.
// Each is { kind, x, y, size, until, by } in dept.surfaces, in the order laid, covering the
// size × size square centred on its tile (Grid.covers); a sight-blocking kind
// (Registry.SURFACES[kind].blocksSight) blocks line of sight across it (Grid.los), both ways,
// and stops a beam (Ranged.beam). W0e built add, at and expiry; W1-STATUS owns the file after
// M3's Wave 0 and adds what a surface does at turn boundary step 1:
//   fumigant  each sleeping exhibit inside it loses 1 pip a turn (Wake.addPips, cause
//             fumigant: at most one a turn, however many clouds cover it);
//   dust      nothing but blocking sight.
'use strict';
const Surfaces = (() => {
  // Lay a surface of `kind` centred on (x, y), size tiles a side, for `turns` turns, made by
  // `by` (a uid, or null). A surface of N turns acts at the next N turn boundaries and is
  // cleared at the boundary after them (§8.1): until = the current turn + 1 + N. Laying one
  // makes no event. Returns the surface.
  function add(state, kind, x, y, size, turns, by, ev) {
    const S = Registry.SURFACES[kind];
    if (!S) throw new Error(`Surfaces.add: no surface ${kind}`);
    if (!Number.isInteger(size) || size < 1 || !Number.isInteger(turns) || turns < 1) throw new Error(`Surfaces.add: ${kind} of size ${size} for ${turns} turns`);
    const m = state.dept;
    if (!m.surfaces) m.surfaces = [];
    const s = { kind, x, y, size, until: state.turn + 1 + turns, by: by === undefined ? null : by };
    m.surfaces.push(s);
    return s;
  }

  // The surfaces that cover (x, y), in the order they were laid.
  const at = (state, x, y) => ((state.dept && state.dept.surfaces) || []).filter(s => Grid.covers(s, x, y));

  // Does surface s cover any tile of a's footprint? An exhibit is inside a cloud if any tile
  // it stands on is (as it is in your ring if any tile is, §8.2).
  function over(s, a) {
    for (const [x, y] of Actors.footprint(a)) if (Grid.covers(s, x, y)) return true;
    return false;
  }

  // What each kind does at the boundary, to what stands in it: EFFECTS[kind](state, s, ev).
  const EFFECTS = {
    // Every sleeping exhibit inside loses a pip (§8.6), in spawn order. Wake.addPips takes
    // nothing from one with none, nor from a pipless one (a mimic in its disguise), and takes
    // at most one a turn for the cause, so two clouds over one sleeper take one pip.
    fumigant(state, s, ev) {
      const cause = s.by === null || s.by === undefined ? { k: 'fumigant' } : { k: 'fumigant', by: s.by };
      for (let i = 1; i < state.actors.length; i++) {
        const a = state.actors[i];
        if (a.gone || a.mode !== 'dormant' || !a.pips || !over(s, a)) continue;
        Wake.addPips(state, a, -1, cause, ev);
      }
    },
  };

  // Turn boundary step 1 (§8.1): first every surface whose time is up is cleared (until ≤ the
  // turn); then each surface left acts on what stands in it, in the order laid.
  function tick(state, ev) {
    const m = state.dept;
    if (!m.surfaces || !m.surfaces.length) return;
    if (m.surfaces.some(s => s.until <= state.turn)) m.surfaces = m.surfaces.filter(s => s.until > state.turn);
    for (const s of m.surfaces.slice()) if (Object.prototype.hasOwnProperty.call(EFFECTS, s.kind)) EFFECTS[s.kind](state, s, ev);
  }

  return { add, at, tick, EFFECTS };
})();
