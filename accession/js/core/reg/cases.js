// ACCESSION — registry fragment: cases, glass, locks and staff doors (BUILD.md §8.3), owned
// by W1-CASES. The touch_case trigger, the case and staff-door fixtures, the three glasses
// (each with the clause a label shows), the refusals, the case events and the wake causes a
// case gives.
'use strict';
(() => {
  const R = Registry;
  // Where each entry is proved: its scenarios and rule tests, and the invariants checked
  // after every step of every scenario, monkey and bot (test/behaviour/cases.inv.js).
  const TESTS = ['m3-cases.test.js', 'm3-cases-sweep.test.js', 'behaviour/touch_case.test.js'];
  const proved = extra => Object.assign({ ready: 'unit', tests: TESTS.slice(), inv: 'cases' }, extra);

  // A species' trigger (§8.2): opening its case, or any bash at it, adds PIPS_TO_WAKE pips,
  // so it wakes at once, hunting, before the action's noise; Solvent never touches it.
  R.define('TRIGGERS', 'touch_case', proved({ icon: 'touch_case', clause: 'wakes at once, hunting you, when its case is opened or bashed',
    params: {}, covers: ['pip', 'woke', 'hunting'] }));

  // Refusals (§4.2): nothing walks into, or strikes into or out of, an intact case (§8.3), so a
  // bump into a case, fixed glazing or a mimic in its disguise is refused alike; open(x, y)
  // and bash(x, y) need an intact case beside you, past no corner (no_case; the backbone's
  // out_of_reach and corner), a lock within your grade to open it, and glass your weapon can
  // break to bash it; a staff door above your grade is a wall to you.
  R.define('REFUSALS', 'behind_glass', proved({}));
  R.define('REFUSALS', 'no_case', proved({}));
  R.define('REFUSALS', 'case_locked', proved({}));
  R.define('REFUSALS', 'glass_too_strong', proved({}));
  R.define('REFUSALS', 'staff_grade', proved({}));

  // The fixtures, each with the clause of its rules that its label shows (Cases.rules).
  R.define('FIXTURES', 'case', proved({ icon: null,
    clause: 'Opens for {open} ticks and a soft noise if your grade reaches its lock. A bash costs {bash} ticks ({heavy} for a Heavy weapon, whose swing counts as two bashes) and makes a loud noise; the bash that breaks it makes a crash, frees what is inside and leaves shards on your side. A Light weapon cannot break Laminated or Security glass.',
    params: { open: 'N:COST_OPEN_CASE', bash: 'N:COST_BASH', heavy: 'N:COST_BASH_HEAVY' }, covers: ['case_opened', 'glass_cracked', 'glass_broke', 'noise'] }));
  R.define('FIXTURES', 'staff', proved({ icon: null,
    clause: 'Opens for {cost} ticks and a soft noise if your grade reaches its own; below that it is a wall. Exhibits never pass a staff door.',
    params: { cost: 'N:COST_DOOR' }, covers: ['opened', 'noise'] }));

  // The glasses, in order; n indexes the GLASS_BASHES, GLASS_MIX_D*, GLASS_LOCK_MIN and
  // GLASS_LOCK_MAX rows (§8.10), and a case fixture's `glass` is n.
  const glass = (id, n, name) => R.define('GLASS', id, proved({ n, name, icon: null,
    clause: `${name} glass breaks after {bashes} bash${n === 1 ? '' : 'es'}; its lock is drawn from grade {lo} to {hi}.`,
    params: { bashes: `N:GLASS_BASHES[${n - 1}]`, lo: `N:GLASS_LOCK_MIN[${n - 1}]`, hi: `N:GLASS_LOCK_MAX[${n - 1}]` }, covers: ['glass_cracked', 'glass_broke'] }));
  glass('plate', 1, 'Plate');
  glass('laminated', 2, 'Laminated');
  glass('security', 3, 'Security');

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
  // Each wakes it hunting. `how` is 'opened' or 'bashed' for a touch; `itself` marks the
  // mimic, whose case is the mimic itself.
  R.define('WAKE_CAUSES', 'touch_case', proved({ mode: 'hunting', creation: false }));
  R.define('WAKE_CAUSES', 'case_broken', proved({ mode: 'hunting', creation: false }));
  R.define('WAKE_CAUSES', 'dissolved', proved({ mode: 'hunting', creation: false }));
  const wake = { by: 'uid?', dist: 'int?', x: 'int?', y: 'int?', from: 'tile?', how: 'str?', itself: 'bool?' };
  for (const k of ['touch_case', 'case_broken', 'dissolved']) for (const kind of ['woke', 'hunting']) R.defineCause(kind, k, { fields: wake });
  // touch_case wakes at once, through Wake.addPips +3, whose pip event carries the same cause.
  R.defineCause('pip', 'touch_case', { fields: wake });
})();
