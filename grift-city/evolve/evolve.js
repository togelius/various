#!/usr/bin/env node
// LLM-driven MAP-Elites over controller source code for Grift City.
//
//   node evolve.js --name run1 --gens 20 --children 4 --batch 5 --models haiku:0.7,sonnet:0.3
//
// The loop (AlphaEvolve-style): a database of elites (a 6x6 MAP-Elites grid over measured playstyle), a prompt sampler that
// shows the LLM a parent, inspirations from other cells and the evaluator's account of how the parent played, one
// instruction drawn by a bandit, diff or rewrite or crossover or repair operators, and a cascade that stops hopeless
// candidates early. Quality is game progress only. Starts vary (see scenarios.js) and are redrawn every epoch; held-out
// neighbourhoods are only used for reports. Candidates that break a constraint go to an infeasible pool and are
// sometimes repaired (Talakat's feasible/infeasible handling).
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { Archive, AXES } = require('./archive');
const { LIMITS, validate } = require('./sandbox');
const { makeStarts, mulberry } = require('./scenarios');
const { aggregate } = require('./episode');
const P = require('./prompts');
const { makeLLM, parseModels } = require('./llm');
const { Pool } = require('./pool');

function parseArgs(argv) {
  const a = { name: 'run', gens: 10, children: 4, batch: 5, epoch: 3, workers: Math.min(4, os.cpus().length), models: 'haiku:1', backend: 'claude-cli', density: 0.5, maxChars: LIMITS.maxChars, maxLines: LIMITS.maxLines,
    seeds: 'seeds/walker.js,seeds/driver.js', seed: 1, resume: false, minutes: 0, llmPar: 4, valEvery: 5, valN: 6, cascade: 2, seconds: 0, quiet: false };
  for (let i = 0; i < argv.length; i++) { const k = argv[i].replace(/^--/, ''); if (k === 'resume' || k === 'quiet') a[k] = true; else if (k in a) { const v = argv[++i]; a[k] = typeof a[k] === 'number' ? +v : v; } else throw new Error('unknown option ' + argv[i]); }
  return a;
}
const hash = code => crypto.createHash('sha1').update(code.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 10);

class Run {
  constructor(args) {
    this.a = args; this.dir = path.join(__dirname, 'runs', args.name); fs.mkdirSync(path.join(this.dir, 'elites'), { recursive: true });
    this.limits = { ...LIMITS, maxChars: args.maxChars, maxLines: args.maxLines };
    this.archive = new Archive(); this.pool = null; this.llm = makeLLM({ backend: args.backend, models: parseModels(args.models), queueDir: path.join(this.dir, 'queue') });
    this.rng = mulberry(args.seed * 7919 + 13); this.gen = 0; this.epoch = 0; this.nextId = 1; this.seen = new Set(); this.infeasible = []; this.bandit = Object.fromEntries(P.HINTS.map(h => [h.id, { tries: 0, wins: 0 }])); this.counts = { children: 0, llmFail: 0, parseFail: 0, infeasible: 0, aborted: 0, duplicates: 0, new: 0, better: 0, worse: 0, episodes: 0 };
    this.t0 = Date.now(); this.logFile = path.join(this.dir, 'log.jsonl'); this.valCache = {};
  }
  log(msg) { if (!this.a.quiet) console.log(msg); }
  jlog(o) { fs.appendFileSync(this.logFile, JSON.stringify({ t: Math.round((Date.now() - this.t0) / 1000), gen: this.gen, ...o }) + '\n'); }
  batchStarts(epoch = this.epoch) { return makeStarts(this.a.seed * 1000 + epoch, this.a.batch, 'train'); }
  epOpts() { return { density: this.a.density, limits: this.limits, seconds: this.a.seconds || undefined }; }

