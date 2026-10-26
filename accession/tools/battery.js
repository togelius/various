#!/usr/bin/env node
// ACCESSION — the M3 sim battery (BUILD.md §10.3, the plan's D6.3): monkeys, the arenas'
// policies, wander and a soak, each step checked for everything M3's acceptance asks of it
// (§11's M3 row, criteria 3, 5 and 6). After every step of every run:
//   plain data       the state is plain data (§3.1);
//   cause            every event passes its kind's and its cause's schema (Causes.check, §3.4);
//   sentence         every event reads as a sentence (Text.event) with no "undefined", "NaN",
//                    "[object" or "null" in it (§0);
//   invariant        every Behaviour-line invariant in test/behaviour/*.inv.js (§5.3 check 1);
//   special_marks    every special's damage to you equals its mark on your tile in the view
//                    model taken before the step (criterion 3; a beam sent back by a reflector
//                    is its shooter's special, the mark's `by`);
//   completeness     no exhibit causes an event kind that is neither universal
//                    (Clauses.UNIVERSAL) nor covered by a clause of its Behaviour line (§5.3
//                    check 4, the soak half; who causes an event is CAUSER's rule below);
//   rng, causes      state.rng holds at most 150 streams (§3.2) and state.causes at most
//                    CAUSE_RECORDS (64) records (§3.4);
//   recap            at your death, Text.recap's killer, wake turn, wake trigger and hunt turn
//                    equal Recap.fromLog's, rebuilt from the run's full event log and its first
//                    state (criterion 6), and its lines read clean;
//   start_story      in a run's first state, an exhibit not dormant has the story a room, an
//                    arena or a department starts it with (§3.4): woke at that state's turn,
//                    'awake' if its trigger stands for the wake clause and 'placed' otherwise,
//                    and a hunter's hunt begun then for the same cause; Recap.fromLog reads it
//                    there, since no event tells it.
// A step that throws, a policy that fails (tools/sim.js's errors) and a policy's illegal action
// are violations too. Each violation keeps the replay that reaches it (up to its step), which
// `node tools/replay.js` plays and `node tools/report.js` shrinks to a crash card.
//
//   Battery.runs('short' | 'long', {C, arenaDir}) → [run]      the definitions (D6.3):
//     short (check-all): the test-room monkey on the golden seed for 2,000 actions; a 1,000-
//       action monkey per department at depth 3, seed 1; seed 1 of each arena found (a stamp
//       test/arena/<id>.txt whose policy file tools/policies/<id>.js registers <id>.naive and
//       <id>.counter), with both policies; a 1,000-turn invulnerable soak on M11 at depth 3,
//       which crosses the bell and the night watch;
//     long (per milestone): the golden monkey's 10,000 actions; 1,000-action monkeys in every
//       department at depths 1, 4 and 7, seeds 1–20; every arena found × both policies × seeds
//       1–200; wander in every department at depths 1–7, seeds 1–50; a 10,000-turn
//       invulnerable soak per department at depth 3.
//   Battery.run('short' | 'long' | [run], {C, parts, slice, onRun}) → report      runs them
//   Battery.arenas(C, dir?) → {ran: [id], skipped: [{id, why}]}
//   Battery.checks(C, {invs}) → {check(pre, action, events, post) → [violation], reset, tally}
//   Recap.fromLog(initialState, events) → {killer, wakeTurn, wakeTrigger, huntTurn} | null
//   node tools/battery.js short|long [--part monkey,arena,wander,soak] [--slice <a-b>]
//                                    [--gate <seconds>] [--json <file>] [--verbose]
// A run is {kind: 'monkey', room: 'T0' (or dept, depth), seed, actions} (visits restart on the
// next seed when one ends, as Monkey.run's do), {kind: 'soak', dept, depth, seed, turns} (the
// monkey, never leaving, with your HP kept at 1 or more), {kind: 'arena', arena, policy,
// seed} (tools/sim.js on the stamp, the arena's own depth and species for the seed), or
// {kind: 'wander', dept, depth, seed} (tools/sim.js, the wander policy, a 1,000-turn cap).
// The battery's time is measured and reported; check-all holds the short one to 60 s
// (test/m3-battery.test.js), and the long one's is reported, not held to anything.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { root } = require('./core-context.js');
const Sim = require('./sim.js');
const Inv = require('./invariants.js');

