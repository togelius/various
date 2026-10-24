// ACCESSION — the marble modifier's hooks (BUILD.md §5.1, §5.3; rules/archetypes.js), owned by
// W1-ARCH-A. Its Behaviour-line clause and registry entry are in js/core/reg/.
'use strict';
(() => {
  // [stub → W1-ARCH-A] Marble's slowness is already built: Registry.MODIFIERS.marble.speed is
  // 'slow', counted by Actors.speedOf at spawn (§8.1), so a marble step costs 2×. Do not add
  // a costPct for moves, which would double it again; switch it off with rulesOff passed to
  // Setup.room, since the speed is fixed at spawn.
  Archetypes.addModifier('marble', {});
})();
