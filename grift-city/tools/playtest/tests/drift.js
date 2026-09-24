// Drift and style, end to end through the real input path: a sports car at 80 km/h into a junction, a handbrake flick with the
// wheel turned (keyboard, as the touch buttons are), then throttle and a steer that holds the slide. The drift must
// start, last, end, and land a DRIFT trick in a style chain that banks into the player's money. Screenshots of the
// held drift and the chain are written to /tmp/grift-check.
const { launch } = require('../launch.js');
const path = require('path'), fs = require('fs');
(async () => {
  const out = path.join(require('os').tmpdir(), 'grift-check'); fs.mkdirSync(out, { recursive: true });
  const b = await launch([]);
  const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', '..', '..', 'index.html') + '?shadow=256&mute=1');
  await p.waitForFunction(() => window.__ready, null, { timeout: 240000 });
  const setup = await p.evaluate(() => {
    GAME.startPlay(); MISSIONS.S.dialogue = null; MISSIONS.S.current = null; MISSIONS.S.progress = 3; MISSIONS.S.cooldown = 1e9; window.__manual = true; W.state.time = 13;
    // an avenue with the whole width of the grid ahead of it
    const len = e => Math.hypot(e.to.x - e.from.x, e.to.z - e.from.z), mid = Math.floor(CITY.GRID / 2); const best = CITY.roadEdges.find(e => e.dx === 1 && e.from.i === 1 && e.from.j === mid);
    const ln = { e: best }; const [x, z] = CITY.lanePoint(ln.e, 0, len(best) - 26); /* 80 km/h, a few car lengths before a junction */
    for (const c of W.cars.slice()) if (Math.hypot(c.x - x, c.z - z) < 150) c.remove();
    const car = VEH.spawn('sports', x, z, Math.atan2(ln.e.dx, ln.e.dz), { mode: 'parked' }); const P = PLAYER.P;
    car.vx = ln.e.dx * 22; car.vz = ln.e.dz * 22; P.x = car.x; P.z = car.z; car.driver = PLAYER; car.ai.mode = 'player'; P.car = car; P.state = 'car'; P.money = 0; STYLE.S.chain = null;
    window.__car = car; return { len: Math.round(len(best)), x: Math.round(x), z: Math.round(z) };
  });
  console.log('road', JSON.stringify(setup));
  const key = (code, down) => p.evaluate(([c, d]) => window.dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c })), [code, down]);
  const sim = s => p.evaluate(s => window.__sim(s), s);
  await key('KeyW', true); await sim(0.2); // already at speed; the flick comes as the junction opens up
  const v0 = await p.evaluate(() => window.__car.absSpeed);
  await key('KeyA', true); await key('Space', true); await sim(0.45); await key('Space', false); // the flick
  const started = await p.evaluate(() => !!window.__car.drift);
  // hold it: a human countersteers once the tail is well out; here, alternate the stick against the slip
  let held = 0, shot = false;
  for (let i = 0; i < 40; i++) {
    const st = await p.evaluate(() => { const c = window.__car; return { drift: !!c.drift, slip: Math.atan2(c.lat, Math.max(3, Math.abs(c.speed))) * 57.3 }; });
    if (!st.drift) break; held += 0.1;
    const into = Math.abs(st.slip) < 28; await key('KeyA', into); await key('KeyD', !into);
    await sim(0.1);
    if (!shot && held > 1.0) { shot = true; await p.evaluate(() => window.__renderOnce()); await p.screenshot({ path: path.join(out, 'drift-held.png'), timeout: 240000 }); }
  }
  await key('KeyA', false); await key('KeyD', false); await key('KeyW', false); await sim(0.5);
  const after = await p.evaluate(() => ({ chain: STYLE.info().chain, last: window.__car.lastDrift || null, money: PLAYER.P.money }));
  await p.evaluate(() => window.__renderOnce()); await p.screenshot({ path: path.join(out, 'drift-chain.png'), timeout: 240000 });
  await sim(5);
  const banked = await p.evaluate(() => ({ money: PLAYER.P.money, chain: !!STYLE.S.chain, best: PLAYER.P.stats.styleBest || 0 }));
  console.log(JSON.stringify({ speed: +v0.toFixed(1), started, held: +held.toFixed(1), chain: after.chain && after.chain.tricks, banked }));
  const ok = v0 > 15 && started && held >= 1 && banked.money > 0 && !banked.chain;
  console.log(ok ? 'PASS' : 'FAIL', `drift held ${held.toFixed(1)} s from ${v0.toFixed(1)} m/s, banked $${banked.money}`);
  if (!ok) process.exitCode = 1;
  await b.close();
})();
