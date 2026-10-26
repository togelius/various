// Causes and the death recap (BUILD.md §3.4, §8.1; §11's M3 row, criterion 6), through the
// battery's checks (tools/battery.js):
//   - every event of monkeys in the test room and in every department at depths 1, 4 and 7
//     passes its schema and reads as a clean sentence, with every other check of the battery;
//   - for every death in the arenas' naive runs (seeds 1–4) and in wander's department runs,
//     Text.recap's killer, wake turn, wake trigger and hunt turn equal Recap.fromLog's, rebuilt
//     from the full event log: killers set out awake by a stamp ('placed'), the Night
//     Watchman, a splitter's halves ('summoned') and department wakings;
//   - the Night Watchman, made mid-visit, is read from its entered event and its creation woke;
//     an exhibit a stamp sets out awake has no event for that, and is read from the initial
//     state, as any actor not dormant there is; Recap.fromLog on logs written by hand;
//   - completeness flags an event kind an exhibit causes that its line does not cover, and who
//     causes an event is the cause's `by`, else the subject of a kind whose subject acts.
'use strict';
module.exports = ({ test, assert, root, path }) => {
  const Battery = require(path.join(root, 'tools/battery.js'));
  const { Recap } = Battery;
  const C = Battery.context();
  const json = v => JSON.stringify(v);
  const named = d => Object.assign({ name: Battery.nameOf(d) }, d);
  // A run played again from its replay, with every step's events: {initial, state, events}.
  function replayed(X, replay) {
    const initial = X.Replay.begin(replay.start, replay.options), p = X.Replay.play(replay, { log: true });
    return { initial, state: p.state, events: [].concat(...p.log.map(l => l.events)) };
  }
  const recapOf = (X, s) => { const r = X.Text.recap(s, X.Labels.nameOf(s)); return r && { killer: r.killer, wakeTurn: r.wakeTurn, wakeTrigger: r.wakeTrigger, huntTurn: r.huntTurn }; };

  test('every event of monkeys in the test room and in every department at depths 1, 4 and 7 passes its cause schema and reads as a clean sentence, with every other battery check after every step', () => {
    const runs = [named({ kind: 'monkey', room: 'T0', seed: 5, actions: 300 })];
    for (const p of C.Packs.list()) for (const depth of [1, 4, 7]) runs.push(named({ kind: 'monkey', dept: p.acc, depth, seed: 3, actions: 200 }));
    const r = Battery.run(runs);
    assert.ok(r.pass, `${r.violations} violations: ${r.problems.slice(0, 5).map(p => p.text).join('\n')}`);
    assert.ok(r.events >= r.steps, `${r.events} events in ${r.steps} steps`);
    console.log(`  ${r.events} events in ${r.steps} steps of ${r.runs} monkeys, each with its schema and sentence checked`);
  });

  test('criterion 6: at every death in the arenas\' naive runs and in wander\'s department runs, Text.recap equals Recap.fromLog: killers set out awake, Night Watchmen, split halves and department wakings', () => {
    const runs = [];
    for (const id of Battery.arenas(C).ran) for (const seed of [1, 2, 3, 4]) runs.push(named({ kind: 'arena', arena: id, policy: 'naive', seed }));
    for (const p of C.Packs.list()) for (const depth of [2, 6]) for (const seed of [1, 2]) runs.push(named({ kind: 'wander', dept: p.acc, depth, seed }));
    const r = Battery.run(runs);
    assert.ok(r.pass, `${r.violations} violations: ${r.problems.slice(0, 5).map(p => p.text).join('\n')}`);
    assert.equal(r.recaps, r.deaths);
    console.log(`  ${r.deaths} deaths, each recap equal to the log's; why the killers were awake: ${json(r.killers)}`);
    // The kinds of story the recap must read: set out awake by an arena's stamp, made mid-visit
    // by the night watch, split from a body, and woken by an event in a department.
    if (Battery.arenas(C).ran.includes('plodder')) assert.ok(r.killers.placed >= 1, json(r.killers));
    if (Battery.arenas(C).ran.includes('night_watchman')) assert.ok(r.killers.night_watch >= 1, json(r.killers));
    if (Battery.arenas(C).ran.includes('splitter')) assert.ok(r.killers.summoned >= 1, json(r.killers));
    assert.ok(['ring', 'noise', 'tether', 'axis', 'ally_hit', 'touch_case', 'seen'].some(k => r.killers[k] >= 1), json(r.killers));
    // Every wander run ended in your death, as it is meant to (BUILD.md §10.2: it fights).
    assert.ok(r.results.filter(x => x.kind === 'wander').every(x => x.stopped === 'died'), json(r.results.filter(x => x.kind === 'wander').map(x => x.stopped)));
  });

  test('the Night Watchman, made mid-visit, is read from its entered event and its creation woke into a hunt', () => {
    if (!Battery.arenas(C).ran.includes('night_watchman')) return;
    const Sim = require(path.join(root, 'tools/sim.js'));
    const run = Sim.runArena('night_watchman', 'night_watchman.naive', 1, { C });
    assert.equal(run.stopped, 'died');
    const { initial, state, events } = replayed(C, run.replay);
    const f = Recap.fromLog(initial, events), killer = f.killer;
    assert.ok(killer && !initial.actors.some(a => a.uid === killer), `the killer ${killer} was there from the start`);
    assert.equal(C.Actors.byUid(state, killer).sp, 'night_watchman');
    const entered = events.find(e => e.k === 'entered' && e.who === killer), woke = events.find(e => e.k === 'woke' && e.who === killer);
    assert.ok(entered && woke, 'it came with an entered event and a woke event');
    assert.equal(json([woke.was, woke.mode, woke.cause.k, woke.turn]), json([null, 'hunting', 'night_watch', entered.turn]));
    assert.ok(!events.some(e => e.k === 'hunting' && e.who === killer), 'its hunt is its creation, with no hunting event');
    assert.equal(json(f), json({ killer, wakeTurn: woke.turn, wakeTrigger: 'night_watch', huntTurn: woke.turn }));
    assert.equal(json(recapOf(C, state)), json(f));
  });

  test('an exhibit an arena stamp sets out awake has no event for it: its story is read from the initial state (\'placed\'), as for any actor not dormant there', () => {
    if (!Battery.arenas(C).ran.includes('plodder')) return;
    const Sim = require(path.join(root, 'tools/sim.js'));
    const run = Sim.runArena('plodder', 'plodder.naive', 1, { C });
    assert.equal(run.stopped, 'died');
    const { initial, state, events } = replayed(C, run.replay);
    const f = Recap.fromLog(initial, events), a0 = initial.actors.find(a => a.uid === f.killer);
    assert.ok(a0 && a0.mode === 'hunting', json(a0 && a0.mode));
    assert.ok(!events.some(e => (e.k === 'woke' || e.k === 'hunting') && e.who === f.killer), 'no event tells its waking');
    assert.equal(json(f), json({ killer: f.killer, wakeTurn: initial.turn, wakeTrigger: 'placed', huntTurn: initial.turn }));
    assert.equal(json(recapOf(C, state)), json(f));
    // Without the initial state, the log alone cannot say why it was awake.
    assert.equal(json(Recap.fromLog(null, events)), json({ killer: f.killer, wakeTurn: null, wakeTrigger: null, huntTurn: null }));
  });

  test('Recap.fromLog on logs written by hand: no death; a killer named by no one; the latest waking and hunt win; a creation into a hunt; a starting story an event replaces', () => {
    const ev = (k, turn, fields, cause) => Object.assign({ k, turn, tick: 100 * turn }, fields, { cause });
    const start = { actors: [{ uid: 'you', mode: null }, { uid: 'a', mode: 'awake', woke: { turn: 0, cause: { k: 'awake' } }, hunted: null },
      { uid: 'b', mode: 'dormant', woke: null, hunted: null }] };
    const died = (turn, by) => ev('died', turn, { who: 'you' }, by ? { k: 'attack', by } : { k: 'cough' });
    assert.equal(Recap.fromLog(start, []), null);
    assert.equal(json(Recap.fromLog(start, [died(5, null)])), json({ killer: null, wakeTurn: null, wakeTrigger: null, huntTurn: null }));
    // a: started awake, which no event says; it hunts at 3 on seeing you.
    assert.equal(json(Recap.fromLog(start, [ev('hunting', 3, { who: 'a', was: 'awake' }, { k: 'seen', dist: 2 }), died(5, 'a')])),
      json({ killer: 'a', wakeTurn: 0, wakeTrigger: 'awake', huntTurn: 3 }));
    // a: put to sleep, then woken again by noise into awake, then a hunt: the events win.
    assert.equal(json(Recap.fromLog(start, [ev('woke', 6, { who: 'a', was: 'dormant', mode: 'awake' }, { k: 'noise', dist: 3, cls: 'soft' }),
      ev('hunting', 8, { who: 'a', was: 'awake' }, { k: 'seen', dist: 2 }), ev('woke', 9, { who: 'b', was: 'dormant', mode: 'awake' }, { k: 'noise', dist: 1, cls: 'soft' }), died(11, 'a')])),
    json({ killer: 'a', wakeTurn: 6, wakeTrigger: 'noise', huntTurn: 8 }));
    // b: started dormant; woken by the ring into a hunt (woke, then hunting).
    assert.equal(json(Recap.fromLog(start, [ev('woke', 4, { who: 'b', was: 'dormant', mode: 'hunting' }, { k: 'ring', dist: 1, r: 2 }), ev('hunting', 4, { who: 'b', was: 'dormant' }, { k: 'ring', dist: 1, r: 2 }), died(7, 'b')])),
      json({ killer: 'b', wakeTurn: 4, wakeTrigger: 'ring', huntTurn: 4 }));
    // b never woke (it cannot have struck, but the log is what it is): nothing to read.
    assert.equal(json(Recap.fromLog(start, [died(2, 'b')])), json({ killer: 'b', wakeTurn: null, wakeTrigger: null, huntTurn: null }));
    // w: made mid-visit hunting, by the night watch.
    assert.equal(json(Recap.fromLog(start, [ev('entered', 12, { who: 'w', at: [1, 1] }, { k: 'night_watch', n: 1 }), ev('woke', 12, { who: 'w', was: null, mode: 'hunting' }, { k: 'night_watch' }), died(15, 'w')])),
      json({ killer: 'w', wakeTurn: 12, wakeTrigger: 'night_watch', huntTurn: 12 }));
  });

  test('wander, the battery\'s department policy, explores and fights, and decides the same alone in a fresh context as after other runs', () => {
    const Sim = require(path.join(root, 'tools/sim.js'));
    for (const d of ['S9', 'M11']) Sim.runArena({ dept: d }, 'wander', 1, { C, depth: 2 });
    const after = Sim.runArena({ dept: 'A4' }, 'wander', 2, { C, depth: 3, check: true });
    const alone = Sim.runArena({ dept: 'A4' }, 'wander', 2, { C: Battery.load(), depth: 3 });
    assert.equal(json(after.replay.actions), json(alone.replay.actions));
    assert.equal(json(after.reasons), json(alone.reasons));
    assert.equal(after.violations.length, 0, json(after.violations.slice(0, 3)));
    assert.ok(after.reasons.filter(r => / to explore, /.test(r)).length >= 5 && after.reasons.some(r => /: strikes /.test(r)), after.reasons.join('\n'));
    assert.equal(after.stopped, 'died');
  });

  test('completeness: an exhibit that causes an event kind its Behaviour line does not cover is flagged; who causes an event is its cause\'s by, else the acting subject', () => {
    const { causer } = Battery;
    assert.equal(causer({ k: 'attacked', by: 'a', at: 'you', cause: { k: 'attack', by: 'a' } }), 'a');
    assert.equal(causer({ k: 'damaged', who: 'you', cause: { k: 'special', by: 'b' } }), 'b');
    assert.equal(causer({ k: 'status', who: 'you', cause: { k: 'grip', by: 'm' } }), 'm');
    assert.equal(causer({ k: 'moved', who: 'c' }), 'c');
    assert.equal(causer({ k: 'telegraphed', who: 'd', cause: { k: 'special' } }), 'd');
    assert.equal(causer({ k: 'pip', who: 'e', cause: { k: 'ring', dist: 1, r: 2 } }), null, 'a pip is suffered, not caused');
    assert.equal(causer({ k: 'status', who: 'f', cause: { k: 'status', id: 'fixed' } }), null);
    if (!Battery.arenas(C).ran.includes('plodder')) return;
    // A plodder whose line covers no blows: its blows are flagged, by species and kind.
    const X = Battery.load();
    X.Registry.ARCHETYPES.plodder.covers = [];
    const r = Battery.run([named({ kind: 'arena', arena: 'plodder', policy: 'naive', seed: 1 })], { C: X });
    assert.ok(!r.pass && r.problems.some(p => p.id === 'completeness'), r.sentence);
    assert.ok(Object.keys(r.completeness).some(k => /^A4\.1 (attacked|missed)$/.test(k)), json(r.completeness));
    assert.match(r.problems.find(p => p.id === 'completeness').text, /caused an? (attacked|missed)\.attack event, which is neither universal nor covered by a clause of its Behaviour line/);
  });
};
