#!/usr/bin/env node
'use strict';
// M5 / M8 acceptance (DESIGN.md 14): performance, the FPS watchdog, per-frame allocation, reduced motion.
//   node clack-stack/tools/perf.cjs [--only=jsms,watchdog,alloc,reduced]
// Checks:
//   jsms      with a 15 L tower (built by real clicks, BIG MAGNETS so it stands) and 60 debris spawned (the cap keeps
//             52-60 of them: the oldest fade out as the cap nears), CS.perf().jsMs
//             averages 8 ms or less over 5 s in headless Chromium (390x844 and 1366x1024)
//   watchdog  with the CPU throttled (frames over 22 ms for 2 s) the watchdog drops the stained-glass light pass, and
//             2 s later the gloss; a normal machine keeps both
//   alloc     steady play (a tower standing, the hand still, debris asleep): the sampled JS allocation per frame
//             stays small: under 48 KB a frame. (What is left is V8 boxing numbers at canvas API calls and in
//             unoptimised code; the draw path builds no objects, arrays, closures, gradients or strings per frame:
//             options objects, font strings, HUD strings and gradients are all reused or cached.)
//   reduced   prefers-reduced-motion: a crash has no slow motion and its shake is half the size
// Exits non-zero on any failure, page error or console error.
const { launch, gamePage, until } = require('./lib.cjs');

const argv = process.argv.slice(2);
const ONLY = (argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = n => !ONLY.length || ONLY.includes(n);
let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
}
const errorsAll = [];
async function gameWait(page, dt) {
  const t0 = await page.evaluate(() => CS.state().t);
  await until(page, t => CS.state().t >= t, t0 + dt, 120000);
}
// a calm builder (PerfectBot's rule, tools/bots.cjs): the PERFECT centre of the slot that keeps |cx| smallest, not
// TIPPY, supported if one is; real clicks; it waits for the tower to calm down between drops
const MASS = { sq: 1, marble: 1, tri: 0.45, crown: 0.45, cube: 3 };
async function buildTo(page, top, maxTaps) {
  const h = page.viewportSize().height;
  for (let k = 0; k < (maxTaps || 200); k++) {
    await until(page, () => { const s = CS.state(); return s.phase === 'play' && s.handReady && !s.locked && s.inAir === 0; }, null, 30000);
    await until(page, () => { const s = CS.state(); return (Math.abs(s.omega) < 0.02 && Math.abs(s.flexV) < 0.12) || s.t >= s.readyAt + 0.8; }, null, 8000).catch(() => {});
    const st = await page.evaluate(() => CS.state());
    if (st.top >= top) return st;
    const p = await page.evaluate(m => {
      const st = CS.state(), mass = m[st.piece] || 1, sl = CS.slots().filter(s => !s.tippy);
      const after = s => Math.abs((st.M * st.com.x + mass * s.lx) / (st.M + mass));
      const sup = sl.filter(s => s.supported), pool = sup.length ? sup : sl;
      pool.sort((a, b) => after(a) - after(b) || b.ly - a.ly);
      return pool[0] || null;
    }, MASS);
    if (!p) {
      // no slot for this tile: swap it with the held one; if that one has none either (a top of triangle apexes and
      // squares in both: BIG MAGNETS has no fuse to drop it), throw it away at the screen edge (a MISS)
      await page.keyboard.press('Shift'); await page.waitForTimeout(30);
      if (!(await page.evaluate(() => CS.slots().length))) { await page.mouse.move(3, h * 0.5); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(30); }
      continue;
    }
    await page.mouse.move(p.sx, h * 0.5); await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(20);
  }
  return page.evaluate(() => CS.state());
}
async function tallTower(browser, view) {
  const g = await gamePage(browser, view, { seed: 9, ts: 8, big: 1, level: 13, autostart: 1, mute: 1, nohint: 1 });
  await until(g.page, () => window.CS && CS.state().phase === 'play' && CS.state().handReady, null, 15000);
  const st = await buildTo(g.page, 15);
  return { g, st };
}

