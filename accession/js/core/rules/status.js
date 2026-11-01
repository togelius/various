// ACCESSION — statuses on actors (BUILD.md §8.1, §8.6), owned by W1-STATUS after M3's Wave 0.
// A status is { id, until, turns, from, perm? } on actor.statuses, in the order applied.
//
// The timing rule (§8.1): a status of N turns covers the N turns that start at its bearer's
// next decision. It is applied with until and from null and its N in `turns`; once the action
// that applied it is over and every `next` is final, Status.settle sets from = start and
// until = start + N, where start is idiv(next, TICKS_PER_TURN) for a scheduled actor (the
// turn its next decision falls in, since turn k's boundary runs before anyone who acts at
// tick 100k) and the next turn for a sleeping one. Its per-turn effect runs at the boundaries
// of turns from … until − 1, and it ends at the boundary of turn until. Applied again while
// held, it lasts to the later of the two ends, from the same start.
// M4 (plan A6): a cheaper action (Duck and Cover's) can leave your next decision mid-turn
// after that turn's boundary has run. Coughing and restoring, whose only rule is their
// per-turn effect, put on you then (a Fumigant or a Consolidant drunk), count their N turns
// from the next turn, start + 1, so each of them still has its boundary and nothing is lost:
// the same ticks as the action at its full cost gives. Every other status keeps its start
// (Fixative's forced waits are counted from your next decision), and a status that comes
// with its own rule for this keeps it (M4's second_wind, reg/perk-status.js).
//
// At a boundary the timers run at step 2 (Status.tick: expiry), and the per-turn effects
// after the wake checks of step 4 (Status.effects), so that a cough's noise comes after your
// ring, as an action's noise comes after its other wake effects (§8.2).
//
// A status lasting for the rest of the visit (M4 plan A3, D1.4) is applied with turns 'perm':
// its record carries perm: true and never an until, so no boundary ends it, and it ends only
// when the visit does, on leaving. Its event says turns null. A record carries perm only then.
//
// Each status's rule is given once with Status.define(id, {effect, blocks, skipsAction}) by
// the file that owns it (M4 plan A16.3), M3's below: effect(state, a, status, ev), its
// per-turn effect (Status.EFFECTS); blocks(state, a, action) → a refusal code or null, what it
// forbids you (Status.blocks); skipsAction, true when its bearer only waits (Status.skips).
// A status Archetypes.immune says an actor is immune to is not put on it (Status.apply).
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

  // The rules Status.define gives, by status id, in the order defined: per-turn effects,
  // run at boundary step 4 after the wake checks for every status held whose first turn has
  // come (EFFECTS[id](state, a, status, ev)); what a status forbids you (BLOCKS[id](state, a,
  // action) → code | null), asked in the order defined; and the statuses whose bearer only
  // waits (SKIPS).
  const EFFECTS = {}, BLOCKS = {}, SKIPS = [], DEFINED = [];
  const RULE = ['effect', 'blocks', 'skipsAction'];

  // Status.define(id, {effect, blocks, skipsAction}): status id's rule, given once, by the file
  // that owns it, after its registry entry. Each part may be left out.
  function define(id, rule) {
    if (!own(Registry.STATUSES, id)) throw new Error(`Status.define: ${id} is not in Registry.STATUSES`);
    if (DEFINED.includes(id)) throw new Error(`Status.define: ${id} is defined twice`);
    if (rule === null || typeof rule !== 'object') throw new Error(`Status.define: ${id}'s rule is not a record`);
    for (const k of Object.keys(rule)) if (!RULE.includes(k)) throw new Error(`Status.define: ${id}'s rule has the unknown part ${k} (${RULE.join(', ')})`);
    for (const k of ['effect', 'blocks']) if (rule[k] !== undefined && typeof rule[k] !== 'function') throw new Error(`Status.define: ${id}'s ${k} is not a function`);
    if (rule.skipsAction !== undefined && typeof rule.skipsAction !== 'boolean') throw new Error(`Status.define: ${id}'s skipsAction is not true or false`);
    DEFINED.push(id);
    if (rule.effect) EFFECTS[id] = rule.effect;
    if (rule.blocks) BLOCKS[id] = rule.blocks;
    if (rule.skipsAction) SKIPS.push(id);
  }
  const defined = () => DEFINED.slice();

  // Put status id on a for `turns` turns (a whole number, at least 1), or for the rest of the
  // visit ('perm'), with its cause; emits status {who, id, on: true, turns} (turns null for
  // 'perm'). An actor its archetype or a modifier makes immune to it (Archetypes.immune) is
  // left as it is, with no event, and false is returned; otherwise true. A status already
  // held lasts to the later end, and for good once either is 'perm'. A pending special of an
  // exhibit made fixed is called off at once (§8.1), inside the action that fixed it, so the
  // mark is neither shown nor held against other marks once it cannot resolve.
  function apply(state, a, id, turns, cause, ev) {
    if (!own(Registry.STATUSES, id)) throw new Error(`Status.apply: there is no status ${id}`);
    const forGood = turns === 'perm';
    if (!forGood && (!Number.isInteger(turns) || turns < 1)) throw new Error(`Status.apply: ${id} for ${turns} turns`);
    if (Archetypes.immune(state, a, id)) return false;
    if (!a.statuses) a.statuses = [];
    const s = find(a, id);
    if (forGood) {
      if (s) { s.perm = true; s.until = null; s.turns = null; } else a.statuses.push({ id, until: null, turns: null, from: null, perm: true });
    } else if (s) { if (!s.perm) s.turns = s.turns === null || s.turns === undefined ? turns : Math.max(s.turns, turns); }
    else a.statuses.push({ id, until: null, turns, from: null });
    Causes.emit(state, ev, 'status', { who: a.uid, id, on: true, turns: forGood ? null : turns }, cause);
    if (id === 'fixed' && a.telegraph) Specials.cancel(state, a, 'fixed', ev);
    return true;
  }

  // Give every newly applied status its end turn (see the timing rule above), and a status
  // for the rest of the visit its first turn only. step() calls it after each of your
  // actions, and after each exhibit's.
  const LATE_NEXT = ['coughing', 'restoring'];
  function settle(state) {
    for (const a of state.actors) {
      if (!a.statuses || !a.statuses.length) continue;
      for (const s of a.statuses) {
        const fresh = s.perm ? s.from === null || s.from === undefined : s.turns !== null && s.turns !== undefined;
        if (!fresh) continue;
        let start = Actors.scheduled(a) ? Int.idiv(a.next, N.TICKS_PER_TURN) : state.turn + 1;
        if (s.perm) { s.from = start; continue; }
        if (start <= state.turn && LATE_NEXT.includes(s.id)) start++;
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
  // while it is still being applied; 0 if a does not hold it; null for one that lasts for the
  // rest of the visit (Status.perm), which a label shows as "until you leave". For labels
  // and the view model.
  function left(state, a, id) {
    const s = find(a, id);
    if (!s) return 0;
    if (s.perm) return null;
    if (s.until === null || s.until === undefined) return s.turns || 0;
    const from = s.from === null || s.from === undefined ? state.turn : Math.max(s.from, state.turn);
    return Math.max(0, s.until - from);
  }

  // Does a status last for the rest of the visit?
  const perm = (a, id) => { const s = find(a, id); return !!(s && s.perm); };

  // What a status forbids you to do (§4.2), as a refusal code, before anything is spent: each
  // status you hold that has a blocks rule is asked, in the order the rules were defined (so
  // fixed before rooted), and the first code is the answer.
  function blocks(state, a, action) {
    if (!action || typeof action.a !== 'string' || !a.statuses || !a.statuses.length) return null;
    for (const id of DEFINED) {
      if (!own(BLOCKS, id) || !has(a, id)) continue;
      const code = BLOCKS[id](state, a, action);
      if (code) return code;
    }
    return null;
  }

  // Does a hold a status whose bearer only waits (skipsAction: fixed)?
  const skips = (state, a) => !!(a.statuses && a.statuses.length && SKIPS.some(id => has(a, id)));

  // M3's statuses (BUILD.md §8.1, §8.6), defined here, where their rules have always lived.
  // fixed allows you only wait and rest (and the answer to a choice already waiting, which is
  // part of the action that asked it), and an exhibit only waits (AI.act).
  const WHILE_FIXED = ['wait', 'rest', 'choose'];
  define('fixed', { blocks: (state, a, action) => WHILE_FIXED.includes(action.a) ? null : 'fixed', skipsAction: true });
  // rooted refuses a move that would change your tile, and allows a bump into a door, an
  // actor or an intact case, which leaves you where you are. So a bump into a case is refused
  // as glass whether you are rooted or not, exactly as a bump into a mimic in its disguise is
  // (§8.3).
  define('rooted', {
    blocks(state, a, action) {
      if (action.a !== 'move' || !Number.isInteger(action.dir) || action.dir < 0 || action.dir >= 8) return null;
      const m = state.dept, size = a.size || 1, nx = a.x + Grid.DX[action.dir], ny = a.y + Grid.DY[action.dir];
      for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
        const x = nx + dx, y = ny + dy;
        if (Actors.at(state, x, y, a) || Grid.closedDoor(m, x, y) || Grid.ch(m, x, y) === 'v') return null;
      }
      return 'rooted';
    },
  });
  // A soft noise at the bearer's tile, made by the bearer (so a cough of yours is your noise).
  define('coughing', { effect: (state, a, s, ev) => Noise.emit(state, a.x, a.y, 'soft', { k: 'cough', by: a.uid }, ev) });
  // This turn's share of healing, never past the bearer's maximum health; nothing to heal,
  // nothing happens.
  define('restoring', {
    effect(state, a, s, ev) {
      const k = s.from === null || s.from === undefined ? 0 : state.turn - s.from;
      const n = Math.min(restoreShare(a.maxHp, k), a.maxHp - a.hp);
      if (n > 0) Health.heal(state, a, n, { k: 'status', id: 'restoring' }, ev);
    },
  });
  // slowed (Actors.cost) and dazed (Combat.hitChance) change a number where it is worked out.
  define('slowed', {});
  define('dazed', {});

  return { has, harmful, EFFECTS, restoreShare, apply, settle, tick, effects, left, perm, blocks, skips, define, defined };
})();
