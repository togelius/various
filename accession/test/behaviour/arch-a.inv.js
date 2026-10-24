// ACCESSION — invariants for W1-ARCH-A's clauses (BUILD.md §5.3, check 1): the darter, the
// splitter and its halves (the wake cause summoned), the mote swarm, and the marble and
// plaster modifiers. tools/invariants.js runs them after every step of every monkey, soak,
// scenario and bot run, so each holds for every actor its `applies` accepts, in any room.
//
// Where a rule acts in the middle of a step, the check rebuilds the world as it was at that
// moment from the step's events (world, below): every actor's tile, from the state before the
// step with its moves, deaths and creations replayed, and the map with the doors opened or
// closed later in the step put back. Only doors change tiles while exhibits act (§4.1); your
// own tile changes only in your action, which comes first.
'use strict';
module.exports = (C) => {
  const { N, Int, Grid, Roles, Options, Archetypes, Registry } = C;
  const tile = t => `${t[0]},${t[1]}`, json = x => JSON.stringify(x);
  const has = (a, mod, state) => (a.mods || []).includes(mod) && !Options.off(state, mod);

  // The world just before events[upto]: {m, pos, at(x, y, except)}. pos maps each actor
  // standing then to {x, y, size}. An actor the step made appears at its creation event (a
  // woke with was null), on the tile it was made on (where its first move started, or where
  // it is now); one made with no such event is counted from the start, which can only make
  // the world more crowded than it was, never less.
  function world(pre, post, events, upto) {
    const before = new Set(pre.actors.map(a => a.uid)), pos = new Map(), madeAt = new Map();
    const byUid = uid => post.actors.find(a => a.uid === uid) || null;
    const madeOn = uid => { const mv = events.find(e => e.k === 'moved' && e.who === uid), a = byUid(uid); return mv ? [mv.from[0], mv.from[1]] : [a.x, a.y]; };
    const put = (uid, t, size) => pos.set(uid, { x: t[0], y: t[1], size: size || 1 });
    for (const a of pre.actors) if (!a.gone) put(a.uid, [a.x, a.y], a.size);
    events.forEach((e, i) => { if (e.k === 'woke' && e.was === null && !before.has(e.who) && !madeAt.has(e.who)) madeAt.set(e.who, i); });
    for (const a of post.actors) if (!before.has(a.uid) && !madeAt.has(a.uid)) put(a.uid, madeOn(a.uid), a.size);
    for (let i = 0; i < upto; i++) {
      const e = events[i];
      if (e.k === 'woke' && madeAt.get(e.who) === i && byUid(e.who)) put(e.who, madeOn(e.who), byUid(e.who).size);
      if (e.k === 'moved' && pos.has(e.who)) { const p = pos.get(e.who); p.x = e.to[0]; p.y = e.to[1]; }
      else if (e.k === 'died') pos.delete(e.who);
    }
    const d = post.dept, m = { w: d.w, h: d.h, tiles: d.tiles.slice(), surfaces: d.surfaces || [] }, done = new Set();
    for (let i = upto; i < events.length; i++) {
      const e = events[i];
      if ((e.k !== 'opened' && e.k !== 'closed') || !Number.isInteger(e.x) || !Number.isInteger(e.y)) continue;
      const key = e.x + ',' + e.y;
      if (done.has(key)) continue;
      done.add(key);
      const now = Grid.ch(d, e.x, e.y), staff = now === 'S' || now === 's' || !!e.staff;
      Grid.set(m, e.x, e.y, e.k === 'opened' ? (staff ? 'S' : '+') : (staff ? 's' : "'"));
    }
    function at(x, y, except) {
      for (const [uid, p] of pos) if (uid !== except && x >= p.x && y >= p.y && x < p.x + p.size && y < p.y + p.size) return uid;
      return null;
    }
    return { m, pos, at };
  }
  // Walking distance from your tile by the exhibits' step rule (AI.field's, §8.2).
  const fromYou = (w, you) => { const dist = Grid.distances(w.m, [[you.x, you.y]], w.m.w * w.m.h, null, 'exhibit'); return (x, y) => dist[y * w.m.w + x]; };
  // A tile beside (x, y) in direction k that a one-tile exhibit could step onto: the step
  // rule allows it, it is not a closed door, and nobody stands there.
  function free(w, x, y, k, self) {
    const nx = x + Grid.DX[k], ny = y + Grid.DY[k];
    return Grid.canStep(w.m, x, y, k, 'exhibit') && !Grid.closedDoor(w.m, nx, ny) && w.at(nx, ny, self) === null ? [nx, ny] : null;
  }

  // "…strikes from beside you for {dmg}, then at once steps back {DARTER_STEP_BACK} tile if it
  // has room." Each melee blow of a darter is followed, in the same action (the blow's tick),
  // by DARTER_STEP_BACK steps, each from where it stood to a tile farther from you by walking
  // distance; fewer only if it was cornered (no free tile beside it farther from you) or the
  // blow ended the visit.
  const darterStepsBack = {
    id: 'darter_steps_back',
    applies: a => a.arch === 'darter',
    check(pre, events, post, ctx) {
      const uid = ctx.uid;
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (e.k !== 'attacked' || e.by !== uid || e.at !== 'you' || !e.how || e.how.kind !== 'melee') continue;
        const backs = [];
        for (let j = i + 1; j < events.length && events[j].tick === e.tick; j++) {
          const f = events[j];
          if (f.k === 'attacked' && f.by === uid) break;
          if (f.k === 'moved' && f.who === uid) backs.push(f);
        }
        if (backs.length > N.DARTER_STEP_BACK) return `stepped back ${backs.length} times after its blow at tick ${e.tick}; it steps back ${N.DARTER_STEP_BACK}`;
        const w = world(pre, post, events, i), you = w.pos.get('you'), me = w.pos.get(uid);
        if (!you || !me) continue;
        const dist = fromYou(w, you);
        // Where it struck from: where its step back starts (the event says), else where the
        // replayed world has it.
        let x = backs.length ? backs[0].from[0] : me.x, y = backs.length ? backs[0].from[1] : me.y;
        for (const f of backs) {
          if (f.from[0] !== x || f.from[1] !== y) return `stepped back from ${tile(f.from)} after its blow at tick ${e.tick}, but its last step back ended at ${x},${y}`;
          if (!(dist(f.to[0], f.to[1]) > dist(x, y))) return `stepped from ${x},${y} to ${tile(f.to)} after its blow at tick ${e.tick}, which is not farther from you`;
          x = f.to[0]; y = f.to[1];
          const p = w.pos.get(uid); p.x = x; p.y = y;
        }
        if (backs.length === N.DARTER_STEP_BACK) continue;
        if (events.some((f, j) => j > i && f.k === 'died' && f.who === 'you' && f.tick === e.tick)) continue;
        // An item used this step (the Pole) may have moved actors without a step, so the
        // replayed world is not to be trusted for room.
        if (events.some(f => f.k === 'used')) continue;
        for (let k = 0; k < 8; k++) {
          const t = free(w, x, y, k, uid);
          if (t && dist(t[0], t[1]) > dist(x, y) && Archetypes.mayStep(post, ctx.actor, t[0], t[1]))
            return `struck you at tick ${e.tick} and did not step back to ${tile(t)}, though that tile was free and farther from you`;
        }
      }
      return null;
    },
  };

  // Speed (§8.1): a darter's and a swarm body's steps cost SPEED_FAST_PCT% of a step ("moves
  // two tiles a turn"), a marble body's SPEED_SLOW_PCT% ("moves at half speed"; the usual, if
  // its archetype is fast), and their blows the usual blow (COST_ATTACK, or COST_ATTACK_HEAVY
  // for a brute), a darter's step back included ("the blow and the step back together cost
  // one blow"): none of these clauses makes a blow fast or slow, and §8.1 says speed is for
  // steps only unless the archetype's own clause says otherwise. So what a blow should cost
  // is taken from the clauses, never from the code's speedApplies; the one case left out is a
  // marble body whose archetype has a speed of its own in the registry (the mimic, slow at
  // everything), whose blows are its archetype's clause's to state. Read from the step's
  // events: each action is the group of its own events at one tick (its moves, blows and
  // doors), and the time to its next action (or to its next tick, after its last) is what
  // that action cost. A step in which some action of it left no event (a wait), it woke, a
  // status touched it, or an item was used (the Pole moves exhibits) shows nothing, and is
  // not checked.
  const speed = {
    id: 'arch_a_speed',
    applies: (a, post) => a.uid !== 'you' && (a.arch === 'darter' || a.arch === 'mote_swarm' || has(a, 'marble', post)),
    check(pre, events, post, ctx) {
      const a = ctx.actor, b = ctx.before, uid = ctx.uid;
      if (!b || events.some(e => e.k === 'used') || b.statuses.length || a.statuses.length) return null;
      if (events.some(e => (e.k === 'status' && e.who === uid) || ((e.k === 'woke' || e.k === 'hunting') && e.who === uid && e.was === 'dormant'))) return null;
      const acts = [];
      for (const e of events) {
        const mine = e.k === 'attacked' ? e.by === uid : (e.k === 'moved' || e.k === 'opened' || e.k === 'closed' || e.k === 'telegraphed' || e.k === 'special') && e.who === uid;
        if (!mine) continue;
        const last = acts[acts.length - 1];
        if (last && last.tick === e.tick) last.kinds.push(e.k); else acts.push({ tick: e.tick, kinds: [e.k] });
      }
      if (acts.length !== a.acts - b.acts) return null;
      const A = Registry.ARCHETYPES[a.arch], fast = !!A && A.speed === 'fast', slow = has(a, 'marble', post);
      const pct = fast && !slow ? N.SPEED_FAST_PCT : slow && !fast ? N.SPEED_SLOW_PCT : 100;
      const step = Int.pct(N.COST_STEP, pct), blow = a.role === 'brute' ? N.COST_ATTACK_HEAVY : N.COST_ATTACK;
      const blowsUsual = a.arch === 'darter' || a.arch === 'mote_swarm' || !(A && A.speed);
      for (let i = 0; i < acts.length; i++) {
        const g = acts[i];
        let want = null, what = null;
        if (g.kinds.length === 1 && g.kinds[0] === 'moved') { want = step; what = 'step'; }
        else if (g.kinds[0] === 'attacked' && blowsUsual && g.kinds.every((k, j) => j === 0 ? true : k === 'moved' && a.arch === 'darter')) { want = blow; what = g.kinds.length > 1 ? 'blow and step back' : 'blow'; }
        if (want === null) continue;
        const next = i + 1 < acts.length ? acts[i + 1].tick : (a.gone || a.mode === 'dormant' ? null : a.next);
        if (next === null) continue;
        if (next - g.tick !== want) return `its ${what} at tick ${g.tick} took ${next - g.tick} ticks; it takes ${want}`;
      }
      return null;
    },
  };

  // "Each hit it survives with 2 or more health splits it into two halves of that health, if
  // there is room beside it; halves split again, up to {SPLIT_MAX} splits deep." Every
  // splitter body is of generation 0 to SPLIT_MAX, and its generation and count of halves
  // grow by one with each of its splits. Each hit on one that leaves it
  // h ≥ 2 health below generation SPLIT_MAX makes, before the next damage of anyone, a half
  // <uid>/<k> (k its count of halves) with max(1, SPLIT_HP_PCT% of h), the body keeping the
  // rest; both are then one generation on, the half hunts as the body does, has its maximum
  // health, and first acts a beat (COST_STEP) after it appears. With no half, there was no free
  // tile beside it. A hit that leaves 1 health, or a body at SPLIT_MAX, makes none. The half is
  // the same exhibit (§8.1, "copies the body's species, numbers, maximum health and speed"):
  // its species, archetype, role, modifiers and their parameters, trigger, group, Acc, Eva,
  // Padding, damage and speed are the body's, none of which changes during a visit; and if the
  // body had seen you before the step and did not wake again in it, the half has seen you too
  // (sawYou is only cleared by a waking), so your next blow at it is no surprise.
  const SAME = ['sp', 'arch', 'role', 'mods', 'modParams', 'trigger', 'group', 'acc', 'eva', 'pad', 'dmin', 'dmax', 'speed'];
  const splits = {
    id: 'splitter_splits',
    applies: a => a.arch === 'splitter',
    check(pre, events, post, ctx) {
      const a = ctx.actor, uid = ctx.uid;
      if (!(Number.isInteger(a.gen) && a.gen >= 0 && a.gen <= N.SPLIT_MAX)) return `is of generation ${a.gen}; a body splits at most ${N.SPLIT_MAX} splits deep`;
      const isHalf = (e, from) => e.k === 'woke' && e.was === null && !!e.cause && e.cause.k === 'summoned' && e.cause.how === 'split' && e.cause.from === from;
      const halves = [];
      events.forEach((e, i) => { if (isHalf(e, uid)) halves.push(i); });
      const b = ctx.before;
      if (b && (a.gen !== b.gen + halves.length || a.kids !== b.kids + halves.length))
        return `its generation went from ${b.gen} to ${a.gen}, and its count of halves from ${b.kids} to ${a.kids}, with ${halves.length} split(s) this step`;
      // Health a body has now is what the split left it, unless something hit or healed it since.
      const hitAfter = (who, from) => events.some((g, j) => j > from && (g.k === 'damaged' || g.k === 'healed') && g.who === who);
      const used = events.some(g => g.k === 'used');
      const was = pre.actors.find(x => x.uid === uid), rewoke = events.some(g => g.k === 'woke' && g.who === uid);
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (e.k !== 'damaged' || e.who !== uid) continue;
        let end = events.length;
        for (let j = i + 1; j < events.length; j++) if (events[j].k === 'damaged') { end = j; break; }
        const h = halves.find(j => j > i && j < end);
        const after = halves.filter(j => j > i).length, gen = a.gen - after, kids = a.kids - after, H = e.hp;
        if (h === undefined) {
          if (H < 2 || gen >= N.SPLIT_MAX || used) continue;
          const w = world(pre, post, events, i), p = w.pos.get(uid);
          if (!p || p.size !== 1) continue;
          for (let k = 0; k < 8; k++) {
            const t = free(w, p.x, p.y, k, uid);
            if (t) return `a hit at tick ${e.tick} left it ${H} health at generation ${gen}, and it did not split, though ${tile(t)} beside it was free`;
          }
          continue;
        }
        const f = events[h], half = post.actors.find(x => x.uid === f.who);
        if (H < 2) return `split at tick ${e.tick} with ${H} health; it needs more than 1 to split`;
        if (gen >= N.SPLIT_MAX) return `split at tick ${e.tick} at generation ${gen}; bodies split at most ${N.SPLIT_MAX} splits deep`;
        if (f.who !== `${uid}/${kids + 1}`) return `its half is ${f.who}; its half number ${kids + 1} is ${uid}/${kids + 1}`;
        if (!half || half.arch !== 'splitter' || half.sp !== a.sp) return `its half ${f.who} is not a splitter of its species`;
        if (f.mode !== 'hunting') return `its half ${f.who} was made ${f.mode}; the hit made it hunt, and its halves hunt too`;
        const share = Math.max(1, Int.pct(H, N.SPLIT_HP_PCT));
        if (!hitAfter(half.uid, h) && half.hp !== share) return `its half ${half.uid} has ${half.hp} health; half of ${H} is ${share}`;
        if (!hitAfter(uid, h) && after === 1 && a.hp !== H - share) return `kept ${a.hp} health after splitting ${H}; it keeps ${H - share}`;
        const ownSplits = events.filter(g => isHalf(g, half.uid)).length;
        if (half.gen - ownSplits !== gen + 1) return `its half ${half.uid} is of generation ${half.gen - ownSplits}; it split at generation ${gen}`;
        if (half.maxHp !== a.maxHp) return `its half ${half.uid} has ${half.maxHp} maximum health; it has ${a.maxHp}`;
        for (const k of SAME) if (json(half[k]) !== json(a[k])) return `its half ${half.uid} has ${k} ${json(half[k])}; the body it came from has ${json(a[k])}`;
        if (was && was.sawYou && !rewoke && !half.sawYou) return `its half ${half.uid} has not seen you, though the body it came from had`;
        const first = events.find((g, j) => j > h && (g.k === 'attacked' ? g.by === half.uid : (g.k === 'moved' || g.k === 'opened') && g.who === half.uid));
        if (first && first.tick < f.tick + N.COST_STEP) return `its half ${half.uid} acted at tick ${first.tick}, sooner than a beat after it appeared at ${f.tick}`;
        if (!first && half.acts === 0 && !half.gone && half.next < f.tick + N.COST_STEP) return `its half ${half.uid} is to act at tick ${half.next}, sooner than a beat after it appeared at ${f.tick}`;
      }
      return null;
    },
  };

  // "Comes as several bodies that each fall to a single hit." Any damage to a body of a swarm
  // leaves it no health, and it is destroyed.
  const swarm = {
    id: 'swarm_single_hit',
    applies: a => a.arch === 'mote_swarm',
    check(pre, events, post, ctx) {
      const hits = events.filter(e => e.k === 'damaged' && e.who === ctx.uid);
      for (const e of hits) if (e.hp !== 0) return `took ${e.amount} damage at tick ${e.tick} and was left ${e.hp} health; any hit destroys a body of a swarm`;
      return hits.length && !ctx.actor.gone ? 'was hit and is still standing' : null;
    },
  };

  // "A cast: it has {PLASTER_HP_PCT}% of the usual health, and when destroyed it crumbles into
  // dust that blocks sight round it for {PLASTER_DUST_TURNS} turns." A cast's maximum health
  // never changes, a half split from one has the cast's, and in a department (where every
  // exhibit's numbers are its role's at the depth, §8.1) it is max(1, PLASTER_HP_PCT% of its
  // role's health). A test room may give a body any health, so there the scenarios check the
  // share. A cast destroyed in the step leaves dust on its tile, PLASTER_DUST_SIZE a side,
  // made by it, lying until the boundary PLASTER_DUST_TURNS turns after the next.
  const plaster = {
    id: 'plaster_cast',
    applies: (a, post) => has(a, 'plaster', post),
    check(pre, events, post, ctx) {
      const a = ctx.actor, b = ctx.before;
      if (b && b.maxHp !== a.maxHp) return `its maximum health went from ${b.maxHp} to ${a.maxHp}`;
      if (!b) {
        const f = events.find(e => e.k === 'woke' && e.was === null && e.who === a.uid);
        const from = f && f.cause && typeof f.cause.from === 'string' ? post.actors.find(x => x.uid === f.cause.from) : null;
        if (from && has(from, 'plaster', post) && from.maxHp !== a.maxHp) return `was split from ${from.uid} with ${a.maxHp} maximum health; the cast has ${from.maxHp}`;
      }
      if (post.dept.rooms && a.role) {
        const want = Math.max(1, Int.pct(Roles.stats(a.role, post.dept.depth).hp, N.PLASTER_HP_PCT));
        if (a.maxHp !== want) return `has ${a.maxHp} maximum health; a cast of a ${a.role} at depth ${post.dept.depth} has ${want}`;
      }
      const died = events.find(e => e.k === 'died' && e.who === a.uid);
      if (died) {
        const until = died.turn + 1 + N.PLASTER_DUST_TURNS;
        if (post.turn < until) {
          const s = (post.dept.surfaces || []).find(x => x.kind === 'dust' && x.by === a.uid);
          if (!s) return `was destroyed at turn ${died.turn} and left no dust`;
          if (s.x !== a.x || s.y !== a.y || s.size !== N.PLASTER_DUST_SIZE || s.until !== until)
            return `left dust at ${s.x},${s.y}, ${s.size} a side, until turn ${s.until}; it falls at ${a.x},${a.y}, ${N.PLASTER_DUST_SIZE} a side, until turn ${until}`;
        }
      }
      return null;
    },
  };

  return [darterStepsBack, speed, splits, swarm, plaster];
};
