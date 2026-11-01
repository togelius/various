// ACCESSION — registry fragment: viewing the Centrepiece and its dust sheet: the viewed event,
// the refusals of view and of the sheet, the lectern's and the sheet's clauses (BUILD.md §5.1,
// §4.2, §8.7), owned by PG-VIEW. M4's skeleton made it, with the one refusal its `view` gave
// (no_centrepiece); M4's Wave 0 (W0a) moved here, from reg/system.js, the viewed event, with
// the schema and cause of M4 plan A5. PG-VIEW filled the rest (rules/viewing.js).
'use strict';
(() => {
  const R = Registry;
  // Proved joined up: real actions in a hall with a test-only Centrepiece core at depths 1–7,
  // every invariant checked after every step (viewing.inv.js among them).
  const TESTS = ['behaviour/viewing.test.js', 'behaviour/refusals-view.test.js'];
  const proved = more => Object.assign({ built: 'M4', ready: true, tests: TESTS.slice(), inv: 'viewing' }, more);

  // The refusals of view (§4.2, §8.7), in the order Viewing.refusal asks them, each made to
  // happen by a real action at depths 1–7 in behaviour/refusals-view.test.js; their invariant
  // is the system's (a refusal changes nothing). no_centrepiece: no Centrepiece was placed (every
  // department until its core is ready, and the test room), or none of it stands; sheeted (also
  // the refuser's, below); already_earned: the visit's Certificate is earned, whichever way;
  // not_at_lectern: you are not on the reading tile; not_asleep: a piece of it is awake.
  const refusal = () => proved({ inv: 'system', tests: TESTS.concat(['m4-skeleton.test.js']) });
  R.define('REFUSALS', 'no_centrepiece', refusal());
  R.define('REFUSALS', 'already_earned', refusal());
  R.define('REFUSALS', 'not_at_lectern', refusal());
  R.define('REFUSALS', 'not_asleep', refusal());
  // The dust sheet's refusal (rules/viewing.js's refuser): with the Centrepiece under its sheet,
  // a view, a blow at a piece it covers, a step into a tile under it, an instrument aimed at one
  // (a Solution thrown onto it is not refused: its square reaches whoever stands in it, and no
  // piece under the sheet).
  R.define('REFUSALS', 'sheeted', refusal());

  // A turn of viewing (§8.7): who viewed (you), the Centrepiece viewed (of: its first piece still
  // standing, which names it; an ensemble's first may have fallen, M4 ENSEMBLE-CORE) and
  // the views in a row so far (n, of VIEW_TURNS); the last of a row also puts it under its dust
  // sheet, which its sentence tells.
  R.defineEvent('viewed', { fields: { who: 'uid', of: 'uid', n: 'int' }, built: 'M4' });
  R.defineCause('viewed', 'view', { fields: {}, built: 'M4' });

  // The lectern (§8.7; a fixture once its Centrepiece is placed, read like a plaque): the
  // viewing rule, which its words (Viewing.words) and its label give.
  R.define('FIXTURES', 'lectern', proved({ icon: null, covers: ['viewed', 'certificate'], params: { turns: 'N:VIEW_TURNS' },
    clause: 'While the Centrepiece sleeps and this department’s Certificate is still to be earned, view it from the reading tile beside the lectern for {turns} turns in a row: the last view earns the Certificate and puts the Centrepiece under a dust sheet for the night, so no fight follows. Any other action that takes time starts the count again, and so does its waking.' }));
  // The dust sheet (§4.1, §8.7): a fixture on each tile of the Centrepiece's footprint once a
  // view is complete, which is low furniture.
  R.define('FIXTURES', 'sheet', proved({ icon: null, covers: [], params: {},
    clause: 'The Centrepiece is under its dust sheet for the night: it no longer wakes, moves or fights, and you cannot view it, strike it, step onto it or aim an instrument at it.' }));

  // What your ring does from the reading tile (§8.2, §8.7, D4.18; R9), the last of the lectern's
  // words, as you are now: ring is the ring you would have viewing there (Viewing.ring: your
  // ring standing still, with your perks, a loud tile and a lit Lamp worn), lamp what a lit Lamp
  // adds. Viewing.words picks one: it reaches the Centrepiece; or, with no lit Lamp worn, it does
  // not and a lit Lamp's would; or it does not.
  const RING = { ring: 'N:RING_STILL', lamp: 'N:LAMP_RING' };
  R.define('CLAUSES', 'lectern_ring_reach', proved({ icon: null, covers: ['pip'], params: { ring: RING.ring },
    clause: 'Standing on the reading tile, your ring ({ring}) reaches the Centrepiece, so each turn of viewing adds a pip to it.' }));
  R.define('CLAUSES', 'lectern_ring_lamp', proved({ icon: null, covers: ['pip'], params: RING,
    clause: 'Standing on the reading tile, your ring ({ring}) does not reach the Centrepiece, so viewing adds no pips to it; a lit Lamp makes your ring {lamp} larger, enough to reach the Centrepiece, and then each turn of viewing adds a pip.' }));
  R.define('CLAUSES', 'lectern_ring_short', proved({ icon: null, covers: [], params: { ring: RING.ring },
    clause: 'Standing on the reading tile, your ring ({ring}) does not reach the Centrepiece, so viewing adds no pips to it.' }));
})();
