// GRIFT CITY — the small life that makes a street look lived in: pigeons that scatter, gulls over the water,
// steam from the manholes, litter on the wind, a plane now and then, and a ferry that never stops going round.
'use strict';
const AMBIENT = (() => {
  const flocks = []; const gulls = []; let plane = null, planeT = 60, paperT = 0, ferry = null, wind = [1, 0.3], windT = 0;
  const rng = () => W.rng();
  function init() {
    // pigeons: flocks in the parks and on random sidewalks, entered into the prop list before it is built
    const spots = []; for (const pk of CITY.places.park || []) { spots.push([pk.x + 4, pk.z + 6], [pk.x - 8, pk.z - 5]); }
    for (let k = 0; k < 14; k++) { const n = CITY.walkNodes[Math.floor(rng() * CITY.walkNodes.length)]; spots.push([n.x, n.z]); }
    for (const [hx, hz] of spots) { const birds = []; const n = 4 + Math.floor(rng() * 5); for (let i = 0; i < n; i++) { const p = { x: hx + (rng() - 0.5) * 3, z: hz + (rng() - 0.5) * 3, y: 0, a: rng() * 6.28, s: 1, sy: 1, pitch: 0, hop: rng() * 3 }; p.y = CITY.groundY(p.x, p.z); CITY.props.pigeon.push(p); birds.push({ p, vx: 0, vz: 0, vy: 0 }); } flocks.push({ hx, hz, birds, fly: 0, scared: 0 }); }
    // gulls circle over the pier, the marina and the docks
    const pier = CITY.pier; const centres = [[(pier.x0 + pier.x1) / 2, pier.z1 - 20], [W.bounds[0] + 150, W.bounds[1] + 20], [CITY.place('docks').x, CITY.place('docks').z + 40]];
    for (const [cx, cz] of centres) for (let i = 0; i < 3; i++) { const p = { x: cx, z: cz, y: 12, a: 0, s: 1.3, sy: 1, pitch: 0, roll: 0 }; CITY.props.gull.push(p); gulls.push({ p, cx, cz, r: 14 + rng() * 14, h: 9 + rng() * 10, ph: rng() * 6.28, w: 0.25 + rng() * 0.2, dir: rng() < 0.5 ? 1 : -1 }); }
  }
  // the ferry is a vehicle, so it waits until the vehicle module has its moorings
  function launchFerry() {
    const B0 = W.bounds[0], B1 = W.bounds[1], off = 70; const pier = CITY.pier;
    ferry = VEH.spawn('ferry', B1 + off, B1 + off, 0, { mode: 'route', color: 2 }); ferry.persistent = true; ferry.ai.routeLoop = true; ferry.ai.routeSpeed = 8;
    ferry.ai.route = [[B1 + off, B0 - off, 20], [B0 - off, B0 - off, 20], [B0 - off, B1 + off, 20], [pier.x0 - 30, pier.z1 + 40, 20], [pier.x1 + 30, pier.z1 + 40, 20], [B1 + off, B1 + off, 20]]; ferry.ai.routeIdx = 0;
    const drv = PEDS.spawnDriver(ferry); drv.important = true; for (let i = 0; i < 3; i++) { const q = PEDS.spawn(ferry.x, ferry.z, { important: true }); q.inCar = ferry; q.state = 'driving'; ferry.passengers.push(q); }
  }
  function update(dt, px, pz) {
    windT -= dt; if (windT <= 0) { windT = 20 + rng() * 30; const a = rng() * 6.28; wind = [Math.cos(a), Math.sin(a)]; }
    const t = W.state.elapsed; const car = PLAYER.car;
    // ---- pigeons
    for (const f of flocks) { const d2 = M.dist2(f.hx, f.hz, px, pz); if (d2 > 160 * 160) continue;
      let threat = null; if (M.dist2(px, pz, f.hx, f.hz) < 7 * 7 && (!car || car.absSpeed > 0.5)) threat = [px, pz];
      if (!threat) for (const c of W.cars) { if (c.removed || c.absSpeed < 2) continue; if (M.dist2(c.x, c.z, f.hx, f.hz) < 9 * 9) { threat = [c.x, c.z]; break; } }
      if (!threat && f.fly <= 0) for (const q of W.peds) { if (q.removed || q.inCar || q.speed < 0.5) continue; if (M.dist2(q.x, q.z, f.hx, f.hz) < 3 * 3) { threat = [q.x, q.z]; break; } }
      if (threat && f.fly <= 0) { f.fly = 4 + rng() * 3; f.scared = 1; for (const b of f.birds) { const dx = b.p.x - threat[0], dz = b.p.z - threat[1]; const l = Math.hypot(dx, dz) || 1; const a = Math.atan2(dx, dz) + (rng() - 0.5) * 1.2; b.vx = Math.sin(a) * (4 + rng() * 3); b.vz = Math.cos(a) * (4 + rng() * 3); b.vy = 3 + rng() * 2; b.p.a = Math.atan2(b.vx, b.vz); } AUDIO.play('flap', f.hx, f.hz); }
      if (f.fly > 0) { f.fly -= dt; const landing = f.fly < 2;
        for (const b of f.birds) { const p = b.p; const g = CITY.groundY(p.x, p.z);
          if (!landing) { b.vy += ((g + 2.6 + Math.sin(t * 2 + p.hop) * 0.6) - p.y) * 4 * dt - b.vy * 1.5 * dt; b.vx += (rng() - 0.5) * 2 * dt; b.vz += (rng() - 0.5) * 2 * dt; }
          else { const hx = f.hx + (rng() - 0.5) * 4, hz = f.hz + (rng() - 0.5) * 4; b.vx += (hx - p.x) * 0.8 * dt; b.vz += (hz - p.z) * 0.8 * dt; b.vy += ((g + 0.2) - p.y) * 2 * dt - b.vy * 1.5 * dt; }
          p.x += b.vx * dt; p.z += b.vz * dt; p.y = Math.max(g, p.y + b.vy * dt); const sp = Math.hypot(b.vx, b.vz); if (sp > 0.3) p.a = Math.atan2(b.vx, b.vz); p.pitch = M.clamp(-b.vy * 0.15, -0.5, 0.5); p.sy = 1 + Math.sin(t * 28 + p.hop * 7) * 0.5; // a fast flap
          if (f.fly <= 0) { p.y = g; p.sy = 1; p.pitch = 0; b.vx = b.vz = b.vy = 0; } } }
      else for (const b of f.birds) { const p = b.p; p.hop -= dt; if (p.hop <= 0) { p.hop = 1 + rng() * 3; p.a += (rng() - 0.5) * 2; const st = rng() * 0.5; p.x += Math.sin(p.a) * st; p.z += Math.cos(p.a) * st; p.y = CITY.groundY(p.x, p.z); } p.pitch = (p.hop % 1) < 0.15 ? 0.5 : 0; } }
    // ---- gulls
    for (const g of gulls) { g.ph += g.w * g.dir * dt; const p = g.p; p.x = g.cx + Math.cos(g.ph) * g.r; p.z = g.cz + Math.sin(g.ph) * g.r; p.y = g.h + Math.sin(t * 0.7 + g.ph) * 1.5; p.a = Math.atan2(-Math.sin(g.ph) * g.dir, Math.cos(g.ph) * g.dir); p.roll = 0.35 * g.dir; p.sy = 1 + (Math.sin(t * 6 + g.ph * 3) > 0.6 ? 0.6 : 0); }
    // ---- steam from the manholes, litter on the wind
    if (W.state.frame % 3 === 0) for (const m of CITY.manholes) { if (!m.steam || M.dist2(m.x, m.z, px, pz) > 90 * 90) continue; W.particle(m.x + (rng() - 0.5) * 0.4, 0.15, m.z + (rng() - 0.5) * 0.4, wind[0] * 0.4 + (rng() - 0.5) * 0.3, 0.7 + rng() * 0.5, wind[1] * 0.4 + (rng() - 0.5) * 0.3, 2.2 + rng() * 1.5, 0.5, [0.92, 0.92, 0.95], 0.2, { grav: -0.15, grow: 1.2, drag: 0.3 }); }
    paperT -= dt; const gust = 0.4 + W.weather.rain * 0.8; if (paperT <= 0) { paperT = 1.2 / gust; const a = rng() * 6.28, d = 12 + rng() * 40; const x = px + Math.sin(a) * d, z = pz + Math.cos(a) * d; if (CITY.onRoad(x, z) || CITY.groundY(x, z) > 0) W.particle(x, 0.25, z, wind[0] * (2 + rng() * 3), 0.6 + rng() * 1.5, wind[1] * (2 + rng() * 3), 3 + rng() * 3, 0.22, rng() < 0.5 ? [0.92, 0.9, 0.85] : [0.6, 0.5, 0.3], 0.9, { grav: 1.2, drag: 0.15, ground: true }); }
    // ---- a plane, once in a while
    planeT -= dt; if (planeT <= 0 && !plane) { planeT = 150 + rng() * 150; const along = rng() < 0.5; const s = 1000 + rng() * 300; plane = { x: along ? -500 : rng() * 900, z: along ? rng() * 900 : -500, y: 220 + rng() * 80, dir: along ? [1, 0] : [0, 1], speed: 55, t: 0, model: M.create(), bones: new Float32Array(16 * RENDER.MAX_BONES), emis: new Float32Array(RENDER.MAX_BONES), mesh: MESH.plane().build() }; for (let i = 0; i < RENDER.MAX_BONES; i++) plane.bones.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], i * 16); }
    if (plane) { plane.t += dt; plane.x += plane.dir[0] * plane.speed * dt; plane.z += plane.dir[1] * plane.speed * dt; if (plane.x > 1400 || plane.z > 1400) plane = null; else { const hd = Math.atan2(plane.dir[0], plane.dir[1]); M.trsEuler(plane.model, plane.x, plane.y, plane.z, hd, 0, 0, 1, 1, 1); plane.emis.fill(0); plane.emis[1] = (plane.t % 1.2) < 0.12 ? 3 : 0; if (W.state.frame % 2 === 0) for (const sx of [-5, 5]) { const r = [-Math.cos(hd), Math.sin(hd)]; W.particle(plane.x + r[0] * sx - plane.dir[0] * 8, plane.y - 1.5, plane.z + r[1] * sx - plane.dir[1] * 8, 0, 0.1, 0, 18, 3, [1, 1, 1], 0.28, { grow: 1.05, drag: 0 }); } } }
  }
  function entities(out) { if (plane) out.push({ mesh: plane.mesh, model: plane.model, bones: plane.bones, emis: plane.emis }); }
  return { init, launchFerry, update, entities, get ferry() { return ferry; } };
})();
