// SQUARE OFF — DOM HUD over the canvas (DESIGN §5.5): Turf race, Clout/income/pop, day clock,
// landmark chips, squad tray, recruit bar, Crew Call, landmark card + build radial, toasts,
// announcer, bubbles projected from 3D, off-screen alerts, minimap, tactical pause and pause menu.
//
// Also defines SQ.ui: small helpers shared by hud/menus/tutorial (el, glyphs, colors, projection,
// screen->ground, camera jumps, sounds).
//
// Public API (main.js calls init/setMatch/update; the alternative signatures in the UI brief also work):
//   SQ.hud.init(hudEl | match, game?)      SQ.hud.setMatch(match|null)      SQ.hud.destroy()
//   SQ.hud.update(match, realDt) | update(realDt)
//   SQ.hud.openLandmark(lmId | 'dosa')     SQ.hud.closeCard()
//   SQ.hud.announce(text, pri=1, kind?)    SQ.hud.toast(text, {icon, life, action:{label, fn}})
//   SQ.hud.bubble({x, z, unit?, text, color?, kind:'exit'|'bark'})   SQ.hud.banner(text, color?, sub?)
//   SQ.hud.beginCrewCall() / cancelCrewCall()   SQ.hud.targeting -> null | 'point'|'line'|'landmark'
//   SQ.hud.openPauseMenu() / closePauseMenu()  SQ.hud.latestAlert() -> {x, z, lm} | null
//   SQ.hud.getSelection() -> unit ids       SQ.hud.uiEl(key) -> HUD element for tutorial targets
//       keys: 'recruit.crowd'|'recruit.talker'|'recruit.heavy'|'crew'|'squad'|'chip'|'army'|'pause'|'menu'|
//             'clout'|'pop'|'turf'|'clock'|'landmarks'|'minimap'
//   SQ.hud.setMinimap(bool)
// Integration with input.js (all optional; feature-detected):
//   reads   SQ.input.getSelection() | SQ.input.selection (Array | Set | {ids})
//   calls   SQ.input.selectSquad(idx) | SQ.input.select(ids) | SQ.input.setSelection(ids), SQ.input.selectArmy(),
//           SQ.input.beginCrewCall() (if present the HUD lets input do the targeting), SQ.input.undo()
//   emits on SQ.bus: 'uiSelect' {ids, squad}  'uiOrder' {ids, order}  'uiCrewTarget' {active, mode}
//   listens on SQ.bus: 'landmarkTap' {lm} / 'uiOpenLandmark' {lm} -> opens the landmark card
// Camera (optional): SQ.camera.focus|jumpTo|flyTo|lookAt|centerOn(x, z); SQ.camera.screenToGround(cx, cy)
// Render (optional): SQ.render.project(x, y, z) -> {x, y, visible|behind} client px; SQ.render.camera
(function (SQ) {
  'use strict';

  // =========================================================================================
  // SQ.ui — shared helpers
  // =========================================================================================
  const U = SQ.ui = SQ.ui || {};
  const hasDoc = typeof document !== 'undefined';

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined && html !== null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function setting(k, d) {
    try { if (SQ.settings && typeof SQ.settings.get === 'function') { const v = SQ.settings.get(k); return v === undefined ? d : v; } } catch (e) { /* ignore */ }
    return d;
  }
  // Okabe–Ito based colorblind-safe crew palette (shapes + patterns still carry meaning).
  const CB = { hustle: '#0072B2', noise: '#F0E442', violets: '#CC79A7', pack: '#D55E00', squirrels: '#8B6A4E' };
  function crewColor(key) {
    if (setting('colorblind', false) && CB[key]) return CB[key];
    const f = SQ.data && SQ.data.factions && SQ.data.factions[key];
    return f ? f.color : '#999';
  }
  function facColor(fac) {
    if (!fac) return '#8a8f86';
    if (setting('colorblind', false) && CB[fac.key]) return CB[fac.key];
    return fac.color || crewColor(fac.key);
  }
  // White class shapes with a coloured rim (●▲■), as inline SVG so they render identically everywhere.
  function glyph(cls, color, size, extra) {
    const s = size || 18;
    const c = color || '#1b3a2c';
    const k = typeof cls === 'number' ? ['crowd', 'talker', 'heavy'][cls] : cls;
    let shape;
    if (k === 'talker') shape = '<path d="M12 3.2 L21.2 19.6 H2.8 Z" fill="#fff" stroke="' + c + '" stroke-width="2.6" stroke-linejoin="round"/>';
    else if (k === 'heavy') shape = '<rect x="4" y="4" width="16" height="16" rx="1.5" fill="#fff" stroke="' + c + '" stroke-width="2.6"/>';
    else shape = '<circle cx="12" cy="12" r="8.4" fill="#fff" stroke="' + c + '" stroke-width="2.6"/>';
    const label = { crowd: '●', talker: '▲', heavy: '■' }[k] || '';
    return '<svg class="glyph g-' + k + (extra ? ' ' + extra : '') + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" role="img" aria-label="' + label + '">' + shape + '</svg>';
  }
  const CLS_NAME = { crowd: 'Crowd', talker: 'Talker', heavy: 'Heavy' };
  const CLS_CHAR = { crowd: '●', talker: '▲', heavy: '■' };

  function viewRect() {
    const v = hasDoc && document.getElementById('view');
    if (v) return v.getBoundingClientRect();
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  }
  function threeCamera() {
    const r = SQ.render || {}, c = SQ.camera || {};
    let cam = null;
    try {
      cam = r.camera || (typeof r.getCamera === 'function' && r.getCamera()) || c.camera || c.cam ||
        (typeof c.getCamera === 'function' && c.getCamera()) || (typeof c.get === 'function' && c.get()) || null;
    } catch (e) { cam = null; }
    return cam && cam.isCamera ? cam : null;
  }
  let _v3 = null;
  /** World point -> {x, y (client px), on (inside view and in front), behind}. null if no projector. */
  function project(x, y, z) {
    const rect = viewRect();
    if (SQ.render && typeof SQ.render.worldToScreen === 'function' && SQ.render.renderer) {
      let p = null;
      try { p = SQ.render.worldToScreen(x, y, z, {}); } catch (e) { p = null; }
      if (p && isFinite(p.x) && isFinite(p.y)) return { x: p.x, y: p.y, on: !!p.onScreen, behind: !!p.behind };
    }
    if (SQ.render && typeof SQ.render.project === 'function') {
      let p = null;
      try { p = SQ.render.project(x, y, z); } catch (e) { p = null; }
      if (p) {
        let px, py, behind = false;
        if (Array.isArray(p)) { px = p[0]; py = p[1]; }
        else { px = p.x; py = p.y; behind = !!p.behind || p.visible === false && p.behind !== false && p.z > 1; }
        if (isFinite(px) && isFinite(py)) {
          const on = !behind && (p.visible !== false || p.onScreen) && px >= rect.left && px <= rect.left + rect.width && py >= rect.top && py <= rect.top + rect.height;
          return { x: px, y: py, on, behind };
        }
      }
    }
    const cam = threeCamera();
    if (!cam || typeof THREE === 'undefined') return null;
    if (!_v3) _v3 = new THREE.Vector3();
    _v3.set(x, y, z);
    _v3.project(cam);
    const behind = _v3.z > 1;
    let nx = _v3.x, ny = _v3.y;
    if (behind) { nx = -nx; ny = -ny; }
    const sx = rect.left + (nx + 1) / 2 * rect.width;
    const sy = rect.top + (1 - (ny + 1) / 2) * rect.height;
    return { x: sx, y: sy, on: !behind && Math.abs(nx) <= 1 && Math.abs(ny) <= 1, behind };
  }
  let _ray = null, _ndc = null, _plane = null, _hit = null;
  /** Client px -> ground {x, z} or null. */
  function toGround(cx, cy) {
    const tryFn = (o, n) => {
      if (!o || typeof o[n] !== 'function') return null;
      try {
        const r = o[n](cx, cy);
        if (!r) return null;
        if (Array.isArray(r)) return { x: r[0], z: r[1] };
        if (isFinite(r.x) && isFinite(r.z)) return { x: r.x, z: r.z };
      } catch (e) { /* ignore */ }
      return null;
    };
    const g = tryFn(SQ.camera, 'screenToGround') || tryFn(SQ.render, 'screenToGround') || tryFn(SQ.input, 'screenToGround') ||
      tryFn(SQ.render, 'pickGround') || tryFn(SQ.camera, 'pickGround');
    if (g) return g;
    const cam = threeCamera();
    if (!cam || typeof THREE === 'undefined') return null;
    const rect = viewRect();
    if (!_ray) { _ray = new THREE.Raycaster(); _ndc = new THREE.Vector2(); _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); _hit = new THREE.Vector3(); }
    _ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    _ray.setFromCamera(_ndc, cam);
    const h = _ray.ray.intersectPlane(_plane, _hit);
    return h ? { x: h.x, z: h.z } : null;
  }
  /** Move the camera to a ground point (whatever API camera.js offers). */
  function jump(x, z, opts) {
    const c = SQ.camera;
    if (!c) return false;
    for (const n of ['focus', 'jumpTo', 'flyTo', 'lookAt', 'centerOn', 'moveTo', 'panTo', 'setTarget']) {
      if (typeof c[n] === 'function') { try { c[n](x, z, opts); return true; } catch (e) { /* try next */ } }
    }
    if (c.target && typeof c.target === 'object' && 'x' in c.target) { c.target.x = x; c.target.z = z; return true; }
    return false;
  }
  function play(name, opts) { try { if (SQ.audio && typeof SQ.audio.play === 'function') return SQ.audio.play(name, opts); } catch (e) { /* ignore */ } return false; }
  function vibrate(ms) { try { if (setting('haptics', true) && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  const HOUR_SHIFT = new WeakMap();
  function missionHourShift(s) {
    if (!s || !s.missionId) return 0;
    if (HOUR_SHIFT.has(s)) return HOUR_SHIFT.get(s);
    const ms = (SQ.data.missions || []).find((x) => x.id === s.missionId);
    let shift = 0;
    const lab = ms && String(ms.clock || '').trim().toUpperCase();
    if (lab) {
      let base = NaN;
      if (lab === 'NOON') base = 12; else if (lab === 'MIDNIGHT') base = 24;
      else { const mm = lab.match(/^(\d{1,2})(?::(\d\d))?\s*(AM|PM)$/); if (mm) base = (+mm[1] % 12) + (mm[3] === 'PM' ? 12 : 0) + (mm[2] ? +mm[2] / 60 : 0); }
      const R = SQ.data.matchRules || {};
      const startHour = (R.startHour || 16) + (ms.startClock || 0) / (R.matchLength || 600) * (R.hoursPerMatch || 9);
      if (isFinite(base)) shift = base - startHour;
    }
    HOUR_SHIFT.set(s, shift);
    return shift;
  }
  function fmtHour(hour) {
    let h = Math.floor(hour), m = Math.floor((hour - h) * 60);
    const ap = (h % 24) >= 12 ? 'PM' : 'AM';
    let h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  }
  function fill(str, vars) { return SQ.data && SQ.data.text && SQ.data.text.fill ? SQ.data.text.fill(str, vars) : String(str); }
  function pick(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : ''; }

  /**
   * Pointer gesture helper: tap / double tap / long press / drag on one element.
   * h: {tap(e), double(e), long(e), dragStart(e), dragMove(e), dragEnd(e), longMs=500, dragPx=10}
   */
  function gesture(target, h) {
    const longMs = h.longMs || 500, dragPx = h.dragPx || 10;
    let down = null, timer = 0, lastTap = 0, dragging = false, longFired = false;
    function clear() { if (timer) { clearTimeout(timer); timer = 0; } }
    target.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button > 0) return;
      down = { x: e.clientX, y: e.clientY, id: e.pointerId };
      dragging = false; longFired = false;
      try { target.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (h.long) timer = setTimeout(() => { timer = 0; if (down && !dragging) { longFired = true; h.long(e); } }, longMs);
      if (h.press) h.press(true);
      e.stopPropagation();
    });
    target.addEventListener('pointermove', (e) => {
      if (!down || e.pointerId !== down.id) return;
      const d = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (!dragging && d > dragPx && h.dragStart && !longFired) { dragging = true; clear(); h.dragStart(e, down); }
      if (dragging && h.dragMove) h.dragMove(e);
    });
    const end = (e, cancel) => {
      if (!down || e.pointerId !== down.id) return;
      clear();
      if (h.press) h.press(false);
      if (dragging) { if (h.dragEnd) h.dragEnd(e, cancel); }
      else if (!longFired && !cancel) {
        const now = performance.now();
        if (h.double && now - lastTap < 320) { lastTap = 0; h.double(e); }
        else { lastTap = now; if (h.tap) h.tap(e); }
      }
      down = null; dragging = false;
      e.stopPropagation();
    };
    target.addEventListener('pointerup', (e) => end(e, false));
    target.addEventListener('pointercancel', (e) => end(e, true));
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Tiny line icons for the 13 landmarks (24x24, stroke = currentColor).
  const LM_ICON = {
    fountain: '<circle cx="12" cy="15" r="7"/><path d="M12 15V5M8.5 9.5Q12 3 15.5 9.5"/>',
    arch: '<path d="M4 21V5h16v16M9 21v-7a3 3 0 0 1 6 0v7M3 5h18"/>',
    chess: '<path d="M8 20h9M9 20l1-5-3-1 1-4 3-3 3 1 2 4-2 3 1 5"/>',
    grove: '<path d="M12 21v-6M12 15c-5 0-7-3-6-6 1-3 3-3 3-3 1-3 5-3 6 0 0 0 3 0 3 3 0 4-3 6-6 6z"/>',
    holley: '<circle cx="12" cy="8" r="3.4"/><path d="M7 21v-3a5 5 0 0 1 10 0v3M6 21h12"/>',
    garibaldi: '<circle cx="12" cy="5.5" r="2.3"/><path d="M12 8v7M9 21l3-6 3 6M8 11h8M16 11l3-4"/>',
    bigrun: '<circle cx="7" cy="9" r="1.8"/><circle cx="12" cy="7" r="1.8"/><circle cx="17" cy="9" r="1.8"/><path d="M8 17c0-3 2-5 4-5s4 2 4 5-2 3-4 3-4 0-4-3z"/>',
    playground: '<path d="M4 21V8l4-3 4 3v13M12 11l8 10M4 13h8"/>',
    smallrun: '<circle cx="9" cy="10" r="1.4"/><circle cx="12" cy="8.5" r="1.4"/><circle cx="15" cy="10" r="1.4"/><path d="M9.6 16c0-2 1.2-3.4 2.4-3.4s2.4 1.4 2.4 3.4-1.2 2-2.4 2-2.4 0-2.4-2z"/>',
    bobst: '<path d="M4 6h7a2 2 0 0 1 1 1v13a2 2 0 0 0-1-1H4zM20 6h-7a2 2 0 0 0-1 1v13a2 2 0 0 1 1-1h7z"/>',
    judson: '<path d="M12 3v2M8 21V9l4-4 4 4v12M6 21h12M10.5 14a1.5 1.5 0 0 1 3 0v3h-3z"/>',
    toddler: '<path d="M4 18h16M6 18c0-4 3-6 6-6s6 2 6 6M10 9a2 2 0 1 0 4 0 2 2 0 0 0-4 0"/>',
    playhills: '<path d="M2 19c3-6 6-8 9-4 2-4 6-6 11 4z"/>',
    home: '<path d="M4 11l8-7 8 7v9H4zM10 20v-5h4v5"/>',
    dosa: '<path d="M4 16h16l-2 4H6zM6 16c0-5 3-8 6-8s6 3 6 8"/>',
  };
  function lmIcon(id, size) {
    const k = id && id.indexOf('home_') === 0 ? 'home' : id;
    const s = size || 18;
    return '<svg class="lmi" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (LM_ICON[k] || LM_ICON.fountain) + '</svg>';
  }
  const ICON = {
    menu: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    map: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14"/></svg>',
    coin: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#ffd34d" stroke="#8a6a12" stroke-width="1.6"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="#c99a1e" stroke-width="1.2" stroke-dasharray="2 1.6"/><path d="M14.6 9.2a3.3 3.3 0 1 0 0 5.6" fill="none" stroke="#6b4e08" stroke-width="2" stroke-linecap="round"/></svg>',
    people: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 19.5c.5-4 3.2-6 6.5-6s6 2 6.5 6z"/><circle cx="16.5" cy="9" r="2.6" opacity=".7"/><path d="M16 13.6c2.9 0 5 1.8 5.5 5.4h-4.3c-.2-2-1-3.8-2.4-5.1z" opacity=".7"/></svg>',
    flag: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h14M13 6l6 6-6 6"/></svg>',
    eye: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    undo: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
    army: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="6" cy="9" r="2.4"/><circle cx="12" cy="7" r="2.6"/><circle cx="18" cy="9" r="2.4"/><path d="M1.8 18c.4-3 2.2-4.6 4.2-4.6 1 0 1.9.3 2.6 1-.9 1-1.4 2.2-1.6 3.6zM6.5 18c.5-3.8 2.8-6 5.5-6s5 2.2 5.5 6zM22.2 18c-.4-3-2.2-4.6-4.2-4.6-1 0-1.9.3-2.6 1 .9 1 1.4 2.2 1.6 3.6z"/></svg>',
  };
  const SETUP_ICON = {
    cart: '🌭', boombox: '📻', bench: '🪑', chessTable: '♞', tipJar: '🫙', clubFair: '🎓', waterBowl: '🥣',
  };

  /** Escape text and swap ● ▲ ■ for the white class shapes (chalk fonts draw ● as a tiny dot). */
  function glyphText(str, color) {
    const map = { '●': 'crowd', '▲': 'talker', '■': 'heavy' };
    return esc(str).replace(/[●▲■]/g, (c) => glyph(map[c], color || '#163a2b', '1.05em', 'inl'));
  }
  Object.assign(U, { el, esc, glyphText, setting, crewColor, facColor, glyph, project, toGround, jump, play, vibrate, fmtHour, fill, pick, gesture,
    lmIcon, ICON, SETUP_ICON, CLS_NAME, CLS_CHAR, CB_COLORS: CB, threeCamera, viewRect });

  // =========================================================================================
  // HUD
  // =========================================================================================
  const H = {
    root: null, match: null, game: null, visible: false, targeting: null,
    _t: 0, _slow: 0, _mini: 0, _card: 0, _subs: [], _els: {}, _alerts: [],
  };
  SQ.hud = H;

  const UFv = () => (SQ.C && SQ.C.UF) || {};
  const CLASSES = ['crowd', 'talker', 'heavy'];

  function st() { return H.match && H.match.state; }
  function me() { const s = st(); return s && s.player >= 0 ? s.factions[s.player] : null; }
  function myIdx() { const s = st(); return s ? s.player : -1; }
  function lmName(s, id) { const l = s && s.lmById && s.lmById[id]; return l ? l.name : (SQ.data.landmarkById[id] || {}).name || id; }
  function alpha() { return (SQ.game && SQ.game.alpha) || 0; }

  // ------------------------------------------------------------------ build DOM
  function build(root) {
    root.classList.add('sq-hud');
    root.innerHTML = '';
    const E = H._els = {};

    // --- top bar
    const top = E.top = el('div', 'h-top h-layer');
    const res = E.res = el('div', 'h-res');
    E.menuBtn = el('button', 'h-btn h-menu', ICON.menu);
    E.menuBtn.setAttribute('aria-label', 'Menu'); E.menuBtn.dataset.ui = 'menu';
    E.menuBtn.addEventListener('click', () => { U.play('open'); H.openPauseMenu(); });
    const money = el('div', 'h-money');
    money.dataset.ui = 'clout';
    money.innerHTML = '<span class="h-coin">' + ICON.coin + '</span><span class="h-clout">150</span><span class="h-income">+0.0/s</span>';
    E.clout = money.querySelector('.h-clout'); E.income = money.querySelector('.h-income'); E.money = money;
    const pop = E.pop = el('div', 'h-pop', ICON.people + '<span class="h-popv">0/20</span>');
    pop.dataset.ui = 'pop';
    E.popv = pop.querySelector('.h-popv');
    E.wom = el('div', 'h-wom', 'Word of Mouth');
    E.wom.title = 'You are 250+ Turf behind: recruits cost 20% less and you capture 25% faster.';
    const resStats = el('div', 'h-resstats');
    resStats.appendChild(money); resStats.appendChild(pop); resStats.appendChild(E.wom);
    res.appendChild(E.menuBtn); res.appendChild(resStats);

    const race = E.race = el('div', 'h-race');
    race.dataset.ui = 'turf';
    E.turf = el('div', 'h-turfs');
    E.clock = el('div', 'h-clock');
    E.clock.dataset.ui = 'clock';
    E.clock.innerHTML =
      '<svg class="h-arc" viewBox="0 0 120 44" aria-hidden="true">' +
      '<defs><linearGradient id="hArcG" x1="0" x2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset=".33" stop-color="#ffcf5a"/><stop offset=".45" stop-color="#ff9a3c"/><stop offset=".66" stop-color="#d9603b"/><stop offset=".72" stop-color="#5a6fb8"/><stop offset="1" stop-color="#2a3570"/></linearGradient></defs>' +
      '<path d="M8 40 A52 34 0 0 1 112 40" fill="none" stroke="url(#hArcG)" stroke-width="3.2" stroke-linecap="round" opacity=".95"/>' +
      '<path class="h-arc-ticks" d="M42 9.6v4 M78 9.6v4" stroke="#f4efe2" stroke-width="1.6" opacity=".55"/>' +
      '<g class="h-sun"><circle r="6.2" fill="#ffd34d" stroke="#fff6d0" stroke-width="1.4"/></g>' +
      '</svg><div class="h-time"><b>4:00 PM</b><span>Afternoon</span></div>';
    E.sun = E.clock.querySelector('.h-sun'); E.sunC = E.sun.querySelector('circle');
    E.time = E.clock.querySelector('.h-time b'); E.phase = E.clock.querySelector('.h-time span');
    E.obj = el('div', 'h-obj');
    race.appendChild(E.turf); race.appendChild(E.obj); race.appendChild(E.clock);

    const lms = E.lms = el('div', 'h-lms');
    lms.dataset.ui = 'landmarks';
    top.appendChild(res); top.appendChild(race); top.appendChild(lms);

    // --- feed (announcer + toasts + captions)
    E.feed = el('div', 'h-feed h-layer');
    E.ann = el('div', 'h-ann');
    E.toasts = el('div', 'h-toasts');
    E.captions = el('div', 'h-captions h-layer');
    E.ticker = el('div', 'h-ticker');
    E.feed.appendChild(E.ann); E.feed.appendChild(E.toasts); E.feed.appendChild(E.ticker);

    // --- world overlays (positioned each frame)
    E.world = el('div', 'h-world h-layer');
    E.arrows = el('div', 'h-arrows h-layer');
    E.ghost = el('div', 'h-ghost h-layer');
    E.ghost.innerHTML = '<svg width="100%" height="100%"><polyline class="gh-path" points=""/><line class="gh-line" x1="0" y1="0" x2="0" y2="0"/><circle class="gh-end" r="16" cx="-99" cy="-99"/><polygon class="gh-ring" points=""/></svg><div class="gh-label"></div>';
    E.ghPath = E.ghost.querySelector('.gh-path'); E.ghLine = E.ghost.querySelector('.gh-line');
    E.ghEnd = E.ghost.querySelector('.gh-end'); E.ghRing = E.ghost.querySelector('.gh-ring'); E.ghLabel = E.ghost.querySelector('.gh-label');

    // --- bottom bar
    const bottom = E.bottom = el('div', 'h-bottom h-layer');
    const squads = E.squads = el('div', 'h-squads');
    E.chips = el('div', 'h-chips');
    E.army = el('button', 'h-btn h-army', ICON.army + '<span>ARMY</span>');
    E.army.dataset.ui = 'army';
    E.army.setAttribute('aria-label', 'Select all combat units');
    E.army.addEventListener('click', () => { selectArmy(); });
    E.newSquad = el('button', 'h-btn h-newsq', ICON.plus + '<span>Squad</span>');
    E.newSquad.title = 'Make the selection a new squad';
    E.newSquad.addEventListener('click', () => assignNewSquad());
    squads.appendChild(E.army); squads.appendChild(E.chips); squads.appendChild(E.newSquad);

    const rec = E.recruit = el('div', 'h-recruit');
    E.rbtn = {};
    for (const cls of CLASSES) {
      const b = el('button', 'h-rbtn r-' + cls);
      b.dataset.ui = 'recruit.' + cls;
      b.innerHTML = '<span class="rb-glyph"></span><span class="rb-name"></span><span class="rb-cost"><i class="rb-coin"></i><b></b></span><span class="rb-q"></span><span class="rb-prog"><i></i></span><span class="rb-key"></span>';
      b.querySelector('.rb-coin').innerHTML = ICON.coin;
      b.querySelector('.rb-key').textContent = { crowd: 'Z', talker: 'X', heavy: 'C' }[cls];
      gesture(b, {
        tap: () => recruit(cls),
        long: () => showStatCard(cls, b),
        press: (on) => b.classList.toggle('pressed', on),
        longMs: 450,
      });
      b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') H._hoverT = setTimeout(() => showStatCard(cls, b, true), 650); });
      b.addEventListener('pointerleave', () => { clearTimeout(H._hoverT); if (H._statHover) hideStatCard(); });
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); recruit(cls); } });
      E.rbtn[cls] = { b, glyph: b.querySelector('.rb-glyph'), name: b.querySelector('.rb-name'), cost: b.querySelector('.rb-cost b'), q: b.querySelector('.rb-q'), prog: b.querySelector('.rb-prog i') };
      rec.appendChild(b);
    }

    const act = E.actions = el('div', 'h-actions');
    E.pauseBtn = el('button', 'h-btn h-pause', ICON.pause);
    E.pauseBtn.dataset.ui = 'pause';
    E.pauseBtn.setAttribute('aria-label', 'Tactical pause');
    E.pauseBtn.addEventListener('click', () => tacticalPause());
    E.crew = el('button', 'h-crew');
    E.crew.dataset.ui = 'crew';
    E.crew.innerHTML = '<svg class="cc-ring" viewBox="0 0 64 64"><circle class="cc-bg" cx="32" cy="32" r="28"/><circle class="cc-fg" cx="32" cy="32" r="28"/></svg><span class="cc-label">CREW<br>CALL</span><span class="cc-pct">30%</span>';
    E.ccFg = E.crew.querySelector('.cc-fg'); E.ccLabel = E.crew.querySelector('.cc-label'); E.ccPct = E.crew.querySelector('.cc-pct');
    E.crew.addEventListener('click', () => { if (H.targeting) H.cancelCrewCall(); else H.beginCrewCall(); });
    E.mapBtn = el('button', 'h-btn h-mapbtn', ICON.map);
    E.mapBtn.setAttribute('aria-label', 'Toggle minimap');
    E.mapBtn.addEventListener('click', () => { U.play('click'); H.setMinimap(!H._miniOn); });
    act.appendChild(E.mapBtn); act.appendChild(E.pauseBtn); act.appendChild(E.crew);
    bottom.appendChild(squads); bottom.appendChild(rec); bottom.appendChild(act);

    // --- minimap
    E.mini = el('div', 'h-mini h-layer');
    E.mini.dataset.ui = 'minimap';
    E.miniC = el('canvas', 'h-minic');
    E.mini.appendChild(E.miniC);
    miniInput(E.miniC);

    // --- tactical pause banner, big banners, card, stat card, radial, modal, targeting layer
    E.paused = el('div', 'h-paused h-layer', '<b>TACTICAL PAUSE</b><span>Orders still work. Tap ▶ to resume.</span>');
    E.banner = el('div', 'h-banner h-layer');
    E.card = el('div', 'h-card');
    E.card.setAttribute('role', 'dialog');
    E.stat = el('div', 'h-stat h-layer');
    E.radial = el('div', 'h-radial');
    E.modal = el('div', 'h-modal');
    E.target = el('div', 'h-target');
    E.target.innerHTML = '<div class="tg-bar"><span class="tg-text"></span><button class="h-btn tg-cancel">Cancel</button></div>';
    E.tgText = E.target.querySelector('.tg-text');
    E.target.querySelector('.tg-cancel').addEventListener('click', (e) => { e.stopPropagation(); H.cancelCrewCall(); });
    targetInput(E.target);
    E.radial.addEventListener('pointerdown', (e) => { if (e.target === E.radial) closeRadial(); });

    for (const k of ['world', 'arrows', 'ghost', 'feed', 'captions', 'top', 'mini', 'target', 'bottom', 'paused', 'banner', 'card', 'stat', 'radial', 'modal']) root.appendChild(E[k]);
    applySettings();
  }

  // ------------------------------------------------------------------ settings
  function applySettings() {
    if (!H.root) return;
    const r = H.root;
    r.classList.toggle('lefty', !!setting('leftHanded', false));
    r.classList.toggle('cb', !!setting('colorblind', false));
    let on = setting('minimap', null);
    if (on === null || on === undefined) on = window.innerWidth >= 900;
    H.setMinimap(on, true);
  }

  // ------------------------------------------------------------------ lifecycle
  H.init = function (a, game) {
    if (!hasDoc) return;
    let root = null, match = null;
    if (a && a.nodeType === 1) root = a;
    else if (a && a.state) match = a;
    if (!root) root = document.getElementById('hud');
    if (!root) return;
    if (H.root !== root) { H.root = root; build(root); }
    if (game) H.game = game;
    if (!H._subscribed) subscribe();
    if (match) H.setMatch(match);
    else H.setMatch(SQ.game && SQ.game.match || null);
  };

  H.setMatch = function (m) {
    if (!H.root) { if (m && hasDoc) H.init(document.getElementById('hud')); if (!H.root) return; }
    H.match = m || null;
    H._alerts = []; H._lastAnnLm = {}; H._annQ = []; H._annCur = null; H._annNext = 0;
    H._bubbles && H._bubbles.forEach((b) => b.el.remove()); H._bubbles = [];
    H._toastList && H._toastList.forEach((t) => t.el.remove()); H._toastList = [];
    H._lmChipKey = ''; H._squadKey = ''; H._turfKey = ''; H._objTxt = null;
    H._els.ann.innerHTML = ''; H._els.captions.innerHTML = ''; H._els.ticker.innerHTML = ''; H._els.banner.innerHTML = '';
    H.closeCard(); closeRadial(); hideStatCard(); H.closePauseMenu(true);
    if (H.targeting) H.cancelCrewCall(true);
    H._miniStatic = null;
    H.visible = !!m;
    H.root.classList.toggle('on', !!m);
    H.root.classList.remove('over');
    if (m) {
      const s = m.state, p = me();
      H.root.dataset.crew = p ? p.key : '';
      H.root.style.setProperty('--me', facColor(p));
      // crew-specific labels
      const units = p && SQ.data.units[p.key];
      for (const cls of CLASSES) {
        const r = H._els.rbtn[cls];
        const t = units && units[cls];
        r.glyph.innerHTML = glyph(cls, facColor(p), 26);
        r.name.textContent = t ? shortName(t) : CLS_NAME[cls];
        r.b.setAttribute('aria-label', 'Recruit ' + (t ? t.name : cls));
      }
      const cc = p && SQ.data.factions[p.key].crewCall;
      H._els.crew.style.display = !cc || cc.target === 'none' ? 'none' : '';
      H._els.ccLabel.innerHTML = cc ? esc(cc.name.toUpperCase()) : 'CREW<br>CALL';
      H._els.crew.setAttribute('aria-label', 'Crew Call: ' + (cc ? cc.name : ''));
      H._els.paused.classList.remove('show');
      H.update(m, 0, true);
      drawMiniStatic();
    }
  };

  H.destroy = function () {
    unsubscribe();
    if (H.root) { H.root.innerHTML = ''; H.root.classList.remove('sq-hud', 'on'); }
    H.root = null; H.match = null; H.visible = false;
  };

  function shortName(t) {
    const n = t.name;
    const map = { 'Small-Dog Walkers': 'Dog Walkers', 'Tambourine Kids': 'Tambourines', 'Ball-Launcher Dad': 'Launcher Dad', 'Pro Dog Walker': 'Pro Walker', 'Speed Hustler': 'Speed Hustler', 'Bucket Drummer': 'Bucket Drums' };
    return map[n] || n;
  }

  // ------------------------------------------------------------------ bus
  function on(name, fn) { if (SQ.bus) { SQ.bus.on(name, fn); H._subs.push([name, fn]); } }
  function unsubscribe() { if (SQ.bus) for (const [n, f] of H._subs) SQ.bus.off(n, f); H._subs = []; H._subscribed = false; }
  function subscribe() {
    H._subscribed = true;
    const ifm = (fn) => (p) => { if (H.match) fn(p || {}); };
    on('matchStart', ifm(() => {
      const s = st();
      if (s && s.missionId) return;
      H.announce(pick(SQ.data.text.announcer.start), 1, 'start');
    }));
    on('capture', ifm(onCapture));
    on('contested', ifm((p) => onThreat(p, 'contested')));
    on('underAttack', ifm((p) => onThreat(p, 'underAttack')));
    on('neutral', ifm((p) => {
      if (p.from === myIdx()) H.announce(fill(SQ.data.text.announcer.neutral, { LM: lmName(st(), p.lm) }), 1, 'neutral');
    }));
    on('overIt', ifm(onOverIt));
    on('squadWiped', ifm((p) => {
      const mine = myIdx();
      if (p.faction === mine) H.banner(p.word || 'SCHOOLED!', '#e8e1cf', 'Your squad left the park', 'wipe bad');
      else if (p.by === mine) H.banner(p.word || 'SCHOOLED!', facColor(me()), null, 'wipe');
    }));
    on('crewCall', ifm((p) => {
      const s = st(); const fac = s.factions[p.faction];
      const cc = fac && SQ.data.factions[fac.key].crewCall;
      if (!cc) return;
      if (p.faction === myIdx()) {
        H.banner(cc.name.toUpperCase() + '!', facColor(fac), null, 'crew');
        U.vibrate(15);
        if (H.targeting) H.cancelCrewCall(true);
      } else {
        H.announce(fill(SQ.data.text.announcer.crewCall, { CREW: fac.name, CALL: cc.name }), 2, 'crewCall');
      }
      caption(captionFor('crew', cc.id));
    }));
    on('crewReady', ifm((p) => {
      if (p.faction !== myIdx()) return;
      const cc = SQ.data.factions[me().key].crewCall;
      H.announce('Crew Call ready: ' + cc.name + '!', 1, 'crewReady');
    }));
    on('eventWarn', ifm((p) => eventToast(p, 'warn')));
    on('eventStart', ifm((p) => { eventToast(p, 'start'); caption(captionFor('event', p.kind)); }));
    on('eventEnd', ifm((p) => endEventToast(p)));
    on('phase', ifm((p) => {
      const txt = SQ.data.text.announcer.phase[p.phase];
      if (txt) H.announce(txt, 2, 'phase');
      H.banner((p.name || p.phase).toUpperCase(), p.phase === 'night' ? '#9fb4ff' : '#ffcf5a', U.fmtHour(st().hour + missionHourShift(st())), 'phase');
      H._els.clock.classList.remove('warn');
    }));
    on('phaseWarn', ifm((p) => {
      const txt = SQ.data.text.announcer.phaseWarn[p.phase];
      if (txt) H.announce(txt, 2, 'phaseWarn');
      H._els.clock.classList.add('warn');
    }));
    on('recruited', ifm((p) => {
      if (p.faction !== myIdx()) return;
      const r = H._els.rbtn[p.cls];
      if (r) { r.b.classList.remove('ready'); void r.b.offsetWidth; r.b.classList.add('ready'); }
    }));
    on('queued', ifm((p) => { if (p.faction === myIdx()) floatText(H._els.money, '-' + p.cost, 'neg'); }));
    on('built', ifm((p) => {
      if (p.faction !== myIdx()) return;
      const S = SQ.data.setups[p.setup];
      H.announce(fill(SQ.data.text.announcer.built, { SETUP: S ? S.name : p.setup, LM: lmName(st(), p.lm) }), 0, 'built');
    }));
    on('clout', ifm((p) => {
      if (p.faction !== myIdx() || !p.amount) return;
      if (p.amount < 0) {
        floatText(H._els.money, String(Math.round(p.amount)), 'neg');
        if (p.reason === 'heist') H.announce('Squirrels stole ' + Math.round(-p.amount) + ' Clout from a Food Cart!', 2, 'heist');
      } else if (p.amount >= 1) floatText(H._els.money, '+' + Math.round(p.amount), 'pos');
    }));
    on('comeback', ifm((p) => {
      const s = st(); const fac = s.factions[p.faction];
      if (!p.on || !fac) return;
      if (p.faction === myIdx()) H.announce('Word of Mouth: you are rallying - recruits 20% cheaper, captures 25% faster.', 2, 'comeback');
    }));
    on('eliminated', ifm((p) => {
      const fac = st().factions[p.faction];
      if (fac) H.announce(fill(SQ.data.text.announcer.eliminated, { CREW: fac.name }), 3, 'eliminated');
    }));
    on('suddenDeath', ifm(() => H.banner('SUDDEN DEATH', '#ffd34d', 'Hold the Fountain - 60 seconds', 'phase')));
    on('announce', ifm((p) => H.announce(p.text, p.kind === 'suddenDeath' || p.kind === 'closingSoon' ? 3 : 2, p.kind)));
    on('aiBark', ifm(onBark));
    on('assist', ifm((p) => {
      if (p.faction === myIdx()) H.announce('Assist: ' + p.n + ' idle unit' + (p.n === 1 ? '' : 's') + ' heading to defend ' + lmName(st(), p.lm) + '.', 0, 'assist');
    }));
    on('dosa', ifm((p) => { if (p.faction === myIdx()) H.announce('Dosas all round! ' + p.n + ' units get +20% Sway for 20 s.', 1, 'dosa'); }));
    on('shoo', ifm((p) => { if (p.faction === myIdx()) H.announce('Shoo! +' + (p.amount || 5) + ' Clout.', 0, 'shoo'); }));
    on('rally', ifm((p) => {
      if (p.faction !== myIdx()) return;
      const lm = st().lmById[p.lm];
      H.announce(lm && lm.isHome ? 'Recruits gather at home again.' : 'Rally point set: ' + lmName(st(), p.lm) + '.', 0, 'rally');
      if (H._cardId === p.lm) refreshCard(true);
    }));
    on('cmdRejected', ifm(onRejected));
    // input.js integration
    on('selection', () => { H._squadKey = ''; });
    on('crewMode', ifm((p) => {
      if (p.on) {
        H.targeting = p.kind || 'point';
        H._els.crew.classList.add('aiming');
        const cc = me() && SQ.data.factions[me().key].crewCall;
        H._els.tgText.textContent = crewInstruction(H.targeting, cc ? cc.name : p.name || 'Crew Call');
        H._els.target.classList.add('show', 'barOnly');
      } else if (!H._tg) {
        H.targeting = null;
        H._els.crew.classList.remove('aiming');
        H._els.target.classList.remove('show', 'barOnly');
      }
    }));
    on('inputDenied', ifm((p) => {
      const r = String(p.reason || '');
      if (r === 'crew:charging') H.toast('Crew Call charging: ' + Math.floor(me().crew) + '%. Hold landmarks and send rivals home to charge it.', { icon: '⏳', life: 2.4, key: 'deny' });
    }));
    on('inspect', ifm((p) => { if (p.hover) { if (p.unit === null || p.unit === undefined) hideInspect(true); else H.showUnit(p.unit, { x: p.x, y: p.y, hover: true }); } }));
    on('victory', ifm(onVictory));
    on('gamePause', (p) => {
      if (!H.root) return;
      H._els.paused.classList.toggle('show', !!(p && p.paused) && !H._modalOpen);
      H._els.pauseBtn.innerHTML = p && p.paused ? ICON.play : ICON.pause;
      H._els.pauseBtn.classList.toggle('active', !!(p && p.paused));
    });
    on('settings', () => { applySettings(); if (H.match) { H._squadKey = ''; H._lmChipKey = ''; H._turfKey = ''; H.setMatch(H.match); } });
    on('landmarkTap', (p) => { if (H.match && p && p.lm !== undefined) H.openLandmark(p.lm); });
    on('uiOpenLandmark', (p) => { if (H.match && p && p.lm !== undefined) H.openLandmark(p.lm); });
    if (hasDoc) {
      window.addEventListener('keydown', onKey);
      window.addEventListener('resize', () => { H._miniStatic = null; drawMiniStatic(); });
    }
  }

  function onKey(e) {
    if (!H.match || !H.root) return;
    if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
    const k = e.key;
    if (k === 'Escape') {
      if (H._radialOpen) { closeRadial(); e.preventDefault(); return; }
      if (H.targeting) { H.cancelCrewCall(); e.preventDefault(); return; }
      if (H._cardId) { H.closeCard(); e.preventDefault(); return; }
      if (H._modalOpen) { H.closePauseMenu(); e.preventDefault(); return; }
      if (!SQ.input) { H.openPauseMenu(); e.preventDefault(); }
      return;
    }
    if (SQ.input) return; // input.js owns the game keys
    const lower = k.toLowerCase();
    if (lower === 'z') recruit('crowd');
    else if (lower === 'x') recruit('talker');
    else if (lower === 'c') recruit('heavy');
    else if (lower === 'f') { if (H.targeting) H.cancelCrewCall(); else H.beginCrewCall(); }
    else if (lower === 'p') tacticalPause();
    else if (lower === 'm') H.setMinimap(!H._miniOn);
    else if (k === '`') selectArmy();
    else if (k >= '1' && k <= '5') selectSquad(+k);
  }

  // ------------------------------------------------------------------ event handlers
  function onCapture(p) {
    const s = st(), mine = myIdx();
    const lm = s.lmById[p.lm];
    const fxTitles = !!SQ.fx;
    if (p.to === mine) {
      // the floating 3D title comes from fx; the HUD adds a banner only without fx, plus a stolen-Setups line
      if (!fxTitles) H.banner(p.title || ('YOU TAKE ' + lmName(s, p.lm).toUpperCase()), facColor(me()), stolenText(p), 'capture');
      else if (stolenText(p)) H.announce(stolenText(p) + ' They pay you now.', 2, 'stolen');
      U.vibrate(15);
    } else if (p.from === mine) {
      H.announce(fill(SQ.data.text.announcer.lost, { LM: lmName(s, p.lm) }), 2, 'lost');
      const lostN = (p.setups || []).filter((x) => x.from === mine).length;
      if (lostN) H.announce('Your ' + lostN + ' Setup' + (lostN > 1 ? 's' : '') + ' there now pay them.', 1, 'lost');
    } else {
      const fac = s.factions[p.to];
      if (fac) H.announce(fill(SQ.data.text.announcer.capture, { CREW: fac.name, LM: lm ? lm.name : p.lm }), 0, 'capture');
    }
    if (H._cardId === p.lm) refreshCard(true);
  }
  function stolenText(p) {
    const n = (p.setups || []).filter((x) => x.from >= 0 && x.from !== p.to).length;
    return n ? 'Stole ' + n + ' Setup' + (n > 1 ? 's' : '') + '!' : null;
  }
  function onThreat(p, kind) {
    const s = st(), mine = myIdx();
    if (p.faction !== mine) return;
    const now = s.t;
    H._alerts.push({ x: p.x, z: p.z, lm: p.lm, t: now });
    if (H._alerts.length > 8) H._alerts.shift();
    const last = H._lastAnnLm[p.lm] || -99;
    if (now - last > 12) {
      H._lastAnnLm[p.lm] = now;
      H.announce(fill(SQ.data.text.announcer.contested, { LM: lmName(s, p.lm) }), 2, kind);
      caption('[car horn] ' + lmName(s, p.lm) + ' under attack');
    }
  }
  function onOverIt(p) {
    const mode = setting('bubbles', 'on');
    if (mode === 'off' || !p.line) return;
    const s = st();
    const mineUnit = p.faction === myIdx();
    if (!mineUnit && SQ.World && SQ.World.isVisible && s.player >= 0) {
      try { if (!SQ.World.isVisible(s, s.player, p.x, p.z)) return; } catch (e) { /* ignore */ }
    }
    const fac = s.factions[p.faction];
    if (mode === 'text') { tickerLine((fac ? fac.short : '') + ': "' + p.line + '"', facColor(fac)); return; }
    H.bubble({ unit: p.unit, x: p.x, z: p.z, text: p.line, color: facColor(fac), kind: 'exit' });
  }
  function onBark(p) {
    const s = st();
    const fac = s.factions[p.faction];
    if (!fac || !p.text) return;
    const mode = setting('bubbles', 'on');
    const line = '<b style="color:' + facColor(fac) + '">' + esc(fac.short) + ':</b> ' + esc(p.text);
    if (mode !== 'on') { tickerLine(line, null, true); return; }
    // anchor on that crew's unit nearest to the landmark it is talking about (or its first unit)
    const u = s.units;
    const lm = p.lm && s.lmById[p.lm];
    let best = -1, bd = Infinity;
    const UF = UFv();
    for (let i = 0; i < u.n; i++) {
      if (u.faction[i] !== p.faction || (u.flags[i] & UF.OVERIT)) continue;
      const d = lm ? Math.hypot(u.x[i] - lm.x, u.z[i] - lm.z) : i;
      if (d < bd) { bd = d; best = i; }
    }
    const ax = best >= 0 ? u.x[best] : lm ? lm.x : null, az = best >= 0 ? u.z[best] : lm ? lm.z : null;
    const pr = ax !== null ? project(ax, 3, az) : null;
    // on screen: a speech bubble; off screen: a line in the feed so the bark is never lost
    if (pr && pr.on) H.bubble({ unit: best >= 0 ? u.id[best] : undefined, x: ax, z: az, text: p.text, color: facColor(fac), kind: 'bark' });
    else tickerLine(line, null, true);
  }
  const REJECT_TEXT = {
    clout: 'Not enough Clout', pop: 'Pop cap reached - take landmarks or build a Bench Cluster', queue: 'Recruit queue is full (5)',
    noPad: 'No free build pad here', notOwned: 'You need to hold this landmark', oneSpecial: 'Only one special Setup per landmark',
    notHome: 'Specials can\'t go on a Home Spot', notAllowed: 'Rally only at home or a held landmark within 90 m of it',
    charging: 'Crew Call is still charging', target: 'Pick a valid target', units: 'No units selected', cooldown: 'Not yet - cooling down',
    far: 'Get your units within 20 m of the cart first', range: 'Get closer first', unreachable: 'They can\'t get there',
  };
  function onRejected(p) {
    if (p.faction !== myIdx()) return;
    const txt = REJECT_TEXT[p.reason] || ('Can\'t do that (' + p.reason + ')');
    U.play('deny');
    H.toast(txt, { icon: '✋', life: 2.2, kind: 'deny', key: 'deny' });
  }
  function shake(e) { e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); }
  function onVictory(p) {
    const s = st();
    H.root.classList.add('over');
    H.cancelCrewCall(true); H.closeCard(); closeRadial();
    const fac = s.factions[p.winner];
    if (p.playerWon) H.banner(fill(SQ.data.text.announcer.victory, { CREW: (fac ? fac.name : '').toUpperCase() }), facColor(fac), reasonText(p.reason), 'victory');
    else if (fac) H.banner(fill(SQ.data.text.announcer.victory, { CREW: fac.name.toUpperCase() }), facColor(fac), SQ.data.text.announcer.defeat, 'victory lose');
    else H.banner('PARK CLOSED', '#e8e1cf', 'Nobody wins. Everybody goes home.', 'victory');
  }
  function reasonText(r) {
    return { turf: 'First to the Turf target', clock: 'Most Turf at closing time', suddenDeath: 'Sudden death at the Fountain', elimination: 'Last crew in the park', mission: 'Mission complete' }[r] || '';
  }
  function captionFor(kind, id) {
    if (!setting('captions', false)) return null;
    const ev = { piano: '[piano music]', pigeonLady: '[a hundred pigeons cooing]', squirrelHeist: '[squirrels chittering]', pep: '[radio chatter: Parks Enforcement]',
      tourists: '[tour guide on a megaphone]', shower: '[thunder, rain]', iceCream: '[ice cream truck jingle]', bells: '[church bells]', graduation: '[cheering, pomp and circumstance]' };
    const cc = { tournament: '[chess clock ding]', drumCircle: '[drum circle]', groupChat: '[phones buzzing]', zoomies: '[barking, paws]' };
    return kind === 'event' ? ev[id] : cc[id];
  }
  function caption(text) {
    if (!text || !setting('captions', false) || !H.root) return;
    const c = el('div', 'h-cap', esc(text));
    H._els.captions.appendChild(c);
    while (H._els.captions.children.length > 3) H._els.captions.firstChild.remove();
    setTimeout(() => c.remove(), 3500);
  }
  function tickerLine(html, color, raw) {
    const t = el('div', 'h-tick', raw ? html : esc(html));
    if (color) t.style.borderLeftColor = color;
    H._els.ticker.appendChild(t);
    while (H._els.ticker.children.length > 2) H._els.ticker.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 4200);
    setTimeout(() => t.remove(), 4800);
  }

  // ------------------------------------------------------------------ announcer
  H.announce = function (text, pri, kind) {
    if (!text || !H.root) return;
    pri = pri === undefined ? 1 : pri;
    const now = performance.now() / 1000;
    if (H._annQ.some((a) => a.text === text) || (H._annCur && H._annCur.text === text)) return;
    H._annQ.push({ text, pri, kind, t: now });
    H._annQ.sort((a, b) => b.pri - a.pri || a.t - b.t);
    if (H._annQ.length > 6) H._annQ.length = 6;
    if (pri >= 3 && H._annCur && H._annCur.pri < 3) H._annNext = 0;
  };
  function updateAnnouncer() {
    const now = performance.now() / 1000;
    if (H._annCur && now - H._annCur.shown > 4.4) {
      H._annCur.el.classList.add('out');
      const old = H._annCur.el; setTimeout(() => old.remove(), 400);
      H._annCur = null;
    }
    H._annQ = H._annQ.filter((a) => a.pri >= 3 || now - a.t < 10);
    if (H._annQ.length && now >= H._annNext) {
      const a = H._annQ.shift();
      if (H._annCur) { const old = H._annCur.el; old.classList.add('out'); setTimeout(() => old.remove(), 400); }
      a.el = el('div', 'ann k-' + (a.kind || 'x') + ' p' + a.pri, esc(a.text));
      a.shown = now;
      H._els.ann.appendChild(a.el);
      H._annCur = a;
      H._annNext = now + (a.pri >= 3 ? 3 : 6);
    }
  }

  // ------------------------------------------------------------------ toasts
  H.toast = function (text, o) {
    if (!H.root) return null;
    o = o || {};
    if (o.key) { const old = H._toastList.find((t) => t.key === o.key); if (old) removeToast(old); }
    const t = { key: o.key, until: o.until, life: o.life || 4, born: performance.now() / 1000, eventId: o.eventId, kind: o.kind };
    t.el = el('div', 'toast ' + (o.kind ? 't-' + o.kind : ''));
    t.el.innerHTML = (o.icon ? '<span class="t-ic">' + esc(o.icon) + '</span>' : '') + '<span class="t-tx">' + (o.html ? text : esc(text)) + '</span><span class="t-cd"></span>';
    t.cd = t.el.querySelector('.t-cd');
    if (o.action) {
      const b = el('button', 'h-btn t-act', esc(o.action.label));
      b.addEventListener('click', (e) => { e.stopPropagation(); U.play('click'); o.action.fn(); if (o.action.close) removeToast(t); });
      t.el.appendChild(b);
    }
    H._els.toasts.appendChild(t.el);
    H._toastList.push(t);
    while (H._toastList.length > 3) removeToast(H._toastList[0]);
    return t;
  };
  function removeToast(t) {
    const i = H._toastList.indexOf(t);
    if (i >= 0) H._toastList.splice(i, 1);
    t.el.classList.add('out');
    setTimeout(() => t.el.remove(), 300);
  }
  function updateToasts() {
    const now = performance.now() / 1000, s = st();
    for (const t of H._toastList.slice()) {
      if (t.eventId !== undefined && s) {
        const ev = (s.events || []).find((e) => e.id === t.eventId);
        if (ev) {
          const left = ev.state === 'warn' ? ev.startAt - s.t : ev.endAt - s.t;
          t.cd.textContent = isFinite(left) && left > 0 ? Math.ceil(left) + 's' : '';
          if (ev.state === 'done') removeToast(t);
          continue;
        }
        if (now - t.born > 12) removeToast(t);
        continue;
      }
      if (now - t.born > t.life) removeToast(t);
    }
  }
  function eventToast(p, phase) {
    const def = SQ.data.events[p.kind] || {};
    const s = st();
    const lmId = p.lm || (s.events || []).find((e) => e.id === p.id) && (s.events.find((e) => e.id === p.id).lm);
    let place = lmId ? lmName(s, lmId) : '';
    if (!place && p.kind === 'piano' && def.spots) {
      let best = def.spots[0], bd = Infinity;
      for (const sp of def.spots) { const d = Math.hypot(sp.x - (p.x || 0), sp.z - (p.z || 0)); if (d < bd) { bd = d; best = sp; } }
      place = best.name;
    }
    if (!place) place = 'the park';
    const text = fill(phase === 'warn' ? def.toast || def.name : def.start || def.name, { PLACE: place });
    const hasPos = isFinite(p.x) && isFinite(p.z);
    H.toast('<b>' + esc(def.name || p.kind) + '</b> ' + esc(text), {
      html: true, icon: def.icon || '!', eventId: p.id, key: 'ev' + p.id, kind: 'event ' + phase,
      action: hasPos ? { label: 'Go there', fn: () => U.jump(p.x, p.z) } : null,
    });
  }
  function endEventToast(p) {
    const t = H._toastList.find((x) => x.key === 'ev' + p.id);
    if (t) removeToast(t);
  }
  // input.js hooks: undo toast after every order (DESIGN §5.2)
  H.showUndo = function (n, fn) {
    H.toast('Order sent' + (n > 1 ? ' to ' + n + ' units' : ''), {
      icon: '➜', life: 2.2, key: 'undo', kind: 'undo',
      action: { label: '↶ Undo', close: true, fn: () => { try { (fn || (SQ.input && SQ.input.undo))(); } catch (e) { /* ignore */ } } },
    });
  };
  H.hideUndo = function () {
    const t = H._toastList && H._toastList.find((x) => x.key === 'undo');
    if (t) removeToast(t);
  };
  /** Close the card / radial / stat card / inspect popover. Returns true if anything was open. */
  H.closeCards = function () {
    const any = !!(H._cardId || H._radialOpen || (H._els.stat && H._els.stat.classList.contains('show')) || H._inspectId !== undefined && H._inspectId !== null);
    if (H._radialOpen) closeRadial();
    if (H._cardId) H.closeCard();
    hideStatCard(); hideInspect();
    return any;
  };
  /** Close only the small popovers (recruit stat card, unit inspect) - e.g. when a new coach hint arrives. */
  H.closePopovers = function () { hideStatCard(); hideInspect(); };
  H.showLandmark = function (id, opts) {
    H.openLandmark(id);
    if (opts && opts.build) H.openBuild(id, opts.pad);
  };
  H.openBuild = function (id, pad) {
    if (!H.match) return;
    const s = st(), lm = s.lmById[id] || s.landmarks[id];
    if (!lm) return;
    H.openLandmark(lm.id);
    let k = pad;
    if (k === undefined || k === null || k < 0 || (lm.pads[k] && lm.pads[k].setup >= 0)) k = lm.pads.findIndex((p) => p.setup < 0);
    if (k < 0) return;
    const b = H._els.card.querySelector('[data-pad="' + k + '"]');
    if (b && !b.disabled) openRadial(lm, k, b);
  };
  function crewInstruction(mode, name) {
    const n = String(name || '').toUpperCase();
    return mode === 'line' ? 'Swipe a line through them to unleash ' + n : mode === 'landmark' ? 'Tap a landmark you hold for ' + n : 'Tap a spot for ' + n;
  }

  // unit inspect popover ("Weak to: ■"), from input.js showUnit() or 'inspect' hover events
  H.showUnit = function (unitId, o) {
    if (!H.match || !H.root) return;
    o = o || {};
    const s = st();
    const i = SQ.World.unitIndex(s, unitId);
    if (i < 0) return hideInspect();
    const u = s.units, fac = s.factions[u.faction[i]];
    const t = SQ.data.unitTypes[u.type[i]] || {};
    const cls = SQ.C.CLASSES[u.cls[i]];
    const mine = u.faction[i] === myIdx();
    // verdict vs. the current selection (plurality class)
    let verdict = '';
    if (!mine) {
      const sel = H.getSelection();
      const cnt = [0, 0, 0];
      for (const id of sel) { const j = SQ.World.unitIndex(s, id); if (j >= 0) cnt[u.cls[j]]++; }
      const best = cnt.indexOf(Math.max.apply(null, cnt));
      if (sel.length && cnt[best] > 0) {
        const mc = SQ.C.CLASSES[best];
        const m = SQ.data.counter[mc][cls];
        verdict = m > 1.01 ? '<span class="in-v good">▲ Good matchup for your ' + CLS_CHAR[mc] + '</span>' : m < 0.99 ? '<span class="in-v bad">▼ Bad matchup - walk away</span>' : '<span class="in-v">Even matchup</span>';
      }
    }
    const pop = H._els.inspect || (H._els.inspect = H.root.appendChild(el('div', 'h-inspect h-layer')));
    const hp = Math.max(0, u.hp[i] / Math.max(1, u.maxHp[i]));
    pop.innerHTML = '<div class="in-h">' + glyph(cls, facColor(fac), 26) + '<div><b>' + esc(t.single || t.name || cls) + '</b><small style="color:' + facColor(fac) + '">' + esc(fac ? fac.name : '') + (u.flags[i] & UFv().REGULAR ? ' · regular' : '') + '</small></div></div>' +
      '<div class="in-bar"><i style="width:' + Math.round(hp * 100) + '%"></i></div>' +
      (mine ? '' : '<div class="in-w">Weak to: ' + glyph(SQ.data.weakTo[cls], '#b0342b', 18) + '<span>Beats ' + glyph(SQ.data.beats[cls], '#2f7a46', 16) + '</span></div>') + verdict;
    const hr = H.root.getBoundingClientRect();
    const x = (o.x !== undefined ? o.x : hr.width / 2) - hr.left, y = (o.y !== undefined ? o.y : hr.height / 2) - hr.top;
    pop.style.left = Math.max(8, Math.min(hr.width - 228, x + 14)) + 'px';
    pop.style.top = Math.max(8, Math.min(hr.height - 140, y - 110)) + 'px';
    pop.classList.add('show');
    H._inspectId = unitId;
    clearTimeout(H._inspectT);
    if (!o.hover) H._inspectT = setTimeout(hideInspect, 2600);
  };
  function hideInspect(fromHover) {
    if (!H._els || !H._els.inspect) return;
    if (fromHover && H._inspectT && H._inspectT._sticky) return;
    H._els.inspect.classList.remove('show');
    H._inspectId = null;
  }

  // ------------------------------------------------------------------ banners and floating text
  H.banner = function (text, color, sub, kind) {
    if (!H.root) return;
    const b = el('div', 'ban ' + (kind || ''));
    b.innerHTML = '<div class="ban-t">' + esc(text) + '</div>' + (sub ? '<div class="ban-s">' + esc(sub) + '</div>' : '');
    if (color) b.style.setProperty('--ban', color);
    const box = H._els.banner;
    if (!/victory/.test(kind || '')) while (box.children.length) box.firstChild.remove();
    box.appendChild(b);
    const life = /victory/.test(kind || '') ? 60000 : /phase/.test(kind || '') ? 2600 : 2200;
    setTimeout(() => b.classList.add('out'), life);
    setTimeout(() => b.remove(), life + 500);
  };
  function floatText(anchor, text, cls) {
    if (!anchor || !H.root) return;
    const r = anchor.getBoundingClientRect(), hr = H.root.getBoundingClientRect();
    const f = el('div', 'h-float ' + (cls || ''), esc(text));
    f.style.left = (r.left - hr.left + r.width * 0.55) + 'px';
    f.style.top = (r.bottom - hr.top - 6) + 'px';
    H.root.appendChild(f);
    setTimeout(() => f.remove(), 1200);
  }

  // ------------------------------------------------------------------ bubbles (projected from 3D)
  H.bubble = function (o) {
    if (!H.root || !o || !o.text) return;
    const list = H._bubbles;
    const kindCount = list.filter((b) => b.kind === o.kind).length;
    const cap = o.kind === 'bark' ? 2 : 3;
    if (kindCount >= cap) {
      const oldest = list.find((b) => b.kind === o.kind);
      oldest.el.remove(); list.splice(list.indexOf(oldest), 1);
    }
    const b = { unit: o.unit, x: o.x, z: o.z, kind: o.kind || 'exit', born: performance.now() / 1000, life: o.kind === 'bark' ? 4.5 : 3.4 };
    b.el = el('div', 'bub b-' + b.kind, '<span>' + esc(o.text) + '</span>');
    if (o.color) b.el.style.setProperty('--bub', o.color);
    H._els.world.appendChild(b.el);
    list.push(b);
  };
  function updateBubbles() {
    const s = st(), now = performance.now() / 1000;
    const a = alpha();
    const hr = H.root.getBoundingClientRect();
    for (const b of H._bubbles.slice()) {
      const age = now - b.born;
      if (age > b.life) { b.el.remove(); H._bubbles.splice(H._bubbles.indexOf(b), 1); continue; }
      if (s && b.unit !== undefined && SQ.World && SQ.World.unitIndex) {
        const i = SQ.World.unitIndex(s, b.unit);
        if (i >= 0) { const u = s.units; b.x = u.px[i] + (u.x[i] - u.px[i]) * a; b.z = u.pz[i] + (u.z[i] - u.pz[i]) * a; }
      }
      const p = project(b.x, b.kind === 'bark' ? 3.2 : 2.6, b.z);
      if (!p || !p.on) { b.el.style.opacity = '0'; continue; }
      const fade = age < 0.2 ? age / 0.2 : age > b.life - 0.4 ? (b.life - age) / 0.4 : 1;
      b.el.style.opacity = String(Math.max(0, fade));
      b.el.style.transform = 'translate(' + Math.round(p.x - hr.left) + 'px,' + Math.round(p.y - hr.top) + 'px)';
    }
  }

  // ------------------------------------------------------------------ off-screen alert arrows
  function updateArrows() {
    const s = st(), mine = myIdx();
    const box = H._els.arrows;
    if (!s || mine < 0) { box.innerHTML = ''; return; }
    const hr = H.root.getBoundingClientRect();
    const want = [];
    for (const lm of s.landmarks) {
      if (lm.isHome || lm.owner !== mine) continue;
      if (!(lm.contested || lm.draining) && s.t - lm.attackedT > 3) continue;
      want.push(lm);
    }
    H._arrowEls = H._arrowEls || {};
    const seen = {};
    for (const lm of want) {
      const p = project(lm.x, 1, lm.z);
      if (!p || p.on) continue;
      seen[lm.id] = 1;
      let a = H._arrowEls[lm.id];
      if (!a) {
        a = el('button', 'h-arrow', '<i></i><span>' + esc(lm.name) + '</span>');
        a.addEventListener('click', () => { U.jump(lm.x, lm.z); H.openLandmark(lm.id); });
        box.appendChild(a);
        H._arrowEls[lm.id] = a;
      }
      const cx = hr.width / 2, cy = hr.height / 2;
      let dx = p.x - hr.left - cx, dy = p.y - hr.top - cy;
      if (p.behind) { dx = -dx; dy = -dy; }
      const ang = Math.atan2(dy, dx);
      const mx = cx - 46, my = cy - 120;
      const k = Math.min(mx / Math.max(1e-3, Math.abs(Math.cos(ang))), my / Math.max(1e-3, Math.abs(Math.sin(ang))));
      const x = cx + Math.cos(ang) * k, y = cy + Math.sin(ang) * k;
      a.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
      a.querySelector('i').style.transform = 'rotate(' + ang + 'rad)';
    }
    for (const id of Object.keys(H._arrowEls)) if (!seen[id]) { H._arrowEls[id].remove(); delete H._arrowEls[id]; }
  }
  /** HUD element for a tutorial target key (see header). */
  H.uiEl = function (key) {
    if (!H.root) return null;
    if (key === 'squad' || key === 'chip') {
      return H.root.querySelector('.h-chip[data-ui="chip"]') || H.root.querySelector('.h-chip') || H._els.army;
    }
    if (key === 'reserve') return H.root.querySelector('.h-chip[data-ui="chip.reserve"]');
    if (key === 'recruit') return H._els.recruit;
    return H.root.querySelector('[data-ui="' + key + '"]');
  };
  H.latestAlert = function () {
    const a = H._alerts && H._alerts[H._alerts.length - 1];
    return a ? { x: a.x, z: a.z, lm: a.lm } : null;
  };

  // ------------------------------------------------------------------ selection helpers
  function normIds(sel) {
    if (!sel) return [];
    if (Array.isArray(sel)) return sel;
    if (sel instanceof Set) return Array.from(sel);
    if (sel.ids) return normIds(sel.ids);
    if (sel.units) return normIds(sel.units);
    return [];
  }
  H._localSel = [];
  H.getSelection = function () {
    const I = SQ.input;
    if (I) {
      try {
        if (typeof I.getSelection === 'function') return normIds(I.getSelection());
        if (I.selection !== undefined) return normIds(I.selection);
      } catch (e) { /* ignore */ }
    }
    return H._localSel;
  };
  function setSelection(ids, squad) {
    const I = SQ.input;
    let done = false;
    if (I) {
      try {
        if (squad !== undefined && squad !== null && typeof I.selectSquad === 'function') { I.selectSquad(squad); done = true; }
        else if (typeof I.select === 'function') { I.select(ids); done = true; }
        else if (typeof I.setSelection === 'function') { I.setSelection(ids); done = true; }
      } catch (e) { done = false; }
    }
    if (!done) H._localSel = ids.slice();
    if (SQ.bus) SQ.bus.emit('uiSelect', { ids: ids.slice(), squad });
    H._squadKey = '';
  }
  function squadIds(sq) {
    const s = st(), u = s.units, f = myIdx(), UF = UFv(), out = [];
    for (let i = 0; i < u.n; i++) if (u.faction[i] === f && u.squad[i] === sq && !(u.flags[i] & UF.OVERIT)) out.push(u.id[i]);
    return out;
  }
  function selectSquad(sq) {
    const ids = squadIds(sq);
    if (!ids.length) return;
    U.play('select');
    setSelection(ids, sq);
  }
  function selectArmy() {
    if (!H.match) return;
    U.play('select');
    if (SQ.input && typeof SQ.input.selectArmy === 'function') { try { SQ.input.selectArmy(); H._squadKey = ''; return; } catch (e) { /* fall through */ } }
    const s = st(), u = s.units, f = myIdx(), UF = UFv(), ids = [];
    for (let i = 0; i < u.n; i++) if (u.faction[i] === f && u.squad[i] >= 0 && !(u.flags[i] & UF.OVERIT)) ids.push(u.id[i]);
    setSelection(ids, null);
  }
  function assignNewSquad() {
    const sel = H.getSelection();
    if (!sel.length || !H.match) return;
    const used = H._squadData ? H._squadData.filter((d) => d.ids.length).map((d) => d.sq) : [];
    let k = 1; while (k <= 5 && used.indexOf(k) >= 0) k++;
    if (k > 5) { H.toast('All 5 squads are in use - long-press a chip to reassign', { icon: '✋', life: 2.5 }); U.play('deny'); return; }
    const r = SQ.cmd.squad(H.match, myIdx(), sel, k);
    if (r && r.ok) { U.play('click'); setSelection(sel, k); }
  }

  // ------------------------------------------------------------------ recruit
  function recruit(cls) {
    if (!H.match || !SQ.cmd) return;
    const r = SQ.cmd.recruit(H.match, myIdx(), cls);
    if (r && r.ok) { U.play('recruit'); hideStatCard(); }
    else shake(H._els.rbtn[cls].b);
    H._slow = 0;
  }
  function showStatCard(cls, anchor, hover) {
    const p = me(); if (!p) return;
    const t = SQ.data.units[p.key][cls];
    const beats = SQ.data.beats[cls], weak = SQ.data.weakTo[cls];
    const col = facColor(p);
    const s = st();
    const cost = SQ.Economy ? SQ.Economy.recruitCost(s, myIdx(), cls) : t.cost;
    const c = H._els.stat;
    const trivia = (SQ.data.text.fieldGuide.units[p.key + '.' + cls] || [])[0] || '';
    c.innerHTML =
      '<div class="st-h">' + glyph(cls, col, 30) + '<div><b>' + esc(t.name) + '</b><small>' + CLS_NAME[cls].toUpperCase() + (t.perRecruit > 1 ? ' · recruited as a pair' : '') + '</small></div></div>' +
      '<div class="st-grid">' +
      '<span>Cost</span><b>' + cost + (t.perRecruit > 1 ? ' / 2' : '') + '</b>' +
      '<span>Composure</span><b>' + Math.round(t.hp * ((SQ.data.factions[p.key].hpMult) || 1)) + '</b>' +
      '<span>Sway/s</span><b>' + t.sway + '</b>' +
      '<span>Range</span><b>' + t.range + ' m</b>' +
      '<span>Speed</span><b>' + t.speed + ' m/s</b>' +
      '<span>Recruit</span><b>' + t.recruitTime + ' s</b>' +
      '</div>' +
      '<div class="st-counter"><span class="good">Beats ' + glyph(beats, '#2f7a46', 16) + '</span><span class="bad">Weak to: ' + glyph(weak, '#b0342b', 16) + '</span></div>' +
      '<p>' + esc(t.blurb) + '</p>' + (trivia ? '<p class="st-triv">' + esc(trivia) + '</p>' : '');
    c.classList.add('show');
    H._statHover = !!hover;
    const r = anchor.getBoundingClientRect(), hr = H.root.getBoundingClientRect();
    const w = Math.min(280, hr.width - 24);
    c.style.width = w + 'px';
    let left = r.left - hr.left + r.width / 2 - w / 2;
    left = Math.max(12, Math.min(hr.width - w - 12, left));
    c.style.left = left + 'px';
    c.style.bottom = (hr.bottom - r.top + 10) + 'px';
    if (!hover) { U.play('open'); clearTimeout(H._statT); H._statT = setTimeout(hideStatCard, 4500); }
  }
  function hideStatCard() { if (H._els.stat) H._els.stat.classList.remove('show'); H._statHover = false; }

  // ------------------------------------------------------------------ tactical pause and pause menu
  function tacticalPause() {
    if (!SQ.game || typeof SQ.game.pause !== 'function' || !H.match || H.match.state.over) return;
    U.play('pause');
    SQ.game.pause(!SQ.game.paused);
  }
  H.openPauseMenu = function () {
    if (!H.root || !H.match) return;
    if (SQ.menus && typeof SQ.menus.isOpen === 'function' && SQ.menus.isOpen()) return;
    H._modalOpen = true;
    H._wasPaused = !!(SQ.game && SQ.game.paused);
    if (SQ.game && !SQ.game.paused && typeof SQ.game.pause === 'function') SQ.game.pause(true);
    H._els.paused.classList.remove('show');
    const s = st(), p = me();
    const m = H._els.modal;
    const mission = s.missionId && SQ.data.missionById[s.missionId];
    let obj = '';
    if (mission) {
      obj = '<div class="pm-obj"><div class="pm-k">MISSION ' + mission.n + ' · ' + esc(mission.clock) + '</div><b>' + esc(mission.title) + '</b><p>' + esc(mission.teaches) + '</p><ul>' +
        mission.stars.map((x) => '<li><span class="star">★</span>' + esc(x.text) + '</li>').join('') + '</ul></div>';
    } else {
      obj = '<div class="pm-obj"><div class="pm-k">' + esc((SQ.data.maps[s.mapId] || {}).name || 'Skirmish') + '</div><b>First to ' + s.turfTarget + ' Turf</b><p>Or the most Turf when the park closes at 1 AM.</p></div>';
    }
    m.innerHTML = '<div class="pm-card"><div class="pm-head"><span class="pm-sign">PAUSED</span><span class="pm-time">' + esc(U.fmtHour(s.hour + missionHourShift(s))) + ' · ' + esc((SQ.data.phases[s.phaseIdx] || {}).name || '') + '</span></div>' + obj +
      '<div class="pm-btns">' +
      '<button class="h-btn big primary" data-a="resume">Resume</button>' +
      '<button class="h-btn big" data-a="options">Options</button>' +
      '<button class="h-btn big" data-a="guide">Field Guide</button>' +
      '<button class="h-btn big" data-a="restart">Restart</button>' +
      '<button class="h-btn big warn" data-a="quit">Leave the park</button>' +
      '</div><div class="pm-crew" style="--c:' + facColor(p) + '">You are <b>' + esc(p ? p.name : '') + '</b></div></div>';
    m.querySelectorAll('button[data-a]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.a;
      U.play('click');
      if (a === 'resume') H.closePauseMenu();
      else if (a === 'options' && SQ.menus && SQ.menus.openOptions) SQ.menus.openOptions();
      else if (a === 'guide' && SQ.menus && SQ.menus.openFieldGuide) SQ.menus.openFieldGuide();
      else if (a === 'restart') { H.closePauseMenu(true); if (SQ.menus && SQ.menus.restart) SQ.menus.restart(); else if (SQ.game) SQ.game.start(Object.assign({}, H.match.cfg, { seed: (Date.now() >>> 0) })); }
      else if (a === 'quit') { H.closePauseMenu(true); if (SQ.game) SQ.game.quit(); }
    }));
    m.classList.add('show');
    m.onpointerdown = (e) => { if (e.target === m) H.closePauseMenu(); };
  };
  H.closePauseMenu = function (silent) {
    if (!H.root) return;
    const was = H._modalOpen;
    H._modalOpen = false;
    H._els.modal.classList.remove('show');
    if (was && !silent) U.play('close');
    if (was && SQ.game && !H._wasPaused && typeof SQ.game.pause === 'function' && H.match && !H.match.state.over) SQ.game.pause(false);
  };
  H.pauseMenuOpen = function () { return !!H._modalOpen; };
  /** True while the landmark card, build radial or pause menu covers the screen (tutorial hides its marks). */
  H.cardOpen = function () { return !!(H._cardId || H._radialOpen || H._modalOpen); };

  // ------------------------------------------------------------------ crew call targeting
  H.beginCrewCall = function () {
    if (!H.match) return;
    const p = me(); if (!p) return;
    const chk = SQ.Abilities && SQ.Abilities.canCrewCall(st(), myIdx());
    if (!chk || !chk.ok) {
      U.play('deny'); shake(H._els.crew);
      const pct = Math.floor(p.crew);
      H.toast('Crew Call charging: ' + pct + '%. Hold landmarks and send enemies home to charge it.', { icon: '⏳', life: 2.4, key: 'deny' });
      return;
    }
    const cc = SQ.data.factions[p.key].crewCall;
    // input.js owns map targeting when present (it emits 'crewMode', which drives the HUD bar)
    if (SQ.input && typeof SQ.input.beginCrewCall === 'function') {
      try { SQ.input.beginCrewCall(); return; } catch (e) { /* fall back to HUD targeting */ }
    }
    U.play('open');
    H.targeting = cc.target;
    H._tg = { mode: cc.target, cc, a: null, b: null, hover: null };
    H._els.tgText.textContent = crewInstruction(cc.target, cc.name);
    H._els.target.classList.remove('barOnly');
    H._els.target.classList.add('show');
    H._els.target.dataset.mode = cc.target;
    H._els.crew.classList.add('aiming');
    if (SQ.bus) SQ.bus.emit('uiCrewTarget', { active: true, mode: cc.target });
  };
  H.cancelCrewCall = function (silent) {
    if (!H.root) return;
    const was = H.targeting, own = !!H._tg;
    H.targeting = null; H._tg = null;
    H._els.target.classList.remove('show', 'barOnly');
    H._els.crew.classList.remove('aiming');
    if (own) clearGhost();
    if (was && !own && SQ.input && typeof SQ.input.cancelCrewCall === 'function') { try { SQ.input.cancelCrewCall(); } catch (e) { /* ignore */ } }
    if (was && own && !silent) U.play('close');
    if (was && own && SQ.bus) SQ.bus.emit('uiCrewTarget', { active: false });
  };
  function targetInput(layer) {
    let down = null;
    layer.addEventListener('pointerdown', (e) => {
      if (!H._tg || e.target.closest('.tg-bar')) return;
      try { layer.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      down = { x: e.clientX, y: e.clientY, id: e.pointerId };
      H._tg.a = U.toGround(e.clientX, e.clientY);
      H._tg.b = H._tg.a; H._tg.sx = e.clientX; H._tg.sy = e.clientY; H._tg.ex = e.clientX; H._tg.ey = e.clientY;
      e.preventDefault();
    });
    layer.addEventListener('pointermove', (e) => {
      if (!H._tg) return;
      H._tg.ex = e.clientX; H._tg.ey = e.clientY;
      H._tg.hover = U.toGround(e.clientX, e.clientY);
      if (down) H._tg.b = H._tg.hover;
    });
    layer.addEventListener('pointerup', (e) => {
      if (!H._tg || !down) return;
      const tg = H._tg;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      const g = U.toGround(e.clientX, e.clientY);
      fireCrew(tg, g, moved, e.clientX, e.clientY);
    });
    layer.addEventListener('pointercancel', () => { down = null; });
  }
  function fireCrew(tg, g, moved, cx, cy) {
    const s = st(), f = myIdx();
    let p = null;
    if (tg.mode === 'line') {
      let a = tg.a, b = g;
      if (!a || !b || moved < 24) {
        const auto = autoTarget('line');
        if (!a || !b) { a = auto && auto.a; b = auto && auto.b; }
        else { // a tap: aim from your nearest units through the tapped point
          const from = armyCentroid(b) || { x: b.x - 10, z: b.z };
          const d = Math.hypot(b.x - from.x, b.z - from.z) || 1;
          a = { x: b.x - (b.x - from.x) / d * 20, z: b.z - (b.z - from.z) / d * 20 };
          b = { x: b.x + (b.x - from.x) / d * 20, z: b.z + (b.z - from.z) / d * 20 };
        }
      }
      if (!a || !b) return H.cancelCrewCall();
      const L = Math.hypot(b.x - a.x, b.z - a.z), max = tg.cc.maxLen || 40;
      if (L > max) { b = { x: a.x + (b.x - a.x) * max / L, z: a.z + (b.z - a.z) * max / L }; }
      p = { x: a.x, z: a.z, x2: b.x, z2: b.z };
    } else if (tg.mode === 'landmark') {
      let best = null, bd = Infinity;
      for (const lm of s.landmarks) {
        if (lm.owner !== f) continue;
        let d = Infinity;
        const pr = project(lm.x, 0, lm.z);
        if (pr && pr.on) d = Math.hypot(pr.x - cx, pr.y - cy) / 4;
        if (g) d = Math.min(d, Math.hypot(lm.x - g.x, lm.z - g.z));
        if (d < bd) { bd = d; best = lm; }
      }
      if (!best || bd > 40) { const auto = autoTarget('landmark'); best = auto && s.lmById[auto.lm]; }
      if (!best) { H.toast('Hold a landmark first', { icon: '✋', life: 2 }); U.play('deny'); return; }
      p = { landmarkId: best.id, x: best.x, z: best.z };
    } else {
      const pt = g || autoTarget('point');
      if (!pt) return H.cancelCrewCall();
      p = { x: pt.x, z: pt.z };
    }
    const r = SQ.cmd.crewCall(H.match, f, p);
    if (r && r.ok) { H.cancelCrewCall(true); U.play('send'); }
    else U.play('deny');
  }
  function armyCentroid(near) {
    const s = st(), u = s.units, f = myIdx(), UF = UFv();
    let sx = 0, sz = 0, n = 0, best = null, bd = Infinity;
    for (let i = 0; i < u.n; i++) {
      if (u.faction[i] !== f || (u.flags[i] & UF.OVERIT)) continue;
      sx += u.x[i]; sz += u.z[i]; n++;
      if (near) { const d = Math.hypot(u.x[i] - near.x, u.z[i] - near.z); if (d < bd) { bd = d; best = { x: u.x[i], z: u.z[i] }; } }
    }
    if (near) return best;
    return n ? { x: sx / n, z: sz / n } : null;
  }
  /** "Smart cast" when the camera can't pick ground: densest visible enemy group near your units. */
  function autoTarget(mode) {
    const s = st(), u = s.units, f = myIdx(), UF = UFv();
    if (mode === 'landmark') {
      let best = null, score = -1;
      for (const lm of s.landmarks) {
        if (lm.owner !== f) continue;
        const sc = (lm.contested || lm.draining ? 10 : 0) + (lm.isHome ? 0 : 1);
        if (sc > score) { score = sc; best = lm; }
      }
      return best ? { lm: best.id } : null;
    }
    let best = -1, bc = 0;
    for (let i = 0; i < u.n; i++) {
      if (u.faction[i] === f || (u.flags[i] & UF.OVERIT)) continue;
      if (SQ.World.isVisible && !SQ.World.isVisible(s, f, u.x[i], u.z[i])) continue;
      let c = 0;
      for (let j = 0; j < u.n; j++) if (u.faction[j] !== f && !(u.flags[j] & UF.OVERIT) && Math.abs(u.x[j] - u.x[i]) < 12 && Math.abs(u.z[j] - u.z[i]) < 12) c++;
      if (c > bc) { bc = c; best = i; }
    }
    if (best < 0) return null;
    const pt = { x: u.x[best], z: u.z[best] };
    if (mode === 'line') {
      const from = armyCentroid(pt) || { x: pt.x - 20, z: pt.z };
      const d = Math.hypot(pt.x - from.x, pt.z - from.z) || 1;
      return { a: { x: pt.x - (pt.x - from.x) / d * 18, z: pt.z - (pt.z - from.z) / d * 18 }, b: { x: pt.x + (pt.x - from.x) / d * 18, z: pt.z + (pt.z - from.z) / d * 18 } };
    }
    return pt;
  }
  function ringPoints(x, z, r, hr) {
    const pts = [];
    for (let k = 0; k < 28; k++) {
      const a = k / 28 * Math.PI * 2;
      const p = project(x + Math.cos(a) * r, 0.2, z + Math.sin(a) * r);
      if (!p || p.behind) return '';
      pts.push(Math.round(p.x - hr.left) + ',' + Math.round(p.y - hr.top));
    }
    return pts.join(' ');
  }
  function updateTargeting() {
    const tg = H._tg;
    if (!tg) return;
    const hr = H.root.getBoundingClientRect();
    const E = H._els;
    E.ghost.classList.add('show');
    E.ghost.dataset.mode = 'crew';
    const col = facColor(me());
    E.ghost.style.setProperty('--gh', col);
    if (tg.mode === 'line') {
      if (tg.a && tg.b) {
        const pa = project(tg.a.x, 0.3, tg.a.z), pb = project(tg.b.x, 0.3, tg.b.z);
        if (pa && pb) {
          E.ghLine.setAttribute('x1', pa.x - hr.left); E.ghLine.setAttribute('y1', pa.y - hr.top);
          E.ghLine.setAttribute('x2', pb.x - hr.left); E.ghLine.setAttribute('y2', pb.y - hr.top);
        }
      } else if (tg.ex !== undefined && tg.a === null) {
        E.ghLine.setAttribute('x1', -9); E.ghLine.setAttribute('x2', -9);
      }
      E.ghRing.setAttribute('points', '');
    } else if (tg.mode === 'point') {
      const g = tg.hover;
      E.ghRing.setAttribute('points', g ? ringPoints(g.x, g.z, tg.cc.radius || 14, hr) : '');
    } else {
      // landmark: ring every landmark you hold
      E.ghRing.setAttribute('points', '');
    }
  }
  function clearGhost() {
    const E = H._els;
    if (!E.ghost) return;
    E.ghost.classList.remove('show');
    E.ghLine.setAttribute('x1', -9); E.ghLine.setAttribute('y1', -9); E.ghLine.setAttribute('x2', -9); E.ghLine.setAttribute('y2', -9);
    E.ghPath.setAttribute('points', ''); E.ghRing.setAttribute('points', '');
    E.ghEnd.setAttribute('cx', -99); E.ghLabel.textContent = ''; E.ghLabel.style.display = 'none';
  }

  // ------------------------------------------------------------------ squad tray
  function computeSquads() {
    const s = st(), u = s.units, f = myIdx(), UF = UFv();
    const data = [];
    for (let k = 0; k <= 5; k++) data.push({ sq: k, ids: [], cls: [0, 0, 0], hp: 0, max: 0, idle: true, x: 0, z: 0 });
    for (let i = 0; i < u.n; i++) {
      if (u.faction[i] !== f || (u.flags[i] & UF.OVERIT)) continue;
      const sq = u.squad[i];
      if (sq < 0 || sq > 5) continue;
      const d = data[sq];
      d.ids.push(u.id[i]); d.cls[u.cls[i]]++; d.hp += u.hp[i]; d.max += u.maxHp[i]; d.x += u.x[i]; d.z += u.z[i];
      if (u.flags[i] & (UF.MOVING | UF.COMBAT)) d.idle = false;
      if (u.flags[i] & UF.COMBAT) d.combat = true;
    }
    for (const d of data) if (d.ids.length) { d.x /= d.ids.length; d.z /= d.ids.length; }
    return data;
  }
  function updateSquads() {
    const data = H._squadData = computeSquads();
    const sel = H.getSelection();
    const selSet = new Set(sel);
    const col = facColor(me());
    const live = data.filter((d) => d.ids.length);
    const key = live.map((d) => d.sq + ':' + d.ids.length + ':' + d.cls.join('') + (d.idle ? 'i' : '') + (d.combat ? 'c' : '') + Math.round(d.hp / Math.max(1, d.max) * 20) + (d.ids.length && d.ids.every((id) => selSet.has(id)) ? 's' : '')).join('|') + '#' + sel.length;
    if (key === H._squadKey) return;
    H._squadKey = key;
    const box = H._els.chips;
    H._chipEls = H._chipEls || {};
    const keep = {};
    for (const d of live) {
      keep[d.sq] = 1;
      let c = H._chipEls[d.sq];
      if (!c) {
        c = el('button', 'h-chip');
        c.dataset.ui = d.sq === 0 ? 'chip.reserve' : 'chip';
        c.innerHTML = '<svg class="ch-ring" viewBox="0 0 48 48"><circle class="ch-bg" cx="24" cy="24" r="21"/><circle class="ch-fg" cx="24" cy="24" r="21"/></svg><span class="ch-n"></span><span class="ch-pips"></span><span class="ch-idle">idle</span>';
        bindChip(c, d.sq);
        H._chipEls[d.sq] = c;
      }
      c.style.order = d.sq === 0 ? 9 : d.sq;
      if (c.parentNode !== box) box.appendChild(c);
      c.querySelector('.ch-n').textContent = d.sq === 0 ? 'R' : String(d.sq);
      c.title = (d.sq === 0 ? 'Reserve (new recruits)' : 'Squad ' + d.sq) + ' · ' + d.ids.length + ' units · tap to select, double-tap to look, drag onto the map to send';
      const frac = d.max > 0 ? d.hp / d.max : 0;
      const fg = c.querySelector('.ch-fg');
      fg.style.strokeDasharray = (frac * 131.9).toFixed(1) + ' 132';
      fg.style.stroke = frac > 0.6 ? col : frac > 0.3 ? '#ffc23a' : '#ff5a4a';
      let pips = '';
      let n = 0;
      for (let k = 2; k >= 0; k--) for (let j = 0; j < d.cls[k]; j++) { if (n < 6) pips += glyph(k, col, 11); n++; }
      if (n > 6) pips += '<em>+' + (n - 6) + '</em>';
      c.querySelector('.ch-pips').innerHTML = pips;
      c.classList.toggle('idle', d.idle && d.sq !== 0 ? true : d.idle && d.ids.length > 0);
      c.classList.toggle('fight', !!d.combat);
      c.classList.toggle('sel', d.ids.length > 0 && d.ids.every((id) => selSet.has(id)));
    }
    for (const k of Object.keys(H._chipEls)) if (!keep[k]) { H._chipEls[k].remove(); delete H._chipEls[k]; }
    // "+ squad" only when the selection is not already exactly one squad
    const exact = live.some((d) => d.sq > 0 && d.ids.length === sel.length && d.ids.every((id) => selSet.has(id)));
    H._els.newSquad.classList.toggle('show', sel.length > 0 && !exact);
    H._els.squads.classList.toggle('empty', !live.length);
  }
  function bindChip(c, sq) {
    gesture(c, {
      tap: () => selectSquad(sq),
      double: () => { selectSquad(sq); const d = H._squadData[sq]; if (d && d.ids.length) U.jump(d.x, d.z); },
      long: () => {
        const sel = H.getSelection();
        const own = new Set(squadIds(sq));
        if (sel.length && !sel.every((id) => own.has(id))) {
          const r = SQ.cmd.squad(H.match, myIdx(), sel, sq);
          if (r && r.ok) { U.play('click'); H.toast('Selection is now ' + (sq ? 'Squad ' + sq : 'the Reserve'), { icon: '✓', life: 1.8 }); U.vibrate(10); }
        } else { const d = H._squadData[sq]; if (d && d.ids.length) U.jump(d.x, d.z); }
      },
      dragStart: (e) => chipDragStart(sq, e),
      dragMove: (e) => chipDragMove(e),
      dragEnd: (e, cancel) => chipDragEnd(e, cancel),
      press: (on) => c.classList.toggle('pressed', on),
    });
  }
  let drag = null;
  function chipDragStart(sq, e) {
    const ids = squadIds(sq);
    if (!ids.length) return;
    const d = H._squadData[sq];
    drag = { sq, ids, from: { x: d.x, z: d.z }, ex: e.clientX, ey: e.clientY, snap: null, g: null, pathT: 0 };
    const chip = H._chipEls[sq];
    const r = chip.getBoundingClientRect();
    drag.cx = r.left + r.width / 2; drag.cy = r.top + r.height / 2;
    H._els.ghost.classList.add('show');
    H._els.ghost.dataset.mode = 'drag';
    H._els.ghost.style.setProperty('--gh', facColor(me()));
    selectSquad(sq);
    chipDragMove(e);
  }
  function chipDragMove(e) {
    if (!drag) return;
    drag.ex = e.clientX; drag.ey = e.clientY;
    const s = st();
    // snap to landmarks within 40 px
    let snap = null, sd = 40;
    for (const lm of s.landmarks) {
      const p = project(lm.x, 0.5, lm.z);
      if (!p || !p.on) continue;
      const d = Math.hypot(p.x - e.clientX, p.y - e.clientY);
      if (d < sd) { sd = d; snap = { lm, p }; }
    }
    drag.snap = snap;
    drag.g = snap ? { x: snap.lm.x, z: snap.lm.z } : U.toGround(e.clientX, e.clientY);
    const now = performance.now();
    if (SQ.input && typeof SQ.input.chipDrag === 'function') {
      // input.js draws the 3D ghost path (fx) and does the snapping/sending
      try {
        const overHud = overHudBar(e.clientX, e.clientY);
        const tgt = overHud ? null : SQ.input.chipDrag(drag.sq, e.clientX, e.clientY, 'move');
        drag.inputTgt = tgt;
        if (tgt && tgt.lm !== undefined) { const lm = s.landmarks[tgt.lm] || s.lmById[tgt.lmId]; if (lm) { const p = project(lm.x, 0.5, lm.z); if (p) drag.snap = { lm, p }; } }
      } catch (err) { /* keep HUD-only ghost */ }
      drag.path = null;
      return;
    }
    if (drag.g && s.nav && typeof s.nav.astar === 'function' && now - drag.pathT > 180) {
      drag.pathT = now;
      try { drag.path = s.nav.astar(drag.from.x, drag.from.z, drag.g.x, drag.g.z); } catch (err) { drag.path = null; }
    }
  }
  function overHudBar(cx, cy) {
    const under = document.elementsFromPoint ? document.elementsFromPoint(cx, cy) : [];
    return under.some((x) => x.closest && x.closest('.h-bottom, .h-top, .h-card, .h-mini'));
  }
  function updateDragGhost() {
    if (!drag) return;
    const hr = H.root.getBoundingClientRect();
    const E = H._els;
    const ex = drag.snap ? drag.snap.p.x : drag.ex, ey = drag.snap ? drag.snap.p.y : drag.ey;
    E.ghLine.setAttribute('x1', drag.cx - hr.left); E.ghLine.setAttribute('y1', drag.cy - hr.top);
    E.ghLine.setAttribute('x2', ex - hr.left); E.ghLine.setAttribute('y2', ey - hr.top);
    E.ghEnd.setAttribute('cx', ex - hr.left); E.ghEnd.setAttribute('cy', ey - hr.top);
    E.ghEnd.setAttribute('r', drag.snap ? 22 : 14);
    let pts = '';
    if (drag.path && drag.path.length > 1) {
      const step = Math.max(1, Math.floor(drag.path.length / 60));
      for (let k = 0; k < drag.path.length; k += step) {
        const q = drag.path[k];
        const p = project(q[0], 0.3, q[1]);
        if (!p || p.behind) { pts = ''; break; }
        pts += Math.round(p.x - hr.left) + ',' + Math.round(p.y - hr.top) + ' ';
      }
    }
    E.ghPath.setAttribute('points', pts);
    E.ghLabel.style.display = 'block';
    E.ghLabel.textContent = drag.snap ? 'Take ' + drag.snap.lm.name : drag.g ? 'Attack-move here' : 'Release on the map';
    E.ghLabel.style.transform = 'translate(' + Math.round(ex - hr.left) + 'px,' + Math.round(ey - hr.top - 34) + 'px)';
  }
  function chipDragEnd(e, cancel) {
    if (!drag) return;
    const d = drag; drag = null;
    clearGhost();
    const viaInput = SQ.input && typeof SQ.input.chipDrag === 'function';
    // dropped on the HUD bars? cancel
    if (cancel || overHudBar(e.clientX, e.clientY)) {
      if (viaInput) { try { SQ.input.chipDrag(d.sq, e.clientX, e.clientY, 'cancel'); } catch (err) { /* ignore */ } }
      return;
    }
    if (viaInput) {
      try { const t = SQ.input.chipDrag(d.sq, e.clientX, e.clientY, 'end'); if (t) { U.play('send'); U.vibrate(8); } } catch (err) { /* ignore */ }
      return;
    }
    let order;
    if (d.snap) order = { type: 'take', lm: d.snap.lm.id };
    else {
      const g = U.toGround(e.clientX, e.clientY);
      if (!g) return;
      order = { type: 'attackMove', x: g.x, z: g.z };
    }
    const r = SQ.cmd.order(H.match, myIdx(), d.ids, order);
    if (r && r.ok) { U.play('send'); U.vibrate(8); if (SQ.bus) SQ.bus.emit('uiOrder', { ids: d.ids, order }); }
  }

  // ------------------------------------------------------------------ top bar
  function updateTop() {
    const s = st(), p = me(), E = H._els;
    if (!p) return;
    const clout = Math.floor(p.clout);
    if (clout !== H._cl) { H._cl = clout; E.clout.textContent = clout; }
    const inc = (p.income || 0).toFixed(1);
    if (inc !== H._inc) { H._inc = inc; E.income.textContent = '+' + inc + '/s'; }
    const popTxt = p.pop + '/' + p.popCap;
    if (popTxt !== H._popTxt) { H._popTxt = popTxt; E.popv.textContent = popTxt; E.pop.classList.toggle('capped', p.pop >= p.popCap); }
    E.wom.classList.toggle('show', !!p.behind);
    // turf race
    const tgt = s.turfTarget || 1500;
    const facs = s.factions.filter((f) => f.key !== 'squirrels' || s.factions.length > 1);
    const tkey = facs.map((f) => f.idx + (f.eliminated ? 'x' : '')).join(',');
    if (tkey !== H._turfKey) {
      H._turfKey = tkey;
      E.turf.innerHTML = '';
      H._turfRows = facs.map((f) => {
        const row = el('div', 'tf-row' + (f.idx === s.player ? ' me' : '') + (f.eliminated ? ' out' : '') + ' pat-' + f.key);
        row.style.setProperty('--c', facColor(f));
        row.innerHTML = '<span class="tf-name">' + esc(f.idx === s.player ? 'YOU' : f.short) + '</span><span class="tf-bar"><i></i><em></em></span><span class="tf-v">0</span>';
        E.turf.appendChild(row);
        return { f, row, bar: row.querySelector('.tf-bar i'), rate: row.querySelector('.tf-bar em'), v: row.querySelector('.tf-v'), last: -1 };
      });
      E.race.dataset.n = facs.length;
      E.turf.classList.toggle('many', facs.length >= 3);
      E.race.setAttribute('aria-label', 'Turf race to ' + tgt);
      E.turf.dataset.target = tgt;
    }
    if (s.missionId && tgt > 50000) E.race.classList.add('noturf'); else E.race.classList.remove('noturf');
    // mission objective (hold N landmarks / hold one for N seconds) next to or instead of the race
    const mission = s.missionId && SQ.data.missionById[s.missionId];
    const win = mission && mission.win;
    let objTxt = '';
    if (win && win.type === 'hold') objTxt = '<b>' + Math.min(win.count, p.held) + '/' + win.count + '</b> landmarks held<small>Hold ' + win.count + ' to win</small>';
    else if (win && win.type === 'holdTime') {
      const held = Math.floor((p.stats && p.stats.held && p.stats.held[win.lm]) || 0);
      objTxt = '<b>' + Math.min(win.seconds, held) + '/' + win.seconds + ' s</b> at ' + esc(lmName(s, win.lm)) + '<small>' + (s.lmById[win.lm] && s.lmById[win.lm].owner === s.player ? 'Holding - keep it!' : 'Take it back!') + '</small>';
    }
    if (objTxt !== H._objTxt) { H._objTxt = objTxt; E.obj.innerHTML = objTxt; E.race.classList.toggle('hasobj', !!objTxt); }
    for (const r of H._turfRows) {
      const v = Math.floor(r.f.turf);
      if (v !== r.last) {
        r.last = v;
        r.bar.style.width = Math.min(100, v / tgt * 100).toFixed(2) + '%';
        r.v.textContent = v;
        r.row.classList.toggle('near', tgt - v <= 200 && tgt < 50000);
      }
      r.rate.textContent = r.f.turfRate ? '+' + r.f.turfRate.toFixed(r.f.turfRate % 1 ? 1 : 0) : '';
    }
    // clock
    const hour = s.hour || 16;
    const frac = Math.max(0, Math.min(1, (hour - 16) / 9));
    const ang = Math.PI * (1 - frac);
    const sx = 60 + Math.cos(ang) * 52, sy = 40 - Math.sin(ang) * 34;
    E.sun.setAttribute('transform', 'translate(' + sx.toFixed(1) + ',' + sy.toFixed(1) + ')');
    const night = s.phase === 'night';
    E.sunC.setAttribute('fill', night ? '#e8ecff' : s.phase === 'golden' ? '#ff9a3c' : '#ffd34d');
    E.clock.classList.toggle('night', night);
    // campaign missions happen at their own time of day ("7 AM"): shift the shown hour to match
    const shown = hour + missionHourShift(s);
    const tt = U.fmtHour(shown);
    if (tt !== H._tt) { H._tt = tt; E.time.textContent = tt; }
    const pn = s.suddenDeath ? 'Sudden death' : (shown % 24) < 12 ? 'Morning' : (shown % 24) < 15 && s.phase === 'afternoon' ? 'Midday' : (SQ.data.phases[s.phaseIdx] || {}).name || '';
    if (pn !== H._pn) { H._pn = pn; E.phase.textContent = pn; }
    // landmark chips
    const lms = s.landmarks.filter((l) => !l.isHome);
    const lkey = lms.map((l) => l.id).join(',');
    if (lkey !== H._lmChipKey) {
      H._lmChipKey = lkey;
      E.lms.innerHTML = '';
      H._lmChips = lms.map((l) => {
        const c = el('button', 'lm-chip');
        c.innerHTML = lmIcon(l.id, 18) + '<svg class="lm-meter" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16"/></svg>';
        c.title = l.name;
        c.setAttribute('aria-label', l.name);
        c.addEventListener('click', () => { U.play('click'); U.jump(l.x, l.z); H.openLandmark(l.id); });
        E.lms.appendChild(c);
        return { l, c, m: c.querySelector('.lm-meter circle'), k: '' };
      });
    }
    for (const ch of H._lmChips) {
      const l = ch.l;
      const own = s.factions[l.owner];
      const att = s.t - l.attackedT < 2 || l.contested;
      const capF = l.owner < 0 && l.capBy >= 0 ? s.factions[l.capBy] : null;
      const k = l.owner + '|' + (att ? 1 : 0) + '|' + Math.round(l.meter / 5) + '|' + l.capBy + '|' + (l.owner === s.player ? 1 : 0);
      if (k === ch.k) continue;
      ch.k = k;
      ch.c.style.setProperty('--c', own ? facColor(own) : '#5d665f');
      ch.c.className = 'lm-chip' + (own ? ' owned pat-' + own.key : '') + (l.owner === s.player ? ' mine' : '') + (att ? ' attacked' : '');
      const showMeter = capF || (own && l.meter < 99);
      ch.m.style.stroke = capF ? facColor(capF) : own ? '#fff' : 'transparent';
      ch.m.style.strokeDasharray = showMeter ? (l.meter / 100 * 100.5).toFixed(1) + ' 101' : '0 101';
    }
  }

  // ------------------------------------------------------------------ bottom bar
  function updateBottom() {
    const s = st(), p = me(), E = H._els;
    if (!p) return;
    const f = myIdx();
    // recruit
    const qCount = { crowd: 0, talker: 0, heavy: 0 };
    for (const q of p.queue) qCount[q.cls]++;
    const head = p.queue[0];
    for (const cls of CLASSES) {
      const r = E.rbtn[cls];
      const chk = SQ.Economy ? SQ.Economy.canRecruit(s, f, cls) : { ok: true, cost: 0 };
      const cost = chk.cost !== undefined ? chk.cost : SQ.Economy.recruitCost(s, f, cls);
      if (r._cost !== cost) { r._cost = cost; r.cost.textContent = cost; }
      const reason = chk.ok ? '' : chk.reason;
      if (r._reason !== reason) { r._reason = reason; r.b.dataset.reason = reason; r.b.classList.toggle('dis', !chk.ok); }
      const q = qCount[cls];
      if (r._q !== q) { r._q = q; r.q.textContent = q ? '×' + q : ''; r.b.classList.toggle('queued', q > 0); }
      const prog = head && head.cls === cls ? 1 - head.t / head.total : 0;
      r.prog.style.width = (prog * 100).toFixed(1) + '%';
    }
    E.recruit.classList.toggle('qfull', p.queue.length >= ((SQ.data.matchRules && SQ.data.matchRules.queueMax) || 5));
    // crew
    const v = Math.max(0, Math.min(100, p.crew));
    const ready = v >= 100;
    E.ccFg.style.strokeDasharray = (v / 100 * 175.9).toFixed(1) + ' 176';
    E.crew.classList.toggle('ready', ready);
    const pct = ready ? 'READY' : Math.floor(v) + '%';
    if (pct !== H._ccp) { H._ccp = pct; E.ccPct.textContent = pct; }
    updateSquads();
  }

  // ------------------------------------------------------------------ landmark card
  H.openLandmark = function (id) {
    if (!H.match || !H.root) return;
    const s = st();
    if (typeof id === 'number') { const l = s.landmarks[id]; id = l && l.id; }
    if (id && id.id) id = id.id;
    if (id !== 'dosa' && !s.lmById[id]) return;
    closeRadial(); hideStatCard();
    if (H._cardId !== id) U.play('open');
    H._cardId = id;
    H._els.card.classList.add('show');
    refreshCard(true);
  };
  H.closeCard = function () {
    if (!H.root) return;
    if (H._cardId) U.play('close');
    H._cardId = null;
    H._els.card.classList.remove('show');
    closeRadial();
  };
  function cardBtn(label, a, cls, dis, title) {
    return '<button class="h-btn ' + (cls || '') + '" data-a="' + a + '"' + (dis ? ' disabled' : '') + (title ? ' title="' + esc(title) + '"' : '') + '>' + label + '</button>';
  }
  function refreshCard(force) {
    const id = H._cardId;
    if (!id || !H.match) return;
    const s = st(), f = myIdx(), p = me(), card = H._els.card;
    if (id === 'dosa') return dosaCard(force);
    const lm = s.lmById[id];
    if (!lm) return H.closeCard();
    const own = s.factions[lm.owner];
    const capF = lm.capBy >= 0 ? s.factions[lm.capBy] : null;
    const mine = lm.owner === f;
    const sel = H.getSelection();
    const idle = nearestIdleSquad(lm);
    const canRally = SQ.Economy && SQ.Economy.canRally(s, f, id);
    const isRally = p && p.rally === id;
    const padKey = lm.pads.map((pd) => {
      const su = pd.setup >= 0 ? s.setupById[pd.setup] : null;
      return su ? su.kind + su.owner + (su.done ? 'd' : Math.round((su.buildLeft || 0))) : '-';
    }).join(',');
    const key = [id, lm.owner, Math.round(lm.meter / 4), lm.capBy, lm.contested, lm.draining, padKey, sel.length, idle ? idle.sq : -1, canRally, isRally, Math.floor(p.clout / 10), s.phase].join('|');
    if (!force && key === H._cardKey) return;
    H._cardKey = key;
    const d = SQ.data.landmarkById[id] || {};
    const rates = SQ.Economy && SQ.Economy.landmarkRates ? SQ.Economy.landmarkRates(s, lm, s.phase) : { clout: lm.clout, turf: lm.turf };
    const ownerTxt = lm.isHome ? (own ? (mine ? 'Your Home Spot' : own.name + ' home') : 'Home Spot') : own ? (mine ? 'Yours' : own.name) : 'Neutral';
    const status = lm.contested ? '<span class="lc-st contested">CONTESTED</span>' : lm.draining ? '<span class="lc-st drain">UNDER ATTACK</span>' : '';
    const meterCol = own ? facColor(own) : capF ? facColor(capF) : '#8b938a';
    const phaseNote = lm.phase && lm.phase[s.phase] ? phaseBlurb(lm.phase[s.phase]) : '';
    const triv = ((SQ.data.text.fieldGuide.landmarks || {})[id] || [])[0];
    let pads = '';
    lm.pads.forEach((pd, k) => {
      const su = pd.setup >= 0 ? s.setupById[pd.setup] : null;
      if (su) {
        const S = SQ.data.setups[su.kind] || {};
        const of = s.factions[su.owner];
        const prog = su.done ? '' : '<i class="pd-prog" style="width:' + Math.round((1 - (su.buildLeft || 0) / (su.buildTime || S.buildTime || 6)) * 100) + '%"></i>';
        pads += '<div class="pad built" style="--c:' + facColor(of) + '" title="' + esc(S.text || '') + '"><span class="pd-ic">' + (SETUP_ICON[su.kind] || '◆') + '</span><span class="pd-n">' + esc(S.name || su.kind) + '</span><small>' + (su.done ? esc(of ? of.short : '') : 'building…') + '</small>' + prog + '</div>';
      } else {
        const canB = mine || (lm.isHome && lm.id === (p && p.home));
        pads += '<button class="pad free' + (canB ? '' : ' locked') + '" data-pad="' + k + '"' + (canB ? '' : ' disabled') + '><span class="pd-ic">+</span><span class="pd-n">' + (canB ? 'Build' : 'Empty pad') + '</span><small>' + (canB ? 'pad ' + (k + 1) : 'hold to build') + '</small></button>';
      }
    });
    const rallyTitle = canRally ? (isRally ? 'Recruits spawn here' : 'Recruits will spawn here') : lm.isHome ? 'Only your own Home Spot' : !mine ? 'Hold it first' : 'Too far from home (90 m) - Violets and Club Fair Tables excepted';
    card.innerHTML =
      '<div class="lc-head" style="--c:' + meterCol + '">' +
      '<span class="lc-icon">' + lmIcon(id, 26) + '</span>' +
      '<div class="lc-title"><b>' + esc(lm.name) + '</b><small>' + esc(lm.nick || d.nick || (lm.isHome ? 'Home Spot · can\'t be captured' : '')) + '</small></div>' +
      '<button class="h-btn lc-x" data-a="close" aria-label="Close">' + ICON.close + '</button></div>' +
      '<div class="lc-own"><span class="lc-badge' + (own ? ' pat-' + own.key : '') + '" style="--c:' + (own ? facColor(own) : '#7b837a') + '">' + esc(ownerTxt) + '</span>' + status +
      (!lm.isHome ? '<span class="lc-rates"><b>+' + fmtRate(rates.clout) + '</b> Clout/s · <b>+' + fmtRate(rates.turf) + '</b> Turf/s</span>' : '<span class="lc-rates">+1.5 Clout/s</span>') + '</div>' +
      (!lm.isHome ? '<div class="lc-meter"><i style="width:' + Math.round(lm.meter) + '%;background:' + meterCol + '"></i></div>' : '') +
      (lm.perk ? '<p class="lc-perk"><b>Perk</b> ' + esc(lm.perk.text) + '</p>' : '') +
      (phaseNote ? '<p class="lc-phase">' + esc(phaseNote) + '</p>' : '') +
      '<div class="lc-sub">Setups <small>flip with the landmark</small></div><div class="lc-pads">' + pads + '</div>' +
      '<div class="lc-acts">' +
      (sel.length ? cardBtn(ICON.flag + '<span>Send selected (' + sel.length + ')</span>', 'sendSel', 'primary') : '') +
      cardBtn(ICON.send + '<span>' + (idle ? 'Send ' + (idle.sq ? 'Squad ' + idle.sq : 'Reserve') + ' (' + idle.ids.length + ')' : 'No idle squad') + '</span>', 'sendIdle', sel.length ? '' : 'primary', !idle) +
      cardBtn('<span class="rally-dot"></span><span>' + (isRally ? 'Rally point ✓' : 'Rally here') + '</span>', 'rally', isRally ? 'on' : '', !canRally || isRally, rallyTitle) +
      cardBtn(ICON.eye + '<span>Look</span>', 'look', '') +
      '</div>' +
      (triv ? '<p class="lc-triv">' + esc(triv) + '</p>' : '');
    card.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); cardAction(b.dataset.a, lm); }));
    card.querySelectorAll('[data-pad]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openRadial(lm, +b.dataset.pad, b); }));
  }
  function fmtRate(v) { return (Math.round(v * 10) / 10).toString(); }
  function phaseBlurb(ph) {
    const out = [];
    if (ph.clout !== undefined) out.push('Clout ×' + ph.clout);
    if (ph.turf !== undefined) out.push('Turf ' + ph.turf + '/s');
    if (ph.aura) out.push('the old elm is creepy');
    return out.length ? 'Right now: ' + out.join(', ') + '.' : '';
  }
  function nearestIdleSquad(lm) {
    const data = H._squadData || computeSquads();
    let best = null, bd = Infinity;
    for (const d of data) {
      if (!d.ids.length || !d.idle) continue;
      const dd = Math.hypot(d.x - lm.x, d.z - lm.z);
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }
  function cardAction(a, lm) {
    const f = myIdx();
    if (a === 'close') return H.closeCard();
    if (a === 'look') { U.play('click'); U.jump(lm.x, lm.z); return; }
    if (a === 'rally') { const r = SQ.cmd.setRally(H.match, f, lm.id); if (r && r.ok) U.play('click'); return; }
    if (a === 'sendIdle' || a === 'sendSel') {
      const ids = a === 'sendSel' ? H.getSelection() : (nearestIdleSquad(lm) || {}).ids;
      if (!ids || !ids.length) return;
      const order = lm.isHome ? { type: 'move', x: lm.x, z: lm.z } : { type: 'take', lm: lm.id };
      const r = SQ.cmd.order(H.match, f, ids, order);
      if (r && r.ok) { U.play('send'); if (SQ.bus) SQ.bus.emit('uiOrder', { ids, order }); H.closeCard(); }
    }
  }
  function dosaCard(force) {
    const s = st(), p = me(), f = myIdx();
    const D = SQ.data.sites.dosa;
    const u = s.units, UF = UFv();
    let near = 0;
    for (let i = 0; i < u.n; i++) if (u.faction[i] === f && !(u.flags[i] & UF.OVERIT) && Math.hypot(u.x[i] - D.x, u.z[i] - D.z) <= D.radius) near++;
    const key = 'dosa|' + near + '|' + Math.ceil(p.dosaCD || 0) + '|' + (p.clout >= D.cost);
    if (!force && key === H._cardKey) return;
    H._cardKey = key;
    const cd = p.dosaCD > 0;
    const triv = (SQ.data.text.fieldGuide.landmarks.dosa || [])[0];
    const card = H._els.card;
    card.innerHTML =
      '<div class="lc-head" style="--c:#e7a93b"><span class="lc-icon">' + lmIcon('dosa', 26) + '</span><div class="lc-title"><b>NY Dosas cart</b><small>Neutral · the line moves fast</small></div>' +
      '<button class="h-btn lc-x" data-a="close" aria-label="Close">' + ICON.close + '</button></div>' +
      '<p class="lc-perk"><b>Dosas</b> Pay ' + D.cost + ' Clout: your units within ' + D.radius + ' m get +20% Sway for ' + D.time + ' s.</p>' +
      '<div class="lc-acts">' + cardBtn('<span>' + (cd ? 'Back in ' + Math.ceil(p.dosaCD) + ' s' : near ? 'Buy for ' + near + ' units · ' + D.cost : 'Bring units within ' + D.radius + ' m') + '</span>', 'buy', 'primary', cd || !near || p.clout < D.cost) +
      cardBtn(ICON.eye + '<span>Look</span>', 'look', '') + '</div>' + (triv ? '<p class="lc-triv">' + esc(triv) + '</p>' : '');
    card.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (b.dataset.a === 'close') H.closeCard();
      else if (b.dataset.a === 'look') U.jump(D.x, D.z);
      else { const r = SQ.cmd.buyDosa(H.match, f); if (r && r.ok) { U.play('coin'); H.closeCard(); } }
    }));
  }

  // ------------------------------------------------------------------ build radial
  function openRadial(lm, padIdx, anchor) {
    const s = st(), f = myIdx();
    const opts = SQ.Economy ? SQ.Economy.buildOptions(s, f, lm.id) : [];
    if (!opts.length) return;
    U.play('open');
    const R = H._els.radial;
    const hr = H.root.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    let cx = ar.left + ar.width / 2 - hr.left, cy = ar.top + ar.height / 2 - hr.top;
    const n = opts.length;
    const rad = n <= 4 ? 100 : 112;
    cx = Math.max(rad + 46, Math.min(hr.width - rad - 46, cx));
    cy = Math.max(rad + 50, Math.min(hr.height - rad - 50, cy));
    let html = '<div class="rd-hub" style="left:' + cx + 'px;top:' + cy + 'px"><span>Pad ' + (padIdx + 1) + '</span><small>' + esc(lm.name) + '</small></div>';
    opts.forEach((o, k) => {
      const a = -Math.PI * 3 / 4 + k * (Math.PI * 2 / Math.max(4, n));
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
      const why = o.ok ? '' : ({ clout: 'Need ' + o.cost, noPad: 'No pad', oneSpecial: 'One per landmark', notHome: 'Not at home', notOwned: 'Hold it first' }[o.reason] || o.reason);
      html += '<button class="rd-opt' + (o.ok ? '' : ' no') + '" data-id="' + o.id + '" style="left:' + x + 'px;top:' + y + 'px" title="' + esc(o.text) + '"' + '>' +
        '<span class="rd-ic">' + (SETUP_ICON[o.id] || '◆') + '</span><b>' + esc(o.name) + '</b><small>' + (o.ok ? o.cost : esc(why)) + '</small></button>';
    });
    html += '<div class="rd-tip"></div>';
    R.innerHTML = html;
    R.classList.add('show');
    H._radialOpen = true;
    const tip = R.querySelector('.rd-tip');
    tip.style.left = (hr.width / 2) + 'px'; tip.style.top = (cy + rad + 96 > hr.height - 10 ? Math.max(8, cy - rad - 100) : cy + rad + 50) + 'px';
    tip.textContent = 'Setups have no HP - they flip to whoever takes the landmark.';
    R.querySelectorAll('.rd-opt').forEach((b) => {
      b.addEventListener('pointerenter', () => { const o = opts.find((x) => x.id === b.dataset.id); tip.textContent = o.name + ': ' + o.text; });
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const o = opts.find((x) => x.id === b.dataset.id);
        if (!o.ok) { U.play('deny'); shake(b); tip.textContent = o.name + ': ' + o.text; return; }
        const r = SQ.cmd.build(H.match, f, lm.id, padIdx, o.id);
        if (r && r.ok) { U.play('build'); closeRadial(); refreshCard(true); }
        else { shake(b); }
      });
    });
  }
  function closeRadial() {
    if (!H._els.radial) return;
    H._radialOpen = false;
    H._els.radial.classList.remove('show');
    H._els.radial.innerHTML = '';
  }

  // ------------------------------------------------------------------ minimap
  const MB = { x0: -178, x1: 152, z0: -102, z1: 100 };
  H.setMinimap = function (onState, noSave) {
    H._miniOn = !!onState;
    if (!H.root) return;
    H._els.mini.classList.toggle('show', H._miniOn);
    H._els.mapBtn.classList.toggle('active', H._miniOn);
    if (!noSave && SQ.settings && SQ.settings.set) { try { SQ.settings.set('minimap', H._miniOn, true); } catch (e) { /* ignore */ } }
    if (H._miniOn) { H._miniStatic = null; drawMiniStatic(); }
  };
  function miniSize() {
    const c = H._els.miniC;
    const w = c.clientWidth || 220, h = c.clientHeight || Math.round(w * (MB.z1 - MB.z0) / (MB.x1 - MB.x0));
    return { w, h };
  }
  function drawMiniStatic() {
    if (!H._miniOn || !H.root || typeof window === 'undefined' || !window.GEO) return;
    const { w, h } = miniSize();
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    const sx = w / (MB.x1 - MB.x0), sz = h / (MB.z1 - MB.z0);
    const X = (x) => (x - MB.x0) * sx, Z = (z) => (z - MB.z0) * sz;
    const poly = (pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1])))); g.closePath(); };
    const line = (pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1])))); };
    const G = window.GEO;
    g.fillStyle = '#2a312d'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3a423d'; g.lineCap = 'round';
    for (const r of G.roads || []) { g.lineWidth = 9 * sx; line(r.pts); g.stroke(); }
    for (const b of G.buildings || []) { poly(b.pts); g.fillStyle = '#4a4741'; g.fill(); }
    const park = (G.areas || []).find((a) => a.kind === 'park' && /Washington Square/.test(a.name || ''));
    if (park) { poly(park.pts); g.fillStyle = '#7f8579'; g.fill(); }
    for (const a of G.areas || []) {
      const k = a.kind;
      let c = null;
      if (k === 'grass' || k === 'garden' || k === 'flowerbed' || (k === 'park' && a !== park)) c = '#4d7a43';
      else if (k === 'dog_park') c = '#9b8a6a';
      else if (k === 'playground') c = '#b4785a';
      else if (k === 'fountain') c = '#5b9bc4';
      if (!c) continue;
      poly(a.pts); g.fillStyle = c; g.fill();
    }
    g.strokeStyle = 'rgba(232,225,207,0.55)';
    for (const p of G.paths || []) { if (p.area) continue; g.lineWidth = Math.max(0.6, 2.4 * sx); line(p.pts); g.stroke(); }
    // fountain
    g.beginPath(); g.arc(X(0), Z(0), 11 * sx, 0, Math.PI * 2); g.fillStyle = '#6fb3d9'; g.fill();
    // Arch
    g.fillStyle = '#f2ece0'; g.fillRect(X(-9), Z(-58), 19 * sx, 8 * sz);
    H._miniStatic = cv;
  }
  function drawMini() {
    if (!H._miniOn || !H.match) return;
    const c = H._els.miniC;
    const { w, h } = miniSize();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); H._miniStatic = null; }
    if (!H._miniStatic) drawMiniStatic();
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    if (H._miniStatic) g.drawImage(H._miniStatic, 0, 0, c.width, c.height);
    g.scale(dpr, dpr);
    const sx = w / (MB.x1 - MB.x0), sz = h / (MB.z1 - MB.z0);
    const X = (x) => (x - MB.x0) * sx, Z = (z) => (z - MB.z0) * sz;
    const s = st(), f = myIdx(), u = s.units, UF = UFv();
    const t = performance.now() / 1000;
    // landmarks
    for (const lm of s.landmarks) {
      const own = s.factions[lm.owner];
      const r = Math.max(4, (lm.isHome ? 8 : lm.r) * sx);
      g.beginPath(); g.arc(X(lm.x), Z(lm.z), r, 0, Math.PI * 2);
      g.fillStyle = own ? hexA(facColor(own), lm.isHome ? 0.35 : 0.55) : 'rgba(255,255,255,0.18)';
      g.fill();
      g.lineWidth = lm.isHome ? 2 : 1.4;
      const att = !lm.isHome && (lm.contested || s.t - lm.attackedT < 2);
      g.strokeStyle = att && (t * 4 % 2 < 1) ? '#ff4d3d' : own ? facColor(own) : 'rgba(255,255,255,0.55)';
      g.stroke();
      if (!lm.isHome && lm.owner < 0 && lm.capBy >= 0 && lm.meter > 0) {
        g.beginPath(); g.arc(X(lm.x), Z(lm.z), r + 1.5, -Math.PI / 2, -Math.PI / 2 + lm.meter / 100 * Math.PI * 2);
        g.strokeStyle = facColor(s.factions[lm.capBy]); g.lineWidth = 2; g.stroke();
      }
    }
    // events
    for (const ev of s.events || []) {
      if (ev.state === 'done' || !isFinite(ev.x)) continue;
      g.beginPath(); g.arc(X(ev.x), Z(ev.z), 5 + Math.sin(t * 6) * 1.5, 0, Math.PI * 2);
      g.strokeStyle = ev.state === 'warn' ? '#ffd34d' : '#fff'; g.lineWidth = 1.5; g.setLineDash([2, 2]); g.stroke(); g.setLineDash([]);
    }
    // units
    for (let i = 0; i < u.n; i++) {
      if (u.flags[i] & UF.OVERIT) continue;
      const fi = u.faction[i];
      if (fi !== f && SQ.World.isVisible && !SQ.World.isVisible(s, f, u.x[i], u.z[i])) continue;
      const fac = s.factions[fi];
      g.fillStyle = facColor(fac);
      const sz2 = u.cls[i] === 2 ? 3.2 : 2.2;
      g.fillRect(X(u.x[i]) - sz2 / 2, Z(u.z[i]) - sz2 / 2, sz2, sz2);
    }
    // camera footprint
    const rect = viewRect();
    const corners = [[rect.left + 1, rect.top + rect.height * 0.12], [rect.left + rect.width - 1, rect.top + rect.height * 0.12], [rect.left + rect.width - 1, rect.top + rect.height - 1], [rect.left + 1, rect.top + rect.height - 1]];
    const gs = corners.map((c2) => U.toGround(c2[0], c2[1]));
    if (gs.every((q) => q && Math.abs(q.x) < 2000 && Math.abs(q.z) < 2000)) {
      g.beginPath(); gs.forEach((q, i) => (i ? g.lineTo(X(q.x), Z(q.z)) : g.moveTo(X(q.x), Z(q.z)))); g.closePath();
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.2; g.stroke();
    }
  }
  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  U.hexA = hexA;
  function miniInput(c) {
    let down = false;
    const go = (e) => {
      const r = c.getBoundingClientRect();
      const x = MB.x0 + (e.clientX - r.left) / r.width * (MB.x1 - MB.x0);
      const z = MB.z0 + (e.clientY - r.top) / r.height * (MB.z1 - MB.z0);
      U.jump(x, z, { instant: true });
    };
    c.addEventListener('pointerdown', (e) => { down = true; try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } go(e); e.stopPropagation(); });
    c.addEventListener('pointermove', (e) => { if (down) go(e); });
    c.addEventListener('pointerup', () => { down = false; });
    c.addEventListener('pointercancel', () => { down = false; });
  }

  // Publish the HUD bar extents as CSS vars so feed/coach marks never collide with them.
  function measure() {
    const hr = H.root.getBoundingClientRect();
    const t = H._els.top.getBoundingClientRect(), b = H._els.bottom.getBoundingClientRect();
    const top = Math.round(t.bottom - hr.top), bot = Math.round(hr.bottom - b.top);
    if (top !== H._mTop || bot !== H._mBot) {
      H._mTop = top; H._mBot = bot;
      const r = document.documentElement.style;
      r.setProperty('--hud-top', top + 'px');
      r.setProperty('--hud-bot', bot + 'px');
    }
  }

  // ------------------------------------------------------------------ per-frame update
  H.update = function (a, b, force) {
    if (!H.root) return;
    let m, dt;
    if (typeof a === 'number') { dt = a; m = H.match || (SQ.game && SQ.game.match); }
    else { m = a; dt = b || 0; }
    if (m !== H.match) { H.setMatch(m || null); return; }
    if (!m) return;
    H._slow -= dt; H._mini -= dt; H._card -= dt;
    if (H._slow <= 0 || force) { H._slow = 0.1; updateTop(); updateBottom(); updateToasts(); measure(); }
    if (H._card <= 0) { H._card = 0.2; if (H._cardId) refreshCard(false); }
    if (H._mini <= 0) { H._mini = 0.15; drawMini(); }
    updateAnnouncer();
    updateBubbles();
    updateArrows();
    if (drag) updateDragGhost();
    else if (H._tg) updateTargeting();
  };
})(window.SQ = window.SQ || {});
