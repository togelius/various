'use strict';
// ACCESSION department-layout prototype (throwaway, design support only).
// Implements a simplified L2-L7 of design/layout.md for the six launch programmes,
// to measure metric envelopes and runtime. Not game code.
// usage: node proto.js [seedsPerTier=100] [--show programme seed tier]

// ---------------- RNG: named substreams ----------------
function hashStr(s) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return (t ^ t >>> 14) >>> 0; }; }
function Stream(name) {
  const next = mulberry32(hashStr(name));
  return {
    name, u32: next,
    int(lo, hi) { return lo + (next() % (hi - lo + 1)); },
    pm(p) { return (next() % 1000) < p; },
    pick(a) { return a[next() % a.length]; },
    shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = next() % (i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; },
  };
}

// ---------------- tiles ----------------
const CH = s => s.charCodeAt(0);
const WALL = CH('#'), FLOOR = CH('.'), ARCH = CH(','), DOOR = CH('+'), STAFF = CH('S'), HIDDEN = CH('h'), LOCK = CH('L'),
  VIT = CH('v'), DIO = CH('d'), LOWF = CH('f'), PLINTH = CH('p'), COL = CH('o'), SHELF = CH('H'), PART = CH('|'), CRATE = CH('c'),
  VOID = CH('~'), BALC = CH(':'), STAIR = CH('^'), ROPE = CH('='), BENCH = CH('b'), CPL = CH('C'), ENT = CH('E'), EXIT = CH('X'),
  LECT = CH('l'), POOL = CH('w');
const WALK = new Uint8Array(256), SEE = new Uint8Array(256), BLOCK = new Uint8Array(256), GLASS = new Uint8Array(256);
for (const c of '.,+EX:^=bw') WALK[CH(c)] = 1;
WALK[STAFF] = 2; WALK[HIDDEN] = 4; WALK[LOCK] = 8; // need mode bits
for (const c of '.,:^=bwEXvdfp~l') SEE[CH(c)] = 1;
for (const c of 'vdfp~loH|cC') BLOCK[CH(c)] = 1;
for (const c of 'vdfp~l') GLASS[CH(c)] = 1;
const MODE_PUBLIC = 1, MODE_ALL = 1 | 2 | 4 | 8;
const walkable = (c, mode) => (WALK[c] & mode) !== 0;

class Grid {
  constructor(W, H) { this.W = W; this.H = H; this.t = new Uint8Array(W * H).fill(WALL); this.room = new Int16Array(W * H); this.elev = new Uint8Array(W * H); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  get(x, y) { return this.in(x, y) ? this.t[y * this.W + x] : WALL; }
  set(x, y, c) { this.t[y * this.W + x] = c; }
  rid(x, y) { return this.in(x, y) ? this.room[y * this.W + x] : 0; }
  text() { let s = ''; for (let y = 0; y < this.H; y++) { for (let x = 0; x < this.W; x++) s += String.fromCharCode(this.t[y * this.W + x]); s += '\n'; } return s; }
}

// ---------------- rooms and openings ----------------
function newLayout() { return { G: null, rooms: [null], edges: [], meta: {}, log: [] }; }
function addRect(L, role, x0, y0, x1, y1, tags = {}, clip = null) {
  const id = L.rooms.length, r = { id, role, kind: 'rect', x0, y0, x1, y1, tags };
  L.rooms.push(r);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (clip && clip(x, y)) continue;
    L.G.set(x, y, FLOOR); L.G.room[y * L.G.W + x] = id;
  }
  return r;
}
function addDisc(L, role, cx, cy, R, tags = {}) {
  const id = L.rooms.length, r = { id, role, kind: 'disc', cx, cy, R, x0: cx - R, y0: cy - R, x1: cx + R, y1: cy + R, tags };
  L.rooms.push(r);
  for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy <= R * R + R) { L.G.set(x, y, FLOOR); L.G.room[y * L.G.W + x] = id; }
  }
  return r;
}
function centreOf(r) { return r.kind === 'disc' ? { x: r.cx, y: r.cy } : { x: (r.x0 + r.x1) >> 1, y: (r.y0 + r.y1) >> 1 }; }

function wallCandidates(L, a, b) {
  const G = L.G, A = L.rooms[a], B = L.rooms[b], out = [];
  const x0 = Math.max(1, Math.min(A.x0, B.x0) - 1), x1 = Math.min(G.W - 2, Math.max(A.x1, B.x1) + 1);
  const y0 = Math.max(1, Math.min(A.y0, B.y0) - 1), y1 = Math.min(G.H - 2, Math.max(A.y1, B.y1) + 1);
  const ok = (x, y, r) => G.rid(x, y) === r && WALK[G.get(x, y)] === 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (G.get(x, y) !== WALL) continue;
    if ((ok(x - 1, y, a) && ok(x + 1, y, b)) || (ok(x - 1, y, b) && ok(x + 1, y, a))) out.push({ x, y, dir: 'v' });
    else if ((ok(x, y - 1, a) && ok(x, y + 1, b)) || (ok(x, y - 1, b) && ok(x, y + 1, a))) out.push({ x, y, dir: 'h' });
  }
  return out;
}
function connect(L, a, b, o = {}) {
  let width = o.width || 3; const type = o.type || ARCH;
  const cands = wallCandidates(L, a, b);
  if (!cands.length) return null;
  const key = (x, y) => y * L.G.W + x, set = new Set(cands.map(c => key(c.x, c.y)));
  let good = cands;
  if (width === 3) {
    const g3 = cands.filter(c => c.dir === 'v' ? set.has(key(c.x, c.y - 1)) && set.has(key(c.x, c.y + 1)) : set.has(key(c.x - 1, c.y)) && set.has(key(c.x + 1, c.y)));
    if (g3.length) good = g3; else width = 1;
  }
  let c;
  const tdist = g => Math.abs(g.x - o.target.x) * (o.target.x == null ? 0 : 1) + Math.abs(g.y - o.target.y) * (o.target.y == null ? 0 : 1);
  if (o.target && width === 3) { let b3 = 1e9, b1 = 1e9; for (const g of good) b3 = Math.min(b3, tdist(g)); for (const g of cands) b1 = Math.min(b1, tdist(g)); if (b3 > 1 && b1 === 0) { good = cands; width = 1; } }
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
function bfs(G, starts, mode, blockedRoom = 0) {
  const N = G.W * G.H, D = new Int32Array(N).fill(-1), q = new Int32Array(N); let h = 0, t = 0;
  for (const s of starts) { if (D[s] < 0) { D[s] = 0; q[t++] = s; } }
  const W = G.W;
  while (h < t) {
    const i = q[h++], x = i % W, y = (i / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= G.H) continue;
      const j = yy * W + xx; if (D[j] >= 0) continue;
      if (!walkable(G.t[j], mode) || (blockedRoom && G.room[j] === blockedRoom)) continue;
      if (dx && dy) { const a = y * W + xx, b = yy * W + x; if (!walkable(G.t[a], mode) || !walkable(G.t[b], mode)) continue; }
      D[j] = D[i] + 1; q[t++] = j;
    }
  }
  return D;
}
function connectedPairs(L) { const s = new Set(); for (const e of L.edges) { s.add(e.a + ':' + e.b); s.add(e.b + ':' + e.a); } return s; }
function adjacentPairs(L) {
  const G = L.G, m = new Map();
  for (let y = 1; y < G.H - 1; y++) for (let x = 1; x < G.W - 1; x++) {
    if (G.get(x, y) !== WALL) continue;
    let p = null;
    const l = G.rid(x - 1, y), r = G.rid(x + 1, y), u = G.rid(x, y - 1), d = G.rid(x, y + 1);
    if (l && r && l !== r && WALK[G.get(x - 1, y)] === 1 && WALK[G.get(x + 1, y)] === 1) p = [Math.min(l, r), Math.max(l, r)];
    else if (u && d && u !== d && WALK[G.get(x, y - 1)] === 1 && WALK[G.get(x, y + 1)] === 1) p = [Math.min(u, d), Math.max(u, d)];
    if (p) { const k = p[0] + ':' + p[1]; if (!m.has(k)) m.set(k, p); }
  }
  return [...m.values()];
}
// Brogue-style addLoops at room-pair granularity: open a wall between adjacent rooms if walking between them is longer than d.
function addLoops(L, d, rng, o = {}) {
  if (!isFinite(d)) return 0;
  const pairs = rng.shuffle(adjacentPairs(L).sort((p, q) => p[0] - q[0] || p[1] - q[1]));
  let added = 0;
  for (const [a, b] of pairs) {
    const A = L.rooms[a], B = L.rooms[b];
    if (o.allow && !o.allow(A, B)) continue;
    const cands = wallCandidates(L, a, b); if (!cands.length) continue;
    const c = cands[(cands.length - 1) >> 1], G = L.G;
    const s1 = c.dir === 'v' ? [c.x - 1, c.y] : [c.x, c.y - 1], s2 = c.dir === 'v' ? [c.x + 1, c.y] : [c.x, c.y + 1];
    const D = bfs(G, [s1[1] * G.W + s1[0]], MODE_PUBLIC);
    const dist = D[s2[1] * G.W + s2[0]];
    if (dist >= 0 && dist <= d) continue;
    if (connect(L, a, b, { width: o.width || 3, type: o.type || ARCH, why: 'addLoops' })) added++;
  }
  return added;
}
function addStaffBand(L, rng, nDoors) {
  // a 2-high staff corridor along the top edge (y=1..2); programme geometry was offset by 3
  const G = L.G, r = addRect(L, 'staff', 1, 1, G.W - 2, 2, { staff: true });
  const touching = L.rooms.filter(q => q && q.id !== r.id && q.role !== 'staff' && wallCandidates(L, r.id, q.id).length);
  rng.shuffle(touching);
  let n = 0;
  for (const q of touching) { if (n >= nDoors) break; if (connect(L, r.id, q.id, { width: 1, type: STAFF, rng, why: 'staff' })) n++; }
  return r;
}
function splitLen(rng, total, minW, maxW) { // split a run of `total` tiles into rooms with 1-tile walls
  for (let tries = 0; tries < 50; tries++) {
    const ws = []; let left = total;
    while (left > 0) {
      if (left <= maxW && (left < 2 * minW + 1 || rng.pm(350))) { ws.push(left); left = 0; break; }
      const w = rng.int(minW, Math.min(maxW, left - minW - 1)); ws.push(w); left -= w + 1;
    }
    if (ws.every(w => w >= minW && w <= maxW)) return ws;
  }
  return [total];
}
function splitN(rng, total, n, minW) { // n rooms with 1-tile walls, near-equal widths with jitter
  n = Math.max(1, Math.min(n, Math.floor((total + 1) / (minW + 1))));
  const base = Math.floor((total - (n - 1)) / n), ws = new Array(n).fill(base); let left = total - (n - 1) - base * n;
  for (let i = 0; left > 0; i = (i + 1) % n, left--) ws[i]++;
  for (let k = 0; k < n; k++) { const i = rng.int(0, n - 1), j = rng.int(0, n - 1), d = rng.int(0, 2); if (i !== j && ws[i] - d >= minW) { ws[i] -= d; ws[j] += d; } }
  return ws;
}
function placeExits(L, room, rng, n, side) {
  const G = L.G, xs = [];
  if (side === 'S') { for (let x = room.x0; x <= room.x1; x++) if (G.get(x, room.y1 + 1) === WALL && room.y1 + 1 === G.H - 1) xs.push([x, room.y1 + 1]); }
  else { for (let y = room.y0; y <= room.y1; y++) if (G.get(room.x1 + 1, y) === WALL && room.x1 + 1 === G.W - 1) xs.push([room.x1 + 1, y]); }
  const ex = [];
  if (!xs.length) return ex;
  const step = Math.max(3, Math.floor(xs.length / n));
  for (let k = 0; k < n; k++) { const p = xs[Math.min(xs.length - 1, 1 + k * step)]; if (ex.every(e => Math.abs(e[0] - p[0]) + Math.abs(e[1] - p[1]) >= 3)) ex.push(p); }
  for (const [x, y] of ex) G.set(x, y, EXIT);
  return ex;
}

