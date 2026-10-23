// ACCESSION — the 3D checks (BUILD.md §6.3, milestone M2b), Chromium with software WebGL.
// Fixed scenes in all three slice programmes (the enfilade of M.11, the case labyrinth of
// A.4, the sculpture court of S.9), at both zoom steps, at phone size. Each scene first
// asserts that the 3D view is the active one, so a silent fallback cannot pass.
//   Occlusion: of the visible tiles on screen with no actor or mark, at most 2% may show
//     less than 25% of their floor pixels (id buffer, scene against floor alone); a tile's
//     own case, plinth or bench counts as showing it.
//   On top: every actor and mark shows at least 90% of its own pixels over the scene.
//   Consistency: every actor and mark in the view model is in inspect(), on the board.
//   Context loss: WEBGL_lose_context loses and restores the context; the board keeps
//     drawing (the flat board stands in) and the 3D board returns.
//   Cost: frame and load times are recorded, not gated (no GPU here).
// The tap-tolerance and screen checks for both views are in check-screens.mjs.
import { open } from './lib.mjs';
import { board, nextStep } from './measure.mjs';

const SCENES = [{ dept: 'M11', seed: 3, prog: 'enfilade' }, { dept: 'A4', seed: 7, prog: 'case labyrinth' }, { dept: 'S9', seed: 5, prog: 'sculpture court' }];
const lines = [], problems = [];
const bad = s => problems.push(s);

