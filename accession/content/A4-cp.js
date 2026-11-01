// ACCESSION — A.4's Centrepiece, the Ordinance: the pack's `centrepiece` part, given with
// Packs.part('A4', 'centrepiece', …), as {id, archetype, form, size, pieces | attachments,
// phases, specials, gateway, signature, treasure?} (BUILD.md §5.5). Packs.get and Packs.list
// give the pack with its parts merged. M4's skeleton made the file empty and listed it in
// index.html after content/A4.js; D-PACKS gave the record its Signature piece in the card,
// ENSEMBLE-CORE moved it here and built its pieces, and ENSEMBLE-PHASES built inheritance,
// phase 3's shatter, its Clerk and its gallery hook (design/samples.md §4.8, trimmed per M4
// plan Q8 and D3.7, decided without play; revisit once M4 is playable):
//   - four pieces, not the sample's five sheets with one pool (ENSEMBLE_PIECES, Q8): the signed
//     original (A.4.12, with no letter) on the footprint's top-left tile, where its Signature
//     piece, the Repealing Pen, drops; then certified copies a, b and c (A.4.12a–c). Each piece
//     gives its own words (Packs.speciesFor: its name, number, sprite, tombstone and
//     paragraph), so its label says which it is, and the board draws the original's sheet
//     signed and each copy's stamped. The record's own name and tombstone are the Centrepiece
//     as a whole, which the lectern's gateway label speaks for;
//   - copies a and b carry the burst from the start (the sample's /a and /b), the original and
//     copy c none: the sample's `summon` waits for its owner (TABLEAU-CORE), and copy c takes on
//     a special only by inheritance (rules/arch/mp_ensemble.js: when a piece falls, each piece
//     still standing takes on each special of its that it lacks). Phase 2 gives the burst to
//     the first piece still standing (the original, while it stands); phase 3 gives it the
//     shatter (shatter_all: every case of its hall still intact, marked, then broken), and its
//     parts say that, and what every Centrepiece's third phase does: its pieces mark their
//     specials more often (CP_SPECIAL_EVERY);
//   - flagged with copies_weaken: the copies are the original's spares (mp_ensemble's init,
//     CopiesWeaken.addGroup), and the module's part on its line says what the original's fall
//     costs them;
//   - its attachment, the Senior Countersigning Clerk (A.4.13): a conservator_healer with
//     clockwork, as the gallery's Countersigning Clerk (A.4.5) is, with the healer's rule and
//     line (M4 plan D3.13): it stands asleep in the hall, at `at` from the footprint's top-left
//     tile or the free tile of the hall nearest it (mp_ensemble's placement), and restores the
//     pieces it sees as it restores any exhibit. It is no piece: its health is its own (the
//     support role's) and counts in no phase;
//   - its gallery hook (ENSEMBLE_HOOK_PCT): the sample's originals are labelled "Companion
//     piece to A.4.12", so each original destroyed in the galleries costs the Ordinance
//     ENSEMBLE_HOOK_PCT[0]% of its full health, at most ENSEMBLE_HOOK_PCT[1]% (its line says how);
//   - cut (M4 plan D3.7): the sample's four side vitrines whose spares joined phase 3 (its
//     hall's gallery lists nothing), and the Clerk's interrupt (a Stamp Moistener's jet): nothing
//     on its line, its Clerk's or its gateway label speaks of either.
// Its paragraphs and gateway label claim no rule: the Office's note "advises" the original
// first, and "take on its duties" and the companion pieces are the rules' history, not the
// rules, which its line states.
'use strict';
(() => {
  const credit = 'Transferred from the Ordinance Office';
  const copy = (letter, at, specials) => Object.assign({ id: `A4.12${letter}`, at, sprite: 'ordinance_copy',
    name: `The Duplicate Ordinance, Certified Copy ${letter}`,
    tomb: { maker: 'The Ordinance Office typing pool, after A.4.12', date: 'During the Duplicate Ordinance', medium: 'Carbon ink on paper; stamped CERTIFIED TRUE COPY; framed', dims: '42 × 30 cm', credit },
    paragraph: `Certified copy ${letter} of the Ordinance, typed by the Office’s typing pool from the signed original and stamped CERTIFIED TRUE COPY in violet. It carries the original’s number with a letter after it, as every spare under the Ordinance did. A certified copy was never valid on its own: the Office’s rule was that it stood for the original only while the original stood.` },
  specials ? { specials } : {});

  Packs.part('A4', 'centrepiece', {
    id: 'A4.12', sprite: 'ordinance_original', archetype: 'mp_ensemble', role: 'centrepiece', form: 'fight', size: 2, signature: 'A4.11',
    flags: ['copies_weaken'],
    name: 'The Duplicate Ordinance, With Its Three Certified Copies',
    tomb: { maker: 'Drafted by the Ordinance Office; copies by the typing pool', date: 'Signed after the Night of the Unlocked Door; repealed after the Second Inventory', medium: 'Ink on paper, four sheets, each framed on its own stand', dims: 'Each sheet 42 × 30 cm', credit },
    paragraph: 'The Ordinance required that it be issued with spares like everything else, so there are four of it. Only one was signed by the Trustees; the other three were certified as true by the Office, which is not the same thing. They have always been displayed together. The Office’s own note, pinned beside them, advises dealing with the signed original first.',
    gateway: 'The Duplicate Ordinance, With Its Three Certified Copies. The Ordinance required that it be issued with spares like everything else, so there are four of it. Only one was signed by the Trustees: the original, whose number, A.4.12, has no letter. The other three were certified as true by the Office, which is not the same thing, and carry its number with a letter after it. They have always been displayed together, and when one is taken down the others take on its duties. The originals in the galleries are labelled as its companion pieces. Its Senior Countersigning Clerk still attends it. The Office’s own note, pinned beside them, advises dealing with the signed original first.',
    pieces: [
      { id: 'A4.12', at: [0, 0], sprite: 'ordinance_original', name: 'The Duplicate Ordinance, Signed Original',
        tomb: { maker: 'Drafted by the Ordinance Office; signed by the Trustees', date: 'Signed after the Night of the Unlocked Door; repealed after the Second Inventory', medium: 'Ink on paper, signed; framed', dims: '42 × 30 cm', credit },
        paragraph: 'The Ordinance as the Trustees signed it, the week after the Night of the Unlocked Door: the only sheet of the four that carries their signatures, and the only one without the CERTIFIED TRUE COPY stamp. Its number has no letter. Every copy the Office certified stood for this sheet, and the Office’s note pinned beside it advises dealing with it first.' },
      copy('a', [1, 0], ['cp_burst']),
      copy('b', [0, 1], ['cp_burst']),
      copy('c', [1, 1]),
    ],
    phases: [{ parts: ['CLAUSES.ens_burst'] }, { parts: ['CLAUSES.ens_gain'], specials: ['cp_burst'] }, { parts: ['CLAUSES.ens_quick', 'CLAUSES.ens_shatter'], specials: ['shatter_all'] }],
    // Its attachment (above): one exhibit of the hall, not a piece. `at` is where it stands
    // from the footprint's top-left tile, two tiles below the footprint, so 2 tiles from its
    // pieces (CONSERVATOR_KEEP), its restore reaching them.
    attachments: [
      { id: 'A4.13', at: [0, 3], sprite: 'countersigning_clerk', archetype: 'conservator_healer', role: 'support', modifiers: ['clockwork'], trigger: null,
        name: 'Senior Countersigning Clerk, Automaton',
        tomb: { maker: 'Made for the Ordinance Office by the Workshops of the Line', date: 'During the Duplicate Ordinance', medium: 'Brass, steel; escapement; pen arm, inkwell and the Office seal', dims: 'H. 140 cm', credit },
        paragraph: 'The senior of the Office’s two clerking automata, kept beside the Ordinance so that no sheet of it would ever go without a countersignature. It was built to the pattern of the clerk in the galleries, a little taller, with the Office seal in its pen arm. The Office’s records say it attends to the four sheets and nothing else, and does not like to be approached.' },
    ],
  });
})();
