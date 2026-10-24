// The Night Watchman's clause and the clock's rules about it, as invariants checked after
// every step (BUILD.md §5.3, check 1; §8.4). Each is written from the rule's sentence, not
// from the rule's code:
//   night_watchman.one          at most one Night Watchman is in the department at a time;
//   night_watchman.hunts        a Night Watchman that came in with the night watch is always
//                               hunting: never asleep, awake, searching, going back or
//                               reinstalling;
//   night_watchman.unsurprised  no blow at a Night Watchman that came in with the night watch
//                               is a surprise blow;
//   night_watchman.acts         each of its own actions is a blow at you from beside you, or a
//                               step (or a door opened) strictly closer to you by an exhibit's
//                               walking distance, or, when no walk reaches you, strictly closer
//                               to the tile it can reach that is nearest you; it waits only when
//                               no such step is free; it never acts in the instant it comes in.
//                               A move another rule makes it take (a Window Pole's push, whose
//                               moved event has a cause) is not its own step;
//   night_watchman.return       a new one comes in exactly WATCHMAN_RETURN clock counts after
//                               the last one fell, and the first only once the night watch has
//                               begun;
//   clock.leave                 you leave only by standing on exit door i and choosing leave(i),
//                               which takes no time, ends the visit as left by that door, and is
//                               the step's last event; a leave is refused as no_exit when there
//                               is no door i and as not_on_exit when you are not on it, and a
//                               refused leave changes nothing.
// "Came in with the night watch": its story starts with the night watch (woke.cause.k is
// night_watch), as ClockRules.spawnWatchman makes every Watchman. A scenario elsewhere may
// place the shared species as an ordinary exhibit (asleep, or awake as its trigger makes it);
// such a one is not the night watch's, and only .one and .acts speak about it.
'use strict';
module.exports = (C) => {
  const { N } = C;
  const json = JSON.stringify;
  const isW = a => !!a && a.arch === 'night_watchman';
  const ofTheWatch = a => isW(a) && !!a.woke && !!a.woke.cause && a.woke.cause.k === 'night_watch';

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
    applies: a => ofTheWatch(a) && !a.gone,
    check(pre, events, post, ctx) {
      return ctx.actor.mode !== 'hunting' ? `${ctx.uid} is ${ctx.actor.mode}; a Night Watchman always comes for you` : null;
    },
  };

  const unsurprised = {
    id: 'night_watchman.unsurprised',
    check(pre, events, post) {
      for (const e of events) {
        if (e.k !== 'damaged' || !e.cause || !e.cause.surprise) continue;
        const a = post.actors.find(x => x.uid === e.who);
        if (ofTheWatch(a)) return `${e.who} was caught by surprise by ${e.cause.by}'s blow`;
      }
      return null;
    },
  };

  const acts = {
    id: 'night_watchman.acts',
    applies: a => isW(a),
    check(pre, events, post, ctx) {
      const w = ctx.actor, b = ctx.before, m = post.dept, you = post.actors[0];
      // Its own actions: a step (moved with no cause, as a step is told), a door it opened, a
      // blow. A move with a cause is one another rule made it take (a push): it changes where
      // it stands, and is not judged as its step.
      const pushed = e => e.k === 'moved' && e.who === w.uid && !!e.cause;
      const own = e => (e.k === 'moved' && e.who === w.uid && !e.cause) || (e.k === 'opened' && e.who === w.uid) || (e.k === 'attacked' && e.by === w.uid);
      const mine = events.filter(own), moves = events.filter(e => own(e) || pushed(e));
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
      for (const e of moves) {
        if (pushed(e)) { pos = e.to.slice(); continue; }
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

  const leave = {
    id: 'clock.leave',
    check(pre, events, post, ctx) {
      const ex = (pre.dept && pre.dept.exits) || [], you = pre.actors[0], act = ctx.action || {};
      const left = events.filter(e => e.k === 'left');
      if (left.length > 1) return `you left ${left.length} times in one step`;
      if (left.length) {
        const e = left[0], d = ex[e.door];
        if (act.a !== 'leave' || act.i !== e.door) return `you left by exit door ${e.door} on the action ${json(act)}`;
        if (!d || d[0] !== you.x || d[1] !== you.y) return `you left by exit door ${e.door} from ${you.x},${you.y}, not standing on it`;
        if (events[events.length - 1] !== e) return `something happened after you left: ${json(events.slice(events.indexOf(e) + 1).map(x => x.k))}`;
        if (post.tick !== pre.tick || post.turn !== pre.turn || post.actors[0].next !== pre.actors[0].next) {
          return `leaving took time: tick ${pre.tick} to ${post.tick}, your next decision ${pre.actors[0].next} to ${post.actors[0].next}`;
        }
        const o = post.over;
        if (!o || o.k !== 'left' || o.door !== e.door || o.turn !== e.turn || o.by !== null) return `the visit's end ${json(o)} is not leaving by exit door ${e.door}`;
        return null;
      }
      if (!pre.over && post.over && post.over.k === 'left') return `the visit ended as left with no left event: ${json(post.over)}`;
      const refused = events.length === 1 && events[0].k === 'refused' ? events[0].reason : null;
      if (act.a === 'leave' && (refused === 'no_exit' || refused === 'not_on_exit')) {
        const door = Number.isInteger(act.i) && act.i >= 0 && act.i < ex.length ? ex[act.i] : null;
        if ((refused === 'no_exit') !== (door === null)) return `leave(${json(act.i)}) was refused as ${refused}, with ${ex.length} exit door(s)`;
        if (door && door[0] === you.x && door[1] === you.y) return `leave(${act.i}) was refused as ${refused}, though you stand on that exit door`;
        if (C.State.hash(pre) !== C.State.hash(post)) return `a refused leave (${refused}) changed the state`;
      }
      return null;
    },
  };

  return [one, hunts, unsurprised, acts, back, leave];
};
