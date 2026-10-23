// ACCESSION — step(state, action) → events: the only function that changes the state
// (BUILD.md §3.1). It applies your action, then lets every other actor act until it is
// your turn again, resolving turn boundaries on the way (§8.1).
'use strict';
const Step = (() => {
  const refuse = (state, reason) => [{ k: 'refused', turn: state.turn, reason }];

  // Can a reach b with a blow? Some tile of a's footprint is next to some tile of b's
  // (BUILD.md §4.1), and a diagonal blow may not cross a corner you could not step past.
  function adjacent(state, a, b) {
    const m = state.dept, sa = a.size || 1, sb = b.size || 1;
    for (let ay = a.y; ay < a.y + sa; ay++) for (let ax = a.x; ax < a.x + sa; ax++)
      for (let by = b.y; by < b.y + sb; by++) for (let bx = b.x; bx < b.x + sb; bx++) {
        const dx = bx - ax, dy = by - ay;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) continue;
        if (dx === 0 || dy === 0) return true;
        if (Grid.walkable(m, bx, ay) && Grid.walkable(m, ax, by)) return true;
      }
    return false;
  }

  // The first actor other than a on a tile a would cover with its anchor at (x, y).
  function blocker(state, a, x, y) {
    const s = a.size || 1;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) { const o = Actors.at(state, x + dx, y + dy, a); if (o) return o; }
    return null;
  }
  // Can a's whole footprint step in direction d? Each of its tiles follows the step rule
  // (§8.2), so it moves only where all its tiles can go (§4.1).
  function fits(m, a, d) {
    const s = a.size || 1;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (!Grid.canStep(m, a.x + dx, a.y + dy, d)) return false;
    return true;
  }

  // A blow from a at b. Returns the cost.
  function strike(state, a, b, ev) {
    Combat.attack(state, a, b, ev);
    return Actors.attackCost(a);
  }

  // Moving into a tile: attack what stands there (any tile of its footprint, §7.1), open a
  // closed door, or walk. Returns the cost in ticks, or a refusal string.
  function moveInto(state, a, d, ev) {
    const m = state.dept, s = a.size || 1, nx = a.x + Grid.DX[d], ny = a.y + Grid.DY[d];
    const other = blocker(state, a, nx, ny);
    if (other) {
      if (!adjacent(state, a, other)) return 'You cannot reach it past the corner.';
      if (a.uid !== 'you' && other.uid !== 'you') return 'blocked';
      return strike(state, a, other, ev);
    }
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
      const x = nx + dx, y = ny + dy;
      if (Grid.ch(m, x, y) === '+' && Grid.canStep(m, a.x + dx, a.y + dy, d)) {
        Grid.set(m, x, y, "'");
        ev.push({ k: 'opened', turn: state.turn, who: a.uid, x, y });
        return Actors.cost(a, N.COST_DOOR);
      }
    }
    if (!fits(m, a, d)) return 'Something is in the way.';
    ev.push({ k: 'moved', turn: state.turn, who: a.uid, from: [a.x, a.y], to: [nx, ny] });
    a.x = nx; a.y = ny;
    return Actors.cost(a, N.COST_STEP);
  }

  // Your action. Returns the cost, or a refusal string.
  function yours(state, action, ev) {
    const you = state.actors[0];
    switch (action.a) {
      case 'move': {
        if (!(action.dir >= 0 && action.dir < 8)) return 'No such direction.';
        return moveInto(state, you, action.dir, ev);
      }
      case 'wait':
        ev.push({ k: 'waited', turn: state.turn, who: 'you' });
        return N.COST_WAIT;
      case 'attack': {
        const t = Actors.byUid(state, action.uid);
        if (!t || t.gone || t === you) return 'There is nothing there to attack.';
        if (!adjacent(state, you, t)) return 'It is out of reach.';
        return strike(state, you, t, ev);
      }
      default:
        return 'Unknown action.';
    }
  }

  // One exhibit's turn. M0: a hunting exhibit closes in and strikes; others wait.
  function act(state, a, ev) {
    const you = state.actors[0];
    let cost = Actors.cost(a, N.COST_WAIT);
    if (a.mode === 'hunting') {
      if (adjacent(state, a, you)) cost = strike(state, a, you, ev);
      else {
        const r = chase(state, a, you, ev);
        if (r !== null) cost = r;
      }
    }
    a.next += cost;
  }

  // Walking distance for a 2×2 body (§4.1), by anchor tile: 0 wherever its whole footprint
  // stands beside the target without covering it, counting out to maxDist in steps its
  // whole footprint can take. Actors never block it. An Int32Array, -1 where unreached.
  function bodyDistances(state, a, target, maxDist) {
    const m = state.dept, s = a.size || 1, ts = target.size || 1, dist = new Int32Array(m.w * m.h).fill(-1), queue = [];
    const body = { x: 0, y: 0, size: s };
    const stands = () => { for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (!Grid.walkable(m, body.x + dx, body.y + dy)) return false; return true; };
    const covers = (x, y) => x < target.x + ts && target.x < x + s && y < target.y + ts && target.y < y + s;
    for (let y = target.y - s; y <= target.y + ts; y++) for (let x = target.x - s; x <= target.x + ts; x++) {
      body.x = x; body.y = y;
      if (Grid.inside(m, x, y) && !covers(x, y) && stands() && adjacent(state, body, target)) { dist[y * m.w + x] = 0; queue.push(y * m.w + x); }
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
    const m = state.dept, big = (a.size || 1) > 1;
    const dist = big ? bodyDistances(state, a, target, 64) : Grid.distances(m, [[target.x, target.y]], 64);
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
    const r = moveInto(state, a, d, ev);
    return typeof r === 'number' ? r : null;
  }

  // Turn-boundary effects, in the fixed order of §8.1.
  function boundary(state, ev) {
    Status.tick(state, ev);
    regenerate(state, ev);
  }

  function regenerate(state, ev) {
    const you = state.actors[0];
    if (you.gone || you.hp >= you.maxHp) return;
    const every = Math.max(N.REGEN_MIN, Int.idiv(N.REGEN_NUM, you.maxHp));
    if (state.turn % every === 0) { you.hp++; ev.push({ k: 'regenerated', turn: state.turn, who: 'you', hp: you.hp }); }
  }

  // Run the world until it is your turn again.
  function advance(state, ev) {
    for (;;) {
      if (state.over) return;
      const a = Actors.next(state);
      const boundaryTick = (state.turn + 1) * N.TICKS_PER_TURN;
      if (boundaryTick <= a.next) { state.turn++; state.tick = boundaryTick; boundary(state, ev); continue; }
      state.tick = a.next;
      if (a.uid === 'you') return;
      act(state, a, ev);
    }
  }

  function step(state, action) {
    if (state.over) return refuse(state, 'The visit is over.');
    const ev = [];
    const cost = yours(state, action, ev);
    if (typeof cost === 'string') return refuse(state, cost);
    const you = state.actors[0];
    you.next += cost;
    // Your ring is set by your last action that cost time (BUILD.md §8.2).
    if (cost > 0) you.still = STILL.includes(action.a);
    advance(state, ev);
    Vision.remember(state);
    return ev;
  }
  const STILL = ['wait', 'rest', 'view', 'sit'];

  // Every legal action for you now (BUILD.md §4.2). step() refuses exactly the others.
  function legal(state) {
    if (state.over) return [];
    const you = state.actors[0], out = [{ a: 'wait' }];
    // The same tests as moveInto: an actor on any tile of the step is struck if it can be
    // reached; otherwise the step (or the door it opens) must follow the step rule.
    for (let d = 0; d < 8; d++) {
      const other = blocker(state, you, you.x + Grid.DX[d], you.y + Grid.DY[d]);
      if (other ? adjacent(state, you, other) : fits(state.dept, you, d)) out.push({ a: 'move', dir: d });
    }
    for (const a of state.actors) if (a !== you && !a.gone && adjacent(state, you, a)) out.push({ a: 'attack', uid: a.uid });
    return out;
  }

  return { step, adjacent, legal };
})();
