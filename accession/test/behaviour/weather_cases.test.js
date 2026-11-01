// ACCESSION — the module weather_cases (BUILD.md §5.4, §8.1; M4 plan MO1–MO3, D1.1–D1.3, A13,
// Q7; MOD-WEATHER): some cases hold weather, fog or rain, and opening, breaking or dissolving
// one lets it out, WEATHER_SIZE tiles a side, for WEATHER_TURNS turns; fog blocks sight; rain
// stops every exhibit flagged with the module that stands in it (M.11's gallery station), while
// it stands in rain and for RAIN_STOP_TURNS turns after, calling off its pending line. Joined
// up: the real core, real actions only, every invariant checked after every step (weather.inv.js
// among them), clone-checked where it says so. The scenarios of the module's part run for every
// species flagged with it (M11.2) at depths 1–7 and are rerun with the module switched off,
// when they must fail (§5.3 check 3). What the rules give is worked out here from §5.4 and
// §8.1 (the stream, the draws, the turns), not from the module's code. Also: fog against an
// axis and a beam; a station asleep and one awake; a second rain; the Intro's station, never
// flagged, never stopped; departments: which cases hold weather (the draws on the attempt's
// …/a<k>/weather, the hall's rain case, none in the Intro, none with the module off, the rooms
// the same either way), a case's label, the station's line (the decision, in review: its part
// is "Rain stops it.", a sentence of its own; m4-lines holds the line to 14 rows), the label of
// a station held fixed, the words and the form, and the numbers read.
'use strict';
const H = require('./_harness.js');
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { N, Roles, Text, Labels, Modules, Packs, Grid, Cases, Clauses, Rng, Dept, Status } = C;
  const json = x => JSON.stringify(x);
  const ID = 'weather_cases', R = N.RAIN_STOP_TURNS, WT = N.WEATHER_TURNS, WS = N.WEATHER_SIZE;
  const waits = n => Array.from({ length: n }, () => ({ a: 'wait' }));
  const ok = (results, name) => { const f = H.failures(results); assert.equal(f.length, 0, `${name}:\n${f.slice(0, 5).join('\n')}`); };
  const list = () => { const l = H.species(C, 'MODULES.weather_cases'); assert.ok(l.length >= 7 && l.every(x => x.sp.id === 'M11.2'), json(l.map(x => x.sp.id))); return l; };

  // A room of M.11 running its modules (Modules.init, as a department does, but with no layout
  // attempt, so no case is given weather by its draws: each case here is given its own, as
  // §5.4's init would), you hard to kill. stations: [{at, dir, sp?, mode?, pips?}];
  // cases: [{at, weather?, glass?, lock?}], each a `v` on the map; tote: consumables.
  function room(X, opts, o) {
    const depth = o.depth || 3;
    const stations = (o.stations || []).map(st => Object.assign({ sp: st.sp || 'M11.2', at: st.at, stats: X.Roles.stats('controller', depth) },
      st.pips !== undefined ? { pips: st.pips } : {}, st.mode ? { mode: st.mode } : {}));
    const map = o.map.map((row, y) => [...row].map((c, x) => (o.cases || []).some(k => k.at[0] === x && k.at[1] === y) ? 'v' : c).join(''));
    const fixtures = (o.cases || []).map(k => X.Cases.make({ x: k.at[0], y: k.at[1], room: k.room || 'sone', glass: k.glass || 1, lock: k.lock || 1, num: 'M.11.1.1' }));
    const s = H.room(X, opts.seed || 1, Object.assign({ acc: 'M11', depth, map, you: o.you, rooms: o.rooms || SECTION, exhibits: stations.concat(o.more || []), fixtures }),
      { rulesOff: opts.rulesOff || [] });
    s.actors[0].hp = s.actors[0].maxHp = 999;
    (o.stations || []).forEach((st, i) => { s.actors[1 + i].route = { dir: st.dir }; });
    X.Modules.init(s, X.Packs.get('M11'));
    (o.cases || []).forEach(k => { if (k.weather) X.Cases.at(s, k.at[0], k.at[1]).weather = k.weather; });
    if (o.tote) {
      X.Consumables.startRun(s);
      for (const ck of o.tote) {
        const it = X.Consumables.make(s, ck, { at: 'floor', x: s.actors[0].x, y: s.actors[0].y });
        it.where = { at: 'tote' }; it.n = 1; s.you.tote.push(it.uid);
        s.run.knownSeals.push(X.Consumables.sealFor(s, ck));
      }
    }
    return s;
  }
  const OPEN = ['################', '#..............#', '#..............#', '#..............#', '#..............#', '#..............#', '################'];
  const SECTION = [{ key: 'sone', role: 'section', x0: 1, y0: 1, x1: 14, y1: 5 }];
  const toteUid = (s, ck) => s.items.find(i => i.kind === 'consumable' && i.ck === ck && i.where.at === 'tote').uid;
  const weatherOut = events => events.filter(e => e.k === 'surface' && e.cause && e.cause.k === 'weather');
  const rules = (events, rule) => events.filter(e => e.k === 'module' && e.id === ID && (rule === undefined || e.rule === rule));
  // When the rain laid in turn t lets an exhibit under it go (§8.1, §5.4): it lies through turn
  // t + WEATHER_TURNS and is cleared at the boundary after, so the stop ends RAIN_STOP_TURNS
  // boundaries after that.
  const freeAt = t => t + 1 + WT + R;

  // ---- Each release: opened, broken by a bash, dissolved by Solvent ----
  const release = H.scenario({
    name: 'a case that holds weather lets it out, once, when opened, broken by a bash or dissolved by Solvent: WEATHER_SIZE tiles a side, centred on it, for WEATHER_TURNS turns; a case that holds none lets nothing out',
    id: 'MODULES.weather_cases', clone: true,
    // You at (7, 3): a fog case west (opened), a rain case east (bashed), an empty case north
    // (opened), and a rain case at (11, 4) dissolved by a thrown Solvent.
    build: (params, sp, depth, opts) => room(C, opts, { depth, map: OPEN, you: [7, 3], tote: ['solvent'],
      cases: [{ at: [6, 3], weather: 'fog' }, { at: [8, 3], weather: 'rain' }, { at: [7, 2] }, { at: [11, 4], weather: 'rain' }] }),
    actions: (s, i) => i === 0 ? { a: 'open', x: 7, y: 2 } : i === 1 ? { a: 'open', x: 6, y: 3 } : i === 2 ? { a: 'bash', x: 8, y: 3 }
      : i === 3 ? { a: 'throw', uid: toteUid(s, 'solvent'), x: 11, y: 4 } : i < 4 + WT + 4 ? { a: 'wait' } : null,
    expect(r) {
      const out = weatherOut(r.events);
      const want = [[6, 3, 'fog', 1], [8, 3, 'rain', 2], [11, 4, 'rain', 3]];
      if (json(out.map(e => [e.x, e.y, e.kind, e.turn, e.size, e.turns, e.cause.case])) !== json(want.map(([x, y, k], i) => [x, y, k, r.steps[i + 1].events[0].turn, WS, WT, [x, y]])))
        return `the weather let out: ${json(out.map(e => [e.x, e.y, e.kind, e.turn, e.size, e.turns]))}`;
      // Each told by its rule's module event at the case, cause by you, just before it.
      const rel = rules(r.events).filter(e => e.rule !== 'rain_stop');
      if (json(rel.map(e => [e.rule, e.at, e.cause.by])) !== json([['release_opened', [6, 3], 'you'], ['release_broken', [8, 3], 'you'], ['release_broken', [11, 4], 'you']]))
        return `the releases told: ${json(rel.map(e => [e.rule, e.at, e.cause]))}`;
      for (const e of rel) if (r.events[r.events.indexOf(e) + 1] !== out[rel.indexOf(e)]) return `the ${e.rule} at ${e.at} is not followed by its weather`;
      // The empty case let nothing out; no weather got out twice.
      if (r.steps[0].events.some(e => e.k === 'surface')) return 'the empty case let something out';
      // Each lies for WEATHER_TURNS turns, then is cleared: by the end, all are gone.
      if ((r.state.dept.surfaces || []).some(s => s.kind === 'fog' || s.kind === 'rain')) return `weather still lies: ${json(r.state.dept.surfaces)}`;
      // The log tells each once, by what got out (never "Weather got out…" as well).
      const log = Text.log(r.steps[1].events, Labels.nameOf(r.state));
      if (!log.includes(`Fog got out of the case: it blocks sight, ${Text.tiles(WS)} a side, for ${Text.count(WT, 'turn')}.`) || log.some(l => /^Weather got out/.test(l))) return `the log at the open: ${json(log)}`;
      const log2 = Text.log(r.steps[2].events, Labels.nameOf(r.state));
      if (!log2.includes(`Rain got out of the case: it soaks the floor, ${Text.tiles(WS)} a side, for ${Text.count(WT, 'turn')}.`)) return `the log at the bash: ${json(log2)}`;
      return null;
    },
  });
  test('each release: a case opened, broken by a bash or dissolved by Solvent lets its weather out, once, the size and the turns of record; at depths 1–7, clone-checked, failing with the module off', () => {
    ok(H.sweep(C, release, list()), release.name);
  });

  test('fog blocks sight across its square while it lies, both ways; rain blocks none; each is cleared at the boundary after its last turn', () => {
    for (const depth of [1, 4, 7]) {
      // A station under the fog's square, which fog does not stop.
      const s = room(C, {}, { depth, map: OPEN, you: [7, 3], stations: [{ at: [5, 4], dir: 'W' }], cases: [{ at: [6, 3], weather: 'fog' }, { at: [8, 3], weather: 'rain' }] });
      const seen = () => [Grid.los(s.dept, 3, 3, 7, 1), Grid.los(s.dept, 7, 1, 3, 3), Grid.los(s.dept, 11, 3, 7, 1), Grid.los(s.dept, 7, 1, 11, 3)];
      assert.equal(json(seen()), json([true, true, true, true]));
      const r = H.play(C, s, [{ a: 'open', x: 6, y: 3 }, { a: 'bash', x: 8, y: 3 }], { inv: 'all' });
      assert.deepEqual(r.violations, []);
      // The fog's square (5–7, 2–4) lies between (3, 3) and (7, 1); the rain's does not block.
      assert.equal(json(seen()), json([false, false, true, true]), `depth ${depth}`);
      assert.ok(!Status.has(s.actors[1], 'fixed') && !rules(r.events, 'rain_stop').length, 'fog stopped the station');
      const t0 = r.steps[0].events[0].turn;
      for (let k = 0; k < 20; k++) {
        const fog = (s.dept.surfaces || []).some(q => q.kind === 'fog');
        assert.equal(fog, s.turn < t0 + 1 + WT, `fog at turn ${s.turn}`);
        assert.equal(seen()[0], !fog);
        H.play(C, s, waits(1), { inv: 'all' });
      }
    }
  });

  // ---- Rain stops the station, and calls off its line ----
  // The station at (2, 1), its line east along row 1; a rain case at (3, 2), whose square
  // (2–4, 1–3) covers it; you at (4, 3), beside the case and off the line. At the chime (the
  // count 10 of its period 12) it marks its line, due at 12; you break the case then.
  const stop = H.scenario({
    name: 'rain stops it while it stands in rain and for 2 turns after: its pending line is called off at once, it neither wakes for the chime nor marks while held, and marks again after',
    id: 'MODULES.weather_cases', clone: true,
    build: (params, sp, depth, opts) => room(C, opts, { depth, map: OPEN, you: [4, 3], stations: [{ at: [2, 1], dir: 'E', pips: 1 }], cases: [{ at: [3, 2], weather: 'rain' }] }),
    actions: (s, i, c) => {
      if (s.turn >= 37) return null;
      const marked = s.actors[1].telegraph && s.turn === N.DEMO_PERIOD - N.DEMO_WARNING;
      return marked && Cases.at(s, 3, 2).st === 'shut' ? { a: 'bash', x: 3, y: 2 } : { a: 'wait' };
    },
    cap: 60,
    expect(r) {
      const st = r.start.actors[1].uid, p = N.DEMO_PERIOD, chime1 = p - N.DEMO_WARNING;
      const bash = r.steps.findIndex(x => x.action.a === 'bash');
      if (bash < 0) return 'the station never marked its line, so the case was never broken';
      const t = r.steps[bash].events[0].turn, ev = r.steps[bash].events;
      if (t !== chime1) return `the case was broken on turn ${t}, not at the chime, ${chime1}`;
      // Rain, then the stop on the station, then its line called off, all in the action.
      const rain = ev.findIndex(e => e.k === 'surface' && e.kind === 'rain'), on = ev.findIndex(e => e.k === 'status' && e.who === st && e.id === 'fixed' && e.on && e.cause.k === ID);
      const off = ev.findIndex(e => e.k === 'special' && e.who === st && e.cancelled && e.cause.why === 'fixed');
      if (!(rain >= 0 && on > rain && off > on)) return `in the bash's step: rain ${rain}, the stop ${on}, the line called off ${off}`;
      const said = rules(ev, 'rain_stop');
      if (said.length !== 1 || said[0].who !== st || said[0].turns !== ev[on].turns) return `the stop told: ${json(said)}`;
      // Held exactly while in rain and RAIN_STOP_TURNS after: its fixed ends at the boundary
      // freeAt(t), and it was held there until then, whatever it was doing.
      const ended = r.events.find(e => e.k === 'status' && e.who === st && e.id === 'fixed' && !e.on);
      if (!ended || ended.turn !== freeAt(t)) return `its stop ended ${ended ? 'on turn ' + ended.turn : 'never'}, not on turn ${freeAt(t)}`;
      // Its line never went off; no mark, no waking for the chime while held; marked again at
      // the first chime after, which went off on its multiple.
      const lines = r.events.filter(e => e.k === 'special' && e.who === st && !e.cancelled).map(e => e.turn);
      const marks = r.events.filter(e => e.k === 'telegraphed' && e.who === st).map(e => e.turn);
      const free = [];
      for (let c = chime1; c <= 36; c += p) free.push(c);
      const want = free.filter(c => c === chime1 || c >= freeAt(t));
      if (json(marks) !== json(want)) return `it marked its line on turns ${json(marks)}, not ${json(want)}`;
      if (json(lines) !== json(want.slice(1).map(c => c + N.DEMO_WARNING))) return `its line went off on turns ${json(lines)}`;
      if (r.events.some(e => e.k === 'woke' && e.who === st && e.cause.k === 'period' && e.turn > t && e.turn < freeAt(t))) return 'it woke for a chime while held';
      // The log, while you see it: fixed, for how long and why; its line called off, truly.
      const log = Text.log(ev, Labels.nameOf(r.state));
      const name = 'The Semaphore Station, Two-Armed';
      if (!log.includes(`${name} is now fixed in place for ${Text.count(ev[on].turns, 'turn')}: rain stops it while it stands in it, and for ${Text.count(R, 'turn')} after.`)) return `the log: ${json(log)}`;
      if (!log.some(l => /line was called off: it was fixed in place\.$/.test(l)) || log.some(l => /stopped in the rain/.test(l))) return `the log: ${json(log)}`;
      return null;
    },
  });
  test('rain cancelling a pending line: rain stops the station while it stands in rain and for 2 turns after, its line called off with a true reason; at depths 1–7, clone-checked, failing with the module off', () => {
    ok(H.sweep(C, stop, list()), stop.name);
  });

  test('the stop is counted from the station\'s next decision (§8.1), asleep or awake, to the boundary 2 turns after the rain\'s last turn; a second rain lasts to the later end, one ending no later adds nothing', () => {
    for (const depth of [1, 4, 7]) for (const mode of ['dormant', 'awake']) {
      // The station at (2, 1); two rain cases, (3, 2) and (2, 2), each covering it; you at
      // (3, 3), beside both (the second past no corner once the first is broken). No chime
      // falls before turn 10.
      const s = room(C, {}, { depth, map: OPEN, you: [3, 3], stations: [{ at: [2, 1], dir: 'E', mode }], cases: [{ at: [3, 2], weather: 'rain' }, { at: [2, 2], weather: 'rain' }] });
      const st = s.actors[1];
      let r = H.play(C, s, [{ a: 'wait' }, { a: 'bash', x: 3, y: 2 }], { inv: 'all', clone: true });
      assert.deepEqual(r.violations, [], `${mode} at depth ${depth}`);
      const t = r.steps[1].events[0].turn, f1 = st.statuses.find(q => q.id === 'fixed');
      assert.equal(f1.until, freeAt(t), `${mode}: held to ${f1.until}`);
      const on = r.steps[1].events.find(e => e.k === 'status' && e.who === st.uid && e.on);
      assert.equal(on.turns, f1.until - f1.from, 'its event says the turns it holds');
      // Three waits, then the second rain: it lasts to its own later end.
      r = H.play(C, s, waits(3).concat([{ a: 'bash', x: 2, y: 2 }]), { inv: 'all' });
      assert.deepEqual(r.violations, []);
      const t2 = r.steps[3].events[0].turn;
      assert.equal(st.statuses.find(q => q.id === 'fixed').until, freeAt(t2));
      // A third rain that ends no later (laid by hand with the case's cause, as a release lays
      // it) adds nothing and says nothing.
      const ev = [];
      C.Surfaces.add(s, 'rain', 2, 2, WS, 1, null, ev, { k: 'weather', case: [2, 2] });
      assert.equal(json(ev.map(e => e.k)), json(['surface']), json(ev));
      assert.equal(st.statuses.find(q => q.id === 'fixed').until, freeAt(t2));
      // Held until the rain has gone and RAIN_STOP_TURNS more, then free.
      r = H.play(C, s, waits(freeAt(t2) - 1 - s.turn), { inv: 'all' });
      assert.deepEqual(r.violations, []);
      assert.ok(Status.has(st, 'fixed') && !(s.dept.surfaces || []).some(q => q.kind === 'rain' && q.x === 2 && q.y === 2 && q.until > s.turn + 1), `${mode}: free at turn ${s.turn}`);
      H.play(C, s, waits(1), { inv: 'all' });
      assert.ok(!Status.has(st, 'fixed'), `${mode}: still fixed at turn ${s.turn}`);
    }
  });

  test('rain stops only an exhibit flagged with the module: the Intro\'s station (M11.12, flagged with the chime alone) and the Logbook Trolley are not stopped, nor you', () => {
    for (const depth of [1, 7]) {
      const s = room(C, {}, { depth, map: OPEN, you: [3, 3], stations: [{ at: [2, 1], dir: 'E', sp: 'M11.12' }],
        more: [{ sp: 'M11.5', at: [4, 1], mode: 'dormant', stats: Roles.stats('fodder', depth) }], cases: [{ at: [3, 2], weather: 'rain' }] });
      const r = H.play(C, s, [{ a: 'bash', x: 3, y: 2 }], { inv: 'all' });
      assert.deepEqual(r.violations, []);
      assert.equal(weatherOut(r.events).length, 1);
      assert.ok(!r.events.some(e => e.k === 'status' && e.id === 'fixed'), json(r.events.filter(e => e.k === 'status')));
      assert.equal(rules(r.events, 'rain_stop').length, 0);
    }
    // And the rule's words for the Intro's station: none of the module's, at any depth.
    const sp = Packs.species('M11', 'M11.12');
    for (const depth of H.DEPTHS) for (const kw of C.Registry.MODULES[ID].keywords) assert.ok(!Clauses.line(sp, { depth }).toLowerCase().includes(kw), `${kw} at depth ${depth}`);
  });

  test('every species flagged with the module never steps (a station), so it stands in rain exactly while the rain lies', () => {
    // A Centrepiece's attachments are species too (M4 TABLEAU-PHASES: the Great Board's Repeater
    // Arm, a station flagged with the module).
    const flagged = Packs.list().flatMap(p => p.species.concat(p.centrepiece && Array.isArray(p.centrepiece.attachments) ? p.centrepiece.attachments : []))
      .filter(sp => Array.isArray(sp.flags) && sp.flags.includes(ID));
    assert.ok(flagged.length >= 2 && flagged.some(sp => sp.id === 'M11.11a'), JSON.stringify(flagged.map(sp => sp.id)));
    for (const sp of flagged) assert.equal(sp.archetype, 'demonstrator', `${sp.id} is flagged with ${ID} but is a ${sp.archetype}, which may step into or out of rain`);
  });

  // ---- Fog against an axis and a beam ----
  test('fog against an axis: no axis pip while fog lies between a Heliograph and you, and its beam is not marked through it; both come back once it is cleared', () => {
    for (const depth of [1, 4, 7]) {
      // A Heliograph asleep at (2, 3), you on its row at (7, 3), beside a fog case at (6, 2),
      // whose square (5–7, 1–3) lies on the row between you.
      const s = room(C, {}, { depth, map: OPEN, you: [7, 3], more: [{ sp: 'M11.1', at: [2, 3], mode: 'dormant', stats: Roles.stats('artillery', depth) }],
        cases: [{ at: [6, 2], weather: 'fog' }] });
      const h = s.actors[1];
      const pips = r => r.events.filter(e => e.k === 'pip' && e.who === h.uid && e.cause.k === 'axis').map(e => e.turn);
      let r = H.play(C, s, [{ a: 'open', x: 6, y: 2 }].concat(waits(4)), { inv: 'all' });
      assert.deepEqual(r.violations, []);
      assert.equal(json(pips(r)), '[]', `depth ${depth}: axis pips through the fog`);
      assert.equal(h.mode, 'dormant');
      // Out of the fog's time: the axis is open again, and it stirs.
      r = H.play(C, s, waits(WT), { inv: 'all' });
      assert.deepEqual(r.violations, []);
      assert.ok(pips(r).length >= 1 && Math.min(...pips(r)) > r.steps[0].events[0].turn, `depth ${depth}: ${json(pips(r))}`);
      // Its beam: hunting you, it marks its line along the row at its first action, unless the
      // fog lies across it (the module off, the case lets nothing out, and it marks).
      for (const rulesOff of [[], [ID]]) {
        const b = room(C, { rulesOff }, { depth, map: OPEN, you: [7, 3], more: [{ sp: 'M11.1', at: [2, 3], mode: 'hunting', stats: Roles.stats('artillery', depth) }],
          cases: [{ at: [6, 2], weather: 'fog' }] });
        r = H.play(C, b, [{ a: 'open', x: 6, y: 2 }], { inv: 'all' });
        assert.deepEqual(r.violations, []);
        const beam = r.events.filter(e => e.k === 'telegraphed' && e.who === b.actors[1].uid);
        assert.equal(beam.length, rulesOff.length ? 1 : 0, `depth ${depth}${rulesOff.length ? ', no fog' : ''}: ${json(beam)}`);
      }
    }
  });

  // ---- Departments ----
  // The weather the draws give a department's cases (§3.2, §5.4), worked out here: two draws a
  // real case on the attempt's …/a<k>/weather, in the fixtures' order; none in the Intro, rain
  // in the hall whatever the draws; none at all with the module off.
  function expected(s, base, on) {
    const rng = Rng.stream({ seed: s.seed, rng: {} }, base + '/weather'), out = [];
    for (const f of s.dept.fixtures) {
      if (f.k !== 'case' || f.mimic) continue;
      const holds = rng.int(1, 100) <= N.WEATHER_SHARE_PCT, fog = rng.int(1, 100) <= N.WEATHER_FOG_PCT;
      const role = (s.dept.rooms.find(q => q.key === f.room) || {}).role;
      out.push([f.x, f.y, !on || role === 'intro' ? null : role === 'centre' ? 'rain' : holds ? (fog ? 'fog' : 'rain') : null]);
    }
    return out;
  }
  const weathers = s => s.dept.fixtures.filter(f => f.k === 'case' && !f.mimic).map(f => [f.x, f.y, f.weather || null]);
  const strip = s => { const c = JSON.parse(json(s)); for (const f of c.dept.fixtures) delete f.weather; c.dept.modules.forEach(m => { m.on = null; }); c.options = null; return json(c); };

  test('departments: each case\'s weather is the draws\' on the layout attempt\'s …/a<k>/weather; the hall\'s case holds rain; none in the Intro; with the module off the same draws leave the cases empty, and the rooms are the same', () => {
    let cases = 0, held = 0, fog = 0, hall = 0;
    for (let seed = 1; seed <= 14; seed++) {
      const depth = 1 + (seed - 1) % 7, g = Dept.generate(seed, 'M11', depth, {}), gOff = Dept.generate(seed, 'M11', depth, { rulesOff: [ID] });
      assert.equal(g.base, gOff.base, 'the same attempt either way');
      assert.equal(json(weathers(g.state)), json(expected(g.state, g.base, true)), `seed ${seed}`);
      assert.equal(json(weathers(gOff.state)), json(expected(gOff.state, gOff.base, false)), `seed ${seed}, module off`);
      assert.equal(strip(g.state), strip(gOff.state), `seed ${seed}: the rooms differ beyond the cases' weather`);
      // The stream is the attempt's, a local holder: never kept in the state.
      assert.ok(!Object.keys(g.state.rng).some(k => k.includes('weather')), json(Object.keys(g.state.rng)));
      for (const [x, y, w] of weathers(g.state)) {
        const f = Cases.at(g.state, x, y), role = g.state.dept.rooms.find(q => q.key === f.room).role;
        if (role === 'centre') { hall++; assert.equal(w, 'rain', `seed ${seed}: the hall's case holds ${w}`); continue; }
        cases++; if (w) held++; if (w === 'fog') fog++;
      }
    }
    assert.ok(hall >= 12, `${hall} hall cases`);
    // About WEATHER_SHARE_PCT of the other cases, about WEATHER_FOG_PCT of those fog.
    assert.ok(held * 100 >= cases * (N.WEATHER_SHARE_PCT - 10) && held * 100 <= cases * (N.WEATHER_SHARE_PCT + 10), `${held} of ${cases}`);
    assert.ok(fog * 100 >= held * (N.WEATHER_FOG_PCT - 25) && fog * 100 <= held * (N.WEATHER_FOG_PCT + 25), `${fog} fog of ${held}`);
    // S.9 and A.4 run no weather: none of their cases holds any.
    for (const acc of ['S9', 'A4']) for (const seed of [1, 2, 3]) assert.ok(!Dept.create(seed, acc, 3, {}).dept.fixtures.some(f => f.weather !== undefined), acc);
  });

  test('two draws a real case on the accepted attempt\'s …/a<k>/weather, the module on or off (counted on the stream itself), and none on any other path of its', () => {
    const X = loadCore(), orig = X.Rng.stream, drawn = new Map();
    // Count every draw made on a weather stream, by its path.
    X.Rng.stream = (holder, p) => {
      const r = orig(holder, p);
      if (!/\/weather$/.test(p)) return r;
      const w = Object.create(r);
      w.int = (a, b) => { drawn.set(p, (drawn.get(p) || 0) + 1); return r.int(a, b); };
      return w;
    };
    for (let seed = 1; seed <= 14; seed++) for (const rulesOff of [[], [ID]]) {
      drawn.clear();
      const depth = 1 + (seed - 1) % 7, g = X.Dept.generate(seed, 'M11', depth, { rulesOff });
      const real = g.state.dept.fixtures.filter(f => f.k === 'case' && !f.mimic).length;
      assert.ok(real > 0);
      assert.equal(drawn.get(`${g.base}/weather`), 2 * real, `seed ${seed}${rulesOff.length ? ', module off' : ''}: ${json([...drawn])}`);
      // Any other weather stream drawn on is an earlier attempt's, which the validators turned down.
      for (const p of drawn.keys()) assert.ok(p === `${g.base}/weather` || /\/a\d+\/weather$/.test(p), p);
    }
  });

  test('a room not made by a layout attempt draws nothing and is given no weather; given an attempt\'s key, every real case is drawn for, the Intro\'s given none, the hall\'s rain, a mimic\'s disguise neither', () => {
    const s = room(C, {}, { depth: 3, map: OPEN, you: [7, 3], cases: [{ at: [6, 3] }, { at: [8, 3] }] });
    assert.ok(!s.dept.fixtures.some(f => f.weather !== undefined));
    // Modules.init with a key that is no path is refused.
    for (const bad of [null, '', 7]) assert.throws(() => Modules.init(H.room(C, 1, { acc: 'M11', depth: 3, map: OPEN, you: [7, 3] }, {}), Packs.get('M11'), bad), /stream key/);
    // Rooms like a department's, an Intro, a section and the hall, each with cases, given a
    // layout attempt's key: the draws are made for every case, in the fixtures' order; the
    // Intro's cases are given none, the hall's rain, the section's what its draws give; the
    // mimic's disguise (a case with no number, made by its own rule) takes no draw.
    const MAP = ['######################', '#......,......,......#', '#......#......#......#', '#......#......#......#', '######################'];
    const ROOMS = [{ key: 'intro', role: 'intro', x0: 1, y0: 1, x1: 6, y1: 3 }, { key: 'sone', role: 'section', x0: 8, y0: 1, x1: 13, y1: 3 }, { key: 'centre', role: 'centre', x0: 15, y0: 1, x1: 20, y1: 3 }];
    const at = [[2, 2], [4, 3], [9, 2], [10, 3], [11, 2], [12, 3], [13, 2], [16, 3], [18, 2]];
    const roomOf = ([x]) => x <= 6 ? 'intro' : x <= 13 ? 'sone' : 'centre';
    let draws = 0;
    for (let seed = 1; seed <= 40; seed++) for (const rulesOff of [[], [ID]]) {
      const map = MAP.map((row, y) => [...row].map((c, x) => at.some(t => t[0] === x && t[1] === y) ? 'v' : c).join(''));
      const fixtures = at.map(t => Cases.make({ x: t[0], y: t[1], room: roomOf(t), num: 'M.11.1.1' }))
        .concat([Cases.make({ x: 19, y: 3, room: 'centre', num: null, mimic: 'M11.3.centre.9' })]);
      const t = H.room(C, seed, { acc: 'M11', depth: 3, map: map.map((row, y) => y === 3 ? row.slice(0, 19) + 'v' + row.slice(20) : row), you: [1, 1], rooms: ROOMS, fixtures }, { rulesOff });
      const base = `layout/M11@test/d3/a${seed % 5}`;
      Modules.init(t, Packs.get('M11'), base);
      const got = weathers(t), want = expected(t, base, !rulesOff.length);
      assert.equal(json(got), json(want), `seed ${seed}${rulesOff.length ? ', module off' : ''}`);
      assert.ok(got.every(([x, y, w]) => roomOf([x]) !== 'intro' || w === null));
      assert.ok(got.every(([x, y, w]) => roomOf([x]) !== 'centre' || w === (rulesOff.length ? null : 'rain')));
      assert.equal(Cases.at(t, 19, 3).weather, undefined, 'the mimic\'s disguise holds none');
      if (!rulesOff.length) draws += got.filter(([x, y, w]) => roomOf([x]) === 'sone' && w).length;
    }
    assert.ok(draws > 0, 'some section case was given weather');
  });

  test('a case\'s label: what it holds and what that does, before it is opened, and nothing once it is; which exhibits rain stops, by name; nothing with the module off', () => {
    for (const rulesOff of [[], [ID]]) {
      const s = room(C, { rulesOff }, { depth: 3, map: OPEN, you: [7, 3], stations: [{ at: [2, 1], dir: 'E' }], cases: [{ at: [6, 3], weather: 'fog' }, { at: [8, 3], weather: 'rain' }, { at: [7, 2] }] });
      const fog = Labels.of(s, 'case:6,3'), rain = Labels.of(s, 'case:8,3'), none = Labels.of(s, 'case:7,2');
      if (rulesOff.length) {
        for (const l of [fog, rain]) { assert.equal(l.title, 'An empty case'); assert.ok(!l.odds.some(x => /fog|rain/.test(x)), json(l.odds)); }
        continue;
      }
      assert.equal(fog.title, 'A case of fog');
      assert.equal(fog.odds[0], `It holds fog: opened, broken or dissolved, it lets it out, ${Text.tiles(WS)} a side, for ${Text.count(WT, 'turn')}, and the fog blocks sight.`);
      assert.equal(rain.title, 'A case of rain');
      assert.equal(json(rain.odds.slice(0, 2)), json([`It holds rain: opened, broken or dissolved, it lets it out, ${Text.tiles(WS)} a side, for ${Text.count(WT, 'turn')}.`,
        `While the Semaphore Station, Two-Armed stands in rain, and for ${Text.count(R, 'turn')} after, it only waits, and any mark it has made is called off.`]));
      assert.equal(none.title, 'An empty case');
      // The strip beside it says so too.
      assert.ok(Labels.strip(s).behaviour.includes('It holds fog'), json(Labels.strip(s)));
      H.play(C, s, [{ a: 'open', x: 6, y: 3 }], { inv: 'all' });
      const after = Labels.of(s, 'case:6,3');
      assert.equal(after.title, 'An open case');
      assert.ok(!after.odds.some(x => /holds fog/.test(x)));
    }
  });

  test('the station\'s line (the decision, in review): "Rain stops it.", a sentence of its own after clockwork\'s, on M11.2\'s line while the module is on (with clockwork switched off too, since rain stops it then as well); gone with the module off or from a visit without it; never on the Intro\'s station', () => {
    const sp = Packs.species('M11', 'M11.2'), intro = Packs.species('M11', 'M11.12');
    for (const depth of H.DEPTHS) {
      const parts = Clauses.of(sp, { depth });
      const w = parts.find(p => p.kind === 'module' && p.id === ID);
      assert.ok(w && w.text === 'Rain stops it.' && w.within === null, json(w));
      const on = Clauses.line(sp, { depth });
      assert.ok(on.includes('; cannot be dazed. Rain stops it. Wakes when'), on);
      for (const off of [{ rulesOff: [ID] }, { modules: ['hourly_demonstration'] }]) {
        const line = Clauses.line(sp, Object.assign({ depth }, off));
        assert.ok(!/rain/i.test(line) && line === on.replace(' Rain stops it.', ''), line);
      }
      const noClock = Clauses.line(sp, { depth, rulesOff: ['clockwork'] });
      assert.ok(noClock.includes('has no blow. Rain stops it. Wakes when') && !/\s\s/.test(noClock), noClock);
      assert.ok(!/rain/i.test(Clauses.line(intro, { depth })), 'the Intro\'s station');
    }
    // What it says holds with clockwork switched off: rain stops the station all the same.
    for (const rulesOff of [[], ['clockwork']]) {
      const s = room(C, { rulesOff }, { depth: 3, map: OPEN, you: [3, 3], stations: [{ at: [2, 1], dir: 'E' }], cases: [{ at: [3, 2], weather: 'rain' }] });
      const r = H.play(C, s, [{ a: 'bash', x: 3, y: 2 }], { inv: 'all' });
      assert.deepEqual(r.violations, []);
      assert.ok(Status.has(s.actors[1], 'fixed') && rules(r.events, 'rain_stop').length === 1, json(rulesOff));
    }
  });

  test('the label of a station held fixed says a chime would make it mark nothing, not its line, and its line again once it is free (rain, and Fixative alike)', () => {
    for (const depth of [1, 4, 7]) {
      const s = room(C, {}, { depth, map: OPEN, you: [3, 3], stations: [{ at: [2, 1], dir: 'E' }], cases: [{ at: [3, 2], weather: 'rain' }] });
      const st = s.actors[1], plan = () => Labels.of(s, st.uid).odds.filter(l => /^If the chime sounded now/.test(l));
      const LINE = /^If the chime sounded now, it would mark its line: \d+ tiles to the east\.$/, HELD = 'If the chime sounded now, it would mark nothing: it is fixed in place.';
      assert.ok(plan().length === 1 && LINE.test(plan()[0]), json(plan()));
      const r = H.play(C, s, [{ a: 'bash', x: 3, y: 2 }], { inv: 'all' });
      assert.deepEqual(r.violations, []);
      assert.equal(json(plan()), json([HELD]), `depth ${depth}`);
      // And so it does: held through a chime, it marks nothing.
      const t = r.steps[0].events[0].turn;
      const held = H.play(C, s, waits(freeAt(t) - 1 - s.turn), { inv: 'all' });
      assert.deepEqual(held.violations, []);
      assert.ok(held.events.some(e => e.k === 'module' && e.id === 'hourly_demonstration' && e.rule === 'chime'), 'a chime came while it was held');
      assert.ok(!held.events.some(e => e.k === 'telegraphed' && e.who === st.uid), 'it marked while held');
      assert.equal(json(plan()), json([HELD]));
      H.play(C, s, waits(1), { inv: 'all' });
      assert.ok(!Status.has(st, 'fixed') && LINE.test(plan()[0]), json(plan()));
      // Fixative's fixed says the same.
      C.Status.apply(s, st, 'fixed', 3, { k: 'planted' }, []);
      assert.equal(json(plan()), json([HELD]));
    }
  });

  test('the words: every sentence of the module is plain and names who it is about; a stop with no exhibit has none; and the form: three rules of the closed table, nothing bespoke', () => {
    const names = uid => uid === 'x.1' ? 'the Semaphore Station, Two-Armed' : null;
    const clean = s => typeof s === 'string' && /^[A-Z].*\.$/.test(s) && !/undefined|NaN|\[object|\bnull\b|_/.test(s);
    for (const kind of ['fog', 'rain']) assert.ok(clean(Text.event({ k: 'surface', turn: 1, kind, x: 1, y: 1, size: WS, turns: WT, cause: { k: 'weather', case: [1, 1] } }, names)));
    for (const rule of ['release_opened', 'release_broken']) assert.ok(clean(Text.event({ k: 'module', turn: 1, id: ID, rule, at: [1, 1], cause: { k: ID, by: 'you' } }, names)));
    assert.equal(Text.event({ k: 'module', turn: 1, id: ID, rule: 'rain_stop', turns: 12, who: 'x.1', cause: { k: ID } }, names), 'The Semaphore Station, Two-Armed stopped in the rain, for 12 turns.');
    assert.equal(Text.event({ k: 'module', turn: 1, id: ID, rule: 'rain_stop', turns: 12, cause: { k: ID } }, names), null);
    for (const turns of [1, 12]) assert.ok(clean(Text.event({ k: 'status', turn: 1, who: 'x.1', id: 'fixed', on: true, turns, cause: { k: ID, case: [1, 1] } }, names)));
    const f = Modules.form(ID);
    assert.equal(json(f.rules.map(r => [r.rule, r.on, r.do])), json([['release_opened', 'case_opened', ['surface']], ['release_broken', 'glass_broke', ['surface']], ['rain_stop', 'surface', ['status']]]));
    assert.equal(json(f.bespoke), '[]');
    assert.ok(!Modules.bespoke().some(b => b.id === ID));
    assert.equal(C.Registry.SURFACES.fog.blocksSight, true);
    assert.equal(C.Registry.SURFACES.rain.blocksSight, false);
    // The surfaces' clauses fill at every depth, with no gap.
    for (const k of ['fog', 'rain']) { const e = C.Registry.SURFACES[k]; assert.ok(clean(Clauses.fill(e.clause, Clauses.params(e.params, null, { depth: 3 }))), k); }
  });

  test('the numbers of record are read: WEATHER_SIZE, WEATHER_TURNS and RAIN_STOP_TURNS set otherwise change the square, its turns and the stop', () => {
    const X = loadCore(null, { numbers: { WEATHER_SIZE: 5, WEATHER_TURNS: 4, RAIN_STOP_TURNS: 3 } });
    const s = room(X, {}, { depth: 3, map: OPEN, you: [4, 3], stations: [{ at: [2, 1], dir: 'E' }], cases: [{ at: [3, 3], weather: 'rain' }] });
    const r = H.play(X, s, [{ a: 'bash', x: 3, y: 3 }], { inv: 'all' });
    assert.deepEqual(r.violations, []);
    const out = weatherOut(r.events);
    assert.equal(json(out.map(e => [e.size, e.turns])), json([[5, 4]]));
    const t = r.steps[0].events[0].turn;
    assert.equal(s.actors[1].statuses.find(q => q.id === 'fixed').until, t + 1 + 4 + 3, 'the 5-wide square reaches the station two rows up, and holds it 3 turns after');
  });
};
