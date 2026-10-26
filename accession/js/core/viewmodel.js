// ACCESSION — the view model: a plain description of what to draw, derived from the state
// (BUILD.md §6.1). Both board views read this and nothing else, and bots see only this, so
// it shows what a player sees and no more: unseen tiles are masked, and what lies on a tile
// (an exhibit, a case, an item, a mark) is listed only where the tile is in view.
//
// ViewModel.derive(state, ui) → vm. ui is what the interface adds (all optional):
//   events        the last step's events, for the one-turn cues and the noise rings;
//   path          the path preview, [[x, y]…];  selection  an actor's uid;  selectedTile {x, y};
//   aim           {x, y, uid?, size?}: the tile you are aiming at, and the item you aim (a
//                 Solution's square is drawn round it, its own size once its kind is known,
//                 the largest Solution's while it is not); size, given, sets that square.
// vm:
//   dept, w, h, turn, over
//   tiles         the map's rows, with every tile you have not seen as ' ' (§10.2, D7.7)
//   vis           per tile: 0 unseen, 1 remembered, 2 visible now;  ring  1 inside your ring
//   actors        you (always first), then each actor on a visible tile, never one that shows
//                 as something else (a mimic in its disguise): {uid, sprite, x, y, size, mode,
//                 pips, hostile, hp, maxHp, telegraphing, statuses, encased}
//   marks         unique by kind:x,y — {kind: 'telegraph', x, y, dmg, by} and {kind: 'call', x,
//                 y, by} on visible tiles (Specials.marks); {kind: 'noise', x, y, cls} on visible
//                 or remembered tiles, the loudest class where two noises of the step reach
//                 one; {kind: 'area', x, y} and {kind: 'aim', x, y} from ui.aim
//   cues          {movedFrom: [{uid, x, y}], hit: [uid], broke: [{x, y}], special: [uid]}
//   cases, staff, items, plaques, surfaces   what stands or lies on visible tiles
//   you           {x, y, hp, maxHp, grade, statuses, kit, tote, consumables, charges, seated,
//                 acc, eva, pad}
//   clock         Clock.view(state), and turn (its count, where the dial's hand points), or null
//   plan          null, or once a Floor Plan has been read here the rooms that still hold a
//                 Highlight, [{key, number, x0, y0, x1, y1}]
//   known, pending   the seals identified, with their kinds; the choice waiting, if any
//   camera        the tile to centre: you, leaning towards a telegraph that covers you
//   path, selection, selectedTile   as ui gave them
'use strict';
const ViewModel = (() => {
  // How far, in tiles each way, the camera leans from you towards a telegraph that covers you
  // (§7.2, "Auto-pan when a telegraph targets you"): little enough that you stay in view at
  // every zoom step of both views (the narrowest shows about 7 tiles across).
  const LEAN = 2;
  // Noise classes from quietest to loudest; a tile two noises reach shows the louder.
  const LOUDNESS = ['soft', 'loud', 'crash'];

  // A cue list holds each uid once, in the order the events give them.
  const once = (list, v) => { if (!list.includes(v)) list.push(v); };

  function derive(state, ui) {
    ui = ui || {};
    const m = state.dept, you = state.actors[0], n = m.w * m.h, events = ui.events || [];
    const now = Vision.visible(state), vis = new Uint8Array(n);
    for (let i = 0; i < n; i++) vis[i] = now[i] ? 2 : (m.seen && m.seen.charCodeAt(i) === 49 ? 1 : 0);
    const inside = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < m.w && y < m.h;
    const visible = (x, y) => inside(x, y) && vis[y * m.w + x] === 2;
    const known = (x, y) => inside(x, y) && vis[y * m.w + x] > 0;
    const ring = Vision.ring(state);

    // The map as you know it: a tile you have never seen is ' ', which nothing can walk on or
    // see through, so a board rebuilt from the view model shows only what a player has seen.
    const tiles = [];
    for (let y = 0; y < m.h; y++) {
      const row = m.tiles[y];
      let out = '', from = 0;
      for (let x = 0; x < m.w; x++) if (!vis[y * m.w + x]) { out += row.slice(from, x) + ' '; from = x + 1; }
      tiles.push(from === 0 ? row : out + row.slice(from));
    }

    // The observed actors: you, and each actor with a tile in view; never one that shows as
    // something else, a mimic in its disguise, which is a case to everything you see
    // (Archetypes.present; §8.3).
    const actors = [];
    for (const a of state.actors) {
      const me = a.uid === 'you';
      if (a.gone || (!me && Archetypes.present(state, a) !== null)) continue;
      if (!me && !Actors.footprint(a).some(([x, y]) => visible(x, y))) continue;
      const sp = me ? null : Packs.speciesFor(state, a);
      actors.push({ uid: a.uid, sprite: me ? 'visitor' : (sp ? sp.sprite : 'seated_clerk'), x: a.x, y: a.y, size: a.size || 1,
        mode: me ? 'you' : a.mode, pips: a.pips || 0, hostile: !me, hp: a.hp, maxHp: a.maxHp,
        telegraphing: a.telegraph ? a.telegraph.sp : null, statuses: (a.statuses || []).map(s => s.id), encased: Cases.encased(state, a) });
    }
    const listed = actors.map(a => a.uid);

    // The marks. Pending specials first, in spawn order, each tile once per kind: a damage
    // mark shows what you would take there (Specials.marks: net of your Padding now); calls
    // never block one another, so two heralds' calls on one tile make one call mark.
    const marks = [], ids = new Set();
    const mark = rec => { const id = rec.kind + ':' + rec.x + ',' + rec.y; if (ids.has(id)) return; ids.add(id); marks.push(rec); };
    for (const k of Specials.marks(state)) {
      if (!visible(k.x, k.y)) continue;
      mark(k.kind === 'telegraph' ? { kind: 'telegraph', x: k.x, y: k.y, dmg: k.dmg, by: k.by } : { kind: 'call', x: k.x, y: k.y, by: k.by });
    }
    // The noise rings of the last step (§8.2, "What is shown"): every tile an exhibit could
    // stand on within each noise's walking reach (Noise.reach, as hearing measures it, a case
    // one beyond its nearest open neighbour), on tiles you see or remember, the loudest
    // class where two noises reach a tile. Each is measured on the map as it stood when the
    // noise was made (undo, below): a door an exhibit opens later in the step does not widen
    // a ring that was heard through it shut.
    const loud = new Uint8Array(n), reached = [];
    let then = m;
    for (let j = events.length - 1; j >= 0; j--) {
      const e = events[j];
      if (e.k !== 'noise') { then = undo(state, then, e); continue; }
      if (!inside(e.x, e.y) || !Number.isInteger(e.range)) continue;
      const rank = LOUDNESS.indexOf(e.cls) + 1;
      if (rank <= 0) continue;
      const d = Noise.reach(then, e.x, e.y, e.range);
      for (let y = Math.max(0, e.y - e.range); y <= Math.min(m.h - 1, e.y + e.range); y++)
        for (let x = Math.max(0, e.x - e.range); x <= Math.min(m.w - 1, e.x + e.range); x++) {
          const i = y * m.w + x;
          if (!vis[i] || !Grid.hold(then, x, y)) continue;
          const dist = Grid.reachDist(d, then, x, y);
          if (dist < 0 || dist > e.range) continue;
          if (!loud[i]) reached.push(i);
          if (rank > loud[i]) loud[i] = rank;
        }
    }
    reached.sort((a, b) => a - b);
    for (const i of reached) mark({ kind: 'noise', x: i % m.w, y: Int.idiv(i, m.w), cls: LOUDNESS[loud[i] - 1] });
    // What you are aiming at: the area a thrown Solution would cover, then the aimed tile.
    const aim = ui.aim && inside(ui.aim.x, ui.aim.y) ? ui.aim : null;
    if (aim) {
      const size = areaOf(state, aim);
      if (size) {
        const h = Int.idiv(size, 2);
        for (let y = aim.y - h; y <= aim.y + h; y++) for (let x = aim.x - h; x <= aim.x + h; x++) if (known(x, y)) mark({ kind: 'area', x, y });
      }
      if (known(aim.x, aim.y)) mark({ kind: 'aim', x: aim.x, y: aim.y });
    }

    // One-turn cues (§6.1), from the last step's events: the tile each listed actor moved from
    // (the first such tile in view, if it made several moves; none from a tile out of view,
    // which would show what lies there), who was hit, glass that broke on a tile in view,
    // and whose special resolved.
    const cues = { movedFrom: [], hit: [], broke: [], special: [] };
    for (const e of events) {
      if (e.k === 'moved') {
        const from = Array.isArray(e.from) ? e.from : [];
        if (listed.includes(e.who) && visible(from[0], from[1]) && !cues.movedFrom.some(c => c.uid === e.who)) cues.movedFrom.push({ uid: e.who, x: from[0], y: from[1] });
      } else if (e.k === 'damaged' && listed.includes(e.who)) once(cues.hit, e.who);
      else if (e.k === 'glass_broke' && visible(e.x, e.y) && !cues.broke.some(c => c.x === e.x && c.y === e.y)) cues.broke.push({ x: e.x, y: e.y });
      else if (e.k === 'special' && !e.cancelled && listed.includes(e.who)) once(cues.special, e.who);
    }

    // What stands or lies on the tiles in view: cases (a mimic in its disguise exactly as a
    // real case, with no number), staff doors, items (in state order: the kit's kinds, and
    // consumables with their seal's shape), identifying labels and surfaces.
    const cases = Cases.view(state, now);
    const staff = Cases.staffView(state, now);
    const kv = Kit.view(state, now), cv = Consumables.view(state, now);
    const lying = kv.items.concat(cv.items), items = [];
    for (const it of state.items || []) { const e = lying.find(l => l.uid === it.uid); if (e) items.push(e); }
    const surfaces = [];
    for (const s of m.surfaces || []) {
      const h = Int.idiv(s.size, 2);
      for (let y = s.y - h; y <= s.y + h; y++) for (let x = s.x - h; x <= s.x + h; x++)
        if (visible(x, y) && !surfaces.some(q => q.kind === s.kind && q.x === x && q.y === y)) surfaces.push({ kind: s.kind, x, y });
    }

    // The camera: on you, leaning towards a damage telegraph that covers your tile, so the
    // part of its marks in view shows with you.
    const camera = { x: you.x, y: you.y };
    const onYou = marks.find(k => k.kind === 'telegraph' && k.x === you.x && k.y === you.y);
    if (onYou) {
      let x0 = you.x, x1 = you.x, y0 = you.y, y1 = you.y;
      for (const k of marks) if (k.kind === 'telegraph' && k.by === onYou.by) { x0 = Math.min(x0, k.x); x1 = Math.max(x1, k.x); y0 = Math.min(y0, k.y); y1 = Math.max(y1, k.y); }
      camera.x = Math.max(you.x - LEAN, Math.min(you.x + LEAN, Int.idiv(x0 + x1, 2)));
      camera.y = Math.max(you.y - LEAN, Math.min(you.y + LEAN, Int.idiv(y0 + y1, 2)));
    }

    const pack = typeof Packs !== 'undefined' ? Packs.get(m.acc) : null;
    const cl = Clock.view(state);
    const plan = cv.plan === null ? null : cv.plan.map(key => {
      const r = (m.rooms || []).find(q => q.key === key);
      return r ? { key, number: r.number === undefined ? null : r.number, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 } : { key, number: null, x0: null, y0: null, x1: null, y1: null };
    });
    return {
      dept: pack ? pack.palette : 'T0', w: m.w, h: m.h, tiles, vis, ring, actors, marks, cues,
      cases, staff: staff.map(f => ({ x: f.x, y: f.y, grade: f.grade, open: f.open, canOpen: f.canOpen })),
      items, plaques: cv.plaques, surfaces,
      you: { x: you.x, y: you.y, hp: you.hp, maxHp: you.maxHp, grade: state.run.grade, statuses: (you.statuses || []).map(s => s.id),
        kit: kv.kit, tote: kv.tote, consumables: cv.tote, charges: kv.charges, seated: !!you.seated, acc: you.acc, eva: you.eva, pad: you.pad },
      turn: state.turn, over: state.over, camera,
      clock: cl ? Object.assign({ turn: cl.count }, cl) : null,
      plan, known: cv.known, pending: cv.pending,
      path: ui.path || null, selection: ui.selection || null, selectedTile: ui.selectedTile || null,
    };
  }

  // undo(state, map, e) → the map as it stood just before event e: e's change to a tile
  // that walking reads undone (a fresh copy is made the first time, so the state's map is
  // never written). Every such change a rule makes is told by an event (§4.1's list of tile
  // changes): a door or staff door opened ('opened') or closed ('closed'); a case opened
  // ('case_opened', its tile u), broken or dissolved ('glass_broke', k or u, or the floor of
  // a mimic's case); a mimic shown by a touch or a blow ('woke', its case revealed, its tile
  // floor again). Shards turn floor or archway into shards, which walking reads alike.
  // Walked back from the last event, so each noise meets the map of its moment.
  const SHUT = '+S', OPEN = "'s"; // a door and a staff door, shut and open
  function undo(state, map, e) {
    let at = null, ch = null;
    const here = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < map.w && y < map.h ? map.tiles[y][x] : null;
    if (e.k === 'opened' || e.k === 'closed') {
      const c = here(e.x, e.y), from = e.k === 'opened' ? OPEN : SHUT, to = e.k === 'opened' ? SHUT : OPEN, i = c === null ? -1 : from.indexOf(c);
      if (i >= 0) { at = [e.x, e.y]; ch = to[i]; }
    } else if (e.k === 'case_opened' || e.k === 'glass_broke') {
      if (here(e.x, e.y) !== null && here(e.x, e.y) !== 'v') { at = [e.x, e.y]; ch = 'v'; }
    } else if (e.k === 'woke' && e.cause && (e.cause.k === 'touch_case' || e.cause.k === 'damage')) {
      // A mimic shows itself as it wakes: from its disguise, its case tile was a vitrine.
      // (One that had shown itself before, gone back to sleep on its old case's tile and is
      // struck awake again is read the same way; no event tells the two apart.)
      const f = ((state.dept && state.dept.fixtures) || []).find(q => q.k === 'case' && q.mimic === e.who && q.st === 'revealed');
      if (f && here(f.x, f.y) !== null && here(f.x, f.y) !== 'v') { at = [f.x, f.y]; ch = 'v'; }
    }
    if (!at) return map;
    const out = map === state.dept ? { w: map.w, h: map.h, tiles: map.tiles.slice() } : map;
    const row = out.tiles[at[1]];
    out.tiles[at[1]] = row.slice(0, at[0]) + ch + row.slice(at[0] + 1);
    return out;
  }

  // The side of the square a thrown Solution would cover round ui.aim, or 0 for none: its
  // kind's area once identified, else the largest Solution's (so the square says nothing of
  // the kind); aim.size, given, sets it.
  function areaOf(state, aim) {
    if (Number.isInteger(aim.size) && aim.size > 0) return aim.size;
    if (typeof aim.uid !== 'string') return 0;
    const it = (state.items || []).find(i => i.uid === aim.uid);
    if (!it || it.kind !== 'consumable' || !Object.prototype.hasOwnProperty.call(Registry.CONSUMABLES, it.ck)) return 0;
    const c = Registry.CONSUMABLES[it.ck];
    if (c.cls !== 'solution') return 0;
    return Consumables.known(state, it.ck) ? N[c.area] : Consumables.AREA;
  }

  return { derive, LEAN };
})();
