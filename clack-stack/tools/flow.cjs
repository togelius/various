#!/usr/bin/env node
'use strict';
// G3 flow (DESIGN §18.3–18.6, 18.8) at 390x844 and 844x390 (a finger) and 1366x1024 (a mouse), through real input,
// each checked on the screen (CS.display) and against what the game did (CS.state, CS.events):
//  - the box: a first run ever, started from the title by a tap: 60 tiles, 42 ■ and 18 ▲, never more than two ▲ in a
//    row, five ■ first and the fuse only from the fifth landing; the counter on the tile box and NEXT follow every tile;
//    a tile that falls off is gone from the box; THE TOPPER last (NEXT says TOPPER, the counter "+ THE TOPPER", then
//    "THE TOPPER: NOW!"); the box played through: TOPPED OUT! on the very top, its point counted in the height; and the
//    last tile landing lower: THE BOX IS EMPTY!;
//  - the dead-tile swap: a square that fits nowhere flies back into the box with "■ FITS NOWHERE: SWAP!" and the next
//    triangle comes out, NEXT and the counter following, THE TOPPER staying last; with no triangle left it is dealt;
//  - the hints of §18.4 (and THE TOPPER's, when it comes into the hand): each shown once when its moment comes (one
//    that comes while another is up waits its turn),
//    clear of the ghost, its column, the weight, the hand, the HUD and the tile box; none again after a reload;
//  - BIG MAGNETS, turned on by its button on the title: no fuse, the counter hidden and the box endless, the pull,
//    gentler sway and kicks (× 0.4, × 0.5), KNOCK IT DOWN (its button, and K) and a real crash each roll in a new car and
//    the run goes on.
// Scenes the box would take minutes to reach are set up with CS.build / CS.setPiece / CS.setBox (and the sway with WOB
// for the crash); every drop is real input. No console errors.
//   node clack-stack/tools/flow.cjs [--sizes=...] [--only=box,swap,hints,big]
const G = require('./g3lib.cjs');

const T = G.reporter('flow');
const R = G.pageRules();
const HAS_TIPS = R.REASONS.includes('TIPS OVER');

// step the ?drive clock (dt s at a time, up to maxT s) until fn(arg) in the page is true
async function until(page, fn, arg, maxT, dt) {
  dt = dt || 0.05;
  for (let t = 0; t <= (maxT || 5); t += dt) { if (await page.evaluate(fn, arg)) return true; await G.wait(page, dt); }
  return !!(await page.evaluate(fn, arg));
}
const readyNow = () => { const s = CS.state(); return s.phase === 'play' && s.handReady && !s.locked && !s.swapping; };
async function aimCol(g, col) {
  const x = await g.page.evaluate(c => CS.colToX(c), col);
  await g.input.aim(x, g.size.h * 0.55);
  await G.frame(g.page); await G.step(g.page, 11);
}
async function dropCol(g, col) {
  await aimCol(g, col);
  const id = await g.page.evaluate(() => CS.lastRelease ? CS.lastRelease.id : 0);
  await g.input.release();
  await G.frame(g.page);
  const rel = await g.page.evaluate(() => CS.lastRelease);
  return rel && rel.id !== id ? rel : null;
}
// a careful player's column: a fit whose ghost weight stays white, low, its weight near the middle (the topper: the
// highest such fit)
function pickCol(page, top) {
  return page.evaluate(top => {
    let best = null, bs = Infinity;
    for (const d of CS.drops(true)) {
      if (d.outcome !== 'fit') continue;
      const s = (d.tip ? 1000 : 0) + (top ? -d.top * 10 : d.top * 3) + Math.abs(d.settle || 0) * 4 + Math.abs(d.lx) * 0.5;
      if (s < bs) { bs = s; best = d; }
    }
    return best ? best.handCol : null;
  }, !!top);
}
const counts = list => ({ sq: list.filter(b => b === 'sq').length, tri: list.filter(b => b === 'tri').length, top: list.includes('top') });

