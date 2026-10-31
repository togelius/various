// ACCESSION — registry fragment: Certificates and the grade (BUILD.md §5.1, §8.7), owned by
// PG-CORE. M4's skeleton made it; M4's Wave 0 (W0a) moved here, from reg/system.js, the
// certificate and grade events, with the schemas and causes of M4 plan A5, and the healed
// event's cause for a Certificate. PG-CORE fills the rest.
'use strict';
(() => {
  const R = Registry;

  // A Certificate (§8.7): the department's (acc) and how it was earned (how: 'defeat', 'view'
  // or 'treasure', as its cause): `defeat` (by: the Centrepiece defeated), `view`, `treasure`
  // (the Lamp carried out of its hall).
  R.defineEvent('certificate', { fields: { acc: 'str', how: 'str' }, built: 'M4' });
  R.defineCause('certificate', 'defeat', { fields: { by: 'uid?' }, built: 'M4' });
  R.defineCause('certificate', 'view', { fields: {}, built: 'M4' });
  R.defineCause('certificate', 'treasure', { fields: {}, built: 'M4' });

  // Your grade, raised by a Certificate (§8.7), and the health a Certificate heals.
  R.defineEvent('grade', { fields: { grade: 'int' }, built: 'M4' });
  R.defineCause('grade', 'certificate', { fields: {}, built: 'M4' });
  R.defineCause('healed', 'certificate', { fields: {}, built: 'M4' });
})();
