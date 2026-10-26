// ACCESSION — boot and wiring (BUILD.md §2, §7): the state, the active board view, the
// interface, the Bag and input. Only main.js and input.js reach step(), and only through
// act_(); everything the player asks for reaches act_() through request(), which first asks
// §7.1's confirmations.
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
  // ui: what the view model needs from the interface: the selection (an exhibit's uid, 'you',
  // or a thing's id: 'case:x,y', 'item:<uid>', 'plaque:x,y', 'staff:x,y'), the selected tile
  // (a previewed walk's, or the selected thing's), the path preview, the aim (the Bag's), and
  // the events of your last action that took time, for the noise rings and one-turn cues.
  // last: the last step's events, whatever it took. history: the log's recent sentences.
  const blank = () => ({ path: null, selection: null, selectedTile: null, events: null, aim: null });
  let seed = Number(params.get('seed')) || 1;
  let state, renderer, ui = blank(), runner = null, stopWhy = null, fresh = false, shown = null, last = [];
  // preview: the tile a "tap twice" walk previews. asking: the action a confirmation waits on.
  // ended: what the end-of-visit overlay says.
  let preview = null, asking = null, ended = null;
  const history = [], HISTORY = 6, banners = new Set();

  function newVisit() {
    if (params.get('room') === 'test') return TestRoom.create(seed);
    const acc = (params.get('dept') || 'S9').toUpperCase(), depth = Number(params.get('depth')) || 1;
    return Dept.create(seed, Packs.get(acc) ? acc : 'S9', depth);
  }

  const app = document.getElementById('app');
  const board = UI.build(app, {
    bar(id) {
      stop();
      const q = /^q([1-6])$/.exec(id);
      if (id === 'wait') request({ a: 'wait' });
      else if (id === 'zoom') setZoom((renderer.zoom + 1) % renderer.zooms.length);
      else if (id === 'bag') { Bag.open(); draw(); }
      else if (id === 'map') { Bag.map(); draw(); }
      else if (q) { Bag.quick(Number(q[1])); draw(); }
    },
    openLabel() { stop(); const s = Labels.strip(state); if (s) select(s.uid, true); },
    labelAction(a, id) { stop(); perform(a, id); },
    // Closing the label keeps the selection, so tapping the thing again still acts (§7.1).
    closedLabel() { draw(); },
    confirmed(yes) { answer(yes); },
    another() { anotherVisit(); },
    setting(key, value) {
      stop();
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
  // visit is over, nothing else is logged, so its last sentence stays in view.
  let overLogged = false;
  function say(s) {
    if (overLogged) return;
    history.push(s); while (history.length > HISTORY) history.shift(); fresh = true;
    if (state && state.over) overLogged = true;
  }

  // ---- Acting ----

  // One step. An action from anywhere but a walk or a rest stops it and drops the path
  // preview; afterwards the open label is brought up to date while what it names is in view
  // (ViewModel.shows), or else closed and the selection dropped: a label shows only what
  // sight gives, so it never follows an exhibit out of sight (§7.2, §8.8).
  function act_(action, fromRun) {
    if (!fromRun) { stop(); preview = null; ui.path = null; }
    // After the visit nothing more happens, and nothing pushes its end out of the log.
    if (state.over) { draw(); return []; }
    fresh = false;
    const tick = state.tick, ev = Step.step(state, action);
    // The noise rings and one-turn cues are those of your last action that took time (§6.1,
    // §8.2): a step that takes none (a refusal, such as a bump into a wall, or a free read)
    // leaves them as they were, as it leaves your ring (§8.2).
    last = ev;
    if (state.tick !== tick) ui.events = ev;
    // The log's sentences (Text.log): an event about an exhibit out of view is left out
    // where its kind says so. A stage's announcement is also set off as a banner (§8.4).
    const nameOf = Labels.nameOf(state), vm = ViewModel.derive(state, ui), inView = new Set(vm.actors.map(a => a.uid));
    for (const e of ev) if (e.k === 'stage') { const s = Text.event(e, nameOf); if (s) banners.add(s); }
    const lines = Text.log(ev, nameOf, uid => inView.has(uid));
    if (lines.length) say(lines.join(' '));
    if (state.over && state.over.k === 'died' && !ev.some(e => e.k === 'died' && e.who === 'you')) say('You fell.');
    if (ui.selection) {
      const l = ViewModel.shows(vm, ui.selection) ? labelOf(ui.selection) : null;
      if (!l) { ui.selection = null; UI.closeLabel(); }
      else if (UI.labelShown() === ui.selection) UI.label(l);
    }
    if (state.over) finish(ev, nameOf);
    // Anything tried while a choice waits (a Catalogue Card's, closed in the Bag) is refused,
    // and the Bag opens again with the choice at its top.
    if (ev.some(e => e.k === 'refused' && e.reason === 'choice_pending')) Bag.open();
    draw();
    return ev;
  }

  // Everything the player asks for comes here: an action that needs a confirmation (§7.1)
  // waits for it on the sheet; any other goes at once. While the sheet asks, nothing else is
  // done: it is answered first (the page behind it is inert, ui.js).
  function request(action) {
    if (asking) return null;
    const c = askFor(action);
    if (!c) return act_(action);
    stop(); asking = { action }; UI.confirm(c); draw();
    return null;
  }
  function answer(yes) {
    const a = asking;
    asking = null; UI.closeConfirm();
    if (a && yes) act_(a.action); else draw();
  }

  // A label's button: a step() action through request() (Rest repeats, below); an action that
  // needs a target (a throw, an instrument's tile, a Restoration kit's item) is aimed in the
  // Bag, which is opened on that item.
  function perform(entry, id) {
    if (entry.aim) { Bag.open(typeof id === 'string' && id.startsWith('item:') ? id.slice(5) : null); draw(); }
    else if (entry.act && entry.act.a === 'rest') rest();
    else if (entry.act) request(entry.act);
  }

  // ---- Confirmations (§7.1) ----

  const SHARDS = 'xk'; // shards, and a broken case's tile, which holds its glass
  const SPECIAL = { line: 'beam', ring: 'ring of blows' };
  const turns = n => n === 1 ? '1 turn' : `${n} turns`;
  // What a confirmation says before an action, or null when it needs none. It asks before:
  // stepping onto shards from a tile without them; every blow at a case's glass; leaving by
  // an exit (a minimal confirmation, D4.9); and any action that would leave you on a tile
  // marked for damage by a special that goes off before your next decision (Specials.threat).
  // An action step() would refuse is never asked about: its refusal says why.
  function askFor(action) {
    if (!action || state.over || !Labels.allowed(state, action)) return null;
    const you = state.actors[0], m = state.dept, nameOf = Labels.nameOf(state), why = [];
    let title = null, yes = null;
    const say_ = (t, y, ...lines) => { if (!title) { title = t; yes = y; } why.push(...lines); };
    if (action.a === 'move') {
      const x = you.x + Grid.DX[action.dir], y = you.y + Grid.DY[action.dir];
      if (SHARDS.includes(Grid.ch(m, x, y)) && !SHARDS.includes(Grid.ch(m, you.x, you.y)) && !Actors.at(state, x, y))
        say_('Step onto the shards?', 'Step onto the shards', `Broken glass is loud underfoot: while you stand on it, your ring reaches ${N.RING_LOUD_FLOOR} tiles farther.`);
    }
    if (action.a === 'bash') {
      const d = Cases.describe(state, Cases.at(state, action.x, action.y));
      if (d && d.canBreak) say_('Break the glass?', 'Strike the glass', d.blows === 1
        ? `This blow breaks its ${d.glassName} glass, with a crash.`
        : `This blow is loud and cracks its ${d.glassName} glass; ${d.blows - 1 === 1 ? '1 more breaks it' : `${d.blows - 1} more break it`}, the last with a crash.`);
    }
    if (action.a === 'leave') say_('Leave the department?', 'Leave', 'Your visit ends when you go through this door.');
    const t = Specials.threat(state, action);
    if (t) {
      const owner = Actors.byUid(state, t.by), sp = owner && owner.telegraph ? owner.telegraph.sp : null;
      const shape = sp && Registry.SPECIALS[sp] ? Registry.SPECIALS[sp].shape : null, what = SPECIAL[shape] || 'special';
      const who = nameOf(t.by) || 'an exhibit', stay = t.x === you.x && t.y === you.y;
      say_(stay ? 'Stay on the marked tile?' : 'Step onto the marked tile?', stay ? 'Stay' : 'Step onto it',
        `${who.charAt(0).toUpperCase() + who.slice(1)}’s ${what} goes off on that tile before your next turn: it would deal you ${t.dmg}, with no roll.`);
    }
    return title ? { title, lines: why, yes } : null;
  }

  // ---- Walking and resting ----

  // A walk or a rest: one action at a time, each through the confirmations, until it is done
  // or something stops it (§7.1). next() gives the next action, or null when done. An action
  // that needs a confirmation ends the run: the sheet asks, and its answer does that one
  // action or nothing. stopWhy says why the last run stopped.
  //   A run stops after an action whose events the log tells you of and that §7.1 lists
  //   (STOPS; status only when it is yours), when an exhibit comes into view or changes its
  //   mode or pips, when a new telegraph or call is marked, on the first loud tile you step
  //   onto, and when the visit ends.
  const STOPS = new Set(['refused', 'opened', 'hunting', 'damaged', 'missed', 'died', 'telegraphed', 'woke', 'alerted', 'stage', 'entered',
    'case_opened', 'glass_cracked', 'glass_broke', 'took', 'used', 'identified', 'status', 'left']);
  const loudHere = () => { const you = state.actors[0], t = Grid.TILES[Grid.ch(state.dept, you.x, you.y)]; return !!(t && t.loud); };
  const watch = () => {
    const vm = ViewModel.derive(state, {});
    return { sights: vm.actors.map(a => a.uid + a.mode + a.pips).join(), marks: vm.marks.filter(k => k.kind === 'telegraph' || k.kind === 'call').map(k => k.kind + k.x + ',' + k.y + k.by), inView: new Set(vm.actors.map(a => a.uid)) };
  };
  function stopFor(ev, before, wasLoud) {
    if (state.over) return 'over';
    const now = watch(), nameOf = Labels.nameOf(state);
    for (const e of ev) {
      if (!STOPS.has(e.k)) continue;
      if (e.k === 'status' ? e.who === 'you' : Text.log([e], nameOf, uid => now.inView.has(uid)).length) return e.k;
    }
    if (now.sights !== before.sights) return 'sight';
    if (now.marks.some(k => !before.marks.includes(k))) return 'mark';
    if (!wasLoud && loudHere()) return 'loud';
    return null;
  }
  function run(next) {
    stop(); stopWhy = null;
    let before = watch();
    const once = () => {
      runner = null;
      if (state.over) { stopWhy = 'over'; return; }
      const action = next();
      if (!action) { draw(); return; }
      const c = askFor(action);
      if (c) { stopWhy = 'confirm'; asking = { action }; UI.confirm(c); draw(); return; }
      const wasLoud = loudHere(), ev = act_(action, true), why = stopFor(ev, before, wasLoud);
      if (why) { stopWhy = why; return; }
      before = watch();
      runner = setTimeout(once, settings.motion === 'reduce' ? 0 : 70);
    };
    runner = setTimeout(once, 0);
  }
  function stop() { clearTimeout(runner); runner = null; }

  // Walk a path one move at a time; it also stops where the next tile is taken (a walk
  // never turns into an attack).
  function walk(path) {
    let i = 0;
    run(() => {
      if (i >= path.length) return null;
      const you = state.actors[0], d = Path.dirTo([you.x, you.y], path[i]);
      if (d < 0 || Actors.at(state, path[i][0], path[i][1])) { stopWhy = 'blocked'; return null; }
      i++;
      return { a: 'move', dir: d };
    });
  }
  // Rest (§8.1: a wait under its own name, which the interface repeats): once, then again
  // while you are below your maximum health and can recover it (not in the night watch,
  // Clock.regenRate), under the walk's stop rules.
  function rest() {
    let n = 0;
    run(() => {
      const you = state.actors[0];
      if (n > 0 && you.hp >= you.maxHp) { stopWhy = 'rested'; return null; }
      if (n > 0 && Clock.regenRate(state) === 0) { stopWhy = 'no_recovery'; return null; }
      n++;
      return { a: 'rest' };
    });
  }

  // ---- Selecting and tapping ----

  // A selection's label: yours (Labels.you), or an exhibit's or a thing's (Labels.of).
  const labelOf = id => id === 'you' ? Labels.you(state) : Labels.of(state, id);
  // The tile a thing's selection id names: a case, plaque or staff door's, or an item's lying
  // on the floor or in a case (null for one you carry). A selection is kept only while the
  // view model shows it (act_), so this names a tile in view.
  function tileOf(id) {
    const f = /^(case|plaque|staff):(-?\d+),(-?\d+)$/.exec(id || '');
    if (f) return { x: Number(f[2]), y: Number(f[3]) };
    if (id && id.startsWith('item:')) {
      const it = (state.items || []).find(i => i.uid === id.slice(5)), w = it && it.where;
      return w && (w.at === 'floor' || w.at === 'case') ? { x: w.x, y: w.y } : null;
    }
    return null;
  }
  // What a tap on tile t can select, in order: an exhibit standing there, a case, an item on
  // the floor, a plaque, a staff door. On your own tile, an item lying there (on the floor, or
  // in the opened case you stand in) comes before you, and you before the fixture you stand
  // on, so tapping yourself shows your label and a second tap waits (§7.1).
  function thingsAt(vm, t) {
    const out = [], under = [], on = q => t.x >= q.x && t.y >= q.y && t.x < q.x + q.size && t.y < q.y + q.size;
    const mine = vm.you.x === t.x && vm.you.y === t.y, c = vm.cases.find(q => q.x === t.x && q.y === t.y);
    for (const a of vm.actors) if (a.uid !== 'you' && on(a)) out.push(a.uid);
    if (c) (mine && !c.holds ? under : out).push(`case:${t.x},${t.y}`);
    for (const i of vm.items) if (i.x === t.x && i.y === t.y && !i.inCase) out.push('item:' + i.uid);
    if (vm.plaques.some(p => p.x === t.x && p.y === t.y)) (mine ? under : out).push(`plaque:${t.x},${t.y}`);
    if (vm.staff.some(s => s.x === t.x && s.y === t.y)) (mine ? under : out).push(`staff:${t.x},${t.y}`);
    if (mine) out.push('you');
    return out.concat(under);
  }

  function select(id, open) {
    ui.selection = id; preview = null; ui.path = null;
    const l = labelOf(id);
    if (open && l) UI.label(l);
    draw();
  }

  // A tap (§7.1). While the Bag aims, the tap is its target. On something (an exhibit, a case,
  // an item, a plaque, a staff door, yourself): examine and select it; a tap on what is
  // selected does its first action (Attack; Open, or Break the glass, which asks first; Take;
  // Read; Wait); with none, the next thing on that tile is selected, or you walk onto a tile
  // you can stand on (an item's, an opened case's, a staff door's), or the first thing there
  // is selected again (so on your own tile you come round, whatever was selected).
  // On a tile: walk there; with "Walk: tap twice" the first tap previews the path and a
  // second tap on the same tile goes.
  function tap(t) {
    if (runner) { stop(); return; }
    if (asking) return;
    if (state.over) { if (ended) UI.end(ended); draw(); return; }
    if (Bag.aiming()) { const a = Bag.tapAim(t); if (a) request(a); else draw(); return; }
    const vm = ViewModel.derive(state, ui), things = thingsAt(vm, t);
    if (things.length) {
      const k = things.indexOf(ui.selection);
      if (k < 0) { select(things[0], true); return; }
      const l = labelOf(ui.selection), first = l && l.actions.find(a => a.act);
      if (first) { perform(first, ui.selection); return; }
      if (k + 1 < things.length) { select(things[k + 1], true); return; }
      const you = state.actors[0], here = t.x === you.x && t.y === you.y;
      if (!vm.actors.some(a => a.uid === ui.selection) && !here && Grid.walkable(state.dept, t.x, t.y)) {
        const path = Path.to(state, t.x, t.y);
        if (path.length) { UI.closeLabel(); walk(path); return; }
      }
      select(things[0], true);
      return;
    }
    if (!vm.vis[t.y * vm.w + t.x]) { say('You have not seen that part of the room.'); draw(); return; }
    const path = Path.to(state, t.x, t.y);
    if (!path.length) { say('There is no way there from here.'); draw(); return; }
    // The preview leaves an open label (and so the camera) where it is, so the second tap
    // lands on the same tile; the walk closes it.
    if (settings.walk === 'two' && !(preview && preview.x === t.x && preview.y === t.y)) {
      preview = { x: t.x, y: t.y }; ui.path = path; draw(); return;
    }
    preview = null; ui.path = null; ui.selection = null; UI.closeLabel();
    walk(path);
  }

  // ---- The end of a visit ----

  // Death opens the recap (Text.recap: who defeated you, the blow, and the killer's own
  // story); leaving, the sentence of the `left` event. Both offer "Another visit".
  function finish(ev, nameOf) {
    stop(); UI.closeLabel(); ui.selection = null;
    if (state.over.k === 'died') {
      const r = Text.recap(state, nameOf);
      ended = { title: 'You were defeated', lines: r && r.lines.length ? r.lines : [history[history.length - 1] || 'You fell.'] };
    } else {
      const e = ev.find(q => q.k === 'left'), s = e ? Text.event(e, nameOf) : null;
      ended = { title: 'The visit is over', lines: [s || 'You left the department.'] };
    }
    UI.end(ended);
  }
  // Another visit: the same department at the same depth, with the next seed (M5's run
  // replaces this with the next department).
  function anotherVisit() {
    stop(); asking = null; UI.closeConfirm(); UI.closeOverlays(); UI.closeLabel();
    seed += 1; state = newVisit();
    ui = blank(); preview = null; ended = null; last = []; shown = null; stopWhy = null; overLogged = false;
    history.length = 0; banners.clear(); Bag.close();
    say(welcome());
    draw();
  }
  const welcome = () => `Room ${state.dept.rooms ? state.dept.rooms.find(r => r.role === 'intro').number : ''}. Tap a tile to walk; tap an exhibit, a case or yourself to read its label.`;

  // ---- Drawing ----

  // The interface first, then the board, so the board is measured at its final size; the
  // label sheet's cover is passed on so the camera keeps you and the thing above it.
  function draw() {
    const aim = Bag.aiming();
    ui.aim = aim && Number.isInteger(aim.x) && Number.isInteger(aim.y) ? { x: aim.x, y: aim.y, uid: aim.uid || null, size: Number.isInteger(aim.size) ? aim.size : null } : null;
    // The selected tile is the previewed walk's, else the selected thing's (an exhibit and you
    // carry the selection themselves).
    ui.selectedTile = preview || tileOf(ui.selection);
    const vm = ViewModel.derive(state, ui);
    // While a label is open the camera centres between you and what it names in the part of
    // the board the phone's sheet leaves clear; if both cannot fit, it keeps you in view and
    // leans as far towards it as it can.
    const open = UI.labelShown(), target = open && targetOf(open, vm);
    if (target) vm.camera = focus(vm.you, target, shown);
    UI.top({ hp: vm.you.hp, maxHp: vm.you.maxHp, grade: vm.you.grade, clock: vm.clock, dial: Text.clock(vm.clock), stage: stageChip(vm.clock), statuses: statusChips() });
    UI.strip(Labels.strip(state), history, fresh, [...banners]);
    Bag.render(vm, { of: id => labelOf(id), ofItem: uid => Labels.ofItem(state, uid) });
    renderer.setInset(UI.sheetCover());
    renderer.draw(vm);
    shown = vm.camera;
  }
  // The stage chip: the clock's stage (name) and what comes next (next), as one sentence
  // (§7.2, §8.4), or null with no clock.
  function stageChip(c) {
    if (!c) return null;
    if (c.stage === 0) return { n: 0, name: 'Open:', next: `bell in ${turns(c.toBell)}` };
    if (c.stage === 1) return { n: 1, name: 'After the bell:', next: `night watch in ${turns(c.toWatch)}` };
    return { n: 2, name: 'Night watch:', next: `next bell in ${turns(c.toNightBell)}` };
  }
  // Your statuses for the top bar: each by its registry pictogram, with its words and the
  // turns it still covers (Status.left), as your label says them.
  function statusChips() {
    const you = state.actors[0], out = [];
    for (const s of you.statuses || []) {
      const S = Object.prototype.hasOwnProperty.call(Registry.STATUSES, s.id) ? Registry.STATUSES[s.id] : null;
      if (S) out.push({ icon: S.icon, words: S.words, left: Status.left(state, you, s.id) });
    }
    return out;
  }
  // Where on the board an open label's subject is: an actor's square, or a thing's tile.
  function targetOf(id, vm) {
    const a = vm.actors.find(q => q.uid === id);
    if (a) return { uid: a.uid, x: a.x, y: a.y, size: a.size };
    const t = tileOf(id);
    return t ? { uid: null, x: t.x, y: t.y, size: 1 } : null;
  }

  // A camera centred on a tile shows half whole tiles either side of it, where half comes
  // from the clear length in tiles; vertically, room is kept above the top row for the
  // state glyphs and, in 3D, for sprites standing taller than their tile.
  function focus(you, a, last) {
    const tr = renderer.tileRect(you.x, you.y), b = board.getBoundingClientRect();
    if (!tr || !tr.rect.w) return { x: you.x, y: you.y };
    const t = tr.rect.w, d = tr.rect.h, above = Math.max(8, Math.floor(t / 3)) + (t - d);
    const half = (len, step) => Math.max(0, Math.floor((len / step - 1) / 2));
    // Beside the exhibit (or within reading distance of a thing), if both already fit round
    // the camera the last frame used (or else round you) the board stays put, so a second tap
    // on any of its tiles still lands on it (§7.1), whichever label was open before.
    const me = state.actors[0];
    const near = a.uid ? Step.adjacent(state, me, Actors.byUid(state, a.uid)) : Math.max(Math.abs(a.x - me.x), Math.abs(a.y - me.y)) <= N.READ_RANGE;
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
    stop();
    const seen = ViewModel.derive(state, {}).actors.filter(a => a.uid !== 'you').map(a => a.uid), at = seen.indexOf(ui.selection);
    if (!seen.length) { say('Nothing here to examine.'); draw(); return; }
    select(ui.selection && at >= 0 && UI.labelShown() ? seen[(at + 1) % seen.length] : nearestSeen(), true);
  }
  function read() {
    stop();
    const uid = nearestSeen();
    if (uid) select(uid, true); else { say('Nothing in sight to read.'); draw(); }
  }

  state = newVisit();
  makeView();
  applySettings();
  // The Bag (js/ui/bag.js) builds into the quickslot containers and acts through request(),
  // so its actions are asked about as any other is. window.ACCESSION.bag is what it was given
  // (check-play checks the wiring).
  const bagWiring = Object.assign(UI.slots(), { act: request, state: () => state, draw: () => draw() });
  Bag.attach(app, bagWiring);
  Input.attach(board, () => renderer, {
    tap, key(a) { request(a); }, examine, read,
    blocked: () => UI.overlayOpen() || UI.confirmOpen(),
    bag() { stop(); Bag.open(); draw(); },
    map() { stop(); Bag.map(); draw(); },
    quick(n) { stop(); Bag.quick(n); draw(); },
    // Enter: yes to a waiting confirmation; else, while the Bag aims, a second tap on the tile
    // it previews (nothing before a tile is previewed); else go on a previewed walk; else the
    // selected thing's first action, as a second tap on it would do: so only for something a
    // tap can reach (yourself, an exhibit, or a thing on a tile), never for an item you carry.
    confirm() {
      if (asking) { answer(true); return; }
      if (UI.overlayOpen() || state.over) return;
      const aim = Bag.aiming();
      if (aim) { if (Number.isInteger(aim.x) && Number.isInteger(aim.y)) tap({ x: aim.x, y: aim.y }); return; }
      if (preview && ui.path) { tap(preview); return; }
      if (ui.selection && (ui.selection === 'you' || Actors.byUid(state, ui.selection) || tileOf(ui.selection))) {
        const l = labelOf(ui.selection), first = l && l.actions.find(a => a.act);
        if (first) perform(first, ui.selection);
      }
    },
    escape() {
      stop();
      if (asking) { answer(false); return; }
      UI.closeOverlays(); Bag.close(); ui.selection = null; ui.path = null; preview = null; UI.closeLabel(); draw();
    },
  });
  // Any change to the board's size redraws it, not only a window resize: the strip grows
  // and shrinks with what it says.
  let pending = 0;
  const redraw = () => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; draw(); }); };
  window.addEventListener('resize', redraw);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(redraw).observe(board);
  say(welcome());
  draw();
  window.ACCESSION = {
    get state() { return state; }, act: act_, request, tap, vm: () => ViewModel.derive(state, ui), get renderer() { return renderer; },
    get events() { return last.slice(); }, stops: [...STOPS], get stopWhy() { return stopWhy; }, get asking() { return asking ? asking.action : null; },
    get seed() { return seed; }, redraw: () => draw(), bag: bagWiring,
    views: Views, setZoom, busy: () => !!runner, get history() { return history.slice(); },
    setting: (k, v) => { settings[k] = v; if (k === 'board') makeView(); applySettings(); draw(); },
  };
  return {};
})();
