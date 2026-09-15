// GRIFT CITY — boot, the frame loop, the scene assembly and save games.
'use strict';
const GAME = (() => {
  const quality = { shadows: true };
  let canvas, hud, state = 'loading', last = 0, staticMesh = null, propList = [], started = false, accum = 0;
  const SAVE_KEY = 'grift-city-save-v1';
  function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
  function save() { try { const P = PLAYER.P; localStorage.setItem(SAVE_KEY, JSON.stringify({ x: P.x, z: P.z, money: P.money, health: P.health, armor: P.armor, weapons: Object.fromEntries(Object.entries(P.weapons).map(([k, v]) => [k, v === Infinity ? -1 : v])), weapon: P.weapon, stats: P.stats, progress: MISSIONS.S.progress, done: MISSIONS.S.done, time: W.state.time, packages: W.pickups.filter(p => p.kind === 'package' && p.taken).map(p => p.id) })); } catch (e) { } }
  function load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (!s) return false; const P = PLAYER.P; P.x = s.x; P.z = s.z; P.money = s.money; P.health = s.health || 100; P.armor = s.armor || 0; P.weapons = Object.fromEntries(Object.entries(s.weapons).map(([k, v]) => [k, v === -1 ? Infinity : v])); P.weapon = s.weapon in P.weapons ? s.weapon : 'fist'; P.weaponOut = P.weapon !== 'fist'; Object.assign(P.stats, s.stats || {}); MISSIONS.S.progress = s.progress || 0; MISSIONS.S.done = s.done || {}; W.state.time = s.time ?? 9; for (const p of W.pickups) if (p.kind === 'package' && (s.packages || []).includes(p.id)) p.taken = true; return true; } catch (e) { return false; } }
  function newGame() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } location.reload(); }
  function onPackage(n) { if (n % 5 === 0) { const s = CITY.place('safehouse'); const w = ['uzi', 'shotgun', 'rifle', 'rocket'][n / 5 - 1]; PICKUPS.add('weapon', s.x + 4, s.z - 4, { weapon: w, ammo: w === 'rocket' ? 4 : 60, respawn: 240 }); HUD.notify(WEAPONS[w].name + ' now spawns at the safehouse'); } }

  function boot() {
    canvas = document.getElementById('gl'); hud = document.getElementById('hud'); HUD.init(hud); INPUT.init(canvas);
    HUD.draw(0, 'loading');
    setTimeout(build, 30);
  }
  function build() {
    RENDER.init(canvas, TEX.build());
    const sb = CITY.generate(); staticMesh = sb.build(); W.indexLights(); W.initProps();
    propList = ['lamppost', 'trafficLight', 'tree', 'hydrant', 'bin', 'bench', 'bollard'].map(k => W.propMeshes[k]); propList.push(W.lampHeads, W.tlHeads);
    PICKUPS.placeWorld(); VEH.spawnParked();
    const sh = CITY.place('safehouse'); PLAYER.init(sh.x + 6, sh.z + 1, Math.PI);
    if (hasSave()) load();
    RENDER.setTimeOfDay(W.state.time);
    // pre-warm a few frames of traffic and peds around the player
    for (let i = 0; i < 40; i++) { VEH.spawnTraffic(PLAYER.x, PLAYER.z, PLAYER.P.camYaw + Math.PI, 26); PEDS.populate(PLAYER.x, PLAYER.z, PLAYER.P.camYaw + Math.PI, 40); }
    state = 'title';
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
    if (state === 'title') { RENDER.setTimeOfDay(W.state.time); titleCamera(now / 1000); renderWorld(dt, true); HUD.draw(dt, 'title'); INPUT.endFrame(); return; }
    if (INPUT.hit('Escape')) { if (MISSIONS.shop) { } else if (state === 'playing') { state = 'paused'; INPUT.releaseLock(); } else if (state === 'paused') { state = 'playing'; INPUT.requestLock(); } }
    if (INPUT.hit('Tab')) { if (state === 'playing') state = 'map'; else if (state === 'map') state = 'playing'; }
    if (INPUT.hit('KeyM')) AUDIO.toggleMute();
    if (state === 'paused' && INPUT.hit('KeyK')) quality.shadows = !quality.shadows;
    if (state === 'paused' && INPUT.hit('KeyN')) newGame();
    if (state === 'playing' && !INPUT.locked && INPUT.mouse.clicked) INPUT.requestLock();
    if (state === 'playing' && !window.__manual) { step(dt); }
    fpsAcc += dt; fpsN++; if (fpsAcc > 1) { window.__fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    renderWorld(dt, false); HUD.draw(dt, state); INPUT.endFrame();
  }
  let fpsAcc = 0, fpsN = 0;
  // Deterministic stepping for tests: window.__sim(seconds) advances the simulation without rendering.
  window.__sim = (seconds, keys = []) => { window.__manual = true; for (const k of keys) window.dispatchEvent(new KeyboardEvent('keydown', { code: k })); for (let t = 0; t < seconds; t += 1 / 60) { step(1 / 60); INPUT.endFrame(); } for (const k of keys) window.dispatchEvent(new KeyboardEvent('keyup', { code: k })); };
  function step(dt) {
    W.frameBegin(); W.updateClock(dt); RENDER.setTimeOfDay(W.state.time); const night = W.isNight();
    const dlg = !!MISSIONS.dialogue;
    MISSIONS.update(dt);
    if (!dlg) PLAYER.update(dt); else { PLAYER.P.aim = 0; PLAYER.P.vx = PLAYER.P.vz = 0; if (PLAYER.car) { PLAYER.car.controls.throttle = 0; PLAYER.car.controls.brake = 1; } PLAYER.update(0); }
    PLAYER.updateProjectiles(dt);
    VEH.updateAll(dt, night); PEDS.updateAll(dt); POLICE.update(dt); PICKUPS.update(dt);
    W.updateLights(dt); W.updateKnocked(dt); W.updateExplosions(dt); W.updateParticles(dt);
    // population management
    const px = PLAYER.x, pz = PLAYER.z, yaw = W.state.camYaw;
    if (W.state.frame % 4 === 0) VEH.spawnTraffic(px, pz, yaw, night ? 20 : 28);
    if (W.state.frame % 3 === 0) PEDS.populate(px, pz, yaw, night ? 26 : 44);
    if (W.state.frame % 30 === 0) { VEH.despawn(px, pz); PEDS.despawn(px, pz); }
    AUDIO.listener(px, pz); AUDIO.radioTick(dt, !!PLAYER.car); if (!PLAYER.car) { AUDIO.engine(false, 0, 0); AUDIO.screech(0); }
    // hydrant fountains
    for (const p of CITY.props.hydrant) if (p.hydrantT > 0) { p.hydrantT -= dt; if (W.state.frame % 2 === 0) W.particle(p.x, 0.4, p.z, (W.rng() - 0.5) * 1.5, 9 + W.rng() * 5, (W.rng() - 0.5) * 1.5, 1.4, 0.45, [0.75, 0.88, 1], 0.7, { grav: 12, grow: 0.8 }); }
  }
  function titleCamera(t) { const g = CITY.place('tower'); const a = t * 0.08; const x = g.x + Math.sin(a) * 120, z = g.z + 20 + Math.cos(a) * 120; RENDER.setCamera(x, 60 + Math.sin(t * 0.2) * 10, z, g.x, 60, g.z); W.state.camYaw = Math.atan2(g.x - x, g.z - z); }
  function renderWorld(dt, title) {
    const night = RENDER.env.nightEmis > 0.05; const cam = RENDER.cam;
    RENDER.env.shadowOn = RENDER.env.shadowOn && quality.shadows;
    scene.statics = [staticMesh]; scene.entities.length = 0;
    W.fx.begin();
    for (const c of W.cars) { if (c.removed || M.dist2(c.x, c.z, cam.tx, cam.tz) > 300 * 300) continue; scene.entities.push(c.entity(night)); if (night) c.headlightFX(); }
    for (const p of W.peds) { if (p.removed || p.inCar || M.dist2(p.x, p.z, cam.tx, cam.tz) > 140 * 140) continue; scene.entities.push(p.entity()); }
    const pe = PLAYER.entity(); if (pe && !title) scene.entities.push(pe);
    for (const e of PLAYER.projectileEntities()) scene.entities.push(e);
    for (const e of PICKUPS.entities(cam.tx, cam.tz)) scene.entities.push(e);
    const he = POLICE.heliEntity(); if (he) scene.entities.push(he);
    if (!title) { MISSIONS.markersFX(W.state.elapsed); PLAYER.drawFX(); }
    // soft blob shadows under peds at night (sun shadows are off)
    if (!RENDER.env.shadowOn) { for (const p of W.peds) if (!p.removed && !p.inCar && M.dist2(p.x, p.z, cam.tx, cam.tz) < 60 * 60) W.fx.blob(p.x, p.y + 0.02, p.z, 0.45, 0.35); if (!PLAYER.car && !title) W.fx.blob(PLAYER.x, PLAYER.y + 0.02, PLAYER.z, 0.45, 0.35); for (const c of W.cars) if (!c.removed && M.dist2(c.x, c.z, cam.tx, cam.tz) < 120 * 120) W.fx.blob(c.x, c.y + 0.02, c.z, c.spec.len * 0.45, 0.3); }
    W.fx.end();
    W.updateProps(cam.tx, cam.tz); scene.props = propList;
    RENDER.beginFrame(canvas); RENDER.setLights(W.collectLights(cam.tx, cam.tz));
    RENDER.render(canvas, scene, W.state.elapsed);
  }
  window.addEventListener('load', boot);
  return { quality, save, load, hasSave, newGame, onPackage, get state() { return state; }, set state(s) { state = s; }, startPlay };
})();
