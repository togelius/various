// run_all.mjs: every screenshot plus its measurement, written to results.json.
import fs from 'fs';
import { run } from './shoot.mjs';

const LAYOUTS = { sc: 'sculpture_court_6_1', enf: 'enfilade_3_0' };
const jobs = [];
for (const [ab, layout] of Object.entries(LAYOUTS)) {
  for (const vp of ['phone', 'mac']) {
    for (const zoom of [2, 3]) jobs.push({ page: 'topdown.html', query: { layout, zoom }, vp, out: `shots/${ab}_${vp}_topdown_${zoom}x.png` });
    for (const scale of [32, 48]) for (const mode of ['full', 'cutaway', 'xray', 'low']) {
      if (vp === 'mac' && (mode === 'xray' || mode === 'low')) continue;
      jobs.push({ page: 'iso.html', query: { layout, scale, mode }, vp, out: `shots/${ab}_${vp}_iso_s${scale}_${mode}.png`, measure: { ss: 2, global: false } });
    }
  }
  // annotated copies (exhibit letters drawn on top, even over hidden exhibits)
  jobs.push({ page: 'topdown.html', query: { layout, zoom: 2, labels: 1 }, vp: 'phone', out: `shots/${ab}_phone_topdown_2x_labels.png` });
  jobs.push({ page: 'iso.html', query: { layout, scale: 32, mode: 'full', labels: 1 }, vp: 'phone', out: `shots/${ab}_phone_iso_s32_full_labels.png` });
  // a steeper "tactics camera" for comparison (XCOM-like pitch), and a 2:1 pixel-art angle
  jobs.push({ page: 'iso.html', query: { layout, scale: 32, mode: 'full', elev: 60 }, vp: 'phone', out: `shots/${ab}_phone_3d_elev60_s32_full.png`, measure: { ss: 2 } });
  jobs.push({ page: 'iso.html', query: { layout, scale: 32, mode: 'full', elev: 30 }, vp: 'phone', out: `shots/${ab}_phone_iso2to1_s32_full.png`, measure: { ss: 2 } });
}
const res = await run(jobs, { onResult: r => console.log(r.job.out, r.tReady + 'ms', r.logs.join(' | ')) });
fs.writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify(res.map(r => ({ out: r.job.out, query: r.job.query, vp: r.job.vp, tReady: r.tReady, metrics: r.metrics, measure: r.measure, logs: r.logs })), null, 1));
