// ACCESSION — registry fragment: waking (BUILD.md §8.2), owned by W1-WAKE-A. The generic wake
// clause, the special triggers it implements, the noise, pip, woke and hunting events, and
// the wake causes that come from the ring, noise and the triggers.
'use strict';
(() => {
  const R = Registry;

  // The generic wake clause ends every sleeping species' Behaviour line, joined to its
  // special trigger's clause (§5.3).
  R.define('CLAUSES', 'wake', { icon: 'ring', clause: 'Wakes when you stay inside your ring or make noise near it.', params: {},
    covers: ['pip', 'woke', 'hunting', 'alerted'], ready: false, tests: [], inv: null });

  // Special triggers (§8.2), at most one per species. A trigger clause continues the wake
  // clause; `replacesWake` marks one that stands instead of it.
  R.define('TRIGGERS', 'axis', { icon: 'axis', clause: 'also gains a pip each turn you stand in its row or column within {AXIS_RANGE} tiles, in its sight',
    params: { AXIS_RANGE: 'N:AXIS_RANGE' }, covers: ['pip', 'woke', 'hunting'], ready: false, tests: [], inv: null });
  R.define('TRIGGERS', 'tether', { icon: 'tether', clause: 'wakes at once when you come within {TETHER_RANGE} tiles of what it guards',
    params: { TETHER_RANGE: 'N:TETHER_RANGE' }, covers: ['woke', 'hunting'], ready: false, tests: [], inv: null });
  R.define('TRIGGERS', 'ally_hit', { icon: 'ally_hit', clause: 'wakes at once when one of its group within {ALLY_HIT_RANGE} tiles takes damage',
    params: { ALLY_HIT_RANGE: 'N:ALLY_HIT_RANGE' }, covers: ['woke', 'hunting'], ready: false, tests: [], inv: null });
  R.define('TRIGGERS', 'awake', { icon: 'awake', clause: 'It never sleeps.', replacesWake: true, params: {}, covers: ['woke'], ready: false, tests: [], inv: null });

  // Events (§4.3).
  R.defineEvent('noise', { fields: { x: 'int', y: 'int', cls: 'str', range: 'int' } });
  R.defineEvent('pip', { fields: { who: 'uid', pips: 'int', delta: 'int' } });
  R.defineEvent('woke', { fields: { who: 'uid', was: 'str?', mode: 'str' }, record: true });
  R.defineEvent('hunting', { fields: { who: 'uid', was: 'str' }, record: true });

  // Why a pip came or went.
  R.defineCause('pip', 'ring', { fields: { dist: 'int', r: 'int' } });
  R.defineCause('pip', 'noise', { fields: { by: 'uid?', dist: 'int', cls: 'str' } });
  R.defineCause('pip', 'axis', { fields: { dist: 'int' } });
  R.defineCause('pip', 'decay', { fields: {} });
  R.defineCause('pip', 'quiet', { fields: { by: 'uid' } });
  // "Quiet, Please" and the Re-admission Ticket make hunters lose you.
  R.defineCause('lost', 'quiet', { fields: { by: 'uid' } });
  R.defineCause('lost', 'ticket', { fields: { by: 'uid' } });
  // Noise sends a searching, returning or awake exhibit to look (§8.2).
  R.defineCause('alerted', 'noise', { fields: { by: 'uid?', dist: 'int', cls: 'str' } });

  // Wake causes (§3.4, §8.2), each with the mode it wakes into; `creation` marks one given
  // to an actor made awake.
  R.define('WAKE_CAUSES', 'ring', { mode: 'hunting', creation: false });
  R.define('WAKE_CAUSES', 'noise', { mode: 'awake', creation: false });
  R.define('WAKE_CAUSES', 'axis', { mode: 'hunting', creation: false });
  R.define('WAKE_CAUSES', 'tether', { mode: 'hunting', creation: false });
  R.define('WAKE_CAUSES', 'ally_hit', { mode: 'hunting', creation: false });
  R.define('WAKE_CAUSES', 'awake', { mode: 'awake', creation: true });
  const wake = extra => Object.assign({ by: 'uid?', dist: 'int?', x: 'int?', y: 'int?', from: 'tile?', how: 'str?' }, extra);
  const fields = { ring: wake({ r: 'int?' }), noise: wake({ cls: 'str?' }), axis: wake({}), tether: wake({}), ally_hit: wake({}), awake: wake({}) };
  for (const k of ['ring', 'noise', 'axis', 'tether', 'ally_hit', 'awake']) for (const kind of ['woke', 'hunting']) R.defineCause(kind, k, { fields: fields[k] });
  // The triggers that wake at once do it through Wake.addPips +3, whose pip event carries the
  // same cause as the woke and hunting events that follow (lint-registry checks every waking
  // trigger has its pip schema).
  for (const k of ['tether', 'ally_hit']) R.defineCause('pip', k, { fields: fields[k] });
})();
