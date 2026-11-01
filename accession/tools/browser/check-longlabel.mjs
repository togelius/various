// ACCESSION — a long label is read to its end with each input alone (BUILD.md §7.1, §7.2; M4
// FU1). A Centrepiece's strip shows its phase alone and ends "Its label has the rest." (§5.3),
// so its label must give the rest: its whole line, which runs to 23 rows of the phone's strip
// (ARCH-CP-CORE's measure). That line, the Great Board's as the plan describes it, is planted
// as test/m4-lines.test.js plants it (plantLong, on M.11's Centrepiece record) on a sleeping
// exhibit in sight, a step past reading distance (so the strip, which shows the nearest label's
// line until LABELS-M4 gives a Centrepiece its short strip, is not the line: on a laptop it
// would leave the label panel 34 px), and at the largest text its label is opened and scrolled
// until the end
// of its Behaviour line is in view, above the label's buttons, by one input alone, with no
// other input reaching the page and nothing acting on the game (the turn, your tile and the
// selection stay):
//   - a finger, on a phone's touch screen (390×844): a tap opens it, swipes scroll it;
//   - the keys, at phone and laptop size (1280×800): x opens it, Tab reaches the label itself,
//     with its focus ring, the arrows bring its end into view and never step (written again,
//     as after an action, it keeps the focus and its place), Home takes it back to the top,
//     Page Down brings the end into view again, and End goes to its foot;
//   - a mouse with no wheel, at phone and laptop size, its scrollbars shown as on a desktop (a
//     headless browser hides them): a click opens it, and its scrollbar's thumb, dragged to
//     the foot, brings the end into view.
import { createRequire } from 'node:module';
import path from 'node:path';
import { playwright, fileUrl, muted, root } from './lib.mjs';
import { install } from './scenes.mjs';

const require = createRequire(import.meta.url);
const { plantLong } = require(path.join(root, 'test/m4-lines.test.js'));
const problems = [], lines = [];
const bad = s => problems.push(s);
const pw = playwright();
if (!pw) { console.log('SKIPPED: Playwright not found'); process.exit(77); }
const t0 = Date.now();
// Scrollbars as a desktop browser shows them (Playwright's headless default hides them).
const browser = await pw.chromium.launch({ args: muted(), ignoreDefaultArgs: ['--hide-scrollbars'] });

// Where the label stands: its Behaviour line's end in view (its last row inside the panel and
// above the buttons that stay at its foot), and the panel's scroll.
function where() {
  const e = document.getElementById('sheet'), b = e.querySelector('.beh'), acts = e.querySelector('.acts');
  if (!b) return null;
  const sr = e.getBoundingClientRect(), br = b.getBoundingClientRect(), ar = acts ? acts.getBoundingClientRect() : null;
  const foot = Math.min(sr.bottom, window.innerHeight, ar && ar.top > sr.top ? ar.top : Infinity), row = parseFloat(getComputedStyle(b).lineHeight) || 20;
  return { end: br.bottom <= foot + 1, inView: br.bottom <= foot + 1 && br.bottom - row >= sr.top - 1, top: e.scrollTop, max: e.scrollHeight - e.clientHeight };
}

