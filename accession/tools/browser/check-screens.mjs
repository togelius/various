// ACCESSION — the screen checks (BUILD.md §6.3, §7.2, §11 M2), for every registered board
// view at 390×844 and 1280×800: no horizontal scroll and nothing past the window's edge;
// no interactive target under 44 px, with the board, settings, "How the museum works" and
// the label panel each open; a zoom step whose tiles hold a 44-px disc; the tap-tolerance
// check at every zoom step; every hostile on screen carries the hostile mark; every actor
// in the view model is on the board or marked at its edge. Each view first asserts that it
// is the active one, so a silent fallback cannot pass.
import { open, root } from './lib.mjs';
import { layout, targets, board, nextStep } from './measure.mjs';
import path from 'node:path';

const SIZES = [[390, 844], [1280, 800]];
const SCENES = [{ dept: 'M11', seed: 3 }, { dept: 'S9', seed: 5 }, { dept: 'A4', seed: 7 }];
const P10 = { default: 12, big: 22 };
const shots = process.argv.includes('--shot');
const lines = [], problems = [];
const say = s => lines.push(s), bad = s => problems.push(s);

async function settle(page) {
  await page.waitForFunction(() => window.ACCESSION && !window.ACCESSION.busy());
  await page.evaluate(() => window.ACCESSION.renderer.ready.catch(() => {}));
}

for (const [w, h] of SIZES) {
  for (const sc of SCENES) {
    const { browser, page, errors } = await open('dist/accession.html', { viewport: { width: w, height: h }, dpr: 1, query: `?dept=${sc.dept}&seed=${sc.seed}` });
    await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state);
    await page.evaluate(() => window.ACCESSION.setting('motion', 'reduce'));
    // Walk until an exhibit is within 4 tiles, so the board has a hostile to check.
    for (let i = 0; i < 30; i++) {
      const st = await page.evaluate(nextStep, 4);
      if (st.done || st.stuck) break;
      await page.evaluate(t => window.ACCESSION.tap(t), st.tile);
      await settle(page);
    }
    const views = await page.evaluate(() => window.ACCESSION.views.list());
    for (const v of views) {
      await page.evaluate(id => window.ACCESSION.setting('board', id), v.id);
      await settle(page);
      const active = await page.evaluate(() => window.ACCESSION.views.active());
      const tag = `${w}×${h} ${sc.dept} ${v.label}`;
      if (active.id !== v.id) { bad(`${tag}: the ${v.label} view fell back (${active.note})`); continue; }
      const zooms = await page.evaluate(() => window.ACCESSION.renderer.zooms.length);
      let has44 = false;
      for (let z = 0; z < zooms; z++) {
        await page.evaluate(i => window.ACCESSION.setZoom(i), z);
        const m = await page.evaluate(board);
        const need = z === 0 ? P10.default : P10.big;
        if (m.disc >= 44) has44 = true;
        say(`${tag} zoom ${z}: ${m.tiles} tiles, tap radius p10 ${m.p10} px (min ${m.min}, needs ${need}), disc ${Math.floor(m.disc)} px, ${m.hostiles} hostile(s) marked, ${m.actors} actor(s)`);
        if (m.tiles < 20) bad(`${tag} zoom ${z}: only ${m.tiles} tiles measured`);
        if (m.p10 < need) bad(`${tag} zoom ${z}: tap radius p10 ${m.p10} px < ${need}`);
        if (z > 0 && m.disc < 44) bad(`${tag} zoom ${z}: a tile holds only a ${Math.floor(m.disc)}-px disc`);
        m.problems.forEach(p => bad(`${tag} zoom ${z}: ${p}`));
        for (const p of await page.evaluate(layout)) bad(`${tag} zoom ${z}: ${p}`);
        for (const p of await page.evaluate(targets)) bad(`${tag} zoom ${z}: ${p}`);
      }
      if (!has44) bad(`${tag}: no zoom step gives a 44-px disc inside each tile`);
      await page.evaluate(() => window.ACCESSION.setZoom(0));
      if (shots) await page.screenshot({ path: path.join(root, `test/shots/screens-${w}-${sc.dept}-${v.id}.png`) });
      // Each panel open in turn.
      const panels = [['settings', '#setbtn'], ['how', '#howbtn']];
      for (const [name, btn] of panels) {
        await page.click(btn);
        for (const p of [...await page.evaluate(layout), ...await page.evaluate(targets)]) bad(`${tag} ${name} open: ${p}`);
        await page.click(`#${name} [data-close]`);
      }
      const near = await page.evaluate(() => { const vm = window.ACCESSION.vm(); return vm.actors.find(a => a.uid !== 'you') || null; });
      if (near) {
        await page.evaluate(a => window.ACCESSION.tap({ x: a.x, y: a.y }), near);
        const open_ = await page.evaluate(() => document.getElementById('sheet').classList.contains('open') || getComputedStyle(document.getElementById('sheet')).position === 'static');
        if (!open_) bad(`${tag}: tapping ${near.uid} did not open its label`);
        for (const p of [...await page.evaluate(layout), ...await page.evaluate(targets)]) bad(`${tag} label open: ${p}`);
        await page.keyboard.press('Escape');
      } else bad(`${tag}: no exhibit in sight to open a label`);
    }
    if (errors.length) bad(`${w}×${h} ${sc.dept}: console errors: ${errors.join('; ')}`);
    await browser.close();
  }
}
for (const l of lines) console.log(l);
for (const p of problems) console.log('PROBLEM ' + p);
console.log(problems.length ? `screens: ${problems.length} problem(s)` : `screens: ${lines.length} board measurements, both sizes, every view, no problems`);
process.exit(problems.length ? 1 : 0);
