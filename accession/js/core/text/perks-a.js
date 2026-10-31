// ACCESSION — sentences: the perks Soft Soles, Vanishing Act and Light Fingers (BUILD.md §3.4,
// §8.7), owned by PG-PERKS-A. M4's skeleton made it; M4's Wave 0 (W0a) gave Vanishing Act's lost
// cause its sentence. PG-PERKS-A fills the rest.
'use strict';
(() => {
  Text.defineCause('lost', 'vanished', (e, w) => `${w.Name(e.who)} lost sight of you and searches at once where it last knew you were: Vanishing Act.`);
})();
