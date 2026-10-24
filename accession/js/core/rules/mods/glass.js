// ACCESSION — the glass modifier's hooks (BUILD.md §5.1, §5.5, §8.3; rules/archetypes.js), owned
// by W1-ARCH-B. Its Behaviour-line clause and registry entry are in js/core/reg/arch-b.js.
//
// A glass body (the Heliographs):
//   - when it is destroyed, leaves shards (`x`) where Cases.shardTile says, the one shard
//     rule (§8.3): on its own tile if that is floor or an archway, otherwise on the first such
//     neighbour in direction order, otherwise nowhere, so never over a door, an exit, the
//     entrance, a bench or a case. Shards are a loud floor (§8.2);
//   - sends beams and bolts back along their line, as a reflector does: Ranged.isReflector
//     counts a body with this modifier, unless it is switched off (rulesOff).
// Switched off (rulesOff), it does neither.
'use strict';
(() => {
  function onDied(state, a, cause, ev) {
    const t = Cases.shardTile(state, a.x, a.y);
    if (t) Grid.set(state.dept, t[0], t[1], 'x');
  }
  Archetypes.addModifier('glass', { onDied });
})();
