#!/usr/bin/env node
'use strict';
// G3 TIPS OVER (DESIGN §18.2–18.4, 18.6, 18.9; revision 5c), through real input at 390x844 and 844x390 (a finger) and
// 1366x1024 (a mouse), on the ?drive clock, against the page's own rules replayed in Node (tools/g3lib.cjs pageRules):
//  - golden cases 14, 15 and 16 built drop by drop with the pointer: every tile goes where the rules put it, the held
//    triangle takes the way the rules choose at its column (there is no FLIP), and the last tile's ghost is the rules'
//    drop: red and dashed, TIPS OVER by it, the held tile red, and the display list carries the part that would tip
//    (its tiles' outlines where they are drawn, the same members, base and side as the rules' tips), the corner it
//    tips over (the rules' pivot) and a plumb line hanging straight down from the part's centre of weight past it;
//  - neither way fits: case 15's ▼ (its ▲ only touches at a point) and a ▲ that tips where its ▼ only touches at a
//    point: the hand shows the way that meets the tower edge to edge, red, with TIPS OVER;
//  - letting go: the press lets go of that drop; the tile stops where the ghost was, the part rocks toward its corner
//    (at least 0.12 rad) and back with the marks kept on it, the tiles outside the part never move, then the tile
//    leaves the wall onto the rug and the build is unchanged;
//  - the hint "Too far out: it would tip. Balance it." comes with the first TIPS OVER, once;
//  - BIG MAGNETS: the magnets pull a tile aimed where it would tip to the place RULES.pull picks, and it lands there.
// No console errors.
//   node clack-stack/tools/tips.cjs [--sizes=390x844,...]
const G = require('./g3lib.cjs');

const T = G.reporter('tips');
const R = G.pageRules();
const HAS_TIPS = R.REASONS.includes('TIPS OVER');
const H3 = Math.sqrt(3) / 2;
// every hint seen but TIPS OVER's, so its hint is the one that can come
const PREFS = { 'clackstack.prefs5': JSON.stringify({ played: true, seenDrop: true, seenWeight: true, seenTri: true, seenOff: true, seenTop: true, seenSway: true, seenTopper: true, seenTips: false }) };
const CASES = [
  { name: 'golden 14: a stair from the car\'s end', drops: ['▲-2.5', '▼-2', '▲-1.5', '▼-1'] },
  { name: 'golden 15: a rhombus hung off a square\'s corner (neither way fits: ▲ a point, ▼ tips)', drops: ['■-2', '▲-1.5', '▼-1'] },
  { name: 'golden 16: a square on a hung ▼\'s top', drops: ['▲-1', '▼-0.5', '■0'] },
  { name: 'neither way fits: ▲ tips, ▼ a point', drops: ['■-2', '▲-1', '▼-0.5', '■-1', '▲-1.5'] },
];
const parse = s => { const m = /^([■▲▼])(-?\d+(?:\.5)?)$/.exec(s); return { piece: m[1] === '■' ? 'sq' : 'tri', way: m[1] === '▲' ? 'up' : m[1] === '▼' ? 'down' : null, col: Math.round(parseFloat(m[2]) * 2) }; };
// world corners of a pose, in the order the game draws its polygon
function worldPoly(type, col, y) {
  const x = col / 2, yb = (y[0] + y[1] * G.R3) / 2;
  if (type === 'sq') return [[x, yb], [x + 1, yb], [x + 1, yb + 1], [x, yb + 1]];
  if (type === 'up') return [[x, yb], [x + 1, yb], [x + 0.5, yb + H3]];
  return [[x + 0.5, yb], [x + 1, yb + H3], [x, yb + H3]];
}
const typeOf = r => r.pose.type === 'down' ? 'dn' : r.pose.type;
const tilePoly = t => worldPoly(t.t, t.c, [2 * t.a, t.b]);
const ptDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// the tower's map from the lattice to the screen, from the tiles as drawn (an affine map: the sway, a landing squash and
// the rock of the car compose to one); with no tile, the car top's
function towerMap(d, B) {
  const W = [], S = [];
  for (const it of d.tiles) {
    const t = B.tiles[it.i];
    if (!t) continue;
    const wp = tilePoly(t);
    for (let k = 0; k < wp.length; k++) { W.push(wp[k]); S.push(it.poly[k]); }
  }
  return W.length >= 3 ? G.fitAffine(W, S) : G.fitSim([[-2, 0], [2, 0]], d.car.top);
}

