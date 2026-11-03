#!/usr/bin/env node
// LLM-driven MAP-Elites over Tall Order controllers.
//   node evolve.js --name run1 --gens 20 --batch 4 --models haiku:0.7,sonnet:0.3
// See README.md for the design. Everything the run produces goes in runs/<name>/.
const fs = require('fs');
const path = require('path');
const { Pool } = require('./pool');
const { Archive, AXES } = require('./archive');
const { makeLLM } = require('./llm');
const V = require('./validate');
const P = require('./prompts');

// ---------------------------------------------------------------- options
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'; opt[k] = v; }
const O = {
  name: opt.name || 'run', gens: +(opt.gens || 20), batch: +(opt.batch || 4), workers: +(opt.workers || 4), starts: +(opt.starts || 12),
  epochGens: +(opt['epoch-gens'] || 3), heldout: +(opt.heldout || 36), heldoutEvery: +(opt['heldout-every'] || 3), seed: +(opt.seed || 1),
  backend: opt.backend || 'claude-cli', minutes: +(opt.minutes || 0), libEvery: +(opt['lib-every'] || 6), maxChars: +(opt['max-chars'] || V.LIMITS.maxChars),
  models: (opt.models || 'haiku:1').split(',').map(s => { const [name, w] = s.split(':'); return { name, weight: +(w || 1) }; }),
  resume: opt.resume === 'true',
};
V.LIMITS.maxChars = O.maxChars;
const DIR = path.join(__dirname, 'runs', O.name);
fs.mkdirSync(path.join(DIR, 'elites'), { recursive: true });
const logf = path.join(DIR, 'log.jsonl');
const log = ev => fs.appendFileSync(logf, JSON.stringify(Object.assign({ at: new Date().toISOString() }, ev)) + '\n');
const say = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// seeded rng for the operator choices
let rs = (O.seed * 2654435761) >>> 0;
const rnd = () => { rs = (rs + 0x6D2B79F5) | 0; let t = Math.imul(rs ^ rs >>> 15, 1 | rs); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const choice = a => a[Math.floor(rnd() * a.length)];
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;

// ---------------------------------------------------------------- state
const pool = new Pool(O.workers), llm = makeLLM({ backend: O.backend, models: O.models });
const archive = new Archive();
let lib = '', infeasible = [], nextId = 1, evals = 0, gen = 0, epoch = 0, specs = [];
const hintStats = Object.fromEntries(P.HINTS.map(h => [h.id, { tries: 0, succ: 0 }]));
const opStats = {};
const bump = (op, ok) => { const s = opStats[op] || (opStats[op] = { tries: 0, ok: 0 }); s.tries++; if (ok) s.ok++; };
const full = code => lib ? lib + '\n' + code : code;

// ---------------------------------------------------------------- evaluation
function summarize(results, start) {
  const n = results.length, byFloor = {};
  results.forEach(r => { const f = byFloor[r.floor] || (byFloor[r.floor] = { floor: r.floor, progress: [], win: 0, deaths: 0, killedBy: [] }); f.progress.push(r.progress); f.win += r.win ? 1 : 0; f.deaths += r.deaths || 0; for (const k of r.killedBy || []) if (f.killedBy.length < 3) f.killedBy.push(k); });
  const stuck = [], errors = [];
  for (const r of results) {
    if (!r.win && stuck.length < 4 && r.end !== 'crash') stuck.push(`start on floor ${r.floor}: ended at y=${r.stuckAt} near (${(r.lastPos || []).join(',')}) having reached y=${r.reach}${r.lastGainT != null ? ' by t=' + Math.round(r.lastGainT) + 's' : ''}; ${(r.log || []).slice(-1)[0] || ''}`);
    if (r.err && errors.length < 2 && !errors.includes(r.err)) errors.push(r.err);
  }
  return {
    n, wins: results.filter(r => r.win).length, deaths: mean(results.map(r => r.deaths || 0)), stuck, errors,
    byFloor: Object.values(byFloor).sort((a, b) => a.floor - b.floor).map(f => ({ floor: f.floor, progress: mean(f.progress), win: f.win === f.progress.length, deaths: f.deaths, killedBy: f.killedBy })),
    cur: mean(results.map(r => r.progress)), desc: [mean(results.map(r => r.fire)), mean(results.map(r => r.pace))],
  };
}
async function score(g, forSpecs) { // evaluates a genome on a start set; returns the summary
  const res = await pool.evaluate(full(g.code), forSpecs);
  return summarize(res);
}
function apply(g, s) {
  g.summary = s; g.cur = s.cur; g.wins = s.wins;
  (g.hist || (g.hist = [])).push(+s.cur.toFixed(4)); (g.descHist || (g.descHist = [])).push(s.desc);
  g.desc = [mean(g.descHist.map(d => d[0])), mean(g.descHist.map(d => d[1]))];
  g.cell = archive.cellOf(g.desc);
}

async function newEpoch() {
  epoch++;
  specs = await pool.starts(O.seed * 1000 + epoch * 7919, O.starts);
  const els = archive.elites();
  await Promise.all(els.map(async g => { apply(g, await score(g, specs)); }));
  archive.rebuild(els.slice());
  log({ ev: 'epoch', epoch, evals, rescored: els.length, cells: archive.size, qd: +archive.qd().toFixed(3), floors: specs.map(s => s.floor).join('') });
  say(`epoch ${epoch}: fresh ${specs.length} starts, rescored ${els.length} elites -> ${archive.size} cells, QD ${archive.qd().toFixed(2)}`);
}

// ---------------------------------------------------------------- operators
function pickParent() {
  const els = archive.elites();
  if (rnd() < 0.5) return choice(els);
  let best = choice(els); for (let i = 0; i < 2; i++) { const c = choice(els); if (c.cur > best.cur) best = c; } return best;
}
function pickHint() {
  const w = P.HINTS.map(h => (hintStats[h.id].succ + 1) / (hintStats[h.id].tries + 3));
  let r = rnd() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) if ((r -= w[i]) < 0) return P.HINTS[i];
  return P.HINTS[0];
}
function pickTarget(parent) {
  if (rnd() < 0.4) return null;
  const empty = archive.emptyCells(); if (!empty.length) return null;
  const near = empty.filter(c => Math.abs(c[0] - parent.cell[0]) <= 2 && Math.abs(c[1] - parent.cell[1]) <= 2);
  const c = choice(near.length ? near : empty), d = archive.centre(c); d.cell = c; return d;
}
function pickInspirations(parent, k) {
  const others = archive.elites().filter(g => g !== parent); const out = [];
  if (others.length) { const top = others.slice().sort((a, b) => b.cur - a.cur)[0]; out.push(top); }
  while (out.length < k && out.length < others.length) { const c = choice(others); if (!out.includes(c)) out.push(c); }
  return out;
}
const fenced = t => P.extractCode(t);

