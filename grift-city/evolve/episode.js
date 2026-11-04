// One episode: a controller (source), a start, a time budget -> quality, its facets, playstyle and an account of what happened.
'use strict';
const { createWorld, THINK_EVERY, DT } = require('./world');
const { Controller, LIMITS } = require('./sandbox');
const { budget } = require('./scenarios');

// QUALITY = story + 0.25 cash + 0.1 survival
//   story     progress points / 10 (bridge.js points()): the marker, the job, every objective in it, jobs passed. 10 points is
//             one job taken from where you stand to the end.
//   cash      money made by any means during the run (job pay, cons, style chains, stunts, hidden packages) / $2000, at most 1.5
//   survival  0 if dead or arrested at the end, else 0.5 + 0.5 x health
// Story dominates; the other two make room for the other ways of getting on in the game and for staying alive.
const POINTS_PER_UNIT = 10, W_CASH = 0.25, W_SURVIVAL = 0.1, CASH_UNIT = 2000;
const STALL_SECONDS = 60;    // a run in which the player has not moved for a minute is over: nothing more will happen
function facets(sum) {
  const story = sum.points / POINTS_PER_UNIT, cash = Math.min(1.5, (sum.cash || 0) / CASH_UNIT), survival = sum.alive ? 0.5 + 0.5 * Math.max(0, sum.hp) / 100 : 0;
  return { story: +story.toFixed(4), cash: +cash.toFixed(4), survival: +survival.toFixed(4), quality: +(story + W_CASH * cash + W_SURVIVAL * survival).toFixed(4) };
}

function runEpisode(code, start, opts = {}) {
  const density = opts.density === undefined ? 0.5 : opts.density, seconds = opts.seconds || budget(start);
  const t0 = Date.now();
  let ctl; try { ctl = new Controller(code, start.seed, opts.limits || LIMITS, opts.lib || ''); } catch (e) { return { start: start.id, points: 0, quality: 0, story: 0, cash: 0, survival: 0, error: 'compile: ' + String(e.message).slice(0, 120), ended: 'error', wall: 0 }; }
  const w = createWorld(start.seed, { density });
  w.setup(start);
  const maxTicks = Math.floor(seconds / (THINK_EVERY * DT));
  let ended = 'time', tick = 0;
  for (; tick < maxTicks; tick++) {
    const a = ctl.step(w.obs());
    w.act(a); w.tick(!!a.fire);
    if (!w.alive()) { ended = 'dead'; break; }
    if (ctl.errors > 25) { ended = 'error'; break; }
    if (w.bridge.stalled() > STALL_SECONDS) { ended = 'stalled'; break; }
  }
  const sum = w.summary(), f = facets(sum);
  return { start: start.id, mode: start.mode, story: start.story, info: { hour: start.hour, rain: start.rain, hp: start.hp, wanted: start.wanted, giverDist: start.giverDist, weapons: start.weapons.length }, ...sum,
    quality: f.quality, facets: f, ended, seconds, played: Math.round(tick * THINK_EVERY * DT), wall: Date.now() - t0, errors: ctl.errors, firstError: ctl.firstError || null, slow: ctl.slow };
}

// the mean of the episode results over a batch of starts, with what the prompt and the archive need
function aggregate(results) {
  const n = results.length || 1, mean = f => results.reduce((s, r) => s + f(r), 0) / n, fc = k => mean(r => (r.facets ? r.facets[k] : 0));
  return { n: results.length, quality: mean(r => r.quality), story: fc('story'), cash: fc('cash'), survival: fc('survival'), wheels: mean(r => r.wheels || 0), offencesPerMin: mean(r => r.offencesPerMin || 0),
    started: results.filter(r => r.started).length, passed: results.filter(r => r.passed > 0).length, deaths: results.filter(r => r.ended === 'dead').length,
    errors: results.reduce((s, r) => s + (r.errors || 0), 0) };
}

module.exports = { runEpisode, aggregate, facets, POINTS_PER_UNIT, W_CASH, W_SURVIVAL, CASH_UNIT, STALL_SECONDS };
