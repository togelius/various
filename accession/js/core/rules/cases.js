// ACCESSION — cases, glass, locks and staff doors (BUILD.md §8.3). W0e builds the case
// fixture, its draws, the shard rule and the mimic's disguise; W1-CASES builds placement,
// opening, bashing, staff doors and the rest, on these.
//
// A case is a fixture in dept.fixtures:
//   { k: 'case', x, y, room, num, glass, lock, hits, st, loan, holds, mimic }
// room is its room's role key; num its accession number (null only for a mimic's case, its
// tell); glass 1–3 (Registry.GLASS: Plate, Laminated, Security); lock the grade it needs,
// 1–7; hits the bashes it has taken; st 'shut', 'open', 'broken', 'dissolved' or 'revealed';
// loan true when it is "on loan elsewhere" (a label with no object); holds an item uid or
// null; mimic the uid of the mimic it is, or null.
'use strict';
const Cases = (() => {
  // The fixture on (x, y), or null. Fixtures never share a tile.
  function at(state, x, y) {
    for (const f of (state.dept && state.dept.fixtures) || []) if (f.x === x && f.y === y) return f;
    return null;
  }

  // Does a stand in an intact case? An exhibit on a `v` is encased (and so is a mimic in its
  // disguise): it cannot step out (Grid.canStep) or strike out, and nothing strikes in.
  const encased = (state, a) => Actors.footprint(a).some(([x, y]) => Grid.ch(state.dept, x, y) === 'v');

  // A case fixture with every field, plain data; rec gives x, y and any field to set.
  function make(rec) {
    const or = (k, v) => rec[k] !== undefined ? rec[k] : v;
    return { k: 'case', x: rec.x, y: rec.y, room: or('room', null), num: or('num', null), glass: or('glass', 1), lock: or('lock', 1),
      hits: or('hits', 0), st: or('st', 'shut'), loan: or('loan', false), holds: or('holds', null), mimic: or('mimic', null) };
  }

  // The draws that make a case (§8.3), from a stream (Rng.stream), in this order: its glass,
  // by depth's mix (GLASS_MIX_D1 … D6, depth 6's mix beyond); its lock; whether it is on loan
  // (one case in CASE_EMPTY_ONE_IN). W1-CASES's placement and the mimic's disguise both draw
  // through here, so a mimic's case is drawn exactly as a real one is.
  const drawGlass = (rng, depth) => 1 + rng.weighted(N['GLASS_MIX_D' + Math.min(6, Math.max(1, depth))]);
  // A lock is drawn uniformly from the overlap of the glass's range (GLASS_LOCK_MIN … MAX)
  // and I to depth + 1; if they do not overlap, it is the glass range's minimum, with no draw.
  function drawLock(rng, glass, depth) {
    const lo = N.GLASS_LOCK_MIN[glass - 1], hi = Math.min(N.GLASS_LOCK_MAX[glass - 1], depth + 1);
    return hi < lo ? lo : rng.int(lo, hi);
  }
  const drawLoan = rng => rng.int(1, N.CASE_EMPTY_ONE_IN) === 1;
  function draw(rng, depth) {
    const glass = drawGlass(rng, depth), lock = drawLock(rng, glass, depth), loan = drawLoan(rng);
    return { glass, lock, loan };
  }

  // The one shard rule (§8.3): where shards land when they fall to (x, y) (a glass exhibit's
  // own tile; for a broken case, the tile on your side). The tile itself if it is floor or
  // archway; otherwise its first floor or archway neighbour in direction order (N, NE, E, …
  // NW); otherwise nowhere (null). So shards never cover a door, an exit, the entrance, a
  // bench, a case or a wall.
  const SHARDABLE = ch => ch === '.' || ch === ',';
  function shardTile(state, x, y) {
    const m = state.dept;
    if (SHARDABLE(Grid.ch(m, x, y))) return [x, y];
    for (let d = 0; d < 8; d++) { const nx = x + Grid.DX[d], ny = y + Grid.DY[d]; if (SHARDABLE(Grid.ch(m, nx, ny))) return [nx, ny]; }
    return null;
  }

  // The role key of the room holding (x, y), or null outside any room (or in a test room).
  function roomKey(state, x, y) {
    const m = state.dept;
    if (!m.roomOf || !m.rooms) return null;
    const id = m.roomOf[y] ? m.roomOf[y][x] : 0, rm = m.rooms.find(r => r.id === id);
    return rm ? rm.key || null : null;
  }

  // A mimic's disguise (§8.3, §8.8), made by its archetype's init: on its own floor tile it
  // becomes a case. Its glass, lock and loan are drawn as a real case's are (Cases.draw), on
  // the mimic's own ai/<uid> stream, so removing it reshuffles nothing else (§3.2); its case
  // has no accession number, its one tell. The tile becomes `v`, the only time a floor tile
  // does. Returns the fixture.
  function disguise(state, a) {
    const m = state.dept;
    if ((a.size || 1) !== 1) throw new Error(`Cases.disguise: ${a.uid} is not one tile`);
    if (Grid.ch(m, a.x, a.y) !== '.') throw new Error(`Cases.disguise: ${a.uid} is not on a floor tile`);
    if (at(state, a.x, a.y)) throw new Error(`Cases.disguise: there is already a fixture at ${a.x},${a.y}`);
    const d = draw(Rng.stream(state, 'ai/' + a.uid), m.depth);
    const f = make({ x: a.x, y: a.y, room: roomKey(state, a.x, a.y), num: null, glass: d.glass, lock: d.lock, loan: d.loan, mimic: a.uid });
    if (!m.fixtures) m.fixtures = [];
    m.fixtures.push(f);
    Grid.set(m, a.x, a.y, 'v');
    return f;
  }

  // The mimic shows itself: its case is 'revealed', and its tile, if still a vitrine,
  // becomes floor again. Returns the fixture, or null if a was never disguised.
  function reveal(state, a) {
    const f = ((state.dept && state.dept.fixtures) || []).find(q => q.k === 'case' && q.mimic === a.uid) || null;
    if (!f) return null;
    f.st = 'revealed';
    if (Grid.ch(state.dept, f.x, f.y) === 'v') Grid.set(state.dept, f.x, f.y, '.');
    return f;
  }

  // Cases.enter(state, a, x, y, d, ev): your step from your tile in direction d onto (x, y),
  // which holds no actor, when that tile is a fixture: null if it is not one (the step goes
  // on), a refusal code, or ticks (W1-CASES: a staff door opened at your grade). With ev
  // null it changes nothing and says what it would return, for Step.legal. Until W1-CASES:
  // a bump into an intact case is refused with behind_glass, as a blow at anything standing
  // in one is (Combat.canStrike).
  function enter(state, a, x, y, d, ev) {
    return Grid.ch(state.dept, x, y) === 'v' ? 'behind_glass' : null;
  }

  // [stub → W1-CASES] Every in-room vitrine of the plan becomes a case, drawn on its room's
  // `${base}/room/<key>/populate` stream in pop (one holder for the department, shared with
  // the stand-in placement of items and consumables, §3.2), with its accession number; staff
  // doors get their grades on `${base}/staff`. Does nothing for now.
  function place(state, plan, base, pop) {}
  // [stub → W1-CASES] The grade a staff door at (x, y) needs, or null if there is none there.
  const staffGrade = (state, x, y) => null;
  // [stub → W1-CASES] A case is touched (opened or bashed; §8.3): touch_case wakes what it
  // holds, and a mimic's grip (Archetypes.onTouched). Does nothing for now.
  function touch(state, f, how, by, ev) {}
  // [stub → W1-CASES] Solvent dissolves the case f, silently. Does nothing for now.
  function dissolve(state, f, by, ev) {}
  // [stub → W1-CASES] The sleeper in a broken or dissolved case wakes hunting, homeless.
  function release(state, f, ev) {}
  // [stub → W1-CASES] Can the item be reached in its case (open or broken, for the pole)? false for now.
  const reach = (state, item) => false;
  // [stub → W1-CASES] The cases as the view model shows them. [] for now.
  const view = (state, vis) => [];
  // [stub → W1-CASES] A case's label data, with its accession number. null for now.
  const describe = (state, f) => null;
  // [stub → W1-CASES] May a Highlight go in the case f: is its lock within the grade you
  // entered with (§8.3)? Every place is allowed for now, so stand-in placement can run.
  const highlightOk = (state, f) => true;
  // [stub → W1-CASES; M4's Light Fingers] What opening a case costs you.
  const openCost = state => N.COST_OPEN_CASE;

  // open(x, y) and bash(x, y) (§4.2), on a case beside you. [stub → W1-CASES]: nothing is
  // legal yet, and every candidate is refused as not built.
  const around = (state, a) => {
    const you = state.actors[0], out = [];
    for (let d = 0; d < 8; d++) out.push({ a, x: you.x + Grid.DX[d], y: you.y + Grid.DY[d] });
    return out.concat([{ a, x: you.x, y: you.y }, { a }]);
  };
  for (const id of ['open', 'bash']) Actions.define(id, { legal: state => [], candidates: state => around(state, id), apply: (state, action, ev) => 'not_built' });

  return { at, encased, make, drawGlass, drawLock, drawLoan, draw, shardTile, roomKey, disguise, reveal,
    enter, place, staffGrade, touch, dissolve, release, reach, view, describe, highlightOk, openCost };
})();
