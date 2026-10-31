// ACCESSION — the interface around the board (BUILD.md §7.2): top bar, strip and log, label
// panel, quickslot containers, bottom bar, the confirmation sheet and overlays. It renders
// what it is given; sentences come from text.js and labels.js through main.js. On a phone
// the label is a bottom sheet; on a laptop the strip and log, the label and six quickslots
// stand in a right column. The Bag (js/ui/bag.js) fills the quickslot containers.
// Every input works alone (§7.1): each control is a button a tap, a click or the keyboard
// presses; a button with a key carries it (data-key, shown by CSS from data-hint); while a
// layer (a sheet or an overlay) is open everything else in #app is inert, and the focus goes
// into the layer and back out of it.
'use strict';
const UI = (() => {
  let els = {}, handlers = {}, shown = null, current = null, app = null;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const P = (id, px) => Pictograms.svg(id, px || 16);
  const EMPTY = '<p class="hint">Tap an exhibit, a case or yourself to read its label.</p>';

  // ---- Keys (BUILD.md §7.1) ----
  // A label button's key: one per verb, the same on every label and in the Bag, never a
  // vi-key (h j k l y u b n) or a digit. An item's own use is r when it reads, else q.
  const VERB_KEYS = { attack: 'a', open: 'o', close: 'c', bash: 'g', take: 't', unequip: 't', throw: 't', equip: 'e', drop: 'd',
    aim: 'a', restore: 'a', read: 'r', wait: '.', rest: 'z', sit: 's', leave: '>' };
  // The keys of a label's actions, in order: null where a verb has none, or where an earlier
  // button of the same label already has that key.
  function keysFor(actions) {
    const used = new Set();
    return (actions || []).map(a => {
      let k = a.id === 'use' ? (/^Read/.test(a.text) ? 'r' : 'q') : (Object.prototype.hasOwnProperty.call(VERB_KEYS, a.id) ? VERB_KEYS[a.id] : null);
      if (k && used.has(k)) k = null;
      if (k) used.add(k);
      return k;
    });
  }
  // A button's key: data-key, the key that presses it (a KeyboardEvent key); data-hint, what
  // the button shows of it (CSS draws it, so a button's text stays its own); aria-keyshortcuts.
  const SHOW = { Escape: 'Esc', Enter: 'Enter', Backspace: '⌫' };
  const keyAttrs = (k, hint) => k ? ` data-key="${esc(k)}"${hint === false ? '' : ` data-hint="${esc(hint || SHOW[k] || k)}"`} aria-keyshortcuts="${esc(k === ' ' ? 'Space' : k)}"` : '';
  // The keys, as "How the museum works" lists them.
  const KEY_TABLE = [
    ['Arrows, h j k l y u b n, or the numpad', 'Step; into an exhibit, attack it'],
    ['.', 'Wait'], ['z', 'Rest, until your health is back'], ['s', 'Sit on a bench'], ['>', 'Leave by the exit you stand on'],
    ['x, Shift+X', 'Select the next or previous thing in sight, nearest first: exhibits, cases, items, labels, staff doors, exits, you'],
    ['Enter', 'The selected thing\'s first action, as a second tap; walk to a selected exit; yes to a question'],
    ['a o c g t e d q r', 'The selected label\'s buttons, each showing its key: Attack or aim, Open, Close, Break the glass, Take (or Take off, Throw), Equip, Drop, Drink or Use, Read'],
    ['r', 'With no Read button: the nearest label'],
    ['Tab, Shift+Tab', 'Move between buttons; Enter or Space presses one; in the Bag and on a sheet the arrows do too'],
    ['i, m', 'The Bag, the floor plan'], ['1–6', 'Quickslots'],
    ['While aiming', 'Arrows or x move the mark; Enter does it there; Escape stops aiming'],
    ['+, −', 'Zoom'], ['?, ,', '"How the museum works", Settings'],
    ['Escape', 'Cancel; close; let go of the selection'],
  ];

  function build(root, h) {
    handlers = h;
    // The reserved colours have one source, art/palettes.json; CSS reads them from here.
    for (const [k, v] of Object.entries(ART.palettes.semantic)) document.documentElement.style.setProperty('--' + k, v);
    // A quickslot is a button the Bag fills (Bag.render); main.js routes its press, q<n>.
    const slot = n => `<button class="btn slot corner" data-act="q${n}" aria-label="Quickslot ${n}"${keyAttrs(String(n))}>Q${n}</button>`;
    app = root;
    app.innerHTML = `
      <div id="top">
        <div class="hp"><div class="barbg"><div class="barfg" id="hpbar"></div></div><div class="num" id="hpnum"></div></div>
        <div id="chips"><span id="stage" class="stage"></span><span id="statuses" class="statuses"></span></div>
        <canvas class="dial" id="dial" width="80" height="80" role="img"></canvas>
        <span class="badge" id="badge"></span>
        <button class="btn small" id="howbtn" aria-label="How the museum works"${keyAttrs('?', false)}>?</button>
        <button class="btn small" id="setbtn" aria-label="Settings"${keyAttrs(',', false)}>⚙</button>
      </div>
      <div id="board" aria-label="The board" tabindex="0"></div>
      <button class="btn zoom corner" id="zoombtn" data-act="zoom" aria-label="Zoom"${keyAttrs('+')}>Zoom</button>
      <div id="strip" role="button" tabindex="0" aria-label="Open the label"></div>
      <div id="sheet" aria-live="polite">${EMPTY}</div>
      <div id="slots" class="qslots">${[1, 2, 3, 4, 5, 6].map(slot).join('')}</div>
      <div id="bar">
        <button class="btn corner" data-act="wait"${keyAttrs('.')}>Wait</button>
        <button class="btn corner" data-act="bag"${keyAttrs('i')}>Bag</button>
        <div id="barslots" class="qslots">${[1, 2, 3].map(slot).join('')}</div>
        <button class="btn corner" data-act="map"${keyAttrs('m')}>Map</button>
      </div>
      <div id="confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-why"><div class="box">
        <h2 id="confirm-title"></h2><div class="why" id="confirm-why"></div>
        <div class="acts"><button class="btn yes" data-confirm="yes"${keyAttrs('Enter')}></button><button class="btn" data-confirm="no"${keyAttrs('Escape')}>Cancel</button></div>
      </div></div>
      <div class="overlay" id="end"></div>
      <div class="overlay" id="how"></div>
      <div class="overlay" id="settings"></div>`;
    for (const id of ['hpbar', 'hpnum', 'chips', 'stage', 'statuses', 'dial', 'badge', 'board', 'strip', 'bar', 'slots', 'barslots', 'sheet', 'confirm', 'end', 'how', 'settings', 'zoombtn']) els[id] = document.getElementById(id);
    const act = e => { const b = e.target.closest('[data-act]'); if (b) handlers.bar(b.dataset.act); };
    els.bar.addEventListener('click', act); els.slots.addEventListener('click', act); els.zoombtn.addEventListener('click', act);
    els.strip.addEventListener('click', () => handlers.openLabel());
    // The strip is a button for the keyboard too: Enter or Space opens the label.
    els.strip.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); handlers.openLabel(); } });
    document.getElementById('howbtn').onclick = () => { toggle('settings', false); toggle('how', true); };
    document.getElementById('setbtn').onclick = () => { toggle('how', false); toggle('settings', true); };
    // A label's button names its action by its place in the label shown, so two buttons with
    // one id (a Leave for each exit) stay apart.
    els.sheet.addEventListener('click', e => {
      const b = e.target.closest('[data-label-index]');
      if (b && current) { const a = current.actions[Number(b.dataset.labelIndex)]; if (a) handlers.labelAction(a, current.uid); }
      if (e.target.closest('[data-close]')) closeLabel();
    });
    // The confirmation: its buttons, or a tap beside its box, which cancels.
    els.confirm.addEventListener('click', e => {
      const b = e.target.closest('[data-confirm]');
      if (b) handlers.confirmed(b.dataset.confirm === 'yes');
      else if (!e.target.closest('.box')) handlers.confirmed(false);
    });
    els.end.addEventListener('click', e => {
      if (e.target.closest('[data-another]')) handlers.another();
      else if (e.target.closest('[data-close]')) toggle('end', false);
      else if (e.target.closest('[data-how]')) toggle('how', true);
    });
    for (const o of ['how', 'settings']) els[o].addEventListener('click', e => {
      if (e.target.closest('[data-close]')) toggle(o, false);
      if (e.target.closest('[data-how]')) { toggle(o, false); toggle('how', true); }
      const s = e.target.closest('[data-set]');
      if (s) handlers.setting(s.dataset.set, s.dataset.value);
    });
    renderHow();
    return els.board;
  }

  // An overlay's heading. Close is always on screen however long the overlay is, and every
  // overlay but "How the museum works" itself opens it in one tap.
  const head = (title, how) => `<div class="ohead"><h2>${esc(title)}</h2><span class="ohead-btns">${how ? `<button class="btn" data-how aria-label="How the museum works"${keyAttrs('?', false)}>?</button>` : ''}<button class="btn" data-close${keyAttrs('Escape')}>Close</button></span></div>`;

  // ---- Layers ----
  // What can lie over the board, topmost first: the confirmation, the Window Pole's sheet,
  // Settings, "How the museum works", the end of a visit, and the Bag or floor plan. While one
  // is open, everything else in #app is inert, so no tap, click, Tab or screen reader reaches
  // what lies behind it, and the keys go to it alone (main.js). sync() sets that after every
  // change (main.js calls it after each draw, for the Bag's). On a phone the open label is a
  // bottom sheet over the strip, Zoom and the bar, which are inert while it covers them, so
  // Tab never brings the focus to a control the sheet hides.
  const LAYERS = ['confirm', 'bagpick', 'settings', 'how', 'end', 'bag'];
  const isOpen = e => !!e && e.classList.contains('open');
  function topLayer() { for (const id of LAYERS) if (isOpen(document.getElementById(id))) return id; return null; }
  function sync() {
    if (!app) return;
    const top = topLayer(), el = top && document.getElementById(top);
    const cover = !top && shown && getComputedStyle(els.sheet).position === 'fixed' ? window.innerHeight - els.sheet.offsetHeight : Infinity;
    for (const c of app.children) {
      let v = !!el && c !== el;
      if (!v && cover < Infinity && (c === els.zoombtn || c === els.strip || c === els.bar)) { const r = c.getBoundingClientRect(); v = r.height > 0 && r.top >= cover - 2; }
      if (c.inert !== v) c.inert = v;
    }
  }
  // Can the focus go back to e: on the page, shown, and not behind a layer?
  const usable = e => !!e && e !== document.body && e.isConnected && typeof e.focus === 'function' && !e.closest('[inert]') && e.getClientRects().length > 0;
  // The control a layer gives the focus to when it opens: Settings its first chosen value,
  // "How the museum works" its Close, the end of a visit "Another visit".
  function primary(id) {
    const e = els[id] || document.getElementById(id);
    if (!e) return null;
    return e.querySelector('[data-another]') || (id === 'settings' && e.querySelector('[aria-pressed="true"]')) || e.querySelector('[data-close]') || e.querySelector('button');
  }
  // Where the focus goes when what had it is gone: into the topmost layer, or else the board.
  // Only once a key has been used (input.js marks the page), so a pointer's page never shows
  // a ring it did not ask for.
  function refocus() {
    if (!document.documentElement.classList.contains('keys')) return;
    const a = document.activeElement;
    if (a && a !== document.body && usable(a)) return;
    const top = topLayer();
    if (top === 'bag' || top === 'bagpick' || top === 'confirm') return; // each gives the focus itself
    const p = top ? primary(top) : els.board;
    if (p) p.focus({ preventScroll: true });
  }
  const focusBoard = () => { if (els.board && document.activeElement !== els.board) els.board.focus({ preventScroll: true }); };

  // An overlay opened takes the focus (remembering where it was); closed, it gives it back,
  // or, where that is gone, to what lies on top now.
  const back = {};
  function toggle(id, on) {
    const was = isOpen(els[id]);
    if (on && !was) back[id] = document.activeElement;
    els[id].classList.toggle('open', on);
    sync();
    if (on && !was) { const p = primary(id); if (p) p.focus({ preventScroll: true }); }
    if (!on && was) { const b = back[id]; back[id] = null; if (usable(b)) b.focus({ preventScroll: true }); else refocus(); }
  }
  function closeOverlays() { toggle('how', false); toggle('settings', false); toggle('end', false); }
  const overlayOpen = () => !!document.querySelector('.overlay.open');

  // The keys inside a layer: the arrows move the focus through its buttons (Home and End to
  // the first and last), and a key a button carries presses it. True when the key was used.
  // A layer with no buttons but its heading's ("How the museum works", the floor plan) leaves
  // the arrows to scroll it.
  const visible = b => b.getClientRects().length > 0 && !b.disabled && !b.closest('[inert]');
  function rove(el, by) {
    const all = [...el.querySelectorAll('button')].filter(visible);
    if (!all.some(b => !b.closest('.ohead'))) return false;
    const i = all.indexOf(document.activeElement);
    const j = by === 'first' ? 0 : by === 'last' ? all.length - 1 : i < 0 ? (by > 0 ? 0 : all.length - 1) : (i + by + all.length) % all.length;
    all[j].focus({ preventScroll: false });
    return true;
  }
  function pressKey(el, key) {
    if (!el || !key) return false;
    const b = [...el.querySelectorAll('button[data-key]')].find(q => q.dataset.key === key && visible(q));
    if (!b) return false;
    b.click();
    return true;
  }
  const ROVE = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1, Home: 'first', End: 'last' };
  function layerKey(id, e) {
    const el = els[id] || document.getElementById(id);
    if (!el) return false;
    if (Object.prototype.hasOwnProperty.call(ROVE, e.key)) return rove(el, ROVE[e.key]);
    if (e.key === '?' && id !== 'how' && id !== 'confirm') { toggle('settings', false); toggle('how', true); return true; }
    if (e.key === '?' && id === 'how') { toggle('how', false); return true; }
    if (e.key === ',' && (id === 'settings' || id === 'how')) { const on = id !== 'settings'; toggle('how', false); toggle('settings', on); return true; }
    return pressKey(el, e.key);
  }

  function renderHow() {
    els.how.innerHTML = head('How the museum works', false) + `<ul class="systems">` +
      Registry.SYSTEMS.map(s => `<li>${P(s.icon, 24)}<div><b>${esc(s.name)}.</b> ${esc(s.sentence)}</div></li>`).join('') + `</ul>` +
      `<h3 class="keys-title">Playing with the keys</h3><p class="note">Everything can be done with taps or clicks alone, or with the keyboard alone. The buttons show their keys.</p>` +
      `<table class="keytable"><tbody>${KEY_TABLE.map(([k, d]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(d)}</td></tr>`).join('')}</tbody></table>`;
  }

  // The Board line is built from the registered views and hidden when there is only one; the
  // Zoom line has one choice for each of the board's zoom steps (zooms), as the Zoom button
  // steps through them. Built again, it keeps the focus on the same choice.
  const ZOOM_NAMES = ['Normal', 'Closer', 'Closest'];
  function renderSettings(opts, views, zooms) {
    const choice = (key, value, text) => `<button class="btn" data-set="${key}" data-value="${value}" aria-pressed="${opts[key] === value}">${opts[key] === value ? '● ' : ''}${esc(text)}</button>`;
    const active = Views.active().id, had = els.settings.contains(document.activeElement) ? document.activeElement : null;
    const was = had && had.dataset.set ? `[data-set="${had.dataset.set}"][data-value="${had.dataset.value}"]` : null;
    const steps = Math.max(1, zooms || 1);
    els.settings.innerHTML = head('Settings', true) + `
      ${views.length > 1 ? `<div class="row" id="set-board"><b>Board</b> ${views.map(v => choice('board', v.id, v.label)).join(' ')}</div>` : ''}
      ${opts.boardNote && active !== opts.board ? `<p class="note">${esc(opts.boardNote)}</p>` : ''}
      ${steps > 1 ? `<div class="row" id="set-zoom"><b>Zoom</b> ${Array.from({ length: steps }, (_, i) => choice('zoom', String(i), ZOOM_NAMES[i] || String(i + 1))).join(' ')}</div>` : ''}
      <div class="row"><b>Walk</b> ${choice('walk', 'one', 'One tap')} ${choice('walk', 'two', 'Tap twice')}</div>
      <div class="row"><b>Text size</b> ${choice('text', '1', 'Normal')} ${choice('text', '1.15', 'Larger')} ${choice('text', '1.3', 'Largest')}</div>
      <div class="row"><b>Label font</b> ${choice('font', 'book', 'Book')} ${choice('font', 'plain', 'Plain')}</div>
      <div class="row"><b>Motion</b> ${choice('motion', 'full', 'Full')} ${choice('motion', 'reduce', 'Reduced')}</div>`;
    if (had) { const b = (was && els.settings.querySelector(was)) || primary('settings'); if (b) b.focus({ preventScroll: true }); }
  }

  // The top bar: health; the stage chip ("Open: bell in 238 turns"), from the clock's stage,
  // whose name gives way before what comes next when the row is short of room (the chip's
  // colour still tells the stage); your statuses, each its pictogram
  // (Registry.STATUSES[id].icon) and the turns it still covers, its words for screen readers
  // (your own label says them in full); the dial, labelled with Text.clock's sentence; the
  // badge with the grade's full name (§8.7). m = {hp, maxHp, grade, clock (vm.clock), dial
  // (its sentence), stage: {n, name, next} | null, statuses: [{icon, words, left}]}.
  function top(m) {
    const pct = m.maxHp ? Math.max(0, Math.round(100 * m.hp / m.maxHp)) : 0;
    els.hpbar.style.width = pct + '%';
    els.hpnum.innerHTML = `${P('heart', 12)}<span><span class="sr">Health </span>${m.hp} / ${m.maxHp}</span>`;
    els.badge.innerHTML = `<span class="badge-name">Handling Clearance<span class="sr">,</span></span><span class="badge-grade">Grade ${roman(m.grade)}</span>`;
    els.stage.className = 'stage' + (m.stage ? ' s' + m.stage.n : '');
    els.stage.innerHTML = m.stage ? `${P('clock', 12)}<span class="sname">${esc(m.stage.name)}</span> <span class="snext">${esc(m.stage.next)}</span>` : '';
    const sts = m.statuses || [];
    els.statuses.innerHTML = sts.map(s => `<span class="st" data-status="${esc(s.icon)}">${P(s.icon, 14)}<span aria-hidden="true">${s.left}</span><span class="sr">You are ${esc(s.words)}, ${s.left === 1 ? '1 turn' : s.left + ' turns'} left.</span></span>`).join('');
    els.chips.classList.toggle('has', !!m.stage || sts.length > 0);
    dial(m.clock, m.dial);
  }
  const roman = n => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][n] || String(n);

  // The clock face, read clockwise from the top: open hours as a thin ring, the bell's
  // stage as a thicker hazard band, the night watch as a solid hostile wedge, with a tick
  // at each boundary, so the stages differ in shape as well as colour (§7.2). The hand is
  // the clock's count (vm.clock.count); the label is Text.clock's sentence.
  function dial(c, sentence) {
    const x = els.dial.getContext('2d'), r = 36, S = ART.palettes.semantic;
    x.clearRect(0, 0, 80, 80);
    x.save(); x.translate(40, 40);
    x.fillStyle = '#2a2631'; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill();
    if (c && c.B) {
      const end = c.B + 2 * c.G, a = t => -Math.PI / 2 + Math.PI * 2 * Math.min(1, t / end);
      const band = (from, to, col, inner) => { x.fillStyle = col; x.beginPath(); x.arc(0, 0, r, a(from), a(to)); x.arc(0, 0, inner, a(to), a(from), true); x.closePath(); x.fill(); };
      band(0, c.B, '#6b6676', r - 6); band(c.B, c.B + c.G, S.hazard, r - 14); band(c.B + c.G, end, S.hostile, 0);
      x.strokeStyle = '#ece6d8'; x.lineWidth = 2;
      for (const t of [0, c.B, c.B + c.G]) { x.beginPath(); x.moveTo(Math.cos(a(t)) * (r - 18), Math.sin(a(t)) * (r - 18)); x.lineTo(Math.cos(a(t)) * r, Math.sin(a(t)) * r); x.stroke(); }
      x.strokeStyle = '#ffffff'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a(c.count)) * (r - 4), Math.sin(a(c.count)) * (r - 4)); x.stroke();
    }
    els.dial.setAttribute('aria-label', sentence || 'The clock');
    x.restore();
  }

  // The strip: the nearest readable thing and the log. On a phone it shows the newest
  // sentence until the next action, then the nearest label; on a laptop it shows both. A
  // stage's announcement (the bell, the night watch, a night-watch bell) is set off in the
  // log as a banner wherever it appears (§8.4, D4.10): banners lists those sentences.
  function strip(s, lines, fresh, banners) {
    els.strip.classList.toggle('fresh', !!fresh);
    els.strip.classList.toggle('has-summary', !!s);
    const summary = s ? `<div class="summary"><div class="strip-title">${s.stateIcons.map(i => P(i, 14)).join('')}<span>${esc(s.title)}</span></div>
      <div class="strip-sub">${s.pictos.map(p => P(p, 14)).join('')}${s.behaviour ? `<span class="behaviour">${esc(s.behaviour)}</span>` : ''}</div></div>` : '';
    els.strip.innerHTML = summary + `<div class="log">${(lines || []).map(l => `<div class="line">${withBanner(l, banners || [])}</div>`).join('')}</div>`;
    // The laptop's log scrolls inside its own box: keep the newest entry in view from its
    // first sentence, even when it is taller than the box.
    const log = els.strip.querySelector('.log'), last = log && log.lastElementChild;
    if (last) log.scrollTop = Math.min(log.scrollHeight - log.clientHeight, last.getBoundingClientRect().top - log.getBoundingClientRect().top + log.scrollTop);
  }
  // A log entry with any stage announcement in it set off as a banner; its text is the
  // entry's, unchanged.
  function withBanner(line, banners) {
    const b = banners.find(t => t && line.includes(t));
    if (!b) return esc(line);
    const i = line.indexOf(b);
    return esc(line.slice(0, i)) + `<span class="banner">${P('clock', 16)}${esc(b)}</span>` + esc(line.slice(i + b.length));
  }

  // The full label. Its state icons sit on a dark chip, as the pictograms do, so every
  // reserved colour stays legible on the cream panel. Each button is one of the label's
  // actions (Labels.*): main.js dispatches the one pressed.
  function label(l) {
    if (!l) { closeLabel(); return; }
    // A keyboard's focus on one of its buttons stays on the button of the same action.
    const had = els.sheet.contains(document.activeElement) ? document.activeElement : null;
    const keep = had && had.dataset.labelAct ? had.dataset.labelAct : had && had.matches('[data-close]') ? 'close' : null;
    const keys = keysFor(l.actions);
    shown = l.uid; current = l;
    const tomb = l.tomb ? [l.tomb.maker, l.tomb.date, l.tomb.medium, l.tomb.dims, l.tomb.credit, l.number].filter(Boolean).map(esc).join(' · ') : '';
    els.sheet.innerHTML = `<div class="label">
      ${l.closeup ? '<canvas class="closeup" width="64" height="64"></canvas>' : ''}
      <h2>${l.stateIcons.length ? `<span class="chip">${l.stateIcons.map(i => P(i, 18)).join('')}</span>` : ''}<span>${esc(l.title)}</span></h2>
      <div class="tomb">${tomb}</div>
      ${l.pictos.length ? `<div class="pictos">${l.pictos.map(p => `<span>${P(p.icon, 14)}${esc(p.text)}</span>`).join('')}</div>` : ''}
      ${l.behaviour ? `<div class="beh">${esc(l.behaviour)}</div>` : ''}
      ${l.odds && l.odds.length ? `<div class="odds">${l.odds.map(esc).join('<br>')}</div>` : ''}
      ${l.paragraph ? `<div class="para">${esc(l.paragraph)}</div>` : (l.far ? `<div class="para"><i>${esc(l.far)}</i></div>` : '')}
      <div class="acts">${(l.actions || []).map((a, i) => `<button class="btn" data-label-act="${esc(a.id)}" data-label-index="${i}"${keyAttrs(keys[i])}>${esc(a.text)}</button>`).join('')}<button class="btn" data-close>Close</button></div>
    </div>`;
    if (had) {
      const b = keep === 'close' ? els.sheet.querySelector('[data-close]') : keep && els.sheet.querySelector(`[data-label-act="${keep}"]`);
      if (b) b.focus({ preventScroll: true }); else focusBoard();
    }
    if (l.closeup) {
      const c = els.sheet.querySelector('.closeup'), img = Sprites.closeup(l.closeup.sprite, l.closeup.dept);
      if (img) { const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0); }
    }
    els.sheet.classList.add('open');
  }
  // Closing empties the panel too, so on a laptop, where it stays on screen, no label with
  // dead buttons is left behind.
  function closeLabel() {
    const was = shown, had = els.sheet.contains(document.activeElement);
    shown = null; current = null;
    els.sheet.classList.remove('open');
    els.sheet.innerHTML = EMPTY;
    if (had) focusBoard();
    if (was && handlers.closedLabel) handlers.closedLabel();
  }
  const labelShown = () => shown;

  // How much of the board the open label sheet covers, in CSS pixels (0 on a laptop).
  function sheetCover() {
    if (!shown || getComputedStyle(els.sheet).position !== 'fixed') return 0;
    const b = els.board.getBoundingClientRect();
    return Math.max(0, b.bottom - (window.innerHeight - els.sheet.offsetHeight));
  }

  // The confirmation sheet (§7.1): what the action would do, as sentences, with a 44-px
  // button that does it and one that cancels. c = {title, lines, yes}. The button that does
  // it takes the focus, so Enter confirms. While it asks, the rest of the page is inert: a tap
  // cannot reach it (the sheet covers it), nor can Tab or a screen reader, so nothing else is
  // done before it is answered (sync). Closing it gives the focus back where it was, if that
  // is still on the page, or else to what lies on top.
  let focusBack = null;
  function confirm(c) {
    els.confirm.querySelector('h2').textContent = c.title;
    els.confirm.querySelector('.why').innerHTML = c.lines.map(l => `<p>${esc(l)}</p>`).join('');
    const yes = els.confirm.querySelector('.yes');
    yes.textContent = c.yes;
    if (!confirmOpen()) focusBack = document.activeElement;
    els.confirm.classList.add('open');
    sync();
    yes.focus({ preventScroll: true });
  }
  function closeConfirm() {
    if (!confirmOpen()) return;
    const had = els.confirm.contains(document.activeElement), b = focusBack;
    focusBack = null;
    els.confirm.classList.remove('open');
    sync();
    if (usable(b)) b.focus({ preventScroll: true });
    else if (had) { document.activeElement.blur(); refocus(); }
  }
  const confirmOpen = () => els.confirm.classList.contains('open');

  // The end of a visit: the recap of a death, or the sentence of leaving, with "Another
  // visit", which takes the focus. A screen reader hears it as a dialog named by its title and
  // described by its sentences. e = {title, lines}.
  function end(e) {
    els.end.innerHTML = head(e.title, true) + `<div class="recap" id="end-why">${e.lines.map(l => `<p>${esc(l)}</p>`).join('')}</div>
      <div class="acts"><button class="btn another" data-another${keyAttrs('Enter')}>Another visit</button></div>`;
    els.end.querySelector('.ohead h2').id = 'end-title';
    for (const [k, v] of [['role', 'dialog'], ['aria-labelledby', 'end-title'], ['aria-describedby', 'end-why']]) els.end.setAttribute(k, v);
    toggle('end', true);
    els.end.querySelector('[data-another]').focus({ preventScroll: true });
  }
  const endOpen = () => els.end.classList.contains('open');

  // The containers the Bag fills: the phone bar's three quickslots and the laptop column's six.
  const slots = () => ({ bar: els.barslots, column: els.slots });

  return { build, top, strip, label, closeLabel, labelShown, sheetCover, closeOverlays, overlayOpen, renderSettings, toggle,
    confirm, closeConfirm, confirmOpen, end, endOpen, slots, keysFor, keyAttrs, sync, topLayer, layerKey, rove, pressKey, focusBoard, refocus };
})();
