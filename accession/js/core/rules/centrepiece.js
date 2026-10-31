// ACCESSION — what every Centrepiece shares (BUILD.md §5.5, §8.7; plan A8): its placement, its
// pieces, its form ('fight' or 'treasure') and what a piece's fall does. M4's skeleton made
// each function with its signature; ARCH-CP-CORE fills them. Each Centrepiece's own rules
// are its archetype's file (rules/arch/completing_guardian.js, mp_ensemble.js, mp_tableau.js).
'use strict';
const Centrepiece = (() => {
  // ARCH-CP-CORE fills: place the pack's Centrepiece on the plan's cpl and write dept.cp.
  function place(state, plan, pack) {}

  // Its pieces, in the order dept.cp lists them, fallen ones included; [] with none placed.
  function pieces(state) {
    const cp = Hall.cp(state);
    if (!cp || !cp.uids) return [];
    const out = [];
    for (const uid of cp.uids) { const a = Actors.byUid(state, uid); if (a) out.push(a); }
    return out;
  }

  // ARCH-CP-CORE fills: 'fight' or 'treasure', or null with no Centrepiece.
  function form(state) { return null; }

  // ARCH-CP-CORE fills: after piece a fell: phases, inheritance, the drop and the award.
  function onPieceDied(state, a, ev) {}

  return { place, pieces, form, onPieceDied };
})();
