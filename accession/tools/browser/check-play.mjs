// ACCESSION — the left-click-only script (BUILD.md §7.1, §11 M2, M3). At phone and laptop
// size, in every board view, with nothing but left mouse clicks on what is on screen: walk to
// a tile, approach an exhibit, examine it, read its label from close by, close the label,
// open "How the museum works" from the top bar and from Settings, zoom, switch "Walk" to tap
// twice and walk with two taps, and switch the board view from Settings. Then, staged: an
// exhibit whose label is open leaves your sight, and its label closes; and a step that is
// refused and takes no time leaves the last action's noise rings as they were.
// Then M3's verbs (playM3, at the end of this file): select and read a case, open one,
// break one through the confirmation, step onto shards through theirs, step off a beam, sit
// and rest, take an item, read a plaque, walk until a status of yours ends and until the
// bell rings (its banner in the strip), die and press "Another visit", leave and press it
// again; a status shown in the top bar; and no sideways scroll or target under 44 px.
import { open } from './lib.mjs';
import { nextStep, labelVisible, logVisible, freeTile as freeTileIn, layout, targets } from './measure.mjs';

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
    // The noise rings and one-turn cues are those of your last action that took time (§6.1,
    // §8.2): staged on the page, you stand beside a shut case and break at its glass (a loud
    // noise, its rings drawn), then press the key for a step into a wall or a case, which is
    // refused and takes no time: the rings stay as they were. A wait then takes time and
    // its own events replace them.
    const noisy = await page.evaluate(() => {
      const A = window.ACCESSION, s = A.state, ring = () => JSON.stringify(A.vm().marks.filter(q => q.kind === 'noise'));
      UI.closeLabel();
      for (const f of s.dept.fixtures) {
        if (f.k !== 'case' || f.st !== 'shut') continue;
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          const x = f.x + dx, y = f.y + dy;
          if (!Grid.walkable(s.dept, x, y) || Grid.ch(s.dept, x, y) === 'v' || Actors.at(s, x, y)) continue;
          s.actors[0].x = x; s.actors[0].y = y;
          if (!Labels.allowed(s, { a: 'bash', x: f.x, y: f.y })) continue;
          A.act({ a: 'bash', x: f.x, y: f.y });
          if (!A.events.some(e => e.k === 'noise')) return { why: 'breaking at the glass made no noise' };
          for (let d = 0; d < 8; d++) {
            const t = State.clone(s), ev = Step.step(t, { a: 'move', dir: d });
            if (ev.length === 1 && ev[0].k === 'refused' && t.tick === s.tick) return { rings: ring(), d, tick: s.tick };
          }
          return { why: 'no step beside the case is refused' };
        }
      }
      return { why: 'no shut case to stand beside' };
    });
    if (noisy.why) bad(`${tag}: could not stage a noise: ${noisy.why}`);
    else if (noisy.rings === '[]') bad(`${tag}: breaking at the glass drew no noise rings`);
    else {
      await page.keyboard.press(['k', 'u', 'l', 'n', 'j', 'b', 'h', 'y'][noisy.d]); await settle();
      const after = await page.evaluate(() => ({ rings: JSON.stringify(window.ACCESSION.vm().marks.filter(q => q.kind === 'noise')), tick: window.ACCESSION.state.tick, last: window.ACCESSION.events.map(e => e.k + (e.reason ? ':' + e.reason : '')) }));
      if (after.tick !== noisy.tick || !after.last.length || !after.last[0].startsWith('refused')) bad(`${tag}: the step into the wall was not a refusal that took no time: ${after.last.join()}`);
      else if (after.rings !== noisy.rings) bad(`${tag}: a refused step that took no time ${after.rings === '[]' ? 'wiped' : 'changed'} the noise rings of the last action`);
      else {
        await page.keyboard.press('.'); await settle();
        const waited = await page.evaluate(() => { const A = window.ACCESSION; return { tick: A.state.tick, rings: JSON.stringify(A.vm().marks.filter(q => q.kind === 'noise')), own: JSON.stringify(ViewModel.derive(A.state, { events: A.events }).marks.filter(q => q.kind === 'noise')) }; });
        if (waited.tick === noisy.tick) bad(`${tag}: '.' did not wait`);
        else if (waited.rings !== waited.own) bad(`${tag}: after a wait the noise rings are not the wait's own`);
        else lines.push(`${tag}: a refused step kept the last action's noise rings; a wait replaced them`);
      }
    }
    lines.push(`${tag}: label closed, how-it-works from the top bar and from Settings, zoom stepped, two-tap walk done`);
  }
  await browser.close();
  if (errors.length) bad(`${W}×${Hh}: console errors: ${errors.join('; ')}`);
}
await playM3(SIZES, lines, bad);
for (const l of lines) console.log(l);
for (const p of problems) console.log('PROBLEM ' + p);
console.log(problems.length ? `play: ${problems.length} problem(s)` : `play: left clicks only, phone and laptop, every view: walked, examined, read, zoomed, two-tap walk; cases read, opened and broken, shards, a beam stepped off, sat and rested, an item taken, a plaque read, walks stopped by a status and the bell, a death and a leaving each followed by another visit; no problems`);
process.exit(problems.length ? 1 : 0);

