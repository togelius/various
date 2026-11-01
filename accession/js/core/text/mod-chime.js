// ACCESSION — sentences: the module hourly_demonstration and its archetype, demonstrator (the
// stations): the chime and its lines (BUILD.md §3.4, §5.4, §8.1), owned by MOD-CHIME. M4's
// skeleton made it; M4's Wave 0 (W0a) moved here the sentences of the period wake cause (told in
// the past, as every waking is), and gave the module's rules theirs, and a chime's stations one
// line in the log. The module's sound is a chime, never "the bell", which is the clock's (§5.4).
// MOD-CHIME built the rules these tell: a station's line marked (its own sentence is combat's
// telegraphed, which calls it a line: the registry's noun) is due at the multiple; one that
// would overlap a mark already lying is blocked; one that woke for the chime settles at the
// multiple, after its line has gone off. (A woke event of the chime with no `was`, told
// "was already awake", is never made: the chime wakes only a station asleep, Wake.perform.)
'use strict';
(() => {
  const isInt = Number.isInteger;
  // A station wakes for its chime at the boundary's wake checks (step 4), before the chime
  // sounds (step 8): so the log says it woke for the chime, then that the chime sounded, in
  // the order they come, never that the chime had sounded before it did.
  Text.defineCause('woke', 'period', (e, w) => e.was == null ? `${w.Name(e.who)} was already awake for the chime.` : `${w.Name(e.who)} woke for the chime.`);
  Text.defineCause('hunting', 'period', (e, w) => e.was === 'dormant' ? `${w.Name(e.who)} woke for the chime and began hunting you.` : `${w.Name(e.who)} began hunting you at the chime.`);
  // A chime wakes every station in one step: the log tells them in one line.
  // (One made awake, with no `was`, did not wake, and is told alone.)
  Text.defineGroup('woke', 'period', events => `${Text.count(events.length, 'station')} woke for the chime.`,
    e => e.was == null ? null : '');

  const RULES = {
    // Any line marked at it: a station held fixed, or whose line another mark blocks, marks none.
    chime: e => isInt(e.turns) ? `The chime sounded: any line marked at it strikes in ${Text.count(e.turns, 'turn')}.` : 'The chime sounded.',
    line: (e, w) => `${w.Name(e.who)} marked its line at the chime.`,
    blocked: (e, w) => `${w.Name(e.who)} did not mark its line: another mark already lies on it.`,
    settle: (e, w) => `${w.Name(e.who)} went back to sleep, with the pips it had.`,
  };
  // A station's chime is told only while you see the station (Text.seenOnly): its waking for
  // the chime, its line's mark and its line going off. Chimes come on a schedule in every room
  // of M.11, and a line never leaves its room, so one you cannot see threatens you only by the
  // tiles its mark lies on, which the board shows wherever you see them (a walk or a rest
  // stops for a new mark there), and the confirmation before a long action still names it
  // (D7.3); a line that strikes you is told by its damage, and so is an exhibit it wakes into
  // a hunt (its hunting sentence), but not its striking an exhibit out of your sight, directly
  // or sent back by a reflector. The chime itself is heard, and told.
  Text.seenOnly('woke', 'period', () => true);
  Text.seenOnly('telegraphed', 'special', e => e.sp === 'demo_line');
  Text.seenOnly('special', 'special', e => e.sp === 'demo_line');
  Text.seenOnly('damaged', 'special', e => e.cause.sp === 'demo_line');
  Text.seenOnly('damaged', 'reflected', e => e.cause.sp === 'demo_line');
  // A line marked at the chime is told by its mark's own sentence ("… marks 12 tiles for its
  // line: 4 before your Padding, in 2 turns."), which comes after it in the same step and says
  // more, so the log tells the mark once, never "marked its line at the chime." as well.
  Text.toldBy('module', 'hourly_demonstration', (e, f) => e.rule === 'line' && f.k === 'telegraphed' && f.who === e.who);
  // A rule about a station (line, blocked, settle) whose event names none has no sentence,
  // since it could be about one out of view (see text/mod-unobserved.js); the chime is heard.
  const ABOUT = ['line', 'blocked', 'settle'];
  Text.defineCause('module', 'hourly_demonstration', (e, w) => ABOUT.includes(e.rule) && e.who === undefined ? null
    : Object.prototype.hasOwnProperty.call(RULES, e.rule) ? RULES[e.rule](e, w) : 'The chime’s rule acted.');
})();
