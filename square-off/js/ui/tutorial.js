// SQUARE OFF — tutorial layer: renders campaign 'hint' events as coach marks (one line at a time,
// never blocking), a ghost hand for gestures, rings + chalk arrows pointing at HUD elements or 3D
// targets, off-screen pointers (and a one-time "drag to look around" lesson), the M2 triangle
// comic, and behaviour-triggered context tips (each at most twice per save, auto-dismiss 4 s).
//
//   SQ.tutorial.setMatch(match|null)   (main.js)      SQ.tutorial.init(rootEl?)   (optional; lazy)
//   SQ.tutorial.hint({id, text, target, comic?})      show a coach mark now (same as the 'hint' event)
//   SQ.tutorial.tip(id, text, {force})                context tip (respects the 'tips' setting + 2x cap)
//   SQ.tutorial.clear()                               remove the current coach mark
//   SQ.tutorial.current -> the active hint or null
// hint.target: { lm } | { ui: 'recruit.crowd'|'recruit.talker'|'recruit.heavy'|'crew'|'squad'|'chip'|'army'|... }
//              | { unitCls } | { x, z }
// Listens on SQ.bus: 'hint', 'hit', 'overIt', 'capture', 'queued', 'crewCall', 'contested', 'underAttack',
//                    'phaseWarn', 'ordered', 'uiCrewTarget', 'gameQuit', 'victory'.
(function (SQ) {
  'use strict';
  const hasDoc = typeof document !== 'undefined';
  const U = SQ.ui || {};
  const TT = {
    root: null, match: null, current: null, _q: [], _subs: false, _raf: 0, _lastInput: 0,
  };
  SQ.tutorial = TT;

  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function esc(s) { return U.esc ? U.esc(s) : String(s); }
  function setting(k, d) { return U.setting ? U.setting(k, d) : d; }
  function st() { return TT.match && TT.match.state; }
  function now() { return performance.now() / 1000; }

  const HAND = '<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><path d="M24 6c3.3 0 5.5 2.4 5.5 5.6v17.2l2.2-1.1c2.9-1.2 6 .3 6.8 3.2l.2.8 1.6-.6c2.9-1 5.9.6 6.6 3.5l.2.8 1.2-.3c2.8-.6 5.4 1.3 5.6 4.2.4 6.4-.3 11.6-3.1 15.7C48.8 58.6 44 61 37.6 61h-6.4c-4.6 0-8.3-1.9-11-5.5L9.2 41.6c-1.8-2.4-1.4-5.8 1-7.6 2.3-1.7 5.4-1.4 7.3.7l1.1 1.2V11.6C18.6 8.4 20.8 6 24 6z" fill="#fff" stroke="#163a2b" stroke-width="3" stroke-linejoin="round"/></svg>';
  const ARROW = '<svg viewBox="0 0 60 80" width="46" height="62" aria-hidden="true"><path d="M30 4C22 22 38 40 30 62" fill="none" stroke="#fff8d8" stroke-width="7" stroke-linecap="round"/><path d="M14 50l16 22 16-22" fill="none" stroke="#fff8d8" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ------------------------------------------------------------------ DOM
  function ensureRoot() {
    if (TT.root || !hasDoc) return TT.root;
    const app = document.getElementById('app') || document.body;
    const r = el('div', 'sq-coach');
    r.id = 'coach';
    r.innerHTML =
      '<svg class="co-svg"><ellipse class="co-ring" cx="-99" cy="-99" rx="0" ry="0"/><ellipse class="co-ring r2" cx="-99" cy="-99" rx="0" ry="0"/></svg>' +
      '<div class="co-arrow">' + ARROW + '</div>' +
      '<div class="co-hand">' + HAND + '</div>' +
      '<button class="co-edge"><i></i><span></span></button>' +
      '<div class="co-line" role="status" aria-live="polite"><span class="co-ic">✎</span><span class="co-tx"></span><button class="co-x" aria-label="Dismiss hint">✕</button></div>' +
      '<div class="co-comic"></div>';
    app.appendChild(r);
    TT.root = r;
    TT.E = {
      svg: r.querySelector('.co-svg'), ring: r.querySelector('.co-ring'), ring2: r.querySelector('.co-ring.r2'),
      arrow: r.querySelector('.co-arrow'), hand: r.querySelector('.co-hand'), edge: r.querySelector('.co-edge'),
      line: r.querySelector('.co-line'), tx: r.querySelector('.co-tx'), ic: r.querySelector('.co-ic'), comic: r.querySelector('.co-comic'),
    };
    r.querySelector('.co-x').addEventListener('click', (e) => { e.stopPropagation(); if (U.play) U.play('close'); TT.clear(true); });
    TT.E.edge.addEventListener('click', () => { const p = TT._edgeTarget; if (p && U.jump) U.jump(p.x, p.z); });
    TT.E.comic.addEventListener('click', () => hideComic());
    window.addEventListener('pointerdown', () => { TT._lastInput = now(); if (TT.current) TT.current.pulsed = TT._lastInput; }, true);
    window.addEventListener('keydown', () => { TT._lastInput = now(); }, true);
    return r;
  }
  TT.init = function (root) { if (root && root.nodeType === 1) TT.root = null; ensureRoot(); if (!TT._subs) subscribe(); };

  TT.setMatch = function (m) {
    if (!hasDoc) return;
    ensureRoot();
    if (!TT._subs) subscribe();
    TT.match = m || null;
    TT.clear(); hideComic();
    TT._q = [];
    TT._ctx = { lossT: {}, cloutHigh: 0, crewReadyAt: 0, idleSince: {}, contestedShown: false, edgeTaught: false, lastTip: 0 };
    TT.root.classList.toggle('on', !!m);
    // replay hints emitted before the HUD knew about this match (campaign start beats)
    if (m && TT._early && TT._early.length) { const e = TT._early; TT._early = []; for (const h of e) TT.hint(h); }
    if (m && !TT._raf) loop();
  };

  function subscribe() {
    TT._subs = true;
    if (!SQ.bus) return;
    const B = SQ.bus;
    B.on('hint', (p) => {
      if (!p) return;
      if (!TT.match) { (TT._early = TT._early || []).push(p); if (TT._early.length > 4) TT._early.shift(); return; }
      TT.hint(p);
    });
    B.on('gameQuit', () => TT.setMatch(null));
    // the campaign's outro hint arrives just before 'victory' (it listens on match.bus first): keep it
    B.on('victory', () => { if (!(TT.current && TT.current.id === 'outro')) TT.clear(); hideComic(); });
    B.on('hit', onHit);
    B.on('overIt', onOverIt);
    B.on('capture', (p) => {
      const c = TT.current, s = st();
      if (!c || !s || !p) return;
      if (c.target && c.target.lm === p.lm && p.to === s.player) done();
    });
    B.on('queued', (p) => {
      const c = TT.current, s = st();
      if (!c || !s || !p || p.faction !== s.player) return;
      if (c.target && c.target.ui && c.target.ui === 'recruit.' + p.cls) done();
    });
    B.on('crewCall', (p) => {
      const c = TT.current, s = st();
      if (!c || !s || !p || p.faction !== s.player) return;
      if (c.target && c.target.ui === 'crew') done();
    });
    B.on('ordered', (p) => {
      const s = st();
      if (!s || !p || p.faction !== s.player) return;
      TT._ordered = (TT._ordered || 0) + 1;
    });
    B.on('uiCrewTarget', () => { if (TT.current) TT.current.handT = now(); });
    B.on('crewMode', (p) => { if (TT.current && p && p.on) TT.current.handT = now(); });
    B.on('contested', onThreat);
    B.on('underAttack', onThreat);
    B.on('phaseWarn', (p) => {
      const s = st();
      if (!s || !p || p.phase !== 'night' || s.player < 0) return;
      const arch = s.lmById.arch;
      if (arch && arch.owner !== s.player) TT.tip('night', 'Night in 20 s: the Arch becomes worth 2 Turf a second. Plan your push.', { target: { lm: 'arch' } });
    });
  }

  // ------------------------------------------------------------------ hints
  function gestureOf(h) {
    const t = (h.text || '').toLowerCase();
    if (/swipe|unleash/.test(t)) return 'swipe';
    if (/drag/.test(t)) return 'drag';
    if (/\btap|click|recruit|send|take|build|press/.test(t)) return 'tap';
    return h.target ? 'tap' : null;
  }
  TT.hint = function (p) {
    if (!hasDoc || !p) return;
    ensureRoot();
    if (!p.text && !p.comic) { TT.clear(); return; }
    if (p.id === 'comic' || p.comic || (p.action && p.action.comic)) showComic();
    if (!p.text) return;
    // the campaign re-sends an unfinished hint as a reminder: refresh it in place (no re-pop)
    const c = TT.current;
    if (c && c.id === p.id && c.text === p.text && !c.done) {
      c.target = p.target || c.target; c.born = now(); c.handT = now();
      return;
    }
    if (SQ.hud && typeof SQ.hud.closePopovers === 'function') { try { SQ.hud.closePopovers(); } catch (e) { /* optional */ } }
    const h = { id: p.id, text: p.text, target: p.target || null, born: now(), pulsed: now(), kind: p.kind || 'hint', life: p.life || (p.target ? 40 : 8), gesture: gestureOf(p), handT: now() };
    show(h);
  };
  TT.tip = function (id, text, o) {
    o = o || {};
    if (!TT.match || !hasDoc) return false;
    if (!o.force && !setting('tips', true)) return false;
    const save = SQ.save && SQ.save.data;
    const n = save && save.tips ? save.tips[id] || 0 : 0;
    if (!o.force && n >= 2) return false;
    const c = TT.current;
    // never stomp on a fresh campaign hint
    if (c && c.kind === 'hint' && now() - c.born < 6) { if (!TT._q.some((q) => q.id === id)) TT._q.push({ id, text, o }); return true; }
    if (now() - (TT._ctx.lastTip || 0) < 5 && !o.force) return false;
    TT._ctx.lastTip = now();
    if (save) { save.tips = save.tips || {}; save.tips[id] = n + 1; if (SQ.save.write) SQ.save.write(); }
    show({ id, text, target: o.target || null, born: now(), pulsed: now(), kind: 'tip', life: o.life || 4.5, gesture: o.target ? gestureOf({ text, target: o.target }) : null, handT: now() });
    return true;
  };
  function show(h) {
    const E = TT.E;
    TT.current = h;
    setText(h.text);
    E.ic.textContent = h.kind === 'tip' ? '!' : '✎';
    E.line.classList.remove('show', 'tip', 'pulse');
    void E.line.offsetWidth;
    E.line.classList.add('show');
    if (h.kind === 'tip') E.line.classList.add('tip');
    E.hand.className = 'co-hand';
  }
  function setText(t) {
    const E = TT.E;
    if (U.glyphText) E.tx.innerHTML = U.glyphText(t, '#163a2b');
    else E.tx.textContent = t;
  }
  function done() {
    const c = TT.current;
    if (!c) return;
    c.done = true;
    TT.E.line.classList.add('done');
    setTimeout(() => { if (TT.current === c) TT.clear(); }, 900);
  }
  TT.clear = function (user) {
    if (!TT.E) return;
    TT.current = null;
    TT.E.line.classList.remove('show', 'tip', 'done', 'pulse');
    hideMarks();
    if (user) TT._q = [];
  };
  function hideMarks() {
    const E = TT.E;
    E.ring.setAttribute('rx', 0); E.ring2.setAttribute('rx', 0);
    E.arrow.style.display = 'none';
    E.hand.style.display = 'none';
    E.edge.style.display = 'none';
  }

  // ------------------------------------------------------------------ comic (M2 triangle)
  function showComic() {
    const E = TT.E;
    if (!E) return;
    const g = (c) => (U.glyph ? U.glyph(c, '#163a2b', 54) : '');
    const panels = [
      ['crowd', 'talker', 'You can\'t monologue at a mob.'],
      ['talker', 'heavy', 'Argue the big guy down from range.'],
      ['heavy', 'crowd', 'Splash scatters crowds.'],
    ];
    E.comic.innerHTML = '<div class="cm-card"><div class="cm-h">SHAPES ARE EVERYTHING</div><div class="cm-panels">' +
      panels.map((p, k) => '<div class="cm-p" style="--k:' + k + '"><div class="cm-art">' + g(p[0]) + '<b>›</b>' + g(p[1]) + '</div><p>' + esc(p[2]) + '</p></div>').join('') +
      '</div><div class="cm-f">Winning matchup: ×1.5 Sway. Losing: ×0.7. Tap to close.</div></div>';
    E.comic.classList.add('show');
    clearTimeout(TT._comicT);
    TT._comicT = setTimeout(hideComic, 11000);
  }
  function hideComic() { if (TT.E) TT.E.comic.classList.remove('show'); }

  // ------------------------------------------------------------------ context tips
  const LOSS_TIP = {
    'talker<crowd': ['tipLostTalker', '● beats ▲ - crowds swarm your Talkers. Bring a ■ to scatter them.'],
    'heavy<talker': ['tipLostHeavy', '▲ beats ■ - they are arguing your big guys down. Bring ● to rush the Talkers.'],
    'crowd<heavy': ['tipLostCrowd', 'Squares beat circles - bring a ▲ to argue the big guy down.'],
  };
  TT._lastHitCls = new Map();
  function onHit(p) {
    const s = st();
    if (!s || !p || p.to === undefined || p.faction === s.player || !p.cls) return;
    TT._lastHitCls.set(p.to, p.cls);
    if (TT._lastHitCls.size > 800) TT._lastHitCls.delete(TT._lastHitCls.keys().next().value);
  }
  function onOverIt(p) {
    const s = st();
    if (!s || !p || p.faction !== s.player) return;
    const k = TT._lastHitCls.get(p.unit);
    if (!k || !SQ.data.beats || SQ.data.beats[k] !== p.cls) return;
    const key = p.cls + '<' + k;
    const lt = TT._ctx.lossT;
    lt[key] = (lt[key] || []).filter((t) => s.t - t < 30);
    lt[key].push(s.t);
    if (lt[key].length >= 3 && LOSS_TIP[key]) { TT.tip(LOSS_TIP[key][0], LOSS_TIP[key][1], { target: { ui: 'recruit.' + SQ.data.weakTo[k] } }); lt[key] = []; }
  }
  function onThreat(p) {
    const s = st();
    if (!s || !p || p.faction !== s.player || TT._ctx.contestedShown) return;
    TT._ctx.contestedShown = true;
    TT.tip('underAttack', 'Under attack! Tap the pulsing chip (top right) or the red arrow to jump there.', { target: { ui: 'landmarks' } });
  }
  function contextTick(dt) {
    const s = st();
    if (!s || s.player < 0 || s.over) return;
    const p = s.factions[s.player];
    const c = TT._ctx;
    if (p.clout > 350) c.cloutHigh += dt; else c.cloutHigh = 0;
    if (c.cloutHigh > 15) { c.cloutHigh = -60; TT.tip('hoard', 'Clout burning a hole in your pocket? Recruit (●▲■) or open a landmark you hold and build.', { target: { ui: 'recruit' } }); }
    if (p.pop >= p.popCap && p.clout > 100) { if (!c.popT) c.popT = s.t; if (s.t - c.popT > 6) { c.popT = s.t + 60; TT.tip('popCap', 'Pop cap reached. Each landmark held adds +2; a Bench Cluster adds +4.', { target: { ui: 'pop' } }); } }
    else c.popT = 0;
    // outnumbered: the most common way new players lose a skirmish is simply not recruiting
    if (!c.outT || s.t > c.outT) {
      const u = s.units; let mine = 0, theirs = 0;
      const UFv = SQ.C.UF, cnt = {};
      for (let i = 0; i < u.n; i++) {
        if (u.flags[i] & (UFv.OVERIT | UFv.REGULAR | UFv.NEUTRAL)) continue;
        const f = u.faction[i];
        if (f === s.player) { mine++; continue; }
        if (!s.factions[f] || s.factions[f].key === 'squirrels') continue;
        cnt[f] = (cnt[f] || 0) + 1;
        if (cnt[f] > theirs) theirs = cnt[f];
      }
      if (s.t > 45 && theirs >= 8 && theirs >= mine * 2) {
        c.outT = s.t + 90;
        const k = Math.round(theirs / Math.max(1, mine));
        TT.tip('outnumbered', 'They have ' + (k >= 2 ? k + 'x' : 'more than') + ' your crew. Recruit (●▲■) whenever you have Clout - an idle wallet loses parks.', { target: { ui: 'recruit' } });
      } else c.outT = s.t + 5;
    }
    if (p.crew >= 100) { if (!c.crewReadyAt) c.crewReadyAt = s.t; if (s.t - c.crewReadyAt > 25) { c.crewReadyAt = s.t + 90; TT.tip('crewIdle', 'Your Crew Call is ready - tap it, then aim it at the biggest fight.', { target: { ui: 'crew' } }); } }
    else c.crewReadyAt = 0;
    // idle squads: teach chip-drag once the player has given a few orders
    const sq = SQ.hud && SQ.hud._squadData;
    if (sq && s.t > 40) {
      const idle = sq.find((d) => d.sq > 0 && d.ids.length >= 2 && d.idle);
      if (idle) { c.idleT = (c.idleT || 0) + dt; if (c.idleT > 20) { c.idleT = -120; TT.tip('chipDrag', 'Squad idle. Drag its chip onto the map (or a landmark) to send it - no need to find them first.', { target: { ui: 'squad' }, life: 6 }); } }
      else c.idleT = 0;
    }
  }

  // ------------------------------------------------------------------ positioning
  function targetPoint(h) {
    const t = h.target, s = st();
    if (!t || !s) return null;
    if (t.ui) {
      const e = SQ.hud && SQ.hud.uiEl ? SQ.hud.uiEl(t.ui) : null;
      if (!e) return null;
      const r = e.getBoundingClientRect();
      if (!r.width && !r.height) return null;
      return { kind: 'ui', x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, on: true };
    }
    let wx, wz, rad = 6, label = '';
    if (t.lm) { const lm = s.lmById[t.lm]; if (!lm) return null; wx = lm.x; wz = lm.z; rad = lm.r || 10; label = lm.name; }
    else if (t.unitCls !== undefined) {
      const u = s.units, ci = typeof t.unitCls === 'number' ? t.unitCls : (SQ.C.CLASS_IDX || {})[t.unitCls];
      let found = -1;
      for (let i = 0; i < u.n; i++) if (u.faction[i] === s.player && u.cls[i] === ci) { found = i; break; }
      if (found < 0) return null;
      wx = u.x[found]; wz = u.z[found]; rad = 3;
    } else if (isFinite(t.x) && isFinite(t.z)) { wx = t.x; wz = t.z; }
    else return null;
    const c = U.project ? U.project(wx, 0.5, wz) : null;
    if (!c) return { kind: 'world', wx, wz, label, on: false, noProj: true };
    let rx = 34, ry = 20;
    const a = U.project(wx + rad, 0.5, wz), b = U.project(wx - rad, 0.5, wz), cN = U.project(wx, 0.5, wz - rad), cS = U.project(wx, 0.5, wz + rad);
    if (a && b && cN && cS && !a.behind && !b.behind) {
      rx = Math.max(22, Math.hypot(a.x - b.x, a.y - b.y) / 2);
      ry = Math.max(14, Math.hypot(cN.x - cS.x, cN.y - cS.y) / 2);
    }
    return { kind: 'world', x: c.x, y: c.y, rx, ry, on: c.on, behind: c.behind, wx, wz, label };
  }

  function place(h) {
    const E = TT.E;
    const rr = TT.root.getBoundingClientRect();
    const tp = targetPoint(h);
    const t = now();
    // idle re-pulse
    if (t - Math.max(h.pulsed, TT._lastInput) > 8 && h.kind === 'hint') {
      h.pulsed = t; h.handT = t;
      E.line.classList.remove('pulse'); void E.line.offsetWidth; E.line.classList.add('pulse');
    }
    if (!tp) { hideMarks(); return; }
    if (tp.kind === 'ui' || tp.on) {
      E.edge.style.display = 'none';
      const x = tp.x - rr.left, y = tp.y - rr.top;
      let rx, ry;
      if (tp.kind === 'ui') { rx = Math.max(30, tp.w / 2 + 10); ry = Math.max(30, tp.h / 2 + 10); if (rx > 120) { rx = tp.w / 2 + 8; ry = tp.h / 2 + 8; } }
      else { rx = tp.rx; ry = tp.ry; }
      for (const r of [E.ring, E.ring2]) { r.setAttribute('cx', x); r.setAttribute('cy', y); r.setAttribute('rx', rx); r.setAttribute('ry', ry); }
      // arrow: above the target pointing down, unless the target is near the top
      const up = y < rr.height * 0.35;
      E.arrow.style.display = 'block';
      E.arrow.classList.toggle('up', up);
      E.arrow.style.transform = 'translate(' + Math.round(x - 23) + 'px,' + Math.round(up ? y + ry + 4 : y - ry - 66) + 'px)' + (up ? ' scaleY(-1)' : '');
      // ghost hand
      const handOn = h.gesture && t - h.handT < 4.2 && !h.done;
      E.hand.style.display = handOn ? 'block' : 'none';
      if (handOn) {
        let g = h.gesture;
        let hx = x, hy = y;
        if (g === 'swipe' && h.target && h.target.ui === 'crew' && SQ.hud && SQ.hud.targeting) { hx = rr.width * 0.38; hy = rr.height * 0.5; }
        else if (g === 'swipe') g = 'tap';
        E.hand.className = 'co-hand g-' + g;
        E.hand.style.left = Math.round(hx - 14) + 'px';
        E.hand.style.top = Math.round(hy - 4) + 'px';
      }
    } else {
      // off-screen: edge pointer, and teach panning the first time
      E.ring.setAttribute('rx', 0); E.ring2.setAttribute('rx', 0);
      E.arrow.style.display = 'none';
      if (tp.noProj) { E.edge.style.display = 'none'; E.hand.style.display = 'none'; return; }
      const cx = rr.width / 2, cy = rr.height / 2;
      let dx = tp.x - rr.left - cx, dy = tp.y - rr.top - cy;
      if (tp.behind) { dx = -dx; dy = -dy; }
      const ang = Math.atan2(dy, dx);
      const mx = cx - 56, my = cy - 130;
      const k = Math.min(mx / Math.max(1e-3, Math.abs(Math.cos(ang))), my / Math.max(1e-3, Math.abs(Math.sin(ang))));
      let ex = cx + Math.cos(ang) * k, ey = cy + Math.sin(ang) * k;
      // keep the bubble off the player's own units: slide it along the edge if it would cover them
      const crowd = ownUnitsOnScreen(rr);
      if (crowd.length) {
        const busy = (x, y) => crowd.some((q) => Math.abs(q[0] - x) < 90 && Math.abs(q[1] - y) < 50);
        for (const d of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9]) {
          const a2 = ang + d;
          const k2 = Math.min(mx / Math.max(1e-3, Math.abs(Math.cos(a2))), my / Math.max(1e-3, Math.abs(Math.sin(a2))));
          const x2 = cx + Math.cos(a2) * k2, y2 = cy + Math.sin(a2) * k2;
          if (!busy(x2, y2)) { ex = x2; ey = y2; break; }
        }
      }
      E.edge.style.display = 'flex';
      E.edge.style.transform = 'translate(' + Math.round(ex) + 'px,' + Math.round(ey) + 'px)';
      E.edge.querySelector('i').style.transform = 'rotate(' + ang + 'rad)';
      E.edge.querySelector('span').textContent = tp.label ? tp.label + ' ›' : 'Over here ›';
      TT._edgeTarget = { x: tp.wx, z: tp.wz };
      const save = SQ.save && SQ.save.data;
      const taught = save && save.tips && save.tips.pan >= 1;
      if (!taught && !TT._ctx.edgeTaught && h.kind === 'hint') {
        TT._ctx.edgeTaught = true;
        if (save) { save.tips = save.tips || {}; save.tips.pan = 1; if (SQ.save.write) SQ.save.write(); }
        h.panLesson = t;
      }
      if (h.panLesson && t - h.panLesson < 5) {
        E.hand.style.display = 'block';
        E.hand.className = 'co-hand g-pan';
        E.hand.style.left = Math.round(cx - 14) + 'px';
        E.hand.style.top = Math.round(cy + 10) + 'px';
        E.hand.style.setProperty('--dx', Math.round(-Math.cos(ang) * 120) + 'px');
        E.hand.style.setProperty('--dy', Math.round(-Math.sin(ang) * 80) + 'px');
        if (!h.panShown) { h.panShown = true; setText(h.text + '  (Drag the map to look around, or tap the arrow.)'); }
      } else {
        E.hand.style.display = 'none';
        if (h.panLesson) { setText(h.text); h.panLesson = 0; }
      }
    }
  }

  function ownUnitsOnScreen(rr) {
    const s = st(); if (!s || !U.project) return [];
    const u = s.units, out = [];
    for (let i = 0; i < u.n && out.length < 40; i++) {
      if (u.faction[i] !== s.player) continue;
      const p = U.project(u.x[i], 1, u.z[i]);
      if (p && p.on && !p.behind) out.push([p.x - rr.left, p.y - rr.top]);
    }
    return out;
  }

  // ------------------------------------------------------------------ loop
  let lastT = 0;
  function loop() {
    TT._raf = requestAnimationFrame(loop);
    const t = now();
    const dt = Math.min(0.25, lastT ? t - lastT : 0);
    lastT = t;
    if (!TT.match) { cancelAnimationFrame(TT._raf); TT._raf = 0; TT.clear(); return; }
    const s = st();
    if (s && s.over) { if (TT.current) TT.clear(); return; }
    const paused = !!(SQ.game && SQ.game.paused);
    if (!paused) contextTick(dt);
    const h = TT.current;
    if (h) {
      if (!paused && t - h.born > h.life) { TT.clear(); }
      else place(h);
    } else if (TT._q.length) {
      const q = TT._q.shift();
      TT.tip(q.id, q.text, q.o);
    }
    // hide the coach while the pause menu or a menu overlay is up
    const hidden = (SQ.hud && SQ.hud.cardOpen && SQ.hud.cardOpen()) || (SQ.menus && SQ.menus.isOpen && SQ.menus.isOpen());
    TT.root.classList.toggle('hide', !!hidden);
  }
})(window.SQ = window.SQ || {});
