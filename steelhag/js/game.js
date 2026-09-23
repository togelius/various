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
  // Painted layers are large: a chapter can hold 100 MB of canvas at full quality.
  // Phones and low-memory devices paint at lower resolution; the look survives it.
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isPhone = isTouch && typeof screen !== 'undefined' && Math.min(screen.width, screen.height) < 600;
  const memory = navigator.deviceMemory || 8;
  let qMax = 1.5;
  if (isPhone || memory <= 4) qMax = 1;
  if (memory <= 2) qMax = 0.8;
  Q = clamp((window.devicePixelRatio || 1) * Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H), Math.min(1, qMax), qMax);

  // input: arrows always work; the letter keys can be rebound in settings
  const keys = {}, pressed = {}, nav = {};
  // arrows and a few old aliases always work; letters you bind yourself take precedence
  const FIXED = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'jump', ArrowDown: 'photo', KeyW: 'jump', KeyZ: 'jump', KeyX: 'photo', KeyC: 'photo',
    Enter: 'start', Escape: 'pause', KeyP: 'pause', KeyM: 'mute' };
  const NAV = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Enter: 'ok', Space: 'ok', KeyZ: 'ok', KeyE: 'ok', Escape: 'back', Backspace: 'back' };
  const actionFor = code => { const k = Store.settings.keys; for (const a in k) if (k[a] === code) return a; return FIXED[code]; };
  let rebinding = null, tap = null;
  addEventListener('keydown', e => {
    Sound.init();
    if (rebinding) {
      e.preventDefault();
      if (e.code !== 'Escape') Store.bind(rebinding, e.code);
      rebinding = null;
      return;
    }
    const n = NAV[e.code]; if (n && !e.repeat) nav[n] = true;
    const a = actionFor(e.code);
    if (a) { if (!keys[a]) pressed[a] = true; keys[a] = true; e.preventDefault(); }
    pressed.any = true;
  });
  addEventListener('keyup', e => { const a = actionFor(e.code); if (a) keys[a] = false; });
  cv.addEventListener('pointerdown', e => {
    const r = cv.getBoundingClientRect();
    tap = { x: (e.clientX - r.left) / r.width * VIEW_W, y: (e.clientY - r.top) / r.height * VIEW_H };
  });
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
    const menu = { up: p.axes[1] < -0.5 || p.buttons[12]?.pressed, down: p.axes[1] > 0.5 || p.buttons[13]?.pressed, ok: p.buttons[0]?.pressed, back: p.buttons[1]?.pressed };
    for (const k in st) {
      if (st[k] && !padPrev[k]) { pressed[k] = true; pressed.any = true; Sound.init(); }
      if (st[k] !== padPrev[k]) keys[k] = !!st[k];
    }
    for (const k in menu) if (menu[k] && !padPrev['m' + k]) nav[k] = true;
    padPrev = { ...st, mup: menu.up, mdown: menu.down, mok: menu.ok, mback: menu.back };
  }

  // ---------------------------------------------------------------- state
  let state = 'boot', stateT = 0, time = 0, paused = false;
  let ci = 0, world = null, layers = null, L = null;
  let player, robot, cam, flakes = [], splashes = [], fogTex = null, fgSprites = [], fgItems = [], moverSprites = new Map();
  let lines = [], lineQ = [], lineCur = null, photos = [], album = [], checkpoint = null;
  let fade = 1, fadeTarget = 1, flash = 0, polaroid = null, ending = null, deathT = 0, promptA = 0;
  let life = null, placePromptA = 0, caughtT = 0, caughtOnce = false, trainHorn = false;
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
    Painter.drop(i);
    const finish = painted => {
      Painter.release(layers);
      for (const s of moverSprites.values()) s.canvas.width = 0;
      moverSprites.clear();
      world = new World(L);
      layers = painted;
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
      // start painting the next chapter while this one is played
      setTimeout(() => Painter.prefetch(i + 1, Q), 1500);
    };
    // a moment for "painting…" to show before any main-thread work begins
    setTimeout(() => { const job = Painter.take(i, Q); if (job.sync) finish(job.sync); else job.then(finish); }, 40);
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
    player = { x: sx, y: sy, vx: 0, vy: 0, face: 1, onGround: true, ref: null, coyote: 0, buffer: 0, phase: 0, run: 0, air: false, stepT: 0, t: 0, breathT: 1, surface: 'snow',
      snow: 0, wet: L.id === 4 ? 0.6 : 0, torch: !!L.pal.night, reach: 0 };
    checkpoint = { x: sx, y: sy, i: 0 };
    cam = { x: 0, y: 0 };
    lines = L.lines.map(([x, text]) => ({ x, text, shown: false }));
    lineQ = []; lineCur = null;
    photos = L.photos.map(([x, caption]) => { const key = `${L.id}:${x}`; return { x, y: world.surfaceAt(x), caption, key, have: Store.hasPhoto(key), taken: false }; });
    ending = null; splashes = [];
    initFlakes();
  }

  function initFlakes() {
    flakes = [];
    const w = L.pal.weather;
    const n = Math.round(w.n * (reduce() ? 0.35 : 1));
    for (let i = 0; i < n; i++) flakes.push({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, z: 0.3 + Math.random() * 1.2, p: Math.random() * TAU });
  }

  // ---------------------------------------------------------------- physics
  function solidsList() { return world.solids.concat(world.movers); }

  function gravityAt(x) { return (L.pal.lowGrav && x > L.pal.lowGrav) ? 0.52 : 1; }

  function surfaceKind(s) {
    if (!s) return ['snow', 'grass', 'marsh', 'default', 'snow', 'grass'][L.id - 1];
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

  // weather that stays on you: snow settles, the marsh soaks in, and slowly dries
  function weather(dt) {
    const p = player, w = L.pal.weather;
    if (w.kind === 'snow' && !(w.rise && p.x > w.rise)) p.snow = Math.min(1, p.snow + dt / (Math.abs(p.vx) < 5 ? 30 : 90));
    else p.snow = Math.max(0, p.snow - dt / 20);
    if (L.id === 3 && p.onGround && (p.surface === 'marsh' || p.surface === 'wood')) p.wet = Math.min(1, p.wet + dt / 25);
    else p.wet = Math.max(0, p.wet - dt / 400);
  }

  function checkpointsReach() {
    const pts = robot.pts;
    for (let i = checkpoint.i + 1; i < pts.length; i++) {
      if (player.x >= pts[i].x - 30 && Math.abs(player.y - pts[i].y) < 60) { checkpoint = { x: pts[i].x, y: pts[i].y, i }; }
    }
  }

  // ---- the searchlight in the facility yard: its spot sweeps, crates cast shadows
  let searchSeen = 0;
  function searchSpot() {
    const sr = L.search, u = 0.5 - 0.5 * Math.cos(time / sr.period * TAU);
    const gx = lerp(sr.x0, sr.x1, u), gy = world.groundAt(gx) ?? 600;
    const dir = Math.sin(time / sr.period * TAU) >= 0 ? 1 : -1;
    return { gx, gy, dir };
  }
  function segHitsBox(x0, y0, x1, y1, b) {
    let t0 = 0, t1 = 1;
    const dx = x1 - x0, dy = y1 - y0;
    for (const [p, q] of [[-dx, x0 - b.x], [dx, b.x + b.w - x0], [-dy, y0 - b.y], [dy, b.y + b.h - y0]]) {
      if (p === 0) { if (q < 0) return false; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return true;
  }
  function inShadow() {
    const sr = L.search, px = player.x, py = player.y - 24;
    return world.solids.some(b => b !== player.ref && !b.oneway && segHitsBox(sr.sx, sr.sy, px, py, b));
  }
  function updateSearch(dt) {
    if (!L.search) return;
    const sp = searchSpot();
    const lit = Math.abs(player.x - sp.gx) < L.search.r && Math.abs(player.y - sp.gy) < 80 && !inShadow();
    searchSeen = lit ? searchSeen + dt : 0;
    if (searchSeen > 0.25 && deathT <= 0) { searchSeen = 0; die('light'); }
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

  let deaths = 0;
  function die(kind) {
    if (deathT > 0) return;
    deaths++;
    deathT = 1.1;
    if (kind === 'water') { Sound.splash(); splash(player.x, world.inGap(player.x).water); }
    else if (kind === 'zap') { Sound.zap(); flash = 0.6; }
    else if (kind === 'light') { Sound.siren(); caughtT = 1.2; if (!caughtOnce) { caughtOnce = true; lineQ.push('They didn’t see me. I told myself they didn’t see me.'); } }
    else Sound.fall();
    fadeTarget = 0;
  }
  function respawn() {
    const c = checkpoint;
    player.x = c.x - 20; player.y = world.surfaceAt(player.x) ?? c.y; player.vx = 0; player.vy = 0; player.ref = null; player.onGround = true;
    if (world.surfaceAt(player.x) === null) { player.x = c.x; player.y = c.y; }
    if (robot.i < c.i || robot.visit) { robot.i = Math.max(robot.i, c.i); robot.x = robot.pts[robot.i].x; robot.y = robot.pts[robot.i].y; robot.path = null; robot.visit = null; }
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
    Store.keepPhoto(wantShot.key, L.id, wantShot.x, wantShot.caption, c);
    wantShot.have = true;
    polaroid = { canvas: c, t: 0 };
    wantShot = null;
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    time += dt; stateT += dt;
    pollPad();
    if (pressed.mute) Store.setting('muted', Sound.toggleMute());
    Sound.update(dt);
    fade = lerp(fade, fadeTarget, 1 - Math.pow(0.02, dt));
    flash = Math.max(0, flash - dt * 2.2);
    if (polaroid) { polaroid.t += dt; if (polaroid.t > 3.4) polaroid = null; }

    if (state === 'title') {
      cam.x = 60 + Math.sin(time * 0.05) * 40 + time * 6; cam.y = 0;
      robot.t += dt; robot.blink = Math.sin(time * 3) > 0.2 ? 1 : 0;
      updateFlakes(dt, 6 * dt, 0);
      if (stateT > 0.8) { if (!menuStack) openMenu('main'); handleMenu(); }
    } else if (state === 'card') {
      follow(dt, true);
      updateFlakes(dt, 0, 0);
      fadeTarget = 1;
      Store.reach(ci);
      if (stateT > 5.2 || (stateT > 1.2 && (pressed.jump || pressed.start || pressed.any))) { state = 'play'; stateT = 0; }
    } else if (state === 'play') {
      if (!paused && (pressed.pause || (tap && tap.x > VIEW_W - 90 && tap.y < 80 && !isTouch))) { paused = true; openMenu('pause'); clearPressed(); return; }
      if (paused) {
        if (pressed.pause && !nav.back) menuBack(); else handleMenu();
        clearPressed(); return;
      }
      const control = deathT <= 0;
      world.updateMovers(time);
      updatePlayer(dt, control);
      robot.update(dt, player, life.interest());
      weather(dt);
      updateSearch(dt);
      caughtT = Math.max(0, caughtT - dt);
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
      if (stateT > 1.6) {
        if (L.last) { Store.finish(); state = 'album'; stateT = 0; fade = 0; fadeTarget = 1; }
        else { state = 'loading'; loadChapter(ci + 1, () => { state = 'card'; stateT = 0; fade = 0; fadeTarget = 1; }); }
      }
    } else if (state === 'ending') {
      updateEnding(dt);
    } else if (state === 'album') {
      if (stateT > 3 && (pressed.any || tap)) toTitle();
    } else if (state === 'albumview') {
      if (stateT > 0.6 && (pressed.any || tap)) { state = 'title'; stateT = 1; openMenu('main'); }
    }
    for (const s of splashes) {
      s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.breath) { s.r += dt * 6; s.vx *= 0.97; } else s.vy += (s.g ? 900 : 300) * dt;
    }
    splashes = splashes.filter(s => s.t < s.life);
    clearPressed();
  }
  function clearPressed() { for (const k in pressed) pressed[k] = false; for (const k in nav) nav[k] = false; tap = null; }

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
    ending = { t: 0, rise: 0, text: [], beam: 0, touch: 0, step: 'walk' };
    const n = robot.pts.length;
    robot.visit = null;
    if (Math.abs(robot.x - player.x) > 500 || robot.i < n - 1) { robot.path = null; robot.i = n - 1; robot.x = robot.pts[n - 1].x; robot.y = robot.pts[n - 1].y; }
    Sound.rise(8);
  }
  // The kid stops. The machine comes over, and for once lets itself be touched,
  // then walks back under the sphere and goes up.
  function updateEnding(dt) {
    const e = ending, S = L.sphere, home = robot.pts[robot.pts.length - 1];
    e.t += dt;
    world.updateMovers(time);
    const stop = L.exit + 60;
    player.vx = player.x < stop ? PH.run * 0.35 : player.vx * 0.8;
    updatePlayer(dt, false);
    player.face = 1;
    robot.t += dt;
    if (robot.path) robot.follow(dt);
    const lookAt = (x, y) => { robot.look = lerp(robot.look, clamp(Math.atan2(y - (robot.y - 25), Math.max(24, Math.abs(x - robot.x))), -0.75, 0.45), 1 - Math.pow(0.02, dt)); };
    if (e.step === 'walk' && e.t > 2.6) { e.step = 'come'; robot.goTo({ x: stop + 30, y: world.surfaceAt(stop + 30) }, false, 0.8); Sound.beep(0.6); }
    if (e.step === 'come' && !robot.path) { e.step = 'touch'; e.tt = 0; }
    if (e.step === 'touch') {
      e.tt += dt; robot.face = -1; robot.hopping = false;
      e.touch = smooth(0.4, 1.6, e.tt) * (1 - smooth(3.4, 4.2, e.tt));
      lookAt(player.x, player.y - 30);
      if (e.tt > 1.5 && !e.touched) { e.touched = true; Sound.touch(); }
      if (e.tt > 4.4) { e.step = 'back'; robot.goTo(home, false, 0.7); }
    }
    player.reach = e.touch;
    if (e.step === 'back' && !robot.path) { e.step = 'rise'; e.rt = 0; }
    if (e.step === 'rise') {
      e.rt += dt; robot.face = -1; robot.x = home.x;
      lookAt(home.x - 200, S.y);
      if (e.rt > 1.2) { e.rise = Math.min(1, e.rise + dt / 9); robot.hopping = true; }
      robot.y = lerp(home.y, S.y + S.R * 0.2, e.rise * e.rise * (3 - 2 * e.rise));
    }
    robot.blink = Math.sin(robot.t * (e.step === 'touch' ? 2 : 6)) > 0 ? 1 : 0;
    e.beam = lerp(e.beam, e.step === 'rise' || e.step === 'back' ? 1 : 0, 1 - Math.pow(0.3, dt));
    const ox = cam.x, oy = cam.y;
    cam.x = lerp(cam.x, world.W - VIEW_W, 1 - Math.pow(0.3, dt));
    cam.y = lerp(cam.y, e.step === 'rise' ? -200 : 0, 1 - Math.pow(0.5, dt));
    updateFlakes(dt, cam.x - ox, cam.y - oy);
    const say = text => { if (!e.text.includes(text)) { e.text.push(text); lineCur = { text, t: 0, d: 4.8 }; } };
    if (e.t > 1.2) say('Dawn came up the colour of the inside of a shell.');
    if (e.touched && e.tt > 1.8) say('It let me touch it. Just once.');
    if (e.step === 'rise' && e.rt > 2.5) say('It went up without looking back.');
    if (e.rise > 0.75) say('I think that was the point.');
    if (lineCur) { lineCur.t += dt; if (lineCur.t > lineCur.d) lineCur = null; }
    if (e.rise >= 0.9 && !e.flashed) { e.flashed = true; e.end = e.t; Sound.chime(); flash = 0.45; }
    if (e.end && e.t > e.end + 4) fadeTarget = 0;
    if (e.end && e.t > e.end + 6.5) { Sound.endHum(); afterEnding(); }
  }
  function afterEnding() {
    state = 'loading';
    loadChapter(ci + 1, () => { state = 'card'; stateT = 0; fade = 0; fadeTarget = 1; });
  }

  // ---------------------------------------------------------------- menus
  const S = () => Store.settings;
  const T = () => S().large ? 1.28 : 1;             // text scale
  const reduce = () => S().reduce;
  const KEYNAME = { Space: 'space', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Enter: 'enter', ShiftLeft: 'shift', ShiftRight: 'shift', ControlLeft: 'ctrl', ControlRight: 'ctrl' };
  const keyName = code => KEYNAME[code] || code.replace(/^Key|^Digit|^Numpad/, '');
  const ACTIONS = [['left', 'Walk left'], ['right', 'Walk right'], ['jump', 'Jump'], ['photo', 'Photograph / interact']];
  let menuStack = null, menuRects = [];

  function openMenu(id) { menuStack = [{ id, sel: 0 }]; }
  function pushMenu(id) { menuStack.push({ id, sel: 0 }); Sound.tick(); }
  function menuBack() {
    if (menuStack.length > 1) { menuStack.pop(); Sound.tick(); }
    else if (paused) resume();
  }
  function resume() { paused = false; menuStack = null; }

  function startChapter(i) {
    Sound.init(); menuStack = null; paused = false;
    if (i === ci && world && state === 'title') { resetChapterState(); state = 'card'; stateT = 0; return; }
    state = 'loading';
    loadChapter(i, () => { state = 'card'; stateT = 0; fade = 0; fadeTarget = 1; });
  }
  function toTitle() {
    menuStack = null; paused = false; state = 'loading';
    loadChapter(0, () => { state = 'title'; stateT = 0; fade = 0; fadeTarget = 1; cam = { x: 60, y: 0 }; posTitleBot(); });
  }
  function posTitleBot() { robot.x = 470; robot.y = world.surfaceAt(470); robot.face = -1; }

  function menuItems(id) {
    const back = { label: 'back', act: menuBack };
    const onOff = v => v ? 'on' : 'off';
    const avail = Store.finished ? LEVELS.length - 1 : Store.reached;
    switch (id) {
      case 'main': {
        const items = [];
        if (Store.reached > 0 && !Store.finished) items.push({ label: `continue · ${roman(LEVELS[Store.reached].id)} ${LEVELS[Store.reached].title}`, act: () => startChapter(Store.reached) });
        items.push({ label: Store.reached > 0 || Store.finished ? 'begin again' : 'begin', act: () => startChapter(0) });
        if (avail > 0) items.push({ label: 'chapters', act: () => pushMenu('chapters') });
        if (Store.photos.length) items.push({ label: `the album · ${Store.photos.length}`, act: () => { menuStack = null; state = 'albumview'; stateT = 0; } });
        items.push({ label: 'settings', act: () => pushMenu('settings') });
        return items;
      }
      case 'chapters':
        return LEVELS.slice(0, avail + 1).map((l, i) => ({ label: `${roman(l.id)} · ${l.title} — ${l.sub.toLowerCase()}`, act: () => startChapter(i) })).concat(back);
      case 'settings': {
        const items = [
          { label: `larger text · ${onOff(S().large)}`, act: () => Store.setting('large', !S().large) },
          { label: `reduced motion · ${onOff(S().reduce)}`, act: () => { Store.setting('reduce', !S().reduce); if (L) initFlakes(); } },
          { label: `sound · ${onOff(!Sound.muted)}`, act: () => Store.setting('muted', Sound.toggleMute()) },
        ];
        if (!isTouch) items.push({ label: 'controls', act: () => pushMenu('controls') });
        return items.concat(back);
      }
      case 'controls':
        return ACTIONS.map(([a, name]) => ({ label: `${name} · ${rebinding === a ? 'press a key…' : keyName(S().keys[a])}`, act: () => { rebinding = a; } }))
          .concat({ label: 'restore defaults', act: () => Store.resetKeys() }, back);
      case 'pause':
        return [
          { label: 'continue', act: resume },
          { label: 'settings', act: () => pushMenu('settings') },
          { label: 'leave to the title', act: toTitle },
        ];
    }
    return [back];
  }
  const MENU_HEAD = { chapters: 'chapters', settings: 'settings', controls: 'controls — choose one, then press a key', pause: 'paused' };

  function handleMenu() {
    const top = menuStack[menuStack.length - 1], items = menuItems(top.id);
    top.sel = clamp(top.sel, 0, items.length - 1);
    if (rebinding) return;
    if (nav.up) { top.sel = (top.sel - 1 + items.length) % items.length; Sound.tick(); }
    if (nav.down) { top.sel = (top.sel + 1) % items.length; Sound.tick(); }
    let chosen = nav.ok ? top.sel : -1;
    if (tap) {
      const r = menuRects.find(r => tap.x >= r.x && tap.x <= r.x + r.w && tap.y >= r.y && tap.y <= r.y + r.h);
      if (r) { top.sel = r.i; chosen = r.i; }
    }
    if (nav.back) menuBack();
    else if (chosen >= 0) { Sound.tick(1); items[chosen].act(); }
  }

  function renderMenu(y0, a) {
    const top = menuStack[menuStack.length - 1], items = menuItems(top.id), t = T();
    menuRects = [];
    const head = MENU_HEAD[top.id];
    if (head) text(head, VIEW_W / 2, y0 - 44 * t, 18 * t, a * 0.65, { italic: true, letter: 2 });
    const lh = Math.min(44 * t, 330 / Math.max(1, items.length));
    items.forEach((it, i) => {
      const y = y0 + i * lh, on = i === top.sel, size = Math.min(25 * t, lh * 0.72);
      text(it.label, VIEW_W / 2, y, size, a * (on ? 1 : 0.62), { italic: !on, weight: on ? 500 : 400, letter: on ? 1 : 0 });
      if (on) {
        ctx.font = `500 ${size}px ${FONT}`;
        const w = ctx.measureText(it.label).width / 2 + 22;
        ctx.fillStyle = css('#f6f1e6', a * 0.7);
        ctx.fillRect(VIEW_W / 2 - w - 14, y - size * 0.32, 10, 1.5); ctx.fillRect(VIEW_W / 2 + w + 4, y - size * 0.32, 10, 1.5);
      }
      menuRects.push({ x: VIEW_W / 2 - 330, y: y - size - 6, w: 660, h: lh, i });
    });
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
      if (l.key === 'far') { life.drawDistant(ctx, cam); if (L.train) drawTrain(l); }
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
      const a = (ph.have ? 0.45 : 1) * (0.35 + Math.sin(time * 3) * 0.15) + promptA * 0.4 * (nearPhoto() === ph ? 1 : 0);
      ctx.strokeStyle = css('#ffffff', a); ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(x + sx * 9, y + sy * 5); ctx.lineTo(x + sx * 9, y + sy * 8); ctx.lineTo(x + sx * 5, y + sy * 8); }
      ctx.stroke();
      ctx.fillStyle = css('#ffffff', a); ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill();
    }
    if (L.search) drawSearch(cx, cy);
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
    if (ending && ending.touch > 0.05 && robot.tip) {
      ctx.globalCompositeOperation = 'lighter';
      const tx = lerp(robot.tip[0], player.x - cx + 9, 0.5), ty = lerp(robot.tip[1], player.y - cy - 30, 0.5);
      drawGlow('#ffe2c0', tx, ty, 24 + ending.touch * 20, 0.6 * ending.touch);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (ending && ending.rise > 0) {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow('#ffe7cc', robot.x - cx, robot.y - cy - 14, 40 + ending.rise * 40, 0.5 * Math.sin(Math.min(1, ending.rise) * Math.PI) + 0.1);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (state !== 'title' && !(deathT > 0 && deathT < 0.6)) drawKid(ctx, player.x - cx, player.y - cy, player.face, player, L.pal.light, amb);
    else if (state === 'title') drawKid(ctx, 330 - 0, world.surfaceAt(cx + 330) - cy, 1, { run: 0, phase: 0, air: false, vy: 0, t: time }, L.pal.light, amb);
    if (player.torch && state !== 'title' && !(deathT > 0 && deathT < 0.6)) {
      // the head torch: a warm cone the way you face, lighting the snow in it
      const hx = player.x - cx + player.face * 6, hy = player.y - cy - 41;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(hx, hy, 2, hx, hy, 260);
      g.addColorStop(0, 'rgba(255,236,196,0.32)'); g.addColorStop(1, 'rgba(255,236,196,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(hx, hy);
      ctx.lineTo(hx + player.face * 260, hy - 50); ctx.lineTo(hx + player.face * 260, hy + 110); ctx.closePath(); ctx.fill();
      drawGlow('#fff1c8', hx, hy, 12, 0.7);
      ctx.restore();
    }
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
      if (L.pal.fg.kind !== 'fence' && !reduce()) ctx.rotate(Math.sin((life?.time || 0) * 0.6 + f.x) * 0.007);
      ctx.drawImage(f.s, -w / 2, -h, w, h); ctx.restore();
    }
    life.drawForeground(ctx, cam);
  }

  // A train crossing far off, lit windows in a dark line, every minute or so.
  function drawTrain(layer) {
    const tr = L.train, span = layer.w + tr.gap;
    const lx = ((time * tr.speed) % span) - 260, x = lx - cam.x * layer.f, y = tr.y - cam.y * layer.f;
    if (x > VIEW_W + 20 || x < -300) { if (x > VIEW_W + 20) trainHorn = false; return; }
    if (!trainHorn && x > VIEW_W - 200) { trainHorn = true; if (state === 'play') Sound.horn(); }
    const dark = mix('#3f474e', L.pal.haze, 0.45);
    ctx.fillStyle = css(dark);
    for (let i = 0; i < 7; i++) {
      const cx0 = x - i * 34;
      ctx.fillRect(cx0, y - 9, 31, 8);
      if (i === 0) { ctx.fillRect(cx0 + 20, y - 12, 10, 4); }
      for (let k = 0; k < 5; k++) if ((i * 7 + k) % 3) { ctx.fillStyle = css('#f2d9a0', 0.8); ctx.fillRect(cx0 + 3 + k * 5.6, y - 7, 2.4, 2); ctx.fillStyle = css(dark); }
    }
    Art.line(ctx, x - 240, y - 13, x + 34, y - 13, 0.6, dark, 0.5);
    ctx.globalCompositeOperation = 'lighter';
    drawGlow('#fff0c8', x + 31, y - 6, 16, 0.6);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawSearch(cx, cy) {
    const sr = L.search, sp = searchSpot(), lx = sr.sx - cx, ly = sr.sy - cy, gx = sp.gx - cx, gy = sp.gy - cy;
    if (lx < -900 || lx > VIEW_W + 900) return;
    // the tower
    Art.line(ctx, lx, ly + 6, lx, (world.groundAt(sr.sx) ?? 600) - cy + 4, 6, '#20242b');
    for (let yy = ly + 20; yy < (world.groundAt(sr.sx) ?? 600) - cy; yy += 26) Art.line(ctx, lx - 6, yy, lx + 6, yy + 13, 1.5, '#2c313a');
    ctx.fillStyle = '#2b3038'; ctx.fillRect(lx - 12, ly - 8, 24, 14);
    const red = caughtT > 0 ? caughtT / 1.2 : 0;
    const col = red > 0 ? '#ff8a70' : '#f4f2e6';
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(lx, ly, gx, gy);
    g.addColorStop(0, css(col, 0.28)); g.addColorStop(1, css(col, 0.1));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lx + 8, ly); ctx.lineTo(gx + sr.r, gy + 4); ctx.lineTo(gx - sr.r, gy + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = css(col, 0.22); ctx.beginPath(); ctx.ellipse(gx, gy + 2, sr.r, 9, 0, 0, TAU); ctx.fill();
    drawGlow(col, lx + 8, ly, 30, 0.9);
    ctx.restore();
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
    if (reduce()) return;
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
    if (lineCur && !paused) {
      const a = Math.min(1, lineCur.t / 0.9, (lineCur.d - lineCur.t) / 0.9);
      const t = T(), size = 28 * t, lh = 34 * t;
      const ls = wrap(lineCur.text, 760 * (t > 1 ? 1.25 : 1), size, { italic: true });
      const y0 = VIEW_H - 58 - (ls.length - 1) * lh;
      const g = ctx.createLinearGradient(0, VIEW_H - 170 * t, 0, VIEW_H);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(8,8,10,${(t > 1 ? 0.5 : 0.35) * a})`);
      ctx.fillStyle = g; ctx.fillRect(0, VIEW_H - 170 * t, VIEW_W, 170 * t);
      ls.forEach((l, i) => text(l, VIEW_W / 2, y0 + i * lh, size, a, { italic: true, shadowA: 0.6 }));
    }
    if (state === 'play' && promptA > 0.02) {
      const ph = nearPhoto();
      const what = ph && ph.have ? 'take it again' : 'take a photograph';
      text(`${isTouch ? '◉' : keyName(S().keys.photo)}  ·  ${what}`, VIEW_W / 2, 58, 20 * T(), promptA * 0.9, { italic: true });
    }
    if (state === 'play' && !nearPhoto() && placePromptA > 0.02 && deathT <= 0) {
      const place = life.near(player);
      if (place) {
        const key = isTouch ? '◉' : navigator.getGamepads?.().some(p => p) ? 'X / □' : keyName(S().keys.photo);
        const label = place.kind === 'signal' && place.on ? 'turn the lights off' : place.label;
        const waiting = place.kind === 'water' ? 'rings on the water' : place.kind === 'stones' ? 'almost weightless' : 'listen…';
        text(place.cooldown > 0 ? waiting : `${key}  ·  ${label}`, VIEW_W / 2, 58, 20 * T(), placePromptA * 0.75 * (1 - promptA), { italic: true });
      }
    }
    if (state === 'play' && stateT < 6) {
      const a = Math.min(1, stateT / 1, (6 - stateT) / 1.5);
      text(`${roman(L.id)} · ${L.title}`, 40, 50, 22 * T(), a * 0.85, { align: 'left', letter: 2 });
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
      const cnt = Store.photos.length, total = LEVELS.reduce((s, l) => s + l.photos.length, 0);
      text(`${cnt} / ${total}`, x + w / 2, y + h + 24, 15, inT * (1 - outT) * 0.8, { col: '#3a3530', shadow: false, italic: true });
    }
    if (caughtT > 0 && state === 'play') { ctx.fillStyle = `rgba(160,40,30,${0.18 * caughtT / 1.2})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (flash > 0) { ctx.fillStyle = `rgba(255,252,245,${flash * (reduce() ? 0.3 : 0.85)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (fade < 0.999) { ctx.fillStyle = `rgba(6,6,8,${1 - fade})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }

    if (state === 'title') renderTitle();
    if (state === 'card') renderCard();
    if (state === 'album' || state === 'albumview') renderAlbum();
    if (paused && state === 'play') renderPause();
  }

  function roman(n) { return ['', 'I', 'II', 'III', 'IV', 'V', 'VI'][n]; }

  function renderTitle() {
    const a = Math.min(1, stateT / 2);
    const g = ctx.createLinearGradient(0, 0, 0, 360);
    g.addColorStop(0, `rgba(20,24,30,${0.35 * a})`); g.addColorStop(1, 'rgba(20,24,30,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, 360);
    text('STÅLHAGEN', VIEW_W / 2, 190, 92, a, { weight: 500, letter: 18, shadowA: 0.3 });
    text('the steel pasture', VIEW_W / 2, 238, 30, a * 0.9, { italic: true });
    const b = Math.min(1, Math.max(0, stateT - 1));
    if (menuStack) {
      // a soft band behind the menu keeps it legible over the snow
      const band = ctx.createLinearGradient(0, 270, 0, 620);
      band.addColorStop(0, 'rgba(20,24,30,0)'); band.addColorStop(0.3, `rgba(20,24,30,${0.28 * b})`); band.addColorStop(0.75, `rgba(20,24,30,${0.28 * b})`); band.addColorStop(1, 'rgba(20,24,30,0)');
      ctx.fillStyle = band; ctx.fillRect(0, 270, VIEW_W, 350);
      renderMenu(menuStack.length > 1 ? 370 : 330, b);
    }
    if (!isTouch) {
      const k = S().keys, foot = ctx.createLinearGradient(0, VIEW_H - 90, 0, VIEW_H);
      foot.addColorStop(0, 'rgba(14,16,20,0)'); foot.addColorStop(1, `rgba(14,16,20,${0.55 * b})`);
      ctx.fillStyle = foot; ctx.fillRect(0, VIEW_H - 90, VIEW_W, 90);
      text(`← → or ${keyName(k.left)} ${keyName(k.right)}  walk     ↑ or ${keyName(k.jump)}  jump     ↓ or ${keyName(k.photo)}  photograph / interact     M  sound     esc  pause`, VIEW_W / 2, VIEW_H - 30, 15 * T(), b * 0.65, { letter: 1 });
    }
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
    ctx.fillStyle = 'rgba(8,8,10,0.62)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (menuStack) renderMenu(330, 1);
    text('Some things answer. Some things only happen if you wait.', VIEW_W / 2, VIEW_H - 60, 17 * T(), 0.55, { italic: true });
  }

  function renderAlbum() {
    ctx.fillStyle = '#1b1a1e'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const a = Math.min(1, stateT / 1.5), t = T(), end = state === 'album';
    text(end ? 'I still have the photographs. That’s how I know it happened.' : 'the album', VIEW_W / 2, 64, (end ? 28 : 30) * t, a, { italic: true, letter: end ? 0 : 3 });
    const list = Store.photos, n = list.length;
    const cols = n > 15 ? 6 : 5, w = n > 15 ? 168 : 196, h = w * 9 / 16, gap = 26, rowH = h + 44 + 14 * t;
    const x0 = VIEW_W / 2 - (Math.min(cols, Math.max(1, n)) * (w + gap) - gap) / 2, y0 = 116;
    list.forEach((p, i) => {
      const r = (i / cols) | 0, c = i % cols;
      const pa = end ? clamp((stateT - 1 - i * 0.2) / 0.6, 0, 1) : a;
      if (pa <= 0) return;
      const x = x0 + c * (w + gap), y = y0 + r * rowH;
      ctx.save(); ctx.globalAlpha = pa; ctx.translate(x + w / 2, y + h / 2); ctx.rotate(((i * 7919) % 11 - 5) * 0.006);
      ctx.fillStyle = '#f0ece2'; ctx.fillRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 36 + 14 * t);
      const img = p.img;
      if (img && (!(img instanceof Image) || (img.complete && img.naturalWidth))) ctx.drawImage(img, -w / 2, -h / 2, w, h);
      else { ctx.fillStyle = '#c9c4b8'; ctx.fillRect(-w / 2, -h / 2, w, h); }
      ctx.restore();
      ctx.globalAlpha = pa;
      const size = 12.5 * t, cl = wrap(p.caption, w + 6, size, { italic: true });
      cl.slice(0, 2).forEach((l, k) => text(l, x + w / 2, y + h + 15 + size * 0.5 + k * size * 1.1, size, pa, { italic: true, col: '#3a3530', shadow: false }));
      ctx.globalAlpha = 1;
    });
    if (!n) text('You didn’t take any. Maybe that is its own kind of remembering.', VIEW_W / 2, 330, 22 * t, a * 0.8, { italic: true });
    const total = LEVELS.reduce((s, l) => s + l.photos.length, 0);
    const b = end ? clamp(stateT - 2 - n * 0.2, 0, 1) : a;
    text(`${n} of ${total} photographs`, VIEW_W / 2, VIEW_H - 84, 17 * t, b * 0.7, { italic: true });
    if (end) text('STÅLHAGEN  ·  after the paintings of Simon Stålenhag  ·  every image drawn in code', VIEW_W / 2, VIEW_H - 56, 14 * t, b * 0.5, { letter: 1 });
    if (stateT > (end ? 3 : 0.6)) text(isTouch ? 'tap to go on' : 'press any key', VIEW_W / 2, VIEW_H - 24, 15 * t, (0.4 + Math.sin(time * 2) * 0.2), { italic: true });
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!world || state === 'loading' || state === 'boot') {
      ctx.fillStyle = '#0c0c0e'; ctx.fillRect(0, 0, cv.width, cv.height);
      return;
    }
    if (state !== 'album' && state !== 'albumview') {
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
    // a drawing error must never stop the loop; the next frame tries again
    try { render(); } catch (err) { if (!frame.warned) { frame.warned = true; console.error(err); } }
    requestAnimationFrame(frame);
  }

  function start() {
    makePost();
    if (Store.settings.muted && !Sound.muted) Sound.toggleMute();
    loadChapter(0, () => { state = 'title'; stateT = 0; fade = 0; fadeTarget = 1; cam = { x: 60, y: 0 }; posTitleBot(); });
    requestAnimationFrame(t => { last = t; frame(t); });
  }

  // debug / testing hooks
  window.__game = {
    get state() { return state; }, get player() { return player; }, get world() { return world; }, get robot() { return robot; }, get cam() { return cam; },
    jump(i, x) { state = 'loading'; loadChapter(i, () => { state = 'play'; stateT = 10; fade = 1; fadeTarget = 1; if (x) { player.x = x; player.y = world.surfaceAt(x); follow(0, true); } }); },
    set(x, y) { player.x = x; player.y = y ?? world.surfaceAt(x); player.vy = 0; follow(0, true); },
    keys, pressed, nav, get album() { return Store.photos; }, get menu() { return menuStack; }, tapAt(x, y) { tap = { x, y }; }, get L() { return L; }, get time() { return time; },
    get deaths() { return deaths; }, get life() { return life; }, search: () => L.search && { ...searchSpot(), hidden: inShadow() }, get Q() { return Q; }, get painted() { return layers; },
    step(n, dt = 1 / 120) { for (let i = 0; i < n; i++) update(dt); }, hazardOn: h => hazardOn(h), ending: () => startEnding(), setState(s) { state = s; stateT = 0; },
  };
  return { start };
})();

Game.start();
