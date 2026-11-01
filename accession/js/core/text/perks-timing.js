// ACCESSION — sentences: the perks Duck and Cover and Close the Distance (BUILD.md §3.4, §8.1,
// §8.7), owned by PG-PERKS-TIMING. M4's skeleton made it; M4's Wave 0 (W0a) gave their
// activations their sentences; PG-PERKS-TIMING filled them. A perk is named by its name, never
// its id. Each says what the rule did, as js/core/rules/perks/{duck_and_cover,
// close_the_distance}.js does it:
//   - duck: a damaging special marked on your tile went off and missed you, so your next action
//     that takes time costs PERK_DUCK_AND_COVER ticks less (said once while it waits);
//   - sure: at the second rank, your next blow or shot at anything but the Night Watchman is
//     also a surprise attack (said once while it waits);
//   - close: your step toward an exhibit whose mark lay on the tile you left took no time, the
//     n-th of the free steps (of) the perk gives you toward it.
'use strict';
(() => {
  const isInt = Number.isInteger;
  Text.defineCause('perk', 'duck', () => `Duck and Cover: a special marked on your tile went off and missed you, so your next action that takes time costs ${Text.count(N.PERK_DUCK_AND_COVER, 'tick')} less.`);
  Text.defineCause('perk', 'sure', () => 'Duck and Cover: your next blow or shot at anything but the Night Watchman is also a surprise attack.');
  const which = c => isInt(c.n) && isInt(c.of) ? ` (free step ${c.n} of ${c.of} toward it)` : '';
  Text.defineCause('perk', 'close', (e, w) => e.cause.who !== undefined
    ? `Close the Distance: your step toward ${w.name(e.cause.who)}, whose special was marked on your tile, took no time${which(e.cause)}.`
    : 'Close the Distance: your step took no time.');
})();
