// ACCESSION — registry fragment: A.4's Centrepiece, mp_ensemble (the Ordinance) (BUILD.md §5.1,
// §5.5), owned by ENSEMBLE-CORE. M4's skeleton made it; M4's Wave 0 (W0a) moved here, verbatim
// from reg/system.js, the archetype's placeholder (its M2 clause, at ready false), and gave the
// phase event its cause for a special taken on (M4 plan A5). ENSEMBLE-CORE built the core: the
// rules are in js/core/rules/arch/mp_ensemble.js, the record in content/A4-cp.js, the scenarios
// in test/behaviour/mp_ensemble.test.js, and the invariants every Centrepiece keeps in
// test/behaviour/centrepiece.inv.js. ENSEMBLE-PHASES adds inheritance and the hooks.
'use strict';
(() => {
  const R = Registry;
  const TESTS = ['behaviour/mp_ensemble.test.js'];
  // Proved joined up with the Ordinance's own record in the real rules, every invariant on.
  const proved = more => Object.assign({ built: 'M4', ready: true, tests: TESTS, inv: 'centrepiece' }, more);

  // The Ordinance (Q8, decided without play; revisit once M4 is playable): ENSEMBLE_PIECES
  // one-tile pieces on its 2×2 footprint, which never step (so no rule and no Window Pole moves
  // them), each striking from beside you with the role's blow, each holding its own share of the
  // role's health (Centrepiece.place: an equal whole share each, the first piece, the original,
  // also the rest). Its record's pieces name the original first, then the certified copies by
  // letter, each with its own name, number and tombstone, so its label says which it is. The
  // copies are the original's spares, one copy group (CopiesWeaken.addGroup): with
  // copies_weaken on, its part on this line, by the record's flag, says what the original's fall
  // costs them. Its phases count all its pieces' health, and their full health, together
  // (Centrepiece.health). Its form's rule (CLAUSES.cp_fight) follows this clause; its phases'
  // parts (below) say what each phase gives. ready stays false (M4 plan PG-CORE's ordering
  // constraint, ENSEMBLE-CORE's brief): once it is past false, A.4's departments place it, and a
  // Certificate comes within reach of hand play before the perk choice has an interface
  // (UI-PROGRESS), and before its strip is the phone's (LABELS-M4); until then only tests place
  // it (Centrepiece.place). lint-registry's word rules read this clause once it is past false,
  // and now under --strict=M4 (which it passes but for its readiness); mp_ensemble.test.js holds
  // its digits and its form, and the whole line it makes.
  R.define('ARCHETYPES', 'mp_ensemble', { built: 'M4', ready: false, tests: TESTS, inv: 'centrepiece', icon: null,
    clause: 'Its {n} pieces stand fixed, each striking from beside you for {dmg} and holding its own equal whole share of its {hp} health, the original also any left over. The original’s number has no letter; its copies, its spares, have one. Its phases count all its pieces’ health, and their full health, together.',
    params: { n: 'N:ENSEMBLE_PIECES', dmg: 'role:DMG', hp: 'role:HP' }, covers: ['attacked', 'missed'] });

  // Its phase parts (§5.3's "From phase k: …"; Q10, its strip). Phase 1, from the start: the
  // burst (cp_burst, its own registry entry, reg/centrepiece.js), which copies a and b carry,
  // said of them, since the original and copy c have none.
  R.define('CLAUSES', 'ens_burst', proved({ icon: null,
    clause: 'copies a and b each mark your tile and the tiles round it while they see you, then strike everything on them for {g} before Padding',
    params: { g: 'cp:ROLE_CENTREPIECE_SPECIAL_PCT' }, covers: ['telegraphed', 'special', 'damaged'] }));
  // Phase 2: the special phase 2 gives (the record's phases[1].specials, cp_burst) goes, as every
  // Centrepiece's does (Centrepiece.advance), to its first piece still standing as the phase
  // begins: in its pieces' order, the original, then the copies by letter. A copy that has it
  // already gains nothing; one that falls later does not pass it on (inheritance is
  // ENSEMBLE-PHASES').
  R.define('CLAUSES', 'ens_gain', proved({ icon: null,
    clause: 'its first piece standing as the phase begins, the original or else the first copy left by letter, has the burst too',
    params: {}, covers: ['telegraphed', 'special', 'damaged'] }));

  // Its phase event's cause (reg/centrepiece.js): `ensemble`, its pieces' health together fell to
  // a threshold (CP_PHASE_PCT, % of their full health together), by whoever hurt a piece (by),
  // or a piece fell and the copies lost heart; seen, whether you see the piece that gains the
  // phase's special (its first piece still standing, who), as the hall's waiting stage names
  // whom it is waiting for only if you see it: the sentence names that piece only then. Given
  // instead of the core's `damaged` (rules/arch/mp_ensemble.js), so no sentence names a piece of
  // the Ordinance you cannot see.
  R.defineCause('phase', 'ensemble', { fields: { by: 'uid?', seen: 'bool' }, built: 'M4' });

  // Its phase event's cause (reg/centrepiece.js): `inherited`, a piece took on the special of
  // one that fell (from). ENSEMBLE-PHASES' (a fallen piece's special inherited).
  R.defineCause('phase', 'inherited', { fields: { from: 'uid?' }, built: 'M4' });
})();
