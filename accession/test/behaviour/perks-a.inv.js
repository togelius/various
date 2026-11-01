// ACCESSION — the invariants of Soft Soles, Vanishing Act, Light Fingers and the staggered status
// (BUILD.md §8.1, §8.2, §8.3, §8.7; PG-PERKS-A), held after every step of every scenario, monkey,
// soak and bot run (tools/invariants.js). Each is what a perk's clause says, read back from the
// state before and after the step and the step's events, with the perk's numbers of record,
// never from its rule code (rules/perks/*.js). A perk counts when you hold it at rank 1 or 2
// and it is not switched off for the visit (rulesOff).
//   perks_a.soft_soles     with Soft Soles, your ring (the ring drawn, which the next boundary
//                          applies: Vision.ringRadius) is §8.2's ring, PERK_SOFT_SOLES[rank − 1]
//                          smaller, never below RING_MIN, or the larger ring a free or cheaper
//                          action left owed (you.ringMax, plan A6);
//   perks_a.vanishing_act  with Vanishing Act, no hunter loses you after LOSE_TRACK_TURNS
//                          (out_of_sight): each loses you at once (vanished), going from hunting
//                          to searching, saying so in its cause when it stands in an intact case
//                          (how 'case', since it only waits there); never the Night Watchman,
//                          which is never lost and never staggered by it; at the second rank a
//                          hunter that vanished is at once staggered, for STAGGER_TURNS turns,
//                          cause perk vanishing_act (unless it is immune), and at the first it is
//                          not; and the perk staggers nothing else;
//   perks_a.staggered      a staggered exhibit loses its next action: at any decision of its
//                          that falls in a turn its staggered covers (after it was put on), it
//                          only waits: no step of its own, blow, mark, special, door, and it does
//                          not look for you (no hunt begun by sight); and no wait of its is
//                          shorter than the turns staggered covers, so it loses that one action
//                          only;
//   perks_a.light_fingers  your open of a case is within your grade, and the grade above it
//                          (PERK_LIGHT_FINGERS_ABOVE) only with Light Fingers at the second
//                          rank; with Light Fingers it makes no noise and costs
//                          PERK_LIGHT_FINGERS_COST ticks (doubled while you are slowed); and the
//                          case's rules as they read before the open (Cases.rules, its label's
//                          Behaviour line) state the ticks it cost and whether it made a noise,
//                          name Light Fingers only while it counts, and the grade above yours
//                          only while you open it; a staff door you open is never above your grade.
'use strict';
module.exports = (C) => {
  const { N, Int, Grid } = C;
  const json = x => JSON.stringify(x);
  const turnOf = tick => Int.idiv(tick, N.TICKS_PER_TURN);
  const actorIn = (s, uid) => { for (const a of s.actors) if (a.uid === uid) return a; return null; };
  const find = (a, id) => { for (const s of (a && a.statuses) || []) if (s.id === id) return s; return null; };
  // The rank a perk counts at: the rank you hold it at (0 if not), 0 while it is switched off.
  const rank = (s, id) => {
    if (s.options && Array.isArray(s.options.rulesOff) && s.options.rulesOff.includes(id)) return 0;
    for (const p of (s.run && s.run.perks) || []) if (p.id === id) return p.rank;
    return 0;
  };
  const refused = events => events.length === 1 && events[0].k === 'refused';
  const isWatchman = a => !!a && a.arch === 'night_watchman';
  // The perks that change what an action of yours costs (plan A6: Duck and Cover, Close the
  // Distance), whose discounts the cost checks below leave to their own invariants.
  const TIMING = ['duck_and_cover', 'close_the_distance'];

  const softSoles = {
    id: 'perks_a.soft_soles',
    check(pre, events, post) {
      const r = rank(post, 'soft_soles');
      if (!r || post.over) return null;
      const you = post.actors[0], T = Grid.TILES[Grid.ch(post.dept, you.x, you.y)];
      const own = Math.max(N.RING_MIN, (you.still ? N.RING_STILL : N.RING_MOVING) + (T && T.loud ? N.RING_LOUD_FLOOR : 0) + C.Kit.ringDelta(post) - N.PERK_SOFT_SOLES[r - 1]);
      const want = Number.isInteger(you.ringMax) && you.ringMax > own ? you.ringMax : own;
      const got = C.Vision.ringRadius(post);
      return got === want ? null : `with Soft Soles at rank ${r} your ring is ${got}, not ${want} (${you.still ? 'standing still' : 'moving'}${T && T.loud ? ', on a loud floor' : ''}, ${N.PERK_SOFT_SOLES[r - 1]} smaller, never below ${N.RING_MIN})`;
    },
  };

  const vanishing = {
    id: 'perks_a.vanishing_act',
    check(pre, events, post) {
      const r = rank(pre, 'vanishing_act');
      for (let i = 0; i < events.length; i++) {
        const e = events[i], c = e.cause || {};
        const a = e.who ? actorIn(post, e.who) : null;
        if (e.k === 'lost' && c.k === 'out_of_sight' && r) return `${e.who} lost you after ${c.turns} turns out of sight, but with Vanishing Act a hunter searches at its first action out of sight`;
        if (r && isWatchman(a) && (e.k === 'lost' || (e.k === 'status' && c.k === 'perk' && c.id === 'vanishing_act'))) return `Vanishing Act touched the Night Watchman ${e.who}: ${json(e)}`;
        if (e.k === 'lost' && c.k === 'vanished') {
          if (!r) return `${e.who} lost you with the cause vanished, but Vanishing Act does not count`;
          if (e.from !== 'hunting' || e.to !== 'searching') return `${e.who} vanished from ${e.from} to ${e.to}, not from hunting to searching`;
          const cased = !!a && C.Cases.encased(post, a);
          if ((c.how === 'case') !== cased) return `${e.who}'s vanishing says how ${json(c.how)}, but it ${cased ? 'stands' : 'does not stand'} in an intact case`;
          const next = events[i + 1], immune = !!a && C.Archetypes.immune(post, a, 'staggered');
          const staggered = !!next && next.k === 'status' && next.who === e.who && next.id === 'staggered' && next.on && next.cause && next.cause.k === 'perk' && next.cause.id === 'vanishing_act';
          if (r >= 2 && !immune && !(staggered && next.turns === N.STAGGER_TURNS)) return `${e.who} vanished with Vanishing Act at the second rank, but was not at once staggered for ${N.STAGGER_TURNS} turns: ${json(next)}`;
          if (r < 2 && staggered) return `${e.who} was staggered by Vanishing Act at the first rank`;
        }
        if (e.k === 'status' && c.k === 'perk' && c.id === 'vanishing_act') {
          const was = events[i - 1];
          if (rank(pre, 'vanishing_act') < 2) return `Vanishing Act below the second rank put ${e.id} on ${e.who}`;
          if (e.id !== 'staggered' || !e.on || !was || was.k !== 'lost' || was.who !== e.who || !was.cause || was.cause.k !== 'vanished') return `Vanishing Act put ${e.id} on ${e.who} with no vanishing just before it: ${json(was)}`;
        }
      }
      return null;
    },
  };

  // An exhibit's own doings, by kind: a step (not a move your action made of it, the pole's, at
  // your action's tick and naming you), a blow, a mark, a special, a door, a hunt begun by sight.
  const own = (a, e, pre) => (e.k === 'moved' && e.who === a.uid && !(e.tick === pre.tick && e.cause && e.cause.by === 'you')) ||
    (e.k === 'attacked' && e.by === a.uid) || (e.k === 'telegraphed' && e.who === a.uid) || (e.k === 'special' && e.who === a.uid && !e.cancelled) ||
    ((e.k === 'opened' || e.k === 'closed') && e.who === a.uid) || (e.k === 'hunting' && e.who === a.uid && !!e.cause && e.cause.k === 'seen');
  const staggered = {
    id: 'perks_a.staggered',
    applies: a => a.uid !== 'you',
    check(pre, events, post, ctx) {
      const a = ctx.actor, b = ctx.before, was = find(b, 'staggered'), now = find(a, 'staggered');
      const put = events.filter(e => e.k === 'status' && e.who === a.uid && e.id === 'staggered' && e.on);
      if (!was && !now && !put.length) return null;
      if (put.length && !a.gone) {
        const wait = C.Actors.cost(post, a, N.COST_WAIT, 'act');
        if (wait < N.TICKS_PER_TURN * N.STAGGER_TURNS) return `it was staggered for ${N.STAGGER_TURNS} turns, but its wait takes ${wait} ticks, so it would lose more than its next action`;
      }
      // The turns it was staggered, and from which tick: a record held before the step counts
      // from the step's start; one put on in it, from the tick it was put on (its own action
      // that put it on is not lost).
      const from = put.length ? put[0].tick : -1;
      const spans = [];
      for (const s of [was, now]) if (s && Number.isInteger(s.from) && Number.isInteger(s.until)) spans.push([s.from, s.until, s === was ? -1 : from]);
      for (const e of events) {
        if (!own(a, e, pre)) continue;
        const t = turnOf(e.tick);
        const lost = spans.find(([f, u, after]) => t >= f && t < u && e.tick > after);
        if (lost) return `it was staggered (turns ${lost[0]}–${lost[1] - 1}) and still ${e.k === 'moved' ? 'stepped' : 'made a ' + e.k + ' event'} at tick ${e.tick}`;
      }
      return null;
    },
  };

  // The case's opening sentence as its rules read: [ticks, noise ('soft' or 'none'), names
  // Light Fingers, says the grade above yours], or null if it says neither.
  function opening(text) {
    const m = /^Opens for (\d+) ticks and (a soft noise|no noise)(, with your Light Fingers,)? if (your grade reaches its lock|its lock is no more than one grade above yours)\./.exec(text);
    return m ? [Number(m[1]), m[2] === 'no noise' ? 'none' : 'soft', !!m[3], m[4] !== 'your grade reaches its lock'] : null;
  }
  const fingers = {
    id: 'perks_a.light_fingers',
    check(pre, events, post, ctx) {
      const act = ctx.action;
      const grade = (pre.run && pre.run.grade) || N.GRADE_START, r = rank(pre, 'light_fingers');
      for (const e of events) if (e.k === 'opened' && e.who === 'you' && e.cause && e.cause.k === 'staff' && e.cause.grade > grade) return `you opened a staff door of ${e.cause.grade}, above your grade ${grade}`;
      if (!act || act.a !== 'open' || refused(events)) return null;
      const f = (pre.dept.fixtures || []).find(q => q.k === 'case' && q.x === act.x && q.y === act.y);
      if (!f) return null;
      const above = r >= 2 ? N.PERK_LIGHT_FINGERS_ABOVE : 0;
      if (f.lock > grade + above) return `you opened a case with lock ${f.lock} at grade ${grade}${r ? ` with Light Fingers at rank ${r}` : ''}`;
      const you = pre.actors[0], slowed = !!find(you, 'slowed');
      const noise = events.some(e => e.k === 'noise' && e.cause && e.cause.k === 'case_opened' && e.cause.by === 'you');
      const raw = r ? N.PERK_LIGHT_FINGERS_COST : N.COST_OPEN_CASE;
      if (r && noise) return 'with Light Fingers your opening of a case made a noise';
      const timed = !(pre.run.perks || []).some(p => TIMING.includes(p.id)), spent = post.actors[0].next - you.next;
      if (timed && spent !== (slowed ? Int.pct(raw, N.SPEED_SLOW_PCT) : raw)) return `your open cost ${spent} ticks, not ${raw}${slowed ? ' doubled, as you are slowed' : ''}${r ? ', with Light Fingers' : ''}`;
      // What the case's rules said of opening it, before the open: what it cost and whether it
      // made a noise; Light Fingers named only while it counts; the grade above yours only
      // while you open it.
      const said = opening(C.Cases.rules(pre, f)[0]);
      if (!said) return `the case's rules do not say how it opens: ${json(C.Cases.rules(pre, f)[0])}`;
      if (said[0] !== raw) return `the case's rules say it opens for ${said[0]} ticks, but it took ${raw}${slowed ? ' before slowed doubled it' : ''}`;
      if (said[1] !== (noise ? 'soft' : 'none')) return `the case's rules say ${said[1] === 'soft' ? 'a soft noise' : 'no noise'}, but ${noise ? 'a noise was' : 'none was'} made`;
      if (said[2] !== !!r) return `the case's rules ${said[2] ? 'name' : 'do not name'} Light Fingers, at rank ${r}`;
      if (said[3] !== above > 0) return `the case's rules ${said[3] ? 'say' : 'do not say'} you open locks above your grade, at rank ${r}`;
      return null;
    },
  };

  return [softSoles, vanishing, staggered, fingers];
};
