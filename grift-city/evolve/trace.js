#!/usr/bin/env node
// Watch one controller play one start, as text.
//   node trace.js controller.js [--split train|heldout] [--seed 11] [--index 0] [--density 0.5] [--every 5]
// Prints a line every few seconds (where it is, how it is moving, what the game wants) and the episode's account.
'use strict';
const fs = require('node:fs');
const { makeStarts, budget } = require('./scenarios');
const { createWorld, THINK_EVERY, DT } = require('./world');
const { Controller, LIMITS } = require('./sandbox');

const argv = process.argv.slice(2), file = argv[0]; if (!file) { console.error('usage: node trace.js controller.js [--split train|heldout] [--seed 11] [--index 0] [--density 0.5] [--every 5]'); process.exit(2); }
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const split = opt('split', 'train'), seed = +opt('seed', 11), index = +opt('index', 0), density = +opt('density', 0.5), every = +opt('every', 5);
const start = makeStarts(seed, index + 1, split)[index], secs = +opt('seconds', budget(start));
console.log(`start ${start.id}: ${start.mode}, job #${start.story}, ${start.hour}:00${start.rain ? ' rain' : ''}, hp ${start.hp}, wanted ${start.wanted}, ${start.giverDist} m from the giver, ${secs} s`);
const ctl = new Controller(fs.readFileSync(file, 'utf8'), start.seed, LIMITS), w = createWorld(start.seed, { density }); w.setup(start);
const ticksPerLine = Math.round(every / (THINK_EVERY * DT)); let last = {};
for (let i = 0, n = Math.floor(secs / (THINK_EVERY * DT)); i < n; i++) {
  const o = w.obs(), a = ctl.step(o); last = a; w.act(a); w.tick(!!a.fire);
  if (i % ticksPerLine === 0) console.log(`${String(Math.round(o.t)).padStart(4)}s ${o.me.mode.padEnd(8)} at (${Math.round(o.me.x)},${Math.round(o.me.z)}) spd ${String(o.me.spd).padStart(5)} hp ${o.me.hp} wanted ${o.me.wanted} goal ${o.goal ? o.goal.d + ' m (' + o.goal.kind + ')' : '-'} route ${o.gps ? o.gps.d : '-'} job ${o.mission.name || '-'} | ${JSON.stringify(a).slice(0, 90)}`);
  if (!w.alive()) { console.log('the player is down'); break; }
}
void last;
const s = w.summary(); console.log(JSON.stringify({ points: s.points, approach: s.approach, started: s.started, passed: s.passed, wheels: s.wheels, offences: s.offences, stuck: s.stuck, errors: ctl.errors, firstError: ctl.firstError }));
console.log('events:', s.events.map(e => `${Math.round(e.t)}s ${e.text}`).join('; ')); console.log('game said:', s.notes.join(' | '));
