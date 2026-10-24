// ACCESSION — an exhibit's turn (BUILD.md §8.1, §8.2). W0d builds the order of the turn, sight,
// and the moves every behaviour is made of; W1-WAKE-B owns the file after, and builds the
// behaviour by mode (AI.byMode), which is the plodder's.
//
// AI.act(state, a, ev) returns the action's cost in ticks; it never writes a's own `next`,
// which the scheduler sets after the action (Step, advance). Each step below is called
// through the namespace, so a test can wrap it.
'use strict';
const AI = (() => {
  const SEES = ['awake', 'hunting', 'searching', 'returning', 'reinstalling'];

  // An exhibit's turn, in order (§8.1):
  //   0. it counts the action (acts: its actions since it last woke, this one included);
  //   1. fixed: a pending mark is cancelled, and it waits;
  //   2. it looks for you (AI.look);
  //   3. a pending mark resolves (Specials.resolve);
  //   4. its archetype or a modifier acts (Archetypes.act), unless that gives null;
  //   5. otherwise it acts by its mode (AI.byMode).
  function act(state, a, ev) {
    a.acts++;
    if (Status.has(a, 'fixed')) {
      if (a.telegraph) Specials.cancel(state, a, 'fixed', ev);
      return AI.wait(state, a, ev);
    }
    AI.look(state, a, ev);
    if (a.telegraph) return Specials.resolve(state, a, ev);
    const r = Archetypes.act(state, a, ev);
    if (r !== null) return r;
    return AI.byMode(state, a, ev);
  }

  // AI.sees(state, a) → bool: an awake, hunting, searching, returning or reinstalling exhibit
  // sees you within SIGHT_EXHIBIT (Grid.disc) of some tile of its footprint, with line of
  // sight from that tile (§8.2). A sleeping exhibit sees nothing.
  function sees(state, a) {
    if (a.gone || !SEES.includes(a.mode)) return false;
    const you = state.actors[0], r = N.SIGHT_EXHIBIT;
    for (const [x, y] of Actors.footprint(a)) if (Grid.disc(you.x - x, you.y - y, r) && Grid.los(state.dept, x, y, you.x, you.y)) return true;
    return false;
  }

  // AI.look(state, a, ev): if a sees you, an exhibit that is awake, searching, returning or
  // reinstalling starts to hunt you (being seen, with the distance); then, hunting or not,
  // it has seen you since it woke (sawYou), knows your tile (lastKnown), and was stirred now.
  function look(state, a, ev) {
    if (!AI.sees(state, a)) return false;
    const you = state.actors[0];
    if (a.mode !== 'hunting') Wake.setMode(state, a, 'hunting', { k: 'seen', dist: Actors.dist(a, you.x, you.y) }, ev);
    a.sawYou = true;
    a.lastKnown = [you.x, you.y];
    a.stim = state.turn;
    return true;
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

  // A goal is a tile [x, y] or an actor. `how` is 'beside' (to stand beside it, as for a
  // blow) or 'onto' (to stand on the tile; for a 2×2 body, beside it).
  const isTile = g => Array.isArray(g);
  // AI.field(state, a, goal, how) → Int32Array: a's walking distance to the goal from every
  // anchor tile, by the exhibits' step rule (staff doors are walls; nothing steps out of a
  // case), -1 where unreached; with the distance at which a has arrived (AI.arrived).
  // Actors never block it. Not part of the state.
  function field(state, a, goal, how) {
    const m = state.dept, far = m.w * m.h;
    if ((a.size || 1) > 1) return bodyDistances(state, a, isTile(goal) ? { x: goal[0], y: goal[1], size: 1 } : goal, far);
    const starts = isTile(goal) ? [goal] : Actors.footprint(goal);
    return Grid.distances(m, starts, far, null, 'exhibit');
  }
  // The distance in AI.field at which a has arrived: beside the goal (1) for a one-tile body
  // going 'beside', otherwise 0.
  const arrived = (a, how) => how === 'beside' && (a.size || 1) === 1 ? 1 : 0;

  // One step of a's whole footprint in a direction from `options`, the ties broken on its
  // own ai stream (§8.2), through Step.moveInto (a closed door on the way is opened, and a
  // opens it from where it stands). Returns the cost, or null.
  function stepAmong(state, a, options, ev) {
    if (!options.length) return null;
    const d = options.length === 1 ? options[0] : Rng.stream(state, 'ai/' + a.uid).pick(options);
    const x = a.x, y = a.y, r = Step.moveInto(state, a, d, ev);
    if (typeof r !== 'number') return null;
    if (a.x !== x || a.y !== y) AI.afterStep(state, a, ev);
    return r;
  }
  // The directions a may step in toward tile values `ok(v)` of dist: every tile of its
  // footprint may step there, no other actor stands there, and its archetype allows it.
  function options(state, a, dist, ok) {
    const m = state.dept, out = [];
    for (let d = 0; d < 8; d++) {
      if (!fits(m, a, d)) continue;
      const nx = a.x + Grid.DX[d], ny = a.y + Grid.DY[d], v = dist[ny * m.w + nx];
      if (!ok(v) || blocker(state, a, nx, ny) || !Archetypes.mayStep(state, a, nx, ny)) continue;
      out.push(d);
    }
    return out;
  }

  // AI.towards(state, a, goal, how, ev) → ticks | null: the first step of a shortest walking
  // path toward the goal (§8.2), or null if a has arrived, cannot reach it, or every such
  // step is blocked.
  function towards(state, a, goal, how, ev) {
    const m = state.dept, dist = AI.field(state, a, goal, how), here = dist[a.y * m.w + a.x];
    if (here < 0 || here <= arrived(a, how)) return null;
    return stepAmong(state, a, options(state, a, dist, v => v >= 0 && v < here), ev);
  }
  // AI.away(state, a, from, ev) → ticks | null: a step that takes a further from `from` (a
  // tile or an actor) by walking distance, or null if there is none.
  function away(state, a, from, ev) {
    const m = state.dept, dist = AI.field(state, a, from, 'onto'), here = dist[a.y * m.w + a.x];
    if (here < 0) return null;
    return stepAmong(state, a, options(state, a, dist, v => v > here), ev);
  }

  // AI.strike(state, a, b, ev) → ticks | null: a melee blow at b, if Combat.canStrike allows it.
  const strike = (state, a, b, ev) => Combat.canStrike(state, a, b, { kind: 'melee' }) ? null : Combat.strike(state, a, b, ev);

  // [stub → W1-WAKE-B] The behaviour by mode, which is the plodder's: an encased exhibit only
  // waits; a hunter strikes you if it can, or steps toward you; every other exhibit waits.
  function byMode(state, a, ev) {
    if (Cases.encased(state, a)) return AI.wait(state, a, ev);
    if (a.mode === 'hunting') {
      const you = state.actors[0];
      const r = AI.strike(state, a, you, ev);
      if (r !== null) return r;
      const t = AI.towards(state, a, you, 'beside', ev);
      if (t !== null) return t;
    }
    return AI.wait(state, a, ev);
  }
  // [stub → W1-WAKE-B] Where an awake exhibit with nothing to investigate wanders to: null.
  const wanderGoal = (state, a) => null;
  // [stub → W1-WAKE-B] Turns out of sight before a hunter searches (§8.2); M4's Vanishing Act shortens it.
  const loseTrackTurns = (state, a) => N.LOSE_TRACK_TURNS;
  // [M4] May an idle awake exhibit go back? The alarm says no ("awake exhibits do not return").
  const mayReturn = (state, a) => true;
  // [M4] After each exhibit step (Single File).
  function afterStep(state, a, ev) {}

  return { act, sees, look, wait, field, arrived, towards, away, strike, bodyDistances, byMode, wanderGoal, loseTrackTurns, mayReturn, afterStep };
})();
