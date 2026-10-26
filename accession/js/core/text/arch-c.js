// ACCESSION — sentences: the herald, the tethered_warden and the mimic_vitrine (BUILD.md
// §5.5, §8.2, §8.3), owned by W1-ARCH-C: the mimic's grip, the warden's heal at home and its
// going back when you leave its tether, and waking by a herald's call. (The marks and the
// resolve of the ring and the call are telegraphed and special events, whose sentences are
// combat's.)
'use strict';
(() => {
  // The mimic's grip: rooted, put on with this cause, told in the status's own words
  // (Registry.STATUSES[id].words) and for the event's turns, as text/status.js tells every
  // status, so it ends in the words it began with ("no longer rooted to the spot", when its
  // timer ends it, with the status's own cause).
  const words = id => Object.prototype.hasOwnProperty.call(Registry.STATUSES, id) && Registry.STATUSES[id].words ? Registry.STATUSES[id].words : String(id);
  const turns = n => n === 1 ? '1 turn' : `${n} turns`;
  Text.defineCause('status', 'grip', (e, w) => e.on
    ? `${w.Name(e.cause.by)} grips ${w.name(e.who)}: ${e.who === 'you' ? 'you' : 'it'} ${w.is(e.who)} now ${words(e.id)}${Number.isInteger(e.turns) ? ' for ' + turns(e.turns) : ''}.`
    : `${w.Name(e.who)} ${w.is(e.who)} no longer ${words(e.id)}, free of the grip of ${w.name(e.cause.by)}.`);
  // The warden, home again, heals to full.
  Text.defineCause('healed', 'home', (e, w) => `${w.Name(e.who)} is back in its place and heals ${e.amount}: health ${e.hp}.`);
  // You left the warden's tether, so it goes back.
  Text.defineCause('lost', 'tether', (e, w) => `${w.Name(e.who)} goes back: it will not follow you more than ${N.TETHER_RANGE} tiles from what it guards.`);
  // A herald's call wakes a sleeper awake, sent to look where you were.
  Text.defineCause('woke', 'herald', (e, w) => `${w.Name(e.who)} woke at the call of ${w.name(e.cause.by)}, and goes to look where you were.`);
  Text.defineCause('hunting', 'herald', (e, w) => `${w.Name(e.who)} is hunting you: ${w.name(e.cause.by)} called.`);
})();
