// ACCESSION — the invariants of statuses and surfaces (BUILD.md §8.1, §8.6), held after every
// step of every scenario, monkey, soak and bot run (tools/invariants.js). Each is what one of
// the rules in js/core/rules/status.js or surfaces.js promises, read back from the state
// before and after the step and the step's events, never from the rule code:
//   status_timing       a status of N turns covers exactly N turns from its bearer's next
//                       decision: put on for N, it holds turns from … from + N − 1, its start
//                       is the turn of your next decision, it ends (with a status event) at the
//                       boundary of its last turn, put on again it keeps its start and lasts to
//                       the later end, and nothing else changes it;
//   fixed_only_waits    a fixed actor only waits: you only wait, rest or answer a choice, and an
//                       exhibit fixed for the whole step makes no step, blow, mark or door;
//   rooted_never_steps  a rooted you never steps off your tile: a move is a bump or nothing;
//   coughing_noise      a cough is one soft noise a turn, at your tile, while coughing;
//   restoring_share     restoring heals at most its share a turn, never past full health;
//   fumigant_pips       a Fumigant cloud takes exactly one pip a turn from a sleeper inside;
//   surface_timing      a surface lies until its last turn and is cleared then, unchanged;
//   los_symmetric       with surfaces on the map, line of sight is the same both ways.
'use strict';
module.exports = (C) => {
  const { N, Int, Grid } = C;
  // What a fixed you may still do (§4.2): wait, rest, and answer a choice already waiting.
  const WHILE_FIXED = ['wait', 'rest', 'choose'];
  const has = (a, id) => !!(a && a.statuses && a.statuses.some(s => s.id === id));
  const find = (a, id) => { for (const s of (a && a.statuses) || []) if (s.id === id) return s; return null; };
  const isInt = Number.isInteger;
  const refused = events => events.length === 1 && events[0].k === 'refused';
  const turnOf = tick => Int.idiv(tick, N.TICKS_PER_TURN);
  const actorIn = (state, uid) => { for (const a of state.actors) if (a.uid === uid) return a; return null; };

  // The turns a status record covers, for messages.
  const span = s => `turns ${s.from}–${s.until - 1}`;

  const timing = {
    id: 'status_timing',
    applies: () => true,
    check(pre, events, post, ctx) {
      const a = ctx.actor, b = ctx.before;
      const mine = events.filter(e => e.k === 'status' && e.who === a.uid);
      const held = a.statuses || [], had = b ? b.statuses || [] : [];
      if (!mine.length && !held.length && !had.length) return null;
      // Every status is settled by the end of every step: its end turn known, after its start.
      for (const s of held) {
        if (!isInt(s.until) || (s.turns !== null && s.turns !== undefined)) return `${s.id} is not settled at the end of the step (until ${s.until}, turns ${s.turns})`;
        if (isInt(s.from) && s.until <= s.from) return `${s.id} ends at turn ${s.until}, not after its start ${s.from}`;
      }
      // An actor made during the step starts with what it was made with.
      if (!b) return null;
      const ids = [];
      for (const s of held.concat(had)) if (!ids.includes(s.id)) ids.push(s.id);
      for (const e of mine) if (!ids.includes(e.id)) ids.push(e.id);
      const you = a.uid === 'you', decision = turnOf(a.next);
      for (const id of ids) {
        const now = find(a, id), was = find(b, id);
        let holding = !!was, fresh = !was, ons = 0, most = 0;
        for (const e of mine) {
          if (e.id !== id) continue;
          if (e.on) {
            if (!isInt(e.turns) || e.turns < 1) return `${id} was put on for ${e.turns} turns`;
            if (!holding) { fresh = true; ons = 0; most = 0; }
            holding = true; ons++; most = Math.max(most, e.turns);
          } else {
            if (!holding) return `${id} ended while it was not held`;
            holding = false;
            // Ended by its timer: at the boundary of the turn after its last.
            if (e.cause && e.cause.k === 'status' && e.until !== e.turn) return `${id} ran out at turn ${e.turn}, but its last turn was ${e.until - 1}`;
          }
        }
        if (holding && !now) return `${id} is gone with no status event to say so`;
        if (!holding && now) return `${id} is held with no status event putting it on`;
        if (!now) continue;
        // One put on by hand before the step and not yet settled has nothing to compare with.
        if (was && !isInt(was.until)) continue;
        if (fresh) {
          if (ons === 1 && now.until - now.from !== most) return `${id}, put on for ${most} turns, covers ${span(now)}`;
          if (now.until - now.from < most) return `${id}, put on for ${most} turns, covers only ${span(now)}`;
          // It starts at the turn of its bearer's next decision: yours is where this step ends;
          // an exhibit's is no earlier than this step and no later than its own next.
          if (you && now.from !== decision) return `${id} starts at turn ${now.from}, not at the turn of your next decision, ${decision}`;
          if (!you && (now.from < pre.turn || now.from > Math.max(decision, post.turn + 1))) return `${id} starts at turn ${now.from}, outside turns ${pre.turn}–${Math.max(decision, post.turn + 1)}`;
        } else {
          if (now.from !== was.from) return `${id} moved its start from turn ${was.from} to ${now.from}`;
          if (now.until < was.until) return `${id} was cut short from turn ${was.until} to ${now.until}`;
          if (!ons && now.until !== was.until) return `${id} changed its end from turn ${was.until} to ${now.until} with no status event`;
          if (ons && you && now.until !== Math.max(was.until, decision + most)) return `${id}, put on again for ${most} turns at your decision in turn ${decision}, ends at ${now.until}, not ${Math.max(was.until, decision + most)}`;
        }
      }
      // At your decision every status you hold is in force: its start has come, its end has not.
      if (you && !post.over) for (const s of held) if ((isInt(s.from) && s.from > post.turn) || s.until <= post.turn) return `you hold ${s.id} (${span(s)}) at your decision in turn ${post.turn}`;
      return null;
    },
  };

  const fixed = {
    id: 'fixed_only_waits',
    applies: () => true,
    check(pre, events, post, ctx) {
      const a = ctx.actor, b = ctx.before;
      if (!b || !has(b, 'fixed')) return null;
      if (a.uid === 'you') {
        if (refused(events)) return null;
        const what = ctx.action && ctx.action.a;
        return WHILE_FIXED.includes(what) ? null : `you were fixed and did ${JSON.stringify(ctx.action)}`;
      }
      // An exhibit fixed for the whole step: held before and after, from the same start, not ended between.
      const s0 = find(b, 'fixed'), s1 = find(a, 'fixed');
      if (!s1 || s1.from !== s0.from || events.some(e => e.k === 'status' && e.who === a.uid && e.id === 'fixed' && !e.on)) return null;
      // Your instrument may move it (the pole) without it acting; its own steps show otherwise.
      const used = ctx.action && ctx.action.a === 'use';
      const did = events.find(e => (e.k === 'attacked' && e.by === a.uid) || (e.k === 'telegraphed' && e.who === a.uid) ||
        (e.k === 'special' && e.who === a.uid && !e.cancelled) || ((e.k === 'opened' || e.k === 'closed') && e.who === a.uid) ||
        (!used && e.k === 'moved' && e.who === a.uid));
      return did ? `it was fixed but ${did.k === 'moved' ? 'stepped' : 'made a ' + did.k + ' event'} at tick ${did.tick}` : null;
    },
  };

  const rooted = {
    id: 'rooted_never_steps',
    applies: a => a.uid === 'you',
    check(pre, events, post, ctx) {
      const a = ctx.actor, b = ctx.before;
      if (!b || !has(b, 'rooted') || !ctx.action || ctx.action.a !== 'move' || refused(events)) return null;
      if (events.some(e => e.k === 'moved' && e.who === 'you') || a.x !== b.x || a.y !== b.y) return `you were rooted at ${b.x},${b.y} and moved to ${a.x},${a.y}`;
      return null;
    },
  };

  // The status record of uid's id that covered turn t, before or after the step.
  function covered(pre, post, uid, id, t) {
    for (const st of [post, pre]) {
      const s = find(actorIn(st, uid), id);
      if (s && (!isInt(s.from) || s.from <= t) && isInt(s.until) && t < s.until) return true;
    }
    return false;
  }

  const coughing = {
    id: 'coughing_noise',
    check(pre, events, post) {
      const seen = [];
      for (const e of events) {
        if (e.k !== 'noise' || !e.cause || e.cause.k !== 'cough') continue;
        const by = e.cause.by;
        if (e.cls !== 'soft') return `a cough made a ${e.cls} noise`;
        if (!by || !covered(pre, post, by, 'coughing', e.turn)) return `${by || 'nobody'} coughed in turn ${e.turn} without coughing`;
        const key = by + '@' + e.turn;
        if (seen.includes(key)) return `${by} coughed twice in turn ${e.turn}`;
        seen.push(key);
        const you = post.actors[0];
        if (by === 'you' && (e.x !== you.x || e.y !== you.y)) return `your cough was at ${e.x},${e.y}, not at your tile ${you.x},${you.y}`;
      }
      return null;
    },
  };

  const restoring = {
    id: 'restoring_share',
    check(pre, events, post) {
      const seen = [];
      for (const e of events) {
        if (e.k !== 'healed' || !e.cause || e.cause.k !== 'status' || e.cause.id !== 'restoring') continue;
        const a = actorIn(post, e.who);
        if (!a) return `restoring healed ${e.who}, who is not here`;
        const share = Int.ceilDiv(Int.pct(a.maxHp, N.CONSOLIDANT_HOT_PCT), N.CONSOLIDANT_HOT_TURNS);
        if (!(e.amount >= 1 && e.amount <= share)) return `restoring healed ${e.who} ${e.amount}, outside 1–${share}`;
        if (e.hp > a.maxHp) return `restoring healed ${e.who} to ${e.hp}, past its maximum ${a.maxHp}`;
        if (!covered(pre, post, e.who, 'restoring', e.turn)) return `${e.who} was restored in turn ${e.turn} without restoring`;
        const key = e.who + '@' + e.turn;
        if (seen.includes(key)) return `${e.who} was restored twice in turn ${e.turn}`;
        seen.push(key);
      }
      return null;
    },
  };

  const fumigant = {
    id: 'fumigant_pips',
    check(pre, events, post) {
      const seen = [], clouds = (post.dept.surfaces || []).concat(pre.dept.surfaces || []).filter(s => s.kind === 'fumigant');
      for (const e of events) {
        if (e.k !== 'pip' || !e.cause || e.cause.k !== 'fumigant') continue;
        if (e.delta !== -1) return `a Fumigant cloud changed ${e.who}'s pips by ${e.delta}`;
        const key = e.who + '@' + e.turn;
        if (seen.includes(key)) return `a Fumigant cloud took two pips from ${e.who} in turn ${e.turn}`;
        seen.push(key);
        // With a cloud on the map, the sleeper is under one (a test may take the pip directly).
        const tiles = [actorIn(post, e.who), actorIn(pre, e.who)].filter(Boolean).flatMap(x => C.Actors.footprint(x));
        if (clouds.length && !clouds.some(s => s.until > e.turn && tiles.some(([x, y]) => Grid.covers(s, x, y)))) return `${e.who} lost a pip to a Fumigant cloud in turn ${e.turn} with no cloud over it`;
      }
      return null;
    },
  };

  const same = (s, t) => s.kind === t.kind && s.x === t.x && s.y === t.y && s.size === t.size && s.until === t.until && s.by === t.by;
  const surfaces = {
    id: 'surface_timing',
    check(pre, events, post) {
      const now = post.dept.surfaces || [], was = pre.dept.surfaces || [];
      if (!now.length && !was.length) return null;
      for (const s of now) if (!(s.until > post.turn)) return `a ${s.kind} surface at ${s.x},${s.y} lies past its last turn, ${s.until - 1}`;
      const kept = was.filter(s => s.until > post.turn);
      for (let i = 0; i < kept.length; i++) if (!now[i] || !same(kept[i], now[i])) return `a ${kept[i].kind} surface at ${kept[i].x},${kept[i].y} was changed or cleared before its time`;
      return null;
    },
  };

  // Line of sight both ways, between every actor and every tile in and around each surface,
  // and between every two actors, while a surface lies.
  const los = {
    id: 'los_symmetric',
    check(pre, events, post) {
      const m = post.dept, list = m.surfaces || [];
      if (!list.length) return null;
      // Actors near enough to a surface to see across it (within your sight of its edge).
      const near = (x, y) => list.some(s => Grid.chebyshev(x, y, s.x, s.y) <= Int.idiv(s.size, 2) + N.SIGHT_PLAYER);
      const from = [];
      for (const a of post.actors) if (!a.gone) for (const t of C.Actors.footprint(a)) if (near(t[0], t[1])) from.push(t);
      const to = from.slice();
      for (const s of list) {
        const h = Int.idiv(s.size, 2) + 2;
        for (let y = Math.max(0, s.y - h); y <= Math.min(m.h - 1, s.y + h); y++) for (let x = Math.max(0, s.x - h); x <= Math.min(m.w - 1, s.x + h); x++) to.push([x, y]);
      }
      for (const [x0, y0] of from) for (const [x1, y1] of to) {
        if (Grid.los(m, x0, y0, x1, y1) !== Grid.los(m, x1, y1, x0, y0)) return `sight between ${x0},${y0} and ${x1},${y1} differs by direction`;
      }
      return null;
    },
  };

  return [timing, fixed, rooted, coughing, restoring, fumigant, surfaces, los];
};
