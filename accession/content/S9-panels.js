// ACCESSION — S.9's wall panels (BUILD.md §5.2; M4 plan D5.4, D5.5, D7.1), the pack's `panels`
// part: design/samples.md §3.2's intro panel and section panels, trimmed so that the prose
// states no rule and says nowhere where anything stands (js/core/panels.js places each panel,
// and a panel's rule is its module's sentence, generated: the intro panel's is the signature's,
// unobserved_motion, and "The Waders' Round" carries the secondary's, alarm_network). Cut from
// the sample: the round books "on the lecterns" (the slice has one lectern, in the hall); "the
// animals move only when nobody is looking at them, and a keeper who keeps a light on them has
// nothing to fear" (the rule, and a light the slice lacks); the waders' call and what comes to
// it, and their stopping "at the same lecterns" (the rule, and a place); the plinths' shadows;
// "the overshoes are in the case by the north lectern"; the bay that "now holds one" nest, "this
// part of the court" and "the case on the east wall". Owned by W-PANELS.
'use strict';
Packs.part('S9', 'panels', {
  intro: {
    name: 'Animals Not Yet Seen by the Day Staff',
    text: 'Every animal in this department was described by the night staff, on their rounds, in pencil. The descriptions are in the round books, and the Museum has accessioned them in good faith. The day staff have never seen any of these animals do anything. They have found them in different places in the morning, which is not the same thing, and every label in this department therefore says reported, not observed. Please keep the exhibits in view. The preparators mounted each animal from its description, and where a description was unclear, they chose the reading that would stand up. We have tried to describe the animals as the night staff did, and not as we would have preferred them to be.',
  },
  sections: [
    { gallery: 's1', name: 'The Waders’ Round', module: 'alarm_network',
      text: 'The lantern-crop waders were mounted from the night staff’s descriptions of their own rounds. The round books describe a wader’s call as unmistakable, and the day staff, who have never heard it, do not dispute this. When the night staff wanted a quiet round, they wore felt over their shoes.' },
    { gallery: 's2', name: 'The Brooders’ Bay',
      text: 'The round books describe a dozen ground-nesting animals, and the preparators could account for only one of them. It has been sitting on the same nest since the Great Reshelving. The nest is made from the pages of a round book. The night staff would like it back, but they have agreed with the day staff that it is now part of the specimen. The preparators’ workshop has lent some of its tools for the duration.' },
  ],
});
