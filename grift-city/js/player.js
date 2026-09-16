// GRIFT CITY — the player: on foot, in a car, shooting, dying, and the camera that follows all of it.
'use strict';
const WEAPONS = {
  fist:    { name: 'FISTS', dmg: 12, rate: 0.42, range: 1.8, melee: true },
  bat:     { name: 'BASEBALL BAT', dmg: 30, rate: 0.55, range: 2.2, melee: true },
  pistol:  { name: 'PISTOL', dmg: 24, rate: 0.28, range: 60, spread: 0.018, sound: 'pistol', clip: 17, carDmg: 3 },
  uzi:     { name: 'MICRO SMG', dmg: 11, rate: 0.07, range: 45, spread: 0.055, auto: true, sound: 'uzi', clip: 30, carDmg: 2.5 },
  shotgun: { name: 'SHOTGUN', dmg: 9, pellets: 8, rate: 0.8, range: 24, spread: 0.11, sound: 'shotgun', clip: 6, carDmg: 3 },
  rifle:   { name: 'ASSAULT RIFLE', dmg: 21, rate: 0.1, range: 90, spread: 0.03, auto: true, sound: 'rifle', clip: 30, carDmg: 3 },
  rocket:  { name: 'ROCKET LAUNCHER', dmg: 0, rate: 1.4, range: 150, projectile: 'rocket', sound: 'rocket', clip: 1 },
  grenade: { name: 'GRENADES', dmg: 0, rate: 0.9, range: 30, projectile: 'grenade', clip: 1 },
};
const WEAPON_ORDER = ['fist', 'bat', 'pistol', 'uzi', 'shotgun', 'rifle', 'rocket', 'grenade'];

