// GRIFT CITY — vehicles: arcade physics, collisions, damage, and the driving AI (traffic, chase, flee).
'use strict';
const VEH = (() => {
  const SPECS = MESH.VEHICLES;
  const NAMES = { sedan: 'MERIDIAN', sports: 'FALCATA', hatch: 'GNAT', pickup: 'MULE', van: 'BOXER', taxi: 'CABCO', police: 'ENFORCER', truck: 'HAULER', bus: 'TRANSIT', muscle: 'BRAWLER', swat: 'BASTION', bike: 'VIPER', boat: 'SKIMMER', ktruck: 'RANCHER', kmoto: 'HORNET', kgarbage: 'SANITATION', kambulance: 'MEDIVAC', kfire: 'FIREBRAND' };
  const PALETTE = [[0.696,0.185,0.171],[0.154,0.224,0.49],[0.919,0.919,0.905],[0.151,0.151,0.165],[0.621,0.621,0.649],[0.172,0.438,0.277],[0.82,0.61,0.274],[0.394,0.163,0.429],[0.62,0.375,0.235],[0.288,0.568,0.638],[0.447,0.097,0.132],[0.741,0.741,0.566],[0.249,0.424,0.354],[0.841,0.841,0.666],[0.286,0.216,0.356],[0.781,0.396,0.326],[0.639,0.254,0.359],[0.564,0.599,0.669],[0.187,0.292,0.397],[0.739,0.564,0.389],[0.352,0.352,0.387],[0.927,0.857,0.822]]; // desaturated a third toward grey: a street of cars is mostly muted
  const FIXED = { taxi: [1, 0.8, 0.1], police: [0.95, 0.95, 0.98], swat: [0.16, 0.18, 0.22], bus: [0.85, 0.55, 0.15] };
  const meshCache = {};
  function colorOf(type, colIdx) { if (colIdx === 'wreck') return [0.07, 0.07, 0.07];
    const c = FIXED[type] || PALETTE[colIdx], l = c[0] * .3 + c[1] * .59 + c[2] * .11;
    return c.map(v => (v * .72 + l * .28) * .88 + .035); }
  function getMesh(type, colIdx) { const key = type + ':' + colIdx; if (!meshCache[key]) { const m = MESH.carMesh(type, colorOf(type, colIdx)); meshCache[key] = { body: m.body.build(), glass: m.glass.build() }; } return meshCache[key]; }
  const lodCache = {}; function getLod(type, colIdx) { const key = type + ':' + colIdx; if (!lodCache[key]) { const m = MESH.carMesh(type, colorOf(type, colIdx), { lod: true }); lodCache[key] = { body: m.body.build(), glass: m.glass.build() }; } return lodCache[key]; }
  function dentedMesh(type, colIdx, dent, seed, condition) { const m = MESH.carMesh(type, colorOf(type, colIdx), { dent, seed,condition }); return { body: m.body.build(), glass: m.glass.build() }; }
  const TRAFFIC_TYPES = ['sedan', 'sedan', 'sedan', 'hatch', 'hatch', 'sports', 'pickup', 'van', 'taxi', 'taxi', 'muscle', 'truck', 'bus', 'ktruck', 'kmoto', 'kgarbage', 'kambulance', 'kfire'];

  const tmpV = [0, 0, 0]; const CIRC_A = new Float64Array(9), CIRC_B = new Float64Array(9); /* scratch for circlesInto */ const TURN_R = 10; // radius of the arc traffic drives through a corner (m); long vehicles need more
  const LEAN_SIGN = -1; // positive roll tips the body to the right, so leaning into a left turn (positive yaw) is negative
  const HANDLING={sedan:{response:5.2,steer:.60,front:.48,rear:.52,stiffF:.13,stiffR:.095,inertia:.30,damping:1.9,brake:1,drive:1.1},sports:{response:7.4,steer:.66,front:.53,rear:.47,stiffF:.10,stiffR:.14,inertia:.25,damping:1.35,brake:1.12,drive:1.6},utility:{response:3.6,steer:.57,front:.46,rear:.54,stiffF:.15,stiffR:.12,inertia:.39,damping:1.5,brake:.85,drive:1.05}};
  const handling=s=>s.sports||s.top>=33?HANDLING.sports:s.mass>=1.3?HANDLING.utility:HANDLING.sedan;
  const condition=()=>({engine:1,cooling:1,temperature:0,panels:[1,1,1,1],glass:[1,1,1,1],tyres:[1,1,1,1]});
  let nextIdentity=1;
  class Vehicle {
    constructor(type, x, z, angle, opts = {}) {
      this.type = type; this.spec = SPECS[type]; this.name = NAMES[type];
      this.x = x; this.z = z; this.y = this.spec.boat ? W.WATER_Y + 0.55 : CITY.groundY(x, z); this.vy = 0; this.bob = W.rng() * 6; this.sinkT = 0; this.angle = angle; this.vx = 0; this.vz = 0; this.speed = 0; this.lat = 0;
      this.identity=opts.identity||Date.now().toString(36)+'-'+nextIdentity++;this.condition=condition();this.doors=[0,0];this.doorTarget=[0,0];this.disabled=false;this.burned=false;
      this.steer = 0; this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
      this.colIdx = opts.color !== undefined ? opts.color : Math.floor(W.rng() * PALETTE.length); this.meshes = getMesh(type, this.colIdx); this.mesh = this.meshes.body; this.dentLevel = 0; this.dentSeed = Math.floor(W.rng() * 1e6);
      this.maxHealth = this.spec.armor ? 2600 : 1000 * this.spec.mass; this.health = this.maxHealth; this.wrecked = false; this.fireT = 0;
      this.dmg = { pull: 0, front: 1, rear: 1, burst: null }; // lasting damage: a bent axle pulls, a burst tyre loses grip on its axle
      this.driver = null; this.passengers = []; this.ai = { mode: opts.mode || 'parked', edge: null, lane: 0, path: null, pathIdx: 0, stuck: 0, honk: 0, cruise: 9 + W.rng() * 5, reverseT: 0, blockedT: 0, target: null, waitT: 0 };
      this.lightsOn = false; this.brakeLights = false; this.siren = false; this.sirenPhase = W.rng() * 10; this.horn = 0;
      this.wheelRot = 0; this.pitch = 0; this.roll = 0; this.airborne = false; this.airT = 0; this.wasAir = false;
      this.bones = new Float32Array(16 * RENDER.MAX_BONES); this.emis = new Float32Array(RENDER.MAX_BONES); this.model = M.create();
      for (let i = 0; i < RENDER.MAX_BONES; i++) this.bones.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], i * 16);
      this.removed = false; this.scared = 0; this.isMission = !!opts.mission; this.locked = !!opts.locked; this.lastHitBy = null; this.age = 0; this.damageFlash = 0;
      this.important = false; this.playerOwned = false;
    }
    get fwd() { return [Math.sin(this.angle), Math.cos(this.angle)]; }
    get right() { return [-Math.cos(this.angle), Math.sin(this.angle)]; }
    circles() {
      const s = this.spec, fx = Math.sin(this.angle), fz = Math.cos(this.angle), r = s.wid / 2 - 0.02; const L = s.len;
      if (L > 6.5) return [[this.x + fx * L * 0.36, this.z + fz * L * 0.36, r], [this.x, this.z, r], [this.x - fx * L * 0.36, this.z - fz * L * 0.36, r]];
      return [[this.x + fx * L * 0.26, this.z + fz * L * 0.26, r], [this.x - fx * L * 0.26, this.z - fz * L * 0.26, r]];
    }
    // The same circles written into a caller's flat [x, z, r, ...] buffer: the collision loops run this thousands of
    // times a second and the array-of-arrays version was most of their cost in garbage alone.
    circlesInto(out) {
      const s = this.spec, fx = Math.sin(this.angle), fz = Math.cos(this.angle), r = s.wid / 2 - 0.02; const L = s.len;
      if (L > 6.5) { const o = L * 0.36;
        out[0] = this.x + fx * o; out[1] = this.z + fz * o; out[2] = r;
        out[3] = this.x; out[4] = this.z; out[5] = r;
        out[6] = this.x - fx * o; out[7] = this.z - fz * o; out[8] = r; return 3; }
      const o = L * 0.26;
      out[0] = this.x + fx * o; out[1] = this.z + fz * o; out[2] = r;
      out[3] = this.x - fx * o; out[4] = this.z - fz * o; out[5] = r; return 2;
    }
    local(px, pz) { const sa = Math.sin(this.angle), ca = Math.cos(this.angle); const dx = px - this.x, dz = pz - this.z; return [dx * sa + dz * ca, -dx * ca + dz * sa]; }
    get absSpeed() { return Math.hypot(this.vx, this.vz); }

    update(dt) {
      if (this.siren) this.sirenPhase += dt * 15;
      if (this.removed) return; this.age += dt; if (this.damageFlash > 0) this.damageFlash -= dt;
      if (!this.wrecked) { if (this.ai.mode === 'traffic' || this.ai.mode === 'flee') this.aiTraffic(dt); else if (this.ai.mode === 'chase') this.aiChase(dt); else if (this.ai.mode === 'parked' && !this.driver) { this.controls.throttle = 0; this.controls.brake = this.absSpeed > 0.2 ? 0.5 : 0; this.controls.steer = 0; } else if (this.ai.mode === 'route') this.aiRoute(dt); }
      else { this.controls.throttle = 0; this.controls.brake = 1; this.controls.steer = 0; }
      // a parked car that has come to rest sleeps: no physics or collision until a driver, a shove or a shot wakes it
      if (this.ai.mode === 'parked' && !this.driver && !this.wrecked && !this.spec.boat && !this.airborne && this.absSpeed < 0.03) { this.sleepT = (this.sleepT || 0) + dt; } else this.sleepT = 0;
      if (this.sleepT > 1.5) { this.vx = 0; this.vz = 0; this.speed = 0; }
      else if (this.spec.boat) this.boatPhysics(dt); else this.physics(dt);
      if (this.spec.boat && this.wrecked) { this.sinkT += dt; if (this.sinkT > 9 && this.driver !== PLAYER) this.remove(); }
      if (this.scared > 0) this.scared -= dt;
      if (this.horn > 0) this.horn -= dt;
      for(let k=0;k<2;k++)this.doors[k]=M.approach(this.doors[k],this.doorTarget[k],dt*3.5);
      if(!this.wrecked){const c=this.condition; c.temperature=M.clamp(c.temperature+dt*((1-c.cooling)*Math.abs(this.controls.throttle)*.10-.018),0,1);if(c.temperature>.8)c.engine=Math.max(0,c.engine-dt*.025);if(c.engine<=0)this.disable();}
      // fire & smoke
      const hf = this.health / this.maxHealth;
      if (!this.wrecked && (this.condition.engine<.4||this.condition.cooling<.3) && W.state.frame % 3 === 0) { const f = this.fwd; W.FX.smoke(this.x + f[0] * this.spec.len * 0.4, this.y + 1, this.z + f[1] * this.spec.len * 0.4, 1, hf < 0.15); }
      if (!this.wrecked && hf < 0.25 && this.driver && this.driver !== PLAYER && !this.driver.isCop && this.ai.mode !== 'chase' && this.absSpeed < 6) { const d = this.driver; d.exitCar(); d.state = 'flee'; d.fear = 12; d.threat = [this.x, this.z]; d.say(W.rng() < 0.5 ? "It won't make it!" : 'I need another ride!'); this.ai.mode = 'parked'; for (const q of this.passengers.slice()) { q.exitCar(); q.scare(this.x, this.z); } }
      if (!this.wrecked && this.burning) { if (this.fireT === 0 && this.driver === PLAYER) HUD.notify("The engine's on fire. Get out!"); this.fireT += dt; const f = this.fwd; if (W.state.frame % 2 === 0) W.FX.fire(this.x + f[0] * this.spec.len * 0.4, this.y + 1, this.z + f[1] * this.spec.len * 0.4, 1); if (this.fireT > 5) this.explode(); }
      if (this.wrecked && this.burned && this.fireT < 10) { this.fireT += dt; if (W.state.frame % 2 === 0) { W.FX.fire(this.x, this.y + 0.8, this.z, 1); if (W.state.frame % 4 === 0) W.FX.smoke(this.x, this.y + 1, this.z, 1, true); } }
    }
    physics(dt) {
      const s = this.spec, c = this.controls; const sa = Math.sin(this.angle), ca = Math.cos(this.angle); const f = [sa, ca], r = [-ca, sa];
      let vF = this.vx * f[0] + this.vz * f[1], vL = this.vx * r[0] + this.vz * r[1];
      const tune=handling(s); const top = s.top; const spd = Math.abs(vF);
      // steering: the wheel angle that full lock gives shrinks with speed, so a twitch at 150 km/h is not a spin
      this.steer = M.approach(this.steer, M.clamp(c.steer, -1, 1), tune.response * dt);
      const maxSteer = tune.steer / (1 + spd / 13);
      const assist=this.driver===PLAYER?(GAME.options?.steeringAssist??.35):0;
      const counter=M.clamp(-Math.atan2(vL,Math.max(spd,3))*.35,-.09,.09)*assist*Math.min(1,spd/10);
      const delta = this.steer * maxSteer + counter + this.dmg.pull * Math.min(1, spd / 8); this.steerAngle = delta;
      // tyre model: a bicycle with a front and a rear axle, lateral force from slip angle up to a friction limit
      const Lw = s.len * 0.58, bF = Lw * 0.5, bR = Lw * 0.5; const mu = 13 * s.grip; // total lateral grip, m/s^2
      const live = !this.wrecked && (this.driver || this.ai.mode !== 'parked');
      const wet = 1 - 0.3 * (RENDER.env.wet || 0); // rain takes almost a third of the grip
      let muF = mu * tune.front * wet * this.dmg.front, muR = mu * tune.rear * wet * this.dmg.rear; if (c.handbrake) muR *= 0.32; if (c.brake > 0.6 && vF > 4) muF *= 0.75; // locked rears slide, hard braking dulls the front
      const Cf = muF / tune.stiffF, Cr = muR / tune.stiffR; // cornering stiffness: the front saturates at a slightly larger slip than the rear, so the car understeers gently
      let wheelspin = 0;
      // engine and brakes as longitudinal accelerations; the driven rear axle only gets what the friction circle leaves
      let aLong = 0;
      if (live && !this.airborne) {
        if (c.throttle > 0) { const k = Math.max(0.15, 1 - Math.max(0, vF) / top); const want = s.accel * k * c.throttle * (.18+.82*this.condition.engine); const latUse = Math.min(1, Math.abs(this.latForceR || 0) / muR); const avail = muR * tune.drive * Math.sqrt(Math.max(0.05, 1 - latUse * latUse)); aLong += Math.min(want, avail); if (want > avail * 1.15 && spd < 12) wheelspin = 1; }
        if (c.brake > 0) { if (vF > 0.3) aLong -= Math.min(s.brake, mu * .9 * wet * tune.brake) * c.brake; else if (c.reverse === false) aLong += Math.min(s.brake * c.brake, -vF / dt); /* forward pedal while rolling backwards: stop, don't reverse harder */ else if (vF > -top * 0.35) aLong -= s.accel * 0.6 * c.brake; }
      }
      if (!this.airborne) { aLong -= Math.sign(vF) * Math.min(Math.abs(vF) / dt, 1.2 + (c.handbrake ? 6 : 0)); aLong -= vF * Math.abs(vF) * 0.0035; }
      let yawR = this.yawRate || 0;
      const sub = 2, h = dt / sub;
      for (let k = 0; k < sub; k++) {
        vF += aLong * h; if (c.brake > 0 && c.reverse !== true && Math.abs(vF) < 0.15 && spd < 1) vF = 0;
        if (this.airborne) continue;
        const v = Math.max(Math.abs(vF), 2.5);
        // slip angles and lateral forces (m/s^2 at the centre of mass)
        const af = Math.atan2(vL + yawR * bF, v) - delta * Math.sign(vF || 1), ar = Math.atan2(vL - yawR * bR, v);
        let Ff = -M.clamp(Cf * af, -muF, muF), Fr = -M.clamp(Cr * ar, -muR, muR); if (wheelspin) Fr *= 0.55; // spinning tyres have little sideways bite
        const aLat = Ff + Fr, yawAcc = (Ff * bF - Fr * bR) / (tune.inertia * Lw * Lw);
        // dynamic response, blended with a plain kinematic turn below walking pace where slip angles mean little
        const w = M.clamp((Math.abs(vF) - 2.0) / 3.0, 0, 1);
        const kinYaw = vF / Lw * Math.tan(delta);
        vL += aLat * h * w; vL -= yawR * vF * h * w; vL -= vL * Math.min(1, 10 * h) * (1 - w);
        yawR += yawAcc * h * w; yawR = yawR * w + kinYaw * (1 - w); yawR -= yawR * Math.min(1, tune.damping * h);
        this.latForceR = Fr; this.slipF = af; this.slipR = ar; this.latAcc = aLat;
      }
      if (!this.airborne) this.angle += yawR * dt;
      this.yawRate = yawR; this.wheelspin = wheelspin;
      this.skid = !this.airborne && (Math.abs(this.slipR || 0) > 0.16 || Math.abs(this.slipF || 0) > 0.2 || wheelspin || (c.handbrake && spd > 4)) && spd > 3;
      const nf = this.fwd, nr = this.right;
      this.vx = nf[0] * vF + nr[0] * vL; this.vz = nf[1] * vF + nr[1] * vL; this.speed = vF; this.lat = vL;
      this.x += this.vx * dt; this.z += this.vz * dt;
      // vertical
      const g = CITY.groundY(this.x, this.z, this.y);
      if (this.airborne) {
        this.vy -= 22 * dt; this.y += this.vy * dt; this.airT += dt;
        if (this.y <= g) { this.y = g; const impact = -this.vy; this.airborne = false; this.vy = 0; if (impact > 9) { this.damage(impact * 6, null); AUDIO.play('crash', this.x, this.z, impact / 15); W.FX.dust(this.x, g, this.z, 10); } this.landed = this.airT; this.airT = 0; }
      } else {
        const dy = g - this.y;
        if (dy < -0.35 && Math.abs(vF) > 3) { this.airborne = true; this.vy = Math.max(this.slopeVy || 0, 0); this.y += this.vy * dt; } // the ground fell away: launch with the slope's vertical speed
        else { this.slopeVy = M.clamp(dy / Math.max(dt, 0.001), -30, 30); if (dy > 0.3) this.slopeVy = 0; this.vy = 0; this.y = g; }
      }
      // cosmetic body pitch and roll
      const accF = (vF - (this.prevVF === undefined ? vF : this.prevVF)) / dt; this.prevVF = vF; const accL = (this.latForceR || 0) * 2;
      this.pitch = M.lerp(this.pitch, this.airborne ? -Math.atan2(this.vy, Math.max(Math.abs(vF), 3)) * 0.5 : -Math.atan2(this.slopeVy||0,Math.max(Math.abs(vF),3))*.85+M.clamp(-accF * .006, -.06, .06), Math.min(1,6 * dt)); // squat under power, dive under braking
      if (s.bike) this.roll = M.lerp(this.roll, this.airborne ? 0 : M.clamp(LEAN_SIGN * Math.atan2(this.latAcc || 0, 9.81) * 1.15, -0.62, 0.62), 8 * dt); // a rider leans into the corner
      else this.roll = M.lerp(this.roll, M.clamp(accL * 0.012, -0.12, 0.12), 6 * dt);
      this.wheelRot += vF / s.wheelR * dt;
      // skid marks from the rear wheels
      if (this.skid && !this.airborne && !this.wrecked) { const rr = this.right, ff = this.fwd; const wz = s.len * 0.31, wx = s.wid / 2 - 0.15; for (const sign of [1, -1]) { const x1 = this.x - ff[0] * wz + rr[0] * wx * sign, z1 = this.z - ff[1] * wz + rr[1] * wx * sign; const key = sign > 0 ? 'skidL' : 'skidR'; const prev = this[key]; if (prev && M.dist2(prev[0], prev[1], x1, z1) < 9) W.decal('skid', prev[0], prev[1], x1, z1, 0.32, [0.05, 0.05, 0.05], 0.55); this[key] = [x1, z1]; } } else { this.skidL = this.skidR = null; }
      this.brakeLights = c.brake > 0.1 && vF > 0.5;
      this.collide(dt);
      this.wasAir = this.airborne;
    }
    collide(dt, water = false) {
      const s = this.spec; const f = this.fwd; const half = s.len / 2;
      // buildings & props: each circle (a boat has already been kept off the shore)
      if (!water) for (let ci = 0, nci = this.circlesInto(CIRC_A); ci < nci; ci++) { const cx = CIRC_A[ci * 3], cz = CIRC_A[ci * 3 + 1], r = CIRC_A[ci * 3 + 2];
        const res = W.pushOut(cx, cz, r, {y:this.airborne?this.y:Math.max(this.y,CITY.groundY(cx,cz,this.y+.35)),height:s.hgt,vehicle:this});
        if (res.hit) {
          const nx = res.hit[0], nz = res.hit[1];
          if (res.hit.prop) { const p = res.hit.prop; const spd = this.absSpeed; if ((p.kind === 'lamppost' || p.kind === 'hydrant' || p.kind === 'bin' || p.kind === 'trafficLight' || p.kind === 'bollard' || p.kind === 'cone' || p.kind === 'barrier' || p.kind === 'newsbox' || p.kind === 'mailbox' || p.kind === 'meter') && spd > (p.kind === 'cone' ? 1 : 3)) { W.knockProp(p, this.vx / spd, this.vz / spd); this.vx *= 0.8; this.vz *= 0.8; this.damage(spd * 2, null); AUDIO.play('bump', this.x, this.z); if (p.kind === 'hydrant') { for (let i = 0; i < 40; i++) W.particle(p.x, 0.5, p.z, (W.rng() - 0.5) * 2, 8 + W.rng() * 6, (W.rng() - 0.5) * 2, 1.2, 0.5, [0.7, 0.85, 1], 0.8, { grav: 12, grow: 1 }); p.ref.hydrantT = 30; } continue; } }
          const dx = res.x - cx, dz = res.z - cz; this.x += dx; this.z += dz;
          const vn = this.vx * nx + this.vz * nz;
          if (vn < 0) {
            const impact = -vn; this.vx -= vn * nx * 1.15; this.vz -= vn * nz * 1.15;
            // scrape: slow down along the wall, rotate away
            this.vx *= 0.9; this.vz *= 0.9;
            const front = (cx - this.x) * f[0] + (cz - this.z) * f[1] > 0; const side = (nx * f[1] - nz * f[0]); // which side the wall is on
            this.angle += (front ? -1 : 1) * Math.sign(side || 1) * Math.min(impact * 0.03, 0.15) * (this.speed < 0 ? -1 : 1);
            if (impact > 3 && this.driver === PLAYER) PLAYER.shake(Math.min(1, impact / 10));
            if (impact > 3) { this.damage(impact * impact * .35,null,{x:cx-nx*r,y:this.y+.7,z:cz-nz*r,kind:'impact'}); AUDIO.play('crash', this.x, this.z, impact / 12); W.FX.spark(cx + nx * -r, 0.6, cz + nz * -r, Math.min(12, impact * 2)); if (impact > 6) W.FX.glass(cx, 1.2, cz, 6); this.ai.stuck += 0.5; if (s.bike && impact > 6.5) this.throwRider(impact); }
          }
        }
      }
      // other cars
      for (const o of W.cars) {
        if (o === this || o.removed || this.y>=o.y+o.spec.hgt || this.y+this.spec.hgt<=o.y) continue; if (M.dist2(this.x, this.z, o.x, o.z) > 144) continue;
        const na = this.circlesInto(CIRC_A), nb = o.circlesInto(CIRC_B);
        for (let ai = 0; ai < na; ai++) for (let bi = 0; bi < nb; bi++) {
          const ax = CIRC_A[ai * 3], az = CIRC_A[ai * 3 + 1], ar = CIRC_A[ai * 3 + 2];
          const bx = CIRC_B[bi * 3], bz = CIRC_B[bi * 3 + 1], br = CIRC_B[bi * 3 + 2];
          const dx = ax - bx, dz = az - bz; const rr = ar + br; const d2 = dx * dx + dz * dz; if (d2 >= rr * rr || d2 < 1e-6) continue;
          const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, pen = rr - d;
          const mA = this.spec.mass, mB = o.spec.mass, tot = mA + mB;
          this.x += nx * pen * (mB / tot); this.z += nz * pen * (mB / tot); o.x -= nx * pen * (mA / tot); o.z -= nz * pen * (mA / tot);
          const rvx = this.vx - o.vx, rvz = this.vz - o.vz; const vn = rvx * nx + rvz * nz;
          if (vn < 0) {
            const j = -(1.25) * vn / (1 / mA + 1 / mB);
            this.vx += j * nx / mA; this.vz += j * nz / mA; o.vx -= j * nx / mB; o.vz -= j * nz / mB;
            const impact = -vn;
            // spin: offset of the contact point from the centre
            const offA = (ax - this.x) * this.right[0] + (az - this.z) * this.right[1]; const offB = (bx - o.x) * o.right[0] + (bz - o.z) * o.right[1];
            this.angle += M.clamp(offA * impact * 0.01, -0.2, 0.2) * (mB / tot); o.angle -= M.clamp(offB * impact * 0.01, -0.2, 0.2) * (mA / tot);
            // and the angular impulse of an off-centre hit, so a T-bone spins the car it hits and a nudge on the rear
            // quarter (a PIT) turns a fleeing car sideways instead of only shoving it
            const IA = mA * (this.spec.len * this.spec.len + this.spec.wid * this.spec.wid) / 12, IB = mB * (o.spec.len * o.spec.len + o.spec.wid * o.spec.wid) / 12;
            const rAx = ax - this.x, rAz = az - this.z, rBx = bx - o.x, rBz = bz - o.z;
            this.yawRate = (this.yawRate || 0) + M.clamp(j * (rAz * nx - rAx * nz) / IA, -3, 3); o.yawRate = (o.yawRate || 0) + M.clamp(j * (rBx * nz - rBz * nx) / IB, -3, 3);
            if (impact > 2.5) {
              if (this.driver === PLAYER || o.driver === PLAYER) PLAYER.shake(Math.min(1, impact / 9));
              const dmg = impact * impact * 0.4; this.damage(dmg*(mB/mA),o,{x:ax-nx*ar,y:this.y+.7,z:az-nz*ar,kind:'impact'}); o.damage(dmg*(mA/mB),this,{x:bx+nx*br,y:o.y+.7,z:bz+nz*br,kind:'impact'});
              AUDIO.play('crash', ax, az, impact / 10); W.FX.spark(ax - nx * ar, 0.7, az - nz * ar, Math.min(14, impact * 2)); if (impact > 7) W.FX.glass(ax, 1.2, az, 8);
              if (o.ai.mode === 'traffic' && !o.driverIsPlayer()) { o.scared = 4; o.ai.mode = 'flee'; o.fleeFrom = this; } if (this.ai.mode === 'traffic' && !this.driverIsPlayer()) { this.ai.honk = 1; }
              if (impact > 5) { if (this.spec.bike) this.throwRider(impact); if (o.spec.bike) o.throwRider(impact); }
              W.noise(ax, az, 30, 'crash');
            }
          }
        }
      }
      // pedestrians
      const spd = this.absSpeed;
      if (spd > 1.5 && !water) for (const p of W.peds) {
        if (p.removed || p.inCar || p.state === 'dead' || p.y>=this.y+this.spec.hgt || p.y+1.7<=this.y) continue; if (M.dist2(this.x, this.z, p.x, p.z) > (half + 2) * (half + 2)) continue;
        const [lf, ll] = this.local(p.x, p.z); if (Math.abs(lf) < half + 0.4 && Math.abs(ll) < s.wid / 2 + 0.35) { p.hitByCar(this, spd); }
      }
    }
    driverIsPlayer() { return this.driver === PLAYER; }
    // A hard stop on a motorcycle puts the rider over the bars.
    throwRider(impact) {
      const d = this.driver; if (!d) return; const f = this.fwd; const sp = Math.min(impact, 14);
      if (d === PLAYER) { if (!PLAYER.exitCar()) return; PLAYER.knock(f[0] * sp * 0.6, 4 + sp * 0.25, f[1] * sp * 0.6); PLAYER.hurt(impact * 3.5, 'fall', null); HUD.notify('Thrown from the bike.'); }
      else { d.exitCar(); d.x = this.x + f[0] * 1.2; d.z = this.z + f[1] * 1.2; d.knockT = 2.5; d.state = 'knocked'; d.launch(f[0] * sp * 0.6, 4 + sp * 0.2, f[1] * sp * 0.6); d.damage(impact * 5, null); if (this.ai.mode === 'traffic') { this.ai.mode = 'parked'; } }
      this.vx *= 0.3; this.vz *= 0.3;
    }
    // Boats: thrust against water drag, a rudder that needs way on, sideways slip, a hull that bobs and banks.
    boatPhysics(dt) {
      const s = this.spec, c = this.controls; const sa = Math.sin(this.angle), ca = Math.cos(this.angle); const f = [sa, ca], r = [-ca, sa];
      let vF = this.vx * f[0] + this.vz * f[1], vL = this.vx * r[0] + this.vz * r[1]; const top = s.top;
      const live = !this.wrecked && (this.driver || this.ai.mode !== 'parked');
      this.steer = M.approach(this.steer, M.clamp(c.steer, -1, 1), 4 * dt); this.steerAngle = this.steer * 0.5;
      let aLong = 0;
      if (live) { if (c.throttle > 0) aLong += s.accel * c.throttle * Math.max(0.2, 1 - Math.max(0, vF) / top); if (c.brake > 0) { if (vF > 0.5) aLong -= s.brake * c.brake; else if (vF > -top * 0.25) aLong -= s.accel * 0.4 * c.brake; } }
      aLong -= vF * Math.abs(vF) * 0.006 + vF * 0.1; if (this.wrecked) aLong -= vF * 0.8;
      const way = M.clamp(Math.abs(vF) / 6, 0, 1); const yawWant = live ? this.steer * s.turn * 0.55 * way * Math.sign(vF || 1) : 0;
      this.yawRate = M.lerp(this.yawRate || 0, yawWant, Math.min(1, 2.5 * dt)); this.angle += this.yawRate * dt;
      vL -= this.yawRate * vF * dt * 0.45; vL -= vL * Math.min(1, 1.4 * dt); vF += aLong * dt;
      const nf = this.fwd, nr = this.right; this.vx = nf[0] * vF + nr[0] * vL; this.vz = nf[1] * vF + nr[1] * vL; this.speed = vF; this.lat = vL; this.skid = false; this.wheelspin = 0; this.airborne = false; this.vy = 0;
      this.x += this.vx * dt; this.z += this.vz * dt;
      const t = W.state.elapsed + this.bob; const bob = (Math.sin(t * 1.3) * 0.05 + Math.sin(t * 2.3) * 0.025) * (1 - 0.5 * way);
      this.y = W.WATER_Y + 0.55 + bob - (this.wrecked ? Math.min(1.6, this.sinkT * 0.2) : 0);
      this.pitch = M.lerp(this.pitch, -0.09 * M.clamp(vF / top, 0, 1) + Math.sin(t * 1.1) * 0.02 + (this.wrecked ? 0.15 : 0), 3 * dt);
      this.roll = M.lerp(this.roll, M.clamp(LEAN_SIGN * this.yawRate * vF * 0.02, -0.22, 0.22) + Math.sin(t * 0.9) * 0.02, 3 * dt);
      this.brakeLights = c.brake > 0.1 && vF > 0.5;
      // wake and spray
      if (Math.abs(vF) > 3 && !this.wrecked && W.state.frame % 2 === 0) { const sx = this.x - nf[0] * s.len * 0.5, sz = this.z - nf[1] * s.len * 0.5; for (const sg of [1, -1]) W.particle(sx + nr[0] * sg * 0.9, W.WATER_Y + 0.1, sz + nr[1] * sg * 0.9, nr[0] * sg * 1.2 - this.vx * 0.1, 0.3 + W.rng() * 0.5, nr[1] * sg * 1.2 - this.vz * 0.1, 0.9, 0.3, [0.92, 0.96, 1], 0.4, { grav: 3, grow: 1.1 }); }
      // collisions: other hulls and cars share the circle test, the shore and the pier are walls
      for (const [cx, cz, rr] of this.circles()) { const res = W.pushOutWater(cx, cz, rr); if (res.hit) { const nx = res.hit[0], nz = res.hit[1]; this.x += res.x - cx; this.z += res.z - cz; const vn = this.vx * nx + this.vz * nz;
        if (vn < 0) { const impact = -vn; this.vx -= vn * nx * 1.1; this.vz -= vn * nz * 1.1; this.vx *= 0.85; this.vz *= 0.85; if (impact > 3 && !res.hit.edge) { this.damage(impact * impact * 0.3, null); AUDIO.play('crash', this.x, this.z, impact / 12); W.FX.dust(cx, W.WATER_Y + 0.3, cz, 6); this.ai.stuck += 0.5; } if (res.hit.edge && this.driver === PLAYER) HUD.notify('Open water. Turn back.'); } } }
      this.collide(dt, true);
    }
    damage(amount, source, contact=null) {
      if(this.wrecked)return;amount*=this.damageScale||1;this.health-=amount;this.damageFlash=.15;if(source&&source!==this)this.lastHitBy=source;
      const q=this.condition, spec=this.spec;
      if(contact){const [f,r]=this.local(contact.x,contact.z),y=contact.y-this.y,front=f>0,side=r<0?0:1;
        const region=Math.abs(f)>spec.len*.28?(front?0:1):(r<0?2:3);q.panels[region]=Math.max(0,q.panels[region]-amount/this.maxHealth*2.4);
        const wheel=(front?0:2)+side;
        if(y<spec.wheelR*1.8&&Math.abs(r)>spec.wid*.32&&Math.abs(Math.abs(f)-spec.len*.31)<.65){q.tyres[wheel]=Math.max(0,q.tyres[wheel]-amount/110);if(q.tyres[wheel]===0&&!this.tyreTold?.[wheel]){(this.tyreTold??=[])[wheel]=true;AUDIO.play('hit',this.x,this.z);if(this.driver===PLAYER)HUD.notify((front?'Front':'Rear')+' tyre punctured.');}}
        if(y>spec.hgt*.55&&Math.abs(f)<spec.len*.35){q.glass[region]=Math.max(0,q.glass[region]-amount/80);W.FX.glass(contact.x,contact.y,contact.z,3);}
        if(front&&f>spec.len*.25&&Math.abs(r)<spec.wid*.32&&y>spec.wheelR*.7&&y<spec.hgt*.75){q.engine=Math.max(0,q.engine-amount/this.maxHealth*.95);q.cooling=Math.max(0,q.cooling-amount/this.maxHealth*1.65);}
        this.syncCondition();this.refreshDamageMesh();
      }
      const hf=this.health/this.maxHealth,lvl=hf<.3?2:hf<.65?1:0;
      if(!contact&&lvl>this.dentLevel&&this.health>0){this.dentLevel=lvl;this.replaceMeshes(dentedMesh(this.type,this.colIdx,lvl*.5,this.dentSeed,this.condition));}
      if(this.ai.mode==='traffic'&&amount>30){this.scared=6;this.ai.mode='flee';}
      // Crashes wear a car out and leave it disabled; gunfire and blasts set it alight at the end, and a burning car
      // goes up five seconds later (the overhaul's contact points had routed every bullet to "disabled").
      const crash=contact&&contact.kind==='impact';
      if(!crash&&!this.burning&&this.health>0&&this.health<this.maxHealth*.12){this.burning=true;this.fireT=0;}
      if(this.health<=0){if(crash&&!this.bigBoom)this.disable();else this.explode();}
    }
    releaseMeshes(){if(this.privateMeshes&&typeof GL!=='undefined'){const gl=GL.gl;for(const m of [this.meshes.body,this.meshes.glass])if(m?.vao){gl.deleteVertexArray(m.vao);gl.deleteBuffer(m.vbo);gl.deleteBuffer(m.ibo);}}this.privateMeshes=false;}
    replaceMeshes(next,owned=true){this.releaseMeshes();this.meshes=next;this.mesh=next.body;this.privateMeshes=owned;}
    refreshDamageMesh(){const c=this.condition,key=c.panels.map(v=>Math.floor((1-v)*3)).join('')+c.glass.map(v=>v<=0?1:0).join('');if(this.damageMeshKey===key)return;this.damageMeshKey=key;this.replaceMeshes(dentedMesh(this.type,this.colIdx,this.dentLevel*.5,this.dentSeed,c));}
    syncCondition(){const c=this.condition;this.dmg.front=.45+.55*Math.min(c.tyres[0],c.tyres[1]);this.dmg.rear=.45+.55*Math.min(c.tyres[2],c.tyres[3]);this.dmg.pull=(c.tyres[1]-c.tyres[0])*.065+(c.panels[3]-c.panels[2])*.035;this.dmg.burst=c.tyres.slice(0,2).includes(0)?'front':c.tyres.slice(2).includes(0)?'rear':null;}
    disable(){if(this.wrecked)return;if((this.type==='police'||this.type==='swat')&&typeof POLICE!=='undefined'&&PLAYER.wanted>0)POLICE.S.pot=(POLICE.S.pot||0)+100*PLAYER.wanted;this.disabled=true;this.wrecked=true;this.health=0;this.condition.engine=0;this.controls.throttle=0;this.siren=false;this.lightsOn=false;if(this.driver===PLAYER)HUD.notify('Engine disabled. Find another ride.');else if(this.driver){this.driver.exitCar();}for(const p of this.passengers.slice())p.exitCar();}
    saveCondition(){return {health:this.health,condition:JSON.parse(JSON.stringify(this.condition)),dentSeed:this.dentSeed,dentLevel:this.dentLevel,identity:this.identity,disabled:this.disabled};}
    loadCondition(data){if(!data)return;this.health=M.clamp(Number(data.health)||0,0,this.maxHealth);this.dentSeed=data.dentSeed||this.dentSeed;this.dentLevel=M.clamp(data.dentLevel||0,0,2);if(data.identity)this.identity=data.identity;
      const c=data.condition||{};for(const k of ['engine','cooling','temperature'])if(Number.isFinite(c[k]))this.condition[k]=M.clamp(c[k],0,1);for(const k of ['panels','glass','tyres'])if(Array.isArray(c[k])&&c[k].length===4)this.condition[k]=c[k].map(v=>Number.isFinite(v)?M.clamp(v,0,1):1);this.syncCondition();this.damageMeshKey=null;this.refreshDamageMesh();if(data.disabled||this.health<=0)this.disable();}
    repair(){this.health=this.maxHealth;this.dentLevel=0;this.replaceMeshes(getMesh(this.type,this.colIdx),false);this.condition=condition();this.damageMeshKey=null;this.tyreTold=[];this.dmg={pull:0,front:1,rear:1,burst:null};this.fireT=0;this.disabled=this.wrecked=this.burning=this.burned=false;}
    explode() { if ((this.type === 'police' || this.type === 'swat') && !this.burned && typeof POLICE !== 'undefined' && PLAYER.wanted > 0) { POLICE.S.pot = (POLICE.S.pot || 0) + 150 * PLAYER.wanted; PLAYER.P.stats.copCars = (PLAYER.P.stats.copCars || 0) + 1; } // a cruiser taken out raises the stakes of the run
      if (this.burned) return; this.burned=true; this.wrecked = true; this.health = 0; this.fireT = 0; this.replaceMeshes(dentedMesh(this.type, 'wreck', 1.0, this.dentSeed)); this.siren = false; this.lightsOn = false;
      const big = this.bigBoom ? 3 : 1; W.FX.explosion(this.x, this.y + 0.5, this.z, (this.spec.len > 6 ? 1.6 : 1) * big); AUDIO.play('explosion', this.x, this.z); W.noise(this.x, this.z, 120 * big, 'explosion'); if (this.bigBoom) { for (let k = 0; k < 6; k++) setTimeout(() => W.FX.explosion(this.x + (W.rng() - 0.5) * 16, this.y + 1, this.z + (W.rng() - 0.5) * 16, 1.4), 150 + k * 120); PLAYER.shake(1); }
      this.vy = 4; this.airborne = true; this.y += 0.05;
      const killer = this.lastHitBy;
      for (const p of W.peds) { if (p.removed || p.state === 'dead') continue; const d = M.dist(p.x, p.z, this.x, this.z); if (p.inCar === this) { p.die(killer, 'explosion'); } else if (d < 7) { p.die(killer, 'explosion'); p.launch((p.x - this.x) / d * 6, 5, (p.z - this.z) / d * 6); } else if (d < 40) p.scare(this.x, this.z); }
      if (this.driver && this.driver !== PLAYER) { this.driver.inCar = null; this.driver = null; }
      const R = this.bigBoom ? 28 : 9; for (const c of W.cars) { if (c === this || c.removed) continue; const d = M.dist(c.x, c.z, this.x, this.z); if (d < R) { if (this.bigBoom) { c.lastHitBy = killer; c.damage(1500 * (1 - d / R) + 200, this); c.vy = 4; c.airborne = true; continue; } c.lastHitBy = killer; c.damage(320 * (1 - d / 9) + 60, this); const k = (9 - d) * 1.2; c.vx += (c.x - this.x) / (d + 0.1) * k; c.vz += (c.z - this.z) / (d + 0.1) * k; c.vy = 3; c.airborne = true; } }
      if (PLAYER && PLAYER.alive) { const d = M.dist(PLAYER.x, PLAYER.z, this.x, this.z); PLAYER.shake(M.clamp(1.4 - d / (this.bigBoom ? 60 : 30), 0, 1)); if (PLAYER.car === this) PLAYER.hurt(300, 'explosion', killer); else if (d < 9) { PLAYER.hurt(110 * (1 - d / 9), 'explosion', killer); PLAYER.knock((PLAYER.x - this.x) / (d + 0.1) * 6, 5, (PLAYER.z - this.z) / (d + 0.1) * 6); } }
      if (killer === PLAYER || (killer && killer.driver === PLAYER)) { POLICE.crime('explosion', this.x, this.z, this); MISSIONS.rampageKill('cars', this); }
      if (this.onExplode) this.onExplode();
    }

    // ---- AI: traffic
    placeOnLane(edge, lane, s) { this.ai.edge = edge; this.ai.lane = lane; this.ai.path = null; const [px, pz] = CITY.lanePoint(edge, lane, s); this.x = px; this.z = pz; this.angle = Math.atan2(edge.dx, edge.dz); this.y = CITY.groundY(px, pz); const f = this.fwd; const v = this.ai.cruise * 0.8; this.vx = f[0] * v; this.vz = f[1] * v; }
    laneS() { const e = this.ai.edge; const [sx, sz] = CITY.lanePoint(e, this.ai.lane, 0); return (this.x - sx) * e.dx + (this.z - sz) * e.dz; }
    aiTraffic(dt) {
      const ai = this.ai, c = this.controls;
      if (!ai.edge) { const nl = CITY.nearestLane(this.x, this.z, this.fwd[0], this.fwd[1]); if (!nl) return; ai.edge = nl.e; ai.lane = nl.k; ai.path = null; }
      const e = ai.edge; const L = CITY.laneLen(e); let s = this.laneS();
      let tx, tz; const look = 4 + Math.abs(this.speed) * 0.55; let turning = false;
      if (ai.path) {
        // pure pursuit along the corner polyline: the target is the first waypoint at least a look-ahead away, and waypoints
        // already within reach or behind the car are dropped. Chasing the very next waypoint is how a car ends up doing
        // laps of an intersection, aiming at a point inside its own turning circle.
        ai.pathT = (ai.pathT || 0) + dt; const fw = this.fwd; const la = 3.5 + Math.abs(this.speed) * 0.35; const n = ai.path.length;
        const rel = i => { const p = ai.path[i]; const dx = p[0] - this.x, dz = p[1] - this.z; return [Math.hypot(dx, dz), dx * fw[0] + dz * fw[1]]; };
        while (ai.pathIdx < n - 1) { const [d, along] = rel(ai.pathIdx); if (d < la * 0.6 || (along < 1 && d < 9)) ai.pathIdx++; else break; }
        if (ai.pathIdx >= n - 1) { const [d, along] = rel(n - 1); if (d < 2.5 || (along < 1 && d < 9) || ai.pathT > 12) { ai.path = null; ai.edge = ai.nextEdge; ai.nextEdge = null; ai.pathT = 0; s = this.laneS(); } }
        if (ai.path) { let i = ai.pathIdx; while (i < n - 1 && rel(i)[0] < la) i++; tx = ai.path[i][0]; tz = ai.path[i][1]; turning = true; }
      }
      if (!ai.path) {
        if ((!ai.nextEdge || ai.nextEdge.from !== e.to) && s > L - 16) this.planNext();
        const early = ai.nextEdge && ai.nextEdge.from === e.to && ai.turnKind === 'turn' ? this.turnRadius() - 1 : 1.5; // a corner's arc begins before the node
        if (s >= L - early) { this.chooseNext(); const p = ai.path[ai.pathIdx]; tx = p[0]; tz = p[1]; turning = true; }
        else { [tx, tz] = CITY.lanePoint(e, ai.lane, s + look); }
      }
      // steering toward the target
      const desired = Math.atan2(tx - this.x, tz - this.z); const da = M.angleTo(this.angle, desired); const ld = Math.max(2.5, M.dist(this.x, this.z, tx, tz));
      // pure pursuit: the steer angle that puts the front axle on the circle through the target, over the lock available at this speed,
      // with a touch of yaw-rate damping so a car coming out of a corner settles instead of fishtailing
      const spd0 = Math.abs(this.speed); const lock = 0.62 / (1 + spd0 / 13); const delta = Math.atan2(2 * this.spec.len * 0.58 * Math.sin(da), ld);
      c.steer = M.clamp(delta / lock - (this.yawRate || 0) * 0.1, -1, 1);
      // target speed
      let target = (ai.mode === 'flee' ? (ai.fleeSpeed || 24) : ai.cruise) * (1 - 0.25 * (W.weather ? W.weather.rain : 0)); // everyone slows down in the wet
      if(typeof STREETLIFE!=='undefined'&&ai.mode==='traffic')target*=1-STREETLIFE.risk(this.x,this.z)*.55;
      // a fleeing mission driver who is tailed closely for long enough loses their nerve, pulls over and runs
      if (ai.missionFlee && this.driver && this.driver !== PLAYER) {
        const close = PLAYER && PLAYER.alive && PLAYER.car && M.dist(PLAYER.x, PLAYER.z, this.x, this.z) < 16;
        ai.pressure = close ? ai.pressure + dt : Math.max(0, ai.pressure - dt * 0.5);
        if (!ai.bailing && (ai.pressure > 9 || this.health < this.maxHealth * 0.55)) { ai.bailing = true; this.driver.say(W.rng() < 0.5 ? 'Alright! Alright!' : "Take it, just don't shoot!"); }
        if (ai.bailing) { target = 0; if (this.absSpeed < 2.5) { const d = this.driver; d.exitCar(); d.bailed = true; d.state = 'flee'; d.fear = 30; d.threat = [PLAYER.x, PLAYER.z]; ai.mode = 'parked'; ai.missionFlee = false; this.scared = 0; return; } }
      }
      if (ai.nextEdge && ai.nextEdge.from === e.to && ai.turnKind !== 'straight' && (turning || s > L - 12)) target = Math.min(target, this.spec.len > 6 ? 4.5 : 6); // corners are taken slowly, and the braking starts before the corner
      if (Math.abs(da) > 0.6) target = Math.min(target, 5);
      // traffic light
      if (ai.mode !== 'flee' && (!ai.path || s < L - 0.5)) {
        const light = W.lightFor(e.to); const remain = L - s;
        if (light && remain < 14 && remain > 1) { const st = W.lightState(light, e.axis); if (st === 'red' || (st === 'yellow' && remain > 7)) { if (remain < 3.5) target = 0; else target = Math.min(target, Math.max(0, (remain - 3) * 1.5)); ai.atLight = true; } else ai.atLight = false; } else ai.atLight = false;
      }
      // obstacles ahead
      const sa = Math.sin(this.angle), ca = Math.cos(this.angle); const f = [sa, ca], r = [-ca, sa]; let blocked = false, blockSpeed = 99; const reach = 5 + Math.abs(this.speed) * 1.0;
      for (const o of W.cars) { if (o === this || o.removed || this.y>=o.y+o.spec.hgt || this.y+this.spec.hgt<=o.y) continue; const dx = o.x - this.x, dz = o.z - this.z; if (dx * dx + dz * dz > (reach + 8) * (reach + 8)) continue; const lf = dx * f[0] + dz * f[1], ll = dx * r[0] + dz * r[1]; const half = o.spec.len / 2; if (lf > 0 && lf - half < reach && Math.abs(ll) < (o.kerb && o.ai.mode === 'parked' ? 1.9 : 2.4)) { /* a car parked up on the kerb is passed, not queued behind */ const os = o.vx * f[0] + o.vz * f[1]; const gap = lf - half - this.spec.len / 2; if (gap < 3) { target = 0; blocked = true; } else target = Math.min(target, Math.max(0, os + (gap - 3) * 0.8)); blockSpeed = Math.min(blockSpeed, Math.abs(os)); } }
      if (ai.mode !== 'flee') {
        for (const p of W.peds) { if (p.removed || p.inCar || p.state === 'dead' || p.y>=this.y+this.spec.hgt || p.y+1.7<=this.y) continue; const dx = p.x - this.x, dz = p.z - this.z; if (dx * dx + dz * dz > 400) continue; const lf = dx * f[0] + dz * f[1], ll = dx * r[0] + dz * r[1]; if (lf > 0 && lf < reach + 2 && Math.abs(ll) < 1.8) { target = lf < 5 ? 0 : Math.min(target, 3); blocked = blocked || lf < 5; } }
        if (PLAYER && PLAYER.alive && !PLAYER.car) { const dx = PLAYER.x - this.x, dz = PLAYER.z - this.z; const lf = dx * f[0] + dz * f[1], ll = dx * r[0] + dz * r[1]; if (lf > 0 && lf < reach + 2 && Math.abs(ll) < 1.8) { target = lf < 5 ? 0 : Math.min(target, 3); if (lf < 5) { blocked = true; if (ai.honk <= 0 && W.rng() < 0.02) { ai.honk = 3; this.horn = 0.6; AUDIO.play('horn', this.x, this.z, 0.6); } } } }
      }
      // throttle / brake
      const sp = this.speed;
      if (sp < target - 0.4) { c.throttle = M.clamp((target - sp) * 0.5, 0.3, 1); c.brake = 0; } else if (sp > target + 0.4) { c.throttle = 0; c.brake = M.clamp((sp - target) * 0.4, 0.3, 1); } else { c.throttle = 0.1; c.brake = 0; }
      c.handbrake = 0;
      // stuck handling and lane changes
      if (blocked && !ai.atLight && blockSpeed < 0.5) { ai.blockedT += dt; } else ai.blockedT = Math.max(0, ai.blockedT - dt);
      if (ai.blockedT > 2.5 && !ai.path) { // try the other lane
        const other = 1 - ai.lane; const [ox, oz] = CITY.lanePoint(e, other, s + 6); let free = true; for (const o of W.cars) if (o !== this && !o.removed && M.dist2(o.x, o.z, ox, oz) < 36) free = false;
        if (free) { ai.lane = other; ai.blockedT = 0; } else if (ai.blockedT > 4 && ai.honk <= 0) { ai.honk = 4; this.horn = 0.5; AUDIO.play('horn', this.x, this.z, 0.5); }
      }
      if (ai.blockedT > 7) { ai.mode = 'flee'; this.scared = 3; ai.blockedT = 0; }
      if (ai.honk > 0) ai.honk -= dt;
      c.reverse = ai.reverseT > 0; // the physics only backs away from a standstill when asked to
      if (ai.reverseT > 0) { ai.reverseT -= dt; c.throttle = 0; c.brake = 1; c.steer = -c.steer; }
      else if (target > 2 && Math.abs(sp) < 0.3 && !blocked && !ai.atLight) { ai.stuck += dt; if (ai.stuck > 2.5) { ai.reverseT = 1.2; ai.stuck = 0; } } else ai.stuck = Math.max(0, ai.stuck - dt);
      if (ai.mode === 'flee' && this.scared <= 0) ai.mode = 'traffic';
    }
    turnRadius() { return Math.max(TURN_R, 1.2 * this.spec.len * 0.58 / Math.tan(0.62 / (1 + 4 / 13))); } // what the steering lock manages at corner speed, with margin
    planNext() { // which way at the coming node: mostly straight on, sometimes a turn, never back the way we came
      const ai = this.ai, e = ai.edge; const node = e.to; let opts = node.out.filter(o => o.to !== e.from); if (!opts.length) opts = node.out;
      const straight = opts.find(o => o.dx === e.dx && o.dz === e.dz);
      let next = (straight && W.rng() < 0.55) ? straight : opts[Math.floor(W.rng() * opts.length)];
      if (ai.forceDir) { const f = opts.find(o => o.dx === ai.forceDir[0] && o.dz === ai.forceDir[1]); if (f) next = f; ai.forceDir = null; }
      ai.nextEdge = next; ai.turnKind = next === straight ? 'straight' : 'turn';
    }
    chooseNext() {
      const ai = this.ai, e = ai.edge; if (!ai.nextEdge || ai.nextEdge.from !== e.to || ai.forceDir) this.planNext(); /* a plan made for another edge is stale */ const next = ai.nextEdge, kind = ai.turnKind;
      const lane = ai.lane; const [p0x, p0z] = CITY.lanePoint(e, lane, CITY.laneLen(e)); const [p3x, p3z] = CITY.lanePoint(next, lane, 0);
      const path = [];
      if (kind === 'straight') { path.push([p3x, p3z], CITY.lanePoint(next, lane, 3)); }
      else { // a circular arc tangent to both lane lines, wide enough that the steering lock follows it and the kerb corner stays clear
        const proj = (p3x - p0x) * e.dx + (p3z - p0z) * e.dz; const cx = p0x + e.dx * proj, cz = p0z + e.dz * proj; // where the two lane lines meet
        const R = this.turnRadius(), bRaw = (p3x - cx) * next.dx + (p3z - cz) * next.dz;
        const qx = cx - e.dx * R + next.dx * R, qz = cz - e.dz * R + next.dz * R; // arc centre: R before the corner and R along the exit
        const ax = cx - e.dx * R - qx, az = cz - e.dz * R - qz, bx = cx + next.dx * R - qx, bz = cz + next.dz * R - qz; // radii to the tangent points
        const N = 9; for (let k = 0; k <= N; k++) { const t = k / N * Math.PI / 2; path.push([qx + ax * Math.cos(t) + bx * Math.sin(t), qz + az * Math.cos(t) + bz * Math.sin(t)]); }
        for (const ext of [3, 7, 12]) path.push(CITY.lanePoint(next, lane, R - bRaw + ext)); } /* waypoints down the exit lane keep the pursuit target on the true path, so the lock unwinds without cutting the corner */
      const f = this.fwd; let i0 = 0; while (i0 < path.length - 1 && (path[i0][0] - this.x) * f[0] + (path[i0][1] - this.z) * f[1] < 1) i0++; // skip what is already behind us
      ai.path = path; ai.pathIdx = i0; ai.pathT = 0;
    }
    // ---- AI: chase a target (the player) — road-agnostic pursuit with reversing when stuck.
    aiChase(dt) {
      const ai = this.ai, c = this.controls; const t = ai.target || PLAYER; if (!t) return;
      // drive-by: armed passengers lean out and shoot
      this.gunT = (this.gunT || 0) - dt; // its own timer: sharing fireT with the burning countdown kept a burning pursuer from ever exploding
      if (this.gunT <= 0 && t === PLAYER && PLAYER.alive) { const shooters = this.passengers.filter(q => q.alive && q.weapon && (q.hostile || q.isGang || (q.isCop && PLAYER.wanted >= 4))); const d = M.dist(this.x, this.z, t.x, t.z);
        if (shooters.length && d < 45 && (!this.driver?.isCop||POLICE.observe(this)) && W.sight3(this.x,this.y+1.5,this.z,t.x,t.P.y+1.2,t.z,[this,t.car])) { this.gunT = 0.9 / shooters.length; const q = shooters[0]; const ang = Math.atan2(t.x - this.x, t.z - this.z) + (W.rng() - 0.5) * 0.3; PLAYER.fireBullet(q, this.x + this.right[0] * 0.8, this.z + this.right[1] * 0.8, 1.3, ang, WEAPONS[q.weapon === 'rifle' ? 'rifle' : 'pistol'], 0.5, this); } else this.fireT = 0.3; }
      const tv = t.car ? [t.car.vx, t.car.vz] : [0, 0]; let px = t.x + tv[0] * 0.6, pz = t.z + tv[1] * 0.6;
      if (t === PLAYER && this.driver && this.driver.isCop) { const pp = POLICE.pursuitPoint(this); px = pp[0]; pz = pp[1]; } // cops only know where they last saw you
      const targetY=t===PLAYER&&this.driver?.isCop?(POLICE.S.lastY||0):(t.P?.y||t.y||0);
      if(typeof STREETS!=='undefined'&&(Math.abs(targetY-this.y)>1||ai.surfacePath?.length)){ai.surfaceT=(ai.surfaceT||0)-dt;if(ai.surfaceT<=0){ai.surfacePath=STREETS.navigation(this,{x:px,z:pz,y:targetY},this.spec.wid);ai.surfaceT=2;}
        while(ai.surfacePath?.length&&M.dist(this.x,this.z,ai.surfacePath[0].x,ai.surfacePath[0].z)<3&&Math.abs(this.y-ai.surfacePath[0].y)<.8)ai.surfacePath.shift();if(ai.surfacePath?.length){px=ai.surfacePath[0].x;pz=ai.surfacePath[0].z;}}
      // Close behind a fleeing car at two stars or more, a cruiser goes for the PIT: it aims at the rear quarter on its own
      // side, so the contact spins the target (see the angular impulse in collide) instead of just shunting it.
      if (t === PLAYER && t.car && this.driver?.isCop && PLAYER.wanted >= 2 && t.car.absSpeed > 8) { const tc = t.car, dd = M.dist(this.x, this.z, tc.x, tc.z); const behind = (this.x - tc.x) * tc.fwd[0] + (this.z - tc.z) * tc.fwd[1] < 0;
        if (dd < 16 && behind && (!POLICE.observe || POLICE.observe(this))) { const side = ((this.x - tc.x) * tc.right[0] + (this.z - tc.z) * tc.right[1]) >= 0 ? 1 : -1; px = tc.x - tc.fwd[0] * tc.spec.len * 0.3 + tc.right[0] * side * 0.9 + tc.vx * 0.25; pz = tc.z - tc.fwd[1] * tc.spec.len * 0.3 + tc.right[1] * side * 0.9 + tc.vz * 0.25; ai.pit = true; } else ai.pit = false; }
      const d = M.dist(this.x, this.z, px, pz);
      // Far away or out of sight, a pursuer drives the roads like traffic with its siren on: through red lights, at
      // pursuit speed, turning at every junction toward the target along the road graph. Aiming straight at the
      // target through the blocks is what used to pin cruisers against buildings, reversing and failing to arrive.
      if (this.pursueRoads(dt, px, pz, d)) return;
      const desired = Math.atan2(px - this.x, pz - this.z); const da = M.angleTo(this.angle, desired);
      c.handbrake = 0;
      if (ai.reverseT > 0) { ai.reverseT -= dt; c.throttle = 0; c.brake = 1; c.reverse = true; c.steer = M.clamp(-da * 2, -1, 1); return; } c.reverse = false;
      c.steer = M.clamp(da * 2.5, -1, 1);
      const stopDist = ai.pit ? 0 : t.car ? 3 : 7;
      if (d < stopDist) { c.throttle = 0; c.brake = 1; }
      else if (Math.abs(da) > 2.0 && this.speed < 3) { ai.reverseT = 1.0; }
      else { c.throttle = Math.abs(da) > 1.2 ? 0.5 : 1; c.brake = 0; if (Math.abs(da) > 0.7 && this.speed > 10) { c.throttle = 0; c.brake = 0.4; } if (Math.abs(da) > 1.0 && this.speed > 8) c.handbrake = 1; }
      if (this.speed < 0.6 && c.throttle > 0.5) { ai.stuck += dt; if (ai.stuck > 1.4) { ai.reverseT = 1.2; ai.stuck = 0; } } else ai.stuck = Math.max(0, ai.stuck - dt);
      // avoid piling into a car directly ahead when far from the target
      if (d > 12) { const f = this.fwd, r = this.right; for (const o of W.cars) { if (o === this || o.removed || this.y>=o.y+o.spec.hgt || this.y+this.spec.hgt<=o.y) continue; const dx = o.x - this.x, dz = o.z - this.z; if (dx * dx + dz * dz > 100) continue; const lf = dx * f[0] + dz * f[1], ll = dx * r[0] + dz * r[1]; if (lf > 0 && lf < 7 && Math.abs(ll) < 2.2) { c.steer += ll > 0 ? -0.8 : 0.8; c.throttle *= 0.6; } } }
    }
    pursueRoads(dt, px, pz, d) {
      const ai = this.ai; if (ai.surfacePath?.length || ai.reverseT > 0) { ai.roadMode = false; return false; }
      // Held up behind traffic at a light: try the other lane, then leave the road plan and go round directly for a while.
      if (ai.directT > 0) { ai.directT -= dt; if (ai.roadMode) { ai.roadMode = false; ai.edge = null; ai.path = null; } return false; }
      ai.heldT = ai.roadMode && this.absSpeed < 1.5 ? (ai.heldT || 0) + dt : 0;
      if (ai.heldT > 2 && !ai.laneTried) { ai.laneTried = true; ai.lane = 1 - ai.lane; ai.path = null; }
      if (ai.heldT > 4) { ai.heldT = 0; ai.laneTried = false; ai.directT = 4; ai.reverseT = 0.8; return false; }
      if (this.absSpeed > 6) ai.laneTried = false;
      const close = d < 38 && W.los(this.x, this.z, px, pz); if (close || d < 14) { if (ai.roadMode) { ai.roadMode = false; ai.edge = null; ai.path = null; } return false; }
      if (!ai.roadMode) { ai.roadMode = true; ai.edge = null; ai.path = null; ai.nextEdge = null; }
      ai.routeT = (ai.routeT || 0) - dt; if (ai.routeT <= 0 || !ai.routeDist) { ai.routeDist = roadDistances(px, pz); ai.routeT = 1.5; }
      if (ai.edge && (!ai.nextEdge || ai.nextEdge.from !== ai.edge.to)) { const e = ai.edge, opts = e.to.out.filter(o => o.to !== e.from); let best = null, bd = 1e9; for (const o of opts) { const v = (ai.routeDist.get(o.to) ?? 99) * 100 + M.dist(o.to.x, o.to.z, px, pz) * 0.2; if (v < bd) { bd = v; best = o; } } if (best) ai.forceDir = [best.dx, best.dz]; }
      const mode = ai.mode, scared = this.scared; ai.mode = 'flee'; ai.fleeSpeed = this.type === 'swat' ? 19 : 23; this.scared = 1; this.aiTraffic(dt); ai.mode = mode; this.scared = scared;
      this.controls.reverse = ai.reverseT > 0; return true;
    }
    // ---- AI: follow a list of waypoints (race rivals, mission cars)
    aiRoute(dt) {
      const ai = this.ai, c = this.controls; const pts = ai.route; if (!pts || !pts.length) { c.throttle = 0; c.brake = 1; return; }
      let p = pts[ai.routeIdx % pts.length]; const last = !ai.routeLoop && ai.routeIdx === pts.length - 1; if (last && M.dist(this.x, this.z, p[0], p[1]) < 18 && this.absSpeed < 1) { ai.stuckEnd = (ai.stuckEnd || 0) + dt; } if (M.dist(this.x, this.z, p[0], p[1]) < (p[2] || 7) || (ai.stuckEnd || 0) > 3) { ai.routeIdx++; if (!ai.routeLoop && ai.routeIdx >= pts.length) { ai.route = null; if (ai.onRouteEnd) ai.onRouteEnd(this); return; } p = pts[ai.routeIdx % pts.length]; }
      const desired = Math.atan2(p[0] - this.x, p[1] - this.z); const da = M.angleTo(this.angle, desired);
      if (ai.reverseT > 0) { ai.reverseT -= dt; c.throttle = 0; c.brake = 1; c.reverse = true; c.steer = M.clamp(-da * 2, -1, 1); return; } c.reverse = false;
      c.steer = M.clamp(da * 2.5, -1, 1); const maxS = ai.routeSpeed || 22; const want = Math.abs(da) > 0.5 ? 8 : maxS;
      if (this.speed < want) { c.throttle = 1; c.brake = 0; } else { c.throttle = 0; c.brake = 0.5; } c.handbrake = Math.abs(da) > 1.1 && this.speed > 9 ? 1 : 0;
      if (this.speed < 0.6 && c.throttle > 0.5) { ai.stuck += dt; if (ai.stuck > 1.4) { ai.reverseT = 1.2; ai.stuck = 0; } } else ai.stuck = Math.max(0, ai.stuck - dt);
    }

    // ---- Rendering
    entity(night) {
      const s = this.spec; const wr = s.wheelR; const half = s.len / 2;
      M.trsEuler(this.model, this.x, this.y + (this.wrecked ? -0.12 : 0), this.z, this.angle, this.pitch, this.roll);
      const wz = half * (s.bus ? 0.7 : 0.62), wx = s.wid / 2 - 0.05;
      const bx = s.track !== undefined ? s.track : s.bike ? 0 : wx; const wzF = s.axleF !== undefined ? s.axleF : wz, wzR = s.axleR !== undefined ? s.axleR : -wz; // imported models carry their own axle positions
      const door=MESH.doorSpec(s);if(door)for(let k=0;k<2;k++){const sign=k===0?1:-1;wheelBone(this.bones,(11+k)*16,sign*door.x,0,door.front,-sign*this.doors[k]*1.12,0);}
      const wheels = [[bx, wr, wzF, true], [-bx, wr, wzF, true], [bx, wr, wzR, false], [-bx, wr, wzR, false]];
      if (s.bike) wheelBone(this.bones, 10 * 16, 0, wr, wzF, this.steerAngle || 0, 0);
      if (!s.boat) for (let i = 0; i < 4; i++) { const [px, py, pz, front] = wheels[i]; const flat = this.condition.tyres[i]<=0; wheelBone(this.bones, (i + 1) * 16, px, flat ? py - wr * 0.18 : py, pz, front ? (this.steerAngle || 0) : 0, this.wheelRot, flat ? 0.82 : 1); }
      const e = this.emis; e.fill(0);
      if (!this.wrecked) {
        e[5] = this.lightsOn ? 1.0 : 0; e[6] = this.brakeLights ? 1.3 : (this.lightsOn ? 0.45 : 0);
        e[7] = night ? 1.2 : 0.2;
        if (this.siren) { const ph = Math.floor(this.sirenPhase) % 2; e[8] = ph ? 1.6 : 0.1; e[9] = ph ? 0.1 : 1.6; const k = 0.15 + 0.6 * RENDER.env.nightEmis; W.dyn.push({ x: this.x, y: this.y + 2, z: this.z, r: 16, col: ph ? [1.2 * k, 0.15 * k, 0.15 * k] : [0.15 * k, 0.3 * k, 1.2 * k] }); }
      }
      if (this.damageFlash > 0) { for (let i = 0; i < 5; i++) e[i] = 0.25; }
      const far = !this.wrecked && this.dentLevel === 0 && M.dist2(this.x, this.z, RENDER.cam.tx, RENDER.cam.tz) > 85 * 85; const lod = far ? getLod(this.type, this.colIdx) : null;
      return { mesh: lod ? lod.body : this.mesh, glass: lod ? lod.glass : this.meshes.glass, model: this.model, bones: this.bones, emis: e, spec: this.wrecked ? 0 : 0.25 };
    }
    headlightFX() { if (!this.lightsOn || this.wrecked) return; const f = this.fwd, r = this.right; const s = this.spec; const hx = this.x + f[0] * s.len * 0.5, hz = this.z + f[1] * s.len * 0.5; W.fx.lightPool(hx, hz, f[0], f[1], 16, 3.2, [1, 0.95, 0.75], 0.2); W.dyn.push({ x:hx+f[0]*.15, y:this.y+.8, z:hz+f[1]*.15, r:28, col:[2.8,2.5,1.9], dir:[f[0],-.10,f[1]], cone:.72, priority:this.driver===PLAYER?5:1 }); }
    remove() { this.releaseMeshes(); this.removed = true; if (this.driver && this.driver !== PLAYER) { this.driver.removed = true; } for (const p of this.passengers) p.removed = true; }
  }
  // Bone matrix rotating a wheel around its own axle: T(p) * Ry(yaw) * Rx(rot) * T(-p)
  function wheelBone(out, off, px, py, pz, yaw, rot, scale = 1) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(rot), sx = Math.sin(rot);
    // R = Ry * Rx (column-major entries)
    const k = scale; const r00 = cy * k, r01 = 0, r02 = -sy * k, r10 = sy * sx * k, r11 = cx * k, r12 = cy * sx * k, r20 = sy * cx * k, r21 = -sx * k, r22 = cy * cx * k;
    out[off + 0] = r00; out[off + 1] = r01; out[off + 2] = r02; out[off + 3] = 0;
    out[off + 4] = r10; out[off + 5] = r11; out[off + 6] = r12; out[off + 7] = 0;
    out[off + 8] = r20; out[off + 9] = r21; out[off + 10] = r22; out[off + 11] = 0;
    out[off + 12] = px - (r00 * px + r10 * py + r20 * pz); out[off + 13] = py - (r01 * px + r11 * py + r21 * pz); out[off + 14] = pz - (r02 * px + r12 * py + r22 * pz); out[off + 15] = 1;
  }

  // ---- Spawning
  function spawn(type, x, z, angle, opts = {}) { const v = new Vehicle(type, x, z, angle, opts); W.cars.push(v); return v; }
  // Each district drives something different: cabs and coupes downtown, hatchbacks and vans in the suburbs, muscle and pickups east, trucks by the docks.
  const DISTRICT_MIX = {
    downtown: ['sedan', 'sedan', 'taxi', 'taxi', 'taxi', 'sports', 'sports', 'hatch', 'bus', 'van', 'kambulance'],
    midtown: ['sedan', 'sedan', 'hatch', 'taxi', 'sports', 'pickup', 'van', 'bus', 'muscle', 'bike', 'kgarbage', 'kfire'],
    westfield: ['hatch', 'hatch', 'sedan', 'van', 'van', 'pickup', 'sedan', 'bus', 'ktruck', 'kmoto', 'kambulance'],
    eastside: ['muscle', 'muscle', 'pickup', 'pickup', 'sedan', 'hatch', 'van', 'truck', 'bike', 'kmoto', 'ktruck'],
    northgate: ['sedan', 'hatch', 'muscle', 'pickup', 'taxi', 'van', 'truck', 'ktruck', 'kgarbage'],
    southport: ['truck', 'truck', 'van', 'van', 'pickup', 'sedan', 'bus', 'taxi', 'bike', 'ktruck', 'kmoto'],
  };
  function trafficTypeFor(x, z) { const bl = CITY.blockAt(x, z); const d = bl ? CITY.district(bl.i, bl.j) : 'midtown'; const list = DISTRICT_MIX[d] || TRAFFIC_TYPES; const hour = W.state.time; let t = list[Math.floor(W.rng() * list.length)]; if ((hour < 6 || hour > 22) && W.rng() < 0.35) t = W.rng() < 0.6 ? 'taxi' : 'muscle'; /* night: cabs and cruisers */ return t; }
  function trim(px, pz, camYaw, want) {
    let count = 0; for (const c of W.cars) if (!c.removed && c.ai.mode === 'traffic') count++;
    if (count <= want + 2) return; let best = null, bd = 0;
    for (const c of W.cars) { if (c.removed || c.ai.mode !== 'traffic' || c.important || c.driver === PLAYER || c.playerOwned) continue; const d = M.dist(c.x, c.z, px, pz); if (d < 60) continue; const ang = Math.atan2(c.x - px, c.z - pz); if (d < 160 && Math.abs(M.angleTo(camYaw, ang)) < 1.0) continue; if (d > bd) { bd = d; best = c; } }
    if (best) { if (best.driver) best.driver.remove(); for (const q of best.passengers) q.remove(); best.remove(); }
  }
  function spawnTraffic(px, pz, camYaw, wantCount) {
    let count = 0; for (const c of W.cars) if (!c.removed && c.ai.mode === 'traffic') count++;
    if (count >= wantCount) return;
    for (let tries = 0; tries < 6; tries++) {
      const e = CITY.roadEdges[Math.floor(W.rng() * CITY.roadEdges.length)]; const L = CITY.laneLen(e); const s = W.rng() * (L - 10) + 5; const lane = W.rng() < 0.6 ? 0 : 1;
      const [x, z] = CITY.lanePoint(e, lane, s); const d = M.dist(x, z, px, pz);
      if (d < 55 || d > 190) continue;
      // don't spawn in front of the camera unless far
      const ang = Math.atan2(x - px, z - pz); if (d < 95 && Math.abs(M.angleTo(camYaw, ang)) < 0.9 && W.los(px, pz, x, z)) continue; // round a corner is fine
      let clear = true; for (const c of W.cars) if (!c.removed && M.dist2(c.x, c.z, x, z) < 100) { clear = false; break; } if (!clear) continue;
      const type = trafficTypeFor(x, z); const v = spawn(type, x, z, 0, { mode: 'traffic' }); v.placeOnLane(e, lane, s);
      v.driver = PEDS.spawnDriver(v); v.lightsOn = W.isNight();
      return v;
    }
  }
  // Hops from every road node to the node nearest (x, z), for pursuit routing: 144 nodes, so a breadth-first pass is cheap.
  function roadDistances(x, z) { const nodes = CITY.roadNodes; let goal = null, gd = 1e18; for (const n of nodes) { const d = M.dist2(n.x, n.z, x, z); if (d < gd) { gd = d; goal = n; } }
    if (!inbound) { inbound = new Map(); for (const n of nodes) for (const o of n.out) { if (!inbound.has(o.to)) inbound.set(o.to, []); inbound.get(o.to).push(n); } }
    const dist = new Map(); if (!goal) return dist; dist.set(goal, 0); const q = [goal]; for (let i = 0; i < q.length; i++) { const n = q[i], k = dist.get(n); for (const n2 of inbound.get(n) || []) if (!dist.has(n2)) { dist.set(n2, k + 1); q.push(n2); } } return dist; }
  let inbound = null;
  function despawn(px, pz) { for (const c of W.cars) { if (c.removed || c.important || c.persistent || c.owned || (PLAYER && (c === PLAYER.car || (PLAYER.P && c === PLAYER.P.lastCar)))) continue; /* cars you bought, and the one you left, stay where you parked them */ const d = M.dist(c.x, c.z, px, pz); if (d > 280 || (c.wrecked && d > 150 && c.fireT > 10)) c.remove(); } let w = 0; for (const c of W.cars) if (!c.removed) W.cars[w++] = c; W.cars.length = w; }
  function spawnMarina() { CITY.marina.forEach((m, i) => { const b = spawn('boat', m.x, m.z, m.angle, { mode: 'parked', color: [2, 9, 6][i % 3] }); b.persistent = true; }); }
  function spawnParked() { for (const p of CITY.parkedSpots) { const type = p.type || TRAFFIC_TYPES[Math.floor(W.rng() * TRAFFIC_TYPES.length)]; if (type === 'bus' || type === 'truck') continue; spawn(type, p.x, p.z, p.angle, { mode: 'parked' }); } }
  // ---- Kerb parking. About one kerb stretch in five has a car pulled up with two wheels on the pavement, clear of the
  // outer lane so traffic flows past. Slots come from a hash of their position (the seeded city is untouched) and are
  // filled only within 150 m of the player, at most 24 at a time, and emptied again beyond 190 m. A car you drive
  // off leaves its slot empty for ten minutes.
  let kerbSlots = null; const kerbCars = new Map(), kerbTaken = new Map();
  function buildKerbSlots() { kerbSlots = []; const off = CITY.HALF_ROAD + 0.6 - (CITY.LANE * 1.5); /* from the outer lane's centre to two wheels up on the kerb: 2.35 m, so a car in the outer lane passes with room to spare */
    for (const e of CITY.roadEdges) { const L = CITY.laneLen(e); for (let s = 12, k = 0; s < L - 12; s += 6.2, k++) {
      const h = Math.abs(Math.sin(e.from.x * 12.9898 + e.from.z * 78.233 + e.dx * 37.7 + e.dz * 91.3 + k * 17.17) * 43758.5453) % 1; if (h > 0.2) continue;
      const [lx, lz] = CITY.lanePoint(e, 1, s); const x = lx + e.rx * off, z = lz + e.rz * off;
      if (CITY.insideLot(x, z) || W.solidPropsNear(x, z, 3).some(p => M.dist2(p.x, p.z, x, z) < 3.2 * 3.2) || (typeof STREETS !== 'undefined' && CITY.blockAt(x - e.rx * 4, z - e.rz * 4)?.quarter)) continue;
      kerbSlots.push({ key: kerbSlots.length, x, z, angle: Math.atan2(e.dx, e.dz), h }); } } }
  function streamKerb(px, pz) {
    if (!kerbSlots) buildKerbSlots(); const now = W.state.elapsed;
    for (const [key, c] of kerbCars) { if (c.removed || c.driver || c.playerOwned || c.ai.mode !== 'parked') { kerbCars.delete(key); if (!c.removed) kerbTaken.set(key, now); continue; } if (M.dist2(c.x, c.z, px, pz) > 190 * 190) { c.remove(); kerbCars.delete(key); } }
    if (kerbCars.size >= 24) return; const near = [];
    for (const s of kerbSlots) { if (kerbCars.has(s.key) || (kerbTaken.has(s.key) && now - kerbTaken.get(s.key) < 600)) continue; const d = M.dist2(s.x, s.z, px, pz); if (d < 150 * 150 && d > 30 * 30) near.push([d, s]); } // not right beside the player: they appear beyond the corner, never out of thin air
    near.sort((a, b) => a[0] - b[0]);
    for (const [, s] of near) { if (kerbCars.size >= 24) break; if (W.cars.some(o => !o.removed && M.dist2(o.x, o.z, s.x, s.z) < 16)) continue; const type = TRAFFIC_TYPES[Math.floor(s.h * 5 * TRAFFIC_TYPES.length) % TRAFFIC_TYPES.length]; if (type === 'bus' || type === 'truck') continue;
      const c = spawn(type, s.x, s.z, s.angle, { mode: 'parked', color: Math.floor(s.h * 97) % PALETTE.length }); c.kerb = true; kerbCars.set(s.key, c); } }
  function nearest(x, z, r, filter) { let best = null, bd = r * r; for (const c of W.cars) { if (c.removed || (filter && !filter(c))) continue; const d = M.dist2(c.x, c.z, x, z); if (d < bd) { bd = d; best = c; } } return best; }
  // Traffic far from the camera runs at a third of the rate with three times the step. All distant cars move on the
  // same frame, so they still see each other consistently; anything the player is near, or involved in, runs every frame.
  const FAR2 = 95 * 95;
  function updateAll(dt, night) {
    const cam = RENDER.cam; const cx = cam.tx, cz = cam.tz; const phase = W.state.frame % 3;
    for (const c of W.cars) {
      if (c.removed) continue;
      c.lightsOn = night && !c.wrecked && (c.driver !== null || c.ai.mode !== 'parked' || c.playerOwned);
      const dx = c.x - cx, dz = c.z - cz;
      const far = dx * dx + dz * dz > FAR2 && c.driver !== PLAYER && !c.important && c.ai.mode !== 'chase' && !c.wrecked && !c.airborne;
      if (far) { if (phase === 0) c.update(dt * 3); } else c.update(dt);
    }
  }
  return { Vehicle, SPECS, NAMES, PALETTE, TRAFFIC_TYPES, trafficTypeFor, trim, spawn, spawnTraffic, despawn, spawnParked, spawnMarina, streamKerb, get kerbSlots() { return kerbSlots; }, kerbCars, nearest, updateAll, getMesh };
})();
