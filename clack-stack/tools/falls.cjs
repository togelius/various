#!/usr/bin/env node
'use strict';
// G3 falls (DESIGN §18.2: "a tile that falls off ... tips a little about the point it touched (or, for TIPS OVER, the
// part under it rocks toward its corner and back), then falls out of the wall toward you and lands flat on the rug"):
// every tile that falls off lands on the side it tipped to. Through real input at 390x844, 844x390 (a finger) and
// 1366x1024 (a mouse), on the ?drive clock, each fall is filmed frame by frame from the display list and CS.debris():
//  - the side it tips to, as drawn: ONLY A POINT, the turn of the falling tile about the point it touched (its middle
//    off that point: to the side its middle is on); TIPS OVER, the rock of the part (rockMarks.a) and the rules' side;
//  - it leaves the wall and comes to rest on the rug, out of play (asleep, a lost piece of the mess);
//  - where it rests, on the screen, is on that side of where it touched: never back across it (the review's G20, G05B
//    and G22B: a tile that tipped right lay well to the left, slid there to keep the parked base clear).
// The falls: points and tips, toward the car's middle and out past its ends, each mirrored; the landscape phone's thin
// rug in front of the car is where a fallen tile has to slide out sideways. No console errors.
//   node clack-stack/tools/falls.cjs [--sizes=...]
const G = require('./g3lib.cjs');

const T = G.reporter('falls');
const R = G.pageRules();
const HAS_TIPS = R.REASONS.includes('TIPS OVER');
// every hint seen (none comes up over the rug)
const PREFS = { 'clackstack.prefs5': JSON.stringify({ played: true, seenDrop: true, seenWeight: true, seenTri: true, seenOff: true, seenTop: true, seenSway: true, seenTopper: true, seenTips: true }) };
// [build, the tile let go, what the rules say]
const CASES = [
  { name: 'a square on a ▲\'s apex past the car\'s left end, tipping toward the middle', build: ['▲-2.5'], drop: '■-2', reason: 'ONLY A POINT' },
  { name: 'its mirror image', build: ['▲1.5'], drop: '■1', reason: 'ONLY A POINT' },
  { name: 'a square on a ▲\'s apex, tipping out to the left', build: ['▲-1.5'], drop: '■-2', reason: 'ONLY A POINT' },
  { name: 'its mirror image', build: ['▲0.5'], drop: '■1', reason: 'ONLY A POINT' },

  { name: 'golden 10: a ▲ on a ▲\'s point', build: ['▲0'], drop: '▲0', reason: 'ONLY A POINT' },
  { name: 'golden 16: a square on a hung ▼\'s top, the part tipping right', build: ['▲-1', '▼-0.5'], drop: '■0', reason: 'TIPS OVER' },
  { name: 'its mirror image, tipping left', build: ['▲0', '▼-0.5'], drop: '■-1', reason: 'TIPS OVER' },
  { name: 'golden 14: a stair from the car\'s end', build: ['▲-2.5', '▼-2', '▲-1.5'], drop: '▼-1', reason: 'TIPS OVER' },
  { name: 'golden 15: a rhombus hung off a square\'s corner', build: ['■-2', '▲-1.5'], drop: '▼-1', reason: 'TIPS OVER' },
  { name: 'its mirror image', build: ['■1', '▲0.5'], drop: '▼0', reason: 'TIPS OVER' },
];
const parse = s => { const m = /^([■▲▼])(-?\d+(?:\.5)?)$/.exec(s); return { piece: m[1] === '■' ? 'sq' : 'tri', way: m[1] === '▲' ? 'up' : m[1] === '▼' ? 'down' : null, col: Math.round(parseFloat(m[2]) * 2) }; };

