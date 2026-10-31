// ACCESSION — registry fragment: the Centrepiece hall: its seal, the shutters' refusal and the
// stage causes (BUILD.md §5.1, §8.4), owned by ARCH-HALL. M4's skeleton made it; M4's Wave 0
// (W0a) gave the stage event its cause for the hall (M4 plan A5). ARCH-HALL fills the rest.
'use strict';
(() => {
  const R = Registry;

  // The hall's stages (§4.3's stage, §8.4): `sealed` (the shutters closed over its openings),
  // `unsealed` (they opened) and `waiting` (it would seal, but someone stands in an opening,
  // M4 plan A13). by: the actor it is about, if any; why: what did it (for unsealed: 'quiet',
  // SEAL_LIFT_TURNS turns with no blow from the Centrepiece; 'ticket'; 'defeat'; 'treasure').
  R.defineCause('stage', 'hall', { fields: { by: 'uid?', why: 'str' }, built: 'M4' });
})();
