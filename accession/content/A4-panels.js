// ACCESSION — A.4's wall panels (BUILD.md §5.2; M4 plan D5.4, D5.5, D7.1), the pack's `panels`
// part: design/samples.md §4.2's intro panel and section panels, trimmed so that the prose
// states no rule and says nowhere where anything stands (js/core/panels.js places each panel;
// the intro panel's rule is its module's sentence, copies_weaken's, generated, and A.4 has no
// secondary). Cut from the sample: "these cases" and "four times" (the Intro holds no case, and
// a count of times is a rule's word); "its counter is the first thing you will meet"; "when an
// original is broken, its spares lose heart" (the rule); "some spares are better made than
// their originals" (a claim of their numbers); "a stroke and a letter" (a spare's number reads
// its original's with a letter, A.4.1a); the cases "at the ends of each row", "breaking a case
// is loud", the figure "near the north case"; the bundles "on these shelves", the naked flame,
// and the duplicator "in the corner" with its stain (the slice has neither fire nor the
// duplicator), and its ink "still spreading" (no ink spreads in the slice). Owned by W-PANELS.
'use strict';
Packs.part('A4', 'panels', {
  intro: {
    name: 'Things Kept in Duplicate, Before the Repeal',
    text: 'Almost everything in this department is here twice, and some things more often still. For the length of the Duplicate Ordinance, every object the Museum made or acquired had to be issued with a certified spare, so that nothing could ever be lost for good. Spares were made in plaster, on carbon paper, in whatever was to hand, and the forms were made in triplicate. The Office that issued them occupied this floor. The Ordinance was repealed after the Second Inventory, when the spares were found to outnumber the galleries. Each original carries a plain number, and each of its spares the same number with a letter. The Museum regrets that it has not always been possible to tell a spare from its original by quality alone.',
  },
  sections: [
    { gallery: 's1', name: 'Originals Under Glass',
      text: 'Under the Ordinance the original was put away and the spare was put out for use, so that the original would never be handled. The Office’s rules described the spares as interchangeable, which the spares appear to have taken personally. Every repair had to be countersigned, and the clerk who countersigned them was never countersigned itself.' },
    { gallery: 's2', name: 'The Copying Room',
      text: 'Every form issued under the Ordinance was typed with a carbon underneath, and the carbons were kept. There are many thousands of them, very thin and very dry, and nobody has sorted them since the Repeal. The Office’s duplicator turned one master sheet into as many copies as the Office required, and on busy days nobody switched it off.' },
  ],
});
