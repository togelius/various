#!/usr/bin/env node
'use strict';
// The strategy bots (DESIGN 17.6, 18.8 G4; adapted to revision 5, to be frozen before tuning): whole runs from the title,
// real mouse input, until the results card (a crash, TOPPED OUT! or THE BOX IS EMPTY!). The bots see what the page's
// hooks report (CS.state, CS.drops: what a drop at each column would do, as the ghost and the ghost weight show it) and
// act only by moving and clicking the mouse.
//   SpamBot     clicks at a fixed x (the middle of the screen) as fast as it can
//   RandomBot   clicks a random column of the tile in the hand, after a 0.3 s reaction
//   StackBot    always aims for the highest landing among the places the tile fits (0.3 s reaction)
//   CarefulBot  waits for the sway to settle (as long as the fuse allows), never takes a drop whose ghost weight is red,
//               and plans for one box: a tower two tiles wide over the middle, the triangles low at the sides, THE TOPPER
//               on the very top (see carefulPick). With no safe fit it lets a tile fall off.
// Requirements (revision 4's, kept until §18.8's are set on frozen bots): the median best height ranks CarefulBot >
// StackBot > SpamBot, CarefulBot at least 1.5x SpamBot, and every crash happens with the weight past a wheel.
//   node clack-stack/tools/strategy.cjs [--seeds=1-10] [--bots=spam,random,stack,careful]   (VERBOSE=1: each run)
const { launch, gamePage, until, gameWait, sleep } = require('./lib.cjs');

const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const seedArg = opt('seeds', '1-10'), SEEDS = [];
for (const part of seedArg.split(',')) { const m = /^(\d+)(?:-(\d+))?$/.exec(part); if (m) for (let s = +m[1]; s <= +(m[2] || m[1]); s++) SEEDS.push(s); }
const BOTS = opt('bots', 'spam,random,stack,careful').split(','), TS = { spam: 1, random: 2, stack: 2, careful: 4 };
const W = 390, H = 844, Y = H * 0.5;
const PLAYED = { 'clackstack.prefs5': JSON.stringify({ played: true }) };

// in the page, from the hooks only: the careful choice for the tile in the hand. One box of 60 tiles: the careful plan is
// a tower two tiles wide over the middle of the car (squares on the lower of its two columns, so its top stays flat),
// with the triangles kept off it, low at the sides where they widen the base, and THE TOPPER on the very top. Every
// drop it takes is safe by the ghost weight; when its plan has none, the most balanced safe fit anywhere.
function carefulPick() {
  const s = CS.state();
  if (s.phase !== 'play' || !s.piece) return null;
  const ds = CS.drops(true), w = s.weight.wheel;
  if (!ds.length) return null;
  const safe = ds.filter(o => o.outcome === 'fit' && !o.tip);
  const bal = o => 2 * Math.abs(o.settle) + 2 * Math.max(Math.abs(o.lo), Math.abs(o.hi)) / w;
  const pickMin = (list, f) => { let b = null, bs = Infinity; for (const o of list) { const v = f(o); if (v < bs) { bs = v; b = o; } } return b; };
  let best = null;
  if (s.topper) best = pickMin(safe, o => -o.top + 0.1 * bal(o));
  else if (s.piece === 'sq') best = pickMin(safe.filter(o => o.col === -2 || o.col === 0), o => o.base + 0.3 * bal(o));
  else best = pickMin(safe.filter(o => o.col <= -4 || o.col >= 2), o => o.base + bal(o) + (o.kick === 'half' ? 0.2 : 0));
  if (!best) best = pickMin(safe, o => bal(o) + 1.2 * o.base + 3 * Math.max(0, Math.abs(o.lx) - 1.25) + (o.kick === 'half' ? 0.6 : 0));
  if (best) return { col: best.handCol, sx: best.sx, off: false };
  // no safe fit: let it fall off where it does no harm (or, if every column fits but tips, the least bad)
  const off = ds.find(o => o.outcome === 'off');
  if (off) return { col: off.handCol, sx: off.sx, off: true };
  let lb = null;
  for (const o of ds) if (!lb || Math.abs(o.settle) < Math.abs(lb.settle)) lb = o;
  return { col: lb.handCol, sx: lb.sx, off: false };
}
function stackPick() {
  const ds = CS.drops(false).filter(o => o.outcome === 'fit');
  ds.sort((a, b) => b.top - a.top || Math.abs(a.lx) - Math.abs(b.lx));
  return ds[0] || CS.drops(false)[0];
}

async function click(page, x) { await page.mouse.move(x, Y); await page.mouse.down(); await page.mouse.up(); }
async function lastId(page) { return page.evaluate(() => CS.lastRelease ? CS.lastRelease.id : 0); }

