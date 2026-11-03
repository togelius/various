// A pool of evaluation workers. A hung or crashed worker is killed and replaced.
const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

class Worker {
  constructor() { this.busy = false; this.ready = this.boot(); }
  boot() {
    this.proc = spawn(process.execPath, [path.join(__dirname, 'worker.js')], { stdio: ['pipe', 'pipe', 'inherit'] });
    this.pending = new Map(); this.nextId = 1;
    const rl = readline.createInterface({ input: this.proc.stdout });
    let ok; const ready = new Promise(r => ok = r);
    rl.on('line', l => { let m; try { m = JSON.parse(l); } catch (e) { return; } if (m.ready) return ok(); const p = this.pending.get(m.id); if (p) { this.pending.delete(m.id); clearTimeout(p.timer); p.resolve(m); } });
    this.proc.on('exit', () => { for (const [, p] of this.pending) { clearTimeout(p.timer); p.resolve({ error: 'worker exited' }); } this.pending.clear(); });
    return ready;
  }
  async call(job, timeoutMs) {
    await this.ready;
    const id = this.nextId++;
    return new Promise(resolve => {
      const timer = setTimeout(() => { this.pending.delete(id); this.proc.kill('SIGKILL'); this.ready = this.boot(); resolve({ error: 'timeout' }); }, timeoutMs);
      this.pending.set(id, { resolve, timer });
      this.proc.stdin.write(JSON.stringify(Object.assign({ id }, job)) + '\n');
    });
  }
  kill() { try { this.proc.kill('SIGKILL'); } catch (e) {} }
}

class Pool {
  constructor(n) { this.workers = Array.from({ length: n }, () => new Worker()); this.queue = []; }
  async job(job, timeoutMs = 240000) {
    const w = await new Promise(res => { const free = this.workers.find(w => !w.busy); if (free) { free.busy = true; res(free); } else this.queue.push(res); });
    try { return await w.call(job, timeoutMs); }
    finally { const next = this.queue.shift(); if (next) next(w); else w.busy = false; }
  }
  starts(seed, n) { return this.job({ op: 'starts', seed, n }, 60000).then(r => { if (r.error) throw new Error(r.error); return r.starts; }); }
  // plays one controller on every start spec (split across workers); returns the per-start results in order
  async evaluate(code, specs, chunk = 2) {
    const parts = []; for (let i = 0; i < specs.length; i += chunk) parts.push(specs.slice(i, i + chunk));
    const rs = await Promise.all(parts.map(p => this.job({ op: 'run', code, specs: p }, 60000 * p.length + 30000)));
    const out = [];
    rs.forEach((r, i) => { if (r.error) for (const s of parts[i]) out.push({ floor: s.floor, win: false, progress: 0, fire: 0, pace: 0, end: 'crash', err: r.error, deaths: 0, log: [], killedBy: [] }); else out.push(...r.results); });
    return out;
  }
  close() { for (const w of this.workers) w.kill(); }
}
module.exports = { Pool };
