// ACCESSION — sentences: S.9's Centrepiece, completing_guardian (the Composite), with its limbs
// and its treasure (BUILD.md §3.4, §5.5), owned by COMPOSITE-CORE. M4's skeleton made it; M4's
// Wave 0 (W0a) gave the phase event's causes for the limbs their sentences. COMPOSITE-CORE named
// the limb grown, and gave its going back from outside its hall its own.
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
  Text.defineCause('phase', 'left', (e, w) => `You left ${whose(w, e.who)} hall while it hunted you, so it healed ${N.GUARDIAN_LEAVE_HEAL_PCT}% of its maximum health and dropped a limb${limbs(e, ';')}.`);
  // Hunting or searching for you while you stand outside its hall, out of its sight or
  // searching, it goes back to its place (rules/arch/completing_guardian.js).
  Text.defineCause('lost', 'outside', (e, w) => `${w.Name(e.who)} goes back to its place: you are outside its hall, which it never leaves.`);
})();
