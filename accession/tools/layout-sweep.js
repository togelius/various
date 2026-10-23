#!/usr/bin/env node
// ACCESSION — M1's acceptance sweep: every slice programme over N seeds at Cabinet size.
// Reports fallback rate, validator failures, L_tour and generation time, and prints any
// plan that needed the fallback as a text map with its reasons (BUILD.md §11, M1).
// Usage: node tools/layout-sweep.js [seeds=1000] [--json out.json]
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..');
const { Layout } = require('./core-context.js').loadCore();
const seeds = +(process.argv[2] || 1000);
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * (b.length - 1)))]; };
const out = {};
let bad = 0;
console.log(`programme | seeds | fallback | reseeded | repaired | L_tour p5/p50/p95 | rooms p50 | size p50 | ms p50/p95/max`);
for (const prog of ['enfilade', 'case_labyrinth', 'sculpture_court']) {
  const times = [], tours = [], rooms = [], ws = [], hs = [];
  let fallback = 0, reseeded = 0, repaired = 0;
  const reasons = {};
  for (let s = 1; s <= seeds; s++) {
    const t0 = process.hrtime.bigint();
    const r = Layout.generate(prog, 0, s, { acc: prog, depth: 1 });
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
    if (r.fallback) fallback++;
    r.tries.forEach((t, k) => {
      for (const f of t) {
        const key = f.id + ': ' + f.why.replace(/\d+/g, 'n');
        reasons[key] = (reasons[key] || 0) + 1;
        // The first two failed attempts per check are printed as maps with the tiles marked.
        if (reasons[key] <= 2 && process.argv.includes('--maps')) {
          const again = Layout.attempt(prog, 0, s, `layout/${prog}@${Layout.PIN}/d1/a${k}`);
          console.log(`  ${prog} seed ${s} attempt ${k}: ${f.id} ${f.why}\n` + Layout.text({ tiles: again.L.G.rows() }, f.tiles).split('\n').map(l => '    ' + l).join('\n'));
        }
      }
    });
    if (r.attempt > 0) reseeded++;
    if (r.log.length) repaired++;
    if (r.failed.length) { bad++; console.log(`${prog} seed ${s}: ${r.failed.map(f => f.id + ' ' + f.why).join('; ')}\n${Layout.text(r.plan, r.failed.flatMap(f => f.tiles))}`); }
    tours.push(r.plan.ltour); rooms.push(r.analysis.rooms); ws.push(r.plan.w); hs.push(r.plan.h);
  }
  out[prog] = { seeds, fallback, reseeded, repaired, ltour: [q(tours, .05), q(tours, .5), q(tours, .95)], ms: [q(times, .5), q(times, .95), Math.max(...times)], reasons };
  console.log(`${prog} | ${seeds} | ${(100 * fallback / seeds).toFixed(1)}% | ${reseeded} | ${repaired} | ${q(tours, .05)}/${q(tours, .5)}/${q(tours, .95)} | ${q(rooms, .5)} | ${q(ws, .5)}×${q(hs, .5)} | ${q(times, .5).toFixed(1)}/${q(times, .95).toFixed(1)}/${Math.max(...times).toFixed(1)}`);
  for (const [k, v] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log(`    failed attempts: ${v} × ${k}`);
  if (process.argv.includes('--locality')) {
    let compared = 0, changed = 0, leaks = 0;
    for (let s = 1; s <= Math.min(100, seeds); s++) {
      const a = Layout.generate(prog, 0, s);
      for (const target of a.plan.rooms.filter(r => r.role !== 'staff' && !r.tags.includes('filled'))) {
        const b = Layout.generate(prog, 0, s, { perturbRoom: target.id });
        if (b.attempt !== a.attempt) continue;
        compared++;
        let mine = false;
        for (let y = 0; y < a.plan.h; y++) for (let x = 0; x < a.plan.w; x++) if (a.plan.tiles[y][x] !== b.plan.tiles[y][x]) { if (a.plan.roomOf[y][x] === target.id) mine = true; else leaks++; }
        if (mine) changed++;
      }
    }
    console.log(`    locality: ${compared} rooms re-curated over ${Math.min(100, seeds)} seeds; ${changed} changed; ${leaks} tiles changed in other rooms`);
    if (leaks) bad++;
  }
}
if (process.argv.includes('--json')) fs.writeFileSync(process.argv[process.argv.indexOf('--json') + 1], JSON.stringify(out, null, 1));
const worst = Math.max(...Object.values(out).map(o => o.fallback / o.seeds)), slow = Math.max(...Object.values(out).map(o => o.ms[1]));
console.log(`fallback worst ${(100 * worst).toFixed(1)}% (limit 1%), p95 worst ${slow.toFixed(1)} ms (limit 25 ms)`);
process.exit(bad || worst > 0.01 || slow > 25 ? 1 : 0);
