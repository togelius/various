#!/usr/bin/env node
'use strict';
// Screenshots of every screen to LOOK at (DESIGN 17.6), on a phone held both ways (touch): the title, the first drop
// with its hint, aiming a square, aiming a triangle over a notch, a hang over an edge, the off-base cross, the weight
// going amber, a swaying tower, a mark passed, a tall tower (the weight pinned to the bottom), the crash and the
// results card. Real touch input; the scenes are built with CS.build (the same drop function). Fails on page or
// console errors, or if a ghost, its column, the weight or a hint is missing where the scene needs it.
//   node clack-stack/tools/screens.cjs [outDir] [--sizes=390x844,844x390]
// Writes outDir/<size>/NN-name.png and outDir/sheet-<size>.png.
const path = require('path');
const fs = require('fs');
const { launch, gamePage, until, gameWait, ready, touch, sleep } = require('./lib.cjs');

const argv = process.argv.slice(2);
const out = path.resolve(argv.find(a => !a.startsWith('--')) || path.join(require('os').tmpdir(), 'clack-screens'));
const SIZES = ((argv.find(a => a.startsWith('--sizes=')) || '--sizes=390x844,844x390').slice(8)).split(',').map(s => s.split('x').map(Number));
let bad = 0;
const fail = m => { bad++; console.log('  FAIL ' + m); };

