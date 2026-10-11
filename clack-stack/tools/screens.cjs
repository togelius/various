#!/usr/bin/env node
'use strict';
// Screenshots of every screen, to LOOK at (portrait and landscape): the title (and BIG MAGNETS on), the shove, play,
// the crown in hand, OVERTIME, the SMASH, the level announcement, pause, a bump warning, the foot, the tall-tower
// gauge, night (L15), TIME! and the results card with a NEW BEST. Driven by real input; CS.setClock ends runs.
//   node clack-stack/tools/screens.cjs [outDir] [--sizes=390x844,844x390]
// Writes outDir/<size>/NN-name.png and outDir/sheet-<size>.png. Fails on page or console errors.
const path = require('path');
const fs = require('fs');
const { launch, gamePage, until } = require('./lib.cjs');

const argv = process.argv.slice(2);
const out = path.resolve(argv.find(a => !a.startsWith('--')) || path.join(require('os').tmpdir(), 'clack-screens'));
const SIZES = ((argv.find(a => a.startsWith('--sizes=')) || '--sizes=390x844,844x390').slice(8)).split(',').map(s => s.split('x').map(Number));
let bad = 0;

async function ready(page) { await until(page, () => { const s = CS.state(); return s.phase === 'play' && s.handReady && !s.locked && s.inAir === 0; }, null, 20000); }
async function gameT(page, dt) { const t0 = await page.evaluate(() => CS.state().t); await until(page, t => CS.state().t >= t, t0 + dt, 20000); }
// tap the PERFECT centre of the supported slot that keeps the tower centred (highest first when tall=true)
async function drop(page, H, tall, noHold) {
  await ready(page);
  const s = await page.evaluate(tall => {
    const st = CS.state(), sl = CS.slots().filter(q => q.supported && !q.tippy);
    if (st.piece === 'crown') return 'crown';                // the caller places (or banks) the crown itself
    const m = { sq: 1, marble: 1, tri: 0.45, crown: 0.45, cube: 3 }[st.piece] || 1;
    const after = q => Math.abs((st.M * st.com.x + m * q.lx) / (st.M + m));
    sl.sort((a, b) => tall ? (b.ly - a.ly) * 0.3 + after(a) - after(b) : after(a) - after(b) || a.ly - b.ly);
    return sl[0] || null;
  }, !!tall);
  if (s === 'crown') return;
  if (!s) { if (noHold) { await page.mouse.move(3, H * 0.55); await page.mouse.down(); await page.mouse.up(); } else await page.keyboard.press('Shift'); return; }
  await until(page, () => Math.abs(CS.state().omega) < 0.03, null, 1500).catch(() => {});
  const x = await page.evaluate(k => (CS.slots().find(q => q.key === k) || {}).sx, s.key);
  await page.mouse.move(x || s.sx, H * 0.55); await page.mouse.down(); await page.mouse.up();
}

