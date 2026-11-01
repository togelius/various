// ACCESSION — sentences: viewing the Centrepiece and its dust sheet: the viewed event and the
// refusals of view and of the sheet (BUILD.md §3.4, §4.2, §8.7), owned by PG-VIEW. M4's
// skeleton made it, with the sentence of the one refusal its `view` gave; M4's Wave 0 (W0a)
// moved here the viewed event's sentence, counting turns as a player reads them ("1 of 4
// turns"). PG-VIEW gave each view the count still to come, and the last its dust sheet.
'use strict';
(() => {
  // A view (viewed {who, of, n}): the count so far, of VIEW_TURNS; then how many more turns of
  // viewing in a row earn the Certificate, with the rule that restarts the count said at the
  // first view of a row; or, at the last, that the view is complete and the Centrepiece is
  // under its dust sheet (rules/viewing.js: the Certificate's own sentences follow it). What
  // must sleep, and what the sheet covers, is the Centrepiece, every piece of it, so the
  // sentence says so, not "it": `of` names its first piece still standing, which for an
  // ensemble is one of several pieces, each with a name of its own (A.4's Ordinance; M4
  // ENSEMBLE-CORE's review).
  const T = () => N.VIEW_TURNS;
  function viewed(e, w) {
    if (!Number.isInteger(e.n) || e.n < 1) return `${w.Name(e.who)} viewed ${w.name(e.of)}.`;
    const so = `${w.Name(e.who)} viewed ${w.name(e.of)}: ${e.n} of ${Text.count(T(), 'turn')}.`;
    if (e.n >= T()) return `${so} The view is complete: a dust sheet now covers the Centrepiece for the night, and it will neither wake nor fight.`;
    const left = T() - e.n;
    const more = ` ${Text.count(left, 'more turn')} of viewing in a row while the Centrepiece sleeps ${left === 1 ? 'earns' : 'earn'} the Certificate.`;
    return e.n === 1 ? `${so}${more} Any other action that takes time starts the count again, and so does its waking.` : `${so}${more}`;
  }
  Text.define('viewed', viewed);
  Text.defineCause('viewed', 'view', viewed);

  // The refusals of view (Viewing.refusal), and of the dust sheet (its refuser).
  Text.defineRefusal('no_centrepiece', () => 'There is no Centrepiece here to view.');
  Text.defineRefusal('already_earned', () => 'You have this department’s Certificate already, and a visit gives only one: viewing cannot earn another.');
  Text.defineRefusal('not_at_lectern', () => 'You can view the Centrepiece only from the reading tile beside its lectern.');
  Text.defineRefusal('not_asleep', () => 'You can view the Centrepiece only while it sleeps, every piece of it, and it is not asleep now.');
  Text.defineRefusal('sheeted', () => 'The Centrepiece is under its dust sheet for the night: you cannot view it, strike it, step onto it or aim an instrument at it.');
})();
