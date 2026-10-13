#!/usr/bin/env node
'use strict';
// Screenshots of every screen, to LOOK at (portrait and landscape): the title (and BIG MAGNETS on), the shove, play,
// the crown in hand, OVERTIME, the SMASH, the level announcement, pause, a bump warning, the foot, the tall-tower
// gauge, night (L15), TIME! and the results card with a NEW BEST; and (revision 2, DESIGN 15) the long car of L4, a
// triangle in the hand over a notch (the faint outlines of the triangle moves, the TRUSS chip), the TRUSS's lock flash
// and the glint it leaves, the wobble's amber and red joints and its sway, the SNAP, the GO HIGHER chip with the first
// crown's hint, and OVERTIME's badge on the HOLD box. Driven by real input (the wobble shots on fixture builds);
// CS.setClock ends runs.
//   node clack-stack/tools/screens.cjs [outDir] [--sizes=390x844,844x390]
// Writes outDir/<size>/NN-name.png and outDir/sheet-<size>.png. Fails on page or console errors, and if a word pop
// or announcement breaks the rules while the level is played through (lib.cjs wordMonitor: none over the HUD or over
// another pop, none over the ghost or born over the build top, at most two words up, each <= 0.6 s).
const path = require('path');
const fs = require('fs');
const { launch, gamePage, until, wordMonitor } = require('./lib.cjs');

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

