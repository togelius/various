#!/usr/bin/env node
// ACCESSION — the worst-case runner's sweep (M4 plan D-RUNNER-EST, D2.3, Q2; BUILD.md §10.3): for
// each department and seed s (at depth ((s − 1) mod 7) + 1), the department Dept.generate makes,
// measured by LRunner (js/core/layout/runner.js) in report mode, outside generation: nothing
// registers the runner yet, so the department is the one every visit gets, and a pass here is
// a pass at the first attempt LV11 would make. It prints, per department, the share of seeds
// whose cheapest route costs at most each pct% of the runner's health under each charge (a, b,
// c), the seeds with no route at all, the runner's CPU time per department (and Dept.create's
// beside it), (b) per depth, what wakes the fights of (b)'s failing routes, and the species
// the department does not place yet (their archetype, modifier or trigger still waiting).
// Usage: node tools/runner-sweep.js [--dept S9,A4,M11] [--seeds 1-200] [--pct 80,50]
//          [--runner hp] [--doors shut] [--chain off] [--off <module,…>] [--ready] [--json out.json]
//          [--fails n]
//   --runner hp   the runner keeps the median's kit stats and loses only a grade's health;
//   --doors shut  wake regions with the doors as they stand, not every door open;
//   --chain off   no waking wakes another (no alarm, herald's call or ally_hit): D2.3's list;
//   --off m,…     the departments made with these modules switched off (rulesOff; population
//                 is the same under any switch, M4 plan A10);
//   --ready       plants every M4 archetype, modifier and trigger ready (as their packages
//                 will), so the waiting species are placed;
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
  const opt = { depts: ['S9', 'A4', 'M11'], from: 1, to: 200, pcts: [80, 50], runner: null, doors: null, chain: null, off: [], ready: false, json: null, fails: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = () => { if (i + 1 >= argv.length) throw new Error(`runner-sweep: ${a} needs a value`); return argv[++i]; };
    if (a === '--dept') opt.depts = v().split(',');
    else if (a === '--seeds') { const m = /^(\d+)-(\d+)$/.exec(v()); if (!m || +m[1] < 1 || +m[2] < +m[1]) throw new Error('runner-sweep: --seeds takes a range such as 1-200'); opt.from = +m[1]; opt.to = +m[2]; }
    else if (a === '--pct') opt.pcts = v().split(',').map(Number);
    else if (a === '--runner') { opt.runner = v(); if (opt.runner !== 'hp') throw new Error('runner-sweep: --runner takes hp'); }
    else if (a === '--doors') { opt.doors = v(); if (opt.doors !== 'shut') throw new Error('runner-sweep: --doors takes shut'); }
    else if (a === '--chain') { opt.chain = v(); if (opt.chain !== 'off') throw new Error('runner-sweep: --chain takes off'); }
    else if (a === '--off') opt.off = v().split(',');
    else if (a === '--ready') opt.ready = true;
    else if (a === '--json') opt.json = v();
    else if (a === '--fails') opt.fails = +v();
    else throw new Error(`runner-sweep: unknown argument ${a}`);
  }
  if (opt.pcts.some(p => !Number.isInteger(p) || p < 1 || p > 100)) throw new Error('runner-sweep: --pct takes whole numbers 1–100');
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

// One department's seeds: a row per seed {seed, depth, attempt, fallback, none, hp, cost: {a, b,
// c}, ms, made, fights, short, length}.
function sweep(C, acc, opt) {
  const rows = [], ropt = { runner: opt.runner || undefined, doors: opt.doors || undefined, chain: opt.chain || undefined };
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
    const row = { seed, depth, attempt: g.attempt, fallback: g.fallback, none: rep.none || null, ms, made };
    if (!rep.none) {
      row.hp = rep.hp; row.short = rep.short; row.routes = rep.routes;
      row.cost = { a: rep.best.a.a, b: rep.best.b.b, c: rep.best.c.c };
      row.length = rep.best.b.length;
      row.fights = rep.best.b.fights.map(f => ({ turn: f.turn, uids: f.uids, sps: f.sps, b: f.b }));
      row.woken = rep.best.b.woken;
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

function main(argv) {
  const opt = parse(argv), C = loadCore(), out = {};
  if (opt.ready) for (const t of Object.keys(M4_READY)) for (const id of M4_READY[t]) if (C.Registry[t][id].ready === false) C.Registry[t][id].ready = 'sweep';
  const header = `runner-sweep: charges (a) expected, alone; (b) maximum blow at its chance, woken within ${C.N.RUNNER_TOGETHER_TURNS} turns together; (c) maximum, always hitting, alone` +
    (opt.runner ? '; runner: health only' : '') + (opt.doors ? '; doors as they stand' : '') + (opt.chain ? '; no chain wakings' : '') +
    (opt.off.length ? `; switched off: ${opt.off.join(', ')}` : '') + (opt.ready ? '; every M4 archetype planted ready' : '');
  console.log(header);
  for (const acc of opt.depts) {
    const rows = sweep(C, acc, opt);
    out[acc] = rows;
    for (const l of report(acc, rows, opt, waiting(C, acc))) console.log(l);
  }
  if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(out));
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(e.stack || e.message); process.exitCode = 2; }
}
module.exports = { parse, sweep, report, waiting };
