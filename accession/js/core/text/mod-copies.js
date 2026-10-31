// ACCESSION — sentences: the module copies_weaken: the weakened spares (BUILD.md §3.4, §5.4),
// owned by MOD-COPIES. M4's skeleton made it; M4's Wave 0 (W0a) gave its module event a sentence
// for its rule, and an original's spares one line in the log. MOD-COPIES fills the rest.
'use strict';
(() => {
  const RULES = {
    weaken: (e, w) => `${w.Name(e.who)} lost heart: its original was destroyed.`,
  };
  // A spare's event names the spare (who); one that names none has no sentence, since it could
  // be about one out of view (see text/mod-unobserved.js).
  Text.defineCause('module', 'copies_weaken', (e, w) => e.rule === 'weaken' && e.who === undefined ? null
    : Object.prototype.hasOwnProperty.call(RULES, e.rule) ? RULES[e.rule](e, w) : 'One of this department’s rules acted.');
  // An original's spares lose heart in one step: the log tells them in one line. They share
  // their reason only with the spares of the same original (cause.by), so two originals
  // destroyed in one step are two lines; another rule of the module is never told with them.
  const original = e => e.cause && typeof e.cause.by === 'string' ? e.cause.by : '';
  // (A group is two or more, and only the spares in view are told.)
  Text.defineGroup('module', 'copies_weaken', events => original(events[0])
    ? `An original was destroyed, and ${events.length} of its spares lost heart.`
    : `${Text.count(events.length, 'spare')} lost heart, each because its original was destroyed.`,
  e => e.rule === 'weaken' && e.who !== undefined ? original(e) : null);
})();
