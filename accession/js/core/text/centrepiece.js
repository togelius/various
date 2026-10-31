// ACCESSION — sentences: what every Centrepiece shares: its specials, its phases (the phase
// event) and its wake (BUILD.md §3.4, §5.5, §8.1), owned by ARCH-CP-CORE. M4's skeleton made it;
// M4's Wave 0 (W0a) gave the phase event and a defeat's drop their sentences. ARCH-CP-CORE fills
// the rest.
'use strict';
(() => {
  const isInt = Number.isInteger;
  // A special's name in a sentence, from its shape, as the combat sentences name it.
  const SHAPE = { ring: 'ring of blows', line: 'beam', call: 'call' };
  const special = sp => {
    const S = typeof sp === 'string' && Object.prototype.hasOwnProperty.call(Registry.SPECIALS, sp) ? Registry.SPECIALS[sp] : null;
    return S && Object.prototype.hasOwnProperty.call(SHAPE, S.shape) ? `a ${SHAPE[S.shape]}` : 'a new special';
  };
  // "… is now in phase 2 of 3", and what it gained; the threshold its health fell past to
  // reach phase p (2 or more) is CP_PHASE_PCT[p − 2], % of its total health.
  const PHASES = 1 + N.CP_PHASE_PCT.length;
  const known = e => isInt(e.phase) && e.phase >= 1 && e.phase <= PHASES;
  const now = (e, w) => `${w.Name(e.who)} is now in phase ${e.phase} of ${PHASES}${typeof e.gained === 'string' ? `, and has ${special(e.gained)}` : ''}`;
  const phase = (e, w) => known(e) ? `${now(e, w)}.` : `${w.Name(e.who)} changed its phase.`;
  Text.define('phase', phase);
  Text.defineCause('phase', 'damaged', (e, w) => known(e) && e.phase >= 2
    ? `${now(e, w)}: its health fell past ${N.CP_PHASE_PCT[e.phase - 2]}% of its total.` : phase(e, w));

  Text.defineCause('dropped', 'defeated', (e, w) => `${w.Name(e.who)} fell, and its Signature piece dropped where it stood.`);
})();
