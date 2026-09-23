// Headless smoke test: load each build, open the menus, visit every chapter,
// and fail if the game loop stops or the page logs an error.
// usage: node tools/smoke.js            (needs Playwright)
const { chromium } = require('playwright');
const path = require('path');

const BUILDS = ['index.html', 'dist/stalhagen.html'];
const DEVICES = [
  { name: 'desktop', viewport: { width: 1280, height: 720 } },
  { name: 'phone', viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 },
];

(async () => {
  const browser = await chromium.launch();
  let failed = 0;
  for (const build of BUILDS) for (const dev of DEVICES) {
    const ctx = await browser.newContext(dev);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|net::|Failed to load resource/.test(m.text())) errors.push(m.text()); });
    const label = `${build} on ${dev.name}`;
    try {
      await page.goto('file://' + path.resolve(__dirname, '..', build));
      await page.waitForFunction(() => window.__game && window.__game.state === 'title', null, { timeout: 60000 });
      await page.waitForTimeout(1200);
      const menu = await page.evaluate(() => !!window.__game.menu);
      if (!menu) throw new Error('title menu did not open');
      const phoneDefaults = await page.evaluate(() => Store.settings.large && Store.settings.reduce);
      if (dev.isMobile && !phoneDefaults) throw new Error('phone should default to larger text and reduced motion');
      const n = await page.evaluate(() => LEVELS.length);
      for (let ch = 0; ch < n; ch++) {
        await page.evaluate(ch => window.__game.jump(ch, 0), ch);
        await page.waitForFunction(() => window.__game.state === 'play', null, { timeout: 60000 });
        const t0 = await page.evaluate(() => window.__game.time);
        await page.evaluate(() => { window.__game.keys.right = true; });
        await page.waitForTimeout(1200);
        await page.evaluate(() => { window.__game.keys.right = false; });
        const t1 = await page.evaluate(() => window.__game.time);
        if (!(t1 > t0 + 0.5)) throw new Error(`chapter ${ch + 1} stopped running`);
      }
      if (errors.length) throw new Error(errors.join('\n'));
      console.log(`ok    ${label}`);
    } catch (e) {
      failed++;
      console.log(`FAIL  ${label}\n      ${e.message}`);
    }
    await ctx.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
