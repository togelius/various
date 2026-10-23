// ACCESSION — the left-click-only script (BUILD.md §7.1, §11 M2). At phone and laptop size,
// in every board view, with nothing but left mouse clicks on what is on screen: walk to a
// tile, approach an exhibit, examine it, read its label from close by, close the label,
// open "How the museum works" from the top bar and from Settings, zoom, switch "Walk" to
// tap twice and walk with two taps, and switch the board view from Settings.
import { open } from './lib.mjs';
import { nextStep, labelVisible, logVisible } from './measure.mjs';

const problems = [], lines = [];
const bad = s => problems.push(s);
const SIZES = [[390, 844], [1280, 800]];

for (const [W, Hh] of SIZES) {
  const { browser, page, errors } = await open('dist/accession.html', { viewport: { width: W, height: Hh }, dpr: 2, query: '?dept=S9&seed=5' });
  await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state);
  const settle = () => page.waitForFunction(() => !window.ACCESSION.busy() && document.querySelectorAll('#board canvas').length > 0);
  // A player can click only what is on screen: anything hidden or below the fold fails.
  const centreOf = async sel => {
    const b = await page.locator(sel).first().boundingBox(), vp = page.viewportSize();
    if (!b || b.y + b.height / 2 < 0 || b.y + b.height / 2 > vp.height || b.x + b.width / 2 < 0 || b.x + b.width / 2 > vp.width) {
      await page.screenshot({ path: 'test/shots/play-fail.png' }); throw new Error(`${W}×${Hh}: not on screen, so not clickable: ${sel}`);
    }
    return [b.x + b.width / 2, b.y + b.height / 2];
  };
  const click = async (x, y) => { await page.mouse.click(x, y, { button: 'left' }); await settle(); };
  const clickEl = async sel => click(...await centreOf(sel));
  const you = () => page.evaluate(() => { const a = window.ACCESSION.state.actors[0]; return { x: a.x, y: a.y, turn: window.ACCESSION.state.turn }; });
  const sights = () => page.evaluate(() => window.ACCESSION.vm().actors.map(a => a.uid + a.mode + a.pips).join());
  // A free, visible, reachable tile 1–3 steps from you, its centre on the board.
  const freeTile = () => page.evaluate(() => {
    const A = window.ACCESSION, vm = A.vm(), y = A.state.actors[0], b = document.getElementById('board').getBoundingClientRect();
    for (let r = 3; r >= 1; r--) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
      const x = y.x + dx, yy = y.y + dy;
      if (x < 0 || yy < 0 || x >= vm.w || yy >= vm.h || vm.vis[yy * vm.w + x] !== 2 || vm.actors.some(a => x >= a.x && yy >= a.y && x < a.x + a.size && yy < a.y + a.size)) continue;
      if (Path.to(A.state, x, yy).length !== r) continue;
      const c = A.renderer.tileRect(x, yy).centre, e = document.elementFromPoint(c.x, c.y);
      if (c.x > b.left && c.y > b.top && c.x < b.right && c.y < b.bottom && e && e.closest('#board') && A.renderer.pick(c.x, c.y).x === x && A.renderer.pick(c.x, c.y).y === yy) return { x, y: yy, c };
    }
    return null;
  });
  // A walk reaches the tile clicked, unless something new came into sight or changed state.
  const walkedTo = async (t, before, sightsBefore, tag) => {
    const after = await you(), changed = (await sights()) !== sightsBefore;
    if (after.x === before.x && after.y === before.y) bad(`${tag}: clicking a tile did not walk`);
    else if ((after.x !== t.x || after.y !== t.y) && !changed) bad(`${tag}: the walk stopped at ${after.x},${after.y}, short of ${t.x},${t.y}, with nothing new in sight`);
    return after;
  };
  // Reduced motion so walks finish at once; chosen by clicks like everything else.
  await clickEl('#setbtn'); await clickEl('[data-set="motion"][data-value="reduce"]'); await clickEl('#settings [data-close]');

  const views = await page.evaluate(() => window.ACCESSION.views.list());
  for (const v of views) {
    const tag = `${W}×${Hh} ${v.label}`;
    await clickEl('#setbtn');
    if (views.length > 1) await clickEl(`[data-set="board"][data-value="${v.id}"]`);
    await clickEl('#settings [data-close]');
    await page.evaluate(() => window.ACCESSION.renderer.ready.catch(() => {}));
    const active = await page.evaluate(() => window.ACCESSION.views.active());
    if (active.id !== v.id) { bad(`${tag}: fell back (${active.note})`); continue; }
    // Walk: one click on a free tile a few steps away.
    const start = await you(), s0 = await sights(), w = await freeTile();
    if (!w) bad(`${tag}: no free tile nearby to walk to`);
    else { await click(w.c.x, w.c.y); const m = await walkedTo(w, start, s0, tag); lines.push(`${tag}: walked from ${start.x},${start.y} to ${m.x},${m.y} with one click`); }
    // The log shows what happened: always on a laptop; on a phone, whenever the action
    // said something (a bump into a wall says it was refused).
    await clickEl('[data-act="wait"]');
    if (W >= 900 && !await page.evaluate(logVisible)) bad(`${tag}: after Wait, the log is not on screen`);
    const wall = await page.evaluate(() => {
      const A = window.ACCESSION, vm = A.vm(), R = A.renderer;
      for (const d of R.inspect()) if (d.kind === 'tile' && vm.tiles[d.y][d.x] === '#') {
        const c = R.tileRect(d.x, d.y).centre, p = R.pick(c.x, c.y), e = document.elementFromPoint(c.x, c.y);
        if (p && p.x === d.x && p.y === d.y && e && e.closest('#board')) return c;
      }
      return null;
    });
    if (wall) { await click(wall.x, wall.y); if (!await page.evaluate(logVisible)) bad(`${tag}: clicking a wall says nothing on screen`); }
    else bad(`${tag}: no wall tile on screen to click`);
    // Then tap visible tiles towards the nearest exhibit until it is within 2 tiles.
    let target = null;
    for (let i = 0; i < 40 && !target; i++) {
      const st = await page.evaluate(nextStep, 2);
      if (st.done) target = st.done;
      else if (st.stuck) { bad(`${tag}: ${st.stuck}`); break; }
      else await click(st.at.x, st.at.y);
    }
    if (!target) { bad(`${tag}: never came within 2 tiles of an exhibit`); continue; }
    // Examine and read: click an opaque pixel of the exhibit's sprite.
    const at = await page.evaluate(uid => {
      const A = window.ACCESSION, d = A.renderer.inspect().find(q => q.kind === 'actor' && q.id === uid);
      if (!d) return null;
      for (let j = 0; j < 9; j++) for (let i = 0; i < 9; i++) {
        const x = d.rect.x + d.rect.w * (0.1 + 0.1 * i), y = d.rect.y + d.rect.h * (0.1 + 0.1 * j), p = A.renderer.pick(x, y), a = A.vm().actors.find(q => q.uid === uid);
        if (p && p.x === a.x && p.y === a.y && document.elementFromPoint(x, y).closest('#board')) return { x, y };
      }
      return null;
    }, target);
    if (!at) { bad(`${tag}: ${target} has no clickable pixel on screen`); continue; }
    await click(at.x, at.y);
    const title = await page.evaluate(uid => Labels.of(window.ACCESSION.state, uid).title, target);
    const label = await page.evaluate(() => {
      const s = document.getElementById('sheet');
      return { para: (s.querySelector('.para') || {}).textContent || '', far: !!s.querySelector('.para i'), beh: (s.querySelector('.beh') || {}).textContent || '' };
    });
    if (!await page.evaluate(labelVisible, title)) bad(`${tag}: clicking ${target} did not show its label`);
    if (label.far || !label.para.trim()) bad(`${tag}: within 2 tiles, the label's paragraph is not shown`);
    if (!label.beh.trim()) bad(`${tag}: the label has no Behaviour line`);
    lines.push(`${tag}: examined and read "${title}" (${label.para.trim().split(/\s+/).length} words)`);
    await clickEl('#sheet [data-close]');
    if (await page.evaluate(labelVisible, title)) bad(`${tag}: Close left the label on screen`);
    // How the museum works: from the top bar, and in one click from Settings.
    await clickEl('#howbtn');
    const systems = await page.evaluate(() => document.querySelectorAll('#how .systems li').length);
    if (systems !== 9) bad(`${tag}: "How the museum works" lists ${systems} systems, not 9`);
    await clickEl('#how [data-close]');
    await clickEl('#setbtn'); await clickEl('#settings [data-how]');
    if (!await page.evaluate(() => document.getElementById('how').classList.contains('open') && !document.getElementById('settings').classList.contains('open'))) bad(`${tag}: "How the museum works" is not one click from Settings`);
    await clickEl('#how [data-close]');
    // Zoom.
    const z0 = await page.evaluate(() => window.ACCESSION.renderer.zoom);
    await clickEl('#zoombtn');
    const z1 = await page.evaluate(() => window.ACCESSION.renderer.zoom);
    if (z1 === z0) bad(`${tag}: the Zoom button did not change the zoom`);
    await clickEl('#zoombtn');
    // Walk: tap twice. The first tap previews, the second goes.
    await clickEl('#setbtn'); await clickEl('[data-set="walk"][data-value="two"]'); await clickEl('#settings [data-close]');
    const t = await freeTile();
    if (t) {
      const before = await you(), s1 = await sights();
      await click(t.c.x, t.c.y);
      const mid = await you(), previewed = await page.evaluate(() => !!(window.ACCESSION.vm().path || []).length);
      await click(t.c.x, t.c.y);
      if (mid.x !== before.x || mid.y !== before.y || !previewed) bad(`${tag}: with "tap twice", the first tap did not just preview the path`);
      await walkedTo(t, before, s1, tag + ' (tap twice)');
    } else bad(`${tag}: no free tile nearby for the two-tap walk`);
    await clickEl('#setbtn'); await clickEl('[data-set="walk"][data-value="one"]'); await clickEl('#settings [data-close]');
    lines.push(`${tag}: label closed, how-it-works from the top bar and from Settings, zoom stepped, two-tap walk done`);
  }
  await browser.close();
  if (errors.length) bad(`${W}×${Hh}: console errors: ${errors.join('; ')}`);
}
for (const l of lines) console.log(l);
for (const p of problems) console.log('PROBLEM ' + p);
console.log(problems.length ? `play: ${problems.length} problem(s)` : `play: left clicks only, phone and laptop, every view: walked, examined, read, zoomed, two-tap walk, no problems`);
process.exit(problems.length ? 1 : 0);