(async () => {
  const browser = await launch();
  try {
    if (want('jsms')) {
      for (const view of [{ width: 390, height: 844 }, { width: 1366, height: 1024 }]) {
        const { g, st } = await tallTower(browser, view);
        const { page } = g;
        // 60 debris pieces on the rug beside it (the test hook)
        await page.evaluate(() => {
          const sh = ['sq', 'tri', 'sq', 'cube', 'sq'], cols = Art.TILE_COLORS;
          for (let i = 0; i < 60; i++) CS.spawnDebris({ shape: sh[i % 5], color: cols[i % 7], x: (i % 2 ? 1 : -1) * (2 + (i % 13) * 0.25), y: 0.2 + (i % 3) * 0.6, rot: i, vx: 0, vy: 0, w: 0 });
          PARAM.ts = 1;
        });
        await page.waitForTimeout(1500);
        const samples = [];
        for (let i = 0; i < 25; i++) { await page.waitForTimeout(200); samples.push(await page.evaluate(() => CS.perf().jsMs)); }
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length, s2 = await page.evaluate(() => ({ st: CS.state(), perf: CS.perf() }));
        check(`jsms ${view.width}x${view.height}: a ${st.top.toFixed(1)} L tower + ${s2.st.debris} debris: jsMs averages <= 8 ms over 5 s`, st.top >= 15 && s2.st.debris >= 50 && avg <= 8,
          `avg ${avg.toFixed(2)} ms, max sample ${Math.max(...samples).toFixed(2)}, ${s2.st.tiles} tiles, light pass ${s2.perf.lightPass}`);
        errorsAll.push(...g.errors); await g.context.close();
      }
    }
    if (want('watchdog')) {
      const g = await gamePage(browser, { width: 390, height: 844 }, { seed: 4, autostart: 1, mute: 1, nohint: 1 });
      const { page } = g;
      await until(page, () => window.CS && CS.state().phase === 'play' && CS.state().handReady, null, 15000);
      await page.waitForTimeout(2500);
      const before = await page.evaluate(() => CS.perf());
      check('watchdog: a normal machine keeps the light pass and the gloss', before.lightPass && before.gloss, JSON.stringify(before));
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 30 });
      let a = null, b = null;
      const t0 = Date.now();
      while (Date.now() - t0 < 30000) {
        await page.waitForTimeout(250);
        const p = await page.evaluate(() => CS.perf());
        if (!p.lightPass && !a) a = { at: Date.now() - t0, p };
        if (!p.gloss && !b) { b = { at: Date.now() - t0, p }; break; }
      }
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      const ev = await page.evaluate(() => CS.events.filter(e => e.type === 'watchdog'));
      check('watchdog: slow frames (CPU throttled) drop the light pass first, then the gloss', !!a && !!b && ev.length === 2 && !ev[0].lightPass && ev[0].gloss && !ev[1].gloss,
        a ? `light pass off after ${(a.at / 1000).toFixed(1)} s (${a.p.frameMs.toFixed(0)} ms frames), gloss off ${b ? 'after ' + (b.at / 1000).toFixed(1) + ' s' : 'never'}` : 'never dropped');
      errorsAll.push(...g.errors); await g.context.close();
    }
    if (want('alloc')) {
      const g = await gamePage(browser, { width: 390, height: 844 }, { seed: 5, ts: 4, autostart: 1, mute: 1, nohint: 1, level: 3 });
      const { page } = g;
      await until(page, () => window.CS && CS.state().phase === 'play' && CS.state().handReady, null, 15000);
      await buildTo(page, 4, 40);
      await page.evaluate(() => { PARAM.ts = 1; });
      await page.mouse.move(195, 300);
      await until(page, () => { const s = CS.state(); return s.still && s.debrisAwake === 0 && s.inAir === 0; }, null, 20000).catch(() => {});
      await page.waitForTimeout(1500);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('HeapProfiler.enable');
      const f0 = await page.evaluate(() => S.frame);
      await cdp.send('HeapProfiler.startSampling', { samplingInterval: 1024, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
      await page.waitForTimeout(3000);
      const { profile } = await cdp.send('HeapProfiler.stopSampling');
      const f1 = await page.evaluate(() => S.frame);
      // the samples' sizes are the bytes allocated (each sample stands for samplingInterval bytes on average)
      let bytes = 0;
      const top = [];
      (function walk(n) { const s = n.selfSize || 0; bytes += s; if (s) top.push([s, n.callFrame.functionName + ':' + n.callFrame.lineNumber]); for (const c of n.children || []) walk(c); })(profile.head);
      const perFrame = bytes / Math.max(1, f1 - f0);
      top.sort((x, y) => y[0] - x[0]);
      check("alloc: steady play allocates under 48 KB of JS a frame (number boxing at canvas calls; no object, array, closure or string garbage left in the draw path)", perFrame < 48 * 1024,
        `${(perFrame / 1024).toFixed(2)} KB/frame over ${f1 - f0} frames; most: ${top.slice(0, 25).map(t => t[1] + ' ' + (t[0] / 1024).toFixed(0) + ' KB').join(', ')}`);
      errorsAll.push(...g.errors); await g.context.close();
    }
    if (want('reduced')) {
      for (const reduce of [false, true]) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduce ? 'reduce' : 'no-preference' });
        await context.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push('pageerror: ' + e.message));
        page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
        await page.goto(require('./lib.cjs').gameUrl({ seed: 1, ts: 2, level: 3, autostart: 1, mute: 1, nohint: 1 }));
        await until(page, () => window.CS && CS.state().phase === 'play' && CS.state().handReady, null, 15000);
        await page.evaluate(() => { window.__slow = false; window.__shake = 0; (function f() { const s = CS.state(); if (s.slow) window.__slow = true; if (S.phase === 'crash') window.__shake = Math.max(window.__shake, FX.shakeAmp); requestAnimationFrame(f); })(); });
        // EdgeBot: the rightmost slot every time, until it crashes
        for (let k = 0; k < 40; k++) {
          await until(page, () => { const s = CS.state(); return (s.phase === 'play' && s.handReady && !s.locked) || s.crashes > 0; }, null, 20000);
          if (await page.evaluate(() => CS.state().crashes > 0)) break;
          const p = await page.evaluate(() => { const sl = CS.slots(); sl.sort((a, b) => b.x - a.x); return sl[0] || null; });
          await page.mouse.move(p ? p.sx : 3, 422); await page.mouse.down(); await page.mouse.up();
          await page.waitForTimeout(80);
        }
        await gameWait(page, 1.0);
        const r = await page.evaluate(() => ({ crashes: CS.state().crashes, slow: window.__slow, shake: window.__shake }));
        if (reduce) check('reduced: prefers-reduced-motion: a crash has no slow motion and half the shake', r.crashes > 0 && !r.slow && Math.abs(r.shake - 7) < 0.01, JSON.stringify(r));
        else check('reduced: without it, a crash has its slow motion and its full 14 px shake', r.crashes > 0 && r.slow && Math.abs(r.shake - 14) < 0.01, JSON.stringify(r));
        errorsAll.push(...errors); await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  check('no page or console errors', errorsAll.length === 0, errorsAll.slice(0, 3).join(' | '));
  console.log(failures ? `PERF: ${failures} check(s) failed` : 'PERF: all checks passed');
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
