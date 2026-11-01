// ACCESSION — sentences: the module alarm_network and its archetype, patrol_guard (the Wader):
// the alarm, its call and the patrol (BUILD.md §3.4, §5.4, §8.2), owned by MOD-ALARM. M4's
// skeleton made it; M4's Wave 0 (W0a) moved here the sentences of the alarm and patrol wake
// causes (told in the past, as every waking is, so the recap's "On turn N, …" reads), and gave
// the alarm and the module's rules theirs, and the alarm's wakes one line in the log.
// MOD-ALARM added the call's crash, the clock brought nearer (its stage sentence states the
// advance's clamps) and a patrol going back to its round.
'use strict';
(() => {
  const isInt = Number.isInteger;
  // What an alarm does for its turns, in §5.4's words: pips do not decay, awake exhibits do not
  // return, and no new alarm can be raised (never "no exhibit sleeps": "Quiet, Please" is not
  // a return). As built (Modules.mayReturn), neither an awake exhibit left undisturbed nor a
  // searching one done searching goes back; one already going back goes on, and a tethered
  // warden still goes back when you leave its tether (its own rule), so the sentence names
  // the two reasons, not "no exhibit awake or searching". Turns left of an alarm from the turn
  // of its event, when the event gives both.
  const left = e => isInt(e.until) && isInt(e.turn) && e.until > e.turn ? e.until - e.turn : null;
  const alarm = (e, w) => {
    const n = left(e);
    return n === null ? `${w.Name(e.by)} raised the alarm.`
      : `${w.Name(e.by)} raised the alarm: for ${Text.count(n, 'turn')}, sleeping exhibits keep their pips, no exhibit goes back to its place for being left undisturbed or done searching, and no other alarm can be raised.`;
  };
  Text.define('alarm', alarm);
  Text.defineCause('alarm', 'alarm_network', alarm);

  // Woken by the alarm, an exhibit is awake and sets off to look where you were when the call
  // went off (§5.4), but one in an intact case, which wakes in it and stays there (§8.3; its
  // cause says how: 'case'); a patrol was made awake on its round.
  const why = { alarm: 'the alarm was raised', patrol: 'it walks its round' };
  const cased = e => !!e.cause && e.cause.how === 'case';
  for (const k of ['alarm', 'patrol']) {
    const then = k === 'alarm' ? ', and it set off to look where you were' : '';
    Text.defineCause('woke', k, (e, w) => e.was == null ? `${w.Name(e.who)} was already awake: ${why[k]}.`
      : k === 'alarm' && cased(e) ? `${w.Name(e.who)} woke in its case: ${why[k]}.` : `${w.Name(e.who)} woke: ${why[k]}${then}.`);
    Text.defineCause('hunting', k, (e, w) => e.was === 'dormant' ? `${w.Name(e.who)} woke and began hunting you: ${why[k]}.` : `${w.Name(e.who)} began hunting you: ${why[k]}.`);
  }
  // A call wakes many sleepers in one step: the log tells them in one line, and those in their
  // cases in another. (One made awake, with no `was`, did not wake, and is told alone.)
  Text.defineGroup('woke', 'alarm', events => cased(events[0]) ? `The alarm woke ${Text.count(events.length, 'exhibit')} in their cases.`
    : `The alarm woke ${Text.count(events.length, 'exhibit')}, and they set off to look where you were.`,
  e => e.was == null ? null : cased(e) ? 'case' : '');

  // The module's rules. alarm_shown: a Wader marked the alarm, which its next action sets off
  // (the mark's own sentence names only "its special"); call: its call went off, a crash and
  // then the wakes, each told by its own event (n of them); alarm_over: its turns are up, and
  // pips fade again, but not after the bell, when they never fade (its cause's fade).
  const RULES = {
    alarm_shown: (e, w) => `${w.Name(e.who)} has seen you, and shows the alarm: at its next action it raises it.`,
    call: (e, w) => `${w.Name(e.who)} called: with a crash, every exhibit still asleep that could hear, but the Centrepiece, woke${isInt(e.n) ? ` (${Text.count(e.n, 'exhibit')})` : ''}.`,
    alarm_over: e => `The alarm is over${isInt(e.turns) ? `, after ${Text.count(e.turns, 'turn')}` : ''}: ${e.cause && e.cause.fade === true ? 'pips fade again, and exhibits'
      : 'exhibits'} may go back to their places${e.cause && e.cause.fade === false ? ' (pips do not fade: the bell has rung)' : ''}.`,
  };
  // A rule about a Wader (alarm_shown, call) whose event names none has no sentence, since it
  // could be about one out of view (see text/mod-unobserved.js); alarm_over is about none.
  const ABOUT = ['alarm_shown', 'call'];
  Text.defineCause('module', 'alarm_network', (e, w) => ABOUT.includes(e.rule) && e.who === undefined ? null
    : Object.prototype.hasOwnProperty.call(RULES, e.rule) ? RULES[e.rule](e, w) : 'The alarm network acted.');

  // The call's crash, at the Wader's tile (§5.4): a noise as any crash is.
  const CLS = { soft: 'Soft', loud: 'Loud', crash: 'Crash' };
  Text.defineCause('noise', 'alarm', e => `${Object.prototype.hasOwnProperty.call(CLS, e.cls) ? CLS[e.cls] : 'A noise'}: the alarm being raised, heard ${Text.tiles(e.range)} away.`);

  // The clock brought nearer by an alarm (ClockRules.advance, §8.4): n turns sooner, where n
  // is what it moved, never sooner than the next turn (so fewer than ALARM_CLOCK_ADVANCE when
  // the stage was nearer than that), and nothing in the night watch. Before the bell, the
  // night watch moves with it.
  // While a hall is sealed (the cause's sealed) the clock is stopped (§8.4): the turns are the
  // clock's, which it counts once it starts again, and its next turn is not the next turn.
  const STOPPED = ' The clock is stopped while the hall is sealed: these are turns it counts once it starts again.';
  function sooner(what, n, also, sealed) {
    const next = sealed ? 'the clock’s next turn' : 'the next turn', NEXT = `never sooner than ${next}`, after = sealed ? STOPPED : '';
    if (!isInt(n) || n <= 0) return `The alarm cannot bring ${what} any sooner: it comes at ${next}, and nothing comes sooner than that.${after}`;
    if (n >= N.ALARM_CLOCK_ADVANCE) return `The alarm brings ${what} ${Text.count(n, 'turn')} sooner${also} (${NEXT}).${after}`;
    return `The alarm brings ${what} ${Text.count(n, 'turn')} sooner, to ${next}${also}: an alarm brings it up to ${Text.count(N.ALARM_CLOCK_ADVANCE, 'turn')} sooner, but ${NEXT}.${after}`;
  }
  Text.defineCause('stage', 'alarm_network', e => {
    const sealed = !!e.cause && e.cause.sealed === true;
    if (e.stage === 'bell_sooner') return sooner('the bell', e.n, ', and the night watch with it', sealed);
    if (e.stage === 'watch_sooner') return sooner('the night watch', e.n, '', sealed);
    if (e.stage === 'nothing_sooner') return 'The alarm brings nothing sooner: the night watch has begun, and the clock has no stage left to bring nearer.';
    return 'The alarm brings the clock nearer.';
  });

  // A patrol done searching goes back to its round (it never sleeps, so it does not go back to
  // sleep, nor wander).
  Text.defineCause('alerted', 'round', (e, w) => `${w.Name(e.who)} searched where it last knew you were, and goes back to its round.`);
})();