  // ---- persistence ----
  save() {
    const slim = g => ({ ...g, cell: g.cell });
    fs.writeFileSync(path.join(this.dir, 'state.json'), JSON.stringify({ args: this.a, gen: this.gen, epoch: this.epoch, nextId: this.nextId, counts: this.counts, bandit: this.bandit, valCache: this.valCache, elites: this.archive.elites().map(slim), infeasible: this.infeasible.slice(-30), seen: [...this.seen] }));
    for (const f of fs.readdirSync(path.join(this.dir, 'elites'))) fs.unlinkSync(path.join(this.dir, 'elites', f));
    for (const g of this.archive.elites()) fs.writeFileSync(path.join(this.dir, 'elites', `w${g.cell[0]}t${g.cell[1]}.js`), `// ${g.id} quality ${g.cur.toFixed(3)} ${P.fmtDesc(g)} (${g.code.length} chars; ${g.op})\n` + g.code);
    const best = this.archive.best(); if (best) fs.writeFileSync(path.join(this.dir, 'best.js'), `// ${best.id} quality ${best.cur.toFixed(3)} ${P.fmtDesc(best)}\n` + best.code);
    fs.writeFileSync(path.join(this.dir, 'map.txt'), this.mapText());
  }
  load() {
    const s = JSON.parse(fs.readFileSync(path.join(this.dir, 'state.json'), 'utf8'));
    Object.assign(this, { gen: s.gen, epoch: s.epoch, nextId: s.nextId, counts: s.counts, bandit: s.bandit, valCache: s.valCache || {}, infeasible: s.infeasible, seen: new Set(s.seen) });
    for (const g of s.elites) { this.archive.cells.set(this.archive.key(g.cell), g); }
  }
  mapText() { return `generation ${this.gen}, epoch ${this.epoch}: ${this.archive.size}/${this.archive.nx * this.archive.ny} cells, QD-score ${this.archive.qd().toFixed(3)}, best ${(this.archive.best() || { cur: 0 }).cur.toFixed(3)}\nquality of the elite in each cell (rows: ${AXES[1].name}, columns: ${AXES[0].name})\n` + this.archive.render('cur'); }

  // ---- evaluation ----
  async runStarts(code, starts) { this.counts.episodes += starts.length; return this.pool.runBatch(code, starts, this.epOpts()); }
  async evaluate(code, { cascade } = {}) {
    const starts = this.batchStarts(), k1 = Math.min(this.a.cascade, starts.length);
    const r1 = await this.runStarts(code, starts.slice(0, k1)), a1 = aggregate(r1);
    if (cascade && (r1.every(r => r.error && !r.points))) return { aborted: 'crashed on every start', results: r1, agg: a1 };
    if (cascade && starts.length > k1) {
      const cell = this.archive.cellOf([a1.wheels, a1.offencesPerMin]), inc = this.archive.get(cell);
      const incEp = inc && inc.scores && inc.scores[this.epoch];
      if (a1.quality === 0 && this.archive.size > 0) return { aborted: 'no progress on the first starts', results: r1, agg: a1 };
      if (inc && incEp && a1.quality < 0.5 * (incEp.slice(0, k1).reduce((s, v) => s + v, 0) / k1)) return { aborted: 'far below the elite of its cell on the first starts', results: r1, agg: a1 };
    }
    const r2 = starts.length > k1 ? await this.runStarts(code, starts.slice(k1)) : [], results = r1.concat(r2);
    return { results, agg: aggregate(results) };
  }
  // fill in a genome's score for the current epoch (running descriptors over everything it has played)
  record(g, ev) {
    g.eval = ev; g.cur = ev.agg.quality; g.scores = g.scores || {}; g.scores[this.epoch] = ev.results.map(r => r.quality);
    g.descN = (g.descN || 0) + ev.results.length; g.descSum = g.descSum || [0, 0];
    g.descSum[0] += ev.agg.wheels * ev.results.length; g.descSum[1] += ev.agg.offencesPerMin * ev.results.length; g.desc = [g.descSum[0] / g.descN, g.descSum[1] / g.descN];
  }
  makeGenome(code, meta) { return { id: 'g' + this.nextId++, code, op: meta.op, hint: meta.hint, parents: meta.parents || [], model: meta.model, gen: this.gen, born: Date.now() }; }

