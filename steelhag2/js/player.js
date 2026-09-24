// STÅLHAGEN II — the player: a capsule on the ground, an over-the-shoulder camera that drifts back into a painting
// when you stand still, the viewfinder, the torch, the arc cutter, the reach-out hold, and the sled on its rope.
'use strict';
const Player = (() => {
  const P = {
    x: 0, y: 0, z: -22, yaw: 0, vx: 0, vz: 0, speed: 0, camYaw: 0, camPitch: 0.12, torch: false, cutterUp: false, hold: 0, flinch: false, flinchT: 0,
    hurry: false, viewfinder: false, handWorld: [0, 0, 0], onIce: false, thinT: 0, sit: null, moveT: 0, stillT: 0, calmCam: 0, carried: 0,
    sled: { x: 0.8, y: 0, z: -26, vx: 0, vz: 0, yaw: 0, rope: 2.2 }, snow: 0, wet: 0, breath: 0, stepT: 0, surface: 'snow', dead: 0,
  };
  const cam = RENDER.cam;
  let camX = 0, camY = 3, camZ = -30;
  const RADIUS = 0.35;

  function place(x, z, yaw = 0) { P.x = x; P.z = z; P.y = World.groundY(x, z); P.yaw = yaw; P.camYaw = yaw; P.vx = P.vz = 0; P.sled.x = x - Math.sin(yaw) * 2; P.sled.z = z - Math.cos(yaw) * 2; P.sled.y = World.groundY(P.sled.x, P.sled.z); snapCamera(); }

  function update(dt, input, ctx) {
    P.flinch = false;
    const control = !P.sit && !ctx.locked && P.carried <= 0;
    // look
    if (control || P.viewfinder) { P.camYaw -= input.lookDX * 0.0022; P.camPitch = clamp(P.camPitch + input.lookDY * 0.0022, -0.6, 0.9); }
    // move, relative to the camera
    let mx = 0, mz = 0;
    if (control) { const f = input.my, r = input.mx; const c = Math.cos(P.camYaw), s = Math.sin(P.camYaw); mx = s * f - c * r; mz = c * f + s * r; }
    const mag = Math.min(1, Math.hypot(mx, mz)); if (mag > 0.001) { mx /= Math.hypot(mx, mz); mz /= Math.hypot(mx, mz); }
    P.hurry = control && input.hurry && mag > 0.3;
    const target = mag * (P.hurry ? 4.2 : P.viewfinder ? 1.0 : 2.2);
    const acc = P.onIce ? 6 : 14;
    P.vx = M.approach(P.vx, mx * target, acc * dt); P.vz = M.approach(P.vz, mz * target, acc * dt);
    P.speed = Math.hypot(P.vx, P.vz);
    if (mag > 0.3 && !P.viewfinder) P.yaw = P.yaw + M.angleTo(P.yaw, Math.atan2(mx, mz)) * (1 - Math.pow(0.001, dt));
    if (P.viewfinder) P.yaw = P.yaw + M.angleTo(P.yaw, P.camYaw) * (1 - Math.pow(0.001, dt));
    const nx = P.x + P.vx * dt, nz = P.z + P.vz * dt;
    const pos = { x: nx, z: nz }; World.pushOut(pos, RADIUS, P.y);
    P.x = pos.x; P.z = pos.z; P.y = World.groundY(P.x, P.z);
    P.onIce = World.onIce(P.x, P.z);
    P.surface = P.onIce ? 'ice' : 'snow';
    // thin ice: two and a half seconds of standing on the dark patches, or running across them
    const thin = P.onIce ? World.thinAt(P.x, P.z) : 0;
    if (thin > 0.3) { P.thinT += dt * (P.hurry ? 2.2 : 1); if (P.thinT > 0.8 && !P.crackWarned) { P.crackWarned = true; ctx.onCrack && ctx.onCrack(); } if (P.thinT > 2.5) { P.thinT = 0; ctx.onThinIce && ctx.onThinIce(); } }
    else { P.thinT = Math.max(0, P.thinT - dt); if (P.thinT === 0) P.crackWarned = false; }
    // stillness, for the painting camera and the machines
    if (P.speed < 0.08 && mag < 0.1) P.stillT += dt; else P.stillT = 0;
    // footsteps
    if (P.speed > 0.2) { P.stepT -= dt * (0.6 + P.speed * 1.4); if (P.stepT <= 0) { P.stepT = 1; ctx.onStep && ctx.onStep(P.surface, P.hurry); } }
    // the torch and the cutter
    if (control && input.torchPressed) { P.torch = !P.torch; ctx.onTorch && ctx.onTorch(P.torch); if (P.torch && P.hold > 0) P.flinch = true; }
    P.cutterUp = control && input.cutHeld && !P.viewfinder;
    if (P.cutterUp && P.hold > 0) P.flinch = true;
    // reach out: the hold. Letting go is never a flinch; sustained movement, hurry, the torch or the cutter are.
    if (control && ctx.standoff && input.useHeld && !P.viewfinder) {
      P.hold += dt;
      if (mag > 0.35) { P.flinchT += dt; if (P.flinchT > 0.12) P.flinch = true; } else P.flinchT = 0;
      if (P.hurry) P.flinch = true;
    } else { if (P.hold > 0 && ctx.onRelease) ctx.onRelease(P.hold); P.hold = 0; P.flinchT = 0; }
    // weather on the kid
    if (ctx.snowing && P.stillT > 0) P.snow = Math.min(1, P.snow + dt / 40); else if (ctx.snowing) P.snow = Math.min(1, P.snow + dt / 120);
    updateSled(dt, ctx);
    updateCamera(dt, ctx);
  }

  function updateSled(dt, ctx) {
    const s = P.sled; const dx = s.x - P.x, dz = s.z - P.z, d = Math.hypot(dx, dz);
    if (d > s.rope) { const k = (d - s.rope) / d; s.vx -= dx * k * 30 * dt; s.vz -= dz * k * 30 * dt; }
    const fr = World.onIce(s.x, s.z) ? 1.4 : 3.5; s.vx *= Math.max(0, 1 - fr * dt); s.vz *= Math.max(0, 1 - fr * dt);
    if (d < 1.1 && d > 1e-4) { const nx = dx / d, nz = dz / d, vin = s.vx * nx + s.vz * nz; if (vin < 0) { s.vx -= vin * nx; s.vz -= vin * nz; } s.x = P.x + nx * 1.1; s.z = P.z + nz * 1.1; }
    s.x += s.vx * dt; s.z += s.vz * dt; s.y = World.groundY(s.x, s.z);
    const sp = Math.hypot(s.vx, s.vz); if (sp > 0.2) s.yaw = s.yaw + M.angleTo(s.yaw, Math.atan2(s.vx, s.vz)) * (1 - Math.pow(0.01, dt));
    s.speed = sp;
  }

  function snapCamera() { const d = 2.8; camX = P.x - Math.sin(P.camYaw) * d; camZ = P.z - Math.cos(P.camYaw) * d; camY = P.y + 1.7; }
  function updateCamera(dt, ctx) {
    let tx, ty, tz, lx, ly, lz, fov = 55;
    if (P.viewfinder) {
      // first person, through the 35 mm frame
      const hy = P.y + 1.5; const fx = Math.sin(P.camYaw) * Math.cos(P.camPitch), fz = Math.cos(P.camYaw) * Math.cos(P.camPitch), fy = -Math.sin(P.camPitch);
      tx = P.x + fx * 0.2; ty = hy; tz = P.z + fz * 0.2; lx = tx + fx; ly = ty + fy; lz = tz + fz; fov = 38;
      camX = tx; camY = ty; camZ = tz;
    } else if (P.sit) {
      const s = P.sit, o = s.camOff; tx = s.x + o[0]; ty = s.y + o[1]; tz = s.z + o[2]; lx = s.x; ly = s.y + 1.0; lz = s.z; fov = 50;
      camX = lerp(camX, tx, 1 - Math.pow(0.15, dt)); camY = lerp(camY, ty, 1 - Math.pow(0.15, dt)); camZ = lerp(camZ, tz, 1 - Math.pow(0.15, dt));
    } else if (P.carried > 0) {
      // on your back, the sky, snow on the lens
      tx = P.x; ty = P.y + 1.2 + P.carried * 0.15; tz = P.z; lx = tx + Math.sin(P.camYaw) * 0.2; ly = ty + 1; lz = tz + Math.cos(P.camYaw) * 0.2; fov = 60;
      camX = lerp(camX, tx, 1 - Math.pow(0.05, dt)); camY = lerp(camY, ty, 1 - Math.pow(0.05, dt)); camZ = lerp(camZ, tz, 1 - Math.pow(0.05, dt));
    } else {
      // over the shoulder; when you stand still in open country it drifts back and up into the painting
      const paint = ctx.indoors ? 0 : smooth(2.5, 7, P.stillT) * (P.hold > 0 ? 0 : 1);
      P.calmCam = lerp(P.calmCam, paint, 1 - Math.pow(0.3, dt));
      const dist = lerp(P.cutterUp ? 2.2 : 3.6, 8, P.calmCam), height = lerp(1.9, 3.4, P.calmCam), side = lerp(0.6, 0.2, P.calmCam);
      const pitch = P.camPitch, cy = Math.cos(P.camYaw), sy = Math.sin(P.camYaw);
      tx = P.x - sy * dist * Math.cos(pitch) + cy * side; tz = P.z - cy * dist * Math.cos(pitch) - sy * side; ty = P.y + height + Math.sin(pitch) * dist;
      // keep the camera out of things and above the ground
      const g = World.groundY(tx, tz) + 0.5; if (ty < g) ty = g;
      const cp = { x: tx, z: tz }; World.pushOut(cp, 0.3, ty - 1); tx = cp.x; tz = cp.z;
      const k = 1 - Math.pow(P.calmCam > 0.02 ? 0.3 : 0.001, dt);
      camX = lerp(camX, tx, k); camY = lerp(camY, ty, k); camZ = lerp(camZ, tz, k);
      lx = P.x + cy * side * 0.6; ly = P.y + lerp(1.3, 1.0, P.calmCam) + Math.sin(pitch) * 0.4; lz = P.z - sy * side * 0.6;
      const fx = Math.sin(P.camYaw), fz = Math.cos(P.camYaw); lx += fx * 3.2 * (1 - P.calmCam); lz += fz * 3.2 * (1 - P.calmCam);
      fov = lerp(55, 48, P.calmCam);
    }
    cam.x = camX; cam.y = camY; cam.z = camZ; cam.tx = lx; cam.ty = ly; cam.tz = lz; cam.fov = fov * Math.PI / 180;
  }
  // the ray the cutter and the camera look along
  function facing() { return [Math.sin(P.yaw), 0, Math.cos(P.yaw)]; }
  return { P, update, place, facing, snapCamera };
})();
