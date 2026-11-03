// One episode: a controller (source), a start, a time budget -> progress, playstyle and a short account of what happened.
'use strict';
const { createWorld, THINK_EVERY, DT } = require('./world');
const { Controller, LIMITS } = require('./sandbox');
const { budget } = require('./scenarios');

// progress points -> quality. 10 points is one job taken from where you stand to the end (see bridge.js points()).
const POINTS_PER_UNIT = 10;

function runEpisode(code, start, opts = {}) {
  const density = opts.density === undefined ? 0.5 : opts.density, seconds = opts.seconds || budget(start);
  const t0 = Date.now();
  let ctl; try { ctl = new Controller(code, start.seed, opts.limits || LIMITS); } catch (e) { return { start: start.id, points: 0, quality: 0, error: 'compile: ' + String(e.message).slice(0, 120), ended: 'error', wall: 0 }; }
  const w = createWorld(start.seed, { density });
  w.setup(start);
  const maxTicks = Math.floor(seconds / (THINK_EVERY * DT));
  let ended = 'time', tick = 0, lastAction = {}, errorAction = 0;
  for (; tick < maxTicks; tick++) {
    const o = w.obs();
    const a = ctl.step(o);
    if (a.error) errorAction++;
    w.act(a); w.tick(!!a.fire); lastAction = a;
    if (!w.alive()) { ended = 'dead'; break; }
    if (ctl.errors > 25) { ended = 'error'; break; }
  }
  const sum = w.summary();
  const r = { start: start.id, mode: start.mode, story: start.story, info: { hour: start.hour, rain: start.rain, hp: start.hp, wanted: start.wanted, giverDist: start.giverDist, weapons: start.weapons.length }, ...sum, quality: sum.points / POINTS_PER_UNIT, ended, seconds, wall: Date.now() - t0, errors: ctl.errors, firstError: ctl.firstError || null, slow: ctl.slow };
  void lastAction;
  return r;
}

// the mean of the episode results over a batch of starts, with what the prompt and the archive need
function aggregate(results) {
  const n = results.length || 1, mean = f => results.reduce((s, r) => s + f(r), 0) / n;
  return { n: results.length, quality: mean(r => r.quality), wheels: mean(r => r.wheels), offencesPerMin: mean(r => r.offencesPerMin),
    started: results.filter(r => r.started).length, passed: results.filter(r => r.passed > 0).length, deaths: results.filter(r => r.ended === 'dead').length,
    errors: results.reduce((s, r) => s + (r.errors || 0), 0) };
}

module.exports = { runEpisode, aggregate, POINTS_PER_UNIT };
