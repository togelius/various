// ACCESSION — sentences: the perks Single File, Elbow Room and Second Wind (BUILD.md §3.4, §8.7),
// owned by PG-PERKS-B. M4's skeleton made it; M4's Wave 0 (W0a) gave Single File's and Second
// Wind's causes their sentences. PG-PERKS-B fills the rest.
'use strict';
(() => {
  Text.defineCause('perk', 'single_file', (e, w) => e.cause.by !== undefined
    ? `Single File: ${w.name(e.cause.by)} stepped into a doorway beside you, and loses its next action.`
    : 'Single File: an enemy stepped into a doorway beside you, and loses its next action.');
  // Second Wind at rank 1 or 2 heals PERK_SECOND_WIND_PCT[rank − 1]% of your maximum health.
  const pct = e => Number.isInteger(e.rank) && e.rank >= 1 && e.rank <= N.PERK_SECOND_WIND_PCT.length ? `${N.PERK_SECOND_WIND_PCT[e.rank - 1]}% of your maximum health` : 'some of your health';
  Text.defineCause('perk', 'wind', e => `Second Wind: you fell below ${N.PERK_SECOND_WIND_BELOW_PCT}% of your maximum health, and heal ${pct(e)} over ${Text.count(N.PERK_SECOND_WIND_TURNS, 'turn')}.`);
  Text.defineCause('healed', 'second_wind', (e, w) => `${w.Name(e.who)} healed ${e.amount} with Second Wind: now ${e.hp}.`);
})();
