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

module.exports = { pw, launch, gamePage, gameUrl, until, GAME };
