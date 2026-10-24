// ACCESSION — invariants of the herald, the tethered_warden and the mimic_vitrine (BUILD.md
// §5.3 check 1; W1-ARCH-C), checked after every step of every scenario, monkey, soak and bot
// run (tools/invariants.js). Each states one sentence of a Behaviour line, written out again
// here from the clause, not from the rule code:
//   herald: "Each time it wakes, the first time it sees you it calls for a turn, shown, then
//     wakes every sleeping exhibit within 6 tiles of it, which come to look where you stood";
//   tethered_warden: "Stays within 2 tiles of what it guards … beside you, at most one action
//     in 3 since it woke, it marks the tiles round it … If you are not within 2 tiles of what
//     it guards, it goes back, heals fully and settles";
//   mimic_vitrine: "Looks like a case … Opened or bashed, it grips you (you cannot move for 2
//     turns) and strikes …; it does everything at half speed. Wakes only when it is opened,
//     bashed, dissolved or struck";
// and, for every exhibit, a pipless one is never woken by a call.
'use strict';
module.exports = (C) => {
  const { N, Archetypes } = C;
  const json = x => JSON.stringify(x);
  // "Within r" (§8.2): dx² + dy² ≤ r² + r.
  const within = (g, x, y, r) => (x - g[0]) * (x - g[0]) + (y - g[1]) * (y - g[1]) <= r * r + r;
  const foot = a => { const s = a.size || 1, out = []; for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) out.push([a.x + dx, a.y + dy]); return out; };
  const onTiles = (a, tiles) => foot(a).some(([x, y]) => tiles.some(t => t[0] === x && t[1] === y));
  const find = (state, uid) => state.actors.find(b => b.uid === uid) || null;
  const youIn = state => [state.actors[0].x, state.actors[0].y];
  // A mimic is a case while its case fixture is shut and its tile is a vitrine (§8.3).
  const caseOf = (state, a) => ((state.dept && state.dept.fixtures) || []).find(f => f.k === 'case' && f.mimic === a.uid) || null;
  const isCase = (state, a) => { const f = caseOf(state, a); return !!f && f.st === 'shut' && state.dept.tiles[f.y][f.x] === 'v'; };

  const herald = {
    id: 'herald_call',
    applies: a => a.arch === 'herald',
    check(pre, events, post, ctx) {
      const uid = ctx.uid, before = ctx.before, a = ctx.actor;
      // Once per waking: a call is marked only if it has not called since it last woke, and
      // its record of having called (ax.called) says exactly that.
      let called = !!(before && before.ax && before.ax.called);
      for (const e of events) {
        if (e.k === 'woke' && e.who === uid) called = false;
        if (e.k === 'telegraphed' && e.who === uid && e.sp === 'call') {
          if (called) return `it marked a second call in one waking, on turn ${e.turn}`;
          called = true;
        }
      }
      if (!!(a.ax && a.ax.called) !== called) return `ax.called is ${json(a.ax && a.ax.called)}, but its calls since it last woke say ${called ? 1 : 0}`;
      // Only after its shown turn, only within the shown tiles, only sleepers, awake.
      const tel = before && before.telegraph && before.telegraph.sp === 'call' ? before.telegraph : null;
      let resolved = false;
      for (const e of events) {
        if (e.k === 'special' && e.who === uid && e.sp === 'call' && !e.cancelled) {
          if (!tel) return 'its call went off without having been shown before your decision';
          resolved = true;
        }
        if (e.k !== 'woke' || !e.cause || e.cause.k !== 'herald' || e.cause.by !== uid) continue;
        if (!tel) return `it woke ${e.who} with no call shown before your decision`;
        const b = find(pre, e.who);
        if (!b || b.mode !== 'dormant') return `it woke ${e.who}, which was not asleep`;
        if (!onTiles(b, tel.tiles)) return `it woke ${e.who} at ${b.x},${b.y}, outside the tiles its call showed`;
        if (e.mode !== 'awake') return `${e.who} woke ${e.mode}, not awake`;
      }
      // Every sleeper the call showed, unless pipless, is woken by it.
      if (resolved) for (const b of post.actors) {
        if (b.uid === 'you' || b === a || b.gone || b.mode !== 'dormant' || !onTiles(b, tel.tiles) || Archetypes.pipless(post, b)) continue;
        return `${b.uid} at ${b.x},${b.y} slept through the call`;
      }
      return null;
    },
  };

  // A pipless actor (a mimic) is never woken by a call (§8.2).
  const pipless = {
    id: 'call_never_wakes_pipless',
    check(pre, events) {
      for (const e of events) {
        if (e.k !== 'woke' || !e.cause || e.cause.k !== 'herald') continue;
        const b = find(pre, e.who);
        if (b && Archetypes.pipless(pre, b)) return `the call of ${e.cause.by} woke ${e.who}, which is pipless`;
      }
      return null;
    },
  };

  const tether = {
    id: 'warden_tether',
    applies: a => a.arch === 'tethered_warden' && !!a.guards,
    check(pre, events, post, ctx) {
      const before = ctx.before, a = ctx.actor, r = N.TETHER_RANGE, g = a.guards;
      const inside = b => foot(b).every(([x, y]) => within(b.guards || g, x, y, r));
      // Its own steps never take it outside its tether. (The pole, used by you, may move it.)
      if (before && before.guards && inside(before) && !inside(a) && ctx.action.a !== 'use') return `it went from ${before.x},${before.y} to ${a.x},${a.y}, outside its tether round ${g}`;
      // It fights you only within its tether: you do not move while exhibits act, so your
      // tile now is your tile at each of its actions this step.
      const [yx, yy] = youIn(post), out = !within(g, yx, yy, r);
      for (const e of events) {
        if (out && e.k === 'attacked' && e.by === a.uid && e.at === 'you') return `it struck at you at ${yx},${yy}, outside its tether round ${g}`;
        if (e.k === 'telegraphed' && e.who === a.uid && e.sp === 'ring') {
          if (out) return `it marked its ring with you at ${yx},${yy}, outside its tether round ${g}`;
          if (!e.tiles.some(t => t[0] === yx && t[1] === yy)) return `it marked its ring with you at ${yx},${yy}, not on it`;
          if (a.acts < N.ROLE_WARDEN_SPECIAL_EVERY) return `it marked its ring at its action ${a.acts} since it woke, before its ${N.ROLE_WARDEN_SPECIAL_EVERY}rd`;
        }
      }
      return null;
    },
  };

  const heal = {
    id: 'warden_heal',
    applies: a => a.arch === 'tethered_warden',
    check(pre, events, post, ctx) {
      const a = ctx.actor, before = ctx.before;
      let at = before ? [before.x, before.y] : [a.x, a.y];
      for (const e of events) {
        if (e.k === 'moved' && e.who === a.uid) at = e.to;
        if (e.k !== 'healed' || e.who !== a.uid || !e.cause || e.cause.k !== 'home') continue;
        if (e.hp !== a.maxHp || e.amount < 1) return `it healed ${e.amount} to ${e.hp} of ${a.maxHp} at home, not to full`;
        if (!a.home || at[0] !== a.home[0] || at[1] !== a.home[1]) return `it healed as if home at ${at}, but its home is ${json(a.home)}`;
      }
      return null;
    },
  };

  const disguise = {
    id: 'mimic_disguise',
    applies: a => a.arch === 'mimic_vitrine',
    check(pre, events, post, ctx) {
      const a = ctx.actor, before = ctx.before, uid = a.uid;
      const was = !!before && isCase(pre, before), is = !a.gone && isCase(post, a);
      if (is && !was) return 'it became a case during the visit';
      if (is) {
        if (a.mode !== 'dormant' || a.pips) return `it is still a case, but ${a.mode} with ${a.pips} pips`;
        const f = caseOf(post, a);
        if (f.x !== a.x || f.y !== a.y || before.x !== a.x || before.y !== a.y) return 'it moved while it was a case';
      }
      if (was && !is && !a.gone && a.mode === 'dormant') return 'its case is gone, but it sleeps on';
      let woke = false;
      for (const e of events) {
        if (e.k === 'pip' && e.who === uid) return `it took a pip (${e.delta}), though it is pipless`;
        if (e.k === 'woke' && e.who === uid) woke = true;
        if (was && !woke && e.k === 'attacked' && (e.at === uid || e.by === uid)) return 'a blow was struck at it or by it while it was a case';
      }
      return null;
    },
  };

  const grip = {
    id: 'mimic_grip',
    applies: a => a.arch === 'mimic_vitrine',
    check(pre, events, post, ctx) {
      const a = ctx.actor, before = ctx.before, uid = a.uid;
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (e.k !== 'status' || !e.cause || e.cause.k !== 'grip' || e.cause.by !== uid) continue;
        if (!e.on || e.id !== 'rooted') return `its grip put on ${e.id} (on ${e.on}), not rooted`;
        if (!before || !isCase(pre, before)) return 'it gripped, though it was not a case when the step began';
        if (before.ax && before.ax.gripped) return 'it gripped a second time';
        if (events.slice(0, i).some(n => n.k === 'noise')) return 'its grip came after the noise of the step';
        if (!events.some(w => w.k === 'woke' && w.who === uid)) return 'it gripped without waking';
        const who = find(post, e.who), s = who && who.statuses.find(q => q.id === 'rooted');
        if (who && !who.gone && who.mode !== 'dormant') {
          if (!s) return `${e.who} is not rooted after the grip`;
          const want = Math.floor(who.next / N.TICKS_PER_TURN) + N.MIMIC_GRIP_TURNS;
          if (s.until !== null && s.until < want) return `${e.who} is rooted until turn ${s.until}, not for its next ${N.MIMIC_GRIP_TURNS} turns (until ${want})`;
        }
      }
      return null;
    },
  };

  const slow = {
    id: 'mimic_slow',
    applies: a => a.arch === 'mimic_vitrine',
    check(pre, events, post, ctx) {
      const a = ctx.actor, before = ctx.before;
      if (!before || a.gone || before.mode === 'dormant' || a.mode === 'dormant' || events.some(e => e.k === 'woke' && e.who === a.uid)) return null;
      const d = a.next - before.next, least = Math.floor(N.COST_WAIT * N.SPEED_SLOW_PCT / 100);
      return d !== 0 && d < least ? `its action took ${d} ticks, less than ${least}` : null;
    },
  };

  return [herald, pipless, tether, heal, disguise, grip, slow];
};