async function run(browser, bot, seed) {
  const { context, page, errors } = await gamePage(browser, { width: W, height: H }, { seed, ts: TS[bot], nohint: 1, mute: 1 }, { storage: PLAYED });
  await click(page, W / 2);                          // the title: a tap starts the run
  await until(page, () => CS.state().phase === 'play', null, 20000);
  let drops = 0;
  const t0 = Date.now(), rnd = (() => { let a = seed * 7919 + 13; return () => ((a = (a * 1103515245 + 12345) >>> 0) / 4294967296); })();
  while (true) {
    const st = await page.evaluate(() => { const s = CS.state(); return { phase: s.phase, ready: s.handReady && !s.locked && !s.swapping }; });
    if (st.phase === 'over' || st.phase === 'title') break;
    if (Date.now() - t0 > 20 * 60000) { errors.push('run timed out'); break; }
    if (st.phase !== 'play' || !st.ready) {
      if (bot === 'spam') await click(page, W / 2); else await sleep(2);
      continue;
    }
    const id = await lastId(page);
    if (bot === 'spam') { await click(page, W / 2); continue; }
    await gameWait(page, 0.3);
    if (bot === 'random') {
      const x = await page.evaluate(r => { const s = CS.state(), [lo, hi] = s.colRange, step = s.piece === 'sq' ? 2 : 1; return CS.colToX(lo + step * Math.floor(r * ((hi - lo) / step + 1))); }, rnd());
      await click(page, x);
    } else if (bot === 'stack') {
      const d = await page.evaluate(stackPick);
      if (!d) continue;
      await click(page, d.sx);
    } else {
      // wait for the sway and the rock to settle, as long as the fuse allows
      await until(page, () => {
        const s = CS.state();
        if (s.phase !== 'play') return true;
        return (s.swayAmp < 0.1 && s.theta === 0 && Math.abs(s.omega) < 0.05) || !s.fuse.on || s.fuse.max - s.fuse.t < 0.45;
      }, null, 60000);
      const p = await page.evaluate(carefulPick);
      if (!p) continue;
      await click(page, p.sx);
    }
    drops++;
    await until(page, i => (CS.lastRelease && CS.lastRelease.id > i) || CS.state().phase !== 'play', id, 10000).catch(() => {});
  }
  const r = await page.evaluate(() => ({ s: CS.state(), crashes: CS.events.filter(e => e.type === 'crash'), lands: CS.events.filter(e => e.type === 'land').length,
    offs: CS.events.filter(e => e.type === 'release' && e.outcome === 'off').length, swaps: CS.events.filter(e => e.type === 'swap').length, fuses: CS.events.filter(e => e.type === 'fuse').length,
    end: CS.state().over ? CS.state().over.final.end : '?', topper: CS.events.filter(e => e.type === 'land' && e.topper).map(e => ({ key: e.key, top: e.top })), lastLand: CS.events.filter(e => e.type === 'land').slice(-3).map(e => e.key + '@' + e.top) }));
  const cm = r.s.over ? r.s.over.final.cm : Math.round(r.s.best * 7.5);
  await context.close();
  return { cm, end: r.end, crashes: r.crashes, lands: r.lands, offs: r.offs, swaps: r.swaps, fuses: r.fuses, topper: r.topper, lastLand: r.lastLand, errors };
}

(async () => {
  const browser = await launch();
  const med = {};
  let bad = 0;
  try {
    for (const bot of BOTS) {
      const rs = [];
      for (const seed of SEEDS) {
        const r = await run(browser, bot, seed);
        rs.push(r);
        if (process.env.VERBOSE) console.log(`  ${bot} seed ${seed}: ${r.cm} cm (${r.end}), ${r.lands} landed, ${r.offs} fell off, ${r.swaps} swaps, ${r.fuses} fuses` + (process.env.VERBOSE > 1 ? ' ' + JSON.stringify({ topper: r.topper, last: r.lastLand }) : ''));
        for (const c of r.crashes) if (!c.past) { bad++; console.log(`  ${bot} seed ${seed}: a crash with the weight at ${c.weight} (wheel ${c.wheel})`); }
        if (r.errors.length) { bad++; console.log(`  ${bot} seed ${seed}: ` + r.errors.join(' / ')); }
      }
      const cms = rs.map(r => r.cm).sort((a, b) => a - b), n = cms.length;
      med[bot] = (cms[(n - 1) >> 1] + cms[n >> 1]) / 2;
      const ends = {}; for (const r of rs) ends[r.end] = (ends[r.end] || 0) + 1;
      const lost = rs.reduce((a, r) => a + r.offs, 0), all = rs.reduce((a, r) => a + r.offs + r.lands, 0);
      console.log(`${bot.padEnd(8)} median ${String(med[bot]).padStart(5)} cm  [${rs.map(r => r.cm + (r.end === 'topped' ? '^' : r.end === 'empty' ? '=' : '')).join(' ')}]  ends ${JSON.stringify(ends)}  landed ${rs.map(r => r.lands).join(',')}  fell off ${(100 * lost / Math.max(1, all)).toFixed(0)}%  swaps ${rs.reduce((a, r) => a + r.swaps, 0)}  crashes ${rs.reduce((a, r) => a + r.crashes.length, 0)} (all past a wheel: ${rs.every(r => r.crashes.every(c => c.past))})`);
    }
  } finally {
    await browser.close();
  }
  if (med.spam !== undefined && med.stack !== undefined && med.careful !== undefined) {
    const ok = med.careful > med.stack && med.stack > med.spam && med.careful >= 1.5 * med.spam;
    console.log(`ranking CarefulBot ${med.careful} > StackBot ${med.stack} > SpamBot ${med.spam}, CarefulBot ${(med.careful / med.spam).toFixed(2)}x SpamBot: ${ok ? 'PASS' : 'FAIL'}`);
    if (!ok) bad++;
  }
  console.log('(^ TOPPED OUT!, = THE BOX IS EMPTY!, otherwise a crash)');
  process.exitCode = bad ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
