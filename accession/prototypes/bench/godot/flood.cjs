// Same 40x27 flood fill in Node. usage: node flood.cjs [reps] [typed|plain]
const W = 40, H = 27;
const reps = +(process.argv[2] || 10000), mode = process.argv[3] || 'typed';
const t_start = process.hrtime.bigint();
const mk = (n) => mode === 'typed' ? new Int32Array(n) : new Array(n).fill(0);
const grid = mk(W * H);
let rng = 12345;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  let wall = 0;
  if (x === 0 || y === 0 || x === W - 1 || y === H - 1) wall = 1;
  else { rng = (Math.imul(rng, 1103515245) + 12345) & 0x7fffffff; if (((rng >> 16) % 100) < 28) wall = 1; }
  grid[y * W + x] = wall;
}
const open = []; for (let i = 0; i < W * H; i++) if (grid[i] === 0) open.push(i);
const seen = mk(W * H), queue = mk(W * H);
let total = 0;
const t0 = process.hrtime.bigint();
for (let r = 0; r < reps; r++) {
  const start = open[(r * 7919) % open.length], stamp = r + 1;
  let head = 0, tail = 1; queue[0] = start; seen[start] = stamp;
  while (head < tail) {
    const c = queue[head++];
    let n = c - 1; if (grid[n] === 0 && seen[n] !== stamp) { seen[n] = stamp; queue[tail++] = n; }
    n = c + 1; if (grid[n] === 0 && seen[n] !== stamp) { seen[n] = stamp; queue[tail++] = n; }
    n = c - W; if (grid[n] === 0 && seen[n] !== stamp) { seen[n] = stamp; queue[tail++] = n; }
    n = c + W; if (grid[n] === 0 && seen[n] !== stamp) { seen[n] = stamp; queue[tail++] = n; }
  }
  total += tail;
}
const t1 = process.hrtime.bigint();
console.log(`node ${mode}: open=${open.length} reps=${reps} total_cells=${total} loop_ms=${(Number(t1 - t0) / 1e6).toFixed(1)} per_fill_us=${(Number(t1 - t0) / 1e3 / reps).toFixed(2)} script_ms=${(Number(t1 - t_start) / 1e6).toFixed(1)}`);
