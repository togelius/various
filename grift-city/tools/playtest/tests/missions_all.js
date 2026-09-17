const { launch } = require('../launch.js');
(async () => {
  const b = await launch([]);
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 400)); });
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..', '..', 'index.html') + '');
  await p.waitForFunction(() => window.__ready, null, { timeout: 240000 });
  const res = await p.evaluate(() => {
    GAME.startPlay(); MISSIONS.S.dialogue = null; MISSIONS.S.progress = 1; window.__manual = true; const log = []; const S = MISSIONS.S; const sim = window.__sim; const P = PLAYER.P;
    const begin = id => { MISSIONS.cleanup(); S.current = null; S.cooldown = 0; S.progress = id; MISSIONS.start(MISSIONS.LIST[id]); const d = S.dialogue; S.dialogue = null; if (d && d.then) d.then(); S.dialogue = null; return S.current.data; };
    const enter = c => { if (P.car) PLAYER.exitCar(); P.x = c.x - c.right[0] * 2; P.z = c.z - c.right[1] * 2; P.state = 'foot'; sim(0.1, ['KeyF']); sim(2); return PLAYER.car === c; };
    const carTo = (c, x, z) => { c.x = x; c.z = z; c.vx = c.vz = 0; };
    const note = (m, s, extra = {}) => log.push({ m, s, obj: MISSIONS.objective, cur: S.current && S.current.name, prog: S.progress, money: PLAYER.money, ...extra });
    try {
      // M2 delivery
      let d = begin(2); note(2, 'start'); note(2, 'enter van', { ok: enter(d.van) }); sim(1); note(2, 'phase', { phase: d.phase, timer: Math.round(S.timer) });
      const k = CITY.place('docks'); carTo(d.van, k.x + 100, k.z); sim(2); note(2, 'near ambush', { ambush: d.ambush, chasers: W.cars.filter(c => c.ai.mode === 'chase').length }); carTo(d.van, k.x, k.z); sim(3); note(2, 'delivered');
      // retry: fail the delivery on the clock, press Y, expect the mission to restart from Marla
      d = begin(2); enter(d.van); sim(0.5); S.timer = 0.05; sim(0.5); note(2, 'failed', { cur: S.current && S.current.name, retry: !!S.retry }); sim(0.1, ['KeyY']); sim(0.5); const dlg = S.dialogue; S.dialogue = null; if (dlg && dlg.then) dlg.then(); S.dialogue = null; note(2, 'retried', { cur: S.current && S.current.name, retry: !!S.retry, nearMarla: M.dist(P.x, P.z, CITY.place('mission').x, CITY.place('mission').z) < 6 });
      // M3 collections
      d = begin(3); note(3, 'start'); P.x = d.spot[0] + 10; P.z = d.spot[1] + 4; sim(2); note(3, 'arrived', { phase: d.phase, hostile: d.goons.filter(g => g.hostile).length });
      for (const g of d.goons) g.die(PLAYER, 'shot'); sim(2); note(3, 'goons dead', { phase: d.phase, teddy: d.teddy.state });
      sim(8); note(3, 'teddy fled', { teddy: d.teddy.state + (d.teddy.inCar ? '/inCar' : ''), carMode: d.car.ai.mode, carSpd: +d.car.absSpeed.toFixed(1) });
      d.car.explode(); sim(1); note(3, 'car exploded', { phase: d.phase, teddyAlive: d.teddy.alive, cash: !!d.cash });
      if (d.cash) { P.x = d.cash.x; P.z = d.cash.z; sim(0.5); note(3, 'cash', { phase: d.phase, taken: d.cash.taken }); }
      const g = CITY.place('mission'); P.x = g.x; P.z = g.z; sim(1); note(3, 'back at marla');
      // M4 GTA
      d = begin(4); note(4, 'start'); const gar = CITY.place('garage');
      for (const t of ['taxi', 'police', 'bus']) { const c = VEH.spawn(t, P.x + 5, P.z, 0, { mode: 'parked' }); enter(c); carTo(c, gar.x, gar.z + 1); sim(0.3); PLAYER.exitCar(); sim(3); note(4, 'delivered ' + t, { need: JSON.stringify(d.need) }); }
      // M5 race
      d = begin(5); note(5, 'start'); enter(d.car); carTo(d.car, d.startPt[0], d.startPt[1]); sim(1); note(5, 'at start', { started: d.started, count: +d.count.toFixed(1) }); sim(4.5); note(5, 'go', { count: +d.count.toFixed(1), rivalsMoving: d.rivals.filter(r => r.absSpeed > 1).length });
      for (let lap = 0; lap < 3; lap++) for (const cp of d.route) { carTo(d.car, cp[0], cp[1]); sim(0.3); }
      sim(1); note(5, 'finished', { rivalLaps: d.rivals.map(r => r.rivalLap + '.' + r.rivalCp).join(' ') });
      // M6
      d = begin(6); note(6, 'start', { rockets: PLAYER.weapons.rocket }); const dk = CITY.place('docks'); P.x = dk.x; P.z = dk.z - 30; sim(2); note(6, 'at docks', { hostile: W.peds.filter(q => q.hostile && q.alive).length });
      for (const t of d.trucks) t.explode(); sim(2); note(6, 'trucks gone', { phase: d.phase, wanted: PLAYER.wanted }); POLICE.clear(); sim(1); note(6, 'cleared');
      // M7
      d = begin(7); note(7, 'start', { crew: d.crew.length }); const bank = CITY.place('bank'); P.x = bank.x; P.z = bank.z + 2; for (const c of d.crew) { c.x = bank.x + 2; c.z = bank.z + 3; } sim(2); note(7, 'at bank', { phase: d.phase, timer: Math.round(S.timer), wanted: PLAYER.wanted });
      S.timer = 0.5; sim(2); note(7, 'timer done', { phase: d.phase, crewAlive: d.crew.filter(c => c.alive).length }); const sh = CITY.place('safehouse'); P.x = sh.x; P.z = sh.z + 3; for (const c of d.crew) { c.x = sh.x + 2; c.z = sh.z + 3; c.health = 999; } sim(2); note(7, 'at safehouse', { wanted: PLAYER.wanted });
      // M8
      d = begin(8); note(8, 'start'); const tw = CITY.place('tower'); P.x = tw.x; P.z = tw.z + 20; P.invuln = 999; sim(3); note(8, 'at tower', { phase: d.phase, crane: d.crane.state, hostile: d.guards.filter(q => q.hostile).length }); sim(8); note(8, 'crane fled', { crane: d.crane.state + (d.crane.inCar ? '/inCar' : ''), carSpd: +d.car.absSpeed.toFixed(1) });
      d.car.explode(); sim(1); note(8, 'car exploded', { phase: d.phase, wanted: PLAYER.wanted }); P.x = sh.x; P.z = sh.z + 3; sim(2); note(8, 'ending', { dlg: !!S.dialogue, ending: S.ending, wanted: PLAYER.wanted });
      S.dialogue = null; S.ending = false;
      // taxi job
      if (P.car) PLAYER.exitCar(); P.x = 200; P.z = 169.75; const taxi = VEH.spawn('taxi', 203, 169.75, Math.PI / 2, { mode: 'parked' }); enter(taxi); sim(0.1, ['KeyT']); sim(1); note('taxi', 'started', { side: S.side && S.side.kind, fare: !!(S.side && S.side.fare) });
      if (S.side && S.side.fare) { const f = S.side.fare; carTo(taxi, f.x + 3, f.z); sim(2); note('taxi', 'pickup', { phase: S.side.phase, inCar: !!f.inCar }); carTo(taxi, S.side.dest.x + 3, S.side.dest.z); sim(2); note('taxi', 'dropoff', { fares: S.side && S.side.fares, earned: S.side && S.side.earned }); }
      sim(0.1, ['KeyT']); sim(0.5); note('taxi', 'ended', { side: !!S.side });
      // vigilante
      PLAYER.exitCar(); const cop = VEH.spawn('police', P.x + 4, P.z, Math.PI / 2, { mode: 'parked' }); enter(cop); sim(0.1, ['KeyT']); sim(1); note('vig', 'started', { side: S.side && S.side.kind, target: !!(S.side && S.side.target), inCop: PLAYER.car === cop, st: P.state, near: W.cars.filter(c => !c.removed && M.dist(c.x, c.z, P.x, P.z) < 8).map(c => c.type).join('+') }); if (S.side && S.side.target) { S.side.target.explode(); sim(1); note('vig', 'kill', { level: S.side && S.side.level }); } sim(0.1, ['KeyT']); sim(0.5);
      // spray
      POLICE.setStars(2); cop.health = 300; const sp = CITY.place('spray'); carTo(cop, sp.x, sp.z); sim(2); note('spray', 'done', { wanted: PLAYER.wanted, health: cop.health, money: PLAYER.money });
      // save
      GAME.save(); note('save', 'saved', { has: GAME.hasSave() });
    } catch (e) { log.push({ error: e.message, stack: (e.stack || '').split('\n').slice(0, 3).join(' | ') }); }
    return log;
  });
  for (const s of res) console.log(JSON.stringify(s));
  await b.close();
})();
