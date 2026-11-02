// ACCESSION — M4's other layout validators (design/layout.md §9.1; BUILD.md §5.5; M4 plan
// D-VALIDATORS, D1.12, D2.11, D3.9). Each registers with Populate.addValidator from here, after
// LV11 (load order), so a department one rejects is a failed layout attempt, which reseeds. Each
// judges the department as made (Populate.asMade: every module on, nothing left out), so neither
// a switch nor `without` changes which attempt is taken (DE13). None draws or changes anything.
//
// LV7 ('lv7'), no unrewarded long dead end: on the room graph (each room one node, each tile of
// an opening between rooms, the entrance and the exits one node of its own; joined where you
// could step from one to the other, staff doors left out), a dead-end branch is what a single
// node, its junction, cuts off from the entrance and every exit. One that reaches
// DEAD_END_REWARD walking tiles or more beyond its junction must hold a reward: an item on its
// floor or in a case of it (a Restoration kit is a Highlight), or the Centrepiece hall, the set
// piece's room, counted so whether or not its core is placed yet. (No lure exists in M4.) At
// Cabinet size it is vacuous: the three departments' only dead end is the Centrepiece hall (the
// layout sweep's --validators measures them), so it is held by planted faults.
//
// LV13 for the chime ('lv13'): a station's line, at its reach (HourlyDemonstration.reach, the
// widest the line can take at any chime), with the lines of its room's other stations (which
// strike on the same turn), that cuts the entrance from every exit must leave a window: its
// period less the most turns running that the best way through stands on them must be at
// least DEMO_WINDOW. The widest reach makes it pessimistic (it may reject a line that would
// leave room), and judging a room's lines together keeps it so.
// A way, as LV11's route goes: over tiles you could step onto, never a staff door, a tile of
// the Centrepiece hall or a tile an exhibit that does not move stands on (asleep, or in a
// case); a turn for each tile. With no way at all it has nothing to judge (LV11 says so).
//
// The hall's case ('hall_case', M4 plan D3.9: M.11's hall has one rain case): once a
// Centrepiece is placed in a department whose weather lives in cases (weather_cases gives the
// hall's case rain), its hall must hold a real case, and every station among its attachments
// (the Great Board's Repeater Arm) must stand in that case's rain (WEATHER_SIZE, centred on it),
// so rain can stop it. The core is at ready false, so today nothing places it.
'use strict';
const LVM4 = (() => {
  // The tiles you could stand on by walking (Grid.walkable), staff doors left out (they need a
  // grade), by character code.
  const WALK = new Uint8Array(128);
  for (let c = 32; c < 128; c++) { const ch = String.fromCharCode(c); WALK[c] = Grid.walkable({ w: 1, h: 1, tiles: [ch] }, 0, 0) && ch !== 'S' && ch !== 's' ? 1 : 0; }
  const walk = (m, x, y) => { const c = m.tiles[y].charCodeAt(x); return c < 128 && WALK[c] === 1; };
  const roomAt = (m, x, y) => Array.isArray(m.roomOf) && m.roomOf[y] ? m.roomOf[y][x] : 0;
  const name = (state, a) => (a && Labels.nameOf(state)(a.uid)) || 'an exhibit';
  // A room as a player knows it: its gallery's name ("the Signal Room"), else its number.
  function roomName(state, id) {
    const g = Populate.galleryOf(state, id), rm = (state.dept.rooms || []).find(r => r.id === id);
    if (g && g.name) return g.name.replace(/^The /, 'the ');
    if (rm && rm.role === 'centre') return 'the Centrepiece hall';
    if (rm && rm.role === 'intro') return 'the Intro';
    return rm && rm.number ? `room ${rm.number}` : 'a room';
  }
  const OPENING = { '+': 'the door', "'": 'the door', ',': 'the archway', E: 'the entrance', X: 'the exit' };

  // ---- LV7 ----

  // LVM4.deadEnds(state, all) → [{junction, at, rooms, tiles, depth, far, reward}]: the dead-end
  // branches of the department as it stands (above), in the order a search from the entrance
  // meets them: the outermost, and inside one that holds a reward the outermost that hold none.
  // junction is a room id, or null for an opening's tile (at, else null); rooms, the room ids
  // in the branch; tiles, its tiles you could stand on (indices
  // y·w + x); reward, what it holds: 'centrepiece' (it holds the Centrepiece hall, the set
  // piece's room), 'item' (an item on its floor or in a case of it), or null; depth, the most
  // walking tiles from its junction to a tile of it (far, that tile), worked out for a branch
  // with no reward, or for every one when all is true (else depth and far are null).
  function deadEnds(state, all) {
    const m = state.dept;
    if (!m || !Array.isArray(m.entrance) || !Array.isArray(m.exits) || !Array.isArray(m.roomOf) || !m.roomOf.length) return [];
    const w = m.w, h = m.h, n = w * h, node = new Int32Array(n).fill(-1), ids = [], idOf = new Map(), tileOf = [];
    let count = 0;
    for (let y = 0; y < h; y++) {
      const row = m.tiles[y], rooms = m.roomOf[y] || [];
      for (let x = 0; x < w; x++) {
        const c = row.charCodeAt(x);
        if (c >= 128 || !WALK[c]) continue;
        const r = rooms[x] || 0;
        if (r) { if (!idOf.has(r)) { idOf.set(r, count++); ids.push(r); tileOf.push(-1); } node[y * w + x] = idOf.get(r); }
        else { node[y * w + x] = count++; ids.push(0); tileOf.push(y * w + x); }
      }
    }
    // Edges, once each, where a step (E, SE, S or SW) joins two nodes.
    const adj = [], seen = new Uint8Array(count * count);
    for (let i = 0; i < count; i++) adj.push([]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = node[y * w + x];
      if (a < 0) continue;
      for (let d = 2; d <= 5; d++) {
        const qx = x + Grid.DX[d], qy = y + Grid.DY[d];
        if (qx < 0 || qx >= w || qy >= h) continue;
        const b = node[qy * w + qx];
        if (b < 0 || b === a || seen[a * count + b] || !Grid.canStep(m, x, y, d)) continue;
        seen[a * count + b] = seen[b * count + a] = 1; adj[a].push(b); adj[b].push(a);
      }
    }
    const root = node[m.entrance[1] * w + m.entrance[0]];
    if (root < 0) return [];
    const exit = new Uint8Array(count);
    for (const [x, y] of m.exits) if (node[y * w + x] >= 0) exit[node[y * w + x]] = 1;
    // Tarjan's cut vertices, iteratively: pre-order number, lowpoint, subtree size, and whether
    // a subtree holds an exit.
    const disc = new Int32Array(count).fill(-1), low = new Int32Array(count), size = new Int32Array(count), ex = new Uint8Array(count), par = new Int32Array(count).fill(-1);
    const cuts = [], stack = [root], it = new Int32Array(count);
    let t = 0;
    disc[root] = low[root] = t++; ex[root] = exit[root];
    while (stack.length) {
      const v = stack[stack.length - 1];
      if (it[v] < adj[v].length) {
        const u = adj[v][it[v]++];
        if (disc[u] < 0) { disc[u] = low[u] = t++; par[u] = v; ex[u] = exit[u]; stack.push(u); }
        else if (u !== par[v]) low[v] = Math.min(low[v], disc[u]);
        continue;
      }
      stack.pop();
      size[v] += 1;
      const p = par[v];
      if (p < 0) continue;
      low[p] = Math.min(low[p], low[v]); size[p] += size[v]; ex[p] |= ex[v];
      if (low[v] >= disc[p] && !ex[v]) cuts.push([p, v]);
    }
    const inside = (v, c) => disc[v] >= disc[c] && disc[v] < disc[c] + size[c];
    // What each node holds (the Centrepiece hall; an item on its floor or in a case of it),
    // summed in the search's pre-order, so a branch's (a run of that order) is a difference.
    const items = state.items || [], order = new Int32Array(t), hallAt = new Uint8Array(count), itemAt = new Uint8Array(count);
    for (let i = 0; i < count; i++) if (disc[i] >= 0) order[disc[i]] = i;
    for (const r of m.rooms || []) if (r.role === 'centre' && idOf.has(r.id)) hallAt[idOf.get(r.id)] = 1;
    for (const i of items) {
      const p = i.where;
      if (!p || (p.at !== 'floor' && p.at !== 'case') || !Grid.inside(m, p.x, p.y)) continue;
      const r = roomAt(m, p.x, p.y), v = r ? idOf.get(r) : node[p.y * w + p.x];
      if (v !== undefined && v >= 0) itemAt[v] = 1;
    }
    const sumH = new Int32Array(t + 1), sumI = new Int32Array(t + 1);
    for (let d = 0; d < t; d++) { sumH[d + 1] = sumH[d] + hallAt[order[d]]; sumI[d + 1] = sumI[d] + itemAt[order[d]]; }
    const rewardOf = c => { const a = disc[c], b = a + size[c]; return sumH[b] > sumH[a] ? 'centrepiece' : sumI[b] > sumI[a] ? 'item' : null; };
    // The outermost branches; and, inside one that holds a reward, the outermost of those that
    // hold none, since a reward down one branch does not reward the walk down another.
    cuts.sort((p, q) => disc[p[1]] - disc[q[1]]);
    const kept = [];
    for (const [j, c] of cuts) {
      const reward = rewardOf(c);
      if (!kept.some(([, c0, r0]) => inside(c, c0) && (r0 === null || reward !== null))) kept.push([j, c, reward]);
    }
    return kept.map(([j, c, reward]) => {
      const tiles = [], rooms = [];
      for (let k = 0; k < n; k++) if (node[k] >= 0 && inside(node[k], c)) tiles.push(k);
      for (let i = 0; i < count; i++) if (ids[i] > 0 && disc[i] >= 0 && inside(i, c)) rooms.push(ids[i]);
      const at = tileOf[j] >= 0 ? [tileOf[j] % w, Int.idiv(tileOf[j], w)] : null;
      if (reward && !all) return { junction: ids[j] > 0 ? ids[j] : null, at, rooms, tiles, depth: null, far: null, reward };
      // Walking tiles beyond the junction: 1 for a tile of the branch a step from it.
      const dist = new Int32Array(n).fill(-1), queue = [];
      for (const k of tiles) {
        const x = k % w, y = Int.idiv(k, w);
        for (let d = 0; d < 8; d++) {
          const qx = x + Grid.DX[d], qy = y + Grid.DY[d];
          if (Grid.inside(m, qx, qy) && node[qy * w + qx] === j && Grid.canStep(m, qx, qy, (d + 4) % 8)) { dist[k] = 1; queue.push(k); break; }
        }
      }
      let far = queue.length ? queue[0] : tiles[0];
      for (let i = 0; i < queue.length; i++) {
        const k = queue[i], x = k % w, y = Int.idiv(k, w);
        if (dist[k] > dist[far]) far = k;
        for (let d = 0; d < 8; d++) {
          const qx = x + Grid.DX[d], qy = y + Grid.DY[d], q = qy * w + qx;
          if (!Grid.inside(m, qx, qy) || dist[q] >= 0 || node[q] < 0 || !inside(node[q], c) || !Grid.canStep(m, x, y, d)) continue;
          dist[q] = dist[k] + 1; queue.push(q);
        }
      }
      return { junction: ids[j] > 0 ? ids[j] : null, at, rooms, tiles, depth: dist[far] > 0 ? dist[far] : 0, far: [far % w, Int.idiv(far, w)], reward };
    });
  }

  // LV7: null, or {reason, tiles} naming the dead end: its farthest tile, then where it leaves
  // the way through.
  function lv7(state, plan) {
    const v = Populate.asMade(state), m = v.dept;
    for (const b of deadEnds(v, false)) {
      if (b.depth < N.DEAD_END_REWARD || b.reward) continue;
      const where = b.junction !== null ? roomName(v, b.junction) : `${OPENING[Grid.ch(m, b.at[0], b.at[1])] || 'the opening'} at ${b.at[0]},${b.at[1]}`;
      const what = b.rooms.length ? ` (${b.rooms.map(r => roomName(v, r)).join(', ')})` : '';
      const tiles = [b.far];
      if (b.at) tiles.push(b.at);
      return { reason: `the dead end beyond ${where}${what} reaches ${b.depth} walking tiles past it, at ${b.far[0]},${b.far[1]}, and holds nothing to find there: no item, no Highlight, no Centrepiece (a dead end of ${N.DEAD_END_REWARD} walking tiles or more must reward the walk)`, tiles };
    }
    return null;
  }

  // ---- LV13 for the chime ----

  // Where a way may step (LV11's route's tiles): 1 for a tile you could stand on that is no
  // staff door, no tile of the Centrepiece hall, and no tile of an exhibit asleep or in a case.
  function ways(state) {
    const m = state.dept, w = m.w, open = new Uint8Array(w * m.h), hall = (m.rooms || []).filter(r => r.role === 'centre').map(r => r.id);
    for (let y = 0; y < m.h; y++) { const row = m.roomOf[y]; for (let x = 0; x < w; x++) if (walk(m, x, y) && !(row && hall.includes(row[x]))) open[y * w + x] = 1; }
    for (let i = 1; i < state.actors.length; i++) {
      const a = state.actors[i];
      if (!a.gone && (a.mode === 'dormant' || Cases.encased(state, a))) for (const [x, y] of Actors.footprint(a)) if (Grid.inside(m, x, y)) open[y * w + x] = 0;
    }
    return open;
  }
  // The longest run of tiles along line (reach's tiles, in order) that a way could walk with no
  // step off it: open tiles of it, one after another along it, none of them a step from an open
  // tile off the line.
  function bare(state, open, reach, line) {
    const m = state.dept, w = m.w;
    let most = 0, k = 0;
    for (let i = 0; i < reach.length; i++) {
      const [x, y] = reach[i], prev = i ? reach[i - 1] : null;
      if (!prev || Math.abs(prev[0] - x) + Math.abs(prev[1] - y) !== 1) k = 0;
      let off = !open[y * w + x];
      for (let d = 0; d < 8 && !off; d++) {
        const qx = x + Grid.DX[d], qy = y + Grid.DY[d];
        if (Grid.inside(m, qx, qy) && open[qy * w + qx] && !line[qy * w + qx] && Grid.canStep(m, x, y, d)) off = true;
      }
      k = off ? 0 : k + 1;
      if (k > most) most = k;
    }
    return most;
  }
  // Can a way from where you stand reach an exit standing on the tiles of line (a mask) at most
  // most turns running? Each tile keeps the fewest turns running it was reached with.
  function through(state, open, line, most) {
    const m = state.dept, w = m.w, n = w * m.h, best = new Uint8Array(n).fill(255), exit = new Uint8Array(n), you = state.actors[0];
    for (const [x, y] of m.exits) exit[y * w + x] = 1;
    const qk = [you.y * w + you.x], qs = [0];
    best[qk[0]] = 0;
    for (let i = 0; i < qk.length; i++) {
      const k = qk[i], r = qs[i], x = k % w, y = Int.idiv(k, w);
      if (exit[k]) return true;
      if (best[k] < r) continue;
      for (let d = 0; d < 8; d++) {
        const qx = x + Grid.DX[d], qy = y + Grid.DY[d], q = qy * w + qx;
        if (!Grid.inside(m, qx, qy) || !open[q] || !Grid.canStep(m, x, y, d)) continue;
        const nr = line[q] ? r + 1 : 0;
        if (nr > most || nr >= best[q]) continue;
        best[q] = nr; qk.push(q); qs.push(nr);
      }
    }
    return false;
  }
  // LVM4.windows(state, exact) → [{uid, period, reach, mates, run, window, fails}]: each station
  // whose line, at its reach, with the lines of the other stations of its room (mates, their
  // uids: one room, one period, so their lines strike on the same turn, and a way that steps
  // from one onto another stands on both in one run), is longer than its period less
  // DEMO_WINDOW (no shorter one can fail). A way that stands on a line alone in its room can
  // step off it and back at any tile of it with a step off, so it need stand on it no more
  // than two turns more than its longest bare run (bare); only where that is more than the
  // period allows, or where the room holds another station's line, is the way searched
  // (through). run is the fewest turns running the best way through stands on those lines (0
  // when they cut nothing off), window its period less run, and fails whether that window is
  // under DEMO_WINDOW. A line that passes has its run worked out only when exact is true (else
  // run and window are null); one with no way to an exit at all has run and window null, and
  // does not fail. [] with the chime off or absent.
  function windows(state, exact) {
    if (!HourlyDemonstration.of(state)) return [];
    const m = state.dept, n = m.w * m.h, out = [], all = HourlyDemonstration.stations(state);
    const reaches = all.map(a => HourlyDemonstration.reach(state, a)), rooms = all.map(a => roomAt(m, a.x, a.y));
    let open = null;
    for (let i = 0; i < all.length; i++) {
      const a = all[i], P = HourlyDemonstration.period(state, a), most = P - N.DEMO_WINDOW, reach = reaches[i];
      const mates = [];
      for (let j = 0; j < all.length; j++) if (j !== i && rooms[j] === rooms[i] && reaches[j].length) mates.push(j);
      const line = new Uint8Array(n);
      let size = 0;
      for (const k of [i].concat(mates)) for (const [x, y] of reaches[k]) if (!line[y * m.w + x]) { line[y * m.w + x] = 1; size++; }
      if (size <= most) continue;
      if (!open) open = ways(state);
      const ok = (!mates.length && bare(state, open, reach, line) + 2 <= most) || through(state, open, line, most);
      let run = null;
      for (let r = ok ? 0 : most + 1; r <= (ok ? (exact ? most : -1) : size); r++) if (through(state, open, line, r)) { run = r; break; }
      out.push({ uid: a.uid, period: P, reach, mates: mates.map(j => all[j].uid), run, window: run === null ? null : P - run, fails: !ok && run !== null });
    }
    return out;
  }
  // LV13: null, or {reason, tiles}: the station, then its line's other tiles, then each mate's
  // tile and line. "Every way" is LV11's: a way through the Centrepiece hall, a staff door or an
  // exhibit standing still is no way here, and the sentence says so.
  function lv13(state, plan) {
    const v = Populate.asMade(state);
    for (const f of windows(v, false)) {
      if (!f.fails) continue;
      const a = v.actors.find(b => b.uid === f.uid), room = roomName(v, roomAt(v.dept, a.x, a.y)), mates = f.mates.map(u => v.actors.find(b => b.uid === u));
      const tiles = [[a.x, a.y]];
      for (const p of f.reach) if (p[0] !== a.x || p[1] !== a.y) tiles.push(p);
      for (const b of mates) for (const p of [[b.x, b.y]].concat(HourlyDemonstration.reach(v, b))) if (!tiles.some(q => q[0] === p[0] && q[1] === p[1])) tiles.push(p);
      const also = mates.length ? `, whose line strikes on the same turn as that of ${mates.map(b => `${name(v, b)} (at ${b.x},${b.y})`).join(' and ')} in the same room` : '';
      return { reason: `every way from the entrance to an exit, but through the Centrepiece hall, a staff door or an exhibit that stands still, crosses the line of ${name(v, a)} (at ${a.x},${a.y}, in ${room})${also}, ` +
        `and the best of them stands on ${mates.length ? 'those lines' : 'it'} ${f.run} turn${f.run === 1 ? '' : 's'} running: ` +
        `its line goes off every ${f.period} turns, which leaves ${f.window > 0 ? `${f.window} turn${f.window === 1 ? '' : 's'}` : 'no turn'} to start across (at least ${N.DEMO_WINDOW})`, tiles };
    }
    return null;
  }

  // ---- The hall's case ----

  // null, or {reason, tiles}: the hall's real case missing (tiles: the Centrepiece's), or a
  // station attachment out of its rain (tiles: the station's, then the cases').
  function hallCase(state, plan) {
    const v = Populate.asMade(state), m = v.dept, cp = Hall.cp(v);
    if (!cp || !(m.modules || []).some(e => e.id === 'weather_cases')) return null;
    const hall = (m.rooms || []).find(r => r.key === cp.room);
    if (!hall) return null;
    const cases = (m.fixtures || []).filter(f => f.k === 'case' && !f.mimic && roomAt(m, f.x, f.y) === hall.id);
    const piece = Actors.byUid(v, cp.uids[0]), what = name(v, piece);
    const stations = Tableau.attachments(v).filter(a => HourlyDemonstration.isStation(v, a));
    if (!cases.length) return { reason: `the hall of ${what} holds no real case, so no rain can fall there${stations.length ? ` to stop ${stations.map(a => name(v, a)).join(' or ')}` : ''} (the hall's case holds rain)`, tiles: piece ? Actors.footprint(piece) : [cp.at.slice()] };
    for (const a of stations) {
      if (cases.some(f => Grid.covers({ x: f.x, y: f.y, size: N.WEATHER_SIZE }, a.x, a.y))) continue;
      return { reason: `${name(v, a)} stands at ${a.x},${a.y}, out of the rain of every case in the hall of ${what}, so rain can never stop its line`, tiles: [[a.x, a.y]].concat(cases.map(f => [f.x, f.y])) };
    }
    return null;
  }

  // Registered through the namespace, so that a test may stand in for one (load order: after
  // LV6, the treasure case and LV11).
  Populate.addValidator('lv7', (state, plan) => LVM4.lv7(state, plan));
  Populate.addValidator('lv13', (state, plan) => LVM4.lv13(state, plan));
  Populate.addValidator('hall_case', (state, plan) => LVM4.hallCase(state, plan));
  return { lv7, lv13, hallCase, deadEnds, windows };
})();
