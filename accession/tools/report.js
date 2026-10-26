#!/usr/bin/env node
// ACCESSION — reports from the sims' and the battery's JSON (BUILD.md §10.2, §10.3, §12).
// Every number in a report is filled into a sentence template from the JSON, never written by
// hand or by a language model, and every claim links a replay chosen by rule:
//   - a paired comparison (tools/sim.js --paired): the seed with the largest paired difference
//     in the arena's metric (the largest |B − A|, then the lowest seed) and the
//     median-difference seed (the seeds ordered by B − A, then by seed; the lower middle one);
//   - a rate (tools/sim.js --policy): a run with the commonest outcome (the median seed among
//     the runs that had it) and the median seed of all the runs;
//   - a failure (tools/battery.js): its crash card, shrunk with tools/shrink.js (--cards).
// A replay is written as a file a command plays (node tools/replay.js <file>), and its link is
// pending M5 (§3.6). A report names the build its coreHash runs in, dist/builds/<coreHash>.html,
// which §12 keeps for every coreHash the log or a report links.
//
//   node tools/report.js <sim or battery JSON> [--out <dir>] [--cards] [--ms <per card>]
//       prints the report; with --out, also writes it there as report.md with its replays
//   node tools/report.js --check-builds [file…]
//       §12's check (check-all's linked-builds step): every build a file links (by default
//       DEVELOPMENT.md), dist/builds/<8 hex digits>.html, must be in dist/builds/
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { root } = require('./core-context.js');
const Stats = require('./stats.js');

const LINK = /(?:^|[^A-Za-z0-9_])((?:dist\/)?builds\/([0-9a-f]{8})\.html)/g;
const n2 = v => v === null || v === undefined ? 'none' : v === Infinity || v === 'Infinity' ? 'without bound' : v === -Infinity || v === '-Infinity' ? 'minus without bound' : Number(v).toFixed(2);
const pct = v => v === null || v === undefined ? 'none' : `${(100 * v).toFixed(1)}%`;
const plural = (k, one, many) => `${k} ${k === 1 ? one : many || one + 's'}`;
const listed = xs => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const bySeed = (a, b) => a.seed - b.seed;
const build = h => h ? `dist/builds/${h}.html` : 'no build (the JSON records no coreHash)';
const WORDS = { hpLost: 'HP lost', woken: 'exhibits woken', turns: 'turns taken', deaths: 'deaths' };

// The builds a text links: every dist/builds/<coreHash>.html in it, in order, each once.
function linkedBuilds(text) {
  const out = [];
  for (const m of String(text).matchAll(LINK)) if (!out.includes(m[2])) out.push(m[2]);
  return out;
}
// §12: every build the files link is kept. → {linked: [hash], missing: [{hash, file}]}.
function checkBuilds(files, dir) {
  dir = dir || root;
  const linked = [], missing = [];
  for (const f of files) {
    const abs = path.resolve(dir, f);
    if (!fs.existsSync(abs)) throw new Error(`report: there is no ${f} to check for linked builds`);
    for (const h of linkedBuilds(fs.readFileSync(abs, 'utf8'))) {
      if (!linked.includes(h)) linked.push(h);
      if (!fs.existsSync(path.join(dir, 'dist', 'builds', `${h}.html`)) && !missing.some(x => x.hash === h)) missing.push({ hash: h, file: f });
    }
  }
  return { linked, missing };
}

