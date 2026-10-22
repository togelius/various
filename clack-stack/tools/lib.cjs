'use strict';
// Shared Playwright helpers for the Clack Stack tools (revision 4; the classic suite lives in ../classic/tools/).
const path = require('path');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }

// CLACK_GAME=/path/to/other.html runs the same checks against another build
const GAME = 'file://' + path.resolve(process.env.CLACK_GAME || path.join(__dirname, '..', 'index.html'));

function launch() { return pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); }
function gameUrl(params) {
  const q = Object.entries(params || {}).map(([k, v]) => v === '' ? k : k + '=' + encodeURIComponent(v)).join('&');
  return GAME + (q ? '?' + q : '');
}
// A new context and page (Google Fonts requests aborted: no network), page and console errors collected.
// opts.touch: a phone (touch events, coarse pointer); opts.storage: localStorage entries to start with
async function gamePage(browser, viewport, params, opts) {
  opts = opts || {};
  const context = await browser.newContext({ viewport, deviceScaleFactor: opts.dpr || 1, hasTouch: !!opts.touch, isMobile: !!opts.touch });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  const page = await context.newPage();
  const errors = [], logs = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    const t = m.text();
    // (the aborted font request is ours, not the game's)
    if (m.type() === 'error' && !/fonts\.googleapis|ERR_FAILED/.test(t)) errors.push('console.error: ' + t); else logs.push(t);
  });
  if (opts.storage) await page.addInitScript(s => { for (const k in s) localStorage.setItem(k, s[k]); }, opts.storage);
  await page.goto(gameUrl(params), { waitUntil: 'load' });
  return { context, page, errors, logs };
}
// Wait (polling every animation frame) until fn(arg) in the page is truthy.
function until(page, fn, arg, timeout) { return page.waitForFunction(fn, arg, { polling: 'raf', timeout: timeout || 15000 }); }
// game time (s) to pass
async function gameWait(page, dt, timeout) {
  const t0 = await page.evaluate(() => CS.state().t);
  await until(page, t => CS.state().t >= t, t0 + dt, timeout || 30000);
}
async function ready(page, timeout) {
  await until(page, () => { const s = CS.state(); return s.phase === 'play' && s.handReady && !s.locked; }, null, timeout || 20000);
}
// real touch through the browser's input pipeline (CDP): a finger down, moves, up
async function touch(page) {
  const client = await page.context().newCDPSession(page);
  const send = (type, x, y) => client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  return { down: (x, y) => send('touchStart', x, y), move: (x, y) => send('touchMove', x, y), up: () => send('touchEnd'), tap: async (x, y) => { await send('touchStart', x, y); await send('touchEnd'); } };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
module.exports = { pw, launch, gamePage, gameUrl, until, gameWait, ready, touch, sleep, GAME };
