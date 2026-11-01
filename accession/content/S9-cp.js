// ACCESSION — S.9's Centrepiece, the Composite, guarding the Lamp: the pack's `centrepiece` part,
// given with Packs.part('S9', 'centrepiece', …), as {id, archetype, form, size, pieces |
// attachments, phases, specials, gateway, signature, treasure?} (BUILD.md §5.5). Packs.get and
// Packs.list give the pack with its parts merged. M4's skeleton made the file empty and listed it
// in index.html after content/S9.js; D-PACKS gave the record its Signature piece in the card,
// D-ITEMS its treasure case's glass, and COMPOSITE-CORE moved it here and built its core
// (design/samples.md §3.8, trimmed; M4 plan D3.5, decided without play; revisit once M4 is
// playable):
//   - a treasure (form): the Lamp (S9.11, its Signature piece) lies in the hall's wall case
//     (D-ITEMS' treasure case, its glass overridden to Security, never above the depth's mix:
//     LTreasure.glass; lint-registry --report S9 lists it), and killing the Composite earns
//     nothing (its form's rule);
//   - one 2×2 body of the role centrepiece; it guards the Lamp's case (touch_case, its trigger:
//     its case is the one it guards) and never leaves its hall;
//   - its limbs, its specials: a neck (cp_sweep), legs (cp_charge) and a tail (cp_ring); the
//     galleries you have walked grow its neck, then its legs, and no other (S.9's five gallery
//     rooms give two; COMPOSITE-CORE's review); phase 1's part says how they grow, so the strip
//     says it from the start; phase 3's says that its specials then come more often
//     (CP_SPECIAL_EVERY);
//   - COMPOSITE-PHASES gave it the rest: phases 2 and 3 each grow its next limb (its tail and its
//     crest come only so: guardian_grow_alarm, guardian_grow), phase 2's with the slot for
//     alarm_network, which it is flagged with: from then on it shows and raises the alarm
//     as a Wader does, while it hunts you in its hall); the crest (cp_call); the leave-heal; the
//     treasure's seal, the carry-out and the dust sheet over its case (rules/treasure.js); and
//     the gateway label, on the lectern (40–120 words, plan D3.8: the sample's, trimmed to the
//     Composite and the curator's visit; decided without play; revisit once M4 is playable).
// Its paragraph and gateway label claim no rule beyond its line: the night staff "say" it is
// more complete when more of the court has been walked, which its limbs bear out, and the
// curator's "Nothing moved while I watched" is the round book's entry, not the rule.
'use strict';
Packs.part('S9', 'centrepiece', {
  id: 'S9.12', sprite: 'composite', archetype: 'completing_guardian', role: 'centrepiece', form: 'treasure', size: 2, signature: 'S9.11', trigger: 'touch_case',
  flags: ['alarm_network'], treasure: { case: { glass: 3 } },
  name: 'The Composite, Assembled From the Round Books',
  tomb: { maker: 'Mounted by the preparators from every description in Round Books 1–8 that matched no other specimen', date: 'After the Great Reshelving', medium: 'Hide, feathers, horn, wire, carved lime; parts added as descriptions were found', dims: 'H. 2.9 m', credit: 'Accessioned on the night staff’s report' },
  paragraph: 'Reported in pieces. The preparators built it from the descriptions no other mount accounted for: a neck from Round Book 2, legs from Round Book 6, a tail from a note in a margin. They added each part as its description turned up in the galleries, and they do not believe it is finished. The night staff say it is more complete on nights when more of the court has been walked.',
  gateway: 'The Composite, Assembled From the Round Books. The preparators built it from every description in the night staff’s round books that matched no other animal, and added a part each time another description turned up in the galleries. The day curator visited the court once, at night, to confirm the round books, and brought a new lamp. The visit is entered in Round Book 8 in the curator’s own hand: “Nothing moved while I watched.” The next morning the lamp was found in the locked case beside the Composite, and the curator declined to discuss it.',
  phases: [{ parts: ['CLAUSES.guardian_limbs'] }, { parts: ['CLAUSES.guardian_grow_alarm'] }, { parts: ['CLAUSES.guardian_grow', 'CLAUSES.guardian_quick'] }],
});
