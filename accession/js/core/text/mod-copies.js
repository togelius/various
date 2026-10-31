// ACCESSION — sentences: the module copies_weaken: the weakened spares (BUILD.md §3.4, §5.4),
// owned by MOD-COPIES. M4's skeleton made it; M4's Wave 0 (W0a) gave its module event a sentence
// for its rule, and an original's spares one line in the log. MOD-COPIES fills the rest.
'use strict';
(() => {
  const RULES = {
    weaken: (e, w) => `${w.Name(e.who)} lost heart: its original was destroyed.`,
  };
  const weaken = e => e.rule === 'weaken' && e.who !== undefined;
  Text.defineCause('module', 'copies_weaken', (e, w) => weaken(e) ? RULES.weaken(e, w) : 'A broken original’s spares lost heart.');
  // An original's spares lose heart in one step: the log tells them in one line.
  Text.defineGroup('module', 'copies_weaken', events => `An original was destroyed, and ${Text.count(events.length, 'spare')} lost heart.`);
})();
