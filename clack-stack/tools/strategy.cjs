#!/usr/bin/env node
'use strict';
// The strategy gate (DESIGN §18.8 G4). Seven frozen bots play whole runs, one box each, on the ?drive clock (seeded and
// stepped, so a run is the same every time), at 390x844 with a mouse. Each bot sees only percepts (CS.display() as
// drawn, tools/bots/harness.cjs) and acts only through real input (pointer moves and clicks); the bots are linted
// (tools/bots/lint.cjs) and their sources must match tools/bots/FROZEN. The tool alone reads the game, after each run,
// to audit it (the game's own log: every release, landing, fall and crash).
//   SpamBot          clicks at the middle of the screen as fast as it can (tools/bots/spam.cjs)
//   RandomBot        a random column for each tile, after a 0.3 s reaction (tools/bots/random.cjs)
//   StackBot         the highest landing among the places the tile fits (tools/bots/stack.cjs)
//   SpireBot, Spire2Bot, PatientSpireBot   stacking straight up, one wide or two, the last one waiting for the tower to
//                    be still (tools/bots/spire.cjs)
//   CarefulBot       patience, balance and a plan for one box (tools/bots/careful.cjs)
// The gate, on the acceptance seeds (11-30):
//   CarefulBot's median best height at least 1.25x the best spire bot's and at least 1.5x each of SpamBot's,
//   RandomBot's and StackBot's; the spire bots and StackBot crash in at least 7 runs of 10; CarefulBot loses at most
//   10% of its tiles; every crash happens with the weight past a wheel; no invariant is ever violated (each run's
//   releases replayed through the page's own rules: every release is what RULES.drop says at its column, and every
//   build it makes is sound by tools/rules/geom.cjs checkState, I10). No console errors.
// Tuning uses seeds 1-10 only (the default); the acceptance seeds are run once.
//   node clack-stack/tools/strategy.cjs [--seeds=1-10] [--bots=spam,random,stack,spire,spire2,patient,careful] [--par=2]
//     [--json=out.json] [--unfrozen]     (VERBOSE=1: a line per run)
//   CLACK_GAME=other.html runs it against another build (tools/lib.cjs)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const G = require('./g3lib.cjs');
const H = require('./bots/harness.cjs');
const geom = require('./rules/geom.cjs');

const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const SEEDS = [];
for (const part of opt('seeds', '1-10').split(',')) { const m = /^(\d+)(?:-(\d+))?$/.exec(part); if (m) for (let s = +m[1]; s <= +(m[2] || m[1]); s++) SEEDS.push(s); }
const BOTDIR = path.join(__dirname, 'bots');
const spire = require('./bots/spire.cjs');
const BOT = {
  spam: { name: 'SpamBot', mod: require('./bots/spam.cjs') },
  random: { name: 'RandomBot', mod: require('./bots/random.cjs') },
  stack: { name: 'StackBot', mod: require('./bots/stack.cjs') },
  spire: { name: 'SpireBot', mod: spire.SpireBot },
  spire2: { name: 'Spire2Bot', mod: spire.Spire2Bot },
  patient: { name: 'PatientSpireBot', mod: spire.PatientSpireBot },
  careful: { name: 'CarefulBot', mod: require('./bots/careful.cjs') },
};
const BOTS = opt('bots', Object.keys(BOT).join(',')).split(',').filter(b => BOT[b]);
const PAR = Math.max(1, +opt('par', 2));
const JSON_OUT = opt('json', null);
const UNFROZEN = argv.includes('--unfrozen');
const SIZE = { name: '390x844', w: 390, h: 844, touch: false };
const SPIRES = ['spire', 'spire2', 'patient'];

// the frozen bots: every file the bots are made of, by its sha256
const FROZEN_FILES = ['harness.cjs', 'percept.cjs', 'spam.cjs', 'random.cjs', 'stack.cjs', 'spire.cjs', 'careful.cjs'];
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(BOTDIR, f))).digest('hex');
function frozenCheck() {
  const file = path.join(BOTDIR, 'FROZEN');
  if (!fs.existsSync(file)) return { ok: false, why: 'tools/bots/FROZEN is missing' };
  const want = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) { const m = /^([0-9a-f]{64})\s+(\S+)/.exec(line); if (m) want[m[2]] = m[1]; }
  const bad = FROZEN_FILES.filter(f => want[f] !== sha(f));
  return { ok: !bad.length, why: bad.length ? 'changed since frozen: ' + bad.join(', ') : FROZEN_FILES.length + ' files match' };
}

