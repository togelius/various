// ACCESSION — sentences: S.9's Centrepiece, completing_guardian (the Composite), with its limbs
// and its treasure (BUILD.md §3.4, §5.5), owned by COMPOSITE-CORE. M4's skeleton made it; M4's
// Wave 0 (W0a) gave the phase event's causes for the limbs their sentences. COMPOSITE-CORE named
// the limb grown, and gave its going back from outside its hall its own; COMPOSITE-PHASES the
// limb a phase grows, and the leave-heal's heal and dropped limb.
'use strict';
(() => {
  const isInt = Number.isInteger;
  const limbs = (e, sep) => isInt(e.stage) ? `${sep} it has ${Text.count(e.stage, 'limb')}` : '';
  const whose = (w, uid) => uid === 'you' ? 'your' : `${w.Name(uid)}’s`;
  // The limb a phase event names (gained, a SPECIALS id): its noun, the limb ("its neck"), or "a
  // limb" for a special with none.
  const limb = sp => {
    const S = typeof sp === 'string' && Object.prototype.hasOwnProperty.call(Registry.SPECIALS, sp) ? Registry.SPECIALS[sp] : null;
    return S && typeof S.noun === 'string' && S.noun ? `its ${S.noun}` : 'a limb';
  };
  // A limb grown for the galleries you have walked (n): "The Composite, … grew its legs, for the
  // 4 galleries you have walked: it has 2 limbs." Told wherever you are: it says how many
  // galleries you have walked, which you know, and nothing of where it stands.
  Text.defineCause('phase', 'walked', (e, w) => `${w.Name(e.who)} grew ${limb(e.gained)}${isInt(e.cause.n) ? `, for the ${Text.count(e.cause.n, 'gallery')} you have walked` : ''}${limbs(e, ':')}.`);
  // A limb a phase it entered grew (Guardian.gain), told after that phase's own sentence: "The
  // Composite, … grew its tail as its phase 2 began: it has 3 limbs."
  Text.defineCause('phase', 'limb', (e, w) => `${w.Name(e.who)} grew ${limb(e.gained)}${isInt(e.phase) ? ` as its phase ${e.phase} began` : ''}${limbs(e, ':')}.`);
  // You left its hall while it hunted you (Guardian.leave): it dropped its last limb (cause
  // limb), and, told by its own event, regained health (healed, cause left).
  Text.defineCause('phase', 'left', (e, w) => `You left ${whose(w, e.who)} hall while it hunted you, so it dropped ${limb(e.cause.limb)}${limbs(e, ':')}.`);
  Text.defineCause('healed', 'left', (e, w) => `You left ${whose(w, e.who)} hall while it hunted you, so it regained ${e.amount} health: now ${e.hp}.`);
  // Hunting or searching for you while you stand outside its hall, out of its sight or
  // searching, it goes back to its place (rules/arch/completing_guardian.js).
  Text.defineCause('lost', 'outside', (e, w) => `${w.Name(e.who)} goes back to its place: you are outside its hall, which it never leaves.`);
})();
