// ACCESSION — sentences: the module hourly_demonstration and its archetype, demonstrator (the
// stations): the chime and its lines (BUILD.md §3.4, §5.4, §8.1), owned by MOD-CHIME. M4's
// skeleton made it; M4's Wave 0 (W0a) moved here the sentences of the period wake cause (told in
// the past, as every waking is), and gave the module's rules theirs, and a chime's stations one
// line in the log. The module's sound is a chime, never "the bell", which is the clock's (§5.4).
// MOD-CHIME fills the rest.
'use strict';
(() => {
  const isInt = Number.isInteger;
  const why = 'the chime sounded';
  Text.defineCause('woke', 'period', (e, w) => e.was == null ? `${w.Name(e.who)} was already awake: ${why}.` : `${w.Name(e.who)} woke: ${why}.`);
  Text.defineCause('hunting', 'period', (e, w) => e.was === 'dormant' ? `${w.Name(e.who)} woke and began hunting you: ${why}.` : `${w.Name(e.who)} began hunting you: ${why}.`);
  // A chime wakes every station in one step: the log tells them in one line.
  Text.defineGroup('woke', 'period', events => `At the chime, ${Text.count(events.length, 'station')} woke to mark their lines.`);

  const RULES = {
    chime: e => isInt(e.turns) ? `The chime sounded: the stations’ lines strike in ${Text.count(e.turns, 'turn')}.` : 'The chime sounded.',
    line: (e, w) => `${w.Name(e.who)} marked its line.`,
    blocked: (e, w) => `${w.Name(e.who)} did not mark its line: another mark already lies on it.`,
    settle: (e, w) => `${w.Name(e.who)} went back to sleep, with the pips it had.`,
  };
  const known = e => Object.prototype.hasOwnProperty.call(RULES, e.rule) && (e.rule === 'chime' || e.who !== undefined);
  Text.defineCause('module', 'hourly_demonstration', (e, w) => known(e) ? RULES[e.rule](e, w) : 'The chime’s rule acted.');
})();
