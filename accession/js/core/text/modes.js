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
  const mode = m => MODES[m] || 'changed';
  const turns = n => n === 1 ? '1 turn' : `${n} turns`;
  Text.define('lost', (e, w) => `${w.Name(e.who)} lost you, and is now ${mode(e.to)}.`);
  // One in an intact case (its cause's how: 'case') only waits there (§8.3): it never
  // searches where it last knew you were, or goes back to a place it never left. One that
  // never steps (how: 'stands': M4's Great Board and the Ordinance's pieces, which hunt but
  // stand fixed; Wake.stands) keeps watch where it stands, and settles there (M4 TABLEAU-CORE).
  const cased = e => !!e.cause && e.cause.how === 'case';
  const still = e => !!e.cause && e.cause.how === 'stands';
  Text.defineCause('lost', 'out_of_sight', (e, w) => `${w.Name(e.who)} lost you: it has not seen you for ${turns(e.cause.turns)}, ${cased(e) ? 'but stays in its case' : still(e) ? 'and keeps watch where it stands' : 'and searches where it last knew you were'}.`);
  Text.defineCause('lost', 'idle', (e, w) => cased(e) ? `${w.Name(e.who)} is settling down in its case: nothing has disturbed it for ${turns(e.cause.turns)}.`
    : still(e) ? `${w.Name(e.who)} is settling where it stands: nothing has disturbed it for ${turns(e.cause.turns)}.`
      : `${w.Name(e.who)} is going back: nothing has disturbed it for ${turns(e.cause.turns)}.`);
  Text.defineCause('lost', 'searched', (e, w) => cased(e) ? `${w.Name(e.who)} gave up looking for you, and stays in its case.`
    : still(e) ? `${w.Name(e.who)} stopped keeping watch for you, and is settling where it stands.` : `${w.Name(e.who)} searched where it last knew you were, and is going back.`);
  Text.defineCause('lost', 'displaced', (e, w) => `${w.Name(e.who)} was moved from its place, and is going back to it.`);
  Text.define('alerted', (e, w) => `${w.Name(e.who)} set off to look.`);
  Text.defineCause('alerted', 'searched', (e, w) => still(e) ? `${w.Name(e.who)} stopped keeping watch for you, and stays awake where it stands, for it does not go back to sleep.`
    : `${w.Name(e.who)} searched where it last knew you were, and wanders, for it does not go back to sleep.`);
  Text.defineCause('alerted', 'homeless', (e, w) => `${w.Name(e.who)} has no place left to go back to, and wanders.`);
  Text.defineCause('alerted', 'blocked', (e, w) => `${w.Name(e.who)} cannot get back to its place, for others stand in the way, and wanders for now.`);
  const back = (e, w) => e.phase === 'reinstalled' ? `${w.Name(e.who)} settled back to sleep.` : still(e) ? `${w.Name(e.who)} is settling in where it stands.` : `${w.Name(e.who)} is back in its place, settling in.`;
  Text.define('returned', back);
  Text.defineCause('returned', 'home', back);
  // One that never steps settles in where it stands at once, in the step it stops keeping watch
  // or settles (its lost event, how: 'stands'), which says so: told then, it is not told twice.
  Text.toldBy('returned', 'home', (e, f) => still(e) && e.phase === 'arrived' && f.k === 'lost' && f.who === e.who && still(f));

  Text.defineCause('woke', 'seen', (e, w) => `${w.Name(e.who)} woke: it saw you ${Text.tiles(e.cause.dist)} away.`);
  Text.defineCause('hunting', 'seen', (e, w) => e.was === 'dormant' ? `${w.Name(e.who)} woke and began hunting you: it saw you.` : `${w.Name(e.who)} saw you and began hunting you.`);

  const CLS = { soft: 'Soft', loud: 'Loud', crash: 'Crash' };
  const noise = what => e => `${CLS[e.cls] || 'A noise'}: ${what}, heard ${Text.tiles(e.range)} away.`;
  Text.defineCause('noise', 'door', noise('a door opening'));
  Text.defineCause('noise', 'close', noise('a door closing'));

  // Closing a door (rules/doors.js).
  Text.defineRefusal('no_door', () => 'There is no open door beside you there to close.');
  Text.defineRefusal('doorway_occupied', () => 'Something is standing in the doorway.');
})();
