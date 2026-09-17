// GRIFT CITY — keyboard, mouse (pointer lock) and gamepad.
'use strict';
const INPUT = (() => {
  const keys = {}, pressed = {}, mouse = { dx: 0, dy: 0, buttons: 0, wheel: 0, clicked: 0, rclicked: 0 };
  let locked = false, canvas = null, wantLock = false, fallback = false;
  const pad = { lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0, buttons: [], pressed: [], active: false };
  function init(c) {
    canvas = c;
    window.addEventListener('keydown', e => { if (!keys[e.code]) pressed[e.code] = true; keys[e.code] = true; if (e.key && e.key.length === 1) { api.typed = (api.typed + e.key.toUpperCase()).slice(-12); } if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyF', 'F1'].includes(e.code) || e.code.startsWith('Digit')) e.preventDefault(); });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.buttons = 0; });
    document.addEventListener('mousemove', e => { if (locked || fallback) { mouse.dx += e.movementX; mouse.dy += e.movementY; } });
    document.addEventListener('pointerlockerror', () => { fallback = true; locked = false; });
    document.addEventListener('mousedown', e => { if (e.button === 0) { mouse.clicked++; mouse.buttons |= 1; } if (e.button === 2) { mouse.rclicked++; mouse.buttons |= 2; } if (e.button === 1) mouse.buttons |= 4; if (wantLock && !locked) requestLock(); });
    document.addEventListener('mouseup', e => { if (e.button === 0) mouse.buttons &= ~1; if (e.button === 2) mouse.buttons &= ~2; if (e.button === 1) mouse.buttons &= ~4; });
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('wheel', e => { mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; document.body.classList.toggle('locked', locked); if (!locked && wantLock && api.onLockLost) api.onLockLost(); });
  }
  function requestLock() { wantLock = true; if (canvas && document.pointerLockElement !== canvas) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { fallback = true; }); } catch (e) { fallback = true; } } }
  function releaseLock() { wantLock = false; if (document.pointerLockElement) document.exitPointerLock(); }
  function pollPad() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : []; let g = null; for (const p of gps) if (p && p.connected) { g = p; break; }
    pad.active = !!g; if (!g) return;
    const dz = v => Math.abs(v) < 0.15 ? 0 : v;
    pad.lx = dz(g.axes[0] || 0); pad.ly = dz(g.axes[1] || 0); pad.rx = dz(g.axes[2] || 0); pad.ry = dz(g.axes[3] || 0);
    pad.lt = g.buttons[6] ? g.buttons[6].value : 0; pad.rt = g.buttons[7] ? g.buttons[7].value : 0;
    for (let i = 0; i < g.buttons.length; i++) { const down = g.buttons[i].pressed; pad.pressed[i] = down && !pad.buttons[i]; pad.buttons[i] = down; }
  }
  const down = code => !!keys[code];
  const hit = code => !!pressed[code];
  function endFrame() { for (const k in pressed) pressed[k] = false; mouse.dx = 0; mouse.dy = 0; mouse.wheel = 0; mouse.clicked = 0; mouse.rclicked = 0; for (let i = 0; i < pad.pressed.length; i++) pad.pressed[i] = false; }
  // For recordings: the whole input state of a frame as plain data, and back.
  function snapshot() { const k = [], p = []; for (const c in keys) if (keys[c]) k.push(c); for (const c in pressed) if (pressed[c]) p.push(c); return { k, p, m: [mouse.dx, mouse.dy, mouse.buttons, mouse.wheel, mouse.clicked, mouse.rclicked] }; }
  function restore(s) { for (const c in keys) keys[c] = false; for (const c of s.k) keys[c] = true; for (const c in pressed) pressed[c] = false; for (const c of s.p) pressed[c] = true; [mouse.dx, mouse.dy, mouse.buttons, mouse.wheel, mouse.clicked, mouse.rclicked] = s.m; }
  const api = { init, down, hit, mouse, pad, pollPad, endFrame, snapshot, restore, requestLock, releaseLock, get locked() { return locked || fallback; }, get fallback() { return fallback; }, onLockLost: null, typed: '' };
  return api;
})();
