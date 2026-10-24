// ACCESSION — the kiter archetype's hooks (BUILD.md §5.1, §5.3, §8.1; rules/archetypes.js), owned
// by W1-ARCH-B. Its Behaviour-line clause and registry entry are in js/core/reg/arch-b.js.
//
// A kiter hunting you, while it sees you, keeps KITER_HOLD (3 to 5) tiles from you, counted as
// the steps it would walk to reach you, and shoots you with ordinary rolled bolts
// (Ranged.shoot) within ROLE_ARTILLERY_RANGE (the disc of "within r", Ranged.within), for its
// role's damage. A post is a tile it could stand on, 3 to 5 steps from you, with a clear shot
// at you: you within range, in line of sight, and the first actor on its bolt's line (no
// glass, wall or other actor before you, so it never shoots into a case, an ally or a
// reflector). It walks to a post by a way that never comes nearer than 3 steps to you, and
// the nearest post is the one nearest by that way (ties in row-major order). At each of its
// actions:
//   1. beside you, or fewer than 3 steps from you, it backs away (AI.away);
//      more than 5 steps from you, it walks toward its nearest post;
//   2. if it did not move, and it has a clear shot from where it stands, it shoots;
//   3. otherwise, 3 or more steps from you, it walks toward its nearest post; more than 5
//      steps from you with no post to walk to, it steps toward you, which keeps it 5 or
//      more steps away;
//   4. otherwise it waits where it is, so it never comes nearer than 3 steps of its own
//      accord.
// So, cornered beside you, it shoots from there; with no way to walk to you, it shoots if it
// can, and else acts by its mode (AI.byMode), which cannot bring it nearer. Out of sight,
// not hunting, or in an intact case (a bolt never passes glass), it acts by its mode.
'use strict';
(() => {
  // A clear shot at you from (x, y), for the kiter `body` standing there or about to: within
  // range, in line of sight, and the first actor on its bolt's line is you (the tiles it
  // crosses pass bolts, and no actor but you stands on them, the kiter itself aside).
  function clear(state, body, x, y) {
    const m = state.dept, you = state.actors[0];
    if ((x === you.x && y === you.y) || !Ranged.within({ x, y, size: 1 }, you.x, you.y, N.ROLE_ARTILLERY_RANGE) || !Grid.los(m, x, y, you.x, you.y)) return false;
    const pts = Ranged.bresenham(x, y, you.x, you.y);
    for (let i = 1; i < pts.length; i++) {
      const [tx, ty] = pts[i];
      if (!Grid.bolt(m, tx, ty)) return false;
      const b = Actors.at(state, tx, ty, body);
      if (b) return b === you;
    }
    return false;
  }

  // The extra cost of entering a tile for the kiter's way to a post: a tile fewer than
  // KITER_HOLD0 steps from you (fromYou) is never entered.
  const avoider = (m, fromYou, far) => (x, y) => { const w = fromYou[y * m.w + x]; return w >= 0 && w < N.KITER_HOLD[0] ? far + 1 : 0; };

  // The post nearest a by a way that keeps 3 or more steps from you (ties in row-major
  // order): a tile it could stand on, KITER_HOLD tiles from you by walking, with no actor on
  // it and a clear shot at you; null if none.
  function post(state, a, fromYou) {
    const m = state.dept, you = state.actors[0], R = N.ROLE_ARTILLERY_RANGE, [lo, hi] = N.KITER_HOLD, far = m.w * m.h;
    const fromMe = Grid.distances(m, [[a.x, a.y]], far, avoider(m, fromYou, far), 'exhibit');
    let best = null, bd = -1;
    for (let y = you.y - R; y <= you.y + R; y++) for (let x = you.x - R; x <= you.x + R; x++) {
      if (!Grid.inside(m, x, y) || !Grid.walkable(m, x, y, 'exhibit')) continue;
      const i = y * m.w + x, w = fromYou[i], d = fromMe[i];
      if (w < lo || w > hi || d < 0 || (bd >= 0 && d >= bd)) continue;
      if (Actors.at(state, x, y, a) || !clear(state, a, x, y)) continue;
      best = [x, y]; bd = d;
    }
    return best;
  }

  // One step along a shortest way from a to goal that keeps 3 or more steps from you: among
  // the tiles beside a nearer the goal by that way, onto which a may step and on which no
  // actor stands, one (several: chosen on a's own ai stream, as any exhibit's ties are,
  // §8.2), taken through AI.towards. Returns the step's cost, or null.
  function stepToward(state, a, goal, fromYou, ev) {
    const m = state.dept, far = m.w * m.h;
    const toGoal = Grid.distances(m, [goal], far, avoider(m, fromYou, far), 'exhibit'), here = toGoal[a.y * m.w + a.x];
    if (here <= 0) return null;
    const options = [];
    for (let d = 0; d < 8; d++) {
      if (!Grid.canStep(m, a.x, a.y, d, 'exhibit')) continue;
      const nx = a.x + Grid.DX[d], ny = a.y + Grid.DY[d], v = toGoal[ny * m.w + nx];
      if (v < 0 || v >= here || Actors.at(state, nx, ny, a) || !Archetypes.mayStep(state, a, nx, ny)) continue;
      options.push(d);
    }
    if (!options.length) return null;
    const d = options.length === 1 ? options[0] : Rng.stream(state, 'ai/' + a.uid).pick(options);
    return AI.towards(state, a, [a.x + Grid.DX[d], a.y + Grid.DY[d]], 'onto', ev);
  }

  function act(state, a, ev) {
    if (a.mode !== 'hunting' || Cases.encased(state, a) || !AI.sees(state, a)) return null;
    const m = state.dept, you = state.actors[0], [lo, hi] = N.KITER_HOLD;
    const fromYou = AI.field(state, a, you, 'beside'), w = fromYou[a.y * m.w + a.x];
    const near = Actors.between(a, you) === 1 || (w >= 0 && w < lo);
    const shoot = () => { const r = Ranged.shoot(state, a, you.x, you.y, { kind: 'shot' }, ev); return typeof r === 'number' ? r : null; };
    let tried = false;
    const toPost = () => { tried = true; const goal = post(state, a, fromYou); return goal ? stepToward(state, a, goal, fromYou, ev) : null; };
    let r = null;
    if (near) r = AI.away(state, a, you, ev);
    else if (w > hi) r = toPost();
    if (r === null && clear(state, a, a.x, a.y)) r = shoot();
    if (r === null && w >= lo && !near && !tried) r = toPost();
    if (r === null && w > hi) r = AI.towards(state, a, you, 'beside', ev);
    if (r === null && (near || w >= 0)) r = AI.wait(state, a, ev);
    return r;
  }

  Archetypes.add('kiter', { act });
})();
