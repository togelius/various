// ACCESSION — statuses on actors (BUILD.md §8.1, §8.6), owned by W1-STATUS after M3's Wave 0.
// A status is { id, until, turns, from } on actor.statuses, in the order applied.
//
// The timing rule (§8.1): a status of N turns covers the N turns that start at its bearer's
// next decision. It is applied with until and from null and its N in `turns`; once the action
// that applied it is over and every `next` is final, Status.settle sets from = start and
// until = start + N, where start is idiv(next, TICKS_PER_TURN) for a scheduled actor (the
// turn its next decision falls in, since turn k's boundary runs before anyone who acts at
// tick 100k) and the next turn for a sleeping one. Its per-turn effect runs at the boundaries
// of turns from … until − 1, and it ends at the boundary of turn until. Applied again while
// held, it lasts to the later of the two ends, from the same start.
//
// At a boundary the timers run at step 2 (Status.tick: expiry), and the per-turn effects
// after the wake checks of step 4 (Status.effects), so that a cough's noise comes after your
// ring, as an action's noise comes after its other wake effects (§8.2).
//
// What each status does (Registry.STATUSES gives its clause):
//   fixed      cannot move or act: you may only wait or rest (Status.blocks); an exhibit only
//              waits (AI.act); blows against it have +HIT_FIXED_TARGET (Combat.hitChance);
//   rooted     you cannot move off your tile (Status.blocks); a bump into a door, an actor or
//              a case, which leaves you where you are, is still allowed;
//   coughing   a soft noise at the bearer's tile each turn (EFFECTS.coughing);
//   restoring  heals its share each turn, CONSOLIDANT_HOT_PCT% of maximum health in all over
//              CONSOLIDANT_HOT_TURNS turns (EFFECTS.restoring, Health.heal);
//   slowed     every action takes SPEED_SLOW_PCT% of its time (Actors.cost);
//   dazed      the bearer's blows have HIT_DAZED_ATTACKER to hit (Combat.hitChance).
'use strict';
const Status = (() => {
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const has = (a, id) => !!(a.statuses && a.statuses.some(s => s.id === id));
  const harmful = id => !!(own(Registry.STATUSES, id) && Registry.STATUSES[id].harmful);
  const find = (a, id) => { for (const s of a.statuses || []) if (s.id === id) return s; return null; };

  // Restoring's share of healing at the k-th turn of its course (k from 0): a course of
  // CONSOLIDANT_HOT_TURNS turns heals CONSOLIDANT_HOT_PCT% of maximum health in all (rounded
  // down), spread so that each turn heals within 1 of every other and every run of that many
  // turns adds up to exactly the total. A status put on again while held lasts longer, and
  // heals at the same rate for every turn it lasts.
  function restoreShare(maxHp, k) {
    const total = Int.pct(maxHp, N.CONSOLIDANT_HOT_PCT), T = N.CONSOLIDANT_HOT_TURNS, i = k % T;
    return Int.idiv(total * (i + 1), T) - Int.idiv(total * i, T);
  }

  // Per-turn effects by status id, run at boundary step 4 after the wake checks, for every
  // status held whose first turn has come: EFFECTS[id](state, a, status, ev).
  const EFFECTS = {
    // A soft noise at the bearer's tile, made by the bearer (so a cough of yours is your noise).
    coughing(state, a, s, ev) {
      Noise.emit(state, a.x, a.y, 'soft', { k: 'cough', by: a.uid }, ev);
    },
    // This turn's share of healing, never past the bearer's maximum health; nothing to heal,
    // nothing happens.
    restoring(state, a, s, ev) {
      const k = s.from === null || s.from === undefined ? 0 : state.turn - s.from;
      const n = Math.min(restoreShare(a.maxHp, k), a.maxHp - a.hp);
      if (n > 0) Health.heal(state, a, n, { k: 'status', id: 'restoring' }, ev);
    },
  };

  // Put status id on a for `turns` turns (a whole number, at least 1), with its cause; emits
  // status {who, id, on: true, turns}. A pending special of an exhibit made fixed is called
  // off at once (§8.1), inside the action that fixed it, so the mark is neither shown nor
  // held against other marks once it cannot resolve.
  function apply(state, a, id, turns, cause, ev) {
    if (!own(Registry.STATUSES, id)) throw new Error(`Status.apply: there is no status ${id}`);
    if (!Number.isInteger(turns) || turns < 1) throw new Error(`Status.apply: ${id} for ${turns} turns`);
    if (!a.statuses) a.statuses = [];
    const s = find(a, id);
    if (s) s.turns = s.turns === null || s.turns === undefined ? turns : Math.max(s.turns, turns);
    else a.statuses.push({ id, until: null, turns, from: null });
    Causes.emit(state, ev, 'status', { who: a.uid, id, on: true, turns }, cause);
    if (id === 'fixed' && a.telegraph) Specials.cancel(state, a, 'fixed', ev);
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

  // Turn boundary step 2 (§8.1): expire every status whose until ≤ turn (status
  // {on: false}); actors in spawn order, statuses in the order applied.
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
  }

  // After boundary step 4's wake checks (§8.1): the per-turn effects of the statuses held
  // whose first turn has come, actors in spawn order, statuses in the order applied.
  function effects(state, ev) {
    for (const a of state.actors) {
      if (a.gone || !a.statuses) continue;
      for (const s of a.statuses.slice()) {
        if (!own(EFFECTS, s.id) || !a.statuses.includes(s)) continue;
        if (s.from === null || s.from === undefined || state.turn >= s.from) EFFECTS[s.id](state, a, s, ev);
      }
    }
  }

  // How many turns a status still covers, this one included: until − the current turn once it
  // has begun, its whole length before (a sleeping exhibit's starts at the next turn), its N
  // while it is still being applied; 0 if a does not hold it. For labels and the view model.
  function left(state, a, id) {
    const s = find(a, id);
    if (!s) return 0;
    if (s.until === null || s.until === undefined) return s.turns || 0;
    const from = s.from === null || s.from === undefined ? state.turn : Math.max(s.from, state.turn);
    return Math.max(0, s.until - from);
  }

  // What a status forbids you to do (§4.2), as a refusal code, before anything is spent:
  // fixed allows only wait and rest (and the answer to a choice already waiting, which is
  // part of the action that asked it); rooted refuses a move that would change your tile,
  // and allows a bump into a door, an actor or an intact case, which leaves you where you
  // are. So a bump into a case is refused as glass whether you are rooted or not, exactly
  // as a bump into a mimic in its disguise is (§8.3).
  const WHILE_FIXED = ['wait', 'rest', 'choose'];
  function blocks(state, a, action) {
    if (!action || typeof action.a !== 'string') return null;
    if (has(a, 'fixed') && !WHILE_FIXED.includes(action.a)) return 'fixed';
    if (has(a, 'rooted') && action.a === 'move' && Number.isInteger(action.dir) && action.dir >= 0 && action.dir < 8) {
      const m = state.dept, size = a.size || 1, nx = a.x + Grid.DX[action.dir], ny = a.y + Grid.DY[action.dir];
      for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
        const x = nx + dx, y = ny + dy;
        if (Actors.at(state, x, y, a) || Grid.closedDoor(m, x, y) || Grid.ch(m, x, y) === 'v') return null;
      }
      return 'rooted';
    }
    return null;
  }

  return { has, harmful, EFFECTS, restoreShare, apply, settle, tick, effects, left, blocks };
})();
