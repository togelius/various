// ACCESSION — step(state, action) → events: the only function that changes the state
// (BUILD.md §3.1). It applies your action, then lets every other actor act until it is
// your turn again, resolving turn boundaries on the way (§8.1).
'use strict';
const Step = (() => {
  const refuse = (state, reason) => [{ k: 'refused', turn: state.turn, reason }];

  // Can a reach b with a blow? Adjacent, and not across a corner you could not step past.
  function adjacent(state, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) return false;
    if (dx === 0 || dy === 0) return true;
    const m = state.dept;
    return Grid.walkable(m, b.x, a.y) && Grid.walkable(m, a.x, b.y);
  }

  const dirOf = (dx, dy) => { for (let d = 0; d < 8; d++) if (Grid.DX[d] === dx && Grid.DY[d] === dy) return d; return -1; };

  // Moving into a tile: attack what stands there, open a closed door, or walk. Returns the
  // cost in ticks, or a refusal string.
  function moveInto(state, a, d, ev) {
    const m = state.dept, nx = a.x + Grid.DX[d], ny = a.y + Grid.DY[d];
    const other = Actors.at(state, nx, ny);
    if (other) {
      if (!adjacent(state, a, other)) return 'You cannot reach it past the corner.';
      if (a.uid !== 'you' && other.uid !== 'you') return 'blocked';
      Combat.attack(state, a, other, ev);
      return Actors.attackCost(a);
    }
    if (Grid.ch(m, nx, ny) === '+' && Grid.canStep(m, a.x, a.y, d)) {
      Grid.set(m, nx, ny, "'");
      ev.push({ k: 'opened', turn: state.turn, who: a.uid, x: nx, y: ny });
      return Actors.cost(a, N.COST_DOOR);
    }
    if (!Grid.canStep(m, a.x, a.y, d)) return 'Something is in the way.';
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
        return moveInto(state, you, dirOf(t.x - you.x, t.y - you.y), ev);
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
      if (adjacent(state, a, you)) {
        Combat.attack(state, a, you, ev);
        cost = Actors.attackCost(a);
      } else {
        const r = chase(state, a, you, ev);
        if (r !== null) cost = r;
      }
    }
    a.next += cost;
  }

  // Step along the walking-distance gradient toward the target; ties broken on the
  // exhibit's own ai stream. Returns the cost, or null if it cannot move.
  function chase(state, a, target, ev) {
    const m = state.dept, dist = Grid.distances(m, [[target.x, target.y]], 64);
    const here = dist[a.y * m.w + a.x];
    if (here <= 0) return null;
    const options = [];
    for (let d = 0; d < 8; d++) {
      if (!Grid.canStep(m, a.x, a.y, d)) continue;
      const nx = a.x + Grid.DX[d], ny = a.y + Grid.DY[d], v = dist[ny * m.w + nx];
      if (v < 0 || v >= here || Actors.at(state, nx, ny)) continue;
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
    for (let d = 0; d < 8; d++) {
      const nx = you.x + Grid.DX[d], ny = you.y + Grid.DY[d], other = Actors.at(state, nx, ny);
      if (other ? adjacent(state, you, other) : (Grid.canStep(state.dept, you.x, you.y, d))) out.push({ a: 'move', dir: d });
    }
    for (const a of state.actors) if (a !== you && !a.gone && adjacent(state, you, a)) out.push({ a: 'attack', uid: a.uid });
    return out;
  }

  return { step, adjacent, legal };
})();
