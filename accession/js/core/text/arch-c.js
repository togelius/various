// ACCESSION — sentences: the herald, the tethered_warden and the mimic_vitrine (BUILD.md
// §5.5), owned by W1-ARCH-C.
'use strict';
(() => {
  Text.defineCause('status', 'grip', (e, w) => e.on ? `${w.Name(e.cause.by)} grips ${w.name(e.who)}: ${w.name(e.who)} cannot move.` : `${w.Name(e.who)} ${w.is(e.who)} free of the grip.`);
  Text.defineCause('healed', 'home', (e, w) => `${w.Name(e.who)} is home and heals ${e.amount}: health ${e.hp}.`);
  Text.defineCause('lost', 'tether', (e, w) => `${w.Name(e.who)} will not go farther from what it guards, and goes back.`);
  Text.defineCause('woke', 'herald', (e, w) => `${w.Name(e.who)} woke: ${w.name(e.cause.by)} called.`);
  Text.defineCause('hunting', 'herald', (e, w) => `${w.Name(e.who)} is hunting you: ${w.name(e.cause.by)} called.`);
})();
