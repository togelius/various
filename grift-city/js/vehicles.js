// GRIFT CITY — vehicles: arcade physics, collisions, damage, and the driving AI (traffic, chase, flee).
'use strict';
const VEH = (() => {
  const SPECS = MESH.VEHICLES;
  const NAMES = { sedan: 'MERIDIAN', sports: 'FALCATA', hatch: 'GNAT', pickup: 'MULE', van: 'BOXER', taxi: 'CABCO', police: 'ENFORCER', truck: 'HAULER', bus: 'TRANSIT', muscle: 'BRAWLER', swat: 'BASTION' };
  const PALETTE = [[0.85, 0.12, 0.1], [0.12, 0.22, 0.6], [0.92, 0.92, 0.9], [0.15, 0.15, 0.17], [0.62, 0.62, 0.66], [0.1, 0.48, 0.25], [0.9, 0.6, 0.12], [0.45, 0.12, 0.5], [0.7, 0.35, 0.15], [0.2, 0.6, 0.7], [0.55, 0.05, 0.1], [0.75, 0.75, 0.5]];
  const FIXED = { taxi: [1, 0.8, 0.1], police: [0.95, 0.95, 0.98], swat: [0.16, 0.18, 0.22], bus: [0.85, 0.55, 0.15] };
  const meshCache = {};
  function getMesh(type, colIdx) { const key = type + ':' + colIdx; if (!meshCache[key]) { const col = colIdx === 'wreck' ? [0.07, 0.07, 0.07] : FIXED[type] || PALETTE[colIdx]; meshCache[key] = MESH.carMesh(type, col).build(); } return meshCache[key]; }
  const TRAFFIC_TYPES = ['sedan', 'sedan', 'sedan', 'hatch', 'hatch', 'sports', 'pickup', 'van', 'taxi', 'taxi', 'muscle', 'truck', 'bus'];

  const tmpV = [0, 0, 0];
  class Vehicle {
    constructor(type, x, z, angle, opts = {}) {
      this.type = type; this.spec = SPECS[type]; this.name = NAMES[type];
      this.x = x; this.z = z; this.y = CITY.groundY(x, z); this.vy = 0; this.angle = angle; this.vx = 0; this.vz = 0; this.speed = 0; this.lat = 0;
      this.steer = 0; this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
      this.colIdx = opts.color !== undefined ? opts.color : Math.floor(W.rng() * PALETTE.length); this.mesh = getMesh(type, this.colIdx);
      this.maxHealth = this.spec.armor ? 2600 : 1000 * this.spec.mass; this.health = this.maxHealth; this.wrecked = false; this.fireT = 0;
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
      const s = this.spec, f = this.fwd, r = s.wid / 2 + 0.1; const L = s.len;
      if (L > 6.5) return [[this.x + f[0] * L * 0.36, this.z + f[1] * L * 0.36, r], [this.x, this.z, r], [this.x - f[0] * L * 0.36, this.z - f[1] * L * 0.36, r]];
      return [[this.x + f[0] * L * 0.26, this.z + f[1] * L * 0.26, r], [this.x - f[0] * L * 0.26, this.z - f[1] * L * 0.26, r]];
    }
    local(px, pz) { const f = this.fwd, r = this.right; const dx = px - this.x, dz = pz - this.z; return [dx * f[0] + dz * f[1], dx * r[0] + dz * r[1]]; }
    get absSpeed() { return Math.hypot(this.vx, this.vz); }

    update(dt) {
      if (this.removed) return; this.age += dt; if (this.damageFlash > 0) this.damageFlash -= dt;
      if (!this.wrecked) { if (this.ai.mode === 'traffic' || this.ai.mode === 'flee') this.aiTraffic(dt); else if (this.ai.mode === 'chase') this.aiChase(dt); else if (this.ai.mode === 'parked' && !this.driver) { this.controls.throttle = 0; this.controls.brake = this.absSpeed > 0.2 ? 0.5 : 0; this.controls.steer = 0; } else if (this.ai.mode === 'route') this.aiRoute(dt); }
      else { this.controls.throttle = 0; this.controls.brake = 1; this.controls.steer = 0; }
      this.physics(dt);
      if (this.scared > 0) this.scared -= dt;
      if (this.horn > 0) this.horn -= dt;
      // fire & smoke
      const hf = this.health / this.maxHealth;
      if (!this.wrecked && hf < 0.35 && W.state.frame % 3 === 0) { const f = this.fwd; W.FX.smoke(this.x + f[0] * this.spec.len * 0.4, this.y + 1, this.z + f[1] * this.spec.len * 0.4, 1, hf < 0.15); }
      if (!this.wrecked && hf < 0.25 && this.driver && this.driver !== PLAYER && !this.driver.isCop && this.ai.mode !== 'chase' && this.absSpeed < 6) { const d = this.driver; d.exitCar(); d.state = 'flee'; d.fear = 12; d.threat = [this.x, this.z]; d.say(W.rng() < 0.5 ? "It's going to blow!" : 'Get away from it!'); this.ai.mode = 'parked'; for (const q of this.passengers.slice()) { q.exitCar(); q.scare(this.x, this.z); } }
      if (!this.wrecked && hf < 0.12) { this.fireT += dt; const f = this.fwd; if (W.state.frame % 2 === 0) W.FX.fire(this.x + f[0] * this.spec.len * 0.4, this.y + 1, this.z + f[1] * this.spec.len * 0.4, 1); if (this.fireT > 5) this.explode(); }
      if (this.wrecked && this.fireT < 10) { this.fireT += dt; if (W.state.frame % 2 === 0) { W.FX.fire(this.x, this.y + 0.8, this.z, 1); if (W.state.frame % 4 === 0) W.FX.smoke(this.x, this.y + 1, this.z, 1, true); } }
    }
    physics(dt) {
      const s = this.spec, c = this.controls; const f = this.fwd, r = this.right;
      let vF = this.vx * f[0] + this.vz * f[1], vL = this.vx * r[0] + this.vz * r[1];
      const top = s.top;
      // steering
      const steerRate = 5;
      this.steer = M.approach(this.steer, M.clamp(c.steer, -1, 1), steerRate * dt);
      // engine
      if (!this.wrecked && (this.driver || this.ai.mode !== 'parked')) {
        if (c.throttle > 0 && !this.airborne) { const k = Math.max(0.15, 1 - Math.max(0, vF) / top); vF += s.accel * k * c.throttle * dt; }
        if (c.brake > 0 && !this.airborne) { if (vF > 0.3) vF = Math.max(0, vF - s.brake * c.brake * dt); else vF = Math.max(-top * 0.35, vF - s.accel * 0.6 * c.brake * dt); }
      }
      // resistances
      if (!this.airborne) { const roll = 1.2 + (c.handbrake ? 6 : 0); vF = M.approach(vF, 0, roll * dt); vF -= vF * Math.abs(vF) * 0.0035 * dt; }
      // lateral grip
      const gripK = c.handbrake ? 1.8 : (7 + 6 * s.grip); const latMax = Math.abs(vL);
      vL -= vL * Math.min(1, gripK * dt);
      this.skid = latMax > 3.5 || (c.handbrake && Math.abs(vF) > 6);
      // yaw
      const speedK = M.clamp(Math.abs(vF) / 7, 0, 1) * (1 - 0.45 * M.clamp(Math.abs(vF) / top, 0, 1));
      let yawRate = this.steer * s.turn * speedK * (vF < -0.2 ? -1 : 1);
      if (c.handbrake && Math.abs(vF) > 4) yawRate *= 1.6;
      if (!this.airborne) this.angle += yawRate * dt;
      const nf = this.fwd, nr = this.right;
      this.vx = nf[0] * vF + nr[0] * vL; this.vz = nf[1] * vF + nr[1] * vL; this.speed = vF; this.lat = vL;
      this.x += this.vx * dt; this.z += this.vz * dt;
      // vertical
      const g = CITY.groundY(this.x, this.z);
      if (this.airborne) {
        this.vy -= 22 * dt; this.y += this.vy * dt; this.airT += dt;
        if (this.y <= g) { this.y = g; const impact = -this.vy; this.airborne = false; this.vy = 0; if (impact > 9) { this.damage(impact * 6, null); AUDIO.play('crash', this.x, this.z, impact / 15); W.FX.dust(this.x, g, this.z, 10); } this.landed = this.airT; this.airT = 0; }
      } else {
        const dy = g - this.y;
        if (dy < -0.35 && Math.abs(vF) > 3) { this.airborne = true; this.vy = Math.max(this.slopeVy || 0, 0); this.y += this.vy * dt; } // the ground fell away: launch with the slope's vertical speed
        else { this.slopeVy = M.clamp(dy / Math.max(dt, 0.001), -30, 30); if (dy > 0.3) this.slopeVy = 0; this.vy = 0; this.y = g; }
      }
      // cosmetic body pitch and roll
      const acc = c.throttle * s.accel * 0.006 - (c.brake > 0 && vF > 1 ? 0.03 : 0);
      this.pitch = M.lerp(this.pitch, this.airborne ? -Math.atan2(this.vy, Math.max(Math.abs(vF), 3)) * 0.5 : -acc, 8 * dt);
      this.roll = M.lerp(this.roll, M.clamp(vL * 0.012 + this.steer * Math.abs(vF) * 0.0025, -0.12, 0.12), 8 * dt);
      this.wheelRot += vF / s.wheelR * dt;
      // skid marks from the rear wheels
      if (this.skid && !this.airborne && !this.wrecked) { const rr = this.right, ff = this.fwd; const wz = s.len * 0.31, wx = s.wid / 2 - 0.15; for (const sign of [1, -1]) { const x1 = this.x - ff[0] * wz + rr[0] * wx * sign, z1 = this.z - ff[1] * wz + rr[1] * wx * sign; const key = sign > 0 ? 'skidL' : 'skidR'; const prev = this[key]; if (prev && M.dist2(prev[0], prev[1], x1, z1) < 9) W.decal('skid', prev[0], prev[1], x1, z1, 0.32, [0.05, 0.05, 0.05], 0.55); this[key] = [x1, z1]; } } else { this.skidL = this.skidR = null; }
      this.brakeLights = c.brake > 0.1 && vF > 0.5;
      this.collide(dt);
      this.wasAir = this.airborne;
    }
    collide(dt) {
      const s = this.spec; const f = this.fwd; const half = s.len / 2;
      // buildings & props: each circle
      for (const [cx, cz, r] of this.circles()) {
        const res = W.pushOut(cx, cz, r, { ignoreLow: this.y > 1.4 });
        if (res.hit) {
          const nx = res.hit[0], nz = res.hit[1];
          if (res.hit.prop) { const p = res.hit.prop; const spd = this.absSpeed; if ((p.kind === 'lamppost' || p.kind === 'hydrant' || p.kind === 'bin' || p.kind === 'trafficLight' || p.kind === 'bollard') && spd > 3) { W.knockProp(p, this.vx / spd, this.vz / spd); this.vx *= 0.8; this.vz *= 0.8; this.damage(spd * 2, null); AUDIO.play('bump', this.x, this.z); if (p.kind === 'hydrant') { for (let i = 0; i < 40; i++) W.particle(p.x, 0.5, p.z, (W.rng() - 0.5) * 2, 8 + W.rng() * 6, (W.rng() - 0.5) * 2, 1.2, 0.5, [0.7, 0.85, 1], 0.8, { grav: 12, grow: 1 }); p.ref.hydrantT = 30; } continue; } }
          const dx = res.x - cx, dz = res.z - cz; this.x += dx; this.z += dz;
          const vn = this.vx * nx + this.vz * nz;
          if (vn < 0) {
            const impact = -vn; this.vx -= vn * nx * 1.15; this.vz -= vn * nz * 1.15;
            // scrape: slow down along the wall, rotate away
            this.vx *= 0.9; this.vz *= 0.9;
            const front = (cx - this.x) * f[0] + (cz - this.z) * f[1] > 0; const side = (nx * f[1] - nz * f[0]); // which side the wall is on
            this.angle += (front ? -1 : 1) * Math.sign(side || 1) * Math.min(impact * 0.03, 0.15) * (this.speed < 0 ? -1 : 1);
            if (impact > 3) { this.damage(impact * impact * 0.9, null); AUDIO.play('crash', this.x, this.z, impact / 12); W.FX.spark(cx + nx * -r, 0.6, cz + nz * -r, Math.min(12, impact * 2)); if (impact > 6) W.FX.glass(cx, 1.2, cz, 6); this.ai.stuck += 0.5; }
          }
        }
      }
      // other cars
      for (const o of W.cars) {
        if (o === this || o.removed) continue; if (M.dist2(this.x, this.z, o.x, o.z) > 144) continue;
        for (const [ax, az, ar] of this.circles()) for (const [bx, bz, br] of o.circles()) {
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
            if (impact > 2.5) {
              const dmg = impact * impact * 0.7; this.damage(dmg * (mB / mA), o); o.damage(dmg * (mA / mB), this);
              AUDIO.play('crash', ax, az, impact / 10); W.FX.spark(ax - nx * ar, 0.7, az - nz * ar, Math.min(14, impact * 2)); if (impact > 7) W.FX.glass(ax, 1.2, az, 8);
              if (o.ai.mode === 'traffic' && !o.driverIsPlayer()) { o.scared = 4; o.ai.mode = 'flee'; o.fleeFrom = this; } if (this.ai.mode === 'traffic' && !this.driverIsPlayer()) { this.ai.honk = 1; }
              W.noise(ax, az, 30, 'crash');
            }
          }
        }
      }
      // pedestrians
      const spd = this.absSpeed;
      if (spd > 1.5) for (const p of W.peds) {
        if (p.removed || p.inCar || p.state === 'dead') continue; if (M.dist2(this.x, this.z, p.x, p.z) > (half + 2) * (half + 2)) continue;
        const [lf, ll] = this.local(p.x, p.z); if (Math.abs(lf) < half + 0.4 && Math.abs(ll) < s.wid / 2 + 0.35) { p.hitByCar(this, spd); }
      }
    }
    driverIsPlayer() { return this.driver === PLAYER; }
    damage(amount, source) {
      if (this.wrecked) return; this.health -= amount; this.damageFlash = 0.15; if (source && source !== this) this.lastHitBy = source;
      if (this.ai.mode === 'traffic' && amount > 30) { this.scared = 6; this.ai.mode = 'flee'; }
      if (this.health <= 0) this.explode();
    }
    explode() {
      if (this.wrecked) return; this.wrecked = true; this.health = 0; this.fireT = 0; this.mesh = getMesh(this.type, 'wreck'); this.siren = false; this.lightsOn = false;
      W.FX.explosion(this.x, this.y + 0.5, this.z, this.spec.len > 6 ? 1.6 : 1); AUDIO.play('explosion', this.x, this.z); W.noise(this.x, this.z, 120, 'explosion');
      this.vy = 4; this.airborne = true; this.y += 0.05;
      const killer = this.lastHitBy;
      for (const p of W.peds) { if (p.removed || p.state === 'dead') continue; const d = M.dist(p.x, p.z, this.x, this.z); if (p.inCar === this) { p.die(killer, 'explosion'); } else if (d < 7) { p.die(killer, 'explosion'); p.launch((p.x - this.x) / d * 6, 5, (p.z - this.z) / d * 6); } else if (d < 40) p.scare(this.x, this.z); }
      if (this.driver && this.driver !== PLAYER) { this.driver.inCar = null; this.driver = null; }
      for (const c of W.cars) { if (c === this || c.removed) continue; const d = M.dist(c.x, c.z, this.x, this.z); if (d < 9) { c.lastHitBy = killer; c.damage(320 * (1 - d / 9) + 60, this); const k = (9 - d) * 1.2; c.vx += (c.x - this.x) / (d + 0.1) * k; c.vz += (c.z - this.z) / (d + 0.1) * k; c.vy = 3; c.airborne = true; } }
      if (PLAYER && PLAYER.alive) { const d = M.dist(PLAYER.x, PLAYER.z, this.x, this.z); if (PLAYER.car === this) PLAYER.hurt(300, 'explosion', killer); else if (d < 9) { PLAYER.hurt(110 * (1 - d / 9), 'explosion', killer); PLAYER.knock((PLAYER.x - this.x) / (d + 0.1) * 6, 5, (PLAYER.z - this.z) / (d + 0.1) * 6); } }
      if (killer === PLAYER || (killer && killer.driver === PLAYER)) POLICE.crime('explosion', this.x, this.z, this);
      if (this.onExplode) this.onExplode();
    }

    // ---- AI: traffic
    placeOnLane(edge, lane, s) { this.ai.edge = edge; this.ai.lane = lane; this.ai.path = null; const [px, pz] = CITY.lanePoint(edge, lane, s); this.x = px; this.z = pz; this.angle = Math.atan2(edge.dx, edge.dz); this.y = CITY.groundY(px, pz); const f = this.fwd; const v = this.ai.cruise * 0.8; this.vx = f[0] * v; this.vz = f[1] * v; }
    laneS() { const e = this.ai.edge; const [sx, sz] = CITY.lanePoint(e, this.ai.lane, 0); return (this.x - sx) * e.dx + (this.z - sz) * e.dz; }
    aiTraffic(dt) {
      const ai = this.ai, c = this.controls;
      if (!ai.edge) { const nl = CITY.nearestLane(this.x, this.z, this.fwd[0], this.fwd[1]); if (!nl) return; ai.edge = nl.e; ai.lane = nl.k; ai.path = null; }
      const e = ai.edge; const L = CITY.laneLen(e); let s = this.laneS();
      let tx, tz; const look = 4 + Math.abs(this.speed) * 0.45; let turning = false;
      if (ai.path) {
        const p = ai.path[ai.pathIdx]; if (M.dist(this.x, this.z, p[0], p[1]) < 2.8) { ai.pathIdx++; if (ai.pathIdx >= ai.path.length) { ai.path = null; ai.edge = ai.nextEdge; s = this.laneS(); } }
        if (ai.path) { const p = ai.path[Math.min(ai.pathIdx, ai.path.length - 1)]; tx = p[0]; tz = p[1]; turning = true; }
      }
      if (!ai.path) {
        if (s >= L - 1.5) { this.chooseNext(); const p = ai.path[0]; tx = p[0]; tz = p[1]; turning = true; }
        else { [tx, tz] = CITY.lanePoint(e, ai.lane, s + look); }
      }
      // steering toward the target
      const desired = Math.atan2(tx - this.x, tz - this.z); const da = M.angleTo(this.angle, desired);
      c.steer = M.clamp(da * 2.2, -1, 1);
      // target speed
      let target = ai.mode === 'flee' ? (ai.fleeSpeed || 24) : ai.cruise;
      if (turning && ai.turnKind !== 'straight') target = Math.min(target, 7);
      if (Math.abs(da) > 0.6) target = Math.min(target, 5);
      // traffic light
      if (ai.mode !== 'flee' && !ai.path) {
        const light = W.lightFor(e.to); const remain = L - s;
        if (light && remain < 14 && remain > 1) { const st = W.lightState(light, e.axis); if (st === 'red' || (st === 'yellow' && remain > 7)) { if (remain < 3.5) target = 0; else target = Math.min(target, Math.max(0, (remain - 3) * 1.5)); ai.atLight = true; } else ai.atLight = false; } else ai.atLight = false;
      }
      // obstacles ahead
      const f = this.fwd, r = this.right; let blocked = false, blockSpeed = 99; const reach = 5 + Math.abs(this.speed) * 1.0;
      for (const o of W.cars) { if (o === this || o.removed) continue; const dx = o.x - this.x, dz = o.z - this.z; if (dx * dx + dz * dz > (reach + 8) * (reach + 8)) continue; const lf = dx * f[0] + dz * f[1], ll = dx * r[0] + dz * r[1]; const half = o.spec.len / 2; if (lf > 0 && lf - half < reach && Math.abs(ll) < 2.4) { const os = o.vx * f[0] + o.vz * f[1]; const gap = lf - half - this.spec.len / 2; if (gap < 3) { target = 0; blocked = true; } else target = Math.min(target, Math.max(0, os + (gap - 3) * 0.8)); blockSpeed = Math.min(blockSpeed, Math.abs(os)); } }
      if (ai.mode !== 'flee') {
        for (const p of W.peds) { if (p.removed || p.inCar || p.state === 'dead') continue; const dx = p.x - this.x, dz = p.z - this.z; if (dx * dx + dz * dz > 400) continue; const lf = dx * f[0] + dz * f[1], ll = dx * r[0] + dz * r[1]; if (lf > 0 && lf < reach + 2 && Math.abs(ll) < 1.8) { target = lf < 5 ? 0 : Math.min(target, 3); blocked = blocked || lf < 5; } }
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
      if (ai.reverseT > 0) { ai.reverseT -= dt; c.throttle = 0; c.brake = 1; c.steer = -c.steer; }
      else if (target > 2 && Math.abs(sp) < 0.3 && !blocked && !ai.atLight) { ai.stuck += dt; if (ai.stuck > 2.5) { ai.reverseT = 1.2; ai.stuck = 0; } } else ai.stuck = Math.max(0, ai.stuck - dt);
      if (ai.mode === 'flee' && this.scared <= 0) ai.mode = 'traffic';
    }
    chooseNext() {
      const ai = this.ai, e = ai.edge; const node = e.to; let opts = node.out.filter(o => o.to !== e.from); if (!opts.length) opts = node.out;
      const straight = opts.find(o => o.dx === e.dx && o.dz === e.dz);
      let next = (straight && W.rng() < 0.55) ? straight : opts[Math.floor(W.rng() * opts.length)];
      if (ai.forceDir) { const f = opts.find(o => o.dx === ai.forceDir[0] && o.dz === ai.forceDir[1]); if (f) next = f; ai.forceDir = null; }
      const lane = ai.lane; const [p0x, p0z] = CITY.lanePoint(e, lane, CITY.laneLen(e)); const [p3x, p3z] = CITY.lanePoint(next, lane, 0);
      const kind = next === straight ? 'straight' : 'turn'; ai.turnKind = kind;
      const path = [];
      if (kind === 'straight') { path.push([p3x, p3z]); }
      else { const proj = (p3x - p0x) * e.dx + (p3z - p0z) * e.dz; const cx = p0x + e.dx * proj, cz = p0z + e.dz * proj; for (let k = 1; k <= 6; k++) { const t = k / 6; const u = 1 - t; path.push([u * u * p0x + 2 * u * t * cx + t * t * p3x, u * u * p0z + 2 * u * t * cz + t * t * p3z]); } }
      path.push(CITY.lanePoint(next, lane, 3));
      ai.path = path; ai.pathIdx = 0; ai.nextEdge = next;
    }
    // ---- AI: chase a target (the player) — road-agnostic pursuit with reversing when stuck.
    aiChase(dt) {
      const ai = this.ai, c = this.controls; const t = ai.target || PLAYER; if (!t) return;
      const tv = t.car ? [t.car.vx, t.car.vz] : [0, 0]; const px = t.x + tv[0] * 0.6, pz = t.z + tv[1] * 0.6;
      const d = M.dist(this.x, this.z, px, pz); const desired = Math.atan2(px - this.x, pz - this.z); const da = M.angleTo(this.angle, desired);
      c.handbrake = 0;
      if (ai.reverseT > 0) { ai.reverseT -= dt; c.throttle = 0; c.brake = 1; c.steer = M.clamp(-da * 2, -1, 1); return; }
      c.steer = M.clamp(da * 2.5, -1, 1);
      const stopDist = t.car ? 3 : 7;
      if (d < stopDist) { c.throttle = 0; c.brake = 1; }
      else if (Math.abs(da) > 2.0 && this.speed < 3) { ai.reverseT = 1.0; }
      else { c.throttle = Math.abs(da) > 1.2 ? 0.5 : 1; c.brake = 0; if (Math.abs(da) > 0.7 && this.speed > 10) { c.throttle = 0; c.brake = 0.4; } if (Math.abs(da) > 1.0 && this.speed > 8) c.handbrake = 1; }
      if (this.speed < 0.6 && c.throttle > 0.5) { ai.stuck += dt; if (ai.stuck > 1.4) { ai.reverseT = 1.2; ai.stuck = 0; } } else ai.stuck = Math.max(0, ai.stuck - dt);
      // avoid piling into a car directly ahead when far from the target
      if (d > 12) { const f = this.fwd, r = this.right; for (const o of W.cars) { if (o === this || o.removed) continue; const dx = o.x - this.x, dz = o.z - this.z; if (dx * dx + dz * dz > 100) continue; const lf = dx * f[0] + dz * f[1], ll = dx * r[0] + dz * r[1]; if (lf > 0 && lf < 7 && Math.abs(ll) < 2.2) { c.steer += ll > 0 ? -0.8 : 0.8; c.throttle *= 0.6; } } }
    }
    // ---- AI: follow a list of waypoints (race rivals, mission cars)
    aiRoute(dt) {
      const ai = this.ai, c = this.controls; const pts = ai.route; if (!pts || !pts.length) { c.throttle = 0; c.brake = 1; return; }
      let p = pts[ai.routeIdx % pts.length]; if (M.dist(this.x, this.z, p[0], p[1]) < (p[2] || 7)) { ai.routeIdx++; if (!ai.routeLoop && ai.routeIdx >= pts.length) { ai.route = null; if (ai.onRouteEnd) ai.onRouteEnd(this); return; } p = pts[ai.routeIdx % pts.length]; }
      const desired = Math.atan2(p[0] - this.x, p[1] - this.z); const da = M.angleTo(this.angle, desired);
      if (ai.reverseT > 0) { ai.reverseT -= dt; c.throttle = 0; c.brake = 1; c.steer = M.clamp(-da * 2, -1, 1); return; }
      c.steer = M.clamp(da * 2.5, -1, 1); const maxS = ai.routeSpeed || 22; const want = Math.abs(da) > 0.5 ? 8 : maxS;
      if (this.speed < want) { c.throttle = 1; c.brake = 0; } else { c.throttle = 0; c.brake = 0.5; } c.handbrake = Math.abs(da) > 1.1 && this.speed > 9 ? 1 : 0;
      if (this.speed < 0.6 && c.throttle > 0.5) { ai.stuck += dt; if (ai.stuck > 1.4) { ai.reverseT = 1.2; ai.stuck = 0; } } else ai.stuck = Math.max(0, ai.stuck - dt);
    }

    // ---- Rendering
    entity(night) {
      const s = this.spec; const wr = s.wheelR; const half = s.len / 2;
      M.trsEuler(this.model, this.x, this.y + (this.wrecked ? -0.12 : 0), this.z, this.angle, this.pitch, this.roll);
      const wz = half * (s.bus ? 0.7 : 0.62), wx = s.wid / 2 - 0.05;
      const wheels = [[wx, wr, wz, true], [-wx, wr, wz, true], [wx, wr, -wz, false], [-wx, wr, -wz, false]];
      for (let i = 0; i < 4; i++) { const [px, py, pz, front] = wheels[i]; wheelBone(this.bones, (i + 1) * 16, px, py, pz, front ? this.steer * 0.55 : 0, this.wheelRot); }
      const e = this.emis; e.fill(0);
      if (!this.wrecked) {
        e[5] = this.lightsOn ? 1.0 : 0; e[6] = this.brakeLights ? 1.3 : (this.lightsOn ? 0.45 : 0);
        e[7] = night ? 1.2 : 0.2;
        if (this.siren) { this.sirenPhase += 0.25; const ph = Math.floor(this.sirenPhase) % 2; e[8] = ph ? 1.6 : 0.1; e[9] = ph ? 0.1 : 1.6; const k = 0.15 + 0.6 * RENDER.env.nightEmis; W.dyn.push({ x: this.x, y: this.y + 2, z: this.z, r: 16, col: ph ? [1.2 * k, 0.15 * k, 0.15 * k] : [0.15 * k, 0.3 * k, 1.2 * k] }); }
      }
      if (this.damageFlash > 0) { for (let i = 0; i < 5; i++) e[i] = 0.25; }
      return { mesh: this.mesh, model: this.model, bones: this.bones, emis: e, spec: this.wrecked ? 0 : 0.6 };
    }
    headlightFX() { if (!this.lightsOn || this.wrecked) return; const f = this.fwd, r = this.right; const s = this.spec; const hx = this.x + f[0] * s.len * 0.5, hz = this.z + f[1] * s.len * 0.5; W.fx.lightPool(hx, hz, f[0], f[1], 16, 3.2, [1, 0.95, 0.75], 0.32); W.dyn.push({ x: hx + f[0] * 5, y: 1, z: hz + f[1] * 5, r: 13, col: [0.9, 0.85, 0.65] }); }
    remove() { this.removed = true; if (this.driver && this.driver !== PLAYER) { this.driver.removed = true; } for (const p of this.passengers) p.removed = true; }
  }
  // Bone matrix rotating a wheel around its own axle: T(p) * Ry(yaw) * Rx(rot) * T(-p)
  function wheelBone(out, off, px, py, pz, yaw, rot) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(rot), sx = Math.sin(rot);
    // R = Ry * Rx (column-major entries)
    const r00 = cy, r01 = 0, r02 = -sy, r10 = sy * sx, r11 = cx, r12 = cy * sx, r20 = sy * cx, r21 = -sx, r22 = cy * cx;
    out[off + 0] = r00; out[off + 1] = r01; out[off + 2] = r02; out[off + 3] = 0;
    out[off + 4] = r10; out[off + 5] = r11; out[off + 6] = r12; out[off + 7] = 0;
    out[off + 8] = r20; out[off + 9] = r21; out[off + 10] = r22; out[off + 11] = 0;
    out[off + 12] = px - (r00 * px + r10 * py + r20 * pz); out[off + 13] = py - (r01 * px + r11 * py + r21 * pz); out[off + 14] = pz - (r02 * px + r12 * py + r22 * pz); out[off + 15] = 1;
  }

  // ---- Spawning
  function spawn(type, x, z, angle, opts = {}) { const v = new Vehicle(type, x, z, angle, opts); W.cars.push(v); return v; }
  function spawnTraffic(px, pz, camYaw, wantCount) {
    let count = 0; for (const c of W.cars) if (!c.removed && c.ai.mode === 'traffic') count++;
    if (count >= wantCount) return;
    for (let tries = 0; tries < 6; tries++) {
      const e = CITY.roadEdges[Math.floor(W.rng() * CITY.roadEdges.length)]; const L = CITY.laneLen(e); const s = W.rng() * (L - 10) + 5; const lane = W.rng() < 0.6 ? 0 : 1;
      const [x, z] = CITY.lanePoint(e, lane, s); const d = M.dist(x, z, px, pz);
      if (d < 70 || d > 190) continue;
      // don't spawn in front of the camera unless far
      const ang = Math.atan2(x - px, z - pz); if (d < 140 && Math.abs(M.angleTo(camYaw, ang)) < 0.9) continue;
      let clear = true; for (const c of W.cars) if (!c.removed && M.dist2(c.x, c.z, x, z) < 100) { clear = false; break; } if (!clear) continue;
      const type = TRAFFIC_TYPES[Math.floor(W.rng() * TRAFFIC_TYPES.length)]; const v = spawn(type, x, z, 0, { mode: 'traffic' }); v.placeOnLane(e, lane, s);
      v.driver = PEDS.spawnDriver(v); v.lightsOn = W.isNight();
      return v;
    }
  }
  function despawn(px, pz) { for (const c of W.cars) { if (c.removed || c.important || c === (PLAYER && PLAYER.car)) continue; const d = M.dist(c.x, c.z, px, pz); if (d > 280 || (c.wrecked && d > 150 && c.fireT > 10)) c.remove(); } let w = 0; for (const c of W.cars) if (!c.removed) W.cars[w++] = c; W.cars.length = w; }
  function spawnParked() { for (const p of CITY.parkedSpots) { const type = p.type || TRAFFIC_TYPES[Math.floor(W.rng() * TRAFFIC_TYPES.length)]; if (type === 'bus' || type === 'truck') continue; spawn(type, p.x, p.z, p.angle, { mode: 'parked' }); } }
  function nearest(x, z, r, filter) { let best = null, bd = r * r; for (const c of W.cars) { if (c.removed || (filter && !filter(c))) continue; const d = M.dist2(c.x, c.z, x, z); if (d < bd) { bd = d; best = c; } } return best; }
  function updateAll(dt, night) { for (const c of W.cars) { if (c.removed) continue; c.lightsOn = night && !c.wrecked && (c.driver !== null || c.ai.mode !== 'parked' || c.playerOwned) ; c.update(dt); } }
  return { Vehicle, SPECS, NAMES, PALETTE, TRAFFIC_TYPES, spawn, spawnTraffic, despawn, spawnParked, nearest, updateAll, getMesh };
})();
