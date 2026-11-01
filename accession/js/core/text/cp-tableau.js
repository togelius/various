// ACCESSION — sentences: M.11's Centrepiece, mp_tableau (the Great Board of the Central Station)
// (BUILD.md §3.4, §5.5), owned by TABLEAU-CORE. M4's skeleton made it; it had no sentence to move
// here (M4's Wave 0). Its beam, its burst and its summons are told by the specials' own
// sentences (text/combat.js: by their nouns, "its beam", "its summons"), its phases by the
// core's (text/centrepiece.js), and each body its summons calls by its creation's (text/arch-a.js:
// "The Logbook Trolley, Self-Propelled came from the Great Board of the Central Station and began
// hunting you."). What is its own: the bodies one summons calls, told together; and, from
// TABLEAU-PHASES, the Board Dish woken by its second phase. Its Repeater Arm is told as every
// station is (text/mod-chime.js), and the hall's rain on it as rain is (text/mod-weather.js).
'use strict';
(() => {
  const isBody = e => !!e.cause && e.cause.k === 'summoned' && e.cause.how === 'summon' && typeof e.cause.from === 'string';
  // Two or more bodies one summons called in a step (its creation woke events, cause summoned,
  // how 'summon', from it): one sentence, where the first came. Any other made body (a
  // splitter's half) is told alone, by its own sentence.
  Text.defineGroup('woke', 'summoned', (events, w) => `${w.Name(events[0].cause.from)} called ${Text.count(events.length, 'body', 'bodies')} onto the tiles it marked, and they began hunting you.`,
    e => isBody(e) && e.mode === 'hunting' ? e.cause.from : null);
  // Its summons going off (special, cause special) is told by the bodies it called, when one came.
  const summons = sp => typeof sp === 'string' && Object.prototype.hasOwnProperty.call(Registry.SPECIALS, sp) && Registry.SPECIALS[sp].effect === 'summon';
  Text.toldBy('special', 'special', (e, f) => !e.cancelled && summons(e.sp) && f.k === 'woke' && isBody(f) && f.cause.from === e.who);

  // The Board Dish woken by the Board's second phase (TABLEAU-PHASES; cause tab_phase {by: the
  // Board}): straight into a hunt, which Text.log tells once, by the hunting sentence.
  const second = (e, w) => `${w.name(e.cause.by)} entered its second phase`;
  Text.defineCause('woke', 'tab_phase', (e, w) => `${w.Name(e.who)} woke: ${second(e, w)}.`);
  Text.defineCause('hunting', 'tab_phase', (e, w) => e.was === 'dormant' ? `${w.Name(e.who)} woke and began hunting you: ${second(e, w)}.` : `${w.Name(e.who)} began hunting you: ${second(e, w)}.`);
})();
