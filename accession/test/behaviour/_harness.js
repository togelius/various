// ACCESSION — the Behaviour-line scenario harness (BUILD.md §5.3, checks 1–3). A scenario
// is written as a function of its clause's parameters and run for every species whose line
// has that clause, at every depth 1–7, with the invariants checked after every step.
// Behaviour tests require it: const H = require('./_harness.js').
//
//   play(C, state, actions, {inv, cap}) → {events, violations, steps, state, stopped}
//   scenario({name, id, build, actions, expect, seeds?, cap?, inv?}) → sc
//   run(C, sc, sp, depth, {seed, rulesOff, inv}) → result        (also sc.run(C, sp, depth, opts))
//   sweep(C, sc, list?, {rulesOff, inv}) → [result]                 every {sp, depth} × seed
//   failures(results) → [line]
//   sensitivity(C, sc, modifierId, list?) → {sensitive, problems, runs}
//   species(C, id, {depths, m4}) → [{sp, depth, acc}]
'use strict';
const Inv = require('../../tools/invariants.js');

const DEPTHS = [1, 2, 3, 4, 5, 6, 7];
const CAP = 200;                 // steps for actions given as a function (the arenas' turn cap, §10.3)
const message = e => (e && e.message) || String(e);

// Play actions on state with the invariants checked after every step.
//   actions: a list of actions, or a function (state, i, {events, last}) → action, or null
//     to stop; last is the previous step's events;
//   opts.inv: 'all' (the default: every test/behaviour/*.inv.js), false or [] for none, or
//     a list of ids, file ids or invariant objects (tools/invariants.js);
//   opts.cap: the most steps a function may take (CAP).
// It stops early when the visit is over. stopped is 'done', 'over' or 'cap'; steps is
// [{action, events}] in order; events is every step's events, concatenated.
function play(C, state, actions, opts) {
  opts = opts || {};
  const invs = Inv.select(C, opts.inv === undefined ? 'all' : opts.inv);
  const check = invs.length ? Inv.checker(C, invs) : null;
  const list = Array.isArray(actions) ? actions : null;
  if (!list && typeof actions !== 'function') throw new Error('play: actions must be a list or a function');
  const cap = opts.cap || CAP;
  const events = [], violations = [], steps = [];
  let stopped = 'done';
  for (let i = 0; ; i++) {
    if (list && i >= list.length) break;
    if (state.over) { stopped = 'over'; break; }
    if (!list && i >= cap) { stopped = 'cap'; break; }
    const action = list ? list[i] : actions(state, i, { events, last: steps.length ? steps[steps.length - 1].events : [] });
    if (action === null || action === undefined) break;
    const pre = check ? C.State.clone(state) : null;
    const ev = C.Step.step(state, action);
    for (const e of ev) events.push(e);
    steps.push({ action, events: ev });
    if (check) for (const v of check(pre, action, ev, state)) violations.push(v);
  }
  return { events, violations, steps, state, stopped };
}

// A scenario. Its fields:
//   name     what it shows, in words;
//   id       the registry id of the clause it proves (an archetype, modifier, trigger,
//            special, status or wake clause); its parameters at the species and depth,
//            from Clauses.of, are the scenario's params; null for none;
//   build(params, sp, depth, {seed, rulesOff}) → state; pass rulesOff to Setup.room's
//            options so that a rule switched off is off from the start;
//   actions  as play() takes them; a function also gets {params, sp, depth} in its third
//            argument;
//   expect(result, params, sp, depth) → null, or a message saying what the clause promised
//            and what happened; it may also throw;
//   seeds    the seeds each species and depth is run with ([1]); cap (CAP); inv ('all').
function scenario(def) {
  if (!def || typeof def.name !== 'string' || !def.name) throw new Error('scenario: needs a name');
  const where = `scenario "${def.name}"`;
  if (def.id !== undefined && def.id !== null && typeof def.id !== 'string') throw new Error(`${where}: id must be a registry id`);
  if (typeof def.build !== 'function') throw new Error(`${where}: needs build(params, sp, depth, opts) → state`);
  if (!Array.isArray(def.actions) && typeof def.actions !== 'function') throw new Error(`${where}: needs actions, a list or a function`);
  if (typeof def.expect !== 'function') throw new Error(`${where}: needs expect(result, params, sp, depth)`);
  const seeds = def.seeds === undefined ? [1] : def.seeds;
  if (!Array.isArray(seeds) || !seeds.length || !seeds.every(Number.isInteger)) throw new Error(`${where}: seeds must be a list of integers`);
  const sc = { name: def.name, id: def.id || null, build: def.build, actions: def.actions, expect: def.expect, seeds: seeds.slice(),
    cap: def.cap || CAP, inv: def.inv === undefined ? 'all' : def.inv };
  sc.run = (C, sp, depth, opts) => run(C, sc, sp, depth, opts);
  return sc;
}

