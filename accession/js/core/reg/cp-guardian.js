// ACCESSION — registry fragment: S.9's Centrepiece, completing_guardian (the Composite), with its
// limbs and its treasure (BUILD.md §5.1, §5.5), owned by COMPOSITE-CORE. M4's skeleton made it;
// M4's Wave 0 (W0a) moved here, verbatim from reg/system.js, the archetype's placeholder, and gave
// the phase event its causes for the limbs (M4 plan A5). COMPOSITE-CORE built the core: the rules
// are in js/core/rules/arch/completing_guardian.js, the record in content/S9-cp.js, the scenarios
// in test/behaviour/completing_guardian.test.js, and the invariants every Centrepiece keeps in
// test/behaviour/centrepiece.inv.js. COMPOSITE-PHASES added its phases (their limbs, the alarm,
// the crest), the leave-heal and its treasure (rules/treasure.js: the seal, the carry-out, the
// dust sheet over its case), with the scenarios in test/behaviour/completing_guardian-phases.
// test.js and refusals-treasure.test.js.
'use strict';
(() => {
  const R = Registry;
  const TESTS = ['behaviour/completing_guardian.test.js', 'behaviour/completing_guardian-phases.test.js'];
  // Proved joined up with the Composite's own record in the real rules, every invariant on.
  const proved = more => Object.assign({ built: 'M4', ready: true, tests: TESTS, inv: 'centrepiece' }, more);
  const GROSS = 'cp:ROLE_CENTREPIECE_SPECIAL_PCT';
  const HITS = ['telegraphed', 'special', 'damaged'];

  // The Composite (design/samples.md §3.8, trimmed; M4 plan D3.5, D3.6, D3.14, decided without
  // play; revisit once M4 is playable): one 2×2 body of the role centrepiece. Its record's
  // trigger, touch_case, wakes it, hunting, when the Lamp's case, which it guards (its `guards`,
  // set at its init: Cases.touch touches what guards a case), is opened or bashed; so its clause
  // names that case as its own; and a view that puts it under its dust sheet closes that case
  // too (rules/treasure.js's refuser: no opening, bashing, taking from it, aiming at it or
  // throwing a Solution onto it or beside it). It never leaves its hall (mayStep), and while you
  // stand outside the hall it starts no fight with you: its limbs mark nothing (each limb's shape
  // asks that you stand in the hall) and it strikes no blow; hunting, it walks back to its place
  // (its home) while it sees you and waits there, and once it does not, or searching, it goes
  // back (lost, cause outside), so the log never says it searched where it could not go. Its
  // clause says that only of it hunting or searching for you: awake, sent by a noise to look, it
  // looks as far as its hall's edge before it goes back (M4 COMPOSITE-CORE's review). Leaving its
  // hall while it hunts you (a turn's end finding you out of it after one that found you in it,
  // hunted; a Ticket's leaving too) heals it GUARDIAN_LEAVE_HEAL_PCT% of its full health and
  // drops its last limb (COMPOSITE-PHASES). Its hall's seal is its treasure's
  // (rules/treasure.js): while it hunts you in its hall, from TREASURE_SEAL_TURNS turns after its
  // case is first opened or bashed, or at TREASURE_SEAL_HP_PCT% of its full health or less,
  // once no one stands in an opening; the rule names it as no stage's `by`, so
  // this clause need not cover `stage`. Its limbs are its specials, in the order it grows them,
  // marked in turn (Centrepiece.act, CP_SPECIAL_EVERY), each only while you stand on one of the
  // tiles it would mark: its neck, legs and tail each a Centrepiece's gross, its crest a call, as
  // a herald's (HERALD_RANGE: it wakes every sleeper on its tiles that can hear, sent to look
  // where you stood; never a Centrepiece's piece, which in S.9 is only itself, awake as its crest
  // goes off, so its line need not say so); how it grows them is its phases' parts
  // (CLAUSES.guardian_limbs from the start, the strip's in phase 1; guardian_grow_alarm in
  // phase 2, with its alarm; guardian_grow in phase 3), so this clause leaves their order to
  // them. Its form's rule (CLAUSES.cp_treasure) follows this clause. (Its label is long, 57 rows
  // at depth 7, most of them the shared clauses' and the alarm's part; M4 COMPOSITE-PHASES'
  // review trimmed what this clause said twice, from 59.) ready stays false, so no department
  // places it, until what the Ordinance's and the Board's wait for (§5.5): the perk choice a
  // Certificate brings has an interface (UI-PROGRESS), and a Centrepiece's strip is the phone's
  // and its lectern's and sheet's labels exist (LABELS-M4); until then only tests place it
  // (Centrepiece.place). lint-registry's word rules read this clause under --strict=M4 (which it
  // passes but for its readiness); completing_guardian.test.js and
  // completing_guardian-phases.test.js hold its digits and the line it makes.
  R.define('ARCHETYPES', 'completing_guardian', { built: 'M4', ready: false, tests: TESTS, inv: 'centrepiece', icon: null,
    clause: 'Its case is the Lamp’s, which it guards, and a view that puts it under its dust sheet closes that case too. It never leaves its hall, and while you are outside the hall it starts no fight with you: hunting or searching for you, it goes back to its place. Leave its hall while it hunts you, and it regains {heal}% of its full health and drops its last limb. Hunting you in its hall, it seals you in with it once no one stands in an opening, from {turns} turns after its case is opened or bashed, or at {low}% of its full health or less. It strikes from beside you for {dmg}. Its limbs’ specials come in turn, each marked only while you stand on one of its tiles: its neck marks the tiles round it on your side, its legs a lane as wide as it toward you, up to {range} tiles and never through a case, and its tail all the tiles round it, each then striking everything on them for {g} before Padding, and its legs then charge down the lane, stopping short of anyone in it; its crest marks every tile within {call} tiles of it, then wakes every sleeping exhibit on them that can hear, sent to look where you stood.',
    params: { heal: 'N:GUARDIAN_LEAVE_HEAL_PCT', turns: 'N:TREASURE_SEAL_TURNS', low: 'N:TREASURE_SEAL_HP_PCT', dmg: 'role:DMG', g: GROSS, range: 'N:CHARGE_RANGE', call: 'N:HERALD_RANGE' },
    covers: ['attacked', 'missed', 'telegraphed', 'special', 'damaged', 'healed'] });

  // Its limbs (§8.1's specials, Specials' shapes added in rules/arch/completing_guardian.js), in
  // the order it has them (Guardian.LIMBS): the first three each a Centrepiece's gross (cp:), the
  // crest a call; each named by its limb in sentences (noun) and its mark said in words (marks). Each is marked only while you stand
  // in its hall on one of the tiles it would mark, so no limb is marked at you from outside it.
  //   cp_sweep, its neck: the tiles round its footprint on your side of it (Grid.hold, never an
  //     intact case's), you among them;
  //   cp_charge, its legs: the lane, as wide as it, from its side toward you, of up to
  //     CHARGE_RANGE rows of tiles of its hall it could step onto (never a case's, nor past a
  //     wall or a closed door), you on it; when it goes off, after striking, it runs along the
  //     lane row by row until someone stands in its way or the lane ends (the shape's after);
  //   cp_ring, its tail: the tiles round its footprint (the ring's), you among them;
  //   cp_call, its crest: a call (no damage), as a herald's: every tile an exhibit could stand
  //     on within HERALD_RANGE of it (Specials' call shape), you among them; when it goes off,
  //     every sleeping exhibit on them that can hear, never a Centrepiece's piece, wakes awake,
  //     sent to look at your tile (the Composite's onResolve; cause herald).
  const limb = (id, shape, noun, marks, clause, more) => R.define('SPECIALS', id, proved(Object.assign({ icon: 'special', shape, effect: 'damage', curve: GROSS,
    range: null, every: null, noun, marks, clause, params: { gross: GROSS }, covers: HITS }, more || {})));
  limb('cp_sweep', 'sweep', 'neck', 'the tiles round it on your side',
    'its neck marks the tiles round it on your side while you stand on one, then strikes everything on them for {gross} before Padding');
  limb('cp_charge', 'charge', 'legs', 'a lane toward you',
    'its legs mark a lane as wide as it toward you, up to {range} tiles and never through a case, while you stand on it, then strike everything on it for {gross} before Padding, and it charges down the lane, stopping short of anyone in it',
    { range: 'CHARGE_RANGE', params: { gross: GROSS, range: 'N:CHARGE_RANGE' } });
  limb('cp_ring', 'tail', 'tail', 'the tiles round it',
    'its tail marks all the tiles round it while you stand on one, then strikes everything on them for {gross} before Padding');
  R.define('SPECIALS', 'cp_call', proved({ icon: 'special', shape: 'crest', effect: 'hook', curve: null, range: 'HERALD_RANGE', every: null, noun: 'crest',
    marks: 'the tiles its call reaches', params: { HERALD_RANGE: 'N:HERALD_RANGE' }, covers: ['telegraphed', 'special', 'woke'],
    clause: 'its crest marks every tile within {HERALD_RANGE} tiles of it while you stand on one, then wakes every sleeping exhibit on them that can hear, sent to look where you stood' }));

  // Its phase parts (§5.3's "From phase k: …"; Q10, its strip). Phase 1, from the start: how it
  // grows its limbs, so the phone's strip says it while it waits for you (FU1): one for every
  // GUARDIAN_PER_STAGE galleries you have walked (the rooms of the department that hold a
  // gallery and that you have stood in, the one you start in and its own hall among them:
  // Guardian.galleries), its neck, then its legs, and walking grows no other (Guardian.WALKED,
  // within GUARDIAN_STAGE_MAX; a test keeps it so): S.9's departments hold five gallery rooms,
  // so a tail for six would be a promise walking never keeps (M4 COMPOSITE-CORE's review,
  // decided without play; revisit once M4 is playable). Its tail and its crest come from its
  // phases (guardian_grow_alarm, guardian_grow, below; COMPOSITE-PHASES).
  R.define('CLAUSES', 'guardian_limbs', proved({ icon: null,
    clause: 'it grows a limb, each a special, for every {per} galleries you have walked, the one you start in and its own hall among them: first its neck, then its legs, and walking grows no other',
    params: { per: 'N:GUARDIAN_PER_STAGE' }, covers: ['phase'] }));
  // Phase 3: what every Centrepiece's third phase does (§8.1, Specials.cadence): it marks a special
  // at most once every CP_SPECIAL_EVERY[1] of its actions, not CP_SPECIAL_EVERY[0] (its odds
  // readout gives its cadence as it stands), said here so that the third phase's strip names what
  // changes in it.
  R.define('CLAUSES', 'guardian_quick', proved({ icon: null,
    clause: 'it marks a limb’s special at most once every {n} of its actions, not {was}',
    params: { n: 'N:CP_SPECIAL_EVERY[1]', was: 'N:CP_SPECIAL_EVERY[0]' }, covers: ['telegraphed', 'special', 'damaged'] }));

  // Phases 2 and 3 (§5.5: "the Composite gains one stage", plan D3.5's limb at phase 2 and the
  // sample's at phase 3; COMPOSITE-PHASES, decided without play; revisit once M4 is playable):
  // each grows its next limb (Guardian.gain: the next of neck, legs, tail and crest it lacks,
  // while it has fewer than GUARDIAN_STAGE_MAX), so its tail and its crest come only from them.
  // Phase 2's part also holds the slot for alarm_network, which its record is flagged with:
  // with the module on, the module's part, in the Wader's words (MODULES.alarm_network:
  // "chases you, first showing the alarm for a turn and raising it unless one is shown or
  // running: …"), which is true of it from then on: hunting you in its hall and seeing you, it
  // shows the alarm on its own tiles, and its next action sets it off (the Composite's act and
  // onResolve); with it off, "chases you as before", as it does in its hall in every phase.
  // Phase 2's strip takes 14 rows with the module on (the budget's: about 12 characters to
  // spare), 3 with it off.
  R.define('CLAUSES', 'guardian_grow_alarm', proved({ icon: null, clause: 'it grows its next limb, and in its hall it {module:alarm_network|chases you as before}', params: {}, covers: ['phase'] }));
  R.define('CLAUSES', 'guardian_grow', proved({ icon: null, clause: 'it grows its next limb', params: {}, covers: ['phase'] }));

  // Its phase event's causes (reg/centrepiece.js): `walked`, a limb grown for the galleries you
  // have walked (n of them: its stage, the limbs it has, and the limb gained, a SPECIALS id, are
  // the event's), within the phase it is in (it enters none); `limb`, the limb a phase it
  // entered grew (stage and gained, as walked's), told after that phase's own event, in it;
  // `left`, you left its hall while it hunted you, so it dropped its last limb (limb, a SPECIALS
  // id; stage, the limbs left), within the phase it is in.
  R.defineCause('phase', 'walked', { fields: { n: 'int?' }, built: 'M4' });
  R.defineCause('phase', 'limb', { fields: {}, built: 'M4' });
  R.defineCause('phase', 'left', { fields: { limb: 'str?' }, built: 'M4' });
  // Its heal as you leave its hall while it hunts you (GUARDIAN_LEAVE_HEAL_PCT of its maximum).
  R.defineCause('healed', 'left', { fields: {}, built: 'M4' });

  // A change of its mode (§8.2; rules/arch/completing_guardian.js): hunting or searching for you
  // while you stand outside its hall, out of its sight or searching, it goes back to its place
  // (lost, to returning), since it never leaves the hall.
  R.defineCause('lost', 'outside', { fields: {}, built: 'M4' });
})();
