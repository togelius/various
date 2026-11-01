// ACCESSION — the module weather_cases (M.11; BUILD.md §5.4): "Some cases hold weather. Break
// one, and the weather gets out." Its rules register here with Modules.define (rules/modules.js)
// in the form of §5.4. It has no archetype of its own; fog and rain are surfaces
// (rules/surfaces.js, Registry.SURFACES). Its entries are in js/core/reg/mod-weather.js and its
// sentences in js/core/text/mod-weather.js. Owned by MOD-WEATHER.
//
// The rules (§5.4; M4 plan MO1–MO3, D1.1–D1.3, A13; Q7, decided without play: `push` is cut,
// weather sits in ordinary cases, and opening or breaking one lets it out):
//   - Which cases hold weather (init, as the department is made, plan A10 step 12). Every
//     real case (a fixture of kind case that is no mimic's disguise), in dept.fixtures' order
//     (Cases.place's, row-major), takes two draws on the layout attempt's own stream,
//     …/a<k>/weather (§3.2, a local holder, never kept in the state): whether it holds weather
//     (WEATHER_SHARE_PCT in 100) and, if so, whether that is fog (WEATHER_FOG_PCT in 100) or
//     rain. The draws are made for every real case whether or not the module is on, so a run
//     with it switched off has the same rooms; switched off, no case is given weather. A case
//     in the Intro is given none (§5.1: an Intro teaches only its signature; the stamps hold no
//     case anyway, D-STAMPS); the Centrepiece hall's case is given rain whatever its draws
//     (M4 plan D3.9: M.11's hall has one rain case; §5.5, "rain jars"). A room not made by a
//     layout attempt (a room for tests, no base) draws nothing and is given nothing: a test
//     sets a case's weather itself. A case's weather is `case.weather`, 'fog' or 'rain',
//     absent from a case with none (plan A3), and it never changes during the visit: once let
//     out, the case is no longer shut, and nothing is said to be in it.
//   - The release. A case that holds weather lets it out when it is opened (rule
//     `release_opened`, on case_opened), or broken by a bash or dissolved by Solvent (rule
//     `release_broken`, on glass_broke): the rule's module event {at: the case's tile, cause by
//     whoever opened or broke it}, then the `surface` effect, its kind the case's weather,
//     WEATHER_SIZE tiles a side, centred on the case, for WEATHER_TURNS turns (Surfaces.add:
//     the surface event, cause weather {case}). A case is opened, broken or dissolved at most
//     once, so its weather gets out once.
//   - Fog blocks sight across its square while it lies (Registry.SURFACES.fog.blocksSight:
//     Grid.los, Grid.clear), so it blocks a beam, an axis and a line too (§8.1, §8.2).
//   - Rain (rule `rain_stop`, on surface: the rain just laid) stops every exhibit flagged with
//     the module (Modules.flagged, M.11's gallery station, M11.2; the D-STAMPS note: only a
//     flagged one, never the Intro's station) with a tile under it: the `status` effect puts
//     `fixed` on it (cause weather_cases {case}), so it only waits and a mark it shows is
//     called off at once (§8.1, Status.apply: a station's line, with "it was fixed in place";
//     a station held fixed neither wakes for its chime nor marks, rules/modules/
//     hourly_demonstration.js), until the boundary RAIN_STOP_TURNS turns after the rain's last
//     turn: while it stands in rain and for RAIN_STOP_TURNS turns after. A rain laid in turn T
//     for N turns lies through turn T + N and is cleared at the boundary of T + N + 1 (its
//     until, §8.1); so the stop's end is that until + RAIN_STOP_TURNS, and its turns, by
//     §8.1's timing rule (a status counts from its bearer's next decision: idiv(next, 100) for
//     one scheduled, the next turn for one asleep), are that end less that start. A rain is
//     laid only in an action (a release is yours: you open, break or dissolve), so the status
//     is settled when that action ends, from the start it was reckoned from. An exhibit flagged
//     with the module never steps (a station: neither a rule nor the Window Pole moves it), so
//     it stands in rain exactly while the rain lies; test/behaviour/weather_cases.test.js holds
//     every flagged species of the packs to that, and weather.inv.js holds the stop after every
//     step. A second rain over it adds its own stop, which lasts to the later end; one that
//     would end no later is not applied, and nothing is said.
//   - Rain is not a loud floor, blocks no sight and does nothing else.
// With the module off (rulesOff, or a visit without it) no case holds weather, so nothing is
// let out, and a test room's case given weather by hand lets nothing out.
//
// Its words (D1.3, M4 plan A11's "Rain on clockwork"; MOD-WEATHER's review, decided in play):
// a flagged species' line carries the module's part (§5.3), "Rain stops it.", a sentence of its
// own after the modifiers (the rule is this module's, not clockwork's, and holds with clockwork
// switched off); M11.2's line keeps the phone strip's 14 rows with it (its budget,
// test/m4-lines.test.js) since clockwork's clause says its rule in fewer words. How, and for
// how long, is told where the rain is: a shut case that holds weather says so on its label
// (Labels' case, WeatherCases.words): what it lets out, how large, for how long, and, for rain,
// which of the department's exhibits it stops, that each only waits and any mark it has made
// is called off, while it stands in rain and for RAIN_STOP_TURNS turns after; the stop is told
// in the log as it happens, with its reason, and the label of a station held shows the status
// and its turns (and says that a chime would make it mark nothing, Labels' plan line).
//
// Bespoke (plan A7, MO18; Modules.bespoke): nothing. Its three rules are the form's (the
// surface and status effects of its closed table): weather fits the form.
//
// WeatherCases, for the labels, the view model and the tests:
//   WeatherCases.of(state) → the module's state while it is on, or null
//   WeatherCases.held(state, f) → 'fog' | 'rain' | null   the weather the case f holds now: a
//                                         real case, shut, with weather, while the module is on
//   WeatherCases.stops(state) → [species]  the species of the visit's exhibits the rain stops
//                                         (flagged with the module, present), in spawn order
//   WeatherCases.words(state, f) → [sentence]  what a case's label says of the weather it holds
//                                         (none for a case that holds none)
'use strict';
const WeatherCases = (() => {
  const ID = 'weather_cases';
  const KINDS = ['fog', 'rain'];

  // The module's state while it is on, or null (absent from the visit, or switched off).
  const of = state => Modules.on(state, ID) ? Modules.of(state, ID) : null;
  const real = f => !!f && f.k === 'case' && !f.mimic;
  // The role of the room a case stands in (its key, f.room), or null.
  function roleOf(state, f) {
    const rooms = (state.dept && Array.isArray(state.dept.rooms)) ? state.dept.rooms : [];
    for (const r of rooms) if (r.key === f.room) return r.role || null;
    return null;
  }

  // init (§5.4's form; above): which cases hold weather, on the attempt's stream.
  function init(state, pack, m, base) {
    if (base === undefined) return;
    const rng = Rng.stream({ seed: state.seed, rng: {} }, `${base}/weather`);
    for (const f of (state.dept && state.dept.fixtures) || []) {
      if (!real(f)) continue;
      const holds = rng.int(1, 100) <= N.WEATHER_SHARE_PCT, fog = rng.int(1, 100) <= N.WEATHER_FOG_PCT;
      if (!m.on) continue;
      const role = roleOf(state, f);
      if (role === 'intro') continue;
      const w = role === 'centre' ? 'rain' : holds ? (fog ? 'fog' : 'rain') : null;
      if (w) f.weather = w;
    }
  }

  // The weather the case f holds now (above).
  const held = (state, f) => real(f) && f.st === 'shut' && KINDS.includes(f.weather) && !!of(state) ? f.weather : null;

  // The case a case_opened or glass_broke event is about, if it held weather: opened, broken
  // or dissolved by now, so no longer shut; a mimic's revealed case is none.
  function released(state, e) {
    const f = Cases.at(state, e.x, e.y);
    return real(f) && f.st !== 'shut' && KINDS.includes(f.weather) ? f : null;
  }
  // A release rule on one event kind: its module event at the case, then the case's weather.
  const release = (rule, on) => ({
    rule, on,
    when: (state, e) => !!released(state, e),
    fields: (state, e) => ({ at: [e.x, e.y] }),
    cause: (state, e) => typeof e.by === 'string' ? { by: e.by } : {},
    do: [{ k: 'surface', kind: (state, e) => released(state, e).weather, size: N.WEATHER_SIZE, turns: N.WEATHER_TURNS, at: (state, e) => [e.x, e.y],
      cause: (state, e) => ({ k: 'weather', case: [e.x, e.y] }) }],
  });

  // Does the square of surface (or surface event) s cover a tile of a?
  function under(s, a) {
    for (const [x, y] of Actors.footprint(a)) if (Grid.covers(s, x, y)) return true;
    return false;
  }
  // The exhibits the rain stops: flagged with the module, present, in spawn order.
  const flagged = state => state.actors.filter((a, i) => i > 0 && !a.gone && Modules.flagged(state, a, ID));
  // The turn a status put on a now starts (§8.1's timing rule, as Status.settle reckons it once
  // the action is over): the turn of its next decision, or the next turn for one asleep.
  const startOf = (state, a) => Actors.scheduled(a) ? Int.idiv(a.next, N.TICKS_PER_TURN) : state.turn + 1;
  // The rain just laid (its surface event e): it lies until state.turn + 1 + e.turns, so the
  // stop it gives ends RAIN_STOP_TURNS boundaries later.
  const endOf = (state, e) => state.turn + 1 + e.turns + N.RAIN_STOP_TURNS;
  const stopTurns = (state, e, a) => endOf(state, e) - startOf(state, a);
  // Is a already held fixed to that end or later (a settled status)? Then the rain adds nothing.
  function heldTo(a, end) {
    for (const s of a.statuses || []) if (s.id === 'fixed' && (s.perm === true || (Number.isInteger(s.until) && s.until >= end))) return true;
    return false;
  }
  const isRain = e => e.kind === 'rain' && !!e.cause && e.cause.k === 'weather';

  Modules.define(ID, {
    init,
    rules: [
      release('release_opened', 'case_opened'),
      release('release_broken', 'glass_broke'),
      { rule: 'rain_stop', on: 'surface',
        who: (state, e) => isRain(e) ? flagged(state).filter(a => under(e, a)) : [],
        when: (state, e, m, a) => stopTurns(state, e, a) >= 1 && !heldTo(a, endOf(state, e)),
        fields: (state, e, m, a) => ({ turns: stopTurns(state, e, a) }),
        do: [{ k: 'status', id: 'fixed', turns: (state, e, m, a) => stopTurns(state, e, a), cause: (state, e) => ({ k: ID, case: e.cause.case.slice() }) }] },
    ],
    bespoke: [],
  });

  // The species of the visit's exhibits the rain stops, once each, in spawn order.
  function stops(state) {
    const out = [];
    for (const a of flagged(state)) { const sp = Packs.speciesFor(state, a); if (sp && !out.includes(sp)) out.push(sp); }
    return out;
  }
  // What a case's label says of the weather it holds (Labels' case): what gets out, how large,
  // for how long and what it does; for rain, which exhibits it stops and for how long, each
  // kind once, in spawn order, named as the log names it (Labels.nameOf, the one helper every
  // sentence names an exhibit with: a name that starts "The" keeps one "the", M4
  // TABLEAU-PHASES' Repeater Arm, "the Board’s Repeater Arm").
  function words(state, f) {
    const w = held(state, f);
    if (!w) return [];
    const square = `${Text.tiles(N.WEATHER_SIZE)} a side`, turns = Text.count(N.WEATHER_TURNS, 'turn');
    if (w === 'fog') return [`It holds fog: opened, broken or dissolved, it lets it out, ${square}, for ${turns}, and the fog blocks sight.`];
    const out = [`It holds rain: opened, broken or dissolved, it lets it out, ${square}, for ${turns}.`];
    const name = Labels.nameOf(state), names = [];
    for (const a of flagged(state)) { const n = name(a.uid); if (n && !names.includes(n)) names.push(n); }
    if (names.length) {
      const one = names.length === 1;
      out.push(`While ${names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0]} ${one ? 'stands' : 'stand'} in rain, and for ${Text.count(N.RAIN_STOP_TURNS, 'turn')} after, ${one ? 'it only waits' : 'each only waits'}, and any mark ${one ? 'it has' : 'one has'} made is called off.`);
    }
    return out;
  }
  return { of, held, stops, words };
})();
