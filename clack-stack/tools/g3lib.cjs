'use strict';
// Shared helpers for the G3 browser tests (DESIGN §18.8): the three screen sizes, real input as a player has it (a
// finger on the two phone sizes, a mouse on the large window, the keys), the ?drive clock, the display list, the game
// canvas's pixels, PNG screenshots, the rules the page under test runs (its RULES block, loaded pure in Node), and the
// mapping from the rules' lattice to the screen.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const lib = require('./lib.cjs');
const rulesVm = require('./lib/rules-vm.cjs');

const SIZES = [
  { name: '390x844', w: 390, h: 844, touch: true },
  { name: '844x390', w: 844, h: 390, touch: true },
  { name: '1366x1024', w: 1366, h: 1024, touch: false },
];
// --sizes=390x844,1366x1024 picks some of them
function sizesFrom(argv) {
  const a = (argv || process.argv).find(s => s.startsWith('--sizes='));
  if (!a) return SIZES;
  const want = a.slice(8).split(',');
  return SIZES.filter(s => want.includes(s.name));
}
function argOf(name, dflt, argv) {
  const a = (argv || process.argv).find(s => s.startsWith('--' + name + '='));
  return a ? a.slice(name.length + 3) : dflt;
}
const PLAYED = { 'clackstack.prefs5': JSON.stringify({ played: true }) };
const GAMEFILE = path.resolve(process.env.CLACK_GAME || path.join(__dirname, '..', 'index.html'));

// the rules the page under test runs: its own RULES block, loaded pure (the same check build.cjs makes)
function pageRules() {
  const html = fs.readFileSync(GAMEFILE, 'utf8');
  const i = html.indexOf(rulesVm.BEGIN), j = html.indexOf(rulesVm.END);
  if (i < 0 || j < i) throw new Error(GAMEFILE + ' has no RULES block');
  return rulesVm.load({ from: { source: html.slice(i + rulesVm.BEGIN.length, j), file: GAMEFILE + '#RULES' } });
}

// A page of the game at a size, with real input for it. opts.touch overrides the size's own input.
async function open(browser, size, params, opts) {
  opts = Object.assign({ touch: size.touch, storage: PLAYED }, opts || {});
  const g = await lib.gamePage(browser, { width: size.w, height: size.h }, Object.assign({ mute: 1 }, params || {}), opts);
  g.input = await makeInput(g.page, !!opts.touch);
  g.size = size;
  return g;
}
// Real input through the browser's input pipeline. aim: the pointer (or a finger, put down the first time) to x, y;
// release: let go (a click, or the finger lifted), at x, y if given (the finger moved there first); tap: a click or a
// tap; key: a key press.
async function makeInput(page, touch) {
  const I = { touch, down: false, x: 0, y: 0, page };
  if (touch) {
    const client = await page.context().newCDPSession(page);
    const send = (type, x, y) => client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y, id: 1 }] });
    I.aim = async (x, y) => { I.x = x; I.y = y; if (!I.down) { I.down = true; await send('touchStart', x, y); } else await send('touchMove', x, y); };
    I.release = async (x, y) => { if (x !== undefined) await I.aim(x, y === undefined ? I.y : y); if (!I.down) await send('touchStart', I.x, I.y); I.down = false; await send('touchEnd'); };
    I.cancel = async () => { if (I.down) { I.down = false; await send('touchCancel'); } };
    I.tap = async (x, y) => { if (I.down) { I.down = false; await send('touchCancel'); } await send('touchStart', x, y); await send('touchEnd'); };
  } else {
    I.aim = async (x, y) => { I.x = x; I.y = y; await page.mouse.move(x, y); };
    I.release = async (x, y) => { if (x !== undefined) await I.aim(x, y === undefined ? I.y : y); await page.mouse.down(); await page.mouse.up(); };
    I.cancel = async () => {};
    I.tap = async (x, y) => { await page.mouse.click(x, y); };
  }
  I.key = k => page.keyboard.press(k);
  return I;
}
// one frame drawn after input (the ?drive clock draws when input comes; a real clock draws every frame)
function frame(page) { return page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))); }
const display = page => page.evaluate(() => CS.display());
const state = page => page.evaluate(() => CS.state());
const step = (page, n) => page.evaluate(n => CS.step(n), n);
const wait = (page, t) => page.evaluate(t => CS.wait(t), t);

