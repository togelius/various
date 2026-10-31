#!/usr/bin/env node
'use strict';
// SQUARE OFF — headless AI-vs-AI balance batches (DESIGN §12.3 M8).
// Runs seeded matches across faction pairings in parallel worker threads and prints a win-rate /
// match-length table; optionally writes a CSV with one row per match.
//
//   node tools/sim-batch.js                       # 6 pairings x 20 = 120 matches, mirrored personality, Regular
//   node tools/sim-batch.js --n 40 --csv out.csv  # 40 per pairing, CSV
//   node tools/sim-batch.js --pers default        # each crew plays its default personality (§7.2)
//   node tools/sim-batch.js --pers matrix         # personality-vs-personality table (factions mirrored at random)
//   node tools/sim-batch.js --pers random --diff hard --map north --workers 8 --seed 1000
//   node tools/sim-batch.js --mirror              # also run Hustle-vs-Hustle etc. (side balance)
//
// Options: --n per pairing (default 20), --diff chill|regular|hard|legend, --pers mirror|default|random|matrix|<name>,
//          --map whole|north|south|random, --events off|calm|normal|chaos, --workers N, --seed base, --csv path,
//          --quiet (table only), --json (print the summary as JSON),
//          --tweak path.js (a module exporting function (SQ) that edits SQ.data before any match: try balance
//          changes without touching js/data; e.g. module.exports = (SQ) => { SQ.data.units.pack.crowd.speed = 6; })
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');

const ROOT = path.resolve(__dirname, '..');
const FACTIONS = ['hustle', 'noise', 'violets', 'pack'];
const PERS = ['hustler', 'mosh', 'turtle', 'opportunist'];
const DEFAULT_PERS = { hustle: 'turtle', noise: 'turtle', violets: 'mosh', pack: 'opportunist' };

function parseArgs(argv) {
  const o = { n: 20, diff: 'regular', pers: 'mirror', map: 'whole', events: 'normal', workers: Math.max(1, Math.min(12, os.cpus().length - 1)), seed: 1, csv: null, quiet: false, json: false, mirror: false };
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k];
    const v = () => argv[++k];
    if (a === '--n') o.n = +v();
    else if (a === '--diff') o.diff = v();
    else if (a === '--pers') o.pers = v();
    else if (a === '--map') o.map = v();
    else if (a === '--events') o.events = v();
    else if (a === '--workers') o.workers = Math.max(1, +v());
    else if (a === '--seed') o.seed = +v();
    else if (a === '--csv') o.csv = v();
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--json') o.json = true;
    else if (a === '--mirror') o.mirror = true;
    else if (a === '--tweak') o.tweak = path.resolve(v());
    else if (a === '--help' || a === '-h') { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 17).join('\n')); process.exit(0); }
  }
  return o;
}

/** Build the job list. Sides alternate (NW/SE) so map asymmetry cancels out. */
function jobs(o) {
  const out = [];
  let seed = o.seed;
  const pairs = [];
  if (o.pers === 'matrix') {
    for (let a = 0; a < PERS.length; a++) for (let b = a + 1; b < PERS.length; b++) pairs.push({ pa: PERS[a], pb: PERS[b] });
  } else {
    for (let a = 0; a < FACTIONS.length; a++) for (let b = a + (o.mirror ? 0 : 1); b < FACTIONS.length; b++) pairs.push({ fa: FACTIONS[a], fb: FACTIONS[b] });
  }
  for (const p of pairs) {
    for (let k = 0; k < o.n; k++) {
      const s = seed++;
      const r = mulberry(s * 2654435761 >>> 0);
      let fa = p.fa, fb = p.fb, pa, pb;
      if (o.pers === 'matrix') { fa = FACTIONS[Math.floor(r() * 4)]; fb = fa; pa = p.pa; pb = p.pb; }
      else if (o.pers === 'mirror') { pa = pb = PERS[Math.floor(r() * 4)]; }
      else if (o.pers === 'default') { pa = DEFAULT_PERS[fa]; pb = DEFAULT_PERS[fb]; }
      else if (o.pers === 'random') { pa = PERS[Math.floor(r() * 4)]; pb = PERS[Math.floor(r() * 4)]; }
      else { pa = pb = o.pers; }
      const swap = k % 2 === 1;
      out.push({ seed: s, map: o.map, events: o.events, diff: o.diff, swap,
        A: { faction: fa, personality: pa }, B: { faction: fb, personality: pb } });
    }
  }
  return out;
}

