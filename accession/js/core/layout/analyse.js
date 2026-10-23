// ACCESSION — layout analysis, ported from prototypes/layout/proto.js: reachability,
// gate cells, holes and loops, the room graph, L_tour, the vista, the Centrepiece's
// optionality and the arena ring (design/layout.md §13.1). Its results are read by the
// validators and the report; only integers from it enter the game state.
'use strict';
const LAnalyse = (() => {
  const B = LBuild, T = B.T;

  function adjacency(G, mode, mask) {
    const W = G.W, N = W * G.H, start = new Int32Array(N + 1), list = [];
    for (let i = 0; i < N; i++) {
      start[i] = list.length;
      if (mask && !mask[i]) continue;
      if (!B.walk(G.t[i], mode)) continue;
      const x = i % W, y = (i - x) / W;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= G.H) continue;
        const j = yy * W + xx;
        if (!B.walk(G.t[j], mode) || (mask && !mask[j])) continue;
        if (dx && dy && (!B.walk(G.t[y * W + xx], mode) || !B.walk(G.t[yy * W + x], mode))) continue;
        list.push(j);
      }
    }
    start[N] = list.length;
    return { start, list: Int32Array.from(list) };
  }

  // Iterative Tarjan: a gate is an articulation point whose second-largest split
  // component has at least 4 tiles.
  function chokepoints(G, root, adj) {
    const N = G.W * G.H, disc = new Int32Array(N).fill(-1), low = new Int32Array(N), size = new Int32Array(N), par = new Int32Array(N).fill(-1), it = new Int32Array(N);
    const sep = new Map();
    let t = 0;
    const st = [root];
    disc[root] = low[root] = t++; size[root] = 1; it[root] = adj.start[root];
    while (st.length) {
      const v = st[st.length - 1];
      if (it[v] < adj.start[v + 1]) {
        const w = adj.list[it[v]++];
        if (disc[w] < 0) { par[w] = v; disc[w] = low[w] = t++; size[w] = 1; it[w] = adj.start[w]; st.push(w); }
        else if (w !== par[v]) low[v] = Math.min(low[v], disc[w]);
      } else {
        st.pop();
        const p = par[v];
        if (p >= 0) {
          low[p] = Math.min(low[p], low[v]); size[p] += size[v];
          if (low[v] >= disc[p]) { if (!sep.has(p)) sep.set(p, []); sep.get(p).push(size[v]); }
        }
      }
    }
    const gates = new Set();
    for (const [v, s] of sep) {
      const comps = v === root ? s.slice() : s.concat([t - 1 - s.reduce((a, b) => a + b, 0)]);
      if (comps.length < 2) continue;
      comps.sort((a, b) => b - a);
      if (comps[1] >= 4) gates.add(v);
    }
    return gates;
  }

  function los(G, x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    while (x !== x1 || y !== y1) {
      if ((x !== x0 || y !== y0) && !B.SEE[G.t[y * G.W + x]]) return false;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return true;
  }

  function roomGraph(L, reachRooms) {
    const nodes = [...reachRooms].sort((a, b) => a - b), idx = new Map(nodes.map((r, i) => [r, i])), n = nodes.length, adj = nodes.map(() => new Set());
    for (const e of L.edges) {
      if (e.type === 'S') continue;
      if (!idx.has(e.a) || !idx.has(e.b) || e.a === e.b) continue;
      adj[idx.get(e.a)].add(idx.get(e.b)); adj[idx.get(e.b)].add(idx.get(e.a));
    }
    let E2 = 0;
    adj.forEach(s => { E2 += s.size; });
    const E = E2 >> 1;
    const reach = (skipA, skipB) => {
      const seen = new Uint8Array(n), q = [skipA];
      seen[skipA] = 1;
      while (q.length) { const v = q.pop(); for (const w of adj[v]) { if ((v === skipA && w === skipB) || (v === skipB && w === skipA)) continue; if (!seen[w]) { seen[w] = 1; q.push(w); } } }
      return seen[skipB] === 1;
    };
    const ringDeg = new Array(n).fill(0);
    let bridges = 0;
    for (let v = 0; v < n; v++) for (const w of adj[v]) if (v < w) { if (reach(v, w)) { ringDeg[v]++; ringDeg[w]++; } else bridges++; }
    const types = { a: 0, b: 0, c: 0, d: 0 }, typeOf = [];
    for (let v = 0; v < n; v++) { const deg = adj[v].size; const t = deg <= 1 ? 'a' : ringDeg[v] === 0 ? 'b' : ringDeg[v] === 2 ? 'c' : ringDeg[v] >= 3 ? 'd' : 'b'; types[t]++; typeOf.push(t); }
    return { nodes, n, E, mu: E - n + 1, types, typeOf, adj, idx, bridges, ringDeg };
  }

  function analyse(L) {
    const G = L.G, W = G.W, N = W * G.H;
    const [ex, ey] = L.meta.entrance, e = ey * W + ex;
    const D = B.bfs(G, [e], B.PUBLIC);
    const open = new Uint8Array(N);
    let floorN = 0;
    for (let i = 0; i < N; i++) if (D[i] >= 0) { open[i] = 1; floorN++; }
    const adj = adjacency(G, B.PUBLIC, open);
    const gates = chokepoints(G, e, adj);
    // Holes: 8-connected non-open components not touching the border; a small ring is a pillar loop.
    const seen = new Uint8Array(N);
    let pillar = 0, circuit = 0;
    for (let i = 0; i < N; i++) {
      if (open[i] || seen[i]) continue;
      const comp = [i];
      seen[i] = 1;
      let border = false;
      for (let k = 0; k < comp.length; k++) {
        const j = comp[k], x = j % W, y = (j - x) / W;
        if (x === 0 || y === 0 || x === W - 1 || y === G.H - 1) border = true;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= G.H) continue;
          const q = yy * W + xx;
          if (!open[q] && !seen[q]) { seen[q] = 1; comp.push(q); }
        }
      }
      if (border) continue;
      const ring = new Set();
      for (const j of comp) { const x = j % W, y = (j - x) / W; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = (y + dy) * W + x + dx; if (open[q]) ring.add(q); } }
      if (ring.size <= 16) pillar++; else circuit++;
    }
    const reachRooms = new Set();
    for (let i = 0; i < N; i++) if (open[i] && G.room[i]) reachRooms.add(G.room[i]);
    const RG = roomGraph(L, reachRooms);
    const roomTiles = LCurate.roomTiles;
    // L_tour: nearest-neighbour tour over gallery centres, then the Centrepiece hall, then the nearest exit.
    const galleries = [...reachRooms].sort((a, b) => a - b).map(id => L.rooms[id]).filter(r => r.role !== 'coda' && r.role !== 'centre' && r.role !== 'staff');
    const pt = r => { const c = B.centreOf(r); let best = -1, bd = 1e9; for (const i of roomTiles(L, r)) { if (!open[i]) continue; const x = i % W, y = (i - x) / W, d = Math.abs(x - c.x) + Math.abs(y - c.y); if (d < bd) { bd = d; best = i; } } return best; };
    const centreRoom = L.rooms.find(r => r && r.role === 'centre');
    let cur = e, tour = 0;
    const order = [];
    const left = galleries.map(r => ({ r, i: pt(r) })).filter(g => g.i >= 0);
    while (left.length) {
      const Dc = B.bfs(G, [cur], B.PUBLIC);
      let bi = 0;
      for (let k = 1; k < left.length; k++) if (Dc[left[k].i] < Dc[left[bi].i]) bi = k;
      tour += Dc[left[bi].i]; cur = left[bi].i; order.push(left[bi].r.id); left.splice(bi, 1);
    }
    {
      const Dc = B.bfs(G, [cur], B.PUBLIC), cp = pt(centreRoom);
      tour += Dc[cp]; cur = cp; order.push(centreRoom.id);
      const D2 = B.bfs(G, [cur], B.PUBLIC);
      let m = 1e9;
      for (const [x, y] of L.meta.exits) if (D2[y * W + x] >= 0) m = Math.min(m, D2[y * W + x]);
      tour += m;
    }
    const [cx, cy] = L.meta.cpl;
    const intro = L.rooms.find(r => r && r.role === 'intro');
    let vista = false;
    for (const i of roomTiles(L, intro)) { if (!open[i]) continue; const x = i % W; if (los(G, x, (i - x) / W, cx, cy)) { vista = true; break; } }
    const Dno = B.bfs(G, [e], B.PUBLIC, centreRoom.id);
    const optionalC = L.meta.exits.some(([x, y]) => Dno[y * W + x] >= 0);
    const allRooms = L.rooms.filter(r => r && r.role !== 'staff');
    const allReached = allRooms.every(r => reachRooms.has(r.id));
    const exitsReached = L.meta.exits.length >= 2 && L.meta.exits.every(([x, y]) => D[y * W + x] >= 0);
    let dExit = 1e9;
    for (const [x, y] of L.meta.exits) if (D[y * W + x] >= 0) dExit = Math.min(dExit, D[y * W + x]);
    const introIdx = RG.idx.get(intro.id);
    const introExits = introIdx === undefined ? 0 : RG.adj[introIdx].size;
    const introOnCycle = introIdx !== undefined && RG.ringDeg[introIdx] >= 2;
    const deadEnds = L.rooms.filter(r => r && r.tags.deadEnd && reachRooms.has(r.id)).length;
    // The arena ring: the smallest ring of walkable tiles round a free-standing blocker group in the hall.
    let arenaMinRing = 99, arenaBlock = null;
    {
      const cr = centreRoom, seenA = new Set();
      for (const i0 of roomTiles(L, cr)) {
        const c0 = G.t[i0];
        if (B.WALK[c0] === 1 || c0 === T.CPL || seenA.has(i0)) continue;
        const comp = [i0];
        seenA.add(i0);
        let attached = false;
        for (let k = 0; k < comp.length; k++) {
          const j = comp[k], x = j % W, y = (j - x) / W;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const q = (y + dy) * W + x + dx, cq = G.t[q];
            if (cq === T.WALL) attached = true;
            else if (B.WALK[cq] !== 1 && cq !== T.CPL && G.room[q] === cr.id && !seenA.has(q)) { seenA.add(q); comp.push(q); }
          }
        }
        if (attached) continue;
        const ring = new Set();
        for (const j of comp) { const x = j % W, y = (j - x) / W; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = (y + dy) * W + x + dx; if (B.WALK[G.t[q]] === 1 || G.t[q] === T.CPL) ring.add(q); } }
        if (ring.size < arenaMinRing) { arenaMinRing = ring.size; arenaBlock = comp.map(j => { const x = j % W; return [x, (j - x) / W]; }); }
      }
    }
    // Glass ratio: see-through blockers among the interior blockers next to public floor.
    let blockers = 0, glass = 0;
    for (let i = 0; i < N; i++) {
      if (!B.BLOCK[G.t[i]] || G.t[i] === T.CPL) continue;
      const x = i % W, y = (i - x) / W;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (G.in(x + dx, y + dy) && open[(y + dy) * W + x + dx]) { near = true; break; }
      if (!near) continue;
      blockers++;
      if (B.GLASS[G.t[i]]) glass++;
    }
    // Narrow share: floor tiles whose horizontal or vertical free run is at most 2.
    let narrow = 0;
    for (let i = 0; i < N; i++) {
      if (!open[i]) continue;
      const x = i % W, y = (i - x) / W;
      let h = 1, v = 1;
      for (let k = 1; x + k < W && open[i + k]; k++) h++;
      for (let k = 1; x - k >= 0 && open[i - k]; k++) h++;
      for (let k = 1; y + k < G.H && open[i + k * W]; k++) v++;
      for (let k = 1; y - k >= 0 && open[i - k * W]; k++) v++;
      if (Math.min(h, v) <= 2) narrow++;
    }
    // Rooms from the Intro to the Centrepiece hall on the room graph.
    let roomsToC = -1;
    if (introIdx !== undefined && RG.idx.has(centreRoom.id)) {
      const Dd = new Array(RG.n).fill(-1), q = [introIdx];
      Dd[introIdx] = 0;
      for (let h = 0; h < q.length; h++) for (const w of RG.adj[q[h]]) if (Dd[w] < 0) { Dd[w] = Dd[q[h]] + 1; q.push(w); }
      roomsToC = Dd[RG.idx.get(centreRoom.id)];
    }
    return {
      blockers, glass, narrow, roomsToC,
      W, H: G.H, floor: floorN, pillar, circuit, loops: pillar + circuit, gates, gatesN: gates.size,
      tour, order, vista, optionalC, allReached, exitsReached, dExit, rooms: RG.n, mu: RG.mu, arenaBlock,
      aShare: RG.n ? RG.types.a / RG.n : 0, introExits, introOnCycle, deadEnds, arenaMinRing, D, openMask: open, RG,
    };
  }

  return { analyse, los, roomGraph };
})();
