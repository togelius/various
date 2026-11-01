// ACCESSION — the patrol_guard archetype's hooks (S.9's Waders; BUILD.md §5.1, §5.3, §5.5, §8.2;
// rules/archetypes.js), owned by MOD-ALARM. Its registry entry is in js/core/reg/mod-alarm.js
// and its sentences in js/core/text/mod-alarm.js; the alarm it raises is the module's,
// js/core/rules/modules/alarm_network.js.
//
// The rule, as its line says it ("Walks its round and strikes from beside you for {dmg}. On
// seeing you it chases you; losing you, it searches, then resumes its round."; it never
// sleeps, its trigger `awake`):
//   - Its round: its posts, route {posts, i} (population places them with no draw: the free
//     tiles nearest its room's corners, §5.5), i the post it walks to next. Awake with nothing
//     to look at, it takes, each action, the first step (in Grid's direction order, N, NE, E,
//     … NW, so it draws on no stream) of a shortest walking path to post i, actors never
//     counting (AI.route); standing on post i, it sets off for the next, round and round. A
//     closed door on the way is opened as that action, as any exhibit opens one. With every
//     such step blocked by another actor it waits, and a post another actor stands on counts
//     as reached once it stands beside it; a post it cannot reach at all it passes over. A
//     Wader whose room gave it no round (route null, which population logs) keeps to its
//     place: its home is its one post.
//   - Sent to look (a noise; §8.2's awake exhibit) it goes there, round other actors, and once
//     there, or once they leave it no step there, it resumes its round from where it stands.
//   - Seeing you, it hunts you as a plodder does (AI.byMode): it strikes from beside you, and
//     walks toward you, or where it last knew you were. When alarm_network is on for it, it
//     first shows the alarm (below).
//   - Having lost you, it searches (§8.2) as any hunter does; its search done, it goes back to
//     its round (alerted, cause round, to look at its next post), not to sleep, since it never
//     sleeps, nor to wander.
//   - The alarm (alarm_network, M4 plan MO8): hunting you, seeing you, with the module on for
//     it and no alarm running or shown (AlarmNetwork.mayShow), it marks its special `alarm` on
//     its own tile, a call shown for a turn, which its next action sets off (onResolve:
//     AlarmNetwork.call, the crash and the wakes; the module's rule `call` then raises the
//     alarm). The mark is called off as any is (§8.1): fixed, no longer hunting, destroyed.
//   - Its wake region (plan A8): the tiles where, standing for `turns` turns, you would be seen
//     by it, never fewer than it could see, whatever stands in its way (D-LV6's safe zone reads
//     it over a patrol's first SAFE_ZONE_TURNS turns, so it must hold every tile it would see):
//     every tile you could stand on (but its own tile now) within SIGHT_EXHIBIT of, and in line
//     of sight from (AI.sees'), a tile it may stand on at one of its actions by then. Walking
//     its round, those are the tiles it walks to as round() takes them, each action at its
//     cost, with the sleepers in its way where they lie (it steps round them as it would), and
//     wherever another patrol walking its round may stand in its way by then, every other
//     shortest step; a door opened on the way lets sight through after. Where that
//     cannot be told (another exhibit awake on no round; a door a patrol may open within the
//     earshot of another exhibit, whose noise would send it to look or stir it), or while it is
//     searching or sent to look at something, they are every tile it has the time to walk to.
//     None while it hunts you: it has found you. It draws on no stream.
//   - Its timeline (Patrol.timeline, for the worst-case runner and LV6): where each patrol
//     walking its round stands at each of its actions, told exactly where it can be (below).
'use strict';
const Patrol = (() => {
  // The shape of the alarm's mark: its own tile (a call marks at least one, §8.1).
  Specials.addShape('alarm', { tiles: (state, a) => Actors.footprint(a) });

  const isTile = t => Array.isArray(t) && t.length === 2 && Number.isInteger(t[0]) && Number.isInteger(t[1]);
  const same = (p, q) => isTile(p) && isTile(q) && p[0] === q[0] && p[1] === q[1];
  // Its posts: its round's, or, with none, its home alone (none at all with no home either).
  function posts(a) {
    const r = a.route;
    if (r && Array.isArray(r.posts) && r.posts.length) return r.posts;
    return isTile(a.home) ? [a.home] : [];
  }
  const index = (a, P) => P.length > 1 && Number.isInteger(a.route.i) && a.route.i >= 0 && a.route.i < P.length ? a.route.i : 0;
  // Its next post, or null.
  const nextPost = a => { const P = posts(a); return P.length ? P[index(a, P)] : null; };
  // On to the post after i, in a round of more than one.
  function onward(a) { const P = posts(a); if (P.length > 1) a.route.i = (index(a, P) + 1) % P.length; }

  // One step in direction d (Step.moveInto: a closed door is opened, and a stays), then the
  // perks you hold see it (AI.afterStep), as every exhibit's step is followed.
  function stepTo(state, a, d, ev) {
    const x = a.x, y = a.y, r = Step.moveInto(state, a, d, ev);
    if (typeof r !== 'number') return AI.wait(state, a, ev);
    if (a.x !== x || a.y !== y) AI.afterStep(state, a, ev);
    return r;
  }

  // Its round: on to the next post once it stands on this one, then the first step of a
  // shortest walk there.
  function round(state, a, ev) {
    const P = posts(a);
    if (!P.length) return AI.wait(state, a, ev);
    if (P.length > 1 && same([a.x, a.y], P[index(a, P)])) onward(a);
    const post = P[index(a, P)], w = AI.route(state, a, post, 'onto');
    if (w.here < 0) { onward(a); return AI.wait(state, a, ev); }
    if (w.arrived) return AI.wait(state, a, ev);
    if (!w.options.length) {
      // Another actor stands on the post, and it stands beside it: as good as there.
      if (Actors.at(state, post[0], post[1], a) && Actors.dist(a, post[0], post[1]) === 1) onward(a);
      return AI.wait(state, a, ev);
    }
    return stepTo(state, a, w.options[0], ev);
  }
  // Sent to look at a tile: there, round other actors; once there, or with no step there, it
  // drops it (its round goes on at its next action).
  function look(state, a, ev) {
    const w = AI.around(state, a, a.target, 'onto');
    if (w.arrived || !w.options.length) { a.target = null; return AI.wait(state, a, ev); }
    return stepTo(state, a, w.options[0], ev);
  }

  // Awake: it looks where it was sent, else walks its round. (In an intact case it only waits.)
  function patrol(state, a, ev) {
    if (Cases.encased(state, a)) return AI.wait(state, a, ev);
    if (a.target && !same(a.target, nextPost(a))) return look(state, a, ev);
    a.target = null;
    return round(state, a, ev);
  }

  // Searching: AI's search (walking to where it last knew you were, then searching there)
  // until it is done, SEARCH_TURNS at that tile; then, never sleeping, back to its round.
  function search(state, a, ev) {
    const w = a.lastKnown && !Cases.encased(state, a) ? AI.route(state, a, a.lastKnown, 'onto') : null;
    if ((w && !w.arrived && w.options.length) || state.turn - a.stim < N.SEARCH_TURNS) return null;
    Wake.setMode(state, a, 'awake', { k: 'round' }, ev, { target: (nextPost(a) || [a.x, a.y]).slice() });
    return AI.wait(state, a, ev);
  }

  // Hunting, seeing you, with the alarm free to be shown: it shows it, on its own tile.
  function showAlarm(state, a, ev) {
    if (!AI.sees(state, a) || !AlarmNetwork.mayShow(state, a)) return null;
    const tiles = Specials.tiles(state, a, 'alarm');
    if (!Specials.canMark(state, a, 'alarm', tiles)) return null;
    return Specials.mark(state, a, 'alarm', tiles, ev);
  }

  function act(state, a, ev) {
    if (a.mode === 'hunting') return showAlarm(state, a, ev);
    if (a.mode === 'searching') return search(state, a, ev);
    if (a.mode === 'awake') return patrol(state, a, ev);
    return null;
  }

  // Its alarm's mark goes off: the call.
  function onResolve(state, a, tel, ev) {
    if (tel && tel.sp === 'alarm') AlarmNetwork.call(state, a, ev);
  }

  // ---- Its wake region: what it could see before it finds you ----
  // A patrol on its round: awake, with nothing to look at but its next post.
  const onRound = b => b.arch === 'patrol_guard' && !b.gone && b.mode === 'awake' && !(b.target && !same(b.target, nextPost(b)));
  const costsOf = (state, b) => ({ step: Actors.cost(state, b, N.COST_STEP, 'move'), door: Actors.cost(state, b, N.COST_DOOR, 'act'), wait: Actors.cost(state, b, N.COST_WAIT, 'act') });

  // Where patrol b, walking its round, may stand at each of its actions up to the tick
  // `horizon`: [{x, y, t, open}] (t the first tick of an action at which it may stand there,
  // open the doors it has opened by then), and the first tick at which it may stand on each
  // tile (`from`: an Int32Array, -1 where never; its own tile now from now) and open each door
  // (`doors`: Map index → tick). Each action, as round() takes it (actors other than those in
  // `fixed` never counting): standing on its post, it heads for the next; a post it cannot
  // reach it passes over, waiting; else the first step, in compass order, that shortens its
  // walk to the post and that no actor in `fixed` stands on, a closed door on the way opened as
  // that action; with no such step it waits, and beside its post with someone in `fixed` on
  // it, heads for the next. Where `loose(k)` says something else may stand on that first
  // step's tile (k its index) at some time by then, it may take any shortest step instead, and
  // beside its post head for the next. A closed door that `pre(k)` says something else may
  // have opened by then it may also step straight through. What it may do from a tile never
  // depends on the tick,
  // so a wait (for something in its way to move) only brings it to the same tiles later: each
  // state (tile, post, doors opened) is kept at the first tick it may be reached, expanded in
  // order of tick. With `loose` and `pre` always true and `fixed` empty, that is every way it
  // could walk its round, whatever stood in its way or opened a door before it.
  function walks(state, b, horizon, fixed, loose, pre) {
    const m0 = state.dept, w = m0.w, P = posts(b), c = costsOf(state, b), out = [], from = new Int32Array(m0.w * m0.h).fill(-1), doors = new Map();
    const fields = new Map(), field = k => { if (!fields.has(k)) fields.set(k, AI.field(state, b, P[k], 'onto')); return fields.get(k); };
    const best = new Map(), queue = [];
    let head = 0;
    const reach = (k, t) => { if (from[k] < 0 || t < from[k]) from[k] = t; };
    const add = (x, y, i, open, t, moved) => {
      if (t > horizon) return;
      if (moved !== null) reach(y * w + x, moved);
      const key = `${x},${y},${i},${open.join(' ')}`;
      if (best.has(key) && best.get(key) <= t) return;
      best.set(key, t);
      let j = queue.length;
      while (j > head && queue[j - 1].t > t) j--;
      queue.splice(j, 0, { x, y, i, open, t, key });
    };
    reach(b.y * w + b.x, state.tick);
    add(b.x, b.y, index(b, P), [], Math.max(b.next, state.tick), null);
    for (; head < queue.length; head++) {
      const { x, y, open, t, key } = queue[head];
      if (best.get(key) < t) continue;
      let i = queue[head].i;
      out.push({ x, y, t, open });
      if (!P.length) continue;
      if (P.length > 1 && x === P[i][0] && y === P[i][1]) i = (i + 1) % P.length;
      const f = field(i), here = f[y * w + x], next = (i + 1) % P.length;
      if (here < 0) { if (P.length > 1) add(x, y, next, open, t + c.wait, null); continue; }
      if (here === 0) continue;
      const m = open.length ? opened(m0, open) : m0, steps = [];
      for (let d = 0; d < 8; d++) {
        if (!Grid.canStep(m, x, y, d, 'exhibit')) continue;
        const k = (y + Grid.DY[d]) * w + x + Grid.DX[d], v = f[k];
        if (v >= 0 && v < here && !fixed[k]) steps.push(d);
      }
      const post = P[i], pk = post[1] * w + post[0], any = steps.length > 0 && loose((y + Grid.DY[steps[0]]) * w + x + Grid.DX[steps[0]]);
      if ((!steps.length || any) && P.length > 1 && Grid.chebyshev(x, y, post[0], post[1]) === 1 && (fixed[pk] || loose(pk))) add(x, y, next, open, t + c.wait, null);
      for (const d of any ? steps : steps.slice(0, 1)) {
        const nx = x + Grid.DX[d], ny = y + Grid.DY[d], k = ny * w + nx;
        if (Grid.ch(m, nx, ny) === '+') {
          if (!doors.has(k) || t < doors.get(k)) doors.set(k, t);
          add(x, y, i, open.concat([k]).sort((p, r) => p - r), t + c.door, null);
          if (pre(k)) add(nx, ny, i, open.concat([k]).sort((p, r) => p - r), t + c.step, t);
        } else add(nx, ny, i, open, t + c.step, t);
      }
    }
    return { out, from, doors };
  }
  // The map with the doors at these indices open, a copy.
  function opened(m, open) {
    const c = Object.assign({}, m, { tiles: m.tiles.slice() });
    for (const k of open) Grid.set(c, k % m.w, Int.idiv(k, m.w), "'");
    return c;
  }
  // Every tile b could stand on at its actions up to `horizon`, whatever it does: within the
  // steps it has time for of where it stands now, at its quickest (no status slowing it), as
  // [{x, y, t: null, open: every ordinary door}].
  function anywhere(state, b, horizon) {
    const m0 = state.dept, c = costsOf(state, Object.assign({}, b, { statuses: [] }));
    const n = Int.idiv(horizon - Math.max(b.next, state.tick), Math.max(1, Math.min(c.step, c.door, c.wait)));
    const dist = n < 0 ? null : Grid.distances(m0, [[b.x, b.y]], n, null, 'exhibit'), open = [], out = [];
    for (let k = 0; k < m0.w * m0.h; k++) if (Grid.ch(m0, k % m0.w, Int.idiv(k, m0.w)) === '+') open.push(k);
    if (dist) for (let k = 0; k < dist.length; k++) if (dist[k] >= 0) out.push({ x: k % m0.w, y: Int.idiv(k, m0.w), t: null, open });
    return out;
  }
  // Does the soft noise of a door opened at index k reach an exhibit other than its opener?
  function heard(state, k, by) {
    const m = state.dept, d = Noise.reach(m, k % m.w, Int.idiv(k, m.w), N.NOISE_SOFT);
    for (let i = 1; i < state.actors.length; i++) {
      const o = state.actors[i];
      if (o === by || o.gone || Archetypes.pipless(state, o)) continue;
      for (const [x, y] of Actors.footprint(o)) { const r = Grid.reachDist(d, m, x, y); if (r >= 0 && r <= N.NOISE_SOFT) return true; }
    }
    return false;
  }
  // Where a may stand at its actions over the next `turns` turns, before it finds you (you
  // stand still, unseen): walking its round, with the sleepers (and any exhibit in an intact
  // case, which only waits) where they lie, and, where another patrol walking its round may
  // stand in its way by then, any other shortest step. Where that cannot be told (an exhibit
  // awake but on no round; a door a patrol may open within the earshot of another exhibit,
  // whose noise would send it to look or stir it; a itself searching or sent to look at
  // something), anywhere it has the time to walk to.
  function stands(state, a, turns) {
    const m0 = state.dept, horizon = state.tick + turns * N.TICKS_PER_TURN;
    if (Cases.encased(state, a)) return [{ x: a.x, y: a.y, t: state.tick, open: [] }];
    if (!onRound(a)) return anywhere(state, a, horizon);
    const fixed = new Uint8Array(m0.w * m0.h), movers = [];
    for (let i = 1; i < state.actors.length; i++) {
      const o = state.actors[i];
      if (o === a || o.gone) continue;
      if (o.mode === 'dormant' || Cases.encased(state, o)) { for (const [x, y] of Actors.footprint(o)) if (Grid.inside(m0, x, y)) fixed[y * m0.w + x] = 1; }
      else if (onRound(o)) movers.push(o);
      else return anywhere(state, a, horizon);
    }
    const none = new Uint8Array(m0.w * m0.h), yes = () => true, theirs = movers.map(o => ({ o, w: walks(state, o, horizon, none, yes, yes) }));
    const own = walks(state, a, horizon, fixed, k => theirs.some(({ w }) => w.from[k] >= 0), k => theirs.some(({ w }) => w.doors.has(k)));
    for (const { o, w } of theirs.concat([{ o: a, w: own }])) for (const k of w.doors.keys()) if (heard(state, k, o)) return anywhere(state, a, horizon);
    // The doors another patrol may open by then let sight through too.
    const also = [];
    for (const { w } of theirs) for (const k of w.doors.keys()) if (!also.includes(k)) also.push(k);
    return also.length ? own.out.map(p => Object.assign({}, p, { open: p.open.concat(also.filter(k => !p.open.includes(k))).sort((u, v) => u - v) })) : own.out;
  }
  // Its wake region (plan A8): every tile you could stand on (walkable, not a closed door, not
  // its own tile now) within SIGHT_EXHIBIT of a tile it may stand on at one of its actions
  // over the next `turns` turns (stands), in line of sight from it then (through the doors
  // opened by then; a surface, which only ever hides you, never counted). None while it hunts
  // you: it has found you. It draws on no stream.
  function wakeRegion(state, a, turns) {
    const m0 = state && state.dept;
    if (!m0 || a.gone || a.mode === 'hunting' || a.mode === 'dormant' || !Number.isInteger(turns) || turns < 0) return [];
    const s = a.size || 1, r = N.SIGHT_EXHIBIT, on = new Uint8Array(m0.w * m0.h), out = [], maps = new Map(), done = new Set();
    const bare = Object.assign({}, m0, { surfaces: [] });
    const mapOf = open => { const key = open.join(' '); if (!maps.has(key)) maps.set(key, open.length ? opened(bare, open) : bare); return maps.get(key); };
    const mine = (x, y) => x >= a.x && y >= a.y && x < a.x + s && y < a.y + s;
    for (const p of stands(state, a, turns)) {
      const key = `${p.x},${p.y},${p.open.join(' ')}`;
      if (done.has(key)) continue;
      done.add(key);
      const m = mapOf(p.open);
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
        const fx = p.x + dx, fy = p.y + dy;
        for (let y = Math.max(0, fy - r); y <= Math.min(m0.h - 1, fy + r); y++) for (let x = Math.max(0, fx - r); x <= Math.min(m0.w - 1, fx + r); x++) {
          const k = y * m0.w + x;
          if (on[k] || !Grid.disc(x - fx, y - fy, r) || mine(x, y) || !Grid.walkable(m0, x, y) || Grid.closedDoor(m0, x, y)) continue;
          if (Grid.los(m, fx, fy, x, y)) on[k] = 1;
        }
      }
    }
    for (let k = 0; k < on.length; k++) if (on[k]) out.push([k % m0.w, Int.idiv(k, m0.w)]);
    return out;
  }

  // ---- Its timeline: where it stands at each of its actions, told exactly ----
  // Patrol.timeline(state, turns) → null, or [{uid, at: [{x, y, t}]}], one per patrol walking
  // its round (onRound, not in a case), in spawn order: the tile each stands on at each of its
  // actions over the next `turns` turns (t the action's tick, when it looks for you, AI.look,
  // before it moves), you standing where it never sees you. It is round() taken exactly, every
  // patrol at once in the scheduler's order (the smallest next tick, ties in spawn order):
  // each action, standing on its post it sets off for the next; a post it cannot reach it
  // passes over, waiting; else the first step, in compass order, of a shortest walk to its
  // post that no other actor stands on (the sleepers and the encased where they lie, the
  // other patrols where they stand then), a closed door on the way opened as that action and
  // left open; with no such step it waits, and beside its post with another actor on it,
  // heads for the next. A patrol with more than one post that waits STUCK_ACTIONS of its
  // actions in a row with its way blocked only by exhibits that stand still (asleep or in a
  // case), never by another patrol, is stuck: nothing will move out of its way, so it would
  // wait there for good; its record then carries stuck: {post}, the post it was walking to.
  // (One waiting behind another patrol is not stuck: it moves once the other does.) null
  // where that cannot be told: another exhibit awake on no round (where it goes is its own),
  // or a door a patrol opens within the earshot of another exhibit (its noise would send it to
  // look or stir it). It draws on no stream and changes
  // nothing; one state's timeline is worked out once for the longest `turns` asked of it, and
  // shared by every reader of that state (the runner and LV6 ask for the same patrols).
  // More waits in a row than any patrol that blocks another could cause by its own steps and
  // doors (each patrol's wait for the one ahead lasts an action or two).
  const STUCK_ACTIONS = 8;
  const lines = new WeakMap();
  function fingerprint(state) {
    let f = `${state.tick}|${state.dept.tiles.join('')}`;
    for (const o of state.actors) f += `|${o.uid},${o.x},${o.y},${o.mode},${o.gone ? 1 : 0},${o.next},${o.arch === 'patrol_guard' && o.route ? JSON.stringify(o.route) : '-'}`;
    return f;
  }
  function timeline(state, turns) {
    const m0 = state && state.dept;
    if (!m0 || !Array.isArray(state.actors) || !Number.isInteger(turns) || turns < 0) return null;
    const horizon = state.tick + turns * N.TICKS_PER_TURN, fp = fingerprint(state), kept = lines.get(state);
    let got = kept && kept.fp === fp && kept.horizon >= horizon ? kept : null;
    if (!got) { got = { fp, horizon, all: walkAll(state, horizon) }; lines.set(state, got); }
    if (!got.all) return null;
    return got.all.map(p => ({ uid: p.uid, at: p.at.filter(s => s.t <= horizon), stuck: p.stuck && p.stuck.t <= horizon ? { post: p.stuck.post } : null }));
  }
  function walkAll(state, horizon) {
    const m0 = state.dept, w = m0.w, fixed = new Uint8Array(m0.w * m0.h), sims = [];
    for (let i = 1; i < state.actors.length; i++) {
      const o = state.actors[i];
      if (o.gone) continue;
      if (o.mode === 'dormant' || Cases.encased(state, o)) { for (const [x, y] of Actors.footprint(o)) if (Grid.inside(m0, x, y)) fixed[y * w + x] = 1; continue; }
      if (!onRound(o)) return null;
      const P = posts(o);
      sims.push({ a: o, uid: o.uid, x: o.x, y: o.y, P, i: index(o, P), t: Math.max(o.next, state.tick), c: costsOf(state, o), fields: new Map(), at: [], still: 0, stuck: null });
    }
    const open = [];
    let m = m0;
    // A post's walking field (AI.field, actors never counting), worked out once: one for every
    // one-tile patrol not on a plinth, whose field it is the same for.
    const shared = new Map();
    const field = (p, k) => {
      if (p.fields.has(k)) return p.fields.get(k);
      const key = `${p.P[k][0]},${p.P[k][1]}`, alike = (p.a.size || 1) === 1 && Grid.ch(m0, p.a.x, p.a.y) === '.';
      const f = alike && shared.has(key) ? shared.get(key) : AI.field(state, p.a, p.P[k], 'onto');
      if (alike) shared.set(key, f);
      p.fields.set(k, f);
      return f;
    };
    const taken = (p, x, y) => fixed[y * w + x] === 1 || sims.some(q => q !== p && q.x === x && q.y === y);
    for (;;) {
      let p = null;
      for (const q of sims) if (q.t <= horizon && (!p || q.t < p.t)) p = q;
      if (!p) break;
      p.at.push({ x: p.x, y: p.y, t: p.t });
      const P = p.P, was = [p.x, p.y, p.i];
      p.walled = false;
      act1(p);
      p.still = p.walled && p.x === was[0] && p.y === was[1] && p.i === was[2] ? p.still + 1 : 0;
      if (p.still === STUCK_ACTIONS && P.length > 1 && !p.stuck) p.stuck = { post: p.i, t: p.t };
      if (p.heard) return null;
    }
    return sims.map(p => ({ uid: p.uid, at: p.at, stuck: p.stuck }));
    // One action of patrol p, as round() takes it.
    function act1(p) {
      const P = p.P;
      if (!P.length) { p.t += p.c.wait; return; }
      if (P.length > 1 && p.x === P[p.i][0] && p.y === P[p.i][1]) p.i = (p.i + 1) % P.length;
      const post = P[p.i], f = field(p, p.i), here = f[p.y * w + p.x];
      if (here < 0) { if (P.length > 1) p.i = (p.i + 1) % P.length; p.t += p.c.wait; return; }
      if (here === 0) { p.t += p.c.wait; return; }
      let d0 = -1, patrol = false;
      for (let d = 0; d < 8 && d0 < 0; d++) {
        if (!Grid.canStep(m, p.x, p.y, d, 'exhibit')) continue;
        const nx = p.x + Grid.DX[d], ny = p.y + Grid.DY[d], v = f[ny * w + nx];
        if (v < 0 || v >= here || !Archetypes.mayStep(state, p.a, nx, ny)) continue;
        if (!taken(p, nx, ny)) d0 = d;
        else if (fixed[ny * w + nx] !== 1) patrol = true;
      }
      if (d0 < 0) {
        p.walled = !patrol;
        if (P.length > 1 && Grid.chebyshev(p.x, p.y, post[0], post[1]) === 1 && taken(p, post[0], post[1])) p.i = (p.i + 1) % P.length;
        p.t += p.c.wait;
        return;
      }
      const nx = p.x + Grid.DX[d0], ny = p.y + Grid.DY[d0], k = ny * w + nx;
      if (Grid.ch(m, nx, ny) === '+') {
        if (heard(state, k, p.a)) { p.heard = true; return; }
        open.push(k);
        m = opened(m0, open);
        p.t += p.c.door;
        return;
      }
      p.x = nx; p.y = ny; p.t += p.c.step;
    }
  }

  Archetypes.add('patrol_guard', { act, onResolve, wakeRegion });
  return { timeline };
})();
