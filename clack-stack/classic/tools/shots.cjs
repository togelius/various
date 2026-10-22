#!/usr/bin/env node
'use strict';
// Screenshots of the title and of play (a few real mouse drops, ghost showing) at the reference sizes.
//   node clack-stack/tools/shots.cjs [outDir]     (default: <tmp>/clack-stack-shots)
// Fails on page errors / console errors, if the page scrolls, if the hand (at the centre or 3.5 L to either side)
// sits under an opaque HUD box, or if the goal ribbon runs through the tile in the hand; if the first-run hint's words
// ever cover the ghost (the hand swept over every slot); and if the word pops break the rules (one pop per landing:
// at most two alive, each living <= 0.6 s, never drawn over the ghost (unless see-through because the aim moved
// under it) and never born over the build top; settled, no word or announcement sits over a HUD box or over
// another pop still up). And the composition at the start of every level L1-L10 (390x844 and 844x390): after three
// tiles the air between the tile in the hand and the build top is at most 3.5 L (the hand hovers over the build, the
// action in the middle of the screen, not a small tower at the bottom of an empty screen), and the ribbon, where it is
// drawn, never runs through the tile in the hand.
const path = require('path');
const fs = require('fs');
const { launch, gamePage, until, wordMonitor } = require('./lib.cjs');

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
// the composition at the start of a level: three tiles dropped (real clicks) on the centred square slots
async function compoCheck(browser, w, h, level) {
  const { page, errors, context } = await gamePage(browser, { width: w, height: h }, { seed: 4, mute: 1, autostart: 1, nohint: 1, level });
  const ready = () => until(page, () => { const s = CS.state(); return s.phase === 'play' && !s.locked && s.handReady && s.inAir === 0; });
  for (let k = 0; k < 3; k++) {
    await ready();
    const sl = await page.evaluate(() => CS.slots().filter(q => q.supported && q.type === 'sq').sort((a, b) => Math.abs(a.x) - Math.abs(b.x))[0] || CS.slots()[0]);
    if (!sl) break;
    await page.mouse.move(sl.sx, h * 0.5); await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(300);
  }
  await ready();
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => {
    const c = CS.cam(), s = CS.state(), rb = CS.ribbon(), L = c.L, topY = c.baseY - (s.top + 0.5) * L, held = c.handY + L;
    return { L: +L.toFixed(1), air: (topY - held) / L, top: s.top, G: s.goal, handY: Math.round(c.handY), ribbon: rb.on ? Math.round(rb.y) : null, held: Math.round(held), handTop: c.handTop };
  });
  const bad = [];
  if (r.air > 3.5) bad.push(`${w}x${h} L${level}: ${r.air.toFixed(1)} L of air between the tile in the hand and the build (top ${r.top.toFixed(1)}, G ${r.G}, hand ${r.handY}, handTop ${r.handTop})`);
  if (r.ribbon !== null && r.ribbon > r.handY - 0.2 * r.L && r.ribbon < r.held + 0.2 * r.L) bad.push(`${w}x${h} L${level}: the ribbon (y ${r.ribbon}) runs through the tile in the hand (${r.handY}-${r.held})`);
  if (errors.length) bad.push(errors.join(' | '));
  await context.close();
  return { bad, r };
}
const hitBox = (a, b) => !!a && !!b && a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
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
        await page.evaluate(wordMonitor);
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
        await page.waitForTimeout(700);
        const wv = await page.evaluate(() => window.__wv);
        if (wv.bad.length) { bad++; console.log(`word pops ${w}x${h}: ` + wv.bad.join('; ')); }
        else console.log(`word pops ${w}x${h}: ${wv.n} pops, at most ${wv.maxAlive} alive, none over the ghost or the build top`);
        if (errors.length) { bad++; console.log(errors.join('\n')); }
        await context.close();
      }
      // the first-run hint: its words never cover the ghost, wherever the hand aims (it sweeps over every slot)
      {
        const { page, errors, context } = await gamePage(browser, { width: w, height: h }, { seed: 3, mute: 1, autostart: 1 });
        await until(page, () => window.CS && CS.state().handReady && !CS.state().locked);
        const slots = await page.evaluate(() => CS.slots());
        const xs = [w / 2].concat(slots.map((s) => s.sx));
        let worst = null, n = 0;
        for (const x of xs) {
          await page.mouse.move(x, h * 0.5);
          for (let k = 0; k < 6; k++) {
            await page.waitForTimeout(110);
            const r = await page.evaluate(() => ({ hint: CS.hint(), ghost: CS.ghost() }));
            if (!r.hint) continue;
            n++;
            if (r.ghost && r.ghost.box && hitBox(r.hint.label, r.ghost.box)) worst = { label: r.hint.label, ghost: r.ghost.box, at: x };
          }
        }
        await page.screenshot({ path: path.join(out, `hint-${w}x${h}.png`) });
        if (!n) { bad++; console.log(`hint ${w}x${h}: no hint shown`); }
        else if (worst) { bad++; console.log(`hint ${w}x${h}: the words cover the ghost ` + JSON.stringify(worst)); }
        else console.log(`hint ${w}x${h}: ${n} samples, the words never cover the ghost`);
        if (errors.length) { bad++; console.log(errors.join('\n')); }
        await context.close();
      }
      console.log('shots', w + 'x' + h);
    }
    for (const [w, h] of [[390, 844], [844, 390]]) {
      const airs = [];
      for (let level = 1; level <= 10; level++) {
        const c = await compoCheck(browser, w, h, level);
        airs.push(`L${level} ${c.r.air.toFixed(1)}`);
        if (c.bad.length) { bad++; console.log('composition ' + c.bad.join('; ')); }
      }
      console.log(`composition ${w}x${h}: air (L) between the tile in the hand and the build after 3 tiles: ${airs.join(', ')}`);
    }
  } finally {
    await browser.close();
  }
  console.log('wrote', out);
  process.exitCode = bad ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
