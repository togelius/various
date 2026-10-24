// ACCESSION — registry fragment: cases, glass, locks and staff doors (BUILD.md §8.3), owned
// by W1-CASES. The touch_case trigger, the case and staff-door fixtures, the three glasses,
// the case events and the wake causes a case gives.
'use strict';
(() => {
  const R = Registry;

  R.define('TRIGGERS', 'touch_case', { icon: 'touch_case', clause: 'wakes at once when its case is opened or bashed',
    params: {}, covers: ['woke', 'hunting'], ready: false, tests: [], inv: null });

  // Nothing walks into, or strikes into or out of, an intact case (§8.3).
  R.define('REFUSALS', 'behind_glass', {});

  R.define('FIXTURES', 'case', {});
  R.define('FIXTURES', 'staff', {});
  // The glasses, in order; n indexes the GLASS_BASHES, GLASS_MIX_D*, GLASS_LOCK_MIN and
  // GLASS_LOCK_MAX rows (§8.10), and a case fixture's `glass` is n.
  R.define('GLASS', 'plate', { n: 1, name: 'Plate' });
  R.define('GLASS', 'laminated', { n: 2, name: 'Laminated' });
  R.define('GLASS', 'security', { n: 3, name: 'Security' });

  // Events (§4.3).
  R.defineEvent('case_opened', { fields: { by: 'uid', x: 'int', y: 'int', glass: 'int', lock: 'int' } });
  R.defineEvent('glass_cracked', { fields: { by: 'uid', x: 'int', y: 'int', glass: 'int', hits: 'int', need: 'int' } });
  R.defineEvent('glass_broke', { fields: { by: 'uid', x: 'int', y: 'int', glass: 'int', shards: 'tiles', released: 'uid?' }, record: true });

  R.defineCause('opened', 'staff', { fields: { by: 'uid', grade: 'int' } });
  R.defineCause('case_opened', 'grade', { fields: { grade: 'int', lock: 'int' } });
  R.defineCause('glass_cracked', 'bash', { fields: { by: 'uid', form: 'str', count: 'int' } });
  R.defineCause('glass_broke', 'bash', { fields: { by: 'uid', form: 'str', count: 'int', hits: 'int', need: 'int' } });
  for (const k of ['staff_door', 'case_opened', 'bash', 'glass_broke']) R.defineCause('noise', k, { fields: { by: 'uid?', item: 'uid?' } });

  // A case wakes what it holds (§8.3): touched (opened or bashed), broken open, or dissolved.
  R.define('WAKE_CAUSES', 'touch_case', { mode: 'hunting', creation: false });
  R.define('WAKE_CAUSES', 'case_broken', { mode: 'hunting', creation: false });
  R.define('WAKE_CAUSES', 'dissolved', { mode: 'hunting', creation: false });
  const wake = { by: 'uid?', dist: 'int?', x: 'int?', y: 'int?', from: 'tile?', how: 'str?' };
  for (const k of ['touch_case', 'case_broken', 'dissolved']) for (const kind of ['woke', 'hunting']) R.defineCause(kind, k, { fields: wake });
})();
