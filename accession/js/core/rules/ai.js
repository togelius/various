// ACCESSION — an exhibit's turn (BUILD.md §8.1, §8.2). W0d built the order of the turn, sight,
// and the moves every behaviour is made of; W1-WAKE-B owns the file, and builds the
// behaviour by mode (AI.byMode), which is the plodder's, and every exhibit's when its
// archetype has nothing of its own to do.
//
// AI.act(state, a, ev) returns the action's cost in ticks; it never writes a's own `next`,
// which the scheduler sets after the action (Step, advance). Each step below is called
// through the namespace, so a test can wrap it.
//
// The six modes (§8.2), and how an exhibit leaves each one. Every timer counts turns from
// the exhibit's `stim`, which means one thing per mode:
//   dormant       not scheduled; it never acts.
//   awake         stim: its last stimulus (waking, or a noise that sent it to look). It
//                 walks to what it was sent to look at, then wanders its home room, going
//                 round other actors; when they leave it no way there, it gives up that
//                 place (and picks another at its next action). AWAKE_IDLE_TURNS without a
//                 stimulus → returning (lost, idle), unless it has no home, never sleeps
//                 (trigger `awake`) or may not go back (AI.mayReturn, M4's alarm).
//   hunting       stim: the last turn it saw you (or began the hunt). It strikes you if it
//                 can, walks toward you while it sees you, else to the tile where it last
//                 knew you were; LOSE_TRACK_TURNS (AI.loseTrackTurns) out of sight →
//                 searching (lost, out_of_sight).
//   searching     stim: its arrival at your last-known tile (or the turn it could get no
//                 closer). SEARCH_TURNS there → returning (lost, searched), or, if it may
//                 not go back, awake, wandering (alerted, searched).
//   returning     stim: the turn it set off. It walks home, going round other actors; on
//                 arriving → reinstalling (returned, arrived), then its archetype's onHome.
//                 When other actors leave it no step home → awake, wandering (alerted,
//                 blocked), so it goes back again AWAKE_IDLE_TURNS later.
//   reinstalling  stim: its arrival. It waits; REINSTALL_TURNS later → dormant with 1 pip,
//                 or none for a pipless exhibit (returned, reinstalled).
// Seeing you turns awake, searching, returning and reinstalling into hunting (AI.look). An
// exhibit in an intact case (encased) changes mode by the same timers but only ever waits:
// it never steps out of its case and never strikes out (§8.3).
//
// Two ways of walking (§8.2). After you (hunting, toward you or your last-known tile, and
// searching, to that tile) it takes the first step of a shortest walking path, on which
// actors never count (AI.towards, AI.route), and waits if another actor stands on every such
// step. Anywhere else (to look, to wander, home) it walks round the other actors where they
// stand now: the first step of a shortest walking path that crosses no tile another actor
// stands on (AI.around). A place another actor stands on is, like one no exhibit can stand
// on, reached beside it; home must be stood on.
'use strict';
const AI = (() => {
  const SEES = ['awake', 'hunting', 'searching', 'returning', 'reinstalling'];

  // An exhibit's turn, in order (§8.1):
  //   0. it counts the action (acts: its actions since it last woke, this one included);
  //   1. fixed: it waits (a pending mark was already called off when the status was put
  //      on, Status.apply; the cancel here is a guard that finds nothing to call off);
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
  // Can a's whole footprint stand with its anchor at (x, y)? Every tile walkable for an exhibit.
  function stands(m, s, x, y) {
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (!Grid.walkable(m, x + dx, y + dy, 'exhibit')) return false;
    return true;
  }
  // The first actor other than a on a tile a would cover with its anchor at (x, y).
  function blocker(state, a, x, y) {
    const s = a.size || 1;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) { const o = Actors.at(state, x + dx, y + dy, a); if (o) return o; }
    return null;
  }
  // The tiles other actors stand on, as a walking round them sees them now: a Uint8Array,
  // 1 on every tile of the footprint of every actor but a that is not gone. Not part of the
  // state.
  function occupied(state, a) {
    const m = state.dept, occ = new Uint8Array(m.w * m.h);
    for (const o of state.actors) {
      if (o === a || o.gone) continue;
      for (const [x, y] of Actors.footprint(o)) if (Grid.inside(m, x, y)) occ[y * m.w + x] = 1;
    }
    return occ;
  }
  // Does an s×s body with its anchor at (x, y), inside the map, cover no tile of occ? Always,
  // if occ is null (actors ignored).
  function clear(m, occ, s, x, y) {
    if (!occ) return true;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (occ[(y + dy) * m.w + x + dx] === 1) return false;
    return true;
  }

  // Walking distance for a 2×2 body (§4.1), by anchor tile: 0 wherever its whole footprint
  // stands beside the target without covering it, counting out to maxDist in steps its
  // whole footprint can take. Actors never block it, unless occ is given (walking round
  // them): then no anchor counts whose footprint covers a tile of occ. An Int32Array, -1
  // where unreached.
  function bodyDistances(state, a, target, maxDist, occ) {
    const m = state.dept, s = a.size || 1, ts = target.size || 1, dist = new Int32Array(m.w * m.h).fill(-1), queue = [];
    const body = { x: 0, y: 0, size: s };
    const covers = (x, y) => x < target.x + ts && target.x < x + s && y < target.y + ts && target.y < y + s;
    for (let y = target.y - s; y <= target.y + ts; y++) for (let x = target.x - s; x <= target.x + ts; x++) {
      body.x = x; body.y = y;
      if (Grid.inside(m, x, y) && !covers(x, y) && stands(m, s, x, y) && clear(m, occ, s, x, y) && Combat.adjacent(state, body, target)) { dist[y * m.w + x] = 0; queue.push(y * m.w + x); }
    }
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      if (dist[p] >= maxDist) continue;
      body.x = p % m.w; body.y = Int.idiv(p, m.w);
      for (let d = 0; d < 8; d++) {
        if (!fits(m, body, d)) continue;
        const r = (body.y + Grid.DY[d]) * m.w + body.x + Grid.DX[d];
        if (dist[r] < 0 && clear(m, occ, s, body.x + Grid.DX[d], body.y + Grid.DY[d])) { dist[r] = dist[p] + 1; queue.push(r); }
      }
    }
    return dist;
  }

  // Walking distance for a body of a's size to stand with its anchor on the tile (x, y), by
  // anchor tile: the number of whole-footprint steps from each anchor to it (searched
  // backward from the tile: an anchor r counts when its body can step from r toward it).
  // An Int32Array, -1 where it cannot. For a 2×2 body going home (§4.1). With occ (walking
  // round other actors), no anchor counts whose footprint covers a tile of occ.
  function anchorDistances(state, a, x, y, occ) {
    const m = state.dept, s = a.size || 1, dist = new Int32Array(m.w * m.h).fill(-1), queue = [];
    if (!Grid.inside(m, x, y) || !stands(m, s, x, y) || !clear(m, occ, s, x, y)) return dist;
    const body = { x: 0, y: 0, size: s };
    dist[y * m.w + x] = 0; queue.push(y * m.w + x);
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i], px = p % m.w, py = Int.idiv(p, m.w);
      for (let d = 0; d < 8; d++) {
        body.x = px - Grid.DX[d]; body.y = py - Grid.DY[d];
        if (!Grid.inside(m, body.x, body.y)) continue;
        const r = body.y * m.w + body.x;
        if (dist[r] >= 0 || !fits(m, body, d) || !clear(m, occ, s, body.x, body.y)) continue;
        dist[r] = dist[p] + 1; queue.push(r);
      }
    }
    return dist;
  }

  // A goal is a tile [x, y] or an actor. `how` says where a has arrived:
  //   'beside'  standing beside it (as for a blow);
  //   'onto'    standing on the tile; for a 2×2 body, or a tile an exhibit cannot stand on
  //             (a case, a plinth, a wall, a staff door), as near as it can: beside it;
  //             walking round other actors, also beside a tile another actor stands on;
  //   'anchor'  standing with its anchor on the tile (a 2×2 body going home); for a one-tile
  //             body the same as 'onto', except that walking round other actors, a tile
  //             another actor stands on cannot be reached.
  const isTile = g => Array.isArray(g);
  // The walking distances to the goal and the distance at which a has arrived:
  // {dist: Int32Array (-1 where unreached), stop}. occ: null (actors never count), or the
  // tiles other actors stand on (occupied), which a walking round them never crosses. Not
  // part of the state.
  function goalField(state, a, goal, how, occ) {
    const m = state.dept, far = m.w * m.h, s = a.size || 1;
    if (isTile(goal) && how === 'anchor' && s > 1) return { dist: anchorDistances(state, a, goal[0], goal[1], occ), stop: 0 };
    if (s > 1) return { dist: bodyDistances(state, a, isTile(goal) ? { x: goal[0], y: goal[1], size: 1 } : goal, far, occ), stop: 0 };
    // Walking round other actors, a step onto a tile one stands on costs more than any walk.
    const extra = occ ? (x, y) => occ[y * m.w + x] === 1 ? far + 1 : 0 : null;
    const free = (x, y) => !occ || occ[y * m.w + x] !== 1;
    if (isTile(goal) && (!Grid.walkable(m, goal[0], goal[1], 'exhibit') || (how === 'onto' && !free(goal[0], goal[1])))) {
      // A tile it cannot stand on: as near as it can get, beside it.
      const starts = [];
      for (let d = 0; d < 8; d++) { const x = goal[0] + Grid.DX[d], y = goal[1] + Grid.DY[d]; if (Grid.walkable(m, x, y, 'exhibit') && free(x, y)) starts.push([x, y]); }
      return { dist: Grid.distances(m, starts, far, extra, 'exhibit'), stop: 0 };
    }
    // Home, with another actor standing on it: there is no way onto it now.
    if (isTile(goal) && !free(goal[0], goal[1])) return { dist: new Int32Array(m.w * m.h).fill(-1), stop: 0 };
    const starts = isTile(goal) ? [goal] : Actors.footprint(goal);
    return { dist: Grid.distances(m, starts, far, extra, 'exhibit'), stop: how === 'beside' ? 1 : 0 };
  }
  // AI.field(state, a, goal, how) → Int32Array: a's walking distance to the goal from every
  // anchor tile, by the exhibits' step rule (staff doors are walls; nothing steps out of a
  // case), -1 where unreached; AI.arrived(a, how) is the distance at which a has arrived on
  // a goal it can stand on. Actors never block it. Not part of the state.
  const field = (state, a, goal, how) => goalField(state, a, goal, how).dist;
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

  // AI.route(state, a, goal, how) → {here, arrived, options}: the way toward a goal from where
  // a stands, actors never counting (as after you). here is a's walking distance to it (-1:
  // it cannot get there); arrived is true once it stands where the goal asks; options are
  // the first steps of a shortest walking path that a may take now (none if it has arrived,
  // cannot get there, or every such step is blocked).
  function way(state, a, f) {
    const m = state.dept, here = f.dist[a.y * m.w + a.x];
    if (here < 0) return { here, arrived: false, options: [] };
    if (here <= f.stop) return { here, arrived: true, options: [] };
    return { here, arrived: false, options: options(state, a, f.dist, v => v >= 0 && v < here) };
  }
  const route = (state, a, goal, how) => way(state, a, goalField(state, a, goal, how, null));
  // AI.around(state, a, goal, how) → {here, arrived, options}: the same, walking round the
  // other actors where they stand now (§8.2): here is a's walking distance to the goal over
  // tiles no other actor stands on (-1: they leave it no way there now), and options are the
  // first steps of a shortest such walk. A tile goal another actor stands on is reached
  // beside it ('onto'), or not at all ('anchor').
  const around = (state, a, goal, how) => way(state, a, goalField(state, a, goal, how, occupied(state, a)));

  // AI.towards(state, a, goal, how, ev) → ticks | null: the first step of a shortest walking
  // path toward the goal (§8.2), or null if a has arrived, cannot reach it, or every such
  // step is blocked.
  const towards = (state, a, goal, how, ev) => stepAmong(state, a, route(state, a, goal, how).options, ev);
  // AI.away(state, a, from, ev) → ticks | null: a step that takes a further from `from` (a
  // tile or an actor) by walking distance, or null if there is none.
  function away(state, a, from, ev) {
    const m = state.dept, dist = AI.field(state, a, from, 'onto'), here = dist[a.y * m.w + a.x];
    if (here < 0) return null;
    return stepAmong(state, a, options(state, a, dist, v => v > here), ev);
  }

  // AI.strike(state, a, b, ev) → ticks | null: a melee blow at b, if Combat.canStrike allows it.
  const strike = (state, a, b, ev) => Combat.canStrike(state, a, b, { kind: 'melee' }) ? null : Combat.strike(state, a, b, ev);

  // Is a standing on its home (its anchor on the home tile)?
  const atHome = a => !!a.home && a.x === a.home[0] && a.y === a.home[1];
  // May a go back to sleep at home when its search ends or nothing has stirred it? Not if it
  // has no home (its case was broken or dissolved: it stays awake and wanders), never sleeps
  // (trigger `awake`), or may not (AI.mayReturn: M4's alarm).
  const mayGoHome = (state, a) => a.home !== null && a.trigger !== 'awake' && AI.mayReturn(state, a);
  const since = (state, a) => state.turn - a.stim;

  // AI.byMode(state, a, ev) → ticks: the generic behaviour by mode, which is the plodder's
  // (see the top of this file). First the mode's timer, which may change the mode; then the
  // action of the mode it is in.
  function byMode(state, a, ev) {
    switch (a.mode) {
      case 'hunting': return hunt(state, a, ev);
      case 'awake': return roam(state, a, ev);
      case 'searching': return search(state, a, ev);
      case 'returning': return goHome(state, a, ev);
      case 'reinstalling': return reinstall(state, a, ev);
    }
    return AI.wait(state, a, ev);
  }

  // Hunting (§8.2): out of sight for loseTrackTurns, it searches; otherwise it strikes you if
  // it can, walks toward you if it sees you, else toward your last-known tile.
  function hunt(state, a, ev) {
    const you = state.actors[0], seen = AI.sees(state, a), lose = AI.loseTrackTurns(state, a);
    if (!seen && since(state, a) >= lose) {
      Wake.setMode(state, a, 'searching', { k: 'out_of_sight', turns: since(state, a) }, ev);
      return search(state, a, ev);
    }
    if (Cases.encased(state, a)) return AI.wait(state, a, ev);
    const r = AI.strike(state, a, you, ev);
    if (r !== null) return r;
    const t = seen ? AI.towards(state, a, you, 'beside', ev) : a.lastKnown ? AI.towards(state, a, a.lastKnown, 'onto', ev) : null;
    return t !== null ? t : AI.wait(state, a, ev);
  }

  // Awake (§8.2): AWAKE_IDLE_TURNS without a stimulus and it goes back, if it may; otherwise
  // it walks to what it was sent to look at, going round other actors, waits there a moment,
  // then wanders its room. Once there, or once the others leave it no step there, it drops
  // that place and waits, and picks a place to wander to at its next action.
  function roam(state, a, ev) {
    if (since(state, a) >= N.AWAKE_IDLE_TURNS && mayGoHome(state, a)) {
      Wake.setMode(state, a, 'returning', { k: 'idle', turns: since(state, a) }, ev);
      return goHome(state, a, ev);
    }
    if (Cases.encased(state, a)) return AI.wait(state, a, ev);
    if (!a.target) a.target = AI.wanderGoal(state, a);
    if (!a.target) return AI.wait(state, a, ev);
    const w = AI.around(state, a, a.target, 'onto');
    const t = w.arrived ? null : stepAmong(state, a, w.options, ev);
    if (t === null) { a.target = null; return AI.wait(state, a, ev); }
    return t;
  }

  // Searching (§8.2): it walks to your last-known tile; once there (or once no step gets it
  // closer) it searches for SEARCH_TURNS, then goes back, or, if it may not, wanders.
  function search(state, a, ev) {
    const w = a.lastKnown && !Cases.encased(state, a) ? route(state, a, a.lastKnown, 'onto') : null;
    if (w && !w.arrived && w.options.length) {
      const t = stepAmong(state, a, w.options, ev);
      if (t !== null) { a.stim = state.turn; return t; }
    }
    if (since(state, a) < N.SEARCH_TURNS) return AI.wait(state, a, ev);
    if (mayGoHome(state, a)) {
      Wake.setMode(state, a, 'returning', { k: 'searched' }, ev);
      return goHome(state, a, ev);
    }
    Wake.setMode(state, a, 'awake', { k: 'searched' }, ev, { target: AI.wanderGoal(state, a) || [a.x, a.y] });
    return AI.wait(state, a, ev);
  }

  // An exhibit that was going home or settling back in, and has no home left: it wanders.
  function homeless(state, a, ev) {
    Wake.setMode(state, a, 'awake', { k: 'homeless' }, ev, { target: AI.wanderGoal(state, a) || [a.x, a.y] });
    return AI.wait(state, a, ev);
  }
  // An exhibit going home that other actors leave no step home (they stand on its home, or
  // in every way to it), or whose archetype allows it none: it wanders its room instead, and
  // goes back again after AWAKE_IDLE_TURNS undisturbed (setMode sets stim).
  function blocked(state, a, ev) {
    Wake.setMode(state, a, 'awake', { k: 'blocked' }, ev, { target: AI.wanderGoal(state, a) || [a.x, a.y] });
    return AI.wait(state, a, ev);
  }
  // On arriving home: it reinstalls (returned, arrived), and its archetype's onHome runs.
  function arrive(state, a, ev) {
    Wake.setMode(state, a, 'reinstalling', { k: 'home', x: a.home[0], y: a.home[1] }, ev);
    Archetypes.onHome(state, a, ev);
  }

  // Returning (§8.2): it walks home, going round other actors, and reinstalls on arriving; if
  // they leave it no step home, it wanders instead (blocked).
  function goHome(state, a, ev) {
    if (!a.home) return homeless(state, a, ev);
    if (AI.atHome(a)) { arrive(state, a, ev); return AI.wait(state, a, ev); }
    if (Cases.encased(state, a)) return AI.wait(state, a, ev);
    const t = stepAmong(state, a, AI.around(state, a, a.home, 'anchor').options, ev);
    if (t === null) return blocked(state, a, ev);
    if (AI.atHome(a) && a.mode === 'returning') arrive(state, a, ev);
    return t;
  }

  // Reinstalling (§8.2): it waits at home; REINSTALL_TURNS after arriving it is dormant again,
  // with 1 pip (a pipless exhibit gains none, §8.2), stirred now. Moved off its home
  // meanwhile, it goes back to it.
  function reinstall(state, a, ev) {
    if (!a.home) return homeless(state, a, ev);
    if (!AI.atHome(a)) {
      Wake.setMode(state, a, 'returning', { k: 'displaced' }, ev);
      return goHome(state, a, ev);
    }
    if (since(state, a) < N.REINSTALL_TURNS) return AI.wait(state, a, ev);
    const c = AI.wait(state, a, ev);
    Wake.setMode(state, a, 'dormant', { k: 'home', x: a.home[0], y: a.home[1] }, ev);
    a.pips = Archetypes.pipless(state, a) ? 0 : 1;
    a.stim = state.turn;
    return c;
  }

  // AI.wanderGoal(state, a) → [x, y] | null: where an awake exhibit with nothing to look at
  // wanders to (§8.2, "wanders its room"): a tile of its home room (the room it stands in, if
  // it has no home; the whole map in a room made for a test, which has no rooms) that it
  // could stand on and walk to from where it is, other than its own tile, drawn on its own
  // ai/<uid> stream from those tiles in row-major order. null if there is none. Other actors
  // do not count here, so where they stand never changes what it draws (§3.2); walking there,
  // it goes round them, and a tile one stands on it reaches beside it (roam).
  function wanderGoal(state, a) {
    const m = state.dept, s = a.size || 1, ref = a.home || [a.x, a.y];
    const rooms = m.roomOf && m.roomOf.length ? m.roomOf : null;
    const id = rooms && rooms[ref[1]] ? rooms[ref[1]][ref[0]] : null;
    const reach = s > 1 ? bodyReach(state, a) : Grid.distances(m, [[a.x, a.y]], m.w * m.h, null, 'exhibit');
    const out = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (reach[y * m.w + x] <= 0) continue;
      if (rooms && rooms[y][x] !== id) continue;
      out.push([x, y]);
    }
    if (!out.length) return null;
    return Rng.stream(state, 'ai/' + a.uid).pick(out).slice();
  }
  // The anchors a 2×2 body can walk to from where it stands (forward), -1 where it cannot.
  function bodyReach(state, a) {
    const m = state.dept, dist = new Int32Array(m.w * m.h).fill(-1), queue = [a.y * m.w + a.x];
    const body = { x: 0, y: 0, size: a.size || 1 };
    dist[queue[0]] = 0;
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      body.x = p % m.w; body.y = Int.idiv(p, m.w);
      for (let d = 0; d < 8; d++) {
        if (!fits(m, body, d)) continue;
        const r = (body.y + Grid.DY[d]) * m.w + body.x + Grid.DX[d];
        if (dist[r] < 0) { dist[r] = dist[p] + 1; queue.push(r); }
      }
    }
    return dist;
  }

  // Turns out of sight before a hunter searches (§8.2); M4's Vanishing Act shortens it.
  const loseTrackTurns = (state, a) => N.LOSE_TRACK_TURNS;
  // [M4] May an idle awake exhibit go back? The alarm says no ("awake exhibits do not return").
  const mayReturn = (state, a) => true;
  // [M4] After each exhibit step (Single File).
  function afterStep(state, a, ev) {}

  return { act, sees, look, wait, field, arrived, route, around, towards, away, strike, bodyDistances, anchorDistances, atHome, mayGoHome,
    byMode, wanderGoal, loseTrackTurns, mayReturn, afterStep };
})();