// The clause part's parameters for a species at a depth, as written (no rule switched off).
function paramsOf(C, id, sp, depth) {
  if (!id) return { params: {}, clause: null };
  if (!sp) throw new Error(`the clause ${id} needs a species`);
  const part = C.Clauses.of(sp, { depth, rulesOff: [] }).find(p => p.id === id);
  if (!part) throw new Error(`${sp.id}'s Behaviour line has no ${id} clause`);
  return { params: Object.assign({}, part.params), clause: part.text };
}

// Run a scenario once. opts: seed (the scenario's first), rulesOff (ids switched off, put
// into the built state's options as well as passed to build), inv (the scenario's).
// The result is {name, id, sp, depth, seed, rulesOff, params, clause, start (a clone of
// the built state), state, events, steps, violations, stopped, error, failure}, where
// failure is null when the scenario passed: otherwise the first invariant violation, the
// message from expect, or the error that stopped it (also in error).
function run(C, sc, sp, depth, opts) {
  opts = opts || {};
  const rulesOff = (opts.rulesOff || []).slice();
  const r = { name: sc.name, id: sc.id, sp: sp ? sp.id : null, depth, seed: opts.seed === undefined ? sc.seeds[0] : opts.seed, rulesOff,
    params: null, clause: null, start: null, state: null, events: [], steps: [], violations: [], stopped: null, error: null, failure: null };
  try {
    Object.assign(r, paramsOf(C, sc.id, sp, depth));
    const state = sc.build(r.params, sp, depth, { seed: r.seed, rulesOff: rulesOff.slice() });
    if (!state || !Array.isArray(state.actors)) throw new Error('build did not return a state');
    if (rulesOff.length) {
      state.options = Object.assign({ rulesOff: [], without: [], invulnerable: false }, state.options);
      for (const id of rulesOff) if (!state.options.rulesOff.includes(id)) state.options.rulesOff.push(id);
    }
    r.start = C.State.clone(state);
    const acts = Array.isArray(sc.actions) ? sc.actions : (s, i, c) => sc.actions(s, i, Object.assign({ params: r.params, sp, depth }, c));
    Object.assign(r, play(C, state, acts, { inv: opts.inv === undefined ? sc.inv : opts.inv, cap: sc.cap }));
  } catch (e) {
    r.error = message(e);
    r.failure = 'threw ' + r.error;
    return r;
  }
  if (r.violations.length) {
    r.failure = r.violations[0].text + (r.violations.length > 1 ? ` (and ${r.violations.length - 1} more)` : '');
    return r;
  }
  try {
    const m = sc.expect(r, r.params, sp, depth);
    if (m !== null && m !== undefined) r.failure = typeof m === 'string' && m ? m : `expect returned ${JSON.stringify(m)}, not null or a message`;
  } catch (e) { r.failure = message(e); }
  return r;
}

// One line for a result: the scenario, the species, the depth and the seed, then what failed.
function describe(r) {
  return `${r.name} [${r.sp || 'no species'}, depth ${r.depth}, seed ${r.seed}${r.rulesOff.length ? ', rulesOff ' + r.rulesOff.join(',') : ''}]` +
    (r.failure ? ': ' + r.failure : ': passed');
}

