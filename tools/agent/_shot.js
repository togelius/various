const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-gpu'] });
  const errs = [];
  for (const [scheme, tag] of [['light','light'], ['dark','dark']]) {
    const p = await b.newPage({ viewport: { width: 1180, height: 1000 }, colorScheme: scheme });
    p.on('pageerror', e => errs.push(tag + ': ' + e.message));
    await p.goto('file://' + process.argv[2]);
    await p.waitForTimeout(700);
    await p.screenshot({ path: process.argv[3] + '-' + tag + '.png', fullPage: true });
    await p.close();
  }
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
