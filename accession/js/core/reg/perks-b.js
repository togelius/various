// ACCESSION — registry fragment: the perks Single File, Elbow Room and Second Wind (BUILD.md
// §5.1, §8.7), owned by PG-PERKS-B. M4's skeleton made it; M4's Wave 0 (W0a) gave each perk its
// entry in Registry.PERKS (its name and family, §8.7's table: Perks.add takes only an id defined
// there), at ready false, and the perk event its causes for Single File and Second Wind (M4 plan
// A5). PG-PERKS-B filled the rest: each perk's clause, params, covers, tests and inv. The rules
// are in js/core/rules/perks/{single_file,elbow_room,second_wind}.js; Second Wind's heal is the
// status second_wind, with its healed cause (js/core/reg/perk-status.js).
//
// A perk's clause is its whole rule, both ranks, as the perk sheet and your label show it; it
// names a perk's numbers as parameters, never as digits, and a rank in words ("the second
// rank"). Every clause is proved joined up at depths 1–7 in test/behaviour/perks-b.test.js,
// each scenario failing with its perk switched off (rulesOff), and held after every step of
// every scenario, monkey, soak and bot run by test/behaviour/perks-b.inv.js.
'use strict';
(() => {
  const R = Registry;
  const proved = { built: 'M4', ready: true, tests: ['behaviour/perks-b.test.js'], inv: 'perks-b' };
  const perk = (name, family, rule) => Object.assign({ name, family, icon: null }, proved, rule);

  // Single File (§8.1's staggered; PR5): an exhibit's step onto a doorway beside you (an open
  // door or an archway) staggers it, once for each exhibit, by its uid; at the second rank it
  // is first dealt PERK_SINGLE_FILE_DMG damage, which no Padding reduces.
  R.define('PERKS', 'single_file', perk('Single File', 'swarm', {
    clause: 'An exhibit that steps into a doorway (an open door or an archway) beside you loses its next action, once for each exhibit (a body split off or called in during the visit is one of its own); at the second rank it is also dealt {dmg} damage, which no Padding reduces.',
    params: { dmg: 'N:PERK_SINGLE_FILE_DMG' }, covers: ['perk', 'status', 'damaged'] }));

  // Elbow Room (§8.1's Padding; PR4, "counted when you act"): PERK_ELBOW_ROOM[rank − 1] more
  // Padding while PERK_ELBOW_ROOM_ADJACENT or more exhibits, not asleep and in no intact case,
  // stand beside you, counted where all stand as you choose each action (Kit.settle), and
  // holding until your next.
  R.define('PERKS', 'elbow_room', perk('Elbow Room', 'swarm', {
    clause: 'You have {p1} more Padding, or {p2} more at the second rank, while {n} or more exhibits stand beside you that are not asleep and not in an intact case; they are counted each time you act, where all stand as you choose your action, and the Padding holds until you act again.',
    params: { p1: 'N:PERK_ELBOW_ROOM[0]', p2: 'N:PERK_ELBOW_ROOM[1]', n: 'N:PERK_ELBOW_ROOM_ADJACENT' }, covers: ['damaged'] }));

  // Second Wind (§8.1's healing; PR8): once a visit, damage that takes you from
  // PERK_SECOND_WIND_BELOW_PCT% of your maximum health or more to below it, and that you live
  // through, heals PERK_SECOND_WIND_PCT[rank − 1]% of your maximum health then, over the
  // PERK_SECOND_WIND_TURNS turns from your next decision (the status second_wind); healing,
  // not regeneration, so neither the night watch nor a sealed hall stops it.
  R.define('PERKS', 'second_wind', perk('Second Wind', 'attrition', {
    clause: 'Once a visit, when damage takes you from {below}% of your maximum health or more to below it and you live, you heal {p1}% of it, or {p2}% at the second rank, in shares over the {turns} turns from your next action, never past your maximum; it is healing, not regeneration, so it goes on in the night watch and in a sealed hall.',
    params: { below: 'N:PERK_SECOND_WIND_BELOW_PCT', p1: 'N:PERK_SECOND_WIND_PCT[0]', p2: 'N:PERK_SECOND_WIND_PCT[1]', turns: 'N:PERK_SECOND_WIND_TURNS' },
    covers: ['perk', 'status', 'healed'] }));

  // Single File (§8.7): an exhibit (who) stepped into a doorway beside you: the perk's doing,
  // yours, which only names the exhibit it counted (never `by`, which names whoever caused an
  // event: the battery's completeness, tools/battery.js). Second Wind: you fell
  // below PERK_SECOND_WIND_BELOW_PCT of your health, and heal `total` over
  // PERK_SECOND_WIND_TURNS turns, once a visit.
  R.defineCause('perk', 'single_file', { fields: { who: 'uid?' }, built: 'M4' });
  R.defineCause('perk', 'wind', { fields: { total: 'int?' }, built: 'M4' });
  // An exhibit that Single File's damage destroys (Combat.die, with the damage's own cause:
  // perk single_file, raw its damage, as damaged's, reg/perks.js).
  R.defineCause('died', 'perk', { fields: { id: 'str', raw: 'int?', saved: 'int?', side: 'str?' }, built: 'M4' });
})();
