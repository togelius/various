#!/usr/bin/env node
// ACCESSION — what one department costs to make (M4 plan A17; BUILD.md §10.2): the CPU time of
// Dept.create, every layout attempt, population and validator included, for each slice
// department at depths 1–7 and seeds 1–N (20 unless --seeds says), after a warm-up of five
// departments each. It prints the count and the p50, p95 (nearest rank) and largest, in
// CPU-ms, against the budget: p95 at most BUDGET_MS, and OVER after the line when past it.
// Like check-all's other budgets, being over is printed, not failed (exit 0): a lander reads
// it and stops. check-all runs it as its step dept-p95.
// Usage: node tools/dept-p95.js [--seeds <n>] [--budget <CPU-ms>]   (--budget for tests)
'use strict';
const path = require('node:path');
const BUDGET_MS = 40;
const DEPTS = ['S9', 'A4', 'M11'], DEPTHS = [1, 2, 3, 4, 5, 6, 7];

// CPU-ms of this process so far (user and system).
const cpu = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };
// The nearest-rank percentile p (0–100) of sorted times.
const rank = (sorted, p) => sorted[Math.max(0, Math.ceil(p * sorted.length / 100) - 1)];

// The times of every department made, sorted, in CPU-ms.
function measure(C, seeds) {
  for (const acc of DEPTS) for (let s = 1; s <= 5; s++) C.Dept.create(1000 + s, acc, 3);
  const t = [];
  for (const acc of DEPTS) for (const depth of DEPTHS) for (let seed = 1; seed <= seeds; seed++) {
    const c = cpu();
    C.Dept.create(seed, acc, depth);
    t.push(cpu() - c);
  }
  return t.sort((a, b) => a - b);
}

// The line it prints, from sorted times and the budget.
function line(t, budget) {
  const f = x => x.toFixed(1), p95 = rank(t, 95);
  return `Dept.create: ${t.length} departments, CPU-ms p50 ${f(rank(t, 50))}, p95 ${f(p95)}, max ${f(t[t.length - 1])}; budget p95 ${budget}` + (p95 > budget ? ' OVER' : '');
}

function main(argv) {
  const opt = (k, d) => { const i = argv.indexOf(k); if (i < 0) return d; const v = Number(argv[i + 1]); if (!(v >= 0)) throw new Error(`dept-p95: ${k} needs a number`); return v; };
  const seeds = opt('--seeds', 20), budget = opt('--budget', BUDGET_MS);
  if (!Number.isInteger(seeds) || seeds < 1) throw new Error('dept-p95: --seeds needs a whole number, 1 or more');
  const C = require(path.join(__dirname, 'core-context.js')).loadCore();
  console.log(line(measure(C, seeds), budget));
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 2; }
}
module.exports = { BUDGET_MS, measure, line, rank };