function closeEdge(L, e) { for (const [x, y] of e.tiles) L.G.set(x, y, WALL); L.edges.splice(L.edges.indexOf(e), 1); }
function roomCheck(L) { // cheap structural check on the room graph (public edges only)
  const pub = L.rooms.filter(r => r && r.role !== 'staff'), adj = new Map(pub.map(r => [r.id, []]));
  for (const e of L.edges) if (e.type !== 'S' && e.type !== 'h' && adj.has(e.a) && adj.has(e.b)) { adj.get(e.a).push(e.b); adj.get(e.b).push(e.a); }
  const intro = pub.find(r => r.role === 'intro'), centre = pub.find(r => r.role === 'centre'), coda = pub.find(r => r.role === 'coda');
  const reach = (from, skipRoom, skipEdge) => { const seen = new Set([from]), q = [from]; while (q.length) { const v = q.pop(); for (const w of adj.get(v)) { if (w === skipRoom) continue; if (skipEdge && ((v === skipEdge[0] && w === skipEdge[1]) || (v === skipEdge[1] && w === skipEdge[0]))) continue; if (!seen.has(w)) { seen.add(w); q.push(w); } } } return seen; };
  const all = reach(intro.id); if (pub.some(r => !all.has(r.id))) return false;
  if (!reach(intro.id, centre.id).has(coda.id) && centre !== intro) return false;
  const nb = [...new Set(adj.get(intro.id))]; if (nb.length < 2) return false;
  return nb.some(w => reach(intro.id, 0, [intro.id, w]).has(w)); // the Intro lies on a cycle
}
// a-space pass: convert rooms into dead ends (one opening) until the target count is met, keeping the structure valid
function aSpacePass(L, n, rng) {
  if (!n) return 0;
  const onVista = r => { if (!L.meta.cpl) return false; const [ex, ey] = L.meta.entrance, [cx, cy] = L.meta.cpl; return lineTiles(ex, ey, cx, cy).some(([x, y]) => L.G.rid(x, y) === r.id); };
  const cand = rng.shuffle(L.rooms.filter(r => r && (r.role === 'section') && !r.tags.central && !r.tags.deadEnd && r.kind === 'rect' && (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1) <= 70 && !onVista(r)));
  let made = 0;
  for (const r of cand) {
    if (made >= n) break;
    const es = L.edges.filter(e => (e.a === r.id || e.b === r.id) && e.type !== 'S');
    if (es.length < 2) continue;
    const keep = es.slice().sort((a, b) => a.width - b.width)[0];
    const removed = es.filter(e => e !== keep);
    const saved = removed.map(e => ({ e, t: e.tiles.map(([x, y]) => L.G.get(x, y)) }));
    for (const e of removed) closeEdge(L, e);
    if (roomCheck(L)) { r.role = 'study'; r.tags.deadEnd = true; r.tags.noLoops = true; if (keep.width === 1) { for (const [x, y] of keep.tiles) L.G.set(x, y, DOOR); keep.type = '+'; } made++; }
    else for (const { e, t } of saved) { e.tiles.forEach(([x, y], k) => L.G.set(x, y, t[k])); L.edges.push(e); }
  }
  return made;
}

// ---------------- programme embedders ----------------
function scaleOf(size) { return size; } // 0 Cabinet, 1 Department, 2 Wing (run-structure size classes)

function embedEnfilade(L, K, rng) {
  const oy = K.staff ? 3 : 0;
  const maxRow = 44 - K.introW - K.cW;
  let wN = []; for (let i = 0; i < K.nN; i++) wN.push(rng.int(6, 9));
  const len = a => a.reduce((s, w) => s + w, 0) + a.length - 1;
  while (len(wN) > maxRow) { let m = 0; for (let i = 1; i < wN.length; i++) if (wN[i] > wN[m]) m = i; if (wN[m] <= 5) { wN.pop(); } else wN[m]--; }
  const rowLen = len(wN);
  const wS = splitN(rng, rowLen, K.nS, 5);
  const xs = K.introW + 2, xe = xs + rowLen - 1;
  const cab = K.cabinets > 0 ? 5 : 0;
  const yN0 = 1 + oy + cab, yN1 = yN0 + K.hN - 1, yS0 = yN1 + 2, yS1 = yS0 + K.hS - 1;
  const W = xe + 1 + K.cW + 2, H = yS1 + 2;
  L.G = new Grid(W, H);
  const intro = addRect(L, 'intro', 1, yN0, K.introW, yS1);
  const N = [], S = [];
  let x = xs; for (const w of wN) { N.push(addRect(L, 'section', x, yN0, x + w - 1, yN1, { row: 'N' })); x += w + 1; }
  x = xs; for (const w of wS) { S.push(addRect(L, K.rows2 ? 'section' : 'section', x, yS0, x + w - 1, yS1, { row: 'S', long: !K.rows2 })); x += w + 1; }
  if (cab) { // cabinets: small dead-end rooms above chosen north rooms, one door each
    for (const n of rng.shuffle(N.slice()).slice(0, K.cabinets)) {
      const w = Math.min(n.x1 - n.x0 + 1, rng.int(4, 6)), x0 = n.x0 + rng.int(0, n.x1 - n.x0 + 1 - w);
      const c = addRect(L, 'study', x0, yN0 - 5, x0 + w - 1, yN0 - 2, { noLoops: true, deadEnd: true, cabinet: true });
      connect(L, c.id, n.id, { width: 1, type: DOOR, rng });
    }
  }
  const C = addRect(L, 'centre', xe + 2, yN0, xe + 1 + K.cW, yN1, { onRing: true });
  const coda = addRect(L, 'coda', xe + 2, yS0, xe + 1 + K.cW, yS1);
  const axN = yN0 + (K.hN >> 1), axS = yS0 + (K.hS >> 1);
  L.G.set(0, axN, ENT); L.meta.entrance = [0, axN];
  connect(L, intro.id, N[0].id, { target: { x: null, y: axN } });
  for (let i = 0; i + 1 < N.length; i++) connect(L, N[i].id, N[i + 1].id, { target: { x: null, y: axN } });
  connect(L, N[N.length - 1].id, C.id, { target: { x: null, y: axN } });
  const sw = K.hS >= 5 ? 3 : 1;
  connect(L, intro.id, S[0].id, { width: sw, target: { x: null, y: axS } });
  for (let i = 0; i + 1 < S.length; i++) connect(L, S[i].id, S[i + 1].id, { width: sw, target: rng.pm(K.alignS) ? { x: null, y: axS } : null, rng });
  connect(L, S[S.length - 1].id, coda.id, { width: sw, target: { x: null, y: axS } });
  connect(L, C.id, coda.id, { width: 3, rng });
  const pairs = []; for (const n of N) for (const s of S) if (wallCandidates(L, n.id, s.id).length >= 3) pairs.push([n, s]);
  rng.shuffle(pairs);
  for (let i = 0; i < Math.min(K.cross, pairs.length); i++) connect(L, pairs[i][0].id, pairs[i][1].id, { width: rng.pm(500) ? 3 : 1, type: ARCH, rng, why: 'crosslink' });
  L.meta.cpl = [C.x1 - 1, axN]; L.G.set(C.x1 - 1, axN, CPL);
  L.meta.vistaRequired = true; L.meta.formal = true; L.meta.axisY = axN;
  L.meta.exits = placeExits(L, coda, rng, K.exits, 'E');
  if (K.staff) addStaffBand(L, rng, K.staffDoors);
}

