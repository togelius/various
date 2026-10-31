// ACCESSION — sentences: S.9's Centrepiece, completing_guardian (the Composite), with its limbs
// and its treasure (BUILD.md §3.4, §5.5), owned by COMPOSITE-CORE. M4's skeleton made it; M4's
// Wave 0 (W0a) gave the phase event's causes for the limbs their sentences. COMPOSITE-CORE
// fills the rest.
'use strict';
(() => {
  const isInt = Number.isInteger;
  const limbs = (e, sep) => isInt(e.stage) ? `${sep} it has ${Text.count(e.stage, 'limb')}` : '';
  const whose = (w, uid) => uid === 'you' ? 'your' : `${w.name(uid)}’s`;
  Text.defineCause('phase', 'walked', (e, w) => `${w.Name(e.who)} grew a limb${isInt(e.cause.n) ? `, for the ${Text.count(e.cause.n, 'gallery')} you have walked` : ''}${limbs(e, ':')}.`);
  Text.defineCause('phase', 'left', (e, w) => `You left ${whose(w, e.who)} hall while it hunted you, so it healed ${N.GUARDIAN_LEAVE_HEAL_PCT}% of its maximum health and dropped a limb${limbs(e, ';')}.`);
})();
