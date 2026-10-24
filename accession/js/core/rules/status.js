// ACCESSION — statuses on actors (BUILD.md §8.1, §8.6), frozen in shape after M3's Wave 0;
// W1-STATUS fills EFFECTS. A status is { id, until, turns, from } on actor.statuses, in the
// order applied.
//
// The timing rule (§8.1): a status of N turns covers the N turns that start at its bearer's
// next decision. It is applied with until and from null and its N in `turns`; once the action
// that applied it is over and every `next` is final, Status.settle sets from = start and
// until = start + N, where start is idiv(next, TICKS_PER_TURN) for a scheduled actor (the
// turn its next decision falls in, since turn k's boundary runs before anyone who acts at
// tick 100k) and the next turn for a sleeping one. Its per-turn effect runs at the boundaries
// of turns from … until − 1, and it ends at the boundary of turn until. Applied again while
// held, it lasts to the later of the two ends.
'use strict';
const Status = (() => {
  const has = (a, id) => !!(a.statuses && a.statuses.some(s => s.id === id));
  const harmful = id => !!(Registry.STATUSES[id] && Registry.STATUSES[id].harmful);

  // Per-turn effects by status id, run at boundary step 2 for every status still held after
  // expiry: EFFECTS[id](state, a, status, ev). W1-STATUS fills it (coughing, restoring).
  const EFFECTS = {};

  // Put status id on a for `turns` turns, with its cause; emits status {on: true}.
  function apply(state, a, id, turns, cause, ev) {
    if (!a.statuses) a.statuses = [];
    const s = a.statuses.find(s => s.id === id);
    if (s) s.turns = s.turns === null || s.turns === undefined ? turns : Math.max(s.turns, turns);
    else a.statuses.push({ id, until: null, turns, from: null });
    Causes.emit(state, ev, 'status', { who: a.uid, id, on: true }, cause);
  }

  // Give every newly applied status its end turn (see the timing rule above). step() calls
  // it after each of your actions, and after each exhibit's.
  function settle(state) {
    for (const a of state.actors) {
      if (!a.statuses || !a.statuses.length) continue;
      for (const s of a.statuses) {
        if (s.turns === null || s.turns === undefined) continue;
        const start = Actors.scheduled(a) ? Int.idiv(a.next, N.TICKS_PER_TURN) : state.turn + 1;
        const until = start + s.turns;
        if (s.until === null) { s.until = until; s.from = start; } else s.until = Math.max(s.until, until);
        s.turns = null;
      }
    }
  }

  // Turn boundary step 2 (§8.1): first expire every status whose until ≤ turn (status
  // {on: false}), then run the per-turn effects of those left whose first turn has come;
  // actors in spawn order, statuses in the order applied.
  function tick(state, ev) {
    for (const a of state.actors) {
      if (a.gone || !a.statuses || !a.statuses.length) continue;
      const keep = [];
      for (const s of a.statuses) {
        if (s.until !== null && s.until <= state.turn) Causes.emit(state, ev, 'status', { who: a.uid, id: s.id, on: false, until: s.until }, { k: 'status', id: s.id });
        else keep.push(s);
      }
      a.statuses = keep;
    }
    for (const a of state.actors) {
      if (a.gone || !a.statuses) continue;
      for (const s of a.statuses.slice()) {
        if (!Object.prototype.hasOwnProperty.call(EFFECTS, s.id) || !a.statuses.includes(s)) continue;
        if (s.from === null || s.from === undefined || state.turn >= s.from) EFFECTS[s.id](state, a, s, ev);
      }
    }
  }

  // What a status forbids you to do (§4.2), as a refusal code, before anything is spent:
  // fixed allows only wait and rest (and the answer to a choice already waiting, which is
  // part of the action that asked it); rooted refuses a move that would change your tile,
  // and allows a bump into a door or an actor, which leaves you where you are.
  const WHILE_FIXED = ['wait', 'rest', 'choose'];
  function blocks(state, a, action) {
    if (!action || typeof action.a !== 'string') return null;
    if (has(a, 'fixed') && !WHILE_FIXED.includes(action.a)) return 'fixed';
    if (has(a, 'rooted') && action.a === 'move' && Number.isInteger(action.dir) && action.dir >= 0 && action.dir < 8) {
      const m = state.dept, size = a.size || 1, nx = a.x + Grid.DX[action.dir], ny = a.y + Grid.DY[action.dir];
      for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
        if (Actors.at(state, nx + dx, ny + dy, a) || Grid.closedDoor(m, nx + dx, ny + dy)) return null;
      }
      return 'rooted';
    }
    return null;
  }

  return { has, harmful, EFFECTS, apply, settle, tick, blocks };
})();
