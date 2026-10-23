// ACCESSION — runs dist/accession-hash.html in Chromium: every golden run must PASS.
import { open } from './lib.mjs';
const { browser, page, errors } = await open('dist/accession-hash.html', { viewport: { width: 800, height: 600 } });
try { await page.waitForFunction(() => document.title === 'PASS' || document.title === 'FAIL', null, { timeout: 60000 }); }
catch (e) { console.log('errors:', errors.join('; ')); throw e; }
const text = await page.textContent('#out');
await browser.close();
console.log(text.split('\n').filter(Boolean).join(' | '));
if (!text.includes('ALL PASS') || errors.length) { console.log('errors:', errors.join('; ')); process.exit(1); }
