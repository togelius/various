// ACCESSION — sentences: the clock and leaving (BUILD.md §8.4, §8.9), owned by W1-CLOCK. Also
// the dial's sentence, Text.clock(view), provided here (a stub until W1-CLOCK builds it).
'use strict';
(() => {
  const STAGES = { bell: 'The bell rings: your recovery slows.', night_watch: 'The night watch begins.', night_bell: 'A night-watch bell rings.' };
  const stage = e => STAGES[e.stage] || 'The clock moves on.';
  Text.define('stage', stage);
  Text.defineCause('stage', 'clock', stage);
  Text.define('entered', (e, w) => `${w.Name(e.who)} came in.`);
  Text.defineCause('entered', 'night_watch', () => 'The Night Watchman comes.');
  Text.defineCause('entered', 'visit', () => 'You enter the department.');
  Text.define('left', (e, w) => `${w.Name(e.who)} left.`);
  Text.defineCause('left', 'leave', () => 'You left the department.');

  const why = { night_bell: 'the night-watch bell rang', night_watch: 'the night watch began' };
  for (const k of ['night_bell', 'night_watch']) {
    Text.defineCause('woke', k, (e, w) => e.was == null ? `${w.Name(e.who)} is awake: ${why[k]}.` : `${w.Name(e.who)} woke: ${why[k]}.`);
    Text.defineCause('hunting', k, (e, w) => e.was === 'dormant' ? `${w.Name(e.who)} woke and is hunting you: ${why[k]}.` : `${w.Name(e.who)} is hunting you: ${why[k]}.`);
  }

  // [stub → W1-CLOCK] the dial's sentence from Clock.view(state); null until built.
  Text.provide('clock', () => null);
})();
