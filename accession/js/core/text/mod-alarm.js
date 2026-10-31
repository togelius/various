// ACCESSION — sentences: the module alarm_network and its archetype, patrol_guard (the Wader):
// the alarm, its call and the patrol (BUILD.md §3.4, §5.4, §8.2), owned by MOD-ALARM. M4's
// skeleton made it; M4's Wave 0 (W0a) moved here the sentences of the alarm and patrol wake
// causes (told in the past, as every waking is, so the recap's "On turn N, …" reads), and gave
// the alarm and the module's rules theirs, and the alarm's wakes one line in the log.
// MOD-ALARM fills the rest.
'use strict';
(() => {
  const isInt = Number.isInteger;
  // Turns left of an alarm from the turn of its event, when the event gives both.
  const left = e => isInt(e.until) && isInt(e.turn) && e.until > e.turn ? e.until - e.turn : null;
  const alarm = (e, w) => {
    const n = left(e);
    return n === null ? `${w.Name(e.by)} raised the alarm.`
      : `${w.Name(e.by)} raised the alarm: for ${Text.count(n, 'turn')}, sleeping exhibits keep their pips and no exhibit goes back to sleep.`;
  };
  Text.define('alarm', alarm);
  Text.defineCause('alarm', 'alarm_network', alarm);

  // Woken by the alarm, an exhibit is awake and sets off to look where you were when the call
  // went off (§5.4); a patrol was made awake on its round.
  const why = { alarm: 'the alarm was raised', patrol: 'it walks its round' };
  for (const k of ['alarm', 'patrol']) {
    const then = k === 'alarm' ? ', and it set off to look where you were' : '';
    Text.defineCause('woke', k, (e, w) => e.was == null ? `${w.Name(e.who)} was already awake: ${why[k]}.` : `${w.Name(e.who)} woke: ${why[k]}${then}.`);
    Text.defineCause('hunting', k, (e, w) => e.was === 'dormant' ? `${w.Name(e.who)} woke and began hunting you: ${why[k]}.` : `${w.Name(e.who)} began hunting you: ${why[k]}.`);
  }
  // A call wakes many sleepers in one step: the log tells them in one line.
  Text.defineGroup('woke', 'alarm', events => `The alarm woke ${Text.count(events.length, 'exhibit')}, and they set off to look where you were.`);

  const RULES = {
    alarm_shown: (e, w) => `${w.Name(e.who)} has seen you, and will raise the alarm next turn.`,
    call: (e, w) => `${w.Name(e.who)} raised the alarm${isInt(e.n) ? ': ' + Text.count(e.n, 'sleeping exhibit') + ' woke' : ''}.`,
    alarm_over: () => 'The alarm is over.',
  };
  Text.defineCause('module', 'alarm_network', (e, w) => Object.prototype.hasOwnProperty.call(RULES, e.rule) && (e.who !== undefined || e.rule === 'alarm_over')
    ? RULES[e.rule](e, w) : 'The alarm network acted.');
})();
