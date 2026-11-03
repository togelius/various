/* One evaluation worker: its own copy of the game, booted once, scoring
 * whatever controller source it is sent. Runs in a worker thread so the pool
 * can kill it outright if a controller never returns from a frame. */
'use strict';
const { parentPort } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const H = require('./headless');
const S = require('./sandbox');

const world = H.boot();
const TASKS = JSON.parse(fs.readFileSync(path.join(__dirname, 'tasks.json'), 'utf8'));

parentPort.on('message', job => {
  let res;
  try {
    const tasks = Array.isArray(job.tasks) ? job.tasks : TASKS[job.set || 'train'];
    res = S.evaluate(world, job.src, tasks);
  } catch (e) {
    res = { fatal: 'evaluator error: ' + String(e && e.message).slice(0, 200), feasible: false, violation: Infinity, quality: 0, tasks: [] };
  }
  parentPort.postMessage({ id: job.id, res });
});
parentPort.postMessage({ ready: true });
