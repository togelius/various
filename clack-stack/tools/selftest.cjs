#!/usr/bin/env node
'use strict';
// Runs index.html?selftest headless (DESIGN 17.6): the drop on hand-made cases and thousands of random builds against
// an independent float first contact, the lattice, no overlaps, edge keys = float coincidence, and the ghost = the
// landing through the game's own release. Exits non-zero unless the page logs "SELFTEST PASS" with no errors.
//   node clack-stack/tools/selftest.cjs
const { launch, gamePage } = require('./lib.cjs');

(async () => {
  const browser = await launch();
  let failed = true;
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
    if (r) {
      console.log(`  ${r.drops} random drops (${r.tris} triangles: ${r.notches} into notches; ${r.points} on points, ${r.hangs} half over an edge, ${r.rugs} to the rug), ${r.ghostTrials} ghost = landing trials, ${r.ms} ms`);
      for (const f of r.failures || []) console.log('  - ' + f);
    }
    if (errors.length) { console.log('console/page errors:'); for (const e of errors) console.log('  ' + e); }
    failed = !line || !line.startsWith('SELFTEST PASS') || errors.length > 0;
  } finally {
    await browser.close();
  }
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
