// GRIFT CITY — boot, the frame loop, the scene assembly and save games.
'use strict';
const GAME = (() => {
  const quality = { shadows: true };
  const options = { ...SETTINGS.defaults, bindings: {} };
  // Adaptive quality: when frames stay slow the renderer steps down (render scale, ambient occlusion, shadows, post) one
  // level at a time, and steps back up when there is headroom. A slow machine gets a game that runs at full speed.
  const auto = { level: 0, ema: 16, slowT: 0, fastT: 0, told: false, warm: 0, badRaises: 0, sinceRaise: Infinity };
  const AUTO_LEVELS = 5, AO_STRENGTH = 0.65, STEP = 1 / 60, MAX_STEPS = 6;
  function loadOptions() { try { Object.assign(options, JSON.parse(localStorage.getItem('grift-city-options') || '{}')); } catch (e) { } SETTINGS.sanitize(options); applyOptions(); }
  function saveOptions() { try { localStorage.setItem('grift-city-options', JSON.stringify(options)); } catch (e) { } SETTINGS.sanitize(options); applyOptions(); }
  function applyOptions() { AUDIO.setMix(options);const L = options.auto ? auto.level : 0; quality.shadows = options.shadows && L < 5; RENDER.post.enabled = options.bloom && L < 4; RENDER.post.ao = L >= 2 ? 0 : AO_STRENGTH; RENDER.post.edges = options.edges && !/[?&]edges=0/.test(location.search) ? 0.4 : 0; RENDER.env.interiors = !/[?&]rooms=0/.test(location.search); /* the rungs shed what costs most per pixel and shows least first: probe rebuilds, lamp occlusion and distant lamps, normal maps; then AO, resolution, post and shadows */ RENDER.env.probes = L < 1; RENDER.env.localShadow = L < 1; RENDER.env.maxLights = L >= 3 ? 10 : L >= 2 ? 14 : L >= 1 ? 20 : 32; RENDER.env.normalMaps = L < 2; RENDER.post.dprCap = Math.min(options.resolution, L >= 3 ? 0.75 : L >= 1 ? 1.0 : 9); }
  // The decision alone, with no side effects, so it can be driven directly by a test. Returns 'lower', 'raise'
  // or null. What stops it oscillating is not a limit on how often quality may be restored -- that turned a few
  // transient stalls into a permanent downgrade on a machine well able to run it -- but a count of the restores
  // that did not hold: a raise undone within half a minute was the wrong call, and two of those settle it.
  // A display or browser capped at 30 Hz (Low Power Mode, a throttled iPad, some iframes) delivers a steady 33 ms
  // frame however light the scene is. Treating that as slow used to strip ink, bloom, AO, shadows and resolution
  // one rung at a time for nothing. A steady ~33 ms now gets one probing step down; if the frames do not get
  // faster within a few seconds the cap is real, the step is undone and 30 Hz becomes the baseline to judge by.
  function autoStep(a, raw) {
    const ms = Math.min(120, raw * 1000); a.ema += (ms - a.ema) * 0.06;
    a.capFrac = (a.capFrac ?? 0) + ((ms > 29.5 && ms < 37.5 ? 1 : 0) - (a.capFrac ?? 0)) * 0.03;
    const capped = (a.cap || 16.7) > 20, slowMs = capped ? 45 : 30, fastMs = capped ? 36.5 : 17.5;
    if (a.probe) {
      a.probe.t += raw;
      if (a.ema < 25) a.probe = null; // one rung made it fast: it really was slow
      else if (a.probe.t > 4) { a.probe = null; if (a.capFrac > 0.7) { a.cap = 33.3; a.level--; a.slowT = a.fastT = 0; a.ema = 33.3; a.sinceRaise = Infinity; return 'raise'; } }
      else return null;
    }
    if (a.ema > slowMs) { a.slowT += raw; a.fastT = 0; } else if (a.ema < fastMs) { a.fastT += raw; a.slowT = 0; } else { a.slowT = 0; a.fastT = 0; }
    a.sinceRaise += raw;
    if (a.slowT > 2.5 && a.level < AUTO_LEVELS) {
      if (a.sinceRaise < 30) a.badRaises++;
      const probing = !capped && a.capFrac > 0.8 && a.ema < 37.5;
      a.level++; a.slowT = 0; a.ema = probing ? 33.3 : capped ? 36 : 22; a.sinceRaise = Infinity; if (probing) a.probe = { t: 0 }; return 'lower';
    }
    if (a.fastT > 20 && a.level > 0 && a.badRaises < 2) { a.level--; a.fastT = 0; a.ema = capped ? 36 : 22; a.sinceRaise = 0; return 'raise'; }
    return null;
  }
  function autoQuality(raw) {
    if (!options.auto || window.__pt || state !== 'playing') return; auto.warm += raw; if (auto.warm < 4) return; // the first seconds after a load are shader warm-up, not a slow machine
    const act = autoStep(auto, raw);
    if (!act) return;
    applyOptions();
    if (act === 'lower' && !auto.told) { auto.told = true; HUD.notify('Slow frames: lowering render quality automatically (see the pause menu).'); }
  }
  let canvas, hud, state = 'loading', last = 0, staticMesh = null, waterMesh = null, propList = [], started = false, accum = 0;
  const SAVE_KEY = 'grift-city-save-v1';
  function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
  // What CONTINUE will load, for the title screen: the clock, cash and missions of the last save.
  let infoRaw = null, infoVal = null;
  function saveInfo() { try { const raw = localStorage.getItem(SAVE_KEY); if (raw === infoRaw) return infoVal; infoRaw = raw; infoVal = null; const s = JSON.parse(raw); if (!s) return null; const h = Math.floor(s.time ?? 9), m = Math.floor(((s.time ?? 9) - h) * 60); return (infoVal = { clock: (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m, money: Math.max(0, s.money || 0) | 0, missions: (s.stats && s.stats.missions) || 0 }); } catch (e) { return null; } }
  function save() {
    try {
      const P = PLAYER.P, sh = CITY.place('safehouse');
      let garage = null;
      for (const c of W.cars) if (!c.removed && !c.wrecked && c.playerOwned && M.dist(c.x, c.z, sh.x, sh.z) < 12) {
        garage = { type: c.type, color: c.colIdx, x: c.x, z: c.z, angle: c.angle, condition:c.saveCondition(), mods: { ...c.mods } };
        break;
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        version: 2, x: P.x, y: P.y, z: P.z, inside: MISSIONS.S.inside || null, roof: !!MISSIONS.S.roof,
        outfit: P.outfit || 0, job: MISSIONS.jobState ? MISSIONS.jobState() : null, garage,streetlife:STREETLIFE.save(), econ: ECON.saveData(), flags: MISSIONS.S.flags,
        progress2: MISSIONS.S.progress2, phoneProgress: MISSIONS.S.phoneProgress, rampageDone: MISSIONS.S.rampageDone,
        money: P.money, health: P.health, armor: P.armor,
        magazines: P.magazines,
        weapons: Object.fromEntries(Object.entries(P.weapons).map(([k, v]) => [k, v === Infinity ? -1 : v])),
        weapon: P.weapon, stats: P.stats, progress: MISSIONS.S.progress, done: MISSIONS.S.done,
        time: W.state.time, packages: W.pickups.filter(p => p.kind === 'package' && p.taken).map(p => p.id)
      }));
      return true;
    } catch (e) { HUD.notify('Could not save the game.'); return false; }
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!s) return false;
      const P = PLAYER.P;
      if (!Number.isFinite(s.x) || !Number.isFinite(s.z) || !s.weapons || typeof s.weapons !== 'object') return false;
      P.x = s.x; P.z = s.z; P.money = Math.max(0, s.money || 0); P.health = 100; P.armor = s.armor || 0; // a loaded game starts rested, whatever state the autosave caught you in
      PLAYER.setOutfit(s.outfit || 0);
      P.weapons = Object.fromEntries(Object.entries(s.weapons).filter(([k]) => WEAPONS[k]).map(([k, v]) => [k, v === -1 ? Infinity : v]));
      P.magazines = Object.fromEntries(Object.entries(s.magazines || {}).filter(([k,v]) => WEAPONS[k] && Number.isFinite(v) && v >= 0).map(([k,v]) => [k, Math.min(v, WEAPONS[k].clip || 0)])); P.reloadT = 0; P.reloadWeapon = null;
      P.weapon = s.weapon in P.weapons ? s.weapon : 'fist'; P.weaponOut = P.weapon !== 'fist';
      Object.assign(P.stats, s.stats || {});
      P.stats.packages = M.clamp(P.stats.packages || 0, 0, 20);
      if (!Array.isArray(P.stats.jumps)) P.stats.jumps = [];
      MISSIONS.S.progress = s.progress || 0; MISSIONS.S.done = s.done || {};
      MISSIONS.S.progress2 = s.progress2 || 0; MISSIONS.S.phoneProgress = s.phoneProgress || 0;
      MISSIONS.S.rampageDone = s.rampageDone || {}; MISSIONS.S.flags = s.flags || {};
      ECON.loadData(s.econ);STREETLIFE.load(s.streetlife);
      const room = s.inside && CITY.interiors[s.inside];
      if (room) {
        MISSIONS.enterInterior(room);
        P.x = s.x; P.z = s.z; P.y = room.floorY;
        MISSIONS.S.saveT = 8; // loading beside the bed must not immediately sleep and save again
      } else if (s.roof && CITY.roofAccess) {
        MISSIONS.S.roof = true; CITY.setRoof(CITY.roofAccess); P.y = Math.max(CITY.roofAccess.h, s.y || 0);
      } else {
        // Old bed saves lack an interior identifier. Resume outside rather than inside a solid building.
        if (CITY.insideLot(P.x, P.z)) { const sh = CITY.place('safehouse'); P.x = sh.x + 6; P.z = sh.z + 1; }
        P.y = CITY.groundY(P.x, P.z,Number.isFinite(s.y)?s.y:0);
      }
      if (s.garage && VEH.SPECS[s.garage.type]) {
        const c = VEH.spawn(s.garage.type, s.garage.x, s.garage.z, s.garage.angle, { mode: 'parked', color: s.garage.color });
        c.playerOwned = true; c.owned = true; c.mods = s.garage.mods || {}; ECON.applyMods(c);c.loadCondition(s.garage.condition);
      }
      W.state.time = s.time ?? 9;
      if (s.job && MISSIONS.resumeJob) MISSIONS.resumeJob(s.job); // a job interrupted by the tab closing is offered back
      for (const p of W.pickups) if (p.kind === 'package' && (s.packages || []).includes(p.id)) p.taken = true;
      restorePackageRewards(P.stats.packages);
      return true;
    } catch (e) { return false; }
  }
  function newGame() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } location.reload(); }
  // Erasing a save takes two presses within a few seconds, so a stray tap on NEW GAME cannot wipe hours of play.
  let wipeT = 0;
  function askNewGame() { if (!hasSave() || wipeT > 0) newGame(); else wipeT = 4; }
  const PACKAGE_WEAPONS = ['uzi', 'shotgun', 'rifle', 'rocket'];
  function restorePackageRewards(n) {
    const s = CITY.place('safehouse');
    PACKAGE_WEAPONS.forEach((w, i) => {
      if (n < (i + 1) * 5 || W.pickups.some(p => p.packageReward === w)) return;
      PICKUPS.add('weapon', s.x + 4, s.z - 4, { weapon: w, ammo: w === 'rocket' ? 4 : 60, respawn: 240, packageReward: w });
    });
  }
  // ---- Device truth: what this machine actually delivers, for the overlay and the copyable report. Numbers from a
  // headless Linux browser say little about an iPad; these are measured where the game is played.
  const perf = { iv: new Float32Array(300), i: 0, n: 0, sim: 0, draw: 0, losses: 0, gpu: '', rep: null, repT: 0 };
  function perfSample(raw) { perf.iv[perf.i] = raw * 1000; perf.i = (perf.i + 1) % perf.iv.length; perf.n = Math.min(perf.iv.length, perf.n + 1); }
  function perfReport() {
    const a = Array.from(perf.iv.subarray(0, perf.n)).sort((x, y) => x - y), q = p => +(a[Math.min(a.length - 1, Math.floor(p * a.length))] || 0).toFixed(1);
    const gl = RENDER.gl; if (!perf.gpu && gl) { try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); perf.gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch (e) { perf.gpu = '?'; } }
    const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
    return { frameP50: q(.5), frameP95: q(.95), frameP99: q(.99), cap: auto.cap ? '30 Hz' : 'none found', level: options.auto ? auto.level : 'off', simMs: +perf.sim.toFixed(2), renderMs: +perf.draw.toFixed(2),
      draws: RENDER.stats.draws, tris: Math.round(RENDER.stats.tris), dpr: +(window.devicePixelRatio || 1).toFixed(2), scale: options.resolution, heapMB: mem, contextLosses: perf.losses, gpu: perf.gpu,
      canvas: RENDER.gl ? RENDER.gl.drawingBufferWidth + 'x' + RENDER.gl.drawingBufferHeight : '', touch: !!TOUCH.active, ua: navigator.userAgent.slice(0, 160), build: document.title };
  }
  function perfInfo() { if (performance.now() - perf.repT > 500) { perf.rep = perfReport(); perf.repT = performance.now(); } return perf.rep; }
  function onPackage(n) {
    if (!MISSIONS.S.current) MISSIONS.S.saveSoon = 1;
    restorePackageRewards(n);
    const w = PACKAGE_WEAPONS[n / 5 - 1];
    if (w) HUD.notify(WEAPONS[w].name + ' now spawns at the safehouse');
  }

  function boot() {
    canvas = document.getElementById('gl'); hud = document.getElementById('hud'); HUD.init(hud); INPUT.init(canvas); TOUCH.init(canvas);
    const T = window.__bootTimes = {}; let t0 = performance.now(); const mark = k => { T[k] = Math.round(performance.now() - t0); t0 = performance.now(); };
    HUD.loading('loading materials…', 0);
    TEX.preload(p => HUD.loading('loading materials…', p)).then(n => { mark('materials'); T.materials_n = n; HUD.loading('building the city…'); setTimeout(() => build(mark), 30); });
  }
  function build(mark = () => { }) {
    const tex = TEX.build(); mark('textures');
    RENDER.init(canvas, tex); tex.color = tex.normal = null; TEX.release(); mark('renderInit'); loadOptions();
    const sb = CITY.generate(); mark('cityGen'); console.log('static tris', (sb.i.length / 3) | 0, 'verts', sb.n); staticMesh = sb.buildChunked(CITY.PITCH); mark('cityMesh'); waterMesh = CITY.water.build(); waterMesh.uvOff = new Float32Array(2); waterMesh.spec = 0.9; waterMesh.water = true; W.indexLights(); AMBIENT.init(); W.initProps();
    propList = W.PROP_TYPES.map(k => W.propMeshes[k]); propList.push(W.lampHeads, W.tlHeads);
    PICKUPS.placeWorld(); MISSIONS.placeRampages(); VEH.spawnParked(); VEH.spawnMarina(); AMBIENT.launchFerry();
    const sh = CITY.place('safehouse'); PLAYER.init(sh.x + 6, sh.z + 1, Math.PI);
    if (hasSave()) load();
    RENDER.setTimeOfDay(W.state.time);
    // pre-warm a few frames of traffic and peds around the player
    for (let i = 0; i < 40; i++) { VEH.spawnTraffic(PLAYER.x, PLAYER.z, PLAYER.P.camYaw + Math.PI, 26); PEDS.populate(PLAYER.x, PLAYER.z, PLAYER.P.camYaw + Math.PI, 40); }
    state = 'title';
    INPUT.onLockLost = () => { if (state === 'playing' && !MISSIONS.shop) { state = 'paused'; INPUT.releaseLock(); } };
    document.addEventListener('pointerdown',e=>{if(state==='map'&&!TOUCH.active&&!e.target.closest('#map-nav'))NAV.mapClick(e.clientX,e.clientY,e.button);});
    document.addEventListener('mousedown', e => { if (state !== 'title' || TOUCH.active) return; const r = HUD.newGameRect; if (r && e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h) { INPUT.tapKey('KeyN'); return; } startPlay(); }, { once: false });

    // Safari drops the GL context when memory is short or the tab sat in the background. The city is rebuilt from its
    // seed on reload, so recovery is: save what can be saved, say what is happening, and start again.
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lostContext = true; perf.losses++; if (started) save(); HUD.notify('The browser reset the graphics. Restoring…'); setTimeout(() => location.reload(), 1200); });
    // iPadOS can evict a background tab without warning: leaving the page is the last safe moment to save.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && started && PLAYER.P.alive && (state === 'playing' || state === 'paused' || state === 'map')) save(); /* mid-job too: the job and its checkpoint are offered back on load */ });
    window.__ready = true;
    mark('rest'); console.log('boot', JSON.stringify(window.__bootTimes));
    last = performance.now(); requestAnimationFrame(frame);
  }
  function startPlay() { AUDIO.resume(); INPUT.requestLock(); state = 'playing'; started = true; HUD.notify('Welcome to Grift City.'); }

  const scene = { statics: [], props: [], entities: [], flat: W.F, particles: W.P };
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = Math.max(0, (now - last) / 1000); let dt = Math.min(0.1, raw); last = now; INPUT.pollPad(); autoQuality(raw); if (state === 'playing') perfSample(raw);
    if (lostContext) { HUD.draw(dt, state); INPUT.endFrame(); return; }
    if (window.__pt) { // playtest mode: fixed timestep, render every N steps, full quality only on request
      const pt = window.__pt; if (pt.paused) { INPUT.endFrame(); return; } dt = pt.dt; pt.n = (pt.n || 0) + 1; const shot = pt.wantShot;
      if (pt.replay) { const s = pt.replay[pt.n - 1]; if (s) INPUT.restore(s); else { pt.paused = true; pt.done = true; INPUT.endFrame(); return; } } // a recording drives the inputs instead of a bot
      if (pt.bot && state === 'playing') pt.bot(dt);
      if (pt.record) pt.record.push(INPUT.snapshot());
      if (state === 'playing') step(dt);
      if (shot || pt.n % pt.renderEvery === 0) { const qs = quality.shadows, qp = RENDER.post.enabled; if (!shot && pt.cheap) { quality.shadows = false; RENDER.post.enabled = false; } renderWorld(dt * pt.renderEvery, false); HUD.draw(dt * pt.renderEvery, state); quality.shadows = qs; RENDER.post.enabled = qp; if (shot) { pt.wantShot = false; pt.shotFrame = pt.n; } }
      if (INPUT.hit('Escape') && state === 'playing') { /* bot never pauses */ }
      INPUT.endFrame(); return;
    }
    wipeT = Math.max(0, wipeT - dt);
    if (state === 'title') { if (INPUT.hit('KeyN')) askNewGame(); titleSkip = !titleSkip; if (!titleSkip || raw > 0.025) { RENDER.setTimeOfDay(W.state.time, W.weather.rain); titleCamera(now / 1000); renderWorld(dt, true); } HUD.draw(dt, 'title'); INPUT.endFrame(); return; } // the title orbit runs at half rate on a 60 Hz screen: it is scenery, and it keeps the device cool
    if (INPUT.hit('Escape')) { if (MISSIONS.shop) { } else if (state === 'playing') { state = 'paused'; INPUT.releaseLock(); } else if (state === 'paused') { state = 'playing'; INPUT.requestLock(); } else if(state==='map'){state='playing';INPUT.releaseAll();} }
    if (INPUT.hit('Tab')) { if (state === 'playing') {state = 'map';INPUT.releaseLock();} else if (state === 'map') state = 'playing'; }
    if (INPUT.hit('KeyP') && state === 'playing' && !MISSIONS.shop) { state = 'photo'; const c = RENDER.cam; const d = Math.hypot(c.tx - c.x, c.ty - c.y, c.tz - c.z) || 1; photo = { x: c.x, y: c.y, z: c.z, yaw: Math.atan2(c.tx - c.x, c.tz - c.z), pitch: Math.asin((c.ty - c.y) / d), fov: 55, shot: false, savedT: 0 }; INPUT.requestLock(); }
    else if (state === 'photo' && (INPUT.hit('KeyP') || INPUT.hit('Escape'))) { state = 'playing'; }
    if (state === 'photo') updatePhoto(dt);
    if (state === 'playing' && INPUT.hit('KeyM')) AUDIO.toggleMute();
    SETTINGS.sync(state);
    if (state === 'playing' && !INPUT.locked && INPUT.mouse.clicked) INPUT.requestLock();
    // the world advances in steps no longer than a 60 Hz frame: a slow frame is simulated as several small steps rather
    // than one big one, so the game keeps real-time pace down to ten frames a second and the physics never sees a jump
    const t0 = performance.now(); if (state === 'playing' && !window.__manual) { const n = Math.min(MAX_STEPS, Math.max(1, Math.ceil(dt / STEP - 1e-6))); const h = dt / n; for (let i = 0; i < n; i++) { step(h); if (i < n - 1) INPUT.consumeEdges(); } } const t1 = performance.now(); perf.sim += (t1 - t0 - perf.sim) * 0.05;
    fpsAcc += raw; fpsN++; if (fpsAcc > 1) { window.__fps = fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    // Paused or on the map the world does not move, so it is drawn once and held: the browser keeps showing the last
    // frame, and the GPU idles instead of redrawing the same picture sixty times a second behind a menu.
    const still = state === 'paused' || state === 'map'; if (!still || !heldFrame || ++heldN % 30 === 0) renderWorld(dt, false); heldFrame = still; /* and twice a second anyway, in case a rotation resized the canvas */ perf.draw += (performance.now() - t1 - perf.draw) * 0.05; if (state === 'photo' && photo.shot) { photo.shot = false; savePhoto(); } HUD.draw(dt, state, photo); INPUT.endFrame();
  }
  let lastHour = 12, fpsAcc = 0, fpsN = 0, fps = 0, titleSkip = false, heldFrame = false, heldN = 0, lostContext = false; const nearSounds = { park: null, water: null };
  // ---- Photo mode: the world freezes and the camera is yours. WASD/QE fly, mouse looks, wheel zooms, click or Enter saves a PNG.
  let photo = null;
  function updatePhoto(dt) { const m = INPUT.mouse; const sens = 0.0022 * (options.sensitivity || 1); photo.yaw -= m.dx * sens; photo.pitch = M.clamp(photo.pitch - m.dy * sens * (options.invertY ? -1 : 1), -1.4, 1.4);
    const sp = (INPUT.down('ShiftLeft') ? 26 : 8) * dt; const f = [Math.sin(photo.yaw) * Math.cos(photo.pitch), Math.sin(photo.pitch), Math.cos(photo.yaw) * Math.cos(photo.pitch)], r = [-Math.cos(photo.yaw), 0, Math.sin(photo.yaw)];
    let mx = 0, my = 0, mz = 0; if (INPUT.down('KeyW')) { mx += f[0]; my += f[1]; mz += f[2]; } if (INPUT.down('KeyS')) { mx -= f[0]; my -= f[1]; mz -= f[2]; } if (INPUT.down('KeyD')) { mx += r[0]; mz += r[2]; } if (INPUT.down('KeyA')) { mx -= r[0]; mz -= r[2]; } if (INPUT.down('KeyE')) my += 1; if (INPUT.down('KeyQ')) my -= 1;
    photo.x += mx * sp; photo.y = Math.max(CITY.groundY(photo.x, photo.z) + 0.3, photo.y + my * sp); photo.z += mz * sp; if (m.wheel) photo.fov = M.clamp(photo.fov + m.wheel * 0.02, 18, 100);
    if (INPUT.hit('Enter') || m.clicked) photo.shot = true; if (photo.savedT > 0) photo.savedT -= dt;
    RENDER.setCamera(photo.x, photo.y, photo.z, photo.x + f[0], photo.y + f[1], photo.z + f[2], photo.fov * Math.PI / 180); W.state.camYaw = photo.yaw; }
  // The frame is read synchronously (the drawing buffer does not survive the frame); inside the claude.ai viewer the
  // save goes through its downloads capability, anywhere else through a plain download link.
  function savePhoto() { try { const url = canvas.toDataURL('image/png'); const name = 'grift-city-' + Date.now() + '.png';
      const viewer = typeof window.claude === 'object' && window.claude && typeof window.claude.use === 'function';
      if (viewer) { window.claude.use('downloads').then(dl => { if (!dl) throw new Error('unavailable'); return fetch(url).then(r => r.blob()).then(blob => dl.save({ filename: name, data: blob })); }).then(() => { photo.savedT = 1.5; AUDIO.play('click'); }).catch(e => { if (!e || e.code !== 'declined') HUD.notify('Could not save the photo here.'); }); return; }
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); photo.savedT = 1.5; AUDIO.play('click'); } catch (e) { HUD.notify('Could not save the photo.'); } }
  // ---- Per-district colour grade: a tint and a saturation the composite pass blends toward as you cross the city
  const GRADES = { downtown: [[1.0, 1.0, 1.0], 1.08], midtown: [[1.02, 1.0, 0.97], 1.1], northgate: [[1.04, 0.99, 0.93], 1.1], westfield: [[1.0, 1.02, 0.97], 1.1], eastside: [[1.05, 0.99, 0.91], 1.07], southport: [[1.0, 1.01, 1.02], 1.1], sea: [[0.98, 1.02, 1.04], 1.12], indoor: [[1.05, 0.99, 0.92], 1.08], underwater: [[0.42, 0.74, 0.92], 0.66] };
  let vigBase = -1;
  function updateGrade(dt, px, pz) {
    // Under the surface the picture turns green-blue, loses most of its colour and closes in at the edges, so falling
    // in the sea reads as being in it rather than as the screen going dark.
    if (vigBase < 0) vigBase = RENDER.post.vignette;
    const under = RENDER.cam.y < W.WATER_Y - 0.05;
    RENDER.post.vignette = M.lerp(RENDER.post.vignette, under ? 0.62 : vigBase, Math.min(1, 3 * dt));
    if (under) { // dense uniform fog: the water surface is a single-sided plane, so without this you look out at the
      // skyline from the sea bed. Everything past a few metres now fades into the green of the water.
      const e = RENDER.env; e.fogDensity = 0.22; e.fogHeight = 1e5; e.fogSun = 0; e.fogCol = [0.04, 0.12, 0.15];
      e.sunCol = [e.sunCol[0] * 0.35, e.sunCol[1] * 0.5, e.sunCol[2] * 0.55]; e.skyCol = [0.07, 0.2, 0.24]; e.groundCol = [0.02, 0.06, 0.08];
      // the sky takes no fog, so it is painted the colour of the water instead: brighter overhead, darker below
      e.zenith = [0.07, 0.2, 0.23]; e.horizon = [0.03, 0.1, 0.12]; e.starAlpha = 0; e.sunDisc = 0; }
    const bl = CITY.blockAt(px, pz); const key = under ? 'underwater' : CITY.interiorRoom ? 'indoor' : bl ? CITY.district(bl.i, bl.j) : (W.onWater(px, pz) ? 'sea' : 'southport'); const g = GRADES[key] || GRADES.midtown; const k = Math.min(1, 0.6 * dt); const t = RENDER.post.tint; for (let i = 0; i < 3; i++) t[i] = M.lerp(t[i], g[0][i], k); RENDER.post.sat = M.lerp(RENDER.post.sat, g[1], k); }
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
  // the adaptive-quality decision, exposed so a test can drive it with a frame-time history
  window.__autoStep = (a, raw) => autoStep(a, raw);
  window.__autoState = () => ({ level: 0, ema: 16, slowT: 0, fastT: 0, told: false, warm: 99, badRaises: 0, sinceRaise: Infinity });
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
    FALCATA: () => { const P = PLAYER.P; const c = VEH.spawn('sports', P.x + 3, P.z, P.camYaw, { mode: 'parked', color: 0 }); c.playerOwned = c.owned = true; HUD.notify('A Falcata appears'); },
    BASTION: () => { const P = PLAYER.P; const c = VEH.spawn('swat', P.x + 3, P.z, P.camYaw, { mode: 'parked' }); c.playerOwned = c.owned = true; HUD.notify('A Bastion appears'); },
  };
  function checkCheats() { const t = INPUT.typed; for (const k in CHEATS) if (t.endsWith(k)) { INPUT.typed = ''; CHEATS[k](); AUDIO.play('cash'); } }
  function step(dt) {
    checkCheats();
    W.frameBegin(); W.updateClock(dt); W.updateWeather(dt); RENDER.setTimeOfDay(W.state.time, W.weather.rain, W.weather.fog, dt); const night = W.isNight();
    const room = CITY.interiorRoom; if (room) { const e = RENDER.env; e.sunCol = e.sunCol.map(v => v * 0.08); e.skyCol = [0.34, 0.3, 0.26]; e.groundCol = [0.2, 0.17, 0.14]; e.fogDensity = 0; e.nightEmis = 1; for (const l of room.lights) W.dyn.push({ x: l.x, y: l.y, z: l.z, r: l.r * 1.3, col: l.col.map(v => v * 1.2) }); } // a room lit by its lamps, not the sun
    const dlg = !!MISSIONS.dialogue;
    MISSIONS.update(dt); if (typeof GRIFT !== 'undefined') GRIFT.update(dt); ECON.update(dt);
    { const h = W.state.time; if (lastHour < 7 && h >= 7 && h < 8 && PLAYER.P.alive && !MISSIONS.S.current) HUD.gazette?.(); lastHour = h; } // the morning edition
    if (!dlg) PLAYER.update(dt); else { PLAYER.P.aim = 0; PLAYER.P.vx = PLAYER.P.vz = 0; if (PLAYER.car) { PLAYER.car.controls.throttle = 0; PLAYER.car.controls.brake = 1; } PLAYER.updateCamera(dt); }
    PLAYER.updateProjectiles(dt);
    VEH.updateAll(dt, night); PEDS.updateAll(dt); POLICE.update(dt); PICKUPS.update(dt);
    W.updateLights(dt); W.updateKnocked(dt); W.updateExplosions(dt); W.updateParticles(dt); AMBIENT.update(dt, PLAYER.x, PLAYER.z);STREETLIFE.update(dt);
    // population management
    const px = PLAYER.x, pz = PLAYER.z, yaw = W.state.camYaw;
    const busy = W.bustle(W.state.time); // rush hours fill the streets, the small hours empty them
    if (W.state.frame % 4 === 0) VEH.spawnTraffic(px, pz, yaw, Math.round(18 + 34 * busy));
    if (W.state.frame % 3 === 0) PEDS.populate(px, pz, yaw, Math.round(18 + 62 * busy));
    if (W.state.frame % 20 === 10) { PEDS.trim(px, pz, yaw, Math.round(18 + 62 * busy)); VEH.trim(px, pz, yaw, Math.round(18 + 34 * busy)); }
    if (W.state.frame % 30 === 0) { VEH.despawn(px, pz); PEDS.despawn(px, pz); } if (W.state.frame % 30 === 15) VEH.streamKerb(PLAYER.x, PLAYER.z);
    updateGrade(dt, px, pz);
    AUDIO.listener(px, pz); AUDIO.rain(CITY.interiorRoom ? 0 : W.weather.rain, !!PLAYER.car); AUDIO.wind(PLAYER.car && !CITY.interiorRoom ? M.clamp((PLAYER.car.absSpeed - 12) / 18, 0, 1) : 0, CITY.interiorRoom ? 0 : W.weather.rain);
    if (W.state.frame % 30 === 7) { const pk = CITY.nearestPlace('park', px, pz); nearSounds.park = pk && M.dist2(pk.x, pk.z, px, pz) < 70 * 70 && !CITY.interiorRoom ? pk : null; const wx = M.clamp(px, W.bounds[0], W.bounds[1]), wz = M.clamp(pz, W.bounds[0], W.bounds[1]); const edge = Math.min(px - W.bounds[0], W.bounds[1] - px, pz - W.bounds[0], W.bounds[1] - pz); nearSounds.water = edge < 60 && !CITY.interiorRoom ? { x: edge === px - W.bounds[0] ? W.bounds[0] : edge === W.bounds[1] - px ? W.bounds[1] : wx, z: edge === pz - W.bounds[0] ? W.bounds[0] : edge === W.bounds[1] - pz ? W.bounds[1] : wz } : null; } AUDIO.ambientTick(dt, nearSounds); if (W.state.frame % 20 === 0) { let n = 0; for (const c of W.cars) if (!c.removed && c.absSpeed > 2 && M.dist2(c.x, c.z, px, pz) < 60 * 60) n++; AUDIO.traffic(Math.min(1, n / 8)); } AUDIO.radioTick(dt, !!PLAYER.car || !!CITY.interiorRoom); if (!PLAYER.car) { AUDIO.engine(false, 0, 0); AUDIO.screech(0); }
    // hydrant fountains
    for (const p of CITY.props.hydrant) if (p.hydrantT > 0) { p.hydrantT -= dt; if (W.state.frame % 2 === 0) W.particle(p.x, 0.4, p.z, (W.rng() - 0.5) * 1.5, 9 + W.rng() * 5, (W.rng() - 0.5) * 1.5, 1.4, 0.45, [0.75, 0.88, 1], 0.7, { grav: 12, grow: 0.8 }); }
  }
  function titleCamera(t) { const g = CITY.place('tower'); const a = t * 0.06; const x = g.roofX + Math.sin(a) * 260, z = g.roofZ + Math.cos(a) * 260; RENDER.setCamera(x, 150 + Math.sin(t * 0.15) * 20, z, g.roofX, 70, g.roofZ); W.state.camYaw = Math.atan2(g.roofX - x, g.roofZ - z); }
  function renderWorld(dt, title) {
    const night = RENDER.env.nightEmis > 0.05; const cam = RENDER.cam;
    RENDER.env.shadowOn = RENDER.env.shadowOn && quality.shadows;
    waterMesh.uvOff[0] = W.state.elapsed * 0.01; waterMesh.uvOff[1] = Math.sin(W.state.elapsed * 0.3) * 0.02; scene.statics = [staticMesh, waterMesh]; scene.entities.length = 0;
    RENDER.beginFrame(canvas); // matrices and frustum planes first, so what follows can leave out what the camera cannot see
    W.fx.begin(); W.drawDecals(cam.tx, cam.tz, dt); W.lampCones(cam.tx, cam.tz);
    // cars and people outside the view frustum are not built or drawn at all, except close by where their shadows can still fall into view
    for (const c of W.cars) { if (c.removed) continue; const d2 = M.dist2(c.x, c.z, cam.tx, cam.tz); if (d2 > 300 * 300 || (d2 > 35 * 35 && !RENDER.inView(c.x, c.y + 1, c.z, c.spec.len * 0.6 + 1))) continue;
      const ce = c.entity(night); ce.noShadow = !RENDER.inLight(c.x, c.y + 1, c.z, c.spec.len * 0.6 + 1); scene.entities.push(ce); if (night) c.headlightFX();
      if (M.dist2(c.x, c.z, cam.tx, cam.tz) < 90 * 90) { // occupants, seen through the glass
        if (c.driver && c.driver !== PLAYER) scene.entities.push(PEDS.seatedEntity(c.driver, c, 0, true));
        else if (c.driver === PLAYER && !title) scene.entities.push(PEDS.seatedEntity(PLAYER.P, c, 0, true));
        c.passengers.forEach((q, i) => { if (!q.removed) scene.entities.push(PEDS.seatedEntity(q, c, i + 1, false)); }); } }
    for (const p of W.peds) { if (p.removed || p.inCar) continue; const d2 = M.dist2(p.x, p.z, cam.tx, cam.tz); if (d2 > 140 * 140 || (d2 > 25 * 25 && !RENDER.inView(p.x, p.y + 1, p.z, 1.6))) continue;
      const pe = p.entity(); pe.noShadow = d2 > 70 * 70 || !RENDER.inLight(p.x, p.y + 1, p.z, 1.6); scene.entities.push(pe); const h = p.heldEntity(); if (h) { h.noShadow = pe.noShadow; scene.entities.push(h); } }
    for (const e of window.__debugBoxes) scene.entities.push(e);
    const pe = PLAYER.entity(); if (pe && !title) { scene.entities.push(pe); const h = PLAYER.heldEntity(); if (h) scene.entities.push(h); }
    if(typeof STREETS !== 'undefined') scene.entities.push(...STREETS.entities());
    for (const e of PLAYER.projectileEntities()) scene.entities.push(e);
    for (const e of PICKUPS.entities(cam.tx, cam.tz)) scene.entities.push(e); AMBIENT.entities(scene.entities);STREETLIFE.entities(scene.entities);
    const he = POLICE.heliEntity(); if (he) scene.entities.push(he);
    if (!title) { MISSIONS.markersFX(W.state.elapsed); ECON.markersFX(W.state.elapsed); PLAYER.drawFX(); POLICE.drawFX(); }
    // soft blob shadows under peds at night (sun shadows are off)
    if (!RENDER.env.shadowOn) { for (const p of W.peds) if (!p.removed && !p.inCar && M.dist2(p.x, p.z, cam.tx, cam.tz) < 60 * 60) W.fx.blob(p.x, p.y + 0.02, p.z, 0.45, 0.35); if (!PLAYER.car && !title) W.fx.blob(PLAYER.x, PLAYER.y + 0.02, PLAYER.z, 0.45, 0.35); for (const c of W.cars) if (!c.removed && M.dist2(c.x, c.z, cam.tx, cam.tz) < 120 * 120) W.fx.blob(c.x, c.y + 0.02, c.z, c.spec.len * 0.45, 0.3); }
    W.fx.end();
    W.updateProps(cam.tx, cam.tz); scene.props = propList;
    RENDER.env.noSky = cam.y < W.WATER_Y - 0.05; // tracked here rather than in the step, so it is right in every state
    RENDER.setLights(W.collectLights(cam.tx, cam.tz));
    RENDER.render(canvas, scene, W.state.elapsed);
  }
  window.addEventListener('load', boot);
  return { quality, options, auto, saveOptions, save, load, hasSave, saveInfo, perfInfo, perfReport, askNewGame, newGame, onPackage, get wipeArmed() { return wipeT > 0; }, get state() { return state; }, set state(s) { state = s; }, get fps() { return fps; }, startPlay };
})();
