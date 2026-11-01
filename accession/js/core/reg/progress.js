// ACCESSION — registry fragment: Certificates and the grade (BUILD.md §5.1, §8.7), owned by
// PG-CORE. M4's skeleton made it; M4's Wave 0 (W0a) moved here, from reg/system.js, the
// certificate and grade events, with the schemas and causes of M4 plan A5, and the healed
// event's cause for a Certificate.
'use strict';
(() => {
  const R = Registry;

  // A Certificate (§8.7): the department's (acc) and how it was earned (how: 'defeat', 'view'
  // or 'treasure', as its cause): `defeat` (by: the Centrepiece defeated), `view`, `treasure`
  // (the Lamp carried out of its hall). Progress.award emits it, once a visit.
  R.defineEvent('certificate', { fields: { acc: 'str', how: 'str' }, built: 'M4' });
  R.defineCause('certificate', 'defeat', { fields: { by: 'uid?' }, built: 'M4' });
  R.defineCause('certificate', 'view', { fields: {}, built: 'M4' });
  R.defineCause('certificate', 'treasure', { fields: {}, built: 'M4' });

  // Your grade after a Certificate (§8.7): `certificate`, raised by one, with HP_PER_GRADE more
  // maximum health; `highest`, already GRADE_MAX, so it stays where it is (the Certificate
  // gives its heal and its perk only), and the log says why the badge did not change.
  R.defineEvent('grade', { fields: { grade: 'int' }, built: 'M4' });
  R.defineCause('grade', 'certificate', { fields: {}, built: 'M4' });
  R.defineCause('grade', 'highest', { fields: {}, built: 'M4' });
  // The health a Certificate heals (CERT_HEAL), after your maximum has risen.
  R.defineCause('healed', 'certificate', { fields: {}, built: 'M4' });
})();