function embedRotunda(L, K, rng) {
  const oy = K.staff ? 3 : 0, R = K.R, h = K.armW >> 1, le = K.armE, ln = K.armN;
  const cx = le + 2 + R, cy = oy + ln + 2 + R;
  const W = 2 * le + 2 * R + 5, H = cy + R + 1 + ln + 2;
  L.G = new Grid(W, H);
  const hub = addDisc(L, 'hub', cx, cy, R, { landmark: true });
  const intro = addRect(L, 'intro', 1, cy - h, le, cy + h);
  const Ex0 = cx + R + 2, Ex1 = cx + R + 1 + le;
  let E1, E2 = null;
  const eRole = K.centreInHub ? 'section' : 'centre';
  if (le >= 11 && rng.pm(K.split)) { const a = le >> 1; E1 = addRect(L, 'section', Ex0, cy - h, Ex0 + a - 1, cy + h); E2 = addRect(L, eRole, Ex0 + a + 1, cy - h, Ex1, cy + h); }
  else E1 = addRect(L, eRole, Ex0, cy - h, Ex1, cy + h);
  const Ny0 = 1 + oy, Ny1 = cy - R - 2, Sy0 = cy + R + 2, Sy1 = cy + R + 1 + ln;
  const Narm = K.arms === 4 ? addRect(L, 'section', cx - h, Ny0, cx + h, Ny1) : null;
  const Sarm = addRect(L, 'section', cx - h, Sy0, cx + h, Sy1);
  const clip = (x, y) => { const dx = x - cx, dy = y - cy; return dx * dx + dy * dy <= (R + 2) * (R + 2); };
  const corner = {};
  const mk = (name, x0, y0, x1, y1, role) => { if (x1 - x0 >= 3 && y1 - y0 >= 3) corner[name] = addRect(L, role, x0, y0, x1, y1, { corner: name }, clip); };
  const order = rng.shuffle(['NW', 'NE', 'SW']);
  const present = new Set(['SE', ...order.slice(0, K.corners - 1)]);
  present.add('SW'); // the Intro's ambulatory corner: guarantees a cycle through the Intro and a bypass of the hub
  if (present.has('NW')) mk('NW', 1, Ny0, cx - h - 2, cy - h - 2, 'section');
  if (present.has('NE')) mk('NE', cx + h + 2, Ny0, W - 2, cy - h - 2, 'section');
  if (present.has('SW')) mk('SW', 1, cy + h + 2, cx - h - 2, H - 2, 'section');
  mk('SE', cx + h + 2, cy + h + 2, W - 2, H - 2, 'coda');
  L.G.set(0, cy, ENT); L.meta.entrance = [0, cy];
  connect(L, intro.id, hub.id, { target: { x: null, y: cy } });
  connect(L, hub.id, E1.id, { target: { x: null, y: cy } });
  if (E2) connect(L, E1.id, E2.id, { target: { x: null, y: cy } });
  if (Narm) connect(L, hub.id, Narm.id, { target: { x: cx, y: null } });
  connect(L, hub.id, Sarm.id, { target: { x: cx, y: null } });
  const armOf = { NW: [intro, Narm], NE: [E2 || E1, Narm], SW: [intro, Sarm], SE: [E2 || E1, Sarm] };
  for (const name of Object.keys(corner)) {
    const c = corner[name], arms = armOf[name].filter(Boolean);
    if (name === 'SE') { // coda: always reachable from the S arm (bypass) and from the E arm
      for (const a of arms) connect(L, c.id, a.id, { width: 3, rng });
      continue;
    }
    if (K.amb || ((name === 'SW' || name === 'NW') && arms.includes(intro))) { for (const a of arms) connect(L, c.id, a.id, { width: K.ambW, rng, why: 'ambulatory' }); }
    else connect(L, c.id, rng.pick(arms).id, { width: K.ambW, rng });
  }
  if (K.centreInHub) {
    L.meta.cpl = [cx, cy]; L.G.set(cx, cy, CPL);
    hub.role = 'centre'; hub.tags.onRing = true;
  } else {
    const C = E2 || E1; L.meta.cpl = [C.x1 - 1, cy]; L.G.set(C.x1 - 1, cy, CPL);
    L.G.set(cx, cy, LOWF); // fountain basin in the hub: see-through landmark
  }
  // column ring at radius R-2, never on the axes
  if (R >= 5 && !K.centreInHub) {
    const k = Math.round((R - 2) * 0.7071);
    const pts = [[k, k], [-k, k], [k, -k], [-k, -k]];
    if (rng.pm(K.colDensity * 2)) pts.push([R - 2, Math.round((R - 2) * 0.38)], [-(R - 2), -Math.round((R - 2) * 0.38)], [Math.round((R - 2) * 0.38), -(R - 2)], [-Math.round((R - 2) * 0.38), R - 2]);
    for (const [dx, dy] of pts) L.G.set(cx + dx, cy + dy, COL);
  }
  L.meta.vistaRequired = true; L.meta.formal = true; L.meta.axisY = cy;
  L.meta.exits = placeExits(L, corner.SE, rng, K.exits, rng.pm(500) ? 'E' : 'S');
  if (!L.meta.exits.length) L.meta.exits = placeExits(L, corner.SE, rng, K.exits, 'E');
  if (K.staff) addStaffBand(L, rng, K.staffDoors);
}

function embedHallScaffold(L, K, rng, fill) {
  const oy = K.staff ? 3 : 0, yTop = 1 + oy;
  const introX1 = K.introW, cx0 = introX1 + 2, cx1 = cx0 + K.cW - 1, ax0 = cx1 + 2, ax1 = ax0 + K.apseW - 1;
  const W = ax1 + 2;
  const nY0 = yTop, nY1 = nY0 + K.bandH - 1;
  const cy0 = K.bandN ? nY1 + 2 : yTop, cy1 = cy0 + K.cH - 1;
  const sY0 = cy1 + 2, sY1 = sY0 + K.bandH - 1, H = sY1 + 2;
  L.G = new Grid(W, H);
  const axis = K.axis != null ? cy0 + K.axis : cy0 + (K.cH >> 1);
  const intro = addRect(L, 'intro', 1, cy0, introX1, cy1);
  const central = addRect(L, 'section', cx0, cy0, cx1, cy1, { central: true, filled: true });
  const win = K.access === 'window';
  const aH = win ? K.cH : Math.min(K.cH, K.apseH);
  const apse = win ? addRect(L, 'centre', ax0, cy0, ax1, cy1, { apse: true, noLoops: true }) : addRect(L, 'centre', ax0, axis - (aH >> 1), ax1, axis - (aH >> 1) + aH - 1, { apse: true, noLoops: true });
  const northRooms = [];
  if (K.bandN) { let x = 1; for (const w of splitN(rng, (win ? ax1 : cx1) - 1 + 1, win ? Math.max(3, K.nBandN) : K.nBandN, 5)) { northRooms.push(addRect(L, 'section', x, nY0, x + w - 1, nY1, { band: 'N' })); x += w + 1; } }
  const southRooms = [];
  { // coda is the east end of the south band, spanning under the apse
    const codaW = K.apseW + rng.int(3, 6);
    const runLen = ax1 - codaW - 1; // tiles 1..runLen for the other rooms
    let x = 1; for (const w of splitN(rng, runLen, K.nBandS, 5)) { southRooms.push(addRect(L, 'section', x, sY0, x + w - 1, sY1, { band: 'S' })); x += w + 1; }
    southRooms.push(addRect(L, 'coda', x, sY0, ax1, sY1, { band: 'S' }));
  }
  fill(L, central, K, rng, axis);
  L.G.set(0, axis, ENT); L.meta.entrance = [0, axis];
  connect(L, intro.id, central.id, { target: { x: null, y: axis } });
  if (win) { // the Masterpiece is seen through a glazed screen on the axis; the way in is round by a band room
    for (let y = axis - 1; y <= axis + 1; y++) L.G.set(cx1 + 1, y, VIT);
    const nLast = northRooms[northRooms.length - 1];
    const via = (nLast && wallCandidates(L, nLast.id, apse.id).length) ? nLast : null;
    if (via) connect(L, via.id, apse.id, { width: 3, rng, why: 'apseAccess' });
  } else connect(L, central.id, apse.id, { target: { x: null, y: axis } });
  for (const band of [northRooms, southRooms]) {
    for (let i = 0; i + 1 < band.length; i++) connect(L, band[i].id, band[i + 1].id, { width: rng.pm(500) ? 3 : 1, rng });
    for (let i = 0; i < band.length; i++) {
      const r = band[i]; const must = r.role === 'coda' || i <= 1 || i >= band.length - 2;
      if (wallCandidates(L, r.id, intro.id).length) connect(L, r.id, intro.id, { width: 3, rng });
      if (must || rng.pm(K.bandLinks)) connect(L, r.id, central.id, { width: rng.pm(600) ? 3 : 1, rng });
    }
  }
  const coda = southRooms[southRooms.length - 1];
  if (win && !L.edges.some(e => e.a === apse.id || e.b === apse.id)) connect(L, coda.id, apse.id, { width: 3, rng, why: 'apseAccess' });
  L.meta.cpl = [apse.x1 - 1, axis]; L.G.set(apse.x1 - 1, axis, CPL);
  L.meta.axisY = axis;
  L.meta.exits = placeExits(L, coda, rng, K.exits, 'S');
  if (K.staff) addStaffBand(L, rng, K.staffDoors);
  return central;
}

