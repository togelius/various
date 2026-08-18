/* Screenshot a page from the project with headless Chromium.
 * usage: node tools/shot.js <relative-page> <out.png> [waitMs] [--script=file]
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const page0 = process.argv[2], out = process.argv[3];
  const wait = parseInt(process.argv[4] || '600', 10);
  const scriptArg = (process.argv.find(a => a.startsWith('--script=')) || '').slice(9);
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  const q = page0.indexOf('?');
  const file = q < 0 ? page0 : page0.slice(0, q);
  const query = q < 0 ? '' : page0.slice(q);
  await page.goto('file://' + path.join(root, file) + query);
  await page.waitForTimeout(wait);
  if (scriptArg) {
    const code = fs.readFileSync(path.resolve(root, scriptArg), 'utf8');
    const r = await page.evaluate(code);
    if (r !== undefined) console.log('eval:', JSON.stringify(r));
  }
  await page.screenshot({ path: path.resolve(root, out) });
  await browser.close();
  if (errs.length) { console.log(errs.join('\n')); process.exitCode = 1; }
  else console.log('ok ->', out);
})();
