// ACCESSION — sentences: the module weather_cases: weather cases, fog and rain (BUILD.md §3.4,
// §5.4, §8.6), owned by MOD-WEATHER. M4's skeleton made it; M4's Wave 0 (W0a) gave weather's
// surface and the module's rules their sentences. MOD-WEATHER fills the rest.
'use strict';
(() => {
  const isInt = Number.isInteger;
  // Fog blocks sight across its square; rain soaks it, and stops clockwork under it (§5.4).
  const WEATHER = {
    fog: e => `Fog got out of the case: it blocks sight, ${Text.tiles(e.size)} a side, for ${Text.count(e.turns, 'turn')}.`,
    rain: e => `Rain got out of the case: it soaks the floor, ${Text.tiles(e.size)} a side, for ${Text.count(e.turns, 'turn')}, and stops clockwork under it.`,
  };
  Text.defineCause('surface', 'weather', e => Object.prototype.hasOwnProperty.call(WEATHER, e.kind) && isInt(e.size) && isInt(e.turns) ? WEATHER[e.kind](e) : 'Weather got out of the case.');

  const RULES = {
    release: () => 'Weather got out of the case.',
    rain_stop: (e, w) => `${w.Name(e.who)} stopped in the rain${isInt(e.turns) ? ', for ' + Text.count(e.turns, 'turn') : ''}.`,
  };
  const known = e => Object.prototype.hasOwnProperty.call(RULES, e.rule) && (e.rule === 'release' || e.who !== undefined);
  Text.defineCause('module', 'weather_cases', (e, w) => known(e) ? RULES[e.rule](e, w) : 'The weather acted.');
})();
