#!/usr/bin/env node
'use strict';
// M7 acceptance (DESIGN.md 14): hazards and the late game, driven through real input events.
//   node clack-stack/tools/hazards.cjs [outDir]       (frames to look at go to outDir, default <tmp>/clack-hazards)
//   node clack-stack/tools/hazards.cjs --only=bump,alt,big,night,hit
// Checks:
//   bump   level=5: a honk 1.2 ± 0.1 s before each bump, and bumps every 12 ± 0.5 s (game time)
//   alt    level=8: bump and foot alternate (and the foot's shadow is announced 1.0 s ahead)
//   big    big=1 (level 8): no hazard events at all
//   night  level=15: tiles stay visible against the night sky: every tile body differs by at least 40 in luminance
//          from the background right behind it (the same pixel of the room + rug, redrawn without the build through the
//          same Art.drawRoom / Art.drawRug calls the frame made: what the tile is seen against, not a sample beside the
//          tower that may land on a lamp-lit wall or the window)
//   hit    a bump and a foot rock a standing tower toward the far side (the calibrated kicks); the edge arrow shows
//          during the warning; frames of the honk, the bump car, the foot shadow and the stomp are written to look at
// Exits non-zero on any failure, page error or console error.
const path = require('path');
const fs = require('fs');
const { launch, gamePage, until } = require('./lib.cjs');

