// Screenshots of the game at given chapters/positions.
// usage: node tools/shot.js out-dir "ch:x[:y]" ...   (ch is 0-based; "title" for the title screen)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [out, ...specs] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => window.__game && window.__game.state === 'title', null, { timeout: 60000 });
  for (const spec of specs) {
    if (spec === 'title') { await page.waitForTimeout(2500); await page.screenshot({ path: `${out}/title.png` }); continue; }
    const [ch, x, y] = spec.split(':').map(Number);
    await page.evaluate(([ch, x]) => window.__game.jump(ch, x), [ch, x]);
    await page.waitForFunction(() => window.__game.state === 'play', null, { timeout: 60000 }).catch(e => { console.log('FAILED ' + spec + '\n' + errors.join('\n')); process.exit(1); });
    if (!isNaN(y)) await page.evaluate(([x, y]) => window.__game.set(x, y), [x, y]);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/ch${ch + 1}-${x}.png` });
  }
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
  await browser.close();
})();