const ARENA_DIR = path.join(root, 'test', 'arena');
const POLICY_DIR = path.join(root, 'tools', 'policies');
const MONKEY = path.join(root, 'tools', 'monkey.js');
const GOLDEN_SEED = require('./golden.js').DEFAULTS.m0Monkey.seed;
const GATE_MS = 60000;      // the short battery's limit in check-all (D6.3)
const RNG_KEYS = 150;       // the most streams state.rng may hold (§3.2's soak bound)
const KEEP = 25;            // violations a run keeps in full; every one is counted
const PARTS = ['monkey', 'arena', 'wander', 'soak'];

// A hardened context with the core, tools/arena.js, tools/replay.js, every policy and the
// monkey (Sim.load), made once and shared, as the sim shares its own.
let shared = null;
const load = () => Sim.load([MONKEY]);
const context = () => shared || (shared = load());

const msg = e => (e && e.message) || String(e);
const clean = s => typeof s === 'string' && s.trim() !== '' && !/undefined|NaN|\[object|\bnull\b/.test(s);
const show = v => v === null || v === undefined ? 'none' : JSON.stringify(v);
const bump = (o, k, n) => { o[k] = (o[k] || 0) + (n === undefined ? 1 : n); };

// The arenas the battery runs: each stamp in dir (test/arena/) whose policy file
// tools/policies/<id>.js is there and registers both <id>.naive and <id>.counter; the others
// are skipped, with why.
function arenas(C, dir) {
  C = C || context();
  dir = dir || ARENA_DIR;
  const ids = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.txt')).map(f => f.slice(0, -4)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) : [];
  const ran = [], skipped = [];
  for (const id of ids) {
    const lacks = ['naive', 'counter'].filter(p => !C.Policies.get(`${id}.${p}`));
    if (!fs.existsSync(path.join(POLICY_DIR, `${id}.js`))) skipped.push({ id, why: `there is no tools/policies/${id}.js` });
    else if (lacks.length) skipped.push({ id, why: `tools/policies/${id}.js registers no ${lacks.map(p => `${id}.${p}`).join(' or ')}` });
    else ran.push(id);
  }
  return { ran, skipped, dir };
}

const range = (a, b) => { const out = []; for (let i = a; i <= b; i++) out.push(i); return out; };
// A run's name, in words.
function nameOf(r) {
  if (r.kind === 'arena') return `arena ${r.arena}, ${r.policy}, seed ${r.seed}`;
  if (r.kind === 'wander') return `wander in ${r.dept} at depth ${r.depth}, seed ${r.seed}`;
  if (r.kind === 'soak') return `soak in ${r.dept} at depth ${r.depth}, seed ${r.seed}, ${r.turns} turns`;
  return `monkey in ${r.room === 'T0' ? 'the test room' : `${r.dept} at depth ${r.depth}`}, seed ${r.seed}, ${r.actions} actions`;
}

// The battery's runs at a level (D6.3), in the order they are run.
function runs(level, opts) {
  opts = opts || {};
  const C = opts.C || context(), depts = C.Packs.list().map(p => p.acc), found = arenas(C, opts.arenaDir), out = [];
  const arena = (id, p, seed) => ({ kind: 'arena', arena: id, stamp: path.join(found.dir, `${id}.txt`), policy: p, seed });
  if (level === 'short') {
    out.push({ kind: 'monkey', room: 'T0', seed: GOLDEN_SEED, actions: 2000 });
    for (const d of depts) out.push({ kind: 'monkey', dept: d, depth: 3, seed: 1, actions: 1000 });
    for (const id of found.ran) for (const p of ['naive', 'counter']) out.push(arena(id, p, 1));
    out.push({ kind: 'soak', dept: 'M11', depth: 3, seed: 1, turns: 1000 });
  } else if (level === 'long') {
    out.push({ kind: 'monkey', room: 'T0', seed: GOLDEN_SEED, actions: 10000 });
    for (const d of depts) for (const depth of [1, 4, 7]) for (const seed of range(1, 20)) out.push({ kind: 'monkey', dept: d, depth, seed, actions: 1000 });
    for (const id of found.ran) for (const p of ['naive', 'counter']) for (const seed of range(1, 200)) out.push(arena(id, p, seed));
    for (const d of depts) for (const depth of range(1, 7)) for (const seed of range(1, 50)) out.push({ kind: 'wander', dept: d, depth, seed });
    for (const d of depts) out.push({ kind: 'soak', dept: d, depth: 3, seed: 1, turns: 10000 });
  } else throw new Error(`battery: the level is short or long, not ${level}`);
  for (const r of out) r.name = nameOf(r);
  return out;
}

// RECAP: the death recap rebuilt from the full event log (criterion 6), with no help from the
// state's stories or cause records. The killer is the `by` of your death's cause. Its waking
// is its last woke event (a creation's included: the Night Watchman, made mid-visit, has one,
// and a split half); its hunt began at its last hunting event, or at a creation woke into a
// hunt, whichever came last. An exhibit not dormant in the initial state was started awake by
// its room or arena (cause 'awake' or 'placed') or by its department ('awake'), which no event
// tells: until an event says otherwise, its waking and hunt are those the initial state gives.
const Recap = {
  fromLog(initial, events) {
    let died = null;
    for (const e of events) if (e.k === 'died' && e.who === 'you') died = e;
    if (!died) return null;
    const killer = died.cause && typeof died.cause.by === 'string' ? died.cause.by : null;
    let woke = null, hunt = null;
    if (killer !== null) for (const e of events) {
      if (e.who !== killer) continue;
      if (e.k === 'woke') { woke = { turn: e.turn, trigger: e.cause && e.cause.k }; if (e.was === null && e.mode === 'hunting') hunt = e.turn; }
      else if (e.k === 'hunting') hunt = e.turn;
    }
    const a0 = killer === null || !initial ? null : initial.actors.find(a => a.uid === killer) || null;
    const started = !!a0 && a0.mode !== 'dormant';
    if (!woke && started && a0.woke) woke = { turn: a0.woke.turn, trigger: a0.woke.cause ? a0.woke.cause.k : null };
    if (hunt === null && started && a0.hunted) hunt = a0.hunted.turn;
    return { killer, wakeTurn: woke ? woke.turn : null, wakeTrigger: woke ? woke.trigger : null, huntTurn: hunt };
  },
};
const RECAP_FIELDS = ['killer', 'wakeTurn', 'wakeTrigger', 'huntTurn'];

// CAUSER: who caused an event, for completeness. The cause's `by`, when it names someone (a
// blow's attacker, a grip's mimic, a call's herald, a cast's dust); else, for a kind whose
// subject acts, that subject (its `who`, or `by` for blows and cases). An event an actor only
// suffers (damaged, a status, a pip) is not caused by it.
const DOER = { moved: 'who', opened: 'who', closed: 'who', attacked: 'by', missed: 'by', telegraphed: 'who', special: 'who', waited: 'who',
  regenerated: 'who', case_opened: 'by', glass_cracked: 'by', glass_broke: 'by', took: 'who', dropped: 'who', equipped: 'who', used: 'who',
  entered: 'who', left: 'who', returned: 'who' };
function causer(e) {
  if (e.cause && typeof e.cause.by === 'string') return e.cause.by;
  const f = Object.prototype.hasOwnProperty.call(DOER, e.k) ? DOER[e.k] : null;
  return f && typeof e[f] === 'string' ? e[f] : null;
}

// The checks after every step (above), for one run: check(pre, action, events, post) →
// [{id, text, inv?}]. pre is a copy of the state before the step, post the state after it;
// the first pre it is given is the run's initial state, and it keeps the run's whole event
// log, so make one per run (or reset it). tally counts what was checked.
function checks(C, o) {
  o = o || {};
  const invs = o.invs || Inv.load(C), N = C.N;
  const tally = { steps: 0, events: 0, deaths: 0, recaps: 0, specials: 0, killers: {}, stages: {}, completeness: {} };
  const covers = new Map();
  let inv, initial, log, drawn;
  function reset() { inv = Inv.checker(C, invs); initial = null; log = []; drawn = []; }
  reset();

  // The event kinds an exhibit's Behaviour line allows it to cause: the universal ones and
  // those its line's parts cover, at the department's depth, with the visit's rules off.
  function allowed(sp, state) {
    const rulesOff = (state.options && state.options.rulesOff) || [], depth = state.dept.depth || 1, key = `${sp.id}|${depth}|${rulesOff.join('+')}`;
    if (!covers.has(key)) {
      const set = new Set(C.Clauses.UNIVERSAL);
      for (const p of C.Clauses.of(sp, { depth, rulesOff })) for (const k of p.covers) set.add(k);
      covers.set(key, set);
    }
    return covers.get(key);
  }
  // A run's first state: Recap.fromLog reads the starting story of an exhibit not dormant
  // there, which no event tells, so that story is held here to the rule a room, an arena or a
  // department starts it with (§3.4), not to itself: it woke at this state's turn, for the
  // cause 'awake' if its trigger stands for the wake clause ("It never sleeps.") and 'placed'
  // otherwise; a hunter began hunting then, for the same cause; one that does not hunt has no
  // hunt.
  function startStory(state, v) {
    const T = C.Registry.TRIGGERS;
    for (const a of state.actors) {
      if (a.uid === 'you' || a.gone || a.mode === 'dormant') continue;
      const trig = typeof a.trigger === 'string' && Object.prototype.hasOwnProperty.call(T, a.trigger) ? T[a.trigger] : null;
      const want = trig && trig.replacesWake ? 'awake' : 'placed', w = a.woke, h = a.hunted, k = w && w.cause ? w.cause.k : null;
      const says = s => s ? `${s.cause ? s.cause.k : 'no cause'} on turn ${s.turn}` : 'none';
      if (k !== want) v('start_story', `${a.uid} starts ${a.mode}, but its story says it woke ${k ? `by ${k}` : 'never'}, not '${want}', as a room or arena starts it`);
      else if (w.turn !== state.turn) v('start_story', `${a.uid} starts ${a.mode}, but its story says it woke on turn ${w.turn}, not on turn ${state.turn}, when the visit began`);
      else if (a.mode === 'hunting' && !(h && h.turn === state.turn && h.cause && h.cause.k === want)) v('start_story', `${a.uid} starts hunting, but its story's hunt is ${says(h)}, not ${want} on turn ${state.turn}`);
      else if (a.mode !== 'hunting' && h) v('start_story', `${a.uid} starts ${a.mode}, not hunting, but its story has a hunt: ${says(h)}`);
    }
  }
  function death(post, v) {
    tally.deaths++;
    let r = null;
    try { r = C.Text.recap(post, C.Labels.nameOf(post)); } catch (e) { v('recap', `Text.recap threw ${msg(e)}`); return; }
    if (!r) { v('recap', 'you died, and Text.recap gave no recap'); return; }
    const f = Recap.fromLog(initial, log), bad = [];
    for (const k of RECAP_FIELDS) if (r[k] !== f[k]) bad.push(`${k} is ${show(r[k])} where the log gives ${show(f[k])}`);
    if (bad.length) v('recap', `the death recap's ${bad.join(', and its ')}`);
    else { tally.recaps++; bump(tally.killers, f.wakeTrigger === null ? 'none' : f.wakeTrigger); }
    for (const l of r.lines || []) if (!clean(l)) v('recap', `a line of the recap reads ${JSON.stringify(l)}`);
  }
  function marks(pre, events, v) {
    let vm = null;
    for (const e of events) {
      if (e.k !== 'damaged' || e.who !== 'you' || !e.cause) continue;
      const c = e.cause, owner = c.k === 'special' ? c.by : c.k === 'reflected' && typeof c.sp === 'string' ? c.shooter : null;
      if (typeof owner !== 'string') continue;
      tally.specials++;
      if (!vm) {
        try { vm = C.ViewModel.derive(pre, { events: drawn }); } catch (err) { v('special_marks', `the view model before the step could not be made: ${msg(err)}`); return; }
      }
      const m = vm.marks.find(k => k.kind === 'telegraph' && k.x === c.x && k.y === c.y);
      const what = `${owner}'s ${c.sp} dealt you ${e.amount} on ${c.x},${c.y}`;
      if (!m) v('special_marks', `${what}, where the view model before the step showed no mark`);
      else if (m.by !== owner) v('special_marks', `${what}, where the view model before the step showed ${m.by}'s mark`);
      else if (m.dmg !== e.amount) v('special_marks', `${what}; its mark there in the view model before the step showed ${m.dmg}`);
    }
  }
  function check(pre, action, events, post) {
    const out = [], v = (id, text, extra) => out.push(Object.assign({ id, text }, extra || {}));
    if (!initial) { initial = pre; startStory(pre, v); }
    tally.steps++;
    const bad = C.State.plainData(post);
    if (bad) v('plain_data', `the state is not plain data at ${bad}`);
    let names = null;
    try { names = C.Labels.nameOf(post); } catch (e) { v('sentence', `Labels.nameOf threw ${msg(e)}`); }
    for (const e of events) {
      log.push(e);
      tally.events++;
      const kind = `${e.k}${e.cause && e.cause.k ? '.' + e.cause.k : ''}`;
      const wrong = C.Causes.check(e);
      if (wrong) v('cause', `${wrong}: ${JSON.stringify(e)}`);
      let said;
      try { said = C.Text.event(e, names); } catch (err) { said = `(Text.event threw ${msg(err)})`; }
      if (!clean(said)) v('sentence', `the ${kind} event reads ${JSON.stringify(said)}`);
      if (e.k === 'stage' && typeof e.stage === 'string') bump(tally.stages, e.stage);
      const uid = causer(e), a = uid && uid !== 'you' ? C.Actors.byUid(post, uid) : null, sp = a ? C.Packs.speciesFor(post, a) : null;
      if (sp && !allowed(sp, post).has(e.k)) {
        bump(tally.completeness, `${sp.id} ${e.k}`);
        v('completeness', `${uid} (${sp.id}) caused ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind} event, which is neither universal nor covered by a clause of its Behaviour line`);
      }
    }
    for (const x of inv(pre, action, events, post)) v('invariant', `${x.inv}: ${x.message}${x.uid ? ` (${x.uid}${x.sp ? ', ' + x.sp : ''})` : ''}`, { inv: x.inv });
    marks(pre, events, v);
    const keys = Object.keys(post.rng).length;
    if (keys > RNG_KEYS) v('rng', `state.rng holds ${keys} streams, more than ${RNG_KEYS}`);
    if (post.causes.length > N.CAUSE_RECORDS) v('causes', `state.causes holds ${post.causes.length} records, more than ${N.CAUSE_RECORDS}`);
    if (post.over && post.over.k === 'died' && !pre.over) death(post, v);
    if (post.tick !== pre.tick) drawn = events;
    return out;
  }
  return { check, reset, tally };
}

// One run's result, which its runner fills: {name, kind, steps, ms, visits, stopped, tally,
// violations (the count), problems (the first KEEP, each with the replay that reaches it)}.
function result(def) {
  return { name: def.name || nameOf(def), kind: def.kind, steps: 0, ms: 0, visits: 1, stopped: null, kinds: {}, legal: {}, tally: null, violations: 0, problems: [] };
}
const keep = (res, v, replay) => {
  res.violations++;
  if (res.problems.length < KEEP) res.problems.push(Object.assign({ run: res.name }, v, replay ? { replay } : {}));
};

// A monkey or a soak: the monkey's draws (Monkey.choose, on its own stream for the run's
// seed), a new visit on the next seed when one ends, as Monkey.run plays. A soak never
// leaves and keeps your HP at 1 or more, so it plays one visit through all its turns (it
// counts turns, not actions).
function monkeyRun(C, def, res, invs, coreHash) {
  const soak = def.kind === 'soak', options = { rulesOff: [], without: [], invulnerable: soak };
  const startOf = seed => def.room === 'T0' ? { seed, room: 'T0' } : { seed, dept: def.dept, depth: def.depth };
  const r = C.Monkey.stream(def.seed), weights = soak ? { leave: 0 } : null, chk = checks(C, { invs });
  let seed = def.seed, state = C.Replay.begin(startOf(seed), options), acts = [], turns = 0, last = state;
  const replay = () => ({ coreHash, start: startOf(seed), options, actions: acts.slice() });
  const next = () => { turns += state.turn; res.visits++; seed = def.seed + res.visits - 1; state = C.Replay.begin(startOf(seed), options); acts = []; chk.reset(); };
  while (soak ? turns + state.turn < def.turns : res.steps < def.actions) {
    const pre = C.State.clone(state), action = C.Monkey.choose(state, r, weights, res.legal);
    acts.push(action); res.steps++; bump(res.kinds, action.a);
    let ev;
    try { ev = C.Step.step(state, action); } catch (e) { keep(res, { id: 'threw', text: `step ${acts.length} of the visit on seed ${seed}, ${JSON.stringify(action)}, threw ${msg(e)} (${res.name})`, step: acts.length }, replay()); next(); continue; }
    let found;
    try { found = chk.check(pre, action, ev, state); } catch (e) { found = [{ id: 'threw', text: `the checks threw ${msg(e)}` }]; }
    for (const v of found) keep(res, Object.assign(v, { step: acts.length, text: `${v.text}, at step ${acts.length} of the visit on seed ${seed}, ${JSON.stringify(action)} (${res.name})` }), replay());
    // A state that is not plain data, or that the checks cannot read, cannot be played on.
    if (found.some(v => v.id === 'plain_data' || v.id === 'threw')) { res.stopped = 'error'; break; }
    // A monkey's visit ends as Monkey.run's do; a soak's only when it is over, since a room it
    // has cleared fills again at night (the Night Watchman comes back).
    last = state;
    if (soak ? !!state.over : C.Monkey.ended(state)) next();
  }
  res.turns = turns + state.turn;
  res.stopped = res.stopped || (soak ? 'turns' : 'actions');
  // The state after the last action (the visit it ended, if it ended one).
  try { res.finalHash = C.State.hash(last); } catch (e) { res.finalHash = null; }
  res.tally = chk.tally;
}

// An arena's policy, or wander in a department, through tools/sim.js with the checks as its
// check: Sim.run's own stops and violations (a policy's illegal action, an error) come too.
function simRun(C, def, res, invs, coreHash) {
  const chk = checks(C, { invs }), arena = def.kind === 'arena';
  let r;
  try {
    r = Sim.runArena(arena ? def.stamp || def.arena : { dept: def.dept }, arena ? `${def.arena}.${def.policy}` : 'wander.wander', def.seed,
      { C, depth: arena ? undefined : def.depth, check: chk.check, coreHash });
  } catch (e) {
    keep(res, { id: 'threw', text: `${res.name} threw ${msg(e)} after ${chk.tally.steps} steps; play it again with node tools/sim.js and --check to see the step` });
    res.tally = chk.tally;
    return;
  }
  const replayTo = step => ({ coreHash: r.replay.coreHash, start: r.replay.start, options: r.replay.options, actions: step ? r.replay.actions.slice(0, step) : r.replay.actions.slice() });
  const at = step => step ? `, at step ${step}, ${JSON.stringify(r.replay.actions[step - 1])}` : '';
  for (const v of r.violations) keep(res, Object.assign({ id: v.id || 'policy' }, v, { text: `${v.text}${v.id === 'policy' || v.id === 'without' ? '' : at(v.step)} (${res.name})` }), replayTo(v.step));
  if (r.stopped === 'error' && !r.violations.some(v => v.text === r.error)) keep(res, { id: 'error', text: r.error, step: r.steps }, replayTo(r.steps));
  for (const a of r.replay.actions) bump(res.kinds, a.a);
  res.steps = r.steps; res.turns = r.turns; res.stopped = r.stopped; res.depth = r.depth; res.sp = r.sp;
  res.finalHash = r.endHash;
  res.tally = chk.tally;
}

// Battery.run(level | [run], {C, parts, slice, onRun}) → report. parts keeps only runs of those
// kinds, and slice [a, b] only the a-th to the b-th of the level's runs (counted from 1), so a
// long battery can be run in pieces; onRun(result, i, n) is called after each run. The report
// holds every run's result and the totals, the arenas run and skipped, the time, and pass (no
// violation).
function run(level, opts) {
  opts = opts || {};
  const C = opts.C || context(), t0 = process.hrtime.bigint();
  const all = Array.isArray(level) ? level : runs(level, { C, arenaDir: opts.arenaDir });
  const list = all.filter((r, i) => (!opts.parts || opts.parts.includes(r.kind)) && (!opts.slice || (i + 1 >= opts.slice[0] && i + 1 <= opts.slice[1])));
  const found = arenas(C, opts.arenaDir), invs = Inv.load(C), hashes = Sim.hashes(C);
  const results = [];
  for (let i = 0; i < list.length; i++) {
    const def = list[i], res = result(def), t = process.hrtime.bigint();
    Object.assign(res, { seed: def.seed, arena: def.arena || null, policy: def.policy || null, dept: def.dept || null, depth: def.depth || null });
    if (def.kind === 'arena' || def.kind === 'wander') simRun(C, def, res, invs, hashes.coreHash);
    else if (def.kind === 'monkey' || def.kind === 'soak') monkeyRun(C, def, res, invs, hashes.coreHash);
    else throw new Error(`battery: a run is a monkey, a soak, an arena or wander, not ${def.kind}`);
    res.ms = Number(process.hrtime.bigint() - t) / 1e6;
    results.push(res);
    if (opts.onRun) opts.onRun(res, i, list.length);
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6, sum = k => results.reduce((s, r) => s + (r.tally ? r.tally[k] : 0), 0);
  const merge = k => { const o = {}; for (const r of results) if (r.tally) for (const [x, n] of Object.entries(r.tally[k])) bump(o, x, n); return o; };
  const kinds = {}, legal = {};
  for (const r of results) { for (const [x, n] of Object.entries(r.kinds)) bump(kinds, x, n); for (const [x, n] of Object.entries(r.legal)) bump(legal, x, n); }
  const steps = results.reduce((s, r) => s + r.steps, 0), violations = results.reduce((s, r) => s + r.violations, 0);
  const ran = [...new Set(list.filter(r => r.kind === 'arena').map(r => r.arena))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const report = {
    tool: 'battery', level: Array.isArray(level) ? 'custom' : level, coreHash: hashes.coreHash, vmHash: hashes.vmHash,
    runs: results.length, arenas: ran, skipped: found.skipped, steps, ms, msPerStep: steps ? ms / steps : 0,
    events: sum('events'), deaths: sum('deaths'), recaps: sum('recaps'), specials: sum('specials'),
    killers: merge('killers'), stages: merge('stages'), completeness: merge('completeness'), kinds, legal,
    violations, problems: [].concat(...results.map(r => r.problems)).slice(0, 2 * KEEP), results, pass: violations === 0,
  };
  report.sentence = sentence(report);
  return report;
}

// The report in words: what ran, how long it took, what was checked, what failed.
function sentence(r) {
  const n = x => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const list = xs => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
  const parts = [`${r.level} battery: ${n(r.runs)} ${r.runs === 1 ? 'run' : 'runs'}, ${n(r.steps)} steps in ${(r.ms / 1000).toFixed(1)} s (${r.msPerStep.toFixed(2)} ms a step)`];
  parts.push(r.arenas.length ? `arenas ${list(r.arenas)}` : 'no arenas');
  if (r.skipped.length) parts.push(`skipped ${list(r.skipped.map(s => `${s.id} (${s.why})`))}`);
  parts.push(!r.deaths ? 'no deaths' : `${n(r.deaths)} ${r.deaths === 1 ? 'death' : 'deaths'}, ${r.recaps === r.deaths ? (r.deaths === 1 ? 'its recap' : 'every recap') : `${n(r.recaps)} of the recaps`} equal to the one rebuilt from the log`);
  parts.push(!r.specials ? 'no special struck you' : `${n(r.specials)} ${r.specials === 1 ? 'special' : 'specials'} on you, checked against ${r.specials === 1 ? 'its mark' : 'their marks'}`);
  parts.push(`${n(r.events)} events`);
  const comp = Object.keys(r.completeness);
  // Criterion 5 asks for an empty completeness tally, so the sentence says so either way.
  parts.push(comp.length ? `completeness: ${list(comp.map(k => `${k} ×${r.completeness[k]}`))}` : 'an empty completeness tally');
  parts.push(r.violations ? `${n(r.violations)} ${r.violations === 1 ? 'violation' : 'violations'}, the first: ${r.problems[0].run}: ${r.problems[0].text}` : '0 violations');
  return parts.join('; ') + '.';
}

const USAGE = `node tools/battery.js short|long [--part monkey,arena,wander,soak] [--slice <a-b>] [--gate <seconds>] [--json <file>] [--verbose]
  short    check-all's battery: the golden monkey's first 2,000 actions, a monkey per department,
           seed 1 of each arena with both policies, a 1,000-turn soak (D6.3)
  long     the milestone's: monkeys at depths 1, 4 and 7, seeds 1-20; every arena x both policies
           x seeds 1-200; wander at depths 1-7, seeds 1-50; 10,000-turn soaks; its time is reported
  --part   only the runs of these kinds
  --slice  only the a-th to the b-th run of the level's list (from 1), to run it in pieces
  --gate   fail if it takes longer than this many seconds (check-all's short battery: 60)
  --json   write the whole report there
  --verbose  a line for every run (otherwise one for each run with a violation, and progress)
It prints the report in words and exits 1 on any violation, or past the gate.`;

function main(argv) {
  const level = argv.find(a => !a.startsWith('--') && (a === 'short' || a === 'long'));
  const at = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  if (!level || argv.includes('--help')) { console.log(USAGE); return level ? 0 : 1; }
  const parts = at('--part') ? at('--part').split(',') : null;
  if (parts) for (const p of parts) if (!PARTS.includes(p)) throw new Error(`battery: --part takes ${PARTS.join(', ')}, not ${p}`);
  const gate = at('--gate') !== undefined ? Number(at('--gate')) : null;
  if (gate !== null && !(gate > 0)) throw new Error('battery: --gate takes a number of seconds');
  const verbose = argv.includes('--verbose');
  let slice = null;
  if (at('--slice') !== undefined) {
    const m = /^(\d+)-(\d+)$/.exec(at('--slice'));
    if (!m || Number(m[1]) < 1 || Number(m[2]) < Number(m[1])) throw new Error('battery: --slice takes the first and last run to play, counted from 1, as 1-500');
    slice = [Number(m[1]), Number(m[2])];
  }
  let done = 0, bad = 0;
  const report = run(level, { parts, slice, onRun(res, i, n) {
    done++; bad += res.violations;
    if (verbose || res.violations) console.error(`${i + 1}/${n} ${res.name}: ${res.steps} steps, ${res.ms.toFixed(0)} ms, ${res.stopped}${res.violations ? `; ${res.violations} violations, the first: ${res.problems[0].text}` : ''}`);
    else if (done % 100 === 0) console.error(`${done}/${n} runs, ${bad} violations so far`);
  } });
  if (at('--json')) fs.writeFileSync(at('--json'), JSON.stringify(report, null, 1) + '\n');
  console.log(report.sentence);
  if (gate !== null && report.ms > gate * 1000) { console.log(`battery: ${(report.ms / 1000).toFixed(1)} s is over the gate of ${gate} s`); return 1; }
  return report.pass ? 0 : 1;
}

module.exports = { runs, run, arenas, checks, causer, Recap, context, load, sentence, nameOf, GATE_MS, RNG_KEYS, GOLDEN_SEED, PARTS, USAGE };
if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (e) { console.error(msg(e)); process.exitCode = 1; }
}
