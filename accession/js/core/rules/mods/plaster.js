// ACCESSION — the plaster modifier's hooks (BUILD.md §5.1, §5.3, §8.1; rules/archetypes.js),
// owned by W1-ARCH-A. Its Behaviour-line clause and registry entry are in js/core/reg/arch-a.js.
//
// "A cast: it has {PLASTER_HP_PCT}% of the usual health, and when destroyed it crumbles into
// dust that blocks sight round it for {PLASTER_DUST_TURNS} turns."
//   - init (as the room or department is made, Setup.settleActors): its health and maximum
//     health become PLASTER_HP_PCT% of what its role gave it, rounded down, at least 1. A
//     half split from a cast is made, not set up, so it keeps the cast's maximum health.
//   - onDied: a dust surface (Registry.SURFACES.dust, which blocks sight) is laid on its tile,
//     PLASTER_DUST_SIZE tiles a side, for PLASTER_DUST_TURNS turns (Surfaces.add: it lies
//     through the next PLASTER_DUST_TURNS turn boundaries and is cleared at the one after),
//     made by the cast itself (`by` its uid).
'use strict';
(() => {
  const cast = v => Math.max(1, Int.pct(v, N.PLASTER_HP_PCT));
  Archetypes.addModifier('plaster', {
    init(state, a) { a.maxHp = cast(a.maxHp); a.hp = cast(a.hp); },
    onDied(state, a, cause, ev) { Surfaces.add(state, 'dust', a.x, a.y, N.PLASTER_DUST_SIZE, N.PLASTER_DUST_TURNS, a.uid, ev); },
  });
})();
