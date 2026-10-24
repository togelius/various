// ACCESSION — what you can see and what your ring covers (BUILD.md §8.2).
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

  // Your ring's radius: by your last action that cost time, plus a loud floor.
  function ringRadius(state) {
    const you = state.actors[0];
    let r = you.still ? N.RING_STILL : N.RING_MOVING;
    const t = Grid.TILES[Grid.ch(state.dept, you.x, you.y)];
    if (t && t.loud) r += N.RING_LOUD_FLOOR;
    return Math.max(N.RING_MIN, r);
  }

  // The tiles your ring covers: exactly those where a sleeping exhibit would gain a pip
  // (BUILD.md §8.2): within its walking distance and in line of sight. A tile you cannot
  // step onto (a case, a plinth) is one step beyond its nearest neighbour you could.
  function ring(state) {
    const m = state.dept, you = state.actors[0], r = ringRadius(state);
    const d = Grid.distances(m, [[you.x, you.y]], r), out = new Uint8Array(m.w * m.h);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const i = y * m.w + x, dist = Grid.reachDist(d, m, x, y);
      if (dist >= 0 && dist <= r && Grid.los(m, you.x, you.y, x, y)) out[i] = 1;
    }
    return out;
  }

  // Marks what you can see now as seen, in state.dept.seen (one character a tile).
  function remember(state) {
    const m = state.dept, v = visible(state);
    let seen = m.seen && m.seen.length === m.w * m.h ? m.seen : '0'.repeat(m.w * m.h);
    let changed = false;
    const chars = seen.split('');
    for (let i = 0; i < v.length; i++) if (v[i] && chars[i] !== '1') { chars[i] = '1'; changed = true; }
    if (changed || seen !== m.seen) m.seen = chars.join('');
  }

  return { within, visible, ringRadius, ring, remember };
})();
