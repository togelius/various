// GRIFT CITY — on-screen controls for a touchscreen, laid out the way the phone ports of these games are:
// a floating stick under the left thumb, a cluster of buttons under the right, and a drag anywhere else on
// the right half to look around. Everything it does goes through INPUT's virtual gamepad and its virtual key
// presses, so no other module has to know whether a finger or a keyboard is driving the game.
'use strict';
const TOUCH = (() => {
  let active = false, forced = null, sawMouse = false;
  const pts = new Map();        // pointerId -> what that finger is doing
  let stick = null;             // the movement (or steering) stick: { id, cx, cy, nx, ny }
  let look = null;              // the finger dragging the camera: { id, x, y }
  const held = new Set();       // button ids currently under a finger
  const vkeys = new Set();      // keys this layer is holding down, so it never releases one the player is holding
  const vhold = (code, on) => { code=INPUT.physical(code); if (on) { vkeys.add(code); INPUT.holdKey(code, true); } else if (vkeys.has(code)) { vkeys.delete(code); INPUT.holdKey(code, false); } };
  let hudCv = null, lastL = null;
  const LOOK_GAIN = 2.1;        // a drag of the screen turns about as far as the same sweep of a mouse would
  const SPRINT_AT = 0.82;       // push the stick to its rim and you run, so running needs no button of its own

  // The other modules are top-level `const`s, which are global bindings but not properties of `window`, and
  // GAME is still being built when the loading screen first draws. Reaching them by name behind a guard is the
  // only way to read them from here that is correct in both respects.
  const safe = (fn, dflt) => { try { const v = fn(); return v === undefined ? dflt : v; } catch (e) { return dflt; } };
  const ply = () => safe(() => PLAYER.P, null);
  const gState = () => safe(() => GAME.state, 'loading');

  // ---- what kind of device this is
  function sense() {
    if (forced !== null) return forced;
    if (sawMouse) return false;
    const mm = window.matchMedia;
    const coarse = mm && matchMedia('(pointer: coarse)').matches;
    const fine = mm && matchMedia('(pointer: fine)').matches;
    return !!(navigator.maxTouchPoints > 0 && coarse && !fine);
  }
  function setActive(v) { if (active === v) return; active = v; INPUT.touch = v; if (v) INPUT.releaseLock(); }

  // ---- layout. One function decides where everything is, so drawing and hit-testing can never disagree.
  function metrics() {
    const W = (hudCv && hudCv.clientWidth) || window.innerWidth || 960;
    const H = (hudCv && hudCv.clientHeight) || window.innerHeight || 540;
    const u = Math.max(34, Math.min(62, Math.min(W, H) * 0.085));
    return { W, H, u };
  }
  function layout() {
    const { W, H, u } = metrics();
    const P = ply();
    const car = P && P.car;
    const m = u * 1.3, bx = W - m, by = H - m;
    const B = [];
    const add = (id, x, y, r, label, tap) => B.push({ id, x, y, r, label, tap: !!tap });
    if (car) {
      add('gas', bx, by, u * 1.02, 'GAS');
      add('brake', bx - u * 2.45, by + u * 0.04, u * 0.76, 'BRAKE');
      add('hand', bx + u * 0.04, by - u * 2.45, u * 0.7, 'HAND');
      add('exit', bx - u * 1.92, by - u * 1.92, u * 0.7, 'EXIT', true);
      add('horn', bx - u * 4.05, by - u * 0.15, u * 0.56, 'HORN');
      const wp = P.weapon;
      if ((wp === 'pistol' || wp === 'uzi') && P.weapons[wp] > 0) add('shoot', bx - u * 3.55, by - u * 2.85, u * 0.6, 'SHOOT');
      add('radio', bx - u * 5.25, by - u * 1.45, u * 0.48, 'RADIO', true);
      if (car.type === 'police' || car.type === 'swat') add('siren', bx - u * 5.25, by - u * 2.75, u * 0.48, 'SIREN', true);
    } else {
      add('fire', bx, by, u * 1.02, 'FIRE');
      add('aim', bx - u * 2.45, by + u * 0.04, u * 0.76, 'AIM');
      add('jump', bx + u * 0.04, by - u * 2.45, u * 0.7, 'JUMP', true);
      add('enter', bx - u * 1.92, by - u * 1.92, u * 0.7, 'ENTER', true);
      if (safe(()=>MISSIONS.S.current && MISSIONS.S.current.id===1 && !MISSIONS.S.current.strand && !MISSIONS.S.current.data.fled && !MISSIONS.S.current.data.surrendered,false)) add('talk',bx-u*3.55,by-u*2.85,u*.6,'TALK');
      add('weapon', bx - u * 4.05, by - u * 0.15, u * 0.56, 'WEAP', true);
    }
    add('map', W - u * 5.9, u * 0.95, u * 0.5, 'MAP', true);
    add('pause', W - u * 4.45, u * 0.95, u * 0.5, 'II', true);
    if (canFull()) add('full', W - u * 7.35, u * 0.95, u * 0.5, 'FULL', true);
    const L = { W, H, u, car: !!car, buttons: B,
      home: { x: Math.max(u * 2.3, W * 0.15), y: H - u * 2.5, r: u * 1.35 },
      zone: { x1: W * 0.47, y0: H * 0.26 } };
    lastL = L; return L;
  }
  const canFull = () => !!((document.fullscreenEnabled && document.documentElement.requestFullscreen)
    || (document.webkitFullscreenEnabled && document.documentElement.webkitRequestFullscreen));
  function toggleFull() {
    const d = document, el = d.documentElement;
    try {
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    } catch (e) { }
  }
  function buttonAt(x, y, L) {
    for (let i = L.buttons.length - 1; i >= 0; i--) { const b = L.buttons[i];
      const dx = x - b.x, dy = y - b.y, r = b.r * 1.3; if (dx * dx + dy * dy <= r * r) return b; }
    return null;
  }
  // A tappable strip the HUD published this frame (a shop line, a pause option, a map to close).
  function zoneAt(x, y) {
    const z = safe(() => HUD.zones, null); if (!z) return null;
    for (let i = z.length - 1; i >= 0; i--) { const q = z[i]; if (x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) return q; }
    return null;
  }

  // ---- what the game is asking of the player right now
  function mode(st) {
    st = st || gState();
    if (st === 'title') return 'title';
    if (st === 'loading') return 'loading';
    if (st !== 'playing') return st;             // paused, map, photo
    if (safe(() => MISSIONS.dialogue, null)) return 'dialogue';
    if (safe(() => MISSIONS.shop, null)) return 'shop';
    return 'play';
  }

  function onDown(e) {
    if (e.target.closest && e.target.closest('#settings')) return;
    if (e.pointerType === 'mouse') { sawMouse = true; if (forced === null) setActive(false); return; }
    setActive(sense() || forced === true || forced === null);
    if (!active) return;
    e.preventDefault();
    const x = e.clientX, y = e.clientY, id = e.pointerId, md = mode();
    if (md === 'loading') { pts.set(id, { role: 'none' }); return; }
    const z = zoneAt(x, y);
    if (z) { INPUT.tapKey(z.key); pts.set(id, { role: 'zone' }); return; }
    if (md === 'title') { safe(() => GAME.startPlay(), null); pts.set(id, { role: 'none' }); return; }
    const L = layout();
    if (md === 'dialogue') { INPUT.tapKey('Space'); pts.set(id, { role: 'none' }); return; }
    if (md === 'map') { INPUT.tapKey('Tab'); pts.set(id, { role: 'none' }); return; }
    if (md === 'paused') { INPUT.tapKey('Escape'); pts.set(id, { role: 'none' }); return; }
    const b = buttonAt(x, y, L);
    if (b) {
      pts.set(id, { role: 'btn', btn: b.id }); held.add(b.id);
      if (b.tap) fireTap(b.id);
      return;
    }
    if (md === 'shop') { pts.set(id, { role: 'none' }); return; }
    if (x < L.zone.x1 && y > L.zone.y0 && !stick) {
      stick = { id, cx: x, cy: y, nx: 0, ny: 0 }; pts.set(id, { role: 'stick' }); return;
    }
    if (x >= L.zone.x1 && !look) { look = { id, x, y }; pts.set(id, { role: 'look' }); return; }
    pts.set(id, { role: 'none' });
  }
  function fireTap(id) {
    if (id === 'jump') INPUT.tapKey('Space');
    else if (id === 'enter' || id === 'exit') INPUT.tapKey('KeyF');
    else if (id === 'weapon') INPUT.tapKey('KeyE');
    else if (id === 'radio') INPUT.tapKey('KeyR');
    else if (id === 'siren') INPUT.tapKey('KeyL');
    else if (id === 'pause') INPUT.tapKey('Escape');
    else if (id === 'map') INPUT.tapKey('Tab');
    else if (id === 'full') toggleFull();
  }
  function onMove(e) {
    if (!active || e.pointerType === 'mouse') return;
    const p = pts.get(e.pointerId); if (!p) return;
    e.preventDefault();
    const x = e.clientX, y = e.clientY;
    if (p.role === 'stick' && stick && stick.id === e.pointerId) {
      const L = lastL || layout(); const R = L.home.r;
      let dx = x - stick.cx, dy = y - stick.cy; const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      stick.nx = dx / R; stick.ny = dy / R; stick.x = stick.cx + dx; stick.y = stick.cy + dy;
    } else if (p.role === 'look' && look && look.id === e.pointerId) {
      INPUT.mouse.dx += (x - look.x) * LOOK_GAIN; INPUT.mouse.dy += (y - look.y) * LOOK_GAIN;
      look.x = x; look.y = y;
    }
  }
  function onUp(e) {
    const p = pts.get(e.pointerId); pts.delete(e.pointerId);
    if (!p) return;
    if (p.role === 'btn') held.delete(p.btn);
    if (p.role === 'stick' && stick && stick.id === e.pointerId) stick = null;
    if (p.role === 'look' && look && look.id === e.pointerId) look = null;
  }

  // ---- the gamepad INPUT sees. Called once a frame from INPUT.pollPad, which is also where the buttons that
  // are really keys (handbrake, horn, sprint) get synced.
  function virtualPad() {
    if (!active) return null;
    const P = ply(); const inCar = !!(P && P.car);
    const on = id => held.has(id);
    let lx = stick ? stick.nx : 0, ly = stick ? stick.ny : 0;
    let lt = 0, rt = 0, mouseButtons = 0;
    if (inCar) {
      rt = on('gas') ? 1 : 0; lt = on('brake') ? 1 : 0; ly = 0;
      vhold('KeyG',false); vhold('Space', on('hand')); vhold('KeyH', on('horn')); vhold('ShiftLeft', false);
      if (on('shoot')) mouseButtons |= 1;
    } else {
      rt = on('fire') ? 1 : 0; lt = on('aim') ? 1 : 0;
      vhold('KeyG',on('talk')); vhold('Space', false); vhold('KeyH', false);
      vhold('ShiftLeft', Math.hypot(lx, ly) > SPRINT_AT);
      if (on('fire')) mouseButtons |= 1;
      if (on('aim')) mouseButtons |= 2;
    }
    return { lx, ly, rx: 0, ry: 0, lt, rt, buttons: [], mouseButtons };
  }

  // ---- drawing
  function ring(g, x, y, r, fill, stroke, w) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = w || 2; g.stroke(); }
  }
  function draw(g, W, H, state) {
    if (!active) return;
    const md = mode(state);
    if (md === 'title' || md === 'loading') return;
    const L = layout();
    if (H > W) { // portrait: the cluster runs off the bottom and the stick has nowhere to go
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, H / 2 - 40, W, 80);
      g.font = 'bold 18px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#f5c542'; g.fillText('Turn the device sideways to play', W / 2, H / 2);
      return;
    }
    const playing = md === 'play';
    for (const b of L.buttons) {
      const isTop = b.id === 'map' || b.id === 'pause' || b.id === 'full';
      if (!playing && !isTop) continue;
      if (!playing && md !== 'paused' && md !== 'map' && md !== 'shop') continue;
      const down = held.has(b.id);
      ring(g, b.x, b.y, b.r, down ? 'rgba(245,197,66,0.30)' : 'rgba(10,14,18,0.34)', down ? 'rgba(245,197,66,0.9)' : 'rgba(255,255,255,0.5)', b.r > 30 ? 2.5 : 2);
      g.font = `bold ${Math.max(10, Math.round(b.r * (b.label.length > 4 ? 0.34 : 0.42)))}px "Helvetica Neue", Arial, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = down ? '#fff' : 'rgba(255,255,255,0.82)';
      g.fillText(b.label, b.x, b.y);
    }
    if (!playing) return;
    // the stick: a faint home ring until a thumb lands, then it follows the thumb
    const h = L.home;
    if (stick) {
      ring(g, stick.cx, stick.cy, h.r, 'rgba(10,14,18,0.28)', 'rgba(255,255,255,0.4)', 2);
      ring(g, stick.x, stick.y, h.r * 0.42, 'rgba(245,197,66,0.55)', 'rgba(255,255,255,0.8)', 2);
    } else {
      ring(g, h.x, h.y, h.r, 'rgba(10,14,18,0.16)', 'rgba(255,255,255,0.22)', 2);
      ring(g, h.x, h.y, h.r * 0.42, 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.26)', 2);
    }
  }

  function init(canvas) {
    hudCv = document.getElementById('hud') || canvas;
    const q = /[?&]touch=([01])/.exec(location.search); if (q) forced = q[1] === '1';  // ?touch=1 forces the pad on, ?touch=0 off
    setActive(sense());
    INPUT.virtualPad = virtualPad;
    const o = { passive: false, capture: true };
    window.addEventListener('pointerdown', onDown, o);
    window.addEventListener('pointermove', onMove, o);
    window.addEventListener('pointerup', onUp, o);
    window.addEventListener('pointercancel', onUp, o);
    window.addEventListener('contextmenu', e => { if (active) e.preventDefault(); });
    // a sideways turn changes every button's home
    window.addEventListener('orientationchange', () => { stick = null; look = null; held.clear(); });
  }
  const api = { init, draw, get active() { return active; }, layout,
    force(v) { forced = v; setActive(v === null ? sense() : v); } };
  return api;
})();
