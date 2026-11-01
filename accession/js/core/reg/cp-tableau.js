// ACCESSION — registry fragment: M.11's Centrepiece, mp_tableau (the Great Board of the Central
// Station) (BUILD.md §5.1, §5.5), owned by TABLEAU-CORE. M4's skeleton made it; M4's Wave 0 (W0a)
// moved here, verbatim from reg/system.js, the archetype's placeholder (its M2 clause, at ready
// false). TABLEAU-CORE built its body: the rules are in js/core/rules/arch/mp_tableau.js, the
// record in content/M11-cp.js, the scenarios in test/behaviour/mp_tableau.test.js, and the
// invariants every Centrepiece keeps in test/behaviour/centrepiece.inv.js. TABLEAU-PHASES added
// its attachments' entries (below), which bring the hall's rain case into play.
'use strict';
(() => {
  const R = Registry;
  const TESTS = ['behaviour/mp_tableau.test.js'];
  // Proved joined up with the Great Board's own record in the real rules, every invariant on.
  const proved = more => Object.assign({ built: 'M4', ready: true, tests: TESTS, inv: 'centrepiece' }, more);

  // The Great Board (design/samples.md §2.8, trimmed; decided without play; revisit once M4 is
  // playable): one 2×2 body that never moves (neverSteps: no rule moves it, and the Window Pole
  // moves only a one-tile exhibit), striking from beside you with the role's blow, and its
  // specials, which take turns as every Centrepiece's do (Specials.markNext): at most one every
  // CP_SPECIAL_EVERY[0] of its actions in phases 1 and 2, in the order it has them (the order its
  // line gives them: its phases' parts, below), a special that cannot be marked when its turn
  // comes holding the next back until it can. Its form's rule (CLAUSES.cp_fight) follows this
  // clause. ready stays false (M4 plan PG-CORE's ordering constraint; TABLEAU-CORE's brief): once
  // it is past false, M.11's departments place it, and a Certificate comes within reach of hand
  // play before the perk choice has an interface (UI-PROGRESS) and before its strip is the
  // phone's (LABELS-M4): BUILD §5.5 lists what remains. Until then only tests place it
  // (Centrepiece.place). lint-registry's word rules read this clause under --strict=M4 (which it
  // passes but for its readiness); mp_tableau.test.js holds its digits and its form, and the
  // whole line it makes.
  R.define('ARCHETYPES', 'mp_tableau', { built: 'M4', ready: false, tests: TESTS, inv: 'centrepiece', icon: null,
    clause: 'Never moves, and strikes from beside you for {dmg}. Its specials take turns in the order given here, each waiting until it can be marked, at most one every {n} of its actions.',
    params: { dmg: 'role:DMG', n: 'N:CP_SPECIAL_EVERY[0]' }, covers: ['attacked', 'missed'] });

  // Its beam (§8.1; the shape cp_line, rules/arch/mp_tableau.js): while it sees you and you stand
  // in one of its rows or columns (a row or a column of its footprint), the line from its
  // footprint's tile there toward you, up to AXIS_BEAM_RANGE tiles, a beam: through glass,
  // stopping before what blocks sight, turned back along itself by a reflector. Its gross is a
  // Centrepiece's (cp:). Named a beam in sentences (noun), as a line is.
  R.define('SPECIALS', 'cp_line', proved({ icon: 'special', shape: 'cp_line', effect: 'damage', curve: 'cp:ROLE_CENTREPIECE_SPECIAL_PCT', range: 'AXIS_BEAM_RANGE', every: null, noun: 'beam',
    clause: 'while it sees you in one of its rows or columns, marks that line toward you as a beam, through glass, up to {range} tiles from it, then strikes everything on it for {gross} before Padding',
    params: { range: 'N:AXIS_BEAM_RANGE', gross: 'cp:ROLE_CENTREPIECE_SPECIAL_PCT' }, covers: ['telegraphed', 'special', 'damaged'] }));

  // A summons (§8.1; the shape summon, rules/arch/mp_tableau.js): a mark that deals no damage
  // (effect summon), on up to CP_SUMMON[1] free tiles of its owner's room beside it, those
  // nearest where it last knew you were, made only with CP_SUMMON[0] or more free there; at its
  // next action a body of the species its record names (summons) comes onto each still free,
  // hunting you (its creation cause summoned, how 'summon'). While it is marked its owner takes
  // CP_SUMMON_DMG_PCT% of the damage dealt to it ("double damage", tied to that row). Named a
  // summons in sentences (noun). The Great Board's line says it in its own words, naming its
  // body (CLAUSES.tab_summon); this is the special's own clause.
  R.define('SPECIALS', 'summon', proved({ icon: 'special', shape: 'summon', effect: 'summon', curve: null, range: null, every: null, noun: 'summons',
    clause: 'with {fewest} or more free tiles of its room beside it, marks up to {most} of them, those nearest where it last knew you were, then calls a body onto each still free; while they are marked it takes double damage',
    params: { fewest: 'N:CP_SUMMON[0]', most: 'N:CP_SUMMON[1]' }, phrases: { 'double damage': 'N:CP_SUMMON_DMG_PCT' }, covers: ['telegraphed', 'special'] }));

  // Its phase parts (§5.3's "From phase k: …"; Q10, its strip), one a phase. Phase 1, from the
  // start: its beam and its burst (SPECIALS.cp_line, SPECIALS.cp_burst, as the record lists
  // them). Phase 2: the summons it gains (the record's phases[1].specials), in its own words:
  // its hall is its room, and its body M.11's Logbook Trolley (the record's summons, which
  // mp_tableau.test.js holds to these words).
  R.define('CLAUSES', 'tab_summon', proved({ icon: null,
    clause: 'with {fewest} or more free tiles of its hall beside it, marks up to {most} of them, those nearest where it last knew you were, then calls a Logbook Trolley out of its frame onto each still free; while they are marked it takes double damage',
    params: { fewest: 'N:CP_SUMMON[0]', most: 'N:CP_SUMMON[1]' }, phrases: { 'double damage': 'N:CP_SUMMON_DMG_PCT' }, covers: ['telegraphed', 'special'] }));
  // Phase 3: what every Centrepiece's third phase does (§8.1, Specials.cadence): it marks a
  // special at most once every CP_SPECIAL_EVERY[1] of its actions, not CP_SPECIAL_EVERY[0] (its
  // odds readout gives its cadence as it stands), said so that the third phase's strip names
  // what changes in it (as the Ordinance's ens_quick does).
  R.define('CLAUSES', 'tab_quick', proved({ icon: null,
    clause: 'it marks a special at most once every {n} of its actions, not {was}',
    params: { n: 'N:CP_SPECIAL_EVERY[1]', was: 'N:CP_SPECIAL_EVERY[0]' }, covers: ['telegraphed', 'special', 'damaged'] }));

  // ---- Its attachments (TABLEAU-PHASES; design/samples.md §2.8, trimmed; decided without
  // play; revisit once M4 is playable): the Repeater Arm (M11.11a), a station like M11.2, with
  // M11.2's line and no word of its own; and the Board Dish (M11.11b), a reflector with this
  // modifier. Each is an exhibit of its own, no piece of the Board (rules/arch/mp_tableau.js,
  // the record in content/M11-cp.js, the scenarios in test/behaviour/mp_tableau-phases.test.js).
  const PHASES = ['behaviour/mp_tableau-phases.test.js'];
  const phases = more => Object.assign({ built: 'M4', ready: true, tests: PHASES, inv: 'centrepiece' }, more);
  // The Board Dish's own rule (the modifier's hooks, rules/arch/mp_tableau.js: onPhase wakes
  // it, act keeps it in front of the Board): the Board's second phase wakes it at once, hunting
  // you (WAKE_CAUSES.tab_phase); hunting you while the Board stands, it strikes you if it can,
  // and otherwise walks toward the free tile of the hall beside the Board nearest where it last
  // knew you were and waits there, so it stands between you and the Board and sends your shots
  // at the Board back (its archetype's, the reflector's, §8.1). Switched off (rulesOff), it is
  // a reflector like any other, and its line says nothing of the Board.
  R.define('MODIFIERS', 'tab_screen', phases({ icon: null,
    clause: 'The Great Board’s second phase wakes it at once, hunting you; hunting while the Board stands, it strikes you if it can, else walks toward the free tile of the hall beside the Board nearest where it last knew you were, and waits there.',
    params: {}, covers: ['woke', 'hunting', 'moved'] }));
  // The waking the Board's second phase gives it (§8.2's wake causes; Wake.wake, into a hunt
  // that knows your tile): by the Board.
  R.define('WAKE_CAUSES', 'tab_phase', phases({ mode: 'hunting', creation: false }));
  for (const kind of ['woke', 'hunting']) R.defineCause(kind, 'tab_phase', { fields: { by: 'uid' }, built: 'M4' });
})();
