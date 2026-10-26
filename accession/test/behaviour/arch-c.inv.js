// ACCESSION — invariants of the herald, the tethered_warden and the mimic_vitrine (BUILD.md
// §5.3 check 1; W1-ARCH-C), checked after every step of every scenario, monkey, soak and bot
// run (tools/invariants.js). Each states one sentence of a Behaviour line, written out again
// here from the clause, not from the rule code:
//   herald: "Each time it wakes, the first time it sees you it calls for a turn, shown, then
//     wakes every sleeping exhibit within 6 tiles of it that can hear, which come to look
//     where you stood";
//   tethered_warden: "Stays within 2 tiles of what it guards; if it hunts you and you are
//     not, it goes back instead of starting a fight, waits there while it sees you, then heals
//     fully and settles … beside you, at most one action in 3 since it woke, it marks the tiles
//     round it for a turn, then strikes everything on them" (hunting takes in searching, §8.2:
//     a ring already marked still strikes; no new blow or ring starts);
//   mimic_vitrine: "Looks like a case … Opened or bashed, it grips you (you cannot move for 2
//     turns) and strikes …; it does everything at half speed. Wakes only when it is opened,
//     bashed, dissolved or struck";
// and, for every exhibit, a pipless one is never woken by a call: a pipless sleeper hears
// nothing (§8.2), so it is not one "that can hear", which is where herald_call's exemption
// for it comes from.
//
// A step can hold several actions (yours, then every exhibit's until your next decision), so
// where a sentence is about one moment in the step (a call going off, a warden going back),
// the check follows the step's events in order from the state before it: each actor's mode and
// tile as the events change them (track, below), so it judges the moment, not the step's end.
'use strict';
module.exports = (C) => {
  const { N, Archetypes, Grid } = C;
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
  // An exhibit sees you (§8.2) when your tile is within SIGHT_EXHIBIT of a tile of it, with a
  // line of sight. The map can change during a step (a door opened, dust settling), so this
  // asks whether it saw you on the map both as the step began and as it ended: only then is
  // it sure it saw you at a moment between.
  const seesOn = (m, b, you) => foot(b).some(([x, y]) => within([x, y], you[0], you[1], N.SIGHT_EXHIBIT) && Grid.los(m, x, y, you[0], you[1]));
  const surelySaw = (pre, post, b, you) => seesOn(pre.dept, b, you) && seesOn(post.dept, b, you);

  // Each actor's mode and tile as a step's events unfold: track(pre) starts from the state
  // before the step; see(e) applies one event (a waking, a change of mode, a step, a death);
  // at(uid) is what it is at that point.
  function track(pre, post) {
    const now = new Map();
    for (const b of pre.actors) now.set(b.uid, { uid: b.uid, arch: b.arch, mods: b.mods, size: b.size || 1, mode: b.mode, x: b.x, y: b.y, gone: !!b.gone });
    const at = uid => {
      if (!now.has(uid)) { const b = find(post, uid); if (!b) return null; now.set(uid, { uid, arch: b.arch, mods: b.mods, size: b.size || 1, mode: b.mode, x: b.x, y: b.y, gone: !!b.gone }); }
      return now.get(uid);
    };
    function see(e) {
      const b = e.who ? at(e.who) : null;
      if (!b) return;
      if (e.k === 'woke') b.mode = e.mode;
      else if (e.k === 'hunting') b.mode = 'hunting';
      else if (e.k === 'lost' || e.k === 'alerted') b.mode = e.to;
      else if (e.k === 'returned') b.mode = e.phase === 'arrived' ? 'reinstalling' : 'dormant';
      else if (e.k === 'moved') { b.x = e.to[0]; b.y = e.to[1]; }
      else if (e.k === 'died') b.gone = true;
    }
    return { at, see };
  }
  // A mimic sleeps pipless by its line ("Wakes only when it is opened, bashed, dissolved or
  // struck"), whatever its rule code says; any other exhibit is pipless if its hooks say so.
  const piplessNow = (state, b) => (b.arch === 'mimic_vitrine' && b.mode === 'dormant') || Archetypes.pipless(state, Object.assign({}, find(state, b.uid) || {}, b));

  const herald = {
    id: 'herald_call',
    applies: a => a.arch === 'herald',
    check(pre, events, post, ctx) {
      const uid = ctx.uid, before = ctx.before, a = ctx.actor;
      // Once per waking, and only on seeing you: a call is marked only if it has not called
      // since it last woke, its record of having called (ax.called) says exactly that, and it
      // marks it from a tile from which it sees you (you do not move while exhibits act).
      let called = !!(before && before.ax && before.ax.called);
      const t = track(pre, post), you = youIn(post);
      for (const e of events) {
        if (e.k === 'woke' && e.who === uid) called = false;
        if (e.k === 'telegraphed' && e.who === uid && e.sp === 'call') {
          if (called) return `it marked a second call in one waking, on turn ${e.turn}`;
          called = true;
          const h = t.at(uid);
          if (!seesOn(pre.dept, h, you) && !seesOn(post.dept, h, you)) return `it marked its call at ${h.x},${h.y}, from where it could not see you at ${you}`;
        }
        t.see(e);
      }
      if (!!(a.ax && a.ax.called) !== called) return `ax.called is ${json(a.ax && a.ax.called)}, but its calls since it last woke say ${called ? 1 : 0}`;
      // Only after its shown turn, only within the shown tiles, only sleepers, awake; and,
      // when it goes off, every sleeper then on the shown tiles that can hear (one that is not
      // pipless, the clause's "that can hear") wakes.
      const tel = before && before.telegraph && before.telegraph.sp === 'call' ? before.telegraph : null;
      const u = track(pre, post);
      for (const e of events) {
        if (e.k === 'special' && e.who === uid && e.sp === 'call' && !e.cancelled) {
          if (!tel) return 'its call went off without having been shown before your decision';
          for (const b of pre.actors.concat(post.actors.filter(q => !find(pre, q.uid)))) {
            const s = u.at(b.uid);
            if (b.uid === 'you' || b.uid === uid || s.gone || s.mode !== 'dormant' || !onTiles(s, tel.tiles) || piplessNow(post, s)) continue;
            return `${b.uid} at ${s.x},${s.y} slept through the call`;
          }
        }
        if (e.k === 'woke' && e.cause && e.cause.k === 'herald' && e.cause.by === uid) {
          if (!tel) return `it woke ${e.who} with no call shown before your decision`;
          const s = u.at(e.who);
          if (!s || s.mode !== 'dormant') return `it woke ${e.who}, which was not asleep`;
          if (!onTiles(s, tel.tiles)) return `it woke ${e.who} at ${s.x},${s.y}, outside the tiles its call showed`;
          if (e.mode !== 'awake') return `${e.who} woke ${e.mode}, not awake`;
        }
        u.see(e);
      }
      return null;
    },
  };

  // A pipless actor (a mimic) is never woken by a call (§8.2).
  const pipless = {
    id: 'call_never_wakes_pipless',
    check(pre, events, post) {
      const t = track(pre, post);
      for (const e of events) {
        if (e.k === 'woke' && e.cause && e.cause.k === 'herald') {
          const s = t.at(e.who);
          if (s && piplessNow(post, s)) return `the call of ${e.cause.by} woke ${e.who}, which is pipless`;
        }
        t.see(e);
      }
      return null;
    },
  };

  const tether = {
    id: 'warden_tether',
    applies: a => a.arch === 'tethered_warden' && !!a.guards,
    check(pre, events, post, ctx) {
      const before = ctx.before, a = ctx.actor, r = N.TETHER_RANGE, g = a.guards, E = N.ROLE_WARDEN_SPECIAL_EVERY;
      const inside = b => foot(b).every(([x, y]) => within(b.guards || g, x, y, r));
      // Its own steps never take it outside its tether. (The pole, used by you, may move it.)
      if (before && before.guards && inside(before) && !inside(a) && ctx.action.a !== 'use') return `it went from ${before.x},${before.y} to ${a.x},${a.y}, outside its tether round ${g}`;
      // It fights you only within its tether: you do not move while exhibits act, so your
      // tile now is your tile at each of its actions this step. Outside it, only a ring it
      // has already shown strikes you (it starts no fight, but what it marked "then strikes
      // everything on" its tiles): the ring it had
      // pending as the step began, which it marked (as the check below holds at every mark)
      // with you within its tether.
      const you = youIn(post), [yx, yy] = you, out = !within(g, yx, yy, r), t = track(pre, post);
      const shown = !!(before && before.telegraph && before.telegraph.sp === 'ring');
      let woke = false, rings = 0;
      for (const e of events) {
        if (e.k === 'woke' && e.who === a.uid) woke = true;
        if (out && e.k === 'attacked' && e.by === a.uid && e.at === 'you') return `it struck at you at ${yx},${yy}, outside its tether round ${g}`;
        if (out && e.k === 'damaged' && e.who === 'you' && e.cause && e.cause.k === 'special' && e.cause.by === a.uid && e.cause.sp === 'ring') {
          if (!shown) return `its ring struck you at ${yx},${yy}, outside its tether round ${g}, but no ring of its was shown as the step began`;
          if (!before.telegraph.tiles.some(q => q[0] === yx && q[1] === yy)) return `its ring struck you at ${yx},${yy}, a tile its shown ring did not mark`;
        }
        if (e.k === 'telegraphed' && e.who === a.uid && e.sp === 'ring') {
          if (out) return `it marked its ring with you at ${yx},${yy}, outside its tether round ${g}`;
          if (!e.tiles.some(q => q[0] === yx && q[1] === yy)) return `it marked its ring with you at ${yx},${yy}, not on it`;
          // At most one action in E since it woke: its first ring at its E-th action or
          // after, each later one at least E actions after the one before. Its record (ax.due,
          // the action at which the next is due) must say so: a mark is its last action in a
          // step (the mark resolves after your next decision), so a.acts is its count at the
          // mark.
          if (++rings > 1) return 'it marked its ring twice in one step';
          const n = a.acts, least = woke || !before || !before.ax || !Number.isInteger(before.ax.due) ? E : before.ax.due;
          if (n < E) return `it marked its ring at its action ${n} since it woke, before its ${E}rd`;
          if (n < least) return `it marked its ring at its action ${n} since it woke, less than ${E} actions after its last ring (due at ${least})`;
          if (!a.ax || a.ax.due !== n + E) return `it marked its ring at its action ${n}, but its next is due at ${json(a.ax && a.ax.due)}, not ${n + E}`;
        }
        // It goes back (lost, tether) only with you outside its tether, and only when it does
        // not see you: while it sees you, it waits at its place instead.
        if (e.k === 'lost' && e.who === a.uid && e.cause && e.cause.k === 'tether') {
          if (!out) return `it went back for its tether with you at ${yx},${yy}, within it`;
          const w = t.at(a.uid);
          if (surelySaw(pre, post, w, you)) return `it went back for its tether from ${w.x},${w.y}, though it could see you at ${yx},${yy}; it should wait there`;
        }
        t.see(e);
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

  // "Wakes only when it is opened, bashed, dissolved or struck": the causes of those.
  const MIMIC_WAKES = ['touch_case', 'dissolved', 'damage'];
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
        if (e.k === 'woke' && e.who === uid) {
          woke = true;
          if (e.was === 'dormant' && !(e.cause && MIMIC_WAKES.includes(e.cause.k))) return `it woke by ${json(e.cause && e.cause.k)}, but it wakes only when opened, bashed, dissolved or struck`;
        }
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
