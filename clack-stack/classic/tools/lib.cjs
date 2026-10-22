'use strict';
// Shared Playwright helpers for the Clack Stack test runners.
const path = require('path');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }

// CLACK_GAME=/path/to/other.html runs the same checks against another build (e.g. an integration candidate)
const GAME = 'file://' + path.resolve(process.env.CLACK_GAME || path.join(__dirname, '..', 'index.html'));

function launch() { return pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); }

function gameUrl(params) {
  const q = Object.entries(params || {}).map(([k, v]) => v === '' ? k : k + '=' + encodeURIComponent(v)).join('&');
  return GAME + (q ? '?' + q : '');
}

// The M1-M3 tools were written for an endless clock (DESIGN 14: the clock arrives with M4). For them the clock is
// kept topped up from the page (CS.setClock, a test hook), so a long bot run never ends in TIME!. M4+ tools that test
// the clock itself pass { realClock: true }.
function keepClock() {
  (function keep() {
    try { if (window.CS && S.clock < 20 && (S.phase === 'play' || S.phase === 'crash')) CS.setClock(60); } catch (e) { /* not booted yet */ }
    requestAnimationFrame(keep);
  })();
}
// New context + page with fonts stubbed out (no network), errors collected.
async function gamePage(browser, viewport, params, opts) {
  opts = opts || {};
  const context = await browser.newContext({ viewport, deviceScaleFactor: opts.dpr || 1, hasTouch: !!opts.touch, isMobile: !!opts.touch });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await context.newPage();
  const errors = [], logs = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); else logs.push(m.text()); });
  if (!opts.realClock && params && params.autostart) await page.addInitScript(keepClock);
  await page.goto(gameUrl(params), { waitUntil: 'load' });
  return { context, page, errors, logs };
}

// Wait (polling every animation frame) until fn(arg) in the page is truthy.
function until(page, fn, arg, timeout) {
  return page.waitForFunction(fn, arg, { polling: 'raf', timeout: timeout || 10000 });
}

