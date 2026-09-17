const { launch } = require('../launch.js');
(async () => {
  const b = await launch([]);
  const p = await b.newPage({ viewport: { width: 320, height: 180 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..', '..', 'index.html') + '?shadow=256');
  await p.waitForFunction(() => window.__ready, null, { timeout: 240000 });
  const res = await p.evaluate(() => {
    GAME.startPlay(); MISSIONS.S.dialogue = null; window.__manual = true; const sim = window.__sim; const P = PLAYER.P; const out = [];
    for (const type of ['sedan', 'sedan', 'hatch']) for (const side of [-1, 1]) for (const along of [0, 0.4]) {
      if (P.car) PLAYER.exitCar(); const c = VEH.spawn(type, 300 + Math.random() * 20, 336, 0.7, { mode: 'parked' }); sim(0.2); for (const o of W.cars) if (o !== c && !o.removed && M.dist(o.x, o.z, c.x, c.z) < 40) o.removed = true;
      const r = c.right, f = c.fwd; P.x = c.x + r[0] * side * (c.spec.wid / 2 + 1.2) + f[0] * along * c.spec.len; P.z = c.z + r[1] * side * (c.spec.wid / 2 + 1.2) + f[1] * along * c.spec.len; P.state = 'foot'; P.vx = P.vz = 0;
      sim(0.1, ['KeyF']); const st0 = P.state + '/' + (P.targetCar === c) + '/' + (P.doorSide); let t = 0; while (t < 4 && PLAYER.car !== c) { sim(0.1); t += 0.1; }
      out.push({ st0, type, side, along, ok: PLAYER.car === c, t: +t.toFixed(1), state: P.state, other: PLAYER.car && PLAYER.car !== c ? PLAYER.car.type : null, d: +M.dist(P.x, P.z, c.x, c.z).toFixed(1) });
      if (PLAYER.car === c) PLAYER.exitCar(); c.removed = true;
    }
    return out;
  });
  for (const r of res) console.log(JSON.stringify(r));
  await b.close();
})();
