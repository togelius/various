// ACCESSION — Certificates, the grade and the perk offer (BUILD.md §8.7), and the visitor of a
// single visit (§5.5). M4's skeleton made each function with its signature and a neutral
// body; the package named beside it fills it. Until then nothing calls them.
//
// The parts it owns are absent from a state until it first writes them, and read through
// Progress.cert (dept.cert {how, turn}; dept.offer, an offer waiting behind another choice).
'use strict';
const Progress = (() => {
  // The visitor of a single visit at depth d: grade min(GRADE_MAX, d), the lower tier on
  // offer at d, no perks and no items (BUILD.md §5.5 once W0c states it).
  // W0c fills: {grade, perks, tier, items} at depth d.
  function median(depth) { return null; }

  // The department's Certificate, earned by `how` ('defeat', 'view' or 'treasure'), once a
  // visit, with its grade, health, heal and offer.
  // PG-CORE fills: award it; true if it was awarded.
  function award(state, how, cause, ev) { return false; }

  // PG-CORE fills: after a choice is answered, raise the offer waiting behind it.
  function afterChoice(state, ev) {}

  // PG-CORE fills: the perks offered now, [{id, rank}], drawn on perks/<acc>/d<depth>.
  function offer(state) { return []; }

  // W0c fills: this visit's Certificate, {how, turn}, or null.
  function cert(state) { return null; }

  return { median, award, afterChoice, offer, cert };
})();
