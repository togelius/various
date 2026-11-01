// ACCESSION — M.11's Centrepiece, the Great Board of the Central Station: the pack's
// `centrepiece` part, given with Packs.part('M11', 'centrepiece', …), as {id, archetype, form,
// size, pieces | attachments, phases, specials, gateway, signature, treasure?} (BUILD.md §5.5).
// Packs.get and Packs.list give the pack with its parts merged. M4's skeleton made the file
// empty and listed it in index.html after content/M11.js; D-PACKS gave the record its
// Signature piece in the card, and TABLEAU-CORE moved it here and built its body
// (design/samples.md §2.8, trimmed; decided without play; revisit once M4 is playable):
//   - one 2×2 body that never moves (rules/arch/mp_tableau.js), its Signature piece the Line
//     Superintendent's Pocket Heliograph (M11.10), which drops where it stands;
//   - its beam (cp_line, the sample's `line` along its row or column) and its burst (cp_burst,
//     the sample's 3×3) from the start, taking turns; from phase 2 its summons too (the
//     sample's `summon`, its 2-turn telegraph trimmed to the mark every special shows until its
//     owner's next action), calling Logbook Trolleys (M11.5, `summons`; CP_SUMMON) and taking
//     double damage (CP_SUMMON_DMG_PCT) while marked; phase 3 its specials more often (the
//     sample's "cadence every 2nd action", CP_SPECIAL_EVERY);
//   - its attachments (the Repeater Arm, the Board Dish) and the hall's rain case are
//     TABLEAU-PHASES'; the side-door Heliographs of the sample's phase 3 are cut (plan D3.7).
// Its paragraph and gateway label claim no rule: the clerks "trained to step out of its row"
// are the beam's history, not the rule, which its line states.
'use strict';
(() => {
  Packs.part('M11', 'centrepiece', {
    id: 'M11.11', sprite: 'great_board', archetype: 'mp_tableau', role: 'centrepiece', form: 'fight', size: 2, signature: 'M11.10',
    specials: ['cp_line', 'cp_burst'], summons: 'M11.5',
    name: 'The Great Board of the Central Station',
    tomb: { maker: 'Painted by the Workshops of the Line, with later panels', date: 'Before the Second Calibration; repainted until the line closed', medium: 'Oil on boards, forty hinged panels; iron frame', dims: 'H. 3.2 m, W. 3.6 m', credit: 'Transferred from the Central Station' },
    paragraph: 'Every signal on the line arrived here and was posted on the Board by hand, so that the Central Station could see the state of the whole building at a glance. The Board shows times of sending and times of arrival, and nothing else. The clerks who kept it were trained to step out of its row whenever a panel changed.',
    gateway: 'The Great Board of the Central Station. Every signal on the line arrived here and was posted on the Board by hand, so that the Central Station could see the state of the whole building at a glance. The Board shows times of sending and times of arrival, and nothing else. The clerks who kept it were trained to step out of its row whenever a panel changed. In the line’s last years the Board is said to have posted signals before they were sent. The Superintendent’s pocket heliograph, lost on the last day, was found behind panel twenty-six.',
    phases: [{ parts: ['SPECIALS.cp_line', 'SPECIALS.cp_burst'] }, { parts: ['CLAUSES.tab_summon'], specials: ['summon'] }, { parts: ['CLAUSES.tab_quick'] }],
  });
})();