async function produce() {
  const els = archive.elites(), roll = rnd();
  let op, parents, prompt, hint = pickHint(), target = null, mode = 'full', base = null;
  if (infeasible.length && roll < 0.2) {
    op = 'repair'; const inf = infeasible.splice(Math.floor(rnd() * infeasible.length), 1)[0]; parents = [inf];
    prompt = P.repairPrompt({ g: inf, reason: inf.reason, lib });
  } else if (els.length >= 2 && roll < 0.4) {
    op = 'crossover'; const a = pickParent(); let b = pickParent(); for (let i = 0; i < 5 && b === a; i++) b = choice(els);
    parents = [a, b]; prompt = P.crossoverPrompt({ a, b, hint, lib });
  } else {
    op = 'mutate'; const parent = pickParent(); parents = [parent]; target = pickTarget(parent); mode = rnd() < 0.75 ? 'diff' : 'full'; base = parent.code;
    prompt = P.mutationPrompt({ parent, inspirations: pickInspirations(parent, 2), hint, target, lib, mode });
  }
  let text, model;
  try { ({ text, model } = await llm.ask(prompt)); } catch (e) { log({ ev: 'llm-fail', op, err: String(e.message).slice(0, 200) }); return null; }
  let code;
  if (op === 'mutate' && mode === 'diff') { const r = P.applyDiff(base, text); if (r.error) { log({ ev: 'bad-diff', err: r.error }); bump(op + '-' + mode, false); return null; } code = r.code; }
  else code = fenced(text);
  if (!code) { log({ ev: 'no-code', op }); return null; }
  return { op: op === 'mutate' ? op + '-' + mode : op, hint: op === 'repair' ? null : hint, target, parents, code, model, repaired: op === 'repair' };
}

