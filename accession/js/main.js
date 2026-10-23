// ACCESSION — boot and wiring (BUILD.md §2): the state, the active board view, the
// interface and input. Only main.js and input.js reach step(), and only through act().
'use strict';
const Main = (() => {
  const params = new URLSearchParams(location.search);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('accession.' + k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('accession.' + k, v); } catch (e) { /* settings are a convenience */ } },
  };
  const settings = {
    board: params.get('board') || store.get('board', 'topdown'), walk: store.get('walk', 'one'), zoom: store.get('zoom', '0'),
    text: store.get('text', '1'), font: store.get('font', 'book'), motion: store.get('motion', 'full'), boardNote: '',
  };
  // ui: what the view model needs from the interface (the selection, the path preview and
  // the last step's events, for one-turn cues). history: the log's recent sentences.
  let state, renderer, ui = { path: null, selection: null, selectedTile: null, events: null }, walking = null, fresh = false;
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

  // The log: the newest sentence shows on a phone's strip until the next action.
  function say(s) { history.push(s); while (history.length > HISTORY) history.shift(); fresh = true; }

  // Everything the player does goes through here. An action from anywhere but a walk stops
  // the walk and drops the path preview; afterwards the open label is brought up to date,
  // or closed if its exhibit is gone.
  function act_(action, fromWalk) {
    if (!fromWalk) { stopWalking(); ui.path = null; ui.selectedTile = null; }
    fresh = false;
    const ev = Step.step(state, action);
    ui.events = ev;
    const nameOf = Labels.nameOf(state);
    const lines = ev.map(e => Text.event(e, nameOf)).filter(Boolean);
    if (lines.length) say(lines.slice(-2).join(' '));
    if (state.over && !ev.some(e => e.k === 'died' && e.who === 'you')) say('You fell.');
    if (ui.selection) {
      const l = Labels.of(state, ui.selection);
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
    if (state.over) { say('You fell. The run is over.'); draw(); return; }
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
    if (settings.walk === 'two' && !(ui.selectedTile && ui.selectedTile.x === t.x && ui.selectedTile.y === t.y)) {
      ui.selection = null; UI.closeLabel();
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
      if (ev.some(e => STOPS.has(e.k) || (e.k === 'status_ended' && e.who === 'you')) || after !== before) return;
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
    // While a label is open the camera centres between you and its exhibit, in the part of
    // the board the phone's sheet leaves clear.
    const open = UI.labelShown() && vm.actors.find(a => a.uid === UI.labelShown());
    if (open) vm.camera = { x: Math.floor((2 * vm.you.x + 2 * open.x + open.size - 1) / 4), y: Math.floor((2 * vm.you.y + 2 * open.y + open.size - 1) / 4) };
    UI.top({ hp: vm.you.hp, maxHp: vm.you.maxHp, grade: vm.you.grade, clock: vm.clock });
    UI.strip(Labels.strip(state), history, fresh);
    renderer.setInset(UI.sheetCover());
    renderer.draw(vm);
  }

  // Examine (x): the nearest readable thing first, then each visible exhibit in turn.
  // Read (r): always the nearest label, never the next one.
  function nearestSeen() {
    const you = state.actors[0], s = Labels.strip(state);
    if (s) return s.uid;
    const seen = ViewModel.derive(state, {}).actors.filter(a => a.uid !== 'you')
      .map(a => ({ uid: a.uid, d: Math.max(Math.abs(a.x - you.x), Math.abs(a.y - you.y)) })).sort((p, q) => p.d - q.d);
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
    views: Views, setZoom, busy: () => !!walking, get history() { return history.slice(); },
    setting: (k, v) => { settings[k] = v; if (k === 'board') makeView(); applySettings(); draw(); },
  };
  return {};
})();