function fillGrandHall(L, c, K, rng, axis) {
  const G = L.G, d = K.balcD;
  const bx0 = c.x0, bx1 = c.x1 - 4;
  const balc = (y0, y1, yb) => {
    for (let y = y0; y <= y1; y++) for (let x = bx0; x <= bx1; x++) { G.set(x, y, BALC); G.elev[y * G.W + x] = 1; }
    for (let y = y0; y <= y1; y++) G.set(bx1 + 1, y, VOID);
    for (let x = bx0; x <= bx1 + 1; x++) G.set(x, yb, VOID);
    const st = [bx0 + 1, bx1 - 1]; if (K.stairs === 3) st.push((bx0 + bx1) >> 1);
    for (const x of st) G.set(x, yb, STAIR);
  };
  balc(c.y0, c.y0 + d - 1, c.y0 + d);
  if (K.balcSides === 2) balc(c.y1 - d + 1, c.y1, c.y1 - d);
  const fy0 = c.y0 + d + 1, fy1 = K.balcSides === 2 ? c.y1 - d - 1 : c.y1;
  // symmetric bays: vitrine pairs either side of the axis every `pitch` tiles, a landmark plinth run on the axis
  const pitch = K.bayPitch;
  for (let x = c.x0 + 3; x <= c.x1 - 3; x += pitch) {
    for (const s of [-1, 1]) { const y = axis + s * K.bayOff; if (y > fy0 && y < fy1) { G.set(x, y, VIT); if (rng.pm(K.bayDensity)) G.set(x + 1, y, VIT); } }
  }
  const mid = (c.x0 + c.x1) >> 1;
  for (let x = mid - 1; x <= mid + 1; x++) G.set(x, axis, PLINTH);
  for (const s of [-1, 1]) { const y = axis + s * (K.bayOff + 2); if (y > fy0 && y < fy1) { G.set(mid - 3, y, COL); G.set(mid + 3, y, COL); } }
  L.meta.vistaRequired = true; L.meta.formal = true; L.meta.elevated = true;
}
function fillLabyrinth(L, c, K, rng, axis) {
  const G = L.G, nx = (c.x1 - c.x0 + 2) / 3 | 0, ny = (c.y1 - c.y0 + 2) / 3 | 0;
  for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) if ((x - c.x0) % 3 === 2 || (y - c.y0) % 3 === 2) G.set(x, y, VIT);
  // wall state between cells: E[j*nx+i] = wall east of (i,j); S[j*nx+i] = wall south of (i,j); 1 = closed
  const E = new Uint8Array(nx * ny).fill(1), S = new Uint8Array(nx * ny).fill(1);
  const setWall = (i, j, dir, closed) => {
    if (dir === 'E') { E[j * nx + i] = closed; const x = c.x0 + 3 * i + 2; for (const y of [c.y0 + 3 * j, c.y0 + 3 * j + 1]) G.set(x, y, closed ? VIT : FLOOR); }
    else { S[j * nx + i] = closed; const y = c.y0 + 3 * j + 2; for (const x of [c.x0 + 3 * i, c.x0 + 3 * i + 1]) G.set(x, y, closed ? VIT : FLOOR); }
  };
  const nbrs = (i, j) => { const o = []; if (i + 1 < nx && !E[j * nx + i]) o.push([i + 1, j]); if (i > 0 && !E[j * nx + i - 1]) o.push([i - 1, j]); if (j + 1 < ny && !S[j * nx + i]) o.push([i, j + 1]); if (j > 0 && !S[(j - 1) * nx + i]) o.push([i, j - 1]); return o; };
  const mid = (axis - c.y0) / 3 | 0;
  const seen = new Uint8Array(nx * ny), st = [[0, mid]]; seen[mid * nx] = 1;
  while (st.length) { // randomised DFS spanning tree
    const [i, j] = st[st.length - 1];
    const nb = rng.shuffle([[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < nx && b < ny && !seen[b * nx + a]));
    if (!nb.length) { st.pop(); continue; }
    const [a, b] = nb[0]; seen[b * nx + a] = 1;
    if (a !== i) setWall(Math.min(a, i), j, 'E', 0); else setWall(i, Math.min(b, j), 'S', 0);
    st.push([a, b]);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { // extra connectors (Nystrom)
    if (i + 1 < nx && E[j * nx + i] && rng.pm(K.loopP)) setWall(i, j, 'E', 0);
    if (j + 1 < ny && S[j * nx + i] && rng.pm(K.loopP)) setWall(i, j, 'S', 0);
  }
  const bfsCells = () => { const D = new Int32Array(nx * ny).fill(-1), P = new Int32Array(nx * ny).fill(-1), q = [mid * nx]; D[mid * nx] = 0; while (q.length) { const v = q.shift(), i = v % nx, j = v / nx | 0; for (const [a, b] of nbrs(i, j)) { const w = b * nx + a; if (D[w] < 0) { D[w] = D[v] + 1; P[w] = v; q.push(w); } } } return { D, P }; };
  // enforce walking tortuosity across the labyrinth: close walls on the shortest path while all cells stay connected
  for (let k = 0; k < 40; k++) {
    const { D, P } = bfsCells(); const goal = mid * nx + nx - 1;
    if (D[goal] * 1000 >= K.tortMin * (nx - 1)) break;
    const path = []; for (let v = goal; P[v] >= 0; v = P[v]) path.push([P[v], v]);
    let closed = false;
    for (const [u, v] of rng.shuffle(path)) {
      const ui = u % nx, uj = u / nx | 0, vi = v % nx, vj = v / nx | 0;
      const dir = ui !== vi ? 'E' : 'S', i = Math.min(ui, vi), j = Math.min(uj, vj);
      setWall(i, j, dir, 1);
      if (bfsCells().D.every(d => d >= 0)) { closed = true; break; }
      setWall(i, j, dir, 0);
    }
    if (!closed) break;
  }
  for (let k = 0; k < K.clearings; k++) { // a 2x2-cell clearing with an island case in the middle
    const i = rng.int(1, nx - 3), j = rng.int(0, ny - 2);
    for (let y = c.y0 + 3 * j; y <= c.y0 + 3 * j + 4; y++) for (let x = c.x0 + 3 * i; x <= c.x0 + 3 * i + 4; x++) G.set(x, y, FLOOR);
    G.set(c.x0 + 3 * i + 2, c.y0 + 3 * j + 2, rng.pm(500) ? COL : PART);
  }
  for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) { const x = c.x0 + 3 * i + 2, y = c.y0 + 3 * j + 2; if (G.get(x, y) === VIT && rng.pm(K.opaquePosts)) G.set(x, y, COL); }
  L.meta.vistaRequired = true;
}
function fillStacks(L, c, K, rng, axis) {
  const G = L.G;
  const rows = [];
  for (let y = c.y0 + 1; y + 1 <= c.y1 - 1; y += 2 + K.aisle) rows.push(y);
  for (const y of rows) {
    let x = c.x0 + 1, b = 0;
    while (x + 2 <= c.x1 - 1) {
      const len = Math.min(K.blockLen, c.x1 - 1 - x + 1);
      if (len >= 3 && !rng.pm(K.deleteP)) {
        const brk = rng.pm(K.breakP) ? x + (len >> 1) : -1;
        for (let xx = x; xx < x + len; xx++) for (const yy of [y, y + 1]) if (xx !== brk && yy <= c.y1 - 1) G.set(xx, yy, SHELF);
      }
      b++;
      x += len + ((b % K.crossEvery) === 0 ? 2 : 1);
    }
  }
  for (let x = c.x0; x <= c.x1; x++) { G.set(x, axis, FLOOR); if (K.mainAisle2) G.set(x, axis + 1, FLOOR); }
  // crates in aisles
  for (let k = 0; k < K.crates; k++) { const x = rng.int(c.x0 + 1, c.x1 - 1), y = rng.int(c.y0 + 1, c.y1 - 1); if (G.get(x, y) === FLOOR && y !== axis && y !== axis + 1) G.set(x, y, CRATE); }
  L.meta.vistaRequired = false; L.meta.dark = true;
}
function fillCourt(L, c, K, rng, axis) {
  const G = L.G;
  let ix0 = c.x0, iy0 = c.y0, ix1 = c.x1, iy1 = c.y1;
  if (K.loggia) {
    for (let x = c.x0 + 1; x <= c.x1 - 1; x += 2) { if (x !== c.x0 + 1 || true) { G.set(x, c.y0 + 1, COL); G.set(x, c.y1 - 1, COL); } }
    for (let y = c.y0 + 3; y <= c.y1 - 3; y += 2) { if (Math.abs(y - axis) > 1) { G.set(c.x0 + 1, y, COL); G.set(c.x1 - 1, y, COL); } }
    ix0 += 3; iy0 += 3; ix1 -= 3; iy1 -= 3;
  }
  const mid = (c.x0 + c.x1) >> 1;
  const pool = [];
  if (K.pool) { const pw = K.poolW, ph = 3; for (let y = axis - 1; y <= axis + 1; y++) for (let x = mid - (pw >> 1); x <= mid + (pw >> 1); x++) { G.set(x, y, VOID); pool.push([x, y]); } }
  const pts = [];
  const okp = (x, y) => x >= ix0 + 1 && x <= ix1 - 1 && y >= iy0 + 1 && y <= iy1 - 1 && y !== axis && G.get(x, y) === FLOOR &&
    pts.every(([a, b]) => (a - x) * (a - x) + (b - y) * (b - y) >= K.spacing * K.spacing) &&
    pool.every(([a, b]) => Math.max(Math.abs(a - x), Math.abs(b - y)) >= 2);
  for (let t = 0; t < K.tries; t++) {
    const x = rng.int(ix0 + 1, ix1 - 1), y = rng.int(iy0 + 1, iy1 - 1);
    if (!okp(x, y)) continue;
    const mirror = K.symmetry ? 2 * axis - y : null;
    if (mirror != null && (mirror === y || !okp(x, mirror))) continue;
    const kind = rng.pm(K.lowShare) ? PLINTH : COL;
    pts.push([x, y]); G.set(x, y, kind);
    if (mirror != null) { pts.push([x, mirror]); G.set(x, mirror, kind); }
  }
  L.meta.vistaRequired = true; L.meta.bright = true;
}

