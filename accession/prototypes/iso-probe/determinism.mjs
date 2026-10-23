// Same page rendered repeatedly: same browser, fresh browser, headless shell vs full Chromium (new headless),
// and with antialiasing on. Reports SHA-256 of the PNGs and the count of differing pixels.
import http from 'http'; import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'text/javascript' }); fs.createReadStream(p).pipe(r); }).listen(0);
await new Promise(r => srv.on('listening', r));
const base = `http://127.0.0.1:${srv.address().port}/`;
const pages = { topdown: 'topdown.html?layout=sculpture_court_6_1&zoom=2', iso: 'iso.html?layout=sculpture_court_6_1&scale=32&mode=full' };
async function shoot(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true });
  const page = await ctx.newPage(); await page.goto(base + url); await page.waitForFunction(() => window.__ready === true);
  const buf = await page.screenshot(); await ctx.close(); return buf;
}
const decode = async (browser, a, b) => { // count differing pixels via a canvas in the browser
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  const n = await page.evaluate(async ([a, b]) => {
    const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ib] = await Promise.all([load(a), load(b)]); const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height; const g = c.getContext('2d');
    g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data; g.clearRect(0, 0, c.width, c.height); g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, c.width, c.height).data;
    let d = 0, maxd = 0; for (let i = 0; i < da.length; i += 4) { const m = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])); if (m) { d++; maxd = Math.max(maxd, m); } }
    return { differingPixels: d, of: da.length / 4, maxChannelDelta: maxd };
  }, [a.toString('base64'), b.toString('base64')]); await ctx.close(); return n;
};
const h = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);
const args = ['--enable-unsafe-swiftshader'];
const b1 = await chromium.launch({ args });
const b2 = await chromium.launch({ args });
const b3 = await chromium.launch({ args, channel: 'chromium' }); // full Chromium binary, new headless mode
for (const [name, url] of Object.entries(pages)) {
  const s1 = await shoot(b1, url), s1b = await shoot(b1, url), s2 = await shoot(b2, url), s3 = await shoot(b3, url);
  console.log(name, 'same-browser', h(s1), h(s1b), 'fresh-browser', h(s2), 'full-chromium', h(s3));
  console.log('  vs full-chromium:', JSON.stringify(await decode(b1, s1, s3)));
}
await Promise.all([b1.close(), b2.close(), b3.close()]); srv.close();