// the page's own rules, and the key the game gives a drop result
const RULES = G.pageRules();
const keyOf = r => (r.outcome === 'fit' ? 'fit:' : 'off:') + (r.pose.type === 'down' ? 'dn' : r.pose.type) + r.pose.col + '@' + r.pose.y[0] + ',' + r.pose.y[1];
// Replay a run's releases: each must be RULES.drop at its column (the way the rules choose), and every build sound (I10)
function replay(rels) {
  let B = RULES.newBuild({ half: 2 });
  const errs = [];
  for (const e of rels) {
    const r = RULES.drop(B, e.piece, e.col);
    const k = keyOf(r);
    if (k !== e.key) { errs.push(`release ${e.id}: the game's ${e.key}, the rules' ${k}`); break; }
    if (r.outcome !== 'fit') continue;
    B = RULES.place(B, r);
    const st = geom.checkState(RULES.tiles(B), 2);
    if (st.errs.length) { errs.push(`after release ${e.id}: ${st.errs.slice(0, 2).join('; ')}`); break; }
  }
  return errs;
}

async function oneRun(browser, bot, seed) {
  const g = await G.open(browser, SIZE, { drive: 1, autostart: 1, seed, nohint: 1, mute: 1 }, { touch: false });
  try {
    await g.page.waitForFunction(() => window.CS && CS.state().phase === 'play', null, { timeout: 30000 });
    const t0 = Date.now();
    const r = await H.run(g, BOT[bot].mod, { bot: { seed: 7919 * seed + 13 }, maxActions: 600000 });
    const res = await g.page.evaluate(() => {
      const ev = CS.events, s = CS.state();
      return {
        rels: ev.filter(e => e.type === 'release').map(e => ({ id: e.id, key: e.key, col: e.col, piece: e.piece, way: e.way, src: e.src, outcome: e.outcome, reason: e.reason, t: e.t })),
        lands: ev.filter(e => e.type === 'land').map(e => ({ t: e.t, top: e.top, W: e.W, dW: e.dW, lam: e.lam, piece: e.piece, col: e.col })),
        crashes: ev.filter(e => e.type === 'crash'), over: s.over && s.over.final, best: s.best, t: s.t, phase: s.phase,
        fuses: ev.filter(e => e.type === 'fuse').length, swaps: ev.filter(e => e.type === 'swap').length,
      };
    });
    const offs = res.rels.filter(e => e.outcome === 'off');
    return {
      bot, seed, cm: res.over ? res.over.cm : Math.round(res.best * 7.5), end: res.over ? res.over.end : '?', why: res.over ? res.over.why : null,
      lands: res.lands.length, offs: offs.length, offReasons: offs.reduce((a, e) => (a[e.reason] = (a[e.reason] || 0) + 1, a), {}),
      fuses: res.fuses, swaps: res.swaps, crashes: res.crashes.map(c => ({ t: c.t, top: c.top, weight: c.weight, wheel: c.wheel, past: c.past, W: c.W, sway: c.sway, swaying: c.swaying })),
      gameT: res.t, ms: Date.now() - t0, inv: replay(res.rels), errors: g.errors.slice(), report: r.report, maxW: res.lands.reduce((m, l) => Math.max(m, l.W), 0),
      lands1: res.lands,
    };
  } finally { await g.context.close(); }
}

const median = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (s[(n - 1) >> 1] + s[n >> 1]) / 2 : 0; };

