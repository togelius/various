// SQUARE OFF — "Hang Out" HUD (the default game, DESIGN-V2.md). Minimal on purpose:
//   top:    your points vs theirs, and the clock
//   bottom: your three groups as big cards (name, patience bar, what they are doing in words)
//   right:  camera buttons (zoom, turn, find my groups) and a mini map you can tap to jump
//   one small message at a time (a quiet, prioritized queue); a pause card with "How to play".
// It also owns the Hang Out controls: tap a group (card or in the park), then tap a spot or the ground.
// In the park it draws only what explains the game: the five spot names (in the colour of whoever is
// hanging out there), small patience tags over groups, "+1" where points are earned, the selection ring,
// and a path preview. If no 3D Hang Out layer is loaded it also draws the groups and spot rings itself.
// Audio: Hang Out events are mapped onto the existing SQ.audio sounds.
//
// SQ.hangoutHud:
//   init()  setMatch(match|null)  update(match, realDt)
//   select(gid, {center, quiet})  deselect()  selected -> gid | -1   send(target) -> bool
//   tapWorld(clientX, clientY, {touch, order})  hover(clientX, clientY)  key(KeyboardEvent) -> handled
//   pick(clientX, clientY, touch) -> {kind: 'group'|'spot'|'ground'|'none', ...}
//   recenter()  zoom(+1|-1)  rotate(+1|-1)
//   say(text, {pri, ttl, key, at: {x, z}, icon, html})   coach(spec | null)   el(key, arg) -> element
//   reveal({top, clock, them, cards, cam, mini})   openPause() (think pause: map and cards stay usable)  resume()
//   openMenu() (the full pause card)  closePause()  howToHTML()   note(x, y, text, kind)  inPark(x, z)
//   onEvent(fn(name, payload))  (the tutorial listens to every match event through this)
//   names: spotName(spot | idx, 'the'|'bare'), groupName(g, mid)
(function (SQ) {
  'use strict';
  const hasDoc = typeof document !== 'undefined';
  const TAU = Math.PI * 2;

  const H = SQ.hangoutHud = {
    root: null, match: null, sel: -1, E: {}, offs: [], listeners: [],
    _slow: 0, _mini: 0, _coachT: 0, _t: 0,
  };

  // ------------------------------------------------------------------ helpers
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined && html !== null) e.innerHTML = html; return e; }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function setting(k, d) { try { if (SQ.settings && SQ.settings.get) { const v = SQ.settings.get(k); return v === undefined ? d : v; } } catch (e) { /* */ } return d; }
  function play(name, opts) { try { if (SQ.audio && SQ.audio.play) return SQ.audio.play(name, opts || {}); } catch (e) { /* audio optional */ } return false; }
  function vibrate(ms) { try { if (setting('haptics', true) && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* */ } }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function now() { return performance.now() / 1000; }
  function st() { return H.match && H.match.state; }
  function meIdx() { const s = st(); return s ? (s.player >= 0 ? s.player : 0) : 0; }
  function mySide() { const s = st(); return s ? s.sides[meIdx()] : null; }
  function themIdx() { const s = st(); if (!s) return 1; for (const sd of s.sides) if (sd.idx !== meIdx()) return sd.idx; return 1; }
  function myGroups() { const s = st(); return s ? s.groups.filter((g) => g.side === meIdx()) : []; }
  function alpha() { return SQ.game && isFinite(SQ.game.alpha) ? SQ.game.alpha : 1; }
  function gpos(g) { const a = alpha(); return { x: g.px + (g.x - g.px) * a, z: g.pz + (g.z - g.pz) * a }; }
  function groundY(x, z) { try { return SQ.render && SQ.render.groundY ? SQ.render.groundY(x, z) || 0 : 0; } catch (e) { return 0; } }
  const _p = {};
  function project(x, y, z) {
    const R = SQ.render;
    if (!R || !R.worldToScreen || !R.renderer) return null;
    const p = R.worldToScreen(x, y, z, _p);
    return { x: p.x, y: p.y, on: !!p.onScreen, behind: !!p.behind };
  }
  function toGround(cx, cy) { try { return SQ.render && SQ.render.screenToGround ? SQ.render.screenToGround(cx, cy) : null; } catch (e) { return null; } }
  function ppm(x, y, z) { try { return SQ.render && SQ.render.pxPerMeter ? SQ.render.pxPerMeter(x, y, z) : 6; } catch (e) { return 6; } }
  function fmtClock(sec) { sec = Math.max(0, Math.ceil(sec - 1e-6)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function hexA(hex, a) {
    const h = String(hex || '#888').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  const CB = { hustle: '#0072B2', noise: '#F0E442', violets: '#CC79A7', pack: '#D55E00' };
  function sideColor(k) {
    const s = st(); const sd = s && s.sides[k];
    if (!sd) return '#888';
    if (setting('colorblind', false) && CB[sd.crew]) return CB[sd.crew];
    return sd.color || '#888';
  }
  function touchUI() { return !!(SQ.input && SQ.input.isTouch) || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches); }
  function tapW(capital) { const w = touchUI() ? 'tap' : 'click'; return capital ? w.charAt(0).toUpperCase() + w.slice(1) : w; }

  // Plain-English names for the five spots ("at the Fountain", "Fountain"): the same names as the signs over
  // the spots in the park, the tags and the Park Report (one name per spot: SQ.data.hangout.spots).
  function spotName(sp, form) {
    const s = st();
    if (typeof sp === 'number') sp = s && s.spots[sp];
    if (!sp) return 'there';
    if (form === 'bare') return sp.short || String(sp.name || '').replace(/^The /, '');
    return sp.the || String(sp.name || '').replace(/^The /, 'the ');
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  /** "The Old Heads" at the start of a sentence, "the Old Heads" in the middle. */
  function groupName(g, mid) { if (!g) return ''; const n = g.name || ''; return mid ? n.replace(/^The /, 'the ') : n; }
  function crewName(k, mid) { const s = st(); const sd = s && s.sides[k]; const n = (sd && sd.name) || 'They'; return mid ? n.replace(/^The /, 'the ') : n; }
  H.spotName = spotName; H.groupName = groupName;

  // Tiny inline icons (identical on every platform).
  const IC = {
    coffee: '<svg viewBox="0 0 24 24" class="ic"><path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" fill="currentColor"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 3c-1 1.5 1 2.5 0 4M12 3c-1 1.5 1 2.5 0 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    argue: '<svg viewBox="0 0 24 24" class="ic"><path d="M3 5h11v7H8l-3 3v-3H3z" fill="currentColor"/><path d="M10 14h4l3-3v3h4V8h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    walk: '<svg viewBox="0 0 24 24" class="ic"><circle cx="13" cy="4" r="2.2" fill="currentColor"/><path d="M12 8l-3 5 3 2-1 6M12 8l3 4 3 1M9 13l-3 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    hang: '<svg viewBox="0 0 24 24" class="ic"><path d="M4 18h16M6 18v-4h12v4M8 14V9a4 4 0 0 1 8 0v5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    settle: '<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    idle: '<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="5" r="2.2" fill="currentColor"/><path d="M12 9v6M12 15l-2 6M12 15l2 6M8 11h8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    look: '<svg viewBox="0 0 24 24" class="ic"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
    clock: '<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 9v4h3M9 2h6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    rotL: '<svg viewBox="0 0 24 24"><path d="M5 11a7.5 7.5 0 1 1 2.2 6.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M2 7l3 5 5-3" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    rotR: '<svg viewBox="0 0 24 24"><path d="M19 11a7.5 7.5 0 1 0-2.2 6.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M22 7l-3 5-5-3" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    find: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>',
  };
  H.icons = IC;

  // ------------------------------------------------------------------ DOM
  function build() {
    const app = document.getElementById('app') || document.body;
    const r = el('div', 'ho');
    r.id = 'ho-hud';
    r.setAttribute('aria-live', 'off');
    const E = H.E;
    E.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    E.svg.setAttribute('class', 'ho-world');
    E.svgRings = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    E.svgGroups = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    E.svgFx = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    E.svg.appendChild(E.svgRings); E.svg.appendChild(E.svgGroups); E.svg.appendChild(E.svgFx);
    E.labels = el('div', 'ho-labels');
    E.top = el('div', 'ho-top');
    E.top.innerHTML =
      '<button class="ho-btn ho-pause" type="button" aria-label="Pause" title="Pause (P)">' + IC.pause + '</button>' +
      '<div class="ho-score">' +
      '<div class="ho-side me"><span class="ho-who">You</span><b class="ho-pts">0</b><i class="ho-rate"></i></div>' +
      '<div class="ho-clock"><b>5:00</b><span>left</span></div>' +
      '<div class="ho-side them"><span class="ho-who">Them</span><b class="ho-pts">0</b><i class="ho-rate"></i></div>' +
      '</div>';
    E.pause = E.top.querySelector('.ho-pause');
    E.score = E.top.querySelector('.ho-score');
    E.sMe = E.top.querySelector('.ho-side.me'); E.sThem = E.top.querySelector('.ho-side.them');
    E.clock = E.top.querySelector('.ho-clock');
    E.pause.addEventListener('click', (e) => { e.stopPropagation(); play('click'); H.openPause(); });
    E.mini = el('div', 'ho-mini');
    E.mini.innerHTML = '<canvas aria-label="Map of the park: tap to look there"></canvas><span class="ho-mini-n">N</span>';
    E.miniC = E.mini.querySelector('canvas');
    E.miniN = E.mini.querySelector('.ho-mini-n');
    miniInput(E.miniC);
    E.cam = el('div', 'ho-cam');
    const kb = (k) => (touchUI() ? '' : ' (' + k + ')');
    E.cam.innerHTML =
      '<button class="ho-btn" data-c="in" type="button" aria-label="Zoom in">' + IC.plus + '</button>' +
      '<button class="ho-btn" data-c="out" type="button" aria-label="Zoom out">' + IC.minus + '</button>' +
      '<button class="ho-btn" data-c="rl" type="button" aria-label="Turn the view left">' + IC.rotL + '</button>' +
      '<button class="ho-btn" data-c="rr" type="button" aria-label="Turn the view right">' + IC.rotR + '</button>' +
      '<button class="ho-btn ho-find" data-c="find" type="button" aria-label="Show my groups">' + IC.find + '</button>';
    const tips = { in: 'Zoom in' + kb('scroll wheel or +'), out: 'Zoom out' + kb('scroll wheel or -'), rl: 'Turn left' + kb('Q, or drag with the right mouse button'), rr: 'Turn right' + kb('E, or drag with the right mouse button'), find: 'Show my groups' + kb('Space') };
    E.cam.querySelectorAll('[data-c]').forEach((b) => {
      b.title = tips[b.dataset.c];
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const c = b.dataset.c;
        if (c === 'in') H.zoom(1); else if (c === 'out') H.zoom(-1);
        else if (c === 'rl') H.rotate(-1); else if (c === 'rr') H.rotate(1);
        else H.recenter();
        fire('ui', { kind: 'cam', what: c });
      });
    });
    E.msg = el('div', 'ho-msg');
    E.msg.setAttribute('role', 'status');
    E.msg.setAttribute('aria-live', 'polite');
    E.msg.addEventListener('click', (e) => { e.stopPropagation(); onMsgTap(e); });
    E.cards = el('div', 'ho-cards');
    E.banner = el('div', 'ho-banner');
    E.tip = el('div', 'ho-tip');
    E.think = el('div', 'ho-think');
    E.think.setAttribute('role', 'status');
    E.modal = el('div', 'ho-modal');
    E.modal.addEventListener('pointerdown', (e) => { if (e.target === E.modal && H._modalClose) H._modalClose(); });
    for (const k of ['svg', 'labels', 'top', 'mini', 'cam', 'msg', 'cards', 'tip', 'think', 'banner', 'modal']) r.appendChild(E[k]);
    app.appendChild(r);
    H.root = r;
  }

  H.init = function () {
    if (!hasDoc || H.root) return;
    build();
    if (SQ.bus) {
      SQ.bus.on('settings', () => { if (H.match) { H._cardsKey = ''; restyle(); } });
      SQ.bus.on('gamePause', (p) => {
        if (H.root) H.root.classList.toggle('paused', !!(p && p.paused));
        if (!(p && p.paused)) {
          if (H._pauseOpen) closeModal();
          if (H._thinking) { H._thinking = false; H.E.think.className = 'ho-think'; H.root.classList.remove('thinking'); }
        }
      });
    }
    window.addEventListener('resize', () => { H._miniStatic = null; H._resized = true; });
  };

  // ------------------------------------------------------------------ lifecycle
  H.setMatch = function (m) {
    if (!H.root) H.init();
    if (!H.root) return;
    for (const off of H.offs) off();
    H.offs = [];
    H.match = m || null;
    H.sel = -1; H.selSentAt = 0; H._lastTapCard = { gid: -1, t: 0 };
    H._q = []; H._cur = null; H._coach = null; H._msgShown = '';
    H._floaters = []; H._path = null; H._pings = []; H._lastOrder = 0; H._idleSince = {};
    H._tipT = {}; H._ended = false; H._lastHold = {}; H._lostAt = {}; H._n = {}; H._coffeeAt = {}; H._sentTo = {}; H._leftAt = {};
    H._cardsKey = ''; H._miniStatic = null; H._minis = null; H._thinking = false;
    if (H.E.note) H.E.note.className = 'ho-note';
    H.E.labels.innerHTML = ''; H._spotEls = null; H._tagEls = null;
    H.E.svgRings.innerHTML = ''; H.E.svgGroups.innerHTML = ''; H.E.svgFx.innerHTML = '';
    H.E.banner.className = 'ho-banner'; H.E.banner.innerHTML = '';
    H.E.msg.className = 'ho-msg'; H.E.msg.innerHTML = '';
    H.E.tip.className = 'ho-tip';
    closeModal(true);
    H.root.classList.toggle('on', !!m);
    H.root.classList.remove('over', 'paused');
    if (H.E.think) H.E.think.className = 'ho-think';
    // nothing is on the message line now: speech bubbles in the park may talk again (a match quit while a
    // message was up must not leave them switched off for the next one)
    syncBubbles();
    if (!m) { H.reveal(null); return; }
    H.reveal(null);
    const s = m.state;
    H.timed = m.rules.length > 0;
    H.root.classList.toggle('untimed', !H.timed);
    restyle();
    buildCards();
    buildWorld();
    // match events
    const on = (name, fn) => { const f = (p) => { try { fn(p || {}); } catch (e) { console.error('[hangout hud]', name, e); } fire(name, p || {}); }; m.bus.on(name, f); H.offs.push(() => m.bus.off(name, f)); };
    for (const n of ['matchStart', 'ordered', 'settleStart', 'settled', 'spotFree', 'earning', 'score', 'argueStart', 'argueEnd', 'wentForCoffee', 'returned', 'bark', 'clockWarn', 'matchEnd', 'cmdRejected']) {
      on(n, handlers[n] || (() => {}));
    }
    try {
      if (SQ.audio && SQ.audio.setMusic) SQ.audio.setMusic('calm', s.sides[meIdx()].crew);
      if (SQ.audio && SQ.audio.setAmbience) SQ.audio.setAmbience('afternoon', 0.5);
    } catch (e) { /* */ }
    H.update(m, 0, true);
  };

  function restyle() {
    const s = st(); if (!s || !H.root) return;
    H.root.style.setProperty('--me', sideColor(meIdx()));
    H.root.style.setProperty('--them', sideColor(themIdx()));
    H.root.classList.toggle('lefty', !!setting('leftHanded', false));
    H.root.classList.toggle('touch', touchUI());
    H.E.sMe.querySelector('.ho-who').textContent = 'You';
    H.E.sThem.querySelector('.ho-who').textContent = crewName(themIdx());
    H.E.sMe.title = 'Your points (' + crewName(meIdx(), true) + ')';
    H.E.sThem.title = crewName(themIdx()) + ': their points';
    H._miniStatic = null;
  }

  /** Show or hide HUD parts (the tutorial reveals them one at a time). null = everything. */
  H.reveal = function (spec) {
    const all = { top: true, clock: true, them: true, cards: true, cam: true, mini: true, world: true };
    H._reveal = Object.assign({}, all, spec || {});
    if (!H.root) return;
    for (const k of Object.keys(all)) H.root.classList.toggle('no-' + k, !H._reveal[k]);
  };

  function fire(name, p) { for (const fn of H.listeners.slice()) { try { fn(name, p); } catch (e) { console.error('[hangout hud] listener', e); } } }
  H.onEvent = function (fn) { H.listeners.push(fn); return () => { const i = H.listeners.indexOf(fn); if (i >= 0) H.listeners.splice(i, 1); }; };

  // ------------------------------------------------------------------ cards
  function buildCards() {
    const C = H.E.cards; C.innerHTML = '';
    H._cardEls = {};
    myGroups().forEach((g, k) => {
      const b = el('button', 'ho-card');
      b.type = 'button';
      b.dataset.gid = g.id;
      b.innerHTML =
        '<span class="hc-head"><span class="hc-key">' + (k + 1) + '</span><b class="hc-name">' + esc(g.name) + '</b></span>' +
        '<span class="hc-barrow"><span class="hc-bar" title="Patience: arguing drains it, it refills when nobody argues with them"><i></i></span><span class="hc-pl">patience</span></span>' +
        '<span class="hc-st"><span class="hc-ic"></span><span class="hc-tx"></span></span>' +
        '<span class="hc-sub"></span>';
      b.title = g.name + (touchUI() ? '' : ' (' + (k + 1) + ')');
      b.addEventListener('click', (e) => { e.stopPropagation(); cardTap(g.id); });
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      C.appendChild(b);
      H._cardEls[g.id] = { b, bar: b.querySelector('.hc-bar i'), barW: b.querySelector('.hc-bar'), ic: b.querySelector('.hc-ic'), tx: b.querySelector('.hc-tx'), sub: b.querySelector('.hc-sub'), key: '' };
    });
  }

  function cardTap(gid) {
    const t = now();
    if (H.sel === gid) {
      // tap the selected card again: the camera jumps to that group
      const g = st().groups[gid];
      if (g) focusGroup(g);
      play('click');
      fire('ui', { kind: 'cardAgain', group: gid });
      return;
    }
    H.select(gid);
    H._lastTapCard = { gid, t };
  }

  function focusGroup(g) {
    if (!SQ.camera) return;
    if (g.coffee) {
      const e = st().sides[g.side].entrance;
      SQ.camera.focus(e.x, e.z);
      H.say(groupName(g) + ' are getting coffee. They come back here, at ' + e.name + '.', { pri: 2, ttl: 3, key: 'focusCoffee', icon: 'coffee' });
    } else { const p = gpos(g); SQ.camera.focus(p.x, p.z); }
  }

  /**
   * Who runs out of patience first in the argument group g is in, from the bars and the drain rule:
   * {mine, theirs (the rival nearest to running out), first: 'you'|'them'|'tie', tieStays: 'you'|'them'|'nobody'}.
   */
  function argueOdds(g) {
    const s = st(), m = H.match; if (!s || !m || g.at < 0) return null;
    const drain = m.rules.drainPerRival || 9;
    const here = s.groups.filter((q) => q.at === g.at && !q.coffee);
    const rivals = here.filter((q) => q.side !== g.side), mates = here.filter((q) => q.side === g.side);
    if (!rivals.length) return null;
    const myT = g.patience / Math.max(1e-6, drain * rivals.length);
    let low = rivals[0], lowT = Infinity;
    for (const r of rivals) { const t = r.patience / Math.max(1e-6, drain * mates.length); if (t < lowT) { lowT = t; low = r; } }
    const sp = s.spots[g.at];
    const first = Math.abs(myT - lowT) < 0.35 ? 'tie' : myT < lowT ? 'you' : 'them';
    const tieStays = sp.holder === g.side ? 'you' : sp.holder >= 0 ? 'them' : 'nobody';
    return { mine: Math.round(g.patience), theirs: Math.round(low.patience), first, tieStays, rivals: rivals.length, mates: mates.length, holder: sp.holder === g.side };
  }
  function oddsWords(o) {
    if (!o) return '';
    if (o.first === 'you') return 'you give up first';
    if (o.first === 'them') return 'they give up first';
    return o.tieStays === 'you' ? 'a tie: you stay, you were here first' : o.tieStays === 'them' ? 'a tie: they stay, they were here first' : 'a tie: you both give up';
  }

  function statusOf(g, narrow) {
    const s = st();
    const sp = g.at >= 0 ? s.spots[g.at] : (g.spot >= 0 ? s.spots[g.spot] : null);
    // (an order given while the clock is stopped shows at once: the sim updates statuses when it ticks)
    const status = !g.coffee && g.status === 'idle' && g.moving ? 'walking' : g.status;
    switch (status) {
      case 'coffee': {
        // after coffee a group walks back to the spot it left by itself; an order given now replaces that
        const dest = g.pending && g.pending.spot >= 0 ? g.pending.spot : (g.lastSpot >= 0 && H.match.rules.returnTo === 'last' ? g.lastSpot : -1);
        const sub = g.pending && g.pending.spot >= 0 ? 'then to ' + spotName(dest, 'bare') + ' (your order)'
          : dest >= 0 ? 'then back to ' + spotName(dest, 'bare') + ' (' + tapW() + ' to change)' : 'then they wait at your entrance';
        return { ic: 'coffee', tx: 'Getting coffee, back in ' + fmtClock(g.backIn), sub, cls: 'coffee' };
      }
      case 'arguing': {
        const rivals = s.groups.filter((q) => q.at === g.at && q.side !== g.side && !q.coffee);
        const who = rivals.length === 1 ? groupName(rivals[0], true) : rivals.length + ' groups';
        const holder = sp && sp.holder === g.side;
        const o = argueOdds(g);
        if (o && narrow) return { ic: 'argue', tx: 'Arguing: you ' + o.mine + ', them ' + o.theirs, sub: oddsWords(o), cls: 'arguing' };
        if (o) return { ic: 'argue', tx: 'Arguing with ' + who + (holder ? ' · still earning +1/s' : ''), sub: 'Patience: you ' + o.mine + ', them ' + o.theirs + ' (' + oddsWords(o) + ')', cls: 'arguing' };
        return { ic: 'argue', tx: 'Arguing with ' + who, sub: holder ? 'still earning +1/s' : 'at ' + spotName(sp), cls: 'arguing' };
      }
      case 'hanging': {
        const mates = s.groups.filter((q) => q.at === g.at && q.side === g.side && q.id !== g.id && !q.coffee);
        const shared = mates.length > 0;
        return { ic: 'hang', tx: 'Hanging out at ' + spotName(sp), sub: shared ? '+1/s together with ' + groupName(mates[0], true) : '+1 point a second', cls: 'hanging' };
      }
      case 'settling': {
        const left = sp ? Math.max(0, H.match.rules.settleTime - sp.settle) : 0;
        return { ic: 'settle', tx: 'Settling in at ' + spotName(sp), sub: Math.ceil(left) + ' s until it earns', cls: 'settling' };
      }
      case 'walking': {
        let eta = '';
        if (g.spot >= 0) { try { eta = Math.max(1, Math.round(H.match.eta(g.id, g.spot))) + ' s away'; } catch (e) { eta = ''; } }
        return { ic: 'walk', tx: g.spot >= 0 ? 'Walking to ' + spotName(g.spot) : 'Walking', sub: eta, cls: 'walking' };
      }
      default:
        return { ic: 'idle', tx: 'Standing around', sub: 'free to send', cls: 'idle' };
    }
  }

  function updateCards() {
    const s = st(); if (!s || !H._cardEls) return;
    const max = H.match.rules.patienceMax || 100;
    for (const g of myGroups()) {
      const c = H._cardEls[g.id]; if (!c) continue;
      const narrow = c.b.offsetWidth > 0 && c.b.offsetWidth < 190;
      const S = statusOf(g, narrow);
      const key = S.ic + '|' + S.tx + '|' + S.sub + '|' + (H.sel === g.id);
      const p = clamp(g.patience / max, 0, 1);
      c.bar.style.width = (p * 100).toFixed(1) + '%';
      // the bar is neutral (it is not health): amber when it gets low, red when nearly out
      c.barW.classList.toggle('mid', p < 0.6 && p >= 0.3 && !g.coffee);
      c.barW.classList.toggle('low', p < 0.3 && !g.coffee);
      c.barW.classList.toggle('drain', !!g.arguing);
      c.barW.classList.toggle('fill', !g.arguing && !g.coffee && p < 0.999);
      if (key !== c.key) {
        c.key = key;
        c.ic.innerHTML = IC[S.ic] || '';
        c.tx.textContent = S.tx;
        c.sub.textContent = S.sub;
        c.b.className = 'ho-card st-' + S.cls + (H.sel === g.id ? ' sel' : '');
        c.b.setAttribute('aria-label', g.name + ': ' + S.tx + (S.sub ? ', ' + S.sub : '') + '. Patience ' + Math.round(p * 100) + ' percent.' + (H.sel === g.id ? ' Selected.' : ''));
      }
    }
  }

  // ------------------------------------------------------------------ top bar
  function updateTop() {
    const s = st(); if (!s) return;
    const a = s.sides[meIdx()], b = s.sides[themIdx()];
    const set = (box, side) => {
      const pts = box.querySelector('.ho-pts'), rate = box.querySelector('.ho-rate');
      const v = String(side ? side.points : 0);
      if (pts.textContent !== v) {
        pts.textContent = v;
        box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump');
      }
      const rt = side && side.rate > 0 ? '+' + side.rate + '/s' : '';
      if (rate.textContent !== rt) rate.textContent = rt;
      box.title = (box === H.E.sMe ? 'Your points' : crewName(themIdx()) + ': their points') + (side && side.rate ? ' (+' + side.rate + ' a second: hanging out at ' + side.holding + ' spot' + (side.holding === 1 ? '' : 's') + ')' : '');
    };
    set(H.E.sMe, a); set(H.E.sThem, b);
    H.E.sMe.classList.toggle('lead', !!(a && b && a.points > b.points));
    H.E.sThem.classList.toggle('lead', !!(a && b && b.points > a.points));
    if (H.timed) {
      const t = fmtClock(s.timeLeft);
      const cb = H.E.clock.querySelector('b');
      if (cb.textContent !== t) cb.textContent = t;
      H.E.clock.classList.toggle('warn', s.timeLeft <= 30 && !s.over);
      H.E.clock.title = 'Time left. Most points when it reaches 0:00 wins.';
    }
  }

  // ------------------------------------------------------------------ world layer
  // With the 3D Hang Out view (js/render/hangout-view.js) attached, the park draws groups, tags, patience bars,
  // spot labels, "+1"s, the selection ring and paths; this HUD only tells it what is selected / hovered /
  // highlighted. Without it, the HUD draws a light fallback of all of that here.
  function hv() { const V = SQ.hangoutView; return V && V.attached ? V : null; }
  H.view = hv;
  function renderDrawsHangout() { return !!hv(); }
  // The message line is the only transient text on screen: speech bubbles in the park wait while it is busy.
  function syncBubbles() {
    const V = SQ.hangoutView;
    if (!V || !V.options) return;
    const busy = !!H._coach || !!(H._cur && H.E.msg && H.E.msg.classList.contains('show'));
    const want = busy ? 0 : 1;
    if (V.options.maxBubbles !== want) {
      V.options.maxBubbles = want;
      // let a bubble that is already up finish quickly
      if (busy && typeof V.fadeBubbles === 'function') V.fadeBubbles(0.25);
    }
  }
  function svgEl(tag, attrs) { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }

  function buildWorld() {
    const s = st(); if (!s) return;
    H._spotEls = s.spots.map((sp) => {
      const d = el('div', 'ho-spot');
      d.innerHTML = '<span class="hs-ring"></span><span class="hs-name">' + esc(spotName(sp, 'bare')) + '</span><span class="hs-st"></span>';
      H.E.labels.appendChild(d);
      const ring = svgEl('polygon', { class: 'hs-area' });
      H.E.svgRings.appendChild(ring);
      return { d, ring, nm: d.querySelector('.hs-name'), stx: d.querySelector('.hs-st'), pie: d.querySelector('.hs-ring'), key: '' };
    });
    H._tagEls = s.groups.map((g) => {
      const d = el('div', 'ho-tag' + (g.side === meIdx() ? ' mine' : ' theirs'));
      d.innerHTML = '<b>' + esc(g.short || g.name) + '</b><span class="ht-bar"><i></i></span>';
      d.style.setProperty('--c', sideColor(g.side));
      H.E.labels.appendChild(d);
      const dots = svgEl('g', { class: 'hg-dots' });
      H.E.svgGroups.appendChild(dots);
      return { d, bar: d.querySelector('.ht-bar i'), nm: d.querySelector('b'), dots, n: 0 };
    });
    H._selRing = svgEl('ellipse', { class: 'ho-selring', rx: 0, ry: 0, cx: -99, cy: -99 });
    H._dest = svgEl('ellipse', { class: 'ho-dest', rx: 0, ry: 0, cx: -99, cy: -99 });
    H._pathEl = svgEl('polyline', { class: 'ho-path', points: '' });
    H.E.svgFx.appendChild(H._pathEl); H.E.svgFx.appendChild(H._dest); H.E.svgFx.appendChild(H._selRing);
  }

  function circlePts(cx, cz, r, n) {
    const out = [];
    for (let k = 0; k < n; k++) { const a = k / n * TAU; out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
    return out;
  }
  function polyScreen(pts, y) {
    let s = '';
    for (const q of pts) {
      const p = project(q[0], y === undefined ? groundY(q[0], q[1]) + 0.05 : y, q[1]);
      if (!p || p.behind) return '';
      s += p.x.toFixed(1) + ',' + p.y.toFixed(1) + ' ';
    }
    return s;
  }

  function updateWorld(dt) {
    const s = st(); if (!s || !H._spotEls) return;
    const V = hv();
    H.root.classList.toggle('hv', !!V);
    if (V) {
      if (V.selected !== H.sel) V.select(H.sel);
      return;
    }
    const fallback = true;
    H.root.classList.toggle('fb', fallback);
    const me = meIdx();
    const vw = window.innerWidth, vh = window.innerHeight;
    // spots
    s.spots.forEach((sp, i) => {
      const E = H._spotEls[i];
      const y = groundY(sp.x, sp.z);
      const p = project(sp.x, y + 0.6, sp.z);
      if (!p || p.behind || p.x < -80 || p.x > vw + 80 || p.y < -40 || p.y > vh + 40) { E.d.style.display = 'none'; E.ring.setAttribute('points', ''); E.sx = null; return; }
      E.d.style.display = '';
      E.sx = p.x; E.sy = p.y;
      E.d.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px)';
      const holder = sp.holder;
      let cls = 'ho-spot', stx = '';
      if (sp.arguing) { cls += ' arguing'; stx = 'arguing'; }
      if (holder >= 0) { cls += holder === me ? ' held mine' : ' held theirs'; if (!sp.arguing) stx = holder === me ? '+1/s' : crewShort(holder); }
      else if (sp.settleSide >= 0) { cls += ' settling' + (sp.settleSide === me ? ' mine' : ' theirs'); stx = 'settling in'; }
      if (H._hoverSpot === i) cls += ' hover';
      if (H._targetSpot === i) cls += ' target';
      const key = cls + '|' + stx;
      if (key !== E.key) {
        E.key = key; E.d.className = cls; E.stx.textContent = stx;
        E.d.style.setProperty('--c', holder >= 0 ? sideColor(holder) : sp.settleSide >= 0 ? sideColor(sp.settleSide) : '#f4eedf');
      }
      if (sp.settleSide >= 0 && holder < 0) E.pie.style.setProperty('--k', (sp.settle / H.match.rules.settleTime * 360).toFixed(0) + 'deg');
      // ground ring (fallback drawing, or a light outline that shows the spot area)
      const pts = sp.poly ? sp.poly : circlePts(sp.x, sp.z, sp.r, 36);
      const ps = polyScreen(pts);
      E.ring.setAttribute('points', ps);
      E.ring.setAttribute('class', 'hs-area' + (holder >= 0 ? ' held' : '') + (sp.arguing ? ' arguing' : '') + (fallback ? ' fb' : ''));
      E.ring.style.setProperty('--c', holder >= 0 ? sideColor(holder) : '#fff8d8');
    });
    // groups
    const max = H.match.rules.patienceMax || 100;
    const zoomedIn = (SQ.camera && SQ.camera.height ? SQ.camera.height : 120) < 95;
    const tags = [];
    s.groups.forEach((g, i) => {
      const T = H._tagEls[i];
      if (g.coffee) { T.d.style.display = 'none'; if (T.n) { T.dots.innerHTML = ''; T.n = 0; } return; }
      const q = gpos(g);
      const y = groundY(q.x, q.z);
      const p = project(q.x, y + 2.9, q.z);
      if (!p || p.behind || p.x < -60 || p.x > vw + 60 || p.y < -30 || p.y > vh + 30) { T.d.style.display = 'none'; if (T.n) { T.dots.innerHTML = ''; T.n = 0; } return; }
      T.d.style.display = '';
      T.bar.style.width = (clamp(g.patience / max, 0, 1) * 100).toFixed(1) + '%';
      const mine = g.side === me;
      const showName = mine && (zoomedIn || H.sel === g.id || H._hoverGroup === g.id || !!(H._reveal && H._reveal.names));
      T.d.className = 'ho-tag ' + (mine ? 'mine' : 'theirs') + (H.sel === g.id ? ' sel' : '') + (showName ? ' named' : '') + (g.arguing ? ' arguing' : '') + (g.patience / max < 0.35 ? ' low' : '');
      tags.push({ T, x: p.x, y: p.y, g });
      // fallback: draw the group's people as dots
      if (fallback) {
        const n = g.offsets.length;
        if (T.n !== n) { T.dots.innerHTML = ''; for (let k = 0; k < n; k++) T.dots.appendChild(svgEl('circle', { r: 3 })); T.n = n; }
        const c = Math.cos(g.facing), sn = Math.sin(g.facing);
        const scale = ppm(q.x, y, q.z);
        for (let k = 0; k < n; k++) {
          const o = g.offsets[k];
          const wx = q.x + o[0] * c + o[1] * sn, wz = q.z - o[0] * sn + o[1] * c;
          const pp = project(wx, groundY(wx, wz) + 0.8, wz);
          const dot = T.dots.childNodes[k];
          if (!pp || pp.behind) { dot.setAttribute('cx', -99); continue; }
          dot.setAttribute('cx', pp.x.toFixed(1)); dot.setAttribute('cy', pp.y.toFixed(1));
          dot.setAttribute('r', clamp(scale * 0.45, 2.5, 9).toFixed(1));
          dot.setAttribute('fill', sideColor(g.side));
        }
      } else if (T.n) { T.dots.innerHTML = ''; T.n = 0; }
    });
    // keep tags from sitting on top of each other (greedy, top to bottom)
    tags.sort((a, b) => a.y - b.y);
    const placed = [];
    for (const t of tags) {
      let y = t.y;
      const w = t.T.d.classList.contains('named') ? 84 : 40;
      for (let pass = 0; pass < 4; pass++) {
        let hit = false;
        for (const q of placed) if (Math.abs(q.x - t.x) < (q.w + w) / 2 && Math.abs(q.y - y) < 15) { y = q.y - 15; hit = true; }
        if (!hit) break;
      }
      placed.push({ x: t.x, y, w });
      t.T.d.style.transform = 'translate(' + t.x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    }
    // selection ring + destination
    const sg = H.sel >= 0 ? s.groups[H.sel] : null;
    if (sg && !sg.coffee) {
      const q = gpos(sg);
      const p = project(q.x, groundY(q.x, q.z) + 0.05, q.z);
      const k = ppm(q.x, 0, q.z);
      if (p && !p.behind) {
        H._selRing.setAttribute('cx', p.x.toFixed(1)); H._selRing.setAttribute('cy', p.y.toFixed(1));
        H._selRing.setAttribute('rx', Math.max(16, k * 2.6).toFixed(1)); H._selRing.setAttribute('ry', Math.max(9, k * 2.6 * 0.55).toFixed(1));
        H._selRing.style.stroke = sideColor(me);
      } else H._selRing.setAttribute('cx', -99);
      if (sg.moving && sg.spot >= 0) {
        const sp = s.spots[sg.spot];
        const d = project(sp.x, groundY(sp.x, sp.z) + 0.05, sp.z);
        const kk = ppm(sp.x, 0, sp.z);
        if (d && !d.behind) {
          H._dest.setAttribute('cx', d.x.toFixed(1)); H._dest.setAttribute('cy', d.y.toFixed(1));
          H._dest.setAttribute('rx', Math.max(20, kk * sp.r * 0.8).toFixed(1)); H._dest.setAttribute('ry', Math.max(11, kk * sp.r * 0.45).toFixed(1));
        } else H._dest.setAttribute('cx', -99);
      } else H._dest.setAttribute('cx', -99);
    } else { H._selRing.setAttribute('cx', -99); H._dest.setAttribute('cx', -99); }
    // path preview (fades)
    if (H._path) {
      H._path.t += dt;
      const P = H._path;
      if (P.t > P.life) { H._pathEl.setAttribute('points', ''); H._path = null; }
      else {
        let str = '';
        for (const q of P.pts) { const pp = project(q[0], groundY(q[0], q[1]) + 0.15, q[1]); if (pp && !pp.behind) str += pp.x.toFixed(1) + ',' + pp.y.toFixed(1) + ' '; }
        H._pathEl.setAttribute('points', str);
        H._pathEl.style.opacity = String(clamp((P.life - P.t) / 0.5, 0, 1));
        H._pathEl.style.stroke = sideColor(me);
      }
    }
    // +1 floaters ride with their spots
    for (let i = H._floaters.length - 1; i >= 0; i--) {
      const f = H._floaters[i];
      f.t += dt;
      if (f.t > 1.1) { f.e.remove(); H._floaters.splice(i, 1); continue; }
      const E = H._spotEls[f.spot];
      if (!E || E.sx === null || E.sx === undefined) { f.e.style.display = 'none'; continue; }
      f.e.style.display = '';
      f.e.style.transform = 'translate(' + (E.sx + f.dx).toFixed(1) + 'px,' + (E.sy - 22 - f.t * 30).toFixed(1) + 'px)';
      f.e.style.opacity = String(clamp(1.4 - f.t * 1.3, 0, 1));
    }
  }
  function crewShort(k) { const s = st(); const sd = s && s.sides[k]; const fd = sd && SQ.data.factions && SQ.data.factions[sd.crew]; return fd ? fd.short : (sd ? sd.name : ''); }

  function floater(spotIdx, side, amount) {
    if (hv() || !H._spotEls || setting('reducedMotion', false) && H._floaters.length > 3) return;
    const f = el('div', 'ho-float' + (side === meIdx() ? ' mine' : ' theirs'), '+' + (amount || 1));
    f.style.setProperty('--c', sideColor(side));
    H.E.labels.appendChild(f);
    H._floaters.push({ e: f, spot: spotIdx, t: 0, dx: (side === meIdx() ? -10 : 10) });
  }

  // ------------------------------------------------------------------ picking + orders
  /**
   * What is under a screen point: {kind: 'group', group, direct} (any side; direct = right on the people or
   * their tag) | {kind: 'spot', spot} | {kind: 'ground', x, z} | {kind: 'none'}. Generous on touch.
   */
  H.pick = function (cx, cy, touch) {
    const s = st(); if (!s) return { kind: 'none' };
    if (touch === undefined) touch = touchUI();
    const V = hv();
    if (V) {
      const r = V.pick(cx, cy, { touch });
      if (!r) return { kind: 'none' };
      if (r.type === 'group') {
        const g = s.groups[r.id];
        const sp = V.screenPos({ group: r.id });
        let direct = true;
        if (sp && !sp.behind) {
          const dBody = Math.hypot(sp.x - cx, sp.y - cy);
          const dTag = sp.tagY !== undefined ? Math.hypot(sp.tagX - cx, sp.tagY - cy) : Infinity;
          direct = dTag < 34 || dBody < (touch ? 26 : 18);
        }
        return { kind: 'group', group: r.id, side: g.side, x: g.x, z: g.z, direct };
      }
      if (r.type === 'spot') return { kind: 'spot', spot: r.idx, x: s.spots[r.idx].x, z: s.spots[r.idx].z };
      if (r.type === 'ground') return { kind: 'ground', x: r.x, z: r.z };
      return { kind: 'none' };
    }
    return pickFallback(cx, cy, touch);
  };
  function pickFallback(cx, cy, touch) {
    const s = st();
    const me = meIdx();
    const g0 = toGround(cx, cy);
    let best = null, bs = Infinity;
    for (const g of s.groups) {
      if (g.coffee) continue;
      const q = gpos(g);
      const y = groundY(q.x, q.z);
      const p = project(q.x, y + 1.1, q.z);
      if (!p || p.behind) continue;
      const k = ppm(q.x, y + 1, q.z);
      const rad = Math.max(touch ? 40 : 26, k * 2.8);
      let d = Math.hypot(p.x - cx, p.y - cy);
      const pt = project(q.x, y + 2.9, q.z);   // the tag over their heads counts too
      if (pt && !pt.behind) d = Math.min(d, Math.hypot(pt.x - cx, pt.y - cy) * 1.1);
      if (d > rad) continue;
      const sc = d / rad - (g.side === me ? 0.12 : 0);
      if (sc < bs) { bs = sc; best = { g, d, rad }; }
    }
    let spot = -1, ss = Infinity;
    s.spots.forEach((sp, i) => {
      let sc = Infinity;
      if (g0) {
        const inside = SQ.Hangout.inSpot(sp, g0.x, g0.z);
        const dd = Math.hypot(g0.x - sp.x, g0.z - sp.z);
        if (inside) sc = dd / Math.max(1, sp.r) * 0.5;
        else if (dd <= sp.r + (touch ? 6 : 3)) sc = 0.6 + (dd - sp.r) / 10;
      }
      const E = H._spotEls && H._spotEls[i];
      if (E && E.sx !== null && E.sx !== undefined) {
        const dl = Math.hypot(E.sx - cx, E.sy - cy);
        if (dl < (touch ? 40 : 30)) sc = Math.min(sc, 0.3 + dl / 100);
      }
      if (sc < ss) { ss = sc; spot = i; }
    });
    if (best) return { kind: 'group', group: best.g.id, side: best.g.side, x: best.g.x, z: best.g.z, direct: best.d <= best.rad * 0.5 };
    if (spot >= 0) return { kind: 'spot', spot, x: s.spots[spot].x, z: s.spots[spot].z };
    if (g0) return { kind: 'ground', x: g0.x, z: g0.z };
    return { kind: 'none' };
  }

  /**
   * A tap (or click) in the park. One rule: tap a group, then tap a spot. Every order clears the selection, so a
   * later stray tap never moves anyone.
   *   Nothing selected: a tap on one of my groups picks it; a tap on a spot says "Pick a group first".
   *   A group selected: a tap on a spot (its area, its sign, or a group standing in it) sends it there. A tap right
   *   on another of my groups picks that one instead; right on the selected one, deselects. A tap on bare ground:
   *   on a touch screen it only deselects (a slip, far more often than an order); with a mouse it walks there,
   *   inside the park only. Right click (order) never selects.
   * A short note at the tap point says what happened ("Old Heads → Fountain", "Pick a group first").
   */
  H.tapWorld = function (cx, cy, opts) {
    opts = opts || {};
    const s = st(); if (!s || s.over) return;
    if (H._pauseOpen) return;
    if (H.E.tip) H.E.tip.className = 'ho-tip';
    const touch = opts.touch !== undefined ? !!opts.touch : touchUI();
    let p = H.pick(cx, cy, touch);
    const me = meIdx();
    if (p.kind === 'group') {
      const g = s.groups[p.group];
      if (g.side === me && !opts.order) {
        if (H.sel === g.id) { if (p.direct || g.at < 0) { fire('tap', { pick: p }); H.deselect(); note(cx, cy, 'Deselected', 'info'); return; } }
        else if (H.sel < 0 || p.direct || g.at < 0) { fire('tap', { pick: p }); H.select(g.id); return; }
      }
      if (g.at >= 0) p = { kind: 'spot', spot: g.at, x: s.spots[g.at].x, z: s.spots[g.at].z };
      else { const q = toGround(cx, cy); p = q ? { kind: 'ground', x: q.x, z: q.z } : { kind: 'none' }; }
    }
    fire('tap', { pick: p, order: !!opts.order });
    if (H.sel < 0) {
      if (p.kind === 'spot') {
        note(cx, cy, 'Pick a group first', 'warn');
        if (often('pickFirst', 2, 20)) H.say('First pick a group: ' + tapW() + ' one of your cards below, then ' + tapW() + ' ' + spotName(p.spot) + '.', { pri: 2, ttl: 3.2, key: 'pickFirst' });
        pulseCards();
        play('deny');
      }
      return;
    }
    const g = s.groups[H.sel];
    if (p.kind === 'spot') {
      if (H.send(p.spot)) note(cx, cy, (g.short || g.name) + ' → ' + spotName(p.spot, 'bare'), 'ok');
    } else if (p.kind === 'ground') {
      if (touch && !opts.order) {
        note(cx, cy, 'Not a spot: ' + (g.short || g.name) + ' stay put', 'info');
        H.deselect();
        play('tick', { volume: 0.4 });
        return;
      }
      if (!inPark(p.x, p.z)) { note(cx, cy, 'Outside the park', 'warn'); play('deny'); return; }
      if (H.send({ x: p.x, z: p.z })) note(cx, cy, (g.short || g.name) + ' → here (not a spot)', 'ok');
    }
  };

  // The park's outline (GEO): ground orders stay inside it.
  let parkPoly = null;
  function inPark(x, z) {
    if (parkPoly === null) {
      const G = window.GEO;
      const a = G && (G.areas || []).find((q) => q.kind === 'park' && /Washington Square/.test(q.name || ''));
      parkPoly = a ? a.pts : false;
    }
    if (!parkPoly) return Math.abs(x) < 160 && Math.abs(z) < 75;
    let c = false;
    for (let i = 0, j = parkPoly.length - 1; i < parkPoly.length; j = i++) {
      const A = parkPoly[i], B = parkPoly[j];
      if ((A[1] > z) !== (B[1] > z) && x < (B[0] - A[0]) * (z - A[1]) / (B[1] - A[1]) + A[0]) c = !c;
    }
    return c;
  }
  H.inPark = inPark;

  // A short note at the tap point (one at a time; it fades by itself). Direct feedback, not a message.
  function note(cx, cy, text, kind) {
    if (!H.root || !hasDoc) return;
    let n = H.E.note;
    if (!n) { n = H.E.note = el('div', 'ho-note'); n.setAttribute('aria-hidden', 'true'); H.root.appendChild(n); }
    n.textContent = text;
    n.className = 'ho-note';
    void n.offsetWidth;
    n.className = 'ho-note show ' + (kind || 'info');
    n.style.left = clamp(cx, 70, window.innerWidth - 70) + 'px';
    n.style.top = clamp(cy, 60, window.innerHeight - 20) + 'px';
    clearTimeout(H._noteT);
    H._noteT = setTimeout(() => { if (H.E.note) H.E.note.className = 'ho-note'; }, 1400);
  }
  H.note = note;

  function pulseCards() { const C = H.E.cards; C.classList.remove('nudge'); void C.offsetWidth; C.classList.add('nudge'); }

  H.select = function (gid, opts) {
    opts = opts || {};
    const s = st(); if (!s) return false;
    const g = s.groups[gid];
    if (!g || g.side !== meIdx()) return false;
    const changed = H.sel !== gid;
    H.sel = gid; H.selSentAt = 0;
    if (hv()) hv().select(gid);
    if (!opts.quiet) { play('select'); vibrate(6); }
    if (opts.center) focusGroup(g);
    // first few times: say what to do next (later the player knows); a nag about idle groups gives way
    if (changed) dropMsg('idle');
    if (changed && !H._coach) {
      const n = promptCount();
      if (n < 4) H.say(g.coffee ? groupName(g) + ' are getting coffee. ' + tapW(1) + ' a spot and they will go there when they are back.' : 'Now ' + tapW() + ' a spot to send ' + groupName(g, true) + ' there.', { pri: 0, ttl: 6, key: 'selPrompt', sticky: true });
    }
    updateCards();
    fire('select', { group: gid });
    return true;
  };
  H.deselect = function () { if (H.sel < 0) return; H.sel = -1; H.selSentAt = 0; if (hv()) hv().select(-1); dropMsg('selPrompt'); updateCards(); fire('select', { group: -1 }); };
  Object.defineProperty(H, 'selected', { get() { return H.sel; } });

  function promptCount() { try { const d = SQ.save && SQ.save.data; return d && d.ho ? d.ho.prompts || 0 : 0; } catch (e) { return 0; } }
  function bumpPrompt() { try { const d = SQ.save && SQ.save.data; if (!d) return; d.ho = d.ho || {}; d.ho.prompts = (d.ho.prompts || 0) + 1; SQ.save.write(); } catch (e) { /* */ } }

  /** Send the selected group: a spot index / id, {x, z}, 'entrance' or 'stop'. Every order clears the selection. */
  H.send = function (target) {
    const m = H.match, s = st();
    if (!m || !s || H.sel < 0 || s.over) return false;
    const g = s.groups[H.sel];
    const from = gpos(g);
    const res = m.order(meIdx(), g.id, target);
    if (!res || !res.ok) { play('deny'); return false; }
    play('send');
    vibrate(10);
    H.selSentAt = now();
    H._lastOrder = now();
    H._sentTo[g.id] = { spot: g.spot, t: now() };
    dropMsg('selPrompt');
    dropMsg('pickFirst');
    if (promptCount() < 6) bumpPrompt();
    H.deselect();
    if (res.queued) {
      H.say(groupName(g) + ' will go to ' + (g.pending && g.pending.spot >= 0 ? spotName(g.pending.spot) : 'there') + ' when they are back from coffee (' + fmtClock(g.backIn) + ').', { pri: 2, ttl: 3.5, key: 'queued', icon: 'coffee' });
    } else if (!hv()) {
      // path preview (the 3D view draws its own)
      try {
        const path = s.nav.astar(from.x, from.z, g.tx, g.tz);
        H._path = { pts: [[from.x, from.z]].concat(path && path.length ? path : [[g.tx, g.tz]]), t: 0, life: 1.6 };
      } catch (e) { H._path = null; }
      if (g.spot >= 0) { H._targetSpot = g.spot; clearTimeout(H._tsT); H._tsT = setTimeout(() => { H._targetSpot = -1; }, 900); }
    }
    updateCards();
    return true;
  };

  H.hover = function (cx, cy) {
    const s = st(); if (!s || H._pauseOpen) return;
    const p = H.pick(cx, cy, false);
    H._hoverSpot = p.kind === 'spot' ? p.spot : -1;
    H._hoverGroup = p.kind === 'group' ? p.group : -1;
    const V = hv();
    if (V) V.hover(p.kind === 'group' ? { group: p.group } : p.kind === 'spot' ? { spot: p.spot } : null);
    const c = document.querySelector('#view canvas');
    const mine = p.kind === 'group' && s.groups[p.group].side === meIdx();
    if (c) c.style.cursor = mine ? 'pointer' : (H.sel >= 0 && (p.kind === 'spot' || p.kind === 'ground' || p.kind === 'group')) ? 'crosshair' : 'grab';
    // a quiet tooltip next to the mouse: where a click would send the selected group
    const T = H.E.tip;
    if (H.sel >= 0 && p.kind === 'spot' && !(s.groups[H.sel].spot === p.spot)) {
      const g = s.groups[H.sel];
      let eta = '';
      try { eta = ' · ' + Math.max(1, Math.round(H.match.eta(g.id, p.spot))) + ' s'; } catch (e) { eta = ''; }
      T.textContent = 'Send ' + (g.short || g.name) + ' to ' + spotName(p.spot, 'bare') + eta;
      T.style.transform = 'translate(' + (cx + 16) + 'px,' + (cy + 18) + 'px)';
      T.className = 'ho-tip show';
    } else if (H.sel < 0 && mine) {
      T.textContent = s.groups[p.group].name + ': click to pick';
      T.style.transform = 'translate(' + (cx + 16) + 'px,' + (cy + 18) + 'px)';
      T.className = 'ho-tip show';
    } else T.className = 'ho-tip';
  };
  H.hoverEnd = function () { H._hoverSpot = -1; H._hoverGroup = -1; if (H.E.tip) H.E.tip.className = 'ho-tip'; const V = hv(); if (V) V.hover(null); };

  // ------------------------------------------------------------------ camera buttons
  H.zoom = function (dir) {
    if (!SQ.camera) return;
    const sz = SQ.render && SQ.render.size ? SQ.render.size() : { w: window.innerWidth, h: window.innerHeight };
    SQ.camera.zoomBy(dir > 0 ? 0.72 : 1.38, sz.w / 2, sz.h / 2);
    play('tick', { volume: 0.4 });
  };
  H.rotate = function (dir) {
    if (!SQ.camera) return;
    SQ.camera.rotateBy(dir * Math.PI / 4);
    if (SQ.camera.snapHeading) SQ.camera.snapHeading();
    play('tick', { volume: 0.4 });
  };
  /** Frame my groups (those not on a coffee break), or my entrance when they all are. */
  H.recenter = function () {
    const s = st(); if (!s || !SQ.camera) return;
    const pts = myGroups().filter((g) => !g.coffee).map((g) => { const q = gpos(g); return [q.x, q.z]; });
    if (!pts.length) { const e = s.sides[meIdx()].entrance; pts.push([e.x, e.z]); }
    // frame the nearest spot too: three groups standing together would otherwise fill the screen at street level,
    // with nowhere on screen to send them
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    let near = null, nd = Infinity;
    for (const sp of s.spots) { const d = Math.hypot(sp.x - cx, sp.z - cz); if (d < nd) { nd = d; near = sp; } }
    if (near) pts.push([near.x, near.z]);
    if (SQ.camera.fit) SQ.camera.fit(pts, { pad: 18 }); else SQ.camera.focus(pts[0][0], pts[0][1]);
    play('tick', { volume: 0.4 });
  };

  // ------------------------------------------------------------------ keyboard (input.js forwards keys in Hang Out)
  H.key = function (e) {
    const s = st(); if (!s) return false;
    const code = e.code;
    if (H._pauseOpen) {
      if (code === 'Escape' || code === 'KeyP') { e.preventDefault(); H.closePause(); return true; }
      return false;
    }
    // (in the think pause every key below still works: picking groups, the view; P resumes)
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const dg = /^(?:Digit|Numpad)([1-9])$/.exec(code);
    if (dg) {
      const k = +dg[1] - 1;
      const g = myGroups()[k];
      if (!g) return true;
      e.preventDefault();
      // first press picks the group, pressing it again (while picked) jumps the camera to it
      if (H.sel === g.id) { focusGroup(g); play('click'); fire('ui', { kind: 'cardAgain', group: g.id }); } else H.select(g.id);
      return true;
    }
    switch (code) {
      case 'Space': case 'Home': e.preventDefault(); H.recenter(); fire('ui', { kind: 'cam', what: 'find' }); return true;
      case 'KeyQ': H.rotate(-1); fire('ui', { kind: 'cam', what: 'rl' }); return true;
      case 'KeyE': H.rotate(1); fire('ui', { kind: 'cam', what: 'rr' }); return true;
      case 'Equal': case 'NumpadAdd': H.zoom(1); fire('ui', { kind: 'cam', what: 'in' }); return true;
      case 'Minus': case 'NumpadSubtract': H.zoom(-1); fire('ui', { kind: 'cam', what: 'out' }); return true;
      case 'KeyP': H.openPause(); return true;
      case 'Escape':
        if (H.sel >= 0) { H.deselect(); return true; }
        H.openMenu(); return true;
      default: return false;
    }
  };

  // ------------------------------------------------------------------ mini map
  // A square map of the playing area (the five spots and both entrances), turned with the camera so that
  // "up" on the map is "up" on the screen. Tap or drag on it to look there.
  const MC = { x: -2, z: 2, R: 86 };
  function miniInput(c) {
    let down = false;
    const go = (e) => {
      const r = c.getBoundingClientRect();
      const S = r.width;
      const sx = (e.clientX - r.left - S / 2) / (S / (2 * MC.R)), sy = (e.clientY - r.top - S / 2) / (S / (2 * MC.R));
      const h = SQ.camera ? SQ.camera.heading : 0;
      const f = { x: Math.sin(h), z: -Math.cos(h) }, rr = { x: Math.cos(h), z: Math.sin(h) };
      const x = MC.x + sx * rr.x - sy * f.x, z = MC.z + sx * rr.z - sy * f.z;
      if (SQ.camera) SQ.camera.focus(x, z);
      fire('ui', { kind: 'mini' });
    };
    c.addEventListener('pointerdown', (e) => { e.stopPropagation(); down = true; try { c.setPointerCapture(e.pointerId); } catch (err) { /* */ } go(e); play('tick', { volume: 0.35 }); });
    c.addEventListener('pointermove', (e) => { if (down) go(e); });
    c.addEventListener('pointerup', () => { down = false; });
    c.addEventListener('pointercancel', () => { down = false; });
  }
  function miniStatic(px) {
    const cv = document.createElement('canvas');
    const N = Math.max(64, Math.round(px * 2));
    cv.width = N; cv.height = N;
    const g = cv.getContext('2d');
    const k = N / (2 * MC.R);
    const X = (x) => (x - (MC.x - MC.R)) * k, Z = (z) => (z - (MC.z - MC.R)) * k;
    g.fillStyle = '#2b332f'; g.fillRect(0, 0, N, N);
    const G = window.GEO;
    if (G) {
      const poly = (pts, fill, stroke, lw) => {
        g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1])))); g.closePath();
        if (fill) { g.fillStyle = fill; g.fill(); }
        if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
      };
      const park = (G.areas || []).find((a) => a.kind === 'park' && /Washington Square/.test(a.name || ''));
      if (park) poly(park.pts, '#8f9488');
      for (const a of G.areas || []) {
        const kd = a.kind;
        if (kd === 'grass' || kd === 'garden' || kd === 'flowerbed') poly(a.pts, '#5b8a4c');
        else if (kd === 'dog_park') poly(a.pts, '#b29d78');
        else if (kd === 'playground') poly(a.pts, '#c08b6a');
      }
      g.strokeStyle = 'rgba(244,238,223,.55)'; g.lineWidth = Math.max(1, k * 1.3); g.lineCap = 'round';
      for (const p of G.paths || []) { if (p.area) continue; g.beginPath(); p.pts.forEach((q, i) => (i ? g.lineTo(X(q[0]), Z(q[1])) : g.moveTo(X(q[0]), Z(q[1])))); g.stroke(); }
    }
    g.fillStyle = '#7fc0e2'; g.beginPath(); g.arc(X(0), Z(0), 11 * k, 0, TAU); g.fill();
    return { cv, N, k };
  }
  function drawMini() {
    const s = st(); const c = H.E.miniC; if (!s || !c || !H._reveal.mini) return;
    const rect = c.getBoundingClientRect();
    const S = Math.round(rect.width);
    if (S < 10) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(S * dpr)) { c.width = Math.round(S * dpr); c.height = Math.round(S * dpr); H._miniStatic = null; }
    if (!H._miniStatic) H._miniStatic = miniStatic(S * dpr);
    const g = c.getContext('2d');
    const h = SQ.camera ? SQ.camera.heading : 0;
    const k = (S * dpr) / (2 * MC.R);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.save();
    g.translate(c.width / 2, c.height / 2);
    g.rotate(-h);
    g.scale(k, k);
    g.translate(-MC.x, -MC.z);
    g.drawImage(H._miniStatic.cv, MC.x - MC.R, MC.z - MC.R, 2 * MC.R, 2 * MC.R);
    // entrances
    for (const sd of s.sides) {
      const e = sd.entrance;
      g.fillStyle = sideColor(sd.idx); g.strokeStyle = '#fff'; g.lineWidth = 1.2 / k * dpr;
      g.beginPath(); g.moveTo(e.x, e.z - 6); g.lineTo(e.x + 6, e.z); g.lineTo(e.x + 4, e.z); g.lineTo(e.x + 4, e.z + 5); g.lineTo(e.x - 4, e.z + 5); g.lineTo(e.x - 4, e.z); g.lineTo(e.x - 6, e.z); g.closePath();
      g.fill(); g.stroke();
    }
    // spots
    for (const sp of s.spots) {
      const col = sp.holder >= 0 ? sideColor(sp.holder) : null;
      g.beginPath(); g.arc(sp.x, sp.z, Math.max(7, sp.r * 0.8), 0, TAU);
      g.fillStyle = col ? hexA(col, 0.8) : 'rgba(255,248,216,.25)'; g.fill();
      g.lineWidth = 2.2 / k * dpr; g.strokeStyle = sp.arguing ? '#ffe46b' : col ? '#fff' : 'rgba(255,248,216,.9)';
      if (!col) g.setLineDash([4 / k * dpr, 3 / k * dpr]);
      g.stroke(); g.setLineDash([]);
    }
    // groups
    for (const gr of s.groups) {
      if (gr.coffee) continue;
      const q = gpos(gr);
      g.beginPath(); g.arc(q.x, q.z, (gr.id === H.sel ? 5 : 3.8), 0, TAU);
      g.fillStyle = sideColor(gr.side); g.fill();
      g.lineWidth = (gr.id === H.sel ? 2.4 : 1.2) / k * dpr; g.strokeStyle = gr.id === H.sel ? '#ffe46b' : '#fff'; g.stroke();
    }
    // what the camera sees
    const vw = window.innerWidth, vh = window.innerHeight;
    const cs = [[0, vh * 0.1], [vw, vh * 0.1], [vw, vh], [0, vh]].map((q) => toGround(q[0], q[1]));
    if (cs.every((q) => q && Math.abs(q.x) < 900 && Math.abs(q.z) < 900)) {
      g.beginPath(); cs.forEach((q, i) => (i ? g.lineTo(q.x, q.z) : g.moveTo(q.x, q.z))); g.closePath();
      g.lineWidth = 1.6 / k * dpr; g.strokeStyle = 'rgba(255,255,255,.95)'; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fill();
    }
    g.restore();
    // north marker on the rim
    const r = S / 2 - 9;
    H.E.miniN.style.transform = 'translate(' + (S / 2 - Math.sin(-h) * r - 7).toFixed(1) + 'px,' + (S / 2 - Math.cos(-h) * r - 8).toFixed(1) + 'px)';
  }

  // ------------------------------------------------------------------ messages (one at a time)
  // pri: 0 hint, 1 info, 2 notable, 3 your groups, 4 clock / coach. A higher one replaces the current one;
  // others wait (at most 3 waiting, oldest dropped). Each shows for ttl s (min 1.8).
  H.say = function (text, o) {
    o = o || {};
    if (!H.root || !H.match) return;
    if (H._coach && !o.force) return;   // the tutorial owns the message line
    const m = { text, html: o.html || null, pri: o.pri || 0, ttl: Math.max(1.8, o.ttl || 3), key: o.key || null, at: o.at || null, icon: o.icon || null, born: now(), sticky: !!o.sticky, cls: o.cls || '' };
    if (m.key) {
      if (H._cur && H._cur.key === m.key) { H._cur.text = m.text; H._cur.html = m.html; H._cur.at = m.at; H._cur.shown = now(); showMsg(H._cur); return; }
      H._q = H._q.filter((q) => q.key !== m.key);
    }
    // a higher priority replaces what is showing (a sticky prompt gives way to anything as important)
    if (!H._cur || m.pri > H._cur.pri || (H._cur.sticky && m.pri >= H._cur.pri)) { setCur(m); return; }
    H._q.push(m);
    H._q.sort((a, b) => b.pri - a.pri || a.born - b.born);
    if (H._q.length > 3) H._q.length = 3;
  };
  function dropMsg(key) {
    H._q = H._q.filter((q) => q.key !== key);
    if (H._cur && H._cur.key === key) { H._cur = null; nextMsg(); }
  }
  /** Highlight things in the park for the tutorial (spot index, {group}, {entrance}); null clears. */
  H.highlight = function (t) {
    const V = hv(); if (!V || !V.highlight) return;
    const s = st();
    const conv = (x) => (typeof x === 'number' && s && s.spots[x] ? s.spots[x].id : x);
    V.highlight(t === null || t === undefined ? null : Array.isArray(t) ? t.map(conv) : conv(t));
  };
  function setCur(m) { H._cur = m; m.shown = now(); showMsg(m); syncBubbles(); }
  function nextMsg() {
    const t = now();
    H._q = H._q.filter((q) => t - q.born < 7 || q.pri >= 3 && t - q.born < 10);
    const m = H._q.shift();
    if (m) setCur(m); else hideMsg();
  }
  function showMsg(m) {
    if (H._coach) return;
    const E = H.E.msg;
    E.className = 'ho-msg show' + (m.at ? ' look' : '') + (m.cls ? ' ' + m.cls : '') + ' p' + m.pri;
    E.innerHTML = (m.icon && IC[m.icon] ? '<span class="hm-ic">' + IC[m.icon] + '</span>' : '') + '<span class="hm-tx">' + (m.html || esc(m.text)) + '</span>' + (m.at ? '<span class="hm-look">' + IC.look + '<em>look</em></span>' : '');
  }
  function hideMsg() { if (H._coach) return; H.E.msg.className = 'ho-msg'; syncBubbles(); }
  function updateMsg() {
    if (H._coach || !H._cur) return;
    const t = now();
    if (t - H._cur.shown >= H._cur.ttl) { H._cur = null; nextMsg(); }
  }
  function onMsgTap() {
    if (H._coach) { if (H._coach.onTap) H._coach.onTap(); return; }
    const m = H._cur; if (!m) return;
    if (m.at && SQ.camera) { SQ.camera.focus(m.at.x, m.at.z); play('tick', { volume: 0.4 }); }
    H._cur = null; nextMsg();
  }

  /**
   * The tutorial's coach line (takes over the message line; null gives it back):
   * { text, sub, step, total, next: {label, fn} | null, skip: fn | null, done: bool, html }
   */
  H.coach = function (spec) {
    H._coach = spec || null;
    const E = H.E.msg;
    syncBubbles();
    if (!spec) { E.className = 'ho-msg'; E.innerHTML = ''; if (H._cur) showMsg(H._cur); syncBubbles(); return; }
    const dots = spec.total ? '<span class="hk-dots" aria-label="Step ' + spec.step + ' of ' + spec.total + '">' + Array.from({ length: spec.total }, (_, i) => '<i class="' + (i < spec.step - 1 ? 'on' : i === spec.step - 1 ? 'cur' : '') + '"></i>').join('') + '</span>' : '';
    E.className = 'ho-msg show coach' + (spec.done ? ' done' : '') + (spec.cls ? ' ' + spec.cls : '');
    E.innerHTML =
      '<span class="hk-top">' + dots + (spec.title ? '<span class="hk-title">' + esc(spec.title) + '</span>' : '') + (spec.skip ? '<button class="hk-skip" type="button">' + esc(spec.skipLabel || 'Skip') + ' ›</button>' : '') + '</span>' +
      '<span class="hk-tx">' + (spec.html || esc(spec.text || '')) + '</span>' +
      (spec.sub ? '<span class="hk-sub">' + esc(spec.sub) + '</span>' : '') +
      (spec.next ? '<button class="hk-next mbtn primary small" type="button">' + esc(spec.next.label || 'Next') + '</button>' : '');
    const sk = E.querySelector('.hk-skip');
    if (sk) sk.addEventListener('click', (e) => { e.stopPropagation(); play('click'); spec.skip(); });
    const nx = E.querySelector('.hk-next');
    if (nx) nx.addEventListener('click', (e) => { e.stopPropagation(); play('click'); spec.next.fn(); });
  };

  // ------------------------------------------------------------------ event handlers (match bus)
  function teach(key, max) {
    try {
      const d = SQ.save && SQ.save.data; if (!d) return true;
      d.ho = d.ho || {}; d.ho.taught = d.ho.taught || {};
      const n = d.ho.taught[key] || 0;
      if (n >= (max || 2)) return false;
      d.ho.taught[key] = n + 1; SQ.save.write();
      return true;
    } catch (e) { return true; }
  }
  function tips() { return setting('tips', true) !== false; }
  const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
  function numW(n, capital) { const w = NUM[n] || String(n); return capital ? cap(w) : w; }
  /**
   * Why an argument ended, in one line (from the wentForCoffee payload, my point of view): validation criterion 1,
   * "a newcomer can explain why an encounter was won or lost".
   */
  function coffeeWhy(e) {
    if (!e || e.forced || e.spotIdx < 0) return '';
    const me = meIdx(), mine = e.side === me;
    if (e.mutual) return 'Nobody held ' + spotName(e.spotIdx) + ', so you both gave up at once. Bring two next time.';
    if (e.tie) return mine ? 'You both ran out at the same moment. They were hanging out there first, so they stay.'
      : 'You both ran out at the same moment. You were here first, so you stay.';
    const theirN = mine ? e.rivals : e.mates, myN = mine ? e.mates : e.rivals;   // groups of theirs / mine at the spot
    if (mine && theirN > myN) return numW(theirN, true) + ' against ' + numW(myN) + ': you ran out first.';
    if (!mine && myN > theirN) return numW(myN, true) + ' against ' + numW(theirN) + ': they ran out first.';
    return mine ? 'They had more patience left.' : 'You had more patience left.';
  }
  H.coffeeWhy = coffeeWhy;
  /** At most `max` times per match, and not again within `gap` seconds (repeats are noise). */
  function often(key, max, gap) {
    const t = now();
    const n = H._n[key] || 0;
    if (n >= max || t - (H._tipT['_' + key] || -999) < (gap || 0)) return false;
    H._n[key] = n + 1; H._tipT['_' + key] = t;
    return true;
  }
  const handlers = {
    settleStart(e) {
      if (e.side !== meIdx()) return;
      const g = st().groups[e.group];
      if (teach('settle', 2)) H.say(groupName(g) + ' are settling in at ' + spotName(e.spotIdx) + ': 3 quiet seconds and it earns.', { pri: 1, ttl: 3, key: 'settle' + e.spotIdx, icon: 'settle' });
    },
    settled(e) {
      const s = st(), me = meIdx();
      const mine = e.side === me;
      play('capture', { faction: s.sides[e.side].crew, x: e.x, z: e.z, minGain: mine ? 0.75 : 0.25, volume: mine ? 1 : 0.6, key: 'ho' });
      if (mine) {
        H._lastHold[e.spotIdx] = s.t;
        if (teach('settled', 3)) H.say('Hanging out at ' + spotName(e.spotIdx) + ': +1 point every second.', { pri: 1, ttl: 3, key: 'settled', icon: 'hang' });
      } else if (H._lostAt[e.spotIdx] !== undefined && s.t - H._lostAt[e.spotIdx] < 40) {
        H.say(crewName(e.side) + ' are hanging out at ' + spotName(e.spotIdx) + ' now.', { pri: 2, ttl: 3, key: 'took' + e.spotIdx, at: { x: e.x, z: e.z } });
      }
    },
    spotFree(e) {
      if (e.side === meIdx()) { H._lostAt[e.spotIdx] = st().t; if (e.reason === 'coffee') play('lost', { x: e.x, z: e.z, minGain: 0.5 }); }
    },
    earning(e) {
      const s = st();
      for (const q of e.spots || []) floater(q.spotIdx, q.side, q.amount);
      const pts = s.sides[meIdx()].points;
      if (pts > 0 && pts % 25 === 0 && (e.spots || []).some((q) => q.side === meIdx())) play('coin', { volume: 0.35 });
    },
    argueStart(e) {
      const s = st(), me = meIdx();
      const groups = (e.groups || []).map((id) => s.groups[id]);
      const mine = groups.filter((g) => g.side === me), theirs = groups.filter((g) => g.side !== me);
      if (!mine.length) return;
      play('contested', { x: e.x, z: e.z, minGain: 0.6 });
      const at = { x: e.x, z: e.z };
      if (e.holder === me) {
        const txt = teach('defend', 2)
          ? groupName(theirs[0]) + ' came to argue at ' + spotName(e.spotIdx) + '. You keep earning while you argue; watch the patience bars.'
          : groupName(theirs[0]) + ' are arguing with you at ' + spotName(e.spotIdx) + '.';
        H.say(txt, { pri: 3, ttl: 4, key: 'argue' + e.spotIdx, at, icon: 'argue' });
      } else if (e.holder >= 0 && mine.length === 1 && theirs.length === 1 && tips()) {
        // one against a group already hanging out there: unless help is already coming, say how to win it
        const coming = myGroups().filter((g) => g.spot === e.spotIdx && g.at !== e.spotIdx && !g.coffee);
        // "your help got there late" only if one of your groups really left this spot for coffee in the last 45 s
        // (not for the one group that just arrived and started this argument)
        const leftHere = H._leftAt[e.spotIdx] !== undefined && now() - H._leftAt[e.spotIdx] < 45;
        const sentHere = leftHere && myGroups().some((g) => H._sentTo[g.id] && H._sentTo[g.id].spot === e.spotIdx && now() - H._sentTo[g.id].t < 45 && g.at === e.spotIdx);
        if (coming.length) {
          let eta = 99;
          for (const g of coming) { try { eta = Math.min(eta, H.match.eta(g.id, e.spotIdx)); } catch (er) { /* */ } }
          H.say('Help is on the way' + (eta < 99 ? ' (' + Math.max(1, Math.round(eta)) + ' s)' : '') + '. Hold on, or walk away.', { pri: 3, ttl: 4, key: 'argue' + e.spotIdx, at, icon: 'argue' });
        } else if (sentHere && often('lateHelp', 2, 30)) {
          // the player did send help, but it got there after the first group had left: say that, not "send help"
          H.say('Still one against one: your help got there after your first group left, and they were there first. Bring one more group, or walk away.', { pri: 3, ttl: 5, key: 'argue' + e.spotIdx, at, icon: 'argue' });
        } else if (!sentHere && (H._tipT.oneOnOne || 0) < 2) {
          H._tipT.oneOnOne = (H._tipT.oneOnOne || 0) + 1;
          H.say('One against one, the group that was there first wins a tie. Send a second group to ' + spotName(e.spotIdx) + '!', { pri: 3, ttl: 5, key: 'argue' + e.spotIdx, at, icon: 'argue' });
        }
      } else if (often('argue' + e.spotIdx, 3, 45)) {
        H.say(groupName(mine[0]) + ' are arguing at ' + spotName(e.spotIdx) + '.', { pri: 2, ttl: 3, key: 'argue' + e.spotIdx, at, icon: 'argue' });
      }
    },
    wentForCoffee(e) {
      const s = st(), me = meIdx();
      const g = s.groups[e.group];
      play('overIt', { faction: s.sides[e.side].crew, x: e.x, z: e.z, minGain: e.side === me ? 0.7 : 0.35 });
      const why = coffeeWhy(e);
      if (e.side === me) {
        vibrate(20);
        const line = e.line ? ' “' + esc(e.line) + '”' : '';
        const k = e.group + ':' + e.spotIdx;
        H._coffeeAt[k] = (H._coffeeAt[k] || 0) + 1;
        if (e.spotIdx >= 0) H._leftAt[e.spotIdx] = now();
        // after coffee they walk back to this spot by themselves: say so (every time it matters, briefly)
        const back = e.spotIdx >= 0 && H.match.rules.returnTo === 'last'
          ? ' Back in ' + fmtClock(e.backIn) + ', then they walk back to ' + esc(spotName(e.spotIdx)) + ' (' + tapW() + ' their card to change that).'
          : ' Back in ' + fmtClock(e.backIn) + '.';
        H.say('', { pri: 3, ttl: 6, key: 'coffee' + e.group, icon: 'coffee', at: e.x !== undefined ? { x: e.x, z: e.z } : null,
          html: '<b>' + esc(groupName(g)) + '</b> ran out of patience and went for coffee.' + (why ? ' <b>' + esc(why) + '</b>' : line) + back });
      } else {
        const sp = e.spotIdx >= 0 ? s.spots[e.spotIdx] : null;
        const minesThere = sp && s.groups.some((q) => q.side === me && q.at === e.spotIdx && !q.coffee);
        if (minesThere) H.say('', { pri: 2, ttl: 4.5, key: 'evict' + e.spotIdx, icon: 'coffee', cls: 'good',
          html: esc(groupName(g)) + ' gave up and went for coffee. ' + (why ? '<b>' + esc(why) + '</b> ' : '') + esc(cap(spotName(sp))) + ' is yours.' });
      }
    },
    returned(e) {
      const s = st();
      if (e.side !== meIdx()) return;
      const g = s.groups[e.group];
      play('ack', { faction: s.sides[e.side].crew, volume: 0.8 });
      if (often('back', 2, 20)) H.say(groupName(g) + ' are back' + (e.dest ? ', heading to ' + spotName(s.spots.findIndex((q) => q.id === e.dest)) : '') + '. “' + (e.line || 'Okay.') + '”', { pri: 1, ttl: 3, key: 'back' + e.group, icon: 'walk' });
    },
    clockWarn(e) {
      play('clockTick', { volume: 0.8 });
      const s = st(); const a = s.sides[meIdx()], b = s.sides[themIdx()];
      const diff = a.points - b.points;
      const where = diff > 0 ? 'You lead by ' + diff + '.' : diff < 0 ? 'You are ' + (-diff) + ' behind.' : 'It is a tie.';
      const txt = e.timeLeft >= 60 ? '1 minute left. ' + where : e.timeLeft >= 30 ? '30 seconds left. ' + where : '10 seconds!';
      H.say(txt, { pri: 4, ttl: e.timeLeft >= 30 ? 3.5 : 2.5, key: 'clock', icon: 'clock' });
      if (e.timeLeft === 60 && SQ.audio && SQ.audio.setMusic) { try { SQ.audio.setMusic('tense', s.sides[meIdx()].crew); } catch (er) { /* */ } }
    },
    matchEnd(e) {
      if (H._ended) return;
      H._ended = true;
      const s = st(), me = meIdx();
      const won = e.winner === me, draw = e.winner < 0;
      try { if (SQ.audio && SQ.audio.setMusic) SQ.audio.setMusic(won || draw ? 'victory' : 'defeat', s.sides[me].crew); } catch (er) { /* */ }
      if (won) { play('cheer', { volume: 1, len: 3, minGain: 1 }); play('fanfare', { delay: 0.2 }); } else if (!draw) play('sadTrombone', { delay: 0.2 });
      H.deselect();
      H.root.classList.add('over');
      const sc = e.score || s.sides.map((q) => q.points);
      if (e.reason === 'time' || e.reason === 'draw') {
        // the score says whose number is whose: "You 454 – 562 Pack"
        H.E.banner.innerHTML = '<span class="hb-k">Time!</span><b>' + (draw ? 'A draw' : won ? 'You win' : esc(crewName(e.winner)) + ' win') + '</b>' +
          '<span class="hb-s"><em>You</em> ' + sc[me] + ' – ' + sc[themIdx()] + ' <em>' + esc(crewShort(themIdx())) + '</em></span>';
        H.E.banner.className = 'ho-banner show ' + (won ? 'won' : draw ? 'draw' : 'lost');
      }
      // what comes next: the tutorial takes over, or the Park Report
      const tut = SQ.hangoutTutorial;
      if (tut && tut.active && typeof tut.onMatchEnd === 'function') { try { tut.onMatchEnd(e); } catch (er) { console.error(er); } return; }
      const m = H.match;
      setTimeout(() => { if (H.match === m && SQ.menus && SQ.menus.showHangoutReport) SQ.menus.showHangoutReport(e, m); }, setting('reducedMotion', false) ? 1200 : 2400);
    },
    cmdRejected() { /* the HUD plays 'deny' where the order was given */ },
  };

  // Coach nudges, once a second: idle groups, standoffs, low patience. Quiet and rate-limited.
  function coachTick() {
    const s = st(); if (!s || s.over || H._coach || !tips()) return;
    const t = now();
    const me = meIdx();
    for (const g of myGroups()) {
      if (g.status === 'idle' && !g.coffee) {
        if (H._idleSince[g.id] === undefined) H._idleSince[g.id] = t;
        if (t - H._idleSince[g.id] > 9 && s.t > 12 && t - H._lastOrder > 6 && t - (H._tipT.idle || -99) > 35 && H.sel < 0 && (H._n.idle || 0) < 3) {
          H._tipT.idle = t; H._n.idle = (H._n.idle || 0) + 1;
          H.say(groupName(g) + ' are standing around. ' + tapW(1) + ' their card, then a spot.', { pri: 1, ttl: 4, key: 'idle', icon: 'idle' });
        }
      } else delete H._idleSince[g.id];
      if (g.arguing && g.patience < 30 && t - (H._tipT['low' + g.id] || -99) > 25 && (H._n.low || 0) < 2) {
        const sp = s.spots[g.at];
        let rivals = 0, mates = 0;
        for (const q of s.groups) if (q.at === g.at && !q.coffee) { if (q.side === me) mates++; else rivals++; }
        if (rivals >= mates) {
          H._tipT['low' + g.id] = t; H._n.low = (H._n.low || 0) + 1;
          H.say(groupName(g) + ' are nearly out of patience. Walk away to recover, or send help to ' + spotName(sp) + '.', { pri: 2, ttl: 4, key: 'low' + g.id, at: { x: sp.x, z: sp.z }, icon: 'argue' });
        }
      }
    }
    // a standoff: nothing changed hands for a while and the player is behind
    if (H.timed && s.t > 60) {
      const a = s.sides[me], b = s.sides[themIdx()];
      const changes = s.spots.reduce((n, q) => n + q.changes, 0);
      if (H._stand === undefined || changes !== H._standN) { H._stand = s.t; H._standN = changes; }
      if (b.rate >= a.rate && b.points > a.points && s.t - H._stand > 35 && t - (H._tipT.stand || -99) > 75 && (H._n.stand || 0) < 3) {
        H._tipT.stand = t; H._n.stand = (H._n.stand || 0) + 1;
        const held = s.spots.filter((q) => q.holder === themIdx());
        const tgt = held.length ? held[0] : null;
        H.say('Behind? Pick a spot they hold' + (tgt ? ' (like ' + spotName(tgt) + ')' : '') + ' and send TWO groups: two against one makes them leave.', { pri: 1, ttl: 5, key: 'stand', at: tgt ? { x: tgt.x, z: tgt.z } : null });
      }
    }
  }

  // ------------------------------------------------------------------ pause + How to play
  function openModal(html, opts) {
    opts = opts || {};
    const M = H.E.modal;
    M.innerHTML = html;
    M.className = 'ho-modal show' + (opts.cls ? ' ' + opts.cls : '');
    H._modalClose = opts.onClose || null;
    return M;
  }
  function closeModal(silent) {
    const M = H.E.modal; if (!M) return;
    M.className = 'ho-modal'; M.innerHTML = '';
    H._modalClose = null;
    H._pauseOpen = false;
    if (H.root) H.root.classList.remove('modal');
    if (!silent) play('close');
  }

  // The pause button is a "think" pause: the clock stops, but the view, the map and the cards keep working, so a
  // player can look around and line up orders (they start when play resumes). Menu opens the full pause card.
  H.openPause = function () {
    if (!H.match || H._pauseOpen || st().over) return;
    if (H._thinking) { H.resume(); return; }
    if (SQ.game && !SQ.game.paused) SQ.game.pause(true);
    H._thinking = true;
    const T = H.E.think;
    T.innerHTML = '<span class="ht-tx"><b>Paused.</b> Look around and give orders: they start when you resume.</span>' +
      '<button class="mbtn primary small" data-a="resume" type="button">Resume</button>' +
      '<button class="mbtn small" data-a="menu" type="button">Menu</button>';
    T.className = 'ho-think show';
    T.querySelector('[data-a="resume"]').addEventListener('click', (e) => { e.stopPropagation(); play('click'); H.resume(); });
    T.querySelector('[data-a="menu"]').addEventListener('click', (e) => { e.stopPropagation(); play('click'); H.openMenu(); });
    H.root.classList.add('thinking');
    fire('ui', { kind: 'pause', on: true });
  };
  H.resume = function () {
    H._thinking = false;
    if (H.E.think) H.E.think.className = 'ho-think';
    if (H.root) H.root.classList.remove('thinking');
    if (H._pauseOpen) closeModal(true);
    if (SQ.game && SQ.game.paused) SQ.game.pause(false);
    fire('ui', { kind: 'pause', on: false });
  };
  /** The full pause card: resume, How to play, skip / start over, options, quit. */
  H.openMenu = function () {
    if (!H.match || H._pauseOpen) return;
    if (SQ.game && !SQ.game.paused) SQ.game.pause(true);
    H._pauseOpen = true;
    H.root.classList.add('modal');
    H.deselect();
    const tut = SQ.hangoutTutorial && SQ.hangoutTutorial.active;
    const M = openModal(
      '<div class="hp-card" role="dialog" aria-label="Paused">' +
      '<h2>Paused</h2>' +
      '<div class="hp-btns">' +
      '<button class="mbtn primary big" data-a="resume" type="button"><b>Resume</b></button>' +
      '<button class="mbtn" data-a="how" type="button"><b>How to play</b><small>3 rules and the controls</small></button>' +
      (tut ? '<button class="mbtn" data-a="skipstep" type="button"><b>Skip this lesson</b></button>' : '<button class="mbtn" data-a="restart" type="button"><b>Start over</b></button>') +
      '<button class="mbtn" data-a="options" type="button"><b>Options</b></button>' +
      '<button class="mbtn" data-a="quit" type="button"><b>' + (tut ? 'Leave the tutorial' : 'Quit to title') + '</b></button>' +
      '</div></div>', { onClose: () => H.closePause() });
    M.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      play('click');
      const a = b.dataset.a;
      if (a === 'resume') H.closePause();
      else if (a === 'how') H.showHowTo(true);
      else if (a === 'options') { if (SQ.menus && SQ.menus.openOptions) SQ.menus.openOptions({ simple: true }); }
      else if (a === 'restart') { closeModal(true); if (SQ.menus && SQ.menus.restart) SQ.menus.restart(); }
      else if (a === 'skipstep') { H.closePause(); if (SQ.hangoutTutorial.skip) SQ.hangoutTutorial.skip(); }
      else if (a === 'quit') { closeModal(true); if (SQ.hangoutTutorial && SQ.hangoutTutorial.active) SQ.hangoutTutorial.stop(); if (SQ.game) SQ.game.quit(); }
    }));
  };
  /** Close the pause card (or How to play) and play on. */
  H.closePause = function () {
    closeModal();
    H.resume();
  };
  H.showHowTo = function (fromPause) {
    const M = openModal('<div class="hp-card hp-how" role="dialog" aria-label="How to play">' + H.howToHTML() +
      '<div class="hp-btns row"><button class="mbtn primary" data-a="back" type="button"><b>' + (fromPause ? 'Back' : 'Got it') + '</b></button></div></div>',
    { cls: 'how', onClose: () => (fromPause ? H.openPauseAgain() : H.closePause()) });
    M.querySelector('[data-a="back"]').addEventListener('click', (e) => { e.stopPropagation(); play('click'); if (fromPause) H.openPauseAgain(); else H.closePause(); });
    H._pauseOpen = true;
    H.root.classList.add('modal');
  };
  H.openPauseAgain = function () { H._pauseOpen = false; H.openMenu(); };

  /** The quick reference: three rules with small drawings, plus the controls. Used by the title screen too. */
  H.howToHTML = function () {
    const touch = touchUI();
    const r1 = '<svg viewBox="0 0 120 80" class="hw-art" aria-hidden="true"><ellipse cx="60" cy="56" rx="48" ry="16" fill="#3D7BE0" opacity=".25" stroke="#fff8d8" stroke-width="2.5" stroke-dasharray="6 5"/>' +
      '<g fill="#3D7BE0" stroke="#163a2b" stroke-width="2"><circle cx="46" cy="50" r="6"/><circle cx="60" cy="54" r="6"/><circle cx="74" cy="50" r="6"/></g>' +
      '<text x="88" y="26" class="hw-plus">+1</text><text x="20" y="22" class="hw-plus sm">+1</text></svg>';
    const r2 = '<svg viewBox="0 0 120 80" class="hw-art" aria-hidden="true"><g stroke="#163a2b" stroke-width="2"><circle cx="30" cy="48" r="7" fill="#3D7BE0"/><circle cx="90" cy="44" r="7" fill="#E0453A"/><circle cx="98" cy="56" r="7" fill="#E0453A"/></g>' +
      '<path d="M44 30h14l-4-6M76 30H62l4 6" fill="none" stroke="#fff8d8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<rect x="12" y="64" width="38" height="7" rx="3.5" fill="rgba(0,0,0,.35)"/><rect x="12" y="64" width="12" height="7" rx="3.5" fill="#ffe46b"/>' +
      '<g transform="translate(18 6)" fill="#fff8d8"><path d="M0 8h14v6a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6z"/><path d="M14 10h2a3 3 0 0 1 0 6h-2" fill="none" stroke="#fff8d8" stroke-width="2"/></g></svg>';
    const r3 = '<svg viewBox="0 0 120 80" class="hw-art" aria-hidden="true"><circle cx="34" cy="40" r="22" fill="none" stroke="#fff8d8" stroke-width="3"/><path d="M34 26v14l9 6" fill="none" stroke="#fff8d8" stroke-width="3" stroke-linecap="round"/>' +
      '<text x="64" y="36" class="hw-score">142</text><text x="64" y="62" class="hw-score dim">97</text></svg>';
    const ctl = touch
      ? '<li><b>Tap a group</b> (its card, or the people in the park), <b>then tap a spot</b>. That sends them. A tap anywhere else lets go of the group.</li>' +
        '<li><b>Drag</b> one finger to move the view. <b>Pinch</b> to zoom. <b>Twist</b> two fingers (or ⟲ ⟳) to turn.</li>' +
        '<li><b>⌖</b> shows your groups. <b>Tap the map</b> to look somewhere. Tap a card twice to find that group. <b>Pause</b> stops the clock; you can still look around and give orders.</li>'
      : '<li><b>Click a group</b> (its card, the people in the park, or keys <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>), <b>then click a spot</b>. Right-click also sends. <kbd>Esc</kbd> lets go.</li>' +
        '<li><b>Drag</b> or <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to move the view. <b>Scroll</b> to zoom. <kbd>Q</kbd> <kbd>E</kbd> or right-drag to turn.</li>' +
        '<li><kbd>Space</kbd> or <b>⌖</b> shows your groups. Click the map to look somewhere. <kbd>P</kbd> pauses the clock (you can still look around and give orders).</li>';
    return '<h2>How to play</h2>' +
      '<p class="hw-goal">Your crew wants the best spots in Washington Square Park. Hang out to score. Make the others leave.</p>' +
      '<ol class="hw-rules">' +
      '<li>' + r1 + '<div><b>Hang out at a spot to score.</b><span>Send a group to one of the five spots. After 3 quiet seconds your crew gets +1 point a second.</span></div></li>' +
      '<li>' + r2 + '<div><b>Arguing drains patience.</b><span>Rivals at the same spot argue; each rival drains your patience. Out of patience means a coffee break: 15 s, then the group walks back to that spot. Walk away early and patience refills.</span></div></li>' +
      '<li>' + r3 + '<div><b>Most points at 0:00 wins.</b><span>A match lasts 5 minutes.</span></div></li>' +
      '</ol>' +
      '<p class="hw-tip"><b>Tip:</b> the group already hanging out keeps earning while it argues, and if both run out at the same moment, it stays. Two of yours against one of theirs makes them leave.</p>' +
      '<h3>Controls</h3><ul class="hw-ctl">' + ctl + '</ul>';
  };

  // ------------------------------------------------------------------ element lookup (tutorial targets)
  H.el = function (key, arg) {
    const E = H.E;
    switch (key) {
      case 'cards': return E.cards;
      case 'card': return H._cardEls && H._cardEls[arg] ? H._cardEls[arg].b : null;
      case 'cardBar': return H._cardEls && H._cardEls[arg] ? H._cardEls[arg].barW : null;
      case 'cam': return E.cam;
      case 'cam.in': return E.cam.querySelector('[data-c="in"]');
      case 'cam.out': return E.cam.querySelector('[data-c="out"]');
      case 'cam.rl': return E.cam.querySelector('[data-c="rl"]');
      case 'cam.rr': return E.cam.querySelector('[data-c="rr"]');
      case 'cam.find': return E.cam.querySelector('[data-c="find"]');
      case 'mini': return E.mini;
      case 'score': return E.score;
      case 'me': return E.sMe;
      case 'clock': return E.clock;
      case 'pause': return E.pause;
      case 'msg': return E.msg;
      case 'coachNext': return E.msg.querySelector('.hk-next');
      case 'think': return E.think;
      default: return null;
    }
  };
  /** Screen position of a spot label / group (for the tutorial's ghost hand). */
  H.screenOf = function (kind, idx) {
    const s = st(); if (!s) return null;
    const V = hv();
    if (V) {
      const p = V.screenPos(kind === 'spot' ? { spot: idx } : { group: idx });
      if (!p) return null;
      const useTag = kind === 'spot' && p.tagX !== undefined && isFinite(p.tagX);
      return { x: useTag ? p.tagX : p.x, y: useTag ? p.tagY : p.y, on: !!p.onScreen, behind: !!p.behind, coffee: !!p.coffee };
    }
    if (kind === 'spot') { const sp = s.spots[idx]; return sp ? project(sp.x, groundY(sp.x, sp.z) + 0.6, sp.z) : null; }
    if (kind === 'group') { const g = s.groups[idx]; if (!g || g.coffee) return null; const q = gpos(g); return project(q.x, groundY(q.x, q.z) + 1.2, q.z); }
    return null;
  };

  // The message line sits just above the cards, whatever their height on this screen.
  function measure() {
    const C = H.E.cards; if (!C) return;
    const r = C.getBoundingClientRect();
    const h = Math.round(r.height);
    if (h > 0 && h !== H._cardsH) { H._cardsH = h; H.root.style.setProperty('--ho-cards-h', h + 'px'); }
  }

  // ------------------------------------------------------------------ per frame
  H.update = function (m, dt, force) {
    if (!H.root) return;
    if (m !== H.match) { H.setMatch(m || null); return; }
    if (!m) return;
    dt = dt || 0;
    H._t += dt;
    H._slow -= dt; H._mini -= dt; H._coachT -= dt;
    if (H._slow <= 0 || force) { H._slow = 0.1; updateTop(); updateCards(); measure(); }
    if (H._mini <= 0 || force) { H._mini = 0.12; drawMini(); }
    if (H._coachT <= 0) { H._coachT = 1; coachTick(); }
    updateMsg();
    if (H._reveal && H._reveal.world !== false) updateWorld(dt);
  };
})(window.SQ = window.SQ || {});
