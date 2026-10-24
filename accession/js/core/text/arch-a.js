// ACCESSION — sentences: the darter, the splitter and the mote swarm, and the marble and
// plaster modifiers (BUILD.md §5.5), owned by W1-ARCH-A.
'use strict';
(() => {
  // A body made from another, such as a splitter's half.
  Text.defineCause('woke', 'summoned', (e, w) => `${w.Name(e.who)} came from ${w.name(e.cause.from)}.`);
  Text.defineCause('hunting', 'summoned', (e, w) => `${w.Name(e.who)} came from ${w.name(e.cause.from)} and is hunting you.`);
})();
