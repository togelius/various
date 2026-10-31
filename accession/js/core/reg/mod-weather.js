// ACCESSION — registry fragment: the module weather_cases: weather cases, fog and rain (BUILD.md
// §5.1, §5.4, §8.6), owned by MOD-WEATHER. M4's skeleton made it; M4's Wave 0 (W0a) moved here,
// verbatim from reg/system.js, the module's panel sentence, and gave it its keywords, the
// surface's weather cause and its event's cause (M4 plan A5). MOD-WEATHER fills the rest.
'use strict';
(() => {
  const R = Registry;

  // The module (§5.4), its panel sentence and the words that name its rule (the Intro lint).
  R.define('MODULES', 'weather_cases', { built: 'M4', sentence: 'Some cases hold weather. Break one, and the weather gets out.', keywords: ['weather', 'fog', 'rain'] });

  // Weather out of a case (§4.3's surface): its kind, fog or rain, from the case at `case`.
  R.defineCause('surface', 'weather', { fields: { case: 'tile' }, built: 'M4' });

  // Its module event (reg/system.js): rules `release` (weather got out of a case; at, the
  // case) and `rain_stop` (a clockwork exhibit under rain stops; who, for turns).
  R.defineCause('module', 'weather_cases', { fields: {}, built: 'M4' });
})();
