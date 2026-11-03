// A pool of evaluation workers (child processes). run(code, start, opts) -> Promise<episode result>.
// A worker that hangs past the wall-clock limit is killed and replaced, and its job reports an error result.
'use strict';
const { fork } = require('node:child_process');
const path = require('node:path');

class Pool {
  constructor(n = 4, { wallMs = 180000, recycle = 14 } = {}) {
    this.n = n; this.wallMs = wallMs; this.recycle = recycle; this.queue = []; this.workers = []; this.nextId = 1; this.stats = { jobs: 0, killed: 0, wallMs: 0 };
    for (let i = 0; i < n; i++) this.workers.push(this.spawn());
  }
  spawn() { const w = { p: fork(path.join(__dirname, 'worker.js'), [], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] }), job: null, done: 0, ready: false }; w.p.on('message', m => this.onMessage(w, m)); w.p.on('exit', () => this.onExit(w)); return w; }
  onMessage(w, m) {
    if (m.ready) { w.ready = true; return this.pump(); }
    const j = w.job; if (!j || j.id !== m.id) return; clearTimeout(j.timer); w.job = null; w.done++; this.stats.wallMs += Date.now() - j.t0; j.resolve(m.result);
    if (w.done >= this.recycle) { w.retired = true; w.p.send({ op: 'exit' }); } else this.pump();
  }
  onExit(w) {
    const i = this.workers.indexOf(w); if (w.job) { clearTimeout(w.job.timer); const j = w.job; w.job = null; j.resolve({ start: j.start.id, points: 0, quality: 0, error: 'worker died', ended: 'error' }); }
    if (i >= 0 && !this.closing) { this.workers[i] = this.spawn(); }
  }
  run(code, start, opts) { return new Promise(resolve => { this.queue.push({ id: this.nextId++, code, start, opts, resolve }); this.stats.jobs++; this.pump(); }); }
  pump() {
    for (const w of this.workers) {
      if (!this.queue.length) return; if (w.job || !w.ready || w.retired) continue;
      const j = this.queue.shift(); j.t0 = Date.now(); w.job = j;
      j.timer = setTimeout(() => { this.stats.killed++; w.p.kill('SIGKILL'); }, this.wallMs);
      w.p.send({ id: j.id, code: j.code, start: j.start, opts: j.opts });
    }
  }
  // evaluate one controller on several starts in parallel
  runBatch(code, starts, opts) { return Promise.all(starts.map(s => this.run(code, s, opts))); }
  close() { this.closing = true; for (const w of this.workers) try { w.p.kill('SIGKILL'); } catch (e) { void e; } }
}
module.exports = { Pool };
