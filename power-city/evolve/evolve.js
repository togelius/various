#!/usr/bin/env node
'use strict';
/* POWER CITY controller evolution: MAP-Elites over controller *source code*,
 * with an LLM as the variation operator.
 *
 *   node evolve.js init   <run>                 seed the archive from seeds/*.js
 *   node evolve.js propose <run> [n]            write n LLM prompts to <run>/queue/genG/
 *   node evolve.js ingest <run>                 evaluate answered candidates, update archive
 *   node evolve.js auto   <run> <gens> [n]      propose+call `claude -p`+ingest (needs CLI auth)
 *   node evolve.js report <run>                 held-out evaluation of every elite + ASCII map
 *
 * Ideas borrowed on purpose:
 *  AlphaEvolve: program database of elites, prompts built from sampled parents
 *   plus 'inspiration' programs, rich evaluator feedback in the prompt, cheap
 *   evaluation cascade, rewrite-whole-program operators.
 *  Talakat (Khalifa et al.): constrained MAP-Elites with a feasible and an
 *   infeasible population; infeasible candidates (too long, crashing) are kept
 *   and sampled as parents so they can be repaired instead of thrown away.
 *  Anti-overfitting: every comparison uses a fresh batch of random start
 *   positions (stage, encounter, distance, hp, weapon, seed); incumbent and
 *   challenger meet on the SAME batch; report() uses a held-out set.
 */
var fs = require('fs'), path = require('path'), cp = require('child_process');
var E = require('./episode.js'), H = require('./headless.js');

var NA = 6, NB = 6, A_MAX = 3.0;          // dim A: attacks per second; dim B: share of non-basic moves
var K = 6;                                // scenarios per comparison batch
var cmd = process.argv[2], run = process.argv[3];
var DIR = path.join(__dirname, 'runs', run || 'x');

function rngOf(seed) { return H.loadGame().PC.RNG(seed); }
function load() { return JSON.parse(fs.readFileSync(path.join(DIR, 'archive.json'), 'utf8')); }
function save(A) { fs.writeFileSync(path.join(DIR, 'archive.json'), JSON.stringify(A, null, 1)); }
function log(A, line) { fs.appendFileSync(path.join(DIR, 'log.txt'), line + '\n'); console.log(line); }
function cellOf(d) {
  var a = Math.min(NA - 1, Math.floor(d.rate / A_MAX * NA)), b = Math.min(NB - 1, Math.floor(d.special * NB));
  return a + ',' + b;
}

/* evaluate source on a batch of scenarios; returns mean quality, descriptors, feedback */
var sbForRng = null;
function batch(seed) {
  sbForRng = sbForRng || H.loadGame();
  var r = sbForRng.PC.RNG(seed), out = [];
  for (var i = 0; i < K; i++) out.push(E.makeScenario(r, sbForRng));
  return out;
}
function evaluate(src, scs, quick) {
  var res = [], i;
  for (i = 0; i < scs.length; i++) {
    var r = E.runEpisode(src, scs[i]); res.push(r);
    if (r.crash) break;
    if (quick && i === 0 && r.q < 0.02 && r.why !== 'cleared') break;      // cascade: hopeless on the first, stop
  }
  var n = res.length, q = 0, rate = 0, att = 0, sp = 0, crash = null;
  res.forEach(function (r) { q += r.q; rate += r.rate; att += r.attacks; sp += r.special * r.attacks; if (r.crash) crash = r.crash; });
  var fb = res.map(function (r) {
    var s = r.sc;
    return 'stage ' + (s.stage + 1) + ' fight ' + (s.enc + 1) + ' start hp ' + Math.round(s.hp * 100) + '%' + (s.weapon ? ' +' + s.weapon : '') +
      ': ' + r.why + ', progress ' + r.q.toFixed(2) + ', damage taken ' + r.hurt + ', attacks/s ' + r.rate.toFixed(2) + (r.crash ? ', CRASH ' + r.crash : '');
  });
  return { q: q / (scs.length), rate: rate / n, special: att ? sp / att : 0, n: n, crash: crash, feedback: fb };
}

function describe(el) {
  return 'score ' + el.q.toFixed(3) + ' | attacks/sec ' + el.rate.toFixed(2) + ' | non-basic move share ' + el.special.toFixed(2);
}

