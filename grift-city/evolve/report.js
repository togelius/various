#!/usr/bin/env node
// Re-score every elite of a run (and the hand-written seeds) on starts the search never selected on:
//   held-out  starts in held-out neighbourhoods (never used for training), fixed set
//   fixed     a fixed draw from the training distribution
// and write runs/<name>/report.md. Selection used a fresh batch of 5 starts each epoch, so the gap between a controller's
// last training score and its held-out score is the overfitting measure.
//   node report.js run1 [--n 10] [--density 0.5] [--top 4]   (--top N: only the N best elites by training score, plus the seeds)
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { makeStarts } = require('./scenarios');
const { aggregate } = require('./episode');
const { Pool } = require('./pool');
const { Archive, AXES } = require('./archive');
const { LIMITS, validate } = require('./sandbox');

async function main() {
  const argv = process.argv.slice(2), name = argv[0]; if (!name) { console.error('usage: node report.js <run> [--n 10] [--density 0.5] [--seed 31]'); process.exit(2); }
  const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : +argv[i + 1]; };
  const n = opt('n', 10), density = opt('density', 0.5), seed = opt('seed', 31), top = opt('top', 0), tag = density === 0.5 && !top ? '' : '-d' + density + (top ? '-top' + top : '');
  const dir = path.join(__dirname, 'runs', name), st = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
  const limits = { ...LIMITS, maxChars: st.args.maxChars, maxLines: st.args.maxLines };
  const held = makeStarts(seed, n, 'heldout'), fixed = makeStarts(seed + 1, n, 'train');
  const subjects = [...['walker', 'driver'].map(s => ({ id: 'seed:' + s, code: fs.readFileSync(path.join(__dirname, 'seeds', s + '.js'), 'utf8'), seedFile: true })), ...[...st.elites].sort((a, b) => b.cur - a.cur).slice(0, top || st.elites.length).map(g => ({ id: g.id, code: g.code, g }))];
  const lib = st.lib || '', pool = new Pool(Math.min(4, os.cpus().length)), opts = { density, limits, lib };
  const rows = await Promise.all(subjects.map(async s => {
    const v = validate(s.code, limits, lib); if (!v.ok) return { ...s, error: v.reason };
    const [h, f] = await Promise.all([pool.runBatch(s.code, held, opts), pool.runBatch(s.code, fixed, opts)]);
    return { ...s, held: aggregate(h), fixed: aggregate(f), heldResults: h };
  }));
  pool.close();
  const f2 = v => v.toFixed(2);
  const out = [`# Report for run \`${name}\``, '', `${top ? 'The ' + top + ' best of ' : ''}${st.elites.length} elites after ${st.gen} generations, ${st.counts.episodes} episodes. Re-scored on ${n} held-out starts and ${n} fixed training-distribution starts, density ${density}.`, '',
    '| controller | op | chars | last train batch | fixed train | held-out | held-out story / cash / survival | wheels | trouble/min | jobs started / passed (held-out) |', '|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of rows.sort((a, b) => (b.held ? b.held.quality : -1) - (a.held ? a.held.quality : -1))) {
    if (r.error) { out.push(`| ${r.id} | | | | | invalid: ${r.error} | | | | |`); continue; }
    out.push(`| ${r.id} | ${r.g ? r.g.op : 'hand-written'} | ${r.code.length} | ${r.g ? f2(r.g.cur) : '-'} | ${f2(r.fixed.quality)} | ${f2(r.held.quality)} | ${f2(r.held.story || 0)} / ${f2(r.held.cash || 0)} / ${f2(r.held.survival || 0)} | ${f2(r.held.wheels)} | ${f2(r.held.offencesPerMin)} | ${r.held.started}/${n} / ${r.held.passed} |`);
  }
  const a = new Archive(); for (const r of rows) if (r.g && r.held) { a.place(r.g); a.cells.set(a.key(r.g.cell), { ...r.g, cur: r.held.quality }); }
  out.push('', 'Held-out quality of the elite in each cell (rows: ' + AXES[1].name + ', columns: ' + AXES[0].name + '):', '', '```', a.render('cur'), '```');
  const seedBest = Math.max(...rows.filter(r => r.seedFile && r.held).map(r => r.held.quality)), evBest = Math.max(...rows.filter(r => r.g && r.held).map(r => r.held.quality), 0);
  out.push('', `Best hand-written seed on held-out starts: ${f2(seedBest)}; best evolved elite: ${f2(evBest)}.`);
  fs.writeFileSync(path.join(dir, `report${tag}.md`), out.join('\n') + '\n'); fs.writeFileSync(path.join(dir, `report${tag}.json`), JSON.stringify(rows.map(r => ({ id: r.id, chars: r.code.length, held: r.held, fixed: r.fixed, train: r.g && r.g.cur })), null, 1));
  console.log(out.join('\n'));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
