// ACCESSION — surfaces on the floor (BUILD.md §8.6): a Fumigant cloud, plaster dust. Each is
// { kind, x, y, size, until, by } in dept.surfaces, covering the size × size square centred on
// its tile (Grid.covers); a sight-blocking one blocks line of sight (Grid.los).
// W0c leaves turn boundary step 1 here, empty; W0e builds add, at and expiry, and W1-STATUS
// the effects.
'use strict';
const Surfaces = (() => {
  // Turn boundary step 1 (§8.1): surfaces expire, and act on what stands in them.
  function tick(state, ev) {}
  return { tick };
})();
