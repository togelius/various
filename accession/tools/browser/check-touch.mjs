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
import { playwright, fileUrl } from './lib.mjs';
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

const pw = playwright();
if (!pw) { console.log('SKIPPED: Playwright not found'); process.exit(77); }
const t0 = Date.now();
const browser = await pw.chromium.launch();
for (const [W, H, phone] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: phone });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(fileUrl('dist/accession.html') + '?dept=M11&seed=3');
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
