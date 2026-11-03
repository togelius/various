/* Read a run: the map, the elites, which operators earned their keep, and
 * whether anything was learned that holds up on starts selection never saw.
 *
 *   node tools/evo/report.js --run=NAME [--export]
 *
 * --export writes each elite to runs/NAME/elites/<cell>_<id>.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { Archive, DIMS } = require('./archive');

function arg(n, d) {
  const a = process.argv.find(s => s.startsWith('--' + n + '='));
  return a ? a.split('=').slice(1).join('=') : d;
}
const run = arg('run', 'default');
const DIR = path.join(__dirname, 'runs', run);
const archive = new Archive(JSON.parse(fs.readFileSync(path.join(DIR, 'archive.json'), 'utf8')));
const log = fs.readFileSync(path.join(DIR, 'log.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const kids = log.filter(l => l.id);
const elites = archive.elites().sort((a, b) => b.quality - a.quality);
const pct = (a, b) => b ? (100 * a / b).toFixed(0) + '%' : '-';

console.log('RUN ' + run + ': ' + kids.length + ' children, $' + kids.reduce((s, l) => s + (l.cost || 0), 0).toFixed(2) +
  ', ' + (Math.max(...kids.map(l => l.t || 0)) / 60).toFixed(0) + ' min\n');
console.log(archive.grid());
console.log('\ncells filled ' + elites.length + ' of ' + DIMS[0].bins * DIMS[1].bins +
  ';  QD score ' + archive.qd().toFixed(2) + ';  best ' + elites[0].quality.toFixed(3));

// ------------------------------------------------------------- the elites
console.log('\nELITES, best first  (train = the starts selection used; test = held-out starts)');
console.log('  ' + 'id'.padEnd(13) + 'cell'.padEnd(7) + 'train'.padStart(6) + 'test'.padStart(7) + 'aggr'.padStart(6) + ' ent'.padStart(7) +
  'size'.padStart(6) + '  op               intent');
for (const e of elites) {
  console.log('  ' + e.id.padEnd(13) + ('[' + e.cell + ']').padEnd(7) + e.quality.toFixed(3).padStart(6) +
    (e.test ? e.test.quality.toFixed(3) : '  -  ').padStart(7) + e.aggression.toFixed(2).padStart(6) + e.entropy.toFixed(3).padStart(7) +
    String(e.size).padStart(6) + '  ' + (e.op + '/' + (e.model || '-')).padEnd(17) + (e.intent || '').slice(0, 86));
}

// --------------------------------------------------------- generalisation
/* Raw train-minus-test is not overfitting: the two sets of starts are not
 * equally hard. The seeds were never selected on anything, so their gap is
 * what the sets' difference in difficulty alone produces. Overfitting is how
 * much worse an evolved controller's gap is than that. */
const evolved = elites.filter(e => e.op !== 'seed' && e.test);
// The seeds are usually displaced from the archive by the end, so re-score
// them on this run's own starts. Scoring is deterministic, so this is exactly
// what they scored when the run began.
let seeds = elites.filter(e => e.op === 'seed' && e.test);
const runTasks = path.join(DIR, 'tasks.json');
if (seeds.length < 3 && fs.existsSync(runTasks)) {
  const H = require('./headless'), S = require('./sandbox');
  const T = JSON.parse(fs.readFileSync(runTasks, 'utf8'));
  const w = H.boot();
  const sd = path.join(__dirname, 'seeds');
  seeds = fs.readdirSync(sd).filter(f => f.endsWith('.js')).map(f => {
    const src = fs.readFileSync(path.join(sd, f), 'utf8');
    return { id: f, quality: S.evaluate(w, src, T.train).quality, test: { quality: S.evaluate(w, src, T.test).quality } };
  });
}
const gap = l => l.reduce((s, e) => s + (e.quality - e.test.quality), 0) / (l.length || 1);
const mean = (l, f) => l.reduce((s, e) => s + f(e), 0) / (l.length || 1);
console.log('\nGENERALISATION');
if (seeds.length) console.log('  seeds    (' + seeds.length + '): train ' + mean(seeds, e => e.quality).toFixed(3) + '  test ' + mean(seeds, e => e.test.quality).toFixed(3) + '  gap ' + gap(seeds).toFixed(3));
if (evolved.length) console.log('  evolved  (' + evolved.length + '): train ' + mean(evolved, e => e.quality).toFixed(3) + '  test ' + mean(evolved, e => e.test.quality).toFixed(3) + '  gap ' + gap(evolved).toFixed(3));
if (seeds.length && evolved.length) {
  console.log('  overfitting = evolved gap - seed gap = ' + (gap(evolved) - gap(seeds)).toFixed(3) + '  (0 = none; positive = fitted to the training starts)');
  const top = evolved.slice(0, 5);
  console.log('  top 5 evolved: train ' + mean(top, e => e.quality).toFixed(3) + '  test ' + mean(top, e => e.test.quality).toFixed(3) + '  gap ' + gap(top).toFixed(3));
}
const checks = log.filter(l => l.kind === 'test');
if (checks.length) {
  console.log('  over the run (all elites at each checkpoint):');
  for (const c of checks) console.log('    after ' + String(c.n).padStart(4) + ': ' + String(c.elites).padStart(3) + ' elites, mean train ' + c.meanTrain.toFixed(3) + ' / test ' + c.meanTest.toFixed(3) + ';  best train ' + c.bestTrain.toFixed(3) + ' / test ' + c.bestTest.toFixed(3));
}