/* ---- the box ---- */
async function boxRun(browser, size, seed) {
  const tag = size.name + ' box';
  const g = await G.open(browser, size, { drive: 1, seed, nohint: 1 }, { storage: {} });
  const { page } = g;
  await page.waitForFunction(() => window.CS && CS.state().phase === 'title');
  await G.wait(page, 0.4);
  await g.input.tap(size.w / 2, size.h * 0.45);
  await until(page, readyNow, null, 4);
  let s = await G.state(page);
  const deal = [s.piece].concat(await page.evaluate(() => CS.boxList()));
  const c = counts(deal);
  let run = 0, maxRun = 0; for (const b of deal) { run = b === 'sq' ? 0 : run + 1; maxRun = Math.max(maxRun, run); }
  T.check(s.phase === 'play' && deal.length === 60 && c.sq === 42 && c.tri === 17 && deal[59] === 'top' && maxRun <= 2, `${tag}: a tap on the title deals a box of 60: ${c.sq} ■, ${c.tri} ▲ and THE TOPPER last, at most ${maxRun} ▲ in a row`);
  T.check(s.firstRun && deal.slice(0, 5).every(b => b === 'sq'), `${tag}: a first run ever starts with five squares`);
  let bad = [], fuseEarly = false, fuseLate = false, offs = 0, offLost = true, topperSeen = { next: false, counter: false, now: false };
  for (let k = 0; k < 80; k++) {
    if (!(await until(page, readyNow, null, 3))) break;
    s = await G.state(page);
    const d = await G.display(page), left = await page.evaluate(() => CS.boxList());
    const cc = counts(left), m = d.counter && /■ (\d+)\s+▲ (\d+)/.exec(d.counter.text);
    if (!m || +m[1] !== cc.sq || +m[2] !== cc.tri) bad.push(`tile ${k + 1}: the counter says "${d.counter && d.counter.text}", the box holds ${cc.sq} ■ ${cc.tri} ▲`);
    if (cc.top && !/\+ THE TOPPER/.test(d.counter.text)) bad.push(`tile ${k + 1}: the counter does not show THE TOPPER still in the box`);
    if (s.topper && /THE TOPPER: NOW!/.test(d.counter.text)) topperSeen.now = true;
    const nx = left[0] || null;
    if (!d.next || (nx ? d.next.piece !== (nx === 'sq' ? 'sq' : 'tri') || d.next.topper !== (nx === 'top') : d.next.piece !== null)) bad.push(`tile ${k + 1}: NEXT shows ${d.next && d.next.piece}${d.next && d.next.topper ? ' (TOPPER)' : ''}, the box's next is ${nx}`);
    if (nx === 'top' && d.next && d.next.topper) topperSeen.next = true;
    if (cc.top) topperSeen.counter = true;
    // (every tile accounted for: landed, in the air, lost, in the hand, in the box)
    if (s.landed + s.inAir + s.lost + 1 + left.length !== 60) bad.push(`tile ${k + 1}: ${s.landed} landed + ${s.inAir} in the air + ${s.lost} lost + 1 + ${left.length} in the box is not 60`);
    // the fuse: not before the fifth landing on a first run
    if (s.landed < 5 && (d.fuse || s.fuse.on)) fuseEarly = true;
    if (s.landed >= 5 && d.fuse && s.fuse.on) fuseLate = true;
    if (k === 2) {
      await G.wait(page, 3.4);
      if ((await page.evaluate(() => CS.events.some(e => e.type === 'fuse')))) fuseEarly = true;
    }
    // a careful player lets the sway settle (while the fuse allows)
    for (let i = 0; i < 40; i++) { const q = await G.state(page); if (q.swayAmp < 0.04 || (q.fuse.on && q.fuse.max - q.fuse.t < 0.45)) break; await G.wait(page, 0.05); }
    // one tile let fall off on purpose (once five have landed): it is gone from the box
    let col;
    if (k >= 6 && !offs) col = await page.evaluate(() => { const o = CS.drops(false).find(d => d.outcome !== 'fit'); return o ? o.handCol : null; });
    if (col === null || col === undefined) col = await pickCol(page, s.topper);
    if (col === null) col = s.colRange[0];
    const before = left.length, rel = await dropCol(g, col);
    if (!rel) { bad.push(`tile ${k + 1}: the press let nothing go`); break; }
    if (rel.outcome === 'off') {
      offs++;
      await until(page, readyNow, null, 3);
      const l2 = await page.evaluate(() => CS.boxList()), s2 = await G.state(page);
      if (l2.length !== before - 1 || s2.lost < 1) offLost = false;
    }
    await G.wait(page, 0.35);
    if (s.topper || (await G.state(page)).phase !== 'play') break;
  }
  await until(page, () => CS.state().phase === 'over' && CS.state().over.open, null, 8, 0.1);
  s = await G.state(page);
  const d = await G.display(page);
  T.check(!bad.length, `${tag}: the counter on the tile box and NEXT follow every tile, every tile accounted for` + (bad.length ? ': ' + bad.slice(0, 3).join('; ') : ''));
  T.check(!fuseEarly && fuseLate, `${tag}: the fuse waits for the fifth landing (none before, and its ring after)`);
  T.check(offs >= 1 && offLost, `${tag}: a tile that falls off is gone from the box (${offs})`);
  T.check(topperSeen.counter && topperSeen.next && topperSeen.now, `${tag}: THE TOPPER: "+ THE TOPPER" on the counter, TOPPER on NEXT, then "THE TOPPER: NOW!"`);
  const topped = s.over && s.over.final.end === 'topped';
  T.check(topped && d.results && d.results.lines.includes('TOPPED OUT!'), `${tag}: the box played through, THE TOPPER on the very top: the card says ${d.results ? d.results.lines.join(' / ') : s.over ? s.over.final.why : s.phase}`);
  if (topped) {
    await G.wait(page, 1);
    const dr = (await G.display(page)).results;
    if (dr) d.results = dr;
    const best = s.best, ev = await page.evaluate(() => CS.events.filter(e => e.type === 'land').pop());
    if (process.env.G3_DEBUG) console.log(JSON.stringify({ lines: d.results.lines, ev, best, over: s.over }));
    T.check(ev && ev.topper && Math.abs(ev.top - best) < 1e-3 && d.results.lines.includes(Math.round(best * 7.5) + ' cm'), `${tag}: its point counts in the height: ${Math.round(best * 7.5)} cm, the topper's apex at ${best.toFixed(3)} L`);
  }
  // THE BOX IS EMPTY!: AGAIN, then the last tile lands lower than the top
  const again = d.buttons.find(b => b.name === 'again');
  if (again) await g.input.tap((again.box.x0 + again.box.x1) / 2, (again.box.y0 + again.box.y1) / 2);
  await until(page, readyNow, null, 4);
  await page.evaluate(() => { CS.clear(); CS.build(['■-2', '■-2', '■-2', '■0']); CS.setPiece('tri', true); CS.setBox([]); });
  await G.wait(page, 0.3);
  await dropCol(g, 1);
  await until(page, () => CS.state().phase === 'over' && CS.state().over.open, null, 6, 0.1);
  const d2 = await G.display(page), s2 = await G.state(page);
  T.check(s2.over && s2.over.final.end === 'empty' && d2.results && d2.results.lines.includes('THE BOX IS EMPTY!'), `${tag}: the last tile lands lower: the card says ${d2.results ? d2.results.lines.join(' / ') : s2.phase}`);
  T.check(g.errors.length === 0, `${tag}: no console errors` + (g.errors.length ? ': ' + g.errors.slice(0, 3).join(' / ') : ''));
  await g.context.close();
}