/* ---- pixels ---- */
// the game canvas's pixels, kept in the page under a name (CSS px = device px at dpr 1)
function keepPixels(page, name) {
  return page.evaluate(n => { const c = document.getElementById('c'); (window.__px || (window.__px = {}))[n] = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; return c.width * c.height; }, name);
}
// how the canvas now (or the kept picture b) differs from the kept picture a: the number of pixels that changed by more
// than tol in any channel, and the box they lie in (canvas px)
function diffPixels(page, a, b, tol) {
  return page.evaluate(([a, b, tol]) => {
    const c = document.getElementById('c'), W = c.width, H = c.height, A = window.__px[a];
    const B = b ? window.__px[b] : c.getContext('2d').getImageData(0, 0, W, H).data;
    let n = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = 4 * (y * W + x);
      if (Math.abs(A[k] - B[k]) > tol || Math.abs(A[k + 1] - B[k + 1]) > tol || Math.abs(A[k + 2] - B[k + 2]) > tol || Math.abs(A[k + 3] - B[k + 3]) > tol) {
        n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    return { n, box: n ? { x0, y0, x1: x1 + 1, y1: y1 + 1 } : null };
  }, [a, b || null, tol || 0]);
}
// how the canvas now differs from the kept picture a: the pixels that changed (by more than tol), and those of them
// outside every rect of `allowed` ({x0, y0, x1, y1}, CSS px = canvas px at dpr 1), with the box they lie in
function diffOutside(page, a, allowed, tol) {
  return page.evaluate(([a, allowed, tol]) => {
    const c = document.getElementById('c'), W = c.width, H = c.height, A = window.__px[a];
    const B = c.getContext('2d').getImageData(0, 0, W, H).data;
    let n = 0, out = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = 4 * (y * W + x);
      if (Math.abs(A[k] - B[k]) <= tol && Math.abs(A[k + 1] - B[k + 1]) <= tol && Math.abs(A[k + 2] - B[k + 2]) <= tol && Math.abs(A[k + 3] - B[k + 3]) <= tol) continue;
      n++;
      let inside = false;
      for (const r of allowed) if (x + 1 > r.x0 && x < r.x1 && y + 1 > r.y0 && y < r.y1) { inside = true; break; }
      if (inside) continue;
      out++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return { n, out, outBox: out ? { x0, y0, x1: x1 + 1, y1: y1 + 1 } : null };
  }, [a, allowed, tol || 0]);
}
// pixels of the kept picture in a polygon's neighbourhood that differ from the canvas now: per point of a list, whether
// any pixel within r of it changed (the gap audit: how much of an outline is visibly marked)
function changedNear(page, a, pts, r, tol) {
  return page.evaluate(([a, pts, r, tol]) => {
    const c = document.getElementById('c'), W = c.width, H = c.height, A = window.__px[a];
    const B = c.getContext('2d').getImageData(0, 0, W, H).data;
    return pts.map(([px, py]) => {
      for (let y = Math.max(0, Math.floor(py - r)); y <= Math.min(H - 1, Math.ceil(py + r)); y++)
        for (let x = Math.max(0, Math.floor(px - r)); x <= Math.min(W - 1, Math.ceil(px + r)); x++) {
          const k = 4 * (y * W + x);
          if (Math.abs(A[k] - B[k]) > tol || Math.abs(A[k + 1] - B[k + 1]) > tol || Math.abs(A[k + 2] - B[k + 2]) > tol) return 1;
        }
      return 0;
    });
  }, [a, pts, r, tol || 8]);
}
// a PNG (8-bit RGB or RGBA, not interlaced: what Chromium's screenshots are) into {w, h, px: RGBA}
function decodePNG(buf) {
  let o = 8, w = 0, h = 0, ct = 0;
  const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8), data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; if (data[8] !== 8 || data[12] !== 0) throw new Error('png: only 8-bit, not interlaced'); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0;
  if (!bpp) throw new Error('png: colour type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, px = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0, x = line[i];
      let v;
      if (f === 0) v = x; else if (f === 1) v = x + a; else if (f === 2) v = x + b; else if (f === 3) v = x + ((a + b) >> 1);
      else { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) { const s = x * bpp, d = 4 * (y * w + x); px[d] = cur[s]; px[d + 1] = cur[s + 1]; px[d + 2] = cur[s + 2]; px[d + 3] = bpp === 4 ? cur[s + 3] : 255; }
    const t = prev; prev = cur; cur = t;
  }
  return { w, h, px };
}
function diffImages(A, B, tol) {
  let n = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
    const k = 4 * (y * A.w + x);
    if (Math.abs(A.px[k] - B.px[k]) > (tol || 0) || Math.abs(A.px[k + 1] - B.px[k + 1]) > (tol || 0) || Math.abs(A.px[k + 2] - B.px[k + 2]) > (tol || 0)) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { n, box: n ? { x0, y0, x1: x1 + 1, y1: y1 + 1 } : null };
}