// -------------------------------------------------------------- operators
console.log('\nOPERATORS  (new = filled an empty cell; improved = beat an elite)');
const by = {};
for (const l of kids) {
  for (const k of [l.op, l.op + '/' + l.model]) {
    const s = by[k] = by[k] || { n: 0, new: 0, improved: 0, bad: 0, cost: 0, gain: 0, gn: 0 };
    s.n++; s.cost += l.cost || 0;
    if (l.outcome === 'new') s.new++;
    if (l.outcome === 'improved') s.improved++;
    if (['malformed', 'crashed', 'refused', 'llm-error', 'unchanged'].includes(l.outcome)) s.bad++;
    if (l.quality !== undefined && l.parentQuality !== null && l.parentQuality !== undefined) { s.gain += l.quality - l.parentQuality; s.gn++; }
  }
}
console.log('  ' + 'operator'.padEnd(18) + 'n'.padStart(5) + 'new'.padStart(6) + 'impr'.padStart(6) + ' success'.padStart(9) + ' failed'.padStart(8) + '  mean dq'.padStart(9) + '   $/success');
for (const k of Object.keys(by).sort()) {
  const s = by[k], succ = s.new + s.improved;
  console.log('  ' + k.padEnd(18) + String(s.n).padStart(5) + String(s.new).padStart(6) + String(s.improved).padStart(6) +
    pct(succ, s.n).padStart(9) + pct(s.bad, s.n).padStart(8) + (s.gn ? ((s.gain / s.gn >= 0 ? '+' : '') + (s.gain / s.gn).toFixed(3)) : '   -').padStart(9) +
    '   ' + (succ ? '$' + (s.cost / succ).toFixed(3) : '-'));
}
const outcomes = {};
for (const l of kids) outcomes[l.outcome] = (outcomes[l.outcome] || 0) + 1;
console.log('  outcomes: ' + Object.entries(outcomes).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', '));
// Can the model hit a playstyle it is asked for?
const steers = kids.filter(l => l.op === 'steer' && l.cell && l.target);
if (steers.length) {
  const hit = steers.filter(l => l.cell[0] === l.target[0] && l.cell[1] === l.target[1]).length;
  const dist = steers.reduce((s, l) => s + Math.abs(l.cell[0] - l.target[0]) + Math.abs(l.cell[1] - l.target[1]), 0) / steers.length;
  console.log('  steering: ' + hit + ' of ' + steers.length + ' landed in the cell asked for; mean miss ' + dist.toFixed(1) + ' cells');
}
const sizes = kids.filter(l => l.size).map(l => l.size);
console.log('  child size: median ' + sizes.sort((a, b) => a - b)[Math.floor(sizes.length / 2)] + ' chars, ' +
  sizes.filter(s => s > 4000).length + ' of ' + sizes.length + ' over the 4000 limit');

// --------------------------------------------------------------- progress
if (archive.history.length) {
  console.log('\nPROGRESS  (children: cells filled, QD score, best quality)');
  const step = Math.max(1, Math.floor(archive.history.length / 12));
  archive.history.filter((h, i) => i % step === 0 || i === archive.history.length - 1).forEach(h =>
    console.log('  ' + String(h.n).padStart(5) + ': ' + String(h.cells).padStart(3) + ' cells   QD ' + h.qd.toFixed(2).padStart(6) + '   best ' + h.best.toFixed(3)));
}

// ---------------------------------------------------------------- lineage
/* How an elite came to be: every step from a seed or a from-scratch program,
 * with the operator, the model, and what each step did to quality. Read from
 * the log, so ancestors that were later displaced from the archive still
 * appear. */
function lineage(id) {
  const byId = {};
  for (const l of kids) byId[l.id] = l;
  const intentOf = cid => {
    const f = path.join(DIR, 'children', cid + '.js');
    if (!fs.existsSync(f)) return '';
    const m = fs.readFileSync(f, 'utf8').match(/\/\/\s*intent:\s*(.*)/);
    return m ? m[1] : '';
  };
  const chain = [];
  let cur = id, guard = 0;
  while (cur && guard++ < 200) {
    const l = byId[cur];
    if (!l) { chain.push({ id: cur, op: 'seed' }); break; }
    chain.push(l);
    cur = l.parent;
  }
  console.log('\nLINEAGE of ' + id + '  (oldest first)');
  for (const l of chain.reverse()) {
    if (l.op === 'seed') { console.log('  ' + l.id.padEnd(13) + 'seed'); continue; }
    const d = l.parentQuality !== null && l.parentQuality !== undefined ? ((l.quality - l.parentQuality >= 0 ? '+' : '') + (l.quality - l.parentQuality).toFixed(3)) : '';
    console.log('  ' + l.id.padEnd(13) + (l.op + '/' + l.model).padEnd(17) + 'q ' + (l.quality !== undefined ? l.quality.toFixed(3) : '  -  ') + ' ' + d.padStart(7) +
      (l.parent2 ? '  x ' + l.parent2 : '') + '  [' + (l.cell || '') + ']  ' + intentOf(l.id).slice(0, 90));
  }
}
const lin = arg('lineage', '');
if (lin) lineage(lin === 'best' ? elites.find(e => e.op !== 'seed').id : lin);

if (process.argv.includes('--export')) {
  const out = path.join(DIR, 'elites');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const e of elites) {
    const head = '// ' + e.id + '  cell [' + e.cell + ']  train ' + e.quality.toFixed(3) + (e.test ? '  test ' + e.test.quality.toFixed(3) : '') +
      '  aggression ' + e.aggression.toFixed(2) + '  entropy ' + e.entropy.toFixed(3) + '  via ' + e.op + '/' + (e.model || '-') +
      (e.parents && e.parents.length ? ' from ' + e.parents.join(' + ') : '') + '\n';
    fs.writeFileSync(path.join(out, 'a' + e.cell[0] + 'e' + e.cell[1] + '_' + e.id + '.js'), head + e.src);
  }
  console.log('\nexported ' + elites.length + ' elites to ' + path.relative(process.cwd(), out));
}
