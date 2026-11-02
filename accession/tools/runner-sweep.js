#!/usr/bin/env node
// ACCESSION — the worst-case runner's sweep and gate (M4 plan D-RUNNER-EST, D-RUNNER, A1.4, D2.3,
// Q2, R2; BUILD.md §5.5, §10.3): for each department and seed s (at depth ((s − 1) mod 7) + 1),
// the department Dept.generate makes, LV11 (js/core/layout/runner.js) included, measured again
// by LRunner outside generation. It prints, per department, the share of seeds whose cheapest
// route costs at most each pct% of the runner's health under each charge (a, b, c), the seeds
// with no route at all, the runner's CPU time per department (and Dept.generate's beside it),
// (b) per depth, what wakes the fights of (b)'s failing routes, and the species the department
// does not place yet (their archetype, modifier or trigger still waiting).
// Usage: node tools/runner-sweep.js [--dept S9,A4,M11] [--seeds 1-200] [--pct 80,50]
//          [--runner hp] [--doors shut] [--chain off] [--timing off] [--off <module,…>] [--ready]
//          [--aside] [--check] [--moves n] [--json out.json] [--fails n]
//   --runner hp   the runner keeps the median's kit stats and loses only a grade's health;
//   --doors shut  wake regions with the doors as they stand, not every door open;
//   --chain off   no waking wakes another (no alarm, herald's call or ally_hit): D2.3's list;
//   --timing off  no patrol is timed: each sees everything it could on its round, at once;
//   --off m,…     the departments made with these modules switched off (rulesOff; population
//                 is the same under any switch, M4 plan A10);
//   --ready       plants every M4 archetype, modifier and trigger ready (as their packages
//                 will), so the waiting species are placed;
//   --aside       LV11 stood aside while departments are made (as in report mode, before
//                 D-RUNNER): the share passing is then the share LV11 accepts, unmoved, at the
//                 first attempt it judges;
//   --check       the gate (A1.4, R2): LV11 run again on every final department, fallbacks
//                 included, and the test's oracle (test/sweep/runner.check.js) on seeds 1–100;
//                 it prints the share passing at the first attempt LV11 judged (its moves
//                 included, and with none), the share at layout attempt 0, LV11's reseeds, the
//                 fallbacks, the moves and the exhibits removed, and exits 1 when any final
//                 department fails, the oracle disagrees, fewer than 90% pass at the first
//                 attempt, more than 1% fall back, or an exhibit is removed;
//   --moves n     prints the first n moves' sentences;
//   --fails n     prints the first n seeds failing (b) at the first pct, with their fights.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { loadCore } = require('./core-context.js');

const cpu = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };
const rank = (sorted, p) => sorted.length ? sorted[Math.max(0, Math.ceil(p * sorted.length / 100) - 1)] : 0;
const pctOf = (k, n) => n ? (100 * k / n).toFixed(1) : '-';
// The M4 archetypes, modifiers and triggers a gallery list waits for (as m4-packs plants them).
const M4_READY = { ARCHETYPES: ['unobserved_mover', 'patrol_guard', 'demonstrator', 'conservator_healer'], MODIFIERS: ['clockwork'], TRIGGERS: ['period'] };

function parse(argv) {
  const opt = { depts: ['S9', 'A4', 'M11'], from: 1, to: 200, pcts: [80, 50], runner: null, doors: null, chain: null, timing: null, off: [], ready: false, aside: false, check: false, moves: 0, json: null, fails: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = () => { if (i + 1 >= argv.length) throw new Error(`runner-sweep: ${a} needs a value`); return argv[++i]; };
    if (a === '--dept') opt.depts = v().split(',');
    else if (a === '--seeds') { const m = /^(\d+)-(\d+)$/.exec(v()); if (!m || +m[1] < 1 || +m[2] < +m[1]) throw new Error('runner-sweep: --seeds takes a range such as 1-200'); opt.from = +m[1]; opt.to = +m[2]; }
    else if (a === '--pct') opt.pcts = v().split(',').map(Number);
    else if (a === '--runner') { opt.runner = v(); if (opt.runner !== 'hp') throw new Error('runner-sweep: --runner takes hp'); }
    else if (a === '--doors') { opt.doors = v(); if (opt.doors !== 'shut') throw new Error('runner-sweep: --doors takes shut'); }
    else if (a === '--chain') { opt.chain = v(); if (opt.chain !== 'off') throw new Error('runner-sweep: --chain takes off'); }
    else if (a === '--timing') { opt.timing = v(); if (opt.timing !== 'off') throw new Error('runner-sweep: --timing takes off'); }
    else if (a === '--off') opt.off = v().split(',');
    else if (a === '--ready') opt.ready = true;
    else if (a === '--aside') opt.aside = true;
    else if (a === '--check') opt.check = true;
    else if (a === '--moves') opt.moves = +v();
    else if (a === '--json') opt.json = v();
    else if (a === '--fails') opt.fails = +v();
    else throw new Error(`runner-sweep: unknown argument ${a}`);
  }
  if (opt.pcts.some(p => !Number.isInteger(p) || p < 1 || p > 100)) throw new Error('runner-sweep: --pct takes whole numbers 1–100');
  if (opt.check && opt.aside) throw new Error('runner-sweep: --check gates the departments LV11 made; --aside stands it aside');
  return opt;
}