// ---------------- knobs per programme (ranges scale with tier) ----------------
const PROGRAMMES = {
  enfilade: {
    d: 20, knobs: (r, s) => { const rows2 = s === 2 ? 1 : s === 1 ? (r.pm(400) ? 1 : 0) : 0; const nN = s === 0 ? 2 : s === 1 ? (rows2 ? 2 : 3) : r.int(3, 4); return { rows2, nN, nS: rows2 ? nN : (s === 0 ? 1 : r.int(1, 2)), hN: r.int(7, 9 + s), introW: r.int(6, 8), cW: r.int(9, 11), alignS: r.int(600, 1000), cross: r.int(0, 1 + s), cabinets: s === 0 ? 0 : r.int(0, s), exits: r.int(2, 3), staff: r.pm(700) ? 1 : 0, staffDoors: r.int(2, 3), hS: 0 }; },
    post: K => { K.hS = K.rows2 ? K.hN - 1 + (K.hN & 1) : 5; },
    embed: embedEnfilade,
  },
  rotunda: {
    d: 20, knobs: (r, s) => ({ R: r.int(4, 5 + (s > 0 ? 1 : 0)), armW: r.pick([7, 9]), armE: r.int(9, 10 + s), armN: r.int(7, 7 + s), arms: s === 0 ? 3 : s === 1 ? (r.pm(500) ? 4 : 3) : 4, corners: s === 0 ? 2 : s === 1 ? r.int(2, 3) : r.int(3, 4), amb: r.pm(750) ? 1 : 0, ambW: r.pm(500) ? 3 : 1, studies: s === 0 ? 0 : r.int(0, 1), colDensity: r.int(0, 500), centreInHub: r.pm(400) ? 1 : 0, split: s === 0 ? 0 : s === 1 ? r.int(0, 500) : 1000, exits: r.int(2, 3), staff: r.pm(500) ? 1 : 0, staffDoors: 2 }),
    embed: embedRotunda,
  },
  grand_hall: {
    d: 20, knobs: (r, s) => ({ introW: r.int(6, 7), cW: r.int(16 + 3 * s, 20 + 3 * s), cH: r.pick([11, 13, 15, 17].slice(s, s + 2)), apseW: r.int(7, 9), apseH: r.pick([7, 9]), bandH: r.int(5, 6), bandN: s === 0 ? 0 : s === 2 ? 1 : (r.pm(500) ? 1 : 0), access: r.pm(500) ? 'window' : 'axis', nBandS: s === 0 ? 1 : s === 1 ? 2 : 3, nBandN: s === 2 ? 3 : r.int(1, 2), bandLinks: r.int(300, 700), studies: s === 0 ? 0 : s === 1 ? 1 : r.int(1, 2), balcD: r.int(2, 3), balcSides: r.pm(600) ? 2 : 1, stairs: r.int(2, 3), bayPitch: r.int(4, 6), bayOff: r.int(2, 3), bayDensity: r.int(300, 800), exits: r.int(2, 3), staff: r.pm(500) ? 1 : 0, staffDoors: 2 }),
    embed: (L, K, r) => embedHallScaffold(L, K, r, fillGrandHall),
  },
  case_labyrinth: {
    d: 20, knobs: (r, s) => { const nx = r.int(5 + s, 6 + s), ny = r.int(4, 4 + (s > 0 ? 1 : 0)); return { introW: r.int(6, 7), cW: 3 * nx - 1, cH: 3 * ny - 1, axis: 3 * (ny >> 1), apseW: r.int(7, 9), apseH: r.pick([7, 9]), bandH: r.int(5, 6), bandN: s === 0 ? 0 : s === 2 ? 1 : (r.pm(500) ? 1 : 0), access: r.pm(500) ? 'window' : 'axis', nBandS: s === 0 ? 1 : s === 1 ? 2 : 3, nBandN: s === 2 ? 3 : r.int(1, 2), bandLinks: r.int(200, 600), studies: s === 0 ? 0 : s === 1 ? 1 : r.int(1, 2), tortMin: r.int(1300, 1700), loopP: r.int(80, 300), clearings: r.int(0, 1), opaquePosts: r.int(0, 300), exits: r.int(2, 3), staff: r.pm(500) ? 1 : 0, staffDoors: 2 }; },
    embed: (L, K, r) => embedHallScaffold(L, K, r, fillLabyrinth),
  },
  storage_stacks: {
    d: 20, knobs: (r, s) => ({ introW: r.int(6, 7), cW: r.int(16 + 3 * s, 20 + 3 * s), cH: r.int(11 + s, 13 + 2 * s), apseW: r.int(7, 9), apseH: r.pick([7, 9]), bandH: r.int(5, 6), bandN: s === 0 ? 0 : s === 2 ? 1 : (r.pm(500) ? 1 : 0), access: r.pm(500) ? 'window' : 'axis', nBandS: s === 0 ? 1 : s === 1 ? 2 : 3, nBandN: s === 2 ? 3 : r.int(1, 2), bandLinks: r.int(200, 500), studies: s === 0 ? 0 : s === 1 ? 1 : r.int(1, 2), aisle: r.pm(500) ? 1 : 2, blockLen: r.int(4, 8), crossEvery: r.int(2, 3), deleteP: r.int(0, 200), breakP: r.int(50, 250), mainAisle2: r.pm(400) ? 1 : 0, crates: r.int(0, 6), exits: r.int(2, 3), staff: r.pm(700) ? 1 : 0, staffDoors: 3 }),
    embed: (L, K, r) => embedHallScaffold(L, K, r, fillStacks),
  },
  sculpture_court: {
    d: 20, knobs: (r, s) => ({ introW: r.int(6, 7), cW: r.int(16 + 3 * s, 20 + 3 * s), cH: r.pick([11, 13, 15, 17].slice(s, s + 2)), apseW: r.int(7, 9), apseH: r.pick([7, 9]), bandH: r.int(5, 6), bandN: s === 0 ? 0 : s === 2 ? 1 : (r.pm(500) ? 1 : 0), access: r.pm(500) ? 'window' : 'axis', nBandS: s === 0 ? 1 : s === 1 ? 2 : 3, nBandN: s === 2 ? 3 : r.int(1, 2), bandLinks: r.int(300, 700), studies: s === 0 ? 0 : s === 1 ? 1 : r.int(1, 2), loggia: r.pm(500) ? 1 : 0, pool: r.pm(600) ? 1 : 0, poolW: r.pick([3, 5]), spacing: r.int(3, 5), tries: r.int(30, 80), symmetry: r.pm(500) ? 1 : 0, lowShare: r.int(100, 400), exits: r.int(2, 3), staff: r.pm(500) ? 1 : 0, staffDoors: 2 }),
    embed: (L, K, r) => embedHallScaffold(L, K, r, fillCourt),
  },
};

// ---------------- curation (bays + seasoning), simplified ----------------
function roomTiles(L, r) { const G = L.G, out = []; for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (G.rid(x, y) === r.id) out.push(y * G.W + x); return out; }
function roomOpenings(L, r) {
  const G = L.G, W = G.W, out = [];
  for (const i of roomTiles(L, r)) { const x = i % W, y = i / W | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = G.get(x + dx, y + dy); if (c === ARCH || c === DOOR || c === STAFF || c === LOCK || c === ENT || c === EXIT || c === HIDDEN) { out.push(i); break; } } }
  return out;
}
function bfsRoom(G, r, starts) { // 4-connected inside room, walkable only
  const W = G.W, D = new Map(), q = [...starts]; for (const s of starts) D.set(s, 0);
  while (q.length) { const i = q.shift(), x = i % W, y = i / W | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + dy) * W + x + dx; if (D.has(j) || G.room[j] !== r.id || WALK[G.t[j]] !== 1) continue; D.set(j, D.get(i) + 1); q.push(j); } }
  return D;
}
function reserveWalkways(L, r, formal) {
  const G = L.G, W = G.W, res = new Set(), ops = roomOpenings(L, r);
  for (const o of ops) { const x = o % W, y = o / W | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) res.add((y + dy) * W + x + dx); }
  for (let a = 0; a < ops.length; a++) {
    const D = bfsRoom(G, r, [ops[a]]);
    for (let b = a + 1; b < ops.length; b++) {
      let cur = ops[b]; if (!D.has(cur)) continue;
      while (D.get(cur) > 0) { res.add(cur); if (formal) { res.add(cur + 1); res.add(cur - 1); res.add(cur + W); res.add(cur - W); } const x = cur % W, y = cur / W | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + dy) * W + x + dx; if (D.has(j) && D.get(j) === D.get(cur) - 1) { cur = j; break; } } }
      res.add(cur);
    }
  }
  return { res, ops };
}
function roomStillCirculates(L, r, ops) {
  if (!ops.length) return true;
  const D = bfsRoom(L.G, r, [ops[0]]);
  if (!ops.every(o => D.has(o))) return false;
  // every case keeps a reachable neighbour
  const G = L.G, W = G.W;
  for (const i of roomTiles(L, r)) { if (G.t[i] !== VIT && G.t[i] !== PLINTH) continue; const x = i % W, y = i / W | 0; let ok = false; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (D.has((y + dy) * W + x + dx)) ok = true; if (!ok) return false; }
  return true;
}
function lineTiles(x0, y0, x1, y1) { const out = []; let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1, err = dx - dy, x = x0, y = y0; for (;;) { out.push([x, y]); if (x === x1 && y === y1) break; const e2 = 2 * err; if (e2 > -dy) { err -= dy; x += sx; } if (e2 < dx) { err += dx; y += sy; } } return out; }
function curate(L, K, rngBase, gates) {
  const G = L.G, W = G.W;
  const noOpaque = new Set();
  if (L.meta.vistaRequired) { const [ex, ey] = L.meta.entrance, [cx, cy] = L.meta.cpl; for (const [x, y] of lineTiles(ex, ey, cx, cy)) noOpaque.add(y * W + x); }
  for (const r of L.rooms) {
    if (!r || r.role === 'staff') continue;
    const rng = Stream(rngBase + '/room/' + r.role + '.' + r.id + '/curate');
    const tiles = roomTiles(L, r);
    const { res, ops } = reserveWalkways(L, r, !!L.meta.formal);
    const free = i => G.t[i] === FLOOR && !res.has(i) && !gates.has(i);
    const tryPut = (i, c) => { if (!free(i)) return false; if (!SEE[c] && noOpaque.has(i)) return false; const old = G.t[i]; G.t[i] = c; if (!roomStillCirculates(L, r, ops)) { G.t[i] = old; return false; } return true; };
    if (!r.tags.filled) {
      // wall runs of cases: tiles adjacent to a wall (but not to an opening), probability by role
      const p = r.role === 'study' ? 650 : r.role === 'coda' ? 250 : r.role === 'centre' ? 0 : 450;
      for (const i of tiles) {
        const x = i % W, y = i / W | 0;
        const wallN = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => G.get(x + dx, y + dy) === WALL).length;
        if (wallN !== 1) continue; // corners excluded
        if ((x + y) % 3 === 0) continue; // gaps in runs
        if (rng.pm(p)) tryPut(i, VIT);
      }
    }
    // seasoning: combat-sized rooms need >=1 opaque and >=1 see-through blocker, and cover within 6 tiles
    const floorN = tiles.filter(i => WALK[G.t[i]] === 1).length;
    const wallAdj = i => { const x = i % W, y = i / W | 0; return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => G.get(x + dx, y + dy) === WALL); };
    if (r.role === 'centre') {
      const [px, py] = L.meta.cpl;
      const ring = tiles.filter(i => free(i) && wallAdj(i));
      const byDist = d => ring.filter(i => Math.max(Math.abs(i % W - px), Math.abs((i / W | 0) - py)) === d);
      for (const i of byDist(3).concat(byDist(4))) if (tryPut(i, LECT)) break;
      for (const i of rng.shuffle(ring.slice())) if (G.t[i] === FLOOR && Math.max(Math.abs(i % W - px), Math.abs((i / W | 0) - py)) >= 3 && tryPut(i, COL)) break;
      for (const i of rng.shuffle(ring.slice())) if (G.t[i] === FLOOR && Math.max(Math.abs(i % W - px), Math.abs((i / W | 0) - py)) >= 3 && tryPut(i, VIT)) break;
      for (const [x, y] of [[px - 5, py - 1], [px - 5, py + 1]]) if (G.rid(x, y) === r.id && G.t[y * W + x] === FLOOR) G.t[y * W + x] = BENCH;
      continue;
    }
    if (floorN >= 36 && r.role !== 'coda') {
      const has = c => tiles.some(i => (c === 'op' ? BLOCK[G.t[i]] && !GLASS[G.t[i]] : GLASS[G.t[i]]) && G.t[i] !== CPL);
      const cand = tiles.filter(i => free(i)).map(i => { const x = i % W, y = i / W | 0; let d = 99; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (G.get(x + dx, y + dy) === WALL) d = Math.min(d, Math.max(Math.abs(dx), Math.abs(dy))); return [i, d]; }).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
      if (!has('op')) { for (const [i] of cand) if (tryPut(i, L.meta.formal ? COL : PART)) { if (L.meta.formal && r.kind === 'rect') { const x = i % W, y = i / W | 0, my = 2 * L.meta.axisY - y; const j = my * W + x; if (my !== y && G.rid(x, my) === r.id) tryPut(j, COL); } break; } }
      if (!has('gl')) { for (const [i] of cand) if (tryPut(i, VIT)) break; }
      // cover: every floor tile within 6 (Chebyshev) of an interior blocker or opening
      for (let pass = 0; pass < 3; pass++) {
        const blk = tiles.filter(i => BLOCK[G.t[i]]).concat(ops);
        const bare = tiles.filter(i => WALK[G.t[i]] === 1 && blk.every(b => Math.max(Math.abs(b % W - i % W), Math.abs((b / W | 0) - (i / W | 0))) > 6));
        if (!bare.length) break;
        const t = bare[bare.length >> 1]; tryPut(t, rng.pm(500) ? COL : VIT);
      }
    }
    if (r.role === 'intro') { const [ex, ey] = L.meta.entrance; for (const [x, y] of [[ex + 2, ey - 2], [ex + 2, ey + 2]]) if (G.rid(x, y) === r.id && free(y * W + x)) { tryPut(y * W + x, LECT); break; } }
  }
}

