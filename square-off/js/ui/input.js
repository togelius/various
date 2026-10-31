// SQUARE OFF — unified touch, mouse and keyboard input → SQ.cmd (DESIGN §5.1–5.3).
// Squads-and-chips selection model, tap/drag/long-press/lasso/pinch/twist, desktop box select and
// right-click context orders, hotkeys, Crew Call targeting, tactical pause, undo, ghost path lines.
// Picking priority: HUD (DOM catches it first) → squad chip (HUD) → unit (24 px) → squirrel → dosa cart
// → landmark disc → build pad → ground.
//
// SQ.input API (for HUD / menus / tutorial):
//   init(viewEl)  update(realDt)  setMatch(m)
//   selected (Set of unit ids)   getSelection() -> ids[]   hasSelection()   isTouch   dragging   crewMode
//   select(ids, {add})  clearSelection()  selectSquad(n, {add, center})  selectArmy()  assignSquad(n)
//   sendSelection({lm} | {x, z} | {targetId}, {queue})   order(type, target)   stop()  hold()
//   recruit(cls)   rallyAll(lmId)   setRally(lmId)   buildMenu(lmId, padIdx?)   undo()
//   beginCrewCall()  cancelCrewCall()  toggleCrewCall()
//   chipDrag(squadIdx, clientX, clientY, phase 'move'|'end'|'cancel') -> snapped target  (drag a chip onto the map)
//   pick(clientX, clientY) -> {kind:'unit'|'squirrel'|'dosa'|'landmark'|'pad'|'ground', ...}
//   squads() -> [{idx, ids, pips:{crowd,talker,heavy}, hp (0..1), idle, x, z}]   (0 = Reserve, 1..5)
//   hover -> {lm, unit, x, z}   alerts -> [{x, z, t, lm}] (Space jumps to the latest)
// SQ.bus events emitted (UI-side): 'selection' {ids, squads[]}, 'landmarkTap' {lm, x, y}, 'buildMenu' {lm, pad},
//   'inspect' {unit, x, y, cls, faction} | {unit:null}, 'crewMode' {on, kind}, 'undoAvailable' {n, until},
//   'orderIssued' {type, n}, 'inputDenied' {reason}
(function (SQ) {
  'use strict';
  const TAP_MOVE = 10, TAP_MS = 350, DBL_MS = 320;
  const LP_LANDMARK = 0.5, LP_GROUND = 0.3, LP_RIGHT = 0.5;

  const I = {
    view: null, match: null, layer: null,
    pointers: new Map(), gesture: null, mouse: { x: -1, y: -1, over: false },
    selected: new Set(), lastTap: { t: 0, x: 0, y: 0, unit: -1 },
    crew: null, undoStack: null, undoUntil: 0, toast: null,
    keyTwice: { n: -1, t: 0 }, hover: { lm: -1, unit: -1, x: 0, z: 0 }, hoverDirty: false,
    alerts: [], offs: [], isTouch: false, time: 0, tabIdx: -1, lastSelKey: '',
    radial: null, box: null, lasso: null,
  };

  // ---------------------------------------------------------------- helpers
  function M() { return I.match; }
  function S() { return I.match && I.match.state; }
  function me() { const s = S(); return s ? s.player : -1; }
  function UF() { return SQ.C.UF; }
  function sound(name, opts) { if (SQ.audio && SQ.audio.play) try { SQ.audio.play(name, opts || {}); } catch (e) { /* audio optional */ } }
  function emit(name, p) { if (SQ.bus) SQ.bus.emit(name, p); }
  function hud(fn) { const h = SQ.hud; if (h && typeof h[fn] === 'function') { const a = Array.prototype.slice.call(arguments, 1); try { return h[fn].apply(h, a); } catch (e) { console.error('[input] hud.' + fn, e); } } return undefined; }
  function hasHud(fn) { return !!(SQ.hud && typeof SQ.hud[fn] === 'function'); }
  function now() { return performance.now(); }
  function ground(cx, cy) { return SQ.render && SQ.render.screenToGround ? SQ.render.screenToGround(cx, cy) : null; }
  function scr(x, y, z) { return SQ.render.worldToScreen(x, y, z, {}); }
  function menuOpen() { const m = document.getElementById('menu'); return !!(m && m.childElementCount && getComputedStyle(m).display !== 'none' && m.querySelector('*') && !m.classList.contains('hidden')); }
  function camTouch() { if (SQ.camera && SQ.camera.touch) SQ.camera.touch(); }

  function alive(state, id) {
    const i = SQ.World.unitIndex(state, id);
    return i >= 0 && state.units.faction[i] === state.player && !(state.units.flags[i] & UF().OVERIT) ? i : -1;
  }

  // ---------------------------------------------------------------- selection
  function setSelection(ids, opts) {
    opts = opts || {};
    if (!opts.add) I.selected.clear();
    for (const id of ids) I.selected.add(id);
    // a selection made for the player (match start) is not "chosen": the first tap on it keeps it
    I.userSel = !opts.auto;
    const before = I.lastSelKey;
    selectionChanged(opts.silent);
    if (!opts.auto && I.selected.size) {
      // re-selecting the same squad still gives feedback (and tells the tutorial)
      if (before === I.lastSelKey && !opts.silent) { sound('select'); emit('selection', { ids: Array.from(I.selected), squads: squadsOfIds(Array.from(I.selected)) }); }
      if (I.match && SQ.Campaign && typeof SQ.Campaign.notify === 'function') {
        try { SQ.Campaign.notify(I.match, 'selected'); } catch (e) { /* tutorial signal only */ }
      }
    }
  }
  function selectionChanged(silent) {
    const ids = Array.from(I.selected);
    const key = ids.join(',');
    if (key === I.lastSelKey) return;
    I.lastSelKey = key;
    if (!silent && ids.length) sound('select');
    emit('selection', { ids, squads: squadsOfIds(ids) });

    if (SQ.render) SQ.render.invalidate();
  }
  function squadsOfIds(ids) {
    const s = S(); if (!s) return [];
    const set = new Set();
    for (const id of ids) { const i = SQ.World.unitIndex(s, id); if (i >= 0) set.add(s.units.squad[i]); }
    return Array.from(set);
  }
  function unitsWhere(fn) {
    const s = S(); if (!s) return [];
    const u = s.units, out = [];
    for (let i = 0; i < u.n; i++) if (u.faction[i] === s.player && !(u.flags[i] & UF().OVERIT) && fn(i, u)) out.push(u.id[i]);
    return out;
  }
  function squadIds(n) { return unitsWhere((i, u) => u.squad[i] === n && !(u.flags[i] & UF().REGULAR)); }
  function selectSquad(n, opts) {
    opts = opts || {};
    const ids = squadIds(n);
    if (!ids.length) { if (!opts.quiet) sound('deny'); return false; }
    setSelection(ids, opts);
    if (opts.center) centerOn(ids);
    return true;
  }
  function selectArmy() {
    const ids = unitsWhere((i, u) => !(u.flags[i] & UF().REGULAR));
    if (!ids.length) { sound('deny'); return; }
    setSelection(ids);
  }
  function centerOn(ids) {
    const s = S(); if (!s || !ids.length) return;
    let x = 0, z = 0, n = 0;
    for (const id of ids) { const i = SQ.World.unitIndex(s, id); if (i >= 0) { x += s.units.x[i]; z += s.units.z[i]; n++; } }
    if (n && SQ.camera) SQ.camera.focus(x / n, z / n);
  }
  function centroid(ids) {
    const s = S(); let x = 0, z = 0, n = 0;
    for (const id of ids) { const i = SQ.World.unitIndex(s, id); if (i >= 0) { x += s.units.x[i]; z += s.units.z[i]; n++; } }
    return n ? { x: x / n, z: z / n, n } : null;
  }
  function pruneSelection() {
    const s = S(); if (!s) { if (I.selected.size) { I.selected.clear(); selectionChanged(true); } return; }
    let changed = false;
    for (const id of I.selected) if (alive(s, id) < 0) { I.selected.delete(id); changed = true; }
    if (changed) selectionChanged(true);
  }

  function squads() {
    const s = S(); if (!s) return [];
    const u = s.units, out = [];
    for (let k = 0; k <= 5; k++) out.push({ idx: k, ids: [], pips: { crowd: 0, talker: 0, heavy: 0 }, hp: 0, maxHp: 0, idle: true, x: 0, z: 0 });
    for (let i = 0; i < u.n; i++) {
      if (u.faction[i] !== s.player || (u.flags[i] & UF().OVERIT) || (u.flags[i] & UF().REGULAR)) continue;
      const q = out[u.squad[i]]; if (!q) continue;
      q.ids.push(u.id[i]); q.pips[SQ.C.CLASSES[u.cls[i]]]++;
      q.hp += u.hp[i]; q.maxHp += u.maxHp[i]; q.x += u.x[i]; q.z += u.z[i];
      if ((u.flags[i] & UF().MOVING) || (u.flags[i] & UF().COMBAT)) q.idle = false;
    }
    for (const q of out) { const n = q.ids.length; if (n) { q.x /= n; q.z /= n; q.hp = q.maxHp ? q.hp / q.maxHp : 0; } else q.idle = false; delete q.maxHp; }
    return out;
  }

  // ---------------------------------------------------------------- picking
  const _sp = {};
  function pick(cx, cy, opts) {
    opts = opts || {};
    const s = S();
    const g = ground(cx, cy);
    const res = { kind: 'ground', x: g ? g.x : 0, z: g ? g.z : 0, ok: !!g, cx, cy };
    if (!s || !SQ.render || !SQ.render.worldToScreen) return res;
    const touch = opts.touch !== undefined ? opts.touch : I.isTouch;
    const R = touch ? 24 : 16;
    // 1. units (nearest within R of body or glyph)
    const u = s.units;
    let best = -1, bd = Infinity;
    const scale = (SQ.units && SQ.units.SCALE) || 1.3;
    for (let i = 0; i < u.n; i++) {
      if (u.flags[i] & UF().OVERIT) continue;
      const id = u.id[i];
      const rp = SQ.units && SQ.units.renderPos ? SQ.units.renderPos(id) : null;
      const x = rp ? rp.x : u.x[i], z = rp ? rp.z : u.z[i], y = rp ? rp.y : 0;
      SQ.render.worldToScreen(x, y + 1.0 * scale, z, _sp);
      if (_sp.behind) continue;
      let d = Math.hypot(_sp.x - cx, _sp.y - cy);
      const ppm = SQ.render.pxPerMeter(x, y + 1, z);
      const body = Math.max(R, ppm * 1.1 * scale);
      SQ.render.worldToScreen(x, y + 2.95 * scale / 1.3, z, _sp);
      const dg = Math.hypot(_sp.x - cx, _sp.y - cy);
      if (dg < 18 && dg < d) d = dg * 0.8;
      if (d > body) continue;
      // prefer own units slightly when tapping into a melee; prefer enemies when we have a selection
      const own = u.faction[i] === s.player;
      const bias = I.selected.size ? (own ? 4 : 0) : (own ? 0 : 4);
      if (d + bias < bd) { bd = d + bias; best = i; }
    }
    if (best >= 0) {
      return Object.assign(res, { kind: 'unit', i: best, id: u.id[best], own: u.faction[best] === s.player, faction: u.faction[best], cls: u.cls[best], neutral: !!(u.flags[best] & UF().NEUTRAL) });
    }
    // 2. squirrels  3. dosa cart
    for (const nt of s.neutrals || []) {
      if (nt.dead) continue;
      if (nt.kind === 'squirrel') {
        SQ.render.worldToScreen(nt.x, 0.4, nt.z, _sp);
        if (!_sp.behind && Math.hypot(_sp.x - cx, _sp.y - cy) < (touch ? 34 : 24)) return Object.assign(res, { kind: 'squirrel', id: nt.id, x: nt.x, z: nt.z });
      }
    }
    for (const nt of s.neutrals || []) {
      if (nt.kind !== 'dosa' || !g) continue;
      if (Math.hypot(g.x - nt.x, g.z - nt.z) < 3.2) return Object.assign(res, { kind: 'dosa', id: nt.id });
    }
    if (!g) return res;
    // 4. landmark disc (or its label)
    let lmBest = -1, lmD = Infinity;
    for (const lm of s.landmarks) {
      let inside;
      if (lm.poly) inside = SQ.util.pointInPoly(g.x, g.z, lm.poly) || Math.hypot(g.x - lm.x, g.z - lm.z) < 4;
      else inside = Math.hypot(g.x - lm.x, g.z - lm.z) <= lm.r + (touch ? 2 : 0.5);
      SQ.render.worldToScreen(lm.x, 3, lm.z, _sp);
      const dl = Math.hypot(_sp.x - cx, _sp.y - (cy + 16));
      if (!inside && dl > (touch ? 44 : 30)) continue;
      const d = inside ? Math.hypot(g.x - lm.x, g.z - lm.z) / Math.max(1, lm.r) : 2 + dl;
      if (d < lmD) { lmD = d; lmBest = lm.idx; }
    }
    // 5. build pad (inside landmark rings; checked first so pads under a ring are reachable)
    for (const lm of s.landmarks) {
      for (let k = 0; k < lm.pads.length; k++) {
        const p = lm.pads[k];
        if (Math.hypot(g.x - p.x, g.z - p.z) < 1.5) return Object.assign(res, { kind: 'pad', lm: lm.idx, lmId: lm.id, pad: k });
      }
    }
    if (lmBest >= 0) { const lm = s.landmarks[lmBest]; return Object.assign(res, { kind: 'landmark', lm: lmBest, lmId: lm.id }); }
    return res;
  }

  // Snap a screen point to a landmark within 40 px (chip drags / ghost paths).
  function snapTarget(cx, cy) {
    const p = pick(cx, cy, { touch: true });
    if (p.kind === 'landmark' || p.kind === 'pad') return { lm: p.lm, lmId: p.lmId, x: S().landmarks[p.lm].x, z: S().landmarks[p.lm].z };
    if (p.kind === 'unit' && !p.own) return { targetId: p.id, x: p.x, z: p.z };
    const s = S();
    let best = null, bd = 40;
    for (const lm of s.landmarks) {
      SQ.render.worldToScreen(lm.x, 0, lm.z, _sp);
      const d = Math.hypot(_sp.x - cx, _sp.y - cy);
      if (d < bd) { bd = d; best = lm; }
    }
    if (best) return { lm: best.idx, lmId: best.id, x: best.x, z: best.z };
    return p.ok ? { x: p.x, z: p.z } : null;
  }

  // ---------------------------------------------------------------- orders
  function snapshot(ids) {
    const s = S(); const u = s.units; const snap = [];
    for (const id of ids) {
      const i = SQ.World.unitIndex(s, id); if (i < 0) continue;
      const o = u.order[i];
      snap.push({ id, o: o ? { type: o.type, x: o.x, z: o.z, lm: o.lm, targetId: o.targetId } : null });
    }
    return snap;
  }
  function issue(ids, o, opts) {
    const m = M(); if (!m || !ids.length) return false;
    opts = opts || {};
    const snap = snapshot(ids);
    const res = SQ.cmd.order(m, me(), ids, o);
    if (!res || !res.ok) { sound('deny'); emit('inputDenied', { reason: res && res.reason }); return false; }
    if (!opts.noUndo) armUndo(snap);
    if (!opts.silent) sound('send');
    emit('orderIssued', { type: o.type, n: res.n });
    ghostFor(ids, o);
    return true;
  }
  function ghostFor(ids, o) {
    if (!SQ.fx || !SQ.fx.showPath) return;
    const s = S(); const c = centroid(ids); if (!c) return;
    let tx, tz;
    if (o.type === 'take') { const lm = s.landmarks[typeof o.lm === 'number' ? o.lm : SQ.World.landmarkIndex(s, o.lm)]; if (!lm) return; tx = lm.x; tz = lm.z; }
    else if (o.type === 'attack') { const j = SQ.World.unitIndex(s, o.targetId); if (j < 0) return; tx = s.units.x[j]; tz = s.units.z[j]; }
    else if (o.x !== undefined) { tx = o.x; tz = o.z; } else return;
    let path = null;
    try { path = s.nav.astar(c.x, c.z, tx, tz); } catch (e) { path = null; }
    path = path && path.length ? [[c.x, c.z]].concat(path) : [[c.x, c.z], [tx, tz]]; // astar omits the start
    SQ.fx.showPath(path, o.type === 'take' ? 'take' : o.type === 'attack' ? 'attack' : 'move', 1.6);
  }
  function sendSelection(target, opts) {
    opts = opts || {};
    const ids = Array.from(I.selected);
    if (!ids.length || !target) return false;
    return sendIds(ids, target, opts);
  }
  function sendIds(ids, target, opts) {
    opts = opts || {};
    if (target.lm !== undefined || target.lmId !== undefined) return issue(ids, { type: 'take', lm: target.lmId !== undefined ? target.lmId : target.lm, queue: !!opts.queue }, opts);
    if (target.targetId !== undefined) return issue(ids, { type: 'attack', targetId: target.targetId, queue: !!opts.queue }, opts);
    return issue(ids, { type: opts.move ? 'move' : 'attackMove', x: target.x, z: target.z, queue: !!opts.queue }, opts);
  }
  function stop() { const ids = Array.from(I.selected); if (ids.length) issue(ids, { type: 'stop' }, { silent: false }); }
  function hold() { const ids = Array.from(I.selected); if (ids.length) issue(ids, { type: 'hold' }); }

  function rallyAll(lmId) {
    const s = S(); if (!s) return;
    const lm = s.lmById[lmId] || s.landmarks[lmId]; if (!lm) return;
    const q = squads();
    const ids = [];
    for (const sq of q) if (sq.ids.length && sq.idle) ids.push.apply(ids, sq.ids);
    if (!ids.length) { // nobody idle: send the Reserve, else the whole army
      const res = q[0].ids.length ? q[0].ids : unitsWhere((i, u) => !(u.flags[i] & UF().REGULAR));
      ids.push.apply(ids, res);
    }
    if (!ids.length) { sound('deny'); return; }
    if (issue(ids, { type: 'take', lm: lm.id })) {
      if (SQ.fx) SQ.fx.pop('EVERYONE TO ' + (lm.name || '').toUpperCase() + '!', lm.x, 5, lm.z, { color: '#ffd34d', life: 1.6 });
    }
  }
  function setRally(lmId) {
    const m = M(); if (!m) return false;
    const res = SQ.cmd.setRally(m, me(), lmId);
    if (!res.ok) { sound('deny'); emit('inputDenied', { reason: 'rally:' + res.reason }); if (SQ.fx) { const lm = S().lmById[lmId]; if (lm) SQ.fx.pop(res.reason === 'notAllowed' ? 'Too far from home to rally' : 'Can\'t rally there', lm.x, 4, lm.z, { color: '#ff6a5a' }); } return false; }
    sound('click');
    return true;
  }
  function recruit(cls) {
    const m = M(); if (!m) return false;
    const res = SQ.cmd.recruit(m, me(), cls);
    if (!res.ok) { sound('deny'); emit('inputDenied', { reason: 'recruit:' + res.reason }); return false; }
    sound('click');
    return true;
  }
  function buildMenu(lmId, pad) {
    const s = S(); if (!s) return;
    const lm = s.lmById[lmId] || s.landmarks[lmId]; if (!lm) return;
    I.cardLm = lm.idx;
    if (SQ.fx) SQ.fx.selectLandmark(lm.idx);
    if (hasHud('openBuild')) hud('openBuild', lm.id, pad);
    else if (hasHud('openLandmark')) hud('openLandmark', lm.id); // the landmark card carries the build pads
    emit('buildMenu', { lm: lm.id, pad });
  }
  function landmarkCard(lmIdx, cx, cy) {
    const s = S(); const lm = s.landmarks[lmIdx]; if (!lm) return;
    sound('open');
    I.cardLm = lmIdx;
    if (SQ.fx) SQ.fx.selectLandmark(lmIdx);
    emit('landmarkTap', { lm: lm.id, x: cx, y: cy }); // the HUD opens its landmark card on this
  }
  function shoo(id) {
    const m = M(); const res = SQ.cmd.shoo(m, me(), id);
    if (!res.ok) sound('deny'); else sound('coin');
  }
  function buyDosa() {
    const m = M(); const res = SQ.cmd.buyDosa(m, me());
    if (!res.ok) {
      sound('deny');
      const d = (S().neutrals || []).find((n) => n.kind === 'dosa');
      if (SQ.fx && d) SQ.fx.pop(res.reason === 'clout' ? 'Dosas cost 50' : res.reason === 'cooldown' ? 'Still digesting…' : 'Bring a crew within 20 m', d.x, 3.5, d.z, { color: '#ffb347' });
    }
  }

  // ---------------------------------------------------------------- undo
  function armUndo(snap) {
    I.undoStack = snap;
    I.undoUntil = I.time + 2;
    if (hasHud('showUndo')) hud('showUndo', snap.length, undo);
    else if (!hasHud('toast')) showToast(); // the HUD shows its own undo toast on 'ordered'
    emit('undoAvailable', { n: snap.length, until: I.undoUntil });
  }
  function undo() {
    const snap = I.undoStack; const m = M();
    if (!snap || !m || I.time > I.undoUntil + 0.25) return false;
    I.undoStack = null; hideToast();
    const groups = new Map();
    for (const e of snap) {
      const key = e.o ? JSON.stringify(e.o) : 'stop';
      if (!groups.has(key)) groups.set(key, { o: e.o, ids: [] });
      groups.get(key).ids.push(e.id);
    }
    groups.forEach((g) => {
      const o = g.o;
      let ord;
      if (!o) ord = { type: 'stop' };
      else if (o.type === 'take') ord = { type: 'take', lm: o.lm };
      else if (o.type === 'attack') ord = { type: 'attack', targetId: o.targetId };
      else if (o.type === 'move' || o.type === 'attackMove') ord = { type: o.type, x: o.x, z: o.z };
      else ord = { type: o.type === 'hold' ? 'hold' : 'stop' };
      const res = SQ.cmd.order(m, me(), g.ids, ord);
      if (!res.ok && ord.type !== 'stop') SQ.cmd.order(m, me(), g.ids, { type: 'stop' });
    });
    sound('close');
    if (SQ.fx) SQ.fx.clearPath();
    return true;
  }
  function showToast() {
    if (!I.layer) return;
    if (!I.toast) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = '↶ undo order';
      b.style.cssText = 'position:absolute;left:50%;bottom:calc(132px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);pointer-events:auto;' +
        'font:600 15px/1 var(--font, system-ui);color:#f4f1e8;background:rgba(18,24,21,0.86);border:1px solid rgba(255,255,255,0.25);' +
        'border-radius:22px;padding:12px 18px;min-height:44px;min-width:48px;cursor:pointer;transition:opacity .2s;opacity:0;z-index:2';
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
      b.addEventListener('click', (e) => { e.stopPropagation(); undo(); });
      I.layer.appendChild(b);
      I.toast = b;
    }
    I.toast.style.display = 'block';
    requestAnimationFrame(() => { if (I.toast) I.toast.style.opacity = '1'; });
  }
  function hideToast() { if (I.toast) { I.toast.style.opacity = '0'; I.toast.style.display = 'none'; } if (hasHud('hideUndo')) hud('hideUndo'); }

  // ---------------------------------------------------------------- Crew Call targeting
  function crewSpec() {
    const s = S(); const f = s.factions[s.player]; if (!f) return null;
    const fd = SQ.data.factions[f.key]; const cc = fd && fd.crewCall; if (!cc) return null;
    return { kind: cc.target, id: cc.id, r: cc.radius || 12, maxLen: cc.maxLen || 40, color: f.color, name: cc.name };
  }
  function beginCrewCall() {
    const s = S(); if (!s || s.player < 0) return false;
    const chk = SQ.Abilities.canCrewCall(s, s.player);
    if (!chk.ok) { sound('deny'); emit('inputDenied', { reason: 'crew:' + chk.reason }); return false; }
    const spec = crewSpec(); if (!spec || spec.kind === 'none') return false;
    I.crew = spec;
    sound('open');
    emit('crewMode', { on: true, kind: spec.kind, name: spec.name });
    if (SQ.fx && I.mouse.over && !I.isTouch) previewCrew(I.mouse.x, I.mouse.y);
    return true;
  }
  function cancelCrewCall() {
    if (!I.crew) return;
    I.crew = null;
    if (SQ.fx) SQ.fx.setTarget(null);
    emit('crewMode', { on: false });
    if (SQ.hud && SQ.hud.targeting && typeof SQ.hud.cancelCrewCall === 'function') try { SQ.hud.cancelCrewCall(true); } catch (e) { /* */ }
  }
  function previewCrew(cx, cy, from) {
    const c = I.crew; if (!c || !SQ.fx) return;
    const g = ground(cx, cy); if (!g) return;
    if (c.kind === 'point') SQ.fx.setTarget({ kind: 'circle', x: g.x, z: g.z, r: c.r, color: c.color });
    else if (c.kind === 'landmark') {
      const p = pick(cx, cy, { touch: true });
      const s = S();
      if (p.kind === 'landmark' || p.kind === 'pad') { const lm = s.landmarks[p.lm]; SQ.fx.setTarget({ kind: 'circle', x: lm.x, z: lm.z, r: lm.r, color: lm.owner === s.player ? c.color : '#ff6a5a' }); }
      else SQ.fx.setTarget(null);
    } else if (c.kind === 'line') {
      const a = from || lineStart(g);
      const l = clampLine(a.x, a.z, g.x, g.z, c.maxLen);
      SQ.fx.setTarget({ kind: 'line', x: l.x, z: l.z, x2: l.x2, z2: l.z2, color: c.color });
    }
  }
  function lineStart(g) {
    // tap (no swipe): run from the army's centre toward the tap
    const ids = I.selected.size ? Array.from(I.selected) : unitsWhere(() => true);
    const c = centroid(ids);
    if (!c) return { x: g.x - 20, z: g.z };
    const dx = g.x - c.x, dz = g.z - c.z, L = Math.hypot(dx, dz) || 1;
    return L > 40 ? { x: g.x - dx / L * 40, z: g.z - dz / L * 40 } : { x: c.x, z: c.z };
  }
  function clampLine(x, z, x2, z2, maxLen) {
    const dx = x2 - x, dz = z2 - z, L = Math.hypot(dx, dz);
    if (L < 4) return { x, z, x2: x + (L ? dx / L : 1) * 12, z2: z + (L ? dz / L : 0) * 12 };
    if (L > maxLen) return { x, z, x2: x + dx / L * maxLen, z2: z + dz / L * maxLen };
    return { x, z, x2, z2 };
  }
  function fireCrew(cx, cy, from) {
    const c = I.crew; const m = M(); if (!c || !m) return;
    const g = ground(cx, cy); if (!g) return;
    let p;
    if (c.kind === 'point') p = { x: g.x, z: g.z };
    else if (c.kind === 'landmark') {
      // a held landmark under the pointer, else the sim snaps to the nearest held one close by
      const pk = pick(cx, cy, { touch: true });
      const st = S(); const lm = pk.kind === 'landmark' || pk.kind === 'pad' ? st.landmarks[pk.lm] : null;
      const mine = lm && (lm.isHome ? st.factions[me()] && st.factions[me()].home === lm.id : lm.owner === me());
      p = mine ? { landmarkId: lm.id, x: lm.x, z: lm.z } : { x: g.x, z: g.z };
    } else {
      const a = from || lineStart(g);
      const l = clampLine(a.x, a.z, g.x, g.z, c.maxLen);
      p = { x: l.x, z: l.z, x2: l.x2, z2: l.z2 };
    }
    const res = SQ.cmd.crewCall(m, me(), p);
    if (!res.ok) { sound('deny'); emit('inputDenied', { reason: 'crew:' + res.reason }); if (SQ.fx && res.reason) SQ.fx.pop(res.reason === 'notHeld' || res.reason === 'landmark' || res.reason === 'notOwned' || res.reason === 'target' ? 'Pick a landmark you hold' : 'Can\'t do that here', g.x, 3, g.z, { color: '#ff6a5a' }); return; }
    cancelCrewCall();
  }

  // ---------------------------------------------------------------- DOM overlays (radial, box, lasso)
  function ensureLayer() {
    if (I.layer) return;
    const app = document.getElementById('app') || document.body;
    const L = document.createElement('div');
    L.id = 'input-layer';
    L.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:12;overflow:hidden';
    app.appendChild(L);
    I.layer = L;
    const r = document.createElement('div');
    r.style.cssText = 'position:absolute;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;display:none;' +
      'box-shadow:0 0 0 2px rgba(0,0,0,.35);mask:radial-gradient(circle,transparent 21px,#000 22px);-webkit-mask:radial-gradient(circle,transparent 21px,#000 22px)';
    L.appendChild(r); I.radial = r;
    const b = document.createElement('div');
    b.style.cssText = 'position:absolute;display:none;border:1.5px solid rgba(255,255,255,.9);background:rgba(255,255,255,.12);border-radius:3px;box-shadow:0 0 0 1px rgba(0,0,0,.35)';
    L.appendChild(b); I.box = b;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
    svg.style.cssText = 'position:absolute;inset:0;display:none';
    const poly = document.createElementNS(svgNS, 'polyline');
    poly.setAttribute('fill', 'rgba(255,255,255,0.12)'); poly.setAttribute('stroke', 'white'); poly.setAttribute('stroke-width', '2');
    poly.setAttribute('stroke-dasharray', '6 5'); poly.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(poly); L.appendChild(svg);
    I.lasso = { svg, poly, pts: [] };
  }
  function radial(x, y, k, color) {
    const r = I.radial; if (!r) return;
    if (k === null) { r.style.display = 'none'; return; }
    r.style.display = 'block'; r.style.left = x + 'px'; r.style.top = y + 'px';
    const deg = Math.round(k * 360);
    r.style.background = 'conic-gradient(' + (color || '#ffd34d') + ' ' + deg + 'deg, rgba(255,255,255,0.25) ' + deg + 'deg)';
  }

  // ---------------------------------------------------------------- tap / click handling
  function onTap(cx, cy, opts) {
    opts = opts || {};
    const s = S(); if (!s) return;
    if (I.crew) { fireCrew(cx, cy); return; }
    const p = pick(cx, cy, { touch: opts.touch });
    const t = now();
    const dbl = t - I.lastTap.t < DBL_MS && Math.hypot(cx - I.lastTap.x, cy - I.lastTap.y) < 30;
    I.lastTap = { t, x: cx, y: cy, unit: p.kind === 'unit' ? p.id : -1 };
    const hasSel = I.selected.size > 0;
    const desktop = !opts.touch;
    switch (p.kind) {
      case 'unit':
        if (p.own) {
          const u = s.units;
          if (dbl && I.lastTap.unit === p.id) {
            if (desktop) { selectTypeOnScreen(p.i); } else setSelection([p.id]);
          } else if (opts.shift) {
            const ids = u.squad[p.i] >= 0 && !(u.flags[p.i] & UF().REGULAR) ? squadIds(u.squad[p.i]) : [p.id];
            const allIn = ids.every((id) => I.selected.has(id));
            if (allIn) { for (const id of ids) I.selected.delete(id); selectionChanged(); } else setSelection(ids, { add: true });
          } else if (I.selected.size && I.selected.has(p.id) && !desktop && I.userSel && sameSquadSelected(p.i)) {
            I.selected.clear(); selectionChanged(); // tap your selected squad again: deselect
          } else {
            const reg = (u.flags[p.i] & UF().REGULAR) || u.squad[p.i] < 0;
            setSelection(reg ? [p.id] : squadIds(u.squad[p.i]));
          }
        } else if (hasSel) {
          // an enemy standing in a landmark we don't hold: "take" it (they fight on arrival anyway,
          // and take paths through gates where a chase can stall at a fence)
          const lmIn = ringOfUnit(p.i);
          if (lmIn) sendSelection({ lmId: lmIn.id }, { queue: opts.shift });
          else sendSelection({ targetId: p.id }, { queue: opts.shift });
        } else inspect(p, cx, cy);
        break;
      case 'squirrel': shoo(p.id); break;
      case 'dosa': buyDosa(); break;
      case 'pad':
        if (hasSel && (opts.touch || opts.order || s.landmarks[p.lm].owner !== s.player)) sendSelection({ lmId: p.lmId }, { queue: opts.shift });
        else {
          const lm = s.landmarks[p.lm];
          if (lm.owner === s.player) buildMenu(p.lmId, p.pad); else landmarkCard(p.lm, cx, cy);
        }
        break;
      case 'landmark':
        if (hasSel) sendSelection({ lmId: p.lmId }, { queue: opts.shift });
        else landmarkCard(p.lm, cx, cy);
        break;
      default:
        if (!p.ok) return;
        if (hasSel && opts.touch) sendSelection({ x: p.x, z: p.z }, { queue: opts.shift });
        else if (hasSel) { I.selected.clear(); selectionChanged(); }
        if (SQ.fx) SQ.fx.selectLandmark(-1);
        if (SQ.hud && SQ.hud._cardId && hasHud('closeCard')) hud('closeCard');
    }
  }
  function ringOfUnit(i) {
    const s = S(); const u = s.units;
    for (const lm of s.landmarks) {
      if (lm.owner === s.player || lm.isHome) continue;
      const inside = lm.poly ? SQ.util.pointInPoly(u.x[i], u.z[i], lm.poly) : Math.hypot(u.x[i] - lm.x, u.z[i] - lm.z) <= lm.r + 1;
      if (inside) return lm;
    }
    return null;
  }
  function sameSquadSelected(i) {
    const s = S(); const sq = s.units.squad[i];
    const ids = squadIds(sq);
    return ids.length === I.selected.size && ids.every((id) => I.selected.has(id));
  }
  function selectTypeOnScreen(i) {
    const s = S(); const u = s.units; const type = u.type[i];
    const ids = unitsWhere((j, uu) => uu.type[j] === type && onScreen(j));
    setSelection(ids);
  }
  function onScreen(i) {
    const s = S(); const p = SQ.render.worldToScreen(s.units.x[i], 1, s.units.z[i], _sp);
    return p.onScreen;
  }
  function inspect(p, cx, cy) {
    const s = S();
    emit('inspect', { unit: p.id, x: cx, y: cy, cls: SQ.C.CLASSES[p.cls], faction: p.faction });
    if (hasHud('showUnit')) hud('showUnit', p.id, { x: cx, y: cy });
    // in-world hint: "Weak to: ■"
    if (SQ.fx && !p.neutral) {
      const weak = { 0: '■', 1: '●', 2: '▲' }[p.cls];
      const i = SQ.World.unitIndex(s, p.id);
      if (i >= 0) SQ.fx.pop('Weak to: ' + weak, s.units.x[i], 4.2, s.units.z[i], { color: '#ffffff', life: 1.6, rise: 0.6 });
    }
  }
  function contextOrder(cx, cy, shift) {
    const s = S(); if (!s) return;
    if (I.crew) { cancelCrewCall(); return; }
    if (!I.selected.size) {
      // nothing selected: right-click a landmark opens its card (handy for mouse-only play)
      const p = pick(cx, cy, { touch: false });
      if (p.kind === 'landmark') landmarkCard(p.lm, cx, cy);
      else if (p.kind === 'pad' && s.landmarks[p.lm].owner === s.player) buildMenu(p.lmId, p.pad);
      return;
    }
    const p = pick(cx, cy, { touch: false });
    if (p.kind === 'unit' && !p.own) { const lmIn = ringOfUnit(p.i); sendSelection(lmIn ? { lmId: lmIn.id } : { targetId: p.id }, { queue: shift }); }
    else if (p.kind === 'unit' && p.own) sendSelection({ x: s.units.x[p.i], z: s.units.z[p.i] }, { queue: shift, move: true });
    else if (p.kind === 'pad') {
      const lm = s.landmarks[p.lm];
      if (lm.owner === s.player) buildMenu(p.lmId, p.pad); else sendSelection({ lmId: p.lmId }, { queue: shift });
    } else if (p.kind === 'landmark') sendSelection({ lmId: p.lmId }, { queue: shift });
    else if (p.kind === 'squirrel') shoo(p.id);
    else if (p.kind === 'dosa') buyDosa();
    else if (p.ok) sendSelection({ x: p.x, z: p.z }, { queue: shift });
  }

  function selectInRect(x0, y0, x1, y1, add) {
    const s = S(); if (!s) return;
    const a = Math.min(x0, x1), b = Math.max(x0, x1), c = Math.min(y0, y1), d = Math.max(y0, y1);
    const ids = unitsWhere((i, u) => {
      const rp = SQ.units && SQ.units.renderPos(u.id[i]);
      SQ.render.worldToScreen(rp ? rp.x : u.x[i], 1.2, rp ? rp.z : u.z[i], _sp);
      return !_sp.behind && _sp.x >= a && _sp.x <= b && _sp.y >= c && _sp.y <= d;
    });
    // prefer army over landmark regulars when both are boxed
    const army = ids.filter((id) => { const i = SQ.World.unitIndex(s, id); return !(s.units.flags[i] & UF().REGULAR); });
    setSelection(army.length ? army : ids, { add });
  }
  function selectInLasso(pts, add) {
    if (pts.length < 3) return;
    const ids = unitsWhere((i, u) => {
      const rp = SQ.units && SQ.units.renderPos(u.id[i]);
      SQ.render.worldToScreen(rp ? rp.x : u.x[i], 1.2, rp ? rp.z : u.z[i], _sp);
      return !_sp.behind && SQ.util.pointInPoly(_sp.x, _sp.y, pts);
    });
    const s = S();
    const army = ids.filter((id) => { const i = SQ.World.unitIndex(s, id); return !(s.units.flags[i] & UF().REGULAR); });
    if (ids.length) setSelection(army.length ? army : ids, { add });
  }

  // ---------------------------------------------------------------- pointer events
  function onDown(e) {
    if (!I.match && !(SQ.camera)) return;
    I.isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
    try { I.view.setPointerCapture(e.pointerId); } catch (er) { /* */ }
    if (I.view.focus) try { I.view.querySelector('canvas') && I.view.querySelector('canvas').focus({ preventScroll: true }); } catch (er) { /* */ }
    const p = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t0: I.time, button: e.button, type: e.pointerType, shift: e.shiftKey, moved: false };
    I.pointers.set(e.pointerId, p);
    if (SQ.camera && SQ.camera.inIntro) { SQ.camera.skipIntro(); }
    if (I.pointers.size === 2 && I.isTouch) { startPinch(); return; }
    if (I.pointers.size > 2) return;
    if (!I.match) { I.gesture = { kind: 'pan', p }; return; }
    if (e.pointerType === 'mouse') {
      if (e.button === 1) { I.gesture = { kind: 'orbit', p }; e.preventDefault(); return; }
      if (e.button === 2) { const pk = pick(e.clientX, e.clientY, { touch: false }); I.gesture = { kind: 'right', p, pick: pk }; return; }
      if (I.crew) { const g = ground(e.clientX, e.clientY); I.gesture = { kind: 'crew', p, from: g }; return; }
      I.gesture = { kind: 'left', p };
      return;
    }
    // touch
    if (I.crew) { const g = ground(e.clientX, e.clientY); I.gesture = { kind: 'crew', p, from: g }; return; }
    const pk = pick(e.clientX, e.clientY, { touch: true });
    I.gesture = { kind: 'touch', p, pick: pk, lp: pk.kind === 'landmark' ? LP_LANDMARK : (pk.kind === 'ground' ? LP_GROUND : (pk.kind === 'unit' && !pk.own ? 0.45 : 0)) };
  }

  function onMove(e) {
    I.mouse.x = e.clientX; I.mouse.y = e.clientY; I.mouse.over = true;
    if (e.pointerType === 'mouse') I.isTouch = false;
    const p = I.pointers.get(e.pointerId);
    if (!p) { I.hoverDirty = true; if (I.crew && e.pointerType === 'mouse') previewCrew(e.clientX, e.clientY); return; }
    const px = p.x, py = p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (!p.moved && Math.hypot(p.x - p.sx, p.y - p.sy) > (p.type === 'mouse' ? 6 : TAP_MOVE)) p.moved = true;
    const G = I.gesture;
    if (!G) return;
    if (G.kind === 'pinch') { movePinch(); return; }
    if (G.kind === 'pan') { SQ.camera.panScreen(px, py, p.x, p.y); return; }
    if (G.kind === 'orbit') { SQ.camera.rotateNow((p.x - px) * 0.006); SQ.camera.tiltBy((py - p.y) * 0.004); return; }
    if (G.kind === 'crew') { if (p.moved || I.crew.kind !== 'line') previewCrew(p.x, p.y, I.crew.kind === 'line' && G.from ? G.from : null); return; }
    if (G.kind === 'right') { if (p.moved) { G.kind = 'pan'; radial(0, 0, null); SQ.camera.panScreen(p.sx, p.sy, p.x, p.y); } return; }
    if (G.kind === 'left') {
      if (p.moved) { G.kind = 'box'; I.box.style.display = 'block'; }
      else return;
    }
    if (G.kind === 'box') {
      const a = Math.min(p.sx, p.x), b = Math.min(p.sy, p.y);
      Object.assign(I.box.style, { left: a + 'px', top: b + 'px', width: Math.abs(p.x - p.sx) + 'px', height: Math.abs(p.y - p.sy) + 'px' });
      return;
    }
    if (G.kind === 'touch') {
      if (!p.moved) return;
      radial(0, 0, null);
      // held ≥ 0.3 s and then dragged: lasso, even when it started inside a landmark ring
      if (!G.fired && I.time - p.t0 >= LP_GROUND && (G.pick.kind === 'landmark' || G.pick.kind === 'pad' || G.pick.kind === 'ground')) {
        G.kind = 'lasso'; G.fired = true;
        I.lasso.pts = [[p.sx, p.sy], [p.x, p.y]]; I.lasso.svg.style.display = 'block';
        I.lasso.poly.setAttribute('points', I.lasso.pts.map((q) => q.join(',')).join(' '));
        return;
      }
      G.kind = 'pan'; SQ.camera.panScreen(p.sx, p.sy, p.x, p.y);
      return;
    }
    if (G.kind === 'lasso') {
      const L = I.lasso; const last = L.pts[L.pts.length - 1];
      if (!last || Math.hypot(last[0] - p.x, last[1] - p.y) > 6) { L.pts.push([p.x, p.y]); L.poly.setAttribute('points', L.pts.map((q) => q.join(',')).join(' ')); }
    }
  }

  function onUp(e) {
    const p = I.pointers.get(e.pointerId);
    I.pointers.delete(e.pointerId);
    try { I.view.releasePointerCapture(e.pointerId); } catch (er) { /* */ }
    const G = I.gesture;
    if (!p || !G) { if (!I.pointers.size) I.gesture = null; return; }
    if (G.kind === 'pinch') {
      if (I.pointers.size < 2) { if (SQ.camera) SQ.camera.snapHeading(); I.gesture = I.pointers.size === 1 ? { kind: 'pan', p: I.pointers.values().next().value } : null; }
      return;
    }
    I.gesture = null;
    radial(0, 0, null);
    if (e.type === 'pointercancel') { I.box.style.display = 'none'; I.lasso.svg.style.display = 'none'; return; }
    const quick = !p.moved;
    switch (G.kind) {
      case 'left':
        if (quick) onTap(e.clientX, e.clientY, { touch: false, shift: e.shiftKey });
        break;
      case 'box':
        I.box.style.display = 'none';
        selectInRect(p.sx, p.sy, e.clientX, e.clientY, e.shiftKey);
        break;
      case 'right':
        if (quick && !G.fired) contextOrder(e.clientX, e.clientY, e.shiftKey);
        break;
      case 'crew':
        fireCrew(e.clientX, e.clientY, p.moved && I.crew && I.crew.kind === 'line' ? G.from : null);
        break;
      case 'touch':
        if (quick && !G.fired) onTap(e.clientX, e.clientY, { touch: true });
        break;
      case 'lasso':
        I.lasso.svg.style.display = 'none';
        // a slow tap (held past the lasso delay without moving) is still a tap: send/select
        if (!p.moved && I.lasso.pts.length < 3) { I.lasso.pts = []; onTap(e.clientX, e.clientY, { touch: true }); break; }
        selectInLasso(I.lasso.pts, false);
        I.lasso.pts = [];
        break;
      default: break;
    }
  }

  function startPinch() {
    const ps = Array.from(I.pointers.values()).slice(0, 2);
    radial(0, 0, null);
    if (I.lasso) I.lasso.svg.style.display = 'none';
    I.gesture = { kind: 'pinch', d: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), a: Math.atan2(ps[1].y - ps[0].y, ps[1].x - ps[0].x), mx: (ps[0].x + ps[1].x) / 2, my: (ps[0].y + ps[1].y) / 2 };
    for (const q of ps) q.moved = true;
  }
  function movePinch() {
    const G = I.gesture; const ps = Array.from(I.pointers.values()).slice(0, 2);
    if (ps.length < 2) return;
    const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
    const a = Math.atan2(ps[1].y - ps[0].y, ps[1].x - ps[0].x);
    const mx = (ps[0].x + ps[1].x) / 2, my = (ps[0].y + ps[1].y) / 2;
    if (G.d > 10 && d > 10) SQ.camera.zoomBy(G.d / d, mx, my);
    let da = a - G.a; if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) < 0.5) SQ.camera.rotateNow(-da);
    SQ.camera.panScreen(G.mx, G.my, mx, my);
    G.d = d; G.a = a; G.mx = mx; G.my = my;
  }

  // long-press timers run in update()
  function longPress() {
    const G = I.gesture; if (!G) return;
    const p = G.p; if (!p || p.moved || G.fired) return;
    const held = I.time - p.t0;
    if (G.kind === 'touch' && G.lp > 0) {
      const pk = G.pick;
      if (pk.kind === 'landmark') {
        if (held > 0.12) radial(p.x, p.y, Math.min(1, held / G.lp), '#ffd34d');
        if (held >= G.lp) { G.fired = true; radial(0, 0, null); rallyAll(pk.lmId); if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) { /* */ } }
      } else if (pk.kind === 'ground' && held >= G.lp) {
        G.fired = true; G.kind = 'lasso';
        I.lasso.pts = [[p.x, p.y]]; I.lasso.svg.style.display = 'block';
        I.lasso.poly.setAttribute('points', p.x + ',' + p.y);
        if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) { /* */ }
      } else if (pk.kind === 'unit' && !pk.own && held >= G.lp) {
        G.fired = true; inspect(pk, p.x, p.y);
      }
    } else if (G.kind === 'right' && G.pick && G.pick.kind === 'landmark') {
      if (held > 0.12) radial(p.x, p.y, Math.min(1, held / LP_RIGHT), '#ffd34d');
      if (held >= LP_RIGHT) { G.fired = true; radial(0, 0, null); rallyAll(G.pick.lmId); }
    }
  }

  function onWheel(e) {
    e.preventDefault();
    if (!SQ.camera) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    if (e.ctrlKey) SQ.camera.zoomBy(Math.exp(dy * 0.01), e.clientX, e.clientY); // trackpad pinch
    else SQ.camera.zoomBy(Math.exp(dy * 0.0012), e.clientX, e.clientY);
  }

  // ---------------------------------------------------------------- keyboard
  function onKey(e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    const s = S();
    if (!s || !I.match) return;
    if (menuOpen() && e.code !== 'Escape') return;
    const code = e.code, ctrl = e.ctrlKey || e.metaKey;
    const digit = /^Digit([0-5])$/.exec(code) || /^Numpad([0-5])$/.exec(code);
    if (digit) {
      const n = +digit[1];
      e.preventDefault();
      if (ctrl || e.altKey) { assignSquad(n); return; }
      const twice = I.keyTwice.n === n && I.time - I.keyTwice.t < 0.4;
      I.keyTwice = { n, t: I.time };
      selectSquad(n, { add: e.shiftKey, center: twice });
      return;
    }
    if (ctrl && code === 'KeyZ') { e.preventDefault(); undo(); return; }
    if (ctrl || e.altKey) return;
    switch (code) {
      case 'Backquote': e.preventDefault(); selectArmy(); break;
      case 'KeyZ': recruit('crowd'); break;
      case 'KeyX': recruit('talker'); break;
      case 'KeyC': recruit('heavy'); break;
      case 'KeyF': toggleCrewCall(); break;
      case 'KeyB': { const lm = hoverLm(); if (lm) { const own = lm.owner === s.player; if (own) buildMenu(lm.id); else { sound('deny'); if (SQ.fx) SQ.fx.pop('Hold it to build here', lm.x, 4, lm.z, { color: '#ff6a5a' }); } } break; }
      case 'KeyR': { const lm = hoverLm(); if (lm) setRally(lm.id); break; }
      case 'KeyS': if (I.selected.size) stop(); break;
      case 'KeyH': if (I.selected.size) hold(); break;
      case 'KeyQ': SQ.camera.rotateBy(-Math.PI / 4); SQ.camera.snapHeading(); break;
      case 'KeyE': SQ.camera.rotateBy(Math.PI / 4); SQ.camera.snapHeading(); break;
      case 'KeyU': undo(); break;
      case 'Space': e.preventDefault(); jumpAlert(); break;
      case 'Tab': e.preventDefault(); cycleLandmarks(e.shiftKey ? -1 : 1); break;
      case 'KeyP': SQ.game && SQ.game.pause(); break;
      case 'Escape':
        if (I.crew) { cancelCrewCall(); break; }
        if (SQ.hud && SQ.hud._cardId && hasHud('closeCard')) { hud('closeCard'); if (SQ.fx) SQ.fx.selectLandmark(-1); break; }
        if (I.selected.size) { I.selected.clear(); selectionChanged(); break; }
        if (hasHud('openPauseMenu')) { if (SQ.hud.pauseMenuOpen && SQ.hud.pauseMenuOpen()) hud('closePauseMenu'); else hud('openPauseMenu'); }
        else if (SQ.game) SQ.game.pause();
        break;
      default: break;
    }
  }
  function hoverLm() {
    const s = S();
    if (I.hover.lm >= 0) return s.landmarks[I.hover.lm];
    const sel = s.landmarks.find((l) => l.idx === (I.cardLm !== undefined ? I.cardLm : -1));
    return sel || null;
  }
  function assignSquad(n) {
    const ids = Array.from(I.selected);
    if (!ids.length) { sound('deny'); return; }
    const res = SQ.cmd.squad(I.match, me(), ids, n);
    if (res.ok) { sound('click'); emit('selection', { ids, squads: [n] }); } else sound('deny');
  }
  function toggleCrewCall() {
    if (I.crew) cancelCrewCall();
    else if (hasHud('beginCrewCall')) hud('beginCrewCall'); // HUD shows its aiming state, then calls beginCrewCall()
    else beginCrewCall();
  }
  function jumpAlert() {
    const a = I.alerts[I.alerts.length - 1];
    if (!a) { const s = S(); const f = s.factions[s.player]; const h = f && s.lmById[f.home]; if (h) SQ.camera.focus(h.x, h.z); return; }
    SQ.camera.focus(a.x, a.z);
    I.alerts.pop();
  }
  function cycleLandmarks(dir) {
    const s = S();
    const mine = s.landmarks.filter((l) => l.owner === s.player);
    if (!mine.length) return;
    I.tabIdx = ((I.tabIdx + dir) % mine.length + mine.length) % mine.length;
    const lm = mine[I.tabIdx];
    SQ.camera.focus(lm.x, lm.z);
    if (SQ.fx) SQ.fx.selectLandmark(lm.idx);
  }

  // ---------------------------------------------------------------- chip drags (HUD)
  function chipDrag(squadIdx, cx, cy, phase) {
    if (!I.match) return null;
    const ids = squadIds(squadIdx);
    if (phase === 'cancel' || !ids.length) { if (SQ.fx) { SQ.fx.clearPath(); SQ.fx.hoverLandmark(-1); } I.dragging = false; return null; }
    const tgt = snapTarget(cx, cy);
    I.dragging = phase === 'move';
    if (phase === 'move') {
      if (tgt && SQ.fx) {
        const c = centroid(ids);
        let path = null;
        try { path = c ? S().nav.astar(c.x, c.z, tgt.x, tgt.z) : null; } catch (e) { path = null; }
        if (c) path = path && path.length ? [[c.x, c.z]].concat(path) : [[c.x, c.z], [tgt.x, tgt.z]];
        if (path) SQ.fx.showPath(path, tgt.lm !== undefined ? 'take' : tgt.targetId !== undefined ? 'attack' : 'move', -1);
        SQ.fx.hoverLandmark(tgt.lm !== undefined ? tgt.lm : -1);
      }
      return tgt;
    }
    // end: send
    if (SQ.fx) SQ.fx.hoverLandmark(-1);
    if (!tgt) { if (SQ.fx) SQ.fx.clearPath(); return null; }
    setSelection(ids, { silent: true });
    sendIds(ids, tgt.lm !== undefined ? { lmId: tgt.lmId } : tgt, { silent: true }); // the HUD plays the send sound
    return tgt;
  }

  // ---------------------------------------------------------------- hover
  function updateHover() {
    if (!I.hoverDirty || I.isTouch || !I.match || I.pointers.size) return;
    I.hoverDirty = false;
    const p = pick(I.mouse.x, I.mouse.y, { touch: false });
    const lm = p.kind === 'landmark' || p.kind === 'pad' ? p.lm : -1;
    const unit = p.kind === 'unit' ? p.id : -1;
    if (lm !== I.hover.lm && SQ.fx) SQ.fx.hoverLandmark(lm);
    if (unit !== I.hover.unit) {
      if (unit >= 0 && !p.own) emit('inspect', { unit, x: I.mouse.x, y: I.mouse.y, cls: SQ.C.CLASSES[p.cls], faction: p.faction, hover: true });
      else if (I.hover.unit >= 0) emit('inspect', { unit: null, hover: true });
    }
    I.hover.lm = lm; I.hover.unit = unit; I.hover.x = p.x; I.hover.z = p.z;
    const c = I.view && I.view.querySelector('canvas');
    if (c) c.style.cursor = I.crew ? 'crosshair' : unit >= 0 ? 'pointer' : lm >= 0 ? (I.selected.size ? 'alias' : 'pointer') : 'default';
  }

  // ---------------------------------------------------------------- lifecycle
  const input = {
    init(viewEl) {
      I.view = viewEl;
      ensureLayer();
      viewEl.addEventListener('pointerdown', onDown);
      viewEl.addEventListener('pointermove', onMove);
      viewEl.addEventListener('pointerup', onUp);
      viewEl.addEventListener('pointercancel', onUp);
      viewEl.addEventListener('pointerleave', () => { I.mouse.over = false; });
      viewEl.addEventListener('wheel', onWheel, { passive: false });
      viewEl.addEventListener('contextmenu', (e) => e.preventDefault());
      viewEl.addEventListener('dblclick', (e) => e.preventDefault());
      window.addEventListener('keydown', onKey);
      // Safari pinch gestures
      viewEl.addEventListener('gesturestart', (e) => e.preventDefault());
      viewEl.addEventListener('gesturechange', (e) => e.preventDefault());
    },
    setMatch(m) {
      for (const off of I.offs) off();
      I.offs = [];
      I.match = m || null;
      I.selected.clear(); I.lastSelKey = '';
      I.crew = null; I.undoStack = null; hideToast(); I.alerts = []; I.gesture = null; I.pointers.clear();
      if (I.box) I.box.style.display = 'none';
      if (I.lasso) I.lasso.svg.style.display = 'none';
      radial(0, 0, null);
      if (!m) return;
      const onB = (name, fn) => { m.bus.on(name, fn); I.offs.push(() => m.bus.off(name, fn)); };
      const pushAlert = (e) => { if (e.faction === m.state.player || e.faction === undefined) { I.alerts.push({ x: e.x, z: e.z, t: m.state.t, lm: e.lm }); if (I.alerts.length > 8) I.alerts.shift(); } };
      onB('underAttack', pushAlert);
      onB('contested', (e) => { if (e.faction === m.state.player) pushAlert(e); });
      onB('eventWarn', (e) => { if (e.x !== undefined) { I.alerts.push({ x: e.x, z: e.z, t: m.state.t, lm: e.lm }); if (I.alerts.length > 8) I.alerts.shift(); } });
      onB('crewCall', (e) => { if (e.faction === m.state.player && I.crew) cancelCrewCall(); });
      onB('victory', () => { cancelCrewCall(); I.selected.clear(); selectionChanged(true); });
      // start with the starting squad selected so the very first tap sends it
      const st = squadIds(1);
      if (st.length) setSelection(st, { silent: true, auto: true });
    },
    update(dt) {
      I.time += dt || 0;
      if (!I.match) return;
      pruneSelection();
      longPress();
      updateHover();
      if (I.undoStack && I.time > I.undoUntil) { I.undoStack = null; hideToast(); }
      if (I.crew) {
        const s = S();
        if (!SQ.Abilities.canCrewCall(s, s.player).ok) cancelCrewCall();
      }
    },
    get selected() { return I.selected; },
    get isTouch() { return I.isTouch; },
    get dragging() { return !!I.dragging || !!(I.gesture && (I.gesture.kind === 'box' || I.gesture.kind === 'lasso' || I.gesture.kind === 'pinch')); },
    get crewMode() { return I.crew; },
    get hover() { return I.hover; },
    get alerts() { return I.alerts; },
    getSelection() { return Array.from(I.selected); },
    hasSelection() { return I.selected.size > 0; },
    select(ids, opts) { setSelection(ids || [], opts); },
    clearSelection() { I.selected.clear(); selectionChanged(); },
    selectSquad, selectArmy, assignSquad,
    sendSelection, order(type, target) { const ids = Array.from(I.selected); return ids.length ? issue(ids, Object.assign({ type }, target || {})) : false; },
    stop, hold, recruit, rallyAll, setRally, buildMenu, undo,
    beginCrewCall, cancelCrewCall, toggleCrewCall,
    chipDrag, pick, squads,
    // test/automation helpers: simulate a tap or right-click at client coords
    tap(cx, cy, opts) { onTap(cx, cy, Object.assign({ touch: true }, opts || {})); },
    context(cx, cy, shift) { contextOrder(cx, cy, shift); },
  };
  SQ.input = input;
})(window.SQ = window.SQ || {});
