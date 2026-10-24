// ACCESSION — runs dist/accession-hash.html in Chromium (BUILD.md §3.5). Every pinned golden
// run must PASS. When the page says PENDING (a run has no pin while a wave changes the
// state), each pending run's hash and checkpoints on the page must equal the same run in
// Node, through tools/core-context.js on this tree (tools/hash-compare.js).
import { createRequire } from 'node:module';
import { open } from './lib.mjs';
const require = createRequire(import.meta.url);
const HashCompare = require('../hash-compare.js');

const { browser, page, errors } = await open('dist/accession-hash.html', { viewport: { width: 800, height: 600 } });
let title, text, results;
try {
  await page.waitForFunction(() => ['PASS', 'FAIL', 'PENDING'].includes(document.title), null, { timeout: 120000 });
  title = await page.title();
  text = await page.textContent('#out');
  results = await page.evaluate(() => window.HASH_RESULTS || null);
} catch (e) { console.log('errors:', errors.join('; ')); await browser.close(); throw e; }
await browser.close();
console.log(text.split('\n').filter(Boolean).join(' | '));
const fail = why => { console.log(why); if (errors.length) console.log('errors:', errors.join('; ')); process.exit(1); };
if (errors.length) fail('the page logged errors');
if (title === 'FAIL') fail('the page found a difference');
if (title === 'PASS') { if (!text.includes('ALL PASS')) fail('the page says PASS but not ALL PASS'); process.exit(0); }

// PENDING: compare each pending run with Node, and check that what the page showed is what it reported.
const golden = HashCompare.readGolden();
const node = HashCompare.nodeRuns(golden);
const problems = HashCompare.compare(golden, results, node);
for (const name of Object.keys(node)) {
  if (!text.includes(`PENDING ${name}: hash ${node[name].hash}, checkpoints ${node[name].checkpoints.join(' ')}`)) problems.push(`${name}: the page does not show Node's hash and checkpoints`);
}
if (problems.length) fail('pending runs differ from Node: ' + problems.join('; '));
console.log(`pending runs equal Node's: ${Object.keys(node).map(n => `${n} ${node[n].hash}`).join(', ')}`);
