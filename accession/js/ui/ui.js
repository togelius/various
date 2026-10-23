// ACCESSION — the interface around the board (BUILD.md §7.2): top bar, strip, label
// panel, bottom bar and overlays. It renders what it is given; sentences come from text.js.
'use strict';
const UI = (() => {
  let els = {}, handlers = {};
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const P = (id, px, colour) => Pictograms.svg(id, px || 16, colour);

  function build(app, h) {
    handlers = h;
    app.innerHTML = `
      <div id="top">
        <div class="hp"><div class="barbg"><div class="barfg" id="hpbar"></div></div><div class="num" id="hpnum"></div></div>
        <canvas class="dial" id="dial" width="80" height="80" aria-label="The clock"></canvas>
        <span class="badge" id="badge"></span>
        <button class="btn small" id="howbtn" aria-label="How the museum works">?</button>
        <button class="btn small" id="setbtn" aria-label="Settings">⚙</button>
      </div>
      <div id="board" aria-label="The board"></div>
      <div id="strip" role="button" aria-label="Open the label"></div>
      <div id="bar">
        <button class="btn" data-act="wait">Wait</button>
        <button class="btn" data-act="bag">Bag</button>
        <button class="btn" data-act="q1">·</button>
        <button class="btn" data-act="q2">·</button>
        <button class="btn" data-act="zoom">Zoom</button>
        <button class="btn" data-act="map">Map</button>
      </div>
      <div id="sheet" aria-live="polite"></div>
      <div class="overlay" id="how"></div>
      <div class="overlay" id="settings"></div>`;
    for (const id of ['hpbar', 'hpnum', 'dial', 'badge', 'board', 'strip', 'bar', 'sheet', 'how', 'settings']) els[id] = document.getElementById(id);
    els.bar.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) handlers.bar(b.dataset.act); });
    els.strip.addEventListener('click', () => handlers.openLabel());
    document.getElementById('howbtn').onclick = () => toggle('how', true);
    document.getElementById('setbtn').onclick = () => toggle('settings', true);
    els.sheet.addEventListener('click', e => {
      const b = e.target.closest('[data-label-act]');
      if (b) handlers.labelAction(b.dataset.labelAct);
      if (e.target.closest('[data-close]')) closeLabel();
    });
    for (const o of ['how', 'settings']) els[o].addEventListener('click', e => {
      if (e.target.closest('[data-close]')) toggle(o, false);
      const s = e.target.closest('[data-set]');
      if (s) handlers.setting(s.dataset.set, s.dataset.value);
    });
    renderHow();
    return els.board;
  }

  function toggle(id, on) { els[id].classList.toggle('open', on); }

  function renderHow() {
    els.how.innerHTML = `<h2>How the museum works</h2><ul class="systems">` +
      Registry.SYSTEMS.map(s => `<li>${P(s.icon, 24, '#f2e3bc')}<div><b>${esc(s.name)}.</b> ${esc(s.sentence)}</div></li>`).join('') +
      `</ul><button class="btn" data-close>Close</button>`;
  }

  function renderSettings(opts) {
    const choice = (key, value, text) => `<button class="btn" data-set="${key}" data-value="${value}" aria-pressed="${opts[key] === value}">${opts[key] === value ? '● ' : ''}${esc(text)}</button>`;
    els.settings.innerHTML = `<h2>Settings</h2>
      <div class="row"><b>Board</b> ${choice('board', 'topdown', 'Flat')} ${choice('board', 'board3d', '3D')}</div>
      ${opts.boardNote ? `<p class="note">${esc(opts.boardNote)}</p>` : ''}
      <div class="row"><b>Text size</b> ${choice('text', '1', 'Normal')} ${choice('text', '1.15', 'Larger')} ${choice('text', '1.3', 'Largest')}</div>
      <div class="row"><b>Label font</b> ${choice('font', 'book', 'Book')} ${choice('font', 'plain', 'Plain')}</div>
      <div class="row"><b>Motion</b> ${choice('motion', 'full', 'Full')} ${choice('motion', 'reduce', 'Reduced')}</div>
      <button class="btn" data-close>Close</button>`;
  }

  // The top bar.
  function top(m) {
    const pct = m.maxHp ? Math.max(0, Math.round(100 * m.hp / m.maxHp)) : 0;
    els.hpbar.style.width = pct + '%';
    els.hpnum.textContent = `Health ${m.hp} / ${m.maxHp}`;
    els.badge.textContent = `Grade ${roman(m.grade)}`;
    els.badge.title = `Handling Clearance, Grade ${roman(m.grade)}`;
    dial(m.clock);
  }
  const roman = n => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][n] || String(n);

  // A museum clock face: open hours, then the bell, then the night watch.
  function dial(c) {
    const x = els.dial.getContext('2d'), r = 36;
    x.clearRect(0, 0, 80, 80);
    x.save(); x.translate(40, 40);
    x.fillStyle = '#2a2631'; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill();
    if (c && c.B) {
      const end = c.B + 2 * c.G, a = t => -Math.PI / 2 + Math.PI * 2 * Math.min(1, t / end);
      const seg = (from, to, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, r, a(from), a(to)); x.fill(); };
      seg(0, c.B, '#3d5a46'); seg(c.B, c.B + c.G, '#7a6430'); seg(c.B + c.G, end, '#6a2a30');
      x.strokeStyle = '#ece6d8'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a(c.turn)) * (r - 4), Math.sin(a(c.turn)) * (r - 4)); x.stroke();
    }
    x.restore();
  }

  // The strip: the nearest readable thing, or the last event.
  function strip(s) {
    if (!s) { els.strip.innerHTML = ''; return; }
    if (s.log) { els.strip.innerHTML = `<div class="log">${esc(s.log)}</div>`; return; }
    els.strip.innerHTML = `<div class="strip-title">${s.stateIcons.map(i => P(i, 14)).join('')}<span>${esc(s.title)}</span></div>
      <div class="strip-sub">${s.pictos.map(p => P(p, 14)).join('')}${s.behaviour ? `<span class="behaviour">${esc(s.behaviour)}</span>` : ''}</div>`;
  }

  // The full label.
  function label(l) {
    if (!l) { els.sheet.innerHTML = ''; return; }
    const tomb = l.tomb ? [l.tomb.maker, l.tomb.date, l.tomb.medium, l.tomb.dims, l.tomb.credit, l.number].filter(Boolean).map(esc).join(' · ') : '';
    els.sheet.innerHTML = `<div class="label">
      ${l.closeup ? '<canvas class="closeup" width="64" height="64"></canvas>' : ''}
      <h2>${l.stateIcons.map(i => P(i, 18)).join('')}${esc(l.title)}</h2>
      <div class="tomb">${tomb}</div>
      ${l.pictos.length ? `<div class="pictos">${l.pictos.map(p => `<span>${P(p.icon, 14, '#ece6d8')}${esc(p.text)}</span>`).join('')}</div>` : ''}
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
  function closeLabel() { els.sheet.classList.remove('open'); handlers.closedLabel && handlers.closedLabel(); }

  return { build, top, strip, label, closeLabel, renderSettings, toggle };
})();