const argv = process.argv.slice(2);
const ONLY = (argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = n => !ONLY.length || ONLY.includes(n);
const out = path.resolve(argv.find(a => !a.startsWith('--')) || path.join(require('os').tmpdir(), 'clack-hazards'));
const VIEW = { width: 390, height: 844 };
let failures = 0;
const errorsAll = [];
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
}
const HZ_EV = /^(honk|bump|foot|stomp)$/;
async function open(browser, params, view) {
  const g = await gamePage(browser, view || VIEW, Object.assign({ mute: 1, nohint: 1, autostart: 1 }, params));
  await until(g.page, () => window.CS && CS.state().phase === 'play' && CS.state().handReady, null, 15000);
  return g;
}
async function runFor(page, dt) {
  const t0 = await page.evaluate(() => CS.state().t);
  await until(page, t => CS.state().t >= t, t0 + dt, 60000);
}
// a calm builder: the supported square / triangle slot that keeps |cx| smallest, lowest first (a low, wide tower)
async function buildLow(page, n, maxTop) {
  const ty = Math.round(page.viewportSize().height * 0.55);
  for (let k = 0; k < n; k++) {
    await until(page, () => { const s = CS.state(); return s.phase === 'play' && s.handReady && !s.locked && s.inAir === 0; }, null, 20000);
    const p = await page.evaluate(m => {
      const st = CS.state(), sl = CS.slots().filter(s => s.supported && !s.tippy && s.ly < m);
      if (st.piece === 'cube' || st.piece === 'crown' || !sl.length) return null;
      sl.sort((a, b) => a.ly - b.ly || Math.abs(a.lx) - Math.abs(b.lx));
      return sl[0];
    }, maxTop);
    if (!p) { await page.keyboard.press('Shift'); await page.waitForTimeout(20); const again = await page.evaluate(() => CS.state().piece); if (again === 'cube' || again === 'crown') { await page.mouse.move(3, ty); await page.mouse.down(); await page.mouse.up(); } continue; }
    await page.mouse.move(p.sx, ty); await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(30);
  }
  await until(page, () => CS.state().inAir === 0, null, 5000);
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await launch();
  try {
    if (want('bump')) {
      // an idle player on level 5: the base stands empty, the bump car comes on its beat
      const g = await open(browser, { seed: 31, ts: 4, level: 5 });
      await runFor(g.page, 50);
      const ev = await g.page.evaluate(() => CS.events.filter(e => /^(honk|bump|foot)$/.test(e.type)).map(e => ({ type: e.type, t: e.t, hit: e.hit })));
      const bumps = ev.filter(e => e.type === 'bump'), honks = ev.filter(e => e.type === 'honk');
      const leads = bumps.map(b => { const h = honks.filter(x => x.t <= b.t).pop(); return h ? b.t - h.t : null; });
      const gaps = bumps.slice(1).map((b, i) => b.t - bumps[i].t);
      check('bump: level 5, a honk 1.2 ± 0.1 s before each bump', bumps.length >= 3 && leads.every(l => l !== null && Math.abs(l - 1.2) <= 0.1) && honks.length >= bumps.length,
        `${bumps.length} bumps, honk leads ${leads.map(l => l === null ? '-' : l.toFixed(3)).join(' ')}`);
      check('bump: level 5, bumps every 12 ± 0.5 s', gaps.length >= 2 && gaps.every(d => Math.abs(d - 12) <= 0.5), `first at ${bumps[0] ? bumps[0].t.toFixed(2) : '-'} s, gaps ${gaps.map(d => d.toFixed(3)).join(' ')}`);
      check('bump: no foot before level 8', !ev.some(e => e.type === 'foot'));
      errorsAll.push(...g.errors); await g.context.close();
    }
    if (want('alt')) {
      const g = await open(browser, { seed: 32, ts: 4, level: 8 });
      await runFor(g.page, 48);
      const ev = await g.page.evaluate(() => CS.events.filter(e => /^(honk|bump|foot|stomp)$/.test(e.type)).map(e => ({ type: e.type, t: e.t })));
      const hits = ev.filter(e => e.type === 'bump' || e.type === 'foot');
      const alt = hits.every((e, i) => e.type === (i % 2 ? 'foot' : 'bump'));
      const gaps = hits.slice(1).map((e, i) => e.t - hits[i].t);
      const stompLead = hits.filter(e => e.type === 'foot').map(f => { const s = ev.filter(x => x.type === 'stomp' && x.t <= f.t).pop(); return s ? f.t - s.t : null; });
      check('alt: level 8, bump and foot alternate (every 10 s)', hits.length >= 4 && alt && gaps.every(d => Math.abs(d - 10) <= 0.5), `${hits.map(e => e.type + '@' + e.t.toFixed(1)).join(' ')}`);
      check('alt: the foot is announced 1.0 s ahead (its shadow grows)', stompLead.length >= 2 && stompLead.every(l => l !== null && Math.abs(l - 1.0) <= 0.1), stompLead.map(l => l === null ? '-' : l.toFixed(3)).join(' '));
      errorsAll.push(...g.errors); await g.context.close();
    }
    if (want('big')) {
      const g = await open(browser, { seed: 33, ts: 4, level: 8, big: 1 });
      await buildLow(g.page, 6, 3);
      await runFor(g.page, 40);
      const n = await g.page.evaluate(() => CS.events.filter(e => /^(honk|bump|foot|stomp)$/.test(e.type)).length);
      const st = await g.page.evaluate(() => CS.state());
      check('big: BIG MAGNETS (level 8) has no hazard events at all', n === 0 && st.big, `${n} hazard events over ${st.t.toFixed(1)} s`);
      errorsAll.push(...g.errors); await g.context.close();
    }
    if (want('night')) {
      for (const view of [VIEW, { width: 844, height: 390 }]) {
        const g = await open(browser, { seed: 34, ts: 2, level: 15 }, view);
        await buildLow(g.page, 9, 6);
        // (the measure needs the tower as it was drawn: no fuse drop meanwhile (fixture: the fuse off), the tower and
        // its sway settled: DESIGN 16.2's sway moves the tiles)
        await g.page.evaluate(() => { S.firstInput = false; HAND.fuseT = 0; });
        await until(g.page, () => { const s = CS.state(); return s.inAir === 0 && s.still && s.W < 0.05; }, null, 8000).catch(() => {});
        await g.page.waitForTimeout(300);
        await g.page.screenshot({ path: path.join(out, `night-${view.width}x${view.height}.png`) });
        // body pixel at each tile vs the same pixel of the background alone (the room and the rug as this frame drew
        // them: same size, ground line, scroll and sky; canvas pixels, CSS -> device)
        const r = await g.page.evaluate(() => new Promise(res => requestAnimationFrame(() => {
          const c = document.getElementById('c'), x2 = c.getContext('2d'), cam = CS.cam(), st = CS.state(), dpr = c.width / cam.W;
          const bgc = document.createElement('canvas'); bgc.width = c.width; bgc.height = c.height;
          const b2 = bgc.getContext('2d');
          b2.setTransform(dpr, 0, 0, dpr, 0, 0);
          Art.drawRoom(b2, cam.W, cam.H, cam.groundY, cam.camY, st.skyT);
          Art.drawRug(b2, cam.W, cam.H, cam.groundY, cam.camY);
          const lum = (cx, x, y) => { const d = cx.getImageData(Math.round(x * dpr) - 1, Math.round(y * dpr) - 1, 3, 3).data; let s = 0; for (let i = 0; i < 36; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return s / 9; };
          const tiles = CS.tiles();
          const out = tiles.map(t => {
            const oy = t.type === 'up' ? 0.12 : t.type === 'dn' ? -0.12 : 0.18;            // off the emboss / centre dot
            const y = t.sy + oy * cam.L, body = lum(x2, t.sx, y), bg = lum(b2, t.sx, y);
            return { color: t.color, type: t.type, body: Math.round(body), bg: Math.round(bg), d: Math.round(Math.abs(body - bg)) };
          });
          res({ out, night: st.night, skyT: st.skyT, n: tiles.length });
        })));
        const worst = r.out.reduce((m, q) => Math.min(m, q.d), 999);
        check(`night (${view.width}x${view.height}): level 15 tiles stay visible against the night (body vs the background behind it >= 40 luminance)`, r.night && r.n >= 6 && worst >= 40,
          `night ${r.night} (skyT ${r.skyT.toFixed(2)}), ${r.n} tiles, worst ${worst}: ` + r.out.map(q => `${q.color}/${q.type} ${q.body}:${q.bg}`).join(' '));
        errorsAll.push(...g.errors); await g.context.close();
      }
      // and a daytime level is not night
      const d = await open(browser, { seed: 35, level: 13 });
      const st = await d.page.evaluate(() => CS.state());
      check('night: level 13 is still day (multiply tiles)', !st.night && st.skyT === 0, `skyT ${st.skyT}`);
      errorsAll.push(...d.errors); await d.context.close();
    }
    if (want('hit')) {
      // a bump rocks a standing tower toward the far side; frames of the warning, the car, the foot
      const g = await open(browser, { seed: 36, ts: 1, level: 8 });
      const { page } = g;
      await page.evaluate(() => { PARAM.ts = 4; });
      await buildLow(page, 6, 3);
      // the hand waits at the screen edge: what the fuse lets go of there falls on the rug, so the tower stands still
      // for the hazards (a tile landing on it now could set it rocking, or fell it, just before the hit)
      await page.mouse.move(3, Math.round(page.viewportSize().height * 0.55));
      // run up to just before the first honk at normal speed for the frames
      await until(page, () => { const h = CS.state().hazard; return h.inS !== null && h.inS < 1.5; }, null, 30000);
      await page.evaluate(() => { PARAM.ts = 1; });
      const shots = [];
      const rec = [];
      for (let i = 0; i < 2; i++) {
        const kind = await page.evaluate(() => CS.state().hazard.kind);
        await until(page, () => CS.state().hazard.warned, null, 8000);
        await page.waitForTimeout(150);
        const arrow = await page.evaluate(() => ({ kind: HZ.kind, warned: HZ.warned }));
        const f1 = path.join(out, `${kind}-warn.png`); await page.screenshot({ path: f1 }); shots.push(f1);
        const n0 = await page.evaluate(() => CS.events.filter(e => e.type === 'bump' || e.type === 'foot').length);
        await until(page, n => CS.state().hazard.inS < 0.3 || CS.events.filter(e => e.type === 'bump' || e.type === 'foot').length > n, n0, 8000);
        const f2 = path.join(out, `${kind}-coming.png`); await page.screenshot({ path: f2 }); shots.push(f2);
        const before = await page.evaluate(() => ({ th: CS.state().theta, om: CS.state().omega }));
        await until(page, n => CS.events.filter(e => e.type === 'bump' || e.type === 'foot').length > n, n0, 8000);
        const e = await page.evaluate(() => CS.events.filter(q => q.type === 'bump' || q.type === 'foot').pop());
        await page.waitForTimeout(90);
        const after = await page.evaluate(() => ({ th: CS.state().theta, om: CS.state().omega, tiles: CS.state().tiles }));
        const f3 = path.join(out, `${kind}-hit.png`); await page.screenshot({ path: f3 }); shots.push(f3);
        rec.push({ kind: e.type, side: e.side, hit: e.hit, dw: e.dw, before, after });
        await page.evaluate(() => { PARAM.ts = 4; });
        await until(page, () => { const h = CS.state().hazard; return h.inS !== null && h.inS < 1.5 && h.inS > 1.3; }, null, 30000).catch(() => {});
        await page.evaluate(() => { PARAM.ts = 1; });
      }
      // the push goes toward the far side: the kick it gives (the event's dw, theta positive = over the right wheel) is
      // opposite to the side it came from; and a tower that stood still moves that way (one still rocking from the
      // last drop is judged by the kick alone)
      const still = r => Math.abs(r.before.th) < 1e-6 && Math.abs(r.before.om) < 1e-6;
      const ok = rec.length === 2 && rec.every(r => r.hit && Math.sign(r.dw) === -r.side && (!still(r) || Math.sign(r.after.th || r.after.om) === -r.side));
      check('hit: a bump and a foot each rock the standing tower toward the far side', ok,
        rec.map(r => `${r.kind} from ${r.side > 0 ? 'right' : 'left'}: kick dω ${r.dw}; θ ${r.before.th.toFixed(4)} -> ${r.after.th.toFixed(4)} (ω ${r.after.om.toFixed(3)})`).join('; '));
      console.log('     frames: ' + shots.map(f => path.basename(f)).join(' '));
      errorsAll.push(...g.errors); await g.context.close();
    }
    check('hazards: no page or console errors', errorsAll.length === 0, errorsAll.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
  }
  console.log('wrote', out);
  console.log(failures ? `HAZARDS: ${failures} check(s) failed` : 'HAZARDS: all checks passed');
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
