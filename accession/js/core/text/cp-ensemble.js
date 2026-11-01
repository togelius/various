// ACCESSION — sentences: A.4's Centrepiece, mp_ensemble (the Ordinance) (BUILD.md §3.4, §5.5),
// owned by ENSEMBLE-CORE and then ENSEMBLE-PHASES. M4's skeleton made it; M4's Wave 0 (W0a) gave
// the phase event's cause for a special taken on its sentence. ENSEMBLE-CORE gave its phases
// theirs; ENSEMBLE-PHASES its inheritance, its gallery hook and its shatter theirs.
//
// No sentence here names a piece of the Ordinance you cannot see (M4 ENSEMBLE-CORE's rule,
// kept by ENSEMBLE-PHASES): a phase's gainer, a piece that takes on a special and a piece whose
// shatter is spent are named only when their cause says you see them (seen, as the view model
// judges it); the hook's loss and the shatter's breaking name none, and the shatter's mark and
// its use are told only while you see the piece. A piece that fell is named, as its own died
// sentence names it.
'use strict';
(() => {
  const isInt = Number.isInteger;
  const PHASES = 1 + N.CP_PHASE_PCT.length;
  // A special's name in a sentence, as text/centrepiece.js names it: the noun its registry entry
  // gives ('a shatter'), else from its shape ('a burst'); a shape with no name of its own is "a
  // new special".
  const SHAPE = { ring: 'ring of blows', line: 'beam', call: 'call', burst: 'burst' };
  const entry = sp => typeof sp === 'string' && Object.prototype.hasOwnProperty.call(Registry.SPECIALS, sp) ? Registry.SPECIALS[sp] : null;
  const noun = sp => {
    const S = entry(sp);
    if (S && typeof S.noun === 'string' && S.noun) return S.noun;
    return S && Object.prototype.hasOwnProperty.call(SHAPE, S.shape) ? SHAPE[S.shape] : null;
  };
  const special = sp => { const n = noun(sp); return n ? `${/^[aeiou]/i.test(n) ? 'an' : 'a'} ${n}` : 'a new special'; };
  const the = sp => { const n = noun(sp); return n ? `the ${n}` : 'a special'; };

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

  // Inheritance (cause inherited {from, seen}): a piece still standing (who) took on a special
  // (gained) of one that fell (from). It is named only when you see it; the fallen piece is
  // named, as its died sentence names it. One fall's specials taken on by several pieces are
  // told in one sentence for each special (the group below).
  const fell = (e, w) => typeof e.cause.from === 'string' ? `${w.name(e.cause.from)}, which fell` : 'a piece that fell';
  Text.defineCause('phase', 'inherited', (e, w) => e.cause && e.cause.seen === true
    ? `${w.Name(e.who)} took on ${the(e.gained)} of ${fell(e, w)}.`
    : `A piece still standing, out of your sight, took on ${the(e.gained)} of ${fell(e, w)}.`);
  // The pieces that took one special on from one fall, the seen by name, in the order they came,
  // then how many out of your sight.
  Text.defineGroup('phase', 'inherited', (list, w) => {
    const seen = list.filter(e => e.cause.seen === true).map(e => w.name(e.who)), out = list.length - seen.length;
    const who = seen.concat(out ? [out === 1 ? 'a piece out of your sight' : `${out} pieces out of your sight`] : []);
    const said = who.length === 1 ? who[0] : `${who.slice(0, -1).join(', ')} and ${who[who.length - 1]}`;
    return `${said.charAt(0).toUpperCase() + said.slice(1)} took on ${the(list[0].gained)} of ${fell(list[0], w)}.`;
  }, e => `${e.cause.from}\n${e.gained}`);

  // The gallery hook (cause hook {of}): an original destroyed in the galleries, a companion
  // piece to the Ordinance, cost its first piece standing this much health. No piece is named:
  // you are in the galleries, it is in its hall.
  const health = n => isInt(n) && n === 1 ? '1 health' : `${n} health`;
  Text.defineCause('damaged', 'hook', (e, w) => `An original was destroyed in the galleries, a companion piece to the Centrepiece: its first piece standing lost ${health(e.amount)}.`);

  // The shatter's mark and its going off (the combat sentences, text/combat.js, which name the
  // piece) are told only while you see the piece: a piece marks its shatter whether or not it
  // sees you, so it may be out of your sight (the board shows the mark on the tiles you see).
  const shatter = e => e.sp === 'shatter_all';
  Text.seenOnly('telegraphed', 'special', shatter);
  Text.seenOnly('special', 'special', shatter);

  // The shatter going off (cause shatter): a case of its hall broke. This names no piece.
  const glass = n => { const id = Registry.order('GLASS').find(g => Registry.GLASS[g].n === n); return id ? Registry.GLASS[id].name : 'unknown'; };
  Text.defineCause('glass_broke', 'shatter', (e, w) => `The Centrepiece’s shatter broke the ${glass(e.glass)} glass of a case in its hall${e.shards && e.shards.length ? ', and shards spread' : ''}.${e.released ? ` ${w.Name(e.released)} is free.` : ''}`);

  // A shatter spent (cause spent {by, seen}): no case of its hall is intact, so the piece (who)
  // holds it no more; named only when you see it.
  Text.defineCause('special', 'spent', (e, w) => e.cause && e.cause.seen === true
    ? `${w.Name(e.who)} has ${the(e.sp)} no more: no case of its hall is intact.`
    : `A piece out of your sight has ${the(e.sp)} no more: no case of its hall is intact.`);
})();
