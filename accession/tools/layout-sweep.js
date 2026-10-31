#!/usr/bin/env node
// ACCESSION — M1's acceptance sweep: every slice programme over N seeds at Cabinet size.
// Reports fallback rate, validator failures, L_tour and generation time, and prints any
// plan that needed the fallback as a text map with its reasons (BUILD.md §11, M1).
// Generation time is CPU time (process.cpuUsage around each Layout.generate), so the p95 limit
// of 25 ms holds or fails the same on a loaded machine (BUILD.md §10.2).
// The Intro (layout version 3, BUILD.md §5.5), per programme: the walk from the entrance to the
// nearest onward opening (p5/p50/p95), the plans whose every onward opening is at walk
// INTRO_DEPTH or more, the plans where the stamp's cut holds (a walk from the entrance that
// steps on no tile of the cut reaches no onward opening), and the Intro's floor tiles beyond the safe zone (walk
// more than SAFE_ZONE; p50, and the plans with none). They are read from the plan's tiles and
// rooms, so the same columns can be measured on a plan of an earlier version (cut: '-'). A plan
// of version 3 or later fails the sweep if it has no plan.intro, if an onward opening is nearer
// than INTRO_DEPTH, or if its cut does not hold.
// The identity shares (design/layout.md §13.2) leave the stamped Intro out at version 3 (§5.5),
// so they are printed both ways, p50: the glass and narrow shares as the checks count them, and
// with the Intro counted, beside the Intro's share of the public floor; not gated.
// Usage: node tools/layout-sweep.js [seeds=1000] [--locality] [--maps] [--json out.json]
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..');
const { Layout, LBuild, N } = require('./core-context.js').loadCore();
const seeds = +(process.argv[2] || 1000);
const cpuMs = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * (b.length - 1)))]; };
const out = {};
let bad = 0;

// The Intro's measures for one plan: {open, deep, cut, beyond, glass, blockers, narrow, floor}
// (above): the last four are the Intro's own counts of what LAnalyse counts for the identity
// shares (blockers next to public floor, the glass among them; public floor, the narrow among it).
function introOf(plan) {
  const r = plan.rooms.find(q => q.role === 'intro'), G = LBuild.grid(plan.w, plan.h), W = plan.w, T = LBuild.T;
  plan.tiles.forEach((row, y) => { for (let x = 0; x < plan.w; x++) G.set(x, y, row.charCodeAt(x)); });
  const at = (x, y) => y * plan.w + x, [ex, ey] = plan.entrance, D = LBuild.bfs(G, [at(ex, ey)], LBuild.ALL);
  const P = LBuild.bfs(G, [at(ex, ey)], LBuild.PUBLIC), open = i => i >= 0 && i < P.length && P[i] >= 0;
  let glass = 0, blockers = 0, narrow = 0, floor = 0;
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
    const i = at(x, y), c = G.get(x, y);
    if (LBuild.BLOCK[c] && c !== T.CPL) {
      let near = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (G.in(x + dx, y + dy) && open(at(x + dx, y + dy))) near = true;
      if (near) { blockers++; if (LBuild.GLASS[c]) glass++; }
    }
    if (!open(i)) continue;
    floor++;
    let h = 1, v = 1;
    for (let k = 1; x + k < W && open(i + k); k++) h++;
    for (let k = 1; x - k >= 0 && open(i - k); k++) h++;
    for (let k = 1; y + k < plan.h && open(i + k * W); k++) v++;
    for (let k = 1; y - k >= 0 && open(i - k * W); k++) v++;
    if (Math.min(h, v) <= 2) narrow++;
  }
  const ops = [];
  for (let y = r.y0 - 1; y <= r.y1 + 1; y++) for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
    if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) continue;
    if (LBuild.WALK[G.get(x, y)] && G.get(x, y) !== LBuild.T.ENT) ops.push(at(x, y));
  }
  const walks = ops.map(i => D[i]).filter(d => d >= 0);
  let beyond = 0;
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (plan.roomOf[y][x] === r.id && D[at(x, y)] > N.SAFE_ZONE) beyond++;
  let cut = null;
  if (plan.intro) {
    const mask = new Uint8Array(plan.w * plan.h);
    for (const [x, y] of plan.intro.cut) mask[at(x, y)] = 1;
    const Dz = LBuild.bfs(G, [at(ex, ey)], LBuild.ALL, 0, mask);
    cut = ops.every(i => Dz[i] < 0);
  }
  return { open: Math.min(...walks), deep: walks.every(d => d >= N.INTRO_DEPTH), cut, beyond, glass, blockers, narrow, floor };
}

