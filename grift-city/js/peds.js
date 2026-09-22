// GRIFT CITY — pedestrians: civilians who wander the sidewalks and flee, cops who chase and shoot, gang muscle,
// drivers, and the shared bone rig used by the player.
'use strict';
const PEDS = (() => {
  const SKIN = [[0.95, 0.8, 0.68], [0.85, 0.65, 0.5], [0.6, 0.42, 0.3], [0.42, 0.28, 0.2], [0.9, 0.75, 0.62]];
  const CLOTH = [[0.8, 0.2, 0.2], [0.2, 0.3, 0.7], [0.9, 0.9, 0.85], [0.15, 0.15, 0.15], [0.26, 0.6, 0.3], [0.9, 0.7, 0.2], [0.6, 0.3, 0.6], [0.4, 0.4, 0.45], [0.95, 0.5, 0.2], [0.2, 0.7, 0.75], [0.95, 0.75, 0.8], [0.55, 0.75, 0.95], [0.35, 0.25, 0.2], [0.75, 0.85, 0.6], [0.5, 0.1, 0.15], [0.98, 0.95, 0.6], [0.25, 0.45, 0.55], [0.7, 0.7, 0.72], [0.1, 0.35, 0.25], [1, 0.6, 0.1]];
  const PANTS = [[0.2, 0.25, 0.4], [0.15, 0.15, 0.15], [0.45, 0.4, 0.35], [0.3, 0.3, 0.35], [0.55, 0.5, 0.42], [0.25, 0.3, 0.45], [0.38, 0.33, 0.28], [0.2, 0.22, 0.24]];
  for (const c of CLOTH) { const g = (c[0] + c[1] + c[2]) / 3; for (let i = 0; i < 3; i++) c[i] = c[i] * 0.72 + g * 0.28; } // fabric, not paint
  const HAIR = [[0.1, 0.08, 0.06], [0.35, 0.22, 0.1], [0.75, 0.6, 0.3], [0.5, 0.5, 0.5], [0.6, 0.15, 0.1]];
  const looks = []; const meshCache = {};
  const r0 = M.rng(77);
  for (let i = 0; i < 90; i++) looks.push({ skin: r0.pick(SKIN), shirt: r0.pick(CLOTH), pants: r0.pick(PANTS), hair: r0.pick(HAIR), hat: r0.chance(0.2) ? r0.pick(CLOTH) : null, beanie: r0.chance(0.4), jacket: r0.chance(0.35) ? r0.pick(CLOTH) : null, sleeves: r0.chance(0.5), glasses: r0.chance(0.15), bag: r0.chance(0.2) ? r0.pick(PANTS) : null, skirt: r0.chance(0.25), longHair: r0.chance(0.25), hairStyle: r0.pick([0, 0, 1, 1, 2, 3, 4, 5, 6, 7]), beard: r0.chance(0.2) });
  // district wardrobes: suits downtown, hi-vis and overalls on the east side, running gear in the leafy west, wool by the water
  const SUIT = () => ({ hairStyle: r0.pick([0, 1, 1, 3, 4, 5]), beard: r0.chance(0.15), skin: r0.pick(SKIN), shirt: [0.95, 0.95, 0.95], pants: r0.pick([[0.1, 0.1, 0.13], [0.2, 0.2, 0.3], [0.35, 0.3, 0.28]]), hair: r0.pick(HAIR), hat: null, jacket: r0.pick([[0.1, 0.1, 0.13], [0.2, 0.2, 0.3], [0.35, 0.3, 0.28], [0.15, 0.2, 0.35]]), sleeves: true, glasses: r0.chance(0.3), bag: r0.chance(0.4) ? [0.15, 0.1, 0.08] : null, skirt: r0.chance(0.3), longHair: r0.chance(0.3) });
  const WORK = () => ({ hairStyle: r0.pick([0, 5, 6, 1]), beard: r0.chance(0.35), skin: r0.pick(SKIN), shirt: r0.pick([[1, 0.6, 0.1], [0.95, 0.9, 0.2], [0.3, 0.35, 0.55], [0.4, 0.4, 0.42]]), pants: r0.pick([[0.3, 0.35, 0.55], [0.35, 0.3, 0.25], [0.2, 0.2, 0.22]]), hair: r0.pick(HAIR), hat: r0.chance(0.5) ? [0.95, 0.8, 0.15] : null, beanie: r0.chance(0.3), jacket: null, sleeves: r0.chance(0.6), glasses: false, bag: null, skirt: false, longHair: r0.chance(0.15) });
  const CIRC = new Float64Array(9); // scratch for a car's collision circles, so walking past traffic allocates nothing
  const RUN = () => ({ hairStyle: r0.pick([0, 3, 4, 3]), skin: r0.pick(SKIN), shirt: r0.pick([[0.95, 0.3, 0.5], [0.2, 0.8, 0.9], [0.9, 0.9, 0.2], [0.98, 0.98, 0.98], [0.1, 0.1, 0.1]]), pants: r0.pick([[0.1, 0.1, 0.12], [0.2, 0.2, 0.5], [0.4, 0.4, 0.42]]), hair: r0.pick(HAIR), hat: r0.chance(0.4) ? r0.pick(CLOTH) : null, jacket: null, sleeves: false, glasses: r0.chance(0.4), bag: null, skirt: false, longHair: r0.chance(0.5) });
  const WOOL = () => ({ hairStyle: r0.pick([0, 5, 2]), beard: r0.chance(0.4), skin: r0.pick(SKIN), shirt: r0.pick([[0.35, 0.3, 0.28], [0.2, 0.25, 0.3], [0.5, 0.45, 0.35]]), pants: r0.pick(PANTS), hair: r0.pick(HAIR), hat: null, beanie: r0.chance(0.7), jacket: r0.pick([[0.9, 0.65, 0.1], [0.2, 0.25, 0.3], [0.35, 0.3, 0.28]]), sleeves: true, glasses: false, bag: null, skirt: false, longHair: r0.chance(0.2) });
  const WARDROBE = { downtown: [], eastside: [], westfield: [], southport: [] }; for (let i = 0; i < 16; i++) { WARDROBE.downtown.push(SUIT()); WARDROBE.eastside.push(WORK()); WARDROBE.westfield.push(RUN()); WARDROBE.southport.push(WOOL()); }
  const VENDOR = { skin: [0.85, 0.65, 0.5], shirt: [0.95, 0.95, 0.9], pants: [0.2, 0.2, 0.22], hair: [0.2, 0.15, 0.1], hat: [0.95, 0.95, 0.9], jacket: null, sleeves: false, glasses: false, bag: null, skirt: false, longHair: false };
  const COP = { badge: true, skin: [0.9, 0.75, 0.62], shirt: [0.2, 0.3, 0.6], pants: [0.15, 0.18, 0.3], hair: [0.1, 0.1, 0.1], hat: [0.15, 0.18, 0.35], jacket: null, sleeves: true, glasses: true };
  const SWAT = { skin: [0.85, 0.7, 0.6], shirt: [0.12, 0.12, 0.14], pants: [0.1, 0.1, 0.12], hair: [0.1, 0.1, 0.1], hat: [0.1, 0.1, 0.12], jacket: [0.2, 0.2, 0.22], sleeves: true, glasses: true };
  const GANG = { skin: [0.6, 0.42, 0.3], shirt: [0.55, 0.05, 0.1], pants: [0.12, 0.12, 0.12], hair: [0.08, 0.06, 0.06], hat: [0.5, 0.05, 0.1], jacket: [0.15, 0.15, 0.15], sleeves: true };
  const PLAYER_LOOK = { hairStyle: 1, stubble: true, chain: true, shoes: [.13,.095,.07], skin: [0.9, 0.74, 0.62], shirt: [0.85, 0.85, 0.8], pants: [0.2, 0.2, 0.25], hair: [0.15, 0.1, 0.08], hat: null, jacket: [0.36, 0.25, 0.19], sleeves: true };
  const MARLA = { tailored: true, hairStyle: 4, earrings: true, chain: true, shoes: [.075,.06,.07], skin: [0.85, 0.65, 0.5], shirt: [.77,.49,.30], pants: [.12,.17,.19], hair: [0.05, 0.05, 0.05], hat: null, jacket: [.13,.27,.29], sleeves: true };
  const DEBTOR = { skin: [.87,.66,.49], shirt: [.60,.28,.20], pants: [.62,.55,.41], hair: [.28,.17,.095], hairStyle: 3, glasses: true, sleeves: false, pattern: 'stripe', build: 'stocky', shoes: [.76,.73,.65], chain: true };
  const OKAFOR = { skin: [0.42, 0.28, 0.2], shirt: [0.9, 0.85, 0.7], pants: [0.3, 0.3, 0.35], hair: [0.05, 0.05, 0.05], hat: [0.2, 0.25, 0.3], jacket: [0.85, 0.55, 0.1], sleeves: true };
  const CRANE = { skin: [0.92, 0.8, 0.7], shirt: [0.95, 0.95, 0.95], pants: [0.2, 0.2, 0.25], hair: [0.7, 0.7, 0.7], hat: null, jacket: [0.2, 0.2, 0.25], sleeves: true, glasses: true };
  function getMesh(look, lod = false) { const key = (lod ? 'L' : 'H') + JSON.stringify(look); if (!meshCache[key]) meshCache[key] = MESH.pedMesh(look, lod).build(); return meshCache[key]; }
  const SHOUTS = ['Hey!', 'Watch it!', 'My car!', 'Somebody call the cops!', 'Get away from me!', 'What is wrong with you?!', 'Not today!', 'Help!', 'Are you insane?', 'I have a family!'];

  const LEG_H = 0.85, TORSO_H = 0.65, SHOULDER = 0.6;
  class Ped {
    constructor(look, x, z, opts = {}) {
      this.look = look; this.mesh = getMesh(look); this.lodMesh = getMesh(look, true); this.x = x; this.z = z; this.y = CITY.groundY(x, z); this.angle = W.rng() * M.TAU;
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
    launch(vx, vy, vz) { this.vx += vx; this.vz += vz; this.vy = Math.max(this.vy, vy); this.airborne = true; if (this.rag) ragImpulse(this.rag, vx, vy, vz); else if (this.knockT > 0 || this.state === 'dead') this.rag = makeRagdoll(this, vx, vy, vz); }
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
      else { this.damage(spd * 4, car.driver === PLAYER ? PLAYER : car); if (this.state !== 'dead') this.knockT = 1.8; this.launch(dir[0] * spd * 0.8 + car.right[0] * (Math.sign(car.local(this.x, this.z)[1]) * 3), 3, dir[1] * spd * 0.8 + car.right[1] * (Math.sign(car.local(this.x, this.z)[1]) * 3)); this.knockT = 1.8; if (this.state === 'goto') this.gotoResume = true; this.state = this.state === 'dead' ? 'dead' : 'knocked'; AUDIO.play('bump', this.x, this.z); if (car.driver === PLAYER) { this.scare(car.x, car.z); POLICE.crime('hit', this.x, this.z, this); } }
      if (car.driver === PLAYER) car.damage(2, null);
    }
    damage(amount, source, dir = null) {
      if (this.state === 'dead' || this.invincible) return; this.health -= amount; if (!(this.knockT > 0)) this.flinchT = 0.35; // a hit reads on the body before anything else happens
      W.FX.blood(this.x, 1.2, this.z, Math.min(10, 3 + amount / 6), dir);
      if (this.health <= 0) { this.die(source, 'shot'); if (dir) this.launch(dir[0] * 2.5, 2, dir[1] * 2.5); this.fallDir = 1; }
      else { if (!this.isCop && !this.isGang && !this.hostile && this.role !== 'target' && this.role !== 'crew') { if (source === PLAYER && amount < 35 && !PLAYER.car && W.rng() < 0.3) { this.hostile = true; this.state = 'walk'; this.seat = null; this.partner = null; this.say(W.rng() < 0.5 ? 'You want some?!' : 'Big mistake!'); } else this.scare(source ? source.x : this.x, source ? source.z : this.z); } if (source === PLAYER && (this.isGang || this.role === 'target')) this.hostile = true; if (source === PLAYER && !this.isCop) POLICE.crime('assault', this.x, this.z, this); if (source === PLAYER && this.isCop) POLICE.crime('cop', this.x, this.z, this); }
    }
    die(source, how) {
      if (this.state === 'dead' || this.invincible) return; this.state = 'dead'; this.deadT = 0; this.aim = 0; this.weaponOut = false; if (!this.inCar && !this.rag) this.rag = makeRagdoll(this, this.vx, 0, this.vz);
      if (this.inCar) { const c = this.inCar; if (c.driver === this) c.driver = null; this.inCar = null; this.x = c.x; this.z = c.z; this.removed = true; }
      if (source === PLAYER || (source && source.driver === PLAYER)) { POLICE.crime(this.isCop ? 'copkill' : (how === 'car' ? 'killcar' : 'kill'), this.x, this.z, this); PLAYER.stats.kills++; if (this.isGang) MISSIONS.rampageKill(how === 'car' ? 'gangcar' : 'gangkill', this); if (!this.isCop && W.rng() < 0.6) PICKUPS.dropCash(this.x, this.z, this.money + (this.isGang ? 60 : 0)); }
      if (how !== 'explosion') AUDIO.play('scream', this.x, this.z);
      for (const p of W.pedsNear(this.x, this.z, 30)) if (p !== this) p.scare(source ? source.x : this.x, source ? source.z : this.z);
      if (this.onDeath) this.onDeath(this, source);
    }
    // ---- AI
    update(dt) {
      if (this.removed) return; this.gesturePulse = Math.max(0,(this.gesturePulse || 0)-dt); this.recoil = Math.max(0, (this.recoil || 0) - dt * 3); this.punchT = Math.max(0, (this.punchT || 0) - dt); this.stateT += dt; if (this.shoutT > 0) this.shoutT -= dt; if (this.hitT > 0) this.hitT -= dt; if (this.attackCooldown > 0) this.attackCooldown -= dt;
      if(this.reloadT>0){this.reloadT=Math.max(0,this.reloadT-dt);if(this.reloadT===0)this.tacticalAmmo=WEAPONS[this.weapon]?.clip||8;}
      if (this.inCar) { this.x = this.inCar.x; this.z = this.inCar.z; this.y = this.inCar.y; return; }
      if (this.flinchT > 0) this.flinchT -= dt; if (this.kickT > 0) this.kickT -= dt;
      if (this.rag) { stepRagdoll(this, dt); if (this.state !== 'dead' && this.knockT > 0) { this.knockT -= dt; if (this.knockT <= 0) { endRagdoll(this); this.state = this.gotoTarget && this.gotoResume ? 'goto' : (this.fear > 0 ? 'flee' : 'walk'); this.lying = 0; } return; } }
      if (this.state === 'dead') { this.deadT += dt; this.lying = Math.min(1, this.lying + dt * 3.5); if (!this.rag) this.moveBody(dt, true); if (!this.pooled && this.deadT > 1.2 && !this.airborne) { this.pooled = true; const a = this.angle; W.decal('blood', this.x - Math.sin(a) * 0.3, this.z - Math.cos(a) * 0.3, this.x + Math.sin(a) * 1.0, this.z + Math.cos(a) * 1.0, 1.1, [0.35, 0.01, 0.01], 0.75); } return; }
      if (this.knockT > 0) { this.knockT -= dt; this.lying = Math.min(1, this.lying + dt * 4); this.moveBody(dt, true); if (this.knockT <= 0) { this.state = this.gotoTarget && this.gotoResume ? 'goto' : (this.fear > 0 ? 'flee' : 'walk'); this.lying = 0; } return; }
      if (this.lying > 0) this.lying = Math.max(0, this.lying - dt * 3);
      // hear gunfire
      for (const n of W.state.noises) { if (M.dist2(n.x, n.z, this.x, this.z) < n.r * n.r) { if (this.isCop) { this.alerted = 8;this.heardPos={x:n.x,z:n.z}; } else this.scare(n.x, n.z); } }
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
      if (this.state === 'chat') { this.speed = 0; if (this.partner && this.partner.alive) { this.faceTo(this.partner.x, this.partner.z, dt); this.gestureT -= dt; if (this.gestureT <= 0) { this.gestureT = 1.5 + W.rng() * 4; this.gesturePulse = 1.25; } } else this.state = 'walk'; return; }
      if (this.stationary) { this.speed = 0; if (this.faceTarget) this.faceTo(this.faceTarget.x, this.faceTarget.z, dt); return; }
      if (this.state === 'stand') { this.speed = 0; this.wanderT -= dt; if (this.wanderT <= 0) this.state = 'walk'; return; }
      if (!this.node) this.node = CITY.nearestWalkNode(this.x, this.z);
      if (!this.target) this.pickNext();
      const t = this.target; const d = M.dist(this.x, this.z, t.x, t.z);
      if (d < 0.8) { this.prevNode = this.node; this.node = t; this.target = null; if (W.rng() < 0.12) { this.state = 'stand'; this.wanderT = 2 + W.rng() * 5; } return; }
      // step aside for the player and other peds
      let ox = 0, oz = 0;
      if (PLAYER.alive && !PLAYER.car) { const dx = this.x - PLAYER.x, dz = this.z - PLAYER.z; const dd = dx * dx + dz * dz; if (dd < 2.2) { const l = Math.sqrt(dd) || 1; ox += dx / l * 1.5; oz += dz / l * 1.5; } }
      this.moveToward(t.x + ox, t.z + oz, this.walkSpeed, dt, t.y??.15);
    }
    pickNext() {
      const links = this.node.links.filter(l => l.to !== this.prevNode); const pool = links.length ? links : this.node.links;
      // prefer not crossing
      let pick = pool[Math.floor(W.rng() * pool.length)]; if (pick.cross && W.rng() < 0.6) { const nc = pool.filter(l => !l.cross); if (nc.length) pick = nc[Math.floor(W.rng() * nc.length)]; }
      this.target = pick.to;
    }
    aiCrew(dt) { // follows the player, fights back
      const p = PLAYER; if (p.car && !this.inCar) { if (M.dist(this.x, this.z, p.car.x, p.car.z) < 4) { this.enterCar(p.car); return; } this.moveToward(p.car.x, p.car.z, 5.5, dt); return; }
      const d = M.dist(this.x, this.z, p.x, p.z); if (d > 3.5) this.moveToward(p.x, p.z, d > 12 ? 6 : 4, dt, p.P.y); else { this.speed = 0; this.faceTo(p.x, p.z, dt); }
      // shoot hostiles
      if (this.weapon) { let best = null, bd = 30 * 30; for (const o of W.peds) { if (o === this || !o.alive || o.inCar || !(o.isCop || o.hostile || o.isGang)) continue; const dd = M.dist2(o.x, o.z, this.x, this.z); if (dd < bd) { bd = dd; best = o; } } if (best && W.los(this.x, this.z, best.x, best.z)) { this.faceTo(best.x, best.z, dt); this.aim = 1; this.fireAt(best, dt); } else this.aim = 0; }
    }
    enterCar(car) { if (car.passengers.length >= car.spec.seats - 1) return; this.inCar = car; car.passengers.push(this); }
    exitCar() { const c = this.inCar; if (!c) return; const i = c.passengers.indexOf(this); if (i >= 0) c.passengers.splice(i, 1); if (c.driver === this) c.driver = null; this.inCar = null; const r = c.right; this.x = c.x - r[0] * (c.spec.wid / 2 + 0.8); this.z = c.z - r[1] * (c.spec.wid / 2 + 0.8); this.y = CITY.groundY(this.x, this.z, this.y); this.vx = this.vz = 0; }
    aiHostile(dt) { // gang members / mission targets: attack the player when hostile, otherwise loiter
      const p = PLAYER; const d = M.dist(this.x, this.z, p.x, p.z);
      if (this.state === 'flee') { this.aiCivilian(dt); return; }
      if (!this.hostile) { if (this.isGang && d < 14 && p.alive && (W.state.noises.length || p.wanted > 0) && W.rng() < 0.01) this.hostile = true; if (this.isGang && ECON.craneHostile() && d < 22 && p.alive && W.los(this.x, this.z, p.x, p.z) && W.rng() < 0.03) { this.hostile = true; this.say("That's the one who crossed Crane!"); } if (this.stationary) { this.speed = 0; if (d < 10) this.faceTo(p.x, p.z, dt); } else this.aiCivilian(dt); return; }
      if (!p.alive) { this.aim = 0; this.speed = 0; return; }
      const canSee = d < 60 && W.sight3(this.x,this.y+1.5,this.z,p.x,p.P.y+1.1,p.z,[p.car]);
      if(this.weapon&&typeof TACTICS!=='undefined'){TACTICS.step(this,p,dt,canSee);return;}
      if (this.weapon) {
        if (canSee && d < 28) { this.speed = 0; this.faceTo(p.x, p.z, dt); this.aim = 1; this.fireAt(p, dt); if (d < 6 && !p.car) this.moveToward(this.x + (this.x - p.x), this.z + (this.z - p.z), 2, dt); }
        else { this.aim = 0; if (d < 90) this.moveToward(p.x, p.z, 5.5, dt, p.P.y); else this.speed = 0; }
      } else { // melee
        if (d > 1.6) { this.aim = 0; if (d < 80) this.moveToward(p.x, p.z, 5.5, dt, p.P.y); else this.speed = 0; }
        else { this.speed = 0; this.faceTo(p.x, p.z, dt); if (this.attackCooldown <= 0 && !p.car) { this.attackCooldown = 0.9; this.punchT = 0.3; p.hurt(8, 'melee', this); AUDIO.play('punch', this.x, this.z); } }
      }
    }
    aiCop(dt) {
      const p = PLAYER; const d = M.dist(this.x, this.z, p.x, p.z);
      if (this.alerted > 0) this.alerted -= dt;
      const want = p.wanted; const canSee = want>0 && POLICE.observe(this);
      if (want <= 0 || !p.alive) { this.aim = 0;if(want<=0&&this.alerted>0&&this.heardPos){this.moveToward(this.heardPos.x,this.heardPos.z,2.8,dt);return;} if (this.patrol) this.aiCivilian(dt); else { this.speed = 0; if (this.car && !this.inCar && d > 10) { /* return to car */ this.moveToward(this.car.x, this.car.z, 2, dt); if (M.dist(this.x, this.z, this.car.x, this.car.z) < 2.5 && !this.car.driver) { this.inCar = this.car; this.car.driver = this; this.car.ai.mode = 'traffic'; this.car.ai.edge = null; this.car.siren = false; } } } return; }
      if(want>=2&&d>1.7&&typeof TACTICS!=='undefined'){TACTICS.step(this,p,dt,canSee);return;}
      if (canSee) POLICE.seen(this);
      if (!canSee) { // head toward last known position
        if (POLICE.lastSeen) { const ls = POLICE.pursuitPoint(this); if (M.dist(this.x, this.z, ls[0], ls[1]) > 3) this.moveToward(ls[0], ls[1], 5.5, dt); else this.speed = 0; } this.aim = 0; return;
      }
      // arrest if close and player is slow / on foot
      if (d < 1.7 && (!p.car || p.car.absSpeed < 1.5) && p.alive) { this.speed = 0; this.faceTo(p.x, p.z, dt); this.aim = 1; POLICE.arrestProgress(dt, this); return; }
      if (p.car && p.car.absSpeed < 2 && d < 3.5) { this.moveToward(p.x, p.z, 5.5, dt, p.P.y); this.aim = 0; return; }
      const shootRange = this.isSwat ? 40 : 26;
      if (canSee && d < shootRange && (want >= 2 || p.car || this.isSwat)) { this.aim = 1; this.faceTo(p.x, p.z, dt); if (d > 9 || p.car) this.moveToward(p.x, p.z, 3.5, dt, p.P.y); else this.speed = 0; this.fireAt(p, dt); }
      else { this.aim = want >= 2 ? 1 : 0; this.moveToward(p.x, p.z, 6, dt, p.P.y); }
    }
    fireAt(target, dt) {
      const wp = WEAPONS[this.weapon]; if (!wp) return;
      if(this.tacticalAmmo===undefined)this.tacticalAmmo=wp.clip||8;
      if(this.reloadT>0)return;if(this.tacticalAmmo<=0){this.reloadT=this.reloadDuration=1.8;this.say('Reloading!');return;}
      this.ammoT -= dt; if (this.ammoT > 0) return;
      this.ammoT = wp.rate * (this.isSwat ? 1.5 : 3.0) + W.rng() * 0.5;
      const tx = target.x, tz = target.z; const d = M.dist(this.x, this.z, tx, tz); const acc = (this.isSwat ? .035 : this.isCop ? .08 : .075)*(1+(this.suppression||0)*1.7);
      const ang = Math.atan2(tx - this.x, tz - this.z) + (W.rng() - 0.5) * acc * (1 + d / 35);
      PLAYER.fireBullet(this, this.x, this.z, this.y + 1.3, ang, wp, 0.7, null, Math.atan2((target.P ? target.P.y : target.y || 0) + 1.1 - (this.y + 1.3), Math.max(1, M.dist(this.x, this.z, target.x, target.z))));
      this.tacticalAmmo--;this.weaponOut = true; this.recoil = 0.12;
    }
    moveToward(tx, tz, speed, dt, targetY) {
      if(typeof STREETS!=='undefined' && targetY!==undefined && (Math.abs(targetY-this.y)>.8 || this.surfacePath?.length)) {
        this.pathT=(this.pathT||0)-dt;
        if(this.pathT<=0){this.surfacePath=STREETS.navigation(this,{x:tx,z:tz,y:targetY});this.pathT=2;}
        const path=this.surfacePath;
        while(path?.length && M.dist(this.x,this.z,path[0].x,path[0].z)<1 && Math.abs(this.y-(path[0].y??.15))<.75)path.shift();
        if(path?.length){tx=path[0].x;tz=path[0].z;}
      }
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
      const g = CITY.groundY(this.x, this.z, this.y);
      if (this.airborne) { if (this.y <= g) { this.y = g; this.airborne = false; this.vy = 0; if (this.state === 'dead') { this.vx *= 0.3; this.vz *= 0.3; } } } else this.y = g;
      const res = W.pushOut(this.x, this.z, 0.4,{y:this.y,height:1.8}); this.x = res.x; this.z = res.z;
      if (!ragdoll) for (const c of W.cars) { if (c.removed || this.y>=c.y+c.spec.hgt || this.y+1.7<=c.y || M.dist2(c.x, c.z, this.x, this.z) > 49) continue; for (let ci = 0, nci = c.circlesInto(CIRC); ci < nci; ci++) { const cx = CIRC[ci * 3], cz = CIRC[ci * 3 + 1], r = CIRC[ci * 3 + 2]; const dx = this.x - cx, dz = this.z - cz; const rr = r + 0.35; const d2 = dx * dx + dz * dz; if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); this.x = cx + dx / d * rr; this.z = cz + dz / d * rr; } } }
      if (!ragdoll) { this.vx = 0; this.vz = 0; this.phase += dt * M.TAU * cadence(this.speed); }
    }
    // ---- Rig
    heldEntity() { return heldEntity(this); }
    entity() { if (this.rag) { ragdollBones(this, this.rag); this.emis.fill(0); return { mesh: this.mesh, model: this.model, bones: this.bones, emis: this.emis }; }
      if (this.state === 'sit' && this.seat) { M.trs(seatWorld, this.seat.x, this.seat.y, this.seat.z, this.seat.a); buildRigSeated(this, this.model, this.bones, seatWorld, 0, 0, 0, 0, false, this.headYaw); this.emis.fill(0); return { mesh: this.mesh, model: this.model, bones: this.bones, emis: this.emis }; } buildRig(this, this.model, this.bones); this.emis.fill(0); const far = M.dist2(this.x, this.z, RENDER.cam.tx, RENDER.cam.tz) > 55 * 55; return { mesh: far && this.lodMesh ? this.lodMesh : this.mesh, model: this.model, bones: this.bones, emis: this.emis }; }
    remove() { this.removed = true; if (this.inCar) { if (this.inCar.driver === this) this.inCar.driver = null; } }
  }

  const tmp = M.create(), tmp2 = M.create();
  function bone(out, off, x, y, z, yaw, pitch, roll, s = 1) { M.trsEuler(tmp, x, y, z, yaw, pitch, roll, s, s, s); out.set(tmp, off); }
  // A child bone that bends about a joint given in its parent's space (knees and elbows).
  const jt1 = M.create(), jt2 = M.create(), jt3 = M.create();
  // The weapon in the right hand is a second entity riding the forearm bone: model * forearm * T(hand).
  const heldBones = new Float32Array(16 * RENDER.MAX_BONES); for (let i = 0; i < RENDER.MAX_BONES; i++) heldBones.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], i * 16); const heldEmis = new Float32Array(RENDER.MAX_BONES);
  const heldTmp = M.create(), heldHand = M.create();
  function heldEntity(p) { const armed = p.weapon && p.weapon !== 'fist' && p.weaponOut; const key = armed ? p.weapon : p.item; if (!key || p.inCar || p.rag || p.state === 'dead' || (p.state === 'sit' && !armed)) return null; const mesh = MESH.heldMesh(key); if (!mesh) return null;
    if (!p.heldModel) p.heldModel = M.create(); M.multiply(heldTmp, p.model, p.bones.subarray(160, 176)); M.trs(heldHand, MESH.HAND[0], MESH.HAND[1], MESH.HAND[2], 0); M.multiply(p.heldModel, heldTmp, heldHand); return { mesh, model: p.heldModel, bones: heldBones, emis: heldEmis }; }
  // Bone 11 carries the mouth: the head bone with a vertical stretch about the mouth's own position, so a talking ped's lips move.
  const mtmp1 = M.create(), mtmp2 = M.create(), mtmp3 = M.create();
  function mouthBone(out, open) { out.set(out.subarray(112,128),192); out.set(out.subarray(128,144),208); const [mx, my, mz] = MESH.MOUTH_POS; M.trs(mtmp1, mx, my, mz, 0, 1, 1 + open * 5, 1); M.trs(mtmp2, -mx, -my, -mz, 0); M.multiply(mtmp3, mtmp1, mtmp2); M.multiply(mtmp1, out.subarray(16, 32), mtmp3); out.set(mtmp1, 176); }
  // How far open the mouth is: shouting peds and the giver whose line is on screen move their lips
  function talkOpen(p) { const dlg = typeof MISSIONS !== 'undefined' && MISSIONS.dialogue; const talking = (p.shoutT || 0) > 0 || (dlg && dlg.focus === p && dlg.lines[dlg.i] && dlg.lines[dlg.i][0] === p.name); if (!talking) return 0; const t = W.state.elapsed + (p.bob || 0); return Math.max(0, Math.sin(t * 17) * 0.6 + Math.sin(t * 29) * 0.5); }
  function jointBone(out, off, parentOff, jx, jy, jz, pitch) { M.trsEuler(jt1, jx, jy, jz, 0, pitch, 0); M.trs(jt2, -jx, -jy, -jz, 0); M.multiply(jt3, jt1, jt2); M.multiply(jt1, out.subarray(parentOff, parentOff + 16), jt3); out.set(jt1, off); }
  function torsoChild(out, off, x, y, yaw, pitch, roll, anchorX = 0) {
    M.trsEuler(jt1,x,y,0,yaw,pitch,roll); M.trs(jt2,-anchorX,0,0,0);
    M.multiply(jt3,jt1,jt2); M.multiply(jt1,out.subarray(0,16),jt3); out.set(jt1,off);
  }
  const KNEE_Y = -LEG_H * 0.5, ELBOW_Y = -0.31;
  // Stride frequency in full cycles (two steps) per second. Cadence grows with the square root of speed and the
  // stride length does the rest, so a stroll is ~2 steps/s, the default jog ~3 and a flat-out sprint ~3.7.
  // Pedestrians and the player advance their phase at this rate and buildRig derives the stride from it, so a
  // planted foot moves backwards at exactly ground speed and never slides.
  function cadence(spd) { return spd > 0.05 ? 0.55 + 0.5 * Math.sqrt(spd) : 0; }
  // Gait shape for a speed: jog/sprint blends and the fraction of the cycle each foot is on the ground. Walking
  // has double support (stance > .5); running has a flight phase (stance < .5), shorter the faster you go.
  function gait(spd) { const r = M.clamp((spd - 2) / 1.4, 0, 1), s = M.clamp((spd - 3.4) / 3.4, 0, 1); return { r, s, stance: 0.62 - 0.26 * r - 0.1 * s }; }
  const smooth = x => x * x * (3 - 2 * x);
  // Animates the rig from the ped's state. Also used by the player. Everything keys off each foot's place in its
  // cycle (0 = that foot strikes the ground): the feet are placed by IK, the arms swing against the legs (left arm
  // back as the left foot lands), the shoulders counter-rotate the hips, and the pelvis vaults over a planted leg
  // at a walk but sinks into it at a run. Lateral sway is kept small; a big hip roll reads as dancing.
  const RELOAD_POSES=[[0,-.4,-1.5,-.05,0],[.18,-.7,-1.1,-.7,-.35],[.40,-.2,-.85,-1.6,-.75],[.62,-1.0,-.95,-1.1,-.65],[.83,-.7,-1.35,-.4,-.15],[1,-.4,-1.5,-.05,0]];
  function samplePose(keys,t) { let i=0;while(i<keys.length-2&&keys[i+1][0]<t)i++;const a=keys[i],b=keys[i+1],u=smooth(M.clamp((t-a[0])/(b[0]-a[0]),0,1));return a.slice(1).map((v,k)=>M.lerp(v,b[k+1],u)); }
  function buildRig(p, model, bones) {
    const lying = p.lying || 0; const dead = p.state === 'dead';
    const spd = Math.max(p.speed || 0, Math.min(.65,(p.turnStep||0)*.10)); const walk = Math.min(1, spd / 1.2); const G = gait(spd), r = G.r * walk, s = G.s, stance = G.stance;
    const direction = p.aim && spd > .1 ? M.angleTo(p.angle, Math.atan2(p.vx || 0, p.vz || 0)) : 0;
    const ph = p.phase * (Math.cos(direction) < -.2 ? -1 : 1); const cycleL = ((ph / M.TAU) % 1 + 1) % 1;
    const fL = Math.cos(M.TAU * (cycleL + 0.02)) * walk; // +1: left foot forward, left arm back
    const swing = fL * (0.45 + 0.3 * r); // thigh swing for the non-IK poses (kicks, falls)
    const q = (2 * cycleL) % 1; // phase within the current step: a foot lands at q = 0
    const bob = Math.cos(M.TAU * (q - stance)) * (0.022 * (1 - r) - (0.03 + 0.015 * s) * r) * walk; // walk: up over the planted leg; run: down into it, up in flight
    const lat = Math.cos(M.TAU * (cycleL - stance / 2)) * walk * (1 - 0.6 * r); // +1: weight over the left foot
    const aim = p.aim || 0; const punch = p.punchT > 0 ? Math.sin(Math.min(1, p.punchT / 0.3) * Math.PI) : 0;
    const t = W.state.elapsed + (p.phase % 7); const idle = 1 - walk; const breath = Math.sin(t * 1.6) * idle;
    const speaking = talkOpen(p);
    const gesture = !aim && !p.weaponOut && !p.item && !walk ? Math.max(
      p.gesturePulse > 0 ? Math.sin(Math.PI*Math.min(1,p.gesturePulse/1.25)) : 0,
      speaking > 0 ? Math.max(0,Math.sin(t*2.1))*.55 : 0) : 0;
    const hip = LEG_H - (p.entryPose||0)*.3 - (p.vaultPose||0)*.2 - (.075 + .06 * r + .03 * s) * walk + bob - lying * (LEG_H - .25) - (p.landing||0)*.09 - (p.crouch||0)*.43 - (p.evadeT>0?.12:0); // knees stay soft when moving, more so at a run
    const flinch = p.flinchT > 0 ? Math.sin(Math.min(1, p.flinchT / 0.35) * Math.PI) : 0; const kick = p.kickT > 0 ? Math.sin(Math.min(1, p.kickT / 0.35) * Math.PI) : 0;
    const lean = (p.entryPose||0)*.8 + (p.exitPose?Math.sin(Math.PI*M.clamp(p.exitPose.t/.65,0,1))*.65:0) + (p.vaultPose||0)*.5 + (p.accelLean||0) + (p.crouch||0)*.22 + (p.brace||0)*.14 + (p.evadeT>0?.22:0) + 0.03 * walk + 0.1 * r + 0.1 * s + (p.recoil || 0) * -0.5 - flinch * 0.35 + kick * 0.15;
    const twist = fL * (0.07 + 0.05 * r) * (1 - aim); // shoulders turn against the stepping leg
    const px = lat * 0.015;
    const exit=p.exitPose,u=exit?1-M.clamp(exit.t/.65,0,1):1,ease=u*u*(3-2*u);
    M.trsEuler(model, exit?M.lerp(exit.from[0],p.x,ease):p.x,exit?M.lerp(exit.from[1],p.y,ease):p.y,exit?M.lerp(exit.from[2],p.z,ease):p.z, p.angle, lying * (dead ? -Math.PI / 2 * p.fallDir : -Math.PI / 2), 0, p.sx || 1, p.sy || 1, p.sx || 1);
    // torso: lean, counter-twist, a touch of hip sway; breathing when standing
    bone(bones, 0, px, hip + breath * 0.006, 0, twist + Math.sin(t * 0.7) * 0.02 * idle, lean+(p.landing||0)*.06, lat * 0.02 + breath * 0.008 + (p.turnLean||0));
    // head: rides on the torso and cancels the twist so it keeps looking where the ped goes
    torsoChild(bones,16,0,TORSO_H+.03,(aim ? 0 : (p.headYaw||0))-twist*.9,-lean*.7+(aim?0:Math.sin(t*.9)*.02*idle)+speaking*.018,-lat*.02);
    // upper arms: pivot at the shoulders and swing opposite the legs; at a run they swing from behind the body
    const hold = !aim && p.item && (p.item === 'umbrella' || p.item === 'phone') ? p.item : null;
    const reloadU=p.reloadT>0?1-p.reloadT/p.reloadDuration:0;
    const pose=samplePose(RELOAD_POSES,reloadU), reloading=p.reloadT>0?1:0;
    const reaching=p.state==='entering'?Math.sin(Math.min(1,(p.doorReach||0)/.32)*Math.PI*.7):0;
    const armBias = (0.04 + 0.1 * r + 0.04 * s) * walk, armAmp = 0.28 + 0.3 * r + 0.3 * s;
    const armPitchL = (reloading ? pose[0] : aim ? -0.4 : armBias + armAmp * fL) - flinch * 1.1 - kick * 0.5, armPitchR = hold === 'umbrella' ? -2.1 : hold === 'phone' ? -2.3 : (reloading ? pose[1] : aim ? -Math.PI / 2 + 0.05 + (p.camPitch || 0) + (p.recoil || 0) * 2 : armBias - armAmp * fL - punch * 1.4) - flinch * 0.9 + kick * 0.6;
    const armRoll = 0.07 + 0.05 * r + Math.sin(t * 1.1) * 0.015 * idle;
    torsoChild(bones,32,.26,SHOULDER,gesture*.2,armPitchL-gesture*.35-(p.vaultPose||0)*1.1,armRoll+(aim?.12:0)+gesture*.16,.26);
    torsoChild(bones,48,-.26,SHOULDER,aim?-.15:0,armPitchR-reaching*1.2-(p.vaultPose||0)*1.3,-armRoll,-.26);
    // forearms: soft at a walk, folding a little as the arm comes forward; about a right angle at a run
    const elbowBase = 0.16 + 1.1 * r + 0.1 * s, elbowSwing = 0.22 + 0.2 * r;
    const elbowL = reloading ? pose[2] : aim ? -0.05 : -(elbowBase + elbowSwing * Math.max(0, -fL));
    const elbowR = reloading ? pose[3] : hold === 'phone' ? -2.3 : hold === 'umbrella' ? -0.3 : aim ? 0 : -(elbowBase + elbowSwing * Math.max(0, fL) + punch * 0.6);
    jointBone(bones, 144, 32, 0.26, ELBOW_Y, 0, elbowL-gesture*.95); jointBone(bones, 160, 48, -0.26, ELBOW_Y, 0, elbowR);
    // thighs for the poses the IK doesn't handle (airborne, kicking, falling)
    bone(bones, 64, px, hip, 0, 0, p.airborne ? -.45 : -swing * .95 * Math.abs(Math.cos(direction)) + kick * .3, swing * Math.sin(direction) * .65); bone(bones, 80, px, hip, 0, 0, p.airborne ? .25 : swing * .95 * Math.abs(Math.cos(direction)) - kick * 1.5, -swing * Math.sin(direction) * .65); // a kick swings the right leg up
    const kneeL = (0.08 + 0.75 * Math.max(0, -fL)) * walk + 0.04 * idle;
    const kneeR = (0.08 + 0.75 * Math.max(0, fL)) * walk + 0.04 * idle;
    jointBone(bones, 112, 64, 0.11, KNEE_Y, 0, dead ? 0 : kneeL+(p.vaultPose||0)*1.3); jointBone(bones, 128, 80, -0.11, KNEE_Y, 0, dead ? 0 : kneeR+(p.vaultPose||0)*1.0);
    // weapon: follows the right forearm, hidden when unarmed
    if (p.weaponOut && !dead) bones.set(bones.subarray(160, 176), 96); else bone(bones, 96, 0, -100, 0, 0, 0, 0, 0.001);
    mouthBone(bones, speaking);
    if (!p.airborne && !lying && !kick) {
      // The toe follows a path: planted and sliding back at ground speed through the stance, then lifted and
      // carried forward, still drifting back as it leaves and reaching back as it lands so it meets the ground softly. Late in the stance the heel peels up and the foot rolls over the toe; it flattens again
      // through the swing. Two-link IK bends the knee to reach the resulting ankle position.
      const stride = spd > 0.05 ? spd / cadence(spd) : 0, contact = stride * stance;
      const front = contact * (0.5 - 0.12 * r), back = contact - front;
      const peel = 0.62 + 0.08 * r, roll = (0.45 + 0.25 * r) * walk, lift = (0.09 + 0.12 * r + 0.14 * s) * walk;
      for (const [off,shin,foot,sx,cycle] of [[64,112,192,.11,cycleL],[80,128,208,-.11,(cycleL+.5)%1]]) {
        let z, y = 0, toe = 0;
        if (cycle < stance) { const c = cycle / stance; z = front - contact * c; toe = roll * smooth(M.clamp((c - peel) / (1 - peel), 0, 1)); }
        else { const w = (cycle - stance) / (1 - stance); z = -back + contact * smooth(w) - contact * Math.min(1.2, 0.5 * (1 - stance) / stance) * w * (1 - w) * (1 - 2 * w); y = lift * Math.sin(Math.PI * Math.pow(w, 0.8 - 0.25 * r)); toe = roll * (1 - smooth(M.clamp(w / 0.55, 0, 1))); }
        const ay = y + .06 * Math.cos(toe) + .15 * Math.sin(toe), az = z + .15 + .06 * Math.sin(toe) - .15 * Math.cos(toe); // ankle, from the toe and the foot's roll
        const targetY = ay - hip, targetZ = az * Math.cos(direction);
        const l1=.425,l2=.375,dist=M.clamp(Math.hypot(targetY,targetZ),.1,l1+l2-.001);
        const knee=Math.acos(M.clamp((dist*dist-l1*l1-l2*l2)/(2*l1*l2),-1,1));
        const pitch=Math.atan2(-targetZ,-targetY)-Math.atan2(l2*Math.sin(knee),l1+l2*Math.cos(knee));
        bone(bones,off,px,hip,0,0,pitch,-az*Math.sin(direction)*.6);
        jointBone(bones,shin,off,sx,KNEE_Y,0,knee);
        jointBone(bones,foot,shin,sx,-.8,0,-pitch-knee+toe);
      }
    }
  }

  // Seated pose inside a car (or on a bench): hips at the seat, thighs forward, shins down, hands on the wheel.
  const seatTmp = M.create(), seatLocal = M.create(), seatWorld = M.create();
  function buildRigSeated(p, model, bones, carModel, lx, ly, lz, yaw, driving, headYaw = 0, fit = 1, bike = false) {
    M.trs(seatLocal, lx, ly, lz, yaw, (p.sx || 1) * fit, (p.sy || 1) * fit, (p.sx || 1) * fit); M.multiply(model, carModel, seatLocal);
    if (bike) { // astride: torso forward over the tank, arms out to the bars, knees bent down to the pegs
      const hip = 0.02, lean = 0.32; bone(bones, 0, 0, hip, 0, 0, lean, 0); torsoChild(bones,16,0,TORSO_H+.03,headYaw,-.35,0);
      torsoChild(bones,32,.26,SHOULDER,.35,-1.05,.2,.26); torsoChild(bones,48,-.26,SHOULDER,-.35,-1.05,-.2,-.26); jointBone(bones, 144, 32, 0.26, ELBOW_Y, 0, -0.45); jointBone(bones, 160, 48, -0.26, ELBOW_Y, 0, -0.45);
      bone(bones, 64, 0, hip, 0, 0, -0.95, 0.28); bone(bones, 80, 0, hip, 0, 0, -0.95, -0.28); jointBone(bones, 112, 64, 0.11, KNEE_Y, 0, 1.45); jointBone(bones, 128, 80, -0.11, KNEE_Y, 0, 1.45);
      bone(bones, 96, 0, -100, 0, 0, 0, 0, 0.001); mouthBone(bones, talkOpen(p)); return; }
    const hip = 0.02; const lean = driving ? 0.12 : 0.05;
    bone(bones, 0, 0, hip, 0, 0, lean, 0);
    torsoChild(bones,16,0,TORSO_H+.03,headYaw,-lean*.7,0);
    const armP = driving ? -0.9 : -0.35; torsoChild(bones,32,.26,SHOULDER,driving?.25:0,armP,driving?.15:.05,.26); torsoChild(bones,48,-.26,SHOULDER,driving?-.25:0,armP,driving?-.15:-.05,-.26);
    jointBone(bones, 144, 32, 0.26, ELBOW_Y, 0, driving ? -0.7 : -0.5); jointBone(bones, 160, 48, -0.26, ELBOW_Y, 0, driving ? -0.7 : -0.5);
    bone(bones, 64, 0, hip, 0, 0, -Math.PI / 2 + 0.15, 0); bone(bones, 80, 0, hip, 0, 0, -Math.PI / 2 + 0.15, 0);
    jointBone(bones, 112, 64, 0.11, KNEE_Y, 0, Math.PI / 2 - 0.35); jointBone(bones, 128, 80, -0.11, KNEE_Y, 0, Math.PI / 2 - 0.35);
    bone(bones, 96, 0, -100, 0, 0, 0, 0, 0.001);
    mouthBone(bones, talkOpen(p));
  }
  // ---- Ragdoll: sixteen verlet joints with bone-length and bracing constraints, ground contact and building push-out.
  // Bones are refitted to the joint pairs every frame, using the shoulders as a twist reference so nothing spins on its axis.
  const RJ = { pelvis: 0, chest: 1, neck: 2, head: 3, shL: 4, shR: 5, elL: 6, elR: 7, haL: 8, haR: 9, hipL: 10, hipR: 11, knL: 12, knR: 13, ftL: 14, ftR: 15 };
  const RAG_REST = [[0, 0, 0], [0, 0.55, 0], [0, 0.68, 0], [0, 0.9, 0], [0.26, 0.6, 0], [-0.26, 0.6, 0], [0.26, 0.29, 0], [-0.26, 0.29, 0], [0.26, -0.02, 0], [-0.26, -0.02, 0], [0.11, 0, 0], [-0.11, 0, 0], [0.11, -0.425, 0], [-0.11, -0.425, 0], [0.11, -0.8, 0.05], [-0.11, -0.8, 0.05]]; // relative to the pelvis
  const RAG_LINKS = [[0, 1], [1, 2], [2, 3], [1, 4], [1, 5], [4, 5], [4, 6], [5, 7], [6, 8], [7, 9], [0, 10], [0, 11], [10, 11], [10, 12], [11, 13], [12, 14], [13, 15],
    [0, 4], [0, 5], [10, 1], [11, 1], [4, 2], [5, 2], [10, 5], [11, 4], [0, 2]].map(([a, b]) => [a, b, M.dist(RAG_REST[a][0], RAG_REST[a][1], RAG_REST[b][0], RAG_REST[b][1]) ** 2 + (RAG_REST[a][2] - RAG_REST[b][2]) ** 2].map((v, i) => i === 2 ? Math.sqrt(v) : v));
  function makeRagdoll(p, vx, vy, vz) {
    const ca = Math.cos(p.angle), sa = Math.sin(p.angle); const hip = p.y + LEG_H * (1 - (p.lying || 0) * 0.7); const pts = [];
    for (const [lx, ly, lz] of RAG_REST) { const wx = lx * ca + lz * sa, wz = -lx * sa + lz * ca; pts.push({ x: p.x + wx, y: hip + ly, z: p.z + wz, px: 0, py: 0, pz: 0 }); }
    const rag = { pts, sleep: 0, t: 0 }; for (const q of pts) { q.px = q.x; q.py = q.y; q.pz = q.z; }
    ragImpulse(rag, vx + (p.vx || 0) * 0.5, vy, vz + (p.vz || 0) * 0.5); return rag;
  }
  function ragImpulse(rag, vx, vy, vz) { const h = 1 / 60; rag.pts.forEach((q, i) => { const up = RAG_REST[i][1]; const k = 0.7 + Math.max(0, up) * 0.9; /* upper body carries more of the hit, so the body tumbles */ q.px = q.x - vx * k * h; q.py = q.y - vy * k * h; q.pz = q.z - vz * k * h; }); rag.sleep = 0; }
  function stepRagdoll(p, dt) {
    const rag = p.rag; rag.t += dt; if (rag.sleep > 0.6) { return; } const h = Math.min(dt, 1 / 30); let motion = 0;
    for (const q of rag.pts) { const vx = (q.x - q.px) * 0.985, vy = (q.y - q.py) * 0.985, vz = (q.z - q.pz) * 0.985; q.px = q.x; q.py = q.y; q.pz = q.z; q.x += vx; q.y += vy - 22 * h * h; q.z += vz; motion += Math.abs(vx) + Math.abs(vy) + Math.abs(vz); }
    for (let it = 0; it < 4; it++) {
      for (const [a, b, len] of RAG_LINKS) { const A = rag.pts[a], B = rag.pts[b]; let dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z; const d = Math.hypot(dx, dy, dz) || 1e-4; const k = (d - len) / d * 0.5; dx *= k; dy *= k; dz *= k; A.x += dx; A.y += dy; A.z += dz; B.x -= dx; B.y -= dy; B.z -= dz; }
      for (const q of rag.pts) { const g = CITY.groundY(q.x, q.z,q.y) + 0.1; if (q.y < g) { q.y = g; q.px += (q.x - q.px) * 0.55; q.pz += (q.z - q.pz) * 0.55; /* friction */ } const res = W.pushOut(q.x, q.z, 0.12, { noProps: true,y:q.y,height:.2 }); if (res.hit) { q.x = res.x; q.z = res.z; } }
    }
    const pv = rag.pts[RJ.pelvis]; p.x = pv.x; p.z = pv.z; p.y = CITY.groundY(p.x, p.z); p.vx = (pv.x - pv.px) / h; p.vz = (pv.z - pv.pz) / h; p.airborne = pv.y > p.y + 0.35;
    const fwd = rag.pts[RJ.chest]; p.angle = Math.atan2(fwd.x - pv.x, fwd.z - pv.z) || p.angle;
    if (motion / rag.pts.length < 0.0025 * (h * 60)) rag.sleep += dt; else rag.sleep = 0;
  }
  function endRagdoll(p) { const pv = p.rag.pts[RJ.pelvis], ch = p.rag.pts[RJ.chest]; p.angle = Math.atan2(ch.x - pv.x, ch.z - pv.z); p.rag = null; p.airborne = false; p.vy = 0; p.y = CITY.groundY(p.x, p.z); M.identity(p.model); }
  // Fit a bone so that its local anchor sits on joint A and its local "down" axis points at joint B; the given right vector fixes the twist.
  const rb = M.create();
  function fitBone(bones, off, A, B, ax, ay, az, rx, ry, rz, flipY, sc) {
    let yx = B.x - A.x, yy = B.y - A.y, yz = B.z - A.z; let l = Math.hypot(yx, yy, yz) || 1; yx /= l; yy /= l; yz /= l; if (flipY) { yx = -yx; yy = -yy; yz = -yz; }
    let d = rx * yx + ry * yy + rz * yz; let xx = rx - yx * d, xy = ry - yy * d, xz = rz - yz * d; l = Math.hypot(xx, xy, xz); if (l < 1e-4) { xx = yz; xy = 0; xz = -yx; l = Math.hypot(xx, xy, xz) || 1; } xx /= l; xy /= l; xz /= l;
    const zx = xy * yz - xz * yy, zy = xz * yx - xx * yz, zz = xx * yy - xy * yx;
    rb[0] = xx * sc; rb[1] = xy * sc; rb[2] = xz * sc; rb[3] = 0; rb[4] = yx * sc; rb[5] = yy * sc; rb[6] = yz * sc; rb[7] = 0; rb[8] = zx * sc; rb[9] = zy * sc; rb[10] = zz * sc; rb[11] = 0;
    rb[12] = A.x - (rb[0] * ax + rb[4] * ay + rb[8] * az); rb[13] = A.y - (rb[1] * ax + rb[5] * ay + rb[9] * az); rb[14] = A.z - (rb[2] * ax + rb[6] * ay + rb[10] * az); rb[15] = 1;
    bones.set(rb, off);
  }
  function ragdollBones(p, rag) {
    const P = rag.pts; M.identity(p.model); const sc = p.sx || 1;
    const shL = P[RJ.shL], shR = P[RJ.shR]; let rx = shL.x - shR.x, ry = shL.y - shR.y, rz = shL.z - shR.z; const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
    fitBone(p.bones, 0, P[RJ.pelvis], P[RJ.chest], 0, 0, 0, rx, ry, rz, false, sc);
    fitBone(p.bones, 16, P[RJ.neck], P[RJ.head], 0, 0, 0, rx, ry, rz, false, sc);
    fitBone(p.bones, 32, shL, P[RJ.elL], 0.26, 0, 0, rx, ry, rz, true, sc); fitBone(p.bones, 48, shR, P[RJ.elR], -0.26, 0, 0, rx, ry, rz, true, sc);
    fitBone(p.bones, 144, P[RJ.elL], P[RJ.haL], 0.26, -0.31, 0, rx, ry, rz, true, sc); fitBone(p.bones, 160, P[RJ.elR], P[RJ.haR], -0.26, -0.31, 0, rx, ry, rz, true, sc);
    fitBone(p.bones, 64, P[RJ.hipL], P[RJ.knL], 0.11, 0, 0, rx, ry, rz, true, sc); fitBone(p.bones, 80, P[RJ.hipR], P[RJ.knR], -0.11, 0, 0, rx, ry, rz, true, sc);
    fitBone(p.bones, 112, P[RJ.knL], P[RJ.ftL], 0.11, -0.425, 0, rx, ry, rz, true, sc); fitBone(p.bones, 128, P[RJ.knR], P[RJ.ftR], -0.11, -0.425, 0, rx, ry, rz, true, sc);
    bone(p.bones, 96, 0, -100, 0, 0, 0, 0, 0.001);
    mouthBone(p.bones, 0);
  }
  // Seat positions in car-local space: driver on the left (+x), passenger right, rear seats behind.
  function seatOf(car, index) {
    const s = car.spec; const L = s.len, W = s.wid;
    const seatY = MESH.seatHeight(s);
    if (s.bike) return [0, seatY, s.seatZ !== undefined ? s.seatZ : -0.3];
    if (s.boat) return [index === 0 ? -0.5 : 0.5, seatY, -0.85];
    if (s.bus) return [index === 0 ? W * 0.25 : -W * 0.25, seatY, L / 2 - 1.2 - Math.floor(index / 2) * 1.2];
    if (s.box) return [index === 0 ? W * 0.22 : -W * 0.22, seatY, L / 2 - L * 0.3 * 0.55];
    if (s.armor || s.hgt > 2.0) return [index % 2 === 0 ? W * 0.22 : -W * 0.22, seatY, L / 2 - 1.5 - Math.floor(index / 2) * 1.0];
    const half = L / 2; const c0 = half - s.cabin[0] * L - s.hood * 0.5, c1 = half - s.cabin[1] * L - s.hood * 0.5; const seatZ = (c0 + c1) / 2 - 0.1;
    const row = Math.floor(index / 2), side = index % 2 === 0 ? 1 : -1; return [side * W * 0.21, seatY, seatZ - row * 0.9];
  }
  function seatedEntity(p, car, index, driving) { const [lx, ly, lz] = seatOf(car, index); buildRigSeated(p, p.model, p.bones, car.model, lx, ly, lz, 0, driving, 0, MESH.seatFit(car.spec).scale, !!car.spec.bike); p.emis.fill(0); return { mesh: p.mesh, model: p.model, bones: p.bones, emis: p.emis }; }

  // ---- Spawning
  function spawn(x, z, opts = {}) { const look = opts.look || looks[Math.floor(W.rng() * looks.length)]; const p = new Ped(look, x, z, opts); W.peds.push(p); return p; }
  function spawnDriver(car) { const p = new Ped(looks[Math.floor(W.rng() * looks.length)], car.x, car.z, {}); p.inCar = car; p.state = 'driving'; W.peds.push(p); return p; }
  function spawnCop(x, z, opts = {}) { const swat = !!opts.swat; const p = spawn(x, z, { look: swat ? SWAT : COP, cop: true, swat, weapon: opts.weapon || (swat ? 'rifle' : 'pistol'), health: swat ? 120 : 70 }); p.weaponOut = true; p.state = 'walk'; return p; }
  // When the streets should be emptier than they are (night falls, the rush ends), send the farthest unseen peds home.
  function trim(px, pz, camYaw, want) {
    let count = 0; for (const p of W.peds) if (!p.removed && !p.inCar && !p.isCop && !p.important) count++;
    if (count <= want + 3) return; let best = null, bd = 0;
    for (const p of W.peds) { if (p.removed || p.inCar || p.isCop || p.important || p.state === 'dead') continue; const d = M.dist(p.x, p.z, px, pz); if (d < 45) continue; const ang = Math.atan2(p.x - px, p.z - pz); if (d < 120 && Math.abs(M.angleTo(camYaw, ang)) < 1.0) continue; if (d > bd) { bd = d; best = p; } }
    if (best) best.remove();
  }
  function populate(px, pz, camYaw, want) {
    let count = 0; for (const p of W.peds) if (!p.removed && !p.inCar && !p.isCop && !p.important) count++;
    if (count >= want) return;
    const r = W.rng();
    if (r < 0.06) { // a vendor behind an unattended cart
      for (const ct of CITY.props.hotdogCart) { if (ct.taken) continue; const d = M.dist(ct.x, ct.z, px, pz); if (d < 25 || d > 130) continue; const p = spawn(ct.x - Math.sin(ct.a) * 1.1, ct.z - Math.cos(ct.a) * 1.1, { look: VENDOR }); p.state = 'stand'; p.wanderT = 1e9; p.angle = ct.a; p.vendor = true; ct.taken = true; p.onRemove = () => { ct.taken = false; }; return; } }
    if (r < 0.14) { // waiting for a bus
      for (let tries = 0; tries < 6; tries++) { const sh = CITY.props.busShelter[Math.floor(W.rng() * CITY.props.busShelter.length)]; if (!sh) continue; const d = M.dist(sh.x, sh.z, px, pz); if (d < 30 || d > 130) continue; const nq = 1 + Math.floor(W.rng() * 2); for (let k = 0; k < nq; k++) { const p = spawn(sh.x + (k - 0.5) * 1.4 + (W.rng() - 0.5) * 0.4, sh.z - 0.6, {}); dress(p, sh.x, sh.z); p.state = 'stand'; p.wanderT = 20 + W.rng() * 40; p.angle = sh.a + Math.PI + (W.rng() - 0.5) * 0.6; if (W.rng() < 0.5) p.item = 'phone'; } return; } }
    if (r < 0.26) { // someone on a bench
      for (let tries = 0; tries < 6; tries++) { const bn = CITY.props.bench[Math.floor(W.rng() * CITY.props.bench.length)]; if (!bn || bn.taken) continue; const d = M.dist(bn.x, bn.z, px, pz); if (d < 30 || d > 120) continue;
        const a = bn.a || 0; const side = W.rng() < 0.5 ? 0.45 : -0.45; const p = spawn(bn.x + Math.cos(a) * side, bn.z - Math.sin(a) * side, {}); p.state = 'sit'; p.seat = { x: p.x, y: CITY.groundY(bn.x, bn.z) + 0.46, z: p.z, a: a }; p.angle = a; bn.taken = true; p.onRemove = () => { bn.taken = false; }; return; }
    }
    for (let tries = 0; tries < 8; tries++) {
      const n = CITY.walkNodes[Math.floor(W.rng() * CITY.walkNodes.length)]; const d = M.dist(n.x, n.z, px, pz); if (d < 28 || d > 130) continue;
      const ang = Math.atan2(n.x - px, n.z - pz); if (d < 48 && Math.abs(M.angleTo(camYaw, ang)) < 0.8 && W.los(px, pz, n.x, n.z)) continue; // in front of the camera is fine if a building hides the spot
      if (r > 0.82) { // two people talking
        const a = spawn(n.x + 0.5, n.z, { node: n }), b2 = spawn(n.x - 0.5, n.z, { node: n }); a.state = b2.state = 'chat'; a.partner = b2; b2.partner = a; a.angle = -Math.PI / 2; b2.angle = Math.PI / 2; a.gestureT = W.rng() * 3; b2.gestureT = W.rng() * 3; return;
      }
      const p = spawn(n.x + (W.rng() - 0.5), n.z + (W.rng() - 0.5), { node: n }); dress(p, n.x, n.z);
      if (CITY.district(CITY.blockAt(n.x, n.z)?.i ?? 0, CITY.blockAt(n.x, n.z)?.j ?? 0) === 'eastside' && W.rng() < 0.25) { p.look = GANG; p.mesh = getMesh(GANG); p.lodMesh = getMesh(GANG, true); p.isGang = true; p.weapon = W.rng() < 0.5 ? 'pistol' : null; p.health = 80; }
      return;
    }
  }
  // what a ped wears and carries depends on the district and the weather
  function dress(p, x, z) { const bl = CITY.blockAt(x, z); const d = bl ? CITY.district(bl.i, bl.j) : 'southport'; const pool = WARDROBE[d];
    if (pool && W.rng() < (d === 'downtown' ? 0.45 : 0.3)) { p.look = pool[Math.floor(W.rng() * pool.length)]; p.mesh = getMesh(p.look); p.lodMesh = getMesh(p.look, true); if (d === 'westfield' && W.rng() < 0.5) { p.walkSpeed = 3.6 + W.rng(); p.jog = true; } }
    const rain = W.weather ? W.weather.rain : 0; const r = W.rng();
    if (rain > 0.3 && r < 0.45) p.item = 'umbrella'; else if (r < 0.12) p.item = 'coffee'; else if (r < 0.2) p.item = 'bag'; else if (r < 0.3 && !p.jog) p.item = 'phone'; else if (r < 0.32) p.item = 'guitar';
    if (W.rng() < 0.1 && !p.jog) { p.state = 'stand'; p.wanderT = 5 + W.rng() * 10; const lot = CITY.lotsNear(x, z, 6).find(l => l.kind !== 'wall'); if (lot) p.angle = Math.atan2(M.clamp(x, lot.x0, lot.x1) - x, M.clamp(z, lot.z0, lot.z1) - z); } // a look in a shop window
  }
  function despawn(px, pz) { let w = 0; for (const p of W.peds) { if (!p.removed && !p.important) { const d = M.dist(p.x, p.z, px, pz); if ((d > 170 && !p.inCar) || (p.state === 'dead' && (p.deadT > 25 || (d > 60 && p.deadT > 6)))) p.removed = true; } if (p.removed && p.onRemove) { p.onRemove(); p.onRemove = null; } if (!p.removed) W.peds[w++] = p; } W.peds.length = w; }
  // People far from the camera run at a third of the rate, on the same frame as each other.
  const FAR2 = 62 * 62;
  function updateAll(dt) {
    const cam = RENDER.cam; const cx = cam.tx, cz = cam.tz; const phase = W.state.frame % 3;
    for (const p of W.peds) {
      if (p.removed || p.inCar || p.important || p.isCop || p.state === 'dead' || p.rag) { p.update(dt); continue; }
      const dx = p.x - cx, dz = p.z - cz;
      if (dx * dx + dz * dz > FAR2) { if (phase === 1) p.update(dt * 3); } else p.update(dt);
    }
  }
  return { Ped, heldEntity, spawn, spawnDriver, spawnCop, populate, trim, despawn, updateAll, buildRig, buildRigSeated, cadence, gait, seatOf, seatedEntity, getMesh, makeRagdoll, stepRagdoll, ragdollBones, endRagdoll, looks, COP, SWAT, GANG, PLAYER_LOOK, MARLA, DEBTOR, OKAFOR, CRANE };
})();