// The species a department's gallery list or Intro stamp names that population does not place
// yet (Populate.ready), and its Centrepiece if it waits.
function waiting(C, acc) {
  const p = C.Packs.get(acc), out = [], names = new Set();
  for (const g of p.galleries || []) for (const e of g.contents) if (e.sp) names.add(e.sp);
  if (p.intro && p.intro.legend) for (const k of Object.keys(p.intro.legend).sort()) if (p.intro.legend[k].sp) names.add(p.intro.legend[k].sp);
  for (const sp of p.species) if (names.has(sp.id) && !C.Populate.ready(sp)) out.push(`${sp.id} (${sp.archetype}${(sp.modifiers || []).length ? ', ' + sp.modifiers.join(', ') : ''})`);
  if (p.centrepiece && !C.Populate.ready(p.centrepiece)) out.push(`${p.centrepiece.id} (the Centrepiece, ${p.centrepiece.archetype})`);
  return out;
}

// One department's seeds: a row per seed {seed, depth, attempt, fallback, rejects, reseeds, moves
// (the sentences), removed, none, hp, cost: {a, b, c}, ms, made, fights, short, length, route,
// horizon}: rejects counts LV11's rejections (a reseed each, and the fallback's own), removed the
// exhibits gone as the visit starts.
function sweep(C, acc, opt) {
  // The gate judges at LV11's own share (RUNNER_PASS_PCT), whatever --pct asks to print.
  opt.passPct = C.N.RUNNER_PASS_PCT;
  const rows = [], ropt = { runner: opt.runner || undefined, doors: opt.doors || undefined, chain: opt.chain || undefined, timing: opt.timing || undefined };
  const gopt = opt.off.length ? { rulesOff: opt.off } : undefined;
  for (let s = 1; s <= 3; s++) C.LRunner.measure(C.Dept.create(9000 + s, acc, 3), ropt);
  for (let seed = opt.from; seed <= opt.to; seed++) {
    const depth = 1 + ((seed - 1) % 7);
    let c = cpu();
    const g = C.Dept.generate(seed, acc, depth, gopt);
    const made = cpu() - c;
    c = cpu();
    const rep = C.LRunner.measure(g.state, ropt);
    const ms = cpu() - c;
    const reseeds = g.tries.flat().filter(f => f.id === 'lv11').length, rejects = reseeds + (g.rejected && g.rejected.id === 'lv11' ? 1 : 0);
    const row = { seed, depth, attempt: g.attempt, fallback: g.fallback, rejects, reseeds, moves: g.log.filter(l => l.check === 'LV11').map(l => l.op),
      removed: g.state.actors.filter(a => a.gone).length, none: rep.none || null, ms, made, state: opt.check && seed <= 100 ? g.state : undefined };
    if (!rep.none) {
      row.route = rep.best.b.route; row.horizon = rep.horizon; row.woken = rep.best.b.woken;
      row.hp = rep.hp; row.short = rep.short; row.routes = rep.routes;
      row.cost = { a: rep.best.a.a, b: rep.best.b.b, c: rep.best.c.c };
      row.length = rep.best.b.length;
      row.fights = rep.best.b.fights.map(f => ({ turn: f.turn, uids: f.uids, sps: f.sps, b: f.b }));
    }
    rows.push(row);
  }
  return rows;
}