/* ---- the dead-tile swap ---- */
async function swapScene(browser, size, seed) {
  const tag = size.name + ' swap';
  const g = await G.open(browser, size, { drive: 1, autostart: 1, nohint: 1, seed });
  const { page } = g;
  await page.waitForFunction(() => window.CS && CS.state().phase === 'play');
  await until(page, readyNow, null, 3);
  // four ▲ points over a row of squares: no square fits anywhere
  await page.evaluate(() => { CS.clear(); CS.build(['■-2', '■-1', '■0', '■1', '▲-2', '▲-1', '▲0', '▲1']); CS.setPiece('sq'); CS.setBox(['sq', 'sq', 'tri', 'sq', 'top']); });
  await G.wait(page, 0.3);
  const d0 = await G.display(page);
  await dropCol(g, 0);
  // the next square fits nowhere: watch it fly back and the triangle come out
  const seen = [];
  for (let i = 0; i < 40; i++) {
    await G.step(page, 3);
    const d = await G.display(page), s = await G.state(page);
    seen.push({ swap: d.swap, next: d.next, counter: d.counter && d.counter.text, swapping: s.swapping, piece: s.piece, ready: s.handReady, hand: d.hand });
    if (seen.length > 3 && !s.swapping && s.handReady) break;
  }
  const during = seen.filter(x => x.swap), after = seen[seen.length - 1];
  const mouth = d0.counter && d0.counter.box;
  const first = during[0], mid = during.find(x => x.swap.u >= 0.45 && x.swap.u <= 0.55) || during[Math.floor(during.length / 2)];
  T.check(during.length >= 3 && during.every(x => x.swap.text === '■ FITS NOWHERE: SWAP!' && x.swap.from === 'sq' && x.swap.to === 'tri'), `${tag}: the square that fits nowhere: "${first && first.swap.text}" over ${during.length} frames`);
  T.check(!!(first && mid && mouth && mid.swap.y > first.swap.y && Math.abs(mid.swap.x - (mouth.x0 + mouth.x1) / 2) < Math.abs(first.swap.x - (mouth.x0 + mouth.x1) / 2)), `${tag}: it flies to the tile box (from ${first && first.swap.x.toFixed(0)},${first && first.swap.y.toFixed(0)} to ${mid && mid.swap.x.toFixed(0)},${mid && mid.swap.y.toFixed(0)})`);
  const box = await page.evaluate(() => CS.boxList()), ev = await page.evaluate(() => CS.events.filter(e => e.type === 'swap').length);
  T.check(after.piece === 'tri' && after.ready && ev === 1 && box.join(',') === 'sq,sq,sq,top', `${tag}: the hand takes the next triangle; the square waits in the box and THE TOPPER stays last (${box.join(' ')})`);
  T.check(/■ 2\s+▲ 1/.test(seen[0].counter || '') && /■ 3\s+▲ 0/.test(after.counter || '') && after.next && after.next.piece === 'sq', `${tag}: the counter follows ("${seen[0].counter}" -> "${after.counter}") and NEXT shows the square`);
  // with no triangle left in the box, the dead square is dealt anyway
  await page.evaluate(() => { CS.clear(); CS.build(['■-2', '■-1', '■0', '■1', '▲-2', '▲-1', '▲0', '▲1']); CS.setPiece('sq'); CS.setBox(['sq', 'sq']); });
  await G.wait(page, 0.3);
  await dropCol(g, -2);
  await until(page, readyNow, null, 3);
  const dd = await G.display(page), dead = await page.evaluate(() => CS.events.filter(e => e.type === 'dead').length);
  T.check(dead === 1 && dd.hand && dd.hand.piece === 'sq' && dd.ghost && dd.ghost.style === 'off' && !dd.swap, `${tag}: no triangle left: the square is dealt anyway (its ghost red)`);
  T.check(g.errors.length === 0, `${tag}: no console errors` + (g.errors.length ? ': ' + g.errors.slice(0, 3).join(' / ') : ''));
  await g.context.close();
}

