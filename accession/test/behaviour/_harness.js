// ACCESSION — the Behaviour-line scenario harness (BUILD.md §5.3, checks 1–3). A scenario
// is written as a function of its clause's parameters and run for every species whose line
// has that clause, at every depth 1–7, with the invariants checked after every step.
// Behaviour tests require it: const H = require('./_harness.js').
//
//   play(C, state, actions, {inv, cap, clone}) → {events, violations, steps, state, stopped}
//   scenario({name, id, build, actions, expect, seeds?, cap?, inv?, clone?}) → sc
//   run(C, sc, sp, depth, {seed, rulesOff, inv, clone}) → result  (also sc.run(C, sp, depth, opts))
//   sweep(C, sc, list?, {rulesOff, inv}) → [result]                 every {sp, depth} × seed; a
//                                     modifier's scenario is also rerun with it off (§5.3)
//   failures(results) → [line]
//   sensitivity(C, sc, modifierId, list?) → {sensitive, problems, runs}
//   species(C, id, {depths, m4}) → [{sp, depth, acc}]
//   switchable(C, sc) → the modifier id rulesOff can switch off, or null
//   reruns(id) → how many runs, in this process, sweep() and sensitivity() made with id
//                switched off that failed as they must
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
//   opts.cap: the most steps a function may take (CAP);
//   opts.clone: also play the same actions on a twin of the state that is replaced by
//     State.clone after every step, and report a violation at the first step whose hash
//     differs (§3.5's clone stability, for a scenario).
// After every step the state must be plain data (§3.1), and every event must pass its cause
// schema (§3.4) and read as a clean sentence (Text.event), whatever the invariants: anything
// else is a violation. It stops early when the visit is over. stopped
// is 'done', 'over' or 'cap'; steps is [{action, events}] in order; events is every step's
// events, concatenated.
function play(C, state, actions, opts) {
  opts = opts || {};
  const invs = Inv.select(C, opts.inv === undefined ? 'all' : opts.inv);
  const check = invs.length ? Inv.checker(C, invs) : null;
  const list = Array.isArray(actions) ? actions : null;
  if (!list && typeof actions !== 'function') throw new Error('play: actions must be a list or a function');
  const cap = opts.cap || CAP;
  const events = [], violations = [], steps = [];
  let stopped = 'done', twin = opts.clone ? C.State.clone(state) : null;
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
    const bad = C.State.plainData(state);
    if (bad) { violations.push({ id: 'plain_data', text: `not plain data at ${bad} after step ${i} (${JSON.stringify(action)})` }); break; }
    // Every event passes its schema (§3.4), and has a sentence a player could be shown with
    // no gap in it (§0: nothing says "undefined", "NaN" or "[object").
    const names = C.Labels.nameOf(state);
    for (const e of ev) {
      const wrong = C.Causes.check(e);
      if (wrong) violations.push({ id: 'cause', text: `${wrong}, at step ${i} (${JSON.stringify(action)}): ${JSON.stringify(e)}` });
      const said = C.Text.event(e, names);
      if (typeof said !== 'string' || !said || /undefined|NaN|\[object|\bnull\b/.test(said)) violations.push({ id: 'sentence', text: `the ${e.k}${e.cause && e.cause.k ? '.' + e.cause.k : ''} event reads ${JSON.stringify(said)}, at step ${i} (${JSON.stringify(action)})` });
    }
    if (check) for (const v of check(pre, action, ev, state)) violations.push(v);
    if (twin) {
      C.Step.step(twin, action);
      twin = C.State.clone(twin);
      if (C.State.hash(twin) !== C.State.hash(state)) { violations.push({ id: 'clone', text: `a clone after every step differs from the state at step ${i} (${JSON.stringify(action)})` }); twin = null; }
    }
  }
  return { events, violations, steps, state, stopped };
}

