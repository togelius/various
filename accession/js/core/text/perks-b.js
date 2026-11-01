// ACCESSION — sentences: the perks Single File, Elbow Room and Second Wind (BUILD.md §3.4, §8.7),
// owned by PG-PERKS-B. M4's skeleton made it; M4's Wave 0 (W0a) gave Single File's and Second
// Wind's causes their sentences. PG-PERKS-B filled the rest. A perk is named by its name, never
// its id.
//
// Single File tells its step (the perk event, cause single_file), and what follows is told by
// its own events: at the second rank the damage (damaged, cause perk: "… took 3 damage from
// Single File."), then the staggered status (status, cause perk: "… is now staggered for 1
// turn: Single File."), each in text/perks.js; so no sentence promises a lost action to an
// exhibit the damage destroyed. Elbow Room makes no event: its Padding is your Padding, on your
// label. Second Wind tells its coming with what it heals in all (the perk event, cause wind),
// then its status and each share (text/perk-status.js).
'use strict';
(() => {
  // Destroyed by a perk's damage (Single File's at the second rank), by the perk's name.
  const perkName = c => Object.prototype.hasOwnProperty.call(Registry.PERKS, c.id) && Registry.PERKS[c.id].name ? Registry.PERKS[c.id].name : 'a perk';
  Text.defineCause('died', 'perk', (e, w) => e.who === 'you' ? `You fell to ${perkName(e.cause)}.` : `${w.Name(e.who)} broke apart under ${perkName(e.cause)}.`);
  Text.defineCause('perk', 'single_file', (e, w) => e.cause.who !== undefined
    ? `Single File: ${w.name(e.cause.who)} stepped into a doorway beside you.`
    : 'Single File: an exhibit stepped into a doorway beside you.');
  // Second Wind at rank 1 or 2 heals PERK_SECOND_WIND_PCT[rank − 1]% of your maximum health,
  // `total` in all, over PERK_SECOND_WIND_TURNS turns from your next decision.
  const pct = e => Number.isInteger(e.rank) && e.rank >= 1 && e.rank <= N.PERK_SECOND_WIND_PCT.length ? `${N.PERK_SECOND_WIND_PCT[e.rank - 1]}% of your maximum health` : 'a share of your maximum health';
  const heals = e => Number.isInteger(e.cause.total) ? `${e.cause.total} health (${pct(e)})` : pct(e);
  Text.defineCause('perk', 'wind', e => `Second Wind: you fell below ${N.PERK_SECOND_WIND_BELOW_PCT}% of your maximum health, so from your next action you heal ${heals(e)} over ${Text.count(N.PERK_SECOND_WIND_TURNS, 'turn')}.`);
})();
