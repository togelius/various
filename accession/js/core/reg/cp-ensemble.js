// ACCESSION — registry fragment: A.4's Centrepiece, mp_ensemble (the Ordinance) (BUILD.md §5.1,
// §5.5), owned by ENSEMBLE-CORE and then ENSEMBLE-PHASES. M4's skeleton made it; M4's Wave 0
// (W0a) moved here, verbatim from reg/system.js, the archetype's placeholder (its M2 clause, at
// ready false), and gave the phase event its cause for a special taken on (M4 plan A5).
// ENSEMBLE-CORE built the core: the rules are in js/core/rules/arch/mp_ensemble.js, the record
// in content/A4-cp.js, the scenarios in test/behaviour/mp_ensemble.test.js, and the invariants
// every Centrepiece keeps in test/behaviour/centrepiece.inv.js. ENSEMBLE-PHASES added
// inheritance, phase 3's shatter, its Clerk (an attachment, with the healer's own entries,
// reg/arch-d.js) and its gallery hook, scenarios in test/behaviour/mp_ensemble-phases.test.js.
'use strict';
(() => {
  const R = Registry;
  const TESTS = ['behaviour/mp_ensemble.test.js', 'behaviour/mp_ensemble-phases.test.js'];
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
  // (UI-PROGRESS) and before its strip is the phone's (LABELS-M4): BUILD §5.5 lists what
  // remains (the log tells a piece's modes as made where it stands since M4 TABLEAU-CORE:
  // Wake.stands); until then only tests place it (Centrepiece.place). lint-registry's word rules read this clause once it is past false,
  // and now under --strict=M4 (which it passes but for its readiness); mp_ensemble.test.js holds
  // its digits and its form, and the whole line it makes.
  // ENSEMBLE-PHASES added two sentences (M4 plan D3.3, decided without play; revisit once M4 is
  // playable). Inheritance, the sample's rule (design/samples.md §4.8): while the original
  // stands, when a copy falls, each piece still standing takes on every special the fallen copy
  // had that it lacks (rules/arch/mp_ensemble.js; a shatter only while a case of its hall is
  // intact, its phase part says why); the original's fall, and any after it, passes nothing on,
  // which is what the original first buys with copies_weaken on or off. Told by a phase event
  // with the cause `inherited` (below). The gallery hook (ENSEMBLE_HOOK_PCT; the sample's
  // originals are labelled "Companion piece to A.4.12"): each original destroyed in the
  // galleries (an exhibit some spare copies, not a piece of its own, whose every body is
  // destroyed, outside its hall) costs it ENSEMBLE_HOOK_PCT[0]% of its full health (its pieces'
  // maximums together, rounded down), for at most ENSEMBLE_HOOK_PCT[1] ÷ ENSEMBLE_HOOK_PCT[0]
  // originals, so at most ENSEMBLE_HOOK_PCT[1]% in all; its first piece standing loses it,
  // never its last point; with or without copies_weaken, whose rule is the spares'. It is taken
  // at the turn boundary after the original's fall (the hall's checks, Hall.addCheck), and told
  // by a damaged event with the cause `hook` (below), whose sentence names no piece.
  R.define('ARCHETYPES', 'mp_ensemble', { built: 'M4', ready: false, tests: TESTS, inv: 'centrepiece', icon: null,
    clause: 'Its {n} pieces stand fixed, each striking from beside you for {dmg} and holding its own equal whole share of its {hp} health, the original also any left over. The original’s number has no letter; its copies, its spares, have one. Its phases count all its pieces’ health together. While the original stands, a copy that falls passes its specials to each piece still standing that lacks them. Each original destroyed outside its hall costs it {hook}% of its full health, at most {most}% in all, from its first piece standing, never that piece’s last point.',
    params: { n: 'N:ENSEMBLE_PIECES', dmg: 'role:DMG', hp: 'role:HP', hook: 'N:ENSEMBLE_HOOK_PCT[0]', most: 'N:ENSEMBLE_HOOK_PCT[1]' }, covers: ['attacked', 'missed'] });

  // Its phase parts (§5.3's "From phase k: …"; Q10, its strip), one a phase. Phase 1, from the
  // start: the burst (cp_burst, its own registry entry, reg/centrepiece.js), which copies a and
  // b carry, said of them, since the original and copy c have none.
  R.define('CLAUSES', 'ens_burst', proved({ icon: null,
    clause: 'copies a and b each mark your tile and the tiles round it while they see you, then strike everything on them for {g} before Padding',
    params: { g: 'cp:ROLE_CENTREPIECE_SPECIAL_PCT' }, covers: ['telegraphed', 'special', 'damaged'] }));
  // Phase 2: the special phase 2 gives (the record's phases[1].specials, cp_burst) goes, as every
  // Centrepiece's does (Centrepiece.advance), to its first piece still standing as the phase
  // begins: in its pieces' order, the original, then the copies by letter. A copy that has it
  // already gains nothing; a copy that falls later while the original stands passes it on to
  // each piece still standing that lacks it, as it passes every special it has (inheritance,
  // the archetype's clause). As phase 2 begins, its Senior Countersigning Clerk (its record's
  // attachment), if it still sleeps, wakes hunting you (rules/arch/mp_ensemble.js's onPhase,
  // the cause `ensemble` below; the sample's phase 2, M4 plan D3.13, decided without play;
  // revisit once M4 is playable): it wakes as any exhibit does before then, as its own line
  // says, so this part says only that it wakes by then.
  R.define('CLAUSES', 'ens_gain', proved({ icon: null,
    clause: 'its first piece standing as the phase begins, the original or else the first copy left by letter, has the burst too, and its Senior Countersigning Clerk, if asleep, wakes',
    params: {}, covers: ['telegraphed', 'special', 'damaged'] }));
  // Phase 3: what every Centrepiece's third phase does (§8.1, Specials.cadence): each of its
  // pieces marks a special at most once every CP_SPECIAL_EVERY[1] of its actions, not
  // CP_SPECIAL_EVERY[0] (each piece's odds readout gives its cadence as it stands). Said here so
  // that the third phase's strip names what changes in it, and the line what the phase brings
  // before it comes (M4 ENSEMBLE-CORE's review).
  R.define('CLAUSES', 'ens_quick', proved({ icon: null,
    clause: 'each of its pieces marks a special at most once every {n} of its actions, not {was}',
    params: { n: 'N:CP_SPECIAL_EVERY[1]', was: 'N:CP_SPECIAL_EVERY[0]' }, covers: ['telegraphed', 'special', 'damaged'] }));
  // Phase 3 also gives its first piece still standing the shatter (the record's
  // phases[2].specials, shatter_all, below), the sample's phase-3 special, trimmed: every case
  // of its hall still intact is marked, then broken (no spares come out of them: the sample's
  // spares joining phase 3 are cut, M4 plan D3.7, and its hall holds none). Once no case of its
  // hall is intact, the shatter is spent: no piece holds it (rules/arch/mp_ensemble.js drops it
  // at once, with special {cancelled}, cause `spent`), so it never holds a piece's other specials
  // back as one that cannot be marked would (Specials.markNext).
  R.define('CLAUSES', 'ens_shatter', proved({ icon: null,
    clause: 'its first piece standing as the phase begins has a shatter too: it marks, then breaks, every intact case of its hall, and is spent once none is intact',
    params: {}, covers: ['telegraphed', 'special', 'glass_broke'] }));

  // The shatter (§8.1; the shape shatter_all, rules/arch/mp_ensemble.js): a mark that deals no
  // damage (effect shatter), on the tile of every case of its owner's hall still intact (a
  // Centrepiece's hall: dept.cp.room), made while it hunts, whether or not it sees you. At its
  // owner's next action (Specials' resolve, a hook: onResolve) each case still intact on a
  // marked tile breaks as a breaking bash breaks one (§8.3): it is broken, passable and loud,
  // what stood in it is released, its shards fall on the first floor or archway tile beside it
  // in direction order (Cases.spreadShards from its own tile, which is no longer floor), each
  // told by glass_broke with the cause `shatter`, then a crash from its tile. It is no bash: no
  // touch_case. Named a shatter in sentences (noun), and what it marks in its own words (marks).
  R.define('SPECIALS', 'shatter_all', proved({ icon: 'special', shape: 'shatter_all', effect: 'shatter', curve: null, range: null, every: null, noun: 'shatter',
    marks: 'every case of its hall still intact',
    clause: 'marks every case of its hall still intact, then breaks them all',
    params: {}, covers: ['telegraphed', 'special', 'glass_broke'] }));

  // Its phase event's cause (reg/centrepiece.js): `ensemble`, its pieces' health together fell to
  // a threshold (CP_PHASE_PCT, % of their full health together), by whoever hurt a piece (by),
  // or a piece fell and the copies lost heart; seen, whether you see the piece that gains the
  // phase's special (its first piece still standing, who), as the hall's waiting stage names
  // whom it is waiting for only if you see it: the sentence names that piece only then. Given
  // instead of the core's `damaged` (rules/arch/mp_ensemble.js), so no sentence names a piece of
  // the Ordinance you cannot see.
  R.defineCause('phase', 'ensemble', { fields: { by: 'uid?', seen: 'bool' }, built: 'M4' });

  // Its phase event's cause (reg/centrepiece.js): `inherited`, a piece (who) took on a special
  // (gained) of one that fell (from), in the phase it is in (phase: no phase is entered); seen,
  // whether you see the piece that took it on, judged as for `ensemble`: its sentence names that
  // piece only then (the fallen piece's fall is told by its own died sentence).
  R.defineCause('phase', 'inherited', { fields: { from: 'uid', seen: 'bool' }, built: 'M4' });

  // Its gallery hook (above): damaged {who: its first piece standing, amount, hp}, with the
  // cause `hook`, of the original destroyed outside its hall (of). No blow: it wakes no piece
  // and no one hears it (a phase 2 it brings wakes the Clerk, as every phase 2 does). (saved and
  // side, which every damage cause's schema accepts, never come.)
  R.defineCause('damaged', 'hook', { fields: { of: 'uid', saved: 'int?', side: 'str?' }, built: 'M4' });

  // The shatter going off (above): glass_broke {by: the piece whose shatter it was, x, y,
  // glass, shards, released}, with the cause `shatter` (sp, the special).
  R.defineCause('glass_broke', 'shatter', { fields: { by: 'uid', sp: 'str' }, built: 'M4' });

  // Its Clerk woken as phase 2 begins (ens_gain, above): woke {who: the Clerk, was: 'dormant',
  // mode: 'hunting'} and hunting {who, was: 'dormant'}, with the cause `ensemble` {phase}, the
  // phase the Ordinance entered (2). A wake cause of its own (WAKE_CAUSES, which the death
  // recap reads), into a hunt; no pips, no trigger.
  R.define('WAKE_CAUSES', 'ensemble', proved({ mode: 'hunting', creation: false }));
  R.defineCause('woke', 'ensemble', { fields: { phase: 'int' }, built: 'M4' });
  R.defineCause('hunting', 'ensemble', { fields: { phase: 'int' }, built: 'M4' });

  // A shatter spent (above): special {who: the piece that held it, sp, cancelled: true}, with
  // the cause `spent`, by that piece; seen, whether you see it, as for `ensemble`: its sentence
  // names that piece only then.
  R.defineCause('special', 'spent', { fields: { by: 'uid', seen: 'bool' }, built: 'M4' });
})();
