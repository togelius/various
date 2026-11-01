// ACCESSION — invariants of alarm_network and the Wader, patrol_guard (BUILD.md §5.3 check 1,
// §5.4; MOD-ALARM), checked after every step of every scenario, monkey, soak and bot run
// (tools/invariants.js). Each states a sentence of the Wader's line, written out again here
// from the clause, not from the rule code:
//   "Walks its round …": alarm.round, each step a patrol takes on its round shortens its
//     walk to the post it is heading for, which it leaves for the next once it stands on it;
//   "… losing you, it searches, then resumes its round": alarm.back_to_round, a patrol done
//     searching goes back to its round (alerted, cause round, toward one of its posts), never
//     to wander or to sleep;
//   "… first showing the alarm for a turn and raising it unless one is shown or running":
//     alarm.shown, the alarm is shown only by an exhibit the module, on, acts on (flagged),
//     while none runs and no other is shown; alarm.call, an alarm is raised only by the call
//     of a mark shown at an earlier action, for ALARM_TURNS turns;
//   "a crash, then every exhibit still asleep that can hear, but the Centrepiece, wakes, sent
//     to look where you stood": alarm.call again, the crash at the caller's tile comes first,
//     and every exhibit then still asleep that can hear, but a Centrepiece's piece, wakes awake
//     by the alarm, sent to your tile, and no other;
//   "for 30 turns no pips fade, none awake or searching goes back and no other alarm is
//     raised": alarm.lasting, while one runs no pip decays and no exhibit goes back for having
//     been idle or done searching (and alarm.shown: none is shown or raised);
//   "and the bell, or after it the night watch, comes up to 30 turns sooner": alarm.clock, each
//     alarm brings the clock's next stage nearer by what its stage event says, up to
//     ALARM_CLOCK_ADVANCE and never past the next turn, and moves nothing in the night watch;
//   the alarm's end: alarm.over, it is told over at the boundary of its last turn, and only then.
// A step holds several actions (yours, then every exhibit's until your next decision), so a
// check about one moment follows the step's events in order from the state before it.
'use strict';
module.exports = (C) => {
  const { N, Grid, Archetypes, Actors, Modules } = C;
  const ID = 'alarm_network';
  const json = x => JSON.stringify(x);
  const isTile = t => Array.isArray(t) && t.length === 2;
  const same = (p, q) => isTile(p) && isTile(q) && p[0] === q[0] && p[1] === q[1];
  const find = (state, uid) => state.actors.find(b => b.uid === uid) || null;
  const mod = state => (state && state.dept && Array.isArray(state.dept.modules) ? state.dept.modules.find(m => m.id === ID) : null) || null;
  // The alarm running in a state's module, as [since, until), or null.
  const runs = state => { const m = mod(state); return m && m.alarm && Number.isInteger(m.alarm.until) && state.turn < m.alarm.until ? [m.alarm.since, m.alarm.until] : null; };
  const isAlarm = e => (e.k === 'telegraphed' || e.k === 'special') && e.sp === 'alarm';
  // The alarm event of alarm_network (another module's test may plant an alarm of its own).
  const raised = e => e.k === 'alarm' && !!e.cause && e.cause.k === ID;
  // The spans an alarm ran in, before the step and raised in it: [[since, until, by]].
  function spans(pre, events) {
    const out = [], r = runs(pre);
    if (r) out.push([r[0], r[1], mod(pre).alarm.by]);
    for (const e of events) if (raised(e)) out.push([e.turn, e.until, e.by]);
    return out;
  }
  const during = (sp, t) => sp.some(([a, b]) => t >= a && t < b);
  // A patrol's posts (its round's, or with none its home alone) and the post it heads for.
  const postsOf = a => a.route && Array.isArray(a.route.posts) && a.route.posts.length ? a.route.posts : isTile(a.home) ? [a.home] : [];
  const patrolGuard = a => a.uid !== 'you' && a.arch === 'patrol_guard';
  // A Centrepiece's piece, known by its role (§4.1).
  const piece = a => a.role === 'centrepiece';
  // Where a stood when the step's i-th event came: where it stood before the step, moved by
  // each of its steps before that event.
  function where(pre, events, i, a) {
    const b = find(pre, a.uid);
    let at = b ? [b.x, b.y] : [a.x, a.y];
    for (let k = 0; k < i; k++) if (events[k].k === 'moved' && events[k].who === a.uid) at = events[k].to;
    return at;
  }

  return [
    {
      // The alarm is shown only by an exhibit the module acts on, while it is on, with none
      // running and no other shown; and no alarm is raised while one runs.
      id: 'alarm.shown',
      check(pre, events, post) {
        if (!events.some(e => isAlarm(e) || raised(e))) return null;
        const pending = new Set(pre.actors.filter(b => !b.gone && b.telegraph && b.telegraph.sp === 'alarm').map(b => b.uid));
        let until = runs(pre) ? runs(pre)[1] : null;
        for (const e of events) {
          if (e.k === 'telegraphed' && e.sp === 'alarm') {
            const a = find(post, e.who);
            if (!a || !Modules.flagged(post, a, ID)) return `${e.who} showed the alarm on turn ${e.turn}, but alarm_network is not on for it`;
            if (until !== null && e.turn < until) return `${e.who} showed the alarm on turn ${e.turn}, while one ran until turn ${until}`;
            if (pending.size) return `${e.who} showed the alarm on turn ${e.turn}, while ${[...pending][0]} showed one`;
            const at = where(pre, events, events.indexOf(e), a);
            if (json(e.tiles) !== json(Actors.footprint({ x: at[0], y: at[1], size: a.size || 1 }))) return `${e.who}'s alarm marked ${json(e.tiles)}, not its own tile ${at}`;
            pending.add(e.who);
          } else if (e.k === 'special' && e.sp === 'alarm') pending.delete(e.who);
          else if (raised(e)) {
            if (until !== null && e.turn < until) return `an alarm was raised on turn ${e.turn}, while one ran until turn ${until}`;
            until = e.until;
          }
        }
        return null;
      },
    },
    {
      // An alarm is raised only by the call of a mark shown at an earlier action of its own
      // Wader, for ALARM_TURNS turns: first the crash at the caller's tile, then every exhibit
      // still asleep that can hear, but a Centrepiece's piece, wakes awake by the alarm, by
      // that caller, sent to your tile; none else wakes by it.
      id: 'alarm.call',
      check(pre, events, post) {
        // Wakings by the alarm, in a visit that runs it (a module's test may plant one).
        const woke = mod(pre) || mod(post) ? events.filter(e => e.k === 'woke' && e.cause && e.cause.k === 'alarm') : [];
        if (!woke.length && !events.some(raised)) return null;
        const you = [post.actors[0].x, post.actors[0].y];
        for (let i = 0; i < events.length; i++) {
          const e = events[i];
          if (!raised(e)) continue;
          if (e.until !== e.turn + N.ALARM_TURNS) return `the alarm of turn ${e.turn} runs until turn ${e.until}, not ${N.ALARM_TURNS} turns`;
          // Its call: its caller's alarm mark going off, before it in the step.
          let k = i - 1;
          while (k >= 0 && !(events[k].k === 'special' && events[k].sp === 'alarm' && events[k].who === e.by && !events[k].cancelled)) k--;
          if (k < 0) return `${e.by} raised the alarm on turn ${e.turn} with no call of its shown alarm before it`;
          const shownBefore = (pre.actors.some(b => b.uid === e.by && b.telegraph && b.telegraph.sp === 'alarm'))
            || events.slice(0, k).some(f => f.k === 'telegraphed' && f.sp === 'alarm' && f.who === e.by && f.tick < events[k].tick);
          if (!shownBefore) return `${e.by}'s alarm went off on turn ${e.turn} without being shown at an earlier action`;
          // Its crash, between the mark going off and the alarm: the first noise of the call.
          let c = k - 1;
          while (c >= 0 && !(events[c].k === 'noise' && events[c].cause && events[c].cause.k === 'alarm' && events[c].cause.by === e.by)) c--;
          if (c < 0 || events[c].cls !== 'crash' || events[c].tick !== events[k].tick) return `${e.by}'s call on turn ${e.turn} made no crash`;
          // The call's wakes, between its crash and the mark's going off.
          const mine = events.slice(c, k).filter(f => f.k === 'woke' && f.cause && f.cause.k === 'alarm');
          for (const f of mine) {
            if (f.cause.by !== e.by) return `${f.who} woke by ${f.cause.by}'s alarm in ${e.by}'s call`;
            if (f.was !== 'dormant' || f.mode !== 'awake') return `${f.who} woke by the alarm from ${f.was} into ${f.mode}, not from sleep into awake`;
            if (f.cause.x !== you[0] || f.cause.y !== you[1]) return `${f.who} woke by the alarm to look at ${f.cause.x},${f.cause.y}, not at your tile ${you}`;
          }
          // Every exhibit still asleep after the call, that can hear and is no Centrepiece's,
          // must have fallen asleep after it (going back to sleep at home).
          for (const b of post.actors) {
            if (b.uid === 'you' || b.gone || b.mode !== 'dormant' || Archetypes.pipless(post, b) || piece(b)) continue;
            const before = find(pre, b.uid);
            if (before && Archetypes.pipless(pre, before)) continue;
            const slept = events.slice(k).some(f => f.who === b.uid && ((f.k === 'returned' && f.phase === 'reinstalled') || (f.k === 'lost' && f.to === 'dormant')));
            if (!slept && !mine.some(f => f.who === b.uid)) return `${b.uid} slept through ${e.by}'s alarm on turn ${e.turn}, though it can hear`;
          }
        }
        // No other waking by the alarm: each is a call's, of a sleeper that could hear and is
        // no Centrepiece's piece.
        for (const f of woke) {
          const b = find(pre, f.who) || find(post, f.who);
          if (b && piece(b)) return `the alarm woke ${f.who}, a Centrepiece's piece`;
          if (b && find(pre, f.who) && Archetypes.pipless(pre, find(pre, f.who))) return `the alarm woke ${f.who}, which cannot hear`;
          const i = events.indexOf(f);
          if (!events.slice(i).some(e => e.k === 'special' && e.sp === 'alarm' && e.who === f.cause.by && !e.cancelled)) return `${f.who} woke by the alarm with no call going off`;
        }
        return null;
      },
    },
    {
      // While an alarm runs (since ≤ turn < until), no pip decays and no exhibit sets off back
      // for having been idle or done searching.
      id: 'alarm.lasting',
      check(pre, events) {
        const sp = spans(pre, events);
        if (!sp.length) return null;
        for (const e of events) {
          if (!during(sp, e.turn)) continue;
          if (e.k === 'pip' && e.delta < 0 && e.cause && e.cause.k === 'decay') return `${e.who} lost a pip to decay on turn ${e.turn}, while the alarm ran`;
          if (e.k === 'lost' && e.to === 'returning' && e.cause && (e.cause.k === 'idle' || e.cause.k === 'searched')) return `${e.who} went back (${e.cause.k}) on turn ${e.turn}, while the alarm ran`;
        }
        return null;
      },
    },
    {
      // Each alarm brings the clock's next stage nearer, by its stage event's n: the bell
      // (and the night watch with it) before the bell, the night watch after it, nothing in
      // the night watch; up to ALARM_CLOCK_ADVANCE, never past the next turn.
      id: 'alarm.clock',
      check(pre, events, post) {
        if (!events.some(e => raised(e) || (e.k === 'stage' && e.cause && e.cause.k === ID))) return null;
        const c0 = pre.dept.clock, c1 = post.dept.clock;
        let moved = 0, all = 0, stage = c0 ? c0.stage : null;
        for (let i = 0; i < events.length; i++) {
          const e = events[i];
          if (e.k === 'stage' && e.cause && e.cause.k === 'clock') stage = e.stage === 'bell' ? 1 : e.stage === 'night_watch' ? 2 : stage;
          if (e.k === 'stage' && e.cause && e.cause.k === ID) {
            const a = events.slice(0, i).reverse().find(raised);
            if (!a || a.by !== e.cause.by) return `the clock was brought nearer on turn ${e.turn} by ${e.cause.by}, with no alarm of its just before`;
            if (!c0) return 'the clock was brought nearer in a room with no clock';
            const want = ['bell_sooner', 'watch_sooner', 'nothing_sooner'][stage];
            if (e.stage !== want) return `in clock stage ${stage} the alarm's stage event is ${e.stage}, not ${want}`;
            if (!(e.n >= 0 && e.n <= N.ALARM_CLOCK_ADVANCE) || (stage === 2 && e.n !== 0)) return `the alarm brought the clock ${e.n} turns nearer in stage ${stage}`;
            moved += e.n;
          }
          if (e.k === 'stage' && (e.stage === 'bell_sooner' || e.stage === 'watch_sooner') && Number.isInteger(e.n)) all += e.n;
          if (raised(e) && c0 && !events.slice(i + 1).some(f => f.k === 'stage' && f.cause && f.cause.k === ID && f.cause.by === e.by)) return `${e.by}'s alarm on turn ${e.turn} did not bring the clock nearer`;
        }
        if (!c0 || !c1) return null;
        // Before the bell, its count and the night watch's both moved by what was said; after
        // it, the night watch's; and each stage still to come is after the count.
        const was = c0.stage === 0 ? c0.B : c0.B + c0.G, now = c0.stage === 0 ? c1.B : c1.B + c1.G;
        if (c0.stage < 2 && c1.stage === c0.stage && was - now !== all) return `the clock's next stage moved ${was - now} turns nearer, but its stage events said ${all} (the alarm's ${moved})`;
        if (c0.stage === 0 && c1.G !== c0.G) return `before the bell, the alarm changed the gap to the night watch (${c0.G} to ${c1.G})`;
        if (c1.stage === 0 && c1.B <= c1.count) return `the bell is due at count ${c1.B}, which has already passed (${c1.count})`;
        return null;
      },
    },
    {
      // The alarm is told over at the boundary of its last turn, and only then.
      id: 'alarm.over',
      check(pre, events, post) {
        const overs = events.filter(e => e.k === 'module' && e.id === ID && e.rule === 'alarm_over');
        const m0 = mod(pre), a0 = m0 && m0.alarm ? m0.alarm : null;
        if (!overs.length && !(a0 && a0.until <= post.turn)) return null;
        const sp = spans(pre, events).map(([s, u]) => [s, u]);
        for (const e of overs) {
          if (!sp.some(([s, u]) => u === e.turn && e.turns === u - s)) return `the alarm was told over on turn ${e.turn}, after ${e.turns} turns, which is no alarm's last`;
        }
        // An alarm whose last turn came in the step (the visit going on, the module on) was told over.
        if (a0 && a0.until > pre.turn && a0.until <= post.turn && Modules.on(post, ID) && !(post.over && post.over.turn < a0.until) && !overs.some(e => e.turn === a0.until))
          return `the alarm ran until turn ${a0.until}, and was not told over then`;
        const m1 = mod(post);
        if (m1 && m1.alarm && m1.alarm.until <= post.turn && !post.over && Modules.on(post, ID)) return `the alarm's last turn, ${m1.alarm.until}, has passed, and it still stands`;
        return null;
      },
    },
    {
      // A patrol walking its round: each step it takes shortens its walk to the post it heads
      // for, the one after the post it has just stood on.
      id: 'alarm.round',
      applies: patrolGuard,
      check(pre, events, post, ctx) {
        const a = ctx.actor, b = ctx.before;
        if (!b || a.gone || b.mode !== 'awake' || a.mode !== 'awake') return null;
        const P = postsOf(b);
        if (!P.length || (b.target && !same(b.target, P[b.route && P.length > 1 ? b.route.i : 0]))) return null;
        if (events.some(e => e.who === a.uid && (e.k === 'alerted' || e.k === 'hunting' || e.k === 'lost'))) return null;
        let i = P.length > 1 ? b.route.i : 0;
        const field = new Map(), m = post.dept;
        const dist = (k, x, y) => { if (!field.has(k)) field.set(k, Grid.distances(m, [P[k]], m.w * m.h, null, 'exhibit')); return field.get(k)[y * m.w + x]; };
        // Someone else stands on a post (before or after the step).
        const taken = p => [pre, post].some(st => st.actors.some(o => o.uid !== a.uid && !o.gone && Actors.footprint(o).some(t => same(t, p))));
        for (const e of events) {
          if (e.k !== 'moved' || e.who !== a.uid || e.cause !== undefined) continue;
          // It leaves a post for the next once it stands on it, once it stands beside it with
          // someone on it, or when it can get no nearer to it at all.
          for (let n = 0; P.length > 1 && n < P.length; n++) {
            const p = P[i];
            if (!(same(e.from, p) || dist(i, e.from[0], e.from[1]) < 0 || (Grid.chebyshev(e.from[0], e.from[1], p[0], p[1]) === 1 && taken(p)))) break;
            i = (i + 1) % P.length;
          }
          const d0 = dist(i, e.from[0], e.from[1]), d1 = dist(i, e.to[0], e.to[1]);
          if (!(d0 > 0 && d1 === d0 - 1)) return `on its round, it stepped from ${e.from} to ${e.to}, which does not shorten its walk to its post ${P[i]} (${d0} to ${d1})`;
        }
        return null;
      },
    },
    {
      // A patrol done searching goes back to its round, toward one of its posts: never to
      // wander (alerted, searched), and never back to sleep (its trigger says so too).
      id: 'alarm.back_to_round',
      check(pre, events, post) {
        for (const e of events) {
          if (e.k !== 'alerted' || !e.cause) continue;
          const a = find(post, e.who);
          if (!a) continue;
          if (e.cause.k === 'round') {
            if (!patrolGuard(a)) return `${e.who} went back to a round, but it is no patrol_guard`;
            if (e.from !== 'searching') return `${e.who} went back to its round from ${e.from}, not from searching`;
            if (!postsOf(a).some(p => same(p, [e.x, e.y]))) return `${e.who} went back to its round toward ${e.x},${e.y}, which is none of its posts`;
          } else if (patrolGuard(a) && e.cause.k === 'searched') return `${e.who}, a patrol, searched and went to wander, not back to its round`;
        }
        return null;
      },
    },
  ];
};
