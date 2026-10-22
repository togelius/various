#!/usr/bin/env node
'use strict';
// Feel and flow (DESIGN 17.6), all through real input: the title, a run, the crash, the results card and AGAIN, by
// mouse, by touch and by keys; the hand snaps to half-tile columns; the ghost is the landing for hundreds of real
// drops (tiles in the air included); the fuse lets go on its own; each first-time hint shows once (and not again after a
// reload); pause; BIG MAGNETS has no fuse and keeps going after a crash. No console errors anywhere.
//   node clack-stack/tools/feel.cjs
const { launch, gamePage, until, gameWait, ready, touch, sleep } = require('./lib.cjs');

let bad = 0;
const check = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) bad++; return cond; };
const W = 390, H = 844, Y = H * 0.5;
async function click(page, x, y) { await page.mouse.move(x, y || Y); await page.mouse.down(); await page.mouse.up(); }
const st = page => page.evaluate(() => CS.state());

// a real drop at column k, checked: the ghost under the hand just before the press is what was let go and what landed
async function dropAt(page, k, how, T) {
  const x = await page.evaluate(k => CS.kToX(k), k);
  if (how === 'touch') { await T.down(x, Y); await T.move(x + 3, Y); } else await page.mouse.move(x + 3, Y);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
  const g = await page.evaluate(() => { const g = CS.ghost(); return g && { key: g.key, k: g.k }; });
  const id = await page.evaluate(() => CS.lastRelease ? CS.lastRelease.id : 0);
  if (how === 'touch') await T.up(); else { await page.mouse.down(); await page.mouse.up(); }
  await until(page, i => (CS.lastRelease && CS.lastRelease.id > i) || CS.state().phase !== 'play', id, 5000).catch(() => {});
  const rel = await page.evaluate(() => CS.lastRelease);
  return { g, rel };
}

