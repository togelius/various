// ACCESSION — sentences: the module unobserved_motion and its archetype, unobserved_mover (the
// Grazer) (BUILD.md §3.4, §5.4), owned by MOD-UNOBSERVED. M4's skeleton made it; M4's Wave 0
// (W0a) gave its module event a sentence for each of its rules. MOD-UNOBSERVED added the log's
// one line for a mover's strides in one step.
'use strict';
(() => {
  const isInt = Number.isInteger;
  // stride: a step a mover took while you could not see it (n tiles: 1), told only when it ends
  // your step in view (the module kind's log is 'seen'), so the log never tells you what moved
  // where you could not see it. Every rule of this module is about a mover you could not see,
  // so an event that names no mover (who) has no sentence: the log, which tells an event about
  // no exhibit whatever is in view, would give away a move you did not see, and the joined-up
  // scenarios' sentence check fails on it, so the module's tests catch it.
  const RULES = {
    stride: (e, w) => `${w.Name(e.who)} moved${isInt(e.n) ? ' ' + Text.count(e.n, 'tile') : ''} while you could not see it.`,
  };
  Text.defineCause('module', 'unobserved_motion', (e, w) => e.who === undefined ? null
    : Object.prototype.hasOwnProperty.call(RULES, e.rule) ? RULES[e.rule](e, w) : `One of this department’s rules acted on ${w.name(e.who)}.`);
  // The strides of one mover in one step (each a step, n 1) are told in one line, with the
  // tiles they came to: "The Long-Necked Grazer moved 2 tiles while you could not see it." Each
  // mover has its own line; any other event of the module (none yet) is told alone.
  Text.defineGroup('module', 'unobserved_motion', (events, w) => {
    const n = events.reduce((t, e) => t + e.n, 0);
    return `${w.Name(events[0].who)} moved ${Text.count(n, 'tile')} while you could not see it.`;
  }, e => e.rule === 'stride' && e.who !== undefined && isInt(e.n) ? e.who : null);
})();