/* ---- the hints ---- */
const HINTS = {
  drop: 'Let go: it falls straight down.', weight: 'Keep the weight between the wheels!', tri: "Triangles turn themselves to fit: flat on a top, or hanging on a triangle's side.",
  off: "Tiles hold by their edges. A point isn't enough.", tips: 'Too far out: it would tip the tiles under it.', top: 'Tiles only go in from the top.', sway: 'Tall and thin sways. Let it settle.',
  topper: 'Put THE TOPPER on the very top!',
};
// the hint is clear of the ghost, its column, the weight, the hand and its tile, the HUD and the tile box
async function hintClear(page) {
  return page.evaluate(() => {
    const d = CS.display(), h = d.hint, cam = CS.cam(), ui = CS.ui(), out = [];
    if (!h) return ['no hint drawn'];
    const hit = (a, b) => a && b && a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1, B = h.box;
    if (d.ghost && hit(B, d.ghost.box)) out.push('the ghost');
    if (d.ghost && d.ghost.column && hit(B, d.ghost.column.box)) out.push('its column');
    if (d.weight && hit(B, d.weight.box)) out.push('the weight ' + JSON.stringify({ hint: B, weight: d.weight.box, placed: h.placed }));
    if (d.hand && d.hand.poly) { const xs = d.hand.poly.map(p => p[0]), ys = d.hand.poly.map(p => p[1]), hb = { x0: Math.min(...xs), y0: Math.min(...ys) - 0.9 * cam.L, x1: Math.max(...xs), y1: Math.max(...ys) }; if (hit(B, hb)) out.push('the hand ' + JSON.stringify({ hint: B, hand: hb, ready: d.hand.ready, x: d.hand.x, y: d.hand.y })); }
    if (B.y0 < cam.hudBottom) out.push('the HUD');
    for (const k of ['pause', 'mute', 'height', 'next']) if (ui[k] && hit(B, { x0: ui[k].x, y0: ui[k].y, x1: ui[k].x + ui[k].w, y1: ui[k].y + ui[k].h })) out.push('the HUD ' + k);
    if (d.counter && hit(B, d.counter.box)) out.push('the tile box');
    if (B.x0 < 0 || B.x1 > cam.W || B.y1 > cam.H) out.push('the screen edge');
    return out;
  });
}
async function hints(browser, size, seed) {
  const tag = size.name + ' hints';
  const g = await G.open(browser, size, { drive: 1, seed }, { storage: {} });
  const { page } = g;
  await page.waitForFunction(() => window.CS && CS.state().phase === 'title');
  await G.wait(page, 0.4);
  await g.input.tap(size.w / 2, size.h * 0.45);
  await until(page, readyNow, null, 4);
  const shownAt = {}, clear = {};
  const watch = async id => {
    const ok = await until(page, i => CS.state().hintNow === i, id, 9, 0.05);
    if (!ok) return false;
    const d = await G.display(page);
    shownAt[id] = d.hint && d.hint.text;
    clear[id] = await hintClear(page);
    return true;
  };
  await watch('drop');
  // after the first landing (a real drop), the weight
  await dropCol(g, 0);
  await watch('weight');
  // the first triangle
  await until(page, () => !CS.state().hintNow, null, 6);
  await until(page, readyNow, null, 3);
  await page.evaluate(() => CS.setPiece('tri'));
  await watch('tri');
  // the first tile that falls off at a point (a ▲ on a ▲'s point), while the triangle's hint is up: it waits its turn
  await G.wait(page, 0.4);
  await page.evaluate(() => { CS.clear(); CS.build(['▲0', '■-2', '■1']); CS.setPiece('tri'); });
  await until(page, readyNow, null, 2);
  const upBefore = (await G.state(page)).hintNow;
  await dropCol(g, 0);
  await until(page, () => CS.events.some(e => e.type === 'off'), null, 2);
  const queued = upBefore === 'tri' && (await G.state(page)).hintNow === 'tri';
  await watch('off');
  const ev1 = await page.evaluate(() => CS.events.filter(e => e.type === 'tip').map(e => e.id));
  T.check(queued && ev1.indexOf('off') > ev1.indexOf('tri'), `${tag}: a tile falling off while the triangle's hint is up: its hint waits its turn, then shows`);
  // something over its spot: a square under a hung ▲
  await until(page, () => !CS.state().hintNow, null, 6);
  await page.evaluate(() => { CS.clear(); CS.build(['■-2', '■-2', '■-1', '▲-0.5']); CS.setPiece('sq'); });
  await until(page, readyNow, null, 2);
  await dropCol(g, 0);
  await watch('top');
  // TIPS OVER (rules that have it): golden case 16, a square on a hung ▼'s top
  if (HAS_TIPS) {
    await until(page, () => !CS.state().hintNow, null, 6);
    await page.evaluate(() => { CS.clear(); CS.build(['▲-1', '▼-0.5']); CS.setPiece('sq'); });
    await until(page, readyNow, null, 2);
    await dropCol(g, 0);
    await watch('tips');
  }
  // the sway past 0.3: squares dropped fast on a thin spire
  await until(page, () => !CS.state().hintNow, null, 6);
  await page.evaluate(() => { CS.clear(); CS.build(['■-2', '■-2', '■-2']); });
  for (let i = 0; i < 6 && !(await page.evaluate(() => CS.events.some(e => e.type === 'tip' && e.id === 'sway'))); i++) {
    await until(page, readyNow, null, 2, 0.02);
    if ((await G.state(page)).phase !== 'play') break;
    await page.evaluate(() => CS.setPiece('sq'));
    await dropCol(g, -4);
    await G.wait(page, 0.2);
  }
  await watch('sway');
  // THE TOPPER comes into the hand: its goal
  await until(page, () => !CS.state().hintNow, null, 6);
  // (with the sway tuned in DESIGN §18.8 G4 a thin spire stacked this fast goes over, as it should: the scenes that follow
  // need a run, so AGAIN)
  if ((await G.state(page)).phase !== 'play') {
    await until(page, () => { const s = CS.state(); return s.phase === 'over' && s.over && s.over.open; }, null, 10);
    await G.wait(page, 0.6);
    const ag = (await G.display(page)).buttons.find(b => b.name === 'again');
    if (ag) await g.input.tap((ag.box.x0 + ag.box.x1) / 2, (ag.box.y0 + ag.box.y1) / 2);
    await until(page, readyNow, null, 8);
  }
  await page.evaluate(() => { CS.clear(); CS.build(['■-2', '■0']); CS.setPiece('tri', true); CS.setBox([]); });
  await watch('topper');
  if (process.env.G3_DEBUG) console.log(JSON.stringify(await page.evaluate(() => ({ KEEP: Array.from(KEEP), TIPT, cam: CS.cam(), e: buildExtent(), W: CAM.W, H: CAM.H, rib: { on: RIB.on, x0: RIB.x0, x1: RIB.x1, y: RIB.y, stub: RIB.stub }, w1: TIPH.w1, w2: TIPH.w2 }))));
  for (const id of Object.keys(HINTS)) {
    if (id === 'tips' && !HAS_TIPS) continue;
    T.check(shownAt[id] === HINTS[id], `${tag}: "${HINTS[id]}" (${id})` + (shownAt[id] === HINTS[id] ? '' : ': ' + shownAt[id]));
    if (clear[id]) T.check(!clear[id].length, `${tag}: ${id}'s hint is clear of the ghost, its column, the weight, the hand, the HUD and the tile box` + (clear[id].length ? ': it covers ' + clear[id].join(', ') : ''));
  }
  // each once: the same moments again bring no hint
  await G.wait(page, 5);
  await page.evaluate(() => { CS.clear(); CS.build(['▲0', '■-2', '■1']); CS.setPiece('tri'); });
  await until(page, readyNow, null, 3);
  await dropCol(g, 0);
  await G.wait(page, 1.5);
  const tips = await page.evaluate(() => CS.events.filter(e => e.type === 'tip').map(e => e.id));
  const dup = tips.filter((id, i) => tips.indexOf(id) !== i);
  T.check(!dup.length, `${tag}: each hint once (${tips.join(', ')})` + (dup.length ? ': again ' + dup.join(', ') : ''));
  const prefs = await page.evaluate(() => localStorage.getItem('clackstack.prefs5'));
  T.check(g.errors.length === 0, `${tag}: no console errors` + (g.errors.length ? ': ' + g.errors.slice(0, 3).join(' / ') : ''));
  await g.context.close();
  // after a reload: none again
  const g2 = await G.open(browser, size, { drive: 1, seed: seed + 1 }, { storage: { 'clackstack.prefs5': prefs } });
  await g2.page.waitForFunction(() => window.CS && CS.state().phase === 'title');
  await G.wait(g2.page, 0.4);
  await g2.input.tap(size.w / 2, size.h * 0.45);
  for (let i = 0; i < 4; i++) {
    await until(g2.page, readyNow, null, 4);
    if (i === 2) await g2.page.evaluate(() => CS.setPiece('tri'));
    if (i === 3) await g2.page.evaluate(() => { CS.clear(); CS.build(['▲0', '■-2', '■1']); CS.setPiece('tri'); });
    await G.wait(g2.page, 0.3);
    await dropCol(g2, i === 3 ? 0 : await pickCol(g2.page));
    await G.wait(g2.page, 1);
  }
  const none = await g2.page.evaluate(() => CS.events.filter(e => e.type === 'tip').map(e => e.id));
  T.check(!none.length, `${tag}: after a reload no hint shows again` + (none.length ? ': ' + none.join(', ') : ''));
  T.check(g2.errors.length === 0, `${tag}: no console errors (reload)`);
  await g2.context.close();
}

