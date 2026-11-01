// ACCESSION — the Guarded perks Soft Soles ('soft_soles'), Vanishing Act ('vanishing_act') and
// Light Fingers ('light_fingers'), the case's sentences while Light Fingers is held
// ('case_light_fingers', 'case_light_fingers2'), and the status 'staggered' (BUILD.md §8.1, §8.2,
// §8.3, §8.7; M4 plan PG-PERKS-A, A11's Vanishing Act row, D4.6, D4.7; the PROGRESS map's PR5–PR7),
// joined up: real actions in rooms at depths 1–7, every invariant checked after every step
// (perks-a.inv.js among them), the main runs clone-checked. A perk is held by planting it in
// run.perks (PG-CORE: the perk sheet is UI-PROGRESS's). Each scenario is run at both ranks, and
// again with its perk switched off (rulesOff), when it must fail (§5.3, check 3: the harness's
// sweep does it). The figures expected are worked out here from BUILD's sentences:
//   - Soft Soles: your ring, moving and standing still, is PERK_SOFT_SOLES[rank − 1] smaller,
//     never below RING_MIN, as the ring pips a boundary gives bear out;
//   - Vanishing Act: a hunter out of sight of you searches at its first action, not after
//     LOSE_TRACK_TURNS (lost, cause vanished); at the second rank it then loses its next action
//     (staggered, STAGGER_TURNS), and only that one, whatever its speed; in an intact case it
//     says it stays there; the healer waits none of its turns; the Night Watchman is never
//     touched; in the three departments, real hunters struck awake vanish once out of sight;
//   - Light Fingers: your opening of a case costs PERK_LIGHT_FINGERS_COST ticks and makes no
//     noise, the touch made as ever (what wakes when its case is opened wakes; a mimic grips
//     you); at the second rank a case lock one grade above yours opens, two do not, and a staff
//     door above your grade stays a wall; the case's label says what opening it costs you and
//     whether it makes a noise, as it really does, in every department.
'use strict';
const H = require('./_harness.js');