async function oneSize(browser, size) {
  const g = await G.open(browser, size, { drive: 1, autostart: 1, seed: 5 }, { storage: PREFS });
  const { page, input } = g;
  const tag = size.name, Y = size.h * 0.55;
  await page.waitForFunction(() => window.CS && CS.state().phase === 'play');
  await G.wait(page, 0.6);
  const ready = async () => { for (let i = 0; i < 200; i++) { const s = await G.state(page); if (s.phase === 'play' && s.handReady && !s.locked && !s.swapping && !s.inAir && !s.falling) return true; await G.wait(page, 0.05); } return false; };
  let falls = 0;
  for (const C of CASES) {
    if (C.reason === 'TIPS OVER' && !HAS_TIPS) continue;
    const dr = parse(C.drop);
    const fail = m => T.check(false, `${tag}: ${C.name} (${C.build.join(' ')}, then ${C.drop}): ${m}`);
    // the rules' answer, on the build made from the case's drops
    let B = R.newBuild({ half: 2 });
    for (const s of C.build) { const p = parse(s), r = R.drop(B, p.piece, p.col, p.piece === 'tri' ? p.way : undefined); B = R.place(B, r); }
    const r = R.drop(B, dr.piece, dr.col, dr.piece === 'tri' ? dr.way : undefined);
    if (r.outcome !== 'off' || r.reason !== C.reason) { fail(`the rules say ${r.outcome} ${r.reason || ''}, not ${C.reason}`); continue; }
    await page.evaluate(([b, p]) => { CS.clear(); CS.build(b); CS.setPiece(p); CS.setBox(['sq', 'sq', 'sq', 'tri', 'sq']); }, [C.build, dr.piece]);
    if (!(await ready())) { fail('the hand never came back'); continue; }
    // (the mess so far stays where it is: only this fall's piece is followed)
    const x = await page.evaluate(c => CS.colToX(c), dr.col);
    await input.aim(x, Y); await G.frame(page); await G.step(page, 11);
    for (let i = 0; i < 6 && (await page.evaluate(() => { const h = CS.display().hand; return !!(h && h.turning); })); i++) await G.step(page, 2);
    const gh = (await G.display(page)).ghost;
    if (!gh || gh.style !== 'off' || gh.reason !== C.reason) { fail(`the ghost says ${gh && gh.style} ${gh && gh.reason}`); continue; }
    await input.release(); await G.frame(page);
    const rel = await page.evaluate(() => CS.lastRelease);
    if (!rel || rel.outcome !== 'off') { fail(`the release: ${JSON.stringify(rel)}`); continue; }
    // film it: the tile falling to where it stops, its tip (or the part's rock), then the piece on the rug
    let touchX = null, rot0 = null, turn = 0, rockA = 0, left = false, deb = null, frames = 0, stages = new Set();
    for (let k = 0; k < 600; k++) {
      await G.step(page, 2);
      frames++;
      // (a new base starts the release ids over: the mess from the cases before may hold a piece with the same id, so
      // the newest piece with it, the last in the list, is this one)
      const q = await page.evaluate(id => { const d = CS.display(); return { f: d.falling.find(o => o.outcome === 'off' && o.id === id) || null, rm: d.rockMarks, deb: CS.debris().filter(p => p.off === id).pop() || null }; }, rel.id);
      if (q.f) {
        stages.add(q.f.stage);
        if (q.f.stage !== 'fall') {
          if (touchX === null) { touchX = q.f.x; rot0 = q.f.rot; }
          const dr2 = q.f.rot - rot0;
          if (Math.abs(dr2) > Math.abs(turn)) turn = dr2;
          if (q.rm && Math.abs(q.rm.a) > Math.abs(rockA)) rockA = q.rm.a;
        }
        continue;
      }
      if (stages.size) left = true;
      if (q.deb) { deb = q.deb; if (q.deb.sleep) break; }
    }
    if (!left || !deb) { fail(`it never left the wall onto the rug (stages ${[...stages].join(',')}, ${deb ? 'on the rug' : 'no piece on the rug'})`); continue; }
    if (!deb.sleep) { fail(`it never came to rest on the rug in ${(frames / 60).toFixed(1)} s`); continue; }
    // the side it tipped to, as drawn: TIPS OVER the part's rock (and the rules' side); else the tile's own turn about
    // the point it touched (clockwise on the screen: to the right)
    const side = C.reason === 'TIPS OVER' ? Math.sign(rockA) : Math.sign(turn);
    if (C.reason === 'TIPS OVER' && side !== (r.tips.side === 'right' ? 1 : -1)) { fail(`the part rocked ${side > 0 ? 'right' : 'left'}, the rules tip it ${r.tips.side}`); continue; }
    if (!side) { fail('it did not turn as it tipped'); continue; }
    const dx = deb.sx - touchX, ok = Math.sign(dx) === side && Math.abs(dx) > 2;
    falls++;
    T.check(ok, `${tag}: ${C.name} (${C.build.join(' ')}, then ${C.drop}, ${C.reason}): tipped ${side > 0 ? 'right' : 'left'} (${C.reason === 'TIPS OVER' ? 'the part ' + rockA.toFixed(3) : 'the tile ' + turn.toFixed(3)} rad), and lies ${Math.abs(dx).toFixed(0)} px to the ${dx > 0 ? 'right' : 'left'} of where it touched` + (ok ? '' : ': ON THE OTHER SIDE'));
    await G.wait(page, 0.3);
  }
  T.check(g.errors.length === 0, `${tag}: no console errors` + (g.errors.length ? ': ' + g.errors.slice(0, 3).join(' / ') : ''));
  T.info(`${tag}: ${falls} falls filmed`);
  await g.context.close();
}

(async () => {
  const browser = await G.launch();
  try {
    for (const size of G.sizesFrom()) await oneSize(browser, size);
  } finally { await browser.close(); }
  T.done();
})().catch(e => { console.error(e); process.exitCode = 1; });
