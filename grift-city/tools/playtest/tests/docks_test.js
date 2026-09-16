const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 320, height: 180 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..', '..', 'index.html') + '?shadow=256');
  await p.waitForFunction(() => window.__ready, null, { timeout: 90000 });
  const res = await p.evaluate(() => {
    GAME.startPlay(); MISSIONS.S.dialogue = null; window.__manual = true; const sim = window.__sim; const P = PLAYER.P; const out = [];
    sim(3); const k = CITY.place('docks'); out.push({ docks: [k.x, k.z] });
    for (const [sx, sz] of [[708, 668], [690, 668], [700, 668], [676, 690], [720, 668]]) {
      if (P.car) PLAYER.exitCar(); const c = VEH.spawn('van', sx, sz, Math.atan2(k.x - sx, k.z - sz), { mode: 'parked' }); for (const o of W.cars) if (o !== c && !o.removed && M.dist(o.x, o.z, c.x, c.z) < 80) o.removed = true;
      P.x = c.x - c.right[0] * 2; P.z = c.z - c.right[1] * 2; P.state = 'foot'; sim(0.1, ['KeyF']); sim(2);
      let best = 1e9, t = 0, stuckT = 0; const path = [];
      while (t < 40) { const d = M.dist(c.x, c.z, k.x, k.z); best = Math.min(best, d); if (d < 6) break;
        const want = Math.atan2(k.x - c.x, k.z - c.z); const e = M.angleTo(c.angle, want); const keys = []; if (e > 0.1) keys.push('KeyD'); else if (e < -0.1) keys.push('KeyA');
        if (c.absSpeed < 1 && t > 3) stuckT += 0.1; else stuckT = Math.max(0, stuckT - 0.05);
        if (stuckT > 2 && stuckT < 4) { keys.push('KeyS'); } else if (c.speed < 9) keys.push('KeyW'); if (stuckT >= 4) stuckT = 0;
        sim(0.1, keys); t += 0.1; if (Math.round(t * 10) % 50 === 0) path.push([Math.round(c.x), Math.round(c.z)]); }
      out.push({ from: [sx, sz], reached: M.dist(c.x, c.z, k.x, k.z) < 6, t: +t.toFixed(1), best: +best.toFixed(1), at: [Math.round(c.x), Math.round(c.z)], path });
      c.removed = true;
    }
    return out;
  });
  for (const r of res) console.log(JSON.stringify(r));
  await b.close();
})();