for (const sc of SCENES) {
  const t0 = Date.now();
  const { browser, page, errors } = await open('dist/accession.html', { viewport: { width: 390, height: 844 }, dpr: 1, query: `?dept=${sc.dept}&seed=${sc.seed}&board=board3d` });
  await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state);
  const load = await page.evaluate(async () => { const t = performance.now(); await window.ACCESSION.renderer.ready.catch(() => {}); return performance.now() - t; });
  const tag = `${sc.dept} (${sc.prog})`;
  const active = await page.evaluate(() => window.ACCESSION.views.active());
  if (active.id !== 'board3d') { bad(`${tag}: the 3D view is not active (${active.note})`); await browser.close(); continue; }
  await page.evaluate(() => window.ACCESSION.setting('motion', 'reduce'));
  // A fixed scene: walk towards the nearest exhibit until it is within 4 tiles.
  for (let i = 0; i < 30; i++) {
    const st = await page.evaluate(nextStep, 4);
    if (st.done || st.stuck) break;
    await page.evaluate(t => window.ACCESSION.tap(t), st.tile);
    await page.waitForFunction(() => !window.ACCESSION.busy());
  }
  for (const z of [0, 1]) {
    await page.evaluate(i => window.ACCESSION.setZoom(i), z);
    const m = await page.evaluate(() => {
      const A = window.ACCESSION, R = A.renderer, vm = A.vm();
      const t = performance.now(); R.draw(vm); const frame = performance.now() - t;
      const floor = R.idBuffer({ floorOnly: true }), scene = R.idBuffer({ scene: true }), full = R.idBuffer();
      const count = buf => { const c = new Map(); for (const id of buf.ids) if (id) c.set(id, (c.get(id) || 0) + 1); return c; };
      const fc = count(floor), sc = count(scene), n = vm.w * vm.h;
      // Tiles with an actor or a mark on them are left out: what stands there covers them.
      const marked = new Set();
      for (const a of vm.actors) for (let dy = 0; dy < a.size; dy++) for (let dx = 0; dx < a.size; dx++) marked.add((a.y + dy) * vm.w + a.x + dx);
      for (const k of vm.marks) marked.add(k.y * vm.w + k.x);
      for (const [x, y] of vm.path || []) marked.add(y * vm.w + x);
      let tiles = 0, hidden = 0, worst = 1;
      for (const [id, total] of fc) {
        const i = id - 1;
        if (i < 0 || i >= n || marked.has(i) || vm.vis[i] !== 2 || total < 20) continue;
        tiles++;
        // A tile is shown by its floor or by what stands on it (a case covers its own floor).
        const f = ((sc.get(id) || 0) + (sc.get(id + n) || 0)) / total;
        worst = Math.min(worst, f);
        if (f < 0.25) hidden++;
      }
      const overlays = Object.values(full.legend).filter(l => l.alone);
      const low = overlays.filter(l => l.onTop / l.alone < 0.9).map(l => `${l.kind} ${l.id} ${Math.round(100 * l.onTop / l.alone)}%`);
      return { frame, tiles, hidden, worst, overlays: overlays.length, low };
    });
    const b = await page.evaluate(board);
    const pct = m.tiles ? 100 * m.hidden / m.tiles : 100;
    lines.push(`${tag} zoom ${z}: ${m.tiles} unmarked visible tiles, ${m.hidden} under 25% visible (${pct.toFixed(1)}%), least visible ${Math.round(100 * m.worst)}%; ${m.overlays} actors and marks on top; frame ${m.frame.toFixed(1)} ms`);
    if (m.tiles < 20) bad(`${tag} zoom ${z}: only ${m.tiles} tiles measured`);
    if (pct > 2) bad(`${tag} zoom ${z}: ${pct.toFixed(1)}% of unmarked visible tiles show under 25% of their floor`);
    if (!m.overlays) bad(`${tag} zoom ${z}: no actors or marks in the id buffer`);
    m.low.forEach(l => bad(`${tag} zoom ${z}: ${l} of its pixels show over the scene`));
    b.problems.forEach(p => bad(`${tag} zoom ${z}: ${p}`));
  }
  await page.evaluate(() => window.ACCESSION.setZoom(0));
  // Context loss and restore.
  const loss = await page.evaluate(async () => {
    const A = window.ACCESSION, c = document.querySelector('#board canvas'), gl = c.getContext('webgl2'), ext = gl && gl.getExtension('WEBGL_lose_context');
    if (!ext) return { error: 'WEBGL_lose_context is unavailable' };
    const tick = () => new Promise(r => setTimeout(r, 120));
    ext.loseContext(); await tick();
    const during = { standIn: A.renderer.standIn(), tiles: A.renderer.inspect().filter(d => d.kind === 'tile').length };
    A.act({ a: 'wait' });
    during.tilesAfterAct = A.renderer.inspect().filter(d => d.kind === 'tile').length;
    ext.restoreContext(); await tick();
    A.act({ a: 'wait' });
    const after = { standIn: A.renderer.standIn(), tiles: A.renderer.inspect().filter(d => d.kind === 'tile').length, ids: !!A.renderer.idBuffer() };
    return { during, after, active: A.views.active().id };
  });
  if (loss.error) bad(`${tag}: ${loss.error}`);
  else {
    lines.push(`${tag} context loss: flat stand-in ${loss.during.standIn}, ${loss.during.tilesAfterAct} tiles drawn while lost; restored: stand-in ${loss.after.standIn}, ${loss.after.tiles} tiles, id buffer ${loss.after.ids}`);
    if (!loss.during.standIn || !loss.during.tiles || !loss.during.tilesAfterAct) bad(`${tag}: while the context was lost the board stopped drawing`);
    if (loss.after.standIn || !loss.after.tiles || !loss.after.ids || loss.active !== 'board3d') bad(`${tag}: after restore the 3D board did not come back`);
  }
  lines.push(`${tag}: three.js ready in ${load.toFixed(0)} ms, page ${Date.now() - t0} ms in all`);
  if (errors.length) bad(`${tag}: console errors: ${errors.join('; ')}`);
  await browser.close();
}
for (const l of lines) console.log(l);
for (const p of problems) console.log('PROBLEM ' + p);
console.log(problems.length ? `3d: ${problems.length} problem(s)` : `3d: occlusion, marks on top, consistency and context loss pass in all three programmes at both zooms`);
process.exit(problems.length ? 1 : 0);