// A scenario. Its fields:
//   name     what it shows, in words;
//   id       the registry id of the clause it proves (an archetype, modifier, trigger,
//            special, status or wake clause), or 'TABLE.id' for a clause no species' line
//            has (paramsOf); its parameters at the species and depth, from Clauses.of or
//            the registry, are the scenario's params; null for none;
//   build(params, sp, depth, {seed, rulesOff}) → state; pass rulesOff to Setup.room's
//            options so that a rule switched off is off from the start;
//   actions  as play() takes them; a function also gets {params, sp, depth} in its third
//            argument;
//   expect(result, params, sp, depth) → null, or a message saying what the clause promised
//            and what happened; it may also throw;
//   seeds    the seeds each species and depth is run with ([1]); cap (CAP); inv ('all');
//   clone    true to clone-check every run (play's opts.clone; false by default);
//   holdsWithout  for a scenario of a modifier's clause that holds with the modifier
//            switched off too (it shows what the modifier leaves as it is): why, in words;
//            sweep() reruns every other modifier scenario with its modifier off (§5.3).
function scenario(def) {
  if (!def || typeof def.name !== 'string' || !def.name) throw new Error('scenario: needs a name');
  const where = `scenario "${def.name}"`;
  if (def.id !== undefined && def.id !== null && typeof def.id !== 'string') throw new Error(`${where}: id must be a registry id`);
  if (typeof def.build !== 'function') throw new Error(`${where}: needs build(params, sp, depth, opts) → state`);
  if (!Array.isArray(def.actions) && typeof def.actions !== 'function') throw new Error(`${where}: needs actions, a list or a function`);
  if (typeof def.expect !== 'function') throw new Error(`${where}: needs expect(result, params, sp, depth)`);
  const seeds = def.seeds === undefined ? [1] : def.seeds;
  if (!Array.isArray(seeds) || !seeds.length || !seeds.every(Number.isInteger)) throw new Error(`${where}: seeds must be a list of integers`);
  if (def.holdsWithout !== undefined && def.holdsWithout !== null && (typeof def.holdsWithout !== 'string' || !def.holdsWithout)) throw new Error(`${where}: holdsWithout must say why it holds with its rule switched off`);
  const sc = { name: def.name, id: def.id || null, build: def.build, actions: def.actions, expect: def.expect, seeds: seeds.slice(),
    cap: def.cap || CAP, inv: def.inv === undefined ? 'all' : def.inv, clone: !!def.clone, holdsWithout: def.holdsWithout || null };
  sc.run = (C, sp, depth, opts) => run(C, sc, sp, depth, opts);
  return sc;
}

// A scenario's id names the clause it proves: a bare id (an archetype, modifier, trigger,
// special, status or wake clause) that a species' Behaviour line has, or a table-qualified
// one, 'TABLE.id', for a clause that belongs to no species' line (a status nothing in the
// packs inflicts, a surface, a consumable, an item's clause: §5.3's other clauses) or one
// whose bare id is ambiguous (fumigant is a surface and a consumable; tether is a trigger
// and a wake cause). A qualified id names its table: it matches only a line part that
// comes from that table (PART_KINDS: the kinds of part Clauses.of gives for its entries),
// so 'WAKE_CAUSES.tether' is never the trigger's part.
const qualified = id => { const m = /^([A-Z][A-Z_]*)\.(.+)$/.exec(id || ''); return m ? { table: m[1], id: m[2] } : null; };
const bare = id => { const q = qualified(id); return q ? q.id : id; };
const PART_KINDS = { ARCHETYPES: ['archetype'], SPECIALS: ['special'], STATUSES: ['status'], MODIFIERS: ['modifier'], TRIGGERS: ['trigger'], CLAUSES: ['wake', 'role'] };
// Whether a part of Clauses.of is the clause id names: the same id, and, for a qualified id,
// a part of its table's kind (none, for a table no line part comes from).
function isPart(id) {
  const q = qualified(id), want = bare(id), kinds = q ? (Object.prototype.hasOwnProperty.call(PART_KINDS, q.table) ? PART_KINDS[q.table] : []) : null;
  return p => p.id === want && (kinds === null || kinds.includes(p.kind));
}

// The clause part's parameters for a species at a depth, as written (no rule switched off):
// the part of the species' line with that id (of that table, for a qualified id); or, for
// a table-qualified id the line has no part for (or with no species), the registry entry's
// clause, filled at the depth.
function paramsOf(C, id, sp, depth) {
  if (!id) return { params: {}, clause: null };
  const q = qualified(id);
  if (!sp && !q) throw new Error(`the clause ${id} needs a species`);
  const part = sp ? C.Clauses.of(sp, { depth, rulesOff: [] }).find(isPart(id)) : null;
  if (part) return { params: Object.assign({}, part.params), clause: part.text };
  if (!q) throw new Error(`${sp.id}'s Behaviour line has no ${id} clause`);
  const R = C.Registry, e = R.TABLES.includes(q.table) && Object.prototype.hasOwnProperty.call(R[q.table], q.id) ? R[q.table][q.id] : null;
  if (!e) throw new Error(`the registry has no ${id}`);
  if (e.clause === undefined) return { params: {}, clause: null };
  const params = C.Clauses.params(e.params, sp, { depth });
  let clause = null;
  try { clause = C.Clauses.fill(e.clause, params); } catch (err) { clause = null; }
  return { params, clause };
}

// Run a scenario once. opts: seed (the scenario's first), rulesOff (ids switched off, passed
// to build, which must pass them on to Setup.room's options: a build that leaves one out of
// the state's options fails, since a rule switched off after the state is made is only half
// off, its speed for one being fixed at spawn), inv (the scenario's), clone (the scenario's).
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
    for (const id of rulesOff) if (!(state.options && state.options.rulesOff.includes(id))) throw new Error(`build must pass rulesOff to Setup.room's options: ${id} is not switched off in the state it built`);
    r.start = C.State.clone(state);
    const acts = Array.isArray(sc.actions) ? sc.actions : (s, i, c) => sc.actions(s, i, Object.assign({ params: r.params, sp, depth }, c));
    Object.assign(r, play(C, state, acts, { inv: opts.inv === undefined ? sc.inv : opts.inv, cap: sc.cap, clone: opts.clone === undefined ? sc.clone : opts.clone }));
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

