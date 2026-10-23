#!/usr/bin/env node
'use strict';
// G3 percept-only bots (DESIGN §18.8). Bots see only CS.display() and act only through real input (a finger at
// 390x844 and 844x390, a mouse at 1366x1024), on the ?drive clock so they go fast (tools/bots/harness.cjs):
//  1. the lint (tools/bots/lint.cjs): no bot reads the game's internals (and the lint catches its planted cases);
//  2. GhostReaderBot (tools/bots/ghostreader.cjs) at each size: zero surprises in --ghost drops (5,000 by default), and
//     the harness's audit agrees: each release was the outcome its ghost showed, and a fit landed as its ghost;
//  3. HumanishBot (tools/bots/humanish.cjs) at each size: 0.3 s reaction, at most 4 columns looked at per tile, its
//     release off by up to 6 px; how often a tile left from another column than the one it chose (its own count from
//     what it saw, and the audit's from the game's own record): at most 5% for squares.
// The sizes run side by side, one browser each. No console errors.
//   node clack-stack/tools/bots.cjs [--sizes=...] [--ghost=5000] [--humanish=800] [--seed=1]
const path = require('path');
const { spawnSync } = require('child_process');
const G = require('./g3lib.cjs');
const H = require('./bots/harness.cjs');
const Ghost = require('./bots/ghostreader.cjs');
const Human = require('./bots/humanish.cjs');

const NG = +G.argOf('ghost', 5000), NH = +G.argOf('humanish', 800), SEED = +G.argOf('seed', 1);
const T = G.reporter('bots');

async function oneSize(size, k) {
  const out = { size: size.name, lines: [] };
  const browser = await G.launch();
  try {
    if (NG) {
      const g = await G.open(browser, size, { drive: 1, autostart: 1, seed: 100 * SEED + k });
      await g.page.waitForFunction(() => window.CS && CS.state().phase === 'play');
      const r = await H.run(g, Ghost, { bot: { seed: 1000 * SEED + k, drops: NG } });
      // the game's own record: each crash laid at the last release before it that showed a ghost weight
      const ev = await g.page.evaluate(() => CS.events.filter(e => e.type === 'release' || e.type === 'crash').map(e => ({ type: e.type, id: e.id, t: e.t, src: e.src })));
      const gwOf = new Map(r.audit.releases.filter(x => x.meta && x.meta.gw).map(x => [x.id, x.meta.gw]));
      let lastR = null; const whiteTips = [];
      for (const e of ev) { if (e.type === 'release') { if (e.src === 'fuse' || gwOf.has(e.id)) lastR = e; continue; } if (lastR && gwOf.get(lastR.id) === 'white') whiteTips.push({ id: lastR.id, after: +(e.t - lastR.t).toFixed(3) }); lastR = null; }
      const rel = r.audit.releases.filter(x => x.meta && x.meta.says);
      const said = rel.filter(x => x.meta.says !== x.outcome), landed = rel.filter(x => x.outcome === 'fit' && x.became === 'land'), badLand = landed.filter(x => x.landKey !== x.key);
      // (a lift of a finger the fuse spent lets nothing go, and is not a drop)
      const lifts = r.audit.releases.filter(x => x.meta && x.meta.lift);
      out.ghost = { report: r.report, audit: { releases: rel.length, said: said.length, landed: landed.length, badLand: badLand.length, fuse: r.audit.fuse, none: r.audit.releases.filter(x => x.none && !(x.meta && x.meta.lift)).length, lifts: lifts.length, liftsDropped: lifts.filter(x => !x.none).length, whiteTips }, ms: r.audit.ms, errors: g.errors.slice() };
      await g.context.close();
    }
    if (NH) {
      const g = await G.open(browser, size, { drive: 1, autostart: 1, seed: 200 * SEED + k });
      await g.page.waitForFunction(() => window.CS && CS.state().phase === 'play');
      const r = await H.run(g, Human, { bot: { seed: 2000 * SEED + k, drops: NH } });
      const rel = r.audit.releases.filter(x => x.meta && x.meta.piece && !x.none);
      const wrong = { sq: rel.filter(x => x.piece === 'sq' && x.lookCol !== x.handCol).length, tri: rel.filter(x => x.piece === 'tri' && x.lookCol !== x.handCol).length };
      const n = { sq: rel.filter(x => x.piece === 'sq').length, tri: rel.filter(x => x.piece === 'tri').length };
      out.human = { report: r.report, audit: { n, wrong, fuse: r.audit.fuse }, ms: r.audit.ms, errors: g.errors.slice() };
      await g.context.close();
    }
  } finally { await browser.close(); }
  return out;
}

