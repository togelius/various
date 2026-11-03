#!/usr/bin/env node
// What happened in a run? Reads runs/<name>/{log.jsonl,state.json,<name>.out} and prints: the QD curve, which operators,
// hints and models produced archive improvements, how deep the best lineage is, how big the elites are, and which
// controllers sit where on the map. It only reads; it is safe to run while a run is going.
//   node analyze.js run1
'use strict';
const fs = require('node:fs'), path = require('node:path');
const name = process.argv[2]; if (!name) { console.error('usage: node analyze.js <run>'); process.exit(2); }
const dir = path.join(__dirname, 'runs', name);
const log = fs.readFileSync(path.join(dir, 'log.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const state = fs.existsSync(path.join(dir, 'state.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')) : null;
const out = [];
const outFile = path.join(__dirname, 'runs', name + '.out');
if (fs.existsSync(outFile)) {
  const rows = [...fs.readFileSync(outFile, 'utf8').matchAll(/^generation (\d+), epoch (\d+): (\d+)\/36 cells, QD-score ([\d.]+), best ([\d.]+) \| (\d+) min, (\d+) episodes/gm)];
  if (rows.length) { out.push('## Progress by generation', '', '| gen | epoch | cells | QD-score | best quality | minutes | episodes |', '|---|---|---|---|---|---|---|'); for (const r of rows) out.push(`| ${r[1]} | ${r[2]} | ${r[3]} | ${r[4]} | ${r[5]} | ${r[6]} | ${r[7]} |`); out.push(''); }
}
const kids = log.filter(e => e.ev === 'child'), byKey = (f) => { const m = {}; for (const k of kids) { const key = f(k); const s = m[key] || (m[key] = { n: 0, improved: 0, new: 0, better: 0, q: 0 }); s.n++; s.q += k.q; if (k.verdict === 'new') { s.new++; s.improved++; } if (k.verdict === 'better') { s.better++; s.improved++; } } return m; };
const table = (title, m) => { out.push(`## ${title}`, '', '| | evaluated | new cell | beat the incumbent | success rate | mean quality |', '|---|---|---|---|---|---|'); for (const [k, s] of Object.entries(m).sort((a, b) => b[1].improved / b[1].n - a[1].improved / a[1].n)) out.push(`| ${k} | ${s.n} | ${s.new} | ${s.better} | ${(100 * s.improved / s.n).toFixed(0)}% | ${(s.q / s.n).toFixed(2)} |`); out.push(''); };
table('By operator', byKey(k => k.op)); table('By hint (the meta-prompt bandit)', byKey(k => k.hint)); table('By model', byKey(k => k.model));
const count = ev => log.filter(e => e.ev === ev).length;
out.push('## Where candidates went', '', `${kids.length} evaluated to the end; ${count('aborted')} stopped by the cascade; ${count('infeasible')} infeasible (too long, banned construct, crash); ${count('fail')} lost to LLM or parse failures.`, '');
const inf = log.filter(e => e.ev === 'infeasible').map(e => e.reason.replace(/\d+/g, 'N')); if (inf.length) { const c = {}; for (const r of inf) c[r] = (c[r] || 0) + 1; out.push('Infeasible reasons: ' + Object.entries(c).map(([r, n]) => `${r} (${n})`).join('; '), ''); }
if (state) {
  const byId = Object.fromEntries(kids.map(k => [k.id, k])); const depth = id => { let d = 0, k = byId[id]; while (k && k.parents && k.parents.length) { d++; k = byId[k.parents[0]]; } return d; };
  out.push('## Elites', '', '| id | op | hint | model | chars | quality | held-out (if checked) | lineage depth | cell (wheels,trouble) |', '|---|---|---|---|---|---|---|---|---|');
  for (const g of state.elites.sort((a, b) => b.cur - a.cur)) out.push(`| ${g.id} | ${g.op} | ${g.hint} | ${g.model || '-'} | ${g.code.length} | ${g.cur.toFixed(2)} | ${g.heldout !== undefined ? g.heldout.toFixed(2) : '-'} | ${depth(g.id)} | ${g.cell} |`);
  out.push('', `Operators used: ${JSON.stringify(state.counts)}`);
}
console.log(out.join('\n'));
