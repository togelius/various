// Pursuit: with two stars and the player sitting in a car at four spots around the city, cruisers must actually
// arrive. Before road routing, half the spots never saw a cruiser within 30 m in a minute.
const { launch } = require('../launch.js');
(async () => {
  const b = await launch([]);
  const p = await b.newPage({ viewport: { width: 320, height: 180 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..', '..', 'index.html') + '?shadow=256&mute=1');
  await p.waitForFunction(() => window.__ready, null, { timeout: 240000 });
  const res = await p.evaluate(() => {
    GAME.startPlay(); MISSIONS.S.dialogue = null; MISSIONS.S.current = null; MISSIONS.S.progress = 3; MISSIONS.S.cooldown = 1e9; window.__manual = true;
    const out = [];
    for (const [x, z] of [[378, 372], [252, 520], [520, 250], [600, 600]]) {
      POLICE.clear(); for (const c of W.cars) if (c.type === 'police' || c.type === 'swat') c.remove(); window.__sim(0.1);
      const ln = CITY.nearestLane(x, z); const [lx, lz] = CITY.lanePoint(ln.e, 1, 20); const car = VEH.spawn('sedan', lx, lz, Math.atan2(ln.e.dx, ln.e.dz), { mode: 'parked' });
      const P = PLAYER.P; P.x = car.x; P.z = car.z; car.driver = PLAYER; car.ai.mode = 'player'; P.car = car; P.state = 'car';
      POLICE.setStars(2); let first = null, within = 0;
      for (let t = 0; t < 45; t += 0.5) { window.__sim(0.5); if (P.wanted < 2) POLICE.setStars(2); POLICE.seen();
        const near = W.cars.some(c => !c.removed && !c.wrecked && c.type === 'police' && c.ai.mode === 'chase' && Math.hypot(c.x - P.x, c.z - P.z) < 30);
        if (near) { within += 0.5; if (first === null) first = t; } }
      out.push({ spot: [x, z], first, within }); P.car = null; car.driver = null; P.state = 'foot';
    }
    return out;
  });
  for (const r of res) console.log(JSON.stringify(r));
  const reached = res.filter(r => r.first !== null && r.first <= 35).length;
  console.log(reached >= 3 ? 'PASS' : 'FAIL', `cruisers within 30 m inside 35 s at ${reached}/4 spots`);
  if (reached < 3) process.exitCode = 1;
  await b.close();
})();
