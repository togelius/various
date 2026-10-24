// ACCESSION — sentences: the kiter, the axis_sniper and the reflector, and the glass and
// old_repair modifiers (BUILD.md §5.5, §8.1), owned by W1-ARCH-B: shots, and shots a
// reflector sends back. Each names the roll against the chance and the damage less Padding,
// as a blow's sentence does, and says when an old repair doubled it.
'use strict';
(() => {
  const POINT = { N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west' };
  // The damage sum: raw less Padding, the minimum if it applied, and an old repair's doubling.
  const sum = c => `${c.raw} − ${c.pad} Padding${c.floor ? `, at least ${c.floor}` : ''}` +
    (c.side ? `, doubled through its repaired ${POINT[c.side] || c.side} side` : '');
  const rolled = c => c.surprise ? 'a surprise shot, at full strength' : c.roll == null ? 'a certain hit' : `rolled ${c.roll} against ${c.chance}%`;
  // Whose shot it was: "your" for you, "the Signal Lamp’s" for an exhibit.
  const whose = (w, uid) => uid === 'you' ? 'your' : `${w.name(uid)}’s`;
  // Who a shot sent back went into: "you", "itself" for an exhibit hit by its own shot.
  const into = (w, who, shooter) => who === shooter && who !== 'you' ? 'itself' : w.name(who);

  Text.defineCause('missed', 'shot', (e, w) => `${w.Name(e.by)} shot at ${w.name(e.at)} and missed (rolled ${e.cause.roll} against ${e.cause.chance}%).`);
  Text.defineCause('damaged', 'shot', (e, w) => {
    const c = e.cause;
    if (c.surprise) return `${w.Name(c.by)} shot ${w.name(e.who)} unawares: ${e.amount} damage (${sum(c)}).`;
    return `${w.Name(c.by)} shot ${w.name(e.who)} for ${e.amount} (${rolled(c)}; ${sum(c)}).`;
  });

  // A shot a reflector sends back comes into whoever fired it (Ranged.shoot); a beam it
  // sends back goes on past its shooter (Ranged.beam), so it can strike others too.
  Text.defineCause('missed', 'reflected', (e, w) =>
    `${w.Name(e.cause.by)} sent ${whose(w, e.cause.shooter)} shot back, and it missed ${into(w, e.at, e.cause.shooter)} (rolled ${e.cause.roll} against ${e.cause.chance}%).`);
  // A beam's damage: its gross less Padding, the minimum if it applied, and an old repair's doubling.
  const beamSum = c => `${c.gross} − ${c.pad} Padding${c.gross - c.pad < c.net ? `, at least ${c.net}` : ''}` +
    (c.side ? `, doubled through its repaired ${POINT[c.side] || c.side} side` : '');
  const what = c => c.sp ? 'beam' : 'shot';
  Text.defineCause('damaged', 'reflected', (e, w) => {
    const c = e.cause;
    let detail = `${e.amount} damage`;
    if (c.sp && Number.isInteger(c.gross) && Number.isInteger(c.net)) detail += ` (${beamSum(c)})`;
    else if (c.raw != null) detail += ` (${c.roll == null ? '' : `rolled ${c.roll} against ${c.chance}%; `}${sum(c)})`;
    return `${w.Name(c.by)} sent ${whose(w, c.shooter)} ${what(c)} back into ${into(w, e.who, c.shooter)}: ${detail}.`;
  });

  const died = (e, w) => e.who === 'you' ? 'You fell.' : `${w.Name(e.who)} broke apart.`;
  Text.defineCause('died', 'shot', died);
  Text.defineCause('died', 'reflected', (e, w) => {
    const c = e.cause, own = e.who === c.shooter, k = what(c);
    if (e.who === 'you') return own ? `You fell to your own ${k}, sent back by ${w.name(c.by)}.` : `You fell to ${whose(w, c.shooter)} ${k}, sent back by ${w.name(c.by)}.`;
    return own ? `${w.Name(e.who)} broke apart on its own ${k}, sent back by ${w.name(c.by)}.` : `${w.Name(e.who)} broke apart on ${whose(w, c.shooter)} ${k}, sent back by ${w.name(c.by)}.`;
  });
})();