(async () => {
  const browser = await launch();
  try {
    // ---- mouse: title -> run -> many drops (ghost = landing) -> crash -> results -> AGAIN
    {
      console.log('mouse');
      const { context, page, errors } = await gamePage(browser, { width: W, height: H }, { seed: 4, ts: 2, mute: 1, nohint: 1 });
      await click(page, W / 2);
      const t0 = Date.now();
      await until(page, () => CS.state().phase === 'play' && CS.state().handReady);
      check(Date.now() - t0 < 2500, 'a click on the title starts the run (play, a tile in the hand) in ' + (Date.now() - t0) + ' ms');
      // the hand snaps to the column under the pointer
      let snapOk = true;
      for (const k of [-3, -2, -1, 0, 1, 2, 3]) {
        const x = await page.evaluate(k => CS.kToX(k), k);
        for (const dx of [-0.2, 0.2]) {
          const L = (await page.evaluate(() => CS.cam().L));
          await page.mouse.move(x + dx * L, Y);
          const s = await st(page);
          if (s.k !== k) snapOk = false;
        }
      }
      check(snapOk, 'the hand snaps to the half-tile column under the pointer');
      // real drops all over the base, some in quick succession (two tiles in the air): the ghost is the landing
      let same = 0, n = 0, air2 = 0, guard = 0;
      const lets = [];
      const rnd = (() => { let a = 99; return () => ((a = (a * 1103515245 + 12345) >>> 0) / 4294967296); })();
      while (n < 200 && guard++ < 2000) {
        const s = await st(page);
        if (s.phase === 'over') {
          await until(page, () => CS.state().over.open, null, 10000);
          const ui = await page.evaluate(() => CS.ui());
          await click(page, ui.again.x + ui.again.w / 2, ui.again.y + ui.again.h / 2);
          await until(page, () => CS.state().phase === 'play', null, 3000);
          continue;
        }
        if (s.phase !== 'play' || !s.handReady || s.locked) { await sleep(5); continue; }
        // mostly over the base, now and then off it (the rug)
        const k = Math.round((rnd() * 2 - 1) * (rnd() < 0.1 ? 6 : 3));
        const { g, rel } = await dropAt(page, k, 'mouse');
        if (!g || !rel || rel.t === undefined) continue;
        n++; if (rel.key === g.key) same++;
        if (rel.inAir >= 2) air2++;
        if (!rel.rug) lets.push({ id: rel.id, key: g.key });
        // sometimes the next drop goes before this one has landed
        if (rnd() < 0.4) continue;
        await gameWait(page, 0.1 + rnd() * 0.5);
      }
      await gameWait(page, 0.6);
      const landed = await page.evaluate(lets => lets.map(l => { const e = CS.events.find(q => q.type === 'land' && q.id === l.id); return e ? (e.key === l.key ? 1 : 0) : -1; }), lets);
      const lOk = landed.filter(v => v === 1).length, lN = landed.filter(v => v >= 0).length;
      check(n >= 150 && same === n && air2 > 10, `the ghost under the hand is what each press let go: ${same}/${n} (${air2} with two tiles in the air)`);
      check(lN > 80 && lOk === lN, `and where it landed: ${lOk}/${lN} (the rest were lost in a crash)`);
      // the clack: a drop lands within 0.18-0.45 s
      const lag = await page.evaluate(() => { const ev = CS.events, r = []; for (const e of ev) if (e.type === 'land') { const rl = ev.find(q => q.type === 'release' && q.id === e.id); if (rl) r.push(e.t - rl.t); } return [Math.min(...r), Math.max(...r)]; });
      check(lag[0] >= 0.18 && lag[1] <= 0.6, `release to CLACK ${lag[0].toFixed(2)}-${lag[1].toFixed(2)} s`);
      // pause and resume (P, Escape): game time stands still
      await until(page, () => CS.state().phase === 'play' || CS.state().phase === 'over', null, 10000);
      await page.keyboard.press('p');
      const tp = (await st(page)).t; await sleep(300);
      check((await st(page)).phase === 'paused' && (await st(page)).t === tp, 'P pauses (game time stands still)');
      await page.keyboard.press('Escape');
      check((await st(page)).phase !== 'paused', 'Escape resumes');
      check(errors.length === 0, 'no console errors (mouse)' + (errors.length ? ': ' + errors.join(' / ') : ''));
      await context.close();
    }
    // ---- touch: a finger down moves the hand and only lifting lets go; a cancel never drops; crash; AGAIN by touch
    {
      console.log('touch');
      const { context, page, errors } = await gamePage(browser, { width: W, height: H }, { seed: 5, ts: 2, mute: 1, nohint: 1 }, { touch: true });
      const T = await touch(page);
      await T.tap(W / 2, Y);
      await ready(page);
      const x2 = await page.evaluate(() => CS.kToX(2));
      await T.down(x2, Y);
      await gameWait(page, 0.4);
      let s = await st(page);
      check(s.k === 2 && s.landed === 0 && (await page.evaluate(() => !CS.lastRelease)), 'a finger down moves the hand there and holds the tile');
      const x0 = await page.evaluate(() => CS.kToX(-1));
      await T.move(x0, Y); await gameWait(page, 0.1);
      check((await st(page)).k === -1, 'it follows the finger');
      await T.up();
      await until(page, () => !!CS.lastRelease);
      check((await page.evaluate(() => CS.lastRelease.k)) === -1, 'lifting the finger lets go there');
      await ready(page);
      const client = await page.context().newCDPSession(page);
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x2, y: Y, id: 1 }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await gameWait(page, 0.3);
      check((await page.evaluate(() => CS.lastRelease.id)) === 1, 'a cancelled touch never drops');
      // a leaning stack until it falls (tiles out at the right)
      let guard = 0;
      while ((await st(page)).phase === 'play' && guard++ < 40) {
        await ready(page).catch(() => {});
        if ((await st(page)).phase !== 'play') break;
        const { g, rel } = await dropAt(page, 4, 'touch', T);
        if (g && rel && rel.key !== g.key) { bad++; console.log('  FAIL touch: ghost ' + g.key + ' but let go ' + rel.key); }
        await gameWait(page, 0.25);
      }
      await until(page, () => CS.state().phase === 'over' && CS.state().over.open, null, 15000);
      s = await st(page);
      check(s.over && s.over.final.cm > 0, 'the tower fell over a wheel: the results card (' + (s.over && s.over.final.cm) + ' cm)');
      const cr = await page.evaluate(() => CS.events.filter(e => e.type === 'crash'));
      check(cr.length === 1 && cr[0].past, 'the crash happened with the weight past a wheel (' + (cr[0] && cr[0].weight) + ' vs ' + (cr[0] && cr[0].wheel) + ')');
      const ui = await page.evaluate(() => CS.ui());
      await T.tap(ui.again.x + ui.again.w / 2, ui.again.y + ui.again.h / 2);
      await until(page, () => CS.state().phase === 'play', null, 3000).catch(() => {});
      s = await st(page);
      check(s.phase === 'play' && s.best === 0, 'AGAIN in one tap: a new run');
      check(errors.length === 0, 'no console errors (touch)' + (errors.length ? ': ' + errors.join(' / ') : ''));
      await context.close();
    }
    // ---- keys: Space starts, arrows step the hand one column, Space drops; the fuse; crash; Enter = AGAIN
    {
      console.log('keys');
      const { context, page, errors } = await gamePage(browser, { width: W, height: H }, { seed: 6, ts: 1, mute: 1, nohint: 1 });
      await page.keyboard.press('Space');
      await ready(page);
      const k0 = (await st(page)).k;
      await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
      check((await st(page)).k === k0 + 2, 'each arrow press steps the hand one half-tile column');
      await page.keyboard.press('ArrowLeft');
      const g = await page.evaluate(() => CS.ghost().key);
      await page.keyboard.press('Space');
      await until(page, () => !!CS.lastRelease);
      check((await page.evaluate(() => CS.lastRelease.key)) === g, 'Space lets go where the ghost showed');
      // the fuse: no input, and the hand lets go on its own when the ring runs out (FUSE_MAX on a low tower)
      await ready(page);
      const s0 = await st(page);
      await until(page, () => CS.events.some(e => e.type === 'fuse'), null, 8000).catch(() => {});
      const fz = await page.evaluate(() => { const f = CS.events.find(e => e.type === 'fuse'); const r = CS.events.find(e => e.type === 'release' && e.src === 'fuse'); return f && r && { fuse: f.fuse, at: r.t }; });
      check(!!fz && Math.abs(fz.at - s0.readyAt - fz.fuse) < 0.05 && fz.fuse > 2.5, 'the fuse lets go on its own after ' + (fz ? (fz.at - s0.readyAt).toFixed(2) : '?') + ' s (ring ' + (fz ? fz.fuse.toFixed(2) : '?') + ' s on a low tower)');
      const fr = await page.evaluate(() => { const top = 15; return [fuseFor(0), fuseFor(top), fuseFor(40)]; });
      check(Math.abs(fr[0] - 3) < 1e-9 && Math.abs(fr[1] - 1.2) < 1e-9 && fr[2] === 1.2, 'the ring is 3 s on a bare base and 1.2 s from 15 L (112 cm, YOU) up');
      // to the right edge and drop until it falls; Enter is AGAIN
      for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight');
      let guard = 0;
      while ((await st(page)).phase === 'play' && guard++ < 40) { await ready(page).catch(() => {}); for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowLeft'); for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight'); await page.keyboard.press('Space'); await gameWait(page, 0.3); }
      await until(page, () => CS.state().phase === 'over' && CS.state().over.open, null, 15000).catch(() => {});
      check((await st(page)).phase === 'over', 'by keys: a crash and the results card');
      await page.keyboard.press('Enter');
      await until(page, () => CS.state().phase === 'play', null, 3000).catch(() => {});
      check((await st(page)).phase === 'play', 'Enter: AGAIN');
      check(errors.length === 0, 'no console errors (keys)' + (errors.length ? ': ' + errors.join(' / ') : ''));
      await context.close();
    }
    // ---- the first-time hints: each once, saved; none after a reload
    {
      console.log('hints');
      const { context, page, errors } = await gamePage(browser, { width: W, height: H }, { seed: 8, mute: 1 });
      await click(page, W / 2);
      await ready(page);
      await gameWait(page, 0.3);
      const h1 = await page.evaluate(() => CS.tipBox());
      check(!!h1 && h1.text === 'Let go: the tile falls straight down.', 'first drop: "' + (h1 && h1.text) + '"');
      // the hint keeps clear of the ghost, its column, the weight and the hand
      const clear = await page.evaluate(() => {
        const t = CS.tipBox().box, gd = CS.guide(), w = CS.weightBox(), hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
        return !(gd && (hit(t, { x0: gd.x0, y0: gd.y0, x1: gd.x1, y1: gd.y1 }) || hit(t, { x0: gd.gx0, y0: gd.gy0, x1: gd.gx1, y1: gd.gy1 }))) && !(w && hit(t, w));
      });
      check(clear, 'the hint is clear of the ghost, its column and the weight');
      await click(page, await page.evaluate(() => CS.kToX(1)));
      await until(page, () => CS.state().hintNow === 'weight', null, 8000).catch(() => {});
      check((await st(page)).hintNow === 'weight', 'after the first landing: "Keep the weight between the wheels!"');
      // a notch for a triangle: two point-up triangles side by side, a triangle in the hand
      await gameWait(page, 4.6);
      await page.evaluate(() => { CS.build([['tri', -1], ['tri', -3]]); CS.setPiece('tri'); });
      await until(page, () => CS.state().hintNow === 'brace', null, 8000).catch(() => {});
      check((await st(page)).hintNow === 'brace', 'a triangle in the hand with a notch open: "Fill a notch with a triangle to brace."');
      const prefs = await page.evaluate(() => localStorage.getItem('clackstack.prefs4'));
      await context.close();
      const p2 = await gamePage(browser, { width: W, height: H }, { seed: 8, mute: 1 }, { storage: { 'clackstack.prefs4': prefs } });
      await click(p2.page, W / 2);
      await ready(p2.page);
      let seen = false;
      for (let i = 0; i < 3; i++) {
        await gameWait(p2.page, 0.6);
        if (await p2.page.evaluate(() => !!CS.tipBox())) seen = true;
        await click(p2.page, await p2.page.evaluate(() => CS.kToX(1)));
        await ready(p2.page).catch(() => {});
      }
      check(!seen, 'after a reload no hint shows again');
      check(errors.length === 0 && p2.errors.length === 0, 'no console errors (hints)');
      await p2.context.close();
    }
    // ---- BIG MAGNETS: no fuse; a crash rolls in a new car and the run goes on (the best height counts)
    {
      console.log('BIG MAGNETS');
      const { context, page, errors } = await gamePage(browser, { width: W, height: H }, { seed: 9, ts: 2, mute: 1, nohint: 1, big: 1 });
      await click(page, W / 2);
      await ready(page);
      await click(page, await page.evaluate(() => CS.kToX(1)));
      await ready(page);
      const n0 = await page.evaluate(() => CS.lastRelease.id);
      await gameWait(page, 5);
      check((await page.evaluate(() => CS.lastRelease.id)) === n0 && !(await st(page)).fuse.on, 'no fuse: the hand waits');
      let guard = 0;
      while ((await st(page)).crashes === 0 && guard++ < 60) { await ready(page).catch(() => {}); const k = Math.min(3 + guard, (await st(page)).kMax); await click(page, await page.evaluate(k => CS.kToX(k), k)); await gameWait(page, 0.3); }
      const best = (await st(page)).best;
      check((await st(page)).crashes === 1, 'a staircase out over the edge falls');
      await until(page, () => CS.state().phase === 'play' && CS.state().handReady && !CS.state().locked, null, 10000).catch(() => {});
      const s = await st(page);
      check(s.phase === 'play' && !s.over && s.tiles === 0 && s.best === best && best > 0, 'a new car rolls in and the run goes on (best ' + (s.best * 7.5).toFixed(0) + ' cm kept)');
      check(errors.length === 0, 'no console errors (BIG MAGNETS)' + (errors.length ? ': ' + errors.join(' / ') : ''));
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(bad ? `feel: ${bad} FAILED` : 'feel: all passed');
  process.exitCode = bad ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
