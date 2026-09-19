const assert = require('node:assert/strict');
const { launch } = require('../launch.js');
(async () => {
  const b = await launch([]);
  try {
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' | ' + (e.stack || '').split('\n').slice(1, 3).join(' | '))); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..', '..', 'index.html') + '');
  await p.waitForFunction(() => window.__ready, null, { timeout: 240000 });
  const res = await p.evaluate(() => {
    GAME.startPlay(); MISSIONS.S.dialogue = null; MISSIONS.S.progress = 1; window.__manual = true; const log = []; const P = PLAYER.P; const sim = window.__sim;
    PLAYER.giveWeapon('uzi', 9999); PLAYER.giveWeapon('rocket', 999); P.invuln = 1e9; let rng = M.rng(5);
    const t0 = performance.now(); let simT = 0;
    for (let minute = 0; minute < 6; minute++) {
      for (let k = 0; k < 60; k++) { // one second chunks with random behaviour
        const r = rng();
        if (!P.car && r < 0.3) { const c = VEH.nearest(P.x, P.z, 40, v => !v.wrecked); if (c) { P.x = c.x - c.right[0] * 2; P.z = c.z - c.right[1] * 2; sim(0.1, ['KeyF']); sim(1.5); } else sim(1, ['KeyW']); }
        else if (P.car) { const keys = ['KeyW']; if (r < 0.3) keys.push('KeyA'); else if (r < 0.6) keys.push('KeyD'); if (r > 0.9) keys.push('Space'); if (rng() < 0.05) { PLAYER.exitCar(); } else sim(1, keys); }
        else { sim(1, [rng() < 0.5 ? 'KeyW' : 'KeyD', 'ShiftLeft']); }
        if (rng() < 0.15) { P.weapon = rng() < 0.2 ? 'rocket' : 'uzi'; P.weaponOut = true; INPUT.mouse.buttons = 1; sim(0.3); INPUT.mouse.buttons = 0; }
        if (rng() < 0.02) POLICE.setStars(Math.floor(rng() * 5) + 1);
        if (!P.alive) sim(5);
        simT += 1;
      }
      log.push({ minute: minute + 1, ms: Math.round(performance.now() - t0), cars: W.cars.length, peds: W.peds.length, dead: W.peds.filter(q => q.state === 'dead').length, pickups: W.pickups.length, particles: W.P.list.length, wanted: PLAYER.wanted, hp: Math.round(PLAYER.health), pos: [Math.round(P.x), Math.round(P.z)], car: !!P.car, heli: !!W.heli, time: W.clockString(), money: PLAYER.money, kills: P.stats.kills, stolen: P.stats.carsStolen });
    }
    return log;
  });
  for (const s of res) console.log(JSON.stringify(s));
  console.log('errors:', errs.length); for (const e of errs.slice(0, 10)) console.log('ERR', e);
  assert.deepEqual(errs, [], 'no browser errors during the soak');
  assert.equal(res.length, 6, 'all six simulation intervals completed');
  for (const row of res) assert.ok([row.hp, row.money, ...row.pos].every(Number.isFinite), 'finite player state');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
