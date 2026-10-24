// ACCESSION — registry fragment: statuses and surfaces (BUILD.md §8.1, §8.6), owned by
// W1-STATUS. Each status says whether it is harmful (Solvent removes those) and carries the
// clause a Behaviour line embeds where a species inflicts it ({status:<id>}, §5.3).
'use strict';
(() => {
  const R = Registry;
  const status = (harmful, clause, params) => ({ icon: null, harmful, clause, params, covers: ['status'], ready: false, tests: [], inv: null });

  R.define('STATUSES', 'fixed', status(true, 'cannot move or act for {FIXATIVE_TURNS} turns, and blows against it have +{HIT_FIXED_TARGET} to hit',
    { FIXATIVE_TURNS: 'N:FIXATIVE_TURNS', HIT_FIXED_TARGET: 'N:HIT_FIXED_TARGET' }));
  R.define('STATUSES', 'rooted', status(true, 'you cannot move for {MIMIC_GRIP_TURNS} turns', { MIMIC_GRIP_TURNS: 'N:MIMIC_GRIP_TURNS' }));
  R.define('STATUSES', 'coughing', status(true, 'coughs, a soft noise each turn, for {COUGH_TURNS} turns', { COUGH_TURNS: 'N:COUGH_TURNS' }));
  R.define('STATUSES', 'restoring', status(false, 'heals {CONSOLIDANT_HOT_PCT}% of its maximum health over {CONSOLIDANT_HOT_TURNS} turns',
    { CONSOLIDANT_HOT_PCT: 'N:CONSOLIDANT_HOT_PCT', CONSOLIDANT_HOT_TURNS: 'N:CONSOLIDANT_HOT_TURNS' }));
  R.define('STATUSES', 'slowed', status(true, 'its actions take {SPEED_SLOW_PCT}% of their usual time', { SPEED_SLOW_PCT: 'N:SPEED_SLOW_PCT' }));
  R.define('STATUSES', 'dazed', status(true, 'its blows have {HIT_DAZED_ATTACKER} to hit', { HIT_DAZED_ATTACKER: 'N:HIT_DAZED_ATTACKER' }));

  // Surfaces: a square of `size` tiles a side for `turns` turns; both block sight (§8.2).
  R.define('SURFACES', 'fumigant', { blocksSight: true, size: 'FUMIGANT_SIZE', turns: 'FUMIGANT_TURNS' });
  R.define('SURFACES', 'dust', { blocksSight: true, size: 'PLASTER_DUST_SIZE', turns: 'PLASTER_DUST_TURNS' });

  // What a status forbids you (Status.blocks, §4.2): fixed allows only wait, rest and the
  // answer to a waiting choice; rooted refuses a move that would change your tile.
  R.define('REFUSALS', 'fixed', {});
  R.define('REFUSALS', 'rooted', {});

  // Events (§4.3): a status put on (on: true) or ended (on: false).
  R.defineEvent('status', { fields: { who: 'uid', id: 'str', on: 'bool', until: 'int?' } });
  R.defineCause('status', 'status', { fields: { id: 'str', by: 'uid?' } });
  R.defineCause('healed', 'status', { fields: { id: 'str' } });
  R.defineCause('pip', 'fumigant', { fields: { by: 'uid' } });
  R.defineCause('noise', 'cough', { fields: { by: 'uid?', item: 'uid?' } });
})();
