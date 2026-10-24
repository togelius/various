// ACCESSION — surfaces on the floor (BUILD.md §8.1, §8.6): a Fumigant cloud, plaster dust.
// Each is { kind, x, y, size, until, by } in dept.surfaces, in the order laid, covering the
// size × size square centred on its tile (Grid.covers); a sight-blocking kind
// (Registry.SURFACES[kind].blocksSight) blocks line of sight across it (Grid.los).
// W0e builds add, at and expiry; W1-STATUS the surfaces' effects at turn boundary step 1.
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

  // Turn boundary step 1 (§8.1): first every surface whose time is up is cleared (until ≤ the
  // turn); then, [stub → W1-STATUS], each surface left acts on what stands in it.
  function tick(state, ev) {
    const m = state.dept;
    if (!m.surfaces || !m.surfaces.length) return;
    if (m.surfaces.some(s => s.until <= state.turn)) m.surfaces = m.surfaces.filter(s => s.until > state.turn);
  }

  return { add, at, tick };
})();
