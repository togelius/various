// ACCESSION — registry fragment: S.9's Centrepiece, completing_guardian (the Composite), with its
// limbs and its treasure (BUILD.md §5.1, §5.5), owned by COMPOSITE-CORE. M4's skeleton made it;
// M4's Wave 0 (W0a) moved here, verbatim from reg/system.js, the archetype's placeholder, and gave
// the phase event its causes for the limbs (M4 plan A5). COMPOSITE-CORE built the core: the rules
// are in js/core/rules/arch/completing_guardian.js, the record in content/S9-cp.js, the scenarios
// in test/behaviour/completing_guardian.test.js, and the invariants every Centrepiece keeps in
// test/behaviour/centrepiece.inv.js. COMPOSITE-PHASES adds its phases and the treasure.
'use strict';
(() => {
  const R = Registry;
  const TESTS = ['behaviour/completing_guardian.test.js'];
  // Proved joined up with the Composite's own record in the real rules, every invariant on.
  const proved = more => Object.assign({ built: 'M4', ready: true, tests: TESTS, inv: 'centrepiece' }, more);
  const GROSS = 'cp:ROLE_CENTREPIECE_SPECIAL_PCT';
  const HITS = ['telegraphed', 'special', 'damaged'];

  // The Composite (design/samples.md §3.8, trimmed; M4 plan D3.5, decided without play; revisit
  // once M4 is playable): one 2×2 body of the role centrepiece. Its record's trigger, touch_case,
  // wakes it, hunting, when the Lamp's case, which it guards (its `guards`, set at its init:
  // Cases.touch touches what guards a case), is opened or bashed; so its clause names that case
  // as its own. It never leaves its hall (mayStep), and while you stand outside the hall it
  // starts no fight with you: its limbs mark nothing (each limb's shape asks that you stand in
  // the hall) and it strikes no blow; hunting, it walks back to its place (its home) while it
  // sees you and waits there, and once it does not, or searching, it goes back (lost, cause
  // outside), so the log never says it searched where it could not go. Its clause says that
  // only of it hunting or searching for you: awake, sent by a noise to look, it looks as far as
  // its hall's edge before it goes back (M4 COMPOSITE-CORE's review). Its limbs are its
  // specials, marked in turn (Centrepiece.act, CP_SPECIAL_EVERY), each only while you stand on
  // one of the tiles it would mark, each a Centrepiece's gross; how it grows them is its first
  // phase's part (CLAUSES.guardian_limbs), the strip's in phase 1. Its form's rule
  // (CLAUSES.cp_treasure) follows this clause. ready stays false: once it is past false, S.9's
  // departments place it, and its line (the treasure clause) promises a Certificate for carrying
  // the Lamp out of its hall, which only COMPOSITE-PHASES' carry-out gives (and the hall's seal
  // that its fall opens, the treasure's seal, is theirs too); until then only tests place it
  // (Centrepiece.place). lint-registry's word rules read this clause under --strict=M4 (which it
  // passes but for its readiness); completing_guardian.test.js holds its digits and the line it
  // makes.
  R.define('ARCHETYPES', 'completing_guardian', { built: 'M4', ready: false, tests: TESTS, inv: 'centrepiece', icon: null,
    clause: 'Its case is the Lamp’s, which it guards; it never leaves its hall, and while you are outside the hall it starts no fight with you: hunting or searching for you, it goes back to its place. It strikes from beside you for {dmg}. Its limbs’ specials come in turn, each marked only while you stand on one of its tiles, then striking everything on them for {g} before Padding: its neck marks the tiles round it on your side; its legs, a lane as wide as it toward you, up to {range} tiles and never through a case, then it charges down the lane, stopping short of anyone in it; its tail, all the tiles round it.',
    params: { dmg: 'role:DMG', g: GROSS, range: 'N:CHARGE_RANGE' }, covers: ['attacked', 'missed', 'telegraphed', 'special', 'damaged'] });

  // Its limbs (§8.1's specials, Specials' shapes added in rules/arch/completing_guardian.js), in
  // the order it has them (Guardian.LIMBS): each a Centrepiece's gross (cp:), named by its limb
  // in sentences (noun) and its mark said in words (marks). Each is marked only while you stand
  // in its hall on one of the tiles it would mark, so no limb is marked at you from outside it.
  //   cp_sweep, its neck: the tiles round its footprint on your side of it (Grid.hold, never an
  //     intact case's), you among them;
  //   cp_charge, its legs: the lane, as wide as it, from its side toward you, of up to
  //     CHARGE_RANGE rows of tiles of its hall it could step onto (never a case's, nor past a
  //     wall or a closed door), you on it; when it goes off, after striking, it runs along the
  //     lane row by row until someone stands in its way or the lane ends (the shape's after);
  //   cp_ring, its tail: the tiles round its footprint (the ring's), you among them.
  const limb = (id, shape, noun, marks, clause, more) => R.define('SPECIALS', id, proved(Object.assign({ icon: 'special', shape, effect: 'damage', curve: GROSS,
    range: null, every: null, noun, marks, clause, params: { gross: GROSS }, covers: HITS }, more || {})));
  limb('cp_sweep', 'sweep', 'neck', 'the tiles round it on your side',
    'its neck marks the tiles round it on your side while you stand on one, then strikes everything on them for {gross} before Padding');
  limb('cp_charge', 'charge', 'legs', 'a lane toward you',
    'its legs mark a lane as wide as it toward you, up to {range} tiles and never through a case, while you stand on it, then strike everything on it for {gross} before Padding, and it charges down the lane, stopping short of anyone in it',
    { range: 'CHARGE_RANGE', params: { gross: GROSS, range: 'N:CHARGE_RANGE' } });
  limb('cp_ring', 'tail', 'tail', 'the tiles round it',
    'its tail marks all the tiles round it while you stand on one, then strikes everything on them for {gross} before Padding');

  // Its phase parts (§5.3's "From phase k: …"; Q10, its strip). Phase 1, from the start: how it
  // grows its limbs, so the phone's strip says it while it waits for you (FU1): one for every
  // GUARDIAN_PER_STAGE galleries you have walked (the rooms of the department that hold a
  // gallery and that you have stood in, the one you start in and its own hall among them:
  // Guardian.galleries), its neck, then its legs, and walking grows no other (Guardian.WALKED,
  // within GUARDIAN_STAGE_MAX; a test keeps it so): S.9's departments hold five gallery rooms,
  // so a tail for six would be a promise walking never keeps (M4 COMPOSITE-CORE's review,
  // decided without play; revisit once M4 is playable). Its tail is described by its clause;
  // the rule that gives it (phase 2's limb) is COMPOSITE-PHASES', and the core stays at ready
  // false until then.
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

  // Its phase event's causes (reg/centrepiece.js): `walked`, a limb grown for the galleries you
  // have walked (n of them: its stage, the limbs it has, and the limb gained, a SPECIALS id, are
  // the event's), within the phase it is in (it enters none); `left`, you left its hall while it
  // hunted you, so it healed and dropped a limb (COMPOSITE-PHASES').
  R.defineCause('phase', 'walked', { fields: { n: 'int?' }, built: 'M4' });
  R.defineCause('phase', 'left', { fields: {}, built: 'M4' });

  // A change of its mode (§8.2; rules/arch/completing_guardian.js): hunting or searching for you
  // while you stand outside its hall, out of its sight or searching, it goes back to its place
  // (lost, to returning), since it never leaves the hall.
  R.defineCause('lost', 'outside', { fields: {}, built: 'M4' });
})();