// RULES for choosing replays.
// Paired: the per-seed difference B − A in the metric (deaths count 1 for a run with one).
function metricOf(json) {
  const m = json.metric;
  if (m && m.test === 'ratio') return m.name;
  if (m && m.test === 'lower') return 'deaths';
  return 'hpLost';
}
const valueOf = (run, k) => k === 'deaths' ? (run.outcome.deaths > 0 ? 1 : 0) : run.outcome[k];
function pickPaired(json) {
  const k = metricOf(json), A = json.a.runs, B = json.b.runs, diffs = [];
  for (let i = 0; i < A.length; i++) diffs.push({ seed: A[i].seed, a: valueOf(A[i], k), b: valueOf(B[i], k), i });
  for (const d of diffs) d.d = d.b - d.a;
  const largest = diffs.slice().sort((x, y) => (Math.abs(y.d) - Math.abs(x.d)) || bySeed(x, y))[0];
  const ordered = diffs.slice().sort((x, y) => (x.d - y.d) || bySeed(x, y)), median = ordered[Math.floor((ordered.length - 1) / 2)];
  return { metric: k, largest, median };
}
// Single: the commonest outcome (how runs stopped; ties to the one met first in seed order),
// the median seed among its runs, and the median seed of all.
function pickSingle(json) {
  const runs = json.runs.slice().sort(bySeed), count = {};
  for (const r of runs) count[r.stopped] = (count[r.stopped] || 0) + 1;
  let common = null;
  for (const r of runs) if (common === null || count[r.stopped] > count[common]) common = r.stopped;
  const of = runs.filter(r => r.stopped === common);
  return { common, count: count[common], commonRun: of[Math.floor((of.length - 1) / 2)], medianRun: runs[Math.floor((runs.length - 1) / 2)] };
}

// A replay in the report: written to <out>/replays/<name>.json with the command that plays it,
// or, with no out, printed after the command as one line of JSON to save as that file.
function replayLines(ctx, name, run) {
  const r = run.replay, lines = [];
  if (!r) return [`  ${name}: the JSON keeps no replay for it.`];
  if (ctx.out) {
    const rel = path.join('replays', `${name}.json`);
    fs.mkdirSync(path.join(ctx.out, 'replays'), { recursive: true });
    fs.writeFileSync(path.join(ctx.out, rel), JSON.stringify(r) + '\n');
    lines.push(`  play it: node tools/replay.js ${path.join(ctx.out, rel)} --log (link: pending M5)`);
  } else {
    lines.push(`  play it: save the line below as ${name}.json, then node tools/replay.js ${name}.json --log (link: pending M5)`);
    lines.push('  ' + JSON.stringify(r));
  }
  return lines;
}

// Ratio lines from a comparison's statistics (tools/sim.js's compare: Stats.compare).
function ratioLine(k, s, a, b) {
  if (!s) return null;
  const head = `${WORDS[k]}: ${a} ${s.sumA} in all, ${b} ${s.sumB}`;
  if (s.ratio === null || s.ratio === undefined) return `${head}; there is no ratio, since the total for ${a} is 0.`;
  return `${head}; the ratio ${b} over ${a} is ${n2(s.ratio)} (95% interval ${n2(s.ratioLo)} to ${n2(s.ratioHi)}), and the mean per-seed difference ${n2(s.mean)} (95% interval ${n2(s.lo)} to ${n2(s.hi)}).`;
}

function fromPaired(json, ctx) {
  const where = json.arena ? `arena ${json.arena}` : `department ${json.dept}`, a = json.a.said, b = json.b.said, s = json.stats;
  const seeds = json.seeds, n = seeds.length, lines = [];
  lines.push(`# ${where}: ${a} against ${b}, ${plural(n, 'seed')} (${seeds[0]} to ${seeds[n - 1]})`);
  lines.push(`coreHash ${json.coreHash || 'not recorded'}, vmHash ${json.vmHash || 'not recorded'}; the build: ${build(json.coreHash)}.`);
  if (json.verdict) lines.push(json.verdict.sentence);
  else lines.push(`No metric is set for ${where}, so there is no verdict.`);
  for (const k of ['hpLost', 'woken', 'turns']) { const l = ratioLine(k, s[k], a, b); if (l) lines.push(l); }
  const d = s.died;
  if (d) lines.push(`Deaths (or blows that would have killed, in invulnerable runs): ${a} on ${d.a + d.b} of ${d.n} seeds (${pct(d.pA)}), ${b} on ${d.a + d.c} (${pct(d.pB)}); the difference is ${n2(d.diff)} (95% Newcombe interval ${n2(d.lo)} to ${n2(d.hi)}).`);
  if (s.won) lines.push(`The goal was met by ${a} on ${s.won.a} of ${s.won.n} seeds and by ${b} on ${s.won.b}.`);
  if (json.notes && json.notes.length) lines.push(`Note: ${json.notes.join('; ')}.`);
  const p = pickPaired(json), fate = x => x ? 'died' : 'lived';
  const say = q => p.metric === 'deaths' ? `${a} ${fate(q.a)}, ${b} ${fate(q.b)}` : `${a} ${q.a}, ${b} ${q.b}, a difference of ${q.d}`;
  const tag = json.arena || json.dept;
  lines.push(`Replays chosen by rule, for ${WORDS[p.metric]}:`);
  lines.push(`- the largest paired difference: seed ${p.largest.seed} (${say(p.largest)}).`);
  for (const [side, runs] of [['a', json.a.runs], ['b', json.b.runs]]) lines.push(...replayLines(ctx, `${tag}-seed${p.largest.seed}-${side === 'a' ? 'A' : 'B'}`, runs[p.largest.i]));
  lines.push(`- the median difference: seed ${p.median.seed} (${say(p.median)}).`);
  for (const [side, runs] of [['a', json.a.runs], ['b', json.b.runs]]) lines.push(...replayLines(ctx, `${tag}-seed${p.median.seed}-${side === 'a' ? 'A' : 'B'}`, runs[p.median.i]));
  lines.push('The policies\' cards:', json.a.card, json.b.card);
  return lines;
}

