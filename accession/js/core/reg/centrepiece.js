// ACCESSION — registry fragment: what every Centrepiece shares: its specials, its phases (the
// phase event), its form's rule and its fall (BUILD.md §5.1, §5.3, §5.5, §8.1, §8.7), owned by
// ARCH-CP-CORE. M4's skeleton made it; M4's Wave 0 (W0a) gave it the phase event, the one kind
// M4 adds to §4.3 (M4 plan A5), with its cause for damage, and the dropped event's cause for a
// defeat. ARCH-CP-CORE gave it the burst special and the forms' clauses.
'use strict';
(() => {
  const R = Registry;
  // Proved joined up (rules/centrepiece.js) with a test-only core in the real rules, every
  // invariant checked after every step (centrepiece.inv.js among them).
  const proved = more => Object.assign({ built: 'M4', ready: true, tests: ['behaviour/centrepiece.test.js'], inv: 'centrepiece' }, more);

  // A Centrepiece's phase (§4.3, §5.5): who (a piece of it), the phase it is now in (1, 2 or
  // 3: CP_PHASE_PCT), the Composite's stage (its limbs) where that changed, and the special it
  // gained (gained, a SPECIALS id) where it gained one. Its causes: `damaged` (its health fell
  // to a threshold; by, whoever hurt it) here; `walked` and `left` (the Composite's limbs) in
  // reg/cp-guardian.js; `inherited` (an Ordinance piece taking on a fallen one's special) in
  // reg/cp-ensemble.js.
  R.defineEvent('phase', { fields: { who: 'uid', phase: 'int', stage: 'int?', gained: 'str?' }, built: 'M4' });
  R.defineCause('phase', 'damaged', { fields: { by: 'uid?' }, built: 'M4' });

  // A defeated Centrepiece's Signature piece drops on its footprint's top-left tile (§8.7):
  // who (the Centrepiece's last piece to fall), the item and its tile; `by`, whoever struck
  // the last blow.
  R.defineCause('dropped', 'defeated', { fields: { by: 'uid?' }, built: 'M4' });

  // The burst (§8.1; Specials' shape 'burst'): your tile and the tiles round it, aimed at you,
  // so marked only while its owner sees you, never an intact case's tile nor its owner's own;
  // a Centrepiece's gross (cp:). Used by the Great Board and the Ordinance's copies.
  R.define('SPECIALS', 'cp_burst', proved({ icon: 'special', shape: 'burst', effect: 'damage', curve: 'cp:ROLE_CENTREPIECE_SPECIAL_PCT', range: null, every: null,
    clause: 'marks your tile and the tiles round it while it sees you, then strikes everything on them for {gross} before Padding',
    params: { gross: 'cp:ROLE_CENTREPIECE_SPECIAL_PCT' }, covers: ['telegraphed', 'special', 'damaged'],
    tests: ['behaviour/centrepiece.test.js', 'm4-specials-core.test.js'] }));

  // A Centrepiece's form's rule (§5.3, §5.5, §8.4, §8.7; R4), a part of every Centrepiece's line
  // by its record's form (Clauses.of), after its archetype's: its phases, on its health, at
  // each threshold or below, which never go back; then what its form makes of it. A fight
  // seals you in its hall with it while it hunts you there (Hall's fight seal, §8.4: never
  // alone, never while someone stands in an opening), and its fall drops its Signature piece
  // where it first stood (its footprint's top-left tile) and earns the Certificate unless one
  // was earned in the visit already (one a visit, §8.7), whose cause names it. A treasure's
  // guardian's death opens its hall and earns nothing, since only carrying its treasure out of
  // its hall is that department's defeat (§5.5, D3.14); what seals its hall is its own rule's
  // to say (Hall.defineSeal). Every word counts against the strip's 14 rows (m4-lines): the
  // fight's takes 7 alone, the treasure's 5.
  const PHASES = { first: 'N:CP_PHASE_PCT[0]', second: 'N:CP_PHASE_PCT[1]' };
  const PHASE_RULE = 'Its second phase starts at {first}% of its full health or less, its third at {second}%, for good.';
  R.define('CLAUSES', 'cp_fight', proved({ icon: null, params: PHASES, covers: ['phase', 'stage', 'dropped', 'certificate'],
    clause: `${PHASE_RULE} Hunting you in its hall, it seals you in with it once no one stands in an opening. Its fall drops its Signature piece where it first stood and earns the Certificate, unless you have it.` }));
  R.define('CLAUSES', 'cp_treasure', proved({ icon: null, params: PHASES, covers: ['phase'],
    clause: `${PHASE_RULE} Killing it opens its hall but earns nothing: carry the treasure it guards out of the hall.` }));
})();
