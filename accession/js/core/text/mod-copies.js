// ACCESSION — sentences: the module copies_weaken: the weakened spares (BUILD.md §3.4, §5.4),
// owned by MOD-COPIES. M4's skeleton made it; M4's Wave 0 (W0a) gave its module event a sentence
// for its rule, and an original's spares one line in the log. MOD-COPIES built the rest: the
// split rule's sentence and the slowing's.
//
// What the log tells of an original's fall (Text.log): the spares that lost heart in one line
// (the module events, by their original, cause.by), and their slowing in one line (the status
// events, likewise). Both are events about the spare (who), so a spare out of view is neither
// told nor counted (module and status events are logged only while their exhibit is in view),
// and the log never gives away a weakening you could not see. A spare split in bodies (a
// splitter's halves, each its own event) is one spare: the line counts spares, and says how
// many bodies they are when that is more ("its spare, in 2 bodies, lost heart"), since a half
// is a split of the spare, never another spare.
'use strict';
(() => {
  const RULES = {
    weaken: (e, w) => `${w.Name(e.who)} lost heart: its original was destroyed.`,
    split: (e, w) => `${w.Name(e.who)} lost heart too: it split from a spare whose original was destroyed.`,
  };
  // A spare's event names the spare (who); one that names none has no sentence, since it could
  // be about one out of view (see text/mod-unobserved.js).
  Text.defineCause('module', 'copies_weaken', (e, w) => Object.prototype.hasOwnProperty.call(RULES, e.rule) && e.who === undefined ? null
    : Object.prototype.hasOwnProperty.call(RULES, e.rule) ? RULES[e.rule](e, w) : 'One of this department’s rules acted.');
  // An original's spares lose heart in one step: the log tells them in one line. They share
  // their reason only with the spares of the same original (cause.by), so two originals
  // destroyed in one step are two lines; another rule of the module is never told with them.
  const original = e => e.cause && typeof e.cause.by === 'string' ? e.cause.by : '';
  // The spares a group's events are about, each a line of bodies (its first body's uid, up to
  // the first slash: a half's uid is <body uid>/<k>), in the order told; and ", in 3 bodies,"
  // when they are more bodies than spares.
  const spares = events => { const out = []; for (const e of events) { const l = String(e.who).split('/')[0]; if (!out.includes(l)) out.push(l); } return out; };
  const inBodies = (events, n) => events.length > n ? `, in ${Text.count(events.length, 'body', 'bodies')},` : '';
  // (A group is two or more, and only the spares in view are told.)
  Text.defineGroup('module', 'copies_weaken', events => {
    const n = spares(events).length, b = inBodies(events, n);
    return original(events[0])
      ? `An original was destroyed, and ${n === 1 ? 'its spare' : `${n} of its spares`}${b} lost heart.`
      : `${Text.count(n, 'spare')}${b} lost heart, each because its original was destroyed.`;
  },
  e => e.rule === 'weaken' && e.who !== undefined ? original(e) : null);

  // The slowing, for the rest of the visit (a status put on with turns 'perm': its event says
  // turns null), told by the status's own words (Registry.STATUSES[id].words) and what slowed
  // does, as text/status.js tells a status; it ends only with the visit, so it is never told
  // ending. Spares of one original slowed in one step are one line, as their losing heart is.
  // (A status with no words reads "affected", never its id.)
  const words = id => Object.prototype.hasOwnProperty.call(Registry.STATUSES, id) && Registry.STATUSES[id].words ? Registry.STATUSES[id].words : 'affected';
  const lasts = e => Number.isInteger(e.turns) ? ` for ${Text.count(e.turns, 'turn')}` : e.turns === null ? ' until you leave' : '';
  const does = (e, each) => e.id === 'slowed' ? ` (${each ? 'each' : 'every'} action takes ${N.SPEED_SLOW_PCT}% of its usual time)` : '';
  Text.defineCause('status', 'copies_weaken', (e, w) => e.on
    ? `${w.Name(e.who)} ${w.is(e.who)} now ${words(e.id)}${lasts(e)}${does(e, false)}: the original of its copy group was destroyed.`
    : `${w.Name(e.who)} ${w.is(e.who)} no longer ${words(e.id)}.`);
  Text.defineGroup('status', 'copies_weaken', (events, w) => {
    const l = spares(events), b = inBodies(events, l.length);
    return l.length === 1
      ? `${w.Name(l[0])}${b} is now ${words(events[0].id)}${lasts(events[0])}${does(events[0], true)}: the original of its copy group was destroyed.`
      : `${Text.count(l.length, 'spare')}${b} are now ${words(events[0].id)}${lasts(events[0])}${does(events[0], true)}: their original was destroyed.`;
  },
    e => e.on && e.who !== undefined && e.who !== 'you' && original(e) ? `${original(e)}\n${e.id}\n${e.turns}` : null);
})();