// ---- M3's verbs (BUILD.md §7.1, §8.1, §8.3, §8.4) ----
// In M.11 (seed 3, which has an axis_sniper, benches, a plaque and floor items), at both
// sizes and in every view. Each scene is staged on window.ACCESSION.state, as check-3d stages
// its frames: you are placed beside what the scene needs and the exhibits are put back to
// sleep where they stand (a case's lock, a sleeper's place or a clock's count is set where
// the scene needs it). Everything the player then does is a left click on what is on screen:
// a tile, a thing on it, yourself, a label's button, the confirmation's buttons, the bar's
// Wait, "Another visit".

// The centre of the first element matching sel that a player can see and click: displayed,
// inside every box that clips it, on screen, and the topmost thing there. Else null.
function seenAt(sel) {
  for (const e of document.querySelectorAll(sel)) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    let ok = true;
    for (let p = e; p && p !== document.documentElement && ok; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) ok = false;
      else if (p !== e && cs.overflow !== 'visible') { const q = p.getBoundingClientRect(); if (r.bottom <= q.top || r.top >= q.bottom || r.right <= q.left || r.left >= q.right) ok = false; }
    }
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (!ok || x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
    const top = document.elementFromPoint(x, y);
    if (top && (top === e || e.contains(top))) return { x, y, w: r.width, h: r.height, text: e.textContent.trim() };
  }
  return null;
}

// A point a player can click to tap tile (x, y), or the actor uid: inside its square, in
// the part of the board no sheet covers, the board the topmost thing there, and the view's
// pick giving that tile (an actor's: its anchor tile). Else null.
function spotOf(q) {
  const A = window.ACCESSION, R = A.renderer, b = document.getElementById('board').getBoundingClientRect(), clear = b.bottom - UI.sheetCover();
  let rect = null, x = q.x, y = q.y;
  if (q.uid) {
    const a = Actors.byUid(A.state, q.uid), d = R.inspect().find(k => k.kind === 'actor' && k.id === q.uid);
    if (!a || !d) return null;
    rect = d.rect; x = a.x; y = a.y;
  } else rect = R.tileRect(x, y).rect;
  const at = [0.5, 0.35, 0.65, 0.2, 0.8, 0.12, 0.88];
  for (const fy of at) for (const fx of at) {
    const px = rect.x + rect.w * fx, py = rect.y + rect.h * fy;
    if (px < b.left + 1 || py < b.top + 1 || px >= b.right - 1 || py >= clear - 1) continue;
    const e = document.elementFromPoint(px, py), p = R.pick(px, py);
    if (e && e.closest('#board') && p && p.x === x && p.y === y) return { x: px, y: py };
  }
  return null;
}

