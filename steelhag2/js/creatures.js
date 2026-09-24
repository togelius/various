// STÅLHAGEN II — rigs and behaviour. Every moving thing is boxes and cylinders on a bone tree: the kid, the little
// machine 04 and its scout siblings, and the bearer. Bones are posed in code every frame; a bearer's bones are also
// its current graph, so a cut at a joint darkens and drops everything below it.
'use strict';

// Aim a bone: origin at (ox,oy,oz), local +y along dir, local x chosen against a hint.
function aimMatrix(out, ox, oy, oz, dx, dy, dz, hx = 0, hy = 0, hz = 1) {
  const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
  let xx = hy * dz - hz * dy, xy = hz * dx - hx * dz, xz = hx * dy - hy * dx; let xl = Math.hypot(xx, xy, xz);
  if (xl < 1e-4) { xx = 1; xy = 0; xz = 0; xl = 1; } xx /= xl; xy /= xl; xz /= xl;
  const zx = xy * dz - xz * dy, zy = xz * dx - xx * dz, zz = xx * dy - xy * dx;
  out[0] = xx; out[1] = xy; out[2] = xz; out[3] = 0; out[4] = dx; out[5] = dy; out[6] = dz; out[7] = 0; out[8] = zx; out[9] = zy; out[10] = zz; out[11] = 0; out[12] = ox; out[13] = oy; out[14] = oz; out[15] = 1;
  return out;
}
// Two-link IK: hip H, target F, lengths a and b, knee pushed toward hint direction. Writes the knee into K.
function ik2(H, F, a, b, hint, K) {
  let dx = F[0] - H[0], dy = F[1] - H[1], dz = F[2] - H[2]; let d = Math.hypot(dx, dy, dz);
  const maxD = a + b - 0.01; if (d > maxD) { const k = maxD / d; dx *= k; dy *= k; dz *= k; d = maxD; } if (d < 1e-4) d = 1e-4;
  const ux = dx / d, uy = dy / d, uz = dz / d;
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  // perpendicular toward the hint
  let px = hint[0] - (hint[0] * ux + hint[1] * uy + hint[2] * uz) * ux, py = hint[1] - (hint[0] * ux + hint[1] * uy + hint[2] * uz) * uy, pz = hint[2] - (hint[0] * ux + hint[1] * uy + hint[2] * uz) * uz;
  let pl = Math.hypot(px, py, pz); if (pl < 1e-4) { px = 0; py = 1; pz = 0; pl = 1; } px /= pl; py /= pl; pz /= pl;
  K[0] = H[0] + ux * a * cosA + px * a * sinA; K[1] = H[1] + uy * a * cosA + py * a * sinA; K[2] = H[2] + uz * a * cosA + pz * a * sinA;
  return K;
}