function report(acc, rows, opt, wait) {
  const n = rows.length, lines = [];
  const pass = (how, pct) => rows.filter(r => !r.none && r.cost[how] <= pct * r.hp).length;
  lines.push(`${acc}: ${n} seeds (${opt.from}–${opt.to}), depths 1–7 in turn; first-attempt departments ${rows.filter(r => r.attempt === 0).length}, fallbacks ${rows.filter(r => r.fallback).length}; no route ${rows.filter(r => r.none).length}`);
  for (const pct of opt.pcts) lines.push(`  pass at ${pct}%:  (a) ${pctOf(pass('a', pct), n)}%  (b) ${pctOf(pass('b', pct), n)}%  (c) ${pctOf(pass('c', pct), n)}%`);
  const byDepth = [];
  for (let d = 1; d <= 7; d++) { const r = rows.filter(x => x.depth === d), k = r.filter(x => !x.none && x.cost.b <= opt.pcts[0] * x.hp).length; byDepth.push(`d${d} ${k}/${r.length}`); }
  lines.push(`  (b) at ${opt.pcts[0]}% by depth: ${byDepth.join(', ')}`);
  const ok = rows.filter(r => !r.none), ratio = how => ok.map(r => 100 * r.cost[how] / (100 * r.hp)).sort((p, q) => p - q);
  for (const how of ['a', 'b', 'c']) { const s = ratio(how); lines.push(`  (${how}) cost as % of the runner's health: p10 ${rank(s, 10).toFixed(0)}, p50 ${rank(s, 50).toFixed(0)}, p90 ${rank(s, 90).toFixed(0)}`); }
  const ms = rows.map(r => r.ms).sort((p, q) => p - q), made = rows.map(r => r.made).sort((p, q) => p - q);
  lines.push(`  CPU-ms per department: runner p50 ${rank(ms, 50).toFixed(1)}, p95 ${rank(ms, 95).toFixed(1)}, max ${ms[ms.length - 1].toFixed(1)}; Dept.generate p50 ${rank(made, 50).toFixed(1)}, p95 ${rank(made, 95).toFixed(1)}`);
  // What wakes the fights on (b)'s failing routes: each fight's exhibits by species, counted once a seed.
  const fail = ok.filter(r => r.cost.b > opt.pcts[0] * r.hp), wakeHow = {}, inFight = {};
  for (const r of fail) {
    const seen = new Set();
    for (const w of r.woken) { if (!w.fights) continue; wakeHow[w.how] = (wakeHow[w.how] || 0) + 1; }
    for (const f of r.fights) for (const sp of f.sps) seen.add(sp);
    for (const sp of seen) inFight[sp] = (inFight[sp] || 0) + 1;
  }
  if (fail.length) {
    lines.push(`  (b) failing at ${opt.pcts[0]}%: ${fail.length}; woken exhibits by how: ${Object.keys(wakeHow).sort().map(k => `${k} ${wakeHow[k]}`).join(', ')}; species in a fight (seeds): ${Object.keys(inFight).sort().map(k => `${k} ${inFight[k]}`).join(', ')}`);
    const big = fail.map(r => r.fights.reduce((m, f) => f.b > m.b ? f : m, { b: -1 })).map(f => f.uids.length).sort((p, q) => p - q);
    lines.push(`  (b) failing: the costliest fight's exhibits p50 ${rank(big, 50)}, p90 ${rank(big, 90)}`);
  }
  lines.push(`  not placed yet: ${wait.length ? wait.join('; ') : 'none'}`);
  for (const r of fail.slice(0, opt.fails)) {
    lines.push(`  seed ${r.seed} d${r.depth}: (b) ${(r.cost.b / 100).toFixed(1)} of ${r.hp} HP, route ${r.length} steps (shortest ${r.short}); fights: ` +
      r.fights.map(f => `t${f.turn} [${f.uids.map(u => u.split('.').slice(2).join('.')).join(' ')}] ${(f.b / 100).toFixed(1)}`).join('; '));
  }
  return lines;
}