const PLAYER = (() => {
  const P = {
    x: 0, z: 0, y: 0, angle: 0, vx: 0, vz: 0, vy: 0, airborne: false, speed: 0, phase: 0, lying: 0, fallDir: 1,
    health: 100, armor: 0, money: 500, wanted: 0, weapons: { fist: Infinity }, weapon: 'fist', fireT: 0, weaponOut: false, aim: 0, recoil: 0, punchT: 0,
    car: null, state: 'foot', stateT: 0, alive: true, deadT: 0, look: PEDS.PLAYER_LOOK, mesh: null, bones: null, emis: null, model: null,
    camYaw: 0, camPitch: 0.28, camYawOff: 0, camIdle: 0, camX: 0, camY: 0, camZ: 0, camDist: 5.4, fov: 62,
    stats: { kills: 0, carsStolen: 0, missions: 0, distance: 0, packages: 0, stunts: 0, busted: 0, wasted: 0, cash: 0, jumps: [] },
    hurtFlash: 0, knockT: 0, enterTarget: null, targetCar: null, invuln: 0, lastGround: 0, inCarT: 0, airT: 0, stuntBonus: 0, sprintT: 0, radio: 1, headBob: 0, lastCarName: '', carNameT: 0,
  };
  const projectiles = []; const tracers = [];
  const tmp = M.create();

  function init(x, z, angle) { P.mesh = PEDS.getMesh(P.look); P.bones = new Float32Array(16 * RENDER.MAX_BONES); P.emis = new Float32Array(RENDER.MAX_BONES); P.model = M.create(); P.x = x; P.z = z; P.y = CITY.groundY(x, z); P.angle = angle; P.camYaw = angle; }
  function giveWeapon(key, ammo) { if (!(key in P.weapons)) { P.weapons[key] = 0; P.weapon = key; } if (WEAPONS[key].melee) P.weapons[key] = Infinity; else P.weapons[key] += ammo; P.weaponOut = !WEAPONS[P.weapon].melee || P.weapon === 'bat'; }
  function addMoney(n, why) { P.money += n; if (n > 0) P.stats.cash += n; HUD.money(n, why); if (n > 0) AUDIO.play('cash'); }
  function cycleWeapon(dir) { const have = WEAPON_ORDER.filter(k => k in P.weapons && (P.weapons[k] > 0)); if (!have.length) return; let i = have.indexOf(P.weapon); i = (i + dir + have.length) % have.length; P.weapon = have[i]; P.weaponOut = P.weapon !== 'fist'; AUDIO.play('click'); }

  function hurt(amount, how, source) {
    if (!P.alive || P.invuln > 0) return; if (how === 'melee' && P.car) return;
    let a = amount; if (P.armor > 0) { const ab = Math.min(P.armor, a * 0.7); P.armor -= ab; a -= ab; }
    P.health -= a; P.hurtFlash = 0.4; if (how === 'shot' && W.rng() < 0.5) AUDIO.play('hit', P.x, P.z);
    if (P.health <= 0) die(source);
  }
  function knock(vx, vy, vz) { if (P.car || !P.alive) return; P.vx += vx; P.vz += vz; P.vy = Math.max(P.vy, vy); P.airborne = true; P.knockT = 1.6; P.state = 'knocked'; P.lying = 0; }
  function die(source) {
    if (!P.alive) return; P.alive = false; P.health = 0; P.deadT = 0; P.stats.wasted++; P.aim = 0;
    if (P.car) { const c = P.car; c.driver = null; c.ai.mode = 'parked'; P.x = c.x; P.z = c.z; }
    P.state = 'dead'; P.lying = 0; P.fallDir = 1; AUDIO.play('wasted'); HUD.big('WASTED', '#c0281e'); MISSIONS.onPlayerDown('wasted');
  }
  function bust() {
    if (!P.alive || P.state === 'busted') return; P.alive = false; P.state = 'busted'; P.deadT = 0; P.stats.busted++; P.aim = 0;
    if (P.car) { const c = P.car; c.driver = null; c.ai.mode = 'parked'; c.controls.throttle = 0; c.controls.brake = 1; P.x = c.x; P.z = c.z; }
    AUDIO.play('busted'); HUD.big('BUSTED', '#2f66c9'); MISSIONS.onPlayerDown('busted');
  }
  function respawn(where) {
    const p = CITY.nearestPlace(where, P.x, P.z) || CITY.place('hospital'); P.x = p.x + 3; P.z = p.z; P.y = CITY.groundY(P.x, P.z); P.angle = Math.PI; P.camYaw = P.angle;
    P.health = 100; P.alive = true; P.state = 'foot'; P.car = null; P.vx = P.vz = P.vy = 0; P.airborne = false; P.lying = 0; P.knockT = 0; P.invuln = 2;
    const fee = Math.min(P.money, Math.max(200, Math.floor(P.money * 0.1))); if (fee > 0) addMoney(-fee, where === 'police' ? 'bail' : 'hospital bill');
    if (where === 'police') { for (const k in P.weapons) if (!WEAPONS[k].melee) P.weapons[k] = Math.floor(P.weapons[k] * 0.5); }
    POLICE.clear(); HUD.clearBig();
  }

  // ---- Shooting (shared with NPCs)
  function fireBullet(shooter, x, z, y, angle, wp, dmgScale = 1, ignore = null) {
    const n = wp.pellets || 1; const shooterIsPlayer = shooter === PLAYER || shooter === P; if (shooterIsPlayer) shooter = PLAYER;
    for (let i = 0; i < n; i++) {
      const a = angle + (W.rng() - 0.5) * 2 * (wp.spread || 0) * (shooterIsPlayer && P.car ? 2 : 1); const dx = Math.sin(a), dz = Math.cos(a);
      const hit = W.raycast(x, z, dx, dz, wp.range, ignore || (shooterIsPlayer ? P.car : shooter), y);
      let hx = hit.x, hz = hit.z, hy = y;
      // player check for NPC shooters
      if (!shooterIsPlayer && P.alive) { const pr = P.car ? 1.6 : 0.55; const t = M.rayCircle2(x, z, dx * wp.range, dz * wp.range, P.x, P.z, pr); if (t >= 0 && t < hit.t) { hit.kind = P.car ? 'playercar' : 'player'; hit.t = t; hx = x + dx * wp.range * t; hz = z + dz * wp.range * t; } }
      if (hit.kind === 'ped') { hit.obj.damage(wp.dmg * dmgScale, shooter, [dx, dz]); }
      else if (hit.kind === 'car') { hit.obj.damage(wp.dmg * (wp.carDmg || 2) * dmgScale, shooter); W.FX.spark(hx, 0.9, hz, 4); if (W.rng() < 0.3) W.FX.glass(hx, 1.2, hz, 4); if (hit.obj.driver && hit.obj.driver !== PLAYER && hit.obj.ai.mode === 'traffic') { hit.obj.scared = 6; hit.obj.ai.mode = 'flee'; } if (hit.obj.driver === PLAYER) hurt(wp.dmg * 0.25 * dmgScale, 'shot', shooter); }
      else if (hit.kind === 'player') { hurt(wp.dmg * dmgScale * 0.45, 'shot', shooter); W.FX.blood(P.x, 1.2, P.z, 4, [dx, dz]); }
      else if (hit.kind === 'playercar') { if (P.car) { P.car.damage(wp.dmg * 1.5 * dmgScale, shooter); W.FX.spark(hx, 0.9, hz, 3); if (W.rng() < 0.2) hurt(wp.dmg * 0.2 * dmgScale, 'shot', shooter); } }
      else if (hit.kind === 'heli') { hit.obj.damage(wp.dmg * dmgScale * 1.2, shooter); W.FX.spark(hx, hit.obj.y, hz, 4); hy = hit.obj.y; }
      else if (hit.kind === 'lot') { W.FX.dust(hx, y, hz, 3); }
      else if (hit.kind === 'prop') { W.FX.spark(hx, y, hz, 4); }
      tracers.push({ x0: x + dx * 0.6, z0: z + dz * 0.6, y0: y, x1: hx, z1: hz, y1: hy, life: 0.05 });
    }
    W.FX.muzzle(x, y, z, Math.sin(angle), Math.cos(angle)); AUDIO.play(wp.sound || 'pistol', x, z); W.noise(x, z, 70, 'shot');
    if (shooterIsPlayer) POLICE.crime('shoot', x, z, null);
  }
  function launchProjectile(kind, x, y, z, angle, pitch, speed) { projectiles.push({ kind, x, y, z, vx: Math.sin(angle) * Math.cos(pitch) * speed, vy: Math.sin(pitch) * speed, vz: Math.cos(angle) * Math.cos(pitch) * speed, life: kind === 'grenade' ? 2.2 : 5, owner: PLAYER }); }
  function updateProjectiles(dt) {
    let w = 0;
    for (const p of projectiles) {
      p.life -= dt; const ox = p.x, oz = p.z;
      if (p.kind === 'grenade') { p.vy -= 20 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const g = CITY.groundY(p.x, p.z); if (p.y < g + 0.15) { p.y = g + 0.15; p.vy = -p.vy * 0.35; p.vx *= 0.7; p.vz *= 0.7; } const res = W.pushOut(p.x, p.z, 0.2); if (res.hit) { p.x = res.x; p.z = res.z; p.vx = -p.vx * 0.5; p.vz = -p.vz * 0.5; } if (p.life <= 0) { explodeAt(p.x, p.y, p.z, 1, PLAYER); continue; } }
      else { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (W.state.frame % 2 === 0) W.FX.smoke(p.x, p.y, p.z, 1); W.dyn.push({ x: p.x, y: p.y, z: p.z, r: 10, col: [1, 0.6, 0.2] });
        const dx = p.x - ox, dz = p.z - oz; const len = Math.hypot(dx, dz); let boom = p.life <= 0 || p.y < CITY.groundY(p.x, p.z);
        if (!boom && len > 0) { const hit = W.raycast(ox, oz, dx / len, dz / len, len, P.car, p.y); if (hit.kind !== 'none' && hit.kind !== 'lot' || (hit.kind === 'lot' && p.y < hit.obj.h)) boom = true; }
        if (!boom && W.heli && !W.heli.dead && M.dist(p.x, p.z, W.heli.x, W.heli.z) < 4 && Math.abs(p.y - W.heli.y) < 3) { boom = true; W.heli.damage(600, PLAYER); }
        if (boom) { explodeAt(p.x, p.y, p.z, 1.3, PLAYER); continue; } }
      projectiles[w++] = p;
    }
    projectiles.length = w;
    let t = 0; for (const tr of tracers) { tr.life -= dt; if (tr.life > 0) tracers[t++] = tr; } tracers.length = t;
  }
  function explodeAt(x, y, z, big, source) {
    W.FX.explosion(x, y, z, big); AUDIO.play('explosion', x, z); W.noise(x, z, 120, 'explosion');
    const R = 7 * big;
    for (const c of W.cars) { if (c.removed) continue; const d = M.dist(c.x, c.z, x, z); if (d < R + 2) { c.lastHitBy = source; c.damage(950 * (1 - d / (R + 2)) + 260, source); c.vy = 5; c.airborne = true; const k = (R + 2 - d) * 1.5; c.vx += (c.x - x) / (d + 0.1) * k; c.vz += (c.z - z) / (d + 0.1) * k; } }
    for (const p of W.peds) { if (!p.alive || p.inCar) continue; const d = M.dist(p.x, p.z, x, z); if (d < R) { p.die(source, 'explosion'); p.launch((p.x - x) / (d + 0.1) * 7, 6, (p.z - z) / (d + 0.1) * 7); } else if (d < 40) p.scare(x, z); }
    if (P.alive) { const d = M.dist(P.x, P.z, x, z); if (d < R + 1 && !P.car) { hurt(100 * (1 - d / (R + 1)), 'explosion', source); knock((P.x - x) / (d + 0.1) * 7, 6, (P.z - z) / (d + 0.1) * 7); } else if (d < R + 1 && P.car) P.car.damage(300 * (1 - d / (R + 1)), source); }
    if (W.heli && !W.heli.dead && M.dist(W.heli.x, W.heli.z, x, z) < R && Math.abs(W.heli.y - y) < 5) W.heli.damage(700, source);
    for (const pr of CITY.solidProps) if (!pr.down && M.dist2(pr.x, pr.z, x, z) < R * R && (pr.kind === 'lamppost' || pr.kind === 'bin' || pr.kind === 'hydrant')) W.knockProp(pr, (pr.x - x), (pr.z - z));
    POLICE.crime('explosion', x, z, null);
  }
  // Auto-aim: snap the shot toward the nearest ped/car within a small cone of the camera direction.
  function aimAngle() {
    const base = P.camYaw; let best = base, bd = 0.14; const cx = P.x, cz = P.z;
    const consider = (x, z, bonus) => { const d = M.dist(x, z, cx, cz); if (d > 55 || d < 1) return; const a = Math.atan2(x - cx, z - cz); const da = Math.abs(M.angleTo(base, a)) - bonus; if (da < bd) { bd = da; best = a; } };
    for (const p of W.peds) if (p.alive && !p.inCar) consider(p.x, p.z, p.isCop || p.hostile || p.isGang ? 0.03 : 0);
    if (W.heli && !W.heli.dead) consider(W.heli.x, W.heli.z, 0.05);
    return best;
  }

  // ---- Update
  function update(dt) {
    P.stateT += dt; if (P.hurtFlash > 0) P.hurtFlash -= dt; if (P.invuln > 0) P.invuln -= dt; if (P.fireT > 0) P.fireT -= dt; if (P.carNameT > 0) P.carNameT -= dt;
    const m = INPUT.mouse, pad = INPUT.pad;
    // camera look
    P.camIdle += dt; if (INPUT.locked || pad.active) { const sens = 0.0022 * GAME.options.sensitivity; const inv = GAME.options.invertY ? -1 : 1; P.camYaw -= m.dx * sens + pad.rx * 2.5 * dt; P.camPitch = M.clamp(P.camPitch + (m.dy * sens * 0.8 + pad.ry * 1.5 * dt) * inv, -0.35, 1.1); if (m.dx || m.dy || pad.rx) P.camIdle = 0; }
    if (!P.alive) { P.deadT += dt; if (P.state === 'dead') { P.lying = Math.min(1, P.lying + dt * 3); moveBody(dt, true); } if (P.deadT > 4.5) respawn(P.state === 'busted' ? 'police' : 'hospital'); updateCamera(dt); return; }
    if (P.state === 'entering') { updateEntering(dt); updateCamera(dt); return; }
    if (P.state === 'knocked') { P.knockT -= dt; P.lying = Math.min(1, P.lying + dt * 4); moveBody(dt, true); if (P.knockT <= 0) { P.state = 'foot'; P.lying = 0; } updateCamera(dt); return; }
    if (P.lying > 0) P.lying = Math.max(0, P.lying - dt * 3);
    // weapon selection
    if (m.wheel) cycleWeapon(m.wheel > 0 ? 1 : -1); if (INPUT.hit('KeyQ')) cycleWeapon(-1); if (INPUT.hit('KeyE')) cycleWeapon(1); if (pad.pressed[5]) cycleWeapon(1); if (pad.pressed[4]) cycleWeapon(-1);
    for (let i = 0; i < WEAPON_ORDER.length; i++) if (INPUT.hit('Digit' + (i + 1)) && WEAPON_ORDER[i] in P.weapons && P.weapons[WEAPON_ORDER[i]] > 0) { P.weapon = WEAPON_ORDER[i]; P.weaponOut = P.weapon !== 'fist'; }
    if (P.car) updateInCar(dt); else updateOnFoot(dt);
    updateCamera(dt);
  }
  function inputMove() {
    const pad = INPUT.pad; let ix = 0, iz = 0;
    if (INPUT.down('KeyW') || INPUT.down('ArrowUp')) iz += 1; if (INPUT.down('KeyS') || INPUT.down('ArrowDown')) iz -= 1; if (INPUT.down('KeyD') || INPUT.down('ArrowRight')) ix += 1; if (INPUT.down('KeyA') || INPUT.down('ArrowLeft')) ix -= 1;
    if (pad.active) { ix += pad.lx; iz -= pad.ly; }
    const l = Math.hypot(ix, iz); if (l > 1) { ix /= l; iz /= l; } return [ix, iz];
  }
  function updateOnFoot(dt) {
    const [ix, iz] = inputMove(); const pad = INPUT.pad; const wp = WEAPONS[P.weapon];
    const sprint = INPUT.down('ShiftLeft') || INPUT.down('ShiftRight') || pad.buttons[0];
    const firing = (INPUT.mouse.buttons & 1) || pad.rt > 0.5 || INPUT.down('ControlLeft');
    P.aim = ((INPUT.mouse.buttons & 2) || pad.lt > 0.5 || firing) && !wp.melee ? 1 : 0;
    // camera-relative movement
    const fy = P.camYaw; const fwd = [Math.sin(fy), Math.cos(fy)], right = [-Math.cos(fy), Math.sin(fy)];
    let mx = fwd[0] * iz + right[0] * ix, mz = fwd[1] * iz + right[1] * ix; const moving = Math.hypot(mx, mz) > 0.01;
    const speed = P.aim ? 2.6 : sprint ? 7.2 : 3.6;
    if (moving && !P.airborne) { P.vx = mx * speed; P.vz = mz * speed; } else if (!P.airborne) { P.vx *= Math.max(0, 1 - 12 * dt); P.vz *= Math.max(0, 1 - 12 * dt); }
    // facing
    if (P.aim) P.angle += M.angleTo(P.angle, P.camYaw) * Math.min(1, 18 * dt);
    else if (moving) { const desired = Math.atan2(mx, mz); P.angle += M.angleTo(P.angle, desired) * Math.min(1, 14 * dt); }
    // jump
    if ((INPUT.hit('Space') || pad.pressed[1]) && !P.airborne) { P.vy = 6.5; P.airborne = true; }
    // enter car
    if (INPUT.hit('KeyF') || pad.pressed[2]) tryEnterCar();
    // attack
    if (firing && P.fireT <= 0) attack(wp);
    if (INPUT.hit('KeyR') && !wp.melee) AUDIO.play('reload');
    moveBody(dt, false);
    P.speed = Math.hypot(P.vx, P.vz); P.phase += dt * (P.speed > 4 ? 11 : 7) * Math.min(1, P.speed / 1.2);
    P.stats.distance += P.speed * dt;
    // hit by cars
    for (const c of W.cars) { if (c.removed || c === P.car) continue; const spd = c.absSpeed; if (spd < 2.5) continue; if (M.dist2(c.x, c.z, P.x, P.z) > 36) continue; const [lf, ll] = c.local(P.x, P.z); if (Math.abs(lf) < c.spec.len / 2 + 0.4 && Math.abs(ll) < c.spec.wid / 2 + 0.35) { const d = [c.vx / spd, c.vz / spd]; hurt(Math.max(0, spd - 2.5) * 6, 'car', c); knock(d[0] * spd * 0.8, Math.min(8, spd * 0.45), d[1] * spd * 0.8); AUDIO.play('bump', P.x, P.z); c.damage(2, null); if (c.ai.mode === 'traffic') { c.scared = 5; c.ai.mode = 'flee'; } break; } }
  }
  function attack(wp) {
    if (wp.melee) {
      P.fireT = wp.rate; P.punchT = 0.3; P.angle = P.camYaw; AUDIO.play('punch', P.x, P.z);
      const f = [Math.sin(P.angle), Math.cos(P.angle)]; let hitSomething = false;
      for (const p of W.peds) { if (!p.alive || p.inCar) continue; const dx = p.x - P.x, dz = p.z - P.z; const d = Math.hypot(dx, dz); if (d < wp.range && (dx * f[0] + dz * f[1]) / (d || 1) > 0.5) { p.damage(wp.dmg, PLAYER, f); if (!p.alive || W.rng() < 0.35) { p.knockT = Math.max(p.knockT, 1.2); if (p.alive) p.state = 'knocked'; p.launch(f[0] * 2, 1.5, f[1] * 2); } hitSomething = true; break; } }
      if (!hitSomething) for (const c of W.cars) { if (c.removed) continue; const [lf, ll] = c.local(P.x, P.z); if (Math.abs(lf) < c.spec.len / 2 + wp.range && Math.abs(ll) < c.spec.wid / 2 + wp.range) { c.damage(wp.dmg * 1.5, PLAYER); W.FX.glass(P.x + f[0] * 0.8, 1.2, P.z + f[1] * 0.8, 5); AUDIO.play('crash', P.x, P.z, 0.3); if (c.driver && c.driver !== P && c.ai.mode === 'traffic') { c.scared = 6; c.ai.mode = 'flee'; } if (c.ai.mode === 'parked' && !c.playerOwned) POLICE.crime('vandal', P.x, P.z, null); break; } }
      return;
    }
    if (P.weapons[P.weapon] <= 0) { AUDIO.play('click'); P.fireT = 0.3; return; }
    P.fireT = wp.rate; P.weapons[P.weapon]--; P.recoil = 0.12; P.angle = P.camYaw;
    const y = 1.35; const ang = aimAngle();
    if (wp.projectile) { const pitch = -P.camPitch * 0.6 + (wp.projectile === 'grenade' ? 0.45 : 0.05); launchProjectile(wp.projectile, P.x + Math.sin(ang) * 0.8, y, P.z + Math.cos(ang) * 0.8, ang, pitch, wp.projectile === 'grenade' ? 14 : 45); AUDIO.play(wp.sound || 'click', P.x, P.z); }
    else fireBullet(PLAYER, P.x, P.z, y, ang, wp, 1);
    if (P.weapons[P.weapon] <= 0) { P.weapons[P.weapon] = 0; setTimeout(() => cycleWeapon(-1), 300); }
  }
  function moveBody(dt, ragdoll) {
    if (P.airborne) { P.vy -= 22 * dt; P.y += P.vy * dt; if (ragdoll) { P.vx *= Math.max(0, 1 - 0.5 * dt); P.vz *= Math.max(0, 1 - 0.5 * dt); } }
    else if (ragdoll) { P.vx *= Math.max(0, 1 - 6 * dt); P.vz *= Math.max(0, 1 - 6 * dt); }
    P.x += P.vx * dt; P.z += P.vz * dt;
    const g = CITY.groundY(P.x, P.z);
    if (P.airborne) { if (P.y <= g) { P.y = g; P.airborne = false; P.vy = 0; if (ragdoll) { P.vx *= 0.3; P.vz *= 0.3; } } } else P.y = g;
    const res = W.pushOut(P.x, P.z, 0.42); P.x = res.x; P.z = res.z;
    // cars are solid
    for (const c of W.cars) { if (c.removed || c === P.car) continue; if (M.dist2(c.x, c.z, P.x, P.z) > 64) continue; for (const [cx, cz, r] of c.circles()) { const dx = P.x - cx, dz = P.z - cz; const rr = r + 0.4; const d2 = dx * dx + dz * dz; if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); P.x = cx + dx / d * rr; P.z = cz + dz / d * rr; } } }
    // ped bodies push a little
    for (const p of W.peds) { if (!p.alive || p.inCar) continue; const dx = P.x - p.x, dz = P.z - p.z; const d2 = dx * dx + dz * dz; if (d2 < 0.64 && d2 > 1e-6) { const d = Math.sqrt(d2); const push = (0.8 - d) * 0.5; P.x += dx / d * push; P.z += dz / d * push; p.x -= dx / d * push; p.z -= dz / d * push; } }
  }
  // ---- Cars
  function tryEnterCar() {
    let best = null, bd = 5.5;
    const want = MISSIONS.S.blip && MISSIONS.S.blip.obj; // the mission's car wins a tie with the one you just left
    for (const c of W.cars) { if (c.removed || c.wrecked) continue; let d = M.dist(c.x, c.z, P.x, P.z) - c.spec.len * 0.25; if (c === want) d -= 1.5; if (d < bd) { bd = d; best = c; } }
    if (!best) return; if (best.locked) { HUD.notify('This car is locked.'); return; }
    P.state = 'entering'; P.stateT = 0; P.targetCar = best; P.aim = 0;
    const r = best.right; P.doorSide = ((P.x - best.x) * r[0] + (P.z - best.z) * r[1]) > 0 ? 1 : -1; // use whichever door is nearer
  }
  function updateEntering(dt) {
    const c = P.targetCar; if (!c || c.removed || c.wrecked) { P.state = 'foot'; return; }
    const r = c.right; const side = P.doorSide || -1; const doorX = c.x + r[0] * side * (c.spec.wid / 2 + 0.6), doorZ = c.z + r[1] * side * (c.spec.wid / 2 + 0.6);
    const d = M.dist(P.x, P.z, doorX, doorZ);
    if (d > 0.5 && P.stateT < 2.2 && c.absSpeed < 4) { const s = 4.5; P.vx = (doorX - P.x) / d * s; P.vz = (doorZ - P.z) / d * s; P.angle += M.angleTo(P.angle, Math.atan2(doorX - P.x, doorZ - P.z)) * Math.min(1, 12 * dt); moveBody(dt, false); P.speed = s; P.phase += dt * 7; return; }
    if (d > 2.5 || c.absSpeed >= 4) { P.state = 'foot'; P.vx = P.vz = 0; return; }
    // get in
    P.speed = 0; P.vx = P.vz = 0; AUDIO.play('door', P.x, P.z);
    if (c.driver && c.driver !== PLAYER) { const d0 = c.driver; d0.exitCar(); d0.x = c.x + r[0] * (c.spec.wid / 2 + 1.0); d0.z = c.z + r[1] * (c.spec.wid / 2 + 1.0); d0.knockT = 1.5; d0.state = 'knocked'; d0.launch(r[0] * 2, 2, r[1] * 2); d0.fear = 8; d0.threat = [c.x, c.z]; if (d0.isCop) { d0.hostile = true; POLICE.crime('cop', c.x, c.z, d0); } else { if (W.rng() < 0.5) d0.say(W.rng() < 0.5 ? 'My car!' : 'Hey! Thief!'); POLICE.crime('jack', c.x, c.z, null); } P.stats.carsStolen++; }
    else if (!c.playerOwned && c.ai.mode !== 'parked') P.stats.carsStolen++;
    for (const px of c.passengers.slice()) if (px.role !== 'crew') { px.exitCar(); px.scare(c.x, c.z); }
    c.driver = PLAYER; c.ai.mode = 'player'; c.ai.edge = null; c.playerOwned = true; c.scared = 0; P.car = c; P.state = 'car'; P.inCarT = 0; P.x = c.x; P.z = c.z; P.lastCarName = c.name; P.carNameT = 3; P.weaponOut = false; P.aim = 0;
    if (c.type === 'police' || c.type === 'swat') c.siren = false;
    if (AUDIO.radioStation !== P.radio) AUDIO.setRadio(P.radio);
    MISSIONS.onEnterCar(c);
  }
  function exitCar() {
    const c = P.car; if (!c) return; const r = c.right; const spd = c.absSpeed;
    P.x = c.x - r[0] * (c.spec.wid / 2 + 0.9); P.z = c.z - r[1] * (c.spec.wid / 2 + 0.9); P.y = CITY.groundY(P.x, P.z); P.angle = c.angle; P.camYaw = c.angle; P.vx = 0; P.vz = 0;
    c.driver = null; c.ai.mode = 'parked'; c.controls.throttle = 0; c.controls.brake = spd > 4 ? 0 : 1; c.controls.handbrake = 0; c.siren = false; P.car = null; P.state = 'foot'; AUDIO.play('door', P.x, P.z);
    if (spd > 7) { knock(c.vx * 0.5, 3, c.vz * 0.5); hurt(spd * 1.5, 'fall', null); }
    P.weaponOut = P.weapon !== 'fist';
    MISSIONS.onExitCar(c);
  }
  function updateInCar(dt) {
    const c = P.car, pad = INPUT.pad; P.inCarT += dt; P.x = c.x; P.z = c.z; P.y = c.y;
    if (c.wrecked) { exitCar(); return; }
    // raw axes: steering and throttle are independent in a car, never normalised together
    let ix = 0, iz = 0;
    if (INPUT.down('KeyW') || INPUT.down('ArrowUp')) iz += 1; if (INPUT.down('KeyS') || INPUT.down('ArrowDown')) iz -= 1; if (INPUT.down('KeyD') || INPUT.down('ArrowRight')) ix += 1; if (INPUT.down('KeyA') || INPUT.down('ArrowLeft')) ix -= 1;
    if (pad.active) { ix = M.clamp(ix + pad.lx, -1, 1); iz = M.clamp(iz - pad.ly, -1, 1); }
    const ctl = c.controls;
    const fwdIn = Math.max(0, iz) + pad.rt, backIn = Math.max(0, -iz) + pad.lt;
    if (fwdIn > 0) { if (c.speed < -0.5) { ctl.throttle = 0; ctl.brake = fwdIn; ctl.reverse = false; } else { ctl.throttle = fwdIn; ctl.brake = 0; } }
    else if (backIn > 0) { if (c.speed > 0.5) { ctl.throttle = 0; ctl.brake = backIn; } else { ctl.throttle = 0; ctl.brake = backIn; } }
    else { ctl.throttle = 0; ctl.brake = 0; }
    ctl.steer = ix; ctl.handbrake = (INPUT.down('Space') || pad.buttons[0]) ? 1 : 0;
    if (INPUT.down('KeyH') || pad.buttons[3]) { if (c.horn <= 0) { c.horn = 0.5; AUDIO.play('horn', c.x, c.z, 0.5); } }
    if ((c.type === 'police' || c.type === 'swat') && (INPUT.hit('KeyL') || pad.pressed[9])) c.siren = !c.siren;
    if (INPUT.hit('KeyR') || pad.pressed[8]) { P.radio = (AUDIO.radioStation + 1) % AUDIO.STATIONS.length; AUDIO.setRadio(P.radio); HUD.notify('RADIO: ' + AUDIO.STATIONS[P.radio]); }
    if (INPUT.hit('KeyF') || pad.pressed[2]) { exitCar(); return; }
    // drive-by shooting with a one-handed weapon
    const wp = WEAPONS[P.weapon]; const firing = (INPUT.mouse.buttons & 1) || INPUT.down('ControlLeft');
    if (firing && P.fireT <= 0 && (P.weapon === 'pistol' || P.weapon === 'uzi') && P.weapons[P.weapon] > 0) { P.fireT = wp.rate * 1.2; P.weapons[P.weapon]--; fireBullet(PLAYER, c.x + c.fwd[0] * 0.5, c.z + c.fwd[1] * 0.5, 1.2, aimAngle(), wp, 1, c); }
    P.stats.distance += c.absSpeed * dt;
    // stunt jumps
    if (c.airborne) { if (P.airT === 0) { P.jumpRamp = -1; CITY.ramps.forEach((r, i) => { if (M.dist(c.x, c.z, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2) < 14) P.jumpRamp = i; }); } P.airT += dt; }
    else if (P.airT > 0) { if (P.airT > 0.85 && c.absSpeed > 8) { let bonus = Math.floor(P.airT * 500); P.stats.stunts++; if (P.jumpRamp >= 0 && !P.stats.jumps.includes(P.jumpRamp)) { P.stats.jumps.push(P.jumpRamp); bonus += 1000; HUD.big('UNIQUE STUNT!  ' + P.stats.jumps.length + '/' + CITY.ramps.length, '#f5c542', 2.2); AUDIO.play('missionPass'); } else HUD.big('INSANE STUNT!', '#f5c542', 1.6); addMoney(bonus, 'stunt bonus'); } P.airT = 0; }
    // engine sound
    const rpm = M.clamp(Math.abs(c.speed) / c.spec.top, 0, 1); AUDIO.engine(true, rpm * 0.7 + ctl.throttle * 0.25 + 0.05, ctl.throttle, c.type); AUDIO.screech(c.skid && !c.airborne ? Math.min(1, Math.abs(c.lat) / 6 + (ctl.handbrake ? 0.4 : 0)) : 0);
    if (c.skid && !c.airborne && W.state.frame % 2 === 0) { const r = c.right, f = c.fwd; const wz = c.spec.len * 0.3; W.FX.dust(c.x - f[0] * wz + r[0], 0, c.z - f[1] * wz + r[1], 1); W.FX.dust(c.x - f[0] * wz - r[0], 0, c.z - f[1] * wz - r[1], 1); }
  }
  // ---- Camera
  function updateCamera(dt) {
    let tx, ty, tz, dist, yaw, pitch, fov = 62;
    const dlg = MISSIONS.dialogue;
    if (dlg && dlg.focus && dlg.focus.alive) { // cinematic: a slow arc around whoever is talking, framing them and the player, kept out of the walls
      const f = dlg.focus; const t = W.state.elapsed; const mid = [(f.x + P.x) / 2, (f.z + P.z) / 2]; const base = Math.atan2(P.x - f.x, P.z - f.z);
      let best = null;
      for (const off of [Math.PI / 2, -Math.PI / 2, Math.PI * 0.85, -Math.PI * 0.85, 0]) { const a = base + off + Math.sin(t * 0.25) * 0.3; for (const dist of [4.2, 3.2, 2.4]) { const cx = mid[0] + Math.sin(a) * dist, cz = mid[1] + Math.cos(a) * dist; if (CITY.insideLot(cx, cz) || !W.los(cx, cz, f.x, f.z) || !W.los(cx, cz, P.x, P.z)) continue; best = [cx, cz]; break; } if (best) break; }
      if (!best) best = [mid[0] + Math.sin(base) * 2, mid[1] + Math.cos(base) * 2];
      const cy = 1.7 + Math.sin(t * 0.4) * 0.15;
      P.camX = M.lerp(P.camX, best[0], Math.min(1, 3 * dt)); P.camY = M.lerp(P.camY, cy, Math.min(1, 3 * dt)); P.camZ = M.lerp(P.camZ, best[1], Math.min(1, 3 * dt));
      RENDER.setCamera(P.camX, P.camY, P.camZ, f.x * 0.6 + P.x * 0.4, 1.35, f.z * 0.6 + P.z * 0.4, 42 * Math.PI / 180); W.state.camYaw = Math.atan2(f.x - P.camX, f.z - P.camZ); P.angle += M.angleTo(P.angle, Math.atan2(f.x - P.x, f.z - P.z)) * Math.min(1, 6 * dt); f.faceTo && f.faceTo(P.x, P.z, dt); return;
    }
    if (P.car) {
      const c = P.car; const spd = c.absSpeed; const behind = c.speed < -2 && P.camIdle > 1 ? c.angle + Math.PI : c.angle;
      const targetYaw = behind + P.camYawOff;
      if (P.camIdle > 1.2) { P.camYawOff *= Math.max(0, 1 - 3 * dt); P.camYaw += M.angleTo(P.camYaw, behind + P.camYawOff) * Math.min(1, (2.5 + spd * 0.15) * dt); }
      else { P.camYawOff = M.angleTo(behind, P.camYaw); }
      yaw = P.camYaw; pitch = M.clamp(P.camPitch, 0.08, 0.9); dist = 6.5 + c.spec.len * 0.3 + spd * 0.06; tx = c.x; ty = c.y + 1.3; tz = c.z; fov = 62 + spd * 0.25;
    } else {
      yaw = P.camYaw; pitch = P.camPitch; dist = P.aim ? 2.4 : P.camDist; tx = P.x; ty = P.y + 1.45; tz = P.z; fov = P.aim ? 50 : 62;
      if (P.aim) { const r = [-Math.cos(yaw), Math.sin(yaw)]; tx += r[0] * 0.55; tz += r[1] * 0.55; }
      if (!P.alive) { dist = 6; pitch = 0.9; }
    }
    let cx = tx - Math.sin(yaw) * Math.cos(pitch) * dist, cz = tz - Math.cos(yaw) * Math.cos(pitch) * dist, cy = ty + Math.sin(pitch) * dist;
    // collision with buildings: shorten the boom
    const dx = cx - tx, dz = cz - tz; let best = 1;
    for (const l of CITY.lotsNear(tx, tz, dist + 2)) { if (l.h < cy - 0.3 && l.h < ty) continue; const t = M.rayAABB2(tx, tz, dx, dz, l.x0 - 0.3, l.z0 - 0.3, l.x1 + 0.3, l.z1 + 0.3); if (t >= 0 && t < best) { const hy = ty + (cy - ty) * t; if (hy < l.h + 0.3) best = t; } }
    if (best < 1) { cx = tx + dx * best * 0.92; cz = tz + dz * best * 0.92; cy = ty + (cy - ty) * best * 0.92; }
    const gy = CITY.groundY(cx, cz) + 0.5; if (cy < gy) cy = gy;
    // smoothing
    const k = Math.min(1, (P.car ? 14 : 20) * dt);
    if (P.camX === 0 && P.camZ === 0) { P.camX = cx; P.camY = cy; P.camZ = cz; }
    P.camX = M.lerp(P.camX, cx, k); P.camY = M.lerp(P.camY, cy, k); P.camZ = M.lerp(P.camZ, cz, k);
    P.fov = M.lerp(P.fov, fov, Math.min(1, 4 * dt));
    RENDER.setCamera(P.camX, P.camY, P.camZ, tx, ty, tz, P.fov * Math.PI / 180);
    W.state.camYaw = yaw;
  }
  function entity() { if (P.car) return null; PEDS.buildRig(P, P.model, P.bones); P.emis.fill(0); return { mesh: P.mesh, model: P.model, bones: P.bones, emis: P.emis }; }
  function drawFX() { for (const t of tracers) W.fx.line(t.x0, t.y0, t.z0, t.x1, t.y1, t.z1, [1, 0.9, 0.6], 0.9, 0.2); for (const p of projectiles) if (p.kind === 'grenade') W.fx.blob(p.x, CITY.groundY(p.x, p.z) + 0.03, p.z, 0.25, 0.4); }
  function projectileEntities() { const out = []; for (const p of projectiles) { const m = M.create(); if (p.kind === 'grenade') { M.trs(m, p.x, p.y, p.z, 0, 0.5, 0.5, 0.5); out.push({ mesh: GRENADE_MESH(), model: m }); } else { const yaw = Math.atan2(p.vx, p.vz), pitch = -Math.atan2(p.vy, Math.hypot(p.vx, p.vz)); M.trsEuler(m, p.x, p.y, p.z, yaw, pitch, 0); out.push({ mesh: ROCKET_MESH(), model: m }); } } return out; }
  let gm = null, rm = null;
  const GRENADE_MESH = () => gm || (gm = new MESH.Builder().cbox(0, 0, 0, 0.3, 0.35, 0.3, [0.2, 0.3, 0.2]).build());
  const ROCKET_MESH = () => rm || (rm = new MESH.Builder().cbox(0, 0, 0, 0.18, 0.18, 0.9, [0.4, 0.4, 0.42]).cbox(0, 0, 0.5, 0.12, 0.12, 0.2, [0.9, 0.2, 0.1]).build());
  return { P, init, update, updateCamera, giveWeapon, addMoney, hurt, knock, die, bust, respawn, fireBullet, explodeAt, updateProjectiles, entity, drawFX, projectileEntities, exitCar,
    get x() { return P.x; }, get z() { return P.z; }, get y() { return P.y; }, get car() { return P.car; }, get alive() { return P.alive; }, get wanted() { return P.wanted; }, set wanted(v) { P.wanted = v; }, get stats() { return P.stats; }, get health() { return P.health; }, get money() { return P.money; }, get weapons() { return P.weapons; }, get weapon() { return P.weapon; } };
})();