(async () => {
  const t0 = Date.now();
  let bad = 0;
  const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) bad++; };
  // the bots: linted, and frozen
  const lint = spawnSync(process.execPath, [path.join(BOTDIR, 'lint.cjs')], { encoding: 'utf8' });
  check(lint.status === 0, 'the bots pass the percept-only lint' + (lint.status ? ':\n' + lint.stdout : ''));
  const fz = frozenCheck();
  if (UNFROZEN) console.log(`     (--unfrozen: the bots ${fz.ok ? 'match' : 'do not match'} tools/bots/FROZEN: ${fz.why})`);
  else check(fz.ok, `the bots are the frozen ones (tools/bots/FROZEN: ${fz.why})`);
  console.log(`     seeds ${SEEDS[0]}-${SEEDS[SEEDS.length - 1]} (${SEEDS.length}), ${BOTS.map(b => BOT[b].name).join(', ')}; ${process.env.CLACK_GAME ? 'page ' + process.env.CLACK_GAME : 'index.html'}`);
  const jobs = [];
  for (const bot of BOTS) for (const seed of SEEDS) jobs.push({ bot, seed });
  const out = {};
  const browser = await G.launch();
  try {
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(PAR, jobs.length) }, async () => {
      while (next < jobs.length) {
        const j = jobs[next++];
        const r = await oneRun(browser, j.bot, j.seed);
        (out[j.bot] = out[j.bot] || []).push(r);
        if (process.env.VERBOSE) console.log(`  ${BOT[j.bot].name} seed ${j.seed}: ${r.cm} cm (${r.end}${r.why ? ', ' + r.why : ''}), ${r.lands} landed, ${r.offs} fell off ${JSON.stringify(r.offReasons)}, ${r.fuses} by the fuse, max W ${r.maxW.toFixed(2)}, ${r.gameT.toFixed(0)} s of play, ${(r.ms / 1000).toFixed(0)} s` + (r.crashes.length ? `; crash at ${r.crashes[0].top.toFixed(1)} L, weight ${r.crashes[0].weight} (wheel ${r.crashes[0].wheel}), W ${r.crashes[0].W}` : ''));
      }
    }));
  } finally { await browser.close(); }
  const med = {}, sum = {};
  for (const bot of BOTS) {
    const rs = (out[bot] || []).sort((a, b) => a.seed - b.seed);
    med[bot] = median(rs.map(r => r.cm));
    const ends = {}; for (const r of rs) ends[r.end] = (ends[r.end] || 0) + 1;
    const lost = rs.reduce((a, r) => a + r.offs, 0), all = rs.reduce((a, r) => a + r.offs + r.lands, 0), crashed = rs.filter(r => r.end === 'crash').length;
    sum[bot] = { median: med[bot], crashed, n: rs.length, lostPct: 100 * lost / Math.max(1, all), runs: rs.map(r => r.cm), ends };
    console.log(`${BOT[bot].name.padEnd(15)} median ${String(med[bot]).padStart(5)} cm  [${rs.map(r => r.cm + (r.end === 'topped' ? '^' : r.end === 'empty' ? '=' : r.end === 'crash' ? '' : '?')).join(' ')}]  crashed ${crashed}/${rs.length}  fell off ${(100 * lost / Math.max(1, all)).toFixed(1)}%  landed ${rs.map(r => r.lands).join(',')}`);
    for (const r of rs) {
      for (const c of r.crashes) if (!c.past) { bad++; console.log(`FAIL   ${BOT[bot].name} seed ${r.seed}: a crash with the weight at ${c.weight} (wheel ${c.wheel})`); }
      if (r.inv.length) { bad++; console.log(`FAIL   ${BOT[bot].name} seed ${r.seed}: an invariant: ${r.inv.join(' / ')}`); }
      if (r.errors.length) { bad++; console.log(`FAIL   ${BOT[bot].name} seed ${r.seed}: ${r.errors.slice(0, 2).join(' / ')}`); }
      if (r.end === '?') { bad++; console.log(`FAIL   ${BOT[bot].name} seed ${r.seed}: the run did not end (${JSON.stringify(r.report)})`); }
    }
  }
  const all = BOTS.flatMap(b => out[b] || []);
  check(all.every(r => r.crashes.every(c => c.past)), `every crash happened with the weight past a wheel (${all.reduce((a, r) => a + r.crashes.length, 0)} crashes)`);
  check(all.every(r => !r.inv.length), `no invariant violated: every release is the rules' drop and every build is sound (${all.reduce((a, r) => a + r.lands + r.offs, 0)} releases in ${all.length} runs)`);
  check(all.every(r => !r.errors.length), 'no console errors');
  if (med.careful !== undefined) {
    const C = med.careful;
    const sp = SPIRES.filter(b => med[b] !== undefined);
    if (sp.length) { const best = sp.reduce((a, b) => (med[b] > med[a] ? b : a)); check(C >= 1.25 * med[best], `CarefulBot ${C} cm >= 1.25x the best spire bot (${BOT[best].name} ${med[best]} cm): ${(C / Math.max(1e-9, med[best])).toFixed(2)}x`); }
    for (const b of ['spam', 'random', 'stack']) if (med[b] !== undefined) check(C >= 1.5 * med[b], `CarefulBot ${C} cm >= 1.5x ${BOT[b].name} (${med[b]} cm): ${(C / Math.max(1e-9, med[b])).toFixed(2)}x`);
    check(sum.careful.lostPct <= 10, `CarefulBot loses at most 10% of its tiles: ${sum.careful.lostPct.toFixed(1)}%`);
  }
  for (const b of SPIRES.concat(['stack'])) if (sum[b]) check(sum[b].crashed >= 0.7 * sum[b].n, `${BOT[b].name} crashes in at least 70% of its runs (7 in 10): ${sum[b].crashed}/${sum[b].n}`);
  console.log('(^ TOPPED OUT!, = THE BOX IS EMPTY!, otherwise a crash)');
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ seeds: SEEDS, page: process.env.CLACK_GAME || 'index.html', sum, runs: out }, null, 1));
  console.log(`strategy: ${bad ? bad + ' FAILED' : 'PASS'} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  process.exitCode = bad ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
