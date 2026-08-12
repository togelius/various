/* Screenshot helper: node tools/shot.js <page> <out.png> [waitMs] [script] */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const page_ = process.argv[2] || 'tools/preview.html';
  const out = process.argv[3] || '/tmp/shot.png';
  const wait = parseInt(process.argv[4] || '600', 10);
  const script = process.argv[5];

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-gpu']
  });
  const page = await browser.newPage({ viewport: { width: 1024, height: 700 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });

  await page.goto('file://' + path.resolve(page_));
  await page.waitForTimeout(wait);
  if (script) { try { await page.evaluate(script); } catch (e) { errors.push('EVAL: ' + e.message); } }
  await page.waitForTimeout(120);
  await page.screenshot({ path: out });
  if (errors.length) console.log(errors.join('\n'));
  else console.log('ok, no console errors');
  await browser.close();
})();