// ------------------------------------------------------------------ prompts
var API = fs.readFileSync(path.join(__dirname, 'PROMPT_API.md'), 'utf8');
function promptFor(A, kind, parents, inspirations, target, note) {
  var s = API + '\n\n## Your job: ' + kind + '\n';
  if (target) s += 'Aim for the archive cell with ' + target + '. (Playstyle axes: attacks per second, and what share of attacks are not plain jabs/crosses.)\n';
  if (note) s += note + '\n';
  parents.forEach(function (p, i) {
    s += '\n### Parent ' + (i + 1) + ' (' + (p.infeasible ? 'INFEASIBLE: ' + p.infeasible.join('; ') : describe(p)) + ')\n';
    if (p.feedback) s += 'Evaluator feedback on its latest batch of start positions:\n' + p.feedback.map(function (l) { return '- ' + l; }).join('\n') + '\n';
    s += '```js\n' + p.src + '\n```\n';
  });
  if (inspirations.length) {
    s += '\n## Other archive members for inspiration (different playstyles)\n';
    inspirations.forEach(function (p) { s += '\n### ' + describe(p) + '\n```js\n' + p.src + '\n```\n'; });
  }
  s += '\nReply with ONE complete replacement controller in a single ```js block (no other code blocks). Keep it under ' + E.MAX_CHARS + ' characters and ' + E.MAX_LINES + ' lines. Briefly say in one sentence before the block what you changed and why.\n';
  return s;
}

function choose(arr, r) { return arr[Math.floor(r() * arr.length) % arr.length]; }

function propose(A, n) {
  var g = A.gen + 1, r = rngOf(A.seed * 1000 + g), dir = path.join(DIR, 'queue', 'gen' + String(g).padStart(3, '0'));
  fs.mkdirSync(dir, { recursive: true });
  var cells = Object.keys(A.cells), items = [];
  var empties = [];
  for (var a = 0; a < NA; a++) for (var b = 0; b < NB; b++) if (!A.cells[a + ',' + b]) empties.push([a, b]);
  for (var i = 0; i < n; i++) {
    var u = r(), op, parents, target = null, note = '';
    var p1 = A.cells[choose(cells, r)];
    var others = cells.map(function (c) { return A.cells[c]; }).filter(function (c) { return c !== p1; });
    var insp = [];
    for (var k = 0; k < 2 && others.length; k++) insp.push(choose(others, r));
    if (A.infeasible.length && u < 0.15) { op = 'REPAIR: this program broke a rule. Fix it so it is valid, small and plays well'; parents = [choose(A.infeasible, r)]; insp = []; }
    else if (u < 0.50) { op = 'MUTATE: improve this controller'; parents = [p1]; note = 'Read the feedback: find where it loses progress or health and fix that, or add a new behaviour. Prefer small, targeted changes.'; }
    else if (u < 0.70 && others.length) { op = 'CROSSOVER: combine the best ideas of two controllers into one'; parents = [p1, choose(others, r)]; insp = []; }
    else if (u < 0.88 && empties.length) {
      var e = choose(empties, r); op = 'EXPLORE: rewrite this controller to play in a different style while still making progress'; parents = [p1];
      target = 'attacks/sec about ' + ((e[0] + 0.5) / NA * A_MAX).toFixed(1) + ' and non-basic move share about ' + ((e[1] + 0.5) / NB).toFixed(2);
    } else { op = 'SIMPLIFY: rewrite this controller to be shorter and cleaner without losing score'; parents = [p1]; insp = []; }
    var id = 'g' + g + 'c' + i, meta = { id: id, op: op.split(':')[0], parents: parents.map(function (p) { return p.id; }), target: target };
    fs.writeFileSync(path.join(dir, id + '.prompt.md'), promptFor(A, op, parents, insp, target, note));
    fs.writeFileSync(path.join(dir, id + '.meta.json'), JSON.stringify(meta));
    items.push(id);
  }
  A.gen = g; save(A);
  log(A, '[gen ' + g + '] proposed ' + items.length + ' prompts in ' + dir);
  return dir;
}

function extract(text) {
  var m = /```(?:js|javascript)?\n([\s\S]*?)```/.exec(text);
  return m ? m[1].trim() : text.trim();
}

function ingest(A) {
  var base = path.join(DIR, 'queue'), added = 0;
  fs.readdirSync(base).sort().forEach(function (gd) {
    var dir = path.join(base, gd);
    fs.readdirSync(dir).filter(function (f) { return /\.js$/.test(f); }).sort().forEach(function (f) {
      var id = f.replace(/\.js$/, '');
      if (A.seen[id]) return;
      A.seen[id] = 1;
      var meta = JSON.parse(fs.readFileSync(path.join(dir, id + '.meta.json'), 'utf8'));
      var src = extract(fs.readFileSync(path.join(dir, f), 'utf8'));
      added += place(A, { id: id, src: src, op: meta.op, parents: meta.parents, gen: A.gen });
    });
  });
  save(A); log(A, '[ingest] ' + added + ' candidates placed; archive ' + Object.keys(A.cells).length + '/' + (NA * NB) + ' cells, QD-score ' + qd(A).toFixed(3));
}
function qd(A) { return Object.keys(A.cells).reduce(function (s, c) { return s + A.cells[c].q; }, 0); }