// The staging helpers, put on the page after each load.
function helpers() {
  const S = () => window.ACCESSION.state;
  const free = (x, y) => { const s = S(); return Grid.walkable(s.dept, x, y) && '.,'.includes(Grid.ch(s.dept, x, y)) && !Actors.at(s, x, y) && !(s.items || []).some(i => i.where.at === 'floor' && i.where.x === x && i.where.y === y); };
  window.__m3 = {
    free,
    // Every exhibit asleep where it stands, with no mark pending.
    calm() { const s = S(); for (const a of s.actors) if (a.uid !== 'you' && !a.gone) { a.mode = 'dormant'; a.pips = 0; a.telegraph = null; a.notBefore = null; a.stim = s.turn; } },
    put(x, y) { const me = S().actors[0]; me.x = x; me.y = y; me.seated = false; },
    // A free floor tile beside (x, y), a step in one of the four main directions away.
    beside(x, y) { for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (free(x + dx, y + dy)) return [x + dx, y + dy]; return null; },
    // A straight lane of n + 1 free floor tiles, from none of which an exhibit is in sight,
    // so a walk along it stops only for what a scene stages: you are put at its start, and
    // its far end is returned.
    lane(n) {
      const s = S(), m = s.dept, me = s.actors[0], alone = () => ViewModel.derive(s, {}).actors.length === 1;
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) for (let d = 0; d < 8; d += 2) {
        const at = k => [x + Grid.DX[d] * k, y + Grid.DY[d] * k];
        let ok = true;
        for (let k = 0; k <= n && ok; k++) { const [p, q] = at(k); ok = free(p, q) && (me.x = p, me.y = q, alone()); }
        if (ok) { const [p, q] = at(0); me.x = p; me.y = q; me.seated = false; return at(n); }
      }
      return null;
    },
  };
}