// In-page, every frame of play (page.evaluate(wordMonitor); read window.__wv): the word pops against the lead's rules.
// One pop per landing: at most two 'word' pops alive, each living <= 0.6 s, never drawn over the ghost (unless
// see-through because the aim moved under it after it was born: one see-through in its first 50 ms with the hand
// where it was at its birth was born over the ghost) and never born over the build top; settled (popped in), no word or announcement sits over a HUD box
// or over another pop still up. The level banner, settled, never covers the ghost, the tile in the hand or the
// ribbon's label while the hand is ready to drop.
function wordMonitor() {
  const V = window.__wv = { n: 0, settled: 0, bad: [], maxAlive: 0, frames: 0, banners: 0, bornDim: new Set() };
  const bannerSeen = new Set();
  const seen = new Set(), settled = new Set();
  const hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  (function f() {
    try {
      if (S.phase === 'play' || S.phase === 'smash') {
        V.frames++;
        const all = CS.words().filter((w) => w.kind === 'word' || w.kind === 'announce'), ws = all.filter((w) => w.kind === 'word'), g = CS.ghost(), L = CS.cam().L;
        if (ws.length > V.maxAlive) V.maxAlive = ws.length;
        if (ws.length > 2 && V.bad.length < 20) V.bad.push(ws.length + ' words alive: ' + ws.map((w) => w.text).join(' / '));
        const tiles = CS.tiles();
        let top = 1e9; for (const t of tiles) top = Math.min(top, t.sy);
        // (each tile's real outline: a triangle reaches 2/3 of its height from its centroid on its apex side, 1/3 on its
        // flat side)
        const topBox = tiles.filter((t) => t.sy < top + 0.6 * L).map((t) => { const e = t.ext || [0.5, 0.5, 0.5, 0.5]; return { x0: t.sx - e[0] * L, x1: t.sx + e[2] * L, y0: t.sy - e[1] * L, y1: t.sy + e[3] * L }; });
        for (const w of all) {
          if (!w.box) continue;
          const id = w.text + '@' + (CS.state().t - w.age).toFixed(4);
          if (w.age >= 0.2 && !settled.has(id)) {
            settled.add(id); V.settled++;
            const ui = CS.ui(), r2b = (r) => ({ x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h });
            for (const k of ['pause', 'mute', 'score', 'next', 'hold', 'clock']) if (ui[k] && hit(w.box, r2b(ui[k])) && V.bad.length < 20) V.bad.push('"' + w.text + '" over the HUD ' + k + ' (' + [w.box.x0, w.box.y0, w.box.x1, w.box.y1].map(Math.round).join(',') + ' vs ' + [ui[k].x, ui[k].y, ui[k].x + ui[k].w, ui[k].y + ui[k].h].map(Math.round).join(',') + ')');
            for (const o of all) if (o !== w && o.box && o.age >= 0.2 && o.age < o.life - 0.12 && hit(w.box, o.box) && V.bad.length < 20) V.bad.push('"' + w.text + '" over "' + o.text + '"');
          }
        }
        // the level banner, once popped in, with the hand ready over the new base
        const bn = CS.banner && CS.banner(), st = CS.state();
        if (bn && bn.title !== 'TIME!' && bn.age >= 0.22 && bn.age < bn.life - 0.3 && S.phase === 'play' && st.handReady && !st.locked) {
          const c = CS.cam(), held = { x0: c.handX - 0.55 * L, y0: c.handY - 0.75 * L, x1: c.handX + 0.55 * L, y1: c.handY + 1.05 * L };
          const rb = CS.ribbon(), bid = bn.title + '@' + (st.t - bn.age).toFixed(3);
          if (!bannerSeen.has(bid)) { bannerSeen.add(bid); V.banners++; }
          for (const bx of [bn.box, bn.subBox]) {
            if (!bx) continue;
            const what = bx === bn.box ? '"' + bn.title + '"' : '"' + bn.sub + '"';
            if (g && g.box && hit(bx, g.box) && V.bad.length < 20) V.bad.push('banner ' + what + ' over the ghost');
            if (hit(bx, held) && V.bad.length < 20) V.bad.push('banner ' + what + ' over the tile in the hand (age ' + bn.age.toFixed(2) + ')');
            if (rb.label && hit(bx, rb.label) && V.bad.length < 20) V.bad.push('banner ' + what + " over the ribbon's label");
            if (rb.on && bx.y0 < rb.y + 3 && bx.y1 > rb.y - 3 && bx.x0 < rb.x1 && bx.x1 > rb.x0 && V.bad.length < 20) V.bad.push('banner ' + what + ' over the ribbon');
          }
        }
        for (const w of ws) {
          if (!w.box) continue;
          const id = w.text + '@' + (CS.state().t - w.age).toFixed(4);
          if (w.life > 0.6 + 1e-9 && V.bad.length < 20) V.bad.push('"' + w.text + '" lives ' + w.life + ' s');
          if (g && g.box && !w.dim && w.box.x0 < g.box.x1 && g.box.x0 < w.box.x1 && w.box.y0 < g.box.y1 && g.box.y0 < w.box.y1 && V.bad.length < 20) V.bad.push('"' + w.text + '" over the ghost');
          if (w.dim && w.age < 0.05 && !w.aimMoved && V.bad.length < 20 && !V.bornDim.has(id)) { V.bornDim.add(id); V.bad.push('"' + w.text + '" born over the ghost (see-through at ' + (w.age * 1000).toFixed(0) + ' ms)'); }
          if (!seen.has(id)) {
            seen.add(id); V.n++;
            for (const b of topBox) if (w.box.x0 < b.x1 && b.x0 < w.box.x1 && w.box.y0 < b.y1 && b.y0 < w.box.y1) { if (V.bad.length < 20) V.bad.push('"' + w.text + '" born over the build top'); break; }
          }
        }
      }
    } catch (e) { /* booting */ }
    requestAnimationFrame(f);
  })();
}

module.exports = { pw, launch, gamePage, gameUrl, until, wordMonitor, GAME };
