#!/usr/bin/env node
'use strict';
// G3 display-list audit (DESIGN §18.7, 18.8): hiding each layer changes the pixels it claims. For every scene at
// 390x844, 844x390 and 1366x1024, for every layer CS.display() lists with a box:
//  - the control: the same frame drawn twice is the same picture (else no audit of it means anything);
//  - hiding the layer (CS.hide) changes the picture, and every pixel it changes lies in the box the layer claims (a hint
//    that moves because the layer no longer keeps it out may change its own two places too);
//  - showing it again gives back the same picture;
//  - the KNOCK IT DOWN button (a real button over the canvas): hiding it takes it off the screen in its box.
// Also that the display list holds what §18.7 lists for the scene (the tiles, the hand, the ghost and its parts, the fit
// markers, the weight and the ghost weight, the fuse, NEXT, the counter, the hint). The scenes: aiming a square, a
// triangle; ONLY A POINT; TIPS OVER (rules that have it); a propped fit, its double bar, and the bar flashing as it lands
// (rules that have props: golden case 19); open gaps (placed and aimed); a tall tower (the weight pinned); BIG MAGNETS;
// THE TOPPER in the hand; tiles in the air and falling off; the dead-tile swap; a hint and the fuse; a crash; the results
// card. Quizzes are still pictures; the rest run on the ?drive clock with real input. No console errors.
//   node clack-stack/tools/display.cjs [--sizes=...]
const G = require('./g3lib.cjs');

const T = G.reporter('display');
const R = G.pageRules();
const HAS_TIPS = R.REASONS.includes('TIPS OVER');
const HAS_PROPS = typeof R.props === 'function';   // revision 5e: props
const TOL = 2;                       // px: antialiasing past a box's edge

async function audit(page, size, name, expect) {
  const tag = `${size.name} ${name}`;
  // (the art builds its sprites a few a frame, drawing a scaled neighbour meanwhile, and pre-turns a tile that has kept
  // its angle for four frames: draw until the picture settles)
  for (let i = 0; i < 8; i++) await page.evaluate(() => CS.render());
  let ctl = { n: 1 };
  for (let i = 0; i < 12 && ctl.n; i++) {
    await page.evaluate(() => CS.render());
    await G.keepPixels(page, 'base');
    await page.evaluate(() => CS.render());
    ctl = await G.diffPixels(page, 'base', null, 0);
  }
  if (!T.check(ctl.n === 0, `${tag}: the same frame drawn twice is the same picture` + (ctl.n ? ` (${ctl.n} px differ in ${JSON.stringify(ctl.box)})` : ''))) return 0;
  const d = await G.display(page);
  // what §18.7 lists, for this scene
  const missing = (expect || []).filter(k => k === 'ghost.shine' ? !(d.ghost && d.ghost.shine && d.ghost.shine.length) : k.startsWith('ghost.') ? !(d.ghost && d.ghost[k.slice(6)]) : Array.isArray(d[k]) ? !d[k].length : !d[k]);
  T.check(!missing.length, `${tag}: the display list holds ${(expect || []).join(', ')}` + (missing.length ? ': missing ' + missing.join(', ') : ''));
  const boxes = new Map();
  for (const l of d.layers) {
    if (!l.box || l.layer === 'button') continue;
    const b = boxes.get(l.layer);
    boxes.set(l.layer, b ? { x0: Math.min(b.x0, l.box.x0), y0: Math.min(b.y0, l.box.y0), x1: Math.max(b.x1, l.box.x1), y1: Math.max(b.y1, l.box.y1) } : l.box);
  }
  const hint0 = d.hint && d.hint.box, bad = [], okL = [], off = [];
  for (const [layer, box] of [...boxes]) {
    // (a layer drawn wholly off the screen, such as the ghost far below a tall tower's top: nothing to see)
    if (box.x1 <= 0 || box.y1 <= 0 || box.x0 >= size.w || box.y0 >= size.h) { off.push(layer); boxes.delete(layer); continue; }
  }
  for (const [layer, box] of boxes) {
    if (layer === 'knock') {
      // a button over the canvas: its pixels in its box, from the screen
      const clip = { x: Math.max(0, Math.floor(box.x0)), y: Math.max(0, Math.floor(box.y0)), width: Math.ceil(box.x1 - box.x0), height: Math.ceil(box.y1 - box.y0) };
      const a = await page.screenshot({ clip });
      await page.evaluate(l => CS.hide(l), layer);
      const b = await page.screenshot({ clip }), gone = await page.evaluate(() => !CS.display().knock);
      await page.evaluate(l => CS.show(l), layer);
      if (a.equals(b) || !gone) bad.push(`hiding ${layer} leaves it on the screen`); else okL.push(layer);
      continue;
    }
    await page.evaluate(l => CS.hide(l), layer);
    const d2 = await G.display(page), hint1 = d2.hint && d2.hint.box;
    const allowed = [{ x0: box.x0 - TOL, y0: box.y0 - TOL, x1: box.x1 + TOL, y1: box.y1 + TOL }];
    if (layer !== 'hint' && hint0 && (!hint1 || hint1.x0 !== hint0.x0 || hint1.y0 !== hint0.y0)) { allowed.push(hint0); if (hint1) allowed.push(hint1); }
    const df = await G.diffOutside(page, 'base', allowed, 0);
    await page.evaluate(l => CS.show(l), layer);
    let back = await G.diffPixels(page, 'base', null, 0);
    for (let i = 0; i < 8 && back.n; i++) { await page.evaluate(() => CS.render()); back = await G.diffPixels(page, 'base', null, 0); }
    if (!df.n) bad.push(`hiding ${layer} changes nothing`);
    else if (df.out) bad.push(`hiding ${layer} changes ${df.out} px outside the box it claims (${fmt(box)}): in ${fmt(df.outBox)}`);
    else okL.push(layer);
    if (back.n) bad.push(`showing ${layer} again does not give back the picture (${back.n} px)`);
  }
  T.check(!bad.length && okL.length === boxes.size, `${tag}: hiding each of ${boxes.size} layers changes the pixels it claims and only those (${[...boxes.keys()].join(' ')}${off.length ? '; off the screen: ' + off.join(' ') : ''})` + (bad.length ? ': ' + bad.join('; ') : ''));
  return boxes.size;
}
const fmt = b => b ? `${Math.round(b.x0)},${Math.round(b.y0)}-${Math.round(b.x1)},${Math.round(b.y1)}` : '-';

