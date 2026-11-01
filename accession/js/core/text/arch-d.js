// ACCESSION — sentences: the conservator_healer archetype and the clockwork modifier (BUILD.md
// §3.4, §5.1, §5.5), owned by ARCH-CLOCKWORK. M4's skeleton made it; they had no sentence to
// move here (M4's Wave 0). The restore's mark and its going off are told as every special's are
// (text/combat.js: its noun, "restore", and its marks, "an ally"); clockwork's moves are steps,
// blows, marks and waits, told as any exhibit's are.
'use strict';
(() => {
  // Healing by a restore: who restored whom, and how much, with the health it now has.
  Text.defineCause('healed', 'restore', (e, w) => `${w.Name(e.cause.by)} restored ${e.amount} health to ${w.name(e.who)}: now ${e.hp}.`);
})();