(async () => {
  const browser = await launch();
  try {
    for (const [W, H] of SIZES) {
      const dir = path.join(out, `${W}x${H}`);
      fs.mkdirSync(dir, { recursive: true });
      const files = [];
      const shot = async (page, name) => { const f = path.join(dir, `${String(files.length).padStart(2, '0')}-${name}.png`); await page.screenshot({ path: f }); files.push(f); };
      // 1. title, BIG MAGNETS on, the shove, play
      {
        const { page, errors, context } = await gamePage(browser, { width: W, height: H }, { seed: 3, mute: 1 }, { realClock: true });
        await page.waitForTimeout(500);
        await shot(page, 'title');
        const u = await page.evaluate(() => CS.ui());
        await page.mouse.click(u.big.x + u.big.w / 2, u.big.y + u.big.h / 2);
        await page.waitForTimeout(150);
        await shot(page, 'title-big');
        await page.mouse.click(u.big.x + u.big.w / 2, u.big.y + u.big.h / 2);
        await page.evaluate(() => { PARAM.ts = 0.25; });
        await page.mouse.click(W / 2, H * 0.45);
        await until(page, () => CS.state().phase === 'start' && S.gt - ST.t0 > 0.19, null, 5000);
        await shot(page, 'shove');
        await until(page, () => CS.state().startHit && S.gt - ST.t0 > 0.36, null, 5000);
        await shot(page, 'burst');
        await page.evaluate(() => { PARAM.ts = 1; });
        await until(page, () => CS.state().phase === 'play' && !CS.state().locked, null, 5000);
        await page.waitForTimeout(400);
        await shot(page, 'play-start');
        if (errors.length) { bad++; console.log(errors.join('\n')); }
        await context.close();
      }
      // 2. a level played through: the crown, OVERTIME, the crown placed, the SMASH, the level announced, pause
      {
        const { page, errors, context } = await gamePage(browser, { width: W, height: H }, { seed: 4, mute: 1, nohint: 1, autostart: 1, ts: 2 }, { realClock: true });
        await ready(page);
        for (let k = 0; k < 40 && !(await page.evaluate(() => CS.state().crownInHand)); k++) await drop(page, H, true, true);
        await page.evaluate(() => { PARAM.ts = 1; });
        await ready(page);
        await page.mouse.move(W / 2 + 10, H * 0.55);
        await page.waitForTimeout(250);
        await shot(page, 'crown-in-hand');
        await page.keyboard.press('Shift');
        await page.evaluate(() => { PARAM.ts = 2; });
        for (let k = 0; k < 2; k++) await drop(page, H, true, true);
        await ready(page);
        await page.evaluate(() => { PARAM.ts = 1; });
        await page.waitForTimeout(200);
        await shot(page, 'overtime');
        await page.keyboard.press('Shift');
        await ready(page);
        const sl = await page.evaluate(() => CS.slots().sort((a, b) => b.ly - a.ly)[0]);
        await page.evaluate(() => { PARAM.ts = 0.35; });
        await page.mouse.move(sl.sx, H * 0.55); await page.mouse.down(); await page.mouse.up();
        await until(page, () => CS.state().phase === 'smash', null, 8000);
        await until(page, () => CS.state().smashStage === 'shove', null, 8000);
        await shot(page, 'smash-cube');
        await until(page, () => CS.state().smashStage === 'hit', null, 8000);
        await page.waitForTimeout(500);
        await shot(page, 'smash');
        await until(page, () => CS.events.some(e => e.type === 'level'), null, 8000);
        await page.waitForTimeout(500);
        await shot(page, 'level-2');
        await page.evaluate(() => { PARAM.ts = 1; });
        await until(page, () => CS.state().phase === 'play', null, 8000);
        await page.keyboard.press('p');
        await page.waitForTimeout(150);
        await shot(page, 'pause');
        await page.keyboard.press('p');
        // TIME! and the results card (a new best on a fresh profile)
        await page.evaluate(() => CS.setClock(0.2));
        await until(page, () => CS.state().phase === 'over', null, 5000);
        await page.waitForTimeout(250);
        await shot(page, 'time');
        await until(page, () => CS.state().over && CS.state().over.open, null, 5000);
        await page.waitForTimeout(800);
        await shot(page, 'results-new-best');
        if (errors.length) { bad++; console.log(errors.join('\n')); }
        await context.close();
      }
      // 3. hazards on L8: the bump car's warning, the bump, the foot
      {
        const { page, errors, context } = await gamePage(browser, { width: W, height: H }, { seed: 36, mute: 1, nohint: 1, autostart: 1, ts: 4, level: 8 });
        await ready(page);
        for (let k = 0; k < 5; k++) await drop(page, H, false);
        await until(page, () => { const h = CS.state().hazard; return h.warned && h.kind === 'bump'; }, null, 30000);
        await page.evaluate(() => { PARAM.ts = 1; });
        await page.waitForTimeout(250);
        await shot(page, 'bump-warning');
        await until(page, () => CS.state().hazard.inS < 0.2 || CS.state().hazard.kind === 'foot', null, 5000);
        await shot(page, 'bump-car');
        await page.evaluate(() => { PARAM.ts = 4; });
        await until(page, () => { const h = CS.state().hazard; return h.kind === 'foot' && h.warned; }, null, 30000);
        await page.evaluate(() => { PARAM.ts = 1; });
        await page.waitForTimeout(700);
        await shot(page, 'foot-shadow');
        await until(page, () => CS.events.some(e => e.type === 'foot'), null, 5000);
        await page.waitForTimeout(60);
        await shot(page, 'foot-stomp');
        if (errors.length) { bad++; console.log(errors.join('\n')); }
        await context.close();
      }
      // 4. past the zoom floor the gauge shows; a tall enough tower scrolls the camera (landscape: L6, portrait: L13)
      {
        const { page, errors, context } = await gamePage(browser, { width: W, height: H }, { seed: 7, mute: 1, nohint: 1, autostart: 1, ts: 4, level: W > H ? 6 : 13 });
        await ready(page);
        for (let k = 0; k < 40; k++) {
          const st = await page.evaluate(() => ({ top: CS.state().top, cam: CS.cam(), crashes: CS.state().crashes }));
          if (st.cam.camY > 30 || st.crashes || st.top >= 9) break;
          await drop(page, H, true);
        }
        await ready(page);
        await page.evaluate(() => { PARAM.ts = 1; });
        await page.waitForTimeout(500);
        await shot(page, 'gauge-scroll');
        if (errors.length) { bad++; console.log(errors.join('\n')); }
        await context.close();
      }
      // 5. night (L15)
      {
        const { page, errors, context } = await gamePage(browser, { width: W, height: H }, { seed: 34, mute: 1, nohint: 1, autostart: 1, ts: 4, level: 15 });
        await ready(page);
        for (let k = 0; k < 10; k++) await drop(page, H, false);
        await ready(page);
        await page.evaluate(() => { PARAM.ts = 1; });
        await page.waitForTimeout(300);
        await shot(page, 'night-L15');
        if (errors.length) { bad++; console.log(errors.join('\n')); }
        await context.close();
      }
      // contact sheet
      const cols = W > H ? 3 : 6, tw = Math.round(W / (W > H ? 2.2 : 2.6)), th = Math.round(tw * H / W);
      const html = `<html><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:3px">` +
        files.map(f => `<div style="position:relative"><img src="file://${f}" style="width:${tw}px;height:${th}px;display:block"><div style="position:absolute;left:2px;top:2px;font:11px sans-serif;color:#fff;background:#000a">${path.basename(f, '.png')}</div></div>`).join('') + '</body></html>';
      const hp = path.join(out, `sheet-${W}x${H}.html`);
      fs.writeFileSync(hp, html);
      const sp = await browser.newPage({ viewport: { width: cols * (tw + 3), height: Math.ceil(files.length / cols) * (th + 3) } });
      await sp.goto('file://' + hp); await sp.waitForTimeout(300);
      await sp.screenshot({ path: path.join(out, `sheet-${W}x${H}.png`) });
      await sp.close();
      console.log(`screens ${W}x${H}: ${files.length}`);
    }
  } finally {
    await browser.close();
  }
  console.log('wrote', out);
  process.exitCode = bad ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
