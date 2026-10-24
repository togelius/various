// ACCESSION — sentences: the herald, the tethered_warden and the mimic_vitrine (BUILD.md
// §5.5, §8.2, §8.3), owned by W1-ARCH-C: the mimic's grip, the warden's heal at home and its
// going back when you leave its tether, and waking by a herald's call. (The marks and the
// resolve of the ring and the call are telegraphed and special events, whose sentences are
// combat's.)
'use strict';
(() => {
  // The mimic's grip: rooted, put on with this cause; it ends as every status does.
  Text.defineCause('status', 'grip', (e, w) => e.on
    ? `${w.Name(e.who)} ${w.is(e.who)} held in the grip of ${w.name(e.cause.by)}: ${w.name(e.who)} cannot move for ${N.MIMIC_GRIP_TURNS} turns.`
    : `${w.Name(e.who)} ${w.is(e.who)} free of the grip of ${w.name(e.cause.by)}.`);
  // The warden, home again, heals to full.
  Text.defineCause('healed', 'home', (e, w) => `${w.Name(e.who)} is back in its place and heals ${e.amount}: health ${e.hp}.`);
  // You left the warden's tether, so it goes back.
  Text.defineCause('lost', 'tether', (e, w) => `${w.Name(e.who)} goes back: it will not follow you more than ${N.TETHER_RANGE} tiles from what it guards.`);
  // A herald's call wakes a sleeper awake, sent to look where you were.
  Text.defineCause('woke', 'herald', (e, w) => `${w.Name(e.who)} woke at the call of ${w.name(e.cause.by)}, and goes to look where you were.`);
  Text.defineCause('hunting', 'herald', (e, w) => `${w.Name(e.who)} is hunting you: ${w.name(e.cause.by)} called.`);
})();