async function handle(c) {
  const g = { id: nextId++, code: c.code, op: c.op, parents: c.parents.map(p => p.id), gen, model: c.model, hint: c.hint && c.hint.id };
  const dup = archive.elites().find(e => e.code.trim() === g.code.trim());
  if (dup) { bump(c.op, false); log({ ev: 'duplicate', op: c.op }); return; }
  const v = V.check(g.code, { lib, maxChars: O.maxChars });
  if (!v.ok) {
    bump(c.op, false);
    if (!c.repaired && infeasible.length < 30 && ['size', 'syntax', 'runtime', 'forbidden', 'shape'].includes(v.kind)) infeasible.push({ id: g.id, code: g.code, reason: v.reason, kind: v.kind });
    log({ ev: 'infeasible', id: g.id, op: c.op, kind: v.kind, reason: v.reason.slice(0, 160) }); return;
  }
  const s = await score(g, specs); evals++;
  if (s.errors.length && s.cur === 0 && s.byFloor.every(f => f.progress === 0)) { bump(c.op, false); log({ ev: 'dud', id: g.id, errors: s.errors }); if (!c.repaired && infeasible.length < 30) infeasible.push({ id: g.id, code: g.code, reason: 'runtime error during play: ' + s.errors[0], kind: 'runtime' }); return; }
  apply(g, s);
  const res = archive.add(g);
  const ok = res !== 'worse';
  bump(c.op, ok); if (c.hint) { hintStats[c.hint.id].tries++; if (ok) hintStats[c.hint.id].succ++; }
  const parentCur = Math.max(...c.parents.map(p => p.cur || 0));
  log({ ev: 'child', id: g.id, op: c.op, hint: g.hint, model: g.model, parents: g.parents, res, cur: +g.cur.toFixed(3), parentCur: +parentCur.toFixed(3), desc: g.desc.map(v => +v.toFixed(3)), cell: g.cell, chars: g.code.length, wins: s.wins, usesLib: lib ? /[\w]+\(/.test(g.code) && libNames().some(n => g.code.includes(n + '(')) : false });
  say(`  #${g.id} ${c.op}${g.hint ? '/' + g.hint : ''} [${g.model}] -> score ${g.cur.toFixed(3)} (parent ${parentCur.toFixed(3)}) cell ${g.cell} ${res.toUpperCase()}${s.wins ? ' wins ' + s.wins + '/' + s.n : ''}`);
}
const libNames = () => [...lib.matchAll(/function\s+(\w+)/g)].map(m => m[1]);

// ---------------------------------------------------------------- Continual Abstraction Discovery (append-only helper library)
async function discoverAbstractions() {
  const top = archive.elites().sort((a, b) => b.cur - a.cur).slice(0, 5);
  if (top.length < 3) return;
  let text; try { ({ text } = await llm.ask(P.libPrompt({ elites: top, lib }))); } catch (e) { return; }
  const add = P.extractCode(text); if (!add) return;
  const next = (lib ? lib + '\n' : '') + add.trim() + '\n';
  if (next.length > V.LIMITS.libChars) { log({ ev: 'lib-too-big', n: next.length }); return; }
  for (const g of archive.elites()) { const v = V.check(g.code, { lib: next, maxChars: O.maxChars }); if (!v.ok) { log({ ev: 'lib-rejected', why: v.reason }); say('  helper library update rejected: breaks an elite'); return; } }
  const probe = V.check('function step(o,m){return {move:1};}', { lib: next }); if (!probe.ok) { log({ ev: 'lib-rejected', why: probe.reason }); return; }
  lib = next; log({ ev: 'lib', chars: lib.length, names: libNames() }); say(`  helper library now ${lib.length} chars: ${libNames().join(', ')}`);
  // the library changes what an elite's source means only by adding names, but re-score so the archive stays honest
  const els = archive.elites(); await Promise.all(els.map(async g => apply(g, await score(g, specs)))); archive.rebuild(els.slice());
}

// ---------------------------------------------------------------- held-out validation (never used for selection)
let heldoutSpecs = null;
async function heldout(tag) {
  if (!heldoutSpecs) heldoutSpecs = await pool.starts(987654321, O.heldout);
  const els = archive.elites(); const rows = [];
  await Promise.all(els.map(async g => { const s = await score(g, heldoutSpecs); rows.push({ id: g.id, cell: g.cell, train: +g.cur.toFixed(3), held: +s.cur.toFixed(3), wins: s.wins, n: s.n, deaths: +s.deaths.toFixed(2) }); }));
  rows.sort((a, b) => b.held - a.held);
  const out = { tag, epoch, evals, mean_train: +mean(rows.map(r => r.train)).toFixed(3), mean_held: +mean(rows.map(r => r.held)).toFixed(3), best_held: rows[0] && rows[0].held, rows };
  fs.writeFileSync(path.join(DIR, 'heldout.json'), JSON.stringify(out, null, 1));
  log({ ev: 'heldout', tag, mean_train: out.mean_train, mean_held: out.mean_held, best_held: out.best_held });
  say(`HELD-OUT (${O.heldout} unseen starts, never used for selection): elites mean ${out.mean_held} (train ${out.mean_train}); best ${out.best_held}`);
  return out;
}

// ---------------------------------------------------------------- persistence
function save() {
  const els = archive.elites().sort((a, b) => b.cur - a.cur);
  const strip = g => ({ id: g.id, op: g.op, parents: g.parents, gen: g.gen, model: g.model, hint: g.hint, cur: g.cur, hist: g.hist, descHist: g.descHist, desc: g.desc, cell: g.cell, wins: g.wins, code: g.code, summary: g.summary });
  fs.writeFileSync(path.join(DIR, 'archive.json'), JSON.stringify({ opt: O, epoch, gen, evals, nextId, lib, hintStats, opStats, infeasible, elites: els.map(strip) }, null, 1));
  for (const f of fs.readdirSync(path.join(DIR, 'elites'))) fs.unlinkSync(path.join(DIR, 'elites', f));
  for (const g of els) fs.writeFileSync(path.join(DIR, 'elites', `cell_${g.cell[0]}_${g.cell[1]}_id${g.id}.js`), `// score ${g.cur.toFixed(3)}  trigger ${g.desc[0].toFixed(2)}  pace ${g.desc[1].toFixed(2)}  (${g.code.length} chars)\n` + g.code);
  if (els[0]) fs.writeFileSync(path.join(DIR, 'best.js'), (lib ? '// ---- helper library ----\n' + lib + '// ---- controller ----\n' : '') + els[0].code);
  fs.writeFileSync(path.join(DIR, 'lib.js'), lib);
  fs.writeFileSync(path.join(DIR, 'map.txt'), archive.render() + '\n');
}
function load() {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, 'archive.json'), 'utf8'));
  lib = j.lib || ''; infeasible = j.infeasible || []; nextId = j.nextId; evals = j.evals; gen = j.gen; epoch = j.epoch;
  Object.assign(hintStats, j.hintStats); Object.assign(opStats, j.opStats);
  for (const g of j.elites) { archive.cells.set(archive.key(g.cell), g); }
  say(`resumed ${archive.size} elites at gen ${gen}`);
}

