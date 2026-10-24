// The Night Watchman's clause and the clock's rules about it, as invariants checked after
// every step (BUILD.md §5.3, check 1; §8.4). Each is written from the rule's sentence, not
// from the rule's code:
//   night_watchman.one     at most one Night Watchman is in the department at a time;
//   night_watchman.hunts   a Night Watchman is never asleep, searching, going back or
//                          reinstalling;
//   night_watchman.acts    each of its actions is a blow at you from beside you, or a step
//                          (or a door opened) strictly closer to you by an exhibit's walking
//                          distance, or, when no walk reaches you, strictly closer to the tile
//                          it can reach that is nearest you; it waits only when no such step is
//                          free; it never acts in the instant it comes in;
//   night_watchman.return  a new one comes in exactly WATCHMAN_RETURN clock counts after the
//                          last one fell, and the first only once the night watch has begun.
'use strict';
module.exports = (C) => {
  const { N } = C;
  const isW = a => !!a && a.arch === 'night_watchman';
  const BAD = ['dormant', 'searching', 'returning', 'reinstalling'];

  // Walking distances on a map, by the step rule for `who` ('exhibit': staff doors are walls).
  const walkFrom = (m, x, y, who) => C.Grid.distances(m, [[x, y]], m.w * m.h, null, who);
  const at = (d, m, x, y) => d[y * m.w + x];

  // Where the Watchman goes when no walk reaches you: among the tiles its own walk reaches
  // from (x, y), the one nearest you by your walking distance, then by its own, then
  // row-major; where none is reached by yours either, the nearest by Chebyshev distance.
  function goalFor(m, x, y, you) {
    const far = m.w * m.h, mine = walkFrom(m, x, y, 'exhibit'), yours = walkFrom(m, you.x, you.y);
    let best = null, bk = -1, bm = -1;
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
      const dm = at(mine, m, tx, ty);
      if (dm < 0) continue;
      const k = at(yours, m, tx, ty) >= 0 ? at(yours, m, tx, ty) : far + Math.max(Math.abs(tx - you.x), Math.abs(ty - you.y));
      if (best === null || k < bk || (k === bk && dm < bm)) { best = [tx, ty]; bk = k; bm = dm; }
    }
    return best;
  }

  const one = {
    id: 'night_watchman.one',
    check(pre, events, post) {
      const alive = post.actors.filter(a => isW(a) && !a.gone);
      return alive.length > 1 ? `${alive.length} Night Watchmen are in the department: ${alive.map(a => a.uid).join(', ')}` : null;
    },
  };

  const hunts = {
    id: 'night_watchman.hunts',
    applies: a => isW(a) && !a.gone,
    check(pre, events, post, ctx) {
      return BAD.includes(ctx.actor.mode) ? `${ctx.uid} is ${ctx.actor.mode}; a Night Watchman always comes for you` : null;
    },
  };

  const acts = {
    id: 'night_watchman.acts',
    applies: a => isW(a),
    check(pre, events, post, ctx) {
      const w = ctx.actor, b = ctx.before, m = post.dept, you = post.actors[0];
      const mine = events.filter(e => (e.k === 'moved' && e.who === w.uid) || (e.k === 'opened' && e.who === w.uid) || (e.k === 'attacked' && e.by === w.uid));
      // It comes in at a turn boundary, so the instant it came in is that turn's first tick.
      const came = events.find(e => e.k === 'entered' && e.who === w.uid);
      const arrived = came ? came.tick : w.woke && w.woke.cause && w.woke.cause.k === 'night_watch' ? w.woke.turn * N.TICKS_PER_TURN : null;
      if (arrived !== null) for (const e of mine) if (e.tick === arrived) return `${w.uid} acted (${e.k}) at tick ${e.tick}, the instant it came in`;
      if (!mine.length && !b) return null;
      // Your tile is the same through every exhibit's action in a step (yours comes first),
      // and nothing an exhibit does changes where anyone may walk, so the post map serves.
      const toYou = walkFrom(m, you.x, you.y, 'exhibit');
      const dist = (x, y) => at(toYou, m, x, y);
      let pos = b ? [b.x, b.y] : came ? came.at.slice() : [w.x, w.y];
      for (const e of mine) {
        const reach = dist(pos[0], pos[1]) >= 0;
        const goal = reach ? null : goalFor(m, pos[0], pos[1], you), toGoal = goal ? walkFrom(m, goal[0], goal[1], 'exhibit') : null;
        const near = (x, y) => reach ? dist(x, y) : at(toGoal, m, x, y);
        if (e.k === 'attacked') {
          if (e.at !== 'you') return `${w.uid} struck ${e.at}, not you`;
          if (Math.max(Math.abs(pos[0] - you.x), Math.abs(pos[1] - you.y)) !== 1) return `${w.uid} struck you from ${pos}, not from beside you`;
        } else if (e.k === 'moved') {
          if (e.from[0] !== pos[0] || e.from[1] !== pos[1]) return `${w.uid} stepped from ${e.from}, but stood at ${pos}`;
          if (!(near(e.to[0], e.to[1]) >= 0 && near(e.to[0], e.to[1]) < near(pos[0], pos[1]))) {
            return `${w.uid} stepped from ${e.from} (${near(pos[0], pos[1])}) to ${e.to} (${near(e.to[0], e.to[1])}), not closer to ${reach ? 'you' : 'the tile nearest you it can reach, ' + goal}`;
          }
          pos = e.to.slice();
        } else if (!(near(e.x, e.y) >= 0 && near(e.x, e.y) < near(pos[0], pos[1]))) {
          return `${w.uid} opened the door at ${e.x},${e.y}, which is not on its way to ${reach ? 'you' : goal}`;
        }
      }
      // A wait: only when no step strictly closer was free. Checked where it is sure: the
      // Watchman acted in this step without moving, was not fixed, and a closer tile was free
      // of every actor before and after the step with nothing stepping onto it during it.
      if (!b || w.gone || pre.over || mine.length || w.acts <= b.acts) return null;
      const fixed = a => (a.statuses || []).some(s => s.id === 'fixed');
      if (fixed(b) || fixed(w) || events.some(e => e.k === 'status' && e.who === w.uid)) return null;
      const here = dist(w.x, w.y), reach = here >= 0;
      if (reach && here === 1) return `${w.uid} waited beside you at ${w.x},${w.y} instead of striking`;
      if (reach && here < 1) return null;
      const goal = reach ? null : goalFor(m, w.x, w.y, you), toGoal = goal ? walkFrom(m, goal[0], goal[1], 'exhibit') : null;
      const near = (x, y) => reach ? dist(x, y) : at(toGoal, m, x, y);
      const h = near(w.x, w.y);
      if (h <= 0) return null;
      const occupied = (s, x, y) => s.actors.some(a => !a.gone && C.Actors.covers(a, x, y));
      const trodden = (x, y) => events.some(e => e.k === 'moved' && e.to[0] === x && e.to[1] === y) || events.some(e => e.k === 'entered' && e.at[0] === x && e.at[1] === y);
      for (let d = 0; d < 8; d++) {
        if (!C.Grid.canStep(m, w.x, w.y, d, 'exhibit')) continue;
        const x = w.x + C.Grid.DX[d], y = w.y + C.Grid.DY[d], v = near(x, y);
        if (v >= 0 && v < h && !occupied(pre, x, y) && !occupied(post, x, y) && !trodden(x, y)) return `${w.uid} waited at ${w.x},${w.y} though the step to ${x},${y} was free and closer`;
      }
      return null;
    },
  };

  const back = {
    id: 'night_watchman.return',
    check(pre, events, post) {
      const c0 = pre.dept && pre.dept.clock, c1 = post.dept && post.dept.clock;
      if (!c0 || !c1 || c0.pausedSince !== null || c1.pausedSince !== null) return null;
      const countAt = e => c0.count + (e.turn - pre.turn);
      let due = c0.watch.back;
      for (const e of events) {
        if (e.k === 'died') {
          const a = post.actors.find(x => x.uid === e.who);
          if (isW(a)) due = countAt(e) + N.WATCHMAN_RETURN;
        } else if (e.k === 'entered' && e.cause && e.cause.k === 'night_watch') {
          if (e.cause.count !== countAt(e)) return `a Night Watchman came in at count ${e.cause.count}, but the clock stood at ${countAt(e)}`;
          if (e.cause.n === 1) {
            if (countAt(e) < c1.B + c1.G) return `the first Night Watchman came in at count ${countAt(e)}, before the night watch at ${c1.B + c1.G}`;
          } else if (due === null || countAt(e) !== due) {
            return `Night Watchman ${e.cause.n} came in at count ${countAt(e)}, not ${N.WATCHMAN_RETURN} counts after the last one fell (${due === null ? 'none had fallen' : 'due at ' + due})`;
          }
          due = null;
        }
      }
      return c1.watch.back !== due ? `the next Night Watchman is due at ${c1.watch.back}, not at ${due}` : null;
    },
  };

  return [one, hunts, acts, back];
};
