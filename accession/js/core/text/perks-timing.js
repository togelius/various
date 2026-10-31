// ACCESSION — sentences: the perks Duck and Cover and Close the Distance (BUILD.md §3.4, §8.1,
// §8.7), owned by PG-PERKS-TIMING. M4's skeleton made it; M4's Wave 0 (W0a) gave their
// activations their sentences. PG-PERKS-TIMING fills the rest.
'use strict';
(() => {
  Text.defineCause('perk', 'duck', () => `Duck and Cover: a special missed you, so your next action costs ${Text.count(N.PERK_DUCK_AND_COVER, 'tick')} less.`);
  Text.defineCause('perk', 'sure', () => 'Duck and Cover: your next attack is a surprise attack.');
  Text.defineCause('perk', 'close', (e, w) => e.cause.by !== undefined
    ? `Close the Distance: your step toward ${w.name(e.cause.by)} cost no time.`
    : 'Close the Distance: your step cost no time.');
})();