// ---------------------------------------------------------------- main
(async () => {
  const t0 = Date.now();
  say(`run "${O.name}": backend ${O.backend}, models ${O.models.map(m => m.name + ':' + m.weight).join(',')}, ${O.workers} workers, batch ${O.batch}, size limit ${O.maxChars} chars`);
  if (O.resume && fs.existsSync(path.join(DIR, 'archive.json'))) { load(); await newEpoch(); }
  else {
    await newEpoch();
    const dir = path.join(__dirname, 'seeds');
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'idle.js')) {
      const g = { id: nextId++, code: fs.readFileSync(path.join(dir, f), 'utf8'), op: 'seed:' + f, parents: [], gen: 0 };
      const v = V.check(g.code, { maxChars: O.maxChars }); if (!v.ok) { say('seed rejected', f, v.reason); continue; }
      apply(g, await score(g, specs)); const r = archive.add(g); say(`  seed ${f}: score ${g.cur.toFixed(3)} trigger ${g.desc[0].toFixed(2)} pace ${g.desc[1].toFixed(2)} -> ${r}`);
    }
    save();
  }
  const end = gen + O.gens;
  while (gen < end && (!O.minutes || (Date.now() - t0) / 60000 < O.minutes)) {
    gen++;
    if (gen > 1 && (gen - 1) % O.epochGens === 0) await newEpoch();
    say(`generation ${gen}/${end}: ${O.batch} children in parallel (evals ${evals}, cells ${archive.size}/${archive.nx * archive.ny})`);
    const made = await Promise.all(Array.from({ length: O.batch }, () => produce()));
    for (const c of made) if (c) await handle(c);
    if (O.libEvery && gen % O.libEvery === 0) await discoverAbstractions();
    if (gen % O.heldoutEvery === 0) await heldout('gen' + gen);
    save();
    say('\n' + archive.render() + '\n');
  }
  await heldout('final');
  save();
  say(`done in ${((Date.now() - t0) / 60000).toFixed(1)} min. operator stats: ${JSON.stringify(opStats)}; hint stats: ${JSON.stringify(Object.fromEntries(Object.entries(hintStats).map(([k, v]) => [k, v.succ + '/' + v.tries])))}`);
  pool.close(); process.exit(0);
})().catch(e => { console.error(e); pool.close(); process.exit(1); });
