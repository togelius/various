// Micro-benchmark: rot.js map gen, FOV and A* in Node (headless core feasibility).
// usage: node rotbench.cjs /path/to/rot.js
const ROT = require(process.argv[2]);
ROT.RNG.setSeed(12345);
const W = 64, H = 40;
function bench(label, n, fn) { const t = process.hrtime.bigint(); for (let i = 0; i < n; i++) fn(i); const ms = Number(process.hrtime.bigint() - t) / 1e6; console.log(`${label}: ${n} in ${ms.toFixed(1)} ms = ${(ms / n * 1000).toFixed(1)} us each`); }
let map, free;
bench('Digger map 64x40', 200, () => {
  map = {}; free = [];
  new ROT.Map.Digger(W, H).create((x, y, v) => { map[x + ',' + y] = v; if (!v) free.push([x, y]); });
});
const pass = (x, y) => map[x + ',' + y] === 0;
const fov = new ROT.FOV.PreciseShadowcasting(pass);
let seen = 0;
bench('FOV r=8', 5000, i => { const [x, y] = free[i % free.length]; fov.compute(x, y, 8, () => seen++); });
const fov2 = new ROT.FOV.RecursiveShadowcasting(pass);
bench('FOV recursive r=8', 5000, i => { const [x, y] = free[i % free.length]; fov2.compute(x, y, 8, () => seen++); });
bench('A* random pair', 2000, i => { const a = free[(i * 7919) % free.length], b = free[(i * 104729) % free.length]; const astar = new ROT.Path.AStar(b[0], b[1], pass, { topology: 8 }); let len = 0; astar.compute(a[0], a[1], () => len++); });
bench('Dijkstra map (flow field) to one goal', 500, i => { const b = free[(i * 31) % free.length]; const d = new ROT.Path.Dijkstra(b[0], b[1], pass, { topology: 8 }); let len = 0; const a = free[(i * 17) % free.length]; d.compute(a[0], a[1], () => len++); });
// Determinism check: same seed twice -> same map hash
function mapHash(seed) { ROT.RNG.setSeed(seed); let h = 0; new ROT.Map.Digger(W, H).create((x, y, v) => { h = (h * 31 + (v ? 1 : 0) + x) >>> 0; }); return h; }
console.log('same seed same map:', mapHash(42) === mapHash(42), ' different seeds differ:', mapHash(42) !== mapHash(43));
