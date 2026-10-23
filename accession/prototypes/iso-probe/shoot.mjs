// shoot.mjs: serve this folder over HTTP and take Playwright screenshots.
// usage: node shoot.mjs <jobs.json | inline JSON array>
// job: { page: 'topdown.html', query: {...}, vp: 'phone'|'mac', out: 'shots/x.png', measure?: {...}, metricsKey?: '...' }
import http from 'http';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node-tools/node_modules/playwright'); } })();
const ROOT = path.dirname(new URL(import.meta.url).pathname);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}
export const VIEWPORTS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  mac: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
};

export async function run(jobs, { onResult } = {}) {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const results = [];
  try {
    for (const job of jobs) {
      const ctx = await browser.newContext(VIEWPORTS[job.vp || 'phone']);
      const page = await ctx.newPage();
      const logs = [];
      page.on('console', m => logs.push(m.type() + ': ' + m.text()));
      page.on('pageerror', e => logs.push('pageerror: ' + e.message));
      const qs = new URLSearchParams(job.query || {}).toString();
      const t0 = Date.now();
      await page.goto(base + job.page + (qs ? '?' + qs : ''));
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 }).catch(e => logs.push('timeout ' + e.message));
      const tReady = Date.now() - t0;
      if (job.out) await page.screenshot({ path: path.join(ROOT, job.out), fullPage: !!job.fullPage });
      let metrics = await page.evaluate(() => window.__metrics || null);
      let measure = null;
      if (job.measure) measure = await page.evaluate(o => window.measure(o), job.measure);
      const r = { job, tReady, metrics, measure, logs: logs.filter(l => !l.includes('GPU stall')).slice(0, 20) };
      results.push(r);
      if (onResult) onResult(r);
      await ctx.close();
    }
  } finally { await browser.close(); srv.close(); }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const arg = process.argv[2];
  const jobs = arg.trim().startsWith('[') ? JSON.parse(arg) : JSON.parse(fs.readFileSync(arg, 'utf8'));
  const out = process.argv[3];
  const res = await run(jobs, { onResult: r => console.log(r.job.out || '', r.tReady + 'ms', JSON.stringify(r.metrics), r.measure ? JSON.stringify(r.measure).slice(0, 400) : '', r.logs.join(' | ')) });
  if (out) fs.writeFileSync(out, JSON.stringify(res, null, 1));
}
