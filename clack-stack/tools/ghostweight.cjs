#!/usr/bin/env node
'use strict';
// G3 the ghost weight against what really happens (DESIGN §18.5, 18.8): no white drop tips the tower. At each size,
// through real input on the ?drive clock, a player who courts trouble: three drops in five the fit that swings the weight
// furthest (toward a wheel), the rest any fit or any column, often in quick succession (tiles in the air) and on
// swaying towers. Before each release it reads the ghost weight as drawn (CS.display: white, or red when this drop may
// tip the tower) and lets go 0 to 0.2 s later (a player's delay; the colour may itself be up to a tenth of a second
// old). Every crash is laid at the last release before it that showed a ghost weight (a tile that falls off shows
// none and changes nothing): the gate is that none of those was white. Also reported:
// how many red drops did tip it, and the share of crashes the ghost weight warned of. No console errors.
//   node clack-stack/tools/ghostweight.cjs [--sizes=...] [--drops=800]
const G = require('./g3lib.cjs');

const N = +G.argOf('drops', 800);
const T = G.reporter('ghostweight');

async function oneSize(size, k) {
  const browser = await G.launch();
  const res = { size: size.name, drops: 0, white: 0, red: 0, none: 0, crashes: 0, whiteTips: [], redTips: 0, otherTips: 0, fuse: 0, errors: [], runs: 1 };
  try {
    const g = await G.open(browser, size, { drive: 1, autostart: 1, nohint: 1, seed: 300 + k });
    const { page, input } = g;
    await page.waitForFunction(() => window.CS && CS.state().phase === 'play');
    const rnd = G.rng(77 + k), color = new Map();
    let guard = 0;
    while (res.drops < N && guard++ < N * 20) {
      const s = await G.state(page);
      if (s.phase === 'over') {
        if (!s.over.open) { await G.wait(page, 0.3); continue; }
        const b = (await G.display(page)).buttons.find(q => q.name === 'again');
        await input.tap((b.box.x0 + b.box.x1) / 2, (b.box.y0 + b.box.y1) / 2);
        await G.frame(page); await G.wait(page, 1.2); res.runs++;
        continue;
      }
      if (s.phase !== 'play' || !s.handReady || s.locked || s.swapping) { await G.wait(page, 0.05); continue; }
      // where: the fit that swings the weight furthest, any fit, or anywhere
      const ds = await page.evaluate(() => CS.drops(true).map(d => ({ col: d.handCol, fit: d.outcome === 'fit', reach: d.outcome === 'fit' ? Math.max(Math.abs(d.lo), Math.abs(d.hi)) : 0 })));
      const fits = ds.filter(d => d.fit), u = rnd();
      let col;
      if (fits.length && u < 0.6) col = fits.reduce((a, b) => (b.reach > a.reach ? b : a)).col;
      else if (fits.length && u < 0.85) col = fits[Math.floor(rnd() * fits.length)].col;
      else col = ds[Math.floor(rnd() * ds.length)].col;
      const x = await page.evaluate(c => CS.colToX(c), col);
      await input.aim(x, size.h * 0.55);
      await G.frame(page); await G.step(page, 11);
      const d = await G.display(page), id0 = await page.evaluate(() => CS.lastRelease ? CS.lastRelease.id : 0);
      if (d.hand && d.hand.col !== col) continue;
      const c = d.ghostWeight ? d.ghostWeight.color : null;
      // a player's delay between seeing it and letting go
      const v = rnd();
      if (v > 0.25) await G.wait(page, v < 0.5 ? 0.05 : v < 0.75 ? 0.1 : 0.2);
      if ((await page.evaluate(() => CS.lastRelease ? CS.lastRelease.id : 0)) !== id0) { res.fuse++; continue; }
      if ((await G.state(page)).phase !== 'play') continue;
      await input.release();
      await G.frame(page);
      const rel = await page.evaluate(() => CS.lastRelease);
      if (!rel || rel.id === id0) continue;
      color.set(rel.id, c);
      res.drops++;
      if (c === 'white') res.white++; else if (c === 'red') res.red++; else res.none++;
      // the next one at once, soon or after a while
      const w = rnd();
      await G.wait(page, w < 0.3 ? 0 : w < 0.7 ? 0.1 + 0.3 * rnd() : 0.5 + 0.5 * rnd());
    }
    await G.wait(page, 4);
    const ev = await page.evaluate(() => CS.events.filter(e => e.type === 'release' || e.type === 'crash').map(e => ({ type: e.type, t: e.t, id: e.id, src: e.src, past: e.past })));
    // (a tile that falls off changes nothing and shows no ghost weight: the crash is laid at the last drop before it
    // that did show one, or at the fuse)
    let last = null;
    for (const e of ev) {
      if (e.type === 'release') { if (e.src === 'fuse' || color.get(e.id)) last = e; continue; }
      res.crashes++;
      const c = last ? (last.src === 'fuse' ? 'fuse' : color.get(last.id)) : null;
      if (c === 'white') res.whiteTips.push({ id: last.id, t: e.t, after: +(e.t - last.t).toFixed(3) });
      else if (c === 'red') res.redTips++;
      else res.otherTips++;
      last = null;            // (the tower is gone: nothing more is laid at it)
    }
    res.errors = g.errors.slice();
    await g.context.close();
  } finally { await browser.close(); }
  return res;
}

(async () => {
  const t0 = Date.now();
  const all = await Promise.all(G.sizesFrom().map((s, k) => oneSize(s, k + 1)));
  for (const r of all) {
    T.check(r.drops >= N && r.whiteTips.length === 0, `${r.size}: no white drop tipped the tower: ${r.whiteTips.length} of ${r.white} white drops did` + (r.whiteTips.length ? ' ' + JSON.stringify(r.whiteTips.slice(0, 3)) : ''));
    T.info(`${r.size}: ${r.drops} drops over ${r.runs} runs: ${r.white} white, ${r.red} red${r.none ? ', ' + r.none + ' with no ghost weight (a tile that falls off)' : ''}; ${r.crashes} crashes, ${r.redTips} of them after a red drop (${r.crashes ? (100 * r.redTips / r.crashes).toFixed(0) : '-'}% warned of${r.otherTips ? '; ' + r.otherTips + ' after the fuse let go' : ''}); ${r.red - r.redTips} red drops stood${r.fuse ? '; the fuse let go ' + r.fuse + ' times first' : ''}`);
    T.check(r.crashes >= N / 100 && r.red >= N / 30, `${r.size}: the player found trouble: ${r.crashes} crashes, ${r.red} red drops`);
    T.check(!r.errors.length, `${r.size}: no console errors` + (r.errors.length ? ': ' + r.errors.slice(0, 2).join(' / ') : ''));
  }
  T.info(`${((Date.now() - t0) / 1000).toFixed(0)} s`);
  T.done();
})().catch(e => { console.error(e); process.exitCode = 1; });
