// ACCESSION — what you can see and what your ring covers (BUILD.md §8.2). The ring has one
// predicate, Vision.inRing, behind both the ring the board draws and the ring pip a sleeper
// gains at the turn boundary (Wake.boundary), so the two cannot differ. Owned by W1-WAKE-A;
// M4's Wave 0 (W0d1) added the free and discounted actions' ring (plan A6) and `observed`.
'use strict';
const Vision = (() => {
  // "Within r" is defined once, in grid.js (§8.2).
  const within = Grid.disc;

  // Visible tiles as a Uint8Array (1 = visible), from your tile. Not stored in the state.
  function visible(state) {
    const m = state.dept, you = state.actors[0], r = N.SIGHT_PLAYER, out = new Uint8Array(m.w * m.h);
    for (let y = Math.max(0, you.y - r); y <= Math.min(m.h - 1, you.y + r); y++)
      for (let x = Math.max(0, you.x - r); x <= Math.min(m.w - 1, you.x + r); x++)
        if (within(x - you.x, y - you.y, r) && Grid.los(m, you.x, you.y, x, y)) out[y * m.w + x] = 1;
    return out;
  }

  // The ring of your last action that cost time (§8.2), from where you stand: RING_STILL after
  // a wait, rest, view or sit, else RING_MOVING; plus RING_LOUD_FLOOR on a loud floor; plus
  // what your kit adds or takes (Kit.ringDelta: Quiet, and LAMP_RING while a lit Lamp is
  // worn) and what your perks do (Perks.ringDelta: Soft Soles); never below RING_MIN.
  function actionRing(state) {
    const you = state.actors[0];
    let r = you.still ? N.RING_STILL : N.RING_MOVING;
    const t = Grid.TILES[Grid.ch(state.dept, you.x, you.y)];
    if (t && t.loud) r += N.RING_LOUD_FLOOR;
    r += Kit.ringDelta(state) + Perks.ringDelta(state);
    return Math.max(N.RING_MIN, r);
  }
  // Your ring's radius (§8.2; plan A6): the ring the next turn boundary would apply if it ran
  // now, which is the ring drawn. It is your last action's ring, or, when a free or
  // discounted action ran since the last boundary, the largest ring among your actions since
  // then (you.ringMax, which Step writes and the boundary clears), if that is larger. The
  // ring drawn and the ring pip both read this one radius.
  function ringRadius(state) {
    const you = state.actors[0], r = actionRing(state);
    return you.ringMax !== undefined && you.ringMax > r ? you.ringMax : r;
  }

  // What the ring is measured with: its radius, and the walking distances from your tile out
  // to it (§8.2's walking distance: staff doors count as doors, actors never block). Not
  // part of the state; computing it once lets a caller ask about many tiles.
  function field(state) {
    const you = state.actors[0], r = ringRadius(state);
    return { r, x: you.x, y: you.y, dist: Grid.distances(state.dept, [[you.x, you.y]], r) };
  }

  // The walking distance from you to (x, y) if the tile is inside your ring, else -1. Inside
  // means: a tile an exhibit can stand on (Grid.hold: walkable, a vitrine or a plinth), within
  // the ring's walking distance (a tile you cannot step onto is one beyond its nearest
  // neighbour you can), and in line of sight from you. f is field(state), computed if absent.
  function ringDist(state, x, y, f) {
    const m = state.dept;
    if (!Grid.inside(m, x, y) || !Grid.hold(m, x, y)) return -1;
    f = f || field(state);
    const d = Grid.reachDist(f.dist, m, x, y);
    return d >= 0 && d <= f.r && Grid.los(m, f.x, f.y, x, y) ? d : -1;
  }

  // Vision.inRing(state, x, y[, f]): is (x, y) inside your ring, so that a sleeping exhibit
  // standing on it gains a pip at the turn boundary (§8.2)? The one predicate for both.
  const inRing = (state, x, y, f) => ringDist(state, x, y, f) >= 0;

  // The tiles your ring covers, for the view model: a Uint8Array, 1 where inRing holds.
  // Drawn from your current tile, on the map as it is now, with ringRadius (§8.2, plan A6):
  // the ring the next boundary would apply if it ran now.
  function ring(state) {
    const m = state.dept, f = field(state), out = new Uint8Array(m.w * m.h);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (inRing(state, x, y, f)) out[y * m.w + x] = 1;
    return out;
  }

  // Vision.observed(state, a) (§5.4; plan A8): is exhibit a observed? It is when any tile of
  // its footprint is in your line of sight within SIGHT_PLAYER (as you see, Vision.visible),
  // or, while you wear a lit Lamp, within its range of you (Kit.observing, a disc), even out
  // of sight. "Unobserved" (unobserved_motion) is its negation. A gone actor is not observed.
  function observed(state, a) {
    if (!a || a.gone) return false;
    const m = state.dept, you = state.actors[0], lamp = Kit.observing(state);
    for (const [x, y] of Actors.footprint(a)) {
      const dx = x - you.x, dy = y - you.y;
      if (lamp > 0 && within(dx, dy, lamp)) return true;
      if (within(dx, dy, N.SIGHT_PLAYER) && Grid.los(m, you.x, you.y, x, y)) return true;
    }
    return false;
  }

  // Remembers what you can see now, in state.dept.seen: the map as you last saw it, one
  // character a tile in row-major order, ' ' where you have never seen the tile (BUILD.md
  // §4.1, §6.1). Each tile in view takes its character now, so a door an exhibit opened out
  // of sight stays shut in your memory until you see it again.
  function remember(state) {
    const m = state.dept, v = visible(state);
    const seen = m.seen && m.seen.length === m.w * m.h ? m.seen : ' '.repeat(m.w * m.h);
    let changed = false;
    const chars = seen.split('');
    for (let i = 0; i < v.length; i++) {
      if (!v[i]) continue;
      const ch = m.tiles[Int.idiv(i, m.w)][i % m.w];
      if (chars[i] !== ch) { chars[i] = ch; changed = true; }
    }
    if (changed || seen !== m.seen) m.seen = chars.join('');
  }

  return { within, visible, actionRing, ringRadius, field, ringDist, inRing, ring, observed, remember };
})();