  // ---- variation ----
  pickParent() {
    const els = this.archive.elites(); if (this.rng() < 0.25) return els[Math.floor(this.rng() * els.length)];
    const w = els.map(g => g.cur + 0.05), tot = w.reduce((s, v) => s + v, 0); let r = this.rng() * tot; for (let i = 0; i < els.length; i++) { if ((r -= w[i]) < 0) return els[i]; } return els[0];
  }
  pickInspirations(parent, n = 2) { const others = this.archive.elites().filter(g => g !== parent); for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; } return others.slice(0, n); }
  pickHint() {
    const hs = P.HINTS, w = hs.map(h => { const b = this.bandit[h.id]; return (b.wins + 1) / (b.tries + 3); }), tot = w.reduce((s, v) => s + v, 0); let r = this.rng() * tot;
    for (let i = 0; i < hs.length; i++) if ((r -= w[i]) < 0) return hs[i]; return hs[0];
  }
  plan() {
    const r = this.rng(), els = this.archive.elites();
    if (this.infeasible.length && r < 0.12) { const g = this.infeasible[Math.floor(this.rng() * this.infeasible.length)]; return { op: 'repair', infeasible: g, prompt: P.repairPrompt({ g, reason: g.reason, limits: this.limits }), format: 'full' }; }
    if (els.length >= 2 && r < 0.35) { const a = this.pickParent(); const bs = els.filter(g => g !== a); const b = bs[Math.floor(this.rng() * bs.length)]; const hint = this.rng() < 0.25 ? P.HINTS.find(h => h.id === 'simplify') : null; return { op: 'crossover', parents: [a, b], hint, prompt: P.crossoverPrompt({ a, b, hint, limits: this.limits }), format: 'full' }; }
    const parent = this.pickParent(), hint = this.pickHint(), mode = this.rng() < 0.7 ? 'diff' : 'full';
    let target = null; if (this.rng() < 0.35) { const e = this.archive.emptyNear(parent.cell || this.archive.cellOf(parent.desc)); if (e.length) { const c = e[Math.floor(this.rng() * e.length)]; target = { cell: c, desc: this.archive.centre(c) }; } }
    return { op: 'mutate', parents: [parent], hint, target, mode, prompt: P.mutationPrompt({ parent, inspirations: this.pickInspirations(parent), hint, target, mode, limits: this.limits }), format: mode };
  }
  // ask the LLM and turn its reply into candidate source; returns { code } or { error }
  async produce(plan) {
    let res; try { res = await this.llm.ask(plan.prompt); } catch (e) { this.counts.llmFail++; return { error: 'llm: ' + String(e.message).slice(0, 100) }; }
    const base = plan.op === 'repair' ? plan.infeasible.code : plan.parents[0].code;
    const out = plan.format === 'diff' ? P.applyDiff(base, res.text) : (P.extractCode(res.text) ? { code: P.extractCode(res.text) } : { error: 'no code block' });
    if (out.error) { this.counts.parseFail++; return { error: out.error, model: res.model }; }
    return { code: out.code, model: res.model };
  }

  async child(plan, idx) {
    const tag = `g${this.gen}c${idx}`; this.counts.children++;
    const prod = await this.produce(plan);
    const hintId = plan.hint ? plan.hint.id : plan.op;
    const bump = win => { if (plan.hint && this.bandit[plan.hint.id]) { this.bandit[plan.hint.id].tries++; if (win) this.bandit[plan.hint.id].wins++; } };
    if (prod.error) { this.log(`${tag} ${plan.op}/${hintId}: ${prod.error}`); bump(false); this.jlog({ ev: 'fail', tag, op: plan.op, hint: hintId, error: prod.error }); return; }
    const h = hash(prod.code); if (this.seen.has(h)) { this.counts.duplicates++; this.log(`${tag} ${plan.op}/${hintId} (${prod.model}): duplicate of a known controller`); bump(false); return; } this.seen.add(h);
    const v = validate(prod.code, this.limits);
    const parents = (plan.parents || (plan.infeasible ? [plan.infeasible.parentId] : [])).map(p => (p && p.id) || p);
    if (!v.ok) { this.counts.infeasible++; this.infeasible.push({ id: tag, code: prod.code, reason: v.reason, parentId: parents[0] }); if (this.infeasible.length > 40) this.infeasible.shift();
      this.log(`${tag} ${plan.op}/${hintId} (${prod.model}): infeasible: ${v.reason}`); bump(false); this.jlog({ ev: 'infeasible', tag, op: plan.op, hint: hintId, reason: v.reason }); return; }
    if (plan.op === 'repair') this.infeasible = this.infeasible.filter(g => g !== plan.infeasible);
    const g = this.makeGenome(prod.code, { op: plan.op, hint: hintId, parents, model: prod.model });
    const ev = await this.evaluate(prod.code, { cascade: true });
    if (ev.aborted) { this.counts.aborted++; this.log(`${tag} ${plan.op}/${hintId} (${prod.model}): stopped early (${ev.aborted}); q ${ev.agg.quality.toFixed(2)} on ${ev.results.length}`); bump(false); this.jlog({ ev: 'aborted', tag, op: plan.op, hint: hintId, why: ev.aborted, q: ev.agg.quality }); return; }
    this.record(g, ev); this.archive.place(g);
    const inc = this.archive.get(g.cell); let verdict;
    if (!inc) verdict = this.archive.contest(g);
    else {
      // the incumbent's score may come from an earlier batch: put both on the current one before they fight
      if (!(inc.scores && inc.scores[this.epoch]) && g.cur >= 0.5 * inc.cur) { const iev = await this.evaluate(inc.code, { cascade: false }); this.record(inc, iev); }
      verdict = (inc.scores && inc.scores[this.epoch]) ? this.archive.contest(g) : 'worse';
    }
    this.counts[verdict]++; bump(verdict !== 'worse');
    this.log(`${tag} ${plan.op}/${hintId}${plan.target ? '→' + AXES[0].label[plan.target.cell[0]] + '/' + AXES[1].label[plan.target.cell[1]] : ''} (${prod.model}) q=${g.cur.toFixed(3)} ${P.fmtDesc(g)} cell(${g.cell}) ${verdict.toUpperCase()}${inc && verdict !== 'new' ? ' vs ' + inc.cur.toFixed(3) : ''} [${g.code.length}c]`);
    this.jlog({ ev: 'child', tag, id: g.id, op: plan.op, hint: hintId, model: prod.model, q: g.cur, desc: g.desc, cell: g.cell, verdict, chars: g.code.length, parents: g.parents });
  }

  // ---- the loop ----
  async init() {
    this.pool = new Pool(this.a.workers);
    if (this.a.resume && fs.existsSync(path.join(this.dir, 'state.json'))) { this.load(); this.log(`resumed ${this.dir} at generation ${this.gen}`); return; }
    fs.writeFileSync(this.logFile, ''); this.jlog({ ev: 'start', args: this.a });
    const seeds = this.a.seeds.split(',').filter(Boolean).map(f => ({ f, code: fs.readFileSync(path.resolve(__dirname, f), 'utf8') }));
    const evs = await Promise.all(seeds.map(async s => { const v = validate(s.code, this.limits); if (!v.ok) throw new Error(`seed ${s.f} is not valid: ${v.reason}`); return this.evaluate(s.code, { cascade: false }); }));
    seeds.forEach((s, i) => { const g = this.makeGenome(s.code, { op: 'seed', hint: path.basename(s.f), parents: [] }); this.seen.add(hash(s.code)); this.record(g, evs[i]); const verdict = this.archive.contest(g); this.counts[verdict]++;
      this.log(`seed ${s.f}: q=${g.cur.toFixed(3)} ${P.fmtDesc(g)} cell(${g.cell}) ${verdict}`); this.jlog({ ev: 'seed', file: s.f, q: g.cur, desc: g.desc, cell: g.cell }); });
    this.save();
  }
  async generation() {
    this.gen++; if ((this.gen - 1) % this.a.epoch === 0 && this.gen > 1) { this.epoch++; this.log(`-- epoch ${this.epoch}: a fresh batch of ${this.a.batch} starts`); }
    const plans = []; for (let i = 0; i < this.a.children; i++) plans.push(this.plan());
    // LLM calls are slow and evaluations are CPU-bound, so children run concurrently up to llmPar
    let next = 0; const lanes = []; for (let l = 0; l < Math.min(this.a.llmPar, plans.length); l++) lanes.push((async () => { while (next < plans.length) { const i = next++; try { await this.child(plans[i], i); } catch (e) { this.log(`g${this.gen}c${i} crashed: ${String(e.stack || e).slice(0, 300)}`); } } })());
    await Promise.all(lanes);
    // a batch change means every elite's score is from an older batch: rebuild the grid from what each has now
    this.archive.rebuild(this.archive.elites());
    if (this.a.valEvery && this.gen % this.a.valEvery === 0) await this.validateTop();
    this.jlog({ ev: 'gen', epoch: this.epoch, cells: this.archive.size, qd: +this.archive.qd().toFixed(3), best: +(this.archive.best() || { cur: 0 }).cur.toFixed(3), episodes: this.counts.episodes });
    this.save(); this.log(this.mapText().split('\n').slice(0, 1)[0] + ` | ${Math.round((Date.now() - this.t0) / 60000)} min, ${this.counts.episodes} episodes, ${this.pool.stats.killed} killed`);
  }
  // how the best few elites do on the held-out neighbourhoods (never used for selection)
  async validateTop() {
    const hs = makeStarts(9000 + this.a.seed, this.a.valN, 'heldout'), top = this.archive.elites().sort((a, b) => b.cur - a.cur).slice(0, 3);
    for (const g of top) { const h = hash(g.code); if (!this.valCache[h]) { const r = await this.pool.runBatch(g.code, hs, this.epOpts()); this.valCache[h] = aggregate(r).quality; } g.heldout = this.valCache[h]; }
    this.log('held-out check: ' + top.map(g => `${g.id} train ${g.cur.toFixed(2)} / held-out ${g.heldout.toFixed(2)}`).join('; ')); this.jlog({ ev: 'heldout', top: top.map(g => ({ id: g.id, train: g.cur, heldout: g.heldout })) });
  }
  async run() {
    await this.init();
    while (this.gen < this.a.gens && !(this.a.minutes && (Date.now() - this.t0) / 60000 > this.a.minutes)) await this.generation();
    this.save(); this.log('\n' + this.mapText()); this.pool.close();
  }
}

if (require.main === module) {
  const run = new Run(parseArgs(process.argv.slice(2)));
  run.run().then(() => process.exit(0)).catch(e => { console.error(e); try { run.pool && run.pool.close(); } catch (x) { void x; } process.exit(1); });
}
module.exports = { Run, parseArgs, hash };
