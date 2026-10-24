#!/usr/bin/env node
// ACCESSION — headless sims (BUILD.md §10.2, §10.3): policies played over seeds, in an arena
// or a department, alone or paired on identical seeds, with every decision's reason logged
// and the run's coreHash, vmHash and seeds in its JSON. The core, the arena tool and the
// policies run in the hardened context (tools/core-context.js); this file only drives them
// and does the statistics (tools/stats.js), which need floating point.
//
//   Sim.run({make, policy, seed, options, cap, log, check, outcome, start, C?})
//       → {policy, seed, outcome, turns, hpLost, deaths, stopped, steps, refusals, violations,
//          error, reasons, reads, replay, startHash, endHash, events?}
//   Sim.paired(arena, pA, pB, seeds, {depth, sp, cap, check, log, options, C?})
//       → {arena, metric, seeds, a, b, stats, verdict}
//   Sim.runArena(arena, p, seed, opts) → one run, built and judged from the arena
//   Sim.single(arena, p, seeds, opts) → {arena, seeds, runs, summary}
//   node tools/sim.js --help
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { loadCore, coreFiles, root } = require('./core-context.js');
const Stats = require('./stats.js');
const Inv = require('./invariants.js');

const POLICY_DIR = path.join(root, 'tools', 'policies');
const ARENA_DIR = path.join(root, 'test', 'arena');
const README = path.join(POLICY_DIR, 'README.md');
const STUCK = 50;              // refusals in a row before a run is stopped as stuck
const DEPT_CAP = 1000;         // the default turn cap of a department run

// The policy files, lib.js and cards.js first, then the rest in name order.
function policyFiles(dir) {
  dir = dir || POLICY_DIR;
  const rest = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'lib.js' && f !== 'cards.js').sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) : [];
  return ['lib.js', 'cards.js', ...rest].map(f => path.join(dir, f));
}
// A hardened context with the core, the arena tool and every policy (plus extra files).
function load(extra) { return loadCore([path.join(root, 'tools', 'arena.js'), ...policyFiles(), ...(extra || [])]); }
let shared = null;
const context = () => shared || (shared = load());

// coreHash (§3.6: the source of js/core and content/ except viewmodel.js) and vmHash (that
// of viewmodel.js), from tools/core-hash.js when it is there; until then, FNV-1a over each
// file's path and source, in index.html's order. `from` says which.
function hashes(C) {
  C = C || context();
  const file = path.join(__dirname, 'core-hash.js');
  if (fs.existsSync(file)) {
    const H = require(file);
    if (H && typeof H.coreHash === 'function' && typeof H.vmHash === 'function') return { coreHash: H.coreHash(), vmHash: H.vmHash(), from: 'tools/core-hash.js' };
  }
  const src = f => f + '\n' + fs.readFileSync(path.join(root, f), 'utf8');
  const hex = h => (h >>> 0).toString(16).padStart(8, '0');
  const files = coreFiles().filter(f => f !== 'js/core/viewmodel.js');
  return { coreHash: hex(C.State.fnv1a(files.map(src).join('\n'))), vmHash: hex(C.State.fnv1a(src('js/core/viewmodel.js'))), from: 'tools/sim.js' };
}

// "1-200", "1,4,9-12" → [1, …, 200], [1, 4, 9, 10, 11, 12].
function parseSeeds(s) {
  const out = [];
  for (const part of String(s).split(',').filter(Boolean)) {
    const m = /^(-?\d+)(?:-(-?\d+))?$/.exec(part.trim());
    if (!m) throw new Error(`sim: seeds are written like 1-200 or 1,4,9-12, not ${s}`);
    const a = Number(m[1]), b = m[2] === undefined ? a : Number(m[2]);
    if (b < a) throw new Error(`sim: the seed range ${part} runs backwards`);
    for (let i = a; i <= b; i++) out.push(i);
  }
  if (!out.length) throw new Error('sim: no seeds');
  return out;
}

