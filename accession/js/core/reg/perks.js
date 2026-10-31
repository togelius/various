// ACCESSION — registry fragment: the perks: their table, their families and the order a slot
// falls back in, and the perk event (BUILD.md §5.1, §8.7), owned by PG-CORE. M4's skeleton made
// it; M4's Wave 0 (W0a) moved here, from reg/system.js, the perk event, with the schema and causes
// of M4 plan A5, and gave the damaged and status events their cause for a perk. Each perk's
// entry in Registry.PERKS (its name and family) is in its own package's fragment
// (reg/perks-a.js, reg/perks-b.js, reg/perks-timing.js). PG-CORE fills the rest.
'use strict';
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
