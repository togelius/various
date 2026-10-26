// ACCESSION — the left-click-only script (BUILD.md §7.1, §11 M2). At phone and laptop size,
// in every board view, with nothing but left mouse clicks on what is on screen: walk to a
// tile, approach an exhibit, examine it, read its label from close by, close the label,
// open "How the museum works" from the top bar and from Settings, zoom, switch "Walk" to
// tap twice and walk with two taps, and switch the board view from Settings. Then, staged:
// an exhibit whose label is open leaves your sight, and its label closes.
import { open } from './lib.mjs';
import { nextStep, labelVisible, logVisible, freeTile as freeTileIn } from './measure.mjs';

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
  // What would stop a walk: an exhibit appearing, moving or changing state, or a blow at you.
  const sights = () => page.evaluate(() => window.ACCESSION.vm().actors.map(a => a.uid === 'you' ? 'you' + a.hp : a.uid + a.mode + a.pips + '@' + a.x + ',' + a.y).join());
  const freeTile = () => page.evaluate(freeTileIn);
  // A walk reaches the tile clicked, unless something new came into sight or changed state,
  // or its last step had an event that stops a walk (§7.1: a blow or a miss, a wake, a door,
  // a refusal), such as a hunter beside you that missed.
  const stopped = () => page.evaluate(() => window.ACCESSION.events.some(e => window.ACCESSION.stops.includes(e.k)));
  const walkedTo = async (t, before, sightsBefore, tag) => {
    const after = await you(), changed = (await sights()) !== sightsBefore || await stopped();
    if (after.x === before.x && after.y === before.y) bad(`${tag}: clicking a tile did not walk`);
    else if ((after.x !== t.x || after.y !== t.y) && !changed) bad(`${tag}: the walk stopped at ${after.x},${after.y}, short of ${t.x},${t.y}, with nothing new in sight`);
    return after;
  };
  // Reduced motion so walks finish at once; chosen by clicks like everything else.
  await clickEl('#setbtn'); await clickEl('[data-set="motion"][data-value="reduce"]'); await clickEl('#settings [data-close]');

  const views = await page.evaluate(() => window.ACCESSION.views.list());
  for (const v of views) {
    const tag = `${W}×${Hh} ${v.label}`;
    // Each view starts from a fresh visit at the entrance, so each plays the same scene;
    // the settings chosen by clicks are kept.
    if (v !== views[0]) { await page.reload(); await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state); await settle(); }
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
    // The log shows what happened: on a laptop the last six sentences, the newest in view;
    // on a phone the newest sentence, whenever the action said something.
    await clickEl('[data-act="wait"]');
    if (W >= 900 && !await page.evaluate(logVisible)) bad(`${tag}: after Wait, the log is not on screen as it should be`);
    const wall = await page.evaluate(() => {
      const A = window.ACCESSION, vm = A.vm(), R = A.renderer;
      for (const d of R.inspect()) if (d.kind === 'tile' && vm.tiles[d.y][d.x] === '#') {
        const c = R.tileRect(d.x, d.y).centre, p = R.pick(c.x, c.y), e = document.elementFromPoint(c.x, c.y);
        if (p && p.x === d.x && p.y === d.y && e && e.closest('#board')) return c;
      }
      return null;
    });
    if (wall) {
      const n0 = await page.evaluate(() => window.ACCESSION.history.length);
      await click(wall.x, wall.y);
      const n1 = await page.evaluate(() => window.ACCESSION.history.length);
      if (n1 === n0 && n0 < 6) bad(`${tag}: clicking a wall added nothing to the log`);
      if (!await page.evaluate(logVisible)) bad(`${tag}: after clicking a wall, the newest sentence is not on screen`);
    }
    else bad(`${tag}: no wall tile on screen to click`);
    // In the laptop layout, the log box overflows with six long entries at the largest text
    // size, each taller than the box: the newest must still be in view from its first line.
    if (W >= 900 && v === views[0]) {
      const r = await page.evaluate(() => {
        document.documentElement.style.setProperty('--text-scale', '1.3');
        const long = i => `Entry ${i}. ` + 'The Lantern-Crop Wader hit you for 3 (rolled 59 against 85%; 4 − 1 Padding). '.repeat(4);
        const lines = [0, 1, 2, 3, 4, 5].map(long);
        UI.strip(null, lines, true);
        const l = document.querySelector('#strip .log'), last = l.lastElementChild, box = l.getBoundingClientRect(), top = last.getBoundingClientRect().top;
        const out = { over: l.scrollHeight > l.clientHeight, tall: last.getBoundingClientRect().height > l.clientHeight, inView: top >= box.top - 1 && top < box.bottom };
        document.documentElement.style.setProperty('--text-scale', '1');
        return out;
      });
      if (!r.over || !r.tall) bad(`${tag}: the long log entries did not overflow the log box, so its scrolling went untested`);
      if (!r.inView) bad(`${tag}: with the log full, the newest entry is not in view from its first line`);
      await clickEl('[data-act="wait"]');
    }
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
    // Beside the exhibit, with another exhibit's label open first if one is in sight: click
    // it, which opens its label and strikes nothing, then click it again, which strikes it
    // (§7.1). On a laptop the second click is on the same point, because opening the label
    // leaves the board where it was; on a phone the sheet can move the board, so the second
    // click is on the exhibit where it now is.
    for (let i = 0; i < 10; i++) {
      const st = await page.evaluate(nextStep, 1);
      if (st.done || st.stuck) break;
      await click(st.at.x, st.at.y);
    }
    await page.keyboard.press('Escape'); await settle();
    if (await page.evaluate(() => window.ACCESSION.vm().selection)) bad(`${tag}: Escape left an exhibit selected`);
    const pixel = uid => page.evaluate(uid => {
      const A = window.ACCESSION, a = Actors.byUid(A.state, uid), d = A.renderer.inspect().find(q => q.kind === 'actor' && q.id === uid);
      if (!d) return null;
      for (let j = 0; j < 9; j++) for (let i = 0; i < 9; i++) {
        const x = d.rect.x + d.rect.w * (0.1 + 0.1 * i), y = d.rect.y + d.rect.h * (0.1 + 0.1 * j), p = A.renderer.pick(x, y);
        if (p && p.x === a.x && p.y === a.y && document.elementFromPoint(x, y).closest('#board')) return { x, y };
      }
      return null;
    }, uid);
    const now = () => page.evaluate(uid => ({ hp: Actors.byUid(window.ACCESSION.state, uid).hp, turn: window.ACCESSION.state.turn, log: window.ACCESSION.history.slice(-1)[0] || '', shown: UI.labelShown(), sel: window.ACCESSION.vm().selection }), target);
    const beside = await page.evaluate(uid => Step.adjacent(window.ACCESSION.state, window.ACCESSION.state.actors[0], Actors.byUid(window.ACCESSION.state, uid)), target);
    const other = await page.evaluate(uid => (window.ACCESSION.vm().actors.find(a => a.uid !== 'you' && a.uid !== uid) || {}).uid || null, target);
    let first = null;
    if (other) {
      const o = await pixel(other);
      if (o) { await click(o.x, o.y); if (await page.evaluate(() => UI.labelShown()) !== other) bad(`${tag}: clicking ${other} did not open its label`); }
    }
    if (beside) first = await pixel(target);
    if (!beside || !first) bad(`${tag}: could not stand beside ${target} with a clickable pixel`);
    else {
      const b0 = await now();
      if (b0.sel === target) bad(`${tag}: ${target} is selected before the first click, so that click would strike at once`);
      await click(first.x, first.y);
      const b1 = await now();
      if (b1.shown !== target) bad(`${tag}: the first click on ${target} did not open its label`);
      if (b1.turn !== b0.turn || b1.hp !== b0.hp) bad(`${tag}: the first click on ${target} did more than open its label`);
      const laptop = await page.evaluate(() => UI.sheetCover() === 0);
      const second = laptop ? first : await pixel(target);
      if (!second) bad(`${tag}: with its label open, ${target} has no clickable pixel`);
      else {
        await click(second.x, second.y);
        const b2 = await now();
        if (b2.turn === b1.turn || (b2.hp === b1.hp && !/miss/i.test(b2.log))) bad(`${tag}: a second click${laptop ? ' on the same point' : ''} on ${target} did not strike it`);
        else lines.push(`${tag}: ${other ? `with ${other}'s label open, ` : ''}first click opened ${target}'s label, second${laptop ? ' on the same point' : ''} struck (${b1.hp} → ${b2.hp})`);
      }
      await page.keyboard.press('Escape'); await settle();
    }
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
    // Walk: tap twice, with a label open. The first tap previews and leaves the board still;
    // the second, on the same point, goes.
    await clickEl('#setbtn'); await clickEl('[data-set="walk"][data-value="two"]'); await clickEl('#settings [data-close]');
    await page.evaluate(() => { const A = window.ACCESSION, a = A.vm().actors.find(q => q.uid !== 'you'); if (a) A.tap({ x: a.x, y: a.y }); });
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
    // A label shows only what sight gives (§7.2, §8.8): with an exhibit's label open, the
    // exhibit is moved (staged on the page) to a tile out of your sight, far from you, and its
    // health is changed; then you wait a turn with the '.' key (on a phone the open sheet
    // covers the bar's Wait). The label must close and the selection go, rather than show
    // what you cannot see.
    const staged = await page.evaluate(() => {
      const A = window.ACCESSION, s = A.state, me = s.actors[0], vm = A.vm(), seen = vm.actors.find(q => q.uid !== 'you' && q.size === 1);
      if (!seen) return { why: 'no exhibit in sight' };
      A.tap({ x: seen.x, y: seen.y });
      if (UI.labelShown() !== seen.uid) return { why: `tapping ${seen.uid} did not open its label` };
      const a = Actors.byUid(s, seen.uid);
      for (let y = 0; y < s.dept.h; y++) for (let x = 0; x < s.dept.w; x++) {
        if (vm.vis[y * vm.w + x] === 2 || Math.max(Math.abs(x - me.x), Math.abs(y - me.y)) < 8 || !Grid.walkable(s.dept, x, y, 'exhibit') || Actors.at(s, x, y)) continue;
        a.x = x; a.y = y; a.mode = 'dormant'; a.pips = 0; a.hp = Math.max(1, a.hp - 1);
        return { uid: a.uid, hp: a.hp + '/' + a.maxHp, turn: s.turn };
      }
      return { why: 'no tile out of sight to move it to' };
    });
    if (staged.why) bad(`${tag}: could not stage an exhibit leaving sight: ${staged.why}`);
    else {
      await page.keyboard.press('.'); await settle();
      const after = await page.evaluate(uid => ({ shown: UI.labelShown(), sel: window.ACCESSION.vm().selection, inView: window.ACCESSION.vm().actors.some(q => q.uid === uid), sheet: document.getElementById('sheet').textContent, turn: window.ACCESSION.state.turn }), staged.uid);
      if (after.turn === staged.turn) bad(`${tag}: with ${staged.uid}'s label open, '.' did not wait`);
      else if (after.inView) bad(`${tag}: the staged exhibit ${staged.uid} is still in view`);
      else if (after.shown === staged.uid || after.sel === staged.uid) bad(`${tag}: ${staged.uid} left your sight, but its label is still ${after.shown === staged.uid ? 'open' : 'selected'}${after.sheet.includes(staged.hp) ? `, showing its health ${staged.hp}` : ''}`);
      else lines.push(`${tag}: an exhibit that left your sight took its label with it`);
    }
    lines.push(`${tag}: label closed, how-it-works from the top bar and from Settings, zoom stepped, two-tap walk done`);
  }
  await browser.close();
  if (errors.length) bad(`${W}×${Hh}: console errors: ${errors.join('; ')}`);
}
for (const l of lines) console.log(l);
for (const p of problems) console.log('PROBLEM ' + p);
console.log(problems.length ? `play: ${problems.length} problem(s)` : `play: left clicks only, phone and laptop, every view: walked, examined, read, zoomed, two-tap walk, no problems`);
process.exit(problems.length ? 1 : 0);
