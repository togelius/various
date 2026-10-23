// ACCESSION — curation, ported from prototypes/layout/proto.js: walkways reserved
// between a room's openings, wall runs of cases, tactical seasoning, the Centrepiece
// hall's lectern and furniture (design/layout.md §6).
'use strict';
const LCurate = (() => {
  const B = LBuild, T = B.T;
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function roomTiles(L, r) {
    const G = L.G, out = [];
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (G.rid(x, y) === r.id) out.push(y * G.W + x);
    return out;
  }
  function roomOpenings(L, r) {
    const G = L.G, W = G.W, out = [];
    for (const i of roomTiles(L, r)) {
      const x = i % W, y = (i - x) / W;
      for (const [dx, dy] of N4) { const c = G.get(x + dx, y + dy); if (c === T.ARCH || c === T.DOOR || c === T.STAFF || c === T.ENT || c === T.EXIT) { out.push(i); break; } }
    }
    return out;
  }
  // 4-connected distances inside one room, walkable tiles only.
  function bfsRoom(G, r, starts) {
    const W = G.W, D = new Map(), q = starts.slice();
    for (const s of starts) D.set(s, 0);
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % W, y = (i - x) / W;
      for (const [dx, dy] of N4) {
        const j = (y + dy) * W + x + dx;
        if (D.has(j) || G.room[j] !== r.id || B.WALK[G.t[j]] !== 1) continue;
        D.set(j, D.get(i) + 1); q.push(j);
      }
    }
    return D;
  }
  function reserveWalkways(L, r, formal) {
    const G = L.G, W = G.W, res = new Set(), ops = roomOpenings(L, r);
    for (const o of ops) { const x = o % W, y = (o - x) / W; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) res.add((y + dy) * W + x + dx); }
    for (let a = 0; a < ops.length; a++) {
      const D = bfsRoom(G, r, [ops[a]]);
      for (let b = a + 1; b < ops.length; b++) {
        let cur = ops[b];
        if (!D.has(cur)) continue;
        while (D.get(cur) > 0) {
          res.add(cur);
          if (formal) { res.add(cur + 1); res.add(cur - 1); res.add(cur + W); res.add(cur - W); }
          const x = cur % W, y = (cur - x) / W;
          for (const [dx, dy] of N4) { const j = (y + dy) * W + x + dx; if (D.has(j) && D.get(j) === D.get(cur) - 1) { cur = j; break; } }
        }
        res.add(cur);
      }
    }
    return { res, ops };
  }
  function roomStillCirculates(L, r, ops) {
    if (!ops.length) return true;
    const D = bfsRoom(L.G, r, [ops[0]]);
    if (!ops.every(o => D.has(o))) return false;
    const G = L.G, W = G.W;
    for (const i of roomTiles(L, r)) {
      if (G.t[i] !== T.VIT && G.t[i] !== T.PLINTH) continue;
      const x = i % W, y = (i - x) / W;
      let ok = false;
      for (const [dx, dy] of N4) if (D.has((y + dy) * W + x + dx)) ok = true;
      if (!ok) return false;
    }
    return true;
  }

  function curate(L, seed, base, gates, perturbRoom) {
    const G = L.G, W = G.W;
    const noOpaque = new Set();
    if (L.meta.vistaRequired) { const [ex, ey] = L.meta.entrance, [cx, cy] = L.meta.cpl; for (const [x, y] of B.lineTiles(ex, ey, cx, cy)) noOpaque.add(y * W + x); }
    for (const r of L.rooms) {
      if (!r || r.role === 'staff') continue;
      const rng = B.stream(seed, base + '/room/' + (r.key || r.role + r.id) + '/curate' + (perturbRoom === r.id ? '/perturbed' : ''));
      const tiles = roomTiles(L, r);
      const { res, ops } = reserveWalkways(L, r, !!L.meta.formal);
      const free = i => G.t[i] === T.FLOOR && !res.has(i) && !gates.has(i);
      const tryPut = (i, c) => {
        if (!free(i)) return false;
        if (!B.SEE[c] && noOpaque.has(i)) return false;
        const old = G.t[i];
        G.t[i] = c;
        if (!roomStillCirculates(L, r, ops)) { G.t[i] = old; return false; }
        return true;
      };
      if (!r.tags.filled) {
        const p = r.role === 'study' ? 650 : r.role === 'coda' ? 250 : r.role === 'centre' ? 0 : 450;
        for (const i of tiles) {
          const x = i % W, y = (i - x) / W;
          const wallN = N4.filter(([dx, dy]) => G.get(x + dx, y + dy) === T.WALL).length;
          if (wallN !== 1) continue;
          if ((x + y) % 3 === 0) continue;
          if (rng.pm(p)) tryPut(i, T.VIT);
        }
      }
      const floorN = tiles.filter(i => B.WALK[G.t[i]] === 1).length;
      const wallAdj = i => { const x = i % W, y = (i - x) / W; return N4.some(([dx, dy]) => G.get(x + dx, y + dy) === T.WALL); };
      const cheb = (i, px, py) => { const x = i % W, y = (i - x) / W; return Math.max(Math.abs(x - px), Math.abs(y - py)); };
      if (r.role === 'centre') {
        const [px, py] = L.meta.cpl;
        const ring = tiles.filter(i => free(i) && wallAdj(i));
        for (const i of rng.shuffle(ring.slice())) if (G.t[i] === T.FLOOR && cheb(i, px, py) >= 4 && tryPut(i, T.COL)) break;
        for (const i of rng.shuffle(ring.slice())) if (G.t[i] === T.FLOOR && cheb(i, px, py) >= 4 && tryPut(i, T.VIT)) break;
        placeLectern(L, r, tiles, tryPut);
        const view = L.meta.viewTile;
        for (const [x, y] of [[px - 5, py - 1], [px - 5, py + 1]]) if (G.rid(x, y) === r.id && G.t[y * W + x] === T.FLOOR && !(view && view[0] === x && view[1] === y)) G.t[y * W + x] = T.BENCH;
        continue;
      }
      if (floorN >= 36 && r.role !== 'coda') {
        const has = c => tiles.some(i => (c === 'op' ? B.BLOCK[G.t[i]] && !B.GLASS[G.t[i]] : B.GLASS[G.t[i]]) && G.t[i] !== T.CPL);
        const cand = tiles.filter(i => free(i)).map(i => {
          const x = i % W, y = (i - x) / W;
          let d = 99;
          for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (G.get(x + dx, y + dy) === T.WALL) d = Math.min(d, Math.max(Math.abs(dx), Math.abs(dy)));
          return [i, d];
        }).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
        if (!has('op')) {
          for (const [i] of cand) if (tryPut(i, L.meta.formal ? T.COL : T.PART)) {
            if (L.meta.formal && r.kind === 'rect') { const x = i % W, y = (i - x) / W, my = 2 * L.meta.axisY - y; if (my !== y && G.rid(x, my) === r.id) tryPut(my * W + x, T.COL); }
            break;
          }
        }
        if (!has('gl')) { for (const [i] of cand) if (tryPut(i, T.VIT)) break; }
        for (let pass = 0; pass < 3; pass++) {
          const blk = tiles.filter(i => B.BLOCK[G.t[i]]).concat(ops);
          const bare = tiles.filter(i => B.WALK[G.t[i]] === 1 && blk.every(b => cheb(i, b % W, (b - b % W) / W) > 6));
          if (!bare.length) break;
          tryPut(bare[bare.length >> 1], rng.pm(500) ? T.COL : T.VIT);
        }
      }
      if (r.role === 'intro') {
        const [ex, ey] = L.meta.entrance;
        for (const [x, y] of [[ex + 2, ey - 2], [ex + 2, ey + 2]]) if (G.rid(x, y) === r.id && free(y * W + x)) { tryPut(y * W + x, T.LECT); break; }
      }
    }
  }

  // Walking distance from every tile to the Centrepiece's footprint (BUILD.md §8.2): one
  // more than the distance to the nearest tile beside it that can be stepped onto.
  function toFootprint(L) {
    const G = L.G, W = G.W, [px, py] = L.meta.cpl, starts = [];
    for (let y = py - 1; y <= py + 2; y++) for (let x = px - 1; x <= px + 2; x++) {
      const i = y * W + x;
      if (B.WALK[G.t[i]] === 1 && G.t[i] !== T.CPL) starts.push(i);
    }
    const D = B.bfs(G, starts, B.PUBLIC);
    return i => (D[i] < 0 ? -1 : D[i] + 1);
  }

  // The lectern: a viewing tile exactly VIEW_DISTANCE walking tiles from the Centrepiece,
  // in line of sight of it, with the lectern beside it (BUILD.md §8.7).
  function placeLectern(L, r, tiles, tryPut) {
    const G = L.G, W = G.W, [px, py] = L.meta.cpl;
    let dist = toFootprint(L);
    for (const v of tiles) {
      if (G.t[v] !== T.FLOOR || dist(v) !== N.VIEW_DISTANCE) continue;
      const vx = v % W, vy = (v - vx) / W;
      if (!LAnalyse.los(G, vx, vy, px, py)) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const l = (vy + dy) * W + vx + dx, lx = vx + dx, ly = vy + dy;
        // Against a wall, so it never makes a short loop in the arena (LV8).
        let walled = false;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (G.get(lx + i, ly + j) === T.WALL) walled = true;
        if (!walled || G.room[l] !== r.id || !tryPut(l, T.LECT)) continue;
        dist = toFootprint(L);
        if (dist(v) === N.VIEW_DISTANCE && LAnalyse.los(G, vx, vy, px, py)) { L.meta.lectern = [vx + dx, vy + dy]; L.meta.viewTile = [vx, vy]; return true; }
        G.t[l] = T.FLOOR;
        dist = toFootprint(L);
      }
    }
    return false;
  }

  return { roomTiles, roomOpenings, curate, toFootprint };
})();
