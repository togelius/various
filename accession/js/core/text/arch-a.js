// ACCESSION — sentences: the darter, the splitter and the mote swarm, and the marble and
// plaster modifiers (BUILD.md §5.5), owned by W1-ARCH-A. Their blows, steps and deaths are
// told by the kinds' own sentences (combat, modes); what is theirs alone is a body made
// from another, a splitter's half, whose creation woke names where it came from.
'use strict';
(() => {
  // A splitter's half: "The Bust of the Proposing Trustee split in two, under your hit; the
  // new half began hunting you." Any other body made from another: "X came from Y."
  function made(e, w, hunts) {
    const c = e.cause;
    if (c.how === 'split') {
      const under = typeof c.by === 'string' ? (c.by === 'you' ? ', under your hit' : `, hit by ${w.name(c.by)}`) : '';
      return `${w.Name(c.from)} split in two${under}; the new half ${hunts ? 'began hunting you' : 'was awake'}.`;
    }
    return `${w.Name(e.who)} came from ${w.name(c.from)}${hunts ? ' and began hunting you' : ''}.`;
  }
  Text.defineCause('woke', 'summoned', (e, w) => made(e, w, e.mode === 'hunting'));
  Text.defineCause('hunting', 'summoned', (e, w) => made(e, w, true));
})();