(async () => {
  const t0 = Date.now();
  // 1. the lint
  const lint = spawnSync(process.execPath, [path.join(__dirname, 'bots', 'lint.cjs')], { encoding: 'utf8' });
  for (const l of (lint.stdout || '').trim().split('\n')) console.log('  ' + l);
  T.check(lint.status === 0, 'the bots pass the percept-only lint');
  if (lint.status !== 0) { T.done(); return; }
  const sizes = G.sizesFrom();
  // (each size its own seeds, the same whichever sizes run)
  const res = await Promise.all(sizes.map(s => oneSize(s, G.SIZES.findIndex(q => q.name === s.name) + 1)));
  const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '-';
  let gTotal = 0, gSurp = 0;
  for (const r of res) {
    if (r.ghost) {
      const R = r.ghost.report, A = r.ghost.audit;
      gTotal += R.drops; gSurp += R.surprises;
      T.check(R.drops >= NG && R.surprises === 0, `${r.size} GhostReaderBot: ${R.surprises} surprises in ${R.drops} drops (${R.fits} white ghosts, ${R.offs} red: ${Object.entries(R.labels).map(([k, v]) => v + ' ' + k).join(', ') || 'none'}${R.tipsMarked ? ', ' + R.tipsMarked + ' TIPS OVER marked' : ''}; ${R.crashes} crashes over ${R.runs} runs)` + (R.surprises ? ': ' + JSON.stringify(R.kinds) + ' ' + R.examples.slice(0, 4).join(' | ') : ''));
      T.check(A.said === 0 && A.badLand === 0 && A.none === 0 && A.liftsDropped === 0, `${r.size} GhostReaderBot audit: every release was what its ghost showed (${A.releases - A.said}/${A.releases}), every fit landed as its ghost (${A.landed - A.badLand}/${A.landed})${A.fuse ? `; ${A.fuse} let go by the fuse` : ''}${A.lifts ? `; ${A.lifts} lifts of a finger the fuse had spent, ${A.liftsDropped} of which let a tile go` : ''}`);
      T.check(R.whiteTips === 0 && A.whiteTips.length === 0, `${r.size} GhostReaderBot: no white ghost weight before a crash (seen: ${R.whiteTips}; the game's record: ${A.whiteTips.length})` + (R.whiteTips || A.whiteTips.length ? ' ' + JSON.stringify({ seen: R.whiteEx, record: A.whiteTips.slice(0, 3) }) : ''));
      T.info(`${r.size} GhostReaderBot: the ghost weight was white for ${R.whiteDrops} drops (${R.whiteTips} then tipped the tower) and red for ${R.redDrops} (${R.warned} of them with the amber ghost and PAST THE WHEEL! by it); ${R.unread} pictures too wobbly to read; ${(r.ghost.ms / 1000).toFixed(0)} s, ${(r.ghost.ms / Math.max(1, R.drops)).toFixed(0)} ms a drop`);
      T.check(!r.ghost.errors.length, `${r.size} GhostReaderBot: no console errors` + (r.ghost.errors.length ? ': ' + r.ghost.errors.slice(0, 2).join(' / ') : ''));
    }
    if (r.human) {
      const R = r.human.report, A = r.human.audit;
      T.check(R.by.sq.n >= 0.5 * NH && R.by.sq.wrong / R.by.sq.n <= 0.05 && A.wrong.sq / Math.max(1, A.n.sq) <= 0.05, `${r.size} HumanishBot: squares left from another column than chosen ${R.by.sq.wrong}/${R.by.sq.n} (${pct(R.by.sq.wrong, R.by.sq.n)}; the audit ${A.wrong.sq}/${A.n.sq}), gate 5%`);
      T.info(`${r.size} HumanishBot: triangles ${R.by.tri.wrong}/${R.by.tri.n} (${pct(R.by.tri.wrong, R.by.tri.n)}; the audit ${A.wrong.tri}/${A.n.tri}); columns looked at per tile ${R.looks.slice(1).map((v, i) => (i + 1) + ': ' + v).join(', ')}; ${R.offs} fell off, ${R.crashes} crashes over ${R.runs} runs; the fuse let go ${R.fuse + A.fuse} times while it looked; ${(r.human.ms / 1000).toFixed(0)} s` + (R.examples.length ? '; e.g. ' + R.examples.slice(0, 3).join(' | ') : ''));
      T.check(!r.human.errors.length, `${r.size} HumanishBot: no console errors` + (r.human.errors.length ? ': ' + r.human.errors.slice(0, 2).join(' / ') : ''));
    }
  }
  if (NG) T.info(`GhostReaderBot: ${gSurp} surprises in ${gTotal} drops at ${res.length} sizes`);
  T.info(`${((Date.now() - t0) / 1000).toFixed(0)} s`);
  T.done();
})().catch(e => { console.error(e); process.exitCode = 1; });
