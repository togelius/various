#!/usr/bin/env node
'use strict';
// Runs index.html?selftest headless and exits non-zero unless the page logs "SELFTEST PASS"
// with no page errors or console errors.
//   node clack-stack/tools/selftest.cjs
const path = require('path');
const { launch, gamePage } = require('./lib.cjs');

(async () => {
  const browser = await launch();
  let failed = false;
  try {
    const { page, errors, logs } = await gamePage(browser, { width: 390, height: 844 }, { selftest: '', mute: 1, nohint: 1 });
    const t0 = Date.now();
    let line = null;
    while (Date.now() - t0 < 60000) {
      line = logs.find(l => /^SELFTEST (PASS|FAIL)/.test(l));
      if (line || errors.length) break;
      await page.waitForTimeout(100);
    }
    const r = await page.evaluate(() => window.__selftest || null);
    console.log(line || 'no SELFTEST line within 60 s');
    if (r && r.failures && r.failures.length) for (const f of r.failures) console.log('  - ' + f);
    if (errors.length) { console.log('console/page errors:'); for (const e of errors) console.log('  ' + e); }
    failed = !line || !line.startsWith('SELFTEST PASS') || errors.length > 0;
  } finally {
    await browser.close();
  }
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