// ---------------------------------------------------------------- the machine rig
// Bones: 0 body, 1 head, 2 LED, 3 antenna, 4 lamp, 5..12 legs (FL upper/lower, FR, BL, BR), 13..16 arms, 17 cradle.
const RIG = { BODY: 0, HEAD: 1, LED: 2, ANT: 3, LAMP: 4, LEG: 5, ARM: 13, CRADLE: 17, N: 18 };
function buildMachineMesh(s, o = {}) {
  const b = new Builder(), c = [1, 1, 1];
  // body: an instrument case with an orange stripe and a darker base band
  b.bone = RIG.BODY; b.tile = MAT.BEIGE; b.col = c; b.box(-0.55 * s, -0.22 * s, -0.35 * s, 1.1 * s, 0.5 * s, 0.7 * s, { uv: 0.8 / s });
  b.tile = MAT.FLAT; b.col = [0.84, 0.47, 0.18]; b.box(-0.551 * s, 0.0 * s, -0.351 * s, 1.102 * s, 0.06 * s, 0.702 * s);
  b.col = [0.63, 0.6, 0.53]; b.box(-0.551 * s, -0.22 * s, -0.351 * s, 1.102 * s, 0.08 * s, 0.702 * s);
  // head on a short neck at the front; the LED is its own bone so it can go dark
  b.bone = RIG.HEAD; b.tile = MAT.BEIGE; b.col = c; b.box(-0.08 * s, -0.04 * s, -0.14 * s, 0.34 * s, 0.26 * s, 0.28 * s, { uv: 0.8 / s });
  b.tile = MAT.DARK; b.box(0.26 * s, 0.0 * s, -0.09 * s, 0.02 * s, 0.14 * s, 0.18 * s);
  b.bone = RIG.LED; b.tile = MAT.LED; b.col = c; b.box(0.27 * s, 0.05 * s, -0.03 * s, 0.03 * s, 0.05 * s, 0.06 * s);
  b.bone = RIG.ANT; b.tile = MAT.DARK; b.cyl(0, 0, 0, 0.012 * s, 0.45 * s, { segs: 4 }); b.tile = MAT.LED; b.col = [1, 0.55, 0.35]; b.sphere(0, 0.46 * s, 0, 0.03 * s, { segs: 6, rings: 4 });
  // the work lamp on the head's side, dark until it decides to come
  b.bone = RIG.LAMP; b.tile = MAT.DARK; b.col = c; b.box(-0.06 * s, -0.06 * s, -0.06 * s, 0.12 * s, 0.12 * s, 0.12 * s); b.tile = MAT.GLASS; b.col = [1, 0.75, 0.45]; b.box(0.06 * s, -0.045 * s, -0.045 * s, 0.02 * s, 0.09 * s, 0.09 * s);
  // legs: upper and lower segments along +y from the joint
  for (let l = 0; l < 4; l++) {
    b.bone = RIG.LEG + l * 2; b.tile = MAT.DARK; b.col = c; b.cyl(0, 0, 0, 0.045 * s, o.upper, { segs: 6 }); b.sphere(0, 0, 0, 0.06 * s, { segs: 6, rings: 4 });
    b.bone = RIG.LEG + l * 2 + 1; b.cyl(0, 0, 0, 0.035 * s, o.lower, { segs: 6 }); b.sphere(0, 0, 0, 0.05 * s, { segs: 6, rings: 4 }); b.tile = MAT.STEEL; b.cyl(0, o.lower - 0.03 * s, 0, 0.09 * s, 0.04 * s, { segs: 6 });
  }
  if (o.arms) for (let a = 0; a < 2; a++) {
    b.bone = RIG.ARM + a * 2; b.tile = MAT.DARK; b.col = c; b.cyl(0, 0, 0, 0.035 * s, o.armLen, { segs: 6 }); b.sphere(0, 0, 0, 0.05 * s, { segs: 6, rings: 4 });
    b.bone = RIG.ARM + a * 2 + 1; b.cyl(0, 0, 0, 0.03 * s, o.armLen, { segs: 6 }); b.tile = MAT.STEEL; b.box(-0.05 * s, o.armLen - 0.02 * s, -0.02 * s, 0.1 * s, 0.14 * s, 0.04 * s); b.box(-0.05 * s, o.armLen - 0.02 * s, 0.02 * s, 0.1 * s, 0.14 * s, 0.04 * s);
  }
  if (o.cradle) { b.bone = RIG.CRADLE; b.tile = MAT.STEEL; b.col = c; for (const z of [-0.28, 0, 0.28]) { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([(-0.5 + t) * s, (0.28 + Math.sin(t * Math.PI) * 0.32) * s, z * s]); } b.tube(pts, 0.02 * s, { segs: 5 }); } for (const x of [-0.45, 0.45]) b.tube([[x * s, 0.28 * s, -0.3 * s], [x * s, 0.28 * s, 0.3 * s]], 0.02 * s, { segs: 5 }); }
  return b.build();
}
// The current graph: which bones hang from which. Cutting a bone darkens and drops its subtree.
const PARENT = [-1, 0, 1, 0, 1, 0, 5, 0, 7, 0, 9, 0, 11, 0, 13, 0, 15, 0];
function subtree(k) { const out = [k]; for (let i = 0; i < RIG.N; i++) if (PARENT[i] >= 0 && out.includes(PARENT[i]) && !out.includes(i)) out.push(i); return out; }

