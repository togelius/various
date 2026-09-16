const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 320, height: 180 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..', '..', 'index.html') + '?shadow=256');
  await p.waitForFunction(() => window.__ready, null, { timeout: 90000 });
  const res = await p.evaluate(() => {
    GAME.startPlay(); MISSIONS.S.dialogue = null; window.__manual = true; const sim = window.__sim; const P = PLAYER.P; const out = [];
    sim(3);
    for (const hf of [1, 0.3, 0.13]) {
      if (P.car) PLAYER.exitCar(); const c = VEH.spawn('sports', 420, 340, Math.PI / 2, { mode: 'parked' }); for (const o of W.cars) if (o !== c && !o.removed && M.dist(o.x, o.z, c.x, c.z) < 60) o.removed = true;
      P.x = c.x - c.right[0] * 2; P.z = c.z - c.right[1] * 2; P.state = 'foot'; sim(0.1, ['KeyF']); sim(2); c.health = c.maxHealth * hf;
      sim(4, ['KeyS']); const s1 = c.speed; sim(1, ['KeyW']); const s2 = c.speed; sim(2, ['KeyW']); const s3 = c.speed; sim(1, ['KeyW', 'KeyA']); const s4 = c.speed;
      out.push({ hf, inCar: PLAYER.car === c, afterS: +s1.toFixed(1), W1: +s2.toFixed(1), W3: +s3.toFixed(1), WA4: +s4.toFixed(1), air: c.airborne, y: +c.y.toFixed(2), wrecked: c.wrecked, thr: c.controls.throttle, brk: c.controls.brake });
    }
    return out;
  });
  for (const r of res) console.log(JSON.stringify(r));
  await b.close();
})();
