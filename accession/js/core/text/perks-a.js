// ACCESSION — sentences: the perks Soft Soles, Vanishing Act and Light Fingers (BUILD.md §3.4,
// §8.7), owned by PG-PERKS-A. M4's skeleton made it; M4's Wave 0 (W0a) gave Vanishing Act's lost
// cause its sentence. PG-PERKS-A filled the rest. A perk is named by its name, never its id.
//
// Soft Soles and Light Fingers make no event of their own: a smaller ring gives fewer ring pips,
// and a quiet opening is the case's own event with no noise after it. Vanishing Act's hunter
// loses you with the cause vanished; at the second rank the staggered status it then puts on
// is the status event's perk cause (text/perks.js), "… is now staggered for 1 turn: Vanishing Act."
'use strict';
(() => {
  // One in an intact case (its cause's how: 'case') only waits there (§8.3): it never searches
  // where it last knew you were.
  const cased = e => !!e.cause && e.cause.how === 'case';
  Text.defineCause('lost', 'vanished', (e, w) => cased(e)
    ? `${w.Name(e.who)} lost sight of you and stops hunting at once, but stays in its case: Vanishing Act.`
    : `${w.Name(e.who)} lost sight of you and searches at once where it last knew you were: Vanishing Act.`);
})();