class Machine {
  constructor(kind, x, z, yaw, opts = {}) {
    this.kind = kind; // 'scout' | 'bearer'
    const s = this.s = kind === 'bearer' ? 1 : 0.42;
    this.upper = 0.58 * s; this.lower = 0.62 * s; this.armLen = 0.36 * s;
    this.mesh = opts.mesh || buildMachineMesh(s, { upper: this.upper, lower: this.lower, armLen: this.armLen, arms: kind === 'bearer', cradle: kind === 'bearer' });
    this.x = x; this.z = z; this.y = World.groundY(x, z); this.yaw = yaw; this.vx = 0; this.vz = 0; this.speed = 0;
    this.bones = new Float32Array(RENDER.MAX_BONES * 16); this.fx = new Float32Array(RENDER.MAX_BONES * 4);
    for (let i = 0; i < RENDER.MAX_BONES; i++) this.bones.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], i * 16);
    this.item = { mesh: this.mesh, model: M.create(), bones: this.bones, fx: this.fx, x, y: this.y, z, radius: 2.5 * s, hidden: !!opts.hidden, machine: this };
    this.hidden = !!opts.hidden; this.hopOnly = kind === 'scout';
    this.bodyH = 0.95 * s; this.hips = [[0.42, 0.28], [0.42, -0.28], [-0.42, 0.28], [-0.42, -0.28]].map(([fx, fz]) => [fx * s, fz * s]);
    this.feet = this.hips.map(([fx, fz]) => { const wx = x + Math.cos(yaw) * fx - Math.sin(yaw) * fz * 1.3, wz = z + Math.sin(yaw) * fx + Math.cos(yaw) * fz * 1.3; return { x: wx, y: World.groundY(wx, wz), z: wz, step: 0, fromX: wx, fromZ: wz, toX: wx, toZ: wz }; });
    this.t = 0; this.blink = 0; this.look = { x: 0, y: 0, z: 1 }; this.lookT = 0; this.headYaw = 0; this.headPitch = 0;
    this.led = true; this.lamp = false; this.antSpring = 0; this.antVel = 0;
    this.state = 'idle'; this.calm = 0; this.notice = 0; this.hold = 0; this.stepT = 0; this.beepT = 4; this.off = false; this.kneel = 0;
    this.cut = new Set(); this.charge = 1; this.dark = 0; this.chunks = []; this.armsOpen = 0; this.lift = 0; this.hop = null; this.post = { x, z };
    this.onSound = null; this.pose();
  }
  say(kind, v = 1) { if (this.onSound) this.onSound(kind, this.x, this.y + 1, this.z, v); }
  legOk(l) { return !this.cut.has(RIG.LEG + l * 2) && !this.cut.has(RIG.LEG + l * 2 + 1); }
  legsLeft() { let n = 0; for (let l = 0; l < 4; l++) if (this.legOk(l)) n++; return n; }

  // ---- locomotion: a body that moves and feet that catch up one at a time
  move(dt, dirX, dirZ, speed) {
    const legs = this.legsLeft(); if (legs === 0) speed *= 0.25; else if (legs < 4) speed *= 0.4 + 0.15 * legs;
    if (this.hopOnly) return this.hopMove(dt, dirX, dirZ, speed);
    this.x += dirX * speed * dt; this.z += dirZ * speed * dt; this.speed = speed;
    if (speed > 0.01) this.yaw = lerp(this.yaw, Math.atan2(dirX, dirZ) === 0 ? this.yaw : this.yaw + M.angleTo(this.yaw, Math.atan2(dirX, dirZ)), 1 - Math.pow(0.02, dt));
    // find the most overdue foot on a free diagonal
    let stepping = 0; for (const f of this.feet) if (f.step > 0) stepping++;
    if (stepping < 2) {
      let worst = -1, wd = 0.22 * this.s;
      for (let l = 0; l < 4; l++) {
        const f = this.feet[l]; if (f.step > 0 || !this.legOk(l)) continue;
        const [hx, hz] = this.hipWorld(l), ahead = 0.25 * this.s * Math.min(1, speed / 0.35);
        const rx = hx + dirX * ahead, rz = hz + dirZ * ahead, d = Math.hypot(f.x - rx, f.z - rz);
        const pair = this.feet[l ^ 3]; // the diagonal partner
        if (d > wd && pair.step === 0) { wd = d; worst = l; }
      }
      if (worst >= 0) { const f = this.feet[worst], [hx, hz] = this.hipWorld(worst); f.step = 0.001; f.fromX = f.x; f.fromZ = f.z; f.toX = hx + dirX * 0.35 * this.s; f.toZ = hz + dirZ * 0.35 * this.s; }
    }
    for (let l = 0; l < 4; l++) {
      const f = this.feet[l]; if (f.step <= 0) continue;
      f.step += dt / 0.32; const u = Math.min(1, f.step);
      f.x = lerp(f.fromX, f.toX, u); f.z = lerp(f.fromZ, f.toZ, u); f.y = World.groundY(f.x, f.z) + Math.sin(u * Math.PI) * 0.12 * this.s;
      if (u >= 1) { f.step = 0; f.y = World.groundY(f.x, f.z); this.say('step', 0.5); }
    }
    this.y = World.groundY(this.x, this.z);
  }
  hopMove(dt, dirX, dirZ, speed) {
    if (!this.hop) {
      if (speed > 0.01) { const len = 0.9 * this.s * 2.2; this.hop = { t: 0, d: 0.42, fx: this.x, fz: this.z, tx: this.x + dirX * len, tz: this.z + dirZ * len, h: 0.35 }; this.yaw = Math.atan2(dirX, dirZ); this.say('hop', 0.4); }
      else { this.speed = 0; return; }
    }
    const h = this.hop; h.t += dt; const u = Math.min(1, h.t / h.d);
    this.x = lerp(h.fx, h.tx, u); this.z = lerp(h.fz, h.tz, u); this.y = World.groundY(this.x, this.z) + Math.sin(u * Math.PI) * h.h; this.speed = speed;
    for (const f of this.feet) { f.x = lerp(f.x, this.x + (f.toX - h.fx), 0.5); }
    if (u >= 1) { this.hop = null; this.y = World.groundY(this.x, this.z); for (let l = 0; l < 4; l++) { const [hx, hz] = this.hipWorld(l); const f = this.feet[l]; f.x = hx; f.z = hz; f.y = World.groundY(hx, hz); } }
  }
  hipWorld(l) { const [fx, fz] = this.hips[l]; const c = Math.cos(this.yaw), s = Math.sin(this.yaw); return [this.x + c * fx + s * fz * 1.3, this.z - s * fx + c * fz * 1.3]; }
  lookAt(px, py, pz) { this.look.x = px; this.look.y = py; this.look.z = pz; }

  // ---- pose: write every bone
  pose() {
    const B = this.bones, s = this.s, c = Math.cos(this.yaw), sn = Math.sin(this.yaw);
    // body height from the feet, with a kneel and a lift
    let fy = 0, n = 0; for (let l = 0; l < 4; l++) if (this.legOk(l)) { fy += this.feet[l].y; n++; }
    const base = n ? fy / n : World.groundY(this.x, this.z);
    const bodyY = base + this.bodyH * (1 - this.kneel * 0.55) * (this.legsLeft() ? 1 : 0.35) + (this.hop ? this.y - World.groundY(this.x, this.z) : 0);
    const bob = this.speed > 0.05 && !this.hop ? Math.sin(this.t * 9) * 0.012 * s : 0;
    const pitch = this.kneel * 0.15;
    M.trsEuler(B.subarray(0, 16), this.x, bodyY + bob, this.z, this.yaw, pitch, 0);
    const bx = this.x, by = bodyY + bob, bz = this.z;
    // head: at the front, turned toward what it watches
    const hx = bx + c * 0.55 * s, hz = bz - sn * 0.55 * s, hy = by + 0.12 * s;
    const dx = this.look.x - hx, dy = this.look.y - hy, dz = this.look.z - hz;
    const wantYaw = M.angleTo(this.yaw, Math.atan2(dx, dz)), wantPitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.7, 0.5);
    this.headYaw = lerp(this.headYaw, clamp(wantYaw, -1.1, 1.1), 0.08); this.headPitch = lerp(this.headPitch, wantPitch, 0.08);
    M.trsEuler(B.subarray(16, 32), hx, hy, hz, this.yaw + this.headYaw, -this.headPitch, 0);
    B.set(B.subarray(16, 32), 32); // the LED rides the head
    // antenna at the back, springy
    M.trsEuler(B.subarray(48, 64), bx - c * 0.45 * s, by + 0.28 * s, bz + sn * 0.45 * s, this.yaw, 0, this.antSpring);
    // lamp on the head's side
    const hm = B.subarray(16, 32); M.trsEuler(B.subarray(64, 80), hm[12] + hm[8] * 0.2 * s + hm[0] * 0.05 * s, hm[13] + hm[5] * 0.16 * s, hm[14] + hm[10] * 0.2 * s + hm[2] * 0.05 * s, this.yaw + this.headYaw, -this.headPitch, 0);
    // legs by IK
    const K = [0, 0, 0];
    for (let l = 0; l < 4; l++) {
      const [hxw, hzw] = this.hipWorld(l), H = [hxw, by - 0.1 * s, hzw], f = this.feet[l];
      const F = this.legsLeft() ? [f.x, f.y, f.z] : [hxw, by - 0.3 * s, hzw];
      const side = this.hips[l][1] > 0 ? 1 : -1;
      ik2(H, F, this.upper, this.lower, [c * (this.hips[l][0] > 0 ? 1 : -1) * 0.6, 0.6, -sn * (this.hips[l][0] > 0 ? 1 : -1) * 0.6], K);
      aimMatrix(B.subarray((RIG.LEG + l * 2) * 16, (RIG.LEG + l * 2) * 16 + 16), H[0], H[1], H[2], K[0] - H[0], K[1] - H[1], K[2] - H[2], side * sn, 0, side * c);
      aimMatrix(B.subarray((RIG.LEG + l * 2 + 1) * 16, (RIG.LEG + l * 2 + 1) * 16 + 16), K[0], K[1], K[2], F[0] - K[0], F[1] - K[1], F[2] - K[2], side * sn, 0, side * c);
    }
    // arms folded under the chin, opening toward the player in the standoff or the lift
    if (this.kind === 'bearer') {
      for (let a = 0; a < 2; a++) {
        const side = a ? 1 : -1, open = this.armsOpen;
        const S0 = [hx - c * 0.1 * s + sn * side * 0.18 * s, hy - 0.16 * s, hz + sn * 0.1 * s + c * side * 0.18 * s];
        const reach = 0.25 + open * 0.75, drop = lerp(-0.2, 0.05, open);
        const E = [S0[0] + c * reach * this.armLen * 1.2 + sn * side * lerp(0.05, 0.25, open) * s, S0[1] + drop * s, S0[2] - sn * reach * this.armLen * 1.2 + c * side * lerp(0.05, 0.25, open) * s];
        ik2(S0, E, this.armLen, this.armLen, [0, -1, 0], K);
        aimMatrix(B.subarray((RIG.ARM + a * 2) * 16, (RIG.ARM + a * 2) * 16 + 16), S0[0], S0[1], S0[2], K[0] - S0[0], K[1] - S0[1], K[2] - S0[2], sn * side, 0, c * side);
        aimMatrix(B.subarray((RIG.ARM + a * 2 + 1) * 16, (RIG.ARM + a * 2 + 1) * 16 + 16), K[0], K[1], K[2], E[0] - K[0], E[1] - K[1], E[2] - K[2], sn * side, 0, c * side);
      }
      B.set(B.subarray(0, 16), RIG.CRADLE * 16);
    }
    // charge and hidden flags
    for (let i = 0; i < RIG.N; i++) { const o = i * 4; this.fx[o] = this.dark ? 0 : this.charge * (i === RIG.BODY || i === RIG.HEAD || i === RIG.CRADLE ? 0.8 : 0); this.fx[o + 1] = this.cut.has(i) ? 1 : 0; }
    if (!this.led) this.fx[RIG.LED * 4 + 1] = 1;
    if (this.kind !== 'bearer') { this.fx[RIG.LAMP * 4 + 1] = 1; for (let i = RIG.ARM; i < RIG.N; i++) this.fx[i * 4 + 1] = 1; }
    else if (!this.lamp) this.fx[RIG.LAMP * 4 + 1] = 1;
    for (const k of this.cut) for (const j of subtree(k)) this.fx[j * 4 + 1] = 1;
    this.item.x = this.x; this.item.y = bodyY; this.item.z = this.z;
    this.headWorld = [hm[12] + hm[0] * 0.28 * s, hm[13] + hm[5] * 0.05 * s, hm[14] + hm[2] * 0.28 * s];
    this.lampWorld = [B[64 + 12], B[64 + 13], B[64 + 14], B[64 + 0], B[64 + 1], B[64 + 2]];
  }
  // joint positions the cutter can reach: [bone, x, y, z, name]
  joints() {
    const out = [], B = this.bones;
    const at = (bone, name) => { if (!this.cut.has(bone) && !subtreeCut(this, bone)) out.push([bone, B[bone * 16 + 12], B[bone * 16 + 13], B[bone * 16 + 14], name]); };
    for (let l = 0; l < 4; l++) { at(RIG.LEG + l * 2, 'the hip'); at(RIG.LEG + l * 2 + 1, 'the knee'); }
    if (this.kind === 'bearer') { for (let a = 0; a < 2; a++) at(RIG.ARM + a * 2, 'the shoulder'); at(RIG.HEAD, 'the neck'); out.push([RIG.BODY, B[12] + B[4] * -0.2 * this.s, B[13] - 0.2 * this.s, B[14] + B[6] * -0.2 * this.s, 'the belly seam']); }
    return out;
    function subtreeCut(m, bone) { let p = PARENT[bone]; while (p >= 0) { if (m.cut.has(p)) return true; p = PARENT[p]; } return false; }
  }
  // the loud route: sever at a bone. The belly darkens the whole machine.
  sever(bone) {
    if (bone === RIG.BODY) { this.dark = 1; this.state = 'dying'; this.stateT = 0; this.say('dark'); return; }
    if (this.cut.has(bone)) return;
    this.cut.add(bone); this.say('cut');
    // the part falls: the same mesh, drawn with only this subtree, on a rigid body
    const sub = subtree(bone), fx = new Float32Array(RENDER.MAX_BONES * 4); for (let i = 0; i < RENDER.MAX_BONES; i++) fx[i * 4 + 1] = sub.includes(i) ? 0 : 1;
    const bones = new Float32Array(this.bones), B = this.bones;
    this.chunks.push({ item: { mesh: this.mesh, model: M.create(), bones, fx, x: B[bone * 16 + 12], y: B[bone * 16 + 13], z: B[bone * 16 + 14], radius: 1.5 }, vy: 0.4, vx: (Math.random() - 0.5) * 0.6, vz: (Math.random() - 0.5) * 0.6, spin: (Math.random() - 0.5) * 3, t: 0, base: [B[bone * 16 + 12], B[bone * 16 + 13], B[bone * 16 + 14]] });
    if (this.legsLeft() === 0 && this.kind === 'bearer') this.armsOpen = 0.6;
  }
  updateChunks(dt) {
    for (const ch of this.chunks) {
      if (ch.t > 30) continue; ch.t += dt; ch.vy -= 9.8 * dt;
      const g = World.groundY(ch.base[0], ch.base[2]) + 0.05; ch.base[1] += ch.vy * dt; ch.base[0] += ch.vx * dt; ch.base[2] += ch.vz * dt;
      if (ch.base[1] < g) { ch.base[1] = g; ch.vy = 0; ch.vx *= 0.5; ch.vz *= 0.5; ch.spin *= 0.6; }
      const a = ch.spin * Math.min(ch.t, 1.2); const m = ch.item.model; M.trsEuler(m, ch.base[0] - ch.item.x, ch.base[1] - ch.item.y, ch.base[2] - ch.item.z, 0, a * 0.5, a);
      // rotate about the joint: model = T(joint) R T(-joint)
      const c = Math.cos(a), s = Math.sin(a), jx = ch.item.x, jy = ch.item.y, jz = ch.item.z;
      m.set([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); m[12] = jx - (c * jx + s * jz) + (ch.base[0] - jx); m[13] = jy - jy + (ch.base[1] - jy); m[14] = jz - (-s * jx + c * jz) + (ch.base[2] - jz);
    }
  }

  // ---- behaviour
  update(dt, player, ctx) {
    this.t += dt;
    this.blink = Math.sin(this.t * (this.state === 'approach' ? 5 : 2.5)) > 0.2 ? 1 : 0;
    this.antVel += (-this.antSpring * 40 - this.antVel * 3) * dt + (this.speed > 0.05 ? (Math.random() - 0.5) * 0.4 * dt : 0); this.antSpring += this.antVel * dt;
    this.updateChunks(dt);
    const px = player.x, pz = player.z, py = player.y, dx = px - this.x, dz = pz - this.z, d = Math.hypot(dx, dz);
    const still = player.speed < 0.08 && !player.torch && !player.cutterUp;
    if (this.dark) {
      this.stateT = (this.stateT || 0) + dt; this.charge = Math.max(0, this.charge - dt * 0.6); this.speed = 0;
      this.lookAt(px, py + 1.2, pz);
      if (this.stateT > 3 && this.led) { this.led = false; this.lamp = false; this.say('off'); }
      this.kneel = Math.min(1, this.kneel + dt * 0.5); this.pose(); return;
    }
    if (this.off) { this.kneel = Math.min(1, this.kneel + dt * 0.6); this.speed = 0; this.pose(); return; }
    if (this.kind === 'scout') return this.updateScout(dt, player, ctx);
    // --- the bearer
    this.lookAt(px, py + 1.3, pz);
    if (this.state === 'lift') {
      this.lift += dt; this.armsOpen = 1; this.speed = 0; this.lookAt(px, py + 1.0, pz);
      if (this.lift > 6 && ctx.onCarried) { ctx.onCarried(this); this.state = 'idle'; this.lift = 0; this.armsOpen = 0; }
      this.pose(); return;
    }
    // calm: rises while you hold still without light or sound, falls with every step
    if (d < 40) {
      if (still) this.calm = Math.min(ctx.calmCeiling, this.calm + 0.06 * dt);
      else this.calm = Math.max(0, this.calm - (player.speed > 0.5 ? 0.14 : 0.06) * dt - (player.torch ? 0.25 * dt : 0));
    }
    const stopDist = 0.8 + 5.2 * (1 - Math.min(this.calm, ctx.calmCeiling));
    this.beepT -= dt;
    if (this.state === 'idle') {
      this.speed = 0;
      if (d < 26 && ctx.awake) { this.notice += dt; if (this.notice > 1.2) { this.state = 'approach'; this.notice = 0; this.lamp = true; this.say('lamp'); this.say('beep'); this.beepT = 6; } }
      else this.notice = Math.max(0, this.notice - dt);
    } else if (this.state === 'approach' || this.state === 'wait') {
      if (this.beepT < 0) { this.say('beep'); this.beepT = 6; }
      if (d > stopDist + 0.15 && d < 45) {
        // a look every six seconds: it stops, then comes on
        this.lookPause = (this.lookPause || 0) + dt;
        if (this.lookPause % 6 < 0.7) { this.speed = 0; this.state = 'wait'; }
        else { this.state = 'approach'; this.move(dt, dx / d, dz / d, 0.35); }
      } else { this.speed = 0; this.state = 'wait'; }
      if (d < 1.15 && still) this.state = 'standoff';
      if (d > 45) { this.state = 'idle'; this.lamp = false; }
      // walking away: it follows at a quarter of your speed only if it has waited, and loses you at 30 m
      if (player.speed > 0.5 && d > stopDist + 2 && d < 30) this.move(dt, dx / d, dz / d, 0.35);
    } else if (this.state === 'standoff') {
      this.speed = 0;
      // the head turns to your hand; the arms twitch open at one second of the hold
      this.armsOpen = lerp(this.armsOpen, player.hold > 1.0 ? 0.35 : 0.15, 1 - Math.pow(0.05, dt));
      if (player.hold > 0) this.lookAt(player.handWorld[0], player.handWorld[1], player.handWorld[2]);
      if (player.hold >= 2.0) { this.off = true; this.led = false; this.lamp = false; this.state = 'off'; this.say('off'); if (ctx.onSwitchedOff) ctx.onSwitchedOff(this); }
      else if (player.flinch) { this.state = 'lift'; this.lift = 0; this.say('lift'); if (ctx.onLift) ctx.onLift(this); }
      else if (player.hold <= 0 && (d > 1.6 || !still)) { this.state = 'wait'; }
    }
    this.pose();
  }
  // the scout: hops ahead to its next mark when you come close, looks back at you, comes to see why if you stand still
  updateScout(dt, player, ctx) {
    const px = player.x, pz = player.z, dx = px - this.x, dz = pz - this.z, d = Math.hypot(dx, dz);
    this.lookAt(px, player.y + 1.2, pz);
    const marks = this.marks || []; this.mi = this.mi || 0;
    if (this.hop) { this.hopMove(dt, 0, 0, 1); this.pose(); return; }
    this.beepT -= dt;
    if (this.mi < marks.length && d < 9 && !this.paused) {
      const m = marks[this.mi], mx = m[0] - this.x, mz = m[1] - this.z, md = Math.hypot(mx, mz);
      if (md < 0.6) { this.mi++; this.say('beep', 0.7); this.beepT = 5; }
      else { this.pathT = (this.pathT || 0) + dt; if (this.pathT > 0.35) { this.pathT = 0; this.hopMove(dt, mx / md, mz / md, 1); } }
    } else {
      this.speed = 0;
      if (this.beepT < 0 && d > 14) { this.say('beep', 0.4); this.beepT = 5 + Math.random() * 3; }
      // if you stand still a while, it comes back to see why
      this.stillT = player.speed < 0.08 ? (this.stillT || 0) + dt : 0;
      if (this.stillT > 5 && d > 4 && d < 30) { const nd = Math.max(0.1, d - 2.5); this.pathT = (this.pathT || 0) + dt; if (this.pathT > 0.35) { this.pathT = 0; this.hopMove(dt, dx / d, dz / d, 1); } if (d < 3) this.stillT = 0; }
    }
    this.pose();
  }
}

