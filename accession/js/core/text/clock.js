// ACCESSION — sentences: the clock and leaving (BUILD.md §8.4, §8.9), owned by W1-CLOCK. Also
// the dial's sentence, Text.clock(view), from Clock.view(state).
'use strict';
(() => {
  const turns = n => n === 1 ? '1 turn' : `${n} turns`;

  // The stages (§8.4), each saying what changes. A night-watch bell wakes only the sleepers it
  // can reach (ClockRules.nearestSleepers, §8.4): a walk from you reaches them, they are not in
  // an intact case, and they can hear (not pipless, §8.2). The announcement says what "it can
  // reach" means, without naming a mimic; each bell then says only "that it can reach", and
  // never that no sleeper is left, since those it cannot reach may still sleep.
  function stage(e) {
    if (e.stage === 'bell') return 'The bell rings: sleeping exhibits no longer lose their pips, and you recover health half as fast.';
    if (e.stage === 'night_watch') return `The night watch begins: you no longer recover health, and every ${N.NIGHT_WAKE_EVERY} turns a bell will wake the ${N.NIGHT_WAKE_COUNT} sleeping exhibits nearest you that it can reach (by a walk from you; never one in a case, or one that cannot hear).`;
    if (e.stage === 'night_bell') {
      const n = Array.isArray(e.woke) ? e.woke.length : 0;
      if (n === 1) return 'A night-watch bell rings: the sleeping exhibit nearest you that it can reach wakes and hunts you.';
      return n ? `A night-watch bell rings: the ${n} sleeping exhibits nearest you that it can reach wake and hunt you.` : 'A night-watch bell rings, but there is no sleeping exhibit it can reach to wake.';
    }
    return 'The clock moves on.';
  }
  Text.define('stage', stage);
  Text.defineCause('stage', 'clock', stage);

  Text.define('entered', (e, w) => `${w.Name(e.who)} came in.`);
  // At the entrance, or, when someone stands on it, on the free tile nearest it (near).
  Text.defineCause('entered', 'night_watch', (e, w) => {
    const where = e.cause.near ? 'near the entrance, since someone is standing on it' : 'at the entrance';
    return `${w.Name(e.who)} comes in ${where}${e.cause.n > 1 ? ', in place of the one that fell' : ''}.`;
  });
  Text.defineCause('entered', 'visit', () => 'You enter the department.');

  const WHEN = ['during open hours', 'after the bell', 'during the night watch'];
  Text.define('left', (e, w) => `${w.Name(e.who)} left.`);
  Text.defineCause('left', 'leave', e => `You left the department ${WHEN[e.cause.stage] || 'by an exit door'}.`);

  // The Night Watchman is made hunting with the night watch (a creation woke, with no
  // hunting event); a night-watch bell wakes sleepers straight into a hunt (woke, then
  // hunting). Each sentence gives the reason its cause stands for.
  const why = { night_bell: 'the night-watch bell rang', night_watch: 'the night watch is on' };
  for (const k of ['night_bell', 'night_watch']) {
    Text.defineCause('woke', k, (e, w) => e.was == null
      ? (k === 'night_watch' ? `${w.Name(e.who)} is on its rounds, hunting you from the start.` : `${w.Name(e.who)} is awake: ${why[k]}.`)
      : `${w.Name(e.who)} woke: ${why[k]}.`);
    Text.defineCause('hunting', k, (e, w) => e.was === 'dormant' ? `${w.Name(e.who)} woke and is hunting you: ${why[k]}.` : `${w.Name(e.who)} is hunting you: ${why[k]}.`);
  }

  // leave(i)'s refusals.
  Text.defineRefusal('no_exit', () => 'There is no such exit door.');
  Text.defineRefusal('not_on_exit', () => 'Stand on the exit door to leave by it.');

  // The dial's sentence (§7.2), from Clock.view(state): the stage, the clock's turn, and
  // what comes next and when.
  function dial(v) {
    if (!v) return 'The clock: this room has no closing time.';
    const at = `turn ${v.count}`;
    if (v.stage === 0) return `The clock: open hours, ${at}; the bell rings in ${turns(v.toBell)}.`;
    if (v.stage === 1) return `The clock: after the bell, ${at}; the night watch begins in ${turns(v.toWatch)}.`;
    const back = v.watchBack !== null && v.watchBack !== undefined ? ` Another Night Watchman comes in ${turns(v.watchBack)}.` : '';
    return `The clock: the night watch, ${at}; the next night-watch bell rings in ${turns(v.toNightBell)}.${back}`;
  }
  Text.provide('clock', dial);
})();