console.log(`programme | seeds | fallback | reseeded | repaired | L_tour p5/p50/p95 | rooms p50 | size p50 | CPU-ms p50/p95/max`);
for (const prog of ['enfilade', 'case_labyrinth', 'sculpture_court']) {
  const times = [], tours = [], rooms = [], ws = [], hs = [], opens = [], beyonds = [];
  const share = { glass: [], glassAll: [], narrow: [], narrowAll: [], intro: [] };
  let fallback = 0, reseeded = 0, repaired = 0, deep = 0, cuts = 0, uncut = 0, bare = 0;
  const reasons = {};
  for (let s = 1; s <= seeds; s++) {
    const t0 = cpuMs();
    const r = Layout.generate(prog, 0, s, { acc: prog, depth: 1 });
    times.push(cpuMs() - t0);
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
    const I = introOf(r.plan), A = r.analysis;
    opens.push(I.open); beyonds.push(I.beyond);
    if (r.plan.pin >= 3 && !r.plan.intro) { bad++; console.log(`${prog} seed ${s}: the plan has no plan.intro`); }
    if (I.deep) deep++; else if (r.plan.pin >= 3) { bad++; console.log(`${prog} seed ${s}: an onward opening of the Intro is at walk ${I.open} (at least ${N.INTRO_DEPTH})`); }
    // As the identity checks count (outside the stamped Intro at version 3), and with it counted.
    const out3 = r.plan.pin >= 3, gB = A.blockers + (out3 ? I.blockers : 0), gG = A.glass + (out3 ? I.glass : 0);
    const nF = out3 ? A.narrowFloor + I.floor : A.floor, nN = A.narrow + (out3 ? I.narrow : 0);
    share.glass.push(A.blockers ? 1000 * A.glass / A.blockers : 0); share.glassAll.push(gB ? 1000 * gG / gB : 0);
    share.narrow.push(1000 * A.narrow / (out3 ? A.narrowFloor : A.floor)); share.narrowAll.push(1000 * nN / nF); share.intro.push(1000 * I.floor / nF);
    if (I.cut === true) cuts++; else if (I.cut === false) { uncut++; bad++; console.log(`${prog} seed ${s}: the Intro's cut does not hold`); }
    if (!I.beyond) bare++;
  }
  out[prog] = { seeds, fallback, reseeded, repaired, ltour: [q(tours, .05), q(tours, .5), q(tours, .95)], ms: [q(times, .5), q(times, .95), Math.max(...times)], reasons };
  console.log(`${prog} | ${seeds} | ${(100 * fallback / seeds).toFixed(1)}% | ${reseeded} | ${repaired} | ${q(tours, .05)}/${q(tours, .5)}/${q(tours, .95)} | ${q(rooms, .5)} | ${q(ws, .5)}×${q(hs, .5)} | ${q(times, .5).toFixed(1)}/${q(times, .95).toFixed(1)}/${Math.max(...times).toFixed(1)}`);
  out[prog].intro = { open: [q(opens, .05), q(opens, .5), q(opens, .95)], deep, cut: cuts + uncut ? cuts : null, beyond: q(beyonds, .5), bare };
  console.log(`    Intro: nearest onward opening at walk ${q(opens, .05)}/${q(opens, .5)}/${q(opens, .95)}; every opening at walk ≥ ${N.INTRO_DEPTH} in ${deep} of ${seeds}; ` +
    `cut held in ${cuts + uncut ? cuts + ' of ' + seeds : '-'}; floor beyond walk ${N.SAFE_ZONE}: p50 ${q(beyonds, .5)}, none in ${bare}`);
  const pc = a => (q(a, .5) / 10).toFixed(1) + '%';
  out[prog].shares = { glass: q(share.glass, .5), glassAll: q(share.glassAll, .5), narrow: q(share.narrow, .5), narrowAll: q(share.narrowAll, .5), intro: q(share.intro, .5) };
  console.log(`    identity, p50: glass ${pc(share.glass)} of blockers as checked, ${pc(share.glassAll)} with the Intro counted; ` +
    `narrow ${pc(share.narrow)} of floor as checked, ${pc(share.narrowAll)} with the Intro counted; the Intro is ${pc(share.intro)} of the public floor`);
  for (const [k, v] of Object.entries(reasons).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))) console.log(`    failed attempts: ${v} × ${k}`);
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
console.log(`fallback worst ${(100 * worst).toFixed(1)}% (limit 1%), p95 worst ${slow.toFixed(1)} CPU-ms (limit 25 CPU-ms)`);
process.exit(bad || worst > 0.01 || slow > 25 ? 1 : 0);
