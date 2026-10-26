// ACCESSION — the screen checks (BUILD.md §6.3, §7.2, §11 M2), for every registered board
// view at 390×844 and 1280×800: no horizontal scroll and nothing past the window's edge;
// no interactive target under 44 px, with the board, settings, "How the museum works" and
// the label panel each open; a zoom step whose tiles hold a 44-px disc; the tap-tolerance
// check at every zoom step; the longest Behaviour line fits the strip; every hostile on
// screen carries the hostile mark; every actor in the view model is on the board or marked
// at its edge. Each view first asserts that it is the active one, so a silent fallback
// cannot pass. Then M3's screens (BUILD.md §7.1, §7.2), in every view at both sizes and at
// the smallest and largest text: the top bar with each stage's chip (its turns never cut
// short) and your statuses, your label, a case's label, the confirmation sheet, the bell's
// banner and the recap, each with no sideways scroll and no target under 44 px; the
// confirmation from the keyboard (modal, the focus given back), Enter with a carried item
// selected, the night watch's banner in a phone's strip, and the recap and confirmation
// named for a screen reader.
import { open, root } from './lib.mjs';
import { layout, targets, board, nextStep, labelVisible, freeTile, actionButton } from './measure.mjs';
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
    // Every text size: nothing overflows and the health number is whole.
    for (const size of ['1', '1.15', '1.3']) {
      await page.evaluate(v => window.ACCESSION.setting('text', v), size);
      const hp = await page.evaluate(() => { const e = document.getElementById('hpnum'); return { cut: e.scrollWidth > e.clientWidth + 1, text: e.textContent }; });
      if (hp.cut) bad(`${w}×${h} ${sc.dept} text ${size}: the health number "${hp.text}" is cut short`);
      for (const p of [...await page.evaluate(layout), ...await page.evaluate(targets)]) bad(`${w}×${h} ${sc.dept} text ${size}: ${p}`);
    }
    // The longest Behaviour line in the packs, with the deepest depth's numbers, in the strip
    // at the smallest and largest text: nothing overflows, and on a phone the board keeps at
    // least 40% of the window's height (the lines' length budget, BUILD.md §5.3).
    if (sc === SCENES[0]) for (const size of ['1', '1.3']) {
      await page.evaluate(v => window.ACCESSION.setting('text', v), size);
      const m = await page.evaluate(() => {
        let best = null;
        for (const p of Packs.list()) for (const sp of [...p.species, p.centrepiece]) { const l = Clauses.line(sp, { depth: 7 }); if (!best || l.length > best.line.length) best = { sp, line: l }; }
        UI.strip({ uid: best.sp.id, title: best.sp.name, stateIcons: ['asleep'], pictos: ['ring', 'axis'], behaviour: best.line }, [], false);
        const shown = [...document.querySelectorAll('#strip .behaviour')].some(e => e.textContent === best.line && e.getBoundingClientRect().height > 0);
        return { id: best.sp.id, len: best.line.length, shown, board: Math.round(document.getElementById('board').getBoundingClientRect().height) };
      });
      const tag = `${w}×${h} text ${size} with ${m.id}'s Behaviour line (${m.len} characters) in the strip`;
      if (!m.shown) bad(`${tag}: the line is not shown`);
      for (const p of await page.evaluate(layout)) bad(`${tag}: ${p}`);
      if (w < 900 && m.board < 0.4 * h) bad(`${tag}: the board is left ${m.board} px of ${h}`);
      say(`${tag}: board ${m.board} px`);
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
  await page.evaluate(() => window.ACCESSION.setting('motion', 'reduce'));
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
  else if (!await page.evaluate(uid => UI.labelShown() === uid && UI.sheetCover() > 0, frame) || !await page.evaluate(labelVisible, await page.evaluate(uid => Labels.of(window.ACCESSION.state, uid).title, frame))) bad(`${tag}: tapping ${frame} did not open its label over the board`);
  else {
    const youSeen = await page.evaluate(() => { const A = window.ACCESSION, y = A.state.actors[0], c = A.renderer.tileRect(y.x, y.y).centre, e = document.elementFromPoint(c.x, c.y); return !!e && !!e.closest('#board'); });
    if (!youSeen) bad(`${tag}: you are out of view`);
    (await page.evaluate(board)).problems.forEach(p => bad(`${tag}: ${p}`));
    lines.push(`${tag}: label of ${frame} open, you in view`);
  }
  if (errors.length) bad(`${tag}: console errors: ${errors.join('; ')}`);
  await browser.close();
}
// A 2×2 Centrepiece (S.9, seed 5), at laptop size, by real clicks: from the tile north of it,
// click its far row, then the same point again; the second click strikes it (§7.1), because
// opening the label beside it leaves the board where it was. M3 departments leave the
// Centrepiece out until M4 places it (§5.5), so it is stood on its plinth here, asleep, as M2
// placed it, and you are placed on the tile north of it (one you could walk to) rather than
// walked there, since a walk wakes the sleepers it passes (§8.2).
for (const view of registered) {
  const { browser, page, errors } = await open('dist/accession.html', { viewport: { width: 1280, height: 800 }, dpr: 1, query: `?dept=S9&seed=5&board=${view}` });
  await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state);
  await page.evaluate(() => window.ACCESSION.renderer.ready.catch(() => {}));
  await page.evaluate(() => window.ACCESSION.setting('motion', 'reduce'));
  const tag = `1280×800 S9 Centrepiece (${view})`;
  const placed = await page.evaluate(() => {
    const A = window.ACCESSION, s = A.state, p = Packs.get(s.dept.acc), cp = p.centrepiece, stats = Roles.stats('centrepiece', s.dept.depth);
    const [x, y] = Layout.generate(p.programme, 0, s.seed, { acc: p.acc, depth: s.dept.depth }).plan.cpl;
    const a = Actors.spawn(s, Object.assign({}, stats, { uid: `${p.acc}.${s.dept.depth}.centre.1`, sp: cp.id, arch: cp.archetype, size: cp.size || 1, x, y, mode: 'dormant', maxHp: stats.hp }));
    if (a.size !== 2 || !Grid.walkable(s.dept, a.x, a.y - 1) || Actors.at(s, a.x, a.y - 1) || !Path.to(s, a.x, a.y - 1).length) return null;
    const me = s.actors[0];
    me.x = a.x; me.y = a.y - 1;
    return a.uid;
  });
  if (placed) await page.evaluate(() => window.ACCESSION.setting('motion', 'reduce'));
  const c = placed && await page.evaluate(uid => {
    const A = window.ACCESSION, a = Actors.byUid(A.state, uid);
    return { uid, at: A.renderer.tileRect(a.x, a.y + 1).centre, hp: a.hp };
  }, placed);
  if (!c) { bad(`${tag}: could not stand north of the Centrepiece`); await browser.close(); continue; }
  await page.mouse.click(c.at.x, c.at.y);
  const opened = await page.evaluate(uid => UI.labelShown() === uid, c.uid);
  await page.mouse.click(c.at.x, c.at.y);
  const after = await page.evaluate(uid => Actors.byUid(window.ACCESSION.state, uid).hp, c.uid);
  if (!opened) bad(`${tag}: clicking its far row did not open its label`);
  else if (after >= c.hp) bad(`${tag}: the second click on its far row did not strike it`);
  else lines.push(`${tag}: second click on the far row struck it (${c.hp} → ${after})`);
  if (errors.length) bad(`${tag}: console errors: ${errors.join('; ')}`);
  await browser.close();
}
// The top bar on phones from 360 to 400 px wide, at every text size: the health number is
// whole and clear of the dial, and the badge prints the grade's full name wherever it fits
// (always from 390 px).
{
  const { browser, page, errors } = await open('dist/accession.html', { viewport: { width: 400, height: 800 }, dpr: 2, query: '?dept=S9&seed=5' });
  await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state);
  let checked = 0;
  for (const size of ['1', '1.15', '1.3']) {
    await page.evaluate(v => window.ACCESSION.setting('text', v), size);
    for (let w = 360; w <= 400; w++) {
      await page.setViewportSize({ width: w, height: 800 });
      const r = await page.evaluate(() => {
        const e = document.getElementById('hpnum'), d = document.getElementById('dial').getBoundingClientRect(), n = e.lastElementChild.getBoundingClientRect(), c = document.querySelector('.badge-name').getBoundingClientRect();
        return { cut: e.scrollWidth > e.clientWidth + 1 || n.right > d.left, caption: c.width > 2 && c.height > 2 };
      });
      if (r.cut) bad(`${w} px wide, text ${size}: the health number is cut short or runs into the dial`);
      if (w >= 390 && !r.caption) bad(`${w} px wide, text ${size}: the badge does not show "Handling Clearance"`);
      if (w % 8 === 0) for (const p of [...await page.evaluate(layout), ...await page.evaluate(targets)]) bad(`${w} px wide, text ${size}: ${p}`);
      checked++;
    }
  }
  lines.push(`top bar: ${checked} widths and text sizes checked`);
  if (errors.length) bad(`top bar sweep: console errors: ${errors.join('; ')}`);
  await browser.close();
}
// M3's screens, staged on the state (M.11, seed 3): each stage's chip with two statuses in the
// top bar; your label on an exit (Wait, Rest, Leave); a case's label; the confirmation
// before leaving and before breaking glass; the bell's banner in the strip; and the recap of
// a death. At text sizes 1 and 1.3, nothing scrolls sideways and no target is under 44 px.
for (const [w, h] of SIZES) for (const view of registered) {
  const { browser, page, errors } = await open('dist/accession.html', { viewport: { width: w, height: h }, dpr: 1, query: `?dept=M11&seed=3&board=${view}` });
  await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state);
  await page.evaluate(() => window.ACCESSION.renderer.ready.catch(() => {}));
  await page.evaluate(() => window.ACCESSION.setting('motion', 'reduce'));
  const tag = `${w}×${h} M11 M3 screens (${view})`;
  const check = async what => { for (const p of [...await page.evaluate(layout), ...await page.evaluate(targets)]) bad(`${tag} ${what}: ${p}`); };
  let seen = 0;
  for (const size of ['1', '1.3']) {
    await page.evaluate(v => window.ACCESSION.setting('text', v), size);
    // The stages' chips, with two statuses on you.
    for (const stage of [0, 1, 2]) {
      const chip = await page.evaluate(n => {
        const A = window.ACCESSION, s = A.state, me = s.actors[0], c = s.dept.clock;
        for (const id of ['dazed', 'coughing']) if (!Status.has(me, id)) Status.apply(s, me, id, 12, { k: 'status', id }, []);
        Status.settle(s);
        c.stage = n; c.count = [0, c.B, c.B + c.G][n]; A.redraw();
        // Its words' own width, to the subpixel, against the room they are given.
        const next = document.querySelector('#stage .snext'), words = document.createRange();
        if (next) words.selectNodeContents(next);
        const room = next && Math.min(next.getBoundingClientRect().right, document.getElementById('stage').getBoundingClientRect().right);
        return { stage: document.getElementById('stage').textContent, statuses: document.querySelectorAll('#statuses .st').length, cut: !next || words.getBoundingClientRect().right > room + 0.01 };
      }, stage);
      if (!chip.stage || chip.statuses !== 2) bad(`${tag} text ${size}: stage ${stage} shows "${chip.stage}" and ${chip.statuses} statuses`);
      // What comes next (its turns) is never cut short; the stage's name gives way first.
      if (chip.cut) bad(`${tag} text ${size}: beside two statuses, the stage chip "${chip.stage}" is cut short before its turns`);
      await check(`text ${size} stage ${stage}`);
    }
    // Your label on an exit, then the confirmation before leaving.
    const leave = await page.evaluate(() => {
      const A = window.ACCESSION, s = A.state, me = s.actors[0], [x, y] = s.dept.exits[0];
      for (const a of s.actors) if (a.uid !== 'you' && !a.gone) { a.mode = 'dormant'; a.telegraph = null; }
      me.x = x; me.y = y; A.redraw(); A.tap({ x, y });
      const l = UI.labelShown() === 'you' && [...document.querySelectorAll('#sheet [data-label-act]')].map(b => b.dataset.labelAct);
      return l;
    });
    if (!leave || !leave.includes('leave')) bad(`${tag} text ${size}: your label on an exit offers ${leave ? leave.join(', ') : 'nothing'}`);
    await check(`text ${size} your label`);
    await page.evaluate(() => window.ACCESSION.request({ a: 'leave', i: 0 }));
    if (!await page.evaluate(() => UI.confirmOpen())) bad(`${tag} text ${size}: leaving did not ask first`);
    await check(`text ${size} confirmation`);
    await page.keyboard.press('Escape');
    // A case's label, then the confirmation before breaking its glass.
    const brk = await page.evaluate(() => {
      const A = window.ACCESSION, s = A.state, me = s.actors[0];
      for (const f of s.dept.fixtures) {
        if (f.k !== 'case' || f.st !== 'shut') continue;
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const x = f.x + dx, y = f.y + dy;
          if (!Grid.walkable(s.dept, x, y) || Actors.at(s, x, y, me)) continue;
          me.x = x; me.y = y;
          if (!Labels.allowed(s, { a: 'bash', x: f.x, y: f.y })) continue;
          A.redraw(); A.tap({ x: f.x, y: f.y });
          return { x: f.x, y: f.y };
        }
      }
      return null;
    });
    if (!brk) bad(`${tag} text ${size}: no case to break`);
    else {
      await check(`text ${size} a case's label`);
      await page.evaluate(c => window.ACCESSION.request({ a: 'bash', x: c.x, y: c.y }), brk);
      if (!await page.evaluate(() => UI.confirmOpen())) bad(`${tag} text ${size}: breaking glass did not ask first`);
      await check(`text ${size} confirmation to break`);
      await page.keyboard.press('Escape');
    }
    await page.keyboard.press('Escape');
    seen++;
  }
  // The confirmation is modal (§7.1). From the keyboard: a case's Break button, focused,
  // pressed with Enter, asks; while it asks, Tab and Shift+Tab never bring the focus to
  // anything behind the sheet, and nothing there can take it; Escape cancels, and the focus
  // goes back to the Break button.
  const modal = await page.evaluate(() => {
    const A = window.ACCESSION, s = A.state, me = s.actors[0];
    UI.closeLabel();
    for (const f of s.dept.fixtures) {
      if (f.k !== 'case' || f.st !== 'shut') continue;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const x = f.x + dx, y = f.y + dy;
        if (!Grid.walkable(s.dept, x, y) || Actors.at(s, x, y, me)) continue;
        me.x = x; me.y = y;
        if (!Labels.allowed(s, { a: 'bash', x: f.x, y: f.y })) continue;
        A.redraw(); A.tap({ x: f.x, y: f.y });
        const b = document.querySelector('#sheet [data-label-act="bash"]');
        if (!b) continue;
        b.focus();
        return { tick: s.tick };
      }
    }
    return null;
  });
  if (!modal) bad(`${tag}: no case with a Break button to press from the keyboard`);
  else {
    await page.keyboard.press('Enter');
    const away = [];
    if (!await page.evaluate(() => UI.confirmOpen())) bad(`${tag}: Enter on a focused Break button did not ask first`);
    for (const k of ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
      await page.keyboard.press(k);
      const at = await page.evaluate(() => { const e = document.activeElement; return !e || e === document.body || e.closest('#confirm.open') ? null : (e.id || e.dataset.act || e.textContent.trim().slice(0, 20)); });
      if (at) away.push(at);
    }
    const taken = await page.evaluate(() => { document.querySelector('#bar [data-act="wait"]').focus(); return !document.activeElement.closest('#confirm.open') && document.activeElement !== document.body; });
    if (away.length || taken) bad(`${tag}: while the confirmation asks, the focus reached ${away.concat(taken ? ['the bar\'s Wait'] : []).join(', ')} behind it`);
    // Nor is anything else done before it is answered: another action asked for meanwhile
    // (as the Bag's act or a key would) is not taken, and the sheet still asks its own.
    const other = await page.evaluate(() => { const A = window.ACCESSION, t = A.state.tick, r = A.request({ a: 'wait' }); return { done: r !== null || A.state.tick !== t, still: !!A.asking && A.asking.a === 'bash' }; });
    if (other.done || !other.still) bad(`${tag}: an action asked for while the confirmation asks was ${other.done ? 'taken' : 'not taken'}, and the sheet ${other.still ? 'still asks' : 'no longer asks'} its own`);
    await page.keyboard.press('Escape');
    const back = await page.evaluate(() => ({ act: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.labelAct : null, tick: window.ACCESSION.state.tick, open: UI.confirmOpen() }));
    if (back.open || back.tick !== modal.tick) bad(`${tag}: Escape did not cancel the confirmation`);
    else if (back.act !== 'bash') bad(`${tag}: after Escape the focus is not back on the Break button (${back.act})`);
    // Held down, Enter presses the Break button once, which asks; its repeats answer nothing.
    await page.keyboard.down('Enter');
    const asked = await page.evaluate(() => UI.confirmOpen());
    for (let i = 0; i < 3; i++) await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    const held = await page.evaluate(() => ({ open: UI.confirmOpen(), tick: window.ACCESSION.state.tick }));
    if (!asked || !held.open || held.tick !== modal.tick) bad(`${tag}: a held Enter ${asked ? 'answered the confirmation it asked for' : 'did not ask'} (tick ${modal.tick} → ${held.tick})`);
    await page.keyboard.press('Escape');
  }
  await page.keyboard.press('Escape');
  // Enter does what a tap on the selected thing would do, and so nothing to an item you
  // carry: an item taken with two taps stays selected in your tote, and Enter leaves it there.
  const took = await page.evaluate(() => {
    const A = window.ACCESSION, s = A.state, me = s.actors[0], c = s.dept.clock;
    c.stage = 0; c.count = 0;
    for (const i of s.items) {
      if (i.where.at !== 'floor') continue;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const x = i.where.x + dx, y = i.where.y + dy, t = { x: i.where.x, y: i.where.y };
        if (!Grid.walkable(s.dept, x, y) || Actors.at(s, x, y) || !'.,'.includes(Grid.ch(s.dept, x, y))) continue;
        me.x = x; me.y = y; A.redraw(); A.tap(t); A.tap(t);
        if (i.where.at !== 'tote') return null;
        return { uid: i.uid, tick: s.tick, sel: A.vm().selection };
      }
    }
    return null;
  });
  if (!took) bad(`${tag}: no floor item to take with two taps`);
  else {
    await page.keyboard.press('Enter');
    const after = await page.evaluate(uid => ({ tick: window.ACCESSION.state.tick, at: window.ACCESSION.state.items.find(i => i.uid === uid).where.at }), took.uid);
    if (after.tick !== took.tick || after.at !== 'tote') bad(`${tag}: Enter with the item you just took selected (${took.sel}) did something to it (now ${after.at}, tick ${took.tick} → ${after.tick})`);
  }
  await page.keyboard.press('Escape');
  // The bell's banner in the strip, then the recap of a death (text 1.3).
  const bell = await page.evaluate(() => { const A = window.ACCESSION, c = A.state.dept.clock; c.stage = 0; c.count = c.B - 1; A.request({ a: 'wait' }); return !!document.querySelector('#strip .banner'); });
  if (!bell) bad(`${tag}: the bell rang with no banner in the strip`);
  await check('the bell\'s banner');
  // The night watch's announcement, the longest a stage makes (the Night Watchman comes in
  // near the entrance, since you stand on it), as the newest entry in a phone's strip at the
  // largest text: its banner runs on in the line, so it costs the strip less than a line more
  // than the same words plain (a banner in a box of its own cost up to 89 px here, taking
  // the board below 40% of the window's height). The board's height is printed.
  if (w < 900) {
    const nw = await page.evaluate(() => {
      const A = window.ACCESSION, s = A.state, c = s.dept.clock, me = s.actors[0], [x, y] = s.dept.entrance;
      for (const a of s.actors) if (a.uid !== 'you' && !a.gone) { a.mode = 'dormant'; a.telegraph = null; if (a.sp === 'night_watchman') a.gone = 1; }
      me.x = x; me.y = y; c.watch.k = 0; c.watch.back = null; c.stage = 1; c.count = c.B + c.G - 1; A.request({ a: 'wait' });
      const last = A.history[A.history.length - 1] || '', strip = document.getElementById('strip'), log = strip.querySelector('.log');
      const out = { banner: !!strip.querySelector('.log .line:last-child .banner'), near: /near the entrance/.test(last), len: last.length,
        board: document.getElementById('board').getBoundingClientRect().height, withBanner: strip.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(log).lineHeight) };
      UI.strip(null, [last], true, []);
      out.plain = strip.getBoundingClientRect().height;
      A.redraw();
      return out;
    });
    if (!nw.banner || !nw.near) bad(`${tag}: the night watch began without its banner, or not near the entrance (${nw.banner}, ${nw.near})`);
    else if (nw.withBanner - nw.plain >= nw.lh) bad(`${tag}: the night watch's banner makes the strip ${Math.round(nw.withBanner - nw.plain)} px taller than its words do plain`);
    lines.push(`${tag}: as the night watch begins (${nw.len} characters in the strip, text 1.3), the board is ${Math.round(nw.board)} px of ${h}; its banner adds ${Math.round(nw.withBanner - nw.plain)} px`);
    await check('the night watch\'s banner');
  }
  const died = await page.evaluate(() => {
    const A = window.ACCESSION, s = A.state, me = s.actors[0], a = s.actors.find(q => q.uid !== 'you' && !q.gone && q.arch === 'plodder');
    for (let d = 0; d < 8 && a; d++) { const x = me.x + Grid.DX[d], y = me.y + Grid.DY[d]; if (!Grid.walkable(s.dept, x, y) || Actors.at(s, x, y) || !Step.adjacent(s, me, { x, y, size: 1 })) continue; Object.assign(a, { x, y, mode: 'hunting', sawYou: true, acc: 40, next: me.next }); break; }
    me.hp = 1;
    for (let i = 0; i < 12 && !s.over; i++) A.request({ a: 'wait' });
    return !!s.over && UI.overlayOpen();
  });
  if (!died) bad(`${tag}: no recap after a staged death`);
  // For a screen reader, the recap is a dialog named by its title and described by its
  // sentences, as the confirmation is by its own.
  const named = await page.evaluate(() => {
    const said = (e, k) => { const t = document.getElementById(e.getAttribute(k) || ''); return t ? t.textContent.trim() : ''; };
    const end = document.getElementById('end'), c = document.getElementById('confirm');
    return { end: end.getAttribute('role') === 'dialog' && said(end, 'aria-labelledby') === 'You were defeated' && said(end, 'aria-describedby').length > 0,
      confirm: c.getAttribute('role') === 'dialog' && said(c, 'aria-labelledby').length > 0 && said(c, 'aria-describedby').length > 0 };
  });
  if (!named.end) bad(`${tag}: the recap is not a dialog named by its title and described by its sentences`);
  if (!named.confirm) bad(`${tag}: the confirmation is not a dialog named by its title and described by its sentences`);
  await check('the recap');
  // Enter (§7.1): on the recap it presses "Another visit"; on a confirmation, it confirms.
  const seed = await page.evaluate(() => window.ACCESSION.seed);
  await page.keyboard.press('Enter');
  const again = await page.evaluate(() => ({ over: window.ACCESSION.state.over, seed: window.ACCESSION.seed, open: UI.overlayOpen() }));
  if (again.over || again.open || again.seed !== seed + 1) bad(`${tag}: Enter on the recap did not start another visit`);
  const asked = await page.evaluate(() => { const A = window.ACCESSION, s = A.state, [x, y] = s.dept.exits[0]; s.actors[0].x = x; s.actors[0].y = y; A.redraw(); A.request({ a: 'leave', i: 0 }); return UI.confirmOpen(); });
  await page.keyboard.press('Enter');
  const left = await page.evaluate(() => window.ACCESSION.state.over && window.ACCESSION.state.over.k);
  if (!asked || left !== 'left') bad(`${tag}: Enter on the confirmation to leave did not leave (${left})`);
  await check('the end of a visit');
  lines.push(`${tag}: chips, your label, a case's label, two confirmations at ${seen} text sizes, the bell's banner, the recap and the end of a visit measured; Enter confirmed and started another visit`);
  if (errors.length) bad(`${tag}: console errors: ${errors.join('; ')}`);
  await browser.close();
}
for (const l of lines) console.log(l);
for (const p of problems) console.log('PROBLEM ' + p);
console.log(problems.length ? `screens: ${problems.length} problem(s)` : `screens: ${lines.length} measurements, both sizes and three narrow phones, every view, M3's chips, labels, confirmations, banner and recap, no problems`);
process.exit(problems.length ? 1 : 0);
