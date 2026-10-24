'use strict';
// Shared pieces of the G4 learnability tools (DESIGN §18.8, the learner quiz): the browser, a phone page of the game
// (390x844, touch), real touch input through the browser's input pipeline, PNG pictures composed in a page (scaled
// game screenshots, rulers, sheets of items), and the scratch folder.
const fs = require('fs');
const path = require('path');
const base = require('../lib.cjs');

const SCRATCH = '/tmp/claude-0/-home-user-various/eea7fc80-8598-5a7a-a3e6-cdbd34e6e76d/scratchpad/rev5d/game';
const PHONE = { width: 390, height: 844 };

function args(argv) {
  const out = { _: [] };
  for (const a of argv || process.argv.slice(2)) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2]; else out._.push(a);
  }
  return out;
}

// A phone context (touch, coarse pointer, dpr 1) with fonts aborted (no network: the game reads the same in its fallback
// face) and console errors collected. storage: localStorage entries to start with.
async function phoneContext(browser, opts) {
  opts = opts || {};
  const context = await browser.newContext({ viewport: opts.viewport || PHONE, deviceScaleFactor: opts.dpr || 1, hasTouch: true, isMobile: true });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  const errors = [];
  context.on('page', p => {
    p.on('pageerror', e => errors.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.googleapis|ERR_FAILED/.test(m.text())) errors.push('console.error: ' + m.text()); });
  });
  if (opts.storage) await context.addInitScript(s => { for (const k in s) localStorage.setItem(k, s[k]); }, opts.storage);
  return { context, errors };
}
// real touch through CDP: one finger, down / move / up, and a quick tap
async function touchInput(page) {
  const client = await page.context().newCDPSession(page);
  const send = (type, x, y) => client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y, id: 1 }] });
  const I = { down: false, x: 195, y: 420 };
  I.move = async (x, y) => { I.x = x; I.y = y; if (!I.down) { I.down = true; await send('touchStart', x, y); } else await send('touchMove', x, y); };
  I.lift = async () => { if (!I.down) await send('touchStart', I.x, I.y); I.down = false; await send('touchEnd'); };
  I.tap = async (x, y) => { if (I.down) { I.down = false; await send('touchCancel'); } I.x = x; I.y = y; await send('touchStart', x, y); await send('touchEnd'); };
  I.cancel = async () => { if (I.down) { I.down = false; await send('touchCancel'); } };
  return I;
}

// A page for composing pictures (HTML in, PNG out): set its content, screenshot #root (opts.dpr: pixels per CSS px)
async function composer(browser, opts) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: (opts && opts.dpr) || 1 });
  return {
    page,
    async shoot(bodyHTML, css, scale) {
      await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#fff;font-family:'DejaVu Sans',system-ui,sans-serif;color:#1E2541}#root{display:inline-block;background:#fff}${css || ''}</style></head><body><div id="root">${bodyHTML}</div></body></html>`);
      await page.evaluate(() => Promise.all(Array.from(document.images).map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; }))));
      return page.locator('#root').screenshot({ type: 'png', scale: scale || 'device' });
    }
  };
}
const dataUrl = buf => 'data:image/png;base64,' + buf.toString('base64');
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function mkdirp(d) { fs.mkdirSync(d, { recursive: true }); return d; }
function writeJSON(f, o) { mkdirp(path.dirname(f)); fs.writeFileSync(f, JSON.stringify(o, null, 1) + '\n'); }

// the colours the game's tiles come in (Art.TILE_COLORS) and their names as a player says them
const COLOR_NAMES = { red: 'red', orange: 'orange', yellow: 'yellow', green: 'green', blue: 'blue', lightBlue: 'light blue', purple: 'purple' };
// colours for a build's tiles (polygons [{x, y}] in L) such that tiles that touch never share one (light blue left out:
// next to blue it is the one a viewer might mix up); r: a seeded random (an int(n) method)
const PALETTE = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
function touching(pa, pb) {
  const near = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) < 1e-6;
  };
  for (const [P, Q] of [[pa, pb], [pb, pa]]) for (const p of P) for (let k = 0; k < Q.length; k++) if (near(p, Q[k], Q[(k + 1) % Q.length])) return true;
  return false;
}
function colours(polys, r) {
  const out = [], off = r.int(PALETTE.length);
  polys.forEach((poly, i) => {
    const bad = new Set();
    for (let j = 0; j < i; j++) if (touching(poly, polys[j])) bad.add(out[j]);
    let c = null;
    for (let k = 0; k < PALETTE.length && !c; k++) { const cc = PALETTE[(off + i * 2 + k) % PALETTE.length]; if (!bad.has(cc)) c = cc; }
    out.push(c || PALETTE[i % PALETTE.length]);
  });
  return out;
}

module.exports = { SCRATCH, PHONE, args, phoneContext, touchInput, composer, dataUrl, esc, mkdirp, writeJSON, COLOR_NAMES, PALETTE, touching, colours, launch: base.launch, gameUrl: base.gameUrl, GAME: base.GAME };
