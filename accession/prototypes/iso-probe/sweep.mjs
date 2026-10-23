// sweep.mjs: whole-map occlusion statistics over camera elevation, wall height, walls-down and the four
// 90-degree camera rotations. Writes sweep.json (summary plus rotation analysis).
import fs from 'fs';
import { run } from './shoot.mjs';

const LAYOUTS = ['sculpture_court_6_1', 'enfilade_3_0'];
const jobs = [];
for (const layout of LAYOUTS) {
  for (const elev of [30, 35.264, 45, 60]) for (const wallh of [3, 1.5])
    jobs.push({ page: 'iso.html', query: { layout, scale: 32, mode: 'full', elev, wallh, shadows: 0 }, vp: 'phone', measure: { viewport: false, global: true, perTile: false } });
  jobs.push({ page: 'iso.html', query: { layout, scale: 32, mode: 'low', elev: 35.264, wallh: 3, shadows: 0 }, vp: 'phone', measure: { viewport: false, global: true } });
  for (const az of [45, 135, 225, 315])
    jobs.push({ page: 'iso.html', query: { layout, scale: 32, mode: 'full', elev: 35.264, az, wallh: 3, shadows: 0 }, vp: 'phone', measure: { viewport: false, global: true, perTile: true } });
}
const res = await run(jobs, { onResult: r => { const g = r.measure.global; console.log(JSON.stringify(r.job.query), 'floor hidden/partly/clear %', g.floor.hiddenPct, g.floor.partlyPct, g.floor.clearPct, '| figures', g.figurePositions.hiddenPct, g.figurePositions.partlyPct, g.figurePositions.clearPct, r.logs.join(' ')); } });

const out = { summary: [], rotation: {} };
for (const r of res) {
  const m = r.measure, g = m.global;
  out.summary.push({ layout: m.layout, mode: m.mode, elev: m.elev, az: m.az, wallH: m.wallH, floor: g.floor, figurePositions: g.figurePositions });
}
for (const layout of LAYOUTS) {
  const rots = res.filter(r => r.measure.layout === layout && r.measure.global.perTile).map(r => ({ az: r.measure.az, perTile: r.measure.global.perTile }));
  if (rots.length !== 4) continue;
  const n = rots[0].perTile.length;
  const stat = col => {
    let hidDefault = 0, hidAll = 0, hidAny = 0, visAfterRotate = 0;
    for (let i = 0; i < n; i++) {
      const hid = rots.map(r => r.perTile[i][col] < 0.25);
      if (hid[0]) hidDefault++; if (hid.every(Boolean)) hidAll++; if (hid.some(Boolean)) hidAny++;
      if (hid[0] && !hid.every(Boolean)) visAfterRotate++;
    }
    const pct = v => +(100 * v / n).toFixed(1);
    return { n, hiddenDefaultPct: pct(hidDefault), hiddenInAllFourPct: pct(hidAll), hiddenInAtLeastOnePct: pct(hidAny), recoverableByRotatingPct: pct(visAfterRotate) };
  };
  out.rotation[layout] = { azimuths: rots.map(r => r.az), floor: stat(2), figurePositions: stat(3) };
}
fs.writeFileSync(new URL('./sweep.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.rotation, null, 1));
