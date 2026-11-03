/* A pool of evaluation workers with a hard deadline per job.
 *
 * The deadline is the containment for controllers that never return from a
 * frame: the worker is terminated, the job comes back as hung (and therefore
 * infeasible), and a fresh worker takes its place.
 */
'use strict';
const path = require('path');
const { Worker } = require('worker_threads');

class Pool {
  constructor(size, opts = {}) {
    this.size = size;
    this.deadlineMs = opts.deadlineMs || 120000;
    this.queue = [];
    this.workers = [];
    this.nextId = 1;
    for (let i = 0; i < size; i++) this.spawn();
  }

  spawn() {
    const w = new Worker(path.join(__dirname, 'worker.js'));
    const slot = { w, busy: null, ready: false };
    w.on('message', m => {
      if (m.ready) { slot.ready = true; this.pump(); return; }
      const job = slot.busy;
      if (!job || job.id !== m.id) return;
      clearTimeout(job.timer);
      slot.busy = null;
      job.resolve(m.res);
      this.pump();
    });
    w.on('error', e => this.fail(slot, 'worker crashed: ' + String(e && e.message).slice(0, 160)));
    w.on('exit', () => { if (slot.busy) this.fail(slot, 'worker exited'); });
    this.workers.push(slot);
    return slot;
  }

  fail(slot, why) {
    const job = slot.busy;
    slot.busy = null;
    this.workers = this.workers.filter(s => s !== slot);
    try { slot.w.terminate(); } catch (e) { /* already gone */ }
    if (job) {
      clearTimeout(job.timer);
      job.resolve({ fatal: why, hung: true, feasible: false, violation: 2, quality: 0, tasks: [] });
    }
    if (!this.closed) this.spawn();
  }

  evaluate(src, set) {
    return new Promise(resolve => {
      const job = { id: this.nextId++, src, resolve };
      if (Array.isArray(set)) job.tasks = set; else job.set = set || 'train';
      this.queue.push(job);
      this.pump();
    });
  }

  pump() {
    for (const slot of this.workers) {
      if (!slot.ready || slot.busy || !this.queue.length) continue;
      const job = this.queue.shift();
      slot.busy = job;
      job.timer = setTimeout(() => this.fail(slot, 'hung: no answer within ' + (this.deadlineMs / 1000) + ' s'), this.deadlineMs);
      slot.w.postMessage({ id: job.id, src: job.src, set: job.set, tasks: job.tasks });
    }
  }

  close() {
    this.closed = true;
    for (const s of this.workers) s.w.terminate();
  }
}

module.exports = { Pool };