function place(A, cand) {
  var viol = E.feasibility(cand.src);
  if (viol.length) { cand.infeasible = viol; A.infeasible.push(cand); if (A.infeasible.length > 12) A.infeasible.shift(); log(A, '  ' + cand.id + ' [' + cand.op + '] infeasible: ' + viol[0]); return 0; }
  var bseed = A.seed * 7919 + (++A.nbatch), scs = batch(bseed);
  var ev = evaluate(cand.src, scs, true);
  if (ev.crash) { cand.infeasible = ['runtime: ' + ev.crash]; A.infeasible.push(cand); if (A.infeasible.length > 12) A.infeasible.shift(); log(A, '  ' + cand.id + ' [' + cand.op + '] crashed: ' + ev.crash); return 0; }
  cand.q = ev.q; cand.rate = ev.rate; cand.special = ev.special; cand.feedback = ev.feedback; cand.bseed = bseed;
  var c = cellOf(cand), inc = A.cells[c];
  if (!inc) { A.cells[c] = cand; log(A, '  ' + cand.id + ' [' + cand.op + '] -> NEW cell ' + c + ' ' + describe(cand)); return 1; }
  var incEv = evaluate(inc.src, scs, false);                       // same batch: a fair fight
  if (cand.q > incEv.q) {
    cand.beat = inc.id; A.cells[c] = cand; log(A, '  ' + cand.id + ' [' + cand.op + '] -> cell ' + c + ' beats ' + inc.id + ' ' + cand.q.toFixed(3) + ' > ' + incEv.q.toFixed(3)); return 1;
  }
  inc.q = incEv.q; inc.rate = incEv.rate; inc.special = incEv.special; inc.feedback = incEv.feedback;   // refresh incumbent with its fresher number
  log(A, '  ' + cand.id + ' [' + cand.op + '] -> cell ' + c + ' loses to ' + inc.id + ' ' + cand.q.toFixed(3) + ' <= ' + incEv.q.toFixed(3));
  return 0;
}

function init() {
  fs.mkdirSync(DIR, { recursive: true });
  var A = { seed: parseInt(process.argv[4] || '1', 10), gen: 0, nbatch: 0, cells: {}, infeasible: [], seen: {} };
  fs.readdirSync(path.join(__dirname, 'seeds')).forEach(function (f) {
    place(A, { id: 'seed-' + f.replace('.js', ''), src: fs.readFileSync(path.join(__dirname, 'seeds', f), 'utf8').trim(), op: 'SEED', parents: [] });
  });
  save(A);
}

function report(A) {
  var held = []; var r = rngOf(424242), sb = H.loadGame();
  for (var i = 0; i < 24; i++) held.push(E.makeScenario(r, sb));
  var rows = [];
  var grid = {};
  Object.keys(A.cells).forEach(function (c) {
    var el = A.cells[c], ev = evaluate(el.src, held, false); grid[c] = ev.q;
    rows.push([c, el.id, el.src.length, el.q.toFixed(3), ev.q.toFixed(3)]);
  });
  console.log('cell  id  chars  train  held-out(24 fixed starts)');
  rows.forEach(function (x) { console.log(x.join('  ')); });
  console.log('\nheld-out map (rows: attacks/s low->high, cols: non-basic share low->high)');
  for (var a = 0; a < NA; a++) { var line = ''; for (var b = 0; b < NB; b++) line += (grid[a + ',' + b] !== undefined ? grid[a + ',' + b].toFixed(2) : ' .  ') + ' '; console.log(line); }
  return { rows: rows, grid: grid };
}

if (cmd === 'init') init();
else if (cmd === 'propose') propose(load(), parseInt(process.argv[4] || '8', 10));
else if (cmd === 'ingest') ingest(load());
else if (cmd === 'report') report(load());
else if (cmd === 'auto') {
  var gens = parseInt(process.argv[4], 10), n = parseInt(process.argv[5] || '8', 10);
  for (var g = 0; g < gens; g++) {
    var A = load(), dir = propose(A, n);
    fs.readdirSync(dir).filter(function (f) { return /prompt\.md$/.test(f); }).forEach(function (f) {
      var res = cp.spawnSync('claude', ['-p', '--model', process.env.EVO_MODEL || 'sonnet', '--tools', ''], { input: fs.readFileSync(path.join(dir, f)), encoding: 'utf8', timeout: 300000 });
      if (res.status === 0) fs.writeFileSync(path.join(dir, f.replace('.prompt.md', '.js')), res.stdout);
      else console.log('llm call failed:', (res.stderr || res.stdout || '').slice(0, 120));
    });
    ingest(load());
  }
}
