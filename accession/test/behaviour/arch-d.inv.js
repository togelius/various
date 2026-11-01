// ACCESSION — invariants of the clockwork modifier and the conservator_healer archetype
// (BUILD.md §5.3 check 1; M4 plan A11, D3.12, D3.13; ARCH-CLOCKWORK), checked after every step
// of every scenario, monkey, soak and bot run (tools/invariants.js). Each states a sentence of
// a line, written out again here from the clause, reading the state, the events and what the
// exhibit's arrow showed you at your decision (Archetypes.plan: what the player is shown), never
// the rule code's own bookkeeping:
//   clockwork "Shows its next move as an arrow and makes it if it still can, else waits":
//     clockwork.plan, a clockwork exhibit's first action after your decision is the move its
//     arrow showed you then, or a wait: its step onto the tile shown (or the door it opens
//     there), its blow at the one shown, its special marked on the tiles shown, its mark going
//     off; a station's arrow is its line, and it never steps or strikes;
//   clockwork "cannot be dazed": clockwork.dazed, no clockwork exhibit is ever dazed, and no
//     event puts dazed on one;
//   conservator_healer "never strikes": healer.blow, no blow of a healer's;
//   conservator_healer "Keeps {CONSERVATOR_KEEP} tiles from you, stepping away when you come
//     nearer": healer.keep, a healer hunting you never steps nearer to you than that, by your
//     walking distance (one clockwork makes the moves of is held to what it showed instead,
//     by clockwork.plan);
//   restore "… restores up to {CONSERVATOR_HEAL_PCT}% of the maximum health of the exhibit
//     standing there": healer.restore, every healing by a restore is the healer's restore going
//     off (its special event, after it, in the same step), of an exhibit other than you and
//     the healer standing on a tile its mark showed, by exactly that share rounded down, or
//     what it lacked of its maximum.
// The first action of an exhibit after your decision is the one at its `next` then (an
// exhibit's action is charged after it acts, §8.1, so its next decision is fixed when you
// decide); its own moves at that tick are its: a step of its own (moved with no cause), a
// door it opened (opened, cause door), a blow (attacked by it), a mark (telegraphed, not a due
// line's: those are a module's, at a boundary), or its mark going off (special, not called off).
'use strict';
module.exports = (C) => {
  const { N, Int, Grid, Archetypes, Options } = C;
  const find = (state, uid) => state.actors.find(b => b.uid === uid) || null;
  const clockwork = (state, a) => !!a && a.uid !== 'you' && Array.isArray(a.mods) && a.mods.includes('clockwork') && !Options.off(state, 'clockwork');
  const healer = a => !!a && a.arch === 'conservator_healer';
  const tileIn = (list, x, y) => list.some(t => t[0] === x && t[1] === y);
  const sameTiles = (p, q) => p.length === q.length && p.every((t, i) => t[0] === q[i][0] && t[1] === q[i][1]);
  // The moves of an exhibit's own action among the events: [{i, e, k}] in order.
  function moves(events, uid) {
    const out = [];
    events.forEach((e, i) => {
      if (e.k === 'moved' && e.who === uid && e.cause === undefined) out.push({ i, e, k: 'step' });
      else if (e.k === 'opened' && e.who === uid && e.cause && e.cause.k === 'door') out.push({ i, e, k: 'door' });
      else if (e.k === 'attacked' && e.by === uid) out.push({ i, e, k: 'strike' });
      else if (e.k === 'telegraphed' && e.who === uid && !(e.cause && Number.isInteger(e.cause.due))) out.push({ i, e, k: 'mark' });
      else if (e.k === 'special' && e.who === uid && !e.cancelled && !(e.cause && e.cause.k === 'cancel')) out.push({ i, e, k: 'resolve' });
    });
    return out;
  }
  const said = m => m.k === 'step' ? `stepped to ${m.e.to}` : m.k === 'door' ? `opened the door at ${m.e.x},${m.e.y}` : m.k === 'strike' ? `struck at ${m.e.at}`
    : m.k === 'mark' ? `marked its ${m.e.sp} on ${JSON.stringify(m.e.tiles)}` : `set off its ${m.e.sp}`;
  // Does the move made match the move shown?
  function matches(shown, m, size) {
    if (shown.k === 'step') {
      if (m.k === 'step') return m.e.to[0] === shown.to[0] && m.e.to[1] === shown.to[1];
      if (m.k === 'door') return m.e.x >= shown.to[0] && m.e.y >= shown.to[1] && m.e.x < shown.to[0] + size && m.e.y < shown.to[1] + size;
      return false;
    }
    if (shown.k === 'strike') return m.k === 'strike' && m.e.at === shown.at;
    if (shown.k === 'mark') return m.k === 'mark' && m.e.sp === shown.sp && sameTiles(m.e.tiles, shown.tiles);
    if (shown.k === 'resolve') return m.k === 'resolve' && m.e.sp === shown.sp;
    return false;
  }
  // Where an actor stood just before the i-th event: from the state before the step, through
  // its moves (a step of its own, or one a rule or an instrument made).
  function where(pre, events, uid, i) {
    const b = find(pre, uid);
    let at = b ? [b.x, b.y] : null;
    for (let k = 0; k < i; k++) if (events[k].k === 'moved' && events[k].who === uid) at = events[k].to.slice();
    return at;
  }

  return [
    {
      // Its first action after your decision is the move its arrow showed you, or a wait.
      id: 'clockwork.plan',
      applies: (a, state) => clockwork(state, a),
      check(pre, events, post, ctx) {
        const b = ctx.before;
        if (!b || b.gone || b.mode === 'dormant' || !clockwork(pre, b)) return null;
        const shown = Archetypes.plan(pre, b), all = moves(events, b.uid);
        if (shown && shown.k === 'line') {
          const m = all.find(x => x.k === 'step' || x.k === 'door' || x.k === 'strike');
          return m ? `${b.uid}, a station whose arrow is its line, ${said(m)}` : null;
        }
        const first = all.find(x => x.e.tick === b.next);
        if (!first) return null;
        if (!shown || shown.k === 'wait') return `${b.uid} ${said(first)} at tick ${b.next}, where its arrow showed ${shown ? 'a wait' : 'no move'}`;
        if (!Array.isArray(shown.tiles)) return `${b.uid}'s arrow gave no tiles: ${JSON.stringify(shown)}`;
        return matches(shown, first, b.size || 1) ? null : `${b.uid} ${said(first)} at tick ${b.next}, where its arrow showed ${JSON.stringify(shown)}`;
      },
    },
    {
      // Never dazed.
      id: 'clockwork.dazed',
      applies: (a, state) => clockwork(state, a),
      check(pre, events, post, ctx) {
        const a = ctx.actor;
        if ((a.statuses || []).some(s => s.id === 'dazed')) return `${a.uid} is dazed`;
        const e = events.find(x => x.k === 'status' && x.who === a.uid && x.id === 'dazed' && x.on);
        return e ? `${a.uid} was made dazed` : null;
      },
    },
    {
      // A healer never strikes.
      id: 'healer.blow',
      applies: a => healer(a),
      check(pre, events, post, ctx) {
        const e = events.find(x => x.k === 'attacked' && x.by === ctx.uid);
        return e ? `${ctx.uid} struck at ${e.at}` : null;
      },
    },
    {
      // Hunting you, a healer never steps nearer to you than CONSERVATOR_KEEP walking tiles.
      id: 'healer.keep',
      applies: (a, state) => healer(a) && !clockwork(state, a),
      check(pre, events, post, ctx) {
        const b = ctx.before;
        if (!b || b.mode !== 'hunting') return null;
        const own = moves(events, b.uid).filter(m => m.k === 'step');
        if (!own.length) return null;
        // While it hunts: up to the first change of its mode in the step.
        const stop = events.findIndex(e => (e.k === 'lost' || e.k === 'alerted' || e.k === 'returned') && e.who === b.uid);
        for (const { i, e } of own) {
          if (stop >= 0 && i > stop) break;
          const you = where(pre, events, 'you', i), m = post.dept, d = Grid.distances(m, [you], m.w * m.h, null, 'exhibit');
          const from = d[e.from[1] * m.w + e.from[0]], to = d[e.to[1] * m.w + e.to[0]];
          if (to >= 0 && to < N.CONSERVATOR_KEEP && (from < 0 || to < from)) return `${b.uid} stepped from ${e.from} to ${e.to}, ${to} walking tiles from you at ${you}, nearer than ${N.CONSERVATOR_KEEP}`;
        }
        return null;
      },
    },
    {
      // Every healing by a restore: the healer's restore going off, on the tiles its mark showed,
      // of an exhibit other than you and the healer, by its share or what it lacked.
      id: 'healer.restore',
      check(pre, events, post) {
        for (let i = 0; i < events.length; i++) {
          const e = events[i];
          if (e.k !== 'healed' || !e.cause || e.cause.k !== 'restore') continue;
          const h = e.cause.by, who = find(post, e.who) || find(pre, e.who);
          if (e.who === 'you' || e.who === h) return `${h}'s restore healed ${e.who}`;
          if (!healer(find(post, h) || find(pre, h))) return `${e.who} was healed by a restore of ${h}, no healer`;
          const off = events.findIndex((x, k) => k > i && x.k === 'special' && x.who === h);
          if (off < 0 || events[off].sp !== 'restore' || events[off].cancelled) return `${e.who} was healed by ${h}'s restore, which did not go off then`;
          // The mark: pending before the step, or made in it before the healing.
          let tiles = null;
          for (let k = i - 1; k >= 0 && !tiles; k--) if (events[k].k === 'telegraphed' && events[k].who === h) tiles = events[k].tiles;
          if (!tiles) { const p = find(pre, h); tiles = p && p.telegraph && p.telegraph.sp === 'restore' ? p.telegraph.tiles : null; }
          if (!tiles) return `${h}'s restore healed ${e.who} with no mark shown`;
          const at = where(pre, events, e.who, i), size = who ? who.size || 1 : 1;
          let on = false;
          for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) if (at && tileIn(tiles, at[0] + dx, at[1] + dy)) on = true;
          if (!on) return `${h}'s restore healed ${e.who} at ${at}, on no tile its mark showed (${JSON.stringify(tiles)})`;
          const max = who.maxHp, before = e.hp - e.amount, share = Int.pct(max, N.CONSERVATOR_HEAL_PCT);
          if (e.amount !== Math.min(share, max - before)) return `${h}'s restore healed ${e.who} ${e.amount}, not ${Math.min(share, max - before)} (${N.CONSERVATOR_HEAL_PCT}% of ${max} is ${share}; it lacked ${max - before})`;
        }
        return null;
      },
    },
  ];
};
