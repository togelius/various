#!/usr/bin/env node
// Screenshots of the Art preview: node clack-stack/dev/art-shots.cjs [filter]
// Writes PNGs into clack-stack/dev/shots/. Fails on any page error or console error.
'use strict';
const path = require('path');
const fs = require('fs');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }

const DEV = __dirname;
const OUT = path.join(DEV, 'shots');
const URL = 'file://' + path.join(DEV, 'art-preview.html');
const filter = process.argv[2] || '';

const SHOTS = [
  { name: 'scene-390x844', w: 390, h: 844, dpr: 2, q: 'view=scene&still=1' },
  { name: 'scene-844x390', w: 844, h: 390, dpr: 2, q: 'view=scene&still=1' },
  { name: 'scene-1366x1024', w: 1366, h: 1024, dpr: 1, q: 'view=scene&still=1' },
  { name: 'night-390x844', w: 390, h: 844, dpr: 2, q: 'view=scene&still=1&night=1' },
  { name: 'night-1366x1024', w: 1366, h: 1024, dpr: 1, q: 'view=scene&still=1&night=1' },
  { name: 'sky-390x844', w: 390, h: 844, dpr: 2, q: 'view=sky&still=1' },
  { name: 'sky-1366x1024', w: 1366, h: 1024, dpr: 1, q: 'view=sky&still=1' },
  { name: 'title-390x844', w: 390, h: 844, dpr: 2, q: 'view=title&still=1&t=0.9' },
  { name: 'title-844x390', w: 844, h: 390, dpr: 2, q: 'view=title&still=1&t=0.9' },
  { name: 'title-1366x1024', w: 1366, h: 1024, dpr: 1, q: 'view=title&still=1&t=0.9' },
  { name: 'gallery-1366', w: 1366, h: 1024, dpr: 1, q: 'view=gallery&still=1', full: true },
  { name: 'gallery-390', w: 390, h: 844, dpr: 2, q: 'view=gallery&still=1', full: true },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pw.chromium.launch();
  const errors = [];
  try {
    for (const s of SHOTS) {
      if (filter && !s.name.includes(filter)) continue;
      const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dpr });
      const page = await ctx.newPage();
      await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
      page.on('pageerror', (e) => errors.push(s.name + ': pageerror ' + e.message));
      page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errors.push(s.name + ': console ' + m.text()); });
      const t0 = Date.now();
      await page.goto(URL + '?' + s.q);
      await page.waitForFunction(() => window.__artReady === true, null, { timeout: 20000 });
      const file = path.join(OUT, s.name + '.png');
      await page.screenshot({ path: file, fullPage: !!s.full });
      console.log('shot', s.name, (Date.now() - t0) + 'ms', '->', path.relative(process.cwd(), file));
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('art-shots OK');
})().catch((e) => { console.error(e); process.exit(1); });