(async () => {
  const browser = await G.launch();
  let total = 0;
  try {
    for (const size of G.sizesFrom()) {
      const ts = Date.now();
      const g = await G.open(browser, size, { quiz: JSON.stringify({ build: [], hand: '■0' }) });
      const { page } = g;
      const quiz = async (name, q, expect) => {
        await page.goto(G.gameUrl({ quiz: JSON.stringify(q), mute: 1 }), { waitUntil: 'load' });
        await page.waitForFunction(() => window.CS && CS.state().phase === 'play');
        total += await audit(page, size, name, expect);
      };
      const drive = async (params, storage) => {
        await page.evaluate(s => { localStorage.clear(); for (const k in s) localStorage.setItem(k, s[k]); }, storage || G.PLAYED);
        await page.goto(G.gameUrl(Object.assign({ drive: 1, autostart: 1, mute: 1 }, params)), { waitUntil: 'load' });
        await page.waitForFunction(() => window.CS && CS.state().phase === 'play');
        await G.wait(page, 0.6);
      };
      const ready = async () => { for (let i = 0; i < 80; i++) { const s = await G.state(page); if (s.phase === 'play' && s.handReady && !s.locked && !s.swapping) return; await G.wait(page, 0.05); } };
      const aim = async col => { const x = await page.evaluate(c => CS.colToX(c), col); await g.input.aim(x, size.h * 0.55); await G.frame(page); await G.step(page, 11); };
      const drop = async col => { await aim(col); await g.input.release(); await G.frame(page); };
      const base = ['tiles', 'car', 'hand', 'ghost', 'weight', 'next', 'counter'];
      await quiz('aim a square', { build: ['■-2', '■-2', '▲-1', '■1'], hand: '■0' }, base.concat(['markers', 'ticks', 'ghostWeight', 'ghost.shine', 'ghost.chip', 'ghost.column']));
      await quiz('aim a triangle', { build: ['■-2', '■1', '▲-1', '▲0'], hand: '▼-0.5' }, base.concat(['markers', 'ghost.shine']));
      await quiz('ONLY A POINT', { build: ['▲0', '■-2', '■1'], hand: '▲0' }, base.concat(['ghost.marks', 'ghost.reason']));
      if (HAS_TIPS) await quiz('TIPS OVER', { build: ['▲-1', '▼-0.5', '■-2'], hand: '■0' }, base.concat(['ghost.marks', 'ghost.reason']));
      if (HAS_PROPS) await quiz('a propped fit (golden 19)', { build: ['■0', '▲-2', '▼-1.5', '■-2', '■-1'], hand: '■-1' }, base.concat(['ghost.props', 'ghost.shine']));
      await quiz('open gaps, placed', { build: ['■-2', '▲-0.5', '▼-1', '▲-1.5', '■1'], hand: '■1' }, base.concat(['gaps']));
      await quiz('an open gap, aimed', { build: ['■-2', '▲-0.5', '▼-1'], hand: '▲-1.5' }, base.concat(['ghost.ghostGaps']));
      { const b = []; for (let r = 0; r < 28; r++) b.push('■-1', '■0'); await quiz('a tall tower', { build: b, hand: '■-2' }, base); }
      await quiz('BIG MAGNETS', { build: ['■-1', '■0', '▲-0.5'], hand: '▲0', big: true }, ['tiles', 'car', 'hand', 'ghost', 'weight', 'next', 'box', 'knock']);
      await quiz('THE TOPPER in the hand', { build: ['■-2', '■0', '■-2', '■0', '■-1'], hand: '▲-1', topper: true }, base);
      // tiles in the air: a fit falling, then one falling off (tipping about its point)
      await drive({ seed: 5, nohint: 1 });
      await ready();
      await page.evaluate(() => { CS.build(['▲0', '■-2', '■1']); CS.setPiece('sq'); });
      await drop(-4);
      await G.step(page, 8);
      total += await audit(page, size, 'a tile in the air', ['tiles', 'falling']);
      await ready();
      await page.evaluate(() => CS.setPiece('tri'));
      await drop(0);
      for (let i = 0; i < 60; i++) { const f = await page.evaluate(() => (CS.display().falling.find(x => x.outcome === 'off') || {}).stage); if (f === 'tip') break; await G.step(page, 2); }
      total += await audit(page, size, 'a tile falling off', ['falling']);
      // a propped fit lands (golden 19's last square): its double bar flashes
      if (HAS_PROPS) {
        await ready();
        await page.evaluate(() => { CS.clear(); CS.build(['■0', '▲-2', '▼-1.5', '■-2', '■-1']); CS.setPiece('sq'); CS.setBox(['sq', 'sq', 'tri', 'sq']); });
        await G.wait(page, 0.6);
        await ready();
        await drop(-2);
        const id = await page.evaluate(() => CS.lastRelease.id);
        for (let i = 0; i < 200 && !(await page.evaluate(id => CS.events.some(e => e.type === 'land' && e.id === id), id)); i++) await G.step(page, 1);
        await G.step(page, 12);
        total += await audit(page, size, 'a propped fit landing: its bar flashes', ['tiles', 'propFlash']);
      }
      // the dead-tile swap, halfway
      await page.evaluate(() => { CS.clear(); CS.build(['■-2', '■-1', '■0', '■1', '▲-2', '▲-1', '▲0', '▲1']); CS.setPiece('sq'); CS.setBox(['sq', 'sq', 'tri', 'sq', 'top']); });
      await G.wait(page, 0.3);
      await drop(0);
      for (let i = 0; i < 80 && !(await page.evaluate(() => CS.state().swapping)); i++) await G.step(page, 2);
      await G.step(page, 20);
      total += await audit(page, size, 'the dead-tile swap', ['swap', 'counter', 'next']);
      // a hint, then the fuse (a player who has played, but seen no hint)
      await drive({ seed: 6 }, { 'clackstack.prefs5': JSON.stringify({ played: true }) });
      await ready();
      await aim(0);
      total += await audit(page, size, 'the first hint', ['car', 'hand', 'ghost', 'weight', 'next', 'counter', 'hint']);
      await drop(-2);
      await G.wait(page, 0.6);
      await ready();
      await aim(0);
      await G.wait(page, 0.4);
      total += await audit(page, size, 'the fuse and a hint', base.concat(['fuse']));
      // a crash (a swaying spire, one more on top), then its card
      await drive({ seed: 7, nohint: 1 });
      await ready();
      await page.evaluate(() => { CS.build(['■1', '■1', '■1', '■1', '■1', '■1', '■1', '■1', '■1', '■1']); CS.setPiece('sq'); WOB.W = 0.6; WOB.dir = 1; });
      await drop(2);
      for (let i = 0; i < 200 && (await G.state(page)).phase === 'play'; i++) await G.step(page, 3);
      await G.step(page, 6);
      total += await audit(page, size, 'a crash', ['tiles', 'weight']);
      for (let i = 0; i < 400 && !(await page.evaluate(() => CS.state().over && CS.state().over.open)); i++) await G.step(page, 6);
      await G.wait(page, 1.2);
      total += await audit(page, size, 'the results card', ['results']);
      T.check(g.errors.length === 0, `${size.name}: no console errors` + (g.errors.length ? ': ' + g.errors.slice(0, 3).join(' / ') : ''));
      await g.context.close();
      T.info(`${size.name}: ${((Date.now() - ts) / 1000).toFixed(1)} s`);
    }
  } finally { await browser.close(); }
  T.info(`${total} layers audited`);
  T.done();
})().catch(e => { console.error(e); process.exitCode = 1; });
