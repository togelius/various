// ACCESSION — sentences: modes and movement (BUILD.md §8.2), owned by W1-WAKE-B. Moving and
// doors, and the changes of mode after waking.
'use strict';
(() => {
  // Steps and closed doors are left out of the log; an exhibit's door only when it is in view.
  Text.define('moved', (e, w) => `${w.Name(e.who)} moved.`, { log: false });
  Text.define('opened', (e, w) => `${w.Name(e.who)} opened the door.`, { log: 'seen' });
  Text.defineCause('opened', 'door', (e, w) => `${w.Name(e.who)} opened the door.`);
  Text.define('closed', (e, w) => `${w.Name(e.who)} closed the door.`, { log: false });

  const MODES = { dormant: 'asleep', awake: 'awake', hunting: 'hunting', searching: 'searching', returning: 'going back', reinstalling: 'settling back in' };
  const mode = m => MODES[m] || m;
  Text.define('lost', (e, w) => `${w.Name(e.who)} lost you, and is now ${mode(e.to)}.`);
  Text.defineCause('lost', 'out_of_sight', (e, w) => `${w.Name(e.who)} lost you: it has not seen you for ${e.cause.turns} turns.`);
  Text.defineCause('lost', 'idle', (e, w) => `${w.Name(e.who)} is going back: nothing has disturbed it for ${e.cause.turns} turns.`);
  Text.defineCause('lost', 'searched', (e, w) => `${w.Name(e.who)} searched where it last saw you, and is going back.`);
  Text.define('alerted', (e, w) => `${w.Name(e.who)} goes to look.`);
  Text.define('returned', (e, w) => e.phase === 'reinstalled' ? `${w.Name(e.who)} settled back to sleep.` : `${w.Name(e.who)} is back in its place.`);
  Text.defineCause('returned', 'home', (e, w) => e.phase === 'reinstalled' ? `${w.Name(e.who)} settled back to sleep.` : `${w.Name(e.who)} is back in its place.`);

  Text.defineCause('woke', 'seen', (e, w) => `${w.Name(e.who)} woke: it saw you ${e.cause.dist} tiles away.`);
  Text.defineCause('hunting', 'seen', (e, w) => e.was === 'dormant' ? `${w.Name(e.who)} woke and is hunting you: it saw you.` : `${w.Name(e.who)} saw you and is hunting you.`);

  const CLS = { soft: 'Soft', loud: 'Loud', crash: 'Crash' };
  const noise = what => e => `${CLS[e.cls] || 'A noise'}: ${what}, heard ${e.range} tiles away.`;
  Text.defineCause('noise', 'door', noise('a door opening'));
  Text.defineCause('noise', 'close', noise('a door closing'));
})();