(async () => {
  const browser = await launch();
  try {
    for (const [W, H] of SIZES) {
      const dir = path.join(out, `${W}x${H}`);
      fs.mkdirSync(dir, { recursive: true });
      const files = [];
      let n = 0;
      const shot = async (page, name) => { const f = path.join(dir, String(++n).padStart(2, '0') + '-' + name + '.png'); await page.screenshot({ path: f }); files.push(f); };
      // a scene on a parked base: tiles placed with CS.build, a piece in the hand, the finger held down over column k
      const scene = async (name, build, piece, k, before, check) => {
        const { context, page, errors } = await gamePage(browser, { width: W, height: H }, { autostart: 1, nohint: 1, mute: 1, seed: 7 }, { touch: true });
        await ready(page);
        await page.evaluate(([b, p]) => { CS.build(b); CS.setPiece(p); }, [build, piece]);
        await gameWait(page, 1.2);                   // (the camera settles on the new build)
        const T = await touch(page);
        const x = await page.evaluate(k => CS.kToX(k), k);
        await T.down(x, H * 0.5); await T.move(x, H * 0.5);
        if (before) await page.evaluate(before);
        await gameWait(page, 0.35);
        await shot(page, name);
        if (check) { const why = await page.evaluate(check); if (why) fail(`${W}x${H} ${name}: ${why}`); }
        if (errors.length) fail(`${W}x${H} ${name}: ` + errors.join(' / '));
        return { context, page, errors, T, x };
      };
      const aimed = () => { const g = CS.ghost(), gd = CS.guide(); return !g ? 'no ghost' : !gd ? 'no guide column' : !CS.weightBox() ? 'no weight' : ''; };

      // 1. the title
      {
        const { context, page, errors } = await gamePage(browser, { width: W, height: H }, { mute: 1, seed: 7 }, { touch: true });
        await sleep(700);
        await shot(page, 'title');
        // 2. the first drop: a tap starts the run; the first-time hint, the ghost on the bare base
        const T = await touch(page);
        await T.tap(W / 2, H * 0.45);
        await ready(page);
        await T.down(W / 2, H * 0.5);
        await gameWait(page, 0.4);
        await shot(page, 'first-drop-hint');
        const tip = await page.evaluate(() => CS.tipBox());
        if (!tip || tip.id !== 'drop') fail(`${W}x${H} first drop: no "Let go" hint`);
        await T.up();
        if (errors.length) fail(`${W}x${H} title: ` + errors.join(' / '));
        await context.close();
      }
      // 3. aiming a square: it lands on the column under it, beside the triangle
      (await scene('aim-square', [['sq', -1], ['sq', 1], ['sq', -1], ['tri', 1], ['sq', -1]], 'sq', 1, null, aimed)).context.close();
      // 4. a triangle over a notch: it drops in point-down, a TRUSS
      (await scene('aim-notch-truss', [['sq', -1], ['sq', 1], ['sq', -1], ['sq', 1], ['tri', -1], ['tri', 1]], 'tri', 0, null,
        () => { const g = CS.ghost(); return !g || g.type !== 'dn' || !g.truss ? 'the ghost is not point-down in the notch' : ''; })).context.close();
      // 5. a hang over an edge: half on the column, half over the air past the car
      (await scene('hang-over-edge', [['sq', 3], ['sq', 3], ['sq', 3], ['sq', -1], ['sq', 1]], 'sq', 4, null,
        () => { const g = CS.ghost(); return !g || g.grade !== 'great' ? 'not a hang' : ''; })).context.close();
      // 6. over the rug: the tile lies there with a cross
      {
        const kMax = await (async () => { const { context, page } = await gamePage(browser, { width: W, height: H }, { autostart: 1, nohint: 1, mute: 1 }, { touch: true }); await ready(page); const m = await page.evaluate(() => CS.state().kMax); await context.close(); return m; })();
        (await scene('off-base-cross', [['sq', -1], ['sq', 1], ['tri', -1]], 'sq', -kMax, null,
          () => { const g = CS.ghost(); return !g || !g.rug ? 'not over the rug' : ''; })).context.close();
      }
      // 7. the weight going amber: a tower leaning right; aiming further out shows where it would go (red: it tips)
      (await scene('weight-amber', [['sq', 3], ['sq', 3], ['sq', 3], ['sq', 3], ['sq', 3], ['sq', 4]], 'sq', 4, null,
        () => { const s = CS.state(); return s.weight.zone !== 'amber' ? 'the weight is ' + s.weight.zone : ''; })).context.close();
      // 8. a tall thin tower swaying: the sway carries the weight toward a wheel
      (await scene('sway', [['sq', 0], ['sq', 0], ['sq', 0], ['sq', 0], ['sq', 0], ['sq', 0], ['sq', 0], ['sq', 0]], 'sq', 0, () => { WOB.W = 0.32; WOB.dir = 1; },
        () => CS.state().swayAmp < 0.3 ? 'not swaying' : '')).context.close();
      // 9. a mark passed: the drop that takes the tower past the watermelon bag (4 L)
      {
        const s = await scene('mark-aim', [['sq', 1], ['sq', 1], ['sq', 1], ['sq', -1], ['sq', -1]], 'sq', 1);
        await s.T.up();
        await until(s.page, () => !!CS.banner(), null, 5000).catch(() => fail(`${W}x${H} mark: no banner`));
        await gameWait(s.page, 0.25);
        await shot(s.page, 'mark-passed');
        await s.context.close();
      }
      // 10. a tall braced tower: the camera has scrolled and the weight is pinned to the bottom of the screen
      {
        const b = [];
        for (let r = 0; r < 7; r++) { for (let j = 0; j < 4; j++) b.push(['sq', -1], ['sq', 1]); b.push(['tri', -1], ['tri', 1], ['tri', 0]); }
        const s = await scene('tall-pinned-weight', b, 'sq', 0, null, () => { const w = CS.weightBox(); return !w ? 'no weight' : !w.pinned ? 'the weight is not pinned (camY ' + CS.cam().camY.toFixed(0) + ')' : ''; });
        await s.context.close();
      }
      // 11. the crash and 12. the results card: a leaning tower, one more out over the edge
      {
        const s = await scene('crash-aim', [['sq', 3], ['sq', 3], ['sq', 3], ['sq', 3], ['sq', 3], ['sq', 3], ['sq', 4], ['sq', 4]], 'sq', 5);
        await s.T.up();
        await until(s.page, () => CS.state().phase === 'crash', null, 8000).catch(() => fail(`${W}x${H}: no crash`));
        await sleep(120);
        await shot(s.page, 'crash');
        await until(s.page, () => CS.state().over && CS.state().over.open, null, 10000);
        await gameWait(s.page, 1.2);
        await shot(s.page, 'results');
        const ev = await s.page.evaluate(() => CS.events.filter(e => e.type === 'crash'));
        if (!ev.length || !ev.every(e => e.past)) fail(`${W}x${H}: a crash with the weight not past a wheel`);
        if (s.errors.length) fail(`${W}x${H} crash: ` + s.errors.join(' / '));
        await s.context.close();
      }
      // contact sheet
      const cols = W > H ? 3 : 6, tw = Math.round(W / (W > H ? 2.2 : 2.6)), th = Math.round(tw * H / W);
      const html = `<html><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:3px">` +
        files.map(f => `<div style="position:relative"><img src="file://${f}" style="width:${tw}px;height:${th}px;display:block"><div style="position:absolute;left:2px;top:2px;font:11px sans-serif;color:#fff;background:#000a">${path.basename(f, '.png')}</div></div>`).join('') + '</body></html>';
      const hp = path.join(out, `sheet-${W}x${H}.html`);
      fs.writeFileSync(hp, html);
      const sp = await browser.newPage({ viewport: { width: cols * (tw + 3), height: Math.ceil(files.length / cols) * (th + 3) } });
      await sp.goto('file://' + hp); await sp.waitForTimeout(300);
      await sp.screenshot({ path: path.join(out, `sheet-${W}x${H}.png`) });
      await sp.close();
      console.log(`screens ${W}x${H}: ${files.length}`);
    }
  } finally {
    await browser.close();
  }
  console.log('wrote', out);
  process.exitCode = bad ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
