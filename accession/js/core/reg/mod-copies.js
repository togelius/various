// ACCESSION — registry fragment: the module copies_weaken: the weakened spares (BUILD.md §5.1,
// §5.4), owned by MOD-COPIES. M4's skeleton made it; M4's Wave 0 (W0a) moved here, verbatim
// from reg/system.js, the module's panel sentence, and gave it its keywords and its event's
// cause. MOD-COPIES built the rest: the rules are in js/core/rules/modules/copies_weaken.js;
// the scenarios that prove the clause in test/behaviour/copies_weaken.test.js, and the
// invariants in test/behaviour/copies.inv.js.
'use strict';
(() => {
  const R = Registry;

  // The module (§5.4). Its panel sentence teaches the rule whole, a template over its params
  // (§5.4: "the panel sentence, a template over params"): what an original's fall does to its
  // spares, and to any body split from one. Its keywords name its rule (the Intro lint).
  // Its part on the line of a species flagged with it (A.4's Seated Clerks and Proposing
  // Trustees, each original and its spares: one clause for both, so it is said of the group,
  // true on either line), a sentence of its own: what a spare loses, said exactly where a
  // player could misread it (a weakening never destroys: "never its last point"), and a
  // spare's blow once weakened (spare:DMG, §5.3: the damage a weakened spare of the species'
  // group deals at the depth), so the line stays true of a spare that has lost heart, whose
  // blow it would otherwise overstate. "Each spare" is each body of one: a body split from a
  // spare is the spare (§8.1: a half is the same exhibit, and its label names it so), and the
  // panel sentence says it in full; the line has no room to (§5.3's length: the Trustee's
  // line, splitter, brute, marble and ally_hit, takes 14 rows with it). "Until you leave" is
  // slowed's 'perm' (M4 plan D1.4), as its label says it.
  // It covers module (each weakening, whose cause names the original, by) and status (the
  // slowing, by the original): the soak's completeness reads an event's cause's by, so the
  // original's line covers them, and the module event's who, the spare's line.
  R.define('MODULES', 'copies_weaken', { built: 'M4', ready: true, tests: ['behaviour/copies_weaken.test.js'], inv: 'copies', icon: null,
    sentence: 'When an original is destroyed, its spares lose heart: each, and any body split from one, loses {COPY_WEAKEN_PCT}% of its health and damage and {COPY_WEAKEN_ACC} Acc, and is slowed until you leave.',
    keywords: ['spare', 'lose heart'],
    clause: 'When its group’s original is destroyed, each spare loses {COPY_WEAKEN_PCT}% of its health and damage, never its last point (blows then {weak}), and {COPY_WEAKEN_ACC} Acc, and is slowed until you leave.',
    params: { COPY_WEAKEN_PCT: 'N:COPY_WEAKEN_PCT', weak: 'spare:DMG', COPY_WEAKEN_ACC: 'N:COPY_WEAKEN_ACC' },
    covers: ['module', 'status'] });

  // Its module event (reg/system.js): rules `weaken` (a spare, or a body split from one, lost
  // heart, its original destroyed: who) and `split` (a body split from one that had lost heart
  // is slowed too: who); the cause names the original (by: its first body's uid), so that the
  // log tells the spares of one original in one line, and those of two originals in two.
  R.defineCause('module', 'copies_weaken', { fields: { by: 'uid?' }, built: 'M4' });
  // The slowing (status slowed, for the rest of the visit), by the original whose fall caused it.
  R.defineCause('status', 'copies_weaken', { fields: { by: 'uid' }, built: 'M4' });
})();