// The gate (A1.4, R2) on one department's rows (sweep's, which sets opt.passPct, LV11's share):
// its lines, and whether it holds. oracle(state, route, horizon) → {b, woken} is the test's
// (test/sweep/runner.check.js), run on seeds 1–100.
function gate(acc, rows, opt, oracle) {
  const n = rows.length, lines = [], pct = opt.passPct, bad = [];
  if (!pct) throw new Error('runner-sweep: the gate reads the rows sweep made');
  const pass = r => !r.none && r.cost.b <= pct * r.hp;
  const first = rows.filter(r => !r.rejects).length, clean = rows.filter(r => !r.rejects && !r.moves.length).length;
  const fall = rows.filter(r => r.fallback).length, removed = rows.reduce((k, r) => k + r.removed, 0), moved = rows.filter(r => r.moves.length);
  const failing = rows.filter(r => !pass(r));
  let checked = 0, disagree = [];
  for (const r of rows) {
    if (!r.state || r.none) continue;
    const o = oracle(r.state, r.route, r.horizon);
    checked++;
    if (o.b !== r.cost.b) disagree.push(`seed ${r.seed}: oracle ${o.b}, LRunner ${r.cost.b}`);
  }
  lines.push(`${acc} gate: every final department passes LV11 at ${pct}%: ${n - failing.length} of ${n}` + (failing.length ? ` (failing: seeds ${failing.slice(0, 10).map(r => r.seed).join(', ')})` : ''));
  lines.push(`  at the first attempt LV11 judged: ${first} of ${n} (${pctOf(first, n)}%), ${clean} of them with no move (${pctOf(clean, n)}%); at layout attempt 0: ${rows.filter(r => r.attempt === 0).length} of ${n}`);
  lines.push(`  LV11's reseeds ${rows.reduce((k, r) => k + r.reseeds, 0)}; fallbacks ${fall} (${pctOf(fall, n)}%); moves ${moved.reduce((k, r) => k + r.moves.length, 0)} in ${moved.length} departments; exhibits removed ${removed}`);
  lines.push(`  the oracle agrees on ${checked - disagree.length} of ${checked} (seeds 1–100)` + (disagree.length ? `: ${disagree.slice(0, 5).join('; ')}` : ''));
  if (failing.length) bad.push('a final department fails');
  if (disagree.length) bad.push('the oracle disagrees');
  if (first * 100 < 90 * n) bad.push('under 90% at the first attempt');
  if (fall * 100 > n) bad.push('over 1% fall back');
  if (removed) bad.push('an exhibit is removed');
  lines.push(`  ${bad.length ? 'FAILS: ' + bad.join('; ') : 'holds'}`);
  return { lines, ok: !bad.length };
}

function main(argv) {
  const opt = parse(argv), C = loadCore(), out = {};
  if (opt.ready) for (const t of Object.keys(M4_READY)) for (const id of M4_READY[t]) if (C.Registry[t][id].ready === false) C.Registry[t][id].ready = 'sweep';
  if (opt.aside) C.LRunner.check = () => null;
  const oracle = opt.check ? require(path.join(__dirname, '..', 'test/sweep/runner.check.js'))(C).oracle : null;
  let ok = true;
  const header = `runner-sweep: charges (a) expected, alone; (b) maximum blow at its chance, woken within ${C.N.RUNNER_TOGETHER_TURNS} turns together; (c) maximum, always hitting, alone` +
    (opt.runner ? '; runner: health only' : '') + (opt.doors ? '; doors as they stand' : '') + (opt.chain ? '; no chain wakings' : '') + (opt.timing ? '; no patrol timed' : '') +
    (opt.off.length ? `; switched off: ${opt.off.join(', ')}` : '') + (opt.ready ? '; every M4 archetype planted ready' : '') + (opt.aside ? '; LV11 stood aside' : '');
  console.log(header);
  for (const acc of opt.depts) {
    const rows = sweep(C, acc, opt);
    out[acc] = rows;
    for (const l of report(acc, rows, opt, waiting(C, acc))) console.log(l);
    for (const r of rows.filter(q => q.moves.length).slice(0, opt.moves)) for (const mv of r.moves) console.log(`  seed ${r.seed} d${r.depth}: ${mv}`);
    if (opt.check) { const g = gate(acc, rows, opt, oracle); for (const l of g.lines) console.log(l); if (!g.ok) ok = false; }
    for (const r of rows) delete r.state;
  }
  if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(out));
  return ok ? 0 : 1;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(e.stack || e.message); process.exitCode = 2; }
}
module.exports = { parse, sweep, report, waiting, gate };
