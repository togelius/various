// ACCESSION — registry fragment: the perks Soft Soles, Vanishing Act and Light Fingers (BUILD.md
// §5.1, §8.7), owned by PG-PERKS-A. M4's skeleton made it; M4's Wave 0 (W0a) gave each perk its
// entry in Registry.PERKS (its name and family, §8.7's table: Perks.add takes only an id defined
// there), at ready false, and the lost event its cause for Vanishing Act (M4 plan A5).
// PG-PERKS-A filled the rest: each perk's clause, params, covers, tests and inv, and the case's
// opening sentence while Light Fingers is held (Cases.rules). The rules are in
// js/core/rules/perks/{soft_soles,vanishing_act,light_fingers}.js.
//
// A perk's clause is its whole rule, both ranks, as the perk sheet and your label show it; it
// names a perk's numbers as parameters, never as digits, and a rank in words ("the second
// rank"). Every clause, and the case's sentences, is proved joined up at depths 1–7 in
// test/behaviour/perks-a.test.js, each scenario failing with its perk switched off
// (rulesOff), and held after every step of every scenario, monkey, soak and bot run by
// test/behaviour/perks-a.inv.js.
'use strict';
(() => {
  const R = Registry;
  const proved = { built: 'M4', ready: true, tests: ['behaviour/perks-a.test.js'], inv: 'perks-a' };
  const perk = (name, family, rule) => Object.assign({ name, family, icon: null }, proved, rule);

  // Soft Soles (§8.2's ring): every ring of yours, PERK_SOFT_SOLES[rank − 1] smaller, never
  // below RING_MIN.
  R.define('PERKS', 'soft_soles', perk('Soft Soles', 'guarded', {
    clause: 'Your ring is {r1} smaller, or {r2} smaller at the second rank, but never below {min}.',
    params: { r1: 'N:PERK_SOFT_SOLES[0]', r2: 'N:PERK_SOFT_SOLES[1]', min: 'N:RING_MIN' }, covers: ['pip'] }));

  // Vanishing Act (§8.2's hunt): a hunter searches at its first action out of sight of you, not
  // after LOSE_TRACK_TURNS (Perks.loseTrack; the lost event's cause vanished); never the Night
  // Watchman, which never searches; at rank 2 it is then staggered (Perks.onLoseTrack).
  R.define('PERKS', 'vanishing_act', perk('Vanishing Act', 'guarded', {
    clause: 'A hunter (never the Night Watchman, which never searches) that would search for you after {turns} turns out of sight of you searches at its first action out of sight instead, where it last knew you were; at the second rank it then loses its next action.',
    params: { turns: 'N:LOSE_TRACK_TURNS' }, covers: ['lost', 'status'] }));

  // Light Fingers (§8.3's opening; PR7): your opening of a case costs PERK_LIGHT_FINGERS_COST
  // ticks and makes no noise, the touch made as ever; at rank 2 case locks up to
  // PERK_LIGHT_FINGERS_ABOVE grades above yours open too; staff doors take your grade alone.
  R.define('PERKS', 'light_fingers', perk('Light Fingers', 'guarded', {
    clause: 'Opening a case takes you {open} ticks and makes no noise; it is still an opening, so what wakes when its case is opened still wakes, and a mimic still grips you. At the second rank you also open case locks up to one grade above yours, but never a staff door.',
    params: { open: 'N:PERK_LIGHT_FINGERS_COST' }, covers: ['case_opened'], phrases: { 'one grade above yours': 'N:PERK_LIGHT_FINGERS_ABOVE' } }));

  // The case's opening sentence while Light Fingers is held (Cases.rules, in place of the first
  // sentence of FIXTURES.case's clause, "Opens for {open} ticks and a soft noise if your grade
  // reaches its lock."): at either rank, then at the second. {open} is filled with what opening
  // it costs you (Cases.openCost), so the label's number is the rule's.
  const opening = { icon: null, covers: ['case_opened'], params: { open: 'N:PERK_LIGHT_FINGERS_COST' } };
  R.define('CLAUSES', 'case_light_fingers', Object.assign({}, opening, proved, {
    clause: 'Opens for {open} ticks and no noise, with your Light Fingers, if your grade reaches its lock.' }));
  R.define('CLAUSES', 'case_light_fingers2', Object.assign({}, opening, proved, {
    clause: 'Opens for {open} ticks and no noise, with your Light Fingers, if its lock is your grade or up to one grade above yours.',
    phrases: { 'one grade above yours': 'N:PERK_LIGHT_FINGERS_ABOVE' } }));

  // Vanishing Act (§8.7): a hunter that loses sight of you searches at once, not after
  // LOSE_TRACK_TURNS (rules/perks.js, Perks.onLoseTrack); turns, as out_of_sight's, are the
  // turns it had been out of sight (rules/ai.js); how 'case' for one in an intact case, which
  // only waits there (Wake.setMode, §8.3).
  R.defineCause('lost', 'vanished', { fields: { turns: 'int', how: 'str?' }, built: 'M4' });
})();
