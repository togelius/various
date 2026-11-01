// ACCESSION — sentences: A.4's Centrepiece, mp_ensemble (the Ordinance) (BUILD.md §3.4, §5.5),
// owned by ENSEMBLE-CORE. M4's skeleton made it; M4's Wave 0 (W0a) gave the phase event's cause
// for a special taken on its sentence. ENSEMBLE-CORE gave its phases theirs.
'use strict';
(() => {
  const isInt = Number.isInteger;
  const PHASES = 1 + N.CP_PHASE_PCT.length;
  // A special's name in a sentence, from its shape, as text/centrepiece.js names it ('a burst').
  const SHAPE = { ring: 'ring of blows', line: 'beam', call: 'call', burst: 'burst' };
  const special = sp => {
    const S = typeof sp === 'string' && Object.prototype.hasOwnProperty.call(Registry.SPECIALS, sp) ? Registry.SPECIALS[sp] : null;
    return S && Object.prototype.hasOwnProperty.call(SHAPE, S.shape) ? `a ${SHAPE[S.shape]}` : 'a new special';
  };

  // The Ordinance's phase (cause ensemble, rules/arch/mp_ensemble.js): the Centrepiece is now in
  // phase k, since its pieces' health together has fallen to CP_PHASE_PCT[k − 2]% of their full
  // health together or below; and the special the phase gives, which its first piece still
  // standing (who) gains. That piece is named only when you see it (cause.seen); otherwise the
  // sentence says only where the special went by the rule its line states, so no sentence names
  // a piece of the Ordinance out of your sight (whether it still stands, where it is).
  Text.defineCause('phase', 'ensemble', (e, w) => {
    if (!isInt(e.phase) || e.phase < 2 || e.phase > PHASES) return 'The Centrepiece changed its phase.';
    const now = `The Centrepiece is now in phase ${e.phase} of ${PHASES}: its pieces’ health together has fallen to ${N.CP_PHASE_PCT[e.phase - 2]}% of their full health or below.`;
    if (typeof e.gained !== 'string') return now;
    return e.cause && e.cause.seen === true
      ? `${now} ${w.Name(e.who)}, the first of them still standing, has ${special(e.gained)}.`
      : `${now} The first of them still standing, out of your sight, has ${special(e.gained)}.`;
  });

  // ENSEMBLE-PHASES': a piece took on the special of one that fell.
  Text.defineCause('phase', 'inherited', (e, w) => e.cause.from !== undefined
    ? `${w.Name(e.who)} took on the special of ${w.name(e.cause.from)}, which fell.`
    : `${w.Name(e.who)} took on the special of a piece that fell.`);
})();
