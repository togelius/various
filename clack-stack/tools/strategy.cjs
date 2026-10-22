#!/usr/bin/env node
'use strict';
// The strategy bots (DESIGN 17.6): whole runs from the title, seeds 1-10, real mouse input, until the results card.
//   SpamBot     clicks at a fixed x (the middle of the screen) as fast as it can
//   StackBot    always aims for the highest landing (a 0.3 s reaction before each drop)
//   CarefulBot  balance-greedy, braces with triangles when it can, never lets the ghost weight go red: it waits for the
//               sway to settle (as long as the fuse allows) and takes the drop that keeps the weight nearest the middle
//               and the tower low and wide; a TRUSS whenever one is open; when every drop is red it drops on the rug
//               (losing the tile). If it has had to do that 12 times running with the tower at rest, the tower is as tall
//               as it can safely get: the bot stops and its best height stands (the run is ended from the pause menu).
//               A careful run still standing after --cap s of play (240) is scored there the same way.
// Requirements: the median best height ranks CarefulBot > StackBot > SpamBot, CarefulBot at least 1.5x SpamBot, and
// every crash happens with the weight past a wheel.
//   node clack-stack/tools/strategy.cjs [--seeds=10] [--bots=spam,stack,careful] [--cap=240]   (VERBOSE=1: each run)
const { launch, gamePage, until, gameWait, sleep } = require('./lib.cjs');

const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const SEEDS = +opt('seeds', 10), BOTS = opt('bots', 'spam,stack,careful').split(','), TS = { spam: 1, stack: 2, careful: 4 };
const W = 390, H = 844, Y = H * 0.5;
// a careful run still standing after CAP s of play (four minutes) is scored there: it could go on for as long as the
// bot is patient (a wide, braced tower hardly sways), and the ranking is long settled by then
const CAP = +opt('cap', 240);

// in the page: the careful choice (the column k), from CS.drops(true): every column with its landing and look-ahead
function carefulPick() {
  if (!HAND.piece || CS.state().phase !== 'play') return null;
  const ds = CS.drops(true), B = S.B, shape = HAND.piece.shape, w = TW.w;
  if (!ds.length) return null;
  let best = null, bs = Infinity;
  for (const o of ds) {
    if (o.rug || o.tip) continue;
    let s = 2 * Math.abs(o.settle) + 1.2 * o.base + 3 * Math.max(0, Math.abs(o.lx) - 1.25) + 2 * Math.max(Math.abs(o.lo), Math.abs(o.hi)) / w;
    if (o.truss) s -= 100;
    if (o.grade === 'clack') s += 2; else if (o.grade === 'great') s += 0.8;
    // half a notch: a point-up triangle beside another on its row, the notch between them still open
    if (shape === 'tri' && o.type === 'up') for (const dk of [-1, 1]) {
      const D = getPose('dn', o.i + dk, o.a, o.b), e = D.edges[dk > 0 ? 0 : 2], ent = B.emap.get(e.key);
      if (ent && ent.length === 1 && ent[0].owner.type === 'up') s -= 3;
    }
    if (s < bs) { bs = s; best = o; }
  }
  if (best) return { k: best.k, sx: best.sx, rug: false };
  const r = ds.find(o => o.rug) || ds[ds.length - 1];
  return { k: r.k, sx: r.sx, rug: true };
}

async function click(page, x) { await page.mouse.move(x, Y); await page.mouse.down(); await page.mouse.up(); }
async function lastId(page) { return page.evaluate(() => CS.lastRelease ? CS.lastRelease.id : 0); }

