// ACCESSION — sentences: the module weather_cases: weather cases, fog and rain (BUILD.md §3.4,
// §5.4, §8.1), owned by MOD-WEATHER. M4's skeleton made it; M4's Wave 0 (W0a) gave weather's
// surface and the module's rules their sentences. MOD-WEATHER built the rest: the stop's.
//
// What the log tells of a release: the weather that got out, what it does, how large and for
// how long (the surface event, told whether or not you see it, as every surface is; a release
// is yours: you opened, broke or dissolved the case); the release's own module event says the
// same, so the log tells it once, by the surface. What it tells of rain on a station: that it
// is fixed in place, for how long and why (the status event, told only while you see it, as
// every status is), and that its line was called off (combat's cancel, likewise); the stop's
// own module event says the same, so it is told once, by the status.
'use strict';
(() => {
  const isInt = Number.isInteger;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  // Fog blocks sight across its square; rain soaks it (the stop is told by its status, which
  // names the exhibit, and only while you see it).
  const WEATHER = {
    fog: e => `Fog got out of the case: it blocks sight, ${Text.tiles(e.size)} a side, for ${Text.count(e.turns, 'turn')}.`,
    rain: e => `Rain got out of the case: it soaks the floor, ${Text.tiles(e.size)} a side, for ${Text.count(e.turns, 'turn')}.`,
  };
  Text.defineCause('surface', 'weather', e => own(WEATHER, e.kind) && isInt(e.size) && isInt(e.turns) ? WEATHER[e.kind](e) : 'Weather got out of the case.');

  const RULES = {
    release_opened: e => e.cause && e.cause.by === 'you' ? 'Weather got out of the case as you opened it.' : 'Weather got out of the case as it was opened.',
    release_broken: () => 'Weather got out of the case as its glass went.',
    rain_stop: (e, w) => `${w.Name(e.who)} stopped in the rain${isInt(e.turns) ? ', for ' + Text.count(e.turns, 'turn') : ''}.`,
  };
  // rain_stop is about an exhibit: one whose event names none has no sentence, since it could
  // be about one out of view (see text/mod-unobserved.js).
  Text.defineCause('module', 'weather_cases', (e, w) => e.rule === 'rain_stop' && e.who === undefined ? null
    : own(RULES, e.rule) ? RULES[e.rule](e, w) : 'The weather acted.');
  // A release is told by the weather it let out; a stop by its status.
  const sameTile = (a, b) => Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1];
  Text.toldBy('module', 'weather_cases', (e, f) => (e.rule === 'release_opened' || e.rule === 'release_broken') && f.k === 'surface' && !!f.cause && f.cause.k === 'weather' && sameTile(f.cause.case, e.at));
  Text.toldBy('module', 'weather_cases', (e, f) => e.rule === 'rain_stop' && f.k === 'status' && f.on && f.who === e.who && !!f.cause && f.cause.k === 'weather_cases');

  // The stop (fixed, §8.1), by its status's words (Registry.STATUSES.fixed.words, "fixed in
  // place"), the same words its label's status shows, and why: while it stands in rain, and for
  // RAIN_STOP_TURNS turns after. It ends by its timer (the status cause's own sentence).
  const words = () => own(Registry.STATUSES, 'fixed') && Registry.STATUSES.fixed.words ? Registry.STATUSES.fixed.words : 'fixed in place';
  Text.defineCause('status', 'weather_cases', (e, w) => e.on
    ? `${w.Name(e.who)} ${w.is(e.who)} now ${words()}${isInt(e.turns) ? ' for ' + Text.count(e.turns, 'turn') : ''}: rain stops it while it stands in it, and for ${Text.count(N.RAIN_STOP_TURNS, 'turn')} after.`
    : `${w.Name(e.who)} ${w.is(e.who)} no longer ${words()}.`);
})();
