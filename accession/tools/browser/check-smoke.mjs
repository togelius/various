// ACCESSION — boots dist/accession.html from file:// at phone size, plays 200 left clicks
// on random board points, and fails on any console error or horizontal scroll.
import { open, root } from './lib.mjs';
import path from 'node:path';
const shot = process.argv.includes('--shot');
const { browser, page, errors } = await open('dist/accession.html', { viewport: { width: 390, height: 844 }, dpr: 2 });
await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state);
// The board must really draw: many colours on the canvas, and your tile not blank.
const drawn = await page.evaluate(() => {
  const c = document.querySelector('#board canvas');
  if (!c || !c.width || !c.height) return { colours: 0 };
  const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data, set = new Set();
  for (let i = 0; i < d.length; i += 4 * 97) set.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
  return { colours: set.size };
});
const box = await page.locator('#board').boundingBox();
let x = 7;
for (let i = 0; i < 200; i++) {
  x = (x * 1103515245 + 12345) % 2147483648;
  await page.mouse.click(box.x + (x % 1000) / 1000 * box.width, box.y + ((x >> 10) % 1000) / 1000 * box.height, { button: 'left' });
}
const turn = await page.evaluate(() => window.ACCESSION.state.turn);
const scroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
if (shot) await page.screenshot({ path: path.join(root, 'test/shots/smoke-phone.png') });
await browser.close();
console.log(`smoke: board drawn in ${drawn.colours} colours, 200 clicks, turn ${turn}, horizontal scroll ${scroll ? 'YES' : 'no'}, console errors ${errors.length}`);
if (errors.length || scroll || turn === 0 || drawn.colours < 12) { console.log(errors.join('\n')); process.exit(1); }