const RUNS = [
  { input: 'touch', W: 390, H: 844, ctx: { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  { input: 'keys', W: 390, H: 844, ctx: {} },
  { input: 'keys', W: 1280, H: 800, ctx: {} },
  { input: 'mouse', W: 390, H: 844, ctx: {} },
  { input: 'mouse', W: 1280, H: 800, ctx: {} },
];
for (const run of RUNS) {
  const { input, W, H } = run, tag = `${W}×${H} ${input}`, tr = Date.now();
  const ctx = await browser.newContext(Object.assign({ viewport: { width: W, height: H }, deviceScaleFactor: 1 }, run.ctx));
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(fileUrl('dist/accession.html') + '?orient=0&dept=M11&seed=3');
  await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state);
  await install(page);
  // Staged (page.evaluate, no input): reduced motion, the largest text, the long line planted
  // on M.11's Centrepiece, and a sleeping exhibit of it in sight, the only one.
  const st = await page.evaluate(`(() => {
    const A = window.ACCESSION, T = window.__s;
    A.setting('motion', 'reduce'); A.setting('text', '1.3');
    const cp = (${plantLong.toString()})({ Registry, Packs, Modules }, 'M11');
    T.calm();
    const a = T.plodder(), l = T.lane(N.READ_RANGE + 1);
    if (!a || !l) return null;
    const [x, y] = l.tiles[N.READ_RANGE + 1];
    Object.assign(a, { x, y, sp: cp.id });
    A.redraw();
    const s = A.state;
    return { uid: a.uid, line: Clauses.line(cp, { depth: s.dept.depth, rulesOff: (s.options && s.options.rulesOff) || [], modules: Modules.active(s) }) };
  })()`);
  if (!st) { bad(`${tag}: no exhibit and lane to stage the long label`); await ctx.close(); continue; }
  // Every input but this one, as the page sees it.
  await page.evaluate(input => {
    window.__other = [];
    const note = t => e => {
      const kind = t === 'keydown' ? 'keys' : t === 'wheel' ? 'wheel' : t === 'touchstart' ? 'touch' : e.pointerType === 'touch' ? 'touch' : e.pointerType === 'mouse' ? 'mouse' : e.pointerType;
      if (e.isTrusted && kind !== input) window.__other.push(t + ':' + kind);
    };
    for (const t of ['keydown', 'pointerdown', 'wheel', 'touchstart']) window.addEventListener(t, note(t), true);
  }, input);
  const game = () => page.evaluate(() => { const A = window.ACCESSION, me = A.state.actors[0]; return { x: me.x, y: me.y, tick: A.state.tick, sel: A.vm().selection, shown: UI.labelShown() }; });
  const at = () => page.evaluate(where);
  // The panel's scroll once it has come to rest (a swipe flings it; a key scrolls smoothly).
  const rest = async () => {
    await page.evaluate(() => { document.getElementById('sheet').__was = undefined; });
    await page.waitForFunction(() => { const e = document.getElementById('sheet'), t = e.scrollTop, same = t === e.__was; e.__was = t; return same; }, null, { polling: 80, timeout: 10000 }).catch(() => {});
    return at();
  };
  const did = [];
  // Open its label with the input.
  const spot = await page.evaluate(uid => window.__spot({ uid }), st.uid);
  if (input === 'keys') { for (let i = 0; i < 12 && (await game()).shown !== st.uid; i++) await page.keyboard.press('x'); }
  else if (!spot) bad(`${tag}: the exhibit is not on screen to ${input === 'touch' ? 'tap' : 'click'}`);
  else if (input === 'touch') await page.touchscreen.tap(spot.x, spot.y);
  else await page.mouse.click(spot.x, spot.y);
  await page.waitForFunction(uid => UI.labelShown() === uid, st.uid, { timeout: 3000 }).catch(() => {});
  const g0 = await game(), beh = await page.evaluate(() => (document.querySelector('#sheet .beh') || {}).textContent || '');
  if (g0.shown !== st.uid) { bad(`${tag}: the long label did not open (${g0.shown})`); await ctx.close(); continue; }
  if (beh !== st.line) bad(`${tag}: the label shows "${beh.slice(0, 80)}…", not the planted Centrepiece's whole line`);
  const p0 = await rest();
  if (!p0 || p0.end || p0.max < 100) { bad(`${tag}: the long line's end was already in view (${JSON.stringify(p0)}), so its scrolling went untested`); await ctx.close(); continue; }
  did.push(`its label open, the ${st.line.length}-character line's end out of view (${p0.max} px to scroll)`);
  // Reached: the line's end no longer below what the label shows; seen: its last row in view
  // there (a scroll by steps that passes it, as a page that jumps past a row hidden under the
  // buttons, would not show it).
  const reach = (p, how, seen) => {
    if (p.end && (seen || p.inView)) did.push(`${how} brought the line's end into view (scrolled to ${Math.round(p.top)} of ${p.max})`);
    else bad(`${tag}: ${how} did not bring the line's end into view (scrolled to ${Math.round(p.top)} of ${p.max}${p.end ? ', past it' : ''})`);
  };
  if (input === 'touch') {
    // Swipes up on the label, above its buttons, until the end is in view.
    const cdp = await ctx.newCDPSession(page);
    const box = await page.evaluate(() => { const r = document.getElementById('sheet').getBoundingClientRect(), a = document.querySelector('#sheet .acts').getBoundingClientRect(); return { x: r.left + r.width / 2, top: r.top + 30, low: Math.min(a.top, r.bottom) - 20 }; });
    let p = p0;
    for (let i = 0; i < 8 && !p.end; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.low }] });
      for (let k = 1; k <= 8; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x, y: box.low + (box.top - box.low) * k / 8 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      p = await rest();
    }
    reach(p, 'swipes', true);
  } else if (input === 'keys') {
    // Tab reaches the label itself, with its focus ring.
    let on = false;
    for (let i = 0; i < 30 && !on; i++) { await page.keyboard.press('Tab'); on = await page.evaluate(() => document.activeElement && document.activeElement.id === 'sheet'); }
    if (!on) bad(`${tag}: Tab never reached the label, which holds more than it shows`);
    else {
      const ring = await page.evaluate(() => { const e = document.activeElement, cs = getComputedStyle(e); return e.matches(':focus-visible') && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2; });
      if (ring) did.push('Tab reached the label, with its focus ring'); else bad(`${tag}: the label, reached by Tab, shows no focus ring`);
      let p = p0;
      for (let i = 0; i < 80 && !p.end; i++) { await page.keyboard.press('ArrowDown'); p = await rest(); }
      reach(p, 'ArrowDown');
      // Written again, as every action writes it (main.js), it keeps the focus and its place.
      await page.evaluate(uid => UI.label(Labels.of(window.ACCESSION.state, uid)), st.uid);
      const kept = await page.evaluate(() => ({ on: !!document.activeElement && document.activeElement.id === 'sheet', top: document.getElementById('sheet').scrollTop }));
      if (!kept.on || Math.abs(kept.top - p.top) > 1) bad(`${tag}: written again, the label ${kept.on ? 'kept' : 'lost'} the focus, and its scroll went from ${p.top} to ${kept.top}`);
      else did.push('written again, it kept the focus and its place');
      await page.keyboard.press('Home');
      p = await rest();
      if (p.top > 1) bad(`${tag}: Home did not take the label back to its top (${p.top})`);
      for (let i = 0; i < 10 && !p.end; i++) { await page.keyboard.press('PageDown'); p = await rest(); }
      reach(p, 'Page Down');
      await page.keyboard.press('End');
      p = await rest();
      if (p.top < p.max - 1) bad(`${tag}: End did not take the label to its foot (${p.top} of ${p.max})`);
      if (!await page.evaluate(() => document.activeElement && document.activeElement.id === 'sheet')) bad(`${tag}: the label lost the focus while it scrolled`);
    }
  } else {
    // The scrollbar's thumb: between the arrow buttons at its ends (as wide as the bar is),
    // as long as the share of the label in view, at the scroll's place.
    const g = await page.evaluate(() => { const e = document.getElementById('sheet'), r = e.getBoundingClientRect(), cs = getComputedStyle(e), bar = e.offsetWidth - e.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth), track = e.clientHeight - 2 * bar, len = Math.max(bar, track * e.clientHeight / e.scrollHeight); return { bar, x: r.right - bar / 2, y: r.top + e.clientTop + bar + (track - len) * e.scrollTop / Math.max(1, e.scrollHeight - e.clientHeight) + len / 2, foot: r.bottom }; });
    if (!g.bar) bad(`${tag}: the label shows no scrollbar for a mouse with no wheel`);
    else {
      await page.mouse.move(g.x, g.y);
      await page.mouse.down();
      await page.mouse.move(g.x, g.foot + 40, { steps: 12 });
      await page.mouse.up();
      reach(await rest(), `dragging its ${g.bar}-px scrollbar's thumb`, true);
    }
  }
  const g1 = await game();
  if (g1.x !== g0.x || g1.y !== g0.y || g1.tick !== g0.tick || g1.sel !== g0.sel || g1.shown !== st.uid) bad(`${tag}: scrolling the label acted on the game: you ${g0.x},${g0.y} → ${g1.x},${g1.y}, tick ${g0.tick} → ${g1.tick}, selection ${g0.sel} → ${g1.sel}, label ${g1.shown}`);
  const other = await page.evaluate(() => window.__other);
  if (other.length) bad(`${tag}: the page saw input other than ${input} (${[...new Set(other)].join(', ')})`);
  const words = await page.evaluate(() => (document.body.innerText.match(/[^\n]*(undefined|NaN|\[object)[^\n]*/g) || []).slice(0, 3));
  if (words.length) bad(`${tag}: the page says ${words.join(' | ')}`);
  if (errors.length) bad(`${tag}: console errors: ${errors.join('; ')}`);
  lines.push(`${tag} (${((Date.now() - tr) / 1000).toFixed(1)} s): ${did.join('; ')}`);
  await ctx.close();
}
await browser.close();
for (const l of lines) console.log(l);
for (const p of problems) console.log('PROBLEM ' + p);
console.log(problems.length ? `longlabel: ${problems.length} problem(s)` : `longlabel: a Centrepiece's whole line (planted, 23 strip rows at depth 7) read to its end in its label at the largest text by swipes alone, by the keys alone (Tab to the label, then the arrows or Page Down) and by a mouse with no wheel alone (its scrollbar dragged), at phone and laptop size, nothing acting on the game (${Math.round((Date.now() - t0) / 1000)} s); no problems`);
process.exit(problems.length ? 1 : 0);
