// GRIFT CITY — the living world: entity lists, collision queries, particles, FX geometry, props, lights, clock.
'use strict';
const W = (() => {
  const cars = [], peds = [], pickups = [], explosions = [], blips = [];
  let heli = null;
  const dyn = []; // dynamic lights this frame
  const seed = (+(new URLSearchParams(location.search).get('seed')) || (Date.now() & 0xffff)) & 0xffff; const rng = M.rng(seed); // ?seed=N makes a run repeatable
  const state = { time: 9.0, dayLength: 24 * 60, elapsed: 0, frame: 0, camYaw: 0, shots: [], noises: [], heard: [] };

  // ---- Particles
  const P = { list: [], data: new Float32Array(4096 * 8), count: 0, alphaCount: 0, addCount: 0 };
  function particle(x, y, z, vx, vy, vz, life, size, col, a, opts = {}) {
    if (P.list.length > 4000) P.list.shift();
    P.list.push({ x, y, z, vx, vy, vz, life, max: life, size, col, a, add: !!opts.add, grav: opts.grav ?? 0, drag: opts.drag ?? 0.2, grow: opts.grow ?? 0, fade: opts.fade ?? 1, ground: opts.ground ?? false });
  }
  const FX = {
    smoke(x, y, z, n = 1, big = false) { for (let i = 0; i < n; i++) particle(x + (rng() - 0.5) * 0.6, y, z + (rng() - 0.5) * 0.6, (rng() - 0.5) * 0.8, 1.2 + rng() * 1.5, (rng() - 0.5) * 0.8, 1.5 + rng() * 1.5, big ? 2.5 : 1.2, [0.25, 0.25, 0.27], 0.5, { grow: big ? 2.5 : 1.4, drag: 0.6 }); },
    fire(x, y, z, n = 1) { for (let i = 0; i < n; i++) particle(x + (rng() - 0.5) * 0.8, y, z + (rng() - 0.5) * 0.8, (rng() - 0.5) * 1, 2 + rng() * 2.5, (rng() - 0.5) * 1, 0.4 + rng() * 0.5, 1.6, [1, 0.5 + rng() * 0.3, 0.1], 0.9, { add: true, grow: 0.5, drag: 0.8 }); },
    spark(x, y, z, n = 6, dir = null) { for (let i = 0; i < n; i++) { const a = rng() * M.TAU, s = 3 + rng() * 6; particle(x, y, z, Math.cos(a) * s + (dir ? dir[0] * 4 : 0), 2 + rng() * 5, Math.sin(a) * s + (dir ? dir[1] * 4 : 0), 0.3 + rng() * 0.4, 0.25, [1, 0.85, 0.4], 1, { add: true, grav: 20, drag: 0.1 }); } },
    blood(x, y, z, n = 8, dir = null) { for (let i = 0; i < n; i++) { const a = rng() * M.TAU, s = 1 + rng() * 3; particle(x, y, z, Math.cos(a) * s + (dir ? dir[0] * 3 : 0), 1 + rng() * 3, Math.sin(a) * s + (dir ? dir[1] * 3 : 0), 0.4 + rng() * 0.5, 0.35, [0.55, 0.02, 0.02], 0.9, { grav: 18, drag: 0.1 }); } },
    dust(x, y, z, n = 4) { for (let i = 0; i < n; i++) particle(x + (rng() - 0.5), y + 0.1, z + (rng() - 0.5), (rng() - 0.5) * 2, 0.5 + rng(), (rng() - 0.5) * 2, 0.6 + rng() * 0.6, 0.8, [0.6, 0.55, 0.45], 0.4, { grow: 2, drag: 1.5 }); },
    debris(x, y, z, n = 10, col = [0.2, 0.2, 0.2]) { for (let i = 0; i < n; i++) { const a = rng() * M.TAU, s = 4 + rng() * 10; particle(x, y + 0.5, z, Math.cos(a) * s, 6 + rng() * 10, Math.sin(a) * s, 1 + rng() * 1.5, 0.35, col, 1, { grav: 22, drag: 0.05, fade: 0.2 }); } },
    glass(x, y, z, n = 8) { for (let i = 0; i < n; i++) { const a = rng() * M.TAU, s = 1 + rng() * 3; particle(x, y, z, Math.cos(a) * s, 1 + rng() * 3, Math.sin(a) * s, 0.5 + rng() * 0.5, 0.15, [0.8, 0.9, 1], 0.9, { add: true, grav: 18 }); } },
    splash(x, y, z) { for (let i = 0; i < 24; i++) { const a = rng() * M.TAU, s = 1 + rng() * 4; particle(x, y, z, Math.cos(a) * s, 3 + rng() * 6, Math.sin(a) * s, 0.6 + rng() * 0.6, 0.6, [0.7, 0.85, 0.95], 0.8, { grav: 14, grow: 1 }); } },
    muzzle(x, y, z, fx, fz) { particle(x + fx * 0.3, y, z + fz * 0.3, 0, 0, 0, 0.05, 1.2, [1, 0.85, 0.5], 1, { add: true }); dyn.push({ x, y, z, r: 8, col: [1.2, 0.9, 0.5] }); },
    explosion(x, y, z, big = 1) {
      for (let i = 0; i < 26 * big; i++) { const a = rng() * M.TAU, s = rng() * 6 * big; particle(x, y + 0.5, z, Math.cos(a) * s, 2 + rng() * 8, Math.sin(a) * s, 0.5 + rng() * 0.7, 3 * big, [1, 0.45 + rng() * 0.4, 0.1], 1, { add: true, grow: 4, drag: 1 }); }
      for (let i = 0; i < 20 * big; i++) { const a = rng() * M.TAU, s = rng() * 3; particle(x, y + 1, z, Math.cos(a) * s, 3 + rng() * 5, Math.sin(a) * s, 2 + rng() * 2, 3, [0.15, 0.13, 0.12], 0.7, { grow: 4, drag: 0.5 }); }
      FX.debris(x, y, z, 16 * big); FX.spark(x, y + 1, z, 20);
      explosions.push({ x, y, z, t: 0, big });
    },
  };
  function updateParticles(dt) {
    const L = P.list; let w = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i]; p.life -= dt; if (p.life <= 0) continue;
      p.vy -= p.grav * dt; const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.size += p.grow * dt;
      if (p.y < 0.05 && p.grav > 0) { p.y = 0.05; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      L[w++] = p;
    }
    L.length = w;
    // pack: alpha-blended first, then additive
    let n = 0; const pack = p => { const t = p.life / p.max; const a = p.a * (p.fade < 1 ? Math.min(1, t / p.fade) : t); P.data.set([p.x, p.y, p.z, p.size, p.col[0], p.col[1], p.col[2], a], n * 8); n++; };
    for (const p of L) if (!p.add && n < 4096) pack(p); P.alphaCount = n;
    for (const p of L) if (p.add && n < 4096) pack(p); P.addCount = n - P.alphaCount; P.count = n;
  }

  // ---- Flat FX geometry (markers, headlight pools, tracers, shadows blobs)
  const F = { data: new Float32Array(16384 * 7), tris: [], adds: [], lines: [], count: 0, triCount: 0, addCount: 0, lineCount: 0 };
  const fx = {
    tri(list, ax, ay, az, bx, by, bz, cx, cy, cz, r, g, b, a) { list.push(ax, ay, az, r, g, b, a, bx, by, bz, r, g, b, a, cx, cy, cz, r, g, b, a); },
    quad(list, p0, p1, p2, p3, col, a, a2) { const a3 = a2 === undefined ? a : a2; list.push(p0[0], p0[1], p0[2], ...col, a, p1[0], p1[1], p1[2], ...col, a, p2[0], p2[1], p2[2], ...col, a3, p0[0], p0[1], p0[2], ...col, a, p2[0], p2[1], p2[2], ...col, a3, p3[0], p3[1], p3[2], ...col, a3); },
    line(ax, ay, az, bx, by, bz, col, a, a2) { F.lines.push(ax, ay, az, ...col, a, bx, by, bz, ...col, a2 === undefined ? a : a2); },
    // Translucent cylinder marker with a base ring; alpha fades to zero at the top.
    marker(x, z, r, h, col, pulse) {
      const y0 = CITY.groundY(x, z) + 0.02, segs = 20; const rr = r * (1 + 0.06 * Math.sin(pulse * 4));
      for (let i = 0; i < segs; i++) { const a0 = i / segs * M.TAU, a1 = (i + 1) / segs * M.TAU; const x0 = x + Math.cos(a0) * rr, z0 = z + Math.sin(a0) * rr, x1 = x + Math.cos(a1) * rr, z1 = z + Math.sin(a1) * rr;
        fx.quad(F.adds, [x0, y0, z0], [x1, y0, z1], [x1, y0 + h, z1], [x0, y0 + h, z0], col, 0.45, 0.0); fx.quad(F.adds, [x1, y0, z1], [x0, y0, z0], [x0, y0 + h, z0], [x1, y0 + h, z1], col, 0.45, 0.0);
        fx.quad(F.adds, [x + Math.cos(a0) * rr * 0.6, y0, z + Math.sin(a0) * rr * 0.6], [x + Math.cos(a1) * rr * 0.6, y0, z + Math.sin(a1) * rr * 0.6], [x1, y0, z1], [x0, y0, z0], col, 0.0, 0.7); }
    },
    // Light pool on the ground in front of headlights.
    lightPool(x, z, fx_, fz, len, wid, col, a) { const y = CITY.groundY(x, z) + 0.03; const rx = -fz, rz = fx_; fx.quad(F.adds, [x + rx * wid * 0.25, y, z + rz * wid * 0.25], [x - rx * wid * 0.25, y, z - rz * wid * 0.25], [x + fx_ * len - rx * wid, y, z + fz * len - rz * wid], [x + fx_ * len + rx * wid, y, z + fz * len + rz * wid], col, a, 0); },
    blob(x, y, z, r, a) { const s = 6; for (let i = 0; i < s; i++) { const a0 = i / s * M.TAU, a1 = (i + 1) / s * M.TAU; fx.tri(F.tris, x, y, z, x + Math.cos(a1) * r, y, z + Math.sin(a1) * r, x + Math.cos(a0) * r, y, z + Math.sin(a0) * r, 0, 0, 0, a); } },
    begin() { F.tris.length = 0; F.adds.length = 0; F.lines.length = 0; },
    end() { const all = F.tris.length + F.adds.length + F.lines.length; if (all / 7 > 16384) { F.adds.length = 0; F.lines.length = 0; } F.data.set(F.tris, 0); F.data.set(F.adds, F.tris.length); F.data.set(F.lines, F.tris.length + F.adds.length); F.triCount = F.tris.length / 7; F.addCount = F.adds.length / 7; F.lineCount = F.lines.length / 7; F.count = F.triCount + F.addCount + F.lineCount; },
  };

  // ---- Decals: skid marks and blood pools, a ring buffer of flat quads that fade out
  const decals = []; let decalHead = 0; const MAX_DECALS = 600;
  function decal(kind, x0, z0, x1, z1, w, col, a) { const d = { kind, x0, z0, x1, z1, w, col, a, t: 0 }; if (decals.length < MAX_DECALS) decals.push(d); else { decals[decalHead] = d; decalHead = (decalHead + 1) % MAX_DECALS; } }
  function drawDecals(camX, camZ, dt) {
    for (const d of decals) { d.t += dt; const life = d.kind === 'blood' ? 90 : 45; if (d.t > life) { d.a = 0; continue; } if (M.dist2(d.x0, d.z0, camX, camZ) > 160 * 160) continue; const a = d.a * Math.min(1, (life - d.t) / 10);
      const dx = d.x1 - d.x0, dz = d.z1 - d.z0; const l = Math.hypot(dx, dz) || 1; const rx = -dz / l * d.w * 0.5, rz = dx / l * d.w * 0.5; const y0 = CITY.groundY(d.x0, d.z0) + 0.015, y1 = CITY.groundY(d.x1, d.z1) + 0.015;
      fx.quad(F.tris, [d.x0 + rx, y0, d.z0 + rz], [d.x0 - rx, y0, d.z0 - rz], [d.x1 - rx, y1, d.z1 - rz], [d.x1 + rx, y1, d.z1 + rz], d.col, a); }
  }
  // ---- Collision helpers
  const bounds = CITY.outerBound();
  const WATER_Y = -1.6, OPEN_SEA = 320; // water level, and how far off the island a boat may go
  // Keep a boat's circle off the island, off the pier and inside the open-sea limit. Returns {x, z, hit} like pushOut; hit.edge marks the sea limit.
  function pushOutWater(x, z, r) {
    let hit = null; const B0 = bounds[0] - r, B1 = bounds[1] + r;
    if (x > B0 && x < B1 && z > B0 && z < B1) { const dl = x - B0, dr = B1 - x, dt = z - B0, db = B1 - z; const m = Math.min(dl, dr, dt, db); if (m === dl) { x = B0; hit = [-1, 0]; } else if (m === dr) { x = B1; hit = [1, 0]; } else if (m === dt) { z = B0; hit = [0, -1]; } else { z = B1; hit = [0, 1]; } }
    const pier = CITY.pier; const P0 = pier.x0 - r, P1 = pier.x1 + r, PZ = pier.z1 + r;
    if (x > P0 && x < P1 && z > bounds[1] - 1 && z < PZ) { const dl = x - P0, dr = P1 - x, db = PZ - z; const m = Math.min(dl, dr, db); if (m === dl) { x = P0; hit = [-1, 0]; } else if (m === dr) { x = P1; hit = [1, 0]; } else { z = PZ; hit = [0, 1]; } }
    const S0 = bounds[0] - OPEN_SEA, S1 = bounds[1] + OPEN_SEA;
    if (x < S0) { x = S0; hit = [1, 0]; hit.edge = true; } if (x > S1) { x = S1; hit = [-1, 0]; hit.edge = true; } if (z < S0) { z = S0; hit = [0, 1]; hit.edge = true; } if (z > S1) { z = S1; hit = [0, -1]; hit.edge = true; }
    return { x, z, hit };
  }
  // Nearest point of dry land (the island's edge or the pier deck) to a point on the water, with its distance.
  function nearestLand(x, z) {
    const cands = []; const ix = M.clamp(x, bounds[0] + 1, bounds[1] - 1), iz = M.clamp(z, bounds[0] + 1, bounds[1] - 1); cands.push([ix, iz]);
    const pier = CITY.pier; cands.push([M.clamp(x, pier.x0 + 0.6, pier.x1 - 0.6), M.clamp(z, bounds[1] - 1, pier.z1 - 0.6)]);
    let best = null; for (const [cx, cz] of cands) { const d = M.dist(x, z, cx, cz); if (!best || d < best.d) best = { x: cx, z: cz, d }; } return best;
  }
  const onWater = (x, z) => (x < bounds[0] || x > bounds[1] || z < bounds[0] || z > bounds[1]) && !(x > CITY.pier.x0 && x < CITY.pier.x1 && z < CITY.pier.z1 && z > bounds[1] - 1);
  // Push a circle out of building lots and solid props; returns [x, z, hitNormalX, hitNormalZ] or null for no hit.
  function pushOut(x, z, r, opts = {}) {
    let hit = null;
    const room = CITY.interiorRoom; const indoor = room && x > room.x0 - 3 && x < room.x1 + 3 && z > room.z0 - 3 && z < room.z1 + 3;
    let lots = indoor ? room.walls : CITY.lotsNear(x, z, r + 3); if (indoor) opts = { ...opts, noProps: true, indoor: true };
    const roof = CITY.roofLot; if (roof && x > roof.x0 - 1 && x < roof.x1 + 1 && z > roof.z0 - 1 && z < roof.z1 + 1) { lots = lots.filter(l => !(l.x0 <= x && l.x1 >= x && l.z0 <= z && l.z1 >= z)).concat(roof.walls); opts = { ...opts, noProps: true, indoor: true }; }
    for (let pass = 0; pass < 3; pass++) { let moved = false; // a push out of one lot can land inside a neighbour; settle in a few passes
    for (const l of lots) {
      if (opts.ignoreLow && l.h < 1.2) continue;
      const cx = M.clamp(x, l.x0, l.x1), cz = M.clamp(z, l.z0, l.z1); let dx = x - cx, dz = z - cz; const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 < 1e-8) { // inside: push out via the nearest face
        const dl = x - l.x0, dr = l.x1 - x, dt = z - l.z0, db = l.z1 - z; const m = Math.min(dl, dr, dt, db);
        if (m === dl) { x = l.x0 - r; hit = [-1, 0]; } else if (m === dr) { x = l.x1 + r; hit = [1, 0]; } else if (m === dt) { z = l.z0 - r; hit = [0, -1]; } else { z = l.z1 + r; hit = [0, 1]; }
      } else { const d = Math.sqrt(d2); dx /= d; dz /= d; x = cx + dx * r; z = cz + dz * r; hit = [dx, dz]; }
      moved = true;
    }
    if (!moved) break; }
    if (!opts.noProps) for (const p of propsNear(x, z)) {
      if (p.down) continue; const rr = r + p.r; const dx = x - p.x, dz = z - p.z; const d2 = dx * dx + dz * dz; if (d2 >= rr * rr || d2 < 1e-8) continue;
      const d = Math.sqrt(d2); x = p.x + dx / d * rr; z = p.z + dz / d * rr; hit = [dx / d, dz / d]; hit.prop = p;
    }
    if (opts.indoor) return { x, z, hit };
    if (x < bounds[0] + r) { x = bounds[0] + r; hit = [1, 0]; } if (x > bounds[1] - r) { x = bounds[1] - r; hit = [-1, 0]; }
    if (z < bounds[0] + r) { z = bounds[0] + r; hit = [0, 1]; }
    const pier = CITY.pier; const onPier = x > pier.x0 + r && x < pier.x1 - r;
    if (z > bounds[1] - r) { if (onPier) { if (z > pier.z1 - r) { z = pier.z1 - r; hit = [0, -1]; } } else { z = bounds[1] - r; hit = [0, -1]; } }
    if (z > bounds[1] + 0.5 && !onPier) { x = M.clamp(x, pier.x0 + r, pier.x1 - r); }
    return { x, z, hit };
  }
  // Solid props bucketed on a 16 m grid so collision queries only touch the neighbourhood.
  const propGrid = new Map(); const PG = 16; let propGridBuilt = false;
  function buildPropGrid() { propGrid.clear(); for (const p of CITY.solidProps) { const k = Math.floor(p.x / PG) + ',' + Math.floor(p.z / PG); let a = propGrid.get(k); if (!a) propGrid.set(k, a = []); a.push(p); } propGridBuilt = true; }
  const propTmp = [];
  function propsNear(x, z) { if (!propGridBuilt) buildPropGrid(); propTmp.length = 0; const i = Math.floor(x / PG), j = Math.floor(z / PG); for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) { const c = propGrid.get(a + ',' + b); if (c) for (const p of c) propTmp.push(p); } return propTmp; }
  function solidPropsNear(x, z, r) { const out = []; for (const p of CITY.solidProps) if (!p.down && M.dist2(x, z, p.x, p.z) < (r + 3) * (r + 3)) out.push(p); return out; }
  // Line of sight in 2D against building lots (ignores low walls).
  function los(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az; const steps = Math.ceil(Math.hypot(dx, dz) / 40) + 1;
    const seen = new Set();
    for (let s = 0; s <= steps; s++) { const px = ax + dx * s / steps, pz = az + dz * s / steps; for (const l of CITY.lotsNear(px, pz, 25)) { if (seen.has(l) || l.h < 1.5) continue; seen.add(l); if (M.rayAABB2(ax, az, dx, dz, l.x0, l.z0, l.x1, l.z1) >= 0) return false; } }
    return true;
  }
  // Bullet ray: returns nearest hit {t, x, z, kind:'lot'|'car'|'ped'|'prop'|'heli'|'none', obj}
  function raycast(ox, oz, dx, dz, maxDist, ignore = null, oy = 1.2) {
    let best = { t: 1, kind: 'none' }; const ex = dx * maxDist, ez = dz * maxDist;
    const seen = new Set();
    const steps = Math.ceil(maxDist / 40) + 1;
    for (let s = 0; s <= steps; s++) { const px = ox + ex * s / steps, pz = oz + ez * s / steps; for (const l of CITY.lotsNear(px, pz, 25)) { if (seen.has(l)) continue; seen.add(l); if (l.h < oy) continue; const t = M.rayAABB2(ox, oz, ex, ez, l.x0, l.z0, l.x1, l.z1); if (t >= 0 && t < best.t) best = { t, kind: 'lot', obj: l }; } }
    for (const c of cars) { if (c === ignore || c.removed) continue; for (const [cx, cz, r] of c.circles()) { const t = M.rayCircle2(ox, oz, ex, ez, cx, cz, r); if (t >= 0 && t < best.t) best = { t, kind: 'car', obj: c }; } }
    for (const p of peds) { if (p === ignore || p.removed || p.state === 'dead' || p.inCar) continue; const t = M.rayCircle2(ox, oz, ex, ez, p.x, p.z, 0.5); if (t >= 0 && t < best.t) best = { t, kind: 'ped', obj: p }; }
    { const seenP = new Set(); for (let s2 = 0; s2 <= steps; s2++) { const px = ox + ex * s2 / steps, pz = oz + ez * s2 / steps; for (const p of propsNear(px, pz)) { if (p.down || p.r < 0.3 || seenP.has(p)) continue; seenP.add(p); const t = M.rayCircle2(ox, oz, ex, ez, p.x, p.z, p.r); if (t >= 0 && t < best.t) best = { t, kind: 'prop', obj: p }; } } }
    if (heli && heli !== ignore && !heli.dead) { const t = M.rayCircle2(ox, oz, ex, ez, heli.x, heli.z, 3.5); if (t >= 0 && t < best.t && Math.abs(heli.y - oy) < 6) best = { t, kind: 'heli', obj: heli }; }
    best.x = ox + ex * best.t; best.z = oz + ez * best.t; best.dist = best.t * maxDist; return best;
  }
  function carsNear(x, z, r) { const out = []; const r2 = r * r; for (const c of cars) if (!c.removed && M.dist2(x, z, c.x, c.z) < r2) out.push(c); return out; }
  function pedsNear(x, z, r) { const out = []; const r2 = r * r; for (const p of peds) if (!p.removed && M.dist2(x, z, p.x, p.z) < r2) out.push(p); return out; }
  // noises is cleared every frame (peds read it after the player has fired); heard keeps the last half second for mission scripts that run before the player update
  function noise(x, z, r, kind) { const n = { x, z, r, kind, t: state.elapsed }; state.noises.push(n); state.heard.push(n); }

  // ---- Props: instanced meshes, knockable
  const propMeshes = {}; let lampHeads = null, tlHeads = null, markerMesh = null;
  const PROP_TYPES = ['lamppost', 'trafficLight', 'tree', 'hydrant', 'bin', 'bench', 'bollard', 'payphone', 'dumpster', 'mailbox', 'meter', 'newsbox', 'busShelter', 'cone', 'barrier', 'hedge', 'roundTree', 'palm', 'umbrella', 'streetSign', 'cafeSet', 'crates', 'sandwichBoard', 'vending', 'barberPole', 'bikeRack', 'flowerBucket', 'tireStack', 'barrel', 'hotdogCart', 'pigeon', 'gull'];
  function initProps() {
    for (const t of PROP_TYPES) { const list = CITY.props[t] || (CITY.props[t] = []); propMeshes[t] = MESH[t]().buildInstanced(Math.max(1, list.length)); }
    lampHeads = MESH.lampHead().buildInstanced(CITY.props.lamppost.length + 8);
    tlHeads = MESH.lampHead().buildInstanced(CITY.props.trafficLight.length * 3 + 8);
  }
  const tmpM = M.create();
  function updateProps(camX, camZ) {
    const R2 = 320 * 320;
    for (const t of PROP_TYPES) {
      const m = propMeshes[t]; let n = 0;
      for (const p of CITY.props[t]) {
        if (M.dist2(p.x, p.z, camX, camZ) > R2) continue;
        const s = p.s || 1;
        if (p.fall !== undefined) { // knocked: rotate about the base
          const k = Math.min(1, p.fall); const tilt = k * Math.PI * 0.48;
          M.trsEuler(tmpM, p.x, CITY.groundY(p.x, p.z), p.z, p.fallDir, tilt, 0, s, s, s);
        } else if (p.y !== undefined) M.trsEuler(tmpM, p.x, p.y, p.z, p.a || 0, p.pitch || 0, p.roll || 0, s, p.sy || s, s);
        else M.trs(tmpM, p.x, CITY.groundY(p.x, p.z), p.z, p.a || 0, s, s, s);
        m.instData.set(tmpM, n * 20); m.instData.set(p.tint || [1, 1, 1, 0], n * 20 + 16); n++;
      }
      GL.updateInstances(m, n);
    }
    // lamp heads (emissive at night) — sit at the end of the arm
    let n = 0; const night = RENDER.env.nightEmis;
    if (night > 0.05) for (const p of CITY.props.lamppost) {
      if (p.fall !== undefined || M.dist2(p.x, p.z, camX, camZ) > R2) continue;
      const a = p.a || 0; M.trs(tmpM, p.x + Math.sin(a) * 1.6, CITY.groundY(p.x, p.z) + 5.78, p.z + Math.cos(a) * 1.6, a, 1.6, 0.3, 3.2); lampHeads.instData.set(tmpM, n * 20); lampHeads.instData.set([1, 0.9, 0.7, 1.5 * night], n * 20 + 16); n++;
    }
    GL.updateInstances(lampHeads, n);
    n = 0;
    for (const p of CITY.props.trafficLight) {
      if (M.dist2(p.x, p.z, camX, camZ) > 200 * 200) continue;
      const L = CITY.lights[p.light]; const a = p.a; const st = lightState(L, p.axis);
      for (let k = 0; k < 3; k++) { // 0 red (top), 1 yellow, 2 green
        const on = (st === 'red' && k === 0) || (st === 'yellow' && k === 1) || (st === 'green' && k === 2);
        const col = k === 0 ? [1, 0.15, 0.1] : k === 1 ? [1, 0.75, 0.1] : [0.2, 1, 0.3];
        const y = 4.75 - k * 0.32; M.trs(tmpM, p.x + Math.sin(a) * 3.9, y, p.z + Math.cos(a) * 3.9, a + Math.PI, 1.3, 1.3, 1.3);
        // head faces the approaching traffic, i.e. -arm direction
        tlHeads.instData.set(tmpM, n * 20); tlHeads.instData.set([col[0], col[1], col[2], on ? 2.0 : 0], n * 20 + 16); if (!on) tlHeads.instData.set([col[0] * 0.25, col[1] * 0.25, col[2] * 0.25, 0], n * 20 + 16); n++;
      }
    }
    GL.updateInstances(tlHeads, n);
  }
  function knockProp(p, dirX, dirZ) { if (p.down || p.ref === undefined) return; const ref = p.ref; if (ref.fall !== undefined) return; ref.fall = 0; ref.fallDir = Math.atan2(dirX, dirZ) + Math.PI; p.down = true; p.fallT = 0; FX.spark(p.x, 1, p.z, 8); FX.dust(p.x, 0, p.z, 6); }
  function updateKnocked(dt) { for (const p of CITY.solidProps) if (p.down && p.ref && p.ref.fall < 1) p.ref.fall = Math.min(1, p.ref.fall + dt * 2.2); }

  // ---- Traffic lights
  const CYCLE = { green: 9, yellow: 2.5, red: 1 };
  function updateLights(dt) { for (const L of CITY.lights) { L.t += dt; const period = CYCLE.green + CYCLE.yellow + CYCLE.red; if (L.t >= period) { L.t -= period; L.phase = 1 - L.phase; } } }
  // State for traffic on 'axis' (0 = edges along z, 1 = along x)
  function lightState(L, axis) { if (L.phase !== axis) return 'red'; if (L.t < CYCLE.green) return 'green'; if (L.t < CYCLE.green + CYCLE.yellow) return 'yellow'; return 'red'; }
  function lightAt(node) { for (const L of CITY.lights) if (L.i === node.i && L.j === node.j) return L; return null; }
  const lightIndex = {}; function indexLights() { for (const L of CITY.lights) lightIndex[L.i + ',' + L.j] = L; }
  const lightFor = node => lightIndex[node.i + ',' + node.j] || null;

  // ---- Lights for the renderer
  // Faint additive cones under the lampposts at night, drawn into the flat FX buffer.
  function lampCones(camX, camZ) {
    const night = RENDER.env.nightEmis; if (night < 0.05) return; const rain = weather.rain;
    let cones = 0;
    for (const p of CITY.props.lamppost) { if (p.fall !== undefined) continue; const d2 = M.dist2(p.x, p.z, camX, camZ); if (d2 > 60 * 60 || cones++ > 14) continue; const a = p.a || 0; const hx = p.x + Math.sin(a) * 1.6, hz = p.z + Math.cos(a) * 1.6; const y0 = CITY.groundY(hx, hz);
      const al = 0.045 * night * (1 + rain * 1.5) * (1 - Math.sqrt(d2) / 60); const R = 2.6; const segs = 8;
      for (let i = 0; i < segs; i++) { const a0 = i / segs * M.TAU, a1 = (i + 1) / segs * M.TAU; fx.tri(F.adds, hx, 5.7, hz, hx + Math.cos(a0) * R, y0 + 0.05, hz + Math.sin(a0) * R, hx + Math.cos(a1) * R, y0 + 0.05, hz + Math.sin(a1) * R, 1, 0.85, 0.55, al); fx.tri(F.adds, hx, 5.7, hz, hx + Math.cos(a1) * R, y0 + 0.05, hz + Math.sin(a1) * R, hx + Math.cos(a0) * R, y0 + 0.05, hz + Math.sin(a0) * R, 1, 0.85, 0.55, al); }
      // pool on the ground
      fx.quad(F.adds, [hx - R, y0 + 0.03, hz - R], [hx + R, y0 + 0.03, hz - R], [hx + R, y0 + 0.03, hz + R], [hx - R, y0 + 0.03, hz + R], [1, 0.85, 0.55], al * 1.5, al * 1.5); }
  }
  function collectLights(camX, camZ) {
    const out = []; const night = RENDER.env.nightEmis;
    if (night > 0.05) { for (const p of CITY.props.lamppost) { if (p.fall !== undefined) continue; const d2 = M.dist2(p.x, p.z, camX, camZ); if (d2 < 110 * 110) { const a = p.a || 0; out.push({ x: p.x + Math.sin(a) * 1.6, y: 5.6, z: p.z + Math.cos(a) * 1.6, r: 17, col: [0.42 * night, 0.33 * night, 0.19 * night] }); } } }
    for (const d of dyn) out.push(d);
    return out;
  }

  // ---- Weather: clear spells and rain, a few game hours each
  const weather = { rain: 0, target: 0, nextChange: 3, fog: 0, fogTarget: 0 };
  // How busy the streets are by the clock: dead at 3am, rush at 8 and 18, thinning after 22.
  function bustle(hour) { const h = ((hour % 24) + 24) % 24; if (h < 5) return 0.22; if (h < 9) return 0.22 + (h - 5) / 4 * 0.78; if (h < 19) return 1; if (h < 23) return 1 - (h - 19) / 4 * 0.6; return 0.4 - (h - 23) * 0.18; }
  function updateWeather(dt) {
    weather.nextChange -= dt * 24 / state.dayLength; // in game hours
    if (weather.nextChange <= 0) { weather.target = weather.target > 0 ? 0 : (rng() < 0.55 ? 0.6 + rng() * 0.4 : 0); weather.nextChange = weather.target > 0 ? 1.5 + rng() * 2.5 : 3 + rng() * 6; }
    weather.rain = M.approach(weather.rain, weather.target, dt * 0.08);
    // fog rolls in off the water in the small hours and burns off by mid-morning
    const h = state.time; const fogHour = (h > 3.5 && h < 9) ? M.clamp(1 - Math.abs(h - 6) / 2.5, 0, 1) : 0; if (weather.fogTarget === 0 && fogHour > 0 && weather.rain < 0.1 && rng() < dt * 0.12) weather.fogTarget = 0.5 + rng() * 0.5; if (fogHour === 0 || weather.rain > 0.3) weather.fogTarget = 0;
    weather.fog = M.approach(weather.fog, weather.fogTarget * fogHour, dt * 0.05);
    if (weather.rain > 0.02) { const cam = RENDER.cam; const n = Math.floor(40 * weather.rain); for (let i = 0; i < n; i++) { const x = cam.tx + (rng() - 0.5) * 40, z = cam.tz + (rng() - 0.5) * 40; particle(x, cam.ty + 6 + rng() * 14, z, 0.6, -22, 0.3, 0.75, 0.09, [0.75, 0.8, 0.9], 0.45 * weather.rain, { grav: 0, drag: 0, fade: 1 }); } }
  }
  // ---- Clock
  function updateClock(dt) { state.time += dt * 24 / state.dayLength; if (state.time >= 24) state.time -= 24; state.elapsed += dt; state.frame++; }
  const clockString = () => { const h = Math.floor(state.time), m = Math.floor((state.time - h) * 60); return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; };
  const isNight = () => state.time < 6 || state.time > 19.5;

  function frameBegin() { dyn.length = 0; state.shots.length = 0; state.noises.length = 0; if (state.heard.length && state.elapsed - state.heard[0].t > 0.5) state.heard = state.heard.filter(n => state.elapsed - n.t <= 0.5); }
  function updateExplosions(dt) { let w = 0; for (const e of explosions) { e.t += dt; if (e.t < 0.6) { dyn.push({ x: e.x, y: e.y + 1, z: e.z, r: 30 * e.big, col: [3 * (1 - e.t), 1.5 * (1 - e.t), 0.3] }); explosions[w++] = e; } } explosions.length = w; }

  return { weather, updateWeather, bustle, lampCones, decal, drawDecals, cars, peds, pickups, blips, get heli() { return heli; }, set heli(h) { heli = h; }, dyn, rng, state, P, F, FX, fx, particle, updateParticles, pushOut, solidPropsNear, los, raycast, carsNear, pedsNear, noise, initProps, updateProps, propMeshes, get lampHeads() { return lampHeads; }, get tlHeads() { return tlHeads; }, knockProp, updateKnocked, updateLights, lightState, lightFor, indexLights, collectLights, updateClock, clockString, isNight, frameBegin, updateExplosions, bounds, seed, PROP_TYPES, WATER_Y, pushOutWater, nearestLand, onWater };
})();
