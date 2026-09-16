// GRIFT CITY — boot, the frame loop, the scene assembly and save games.
'use strict';
const GAME = (() => {
  const quality = { shadows: true };
  const options = { sensitivity: 1.0, invertY: false, bloom: true, resolution: 1.5, shadows: true };
  function loadOptions() { try { Object.assign(options, JSON.parse(localStorage.getItem('grift-city-options') || '{}')); } catch (e) { } applyOptions(); }
  function saveOptions() { try { localStorage.setItem('grift-city-options', JSON.stringify(options)); } catch (e) { } applyOptions(); }
  function applyOptions() { quality.shadows = options.shadows; RENDER.post.enabled = options.bloom; RENDER.post.dprCap = options.resolution; }
  let canvas, hud, state = 'loading', last = 0, staticMesh = null, waterMesh = null, propList = [], started = false, accum = 0;
  const SAVE_KEY = 'grift-city-save-v1';
  function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
  function save() { try { const P = PLAYER.P; const sh = CITY.place('safehouse'); let garage = null; for (const c of W.cars) if (!c.removed && !c.wrecked && c.playerOwned && M.dist(c.x, c.z, sh.x, sh.z) < 12) { garage = { type: c.type, color: c.colIdx, x: c.x, z: c.z, angle: c.angle }; break; } localStorage.setItem(SAVE_KEY, JSON.stringify({ garage, econ: ECON.saveData(), flags: MISSIONS.S.flags, progress2: MISSIONS.S.progress2, phoneProgress: MISSIONS.S.phoneProgress, rampageDone: MISSIONS.S.rampageDone, x: P.x, z: P.z, money: P.money, health: P.health, armor: P.armor, weapons: Object.fromEntries(Object.entries(P.weapons).map(([k, v]) => [k, v === Infinity ? -1 : v])), weapon: P.weapon, stats: P.stats, progress: MISSIONS.S.progress, done: MISSIONS.S.done, time: W.state.time, packages: W.pickups.filter(p => p.kind === 'package' && p.taken).map(p => p.id) })); } catch (e) { } }
  function load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (!s) return false; const P = PLAYER.P; P.x = s.x; P.z = s.z; P.money = s.money; P.health = s.health || 100; P.armor = s.armor || 0; P.weapons = Object.fromEntries(Object.entries(s.weapons).map(([k, v]) => [k, v === -1 ? Infinity : v])); P.weapon = s.weapon in P.weapons ? s.weapon : 'fist'; P.weaponOut = P.weapon !== 'fist'; Object.assign(P.stats, s.stats || {}); MISSIONS.S.progress = s.progress || 0; MISSIONS.S.done = s.done || {}; MISSIONS.S.progress2 = s.progress2 || 0; MISSIONS.S.phoneProgress = s.phoneProgress || 0; MISSIONS.S.rampageDone = s.rampageDone || {}; ECON.loadData(s.econ); MISSIONS.S.flags = s.flags || {}; if (!Array.isArray(P.stats.jumps)) P.stats.jumps = []; if (s.garage) { const c = VEH.spawn(s.garage.type, s.garage.x, s.garage.z, s.garage.angle, { mode: 'parked', color: s.garage.color }); c.playerOwned = true; } W.state.time = s.time ?? 9; for (const p of W.pickups) if (p.kind === 'package' && (s.packages || []).includes(p.id)) p.taken = true; return true; } catch (e) { return false; } }
  function newGame() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } location.reload(); }
  function onPackage(n) { if (n % 5 === 0) { const s = CITY.place('safehouse'); const w = ['uzi', 'shotgun', 'rifle', 'rocket'][n / 5 - 1]; PICKUPS.add('weapon', s.x + 4, s.z - 4, { weapon: w, ammo: w === 'rocket' ? 4 : 60, respawn: 240 }); HUD.notify(WEAPONS[w].name + ' now spawns at the safehouse'); } }

  function boot() {
    canvas = document.getElementById('gl'); hud = document.getElementById('hud'); HUD.init(hud); INPUT.init(canvas);
    HUD.draw(0, 'loading');
    setTimeout(build, 30);
  }
  function build() {
    RENDER.init(canvas, TEX.build()); loadOptions();
    const sb = CITY.generate(); console.log('static tris', (sb.i.length / 3) | 0, 'verts', sb.n); staticMesh = sb.build(); waterMesh = CITY.water.build(); waterMesh.uvOff = new Float32Array(2); waterMesh.spec = 0.9; waterMesh.water = true; W.indexLights(); W.initProps();
    propList = ['lamppost', 'trafficLight', 'tree', 'hydrant', 'bin', 'bench', 'bollard', 'payphone', 'dumpster', 'mailbox', 'meter', 'newsbox', 'busShelter', 'cone', 'barrier', 'hedge', 'roundTree', 'palm', 'umbrella', 'streetSign'].map(k => W.propMeshes[k]); propList.push(W.lampHeads, W.tlHeads);
    PICKUPS.placeWorld(); MISSIONS.placeRampages(); VEH.spawnParked(); VEH.spawnMarina();
    const sh = CITY.place('safehouse'); PLAYER.init(sh.x + 6, sh.z + 1, Math.PI);
    if (hasSave()) load();
    RENDER.setTimeOfDay(W.state.time);
    // pre-warm a few frames of traffic and peds around the player
    for (let i = 0; i < 40; i++) { VEH.spawnTraffic(PLAYER.x, PLAYER.z, PLAYER.P.camYaw + Math.PI, 26); PEDS.populate(PLAYER.x, PLAYER.z, PLAYER.P.camYaw + Math.PI, 40); }
    state = 'title';
    INPUT.onLockLost = () => { if (state === 'playing' && !MISSIONS.shop) { state = 'paused'; INPUT.releaseLock(); } };
    document.addEventListener('mousedown', () => { if (state === 'title') startPlay(); }, { once: false });
    window.addEventListener('keydown', e => { if (state === 'title' && e.code === 'KeyN') newGame(); });
    window.__ready = true;
    last = performance.now(); requestAnimationFrame(frame);
  }
  function startPlay() { AUDIO.resume(); INPUT.requestLock(); state = 'playing'; started = true; HUD.notify('Welcome to Grift City.'); }

  const scene = { statics: [], props: [], entities: [], flat: W.F, particles: W.P };
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - last) / 1000); last = now; INPUT.pollPad();
    if (window.__pt) { // playtest mode: fixed timestep, render every N steps, full quality only on request
      const pt = window.__pt; if (pt.paused) { INPUT.endFrame(); return; } dt = pt.dt; pt.n = (pt.n || 0) + 1; const shot = pt.wantShot;
      if (pt.bot && state === 'playing') pt.bot(dt);
      if (state === 'playing') step(dt);
      if (shot || pt.n % pt.renderEvery === 0) { const qs = quality.shadows, qp = RENDER.post.enabled; if (!shot && pt.cheap) { quality.shadows = false; RENDER.post.enabled = false; } renderWorld(dt * pt.renderEvery, false); HUD.draw(dt * pt.renderEvery, state); quality.shadows = qs; RENDER.post.enabled = qp; if (shot) { pt.wantShot = false; pt.shotFrame = pt.n; } }
      if (INPUT.hit('Escape') && state === 'playing') { /* bot never pauses */ }
      INPUT.endFrame(); return;
    }
    if (state === 'title') { RENDER.setTimeOfDay(W.state.time, W.weather.rain); titleCamera(now / 1000); renderWorld(dt, true); HUD.draw(dt, 'title'); INPUT.endFrame(); return; }
    if (INPUT.hit('Escape')) { if (MISSIONS.shop) { } else if (state === 'playing') { state = 'paused'; INPUT.releaseLock(); } else if (state === 'paused') { state = 'playing'; INPUT.requestLock(); } }
    if (INPUT.hit('Tab')) { if (state === 'playing') state = 'map'; else if (state === 'map') state = 'playing'; }
    if (INPUT.hit('KeyM')) AUDIO.toggleMute();
    if (state === 'paused') {
      if (INPUT.hit('KeyK')) { options.shadows = !options.shadows; saveOptions(); }
      if (INPUT.hit('KeyB')) { options.bloom = !options.bloom; saveOptions(); }
      if (INPUT.hit('KeyI')) { options.invertY = !options.invertY; saveOptions(); }
      if (INPUT.hit('KeyP')) { options.resolution = options.resolution >= 1.5 ? 1.0 : options.resolution >= 1.0 ? 0.75 : 1.5; saveOptions(); }
      if (INPUT.hit('BracketLeft')) { options.sensitivity = Math.max(0.3, +(options.sensitivity - 0.1).toFixed(1)); saveOptions(); }
      if (INPUT.hit('BracketRight')) { options.sensitivity = Math.min(3, +(options.sensitivity + 0.1).toFixed(1)); saveOptions(); }
    }
    if (state === 'paused' && INPUT.hit('KeyN')) newGame();
    if (state === 'playing' && !INPUT.locked && INPUT.mouse.clicked) INPUT.requestLock();
    if (state === 'paused' && INPUT.mouse.clicked) { state = 'playing'; INPUT.requestLock(); }
    if (state === 'playing' && !window.__manual) { step(dt); }
    fpsAcc += dt; fpsN++; if (fpsAcc > 1) { window.__fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    renderWorld(dt, false); HUD.draw(dt, state); INPUT.endFrame();
  }
  let fpsAcc = 0, fpsN = 0;
  // Playtest bot hooks: a compact state snapshot and a road route to a point.
  window.__ptState = () => { const P = PLAYER.P; const c = P.car; const bp = MISSIONS.blipPos(); let nc = null, nd = 1e9; for (const v of W.cars) { if (v.removed || v.wrecked || v === c) continue; const d = M.dist(v.x, v.z, P.x, P.z); if (d < nd) { nd = d; nc = v; } }
    const tgt = bp && MISSIONS.S.blip && MISSIONS.S.blip.obj; const tc = tgt && tgt.spec ? tgt : null;
    return { frame: W.state.frame, n: window.__pt && window.__pt.n, time: W.clockString(), x: P.x, z: P.z, angle: P.angle, camYaw: P.camYaw, alive: P.alive, state: P.state, hp: P.health, wanted: P.wanted, money: P.money, weapon: P.weapon, ammo: P.weapons[P.weapon], entering: P.state === 'entering',
      car: c ? { x: c.x, z: c.z, angle: c.angle, speed: c.speed, abs: c.absSpeed, type: c.type, health: c.health / c.maxHealth, wrecked: c.wrecked, air: c.airborne } : null,
      blip: bp ? { x: bp.x, z: bp.z, isCar: !!tc, carSpeed: tc ? tc.absSpeed : 0, carDriver: tc ? (tc.driver ? (tc.driver === PLAYER ? 'me' : 'npc') : 'none') : null, carWrecked: tc ? tc.wrecked : false } : null,
      objective: MISSIONS.objective, dialogue: !!MISSIONS.dialogue, shop: !!MISSIONS.shop, mission: MISSIONS.S.current ? MISSIONS.S.current.name : null, progress: MISSIONS.S.progress,
      nearCar: nc ? { x: nc.x, z: nc.z, dist: nd, driver: nc.driver ? 'npc' : 'none', type: nc.type, speed: nc.absSpeed } : null, cops: W.peds.filter(q => q.alive && q.isCop && !q.inCar).length, copCars: W.cars.filter(v => !v.removed && v.ai.mode === 'chase').length, stats: P.stats }; };
  window.__ptWalkRoute = (tx, tz) => { // BFS over the sidewalk graph from the nearest node to the node nearest the target
    const P = PLAYER.P; const start = CITY.nearestWalkNode(P.x, P.z), goal = CITY.nearestWalkNode(tx, tz); const prev = new Map([[start, null]]); const q = [start]; let ok = false;
    while (q.length) { const n = q.shift(); if (n === goal) { ok = true; break; } for (const l of n.links) if (!prev.has(l.to)) { prev.set(l.to, n); q.push(l.to); } }
    const pts = []; let cur = goal; while (cur) { pts.unshift([cur.x, cur.z]); cur = prev.get(cur); } pts.push([tx, tz]); return pts; };
  window.__ptRoute = (tx, tz) => { // BFS over the intersection grid, then lane points on the right side of travel
    const G = CITY.GRID, PT = CITY.PITCH; const ni = x => M.clamp(Math.round(x / PT), 0, G), key = (i, j) => i + ',' + j;
    const P = PLAYER.P; const sx = P.x, sz = P.z; const si = ni(sx), sj = ni(sz), ti = ni(tx), tj = ni(tz);
    const prev = {}; const q = [[si, sj]]; prev[key(si, sj)] = null; let found = false;
    while (q.length) { const [i, j] = q.shift(); if (i === ti && j === tj) { found = true; break; } for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b2 = j + dj; if (a < 0 || a > G || b2 < 0 || b2 > G || prev[key(a, b2)] !== undefined) continue; prev[key(a, b2)] = [i, j]; q.push([a, b2]); } }
    const nodes = []; let cur = [ti, tj]; while (cur) { nodes.unshift(cur); cur = prev[key(cur[0], cur[1])]; }
    const pts = [];
    for (let k = 0; k + 1 < nodes.length; k++) { const [i, j] = nodes[k], [i2, j2] = nodes[k + 1]; const dx = Math.sign(i2 - i), dz = Math.sign(j2 - j); const rx = -dz, rz = dx; const x0 = i * PT, z0 = j * PT, x1 = i2 * PT, z1 = j2 * PT; pts.push([x0 + dx * 9 + rx * 1.75, z0 + dz * 9 + rz * 1.75]); pts.push([x1 - dx * 9 + rx * 1.75, z1 - dz * 9 + rz * 1.75]); }
    pts.push([tx, tz]); return pts; };
  // Deterministic stepping for tests: window.__sim(seconds) advances the simulation without rendering.
  // Debug geometry for the visual tests: unlit (emissive) boxes drawn as entities. __renderOnce draws one frame on demand.
  window.__debugBoxes = [];
  window.__debugBox = (x, y, z, w, h, d, col, tile = 0, emis = 1) => { const b = new MESH.Builder(); b.box(x, y, z, w, h, d, col, tile, { uvScale: Math.max(w, d), uvScaleV: h }); const bones = new Float32Array(16 * RENDER.MAX_BONES); for (let i = 0; i < RENDER.MAX_BONES; i++) bones.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], i * 16); const em = new Float32Array(RENDER.MAX_BONES); em.fill(emis); const e = { mesh: b.build(), model: M.identity(M.create()), bones, emis: em }; window.__debugBoxes.push(e); return e; };
  window.__renderOnce = () => { if (PLAYER.updateCamera) for (let i = 0; i < 120; i++) PLAYER.updateCamera(1 / 60); /* let the chase camera settle on the new position */ renderWorld(1 / 60, false); HUD.draw(1 / 60, state); };
  window.__sim = (seconds, keys = []) => { window.__manual = true; for (const k of keys) window.dispatchEvent(new KeyboardEvent('keydown', { code: k })); for (let t = 0; t < seconds; t += 1 / 60) { step(1 / 60); INPUT.endFrame(); } for (const k of keys) window.dispatchEvent(new KeyboardEvent('keyup', { code: k })); };
  // Cheats, typed anywhere during play. Old habits.
  const CHEATS = {
    BIGBANK: () => { PLAYER.addMoney(25000, 'cheat'); },
    KEVLAR: () => { PLAYER.P.health = 100; PLAYER.P.armor = 100; HUD.notify('Health and armor restored'); },
    ARSENAL: () => { for (const k of ['bat', 'pistol', 'uzi', 'shotgun', 'rifle', 'rocket', 'grenade']) PLAYER.giveWeapon(k, 200); HUD.notify('Every weapon in the cabinet'); },
    COOLOFF: () => { POLICE.clear(); HUD.notify('The cops forgot about you'); },
    HOTHEAD: () => { POLICE.setStars(Math.min(5, PLAYER.wanted + 2)); },
    NIGHTFALL: () => { W.state.time = 22; HUD.notify('Night falls'); },
    DOWNPOUR: () => { W.weather.target = 1; W.weather.nextChange = 3; HUD.notify('Rain'); },
    CLEARSKY: () => { W.weather.target = 0; W.weather.rain = 0; W.weather.nextChange = 6; HUD.notify('Clear skies'); },
    SUNRISE: () => { W.state.time = 8; HUD.notify('Morning comes'); },
    FALCATA: () => { const P = PLAYER.P; const c = VEH.spawn('sports', P.x + 3, P.z, P.camYaw, { mode: 'parked', color: 0 }); c.playerOwned = true; HUD.notify('A Falcata appears'); },
    BASTION: () => { const P = PLAYER.P; const c = VEH.spawn('swat', P.x + 3, P.z, P.camYaw, { mode: 'parked' }); c.playerOwned = true; HUD.notify('A Bastion appears'); },
  };
  function checkCheats() { const t = INPUT.typed; for (const k in CHEATS) if (t.endsWith(k)) { INPUT.typed = ''; CHEATS[k](); AUDIO.play('cash'); } }
  function step(dt) {
    checkCheats();
    W.frameBegin(); W.updateClock(dt); W.updateWeather(dt); RENDER.setTimeOfDay(W.state.time, W.weather.rain, W.weather.fog); const night = W.isNight();
    const dlg = !!MISSIONS.dialogue;
    MISSIONS.update(dt); ECON.update(dt);
    if (!dlg) PLAYER.update(dt); else { PLAYER.P.aim = 0; PLAYER.P.vx = PLAYER.P.vz = 0; if (PLAYER.car) { PLAYER.car.controls.throttle = 0; PLAYER.car.controls.brake = 1; } PLAYER.updateCamera(dt); }
    PLAYER.updateProjectiles(dt);
    VEH.updateAll(dt, night); PEDS.updateAll(dt); POLICE.update(dt); PICKUPS.update(dt);
    W.updateLights(dt); W.updateKnocked(dt); W.updateExplosions(dt); W.updateParticles(dt);
    // population management
    const px = PLAYER.x, pz = PLAYER.z, yaw = W.state.camYaw;
    const busy = W.bustle(W.state.time); // rush hours fill the streets, the small hours empty them
    if (W.state.frame % 4 === 0) VEH.spawnTraffic(px, pz, yaw, Math.round(12 + 24 * busy));
    if (W.state.frame % 3 === 0) PEDS.populate(px, pz, yaw, Math.round(12 + 46 * busy));
    if (W.state.frame % 20 === 10) { PEDS.trim(px, pz, yaw, Math.round(12 + 46 * busy)); VEH.trim(px, pz, yaw, Math.round(12 + 24 * busy)); }
    if (W.state.frame % 30 === 0) { VEH.despawn(px, pz); PEDS.despawn(px, pz); }
    AUDIO.listener(px, pz); AUDIO.rain(W.weather.rain, !!PLAYER.car); if (W.state.frame % 20 === 0) { let n = 0; for (const c of W.cars) if (!c.removed && c.absSpeed > 2 && M.dist2(c.x, c.z, px, pz) < 60 * 60) n++; AUDIO.traffic(Math.min(1, n / 8)); } AUDIO.radioTick(dt, !!PLAYER.car); if (!PLAYER.car) { AUDIO.engine(false, 0, 0); AUDIO.screech(0); }
    // hydrant fountains
    for (const p of CITY.props.hydrant) if (p.hydrantT > 0) { p.hydrantT -= dt; if (W.state.frame % 2 === 0) W.particle(p.x, 0.4, p.z, (W.rng() - 0.5) * 1.5, 9 + W.rng() * 5, (W.rng() - 0.5) * 1.5, 1.4, 0.45, [0.75, 0.88, 1], 0.7, { grav: 12, grow: 0.8 }); }
  }
  function titleCamera(t) { const g = CITY.place('tower'); const a = t * 0.06; const x = g.roofX + Math.sin(a) * 260, z = g.roofZ + Math.cos(a) * 260; RENDER.setCamera(x, 150 + Math.sin(t * 0.15) * 20, z, g.roofX, 70, g.roofZ); W.state.camYaw = Math.atan2(g.roofX - x, g.roofZ - z); }
  function renderWorld(dt, title) {
    const night = RENDER.env.nightEmis > 0.05; const cam = RENDER.cam;
    RENDER.env.shadowOn = RENDER.env.shadowOn && quality.shadows;
    waterMesh.uvOff[0] = W.state.elapsed * 0.01; waterMesh.uvOff[1] = Math.sin(W.state.elapsed * 0.3) * 0.02; scene.statics = [staticMesh, waterMesh]; scene.entities.length = 0;
    W.fx.begin(); W.drawDecals(cam.tx, cam.tz, dt); W.lampCones(cam.tx, cam.tz);
    for (const c of W.cars) { if (c.removed || M.dist2(c.x, c.z, cam.tx, cam.tz) > 300 * 300) continue; scene.entities.push(c.entity(night)); if (night) c.headlightFX();
      if (M.dist2(c.x, c.z, cam.tx, cam.tz) < 90 * 90) { // occupants, seen through the glass
        if (c.driver && c.driver !== PLAYER) scene.entities.push(PEDS.seatedEntity(c.driver, c, 0, true));
        else if (c.driver === PLAYER && !title) scene.entities.push(PEDS.seatedEntity(PLAYER.P, c, 0, true));
        c.passengers.forEach((q, i) => { if (!q.removed) scene.entities.push(PEDS.seatedEntity(q, c, i + 1, false)); }); } }
    for (const p of W.peds) { if (p.removed || p.inCar || M.dist2(p.x, p.z, cam.tx, cam.tz) > 140 * 140) continue; scene.entities.push(p.entity()); }
    for (const e of window.__debugBoxes) scene.entities.push(e);
    const pe = PLAYER.entity(); if (pe && !title) scene.entities.push(pe);
    for (const e of PLAYER.projectileEntities()) scene.entities.push(e);
    for (const e of PICKUPS.entities(cam.tx, cam.tz)) scene.entities.push(e);
    const he = POLICE.heliEntity(); if (he) scene.entities.push(he);
    if (!title) { MISSIONS.markersFX(W.state.elapsed); ECON.markersFX(W.state.elapsed); PLAYER.drawFX(); }
    // soft blob shadows under peds at night (sun shadows are off)
    if (!RENDER.env.shadowOn) { for (const p of W.peds) if (!p.removed && !p.inCar && M.dist2(p.x, p.z, cam.tx, cam.tz) < 60 * 60) W.fx.blob(p.x, p.y + 0.02, p.z, 0.45, 0.35); if (!PLAYER.car && !title) W.fx.blob(PLAYER.x, PLAYER.y + 0.02, PLAYER.z, 0.45, 0.35); for (const c of W.cars) if (!c.removed && M.dist2(c.x, c.z, cam.tx, cam.tz) < 120 * 120) W.fx.blob(c.x, c.y + 0.02, c.z, c.spec.len * 0.45, 0.3); }
    W.fx.end();
    W.updateProps(cam.tx, cam.tz); scene.props = propList;
    RENDER.beginFrame(canvas); RENDER.setLights(W.collectLights(cam.tx, cam.tz));
    RENDER.render(canvas, scene, W.state.elapsed);
  }
  window.addEventListener('load', boot);
  return { quality, options, save, load, hasSave, newGame, onPackage, get state() { return state; }, set state(s) { state = s; }, startPlay };
})();
