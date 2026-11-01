// ACCESSION — sentences: what every Centrepiece shares: its specials, its phases (the phase
// event) and its fall (BUILD.md §3.4, §5.5, §8.1, §8.7), owned by ARCH-CP-CORE. M4's skeleton
// made it; M4's Wave 0 (W0a) gave the phase event and a defeat's drop their sentences.
'use strict';
(() => {
  const isInt = Number.isInteger;
  // A special's name in a sentence, as the combat sentences and the odds readout name it: the
  // noun its registry entry gives (the Great Board's summons, M4 TABLEAU-CORE), else from its
  // shape; a shape with no name of its own is "a new special".
  const SHAPE = { ring: 'ring of blows', line: 'beam', call: 'call', burst: 'burst' };
  const special = sp => {
    const S = typeof sp === 'string' && Object.prototype.hasOwnProperty.call(Registry.SPECIALS, sp) ? Registry.SPECIALS[sp] : null;
    if (S && typeof S.noun === 'string' && S.noun) return `${/^[aeiou]/i.test(S.noun) ? 'an' : 'a'} ${S.noun}`;
    return S && Object.prototype.hasOwnProperty.call(SHAPE, S.shape) ? `a ${SHAPE[S.shape]}` : 'a new special';
  };
  // "… is now in phase 2 of 3", and what it gained (who: the piece that gained it, the first
  // still standing); the threshold its health fell to, to reach phase p (2 or more), is
  // CP_PHASE_PCT[p − 2], % of its full health: the Centrepiece's, its pieces' together, which
  // need not be the named piece's own.
  const PHASES = 1 + N.CP_PHASE_PCT.length;
  const known = e => isInt(e.phase) && e.phase >= 1 && e.phase <= PHASES;
  const now = (e, w) => `${w.Name(e.who)} is now in phase ${e.phase} of ${PHASES}${typeof e.gained === 'string' ? `, and has ${special(e.gained)}` : ''}`;
  const phase = (e, w) => known(e) ? `${now(e, w)}.` : `${w.Name(e.who)} changed its phase.`;
  Text.define('phase', phase);
  Text.defineCause('phase', 'damaged', (e, w) => known(e) && e.phase >= 2
    ? `${now(e, w)}: the Centrepiece’s health has fallen to ${N.CP_PHASE_PCT[e.phase - 2]}% of its full health or below.` : phase(e, w));

  // The piece drops on the Centrepiece's footprint's top-left tile (§8.7), where it (one of its
  // pieces, for an ensemble: Centrepiece.check) first stood, which need not be where its last
  // piece fell (an ensemble's), so the sentence says so in those words.
  Text.defineCause('dropped', 'defeated', (e, w) => `${w.Name(e.who)} fell, and the Centrepiece’s Signature piece dropped to the floor where the Centrepiece first stood.`);
})();
