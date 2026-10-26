// ACCESSION — the mote_swarm archetype's hooks (BUILD.md §5.1, §5.3, §5.5, §8.1;
// rules/archetypes.js), owned by W1-ARCH-A. Its Behaviour-line clause and registry entry are
// in js/core/reg/arch-a.js.
//
// "Comes as several bodies that each fall to a single hit; they move two tiles a turn and
// strike from beside you for {dmg}."
//   - A department places a swarm as SWARM_BODIES[0] bodies (Dept.create, §5.5), each its own
//     exhibit, so they wake, move and strike one by one.
//   - Any hit destroys a body: whatever damage reaches it (a blow, a shot, a beam, a ring,
//     an item), its health is what it loses (Archetypes.adjustDamage, before health falls).
//     Its role's health (ROLE_SWARM_HP) is shown on the label only, and its odds readout says
//     it needs 1 hit (the readout hook's {k: 'hits', n: 1}).
//   - It is fast (the registry's speed): its steps cost half, its blows the usual (§8.1);
//     otherwise it acts as its mode says (AI.byMode), as a plodder does.
'use strict';
(() => {
  Archetypes.add('mote_swarm', {
    speedApplies: a => ['move'],
    adjustDamage: (state, def, amount, cause) => amount > 0 ? def.hp : amount,
    // The odds readout's lines (Archetypes.readout, read by Labels): any hit destroys a body,
    // so it needs 1 hit, whatever its health.
    readout: () => [{ k: 'hits', n: 1 }],
  });
})();
