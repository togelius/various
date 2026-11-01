// ACCESSION — Close the Distance, an Artillery perk (BUILD.md §8.7): "Your first step toward an
// exhibit targeting you costs 0 ticks, once per exhibit; two steps at rank 2." Its rules register
// here with Perks.add (rules/perks.js); its entry and clause are in js/core/reg/perks-timing.js
// and its sentences in js/core/text/perks-timing.js. Owned by PG-PERKS-TIMING.
//
// The rule (M4 plan A6, D4.4; the PROGRESS map's PR3), exactly:
//   - An exhibit targets you while its pending damage mark (a telegraph, a due line's
//     included) covers the tile you stand on: the mark the floor shows there.
//   - A step of yours (a move that changes your tile; a bump into a door, a case or anyone
//     is no step) is toward it when your walking distance to its nearest tile (§8.2's
//     measure, as the ring's: Grid.distances by your step rule, Grid.reachDist for a tile you
//     cannot step onto) is less from the tile you step onto than from the tile you left.
//   - Such a step takes no time (Perks.adjust gives 0, which step() accepts only for a move
//     that changed your tile and only from this perk), up to PERK_CLOSE_STEPS[rank − 1] free
//     steps toward each exhibit in a visit, counted by its uid in dept.perk.closed
//     [{uid, n}] (absent until the first, §4.1); the log says so (perk, cause close).
//   - When one step is toward several exhibits targeting you, the first of them in spawn
//     order with free steps left pays. No two pending damage marks share a tile (§8.1), so in
//     play at most one exhibit targets you at a time, and that one pays.
//   - The step is a step in every other way: your ring is the moving one and the next turn
//     boundary applies it (plan A6: you.ringMax), it unseats you and starts a row of views
//     again; only the time it would have taken is gone, so your next decision comes at once
//     and nothing else acts before it.
'use strict';
(() => {
  const ID = 'close_the_distance';
  const off = state => !!(state.options && Options.off(state, ID));
  const allowance = rank => N.PERK_CLOSE_STEPS[rank - 1];
  // The free steps already taken toward the exhibit uid this visit.
  function spent(state, uid) {
    const p = state.dept.perk;
    if (!p || !Array.isArray(p.closed)) return 0;
    for (const c of p.closed) if (c.uid === uid) return c.n;
    return 0;
  }
  function count(state, uid) {
    if (!state.dept.perk) state.dept.perk = {};
    const p = state.dept.perk;
    if (!Array.isArray(p.closed)) p.closed = [];
    for (const c of p.closed) if (c.uid === uid) { c.n++; return c.n; }
    p.closed.push({ uid, n: 1 });
    return 1;
  }
  // The exhibits targeting you on tile (x, y), in spawn order: not gone, with a pending damage
  // mark that covers it.
  function targeting(state, x, y) {
    const out = [];
    for (let i = 1; i < state.actors.length; i++) {
      const a = state.actors[i], t = a.telegraph;
      if (a.gone || !t || t.effect !== 'damage' || !Array.isArray(t.tiles)) continue;
      for (const p of t.tiles) if (p[0] === x && p[1] === y) { out.push(a); break; }
    }
    return out;
  }
  // Your walking distance from a distances() result to a's nearest tile, or -1 if none is reached.
  function walk(state, dist, a) {
    let best = -1;
    for (const [x, y] of Actors.footprint(a)) {
      const d = Grid.reachDist(dist, state.dept, x, y);
      if (d >= 0 && (best < 0 || d < best)) best = d;
    }
    return best;
  }

  Perks.add(ID, {
    adjust(state, action, r, ev, rank) {
      if (action.a !== 'move' || r <= 0) return null;
      const you = state.actors[0];
      let step = null;
      for (const e of ev) if (e.k === 'moved' && e.who === 'you') { step = e; break; }
      if (!step || (step.from[0] === you.x && step.from[1] === you.y)) return null;
      const list = targeting(state, step.from[0], step.from[1]);
      if (!list.length) return null;
      const m = state.dept, far = m.w * m.h;
      const before = Grid.distances(m, [[step.from[0], step.from[1]]], far), after = Grid.distances(m, [[you.x, you.y]], far);
      for (const a of list) {
        const of = allowance(rank);
        if (spent(state, a.uid) >= of) continue;
        const d0 = walk(state, before, a), d1 = walk(state, after, a);
        if (d0 < 0 || d1 < 0 || d1 >= d0) continue;
        const n = count(state, a.uid);
        Causes.emit(state, ev, 'perk', { id: ID, rank }, { k: 'close', who: a.uid, n, of });
        return { r: 0, why: ID };
      }
      return null;
    },
    // Who targets you now and the free steps toward it you have left, as plain data:
    // {who, steps}, who the first exhibit targeting you in spawn order that has steps left (or
    // the first, with steps 0, if none has); null while none targets you.
    charge(state, rank) {
      if (off(state)) return null;
      const you = state.actors[0];
      if (!you || you.gone) return null;
      const list = targeting(state, you.x, you.y);
      if (!list.length) return null;
      const of = allowance(rank);
      for (const a of list) { const left = of - spent(state, a.uid); if (left > 0) return { who: a.uid, steps: left }; }
      return { who: list[0].uid, steps: 0 };
    },
  });
})();
