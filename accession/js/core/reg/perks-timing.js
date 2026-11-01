// ACCESSION — registry fragment: the perks Duck and Cover and Close the Distance (BUILD.md §5.1,
// §8.1, §8.7), owned by PG-PERKS-TIMING. M4's skeleton made it; M4's Wave 0 (W0a) gave each perk
// its entry in Registry.PERKS (its name and family, §8.7's table), and the perk event its causes
// for their activations (M4 plan A5). PG-PERKS-TIMING filled the rest: each perk's clause,
// params, covers, tests and inv. The rules are in js/core/rules/perks/{duck_and_cover,
// close_the_distance}.js; the time they change is plan A6's (BUILD §8.1, §8.2).
//
// A perk's clause is its whole rule, both ranks, as the perk sheet and your label show it; it
// names a perk's numbers as parameters, never as digits, and a rank in words ("the second
// rank"). Every clause is proved joined up at depths 1–7 in test/behaviour/perks-timing.test.js,
// each scenario failing with its perk switched off (rulesOff), and held after every step of
// every scenario, monkey, soak and bot run by test/behaviour/perks-timing.inv.js; A6's time
// (the floor, the threat, the ring, statuses) is test/m4-timing.test.js's.
'use strict';
(() => {
  const R = Registry;
  const proved = { built: 'M4', ready: true, tests: ['behaviour/perks-timing.test.js', 'm4-timing.test.js'], inv: 'perks-timing' };
  const perk = (name, family, rule) => Object.assign({ name, family, icon: null }, proved, rule);

  // Duck and Cover (PR2, D4.3): a special marked on your tile (Specials.atYou) that goes off
  // and misses you leaves one discount of PERK_DUCK_AND_COVER ticks on your next action that
  // takes time; at the second rank also a surprise attack, your next blow or shot at anything
  // but the Night Watchman (which is never caught by surprise, §8.4).
  R.define('PERKS', 'duck_and_cover', perk('Duck and Cover', 'artillery', {
    clause: 'When a damaging special marked on your tile goes off and misses you, your next action that takes time costs {cut} ticks less, however many miss you before it. At the second rank your next blow or shot at anything but the Night Watchman (never caught by surprise) is also a surprise attack, whatever its target is doing.',
    params: { cut: 'N:PERK_DUCK_AND_COVER' }, covers: ['perk', 'damaged'] }));

  // Close the Distance (PR3, D4.4): a step that brings you nearer, in walking tiles, an exhibit
  // whose pending damage mark covers your tile takes no time, PERK_CLOSE_STEPS[rank − 1] times
  // for each exhibit in a visit. No two damage marks share a tile (§8.1), so only one exhibit
  // can be targeting you at once, and its count is the one spent (the rule's tie, the first
  // in spawn order with steps left, cannot arise in play: rules/perks/close_the_distance.js).
  R.define('PERKS', 'close_the_distance', perk('Close the Distance', 'artillery', {
    clause: 'A step that brings you nearer, in walking tiles, to an exhibit whose damaging special is marked on your tile takes no time, up to {r1} such step toward each exhibit in a visit, or {r2} at the second rank. Damaging specials are never marked on the same tile, so the step is counted for that exhibit alone.',
    params: { r1: 'N:PERK_CLOSE_STEPS[0]', r2: 'N:PERK_CLOSE_STEPS[1]' }, covers: ['perk'] }));

  // Each activation is the perk's doing, so yours: its cause names the exhibit it concerns as
  // `who`, never `by`, which names whoever caused an event (the battery's completeness check
  // blames an event on its cause's by; PG-PERKS-B's single_file does the same). Duck and Cover:
  // the special of an exhibit (who) marked on your tile missed you, so your next action that
  // takes time costs less (`duck`), and at the second rank your next blow or shot is a surprise
  // attack (`sure`). Close the Distance: your step toward an exhibit (who) whose mark lay on your
  // tile took no time (`close`), its n-th free step toward it of the `of` it allows.
  R.defineCause('perk', 'duck', { fields: { who: 'uid?' }, built: 'M4' });
  R.defineCause('perk', 'sure', { fields: { who: 'uid?' }, built: 'M4' });
  R.defineCause('perk', 'close', { fields: { who: 'uid?', n: 'int?', of: 'int?' }, built: 'M4' });
})();