function fromSingle(json, ctx) {
  const where = json.arena ? `arena ${json.arena}` : `department ${json.dept}`, runs = json.runs, n = runs.length, lines = [];
  const won = runs.filter(r => r.outcome.won).length, died = runs.filter(r => r.outcome.died).length;
  const w = Stats.wilson(won, n), d = Stats.wilson(died, n), mean = runs.reduce((s, r) => s + r.hpLost, 0) / n;
  lines.push(`# ${where}: ${json.policy}, ${plural(n, 'seed')} (${json.seeds[0]} to ${json.seeds[n - 1]})`);
  lines.push(`coreHash ${json.coreHash || 'not recorded'}, vmHash ${json.vmHash || 'not recorded'}; the build: ${build(json.coreHash)}.`);
  lines.push(`It met the goal on ${won} of ${n} seeds (${pct(won / n)}, 95% Wilson interval ${pct(w.lo)} to ${pct(w.hi)}) and died on ${died} (${pct(died / n)}, ${pct(d.lo)} to ${pct(d.hi)}); it lost ${mean.toFixed(2)} HP a seed on average, with ${plural(runs.reduce((s, r) => s + r.violations.length, 0), 'violation')}.`);
  const p = pickSingle(json), tag = json.arena || json.dept;
  lines.push('Replays chosen by rule:');
  lines.push(`- the commonest outcome, ${p.common} (${p.count} of ${n} runs): its median seed, ${p.commonRun.seed}.`);
  lines.push(...replayLines(ctx, `${tag}-${p.common}-seed${p.commonRun.seed}`, p.commonRun));
  lines.push(`- the median seed, ${p.medianRun.seed}: ${p.medianRun.stopped}, ${p.medianRun.hpLost} HP lost.`);
  lines.push(...replayLines(ctx, `${tag}-median-seed${p.medianRun.seed}`, p.medianRun));
  lines.push('The policy\'s card:', json.card);
  return lines;
}

// A crash card for a battery failure: its replay shrunk (tools/shrink.js) to the fewest actions
// that still fail the same check, with the battery's own checks (Battery.checks) after every
// step, started afresh on each replay.
function crashCard(C, problem, ms) {
  const Battery = require('./battery.js'), Shrink = require('./shrink.js');
  const chk = Battery.checks(C), same = v => v.id === problem.id && (v.inv || null) === (problem.inv || null);
  const check = (pre, action, events, post, i) => {
    if (i === 1) chk.reset();
    return chk.check(pre, action, events, post).filter(same).map(v => ({ text: `${v.id}${v.inv ? ' ' + v.inv : ''}: ${v.text}` }));
  };
  const s = Shrink.shrinkReplay(C, Object.assign({ layoutPin: null }, problem.replay), check, { ms });
  return Shrink.card(s.replay, s.failure, s.result);
}