// ---------------------------------------------------------------- the kid
// Bones: 0 hips, 1 torso, 2 head, 3-6 legs (L upper/lower, R), 7-10 arms (L upper/lower, R), 11 pack.
const KID = { HIPS: 0, TORSO: 1, HEAD: 2, LEG: 3, ARM: 7, PACK: 11, N: 12 };
function buildKidMesh() {
  const b = new Builder();
  // hips and jeans
  b.bone = KID.HIPS; b.tile = MAT.FLAT; b.col = [0.2, 0.26, 0.36]; b.box(-0.17, -0.1, -0.11, 0.34, 0.22, 0.22);
  // the parka: a soft box with a hood, in the same orange
  b.bone = KID.TORSO; b.col = [0.79, 0.33, 0.16]; b.box(-0.2, 0, -0.14, 0.4, 0.5, 0.28); b.box(-0.22, 0.48, -0.15, 0.44, 0.06, 0.3);
  b.col = [0.55, 0.22, 0.12]; b.box(-0.005, 0.02, -0.15, 0.01, 0.46, 0.005);
  // head with the yellow hat and the pompom, and the head torch on the hat's front
  b.bone = KID.HEAD; b.col = [0.9, 0.74, 0.62]; b.box(-0.09, 0.02, -0.09, 0.18, 0.2, 0.18);
  b.col = [0.89, 0.75, 0.27]; b.box(-0.1, 0.16, -0.1, 0.2, 0.12, 0.2); b.sphere(0, 0.31, 0, 0.035, { segs: 6, rings: 4 });
  b.tile = MAT.DARK; b.col = [1, 1, 1]; b.box(-0.03, 0.18, 0.1, 0.06, 0.05, 0.03);
  b.tile = MAT.GLASS; b.col = [1, 0.9, 0.7]; b.box(-0.02, 0.185, 0.13, 0.04, 0.04, 0.005);
  // legs: jeans, then boots
  for (let l = 0; l < 2; l++) {
    b.bone = KID.LEG + l * 2; b.tile = MAT.FLAT; b.col = [0.2, 0.26, 0.36]; b.cyl(0, 0, 0, 0.065, 0.42, { segs: 6 });
    b.bone = KID.LEG + l * 2 + 1; b.cyl(0, 0, 0, 0.055, 0.4, { segs: 6 }); b.col = [0.17, 0.15, 0.13]; b.box(-0.06, 0.34, -0.06, 0.12, 0.08, 0.2);
  }
  for (let a = 0; a < 2; a++) {
    b.bone = KID.ARM + a * 2; b.col = [0.79, 0.33, 0.16]; b.cyl(0, 0, 0, 0.05, 0.28, { segs: 6 });
    b.bone = KID.ARM + a * 2 + 1; b.cyl(0, 0, 0, 0.045, 0.26, { segs: 6 }); b.col = [0.17, 0.23, 0.29]; b.sphere(0, 0.28, 0, 0.05, { segs: 6, rings: 4 });
  }
  b.bone = KID.PACK; b.col = [0.24, 0.36, 0.44]; b.box(-0.15, 0, -0.12, 0.3, 0.42, 0.14);
  return b.build();
}
class Kid {
  constructor() {
    this.mesh = buildKidMesh(); this.bones = new Float32Array(RENDER.MAX_BONES * 16); this.fx = new Float32Array(RENDER.MAX_BONES * 4);
    for (let i = 0; i < RENDER.MAX_BONES; i++) this.bones.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], i * 16);
    this.item = { mesh: this.mesh, model: M.create(), bones: this.bones, fx: this.fx, radius: 1.2, x: 0, y: 0, z: 0 };
    this.phase = 0; this.hand = [0, 0, 0]; this.bob = 0;
  }
  // x,y,z feet; yaw facing; run 0..1; reach 0..1 (the right arm out); carried (lying on its back, held up)
  pose(x, y, z, yaw, run, dt, reach = 0, carried = 0, torchOn = false) {
    const B = this.bones, c = Math.cos(yaw), s = Math.sin(yaw);
    this.phase += dt * (5 + run * 8) * (run > 0.05 ? 1 : 0);
    const ph = this.phase, bob = Math.abs(Math.sin(ph)) * -0.035 * run;
    const hipY = y + 0.82 + bob + carried * 0.6;
    const lean = run * 0.08;
    M.trsEuler(B.subarray(0, 16), x, hipY, z, yaw, lean + carried * 1.4, 0);
    const hips = B.subarray(0, 16);
    const fwd = [hips[8], hips[9], hips[10]], up = [hips[4], hips[5], hips[6]], right = [hips[0], hips[1], hips[2]];
    const at = (o, k) => [hips[12] + right[0] * o[0] + up[0] * o[1] + fwd[0] * o[2], hips[13] + right[1] * o[0] + up[1] * o[1] + fwd[1] * o[2], hips[14] + right[2] * o[0] + up[2] * o[1] + fwd[2] * o[2]];
    const T = at([0, 0.1, 0]); M.trsEuler(B.subarray(16, 32), T[0], T[1], T[2], yaw, lean + carried * 1.4, 0);
    const Hd = at([0, 0.62, 0.02]); M.trsEuler(B.subarray(32, 48), Hd[0], Hd[1], Hd[2], yaw, lean * 0.5 + carried * 1.2, 0);
    const P = at([0, 0.14, -0.2]); M.trsEuler(B.subarray(KID.PACK * 16, KID.PACK * 16 + 16), P[0], P[1], P[2], yaw, lean + carried * 1.4, 0);
    const K = [0, 0, 0];
    for (let l = 0; l < 2; l++) {
      const side = l ? 1 : -1, sw = ph + l * Math.PI;
      const th = carried ? -1.0 : Math.sin(sw) * 0.7 * run, kn = carried ? 1.2 : Math.max(0, -Math.cos(sw)) * 1.0 * run + 0.06;
      const H = at([side * 0.1, -0.05, 0]);
      const kx = Math.sin(th) * 0.42, ky = -Math.cos(th) * 0.42;
      const Kp = at([side * 0.1, -0.05 + ky, kx]);
      const fx2 = kx + Math.sin(th - kn) * 0.4, fy2 = ky - Math.cos(th - kn) * 0.4;
      const F = at([side * 0.1, -0.05 + fy2, fx2]);
      aimMatrix(B.subarray((KID.LEG + l * 2) * 16, (KID.LEG + l * 2) * 16 + 16), H[0], H[1], H[2], Kp[0] - H[0], Kp[1] - H[1], Kp[2] - H[2], right[0], right[1], right[2]);
      aimMatrix(B.subarray((KID.LEG + l * 2 + 1) * 16, (KID.LEG + l * 2 + 1) * 16 + 16), Kp[0], Kp[1], Kp[2], F[0] - Kp[0], F[1] - Kp[1], F[2] - Kp[2], right[0], right[1], right[2]);
    }
    for (let a = 0; a < 2; a++) {
      const side = a ? 1 : -1, sw = ph + (a ? 0 : Math.PI);
      let ang = Math.sin(sw) * 0.6 * run + 0.15, ex = Math.sin(ang) * 0.28, ey = -Math.cos(ang) * 0.28, hx = ex + Math.sin(ang - 0.6) * 0.26, hy = ey - Math.cos(ang - 0.6) * 0.26;
      if (a === 1 && reach > 0) { ex = lerp(ex, 0.26, reach); ey = lerp(ey, 0.05, reach); hx = lerp(hx, 0.5, reach); hy = lerp(hy, 0.06, reach); }
      if (carried) { ex = -0.1; ey = 0.2; hx = -0.2; hy = 0.42; }
      const S0 = at([side * 0.23, 0.55, 0]), E = at([side * 0.25, 0.55 + ey, ex]), Hh = at([side * 0.25, 0.55 + hy, hx]);
      aimMatrix(B.subarray((KID.ARM + a * 2) * 16, (KID.ARM + a * 2) * 16 + 16), S0[0], S0[1], S0[2], E[0] - S0[0], E[1] - S0[1], E[2] - S0[2], right[0], right[1], right[2]);
      aimMatrix(B.subarray((KID.ARM + a * 2 + 1) * 16, (KID.ARM + a * 2 + 1) * 16 + 16), E[0], E[1], E[2], Hh[0] - E[0], Hh[1] - E[1], Hh[2] - E[2], right[0], right[1], right[2]);
      if (a === 1) this.hand = Hh;
    }
    this.item.x = x; this.item.y = y + 1; this.item.z = z;
    this.head = Hd; this.torchWorld = [Hd[0] + fwd[0] * 0.14, Hd[1] + 0.2, Hd[2] + fwd[2] * 0.14, fwd[0], fwd[1] - 0.15, fwd[2]];
    this.fx[KID.HEAD * 4] = 0;
  }
}
