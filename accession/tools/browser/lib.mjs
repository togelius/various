// ACCESSION — shared helpers for the Playwright checks. Finds Playwright wherever this
// machine keeps it, and opens dist/ builds from file://.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function playwright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright', '/opt/node-tools/node_modules/playwright']) {
    try { return require(p); } catch (e) { /* try the next */ }
  }
  return null;
}

export const fileUrl = rel => pathToFileURL(path.join(root, rel)).href;

// Launch Chromium, open a page, collect console errors. Returns { browser, page, errors }.
export async function open(rel, opts = {}) {
  const pw = playwright();
  if (!pw) { console.log('SKIPPED: Playwright not found'); process.exit(77); }
  const browser = await pw.chromium.launch({ args: opts.args || [] });
  const page = await browser.newPage({ viewport: opts.viewport || { width: 390, height: 844 }, deviceScaleFactor: opts.dpr || 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(fileUrl(rel) + (opts.query || ''));
  return { browser, page, errors };
}
