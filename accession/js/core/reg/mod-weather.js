// ACCESSION — registry fragment: the module weather_cases: weather cases, fog and rain (BUILD.md
// §5.1, §5.4, §8.1), owned by MOD-WEATHER. M4's skeleton made it; M4's Wave 0 (W0a) moved here,
// verbatim from reg/system.js, the module's panel sentence, and gave it its keywords, the
// surface's weather cause and its event's cause (M4 plan A5). MOD-WEATHER built the rest: the
// rules are in js/core/rules/modules/weather_cases.js; the scenarios that prove them in
// test/behaviour/weather_cases.test.js, and the invariants in test/behaviour/weather.inv.js.
'use strict';
(() => {
  const R = Registry;
  const proved = extra => Object.assign({ ready: true, tests: ['behaviour/weather_cases.test.js'], inv: 'weather' }, extra);

  // The module (§5.4), its panel sentence and the words that name its rule (the Intro lint).
  // Its part on the line of a species flagged with it (M.11's gallery station, M11.2): "Rain
  // stops it.", a sentence of its own after the modifiers (M4 plan A11's "Rain on clockwork",
  // D1.3: the rule is this module's, not clockwork's, and it holds with clockwork switched off).
  // MOD-WEATHER's review, decided in play: the line takes the phone strip's 14 rows with it
  // (test/m4-lines.test.js) once clockwork's clause says its rule in fewer words; A11's whole
  // "Stops while it stands in rain and for 2 turns after" would take 15. How, and for how long,
  // is told where the rain is: on the label of a case that holds it (WeatherCases.words: which
  // exhibits it stops, that each only waits and any mark it has made is called off, while it
  // stands in rain and for RAIN_STOP_TURNS turns after), in the log as it happens, and by the
  // status on the label of a station it holds. It covers no event of the line: a module event
  // naming a station (rain_stop) is covered by the chime's part, as a status is by none (§5.3,
  // completeness: a status is suffered, not caused).
  R.define('MODULES', 'weather_cases', proved({ built: 'M4', icon: null,
    sentence: 'Some cases hold weather. Break one, and the weather gets out.', keywords: ['weather', 'fog', 'rain'],
    clause: 'Rain stops it.', params: {}, covers: [] }));

  // Fog and rain (§8.1's surfaces; M4 plan A13): a square WEATHER_SIZE tiles a side, centred
  // on the case that held it, for WEATHER_TURNS turns. Fog blocks sight across it (so it stops
  // a beam, an axis and a line marked while it lies, §8.2; a mark already made keeps its tiles,
  // §4.1); rain blocks nothing, is not a loud floor, and stops each exhibit whose line says
  // "Rain stops it." (flagged with the module) while it stands in it and for RAIN_STOP_TURNS
  // turns after (rules/modules/weather_cases.js). Each clause is a sentence of its own, for the
  // label of a tile it covers.
  const surface = (blocksSight, icon, clause, params) => proved({ built: 'M4', blocksSight, icon, clause, params, covers: [], size: 'WEATHER_SIZE', turns: 'WEATHER_TURNS' });
  R.define('SURFACES', 'fog', surface(true, 'fog', 'Fog {WEATHER_SIZE} tiles a side blocks sight for {WEATHER_TURNS} turns.',
    { WEATHER_SIZE: 'N:WEATHER_SIZE', WEATHER_TURNS: 'N:WEATHER_TURNS' }));
  R.define('SURFACES', 'rain', surface(false, 'rain', 'Rain soaks the floor {WEATHER_SIZE} tiles a side for {WEATHER_TURNS} turns; an exhibit whose line says rain stops it only waits while it stands in it, and for {RAIN_STOP_TURNS} turns after.',
    { WEATHER_SIZE: 'N:WEATHER_SIZE', WEATHER_TURNS: 'N:WEATHER_TURNS', RAIN_STOP_TURNS: 'N:RAIN_STOP_TURNS' }));

  // Weather out of a case (§4.3's surface): its kind, fog or rain, from the case at `case`.
  R.defineCause('surface', 'weather', { fields: { case: 'tile' }, built: 'M4' });

  // Its module event (reg/system.js): rules `release_opened` (weather got out of a case you
  // opened) and `release_broken` (out of a case broken by a bash, or dissolved by Solvent),
  // each at the case's tile (`at`), its cause naming who opened or broke it (by); and
  // `rain_stop` (rain fell on an exhibit flagged with the module: who, for `turns`).
  R.defineCause('module', 'weather_cases', { fields: { by: 'uid?' }, built: 'M4' });
  // The stop: fixed (§8.1), put on by the rain out of the case at `case`.
  R.defineCause('status', 'weather_cases', { fields: { case: 'tile' }, built: 'M4' });
})();
