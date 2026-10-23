// ACCESSION — layout construction kit, ported from prototypes/layout/proto.js: a working
// grid of character codes and room ids, rooms, openings, loops and the a-space pass
// (design/layout.md §§4–5). Generation is atomic, so its streams are local, not stored.
'use strict';
const LBuild = (() => {
  const CH = s => s.charCodeAt(0);
  const T = {
    WALL: CH('#'), FLOOR: CH('.'), ARCH: CH(','), DOOR: CH('+'), STAFF: CH('S'), VIT: CH('v'), LOWF: CH('f'),
    PLINTH: CH('p'), COL: CH('o'), SHELF: CH('H'), PART: CH('|'), CRATE: CH('c'), VOID: CH('~'), BENCH: CH('b'),
    CPL: CH('C'), ENT: CH('E'), EXIT: CH('X'), LECT: CH('l'), POOL: CH('w'),
  };
  // Public walking (staff doors closed) and sight, for generation and analysis.
  const WALK = new Uint8Array(128), SEE = new Uint8Array(128), BLOCK = new Uint8Array(128), GLASS = new Uint8Array(128);
  for (const c of '.,+EXbw') WALK[CH(c)] = 1;
  WALK[T.STAFF] = 2;
  for (const c of '.,bwEXvfp~l') SEE[CH(c)] = 1;
  for (const c of 'vfp~loH|cC') BLOCK[CH(c)] = 1;
  for (const c of 'vfp~l') GLASS[CH(c)] = 1;
  const PUBLIC = 1, ALL = 3;
  const walk = (c, mode) => (WALK[c] & mode) !== 0;

  function grid(W, H) {
    const t = new Uint8Array(W * H).fill(T.WALL), room = new Int16Array(W * H);
    return {
      W, H, t, room,
      in: (x, y) => x >= 0 && y >= 0 && x < W && y < H,
      get(x, y) { return x >= 0 && y >= 0 && x < W && y < H ? t[y * W + x] : T.WALL; },
      set(x, y, c) { t[y * W + x] = c; },
      rid(x, y) { return x >= 0 && y >= 0 && x < W && y < H ? room[y * W + x] : 0; },
      rows() { const out = []; for (let y = 0; y < H; y++) { let s = ''; for (let x = 0; x < W; x++) s += String.fromCharCode(t[y * W + x]); out.push(s); } return out; },
    };
  }

  // A local stream with the prototype's helper names, derived like every other stream.
  function stream(seed, path) {
    const holder = { seed, rng: {} }, s = Rng.stream(holder, path);
    return { u32: s.u32, int: s.int, pm: p => s.chance(p), pick: s.pick, shuffle: s.shuffle };
  }

  const newLayout = () => ({ G: null, rooms: [null], edges: [], meta: {}, log: [] });

  function addRect(L, role, x0, y0, x1, y1, tags, clip) {
    const id = L.rooms.length, r = { id, role, kind: 'rect', x0, y0, x1, y1, tags: tags || {} };
    L.rooms.push(r);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (clip && clip(x, y)) continue;
      L.G.set(x, y, T.FLOOR); L.G.room[y * L.G.W + x] = id;
    }
    return r;
  }
  const centreOf = r => ({ x: (r.x0 + r.x1) >> 1, y: (r.y0 + r.y1) >> 1 });

  function wallCandidates(L, a, b) {
    const G = L.G, A = L.rooms[a], B = L.rooms[b], out = [];
    const x0 = Math.max(1, Math.min(A.x0, B.x0) - 1), x1 = Math.min(G.W - 2, Math.max(A.x1, B.x1) + 1);
    const y0 = Math.max(1, Math.min(A.y0, B.y0) - 1), y1 = Math.min(G.H - 2, Math.max(A.y1, B.y1) + 1);
    const ok = (x, y, r) => G.rid(x, y) === r && WALK[G.get(x, y)] === 1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (G.get(x, y) !== T.WALL) continue;
      if ((ok(x - 1, y, a) && ok(x + 1, y, b)) || (ok(x - 1, y, b) && ok(x + 1, y, a))) out.push({ x, y, dir: 'v' });
      else if ((ok(x, y - 1, a) && ok(x, y + 1, b)) || (ok(x, y - 1, b) && ok(x, y + 1, a))) out.push({ x, y, dir: 'h' });
    }
    return out;
  }

  // Open a wall between rooms a and b: 3 wide where possible, near a target line if given.
  function connect(L, a, b, o) {
    o = o || {};
    let width = o.width || 3;
    const type = o.type || T.ARCH;
    const cands = wallCandidates(L, a, b);
    if (!cands.length) return null;
    const key = (x, y) => y * L.G.W + x, set = new Set(cands.map(c => key(c.x, c.y)));
    let good = cands;
    if (width === 3) {
      const g3 = cands.filter(c => c.dir === 'v' ? set.has(key(c.x, c.y - 1)) && set.has(key(c.x, c.y + 1)) : set.has(key(c.x - 1, c.y)) && set.has(key(c.x + 1, c.y)));
      if (g3.length) good = g3; else width = 1;
    }
    let c;
    const tdist = g => (o.target.x == null ? 0 : Math.abs(g.x - o.target.x)) + (o.target.y == null ? 0 : Math.abs(g.y - o.target.y));
    if (o.target && width === 3) {
      let b3 = 1e9, b1 = 1e9;
      for (const g of good) b3 = Math.min(b3, tdist(g));
      for (const g of cands) b1 = Math.min(b1, tdist(g));
      if (b3 > 1 && b1 === 0) { good = cands; width = 1; }
    }
    if (o.target) { let best = 1e9; for (const g of good) { const d = tdist(g); if (d < best) { best = d; c = g; } } }
    else if (o.rng) c = o.rng.pick(good);
    else c = good[(good.length - 1) >> 1];
    const tiles = [[c.x, c.y]];
    if (width === 3) { if (c.dir === 'v') tiles.push([c.x, c.y - 1], [c.x, c.y + 1]); else tiles.push([c.x - 1, c.y], [c.x + 1, c.y]); }
    for (const [x, y] of tiles) L.G.set(x, y, type);
    const e = { a, b, type: String.fromCharCode(type), width, tiles, why: o.why || 'graph' };
    L.edges.push(e);
    return e;
  }

  // 8-way breadth-first distances on the working grid, diagonals not cutting corners.
  function bfs(G, starts, mode, blockedRoom) {
    const N = G.W * G.H, D = new Int32Array(N).fill(-1), q = new Int32Array(N), W = G.W;
    let h = 0, t = 0;
    for (const s of starts) if (D[s] < 0) { D[s] = 0; q[t++] = s; }
    while (h < t) {
      const i = q[h++], x = i % W, y = (i - x) / W;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= G.H) continue;
        const j = yy * W + xx;
        if (D[j] >= 0) continue;
        if (!walk(G.t[j], mode) || (blockedRoom && G.room[j] === blockedRoom)) continue;
        if (dx && dy && (!walk(G.t[y * W + xx], mode) || !walk(G.t[yy * W + x], mode))) continue;
        D[j] = D[i] + 1; q[t++] = j;
      }
    }
    return D;
  }

  function adjacentPairs(L) {
    const G = L.G, m = new Map();
    for (let y = 1; y < G.H - 1; y++) for (let x = 1; x < G.W - 1; x++) {
      if (G.get(x, y) !== T.WALL) continue;
      let p = null;
      const l = G.rid(x - 1, y), r = G.rid(x + 1, y), u = G.rid(x, y - 1), d = G.rid(x, y + 1);
      if (l && r && l !== r && WALK[G.get(x - 1, y)] === 1 && WALK[G.get(x + 1, y)] === 1) p = [Math.min(l, r), Math.max(l, r)];
      else if (u && d && u !== d && WALK[G.get(x, y - 1)] === 1 && WALK[G.get(x, y + 1)] === 1) p = [Math.min(u, d), Math.max(u, d)];
      if (p) { const k = p[0] + ':' + p[1]; if (!m.has(k)) m.set(k, p); }
    }
    return [...m.values()];
  }

  // Brogue-style addLoops at room-pair granularity: open a wall between adjacent rooms
  // when walking between them is longer than d.
  function addLoops(L, d, rng, o) {
    o = o || {};
    const pairs = rng.shuffle(adjacentPairs(L).sort((p, q) => p[0] - q[0] || p[1] - q[1]));
    let added = 0;
    for (const [a, b] of pairs) {
      const A = L.rooms[a], B = L.rooms[b];
      if (o.allow && !o.allow(A, B)) continue;
      const cands = wallCandidates(L, a, b);
      if (!cands.length) continue;
      const c = cands[(cands.length - 1) >> 1], G = L.G;
      const s1 = c.dir === 'v' ? [c.x - 1, c.y] : [c.x, c.y - 1], s2 = c.dir === 'v' ? [c.x + 1, c.y] : [c.x, c.y + 1];
      const D = bfs(G, [s1[1] * G.W + s1[0]], PUBLIC);
      const dist = D[s2[1] * G.W + s2[0]];
      if (dist >= 0 && dist <= d) continue;
      if (connect(L, a, b, { width: o.width || 3, type: o.type || T.ARCH, why: 'addLoops' })) added++;
    }
    return added;
  }

  // A 2-high staff corridor along the top edge (programme geometry is offset by 3).
  function addStaffBand(L, rng, nDoors) {
    const G = L.G, r = addRect(L, 'staff', 1, 1, G.W - 2, 2, { staff: true });
    const touching = L.rooms.filter(q => q && q.id !== r.id && q.role !== 'staff' && wallCandidates(L, r.id, q.id).length);
    rng.shuffle(touching);
    let n = 0;
    for (const q of touching) { if (n >= nDoors) break; if (connect(L, r.id, q.id, { width: 1, type: T.STAFF, rng, why: 'staff' })) n++; }
    return r;
  }

  // n rooms with 1-tile walls over a run of `total` tiles, near-equal widths with jitter.
  function splitN(rng, total, n, minW) {
    n = Math.max(1, Math.min(n, Math.floor((total + 1) / (minW + 1))));
    const base = Math.floor((total - (n - 1)) / n), ws = new Array(n).fill(base);
    let left = total - (n - 1) - base * n;
    for (let i = 0; left > 0; i = (i + 1) % n, left--) ws[i]++;
    for (let k = 0; k < n; k++) { const i = rng.int(0, n - 1), j = rng.int(0, n - 1), d = rng.int(0, 2); if (i !== j && ws[i] - d >= minW) { ws[i] -= d; ws[j] += d; } }
    return ws;
  }

  function placeExits(L, room, rng, n, side) {
    const G = L.G, xs = [];
    if (side === 'S') { for (let x = room.x0; x <= room.x1; x++) if (G.get(x, room.y1 + 1) === T.WALL && room.y1 + 1 === G.H - 1) xs.push([x, room.y1 + 1]); }
    else { for (let y = room.y0; y <= room.y1; y++) if (G.get(room.x1 + 1, y) === T.WALL && room.x1 + 1 === G.W - 1) xs.push([room.x1 + 1, y]); }
    const ex = [];
    if (!xs.length) return ex;
    const step = Math.max(3, Math.floor(xs.length / n));
    for (let k = 0; k < n; k++) { const p = xs[Math.min(xs.length - 1, 1 + k * step)]; if (ex.every(e => Math.abs(e[0] - p[0]) + Math.abs(e[1] - p[1]) >= 3)) ex.push(p); }
    for (const [x, y] of ex) G.set(x, y, T.EXIT);
    return ex;
  }

  function closeEdge(L, e) { for (const [x, y] of e.tiles) L.G.set(x, y, T.WALL); L.edges.splice(L.edges.indexOf(e), 1); }

  // Cheap structural check on the public room graph: all rooms reached, the coda reachable
  // without the centre, the Intro with two exits and on a cycle.
  function roomCheck(L) {
    const pub = L.rooms.filter(r => r && r.role !== 'staff'), adj = new Map(pub.map(r => [r.id, []]));
    for (const e of L.edges) if (e.type !== 'S' && adj.has(e.a) && adj.has(e.b)) { adj.get(e.a).push(e.b); adj.get(e.b).push(e.a); }
    const intro = pub.find(r => r.role === 'intro'), centre = pub.find(r => r.role === 'centre'), coda = pub.find(r => r.role === 'coda');
    const reach = (from, skipRoom, skipEdge) => {
      const seen = new Set([from]), q = [from];
      while (q.length) {
        const v = q.pop();
        for (const w of adj.get(v)) {
          if (w === skipRoom) continue;
          if (skipEdge && ((v === skipEdge[0] && w === skipEdge[1]) || (v === skipEdge[1] && w === skipEdge[0]))) continue;
          if (!seen.has(w)) { seen.add(w); q.push(w); }
        }
      }
      return seen;
    };
    const all = reach(intro.id);
    if (pub.some(r => !all.has(r.id))) return false;
    if (!reach(intro.id, centre.id).has(coda.id) && centre !== intro) return false;
    const nb = [...new Set(adj.get(intro.id))];
    if (nb.length < 2) return false;
    return nb.some(w => reach(intro.id, 0, [intro.id, w]).has(w));
  }

  function lineTiles(x0, y0, x1, y1) {
    const out = [];
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    for (;;) { out.push([x, y]); if (x === x1 && y === y1) break; const e2 = 2 * err; if (e2 > -dy) { err -= dy; x += sx; } if (e2 < dx) { err += dx; y += sy; } }
    return out;
  }

  // Turn section rooms into dead ends (one opening) until n are made, keeping the room
  // graph valid; they become study rooms.
  function aSpacePass(L, n, rng) {
    if (!n) return 0;
    const onVista = r => { if (!L.meta.cpl) return false; const [ex, ey] = L.meta.entrance, [cx, cy] = L.meta.cpl; return lineTiles(ex, ey, cx, cy).some(([x, y]) => L.G.rid(x, y) === r.id); };
    const cand = rng.shuffle(L.rooms.filter(r => r && r.role === 'section' && !r.tags.central && !r.tags.deadEnd && r.kind === 'rect' && (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1) <= 70 && !onVista(r)));
    let made = 0;
    for (const r of cand) {
      if (made >= n) break;
      const es = L.edges.filter(e => (e.a === r.id || e.b === r.id) && e.type !== 'S');
      if (es.length < 2) continue;
      const keep = es.slice().sort((a, b) => a.width - b.width)[0];
      const removed = es.filter(e => e !== keep);
      const saved = removed.map(e => ({ e, t: e.tiles.map(([x, y]) => L.G.get(x, y)) }));
      for (const e of removed) closeEdge(L, e);
      if (roomCheck(L)) {
        r.role = 'study'; r.tags.deadEnd = true; r.tags.noLoops = true;
        if (keep.width === 1) { for (const [x, y] of keep.tiles) L.G.set(x, y, T.DOOR); keep.type = '+'; }
        made++;
      } else for (const { e, t } of saved) { e.tiles.forEach(([x, y], k) => L.G.set(x, y, t[k])); L.edges.push(e); }
    }
    return made;
  }

  return { T, WALK, SEE, BLOCK, GLASS, PUBLIC, ALL, walk, grid, stream, newLayout, addRect, centreOf, wallCandidates, connect, bfs,
    adjacentPairs, addLoops, addStaffBand, splitN, placeExits, closeEdge, roomCheck, lineTiles, aSpacePass };
})();
