// ACCESSION — the clock's rules (BUILD.md §8.4), owned by W1-CLOCK: turn boundary step 6
// (the count, the bell, the night watch, the Night Watchman's entry and return, the
// night-watch bells) and leaving by an exit door. The clock's reads are in clock.js (Clock);
// the Watchman's own behaviour is in rules/arch/night_watchman.js.
//
// Nothing here draws from a random stream: who a night-watch bell wakes and where the
// Watchman comes in follow from walking distance, with ties broken by spawn order and by
// row-major order. The boundary calls the other functions through the namespace, so a test
// can wrap them.
'use strict';
const ClockRules = (() => {
  const isWatchman = a => !a.gone && a.arch === 'night_watchman';
  // Is a Night Watchman in the department now?
  const watchmanAlive = state => state.actors.some(isWatchman);

  // Turn boundary step 6 (§8.1, §8.4), at every boundary while no Centrepiece hall is sealed
  // (a sealed hall stops the count, the night-watch bells and the Watchman's return; M3
  // never seals, M4 does). In order:
  //   1. the count goes up by one;
  //   2. at count B, the bell (stage 1): pips stop fading and you heal at half the rate, from
  //      the next boundary on, since regeneration (step 3) and pip decay (step 5) have
  //      already run at this one;
  //   3. at count B + G, the night watch (stage 2): you stop healing, from the next boundary;
  //   4. in the night watch, every NIGHT_WAKE_EVERY counts after it began (not at its start),
  //      a night-watch bell: the NIGHT_WAKE_COUNT sleeping exhibits nearest you wake hunting
  //      you (nearestSleepers). The bell is not a noise: it wakes them directly;
  //   5. in the night watch, a Night Watchman comes in when none is in the department and
  //      either none has come yet or one fell WATCHMAN_RETURN counts ago (spawnWatchman).
  // Each stage is told by a stage event, with the count, B and G in its cause.
  function boundary(state, ev) {
    const c = state.dept && state.dept.clock;
    if (!c || Clock.sealed(state)) return;
    c.count++;
    const cause = () => ({ k: 'clock', count: c.count, B: c.B, G: c.G });
    if (c.stage === 0 && c.count >= c.B) { c.stage = 1; Causes.emit(state, ev, 'stage', { stage: 'bell' }, cause()); }
    if (c.stage === 1 && c.count >= c.B + c.G) { c.stage = 2; Causes.emit(state, ev, 'stage', { stage: 'night_watch' }, cause()); }
    if (c.stage !== 2) return;
    if (c.count >= Clock.nextNightBell(c)) nightBell(state, c, cause(), ev);
    const due = c.watch.back === null ? c.watch.k === 0 : c.count >= c.watch.back;
    if (due && !watchmanAlive(state)) ClockRules.spawnWatchman(state, ev);
  }

  // A night-watch bell: the stage event names the exhibits it wakes, then each wakes hunting
  // you, nearest first, with its walking distance in the cause (§8.4). nearestSleepers leaves
  // out exactly the exhibits Wake.wake would refuse, so every one it names wakes.
  function nightBell(state, c, cause, ev) {
    c.nightBells++;
    const n = c.nightBells, you = state.actors[0], list = ClockRules.nearestSleepers(state, N.NIGHT_WAKE_COUNT);
    Causes.emit(state, ev, 'stage', { stage: 'night_bell', n, woke: list.map(r => r.a.uid) }, cause);
    for (const r of list) {
      if (!Wake.wake(state, r.a, 'hunting', { k: 'night_bell', n, dist: r.dist }, ev, { lastKnown: [you.x, you.y] })) {
        throw new Error(`ClockRules: the night-watch bell named ${r.a.uid}, which would not wake`);
      }
    }
  }

  // The n sleeping exhibits nearest you by walking distance (§8.2's, from your tile: 8-way
  // steps with the corner rule, staff doors counting as doors, actors never in the way, and
  // to a tile no one can step onto, 1 + its nearest neighbour one can; for a 2×2 body its
  // nearest tile), as [{a, dist}], nearest first, ties in spawn order. A night-watch bell
  // wakes only sleepers it can reach: it leaves out exhibits in an intact case (Cases.encased),
  // pipless ones (a mimic in its disguise) and those no walk from you reaches.
  function nearestSleepers(state, n) {
    const m = state.dept, you = state.actors[0], dist = Grid.distances(m, [[you.x, you.y]], m.w * m.h);
    const found = [];
    for (let i = 1; i < state.actors.length; i++) {
      const a = state.actors[i];
      if (a.gone || a.mode !== 'dormant' || Cases.encased(state, a) || Archetypes.pipless(state, a)) continue;
      let best = -1;
      for (const [x, y] of Actors.footprint(a)) { const d = Grid.reachDist(dist, m, x, y); if (d >= 0 && (best < 0 || d < best)) best = d; }
      if (best >= 0) found.push({ a, dist: best, i });
    }
    found.sort((p, q) => (p.dist - q.dist) || (p.i - q.i));
    return found.slice(0, Math.max(0, n)).map(r => ({ a: r.a, dist: r.dist }));
  }

  // Where a Night Watchman comes in: the entrance, or if someone stands there, the free tile
  // nearest it by an exhibit's walking distance (ties row-major); null if there is no
  // entrance or no free tile. Free: an exhibit could step onto it and stand there, it is not
  // a closed door (a step into one only opens it, so no one ever stands on one), and no
  // actor is on it.
  function entryTile(state) {
    const m = state.dept, e = m.entrance;
    if (!e) return null;
    const free = (x, y) => Grid.walkable(m, x, y, 'exhibit') && !Grid.closedDoor(m, x, y) && !Actors.at(state, x, y);
    if (free(e[0], e[1])) return [e[0], e[1]];
    const d = Grid.distances(m, [[e[0], e[1]]], m.w * m.h, null, 'exhibit');
    let best = null, bd = -1;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const v = d[y * m.w + x];
      if (v > 0 && (bd < 0 || v < bd) && free(x, y)) { best = [x, y]; bd = v; }
    }
    return best;
  }

  // A Night Watchman comes in (§8.4) and is returned, or null where there is no clock, no
  // entrance or no free tile. It is the shared species night_watchman (content/watch.js),
  // with the warden curve's numbers at the department's depth, uid <acc>.<depth>.watch.<k>
  // for the k-th to come (§3.2), at entryTile, with no home (it never goes back). It is made
  // hunting, its story starting with the night watch (Wake.created): it hunts you from the
  // start and is never caught by surprise, and it first acts one action after it comes in,
  // never in the instant it appears (§8.1). Events: entered {who, at} with cause
  // night_watch {n, count, near?} (near: true when someone stood on the entrance, so it came
  // in on the tile nearest it), then its creation woke. A Watchman the visit removes by its uid
  // (options.without, §3.6) is made and at once marked gone, with no event, so it never
  // comes, nor does any after it, and every actor made later keeps its place in the list.
  function spawnWatchman(state, ev) {
    const m = state.dept, c = m.clock, at = c ? entryTile(state) : null;
    if (!at) return null;
    const sp = Packs.shared('night_watchman'), k = c.watch.k + 1, st = Roles.stats(sp.role, m.depth);
    const a = Actors.spawn(state, Object.assign({}, st, {
      uid: `${m.acc}.${m.depth}.watch.${k}`, sp: sp.id, arch: sp.archetype, role: sp.role, mods: (sp.modifiers || []).slice(), modParams: {},
      trigger: sp.trigger || null, group: null, size: 1, x: at[0], y: at[1], maxHp: st.hp, mode: 'hunting', home: null, next: state.tick,
    }));
    c.watch.k = k;
    c.watch.back = null;
    if ((state.options.without || []).includes(a.uid)) { a.gone = 1; return a; }
    const cause = { k: 'night_watch', n: k, count: c.count };
    if (at[0] !== m.entrance[0] || at[1] !== m.entrance[1]) cause.near = true;
    Causes.emit(state, ev, 'entered', { who: a.uid, at: [a.x, a.y] }, cause);
    Wake.created(state, a, 'night_watch', { n: k }, ev);
    return a;
  }

  // A Night Watchman was destroyed (its archetype's onDied): the next comes WATCHMAN_RETURN
  // clock counts from now (§8.4), which is WATCHMAN_RETURN turns while no hall is sealed.
  function fell(state, a, ev) {
    const c = state.dept && state.dept.clock;
    if (c) c.watch.back = c.count + N.WATCHMAN_RETURN;
  }

  // leave(i) (§4.2, §8.4): through exit door i (dept.exits[i]), legal only while you stand on
  // it, at any time. It costs no time and ends the visit (state.over, k 'left'), with a left
  // event that names the door and the clock's stage. A door that does not exist is refused
  // (no_exit), and so is one you are not standing on (not_on_exit); a refusal changes nothing.
  const exitsOf = state => (state.dept && state.dept.exits) || [];
  Actions.define('leave', {
    legal(state) {
      const you = state.actors[0], ex = exitsOf(state), out = [];
      for (let i = 0; i < ex.length; i++) if (ex[i][0] === you.x && ex[i][1] === you.y) out.push({ a: 'leave', i });
      return out;
    },
    candidates: state => exitsOf(state).map((e, i) => ({ a: 'leave', i })).concat([{ a: 'leave', i: -1 }, { a: 'leave', i: exitsOf(state).length }, { a: 'leave' }]),
    apply(state, action, ev) {
      const ex = exitsOf(state), i = action.i, you = state.actors[0];
      if (!Number.isInteger(i) || i < 0 || i >= ex.length) return 'no_exit';
      if (ex[i][0] !== you.x || ex[i][1] !== you.y) return 'not_on_exit';
      const cause = { k: 'leave', door: i, stage: Clock.stage(state) };
      Causes.emit(state, ev, 'left', { who: 'you', door: i, at: [you.x, you.y] }, cause);
      state.over = { k: 'left', turn: state.turn, by: null, door: i, cause: Causes.copy(cause, 'over.cause') };
      return 0;
    },
  });

  return { boundary, nearestSleepers, entryTile, spawnWatchman, fell, watchmanAlive };
})();
