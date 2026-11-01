// ACCESSION — the treasure case (BUILD.md §5.5, §8.5; M4 plan A10, D-ITEMS). A treasure's
// Centrepiece (S.9's Composite) guards its Signature piece (the Day Curator's Lamp) in its
// hall's wall case: the one case curation stands in a hall, in a treasure's hall beside its
// guardian and far enough from its openings (js/core/layout/curate.js). Here, read by the
// item placement (Kit.place) and by the Centrepiece's own rules: which case it is, its glass
// (the pack's override, listed by `lint-registry --report`), and the validator: the case at
// least LAMP_CASE_MIN_WALK walking tiles from every opening of the hall, or the layout
// reseeds. This is the only place that rule is judged (curation only aims at it). It
// registers with Populate.addValidator('treasure', …) from here.
//
// A pack's treasure is its Centrepiece's Signature piece when the Centrepiece's form is
// 'treasure' and its hall's gallery (key 'centre') lists it (`{item, case: true}`); a pack with
// none (A.4, M.11, any pack without a gallery list) is no concern of this file.
'use strict';
const LTreasure = (() => {
  const isInt = Number.isInteger;

  // LTreasure.of(pack) → the pack's treasure, its item record, or null.
  function of(pack) {
    const cp = pack && pack.centrepiece;
    if (!cp || cp.form !== 'treasure' || typeof cp.signature !== 'string' || !Array.isArray(pack.galleries)) return null;
    if (!pack.galleries.some(g => g && g.key === 'centre' && Array.isArray(g.contents) && g.contents.some(e => e && e.item === cp.signature))) return null;
    return (pack.items || []).find(i => i.id === cp.signature) || null;
  }

  // The Centrepiece hall of a department: its room of role 'centre', or null.
  function hall(state) {
    const m = state && state.dept;
    return m && Array.isArray(m.rooms) ? m.rooms.find(r => r.role === 'centre') || null : null;
  }

  // LTreasure.caseOf(state) → the hall's wall case, the treasure's (a case fixture, whatever has
  // become of it since: opened, broken, dissolved), or null with no hall or no case in it. A
  // hall holds one case, curation's, and never a mimic (D-POP), so the first real case of the
  // hall, in fixture order, is it.
  function caseOf(state) {
    const m = state && state.dept, h = hall(state);
    if (!h || !Array.isArray(m.fixtures)) return null;
    return m.fixtures.find(f => f.k === 'case' && f.mimic === null && m.roomOf[f.y] && m.roomOf[f.y][f.x] === h.id) || null;
  }

  // LTreasure.glass(pack, depth) → the treasure case's glass at a depth, or null to keep the
  // glass its case drew: the pack's override, its Centrepiece's `treasure.case.glass` (1–3:
  // Plate, Laminated, Security; §8.3), never above the strongest glass the depth's mix holds
  // (GLASS_MIX_D1 … D6, depth 6's beyond), so S.9's Security case is Laminated at depths 1–2,
  // where the mix holds no Security (§5.5), and a case's glass clause stays true.
  function glass(pack, depth) {
    const t = pack && pack.centrepiece && pack.centrepiece.treasure, o = t && t.case ? t.case.glass : undefined;
    if (o === undefined) return null;
    if (!isInt(o) || o < 1 || o > N.GLASS_BASHES.length) throw new Error(`LTreasure: ${pack.acc}'s treasure case has the glass ${JSON.stringify(o)}, not 1–${N.GLASS_BASHES.length}`);
    const mix = N['GLASS_MIX_D' + Math.min(6, Math.max(1, depth))];
    let strongest = 1;
    for (let g = 1; g <= mix.length; g++) if (mix[g - 1] > 0) strongest = g;
    return Math.min(o, strongest);
  }

  // LTreasure.dress(state, pack, rng) → the treasure case, made ready to hold the treasure, or
  // null when there is none that can (no case in the hall, or one not shut, already holding an
  // item or with an exhibit in it). Its glass becomes the override's (glass above) and its lock
  // is drawn for that glass at the department's depth on rng (the hall's populate stream, after
  // its case's own draws: Cases.drawLock, as §8.3 draws any case's); with no override, its
  // glass and lock stay as drawn. It is never on loan, since it holds the treasure. Kit.place
  // puts the treasure in it.
  function dress(state, pack, rng) {
    const f = caseOf(state);
    if (!f || f.st !== 'shut' || f.holds !== null || state.actors.some(a => Actors.covers(a, f.x, f.y))) return null;
    const g = glass(pack, state.dept.depth);
    if (g !== null) { f.glass = g; f.lock = Cases.drawLock(rng, g, state.dept.depth); }
    f.loan = false;
    return f;
  }

  // LTreasure.openings(state) → the hall's ways in: every tile outside it, from which one steps
  // into it orthogonally, that one can walk on (an archway, a door, a staff door, floor), in
  // row-major order, as [x, y] (as Centrepiece.place records them in dept.cp.openings, here
  // whether or not a Centrepiece stands in the hall); [] with no hall.
  function openings(state) {
    const m = state.dept, h = hall(state), out = [];
    if (!h) return out;
    const inHall = (x, y) => Grid.inside(m, x, y) && m.roomOf[y][x] === h.id;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (inHall(x, y) || !Grid.walkable(m, x, y)) continue;
      if (inHall(x, y - 1) || inHall(x + 1, y) || inHall(x, y + 1) || inHall(x - 1, y)) out.push([x, y]);
    }
    return out;
  }

  // LTreasure.walk(state) → the treasure case's walking distance from the nearest opening of
  // the hall, {walk, at}: your walking distance (Grid.distances, doors and staff doors walked
  // through) from that opening to a tile beside the case, plus one (a case's own, §5.5), and
  // that opening, the first in row-major order on a tie; walk -1 (at null) when no opening
  // reaches it; null with no case.
  function walk(state) {
    const m = state.dept, f = caseOf(state);
    if (!f) return null;
    let best = { walk: -1, at: null };
    for (const o of openings(state)) {
      const w = Grid.reachDist(Grid.distances(m, [o], m.w * m.h), m, f.x, f.y);
      if (w >= 0 && (best.walk < 0 || w < best.walk)) best = { walk: w, at: o };
    }
    return best;
  }

  // The validator (M4 plan A10, B11): for a department whose pack has a treasure, null when the
  // treasure lies in the hall's case and that case is at least LAMP_CASE_MIN_WALK walking tiles
  // from every opening of the hall; otherwise why not, {reason, tiles}: the treasure in no case
  // of the hall (its tile, or the case's, or the hall's corners), or the case too near an
  // opening (the case and that opening) or reached from none. A rejection fails the layout
  // attempt, which reseeds.
  function check(state, plan) {
    const m = state && state.dept, t = m ? of(Packs.get(m.acc)) : null;
    if (!t) return null;
    const h = hall(state), f = caseOf(state), it = state.items.find(i => i.ref === t.id && (i.where.at === 'case' || i.where.at === 'floor'));
    if (!h) return { reason: `this plan has no hall for ${t.name}`, tiles: [] };
    if (!f || !it || it.where.at !== 'case' || it.where.x !== f.x || it.where.y !== f.y) {
      return { reason: `${t.name} lies in no case of the hall (${h.key})`, tiles: it ? [[it.where.x, it.where.y]] : f ? [[f.x, f.y]] : [[h.x0, h.y0], [h.x1, h.y1]] };
    }
    const w = walk(state);
    if (w.walk < 0) return { reason: `no opening of the hall reaches the case of ${t.name} at ${f.x},${f.y}`, tiles: [[f.x, f.y]] };
    if (w.walk < N.LAMP_CASE_MIN_WALK) {
      return { reason: `the case of ${t.name} at ${f.x},${f.y} is ${w.walk} walking tiles from the hall's opening at ${w.at[0]},${w.at[1]}, nearer than LAMP_CASE_MIN_WALK (${N.LAMP_CASE_MIN_WALK})`,
        tiles: [[f.x, f.y], [w.at[0], w.at[1]]] };
    }
    return null;
  }
  Populate.addValidator('treasure', (state, plan) => check(state, plan));

  return { of, caseOf, glass, dress, openings, walk, check };
})();
