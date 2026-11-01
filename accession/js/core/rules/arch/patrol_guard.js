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
//     by it walking its round: from where it stands now and from each tile its round takes it
//     to by then (its actions at or before `turns` turns from now, each at its cost, a door it
//     opens costing an action and then letting sight through), every tile you could stand on
//     within SIGHT_EXHIBIT of its tile there, in line of sight (AI.sees'), but its own tile
//     now. Only while it walks its round (awake, with nothing else to look at): a Wader
//     hunting you, searching, or sent to look at a noise has none. It draws on no stream, and
//     other actors never count. D-LV6's safe zone reads it over a patrol's first
//     SAFE_ZONE_TURNS turns.
'use strict';
(() => {
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

  // ---- Its wake region: its round's sight ----
  // The tiles it acts from over the next `turns` turns, walking its round with nothing in its
  // way, from a copy of the map whose doors it opens as it goes: [{x, y, m}] (m the map then).
  function walk(state, a, turns) {
    const P = posts(a), horizon = state.tick + turns * N.TICKS_PER_TURN;
    const cost = { step: Actors.cost(state, a, N.COST_STEP, 'move'), door: Actors.cost(state, a, N.COST_DOOR, 'act'), wait: Actors.cost(state, a, N.COST_WAIT, 'act') };
    let m = state.dept, x = a.x, y = a.y, i = index(a, P), t = Math.max(a.next, state.tick), still = 0;
    const out = [], fields = new Map();
    const field = k => { if (!fields.has(k)) fields.set(k, AI.field(state, a, P[k], 'onto')); return fields.get(k); };
    while (t <= horizon && still <= P.length) {
      out.push({ x, y, m });
      if (!P.length) break;
      if (P.length > 1 && x === P[i][0] && y === P[i][1]) i = (i + 1) % P.length;
      const f = field(i), here = f[y * m.w + x];
      if (here <= 0) {
        // A post it cannot reach is passed over; its one post reached, it stands there.
        if (here < 0 && P.length > 1) i = (i + 1) % P.length;
        if (here === 0 && P.length === 1) break;
        still++; t += cost.wait; continue;
      }
      still = 0;
      let d = -1;
      for (let k = 0; k < 8 && d < 0; k++) {
        if (!Grid.canStep(m, x, y, k, 'exhibit')) continue;
        const v = f[(y + Grid.DY[k]) * m.w + x + Grid.DX[k]];
        if (v >= 0 && v < here) d = k;
      }
      if (d < 0) break;
      const nx = x + Grid.DX[d], ny = y + Grid.DY[d];
      if (Grid.ch(m, nx, ny) === '+') {
        // A new copy each time, so the tiles it looked from before keep the map they saw.
        m = Object.assign({}, m, { tiles: m.tiles.slice() });
        Grid.set(m, nx, ny, "'");
        t += cost.door;
        continue;
      }
      x = nx; y = ny; t += cost.step;
    }
    return out;
  }
  function wakeRegion(state, a, turns) {
    const m0 = state && state.dept;
    if (!m0 || a.gone || a.mode !== 'awake' || (a.target && !same(a.target, nextPost(a))) || !Number.isInteger(turns) || turns < 0) return [];
    const s = a.size || 1, r = N.SIGHT_EXHIBIT, on = new Uint8Array(m0.w * m0.h), out = [];
    const mine = (x, y) => x >= a.x && y >= a.y && x < a.x + s && y < a.y + s;
    const from = Cases.encased(state, a) ? [{ x: a.x, y: a.y, m: m0 }] : walk(state, a, turns);
    for (const p of from) for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
      const fx = p.x + dx, fy = p.y + dy;
      for (let y = Math.max(0, fy - r); y <= Math.min(m0.h - 1, fy + r); y++) for (let x = Math.max(0, fx - r); x <= Math.min(m0.w - 1, fx + r); x++) {
        const k = y * m0.w + x;
        if (on[k] || !Grid.disc(x - fx, y - fy, r) || mine(x, y) || !Grid.walkable(m0, x, y) || Grid.closedDoor(m0, x, y)) continue;
        if (Grid.los(p.m, fx, fy, x, y)) on[k] = 1;
      }
    }
    for (let k = 0; k < on.length; k++) if (on[k]) out.push([k % m0.w, Int.idiv(k, m0.w)]);
    return out;
  }

  Archetypes.add('patrol_guard', { act, onResolve, wakeRegion });
})();