const clean = s => typeof s === 'string' && s.trim() !== '' && !/undefined|NaN|\[object/.test(s);
const plainOptions = o => ({ rulesOff: ((o && o.rulesOff) || []).slice(), without: ((o && o.without) || []).slice(), invulnerable: !!(o && o.invulnerable) });

// A policy as {name, policy}: an object with card and decide (named by opts.name), or a
// reference Policies.get resolves (in `group` first).
function resolve(C, ref, group, name) {
  if (ref && typeof ref === 'object' && typeof ref.decide === 'function') {
    const bad = C.Policies.check(name || 'the policy', ref);
    if (bad) throw new Error('sim: ' + bad);
    return { name: name || 'policy', policy: ref };
  }
  const r = C.Policies.get(ref, group);
  if (!r) throw new Error(`sim: no policy ${ref}${group ? ` (looked in ${group}, then basic)` : ''}; the policies are ${C.Policies.list().map(p => p.name).join(', ')}`);
  return { name: r.name, policy: r.policy };
}

// The outcome of a run with no arena (a department): done when the visit is over.
function plainOutcome(C, state, events) {
  const h = C.Arena.health(state, events), left = !!state.over && state.over.k === 'left';
  return { done: !!state.over, won: left, died: h.died, left, hpLost: h.hpLost, maxHp: h.maxHp, deaths: h.deaths, woken: C.Arena.woken(events), sleepers: null, turns: state.turn };
}

// One run: make(seed, options) → state; then, until the outcome is done, the visit is over,
// the turn cap is reached or the steps run out (cap × 10), the policy decides from what it
// sees and the step is taken. After every step the state must be plain data, and `check`
// (true for every invariant in test/behaviour/*.inv.js, or a checker(pre, action, events,
// post) → [violation]) is run. A policy's action that is not legal is refused by step()
// like a player's, and listed as a violation; 50 refusals in a row stop the run as stuck.
// replay is {coreHash, start, options, actions}: start says how the state was made.
function run(o) {
  const C = o.C || context();
  if (typeof o.make !== 'function') throw new Error('sim: run needs make(seed, options) → state');
  if (!Number.isInteger(o.seed)) throw new Error('sim: run needs a whole-number seed');
  const { name, policy } = resolve(C, o.policy, o.group, o.name);
  const options = plainOptions(o.options), seed = o.seed;
  const state = o.make(seed, options);
  const cap = o.cap || 200, maxSteps = o.maxSteps || cap * 10;
  const checker = o.check === true ? Inv.checker(C, Inv.load(C)) : typeof o.check === 'function' ? o.check : null;
  const outcomeOf = o.outcome || ((s, ev) => plainOutcome(C, s, ev));
  // The policy's own stream, on a holder of its own: never in the state.
  const rng = C.Rng.stream({ seed, rng: {} }, `policy/${name}/${seed}`);
  const events = [], reasons = [], actions = [], reads = [], violations = [];
  let last = [], steps = 0, refusals = 0, inRow = 0, stopped = null, error = null;
  const startHash = C.State.hash(state);
  for (;;) {
    const now = outcomeOf(state, events);
    if (now.won) { stopped = 'won'; break; }
    if (state.over) { stopped = state.over.k; break; }
    if (now.done) { stopped = 'done'; break; }
    if (state.turn >= cap) { stopped = 'cap'; break; }
    if (steps >= maxSteps) { stopped = 'steps'; break; }
    const obs = C.Obs.make(state, last, reads, rng);
    // The legal actions as they were shown, kept apart from what the policy is handed.
    const legal = obs.legal.map(l => C.State.canon(l));
    let d;
    try { d = policy.decide(obs); }
    catch (e) { error = `${name} failed to decide at turn ${state.turn}: ${(e && e.message) || e}`; stopped = 'error'; break; }
    if (!d || !d.action || typeof d.action !== 'object' || typeof d.action.a !== 'string') { error = `${name} decided no action at turn ${state.turn}`; stopped = 'error'; break; }
    if (!clean(d.reason)) { error = `${name} gave no reason in words for ${C.Obs.say(d.action)} at turn ${state.turn}`; stopped = 'error'; break; }
    const action = JSON.parse(JSON.stringify(d.action)), turn = state.turn;
    if (!legal.includes(C.State.canon(action))) violations.push({ id: 'policy', step: steps, text: `${name} chose ${C.Obs.say(action)} at turn ${turn}, which is not legal then` });
    const pre = checker ? C.State.clone(state) : null;
    const ev = C.Step.step(state, action);
    actions.push(action); reasons.push(`turn ${turn}: ${d.reason}`);
    for (const e of ev) events.push(e);
    last = ev; steps++;
    const bad = C.State.plainData(state);
    if (bad) { violations.push({ id: 'plain_data', step: steps - 1, text: `not plain data at ${bad} after ${C.Obs.say(action)}` }); stopped = 'error'; error = violations[violations.length - 1].text; break; }
    if (checker) for (const v of checker(pre, action, ev, state)) violations.push(Object.assign({ step: steps - 1 }, v));
    if (ev.length === 1 && ev[0].k === 'refused') { refusals++; if (++inRow >= STUCK) { stopped = 'stuck'; break; } } else inRow = 0;
  }
  const outcome = outcomeOf(state, events);
  const out = { policy: name, seed, outcome, turns: state.turn, hpLost: outcome.hpLost, deaths: outcome.deaths, stopped, steps, refusals,
    violations, error, reasons, reads, replay: { coreHash: o.coreHash || null, start: o.start || { seed }, options, actions },
    startHash, endHash: C.State.hash(state) };
  if (o.log) out.events = events;
  return out;
}

// An arena's spec from a spec, 'dummy', a path to a stamp, or an id in test/arena/.
function arenaSpec(C, ref) {
  if (ref && typeof ref === 'object' && Array.isArray(ref.map)) return ref;
  if (ref === 'dummy') return C.Arena.parse(C.Arena.DUMMY);
  const file = typeof ref === 'string' && fs.existsSync(ref) && fs.statSync(ref).isFile() ? ref : path.join(ARENA_DIR, `${ref}.txt`);
  if (!fs.existsSync(file)) throw new Error(`sim: no arena ${ref} (looked for ${path.relative(root, file)})`);
  return C.Arena.parse(fs.readFileSync(file, 'utf8'));
}

// One arm of a comparison: a policy with its own switches, "counter" or
// "counter@rules-off=marble+plaster,without=<uid>,invulnerable".
function arm(C, ref, group, base) {
  let pol = ref, own = {};
  if (typeof ref === 'string' && ref.includes('@')) {
    const at = ref.indexOf('@');
    pol = ref.slice(0, at);
    for (const sw of ref.slice(at + 1).split(',').filter(Boolean)) {
      const [k, v] = sw.split('=');
      if (k === 'rules-off') own.rulesOff = (own.rulesOff || []).concat(v.split('+').filter(Boolean));
      else if (k === 'without') own.without = (own.without || []).concat(v.split('+').filter(Boolean));
      else if (k === 'invulnerable' && v === undefined) own.invulnerable = true;
      else throw new Error(`sim: an arm's switch is rules-off=<id>, without=<uid> or invulnerable, not ${sw}`);
    }
  } else if (ref && typeof ref === 'object' && !ref.decide && ref.policy) { pol = ref.policy; own = ref.options || {}; }
  const r = resolve(C, pol, group, ref && ref.name);
  const b = plainOptions(base);
  const options = { rulesOff: b.rulesOff.concat(own.rulesOff || []), without: b.without.concat(own.without || []), invulnerable: b.invulnerable || !!own.invulnerable };
  return { label: typeof ref === 'string' ? ref : r.name, name: r.name, policy: r.policy, options, kit: r.policy.kit || null };
}

// What to run: an arena ({kind: 'arena', spec}) or a department ({kind: 'dept', acc}).
function target(C, where) {
  if (where && typeof where === 'object' && where.dept) {
    if (!C.Packs.get(where.dept)) throw new Error(`sim: no department ${where.dept}; the packs are ${C.Packs.list().map(p => p.acc).join(', ')}`);
    return { kind: 'dept', acc: where.dept, id: where.dept };
  }
  const spec = arenaSpec(C, where);
  return { kind: 'arena', spec, id: spec.arena };
}

// One arm on one seed, in the target. In an arena the depth, species and variant are the
// seed's (Arena.depthFor, speciesFor, variant) unless o.depth or o.sp fixes them; a
// department runs at o.depth (3).
function runOn(C, t, a, seed, o) {
  if (t.kind === 'dept') {
    const depth = o.depth || 3;
    const r = run({ C, make: (s, options) => C.Dept.create(s, t.acc, depth, options), policy: a.policy, name: a.name, seed, options: a.options,
      cap: o.cap || DEPT_CAP, check: o.check, log: o.log, coreHash: o.coreHash, start: { dept: t.acc, seed, depth } });
    return Object.assign(r, { depth, sp: null, variant: null });
  }
  const spec = t.spec, depth = o.depth || C.Arena.depthFor(spec, seed);
  const spRec = o.sp ? C.Packs.speciesFor(null, { sp: o.sp }) : C.Arena.speciesFor(spec, seed);
  if (o.sp && !spRec) throw new Error(`sim: no species ${o.sp}`);
  const variant = C.Arena.variant(spec, seed), opts = { depth, sp: spRec, variant, kit: a.kit };
  let goal = null;
  const r = run({ C, make: (s, options) => C.Arena.build(spec, s, Object.assign({}, opts, { options })), policy: a.policy, name: a.name, seed, options: a.options,
    cap: o.cap || spec.cap, check: o.check, log: o.log, coreHash: o.coreHash,
    outcome: (state, events) => C.Arena.outcome(spec, state, events, { goal: goal || (goal = C.Arena.goal(spec, state, { variant })) }),
    start: { arena: spec.arena, seed, depth, sp: spRec ? spRec.id : null, variant, kit: a.kit } });
  return Object.assign(r, { depth, sp: spRec ? spRec.id : null, variant });
}

const pct = v => v === null || v === undefined ? 'none' : `${(100 * v).toFixed(1)}%`;
const n2 = v => v === Infinity ? 'without bound' : v === -Infinity ? 'minus without bound' : v.toFixed(2);
const WORDS = { hpLost: 'HP lost', woken: 'exhibits woken', turns: 'turns taken' };

// The statistics of a comparison (§10.3), B against A over the seeds: HP lost, exhibits
// woken and turns as ratios of sums with the paired bootstrap, deaths (or would-be deaths,
// in invulnerable runs) with Newcombe; and
// the verdict for the arena's metric, in words. names: the two arms' names, for sentences.
function compare(id, A, B, metric, names) {
  names = names || ['A', 'B'];
  const col = (runs, k) => runs.map(r => r.outcome[k]);
  const ratio = (k, m) => Stats.compare(col(A, k), col(B, k), Object.assign({ path: `bootstrap/${id}/${k}` }, m ? { margin: m.pct / 100, at: m.at } : {}));
  const want = metric && metric.test === 'ratio' ? metric : null;
  const stats = {
    hpLost: ratio('hpLost', want && want.name === 'hpLost' ? want : null),
    woken: ratio('woken', want && want.name === 'woken' ? want : null),
    turns: ratio('turns', want && want.name === 'turns' ? want : null),
    // A death, or in an invulnerable run a blow that would have killed you.
    died: Stats.lowerRate(Stats.pairs(A.map(r => r.outcome.deaths > 0), B.map(r => r.outcome.deaths > 0))),
    won: { a: A.filter(r => r.outcome.won).length, b: B.filter(r => r.outcome.won).length, n: A.length },
  };
  let verdict = null;
  const [a, b] = names, named = r => r.replace(/\bA's\b/g, a + "'s").replace(/\bB's\b/g, b + "'s");
  if (metric && metric.test === 'ratio') {
    const s = stats[metric.name], w = WORDS[metric.name], sign = metric.at === 'most' ? 'at most' : 'at least';
    const est = s.ratio === null ? `${a} has no ${w} over ${s.n} seeds, so there is no ratio of ${b}'s to ${a}'s`
      : `${b}'s ${w} over ${a}'s is ${n2(s.ratio)} (95% interval ${n2(s.ratioLo)} to ${n2(s.ratioHi)}) over ${s.n} seeds, and the mean per-seed difference is ${n2(s.mean)} (95% interval ${n2(s.lo)} to ${n2(s.hi)})`;
    verdict = { metric: `${metric.name} ${metric.at === 'most' ? '<=' : '>='} ${metric.pct}%`, pass: s.pass, reason: s.reason,
      sentence: `${id}: ${est}; against a margin of ${sign} ${metric.pct}% that is ${s.pass ? 'a pass' : 'not a pass'}, because ${named(s.reason)}.` };
  } else if (metric && metric.test === 'lower') {
    const s = stats.died;
    verdict = { metric: 'died lower', pass: s.pass, reason: s.reason,
      sentence: `${id}: ${a} died on ${s.a + s.b} of ${s.n} seeds (${pct(s.pA)}) and ${b} on ${s.a + s.c} (${pct(s.pB)}); the difference is ${n2(s.diff)} (95% Newcombe interval ${n2(s.lo)} to ${n2(s.hi)}), which is ${s.pass ? 'a pass' : 'not a pass'}, because ${named(s.reason)}.` };
  }
  return { stats, verdict };
}

// Two policies (or two option sets, as arms) on identical seeds (§10.3's pairing): the
// same seed builds the same room, with the same per-actor streams, for both.
function paired(where, pA, pB, seeds, o) {
  o = o || {};
  const C = o.C || context(), t = target(C, where), group = t.kind === 'arena' ? t.spec.arena : null;
  const coreHash = o.coreHash !== undefined ? o.coreHash : hashes(C).coreHash;
  const A = arm(C, pA, group, o.options), B = arm(C, pB, group, o.options);
  const runs = [[], []];
  for (const seed of seeds) for (const [k, a] of [[0, A], [1, B]]) runs[k].push(runOn(C, t, a, seed, Object.assign({}, o, { coreHash })));
  const metric = t.kind === 'arena' ? t.spec.metric : null;
  const { stats, verdict } = compare(t.id, runs[0], runs[1], metric, [A.name, B.name]);
  const side = (a, rs) => ({ name: a.name, label: a.label, options: a.options, kit: a.kit, card: C.Cards.text(a.name, a.policy), runs: rs });
  return { [t.kind]: t.id, metric, seeds: seeds.slice(), a: side(A, runs[0]), b: side(B, runs[1]), stats, verdict };
}

// One policy on one seed in an arena (or a department, {dept}), built and judged from it.
function runArena(where, p, seed, o) {
  o = o || {};
  const C = o.C || context(), t = target(C, where), a = arm(C, p, t.kind === 'arena' ? t.spec.arena : null, o.options);
  return runOn(C, t, a, seed, Object.assign({}, o, { coreHash: o.coreHash !== undefined ? o.coreHash : hashes(C).coreHash }));
}

// One policy over seeds, with its rates: won and died with Wilson intervals, and the mean
// HP lost.
function single(where, p, seeds, o) {
  o = o || {};
  const C = o.C || context(), t = target(C, where), group = t.kind === 'arena' ? t.spec.arena : null;
  const coreHash = o.coreHash !== undefined ? o.coreHash : hashes(C).coreHash;
  const a = arm(C, p, group, o.options);
  const runs = seeds.map(seed => runOn(C, t, a, seed, Object.assign({}, o, { coreHash })));
  const k = f => runs.filter(f).length, n = runs.length;
  const summary = { n, won: Object.assign({ k: k(r => r.outcome.won) }, Stats.wilson(k(r => r.outcome.won), n)), died: Object.assign({ k: k(r => r.outcome.died) }, Stats.wilson(k(r => r.outcome.died), n)),
    meanHpLost: runs.reduce((s, r) => s + r.hpLost, 0) / n, deaths: runs.reduce((s, r) => s + r.deaths, 0), violations: runs.reduce((s, r) => s + r.violations.length, 0) };
  return { [t.kind]: t.id, seeds: seeds.slice(), policy: a.name, options: a.options, card: C.Cards.text(a.name, a.policy), runs, summary };
}

const HELP = `node tools/sim.js — run policies headless over seeds (BUILD.md §10.2, §10.3)

Where:
  --arena <id|path>     an arena: an id in test/arena/ (<id>.txt), a stamp's path, or dummy
  --dept <acc>          a department visit (S9, A4, M11), at --depth (3)
What:
  --policy <name>       one policy: <group>.<name>, or a name in the arena's group, then basic
  --paired <A> <B>      two arms on identical seeds; an arm is a policy, optionally with its own
                        switches: counter@rules-off=marble+plaster,without=<uid>,invulnerable
Seeds and setting:
  --seeds <list>        1-200 or 1,4,9-12 (1-20); §10.3's gate uses 1-200
  --depth <d>           a fixed depth (an arena's own rotation otherwise)
  --species <id>        a fixed species for the arena's sp (its rotation otherwise)
  --cap <turns>         the turn cap (the arena's, else 200; a department's 1000)
Counterfactuals:
  --rules-off <ids>     switch rules off by id, comma-separated (modifiers in M3)
  --without <uids>      remove actors by uid, comma-separated
  --invulnerable        keep your HP at least 1, and count the would-be deaths
Output:
  --check               run every invariant (test/behaviour/*.inv.js) after every step
  --log                 include every event of every run
  --out <file>          write the JSON there (stdout otherwise); a summary goes to stderr
Cards:
  --cards               print tools/policies/README.md from the policies' cards
  --cards --write       write it
  --help                this
The JSON holds coreHash, vmHash, the seeds, and per run its outcome, its reasons (one line a
decision), what it read, any violations, and its replay.`;

function parseArgs(argv) {
  const o = { seeds: '1-20', rulesOff: [], without: [], invulnerable: false, check: false, log: false, cards: false, write: false, help: false };
  const need = (i, k) => { if (i >= argv.length || argv[i].startsWith('--')) throw new Error(`sim: ${k} needs a value`); return argv[i]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--arena') o.arena = need(++i, a);
    else if (a === '--dept') o.dept = need(++i, a);
    else if (a === '--policy') o.policy = need(++i, a);
    else if (a === '--paired') { o.paired = [need(++i, a), need(++i, a)]; }
    else if (a === '--seeds') o.seeds = need(++i, a);
    else if (a === '--depth') { o.depth = Number(need(++i, a)); if (!(Number.isInteger(o.depth) && o.depth >= 1 && o.depth <= 7)) throw new Error('sim: --depth is a whole number from 1 to 7'); }
    else if (a === '--species') o.sp = need(++i, a);
    else if (a === '--cap') { o.cap = Number(need(++i, a)); if (!(Number.isInteger(o.cap) && o.cap >= 1)) throw new Error('sim: --cap is a positive whole number of turns'); }
    else if (a === '--rules-off') o.rulesOff = o.rulesOff.concat(need(++i, a).split(',').filter(Boolean));
    else if (a === '--without') o.without = o.without.concat(need(++i, a).split(',').filter(Boolean));
    else if (a === '--invulnerable') o.invulnerable = true;
    else if (a === '--check') o.check = true;
    else if (a === '--log') o.log = true;
    else if (a === '--out') o.out = need(++i, a);
    else if (a === '--cards') o.cards = true;
    else if (a === '--write') o.write = true;
    else throw new Error(`sim: unknown flag ${a} (see --help)`);
  }
  return o;
}

function main(argv) {
  const o = parseArgs(argv);
  if (o.help || argv.length === 0) { console.log(HELP); return 0; }
  const C = context();
  if (o.cards) {
    const text = C.Cards.readme();
    if (o.write) { fs.writeFileSync(README, text); console.log(`sim: wrote ${path.relative(root, README)} (${C.Policies.list().length} policies)`); }
    else process.stdout.write(text);
    return 0;
  }
  if (!!o.arena === !!o.dept) throw new Error('sim: give one of --arena <id> and --dept <acc>');
  if (!!o.policy === !!o.paired) throw new Error('sim: give one of --policy <name> and --paired <A> <B>');
  const seeds = parseSeeds(o.seeds), where = o.arena || { dept: o.dept };
  const h = hashes(C), options = { rulesOff: o.rulesOff, without: o.without, invulnerable: o.invulnerable };
  const opts = { C, depth: o.depth, sp: o.sp, cap: o.cap, check: o.check, log: o.log, options, coreHash: h.coreHash };
  const body = o.paired ? paired(where, o.paired[0], o.paired[1], seeds, opts) : single(where, o.policy, seeds, opts);
  const out = Object.assign({ tool: 'sim', coreHash: h.coreHash, vmHash: h.vmHash, hashFrom: h.from, seeds, depth: o.depth || null, species: o.sp || null, cap: o.cap || null, options }, body);
  const json = JSON.stringify(out, null, 1) + '\n';
  if (o.out) fs.writeFileSync(o.out, json); else process.stdout.write(json);
  // The summary, in words, on stderr.
  if (body.verdict) console.error(body.verdict.sentence);
  else if (body.a) console.error(`${body.arena || body.dept}: ${body.a.name} won on ${body.stats.won.a} and ${body.b.name} on ${body.stats.won.b} of ${seeds.length} seeds; no metric is set, so there is no verdict.`);
  else console.error(`${body.arena || body.dept}: ${body.policy} won on ${body.summary.won.k} and died on ${body.summary.died.k} of ${seeds.length} seeds` +
    (o.invulnerable ? `, with ${body.summary.deaths} ${body.summary.deaths === 1 ? 'blow' : 'blows'} that would have killed it` : '') + `; mean HP lost ${body.summary.meanHpLost.toFixed(2)}; ${body.summary.violations} violations.`);
  return 0;
}

module.exports = { load, context, policyFiles, hashes, parseSeeds, parseArgs, resolve, run, runArena, paired, single, arenaSpec, arm, compare, HELP, README, POLICY_DIR, ARENA_DIR };
if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (e) { console.error((e && e.message) || String(e)); process.exitCode = 1; }
}
