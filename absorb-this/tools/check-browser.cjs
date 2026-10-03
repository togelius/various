#!/usr/bin/env node
'use strict';
// Run the actual browser integration page. Start an HTTP server at the repository
// root first, or supply ABSORB_BASE_URL (the game's directory, with trailing slash).
const { chromium } = require('playwright');
const base = process.env.ABSORB_BASE_URL || 'http://127.0.0.1:8000/absorb-this/';
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--num-raster-threads=1'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 650 }, hasTouch: process.argv.includes('--touch') });
    const errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error('PAGE ERROR:', e.message); });
    await page.goto(new URL('tests/', base).href, { waitUntil: 'domcontentloaded' });
    await page.locator('#run').click();
    await page.waitForFunction(() => /^(pass|fail)$/.test(document.querySelector('#status').className), null, { timeout: 120000 });
    const result = await page.evaluate(() => ({
      status: document.querySelector('#status').textContent,
      passed: document.querySelector('#status').className === 'pass',
      checks: document.querySelector('#results').textContent.split('\n').filter(Boolean),
    }));
    console.log(result.status);
    for (const check of result.checks) if (!check.startsWith('PASS ')) console.error(check);
    if (!result.passed || !result.checks.length || errors.length) throw Error('Browser checks failed.');
    console.log('No uncaught JavaScript errors.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
