// ACCESSION — sentences: Certificates and the grade (BUILD.md §3.4, §8.7), owned by PG-CORE. M4's
// skeleton made it; M4's Wave 0 (W0a) moved here the certificate and grade sentences, the grade
// in Roman numerals as the badge prints it (Text.grade), and gave each cause its own. PG-CORE
// fills the rest.
'use strict';
(() => {
  const earned = 'You earned this department’s Certificate';
  Text.define('certificate', () => `${earned}.`);
  Text.defineCause('certificate', 'defeat', (e, w) => e.cause.by !== undefined ? `${earned}: you defeated ${w.name(e.cause.by)}.` : `${earned}: you defeated its Centrepiece.`);
  Text.defineCause('certificate', 'view', () => `${earned}: you viewed its Centrepiece.`);
  Text.defineCause('certificate', 'treasure', () => `${earned}: you carried its treasure out of the hall.`);

  // "Handling Clearance, Grade IV" (§8.7).
  const grade = e => Number.isInteger(e.grade) && e.grade >= 1 ? `Your Handling Clearance is now Grade ${Text.grade(e.grade)}.` : 'Your Handling Clearance changed.';
  Text.define('grade', grade);
  Text.defineCause('grade', 'certificate', grade);
  Text.defineCause('healed', 'certificate', (e, w) => `${w.Name(e.who)} healed ${e.amount} with the Certificate: now ${e.hp}.`);
})();
