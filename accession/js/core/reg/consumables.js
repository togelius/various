// ACCESSION — registry fragment: consumables, seals and identification (BUILD.md §8.6),
// owned by W1-CONSUMABLES. The eight kinds, the eight seals, the plaque fixture (an
// identifying label on the wall), the rules that hold for every kind (seals, the deck, a
// first use), the refusals, and the events of drinking, throwing and reading. Each kind's
// clause says exactly what rules/consumables.js does with it; the scenarios named in
// `tests` prove it, and test/behaviour/consumables.inv.js holds the invariants.
'use strict';
(() => {
  const R = Registry;
  const TESTS = ['m3-consumables.test.js', 'behaviour/consumables.test.js'], INV = 'consumables';
  const unit = { ready: 'unit', tests: TESTS, inv: INV };

  // The eight kinds, in the order of the DECK row (§8.10): `deck` indexes it. cls: Solutions
  // are drunk or thrown, Ephemera are read. `area` names the side of a thrown Solution's
  // square (its N key); `harmfulDrink` marks a drink that harms you, which a first use makes
  // harmless (§8.6, identification by use).
  const sq = '{area}×{area} square';
  const kinds = [
    ['consolidant', 'solution', 'Consolidant', 'THROW_AREA', false,
      `Drunk, heals {now}% of your maximum health at once and {hot}% more over {turns} turns. Thrown, heals every creature in a ${sq} by {thrown}% of its maximum health.`,
      { now: 'N:CONSOLIDANT_NOW_PCT', hot: 'N:CONSOLIDANT_HOT_PCT', turns: 'N:CONSOLIDANT_HOT_TURNS', area: 'N:THROW_AREA', thrown: 'N:CONSOLIDANT_THROW_PCT' },
      ['used', 'identified', 'healed', 'status', 'noise']],
    ['fixative', 'solution', 'Fixative', 'THROW_AREA', true,
      `Drunk, fixes you: you cannot move or act for {turns} turns. Thrown, fixes every creature in a ${sq} for {turns} turns.`,
      { turns: 'N:FIXATIVE_TURNS', area: 'N:THROW_AREA' }, ['used', 'identified', 'status', 'noise']],
    ['fumigant', 'solution', 'Fumigant', 'FUMIGANT_SIZE', true,
      'Drunk, makes you cough, a soft noise each turn, for {cough} turns. Thrown, leaves a {area}×{area} cloud for {turns} turns that blocks sight, and sleeping exhibits inside it lose a pip each turn.',
      { cough: 'N:COUGH_TURNS', area: 'N:FUMIGANT_SIZE', turns: 'N:FUMIGANT_TURNS' }, ['used', 'identified', 'status', 'noise', 'pip']],
    ['solvent', 'solution', 'Solvent', 'THROW_AREA', false,
      `Drunk, ends every harmful status you have. Thrown, silently dissolves the glass of every intact case in a ${sq}, with no noise and no shards.`,
      { area: 'N:THROW_AREA' }, ['used', 'identified', 'status', 'glass_broke']],
    ['card', 'ephemera', 'Catalogue Card', null, false,
      'Read, identifies one seal you do not know, chosen by you; if only one is left, that one.', {}, ['used', 'identified']],
    ['plan', 'ephemera', 'Floor Plan', null, false,
      'Read, shows the whole plan of this department as explored, and the rooms whose Highlights have not been taken.', {}, ['used', 'identified']],
    ['quiet', 'ephemera', '“Quiet, Please”', null, false,
      'Read, takes every pip from each exhibit within {range} walking tiles of you; those awake but not hunting settle to sleep where they stand, and those hunting you drop to awake; exhibits that never sleep, such as the Night Watchman, are untouched.',
      { range: 'N:QUIET_RANGE' }, ['used', 'identified', 'pip', 'lost']],
    ['ticket', 'ephemera', 'Re-admission Ticket', null, false,
      'Read, returns you to this department’s entrance (or the nearest free tile to it), and every exhibit hunting you loses you.', {}, ['used', 'identified', 'lost']],
  ];
  kinds.forEach(([id, cls, name, area, harmfulDrink, clause, params, covers], deck) =>
    R.define('CONSUMABLES', id, Object.assign({ cls, name, deck, area, harmfulDrink, icon: 'seal', clause, params, covers }, unit)));

  // The seals: 4 wax seals shuffled over the Solutions and 4 ink stamps over the Ephemera,
  // each run (§8.6). A seal is a position; `n` indexes run.seals.sol or run.seals.eph, and
  // the seals in this order index a pack's consumables.names. `name` is how a sentence
  // speaks of it, and `shape` the pictogram that tells it apart (D5.11).
  const seals = [['round', 'round seal'], ['square', 'square seal'], ['diamond', 'diamond seal'], ['star', 'star seal']];
  const stamps = [['anchor', 'anchor stamp'], ['key', 'key stamp'], ['bell', 'bell stamp'], ['hand', 'hand stamp']];
  seals.forEach(([shape, name], n) => R.define('SEALS', 'wax' + (n + 1), Object.assign({ cls: 'solution', n, shape, name }, unit)));
  stamps.forEach(([shape, name], n) => R.define('SEALS', 'ink' + (n + 1), Object.assign({ cls: 'ephemera', n, shape, name }, unit)));

  // An identifying label on a wall (§8.6, §8.8): reading it, close and in sight, identifies
  // the kind it describes.
  R.define('FIXTURES', 'plaque', Object.assign({ icon: 'reads', clause: 'An identifying label: read within {range} tiles, in sight, it identifies the kind it describes, for the rest of the run, at no cost in time.',
    params: { range: 'N:READ_RANGE' }, covers: ['identified'] }, unit));

  // The rules every kind shares (§8.6), each a sentence of its own.
  R.define('CLAUSES', 'consumable_seals', Object.assign({ icon: 'seal', clause: 'Each run shuffles four wax seals over the four Solutions and four ink stamps over the four Ephemera; a seal identified once is known for the rest of the run.',
    covers: ['identified'] }, unit));
  R.define('CLAUSES', 'consumable_deck', Object.assign({ icon: 'seal', clause: 'A department’s consumables are drawn from the run’s one deck of cards, without replacement, and the deck is refilled when it is empty.',
    covers: [] }, unit));
  R.define('CLAUSES', 'consumable_unknown', Object.assign({ icon: 'seal', clause: 'Unidentified, a first use never harms you: a harmful drink is identified and does nothing, and a throw is refused if the {area}×{area} square centred where it lands would include you; any other first use does what its kind does, and identifies it.',
    params: { area: 'N:FUMIGANT_SIZE' }, covers: ['used', 'identified', 'refused'] }, unit));

  // Refusals (§4.2), each with its sentence in text/consumables.js.
  for (const code of ['consumable_not_carried', 'use_no_target', 'throw_not_solution', 'throw_far', 'throw_unseen', 'throw_unknown_near',
    'label_none', 'label_far', 'label_known', 'card_all_known', 'ticket_no_entrance', 'choice_none', 'choice_bad']) R.define('REFUSALS', code, Object.assign({}, unit));

  // Events (§4.3): a kind identified for this run.
  R.defineEvent('identified', { fields: { seal: 'str', ck: 'str' } });
  for (const k of ['use', 'label', 'card']) R.defineCause('identified', k, { fields: { by: 'uid?' } });
  R.defineCause('used', 'consume', { fields: { ck: 'str?', seal: 'str', known: 'bool', gentle: 'bool?', x: 'int?', y: 'int?' } });
  R.defineCause('glass_broke', 'solvent', { fields: { by: 'uid', item: 'uid' } });
  R.defineCause('healed', 'item', { fields: { by: 'uid', item: 'uid' } });
  R.defineCause('status', 'item', { fields: { by: 'uid', item: 'uid' } });
  R.defineCause('noise', 'throw', { fields: { by: 'uid?', item: 'uid?' } });
})();