async function oneSize(browser, size) {
  const g = await G.open(browser, size, { drive: 1, autostart: 1, seed: 5 }, { storage: PREFS });
  const { page, input } = g;
  await page.waitForFunction(() => window.CS && CS.state().phase === 'play');
  await G.wait(page, 0.6);
  const tag = size.name, Y = size.h * 0.55;
  const fail = (m) => T.check(false, `${tag}: ${m}`);
  let hintsSeen = 0;
  // aim the hand at a column with the pointer (a finger: down, then moved there), and give it time to slide over and
  // a triangle time to turn
  const aim = async col => {
    const x = await page.evaluate(c => CS.colToX(c), col);
    await input.aim(x, Y); await G.frame(page); await G.step(page, 11);
    for (let i = 0; i < 6 && (await page.evaluate(() => { const h = CS.display().hand; return !!(h && h.turning); })); i++) await G.step(page, 2);
  };
  const ready = async () => { for (let i = 0; i < 200; i++) { const s = await G.state(page); if (s.phase === 'play' && s.handReady && !s.locked && !s.swapping && !s.inAir && !s.falling) return true; await G.wait(page, 0.05); } return false; };

  for (const C of CASES) {
    const drops = C.drops.map(parse), ok0 = T.n - T.bad;
    let B = R.newBuild({ half: 2 }), bad = 0;
    const f = m => { bad++; fail(`${C.name}: ${m}`); };
    // a bare base, the case's tiles in the box in its order (and a few more after)
    await page.evaluate(sh => { CS.clear(); CS.setPiece(sh[0]); CS.setBox(sh.slice(1).concat(['sq', 'sq', 'sq', 'sq'])); }, drops.map(d => d.piece));
    await G.wait(page, 0.4);
    for (let i = 0; i < drops.length && !bad; i++) {
      const dr = drops[i], last = i === drops.length - 1;
      if (!(await ready())) { f('the hand never came back'); break; }
      await aim(dr.col);
      // (a moment for the tower to settle: the rock of the last landing moves the picture)
      if (last) { await G.wait(page, 1.2); await aim(dr.col); }
      const r = R.drop(B, dr.piece, dr.col);
      const sc = await page.evaluate(() => ({ d: CS.display(), g: CS.ghost(), key: CS.rulesKey(), rel: CS.lastRelease ? CS.lastRelease.id : 0 }));
      const d = sc.d, gh = d.ghost;
      if (R.key(B) !== sc.key) { f(`before drop ${i + 1} the page's build is not the rules' build`); break; }
      if (!d.hand || d.hand.col !== dr.col) { f(`the hand is at column ${d.hand && d.hand.col}, aimed at ${dr.col}`); break; }
      if (dr.piece === 'tri' && (d.hand.way !== r.way || r.way !== dr.way)) { f(`drop ${i + 1}: the held triangle shows ${d.hand.way}, the rules choose ${r.way}, the case has ${dr.way}`); break; }
      if (!gh || gh.col !== r.pose.col || gh.way !== r.way || gh.y[0] !== r.pose.y[0] || gh.y[1] !== r.pose.y[1] || gh.style !== (r.outcome === 'fit' ? 'fit' : 'off')) { f(`drop ${i + 1}: the ghost ${JSON.stringify(gh && { col: gh.col, way: gh.way, y: gh.y, style: gh.style })} is not the rules' drop (${r.outcome} ${r.way} ${r.pose.col} ${r.pose.y})`); break; }
      if (!last) {
        if (r.outcome !== 'fit') { f(`drop ${i + 1} (${C.drops[i]}) does not fit: ${r.reason}`); break; }
        await input.release(); await G.frame(page);
        B = R.place(B, r);
        await G.wait(page, 0.7);
        continue;
      }
      // the last tile: TIPS OVER, as the rules have it
      if (r.reason !== 'TIPS OVER' || !r.tips) { f(`the last tile is ${r.outcome} ${r.reason}, not TIPS OVER`); break; }
      const tp = r.tips, M = towerMap(d, B), mk = gh.marks || {};
      if (!gh.dashed || gh.color !== 'red' || gh.reason !== 'TIPS OVER' || !gh.reasonLabel || gh.reasonLabel.text !== 'TIPS OVER') f(`the ghost is ${gh.color}${gh.dashed ? ' dashed' : ''}, its reason ${gh.reason}`);
      if (!d.hand.red) f('the held tile is not red');
      if (sc.g.reason !== 'TIPS OVER' || JSON.stringify(sc.g.tips.members) !== JSON.stringify(tp.members)) f('the hand\'s own ghost is not the rules\' TIPS OVER');
      // the part: its members, base and side as the rules say; each tile's outline where it is drawn
      if (JSON.stringify(mk.members) !== JSON.stringify(tp.members) || mk.base !== tp.base || mk.side !== tp.side) f(`the marks name ${JSON.stringify({ members: mk.members, base: mk.base, side: mk.side })}, the rules ${JSON.stringify({ members: tp.members, base: tp.base, side: tp.side })}`);
      const wps = tp.members.map(k => (k < B.tiles.length ? tilePoly(B.tiles[k]) : worldPoly(typeOf(r), r.pose.col, r.pose.y)));
      const partD = !mk.part || mk.part.length !== wps.length ? Infinity : Math.max(...wps.map((wp, k) => G.polyDist(wp.map(M.map), mk.part[k])));
      // the corner and the plumb line: from the part's centre of weight (a square weighs 1, a triangle √3/4), straight
      // down the screen, past the corner
      let W = 0, cx = 0, cy = 0;
      for (const wp of wps) { const w = wp.length === 4 ? 1 : G.R3 / 4; W += w; cx += w * wp.reduce((s, p) => s + p[0], 0) / wp.length; cy += w * wp.reduce((s, p) => s + p[1], 0) / wp.length; }
      const pv = M.map(G.ptOf(tp.pivot)), top = M.map([tp.com, cy / W]);
      const pvD = mk.pivot ? ptDist(pv, mk.pivot) : Infinity, topD = mk.plumb ? ptDist(top, mk.plumb[0]) : Infinity;
      const plumbOk = mk.plumb && Math.abs(mk.plumb[0][0] - mk.plumb[1][0]) < 0.2 && mk.plumb[1][1] > pv[1];
      if (Math.abs(cx / W - tp.com) > 1e-6) f(`the rules' com ${tp.com} is not the part's centre of weight ${cx / W}`);
      if (partD > 1 || pvD > 1.5 || topD > 1.5 || !plumbOk) f(`TIPS OVER marks: the part ${(mk.part || []).length}/${wps.length} (${partD.toFixed(1)} px), the corner ${pvD.toFixed(1)} px off, the plumb line's top ${topD.toFixed(1)} px off${plumbOk ? '' : ', not hanging straight past the corner'}`);
      // let go
      const tiles0 = d.tiles.map(t => ({ i: t.i, poly: t.poly })), lost0 = (await G.state(page)).lost, ev0 = await page.evaluate(() => CS.events.length);
      await input.release(); await G.frame(page);
      const rel = await page.evaluate(() => CS.lastRelease);
      if (!rel || rel.id === sc.rel || rel.key !== gh.key || rel.outcome !== 'off' || rel.reason !== 'TIPS OVER') { f(`the press let go of ${JSON.stringify(rel && { key: rel.key, outcome: rel.outcome, reason: rel.reason })}, the ghost showed ${gh.key}`); break; }
      // the rock: watch it frame by frame
      let maxA = 0, rockFrames = 0, marksOn = 0, movedIn = 0, movedOut = 0, marksOff = 0, stages = new Set(), leftAt = -1;
      for (let k = 0; k < 120; k++) {
        await G.step(page, 2);
        const q = await G.display(page), fl = q.falling.find(x => x.outcome === 'off');
        if (fl) stages.add(fl.stage);
        if (!fl && stages.size) { leftAt = k; break; }
        if (!fl || fl.stage !== 'rock') continue;
        rockFrames++;
        const rm = q.rockMarks, a = rm ? Math.abs(rm.a) : 0;
        maxA = Math.max(maxA, a);
        if (rm && JSON.stringify(rm.members) === JSON.stringify(tp.members) && rm.part.length === tp.members.length && rm.pivot && rm.plumb) marksOn++;
        if (a > 0.05) {
          for (const t of q.tiles) {
            const t0 = tiles0.find(u => u.i === t.i), dd = t0 ? G.polyDist(t0.poly, t.poly) : 0;
            if (tp.members.includes(t.i)) { if (dd > 2) movedIn++; } else if (dd > 0.6) movedOut++;
          }
          // (the marks go with the part: its outlines are the tiles as drawn)
          for (let m = 0; rm && m < tp.members.length; m++) {
            const t = q.tiles.find(u => u.i === tp.members[m]);
            if (t && G.polyDist(t.poly, rm.part[m]) > 1.2) marksOff++;
          }
        }
      }
      const after = await page.evaluate(() => ({ s: CS.state(), d: CS.display(), key: CS.rulesKey() }));
      const back = Math.max(0, ...after.d.tiles.map(t => { const t0 = tiles0.find(u => u.i === t.i); return t0 ? G.polyDist(t0.poly, t.poly) : 99; }));
      if (!stages.has('rock') || maxA < 0.12 || marksOn < rockFrames || movedIn === 0 || movedOut > 0 || marksOff > 0) f(`the rock: stages ${[...stages].join(',')}, at most ${maxA.toFixed(3)} rad, the marks on it in ${marksOn}/${rockFrames} frames (${marksOff} off the part), the part's tiles moved in ${movedIn} pictures, the others in ${movedOut}`);
      if (leftAt < 0 || after.s.lost !== lost0 + 1 || after.key !== sc.key || back > 0.6) f(`after the rock: left the wall ${leftAt >= 0}, lost ${lost0} -> ${after.s.lost}, the build ${after.key === sc.key ? 'unchanged' : 'CHANGED'}, the tiles ${back.toFixed(1)} px from where they were`);
      T.info(`${tag} ${C.name.split(':')[0]}: part ${tp.members.length} tiles (${partD.toFixed(2)} px), corner ${pvD.toFixed(2)} px, plumb ${topD.toFixed(2)} px; the rock ${rockFrames} pictures, up to ${maxA.toFixed(3)} rad, marks on it in ${marksOn}, the part's tiles moved in ${movedIn}, the others in ${movedOut}; left the wall after ${leftAt} pictures`);
      // the hint: with the first TIPS OVER, once
      for (let k = 0; k < 40 && !(await page.evaluate(() => CS.events.some(e => e.type === 'tip' && e.id === 'tips'))); k++) await G.wait(page, 0.1);
      const hint = await page.evaluate(n => ({ ev: CS.events.filter(e => e.type === 'tip' && e.id === 'tips').length, box: CS.tipBox(), d: CS.display().hint, off: CS.events.slice(n).filter(e => e.type === 'off').map(e => e.reason) }), ev0);
      hintsSeen = hint.ev;
      if (hint.ev !== 1) f(`the TIPS OVER hint came ${hint.ev} times`);
      if (C === CASES[0] && (!hint.box || hint.box.text !== 'Too far out: it would tip. Balance it.' || !hint.d || hint.d.text !== hint.box.text)) f(`the first TIPS OVER's hint: ${JSON.stringify(hint.box)}`);
      if (hint.off.join() !== 'TIPS OVER') f(`the off events: ${hint.off.join()}`);
      await G.wait(page, 1.5);
    }
    T.check(!bad && T.n - T.bad === ok0, `${tag}: ${C.name}: ${C.drops.join(' ')} through real ${size.touch ? 'touch' : 'mouse'}: ${bad ? 'FAILED' : 'every ghost the rules\' drop; TIPS OVER with its part, corner and plumb line as the rules have them; let go, the part rocked and the tile left the wall'}`);
  }
  T.check(hintsSeen === 1, `${tag}: "Too far out: it would tip. Balance it." came once in ${CASES.length} TIPS OVER drops`);
  T.check(g.errors.length === 0, `${tag}: no console errors` + (g.errors.length ? ': ' + g.errors.slice(0, 3).join(' / ') : ''));
  await g.context.close();

  // BIG MAGNETS: aimed where it would tip, the magnets pull it to the nearest place it fits (RULES.pull), and it lands
  // there
  const b = await G.open(browser, size, { drive: 1, autostart: 1, seed: 5, big: 1, nohint: 1 }, {});
  try {
    await b.page.waitForFunction(() => window.CS && CS.state().phase === 'play');
    await b.page.evaluate(() => CS.wait(0.6));
    let pulled = 0, n = 0;
    for (const C of CASES) {
      const drops = C.drops.map(parse), last = drops[drops.length - 1];
      await b.page.evaluate(sh => { CS.clear(); CS.setPiece(sh[0]); CS.setBox(sh.slice(1).concat(['sq', 'sq'])); }, drops.map(d => d.piece));
      await G.wait(b.page, 0.4);
      let B = R.newBuild({ half: 2 }), ok = true;
      for (let i = 0; i < drops.length && ok; i++) {
        const dr = drops[i];
        for (let k = 0; k < 100 && !(await b.page.evaluate(() => { const s = CS.state(); return s.handReady && !s.locked && !s.inAir; })); k++) await G.wait(b.page, 0.05);
        const x = await b.page.evaluate(c => CS.colToX(c), dr.col);
        await b.input.aim(x, Y); await G.frame(b.page); await G.step(b.page, 11);
        const r = R.pull(B, dr.piece, dr.col), d = await G.display(b.page), gh = d.ghost;
        if (!gh || gh.col !== r.pose.col || gh.way !== r.way || gh.y[0] !== r.pose.y[0] || gh.y[1] !== r.pose.y[1] || gh.style !== (r.outcome === 'fit' ? 'fit' : 'off')) { ok = false; fail(`BIG MAGNETS ${C.name} drop ${i + 1}: the ghost ${JSON.stringify(gh && { col: gh.col, way: gh.way, y: gh.y, style: gh.style })} is not RULES.pull's (${r.outcome} ${r.way} ${r.pose.col})`); break; }
        if (i === drops.length - 1) {
          n++;
          const here = R.drop(B, dr.piece, dr.col);
          if (here.reason !== 'TIPS OVER' || r.outcome !== 'fit' || r.pose.col === dr.col) { ok = false; fail(`BIG MAGNETS ${C.name}: aimed where it tips (${here.reason}), the pull ${r.outcome} at ${r.pose.col}`); break; }
          const id0 = await b.page.evaluate(() => CS.lastRelease ? CS.lastRelease.id : 0);
          await b.input.release(); await G.frame(b.page); await G.wait(b.page, 0.8);
          const ev = await b.page.evaluate(i => { const rel = CS.lastRelease; return { rel, land: CS.events.find(e => e.type === 'land' && rel && e.id === rel.id) }; }, id0);
          if (!ev.rel || ev.rel.id === id0 || ev.rel.key !== gh.key || !ev.land || ev.land.key !== gh.key) { ok = false; fail(`BIG MAGNETS ${C.name}: it did not land where the pull showed: ${JSON.stringify(ev)}`); }
          else pulled++;
        } else {
          await b.input.release(); await G.frame(b.page); await G.wait(b.page, 0.7);
          B = R.place(B, R.drop(B, dr.piece, dr.col));
        }
      }
    }
    T.check(pulled === n && n === CASES.length, `${tag}: BIG MAGNETS: aimed where it would tip, the magnets pulled it to RULES.pull's place and it landed there: ${pulled}/${n}`);
    T.check(b.errors.length === 0, `${tag}: BIG MAGNETS: no console errors` + (b.errors.length ? ': ' + b.errors.slice(0, 3).join(' / ') : ''));
  } finally { await b.context.close(); }
}

(async () => {
  if (!HAS_TIPS) { console.log(`rules: ${R.REASONS.join(', ')}: no TIPS OVER in these rules; nothing to test`); T.check(false, 'the page\'s rules have TIPS OVER'); T.done(); return; }
  const browser = await G.launch();
  try {
    for (const size of G.sizesFrom()) await oneSize(browser, size);
  } finally { await browser.close(); }
  T.done();
})().catch(e => { console.error(e); process.exitCode = 1; });
