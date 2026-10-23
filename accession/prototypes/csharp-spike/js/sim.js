'use strict';
// Line-for-line JS port of Core/Sim.cs. Integer-only; uint32 via >>> 0 and Math.imul.
const W = 32, H = 24;
class Rng {
  constructor(seed) { seed >>>= 0; this.s = seed === 0 ? 0x9E3779B9 : seed; }
  next() { let x = this.s; x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; this.s = x; return x; }
  range(n) { return this.next() % n; }
}
const Dx = [0, 1, 0, -1, 0], Dy = [-1, 0, 1, 0, 0];
const WAIT = 4;
function newRun(seed, monsters) {
  const s = { tiles: new Uint8Array(W * H), px: 1, py: 1, hp: 20, turn: 0, rng: new Rng(seed), dead: false };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let t = 0;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) t = 1;
    else { const r = s.rng.range(100); if (r < 8) t = 1; else if (r < 12) t = 2; }
    s.tiles[y * W + x] = t;
  }
  s.tiles[1 * W + 1] = 0;
  s.mx = new Int32Array(monsters); s.my = new Int32Array(monsters); s.mhp = new Int32Array(monsters); s.awake = new Uint8Array(monsters);
  for (let i = 0; i < monsters; i++) {
    let x, y;
    do { x = 1 + s.rng.range(W - 2); y = 1 + s.rng.range(H - 2); }
    while (s.tiles[y * W + x] !== 0 || (x < 6 && y < 6) || monsterAt(s, x, y) >= 0);
    s.mx[i] = x; s.my[i] = y; s.mhp[i] = 3 + s.rng.range(4);
  }
  return s;
}
function monsterAt(s, x, y) { for (let i = 0; i < s.mx.length; i++) if (s.mhp[i] > 0 && s.mx[i] === x && s.my[i] === y) return i; return -1; }
function passable(s, x, y) { return s.tiles[y * W + x] === 0; }
function step(s, a, ev) {
  if (s.dead) return;
  s.turn++;
  if (a !== WAIT) {
    const nx = s.px + Dx[a], ny = s.py + Dy[a];
    const m = monsterAt(s, nx, ny);
    if (m >= 0) {
      const dmg = s.awake[m] === 0 ? 6 : 1 + s.rng.range(4);
      s.mhp[m] -= dmg; ev && ev.push(3);
      if (s.mhp[m] <= 0) { s.mhp[m] = 0; ev && ev.push(4); }
      for (let i = 0; i < s.mx.length; i++)
        if (s.mhp[i] > 0 && s.awake[i] === 0 && Math.abs(s.mx[i] - s.px) + Math.abs(s.my[i] - s.py) <= 4) { s.awake[i] = 1; ev && ev.push(5); }
    } else if (passable(s, nx, ny)) { s.px = nx; s.py = ny; ev && ev.push(1); }
    else ev && ev.push(2);
  }
  for (let i = 0; i < s.mx.length; i++) {
    if (s.mhp[i] <= 0) continue;
    const dx = s.px - s.mx[i], dy = s.py - s.my[i];
    const dist = Math.abs(dx) + Math.abs(dy);
    if (s.awake[i] === 0) { if (dist <= 3) { s.awake[i] = 1; ev && ev.push(5); } continue; }
    if (dist === 1) { s.hp -= 1 + s.rng.range(3); ev && ev.push(6); if (s.hp <= 0) { s.dead = true; ev && ev.push(7); return; } continue; }
    const sx = Math.sign(dx), sy = Math.sign(dy);
    const horiz = Math.abs(dx) >= Math.abs(dy);
    let tx = s.mx[i] + (horiz ? sx : 0), ty = s.my[i] + (horiz ? 0 : sy);
    if (!passable(s, tx, ty) || monsterAt(s, tx, ty) >= 0 || (tx === s.px && ty === s.py)) { tx = s.mx[i] + (horiz ? 0 : sx); ty = s.my[i] + (horiz ? sy : 0); }
    if (passable(s, tx, ty) && monsterAt(s, tx, ty) < 0 && !(tx === s.px && ty === s.py)) { s.mx[i] = tx; s.my[i] = ty; }
  }
  if (s.turn % 10 === 0 && s.hp < 20) s.hp++;
}
function hash(s) {
  let h = 2166136261;
  const mix = v => { for (let k = 0; k < 4; k++) { h ^= (v >> (8 * k)) & 0xFF; h = Math.imul(h, 16777619) >>> 0; } };
  mix(s.px); mix(s.py); mix(s.hp); mix(s.turn); mix(s.rng.s);
  for (let i = 0; i < s.mx.length; i++) { mix(s.mx[i]); mix(s.my[i]); mix(s.mhp[i]); mix(s.awake[i]); }
  return h >>> 0;
}
function choose(s, br) {
  let best = -1, bestD = 0x7fffffff;
  for (let i = 0; i < s.mx.length; i++) { if (s.mhp[i] <= 0) continue; const d = Math.abs(s.mx[i] - s.px) + Math.abs(s.my[i] - s.py); if (d < bestD) { bestD = d; best = i; } }
  if (best < 0) return WAIT;
  if (s.hp < 6 && bestD > 1) return WAIT;
  if (br.range(4) === 0) return br.range(4);
  const dx = s.mx[best] - s.px, dy = s.my[best] - s.py;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 1 : 3;
  return dy > 0 ? 2 : 0;
}
function playRun(seed, maxTurns, ev) {
  const s = newRun(seed, 12); const br = new Rng((seed ^ 0xA5A5A5A5) >>> 0); let won = false;
  while (!s.dead && s.turn < maxTurns) {
    let any = false; for (let i = 0; i < s.mhp.length; i++) if (s.mhp[i] > 0) { any = true; break; }
    if (!any) { won = true; break; }
    step(s, choose(s, br), ev);
  }
  return { h: hash(s), turns: s.turn, won };
}
function batch(first, count, maxTurns) {
  let c = 2166136261, total = 0, wins = 0;
  for (let seed = first; seed < first + count; seed++) { const r = playRun(seed, maxTurns, null); c = Math.imul(c ^ r.h, 16777619) >>> 0; total += r.turns; if (r.won) wins++; }
  return { c, total, wins };
}
const g = batch(1, 1000, 500);
console.log(`golden seeds 1..1000: hash=${g.c} totalTurns=${g.total} wins=${g.wins}`);
const t0 = process.hrtime.bigint();
const b = batch(1, 10000, 500);
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
console.log(`node ${process.version}: 10000 runs, ${b.total} steps in ${ms.toFixed(0)} ms = ${(b.total / ms * 1000 / 1e6).toFixed(2)} M steps/s; hash=${b.c} wins=${b.wins}`);
