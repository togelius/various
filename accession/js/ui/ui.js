// ACCESSION — the interface around the board (BUILD.md §7.2): top bar, strip and log, label
// panel, quickslots, bottom bar and overlays. It renders what it is given; sentences come
// from text.js. On a phone the label is a bottom sheet; on a laptop the strip and log, the
// label and six quickslots stand in a right column.
'use strict';
const UI = (() => {
  let els = {}, handlers = {}, shown = null;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const P = (id, px) => Pictograms.svg(id, px || 16);
  const EMPTY = '<p class="hint">Tap an exhibit to read its label.</p>';

  function build(app, h) {
    handlers = h;
    // The reserved colours have one source, art/palettes.json; CSS reads them from here.
    for (const [k, v] of Object.entries(ART.palettes.semantic)) document.documentElement.style.setProperty('--' + k, v);
    const slot = n => `<button class="btn slot" data-act="q${n}" aria-label="Quickslot ${n}">Q${n}</button>`;
    app.innerHTML = `
      <div id="top">
        <div class="hp"><div class="barbg"><div class="barfg" id="hpbar"></div></div><div class="num" id="hpnum"></div></div>
        <canvas class="dial" id="dial" width="80" height="80" role="img"></canvas>
        <span class="badge" id="badge"></span>
        <button class="btn small" id="howbtn" aria-label="How the museum works">?</button>
        <button class="btn small" id="setbtn" aria-label="Settings">⚙</button>
      </div>
      <div id="board" aria-label="The board"></div>
      <button class="btn zoom" id="zoombtn" data-act="zoom" aria-label="Zoom">Zoom</button>
      <div id="strip" role="button" aria-label="Open the label"></div>
      <div id="sheet" aria-live="polite">${EMPTY}</div>
      <div id="slots">${[1, 2, 3, 4, 5, 6].map(slot).join('')}</div>
      <div id="bar">
        <button class="btn" data-act="wait">Wait</button>
        <button class="btn" data-act="bag">Bag</button>
        ${[1, 2, 3].map(slot).join('')}
        <button class="btn" data-act="map">Map</button>
      </div>
      <div class="overlay" id="how"></div>
      <div class="overlay" id="settings"></div>`;
    for (const id of ['hpbar', 'hpnum', 'dial', 'badge', 'board', 'strip', 'bar', 'slots', 'sheet', 'how', 'settings', 'zoombtn']) els[id] = document.getElementById(id);
    const act = e => { const b = e.target.closest('[data-act]'); if (b) handlers.bar(b.dataset.act); };
    els.bar.addEventListener('click', act); els.slots.addEventListener('click', act); els.zoombtn.addEventListener('click', act);
    els.strip.addEventListener('click', () => handlers.openLabel());
    document.getElementById('howbtn').onclick = () => { toggle('settings', false); toggle('how', true); };
    document.getElementById('setbtn').onclick = () => { toggle('how', false); toggle('settings', true); };
    els.sheet.addEventListener('click', e => {
      const b = e.target.closest('[data-label-act]');
      if (b) handlers.labelAction(b.dataset.labelAct);
      if (e.target.closest('[data-close]')) closeLabel();
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
  const head = (title, how) => `<div class="ohead"><h2>${esc(title)}</h2><span class="ohead-btns">${how ? '<button class="btn" data-how aria-label="How the museum works">?</button>' : ''}<button class="btn" data-close>Close</button></span></div>`;

  function toggle(id, on) { els[id].classList.toggle('open', on); }
  function closeOverlays() { toggle('how', false); toggle('settings', false); }
  const overlayOpen = () => !!document.querySelector('.overlay.open');

  function renderHow() {
    els.how.innerHTML = head('How the museum works', false) + `<ul class="systems">` +
      Registry.SYSTEMS.map(s => `<li>${P(s.icon, 24)}<div><b>${esc(s.name)}.</b> ${esc(s.sentence)}</div></li>`).join('') + `</ul>`;
  }

  // The Board line is built from the registered views and hidden when there is only one.
  function renderSettings(opts, views) {
    const choice = (key, value, text) => `<button class="btn" data-set="${key}" data-value="${value}" aria-pressed="${opts[key] === value}">${opts[key] === value ? '● ' : ''}${esc(text)}</button>`;
    const active = Views.active().id;
    els.settings.innerHTML = head('Settings', true) + `
      ${views.length > 1 ? `<div class="row" id="set-board"><b>Board</b> ${views.map(v => choice('board', v.id, v.label)).join(' ')}</div>` : ''}
      ${opts.boardNote && active !== opts.board ? `<p class="note">${esc(opts.boardNote)}</p>` : ''}
      <div class="row"><b>Walk</b> ${choice('walk', 'one', 'One tap')} ${choice('walk', 'two', 'Tap twice')}</div>
      <div class="row"><b>Text size</b> ${choice('text', '1', 'Normal')} ${choice('text', '1.15', 'Larger')} ${choice('text', '1.3', 'Largest')}</div>
      <div class="row"><b>Label font</b> ${choice('font', 'book', 'Book')} ${choice('font', 'plain', 'Plain')}</div>
      <div class="row"><b>Motion</b> ${choice('motion', 'full', 'Full')} ${choice('motion', 'reduce', 'Reduced')}</div>`;
  }

  // The top bar. The badge prints the grade's full name (§8.7).
  function top(m) {
    const pct = m.maxHp ? Math.max(0, Math.round(100 * m.hp / m.maxHp)) : 0;
    els.hpbar.style.width = pct + '%';
    els.hpnum.innerHTML = `${P('heart', 12)}<span>${m.hp} / ${m.maxHp}</span>`;
    els.hpnum.setAttribute('aria-label', `Health ${m.hp} of ${m.maxHp}`);
    els.badge.innerHTML = `<span class="badge-name">Handling Clearance</span><span class="badge-grade">Grade ${roman(m.grade)}</span>`;
    dial(m.clock);
  }
  const roman = n => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][n] || String(n);

  // The clock face, read clockwise from the top: open hours as a thin ring, the bell's
  // stage as a thicker hazard band, the night watch as a solid hostile wedge, with a tick
  // at each boundary, so the stages differ in shape as well as colour (§7.2).
  function dial(c) {
    const x = els.dial.getContext('2d'), r = 36, S = ART.palettes.semantic;
    x.clearRect(0, 0, 80, 80);
    x.save(); x.translate(40, 40);
    x.fillStyle = '#2a2631'; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill();
    let label = 'The clock';
    if (c && c.B) {
      const end = c.B + 2 * c.G, a = t => -Math.PI / 2 + Math.PI * 2 * Math.min(1, t / end);
      const band = (from, to, col, inner) => { x.fillStyle = col; x.beginPath(); x.arc(0, 0, r, a(from), a(to)); x.arc(0, 0, inner, a(to), a(from), true); x.closePath(); x.fill(); };
      band(0, c.B, '#6b6676', r - 6); band(c.B, c.B + c.G, S.hazard, r - 14); band(c.B + c.G, end, S.hostile, 0);
      x.strokeStyle = '#ece6d8'; x.lineWidth = 2;
      for (const t of [0, c.B, c.B + c.G]) { x.beginPath(); x.moveTo(Math.cos(a(t)) * (r - 18), Math.sin(a(t)) * (r - 18)); x.lineTo(Math.cos(a(t)) * r, Math.sin(a(t)) * r); x.stroke(); }
      x.strokeStyle = '#ffffff'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a(c.turn)) * (r - 4), Math.sin(a(c.turn)) * (r - 4)); x.stroke();
      const stage = c.turn < c.B ? `open hours, the bell in ${c.B - c.turn} turns` : c.turn < c.B + c.G ? `after the bell, the night watch in ${c.B + c.G - c.turn} turns` : 'the night watch';
      label = `The clock: turn ${c.turn}, ${stage}`;
    }
    els.dial.setAttribute('aria-label', label);
    x.restore();
  }

  // The strip: the nearest readable thing and the log. On a phone it shows the newest
  // sentence until the next action, then the nearest label; on a laptop it shows both.
  function strip(s, lines, fresh) {
    els.strip.classList.toggle('fresh', !!fresh);
    els.strip.classList.toggle('has-summary', !!s);
    const summary = s ? `<div class="summary"><div class="strip-title">${s.stateIcons.map(i => P(i, 14)).join('')}<span>${esc(s.title)}</span></div>
      <div class="strip-sub">${s.pictos.map(p => P(p, 14)).join('')}${s.behaviour ? `<span class="behaviour">${esc(s.behaviour)}</span>` : ''}</div></div>` : '';
    els.strip.innerHTML = summary + `<div class="log">${(lines || []).map(l => `<div class="line">${esc(l)}</div>`).join('')}</div>`;
    // The laptop's log scrolls inside its own box: keep the newest entry in view from its
    // first sentence, even when it is taller than the box.
    const log = els.strip.querySelector('.log'), last = log && log.lastElementChild;
    if (last) log.scrollTop = Math.min(log.scrollHeight - log.clientHeight, last.getBoundingClientRect().top - log.getBoundingClientRect().top + log.scrollTop);
  }

  // The full label. Its state icons sit on a dark chip, as the pictograms do, so every
  // reserved colour stays legible on the cream panel.
  function label(l) {
    if (!l) { closeLabel(); return; }
    shown = l.uid;
    const tomb = l.tomb ? [l.tomb.maker, l.tomb.date, l.tomb.medium, l.tomb.dims, l.tomb.credit, l.number].filter(Boolean).map(esc).join(' · ') : '';
    els.sheet.innerHTML = `<div class="label">
      ${l.closeup ? '<canvas class="closeup" width="64" height="64"></canvas>' : ''}
      <h2>${l.stateIcons.length ? `<span class="chip">${l.stateIcons.map(i => P(i, 18)).join('')}</span>` : ''}<span>${esc(l.title)}</span></h2>
      <div class="tomb">${tomb}</div>
      ${l.pictos.length ? `<div class="pictos">${l.pictos.map(p => `<span>${P(p.icon, 14)}${esc(p.text)}</span>`).join('')}</div>` : ''}
      ${l.behaviour ? `<div class="beh">${esc(l.behaviour)}</div>` : ''}
      ${l.odds && l.odds.length ? `<div class="odds">${l.odds.map(esc).join('<br>')}</div>` : ''}
      ${l.paragraph ? `<div class="para">${esc(l.paragraph)}</div>` : (l.far ? `<div class="para"><i>${esc(l.far)}</i></div>` : '')}
      <div class="acts">${(l.actions || []).map(a => `<button class="btn" data-label-act="${esc(a.id)}">${esc(a.text)}</button>`).join('')}<button class="btn" data-close>Close</button></div>
    </div>`;
    if (l.closeup) {
      const c = els.sheet.querySelector('.closeup'), img = Sprites.closeup(l.closeup.sprite, l.closeup.dept);
      if (img) { const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0); }
    }
    els.sheet.classList.add('open');
  }
  // Closing empties the panel too, so on a laptop, where it stays on screen, no label with
  // dead buttons is left behind.
  function closeLabel() {
    const was = shown;
    shown = null;
    els.sheet.classList.remove('open');
    els.sheet.innerHTML = EMPTY;
    if (was && handlers.closedLabel) handlers.closedLabel();
  }
  const labelShown = () => shown;

  // How much of the board the open label sheet covers, in CSS pixels (0 on a laptop).
  function sheetCover() {
    if (!shown || getComputedStyle(els.sheet).position !== 'fixed') return 0;
    const b = els.board.getBoundingClientRect();
    return Math.max(0, b.bottom - (window.innerHeight - els.sheet.offsetHeight));
  }

  return { build, top, strip, label, closeLabel, labelShown, sheetCover, closeOverlays, overlayOpen, renderSettings, toggle };
})();
