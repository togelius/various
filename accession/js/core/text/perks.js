// ACCESSION — sentences: the perks: their table, their families and the order a slot falls back
// in, and the perk event (BUILD.md §3.4, §8.7), owned by PG-CORE. M4's skeleton made it; M4's
// Wave 0 (W0a) moved here the perk event's sentence, naming a perk by its name (Registry.PERKS),
// never its id, and gave each cause its own. PG-CORE fills the rest.
'use strict';
(() => {
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  // A perk's name, or "a perk" for an id the table does not hold.
  const name = id => own(Registry.PERKS, id) && typeof Registry.PERKS[id].name === 'string' ? Registry.PERKS[id].name : null;
  const rank = e => Number.isInteger(e.rank) && e.rank > 1 ? `, at rank ${e.rank}` : '';
  const held = e => name(e.id) ? `You hold ${name(e.id)}${rank(e)}.` : 'You hold a perk.';
  Text.define('perk', held);
  Text.defineCause('perk', 'chosen', e => name(e.id) ? `You took the perk ${name(e.id)}${rank(e)}.` : 'You took a perk.');
  Text.defineCause('perk', 'none', () => 'No perk was offered: you already hold every perk at its highest rank.');

  // A perk's own damage and statuses, by its name.
  const by = c => name(c.id) || 'a perk';
  Text.defineCause('damaged', 'perk', (e, w) => `${w.Name(e.who)} took ${e.amount} damage from ${by(e.cause)}${e.cause.saved ? '. You were kept at 1 health' : ''}.`);
  const word = id => own(Registry.STATUSES, id) && Registry.STATUSES[id].words ? Registry.STATUSES[id].words : 'affected';
  Text.defineCause('status', 'perk', (e, w) => e.on
    ? `${w.Name(e.who)} ${w.is(e.who)} now ${word(e.id)}${Number.isInteger(e.turns) ? ' for ' + Text.count(e.turns, 'turn') : ''}: ${by(e.cause)}.`
    : `${w.Name(e.who)} ${w.is(e.who)} no longer ${word(e.id)}.`);
})();
