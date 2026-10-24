// ACCESSION — registry fragment: statuses and surfaces (BUILD.md §8.1, §8.6), owned by
// W1-STATUS. Each status says whether it is harmful (Solvent removes those), carries the
// clause a Behaviour line embeds where a species inflicts it ({status:<id>}, §5.3), and its
// words: how it reads after "is now" and "is no longer", the same in every sentence that puts
// it on or ends it, whatever put it on; each surface says whether it blocks sight and carries
// the sentence that says what it does.
// Every rule here is proved by test/m3-status.test.js and test/behaviour/status.test.js and
// held after every step by test/behaviour/status.inv.js.
'use strict';
(() => {
  const R = Registry;
  const TESTS = ['m3-status.test.js', 'behaviour/status.test.js'];
  const status = (harmful, words, clause, params, covers) => ({ icon: null, harmful, words, clause, params, covers: ['status'].concat(covers || []), ready: 'unit', tests: TESTS.slice(), inv: 'status' });

  // A status's clause continues the clause of the archetype that inflicts it (§5.3), so it
  // starts lower-case and has no full stop; its numbers are those of record (§8.10).
  R.define('STATUSES', 'fixed', status(true, 'fixed in place', 'cannot move or act for {FIXATIVE_TURNS} turns, only wait, and blows against it have +{HIT_FIXED_TARGET} to hit',
    { FIXATIVE_TURNS: 'N:FIXATIVE_TURNS', HIT_FIXED_TARGET: 'N:HIT_FIXED_TARGET' }));
  R.define('STATUSES', 'rooted', status(true, 'rooted to the spot', 'you cannot move for {MIMIC_GRIP_TURNS} turns', { MIMIC_GRIP_TURNS: 'N:MIMIC_GRIP_TURNS' }));
  R.define('STATUSES', 'coughing', status(true, 'coughing', 'coughs for {COUGH_TURNS} turns, each turn a soft noise heard {NOISE_SOFT} tiles away',
    { COUGH_TURNS: 'N:COUGH_TURNS', NOISE_SOFT: 'N:NOISE_SOFT' }, ['noise']));
  R.define('STATUSES', 'restoring', status(false, 'recovering health', 'heals {CONSOLIDANT_HOT_PCT}% of its maximum health over {CONSOLIDANT_HOT_TURNS} turns, a share each turn',
    { CONSOLIDANT_HOT_PCT: 'N:CONSOLIDANT_HOT_PCT', CONSOLIDANT_HOT_TURNS: 'N:CONSOLIDANT_HOT_TURNS' }, ['healed']));
  R.define('STATUSES', 'slowed', status(true, 'slowed', 'its actions take {SPEED_SLOW_PCT}% of their usual time', { SPEED_SLOW_PCT: 'N:SPEED_SLOW_PCT' }));
  R.define('STATUSES', 'dazed', status(true, 'dazed', 'its blows have {HIT_DAZED_ATTACKER} to hit', { HIT_DAZED_ATTACKER: 'N:HIT_DAZED_ATTACKER' }));

  // Surfaces: a square of `size` tiles a side for `turns` turns (the N keys Surfaces.add is
  // called with); both block sight (§8.2). The clause is a sentence of its own, for the label
  // of a tile it covers.
  const surface = (clause, params, covers, extra) => Object.assign({ blocksSight: true, icon: null, clause, params, covers, ready: 'unit', tests: TESTS.slice(), inv: 'status' }, extra);
  R.define('SURFACES', 'fumigant', surface('A Fumigant cloud {FUMIGANT_SIZE} tiles a side blocks sight for {FUMIGANT_TURNS} turns, and every sleeping exhibit inside it loses a pip each turn.',
    { FUMIGANT_SIZE: 'N:FUMIGANT_SIZE', FUMIGANT_TURNS: 'N:FUMIGANT_TURNS' }, ['pip'], { size: 'FUMIGANT_SIZE', turns: 'FUMIGANT_TURNS' }));
  R.define('SURFACES', 'dust', surface('Plaster dust {PLASTER_DUST_SIZE} tiles a side blocks sight for {PLASTER_DUST_TURNS} turns.',
    { PLASTER_DUST_SIZE: 'N:PLASTER_DUST_SIZE', PLASTER_DUST_TURNS: 'N:PLASTER_DUST_TURNS' }, [], { size: 'PLASTER_DUST_SIZE', turns: 'PLASTER_DUST_TURNS' }));

  // What a status forbids you (Status.blocks, §4.2): fixed allows only wait, rest and the
  // answer to a waiting choice; rooted refuses a move that would change your tile.
  R.define('REFUSALS', 'fixed', { ready: 'unit', tests: TESTS.slice(), inv: 'status' });
  R.define('REFUSALS', 'rooted', { ready: 'unit', tests: TESTS.slice(), inv: 'status' });

  // Events (§4.3): a status put on (on: true, for `turns` turns, settled once the action that
  // put it on is over) or ended (on: false, at the boundary of turn `until`).
  R.defineEvent('status', { fields: { who: 'uid', id: 'str', on: 'bool', turns: 'int?', until: 'int?' } });
  R.defineCause('status', 'status', { fields: { id: 'str', by: 'uid?' } });
  R.defineCause('healed', 'status', { fields: { id: 'str' } });
  R.defineCause('pip', 'fumigant', { fields: { by: 'uid?' } });
  R.defineCause('noise', 'cough', { fields: { by: 'uid?', item: 'uid?' } });
})();
