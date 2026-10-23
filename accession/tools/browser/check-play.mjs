// ACCESSION — the left-click-only script (BUILD.md §7.1, §11 M2). In every board view, with
// nothing but left mouse clicks: walk, approach an exhibit, examine it, read its label from
// close by, close the label, open and close "How the museum works", zoom, switch "Walk" to
// tap twice and walk with two taps, and switch the board view from Settings.
import { open } from './lib.mjs';
import { nextStep } from './measure.mjs';

const problems = [], lines = [];
const bad = s => problems.push(s);
const { browser, page, errors } = await open('dist/accession.html', { viewport: { width: 390, height: 844 }, dpr: 2, query: '?dept=S9&seed=5' });
await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state);
const settle = () => page.waitForFunction(() => !window.ACCESSION.busy() && document.querySelectorAll('#board canvas').length > 0);
// A player can click only what is on screen: anything hidden or below the fold fails.
const centreOf = async sel => {
  const b = await page.locator(sel).first().boundingBox(), vp = page.viewportSize();
  if (!b || b.y + b.height / 2 < 0 || b.y + b.height / 2 > vp.height || b.x + b.width / 2 < 0 || b.x + b.width / 2 > vp.width) {
    await page.screenshot({ path: 'test/shots/play-fail.png' }); throw new Error('not on screen, so not clickable: ' + sel);
  }
  return [b.x + b.width / 2, b.y + b.height / 2];
};
const click = async (x, y) => { await page.mouse.click(x, y, { button: 'left' }); await settle(); };
const clickEl = async sel => click(...await centreOf(sel));
const you = () => page.evaluate(() => { const a = window.ACCESSION.state.actors[0]; return { x: a.x, y: a.y, turn: window.ACCESSION.state.turn }; });
const freeTile = () => page.evaluate(() => {
  const A = window.ACCESSION, vm = A.vm(), y = A.state.actors[0], b = document.getElementById('board').getBoundingClientRect();
  for (let r = 3; r >= 1; r--) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
    const x = y.x + dx, yy = y.y + dy;
    if (x < 0 || yy < 0 || x >= vm.w || yy >= vm.h || vm.vis[yy * vm.w + x] !== 2 || vm.actors.some(a => x >= a.x && yy >= a.y && x < a.x + a.size && yy < a.y + a.size)) continue;
    if (!Path.to(A.state, x, yy).length) continue;
    const c = A.renderer.tileRect(x, yy).centre;
    if (c.x > b.left && c.y > b.top && c.x < b.right && c.y < b.bottom) return { x, y: yy, c };
  }
  return null;
});
// Reduced motion so walks finish at once; chosen by clicks like everything else.
await clickEl('#setbtn'); await clickEl('[data-set="motion"][data-value="reduce"]'); await clickEl('#settings [data-close]');

const views = await page.evaluate(() => window.ACCESSION.views.list());
for (const v of views) {
  await clickEl('#setbtn'); 
  if (views.length > 1) await clickEl(`[data-set="board"][data-value="${v.id}"]`);
  await clickEl('#settings [data-close]');
  await page.evaluate(() => window.ACCESSION.renderer.ready.catch(() => {}));
  const active = await page.evaluate(() => window.ACCESSION.views.active());
  if (active.id !== v.id) { bad(`${v.label}: fell back (${active.note})`); continue; }
  const tag = v.label;
  // Walk: one click on a free visible tile a few steps away.
  const start = await you(), w = await freeTile();
  if (w) await click(w.c.x, w.c.y);
  const moved = await you();
  if (!w || (moved.x === start.x && moved.y === start.y)) bad(`${tag}: clicking a tile did not walk`);
  lines.push(`${tag}: walked from ${start.x},${start.y} to ${moved.x},${moved.y} with one click`);
  // Then tap visible tiles towards the nearest exhibit until it is within 2 tiles.
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    const st = await page.evaluate(nextStep, 2);
    if (st.done) target = st.done;
    else if (st.stuck) { bad(`${tag}: ${st.stuck}`); break; }
    else await click(st.at.x, st.at.y);
  }
  if (!target) { bad(`${tag}: never came within 2 tiles of an exhibit`); continue; }
  // Examine and read: click the exhibit's sprite.
  const rect = await page.evaluate(uid => (window.ACCESSION.renderer.inspect().find(d => d.kind === 'actor' && d.id === uid) || {}).rect, target);
  if (!rect) { bad(`${tag}: ${target} is not drawn`); continue; }
  await click(rect.x + rect.w / 2, rect.y + rect.h / 2);
  const label = await page.evaluate(() => {
    const s = document.getElementById('sheet');
    return { open: s.classList.contains('open') || getComputedStyle(s).position === 'static', title: (s.querySelector('h2') || {}).textContent || '',
      para: (s.querySelector('.para') || {}).textContent || '', far: !!s.querySelector('.para i'), beh: (s.querySelector('.beh') || {}).textContent || '' };
  });
  if (!label.open || !label.title.trim()) bad(`${tag}: clicking ${target} did not open its label`);
  if (label.far || !label.para.trim()) bad(`${tag}: within 2 tiles, the label's paragraph is not shown`);
  if (!label.beh.trim()) bad(`${tag}: the label has no Behaviour line`);
  lines.push(`${tag}: examined and read "${label.title.trim()}" (${label.para.trim().split(/\s+/).length} words)`);
  await clickEl('#sheet [data-close]');
  // How the museum works.
  await clickEl('#howbtn');
  const systems = await page.evaluate(() => document.querySelectorAll('#how .systems li').length);
  if (systems !== 9) bad(`${tag}: "How the museum works" lists ${systems} systems, not 9`);
  await clickEl('#how [data-close]');
  // Zoom.
  const z0 = await page.evaluate(() => window.ACCESSION.renderer.zoom);
  await clickEl('[data-act="zoom"]');
  const z1 = await page.evaluate(() => window.ACCESSION.renderer.zoom);
  if (z1 === z0) bad(`${tag}: the Zoom button did not change the zoom`);
  await clickEl('[data-act="zoom"]');
  // Walk: tap twice. The first tap previews, the second goes.
  await clickEl('#setbtn'); await clickEl('[data-set="walk"][data-value="two"]'); await clickEl('#settings [data-close]');
  const t = await freeTile();
  if (t) {
    const before = await you();
    await click(t.c.x, t.c.y);
    const mid = await you();
    const previewed = await page.evaluate(() => !!window.ACCESSION.vm().path);
    await click(t.c.x, t.c.y);
    const after = await you();
    if (mid.x !== before.x || mid.y !== before.y || !previewed) bad(`${tag}: with "tap twice", the first tap did not just preview the path`);
    if (after.x === before.x && after.y === before.y) bad(`${tag}: with "tap twice", the second tap did not walk`);
  } else bad(`${tag}: no free tile nearby for the two-tap walk`);
  await clickEl('#setbtn'); await clickEl('[data-set="walk"][data-value="one"]'); await clickEl('#settings [data-close]');
  lines.push(`${tag}: label closed, how-it-works opened and closed, zoom stepped, two-tap walk done`);
}
await browser.close();
if (errors.length) bad('console errors: ' + errors.join('; '));
for (const l of lines) console.log(l);
for (const p of problems) console.log('PROBLEM ' + p);
console.log(problems.length ? `play: ${problems.length} problem(s)` : `play: left clicks only, ${views.length} view(s): walked, examined, read, zoomed, two-tap walk, no problems`);
process.exit(problems.length ? 1 : 0);