function fromBattery(json, ctx) {
  const lines = [`# The ${json.level} battery`, `coreHash ${json.coreHash}, vmHash ${json.vmHash}; the build: ${build(json.coreHash)}.`, json.sentence];
  const by = {};
  for (const r of json.results) { const k = by[r.kind] || (by[r.kind] = { runs: 0, steps: 0, ms: 0, deaths: 0, violations: 0 }); k.runs++; k.steps += r.steps; k.ms += r.ms; k.deaths += r.tally ? r.tally.deaths : 0; k.violations += r.violations; }
  for (const k of ['monkey', 'arena', 'wander', 'soak']) if (by[k]) lines.push(`- ${k}: ${plural(by[k].runs, 'run')}, ${by[k].steps} steps in ${(by[k].ms / 1000).toFixed(1)} s, ${plural(by[k].deaths, 'death')}, ${plural(by[k].violations, 'violation')}.`);
  const killers = Object.keys(json.killers);
  if (killers.length) lines.push(`Why your killers were awake (their recaps' wake triggers): ${listed(killers.map(k => `${k} ${json.killers[k]}`))}.`);
  if (!json.problems.length) { lines.push('No failure, so no crash card.'); return lines; }
  lines.push(`Failures (${json.violations}; the first ${json.problems.length} kept):`);
  let C = null;
  for (const p of json.problems) {
    lines.push(`- ${p.run}: ${p.id}${p.inv ? ' ' + p.inv : ''}: ${p.text}`);
    if (!p.replay) { lines.push('  It keeps no replay: play the run again with tools/sim.js and --check.'); continue; }
    if (!ctx.cards) { lines.push(...replayLines(ctx, `failure-${json.problems.indexOf(p) + 1}`, p)); continue; }
    try {
      C = C || require('./battery.js').load();
      const card = crashCard(C, p, ctx.ms);
      lines.push(...card.text.split('\n').map(l => '  ' + l));
    } catch (e) { lines.push(`  No crash card: ${(e && e.message) || e}.`); lines.push(...replayLines(ctx, `failure-${json.problems.indexOf(p) + 1}`, p)); }
  }
  return lines;
}

// The report for a JSON file's contents, as text.
function report(json, ctx) {
  ctx = ctx || {};
  let lines;
  if (json && json.tool === 'battery') lines = fromBattery(json, ctx);
  else if (json && json.a && json.b && json.stats) lines = fromPaired(json, ctx);
  else if (json && Array.isArray(json.runs) && json.policy) lines = fromSingle(json, ctx);
  else throw new Error('report: the JSON is neither a sim run (tools/sim.js) nor a battery (tools/battery.js)');
  const text = lines.join('\n') + '\n';
  if (ctx.out) { fs.mkdirSync(ctx.out, { recursive: true }); fs.writeFileSync(path.join(ctx.out, 'report.md'), text); }
  return text;
}

const USAGE = `node tools/report.js <sim or battery JSON> [--out <dir>] [--cards] [--ms <milliseconds a card>]
  the report in words from tools/sim.js's or tools/battery.js's JSON, with replays chosen by rule
  --out     also write report.md and the replays there
  --cards   shrink each battery failure to a crash card (tools/shrink.js; 60,000 ms a card, or --ms)
node tools/report.js --check-builds [file...]
  fails if a build the files link (DEVELOPMENT.md by default), dist/builds/<coreHash>.html, is missing`;

function main(argv) {
  if (argv.includes('--check-builds')) {
    const files = argv.filter(a => !a.startsWith('--'));
    const r = checkBuilds(files.length ? files : ['DEVELOPMENT.md'], process.cwd());
    if (r.missing.length) {
      console.log(`report: ${plural(r.missing.length, 'linked build')} missing: ${listed(r.missing.map(m => `dist/builds/${m.hash}.html (linked in ${m.file})`))}; keep it with python3 tools/build-single.py --release in the commit that links it (BUILD.md §12)`);
      return 1;
    }
    console.log(`report: ${plural(r.linked.length, 'linked build')}, every one kept in dist/builds/`);
    return 0;
  }
  const file = argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--out' && argv[argv.indexOf(a) - 1] !== '--ms');
  if (!file || argv.includes('--help')) { console.log(USAGE); return file ? 0 : 1; }
  const at = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const ctx = { out: at('--out') || null, cards: argv.includes('--cards'), ms: at('--ms') ? Number(at('--ms')) : 60000 };
  process.stdout.write(report(JSON.parse(fs.readFileSync(file, 'utf8')), ctx));
  return 0;
}

module.exports = { report, linkedBuilds, checkBuilds, pickPaired, pickSingle, crashCard, USAGE };
if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (e) { console.error((e && e.message) || String(e)); process.exitCode = 1; }
}
