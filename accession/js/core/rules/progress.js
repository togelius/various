// ACCESSION — Certificates, the grade and the perk offer (BUILD.md §8.7), and the visitor of a
// single visit (§5.5). M4's skeleton made each function with its signature and a neutral
// body; the package named beside it fills it. Dept.create reads median (W0c); until PG-CORE
// fills them nothing calls the others.
//
// The parts it owns are absent from a state until it first writes them, and read through
// Progress.cert (dept.cert {how, turn}; dept.offer, an offer waiting behind another choice).
'use strict';
const Progress = (() => {
  // The visitor of a single visit at depth d (BUILD.md §5.5; M4 plan A2), the visitor
  // MEDIAN_MAX_HP and the M3 arenas assume (Arena.gradeAt): grade GRADE_START + d − 1, at most
  // GRADE_MAX, with that grade's health; a Balanced weapon and a Standard garment of the lower
  // tier on offer at d (TIER_LOW_BY_DEPTH); no perks and no items. At depth 1 it is the
  // visitor at a run's start. A fresh record each call. {grade, perks, tier, items}.
  function median(depth) {
    if (!Number.isInteger(depth) || depth < 1 || depth > N.TIER_LOW_BY_DEPTH.length) throw new Error(`Progress.median: there is no depth ${depth} (1–${N.TIER_LOW_BY_DEPTH.length})`);
    return { grade: Math.min(N.GRADE_MAX, N.GRADE_START + depth - 1), perks: [], tier: N.TIER_LOW_BY_DEPTH[depth - 1], items: [] };
  }

  // The department's Certificate, earned by `how` ('defeat', 'view' or 'treasure'), once a
  // visit, with its grade, health, heal and offer.
  // PG-CORE fills: award it; true if it was awarded.
  function award(state, how, cause, ev) { return false; }

  // PG-CORE fills: after a choice is answered, raise the offer waiting behind it.
  function afterChoice(state, ev) {}

  // PG-CORE fills: the perks offered now, [{id, rank}], drawn on perks/<acc>/d<depth>.
  function offer(state) { return []; }

  // This visit's Certificate, {how, turn}, or null before one is earned (dept.cert, absent
  // until PG-CORE's award writes it, M4 plan A3).
  function cert(state) { return state && state.dept && state.dept.cert ? state.dept.cert : null; }

  return { median, award, afterChoice, offer, cert };
})();