function mulberry(a) {
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Run one match headless; returns a result row. Exported for tests. */
function runMatch(SQ, job) {
  const first = job.swap ? job.B : job.A, second = job.swap ? job.A : job.B;
  const m = SQ.Match.create({
    seed: job.seed, quiet: true, mapId: job.map, events: job.events,
    players: [
      { faction: first.faction, ai: { personality: first.personality, difficulty: job.diff } },
      { faction: second.faction, ai: { personality: second.personality, difficulty: job.diff } },
    ],
  });
  const t0 = Date.now();
  let barks = 0, crew = [0, 0], events = 0;
  m.bus.on('aiBark', () => { barks++; });
  m.bus.on('crewCall', (p) => { crew[p.faction]++; });
  m.bus.on('eventStart', () => { events++; });
  const maxTicks = 20 * 700;
  for (let k = 0; k < maxTicks && !m.state.over; k++) m.tick(0.05);
  const st = m.state;
  const iA = job.swap ? 1 : 0, iB = job.swap ? 0 : 1;
  const win = st.winner;
  return {
    seed: job.seed, map: job.map, diff: job.diff, swap: job.swap,
    fA: job.A.faction, fB: job.B.faction, pA: job.A.personality, pB: job.B.personality,
    homeA: st.factions[iA].home, homeB: st.factions[iB].home,
    winner: win === iA ? 'A' : win === iB ? 'B' : '-', winFaction: win >= 0 ? st.factions[win].key : '-',
    winPers: win === iA ? job.A.personality : win === iB ? job.B.personality : '-',
    winHome: win >= 0 ? st.factions[win].home : '-',
    reason: st.reason || 'timeout', t: Math.round(st.t * 10) / 10, clock: Math.round(st.clock),
    turfA: Math.round(st.factions[iA].turf), turfB: Math.round(st.factions[iB].turf),
    heldA: st.factions[iA].stats.peakLandmarks, heldB: st.factions[iB].stats.peakLandmarks,
    lostA: st.factions[iA].stats.lost, lostB: st.factions[iB].stats.lost,
    crewA: crew[iA], crewB: crew[iB], barks, events, ms: Date.now() - t0,
  };
}

function median(a) {
  if (!a.length) return NaN;
  const s = a.slice().sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function fmt(t) { const m = Math.floor(t / 60), s = Math.round(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; }

function summarize(rows, o) {
  const groups = {};
  for (const r of rows) {
    const key = o.pers === 'matrix' ? r.pA + ' vs ' + r.pB : r.fA + ' vs ' + r.fB;
    (groups[key] || (groups[key] = [])).push(r);
  }
  const table = [];
  for (const key of Object.keys(groups)) {
    const g = groups[key];
    const a = g.filter((r) => r.winner === 'A').length, b = g.filter((r) => r.winner === 'B').length;
    const len = g.map((r) => r.t);
    const reasons = {};
    for (const r of g) reasons[r.reason] = (reasons[r.reason] || 0) + 1;
    table.push({ pairing: key, n: g.length, winA: a, winB: b, rateA: g.length ? a / g.length : 0, median: median(len), min: Math.min(...len), max: Math.max(...len), reasons });
  }
  const all = rows.map((r) => r.t);
  const side = {};
  for (const r of rows) if (r.winHome !== '-') side[r.winHome] = (side[r.winHome] || 0) + 1;
  const byFaction = {};
  for (const r of rows) {
    for (const [f, w] of [[r.fA, r.winner === 'A'], [r.fB, r.winner === 'B']]) {
      const e = byFaction[f] || (byFaction[f] = { games: 0, wins: 0 });
      e.games++; if (w) e.wins++;
    }
  }
  const byPers = {};
  for (const r of rows) {
    for (const [p, w] of [[r.pA, r.winner === 'A'], [r.pB, r.winner === 'B']]) {
      const e = byPers[p] || (byPers[p] = { games: 0, wins: 0 });
      e.games++; if (w) e.wins++;
    }
  }
  return { table, n: rows.length, median: median(all), within: rows.filter((r) => r.t >= 300 && r.t <= 480).length, side, byFaction, byPers };
}

function printSummary(sum, o) {
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\nSQUARE OFF sim-batch: ${sum.n} matches, map ${o.map}, ${o.diff}, personalities: ${o.pers}, events: ${o.events}`);
  console.log(pad('pairing', 30) + pad('n', 5) + pad('A wins', 9) + pad('B wins', 9) + pad('A rate', 9) + pad('median', 9) + pad('range', 14) + 'endings');
  for (const r of sum.table) {
    const ok = r.rateA >= 0.4 && r.rateA <= 0.6 ? ' ' : '!';
    console.log(pad(r.pairing, 30) + pad(r.n, 5) + pad(r.winA, 9) + pad(r.winB, 9) + pad((r.rateA * 100).toFixed(0) + '%' + ok, 9) +
      pad(fmt(r.median), 9) + pad(fmt(r.min) + '-' + fmt(r.max), 14) + Object.entries(r.reasons).map(([k, v]) => k + ' ' + v).join(', '));
  }
  console.log(`overall median ${fmt(sum.median)}; ${sum.within}/${sum.n} matches in 5:00-8:00`);
  console.log('wins by home: ' + Object.entries(sum.side).map(([k, v]) => k + ' ' + v).join(', '));
  console.log('by crew: ' + Object.entries(sum.byFaction).map(([k, v]) => `${k} ${(v.wins / v.games * 100).toFixed(0)}% (${v.games})`).join(', '));
  console.log('by personality: ' + Object.entries(sum.byPers).map(([k, v]) => `${k} ${(v.wins / v.games * 100).toFixed(0)}% (${v.games})`).join(', '));
}

function toCSV(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  return keys.join(',') + '\n' + rows.map((r) => keys.map((k) => r[k]).join(',')).join('\n') + '\n';
}

if (!isMainThread) {
  const load = require(path.join(ROOT, 'test', 'load.js'));
  const SQ = load({ plugins: true });
  if (workerData && workerData.tweak) require(workerData.tweak)(SQ);
  parentPort.on('message', (job) => {
    if (job === 'exit') { process.exit(0); }
    let row;
    try { row = runMatch(SQ, job); } catch (e) { row = { error: String(e && e.stack || e), seed: job.seed }; }
    parentPort.postMessage(row);
  });
} else if (require.main === module) {
  const o = parseArgs(process.argv.slice(2));
  const list = jobs(o);
  const rows = [];
  const t0 = Date.now();
  let next = 0, done = 0;
  const nW = Math.min(o.workers, list.length);
  if (!o.quiet) process.stderr.write(`running ${list.length} matches on ${nW} workers...\n`);
  const finish = () => {
    rows.sort((a, b) => a.seed - b.seed);
    const errs = rows.filter((r) => r.error);
    if (errs.length) { console.error(errs.length + ' matches crashed; first:\n' + errs[0].error); }
    const good = rows.filter((r) => !r.error);
    const sum = summarize(good, o);
    if (o.json) console.log(JSON.stringify(sum, null, 1)); else printSummary(sum, o);
    if (o.csv) { fs.writeFileSync(o.csv, toCSV(good)); console.log('CSV -> ' + o.csv); }
    if (!o.quiet) console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s wall)`);
    process.exitCode = errs.length ? 1 : 0;
  };
  for (let w = 0; w < nW; w++) {
    const worker = new Worker(__filename, { workerData: { tweak: o.tweak || null } });
    const feed = () => {
      if (next < list.length) worker.postMessage(list[next++]);
      else worker.postMessage('exit');
    };
    worker.on('message', (row) => {
      rows.push(row);
      done++;
      if (!o.quiet && done % 10 === 0) process.stderr.write(`  ${done}/${list.length}\n`);
      if (done === list.length) finish();
      feed();
    });
    worker.on('error', (e) => { console.error(e); });
    feed();
  }
}

module.exports = { runMatch, jobs, summarize, parseArgs };
