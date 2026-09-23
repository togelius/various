'use strict';

const PH = { g: 2200, run: 235, acc: 1900, airAcc: 1250, fric: 2400, jump: 640, coyote: 0.1, buffer: 0.13, maxFall: 950, step: 16, w: 16, h: 42 };
const FONT = '"Cormorant Garamond", "EB Garamond", Garamond, Georgia, serif';

const Game = (() => {
  const cv = document.getElementById('screen'), ctx = cv.getContext('2d');
  const loadingEl = document.getElementById('loading');
  let scale = 1, Q = 1;

  // ---------------------------------------------------------------- setup
  function resize() {
    const s = Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H);
    const cw = Math.floor(VIEW_W * s), ch = Math.floor(VIEW_H * s);
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.round(Math.min(cw * dpr, 1920));
    cv.width = bw; cv.height = Math.round(bw * 9 / 16);
    scale = cv.width / VIEW_W;
  }
  addEventListener('resize', resize);
  resize();
  Q = clamp((window.devicePixelRatio || 1) * Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H), 1, 1.5);

  // input
  const keys = {}, pressed = {};
  const map = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump',
    KeyE: 'photo', KeyX: 'photo', ArrowDown: 'photo', KeyS: 'photo', KeyC: 'photo', Enter: 'start', Escape: 'pause', KeyP: 'pause', KeyM: 'mute' };
  addEventListener('keydown', e => {
    const a = map[e.code];
    if (a) { if (!keys[a]) pressed[a] = true; keys[a] = true; e.preventDefault(); }
    pressed.any = true;
    Sound.init();
  });
  addEventListener('keyup', e => { const a = map[e.code]; if (a) keys[a] = false; });
  cv.addEventListener('pointerdown', () => { pressed.any = true; Sound.init(); });
  for (const b of document.querySelectorAll('#touch button')) {
    const a = b.dataset.act;
    const on = e => { e.preventDefault(); if (!keys[a]) pressed[a] = true; keys[a] = true; pressed.any = true; Sound.init(); b.classList.add('on'); };
    const off = e => { e.preventDefault(); keys[a] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
  }
  // the left pad is one strip: whichever half your thumb is over, you walk that way
  const stick = document.getElementById('stick');
  if (stick) {
    const halves = stick.querySelectorAll('.half');
    const set = e => {
      const r = stick.getBoundingClientRect(), right = e.clientX > r.left + r.width / 2;
      if (right && !keys.right) pressed.right = true;
      if (!right && !keys.left) pressed.left = true;
      keys.right = right; keys.left = !right;
      halves[0].classList.toggle('on', !right); halves[1].classList.toggle('on', right);
    };
    const end = e => { keys.left = keys.right = false; halves.forEach(h => h.classList.remove('on')); };
    stick.addEventListener('pointerdown', e => { e.preventDefault(); stick.setPointerCapture(e.pointerId); pressed.any = true; Sound.init(); set(e); });
    stick.addEventListener('pointermove', e => { if (stick.hasPointerCapture(e.pointerId)) set(e); });
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  }
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch');
  addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  let padPrev = {};
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && [...pads].find(Boolean);
    if (!p) return;
    const st = {
      left: p.axes[0] < -0.35 || p.buttons[14]?.pressed, right: p.axes[0] > 0.35 || p.buttons[15]?.pressed,
      jump: p.buttons[0]?.pressed, photo: p.buttons[2]?.pressed || p.buttons[3]?.pressed || p.buttons[1]?.pressed, start: p.buttons[9]?.pressed,
    };
    for (const k in st) {
      if (st[k] && !padPrev[k]) { pressed[k] = true; pressed.any = true; Sound.init(); }
      if (st[k] !== padPrev[k]) keys[k] = !!st[k];
    }
    padPrev = st;
  }

  // ---------------------------------------------------------------- state
  let state = 'boot', stateT = 0, time = 0, paused = false;
  let ci = 0, world = null, layers = null, L = null;
  let player, robot, cam, flakes = [], splashes = [], fogTex = null, fgSprites = [], fgItems = [], moverSprites = new Map();
  let lines = [], lineQ = [], lineCur = null, photos = [], album = [], checkpoint = null;
  let fade = 1, fadeTarget = 1, flash = 0, polaroid = null, ending = null, deathT = 0, promptA = 0;
  let life = null, placePromptA = 0;
  const glowCache = {};
  let grain = null, vignette = null;

  function glow(col) {
    if (glowCache[col]) return glowCache[col];
    const c = makeCanvas(256, 256), g = c.getContext('2d');
    const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    rg.addColorStop(0, css(col, 1)); rg.addColorStop(0.2, css(col, 0.45)); rg.addColorStop(0.55, css(col, 0.1)); rg.addColorStop(1, css(col, 0));
    g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
    return (glowCache[col] = c);
  }
  function drawGlow(col, x, y, r, a) {
    ctx.globalAlpha = a; ctx.drawImage(glow(col), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
  }

  function makePost() {
    grain = makeCanvas(256, 256);
    const g = grain.getContext('2d'), id = g.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 18; }
    g.putImageData(id, 0, 0);
    vignette = makeCanvas(640, 360);
    const v = vignette.getContext('2d'), rg = v.createRadialGradient(320, 190, 120, 320, 180, 420);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(0.7, 'rgba(10,8,6,0.12)'); rg.addColorStop(1, 'rgba(10,8,6,0.55)');
    v.fillStyle = rg; v.fillRect(0, 0, 640, 360);
  }

  function fgSprite(kind, col, col2, seed) {
    const c = makeCanvas(360, 260), g = c.getContext('2d'), r = rng32(seed);
    g.translate(180, 260);
    if (kind === 'reeds') { Art.reeds(g, 0, 0, 220, col, r, 26); Art.reeds(g, 30, 0, 160, col2, r, 12); }
    else if (kind === 'fence') {
      Art.line(g, -40, 0, -30, -240, 9, col); Art.line(g, 120, 0, 110, -200, 7, col);
      g.strokeStyle = css(col2); g.lineWidth = 2; g.beginPath();
      for (let k = -200; k < 200; k += 16) { g.moveTo(k, -200); g.lineTo(k + 80, 0); g.moveTo(k + 80, -200); g.lineTo(k, 0); }
      g.stroke();
    } else {
      for (let i = 0; i < 70; i++) {
        const bx = gauss(r) * 80, h = 60 + r() * (kind === 'tall' ? 200 : 140);
        g.strokeStyle = css(jit(r() < 0.6 ? col : col2, r, 16)); g.lineWidth = 1.5 + r() * 2.5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(bx, 0); g.quadraticCurveTo(bx + (r() - 0.5) * 30, -h * 0.6, bx + (r() - 0.5) * 70, -h); g.stroke();
        if (kind === 'tall' && r() < 0.15) Art.dab(g, bx + (r() - 0.5) * 60, -h, 3, 3, 0, '#f3d58a', 0.9);
      }
    }
    const b = makeCanvas(360, 260), bg = b.getContext('2d');
    if ('filter' in bg) bg.filter = `blur(${kind === 'fence' ? 3.2 : 4.2}px)`;
    bg.drawImage(c, 0, 0);
    return b;
  }

  // ---------------------------------------------------------------- chapters
  function loadChapter(i, then) {
    ci = i; L = LEVELS[i];
    loadingEl.textContent = 'painting…'; loadingEl.style.display = 'block';
    setTimeout(() => {
      if (layers) for (const l of layers) l.canvas.width = 0;
      for (const s of moverSprites.values()) s.canvas.width = 0;
      moverSprites.clear();
      world = new World(L);
      layers = world.buildLayers(Q);
      for (const m of world.movers) moverSprites.set(m, moverSprite(world, m, Q));
      fogTex = Art.fogTexture(2048, 256, L.seed);
      tintCanvas(fogTex, L.pal.haze);
      const fg = L.pal.fg;
      fgSprites = [0, 1, 2].map(k => fgSprite(fg.kind, fg.col, fg.col2, L.seed + k));
      fgItems = [];
      const fr = rng32(L.seed + 9);
      for (let x = 200; x < world.W * 1.25 + 800; x += 380 + fr() * 900) fgItems.push({ x, s: fgSprites[(fr() * 3) | 0], k: 0.8 + fr() * 0.6, flip: fr() < 0.5 });
      resetChapterState();
      loadingEl.style.display = 'none';
      Sound.setChapter(i);
      then && then();
    }, 40);
  }

  function tintCanvas(c, col) {
    const g = c.getContext('2d');
    g.globalCompositeOperation = 'source-in'; g.fillStyle = css(col); g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over';
  }

  function resetChapterState() {
    life = new QuietLife(world);
    placePromptA = 0;
    robot = new Robot(world);
    robot.onBeep = v => Sound.beep(v);
    const sx = 90, sy = world.surfaceAt(sx);
    player = { x: sx, y: sy, vx: 0, vy: 0, face: 1, onGround: true, ref: null, coyote: 0, buffer: 0, phase: 0, run: 0, air: false, stepT: 0, t: 0, breathT: 1, surface: 'snow' };
    checkpoint = { x: sx, y: sy, i: 0 };
    cam = { x: 0, y: 0 };
    lines = L.lines.map(([x, text]) => ({ x, text, shown: false }));
    lineQ = []; lineCur = null;
    photos = L.photos.map(([x, caption]) => ({ x, y: world.surfaceAt(x), caption, taken: false }));
    ending = null; splashes = [];
    initFlakes();
  }

  function initFlakes() {
    flakes = [];
    const w = L.pal.weather;
    for (let i = 0; i < w.n; i++) flakes.push({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, z: 0.3 + Math.random() * 1.2, p: Math.random() * TAU });
  }

  // ---------------------------------------------------------------- physics
  function solidsList() { return world.solids.concat(world.movers); }

  function gravityAt(x) { return (L.pal.lowGrav && x > L.pal.lowGrav) ? 0.52 : 1; }

  function surfaceKind(s) {
    if (!s) return ['snow', 'grass', 'marsh', 'default', 'snow'][L.id - 1];
    const t = s.o ? s.o.t : s.art;
    if (t === 'metal' || t === 'pipe' || t === 'lift' || t === 'drum' || t === 'debris' || t === 'car') return 'metal';
    if (t === 'plank' || t === 'log') return 'wood';
    if (t === 'bale') return 'soft';
    return 'default';
  }

  function updatePlayer(dt, control) {
    const p = player;
    const gmul = gravityAt(p.x);
    let dir = 0;
    if (control) dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (control && pressed.jump) p.buffer = PH.buffer;
    // ride movers
    if (p.ref && p.ref.moving) { p.x += p.ref.vx; p.y += p.ref.vy; }
    const acc = p.onGround ? PH.acc : PH.airAcc;
    if (dir) { p.vx += dir * acc * dt; p.face = dir; }
    else if (p.onGround) { const f = PH.fric * dt; p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f; }
    else p.vx *= Math.pow(0.3, dt);
    p.vx = clamp(p.vx, -PH.run, PH.run);
    p.coyote = p.onGround ? PH.coyote : p.coyote - dt;
    p.buffer -= dt;
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -PH.jump * (gmul < 1 ? 0.88 : 1); p.coyote = 0; p.buffer = 0; p.onGround = false; p.ref = null;
      Sound.jump();
    }
    let g = PH.g * gmul;
    if (p.vy < 0 && !(control && keys.jump)) g *= 2.4;
    p.vy = Math.min(p.vy + g * dt, PH.maxFall * (gmul < 1 ? 0.6 : 1));

    const hw = PH.w / 2, H = PH.h, S = solidsList();
    // horizontal
    let nx = p.x + p.vx * dt;
    for (const s of S) {
      if (s.oneway) continue;
      if (p.y > s.y + 2 && p.y - H < s.y + s.h && nx + hw > s.x && nx - hw < s.x + s.w) {
        // low ledges (a resting lift, a kerb) are stepped onto, not walked into
        if (p.onGround && p.y - s.y <= PH.step && !S.some(o => o !== s && !o.oneway && nx + hw > o.x && nx - hw < o.x + o.w && s.y - H < o.y + o.h && s.y > o.y)) { p.y = s.y; p.ref = s; continue; }
        if (p.x <= s.x + s.w / 2) nx = s.x - hw; else nx = s.x + s.w + hw;
        p.vx = 0;
      }
    }
    for (const ex of [nx - hw, nx + hw]) {
      const gy = world.groundAt(ex);
      // ground is a wall only where it rises above our feet by more than a step
      if (gy !== null && p.y > gy + PH.step) {
        const side = ex < nx ? -1 : 1;
        if (Math.sign(nx - p.x) === side) { nx = p.x; p.vx = 0; }
      }
    }
    nx = clamp(nx, hw, world.W - hw);
    p.x = nx;

    // vertical
    const was = p.onGround;
    let ny = p.y + p.vy * dt;
    p.onGround = false;
    let land = null, landRef = null;
    if (p.vy >= 0) {
      for (const s of S) {
        if (p.x + hw - 2 > s.x && p.x - hw + 2 < s.x + s.w) {
          const tol = 1 + (s.vy ? Math.abs(s.vy) : 0) + (was ? PH.step : 0);
          if (p.y <= s.y + tol && ny >= s.y && (land === null || s.y < land)) { land = s.y; landRef = s; }
        }
      }
      let gy = null;
      for (const sx of [p.x - hw + 2, p.x, p.x + hw - 2]) { const v = world.groundAt(sx); if (v !== null && (gy === null || v < gy)) gy = v; }
      if (gy !== null) {
        if (ny >= gy - 0.5 && p.y <= gy + PH.step + 4 && (land === null || gy < land)) { land = gy; landRef = null; }
        else if (was && !p.ref && gy - ny < 20 && gy > ny && (land === null || gy < land)) { land = gy; landRef = null; }
      }
    } else {
      for (const s of S) {
        if (s.oneway) continue;
        if (p.x + hw - 2 > s.x && p.x - hw + 2 < s.x + s.w && p.y - H >= s.y + s.h - 2 && ny - H < s.y + s.h) { ny = s.y + s.h + H; p.vy = 0; }
      }
    }
    if (land !== null) {
      if (!was && p.vy > 250) { Sound.land(surfaceKind(landRef)); if (p.vy > 500) puff(p.x, land, 8); }
      ny = land; p.vy = 0; p.onGround = true; p.ref = landRef;
      p.surface = surfaceKind(landRef);
    } else p.ref = null;
    p.y = ny;

    // animation
    const speed = Math.abs(p.vx) / PH.run;
    p.run = lerp(p.run, p.onGround ? speed : 0, 1 - Math.pow(0.001, dt));
    p.air = !p.onGround;
    p.phase += dt * (6 + speed * 9) * (p.onGround ? 1 : 0);
    p.t += dt;
    if (p.onGround && speed > 0.2) {
      p.stepT -= dt * (0.7 + speed * 1.8);
      if (p.stepT <= 0) { p.stepT = 0.5; Sound.step(p.surface); if (L.pal.snow && p.surface === 'snow' && Math.random() < 0.6) puff(p.x - p.face * 4, p.y, 2); }
    }
    if (p.onGround) checkpointsReach();
  }

  function checkpointsReach() {
    const pts = robot.pts;
    for (let i = checkpoint.i + 1; i < pts.length; i++) {
      if (player.x >= pts[i].x - 30 && Math.abs(player.y - pts[i].y) < 60) { checkpoint = { x: pts[i].x, y: pts[i].y, i }; }
    }
  }

  function dangers() {
    const p = player;
    if (p.y > VIEW_H + 60) return 'fall';
    const gp = world.inGap(p.x);
    if (gp && gp.water !== undefined && p.y > gp.water + 14) return 'water';
    for (const h of L.hazards || []) {
      if (!hazardOn(h)) continue;
      const gy = world.groundAt(h.x) ?? VIEW_H;
      if (Math.abs(p.x - h.x) < 13 && p.y > h.y0 && p.y - PH.h < gy) return 'zap';
    }
    return null;
  }
  function hazardPhase(h) { return ((time / h.period + (h.phase || 0)) % 1 + 1) % 1; }
  function hazardOn(h) { return hazardPhase(h) * h.period < h.on; }
  function hazardWarn(h) { const t = hazardPhase(h) * h.period; return t > h.period - 0.45; }

  function die(kind) {
    if (deathT > 0) return;
    deathT = 1.1;
    if (kind === 'water') { Sound.splash(); splash(player.x, world.inGap(player.x).water); }
    else if (kind === 'zap') { Sound.zap(); flash = 0.6; }
    else Sound.fall();
    fadeTarget = 0;
  }
  function respawn() {
    const c = checkpoint;
    player.x = c.x - 20; player.y = world.surfaceAt(player.x) ?? c.y; player.vx = 0; player.vy = 0; player.ref = null; player.onGround = true;
    if (world.surfaceAt(player.x) === null) { player.x = c.x; player.y = c.y; }
    if (robot.i < c.i) { robot.i = c.i; robot.x = robot.pts[c.i].x; robot.y = robot.pts[c.i].y; robot.path = null; }
    fadeTarget = 1;
  }

  // ---------------------------------------------------------------- particles
  function puff(x, y, n) {
    const col = L.pal.snow ? L.pal.snow.c : '#b8a888';
    for (let i = 0; i < n; i++) splashes.push({ x, y: y - 2, vx: (Math.random() - 0.5) * 90, vy: -Math.random() * 90, life: 0.5 + Math.random() * 0.4, t: 0, col, r: 1.5 + Math.random() * 1.5 });
  }
  function splash(x, y) {
    for (let i = 0; i < 26; i++) splashes.push({ x: x + (Math.random() - 0.5) * 20, y, vx: (Math.random() - 0.5) * 160, vy: -120 - Math.random() * 260, life: 0.9, t: 0, col: '#dfe4e6', r: 1.5 + Math.random() * 2, g: 1 });
  }
  function breath() {
    if (!L.pal.breath || state !== 'play') return;
    const p = player;
    splashes.push({ x: p.x + p.face * 8, y: p.y - 40, vx: p.face * 16 + p.vx * 0.3, vy: -8, life: 1.6, t: 0, col: '#ffffff', r: 2.5, breath: true });
  }

  function updateFlakes(dt, dx, dy) {
    const w = L.pal.weather;
    const rise = w.rise && player && player.x > w.rise ? smooth(w.rise, w.rise + 900, player.x) : 0;
    for (const f of flakes) {
      f.p += dt;
      f.x -= dx * f.z; f.y -= dy * f.z;
      if (w.kind === 'snow') {
        f.x += (w.wind + Math.sin(f.p * 1.3) * 12) * f.z * dt;
        f.y += lerp(w.fall, -w.fall * 1.2, rise) * f.z * dt;
      } else if (w.kind === 'motes') {
        f.x += Math.sin(f.p * 0.7) * 8 * dt; f.y += Math.cos(f.p * 0.5) * 6 * dt - 3 * dt;
      } else {
        f.x += -60 * f.z * dt; f.y += 420 * f.z * dt;
      }
      if (f.x < -10) f.x += VIEW_W + 20; if (f.x > VIEW_W + 10) f.x -= VIEW_W + 20;
      if (f.y < -10) f.y += VIEW_H + 20; if (f.y > VIEW_H + 10) f.y -= VIEW_H + 20;
    }
  }

  // ---------------------------------------------------------------- story
  function updateLines(dt) {
    for (const l of lines) if (!l.shown && player.x >= l.x) { l.shown = true; lineQ.push(l.text); }
    if (lineCur) {
      lineCur.t += dt;
      if (lineCur.t > lineCur.d) lineCur = null;
    }
    if (!lineCur && lineQ.length) { const text = lineQ.shift(); lineCur = { text, t: 0, d: 3.2 + text.length / 17 }; }
  }

  function nearPhoto() {
    for (const ph of photos) if (!ph.taken && Math.abs(player.x - ph.x) < 60 && Math.abs(player.y - ph.y) < 70) return ph;
    return null;
  }
  let wantShot = null;
  function takePhoto(ph) {
    ph.taken = true; wantShot = ph; Sound.shutter(); flash = 1;
  }
  function captureShot() {
    const c = makeCanvas(384, 216), g = c.getContext('2d');
    g.drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, 384, 216);
    album.push({ canvas: c, caption: wantShot.caption, chapter: L.title });
    polaroid = { canvas: c, t: 0 };
    wantShot = null;
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    time += dt; stateT += dt;
    pollPad();
    if (pressed.mute) Sound.toggleMute();
    Sound.update(dt);
    fade = lerp(fade, fadeTarget, 1 - Math.pow(0.02, dt));
    flash = Math.max(0, flash - dt * 2.2);
    if (polaroid) { polaroid.t += dt; if (polaroid.t > 3.4) polaroid = null; }

    if (state === 'title') {
      cam.x = 60 + Math.sin(time * 0.05) * 40 + time * 6; cam.y = 0;
      robot.t += dt; robot.blink = Math.sin(time * 3) > 0.2 ? 1 : 0;
      updateFlakes(dt, 6 * dt, 0);
      if (stateT > 0.8 && (pressed.any)) { state = 'card'; stateT = 0; cam.x = 0; Sound.init(); }
    } else if (state === 'card') {
      follow(dt, true);
      updateFlakes(dt, 0, 0);
      fadeTarget = 1;
      if (stateT > 5.2 || (stateT > 1.2 && (pressed.jump || pressed.start || pressed.any))) { state = 'play'; stateT = 0; }
    } else if (state === 'play') {
      if (pressed.pause || (pressed.start && paused)) paused = !paused;
      if (paused) { clearPressed(); return; }
      const control = deathT <= 0;
      world.updateMovers(time);
      updatePlayer(dt, control);
      robot.update(dt, player);
      const d = dangers(); if (d) die(d);
      if (deathT > 0) { const before = deathT; deathT -= dt; if (before > 0.45 && deathT <= 0.45) respawn(); if (deathT <= 0) deathT = 0; }
      const ph = nearPhoto();
      promptA = lerp(promptA, ph ? 1 : 0, 1 - Math.pow(0.001, dt));
      const place = deathT <= 0 && !ph && life.near(player);
      placePromptA = lerp(placePromptA, place ? 1 : 0, 1 - Math.pow(0.005, dt));
      if (pressed.photo && deathT <= 0) {
        if (ph) takePhoto(ph);
        else life.interact(player);
      }
      life.update(dt, player, deathT <= 0);
      for (const event of life.drainSounds(player.x)) Sound.quiet(event);
      updateLines(dt);
      for (const h of L.hazards || []) if (hazardOn(h) && Math.abs(h.x - player.x) < 700 && Math.random() < dt * 12) Sound.crackle();
      player.breathT -= dt; if (player.breathT < 0) { player.breathT = 1.6 + Math.random(); breath(); }
      const ox = cam.x, oy = cam.y;
      follow(dt);
      updateFlakes(dt, cam.x - ox, cam.y - oy);
      if (player.x >= L.exit && player.onGround && deathT <= 0) {
        if (L.ending) startEnding();
        else { state = 'exit'; stateT = 0; fadeTarget = 0; Sound.chime(); }
      }
    } else if (state === 'exit') {
      world.updateMovers(time);
      updatePlayer(dt, false); player.vx = PH.run * 0.6; robot.update(dt, player);
      const ox = cam.x; follow(dt); updateFlakes(dt, cam.x - ox, 0);
      if (stateT > 1.6) { state = 'loading'; loadChapter(ci + 1, () => { state = 'card'; stateT = 0; fade = 0; fadeTarget = 1; }); }
    } else if (state === 'ending') {
      updateEnding(dt);
    } else if (state === 'album') {
      if (stateT > 3 && (pressed.jump || pressed.start || pressed.photo || pressed.any)) { state = 'loading'; album = []; loadChapter(0, () => { state = 'title'; stateT = 0; fade = 0; fadeTarget = 1; }); }
    }
    for (const s of splashes) {
      s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.breath) { s.r += dt * 6; s.vx *= 0.97; } else s.vy += (s.g ? 900 : 300) * dt;
    }
    splashes = splashes.filter(s => s.t < s.life);
    clearPressed();
  }
  function clearPressed() { for (const k in pressed) pressed[k] = false; }

  function follow(dt, snap) {
    const p = player;
    const tx = clamp(p.x - VIEW_W * 0.42 + p.face * 70, 0, world.W - VIEW_W);
    const ty = clamp(Math.min(0, p.y - 440), -world.top, 0);
    const k = snap ? 1 : 1 - Math.pow(0.08, dt);
    cam.x = lerp(cam.x, tx, k); cam.y = lerp(cam.y, ty, snap ? 1 : 1 - Math.pow(0.2, dt));
  }

  // ---------------------------------------------------------------- ending
  function startEnding() {
    state = 'ending'; stateT = 0;
    ending = { phase: 0, t: 0, rise: 0, text: [], beam: 0 };
    const n = robot.pts.length;
    if (Math.abs(robot.x - player.x) > 500) { robot.path = null; robot.i = n - 2; robot.x = robot.pts[n - 2].x; robot.y = robot.pts[n - 2].y; }
    Sound.rise(8);
  }
  function updateEnding(dt) {
    const e = ending, S = L.sphere;
    e.t += dt;
    world.updateMovers(time);
    // the kid walks a few more steps, then stands still
    const control = false;
    if (player.x < L.exit + 60) player.vx = PH.run * 0.35; else player.vx *= 0.8;
    updatePlayer(dt, control);
    if (player.x < L.exit + 60) { player.vx = PH.run * 0.35; }
    player.face = 1;
    // the machine walks under the sphere and rises
    if (!robot.path && robot.i < robot.pts.length - 1) robot.go(robot.pts.length - 1);
    if (!robot.path) {
      robot.face = -1;
      if (e.t > 4) { e.rise = Math.min(1, e.rise + dt / 9); robot.hopping = true; }
      robot.x = robot.pts[robot.pts.length - 1].x;
      robot.y = lerp(robot.pts[robot.pts.length - 1].y, S.y + S.R * 0.2, e.rise * e.rise * (3 - 2 * e.rise));
      robot.t += dt; robot.blink = Math.sin(robot.t * 6) > 0 ? 1 : 0;
    } else robot.update(dt, { x: robot.x + 2000, y: robot.y });
    e.beam = lerp(e.beam, e.t > 3 ? 1 : 0, 1 - Math.pow(0.3, dt));
    const ox = cam.x, oy = cam.y;
    cam.x = lerp(cam.x, world.W - VIEW_W, 1 - Math.pow(0.3, dt));
    cam.y = lerp(cam.y, e.t > 4 ? -200 : 0, 1 - Math.pow(0.5, dt));
    updateFlakes(dt, cam.x - ox, cam.y - oy);
    const script = [[2, 'Dawn came up the colour of the inside of a shell.'], [8, 'It went up without looking back.'], [13.5, 'I think that was the point.']];
    for (const [t, text] of script) if (e.t > t && !e.text.includes(text)) { e.text.push(text); lineCur = { text, t: 0, d: 4.8 }; }
    if (lineCur) { lineCur.t += dt; if (lineCur.t > lineCur.d) lineCur = null; }
    if (e.rise >= 0.9 && !e.flashed) { e.flashed = true; Sound.chime(); flash = 0.45; }
    if (e.t > 19) { fadeTarget = 0; }
    if (e.t > 21.5) { state = 'album'; stateT = 0; fadeTarget = 1; fade = 0; Sound.endHum(); }
  }

  // ---------------------------------------------------------------- render
  function ambient() {
    if (L.pal.night) return { c: '#1a2238', t: 0.45, night: true };
    return { c: L.pal.haze, t: L.id === 3 ? 0.25 : 0.12 };
  }

  function drawLayer(l) {
    const sx = cam.x * l.f, sy = cam.y * l.f + world.top;
    ctx.drawImage(l.canvas, sx * Q, sy * Q, VIEW_W * Q, VIEW_H * Q, 0, 0, VIEW_W, VIEW_H);
  }

  function drawFog(f) {
    const layer = LAYER_DEFS.find(d => d.key === f.after), fk = layer ? layer.f : 0.5;
    const y = f.y - cam.y * fk - f.h;
    const off = ((time * f.speed + cam.x * fk * 1.1) % 2048 + 2048) % 2048;
    ctx.globalAlpha = f.a;
    for (let k = 0; k < 2; k++) ctx.drawImage(fogTex, 0, 0, 2048, 256, -off + k * 2048, y, 2048, f.h * 2);
    ctx.globalAlpha = 1;
  }

  function renderWorld() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const fogs = L.pal.fog || [];
    for (const l of layers) {
      drawLayer(l);
      if (l.key === 'far') life.drawDistant(ctx, cam);
      for (const f of fogs) if (f.after === l.key) drawFog(f);
    }
    const cx = cam.x, cy = cam.y, amb = ambient();

    // movers
    for (const m of world.movers) {
      const s = moverSprites.get(m);
      if (m.x + m.w < cx - 40 || m.x > cx + VIEW_W + 40) continue;
      ctx.drawImage(s.canvas, m.x - cx - s.pad, m.y - cy - s.pad, s.canvas.width / Q, s.canvas.height / Q);
    }
    life.draw(ctx, cam);
    // hazards
    for (const h of L.hazards || []) drawArc(h, cx, cy);
    // photo spots
    for (const ph of photos) {
      if (ph.taken || Math.abs(ph.x - cx - VIEW_W / 2) > VIEW_W) continue;
      const x = ph.x - cx, y = ph.y - cy - 70 + Math.sin(time * 2 + ph.x) * 3;
      const a = 0.35 + Math.sin(time * 3) * 0.15 + promptA * 0.4 * (nearPhoto() === ph ? 1 : 0);
      ctx.strokeStyle = css('#ffffff', a); ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(x + sx * 9, y + sy * 5); ctx.lineTo(x + sx * 9, y + sy * 8); ctx.lineTo(x + sx * 5, y + sy * 8); }
      ctx.stroke();
      ctx.fillStyle = css('#ffffff', a); ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill();
    }
    // the sphere at the end of it all
    if (L.sphere) drawFinalSphere(cx, cy);
    // shadows
    for (const who of [player, robot]) {
      const gy = world.surfaceAt(who.x, who.y - 4);
      if (gy === null || gy - who.y > 200) continue;
      const k = 1 - clamp((gy - who.y) / 200, 0, 1);
      ctx.fillStyle = css(L.pal.night ? '#000' : '#2a2a3a', 0.22 * k);
      ctx.beginPath(); ctx.ellipse(who.x - cx, gy - cy + 1, 13 * k + 3, 2.6 * k + 1, 0, 0, TAU); ctx.fill();
    }
    let led = null;
    const botA = ending ? 1 - smooth(0.82, 1, ending.rise) : 1;
    if (botA > 0.01) { ctx.globalAlpha = botA; led = robot.draw(ctx, cx, cy, amb); ctx.globalAlpha = 1; }
    if (ending && ending.rise > 0) {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow('#ffe7cc', robot.x - cx, robot.y - cy - 14, 40 + ending.rise * 40, 0.5 * Math.sin(Math.min(1, ending.rise) * Math.PI) + 0.1);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (state !== 'title' && !(deathT > 0 && deathT < 0.6)) drawKid(ctx, player.x - cx, player.y - cy, player.face, player, L.pal.light, amb);
    else if (state === 'title') drawKid(ctx, 330 - 0, world.surfaceAt(cx + 330) - cy, 1, { run: 0, phase: 0, air: false, vy: 0, t: time }, L.pal.light, amb);
    // particles
    for (const s of splashes) {
      const a = 1 - s.t / s.life;
      Art.dab(ctx, s.x - cx, s.y - cy, s.r, s.r * (s.breath ? 0.7 : 1), 0, s.col, (s.breath ? 0.22 : 0.8) * a);
    }
    // lights
    ctx.globalCompositeOperation = 'lighter';
    if (led) drawGlow('#ff5a3c', led[0], led[1], 16, 0.8);
    for (const [lx, ly] of world.lamps) {
      const x = lx - cx, y = ly - cy;
      if (x < -300 || x > VIEW_W + 300) continue;
      const fl = 0.85 + Math.sin(time * 13 + lx) * 0.04 + (Math.random() < 0.01 ? -0.3 : 0);
      drawGlow(L.pal.lampCol || '#ffc070', x, y, 150, 0.35 * fl);
      drawGlow('#fff2d0', x, y, 26, 0.8 * fl);
    }
    if (L.pal.sun && !L.pal.night) {
      const sx = L.pal.sun.x * layers[0].w - cx * 0.03, sy = L.pal.sun.y - cy * 0.03;
      drawGlow(L.pal.sun.color, sx, sy, 380 + Math.sin(time * 0.4) * 10, 0.18);
    }
    ctx.globalCompositeOperation = 'source-over';
    drawWeather();
    // foreground
    for (const f of fgItems) {
      const x = f.x - cx * 1.25, w = 360 * f.k, h = 260 * f.k;
      if (x + w / 2 < 0 || x - w / 2 > VIEW_W) continue;
      ctx.save(); ctx.translate(x, VIEW_H + 16 - cy * 0.25); if (f.flip) ctx.scale(-1, 1);
      if (L.pal.fg.kind !== 'fence') ctx.rotate(Math.sin((life?.time || 0) * 0.6 + f.x) * 0.007);
      ctx.drawImage(f.s, -w / 2, -h, w, h); ctx.restore();
    }
    life.drawForeground(ctx, cam);
  }

  function drawArc(h, cx, cy) {
    const gy = world.groundAt(h.x) ?? 600, x = h.x - cx, y0 = h.y0 - cy, y1 = gy - cy;
    if (x < -100 || x > VIEW_W + 100) return;
    // pylon and electrode
    Art.line(ctx, x + 18, y1 + 4, x + 18, y0 - 18, 5, '#4a505a');
    Art.line(ctx, x + 19, y1 + 4, x + 19, y0 - 18, 1.2, '#8a92a0', 0.6);
    Art.line(ctx, x + 20, y0 - 14, x - 2, y0 - 14, 4, '#4a505a');
    ctx.fillStyle = css('#d0892f'); ctx.fillRect(x + 12, y1 - 60, 12, 26);
    ctx.fillStyle = css('#1a1a1a'); ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.fillText('\u26a1', x + 18, y1 - 41); ctx.textAlign = 'left';
    for (let i = 0; i < 4; i++) Art.dab(ctx, x, y0 - 8 + i * 3, 5, 1.6, 0, '#8a6d5a', 1);
    ctx.fillStyle = css('#2d3138'); ctx.fillRect(x - 10, y1 - 8, 20, 10);
    ctx.fillStyle = css('#d0892f'); ctx.fillRect(x - 10, y1 - 8, 20, 3);
    const on = hazardOn(h), warn = hazardWarn(h);
    ctx.globalCompositeOperation = 'lighter';
    drawGlow('#ff4a3a', x + 18, y0 - 22, 14, on || warn ? 0.9 : 0.35 + Math.sin(time * 4) * 0.1);
    drawGlow('#7fd8ff', x, y0, 22, 0.25);
    drawGlow('#7fd8ff', x, y1 - 6, 22, 0.2);
    if (on) {
      for (let k = 0; k < 2; k++) {
        ctx.strokeStyle = css(k ? '#ffffff' : '#7fd8ff', k ? 0.9 : 0.6); ctx.lineWidth = k ? 1.4 : 4;
        ctx.beginPath(); ctx.moveTo(x, y0);
        for (let yy = y0; yy < y1; yy += 12) ctx.lineTo(x + (Math.random() - 0.5) * 16, yy);
        ctx.lineTo(x, y1 - 6); ctx.stroke();
      }
      drawGlow('#7fd8ff', x, (y0 + y1) / 2, 120, 0.5);
      drawGlow('#bff0ff', x, y0, 30, 0.9);
    } else if (warn) {
      for (let i = 0; i < 3; i++) Art.line(ctx, x, y0, x + (Math.random() - 0.5) * 20, y0 + Math.random() * 18, 1, '#bff0ff', 0.8);
      drawGlow('#7fd8ff', x, y0, 30, 0.4);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  let sphereSprite = null;
  function drawFinalSphere(cx, cy) {
    const S = L.sphere;
    if (!sphereSprite) {
      const R = S.R, c = makeCanvas(R * 2.2 * Q, R * 2.2 * Q), g = c.getContext('2d');
      g.scale(Q, Q);
      Art.sphere(g, R * 1.1, R * 1.1, R, { col: '#8c8aa0', hi: '#fff2e4', dark: '#3a3d58', seam: '#2c2e44', rim: '#f6c9a8', light: 1, ground: '#f0d6cc', rimLight: '#ffe2c8', seamA: 0.35 });
      sphereSprite = c;
    }
    const x = S.x - cx, y = S.y - cy + Math.sin(time * 0.6) * 6;
    if (x < -S.R * 2 || x > VIEW_W + S.R * 2) return;
    ctx.globalCompositeOperation = 'lighter';
    drawGlow('#ffd9b8', x, y, S.R * 2.2, 0.25 + (ending ? ending.beam * 0.25 : 0));
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(sphereSprite, x - S.R * 1.1, y - S.R * 1.1, S.R * 2.2, S.R * 2.2);
    // a ring of small lights round the equator
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * TAU + time * 0.15, px = x + Math.cos(a) * S.R * 0.98, py = y + Math.sin(a) * S.R * 0.07 + S.R * 0.02;
      if (Math.sin(a) < 0) continue;
      ctx.globalCompositeOperation = 'lighter';
      drawGlow('#ffcf8a', px, py, 10, 0.6 + Math.sin(time * 3 + i) * 0.3);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (ending && ending.beam > 0.01) {
      const b = ending.beam, bx = robot.pts[robot.pts.length - 1].x - cx, gy = robot.pts[robot.pts.length - 1].y - cy;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, y + S.R * 0.9, 0, gy);
      g.addColorStop(0, css('#ffe7cc', 0.35 * b)); g.addColorStop(1, css('#ffe7cc', 0.05 * b));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(bx - 30, y + S.R * 0.9); ctx.lineTo(bx + 30, y + S.R * 0.9); ctx.lineTo(bx + 60, gy + 4); ctx.lineTo(bx - 60, gy + 4); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function drawWeather() {
    const w = L.pal.weather;
    if (w.kind === 'snow') {
      for (const f of flakes) {
        const s = 0.8 + f.z * 1.5;
        ctx.fillStyle = css(L.pal.night ? '#d8dde8' : '#ffffff', f.z > 1.25 ? 0.35 : 0.5 + f.z * 0.3);
        ctx.beginPath(); ctx.arc(f.x, f.y, f.z > 1.25 ? s * 1.6 : s, 0, TAU); ctx.fill();
      }
    } else if (w.kind === 'motes') {
      ctx.globalCompositeOperation = 'lighter';
      for (const f of flakes) Art.dab(ctx, f.x, f.y, f.z * 1.3, f.z * 1.3, 0, '#ffe2a0', 0.25 + 0.25 * Math.sin(f.p * 2 + f.z * 9));
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.strokeStyle = css('#dfe3e6', 0.18); ctx.lineWidth = 1; ctx.beginPath();
      for (const f of flakes) { ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - 3 * f.z, f.y + 14 * f.z); }
      ctx.stroke();
    }
  }

  function post() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(vignette, 0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(grain, 'repeat');
    const ox = (Math.random() * 256) | 0, oy = (Math.random() * 256) | 0;
    ctx.translate(-ox, -oy); ctx.fillRect(0, 0, VIEW_W + 256, VIEW_H + 256);
    ctx.restore();
  }

  function text(t, x, y, size, a, o = {}) {
    ctx.font = `${o.italic ? 'italic ' : ''}${o.weight || 400} ${size}px ${o.font || FONT}`;
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'alphabetic';
    if (o.letter && 'letterSpacing' in ctx) ctx.letterSpacing = o.letter + 'px';
    if (o.shadow !== false) { ctx.fillStyle = css('#000000', a * (o.shadowA ?? 0.35)); ctx.fillText(t, x + 1, y + 1.5); }
    ctx.fillStyle = css(o.col || '#f6f1e6', a); ctx.fillText(t, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  function wrap(t, maxW, size, o = {}) {
    ctx.font = `${o.italic ? 'italic ' : ''}${o.weight || 400} ${size}px ${FONT}`;
    const words = t.split(' '), out = []; let cur = '';
    for (const w of words) { const test = cur ? cur + ' ' + w : w; if (ctx.measureText(test).width > maxW && cur) { out.push(cur); cur = w; } else cur = test; }
    if (cur) out.push(cur);
    return out;
  }

  function renderUI() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // narration
    if (lineCur) {
      const a = Math.min(1, lineCur.t / 0.9, (lineCur.d - lineCur.t) / 0.9);
      const ls = wrap(lineCur.text, 760, 28, { italic: true });
      const y0 = VIEW_H - 64 - (ls.length - 1) * 34;
      const g = ctx.createLinearGradient(0, VIEW_H - 170, 0, VIEW_H);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(8,8,10,${0.35 * a})`);
      ctx.fillStyle = g; ctx.fillRect(0, VIEW_H - 170, VIEW_W, 170);
      ls.forEach((l, i) => text(l, VIEW_W / 2, y0 + i * 34, 28, a, { italic: true, shadowA: 0.6 }));
    }
    if (state === 'play' && promptA > 0.02) {
      const ph = nearPhoto() || null;
      text(document.body.classList.contains('touch') ? '◉  ·  take a photograph' : 'E  ·  take a photograph', VIEW_W / 2, 58, 20, promptA * 0.9, { italic: true });
    }
    if (state === 'play' && !nearPhoto() && placePromptA > 0.02 && deathT <= 0) {
      const place = life.near(player);
      if (place) {
        const key = document.body.classList.contains('touch') ? '◉' : navigator.getGamepads?.().some(p => p) ? 'X / □' : 'E';
        const label = place.kind === 'signal' && place.on ? 'turn the lights off' : place.label;
        const waiting = place.kind === 'water' ? 'rings on the water' : place.kind === 'stones' ? 'almost weightless' : 'listen…';
        text(place.cooldown > 0 ? waiting : `${key}  ·  ${label}`, VIEW_W / 2, 58, 20, placePromptA * 0.75 * (1 - promptA), { italic: true });
      }
    }
    if (state === 'play' && stateT < 6) {
      const a = Math.min(1, stateT / 1, (6 - stateT) / 1.5);
      text(`${roman(L.id)} · ${L.title}`, 40, 50, 22, a * 0.85, { align: 'left', letter: 2 });
    }
    // polaroid slides in, lingers, and goes to the album
    if (polaroid) {
      const t = polaroid.t, inT = smooth(0, 0.5, t), outT = smooth(2.6, 3.4, t);
      const w = 230, h = 150, x = VIEW_W - w - 40 + outT * 300, y = VIEW_H - h - 70 + (1 - inT) * 240;
      ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(0.05 - outT * 0.2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-w / 2 - 8, -h / 2 - 6, w + 20, h + 40);
      ctx.fillStyle = '#f2eee4'; ctx.fillRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 42);
      ctx.drawImage(polaroid.canvas, -w / 2, -h / 2, w, h * 1.0);
      ctx.restore();
      const cnt = album.length, total = LEVELS.reduce((s, l) => s + l.photos.length, 0);
      text(`${cnt} / ${total}`, x + w / 2, y + h + 24, 15, inT * (1 - outT) * 0.8, { col: '#3a3530', shadow: false, italic: true });
    }
    if (flash > 0) { ctx.fillStyle = `rgba(255,252,245,${flash * 0.85})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (fade < 0.999) { ctx.fillStyle = `rgba(6,6,8,${1 - fade})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }

    if (state === 'title') renderTitle();
    if (state === 'card') renderCard();
    if (state === 'album') renderAlbum();
    if (paused && state === 'play') renderPause();
  }

  function roman(n) { return ['', 'I', 'II', 'III', 'IV', 'V'][n]; }

  function renderTitle() {
    const a = Math.min(1, stateT / 2);
    const g = ctx.createLinearGradient(0, 0, 0, 360);
    g.addColorStop(0, `rgba(20,24,30,${0.35 * a})`); g.addColorStop(1, 'rgba(20,24,30,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, 360);
    text('STÅLHAGEN', VIEW_W / 2, 190, 92, a, { weight: 500, letter: 18, shadowA: 0.3 });
    text('the steel pasture', VIEW_W / 2, 238, 30, a * 0.9, { italic: true });
    const b = Math.min(1, Math.max(0, stateT - 1.5)) * (0.55 + Math.sin(time * 2) * 0.3);
    text(document.body.classList.contains('touch') ? 'tap to begin' : 'press any key', VIEW_W / 2, VIEW_H - 70, 22, b, { italic: true, letter: 2 });
    text('← →  walk     ↑ / space  jump     E  photograph / interact     M  sound', VIEW_W / 2, VIEW_H - 36, 16, Math.min(1, Math.max(0, stateT - 1.5)) * 0.7, { letter: 1 });
  }

  function renderCard() {
    const t = stateT, a = Math.min(1, t / 1.2) * (1 - smooth(3.8, 5.2, t));
    const bg = 1 - smooth(3.2, 5.2, t);
    ctx.fillStyle = `rgba(8,8,10,${0.82 * bg})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(roman(L.id), VIEW_W / 2, 280, 30, a * 0.8, { letter: 6 });
    text(L.title, VIEW_W / 2, 360, 74, a, { weight: 500, letter: 4 });
    text(L.sub, VIEW_W / 2, 404, 26, a * 0.85, { italic: true });
    text(L.date, VIEW_W / 2, 470, 20, a * 0.6, { italic: true, letter: 2 });
  }

  function renderPause() {
    ctx.fillStyle = 'rgba(8,8,10,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text('paused', VIEW_W / 2, 300, 48, 1, { italic: true });
    text('← → walk  ·  ↑ / space jump  ·  E photograph / interact  ·  M sound ' + (Sound.muted ? '(off)' : '(on)'), VIEW_W / 2, 360, 20, 0.85);
    text('Some things answer. Some things only happen if you wait.', VIEW_W / 2, 385, 18, 0.6, { italic: true });
    text(document.body.classList.contains('touch') ? 'tap \u275a\u275a to continue' : 'esc to continue', VIEW_W / 2, 410, 18, 0.6, { italic: true });
  }

  function renderAlbum() {
    ctx.fillStyle = '#1b1a1e'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const a = Math.min(1, stateT / 1.5);
    text('I still have the photographs. That’s how I know it happened.', VIEW_W / 2, 70, 28, a, { italic: true });
    const n = album.length, cols = Math.min(5, Math.max(1, n)), w = 196, h = 110, gap = 30;
    const rows = Math.ceil(n / cols), x0 = VIEW_W / 2 - (cols * (w + gap) - gap) / 2, y0 = 130;
    album.forEach((p, i) => {
      const r = (i / cols) | 0, c = i % cols;
      const pa = clamp((stateT - 1 - i * 0.25) / 0.6, 0, 1);
      if (pa <= 0) return;
      const x = x0 + c * (w + gap), y = y0 + r * (h + 70);
      ctx.save(); ctx.globalAlpha = pa; ctx.translate(x + w / 2, y + h / 2); ctx.rotate(((i * 7919) % 11 - 5) * 0.006);
      ctx.fillStyle = '#f0ece2'; ctx.fillRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 44);
      ctx.drawImage(p.canvas, -w / 2, -h / 2, w, h);
      ctx.restore();
      ctx.globalAlpha = pa;
      const cl = wrap(p.caption, w, 13, { italic: true });
      cl.slice(0, 2).forEach((l, k) => text(l, x + w / 2, y + h + 18 + k * 14, 13, pa, { italic: true, col: '#3a3530', shadow: false }));
      ctx.globalAlpha = 1;
    });
    if (!n) text('You didn’t take any. Maybe that is its own kind of remembering.', VIEW_W / 2, 330, 22, a * 0.8, { italic: true });
    const total = LEVELS.reduce((s, l) => s + l.photos.length, 0);
    const b = clamp(stateT - 2 - n * 0.25, 0, 1);
    text(`${n} of ${total} photographs`, VIEW_W / 2, VIEW_H - 92, 18, b * 0.7, { italic: true });
    text('STÅLHAGEN  ·  after the paintings of Simon Stålenhag  ·  every image drawn in code', VIEW_W / 2, VIEW_H - 60, 15, b * 0.5, { letter: 1 });
    if (stateT > 3) text(document.body.classList.contains('touch') ? 'tap to play again' : 'press any key', VIEW_W / 2, VIEW_H - 26, 16, (0.4 + Math.sin(time * 2) * 0.2), { italic: true });
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!world || state === 'loading' || state === 'boot') {
      ctx.fillStyle = '#0c0c0e'; ctx.fillRect(0, 0, cv.width, cv.height);
      return;
    }
    if (state !== 'album') {
      renderWorld();
      post();
      if (wantShot) captureShot();
    }
    renderUI();
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    // fixed substeps keep jumps identical at any frame rate
    const n = Math.ceil(dt / (1 / 120));
    for (let i = 0; i < n; i++) { update(dt / n); }
    render();
    requestAnimationFrame(frame);
  }

  function start() {
    makePost();
    loadChapter(0, () => { state = 'title'; stateT = 0; fade = 0; fadeTarget = 1; cam = { x: 60, y: 0 }; robot.x = 470; robot.y = world.surfaceAt(470); robot.face = -1; });
    requestAnimationFrame(t => { last = t; frame(t); });
  }

  // debug / testing hooks
  window.__game = {
    get state() { return state; }, get player() { return player; }, get world() { return world; }, get robot() { return robot; }, get cam() { return cam; },
    jump(i, x) { state = 'loading'; loadChapter(i, () => { state = 'play'; stateT = 10; fade = 1; fadeTarget = 1; if (x) { player.x = x; player.y = world.surfaceAt(x); follow(0, true); } }); },
    set(x, y) { player.x = x; player.y = y ?? world.surfaceAt(x); player.vy = 0; follow(0, true); },
    keys, pressed, get album() { return album; }, get L() { return L; }, get time() { return time; },
    get life() { return life; },
    step(n, dt = 1 / 120) { for (let i = 0; i < n; i++) update(dt); }, hazardOn: h => hazardOn(h), ending: () => startEnding(), setState(s) { state = s; stateT = 0; },
  };
  return { start };
})();

Game.start();
