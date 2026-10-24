// Waking's invariants (BUILD.md §8.2, §3.4), checked after every step of every scenario,
// monkey, soak and bot run (§5.3, check 1). Each is a statement the wake clause or a
// trigger's clause makes, checked from the step's events and the states either side of it.
module.exports = (C) => {
  const exhibit = a => a.uid !== 'you';
  const pipsOf = (events, uid) => events.filter(e => e.k === 'pip' && e.who === uid);

  // The tiles where a's footprint stood when its i-th event of the step happened: a sleeping
  // exhibit does not move, so it is where it stands after the step unless it moved later in
  // the step (it woke, and acted before your next decision), when it is where its first later
  // step began.
  function where(events, i, a) {
    const later = events.slice(i + 1).find(e => e.k === 'moved' && e.who === a.uid);
    const [x, y] = later ? later.from : [a.x, a.y], s = a.size || 1, out = [];
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) out.push([x + dx, y + dy]);
    return out;
  }
  // The map as every boundary of the step saw it, at least: the tiles after the step (a tile
  // only ever becomes easier to see through during a step: doors open, cases open or break,
  // shards fall), and only the surfaces that lay both before and after it (one laid during
  // the step, after the boundary, must not count against a pip given before it was laid).
  function sightMap(pre, post) {
    const same = (s, t) => s.kind === t.kind && s.x === t.x && s.y === t.y && s.until === t.until && s.by === t.by;
    const both = (post.dept.surfaces || []).filter(s => (pre.dept.surfaces || []).some(t => same(s, t)));
    return Object.assign({}, post.dept, { surfaces: both });
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
        const seen = new Set();
        for (const e of pipsOf(events, ctx.uid)) {
          if (e.delta <= 0) continue;
          const key = `${e.cause.k}@${e.turn}`;
          if (seen.has(key)) return `${e.cause.k} added a pip twice on turn ${e.turn}`;
          seen.add(key);
          const b = ctx.before;
          if (b && b.pipTurns && b.pipTurns[e.cause.k] === e.turn) return `${e.cause.k} added a pip on turn ${e.turn}, after one earlier that turn`;
        }
        return null;
      },
    },
    {
      // Your ring (§8.2): a ring pip comes from within its radius, by walking distance, and
      // with line of sight from your tile at the boundary to a tile the exhibit stands on.
      id: 'waking.ring_pip',
      applies: exhibit,
      check(pre, events, post, ctx) {
        const you = post.actors[0];
        let m = null;
        for (let i = 0; i < events.length; i++) {
          const e = events[i];
          if (e.k !== 'pip' || e.who !== ctx.uid || !e.cause || e.cause.k !== 'ring') continue;
          if (!(e.cause.dist >= 0 && e.cause.dist <= e.cause.r)) return `a ring pip at distance ${e.cause.dist}, outside the radius ${e.cause.r}`;
          m = m || sightMap(pre, post);
          if (!where(events, i, ctx.actor).some(([x, y]) => C.Grid.los(m, you.x, you.y, x, y))) return `a ring pip on turn ${e.turn} with no line of sight from your tile ${you.x},${you.y}`;
        }
        return null;
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
