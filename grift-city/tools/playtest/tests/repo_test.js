const { launch } = require('../launch.js');
(async () => {
  const b = await launch([]);
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..', '..', 'index.html') + '?shadow=512');
  await p.waitForFunction(() => window.__ready, null, { timeout: 240000 });
  const res = await p.evaluate(() => {
    GAME.startPlay(); MISSIONS.S.dialogue = null; MISSIONS.S.progress = 1; window.__manual = true; const log = []; const S = MISSIONS.S; const sim = window.__sim; const P = PLAYER.P;
    const begin = id => { MISSIONS.cleanup(); S.current = null; S.cooldown = 0; S.progress = id; MISSIONS.start(MISSIONS.LIST[id]); const d = S.dialogue; S.dialogue = null; if (d && d.then) d.then(); S.dialogue = null; return S.current.data; };
    const note = (s, extra = {}) => log.push({ s, obj: MISSIONS.objective, cur: S.current && S.current.name, ...extra });
    const d = begin(1); note('start');
    // player arrives in a slow pickup near the Falcata
    const c = VEH.spawn('pickup', d.car.x + 12, d.car.z, 0, { mode: 'parked' }); P.x = c.x - c.right[0] * 2; P.z = c.z - c.right[1] * 2; P.state = 'foot'; sim(0.1, ['KeyF']); sim(2); note('in pickup', { ok: PLAYER.car === c, fled: d.fled, owner: d.owner.state });
    sim(6); note('after 6s', { fled: d.fled, ownerIn: d.owner.inCar === d.car, mode: d.car.ai.mode, spd: +d.car.absSpeed.toFixed(1) });
    // tail the debtor: keep the pickup 8 m behind him for 12 s
    let bailedAt = -1; for (let i = 0; i < 200 && bailedAt < 0; i++) { const f = d.car.fwd; c.x = d.car.x - f[0] * 8; c.z = d.car.z - f[1] * 8; c.vx = d.car.vx; c.vz = d.car.vz; c.angle = d.car.angle; sim(0.1); if (!d.car.driver) bailedAt = i * 0.1; }
    note('tailed', { bailedAt, pressure: d.car.ai.pressure, ownerIn: d.owner.inCar === d.car, missionFlee: d.car.ai.missionFlee, bailing: d.car.ai.bailing, mode: d.car.ai.mode, spd: +d.car.absSpeed.toFixed(1), owner: d.owner.state, ownerBailed: d.owner.bailed, hp: Math.round(d.car.health) });
    sim(2); note('2s later', { spd: +d.car.absSpeed.toFixed(1), driver: !!d.car.driver, dist: Math.round(M.dist(d.owner.x, d.owner.z, d.car.x, d.car.z)) });
    // now take the Falcata
    PLAYER.exitCar(); P.x = d.car.x - d.car.right[0] * 2; P.z = d.car.z - d.car.right[1] * 2; sim(0.1, ['KeyF']); sim(2); note('enter falcata', { ok: PLAYER.car === d.car });
    const g = CITY.place('garage'); d.car.x = g.x; d.car.z = g.z; d.car.vx = d.car.vz = 0; sim(3); note('delivered', { money: PLAYER.money, cur: S.current && S.current.name });
    return log;
  });
  for (const r of res) console.log(JSON.stringify(r));
  await b.close();
})();