// ---------------- analysis ----------------
function adjacency(G, mode, mask) {
  const W = G.W, N = W * G.H, start = new Int32Array(N + 1), list = [];
  for (let i = 0; i < N; i++) {
    start[i] = list.length;
    if (mask && !mask[i]) continue;
    if (!walkable(G.t[i], mode)) continue;
    const x = i % W, y = i / W | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= G.H) continue;
      const j = yy * W + xx; if (!walkable(G.t[j], mode) || (mask && !mask[j])) continue;
      if (dx && dy && (!walkable(G.t[y * W + xx], mode) || !walkable(G.t[yy * W + x], mode))) continue;
      list.push(j);
    }
  }
  start[N] = list.length;
  return { start, list: Int32Array.from(list) };
}
function chokepoints(G, root, adj) { // iterative Tarjan; gate = articulation point whose second-largest split component >= 4
  const N = G.W * G.H, disc = new Int32Array(N).fill(-1), low = new Int32Array(N), size = new Int32Array(N), par = new Int32Array(N).fill(-1), it = new Int32Array(N);
  const sep = new Map(); let t = 0; const st = [root]; disc[root] = low[root] = t++; size[root] = 1; it[root] = adj.start[root];
  while (st.length) {
    const v = st[st.length - 1];
    if (it[v] < adj.start[v + 1]) {
      const w = adj.list[it[v]++];
      if (disc[w] < 0) { par[w] = v; disc[w] = low[w] = t++; size[w] = 1; it[w] = adj.start[w]; st.push(w); }
      else if (w !== par[v]) low[v] = Math.min(low[v], disc[w]);
    } else {
      st.pop(); const p = par[v];
      if (p >= 0) { low[p] = Math.min(low[p], low[v]); size[p] += size[v]; if (low[v] >= disc[p]) { if (!sep.has(p)) sep.set(p, []); sep.get(p).push(size[v]); } }
    }
  }
  const gates = new Set();
  for (const [v, s] of sep) {
    const comps = v === root ? s.slice() : s.concat([t - 1 - s.reduce((a, b) => a + b, 0)]);
    if (comps.length < 2) continue;
    comps.sort((a, b) => b - a);
    if (comps[1] >= 4) gates.add(v);
  }
  return { gates, reached: t };
}
function los(G, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1, err = dx - dy, x = x0, y = y0;
  while (x !== x1 || y !== y1) {
    if ((x !== x0 || y !== y0) && !SEE[G.t[y * G.W + x]]) return false;
    const e2 = 2 * err; if (e2 > -dy) { err -= dy; x += sx; } if (e2 < dx) { err += dx; y += sy; }
  }
  return true;
}
const DISK7 = []; for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) if ((dx || dy) && dx * dx + dy * dy <= 49) DISK7.push([dx, dy]);
function isovist(G, x, y, open) { let tot = 0, vis = 0; for (const [dx, dy] of DISK7) { const xx = x + dx, yy = y + dy; if (!G.in(xx, yy) || !open[yy * G.W + xx]) continue; tot++; if (los(G, x, y, xx, yy)) vis++; } return [vis, tot]; }

function roomGraph(L, reachRooms) {
  const nodes = [...reachRooms], idx = new Map(nodes.map((r, i) => [r, i])), n = nodes.length, adj = nodes.map(() => new Set());
  for (const e of L.edges) { if (e.type === 'S' || e.type === 'h') continue; if (!idx.has(e.a) || !idx.has(e.b) || e.a === e.b) continue; adj[idx.get(e.a)].add(idx.get(e.b)); adj[idx.get(e.b)].add(idx.get(e.a)); }
  let E = 0; adj.forEach(s => E += s.size); E /= 2;
  // bridges by removal test
  const reach = (skipA, skipB) => { const seen = new Uint8Array(n), q = [skipA]; seen[skipA] = 1; while (q.length) { const v = q.pop(); for (const w of adj[v]) { if ((v === skipA && w === skipB) || (v === skipB && w === skipA)) continue; if (!seen[w]) { seen[w] = 1; q.push(w); } } } return seen[skipB] === 1; };
  const ringDeg = new Array(n).fill(0);
  for (let v = 0; v < n; v++) for (const w of adj[v]) if (v < w && reach(v, w)) { ringDeg[v]++; ringDeg[w]++; }
  let bridges = 0; for (let v = 0; v < n; v++) for (const w of adj[v]) if (v < w && !reach(v, w)) bridges++;
  const types = { a: 0, b: 0, c: 0, d: 0 };
  const typeOf = [];
  for (let v = 0; v < n; v++) { const deg = adj[v].size; const t = deg <= 1 ? 'a' : ringDeg[v] === 0 ? 'b' : ringDeg[v] === 2 ? 'c' : ringDeg[v] >= 3 ? 'd' : 'b'; types[t]++; typeOf.push(t); }
  // total depth (integration proxy)
  const TD = nodes.map((_, s) => { const D = new Array(n).fill(-1), q = [s]; D[s] = 0; let sum = 0; while (q.length) { const v = q.shift(); for (const w of adj[v]) if (D[w] < 0) { D[w] = D[v] + 1; sum += D[w]; q.push(w); } } return sum; });
  return { nodes, n, E, mu: E - n + 1, types, typeOf, TD, adj, idx, bridges, ringDeg };
}

