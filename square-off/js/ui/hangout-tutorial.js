// SQUARE OFF — "First morning in the park": the Hang Out tutorial. Guided, can't be lost, a few minutes.
// One idea per step; each step finishes only when the player does the thing (Skip, after a few seconds, is the
// only other way past a step):
//   1 look around (drag, zoom/turn, find my crew)   2 pick a group, send it to the Fountain
//   3 settling in -> hanging out earns +1/s          4 a second spot: more spots, more points
//   5 a rival arrives and argues (patience)          6 send help: two against one
//   7 walk away before patience runs out             8 a 2:00 match against an easy crew
// then a card with the three rules, then the Park Report. Uses SQ.data.hangout scenario configs
// (lookAround, firstMatch) and two small custom scenes built the same way.
// Steps 5-7 hold the argument still (rules.patienceFloor, see js/sim/hangout.js) until the player acts: the bars
// stop at 60 until help arrives, and at 40 until the group walks away, so no lesson plays itself. If a group still
// goes for coffee in step 7 the coach says why and the scene starts again. "Done" lines stay up until Next is
// tapped (steps 5-7) or for at least 4 s (the others).
//
// SQ.hangoutTutorial: init()  start(crew)  stop()  skip()  update(realDt)  active  phase -> id
//   onMatchEnd(payload)  (called by the HUD when the last scene's match ends)
//   FLOORS  the patience floors the lessons use (tests)
(function (SQ) {
  'use strict';
  const hasDoc = typeof document !== 'undefined';
  const T = SQ.hangoutTutorial = { active: false, phase: null, crew: 'hustle', rival: 'pack', _t: 0 };
  const TOTAL = 8;

  function H() { return SQ.hangoutHud; }
  function st() { return SQ.game && SQ.game.match && SQ.game.match.state; }
  function match() { return SQ.game && SQ.game.match; }
  function me() { const s = st(); return s ? s.player : 0; }
  function mySide() { const s = st(); return s ? s.sides[me()] : null; }
  function myGroups() { const s = st(); return s ? s.groups.filter((g) => g.side === me()) : []; }
  function spotIdx(id) { const s = st(); return s ? s.spots.findIndex((q) => q.id === id) : -1; }
  function play(n, o) { try { if (SQ.audio && SQ.audio.play) SQ.audio.play(n, o || {}); } catch (e) { /* */ } }
  function touchUI() { return !!(SQ.input && SQ.input.isTouch) || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches); }
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function sn(i, form) { return H().spotName(i, form); }
  // "tap" on touch screens, "click" with a mouse
  function tap(capital) { const w = touchUI() ? 'tap' : 'click'; return capital ? w.charAt(0).toUpperCase() + w.slice(1) : w; }
  function gn(g, mid) { return H().groupName(g, mid); }

  // ------------------------------------------------------------------ scenes
  const ALL = ['toddler', 'holley', 'fountain', 'garibaldi', 'smallrun'];
  const SCENES = {
    morning() {
      return { mode: 'hangout', scenario: 'lookAround', crew: T.crew, rival: T.rival, seed: 11 };
    },
    company() {
      return {
        mode: 'hangout', crew: T.crew, rival: T.rival, seed: 12,
        scenario: {
          id: 'company', title: 'Company', spots: ALL, length: 0,
          groups: [[{ slot: 0, at: 'fountain' }, { slot: 1, at: 'toddler' }, { slot: 2, at: { x: -14, z: -34 } }], [{ slot: 1, at: { x: 10, z: 38 } }]],
          holders: { fountain: 0, toddler: 0 },
          rules: { drainPerRival: 5 },
          ai: { difficulty: 'easy', flags: { passive: true, noReturn: true, script: [{ at: 1.5, group: 1, to: 'fountain' }] } },
        },
      };
    },
    leave() {
      return {
        mode: 'hangout', crew: T.crew, rival: T.rival, seed: 13,
        scenario: {
          id: 'leave', title: 'Know when to leave', spots: ALL, length: 0,
          groups: [[{ slot: 0, at: 'fountain', patience: 72 }, { slot: 1, at: 'toddler' }], [{ slot: 0, at: 'fountain' }, { slot: 2, at: { x: 26, z: -6 } }]],
          holders: { fountain: 0, toddler: 0 },
          rules: { drainPerRival: 3 },
          ai: { difficulty: 'easy', flags: { passive: true, noReturn: true, script: [{ at: 1, group: 2, to: 'fountain' }] } },
        },
      };
    },
    match() {
      return {
        mode: 'hangout', scenario: 'firstMatch', length: 120, seed: (Date.now() >>> 0),
        players: [{ crew: T.crew, ai: false }, { crew: T.rival, ai: { difficulty: 'easy', params: { lazyStart: 12, attackEvery: 55 } } }],
      };
    },
  };

  T.SCENES = SCENES;   // (test/hangout-tutorial.test.js plays them headless)

  // ------------------------------------------------------------------ pointers (ghost hand, ring, edge arrow)
  const HAND = '<svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true"><path d="M24 6c3.3 0 5.5 2.4 5.5 5.6v17.2l2.2-1.1c2.9-1.2 6 .3 6.8 3.2l.2.8 1.6-.6c2.9-1 5.9.6 6.6 3.5l.2.8 1.2-.3c2.8-.6 5.4 1.3 5.6 4.2.4 6.4-.3 11.6-3.1 15.7C48.8 58.6 44 61 37.6 61h-6.4c-4.6 0-8.3-1.9-11-5.5L9.2 41.6c-1.8-2.4-1.4-5.8 1-7.6 2.3-1.7 5.4-1.4 7.3.7l1.1 1.2V11.6C18.6 8.4 20.8 6 24 6z" fill="#fff" stroke="#163a2b" stroke-width="3" stroke-linejoin="round"/></svg>';
  function ensureLayer() {
    const root = H() && H().root;
    if (!root) return null;
    if (T.L && T.L.root.parentNode === root) return T.L;
    const L = el('div', 'hk-layer');
    L.innerHTML = '<div class="hk-ring"></div><div class="hk-hand">' + HAND + '</div><button class="hk-edge" type="button" aria-label="Look there"><span></span></button>';
    root.appendChild(L);
    T.L = { root: L, ring: L.querySelector('.hk-ring'), hand: L.querySelector('.hk-hand'), edge: L.querySelector('.hk-edge'), edgeTx: L.querySelector('.hk-edge span') };
    T.L.edge.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = T._edgeTo;
      if (p && SQ.camera) SQ.camera.focus(p.x, p.z);
    });
    return T.L;
  }
  function hidePointers() {
    worldHighlight(null);
    if (!T.L) return;
    T.L.ring.className = 'hk-ring'; T.L.hand.className = 'hk-hand'; T.L.edge.className = 'hk-edge';
  }
  // The part of the screen not covered by the HUD (score, coach line, cards, camera buttons).
  function safeRect() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const R = { top: 64, bottom: vh - 120, left: 14, right: vw - 14 };
    const rect = (k) => { const e = H().el(k); if (!e || e.offsetParent === null) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? r : null; };
    const sc = rect('score'); if (sc) R.top = Math.max(R.top, sc.bottom + 14);
    const msg = rect('msg');
    if (msg && H().el('msg').classList.contains('show')) {
      // the coach sits above the cards (portrait, desktop) or in a column on the left (phones in landscape)
      if (msg.top > vh * 0.35) R.bottom = Math.min(R.bottom, msg.top - 14);
      else if (msg.right < vw * 0.6) R.left = Math.max(R.left, msg.right + 12);
    }
    const cards = rect('cards'); if (cards) R.bottom = Math.min(R.bottom, cards.top - 14);
    const cam = rect('cam');
    if (cam && cam.top > vh * 0.5 && cam.width > cam.height) R.bottom = Math.min(R.bottom, cam.top - 10);   // phones: a row above the cards
    else if (cam && cam.left > vw * 0.55) R.right = Math.min(R.right, cam.left - 10);
    if (R.bottom - R.top < 80) R.bottom = R.top + 80;
    return R;
  }
  /** Ease the camera so a park target sits in the clear part of the screen (once per target per step). */
  function keepVisible(key, p, wp, isSpot) {
    if (T._framed === key) return;
    const R = safeRect();
    if (isSpot) { R.left += 70; R.right -= 90; }   // spot signs are wide
    const inside = p && !p.behind && p.x >= R.left && p.x <= R.right && p.y >= R.top && p.y <= R.bottom;
    if (inside) { if (T._pan && T._pan.key === key) T._framed = key; return; }
    if (!T._pan || T._pan.key !== key) T._pan = { key, n: 0 };
    T._pan.n++;
    if (T._pan.n > 45) { T._framed = key; return; }
    if (!p || p.behind || p.x < -200 || p.x > window.innerWidth + 200 || p.y < -200 || p.y > window.innerHeight + 200) {
      if (SQ.camera && wp) SQ.camera.focus(wp.x, wp.z);
      return;
    }
    const tx = (R.left + R.right) / 2, ty = R.top + (R.bottom - R.top) * 0.45;
    if (SQ.camera && SQ.camera.panScreen) SQ.camera.panScreen(p.x, p.y, p.x + (tx - p.x) * 0.22, p.y + (ty - p.y) * 0.22);
  }
  /** pointer spec: {ui: key, arg, hand: bool, round: bool} | {spot: idx, hand} | {group: id} | {gesture: 'drag'} | null */
  function worldHighlight(spec) {
    const t = spec && spec.spot !== undefined ? spec.spot : spec && spec.group !== undefined ? { group: spec.group } : null;
    const key = JSON.stringify(t);
    if (key === T._hlKey) return;
    T._hlKey = key;
    if (H() && H().highlight) H().highlight(t);
  }
  function placePointer(spec) {
    const L = ensureLayer(); if (!L) return;
    worldHighlight(spec);
    if (!spec) { hidePointers(); return; }
    const vw = window.innerWidth, vh = window.innerHeight;
    let ringOn = false, handOn = false, edgeOn = false;
    if (spec.gesture === 'drag') {
      const R = safeRect();
      L.hand.style.left = ((R.left + R.right) / 2) + 'px'; L.hand.style.top = (R.top + (R.bottom - R.top) * 0.5) + 'px';
      L.hand.className = 'hk-hand show drag';
      L.ring.className = 'hk-ring'; L.edge.className = 'hk-edge';
      return;
    }
    if (spec.ui) {
      const e = H().el(spec.ui, spec.arg);
      if (e && e.offsetParent !== null) {
        const r = e.getBoundingClientRect();
        if (r.width > 0) {
          const pad = spec.pad === undefined ? 5 : spec.pad;
          Object.assign(L.ring.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
          ringOn = spec.ring !== false;
          if (spec.hand) { L.hand.style.left = (r.left + r.width / 2) + 'px'; L.hand.style.top = (r.top + r.height * 0.55) + 'px'; handOn = true; }
        }
      }
    } else if (spec.spot !== undefined || spec.group !== undefined) {
      const p = spec.spot !== undefined ? H().screenOf('spot', spec.spot) : H().screenOf('group', spec.group);
      const s = st();
      const wp = spec.spot !== undefined ? s && s.spots[spec.spot] : s && s.groups[spec.group];
      if (spec.hand !== false && !(SQ.input && SQ.input.dragging)) keepVisible(T.i + ':' + (spec.spot !== undefined ? 's' + spec.spot : 'g' + spec.group), p, wp, spec.spot !== undefined);
      const inView = p && !p.behind && p.x > 30 && p.x < vw - 30 && p.y > 60 && p.y < vh - 130;
      if (inView) {
        if (spec.hand !== false) { L.hand.style.left = p.x + 'px'; L.hand.style.top = (p.y + 4) + 'px'; handOn = true; }
        if (spec.ringWorld) {
          const R = spec.ringWorld;
          Object.assign(L.ring.style, { left: (p.x - R) + 'px', top: (p.y - R * 0.6) + 'px', width: (R * 2) + 'px', height: (R * 1.2) + 'px' });
          ringOn = true;
        }
      } else if (wp) {
        // off screen: an arrow on the edge of the screen, pointing at it (tap it to look there)
        const c = { x: vw / 2, y: vh / 2 };
        let dx, dy;
        if (p && !p.behind) { dx = p.x - c.x; dy = p.y - c.y; } else {
          const cam = SQ.camera ? SQ.camera.state : { x: 0, z: 0, heading: 0 };
          const h = cam.heading || 0;
          const wx = wp.x - cam.x, wz = wp.z - cam.z;
          dx = wx * Math.cos(h) + wz * Math.sin(h); dy = -(wx * Math.sin(h) - wz * Math.cos(h));
        }
        const L2 = Math.hypot(dx, dy) || 1;
        const mx = vw / 2 - 40, my = vh / 2 - 110;
        const k = Math.min(mx / Math.abs(dx / L2 || 1e-6), my / Math.abs(dy / L2 || 1e-6));
        const ex = c.x + dx / L2 * k, ey = c.y + dy / L2 * k;
        L.edge.style.left = ex + 'px'; L.edge.style.top = ey + 'px';
        L.edge.style.setProperty('--a', (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(0) + 'deg');
        L.edgeTx.textContent = spec.label || (spec.spot !== undefined ? sn(spec.spot, 'bare') : (wp.short || wp.name || ''));
        T._edgeTo = { x: wp.x, z: wp.z };
        edgeOn = true;
      }
    }
    L.ring.className = 'hk-ring' + (ringOn ? ' show' : '') + (spec.round ? ' round' : '');
    L.hand.className = 'hk-hand' + (handOn ? ' show tap' : '');
    L.edge.className = 'hk-edge' + (edgeOn ? ' show' : '');
  }

  // ------------------------------------------------------------------ phases
  // {id, step, scene?, enter(), tick(dt) -> true when done, pointer() -> spec, text() -> coach spec, done() -> coach spec, auto() (skip)}
  function coach(o) {
    const step = T.cur ? T.cur.step : 1;
    const spec = Object.assign({ step, total: TOTAL, title: o.title || T.cur.title }, o);
    if (T.cur && T._phaseT > 7 && o.skip !== false && !o.done && T.cur.auto !== false) spec.skip = () => T.skip();
    const key = JSON.stringify([spec.text, spec.html, spec.sub, spec.done, !!spec.skip, spec.next && spec.next.label, spec.step]);
    if (key === T._coachKey) return;
    T._coachKey = key;
    H().coach(spec);
  }
  function camFit(points, opts) { if (SQ.camera && SQ.camera.fit) SQ.camera.fit(points, opts || {}); }
  function groupsPts(list) { return list.filter((g) => !g.coffee).map((g) => [g.x, g.z]); }
  function lit(key, arg) { const e = H().el(key, arg); if (e) { e.classList.remove('lit'); void e.offsetWidth; e.classList.add('lit'); } }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  // Lessons 5-7 hold the argument still until the player acts (js/sim/hangout.js rules.patienceFloor):
  // a number for both crews, or [yours, theirs]. 0 lets patience run out as usual.
  T.FLOORS = { argue: 60, help: 60, leave: [40, 30] };
  function setFloor(v) {
    const m = match(); if (!m || !m.rules) return;
    if (Array.isArray(v)) { const me0 = me(); const out = []; out[me0] = v[0]; out[1 - me0] = v[1]; m.rules.patienceFloor = out; }
    else m.rules.patienceFloor = v || 0;
  }
  /** My groups that are not on a coffee break and were not sent anywhere yet. */
  function freeGroups() { return myGroups().filter((g) => g.spot < 0 && !g.coffee); }
  /** One of my groups walking to / settling in at a spot my crew does not hold yet (step 4's progress). */
  function newSpotGroup(status) {
    const s = st(); if (!s) return null;
    return myGroups().find((g) => g.status === status && g.spot >= 0 && s.spots[g.spot].holder !== me()) || null;
  }
  /** Step 4's target: the spot nearest a free group that my crew neither holds nor has a group heading to. */
  function spreadTarget() {
    const s = st(), m = match(); if (!s || !m) return -1;
    const taken = new Set(myGroups().filter((g) => g.spot >= 0 && !g.coffee).map((g) => g.spot));
    const g = freeGroups()[0] || myGroups().find((q) => !q.coffee);
    let best = -1, bt = Infinity;
    for (const sp of s.spots) {
      if (sp.holder === me() || taken.has(sp.idx)) continue;
      let t = 999;
      try { t = g ? m.eta(g.id, sp.idx) : Math.hypot(sp.x, sp.z); } catch (e) { t = 999; }
      if (t < bt) { bt = t; best = sp.idx; }
    }
    return best;
  }
  /** Play the current lesson's scene again from the start (step 7 after a coffee break). */
  function replayScene() {
    if (!T.cur || !T.cur.scene) return;
    T.sceneId = null;
    goTo(T.i);
  }

  const PHASES = [
    // 1 — look around
    {
      id: 'look', step: 1, scene: 'morning', title: 'Look around',
      enter() {
        H().reveal({ top: false, cards: false, cam: true, mini: true, clock: false });
        if (SQ.camera) SQ.camera.resetStats();
      },
      tick() { return SQ.camera && SQ.camera.stats.pan >= 28; },
      pointer() { return { gesture: 'drag' }; },
      text() {
        return touchUI()
          ? { text: 'Good morning! Drag the park with one finger to look around.', sub: 'This is Washington Square Park. Your crew wants the best spots in it.' }
          : { text: 'Good morning! Drag the park with the mouse (or press W A S D) to look around.', sub: 'This is Washington Square Park. Your crew wants the best spots in it.' };
      },
      done: { text: 'That is how you move the view.' },
    },
    {
      id: 'zoom', step: 1, title: 'Look around',
      enter() { if (SQ.camera) SQ.camera.resetStats(); lit('cam'); },
      tick() { const s = SQ.camera && SQ.camera.stats; return !!s && (s.zoom >= 0.3 || s.rot >= 0.7); },
      pointer() { return { ui: 'cam', pad: 6 }; },
      text() {
        const r = H().el('cam') && H().el('cam').getBoundingClientRect();
        const where = r && r.width > r.height ? 'The buttons just above your cards' : 'The buttons on the right';
        return touchUI()
          ? { text: 'Pinch with two fingers (or tap + and −) to zoom in and out. Turn the view with ⟲ ⟳ (or twist two fingers).', sub: where + ' do it too.' }
          : { text: 'Scroll the mouse wheel to zoom in and out. Turn the view with ⟲ ⟳ (or Q and E).', sub: where + ' do the same: + and − zoom, and dragging with the right button turns.' };
      },
      done: { text: 'You can look at the park from any side.' },
    },
    {
      id: 'find', step: 1, title: 'Look around',
      enter() { T._found = false; lit('mini'); },
      tick() { return T._found; },
      pointer() { return { ui: 'cam.find', hand: true, round: false }; },
      text() { return { text: 'Lost? ' + tap(1) + ' ⌖ to find your crew.', sub: 'You can also ' + tap() + ' the round map (top right) to jump anywhere.' + (touchUI() ? '' : ' Space does the same as ⌖.') }; },
      done: { text: 'There they are: your crew, by the Arch.' },
    },
    // 2 — your groups; pick one, send it
    {
      id: 'pick', step: 2, title: 'Your crew',
      enter() {
        H().reveal({ top: false, cards: true, cam: true, mini: true, clock: false, names: true });
        lit('cards');
        const s = st();
        const fi = spotIdx('fountain');
        const e = s.sides[me()].entrance;
        const step = Math.PI / 4;
        camFit(groupsPts(myGroups()).concat([[s.spots[fi].x, s.spots[fi].z]]), { pad: 14, heading: Math.round(Math.atan2(-e.x, e.z) / step) * step });
      },
      tick() { return H().selected >= 0; },
      pointer() { const gs = myGroups(); return { ui: 'card', arg: gs[Math.min(1, gs.length - 1)].id, hand: true }; },
      text() {
        const gs = myGroups();
        return { html: 'These are your three groups: <b>' + gs.map((g) => esc(g.short || g.name)).join('</b>, <b>') + '</b>. ' + tap(1) + ' one.', sub: 'The same people all match long. Their cards say what they are doing.' + (touchUI() ? '' : ' Keys 1, 2 and 3 work too.') };
      },
      done: null,
      auto() { const g = myGroups()[0]; if (g) H().select(g.id, { quiet: true }); },
    },
    {
      id: 'send', step: 2, title: 'Your crew',
      enter() { T._groundTip = false; },
      tick() { return myGroups().some((g) => g.spot >= 0); },
      pointer() {
        if (H().selected < 0) { const gs = myGroups().filter((g) => !g.coffee); return gs.length ? { ui: 'card', arg: gs[Math.min(1, gs.length - 1)].id, hand: true } : null; }
        return { spot: spotIdx('fountain'), hand: true, ringWorld: 40 };
      },
      text() {
        if (H().selected < 0) {
          if (T._groundTip) return { text: 'That was just pavement: groups only score at spots. ' + tap(1) + ' a card again, then the Fountain (its sign works too).' };
          return { text: tap(1) + ' one of your group cards first.', sub: 'Then ' + tap() + ' the Fountain.' };
        }
        const g = st().groups[H().selected];
        if (T._groundTip) return { text: 'That was just pavement. ' + tap(1) + ' the Fountain (its sign works too) to send ' + gn(g, true) + ' there.' };
        return { text: 'Now ' + tap() + ' the Fountain to send ' + gn(g, true) + ' there.', sub: tap(1) + ' a group, then ' + tap() + ' a spot. That is the whole control.' };
      },
      done: { text: 'On their way!' },
      auto() { const g = myGroups()[0]; if (g) { H().select(g.id, { quiet: true }); H().send(spotIdx('fountain')); } },
    },
    // 3 — settling in -> hanging out
    {
      id: 'earn', step: 3, title: 'Hanging out',
      enter() { T._shownScore = false; },
      tick() {
        const side = mySide();
        if (side.holding > 0 && !T._shownScore) { T._shownScore = true; H().reveal({ top: true, them: false, clock: false, names: true }); lit('me'); }
        return side.points >= 6;
      },
      pointer() {
        const g = myGroups().find((q) => q.spot >= 0);
        if (!g) return null;
        if (g.status === 'walking') return { group: g.id, hand: false };
        return T._shownScore ? { ui: 'me', pad: 4 } : null;
      },
      text() {
        const g = myGroups().find((q) => q.spot >= 0);
        if (!g) return { text: 'Send a group to a spot.' };
        if (g.status === 'walking') {
          let eta = '';
          try { eta = ' (about ' + Math.max(1, Math.round(match().eta(g.id, g.spot))) + ' s)'; } catch (e) { eta = ''; }
          return { text: gn(g) + ' are walking to ' + sn(g.spot) + eta + '.', sub: 'When they get there, they settle in for 3 quiet seconds.' };
        }
        if (g.status === 'settling') return { text: 'Settling in: 3 quiet seconds…', sub: 'Unfolding chairs, finding the good bench.' };
        if (g.status === 'hanging') return { html: '<b>Hanging out!</b> Your crew now gets <b>+1 point every second</b>. Watch your score at the top.', sub: 'Points come only from groups hanging out at spots.' };
        return { text: gn(g) + ' are on their way.' };
      },
      done: { text: 'That is how you score: hang out at a spot.' },
    },
    // 4 — more spots, more points
    {
      id: 'spread', step: 4, title: 'More spots',
      enter() { lit('cards'); T._spreadTarget = -1; },
      tick() { return mySide().holding >= 2; },
      pointer() {
        const s = st();
        // a second group settling in at a new spot is progress: no hand, the camp going up is the timer
        if (newSpotGroup('settling')) return null;
        const mover = newSpotGroup('walking');
        if (mover) return { group: mover.id, hand: false };
        const sel = H().selected;
        const free = freeGroups();
        const target = spreadTarget();
        if (sel >= 0 && s.groups[sel] && !s.groups[sel].coffee && target >= 0 && (s.groups[sel].spot < 0 || s.groups[sel].spot !== s.groups[sel].at || free.indexOf(s.groups[sel]) >= 0)) {
          return { spot: target, hand: true, ringWorld: 30 };
        }
        if (free.length) return { ui: 'card', arg: free[0].id, hand: true };
        return null;
      },
      text() {
        const settling = newSpotGroup('settling');
        if (settling) {
          const sp = st().spots[settling.at];
          const left = Math.max(1, Math.ceil(match().rules.settleTime - sp.settle));
          return { html: '<b>Settling in…</b> ' + left + ' s', sub: 'Then ' + gn(settling, true) + ' earn +1 a second too: +2 a second for your crew.' };
        }
        const mover = newSpotGroup('walking');
        if (mover) return { text: 'Good. When ' + gn(mover, true) + ' settle in at ' + sn(mover.spot) + ', you will earn +2 a second.', sub: 'Two groups at one spot still earn just +1, so spread out.' };
        const target = spreadTarget();
        return { html: 'More spots, more points. Send <b>another group</b> to a different spot.', sub: target >= 0 ? cap(sn(target)) + ' is free and close to your entrance.' : '' };
      },
      done: { html: 'Two spots: <b>+2 a second</b>. Five spots, and each crew has three groups: someone is always short.' },
      auto() { const g = freeGroups()[0]; const t = spreadTarget(); if (g && t >= 0) { H().select(g.id, { quiet: true }); H().send(t); } },
    },
    // 5 — company: a rival arrives and argues (the argument holds at 60 until the player has looked)
    {
      id: 'argue', step: 5, scene: 'company', title: 'Company',
      enter() {
        H().reveal({ clock: false });
        const s = st(), fi = spotIdx('fountain');
        camFit([[s.spots[fi].x, s.spots[fi].z + 6]], { pad: 26, min: 60, max: 120 });
        T._argueT = 0; T._next = false;
        setFloor(T.FLOORS.argue);
      },
      tick(dt) {
        const s = st(), fi = spotIdx('fountain');
        if (s.spots[fi].arguing) T._argueT += dt;
        // the player moved away and they took the Fountain: straight on to "two against one", which starts there
        if (s.spots[fi].holder >= 0 && s.spots[fi].holder !== me()) return true;
        return T._next;
      },
      pointer() {
        const s = st(), fi = spotIdx('fountain');
        const holder = myGroups().find((g) => g.at === fi);
        if (s.spots[fi].arguing && T._argueT > 6) return { ui: 'coachNext', hand: true, pad: 4 };
        if (s.spots[fi].arguing && holder) return { ui: 'cardBar', arg: holder.id, pad: 4 };
        const r = s.groups.find((g) => g.side !== me() && !g.coffee);
        return r ? { group: r.id, hand: false, label: r.short } : null;
      },
      text() {
        const s = st(), fi = spotIdx('fountain');
        const r = s.groups.find((g) => g.side !== me());
        const holder = myGroups().find((g) => g.at === fi);
        const mineHeld = s.spots[fi].holder === me();
        if (!s.spots[fi].arguing) return { html: 'Company! <b>' + esc(gn(r)) + '</b> from ' + esc(String(s.sides[r.side].name).replace(/^The /, 'the ')) + ' are heading for ' + (mineHeld ? 'your spot at the Fountain' : 'the Fountain') + '.', sub: 'Rival groups at the same spot argue.' };
        const paused = holder && holder.patience <= T.FLOORS.argue + 0.5;
        return {
          html: 'They are <b>arguing</b>. Each rival drains your <b>patience</b>: watch the bar on the card (and over their heads).',
          sub: (holder && mineHeld ? gn(holder) + ' were here first, so they keep earning +1 a second while they argue.' : 'Out of patience means a coffee break.') + (paused ? ' (For this lesson the bars stop at ' + T.FLOORS.argue + '.)' : ''),
          next: T._argueT > 3.5 ? { label: 'Next', fn: () => { T._next = true; } } : null,
        };
      },
      done: null,
      auto() { /* Skip: on to the next lesson */ },
    },
    // 6 — two against one (the bars stay at 60 until two of yours are at the Fountain)
    {
      id: 'help', step: 6, title: 'Two against one', holdDone: true,
      enter() {
        T._helped = false; T._evicted = false; T._evictMsg = ''; T._floorOff = false;
        setFloor(T.FLOORS.help);
        lit('cards');
      },
      tick() {
        const fi = spotIdx('fountain');
        if (!T._floorOff && myGroups().filter((g) => g.at === fi && !g.coffee).length >= 2) { T._floorOff = true; setFloor(0); }
        return T._evicted;
      },
      pointer() {
        const s = st(), fi = spotIdx('fountain');
        const mineThere = myGroups().filter((g) => g.at === fi && !g.coffee).length;
        const coming = myGroups().filter((g) => g.spot === fi && g.at !== fi && !g.coffee).length;
        if (mineThere + coming < 2) {
          const helper = myGroups().find((g) => g.spot !== fi && !g.coffee && g.at < 0) || myGroups().find((g) => g.spot !== fi && !g.coffee);
          const sel = H().selected;
          if (helper && sel !== helper.id && (sel < 0 || s.groups[sel].spot === fi)) return { ui: 'card', arg: helper.id, hand: true };
          if (sel >= 0) return { spot: fi, hand: true, ringWorld: 40 };
        }
        const r = s.groups.find((g) => g.side !== me() && !g.coffee && g.at === fi);
        return r ? { group: r.id, hand: false } : null;
      },
      text() {
        const s = st(), fi = spotIdx('fountain');
        const r = s.groups.find((g) => g.side !== me() && !g.coffee);
        const mineThere = myGroups().filter((g) => g.at === fi && !g.coffee).length;
        const coming = myGroups().filter((g) => g.spot === fi && g.at !== fi && !g.coffee);
        const paused = !T._floorOff ? ' (Their bars stop at ' + T.FLOORS.help + ' until help arrives.)' : '';
        if (T._floorOff) return { html: '<b>Two against one:</b> each of your groups drains them, so their bar empties twice as fast.', sub: 'Yours drain slower: only one of them is arguing with each of you.' };
        if (r && s.spots[fi].holder === r.side) {
          if (mineThere + coming.length >= 2) return { text: 'Two of yours are on the way. Two against one makes them leave.', sub: 'Watch their bar once both are there.' + paused };
          if (mineThere === 1) return { html: 'One against one, the group that was there first stays. Send <b>a second group</b> to the Fountain.', sub: tap(1) + ' a card, then ' + tap() + ' the Fountain.' + paused };
          return { html: 'They took the Fountain. Send <b>two groups</b> there to make them leave.', sub: 'Two of yours drain them twice as fast.' + paused };
        }
        if (coming.length) {
          let eta = '';
          try { eta = ' (' + Math.max(1, Math.round(match().eta(coming[0].id, fi))) + ' s)'; } catch (e) { eta = ''; }
          return { html: 'Help is on the way' + eta + '. When ' + esc(gn(coming[0], true)) + ' get there it is <b>two against one</b>.', sub: 'Watch their bar.' + paused };
        }
        const helper = myGroups().find((g) => g.spot !== fi && !g.coffee && g.at < 0) || myGroups().find((g) => g.spot !== fi && !g.coffee);
        return { html: 'One against one takes ages. Send <b>' + esc(helper ? gn(helper, true) : 'another group') + '</b> to help at the Fountain: <b>two against one</b> makes them leave.', sub: tap(1) + ' the card, then ' + tap() + ' the Fountain.' + paused };
      },
      done() { return { html: T._evictMsg || '<b>Two against one:</b> they ran out of patience first and <b>went for coffee</b>. They come back in 15 s.' }; },
      auto() { const fi = spotIdx('fountain'); const g = myGroups().find((q) => q.spot !== fi && !q.coffee); if (g) { H().select(g.id, { quiet: true }); H().send(fi); } },
    },
    // 7 — know when to leave (your bar stops at 40 until you walk away; theirs at 30)
    {
      id: 'leave', step: 7, scene: 'leave', title: 'Know when to leave', holdDone: true,
      enter() {
        H().reveal({ clock: false });
        const s = st(), fi = spotIdx('fountain');
        camFit([[s.spots[fi].x, s.spots[fi].z], [s.spots[spotIdx('holley')].x + 10, 0]], { pad: 20, min: 70, max: 140 });
        T._minPat = 999; T._result = ''; T._resT = 0;
        setFloor(T.FLOORS.leave);
      },
      tick(dt) {
        const side = mySide();
        const g = myGroups()[0];
        if (!g) return false;
        if (!g.coffee) T._minPat = Math.min(T._minPat, g.patience);
        if (side.stats.withdrawals > 0 && !T._result) T._result = 'walked';
        if (side.stats.coffees > 0 && T._result !== 'coffee') { T._result = 'coffee'; T._resT = 0; }
        if (T._result === 'walked') return !g.arguing && !g.coffee && g.patience >= T._minPat + 10;
        if (T._result === 'coffee') {
          // a coffee break does not pass the lesson: say why, then play the scene again
          T._resT += dt;
          if (T._resT > 6) replayScene();
        }
        return false;
      },
      pointer() {
        const g = myGroups()[0];
        if (!g) return null;
        if (T._result === 'coffee') return { ui: 'card', arg: g.id };
        if (T._result) return { ui: 'cardBar', arg: g.id, pad: 4 };
        const sel = H().selected;
        const s = st();
        const rivals = s.groups.filter((q) => q.side !== me() && q.at === g.at && !q.coffee).length;
        if (rivals < 2) return { ui: 'cardBar', arg: g.id, pad: 4 };
        if (sel !== g.id) return { ui: 'card', arg: g.id, hand: true };
        return { spot: spotIdx('holley'), hand: true, ringWorld: 34 };
      },
      text() {
        const s = st();
        const g = myGroups()[0];
        if (T._result === 'coffee') return { html: '<b>Out of patience:</b> ' + esc(gn(g, true)) + ' went for coffee. That is 15 s out of the game.', sub: 'Let\'s try that again: walk away before the bar runs out.', skip: false };
        if (T._result === 'walked') return { html: 'Walking away is allowed. <b>Patience refills</b> when nobody argues with you.', sub: 'Watch the bar on the card fill up again.' };
        const rivals = s.groups.filter((q) => q.side !== me() && q.at === g.at && !q.coffee).length;
        if (rivals < 2) return { html: 'Another of their groups is coming. Two rivals drain your patience <b>twice as fast</b>.', sub: 'Out of patience means a coffee break: 15 s out of the game.' };
        const floor = Array.isArray(T.FLOORS.leave) ? T.FLOORS.leave[0] : T.FLOORS.leave;
        const stuck = g.patience <= floor + 0.5;
        return {
          html: 'Two against one: you will lose this one. <b>Walk away:</b> ' + tap() + ' ' + esc(gn(g, true)) + ', then ' + tap() + ' Holley Plaza.',
          sub: stuck ? 'The bar is paused at ' + floor + ' for this lesson. In a match they would soon go for coffee.' : 'Leaving early keeps them in the game.',
        };
      },
      done() { return { html: 'Smart. A group that walks away gets its patience back. If the bar runs out, the group goes for coffee: 15 s, then it <b>walks back to the same spot</b> on its own (tap its card to send it somewhere else).' }; },
      auto() { const g = myGroups()[0]; if (g && !g.coffee) { H().select(g.id, { quiet: true }); H().send(spotIdx('holley')); } },
    },
    // 8 — a real (short) match
    {
      id: 'match', step: 8, scene: 'match', title: 'First afternoon',
      enter() {
        H().reveal(null);
        if (SQ.game) SQ.game.pause(true);
        T._go = false;
      },
      tick() { return false; },   // ends via onMatchEnd
      pointer() { return T._go ? null : { ui: 'clock', pad: 4 }; },
      text() {
        if (T._go) return null;
        return {
          html: 'Your first match: <b>2 minutes</b> against an easy crew. <b>Most points when the clock runs out wins.</b>',
          sub: 'Five spots, three groups each. Hang out to score. Make them leave.',
          next: { label: 'Go!', fn: () => { T._go = true; H().coach(null); T._coachKey = ''; hidePointers(); if (SQ.game) SQ.game.pause(false); } },
          skip: false,
        };
      },
      auto: false,
    },
  ];

  // ------------------------------------------------------------------ flow
  function goTo(i) {
    T.i = i;
    T.cur = PHASES[i];
    T._phaseT = 0; T._doneT = -1; T._coachKey = ''; T._framed = null; T._pan = null;
    if (!T.cur) return;
    if (T.cur.scene && T.cur.scene !== T.sceneId) {
      T.sceneId = T.cur.scene;
      T._starting = true;
      try { SQ.game.start(SCENES[T.sceneId]()); } catch (e) { console.error('[tutorial] scene', e); }
      T._starting = false;
      if (SQ.menus && SQ.menus.close) SQ.menus.close();
    }
    T.phase = T.cur.id;
    try { T.cur.enter && T.cur.enter(); } catch (e) { console.error('[tutorial] enter', e); }
    refresh();
  }
  function refresh() {
    const c = T.cur; if (!c || !T.active) return;
    if (T._doneT >= 0) return;
    const spec = c.text ? c.text() : null;
    if (spec) coach(spec); else if (T._coachKey !== '') { H().coach(null); T._coachKey = ''; }
  }
  // A finished step says so, with a Next button. The rules lessons (5-7) wait for Next; the others move on by
  // themselves after a reading time of at least 4 s.
  function readTime(d) {
    const words = String((d && (d.text || d.html)) || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    return Math.min(9, Math.max(4, 1.6 + words * 0.24));
  }
  function finishPhase() {
    const c = T.cur;
    const d = typeof c.done === 'function' ? c.done() : c.done;
    play('gained', { volume: 0.7 });
    if (d) {
      const at = T.i;
      T._doneT = 0; T._coachKey = '';
      T._doneMax = c.holdDone ? Infinity : readTime(d);
      coach(Object.assign({ done: true, skip: false, next: { label: c.holdDone ? 'Next' : 'Next ›', fn: () => { if (T.active && T.i === at && T._doneT >= 0) goTo(T.i + 1); } } }, d));
    } else { T._doneT = 0; T._doneMax = 0; }
  }

  T.init = function () {
    if (T._inited || !hasDoc) return;
    T._inited = true;
    if (SQ.bus) {
      SQ.bus.on('gameQuit', () => { if (T.active && !T._starting) T.stop(true); });
      SQ.bus.on('gameStart', (p) => { if (T.active && !T._starting && p && p.match && p.match !== match()) T.stop(true); });
    }
    if (SQ.hangoutHud && SQ.hangoutHud.onEvent) SQ.hangoutHud.onEvent(onEvent);
  };

  function onEvent(name, p) {
    if (!T.active || !T.cur) return;
    const id = T.cur.id;
    if (name === 'ui' && p.kind === 'cam' && p.what === 'find') T._found = true;
    if (name === 'ui' && p.kind === 'mini' && id === 'find') T._found = true;
    if (name === 'ordered' && p.side === me() && id === 'send' && !p.spot) T._groundTip = true;
    if (name === 'tap' && id === 'send' && p.pick && p.pick.kind === 'ground' && H().selected >= 0) T._groundTip = true;
    if (name === 'ordered' && p.side === me() && id === 'help' && p.spot === 'fountain') T._helped = true;
    // step 6 passes only on an eviction that comes after help arrived (the bars are held at 60 until then)
    if (name === 'wentForCoffee' && id === 'help' && p.side !== me() && T._floorOff && T._doneT < 0) {
      T._evictMsg = p.tie
        ? 'Both ran out of patience at the same moment, and <b>the group that was there first stays</b>. They went for coffee: back in 15 s.'
        : (p.rivals || 0) >= 2
          ? '<b>Two against one:</b> they ran out of patience first and <b>went for coffee</b>. They come back in 15 s.'
          : 'They ran out of patience first and <b>went for coffee</b>. They come back in 15 s.';
      T._evicted = true;
    }
  }

  T.start = function (crew) {
    T.init();
    const crews = ['hustle', 'noise', 'violets', 'pack'];
    T.crew = crews.indexOf(crew) >= 0 ? crew : 'hustle';
    T.rival = T.crew === 'pack' ? 'violets' : 'pack';
    T.active = true;
    T.sceneId = null;
    T._ending = false;
    goTo(0);
  };

  T.stop = function (quiet) {
    if (!T.active) return;
    T.active = false;
    T.cur = null; T.phase = null; T.sceneId = null;
    hidePointers();
    if (T._end) { T._end.remove(); T._end = null; }
    if (H()) { H().coach(null); H().reveal(null); }
    if (!quiet && SQ.game && SQ.game.paused) SQ.game.pause(false);
  };

  T.skip = function () {
    const c = T.cur; if (!c || !T.active) return;
    if (c.auto === false) { if (T.i < PHASES.length - 1) goTo(T.i + 1); return; }
    if (typeof c.auto === 'function') { try { c.auto(); } catch (e) { console.error(e); } }
    hidePointers();
    goTo(T.i + 1);
  };

  T.update = function (dt) {
    if (!T.active || !T.cur) return;
    dt = Math.min(0.1, dt || 0);
    if (SQ.game && SQ.game.paused && T.cur.id !== 'match') { placePointer(null); return; }
    T._phaseT += dt;
    const c = T.cur;
    if (T._doneT >= 0) {
      T._doneT += dt;
      // the rules lessons wait for Next: after a few seconds the hand shows where it is
      placePointer(T._doneMax === Infinity && T._doneT > 4 ? { ui: 'coachNext', hand: true, pad: 4 } : null);
      if (T._doneT > T._doneMax) goTo(T.i + 1);
      return;
    }
    let done = false;
    try { done = !!c.tick(dt); } catch (e) { console.error('[tutorial] tick', e); }
    if (done) { finishPhase(); return; }
    refresh();
    let spec = null;
    try { spec = c.pointer ? c.pointer() : null; } catch (e) { spec = null; }
    placePointer(spec);
  };

  // ------------------------------------------------------------------ the end
  T.onMatchEnd = function (e) {
    if (!T.active) return;
    T._ending = true;
    hidePointers();
    H().coach(null);
    try {
      const d = SQ.save && SQ.save.data;
      if (d) { d.ho = d.ho || {}; d.ho.tutorialDone = true; d.ho.crew = T.crew; if (e.playerWon) d.ho.tutorialWon = true; SQ.save.write(); }
    } catch (er) { /* */ }
    const m = match();
    setTimeout(() => { if (match() === m) showEnd(e, m); }, 2000);
  };

  function showEnd(e, m) {
    const root = H().root;
    const s = m.state;
    const sc = e.score || s.sides.map((q) => q.points);
    const mine = sc[s.player], theirs = sc[1 - s.player];
    const head = e.playerWon ? 'You won, ' + mine + ' to ' + theirs + '!' : e.winner < 0 ? 'A draw, ' + mine + ' all.' : 'Close one: ' + mine + ' to ' + theirs + '. You will get them next time.';
    const d = el('div', 'hk-end');
    d.innerHTML = '<div class="hp-card" role="dialog" aria-label="Tutorial complete">' +
      '<h2>That is the whole game</h2><p class="hk-big">' + esc(head) + '</p>' +
      '<ol class="hw-rules">' +
      '<li><span class="hw-n"></span><div><b>Hang out at a spot to score.</b><span>3 quiet seconds, then +1 point a second.</span></div></li>' +
      '<li><span class="hw-n"></span><div><b>Arguing drains patience.</b><span>Out of patience means a coffee break: 15 s, then the group walks back. Walk away early and it refills.</span></div></li>' +
      '<li><span class="hw-n"></span><div><b>Most points at 0:00 wins.</b><span>A normal match lasts 5 minutes.</span></div></li>' +
      '</ol>' +
      '<p class="hw-tip"><b>Tip:</b> to make a group leave a spot, send two of yours. Two against one wins.</p>' +
      '<div class="hp-btns row"><button class="mbtn primary big" data-a="report" type="button"><b>See the Park Report</b></button></div></div>';
    d.querySelectorAll('.hw-rules li').forEach((li) => { li.style.gridTemplateColumns = '1fr'; });
    root.appendChild(d);
    T._end = d;
    d.querySelector('[data-a="report"]').addEventListener('click', () => {
      play('click');
      d.remove(); T._end = null;
      T.stop(true);
      if (SQ.menus && SQ.menus.showHangoutReport) SQ.menus.showHangoutReport(e, m, { tutorial: true });
    });
  }
})(window.SQ = window.SQ || {});
