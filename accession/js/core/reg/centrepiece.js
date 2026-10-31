// ACCESSION — registry fragment: what every Centrepiece shares: its specials, its phases (the
// phase event) and its wake (BUILD.md §5.1, §5.5, §8.1), owned by ARCH-CP-CORE. M4's skeleton
// made it; M4's Wave 0 (W0a) gave it the phase event, the one kind M4 adds to §4.3 (M4 plan A5),
// with its cause for damage, and the dropped event's cause for a defeat. ARCH-CP-CORE fills the
// rest.
'use strict';
(() => {
  const R = Registry;

  // A Centrepiece's phase (§4.3, §5.5): who (a piece of it), the phase it is now in (1, 2 or
  // 3: CP_PHASE_PCT), the Composite's stage (its limbs) where that changed, and the special it
  // gained (gained, a SPECIALS id) where it gained one. Its causes: `damaged` (its health fell
  // past a threshold) here; `walked` and `left` (the Composite's limbs) in reg/cp-guardian.js;
  // `inherited` (an Ordinance piece taking on a fallen one's special) in reg/cp-ensemble.js.
  R.defineEvent('phase', { fields: { who: 'uid', phase: 'int', stage: 'int?', gained: 'str?' }, built: 'M4' });
  R.defineCause('phase', 'damaged', { fields: { by: 'uid?' }, built: 'M4' });

  // A defeated Centrepiece's Signature piece drops on its anchor tile (§8.7): who (the
  // Centrepiece's last piece), the item; `by`, who defeated it.
  R.defineCause('dropped', 'defeated', { fields: { by: 'uid?' }, built: 'M4' });
})();
