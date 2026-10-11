#!/usr/bin/env node
'use strict';
// Screenshots of the title and of play (a few real mouse drops, ghost showing) at the reference sizes.
//   node clack-stack/tools/shots.cjs [outDir]     (default: <tmp>/clack-stack-shots)
// Fails on page errors / console errors, if the page scrolls, if the hand (at the centre or 3.5 L to either side)
// sits under an opaque HUD box, or if the goal ribbon runs through the tile in the hand.
const path = require('path');
const fs = require('fs');
const { launch, gamePage, until } = require('./lib.cjs');

const SIZES = [[390, 844], [844, 390], [1366, 1024], [360, 740], [667, 375]];
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
// layout at the start of play: hand vs HUD boxes, ribbon vs the held tile
async function layoutCheck(page, w, h) {
  const g = await page.evaluate(() => ({ cam: CS.cam(), ui: CS.ui(), st: CS.state() }));
  const L = g.cam.L, out = [];
  for (const off of [0, -3.5, 3.5]) {
    const hx = g.cam.originX + off * L;
    if (hx < 0 || hx > w) continue;
    const hand = { x: hx - 0.36 * L, y: g.cam.handY - 0.72 * L, w: 0.72 * L, h: 0.84 * L };   // cuff to fingertips
    for (const k of ['pause', 'mute', 'next', 'hold', 'clock']) if (g.ui[k] && overlap(hand, g.ui[k])) out.push(`hand at ${off} L under ${k}`);
  }
  const ribbonY = g.cam.baseY - (g.st.goal + 0.5) * L, tileBottom = g.cam.handY + L;
  if (ribbonY < tileBottom + 0.2 * L) out.push(`ribbon at y ${ribbonY.toFixed(0)} runs through the held tile (bottom ${tileBottom.toFixed(0)})`);
  return out;
}
const out = path.resolve(process.argv[2] || path.join(require('os').tmpdir(), 'clack-stack-shots'));

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await launch();
  let bad = 0;
  try {
    for (const [w, h] of SIZES) {
      // title
      {
        const { page, errors, context } = await gamePage(browser, { width: w, height: h }, { seed: 3, mute: 1 });
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(out, `title-${w}x${h}.png`) });
        if (errors.length) { bad++; console.log(errors.join('\n')); }
        await context.close();
      }
      // play: drop a handful of tiles with the mouse, then hover a slot so the ghost shows
      {
        const { page, errors, context } = await gamePage(browser, { width: w, height: h }, { seed: 3, mute: 1, autostart: 1, nohint: 1 });
        await until(page, () => window.CS && CS.state().handReady);
        const lay = await layoutCheck(page, w, h);
        if (lay.length) { bad++; console.log(`layout ${w}x${h}: ` + lay.join('; ')); }
        await page.screenshot({ path: path.join(out, `start-${w}x${h}.png`) });
        // (M4: a level can end in a SMASH on the way; every drop waits for play on a parked base)
        const ready = () => until(page, () => { const s = CS.state(); return s.phase === 'play' && !s.locked && s.handReady; });
        for (let k = 0; k < 9; k++) {
          await ready();
          const slots = await page.evaluate(() => CS.slots().filter(s => s.supported));
          if (!slots.length) break;
          const s = slots[(k * 7) % slots.length];
          await page.mouse.move(s.sx, h * 0.5);
          await page.mouse.down(); await page.mouse.up();
          await page.waitForTimeout(260);
        }
        await until(page, () => { const s = CS.state(); return s.phase === 'play' && !s.locked && s.handReady && s.inAir === 0; });
        const slots = await page.evaluate(() => CS.slots().filter(s => s.supported));
        const s = slots[0];
        await page.mouse.move(s.sx + 3, h * 0.5);
        await page.waitForTimeout(150);
        const dims = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight }));
        if (dims.sw > dims.iw || dims.sh > dims.ih) { bad++; console.log('page scrolls', dims); }
        await page.screenshot({ path: path.join(out, `play-${w}x${h}.png`) });
        // mid-clack frame: drop and grab the frame right after landing
        await page.mouse.down(); await page.mouse.up();
        await until(page, () => { const l = CS.events.filter(e => e.type === 'land').pop(); return l && CS.state().t - l.t < 0.05 && CS.state().t >= l.t; });
        await page.screenshot({ path: path.join(out, `clack-${w}x${h}.png`) });
        if (errors.length) { bad++; console.log(errors.join('\n')); }
        await context.close();
      }
      console.log('shots', w + 'x' + h);
    }
  } finally {
    await browser.close();
  }
  console.log('wrote', out);
  process.exitCode = bad ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