async function run(browser, bot, seed) {
  const { context, page, errors } = await gamePage(browser, { width: W, height: H }, { seed, ts: TS[bot], nohint: 1, mute: 1 });
  await click(page, W / 2);                          // the title: a tap starts the run
  await until(page, () => CS.state().phase === 'play', null, 20000);
  let rugRun = 0, stuck = false, capped = false, drops = 0;
  const t0 = Date.now();
  while (true) {
    const st = await page.evaluate(() => { const s = CS.state(); return { phase: s.phase, ready: s.handReady && !s.locked, still: s.still }; });
    if (st.phase === 'over' || st.phase === 'title') break;
    if (Date.now() - t0 > 20 * 60000) { errors.push('run timed out'); break; }
    if (bot === 'careful' && (await page.evaluate(() => CS.state().t)) > CAP) { capped = true; break; }
    if (st.phase !== 'play' || !st.ready) {
      if (bot === 'spam') await click(page, W / 2); else await sleep(2);
      continue;
    }
    const id = await lastId(page);
    if (bot === 'spam') { await click(page, W / 2); continue; }
    if (bot === 'stack') {
      await gameWait(page, 0.3);
      const d = await page.evaluate(() => {
        const ds = CS.drops(false).filter(o => !o.rug);
        ds.sort((a, b) => b.top - a.top || Math.abs(a.k) - Math.abs(b.k));
        return ds[0] || CS.drops(false)[0];
      });
      await click(page, d.sx);
    } else {
      // wait for the sway and the rock to settle, as long as the fuse allows (0.3 s reaction at least)
      await gameWait(page, 0.3);
      await until(page, () => {
        const s = CS.state();
        if (s.phase !== 'play') return true;
        return (s.swayAmp < 0.1 && s.theta === 0 && Math.abs(s.omega) < 0.05) || !s.fuse.on || s.fuse.max - s.fuse.t < 0.45;
      }, null, 60000);
      const p = await page.evaluate(carefulPick);
      if (!p) continue;
      if (p.rug) { if (++rugRun >= 12 && (await page.evaluate(() => CS.state().still))) { stuck = true; break; } } else rugRun = 0;
      await click(page, p.sx);
    }
    drops++;
    await until(page, i => (CS.lastRelease && CS.lastRelease.id > i) || CS.state().phase !== 'play', id, 10000).catch(() => {});
  }
  if (stuck || capped) {
    // the run ends from the pause menu (P, then MENU)
    await page.keyboard.press('p');
    await until(page, () => CS.state().phase === 'paused', null, 5000).catch(() => errors.push('stuck: could not pause'));
    if ((await page.evaluate(() => CS.state().phase)) === 'paused') await page.click('button[aria-label="Menu"]');
  }
  const r = await page.evaluate(() => ({ s: CS.state(), crashes: CS.events.filter(e => e.type === 'crash'), lands: CS.events.filter(e => e.type === 'land').length,
    rugs: CS.events.filter(e => e.type === 'rug').length, trusses: CS.events.filter(e => e.type === 'truss').length, fuses: CS.events.filter(e => e.type === 'fuse').length }));
  const cm = r.s.over ? r.s.over.final.cm : Math.round(r.s.best * 7.5);
  await context.close();
  return { cm, stuck, capped, crashes: r.crashes, lands: r.lands, rugs: r.rugs, trusses: r.trusses, fuses: r.fuses, errors };
}

(async () => {
  const browser = await launch();
  const med = {};
  let bad = 0;
  try {
    for (const bot of BOTS) {
      const rs = [];
      for (let seed = 1; seed <= SEEDS; seed++) {
        const r = await run(browser, bot, seed);
        rs.push(r);
        if (process.env.VERBOSE) console.log(`  ${bot} seed ${seed}: ${r.cm} cm${r.stuck ? ' (stopped: all red)' : r.capped ? ' (still standing after ' + CAP + ' s)' : ''}, ${r.lands} landed, ${r.rugs} lost, ${r.trusses} TRUSS`);
        for (const c of r.crashes) if (!c.past) { bad++; console.log(`  ${bot} seed ${seed}: a crash with the weight at ${c.weight} (wheel ${c.wheel})`); }
        if (r.errors.length) { bad++; console.log(`  ${bot} seed ${seed}: ` + r.errors.join(' / ')); }
      }
      const cms = rs.map(r => r.cm).sort((a, b) => a - b);
      med[bot] = (cms[(SEEDS - 1) >> 1] + cms[SEEDS >> 1]) / 2;
      console.log(`${bot.padEnd(8)} median ${String(med[bot]).padStart(5)} cm  [${rs.map(r => r.cm + (r.stuck ? '*' : r.capped ? '+' : '')).join(' ')}]  landed ${rs.map(r => r.lands).join(',')}  rug ${rs.map(r => r.rugs).join(',')}  truss ${rs.map(r => r.trusses).join(',')}  fuse ${rs.map(r => r.fuses).join(',')}  crashes ${rs.reduce((a, r) => a + r.crashes.length, 0)} (all past a wheel: ${rs.every(r => r.crashes.every(c => c.past))})`);
    }
  } finally {
    await browser.close();
  }
  if (med.spam !== undefined && med.stack !== undefined && med.careful !== undefined) {
    const ok = med.careful > med.stack && med.stack > med.spam && med.careful >= 1.5 * med.spam;
    console.log(`ranking CarefulBot ${med.careful} > StackBot ${med.stack} > SpamBot ${med.spam}, CarefulBot ${(med.careful / med.spam).toFixed(2)}x SpamBot: ${ok ? 'PASS' : 'FAIL'}`);
    if (!ok) bad++;
  }
  console.log('(* the careful bot stopped: every drop was red with the tower at rest; + still standing after ' + CAP + ' s of play)');
  process.exitCode = bad ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
