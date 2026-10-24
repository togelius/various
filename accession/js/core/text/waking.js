// ACCESSION — sentences: waking (BUILD.md §8.2), owned by W1-WAKE-A. Noise, pips, waking and
// hunting, and why: the ring, noise and the special triggers.
'use strict';
(() => {
  const CLS = { soft: 'Soft', loud: 'Loud', crash: 'Crash' };
  Text.define('noise', e => `${CLS[e.cls] || 'A'} noise, heard ${e.range} tiles away.`);
  // A pip is shown only for an exhibit in view, so the log never tells you about one you
  // cannot see (§8.2's pips are shown on the exhibit).
  const pips = e => `${e.pips} of ${N.PIPS_TO_WAKE} pips`;
  const stir = (e, w, why) => `${w.Name(e.who)} ${e.delta < 0 ? 'settles' : 'stirs'} (${pips(e)})${why ? ': ' + why : ''}.`;
  Text.define('pip', (e, w) => stir(e, w, ''), { log: 'seen' });
  Text.defineCause('pip', 'ring', (e, w) => stir(e, w, 'you are inside your ring'));
  Text.defineCause('pip', 'noise', (e, w) => stir(e, w, `it heard a ${e.cause.cls} noise ${e.cause.dist} tiles away`));
  Text.defineCause('pip', 'axis', (e, w) => stir(e, w, 'you are in its row or column'));
  Text.defineCause('pip', 'decay', (e, w) => stir(e, w, 'nothing has disturbed it'));
  Text.defineCause('pip', 'quiet', (e, w) => stir(e, w, '“Quiet, Please” was read'));
  Text.defineCause('pip', 'tether', (e, w) => stir(e, w, 'you came near what it guards'));
  Text.defineCause('pip', 'ally_hit', (e, w) => stir(e, w, 'one of its group took damage'));

  // Waking. `was` is null for an actor made awake.
  Text.define('woke', (e, w) => e.was == null ? `${w.Name(e.who)} is awake.` : `${w.Name(e.who)} woke.`);
  Text.define('hunting', (e, w) => `${w.Name(e.who)} is hunting you.`);
  const why = { ring: 'you stayed inside your ring', noise: 'it heard a noise', axis: 'you stood in its row or column',
    tether: 'you came near what it guards', ally_hit: 'one of its group took damage', awake: 'it never sleeps' };
  for (const k of ['ring', 'noise', 'axis', 'tether', 'ally_hit', 'awake']) {
    Text.defineCause('woke', k, (e, w) => e.was == null ? `${w.Name(e.who)} is awake: ${why[k]}.` : `${w.Name(e.who)} woke: ${why[k]}.`);
    Text.defineCause('hunting', k, (e, w) => e.was === 'dormant' ? `${w.Name(e.who)} woke and is hunting you: ${why[k]}.` : `${w.Name(e.who)} is hunting you: ${why[k]}.`);
  }

  // Losing you, and being sent to look, for waking's reasons.
  Text.defineCause('lost', 'quiet', (e, w) => `${w.Name(e.who)} lost you: “Quiet, Please” was read.`);
  Text.defineCause('lost', 'ticket', (e, w) => `${w.Name(e.who)} lost you: you went back to the entrance.`);
  Text.defineCause('alerted', 'noise', (e, w) => `${w.Name(e.who)} heard a ${e.cause.cls} noise and goes to look.`);
})();
