// GRIFT CITY — the player: on foot, in a car, shooting, dying, and the camera that follows all of it.
'use strict';
const WEAPONS = {
  fist:    { name: 'FISTS', dmg: 12, rate: 0.42, range: 1.8, melee: true },
  camera:  { name: 'CAMERA', dmg: 0, rate: 0.9, range: 40, camera: true },
  bat:     { name: 'BASEBALL BAT', dmg: 30, rate: 0.55, range: 2.2, melee: true },
  pistol:  { name: 'PISTOL', dmg: 24, rate: 0.28, range: 60, spread: 0.018, sound: 'pistol', clip: 17, carDmg: 3 },
  uzi:     { name: 'MICRO SMG', dmg: 11, rate: 0.07, range: 45, spread: 0.055, auto: true, sound: 'uzi', clip: 30, carDmg: 2.5 },
  shotgun: { name: 'SHOTGUN', dmg: 9, pellets: 8, rate: 0.8, range: 24, spread: 0.11, sound: 'shotgun', clip: 6, carDmg: 3 },
  rifle:   { name: 'ASSAULT RIFLE', dmg: 21, rate: 0.1, range: 90, spread: 0.03, auto: true, sound: 'rifle', clip: 30, carDmg: 3 },
  rocket:  { name: 'ROCKET LAUNCHER', dmg: 0, rate: 1.4, range: 150, projectile: 'rocket', sound: 'rocket', clip: 1 },
  grenade: { name: 'GRENADES', dmg: 0, rate: 0.9, range: 30, projectile: 'grenade', clip: 1 },
};
const WEAPON_ORDER = ['fist', 'bat', 'pistol', 'uzi', 'shotgun', 'rifle', 'rocket', 'grenade', 'camera']; // the job camera can be cycled back to after switching away

