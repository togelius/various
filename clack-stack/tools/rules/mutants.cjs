'use strict';
// Mutation testing of rules.js (DESIGN §18.8): each mutant in mutants.json is a text patch of rules.js
// ({name, what, find, replace}; `find` must occur exactly once). A mutant is killed when the golden cases fail, or the
// enumeration to depth 6 breaks an invariant (I1, the oracle, among them when tools/oracle/oracle.cjs answers SPEC 5b) or
// crashes. Both are run, so the report says what caught each one; a third run checks I1 alone, so the report also says
// whether the oracle by itself kills each mutant (i1: true/false).
//   node tools/rules/mutants.cjs [--depth=6] [--jobs=4] [--one=name] [--compare=path|none]
const fs = require('fs');
const path = require('path');
const os = require('os');
const { fork } = require('child_process');
const rulesVm = require('../lib/rules-vm.cjs');
const { runGolden } = require('./golden.cjs');

const MUTANTS = path.join(__dirname, 'mutants.json');
// the oracle for I1 only when it answers SPEC 5b (enumerate.cjs defaultOracle); otherwise rules-only
const defaultCompare = () => require('./enumerate.cjs').defaultOracle().path;
function list() { return JSON.parse(fs.readFileSync(MUTANTS, 'utf8')); }
function patch(src, m) {
  const n = src.split(m.find).length - 1;
  if (n !== 1) throw new Error(`mutant ${m.name}: its text occurs ${n} times in rules.js`);
  return src.replace(m.find, () => m.replace);
}

async function runOne(m, depth, compare) {
  if (compare === undefined) compare = defaultCompare();
  const t0 = Date.now();
  const src = patch(fs.readFileSync(rulesVm.RULES_JS, 'utf8'), m);
  const out = { name: m.name, what: m.what, killed: false, by: [], golden: null, invariant: null, i1: null };
  let R;
  try { R = rulesVm.load({ from: { source: src, file: 'rules.js (' + m.name + ')' } }); }
  catch (e) { out.killed = true; out.by.push('load: ' + e.message); out.ms = Date.now() - t0; return out; }
  try {
    const g = runGolden(R).filter(r => !r.ok);
    if (g.length) { out.killed = true; out.golden = g.map(r => r.n); out.by.push('golden ' + g.map(r => r.n).join(',')); }
  } catch (e) { out.killed = true; out.by.push('golden crashed: ' + e.message); }
  try {
    const { enumerate } = require('./enumerate.cjs');
    const res = await enumerate({ source: src, file: 'rules.js (' + m.name + ')', depth, workers: 0, failFast: true, fullTo: depth, outline: true, compare });
    const fc = Object.entries(res.stats.failCount).filter(([, n]) => n).map(([k]) => k);
    if (fc.length || res.stats.failFast) {
      out.killed = true;
      const f = res.stats.fails[0];
      out.invariant = fc[0] || 'failFast';
      out.by.push('enumeration ' + (fc.join(',') || '') + (f ? ' (' + f.msg.slice(0, 140) + (f.log ? ' after ' + f.log : '') + ')' : ''));
    }
  } catch (e) { out.killed = true; out.invariant = 'crash'; out.by.push('enumeration crashed: ' + String(e.message).slice(0, 160)); }
  // I1 alone: does the oracle by itself tell this mutant from the spec?
  if (compare) {
    try {
      const { enumerate } = require('./enumerate.cjs');
      const res = await enumerate({ source: src, file: 'rules.js (' + m.name + ')', depth, workers: 0, failFast: true, compare, only: ['I1'] });
      out.i1 = res.stats.failCount.I1 > 0;
      const f = res.stats.fails.find(x => x.inv === 'I1');
      if (f) out.i1By = f.msg.slice(0, 200) + (f.log ? ' after ' + f.log : '');
    } catch (e) { out.i1 = false; out.i1By = 'crashed: ' + String(e.message).slice(0, 120); }
  }
  out.ms = Date.now() - t0;
  return out;
}

async function runAll(opts) {
  opts = Object.assign({ depth: 6, jobs: Math.min(4, os.cpus().length), compare: defaultCompare() }, opts || {});
  const M = list(), src = fs.readFileSync(rulesVm.RULES_JS, 'utf8');
  for (const m of M) patch(src, m); // every patch applies once
  const results = new Array(M.length);
  let next = 0;
  async function worker() {
    while (next < M.length) {
      const i = next++;
      results[i] = await new Promise((resolve) => {
        const ch = fork(__filename, ['--one=' + M[i].name, '--depth=' + opts.depth, '--compare=' + (opts.compare || 'none')], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
        let txt = '', err = '';
        ch.stdout.on('data', d => { txt += d; });
        ch.stderr.on('data', d => { err += d; });
        ch.on('exit', () => {
          try { resolve(JSON.parse(txt.trim().split('\n').pop())); }
          catch (e) { resolve({ name: M[i].name, what: M[i].what, killed: true, by: ['process died: ' + err.slice(0, 200)] }); }
        });
      });
    }
  }
  await Promise.all(Array.from({ length: opts.jobs }, worker));
  return results;
}

module.exports = { list, patch, runOne, runAll };

if (require.main === module) {
  const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
  const depth = +arg('depth', 6), one = arg('one', null), cmpArg = arg('compare', null);
  const compare = cmpArg === 'none' ? null : cmpArg ? path.resolve(cmpArg) : defaultCompare();
  if (one) {
    const m = list().find(x => x.name === one);
    runOne(m, depth, compare).then(r => { console.log(JSON.stringify(r)); process.exit(0); });
  } else {
    const t0 = Date.now();
    runAll({ depth, jobs: +arg('jobs', 4), compare }).then(res => {
      for (const r of res) console.log(`${r.killed ? 'KILLED  ' : 'SURVIVED'} ${r.name}: ${r.what}${r.killed ? ' — ' + r.by.join('; ') : ''}${r.i1 === null ? '' : r.i1 ? ' [I1 alone kills it]' : ' [I1 alone does not]'}`);
      const alive = res.filter(r => !r.killed);
      console.log(`${alive.length ? 'FAIL' : 'PASS'} mutants: ${res.length - alive.length}/${res.length} killed in ${((Date.now() - t0) / 1000).toFixed(1)} s${compare ? '; I1 alone kills ' + res.filter(r => r.i1).length + '/' + res.length : ''}`);
      process.exit(alive.length ? 1 : 0);
    });
  }
}