module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { N, Registry: R, Clauses, Cases, Labels, Vision, Text, Roles, Grid } = C;
  const json = JSON.stringify;
  const DEPTHS = H.DEPTHS.map(depth => ({ sp: null, depth }));
  const ok = (results, name) => { const f = H.failures(results); assert.equal(f.length, 0, `${name}:\n${f.slice(0, 5).join('\n')}`); };
  const TOUGH = { hp: 999, acc: -99, eva: 0, pad: 0, dmin: 1, dmax: 1 };
  const WAIT = { a: 'wait' };
  const waits = n => Array.from({ length: n }, () => WAIT);
  // A perk held at a rank (none at 0), planted in run.perks.
  const hold = (s, id, rank) => { s.run.perks = rank ? [{ id, rank }] : []; return s; };
  const say = (s, e) => Text.event(e, Labels.nameOf(s));
  // A grade as the badge and the labels print it (§8.7).
  const G = n => `Grade ${Text.grade(n)}`;

  // ---- The registry ----

  test('the registry: the three perks at ready true, their clauses naming their numbers as parameters (no digit, a rank in words); the case\'s two sentences with Light Fingers; staggered', () => {
    const fill = e => Clauses.fill(e.clause, Clauses.params(e.params, null, { depth: 1 }));
    assert.equal(json(R.order('PERKS').slice(0, 3)), json(['soft_soles', 'vanishing_act', 'light_fingers']));
    for (const id of ['soft_soles', 'vanishing_act', 'light_fingers']) {
      const e = R.PERKS[id];
      assert.equal(json([e.built, e.ready, e.tests, e.inv, e.family]), json(['M4', true, ['behaviour/perks-a.test.js'], 'perks-a', 'guarded']), id);
      assert.ok(C.Perks.added(id), `${id} registers its rules`);
      assert.ok(!/[0-9]/.test(e.clause.replace(/\{[^}]*\}/g, '')), `${id}: a digit in "${e.clause}"`);
    }
    assert.equal(fill(R.PERKS.soft_soles), `Your ring is ${N.PERK_SOFT_SOLES[0]} smaller, or ${N.PERK_SOFT_SOLES[1]} smaller at the second rank, but never below ${N.RING_MIN}.`);
    assert.equal(fill(R.PERKS.vanishing_act), `A hunter (never the Night Watchman, which never searches) that would search for you after ${N.LOSE_TRACK_TURNS} turns out of sight of you searches at its first action out of sight instead, where it last knew you were; at the second rank it then loses its next action.`);
    assert.equal(fill(R.PERKS.light_fingers), `Opening a case takes you ${N.PERK_LIGHT_FINGERS_COST} ticks and makes no noise; it is still an opening, so what wakes when its case is opened still wakes, and a mimic still grips you. At the second rank you also open case locks up to one grade above yours, but never a staff door.`);
    // "one grade above yours" is PERK_LIGHT_FINGERS_ABOVE, tied for the word rules.
    assert.equal(N.PERK_LIGHT_FINGERS_ABOVE, 1);
    assert.equal(json(R.PERKS.light_fingers.phrases), json({ 'one grade above yours': 'N:PERK_LIGHT_FINGERS_ABOVE' }));
    assert.equal(fill(R.CLAUSES.case_light_fingers), `Opens for ${N.PERK_LIGHT_FINGERS_COST} ticks and no noise, with your Light Fingers, if your grade reaches its lock.`);
    assert.equal(fill(R.CLAUSES.case_light_fingers2), `Opens for ${N.PERK_LIGHT_FINGERS_COST} ticks and no noise, with your Light Fingers, if its lock is your grade or up to one grade above yours.`);
    // staggered: its words, its clause (continuing another's), its pictogram's id, its rule.
    const st = R.STATUSES.staggered;
    assert.equal(json([st.built, st.ready, st.inv, st.icon, st.harmful, st.words, st.clause]), json(['M4', true, 'perks-a', 'staggered', true, 'staggered', 'loses its next action, and only waits instead']));
    assert.ok(C.Status.defined().includes('staggered'));
    // "its next action": one turn, so one decision (a wait takes a turn at least).
    assert.equal(N.STAGGER_TURNS, 1);
  });

  // ---- Soft Soles ----

  // You at (2, 2), stepping south and back, or waiting; a sleeper at walking distance `ring`
  // from both tiles you stand on (your ring with the perk), and one a tile further.
  const OPEN = ['############', '#..........#', '#..........#', '#..........#', '#..........#', '############'];
  const ringOf = (params, rank, still) => Math.max(params.min, (still ? N.RING_STILL : N.RING_MOVING) - (rank === 1 ? params.r1 : params.r2));
  const softSoles = (rank, still) => H.scenario({
    name: `Soft Soles at rank ${rank}: your ring ${still ? 'standing still' : 'moving'} is that much smaller, never below RING_MIN`,
    id: 'PERKS.soft_soles', clone: true,
    build(params, sp, depth, opts) {
      const ring = ringOf(params, rank, still);
      return hold(C.Setup.room(opts.seed, { acc: 'T0', depth, map: OPEN, you: [2, 2], exhibits: [
        { sp: 'dummy', at: [2 + ring, 2], mode: 'dormant', pips: 0, stats: TOUGH },
        { sp: 'dummy', at: [3 + ring, 2], mode: 'dormant', pips: 0, stats: TOUGH }] }, { rulesOff: opts.rulesOff }), 'soft_soles', rank);
    },
    actions: still ? waits(2) : [{ a: 'move', dir: 4 }, { a: 'move', dir: 0 }],
    expect(r, params) {
      const ring = ringOf(params, rank, still), [, inner, outer] = r.state.actors;
      const pips = a => r.events.filter(e => e.k === 'pip' && e.who === a.uid && e.cause && e.cause.k === 'ring').length;
      if (Vision.ringRadius(r.state) !== ring) return `your ring is ${Vision.ringRadius(r.state)}, not ${ring}`;
      if (pips(inner) !== 2) return `the sleeper ${ring} tiles away gained ${pips(inner)} ring pips at the 2 boundaries, not 2`;
      if (pips(outer)) return `the sleeper ${ring + 1} tiles away, outside your ring, gained ${pips(outer)} ring pips`;
      return null;
    },
  });
  test('Soft Soles, joined up, at both ranks: your ring is PERK_SOFT_SOLES[rank − 1] smaller moving and standing still, never below RING_MIN, as the ring pips show; with it switched off they do not', () => {
    for (const rank of [1, 2]) for (const still of [false, true]) ok(H.sweep(C, softSoles(rank, still), DEPTHS), `rank ${rank}, ${still ? 'still' : 'moving'}`);
    // At the second rank, standing still, the ring would be 0: it is RING_MIN.
    assert.equal(N.RING_STILL - N.PERK_SOFT_SOLES[1] < N.RING_MIN, true);
  });

  // ---- Vanishing Act ----

  // A hunter at (2, 1) that last knew you at (6, 2), four steps away, hunting you though out of
  // sight since turn 0; you at (19, 3), far beyond its sight (SIGHT_EXHIBIT).
  const WIDE = ['######################', 'E....................#', '#....................#', '#....................#', '######################'];
  const HUNTER = { sp: 'dummy', at: [2, 1], mode: 'hunting', stats: TOUGH, lastKnown: [6, 2], sawYou: true, stim: 0 };
  const vanishRoom = (depth, opts, rank, extra, spec) => hold(C.Setup.room(opts.seed, Object.assign({ acc: 'T0', depth, map: WIDE, you: [19, 3],
    exhibits: [Object.assign({}, HUNTER, extra || {})] }, spec || {}), { rulesOff: opts.rulesOff, invulnerable: true }), 'vanishing_act', rank);
  // Its first lost event, and the ticks of its steps.
  const lostOf = (r, a) => r.events.find(e => e.k === 'lost' && e.who === a.uid) || null;
  const stepsOf = (r, a) => r.events.filter(e => e.k === 'moved' && e.who === a.uid).map(e => e.tick);
  // What a step and a wait cost it, as it is.
  const costs = (s, a) => [C.Actors.cost(s, a, N.COST_STEP, 'move'), C.Actors.cost(s, a, N.COST_WAIT, 'act')];
  // A hunter that vanished at its first action and took its first search step in it; at the
  // second rank, staggered at once and its next action lost (a wait between its first two
  // steps), and only that one; at the first, none lost.
  function vanished(r, a, rank) {
    const lost = lostOf(r, a), steps = stepsOf(r, a), [c, w] = costs(r.state, a);
    if (!lost || lost.cause.k !== 'vanished') return `it did not vanish: ${json(lost)}`;
    if (lost.from !== 'hunting' || lost.to !== 'searching') return `it went from ${lost.from} to ${lost.to}`;
    if (lost.tick !== 0 || steps[0] !== 0) return `it did not search at once at its first action (tick 0): lost at ${lost.tick}, its steps at ${json(steps)}`;
    const put = r.events.filter(e => e.k === 'status' && e.who === a.uid && e.id === 'staggered' && e.on);
    if (rank === 1) {
      if (put.length) return 'it was staggered at the first rank';
      return json(steps.slice(0, 3)) === json([0, c, 2 * c]) ? null : `its steps at ${json(steps)}, not one an action (${c} ticks each)`;
    }
    const at = r.events.indexOf(lost);
    if (put.length !== 1 || r.events[at + 1] !== put[0] || put[0].turns !== N.STAGGER_TURNS || put[0].cause.k !== 'perk' || put[0].cause.id !== 'vanishing_act') return `it was not at once staggered for ${N.STAGGER_TURNS} turns by Vanishing Act: ${json(put)}`;
    return json(steps.slice(0, 3)) === json([0, c + w, 2 * c + w]) ? null : `its steps at ${json(steps)}, not ${json([0, c + w, 2 * c + w])}: it lost no action, or more than its next`;
  }
  const vanish = rank => H.scenario({
    name: `Vanishing Act at rank ${rank}: a hunter out of sight searches at its first action${rank === 2 ? ', then loses its next action' : ''}`,
    id: 'PERKS.vanishing_act', clone: true,
    build: (params, sp, depth, opts) => vanishRoom(depth, opts, rank),
    actions: waits(6),
    expect: r => vanished(r, r.state.actors[1], rank),
  });
  test('Vanishing Act, joined up, at both ranks: a hunter out of sight of you searches at its first action (lost, vanished), not after LOSE_TRACK_TURNS, and at the second rank loses its next action (staggered); with it switched off it hunts on', () => {
    for (const rank of [1, 2]) ok(H.sweep(C, vanish(rank), DEPTHS), `rank ${rank}`);
    // Its sentence names the perk, never its id.
    const s = vanishRoom(3, { seed: 1, rulesOff: [] }, 2), ev = H.play(C, s, waits(2)).events;
    assert.equal(say(s, lostOf({ events: ev }, s.actors[1])), 'The training dummy lost sight of you and searches at once where it last knew you were: Vanishing Act.');
    assert.equal(say(s, ev.find(e => e.k === 'status' && e.on)), 'The training dummy is now staggered for 1 turn: Vanishing Act.');
  });

  // The night watch begins at the second boundary (clock B 1, G 1) and its Watchman comes in at
  // the entrance (0, 1), far out of your sight: it walks to you, never losing you, however long
  // you are out of its sight, while the hunter beside its way vanishes.
  const watch = rank => H.scenario({
    name: `Vanishing Act at rank ${rank} never touches the Night Watchman`,
    id: 'PERKS.vanishing_act', clone: true,
    build: (params, sp, depth, opts) => vanishRoom(depth, opts, rank, null, { clock: { B: 1, G: 1 }, entrance: [0, 1] }),
    actions: waits(12),
    expect(r) {
      const w = r.state.actors.find(a => a.arch === 'night_watchman');
      if (!w) return 'no Night Watchman came in';
      const touched = r.events.filter(e => (e.k === 'lost' || e.k === 'status' || e.k === 'alerted') && e.who === w.uid);
      if (touched.length) return `the Night Watchman was touched: ${json(touched)}`;
      const steps = r.events.filter(e => e.k === 'moved' && e.who === w.uid);
      if (steps.length < 5 || w.mode !== 'hunting') return `the Night Watchman took ${steps.length} steps toward you and is ${w.mode}`;
      return vanished(r, r.state.actors[1], rank);
    },
  });
  test('Vanishing Act never touches the Night Watchman, which never searches: at both ranks it comes for you out of sight, never lost or staggered, while an ordinary hunter vanishes', () => {
    for (const rank of [1, 2]) ok(H.sweep(C, watch(rank), DEPTHS), `rank ${rank}`);
  });

  // In an intact case it changes mode but only waits there, so it says it stays in its case.
  const CASED = WIDE.map((row, y) => (y === 1 ? row.slice(0, 2) + 'v' + row.slice(3) : row));
  const cased = H.scenario({
    name: 'Vanishing Act: a hunter in an intact case stops hunting at once, and says it stays in its case',
    id: 'PERKS.vanishing_act', clone: true,
    build: (params, sp, depth, opts) => hold(C.Setup.room(opts.seed, { acc: 'T0', depth, map: CASED, you: [19, 3], exhibits: [HUNTER],
      fixtures: [Cases.make({ x: 2, y: 1, room: 'room', num: `T.0.${depth}01.1`, glass: 1, lock: 1 })] }, { rulesOff: opts.rulesOff, invulnerable: true }), 'vanishing_act', 2),
    actions: waits(6),
    expect(r) {
      const a = r.state.actors[1], lost = lostOf(r, a);
      if (!lost || lost.cause.k !== 'vanished' || lost.cause.how !== 'case' || lost.tick !== 0) return `it did not stop hunting at once in its case: ${json(lost)}`;
      if (say(r.state, lost) !== 'The training dummy lost sight of you and stops hunting at once, but stays in its case: Vanishing Act.') return say(r.state, lost);
      return stepsOf(r, a).length || a.x !== 2 || a.y !== 1 ? `it left its case for ${a.x},${a.y}` : null;
    },
  });
  test('Vanishing Act: a hunter in an intact case stops hunting at once, and its sentence says it stays in its case (how case), never that it searches', () => {
    ok(H.sweep(C, cased, DEPTHS), cased.name);
  });

  // The healer (A.4's Countersigning Clerk, clockwork and all) waits where it is for
  // LOSE_TRACK_TURNS after it last saw you (§8.1); with Vanishing Act it waits none, and
  // searches at its first action by its mode (the first is its clockwork arrow's).
  const healer = rank => H.scenario({
    name: `Vanishing Act at rank ${rank}: the healer out of sight of you searches at once, not after its wait`,
    id: 'PERKS.vanishing_act', clone: true,
    build: (params, sp, depth, opts) => vanishRoom(depth, opts, rank, { sp: sp.id, stats: Roles.stats(sp.role, depth) }),
    actions: waits(4),
    expect(r) {
      const a = r.state.actors[1], lost = lostOf(r, a);
      if (!lost || lost.cause.k !== 'vanished' || lost.turn > 1) return `it did not search at once: ${json(lost)}`;
      const put = r.events.filter(e => e.k === 'status' && e.who === a.uid && e.id === 'staggered' && e.on);
      return put.length === (rank === 2 ? 1 : 0) ? null : `staggered ${put.length} times at rank ${rank}`;
    },
  });
  test('Vanishing Act: the healer, which waits LOSE_TRACK_TURNS out of sight before it searches, searches at once at both ranks; with the perk off it waits', () => {
    const list = H.species(C, 'conservator_healer').filter(x => x.sp.id === 'A4.5');
    assert.equal(list.length, 7);
    for (const rank of [1, 2]) ok(H.sweep(C, healer(rank), list), `rank ${rank}`);
  });

  // The timing (§8.1): staggered for STAGGER_TURNS turns from its next decision, a hunter loses
  // exactly that decision, whatever its speed: a step of 50 (fast), 100 or 200 ticks (slow), its
  // every action doubled (slowed), and both. Each decision of the hunter is logged with whether
  // it was a forced wait (Status.skips), by wrapping AI.act, through which step() asks it.
  function decisions(X, rank, extra) {
    const log = [], act = X.AI.act;
    X.AI.act = (s, a, ev) => { if (a.uid !== 'you' && a.sp === 'dummy') log.push([s.tick, X.Status.skips(s, a)]); return act(s, a, ev); };
    try {
      const s = hold(X.Setup.room(1, { acc: 'T0', depth: 3, map: WIDE, you: [19, 3], exhibits: [Object.assign({}, HUNTER, extra)] }, { invulnerable: true }), 'vanishing_act', rank);
      const r = H.play(X, s, waits(8));
      return { log, r };
    } finally { X.AI.act = act; }
  }
  const SPEEDS = [['as usual', {}], ['fast', { speed: 'fast' }], ['slow', { speed: 'slow' }], ['slowed', { statuses: [{ id: 'slowed', turns: 30 }] }],
    ['fast and slowed', { speed: 'fast', statuses: [{ id: 'slowed', turns: 30 }] }]];
  test('staggered keeps its timing: put on at its first action, a hunter of any speed, fast, slow or slowed, loses exactly its next action and acts at the one after; with the perk off it loses none', () => {
    for (const [what, extra] of SPEEDS) {
      const { log, r } = decisions(C, 2, extra);
      assert.deepEqual(r.violations.map(v => v.text), [], what);
      assert.equal(json(log.slice(0, 4).map(([, skip]) => skip)), json([false, true, false, false]), `${what}: its decisions ${json(log)}`);
      assert.equal(log.filter(([, skip]) => skip).length, 1, `${what}: ${json(log)}`);
      const off = decisions(C, 0, extra);
      assert.equal(off.log.filter(([, skip]) => skip).length, 0, `${what}, the perk not held: ${json(off.log)}`);
    }
    // Planted: a staggered of two turns would cost a hunter of the usual speed two actions, which
    // the clause ("its next action") does not say: the invariant catches it.
    const P = loadCore(null, { numbers: { STAGGER_TURNS: 2 } }), { log, r } = decisions(P, 2, {});
    assert.equal(log.filter(([, skip]) => skip).length, 2, json(log));
    assert.ok(r.violations.some(v => v.inv === 'perks_a.staggered'), json(r.violations.map(v => v.text)));
  });

  // ---- Light Fingers ----

  // You at (3, 1), beside a Plate case at (3, 2) holding a sleeper whose trigger is touch_case; a
  // second sleeper at (3, 5), 3 walking tiles from the case, within a soft noise's reach, and 4
  // from you, outside your ring. The case's lock is your grade, or at the second rank, one grade
  // above it.
  const CASE = ['##########', '#........#', '#..v.....#', '#........#', '#........#', '#........#', '##########'];
  const NEAR = [3, 5];
  const glassFor = lock => lock <= N.GLASS_LOCK_MAX[0] ? 1 : lock <= N.GLASS_LOCK_MAX[1] ? 2 : 3;
  const gradeAt = depth => Math.min(N.GRADE_MAX - 1, depth);
  const caseRoom = (depth, opts, rank, lock) => hold(C.Setup.room(opts.seed, { acc: 'T0', depth, map: CASE, you: [3, 1], grade: gradeAt(depth),
    exhibits: [{ sp: 'dummy', at: [3, 2], mode: 'dormant', pips: 0, stats: TOUGH, trigger: 'touch_case' }, { sp: 'dummy', at: NEAR, mode: 'dormant', pips: 0, stats: TOUGH }],
    fixtures: [Cases.make({ x: 3, y: 2, room: 'room', num: `T.0.${depth}01.1`, glass: glassFor(lock), lock })] }, { rulesOff: opts.rulesOff, invulnerable: true }), 'light_fingers', rank);
  // The case's opening sentence as its label's Behaviour line reads, worked out from BUILD.
  const LF = rank => rank === 1 ? 'if your grade reaches its lock.' : 'if its lock is your grade or up to one grade above yours.';
  const said = (open, rank) => `Opens for ${open} ticks and no noise, with your Light Fingers, ${LF(rank)}`;
  let nexts = [];
  const fingers = rank => H.scenario({
    name: `Light Fingers at rank ${rank}: opening a case${rank === 2 ? ' one grade above yours' : ''} costs its ticks and makes no noise, the touch made, and its label says so`,
    id: 'PERKS.light_fingers', clone: true,
    build: (params, sp, depth, opts) => caseRoom(depth, opts, rank, gradeAt(depth) + (rank === 2 ? N.PERK_LIGHT_FINGERS_ABOVE : 0)),
    actions: (s, i) => { if (i === 0) nexts = []; nexts.push(s.actors[0].next); return [{ a: 'open', x: 3, y: 2 }, WAIT][i] || null; },
    expect(r, params) {
      const e0 = r.steps[0].events, [, inside, near] = r.state.actors;
      if (!e0.some(e => e.k === 'case_opened' && e.by === 'you')) return `it did not open: ${json(e0)}`;
      if (nexts[1] - nexts[0] !== params.open) return `the open cost ${nexts[1] - nexts[0]} ticks, not ${params.open}`;
      const noise = e0.filter(e => e.k === 'noise');
      if (noise.length) return `the open made a noise: ${json(noise)}`;
      if (e0.some(e => e.k === 'pip' && e.who === near.uid)) return 'the sleeper beside it stirred';
      const woke = e0.find(e => e.k === 'woke' && e.who === inside.uid);
      if (!woke || woke.mode !== 'hunting' || woke.cause.k !== 'touch_case' || woke.cause.how !== 'opened') return `the touch did not wake what the case held, hunting: ${json(woke)}`;
      // Its label, before the open: what opening it costs you and that it makes no noise, and
      // whose grade opens its lock.
      const f = Cases.at(r.start, 3, 2), l = Labels.ofCase(r.start, f), g = gradeAt(r.depth), lock = f.lock;
      if (!l.behaviour.startsWith(said(params.open, rank) + ' A bash costs')) return `its label says "${l.behaviour}"`;
      const odds = lock > g ? `Your perks open its lock (${G(lock)}), above your grade (${G(g)}).` : `Your grade (${G(g)}) opens its lock (${G(lock)}).`;
      return l.odds[0] === odds && l.actions.some(a => a.id === 'open') ? null : `its label's odds read ${json(l.odds[0])}, not ${json(odds)}`;
    },
  });
  test('Light Fingers, joined up, at both ranks: opening a case costs PERK_LIGHT_FINGERS_COST ticks and makes no noise, though the touch still wakes what it held; at the second rank a lock one grade above yours opens; the label says so; with it switched off none of this holds', () => {
    for (const rank of [1, 2]) ok(H.sweep(C, fingers(rank), DEPTHS), `rank ${rank}`);
    // Without it, the open's soft noise reaches the sleeper placed to hear it, which stirs.
    for (const depth of H.DEPTHS) {
      const s = caseRoom(depth, { seed: 1, rulesOff: [] }, 0, gradeAt(depth)), near = s.actors[2];
      const ev = C.Step.step(s, { a: 'open', x: 3, y: 2 });
      assert.ok(ev.some(e => e.k === 'pip' && e.who === near.uid && e.cause.k === 'noise'), `depth ${depth}: ${json(ev.map(e => e.k))}`);
    }
  });

  test('Light Fingers at the second rank opens no lock two grades above yours, and never a staff door above your grade: both are refused, at depths 1–7, and the labels say so', () => {
    const STAFF = ['#########', '#...S...#', '#########'];
    for (const depth of H.DEPTHS) {
      const g = Math.min(N.GRADE_MAX - 2, depth), opts = { seed: depth, rulesOff: [] };
      // A case two grades above yours.
      const s = caseRoom(depth, opts, 2, g + 2); s.run.grade = g;
      const f = Cases.at(s, 3, 2), l = Labels.ofCase(s, f);
      assert.equal(json(C.Step.step(s, { a: 'open', x: 3, y: 2 }).map(e => e.reason)), json(['case_locked']), `depth ${depth}`);
      assert.equal(l.odds[0], `Its lock needs ${G(g + 2)}; you are ${G(g)}.`);
      assert.ok(!l.actions.some(a => a.id === 'open'), 'the label offers no open');
      // A staff door one grade above yours: a wall, as without the perk; its label is the same.
      const t = hold(C.Setup.room(depth, { acc: 'T0', depth, map: STAFF, you: [3, 1], grade: g, fixtures: [{ k: 'staff', x: 4, y: 1, grade: g + 1 }] }), 'light_fingers', 2);
      const d = C.Labels.ofStaffDoor(t, C.Cases.at(t, 4, 1)), u = C.Setup.room(depth, { acc: 'T0', depth, map: STAFF, you: [3, 1], grade: g, fixtures: [{ k: 'staff', x: 4, y: 1, grade: g + 1 }] });
      assert.equal(json(d), json(C.Labels.ofStaffDoor(u, C.Cases.at(u, 4, 1))), 'the staff door\'s label is the same with the perk');
      assert.equal(d.odds[0], `It needs ${G(g + 1)}; you are ${G(g)}, so to you it is a wall.`);
      const r = H.play(C, t, [{ a: 'move', dir: 2 }]);
      assert.deepEqual(r.violations.map(v => v.text), []);
      assert.equal(json(r.events.map(e => e.reason)), json(['staff_grade']), `depth ${depth}`);
      // With the perk, a case one grade above yours opens; switched off, it is refused.
      const on = caseRoom(depth, opts, 2, g + 1), off = caseRoom(depth, { seed: depth, rulesOff: ['light_fingers'] }, 2, g + 1);
      on.run.grade = off.run.grade = g;
      assert.ok(C.Step.step(on, { a: 'open', x: 3, y: 2 }).some(e => e.k === 'case_opened'));
      assert.equal(json(C.Step.step(off, { a: 'open', x: 3, y: 2 }).map(e => e.reason)), json(['case_locked']));
    }
  });

  // A mimic in its disguise, opened: it grips you and shows itself, as any opening does, with
  // no noise and at Light Fingers' cost (S.9's mimic, a pack species, at depths 1–7).
  const MROOM = ['#########', '#.......#', '#.+.....#', '#.......#', '#.......#', '#.......#', '#########'];
  const mimic = rank => H.scenario({
    name: `Light Fingers at rank ${rank}: a mimic opened still grips you and wakes, in silence`,
    id: 'PERKS.light_fingers', clone: true,
    build: (params, sp, depth, opts) => {
      const s = hold(C.Setup.room(opts.seed, { acc: 'T0', depth, map: MROOM, you: [3, 3], grade: N.GRADE_MAX,
        exhibits: [{ sp: sp.id, at: [4, 3], stats: Roles.stats(sp.role, depth) }] }, { rulesOff: opts.rulesOff, invulnerable: true }), 'light_fingers', rank);
      return s;
    },
    actions: (s, i) => { if (i === 0) nexts = []; nexts.push(s.actors[0].next); return [{ a: 'open', x: 4, y: 3 }, WAIT][i] || null; },
    expect(r, params) {
      const e0 = r.steps[0].events, m = r.state.actors[1];
      const grip = e0.find(e => e.k === 'status' && e.on && e.id === 'rooted' && e.who === 'you');
      const woke = e0.find(e => e.k === 'woke' && e.who === m.uid);
      if (!grip || !woke || woke.cause.k !== 'touch_case') return `the mimic did not grip you and wake at the touch: ${json(e0.map(e => e.k))}`;
      if (e0.some(e => e.k === 'noise')) return 'the open made a noise';
      return nexts[1] - nexts[0] === params.open ? null : `the open cost ${nexts[1] - nexts[0]} ticks, not ${params.open}`;
    },
  });
  test('Light Fingers keeps the touch: a mimic opened at either rank still grips you, shows itself and wakes, with no noise, for PERK_LIGHT_FINGERS_COST ticks', () => {
    const list = H.species(C, 'mimic_vitrine');
    assert.ok(list.length >= 7, json(list.map(x => x.sp.id)));
    for (const rank of [1, 2]) ok(H.sweep(C, mimic(rank), list), `rank ${rank}`);
  });

  // In the three departments, at depths 1, 4 and 7 (perks-a.inv.js holds every open of every run
  // to the same at every depth): beside each of the first 8 shut cases you could reach, its label's
  // Behaviour line says what opening it costs you and whether it makes a noise, and its offer to
  // open it whether you can; and that is what the open does. Without the perk, with it at each
  // rank, and with it held but switched off.
  test('a case\'s label says what opening it really costs you and whether it makes a noise, in every department at depths 1, 4 and 7: without Light Fingers, at each rank, and switched off', () => {
    const OPENS = /^Opens for (\d+) ticks and (a soft noise|no noise)(, with your Light Fingers,)? if /;
    let opened = 0, refusedN = 0;
    for (const acc of ['S9', 'A4', 'M11']) for (const depth of [1, 4, 7]) for (const [rank, off] of [[0, false], [1, false], [2, false], [2, true]]) {
      const s = C.Dept.create(depth, acc, depth, { carry: { perks: rank ? [{ id: 'light_fingers', rank }] : [] }, rulesOff: off ? ['light_fingers'] : [] });
      const counts = rank > 0 && !off;
      let n = 0;
      for (const f of s.dept.fixtures.filter(q => q.k === 'case' && q.st === 'shut')) {
        // A free floor tile beside it, north, east, south or west, where you then stand.
        const at = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => [f.x + dx, f.y + dy])
          .find(([x, y]) => Grid.ch(s.dept, x, y) === '.' && !C.Actors.at(s, x, y) && !Cases.at(s, x, y));
        if (!at || ++n > 8) continue;
        const t = C.State.clone(s);
        t.actors[0].x = at[0]; t.actors[0].y = at[1];
        const l = Labels.ofCase(t, Cases.at(t, f.x, f.y)), m = OPENS.exec(l.behaviour), where = `${acc} d${depth} rank ${rank}${off ? ' off' : ''}: the case at ${f.x},${f.y}`;
        assert.ok(m, `${where}: ${l.behaviour}`);
        assert.equal(Number(m[1]), counts ? N.PERK_LIGHT_FINGERS_COST : N.COST_OPEN_CASE, where);
        assert.equal(!!m[3], counts, where);
        const before = t.actors[0].next, ev = C.Step.step(t, { a: 'open', x: f.x, y: f.y });
        if (ev.length === 1 && ev[0].k === 'refused') {
          assert.equal(ev[0].reason, 'case_locked', where);
          assert.ok(!l.actions.some(a => a.id === 'open'), `${where}: its label offers an open that is refused`);
          refusedN++;
          continue;
        }
        assert.ok(l.actions.some(a => a.id === 'open'), `${where}: it opened, but its label offered no open`);
        const noise = ev.some(e => e.k === 'noise' && e.cause.k === 'case_opened' && e.cause.by === 'you');
        assert.equal(t.actors[0].next - before, Number(m[1]), `${where}: the open's ticks`);
        assert.equal(noise, m[2] === 'a soft noise', `${where}: the open's noise`);
        opened++;
      }
    }
    assert.ok(opened > 150 && refusedN > 20, `${opened} opened, ${refusedN} refused`);
  });

  // ---- All three, in real departments ----

  // The three perks held together at one rank (the first at depth 2, the second at depth 5), in
  // each department, its real exhibits of every archetype: beside each of its first sleepers you
  // could strike (you stand by it between steps, as a test may set a room), you strike it awake,
  // hunting you; then you stand far off, out of its sight, and wait. Every invariant is held
  // after every step; hunters lose you at once (vanished), and with the perks switched off
  // none does.
  function woken(acc, depth, rank, rulesOff) {
    const s0 = C.Dept.create(depth, acc, depth, { carry: { perks: ['soft_soles', 'vanishing_act', 'light_fingers'].map(id => ({ id, rank })) }, rulesOff });
    s0.actors[0].hp = s0.actors[0].maxHp = 999;
    const m = s0.dept, out = { violations: [], vanished: 0, out_of_sight: 0, struck: 0 };
    const free = (s, x, y) => Grid.ch(s.dept, x, y) === '.' && !C.Actors.at(s, x, y) && !Cases.at(s, x, y);
    for (let i = 1; i < s0.actors.length && out.struck < 4; i++) {
      // Each in the department as it was made (a copy of it).
      const s = C.State.clone(s0), a = s.actors[i];
      if (a.gone || a.mode !== 'dormant' || C.Cases.encased(s, a) || (a.size || 1) !== 1) continue;
      const at = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => [a.x + dx, a.y + dy]).find(([x, y]) => free(s, x, y));
      if (!at) continue;
      s.actors[0].x = at[0]; s.actors[0].y = at[1];
      const strike = { a: 'attack', uid: a.uid };
      if (!C.Step.legal(s).some(l => json(l) === json(strike))) continue;
      let r = H.play(C, s, [strike]);
      out.violations.push(...r.violations.map(v => v.text));
      if (a.gone || a.mode !== 'hunting') continue;
      out.struck++;
      // A floor tile far beyond its sight, where no one stands.
      let far = null;
      for (let y = 0; y < m.h && !far; y++) for (let x = 0; x < m.w && !far; x++) if (free(s, x, y) && Grid.chebyshev(x, y, a.x, a.y) > N.SIGHT_EXHIBIT + 2) far = [x, y];
      if (!far) continue;
      s.actors[0].x = far[0]; s.actors[0].y = far[1];
      r = H.play(C, s, waits(3));
      out.violations.push(...r.violations.map(v => v.text));
      for (const e of r.events) if (e.k === 'lost' && e.who === a.uid) { if (e.cause.k === 'vanished') out.vanished++; else if (e.cause.k === 'out_of_sight') out.out_of_sight++; }
    }
    return out;
  }
  test('the three perks together, in the three departments at depths 2 (the first rank) and 5 (the second): real hunters struck awake lose you at once once you are out of their sight, every invariant held after every step; with the perks switched off none does', () => {
    const OFF = ['soft_soles', 'vanishing_act', 'light_fingers'];
    let vanished = 0;
    for (const acc of ['S9', 'A4', 'M11']) for (const [depth, rank] of [[2, 1], [5, 2]]) {
      const on = woken(acc, depth, rank, []), off = woken(acc, depth, rank, OFF);
      assert.deepEqual(on.violations.slice(0, 3), [], `${acc} d${depth} rank ${rank}`);
      assert.equal(on.struck, 4, `${acc} d${depth}: ${on.struck} hunters struck awake`);
      assert.equal(on.out_of_sight, 0, `${acc} d${depth}: a hunter lost you after its turns out of sight`);
      assert.equal(off.vanished, 0, `${acc} d${depth}, the perks off: ${off.vanished} vanished`);
      vanished += on.vanished;
    }
    assert.ok(vanished >= 12, `${vanished} hunters vanished`);
  });
};
