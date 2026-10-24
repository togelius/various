// ACCESSION — the marble modifier's hooks (BUILD.md §5.1, §5.3, §8.1; rules/archetypes.js),
// owned by W1-ARCH-A. Its Behaviour-line clause and registry entry are in js/core/reg/arch-a.js.
//
// "Moves at half speed." Marble needs no hook: its slowness is the registry's
// Registry.MODIFIERS.marble.speed, 'slow', which Actors.speedOf counts at spawn (§8.1), so a
// marble body's steps cost SPEED_SLOW_PCT% of the usual and its blows the usual; a fast
// archetype with marble moves at the usual speed. A costPct for moves here would double it
// again. Switched off for a visit (rulesOff, passed to Setup.room or Dept.create), it is off
// from the spawn on, since the speed is fixed then.
'use strict';
(() => {
  Archetypes.addModifier('marble', {});
})();
