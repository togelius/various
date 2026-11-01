// ACCESSION — viewing the Centrepiece, and the dust sheet that covers it afterwards (BUILD.md
// §4.1, §4.2, §8.7; M4 plan A4, D4.8, D4.9, D4.18, Q9, decided without play; revisit once M4
// is playable). Owned by PG-VIEW. The `view` action is defined here once (M4's skeleton) and
// handed to Viewing.legal, Viewing.candidates and Viewing.apply.
//
// The rule. Standing on the lectern's reading tile (dept.viewTile, which the layout puts
// exactly VIEW_DISTANCE walking tiles from the Centrepiece, in its sight), while every piece
// of the Centrepiece still standing sleeps and this visit has no Certificate yet, `view`
// spends a viewing turn (COST_VIEW) standing still. VIEW_TURNS views in a row earn the
// Certificate: a view continues the row when your last action that took time was a view and
// no piece of the Centrepiece has woken since that view; otherwise it starts a new row at 1.
// So any other action that takes time starts the count again (an action that takes none, a
// read or a choice, does not), and so does its waking: a pip that wakes it (your ring's,
// which a lit Lamp makes reach it from the reading tile, or a noise's) interrupts the count,
// and while it is awake every view is refused. Each view is told (viewed {who, of, n}, cause
// view), and its sentence says how many remain. The last view of the row, before the world
// acts, puts the Centrepiece under its dust sheet and then earns the Certificate
// (Progress.award, by view).
//
// The dust sheet (A8, A13, B8, PR10) is no defeat. Every piece still standing is gone (no
// death, so Combat.die, Centrepiece.onPieceDied, its drop and award('defeat') never run), and
// dept.cp.sheet {turn, uids} records it, which the hall reads: a sealed hall opens at the next
// turn boundary (why sheet), and none seals again. The Centrepiece's footprint, each piece's
// home tiles (where it was placed), becomes low furniture (f: no one steps onto it, sight and
// beams pass over it), each tile with a sheet fixture {k: 'sheet', x, y, of: the piece's uid},
// in cp.uids's order and then row-major, except a tile someone else stands on or one that is
// no longer floor or shards. Nothing under it can be viewed, struck, stepped onto or aimed at
// again (the `sheeted` refuser).
//
// The lectern. A department's lectern (dept.lectern, on the plan's `l`) is a fixture
// {k: 'lectern', x, y} once its Centrepiece is placed (Viewing.place, from Dept.create), read
// like a plaque (read(x, y), free, within READ_RANGE and in sight): its words are the pack's
// gateway label, the viewing rule (FIXTURES.lectern's clause) and what your ring does from the
// reading tile (the CLAUSES lectern_ring_* sentences, filled with the ring you would have
// there), which LABELS-M4's label for it shows too.
//
// dept.view {n, turn}, the views in the current row and the turn of the last, is absent until
// a view writes it (M4 plan A3), read through Viewing.of; dept.cp.sheet through
// Viewing.sheeted. Nothing here draws on a stream.
'use strict';
const Viewing = (() => {
  const isInt = Number.isInteger;
  const tile = t => Array.isArray(t) && t.length === 2 && isInt(t[0]) && isInt(t[1]);

  // ---- What it reads ----

  // Viewing.of(state) → {n, turn} | null: the views in the current row so far and the turn of
  // the last one (dept.view), a copy; null before the visit's first view.
  function of(state) {
    const v = state && state.dept && state.dept.view;
    return v ? { n: v.n, turn: v.turn } : null;
  }
  // Viewing.sheeted(state) → {turn, uids} | null: the dust sheet over the Centrepiece (dept.cp.
  // sheet: the turn it went under it and the pieces it covered), a copy; null while there is none.
  function sheeted(state) {
    const c = Hall.cp(state), s = c && c.sheet;
    return s ? { turn: s.turn, uids: (s.uids || []).slice() } : null;
  }
  // The pieces of the Centrepiece still standing, in cp.uids's order.
  const standing = state => Centrepiece.pieces(state).filter(a => !a.gone);
  // The reading tile, or null where the department has none.
  const readingTile = state => { const t = state.dept && state.dept.viewTile; return tile(t) ? t : null; };

  // Viewing.refusal(state) → a refusal code, or null when a view may be made now. In order:
  //   no_centrepiece  no Centrepiece was placed here;
  //   sheeted         it is under its dust sheet;
  //   already_earned  this visit has its Certificate (Progress.cert), whichever way;
  //   no_centrepiece  none of its pieces stands (a treasure's guardian killed);
  //   not_at_lectern  you are not on the reading tile;
  //   not_asleep      a piece of it still standing is not asleep (dormant).
  function refusal(state) {
    const c = Hall.cp(state);
    if (!c) return 'no_centrepiece';
    if (c.sheet) return 'sheeted';
    if (Progress.cert(state)) return 'already_earned';
    const up = standing(state);
    if (!up.length) return 'no_centrepiece';
    const you = state.actors[0], t = readingTile(state);
    if (!t || you.x !== t[0] || you.y !== t[1]) return 'not_at_lectern';
    if (up.some(a => a.mode !== 'dormant')) return 'not_asleep';
    return null;
  }

  // The count a view made now would reach: one more than the row so far when your last action
  // that took time was a view (you.lastAct: a read or a choice, which take none, leave it as it
  // was) and no piece of the Centrepiece has woken since the turn of that view (a.woke.turn);
  // otherwise 1, a new row. A row already complete never continues (its Centrepiece is sheeted).
  function nextCount(state) {
    const v = of(state), you = state.actors[0];
    if (!v || you.lastAct !== 'view' || v.n >= N.VIEW_TURNS) return 1;
    for (const a of Centrepiece.pieces(state)) if (a.woke && isInt(a.woke.turn) && a.woke.turn >= v.turn) return 1;
    return v.n + 1;
  }

  // ---- The dust sheet ----

  // The tiles a piece's home covers (its footprint where it was placed), row-major.
  function homeTiles(a) {
    const h = tile(a.home) ? a.home : [a.x, a.y], s = a.size || 1, out = [];
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) out.push([h[0] + dx, h[1] + dy]);
    return out;
  }
  // The tiles a sheet may lie on: floor, or floor that has become shards (§4.1's tile changes).
  const UNDER = ['.', 'x'];

  // The Centrepiece goes under its dust sheet (above): each piece still standing gone, its
  // footprint low furniture with a sheet fixture a tile, dept.cp.sheet written. No event of its
  // own: the completing view's sentence tells it (text/viewing.js).
  function sheet(state) {
    const c = Hall.cp(state), m = state.dept, up = standing(state), done = [];
    for (const a of up) a.gone = 1;
    for (const a of Centrepiece.pieces(state)) for (const [x, y] of homeTiles(a)) {
      if (!Grid.inside(m, x, y) || done.some(t => t[0] === x && t[1] === y)) continue;
      done.push([x, y]);
      if (!UNDER.includes(Grid.ch(m, x, y)) || Actors.at(state, x, y)) continue;
      Grid.set(m, x, y, 'f');
      m.fixtures.push({ k: 'sheet', x, y, of: a.uid });
    }
    c.sheet = { turn: state.turn, uids: up.map(a => a.uid) };
  }
  // Is (x, y) under the dust sheet: a sheet fixture there?
  function underSheet(state, x, y) {
    for (const f of (state.dept && state.dept.fixtures) || []) if (f.k === 'sheet' && f.x === x && f.y === y) return true;
    return false;
  }

  // ---- The action ----

  // Viewing.legal(state) → [{a: 'view'}] when a view may be made now, else [].
  function legal(state) { return refusal(state) === null ? [{ a: 'view' }] : []; }
  // Viewing.candidates(state): the one view there is, for the parity test (§4.2).
  function candidates(state) { return [{ a: 'view' }]; }
  // Viewing.apply(state, action, ev) → COST_VIEW's ticks (Actors.cost), or a refusal code with
  // nothing changed (Viewing.refusal). A view writes dept.view {n, turn} and tells it (viewed
  // {who: you, of: the Centrepiece's first piece, n}, cause view); the VIEW_TURNS-th of a row
  // then puts the Centrepiece under its dust sheet and earns the Certificate, before the world
  // acts.
  function apply(state, action, ev) {
    const code = refusal(state);
    if (code) return code;
    const c = Hall.cp(state), n = nextCount(state);
    state.dept.view = { n, turn: state.turn };
    Causes.emit(state, ev, 'viewed', { who: 'you', of: c.uids[0], n }, { k: 'view' });
    if (n >= N.VIEW_TURNS) {
      sheet(state);
      Progress.award(state, 'view', { k: 'view' }, ev);
    }
    return Actors.cost(state, state.actors[0], N.COST_VIEW, 'act');
  }

  Actions.define('view', {
    legal: state => Viewing.legal(state),
    candidates: state => Viewing.candidates(state),
    apply: (state, action, ev) => Viewing.apply(state, action, ev),
  });

  // The `sheeted` refusal (§4.2; Actions.addRefuser): with the Centrepiece under its dust
  // sheet, a view; a blow at one of the pieces it covers (attack(uid)); a step or bump into a
  // tile under it (move(dir)); an instrument aimed at a tile under it (use(uid, x, y)). A
  // Solution thrown onto it (throw) is not refused: a throw is aimed at a tile, and its square
  // (§8.6) reaches whoever stands in it and nothing under the sheet, whose pieces are gone.
  Actions.addRefuser((state, action) => {
    const c = Hall.cp(state);
    if (!c || !c.sheet || !action) return null;
    if (action.a === 'view') return 'sheeted';
    if (action.a === 'attack') return (c.sheet.uids || []).includes(action.uid) ? 'sheeted' : null;
    if (action.a === 'move') {
      if (!isInt(action.dir) || action.dir < 0 || action.dir > 7) return null;
      const you = state.actors[0];
      return underSheet(state, you.x + Grid.DX[action.dir], you.y + Grid.DY[action.dir]) ? 'sheeted' : null;
    }
    if (action.a === 'use' && isInt(action.x) && isInt(action.y)) return underSheet(state, action.x, action.y) ? 'sheeted' : null;
    return null;
  });

  // ---- The lectern ----

  // Viewing.place(state): the lectern fixture {k: 'lectern', x, y} on dept.lectern, once a
  // Centrepiece is placed (Dept.create calls this after Centrepiece.place); otherwise nothing.
  // It draws nothing and changes no tile.
  function place(state) {
    const m = state.dept;
    if (!Hall.cp(state) || !tile(m.lectern) || (m.fixtures || []).some(f => f.k === 'lectern')) return;
    m.fixtures.push({ k: 'lectern', x: m.lectern[0], y: m.lectern[1] });
  }

  // Viewing.ring(state, lit) → the ring you would have viewing from the reading tile (§8.2):
  // RING_STILL, RING_LOUD_FLOOR more on a loud tile, what your perks do (Perks.ringDelta), and
  // LAMP_RING more with a lit Lamp worn (lit true or false; as you wear it now if undefined),
  // never below RING_MIN. null where there is no reading tile.
  function ring(state, lit) {
    const t = readingTile(state);
    if (!t) return null;
    const T = Grid.TILES[Grid.ch(state.dept, t[0], t[1])], on = lit === undefined ? Kit.observing(state) > 0 : !!lit;
    return Math.max(N.RING_MIN, N.RING_STILL + (T && T.loud ? N.RING_LOUD_FLOOR : 0) + Perks.ringDelta(state) + (on ? N.LAMP_RING : 0));
  }
  // Viewing.reaches(state, r) → bool: would a ring of radius r drawn from the reading tile take
  // in a piece of the Centrepiece still standing, as the ring pip measures it (Vision.inRing: a
  // tile it could stand on, within r walking tiles of the reading tile, in its line of sight)?
  function reaches(state, r) {
    const t = readingTile(state), m = state.dept;
    if (!t || !isInt(r)) return false;
    const d = Grid.distances(m, [t], r);
    for (const a of standing(state)) for (const [x, y] of Actors.footprint(a)) {
      if (!Grid.inside(m, x, y) || !Grid.hold(m, x, y)) continue;
      const w = Grid.reachDist(d, m, x, y);
      if (w >= 0 && w <= r && Grid.los(m, t[0], t[1], x, y)) return true;
    }
    return false;
  }

  // Viewing.words(state) → [sentence]: what the lectern says: the pack's gateway label for its
  // Centrepiece (when it has one), the viewing rule (FIXTURES.lectern), then, while the
  // Centrepiece stands and is not under its sheet, what your ring does from the reading tile,
  // as you are now (the CLAUSES lectern_ring_*): it reaches it; or, with no lit Lamp worn, it
  // does not, and a lit Lamp's would; or it does not. Under the sheet, the sheet's clause
  // (FIXTURES.sheet). [] where no Centrepiece was placed.
  function words(state) {
    const c = Hall.cp(state);
    if (!c) return [];
    const R = Registry, pack = state.dept && Packs.get(state.dept.acc), rec = pack && pack.centrepiece, out = [];
    const fill = (e, values) => Clauses.fill(e.clause, values || Clauses.params(e.params, null, { depth: state.dept.depth || 1 }));
    if (rec && typeof rec.gateway === 'string' && rec.gateway) out.push(rec.gateway);
    out.push(fill(R.FIXTURES.lectern));
    if (c.sheet) out.push(fill(R.FIXTURES.sheet));
    else if (standing(state).length && readingTile(state)) {
      const now = ring(state), lit = Kit.observing(state) > 0, withLamp = ring(state, true);
      const id = reaches(state, now) ? 'lectern_ring_reach' : !lit && reaches(state, withLamp) ? 'lectern_ring_lamp' : 'lectern_ring_short';
      out.push(fill(R.CLAUSES[id], { ring: now, lamp: N.LAMP_RING }));
    }
    return out;
  }

  // The lectern's reader (Fixtures.addReader): its words (Viewing.words), read for nothing, as
  // any fixture is (within READ_RANGE and in sight, Fixtures.read); reading changes nothing.
  Fixtures.addReader('lectern', state => ({ text: words(state).join(' ') || null, effects: null }));

  return { legal, candidates, apply, of, sheeted, refusal, place, ring, reaches, words };
})();