// a fixture build: tiles placed by slot key with the lattice functions, a brace line where a TRUSS would put it
function fixture(page, keys, yb) {
  return page.evaluate(([keys, yb]) => {
    const B = S.B, cols = ['blue', 'yellow', 'red', 'green', 'lightBlue', 'purple', 'orange'];
    keys.forEach((k, i) => {
      genSlots(B);
      const c = B.cands.find(q => q.key === k);
      if (!c) throw new Error('fixture: no slot ' + k);
      const shape = c.type === 'up' || c.type === 'dn' ? 'tri' : c.type;
      addTile(B, c.pose, { shape, color: cols[(i * 3) % 7], variant: 0, mass: CFG.MASS[shape], k: CFG.KROT[shape], depth: c.depth, flight: false, landT: -1 });
    });
    if (yb) { B.yb = yb; B.trusses++; lockJoints(B); }
    genSlots(B); recomputeTower(); massProps(B, true, COMMIT); computeGhost();
  }, [keys, yb || 0]);
}
// a real click at slot `key`'s live centre with a square in the hand (before: run in the page just before the press)
async function tapKey(page, key, H, before) {
  await ready(page);
  await page.evaluate(() => { if (HAND.piece && HAND.piece.shape !== 'sq' && HAND.piece.shape !== 'crown') { HAND.piece = { shape: 'sq', color: 'yellow', variant: 1 }; computeGhost(); } });
  const sx = await page.evaluate(k => { const q = CS.slots().find(o => o.key === k); return q ? q.sx : null; }, key);
  if (sx === null) throw new Error('screens: no slot ' + key);
  await page.mouse.move(sx, H * 0.55);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
  if (before) await page.evaluate(before);
  const x = await page.evaluate(k => { const q = CS.slots().find(o => o.key === k); return q ? q.sx : null; }, key);
  const id = await page.evaluate(() => CS.lastRelease ? CS.lastRelease.id : 0);
  await page.mouse.move(x === null ? sx : x, H * 0.55); await page.mouse.down(); await page.mouse.up();
  await until(page, i => CS.lastRelease && CS.lastRelease.id > i, id, 5000);
  await until(page, () => CS.state().inAir === 0, null, 5000);
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
        await page.evaluate(wordMonitor);
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
        const wv = await page.evaluate(() => window.__wv);
        if (wv.bad.length) { bad++; console.log(`word pops ${W}x${H}: ` + wv.bad.join('; ')); }
        else console.log(`word pops ${W}x${H}: ${wv.settled} words + announcements checked, none over the HUD, another pop, the ghost or the build top`);
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
      // 6. revision 2 on the long car (L4): the car row filled with squares, two up-triangles side by side on it, and the
      // next triangle over the notch between them (the faint outlines of the triangle moves, the TRUSS chip), dropped:
      // the lock flash, then the glint it leaves. What does not fit that plan is thrown away off the left edge
      {
        const { page, errors, context } = await gamePage(browser, { width: W, height: H }, { seed: 12, mute: 1, nohint: 1, autostart: 1, ts: 2, level: 4 });
        await ready(page);
        await page.evaluate(() => { PARAM.ts = 1; });
        await page.waitForTimeout(300);
        await shot(page, 'long-car');
        await page.evaluate(() => { PARAM.ts = 2; });
        const PLAN_SQ = ['sq:-3,0,0', 'sq:-1,0,0', 'sq:1,0,0', 'sq:1,1,0'], PLAN_UP = ['up:-3,1,0', 'up:-1,1,0'];
        let trussed = false;
        for (let k = 0; k < 50 && !trussed; k++) {
          await ready(page);
          const p = await page.evaluate(pl => {
            const st = CS.state(), sl = CS.slots(), by = k => sl.find(q => q.key === k);
            if (st.piece === 'tri') { const t = sl.find(q => q.truss); if (t) return { slot: t, truss: true }; }
            const want = st.piece === 'tri' ? pl.up : st.piece === 'sq' || st.piece === 'marble' ? pl.sq : [];
            for (const k of want) if (by(k)) return { slot: by(k) };
            return { slot: null };
          }, { sq: PLAN_SQ, up: PLAN_UP });
          if (!p.slot) { await page.mouse.move(3, H * 0.55); await page.mouse.down(); await page.mouse.up(); await gameT(page, 0.3); continue; }
          await until(page, () => Math.abs(CS.state().omega) < 0.03, null, 1500).catch(() => {});
          const x = await page.evaluate(k => (CS.slots().find(q => q.key === k) || {}).sx, p.slot.key);
          await page.mouse.move(x || p.slot.sx, H * 0.55);
          if (p.truss) {
            await page.evaluate(() => { PARAM.ts = 1; });
            await page.waitForTimeout(250);
            await shot(page, 'truss-chip-hints');
            await page.evaluate(() => { PARAM.ts = 0.25; });
            await page.mouse.down(); await page.mouse.up();
            await until(page, () => CS.events.some(e => e.type === 'truss'), null, 8000);
            await page.waitForTimeout(240);
            await shot(page, 'truss-lock');
            await page.evaluate(() => { PARAM.ts = 1; });
            await page.waitForTimeout(1200);
            await shot(page, 'truss-glint');
            trussed = true;
          } else { await page.mouse.down(); await page.mouse.up(); }
        }
        if (!trussed) { bad++; console.log(`truss ${W}x${H}: no TRUSS came up in 50 drops`); }
        if (errors.length) { bad++; console.log(errors.join('\n')); }
        await context.close();
      }
      // 7. revision 2: the wobble, the SNAP and the crown gamble (DESIGN 15.3, 15.6) on fixtures (tiles placed with the
      // lattice functions; W set where a shot needs it): a 2-wide tower braced at 3.9 L with a column on the brace
      // swaying amber (W 0.55), then red (W 0.9, the fuse ring waiting); the SNAP (the segment flying off, the brace
      // standing); then on L1 the crown at the ribbon with the GO HIGHER chip and the first crown's hint, and the
      // OVERTIME badge on the HOLD box after a click on the chip
      {
        const { page, errors, context } = await gamePage(browser, { width: W, height: H }, { seed: 21, mute: 1, autostart: 1, ts: 1, level: 8, nohint: 1 }, { realClock: true });
        await ready(page);
        await page.evaluate(() => { HZ.every = 0; HZ.kind = ''; });
        const col = []; for (let a = 0; a < 3; a++) col.push('sq:-2,' + a + ',0', 'sq:0,' + a + ',0');
        await fixture(page, col.concat(['up:-2,3,0', 'up:0,3,0', 'dn:-1,3,0', 'sq:-1,3,1', 'sq:-3,3,1', 'sq:1,3,1', 'sq:-1,4,1', 'sq:-1,5,1']), 3 + Math.sqrt(3) / 2);
        // (a first tile, so the fuse runs and shows it waits)
        await tapKey(page, 'sq:-3,4,1', H);
        await ready(page);
        await page.mouse.move(W / 2 + 0.2 * (await page.evaluate(() => CS.cam().L)), H * 0.55);
        await page.evaluate(() => { WOB.W = 0.62; });
        await page.waitForTimeout(250);
        await shot(page, 'wobble-amber');
        await page.evaluate(() => { WOB.W = 0.95; });
        await page.waitForTimeout(260);
        await shot(page, 'wobble-red');
        await page.evaluate(() => { LEVELS[8].fuse = 1e9; });
        await tapKey(page, 'sq:-1,6,1', H, () => { WOB.W = 0.999; });
        await until(page, () => CS.events.some(e => e.type === 'snap'), null, 5000);
        await page.waitForTimeout(160);
        await shot(page, 'snap');
        if (errors.length) { bad++; console.log(errors.join('\n')); }
        await context.close();
      }
      {
        const { page, errors, context } = await gamePage(browser, { width: W, height: H }, { seed: 22, mute: 1, autostart: 1, ts: 1, level: 1 }, { realClock: true });
        await ready(page);
        const rows = []; for (let a = 0; a < 4; a++) for (const i of [-4, -2, 0, 2]) rows.push('sq:' + i + ',' + a + ',0');
        await fixture(page, rows.concat(['up:-2,4,0', 'up:0,4,0', 'dn:-1,4,0', 'sq:-1,4,1']), 4 + Math.sqrt(3) / 2);
        await tapKey(page, 'sq:2,4,0', H);
        await until(page, () => CS.state().crownInHand && CS.state().handReady, null, 5000);
        await page.mouse.move(W / 2 - 0.3 * (await page.evaluate(() => CS.cam().L)), H * 0.55);
        await page.waitForTimeout(450);
        await shot(page, 'go-higher');
        const ch = await page.evaluate(() => CS.ui().goHigher || null);
        if (!ch) { bad++; console.log(`go higher ${W}x${H}: no chip`); }
        else { await page.mouse.move(ch.x + ch.w / 2, ch.y + ch.h / 2); await page.mouse.down(); await page.mouse.up(); }
        await tapKey(page, 'sq:-1,5,1', H, () => { WOB.W = 0; });
        await ready(page);
        await page.waitForTimeout(400);
        await shot(page, 'overtime-badge');
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
