// ACCESSION — registry fragment: the perks: their families and the order a slot falls back in,
// and the perk event (BUILD.md §5.1, §8.7), owned by PG-CORE. M4's skeleton made it; M4's Wave 0
// (W0a) moved here, from reg/system.js, the perk event, with the schema and causes of M4 plan A5,
// and gave the damaged and status events their cause for a perk. Each perk's entry in
// Registry.PERKS (its name and family) is in its own package's fragment (reg/perks-a.js,
// reg/perks-b.js, reg/perks-timing.js), since an id has one owner; this file holds what the
// eight share: their families, as data that Progress.offer reads (rules/progress.js).
'use strict';

// The challenge families of the perks (§8.7; design/difficulty.md §5.1), as data:
//   WITH_PERKS  the families that hold slice perks, in §8.7's table order; a slot that falls
//               back to "any family" tries them in this order;
//   STAND_IN    the families a slot is filled from, in order, when its own has no slice perks
//               (S.9's missing secondary, locks, hazard): attrition, then guarded;
//   CHALLENGES  every challenge type a pack's card may claim as its primary or secondary
//               (claim.primary, claim.secondary; a secondary may be null).
// Every Registry.PERKS entry's family is one of WITH_PERKS, and each of WITH_PERKS has a perk
// (test/m4-offer.test.js).
const PerkFamilies = Object.freeze({
  WITH_PERKS: Object.freeze(['guarded', 'swarm', 'artillery', 'attrition']),
  STAND_IN: Object.freeze(['attrition', 'guarded']),
  CHALLENGES: Object.freeze(['swarm', 'artillery', 'guarded', 'darkness', 'hazard', 'locks', 'attrition', 'social']),
});

(() => {
  const R = Registry;

  // A perk (§8.7): which (id, a PERKS id) and at what rank. Causes: `chosen` (you took it from
  // an offer) and `none` (no perk could be offered, so none is given: id and rank absent) here;
  // a perk's own activations in its package's fragment.
  R.defineEvent('perk', { fields: { id: 'str?', rank: 'int?' }, built: 'M4' });
  R.defineCause('perk', 'chosen', { fields: {}, built: 'M4' });
  R.defineCause('perk', 'none', { fields: {}, built: 'M4' });

  // Damage and statuses a perk deals (Single File's), with the perk's id; a damaged cause may
  // carry saved and side, as every one does (lint-registry).
  R.defineCause('damaged', 'perk', { fields: { id: 'str', saved: 'int?', side: 'str?' }, built: 'M4' });
  R.defineCause('status', 'perk', { fields: { id: 'str' }, built: 'M4' });
})();
