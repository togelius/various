// ACCESSION — a finger alone (BUILD.md §7.1). The same visit as check-keys, played with
// page.touchscreen.tap and nothing else (no mouse, no keyboard, no click, no action staged),
// in a touch screen's browser (hasTouch; isMobile on the phone): at 390×844 in both board
// views, and on a tablet (820×1180) in both. Every verb and screen of M3 is reached by taps
// on what is on screen: Settings (the board view, reduced motion, text size, zoom), "How the
// museum works", the Zoom button, steps and blows (a tap beside you, a tap on the selected
// exhibit, the label's Attack), a case opened, what it held taken, walked into, another
// broken through its confirmation (Cancel, then yes), shards and a beam, an item taken, a
// label read, a staff door opened and closed, sit, rest and wait, the Bag (equip, take off,
// drop, drink, a throw aimed by taps, a Catalogue Card's choice, a Floor Plan), the floor plan,
// a quickslot, the fork, the Pin-Driver and the Window Pole (its sheet cancelled and answered,
// and its take), a Restoration kit, leaving, the end of the visit and "Another visit", a
// death, its recap closed and shown again, and "Another visit". At each screen no target is
// under 44 px and nothing scrolls sideways; nothing on the page is shown only on hover (no
// title, no :hover rule). The scenes are tools/browser/scenes.mjs's; this file runs them
// with the finger's driver.
import { playwright, fileUrl, muted } from './lib.mjs';
import { layout, targets } from './measure.mjs';
import { playScenes, install, pointerDriver } from './scenes.mjs';

const problems = [], lines = [];
const bad = s => problems.push(s);
const SIZES = [[390, 844, true], [820, 1180, false]];

// Anything shown only to a pointer that hovers: a title (a tooltip), an SVG title, or a
// :hover rule in a style sheet.
function hoverOnly() {
  const out = [];
  for (const e of document.querySelectorAll('[title]')) out.push(`a title on ${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}`);
  if (document.querySelector('svg title')) out.push('an SVG title');
  const walk = rules => { for (const r of rules) { if (r.selectorText && /:hover/.test(r.selectorText)) out.push(`the rule ${r.selectorText}`); if (r.cssRules) walk(r.cssRules); } };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch (e) { /* a sheet from elsewhere */ } }
  return out;
}