const PLAYER = (() => {
  const CIRC = new Float64Array(9); // scratch for a car's collision circles, so walking into traffic allocates nothing
  const P = {
    x: 0, z: 0, y: 0, angle: 0, vx: 0, vz: 0, vy: 0, airborne: false, speed: 0, phase: 0, lying: 0, fallDir: 1,
    health: 100, armor: 0, money: 500, wanted: 0, weapons: { fist: Infinity }, weapon: 'fist', magazines: {}, reloadT: 0, reloadDuration: 0, reloadWeapon: null, fireT: 0, weaponOut: false, aim: 0, recoil: 0, punchT: 0,
    crouched: false, crouch: 0, shoulder: 1, evadeT: 0, evadeRecovery: 0, brace: 0, jumpBuffer: 0, coyote: 0,
    car: null, state: 'foot', stateT: 0, alive: true, deadT: 0, look: PEDS.PLAYER_LOOK, mesh: null, bones: null, emis: null, model: null,
    camYaw: 0, camPitch: 0.28, camYawOff: 0, camIdle: 0, camX: 0, camY: 0, camZ: 0, camDist: 5.4, fov: 62,
    stats: { kills: 0, carsStolen: 0, missions: 0, distance: 0, packages: 0, stunts: 0, busted: 0, wasted: 0, cash: 0, jumps: [] },
    hurtFlash: 0, knockT: 0, enterTarget: null, targetCar: null, invuln: 0, lastGround: 0, inCarT: 0, airT: 0, stuntBonus: 0, sprintT: 0, radio: 1, headBob: 0, lastCarName: '', carNameT: 0,
  };
  const projectiles = []; const tracers = [];
  const tmp = M.create();

  const OUTFITS = [{ name: 'Street', shirt: [0.85, 0.85, 0.8], jacket: [0.43, 0.30, 0.205], pants: [0.2, 0.2, 0.25] }, { name: 'Suit', shirt: [0.95, 0.95, 0.95], jacket: [0.1, 0.1, 0.13], pants: [0.1, 0.1, 0.13] }, { name: 'Tracksuit', shirt: [0.9, 0.9, 0.9], jacket: [0.12, 0.32, 0.7], pants: [0.12, 0.32, 0.7] }, { name: 'Leather', shirt: [0.3, 0.3, 0.32], jacket: [0.08, 0.07, 0.07], pants: [0.15, 0.1, 0.08] }, { name: 'Bowling shirt', shirt: [0.9, 0.45, 0.2], jacket: [0.95, 0.8, 0.3], pants: [0.25, 0.22, 0.2] }];
  function setOutfit(i) { const o = OUTFITS[i % OUTFITS.length]; P.outfit = i % OUTFITS.length; P.look.bomber=P.outfit===0;P.look.tailored=P.outfit===1;P.look.shirt = o.shirt; P.look.jacket = o.jacket; P.look.pants = o.pants; P.mesh = PEDS.getMesh(P.look); }
  function init(x, z, angle) { P.mesh = PEDS.getMesh(P.look); P.bones = new Float32Array(16 * RENDER.MAX_BONES); P.emis = new Float32Array(RENDER.MAX_BONES); P.model = M.create(); P.x = x; P.z = z; P.y = CITY.groundY(x, z); P.angle = angle; P.camYaw = angle; }
  function giveWeapon(key, ammo) { if (!(key in P.weapons)) { P.weapons[key] = 0; P.weapon = key; } if (WEAPONS[key].melee) P.weapons[key] = Infinity; else P.weapons[key] += ammo; P.weaponOut = !WEAPONS[P.weapon].melee || P.weapon === 'bat'; }
  function addMoney(n, why) { P.money = Math.max(0, P.money + n); /* no debt: a charge takes what you have */ if (n > 0) P.stats.cash += n; HUD.money(n, why); if (n > 0) AUDIO.play('cash'); }
  function cycleWeapon(dir) { const have = WEAPON_ORDER.filter(k => k in P.weapons && (P.weapons[k] > 0)); if (!have.length) return; let i = have.indexOf(P.weapon); i = (i + dir + have.length) % have.length; P.weapon = have[i]; P.weaponOut = P.weapon !== 'fist'; AUDIO.play('click'); }

  function magazine(key = P.weapon) {
    const wp = WEAPONS[key]; if (!wp.clip || wp.projectile) return P.weapons[key] || 0;
    if (P.magazines[key] === undefined) P.magazines[key] = Math.min(wp.clip, P.weapons[key] || 0);
    return P.magazines[key] = Math.min(P.magazines[key], P.weapons[key] || 0);
  }
  function reload() {
    const wp = WEAPONS[P.weapon];
    if (!wp.clip || wp.projectile || P.reloadT > 0 || magazine() >= Math.min(wp.clip, P.weapons[P.weapon] || 0)) return false;
    P.reloadWeapon = P.weapon; P.reloadDuration = wp === WEAPONS.shotgun ? 2.2 : wp === WEAPONS.rifle ? 1.8 : 1.35;
    P.reloadT = P.reloadDuration; AUDIO.play('reload'); return true;
  }
  function updateWeapon(dt) {
    P.kickPitch=(P.kickPitch||0)*Math.exp(-dt*9);P.kickYaw=(P.kickYaw||0)*Math.exp(-dt*11);P.bloom=Math.max(0,(P.bloom||0)-dt*1.8);if(P.fireT<=0)P.shotRest=(P.shotRest||0)+dt;else P.shotRest=0;if(P.shotRest>.4)P.shotSequence=0;
    P.recoil = Math.max(0, P.recoil-dt*3); P.punchT = Math.max(0, P.punchT-dt);
    if (P.reloadT > 0) {
      if (P.reloadWeapon !== P.weapon || !P.alive) { P.reloadT = 0; P.reloadWeapon = null; return; }
      P.reloadT = Math.max(0, P.reloadT-dt);
      if (P.reloadT === 0) { P.magazines[P.weapon] = Math.min(WEAPONS[P.weapon].clip, P.weapons[P.weapon] || 0); P.reloadWeapon = null; }
    }
  }

  // camera shake: a knock the camera takes and lets go of over a third of a second
  function shake(a) { P.shake = Math.max(P.shake || 0, a); }
  const option = (key, fallback) => typeof GAME !== 'undefined' ? (GAME.options[key] ?? fallback) : fallback;
  const assisted = () => typeof INPUT !== 'undefined' && (INPUT.pad.active || INPUT.touch ? option('controllerAssist',true) : option('mouseAssist',false));
  function hurt(amount, how, source) {
    if (!P.alive || P.invuln > 0) return; if (how === 'melee' && P.car) return;
    let a = amount; if (P.armor > 0) { const ab = Math.min(P.armor, a * 0.7); P.armor -= ab; a -= ab; }
    P.health -= a; P.hurtFlash = 0.4;if(source&&Number.isFinite(source.x)){P.damageDirection=Math.atan2(source.x-P.x,source.z-P.z);P.damageDirectionT=.85;} shake(Math.min(1, a / 35)); if (how === 'shot' && W.rng() < 0.5) AUDIO.play('hit', P.x, P.z);
    if (P.health <= 0) die(source);
  }
  function knock(vx, vy, vz) { if (P.car || !P.alive) return; P.vx += vx; P.vz += vz; P.vy = Math.max(P.vy, vy); P.airborne = true; P.knockT = 1.6; P.state = 'knocked'; P.lying = 0; }
  function die(source) {
    if (!P.alive) return; P.alive = false; P.health = 0; P.deadT = 0; P.stats.wasted++; P.aim = 0;
    if (P.car) { const c = P.car; c.driver = null; c.ai.mode = 'parked'; P.x = c.x; P.z = c.z; }
    P.state = 'dead'; P.lying = 0; P.fallDir = 1; if (!P.car) P.rag = PEDS.makeRagdoll(P, P.vx, 2, P.vz); AUDIO.play('wasted'); HUD.big('WASTED', '#c0281e'); MISSIONS.onPlayerDown('wasted');
  }
  function bust() {
    if (!P.alive || P.state === 'busted') return; P.alive = false; P.state = 'busted'; P.deadT = 0; P.stats.busted++; P.aim = 0;
    P.vx = P.vz = 0; if (P.car) { const c = P.car; c.driver = null; c.ai.mode = 'parked'; c.controls.throttle = 0; c.controls.brake = 1; c.vx = c.vz = 0; c.yawRate = 0; P.x = c.x; P.z = c.z; } // busted means stopped: nothing keeps rolling
    AUDIO.play('busted'); HUD.big('BUSTED', '#2f66c9'); MISSIONS.onPlayerDown('busted');
  }
  function respawn(where) {
    const p = CITY.nearestPlace(where, P.x, P.z) || CITY.place('hospital');
    // Step out of the door toward open street and face it, rather than a fixed heading that often stared at the wall.
    let best = 0, bestOpen = -1; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, fx = Math.sin(a), fz = Math.cos(a); let open = 0; for (let d = 2; d <= 14; d += 2) { if (CITY.insideLot(p.x + fx * d, p.z + fz * d)) break; open++; } if (open > bestOpen) { bestOpen = open; best = a; } }
    P.x = p.x + Math.sin(best) * 3; P.z = p.z + Math.cos(best) * 3; P.y = CITY.groundY(P.x, P.z, P.y); P.angle = best; P.camYaw = P.angle;
    P.health = 100; P.alive = true; P.state = 'foot'; P.car = null; P.rag = null; P.vx = P.vz = P.vy = 0; P.airborne = false; P.lying = 0; P.knockT = 0; P.invuln = 2;P.jumpBuffer=P.coyote=0;P.vault=null;P.vaultPose=0;P.motion=null;
    const gentle = typeof MISSIONS !== 'undefined' && MISSIONS.S.gentleRestart; const fee = gentle ? 0 : Math.min(P.money, Math.max(200, Math.floor(P.money * 0.1))); if (fee > 0) addMoney(-fee, where === 'police' ? 'bail' : 'hospital bill'); // the opening does not bill you
    if (where === 'police') { for (const k in P.weapons) if (!WEAPONS[k].melee) P.weapons[k] = Math.floor(P.weapons[k] * 0.5); }
    POLICE.clear(); HUD.clearBig();
  }

  // ---- Shooting (shared with NPCs)
  function fireBullet(shooter, x, z, y, angle, wp, dmgScale = 1, ignore = null, pitch = 0) {
    const n = wp.pellets || 1; const shooterIsPlayer = shooter === PLAYER || shooter === P; if (shooterIsPlayer) shooter = PLAYER;
    for (let i = 0; i < n; i++) {
      const spread=(wp.spread||0)*(shooterIsPlayer?(P.car?2:(1+P.speed*.16+(P.bloom||0))*(P.crouched?.65:1)):1);const a = angle + (W.rng() - .5)*2*spread; const tilt = pitch + (W.rng() - .5)*spread; const dx = Math.sin(a) * Math.cos(tilt), dz = Math.cos(a) * Math.cos(tilt), dy = Math.sin(tilt);
      const hit = W.raycast3(x, y, z, dx, dy, dz, wp.range, ignore || (shooterIsPlayer ? P.car : shooter));
      let hx = hit.x, hz = hit.z, hy = hit.y;
      // player check for NPC shooters
      if (!shooterIsPlayer && P.alive && !P.car) { const pr = P.car ? 1.6 : 0.55; const t = W.rayBox(x, y, z, dx * wp.range, dy * wp.range, dz * wp.range, P.x-pr, P.y, P.z-pr, P.x+pr, P.y+1.8-P.crouch*.5, P.z+pr); if (t >= 0 && t < hit.t) { hit.kind = P.car ? 'playercar' : 'player'; hit.t = t; hx = x + dx * wp.range * t; hz = z + dz * wp.range * t; hy = y + dy * wp.range * t; } }
      if (hit.kind === 'ped') { const was = hit.obj.alive; hit.obj.damage(wp.dmg * dmgScale, shooter, [dx, dz]); if (shooterIsPlayer) HUD.hitMark(was && !hit.obj.alive); }
      else if (hit.kind === 'car') { hit.obj.damage(wp.dmg * (wp.carDmg || 2) * dmgScale, shooter,{x:hx,y:hy,z:hz,kind:'bullet'}); if (shooterIsPlayer) HUD.hitMark(false); W.FX.spark(hx, 0.9, hz, 4); if (W.rng() < 0.3) W.FX.glass(hx, 1.2, hz, 4); if (hit.obj.driver && hit.obj.driver !== PLAYER && hit.obj.ai.mode === 'traffic') { hit.obj.scared = 6; hit.obj.ai.mode = 'flee'; } if (hit.obj.driver === PLAYER) hurt(wp.dmg * 0.25 * dmgScale, 'shot', shooter); }
      else if (hit.kind === 'player') { hurt(wp.dmg * dmgScale * 0.45, 'shot', shooter); W.FX.blood(P.x, 1.2, P.z, 4, [dx, dz]); }
      else if (hit.kind === 'playercar') { if (P.car) { P.car.damage(wp.dmg * 1.5 * dmgScale, shooter,{x:hx,y:hy,z:hz,kind:'bullet'}); W.FX.spark(hx, 0.9, hz, 3); if (W.rng() < 0.2) hurt(wp.dmg * 0.2 * dmgScale, 'shot', shooter); } }
      else if (hit.kind === 'heli') { hit.obj.damage(wp.dmg * dmgScale * 1.2, shooter); W.FX.spark(hx, hit.obj.y, hz, 4); hy = hit.obj.y; }
      else if (hit.kind === 'lot' || hit.kind === 'ground') { if(hit.obj?.destructible){hit.obj.strength-=wp.dmg*.3;if(hit.obj.strength<=0)STREETS.breakObject(hit.obj,{driver:shooter});} W.FX.dust(hx, hy, hz, 3); }
      else if (hit.kind === 'prop') { W.FX.spark(hx, hy, hz, 4); }
      if(typeof TACTICS!=='undefined')TACTICS.nearShot(shooter,x,y,z,hx,hy,hz);
      tracers.push({ x0: x + dx * 0.6, z0: z + dz * 0.6, y0: y, x1: hx, z1: hz, y1: hy, life: 0.05 });
    }
    W.FX.muzzle(x, y, z, Math.sin(angle), Math.cos(angle)); AUDIO.play(wp.sound || 'pistol', x, z); W.noise(x, z, 70, 'shot');
    if (shooterIsPlayer) POLICE.crime('shoot', x, z, null);
  }
  function launchProjectile(kind, x, y, z, angle, pitch, speed) { projectiles.push({ kind, x, y, z, vx: Math.sin(angle) * Math.cos(pitch) * speed, vy: Math.sin(pitch) * speed, vz: Math.cos(angle) * Math.cos(pitch) * speed, life: kind === 'grenade' ? 2.2 : 5, owner: PLAYER }); }
  function updateProjectiles(dt) {
    let w = 0;
    for (const p of projectiles) {
      p.life -= dt; const ox = p.x, oy = p.y, oz = p.z;
      if (p.kind === 'grenade') { p.vy -= 20 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const g = CITY.groundY(p.x, p.z); if (p.y < g + 0.15) { p.y = g + 0.15; p.vy = -p.vy * 0.35; p.vx *= 0.7; p.vz *= 0.7; } const res = W.pushOut(p.x, p.z, 0.2); if (res.hit) { p.x = res.x; p.z = res.z; p.vx = -p.vx * 0.5; p.vz = -p.vz * 0.5; } if (p.life <= 0) { explodeAt(p.x, p.y, p.z, 1, PLAYER); continue; } }
      else { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (W.state.frame % 2 === 0) W.FX.smoke(p.x, p.y, p.z, 1); W.dyn.push({ x: p.x, y: p.y, z: p.z, r: 10, col: [1, 0.6, 0.2] });
        const dx = p.x - ox, dy = p.y - oy, dz = p.z - oz; const len = Math.hypot(dx, dy, dz); let boom = p.life <= 0 || p.y < CITY.groundY(p.x, p.z);
        if (!boom && len > 0) { const hit = W.raycast3(ox, oy, oz, dx, dy, dz, len, P.car); if (hit.kind !== 'none') { boom = true; p.x = hit.x; p.y = hit.y; p.z = hit.z; } }
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
    for (const p of W.peds) { if (!p.alive || p.inCar || Math.abs(P.y-p.y)>1.5) continue; const d = M.dist(p.x, p.z, x, z); if (d < R) { p.die(source, 'explosion'); p.launch((p.x - x) / (d + 0.1) * 7, 6, (p.z - z) / (d + 0.1) * 7); } else if (d < 40) p.scare(x, z); }
    if (P.alive) { const d = M.dist(P.x, P.z, x, z); if (d < R + 1 && !P.car) { hurt(100 * (1 - d / (R + 1)), 'explosion', source); knock((P.x - x) / (d + 0.1) * 7, 6, (P.z - z) / (d + 0.1) * 7); } else if (d < R + 1 && P.car) P.car.damage(300 * (1 - d / (R + 1)), source); }
    if (W.heli && !W.heli.dead && M.dist(W.heli.x, W.heli.z, x, z) < R && Math.abs(W.heli.y - y) < 5) W.heli.damage(700, source);
    for (const pr of CITY.solidProps) if (!pr.down && M.dist2(pr.x, pr.z, x, z) < R * R && (pr.kind === 'lamppost' || pr.kind === 'bin' || pr.kind === 'hydrant')) W.knockProp(pr, (pr.x - x), (pr.z - z));
    POLICE.crime('explosion', x, z, null);
  }
  // Auto-aim: snap the shot toward the nearest ped/car within a small cone of the camera direction.
  // Shots are resolved along the crosshair line (the camera's centre ray), not from the player's feet: the camera sits
  // half a metre to the side of the player, so a line from the player would miss whatever the crosshair is on.
  function aimOrigin() { if (P.car) return [P.x, P.z]; const dx = Math.sin(P.camYaw), dz = Math.cos(P.camYaw); const along = Math.max(0, (P.x - P.camX) * dx + (P.z - P.camZ) * dz) + 0.3; return [P.camX + dx * along, P.camZ + dz * along]; }
  // Auto-aim: the nearest target within a cone of the crosshair, measured from the crosshair line. P.aimTarget shows the lock.
  function aimAngle(cone = P.aim ? 0.2 : 0.14) {
    const base = P.camYaw; if (!assisted()) { P.aimTarget=null; return base; } let best = base, bd = cone; const [cx, cz] = aimOrigin(); let target = null;
    // The vertical gate is measured along the crosshair ray from the rendered camera. It used to compare the target's
    // pitch from the player's eye with the orbit camera's downward pitch, which at the resting 0.28 rad only let
    // targets within a few metres through.
    const cam = RENDER.cam || {}, camX = cam.x ?? P.x, camZ = cam.z ?? P.z, cy = cam.y ?? P.y + 1.45, fh = Math.hypot((cam.tx ?? camX) - camX, (cam.tz ?? camZ + 1) - camZ) || 1, camPitch = cam.ty !== undefined ? Math.atan2(cam.ty - cy, fh) : -P.camPitch;
    const consider = (x, z, bonus, obj) => { const d = M.dist(x, z, cx, cz); if (d > 60 || d < 0.8) return; const ty = obj === W.heli ? obj.y : (obj.y || 0)+1.2; if (Math.abs(Math.atan2(ty - cy, Math.hypot(x - camX, z - camZ)) - camPitch) > .45 || !W.sight3(P.x,P.y+1.35,P.z,x,ty,z)) return; const a = Math.atan2(x - cx, z - cz); const da = Math.abs(M.angleTo(base, a)) - bonus; if (da < bd && W.los(cx, cz, x, z)) { bd = da; best = a; target = obj; } };
    for (const p of W.peds) if (p.alive && !p.inCar) consider(p.x, p.z, p.isCop || p.hostile || p.isGang ? 0.04 : 0, p);
    if (W.heli && !W.heli.dead) consider(W.heli.x, W.heli.z, 0.05, W.heli);
    P.aimTarget = target; return best;
  }

  // ---- Update
  function update(dt) {
    updateWeapon(dt); P.evadeRecovery=Math.max(0,P.evadeRecovery-dt); P.crouch=M.lerp(P.crouch,P.crouched&&!P.car?1:0,1-Math.exp(-dt*14)); if (INPUT.hit('KeyV') || INPUT.pad.pressed[14]) P.shoulder *= -1; P.landing=Math.max(0,(P.landing||0)-dt*4); P.turnLean=(P.turnLean||0)*Math.exp(-dt*8); P.stateT += dt; if (P.drunk > 0) P.drunk -= dt; if (P.kickT > 0) P.kickT -= dt; if (P.flinchT > 0) P.flinchT -= dt; if (P.hurtFlash > 0) P.hurtFlash -= dt; if (P.invuln > 0) P.invuln -= dt; if (P.fireT > 0) P.fireT -= dt; if (P.carNameT > 0) P.carNameT -= dt;
    const m = INPUT.mouse, pad = INPUT.pad;
    // camera look
    P.camIdle += dt; if (INPUT.locked || pad.active) { const sens = 0.0022 * GAME.options.sensitivity * (P.aim ? option('aimSensitivity',.75) * (assisted() && P.aimTarget ? .72 : 1) : 1); const inv = GAME.options.invertY ? -1 : 1; P.camYaw -= m.dx * sens + pad.rx * 2.5 * dt;
      if (P.aim && !P.car) { const want = aimAngle(0.16); if (P.aimTarget && Math.abs(m.dx) < 6) P.camYaw += M.angleTo(P.camYaw, want) * Math.min(1, 5 * dt); } /* magnetism: the crosshair settles onto a target you are nearly on */ P.camPitch = M.clamp(P.camPitch + (m.dy * sens * 0.8 + pad.ry * 1.5 * dt) * inv, P.aim && !P.car ? -0.2 : -0.35, P.aim && !P.car ? 0.5 : 1.1); if (m.dx || m.dy || pad.rx) P.camIdle = 0; }
    if (!P.alive) { P.deadT += dt; if (P.state === 'dead') { if (P.rag) PEDS.stepRagdoll(P, dt); else { P.lying = Math.min(1, P.lying + dt * 3); moveBody(dt, true); } } if (P.deadT > 4.5) respawn(P.state === 'busted' ? 'police' : 'hospital'); updateCamera(dt); return; }
    if (P.state === 'vaulting') {updateVault(dt);PEDS.updateMotion(P,dt);updateCamera(dt);return;}
    if (P.state === 'entering') { updateEntering(dt); PEDS.updateMotion(P,dt); updateCamera(dt); return; }
    if (P.state === 'knocked') { P.knockT -= dt; P.lying = Math.min(1, P.lying + dt * 4); moveBody(dt, true); if (P.knockT <= 0) { P.state = 'foot'; P.lying = 0; } updateCamera(dt); return; }
    if (P.lying > 0) P.lying = Math.max(0, P.lying - dt * 3);
    // weapon selection
    if (m.wheel) cycleWeapon(m.wheel > 0 ? 1 : -1); if (INPUT.hit('KeyQ')) cycleWeapon(-1); if (INPUT.hit('KeyE')) cycleWeapon(1); if (pad.pressed[5]) cycleWeapon(1); if (pad.pressed[4]) cycleWeapon(-1);
    for (let i = 0; i < WEAPON_ORDER.length; i++) if (INPUT.hit('Digit' + (i + 1)) && WEAPON_ORDER[i] in P.weapons && P.weapons[WEAPON_ORDER[i]] > 0) { P.weapon = WEAPON_ORDER[i]; P.weaponOut = P.weapon !== 'fist'; }
    if (P.car) updateInCar(dt); else updateOnFoot(dt);
    PEDS.updateMotion(P,dt);
    updateCamera(dt);
  }
  function inputMove() {
    const pad = INPUT.pad; let ix = 0, iz = 0;
    if (INPUT.down('KeyW') || INPUT.down('ArrowUp')) iz += 1; if (INPUT.down('KeyS') || INPUT.down('ArrowDown')) iz -= 1; if (INPUT.down('KeyD') || INPUT.down('ArrowRight')) ix += 1; if (INPUT.down('KeyA') || INPUT.down('ArrowLeft')) ix -= 1;
    if (pad.active) { ix += pad.lx; iz -= pad.ly; }
    const l = Math.hypot(ix, iz); if (l > 1) { ix /= l; iz /= l; } return [ix, iz];
  }
  function updateOnFoot(dt) {
    if(P.exitDoor){P.exitDoor.t-=dt;if(P.exitDoor.t<=0){P.exitDoor.car.doorTarget[P.exitDoor.index]=0;P.exitDoor=null;}}
    if(P.exitPose){P.exitPose.t-=dt;if(P.exitPose.t<=0)P.exitPose=null;}
    const speedBefore=P.speed, angleBefore=P.angle;
    const [ix, iz] = inputMove(); const pad = INPUT.pad; const wp = WEAPONS[P.weapon];
    const sprint = INPUT.down('ShiftLeft') || INPUT.down('ShiftRight') || pad.buttons[0];
    const firing = (INPUT.mouse.buttons & 1) || pad.rt > 0.5 || INPUT.down('ControlLeft');
    const aimKey = INPUT.down('AltLeft') || INPUT.down('AltRight') || INPUT.down('KeyC'); // trackpads have no right button: Option/Alt or C aims
    P.aim = ((INPUT.mouse.buttons & 2) || aimKey || pad.lt > 0.5 || firing) && !wp.melee ? 1 : 0;
    // camera-relative movement
    const fy = P.camYaw; const fwd = [Math.sin(fy), Math.cos(fy)], right = [-Math.cos(fy), Math.sin(fy)];
    let mx = fwd[0] * iz + right[0] * ix, mz = fwd[1] * iz + right[1] * ix; const moving = Math.hypot(mx, mz) > 0.01;
    if (P.drunk > 0 && moving) { const k = Math.min(1, P.drunk / 12), w = Math.sin(W.state.elapsed * 1.1) * 0.6 * k; const c = Math.cos(w), s = Math.sin(w); const rx = mx * c + mz * s, rz = -mx * s + mz * c; mx = rx; mz = rz; } // the legs go where they like
    if (INPUT.hit('KeyZ') || pad.pressed[10]) P.crouched=!P.crouched;
    if (sprint && moving) P.crouched=false;
    if ((INPUT.hit('KeyX') || pad.pressed[11]) && !P.airborne && P.evadeRecovery<=0) {
      P.evadeT=.24; P.evadeRecovery=1.05; P.evadeDir=moving?[mx,mz]:[-fwd[0],-fwd[1]];
      P.reloadT=0; P.reloadWeapon=null; P.crouched=false;
    }
    const speed = P.crouched ? 1.65 : P.aim ? 2.4 : sprint ? 6.8 : 3.3;
    // accelerate over a tenth of a second and brake a little softer, so starts and stops read as steps rather than a switch
    if (!P.airborne) { const tx = moving ? mx * speed : 0, tz = moving ? mz * speed : 0; const rate = (moving ? 34 : 26) * dt; P.vx = M.approach(P.vx, tx, rate); P.vz = M.approach(P.vz, tz, rate); }
    P.sprinting = moving && sprint && !P.aim && !P.crouched;
    if (P.evadeT>0) { P.evadeT=Math.max(0,P.evadeT-dt); P.vx=P.evadeDir[0]*8; P.vz=P.evadeDir[1]*8; }
    if (P.aim) aimAngle(0.16); else P.aimTarget = null; // keep the lock indicator honest even when the mouse is still
    // facing
    if (P.aim) P.angle += M.angleTo(P.angle, P.camYaw) * Math.min(1, 18 * dt);
    else if (moving) { const desired = Math.atan2(mx, mz); P.turnLean=M.lerp(P.turnLean,M.clamp(M.angleTo(P.angle,desired)*P.speed*.06,-.15,.15),1-Math.exp(-dt*9)); P.angle += M.angleTo(P.angle, desired) * Math.min(1, 14 * dt); }
    // A short buffer accepts a jump just before landing; coyote time forgives the last step off a ledge.
    P.jumpBuffer=Math.max(0,(P.jumpBuffer||0)-dt);P.coyote=P.airborne?Math.max(0,(P.coyote||0)-dt):.09;
    if(INPUT.hit('Space')||pad.pressed[1])P.jumpBuffer=.12;
    if(P.jumpBuffer>0&&(!P.airborne||P.coyote>0)&&P.evadeT<=0){
      P.jumpBuffer=0;P.coyote=0;if(!P.airborne&&startVault())return;
      P.crouched=false;P.vy=6.5;P.airborne=true;
    }
    // enter car
    if (INPUT.hit('KeyF') || pad.pressed[2]) tryEnterCar();
    // attack
    if (firing && P.fireT <= 0 && P.evadeT<=0) attack(wp);
    if (INPUT.hit('KeyR')) reload();
    moveBody(dt, false);
    P.speed = Math.hypot(P.vx, P.vz); P.accelLean=M.lerp(P.accelLean||0,M.clamp((P.speed-speedBefore)/Math.max(dt,.001)*.009,-.13,.15),1-Math.exp(-dt*10)); P.turnStep=M.lerp(P.turnStep||0,Math.abs(M.angleTo(angleBefore,P.angle))/Math.max(dt,.001),1-Math.exp(-dt*12)); P.phase += dt * M.TAU * PEDS.cadence(Math.max(P.speed,Math.min(.65,(P.turnStep||0)*.10))); // the rig derives its stride from this cadence, so the feet never slide
    P.stats.distance += P.speed * dt;
    { const st = Math.floor(P.phase / Math.PI); if (st !== P.lastStep && P.speed > 0.6 && !P.airborne) { P.lastStep = st; AUDIO.play('step', P.x, P.z, !CITY.interiorRoom); } } // a footfall each half stride
    // hit by cars
    for (const c of W.cars) { if (c.removed || c === P.car || P.y>=c.y+c.spec.hgt || P.y+1.7<=c.y) continue; const spd = c.absSpeed; if (spd < 2.5) continue; if (M.dist2(c.x, c.z, P.x, P.z) > 36) continue; const [lf, ll] = c.local(P.x, P.z); if (Math.abs(lf) < c.spec.len / 2 + 0.4 && Math.abs(ll) < c.spec.wid / 2 + 0.35) { const d = [c.vx / spd, c.vz / spd]; hurt(Math.max(0, spd - 2.5) * 6, 'car', c); knock(d[0] * spd * 0.8, Math.min(8, spd * 0.45), d[1] * spd * 0.8); AUDIO.play('bump', P.x, P.z); c.damage(2, null); if (c.ai.mode === 'traffic') { c.scared = 5; c.ai.mode = 'flee'; } break; } }
  }
  function attack(wp) {
    if (wp.camera) { P.fireT = wp.rate; const f = [Math.sin(P.camYaw), Math.cos(P.camYaw)]; W.FX.spark(P.x + f[0] * 0.6, 1.5, P.z + f[1] * 0.6, 6); AUDIO.play('click'); HUD.fade(0.25); MISSIONS.onPhoto(f[0], f[1]); return; }
    if (wp.melee) {
      P.fireT = wp.rate; P.angle = P.camYaw; AUDIO.play('punch', P.x, P.z); P.combo = (P.combo || 0) + 1; if (P.comboT === undefined || P.stateT - P.comboT > 1.2) P.combo = 1; P.comboT = P.stateT;
      const isKick = wp === WEAPONS.fist && P.combo % 3 === 0; if (isKick) { P.kickT = 0.35; P.punchT = 0; wp = { ...wp, dmg: wp.dmg * 2.2, range: wp.range + 0.3 }; } else P.punchT = 0.3; // every third punch is a kick that puts them down
      const f = [Math.sin(P.angle), Math.cos(P.angle)]; let hitSomething = false;
      for (const p of W.peds) { if (!p.alive || p.inCar || Math.abs(P.y-p.y)>1.5) continue; const dx = p.x - P.x, dz = p.z - P.z; const d = Math.hypot(dx, dz); if (d < wp.range && (dx * f[0] + dz * f[1]) / (d || 1) > 0.5) { p.damage(wp.dmg, PLAYER, f); if (!p.alive || W.rng() < 0.35) { p.knockT = Math.max(p.knockT, 1.2); if (p.alive) p.state = 'knocked'; p.launch(f[0] * 2, 1.5, f[1] * 2); } hitSomething = true; break; } }
      if (!hitSomething) for (const c of W.cars) { if (c.removed) continue; const [lf, ll] = c.local(P.x, P.z); if (Math.abs(lf) < c.spec.len / 2 + wp.range && Math.abs(ll) < c.spec.wid / 2 + wp.range) { c.damage(wp.dmg * 1.5, PLAYER); W.FX.glass(P.x + f[0] * 0.8, 1.2, P.z + f[1] * 0.8, 5); AUDIO.play('crash', P.x, P.z, 0.3); if (c.driver && c.driver !== P && c.ai.mode === 'traffic') { c.scared = 6; c.ai.mode = 'flee'; } if (c.ai.mode === 'parked' && !c.playerOwned) POLICE.crime('vandal', P.x, P.z, null); break; } }
      return;
    }
    if (P.reloadT > 0) return;
    if (!wp.projectile && wp.clip && magazine() <= 0 && P.weapons[P.weapon] > 0) { reload(); return; }
    if (P.weapons[P.weapon] <= 0) { AUDIO.play('click'); P.fireT = 0.3; return; }
    P.fireT = wp.rate; P.weapons[P.weapon]--; if (!wp.projectile && wp.clip) P.magazines[P.weapon]--; P.recoil = .12;const pattern=[-.25,.12,.4,.2,-.3,-.45,.1,.35],kick=P.weapon==='shotgun'?.05:P.weapon==='rifle'?.015:.028;P.shotSequence=(P.shotSequence||0)+1;P.kickPitch=(P.kickPitch||0)-kick;P.kickYaw=(P.kickYaw||0)+pattern[P.shotSequence%pattern.length]*kick*.6;P.bloom=Math.min(.8,(P.bloom||0)+(P.weapon==='rifle'?.13:.2));P.angle = P.camYaw;
    const y = P.y + 1.35 - P.crouch*.43; const ang = aimAngle();
    if (wp.projectile) { const lt = wp.projectile !== 'grenade' && P.aimTarget; const pitch = lt ? Math.atan2((lt === W.heli ? lt.y : (lt.y || 0) + 1) - y, Math.hypot(lt.x - P.x, lt.z - P.z)) : -P.camPitch * 0.6 + (wp.projectile === 'grenade' ? 0.45 : 0.05); launchProjectile(wp.projectile, P.x + Math.sin(ang) * 0.8, y, P.z + Math.cos(ang) * 0.8, ang, pitch, wp.projectile === 'grenade' ? 14 : 45); AUDIO.play(wp.sound || 'click', P.x, P.z); }
    else {
      // Aim from the rendered camera; fire from the body so cover beside the muzzle still blocks shots.
      const cam = RENDER.cam, dx = cam.tx-cam.x, dy = cam.ty-cam.y, dz = cam.tz-cam.z;
      const lock = P.aimTarget && P.aimTarget.alive !== false && !P.aimTarget.dead ? P.aimTarget : null; // a locked target is shot at, not the point behind the crosshair
      const hit = lock ? { x: lock.x, y: lock === W.heli ? lock.y : (lock.y || 0) + 1.2 - (lock.crouch || 0) * .4, z: lock.z } : W.raycast3(cam.x, cam.y, cam.z, dx, dy, dz, wp.range + 8, P.car);
      const ax = hit.x-P.x, ay = hit.y-y, az = hit.z-P.z;
      fireBullet(PLAYER, P.x, P.z, y, Math.atan2(ax, az), wp, 1, null, Math.atan2(ay, Math.hypot(ax, az)));
    }
    if (P.weapons[P.weapon] <= 0) P.weapons[P.weapon] = 0;
  }
  function vaultCandidate() {
    if(typeof STREETS==='undefined')return null;
    const fx=Math.sin(P.camYaw),fz=Math.cos(P.camYaw);
    const reach=1.6+Math.min(.35,(P.speed||0)*.055);
    const h=W.raycast3(P.x,P.y+.65,P.z,fx,0,fz,reach,null,true),o=h.obj;
    if(h.kind!=='lot'||!o.vaultable||o.down||o.h-P.y>1.3||o.h-P.y<.4)return null;
    // Use the actual near/far faces. Refuse long or occupied landings.
    let exit=0;for(let d=h.dist;d<3.2;d+=.1){const x=P.x+fx*d,z=P.z+fz*d;if(x>o.x0-.5&&x<o.x1+.5&&z>o.z0-.5&&z<o.z1+.5)exit=d;}
    const d=exit+.2;if(d>3.1)return null;const x=P.x+fx*d,z=P.z+fz*d,y=CITY.groundY(x,z,P.y);
    if(Math.abs(y-P.y)>.35)return null;const q=W.pushOut(x,z,.43,{y,height:1.8});
    if(q.hit||!W.sight3(P.x,o.h+1,P.z,x,o.h+1,z)||W.cars.some(c=>!c.removed&&Math.abs(c.y-y)<2&&M.dist(c.x,c.z,x,z)<c.spec.len*.6))return null;
    return {x,z,y,top:o.h};
  }
  function startVault() {
    const to=vaultCandidate();if(!to)return false;
    P.vault={from:[P.x,P.y,P.z],to,t:0,speed:P.speed||0};P.state='vaulting';P.airborne=true;
    P.reloadT=0;P.reloadWeapon=null;P.aim=0;P.crouched=false;P.jumpBuffer=P.coyote=0;P.vx=P.vz=0;P.angle=P.camYaw;return true;
  }
  function updateVault(dt) {
    const v=P.vault;v.t+=dt;const t=Math.min(1,v.t/.58),u=t*t*(3-2*t),a=Math.sin(Math.PI*t);
    P.x=M.lerp(v.from[0],v.to.x,u);P.z=M.lerp(v.from[2],v.to.z,u);P.y=M.lerp(v.from[1],v.to.y,u)+a*(v.to.top-v.from[1]+.25);P.vaultPose=a;
    if(t===1){
      P.state='foot';P.airborne=false;P.y=v.to.y;P.vy=0;P.vaultPose=0;P.landing=.35;
      // Preserve momentum only while the player is still asking to move. Releasing the stick lands in place.
      const [ix,iz]=inputMove(),len=Math.hypot(ix,iz),run=INPUT.down('ShiftLeft')||INPUT.down('ShiftRight')||INPUT.pad.buttons[0];
      const speed=len>.1?Math.min(v.speed,run?6.8:3.3):0;
      const mx=Math.sin(P.camYaw)*iz-Math.cos(P.camYaw)*ix,mz=Math.cos(P.camYaw)*iz+Math.sin(P.camYaw)*ix;
      P.vx=mx*speed;P.vz=mz*speed;P.speed=Math.hypot(P.vx,P.vz);P.vault=null;
    }
  }
  function moveBody(dt, ragdoll) {
    const ox=P.x, oz=P.z, oldY=P.y, intended=Math.hypot(P.vx,P.vz);
    if (P.airborne) { P.vy -= 22 * dt; P.y += P.vy * dt; if (ragdoll) { P.vx *= Math.max(0, 1 - 0.5 * dt); P.vz *= Math.max(0, 1 - 0.5 * dt); } }
    else if (ragdoll) { P.vx *= Math.max(0, 1 - 6 * dt); P.vz *= Math.max(0, 1 - 6 * dt); }
    P.x += P.vx * dt; P.z += P.vz * dt;
    if(typeof STREETS !== 'undefined') {const y=STREETS.ceiling(P.x,P.z,oldY,P.y,1.8-P.crouch*.5);if(y<P.y){P.y=y;P.vy=0;}}
    const g = CITY.groundY(P.x, P.z, Math.max(oldY,P.y));
    if (P.airborne) { if (P.y <= g) { const vy = P.vy; P.landing=M.clamp(-vy/9,0,1); P.y = g; P.airborne = false; P.vy = 0; if (ragdoll) { P.vx *= 0.3; P.vz *= 0.3; } if (vy < -12 && P.alive) { hurt((-vy - 10) * 7, 'fall', null); if (P.alive && vy < -16) { knock(P.vx * 0.2, 2, P.vz * 0.2); } } } }
    else if (P.y > g + 0.6) { P.airborne = true; P.vy = 0; } // walked off an edge: fall rather than snap
    else P.y = g;
    const res = W.pushOut(P.x, P.z, 0.42,{y:P.y,height:1.8-P.crouch*.5}); P.x = res.x; P.z = res.z;
    // cars are solid
    for (const c of W.cars) { if (c.removed || c === P.car || P.y>=c.y+c.spec.hgt || P.y+1.7<=c.y) continue; if (M.dist2(c.x, c.z, P.x, P.z) > 64) continue; for (let ci = 0, nci = c.circlesInto(CIRC); ci < nci; ci++) { const cx = CIRC[ci * 3], cz = CIRC[ci * 3 + 1], r = CIRC[ci * 3 + 2]; const dx = P.x - cx, dz = P.z - cz; const rr = r + 0.4; const d2 = dx * dx + dz * dz; if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); P.x = cx + dx / d * rr; P.z = cz + dz / d * rr; } } }
    if (!ragdoll && !P.airborne && dt>0) {
      // Gait and momentum follow achieved motion, excluding other pedestrians' separation pushes.
      P.vx=(P.x-ox)/dt; P.vz=(P.z-oz)/dt;
      const achieved=Math.hypot(P.vx,P.vz), cap=intended/Math.max(intended,achieved,1e-6);
      P.vx*=cap; P.vz*=cap;
      P.brace=M.lerp(P.brace, intended>.2 ? M.clamp(1-achieved/intended,0,1):0,1-Math.exp(-dt*12));
    }
    // ped bodies push a little
    for (const p of W.peds) { if (!p.alive || p.inCar || Math.abs(P.y-p.y)>1.5) continue; const dx = P.x - p.x, dz = P.z - p.z; const d2 = dx * dx + dz * dz; if (d2 < 0.64 && d2 > 1e-6) { const d = Math.sqrt(d2); const push = (0.8 - d) * 0.5; P.x += dx / d * push; P.z += dz / d * push; p.x -= dx / d * push; p.z -= dz / d * push; } }
  }
  // ---- Cars
  function entryCandidate() {
    let best = null, score = 4.3; const want = MISSIONS.S.blip && MISSIONS.S.blip.obj;
    for (const c of W.cars) {
      if (c.removed || c.wrecked || c.absSpeed >= 4 || Math.abs((c.y || 0)-P.y) > 1.6) continue;
      for (const side of [-1,1]) {
        const r=c.right, x=c.x+r[0]*side*(c.spec.wid/2+.6), z=c.z+r[1]*side*(c.spec.wid/2+.6);
        const distance=M.dist(P.x,P.z,x,z), rank=distance-(c===want?.3:0);
        if (distance > 4 || rank >= score || !W.sight3(P.x,P.y+1,P.z,x,P.y+1,z)) continue;
        const q=W.pushOut(x,z,.42,{y:P.y,height:1.8}); if (Math.hypot(q.x-x,q.z-z) > .2) continue;
        score=rank; best={car:c,side,distance};
      }
    }
    return best;
  }
  function tryEnterCar() {
    const target=entryCandidate(); if (!target) return;
    if (target.car.locked) { HUD.notify('This car is locked.'); return; }
    P.state='entering'; P.stateT=0; P.doorReach=0; P.targetCar=target.car; P.aim=0; P.doorSide=target.side;P.enterFrom=null;
  }
  function updateEntering(dt) {
    // Before reaching the door, movement cancels the approach. Once climbing in, it queues driving instead.
    const cancel=P.stateT>.08&&(INPUT.hit('KeyF')||INPUT.hit('Space')||INPUT.pad.pressed[2]||INPUT.pad.pressed[1]||((P.doorReach||0)<.28&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some(k=>INPUT.hit(k))));
    const c = P.targetCar; if (cancel || !c || c.removed || c.wrecked) { if(c?.doorTarget)c.doorTarget.fill(0);if(P.enterFrom){[P.x,P.y,P.z]=P.enterFrom;P.enterFrom=null;}P.entryPose=0; P.state = 'foot'; P.vx = P.vz = 0; P.targetCar = null; return; }
    const r = c.right; const side = P.doorSide || -1; const doorX = c.x + r[0] * side * (c.spec.wid / 2 + 0.6), doorZ = c.z + r[1] * side * (c.spec.wid / 2 + 0.6);
    const d = M.dist(P.x, P.z, doorX, doorZ);
    if (!P.enterFrom && d > 0.5 && P.stateT < 2.2 && c.absSpeed < 4) { const s = 4.5; P.vx = (doorX - P.x) / d * s; P.vz = (doorZ - P.z) / d * s; P.angle += M.angleTo(P.angle, Math.atan2(doorX - P.x, doorZ - P.z)) * Math.min(1, 12 * dt); moveBody(dt, false); P.speed=Math.hypot(P.vx,P.vz);P.phase+=dt*M.TAU*PEDS.cadence(P.speed);return; }
    if ((!P.enterFrom && d > 1.1) || c.absSpeed >= 4) { P.state = 'foot'; P.vx = P.vz = 0; return; }
    // get in
    P.speed = 0; P.vx = P.vz = 0; P.angle += M.angleTo(P.angle,Math.atan2(c.x-P.x,c.z-P.z))*Math.min(1,dt*14); P.doorReach=(P.doorReach||0)+dt;
    if(!P.enterFrom)P.enterFrom=[P.x,P.y,P.z];const di=side<0?0:1;if(c.doorTarget)c.doorTarget[di]=1;
    const u=M.clamp((P.doorReach-.28)/.62,0,1),ease=u*u*(3-2*u);P.entryPose=Math.sin(u*Math.PI*.8);P.x=M.lerp(P.enterFrom[0],c.x+r[0]*side*c.spec.wid*.2,ease);P.z=M.lerp(P.enterFrom[2],c.z,ease);P.y=c.y-.25*ease;
    if(P.doorReach<.9)return;if(c.doorTarget)c.doorTarget[di]=0;P.enterFrom=null;P.entryPose=0;AUDIO.play('door',P.x,P.z);
    if (c.driver && c.driver !== PLAYER) { const d0 = c.driver; d0.exitCar(); d0.x = c.x + r[0] * (c.spec.wid / 2 + 1.0); d0.z = c.z + r[1] * (c.spec.wid / 2 + 1.0); d0.knockT = 1.5; d0.state = 'knocked'; d0.launch(r[0] * 2, 2, r[1] * 2); d0.fear = 8; d0.threat = [c.x, c.z]; if (d0.isCop) { d0.hostile = true; POLICE.crime('cop', c.x, c.z, d0); } else { if (W.rng() < 0.5) d0.say(W.rng() < 0.5 ? 'My car!' : 'Hey! Thief!'); POLICE.crime('jack', c.x, c.z, null); } P.stats.carsStolen++; }
    else if (!c.playerOwned && c.ai.mode !== 'parked') P.stats.carsStolen++;
    for (const px of c.passengers.slice()) if (px.role !== 'crew') { px.exitCar(); px.scare(c.x, c.z); }
    if (P.wanted > 0 && POLICE.S.seenT > 3 && c !== P.lastCar) { POLICE.S.seenT += 5; HUD.notify("They didn't see you take this one."); } P.lastCar = c;
    c.driver = PLAYER; c.ai.mode = 'player'; c.ai.edge = null; c.playerOwned = true; c.scared = 0; P.car = c; P.state = 'car'; P.inCarT = 0; P.x = c.x; P.z = c.z; P.lastCarName = c.name; P.carNameT = 3; P.weaponOut = false; P.aim = 0;
    if (c.type === 'police' || c.type === 'swat') c.siren = false;
    if (AUDIO.radioStation !== P.radio) AUDIO.setRadio(P.radio);
    MISSIONS.onEnterCar(c);
  }
  function exitCar() {
    const c = P.car; if (!c) return false; const r = c.right; const spd = c.absSpeed;
    if (c.spec.boat) { const land = W.nearestLand(c.x, c.z); if (!land || land.d > 5.5) { if (P.alive) HUD.notify("You can't swim. Bring the boat to the shore or the pier."); return false; } P.x = land.x; P.z = land.z; }
    else {
      const f = c.fwd, spots = [-1, 1].map(side => [c.x+r[0]*side*(c.spec.wid/2+.9), c.z+r[1]*side*(c.spec.wid/2+.9)]);
      spots.push([c.x-f[0]*(c.spec.len/2+1), c.z-f[1]*(c.spec.len/2+1)]);
      const safe = spots.find(([x,z]) => { const q = W.pushOut(x,z,.42,{y:P.y,height:1.8}); return Math.hypot(q.x-x,q.z-z) < .15 && Math.abs(CITY.groundY(x,z,c.y)-c.y) < 1.5 && !W.cars.some(other => other !== c && !other.removed && other.circles().some(([cx,cz,cr]) => M.dist(x,z,cx,cz) < cr+.42)); });
      if (!safe) { HUD.notify('Doors blocked. Move the car to make room.'); return false; }
      [P.x,P.z] = safe;
    }
    P.y = CITY.groundY(P.x, P.z, P.y); P.angle = c.angle; P.camIdle=0; P.vx = 0; P.vz = 0;
    c.driver = null; c.ai.mode = 'parked'; c.controls.throttle = 0; c.controls.brake = spd > 4 ? 0 : 1; c.controls.handbrake = 0; c.siren = false; P.car = null; P.state = 'foot'; if(spd<3&&!c.spec.boat&&!c.spec.bike){const di=((P.x-c.x)*r[0]+(P.z-c.z)*r[1])<0?0:1;if(c.doorTarget){c.doorTarget[di]=1;P.exitDoor={car:c,index:di,t:.65};}P.exitPose={from:[c.x,c.y-.25,c.z],to:[P.x,P.y,P.z],t:.65};} AUDIO.play('door', P.x, P.z);
    if (spd > 7) { knock(c.vx * 0.5, 3, c.vz * 0.5); hurt(spd * 1.5, 'fall', null); }
    P.weaponOut = P.weapon !== 'fist';
    MISSIONS.onExitCar(c); return true;
  }
  function updateInCar(dt) {
    const c = P.car, pad = INPUT.pad; P.inCarT += dt; P.x = c.x; P.z = c.z; P.y = c.y;
    if (c.wrecked) { if (!exitCar()) { if (c.sinkT > 2.5 && P.alive) { P.armor = 0; hurt(1e4, 'drown', c.lastHitBy); } P.y = c.y; } return; }
    // raw axes: steering and throttle are independent in a car, never normalised together.
    // Heading grows counter-clockwise seen from above (+z toward +x, which is screen-left), so steering right is negative.
    let ix = 0, iz = 0;
    if (INPUT.down('KeyW') || INPUT.down('ArrowUp')) iz += 1; if (INPUT.down('KeyS') || INPUT.down('ArrowDown')) iz -= 1; if (INPUT.down('KeyD') || INPUT.down('ArrowRight')) ix += 1; if (INPUT.down('KeyA') || INPUT.down('ArrowLeft')) ix -= 1;
    if (pad.active) { const x = pad.lx * (0.4 + 0.6 * pad.lx * pad.lx); /* expo: a thumb's first centimetre makes fine corrections, the rim is still full lock */ ix = M.clamp(ix + x, -1, 1); iz = M.clamp(iz - pad.ly, -1, 1); }
    const ctl = c.controls;
    const fwdIn = Math.min(1, Math.max(0, iz) + pad.rt), backIn = Math.min(1, Math.max(0, -iz) + pad.lt);
    if (fwdIn > 0) { if (c.speed < -0.5) { ctl.throttle = 0; ctl.brake = fwdIn; ctl.reverse = false; } else { ctl.throttle = fwdIn; ctl.brake = 0; } }
    else if (backIn > 0) { ctl.throttle = 0; ctl.brake = backIn; ctl.reverse = true; }
    else { ctl.throttle = 0; ctl.brake = 0; ctl.reverse = false; }
    ctl.steer = -ix + (P.drunk > 0 ? Math.sin(W.state.elapsed * 1.7) * 0.4 * Math.min(1, P.drunk / 12) : 0); ctl.handbrake = (INPUT.down('Space') || pad.buttons[0]) ? 1 : 0;
    if (INPUT.down('KeyH') || pad.buttons[3]) { if (c.horn <= 0) { c.horn = 0.5; AUDIO.play('horn', c.x, c.z, 0.5); } }
    if ((c.type === 'police' || c.type === 'swat') && (INPUT.hit('KeyL') || pad.pressed[9])) c.siren = !c.siren;
    if (INPUT.hit('KeyR') || pad.pressed[8]) { P.radio = (AUDIO.radioStation + 1) % AUDIO.STATIONS.length; AUDIO.setRadio(P.radio); HUD.notify('RADIO: ' + AUDIO.STATIONS[P.radio]); }
    if (INPUT.hit('KeyF') || pad.pressed[2]) { if (exitCar()) return; }
    // drive-by shooting with a one-handed weapon
    const wp = WEAPONS[P.weapon]; const firing = (INPUT.mouse.buttons & 1) || INPUT.down('ControlLeft');
    if (firing && P.reloadT <= 0 && P.fireT <= 0 && (P.weapon === 'pistol' || P.weapon === 'uzi') && P.weapons[P.weapon] > 0) { if (magazine() <= 0) { reload(); return; } P.fireT = wp.rate * 1.2; P.magazines[P.weapon]--; P.weapons[P.weapon]--; fireBullet(PLAYER, c.x + c.fwd[0] * 0.5, c.z + c.fwd[1] * 0.5, c.y + 1.2, aimAngle(), wp, 1, c); }
    P.stats.distance += c.absSpeed * dt;
    // stunt jumps (the stunt camera lets go a moment after the landing)
    if (P.stuntCam && !c.airborne) { P.stuntCam.t += dt; if (P.stuntCam.t > 1.4) P.stuntCam = null; }
    if (c.airborne) { if (P.airT === 0) { P.jumpRamp = -1; CITY.ramps.forEach((r, i) => { if (M.dist(c.x, c.z, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2) < 14) P.jumpRamp = i; }); } P.airT += dt; if (P.jumpRamp >= 0 && P.airT > 0.35 && !P.stuntCam) P.stuntCam = { x: P.camX, y: P.camY + 1.5, z: P.camZ, t: 0 }; }
    else if (P.airT > 0) { if (P.airT > 0.85 && c.absSpeed > 8) { let bonus = Math.floor(P.airT * 500); P.stats.stunts++; if (P.jumpRamp >= 0 && !P.stats.jumps.includes(P.jumpRamp)) { P.stats.jumps.push(P.jumpRamp); bonus += 1000; HUD.big('UNIQUE STUNT!  ' + P.stats.jumps.length + '/' + CITY.ramps.length, '#f5c542', 2.2); AUDIO.play('missionPass'); } else HUD.big('INSANE STUNT!', '#f5c542', 1.6); addMoney(bonus, 'stunt bonus'); } P.airT = 0; }
    // engine sound
    const rpm = M.clamp(Math.abs(c.speed) / c.spec.top, 0, 1); AUDIO.engine(true, rpm * 0.7 + ctl.throttle * 0.25 + 0.05, ctl.throttle, c.type); AUDIO.screech(c.skid && !c.airborne ? M.clamp(Math.max(Math.abs(c.slipR || 0) - 0.08, Math.abs(c.slipF || 0) - 0.14, c.wheelspin ? 0.35 : 0) * 3, 0, 1) : 0); // squeal follows the tyre slip
    if (c.skid && !c.airborne && !c.spec.boat && W.state.frame % 2 === 0) { const r = c.right, f = c.fwd; const wz = c.spec.len * 0.3; W.FX.dust(c.x - f[0] * wz + r[0], 0, c.z - f[1] * wz + r[1], 1); W.FX.dust(c.x - f[0] * wz - r[0], 0, c.z - f[1] * wz - r[1], 1); }
  }
  // ---- Camera
  function updateCamera(dt) {
    let tx, ty, tz, dist, yaw, pitch, fov = 62;
    const dlg = MISSIONS.dialogue;
    if (dlg && dlg.focus && dlg.focus.alive) { // cinematic: a slow arc around whoever is talking, framing them and the player, kept out of the walls
      const f = dlg.focus; const t = W.state.elapsed; const mid = [(f.x + P.x) / 2, (f.z + P.z) / 2]; const base = Math.atan2(P.x - f.x, P.z - f.z);
      // a cut on every line: the shot list rotates with the line index, and the camera jumps to the new setup instead of drifting there
      const cut = P.dlgLine !== dlg.i || P.dlgFocus !== f; if (cut) { P.dlgLine = dlg.i; P.dlgFocus = f; }
      const SHOTS = [[Math.PI / 2, 4.2], [-Math.PI * 0.85, 3.0], [-Math.PI / 2, 4.2], [Math.PI * 0.85, 3.0], [0.4, 2.6], [-0.4, 2.6]]; const start = dlg.i % SHOTS.length;
      let best = null;
      for (let k = 0; k < SHOTS.length; k++) { const [off, d0] = SHOTS[(start + k) % SHOTS.length]; const a = base + off + Math.sin(t * 0.25) * 0.15; for (const dist of [d0, d0 * 0.75, 2.2]) { const cx = mid[0] + Math.sin(a) * dist, cz = mid[1] + Math.cos(a) * dist; if (CITY.insideLot(cx, cz) || !W.sight3(cx,1.7,cz,f.x,f.y+1.4,f.z,[P.car]) || !W.sight3(cx,1.7,cz,P.x,P.y+1.4,P.z,[P.car])) continue; best = [cx, cz]; break; } if (best) break; }
      if (!best) best = [mid[0] + Math.sin(base) * 2, mid[1] + Math.cos(base) * 2];
      const cy = (dlg.i % 2 ? 1.55 : 1.8) + Math.sin(t * 0.4) * 0.1;
      if (cut) { P.camX = best[0]; P.camY = cy; P.camZ = best[1]; } else { P.camX = M.lerp(P.camX, best[0], Math.min(1, 3 * dt)); P.camY = M.lerp(P.camY, cy, Math.min(1, 3 * dt)); P.camZ = M.lerp(P.camZ, best[1], Math.min(1, 3 * dt)); }
      RENDER.setCamera(P.camX, P.camY, P.camZ, f.x * 0.6 + P.x * 0.4, 1.35, f.z * 0.6 + P.z * 0.4, 42 * Math.PI / 180); W.state.camYaw = Math.atan2(f.x - P.camX, f.z - P.camZ); P.angle += M.angleTo(P.angle, Math.atan2(f.x - P.x, f.z - P.z)) * Math.min(1, 6 * dt); f.faceTo && f.faceTo(P.x, P.z, dt); return;
    }
    if (P.car && P.stuntCam) { const c = P.car, sc = P.stuntCam; RENDER.setCamera(sc.x, sc.y, sc.z, c.x, c.y + 0.8, c.z, 38 * Math.PI / 180); W.state.camYaw = Math.atan2(c.x - sc.x, c.z - sc.z); P.camX = sc.x; P.camY = sc.y; P.camZ = sc.z; return; } // the stunt camera stays on the ramp and watches the car fly
    if (P.car) {
      const c = P.car; const spd = c.absSpeed; const slide = c.speed > 5 && !c.airborne ? M.clamp(M.angleTo(c.angle, Math.atan2(c.vx, c.vz)), -.7, .7) * .6 : 0; /* in a slide the camera looks down the road the car is travelling, not along its nose */ const behind = c.speed < -2 && P.camIdle > 1 ? c.angle + Math.PI : c.angle + slide;
      const targetYaw = behind + P.camYawOff;
      if (P.camIdle > 1.0) { P.camYawOff *= Math.max(0, 1 - 4 * dt); P.camYaw += M.angleTo(P.camYaw, behind + P.camYawOff + (c.yawRate || 0) * 0.12) * Math.min(1, (4.5 + spd * 0.22) * dt); } // swings round faster and leads a little into the turn
      else { P.camYawOff = M.angleTo(behind, P.camYaw); }
      yaw = P.camYaw; pitch = M.clamp(P.camPitch, 0.1, 0.9); dist = 6.0 + c.spec.len * 0.3 + spd * 0.05; const la = Math.min(3, spd * 0.12); tx = c.x + c.vx / (spd || 1) * la; ty = c.y + 1.2; tz = c.z + c.vz / (spd || 1) * la; fov = 60 + spd * 0.32 * option('speedFov',.8);
    } else {
      const aim=P.motion?.aim??P.aim;
      yaw=P.camYaw+(P.kickYaw||0);pitch=P.camPitch+(P.kickPitch||0);dist=M.lerp(P.camDist+(P.sprinting?.6:0),2.4,aim);tx=P.x;ty=P.y+1.45-P.crouch*.43-(P.vaultPose||0)*.45+(P.sprinting?Math.cos(2*P.phase)*.015*option('cameraShake',.65):0);tz=P.z;fov=M.lerp(62+(P.sprinting?6*option('speedFov',.8):0),50,aim);
      if (aim>.001) { const r = [-Math.cos(yaw), Math.sin(yaw)]; const shoulder = W.raycast3(P.x,ty,P.z,r[0]*P.shoulder,0,r[1]*P.shoulder,.65,P.car,true); const offset=Math.max(0,Math.min(.55,shoulder.dist-.12)); tx += r[0] * offset * P.shoulder*aim; tz += r[1] * offset * P.shoulder*aim; }
      if (!P.alive) { dist = 6; pitch = 0.9; }
    }
    if (P.drunk > 0) { const k = Math.min(1, P.drunk / 12), t = W.state.elapsed; yaw += Math.sin(t * 0.9) * 0.14 * k; pitch += Math.sin(t * 1.3) * 0.07 * k; fov += Math.sin(t * 0.7) * 8 * k; }
    let cx = tx - Math.sin(yaw) * Math.cos(pitch) * dist, cz = tz - Math.cos(yaw) * Math.cos(pitch) * dist, cy = ty + Math.sin(pitch) * dist;
    // collision with buildings (or the room's walls indoors): shorten the boom
    const dx = cx - tx, dz = cz - tz; let best = 1;
    const room = CITY.interiorRoom; if (room && ty < -10) { cy = Math.min(cy, room.floorY + 3.0); }
    for (const l of (room && ty < -10 ? room.walls : CITY.lotsNear(tx, tz, dist + 2))) { if (l.down||l.passage||(l.h < cy - 0.3 && l.h < ty)) continue; const t = M.rayAABB2(tx, tz, dx, dz, l.x0 - 0.3, l.z0 - 0.3, l.x1 + 0.3, l.z1 + 0.3); if (t >= 0 && t < best) { const hy = ty + (cy - ty) * t; if (hy < l.h + .3 && hy>(l.y0||0)-.3) best = t; } }
    const length=Math.hypot(dx,cy-ty,dz);
    for (const [ox,oy,oz] of [[0,0,0],[.22,0,0],[-.22,0,0],[0,.18,.22],[0,-.18,-.22]]) {
      const hit=W.raycast3(tx+ox,ty+oy,tz+oz,dx,cy-ty,dz,length,P.car||(P.state==='entering'?P.targetCar:null)||P.exitDoor?.car,'camera');
      if (hit.kind!=='none') best=Math.min(best,Math.max(.04,(hit.dist-.12)/length));
    }
    if (best < 1) { cx = tx + dx * best * 0.92; cz = tz + dz * best * 0.92; cy = ty + (cy - ty) * best * 0.92; }
    const gy = CITY.groundY(cx, cz, cy-.5) + 0.5; if (cy < gy) cy = gy;
    // smoothing
    const k = best < 1 ? 1 : 1 - Math.exp(-(P.car ? 12 : 22) * dt);
    if (P.camX === 0 && P.camZ === 0) { P.camX = cx; P.camY = cy; P.camZ = cz; }
    P.camX = M.lerp(P.camX, cx, k); P.camY = M.lerp(P.camY, cy, k); P.camZ = M.lerp(P.camZ, cz, k);
    const shake=(P.shake||0)*.25*option('cameraShake',.65), t=W.state.elapsed;
    P.shake=Math.max(0,(P.shake||0)-3*dt);
    P.fov = M.lerp(P.fov, fov, 1 - Math.exp(-4 * dt));
    RENDER.setCamera(P.camX+Math.sin(t*73)*shake, P.camY+Math.sin(t*91)*shake, P.camZ+Math.cos(t*67)*shake, tx, ty, tz, P.fov * Math.PI / 180);
    W.state.camYaw = yaw;
  }
  function heldEntity() { return PEDS.heldEntity(P); }
  function entity() { if (P.car) return null; if (P.rag) { PEDS.ragdollBones(P, P.rag); P.emis.fill(0); return { mesh: P.mesh, model: P.model, bones: P.bones, emis: P.emis }; } PEDS.buildRig(P, P.model, P.bones); P.emis.fill(0); return { mesh: P.mesh, model: P.model, bones: P.bones, emis: P.emis }; }
  function drawFX() { for (const t of tracers) W.fx.line(t.x0, t.y0, t.z0, t.x1, t.y1, t.z1, [1, 0.9, 0.6], 0.9, 0.2); for (const p of projectiles) if (p.kind === 'grenade') W.fx.blob(p.x, CITY.groundY(p.x, p.z) + 0.03, p.z, 0.25, 0.4); }
  function projectileEntities() { const out = []; for (const p of projectiles) { const m = M.create(); if (p.kind === 'grenade') { M.trs(m, p.x, p.y, p.z, 0, 0.5, 0.5, 0.5); out.push({ mesh: GRENADE_MESH(), model: m }); } else { const yaw = Math.atan2(p.vx, p.vz), pitch = -Math.atan2(p.vy, Math.hypot(p.vx, p.vz)); M.trsEuler(m, p.x, p.y, p.z, yaw, pitch, 0); out.push({ mesh: ROCKET_MESH(), model: m }); } } return out; }
  let gm = null, rm = null;
  const GRENADE_MESH = () => gm || (gm = new MESH.Builder().cbox(0, 0, 0, 0.3, 0.35, 0.3, [0.2, 0.3, 0.2]).build());
  const ROCKET_MESH = () => rm || (rm = new MESH.Builder().cbox(0, 0, 0, 0.18, 0.18, 0.9, [0.4, 0.4, 0.42]).cbox(0, 0, 0.5, 0.12, 0.12, 0.2, [0.9, 0.2, 0.1]).build());
  return { P, aimAngle, vaultCandidate, startVault, moveBody, entryCandidate, magazine, reload, updateWeapon, OUTFITS, setOutfit, init, update, updateCamera, heldEntity, shake, giveWeapon, addMoney, hurt, knock, die, bust, respawn, fireBullet, explodeAt, updateProjectiles, entity, drawFX, projectileEntities, exitCar,
    get x() { return P.x; }, get z() { return P.z; }, get y() { return P.y; }, get car() { return P.car; }, get alive() { return P.alive; }, get wanted() { return P.wanted; }, set wanted(v) { P.wanted = v; }, get stats() { return P.stats; }, get health() { return P.health; }, get money() { return P.money; }, get weapons() { return P.weapons; }, get weapon() { return P.weapon; } };
})();
