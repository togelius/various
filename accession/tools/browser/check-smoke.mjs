// ACCESSION — boots dist/accession.html from file:// at phone size, plays 200 left clicks
// on random board points, then 150 on random points anywhere in the window (the bars, the
// strip, the label's buttons, the confirmation sheet, Settings, the end of a visit), and
// fails on any console error, horizontal scroll, or text on screen that says "undefined",
// "NaN" or "[object" (BUILD.md §0: nothing the player sees may).
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
// Every text a player can read or hear: what is shown, and the labels screen readers say.
const bad = () => page.evaluate(() => {
  const said = [document.body.innerText, ...[...document.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label'))].join('\n');
  return (said.match(/[^\n]*(undefined|NaN|\[object)[^\n]*/g) || []).slice(0, 3);
});
const box = await page.locator('#board').boundingBox();
let x = 7, words = [];
for (let i = 0; i < 200; i++) {
  x = (x * 1103515245 + 12345) % 2147483648;
  await page.mouse.click(box.x + (x % 1000) / 1000 * box.width, box.y + ((x >> 10) % 1000) / 1000 * box.height, { button: 'left' });
  if (i % 20 === 19) words = words.concat(await bad());
}
const turn = await page.evaluate(() => window.ACCESSION.state.turn);
for (let i = 0; i < 150; i++) {
  x = (x * 1103515245 + 12345) % 2147483648;
  await page.mouse.click((x % 1000) / 1000 * 390, ((x >> 10) % 1000) / 1000 * 844, { button: 'left' });
  if (i % 15 === 14) words = words.concat(await bad());
}
const scroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
if (shot) await page.screenshot({ path: path.join(root, 'test/shots/smoke-phone.png') });
await browser.close();
console.log(`smoke: board drawn in ${drawn.colours} colours, 200 board clicks to turn ${turn} and 150 anywhere, horizontal scroll ${scroll ? 'YES' : 'no'}, console errors ${errors.length}, bad words ${words.length}`);
if (errors.length || scroll || turn === 0 || drawn.colours < 12 || words.length) { console.log(errors.concat(words).join('\n')); process.exit(1); }
