// GRIFT CITY — keyboard, mouse (pointer lock) and gamepad.
'use strict';
const INPUT = (() => {
  const keys = {}, pressed = {}, mouse = { dx: 0, dy: 0, buttons: 0, wheel: 0, clicked: 0, rclicked: 0 };
  let locked = false, canvas = null, wantLock = false, fallback = false;
  const pad = { lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0, buttons: [], pressed: [], active: false };
  // An on-screen control layer stands in for a gamepad and can press keys, so nothing downstream needs to know
  // whether a finger or a keyboard is driving it.
  let virtualMouse = 0, lastVirtualMouse = 0;
  function tapKey(code) { pressed[physical(code)] = true; }
  function holdKey(code, on) { if (on) { if (!keys[code]) pressed[code] = true; keys[code] = true; } else keys[code] = false; }
  function init(c) {
    canvas = c;
    window.addEventListener('keydown', e => { let code = e.code; if (!code || (e.key === 'Shift' && code !== 'ShiftLeft' && code !== 'ShiftRight')) code = e.key === 'Shift' ? 'ShiftLeft' : code; if (!keys[code]) pressed[code] = true; keys[code] = true; if (e.key && e.key.length === 1) { api.typed = (api.typed + e.key.toUpperCase()).slice(-12); } if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyF', 'F1', 'AltLeft', 'AltRight'].includes(e.code) || e.code.startsWith('Digit')) e.preventDefault(); });
    window.addEventListener('keyup', e => { keys[e.code] = false; if (e.key === 'Shift') { keys.ShiftLeft = false; keys.ShiftRight = false; } });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.buttons = 0; });
    document.addEventListener('mousemove', e => { if (locked || fallback) { mouse.dx += e.movementX; mouse.dy += e.movementY; } if (typeof e.buttons === 'number') mouse.buttons = e.buttons & 7; }); // the browser's own button mask heals a missed mouseup (a two-finger click on a Mac trackpad can lose one)
    document.addEventListener('pointerlockerror', () => { fallback = true; locked = false; });
    document.addEventListener('mousedown', e => { if (e.button === 0) { mouse.clicked++; mouse.buttons |= 1; } if (e.button === 2) { mouse.rclicked++; mouse.buttons |= 2; } if (e.button === 1) mouse.buttons |= 4; if (wantLock && !locked) requestLock(); });
    document.addEventListener('mouseup', e => { if (e.button === 0) mouse.buttons &= ~1; if (e.button === 2) mouse.buttons &= ~2; if (e.button === 1) mouse.buttons &= ~4; });
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('wheel', e => { mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; document.body.classList.toggle('locked', locked); if (!locked && wantLock && api.onLockLost) api.onLockLost(); });
  }
  function requestLock() { if (api.touch) return; wantLock = true; if (canvas && document.pointerLockElement !== canvas) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { fallback = true; }); } catch (e) { fallback = true; } } }
  function releaseLock() { wantLock = false; if (document.pointerLockElement) document.exitPointerLock(); }
  function pollPad() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : []; let g = null; for (const p of gps) if (p && p.connected) { g = p; break; }
    const v = !g && api.virtualPad ? api.virtualPad() : null;
    pad.active = !!g || !!v;
    // the touch layer's buttons ride along with the real ones, clearing only the bits it set itself
    const vm = v ? (v.mouseButtons || 0) : 0; mouse.buttons = (mouse.buttons & ~lastVirtualMouse) | vm; lastVirtualMouse = vm;
    if (v) {
      pad.lx = v.lx || 0; pad.ly = v.ly || 0; pad.rx = v.rx || 0; pad.ry = v.ry || 0; pad.lt = v.lt || 0; pad.rt = v.rt || 0;
      const b = v.buttons || [];
      for (let i = 0; i < 16; i++) { const d = !!b[i]; pad.pressed[i] = d && !pad.buttons[i]; pad.buttons[i] = d; }
      return;
    }
    if (!g) { pad.lx = pad.ly = pad.rx = pad.ry = pad.lt = pad.rt = 0; for (let i = 0; i < pad.buttons.length; i++) { pad.pressed[i] = false; pad.buttons[i] = false; } return; }
    const dz = v2 => Math.abs(v2) < 0.15 ? 0 : v2;
    pad.lx = dz(g.axes[0] || 0); pad.ly = dz(g.axes[1] || 0); pad.rx = dz(g.axes[2] || 0); pad.ry = dz(g.axes[3] || 0);
    pad.lt = g.buttons[6] ? g.buttons[6].value : 0; pad.rt = g.buttons[7] ? g.buttons[7].value : 0;
    for (let i = 0; i < g.buttons.length; i++) { const down = g.buttons[i].pressed; pad.pressed[i] = down && !pad.buttons[i]; pad.buttons[i] = down; }
  }
  const physical = code => typeof GAME !== 'undefined' && GAME.state === 'playing' ? (GAME.options.bindings?.[code] || code) : code;
  const down = code => !!keys[physical(code)];
  const hit = code => !!pressed[physical(code)];
  function releaseAll() { for (const k in keys) keys[k]=false; consumeEdges(); mouse.buttons=0; }
  function label(code) { return SETTINGS.keyName(physical(code)); }
  // The per-frame edges (key presses, clicks, mouse motion, wheel) are consumed by the first simulation step of a frame;
  // held keys and buttons stay for the following sub-steps.
  function consumeEdges() { for (const k in pressed) pressed[k] = false; mouse.dx = 0; mouse.dy = 0; mouse.wheel = 0; mouse.clicked = 0; mouse.rclicked = 0; for (let i = 0; i < pad.pressed.length; i++) pad.pressed[i] = false; }
  const endFrame = consumeEdges;
  // For recordings: the whole input state of a frame as plain data, and back.
  function snapshot() { const k = [], p = []; for (const c in keys) if (keys[c]) k.push(c); for (const c in pressed) if (pressed[c]) p.push(c); return { k, p, m: [mouse.dx, mouse.dy, mouse.buttons, mouse.wheel, mouse.clicked, mouse.rclicked] }; }
  function restore(s) { for (const c in keys) keys[c] = false; for (const c of s.k) keys[c] = true; for (const c in pressed) pressed[c] = false; for (const c of s.p) pressed[c] = true; [mouse.dx, mouse.dy, mouse.buttons, mouse.wheel, mouse.clicked, mouse.rclicked] = s.m; }
  const api = { physical, init, down, hit, releaseAll, label, mouse, pad, pollPad, endFrame, consumeEdges, snapshot, restore, requestLock, releaseLock, tapKey, holdKey, virtualPad: null, touch: false, get locked() { return locked || fallback; }, get fallback() { return fallback; }, onLockLost: null, typed: '' };
  return api;
})();
