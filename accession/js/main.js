// ACCESSION — boot and wiring (BUILD.md §2): the state, the active board view, the
// interface and input. Only main.js and input.js reach step(), and only through act().
'use strict';
const Main = (() => {
  const params = new URLSearchParams(location.search);
  // A link ending #A4 or #M11.3 picks the department and seed too, for hosts that pass only
  // a plain anchor (an Artifact page).
  const anchor = /^#([A-Za-z]+\d+)(?:\.(\d+))?$/.exec(location.hash || '');
  if (anchor && !params.has('dept')) { params.set('dept', anchor[1]); if (anchor[2]) params.set('seed', anchor[2]); }
  const store = {
    get(k, d) { try { const v = localStorage.getItem('accession.' + k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('accession.' + k, v); } catch (e) { /* settings are a convenience */ } },
  };
  const settings = {
    board: params.get('board') || store.get('board', 'topdown'), walk: store.get('walk', 'one'), zoom: store.get('zoom', '0'),
    text: store.get('text', '1'), font: store.get('font', 'book'), motion: store.get('motion', 'full'), boardNote: '',
  };
  // ui: what the view model needs from the interface (the selection, the path preview and
  // the events of your last action that took time, for the noise rings and one-turn cues).
  // last: the last step's events, whatever it took. history: the log's recent sentences.
  let state, renderer, ui = { path: null, selection: null, selectedTile: null, events: null }, walking = null, fresh = false, shown = null, last = [];
  const history = [], HISTORY = 6;

  function newVisit() {
    const seed = Number(params.get('seed')) || 1;
    if (params.get('room') === 'test') return TestRoom.create(seed);
    const acc = (params.get('dept') || 'S9').toUpperCase(), depth = Number(params.get('depth')) || 1;
    return Dept.create(seed, Packs.get(acc) ? acc : 'S9', depth);
  }

  const app = document.getElementById('app');
  const board = UI.build(app, {
    bar(act) {
      stopWalking();
      if (act === 'wait') act_({ a: 'wait' });
      else if (act === 'zoom') setZoom((renderer.zoom + 1) % renderer.zooms.length);
      else { say('Not in this build yet.'); draw(); }
    },
    openLabel() { stopWalking(); const s = Labels.strip(state); if (s) select(s.uid, true); },
    labelAction(id) { stopWalking(); if (id === 'attack' && ui.selection) attackSelected(); },
    // Closing the label keeps the selection, so tapping the exhibit again still acts (§7.1).
    closedLabel() { draw(); },
    setting(key, value) {
      stopWalking();
      settings[key] = value; store.set(key, value);
      if (key === 'board') makeView();
      applySettings(); draw();
    },
  });

  function applySettings() {
    document.documentElement.style.setProperty('--text-scale', settings.text);
    document.documentElement.dataset.text = settings.text;
    document.documentElement.dataset.font = settings.font;
    document.documentElement.dataset.motion = settings.motion;
    UI.renderSettings(settings, Views.list());
  }

  // Build the chosen board view. A view that fails, now or once it has loaded, is replaced
  // by the flat board and the settings line says why; the game state is untouched.
  function makeView() {
    if (renderer) renderer.dispose();
    renderer = Views.create(settings.board, board, (flat, note) => {
      renderer = flat; renderer.setZoom(Number(settings.zoom));
      settings.boardNote = note; say(note); applySettings(); draw();
    });
    renderer.setZoom(Number(settings.zoom));
    settings.boardNote = Views.active().note;
    if (settings.boardNote) say(settings.boardNote);
    renderer.ready.then(() => draw(), () => {});
  }
  function setZoom(i) { settings.zoom = String(i); store.set('zoom', settings.zoom); renderer.setZoom(i); draw(); }

  // The log: the newest entry shows on a phone's strip until the next action. Once the
  // death is logged, nothing else is, so the cause stays in view.
  let deathLogged = false;
  function say(s) {
    if (deathLogged) return;
    history.push(s); while (history.length > HISTORY) history.shift(); fresh = true;
    if (state && state.over) deathLogged = true;
  }

  // Everything the player does goes through here. An action from anywhere but a walk stops
  // the walk and drops the path preview; afterwards the open label is brought up to date
  // while what it names is in view (ViewModel.shows), or else closed, and the selection
  // dropped: a label shows only what sight gives, so it never follows an exhibit out of
  // sight (§7.2, §8.8).
  function act_(action, fromWalk) {
    if (!fromWalk) { stopWalking(); ui.path = null; ui.selectedTile = null; }
    // After death nothing more happens, and nothing pushes the cause out of the log.
    if (state.over) { draw(); return []; }
    fresh = false;
    const tick = state.tick, ev = Step.step(state, action);
    // The noise rings and one-turn cues are those of your last action that took time (§6.1,
    // §8.2): a step that takes none (a refusal, such as a bump into a wall, or a free read)
    // leaves them as they were, as it leaves your ring (§8.2).
    last = ev;
    if (state.tick !== tick) ui.events = ev;
    // The log's sentences (Text.log): an event about an exhibit out of view is left out
    // where its kind says so.
    const nameOf = Labels.nameOf(state), vm = ViewModel.derive(state, ui), inView = new Set(vm.actors.map(a => a.uid));
    const lines = Text.log(ev, nameOf, uid => inView.has(uid));
    if (lines.length) say(lines.join(' '));
    if (state.over && !ev.some(e => e.k === 'died' && e.who === 'you')) say('You fell.');
    if (ui.selection) {
      const l = ViewModel.shows(vm, ui.selection) ? Labels.of(state, ui.selection) : null;
      if (!l) { ui.selection = null; UI.closeLabel(); }
      else if (UI.labelShown() === ui.selection) UI.label(l);
    }
    draw();
    return ev;
  }

  function select(uid, open) {
    ui.selection = uid; ui.selectedTile = null; ui.path = null;
    const l = Labels.of(state, uid);
    if (open && l) UI.label(l);
    draw();
  }

  function attackSelected() {
    const a = Actors.byUid(state, ui.selection), you = state.actors[0];
    if (a && !a.gone && Step.adjacent(state, you, a)) act_({ a: 'attack', uid: a.uid });
  }

  // A tap: on an exhibit, examine it (a second tap on a selected adjacent exhibit attacks);
  // on yourself, wait; on a tile, walk there. With "Walk: tap twice" the first tap on a
  // tile previews the path and a second tap on the same tile goes.
  function tap(t) {
    if (walking) { stopWalking(); return; }
    if (state.over) { draw(); return; }
    const you = state.actors[0], vm = ViewModel.derive(state, ui);
    const hit = vm.actors.find(a => t.x >= a.x && t.y >= a.y && t.x < a.x + a.size && t.y < a.y + a.size);
    if (hit && hit.uid === 'you') { act_({ a: 'wait' }); return; }
    if (hit) {
      const a = Actors.byUid(state, hit.uid);
      if (ui.selection === hit.uid && Step.adjacent(state, you, a)) attackSelected();
      else select(hit.uid, true);
      return;
    }
    if (!vm.vis[t.y * vm.w + t.x]) { say('You have not seen that part of the room.'); draw(); return; }
    const path = Path.to(state, t.x, t.y);
    if (!path.length) { say('There is no way there from here.'); draw(); return; }
    // The preview leaves an open label (and so the camera) where it is, so the second tap
    // lands on the same tile; the walk closes it.
    if (settings.walk === 'two' && !(ui.selectedTile && ui.selectedTile.x === t.x && ui.selectedTile.y === t.y)) {
      ui.selectedTile = t; ui.path = path; draw(); return;
    }
    ui.selectedTile = null; ui.path = null; ui.selection = null; UI.closeLabel();
    walk(path);
  }

  // Walk a path one move at a time. Stop when anything new appears in sight, a pip or state
  // changes, the next tile is taken (a walk never turns into an attack), or an event is
  // about you: a blow, a miss, a wake, a door, a refusal.
  const STOPS = new Set(['refused', 'opened', 'hunting', 'damaged', 'missed', 'died']);
  function walk(path) {
    const seen = () => ViewModel.derive(state, {}).actors.map(a => a.uid + a.mode + a.pips).join();
    let before = seen(), i = 0;
    const stepOnce = () => {
      walking = null;
      if (i >= path.length || state.over) return;
      const here = [state.actors[0].x, state.actors[0].y], d = Path.dirTo(here, path[i]);
      if (d < 0 || Actors.at(state, path[i][0], path[i][1])) { draw(); return; }
      const ev = act_({ a: 'move', dir: d }, true);
      i++;
      const after = seen();
      if (ev.some(e => STOPS.has(e.k) || (e.k === 'status' && e.on === false && e.who === 'you')) || after !== before) return;
      before = after;
      walking = setTimeout(stepOnce, settings.motion === 'reduce' ? 0 : 70);
    };
    walking = setTimeout(stepOnce, 0);
  }
  function stopWalking() { clearTimeout(walking); walking = null; }

  // The interface first, then the board, so the board is measured at its final size; the
  // label sheet's cover is passed on so the camera keeps you and the exhibit above it.
  function draw() {
    const vm = ViewModel.derive(state, ui);
    // While a label is open the camera centres between you and its exhibit in the part of
    // the board the phone's sheet leaves clear; if both cannot fit, it keeps you in view and
    // leans as far towards the exhibit as it can (the label shows the exhibit's picture).
    const open = UI.labelShown() && vm.actors.find(a => a.uid === UI.labelShown());
    if (open) vm.camera = focus(vm.you, open, shown);
    UI.top({ hp: vm.you.hp, maxHp: vm.you.maxHp, grade: vm.you.grade, clock: vm.clock });
    UI.strip(Labels.strip(state), history, fresh);
    renderer.setInset(UI.sheetCover());
    renderer.draw(vm);
    shown = vm.camera;
  }

  // A camera centred on a tile shows half whole tiles either side of it, where half comes
  // from the clear length in tiles; vertically, room is kept above the top row for the
  // state glyphs and, in 3D, for sprites standing taller than their tile.
  function focus(you, a, last) {
    const tr = renderer.tileRect(you.x, you.y), b = board.getBoundingClientRect();
    if (!tr || !tr.rect.w) return { x: you.x, y: you.y };
    const t = tr.rect.w, d = tr.rect.h, above = Math.max(8, Math.floor(t / 3)) + (t - d);
    const half = (len, step) => Math.max(0, Math.floor((len / step - 1) / 2));
    // Beside the exhibit, if both already fit round the camera the last frame used (or else
    // round you) the board stays put, so a second tap on any of its tiles still lands on it
    // (§7.1), whichever label was open before.
    const near = Step.adjacent(state, state.actors[0], Actors.byUid(state, a.uid));
    const axis = (p, q, n, h, c) => {
      const lo = Math.min(p, q), hi = Math.max(p + 1, q + n);
      if (near && c !== undefined && lo >= c - h && hi - 1 <= c + h) return c;
      if (near && lo >= p - h && hi - 1 <= p + h) return p;
      if (hi - lo <= 2 * h + 1) { const m = (lo + hi - 1) / 2; return p <= m ? Math.floor(m) : Math.ceil(m); }
      return p < q ? p + h : p - h;
    };
    const c = last || {};
    return { x: axis(you.x, a.x, a.size, half(b.width, t), c.x), y: axis(you.y, a.y, a.size, half(b.height - UI.sheetCover() - 2 * above, d), c.y) };
  }

  // Examine (x): the nearest readable thing first, then each visible exhibit in turn.
  // Read (r): always the nearest label, never the next one.
  function nearestSeen() {
    const you = state.actors[0], s = Labels.strip(state);
    if (s) return s.uid;
    const seen = ViewModel.derive(state, {}).actors.filter(a => a.uid !== 'you')
      .map(a => ({ uid: a.uid, d: Actors.dist(Actors.byUid(state, a.uid), you.x, you.y) })).sort((p, q) => p.d - q.d);
    return seen.length ? seen[0].uid : null;
  }
  function examine() {
    stopWalking();
    const seen = ViewModel.derive(state, {}).actors.filter(a => a.uid !== 'you').map(a => a.uid), at = seen.indexOf(ui.selection);
    if (!seen.length) { say('Nothing here to examine.'); draw(); return; }
    select(ui.selection && at >= 0 && UI.labelShown() ? seen[(at + 1) % seen.length] : nearestSeen(), true);
  }
  function read() {
    stopWalking();
    const uid = nearestSeen();
    if (uid) select(uid, true); else { say('Nothing in sight to read.'); draw(); }
  }

  state = newVisit();
  makeView();
  applySettings();
  Input.attach(board, () => renderer, {
    tap, key(a) { act_(a); }, examine, read,
    blocked: () => UI.overlayOpen(),
    confirm() {
      if (ui.selectedTile && ui.path) tap(ui.selectedTile);
      else if (ui.selection) attackSelected();
    },
    later() { say('Not in this build yet.'); draw(); },
    escape() { stopWalking(); UI.closeOverlays(); ui.selection = null; ui.path = null; ui.selectedTile = null; UI.closeLabel(); draw(); },
  });
  // Any change to the board's size redraws it, not only a window resize: the strip grows
  // and shrinks with what it says.
  let pending = 0;
  const redraw = () => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; draw(); }); };
  window.addEventListener('resize', redraw);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(redraw).observe(board);
  say(`Room ${state.dept.rooms ? state.dept.rooms.find(r => r.role === 'intro').number : ''}. Tap a tile to walk; tap an exhibit to read its label.`);
  draw();
  window.ACCESSION = {
    get state() { return state; }, act: act_, tap, vm: () => ViewModel.derive(state, ui), get renderer() { return renderer; },
    get events() { return last.slice(); }, stops: [...STOPS],
    views: Views, setZoom, busy: () => !!walking, get history() { return history.slice(); },
    setting: (k, v) => { settings[k] = v; if (k === 'board') makeView(); applySettings(); draw(); },
  };
  return {};
})();
