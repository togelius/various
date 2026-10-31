// ACCESSION — sentences: viewing the Centrepiece: the viewed event and the refusals of view
// (BUILD.md §3.4, §4.2, §8.7), owned by PG-VIEW. M4's skeleton made it, with the sentence of the
// one refusal the skeleton's `view` gives. M4's Wave 0 (W0a) moved here the viewed event's
// sentence, counting turns as a player reads them ("1 of 4 turns"). PG-VIEW fills the rest.
'use strict';
(() => {
  Text.defineRefusal('no_centrepiece', () => 'There is no Centrepiece here to view.');
  const viewed = (e, w) => Number.isInteger(e.n)
    ? `${w.Name(e.who)} viewed ${w.name(e.of)}: ${e.n} of ${Text.count(N.VIEW_TURNS, 'turn')}.`
    : `${w.Name(e.who)} viewed ${w.name(e.of)}.`;
  Text.define('viewed', viewed);
  Text.defineCause('viewed', 'view', viewed);
  // PG-VIEW fills: the other refusals' sentences.
})();
