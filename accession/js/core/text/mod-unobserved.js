// ACCESSION — sentences: the module unobserved_motion and its archetype, unobserved_mover (the
// Grazer) (BUILD.md §3.4, §5.4), owned by MOD-UNOBSERVED. M4's skeleton made it; M4's Wave 0
// (W0a) gave its module event a sentence for each of its rules. MOD-UNOBSERVED fills the rest.
'use strict';
(() => {
  // stride: an unobserved mover's steps, told only when it ends them in view (the module
  // kind's log is 'seen'), so the log never tells you what moved where you could not see.
  // Every rule of this module is about a mover you could not see, so an event that names no
  // mover (who) has no sentence: the log, which tells an event about no exhibit whatever is
  // in view, would give away a move you did not see, and the joined-up scenarios' sentence
  // check fails on it, so the module's tests catch it.
  const RULES = {
    stride: (e, w) => `${w.Name(e.who)} moved${Number.isInteger(e.n) ? ' ' + Text.count(e.n, 'tile') : ''} while you could not see it.`,
  };
  Text.defineCause('module', 'unobserved_motion', (e, w) => e.who === undefined ? null
    : Object.prototype.hasOwnProperty.call(RULES, e.rule) ? RULES[e.rule](e, w) : `One of this department’s rules acted on ${w.name(e.who)}.`);
})();
