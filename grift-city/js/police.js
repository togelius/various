// GRIFT CITY — heat. Crimes raise it, cops answer it: foot patrols, cruisers, roadblocks, SWAT and a helicopter.
'use strict';
const POLICE = (() => {
  const S = { heat: 0, seenT: 99, lastSeen: null, arrestT: 0, arresting: false, spawnT: 0, roadblockT: 20, footT: 0, heliT: 0, evadeMsg: 0, sirenVol: 0 };
  const HEAT = { kill: 1.0, killcar: 0.55, copkill: 1.6, cop: 1.0, jack: 0.45, hit: 0.2, assault: 0.25, shoot: 0.12, explosion: 1.3, vandal: 0.12 };
  const stars = () => Math.min(5, Math.floor(S.heat));
  const COOLDOWN = { shoot: 1.5, assault: 1.2, hit: 0.6, vandal: 1.0 }; const lastCrime = {};
  function crime(kind, x, z, victim) {
    const P = PLAYER.P; if (!P.alive) return;
    // rapid fire is one crime, not forty
    if (COOLDOWN[kind]) { const now = W.state.elapsed; if (lastCrime[kind] !== undefined && now - lastCrime[kind] < COOLDOWN[kind]) return; lastCrime[kind] = now; }
    let h = HEAT[kind] || 0.2;
    const copsNear = W.peds.some(p => p.isCop && p.alive && M.dist2(p.x, p.z, x, z) < 70 * 70) || W.cars.some(c => !c.removed && c.driver && c.driver.isCop && M.dist2(c.x, c.z, x, z) < 70 * 70);
    const witnesses = W.pedsNear(x, z, 30).filter(p => p.alive && !p.inCar).length;
    if (!copsNear && witnesses === 0 && P.wanted === 0 && kind !== 'copkill' && kind !== 'cop') h *= 0.25;
    if (copsNear) h *= 1.4;
    if (kind === 'shoot' && P.wanted === 0 && !copsNear) h = witnesses > 0 ? 0.06 : 0.02;
    h *= 1 / (1 + S.heat * 0.6); // each star is harder to earn than the last
    const before = stars(); S.heat = Math.min(5.99, S.heat + h); S.seenT = 0; S.lastSeen = [P.x, P.z];
    if (stars() > before) { AUDIO.play('star'); HUD.flashStars(); if (before === 0) S.spawnT = 0; }
    P.wanted = stars();
  }
  function seen(cop) { S.seenT = 0; S.lastSeen = [PLAYER.x, PLAYER.z]; }
  function arrestProgress(dt, cop) { S.arrestT += dt; S.arresting = true; if (S.arrestT > 0.7) PLAYER.bust(); }
  function clear() { S.heat = 0; PLAYER.P.wanted = 0; S.seenT = 99; for (const c of W.cars) if (!c.removed && c.driver && c.driver.isCop && c.ai.mode === 'chase') { c.ai.mode = 'traffic'; c.ai.edge = null; c.siren = false; } if (W.heli) W.heli.leaving = true; }
  function setStars(n) { S.heat = Math.max(S.heat, n); PLAYER.P.wanted = stars(); S.seenT = 0; S.lastSeen = [PLAYER.x, PLAYER.z]; S.spawnT = 0; }
  function bribe() { S.heat = Math.max(0, S.heat - 1); PLAYER.P.wanted = stars(); }

  function counts() { let foot = 0, cars = 0, swat = 0; for (const p of W.peds) if (p.alive && p.isCop && !p.inCar) foot++; for (const c of W.cars) if (!c.removed && !c.wrecked && (c.type === 'police' || c.type === 'swat') && c.ai.mode === 'chase') { cars++; if (c.type === 'swat') swat++; } return { foot, cars, swat }; }
  function laneSpotAway(minD, maxD, ahead) {
    const P = PLAYER.P; const cands = [];
    for (const e of CITY.roadEdges) { const mx = (e.from.x + e.to.x) / 2, mz = (e.from.z + e.to.z) / 2; const d = M.dist(mx, mz, P.x, P.z); if (d < minD - 40 || d > maxD + 40) continue; cands.push(e); }
    for (let t = 0; t < 30 && cands.length; t++) {
      const e = cands[Math.floor(W.rng() * cands.length)]; const L = CITY.laneLen(e); const s = 5 + W.rng() * (L - 10); const lane = W.rng() < 0.5 ? 0 : 1; const [x, z] = CITY.lanePoint(e, lane, s); const d = M.dist(x, z, P.x, P.z);
      if (d < minD || d > maxD) continue;
      if (ahead && P.car && P.car.absSpeed > 5 && t < 20) { const f = P.car.fwd; if ((x - P.x) * f[0] + (z - P.z) * f[1] < 0) continue; }
      return { e, lane, s, x, z };
    }
    return null;
  }
  function spawnCar(swat) {
    const spot = laneSpotAway(90, 170, true); if (!spot) return;
    const c = VEH.spawn(swat ? 'swat' : 'police', spot.x, spot.z, 0, { mode: 'chase' }); c.placeOnLane(spot.e, spot.lane, spot.s); c.ai.mode = 'chase'; c.siren = true; c.lightsOn = true; c.important = false;
    const d = PEDS.spawnCop(c.x, c.z, { swat }); d.inCar = c; c.driver = d; d.car = c; d.state = 'driving';
    const n = swat ? 3 : 1; for (let i = 0; i < n; i++) { const p = PEDS.spawnCop(c.x, c.z, { swat, weapon: swat ? 'rifle' : (PLAYER.wanted >= 3 ? 'shotgun' : 'pistol') }); p.enterCar(c); p.car = c; }
    return c;
  }
  function spawnFoot() {
    const P = PLAYER.P; const cands = CITY.walkNodes.filter(n => { const d = M.dist(n.x, n.z, P.x, P.z); return d > 35 && d < 75; }); if (!cands.length) return;
    for (let t = 0; t < 10; t++) { const n = cands[Math.floor(W.rng() * cands.length)]; const d = M.dist(n.x, n.z, P.x, P.z); if (W.los(n.x, n.z, P.x, P.z) && d < 50 && t < 8) continue; const p = PEDS.spawnCop(n.x, n.z, { weapon: P.wanted >= 3 ? 'shotgun' : 'pistol' }); p.alerted = 10; return p; }
  }
  function spawnRoadblock() {
    const P = PLAYER.P; if (!P.car) return; const f = P.car.fwd; const spd = Math.max(P.car.absSpeed, 8);
    // an intersection roughly ahead
    let best = null, bd = 1e9; for (const n of CITY.roadNodes) { const dx = n.x - P.x, dz = n.z - P.z; const along = dx * f[0] + dz * f[1]; const across = Math.abs(-dx * f[1] + dz * f[0]); if (along < 70 || along > 170 || across > 12) continue; const d = along + across * 3; if (d < bd) { bd = d; best = n; } }
    if (!best) return;
    const perp = [f[1], -f[0]]; const ang = Math.atan2(perp[0], perp[1]);
    const bx = best.x - f[0] * 2, bz = best.z - f[1] * 2;
    for (let k = -1; k <= 1; k += 2) { const c = VEH.spawn('police', bx + perp[0] * k * 2.6, bz + perp[1] * k * 2.6, ang, { mode: 'parked' }); c.siren = true; c.lightsOn = true; c.roadblock = true; c.ai.mode = 'parked';
      const p = PEDS.spawnCop(bx + perp[0] * k * 3 + f[0] * 3.5, bz + perp[1] * k * 3 + f[1] * 3.5, { weapon: 'shotgun' }); p.alerted = 20; p.car = c; }
    HUD.notify('Roadblock ahead!');
  }

  // ---- Helicopter
  function spawnHeli() {
    const P = PLAYER.P; const a = W.rng() * M.TAU; const h = { x: P.x + Math.sin(a) * 160, z: P.z + Math.cos(a) * 160, y: 45, vx: 0, vz: 0, vy: 0, angle: a, health: 520, maxHealth: 520, dead: false, rotor: 0, gunT: 1, orbit: W.rng() * M.TAU, leaving: false, bones: new Float32Array(16 * RENDER.MAX_BONES), emis: new Float32Array(RENDER.MAX_BONES), model: M.create(), mesh: MESH.heli().build(), tilt: 0, roll: 0, deadT: 0, removed: false, spot: 0 };
    for (let i = 0; i < RENDER.MAX_BONES; i++) h.bones.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], i * 16);
    h.damage = (amount, src) => { if (h.dead) return; h.health -= amount; if (h.health <= 0) { h.dead = true; h.deadT = 0; W.FX.explosion(h.x, h.y, h.z, 1); AUDIO.play('explosion', h.x, h.z); if (src === PLAYER) PLAYER.addMoney(2500, 'helicopter down'); } };
    W.heli = h; return h;
  }
  const tmpB = M.create();
  function updateHeli(dt) {
    const h = W.heli; if (!h) return; const P = PLAYER.P;
    if (h.dead) { h.deadT += dt; h.vy -= 12 * dt; h.y += h.vy * dt; h.x += h.vx * dt; h.z += h.vz * dt; h.angle += dt * 4; h.tilt = Math.min(0.6, h.tilt + dt); if (W.state.frame % 2 === 0) { W.FX.smoke(h.x, h.y, h.z, 2, true); W.FX.fire(h.x, h.y, h.z, 1); }
      if (h.y <= CITY.groundY(h.x, h.z) + 1) { PLAYER.explodeAt(h.x, h.y, h.z, 2, PLAYER); h.removed = true; W.heli = null; AUDIO.heliVolume(0); } return; }
    h.rotor += dt * 40;
    const want = P.wanted >= 4 && P.alive && !h.leaving; const targetY = want ? 30 : 80;
    if (!want) { h.leaving = true; }
    // orbit the player
    h.orbit += dt * 0.35; const R = 26; const tx = P.x + Math.sin(h.orbit) * R, tz = P.z + Math.cos(h.orbit) * R;
    const dx = (h.leaving ? h.x + Math.sin(h.angle) * 100 : tx) - h.x, dz = (h.leaving ? h.z + Math.cos(h.angle) * 100 : tz) - h.z; const d = Math.hypot(dx, dz) || 1;
    const sp = Math.min(38, d * 0.9); h.vx = M.lerp(h.vx, dx / d * sp, dt * 1.5); h.vz = M.lerp(h.vz, dz / d * sp, dt * 1.5); h.x += h.vx * dt; h.z += h.vz * dt; h.y = M.lerp(h.y, targetY, dt * 0.8);
    const faceA = Math.atan2(P.x - h.x, P.z - h.z); h.angle += M.angleTo(h.angle, h.leaving ? h.angle : faceA) * Math.min(1, 2 * dt);
    h.tilt = M.lerp(h.tilt, Math.hypot(h.vx, h.vz) * 0.006, dt * 2);
    if (h.leaving && M.dist(h.x, h.z, P.x, P.z) > 300) { h.removed = true; W.heli = null; AUDIO.heliVolume(0); return; }
    AUDIO.heliVolume(M.clamp(1 - M.dist(h.x, h.z, P.x, P.z) / 180, 0, 1));
    // searchlight
    if (want) { W.dyn.push({ x: P.x, y: 3, z: P.z, r: 14, col: [1.2, 1.2, 1.0] }); W.fx.quad(W.F.adds, [h.x, h.y - 1, h.z], [h.x + 0.5, h.y - 1, h.z], [P.x + 4, CITY.groundY(P.x, P.z) + 0.1, P.z + 4], [P.x - 4, CITY.groundY(P.x, P.z) + 0.1, P.z - 4], [1, 1, 0.9], 0.12, 0.02); W.fx.quad(W.F.adds, [h.x, h.y - 1, h.z], [h.x, h.y - 1, h.z + 0.5], [P.x - 4, CITY.groundY(P.x, P.z) + 0.1, P.z + 4], [P.x + 4, CITY.groundY(P.x, P.z) + 0.1, P.z - 4], [1, 1, 0.9], 0.12, 0.02);
      POLICE.seen(null);
      h.gunT -= dt; if (h.gunT <= 0 && M.dist(h.x, h.z, P.x, P.z) < 60) { h.gunT = 0.14; if (W.rng() < 0.7) { const ang = Math.atan2(P.x - h.x, P.z - h.z) + (W.rng() - 0.5) * 0.25; PLAYER.fireBullet(h, h.x, h.z, h.y, ang, WEAPONS.rifle, 0.5, h); } if (W.rng() < 0.12) h.gunT = 1.6; } }
  }
  function heliEntity() { const h = W.heli; if (!h || h.removed) return null; M.trsEuler(h.model, h.x, h.y, h.z, h.angle, h.tilt, h.roll); M.trs(tmpB, 0, 0, 0, h.rotor); h.bones.set(tmpB, 16); M.trsEuler(tmpB, 0, 2.2, -4.4, 0, 0, 0); // tail rotor spins about x
    const c = Math.cos(h.rotor * 1.5), s = Math.sin(h.rotor * 1.5); h.bones.set([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 2.2 - (c * 2.2 - s * -4.4), -4.4 - (s * 2.2 + c * -4.4), 1], 32);
    h.emis.fill(0); h.emis[3] = 1.5; if (!h.dead) W.dyn.push({ x: h.x, y: h.y - 2, z: h.z, r: 12, col: [1, 1, 0.9] }); return { mesh: h.mesh, model: h.model, bones: h.bones, emis: h.emis, noShadow: false }; }

  function update(dt) {
    const P = PLAYER.P; const w = stars(); P.wanted = w;
    if (!S.arresting) S.arrestT = Math.max(0, S.arrestT - dt * 2); S.arresting = false;
    S.seenT += dt;
    if (w > 0 && P.alive) {
      // cop cars see the player too
      for (const c of W.cars) if (!c.removed && c.ai.mode === 'chase' && M.dist2(c.x, c.z, P.x, P.z) < 70 * 70 && W.los(c.x, c.z, P.x, P.z)) { S.seenT = 0; S.lastSeen = [P.x, P.z]; break; }
      const evade = 10 + w * 7;
      if (S.seenT > evade) { S.heat = Math.max(0, Math.floor(S.heat) - 1 + 0.9); S.seenT = evade * 0.55; if (stars() === 0) { S.heat = 0; HUD.notify('You lost the cops.'); clear(); } }
      // spawning
      const cnt = counts(); S.spawnT -= dt; S.footT -= dt; S.roadblockT -= dt;
      const wantCars = [0, 0, 2, 3, 4, 5][w], wantFoot = [0, 2, 3, 4, 4, 5][w], wantSwat = [0, 0, 0, 0, 1, 2][w];
      if (S.spawnT <= 0) { S.spawnT = w >= 3 ? 6 : 10; if (cnt.cars < wantCars) spawnCar(false); else if (cnt.swat < wantSwat) spawnCar(true); }
      if (S.footT <= 0) { S.footT = 5; if (cnt.foot < wantFoot && (!P.car || P.car.absSpeed < 6)) spawnFoot(); }
      if (w >= 3 && S.roadblockT <= 0 && P.car && P.car.absSpeed > 8) { S.roadblockT = w >= 4 ? 18 : 28; spawnRoadblock(); }
      if (w >= 4 && !W.heli) { S.heliT -= dt; if (S.heliT <= 0) { spawnHeli(); S.heliT = 40; } }
      // cops leaving cars near the player
      for (const c of W.cars) {
        if (c.removed || c.wrecked || c.ai.mode !== 'chase' || !c.driver || c.driver === PLAYER) continue;
        const d = M.dist(c.x, c.z, P.x, P.z);
        if (d < 9 && (!P.car || P.car.absSpeed < 3) && c.absSpeed < 4) { const crew = [c.driver, ...c.passengers]; for (const p of crew) { p.exitCar(); p.alerted = 10; p.car = c; p.x += (W.rng() - 0.5) * 2; p.z += (W.rng() - 0.5) * 2; } c.driver = null; c.passengers.length = 0; c.ai.mode = 'parked'; c.exitT = 0; }
        if (c.roadblock && d < 20) { c.roadblock = false; }
      }
      // cops far from the player get back into their parked cruiser and resume the chase
      for (const p of W.peds) { if (!p.alive || !p.isCop || p.inCar || !p.car || p.car.removed || p.car.wrecked) continue; if (M.dist(p.x, p.z, P.x, P.z) > 32 && M.dist(p.x, p.z, p.car.x, p.car.z) < 3 && !p.car.driver) { p.inCar = p.car; p.car.driver = p; p.car.ai.mode = 'chase'; p.car.siren = true; p.state = 'driving'; } else if (M.dist(p.x, p.z, P.x, P.z) > 32 && p.car && !p.car.driver && M.dist(p.x, p.z, p.car.x, p.car.z) < 40) { /* walk back */ p.returnT = 1; } }
      for (const c of W.cars) if (!c.removed && c.roadblock && !c.driver && M.dist(c.x, c.z, P.x, P.z) > 60) { c.roadblock = false; }
    } else {
      for (const c of W.cars) if (!c.removed && c.ai.mode === 'chase' && (c.type === 'police' || c.type === 'swat')) { c.ai.mode = 'traffic'; c.ai.edge = null; c.siren = false; }
      if (W.heli && !W.heli.dead) W.heli.leaving = true;
    }
    updateHeli(dt);
    // siren audio: nearest siren car
    let vol = 0; for (const c of W.cars) if (!c.removed && c.siren) vol = Math.max(vol, 1 - M.dist(c.x, c.z, P.x, P.z) / 120); AUDIO.siren(M.clamp(vol, 0, 1) * (P.car && P.car.siren ? 1 : 0.8) + (P.car && P.car.siren ? 0.6 : 0), dt);
  }
  return { S, crime, seen, arrestProgress, clear, setStars, bribe, update, heliEntity, stars, get lastSeen() { return S.lastSeen; } };
})();
