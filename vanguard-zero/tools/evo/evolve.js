/* LLM-driven quality-diversity search over VANGUARD ZERO controllers.
 *
 *   node tools/evo/evolve.js --run=NAME [--children=200] [--budget=10]
 *        [--conc=4] [--workers=3] [--init=6] [--minutes=0] [--resume]
 *
 * One generation step, AlphaEvolve-style:
 *   1. the prompt sampler picks a parent from the archive, an operator and a
 *      model, and assembles a prompt with inspirations and feedback;
 *   2. the LLM answers with a diff or a whole program;
 *   3. the evaluation cascade: static checks, a short smoke run that catches
 *      crashes and hangs cheaply, then the full set of training starts;
 *   4. the result goes into the constrained MAP-Elites archive.
 * Several steps run at once; LLM latency, not evaluation, is the bottleneck.
 *
 * Held-out starts (tasks.json "test") are scored for every new elite at
 * checkpoints, purely for reporting. Selection never sees them.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./headless');
const S = require('./sandbox');
const P = require('./prompts');
const L = require('./llm');
const { Archive, DIMS } = require('./archive');
const { Pool } = require('./pool');

function arg(n, d) {
  const a = process.argv.find(s => s.startsWith('--' + n + '='));
  return a ? a.split('=').slice(1).join('=') : d;
}
const CFG = {
  run: arg('run', 'default'),
  children: +arg('children', 200),
  budget: +arg('budget', 10),
  conc: +arg('conc', 4),
  workers: +arg('workers', 3),
  init: +arg('init', 6),
  minutes: +arg('minutes', 0),
  resume: process.argv.includes('--resume'),
  // Start from another run's elites, re-scored on the current training set.
  from: arg('from', ''),
  testEvery: +arg('test-every', 40)
};
// Operator mix. Medium-strength reflection carries the most weight; steering
// is what grows the map into empty playstyles.
const OPS = { tweak: 0.25, improve: 0.30, rewrite: 0.10, crossover: 0.15, steer: 0.20 };
const P_REPAIR = 0.12;
const P_STRONG = { tweak: 0.2, improve: 0.25, steer: 0.25, repair: 0.25, rewrite: 0.5, crossover: 0.5, init: 0.5 };

const DIR = path.join(__dirname, 'runs', CFG.run);
const KIDS = path.join(DIR, 'children');
fs.mkdirSync(KIDS, { recursive: true });
const TASKS = JSON.parse(fs.readFileSync(path.join(__dirname, 'tasks.json'), 'utf8'));
// Stage one of the cascade: two short runs, enough to catch code that throws
// or hangs before it costs a full evaluation.
const SMOKE = [TASKS.train.find(t => t.kind === 'run' && t.stage === 0),
               TASKS.train.find(t => t.kind === 'run' && t.stage === 1)].map(t => Object.assign({}, t, { frames: 300 }));

const rnd = () => Math.random();
const pick = a => a[Math.floor(rnd() * a.length)];
function weighted(w) {
  let r = rnd() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return Object.keys(w)[0];
}

let archive, n = 0, spent = 0, stopping = false;
const t0 = Date.now();
const world = H.boot();  // the main thread's copy, only for drawing failure maps
const pool = new Pool(CFG.workers, { deadlineMs: 120000 });

function save() {
  const tmp = path.join(DIR, 'archive.json.tmp');
  fs.writeFileSync(tmp, JSON.stringify(archive.toJSON()));
  fs.renameSync(tmp, path.join(DIR, 'archive.json'));
}
function log(rec) {
  fs.appendFileSync(path.join(DIR, 'log.jsonl'), JSON.stringify(rec) + '\n');
}

function compact(res) {
  return res.tasks.map(t => ({ id: t.id, stage: t.stage, kind: t.kind, x0: t.x0, progress: +t.progress.toFixed(4),
    end: t.end, at: t.at, from: t.from, frames: t.frames, hpLost: t.hpLost, shots: t.shots, kills: t.kills }));
}

function individual(id, src, res, meta) {
  return Object.assign({
    id, src, size: src.length,
    quality: +res.quality.toFixed(5), aggression: +res.aggression.toFixed(4), entropy: +res.entropy.toFixed(4),
    feasible: !!res.feasible, violation: +res.violation.toFixed(4), errorRate: +(res.errorRate || 0).toFixed(4),
    lastErr: res.lastErr || '', tasks: compact(res), born: n, intent: (src.match(/\/\/\s*intent:\s*(.*)/) || [])[1] || ''
  }, meta);
}

function violationText(ind) {
  const bits = [];
  if (ind.size > S.LIMITS.MAX_CHARS) bits.push('it is ' + ind.size + ' characters, ' + (ind.size - S.LIMITS.MAX_CHARS) + ' over the ' + S.LIMITS.MAX_CHARS + '-character limit');
  if (ind.errorRate > S.LIMITS.MAX_ERROR_RATE) bits.push('it throws an exception on ' + (ind.errorRate * 100).toFixed(1) + '% of frames (allowed: ' + (S.LIMITS.MAX_ERROR_RATE * 100) + '%); last error: ' + ind.lastErr);
  return bits.join('; and ') || 'it violates the rules';
}

function farFrom(cell, k = 4) {
  const others = archive.elites().filter(e => e.cell[0] !== cell[0] || e.cell[1] !== cell[1]);
  if (!others.length) return null;
  let best = null, bd = -1;
  for (let i = 0; i < k; i++) {
    const e = pick(others);
    const d = Math.abs(e.cell[0] - cell[0]) + Math.abs(e.cell[1] - cell[1]);
    if (d > bd) { bd = d; best = e; }
  }
  return best;
}
function tournament(list, k = 3) {
  let b = null;
  for (let i = 0; i < k; i++) { const e = pick(list); if (!b || e.quality > b.quality) b = e; }
  return b;
}

// --------------------------------------------------------------- selection
function plan(forceOp) {
  const elites = archive.elites();
  const infeasible = archive.infeasibles();
  let op = forceOp;
  if (!op) op = (infeasible.length && rnd() < P_REPAIR) ? 'repair' : weighted(OPS);
  const pl = { op, inspirations: [] };

  if (op === 'init') {
    const c = [Math.floor(rnd() * DIMS[0].bins), Math.floor(rnd() * DIMS[1].bins)];
    pl.target = c; pl.range = archive.range(c);
    const shuffled = elites.slice().sort(() => rnd() - 0.5).slice(0, 2);
    pl.inspirations = shuffled.map(e => ({ why: 'An existing controller', ind: e }));
  } else if (op === 'repair') {
    pl.parent = pick(infeasible);
    pl.why = violationText(pl.parent);
  } else {
    pl.parent = pick(elites);   // uniform over occupied cells: MAP-Elites
    if (op === 'crossover') {
      const others = elites.filter(e => e !== pl.parent);
      if (!others.length) { pl.op = op = 'improve'; } else pl.parent2 = tournament(others);
    }
    if (op === 'steer') {
      const fr = archive.frontier();
      let c;
      if (fr.length) c = pick(fr);
      else { const empty = []; for (let i = 0; i < DIMS[0].bins; i++) for (let j = 0; j < DIMS[1].bins; j++) if (!archive.cells[i + ',' + j] || !archive.cells[i + ',' + j].elite) empty.push([i, j]); c = empty.length ? pick(empty) : pl.parent.cell; }
      pl.target = c; pl.range = archive.range(c);
    }
    const best = archive.best();
    if (best && best !== pl.parent && best !== pl.parent2) pl.inspirations.push({ why: 'The best controller so far', ind: best });
    if (op !== 'crossover') {
      const far = farFrom(pl.parent.cell);
      if (far && far !== best) pl.inspirations.push({ why: 'A controller with a different playstyle', ind: far });
    }
  }
  pl.model = rnd() < (P_STRONG[op] || 0.25) ? 'strong' : 'fast';
  return pl;
}

// ------------------------------------------------------------- one child
async function step(forceOp) {
  const myN = ++n;
  const id = 'c' + String(myN).padStart(4, '0');
  const pl = plan(forceOp);
  const rec = { n: myN, id, t: Math.round((Date.now() - t0) / 1000), op: pl.op, model: pl.model,
    parent: pl.parent && pl.parent.id, parent2: pl.parent2 && pl.parent2.id, target: pl.target };

  const prompt = P.build(pl.op, {
    archive, world, parent: pl.parent, parentRes: pl.parent && { tasks: pl.parent.tasks },
    parent2: pl.parent2, parent2Res: pl.parent2 && { tasks: pl.parent2.tasks },
    inspirations: pl.inspirations, range: pl.range, why: pl.why
  });
  rec.promptChars = prompt.length;
  const r = await L.callLLM({ model: L.MODELS[pl.model], system: P.SYSTEM, prompt });
  spent += r.cost || 0;
  rec.cost = +(r.cost || 0).toFixed(5); rec.llmMs = r.ms;
  if (!r.ok) { rec.outcome = 'llm-error'; rec.why = r.error; return finish(rec); }

  const diffOp = pl.op === 'tweak' || pl.op === 'improve';
  const parsed = diffOp ? L.applyDiff(pl.parent.src, r.text) : L.extractProgram(r.text);
  if (!parsed.ok) { rec.outcome = 'malformed'; rec.why = parsed.why; return finish(rec); }
  const src = parsed.src;
  if (pl.parent && src.trim() === pl.parent.src.trim()) { rec.outcome = 'unchanged'; return finish(rec); }
  fs.writeFileSync(path.join(KIDS, id + '.js'), src);
  rec.size = src.length;

  const chk = S.staticCheck(src);
  if (!chk.runnable) { rec.outcome = 'refused'; rec.why = chk.forbidden.length ? 'forbidden: ' + chk.forbidden.join(', ') : chk.errors.join('; '); return finish(rec); }

  const te = Date.now();
  const smoke = await pool.evaluate(src, SMOKE);
  if (smoke.fatal || smoke.hung || smoke.timeouts || (smoke.errorRate || 0) > 0.2) {
    rec.outcome = 'crashed'; rec.why = smoke.fatal || (smoke.timeouts ? 'frame timed out' : 'throws: ' + smoke.lastErr);
    return finish(rec);
  }
  const res = await pool.evaluate(src, 'train');
  rec.evalMs = Date.now() - te;
  if (res.fatal) { rec.outcome = 'crashed'; rec.why = res.fatal; return finish(rec); }

  const ind = individual(id, src, res, { op: pl.op, model: pl.model, parents: [rec.parent, rec.parent2].filter(Boolean) });
  const outcome = archive.add(ind);
  Object.assign(rec, { outcome, quality: ind.quality, aggression: ind.aggression, entropy: ind.entropy,
    cell: ind.cell, feasible: ind.feasible, violation: ind.violation,
    parentQuality: pl.parent ? pl.parent.quality : null });
  if (outcome !== 'rejected') save();
  return finish(rec);
}

function finish(rec) {
  log(rec);
  const q = rec.quality !== undefined ? 'q ' + rec.quality.toFixed(3) +
    (rec.parentQuality !== null && rec.parentQuality !== undefined ? ' (' + (rec.quality >= rec.parentQuality ? '+' : '') + (rec.quality - rec.parentQuality).toFixed(3) + ')' : '') +
    ' [' + rec.cell + ']' : '';
  console.log('#' + String(rec.n).padStart(4) + ' ' + (rec.op + '/' + rec.model).padEnd(17) +
    (rec.parent || '-').padEnd(13) + q.padEnd(30) + (rec.outcome + (rec.why ? ': ' + String(rec.why).slice(0, 70) : '')).padEnd(40) +
    ' $' + spent.toFixed(2) + '  ' + Math.round((rec.llmMs || 0) / 1000) + 's');
  if (rec.n % 10 === 0) { archive.snapshot(rec.n); save(); }
  return rec;
}

// ---------------------------------------------------- held-out evaluation
async function testElites() {
  const todo = archive.elites().filter(e => !e.test);
  await Promise.all(todo.map(async e => {
    const r = await pool.evaluate(e.src, 'test');
    e.test = { quality: +(r.quality || 0).toFixed(5), aggression: +(r.aggression || 0).toFixed(4), entropy: +(r.entropy || 0).toFixed(4) };
  }));
  const el = archive.elites();
  const tr = el.reduce((s, e) => s + e.quality, 0) / el.length;
  const ts = el.reduce((s, e) => s + e.test.quality, 0) / el.length;
  const b = archive.best();
  console.log('  -- held-out check: ' + el.length + ' elites, mean train ' + tr.toFixed(3) + ' / test ' + ts.toFixed(3) +
    '; best ' + b.id + ' train ' + b.quality.toFixed(3) + ' / test ' + b.test.quality.toFixed(3));
  log({ n, kind: 'test', elites: el.length, meanTrain: +tr.toFixed(4), meanTest: +ts.toFixed(4), best: b.id, bestTrain: b.quality, bestTest: b.test.quality });
  save();
}

// ------------------------------------------------------------------- main
async function seed() {
  const dir = path.join(__dirname, 'seeds');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const res = await pool.evaluate(src, 'train');
    const ind = individual('seed-' + f.replace('.js', ''), src, res, { op: 'seed', model: '-', parents: [] });
    const o = archive.add(ind);
    console.log('seed ' + f.padEnd(12) + ' q ' + ind.quality.toFixed(3) + '  aggr ' + ind.aggression.toFixed(2) + '  ent ' + ind.entropy.toFixed(3) + '  ' + o);
  }
  save();
}

/* Carry another run's elites over. Their old scores were measured on other
 * starts, so every one is re-scored on this run's training set and placed by
 * what it does now. */
