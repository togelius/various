#!/usr/bin/env node
'use strict';
// Frame sequences of a crash, to LOOK at (DESIGN.md 8: freeze, slow motion, cartwheeling pile, new car).
// Builds by real taps (rightmost slot after a centred start, so the tower gets some height first; past it triangles
// are thrown away off the left edge), then grabs a
// screenshot every ~frame through the crash and lays them out on a contact sheet.
//   node clack-stack/tools/crashframes.cjs [outDir] [--seed=N] [--level=N] [--size=390x844] [--ts=0.5] [--tall=N]
// Writes outDir/frame-XX.png, outDir/sheet.png and outDir/settled.png (3 s after the crash). Fails on page errors or if no crash happens.
const path = require('path');
const fs = require('fs');
const { launch, gamePage, until } = require('./lib.cjs');

const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const out = path.resolve(argv.find(a => !a.startsWith('--')) || path.join(require('os').tmpdir(), 'clack-crash-frames'));
// (level 4 by default: the long car, the narrowest base without hazards since DESIGN 15.5 put two cars under level 3)
const seed = +opt('seed', 5), level = +opt('level', 4), ts = +opt('ts', 0.5), tall = +opt('tall', 6);
const [W, H] = opt('size', '390x844').split('x').map(Number);
const FRAMES = +opt('frames', 36);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await launch();
  let bad = 0;
  try {
    const { page, errors, context } = await gamePage(browser, { width: W, height: H }, { seed, ts: 4, level, mute: 1, nohint: 1, autostart: 1 });
    await until(page, () => window.CS && CS.state().handReady);
    // (a tip crash: the wobble of DESIGN 15.3 is off, a fixture, or the centred column would SNAP before it goes over;
    // tools/screens.cjs has the SNAP)
    await page.evaluate(() => { CFG.WOB_A = { perfect: 0, great: 0, clack: 0 }; CFG.WOB_CAP_THIN = 0; });
    // centred columns up to `tall` L, then the rightmost slot every time until it goes
    let crashed = false;
    for (let k = 0; k < 90 && !crashed; k++) {
      // (and nothing in the air: the tile that reaches the ribbon swaps the crown into the hand as it lands; with the
      // hand hovering above the ribbon the flights are long enough for a tap read before it to drop the crown)
      await until(page, () => { const s = CS.state(); return s.phase !== 'play' || (s.handReady && !s.locked && s.inAir === 0); }, null, 20000);
      const info = await page.evaluate(() => ({ st: CS.state(), sl: CS.slots() }));
      if (info.st.phase !== 'play' || info.st.crashes) break;
      // M4: past the ribbon the crown drops into the hand: bank it (OVERTIME) so the tower can go on and go over
      if (info.st.piece === 'crown' && info.st.held !== 'crown') { await page.keyboard.press('Shift'); continue; }
      if (!info.sl.length) { await page.keyboard.press('Shift'); continue; }
      let s;
      if (info.st.top < tall) {
        const m = { sq: 1, marble: 1, tri: 0.45, cube: 3 }[info.st.piece] || 1, st = info.st;
        const sup = info.sl.filter(q => q.supported && q.type !== 'up');
        const pool = sup.length ? sup : info.sl;
        s = pool.sort((a, b) => Math.abs((st.M * st.com.x + m * a.lx) / (st.M + m)) - Math.abs((st.M * st.com.x + m * b.lx) / (st.M + m)))[0];
      } else if (/tri/.test(info.st.piece)) s = { sx: 4 };   // (a triangle, held firm now, DESIGN 15.1, would cap the edge: thrown away)
      else s = info.sl.sort((a, b) => b.sx - a.sx)[0];
      // the last tile before it goes: slow the game right down so the frames catch the whole crash
      if (info.st.top >= tall && info.st.tip > 0.3) await page.evaluate(t => { PARAM.ts = t; }, ts);
      await page.mouse.move(s.sx, H * 0.55); await page.mouse.down(); await page.mouse.up();
      await page.waitForTimeout(30);
      const st2 = await page.evaluate(() => CS.state());
      if (st2.tip > 0.6) await page.evaluate(t => { PARAM.ts = t; }, ts);
      crashed = st2.crashes > 0 || st2.phase === 'crash';
      if (!crashed && st2.tip > 0.6) {
        try { await until(page, () => CS.state().phase === 'crash', null, 4000); crashed = true; } catch (e) { await page.evaluate(() => { PARAM.ts = 4; }); }
      }
    }
    if (!crashed) { console.log('no crash happened'); bad++; }
    else {
      // the moment of the crash, then frames as fast as screenshots allow
      const files = [];
      for (let i = 0; i < FRAMES; i++) {
        const f = path.join(out, `frame-${String(i).padStart(2, '0')}.png`);
        await page.screenshot({ path: f });
        const st = await page.evaluate(() => { const s = CS.state(); return `${s.phase} ${s.crashStage} t=${s.t.toFixed(2)} debris ${s.debris} awake ${s.debrisAwake}`; });
        files.push({ f, label: `${i}: ${st}` });
        await page.waitForTimeout(40);
      }
      // the pile once it has settled (3 s of game time after the crash)
      await page.evaluate(() => { PARAM.ts = 1; });
      const ct = await page.evaluate(() => (CS.events.filter(e => e.type === 'crash').pop() || { t: 0 }).t);
      await until(page, t => CS.state().t >= t, ct + 3, 20000);
      await page.screenshot({ path: path.join(out, 'settled.png') });
      // contact sheet
      const cols = 6, tw = Math.round(W / 3), th = Math.round(H / 3);
      const html = `<html><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:2px">` +
        files.map(x => `<div style="position:relative"><img src="file://${x.f}" style="width:${tw}px;height:${th}px;display:block">` +
          `<div style="position:absolute;left:2px;top:2px;font:10px sans-serif;color:#fff;background:#0008">${x.label}</div></div>`).join('') + '</body></html>';
      const hp = path.join(out, 'sheet.html');
      fs.writeFileSync(hp, html);
      const rows = Math.ceil(files.length / cols);
      const sheet = await browser.newPage({ viewport: { width: cols * (tw + 2), height: rows * (th + 2) } });
      await sheet.goto('file://' + hp);
      await sheet.waitForTimeout(300);
      await sheet.screenshot({ path: path.join(out, 'sheet.png') });
      await sheet.close();
    }
    if (errors.length) { bad++; console.log(errors.join('\n')); }
    await context.close();
  } finally {
    await browser.close();
  }
  console.log('wrote', out);
  process.exitCode = bad ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