async function playM3(sizes, lines, bad) {
  for (const [W, Hh] of sizes) {
    const { browser, page, errors } = await open('dist/accession.html', { viewport: { width: W, height: Hh }, dpr: 1, query: '?dept=M11&seed=3' });
    const ready = async () => { await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state); await page.evaluate(helpers); };
    await ready();
    const settle = () => page.waitForFunction(() => !window.ACCESSION.busy() && document.querySelectorAll('#board canvas').length > 0);
    const click = async (x, y) => { await page.mouse.click(x, y, { button: 'left' }); await settle(); };
    // Click an element a player can see, or say why not.
    const press = async (sel, tag, what) => { const p = await page.evaluate(seenAt, sel); if (!p) { bad(`${tag}: ${what} is not on screen to click (${sel})`); return null; } await click(p.x, p.y); return p; };
    const tapAt = async (q, tag, what) => { const p = await page.evaluate(spotOf, q); if (!p) { bad(`${tag}: ${what} has no point on the board to click`); return false; } await click(p.x, p.y); return true; };
    const sized = async (tag) => { for (const p of [...await page.evaluate(layout), ...await page.evaluate(targets)]) bad(`${tag}: ${p}`); };
    const closeLabel = async () => { if (await page.evaluate(() => !!UI.labelShown())) await press('#sheet [data-close]', 'closing the label', 'Close'); };
    const now = () => page.evaluate(() => { const A = window.ACCESSION, me = A.state.actors[0]; return { x: me.x, y: me.y, hp: me.hp, maxHp: me.maxHp, tick: A.state.tick, turn: A.state.turn, seated: !!me.seated, over: A.state.over ? A.state.over.k : null, ev: A.events.map(e => e.k), asking: !!A.asking, seed: A.seed }; });
    const confirmShown = () => page.evaluate(seenAt, '#confirm.open .yes');
    // Click through Settings: reduced motion, so walks and rests finish at once.
    await press('#setbtn', `${W}×${Hh}`, 'Settings'); await press('[data-set="motion"][data-value="reduce"]', `${W}×${Hh}`, 'Reduced motion'); await press('#settings [data-close]', `${W}×${Hh}`, 'Close');
    const views = await page.evaluate(() => window.ACCESSION.views.list());
    for (const v of views) {
      const tag = `${W}×${Hh} ${v.label} M3`;
      if (v !== views[0]) { await page.reload(); await ready(); await settle(); }
      await press('#setbtn', tag, 'Settings');
      if (views.length > 1) await press(`[data-set="board"][data-value="${v.id}"]`, tag, `the ${v.label} board`);
      await press('#settings [data-close]', tag, 'Close');
      await page.evaluate(() => window.ACCESSION.renderer.ready.catch(() => {}));
      const active = await page.evaluate(() => window.ACCESSION.views.active());
      if (active.id !== v.id) { bad(`${tag}: fell back (${active.note})`); continue; }
      const did = [];

      // A status in the top bar (§7.2): its pictogram, with the turns it still covers.
      const left = await page.evaluate(() => { const A = window.ACCESSION, s = A.state, me = s.actors[0]; Status.apply(s, me, 'dazed', 3, { k: 'status', id: 'dazed' }, []); Status.settle(s); A.redraw(); return Status.left(s, me, 'dazed'); });
      const chip = await page.evaluate(seenAt, '#top #statuses [data-status="dazed"]');
      if (!chip) bad(`${tag}: with dazed on you, the top bar shows no dazed pictogram`);
      else if (!chip.text.startsWith(String(left))) bad(`${tag}: the dazed pictogram says "${chip.text}", not its ${left} turns`);
      else did.push('status shown');
      const stageText = await page.evaluate(() => { const e = document.querySelector('#stage span'); return e ? e.textContent : ''; });
      const toBell = await page.evaluate(() => window.ACCESSION.vm().clock.toBell);
      if (stageText !== `Open: bell in ${toBell} turns`) bad(`${tag}: the stage chip says "${stageText}"`);
      const dialSays = await page.evaluate(() => document.getElementById('dial').getAttribute('aria-label') === Text.clock(window.ACCESSION.vm().clock));
      if (!dialSays) bad(`${tag}: the dial's label is not Text.clock's sentence`);
      await sized(`${tag} status in the top bar`);

      // A case: select it and read its label; a second click opens it.
      const ca = await page.evaluate(() => {
        const A = window.ACCESSION, s = A.state, M = window.__m3; M.calm();
        for (const f of s.dept.fixtures) {
          if (f.k !== 'case' || f.st !== 'shut' || f.mimic || !f.num) continue;
          const t = M.beside(f.x, f.y);
          if (!t) continue;
          M.put(t[0], t[1]); f.lock = Math.min(f.lock, s.run.grade); A.redraw();
          return { x: f.x, y: f.y, id: `case:${f.x},${f.y}`, title: Labels.of(s, `case:${f.x},${f.y}`).title };
        }
        return null;
      });
      if (!ca) bad(`${tag}: no shut case with a free tile beside it`);
      else if (await tapAt(ca, tag, `the case at ${ca.x},${ca.y}`)) {
        const t0 = await now();
        if (!await page.evaluate(labelVisible, ca.title)) bad(`${tag}: clicking the case did not show its label "${ca.title}"`);
        else if (!(await page.evaluate(() => document.querySelector('#sheet .odds').textContent)).includes('opens its lock')) bad(`${tag}: the case's label does not say your grade opens it`);
        else did.push('case read');
        await sized(`${tag} case label open`);
        if (t0.turn !== (await now()).turn) bad(`${tag}: reading the case took time`);
        if (await tapAt(ca, tag, 'the selected case')) {
          const t1 = await now();
          if (!t1.ev.includes('case_opened') || await page.evaluate(c => Grid.ch(window.ACCESSION.state.dept, c.x, c.y), ca) !== 'u') bad(`${tag}: a second click on the case did not open it (${t1.ev.join()})`);
          else did.push('case opened');
        }
      }

      // Another, which your grade cannot open: a second click asks to break it (D3.12); Cancel
      // does nothing; Strike the glass breaks at it, until it breaks.
      await closeLabel();
      const cb = await page.evaluate(() => {
        const A = window.ACCESSION, s = A.state, M = window.__m3; M.calm();
        const cases = s.dept.fixtures.filter(f => f.k === 'case' && f.st === 'shut' && !f.mimic && f.num).sort((p, q) => p.glass - q.glass);
        for (const f of cases) {
          const t = M.beside(f.x, f.y);
          if (!t) continue;
          M.put(t[0], t[1]); f.lock = Math.max(f.lock, s.run.grade + 1); A.redraw();
          if (!Labels.allowed(s, { a: 'bash', x: f.x, y: f.y })) continue;
          return { x: f.x, y: f.y };
        }
        return null;
      });
      if (!cb) bad(`${tag}: no case to break with a free tile beside it`);
      else if (await tapAt(cb, tag, 'the case to break') && await tapAt(cb, tag, 'the selected case')) {
        const c = await confirmShown(), t0 = await now();
        if (!c) bad(`${tag}: a second click on a case you cannot open did not ask to break it`);
        else {
          await sized(`${tag} confirmation open`);
          if (c.h < 44 || c.w < 44) bad(`${tag}: the confirmation's button is ${Math.round(c.w)}×${Math.round(c.h)}`);
          await press('#confirm.open [data-confirm="no"]', tag, 'Cancel');
          const t1 = await now();
          if (t1.tick !== t0.tick || t1.asking || await confirmShown()) bad(`${tag}: Cancel did not leave the case alone`);
          let broke = false;
          for (let i = 0; i < 4 && !broke; i++) {
            if (i === 0) await tapAt(cb, tag, 'the selected case'); else await press('#sheet [data-label-act="bash"]', tag, 'Break the glass');
            if (!await confirmShown()) { bad(`${tag}: breaking at the glass did not ask first`); break; }
            await press('#confirm.open .yes', tag, 'Strike the glass');
            const t2 = await now();
            if (!t2.ev.includes('glass_cracked') && !t2.ev.includes('glass_broke')) { bad(`${tag}: striking the glass did nothing (${t2.ev.join()})`); break; }
            broke = t2.ev.includes('glass_broke');
          }
          if (broke) did.push('case broken through the confirmation');
        }
      }

      // Shards: stepping onto them from a tile without them asks first.
      await closeLabel();
      const sh = await page.evaluate(() => {
        const A = window.ACCESSION, s = A.state, M = window.__m3, m = s.dept, me = s.actors[0]; M.calm();
        // Off the shards first, if the break left you on them.
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const x = me.x + dx, y = me.y + dy;
          if (!M.free(x, y)) continue;
          for (const [ex, ey] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const sx = x + ex, sy = y + ey;
            if (Grid.ch(m, sx, sy) === 'x' && !Actors.at(s, sx, sy, me)) { M.put(x, y); A.redraw(); return { x: sx, y: sy }; }
          }
        }
        // Else shards are laid beside you (a staged tile), if you stand on none.
        const t = M.beside(me.x, me.y);
        if (!t || Grid.ch(m, me.x, me.y) === 'x') return null;
        Grid.set(m, t[0], t[1], 'x'); A.redraw();
        return { x: t[0], y: t[1] };
      });
      if (!sh) bad(`${tag}: no tile for shards beside you`);
      else if (await tapAt(sh, tag, 'the shards')) {
        const c = await confirmShown();
        if (!c || !/shards/i.test(await page.evaluate(() => document.querySelector('#confirm h2').textContent))) bad(`${tag}: stepping onto shards did not ask first `);
        else {
          await press('#confirm.open .yes', tag, 'Step onto the shards');
          const t1 = await now();
          if (t1.x !== sh.x || t1.y !== sh.y) bad(`${tag}: confirming did not step onto the shards`);
          else did.push('stepped onto shards through the confirmation');
        }
      }

      // A beam marked through your tile: waiting there, or stepping along it, asks first
      // (Specials.threat); Cancel does nothing; a step off it is taken at once, and the beam
      // goes off without touching you.
      await closeLabel();
      const bm = await page.evaluate(() => {
        const A = window.ACCESSION, s = A.state, M = window.__m3, me = s.actors[0]; M.calm();
        const sn = s.actors.find(a => a.arch === 'axis_sniper' && !a.gone);
        if (!sn) return { why: 'no axis_sniper in this department' };
        for (const d of [6, 2, 0, 4]) for (let r = 3; r <= 6; r++) {
          const x = sn.x + Grid.DX[d] * r, y = sn.y + Grid.DY[d] * r;
          if (!M.free(x, y)) continue;
          M.put(x, y);
          Object.assign(sn, { mode: 'hunting', sawYou: true, lastKnown: [x, y], stim: s.turn, telegraph: null });
          const tiles = Specials.tiles(s, sn, 'line'), on = (tx, ty) => tiles.some(([p, q]) => p === tx && q === ty);
          if (!on(x, y) || !Specials.canMark(s, sn, 'line', tiles)) continue;
          const near = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => [x + dx, y + dy]);
          const off = near.find(([p, q]) => M.free(p, q) && !on(p, q)), along = near.find(([p, q]) => M.free(p, q) && on(p, q));
          if (!off || !along) continue;
          sn.next = me.next;
          Specials.mark(s, sn, 'line', tiles, []);
          A.redraw();
          return { sn: sn.uid, x, y, off, along, dmg: A.vm().marks.find(k => k.kind === 'telegraph' && k.x === x && k.y === y).dmg };
        }
        sn.mode = 'dormant';
        return { why: 'no tile in the sniper’s line to stand on' };
      });
      if (bm.why) bad(`${tag}: could not stage a beam: ${bm.why}`);
      else {
        const t0 = await now();
        await press('#bar [data-act="wait"]', tag, 'Wait');
        const c = await confirmShown(), why = await page.evaluate(() => document.querySelector('#confirm .why').textContent);
        if (!c || !why.includes(`deal you ${bm.dmg}`)) bad(`${tag}: waiting on the beam's tile did not ask first, with its damage ${bm.dmg} (${why})`);
        else await press('#confirm.open [data-confirm="no"]', tag, 'Cancel');
        if ((await now()).tick !== t0.tick) bad(`${tag}: cancelling the wait on the beam still took time`);
        await tapAt({ x: bm.along[0], y: bm.along[1] }, tag, 'a tile along the beam');
        if (!await confirmShown()) bad(`${tag}: stepping along the beam did not ask first`);
        else await press('#confirm.open [data-confirm="no"]', tag, 'Cancel');
        const t1 = await now();
        if (t1.tick !== t0.tick || t1.x !== bm.x || t1.y !== bm.y) bad(`${tag}: cancelling the step along the beam still moved you`);
        await tapAt({ x: bm.off[0], y: bm.off[1] }, tag, 'a tile off the beam');
        const t2 = await now(), hit = await page.evaluate(() => window.ACCESSION.events.some(e => e.k === 'damaged' && e.who === 'you'));
        const went = await page.evaluate(uid => window.ACCESSION.events.some(e => e.k === 'special' && e.who === uid && !e.cancelled), bm.sn);
        if (await confirmShown()) bad(`${tag}: stepping off the beam asked first`);
        else if (t2.x !== bm.off[0] || t2.y !== bm.off[1]) bad(`${tag}: clicking a tile off the beam did not step off it`);
        else if (!went || hit || t2.hp !== t0.hp) bad(`${tag}: after stepping off, the beam ${went ? 'went off' : 'did not go off'} and you ${hit ? 'were' : 'were not'} hit`);
        else did.push('stepped off a beam, which missed you');
      }

      // Sit on a bench, then rest: Rest repeats until you are at full health.
      await closeLabel();
      const bench = await page.evaluate(() => {
        const A = window.ACCESSION, s = A.state, M = window.__m3, m = s.dept, me = s.actors[0]; M.calm();
        for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (Grid.ch(m, x, y) === 'b' && !Actors.at(s, x, y)) {
          M.put(x, y); me.hp = me.maxHp - 1; A.redraw(); return { x, y };
        }
        return null;
      });
      if (!bench) bad(`${tag}: no bench`);
      else if (await tapAt({ uid: 'you' }, tag, 'you')) {
        if (!await page.evaluate(labelVisible, 'You')) bad(`${tag}: clicking yourself did not show your label`);
        await sized(`${tag} your label open`);
        await press('#sheet [data-label-act="sit"]', tag, 'Sit on the bench');
        const t1 = await now();
        if (!t1.seated) bad(`${tag}: Sit did not seat you`);
        else did.push('sat');
        if (await press('#sheet [data-label-act="rest"]', tag, 'Rest')) {
          const t2 = await now(), why = await page.evaluate(() => window.ACCESSION.stopWhy);
          if (t2.hp !== t2.maxHp || why !== 'rested') bad(`${tag}: Rest stopped at ${t2.hp}/${t2.maxHp} (${why})`);
          else if (t2.turn - t1.turn < 2) bad(`${tag}: Rest did not repeat`);
          else if (!t2.seated) bad(`${tag}: resting got you up from the bench`);
          else did.push(`rested ${t2.turn - t1.turn} turns to full health`);
        }
      }

      // Take an item: a click shows its label, a second click takes it.
      await closeLabel();
      const it = await page.evaluate(() => {
        const A = window.ACCESSION, s = A.state, M = window.__m3; M.calm();
        for (const i of s.items) {
          if (i.where.at !== 'floor') continue;
          const t = M.beside(i.where.x, i.where.y);
          if (!t) continue;
          M.put(t[0], t[1]); A.redraw();
          return { uid: i.uid, x: i.where.x, y: i.where.y, title: Labels.ofItem(s, i.uid).title };
        }
        return null;
      });
      if (!it) bad(`${tag}: no floor item with a free tile beside it`);
      else if (await tapAt({ x: it.x, y: it.y }, tag, 'the item')) {
        if (!await page.evaluate(labelVisible, it.title)) bad(`${tag}: clicking the item did not show its label "${it.title}"`);
        if (await tapAt({ x: it.x, y: it.y }, tag, 'the selected item')) {
          const where = await page.evaluate(uid => window.ACCESSION.state.items.find(i => i.uid === uid).where.at, it.uid);
          if (where !== 'tote' || !(await now()).ev.includes('took')) bad(`${tag}: a second click on the item did not take it (${where})`);
          else did.push('item taken');
        }
      }

      // Read a plaque: its label's Read button identifies the kind it describes.
      await closeLabel();
      const pl = await page.evaluate(() => {
        const A = window.ACCESSION, s = A.state, M = window.__m3; M.calm();
        for (const f of s.dept.fixtures) {
          if (f.k !== 'plaque' || Consumables.known(s, f.ck)) continue;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
            if (!M.free(f.x + dx, f.y + dy)) continue;
            M.put(f.x + dx, f.y + dy);
            if (!Labels.allowed(s, { a: 'read', x: f.x, y: f.y })) continue;
            A.redraw();
            return { x: f.x, y: f.y };
          }
        }
        return null;
      });
      if (!pl) bad(`${tag}: no plaque to read`);
      else if (await tapAt(pl, tag, 'the plaque')) {
        if (!await page.evaluate(labelVisible, 'An identifying label')) bad(`${tag}: clicking the plaque did not show its label`);
        else if (await press('#sheet [data-label-act="read"]', tag, 'Read the label')) {
          const title = await page.evaluate(() => document.querySelector('#sheet .label h2').textContent);
          if (!(await now()).ev.includes('identified') || !title.includes(':')) bad(`${tag}: Read did not identify the plaque's kind ("${title}")`);
          else did.push('plaque read');
        }
      }

      // A walk stops when a status of yours ends (§7.1): with one turn of dazed left, a click
      // four tiles away takes one step.
      await closeLabel();
      const ln = await page.evaluate(() => {
        const A = window.ACCESSION, s = A.state, M = window.__m3, me = s.actors[0]; M.calm();
        const end = M.lane(4);
        if (!end) return null;
        Status.apply(s, me, 'dazed', 1, { k: 'status', id: 'dazed' }, []); Status.settle(s); A.redraw();
        return { from: [me.x, me.y], to: end };
      });
      if (!ln) bad(`${tag}: no lane of free tiles out of every exhibit's sight`);
      else if (await tapAt({ x: ln.to[0], y: ln.to[1] }, tag, 'the end of the lane')) {
        const t1 = await now(), why = await page.evaluate(() => window.ACCESSION.stopWhy), steps = Math.max(Math.abs(t1.x - ln.from[0]), Math.abs(t1.y - ln.from[1]));
        if (why !== 'status' || steps !== 1) bad(`${tag}: as dazed ended, the walk went ${steps} steps and stopped for ${why}`);
        else did.push('a walk stopped as a status ended');
      }

      // The bell: a walk stops at it (§7.1), its announcement is a banner in the strip, and
      // the stage chip moves on. The clock is set two turns short of it.
      await closeLabel();
      const bl = await page.evaluate(() => {
        const A = window.ACCESSION, s = A.state, M = window.__m3, me = s.actors[0], c = s.dept.clock; M.calm();
        const end = M.lane(4);
        if (!end) return null;
        c.count = c.B - 2; A.redraw();
        return { from: [me.x, me.y], to: end };
      });
      if (!bl) bad(`${tag}: no lane for the bell's walk`);
      else if (await tapAt({ x: bl.to[0], y: bl.to[1] }, tag, 'the end of the lane')) {
        const t1 = await now(), why = await page.evaluate(() => window.ACCESSION.stopWhy), steps = Math.max(Math.abs(t1.x - bl.from[0]), Math.abs(t1.y - bl.from[1]));
        const banner = await page.evaluate(seenAt, '#strip .banner');
        const said = await page.evaluate(() => { const e = window.ACCESSION.events.find(q => q.k === 'stage'); return e ? Text.event(e, Labels.nameOf(window.ACCESSION.state)) : null; });
        const chip2 = await page.evaluate(() => document.querySelector('#stage span').textContent);
        if (why !== 'stage' || steps !== 2) bad(`${tag}: at the bell the walk went ${steps} steps and stopped for ${why}`);
        else if (!said || !banner || banner.text !== said) bad(`${tag}: at the bell the strip shows no banner with "${said}" (${banner ? banner.text : 'none'})`);
        else if (!chip2.startsWith('After the bell: night watch in')) bad(`${tag}: after the bell the stage chip says "${chip2}"`);
        else did.push('a walk stopped at the bell, with its banner');
      }

      // A death: the recap, then "Another visit".
      const dz = await page.evaluate(() => {
        const A = window.ACCESSION, s = A.state, M = window.__m3, me = s.actors[0]; M.calm();
        const a = s.actors.find(q => q.arch === 'plodder' && !q.gone && q.uid !== 'you');
        const t = a && M.beside(me.x, me.y);
        if (!t) return null;
        Object.assign(a, { x: t[0], y: t[1], mode: 'hunting', sawYou: true, lastKnown: [me.x, me.y], stim: s.turn, acc: 40, next: me.next });
        me.hp = 1; A.redraw();
        return a.uid;
      });
      if (!dz) bad(`${tag}: no plodder to stage a death with`);
      else {
        for (let i = 0; i < 12 && !(await now()).over; i++) await press('#bar [data-act="wait"]', tag, 'Wait');
        const t1 = await now();
        if (t1.over !== 'died') bad(`${tag}: twelve waits beside a hunter at 1 health did not end in a death`);
        else {
          const recap = await page.evaluate(() => { const A = window.ACCESSION, r = Text.recap(A.state, Labels.nameOf(A.state)); return { want: r ? r.lines : [], shown: [...document.querySelectorAll('#end.open .recap p')].map(p => p.textContent) }; });
          if (!await page.evaluate(seenAt, '#end.open h2') || !recap.want.length || JSON.stringify(recap.want) !== JSON.stringify(recap.shown)) bad(`${tag}: the recap overlay does not show Text.recap's lines (${recap.shown.join(' | ')})`);
          await sized(`${tag} recap open`);
          await press('#end.open [data-another]', tag, 'Another visit');
          const t2 = await now();
          if (t2.over || t2.turn !== 0 || t2.seed !== t1.seed + 1 || await page.evaluate(() => document.getElementById('end').classList.contains('open'))) bad(`${tag}: "Another visit" did not start a new visit`);
          else did.push('died, recap shown, another visit');
        }
      }

      // Leaving: on an exit, your label offers Leave; it asks, then the visit ends with its
      // sentence, and "Another visit" starts the next.
      await page.evaluate(() => { const A = window.ACCESSION, s = A.state, [x, y] = s.dept.exits[0]; window.__m3.calm(); window.__m3.put(x, y); A.redraw(); });
      if (await tapAt({ uid: 'you' }, tag, 'you on the exit') && await press('#sheet [data-label-act="leave"]', tag, 'Leave by this door')) {
        if (!await confirmShown()) bad(`${tag}: Leave did not ask first`);
        else {
          await press('#confirm.open .yes', tag, 'Leave');
          const t1 = await now(), shown = await page.evaluate(() => [...document.querySelectorAll('#end.open .recap p')].map(p => p.textContent).join(' '));
          const want = await page.evaluate(() => { const e = window.ACCESSION.events.find(q => q.k === 'left'); return e ? Text.event(e, Labels.nameOf(window.ACCESSION.state)) : null; });
          if (t1.over !== 'left' || !want || shown !== want) bad(`${tag}: leaving did not end the visit with its sentence ("${shown}")`);
          else {
            await sized(`${tag} end of visit open`);
            await press('#end.open [data-another]', tag, 'Another visit');
            if ((await now()).over) bad(`${tag}: "Another visit" after leaving did not start a new visit`);
            else did.push('left, another visit');
          }
        }
      }
      lines.push(`${tag}: ${did.join('; ')}`);
    }
    await browser.close();
    if (errors.length) bad(`${W}×${Hh} M3: console errors: ${errors.join('; ')}`);
  }
}