function analyse(L, opts = {}) {
  const G = L.G, W = G.W, N = W * G.H;
  const [ex, ey] = L.meta.entrance, e = ey * W + ex;
  const D = bfs(G, [e], MODE_PUBLIC);
  const open = new Uint8Array(N); let floorN = 0; for (let i = 0; i < N; i++) if (D[i] >= 0) { open[i] = 1; floorN++; }
  const adj = adjacency(G, MODE_PUBLIC, open);
  const { gates } = chokepoints(G, e, adj);
  // holes (8-connected components of non-open tiles not touching the border)
  const seen = new Uint8Array(N); let pillar = 0, circuit = 0;
  for (let i = 0; i < N; i++) {
    if (open[i] || seen[i]) continue;
    const comp = [i]; seen[i] = 1; let border = false, k = 0;
    while (k < comp.length) { const j = comp[k++], x = j % W, y = j / W | 0; if (x === 0 || y === 0 || x === W - 1 || y === G.H - 1) border = true; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= G.H) continue; const q = yy * W + xx; if (!open[q] && !seen[q]) { seen[q] = 1; comp.push(q); } } }
    if (border) continue;
    const ring = new Set(); for (const j of comp) { const x = j % W, y = j / W | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = (y + dy) * W + x + dx; if (open[q]) ring.add(q); } }
    if (ring.size <= 16) pillar++; else circuit++;
  }
  let def = 0; for (let i = 0; i < N; i++) if (open[i] && adj.start[i + 1] - adj.start[i] <= 2) def++;
  let bl = 0, gl = 0;
  for (let i = 0; i < N; i++) { if (!BLOCK[G.t[i]]) continue; const x = i % W, y = i / W | 0; let near = false; for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (G.in(x + dx, y + dy) && open[(y + dy) * W + x + dx]) { near = true; break; } if (!near) continue; bl++; if (GLASS[G.t[i]]) gl++; }
  // openness (sampled 1 in 4)
  let os = 0, on = 0; const iso = new Map();
  if (!opts.skipOpenness) for (let i = 0; i < N; i++) { if (!open[i]) continue; const x = i % W, y = i / W | 0; if ((x & 1) || (y & 1)) continue; const [v, t] = isovist(G, x, y, open); if (t) { os += v / t; on++; iso.set(i, v); } }
  // tortuosity entrance -> masterpiece
  const [cx, cy] = L.meta.cpl; let dC = 1e9; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = (cy + dy) * W + cx + dx; if (D[j] >= 0) dC = Math.min(dC, D[j]); }
  const tort = dC / Math.max(Math.abs(cx - ex), Math.abs(cy - ey));
  let dExit = 1e9; for (const [x, y] of L.meta.exits) dExit = Math.min(dExit, D[y * W + x] < 0 ? 1e9 : D[y * W + x]);
  // rooms reachable
  const reachRooms = new Set(); for (let i = 0; i < N; i++) if (open[i] && G.room[i]) reachRooms.add(G.room[i]);
  const RG = roomGraph(L, reachRooms);
  // L_tour: nearest-neighbour tour over gallery centres, then masterpiece hall, then nearest exit
  const galleries = [...reachRooms].map(id => L.rooms[id]).filter(r => r.role !== 'coda' && r.role !== 'centre' && r.role !== 'staff');
  const pt = r => { const c = centreOf(r); let best = -1, bd = 1e9; for (const i of roomTiles(L, r)) { if (!open[i]) continue; const d = Math.abs(i % W - c.x) + Math.abs((i / W | 0) - c.y); if (d < bd) { bd = d; best = i; } } return best; };
  let cur = e, tour = 0; const left = galleries.map(pt).filter(i => i >= 0);
  while (left.length) { const Dc = bfs(G, [cur], MODE_PUBLIC); let bi = 0; for (let k = 1; k < left.length; k++) if (Dc[left[k]] < Dc[left[bi]]) bi = k; tour += Dc[left[bi]]; cur = left[bi]; left.splice(bi, 1); }
  const centreRoom = L.rooms.find(r => r && r.role === 'centre');
  { const Dc = bfs(G, [cur], MODE_PUBLIC); const cp = pt(centreRoom); tour += Dc[cp]; cur = cp; const D2 = bfs(G, [cur], MODE_PUBLIC); let m = 1e9; for (const [x, y] of L.meta.exits) if (D2[y * W + x] >= 0) m = Math.min(m, D2[y * W + x]); tour += m; }
  // vista: some intro tile sees the masterpiece plinth
  const intro = L.rooms.find(r => r && r.role === 'intro');
  let vista = false; for (const i of roomTiles(L, intro)) { if (!open[i]) continue; if (los(G, i % W, i / W | 0, cx, cy)) { vista = true; break; } }
  // masterpiece optional: an exit reachable with the centre room blocked
  const Dno = bfs(G, [e], MODE_PUBLIC, centreRoom.id);
  const optionalC = L.meta.exits.some(([x, y]) => Dno[y * W + x] >= 0);
  const allRooms = L.rooms.filter(r => r && r.role !== 'staff');
  const allReached = allRooms.every(r => reachRooms.has(r.id));
  const exitsReached = L.meta.exits.length >= 2 && L.meta.exits.every(([x, y]) => D[y * W + x] >= 0);
  let narrow = 0; for (let i = 0; i < N; i++) { if (!open[i]) continue; const x = i % W, y = i / W | 0; let h = 1, v = 1; for (let k = 1; open[i + k] && x + k < W; k++) h++; for (let k = 1; open[i - k] && x - k >= 0; k++) h++; for (let k = 1; y + k < G.H && open[i + k * W]; k++) v++; for (let k = 1; y - k >= 0 && open[i - k * W]; k++) v++; if (Math.min(h, v) <= 2) narrow++; }
  const [exX, exY] = L.meta.exits.reduce((b, e) => (D[e[1] * W + e[0]] >= 0 && (b == null || D[e[1] * W + e[0]] < D[b[1] * W + b[0]])) ? e : b, null) || [ex, ey];
  const tortExit = dExit / Math.max(1, Math.max(Math.abs(exX - ex), Math.abs(exY - ey)));
  const introIdx = RG.idx.get(intro.id), introExits = RG.adj[introIdx].size, introOnCycle = RG.ringDeg[introIdx] >= 2;
  const deadEnds = L.rooms.filter(r => r && r.tags.deadEnd && reachRooms.has(r.id)).length;
  const cIdx = RG.idx.get(centreRoom.id); let roomsToC = 0; { const Dd = new Array(RG.n).fill(-1), qq = [introIdx]; Dd[introIdx] = 0; while (qq.length) { const v = qq.shift(); for (const w of RG.adj[v]) if (Dd[w] < 0) { Dd[w] = Dd[v] + 1; qq.push(w); } } roomsToC = Dd[cIdx]; }
  const degs = RG.adj.map(a => a.size), hubDom = Math.max(...degs) / (degs.reduce((a, b) => a + b, 0) / degs.length);
  const tdMin = Math.min(...RG.TD), tdMean = RG.TD.reduce((a, b) => a + b, 0) / RG.n, integContrast = tdMean / tdMin;
  let arenaMinRing = 99; {
    const cr = centreRoom, seenA = new Set();
    for (const i0 of roomTiles(L, cr)) {
      const c0 = G.t[i0]; if (WALK[c0] === 1 || c0 === CPL || seenA.has(i0)) continue;
      const comp = [i0]; seenA.add(i0); let k = 0, attached = false;
      while (k < comp.length) { const j = comp[k++], x = j % W, y = j / W | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = (y + dy) * W + x + dx; const cq = G.t[q]; if (cq === WALL) attached = true; else if (WALK[cq] !== 1 && cq !== CPL && G.room[q] === cr.id && !seenA.has(q)) { seenA.add(q); comp.push(q); } } }
      if (attached) continue;
      const ring = new Set(); for (const j of comp) { const x = j % W, y = j / W | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = (y + dy) * W + x + dx; if (WALK[G.t[q]] === 1 || G.t[q] === CPL) ring.add(q); } }
      arenaMinRing = Math.min(arenaMinRing, ring.size);
    }
  }
  const elev = (() => { let n = 0; for (let i = 0; i < N; i++) if (open[i] && G.elev[i]) n++; return n / floorN; })();
  return {
    W, H: G.H, floor: floorN, loops: pillar + circuit, pillar, circuit, choke: gates.size / floorN, gatesN: gates.size, gates,
    defensible: def / floorN, open: on ? os / on : NaN, glass: bl ? gl / bl : 0, tort, dExit, tour, vista, optionalC, allReached, exitsReached,
    rooms: RG.n, mu: RG.mu, gateShare: RG.E ? RG.bridges / RG.E : 0, narrow: narrow / floorN, tortExit, introExits, introOnCycle, deadEnds, roomsToC, hubDom, integContrast, arenaMinRing, aShare: RG.types.a / RG.n, bShare: RG.types.b / RG.n, cShare: RG.types.c / RG.n, dShare: RG.types.d / RG.n, elev, iso, D, openMask: open, RG,
  };
}

// ---------------- population (simplified, for timing) and worst-case runner ----------------
function populate(L, A, tier, base) {
  const G = L.G, W = G.W, rng = Stream(base + '/populate');
  const n = 8 + tier;
  const spawns = [];
  const cands = []; for (let i = 0; i < W * G.H; i++) if (A.openMask[i] && G.t[i] === FLOOR && A.D[i] >= 9 && G.room[i] && L.rooms[G.room[i]].role !== 'centre' && L.rooms[G.room[i]].role !== 'coda') cands.push(i);
  rng.shuffle(cands);
  const isoOf = i => { const x = i % W, y = i / W | 0; return isovist(G, x, y, A.openMask)[0]; };
  for (let k = 0; k < n && cands.length; k++) {
    const role = rng.pm(250) ? 'ranged' : rng.pm(200) ? 'ambusher' : 'melee';
    const pool = cands.slice(0, 12).map(i => [i, role === 'melee' ? 0 : isoOf(i)]);
    pool.sort((a, b) => role === 'ranged' ? b[1] - a[1] : a[1] - b[1]);
    const i = pool[0][0]; spawns.push({ i, role, room: G.room[i] }); cands.splice(cands.indexOf(i), 1);
  }
  // deepest a-space gets the best optional item
  let best = null, bd = -1; for (let v = 0; v < A.RG.n; v++) { if (A.RG.typeOf[v] !== 'a') continue; const r = L.rooms[A.RG.nodes[v]]; if (r.role === 'centre' || r.role === 'intro') continue; const t = roomTiles(L, r).filter(i => A.openMask[i]); const d = Math.max(...t.map(i => A.D[i])); if (d > bd) { bd = d; best = r; } }
  // worst-case runner on the room graph: Dijkstra, cost = enemy cost of rooms entered, centre room forbidden
  const cost = new Map(); for (const s of spawns) cost.set(s.room, (cost.get(s.room) || 0) + (s.role === 'ranged' ? 6 : s.role === 'ambusher' ? 5 : 4));
  const RG = A.RG, src = RG.idx.get(L.rooms.find(r => r && r.role === 'intro').id), dst = RG.idx.get(L.rooms.find(r => r && r.role === 'coda').id);
  const dist = new Array(RG.n).fill(1e9); dist[src] = cost.get(RG.nodes[src]) || 0; const done = new Uint8Array(RG.n);
  for (;;) { let v = -1; for (let k = 0; k < RG.n; k++) if (!done[k] && (v < 0 || dist[k] < dist[v])) v = k; if (v < 0 || dist[v] >= 1e9) break; done[v] = 1; for (const w of RG.adj[v]) { if (L.rooms[RG.nodes[w]].role === 'centre') continue; const nd = dist[v] + (cost.get(RG.nodes[w]) || 0); if (nd < dist[w]) dist[w] = nd; } }
  return { spawns, bestRoom: best && best.id, runnerCost: dist[dst], hp: 15 + 5 * tier };
}

