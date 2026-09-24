// STÅLHAGEN II — the game: input, the chapters' light, the scene each frame, the story's triggers, the standoff,
// the carry, photographs, sitting, the darkroom, menus and the HUD.
'use strict';
const FONT = '"Cormorant Garamond", "EB Garamond", Garamond, Georgia, serif';

const Game = (() => {
  const cv = document.getElementById('gl'), ui = document.getElementById('ui'), ctx2 = ui.getContext('2d');
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  let W = 0, H = 0, UW = 0, UH = 0;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, isTouch ? 1 : 1.5);
    W = Math.min(Math.round(innerWidth * dpr), 1920); H = Math.round(W * innerHeight / innerWidth);
    cv.width = W; cv.height = H; UW = ui.width = innerWidth; UH = ui.height = innerHeight;
  }
  addEventListener('resize', resize); resize();
  if (isTouch) document.body.classList.add('touch');

  // ---------------------------------------------------------------- input
  const keys = {}, pressed = {}, nav = {};
  const input = { mx: 0, my: 0, lookDX: 0, lookDY: 0, torchPressed: false, useHeld: false, usePressed: false, cutHeld: false, cutPressed: false, hurry: false, cameraPressed: false, pausePressed: false };
  const FIXED = { ArrowUp: 'forward', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right', ShiftLeft: 'hurry', ShiftRight: 'hurry', Enter: 'use', Escape: 'pause', KeyP: 'pause', KeyM: 'mute', Tab: 'album' };
  const NAV = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Enter: 'ok', Space: 'ok', KeyE: 'ok', Escape: 'back', Backspace: 'back' };
  const actionFor = code => { const k = Store.settings.keys; for (const a in k) if (k[a] === code) return a; return FIXED[code]; };
  let rebinding = null, tap = null, lookDX = 0, lookDY = 0, locked = false;
  addEventListener('keydown', e => {
    Sound.init();
    if (rebinding) { e.preventDefault(); if (e.code !== 'Escape') Store.bind(rebinding, e.code); rebinding = null; return; }
    const n = NAV[e.code]; if (n && !e.repeat) nav[n] = true;
    const a = actionFor(e.code); if (a) { if (!keys[a]) pressed[a] = true; keys[a] = true; if (e.code !== 'Tab' || true) e.preventDefault(); }
    pressed.any = true;
  });
  addEventListener('keyup', e => { const a = actionFor(e.code); if (a) keys[a] = false; });
  cv.addEventListener('pointerdown', e => {
    const r = cv.getBoundingClientRect(); tap = { x: (e.clientX - r.left) / r.width * 1280, y: (e.clientY - r.top) / r.height * 720 }; pressed.any = true; Sound.init();
    if (!isTouch && state === 'play' && !menuStack && !locked) cv.requestPointerLock && cv.requestPointerLock();
    if (!isTouch && locked) { if (e.button === 0) { pressed.use = true; keys.use = true; } if (e.button === 2) { pressed.cut = true; keys.cut = true; } }
  });
  addEventListener('pointerup', e => { if (!isTouch) { if (e.button === 0) keys.use = false; if (e.button === 2) keys.cut = false; } });
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('mousemove', e => { if (locked) { lookDX += e.movementX; lookDY += e.movementY; } });
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === cv; });
  // touch: a stick, a look area, buttons
  const stick = document.getElementById('stick'), knob = stick && stick.querySelector('.knob'), lookArea = document.getElementById('look');
  const touchAxes = { x: 0, y: 0 };
  if (stick) {
    let sid = null, cx = 0, cy = 0;
    stick.addEventListener('pointerdown', e => { e.preventDefault(); sid = e.pointerId; stick.setPointerCapture(sid); const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; pressed.any = true; Sound.init(); });
    stick.addEventListener('pointermove', e => { if (e.pointerId !== sid) return; const dx = clamp((e.clientX - cx) / 55, -1, 1), dy = clamp((e.clientY - cy) / 55, -1, 1); touchAxes.x = dx; touchAxes.y = -dy; knob.style.left = 50 + dx * 45 + 'px'; knob.style.top = 50 + dy * 45 + 'px'; });
    const end = e => { if (e.pointerId !== sid) return; sid = null; touchAxes.x = touchAxes.y = 0; knob.style.left = '50px'; knob.style.top = '50px'; };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    let lid = null, lx = 0, ly = 0;
    lookArea.addEventListener('pointerdown', e => { e.preventDefault(); lid = e.pointerId; lx = e.clientX; ly = e.clientY; lookArea.setPointerCapture(lid); pressed.any = true; Sound.init(); const r = cv.getBoundingClientRect(); tap = { x: (e.clientX - r.left) / r.width * 1280, y: (e.clientY - r.top) / r.height * 720 }; });
    lookArea.addEventListener('pointermove', e => { if (e.pointerId !== lid) return; lookDX += (e.clientX - lx) * 2.2; lookDY += (e.clientY - ly) * 2.2; lx = e.clientX; ly = e.clientY; });
    const lend = e => { if (e.pointerId === lid) lid = null; };
    lookArea.addEventListener('pointerup', lend); lookArea.addEventListener('pointercancel', lend);
    for (const b of document.querySelectorAll('#touch button')) {
      const a = b.dataset.act;
      const on = e => { e.preventDefault(); if (!keys[a]) pressed[a] = true; keys[a] = true; pressed.any = true; Sound.init(); b.classList.add('on'); };
      const off = e => { e.preventDefault(); keys[a] = false; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
    }
    addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  }
  let padPrev = {};
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [], p = pads && [...pads].find(Boolean); if (!p) return null;
    const st = { use: p.buttons[0]?.pressed, cut: p.buttons[7]?.pressed || p.buttons[2]?.pressed, torch: p.buttons[3]?.pressed, camera: p.buttons[1]?.pressed || p.buttons[5]?.pressed, pause: p.buttons[9]?.pressed, hurry: p.buttons[10]?.pressed || p.buttons[6]?.pressed };
    const menu = { up: p.axes[1] < -0.5 || p.buttons[12]?.pressed, down: p.axes[1] > 0.5 || p.buttons[13]?.pressed, ok: p.buttons[0]?.pressed, back: p.buttons[1]?.pressed };
    for (const k in st) { if (st[k] && !padPrev[k]) { pressed[k] = true; pressed.any = true; Sound.init(); } if (st[k] !== padPrev[k]) keys[k] = !!st[k]; }
    for (const k in menu) if (menu[k] && !padPrev['m' + k]) nav[k] = true;
    padPrev = { ...st, mup: menu.up, mdown: menu.down, mok: menu.ok, mback: menu.back };
    return { mx: Math.abs(p.axes[0]) > 0.15 ? p.axes[0] : 0, my: Math.abs(p.axes[1]) > 0.15 ? -p.axes[1] : 0, lx: Math.abs(p.axes[2]) > 0.15 ? p.axes[2] : 0, ly: Math.abs(p.axes[3]) > 0.15 ? p.axes[3] : 0 };
  }
  function gatherInput(dt) {
    const pad = pollPad();
    let mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), my = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
    if (pad) { mx += pad.mx; my += pad.my; lookDX += pad.lx * 900 * dt; lookDY += pad.ly * 600 * dt; }
    mx += touchAxes.x; my += touchAxes.y;
    input.mx = clamp(mx, -1, 1); input.my = clamp(my, -1, 1);
    const inv = Store.settings.invertY ? -1 : 1;
    input.lookDX = lookDX; input.lookDY = lookDY * inv; lookDX = lookDY = 0;
    input.torchPressed = !!pressed.torch; input.useHeld = !!keys.use; input.usePressed = !!pressed.use; input.cutHeld = !!keys.cut; input.cutPressed = !!pressed.cut; input.hurry = !!keys.hurry; input.cameraPressed = !!pressed.camera; input.pausePressed = !!pressed.pause;
  }
  function clearPressed() { for (const k in pressed) pressed[k] = false; for (const k in nav) nav[k] = false; tap = null; }

  // ---------------------------------------------------------------- world and cast
  RENDER.init(cv);
  const world = World.build();
  const kid = new Kid();
  const P = Player.P;
  const bearerMesh = null;
  const machines = [];
  const bearer = new Machine('bearer', World.FARM.x + 26, World.FARM.z + 30, -2.2); bearer.item.hidden = false; machines.push(bearer);
  const scout = new Machine('scout', World.FARM.x - 6, World.SHORE_Z + 20, Math.PI); scout.marks = [[World.FARM.x - 4, World.SHORE_Z + 34], [World.FARM.x + 1, World.FARM.z - 14], [World.FARM.x + 6, World.FARM.z - 8]]; machines.push(scout);
  const o4 = new Machine('scout', 10, 20, 0, { hidden: true, mesh: scout.mesh }); o4.marks = []; o4.item.hidden = true; machines.push(o4);
  for (const m of machines) m.onSound = (k, x, y, z, v) => Sound.at(k, x, y, z, v);
  Player.place(0.5, -22, 0);

  const snow = { data: new Float32Array(1400 * 5), n: 1400, col: [0.95, 0.96, 0.98], pts: [] };
  for (let i = 0; i < snow.n; i++) snow.pts.push({ x: (Math.random() - 0.5) * 60, y: Math.random() * 25, z: (Math.random() - 0.5) * 60, s: 0.05 + Math.random() * 0.08, p: Math.random() * TAU });

  // ---------------------------------------------------------------- state
  let state = 'boot', stateT = 0, time = 0, chapter = 1, fade = 0, fadeTarget = 1, flash = 0, deathT = 0;
  let lineCur = null, lineQ = [], said = new Set(), menuStack = null, menuRects = [], darkroom = null, ending = null;
  let calmCeiling = 1, awake = false, nightsSpent = 0, carriedFrom = null, cutTarget = null, standoffWith = null, promptA = 0, prompt = '', lastSeat = null, sleepReady = false;
  const flags = { hulls: false, island: false, scoutSeen: false, bearerSeen: false, standoff: false, off: false, carried: false, cut: false };
  const S = () => Store.settings, T = () => S().large ? 1.28 : 1, reduce = () => S().reduce, quiet = () => S().quiet;

  // ---------------------------------------------------------------- light
  const RIGS = {
    noon: { sunDir: [0.35, 0.42, 0.6], sunCol: [0.36, 0.35, 0.33], skyCol: [0.66, 0.7, 0.74], groundCol: [0.55, 0.57, 0.6], fogCol: [0.8, 0.81, 0.8], fogDensity: 0.0032, fogHeight: 45, zenith: [0.47, 0.54, 0.62], horizon: [0.84, 0.84, 0.82], cloudCol: [0.62, 0.66, 0.7], cloud: 0.7, sunGlow: 0.5, sunDisc: 0.35, stars: 0, exposure: 1.05, sat: 0.95 },
    dusk: { sunDir: [-0.5, 0.06, 0.7], sunCol: [0.55, 0.32, 0.18], skyCol: [0.3, 0.33, 0.44], groundCol: [0.28, 0.27, 0.3], fogCol: [0.52, 0.47, 0.5], fogDensity: 0.0038, fogHeight: 35, zenith: [0.16, 0.2, 0.32], horizon: [0.86, 0.55, 0.38], cloudCol: [0.42, 0.36, 0.42], cloud: 0.55, sunGlow: 0.9, sunDisc: 0.0, stars: 0.15, exposure: 1.0, sat: 1.05 },
    night: { sunDir: [0.2, 0.5, 0.3], sunCol: [0.04, 0.05, 0.08], skyCol: [0.08, 0.1, 0.16], groundCol: [0.07, 0.08, 0.11], fogCol: [0.1, 0.11, 0.15], fogDensity: 0.005, fogHeight: 30, zenith: [0.03, 0.04, 0.09], horizon: [0.16, 0.16, 0.2], cloudCol: [0.1, 0.11, 0.15], cloud: 0.5, sunGlow: 0, sunDisc: 0, stars: 0.8, exposure: 1.4, sat: 0.9 },
  };
  const env = RENDER.env; let rig = RIGS.noon, rigFrom = RIGS.noon, rigT = 1;
  function setRig(name, instant) { rigFrom = mixRig(rigFrom, rig, rigT); rig = RIGS[name]; rigT = instant ? 1 : 0; }
  function mixRig(a, b, t) { const o = {}; for (const k in b) o[k] = Array.isArray(b[k]) ? b[k].map((v, i) => lerp(a[k] ? a[k][i] : v, v, t)) : lerp(a[k] !== undefined ? a[k] : b[k], b[k], t); return o; }
  function applyRig(dt) { rigT = Math.min(1, rigT + dt / 6); const m = mixRig(rigFrom, rig, smooth(0, 1, rigT)); Object.assign(env, m); env.shadowOn = env.sunCol[0] > 0.1; }

  // ---------------------------------------------------------------- story
  function say(id) { if (said.has(id)) return; const l = TEXT.lines.find(l => l.id === id); if (!l) return; said.add(id); lineQ.push(l.text); }
  function lineFor(when) { const l = TEXT.lines.find(l => l.ch === chapter && l.when === when); if (l) say(l.id); }
  function updateLines(dt) {
    if (lineCur) { lineCur.t += dt; if (lineCur.t > lineCur.d) lineCur = null; }
    if (!lineCur && lineQ.length) { const text = lineQ.shift(); lineCur = { text, t: 0, d: 3.4 + text.length / 16 }; }
  }
  function startChapter(ch) {
    chapter = ch; state = 'card'; stateT = 0; fade = 0; fadeTarget = 1;
    setRig(ch === 1 ? 'noon' : 'dusk', true); Sound.setChapter(ch - 1);
    if (ch === 1) { Player.place(0.5, -22, 0); o4.x = 10; o4.z = 20; }
    else { Player.place(World.FARM.x - 6, World.SHORE_Z + 14, 0); }
    Store.reach(ch - 1);
  }
  function beginPlay() { state = 'play'; stateT = 0; lineFor('start'); }

  // ---------------------------------------------------------------- update
  function update(dt) {
    time += dt; stateT += dt; env.time = time; env.reduce = reduce() ? 1 : 0;
    gatherInput(dt);
    if (pressed.mute) Store.setting('muted', Sound.toggleMute());
    fade = lerp(fade, fadeTarget, 1 - Math.pow(0.02, dt)); flash = Math.max(0, flash - dt * 2);
    applyRig(dt);
    if (Photo.S.polaroid) { Photo.S.polaroid.t += dt; if (Photo.S.polaroid.t > 3.4) Photo.S.polaroid = null; }
    if (state === 'title') { titleCamera(dt); if (!menuStack) openMenu('main'); handleMenu(); }
    else if (state === 'card') { if (stateT > 5 || (stateT > 1.2 && (pressed.any || nav.ok))) beginPlay(); }
    else if (state === 'play') updatePlay(dt);
    else if (state === 'darkroom') updateDarkroom(dt);
    else if (state === 'end') { if (stateT > 4 && (pressed.any || nav.ok)) { state = 'album'; stateT = 0; } }
    else if (state === 'album') { if (stateT > 0.8 && (pressed.any || nav.ok || nav.back)) { state = 'title'; stateT = 1; openMenu('main'); } }
    updateLines(dt);
    updateSnow(dt);
    Sound.update(dt, RENDER.cam, humAmount(), P.onIce);
    clearPressed();
  }

  function humAmount() {
    if (!world.cable) return 0;
    let best = 1e9; const C = world.cable.mesh; // distance to the cable's line: sample the stored path
    for (const pt of cablePath) { const d = Math.hypot(pt[0] - P.x, pt[2] - P.z); if (d < best) best = d; }
    for (const m of machines) if (m.kind === 'bearer' && !m.dark && !m.off) { const d = Math.hypot(m.x - P.x, m.z - P.z); if (d < best) best = d; }
    return clamp(1 - best / 22, 0, 1);
  }
  const cablePath = []; for (let i = 0; i <= 40; i++) { const t = i / 40; cablePath.push([46 + t * 90 + Math.sin(t * 9) * 2.5, 0, 402 + t * 40 + Math.cos(t * 7) * 2]); }
  let tickT = 0;
  function updateTester(dt) { const h = humAmount(); if (h <= 0.05) return; tickT -= dt; if (tickT <= 0) { tickT = lerp(1.4, 0.18, h); Sound.tick(0.5 + h); } }

  function updatePlay(dt) {
    if (menuStack) { handleMenu(); return; }
    if (input.pausePressed) { openMenu('pause'); return; }
    if (deathT > 0) { deathT -= dt; if (deathT <= 0) respawn(); Player.update(dt, { mx: 0, my: 0, lookDX: 0, lookDY: 0 }, { locked: true }); return; }
    // the camera toggle
    if (input.cameraPressed && !P.sit && P.carried <= 0) { P.viewfinder = !P.viewfinder; Sound.wind_lever(); }
    // sitting
    const seat = nearestSeat();
    if (P.sit) { if (input.mx || input.my || input.usePressed) { P.sit = null; } }
    else if (seat && input.usePressed && !P.viewfinder && !standoffWith) sit(seat);
    // the cellar door and the bed
    const door = world.door, dd = Math.hypot(P.x - door.x, P.z - door.z);
    const cellar = world.cellar, cd = Math.hypot(P.x - cellar.x, P.z - cellar.z);
    if (!P.sit && input.usePressed && !P.viewfinder && !standoffWith) {
      if (cd < 2.4 && Store.undeveloped.length) return openDarkroom();
      if (dd < 2.2 && sleepReady) return goSleep();
    }
    // the standoff: which bearer is close enough, facing you, lamp on
    standoffWith = null;
    for (const m of machines) if (m.kind === 'bearer' && (m.state === 'standoff' || (m.state === 'wait' && Math.hypot(m.x - P.x, m.z - P.z) < 1.3))) standoffWith = m;
    const ctx = {
      locked: false, standoff: !!standoffWith, snowing: chapter === 1, indoors: false,
      onStep: (s, h) => Sound.step(s, h), onTorch: on => Sound.torch(on),
      onThinIce: () => die('ice'), onCrack: () => Sound.at('crack', P.x, 0, P.z, 1),
      onRelease: h => { if (standoffWith) { /* letting go is never a flinch; the arms stay a little open */ } },
    };
    Player.update(dt, input, ctx);
    if (P.torch && P.hold > 0.05) P.flinch = true;
    // the kid
    kid.pose(P.x, P.y, P.z, P.yaw, clamp(P.speed / 1.4, 0, 1.3), dt, clamp(P.hold * 2, 0, 1) || (standoffWith ? 0.25 : 0), 0, P.torch);
    P.handWorld = kid.hand;
    // machines
    const mctx = { calmCeiling: quiet() ? 1 : calmCeiling, awake: awake && !P.sit, onLift: m => { if (quiet()) { m.state = 'wait'; return; } flags.carried = true; carriedFrom = { x: P.x, z: P.z }; P.carried = 0.001; Sound.at('lift', m.x, m.y + 1, m.z); }, onCarried: m => wake(m), onSwitchedOff: m => { flags.off = true; lineFor('off'); Sound.touch(); sleepReady = true; } };
    for (const m of machines) { if (m === o4) updateO4(dt); else m.update(dt, P, mctx); }
    if (P.carried > 0) { P.carried += dt; }
    // the cutter: the nearest joint in front of you within reach
    cutTarget = null;
    if (P.cutterUp) {
      let best = 2.4; const f = Player.facing();
      for (const m of machines) if (m.kind === 'bearer' && !m.dark) for (const j of m.joints()) { const dx = j[1] - P.x, dz = j[3] - P.z, d = Math.hypot(dx, dz); if (d < best && (dx * f[0] + dz * f[2]) / (d || 1) > 0.5) { best = d; cutTarget = { m, j }; } }
      if (cutTarget) { const m = cutTarget.m; m.fx[cutTarget.j[0] * 4] = 1; if (input.usePressed || pressed.cut && false) {} }
      if (cutTarget && input.usePressed) { cutTarget.m.sever(cutTarget.j[0]); flags.cut = true; lineFor('cut'); calmCeiling = Math.max(0.35, calmCeiling - 0.25); Sound.at('cut', cutTarget.j[1], cutTarget.j[2], cutTarget.j[3]); if (cutTarget.m.legsLeft() === 0) sleepReady = true; }
    }
    // photographs
    if (P.viewfinder && input.usePressed) takePhoto();
    // triggers and lines
    for (const t of world.triggers) if (!flags[t.id] && Math.hypot(P.x - t.x, P.z - t.z) < t.r) trigger(t.id);
    if (chapter === 1) { if (P.z > 30) lineFor('ice'); if (P.z > 130) lineFor('mid'); if (P.z > 250) lineFor('far'); if (P.thinT > 0.5) lineFor('thin'); }
    if (chapter === 2) {
      if (Math.hypot(P.x - 46, P.z - 402) < 12) lineFor('hole');
      if (!flags.scoutSeen && Math.hypot(P.x - scout.x, P.z - scout.z) < 12) { flags.scoutSeen = true; lineFor('scout'); }
      if (!awake && Math.hypot(P.x - World.FARM.x, P.z - World.FARM.z) < 40 && stateT > 20) { awake = true; }
      if (!flags.bearerSeen && bearer.state === 'approach') { flags.bearerSeen = true; lineFor('bearer'); }
      if (!flags.standoff && standoffWith) { flags.standoff = true; lineFor('standoff'); }
    }
    updateHulls(dt); updateTester(dt);
    // a carry is six seconds on your back, then the fade
    if (P.carried > 5.5 && fadeTarget !== 0) fadeTarget = 0;
    // prompts
    prompt = promptText(seat, dd, cd);
  }
  function promptText(seat, dd, cd) {
    if (P.sit) return TEXT.prompts.stand;
    if (P.carried > 0) return '';
    if (P.viewfinder) { const v = Photo.nearVantage(chapter, P.x, P.z); return v ? TEXT.prompts.photo : ''; }
    if (standoffWith) return P.hold > 0 ? TEXT.prompts.hold : TEXT.prompts.reach;
    if (cutTarget) return `${TEXT.prompts.cut} ${cutTarget.j[4]}`;
    if (cd < 2.4) return Store.undeveloped.length ? TEXT.prompts.cellar : TEXT.prompts.cellarEmpty;
    if (dd < 2.2) return sleepReady ? TEXT.prompts.sleep : TEXT.prompts.doorLocked;
    if (seat) return TEXT.prompts.sit;
    const v = Photo.nearVantage(chapter, P.x, P.z); if (v && !Store.hasPhoto(v.key)) return 'a photograph, from here';
    return '';
  }
  function nearestSeat() { let best = null, bd = 1.8; for (const s of world.seats) { const d = Math.hypot(P.x - s.x, P.z - s.z); if (d < bd) { bd = d; best = s; } } return best; }
  function sit(seat) { P.sit = seat; P.vx = P.vz = 0; P.x = seat.x; P.z = seat.z; P.yaw = seat.yaw; lastSeat = seat; Sound.sit(); if (seat.line) lineQ.push(seat.line); if (seat.name === 'the porch bench') lineFor('bench'); Store.setSave({ chapter, x: seat.x, z: seat.z, flags: { ...flags }, nights: nightsSpent }); }
  function trigger(id) {
    flags[id] = true;
    if (id === 'hulls') { for (const h of world.hulls) h.rising = true; Sound.at('rumble', 200, 0, 220, 1); Sound.at('rumble', -230, 0, 250, 0.6); setTimeout(() => lineFor('hulls'), 9000); }
    if (id === 'island') { fadeTarget = 0; setTimeout(() => { startChapter(2); }, 1800); }
  }
  function updateHulls(dt) { for (const h of world.hulls) { if (!h.rising) continue; h.rise = Math.min(1, h.rise + dt / 40); const y = lerp(-h.h * 1.05, 0, smooth(0, 1, h.rise)); h.model[13] = y; h.y = y; } }
  function updateO4(dt) {
    // 04 follows out on the ice, hopping ahead and looking back, seen only through the lens
    const d = Math.hypot(o4.x - P.x, o4.z - P.z); o4.t += dt; o4.blink = Math.sin(o4.t * 3) > 0.2 ? 1 : 0;
    o4.lookAt(P.x, P.y + 1.2, P.z);
    if (o4.hop) o4.hopMove(dt, 0, 0, 1);
    else if (d < 14 && P.speed > 0.3) { const ax = Math.sin(P.camYaw), az = Math.cos(P.camYaw); const tx = P.x + ax * 22 + (Math.random() - 0.5) * 6, tz = P.z + az * 22 + (Math.random() - 0.5) * 6; const dx = tx - o4.x, dz = tz - o4.z, l = Math.hypot(dx, dz); o4.hopMove(dt, dx / l, dz / l, 1); }
    else if (d > 60) { o4.x = P.x + Math.sin(P.camYaw) * 30; o4.z = P.z + Math.cos(P.camYaw) * 30; }
    else if (P.stillT > 5 && d > 6) { const dx = P.x - o4.x, dz = P.z - o4.z, l = Math.hypot(dx, dz); o4.hopMove(dt, dx / l, dz / l, 1); }
    o4.speed = 0; o4.pose();
  }
  function takePhoto() {
    const v = Photo.nearVantage(chapter, P.x, P.z); Sound.shutter(); flash = 1;
    Photo.shoot(buildScene(), chapter, P.x, P.z, v);
  }
  function die(kind) { if (deathT > 0) return; deathT = 2.2; fadeTarget = 0; if (kind === 'ice') Sound.splash(); else Sound.fall(); }
  function respawn() { const s = lastSeat || world.seats[0]; Player.place(s.x, s.z - 1, s.yaw); fadeTarget = 1; P.thinT = 0; }
  // being carried: you wake on the bench under the foil blanket. The night has passed, and the window has gone dark.
  function wake(m) {
    P.carried = 0; nightsSpent++; const bench = world.seats.find(s => s.name === 'the porch bench');
    Player.place(bench.x, bench.z, bench.yaw); P.sit = bench; lastSeat = bench;
    m.x = m.post.x; m.z = m.post.z; m.state = 'idle'; m.calm = 0; m.lamp = false; m.notice = 0; for (let l = 0; l < 4; l++) { const [hx, hz] = m.hipWorld(l); m.feet[l].x = hx; m.feet[l].z = hz; m.feet[l].y = World.groundY(hx, hz); }
    if (world.window) { world.window.emis = 0.05; world.lamps[0].k = 0.05; }
    setRig('night'); lineFor('carried'); sleepReady = true;
    setTimeout(() => { fadeTarget = 1; }, 600);
    Store.setSave({ chapter, x: bench.x, z: bench.z, flags: { ...flags }, nights: nightsSpent });
  }
  function goSleep() { fadeTarget = 0; lineFor('sleep'); setTimeout(() => { state = 'end'; stateT = 0; fade = 0; fadeTarget = 1; Store.finish(); Sound.chime(); }, 2500); }
  function openDarkroom() { darkroom = { t: 0, list: Store.undeveloped.slice(0, 8), i: 0 }; state = 'darkroom'; stateT = 0; Sound.develop(); lineQ.push(TEXT.darkroom); }
  function updateDarkroom(dt) {
    const d = darkroom; d.t += dt;
    if (d.list.length && d.t > 8.5) { Store.develop(d.list[d.i]); d.i++; d.t = 0; if (d.i >= d.list.length) d.list = []; else Sound.develop(); }
    if ((!d.list.length && d.t > 1.5 && (pressed.any || nav.ok)) || nav.back || input.pausePressed) { state = 'play'; stateT = 0; }
  }
  function titleCamera(dt) { const c = RENDER.cam; const t = time * 0.02; c.x = 30 * Math.sin(t) - 10; c.y = 6.5; c.z = -62 + Math.cos(t) * 10; c.tx = 0; c.ty = 2; c.tz = 120; c.fov = 50 * Math.PI / 180; }
  function updateSnow(dt) {
    const c = RENDER.cam, on = chapter === 1 || state === 'title'; let n = 0; const d = snow.data;
    if (!on) { snow.count = 0; return; }
    const lim = reduce() ? snow.n * 0.35 : snow.n;
    for (let i = 0; i < lim; i++) { const f = snow.pts[i]; f.p += dt; f.y -= (0.6 + f.s * 4) * dt; f.x += Math.sin(f.p * 0.8) * 0.3 * dt - 0.5 * dt; if (f.y < -2) { f.y = 24; f.x = (Math.random() - 0.5) * 60; f.z = (Math.random() - 0.5) * 60; } if (Math.abs(f.x) < 2.5 && Math.abs(f.z) < 2.5) f.x += 3; d[n * 5] = c.x + f.x; d[n * 5 + 1] = c.y + f.y - 8; d[n * 5 + 2] = c.z + f.z; d[n * 5 + 3] = f.s * 4; d[n * 5 + 4] = 0.7; n++; }
    snow.count = n;
  }

  // ---------------------------------------------------------------- scene
  const sledModel = M.create();
  function buildScene() {
    const items = world.items.slice();
    for (const m of machines) { items.push(m.item); for (const ch of m.chunks) items.push(ch.item); }
    if (state !== 'title') items.push(kid.item);
    M.trs(sledModel, P.sled.x, P.sled.y, P.sled.z, P.sled.yaw); world.sled.model = sledModel;
    RENDER.clearLights();
    for (const l of world.lamps) RENDER.light(l.x, l.y, l.z, l.r, l.col[0] * l.k * 1.6, l.col[1] * l.k * 1.6, l.col[2] * l.k * 1.6);
    if (P.torch && state !== 'title') { const t = kid.torchWorld; const fl = Math.hypot(t[3], t[4], t[5]) || 1; RENDER.light(t[0], t[1], t[2], 26, 1.6, 1.45, 1.15, t[3] / fl, t[4] / fl, t[5] / fl, 0.86); }
    if (world.safelight && chapter >= 2) RENDER.light(world.safelight.x, world.safelight.y - 0.1, world.safelight.z, 5, 0.9, 0.12, 0.06);
    for (const m of machines) if (m.lamp && m.lampWorld) { const l = m.lampWorld; RENDER.light(l[0], l[1], l[2], 18, 1.6, 1.15, 0.6, l[3], l[4], l[5], 0.8); }
    // the hazards blink, the mast blinks
    world.van.emis = Math.sin(time * 4) > 0 ? 1.4 : 0.05; world.mastLight.emis = Math.sin(time * 2.2) > 0.6 ? 1.8 : 0.0;
    return { items };
  }

  // ---------------------------------------------------------------- menus
  const KEYNAME = { Space: 'space', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Enter: 'enter', ShiftLeft: 'shift' };
  const keyName = code => KEYNAME[code] || code.replace(/^Key|^Digit/, '');
  const ACTIONS = [['forward', 'Forward'], ['back', 'Back'], ['left', 'Left'], ['right', 'Right'], ['use', 'Reach out / use / shutter'], ['torch', 'Head torch'], ['camera', 'Raise the camera'], ['cut', 'Raise the cutter']];
  function openMenu(id) { menuStack = [{ id, sel: 0 }]; if (document.exitPointerLock) document.exitPointerLock(); }
  function pushMenu(id) { menuStack.push({ id, sel: 0 }); Sound.tick_menu(); }
  function menuBack() { if (menuStack.length > 1) menuStack.pop(); else if (state === 'play') menuStack = null; }
  function menuItems(id) {
    const back = { label: 'back', act: menuBack }, onOff = v => v ? 'on' : 'off';
    switch (id) {
      case 'main': { const items = []; const sv = Store.save; if (sv) items.push({ label: `continue · ${TEXT.cards[sv.chapter].title}`, act: () => resume(sv) }); items.push({ label: sv ? 'begin again' : 'begin', act: () => { menuStack = null; startChapter(1); } }); if (Store.photos.length) items.push({ label: `the album · ${Store.photos.length}`, act: () => { menuStack = null; state = 'album'; stateT = 0; } }); items.push({ label: 'settings', act: () => pushMenu('settings') }); return items; }
      case 'settings': { const items = [
        { label: `quiet mode · ${onOff(S().quiet)}`, act: () => Store.setting('quiet', !S().quiet) },
        { label: `larger text · ${onOff(S().large)}`, act: () => Store.setting('large', !S().large) },
        { label: `reduced motion · ${onOff(S().reduce)}`, act: () => Store.setting('reduce', !S().reduce) },
        { label: `invert look · ${onOff(S().invertY)}`, act: () => Store.setting('invertY', !S().invertY) },
        { label: `sound · ${onOff(!Sound.muted)}`, act: () => Store.setting('muted', Sound.toggleMute()) }];
        if (!isTouch) items.push({ label: 'controls', act: () => pushMenu('controls') }); return items.concat(back); }
      case 'controls': return ACTIONS.map(([a, name]) => ({ label: `${name} · ${rebinding === a ? 'press a key…' : keyName(S().keys[a])}`, act: () => { rebinding = a; } })).concat({ label: 'restore defaults', act: () => Store.resetKeys() }, back);
      case 'pause': return [{ label: 'continue', act: () => { menuStack = null; } }, { label: 'settings', act: () => pushMenu('settings') }, { label: 'leave to the title', act: () => { menuStack = null; state = 'title'; stateT = 0; openMenu('main'); } }];
    }
    return [back];
  }
  function resume(sv) { menuStack = null; chapter = sv.chapter; Object.assign(flags, sv.flags || {}); nightsSpent = sv.nights || 0; setRig(chapter === 1 ? 'noon' : 'dusk', true); Sound.setChapter(chapter - 1); Player.place(sv.x, sv.z - 1, 0); state = 'play'; stateT = 0; fade = 0; fadeTarget = 1; if (chapter === 2) { awake = true; } if (flags.hulls) for (const h of world.hulls) { h.rise = 1; h.model[13] = 0; } }
  const MENU_HEAD = { settings: 'settings', controls: 'controls — choose one, then press a key', pause: 'paused' };
  function handleMenu() {
    const top = menuStack[menuStack.length - 1], items = menuItems(top.id); top.sel = clamp(top.sel, 0, items.length - 1);
    if (rebinding) return;
    if (nav.up) { top.sel = (top.sel - 1 + items.length) % items.length; Sound.tick_menu(); } if (nav.down) { top.sel = (top.sel + 1) % items.length; Sound.tick_menu(); }
    let chosen = nav.ok ? top.sel : -1;
    if (tap) { const r = menuRects.find(r => tap.x >= r.x && tap.x <= r.x + r.w && tap.y >= r.y && tap.y <= r.y + r.h); if (r) { top.sel = r.i; chosen = r.i; } }
    if (nav.back || (input.pausePressed && top.id === 'pause')) menuBack(); else if (chosen >= 0) { Sound.tick_menu(1); items[chosen].act(); }
  }

  // ---------------------------------------------------------------- HUD
  const g = ctx2; let sx = 1, sy = 1;
  function text(t, x, y, size, a, o = {}) {
    g.font = `${o.italic ? 'italic ' : ''}${o.weight || 400} ${size * sx}px ${FONT}`; g.textAlign = o.align || 'center'; g.textBaseline = 'alphabetic';
    if ('letterSpacing' in g) g.letterSpacing = (o.letter || 0) * sx + 'px';
    if (o.shadow !== false) { g.fillStyle = css('#000000', a * (o.shadowA ?? 0.4)); g.fillText(t, x * sx + 1, y * sy + 1.5); }
    g.fillStyle = css(o.col || '#f6f1e6', a); g.fillText(t, x * sx, y * sy);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
  }
  function wrap(t, maxW, size, o = {}) { g.font = `${o.italic ? 'italic ' : ''}400 ${size * sx}px ${FONT}`; const words = t.split(' '), out = []; let cur = ''; for (const w of words) { const test = cur ? cur + ' ' + w : w; if (g.measureText(test).width > maxW * sx && cur) { out.push(cur); cur = w; } else cur = test; } if (cur) out.push(cur); return out; }
  function roman(n) { return ['', 'I', 'II', 'III', 'IV', 'V', 'VI'][n]; }
  function renderUI() {
    sx = UW / 1280; sy = UH / 720; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, UW, UH);
    const t = T();
    if (state === 'play' || state === 'darkroom') {
      // the viewfinder: a 35 mm frame, the counter, grain is in the render
      if (P.viewfinder && state === 'play') {
        g.fillStyle = 'rgba(8,8,10,0.92)'; const fw = 1280 * sx, fh = 720 * sy, mw = fw * 0.11, mh = fh * 0.11;
        g.fillRect(0, 0, fw, mh); g.fillRect(0, fh - mh, fw, mh); g.fillRect(0, 0, mw, fh); g.fillRect(fw - mw, 0, mw, fh);
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.strokeRect(mw, mh, fw - 2 * mw, fh - 2 * mh);
        g.beginPath(); g.arc(fw / 2, fh / 2, 26 * sx, 0, TAU); g.stroke();
        text(`${Store.photos.filter(p => p.caption).length} / ${world.vantages.length}`, 1280 - 120, 60, 16, 0.8, { letter: 2 });
      }
      // prompts
      if (prompt && !menuStack) { const key = isTouch ? '✧' : keyName(S().keys.use); text(prompt === TEXT.prompts.hold ? prompt : `${key}  ·  ${prompt}`, 640, 60, 20 * t, 0.85, { italic: true }); }
      if (P.hold > 0) { g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2 * sx; g.beginPath(); g.arc(640 * sx, 88 * sy, 14 * sx, -Math.PI / 2, -Math.PI / 2 + Math.min(1, P.hold / 2) * TAU); g.stroke(); }
      if (state === 'play' && stateT < 6 && !menuStack) { const a = Math.min(1, stateT, (6 - stateT) / 1.5); const c = TEXT.cards[chapter]; text(`${c.n} · ${c.title}`, 40, 50, 22 * t, a * 0.85, { align: 'left', letter: 2 }); }
    }
    // narration
    if (lineCur && !menuStack && state !== 'title') {
      const a = Math.min(1, lineCur.t / 0.9, (lineCur.d - lineCur.t) / 0.9), size = 28 * t, lh = 34 * t;
      const ls = wrap(lineCur.text, 780 * (t > 1 ? 1.25 : 1), size, { italic: true }), y0 = 720 - 58 - (ls.length - 1) * lh;
      const grd = g.createLinearGradient(0, (720 - 170 * t) * sy, 0, 720 * sy); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, `rgba(8,8,10,${0.45 * a})`); g.fillStyle = grd; g.fillRect(0, (720 - 170 * t) * sy, UW, 170 * t * sy);
      ls.forEach((l, i) => text(l, 640, y0 + i * lh, size, a, { italic: true, shadowA: 0.6 }));
    }
    // the polaroid thumbnail
    const pl = Photo.S.polaroid;
    if (pl && state === 'play') {
      const tt = pl.t, inT = smooth(0, 0.5, tt), outT = smooth(2.6, 3.4, tt), w = 230, h = 130, x = 1280 - w - 40 + outT * 300, y = 720 - h - 70 + (1 - inT) * 240;
      g.save(); g.translate((x + w / 2) * sx, (y + h / 2) * sy); g.rotate(0.05 - outT * 0.2); g.scale(sx, sy);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-w / 2 - 8, -h / 2 - 6, w + 20, h + 40); g.fillStyle = '#f2eee4'; g.fillRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 42); g.drawImage(pl.canvas, -w / 2, -h / 2, w, h); g.restore();
      text(`${pl.count} / ${pl.total}`, x + w / 2, y + h + 24, 15, inT * (1 - outT) * 0.8, { col: '#3a3530', shadow: false, italic: true });
    }
    if (state === 'darkroom') renderDarkroom();
    if (flash > 0) { g.fillStyle = `rgba(255,252,245,${flash * (reduce() ? 0.3 : 0.8)})`; g.fillRect(0, 0, UW, UH); }
    if (P.carried > 0 && state === 'play') { g.fillStyle = `rgba(230,236,240,${Math.min(0.35, P.carried * 0.06)})`; g.fillRect(0, 0, UW, UH); }
    if (fade < 0.999) { g.fillStyle = `rgba(6,6,8,${1 - fade})`; g.fillRect(0, 0, UW, UH); }
    if (state === 'title') renderTitle();
    if (state === 'card') renderCard();
    if (state === 'end') { g.fillStyle = 'rgba(8,8,10,0.7)'; g.fillRect(0, 0, UW, UH); text(TEXT.ending, 640, 340, 30 * t, Math.min(1, stateT / 1.5), { italic: true }); text(`${Store.photos.length} photographs · ${nightsSpent} night${nightsSpent === 1 ? '' : 's'} spent`, 640, 400, 20 * t, Math.min(1, stateT / 2) * 0.7, { italic: true }); if (stateT > 4) text(isTouch ? 'tap to go on' : 'press any key', 640, 660, 16, 0.5 + Math.sin(time * 2) * 0.2, { italic: true }); }
    if (state === 'album') renderAlbum();
    if (menuStack && state === 'play') { g.fillStyle = 'rgba(8,8,10,0.62)'; g.fillRect(0, 0, UW, UH); renderMenu(330, 1); text(quiet() ? TEXT.quietPause : TEXT.pause, 640, 720 - 60, 16 * t, 0.55, { italic: true }); }
  }
  function renderMenu(y0, a) {
    const top = menuStack[menuStack.length - 1], items = menuItems(top.id), t = T(); menuRects = [];
    const head = MENU_HEAD[top.id]; if (head) text(head, 640, y0 - 44 * t, 18 * t, a * 0.65, { italic: true, letter: 2 });
    const lh = Math.min(44 * t, 330 / Math.max(1, items.length));
    items.forEach((it, i) => { const y = y0 + i * lh, on = i === top.sel, size = Math.min(25 * t, lh * 0.72); text(it.label, 640, y, size, a * (on ? 1 : 0.62), { italic: !on, weight: on ? 500 : 400, letter: on ? 1 : 0 }); if (on) { g.font = `500 ${size * sx}px ${FONT}`; const w = g.measureText(it.label).width / 2 / sx + 22; g.fillStyle = css('#f6f1e6', a * 0.7); g.fillRect((640 - w - 14) * sx, (y - size * 0.32) * sy, 10 * sx, 1.5); g.fillRect((640 + w + 4) * sx, (y - size * 0.32) * sy, 10 * sx, 1.5); } menuRects.push({ x: 640 - 330, y: y - size - 6, w: 660, h: lh, i }); });
  }
  function renderTitle() {
    const a = Math.min(1, stateT / 2), b = Math.min(1, Math.max(0, stateT - 0.6));
    const grd = g.createLinearGradient(0, 0, 0, 360 * sy); grd.addColorStop(0, `rgba(20,24,30,${0.35 * a})`); grd.addColorStop(1, 'rgba(20,24,30,0)'); g.fillStyle = grd; g.fillRect(0, 0, UW, 360 * sy);
    text(TEXT.title, 640, 190, 88, a, { weight: 500, letter: 18, shadowA: 0.3 }); text(TEXT.subtitle, 640, 238, 30, a * 0.9, { italic: true });
    if (menuStack) { const band = g.createLinearGradient(0, 270 * sy, 0, 620 * sy); band.addColorStop(0, 'rgba(20,24,30,0)'); band.addColorStop(0.3, `rgba(20,24,30,${0.3 * b})`); band.addColorStop(0.75, `rgba(20,24,30,${0.3 * b})`); band.addColorStop(1, 'rgba(20,24,30,0)'); g.fillStyle = band; g.fillRect(0, 270 * sy, UW, 350 * sy); renderMenu(menuStack.length > 1 ? 370 : 330, b); }
    if (!isTouch) { const k = S().keys; const foot = g.createLinearGradient(0, (720 - 90) * sy, 0, 720 * sy); foot.addColorStop(0, 'rgba(14,16,20,0)'); foot.addColorStop(1, `rgba(14,16,20,${0.55 * b})`); g.fillStyle = foot; g.fillRect(0, (720 - 90) * sy, UW, 90 * sy); text(`${keyName(k.forward)} ${keyName(k.left)} ${keyName(k.back)} ${keyName(k.right)}  walk   ·   mouse  look   ·   ${keyName(k.use)} / click  reach out, use, shutter   ·   ${keyName(k.torch)}  torch   ·   ${keyName(k.camera)}  camera   ·   ${keyName(k.cut)} / right click  cutter   ·   shift  hurry   ·   esc  pause`, 640, 720 - 30, 14 * T(), b * 0.65, { letter: 1 }); }
    text('a vertical slice: the crossing, the farm, and one bearer', 640, 720 - 62, 15, b * 0.5, { italic: true });
  }
  function renderCard() { const tt = stateT, a = Math.min(1, tt / 1.2) * (1 - smooth(3.6, 5, tt)), bg = 1 - smooth(3.2, 5, tt), c = TEXT.cards[chapter]; g.fillStyle = `rgba(8,8,10,${0.85 * bg})`; g.fillRect(0, 0, UW, UH); text(c.n, 640, 280, 30, a * 0.8, { letter: 6 }); text(c.title, 640, 360, 74, a, { weight: 500, letter: 4 }); text(c.sub, 640, 404, 26, a * 0.85, { italic: true }); text(c.date, 640, 470, 20, a * 0.6, { italic: true, letter: 2 }); }
  function renderDarkroom() {
    const d = darkroom, t = T();
    g.fillStyle = 'rgba(28,10,4,0.86)'; g.fillRect(0, 0, UW, UH);
    text('the darkroom', 640, 70, 26 * t, 0.7, { italic: true, letter: 3, col: '#f0b070' });
    if (!d.list.length) { text('Nothing waiting in the trays.' + (Store.photos.length ? ' The prints are in the album.' : ''), 640, 340, 22 * t, 0.8, { italic: true, col: '#f0b070' }); text(isTouch ? 'tap to leave' : 'press any key to leave', 640, 640, 16 * t, 0.5, { italic: true, col: '#f0b070' }); return; }
    const p = d.list[d.i], w = 520, h = 292, x = 640 - w / 2, y = 130, u = smooth(0.5, 8, d.t);
    g.save(); g.translate(x * sx, y * sy); g.scale(sx, sy);
    g.fillStyle = '#efe6d6'; g.fillRect(-14, -14, w + 28, h + 60);
    g.fillStyle = '#d9c7ad'; g.fillRect(0, 0, w, h);
    const img = p.print && (!(p.print instanceof Image) || p.print.complete) ? p.print : null;
    if (img) { g.globalAlpha = u; g.drawImage(img, 0, 0, w, h); g.globalAlpha = 1; }
    g.fillStyle = `rgba(240,150,80,${0.55 * (1 - u)})`; g.fillRect(0, 0, w, h);
    g.restore();
    text(p.caption || 'a free frame', 640, y + h + 26, 15 * t, u * 0.9, { italic: true, col: '#3a3530', shadow: false });
    text(`${d.i + 1} of ${d.list.length}`, 640, y + h + 52, 13 * t, 0.7, { italic: true, col: '#f0b070' });
    text('The print comes up over eight seconds. It shows what the eye did not.', 640, 640, 16 * t, 0.5, { italic: true, col: '#f0b070' });
  }
  function renderAlbum() {
    g.fillStyle = '#1b1a1e'; g.fillRect(0, 0, UW, UH); const t = T(), a = Math.min(1, stateT / 1.5);
    text('the album', 640, 64, 30 * t, a, { italic: true, letter: 3 });
    const list = Store.photos, n = list.length, cols = 5, w = 196, h = 110, gap = 26, rowH = h + 44 + 14 * t, x0 = 640 - (Math.min(cols, Math.max(1, n)) * (w + gap) - gap) / 2, y0 = 116;
    list.forEach((p, i) => { const r = (i / cols) | 0, c = i % cols, x = x0 + c * (w + gap), y = y0 + r * rowH; const img = p.developed ? p.print : p.img; g.save(); g.globalAlpha = a; g.translate((x + w / 2) * sx, (y + h / 2) * sy); g.rotate(((i * 7919) % 11 - 5) * 0.006); g.scale(sx, sy); g.fillStyle = '#f0ece2'; g.fillRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 36 + 14 * t); if (img && (!(img instanceof Image) || (img.complete && img.naturalWidth))) g.drawImage(img, -w / 2, -h / 2, w, h); else { g.fillStyle = '#c9c4b8'; g.fillRect(-w / 2, -h / 2, w, h); } if (!p.developed) { g.fillStyle = 'rgba(40,30,20,0.35)'; g.fillRect(-w / 2, -h / 2, w, h); } g.restore(); const cl = wrap(p.caption || (p.developed ? '' : 'undeveloped'), w + 6, 12.5 * t, { italic: true }); cl.slice(0, 2).forEach((l, k) => text(l, x + w / 2, y + h + 15 + 12.5 * t * 0.5 + k * 12.5 * t * 1.1, 12.5 * t, a, { italic: true, col: '#3a3530', shadow: false })); });
    if (!n) text('No photographs yet.', 640, 330, 22 * t, a * 0.8, { italic: true });
    text(isTouch ? 'tap to go back' : 'press any key', 640, 720 - 24, 15 * t, 0.4 + Math.sin(time * 2) * 0.2, { italic: true });
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    const n = Math.ceil(dt / (1 / 60)); for (let i = 0; i < n; i++) update(dt / n);
    try { if (state !== 'album') RENDER.frame(buildScene(), W, H, snow.count ? { data: snow.data, n: snow.count, col: snow.col } : null); renderUI(); }
    catch (err) { if (!frame.warned) { frame.warned = true; console.error(err); } }
    requestAnimationFrame(frame);
  }
  function start() {
    document.getElementById('loading').style.display = 'none';
    if (Store.settings.muted && !Sound.muted) Sound.toggleMute();
    state = 'title'; stateT = 0; fade = 0; fadeTarget = 1; setRig('noon', true);
    requestAnimationFrame(t => { last = t; frame(t); });
  }
  window.__game = {
    get state() { return state; }, get P() { return P; }, get chapter() { return chapter; }, get flags() { return flags; }, get machines() { return machines; }, get bearer() { return bearer; }, keys, pressed, nav, input, world,
    jump(ch, x, z) { menuStack = null; if (ch >= 2) { flags.island = true; flags.hulls = true; for (const h of world.hulls) { h.rise = 1; h.model[13] = 0; h.y = 0; } } startChapter(ch); state = 'play'; stateT = 10; fade = 1; fadeTarget = 1; if (x !== undefined) Player.place(x, z, 0); if (ch === 2) awake = true; },
    set(x, y, z, tx, ty, tz) { const c = RENDER.cam; state = 'free'; c.x = x; c.y = y; c.z = z; c.tx = tx; c.ty = ty; c.tz = tz; },
    place(x, z, yaw) { Player.place(x, z, yaw || 0); }, step(n, dt = 1 / 60) { for (let i = 0; i < n; i++) update(dt); }, get awake() { return awake; }, set awake(v) { awake = v; }, get standoff() { return standoffWith; }, get time() { return time; }, get deaths() { return deathT; }, setState(s) { state = s; stateT = 0; },
  };
  return { start };
})();
Game.start();
