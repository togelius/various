// ACCESSION — the kiter archetype's hooks (BUILD.md §5.1, §5.3, §8.1; rules/archetypes.js), owned
// by W1-ARCH-B. Its Behaviour-line clause and registry entry are in js/core/reg/arch-b.js.
//
// A kiter hunting you, while it sees you, keeps KITER_HOLD (3 to 5) tiles from you, counted as
// the steps it would walk to reach you, and shoots you with ordinary rolled bolts
// (Ranged.shoot) up to ROLE_ARTILLERY_RANGE tiles away, for its role's damage. A post is a tile
// it could stand on, 3 to 5 steps from you, with a clear shot at you: you within range, in
// line of sight, and the first actor on its bolt's line (no glass, wall or other actor before
// you, so it never shoots into a case, an ally or a reflector). At each of its actions:
//   1. beside you, or fewer than 3 steps from you, it backs away (AI.away);
//      more than 5 steps from you, it walks toward its nearest post (by its own walking
//      distance, ties in row-major order);
//   2. if it did not move, and it has a clear shot from where it stands, it shoots;
//   3. otherwise, 3 or more steps from you, it walks toward its nearest post;
//   4. otherwise it acts by its mode (AI.byMode), as a plodder does.
// So, cornered beside you, it shoots from there; with no way to walk to you, it shoots if it
// can. Out of sight, not hunting, or in an intact case (a bolt never passes glass), it acts
// by its mode.
'use strict';
(() => {
  // A clear shot at you from (x, y), for the kiter `body` standing there or about to: within
  // range, in line of sight, and the first actor on its bolt's line is you (the tiles it
  // crosses pass bolts, and no actor but you stands on them, the kiter itself aside).
  function clear(state, body, x, y) {
    const m = state.dept, you = state.actors[0];
    if (Grid.chebyshev(x, y, you.x, you.y) > N.ROLE_ARTILLERY_RANGE || (x === you.x && y === you.y) || !Grid.los(m, x, y, you.x, you.y)) return false;
    const pts = Ranged.bresenham(x, y, you.x, you.y);
    for (let i = 1; i < pts.length; i++) {
      const [tx, ty] = pts[i];
      if (!Grid.bolt(m, tx, ty)) return false;
      const b = Actors.at(state, tx, ty, body);
      if (b) return b === you;
    }
    return false;
  }

  // The tile nearest a (by a's walking distance; ties in row-major order) that a could stand
  // on, KITER_HOLD tiles from you by walking, with a clear shot at you; null if none.
  function post(state, a) {
    const m = state.dept, you = state.actors[0], R = N.ROLE_ARTILLERY_RANGE, [lo, hi] = N.KITER_HOLD;
    const fromYou = AI.field(state, a, you, 'beside'), fromMe = Grid.distances(m, [[a.x, a.y]], m.w * m.h, null, 'exhibit');
    let best = null, bd = -1;
    for (let y = you.y - R; y <= you.y + R; y++) for (let x = you.x - R; x <= you.x + R; x++) {
      if (!Grid.inside(m, x, y) || !Grid.walkable(m, x, y, 'exhibit')) continue;
      const i = y * m.w + x, w = fromYou[i], d = fromMe[i];
      if (w < lo || w > hi || d < 0 || (bd >= 0 && d >= bd)) continue;
      const o = Actors.at(state, x, y, a);
      if (o || !clear(state, a, x, y)) continue;
      best = [x, y]; bd = d;
    }
    return best;
  }

  function act(state, a, ev) {
    if (a.mode !== 'hunting' || Cases.encased(state, a) || !AI.sees(state, a)) return null;
    const m = state.dept, you = state.actors[0], [lo, hi] = N.KITER_HOLD;
    const w = AI.field(state, a, you, 'beside')[a.y * m.w + a.x];
    const shoot = () => { const r = Ranged.shoot(state, a, you.x, you.y, { kind: 'shot' }, ev); return typeof r === 'number' ? r : null; };
    const toPost = () => { const goal = post(state, a); return goal ? AI.towards(state, a, goal, 'onto', ev) : null; };
    let r = null;
    if (Actors.between(a, you) === 1 || (w >= 0 && w < lo)) r = AI.away(state, a, you, ev);
    else if (w > hi) r = toPost();
    if (r === null && clear(state, a, a.x, a.y)) r = shoot();
    if (r === null && w >= lo) r = toPost();
    return r;
  }

  Archetypes.add('kiter', { act });
})();
