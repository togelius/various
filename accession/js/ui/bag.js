// ACCESSION — the Bag (BUILD.md §7.1, §7.2, §8.5, §8.6): what you wear and carry, each
// item's label and buttons, the Catalogue Card's choice, the quickslots, aiming a throw or
// an instrument at a tile, choosing a Restoration kit's item, the Window Pole's choice, and
// the floor plan. It decides nothing: every button is an action a label offers (Labels.*,
// the actions step() takes now), or the answer to a choice the state holds, and each goes
// through main.js's act (request), so it is asked about as any other action is (§7.1).
//
//   Bag.attach(app, {bar, column, act, state, draw})
//       builds its panel, aim strip and pole sheet inside app (#app, so they go inert while a
//       confirmation asks); bar and column are UI's quickslot containers (3 on a phone, 6 in
//       the laptop's column); act(action) asks for an action; state() is the state; draw()
//       redraws the page (which calls render)
//   Bag.render(vm, labels)   on every draw: fills the quickslots (your instrument first, then
//                            your consumables in tote order), and shows what is open; a new
//                            pending choice (vm.pending, the Catalogue Card's) opens the Bag
//   Bag.open(uid?)           the Bag; with the uid of an item you carry that is aimed (an item
//                            label's Throw…, Use at a tile… or Use on an item…), its aim
//   Bag.close()              closes the Bag or the map, and ends any aim
//   Bag.quick(n)             quickslot n: your instrument is aimed (pressed again while it is
//                            aimed, the aim ends); a consumable is shown in the Bag with its
//                            buttons; an empty slot opens the Bag
//   Bag.map()                the floor plan: what you have seen (vm.tiles), and once a Floor
//                            Plan is read here, the rooms that still hold a Highlight (vm.plan)
//   Bag.aiming() → null | {kind, uid, x?, y?}
//                            kind 'throw' (a Solution) or 'tile' (an instrument), with the tile
//                            previewed, if any; 'item' while a Restoration kit's item is chosen
//   Bag.tapAim(t) → action | null
//                            a tap on tile t while aiming: the first tap on a tile previews it,
//                            a second commits: the action, or for the Window Pole with more than
//                            one way to use it there, its sheet (null until one is chosen); on a
//                            tile where it cannot be used, the action step() refuses, saying why.
//                            An aim lasts until time passes (its action taken, or another), or
//                            until Cancel, Escape, the Bag or the map ends it
//   Bag.cursor(dir) → bool   the keyboard's aim (§7.1): moves the previewed tile one step in
//                            direction dir (from your tile before any), as a first tap there
//   Bag.cycleAim(by) → bool  previews the next (by 1) or previous (by −1) tile the aim can be
//                            used at, those with an exhibit first, nearest first
//   Bag.aimDefault() → bool  previews the first of those, when no tile is previewed yet
//   Bag.picking(), Bag.cancelPick()   whether the Window Pole's sheet asks; closes it, the aim kept
//   Bag.shown()              'bag', 'map' or null
//   Bag.key(e) → bool        a key while the Bag, the map or the pole's sheet is open: the arrows
//                            move the focus through its buttons, a key a button carries presses
//                            it, Backspace goes Back, i and m open or close the Bag and the map,
//                            and 1–3 choose on the pole's sheet
// Bag is a plain object whose methods main.js calls by name (check-play puts recorders in
// their place for a while, so they stay writable); the Bag's own handlers call its inner
// functions.
'use strict';
const Bag = (() => {
  let h = {}, el = {}, lastVm = null, lastLabels = null;
  // mode: null (shut), 'bag' or 'map'. view, in the Bag: the list; an item's label; or a
  // Restoration kit's items to choose from (on: the one previewed).
  let mode = null, view = { k: 'list' }, focusBack = null, focusIn = false;
  // aim: a throw or an instrument being aimed, {kind, uid, tile, tick} (tick: the state's when
  // the aim began; once time passes the aim is over); pick: the Window Pole's actions at the
  // aimed tile while its sheet asks which.
  let aim = null, pick = null, seenPending = null, redrawSoon = false;
  const shown = { slots: ['', ''], panel: '', aim: '', pick: '' };
  // keyed: the focus is to go to the open view's first control at the next draw (a view
  // opened or changed while the focus was in the Bag, or the Bag just opened).
  let keyed = false;
  const POLE_SAYS = { push: 'Push it one tile away', pull: 'Pull it one tile toward you', take: 'Take what the case holds' };
  const SLOT_NAMES = { weapon: 'Weapon slot', garment: 'Garment slot', curio0: 'Curio slot', curio1: 'Curio slot', instrument: 'Instrument slot' };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const P = (id, px) => Pictograms.svg(id, px || 16);
  const own = (o, k) => typeof k === 'string' && o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const st = () => typeof h.state === 'function' ? h.state() : (window.ACCESSION ? window.ACCESSION.state : null);
  const itemOf = (s, uid) => (s && s.items || []).find(i => i.uid === uid) || null;
  const carried = (s, uid) => { const it = itemOf(s, uid); return !!it && (it.where.at === 'tote' || it.where.at === 'kit'); };
  const labelOf = uid => lastLabels && typeof lastLabels.ofItem === 'function' ? lastLabels.ofItem(uid) : Labels.ofItem(st(), uid);
  const same = (p, q) => { const a = Object.keys(p), b = Object.keys(q); return a.length === b.length && a.every(k => own(q, k) && p[k] === q[k]); };
  function redraw() { if (typeof h.draw === 'function') h.draw(); else if (lastVm) render(lastVm, lastLabels); }
  // Ask for an action through main.js's act, which draws after it; when it does nothing (a
  // confirmation already asks), draw anyway, since the Bag has changed.
  function ask(a) { if (!a || !h.act(a)) redraw(); }
  // An item's name: a consumable's local name, a pack item's own, else the instrument's or
  // what it is (the label's title, without building the label's buttons).
  function nameOf(s, uid) {
    const it = itemOf(s, uid);
    if (!it) return 'it';
    if (it.kind === 'consumable') return Consumables.name(s, it).local;
    const d = Kit.describe(s, uid);
    if (d && d.title) return d.title;
    if (it.kind === 'instrument' && own(Registry.INSTRUMENTS, it.form)) return 'The ' + Registry.INSTRUMENTS[it.form].name;
    const l = Labels.ofItem(s, uid);
    return l ? l.title : 'it';
  }

  // ---- Building ----

  function attach(app, handlers) {
    h = handlers || {};
    const make = (id, cls, attrs) => { const e = document.createElement('div'); e.id = id; if (cls) e.className = cls; for (const [k, v] of attrs || []) e.setAttribute(k, v); app.appendChild(e); return e; };
    // The Bag and the floor plan: an overlay, so keys leave the game alone while it is open.
    el.app = app;
    el.panel = make('bag', 'overlay', [['role', 'dialog'], ['aria-labelledby', 'bag-title'], ['tabindex', '-1']]);
    // What you aim, and what a tap does: in place of the strip on a phone, over the bar on a
    // laptop, never over the board. Its words change in one element that stays, so a screen
    // reader hears each change (a live region put in afresh is not reliably heard).
    el.aim = make('bagaim', '', [['role', 'region'], ['aria-label', 'Aiming']]);
    el.aim.innerHTML = `<div class="in"><button class="btn corner" data-aim-cancel${UI.keyAttrs('Escape')}>Cancel</button><p class="aim-text" aria-live="polite"></p></div>`;
    el.aimText = el.aim.querySelector('.aim-text');
    // The Window Pole's choice: a sheet like a confirmation's. It is an overlay, so while it
    // asks the keys leave the game alone (a key cannot move you or pass a turn behind it).
    el.pick = make('bagpick', 'overlay', [['role', 'dialog'], ['aria-modal', 'true'], ['aria-labelledby', 'bagpick-title']]);
    el.panel.addEventListener('click', onPanel);
    el.aim.addEventListener('click', e => { if (e.target.closest('[data-aim-cancel]')) { endAim(); redraw(); } });
    el.pick.addEventListener('click', e => {
      const b = e.target.closest('[data-pick]');
      // The aim ends once the chosen action has taken its time (render), so a confirmation it
      // asks, cancelled, leaves the aim for another tile.
      if (b && pick) { const a = pick[Number(b.dataset.pick)]; pick = null; ask(a); return; }
      if (e.target.closest('[data-pick-cancel]') || !e.target.closest('.box')) { pick = null; redraw(); }
    });
  }

  // ---- Keys (BUILD.md §7.1) ----

  // A key while the Bag, the map or the Window Pole's sheet is open; true when it was used.
  function key(e) {
    const ROVE = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1, Home: 'first', End: 'last' };
    if (pick) {
      if (Object.prototype.hasOwnProperty.call(ROVE, e.key)) return UI.rove(el.pick, ROVE[e.key]);
      return UI.pressKey(el.pick, e.key);
    }
    if (!mode) return false;
    if (Object.prototype.hasOwnProperty.call(ROVE, e.key)) return UI.rove(el.panel, ROVE[e.key]);
    if (e.key === 'i' || e.key === 'm') {
      const want = e.key === 'i' ? 'bag' : 'map';
      if (mode === want && !(st() && st().ui && st().ui.pendingChoice)) close(); else { mode = want; view = { k: 'list' }; keyed = true; }
      redraw();
      return true;
    }
    if (e.key === '?') { UI.toggle('how', true); return true; }
    return UI.pressKey(el.panel, e.key);
  }
  const picking = () => !!pick;
  function cancelPick() { if (!pick) return false; pick = null; redraw(); return true; }


  // ---- Opening and closing ----

  function show(m, v) {
    if (!mode) { focusBack = document.activeElement; focusIn = true; }
    mode = m; view = v || { k: 'list' }; pick = null; aim = null; keyed = true;
  }
  function open(uid) {
    const s = st();
    if (!s || s.over) return;
    if (typeof uid === 'string' && carried(s, uid)) {
      const l = Labels.ofItem(s, uid), a = l && l.actions.find(q => q.aim);
      if (a && a.aim === 'tile') { startAim(s, uid); return; }
      show('bag', a && a.aim === 'item' ? { k: 'restore', uid, on: null } : { k: 'item', uid });
      return;
    }
    show('bag');
  }
  function map() { const s = st(); if (s && !s.over) show('map'); }
  function close() {
    const was = mode, inside = el.panel && el.panel.contains(document.activeElement);
    mode = null; view = { k: 'list' }; pick = null; aim = null;
    // The focus goes back where it was (the board, or the button that opened the Bag), once
    // the Bag no longer lies over it.
    if (was && inside) {
      el.panel.classList.remove('open'); UI.sync();
      if (focusBack && focusBack.isConnected && focusBack !== document.body && !focusBack.closest('[inert]') && focusBack.getClientRects().length) focusBack.focus({ preventScroll: true });
      else UI.focusBoard();
    }
    focusBack = null;
  }

  // ---- Quickslots ----

  // What the quickslots hold, in order: your instrument, then each consumable you carry, in
  // the order of your tote (vm.you.consumables), at most six.
  function quickList(vm) {
    const out = [];
    if (vm.you.charges) out.push({ uid: vm.you.charges.uid, inst: vm.you.charges });
    for (const c of vm.you.consumables || []) out.push({ uid: c.uid, cons: c });
    return out.slice(0, 6);
  }
  function slotHtml(n, q) {
    if (!q) return `<button class="btn slot bag-slot empty corner" data-act="q${n}" aria-label="Quickslot ${n}, empty: opens the Bag"${UI.keyAttrs(String(n))}><span class="q-n">Q${n}</span></button>`;
    const s = st(), aimed = !!aim && aim.uid === q.uid;
    let icon, count, name, words;
    if (q.inst) {
      icon = 'instrument'; count = `${q.inst.charges}/${q.inst.max}`; name = nameOf(s, q.uid);
      words = `${plural(q.inst.charges, 'charge', 'charges')} of ${q.inst.max}`;
    } else {
      icon = q.cons.shape ? 'seal_' + q.cons.shape : 'seal'; count = '×' + q.cons.n; name = q.cons.local; words = q.cons.n === 1 ? 'one' : `${q.cons.n} of them`;
    }
    // Only an instrument's slot is a toggle (pressed while it is aimed); a consumable's opens
    // the Bag, so it says nothing of being pressed.
    return `<button class="btn slot bag-slot corner${aimed ? ' aimed' : ''}" data-act="q${n}" data-uid="${esc(q.uid)}"${q.inst ? ` aria-pressed="${aimed}"` : ''} aria-label="Quickslot ${n}: ${esc(name)}, ${esc(words)}"${UI.keyAttrs(String(n))}>${P(icon, 16)}<span class="q-n">${esc(count)}</span><span class="q-name">${esc(name)}</span></button>`;
  }
  function drawSlots(vm) {
    const list = quickList(vm);
    [[h.bar, 3], [h.column, 6]].forEach(([box, n], i) => {
      if (!box) return;
      let html = '';
      for (let k = 0; k < n; k++) html += slotHtml(k + 1, list[k]);
      if (html !== shown.slots[i]) { box.innerHTML = html; shown.slots[i] = html; }
    });
  }
  // A quickslot: your instrument is aimed (pressed again while aimed, the aim ends); a
  // consumable is shown in the Bag with its buttons (Drink, Throw…, Read); an empty one opens
  // the Bag.
  function quick(n) {
    const s = st();
    if (!s || s.over) return;
    const q = quickList(ViewModel.derive(s, {}))[n - 1];
    if (!q) { show('bag'); return; }
    if (q.inst) { if (aim && aim.uid === q.uid) endAim(); else startAim(s, q.uid); return; }
    show('bag', { k: 'item', uid: q.uid });
  }

  // ---- Aiming at a tile ----

  // Aim item uid: a Solution's throw, or your instrument. The Bag shuts, and on a phone the
  // label sheet too, so the whole board can be tapped.
  function startAim(s, uid) {
    const it = itemOf(s, uid);
    if (mode) close();
    pick = null;
    aim = { kind: it.kind === 'consumable' ? 'throw' : 'tile', uid, tile: null, tick: s.tick };
    if (UI.labelShown() && UI.sheetCover() > 0) UI.closeLabel();
  }
  function endAim() { aim = null; pick = null; }
  // The actions the aim makes at (x, y): a throw there; the instrument there (the pole's
  // push, pull and take, in that order).
  function candidates(s, x, y) {
    if (aim.kind === 'throw') return [{ a: 'throw', uid: aim.uid, x, y }];
    const it = itemOf(s, aim.uid);
    return it && it.form === 'pole' ? ['push', 'pull', 'take'].map(how => ({ a: 'use', uid: aim.uid, x, y, how })) : [{ a: 'use', uid: aim.uid, x, y }];
  }
  // Those step() takes now (Labels.allowed, the test every button passes).
  const legalAt = (s, x, y) => candidates(s, x, y).filter(a => Labels.allowed(s, a));
  // Why none is taken at (x, y): the refusal step() gives, tried on a copy of the state, so
  // the sentence is the game's own; for the pole, the most telling of its three (that there
  // is no exhibit or nothing to take only when nothing more is wrong). {action, sentence}.
  const VAGUE = ['no_exhibit', 'nothing_to_take'];
  let why = { state: null, key: '', out: null };
  function refusal(s, x, y) {
    const key = `${s.tick}|${s.turn}|${aim.uid}|${x},${y}|${s.you.tote.join()}|${s.run.knownSeals.join()}`;
    if (why.state === s && why.key === key) return why.out;
    const names = Labels.nameOf(s), tries = candidates(s, x, y).map(action => ({ action, e: Step.step(State.clone(s), action).find(e => e.k === 'refused') || null }));
    const best = tries.find(t => t.e && !VAGUE.includes(t.e.reason)) || tries.find(t => t.e) || tries[0];
    const out = { action: best.action, reason: best.e ? best.e.reason : null, sentence: best.e ? Text.event(best.e, names) : 'It cannot be used there now.' };
    why = { state: s, key, out };
    return out;
  }
  function tapAim(t) {
    const s = st();
    if (!aim || !t || !s || s.over || pick || !Number.isInteger(t.x) || !Number.isInteger(t.y)) return null;
    if (!aim.tile || aim.tile.x !== t.x || aim.tile.y !== t.y) { aim.tile = { x: t.x, y: t.y }; return null; }
    // The one action there; the aim ends once it has taken its time (render), so a
    // confirmation it asks, cancelled, leaves the aim for another tile.
    const legal = legalAt(s, t.x, t.y);
    if (legal.length === 1) return legal[0];
    if (legal.length > 1) { pick = legal; return null; }
    // Refused there: step() says why, in the log, and the aim stays for another tile.
    return refusal(s, t.x, t.y).action;
  }
  function aiming() {
    if (aim) return aim.tile ? { kind: aim.kind, uid: aim.uid, x: aim.tile.x, y: aim.tile.y } : { kind: aim.kind, uid: aim.uid };
    if (mode === 'bag' && view.k === 'restore') return { kind: 'item', uid: view.uid };
    return null;
  }
  // The keyboard's aim (§7.1): a key moves the previewed tile a step, as a first tap on the
  // tile it comes to (its marks and words, or the refusal); Enter is the second tap (main.js).
  function cursor(dir) {
    const s = st();
    if (!aim || pick || !s || s.over || !Number.isInteger(dir) || dir < 0 || dir > 7) return false;
    const me = s.actors[0], from = aim.tile || { x: me.x, y: me.y };
    const x = Math.max(0, Math.min(s.dept.w - 1, from.x + Grid.DX[dir])), y = Math.max(0, Math.min(s.dept.h - 1, from.y + Grid.DY[dir]));
    aim.tile = { x, y };
    return true;
  }
  // The tiles the aim can be used at now, those with an exhibit in view on them first, each
  // group nearest first (then row-major): what x steps through while aiming.
  function aimTiles(s) {
    const it = itemOf(s, aim.uid), me = s.actors[0], vm = ViewModel.derive(s, {});
    const tiles = aim.kind === 'throw' ? Consumables.targets(s, aim.uid) : it ? Kit.targets(s, aim.uid) : [];
    const someone = (x, y) => vm.actors.some(a => a.uid !== 'you' && x >= a.x && y >= a.y && x < a.x + a.size && y < a.y + a.size);
    const d = ([x, y]) => Math.max(Math.abs(x - me.x), Math.abs(y - me.y));
    return tiles.filter(([x, y]) => legalAt(s, x, y).length).map(t => ({ t, k: someone(t[0], t[1]) ? 0 : 1 }))
      .sort((p, q) => p.k - q.k || d(p.t) - d(q.t) || p.t[1] - q.t[1] || p.t[0] - q.t[0]).map(q => q.t);
  }
  function cycleAim(by) {
    const s = st();
    if (!aim || pick || !s || s.over) return false;
    const list = aimTiles(s);
    if (!list.length) return false;
    const i = aim.tile ? list.findIndex(([x, y]) => x === aim.tile.x && y === aim.tile.y) : -1;
    const j = i < 0 ? (by > 0 ? 0 : list.length - 1) : (i + by + list.length) % list.length;
    aim.tile = { x: list[j][0], y: list[j][1] };
    return true;
  }
  function aimDefault() {
    const s = st();
    if (!aim || aim.tile || pick || !s || s.over) return false;
    if (cycleAim(1)) return true;
    const me = s.actors[0];
    aim.tile = { x: me.x, y: me.y };
    return true;
  }

  // What the aim strip says: what you aim, then what a tap does there, or why it cannot be
  // used there (the game's refusal), or, before a tap, how to aim (or that nothing is in
  // reach now). Short, so that it fits the strip at every text size.
  function aimWords(s) {
    const it = itemOf(s, aim.uid), name = nameOf(s, aim.uid);
    const names = Labels.nameOf(s), who = (x, y) => { const a = Actors.at(s, x, y); return (a && names(a.uid)) || 'the exhibit'; };
    const I = aim.kind === 'tile' && own(Registry.INSTRUMENTS, it.form) ? Registry.INSTRUMENTS[it.form] : null, range = I ? N[I.row][2] : 0;
    const head = aim.kind === 'throw' ? `Throwing ${name}.` : `${I ? I.name : name}, ${it.charges} of ${plural(it.max, 'charge', 'charges')}.`;
    if (!aim.tile) {
      if (aim.kind === 'throw') return { head, text: Consumables.targets(s, aim.uid).length ? `Tap a tile within ${N.THROW_RANGE} tiles, then tap it again to throw.` : 'There is no tile you can throw it at from here.' };
      if (!Kit.targets(s, aim.uid).length) return { head, text: it.charges < 1 ? Text.refusal('no_charges') : 'There is no tile it can be used at from here.' };
      return { head, text: it.form === 'pin_driver' ? `Tap an exhibit within ${range} tiles, then tap it again to fire.`
        : it.form === 'pole' ? `Tap an exhibit, or an opened or broken case, within ${range} tiles, then tap it again.`
          : `Tap a tile within ${range} tiles, then tap it again to strike.` };
    }
    const { x, y } = aim.tile, legal = legalAt(s, x, y);
    if (!legal.length) return { head, text: refusal(s, x, y).sentence, refused: true };
    if (legal.length > 1) return { head, text: 'Tap it again to choose what the pole does here.' };
    const a = legal[0];
    if (a.a === 'throw') {
      const ck = it.ck, known = Consumables.known(s, ck), side = known ? N[Registry.CONSUMABLES[ck].area] : Consumables.AREA;
      return { head, text: known ? `Tap it again to throw it here; it covers the marked ${side}×${side}.`
        : `Tap it again to throw it here. Its kind unknown, the mark is the largest any Solution covers: ${side}×${side}.` };
    }
    if (a.how === 'push' || a.how === 'pull') return { head, text: `Tap it again to ${a.how} ${who(x, y)} one tile ${a.how === 'push' ? 'away' : 'toward you'}.` };
    if (a.how === 'take') return { head, text: 'Tap it again to take what the case holds.' };
    if (it.form === 'pin_driver') return { head, text: `Tap it again to fire a bolt at ${who(x, y)}.` };
    return { head, text: 'Tap it again to strike the fork here: a soft noise, as if you made it.' };
  }
  function drawAim(s) {
    const on = !!aim && !!s && !s.over;
    el.aim.classList.toggle('open', on);
    if (el.app) el.app.classList.toggle('bag-aiming', on);
    const w = on ? aimWords(s) : null, html = w ? `<b>${esc(w.head)}</b> ${esc(w.text)}` : '';
    el.aimText.classList.toggle('refused', !!w && !!w.refused);
    if (html !== shown.aim) { el.aimText.innerHTML = html; shown.aim = html; }
  }
  function drawPick(s) {
    const on = !!pick && !!aim && !!s && !s.over;
    el.pick.classList.toggle('open', on);
    const html = on ? `<div class="box"><h2 id="bagpick-title">The Window Pole</h2><p>What should it do at this tile?</p><div class="acts">${
      pick.map((a, i) => `<button class="btn" data-pick="${i}" data-how="${a.how}"${UI.keyAttrs(String(i + 1))}>${esc(POLE_SAYS[a.how])}</button>`).join('')}<button class="btn" data-pick-cancel${UI.keyAttrs('Escape')}>Cancel</button></div></div>` : '';
    if (html !== shown.pick) {
      const inside = el.pick.contains(document.activeElement);
      el.pick.innerHTML = html; shown.pick = html;
      if (on) { const b = el.pick.querySelector('[data-pick]'); if (b) b.focus({ preventScroll: true }); }
      // Closed, it gives the focus back to the board, where the aim goes on.
      else if (inside || document.activeElement === document.body) { el.pick.classList.remove('open'); UI.sync(); UI.focusBoard(); }
    }
  }

  // ---- The panel ----

  function head(title) {
    return `<div class="ohead"><h2 id="bag-title">${esc(title)}</h2><span class="ohead-btns"><button class="btn" data-how aria-label="How the museum works"${UI.keyAttrs('?', false)}>?</button><button class="btn" data-close${UI.keyAttrs('Escape')}>Close</button></span></div>`;
  }
  // A row for an item you carry: its pictogram, name and what it is (its slot when worn).
  function row(uid, note) {
    const l = labelOf(uid);
    if (!l) return '';
    const p = l.pictos[0], c = lastVm && (lastVm.you.consumables || []).find(q => q.uid === uid);
    const kind = c ? (c.kind && own(Registry.CONSUMABLES, c.kind) ? 'it is ' + Registry.CONSUMABLES[c.kind].name : 'not identified') : '';
    // What it is, unless its name already says so ("A Heavy weapon, tier 1").
    const is = p && !l.title.toLowerCase().includes(p.text.toLowerCase()) ? p.text : '';
    const what = [note, is, kind].filter(Boolean).join(' · ');
    return `<li><button class="btn bag-row" data-item="${esc(uid)}">${P(p ? p.icon : 'kit', 20)}<span class="bag-text"><span class="bag-name">${esc(l.title)}</span>${what ? `<span class="bag-note">${esc(what)}</span>` : ''}</span></button></li>`;
  }
  // The Catalogue Card's choice (vm.pending): one button for each seal you do not know, with
  // what you carry under it.
  function choice(vm) {
    const p = vm.pending;
    if (!p || p.k !== 'seal' || !Array.isArray(p.options)) return '';
    const opts = p.options.map((seal, i) => {
      const S = own(Registry.SEALS, seal) ? Registry.SEALS[seal] : null, mine = (vm.you.consumables || []).filter(c => c.seal === seal);
      const note = mine.length ? 'You carry ' + mine.map(c => c.local + (c.n > 1 ? ` (${c.n})` : '')).join(', ') + '.' : 'You carry none.';
      return `<button class="btn bag-row" data-choose="${i}">${P(S && S.shape ? 'seal_' + S.shape : 'seal', 20)}<span class="bag-text"><span class="bag-name">${esc(S ? cap(S.name) : seal)}</span><span class="bag-note">${esc(note)}</span></span></button>`;
    }).join('');
    return `<section class="bag-card bag-choice"><h2>Catalogue Card</h2><p>Choose a seal to identify: you will know its kind for the rest of the run. Nothing else can be done until you choose.</p><div class="bag-opts">${opts}</div></section>`;
  }
  function list(vm) {
    const k = vm.you.kit, worn = [['weapon', k.weapon], ['garment', k.garment], ['curio0', k.curio[0]], ['curio1', k.curio[1]], ['instrument', k.instrument]];
    let html = `<h3>Worn</h3><ul class="bag-list">`;
    for (const [slot, uid] of worn) html += uid ? row(uid, SLOT_NAMES[slot]) : `<li class="bag-empty">${SLOT_NAMES[slot]}: empty</li>`;
    html += `</ul><h3>Tote: ${vm.you.tote.length} of ${N.TOTE_SLOTS} slots</h3><ul class="bag-list">`;
    html += vm.you.tote.length ? vm.you.tote.map(uid => row(uid, '')).join('') : '<li class="bag-empty">Nothing in your tote.</li>';
    return html + '</ul>';
  }
  // An item's label, as the label panel shows it (§8.8), on a card, with its buttons.
  function card(l, body) {
    const tomb = l.tomb ? [l.tomb.maker, l.tomb.date, l.tomb.medium, l.tomb.dims, l.tomb.credit, l.number].filter(Boolean).map(esc).join(' · ') : '';
    return `<section class="bag-card label"><h2><span>${esc(l.title)}</span></h2>${tomb ? `<div class="tomb">${tomb}</div>` : ''}
      ${l.pictos.length ? `<div class="pictos">${l.pictos.map(p => `<span>${P(p.icon, 14)}${esc(p.text)}</span>`).join('')}</div>` : ''}
      ${l.behaviour ? `<div class="beh">${esc(l.behaviour)}</div>` : ''}
      ${l.odds && l.odds.length ? `<div class="odds">${l.odds.map(esc).join('<br>')}</div>` : ''}
      ${l.paragraph ? `<div class="para">${esc(l.paragraph)}</div>` : ''}${body}</section>`;
  }
  function itemView(s, uid) {
    const l = labelOf(uid), it = itemOf(s, uid);
    if (!l || !carried(s, uid)) return null;
    const where = it.where.at === 'kit' ? `You wear it, in your ${SLOT_NAMES[it.where.slot].toLowerCase()}.` : 'It is in your tote.';
    const keys = UI.keysFor(l.actions);
    const acts = l.actions.length ? `<div class="acts">${l.actions.map((a, i) => `<button class="btn" data-do="${i}" data-action="${esc(a.id)}"${UI.keyAttrs(keys[i])}>${esc(a.text)}</button>`).join('')}</div>`
      : `<p class="bag-none">${s.ui && s.ui.pendingChoice ? 'Answer the Catalogue Card first.' : 'There is nothing to do with it now.'}</p>`;
    return `<button class="btn bag-back" data-back${UI.keyAttrs('Backspace')}>Back</button>` + card(l, `<p class="bag-where">${esc(where)}</p>${acts}`);
  }
  // A Restoration kit's items: those its legal uses name, in Kit.useLegal's order (what you
  // wear in slot order, then your tote). A first tap on one shows what it would gain; a
  // second uses the kit on it.
  function restoreTargets(s, kit) {
    const legal = Step.legal(s);
    return Kit.useLegal(s).filter(a => a.uid === kit && typeof a.on === 'string' && legal.some(q => same(q, a)));
  }
  function restoreView(s) {
    const l = labelOf(view.uid);
    if (!l || !carried(s, view.uid)) return null;
    const acts = restoreTargets(s, view.uid);
    const rows = acts.map(a => {
      const t = labelOf(a.on), it = itemOf(s, a.on), sel = view.on === a.on;
      if (!t) return '';
      const where = it.where.at === 'kit' ? SLOT_NAMES[it.where.slot] : 'In your tote';
      const gain = sel ? preview(s, view.uid, a.on) : '';
      return `<li><button class="btn bag-row${sel ? ' chosen' : ''}" data-on="${esc(a.on)}" aria-pressed="${sel}">${P(t.pictos[0] ? t.pictos[0].icon : 'kit', 20)}<span class="bag-text"><span class="bag-name">${esc(t.title)}</span><span class="bag-note">${esc(where)}</span>${gain ? `<span class="bag-gain">${esc(gain)}</span>` : ''}</span></button></li>`;
    }).join('');
    const say = acts.length ? 'Tap an item to see what it would gain, then tap it again to use the kit on it.' : 'There is nothing you wear or carry that it can be used on now.';
    return `<button class="btn bag-back" data-back${UI.keyAttrs('Backspace')}>Back</button>` + card(l, `<h3>Use it on</h3><p class="bag-where">${esc(say)}</p><ul class="bag-list">${rows}</ul>`);
  }
  // What one level gives the item: Kit.restore on a copy of the state, read back through
  // Kit.describe (its own numbers at your grade before any bonus, its rank, bonuses and
  // charges), so the preview is what the rule does.
  function preview(s, kit, on) {
    const c = State.clone(s);
    if (typeof Kit.restore(c, kit, on, []) === 'string') return '';
    const b = Kit.describe(s, on), a = Kit.describe(c, on), out = [`level ${b.level} → ${a.level}`];
    const sign = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
    if (b.stats && a.stats) {
      if (b.stats.dmin !== a.stats.dmin || b.stats.dmax !== a.stats.dmax) out.push(`damage ${b.stats.dmin}–${b.stats.dmax} → ${a.stats.dmin}–${a.stats.dmax}`);
      if (b.stats.acc !== a.stats.acc) out.push(`Acc ${sign(b.stats.acc)} → ${sign(a.stats.acc)}`);
      if (b.stats.pad !== a.stats.pad) out.push(`Padding ${b.stats.pad} → ${a.stats.pad}`);
    }
    if (b.rank !== a.rank) out.push(`rank ${b.rank} → ${a.rank}`);
    const NAME = { dmg: 'damage', acc: 'Acc', eva: 'Eva', pad: 'Padding' };
    b.bonuses.forEach((x, i) => { const y = a.bonuses[i]; if (y && Number.isInteger(x.n) && x.n !== y.n && own(NAME, x.id)) out.push(`its ${NAME[x.id]} bonus ${sign(x.n)} → ${sign(y.n)}`); });
    if (b.instrument && a.instrument && (b.instrument.max !== a.instrument.max || b.instrument.charges !== a.instrument.charges)) out.push(`charges ${b.instrument.charges} of ${b.instrument.max} → ${a.instrument.charges} of ${a.instrument.max}`);
    return cap(out.join('; ')) + (b.stats ? ' (before any bonus).' : '.');
  }

  // The floor plan: the department as you know it (vm.tiles: what you see and remember;
  // all of it once a Floor Plan is read here), you, the exits, and the rooms that still hold
  // a Highlight (vm.plan), each drawn with its own shape, so colour is never the only sign.
  function mapView(s, vm) {
    const room = s.dept.roomOf && s.dept.roomOf[vm.you.y] ? (s.dept.rooms || []).find(r => r.id === s.dept.roomOf[vm.you.y][vm.you.x]) : null;
    const here = room && room.number ? ` You are in Room ${room.number}.` : '';
    let say;
    const rooms = (vm.plan || []).map(r => 'Room ' + (r.number === null ? r.key : r.number));
    const and = rooms.length > 1 ? rooms.slice(0, -1).join(', ') + ' and ' + rooms[rooms.length - 1] : rooms.join('');
    if (vm.plan === null) say = `This is what you have seen of the department.${here} A Floor Plan, read here, shows all of it and the rooms whose Highlights have not been taken.`;
    else if (!rooms.length) say = `You have read a Floor Plan here, so all of the department is drawn; every Highlight has been taken.${here}`;
    else say = `You have read a Floor Plan here, so all of the department is drawn. The ${rooms.length === 1 ? 'room whose Highlight has' : 'rooms whose Highlights have'} not been taken ${rooms.length === 1 ? 'is' : 'are'} outlined: ${and}.${here}`;
    return `<p class="bag-where map-say">${esc(say)}</p><div class="map-box"><canvas class="bag-map" role="img" aria-label="${esc(say)}"></canvas></div>
      <p class="map-key">You: the ringed square. Exits: the crossed tiles; the entrance: the slashed one. Doors: a band across the tile, with a dot on a staff door. Cases: a framed square, filled while shut.${vm.plan && vm.plan.length ? ' Rooms with a Highlight: the dashed outlines, with their numbers.' : ''}</p>`;
  }
  // Each tile's tint, and for a door, a staff door or a case a shape too, so colour is never
  // the only sign (§7.2): a door is a band across its tile, a staff door's band has a dark dot,
  // a shut case is a filled frame and an opened or broken one an empty frame (the exits'
  // crosses and the entrance's slash are drawn in drawMap). null: nothing is drawn there.
  const MAP = { wall: '#5b5563', floor: '#cfc6b3', door: '#a8743a', staff: '#7c5a9a', glass: '#7fb2c8', open: '#7d8f96', pool: '#6f93bd', thing: '#8f8573', dark: '#15131a' };
  function tileLook(ch) {
    const t = Grid.TILES[ch];
    if (!t) return null;
    if ('+\''.includes(ch)) return { fill: MAP.floor, shape: 'band', ink: MAP.door };
    if ('Ss'.includes(ch)) return { fill: MAP.floor, shape: 'band dot', ink: MAP.staff };
    if (ch === 'v') return { fill: MAP.glass, shape: 'frame', ink: MAP.dark };
    if ('uk'.includes(ch)) return { fill: MAP.floor, shape: 'frame', ink: MAP.open };
    if (ch === 'w') return { fill: MAP.pool, shape: '' };
    return { fill: t.walk ? MAP.floor : t.see ? MAP.thing : MAP.wall, shape: '' };
  }
  function drawShape(x, look, X, Y, px) {
    if (look.shape.includes('band')) { const b = Math.max(1, Math.round(px * 0.4)); x.fillStyle = look.ink; x.fillRect(X, Y + Math.floor((px - b) / 2), px, b); }
    if (look.shape.includes('dot')) { const d = Math.max(1, Math.round(px * 0.3)), o = Math.floor((px - d) / 2); x.fillStyle = MAP.dark; x.fillRect(X + o, Y + o, d, d); }
    if (look.shape === 'frame') { const w = Math.max(1, Math.round(px / 5)); x.strokeStyle = look.ink; x.lineWidth = w; x.strokeRect(X + w / 2, Y + w / 2, px - w, px - w); }
  }
  function drawMap(vm) {
    const c = el.panel.querySelector('canvas.bag-map');
    if (!c) return;
    const box = c.parentElement.getBoundingClientRect(), maxH = Math.max(120, Math.floor(window.innerHeight * 0.55));
    const px = Math.max(3, Math.min(24, Math.floor(Math.min(box.width / vm.w, maxH / vm.h))));
    const W = vm.w * px, H = vm.h * px, dpr = window.devicePixelRatio || 1;
    c.style.width = W + 'px'; c.style.height = H + 'px'; c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    const x = c.getContext('2d'), S = ART.palettes.semantic;
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    for (let ty = 0; ty < vm.h; ty++) for (let tx = 0; tx < vm.w; tx++) {
      const v = vm.vis[ty * vm.w + tx], ch = vm.tiles[ty][tx], look = v ? tileLook(ch) : null;
      if (!look) continue;
      x.globalAlpha = v === 2 ? 1 : 0.72; x.fillStyle = look.fill; x.fillRect(tx * px, ty * px, px, px);
      if (look.shape) drawShape(x, look, tx * px, ty * px, px);
      if (ch === 'X' || ch === 'E') {
        x.globalAlpha = 1; x.strokeStyle = ch === 'X' ? S.readable : '#ece6d8'; x.lineWidth = Math.max(1, px / 6);
        x.beginPath(); x.moveTo(tx * px + 1, ty * px + 1); x.lineTo(tx * px + px - 1, ty * px + px - 1);
        if (ch === 'X') { x.moveTo(tx * px + px - 1, ty * px + 1); x.lineTo(tx * px + 1, ty * px + px - 1); }
        x.stroke();
      }
    }
    x.globalAlpha = 1;
    for (const r of vm.plan || []) {
      if (!Number.isInteger(r.x0)) continue;
      x.setLineDash([Math.max(2, px / 2), Math.max(2, px / 3)]); x.strokeStyle = S.item; x.lineWidth = Math.max(2, px / 4);
      x.strokeRect(r.x0 * px + 1, r.y0 * px + 1, (r.x1 - r.x0 + 1) * px - 2, (r.y1 - r.y0 + 1) * px - 2);
      x.setLineDash([]);
      const label = String(r.number === null ? r.key : r.number), fs = Math.max(9, Math.min(16, px));
      x.font = `600 ${fs}px system-ui, sans-serif`; x.textBaseline = 'top';
      const tw = x.measureText(label).width;
      x.fillStyle = 'rgba(10,9,13,0.85)'; x.fillRect(r.x0 * px + 3, r.y0 * px + 3, tw + 6, fs + 4);
      x.fillStyle = S.item; x.fillText(label, r.x0 * px + 6, r.y0 * px + 5);
    }
    const ux = vm.you.x * px + px / 2, uy = vm.you.y * px + px / 2, rr = Math.max(3, px * 0.9);
    x.fillStyle = S.player; x.fillRect(vm.you.x * px, vm.you.y * px, px, px);
    x.strokeStyle = S.player; x.lineWidth = Math.max(1.5, px / 5); x.beginPath(); x.arc(ux, uy, rr, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = '#15131a'; x.lineWidth = 1; x.strokeRect(vm.you.x * px + 0.5, vm.you.y * px + 0.5, px - 1, px - 1);
  }

  function drawPanel(s, vm) {
    const on = !!mode && !!s && !s.over && !!vm;
    if (!on) {
      if (mode && (!s || s.over)) close();
      el.panel.classList.remove('open');
      if (shown.panel) { el.panel.innerHTML = ''; shown.panel = ''; }
      return;
    }
    let html;
    if (mode === 'map') html = head('Floor plan') + mapView(s, vm);
    else {
      let body = null;
      if (view.k === 'item') body = itemView(s, view.uid);
      else if (view.k === 'restore') body = restoreView(s);
      if (body === null) { view = { k: 'list' }; body = list(vm); }
      html = head('Bag') + choice(vm) + body;
    }
    el.panel.classList.add('open');
    let had = null;
    if (html !== shown.panel) {
      // Rebuilt, it keeps its scroll, and a keyboard's focus stays on the same button (a
      // chosen item, the same action) or else goes to the view's first control, so Tab and
      // the arrows go on inside it.
      const top = el.panel.scrollTop;
      had = el.panel.contains(document.activeElement) ? document.activeElement : null;
      const key = had && had !== el.panel && !keyed ? ['on', 'item', 'action', 'choose'].filter(k => had.dataset[k] !== undefined).map(k => `[data-${k}="${had.dataset[k]}"]`)[0] : null;
      el.panel.innerHTML = html; shown.panel = html;
      el.panel.scrollTop = top;
      const same = key && el.panel.querySelector(key);
      if (same) same.focus({ preventScroll: true });
      else if (had) keyed = true;
    }
    if (mode === 'map') drawMap(vm);
    // The view's first control: the Card's first seal; a kit's chosen item, or its first; an
    // item's first action; the first item; the map's Close.
    if (focusIn || keyed) {
      focusIn = false; keyed = false;
      const first = el.panel.querySelector('[data-choose]') || el.panel.querySelector('[data-on].chosen') || el.panel.querySelector('[data-on]')
        || el.panel.querySelector('[data-do]') || el.panel.querySelector('[data-item]') || el.panel.querySelector('[data-close]');
      (first || el.panel).focus({ preventScroll: true });
    }
  }
  function onPanel(e) {
    const s = st(), b = e.target.closest('button');
    if (!b || !s) return;
    if (b.matches('[data-close]')) { close(); redraw(); return; }
    if (b.matches('[data-how]')) { UI.toggle('how', true); return; }
    if (b.matches('[data-back]')) { view = view.k === 'restore' && view.from ? { k: 'item', uid: view.uid } : { k: 'list' }; el.panel.scrollTop = 0; keyed = true; redraw(); return; }
    if (b.dataset.choose !== undefined) { close(); ask({ a: 'choose', index: Number(b.dataset.choose) }); return; }
    if (b.dataset.item !== undefined) { view = { k: 'item', uid: b.dataset.item }; el.panel.scrollTop = 0; keyed = true; redraw(); return; }
    if (b.dataset.on !== undefined && view.k === 'restore') {
      if (view.on !== b.dataset.on) { view.on = b.dataset.on; redraw(); return; }
      const a = restoreTargets(s, view.uid).find(q => q.on === view.on);
      close(); ask(a);
      return;
    }
    if (b.dataset.do !== undefined && view.k === 'item') {
      const l = labelOf(view.uid), a = l && l.actions[Number(b.dataset.do)];
      if (!a) return;
      if (a.aim === 'tile') { startAim(s, view.uid); redraw(); return; }
      if (a.aim === 'item') { view = { k: 'restore', uid: view.uid, on: null, from: 'item' }; el.panel.scrollTop = 0; keyed = true; redraw(); return; }
      if (a.act) { close(); ask(a.act); }
    }
  }

  // ---- Every draw ----

  function render(vm, labels) {
    lastVm = vm; lastLabels = labels || null;
    const s = st();
    if (!el.panel || !vm || !vm.you) return;
    drawSlots(vm);
    // A new choice waiting (the Catalogue Card's) opens the Bag on it, once.
    const pending = vm.pending ? JSON.stringify(vm.pending) : null;
    if (pending && pending !== seenPending && s && !s.over) show('bag');
    seenPending = pending;
    // An aim ends once time has passed: its own action was taken (whatever is left of a stack
    // too), or another was (Wait, a key), after which what the strip said no longer holds and
    // a phone's strip must show what happened; also when what it aims is no longer yours to
    // use, or the visit is over. The board loses its marks at the next draw. (A refusal, or a
    // confirmation cancelled, takes no time, so the aim stays for another tile.)
    if (aim && (!s || s.over || s.tick !== aim.tick || !carried(s, aim.uid) || (aim.kind === 'tile' && s.you.kit.instrument !== aim.uid))) {
      endAim();
      if (!redrawSoon) { redrawSoon = true; setTimeout(() => { redrawSoon = false; redraw(); }, 0); }
    }
    drawAim(s);
    drawPick(s);
    drawPanel(s, vm);
  }

  return { attach, render, open, close, quick, map, aiming, tapAim, cursor, cycleAim, aimDefault, picking, cancelPick, key, shown: () => mode };
})();
