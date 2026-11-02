// ACCESSION — the module alarm_network (BUILD.md §5.4; M4 plan MO6–MO8, D1.6–D1.8; MOD-ALARM): its
// part on the Wader's line, "On seeing you it chases you, first showing the alarm for a turn and
// raising it unless one is shown or running: a crash, then every exhibit still asleep that can
// hear, but the Centrepiece, wakes to look where you stood; for {ALARM_TURNS} turns no pips
// fade, none left undisturbed or done searching goes back, and the
// bell, or after it the night watch, comes up to {ALARM_CLOCK_ADVANCE} turns sooner". Each scenario runs for every
// pack Wader (S9.2) at depths 1–7, joined up (the real core, every rule in place, real actions
// only, every invariant checked after every step, a clone checked where it says so), and is
// rerun with alarm_network switched off, when it must fail (§5.3 check 3). Also: its log and
// stage sentences (the advance's clamps), its form for the validation log, an alarm while the
// hall is sealed, departments with Waders placed by population, and planted faults, each caught.
'use strict';
const H = require('./_harness.js');
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Setup, Step, Roles, N, Grid, Wake, Status, Clock, Text, Modules, Archetypes, Cases } = C;
  const json = x => JSON.stringify(x);
  const waits = n => Array.from({ length: n }, () => ({ a: 'wait' }));
  const ok = (results, name) => { const f = H.failures(results); assert.equal(f.length, 0, `${name}:\n${f.slice(0, 5).join('\n')}`); };
  // (The Wader's scenarios, for the species it acts on as a Wader: S.9's Composite, a
  // Centrepiece flagged with it from its second phase, M4 COMPOSITE-PHASES, has its own in
  // behaviour/completing_guardian-phases.test.js.)
  const list = () => { const l = H.species(C, 'MODULES.alarm_network').filter(x => typeof x.sp.form !== 'string'); assert.ok(l.length >= 7, `${l.length} species and depths`); return l; };
  const tough = (more) => Object.assign({ hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 }, more || {});
  const waders = s => s.actors.filter(a => a.arch === 'patrol_guard');
  const ID = 'alarm_network';
  const PARTS = 'every exhibit still asleep that can hear, but the Centrepiece, wakes to look where you stood';

  // A room in S.9 running its modules (Modules.init, as a department does), with you hard to
  // kill, and its Waders given their rounds and told they walk them (their story, as population
  // and Setup.settleActors give a patrol). spec: Setup.room's, or H.room's (rooms, cp).
  function room(opts, spec, rounds) {
    const s = H.room(C, opts.seed, Object.assign({ acc: 'S9' }, spec), { rulesOff: opts.rulesOff });
    s.actors[0].hp = s.actors[0].maxHp = 999;
    waders(s).forEach((a, k) => { a.route = JSON.parse(json(rounds[k])); Wake.created(s, a, 'patrol', {}, null); });
    Modules.init(s, C.Packs.get('S9'));
    return s;
  }

  // ---- The call ----
  // The Wader at (5, 3) sees you at (8, 3). Asleep: one near it (within the crash's reach), one
  // near it with 2 pips (the crash wakes it first, to look at the crash), two far off, a mimic
  // in its disguise, a Centrepiece's piece, and one in a case. One awake, near enough to hear.
  const MAP = ['###################################', '#.........#.......................#', '#.........#.......................#', '#.........\'.......................#',
    '#.........#.....v.................#', '#.........#.......................#', '###################################'];
  const ROUND = { posts: [[1, 1], [9, 1], [9, 5], [1, 5]], i: 0 };
  const CLOCK = { B: 200, G: 100, count: 10 };
  const callRoom = (sp, depth, opts, clock) => room(opts, { depth, map: MAP, you: [8, 3], clock: clock || CLOCK,
    fixtures: [Cases.make({ x: 16, y: 4, glass: 1, lock: 1 })],
    exhibits: [{ sp: sp.id, at: [5, 3], stats: Roles.stats(sp.role, depth) },
      { sp: 'dummy', at: [2, 1], mode: 'dormant', stats: tough() }, { sp: 'dummy', at: [2, 5], mode: 'dormant', pips: 2, stats: tough() },
      { sp: 'dummy', at: [25, 1], mode: 'dormant', stats: tough() }, { sp: 'dummy', at: [32, 5], mode: 'dormant', pips: 1, stats: tough() },
      { sp: 'S9.5', at: [20, 2], stats: Roles.stats('ambusher', depth) },
      { sp: 'dummy', at: [28, 3], mode: 'dormant', role: 'centrepiece', stats: tough() },
      { sp: 'dummy', at: [16, 4], mode: 'dormant', stats: tough() },
      { sp: 'dummy', at: [12, 1], mode: 'awake', stats: tough() }] }, [ROUND]);
  // Who the clause says wakes: each exhibit still asleep, after the crash, that can hear and is
  // no Centrepiece's: the crash (a noise of NOISE_CRASH walking tiles from the Wader) gives one
  // pip to each sleeper within it, so one already at 2 woke to it; a mimic hears nothing.
  function clauseWakes(s, at) {
    const m = s.dept, reach = Grid.distances(m, [at], N.NOISE_CRASH, (x, y) => Grid.closedDoor(m, x, y) ? N.NOISE_DOOR : 0, 'noise');
    return s.actors.filter((b, i) => i > 0 && b.mode === 'dormant' && b.role !== 'centrepiece' && !Archetypes.pipless(s, b)
      && !(b.pips + 1 >= N.PIPS_TO_WAKE && Grid.reachDist(reach, m, b.x, b.y, 'noise') >= 0 && Grid.reachDist(reach, m, b.x, b.y, 'noise') <= N.NOISE_CRASH)).map(b => b.uid);
  }

  let sentTo = null;
  const call = H.scenario({
    name: 'on seeing you it shows the alarm for a turn, then calls: a crash, then every exhibit still asleep that can hear, but the Centrepiece, wakes, sent to look where you stood',
    id: 'MODULES.alarm_network', clone: true,
    build: (params, sp, depth, opts) => callRoom(sp, depth, opts),
    // Where each exhibit is sent, read once the call has gone off and before any acts.
    actions: (s, i) => { if (i === 0) sentTo = null; if (i === 2) sentTo = s.actors.map(a => [a.uid, a.target]); return i < 3 ? { a: 'wait' } : null; },
    expect(r, params) {
      const s = r.start, w = waders(s)[0], [e0, e1] = [r.steps[0].events, r.steps[1].events];
      // Shown: its first action, on its own tile; nothing else of the alarm yet.
      const shown = e0.filter(e => e.k === 'telegraphed' && e.who === w.uid);
      if (shown.length !== 1 || shown[0].sp !== 'alarm' || json(shown[0].tiles) !== json([[5, 3]])) return `it showed ${json(shown)} at its first action, not the alarm on its tile`;
      if (!e0.some(e => e.k === 'module' && e.id === ID && e.rule === 'alarm_shown' && e.who === w.uid)) return 'the log did not say it showed the alarm';
      if (e0.some(e => e.k === 'alarm' || (e.k === 'woke' && e.cause.k === 'alarm'))) return 'the alarm went off before your next decision';
      // The call, at its next action: the crash first, at its tile.
      const k = e1.findIndex(e => e.k === 'special' && e.who === w.uid && e.sp === 'alarm');
      const crash = e1.findIndex(e => e.k === 'noise' && e.cls === 'crash' && e.x === 5 && e.y === 3 && e.cause.k === 'alarm' && e.cause.by === w.uid);
      if (k < 0 || crash < 0 || crash > k) return 'its call made no crash at its tile, first';
      const woke = e1.filter(e => e.k === 'woke' && e.cause.k === 'alarm').map(e => e.who), want = clauseWakes(s, [5, 3]);
      if (json(woke) !== json(want)) return `the call woke ${json(woke)}; the clause wakes ${json(want)}`;
      if (want.length < 4) return 'this scenario needs more sleepers that the alarm wakes';
      const encased = s.actors[8].uid;
      for (const e of e1.filter(f => f.k === 'woke' && f.cause.k === 'alarm')) {
        if (e.mode !== 'awake' || e.was !== 'dormant' || e.cause.by !== w.uid || e.cause.x !== 8 || e.cause.y !== 3) return `${e.who} woke ${json(e)}, not awake by the Wader to look at your tile`;
        if ((e.cause.how === 'case') !== (e.who === encased)) return `${e.who}'s waking says how ${e.cause.how}: only the one in a case wakes in it`;
      }
      // The log tells the wakes in two lines: those sent to look, and the one in its case.
      const said1 = Text.log(e1, C.Labels.nameOf(r.state));
      if (!said1.includes(`The alarm woke ${Text.count(want.length - 1, 'exhibit')}, and they set off to look where you were.`) || !said1.some(l => /woke in its case: the alarm was raised\.$/.test(l))) return `the log says ${json(said1)}`;
      // The near sleeper at 2 pips woke to the crash, to look at it; the mimic and the
      // Centrepiece's piece sleep on.
      const n2 = s.actors[3].uid, crashWoke = e1.find(e => e.k === 'woke' && e.who === n2);
      if (!crashWoke || crashWoke.cause.k !== 'noise' || crashWoke.cause.x !== 5) return `the sleeper at 2 pips did not wake to the crash: ${json(crashWoke)}`;
      const mimic = s.actors[6].uid, piece = s.actors[7].uid;
      if (e1.some(e => e.k === 'woke' && (e.who === mimic || e.who === piece))) return 'the mimic or the Centrepiece woke';
      // Then the alarm is raised: the module's event, the alarm for its turns, the bell sooner.
      const said = e1.find(e => e.k === 'module' && e.id === ID && e.rule === 'call');
      if (!said || said.who !== w.uid || json(said.at) !== json([5, 3]) || said.n !== want.length) return `the call's module event is ${json(said)}`;
      const alarm = e1.find(e => e.k === 'alarm');
      if (!alarm || alarm.by !== w.uid || alarm.until !== alarm.turn + params.ALARM_TURNS || e1.indexOf(alarm) < k) return `the alarm event is ${json(alarm)}`;
      const stage = e1.find(e => e.k === 'stage' && e.cause.k === ID);
      if (!stage || stage.stage !== 'bell_sooner' || stage.n !== params.ALARM_CLOCK_ADVANCE || stage.cause.by !== w.uid) return `the clock's stage event is ${json(stage)}`;
      // Each of them sent to look at your tile; the line says so.
      for (const uid of want) { const t = sentTo.find(([u]) => u === uid)[1]; if (json(t) !== json([8, 3])) return `${uid} was sent to look at ${json(t)}, not at your tile 8,3`; }
      if (!r.clause || !r.clause.includes(PARTS)) return `the line does not say what the call wakes: "${r.clause}"`;
      return null;
    },
  });
  test('the call: shown for a turn, then a crash, then every exhibit still asleep that can hear, but the Centrepiece, wakes awake, sent to your tile; never a mimic', () => {
    ok(H.sweep(C, call, list()), call.name);
  });

  // ---- While it runs ----
  // Two Waders see you; an idle awake exhibit and a Centrepiece's piece asleep at 2 pips are in
  // a room apart, which nothing reaches: neither sees you nor hears anything.
  const APART = ['############################', '#.............#............#', '#.............#............#', '#.............#............#', '#.............#............#', '#.............#............#', '############################'];
  const lasting = H.scenario({
    name: 'for its turns no pip fades, no idle exhibit goes back and no other alarm is shown; then it is over, and pips fade and exhibits go back again',
    id: 'MODULES.alarm_network', clone: true,
    build: (params, sp, depth, opts) => room(opts, { depth, map: APART, you: [7, 3], exhibits: [
      { sp: sp.id, at: [3, 3], stats: Roles.stats(sp.role, depth) }, { sp: sp.id, at: [11, 3], stats: Roles.stats(sp.role, depth) },
      { sp: 'dummy', at: [20, 3], mode: 'awake', home: [25, 1], stim: 0, stats: tough() },
      { sp: 'dummy', at: [17, 5], mode: 'dormant', role: 'centrepiece', pips: 2, stim: 0, stats: tough() }] },
      [{ posts: [[1, 1], [1, 5]], i: 0 }, { posts: [[13, 1], [13, 5]], i: 0 }]),
    actions: waits(40),
    expect(r, params) {
      const [w1, w2] = waders(r.start), idle = r.start.actors[3].uid, piece = r.start.actors[4].uid, T = params.ALARM_TURNS;
      const shows = r.events.filter(e => e.k === 'telegraphed' && e.sp === 'alarm'), alarms = r.events.filter(e => e.k === 'alarm');
      if (!shows.length || shows[0].who !== w1.uid || shows[0].turn !== 0) return `the first to see you did not show the alarm at once: ${json(shows[0])}`;
      if (r.steps[0].events.some(e => e.k === 'telegraphed' && e.who === w2.uid)) return 'the second Wader showed one too, while the first showed it';
      if (!r.steps[0].events.some(e => e.k === 'hunting' && e.who === w2.uid)) return 'the second Wader did not chase you';
      const first = alarms[0];
      if (!first || first.turn !== 1) return 'the alarm was not raised at the Wader\'s next action';
      if (shows.slice(1).some(e => e.turn < first.until) || alarms.slice(1).some(e => e.turn < first.until)) return 'another alarm was shown or raised while one ran';
      const decay = r.events.filter(e => e.k === 'pip' && e.who === piece && e.cause.k === 'decay');
      if (decay.some(e => e.turn < first.until)) return `a pip faded on turn ${decay[0].turn}, while the alarm ran`;
      if (!decay.length || decay[0].turn !== first.until) return `once over, the sleeper's pips did not fade at once (${json(decay.map(e => e.turn))})`;
      const back = r.events.filter(e => e.k === 'lost' && e.who === idle && e.to === 'returning');
      if (back.some(e => e.turn < first.until)) return `the idle exhibit went back on turn ${back[0].turn}, while the alarm ran`;
      if (!back.length || back[0].cause.k !== 'idle') return 'once over, the idle exhibit did not go back';
      const over = r.events.filter(e => e.k === 'module' && e.id === ID && e.rule === 'alarm_over');
      if (over.length !== 1 || over[0].turn !== first.until || over[0].turns !== T) return `the alarm was told over ${json(over)}, not once on turn ${first.until} after ${T} turns`;
      if (over[0].cause.fade !== true || !/pips fade again/.test(Text.event(over[0]))) return `before the bell, its end does not say pips fade again: ${Text.event(over[0])}`;
      // Over, a Wader that sees you shows it again.
      if (!shows.some(e => e.turn >= first.until) || !alarms.some(e => e.turn > first.until)) return 'once over, no Wader that saw you raised the alarm again';
      return null;
    },
  });
  test('for its turns no pip fades, none goes back, and no other alarm is shown or raised; then it is over, told so, and a Wader seeing you raises it again', () => {
    ok(H.sweep(C, lasting, list()), lasting.name);
  });

  // alarm.lasting follows a step's events in order (M4 FU3): exhibits act in spawn order, so
  // one may go back, left undisturbed, earlier in the very turn a Wader acting after it raises
  // the alarm (S.9 seed 301 at depth 3, monkey play from the hall's opening, turn 88). It went
  // back before the alarm ran; one going back after the call, in that turn, breaks the line.
  test('alarm.lasting reads a step in order: going back (idle, searched) or a pip fading before the call, in the alarm\'s first turn, breaks nothing; after it, it does', () => {
    const inv = require('./alarm.inv.js')(C).find(i => i.id === 'alarm.lasting');
    const s = callRoom(list()[0].sp, 3, { seed: 3, rulesOff: [] }), t = s.turn, tick = t * 100;
    const w = waders(s)[0].uid, other = s.actors[2].uid;
    const alarm = { k: 'alarm', turn: t, tick, by: w, until: t + N.ALARM_TURNS, cause: { k: ID } };
    const before = [{ k: 'lost', turn: t, tick, who: other, from: 'awake', to: 'returning', cause: { k: 'idle', turns: N.AWAKE_IDLE_TURNS } },
      { k: 'lost', turn: t, tick, who: other, from: 'searching', to: 'returning', cause: { k: 'searched' } },
      { k: 'pip', turn: t, tick, who: other, delta: -1, cause: { k: 'decay' } }];
    for (const e of before) {
      assert.equal(inv.check(s, [e, alarm], s), null, `${e.k} ${e.cause.k} before the call`);
      assert.match(String(inv.check(s, [alarm, e], s)), /while the alarm ran/, `${e.k} ${e.cause.k} after the call`);
    }
  });

  // While it runs, an exhibit still goes back for a reason the line leaves open: a tethered
  // warden searching for you, once you are outside its tether, goes back by its own rule
  // (lost, cause tether). So the line promises only what Modules.mayReturn holds: none goes
  // back for being left undisturbed or done searching, never "none awake or searching".
  const WALLED = ['############', '#....#.....#', '#....#.....#', '#....#.....#', '############'];
  test('while it runs, a tethered warden you left still goes back (its own rule), and the line promises only that none left undisturbed or done searching goes back', () => {
    for (let depth = 1; depth <= 7; depth++) {
      const s = room({ seed: depth, rulesOff: [] }, { depth, map: WALLED, you: [8, 2], exhibits: [{ sp: 'S9.2', at: [10, 3], stats: Roles.stats('warden', depth) },
        { sp: 'S9.4', at: [2, 2], mode: 'searching', lastKnown: [2, 2], stim: 0, home: [2, 2], guards: [2, 2], stats: Roles.stats('warden', depth) }] }, [{ posts: [[10, 1], [10, 3]], i: 0 }]);
      const w = waders(s)[0];
      C.Modules.of(s, ID).alarm = { by: w.uid, since: 0, until: N.ALARM_TURNS };
      const r = H.play(C, s, waits(4));
      assert.deepEqual(r.violations.map(v => v.text), [], `depth ${depth}`);
      const back = r.events.filter(e => e.k === 'lost' && e.to === 'returning' && e.who === s.actors[2].uid);
      assert.ok(back.length === 1 && back[0].cause.k === 'tether' && back[0].turn < N.ALARM_TURNS, `depth ${depth}: ${json(back)}`);
      const line = C.Clauses.line(C.Packs.species('S9', 'S9.2'), { depth });
      assert.ok(line.includes('none left undisturbed or done searching goes back') && !/awake or searching/.test(line), line);
    }
  });

  // ---- The clock brought nearer: stages 0, 1 and 2, and the clamp at the next turn ----
  const SMALL = ['############', '#..........#', '#..........#', '#..........#', '############'];
  // [clock, its stage event's stage, n, the clock after (B, G)]: the call is at turn 1, when
  // the count has gone up by one.
  const CLOCKS = [
    [{ B: 200, G: 100, count: 10 }, 'bell_sooner', N.ALARM_CLOCK_ADVANCE, [170, 100]],
    [{ B: 15, G: 100, count: 10 }, 'bell_sooner', 3, [12, 100]],
    [{ B: 100, G: 100, count: 120 }, 'watch_sooner', N.ALARM_CLOCK_ADVANCE, [100, 70]],
    [{ B: 100, G: 30, count: 125 }, 'watch_sooner', 3, [100, 27]],
    [{ B: 100, G: 50, count: 170 }, 'nothing_sooner', 0, [100, 50]],
  ];
  const clocks = CLOCKS.map(([clock, stage, n, after]) => H.scenario({
    name: `the alarm brings the clock nearer: from count ${clock.count} with the bell at ${clock.B} and the night watch ${clock.G} after, ${stage} by ${n}`,
    id: 'MODULES.alarm_network', clone: true,
    build: (params, sp, depth, opts) => room(opts, { depth, map: SMALL, you: [7, 2], clock, exhibits: [{ sp: sp.id, at: [3, 2], stats: Roles.stats(sp.role, depth) }] }, [{ posts: [[1, 1], [1, 3]], i: 0 }]),
    actions: waits(2),
    expect(r) {
      const e = r.events.find(f => f.k === 'stage' && f.cause.k === ID), c = r.state.dept.clock;
      if (!e || e.stage !== stage || e.n !== n) return `the alarm's stage event is ${json(e)}, not ${stage} by ${n}`;
      if (json([c.B, c.G]) !== json(after)) return `the clock is B ${c.B}, G ${c.G}, not ${after}`;
      // The stage chip and the dial say the same (Text.stage, Text.clock, from Clock.view).
      const chip = Text.stage(Clock.view(r.state)), toBell = clock.B - n - (clock.count + 2);
      if (c.stage === 0 && chip.next !== `bell in ${toBell} turns`) return `the stage chip says "${chip.name} ${chip.next}", not the bell ${n} turns nearer (in ${toBell} turns)`;
      if (c.stage === 0 && !Text.clock(Clock.view(r.state)).endsWith(`the bell rings in ${toBell} turns.`)) return `the dial says "${Text.clock(Clock.view(r.state))}"`;
      if (!/never sooner than the next turn|nothing sooner/.test(Text.event(e, C.Labels.nameOf(r.state)))) return `its sentence does not state the clamp: ${Text.event(e)}`;
      if (e.cause.sealed !== undefined || /stopped/.test(Text.event(e))) return `with no hall sealed, its sentence speaks of a stopped clock: ${Text.event(e)}`;
      return null;
    },
  }));
  test('the alarm brings the bell (and the night watch with it), or after the bell the night watch, up to ALARM_CLOCK_ADVANCE turns sooner, never past the next turn, and nothing in the night watch; the stage chip shows it', () => {
    for (const sc of clocks) ok(H.sweep(C, sc, list()), sc.name);
  });

  // Over after the bell, its end does not say pips fade again: after the bell they never do.
  test('an alarm over after the bell says pips do not fade, since the bell has rung; before it, that they fade again', () => {
    for (const { sp, depth } of list()) {
      const s = room({ seed: depth, rulesOff: [] }, { depth, map: SMALL, you: [7, 2], clock: { B: 100, G: 100, count: 120 }, exhibits: [{ sp: sp.id, at: [3, 2], stats: Roles.stats(sp.role, depth) }] }, [{ posts: [[1, 1], [1, 3]], i: 0 }]);
      const r = H.play(C, s, waits(N.ALARM_TURNS + 3));
      assert.deepEqual(r.violations.map(v => v.text), [], `${sp.id} d${depth}`);
      const over = r.events.filter(e => e.k === 'module' && e.id === ID && e.rule === 'alarm_over');
      assert.ok(over.length === 1 && over[0].cause.fade === false, json(over));
      assert.ok(/pips do not fade: the bell has rung/.test(Text.event(over[0])) && !/pips fade again/.test(Text.event(over[0])), Text.event(over[0]));
    }
  });

  // ---- An alarm while the hall is sealed ----
  // The hall's seal is planted as ARCH-HALL's will be (dept.cp.sealed, the clock's pausedSince,
  // shutters on its openings), since Hall.boundary is its package's: the Wader, you and the
  // Centrepiece's piece inside, sleepers outside.
  const HALL = ['########################', '#.........#............#', '#.........#............#', '#.........Z............#', '#.........#............#', '#.........#............#', '########################'];
  const sealed = H.scenario({
    name: 'an alarm in a sealed hall: the sleepers outside wake, sent to your tile, the Centrepiece sleeps on, and the bell comes sooner though the count is stopped',
    id: 'MODULES.alarm_network', clone: true,
    build: (params, sp, depth, opts) => {
      const s = room(opts, { depth, map: HALL, you: [6, 3], clock: { B: 200, G: 100, count: 50 },
        rooms: [{ key: 'hall', role: 'centre', x0: 1, y0: 1, x1: 9, y1: 5 }, { key: 'out', role: 'section', x0: 11, y0: 1, x1: 22, y1: 5 }],
        exhibits: [{ sp: sp.id, at: [3, 3], stats: Roles.stats(sp.role, depth) }, { sp: 'dummy', at: [1, 3], mode: 'dormant', role: 'centrepiece', pips: 1, stats: tough() },
          { sp: 'dummy', at: [14, 3], mode: 'dormant', stats: tough() }, { sp: 'dummy', at: [20, 5], mode: 'dormant', stats: tough() }],
        cp: { uids: ['S9.' + depth + '.room.2'], room: 'hall', openings: [{ x: 10, y: 3, ch: "'" }], sealed: { turn: 0, by: 'S9.' + depth + '.room.2', why: 'hunt' } } },
      [{ posts: [[1, 1], [1, 5]], i: 0 }]);
      s.dept.clock.pausedSince = 0;
      return s;
    },
    actions: waits(3),
    expect(r) {
      const s = r.start, [w, piece, o1, o2] = s.actors.slice(1), c = r.state.dept.clock;
      if (!C.Clock.sealed(r.state)) return 'the hall is not sealed';
      if (!r.events.some(e => e.k === 'alarm' && e.by === w.uid)) return 'no alarm was raised in the sealed hall';
      const woke = r.events.filter(e => e.k === 'woke' && e.cause.k === 'alarm').map(e => e.who);
      if (json(woke) !== json([o1.uid, o2.uid])) return `the alarm woke ${json(woke)}, not the sleepers outside`;
      if (r.state.actors[2].mode !== 'dormant') return 'the Centrepiece woke';
      if (c.count !== 50) return `the count moved (${c.count}) while the hall was sealed`;
      if (c.B !== 200 - N.ALARM_CLOCK_ADVANCE) return `the bell is at ${c.B}: a sealed hall stops the count, not the alarm's advance`;
      // Its sentence says the turns are the stopped clock's, counted once it starts again.
      const st = r.events.find(e => e.k === 'stage' && e.cause.k === ID), said = st && Text.event(st);
      if (!st || st.cause.sealed !== true || !said.endsWith('The clock is stopped while the hall is sealed: these are turns it counts once it starts again.')) return `the alarm's stage sentence in a sealed hall: ${said}`;
      if (r.state.actors.slice(3).some(b => b.mode !== 'dormant' && (b.x < 11))) return 'a sleeper outside came into the sealed hall';
      return null;
    },
  });
  test('an alarm while the hall is sealed: those outside wake, the Centrepiece does not, and the bell comes sooner while the count is stopped', () => {
    ok(H.sweep(C, sealed, list()), sealed.name);
  });

  // ---- Called off ----
  test('a shown alarm called off (its Wader fixed) is never raised; once it can act and sees you again, it shows it again', () => {
    for (const { sp, depth } of list()) {
      const s = room({ seed: depth, rulesOff: [] }, { depth, map: SMALL, you: [7, 2], exhibits: [{ sp: sp.id, at: [3, 2], stats: Roles.stats(sp.role, depth) }] }, [{ posts: [[1, 1], [1, 3]], i: 0 }]);
      const w = waders(s)[0];
      Step.step(s, { a: 'wait' });
      assert.equal(w.telegraph && w.telegraph.sp, 'alarm');
      const ev = [];
      Status.apply(s, w, 'fixed', 2, { k: 'status', id: 'fixed' }, ev);
      Status.settle(s);
      assert.ok(ev.some(e => e.k === 'special' && e.cancelled && e.sp === 'alarm'));
      const r = H.play(C, s, waits(8));
      assert.deepEqual(r.violations.map(v => v.text), []);
      const alarms = r.events.filter(e => e.k === 'alarm'), shows = r.events.filter(e => e.k === 'telegraphed' && e.sp === 'alarm');
      assert.ok(shows.length >= 1 && alarms.length === 1 && alarms[0].turn > shows[0].turn, `${sp.id} d${depth}: shown again and raised once it could act`);
      assert.ok(!r.events.slice(0, r.events.indexOf(shows[0])).some(e => e.k === 'woke' && e.cause.k === 'alarm'), 'nothing woke to the alarm called off');
    }
  });

  // ---- Words ----
  test('the stage sentence states the advance\'s clamps: n turns sooner, never sooner than the next turn, nothing in the night watch', () => {
    const say = (stage, n) => Text.event({ k: 'stage', turn: 3, tick: 300, stage, n, cause: { k: ID, by: 'S9.1.room.1' } });
    const A = N.ALARM_CLOCK_ADVANCE;
    assert.equal(say('bell_sooner', A), `The alarm brings the bell ${A} turns sooner, and the night watch with it (never sooner than the next turn).`);
    assert.equal(say('bell_sooner', 3), `The alarm brings the bell 3 turns sooner, to the next turn, and the night watch with it: an alarm brings it up to ${A} turns sooner, but never sooner than the next turn.`);
    assert.equal(say('bell_sooner', 1), `The alarm brings the bell 1 turn sooner, to the next turn, and the night watch with it: an alarm brings it up to ${A} turns sooner, but never sooner than the next turn.`);
    assert.equal(say('bell_sooner', 0), 'The alarm cannot bring the bell any sooner: it comes at the next turn, and nothing comes sooner than that.');
    assert.equal(say('watch_sooner', A), `The alarm brings the night watch ${A} turns sooner (never sooner than the next turn).`);
    assert.equal(say('nothing_sooner', 0), 'The alarm brings nothing sooner: the night watch has begun, and the clock has no stage left to bring nearer.');
    // While a hall is sealed the clock is stopped: the turns are the ones it counts once it
    // starts again, and its next turn is the clock's, not the next turn.
    const sealed = (stage, n) => Text.event({ k: 'stage', turn: 3, tick: 300, stage, n, cause: { k: ID, by: 'S9.1.room.1', sealed: true } });
    const STOPPED = ' The clock is stopped while the hall is sealed: these are turns it counts once it starts again.';
    assert.equal(sealed('bell_sooner', A), `The alarm brings the bell ${A} turns sooner, and the night watch with it (never sooner than the clock’s next turn).${STOPPED}`);
    assert.equal(sealed('bell_sooner', 3), `The alarm brings the bell 3 turns sooner, to the clock’s next turn, and the night watch with it: an alarm brings it up to ${A} turns sooner, but never sooner than the clock’s next turn.${STOPPED}`);
    assert.equal(sealed('watch_sooner', 0), `The alarm cannot bring the night watch any sooner: it comes at the clock’s next turn, and nothing comes sooner than that.${STOPPED}`);
    // The rules' sentences: shown, the call, over; a crash; a patrol back to its round.
    const names = uid => uid === 'x.1' ? 'the Lantern-Crop Wader' : null;
    const mod = (rule, more) => Text.event(Object.assign({ k: 'module', turn: 3, tick: 300, id: ID, rule, cause: { k: ID } }, more), names);
    assert.equal(mod('alarm_shown', { who: 'x.1' }), 'The Lantern-Crop Wader has seen you, and shows the alarm: at its next action it raises it.');
    assert.equal(mod('call', { who: 'x.1', at: [5, 3], n: 4 }), 'The Lantern-Crop Wader called: with a crash, every exhibit still asleep that could hear, but the Centrepiece, woke (4 exhibits).');
    const over = fade => Text.event({ k: 'module', turn: 3, tick: 300, id: ID, rule: 'alarm_over', turns: N.ALARM_TURNS, cause: { k: ID, fade } }, names);
    assert.equal(over(true), `The alarm is over, after ${N.ALARM_TURNS} turns: pips fade again, and exhibits may go back to their places.`);
    assert.equal(over(false), `The alarm is over, after ${N.ALARM_TURNS} turns: exhibits may go back to their places (pips do not fade: the bell has rung).`);
    assert.equal(mod('call', {}), null, 'a call that names no Wader is never told');
    assert.equal(Text.event({ k: 'alarm', turn: 3, tick: 300, by: 'x.1', until: 3 + N.ALARM_TURNS, cause: { k: ID } }, names),
      `The Lantern-Crop Wader raised the alarm: for ${N.ALARM_TURNS} turns, sleeping exhibits keep their pips, no exhibit goes back to its place for being left undisturbed or done searching, and no other alarm can be raised.`);
    // Its mark and its going off name the alarm and the tile it marks, its own.
    const tel = { k: 'telegraphed', turn: 3, tick: 300, who: 'x.1', sp: 'alarm', tiles: [[5, 3]], cause: { k: 'special', by: 'x.1', sp: 'alarm', gross: null } };
    assert.equal(Text.event(tel, names), 'The Lantern-Crop Wader marks its own tile for its alarm, at its next action.');
    assert.equal(Text.event({ k: 'special', turn: 4, tick: 400, who: 'x.1', sp: 'alarm', cause: { k: 'special', by: 'x.1', sp: 'alarm' } }, names), 'The Lantern-Crop Wader used its alarm.');
    assert.equal(Text.event({ k: 'special', turn: 4, tick: 400, who: 'x.1', sp: 'alarm', cancelled: true, cause: { k: 'cancel', by: 'x.1', why: 'fixed' } }, names), 'The Lantern-Crop Wader’s alarm was called off: it was fixed in place.');
    // Woken by the call: sent to look where you were, or, in an intact case, staying in it; in
    // the log, one line for each.
    const woke = (who, how) => ({ k: 'woke', turn: 4, tick: 400, who, was: 'dormant', mode: 'awake', cause: Object.assign({ k: 'alarm', by: 'x.1', x: 8, y: 3 }, how ? { how } : {}) });
    assert.equal(Text.event(woke('x.1'), names), 'The Lantern-Crop Wader woke: the alarm was raised, and it set off to look where you were.');
    assert.equal(Text.event(woke('x.1', 'case'), names), 'The Lantern-Crop Wader woke in its case: the alarm was raised.');
    assert.equal(json(Text.log([woke('a.1'), woke('a.2', 'case'), woke('a.3'), woke('a.4', 'case'), woke('a.5')], names)),
      json(['The alarm woke 3 exhibits, and they set off to look where you were.', 'The alarm woke 2 exhibits in their cases.']));
    assert.equal(Text.event({ k: 'noise', turn: 3, tick: 300, x: 5, y: 3, cls: 'crash', range: N.NOISE_CRASH, cause: { k: 'alarm', by: 'x.1' } }), `Crash: the alarm being raised, heard ${N.NOISE_CRASH} tiles away.`);
    assert.equal(Text.event({ k: 'alerted', turn: 3, tick: 300, who: 'x.1', from: 'searching', to: 'awake', x: 1, y: 1, cause: { k: 'round' } }, names), 'The Lantern-Crop Wader searched where it last knew you were, and goes back to its round.');
    // The panel sentence (§5.4's, as taught): what the call does, in plain words. M2's "then
    // the whole court is awake" claimed more, since the Centrepiece and a mimic sleep on.
    assert.equal(C.Clauses.sentence(ID, { depth: 3 }), 'The waders raise the alarm when they see you; then every sleeping exhibit in the department that can hear, but the Centrepiece, wakes.');
  });

  test('its form, for the validation log: alarm_shown and call through the form; its lasting effects, the call\'s crash and wakes and the Wader\'s showing it bespoke', () => {
    assert.equal(json(Modules.form(ID)), json({ rules: [{ rule: 'alarm_shown', on: 'telegraphed', do: ['flag'], telegraph: null },
      { rule: 'call', on: 'special', do: ['alarm', 'clock'], telegraph: { turns: 1, shown: 'alarm' } }], bespoke: ['pipsDecay', 'mayReturn', 'alarmDecay', 'AlarmNetwork.call', 'patrol_guard.act'] }));
    assert.ok(Modules.bespoke().some(b => b.id === ID));
    // Its module part's words, through every depth: filled, and in the Wader's slot.
    for (let depth = 1; depth <= 7; depth++) {
      const line = C.Clauses.line(C.Packs.species('S9', 'S9.2'), { depth });
      assert.ok(line.includes(`On seeing you it chases you, first showing the alarm for a turn and raising it unless one is shown or running: a crash, then ${PARTS}; for ${N.ALARM_TURNS} turns no pips fade, none left undisturbed or done searching goes back, and the bell`), line);
      assert.ok(line.endsWith(`comes up to ${N.ALARM_CLOCK_ADVANCE} turns sooner; losing you, it searches, then resumes its round. It never sleeps.`), line);
    }
  });

  // ---- In departments: Waders placed by population, on their rounds ----
  // S.9 with a gallery list (fixture galleries, as D-PACKS will give it, the Grazers left out
  // until their archetype is built): every Wader made with its round, told it walks it; then a
  // walk through each department, every invariant checked after every step.
  const GALLERIES = [
    { key: 'intro', name: 'The Lamp Corridor', contents: [] },
    { key: 's1', where: 'central', name: 'The Mount Court', contents: [{ sp: 'S9.2' }, { sp: 'S9.3' }, { sp: 'S9.6', count: 2 }] },
    { key: 's2', where: 'band', name: 'The Brooders\' Bay', contents: [{ sp: 'S9.4', guards: 'case' }, { sp: 'S9.5', near: 'case' }, { sp: 'S9.2' }] },
    { key: 'last', name: 'The Round-Book Room', contents: [{ sp: 'S9.6' }] },
    { key: 'centre', name: 'The Day Curator\'s Case', contents: [] },
    { key: 'coda', name: 'The Night Staff\'s Tea Room', contents: [] },
  ];
  test('in S.9 departments, Waders placed by population walk their rounds, told so from the start; a walk through each raises the alarm, every invariant holding', () => {
    const X = loadCore();
    X.Packs.get('S9').galleries = JSON.parse(json(GALLERIES));
    let alarms = 0, patrols = 0, calls = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const depth = 1 + ((seed - 1) % 7), s = X.Dept.create(seed, 'S9', depth);
      // S.9's modules, in pack order: unobserved_motion (MOD-UNOBSERVED) and this one.
      assert.equal(json(s.dept.modules.map(m => [m.id, m.on])), json([['unobserved_motion', true], [ID, true]]));
      for (const a of s.actors.filter(b => b.arch === 'patrol_guard')) {
        if (!a.route) continue;
        patrols++;
        assert.equal(a.woke.cause.k, 'patrol', `seed ${seed}: ${a.uid}'s story`);
        assert.ok(X.Archetypes.wakeRegion(s, a, X.N.SAFE_ZONE_TURNS).length > 0, `seed ${seed}: ${a.uid} has its round's sight`);
      }
      // A walk: toward the nearest Wader, as the explorer will, then waits beside it.
      let lcg = seed * 7919;
      const r = H.play(X, s, (st, i) => {
        if (i >= 200) return null;
        const you = st.actors[0], w = st.actors.filter(b => b.arch === 'patrol_guard' && !b.gone)[0];
        const legal = X.Step.legal(st).filter(a => a.a === 'move' || a.a === 'wait');
        if (w) {
          const d = X.Grid.distances(st.dept, [[w.x, w.y]], 9999, null);
          const best = legal.filter(a => a.a === 'move').sort((p, q) => d[(you.y + X.Grid.DY[p.dir]) * st.dept.w + you.x + X.Grid.DX[p.dir]] - d[(you.y + X.Grid.DY[q.dir]) * st.dept.w + you.x + X.Grid.DX[q.dir]] || p.dir - q.dir)[0];
          if (best && d[you.y * st.dept.w + you.x] > 3) return best;
        }
        lcg = (lcg * 1103515245 + 12345) % 2147483648;
        return legal[lcg % legal.length];
      }, {});
      assert.deepEqual(r.violations.slice(0, 3).map(v => v.text), [], `S9 seed ${seed}`);
      alarms += r.events.filter(e => e.k === 'alarm').length;
      calls += r.events.filter(e => e.k === 'module' && e.rule === 'call').length;
    }
    assert.ok(patrols >= 8, `${patrols} Waders on their rounds`);
    assert.ok(alarms >= 4 && calls === alarms, `${alarms} alarms raised, ${calls} calls`);
  });

  // ---- Planted faults, each caught ----
  // A fresh core with one rule broken; the call scenario (or the lasting one) at depth 3 must
  // then fail, by its invariants or its expectation.
  const failsWith = (X, sc) => {
    const sp = X.Packs.species('S9', 'S9.2');
    return H.run(X, sc, sp, 3, { seed: 1 }).failure;
  };
  const plants = [
    ['the call wakes a Centrepiece\'s piece', X => { X.Actors.centrepiece = () => false; }, call, /Centrepiece|woke/],
    ['the call makes no crash', X => { const emit = X.Noise.emit; X.Noise.emit = (s, x, y, cls, cause, ev) => cause && cause.k === 'alarm' ? undefined : emit(s, x, y, cls, cause, ev); }, call, /crash/],
    ['the clock is not brought nearer', X => { X.ClockRules.advance = () => {}; }, call, /clock|stage/],
    ['pips fade while it runs', X => { X.Clock.pipsDecay = s => X.Clock.stage(s) === 0; }, lasting, /pip|decay|fade/],
    ['an idle exhibit goes back while it runs', X => { X.AI.mayReturn = () => true; }, lasting, /went back|go back/],
    ['a second alarm shown while one runs', X => { X.AlarmNetwork.mayShow = (s, a) => X.Modules.flagged(s, a, ID) && X.AlarmNetwork.shown(s) === null; }, lasting, /alarm/],
    ['its end never told', X => { const emit = X.Causes.emit; X.Causes.emit = (s, ev, k, f, c) => k === 'module' && f && f.rule === 'alarm_over' ? null : emit(s, ev, k, f, c); }, lasting, /over/],
    ['the wakes sent to the Wader\'s tile', X => { const wake = X.Wake.wake; X.Wake.wake = (s, a, m, c, ev, o) => wake(s, a, m, c, ev, c && c.k === 'alarm' ? { target: [5, 3] } : o); }, call, /look|tile/],
  ];
  test('planted faults in the alarm are each caught: by its invariants or by its scenarios', () => {
    for (const [what, plant, sc, want] of plants) {
      const X = loadCore();
      assert.equal(failsWith(X, sc), null, `${what}: the scenario passes on the real core`);
      plant(X);
      const f = failsWith(X, sc);
      assert.ok(f && want.test(f), `${what}: ${f}`);
    }
  });
};
