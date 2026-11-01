// ACCESSION — sentences: Certificates and the grade (BUILD.md §3.4, §8.7), owned by PG-CORE. M4's
// skeleton made it; M4's Wave 0 (W0a) moved here the certificate and grade sentences, the grade
// in Roman numerals as the badge prints it (Text.grade), and gave each cause its own.
'use strict';
(() => {
  const earned = 'You earned this department’s Certificate';
  Text.define('certificate', () => `${earned}.`);
  Text.defineCause('certificate', 'defeat', (e, w) => e.cause.by !== undefined ? `${earned}: you defeated ${w.name(e.cause.by)}.` : `${earned}: you defeated its Centrepiece.`);
  Text.defineCause('certificate', 'view', () => `${earned}: you viewed its Centrepiece.`);
  Text.defineCause('certificate', 'treasure', () => `${earned}: you carried its treasure out of the hall.`);

  // "Handling Clearance, Grade IV" (§8.7), the grade in the badge's Roman numerals. A
  // Certificate's raise also says that your maximum health rose with it (HP_PER_GRADE), since
  // the heal that follows can take you past the maximum you had (28 of 30 becomes 33 of 35).
  const ok = e => Number.isInteger(e.grade) && e.grade >= 1;
  const grade = e => ok(e) ? `Your Handling Clearance is now Grade ${Text.grade(e.grade)}.` : 'Your Handling Clearance changed.';
  Text.define('grade', grade);
  Text.defineCause('grade', 'certificate', e => ok(e)
    ? `Your Handling Clearance is now Grade ${Text.grade(e.grade)}, and your maximum health is ${N.HP_PER_GRADE} higher.` : 'Your Handling Clearance changed.');
  // At GRADE_MAX a Certificate raises nothing: it heals and offers a perk only (§8.7), and
  // either may give nothing (full health; every perk at its highest rank), so this says only
  // what stays.
  Text.defineCause('grade', 'highest', () => `Your Handling Clearance stays at Grade ${Text.grade(N.GRADE_MAX)}, the highest there is, and so does your maximum health.`);
  Text.defineCause('healed', 'certificate', (e, w) => `${w.Name(e.who)} healed ${e.amount} with the Certificate: now ${e.hp}.`);
})();
