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
  let state, renderer, ui = { path: null, selection: null, selectedTile: null }, walking = null, log = '';

  function newVisit() {
    const seed = Number(params.get('seed')) || 1;
    if (params.get('room') === 'test') return TestRoom.create(seed);
    const acc = (params.get('dept') || 'S9').toUpperCase(), depth = Number(params.get('depth')) || 1;
    return Dept.create(seed, Packs.get(acc) ? acc : 'S9', depth);
  }

  const app = document.getElementById('app');
  const board = UI.build(app, {
    bar(act) {
      if (act === 'wait') act_({ a: 'wait' });
      else if (act === 'zoom') setZoom((renderer.zoom + 1) % renderer.zooms.length);
      else { say('Not in this build yet.'); draw(); }
    },
    openLabel() { const s = Labels.strip(state); if (s) select(s.uid, true); },
    labelAction(id) { if (id === 'attack' && ui.selection) attackSelected(); },
    closedLabel() { ui.selection = null; draw(); },
    setting(key, value) {
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

  // The strip shows the latest sentence until the next action, then the nearest label.
  function say(s) { log = s; }

  // Everything the player does goes through here.
  function act_(action) {
    log = '';
    const ev = Step.step(state, action);
    const lines = ev.map(Text.event).filter(Boolean);
    if (lines.length) say(lines.slice(-2).join(' '));
    if (state.over) say('You fell. ' + log);
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
    if (a && !a.gone && Step.adjacent(state, you, a)) { act_({ a: 'attack', uid: a.uid }); if (Actors.byUid(state, ui.selection).gone) { ui.selection = null; UI.closeLabel(); } else select(ui.selection, true); }
  }

  // A tap: on an exhibit, examine it (a second tap on a selected adjacent exhibit attacks);
  // on yourself, wait; on a tile, walk there. With "Walk: tap twice" the first tap on a
  // tile previews the path and a second tap on the same tile goes.
  function tap(t) {
    if (walking) { stopWalking(); return; }
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
      ui.selectedTile = t; ui.path = path; ui.selection = null; draw(); return;
    }
    ui.selectedTile = null; ui.path = null; ui.selection = null; UI.closeLabel();
    walk(path);
  }

  // Walk a path one move at a time; stop when anything new appears or an event names you.
  function walk(path) {
    const seen = () => ViewModel.derive(state, {}).actors.map(a => a.uid + a.mode + a.pips).join();
    let before = seen(), i = 0;
    const stepOnce = () => {
      if (i >= path.length || state.over) { walking = null; return; }
      const here = [state.actors[0].x, state.actors[0].y], d = Path.dirTo(here, path[i]);
      if (d < 0) { walking = null; return; }
      const ev = act_({ a: 'move', dir: d });
      i++;
      const after = seen();
      if (ev.some(e => e.k === 'refused' || e.k === 'damaged' || e.k === 'hunting' || e.k === 'opened') || after !== before) { walking = null; return; }
      before = after;
      walking = setTimeout(stepOnce, settings.motion === 'reduce' ? 0 : 70);
    };
    stepOnce();
  }
  function stopWalking() { clearTimeout(walking); walking = null; }

  function draw() {
    const vm = ViewModel.derive(state, ui);
    renderer.draw(vm);
    UI.top({ hp: vm.you.hp, maxHp: vm.you.maxHp, grade: vm.you.grade, clock: vm.clock });
    const s = Labels.strip(state);
    UI.strip(log ? { log } : s);
  }

  state = newVisit();
  makeView();
  applySettings();
  Input.attach(board, () => renderer, {
    tap, key(a) { stopWalking(); act_(a); },
    examine, read: examine,
    confirm() {
      if (ui.selectedTile && ui.path) tap(ui.selectedTile);
      else if (ui.selection) { const a = Actors.byUid(state, ui.selection); if (a && Step.adjacent(state, state.actors[0], a)) attackSelected(); }
    },
    later() { say('Not in this build yet.'); draw(); },
    escape() { UI.closeLabel(); UI.closeOverlays(); ui.selection = null; ui.path = null; ui.selectedTile = null; draw(); },
  });
  // Examine: the nearest readable thing first, then each visible exhibit in turn.
  function examine() {
    const s = Labels.strip(state), seen = ViewModel.derive(state, {}).actors.filter(a => a.uid !== 'you').map(a => a.uid);
    if (!seen.length) { say('Nothing here to examine.'); draw(); return; }
    const first = s ? s.uid : seen[0], at = seen.indexOf(ui.selection);
    select(ui.selection && at >= 0 ? seen[(at + 1) % seen.length] : first, true);
  }
  window.addEventListener('resize', () => draw());
  say(`Room ${state.dept.rooms ? state.dept.rooms.find(r => r.role === 'intro').number : ''}. Tap a tile to walk; tap an exhibit to read its label.`);
  draw();
  window.ACCESSION = {
    get state() { return state; }, act: act_, tap, vm: () => ViewModel.derive(state, ui), get renderer() { return renderer; },
    views: Views, setZoom, busy: () => !!walking,
    setting: (k, v) => { settings[k] = v; if (k === 'board') makeView(); applySettings(); draw(); },
  };
  return {};
})();
