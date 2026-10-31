// SQUARE OFF — menus: title, campaign map + briefings, skirmish setup, Daily Park, options
// (accessibility §5.6), Field Guide, Park Report end screen. Also owns the save (localStorage
// 'squareoff.v1', every access wrapped in try/catch) and SQ.settings.
//
//   SQ.save.data / SQ.save.write() / SQ.save.reset()
//   SQ.settings.get(key) / set(key, value, quiet?) / all() — emits 'settings' {key, value, all} on SQ.bus
//     keys: speed (0.75|1|1.25), colorblind, textSize ('s'|'m'|'l'|'xl'), bubbles ('on'|'text'|'off'),
//           reducedMotion, leftHanded, captions, assist, minimap (null = auto), haptics, tips, quality,
//           volumes {master, sfx, music, ambience}, muted, unlockAll, nudge
//   SQ.menus.init(menuEl)   showTitle()   showCampaign()   showBriefing(id)   showSkirmish()
//   SQ.menus.openOptions()  openFieldGuide(tab?)   showReport(victoryPayload)   isOpen()   close()
//   SQ.menus.startMission(id, crew?)   quickPlay()   playDaily()   restart()   missionCfg(id, crew?)
//   SQ.menus.stars(missionId) -> [bool, bool, bool]
// Listens on SQ.bus: 'gameStart' (hide), 'gameQuit' (title), 'victory' (stars + Park Report), plus
// 'hit' / 'overIt' / 'capture' / 'rally' during a match for the Park Report (MVP squad etc.).
(function (SQ) {
  'use strict';
  const U = SQ.ui || {};
  const hasDoc = typeof document !== 'undefined';
  const KEY = (SQ.C && SQ.C.SAVE_KEY) || 'squareoff.v1';

  // =========================================================================================
  // Save
  // =========================================================================================
  function blankSave() {
    return { v: 1, started: false, settings: {}, missions: {}, unlocked: { factions: ['pack'] }, cosmetics: [], daily: {}, tips: {}, skirmish: null, plays: 0 };
  }
  const save = {
    data: blankSave(),
    load() {
      try {
        const raw = typeof localStorage !== 'undefined' && localStorage.getItem(KEY);
        if (raw) { const d = JSON.parse(raw); if (d && typeof d === 'object') save.data = Object.assign(blankSave(), d); }
      } catch (e) { /* private mode / blocked storage: play without saving */ }
      return save.data;
    },
    write() {
      try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(save.data)); } catch (e) { /* ignore */ }
    },
    reset() { const s = save.data.settings; save.data = blankSave(); save.data.settings = s; save.data.started = true; save.write(); },
    mission(id) { return save.data.missions[id] || (save.data.missions[id] = { stars: [false, false, false], losses: 0, plays: 0, best: null, chill: 0 }); },
  };
  save.load();
  SQ.save = save;

  // =========================================================================================
  // Settings
  // =========================================================================================
  let prefersReduced = false;
  try { prefersReduced = !!(hasDoc && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* ignore */ }
  const DEFAULTS = {
    speed: 1, colorblind: false, textSize: 'm', bubbles: 'on', reducedMotion: prefersReduced, leftHanded: false, captions: false,
    assist: false, minimap: null, haptics: true, tips: true, quality: 'auto', volumes: { master: 0.9, sfx: 0.9, music: 0.6, ambience: 0.7 },
    muted: false, unlockAll: false, nudge: true,
  };
  const settings = {
    get(k) { const v = save.data.settings[k]; return v === undefined ? DEFAULTS[k] : v; },
    all() { return Object.assign({}, DEFAULTS, save.data.settings); },
    set(k, v, quiet) {
      save.data.settings[k] = v;
      save.write();
      applySettings();
      if (k === 'quality') { try { if (SQ.render && typeof SQ.render.setQuality === 'function') SQ.render.setQuality(v); } catch (e) { /* ignore */ } }
      if (!quiet && SQ.bus) SQ.bus.emit('settings', { key: k, value: v, all: settings.all() });
    },
  };
  SQ.settings = settings;
  // Convenience flags for render/fx (read-only mirrors).
  function applySettings() {
    const s = settings.all();
    settings.reducedMotion = !!s.reducedMotion;
    settings.colorblind = !!s.colorblind;
    if (SQ.game) SQ.game.speed = s.speed || 1;
    if (hasDoc) {
      const h = document.documentElement;
      h.classList.toggle('sq-reduced', !!s.reducedMotion);
      h.classList.toggle('sq-cb', !!s.colorblind);
      h.classList.toggle('sq-lefty', !!s.leftHanded);
      h.dataset.textsize = s.textSize || 'm';
      h.style.setProperty('--ui-scale', String({ s: 0.9, m: 1, l: 1.15, xl: 1.3 }[s.textSize] || 1));
    }
    try {
      if (SQ.audio) {
        if (typeof SQ.audio.setVolumes === 'function') SQ.audio.setVolumes(s.volumes);
        if (typeof SQ.audio.mute === 'function') SQ.audio.mute(!!s.muted);
      }
    } catch (e) { /* ignore */ }
    try { if (SQ.render && typeof SQ.render.setOptions === 'function') SQ.render.setOptions({ reducedMotion: !!s.reducedMotion, colorblind: !!s.colorblind }); } catch (e) { /* ignore */ }
    try { if (SQ.camera && typeof SQ.camera.setNudge === 'function') SQ.camera.setNudge(!!s.nudge); } catch (e) { /* ignore */ }
  }
  applySettings();

  // =========================================================================================
  // Helpers
  // =========================================================================================
  const D = () => SQ.data;
  const T = () => SQ.data.text;
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function esc(s) { return U.esc ? U.esc(s) : String(s); }
  // ●▲■ inside text: drawn as inline SVG shapes (the handwriting fonts turn ● into a tiny bullet)
  function gt(str) { return U.glyphText ? U.glyphText(String(str == null ? '' : str), '#163a2b') : esc(str); }
  function glyph(cls, color, size) { return U.glyph ? U.glyph(cls, color, size) : ({ crowd: '●', talker: '▲', heavy: '■' }[cls] || ''); }
  function color(key) { return U.crewColor ? U.crewColor(key) : (D().factions[key] || {}).color; }
  function play(n) { if (U.play) U.play(n); }
  function crewName(key) { return (D().factions[key] || {}).name || key; }
  function todayStr() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function seedNow() { return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0; }
  const STEP = ['chill', 'regular', 'hard', 'legend'];
  function stepDown(diff, n) { let i = STEP.indexOf(diff); if (i < 0) i = 1; return STEP[Math.max(0, i - (n || 0))]; }

  function unlockedCrews() {
    const order = D().factionOrder;
    if (settings.get('unlockAll')) return order.slice();
    const won = (id) => !!(save.data.missions[id] && save.data.missions[id].stars[0]);
    const set = new Set(['pack'].concat(save.data.unlocked.factions || []));
    if (won('m2')) order.forEach((k) => set.add(k));
    return order.filter((k) => set.has(k));
  }
  function missionUnlocked(m) {
    if (settings.get('unlockAll') || m.n === 1) return true;
    const prev = D().missions[m.n - 2];
    return !!(prev && save.data.missions[prev.id] && save.data.missions[prev.id].stars[0]);
  }
  function starsOf(id) { return (save.data.missions[id] && save.data.missions[id].stars) || [false, false, false]; }

  // =========================================================================================
  // Menu shell
  // =========================================================================================
  const M = { root: null, screen: null, overlay: null, lastCfg: null, lastKind: null, _subs: false };
  SQ.menus = M;

  M.init = function (root) {
    if (!hasDoc) return;
    M.root = root || document.getElementById('menu');
    if (!M.root) return;
    M.root.classList.add('sq-menu');
    if (!M._subs) subscribe();
    applySettings();
    const params = new URLSearchParams(location.search);
    const mission = params.get('mission');
    if (mission && D().missionById[mission]) { M.startMission(mission, params.get('crew')); return; }
    // a URL that already names a match (main.js starts it): no menu, and keep the first-launch drop
    const urlMatch = ['skirmish', 'quick', 'faction', 'crew'].some((k) => params.has(k));
    if (urlMatch) { M.lastCfg = null; M.lastMeta = null; return; }
    if (!save.data.started && !params.has('title') && !params.has('menu')) {
      // First launch: straight into Mission 1, no menu wall.
      save.data.started = true; save.write();
      M.startMission('m1');
      return;
    }
    save.data.started = true; save.write();
    M.showTitle();
  };

  function subscribe() {
    M._subs = true;
    if (!SQ.bus) return;
    SQ.bus.on('gameStart', (p) => {
      M.close(); trackStart(p && p.match);
      // a match not started from the menus (URL skirmish, dev hooks): Restart replays that match
      if (!M._starting && p && p.match) { M.lastCfg = p.match.cfg || null; M.lastMeta = { kind: 'skirmish' }; }
    });
    SQ.bus.on('gameQuit', () => { if (ensureRoot()) M.showTitle(); });
    SQ.bus.on('victory', onVictory);
    SQ.bus.on('hit', trackHit);
    SQ.bus.on('overIt', trackOverIt);
    SQ.bus.on('capture', trackCapture);
    SQ.bus.on('rally', (p) => { if (tracker && p && p.faction === tracker.player) tracker.rallied++; });
    SQ.bus.on('settings', () => { if (M.screen && M.screen._refresh) M.screen._refresh(); });
  }

  function ensureRoot() {
    if (!M.root && hasDoc) M.root = document.getElementById('menu');
    if (M.root) M.root.classList.add('sq-menu');
    return M.root;
  }
  function setScreen(node, kind) {
    if (!ensureRoot()) return;
    M.root.innerHTML = '';
    M.overlay = null;
    M.screen = node;
    M.kind = kind;
    if (node) { node.classList.add('mn-screen'); M.root.appendChild(node); }
    M.root.classList.toggle('open', !!node);
  }
  M.close = function () { if (!M.root) return; M.root.innerHTML = ''; M.screen = null; M.overlay = null; M.kind = null; M.root.classList.remove('open'); };
  M.isOpen = function () { return !!(M.root && M.root.children.length); };

  // An overlay (options / field guide) on top of whatever is showing (title, or the in-game pause menu).
  function openOverlay(node, onClose) {
    ensureRoot();
    const wrap = el('div', 'mn-overlay');
    wrap.appendChild(node);
    M.root.appendChild(wrap);
    M.root.classList.add('open');
    play('open');
    const close = () => {
      wrap.remove();
      play('close');
      if (!M.root.children.length) M.root.classList.remove('open');
      if (onClose) onClose();
    };
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(); });
    node.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    wrap._close = close;
    return wrap;
  }

  function header(title, back, extra) {
    const h = el('div', 'mn-head');
    h.innerHTML = (back ? '<button class="mn-back" aria-label="Back">‹ <span>Back</span></button>' : '') + '<h2>' + title + '</h2>' + (extra || '');
    if (back) h.querySelector('.mn-back').addEventListener('click', () => { play('click'); back(); });
    return h;
  }

  // =========================================================================================
  // Title
  // =========================================================================================
  function liveScene() {
    const params = hasDoc ? new URLSearchParams(location.search) : null;
    if (params && params.get('title') === 'art') return false;
    const canvas = hasDoc && document.querySelector('#view canvas');
    return !!(canvas && SQ.render && (SQ.render.ready || SQ.render.renderer || SQ.render.scene));
  }
  function attractCamera() {
    const c = SQ.camera;
    if (!c) return;
    for (const n of ['attract', 'titleShot', 'idle']) if (typeof c[n] === 'function') { try { c[n](true); return; } catch (e) { /* next */ } }
    if (typeof c.setMode === 'function') { try { c.setMode('title'); } catch (e) { /* ignore */ } }
  }

  M.showTitle = function () {
    if (!ensureRoot()) return;
    try { if (SQ.audio && SQ.audio.setMusic) SQ.audio.setMusic('menu'); } catch (e) { /* ignore */ }
    attractCamera();
    const live = liveScene();
    const s = el('div', 'mn-title' + (live ? ' live' : ' art'));
    if (!live) s.appendChild(archArt());
    const next = D().missions.find((m) => !starsOf(m.id)[0] && missionUnlocked(m));
    const daily = dailySetup();
    const best = save.data.daily[daily.date];
    const panel = el('div', 'tt-panel');
    panel.innerHTML =
      '<div class="tt-logo">' + logoSVG() + '</div>' +
      '<p class="tt-tag">Five minutes, five dollars, the whole park.</p>' +
      '<div class="tt-btns">' +
      (next ? '<button class="mbtn primary big" data-a="next"><span class="mb-k">' + (next.n === 1 && !save.data.missions.m1 ? 'START' : 'CONTINUE') + ' · MISSION ' + next.n + '</span><b>' + esc(next.title) + '</b></button>'
        : '<button class="mbtn primary big" data-a="quick"><span class="mb-k">ONE TAP</span><b>QUICK PLAY</b></button>') +
      (next ? '<button class="mbtn" data-a="quick"><b>Quick Play</b><small>Random crew vs a ' + (quickDifficulty() === 'chill' ? 'Chill' : 'Regular') + ' AI</small></button>' : '') +
      '<button class="mbtn" data-a="campaign"><b>Campaign</b><small>One Day in the Square · ' + totalStars() + '/18 ★</small></button>' +
      '<button class="mbtn" data-a="skirmish"><b>Skirmish</b><small>Your crew, your rules</small></button>' +
      '<button class="mbtn daily" data-a="daily"><b>Daily Park</b><small>' + esc(daily.mod.name) + (best !== undefined ? ' · best +' + best : '') + '</small></button>' +
      '</div>' +
      '<div class="tt-row">' +
      '<button class="mbtn small" data-a="guide">Field Guide</button>' +
      '<button class="mbtn small" data-a="options">Options</button>' +
      '</div>' +
      '<p class="tt-foot">Washington Square Park, NYC · every bench is a real bench · map data © OpenStreetMap contributors</p>';
    panel.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
      play('click');
      const a = b.dataset.a;
      if (a === 'next') M.showBriefing(next.id);
      else if (a === 'quick') M.quickPlay();
      else if (a === 'campaign') M.showCampaign();
      else if (a === 'skirmish') M.showSkirmish();
      else if (a === 'daily') M.showDaily();
      else if (a === 'guide') M.openFieldGuide();
      else if (a === 'options') M.openOptions();
    }));
    s.appendChild(panel);
    setScreen(s, 'title');
  };
  function totalStars() { let n = 0; for (const m of D().missions) n += starsOf(m.id).filter(Boolean).length; return n; }

  function logoSVG() {
    return '<svg viewBox="0 0 470 122" class="logo" role="img" aria-label="Square Off">' +
      '<g class="lg-arch" transform="translate(232 6)">' +
      '<path d="M0 104V14h64v90H44V58a12 12 0 0 0-24 0v46z" fill="#f3ecdc" stroke="#163a2b" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M-4 14h72M-2 6h68v8H-2z" fill="#f3ecdc" stroke="#163a2b" stroke-width="3"/>' +
      '<path d="M8 24h48" stroke="#163a2b" stroke-width="2" opacity=".5"/>' +
      '<circle cx="12" cy="36" r="3" fill="#163a2b" opacity=".35"/><circle cx="52" cy="36" r="3" fill="#163a2b" opacity=".35"/></g>' +
      '<text x="222" y="80" text-anchor="end" class="lg-t" textLength="212" lengthAdjust="spacingAndGlyphs">SQUARE</text>' +
      '<text x="306" y="80" text-anchor="start" class="lg-t lg-off" textLength="120" lengthAdjust="spacingAndGlyphs">OFF</text>' +
      '<path d="M14 100q90-12 196-2" class="lg-chalk"/><path d="M308 100q60-8 124 0" class="lg-chalk"/>' +
      '</svg>';
  }

  // Hand-built illustration of the Arch at golden hour with the Empire State through the opening.
  function archArt() {
    const w = el('div', 'tt-art');
    let bld = '';
    // distant midtown silhouettes
    const rng = SQ.util ? SQ.util.mulberry32(7) : Math.random;
    for (let x = 0; x < 1600; x += 22 + Math.floor(rng() * 30)) {
      const h = 120 + rng() * 200;
      bld += '<rect x="' + x + '" y="' + (560 - h) + '" width="' + (20 + rng() * 34) + '" height="' + h + '" />';
    }
    let wins = '';
    for (let k = 0; k < 90; k++) {
      const x = Math.floor(rng() * 1600), y = 300 + Math.floor(rng() * 250);
      wins += '<rect x="' + x + '" y="' + y + '" width="3" height="4" style="animation-delay:' + (rng() * 6).toFixed(2) + 's"/>';
    }
    let trees = '';
    const treeAt = (cx, cy, r, c) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + c + '"/>';
    for (let k = 0; k < 26; k++) {
      const side = k % 2 ? 1 : -1;
      const cx = side < 0 ? rng() * 560 - 40 : 1180 + rng() * 520;
      const cy = 560 + rng() * 160;
      const r = 60 + rng() * 80;
      trees += treeAt(cx, cy, r, ['#1f3b2a', '#264a33', '#2d5639', '#1a3324'][k % 4]);
    }
    let lamps = '';
    for (const x of [640, 1480, 330, 1260]) {
      lamps += '<g transform="translate(' + x + ' 0)"><rect x="-3" y="690" width="6" height="140" fill="#1b231f"/><circle cx="0" cy="684" r="13" fill="#ffe2a0"/><circle class="tt-glow" cx="0" cy="684" r="44" fill="url(#lampG)"/></g>';
    }
    w.innerHTML =
      '<svg class="tt-svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs>' +
      '<linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2a52"/><stop offset=".45" stop-color="#6a4f7d"/><stop offset=".72" stop-color="#e98a5b"/><stop offset="1" stop-color="#ffcf7a"/></linearGradient>' +
      '<radialGradient id="sunG" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff2c4" stop-opacity=".95"/><stop offset=".4" stop-color="#ffc56a" stop-opacity=".55"/><stop offset="1" stop-color="#ff9a4a" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="lampG" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd98a" stop-opacity=".65"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="marbleG" x1="0" x2="1"><stop offset="0" stop-color="#d9cdb4"/><stop offset=".35" stop-color="#f5ecdb"/><stop offset=".7" stop-color="#efe3cc"/><stop offset="1" stop-color="#c9b99c"/></linearGradient>' +
      '<linearGradient id="groundG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d8577"/><stop offset="1" stop-color="#4a4740"/></linearGradient>' +
      '<linearGradient id="waterG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd0e6"/><stop offset="1" stop-color="#3f7fa6"/></linearGradient>' +
      '</defs>' +
      '<rect width="1600" height="1000" fill="url(#skyG)"/>' +
      '<circle cx="1060" cy="520" r="260" fill="url(#sunG)"/>' +
      '<g fill="#3a3550" opacity=".55">' + bld + '</g>' +
      // Empire State Building through the arch
      '<g fill="#2f2a44" transform="translate(1060 0)"><rect x="-26" y="300" width="52" height="260"/><rect x="-18" y="250" width="36" height="60"/><rect x="-11" y="214" width="22" height="40"/><rect x="-6" y="190" width="12" height="28"/><rect x="-2" y="140" width="4" height="54"/><rect x="-40" y="380" width="80" height="180"/></g>' +
      '<g class="tt-wins" fill="#ffd98a">' + wins + '</g>' +
      // Fifth Ave / The Row flanking
      '<g fill="#5a3a33"><rect x="560" y="430" width="250" height="200"/><rect x="1310" y="420" width="260" height="210"/></g>' +
      '<g fill="#e9c27a" opacity=".55"><rect x="580" y="450" width="10" height="16"/><rect x="610" y="450" width="10" height="16"/><rect x="640" y="450" width="10" height="16"/><rect x="580" y="490" width="10" height="16"/><rect x="700" y="490" width="10" height="16"/><rect x="1330" y="450" width="10" height="16"/><rect x="1390" y="490" width="10" height="16"/><rect x="1450" y="450" width="10" height="16"/></g>' +
      // ground
      '<path d="M0 640H1600V1000H0z" fill="url(#groundG)"/>' +
      '<path d="M0 640H1600" stroke="#bdb39f" stroke-width="3" opacity=".5"/>' +
      // the Arch
      '<g transform="translate(1060 0)">' +
      '<path d="M-250 650V250H250V650H100V420A100 100 0 0 0-100 420V650Z" fill="url(#marbleG)"/>' +
      '<path d="M-262 250H262V214H-262Z" fill="#efe3cc"/><path d="M-270 214H270V196H-270Z" fill="#d8caae"/>' +
      '<path d="M-250 196H250V120H-250Z" fill="url(#marbleG)"/><path d="M-260 120H260V104H-260Z" fill="#e3d6bc"/>' +
      '<path d="M-238 132H238" stroke="#b8a888" stroke-width="3" stroke-dasharray="10 8"/>' +
      '<path d="M-226 240H226M-226 300H-110M110 300H226" stroke="#c4b393" stroke-width="2"/>' +
      '<path d="M-100 420A100 100 0 0 1 100 420" fill="none" stroke="#c4b393" stroke-width="10"/>' +
      '<path d="M-108 420A108 108 0 0 1 108 420" fill="none" stroke="#efe3cc" stroke-width="4" stroke-dasharray="6 10"/>' +
      '<circle cx="-170" cy="330" r="22" fill="none" stroke="#c4b393" stroke-width="3"/><circle cx="170" cy="330" r="22" fill="none" stroke="#c4b393" stroke-width="3"/>' +
      '<path d="M-150 270q40 20 60 70M150 270q-40 20-60 70" stroke="#c4b393" stroke-width="3" fill="none"/>' +
      '<path d="M-250 600H-110M110 600H250" stroke="#b8a888" stroke-width="3"/>' +
      // statues on the piers
      '<g fill="#cdbf9f"><path d="M-206 600v-90q14-26 28 0v90z"/><circle cx="-192" cy="500" r="11"/><path d="M178 600v-90q14-26 28 0v90z"/><circle cx="192" cy="500" r="11"/></g>' +
      '<text x="0" y="164" text-anchor="middle" font-family="Georgia,serif" font-size="10.5" letter-spacing="2.2" fill="#9d8f72" textLength="460" lengthAdjust="spacingAndGlyphs">LET US RAISE A STANDARD TO WHICH THE WISE AND THE HONEST CAN REPAIR</text>' +
      '</g>' +
      '<g>' + trees + '</g>' +
      lamps +
      // fountain
      '<g transform="translate(1060 820)">' +
      '<ellipse cx="0" cy="40" rx="430" ry="70" fill="#a7a092"/><ellipse cx="0" cy="30" rx="400" ry="58" fill="url(#waterG)"/>' +
      '<ellipse cx="0" cy="24" rx="70" ry="14" fill="#cfe9f5" opacity=".8"/>' +
      '<g class="tt-jets" stroke="#e6f6ff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".85">' +
      '<path d="M0 22q-4-120 0-150"/><path d="M-20 22q-30-80-60-90"/><path d="M20 22q30-80 60-90"/><path d="M-200 30q-10-40-30-50"/><path d="M200 30q10-40 30-50"/><path d="M-110 26q-10-60-30-70"/><path d="M110 26q10-60 30-70"/></g>' +
      '</g>' +
      // chalk accents on the pavement
      '<g class="tt-chalk" fill="none" stroke="#fff8d8" stroke-width="5" stroke-linecap="round" opacity=".55">' +
      '<circle cx="250" cy="880" r="34"/><path d="M400 912l36-62 36 62z"/><rect x="520" y="850" width="62" height="62"/>' +
      '<path d="M300 940q120 20 260-6" stroke-dasharray="14 12"/></g>' +
      '</svg>';
    const svg = w.querySelector('svg');
    const fit = () => {
      const portrait = window.innerHeight > window.innerWidth * 1.1;
      svg.setAttribute('viewBox', portrait ? '740 40 640 960' : '0 0 1600 1000');
      svg.setAttribute('preserveAspectRatio', portrait ? 'xMidYMin meet' : 'xMidYMid slice');
    };
    fit();
    window.addEventListener('resize', fit);
    return w;
  }

  // =========================================================================================
  // Campaign
  // =========================================================================================
  const PIN = { m1: [31, 62], m2: [-134, 49], m3: [0, -46], m4: [20, -4], m5: [58, -14], m6: [-30, 24] };
  M.showCampaign = function () {
    const s = el('div', 'mn-page mn-campaign');
    s.appendChild(header('One Day in the Square', () => M.showTitle(), '<span class="mn-stars">' + totalStars() + ' / 18 ★</span>'));
    const body = el('div', 'cp-body');
    const map = el('div', 'cp-map');
    map.innerHTML = parkSVG(D().missions.map((m) => {
      const st = starsOf(m.id), un = missionUnlocked(m);
      return { id: m.id, x: PIN[m.id][0], z: PIN[m.id][1], label: String(m.n), cls: (un ? 'un' : 'lock') + (st[0] ? ' done' : '') };
    }));
    map.querySelectorAll('[data-pin]').forEach((p) => p.addEventListener('click', () => { const m = D().missionById[p.dataset.pin]; if (missionUnlocked(m)) { play('click'); M.showBriefing(m.id); } else play('deny'); }));
    const list = el('div', 'cp-list');
    for (const m of D().missions) {
      const st = starsOf(m.id), un = missionUnlocked(m);
      const c = el('button', 'cp-card' + (un ? '' : ' lock') + (st[0] ? ' done' : ''));
      const crew = m.player === 'pick' ? 'Your pick' : crewName(m.player);
      c.innerHTML = '<span class="cp-n">' + m.n + '</span><span class="cp-main"><span class="cp-clock">' + esc(m.clock) + '</span><b>' + esc(m.title) + '</b><small>' + gt(m.teaches) + '</small><em>' + esc(crew) + '</em></span>' +
        '<span class="cp-stars">' + st.map((x) => '<i class="' + (x ? 'on' : '') + '">★</i>').join('') + '</span>' + (un ? '' : '<span class="cp-lock">🔒 Win mission ' + (m.n - 1) + '</span>');
      if (m.player !== 'pick') c.style.setProperty('--c', color(m.player));
      c.addEventListener('click', () => { if (!un) { play('deny'); return; } play('click'); M.showBriefing(m.id); });
      list.appendChild(c);
    }
    body.appendChild(map); body.appendChild(list);
    s.appendChild(body);
    setScreen(s, 'campaign');
  };

  /** Park outline map from GEO with optional pins [{id, x, z, label, cls}]. */
  function parkSVG(pins, opts) {
    const G = typeof window !== 'undefined' && window.GEO;
    const B = { x0: -175, x1: 150, z0: -95, z1: 100 };
    const W = B.x1 - B.x0, Hh = B.z1 - B.z0;
    const pt = (p) => (p[0] - B.x0).toFixed(1) + ',' + (p[1] - B.z0).toFixed(1);
    let shapes = '';
    if (G) {
      for (const r of G.roads || []) shapes += '<polyline class="pk-road" points="' + r.pts.map(pt).join(' ') + '"/>';
      const park = (G.areas || []).find((a) => a.kind === 'park' && /Washington Square/.test(a.name || ''));
      if (park) shapes += '<polygon class="pk-park" points="' + park.pts.map(pt).join(' ') + '"/>';
      for (const a of G.areas || []) {
        const k = a.kind;
        const c = k === 'grass' || k === 'garden' || k === 'flowerbed' ? 'pk-lawn' : k === 'dog_park' ? 'pk-dog' : k === 'playground' ? 'pk-play' : null;
        if (c) shapes += '<polygon class="' + c + '" points="' + a.pts.map(pt).join(' ') + '"/>';
      }
      for (const p of G.paths || []) if (!p.area) shapes += '<polyline class="pk-path" points="' + p.pts.map(pt).join(' ') + '"/>';
      for (const b of G.buildings || []) {
        const cx = b.pts.reduce((s, q) => s + q[0], 0) / b.pts.length, cz = b.pts.reduce((s, q) => s + q[1], 0) / b.pts.length;
        if (cx > B.x0 - 30 && cx < B.x1 + 30 && cz > B.z0 - 30 && cz < B.z1 + 30) shapes += '<polygon class="pk-bld" points="' + b.pts.map(pt).join(' ') + '"/>';
      }
      if (!(opts && opts.noTrees)) {
        let tr = '';
        for (const t of G.trees || []) if (t[0] > B.x0 && t[0] < B.x1 && t[1] > B.z0 && t[1] < B.z1) tr += '<circle cx="' + (t[0] - B.x0).toFixed(1) + '" cy="' + (t[1] - B.z0).toFixed(1) + '" r="2.6"/>';
        shapes += '<g class="pk-trees">' + tr + '</g>';
      }
    }
    shapes += '<circle class="pk-fountain" cx="' + (0 - B.x0) + '" cy="' + (0 - B.z0) + '" r="11"/>';
    shapes += '<rect class="pk-arch" x="' + (-9 - B.x0) + '" y="' + (-58 - B.z0) + '" width="19" height="8"/>';
    let p = '';
    for (const q of pins || []) {
      p += '<g class="pk-pin ' + (q.cls || '') + '" data-pin="' + q.id + '" transform="translate(' + (q.x - B.x0).toFixed(1) + ' ' + (q.z - B.z0).toFixed(1) + ')" tabindex="0" role="button" aria-label="Mission ' + q.label + '">' +
        '<circle r="13"/><text y="5" text-anchor="middle">' + esc(q.label) + '</text></g>';
    }
    return '<svg class="pk-svg" viewBox="0 0 ' + W + ' ' + Hh + '" preserveAspectRatio="xMidYMid meet">' + shapes + p +
      '<text class="pk-n" x="' + (W - 8) + '" y="16" text-anchor="end">N ↑</text></svg>';
  }

  M.showBriefing = function (id, crewSel) {
    const m = D().missionById[id];
    if (!m) return;
    const rec = save.mission(id);
    const crews = unlockedCrews();
    let crew = m.player === 'pick' ? (crewSel && crews.indexOf(crewSel) >= 0 ? crewSel : rec.crew && crews.indexOf(rec.crew) >= 0 ? rec.crew : crews[0]) : m.player;
    const s = el('div', 'mn-page mn-brief');
    s.appendChild(header('Mission ' + m.n, () => M.showCampaign()));
    const b = el('div', 'br-body');
    const render = () => {
      const st = starsOf(id);
      const panels = m.intro.map((line, k) => '<div class="br-panel" style="--k:' + k + '"><span class="br-pn">' + (k + 1) + '</span>' + panelArt(m, k) + '<p>' + (U.glyphText ? U.glyphText(line) : esc(line)) + '</p></div>').join('');
      const opp = m.opponents.map((o) => (o.faction === 'pick' ? 'a rival crew' : crewName(o.faction)) + ' (' + (T().personalities[o.personality] || {}).name + ', ' + (T().difficulties[stepDown(o.difficulty, rec.chill)] || {}).name + ')').join(' and ');
      b.innerHTML =
        '<div class="br-top" style="--c:' + color(crew) + '"><div class="br-clock">' + esc(m.clock) + '</div><h3>' + esc(m.title) + '</h3><p class="br-blurb">' + esc(m.blurb) + '</p>' +
        '<p class="br-vs">You play <b>' + esc(crewName(crew)) + '</b> vs ' + esc(opp) + '.</p></div>' +
        '<div class="br-comic">' + panels + '</div>' +
        (m.player === 'pick' ? '<div class="br-pick"><div class="mn-label">Pick your crew</div><div class="seg crews">' + D().factionOrder.map((k) => '<button class="crew-chip' + (k === crew ? ' on' : '') + (crews.indexOf(k) < 0 ? ' lock' : '') + '" data-crew="' + k + '" style="--c:' + color(k) + '"' + (crews.indexOf(k) < 0 ? ' disabled' : '') + '><i></i>' + esc(D().factions[k].short) + '</button>').join('') + '</div></div>' : '') +
        '<div class="br-stars"><div class="mn-label">Stars</div>' + m.stars.map((x, k) => '<div class="br-star' + (st[k] ? ' on' : '') + '"><i>★</i>' + esc(x.text) + '</div>').join('') + '</div>' +
        (rec.chill ? '<div class="br-chill">Chilled down ' + rec.chill + ' step' + (rec.chill > 1 ? 's' : '') + ' · Assist on <button class="mbtn small" data-a="unchill">Undo</button></div>' : '') +
        '<div class="br-go"><button class="mbtn primary big" data-a="play"><b>PLAY</b><small>' + gt(m.teaches) + '</small></button></div>';
      b.querySelectorAll('[data-crew]').forEach((c) => c.addEventListener('click', () => { crew = c.dataset.crew; rec.crew = crew; save.write(); play('click'); render(); }));
      const un = b.querySelector('[data-a="unchill"]');
      if (un) un.addEventListener('click', () => { rec.chill = 0; save.write(); play('click'); render(); });
      b.querySelector('[data-a="play"]').addEventListener('click', () => { play('click'); M.startMission(id, crew); });
    };
    render();
    s.appendChild(b);
    setScreen(s, 'briefing');
  };
  function panelArt(m, k) {
    if (m.id === 'm2') {
      const pairs = [['crowd', 'talker'], ['talker', 'heavy'], ['heavy', 'crowd']][k];
      return '<div class="br-art tri">' + glyph(pairs[0], '#163a2b', 44) + '<span>beats</span>' + glyph(pairs[1], '#163a2b', 44) + '</div>';
    }
    const icons = {
      m1: ['smallrun', 'bigrun', 'bobst'], m3: ['arch', 'chess', 'fountain'], m4: ['fountain', 'judson', 'fountain'],
      m5: ['fountain', 'arch', 'grove'], m6: ['chess', 'fountain', 'arch'],
    }[m.id] || ['fountain', 'arch', 'chess'];
    return '<div class="br-art">' + (U.lmIcon ? U.lmIcon(icons[k], 44) : '') + '</div>';
  }

  M.missionCfg = function (id, crew) {
    const m = D().missionById[id];
    const rec = save.mission(id);
    const order = D().factionOrder;
    const player = m.player === 'pick' ? (crew && order.indexOf(crew) >= 0 ? crew : unlockedCrews()[0]) : m.player;
    const used = [player];
    const seed = seedNow();
    const rng = SQ.util ? SQ.util.rngStream(seed, 'menu') : null;
    const cb = settings.get('colorblind');
    const col = (k) => (cb && U.CB_COLORS && U.CB_COLORS[k]) || undefined;
    const opps = m.opponents.map((o) => {
      let f = o.faction;
      if (f === 'pick') {
        const free = order.filter((k) => used.indexOf(k) < 0);
        f = rng ? rng.pick(free) : free[0];
      }
      used.push(f);
      return { faction: f, ai: { personality: o.personality, difficulty: stepDown(o.difficulty, rec.chill) }, color: col(f) };
    });
    const me = { faction: player, ai: false, color: col(player) };
    if (rec.chill) me.assist = true;
    return { missionId: id, seed, players: [me].concat(opps) };
  };

  M.startMission = function (id, crew) {
    const cfg = M.missionCfg(id, crew);
    const rec = save.mission(id);
    rec.plays++; save.data.plays++; save.write();
    startGame(cfg, { kind: 'mission', id, crew: cfg.players[0].faction });
  };

  function startGame(cfg, meta) {
    M.lastCfg = cfg; M.lastMeta = meta;
    M.close();
    if (SQ.game && typeof SQ.game.start === 'function') {
      M._starting = true;
      try { SQ.game.speed = settings.get('speed') || 1; SQ.game.start(cfg); } catch (e) { console.error('[menus] start', e); M.showTitle(); }
      M._starting = false;
    }
  }
  M.restart = function () {
    if (!M.lastCfg) { if (SQ.game && SQ.game.match) M.lastCfg = SQ.game.match.cfg; else return; }
    const cfg = Object.assign({}, M.lastCfg);
    if (!(M.lastMeta && M.lastMeta.kind === 'daily')) cfg.seed = seedNow();
    if (M.lastMeta && M.lastMeta.kind === 'mission') { M.startMission(M.lastMeta.id, M.lastMeta.crew); return; }
    startGame(cfg, M.lastMeta);
  };

  // =========================================================================================
  // Quick Play / Skirmish / Daily
  // =========================================================================================
  /** Quick Play / default skirmish difficulty: Chill until the campaign's Commencement (M3) is won. */
  function quickDifficulty() { return starsOf('m3')[0] ? 'regular' : 'chill'; }
  M.quickDifficulty = quickDifficulty;
  M.quickPlay = function () {
    const crews = unlockedCrews();
    const me = crews[Math.floor(Math.random() * crews.length)];
    const others = D().factionOrder.filter((k) => k !== me);
    const them = others[Math.floor(Math.random() * others.length)];
    const cb = settings.get('colorblind');
    const col = (k) => (cb && U.CB_COLORS && U.CB_COLORS[k]) || undefined;
    startGame({ mapId: 'whole', seed: seedNow(), players: [
      { faction: me, ai: false, assist: !!settings.get('assist'), color: col(me) },
      { faction: them, ai: { personality: D().factions[them].aiPersonality, difficulty: quickDifficulty() }, color: col(them) },
    ] }, { kind: 'quick' });
  };

  function defaultSkirmish() {
    const crews = unlockedCrews();
    const me = crews[0] || 'pack';
    const them = D().factionOrder.find((k) => k !== me);
    return { crew: me, opponents: [{ faction: them, personality: D().factions[them].aiPersonality, difficulty: quickDifficulty() }], map: 'whole', phase: 0, events: 'normal', turf: 1500, assist: !!settings.get('assist') };
  }
  function seg(name, options, value) {
    return '<div class="seg" data-seg="' + name + '">' + options.map((o) => '<button class="' + (String(o[0]) === String(value) ? 'on' : '') + '" data-v="' + o[0] + '">' + o[1] + '</button>').join('') + '</div>';
  }

  M.showSkirmish = function () {
    const sk = Object.assign(defaultSkirmish(), save.data.skirmish || {});
    const crews = unlockedCrews();
    if (crews.indexOf(sk.crew) < 0) sk.crew = crews[0];
    const s = el('div', 'mn-page mn-skirmish');
    s.appendChild(header('Skirmish', () => M.showTitle()));
    const b = el('div', 'sk-body');
    const fixOpp = () => {
      const used = [sk.crew];
      for (const o of sk.opponents) {
        if (used.indexOf(o.faction) >= 0) o.faction = D().factionOrder.find((k) => used.indexOf(k) < 0);
        used.push(o.faction);
      }
    };
    const render = () => {
      fixOpp();
      const P = T().personalities, Df = T().difficulties;
      let html = '<section><div class="mn-label">Your crew</div><div class="sk-crews">' + D().factionOrder.map((k) => {
        const f = D().factions[k], lock = crews.indexOf(k) < 0;
        const u = D().units[k];
        return '<button class="sk-crew' + (k === sk.crew ? ' on' : '') + (lock ? ' lock' : '') + '" data-crew="' + k + '" style="--c:' + color(k) + '"' + (lock ? ' disabled' : '') + '>' +
          '<b>' + esc(f.name) + '</b><small>' + esc(f.tagline) + '</small>' +
          '<span class="sk-units">' + ['crowd', 'talker', 'heavy'].map((c) => '<span>' + glyph(c, color(k), 16) + esc(u[c].name) + '</span>').join('') + '</span>' +
          '<span class="sk-cc">Crew Call: <b>' + esc(f.crewCall.name) + '</b></span>' + (lock ? '<span class="sk-lock">🔒 Campaign</span>' : '') + '</button>';
      }).join('') + '</div></section>';
      html += '<section><div class="mn-label">Opponents <small>' + sk.opponents.length + ' AI' + (sk.opponents.length > 1 ? 's · free-for-all' : '') + '</small></div>';
      sk.opponents.forEach((o, i) => {
        html += '<div class="sk-opp" data-i="' + i + '" style="--c:' + color(o.faction) + '">' +
          '<div class="sk-opp-h"><span class="sk-swatch"></span><b>' + esc(crewName(o.faction)) + '</b><em>' + esc((P[o.personality] || {}).quote || '') + '</em>' +
          (sk.opponents.length > 1 ? '<button class="mbtn small sk-del" data-del="' + i + '" aria-label="Remove">✕</button>' : '') + '</div>' +
          '<div class="sk-row"><span>Crew</span><div class="seg" data-opp="faction">' + D().factionOrder.map((k) => '<button class="crew-dot' + (k === o.faction ? ' on' : '') + '" data-v="' + k + '" style="--c:' + color(k) + '"' + (k === sk.crew || sk.opponents.some((x, j) => j !== i && x.faction === k) ? ' disabled' : '') + '>' + esc(D().factions[k].short) + '</button>').join('') + '</div></div>' +
          '<div class="sk-row"><span>Style</span><div class="seg" data-opp="personality">' + ['hustler', 'mosh', 'turtle', 'opportunist'].map((k) => '<button class="' + (k === o.personality ? 'on' : '') + '" data-v="' + k + '" title="Weak to: ' + esc(P[k].weakness) + '">' + esc(P[k].name) + '</button>').join('') + '</div></div>' +
          '<div class="sk-row"><span>Level</span><div class="seg" data-opp="difficulty">' + STEP.map((k) => '<button class="' + (k === o.difficulty ? 'on' : '') + '" data-v="' + k + '" title="' + esc(Df[k].text) + '">' + esc(Df[k].name) + '</button>').join('') + '</div></div>' +
          '</div>';
      });
      if (sk.opponents.length < 3) html += '<button class="mbtn small sk-add" data-a="add">+ Add an AI</button>';
      html += '</section>';
      html += '<section><div class="mn-label">Map</div><div class="sk-maps">' + D().mapOrder.map((id) => {
        const mp = D().maps[id];
        return '<button class="sk-map' + (id === sk.map ? ' on' : '') + '" data-map="' + id + '"><b>' + esc(mp.name) + '</b><small>' + esc(mp.blurb) + '</small><em>' + mp.landmarks.length + (mp.pick ? '→' + mp.pick : '') + ' landmarks · ' + mp.turfTarget + ' Turf</em></button>';
      }).join('') + '</div></section>';
      html += '<section class="sk-rules"><div class="mn-label">Rules</div>' +
        '<div class="sk-row"><span>Start</span>' + seg('phase', [[0, 'Afternoon'], [200, 'Golden Hour'], [400, 'Night']], sk.phase) + '</div>' +
        '<div class="sk-row"><span>Events</span>' + seg('events', [['calm', 'Calm'], ['normal', 'Normal'], ['chaos', 'Chaos']], sk.events) + '</div>' +
        '<div class="sk-row"><span>Turf</span>' + seg('turf', [[900, '900'], [1500, '1500']], sk.turf) + '</div>' +
        '<div class="sk-row"><span>Assist</span>' + seg('assist', [['true', 'On'], ['false', 'Off']], String(!!sk.assist)) + '</div>' +
        '<p class="mn-note">Assist: idle squads auto-defend your contested landmarks within 60 m.</p></section>';
      b.innerHTML = html;
      const foot = el('div', 'sk-foot');
      foot.innerHTML = '<button class="mbtn primary big" data-a="go"><b>OPEN THE PARK</b><small>' + esc(crewName(sk.crew)) + ' vs ' + sk.opponents.map((o) => esc(D().factions[o.faction].short)).join(', ') + '</small></button>';
      b.appendChild(foot);
      b.querySelectorAll('[data-crew]').forEach((x) => x.addEventListener('click', () => { sk.crew = x.dataset.crew; play('select'); render(); }));
      b.querySelectorAll('[data-map]').forEach((x) => x.addEventListener('click', () => { sk.map = x.dataset.map; sk.turf = D().maps[sk.map].turfTarget >= 1500 ? 1500 : 900; play('click'); render(); }));
      b.querySelectorAll('.sk-opp').forEach((row) => {
        const i = +row.dataset.i;
        row.querySelectorAll('[data-opp]').forEach((g) => g.querySelectorAll('button').forEach((x) => x.addEventListener('click', () => {
          const key = g.dataset.opp;
          sk.opponents[i][key] = x.dataset.v;
          if (key === 'faction') sk.opponents[i].personality = D().factions[x.dataset.v].aiPersonality;
          play('click'); render();
        })));
      });
      b.querySelectorAll('[data-del]').forEach((x) => x.addEventListener('click', () => { sk.opponents.splice(+x.dataset.del, 1); play('click'); render(); }));
      const add = b.querySelector('[data-a="add"]');
      if (add) add.addEventListener('click', () => {
        const used = [sk.crew].concat(sk.opponents.map((o) => o.faction));
        const f = D().factionOrder.find((k) => used.indexOf(k) < 0);
        sk.opponents.push({ faction: f, personality: D().factions[f].aiPersonality, difficulty: 'regular' });
        play('click'); render();
      });
      b.querySelectorAll('[data-seg]').forEach((g) => g.querySelectorAll('button').forEach((x) => x.addEventListener('click', () => {
        const k = g.dataset.seg, v = x.dataset.v;
        sk[k] = k === 'phase' || k === 'turf' ? +v : k === 'assist' ? v === 'true' : v;
        play('click'); render();
      })));
      b.querySelector('[data-a="go"]').addEventListener('click', () => {
        play('click');
        save.data.skirmish = sk; save.write();
        const cb = settings.get('colorblind');
        const col = (k) => (cb && U.CB_COLORS && U.CB_COLORS[k]) || undefined;
        startGame({
          mapId: sk.map, seed: seedNow(), events: sk.events, turfTarget: sk.turf, startClock: sk.phase,
          players: [{ faction: sk.crew, ai: false, assist: !!sk.assist, color: col(sk.crew) }].concat(sk.opponents.map((o) => ({ faction: o.faction, ai: { personality: o.personality, difficulty: o.difficulty }, color: col(o.faction) }))),
        }, { kind: 'skirmish' });
      });
    };
    render();
    s.appendChild(b);
    setScreen(s, 'skirmish');
  };

  function dailySetup() {
    const date = todayStr();
    const seed = SQ.util ? SQ.util.hash('daily:' + date) : 1;
    const rng = SQ.util ? SQ.util.mulberry32(seed) : Math.random;
    const order = D().factionOrder;
    const me = order[Math.floor(rng() * order.length)];
    const others = order.filter((k) => k !== me);
    const them = others[Math.floor(rng() * others.length)];
    const mods = D().dailyModifiers;
    const mod = mods[Math.floor(rng() * mods.length)];
    const map = ['whole', 'whole', 'north', 'south'][Math.floor(rng() * 4)];
    return { date, seed, me, them, mod, map, personality: D().factions[them].aiPersonality };
  }
  M.showDaily = function () {
    const d = dailySetup();
    const best = save.data.daily[d.date];
    const s = el('div', 'mn-page mn-daily');
    s.appendChild(header('Daily Park', () => M.showTitle()));
    const b = el('div', 'dl-body');
    b.innerHTML =
      '<div class="dl-date">' + esc(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })) + '</div>' +
      '<div class="dl-mod"><span class="dl-k">Today\'s modifier</span><b>' + esc(d.mod.name) + '</b><p>' + esc(d.mod.text) + '</p></div>' +
      '<div class="dl-vs"><span class="crew-tag" style="--c:' + color(d.me) + '">' + esc(crewName(d.me)) + '</span><i>vs</i><span class="crew-tag" style="--c:' + color(d.them) + '">' + esc(crewName(d.them)) + '</span></div>' +
      '<p class="mn-note">' + esc(D().maps[d.map].name) + ' · Regular ' + esc((T().personalities[d.personality] || {}).name) + ' · same seed and events for everyone today.</p>' +
      '<div class="dl-best">' + (best !== undefined ? 'Your best margin today: <b>+' + best + ' Turf</b>' : 'No result yet today. Win by as much as you can.') + '</div>' +
      '<button class="mbtn primary big" data-a="go"><b>PLAY TODAY\'S PARK</b></button>';
    b.querySelector('[data-a="go"]').addEventListener('click', () => { play('click'); M.playDaily(); });
    s.appendChild(b);
    setScreen(s, 'daily');
  };
  M.playDaily = function () {
    const d = dailySetup();
    const modifiers = Object.assign({}, d.mod.mods, d.mod.director ? { director: d.mod.director } : {}, { daily: d.mod.id });
    const cb = settings.get('colorblind');
    const col = (k) => (cb && U.CB_COLORS && U.CB_COLORS[k]) || undefined;
    startGame({ mapId: d.map, seed: d.seed, modifiers, players: [
      { faction: d.me, ai: false, assist: !!settings.get('assist'), color: col(d.me) },
      { faction: d.them, ai: { personality: d.personality, difficulty: 'regular' }, color: col(d.them) },
    ] }, { kind: 'daily', date: d.date });
  };

  // =========================================================================================
  // Options
  // =========================================================================================
  M.openOptions = function () {
    const node = el('div', 'mn-sheet mn-options');
    const render = () => {
      const s = settings.all();
      const v = s.volumes || DEFAULTS.volumes;
      node.innerHTML =
        '<div class="sh-head"><h2>Options</h2><button class="mn-x" data-close aria-label="Close">✕</button></div><div class="sh-body">' +
        '<section><div class="mn-label">Play</div>' +
        row('Game speed', seg('speed', [[0.75, '0.75×'], [1, '1×'], [1.25, '1.25×']], s.speed)) +
        row('Assist mode', toggle('assist', s.assist), 'Idle squads auto-defend contested landmarks within 60 m (new matches).') +
        row('Coach tips', toggle('tips', s.tips), 'Context tips like "squares beat circles". Each shows at most twice.') +
        row('Camera nudge', toggle('nudge', s.nudge), 'Ease toward the biggest fight when you leave the camera alone.') +
        '</section><section><div class="mn-label">Accessibility</div>' +
        row('Colorblind-safe colors', toggle('colorblind', s.colorblind), 'Okabe–Ito crew colors plus stripes and dots. Shapes always carry the meaning.') +
        row('Text size', seg('textSize', [['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']], s.textSize)) +
        row('Speech bubbles', seg('bubbles', [['on', 'On'], ['text', 'Text only'], ['off', 'Off']], s.bubbles)) +
        row('Reduced motion', toggle('reducedMotion', s.reducedMotion), 'No shake, slow-motion or confetti.') +
        row('Left-handed layout', toggle('leftHanded', s.leftHanded), 'Mirrors the bottom row.') +
        row('Captions', toggle('captions', s.captions), 'Show event sounds as text.') +
        row('Vibration', toggle('haptics', s.haptics)) +
        '</section><section><div class="mn-label">Display</div>' +
        row('Minimap', seg('minimap', [['null', 'Auto'], ['true', 'On'], ['false', 'Off']], String(s.minimap))) +
        row('Graphics', seg('quality', [['auto', 'Auto'], ['low', 'Low'], ['med', 'Phone'], ['high', 'High']], s.quality), 'Takes effect on the next load if the renderer cannot switch live.') +
        '</section><section><div class="mn-label">Sound</div>' +
        slider('Master', 'master', v.master) + slider('Effects', 'sfx', v.sfx) + slider('Music', 'music', v.music) + slider('Park ambience', 'ambience', v.ambience) +
        row('Mute', toggle('muted', s.muted)) +
        '</section><section><div class="mn-label">Progress</div>' +
        row('Unlock all crews and missions', toggle('unlockAll', s.unlockAll)) +
        '<button class="mbtn small warn" data-a="reset">Reset campaign progress</button>' +
        '</section></div>';
      node.querySelectorAll('[data-seg]').forEach((g) => g.querySelectorAll('button').forEach((x) => x.addEventListener('click', () => {
        const k = g.dataset.seg; let val = x.dataset.v;
        if (k === 'speed') val = +val;
        if (k === 'minimap') val = val === 'null' ? null : val === 'true';
        settings.set(k, val);
        if (k === 'minimap' && SQ.hud && SQ.hud.setMinimap && SQ.hud.match) SQ.hud.setMinimap(val === null ? window.innerWidth >= 900 : val, true);
        play('click'); render();
      })));
      node.querySelectorAll('[data-tog]').forEach((x) => x.addEventListener('click', () => { const k = x.dataset.tog; settings.set(k, !settings.get(k)); play('click'); render(); }));
      node.querySelectorAll('input[type=range]').forEach((x) => x.addEventListener('input', () => {
        const vol = Object.assign({}, settings.get('volumes'));
        vol[x.dataset.vol] = +x.value / 100;
        settings.set('volumes', vol, true);
      }));
      node.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => wrap && wrap._close()));
      const rs = node.querySelector('[data-a="reset"]');
      rs.addEventListener('click', () => {
        if (rs.dataset.armed) { save.reset(); play('deny'); rs.textContent = 'Progress reset'; rs.disabled = true; return; }
        rs.dataset.armed = '1'; rs.textContent = 'Tap again to erase all stars';
      });
    };
    function row(label, ctrl, note) { return '<div class="op-row"><div class="op-l"><b>' + esc(label) + '</b>' + (note ? '<small>' + esc(note) + '</small>' : '') + '</div>' + ctrl + '</div>'; }
    function toggle(k, on) { return '<button class="tog' + (on ? ' on' : '') + '" data-tog="' + k + '" role="switch" aria-checked="' + !!on + '"><i></i></button>'; }
    function slider(label, k, val) { return '<div class="op-row"><div class="op-l"><b>' + esc(label) + '</b></div><input type="range" min="0" max="100" value="' + Math.round((val === undefined ? 0.8 : val) * 100) + '" data-vol="' + k + '" aria-label="' + esc(label) + ' volume"></div>'; }
    render();
    const wrap = openOverlay(node, () => { if (M.kind === 'title') M.showTitle(); });
  };

  // =========================================================================================
  // Field Guide
  // =========================================================================================
  M.openFieldGuide = function (tab) {
    const node = el('div', 'mn-sheet mn-guide');
    let cur = tab || 'crews';
    const tabs = [['crews', 'Crews'], ['counters', 'Counters'], ['landmarks', 'Landmarks'], ['events', 'Events'], ['setups', 'Setups']];
    const render = () => {
      node.innerHTML = '<div class="sh-head"><h2>Field Guide</h2><button class="mn-x" data-close aria-label="Close">✕</button></div>' +
        '<div class="fg-tabs">' + tabs.map((t) => '<button class="' + (t[0] === cur ? 'on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
        '<div class="sh-body fg-body">' + guideTab(cur) + '</div>';
      node.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { cur = b.dataset.tab; play('click'); render(); }));
      node.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => wrap && wrap._close()));
    };
    render();
    const wrap = openOverlay(node);
  };
  function triv(lines) { return lines && lines.length ? '<div class="fg-triv">' + lines.map((l) => '<p>' + esc(l) + '</p>').join('') + '</div>' : ''; }
  function guideTab(tab) {
    const FG = T().fieldGuide;
    if (tab === 'crews') {
      return D().factionOrder.map((k) => {
        const f = D().factions[k], u = D().units[k], c = color(k);
        return '<article class="fg-crew" style="--c:' + c + '"><header><span class="fg-sw"></span><div><b>' + esc(f.name) + '</b><small>' + esc(f.tagline) + '</small></div></header>' +
          '<p><b>' + esc(f.passive.name) + ':</b> ' + esc(f.passive.text) + '</p>' +
          '<p><b>Crew Call · ' + esc(f.crewCall.name) + ':</b> ' + esc(f.crewCall.text) + '</p>' +
          '<div class="fg-units">' + ['crowd', 'talker', 'heavy'].map((cls) => {
            const t = u[cls];
            return '<div class="fg-unit">' + glyph(cls, c, 30) + '<div><b>' + esc(t.name) + '</b><span class="fg-stats">' + t.cost + (t.perRecruit > 1 ? ' per pair' : '') + ' · Composure ' + t.hp + ' · Sway ' + t.sway + ' · Range ' + t.range + ' m · ' + t.speed + ' m/s</span>' +
              '<span class="fg-w">Beats ' + glyph(D().beats[cls], '#2f7a46', 14) + ' · Weak to ' + glyph(D().weakTo[cls], '#b0342b', 14) + '</span><p>' + esc(t.blurb) + '</p>' + triv(FG.units[k + '.' + cls]) + '</div></div>';
          }).join('') + '</div></article>';
      }).join('');
    }
    if (tab === 'counters') {
      return '<div class="fg-tri">' + triangleSVG() + '</div>' +
        '<div class="fg-rules"><p>' + glyph('crowd', '#163a2b', 20) + ' <b>Crowd beats Talker.</b> You can\'t monologue at a mob.</p>' +
        '<p>' + glyph('talker', '#163a2b', 20) + ' <b>Talker beats Heavy.</b> Argue the big guy down from range.</p>' +
        '<p>' + glyph('heavy', '#163a2b', 20) + ' <b>Heavy beats Crowd.</b> Splash scatters crowds.</p>' +
        '<p class="mn-note">The winning matchup deals ×1.5 Sway, the losing one ×0.7. With units selected, enemies show a green ▲ (good fight) or a red ▼ (walk away). Hover or long-press an enemy for "Weak to".</p>' +
        '<p class="mn-note">Nobody gets hurt: units have Composure, not HP. At zero they are Over It and walk to the nearest gate. You get 25% of their cost back as a Grudge.</p></div>';
    }
    if (tab === 'landmarks') {
      const list = D().landmarks.map((l) => {
        const ph = l.phase || {};
        const pnote = Object.keys(ph).map((p) => (D().phases.find((x) => x.id === p) || {}).name + ': ' + Object.keys(ph[p]).map((k) => k === 'aura' ? 'creepy aura' : k + ' ' + (k === 'turf' ? ph[p][k] + '/s' : '×' + ph[p][k])).join(', ')).join(' · ');
        return '<article class="fg-lm"><span class="fg-ic">' + (U.lmIcon ? U.lmIcon(l.id, 30) : '') + '</span><div><b>' + esc(l.name) + '</b> <small>' + esc(l.nick) + (l.extra ? ' · North/South/Random maps' : '') + '</small>' +
          '<span class="fg-stats">+' + l.clout + ' Clout/s · +' + l.turf + ' Turf/s' + (pnote ? ' · ' + esc(pnote) : '') + '</span><p>' + esc(l.perk.text) + '</p>' + triv(FG.landmarks[l.id]) + '</div></article>';
      }).join('');
      const extra = '<article class="fg-lm"><span class="fg-ic">' + (U.lmIcon ? U.lmIcon('home', 30) : '') + '</span><div><b>Park House</b> <small>The Only Bathroom</small><p>Neutral. Units within 10 m of its north door heal 4/s. The AI is weirdly obsessed with it.</p>' + triv(FG.landmarks.parkHouse) + '</div></article>' +
        '<article class="fg-lm"><span class="fg-ic">' + (U.lmIcon ? U.lmIcon('dosa', 30) : '') + '</span><div><b>NY Dosas cart</b><p>Pay 50 Clout with units within 20 m: they get +20% Sway for 20 s.</p>' + triv(FG.landmarks.dosa) + '</div></article>';
      return '<div class="fg-map">' + parkSVG(D().landmarks.filter((l) => !l.extra).map((l, i) => ({ id: l.id, x: l.x, z: l.z, label: String(i + 1), cls: 'un lmpin' })), { noTrees: true }) + '</div>' + list + extra;
    }
    if (tab === 'events') {
      return Object.keys(D().events).map((k) => {
        const e = D().events[k];
        return '<article class="fg-ev"><span class="fg-ei">' + esc(e.icon) + '</span><div><b>' + esc(e.name) + '</b> <small>' + e.duration + ' s' + (e.campaignOnly ? ' · campaign' : '') + '</small><p>' + esc(U.fill ? U.fill(e.start, { PLACE: 'a landmark' }) : e.start) + '</p>' + triv(FG.events[k]) + '</div></article>';
      }).join('') + '<p class="mn-note">Events are announced 8 s ahead with a toast and a marker. Tap "Go there" to look.</p>';
    }
    if (tab === 'setups') {
      return '<p class="mn-note">Every landmark has 2 build pads (Chess Plaza 4, Home Spots 3). Building takes 6 s. Setups have no HP and can\'t be attacked - they flip to whoever captures the landmark. A well-built landmark is a jackpot.</p>' +
        Object.keys(D().setups).map((k) => {
          const S = D().setups[k];
          return '<article class="fg-ev"><span class="fg-ei">' + ((U.SETUP_ICON && U.SETUP_ICON[k]) || '◆') + '</span><div><b>' + esc(S.name) + '</b> <small>' + S.cost + ' Clout' + (S.faction ? ' · ' + esc(D().factions[S.faction].name) + ' only' : '') + '</small><p>' + esc(S.text) + '</p></div></article>';
        }).join('');
    }
    return '';
  }
  function triangleSVG() {
    const g = (cls, x, y) => '<g transform="translate(' + (x - 22) + ' ' + (y - 22) + ')">' + glyph(cls, '#163a2b', 44).replace('<svg', '<svg x="0" y="0"') + '</g>';
    return '<svg viewBox="0 0 300 250" class="tri-svg"><defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#2f7a46"/></marker></defs>' +
      '<path d="M150 58 L228 190" class="tri-a" marker-end="url(#arr)"/><path d="M212 210 L88 210" class="tri-a" marker-end="url(#arr)"/><path d="M72 190 L140 64" class="tri-a" marker-end="url(#arr)"/>' +
      g('crowd', 150, 36) + g('talker', 248, 214) + g('heavy', 52, 214) +
      '<text x="210" y="112" class="tri-t">beats</text><text x="150" y="236" class="tri-t" text-anchor="middle">beats</text><text x="62" y="112" class="tri-t">beats</text></svg>';
  }

  // =========================================================================================
  // Match tracker (Park Report extras) and stars
  // =========================================================================================
  let tracker = null;
  function trackStart(m) {
    if (!m) return;
    tracker = { match: m, player: m.state.player, squadDmg: {}, squadSent: {}, lastHit: new Map(), lostLms: {}, stoleChess: false, rallied: 0 };
  }
  function trackHit(p) {
    if (!tracker || !p) return;
    const s = tracker.match.state;
    if (p.from >= 0 && p.faction === tracker.player && SQ.World) {
      const i = SQ.World.unitIndex(s, p.from);
      if (i >= 0) {
        const sq = s.units.squad[i];
        tracker.squadDmg[sq] = (tracker.squadDmg[sq] || 0) + (p.dmg || 0);
        tracker.lastHit.set(p.to, sq);
        if (tracker.lastHit.size > 600) tracker.lastHit.delete(tracker.lastHit.keys().next().value);
      }
    }
  }
  function trackOverIt(p) {
    if (!tracker || !p || p.by !== tracker.player) return;
    const sq = tracker.lastHit.get(p.unit);
    if (sq !== undefined) tracker.squadSent[sq] = (tracker.squadSent[sq] || 0) + 1;
  }
  function trackCapture(p) {
    if (!tracker || !p) return;
    if (p.from === tracker.player) tracker.lostLms[p.lm] = true;
    if (p.to === tracker.player && (p.setups || []).some((x) => x.kind === 'chessTable' && x.from >= 0 && x.from !== tracker.player)) tracker.stoleChess = true;
  }

  function computeStars(mission, payload, match) {
    // the campaign is the source of truth (its result is ready: it handles victory on match.bus first)
    let cr = null;
    try { cr = SQ.Campaign && typeof SQ.Campaign.result === 'function' ? SQ.Campaign.result(match) : null; } catch (e) { cr = null; }
    if (cr && Array.isArray(cr.stars) && cr.stars.length === 3) return cr.stars.map(Boolean);
    const camp = (payload && payload.stars) || (match && match.campaign && match.campaign.stars) ||
      (SQ.Campaign && typeof SQ.Campaign.stars === 'function' ? (() => { try { return SQ.Campaign.stars(match); } catch (e) { return null; } })() : null);
    if (Array.isArray(camp) && camp.length === 3) return camp.map((x) => !!(x && (x.ok !== undefined ? x.ok : x)));
    const s = match.state, me = s.factions[s.player];
    const won = !!payload.playerWon;
    return mission.stars.map((st) => {
      if (st.id === 'win') return won;
      if (st.id === 'time') return won && s.t <= (st.under || 1e9);
      if (!won || !st.check) return false;
      const c = st.check;
      if (c.type === 'shoo') return (me.stats.shooed || 0) >= c.count;
      if (c.type === 'neverLose') return !(tracker && tracker.lostLms[c.lm]);
      if (c.type === 'captureWithSetup') return !!(tracker && tracker.stoleChess);
      if (c.type === 'crewHits') return ((me.stats.crewHitsBest || {})[c.kind] || 0) >= c.count;
      if (c.type === 'holdAtEnd') { const lm = s.lmById[c.lm]; return !!(lm && lm.owner === s.player && s.t - (lm.heldSince || 0) >= c.seconds); }
      return false;
    });
  }

  function onVictory(p) {
    const m = SQ.game && SQ.game.match;
    if (!m || !p) return;
    const s = m.state;
    const report = { payload: p, match: m, earned: null, newStars: [], prevStars: null, mission: null, losses: 0, dailyBest: null, unlocked: [] };
    if (s.missionId) {
      const mission = D().missionById[s.missionId];
      const rec = save.mission(mission.id);
      const stars = computeStars(mission, p, m);
      report.prevStars = rec.stars.slice();
      rec.stars = rec.stars.map((x, k) => x || stars[k]);
      report.earned = stars;
      report.newStars = stars.map((x, k) => x && !report.prevStars[k]);
      report.mission = mission;
      if (p.playerWon) {
        rec.losses = 0;
        if (!rec.best || s.t < rec.best) rec.best = Math.round(s.t);
        const un = mission.unlock || {};
        for (const f of un.factions || []) if (save.data.unlocked.factions.indexOf(f) < 0) { save.data.unlocked.factions.push(f); report.unlocked.push(f); }
        for (const c of un.cosmetics || []) if (save.data.cosmetics.indexOf(c) < 0) save.data.cosmetics.push(c);
      } else rec.losses = (rec.losses || 0) + 1;
      report.losses = rec.losses;
      save.write();
    } else if (M.lastMeta && M.lastMeta.kind === 'daily' && s.player >= 0) {
      const me = s.factions[s.player];
      const best = Math.max.apply(null, s.factions.filter((f) => f.idx !== s.player).map((f) => f.turf));
      const margin = Math.round(me.turf - best);
      if (p.playerWon && (save.data.daily[M.lastMeta.date] === undefined || margin > save.data.daily[M.lastMeta.date])) save.data.daily[M.lastMeta.date] = margin;
      report.dailyBest = save.data.daily[M.lastMeta.date];
      save.write();
    }
    report.tracker = tracker;
    const delay = settings.get('reducedMotion') ? 1400 : 2800;
    setTimeout(() => { if (SQ.game && SQ.game.match === m) M.showReport(report); }, delay);
  }

  // =========================================================================================
  // Park Report
  // =========================================================================================
  M.showReport = function (rep) {
    ensureRoot();
    if (rep && rep.winner !== undefined && !rep.payload) rep = { payload: rep, match: SQ.game && SQ.game.match };
    const p = rep.payload || {};
    const stats = p.stats || (rep.match && rep.match.summary && rep.match.summary()) || {};
    const facs = stats.factions || [];
    const meIdx = stats.player !== undefined ? stats.player : (rep.match ? rep.match.state.player : 0);
    const me = facs[meIdx] || facs[0] || { stats: {} };
    const won = !!p.playerWon;
    const winner = facs[p.winner];
    const ms = me.stats || {};
    const s = el('div', 'mn-page mn-report' + (won ? ' won' : ' lost'));
    s.style.setProperty('--c', color(me.key));
    const mission = rep.mission || (stats.missionId && D().missionById[stats.missionId]);
    const headline = won ? (mission ? 'MISSION COMPLETE' : U.fill ? U.fill(T().announcer.victory, { CREW: (me.name || '').toUpperCase() }) : 'YOU WIN') : (winner ? (winner.name || '').toUpperCase() + ' TAKE THE SQUARE' : 'PARK CLOSED');
    const sub = won ? reasonLine(p.reason, stats) : T().announcer.defeat;
    const fmt = SQ.util ? SQ.util.fmtClock : (x) => Math.round(x) + 's';
    // comic stats
    const reasons = ms.reasons || {};
    const topReason = Object.keys(reasons).sort((a, b) => reasons[b] - reasons[a])[0];
    const longest = ms.longest && ms.longest.lm ? (D().landmarkById[ms.longest.lm] || {}).name + ' ' + fmt(ms.longest.t) : '—';
    const tiles = [
      ['Units who left the park', ms.lost || 0, topReason ? 'most common reason: "' + topReason + '"' : 'nobody left. Respect.'],
      ['Sent home', ms.sentHome || 0, 'rivals who went for coffee'],
      ['Longest held', longest, 'one landmark, no interruptions'],
      ['Landmarks flipped', ms.captures || 0, (ms.setupsStolen ? ms.setupsStolen + ' Setups stolen' : 'no Setups stolen')],
      ['Peak income', (Math.round((ms.peakIncome || 0) * 10) / 10) + '/s', 'Clout earned: ' + Math.round(ms.earned || 0)],
      ['Crew Calls', ms.crewCalls || 0, bestCrew(ms)],
      ['Squirrel heists', ms.heists || 0, (ms.shooed || 0) + ' squirrels shooed'],
      ['Dosas bought', ms.dosas || 0, ms.dosas ? 'worth it' : 'the line was too long'],
    ];
    const mvp = mvpLine(rep.tracker);
    let tip = pickTip(me, stats, won, rep.tracker);
    if (won && mission) {
      const nx = D().missions[mission.n];
      tip = nx ? 'Next up, ' + nx.clock + ': ' + nx.title + ' - ' + nx.teaches : 'You played the whole day. Try a Hard AI in Skirmish, or today\'s Daily Park.';
    }
    let html = '<div class="rp-ribbon"><div class="rp-k">PARK REPORT · ' + esc(fmt(stats.t || 0)) + ' played</div><h2>' + esc(headline) + '</h2><p>' + esc(sub) + '</p></div>';
    if (mission) {
      html += '<div class="rp-stars">' + mission.stars.map((x, k) => {
        const on = rep.earned ? rep.earned[k] : false;
        const nw = rep.newStars && rep.newStars[k];
        return '<div class="rp-star' + (on ? ' on' : '') + (nw ? ' new' : '') + '" style="--k:' + k + '"><i>★</i><span>' + esc(x.text) + '</span></div>';
      }).join('') + '</div>';
      if (won && mission.outro) html += '<p class="rp-outro">' + gt(mission.outro) + '</p>';
      if (rep.unlocked && rep.unlocked.length) html += '<p class="rp-unlock">Unlocked: ' + rep.unlocked.map((k) => '<span class="crew-tag" style="--c:' + color(k) + '">' + esc(crewName(k)) + '</span>').join(' ') + '</p>';
    }
    if (rep.dailyBest !== null && rep.dailyBest !== undefined) html += '<p class="rp-unlock">Daily Park best margin today: <b>+' + rep.dailyBest + ' Turf</b></p>';
    html += '<div class="rp-grid"><section class="rp-chart"><div class="mn-label">Turf</div>' + turfChart(stats) +
      '<div class="rp-legend">' + facs.map((f) => '<span style="--c:' + color(f.key) + '"><i></i>' + esc(f.idx === meIdx ? 'You' : f.name) + ' <b>' + f.turf + '</b></span>').join('') + '</div></section>' +
      '<section class="rp-mvp"><div class="mn-label">MVP</div><b>' + esc(mvp.title) + '</b><p>' + esc(mvp.text) + '</p></section>' +
      '<section class="rp-tip"><div class="mn-label">Next time</div><p>' + gt(tip) + '</p></section></div>';
    html += '<div class="rp-tiles">' + tiles.map((t) => '<div class="rp-tile"><span>' + esc(t[0]) + '</span><b>' + esc(t[1]) + '</b><small>' + esc(t[2]) + '</small></div>').join('') + '</div>';
    const chillRec = mission ? save.mission(mission.id) : null;
    const canChill = mission && (mission.opponents.some((o) => STEP.indexOf(stepDown(o.difficulty, chillRec.chill)) > 0) || !(chillRec.chill || (mission.rules && mission.rules.assist)));
    if (mission && !won && !mission.rules.cannotLose && rep.losses >= ((D().campaignRules || {}).chillOfferAfterLosses || 2) && canChill) {
      html += '<div class="rp-chill"><b>Chill it down?</b><p>One difficulty step easier, and Assist mode on. You can undo it from the briefing.</p><button class="mbtn primary" data-a="chill">Chill it down</button></div>';
    }
    if (mission && mission.finale && won) html += '<div class="rp-finale"><b>Same time tomorrow?</b><p>Everyone ends up on the fountain rim, all the colors mixed.</p></div>';
    const next = mission && won ? D().missions[mission.n] : null;
    html += '<div class="rp-btns">' +
      (next && missionUnlocked(next) ? '<button class="mbtn primary big" data-a="next"><b>NEXT: ' + esc(next.title) + '</b><small>Mission ' + next.n + ' · ' + esc(next.clock) + '</small></button>' : '') +
      '<button class="mbtn' + (next ? '' : ' primary big') + '" data-a="again"><b>' + (won ? 'Play again' : 'Try again') + '</b></button>' +
      (mission ? '<button class="mbtn" data-a="campaign"><b>Campaign</b></button>' : '') +
      '<button class="mbtn" data-a="menu"><b>Main menu</b></button></div>';
    s.innerHTML = '<div class="rp-scroll">' + html + '</div>';
    s.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
      play('click');
      const a = b.dataset.a;
      if (a === 'next') { quitQuiet(); M.showBriefing(next.id); }
      else if (a === 'again') M.restart();
      else if (a === 'campaign') { quitQuiet(); M.showCampaign(); }
      else if (a === 'menu') { quitQuiet(); M.showTitle(); }
      else if (a === 'chill') { const r = save.mission(mission.id); r.chill = (r.chill || 0) + 1; r.losses = 0; save.write(); M.startMission(mission.id, M.lastMeta && M.lastMeta.crew); }
    }));
    setScreen(s, 'report');
  };
  function quitQuiet() {
    if (SQ.game && SQ.game.match && typeof SQ.game.quit === 'function') SQ.game.quit(true);
    if (SQ.tutorial && SQ.tutorial.setMatch) SQ.tutorial.setMatch(null);
  }
  function reasonLine(r, stats) {
    return { turf: 'First to ' + ((stats && stats.factions && SQ.game && SQ.game.match && SQ.game.match.state.turfTarget) || 'the') + ' Turf.', clock: 'Most Turf when the park closed at 1 AM.', suddenDeath: 'Won the sudden death at the Fountain.', elimination: 'Last crew in the park.', mission: 'The park is yours. For now.' }[r] || 'The park is yours.';
  }
  function bestCrew(ms) {
    const b = ms.crewHitsBest || {};
    const k = Object.keys(b).sort((x, y) => b[y] - b[x])[0];
    return k ? 'best one caught ' + b[k] : 'the meter just sat there';
  }
  function mvpLine(tr) {
    if (!tr) return { title: 'The Reserve', text: 'Everyone pitched in.' };
    const sqs = Object.keys(tr.squadDmg).map(Number);
    if (!sqs.length) return { title: 'Nobody, really', text: 'Your crew mostly enjoyed the park.' };
    sqs.sort((a, b) => (tr.squadSent[b] || 0) * 60 + tr.squadDmg[b] - ((tr.squadSent[a] || 0) * 60 + tr.squadDmg[a]));
    const k = sqs[0];
    const name = k === 0 ? 'The Reserve' : k < 0 ? 'The Regulars' : 'Squad ' + k;
    return { title: name, text: Math.round(tr.squadDmg[k]) + ' Sway dealt, ' + (tr.squadSent[k] || 0) + ' rivals sent home.' };
  }
  function pickTip(me, stats, won, tr) {
    const tips = T().tips, ms = me.stats || {};
    const G = { crowd: '●', talker: '▲', heavy: '■' };
    if (won) return tips.won;
    const pairs = ms.lostPairs || {};
    const worst = Object.keys(pairs).sort((a, b) => pairs[b] - pairs[a])[0];
    if (worst && pairs[worst] >= 4) {
      const v = worst.split('<')[0], k = worst.split('<')[1];
      if (D().beats[k] === v) return (U.fill || ((x) => x))(tips.lostToCounter, { CLS: G[v], WEAK: G[k], BEATS: G[D().weakTo[k]] });
    }
    if ((ms.peakIncome || 0) < 5) return tips.lowIncome;
    if (!ms.built) return tips.noSetups;
    if ((ms.peakLandmarks || 0) <= 3) return tips.turtled;
    const fac = SQ.game && SQ.game.match && SQ.game.match.state.factions[me.idx];
    if (fac && fac.crew >= 100 && !ms.crewCalls) return tips.noCrewCall;
    if ((stats.clock || 0) > 420 && !((ms.held || {}).arch > 60)) return tips.ignoredNight;
    if (tr && !tr.rallied) return tips.neverRallied;
    return tips.overextended;
  }
  function turfChart(stats) {
    const hist = (stats.history || []).filter((h) => h && h.turf);
    const facs = stats.factions || [];
    const W = 600, Hh = 210, pad = 28;
    if (hist.length < 2) return '<svg class="rp-svg" viewBox="0 0 ' + W + ' ' + Hh + '"><text x="300" y="110" text-anchor="middle" class="ch-t">Too short for a chart.</text></svg>';
    const t0 = hist[0].t, t1 = hist[hist.length - 1].t || 1;
    const target = (SQ.game && SQ.game.match && SQ.game.match.state.turfTarget) || 1500;
    let max = 0; for (const h of hist) for (const v of h.turf) max = Math.max(max, v);
    const ymax = Math.max(100, target < 50000 ? Math.max(max, target) : max) * 1.05;
    const X = (t) => pad + (t - t0) / Math.max(1, t1 - t0) * (W - pad - 8);
    const Y = (v) => Hh - pad - v / ymax * (Hh - pad - 10);
    let svg = '<svg class="rp-svg" viewBox="0 0 ' + W + ' ' + Hh + '" preserveAspectRatio="none">';
    // phase bands from the match clock
    const P = D().phases;
    for (let i = 0; i < hist.length - 1; i++) {
      const ph = P.find((q) => hist[i].clock >= q.start && hist[i].clock < q.end) || P[0];
      svg += '<rect x="' + X(hist[i].t).toFixed(1) + '" y="10" width="' + (X(hist[i + 1].t) - X(hist[i].t) + 0.5).toFixed(1) + '" height="' + (Hh - pad - 10) + '" class="band-' + ph.id + '"/>';
    }
    if (target < 50000) svg += '<line x1="' + pad + '" x2="' + (W - 8) + '" y1="' + Y(target) + '" y2="' + Y(target) + '" class="ch-target"/><text x="' + (pad + 4) + '" y="' + (Y(target) - 4) + '" class="ch-t">' + target + '</text>';
    svg += '<line x1="' + pad + '" x2="' + (W - 8) + '" y1="' + (Hh - pad) + '" y2="' + (Hh - pad) + '" class="ch-axis"/>';
    facs.forEach((f, k) => {
      const pts = hist.map((h) => X(h.t).toFixed(1) + ',' + Y(h.turf[k] || 0).toFixed(1)).join(' ');
      svg += '<polyline points="' + pts + '" class="ch-line' + (k === stats.player ? ' me' : '') + '" style="stroke:' + color(f.key) + '"/>';
    });
    const fmt = SQ.util ? SQ.util.fmtClock : (x) => x;
    svg += '<text x="' + pad + '" y="' + (Hh - 8) + '" class="ch-t">0:00</text><text x="' + (W - 8) + '" y="' + (Hh - 8) + '" text-anchor="end" class="ch-t">' + fmt(t1) + '</text></svg>';
    return svg;
  }

  if (SQ.bus && !M._subs) subscribe();

  M.stars = starsOf;
  M.unlockedCrews = unlockedCrews;
})(window.SQ = window.SQ || {});
