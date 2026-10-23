#!/usr/bin/env node
'use strict';
// Feel and flow (DESIGN 18.3-18.7, 18.8 G3), through real input wherever a player has it: the title, a run, its end
// (a crash, TOPPED OUT!, THE BOX IS EMPTY!), the results card and AGAIN, by mouse, by touch and by keys; the hand on
// whole tiles for a square and half tiles for a triangle, over the car only; a triangle turning itself; the ghost is
// what each press lets go and where it lands (tiles in the air included) and a tile that falls off never enters the
// tower; the box (60, the counter, NEXT, a first run's five squares and its late fuse); the dead-tile swap; the fuse; the
// hints of §18.4, once each; pause; BIG MAGNETS (no fuse, the pull, KNOCK IT DOWN, a new car after a crash); the hooks
// (?drive, ?quiz, CS.display, ?seed, ?big, ?mute, ?nohint, ?ts); the other two screen sizes. No console errors anywhere.
// (Scenes the box would take minutes to reach are set up with CS.build / CS.setPiece / CS.setBox; the input is real.)
//   node clack-stack/tools/feel.cjs
const { launch, gamePage, until, gameWait, ready, touch, sleep } = require('./lib.cjs');

let bad = 0;
const check = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) bad++; return cond; };
const W = 390, H = 844, Y = H * 0.5;
const PLAYED = { 'clackstack.prefs5': JSON.stringify({ played: true }) };
async function click(page, x, y) { await page.mouse.move(x, y || Y); await page.mouse.down(); await page.mouse.up(); }
const st = page => page.evaluate(() => CS.state());
const raf = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
const lastId = page => page.evaluate(() => CS.lastRelease ? CS.lastRelease.id : 0);
async function released(page, id) { await until(page, i => (CS.lastRelease && CS.lastRelease.id > i) || CS.state().phase !== 'play', id, 5000).catch(() => {}); return page.evaluate(() => CS.lastRelease); }

// a real drop at column col: the ghost under the hand just before the press against what was let go
async function dropAt(page, col, how, T) {
  const x = await page.evaluate(c => CS.colToX(c), col);
  if (how === 'touch') { await T.down(x, Y); await T.move(x + 2, Y); } else await page.mouse.move(x + 2, Y);
  await raf(page);
  const g = await page.evaluate(() => { const g = CS.ghost(); return g && { key: g.key, outcome: g.outcome, col: g.col, handCol: g.handCol }; });
  const id = await lastId(page);
  if (how === 'touch') await T.up(); else { await page.mouse.down(); await page.mouse.up(); }
  const rel = await released(page, id);
  return { g, rel: rel && rel.id > id ? rel : null };
}
// a tower that will go over: a thin spire at the right end, swaying hard
async function spire(page) { await page.evaluate(() => { CS.clear(); CS.build(['■1', '■1', '■1', '■1', '■1', '■1', '■1', '■1', '■1', '■1']); CS.setPiece('sq'); WOB.W = 0.7; WOB.dir = 1; }); }

