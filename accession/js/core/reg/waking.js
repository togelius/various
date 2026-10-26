// ACCESSION — registry fragment: waking (BUILD.md §8.2), owned by W1-WAKE-A. The generic wake
// clause, the special triggers it implements, the noise, pip, woke and hunting events, and
// the wake causes that come from the ring, noise and the triggers; and the causes of the
// changes of mode that "Quiet, Please", the Re-admission Ticket and noise make.
'use strict';
(() => {
  const R = Registry;
  // Where each entry is proved: its scenarios and unit tests, and its invariants
  // (test/behaviour/waking.inv.js). ready true (W2a-BEHAVIOUR): its scenarios pass joined up,
  // in the real core with every rule in place and every package's invariants.
  const WAKE_TESTS = ['m3-waking.test.js', 'm3-ring.test.js', 'behaviour/wake.test.js'];
  const TRIGGER_TESTS = ['m3-waking.test.js', 'behaviour/triggers.test.js'];
  const proved = tests => ({ ready: true, tests, inv: 'waking' });

  // The generic wake clause ends every sleeping species' Behaviour line, joined to its
  // special trigger's clause (§5.3): your ring gives a pip a turn, and so does a noise it
  // hears; three wake it.
  R.define('CLAUSES', 'wake', Object.assign({ icon: 'ring', clause: 'Wakes when you stay inside your ring or make noise near it.', params: {},
    covers: ['noise', 'pip', 'woke', 'hunting', 'alerted'] }, proved(WAKE_TESTS)));

  // Special triggers (§8.2), at most one per species. A trigger clause continues the wake
  // clause; `replacesWake` marks one that stands instead of it.
  R.define('TRIGGERS', 'axis', Object.assign({ icon: 'axis', clause: 'also gains a pip each turn you stand in its row or column within {AXIS_RANGE} tiles, in its sight',
    params: { AXIS_RANGE: 'N:AXIS_RANGE' }, covers: ['pip', 'woke', 'hunting'] }, proved(TRIGGER_TESTS)));
  R.define('TRIGGERS', 'tether', Object.assign({ icon: 'tether', clause: 'wakes at once when you come within {TETHER_RANGE} tiles of what it guards',
    params: { TETHER_RANGE: 'N:TETHER_RANGE' }, covers: ['pip', 'woke', 'hunting'] }, proved(TRIGGER_TESTS)));
  R.define('TRIGGERS', 'ally_hit', Object.assign({ icon: 'ally_hit', clause: 'wakes at once when one of its group within {ALLY_HIT_RANGE} tiles takes damage',
    params: { ALLY_HIT_RANGE: 'N:ALLY_HIT_RANGE' }, covers: ['pip', 'woke', 'hunting'] }, proved(TRIGGER_TESTS)));
  R.define('TRIGGERS', 'awake', Object.assign({ icon: 'awake', clause: 'It never sleeps.', replacesWake: true, params: {}, covers: ['woke'] }, proved(TRIGGER_TESTS)));

  // Events (§4.3).
  R.defineEvent('noise', { fields: { x: 'int', y: 'int', cls: 'str', range: 'int' } });
  R.defineEvent('pip', { fields: { who: 'uid', pips: 'int', delta: 'int' } });
  R.defineEvent('woke', { fields: { who: 'uid', was: 'str?', mode: 'str' }, record: true });
  R.defineEvent('hunting', { fields: { who: 'uid', was: 'str' }, record: true });

  // What "Quiet, Please" and the Re-admission Ticket put in their causes: who read it, and
  // the item, when the reader says.
  const read = { by: 'uid', item: 'uid?' };

  // Why a pip came or went.
  R.defineCause('pip', 'ring', { fields: { dist: 'int', r: 'int' } });
  // A noise names its source: who made it (if anyone did) and its tile. The tile is optional
  // only for callers that give a noise cause by hand; Wake.hear always gives it.
  const heard = { by: 'uid?', dist: 'int', cls: 'str', x: 'int?', y: 'int?' };
  R.defineCause('pip', 'noise', { fields: heard });
  R.defineCause('pip', 'axis', { fields: { dist: 'int' } });
  R.defineCause('pip', 'decay', { fields: {} });
  R.defineCause('pip', 'quiet', { fields: read });
  // "Quiet, Please" and the Re-admission Ticket make hunters lose you; "Quiet, Please" also
  // settles an exhibit that was going back to sleep at home.
  R.defineCause('lost', 'quiet', { fields: read });
  R.defineCause('lost', 'ticket', { fields: read });
  R.defineCause('returned', 'quiet', { fields: read });
  // Noise sends a searching, returning or awake exhibit to look (§8.2).
  R.defineCause('alerted', 'noise', { fields: heard });

  // Wake causes (§3.4, §8.2), each with the mode it wakes into; `creation` marks one given
  // to an actor made awake.
  R.define('WAKE_CAUSES', 'ring', Object.assign({ mode: 'hunting', creation: false }, proved(WAKE_TESTS)));
  R.define('WAKE_CAUSES', 'noise', Object.assign({ mode: 'awake', creation: false }, proved(WAKE_TESTS)));
  R.define('WAKE_CAUSES', 'axis', Object.assign({ mode: 'hunting', creation: false }, proved(TRIGGER_TESTS)));
  R.define('WAKE_CAUSES', 'tether', Object.assign({ mode: 'hunting', creation: false }, proved(TRIGGER_TESTS)));
  R.define('WAKE_CAUSES', 'ally_hit', Object.assign({ mode: 'hunting', creation: false }, proved(TRIGGER_TESTS)));
  R.define('WAKE_CAUSES', 'awake', Object.assign({ mode: 'awake', creation: true }, proved(TRIGGER_TESTS)));
  const wake = extra => Object.assign({ by: 'uid?', dist: 'int?', x: 'int?', y: 'int?', from: 'tile?', how: 'str?' }, extra);
  // The ring names its radius; noise its class; ally_hit the ally that was hurt.
  const fields = { ring: wake({ r: 'int?' }), noise: wake({ cls: 'str?' }), axis: wake({}), tether: wake({}), ally_hit: wake({ ally: 'uid?' }), awake: wake({}) };
  for (const k of ['ring', 'noise', 'axis', 'tether', 'ally_hit', 'awake']) for (const kind of ['woke', 'hunting']) R.defineCause(kind, k, { fields: fields[k] });
  // The triggers that wake at once do it through Wake.addPips +3, whose pip event carries the
  // same cause as the woke and hunting events that follow (lint-registry checks every waking
  // trigger has its pip schema).
  for (const k of ['tether', 'ally_hit']) R.defineCause('pip', k, { fields: fields[k] });
})();
