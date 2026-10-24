// ACCESSION — an exhibit's turn (BUILD.md §8.1, §8.2). W0c moves M2's behaviour here from
// step.js: a hunting exhibit strikes you if it can, or steps toward you; every other exhibit
// waits. W0d builds the order of an exhibit's turn on it, and W1-WAKE-B owns it after.
//
// AI.act(state, a, ev) returns the action's cost in ticks; it never writes a's own `next`,
// which the scheduler sets after the action (Step, advance).
'use strict';
const AI = (() => {
  function act(state, a, ev) {
    const you = state.actors[0];
    if (Status.has(a, 'fixed')) return wait(state, a, ev);
    if (a.mode === 'hunting') {
      if (!Combat.canStrike(state, a, you, { kind: 'melee' })) return Combat.strike(state, a, you, ev);
      const r = chase(state, a, you, ev);
      if (r !== null) return r;
    }
    return wait(state, a, ev);
  }

  // An exhibit's wait: one action's cost, with no event.
  const wait = (state, a, ev) => Actors.cost(state, a, N.COST_WAIT, 'act');

  // Can a's whole footprint step in direction d, by the exhibits' step rule? Each of its
  // tiles follows the step rule (§8.2), so it moves only where all its tiles can go (§4.1).
  function fits(m, a, d) {
    const s = a.size || 1;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (!Grid.canStep(m, a.x + dx, a.y + dy, d, 'exhibit')) return false;
    return true;
  }
  // The first actor other than a on a tile a would cover with its anchor at (x, y).
  function blocker(state, a, x, y) {
    const s = a.size || 1;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) { const o = Actors.at(state, x + dx, y + dy, a); if (o) return o; }
    return null;
  }

  // Walking distance for a 2×2 body (§4.1), by anchor tile: 0 wherever its whole footprint
  // stands beside the target without covering it, counting out to maxDist in steps its
  // whole footprint can take. Actors never block it. An Int32Array, -1 where unreached.
  function bodyDistances(state, a, target, maxDist) {
    const m = state.dept, s = a.size || 1, ts = target.size || 1, dist = new Int32Array(m.w * m.h).fill(-1), queue = [];
    const body = { x: 0, y: 0, size: s };
    const stands = () => { for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (!Grid.walkable(m, body.x + dx, body.y + dy, 'exhibit')) return false; return true; };
    const covers = (x, y) => x < target.x + ts && target.x < x + s && y < target.y + ts && target.y < y + s;
    for (let y = target.y - s; y <= target.y + ts; y++) for (let x = target.x - s; x <= target.x + ts; x++) {
      body.x = x; body.y = y;
      if (Grid.inside(m, x, y) && !covers(x, y) && stands() && Combat.adjacent(state, body, target)) { dist[y * m.w + x] = 0; queue.push(y * m.w + x); }
    }
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      if (dist[p] >= maxDist) continue;
      body.x = p % m.w; body.y = Int.idiv(p, m.w);
      for (let d = 0; d < 8; d++) {
        if (!fits(m, body, d)) continue;
        const r = (body.y + Grid.DY[d]) * m.w + body.x + Grid.DX[d];
        if (dist[r] < 0) { dist[r] = dist[p] + 1; queue.push(r); }
      }
    }
    return dist;
  }

  // Step along the walking-distance gradient toward the target; ties broken on the
  // exhibit's own ai stream. Returns the cost, or null if it cannot move.
  function chase(state, a, target, ev) {
    const m = state.dept, big = (a.size || 1) > 1, far = m.w * m.h;
    const dist = big ? bodyDistances(state, a, target, far) : Grid.distances(m, [[target.x, target.y]], far, null, 'exhibit');
    const here = dist[a.y * m.w + a.x];
    if (here <= 0) return null;
    const options = [];
    for (let d = 0; d < 8; d++) {
      if (!fits(m, a, d)) continue;
      const nx = a.x + Grid.DX[d], ny = a.y + Grid.DY[d], v = dist[ny * m.w + nx];
      if (v < 0 || v >= here || blocker(state, a, nx, ny)) continue;
      options.push(d);
    }
    if (!options.length) return null;
    const d = options.length === 1 ? options[0] : Rng.stream(state, 'ai/' + a.uid).pick(options);
    const r = Step.moveInto(state, a, d, ev);
    return typeof r === 'number' ? r : null;
  }

  return { act, wait, chase, bodyDistances };
})();