(async () => {
  const browser = await launch();
  try {
    // ---- mouse: title -> run -> many real drops (ghost = release = landing; offs stay out) -> crash -> AGAIN
    {
      console.log('mouse');
      const { context, page, errors } = await gamePage(browser, { width: W, height: H }, { seed: 4, ts: 2, mute: 1, nohint: 1 }, { storage: PLAYED });
      await click(page, W / 2);
      const t0 = Date.now();
      await ready(page);
      check(Date.now() - t0 < 2500, 'a click on the title starts the run (play, a tile in the hand) in ' + (Date.now() - t0) + ' ms');
      // the hand: whole tiles for a square, half tiles for a triangle, never past the car
      const snap = await (async () => {
        const res = { sq: [], tri: [] };
        for (const sh of ['sq', 'tri']) {
          await page.evaluate(s => CS.setPiece(s), sh);
          for (const fx of [0.02, 0.2, 0.35, 0.5, 0.65, 0.8, 0.98]) { await page.mouse.move(W * fx, Y); res[sh].push((await st(page)).col); }
        }
        return res;
      })();
      check(snap.sq.every(c => c % 2 === 0 && c >= -4 && c <= 2) && snap.sq[0] === -4 && snap.sq[6] === 2, 'a square\'s hand moves in whole tiles over the car: ' + snap.sq.join(' '));
      check(snap.tri.every(c => c >= -5 && c <= 3) && snap.tri[0] === -5 && snap.tri[6] === 3 && snap.tri.some(c => c % 2 !== 0), 'a triangle\'s in half tiles, half a tile past the car at most: ' + snap.tri.join(' '));
      // real drops all over the car, some in quick succession (two tiles in the air)
      let same = 0, n = 0, air2 = 0, offs = 0, guard = 0;
      const lets = [], offIds = [];
      const rnd = (() => { let a = 99; return () => ((a = (a * 1103515245 + 12345) >>> 0) / 4294967296); })();
      while (n < 160 && guard++ < 2500) {
        const s = await st(page);
        if (s.phase === 'over') {
          await until(page, () => CS.state().over.open, null, 10000);
          const ui = await page.evaluate(() => CS.ui());
          await click(page, ui.again.x + ui.again.w / 2, ui.again.y + ui.again.h / 2);
          await until(page, () => CS.state().phase === 'play', null, 3000);
          continue;
        }
        if (s.phase !== 'play' || !s.handReady || s.locked) { await sleep(5); continue; }
        const [lo, hi] = s.colRange, step = s.piece === 'sq' ? 2 : 1, col = lo + step * Math.floor(rnd() * ((hi - lo) / step + 1));
        const { g, rel } = await dropAt(page, col, 'mouse');
        if (!g || !rel) continue;
        n++; if (rel.key === g.key) same++;
        if (rel.inAir >= 2) air2++;
        if (g.outcome === 'fit') lets.push({ id: rel.id, key: g.key }); else { offs++; offIds.push(rel.id); }
        if (rnd() < 0.4) continue;
        await gameWait(page, 0.1 + rnd() * 0.5);
      }
      await gameWait(page, 1.2);
      const landed = await page.evaluate(lets => lets.map(l => { const e = CS.events.find(q => q.type === 'land' && q.id === l.id); return e ? (e.key === l.key ? 1 : 0) : -1; }), lets);
      const lOk = landed.filter(v => v === 1).length, lN = landed.filter(v => v >= 0).length;
      check(n >= 140 && same === n && air2 >= 1, `the ghost under the hand is what each press let go: ${same}/${n} (${air2} with two tiles in the air)`);
      check(lN > 60 && lOk === lN, `and where it landed: ${lOk}/${lN} (the rest were lost in a crash or the run ended)`);
      const offOk = await page.evaluate(ids => ids.every(id => !CS.events.some(e => e.type === 'land' && e.id === id)) && ids.filter(id => CS.events.some(e => e.type === 'off' && e.id === id)).length, offIds);
      check(offs > 5 && offOk >= offs * 0.7, `a tile that falls off (${offs}) never lands in the tower; ${offOk} were seen to touch and fall (the rest went with a crash)`);
      const lag = await page.evaluate(() => { const ev = CS.events, r = []; for (const e of ev) if (e.type === 'land') { const rl = ev.find(q => q.type === 'release' && q.id === e.id); if (rl) r.push(e.t - rl.t); } return [Math.min(...r), Math.max(...r)]; });
      check(lag[0] >= 0.18 && lag[1] <= 0.6, `release to CLACK ${lag[0].toFixed(2)}-${lag[1].toFixed(2)} s`);
      // no grade words: the landings say DOUBLE / TRIPLE CLACK! at most
      const words = await page.evaluate(() => CS.events.length && CS.words().map(w => w.text));
      check(!(words || []).some(w => /PERFECT|GREAT|TRUSS/.test(w)), 'no grade words');
      // pause and resume (P, Escape): game time stands still
      await until(page, () => CS.state().phase === 'play' || CS.state().phase === 'over', null, 10000);
      if ((await st(page)).phase === 'play') {
        await page.keyboard.press('p');
        const tp = (await st(page)).t; await sleep(300);
        check((await st(page)).phase === 'paused' && (await st(page)).t === tp, 'P pauses (game time stands still)');
        await page.keyboard.press('Escape');
        check((await st(page)).phase !== 'paused', 'Escape resumes');
      }
      check(errors.length === 0, 'no console errors (mouse)' + (errors.length ? ': ' + errors.join(' / ') : ''));
      await context.close();
    }
    // ---- touch: a finger down moves the hand and only lifting lets go; a cancel never drops; crash; AGAIN by touch
    {
      console.log('touch');
      const { context, page, errors } = await gamePage(browser, { width: W, height: H }, { seed: 5, ts: 2, mute: 1, nohint: 1 }, { touch: true, storage: PLAYED });
      const T = await touch(page);
      await T.tap(W / 2, Y);
      await ready(page);
      await page.evaluate(() => CS.setPiece('sq'));
      const x2 = await page.evaluate(() => CS.colToX(2));
      await T.down(x2, Y);
      await gameWait(page, 0.4);
      let s = await st(page);
      check(s.col === 2 && s.landed === 0 && (await page.evaluate(() => !CS.lastRelease)), 'a finger down moves the hand there and holds the tile');
      const x0 = await page.evaluate(() => CS.colToX(-2));
      await T.move(x0, Y); await gameWait(page, 0.1);
      check((await st(page)).col === -2, 'it follows the finger');
      await T.up();
      await until(page, () => !!CS.lastRelease);
      check((await page.evaluate(() => CS.lastRelease.col)) === -2, 'lifting the finger lets go there');
      await ready(page);
      const client = await page.context().newCDPSession(page);
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x2, y: Y, id: 1 }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await gameWait(page, 0.3);
      check((await page.evaluate(() => CS.lastRelease.id)) === 1, 'a cancelled touch never drops');
      // a thin spire swaying hard: one more on top and the weight goes past the wheel
      await spire(page);
      await ready(page);
      const d = await dropAt(page, 2, 'touch', T);
      check(!d.rel || (d.g && d.rel.key === d.g.key), 'the drop on the spire (if it came before the fall) is its ghost');
      await until(page, () => CS.state().phase === 'over' && CS.state().over.open, null, 15000).catch(() => {});
      s = await st(page);
      check(s.over && s.over.final.end === 'crash' && /PAST THE (LEFT|RIGHT) WHEEL/.test(s.over.final.why), 'it fell: the results card says which wheel (' + (s.over && s.over.final.why) + (s.over && s.over.final.why2 ? ' / ' + s.over.final.why2 : '') + ')');
      check(s.over && s.over.final.why2 === 'IT WAS STILL SWAYING', 'and that it was still swaying');
      const cr = await page.evaluate(() => CS.events.filter(e => e.type === 'crash'));
      check(cr.length === 1 && cr[0].past, 'the crash happened with the weight past a wheel (' + (cr[0] && cr[0].weight) + ' vs ' + (cr[0] && cr[0].wheel) + ')');
      const ui = await page.evaluate(() => CS.ui());
      await T.tap(ui.again.x + ui.again.w / 2, ui.again.y + ui.again.h / 2);
      await until(page, () => CS.state().phase === 'play', null, 3000).catch(() => {});
      s = await st(page);
      check(s.phase === 'play' && s.best === 0 && s.box.left === 59, 'AGAIN in one tap: a new run with a new box');
      check(errors.length === 0, 'no console errors (touch)' + (errors.length ? ': ' + errors.join(' / ') : ''));
      await context.close();
    }
    // ---- keys: Space starts, arrows step the hand one column, Space drops; the fuse; crash; Enter = AGAIN
    {
      console.log('keys');
      const { context, page, errors } = await gamePage(browser, { width: W, height: H }, { seed: 6, ts: 1, mute: 1, nohint: 1 }, { storage: PLAYED });
      await page.keyboard.press('Space');
      await ready(page);
      await page.evaluate(() => CS.setPiece('sq'));
      const c0 = (await st(page)).col;
      await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
      check((await st(page)).col === Math.max(-4, c0 - 4), 'with a square each arrow press steps the hand one whole tile (' + c0 + ' -> ' + (await st(page)).col + ')');
      await page.evaluate(() => CS.setPiece('tri'));
      const c1 = (await st(page)).col;
      await page.keyboard.press('ArrowRight');
      check((await st(page)).col === c1 + 1, 'with a triangle, half a tile');
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
      const fr = await page.evaluate(() => [fuseFor(0), fuseFor(15), fuseFor(40)]);
      check(Math.abs(fr[0] - 3) < 1e-9 && Math.abs(fr[1] - 1.2) < 1e-9 && fr[2] === 1.2, 'the ring is 3 s on a bare base and 1.2 s from 15 L (112 cm, YOU) up');
      // a swaying spire; Space drops on it; it falls; Enter is AGAIN
      await ready(page);
      await spire(page);
      for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Space');
      await until(page, () => CS.state().phase === 'over' && CS.state().over.open, null, 15000).catch(() => {});
      check((await st(page)).phase === 'over', 'by keys: a crash and the results card');
      await page.keyboard.press('Enter');
      await until(page, () => CS.state().phase === 'play', null, 3000).catch(() => {});
      check((await st(page)).phase === 'play', 'Enter: AGAIN');
      check(errors.length === 0, 'no console errors (keys)' + (errors.length ? ': ' + errors.join(' / ') : ''));
      await context.close();
    }
    // ---- the box: 60 tiles, its counter and NEXT; a first run's five squares and late fuse; THE TOPPER; the empty box
    {
      console.log('the box');
      const { context, page, errors } = await gamePage(browser, { width: W, height: H }, { seed: 11, ts: 2, mute: 1, nohint: 1 });
      await click(page, W / 2);
      await ready(page);
      let s = await st(page);
      const box = await page.evaluate(() => [CS.state().piece].concat(CS.boxList()));
      const nsq = box.filter(b => b === 'sq').length, ntri = box.filter(b => b === 'tri').length;
      let run = 0, maxRun = 0; for (const b of box) { run = b === 'sq' ? 0 : run + 1; maxRun = Math.max(maxRun, run); }
      check(box.length === 60 && nsq === 42 && ntri === 17 && box[59] === 'top' && maxRun <= 2, `a box of 60: ${nsq} ■, ${ntri} ▲ and THE TOPPER last, never more than two ▲ in a row (${maxRun})`);
      check(s.firstRun && box.slice(0, 5).every(b => b === 'sq'), 'a first run ever starts with five squares');
      let dcount = await page.evaluate(() => CS.display().counter);
      check(!!dcount && dcount.sq === 41 && dcount.tri === 17 && dcount.topper && /■ 41/.test(dcount.text) && /TOPPER/.test(dcount.text), 'the box\'s counter on the rug: "' + (dcount && dcount.text) + '"');
      // five drops in the middle: the fuse waits for the fifth landing on a first run
      for (let i = 0; i < 5; i++) {
        await ready(page);
        const s1 = await st(page);
        if (i === 2) { await gameWait(page, 3.6); check(!(await st(page)).fuse.on && (await page.evaluate(() => !CS.events.some(e => e.type === 'fuse'))), 'on a first run the fuse waits (3.6 s and no fuse after 2 landings)'); }
        await dropAt(page, s1.piece === 'sq' ? (i % 2 ? -2 : 0) : -1, 'mouse');
        await gameWait(page, 0.4);
      }
      await ready(page);
      s = await st(page);
      check(s.fuse.on && s.landed === 5, 'and runs from the fifth landing (' + s.landed + ' landed)');
      dcount = await page.evaluate(() => CS.display());
      check(dcount.counter.sq + dcount.counter.tri === 53 && dcount.counter.left === 54 && dcount.next && dcount.next.piece === (await page.evaluate(() => CS.boxList()[0])), 'the counter counts down (' + dcount.counter.text + ') and NEXT shows the next tile');
      // THE TOPPER on the very top: TOPPED OUT!
      await page.evaluate(() => { CS.clear(); CS.build(['■-2', '■-2']); CS.setPiece('tri', true); CS.setBox([]); });
      await ready(page);
      const ghost = await page.evaluate(() => { let best = null; for (const d of CS.drops(false)) if (d.outcome === 'fit' && (!best || d.top > best.top)) best = d; return best; });
      await dropAt(page, ghost.col, 'mouse');
      await until(page, () => CS.state().phase === 'over' && CS.state().over.open, null, 10000).catch(() => {});
      s = await st(page);
      check(s.over && s.over.final.end === 'topped' && s.over.final.why === 'TOPPED OUT!' && (await page.evaluate(() => CS.events.some(e => e.type === 'topped'))), 'THE TOPPER on the very top: TOPPED OUT! (' + (s.over && s.over.final.why) + ')');
      check(s.over && s.over.final.cm === Math.round(s.best * 7.5) && s.best > 2.8, 'its point counts in the height (' + (s.over && s.over.final.cm) + ' cm)');
      // AGAIN, then the last tile lands below the top: THE BOX IS EMPTY!
      await page.keyboard.press('Enter');
      await ready(page);
      await page.evaluate(() => { CS.clear(); CS.build(['■-2', '■-2', '■-2']); CS.setPiece('sq'); CS.setBox([]); });
      await dropAt(page, 2, 'mouse');
      await until(page, () => CS.state().phase === 'over' && CS.state().over.open, null, 10000).catch(() => {});
      s = await st(page);
      check(s.over && s.over.final.end === 'empty' && s.over.final.why === 'THE BOX IS EMPTY!', 'the last tile lands lower: THE BOX IS EMPTY! (' + (s.over && s.over.final.why) + ')');
      check(errors.length === 0, 'no console errors (box)' + (errors.length ? ': ' + errors.join(' / ') : ''));
      await context.close();
    }
    // ---- no dead tiles; triangles turn themselves; falling off; the hints of §18.4 (each once, saved)
    {
      console.log('dead tiles, turning, falling off, hints');
      const { context, page, errors } = await gamePage(browser, { width: W, height: H }, { seed: 8, mute: 1 });
      await click(page, W / 2);
      await ready(page);
      await gameWait(page, 0.3);
      const h1 = await page.evaluate(() => CS.tipBox());
      check(!!h1 && h1.text === 'Let go: it falls straight down.', 'the first tile: "' + (h1 && h1.text) + '"');
      const clear = await page.evaluate(() => {
        const t = CS.tipBox().box, gd = CS.guide(), w = CS.weightBox(), hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
        return !(gd && (hit(t, { x0: gd.x0, y0: gd.y0, x1: gd.x1, y1: gd.y1 }) || hit(t, { x0: gd.gx0, y0: gd.gy0, x1: gd.gx1, y1: gd.gy1 }))) && !(w && hit(t, w));
      });
      check(clear, 'the hint is clear of the ghost, its column and the weight');
      await dropAt(page, 0, 'mouse');
      await until(page, () => CS.state().hintNow === 'weight', null, 8000).catch(() => {});
      check((await st(page)).hintNow === 'weight', 'after the first landing: "Keep the weight between the wheels!"');
      await gameWait(page, 4.6);
      // the first triangle
      await page.evaluate(() => CS.setPiece('tri'));
      await until(page, () => CS.state().hintNow === 'tri', null, 6000).catch(() => {});
      check((await page.evaluate(() => CS.tipBox() && CS.tipBox().text)) === "Triangles sit flat, or hang on a triangle's side.", 'the first triangle: "Triangles sit flat, or hang on a triangle\'s side."');
      await gameWait(page, 4.6);
      // a triangle turns itself to the way that fits at the hand's column, in TURN_T, no FLIP
      await page.evaluate(() => { CS.clear(); CS.build(['▲-1', '▲0.5']); CS.setPiece('tri'); });
      await ready(page);
      const xu = await page.evaluate(() => CS.colToX(-2)), xd = await page.evaluate(() => CS.colToX(-1));
      await page.mouse.move(xu, Y); await raf(page);
      const wayU = (await st(page)).way;
      await page.mouse.move(xd, Y); await raf(page); await raf(page);
      const turning = await page.evaluate(() => CS.display().hand);
      await sleep(150);
      const wayD = await page.evaluate(() => CS.display().hand);
      check(wayU === 'up' && wayD.way === 'down' && !wayD.turning && (await page.evaluate(() => CS.events.some(e => e.type === 'turn' && e.way === 'down'))), 'a triangle turns itself point-down where it can hang (' + wayU + ' -> ' + wayD.way + (turning.turning ? ', turning' : '') + '), in 80 ms');
      // the first tile that falls off: a ▲ on a ▲'s point
      await page.evaluate(() => { CS.setPiece('tri'); });
      const off1 = await dropAt(page, -2, 'mouse');
      check(off1.g && off1.g.outcome === 'off' && off1.rel.outcome === 'off', 'a ▲ on a ▲\'s point falls off (ONLY A POINT)');
      await until(page, () => CS.state().hintNow === 'off', null, 6000).catch(() => {});
      check((await page.evaluate(() => CS.tipBox() && CS.tipBox().text)) === "Tiles hold by their edges. A point isn't enough.", 'the first fall: "Tiles hold by their edges. A point isn\'t enough."');
      await gameWait(page, 1.5);
      const deb = await page.evaluate(() => ({ lost: CS.state().lost, falling: CS.state().falling, d: CS.state().debris }));
      check(deb.lost === 1 && deb.falling === 0 && deb.d >= 1, 'it left the wall and lies on the rug, out of play (' + JSON.stringify(deb) + ')');
      await gameWait(page, 4.6);
      // the first ■ that falls off because something is over its spot (a ▲ hung over it)
      await page.evaluate(() => { CS.clear(); CS.build(['■-2', '■-2', '■-1', '▲-0.5']); CS.setPiece('sq'); });
      await ready(page);
      const off2 = await dropAt(page, 0, 'mouse');
      check(off2.g && off2.g.outcome === 'off', 'a square under a hung ▲ stops on its corner and falls off');
      await until(page, () => CS.state().hintNow === 'top', null, 6000).catch(() => {});
      check((await page.evaluate(() => CS.tipBox() && CS.tipBox().text)) === 'Tiles only go in from the top.', 'something over its spot: "Tiles only go in from the top."');
      await gameWait(page, 4.6);
      // the sway passes 0.3
      await page.evaluate(() => { WOB.W = 0.4; });
      await until(page, () => CS.state().hintNow === 'sway', null, 6000).catch(() => {});
      check((await page.evaluate(() => CS.tipBox() && CS.tipBox().text)) === 'Tall and thin sways. Let it settle.', 'the sway past 0.3: "Tall and thin sways. Let it settle."');
      await gameWait(page, 4.6);
      // TIPS OVER (rules that have it)
      if ((await st(page)).reasons.includes('TIPS OVER')) {
        await page.evaluate(() => { CS.clear(); CS.build(['▲-1', '▼-0.5']); CS.setPiece('sq'); });
        await ready(page);
        const off3 = await dropAt(page, 0, 'mouse');
        check(off3.g && off3.rel.reason === 'TIPS OVER', 'a square on a hung ▼ tips over (golden case 16)');
        const rk = await page.evaluate(() => new Promise(res => { const t0 = performance.now(); (function f() { const d = CS.display(), o = d.falling.find(x => x.outcome === 'off'); if (o && o.stage === 'rock') res(true); else if (performance.now() - t0 > 3000) res(false); else requestAnimationFrame(f); })(); }));
        check(rk, 'the part rocks toward its corner and back before the tile leaves');
        await until(page, () => CS.state().hintNow === 'tips', null, 6000).catch(() => {});
        check((await page.evaluate(() => CS.tipBox() && CS.tipBox().text)) === 'Too far out: it would tip. Balance it.', 'the first TIPS OVER: "Too far out: it would tip. Balance it."');
      } else console.log('  (no TIPS OVER in these rules: its hint is not checked)');
      // no dead tiles: four ▲ points over the whole car leave no place for a square
      await page.evaluate(() => { CS.clear(); CS.build(['■-2', '■-1', '■0', '■1', '▲-2', '▲-1', '▲0', '▲1']); CS.setPiece('sq'); CS.setBox(['sq', 'sq', 'tri', 'sq', 'top']); });
      await ready(page);
      const nb = await page.evaluate(() => CS.display().next);
      await dropAt(page, 0, 'mouse');
      await until(page, () => CS.state().swapping, null, 4000).catch(() => {});
      const sw = await page.evaluate(() => ({ s: CS.state(), d: CS.display() }));
      check(sw.s.swapping && sw.d.swap && sw.d.swap.from === 'sq', 'the next square fits nowhere: it flies back into the box (' + (sw.d.swap && sw.d.swap.text) + ')');
      await until(page, () => !CS.state().swapping && CS.state().handReady, null, 4000).catch(() => {});
      const after = await page.evaluate(() => ({ s: CS.state(), box: CS.boxList(), ev: CS.events.filter(e => e.type === 'swap').length }));
      check(after.s.piece === 'tri' && after.ev === 1 && after.box[0] === 'sq' && after.box[after.box.length - 1] === 'top' && nb.piece === 'sq', 'and the hand takes the next triangle; the square waits in the box; THE TOPPER stays last');
      const prefs = await page.evaluate(() => localStorage.getItem('clackstack.prefs5'));
      check(errors.length === 0, 'no console errors (hints)' + (errors.length ? ': ' + errors.join(' / ') : ''));
      await context.close();
      const p2 = await gamePage(browser, { width: W, height: H }, { seed: 8, mute: 1 }, { storage: { 'clackstack.prefs5': prefs } });
      await click(p2.page, W / 2);
      await ready(p2.page);
      let seen = false;
      for (let i = 0; i < 3; i++) {
        await gameWait(p2.page, 0.6);
        if (await p2.page.evaluate(() => !!CS.tipBox())) seen = true;
        await dropAt(p2.page, 0, 'mouse');
        await ready(p2.page).catch(() => {});
      }
      await p2.page.evaluate(() => CS.setPiece('tri'));
      await gameWait(p2.page, 0.6);
      if (await p2.page.evaluate(() => !!CS.tipBox())) seen = true;
      check(!seen, 'after a reload no hint shows again');
      check(p2.errors.length === 0, 'no console errors (reload)');
      await p2.context.close();
    }
    // ---- BIG MAGNETS: no fuse; the pull; KNOCK IT DOWN; a crash rolls in a new car and the run goes on
    {
      console.log('BIG MAGNETS');
      const { context, page, errors } = await gamePage(browser, { width: W, height: H }, { seed: 9, ts: 2, mute: 1, nohint: 1, big: 1 });
      await click(page, W / 2);
      await ready(page);
      await page.evaluate(() => CS.setPiece('sq'));
      await dropAt(page, 0, 'mouse');
      await ready(page);
      const n0 = await lastId(page);
      await gameWait(page, 5);
      check((await lastId(page)) === n0 && !(await st(page)).fuse.on, 'no fuse: the hand waits');
      check(!(await page.evaluate(() => CS.display().counter)), 'the box\'s counter is hidden');
      // the magnets pull a tile that would fall off to the nearest place it fits (within one tile)
      await page.evaluate(() => { CS.clear(); CS.build(['▲-2']); CS.setPiece('tri'); });
      await ready(page);
      const pl = await dropAt(page, -4, 'mouse');
      check(pl.g && pl.g.outcome === 'fit' && pl.g.col !== pl.g.handCol && pl.rel.col === pl.g.col && pl.rel.handCol === -4, `the magnets pull it from column ${pl.g && pl.g.handCol} to ${pl.g && pl.g.col}, where the ghost showed`);
      await gameWait(page, 0.6);
      // KNOCK IT DOWN
      const best = (await st(page)).best;
      const k = await page.evaluate(() => CS.ui().knock);
      await click(page, k.x + k.w / 2, k.y + k.h / 2);
      await until(page, () => CS.state().crashes === 1, null, 5000).catch(() => {});
      check((await page.evaluate(() => CS.events.filter(e => e.type === 'knock').length)) === 1 && (await st(page)).crashes === 1, 'KNOCK IT DOWN: the arm shoves the tower over');
      await until(page, () => CS.state().phase === 'play' && CS.state().handReady && !CS.state().locked, null, 10000).catch(() => {});
      let s = await st(page);
      check(s.phase === 'play' && !s.over && s.tiles === 0 && s.best === best && best > 0, 'a new car rolls in and the run goes on (best ' + (s.best * 7.5).toFixed(0) + ' cm kept)');
      // a real crash does the same
      await spire(page);
      await page.evaluate(() => { WOB.W = 0.9; });
      await dropAt(page, 2, 'mouse');
      await until(page, () => CS.state().crashes === 2, null, 10000).catch(() => {});
      await until(page, () => CS.state().phase === 'play' && CS.state().handReady && !CS.state().locked, null, 10000).catch(() => {});
      s = await st(page);
      check(s.crashes === 2 && s.phase === 'play' && !s.over, 'after a real crash too');
      check(errors.length === 0, 'no console errors (BIG MAGNETS)' + (errors.length ? ': ' + errors.join(' / ') : ''));
      await context.close();
    }
    // ---- the hooks: ?drive, ?quiz, CS.display, ?seed, ?mute, ?nohint, ?ts
    {
      console.log('hooks');
      const a = await gamePage(browser, { width: W, height: H }, { drive: 1, autostart: 1, seed: 3, nohint: 1 }, { storage: PLAYED });
      await a.page.waitForFunction(() => window.CS && CS.state().phase === 'play');
      const t0 = (await st(a.page)).t; await sleep(400);
      check((await st(a.page)).t === t0, '?drive=1: the clock stands still until told');
      const t1 = await a.page.evaluate(() => CS.step(120));
      check(Math.abs(t1 - t0 - 1) < 1e-6, '?drive=1: CS.step(120) moves it 1 s');
      const shotA = await a.page.screenshot();
      const b = await gamePage(browser, { width: W, height: H }, { drive: 1, autostart: 1, seed: 3, nohint: 1 }, { storage: PLAYED });
      await b.page.waitForFunction(() => window.CS && CS.state().phase === 'play');
      await b.page.evaluate(() => CS.step(120));
      check(shotA.equals(await b.page.screenshot()), '?drive=1: the same seed and steps draw the same picture');
      const boxA = await a.page.evaluate(() => CS.boxList().join('')), boxB = await b.page.evaluate(() => CS.boxList().join(''));
      check(boxA === boxB, '?seed: the same seed deals the same box');
      check(a.errors.length === 0 && b.errors.length === 0, 'no console errors (drive)');
      await a.context.close(); await b.context.close();
      const c = await gamePage(browser, { width: W, height: H }, { autostart: 1, seed: 4, nohint: 1 }, { storage: PLAYED });
      await c.page.waitForFunction(() => window.CS && CS.state().phase === 'play');
      check((await c.page.evaluate(() => CS.boxList().join(''))) !== boxA, '?seed: another seed, another box');
      check((await c.page.evaluate(() => CS.audio().muted)) === false, 'without ?mute the sound is on');
      await c.context.close();
      const q = { build: ['■-2', '▲-1', '■1'], hand: '▲0', off: ['markers', 'weight'] };
      const qp = await gamePage(browser, { width: W, height: H }, { quiz: JSON.stringify(q) });
      await qp.page.waitForFunction(() => window.CS && CS.state().phase === 'play');
      const qd = await qp.page.evaluate(() => CS.display());
      check(qd.tiles.length === 3 && qd.hand && qd.hand.col === 0 && qd.ghost && !qd.markers.length && !qd.weight, '?quiz: the build, the hand at its column, the chosen layers off (' + qd.layers.map(l => l.layer).join(',') + ')');
      check(qd.tiles.every(t => t.poly.length >= 3 && t.color) && qd.ghost.poly && qd.ghost.style && qd.next && qd.counter, 'CS.display(): tile polygons with colours, the ghost with its style, NEXT, the counter');
      check((await qp.page.evaluate(() => CS.audio().muted)) && !(await qp.page.evaluate(() => CS.tipBox())), '?quiz is silent and shows no hints');
      check(qp.errors.length === 0, 'no console errors (quiz)');
      await qp.context.close();
      const m = await gamePage(browser, { width: W, height: H }, { autostart: 1, mute: 1, ts: 2, nohint: 1 }, { storage: {} });
      await m.page.waitForFunction(() => window.CS && CS.state().phase === 'play');
      const g0 = (await st(m.page)).t, r0 = Date.now(); await sleep(1000);
      const rate = ((await st(m.page)).t - g0) / ((Date.now() - r0) / 1000);
      check((await m.page.evaluate(() => CS.audio().muted)) && rate > 1.6 && rate < 2.2, `?mute=1 mutes; ?ts=2 runs the clock at ${rate.toFixed(2)}x`);
      await gameWait(m.page, 1);
      check(!(await m.page.evaluate(() => CS.tipBox())), '?nohint=1: no hints on a first run');
      await m.context.close();
    }
    // ---- the other sizes: a landscape phone and a large window
    for (const [w, h, isTouch] of [[844, 390, true], [1366, 1024, false]]) {
      console.log(`${w}x${h}`);
      const { context, page, errors } = await gamePage(browser, { width: w, height: h }, { seed: 12, ts: 2, mute: 1, nohint: 1 }, { touch: isTouch, storage: PLAYED });
      const T = isTouch ? await touch(page) : null;
      if (T) await T.tap(w / 2, h / 2); else await page.mouse.click(w / 2, h / 2);
      await ready(page);
      let same = 0, nn = 0;
      for (let i = 0; i < 16; i++) {
        await ready(page).catch(() => {});
        const s = await st(page);
        if (s.phase !== 'play') break;
        const col = s.piece === 'sq' ? [-4, -2, 0, 2][i % 4] : [-5, -3, -1, 1, 3][i % 5];
        const yy = h * 0.5;
        const x = await page.evaluate(c => CS.colToX(c), col);
        if (T) { await T.down(x, yy); await T.move(x + 1, yy); } else await page.mouse.move(x + 1, yy);
        await raf(page);
        const g = await page.evaluate(() => CS.ghost() && CS.ghost().key), id = await lastId(page);
        if (T) await T.up(); else { await page.mouse.down(); await page.mouse.up(); }
        const rel = await released(page, id);
        if (g && rel && rel.id > id) { nn++; if (rel.key === g) same++; }
        await gameWait(page, 0.35);
      }
      const ui = await page.evaluate(() => CS.ui()), d = await page.evaluate(() => CS.display());
      const inside = b => b.x0 >= -1 && b.y0 >= -1 && b.x1 <= w + 1 && b.y1 <= h + 1;
      check(nn >= 10 && same === nn, `${w}x${h}: the ghost is the release ${same}/${nn}`);
      check(!!d.counter && inside(d.counter.box) && !!d.next && inside(d.next.box), `${w}x${h}: the counter and NEXT are on the screen`);
      check(errors.length === 0, `no console errors (${w}x${h})` + (errors.length ? ': ' + errors.join(' / ') : ''));
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(bad ? `feel: ${bad} FAILED` : 'feel: all passed');
  process.exitCode = bad ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