// ---------------- top level ----------------
function generate(programme, tier, seed, opts = {}) {
  const P = PROGRAMMES[programme];
  let attempt = 0, L, A, K, repairs = 0;
  for (attempt = opts.startAttempt || 0; attempt < (opts.maxAttempts || 5); attempt++) {
    const base = `run${seed}/dept/${programme}/t${tier}/try${attempt}`;
    const kr = Stream(base + '/programme'); K = P.knobs(kr, scaleOf(tier)); if (P.post) P.post(K);
    L = newLayout(); L.meta.programme = programme;
    const tm = {}; let tt = process.hrtime.bigint(); const lap = k => { const n = process.hrtime.bigint(); tm[k] = (tm[k] || 0) + Number(n - tt) / 1e6; tt = n; };
    P.embed(L, K, Stream(base + '/embed')); lap('embed');
    addLoops(L, P.d, Stream(base + '/openings'), { allow: (a, b) => !a.tags.noLoops && !b.tags.noLoops && a.role !== 'staff' && b.role !== 'staff' && !((a.role === 'intro' && b.role === 'coda') || (a.role === 'coda' && b.role === 'intro')) });
    lap('addLoops');
    aSpacePass(L, K.studies || 0, Stream(base + '/aspace')); lap('aspace');
    const A0 = analyse(L, { skipOpenness: true }); lap('analyse0');
    // local repair: unreachable rooms
    if (!A0.allReached) { for (const r of L.rooms) { if (!r || r.role === 'staff') continue; if (roomTiles(L, r).some(i => A0.openMask[i])) continue; for (const q of L.rooms) { if (q && q !== r && q.role !== 'staff' && roomTiles(L, q).some(i => A0.openMask[i]) && connect(L, r.id, q.id, { width: 1, why: 'repair' })) { repairs++; break; } } } }
    // local repair: put the Intro on a cycle (probabilistic programmes) by opening a wall to an adjacent room
    let A1 = analyse(L, { skipOpenness: true });
    if (!A1.introOnCycle || A1.introExits < 2) {
      const intro = L.rooms.find(r => r && r.role === 'intro');
      const linked = new Set(L.edges.filter(e => e.a === intro.id || e.b === intro.id).map(e => e.a === intro.id ? e.b : e.a));
      for (const q of L.rooms) { if (!q || q === intro || q.role === 'staff' || q.role === 'coda' || q.tags.deadEnd || linked.has(q.id)) continue; if (connect(L, intro.id, q.id, { width: 3, why: 'repair:introCycle' })) { repairs++; break; } }
      A1 = analyse(L, { skipOpenness: true });
      if (!A1.introOnCycle) { // connect the Intro's branch neighbour onward
        for (const id of linked) { const q = L.rooms[id]; if (q.tags.deadEnd) continue; let done = false; for (const r2 of L.rooms) { if (!r2 || r2 === q || r2 === intro || r2.role === 'staff' || r2.tags.deadEnd || r2.tags.noLoops) continue; if (L.edges.some(e => (e.a === q.id && e.b === r2.id) || (e.b === q.id && e.a === r2.id))) continue; if (connect(L, q.id, r2.id, { width: 3, why: 'repair:introCycle' })) { repairs++; done = true; break; } } if (done) break; }
        A1 = analyse(L, { skipOpenness: true });
      }
    }
    lap('repair+analyse1');
    curate(L, K, base, A1.gates); lap('curate');
    A = analyse(L, { skipOpenness: !!opts.skipOpenness }); lap('analyseFinal');
    A.failed = []; if (!A.allReached) A.failed.push('reach'); if (!A.exitsReached) A.failed.push('exits'); if (!A.optionalC) A.failed.push('optionalC'); if (L.meta.vistaRequired && !A.vista) A.failed.push('vista');
    if (A.introExits < 2) A.failed.push('introEscape'); if (!A.introOnCycle) A.failed.push('introCycle'); if (A.arenaMinRing < 16) A.failed.push('arenaLoop');
    const ok = A.failed.length === 0;
    if (opts.debug) console.error("attempt", attempt, A.failed.join(","));
    if (ok) { A.pop = populate(L, A, tier, base); lap('populate'); A.timing = tm; break; }
  }
  A.repairs = repairs; return { L, A, K, attempt, repairs };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--show') {
    const [_, prog, seed, tier] = args; const r = generate(prog, +(tier || 1), +(seed || 1), { debug: true });
    const L2 = r.L, G2 = L2.G; for (const rm of L2.rooms) { if (!rm) continue; const ch = rm.role === 'intro' ? 'I' : rm.role === 'coda' ? 'K' : rm.role === 'study' ? 's' : null; if (!ch) continue; const c = centreOf(rm); let best = null, bd = 1e9; for (let y = rm.y0; y <= rm.y1; y++) for (let x = rm.x0; x <= rm.x1; x++) if (G2.rid(x, y) === rm.id && G2.get(x, y) === FLOOR) { const d = Math.abs(x - c.x) + Math.abs(y - c.y); if (d < bd) { bd = d; best = [x, y]; } } if (best) G2.set(best[0], best[1], CH(ch)); }
    console.log(r.L.G.text()); const A = r.A;
    console.log(JSON.stringify({ K: r.K, attempt: r.attempt, W: A.W, H: A.H, floor: A.floor, loops: A.loops, pillar: A.pillar, circuit: A.circuit, choke: +A.choke.toFixed(3), def: +A.defensible.toFixed(2), open: +A.open.toFixed(2), glass: +A.glass.toFixed(2), tort: +A.tort.toFixed(2), tour: A.tour, dExit: A.dExit, rooms: A.rooms, mu: A.mu, a: +A.aShare.toFixed(2), d: +A.dShare.toFixed(2), vista: A.vista, failed: A.failed }));
    process.exit(0);
  }
  const seeds = +(args[0] || 100), tiers = [0, 1, 2];
  const out = {};
  for (const prog of Object.keys(PROGRAMMES)) {
    const rows = [], times = [], timesNoOpen = []; let fails = 0, retries = 0;
    for (const t of tiers) for (let s = 1; s <= seeds; s++) {
      const t0 = process.hrtime.bigint(); const r = generate(prog, t, s); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      times.push(ms); retries += r.attempt; if (r.A.failed.length) fails++;
      const t1 = process.hrtime.bigint(); generate(prog, t, s, { skipOpenness: true }); timesNoOpen.push(Number(process.hrtime.bigint() - t1) / 1e6);
      rows.push({ tier: t, ...r.A, runnerCost: r.A.pop ? r.A.pop.runnerCost : null, hp: r.A.pop ? r.A.pop.hp : null });
    }
    out[prog] = { rows, times, timesNoOpen, fails, retries };
  }
  const q = (a, p) => { const b = a.filter(Number.isFinite).slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * (b.length - 1)))]; };
  const f = (v, d = 2) => (v == null || !Number.isFinite(v)) ? '-' : v.toFixed(d);
  const cols = [['W', 0], ['H', 0], ['floor', 0], ['rooms', 0], ['mu', 0], ['loops', 0], ['pillar', 0], ['circuit', 0], ['choke', 3], ['gateShare', 2], ['narrow', 2], ['defensible', 2], ['open', 2], ['glass', 2], ['tort', 2], ['tortExit', 2], ['tour', 0], ['dExit', 0], ['aShare', 2], ['bShare', 2], ['cShare', 2], ['dShare', 2], ['elev', 2], ['introExits', 0], ['deadEnds', 0], ['roomsToC', 0], ['hubDom', 2], ['integContrast', 2], ['arenaMinRing', 0]];
  console.log('programme | metric | p1 | p5 | p50 | p95 | p99');
  for (const prog of Object.keys(out)) {
    const o = out[prog];
    for (const [c, d] of cols) { const a = o.rows.map(r => r[c]); console.log(`${prog} | ${c} | ${f(q(a, .01), d)} | ${f(q(a, .05), d)} | ${f(q(a, .5), d)} | ${f(q(a, .95), d)} | ${f(q(a, .99), d)}`); }
    console.log(`${prog} | vista% | ${(100 * o.rows.filter(r => r.vista).length / o.rows.length).toFixed(0)} | introOnCycle% ${(100 * o.rows.filter(r => r.introOnCycle).length / o.rows.length).toFixed(0)}`);
    console.log(`${prog} | ms (full) p50/p95/max | ${f(q(o.times, .5), 1)} | ${f(q(o.times, .95), 1)} | ${f(Math.max(...o.times), 1)}`);
    console.log(`${prog} | ms (no openness) p50/p95/max | ${f(q(o.timesNoOpen, .5), 1)} | ${f(q(o.timesNoOpen, .95), 1)} | ${f(Math.max(...o.timesNoOpen), 1)}`);
    { const st = {}; for (const r of o.rows) for (const k in (r.timing || {})) (st[k] = st[k] || []).push(r.timing[k]); console.log(`${prog} | stage ms p50 | ` + Object.keys(st).map(k => k + ' ' + f(q(st[k], .5), 2)).join(' · ')); }
    console.log(`${prog} | fails ${o.fails} / ${o.rows.length}, retries ${o.retries}, layouts with a local repair ${o.rows.filter(r => r.repairs > 0).length}`);
    for (const t of tiers) { const rr = o.rows.filter(r => r.tier === t); console.log(`${prog} | size ${['Cabinet','Department','Wing'][t]} | W×H p50 ${q(rr.map(r => r.W), .5)}×${q(rr.map(r => r.H), .5)} | floor p5/p50/p95 ${q(rr.map(r => r.floor), .05)}/${q(rr.map(r => r.floor), .5)}/${q(rr.map(r => r.floor), .95)} | rooms p5/p50/p95 ${q(rr.map(r => r.rooms), .05)}/${q(rr.map(r => r.rooms), .5)}/${q(rr.map(r => r.rooms), .95)} | tour p5/p50/p95 ${q(rr.map(r => r.tour), .05)}/${q(rr.map(r => r.tour), .5)}/${q(rr.map(r => r.tour), .95)} | dExit p50 ${q(rr.map(r => r.dExit), .5)}`); }
  }
}
module.exports = { generate, PROGRAMMES, analyse, Stream };