/* ---- the lattice and the screen ---- */
const R3 = Math.sqrt(3);
// a rules point [X, p, q]: x = X / 2, y = (p + q·√3) / 2
const ptOf = v => [v[0] / 2, (v[1] + v[2] * R3) / 2];
// A similarity (turn, scale, shift; the screen's y runs down) fitted to world -> screen point pairs by least squares:
// {map([x, y]) -> [sx, sy], inv([sx, sy]) -> [x, y], resid: the largest miss in px, scale: px per L, rot}
function fitSim(world, screen) {
  const n = world.length;
  if (n < 2) return null;
  // world (x, y) -> complex x − i·y, screen (sx, sy) -> sx + i·sy; screen = c·w + t
  let mwx = 0, mwy = 0, msx = 0, msy = 0;
  for (let k = 0; k < n; k++) { mwx += world[k][0]; mwy += -world[k][1]; msx += screen[k][0]; msy += screen[k][1]; }
  mwx /= n; mwy /= n; msx /= n; msy /= n;
  let nr = 0, ni = 0, d = 0;
  for (let k = 0; k < n; k++) {
    const ax = world[k][0] - mwx, ay = -world[k][1] - mwy, bx = screen[k][0] - msx, by = screen[k][1] - msy;
    nr += bx * ax + by * ay; ni += by * ax - bx * ay; d += ax * ax + ay * ay;
  }
  if (d < 1e-12) return null;
  const cr = nr / d, ci = ni / d, tx = msx - (cr * mwx - ci * mwy), ty = msy - (cr * mwy + ci * mwx);
  const map = p => { const x = p[0], y = -p[1]; return [cr * x - ci * y + tx, cr * y + ci * x + ty]; };
  const s2 = cr * cr + ci * ci;
  const inv = q => { const x = q[0] - tx, y = q[1] - ty; return [(cr * x + ci * y) / s2, -((cr * y - ci * x) / s2)]; };
  let resid = 0;
  for (let k = 0; k < n; k++) { const m = map(world[k]); resid = Math.max(resid, Math.hypot(m[0] - screen[k][0], m[1] - screen[k][1])); }
  return { map, inv, resid, scale: Math.sqrt(s2), rot: Math.atan2(ci, cr) };
}
// An affine map fitted to world -> screen point pairs by least squares (at least three points, not on a line): the
// tower as drawn is one (its sway, its landing squash and its rock compose to one), {map, resid}
function fitAffine(world, screen) {
  const n = world.length;
  if (n < 3) return null;
  // normal equations for [x y 1]·[a b c]ᵀ = sx and the same for sy
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bx = [0, 0, 0], by = [0, 0, 0];
  for (let k = 0; k < n; k++) {
    const v = [world[k][0], world[k][1], 1];
    for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) M[i][j] += v[i] * v[j]; bx[i] += v[i] * screen[k][0]; by[i] += v[i] * screen[k][1]; }
  }
  const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  if (Math.abs(D) < 1e-9) return null;
  const solve = b => [0, 1, 2].map(c => det(M.map((row, i) => row.map((v, j) => (j === c ? b[i] : v)))) / D);
  const X = solve(bx), Yc = solve(by);
  const map = p => [X[0] * p[0] + X[1] * p[1] + X[2], Yc[0] * p[0] + Yc[1] * p[1] + Yc[2]];
  let resid = 0;
  for (let k = 0; k < n; k++) { const m = map(world[k]); resid = Math.max(resid, Math.hypot(m[0] - screen[k][0], m[1] - screen[k][1])); }
  return { map, resid, scale: Math.sqrt(Math.abs(X[0] * Yc[1] - X[1] * Yc[0])) };
}
// the largest distance from a point of A to the nearest point of B, both ways (polygons as vertex lists)
function polyDist(A, B) {
  if (!A || !B || !A.length || !B.length) return Infinity;
  const one = (P, Q) => { let m = 0; for (const p of P) { let b = Infinity; for (const q of Q) b = Math.min(b, Math.hypot(p[0] - q[0], p[1] - q[1])); m = Math.max(m, b); } return m; };
  return Math.max(one(A, B), one(B, A));
}
function inPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const boxIn = (a, b, tol) => a.x0 >= b.x0 - tol && a.y0 >= b.y0 - tol && a.x1 <= b.x1 + tol && a.y1 <= b.y1 + tol;
const boxHit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/* ---- reporting: one line per check, a summary with the time taken ---- */
function reporter(title) {
  const R = { title, n: 0, bad: 0, t0: Date.now(), fails: [] };
  R.check = (cond, msg) => { R.n++; if (!cond) { R.bad++; R.fails.push(msg); } console.log((cond ? '  ok   ' : '  FAIL ') + msg); return !!cond; };
  R.info = msg => console.log('       ' + msg);
  R.done = () => {
    const s = ((Date.now() - R.t0) / 1000).toFixed(1);
    console.log(`${title}: ${R.bad ? R.bad + ' of ' + R.n + ' checks FAILED' : 'all ' + R.n + ' checks passed'} (${s} s)`);
    process.exitCode = R.bad ? 1 : 0;
    return R.bad;
  };
  return R;
}
// a deterministic random stream
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

module.exports = { SIZES, sizesFrom, argOf, PLAYED, GAMEFILE, pageRules, open, makeInput, frame, display, state, step, wait,
  keepPixels, diffPixels, diffOutside, changedNear, gameUrl: lib.gameUrl, decodePNG, diffImages, R3, ptOf, fitSim, fitAffine, polyDist, inPoly, boxIn, boxHit, reporter, rng,
  launch: lib.launch, sleep: lib.sleep, until: lib.until };