/* ---- BIG MAGNETS ---- */
async function bigMagnets(browser, size, seed) {
  const tag = size.name + ' BIG MAGNETS';
  const g = await G.open(browser, size, { drive: 1, seed, nohint: 1 });
  const { page } = g;
  await page.waitForFunction(() => window.CS && CS.state().phase === 'title');
  await G.wait(page, 0.4);
  // its button on the title
  const d0 = await G.display(page), bt = d0.buttons.find(b => b.name === 'big');
  if (bt) await g.input.tap((bt.box.x0 + bt.box.x1) / 2, (bt.box.y0 + bt.box.y1) / 2);
  const on = await page.evaluate(() => CS.state().big);
  T.check(!!bt && on, `${tag}: its button on the title turns it on`);
  await G.wait(page, 0.2);
  await g.input.tap(size.w / 2, size.h * 0.4);
  await until(page, readyNow, null, 4);
  // no fuse; the counter hidden (the tile box still there)
  await G.wait(page, 5);
  let d = await G.display(page), s = await G.state(page);
  T.check(!d.fuse && !s.fuse.on && !(await page.evaluate(() => CS.lastRelease)), `${tag}: no fuse: the hand waits (5 s)`);
  T.check(!d.counter && !!d.box, `${tag}: the tile box without its counter`);
  // the pull: aim where it would fall off, within a tile of a fit: the ghost and the landing are at the fit
  await page.evaluate(() => { CS.clear(); CS.build(['▲-2']); CS.setPiece('tri'); });
  await G.wait(page, 0.2);
  const pc = await page.evaluate(() => { const p = CS.drops(false).find(d => d.outcome === 'fit' && d.col !== d.handCol); return p ? { hand: p.handCol, col: p.col } : null; });
  let pulled = false;
  if (pc) {
    await aimCol(g, pc.hand);
    d = await G.display(page);
    const rel = await (async () => { const id = await page.evaluate(() => CS.lastRelease ? CS.lastRelease.id : 0); await g.input.release(); await G.frame(page); const r = await page.evaluate(() => CS.lastRelease); return r && r.id !== id ? r : null; })();
    await G.wait(page, 0.6);
    const land = await page.evaluate(id => CS.events.find(e => e.type === 'land' && e.id === id), rel && rel.id);
    pulled = d.ghost && d.ghost.style === 'fit' && d.ghost.col === pc.col && d.hand.col === pc.hand && Math.abs(pc.col - pc.hand) <= 2 && rel && rel.col === pc.col && land && land.key === rel.key;
  }
  T.check(pulled, `${tag}: the magnets pull the tile from column ${pc && pc.hand} to ${pc && pc.col}: the ghost there, and it lands there`);
  // gentler sway and kicks: the same drop as in a normal run
  const swayKick = async big => {
    const p2 = big ? g : await G.open(browser, size, { drive: 1, autostart: 1, seed, nohint: 1 });
    await p2.page.waitForFunction(() => window.CS && CS.state().phase === 'play');
    await until(p2.page, readyNow, null, 3);
    await p2.page.evaluate(() => { CS.clear(); CS.build(['■0', '■0', '■0', '■0']); CS.setPiece('sq'); });
    await G.wait(p2.page, 0.3);
    const rel = await dropCol(p2, 0);
    let om = 0;
    for (let i = 0; i < 80; i++) { await G.step(p2.page, 1); const r = await p2.page.evaluate(id => { const e = CS.events.find(q => q.type === 'land' && q.id === id); return e ? { dW: e.dW, omega: CS.state().omega } : null; }, rel && rel.id); if (r) { om = r; break; } }
    // and a kick off the middle
    await p2.page.evaluate(() => { CS.clear(); CS.build(['■1']); CS.setPiece('sq'); });
    await G.wait(p2.page, 0.3);
    const rel2 = await dropCol(p2, 2);
    let k = null;
    for (let i = 0; i < 80 && k === null; i++) { await G.step(p2.page, 1); k = await p2.page.evaluate(id => { const e = CS.events.find(q => q.type === 'land' && q.id === id); return e ? e.dOmega : null; }, rel2 && rel2.id); }
    if (!big) await p2.context.close();
    return { dW: om && om.dW, omega: k };
  };
  const bigSK = await swayKick(true), normSK = await swayKick(false);
  const rw = bigSK.dW / normSK.dW, rk = bigSK.omega / normSK.omega;
  // (the factors are the page's own, CFG.WOB_BIG and CFG.KICK_BIG: the sway's was retuned in DESIGN §18.8 G4)
  const want = await page.evaluate(() => [CFG.WOB_BIG, CFG.KICK_BIG]);
  T.check(want[0] < 1 && want[1] < 1 && normSK.dW > 0 && Math.abs(rw - want[0]) < 0.01 && Math.abs(rk - want[1]) < 0.05, `${tag}: gentler: the same landing sways it ${rw.toFixed(3)}× (CFG ${want[0]}) and kicks it ${rk.toFixed(3)}× (CFG ${want[1]}) as much as in a normal run`);
  // the box never empties
  let dealt = 0;
  for (let i = 0; i < 64; i++) {
    if (!(await until(page, readyNow, null, 4))) break;
    if ((await G.state(page)).tiles > 14) await page.evaluate(() => CS.clear());
    const col = await pickCol(page);
    if (await dropCol(g, col === null ? 0 : col)) dealt++;
    await G.wait(page, 0.3);
  }
  s = await G.state(page);
  T.check(dealt >= 64 && s.piece && (await page.evaluate(() => CS.boxList().length)) >= 7 && !(await G.display(page)).counter, `${tag}: the box never empties: ${dealt} tiles more and still ${s.box.left} to come`);
  // KNOCK IT DOWN: its button
  await until(page, readyNow, null, 3);
  await page.evaluate(() => { CS.clear(); CS.build(['■-1', '■0', '■-1']); });
  await G.wait(page, 0.4);
  d = await G.display(page);
  const best0 = (await G.state(page)).best;
  T.check(!!d.knock && d.knock.text === 'KNOCK IT DOWN' && !d.knock.disabled, `${tag}: a big KNOCK IT DOWN button`);
  if (d.knock) await g.input.tap((d.knock.box.x0 + d.knock.box.x1) / 2, (d.knock.box.y0 + d.knock.box.y1) / 2);
  const knocked = await until(page, () => CS.state().crashes === 1, null, 3);
  await until(page, readyNow, null, 6);
  s = await G.state(page); d = await G.display(page);
  T.check(knocked && (await page.evaluate(() => CS.events.filter(e => e.type === 'knock').length)) === 1 && s.phase === 'play' && s.tiles === 0 && !d.results && s.best >= best0, `${tag}: KNOCK IT DOWN: the arm shoves it over, a new car rolls in, the run goes on (best kept)`);
  // and K
  await page.evaluate(() => CS.build(['■-1', '■0']));
  await G.wait(page, 0.4);
  await g.input.key('k');
  const k2 = await until(page, () => CS.state().crashes === 2, null, 3);
  await until(page, readyNow, null, 6);
  T.check(k2 && (await G.state(page)).phase === 'play', `${tag}: K knocks it down too`);
  // a real crash: a swaying spire, one more on top
  await page.evaluate(() => { CS.clear(); CS.build(['■1', '■1', '■1', '■1', '■1', '■1', '■1', '■1', '■1', '■1']); CS.setPiece('sq'); WOB.W = 0.9; WOB.dir = 1; });
  await dropCol(g, 2);
  const crashed = await until(page, () => CS.state().crashes === 3, null, 6);
  await until(page, readyNow, null, 8);
  s = await G.state(page); d = await G.display(page);
  T.check(crashed && s.phase === 'play' && !d.results && (await page.evaluate(() => CS.events.filter(e => e.type === 'crash').slice(-1)[0].past)), `${tag}: a real crash (the weight past a wheel) rolls in a new car too`);
  T.check(g.errors.length === 0, `${tag}: no console errors` + (g.errors.length ? ': ' + g.errors.slice(0, 3).join(' / ') : ''));
  await g.context.close();
}

(async () => {
  const browser = await G.launch();
  try {
    let seed = 70;
    for (const size of G.sizesFrom()) {
      const t0 = Date.now();
      const only = G.argOf('only', 'box,swap,hints,big').split(',');
      if (only.includes('box')) await boxRun(browser, size, ++seed); else ++seed;
      if (only.includes('swap')) await swapScene(browser, size, ++seed); else ++seed;
      if (only.includes('hints')) await hints(browser, size, ++seed); else ++seed;
      if (only.includes('big')) await bigMagnets(browser, size, ++seed); else ++seed;
      T.info(`${size.name}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    }
  } finally { await browser.close(); }
  T.done();
})().catch(e => { console.error(e); process.exitCode = 1; });
