// ACCESSION — the screen checks (BUILD.md §6.3, §7.2, §11 M2), for every registered board
// view at 390×844 and 1280×800: no horizontal scroll and nothing past the window's edge;
// no interactive target under 44 px, with the board, settings, "How the museum works" and
// the label panel each open; a zoom step whose tiles hold a 44-px disc; the tap-tolerance
// check at every zoom step; every hostile on screen carries the hostile mark; every actor
// in the view model is on the board or marked at its edge. Each view first asserts that it
// is the active one, so a silent fallback cannot pass.
import { open, root } from './lib.mjs';
import { layout, targets, board, nextStep, labelVisible, freeTile, actionButton } from './measure.mjs';
import path from 'node:path';

const SIZES = [[390, 844], [1280, 800]];
// The narrowest phones in common use, for the top bar at every text size.
const NARROW = [[360, 740], [375, 667], [390, 844]];
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
    // Every text size: nothing overflows and the health number is whole.
    for (const size of ['1', '1.15', '1.3']) {
      await page.evaluate(v => window.ACCESSION.setting('text', v), size);
      const hp = await page.evaluate(() => { const e = document.getElementById('hpnum'); return { cut: e.scrollWidth > e.clientWidth + 1, text: e.textContent }; });
      if (hp.cut) bad(`${w}×${h} ${sc.dept} text ${size}: the health number "${hp.text}" is cut short`);
      for (const p of [...await page.evaluate(layout), ...await page.evaluate(targets)]) bad(`${w}×${h} ${sc.dept} text ${size}: ${p}`);
    }
    await page.evaluate(() => window.ACCESSION.setting('text', '1'));
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
      // The path preview is drawn: Walk set to tap twice, one tap on a free tile.
      await page.evaluate(() => window.ACCESSION.setting('walk', 'two'));
      const ft = await page.evaluate(freeTile);
      if (ft) {
        await page.evaluate(t => window.ACCESSION.tap({ x: t.x, y: t.y }), ft);
        const m = await page.evaluate(board);
        if (!m.path) bad(`${tag}: one tap with "tap twice" showed no path preview`);
        m.problems.forEach(p => bad(`${tag} path preview: ${p}`));
        await page.keyboard.press('Escape');
      } else bad(`${tag}: no free tile for the path preview`);
      await page.evaluate(() => window.ACCESSION.setting('walk', 'one'));
      // A label opened beside an exhibit, so its action button shows: the label, its button,
      // the selection, and every hostile on the clear part of the board or at its edge.
      for (let i = 0; i < 20; i++) {
        const st = await page.evaluate(nextStep, 1);
        if (st.done || st.stuck) break;
        await page.evaluate(t => window.ACCESSION.tap(t), st.tile);
        await settle(page);
      }
      const near = await page.evaluate(() => {
        const A = window.ACCESSION, you = A.state.actors[0];
        return A.vm().actors.filter(a => a.uid !== 'you').sort((p, q) => Actors.dist(Actors.byUid(A.state, p.uid), you.x, you.y) - Actors.dist(Actors.byUid(A.state, q.uid), you.x, you.y))[0] || null;
      });
      if (near) {
        await page.evaluate(a => window.ACCESSION.tap({ x: a.x, y: a.y }), near);
        const title = await page.evaluate(uid => Labels.of(window.ACCESSION.state, uid).title, near.uid);
        if (!await page.evaluate(labelVisible, title)) bad(`${tag}: tapping ${near.uid} did not show its label`);
        const adjacent = await page.evaluate(uid => Step.adjacent(window.ACCESSION.state, window.ACCESSION.state.actors[0], Actors.byUid(window.ACCESSION.state, uid)), near.uid);
        const btn = await page.evaluate(actionButton);
        if (adjacent && !btn.seen) bad(`${tag}: the label of an adjacent exhibit shows no action button a player can see (${btn.count} in the page)`);
        else if (adjacent && (btn.seen.w < 44 || btn.seen.h < 44)) bad(`${tag}: the action button "${btn.seen.text}" is ${Math.round(btn.seen.w)}×${Math.round(btn.seen.h)}`);
        if (!adjacent) bad(`${tag}: could not stand beside an exhibit to check its action button`);
        // With the label open, you and the exhibit stay in view above it, so a second tap
        // on the exhibit can still act (§7.1).
        const hidden = await page.evaluate(uid => {
          const A = window.ACCESSION, R = A.renderer, out = [];
          for (const a of A.vm().actors.filter(q => q.uid === 'you' || q.uid === uid)) {
            const c = R.tileRect(a.x, a.y).centre, e = document.elementFromPoint(c.x, c.y);
            if (!e || !e.closest('#board')) out.push(a.uid);
          }
          return out;
        }, near.uid);
        if (hidden.length) bad(`${tag} label open: ${hidden.join(' and ')} hidden behind the label`);
        const m = await page.evaluate(board);
        if (!m.selection) bad(`${tag}: the selection was not set with the label open`);
        m.problems.forEach(p => bad(`${tag} label open: ${p}`));
        for (const p of [...await page.evaluate(layout), ...await page.evaluate(targets)]) bad(`${tag} label open: ${p}`);
        await page.keyboard.press('Escape');
      } else bad(`${tag}: no exhibit in sight to open a label`);
    }
    if (errors.length) bad(`${w}×${h} ${sc.dept}: console errors: ${errors.join('; ')}`);
    await browser.close();
  }
}
// A far exhibit's label (a fixed frame): in A.4, seed 7, at the 48-px zoom, from (5,5), the
// bust at (4,17) is in sight 12 rows south. Its label open, you and it cannot both fit above
// the sheet: you stay in view and it is on the board or marked at its edge.
const registered = await (async () => {
  const { browser, page } = await open('dist/accession.html', { viewport: { width: 390, height: 844 }, dpr: 1, query: '?dept=A4&seed=7' });
  await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state);
  const v = await page.evaluate(() => window.ACCESSION.views.list().map(x => x.id));
  await browser.close();
  return v;
})();
for (const view of registered) {
  const { browser, page, errors } = await open('dist/accession.html', { viewport: { width: 390, height: 844 }, dpr: 1, query: `?dept=A4&seed=7&board=${view}` });
  await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state);
  await page.evaluate(() => window.ACCESSION.renderer.ready.catch(() => {}));
  const frame = await page.evaluate(() => {
    const A = window.ACCESSION; A.setZoom(1);
    for (const [x, y] of Path.to(A.state, 5, 5)) { const me = A.state.actors[0]; A.act({ a: 'move', dir: Path.dirTo([me.x, me.y], [x, y]) }); }
    const me = A.state.actors[0], a = A.vm().actors.find(q => q.uid !== 'you' && q.y - me.y >= 7);
    if (!a || me.x !== 5 || me.y !== 5) return null;
    A.tap({ x: a.x, y: a.y });
    return a.uid;
  });
  const tag = `390×844 A4 far label (${view})`;
  if (!frame) bad(`${tag}: the fixed frame is no longer reachable; choose another`);
  else {
    const youSeen = await page.evaluate(() => { const A = window.ACCESSION, y = A.state.actors[0], c = A.renderer.tileRect(y.x, y.y).centre, e = document.elementFromPoint(c.x, c.y); return !!e && !!e.closest('#board'); });
    if (!youSeen) bad(`${tag}: you are out of view`);
    (await page.evaluate(board)).problems.forEach(p => bad(`${tag}: ${p}`));
    lines.push(`${tag}: label of ${frame} open, you in view`);
  }
  if (errors.length) bad(`${tag}: console errors: ${errors.join('; ')}`);
  await browser.close();
}
for (const [w, h] of NARROW) {
  const { browser, page, errors } = await open('dist/accession.html', { viewport: { width: w, height: h }, dpr: 2, query: '?dept=S9&seed=5' });
  await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state);
  for (const size of ['1', '1.15', '1.3']) {
    await page.evaluate(v => window.ACCESSION.setting('text', v), size);
    const hp = await page.evaluate(() => { const e = document.getElementById('hpnum'), d = document.getElementById('dial').getBoundingClientRect(), r = e.lastElementChild.getBoundingClientRect(); return { cut: e.scrollWidth > e.clientWidth + 1 || r.right > d.left, text: e.textContent }; });
    if (hp.cut) bad(`${w}×${h} text ${size}: the health number "${hp.text}" is cut short or runs into the dial`);
    // The badge prints the grade's full name (§8.7) wherever it fits: always at 390 px.
    const caption = await page.evaluate(() => { const r = document.querySelector('.badge-name').getBoundingClientRect(); return r.width > 2 && r.height > 2; });
    if (w >= 390 && !caption) bad(`${w}×${h} text ${size}: the badge does not show "Handling Clearance"`);
    for (const p of [...await page.evaluate(layout), ...await page.evaluate(targets)]) bad(`${w}×${h} text ${size}: ${p}`);
  }
  lines.push(`${w}×${h}: top bar checked at every text size`);
  if (errors.length) bad(`${w}×${h}: console errors: ${errors.join('; ')}`);
  await browser.close();
}
for (const l of lines) console.log(l);
for (const p of problems) console.log('PROBLEM ' + p);
console.log(problems.length ? `screens: ${problems.length} problem(s)` : `screens: ${lines.length} measurements, both sizes and three narrow phones, every view, no problems`);
process.exit(problems.length ? 1 : 0);