async function importFrom(name) {
  const src = new Archive(JSON.parse(fs.readFileSync(path.join(__dirname, 'runs', name, 'archive.json'), 'utf8')));
  const list = src.elites().concat(src.infeasibles());
  const placed = {};
  await Promise.all(list.map(async e => {
    const res = await pool.evaluate(e.src, 'train');
    if (res.fatal) return;
    const ind = individual(name + ':' + e.id, e.src, res, { op: 'import', model: e.model, parents: [], from: name, fromOp: e.op,
      fromQuality: e.quality, fromTest: e.test ? e.test.quality : null });
    const o = archive.add(ind);
    placed[o] = (placed[o] || 0) + 1;
  }));
  console.log('imported ' + list.length + ' from ' + name + ': ' + Object.entries(placed).map(([k, v]) => k + ' ' + v).join(', '));
  save();
}

async function main() {
  const prior = path.join(DIR, 'archive.json');
  if (CFG.resume && fs.existsSync(prior)) {
    archive = new Archive(JSON.parse(fs.readFileSync(prior, 'utf8')));
    const lines = fs.existsSync(path.join(DIR, 'log.jsonl')) ? fs.readFileSync(path.join(DIR, 'log.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l)) : [];
    n = lines.filter(l => l.id).length;
    spent = lines.reduce((s, l) => s + (l.cost || 0), 0);
    console.log('resumed ' + CFG.run + ': ' + archive.elites().length + ' elites, ' + n + ' children, $' + spent.toFixed(2) + ' spent');
  } else {
    archive = new Archive();
    fs.writeFileSync(path.join(DIR, 'config.json'), JSON.stringify(Object.assign({}, CFG, { ops: OPS, pRepair: P_REPAIR, pStrong: P_STRONG,
      models: L.MODELS, limits: S.LIMITS, dims: DIMS, started: new Date().toISOString() }), null, 1));
    // The run keeps its own copy of the starts it was scored on.
    fs.copyFileSync(path.join(__dirname, 'tasks.json'), path.join(DIR, 'tasks.json'));
    await seed();
    if (CFG.from) await importFrom(CFG.from);
  }
  console.log(archive.grid() + '\n');
  process.on('SIGINT', () => { if (stopping) process.exit(1); stopping = true; console.log('\nstopping after in-flight children...'); });

  const deadline = CFG.minutes ? t0 + CFG.minutes * 60000 : Infinity;
  let initLeft = CFG.resume ? 0 : CFG.init, lastTest = n;
  const running = new Set();
  const more = () => !stopping && n < CFG.children && spent < CFG.budget && Date.now() < deadline;
  while (more() || running.size) {
    while (more() && running.size < CFG.conc) {
      const op = initLeft > 0 ? (initLeft--, 'init') : undefined;
      const p = step(op).catch(e => { console.log('step failed: ' + (e && e.stack || e)); }).finally(() => running.delete(p));
      running.add(p);
    }
    if (running.size) await Promise.race(running);
    if (n - lastTest >= CFG.testEvery && running.size < CFG.conc) { lastTest = n; await testElites(); }
  }
  await testElites();
  archive.snapshot(n);
  save();
  console.log('\n' + archive.grid());
  const b = archive.best();
  console.log('\n' + n + ' children, $' + spent.toFixed(2) + ', ' + ((Date.now() - t0) / 60000).toFixed(1) + ' min. Best ' + b.id +
    ' train ' + b.quality.toFixed(3) + ' / test ' + b.test.quality.toFixed(3) + ': ' + b.intent);
  pool.close();
}

main().catch(e => { console.error(e); pool.close(); process.exitCode = 1; });