// The rule a scenario's clause belongs to that rulesOff can switch off: a modifier built in
// M3 (and, from M4, a module), or null.
function switchable(C, sc) {
  const id = bare(sc.id), R = C.Registry, own = (t, k) => Object.prototype.hasOwnProperty.call(R[t], k);
  return id && ((own('MODIFIERS', id) && R.MODIFIERS[id].built === 'M3') || (own('MODULES', id) && R.MODULES[id].built === 'M3')) ? id : null;
}

// Run a scenario for every {sp, depth} in list (by default species(C, sc.id)), once per
// seed, with run()'s rulesOff and inv. An empty list throws: a sweep over nothing would
// pass without testing anything.
// A scenario of a modifier's clause is also rerun with that modifier switched off (§5.3,
// check 3), each run that passed with it on: with it off the run must fail, or the sweep
// gets a failure saying the scenario does not test the modifier. A scenario that shows what
// a modifier leaves as it is (marble's blows, the side opposite an old repair) holds with it
// off as well, and says so, with why, in holdsWithout; it is not rerun. (Not when the sweep
// is itself run with rules off.)
function sweep(C, sc, list, opts) {
  list = list || (sc.id ? species(C, sc.id) : null);
  if (!list || !list.length) throw new Error(`sweep: no species and depths to run "${sc.name}" for`);
  const out = [], rule = switchable(C, sc), check = rule && !sc.holdsWithout && !((opts && opts.rulesOff) || []).length;
  for (const { sp, depth } of list) for (const seed of sc.seeds) {
    const on = run(C, sc, sp, depth, Object.assign({}, opts, { seed }));
    out.push(on);
    if (!check || on.failure) continue;
    const off = run(C, sc, sp, depth, Object.assign({}, opts, { seed, rulesOff: [rule], inv: [] }));
    if (off.error || !off.failure) out.push(Object.assign({}, off, { failure: off.error ? `with ${rule} switched off it threw (${off.error}), which shows nothing` : `with ${rule} switched off it still passed, so it does not test ${rule}` }));
    else counted(rule);
  }
  return out;
}

// The reruns with a rule switched off that failed as they must, counted per rule id in this
// process (test/behaviour.test.js reads them: every M3 modifier must have some).
const RERUNS = new Map();
const counted = id => RERUNS.set(id, (RERUNS.get(id) || 0) + 1);
const reruns = id => RERUNS.get(id) || 0;

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
    else counted(modifierId);
  }
  return { sensitive: problems.length === 0, problems, runs };
}

// Every species whose Behaviour line has a part with this id (bare, or table-qualified: a
// part from that table, so a table no line part comes from gives none), from the packs and
// the shared species (Packs.sharedList: the Night Watchman), at every depth 1–7
// (opts.depths), as {sp, depth, acc}. The species records are the packs' own, so the fields by which a pack
// overrides a number (§5.2; modParams) apply. Species whose archetype M3 does not build are
// left out, as M3 departments leave them out (§5.5), unless opts.m4.
function species(C, id, opts) {
  opts = opts || {};
  const depths = opts.depths || DEPTHS, records = [];
  for (const p of C.Packs.list()) for (const sp of [...p.species, p.centrepiece]) if (sp) records.push({ sp, acc: p.acc });
  for (const sp of C.Packs.sharedList()) records.push({ sp, acc: null });
  const out = [];
  for (const { sp, acc } of records) {
    const arch = Object.prototype.hasOwnProperty.call(C.Registry.ARCHETYPES, sp.archetype) ? C.Registry.ARCHETYPES[sp.archetype] : null;
    const built = !!(arch && arch.built === 'M3');
    if (!built && !opts.m4) continue;
    // An M3 species' line always fills (lint-registry checks it), so an error there is
    // thrown; an unbuilt species whose line cannot be read simply uses nothing.
    const q = qualified(id), match = isPart(id);
    let uses = (!q || q.table === 'ARCHETYPES') && sp.archetype === bare(id);
    if (!uses && built) uses = C.Clauses.of(sp, { depth: depths[0], rulesOff: [] }).some(match);
    else if (!uses) { try { uses = C.Clauses.of(sp, { depth: depths[0], rulesOff: [] }).some(match); } catch (e) { uses = false; } }
    if (uses) for (const depth of depths) out.push({ sp, depth, acc });
  }
  return out;
}

module.exports = { DEPTHS, CAP, play, scenario, run, sweep, failures, describe, sensitivity, species, switchable, reruns };