// Run a scenario for every {sp, depth} in list (by default species(C, sc.id)), once per
// seed, with run()'s rulesOff and inv. An empty list throws: a sweep over nothing would
// pass without testing anything.
function sweep(C, sc, list, opts) {
  list = list || (sc.id ? species(C, sc.id) : null);
  if (!list || !list.length) throw new Error(`sweep: no species and depths to run "${sc.name}" for`);
  const out = [];
  for (const { sp, depth } of list) for (const seed of sc.seeds) out.push(run(C, sc, sp, depth, Object.assign({}, opts, { seed })));
  return out;
}

const failures = results => results.filter(r => r.failure).map(describe);

// Sensitivity (§5.3, check 3): the scenario passes as written, and fails in every run with
// modifierId switched off (rulesOff). The runs with the rule off check no invariants, since
// the line they read no longer has the clause; a run that throws with the rule off shows
// nothing and is a problem, not a failure. sensitive is true when there are no problems.
function sensitivity(C, sc, modifierId, list) {
  if (typeof modifierId !== 'string' || !modifierId) throw new Error('sensitivity: needs the id to switch off');
  list = list || species(C, sc.id || modifierId);
  if (!list.length) throw new Error(`sensitivity: no species and depths to run "${sc.name}" for`);
  const problems = [], runs = [];
  for (const { sp, depth } of list) for (const seed of sc.seeds) {
    const on = run(C, sc, sp, depth, { seed }), off = run(C, sc, sp, depth, { seed, rulesOff: [modifierId], inv: [] });
    runs.push({ sp: sp ? sp.id : null, depth, seed, on, off });
    if (on.failure) problems.push(`${describe(on)} (it must pass with the rule on)`);
    else if (off.error) problems.push(`${describe(off)} (with ${modifierId} switched off it threw, which shows nothing)`);
    else if (!off.failure) problems.push(`${describe(off)} with ${modifierId} switched off, so the scenario does not test it`);
  }
  return { sensitive: problems.length === 0, problems, runs };
}

// Every species whose Behaviour line has a part with this id, from the packs (and the
// shared species, once Packs.sharedList exists), at every depth 1–7 (opts.depths), as
// {sp, depth, acc}. The species records are the packs' own, so the fields by which a pack
// overrides a number (§5.2; modParams) apply. Species whose archetype M3 does not build are
// left out, as M3 departments leave them out (§5.5), unless opts.m4.
function species(C, id, opts) {
  opts = opts || {};
  const depths = opts.depths || DEPTHS, records = [];
  for (const p of C.Packs.list()) for (const sp of [...p.species, p.centrepiece]) if (sp) records.push({ sp, acc: p.acc });
  if (typeof C.Packs.sharedList === 'function') for (const sp of C.Packs.sharedList()) records.push({ sp, acc: null });
  const out = [];
  for (const { sp, acc } of records) {
    const arch = Object.prototype.hasOwnProperty.call(C.Registry.ARCHETYPES, sp.archetype) ? C.Registry.ARCHETYPES[sp.archetype] : null;
    const built = !!(arch && arch.built === 'M3');
    if (!built && !opts.m4) continue;
    // An M3 species' line always fills (lint-registry checks it), so an error there is
    // thrown; an unbuilt species whose line cannot be read simply uses nothing.
    let uses = sp.archetype === id;
    if (!uses && built) uses = C.Clauses.of(sp, { depth: depths[0], rulesOff: [] }).some(p => p.id === id);
    else if (!uses) { try { uses = C.Clauses.of(sp, { depth: depths[0], rulesOff: [] }).some(p => p.id === id); } catch (e) { uses = false; } }
    if (uses) for (const depth of depths) out.push({ sp, depth, acc });
  }
  return out;
}

module.exports = { DEPTHS, CAP, play, scenario, run, sweep, failures, describe, sensitivity, species };
