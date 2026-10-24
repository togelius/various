// ACCESSION — sentences: waking (BUILD.md §8.2), owned by W1-WAKE-A. Noise, pips, waking and
// hunting, and why: the ring, noise and the special triggers; and what "Quiet, Please", the
// Re-admission Ticket and noise do to exhibits that are awake.
'use strict';
(() => {
  // A noise is told as its caption (§8.2): "Crash: glass breaking, heard 10 tiles away."
  // Each noise's own cause says what made it; this is the sentence for one that does not.
  const CLS = { soft: 'Soft', loud: 'Loud', crash: 'Crash' };
  Text.define('noise', e => `${CLS[e.cls] || 'A noise'}: a noise, heard ${e.range} tiles away.`);

  // A pip is shown only for an exhibit in view, so the log never tells you about one you
  // cannot see (§8.2's pips are shown on the exhibit).
  const pips = e => `${e.pips} of ${N.PIPS_TO_WAKE} pips`;
  const stir = (e, w, why) => `${w.Name(e.who)} ${e.delta < 0 ? 'settles' : 'stirs'} (${pips(e)})${why ? ': ' + why : ''}.`;
  const ally = (e, w) => e.cause.ally ? `${w.name(e.cause.ally)}, one of its group, took damage` : 'one of its group took damage';
  Text.define('pip', (e, w) => stir(e, w, ''), { log: 'seen' });
  Text.defineCause('pip', 'ring', (e, w) => stir(e, w, `you are inside your ring, ${e.cause.dist} tiles away`));
  Text.defineCause('pip', 'noise', (e, w) => stir(e, w, `it heard a ${e.cause.cls} noise ${e.cause.dist} tiles away`));
  Text.defineCause('pip', 'axis', (e, w) => stir(e, w, `you are in its row or column, ${e.cause.dist} tiles away`));
  Text.defineCause('pip', 'decay', (e, w) => stir(e, w, `nothing has disturbed it for ${N.PIP_DECAY_TURNS} turns`));
  Text.defineCause('pip', 'quiet', (e, w) => stir(e, w, '“Quiet, Please” was read'));
  Text.defineCause('pip', 'tether', (e, w) => stir(e, w, `you came within ${N.TETHER_RANGE} tiles of what it guards`));
  Text.defineCause('pip', 'ally_hit', (e, w) => stir(e, w, ally(e, w)));

  // Waking. `was` is null for an actor made awake. A sleeper woken straight into a hunt is
  // told once, by its hunting sentence (Text.log merges the two).
  Text.define('woke', (e, w) => e.was == null ? `${w.Name(e.who)} is awake.` : `${w.Name(e.who)} woke.`);
  Text.define('hunting', (e, w) => `${w.Name(e.who)} is hunting you.`);
  const why = {
    ring: e => 'you stayed inside your ring',
    noise: e => e.cause.cls ? `it heard a ${e.cause.cls} noise` : 'it heard a noise',
    axis: e => 'you stood in its row or column',
    tether: e => 'you came near what it guards',
    ally_hit: (e, w) => ally(e, w),
    awake: e => 'it never sleeps',
  };
  for (const k of ['ring', 'noise', 'axis', 'tether', 'ally_hit', 'awake']) {
    const because = why[k];
    // Woken by a noise, it goes to look where the noise was.
    const then = k === 'noise' ? ', and goes to look' : '';
    Text.defineCause('woke', k, (e, w) => e.was == null ? `${w.Name(e.who)} is awake: ${because(e, w)}.` : `${w.Name(e.who)} woke: ${because(e, w)}${then}.`);
    Text.defineCause('hunting', k, (e, w) => e.was === 'dormant' ? `${w.Name(e.who)} woke and is hunting you: ${because(e, w)}.` : `${w.Name(e.who)} is hunting you: ${because(e, w)}.`);
  }

  // Losing you, being settled, and being sent to look, for waking's reasons.
  const MODES = { dormant: 'asleep', awake: 'awake', searching: 'searching where it last saw you' };
  Text.defineCause('lost', 'quiet', (e, w) => e.to === 'dormant' ? `${w.Name(e.who)} settled where it stands: “Quiet, Please” was read.`
    : `${w.Name(e.who)} lost you, and is now ${MODES[e.to] || 'awake'}: “Quiet, Please” was read.`);
  Text.defineCause('lost', 'ticket', (e, w) => `${w.Name(e.who)} lost you, and is ${MODES[e.to] || 'searching where it last saw you'}: you went back to the entrance.`);
  Text.defineCause('returned', 'quiet', (e, w) => `${w.Name(e.who)} settled back to sleep: “Quiet, Please” was read.`);
  Text.defineCause('alerted', 'noise', (e, w) => `${w.Name(e.who)} heard a ${e.cause.cls} noise ${e.cause.dist} tiles away, and goes to look.`);
})();
