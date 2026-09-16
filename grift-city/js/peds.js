// GRIFT CITY — pedestrians: civilians who wander the sidewalks and flee, cops who chase and shoot, gang muscle,
// drivers, and the shared bone rig used by the player.
'use strict';
const PEDS = (() => {
  const SKIN = [[0.95, 0.8, 0.68], [0.85, 0.65, 0.5], [0.6, 0.42, 0.3], [0.42, 0.28, 0.2], [0.9, 0.75, 0.62]];
  const CLOTH = [[0.8, 0.2, 0.2], [0.2, 0.3, 0.7], [0.9, 0.9, 0.85], [0.15, 0.15, 0.15], [0.3, 0.6, 0.3], [0.9, 0.7, 0.2], [0.6, 0.3, 0.6], [0.4, 0.4, 0.45], [0.95, 0.5, 0.2], [0.2, 0.7, 0.75]];
  const PANTS = [[0.2, 0.25, 0.4], [0.15, 0.15, 0.15], [0.45, 0.4, 0.35], [0.3, 0.3, 0.35], [0.55, 0.5, 0.42]];
  const HAIR = [[0.1, 0.08, 0.06], [0.35, 0.22, 0.1], [0.75, 0.6, 0.3], [0.5, 0.5, 0.5], [0.6, 0.15, 0.1]];
  const looks = []; const meshCache = {};
  const r0 = M.rng(77);
  for (let i = 0; i < 40; i++) looks.push({ skin: r0.pick(SKIN), shirt: r0.pick(CLOTH), pants: r0.pick(PANTS), hair: r0.pick(HAIR), hat: r0.chance(0.25) ? r0.pick(CLOTH) : null, beanie: r0.chance(0.4), jacket: r0.chance(0.3) ? r0.pick(CLOTH) : null, sleeves: r0.chance(0.5), glasses: r0.chance(0.15), bag: r0.chance(0.2) ? r0.pick(PANTS) : null, skirt: r0.chance(0.25), longHair: r0.chance(0.35) });
  const COP = { skin: [0.9, 0.75, 0.62], shirt: [0.2, 0.3, 0.6], pants: [0.15, 0.18, 0.3], hair: [0.1, 0.1, 0.1], hat: [0.15, 0.18, 0.35], jacket: null, sleeves: true, glasses: true };
  const SWAT = { skin: [0.85, 0.7, 0.6], shirt: [0.12, 0.12, 0.14], pants: [0.1, 0.1, 0.12], hair: [0.1, 0.1, 0.1], hat: [0.1, 0.1, 0.12], jacket: [0.2, 0.2, 0.22], sleeves: true, glasses: true };
  const GANG = { skin: [0.6, 0.42, 0.3], shirt: [0.55, 0.05, 0.1], pants: [0.12, 0.12, 0.12], hair: [0.08, 0.06, 0.06], hat: [0.5, 0.05, 0.1], jacket: [0.15, 0.15, 0.15], sleeves: true };
  const PLAYER_LOOK = { skin: [0.9, 0.74, 0.62], shirt: [0.85, 0.85, 0.8], pants: [0.2, 0.2, 0.25], hair: [0.15, 0.1, 0.08], hat: null, jacket: [0.25, 0.14, 0.1], sleeves: true };
  const MARLA = { skin: [0.85, 0.65, 0.5], shirt: [0.9, 0.2, 0.4], pants: [0.1, 0.1, 0.12], hair: [0.05, 0.05, 0.05], hat: null, jacket: [0.1, 0.1, 0.12], sleeves: true };
  const OKAFOR = { skin: [0.42, 0.28, 0.2], shirt: [0.9, 0.85, 0.7], pants: [0.3, 0.3, 0.35], hair: [0.05, 0.05, 0.05], hat: [0.2, 0.25, 0.3], jacket: [0.85, 0.55, 0.1], sleeves: true };
  const CRANE = { skin: [0.92, 0.8, 0.7], shirt: [0.95, 0.95, 0.95], pants: [0.2, 0.2, 0.25], hair: [0.7, 0.7, 0.7], hat: null, jacket: [0.2, 0.2, 0.25], sleeves: true, glasses: true };
  function getMesh(look) { const key = JSON.stringify(look); if (!meshCache[key]) meshCache[key] = MESH.pedMesh(look).build(); return meshCache[key]; }
  const SHOUTS = ['Hey!', 'Watch it!', 'My car!', 'Somebody call the cops!', 'Get away from me!', 'What is wrong with you?!', 'Not today!', 'Help!', 'Are you insane?', 'I have a family!'];

  const LEG_H = 0.85, TORSO_H = 0.65, SHOULDER = 0.6;
  class Ped {
    constructor(look, x, z, opts = {}) {
      this.look = look; this.mesh = getMesh(look); this.x = x; this.z = z; this.y = CITY.groundY(x, z); this.angle = W.rng() * M.TAU;
      this.vx = 0; this.vz = 0; this.vy = 0; this.airborne = false; this.speed = 0; this.phase = W.rng() * 10; this.state = 'walk'; this.stateT = 0;
      this.health = opts.health || 60; this.maxHealth = this.health; this.isCop = !!opts.cop; this.isSwat = !!opts.swat; this.isGang = !!opts.gang; this.weapon = opts.weapon || null; this.ammoT = 0;
      this.node = opts.node || null; this.target = null; this.prevNode = null; this.inCar = null; this.removed = false; this.deadT = 0; this.fear = 0; this.threat = null; this.lying = 0; this.fallDir = 1;
      this.aim = 0; this.role = opts.role || null; this.important = !!opts.important; this.name = opts.name || null; this.money = Math.floor(W.rng() * 40) + 5;
      this.bones = new Float32Array(16 * RENDER.MAX_BONES); this.emis = new Float32Array(RENDER.MAX_BONES); this.model = M.create();
      this.wanderT = 0; this.talkT = 0; this.hitT = 0; this.knockT = 0; this.shout = null; this.shoutT = 0; this.onDeath = null; this.hostile = !!opts.hostile; this.followTarget = null; this.attackCooldown = 0; this.stationary = !!opts.stationary; this.faceTarget = null;
      this.walkSpeed = 1.3 + W.rng() * 0.5; this.hearing = 45; this.headYaw = 0; this.gestureT = 0; this.partner = null; this.seat = null; this.sx = 0.9 + W.rng() * 0.2; this.sy = 0.93 + W.rng() * 0.14;
    }
    get alive() { return this.state !== 'dead' && !this.removed; }
    get armed() { return !!this.weapon; }
    launch(vx, vy, vz) { this.vx += vx; this.vz += vz; this.vy = Math.max(this.vy, vy); this.airborne = true; }
    goto(x, z, speed, onArrive, radius = 1.5) { this.state = 'goto'; this.gotoTarget = [x, z]; this.gotoSpeed = speed; this.gotoRadius = radius; this.onArrive = onArrive || null; this.stationary = false; }
    // Scripted: run to a car and drive off in it.
    fleeInCar(car, cruise = 17) { this.goto(car.x, car.z, 6.5, () => { if (car.wrecked || car.driver) { this.state = 'flee'; this.fear = 99; return; } this.inCar = car; car.driver = this; car.ai.mode = 'flee'; car.scared = 1e9; car.ai.cruise = cruise; car.ai.fleeSpeed = cruise; car.ai.edge = null; car.ai.missionFlee = true; car.ai.pressure = 0; car.ai.bailing = false; this.bailed = false; this.state = 'driving'; }, 3.4); }
    scare(x, z) { if (this.isCop || this.isGang || this.role === 'target' || this.role === 'crew' || this.state === 'goto') return; if (this.state === 'dead' || this.inCar) return; this.fear = Math.max(this.fear, 6 + W.rng() * 4); this.threat = [x, z]; this.seat = null; this.partner = null; if (this.state !== 'flee') { this.state = 'flee'; if (W.rng() < 0.35) AUDIO.play('scream', this.x, this.z); if (W.rng() < 0.3) this.say(SHOUTS[Math.floor(W.rng() * SHOUTS.length)]); } }
    say(text) { this.shout = text; this.shoutT = 2.5; }
    hitByCar(car, spd) {
      if (this.state === 'dead' || this.hitT > 0) return; if (this.invincible) { this.hitT = 0.8; return; }
      const dir = spd > 0 ? [car.vx / spd, car.vz / spd] : [0, 0];
      this.hitT = 0.8;
      if (spd > 7) { this.die(car.driver === PLAYER ? PLAYER : car, 'car'); this.launch(dir[0] * spd * 0.7, Math.min(9, spd * 0.5), dir[1] * spd * 0.7); W.FX.blood(this.x, 1, this.z, 8, dir); AUDIO.play('hit', this.x, this.z); car.damage(4, null); }
      else { this.damage(spd * 4, car.driver === PLAYER ? PLAYER : car); this.launch(dir[0] * spd * 0.8 + car.right[0] * (Math.sign(car.local(this.x, this.z)[1]) * 3), 3, dir[1] * spd * 0.8 + car.right[1] * (Math.sign(car.local(this.x, this.z)[1]) * 3)); this.knockT = 1.8; if (this.state === 'goto') this.gotoResume = true; this.state = this.state === 'dead' ? 'dead' : 'knocked'; AUDIO.play('bump', this.x, this.z); if (car.driver === PLAYER) { this.scare(car.x, car.z); POLICE.crime('hit', this.x, this.z, this); } }
      if (car.driver === PLAYER) car.damage(2, null);
    }
    damage(amount, source, dir = null) {
      if (this.state === 'dead' || this.invincible) return; this.health -= amount;
      W.FX.blood(this.x, 1.2, this.z, Math.min(10, 3 + amount / 6), dir);
      if (this.health <= 0) { this.die(source, 'shot'); if (dir) this.launch(dir[0] * 2.5, 2, dir[1] * 2.5); this.fallDir = 1; }
      else { if (!this.isCop && !this.isGang && !this.hostile && this.role !== 'target' && this.role !== 'crew') { if (source === PLAYER && amount < 35 && !PLAYER.car && W.rng() < 0.3) { this.hostile = true; this.state = 'walk'; this.seat = null; this.partner = null; this.say(W.rng() < 0.5 ? 'You want some?!' : 'Big mistake!'); } else this.scare(source ? source.x : this.x, source ? source.z : this.z); } if (source === PLAYER && (this.isGang || this.role === 'target')) this.hostile = true; if (source === PLAYER && !this.isCop) POLICE.crime('assault', this.x, this.z, this); if (source === PLAYER && this.isCop) POLICE.crime('cop', this.x, this.z, this); }
    }
    die(source, how) {
      if (this.state === 'dead' || this.invincible) return; this.state = 'dead'; this.deadT = 0; this.aim = 0; this.weaponOut = false;
      if (this.inCar) { const c = this.inCar; if (c.driver === this) c.driver = null; this.inCar = null; this.x = c.x; this.z = c.z; this.removed = true; }
      if (source === PLAYER || (source && source.driver === PLAYER)) { POLICE.crime(this.isCop ? 'copkill' : (how === 'car' ? 'killcar' : 'kill'), this.x, this.z, this); PLAYER.stats.kills++; if (this.isGang) MISSIONS.rampageKill(how === 'car' ? 'gangcar' : 'gangkill', this); if (!this.isCop && W.rng() < 0.6) PICKUPS.dropCash(this.x, this.z, this.money + (this.isGang ? 60 : 0)); }
      if (how !== 'explosion') AUDIO.play('scream', this.x, this.z);
      for (const p of W.pedsNear(this.x, this.z, 30)) if (p !== this) p.scare(source ? source.x : this.x, source ? source.z : this.z);
      if (this.onDeath) this.onDeath(this, source);
    }
    // ---- AI
    update(dt) {
      if (this.removed) return; this.stateT += dt; if (this.shoutT > 0) this.shoutT -= dt; if (this.hitT > 0) this.hitT -= dt; if (this.attackCooldown > 0) this.attackCooldown -= dt;
      if (this.inCar) { this.x = this.inCar.x; this.z = this.inCar.z; this.y = this.inCar.y; return; }
      if (this.state === 'dead') { this.deadT += dt; this.lying = Math.min(1, this.lying + dt * 3.5); this.moveBody(dt, true); if (!this.pooled && this.deadT > 1.2 && !this.airborne) { this.pooled = true; const a = this.angle; W.decal('blood', this.x - Math.sin(a) * 0.3, this.z - Math.cos(a) * 0.3, this.x + Math.sin(a) * 1.0, this.z + Math.cos(a) * 1.0, 1.1, [0.35, 0.01, 0.01], 0.75); } return; }
      if (this.knockT > 0) { this.knockT -= dt; this.lying = Math.min(1, this.lying + dt * 4); this.moveBody(dt, true); if (this.knockT <= 0) { this.state = this.gotoTarget && this.gotoResume ? 'goto' : (this.fear > 0 ? 'flee' : 'walk'); this.lying = 0; } return; }
      if (this.lying > 0) this.lying = Math.max(0, this.lying - dt * 3);
      // hear gunfire
      for (const n of W.state.noises) { if (M.dist2(n.x, n.z, this.x, this.z) < n.r * n.r) { if (this.isCop) { this.alerted = 8; } else this.scare(n.x, n.z); } }
      if (this.state === 'goto') { let [gx, gz] = this.gotoTarget; // steer around buildings with a probe
        const dx = gx - this.x, dz = gz - this.z, dl = Math.hypot(dx, dz) || 1; const probe = W.pushOut(this.x + dx / dl * 2.2, this.z + dz / dl * 2.2, 0.5, { noProps: true });
        if (probe.hit && dl > 2.5) { if (this.sideStep === undefined) this.sideStep = W.rng() < 0.5 ? 1 : -1; gx = this.x + (dx / dl * 0.3 - dz / dl * this.sideStep) * 4; gz = this.z + (dz / dl * 0.3 + dx / dl * this.sideStep) * 4; } else if (!probe.hit) this.sideStep = undefined;
        this.moveToward(gx, gz, this.gotoSpeed || 6, dt); if (this.speed > 0 && M.dist(this.x, this.z, gx, gz) < (this.gotoRadius || 1.5)) { this.speed = 0; if (this.onArrive) { const f = this.onArrive; this.onArrive = null; f(this); } } }
      else if (this.isCop || this.isSwat) this.aiCop(dt); else if (this.isGang || this.hostile) this.aiHostile(dt); else if (this.role === 'crew') this.aiCrew(dt); else this.aiCivilian(dt);
      this.moveBody(dt, false);
    }
    aiCivilian(dt) {
      if (this.state === 'flee') {
        this.fear -= dt; if (this.fear <= 0) { this.state = 'walk'; this.node = CITY.nearestWalkNode(this.x, this.z); this.target = null; return; }
        const t = this.threat || [PLAYER.x, PLAYER.z]; let ax = this.x - t[0], az = this.z - t[1]; const d = Math.hypot(ax, az) || 1; ax /= d; az /= d;
        // steer around buildings: probe ahead
        const probe = W.pushOut(this.x + ax * 2.5, this.z + az * 2.5, 0.5); if (probe.hit) { const s = W.rng() < 0.5 ? 1 : -1; const tx = -az * s, tz = ax * s; ax = ax * 0.3 + tx; az = az * 0.3 + tz; const l = Math.hypot(ax, az); ax /= l; az /= l; }
        this.moveToward(this.x + ax * 5, this.z + az * 5, 5.5, dt); return;
      }
      if (this.state === 'sit') { this.speed = 0; return; }
      if (this.state === 'chat') { this.speed = 0; if (this.partner && this.partner.alive) { this.faceTo(this.partner.x, this.partner.z, dt); this.gestureT -= dt; if (this.gestureT <= 0) { this.gestureT = 1.5 + W.rng() * 4; this.punchT = 0.5; } } else this.state = 'walk'; return; }
      if (this.stationary) { this.speed = 0; if (this.faceTarget) this.faceTo(this.faceTarget.x, this.faceTarget.z, dt); return; }
      if (this.state === 'stand') { this.speed = 0; this.wanderT -= dt; if (this.wanderT <= 0) this.state = 'walk'; return; }
      if (!this.node) this.node = CITY.nearestWalkNode(this.x, this.z);
      if (!this.target) this.pickNext();
      const t = this.target; const d = M.dist(this.x, this.z, t.x, t.z);
      if (d < 0.8) { this.prevNode = this.node; this.node = t; this.target = null; if (W.rng() < 0.12) { this.state = 'stand'; this.wanderT = 2 + W.rng() * 5; } return; }
      // step aside for the player and other peds
      let ox = 0, oz = 0;
      if (PLAYER.alive && !PLAYER.car) { const dx = this.x - PLAYER.x, dz = this.z - PLAYER.z; const dd = dx * dx + dz * dz; if (dd < 2.2) { const l = Math.sqrt(dd) || 1; ox += dx / l * 1.5; oz += dz / l * 1.5; } }
      this.moveToward(t.x + ox, t.z + oz, this.walkSpeed, dt);
    }
    pickNext() {
      const links = this.node.links.filter(l => l.to !== this.prevNode); const pool = links.length ? links : this.node.links;
      // prefer not crossing
      let pick = pool[Math.floor(W.rng() * pool.length)]; if (pick.cross && W.rng() < 0.6) { const nc = pool.filter(l => !l.cross); if (nc.length) pick = nc[Math.floor(W.rng() * nc.length)]; }
      this.target = pick.to;
    }
    aiCrew(dt) { // follows the player, fights back
      const p = PLAYER; if (p.car && !this.inCar) { if (M.dist(this.x, this.z, p.car.x, p.car.z) < 4) { this.enterCar(p.car); return; } this.moveToward(p.car.x, p.car.z, 5.5, dt); return; }
      const d = M.dist(this.x, this.z, p.x, p.z); if (d > 3.5) this.moveToward(p.x, p.z, d > 12 ? 6 : 4, dt); else { this.speed = 0; this.faceTo(p.x, p.z, dt); }
      // shoot hostiles
      if (this.weapon) { let best = null, bd = 30 * 30; for (const o of W.peds) { if (o === this || !o.alive || o.inCar || !(o.isCop || o.hostile || o.isGang)) continue; const dd = M.dist2(o.x, o.z, this.x, this.z); if (dd < bd) { bd = dd; best = o; } } if (best && W.los(this.x, this.z, best.x, best.z)) { this.faceTo(best.x, best.z, dt); this.aim = 1; this.fireAt(best, dt); } else this.aim = 0; }
    }
    enterCar(car) { if (car.passengers.length >= car.spec.seats - 1) return; this.inCar = car; car.passengers.push(this); }
    exitCar() { const c = this.inCar; if (!c) return; const i = c.passengers.indexOf(this); if (i >= 0) c.passengers.splice(i, 1); if (c.driver === this) c.driver = null; this.inCar = null; const r = c.right; this.x = c.x - r[0] * (c.spec.wid / 2 + 0.8); this.z = c.z - r[1] * (c.spec.wid / 2 + 0.8); this.y = CITY.groundY(this.x, this.z); this.vx = this.vz = 0; }
    aiHostile(dt) { // gang members / mission targets: attack the player when hostile, otherwise loiter
      const p = PLAYER; const d = M.dist(this.x, this.z, p.x, p.z);
      if (this.state === 'flee') { this.aiCivilian(dt); return; }
      if (!this.hostile) { if (this.isGang && d < 14 && p.alive && (W.state.noises.length || p.wanted > 0) && W.rng() < 0.01) this.hostile = true; if (this.stationary) { this.speed = 0; if (d < 10) this.faceTo(p.x, p.z, dt); } else this.aiCivilian(dt); return; }
      if (!p.alive) { this.aim = 0; this.speed = 0; return; }
      const canSee = d < 60 && W.los(this.x, this.z, p.x, p.z);
      if (this.weapon) {
        if (canSee && d < 28) { this.speed = 0; this.faceTo(p.x, p.z, dt); this.aim = 1; this.fireAt(p, dt); if (d < 6 && !p.car) this.moveToward(this.x + (this.x - p.x), this.z + (this.z - p.z), 2, dt); }
        else { this.aim = 0; if (d < 90) this.moveToward(p.x, p.z, 5.5, dt); else this.speed = 0; }
      } else { // melee
        if (d > 1.6) { this.aim = 0; if (d < 80) this.moveToward(p.x, p.z, 5.5, dt); else this.speed = 0; }
        else { this.speed = 0; this.faceTo(p.x, p.z, dt); if (this.attackCooldown <= 0 && !p.car) { this.attackCooldown = 0.9; this.punchT = 0.3; p.hurt(8, 'melee', this); AUDIO.play('punch', this.x, this.z); } }
      }
    }
    aiCop(dt) {
      const p = PLAYER; const d = M.dist(this.x, this.z, p.x, p.z);
      if (this.alerted > 0) this.alerted -= dt;
      const want = p.wanted; const canSee = d < 70 && W.los(this.x, this.z, p.x, p.z);
      if (want <= 0 || !p.alive) { this.aim = 0; if (this.patrol) this.aiCivilian(dt); else { this.speed = 0; if (this.car && !this.inCar && d > 10) { /* return to car */ this.moveToward(this.car.x, this.car.z, 2, dt); if (M.dist(this.x, this.z, this.car.x, this.car.z) < 2.5 && !this.car.driver) { this.inCar = this.car; this.car.driver = this; this.car.ai.mode = 'traffic'; this.car.ai.edge = null; this.car.siren = false; } } } return; }
      if (canSee) POLICE.seen(this);
      if (!canSee && !this.alerted) { // head toward last known position
        if (POLICE.lastSeen) { const ls = POLICE.lastSeen; if (M.dist(this.x, this.z, ls[0], ls[1]) > 3) this.moveToward(ls[0], ls[1], 5.5, dt); else this.speed = 0; } this.aim = 0; return;
      }
      // arrest if close and player is slow / on foot
      if (d < 1.7 && (!p.car || p.car.absSpeed < 1.5) && p.alive) { this.speed = 0; this.faceTo(p.x, p.z, dt); this.aim = 1; POLICE.arrestProgress(dt, this); return; }
      if (p.car && p.car.absSpeed < 2 && d < 3.5) { this.moveToward(p.x, p.z, 5.5, dt); this.aim = 0; return; }
      const shootRange = this.isSwat ? 40 : 26;
      if (canSee && d < shootRange && (want >= 2 || p.car || this.isSwat)) { this.aim = 1; this.faceTo(p.x, p.z, dt); if (d > 9 || p.car) this.moveToward(p.x, p.z, 3.5, dt); else this.speed = 0; this.fireAt(p, dt); }
      else { this.aim = want >= 2 ? 1 : 0; this.moveToward(p.x, p.z, 6, dt); }
    }
    fireAt(target, dt) {
      const wp = WEAPONS[this.weapon]; if (!wp) return; this.ammoT -= dt; if (this.ammoT > 0) return;
      this.ammoT = wp.rate * (this.isSwat ? 1.5 : 3.0) + W.rng() * 0.5;
      const tx = target.x, tz = target.z; const d = M.dist(this.x, this.z, tx, tz); const acc = this.isSwat ? 0.14 : this.isCop ? 0.3 : 0.22;
      const ang = Math.atan2(tx - this.x, tz - this.z) + (W.rng() - 0.5) * acc * (1 + d / 20);
      PLAYER.fireBullet(this, this.x, this.z, 1.3, ang, wp, 0.7);
      this.weaponOut = true; this.recoil = 0.12;
    }
    moveToward(tx, tz, speed, dt) {
      const dx = tx - this.x, dz = tz - this.z; const d = Math.hypot(dx, dz); if (d < 0.05) { this.speed = 0; return; }
      const desired = Math.atan2(dx, dz); this.angle += M.clamp(M.angleTo(this.angle, desired), -1, 1) * Math.min(1, 10 * dt);
      this.speed = M.lerp(this.speed, speed, Math.min(1, 6 * dt));
      const f = [Math.sin(this.angle), Math.cos(this.angle)]; this.vx = f[0] * this.speed; this.vz = f[1] * this.speed;
    }
    faceTo(tx, tz, dt) { const desired = Math.atan2(tx - this.x, tz - this.z); this.angle += M.clamp(M.angleTo(this.angle, desired), -1, 1) * Math.min(1, 10 * dt); }
    moveBody(dt, ragdoll) {
      if (ragdoll || this.airborne) { const drag = ragdoll && !this.airborne ? 6 : 0.5; this.vx -= this.vx * Math.min(1, drag * dt); this.vz -= this.vz * Math.min(1, drag * dt); if (this.airborne) { this.vy -= 22 * dt; this.y += this.vy * dt; } }
      else { this.speed = Math.hypot(this.vx, this.vz); }
      this.x += this.vx * dt; this.z += this.vz * dt;
      const g = CITY.groundY(this.x, this.z);
      if (this.airborne) { if (this.y <= g) { this.y = g; this.airborne = false; this.vy = 0; if (this.state === 'dead') { this.vx *= 0.3; this.vz *= 0.3; } } } else this.y = g;
      const res = W.pushOut(this.x, this.z, 0.4); this.x = res.x; this.z = res.z;
      if (!ragdoll) for (const c of W.cars) { if (c.removed || M.dist2(c.x, c.z, this.x, this.z) > 49) continue; for (const [cx, cz, r] of c.circles()) { const dx = this.x - cx, dz = this.z - cz; const rr = r + 0.35; const d2 = dx * dx + dz * dz; if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); this.x = cx + dx / d * rr; this.z = cz + dz / d * rr; } } }
      if (!ragdoll) { this.vx = 0; this.vz = 0; this.phase += dt * (this.speed > 3 ? 11 : 7) * Math.min(1, this.speed / 1.2); }
    }
    // ---- Rig
    entity() { if (this.state === 'sit' && this.seat) { M.trs(seatWorld, this.seat.x, this.seat.y, this.seat.z, this.seat.a); buildRigSeated(this, this.model, this.bones, seatWorld, 0, 0, 0, 0, false, this.headYaw); this.emis.fill(0); return { mesh: this.mesh, model: this.model, bones: this.bones, emis: this.emis }; } buildRig(this, this.model, this.bones); this.emis.fill(0); return { mesh: this.mesh, model: this.model, bones: this.bones, emis: this.emis }; }
    remove() { this.removed = true; if (this.inCar) { if (this.inCar.driver === this) this.inCar.driver = null; } }
  }

  const tmp = M.create(), tmp2 = M.create();
  function bone(out, off, x, y, z, yaw, pitch, roll, s = 1) { M.trsEuler(tmp, x, y, z, yaw, pitch, roll, s, s, s); out.set(tmp, off); }
  // A child bone that bends about a joint given in its parent's space (knees and elbows).
  const jt1 = M.create(), jt2 = M.create(), jt3 = M.create();
  function jointBone(out, off, parentOff, jx, jy, jz, pitch) { M.trsEuler(jt1, jx, jy, jz, 0, pitch, 0); M.trs(jt2, -jx, -jy, -jz, 0); M.multiply(jt3, jt1, jt2); M.multiply(jt1, out.subarray(parentOff, parentOff + 16), jt3); out.set(jt1, off); }
  const KNEE_Y = -LEG_H * 0.5, ELBOW_Y = -0.31;
  // Animates the rig from the ped's state. Also used by the player. The walk is a two-beat cycle: the thigh swings,
  // the knee folds while the foot is in the air and straightens for the heel strike, the pelvis sways and counter-
  // rotates against the shoulders, the arms swing opposite the legs with the elbows folding on the forward swing.
  function buildRig(p, model, bones) {
    const lying = p.lying || 0; const dead = p.state === 'dead';
    const spd = p.speed || 0; const walk = Math.min(1, spd / 1.2); const run = M.clamp((spd - 3) / 3, 0, 1);
    const ph = p.phase; const amp = 0.45 + 0.6 * run; const swing = Math.sin(ph) * amp * walk;
    const bob = Math.abs(Math.cos(ph)) * (0.035 + 0.04 * run) * walk;
    const aim = p.aim || 0; const punch = p.punchT > 0 ? Math.sin(Math.min(1, p.punchT / 0.3) * Math.PI) : 0;
    const t = W.state.elapsed + (p.phase % 7); const idle = 1 - walk; const breath = Math.sin(t * 1.6) * idle;
    const hip = LEG_H + bob - lying * (LEG_H - 0.25) - (0.08 + 0.05 * run) * walk * 0.35; // knees bend, so the pelvis rides a little lower when moving
    const lean = run * 0.2 + walk * 0.04 + (p.recoil || 0) * -0.5;
    const sway = Math.sin(ph) * walk; // pelvis moves over the planted foot
    M.trsEuler(model, p.x, p.y, p.z, p.angle, lying * (dead ? -Math.PI / 2 * p.fallDir : -Math.PI / 2), 0, p.sx || 1, p.sy || 1, p.sx || 1);
    // torso: lean, hip sway and a counter-twist against the leg swing; breathing when standing
    bone(bones, 0, sway * 0.02, hip + breath * 0.006, 0, -sway * 0.09 + Math.sin(t * 0.7) * 0.02 * idle, lean, sway * 0.05 + breath * 0.008);
    // head: rides on the torso and cancels most of the twist so it keeps looking where the ped goes
    bone(bones, 16, sway * 0.02, hip + TORSO_H + 0.03 + breath * 0.006, lean * 0.2, (aim ? 0 : (p.headYaw || 0)) + sway * 0.07, lean * 0.5 + (aim ? 0 : Math.sin(ph * 0.5) * 0.03 + Math.sin(t * 0.9) * 0.02 * idle), -sway * 0.03);
    // upper arms: pivot at the shoulders, swing opposite to the legs, held out a little at a run
    const armPitchL = aim ? -0.4 : swing * 0.85 - 0.45 * run, armPitchR = aim ? -Math.PI / 2 + 0.05 + (p.recoil || 0) * 2 : -swing * 0.85 - 0.45 * run - punch * 1.4;
    const armRoll = 0.06 + run * 0.3 + Math.sin(t * 1.1) * 0.015 * idle;
    bone(bones, 32, sway * 0.02, hip + SHOULDER + breath * 0.006, 0, 0, armPitchL, armRoll + (aim ? 0.12 : 0));
    bone(bones, 48, sway * 0.02, hip + SHOULDER + breath * 0.006, 0, aim ? -0.15 : 0, armPitchR, -armRoll);
    // forearms: elbows fold on the forward swing, stay bent at a run, straight when aiming
    const elbowL = aim ? -0.05 : -(0.22 + 0.35 * Math.max(0, Math.sin(ph)) * walk + 0.8 * run);
    const elbowR = aim ? 0 : -(0.22 + 0.35 * Math.max(0, -Math.sin(ph)) * walk + 0.8 * run + punch * 0.6);
    jointBone(bones, 144, 32, 0.3, ELBOW_Y, 0, elbowL); jointBone(bones, 160, 48, -0.3, ELBOW_Y, 0, elbowR);
    // thighs: pivot at the hips; knees fold while the foot swings through and straighten for the strike
    bone(bones, 64, sway * 0.02, hip, 0, 0, -swing * 0.95, 0); bone(bones, 80, sway * 0.02, hip, 0, 0, swing * 0.95, 0);
    const kneeL = (0.08 + (0.75 + 0.55 * run) * Math.max(0, Math.cos(ph))) * walk + 0.04 * idle;
    const kneeR = (0.08 + (0.75 + 0.55 * run) * Math.max(0, -Math.cos(ph))) * walk + 0.04 * idle;
    jointBone(bones, 112, 64, 0.11, KNEE_Y, 0, dead ? 0 : kneeL); jointBone(bones, 128, 80, -0.11, KNEE_Y, 0, dead ? 0 : kneeR);
    // weapon: follows the right forearm, hidden when unarmed
    if (p.weaponOut && !dead) bones.set(bones.subarray(160, 176), 96); else bone(bones, 96, 0, -100, 0, 0, 0, 0, 0.001);
    for (let i = 11; i < RENDER.MAX_BONES; i++) bones.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], i * 16);
    if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - 0.016 * 3);
    if (p.punchT > 0) p.punchT -= 0.016;
  }

  // Seated pose inside a car (or on a bench): hips at the seat, thighs forward, shins down, hands on the wheel.
  const seatTmp = M.create(), seatLocal = M.create(), seatWorld = M.create();
  function buildRigSeated(p, model, bones, carModel, lx, ly, lz, yaw, driving, headYaw = 0, fit = 1) {
    M.trs(seatLocal, lx, ly, lz, yaw, (p.sx || 1) * fit, (p.sy || 1) * fit, (p.sx || 1) * fit); M.multiply(model, carModel, seatLocal);
    const hip = 0.02; const lean = driving ? 0.12 : 0.05;
    bone(bones, 0, 0, hip, 0, 0, lean, 0);
    bone(bones, 16, 0, hip + TORSO_H + 0.03, 0, headYaw, lean * 0.5, 0);
    const armP = driving ? -0.9 : -0.35; bone(bones, 32, 0, hip + SHOULDER, 0, driving ? 0.25 : 0, armP, driving ? 0.15 : 0.05); bone(bones, 48, 0, hip + SHOULDER, 0, driving ? -0.25 : 0, armP, driving ? -0.15 : -0.05);
    jointBone(bones, 144, 32, 0.3, ELBOW_Y, 0, driving ? -0.7 : -0.5); jointBone(bones, 160, 48, -0.3, ELBOW_Y, 0, driving ? -0.7 : -0.5);
    bone(bones, 64, 0, hip, 0, 0, -Math.PI / 2 + 0.15, 0); bone(bones, 80, 0, hip, 0, 0, -Math.PI / 2 + 0.15, 0);
    jointBone(bones, 112, 64, 0.11, KNEE_Y, 0, Math.PI / 2 - 0.35); jointBone(bones, 128, 80, -0.11, KNEE_Y, 0, Math.PI / 2 - 0.35);
    bone(bones, 96, 0, -100, 0, 0, 0, 0, 0.001);
    for (let i = 11; i < RENDER.MAX_BONES; i++) bones.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], i * 16);
  }
  // Seat positions in car-local space: driver on the left (+x), passenger right, rear seats behind.
  function seatOf(car, index) {
    const s = car.spec; const L = s.len, W = s.wid;
    const seatY = MESH.seatHeight(s);
    if (s.bus) return [index === 0 ? W * 0.25 : -W * 0.25, seatY, L / 2 - 1.2 - Math.floor(index / 2) * 1.2];
    if (s.box) return [index === 0 ? W * 0.22 : -W * 0.22, seatY, L / 2 - L * 0.3 * 0.55];
    if (s.armor || s.hgt > 2.0) return [index % 2 === 0 ? W * 0.22 : -W * 0.22, seatY, L / 2 - 1.5 - Math.floor(index / 2) * 1.0];
    const half = L / 2; const c0 = half - s.cabin[0] * L - s.hood * 0.5, c1 = half - s.cabin[1] * L - s.hood * 0.5; const seatZ = (c0 + c1) / 2 - 0.1;
    const row = Math.floor(index / 2), side = index % 2 === 0 ? 1 : -1; return [side * W * 0.21, seatY, seatZ - row * 0.9];
  }
  function seatedEntity(p, car, index, driving) { const [lx, ly, lz] = seatOf(car, index); buildRigSeated(p, p.model, p.bones, car.model, lx, ly, lz, 0, driving, 0, MESH.seatFit(car.spec).scale); p.emis.fill(0); return { mesh: p.mesh, model: p.model, bones: p.bones, emis: p.emis }; }

  // ---- Spawning
  function spawn(x, z, opts = {}) { const look = opts.look || looks[Math.floor(W.rng() * looks.length)]; const p = new Ped(look, x, z, opts); W.peds.push(p); return p; }
  function spawnDriver(car) { const p = new Ped(looks[Math.floor(W.rng() * looks.length)], car.x, car.z, {}); p.inCar = car; p.state = 'driving'; W.peds.push(p); return p; }
  function spawnCop(x, z, opts = {}) { const swat = !!opts.swat; const p = spawn(x, z, { look: swat ? SWAT : COP, cop: true, swat, weapon: opts.weapon || (swat ? 'rifle' : 'pistol'), health: swat ? 120 : 70 }); p.weaponOut = true; p.state = 'walk'; return p; }
  function populate(px, pz, camYaw, want) {
    let count = 0; for (const p of W.peds) if (!p.removed && !p.inCar && !p.isCop && !p.important) count++;
    if (count >= want) return;
    const r = W.rng();
    if (r < 0.12) { // someone on a bench
      for (let tries = 0; tries < 6; tries++) { const bn = CITY.props.bench[Math.floor(W.rng() * CITY.props.bench.length)]; if (!bn || bn.taken) continue; const d = M.dist(bn.x, bn.z, px, pz); if (d < 30 || d > 120) continue;
        const a = bn.a || 0; const side = W.rng() < 0.5 ? 0.45 : -0.45; const p = spawn(bn.x + Math.cos(a) * side, bn.z - Math.sin(a) * side, {}); p.state = 'sit'; p.seat = { x: p.x, y: CITY.groundY(bn.x, bn.z) + 0.46, z: p.z, a: a }; p.angle = a; bn.taken = true; p.onRemove = () => { bn.taken = false; }; return; }
    }
    for (let tries = 0; tries < 8; tries++) {
      const n = CITY.walkNodes[Math.floor(W.rng() * CITY.walkNodes.length)]; const d = M.dist(n.x, n.z, px, pz); if (d < 40 || d > 130) continue;
      const ang = Math.atan2(n.x - px, n.z - pz); if (d < 90 && Math.abs(M.angleTo(camYaw, ang)) < 0.8) continue;
      if (r > 0.82) { // two people talking
        const a = spawn(n.x + 0.5, n.z, { node: n }), b2 = spawn(n.x - 0.5, n.z, { node: n }); a.state = b2.state = 'chat'; a.partner = b2; b2.partner = a; a.angle = -Math.PI / 2; b2.angle = Math.PI / 2; a.gestureT = W.rng() * 3; b2.gestureT = W.rng() * 3; return;
      }
      const p = spawn(n.x + (W.rng() - 0.5), n.z + (W.rng() - 0.5), { node: n });
      if (CITY.district(CITY.blockAt(n.x, n.z)?.i ?? 0, CITY.blockAt(n.x, n.z)?.j ?? 0) === 'eastside' && W.rng() < 0.25) { p.look = GANG; p.mesh = getMesh(GANG); p.isGang = true; p.weapon = W.rng() < 0.5 ? 'pistol' : null; p.health = 80; }
      return;
    }
  }
  function despawn(px, pz) { let w = 0; for (const p of W.peds) { if (!p.removed && !p.important) { const d = M.dist(p.x, p.z, px, pz); if ((d > 170 && !p.inCar) || (p.state === 'dead' && (p.deadT > 25 || (d > 60 && p.deadT > 6)))) p.removed = true; } if (p.removed && p.onRemove) { p.onRemove(); p.onRemove = null; } if (!p.removed) W.peds[w++] = p; } W.peds.length = w; }
  function updateAll(dt) { for (const p of W.peds) p.update(dt); }
  return { Ped, spawn, spawnDriver, spawnCop, populate, despawn, updateAll, buildRig, buildRigSeated, seatOf, seatedEntity, getMesh, looks, COP, SWAT, GANG, PLAYER_LOOK, MARLA, OKAFOR, CRANE };
})();
