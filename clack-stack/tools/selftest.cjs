#!/usr/bin/env node
'use strict';
// The game against its rules (DESIGN 18.7, 18.8):
//  1. tools/build.cjs --check: the rules block inlined in index.html is the rules file, byte for byte, and loads pure;
//  2. index.html?selftest headless: the inlined RULES answers golden cases; for thousands of random builds (tiles in the
//     air, both modes) the ghost is the rules' drop at the hand's column, the game's own release takes it, a fit lands on
//     it and one that falls off leaves the build alone; the fit markers are the drop at every column; the game's tiles
//     are the rules' build and never overlap; the box (60, 42 ■ and 18 ▲, at most two ▲ in a row, five ■ first on a
//     first run, THE TOPPER last); the dead-tile swap; ΔW; the kick fit;
//  3. the ghost is the landing through real input: a few dozen real mouse drops, the ghost under the hand before each
//     press against what was let go and where it landed.
// Exits non-zero unless all three pass with no console errors.
//   node clack-stack/tools/selftest.cjs [--rules=path]   (the rules file the page was built from; default rules.js)
const path = require('path');
const { spawnSync } = require('child_process');
const { launch, gamePage, until, gameWait, ready } = require('./lib.cjs');

const rulesArg = process.argv.find(a => a.startsWith('--rules='));

(async () => {
  let failed = false;
  // 1. the inlined rules are the file
  const args = [path.join(__dirname, 'build.cjs'), '--check'];
  if (rulesArg) args.push(rulesArg);
  const b = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const bl = ((b.stdout || '') + (b.stderr || '')).trim();
  console.log('build.cjs --check: ' + bl);
  if (b.status !== 0) failed = true;
  const browser = await launch();
  try {
    // 2. the in-page selftest
    const { page, errors, logs } = await gamePage(browser, { width: 390, height: 844 }, { selftest: '', mute: 1, nohint: 1 });
    const t0 = Date.now();
    let line = null;
    while (Date.now() - t0 < 120000) {
      line = logs.find(l => /^SELFTEST (PASS|FAIL)/.test(l));
      if (line || errors.length) break;
      await page.waitForTimeout(100);
    }
    const r = await page.evaluate(() => window.__selftest || null);
    console.log(line || 'no SELFTEST line within 120 s');
    if (r) {
      console.log(`  rules reasons: ${(r.reasons || []).join(', ')}; ${r.ghostTrials} releases (${r.fits} fits, ${r.offs} off, ${r.pulled} pulled), ${r.markers} marker sets, ${r.tips} TIPS OVER ghosts, ${r.boxes} boxes, ${r.mirrors} mirrored builds, ${r.ms} ms`);
      for (const f of r.failures || []) console.log('  - ' + f);
    }
    if (errors.length) { console.log('console/page errors:'); for (const e of errors) console.log('  ' + e); }
    if (!line || !line.startsWith('SELFTEST PASS') || errors.length) failed = true;
    await page.context().close();
    // 3. real drops: the ghost under the hand is what each press lets go, and where it lands
    {
      const { page: p, errors: e2 } = await gamePage(browser, { width: 390, height: 844 }, { autostart: 1, mute: 1, nohint: 1, seed: 21, ts: 2 }, { storage: { 'clackstack.prefs5': JSON.stringify({ played: true }) } });
      let n = 0, same = 0, landedOk = 0, landedN = 0, offs = 0;
      const lets = [];
      const rnd = (() => { let a = 7; return () => ((a = (a * 1103515245 + 12345) >>> 0) / 4294967296); })();
      for (let guard = 0; n < 40 && guard < 400; guard++) {
        const s = await p.evaluate(() => CS.state());
        if (s.phase !== 'play') break;
        if (!s.handReady || s.locked) { await gameWait(p, 0.05); continue; }
        const [lo, hi] = s.colRange, step = s.piece === 'sq' ? 2 : 1, col = lo + step * Math.floor(rnd() * ((hi - lo) / step + 1));
        const x = await p.evaluate(c => CS.colToX(c), col);
        await p.mouse.move(x + 2, 420);
        await p.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
        const g = await p.evaluate(() => { const g = CS.ghost(); return g && { key: g.key, outcome: g.outcome }; });
        const id = await p.evaluate(() => CS.lastRelease ? CS.lastRelease.id : 0);
        await p.mouse.down(); await p.mouse.up();
        await until(p, i => (CS.lastRelease && CS.lastRelease.id > i) || CS.state().phase !== 'play', id, 5000).catch(() => {});
        const rel = await p.evaluate(() => CS.lastRelease);
        if (!g || !rel || rel.id === id) continue;
        n++; if (rel.key === g.key) same++;
        if (g.outcome === 'fit') lets.push({ id: rel.id, key: g.key }); else offs++;
        await gameWait(p, 0.15 + rnd() * 0.4);
      }
      await gameWait(p, 0.8);
      const res = await p.evaluate(lets => lets.map(l => { const e = CS.events.find(q => q.type === 'land' && q.id === l.id); return e ? (e.key === l.key ? 1 : 0) : -1; }), lets);
      landedN = res.filter(v => v >= 0).length; landedOk = res.filter(v => v === 1).length;
      const okR = n >= 25 && same === n && landedOk === landedN && landedN > 10;
      console.log(`${okR ? 'PASS' : 'FAIL'} real drops: the ghost before each press was what it let go ${same}/${n} (${offs} fell off), and where it landed ${landedOk}/${landedN}`);
      if (e2.length) console.log('  errors: ' + e2.join(' / '));
      if (!okR || e2.length) failed = true;
      await p.context().close();
    }
  } finally {
    await browser.close();
  }
  console.log(failed ? 'selftest: FAILED' : 'selftest: all passed');
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