// ---- After the scenes: what a finger alone must also get right ----
// A swipe across the board is no tap (it walks nowhere, selects nothing), while a tap that
// slides a few pixels still is one; on a phone, a long Bag scrolls under a swipe that starts on
// an item, which opens nothing, and swipes back, and a long label's sheet scrolls under one;
// and the aim strip says what a tap does.
// Swipes are touch events sent through the browser's own input (CDP Input.dispatchTouchEvent).
async function fingerAlone(page, ctx, drv, tag, phone, did) {
  const ok = (c, yes, no) => { if (c) did.push(yes); else bad(`${tag}: ${no}`); return c; };
  const cdp = await ctx.newCDPSession(page);
  const swipe = async (from, to, steps = 8) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
    for (let i = 1; i <= steps; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => !window.ACCESSION.busy());
  };
  // A box's scroll, once it has come to rest (a swipe flings it).
  const rest = sel => page.waitForFunction(sel => { const b = document.querySelector(sel), t = b.scrollTop, same = t === b.__was; b.__was = t; return same ? { t } : false; }, sel, { polling: 150, timeout: 10000 }).then(h => h.jsonValue()).then(v => v.t);
  const at = () => page.evaluate(() => { const A = window.ACCESSION, me = A.state.actors[0], vm = A.vm(); return { x: me.x, y: me.y, tick: A.state.tick, sel: vm.selection, path: !!vm.path && vm.path.length > 0, bag: Bag.shown(), item: !!document.querySelector('#bag.open [data-back]') }; });
  await drv.escape();
  const lane = await page.evaluate(() => { window.__s.calm(); const l = window.__s.lane(4); window.ACCESSION.redraw(); return l && l.tiles.map(([x, y]) => window.__spot({ x, y }) && { x, y, p: window.__spot({ x, y }) }); });
  if (!lane || lane.some(t => !t)) bad(`${tag}: no lane on screen to swipe along`);
  else {
    const s0 = await at();
    await swipe(lane[0].p, lane[3].p);
    const s1 = await at();
    ok(s1.x === s0.x && s1.y === s0.y && s1.tick === s0.tick && s1.sel === s0.sel && !s1.path, 'a swipe across the board was no tap', `a swipe across the board acted: you ${s0.x},${s0.y} → ${s1.x},${s1.y}, tick ${s0.tick} → ${s1.tick}, selection ${s1.sel}, path ${s1.path}`);
    await swipe({ x: lane[2].p.x + 5, y: lane[2].p.y + 4 }, lane[2].p, 2);
    const s2 = await at();
    ok(s2.x === lane[2].x && s2.y === lane[2].y, 'a tap that slid a few pixels walked', `a tap that slid 6 px did not walk to ${lane[2].x},${lane[2].y} (you are at ${s2.x},${s2.y})`);
  }
  const uid = await page.evaluate(() => { window.__s.lane(4); return window.__s.make('consolidant'); });
  await drv.bag(); await drv.bagItem(uid); await drv.bagAct('throw');
  const words = await page.evaluate(() => (document.querySelector('#bagaim.open .aim-text') || {}).textContent || '');
  ok(/^.*Tap /.test(words) && !/Enter/.test(words), 'the aim strip said what a tap does', `the aim strip, aimed by taps, said "${words}"`);
  await drv.cancelAim();
  if (phone) {
    // A long Bag: your tote filled.
    await page.evaluate(() => { const s = window.ACCESSION.state; while (s.you.tote.length < N.TOTE_SLOTS - 2) Kit.make(s, { kind: 'weapon', form: 'light', tier: 1 }, { at: 'tote' }); window.ACCESSION.redraw(); });
    await drv.bag();
    const row = await page.evaluate(() => { const r = [...document.querySelectorAll('#bag.open [data-item]')][1].getBoundingClientRect(), b = document.getElementById('bag'); return { x: r.left + r.width / 2, y: r.top + r.height / 2, max: b.scrollHeight - b.clientHeight }; });
    if (row.max < 200) bad(`${tag}: the filled Bag is too short to swipe (${row.max} px to scroll)`);
    else {
      const s0 = await at();
      await swipe(row, { x: row.x, y: row.y - 300 });
      const down = await rest('#bag'), s1 = await at();
      await swipe({ x: row.x, y: 200 }, { x: row.x, y: 700 });
      const up = await rest('#bag'), s2 = await at();
      ok(down > 0 && up === 0 && s1.bag === 'bag' && !s1.item && !s2.item && s2.tick === s0.tick, 'a long Bag scrolled under a swipe and back, opening nothing', `a swipe on the Bag: scrolled to ${down}, then back to ${up}; an item opened: ${s1.item || s2.item}; the Bag ${s1.bag}; tick ${s0.tick} → ${s2.tick}`);
    }
    await drv.closeBag();
    // A long label, at the largest text: its sheet scrolls under a swipe, which presses nothing.
    await drv.settings('text', '1.3');
    const c = await page.evaluate(() => window.__s.shutCase(false));
    if (c && await drv.select(c.id)) {
      const box = await page.evaluate(() => { const e = document.getElementById('sheet'), r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 40, max: e.scrollHeight - e.clientHeight }; });
      if (box.max < 60) bad(`${tag}: the case's label at the largest text is too short to swipe (${box.max} px to scroll)`);
      else {
        const s0 = await at();
        await swipe({ x: box.x, y: box.y + 200 }, box);
        const down = await rest('#sheet'), s1 = await at();
        ok(down > 0 && s1.sel === c.id && s1.tick === s0.tick && !await page.evaluate(() => UI.confirmOpen()), 'a long label scrolled under a swipe, pressing nothing', `a swipe on the label: scrolled to ${down}; selection ${s1.sel}; tick ${s0.tick} → ${s1.tick}`);
      }
      await drv.escape();
    } else bad(`${tag}: no case to read a long label of`);
    await drv.settings('text', '1');
  }
}

