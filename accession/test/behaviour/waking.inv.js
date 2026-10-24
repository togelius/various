// Waking's invariants (BUILD.md §8.2, §3.4), checked after every step of every scenario,
// monkey, soak and bot run (§5.3, check 1), with at least one for each clause waking's
// registry entries name: the wake clause (its ring and its noise) and the triggers axis,
// tether, ally_hit and awake. Each is a statement the clause makes, checked from the step's
// events and the states either side of it, with the rule worked out here from BUILD.md's
// text rather than taken from the rule code. Two kinds:
//   soundness: what happened was allowed (pips stay 0–2 while asleep; each trigger adds at
//     most once a turn; a ring pip comes from inside your ring; the story matches its
//     event; a pipless exhibit gains nothing; waking is leaving dormant);
//   completeness: what the clause promises happened (asleep inside your ring, a sleeper
//     gains a ring pip at every boundary; hearing a noise, a noise pip; on your axis, an
//     axis pip; near what it guards, its tether pips; an ally of its group struck nearby,
//     its ally_hit pips; and an exhibit that never sleeps is never asleep or going back).
//
// What a turn boundary saw. Every boundary of a step runs after your action, so you stand on
// your tile after the step at each of them, with the ring of that action. The map changes
// during a step one way only (doors open; cases open, break or are revealed; shards fall;
// only your own action closes a door, and it comes before every boundary), so each tile at
// any moment of the step was the tile before the step or the tile after it; and a surface
// laid during a step outlasts it. Two maps bound what any moment saw:
//   open: sight or a step passes a tile if it passed before or after, a door is closed only
//     if it was both, and only the surfaces that lay both before and after count;
//   shut: sight or a step passes a tile only if it passed both before and after, a door is
//     closed if it was either, and every surface that lay before or after counts.
// A soundness check allows what the open map allows; a completeness check asks only for what
// the shut map already promises. A sleeping exhibit does not move, so one asleep when the
// step began stands where it stood until it wakes.
module.exports = (C) => {
  const { N, Grid } = C;
  const exhibit = a => a.uid !== 'you';
  const pipsOf = (events, uid) => events.filter(e => e.k === 'pip' && e.who === uid);
  const square = (x, y, s) => { const out = []; for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) out.push([x + dx, y + dy]); return out; };
  const tilesOf = a => square(a.x, a.y, a.size || 1);

  // The tiles where a's footprint stood when the step's i-th event happened: where it stands
  // after the step, unless it moved later in the step, when it is where its first later step
  // began.
  function where(events, i, a) {
    let later = null;
    for (let j = i + 1; j < events.length && !later; j++) if (events[j].k === 'moved' && events[j].who === a.uid) later = events[j];
    const [x, y] = later ? later.from : [a.x, a.y];
    return square(x, y, a.size || 1);
  }

  // ---- The two maps ----
  const TILE = ch => Grid.TILES[ch] || {};
  // A tile character's part in sight and steps: sight passes, a step passes, a closed door.
  const parts = ch => [TILE(ch).see ? 1 : 0, TILE(ch).walk ? 1 : 0, ch === '+' || ch === 'S' ? 1 : 0];
  function pick(p, q, open) {
    const a = parts(p), b = parts(q);
    const want = open ? [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2])] : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2])];
    const is = c => c[0] === want[0] && c[1] === want[1] && c[2] === want[2];
    return is(b) ? q : is(a) ? p : open ? '.' : '#';
  }
  const sameSurface = (s, t) => s.kind === t.kind && s.x === t.x && s.y === t.y && s.size === t.size && s.until === t.until && s.by === t.by;
  function bound(pre, post, open) {
    const a = pre.dept, b = post.dept, tiles = [];
    for (let y = 0; y < b.h; y++) {
      const p = a.tiles[y], q = b.tiles[y];
      if (p === q) { tiles.push(q); continue; }
      let row = '';
      for (let x = 0; x < b.w; x++) row += p[x] === q[x] ? q[x] : pick(p[x], q[x], open);
      tiles.push(row);
    }
    const sa = a.surfaces || [], sb = b.surfaces || [];
    const surfaces = open ? sb.filter(s => sa.some(t => sameSurface(s, t))) : sb.concat(sa.filter(s => !sb.some(t => sameSurface(s, t))));
    return Object.assign({}, b, { tiles, surfaces });
  }

  // ---- Your ring, from §8.2 ----
  // "Radius: 3 if your last action that cost time was anything but wait, rest, view or sit;
  // otherwise 2. +2 while you stand on a loud floor. Perks and items can shrink it, never
  // below RING_MIN." A boundary runs in a step only if your action cost time, so that action
  // sets the radius. What your kit takes (Kit.ringDelta) is asked of the states the boundary
  // could have seen: your action's flags are set before any boundary, while your kit and
  // what is derived from it are either side of the step's end.
  const STILL = ['wait', 'rest', 'view', 'sit'];
  const FLAGS = ['x', 'y', 'still', 'lastAct', 'seated'];
  function radii(pre, post, action) {
    const base = action && STILL.includes(action.a) ? N.RING_STILL : N.RING_MOVING, you = post.actors[0], out = [];
    const deltas = [C.Kit.ringDelta(pre), C.Kit.ringDelta(post)];
    for (const body of [pre, post]) for (const kit of [pre, post]) {
      const me = Object.assign({}, body.actors[0]);
      for (const f of FLAGS) me[f] = you[f];
      deltas.push(C.Kit.ringDelta(Object.assign({}, body, { actors: [me].concat(body.actors.slice(1)), you: kit.you, items: kit.items })));
    }
    for (const m of [pre.dept, post.dept]) for (const d of deltas) {
      const r = Math.max(N.RING_MIN, base + (TILE(Grid.ch(m, you.x, you.y)).loud ? N.RING_LOUD_FLOOR : 0) + d);
      if (!out.includes(r)) out.push(r);
    }
    return out.sort((a, b) => a - b);
  }

  // What a step's boundaries saw, worked out once a step (pre is a fresh clone each step).
  const RANGE = { soft: N.NOISE_SOFT, loud: N.NOISE_LOUD, crash: N.NOISE_CRASH };
  const steps = new WeakMap();
  function seen(pre, post, action) {
    let S = steps.get(pre);
    if (S) return S;
    const you = post.actors[0], lazy = {}, once = (k, f) => () => (k in lazy ? lazy[k] : (lazy[k] = f()));
    S = { you };
    S.radii = once('radii', () => radii(pre, post, action));
    S.open = once('open', () => bound(pre, post, true));
    S.shut = once('shut', () => bound(pre, post, false));
    // Walking distances from your tile, out one beyond the largest radius.
    const far = () => S.radii()[S.radii().length - 1] + 1;
    S.fromOpen = once('fromOpen', () => Grid.distances(S.open(), [[you.x, you.y]], far()));
    S.fromShut = once('fromShut', () => Grid.distances(S.shut(), [[you.x, you.y]], far()));
    // The walking distances a noise covered (§8.2: a closed door counts NOISE_DOOR extra), on
    // the shut map, so never shorter than it really was.
    const noises = new Map();
    S.noise = (i, e) => {
      if (!noises.has(i)) { const m = S.shut(); noises.set(i, Grid.distances(m, [[e.x, e.y]], RANGE[e.cls], (x, y) => Grid.closedDoor(m, x, y) ? N.NOISE_DOOR : 0)); }
      return noises.get(i);
    };
    steps.set(pre, S);
    return S;
  }

  // Was it asleep when the step began, and pipless neither before nor after it?
  function asleep(pre, post, ctx) {
    const b = ctx.before, a = ctx.actor;
    return !!b && b.mode === 'dormant' && !C.Archetypes.pipless(pre, b) && !(!a.gone && C.Archetypes.pipless(post, a));
  }
  // The index of its first waking or destruction in the step's events, and that event's
  // turn; events.length and Infinity if neither happened.
  function ended(events, uid) {
    for (let i = 0; i < events.length; i++) { const e = events[i]; if ((e.k === 'woke' || e.k === 'died') && e.who === uid) return { i, turn: e.turn }; }
    return { i: events.length, turn: Infinity };
  }
  const gained = (e, uid, k, turn) => e.k === 'pip' && e.who === uid && e.delta > 0 && e.cause && e.cause.k === k && (turn === undefined || e.turn === turn);
  // At every boundary of the step (turns pre.turn + 1 … post.turn) while it slept, it gained a
  // pip for k, unless an earlier check of that boundary (one of `first`) had already woken it.
  // A boundary's checks come before anything else of that turn can wake or destroy it.
  function due(pre, post, events, uid, k, first, why) {
    const end = ended(events, uid).turn;
    for (let t = pre.turn + 1; t <= post.turn && t <= end; t++) {
      if (events.some(e => gained(e, uid, k, t))) continue;
      if (events.some(e => e.k === 'woke' && e.who === uid && e.turn === t && e.cause && first.includes(e.cause.k))) continue;
      return `${why} at the boundary of turn ${t}, and it gained no ${k} pip`;
    }
    return null;
  }

  return [
    {
      // Pips (§8.2): 0 to 2 while it sleeps (the third wakes it), and none once awake.
      id: 'waking.pips_range',
      applies: (a, post) => exhibit(a) && !a.gone,
      check(pre, events, post, ctx) {
        const a = ctx.actor;
        if (!Number.isInteger(a.pips)) return `its pips are ${JSON.stringify(a.pips)}, not a whole number`;
        if (a.mode === 'dormant') return a.pips >= 0 && a.pips < C.N.PIPS_TO_WAKE ? null : `it sleeps with ${a.pips} pips`;
        return a.pips === 0 ? null : `it is ${a.mode} with ${a.pips} pips`;
      },
    },
    {
      // "Each trigger adds at most once per turn" (§8.2).
      id: 'waking.once_a_turn',
      applies: exhibit,
      check(pre, events, post, ctx) {
        const seenKeys = new Set();
        for (const e of pipsOf(events, ctx.uid)) {
          if (e.delta <= 0) continue;
          const key = `${e.cause.k}@${e.turn}`;
          if (seenKeys.has(key)) return `${e.cause.k} added a pip twice on turn ${e.turn}`;
          seenKeys.add(key);
          const b = ctx.before;
          if (b && b.pipTurns && b.pipTurns[e.cause.k] === e.turn) return `${e.cause.k} added a pip on turn ${e.turn}, after one earlier that turn`;
        }
        return null;
      },
    },
    {
      // Your ring (§8.2): a ring pip comes from inside your ring. Its radius is your ring's
      // (worked out above from your action, your floor and your kit), its distance is within
      // it, some tile the exhibit stood on is that far from your tile by walking and in your
      // sight, and none of its tiles was surely nearer and inside.
      id: 'waking.ring_pip',
      applies: exhibit,
      check(pre, events, post, ctx) {
        let S = null;
        for (let i = 0; i < events.length; i++) {
          const e = events[i];
          if (e.k !== 'pip' || e.who !== ctx.uid || !e.cause || e.cause.k !== 'ring') continue;
          S = S || seen(pre, post, ctx.action);
          const { dist, r } = e.cause, you = S.you, tiles = where(events, i, ctx.actor), rs = S.radii();
          if (!rs.includes(r)) return `a ring pip on turn ${e.turn} with radius ${r}, but your ring's radius was ${rs.join(' or ')}`;
          if (!(dist >= 0 && dist <= r)) return `a ring pip at distance ${dist}, outside the radius ${r}`;
          const open = S.open(), shut = S.shut(), lo = S.fromOpen(), hi = S.fromShut();
          const fits = tiles.some(([x, y]) => {
            const near = Grid.reachDist(lo, open, x, y), far = Grid.reachDist(hi, shut, x, y);
            return Grid.hold(open, x, y) && near >= 0 && near <= dist && (far < 0 || far >= dist) && Grid.los(open, you.x, you.y, x, y);
          });
          if (!fits) return `a ring pip on turn ${e.turn} at walking distance ${dist}, but no tile it stood on is that far from your tile ${you.x},${you.y} by walking and in your sight`;
          const nearer = tiles.find(([x, y]) => { const t = Grid.reachDist(hi, shut, x, y); return t >= 0 && t < dist && Grid.hold(shut, x, y) && Grid.los(shut, you.x, you.y, x, y); });
          if (nearer) return `a ring pip on turn ${e.turn} at walking distance ${dist}, but its tile ${nearer[0]},${nearer[1]} was nearer and inside your ring`;
        }
        return null;
      },
    },
    {
      // The wake clause's ring (§8.2): "a sleeping exhibit within that walking distance, with
      // line of sight to you, gains 1 pip a turn". A sleeper with a tile the shut map puts
      // inside your ring (within the smallest radius it could have had, in sight) gains a ring
      // pip at every boundary of the step until it wakes.
      id: 'waking.ring_due',
      applies: exhibit,
      check(pre, events, post, ctx) {
        if (post.turn <= pre.turn || !asleep(pre, post, ctx)) return null;
        const b = ctx.before, S = seen(pre, post, ctx.action), r = S.radii()[0], m = S.shut(), d = S.fromShut(), you = S.you;
        const at = tilesOf(b).find(([x, y]) => { const t = Grid.reachDist(d, m, x, y); return Grid.hold(m, x, y) && t >= 0 && t <= r && Grid.los(m, you.x, you.y, x, y); });
        if (!at) return null;
        return due(pre, post, events, b.uid, 'ring', [], `it slept on ${at[0]},${at[1]}, ${Grid.reachDist(d, m, at[0], at[1])} walking tiles from you and in your sight, inside your ring (radius ${r} or more),`);
      },
    },
    {
      // The wake clause's noise (§8.2): "A sleeping exhibit that hears a noise gains 1 pip; it
      // gains at most 1 pip from noise per turn." A sleeper whose nearest tile is within the
      // noise's class range (soft 3, loud 6, crash 10) of it, by walking distance on the shut
      // map, which did not make the noise itself and has had no noise pip this turn, gains a
      // pip from it before the next noise.
      id: 'waking.noise_due',
      applies: exhibit,
      check(pre, events, post, ctx) {
        if (!asleep(pre, post, ctx)) return null;
        const b = ctx.before, end = ended(events, b.uid).i, tiles = tilesOf(b);
        let S = null;
        for (let i = 0; i < end; i++) {
          const e = events[i];
          if (e.k !== 'noise' || RANGE[e.cls] === undefined || (e.cause && e.cause.by === b.uid)) continue;
          if ((b.pipTurns && b.pipTurns.noise === e.turn) || events.slice(0, i).some(p => gained(p, b.uid, 'noise', e.turn))) continue;
          S = S || seen(pre, post, ctx.action);
          const d = S.noise(i, e), m = S.shut();
          let dist = -1;
          for (const [x, y] of tiles) { const t = Grid.reachDist(d, m, x, y); if (t >= 0 && (dist < 0 || t < dist)) dist = t; }
          if (dist < 0 || dist > RANGE[e.cls]) continue;
          let heard = false;
          for (let j = i + 1; j < events.length && events[j].k !== 'noise' && !heard; j++) heard = gained(events[j], b.uid, 'noise', e.turn);
          if (!heard) return `it slept ${dist} walking tiles from a ${e.cls} noise at ${e.x},${e.y} on turn ${e.turn}, within ${RANGE[e.cls]}, and gained no pip from it`;
        }
        return null;
      },
    },
    {
      // The `axis` trigger: "also gains a pip each turn you stand in its row or column within
      // {AXIS_RANGE} tiles, in its sight". A sleeper with it that has a tile in your row or
      // column within AXIS_RANGE of you (within r: dx² + dy² ≤ r² + r), in sight of you on
      // the shut map, gains an axis pip at every boundary of the step until it wakes, unless
      // that boundary's ring pip woke it first.
      id: 'waking.axis',
      applies: a => exhibit(a) && a.trigger === 'axis',
      check(pre, events, post, ctx) {
        if (post.turn <= pre.turn || !asleep(pre, post, ctx)) return null;
        const b = ctx.before, S = seen(pre, post, ctx.action), you = S.you, m = S.shut();
        const on = tilesOf(b).find(([x, y]) => (x === you.x) !== (y === you.y) && Grid.disc(you.x - x, you.y - y, N.AXIS_RANGE) && Grid.los(m, x, y, you.x, you.y));
        if (!on) return null;
        return due(pre, post, events, b.uid, 'axis', ['ring'], `you stood in the row or column of its tile ${on[0]},${on[1]}, within ${N.AXIS_RANGE} and in its sight,`);
      },
    },
    {
      // The `tether` trigger: "wakes at once when you come within {TETHER_RANGE} tiles of what
      // it guards" (no sight needed). A sleeper with it, while you are within TETHER_RANGE of
      // the tile it guards, gains its tether pips at every boundary of the step until it wakes
      // (so at the first), unless that boundary's ring or axis pip woke it first.
      id: 'waking.tether',
      applies: a => exhibit(a) && a.trigger === 'tether',
      check(pre, events, post, ctx) {
        if (post.turn <= pre.turn || !asleep(pre, post, ctx)) return null;
        const b = ctx.before, g = b.guards, you = post.actors[0];
        if (!Array.isArray(g) || !Grid.disc(you.x - g[0], you.y - g[1], N.TETHER_RANGE)) return null;
        return due(pre, post, events, b.uid, 'tether', ['ring', 'axis'], `you stood within ${N.TETHER_RANGE} of ${g[0]},${g[1]}, which it guards,`);
      },
    },
    {
      // The `ally_hit` trigger: "wakes at once when one of its group within {ALLY_HIT_RANGE}
      // tiles takes damage". When another exhibit of its group takes damage within
      // ALLY_HIT_RANGE of a sleeper with the trigger (between their nearest tiles, the struck
      // one where it stood when hit), the sleeper gains its ally_hit pips straight after,
      // unless an ally_hit pip already came to it this turn.
      id: 'waking.ally_hit',
      applies: a => exhibit(a) && a.trigger === 'ally_hit' && !!a.group,
      check(pre, events, post, ctx) {
        if (!asleep(pre, post, ctx)) return null;
        const b = ctx.before, end = ended(events, b.uid).i, mine = tilesOf(b);
        for (let i = 0; i < end; i++) {
          const e = events[i];
          if (e.k !== 'damaged' || e.who === 'you' || e.who === b.uid) continue;
          const v = post.actors.find(a => a.uid === e.who);
          if (!v || v.group !== b.group) continue;
          if ((b.pipTurns && b.pipTurns.ally_hit === e.turn) || events.slice(0, i).some(p => gained(p, b.uid, 'ally_hit', e.turn))) continue;
          const hit = where(events, i, v);
          if (!mine.some(([x, y]) => hit.some(([u, w]) => Grid.disc(x - u, y - w, N.ALLY_HIT_RANGE)))) continue;
          if (!events.slice(i + 1).some(p => gained(p, b.uid, 'ally_hit', e.turn))) return `it slept within ${N.ALLY_HIT_RANGE} of ${e.who}, of its group, which took damage on turn ${e.turn}, and it gained no ally_hit pip`;
        }
        return null;
      },
    },
    {
      // The `awake` trigger: "It never sleeps." (§8.2: it is never dormant, and never returns
      // to sleep.) An exhibit with it is never dormant, going back to sleep (returning) or
      // settling back in (reinstalling), and no change of mode in the step took it there.
      id: 'waking.awake',
      applies: a => exhibit(a) && a.trigger === 'awake',
      check(pre, events, post, ctx) {
        const a = ctx.actor, SLEEP = ['dormant', 'returning', 'reinstalling'];
        const e = events.find(e => e.who === a.uid && ((e.k === 'lost' && SLEEP.includes(e.to)) || e.k === 'returned' || (e.k === 'woke' && e.was === 'dormant')));
        if (e) return `it never sleeps, but on turn ${e.turn} ${e.k === 'woke' ? 'it woke from sleep' : e.k === 'returned' ? 'it settled back in' : `it went ${e.to}`}`;
        return !a.gone && SLEEP.includes(a.mode) ? `it never sleeps, but it is ${a.mode}` : null;
      },
    },
    {
      // The story (§3.4): an actor's `woke` is its most recent waking, as its last woke event told it.
      id: 'waking.story',
      applies: exhibit,
      check(pre, events, post, ctx) {
        const told = events.filter(e => e.k === 'woke' && e.who === ctx.uid);
        if (!told.length) return null;
        const e = told[told.length - 1], a = ctx.actor;
        if (!a.woke) return `a woke event on turn ${e.turn}, but its story has no waking`;
        if (a.woke.turn !== e.turn || JSON.stringify(a.woke.cause) !== JSON.stringify(e.cause)) return `its story says it woke on turn ${a.woke.turn} for ${JSON.stringify(a.woke.cause)}, its last woke event turn ${e.turn} for ${JSON.stringify(e.cause)}`;
        return null;
      },
    },
    {
      // A pipless exhibit (a mimic in its disguise) never gains a pip (§8.2).
      id: 'waking.pipless',
      applies: exhibit,
      check(pre, events, post, ctx) {
        const b = ctx.before, a = ctx.actor;
        const hidden = (b && C.Archetypes.pipless(pre, b)) || (!a.gone && C.Archetypes.pipless(post, a));
        if (!hidden) return null;
        const gain = pipsOf(events, ctx.uid).find(e => e.delta > 0);
        return gain ? `pipless, it gained a pip (${gain.cause.k}) on turn ${gain.turn}` : null;
      },
    },
    {
      // Waking is leaving dormant (§8.2): a woke event says it was asleep, or was made awake (null).
      id: 'waking.woke_from',
      check(pre, events) {
        const bad = events.find(e => e.k === 'woke' && e.was !== 'dormant' && e.was !== null);
        return bad ? `${bad.who} woke from ${JSON.stringify(bad.was)}, not from sleep` : null;
      },
    },
  ];
};
