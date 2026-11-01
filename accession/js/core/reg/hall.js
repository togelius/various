// ACCESSION — registry fragment: the Centrepiece hall: its seal, the shutters' refusal and the
// stage causes (BUILD.md §5.1, §8.4), owned by ARCH-HALL. M4's skeleton made it; M4's Wave 0
// (W0a) gave the stage event its cause for the hall (M4 plan A5).
'use strict';
(() => {
  const R = Registry;

  // The hall's stages (§4.3's stage, §8.4): `sealed` (the shutters closed over its openings),
  // `unsealed` (they opened) and `waiting` (it would seal, but someone stands in an opening,
  // M4 plan A13). by: what calls for the seal, if its rule names one (sealed and waiting: the
  // piece whose hunt calls for it), so the stage is that exhibit's doing, which its line
  // covers; in (waiting only): who stands in the opening, only when you see it then, so no
  // sentence names an exhibit out of your sight and no exhibit that merely stands in the way
  // is held to cause a stage; why: what called for the seal (`hunt` for a fight's), or what
  // opened the shutters: `quiet` (SEAL_LIFT_TURNS turns in a row in which the Centrepiece
  // neither hurt you nor ended a turn beside you), `ticket`, `defeat`, `treasure` (a
  // treasure's guardian fell), `sheet` (it went under its dust sheet) or `alone` (none of it
  // standing is left in the hall).
  R.defineCause('stage', 'hall', { fields: { by: 'uid?', in: 'uid?', why: 'str' }, built: 'M4' });

  // A Re-admission Ticket read while the hall is sealed (§8.4): each piece of the Centrepiece
  // still standing regains SEAL_HEAL_PCT of its maximum health (healed) and, unless asleep,
  // goes back to its place (lost, to returning); why says what opened the shutters (ticket).
  R.defineCause('healed', 'hall', { fields: { why: 'str' }, built: 'M4' });
  // how: 'stands' for one that never steps, which settles where it stands (Wake.stands, M4
  // TABLEAU-CORE).
  R.defineCause('lost', 'hall', { fields: { why: 'str', how: 'str?' }, built: 'M4' });

  // A step into a shutter, or a take of an item lying under one, while the hall is sealed
  // (§4.2; rules/hall.js's refuser), made to happen by real actions at depths 1–7.
  R.define('REFUSALS', 'sealed', { built: 'M4', ready: true, tests: ['behaviour/refusals-hall.test.js'], inv: 'system' });
})();