const pw = playwright();
if (!pw) { console.log('SKIPPED: Playwright not found'); process.exit(77); }
const t0 = Date.now();
const browser = await pw.chromium.launch({ args: muted() });
for (const [W, H, phone] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: phone });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(fileUrl('dist/accession.html') + '?orient=0&dept=M11&seed=3');
  const ready = async () => { await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state); await install(page); };
  await ready();
  const views = await page.evaluate(() => window.ACCESSION.views.list());
  for (const v of views) {
    const tag = `${W}×${H} ${v.label} touch`, did = [], tv = Date.now();
    if (v !== views[0]) { await page.reload(); await ready(); }
    // No mouse and no keys: every mouse event the page sees that a finger did not bring, and
    // every key, is a problem.
    await page.evaluate(() => { window.__other = []; for (const t of ['keydown', 'mousedown', 'pointerdown']) window.addEventListener(t, e => { if (e.isTrusted && (t === 'keydown' || (e.pointerType && e.pointerType !== 'touch') || (t === 'mousedown' && !e.sourceCapabilities?.firesTouchEvents))) window.__other.push(t + (e.pointerType ? ':' + e.pointerType : '')); }, true); });
    const drv = pointerDriver(page, tag, bad, (x, y) => page.touchscreen.tap(x, y), W);
    await drv.settings('motion', 'reduce');
    await drv.settings('board', v.id);
    await page.evaluate(() => window.ACCESSION.renderer.ready.catch(() => {}));
    const active = await page.evaluate(() => window.ACCESSION.views.active());
    if (active.id !== v.id) { bad(`${tag}: the ${v.label} board was not chosen, or fell back (${active.note})`); await ctx.close(); continue; }
    did.push(`${v.label} board chosen in Settings`);
    // The buttons show no keys on a touch screen until a key is pressed.
    const hints = await page.evaluate(() => { const b = document.querySelector('#bar [data-act="wait"]'); return getComputedStyle(b, '::after').display; });
    if (phone && hints !== 'none') bad(`${tag}: a touch screen shows the buttons' keys (${hints})`);
    for (const h of await page.evaluate(hoverOnly)) bad(`${tag}: shown only on hover: ${h}`);
    await playScenes({ page, drv, tag, bad, did, W, H, layout, targets });
    await fingerAlone(page, ctx, drv, tag, phone, did);
    for (const h of await page.evaluate(hoverOnly)) bad(`${tag}: shown only on hover, after play: ${h}`);
    const other = await page.evaluate(() => window.__other);
    if (other.length) bad(`${tag}: the page saw input other than a finger's (${[...new Set(other)].join(', ')})`);
    lines.push(`${tag} (${Math.round((Date.now() - tv) / 1000)} s): ${did.join('; ')}`);
  }
  const words = await page.evaluate(() => (document.body.innerText.match(/[^\n]*(undefined|NaN|\[object)[^\n]*/g) || []).slice(0, 3));
  if (words.length) bad(`${W}×${H}: the page says ${words.join(' | ')}`);
  if (errors.length) bad(`${W}×${H} touch: console errors: ${errors.join('; ')}`);
  await ctx.close();
}
await browser.close();
for (const l of lines) console.log(l);
for (const p of problems) console.log('PROBLEM ' + p);
console.log(problems.length ? `touch: ${problems.length} problem(s)` : `touch: a finger alone, phone in both views and a tablet in both (${Math.round((Date.now() - t0) / 1000)} s): Settings and "How the museum works", zoom, steps and blows, cases opened and broken, shards and a beam, an item taken, a label read, a staff door opened and closed, sit, rest and wait, the Bag (equip, take off, drop, drink, throw aimed, a Card's choice, a Floor Plan), the floor plan, a quickslot, the fork, Pin-Driver and pole aimed by taps, a kit, leaving and a death each followed by another visit; 44-px targets and no sideways scroll at each screen; nothing shown only on hover; no problems`);
process.exit(problems.length ? 1 : 0);
