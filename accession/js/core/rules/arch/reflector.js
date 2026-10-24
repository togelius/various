// ACCESSION — the reflector archetype's hooks (BUILD.md §5.1, §5.3, §8.1; rules/archetypes.js),
// owned by W1-ARCH-B. Its Behaviour-line clause and registry entry are in js/core/reg/arch-b.js.
//
// A reflector walks and strikes as a plodder does (AI.byMode), with its role's damage (a
// controller's: weak in a fight), so it needs no hook of its own. What makes it a reflector
// is in js/core/rules/ranged.js: Ranged.reflectorAt finds it on its tile, so a beam that
// reaches it turns back along its line (Ranged.beam) and a bolt that meets it comes back and
// hits its shooter (Ranged.flight, Ranged.shoot); nothing behind it is hit. It sends back
// what its allies fire too. A beam's tiles include its own, so a beam it sends back strikes
// it as it strikes everything on its marked tiles; a bolt never does, since it turns back.
'use strict';
(() => {
  Archetypes.add('reflector', {});
})();
