#!/usr/bin/env node
'use strict';
// G3 TIPS OVER (DESIGN §18.2–18.4, 18.6, 18.9; revision 5d: whole edges lock, the reported part is the whole group of
// a locked piece), through real input at 390x844 and 844x390 (a finger) and 1366x1024 (a mouse), on the ?drive clock,
// against the page's own rules replayed in Node (tools/g3lib.cjs pageRules):
//  - golden cases 14, 15, 16 and 18 built drop by drop with the pointer: every tile goes where the rules put it, the
//    held triangle takes the way the rules choose at its column (there is no FLIP), and the last tile's ghost is the
//    rules' drop: red and dashed, TIPS OVER by it, the held tile red, and the display list carries the part that would
//    tip (its tiles' outlines where they are drawn, the same members, base and side as the rules' tips), the corner it
//    tips over (the rules' pivot) and a plumb line hanging straight down from the part's centre of weight past it.
//    The part is whole pieces: no tile in it shares a whole edge with a tile outside it. Golden case 18 tips right,
//    over the corner of the square under it, its weight 0.014 L past it;
//  - golden case 17 (four triangles locked into one piece, a square half on its top): it stays, as the rules say;
//    the ghost white, no reason, and the square lands where the ghost was;
//  - neither way fits: case 15's ▼ (its ▲ only touches at a point) and a ▲ that tips where its ▼ only touches at a
//    point: the hand shows the way that meets the tower edge to edge, red, with TIPS OVER;
//  - letting go: the press lets go of that drop; the tile stops where the ghost was, the part rocks toward its corner
//    (at least 0.12 rad) and back as one rigid body with the marks kept on it, every whole-edge joint in the tower stays
//    closed in every picture, the tiles outside the part never move, then the tile leaves the wall onto the rug and the
//    build is unchanged;
//  - a tile let go during the rock that lands on the part locked to it along a whole edge (golden case 18, then a ▲
//    squarely on the part's top square): it lands while the part rocks and rocks with it, its joint never opening;
//  - while the hand is aimed where the tile would TIPS OVER, the part that would tip rocks toward its corner and back on
//    a loop (the aimRock layer: the rules' members, each outline turned about the rules' pivot toward its side, at least
//    0.12 rad at the most), the tiles themselves never moving;
//  - the hint "Too far out: it would tip the tiles under it." comes once the ghost has shown the first TIPS OVER for
//    0.5 s while aiming (before anything falls), once in all;
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
const G18 = ['■-2', '▲-1.5', '▼-2', '■-2', '▲-2.5', '▼-1', '■-1', '■-1'];
// fits: the last tile stays (no TIPS OVER); want: what DESIGN §18.9 says of the tip (its side, the lattice point it tips
// over, how far past it the weight is, in L; its members); then: a tile let go while the part rocks, locked to it
const CASES = [
  { name: 'golden 14: a stair from the car\'s end', drops: ['▲-2.5', '▼-2', '▲-1.5', '▼-1'] },
  { name: 'golden 15: a rhombus hung off a square\'s corner (neither way fits: ▲ a point, ▼ tips)', drops: ['■-2', '▲-1.5', '▼-1'] },
  { name: 'golden 16: a square on a hung ▼\'s top', drops: ['▲-1', '▼-0.5', '■0'] },
  { name: 'neither way fits: ▲ tips, ▼ a point', drops: ['■-2', '▲-1', '▼-0.5', '■-1', '▲-1.5'] },
  { name: 'golden 17: four triangles locked into one piece, a square half on its top (stays; 5c tipped it)', drops: ['▲0.5', '▼0', '▲0', '▼0.5', '■1'], fits: true },
  { name: 'golden 18: a block of locked tiles on half a square\'s top and a point (5c\'s grip kept it)', drops: G18,
    want: { side: 'right', pivot: [-2, 2, 0], past: 0.014, members: [1, 2, 3, 4, 5, 6, 7] } },
  { name: 'golden 18, then a ▲ let go during the rock, squarely on the part\'s top square', drops: G18, then: '▲-1' },
];
const TIPS_CASES = CASES.filter(C => !C.fits && !C.then);
const parse = s => { const m = /^([■▲▼])(-?\d+(?:\.5)?)$/.exec(s); return { piece: m[1] === '■' ? 'sq' : 'tri', way: m[1] === '▲' ? 'up' : m[1] === '▼' ? 'down' : null, col: Math.round(parseFloat(m[2]) * 2) }; };
// world corners of a pose, in the order the game draws its polygon
function worldPoly(type, col, y) {
  const x = col / 2, yb = (y[0] + y[1] * G.R3) / 2;
  if (type === 'sq') return [[x, yb], [x + 1, yb], [x + 1, yb + 1], [x, yb + 1]];
  if (type === 'up') return [[x, yb], [x + 1, yb], [x + 0.5, yb + H3]];
  return [[x + 0.5, yb], [x + 1, yb + H3], [x, yb + H3]];
}
// the same corners on the lattice ([X, p, q]: x = X/2, y = (p + q·√3)/2), exact
function latPoly(type, col, y) {
  const c = col, p = y[0], q = y[1];
  if (type === 'sq') return [[c, p, q], [c + 2, p, q], [c + 2, p + 2, q], [c, p + 2, q]];
  if (type === 'up') return [[c, p, q], [c + 2, p, q], [c + 1, p, q + 1]];
  return [[c + 1, p, q], [c + 2, p, q + 1], [c, p, q + 1]];
}
const typeOf = r => r.pose.type === 'down' ? 'dn' : r.pose.type;
const tilePoly = t => worldPoly(t.t, t.c, [2 * t.a, t.b]);
const tileLat = t => latPoly(t.t, t.c, [2 * t.a, t.b]);
const ptDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const same = (u, v) => u[0] === v[0] && u[1] === v[1] && u[2] === v[2];
// The whole-edge joints among tiles (lattice polygons by index; a gap in the list is a tile not there): tiles that share
// a whole edge are locked by their magnets (§18.2). Each joint: {i, j, k: [[corner of i, the same corner of j] × 2]}
function joints(lps) {
  const out = [];
  for (let i = 0; i < lps.length; i++) for (let j = i + 1; j < lps.length; j++) {
    const A = lps[i], B = lps[j];
    if (!A || !B) continue;
    for (let a = 0; a < A.length; a++) for (let b = 0; b < B.length; b++) {
      const a1 = (a + 1) % A.length, b1 = (b + 1) % B.length;
      if (same(A[a], B[b1]) && same(A[a1], B[b])) out.push({ i, j, k: [[a, b1], [a1, b]] });
      else if (same(A[a], B[b]) && same(A[a1], B[b1])) out.push({ i, j, k: [[a, b], [a1, b1]] });
    }
  }
  return out;
}
// how far apart the two sides of each joint are drawn (px): the largest, over the joints whose tiles are both drawn
function jointGap(d, J) {
  let worst = 0, at = null;
  for (const jt of J) {
    const ti = d.tiles.find(u => u.i === jt.i), tj = d.tiles.find(u => u.i === jt.j);
    if (!ti || !tj) continue;
    for (const [ka, kb] of jt.k) { const g = ptDist(ti.poly[ka], tj.poly[kb]); if (g > worst) { worst = g; at = jt; } }
  }
  return { worst, at };
}
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
// the tiles `idx` as drawn, fitted with one affine map from where the rules put them (wps: their world polygons by
// index): the largest miss in px (how far they are from moving as one rigid body)
function oneBody(d, idx, wps) {
  const W = [], S = [];
  for (const i of idx) {
    const t = d.tiles.find(u => u.i === i);
    if (!t || !wps[i]) continue;
    for (let k = 0; k < wps[i].length; k++) { W.push(wps[i][k]); S.push(t.poly[k]); }
  }
  if (W.length < 3) return 0;
  const M = G.fitAffine(W, S);
  return M ? M.resid : Infinity;
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
    const drops = C.drops.map(parse), ok0 = T.n - T.bad, then = C.then ? parse(C.then) : null;
    let B = R.newBuild({ half: 2 }), bad = 0;
    const f = m => { bad++; fail(`${C.name}: ${m}`); };
    // a bare base, the case's tiles in the box in its order (then the tile let go during the rock, and a few more)
    await page.evaluate(sh => { CS.clear(); CS.setPiece(sh[0]); CS.setBox(sh.slice(1)); }, drops.map(d => d.piece).concat(then ? [then.piece] : []).concat(['sq', 'sq', 'sq', 'sq']));
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
      if (C.fits) {
        // the last tile stays: a white ghost with no reason and no marks, the held tile plain; it lands where the ghost was
        if (r.outcome !== 'fit' || r.tips) { f(`the last tile is ${r.outcome} ${r.reason}, not a fit`); break; }
        if (gh.dashed || gh.color === 'red' || gh.reason || gh.reasonLabel || (gh.marks && (gh.marks.part || []).length)) f(`the ghost is ${gh.color}${gh.dashed ? ' dashed' : ''}, its reason ${gh.reason}, ${gh.marks ? 'with marks' : 'no marks'}`);
        if (d.hand.red) f('the held tile is red');
        if (sc.g.outcome !== 'fit' || sc.g.tips) f('the hand\'s own ghost is not the rules\' fit');
        const lost0 = (await G.state(page)).lost;
        await input.release(); await G.frame(page);
        const rel = await page.evaluate(() => CS.lastRelease);
        if (!rel || rel.id === sc.rel || rel.key !== gh.key || rel.outcome !== 'fit') { f(`the press let go of ${JSON.stringify(rel && { key: rel.key, outcome: rel.outcome })}, the ghost showed ${gh.key}`); break; }
        await G.wait(page, 0.8);
        const after = await page.evaluate(id => ({ s: CS.state(), key: CS.rulesKey(), land: CS.events.find(e => e.type === 'land' && e.id === id) }), rel.id);
        B = R.place(B, r);
        if (!after.land || after.land.key !== gh.key || after.key !== R.key(B) || after.s.lost !== lost0) f(`it did not land where the ghost was: ${JSON.stringify({ land: after.land && after.land.key, ghost: gh.key, build: after.key === R.key(B), lost: [lost0, after.s.lost] })}`);
        T.info(`${tag} ${C.name.split(':')[0]}: the ${C.drops[i]} stays as the rules say (half on the piece's top), the ghost white, it landed where the ghost was`);
        break;
      }
      // the last tile: TIPS OVER, as the rules have it
      if (r.reason !== 'TIPS OVER' || !r.tips) { f(`the last tile is ${r.outcome} ${r.reason}, not TIPS OVER`); break; }
      const tp = r.tips, M = towerMap(d, B), mk = gh.marks || {}, n = B.tiles.length;
      if (!gh.dashed || gh.color !== 'red' || gh.reason !== 'TIPS OVER' || !gh.reasonLabel || gh.reasonLabel.text !== 'TIPS OVER') f(`the ghost is ${gh.color}${gh.dashed ? ' dashed' : ''}, its reason ${gh.reason}`);
      if (!d.hand.red) f('the held tile is not red');
      if (sc.g.reason !== 'TIPS OVER' || JSON.stringify(sc.g.tips.members) !== JSON.stringify(tp.members)) f('the hand\'s own ghost is not the rules\' TIPS OVER');
      // what §18.9 says of this case
      if (C.want) {
        const w = C.want, past = (w.side === 'right' ? 1 : -1) * (tp.com - w.pivot[0] / 2);
        if (tp.side !== w.side || JSON.stringify(tp.pivot) !== JSON.stringify(w.pivot) || Math.abs(past - w.past) > 0.0005 || (w.members && JSON.stringify(tp.members) !== JSON.stringify(w.members)))
          f(`the rules' tip ${JSON.stringify({ side: tp.side, pivot: tp.pivot, past: +past.toFixed(4), members: tp.members })} is not §18.9's ${JSON.stringify(w)}`);
      }
      // the part is whole pieces: no whole-edge joint between a tile in it and one outside it (§18.2: whole edges lock)
      const lps = B.tiles.map(tileLat).concat([latPoly(typeOf(r), r.pose.col, r.pose.y)]), J = joints(lps);
      const broken = J.filter(jt => tp.members.includes(jt.i) !== tp.members.includes(jt.j));
      if (broken.length) f(`the part ${JSON.stringify(tp.members)} breaks the whole-edge joints ${broken.map(jt => jt.i + '-' + jt.j).join(', ')}`);
      // the part: its members, base and side as the rules say; each tile's outline where it is drawn
      if (JSON.stringify(mk.members) !== JSON.stringify(tp.members) || mk.base !== tp.base || mk.side !== tp.side) f(`the marks name ${JSON.stringify({ members: mk.members, base: mk.base, side: mk.side })}, the rules ${JSON.stringify({ members: tp.members, base: tp.base, side: tp.side })}`);
      const wps = tp.members.map(k => (k < n ? tilePoly(B.tiles[k]) : worldPoly(typeOf(r), r.pose.col, r.pose.y)));
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
      // aimed here, the part rocks on a loop: its outlines turned about the corner toward its side, the tiles still
      {
        let maxA = 0, rockD = 0, n0 = 0, moved = 0, wrongSide = 0;
        const turn = (p, a) => { const dx = p[0] - pvW[0], dy = p[1] - pvW[1], c = Math.cos(a), s = Math.sin(a); return [pvW[0] + dx * c + dy * s, pvW[1] - dx * s + dy * c]; };
        const pvW = G.ptOf(tp.pivot);
        // (a little over one loop: 24 pictures 0.05 s apart; the loop is ROCK_T + AIM_ROCK_REST, 1.05 s. The fuse is held
        // while the test looks: it would let go of the tile 3 s after it came, less on a taller tower)
        await page.evaluate(() => { HAND.fuseT = 0; HAND.fuseMarks = 0; });
        for (let k = 0; k < 24; k++) {
          await G.step(page, 6);
          const q = await G.display(page), ar = q.aimRock;
          for (const t of q.tiles) { const t0 = d.tiles.find(u => u.i === t.i); if (t0 && G.polyDist(t0.poly, t.poly) > 0.6) moved++; }
          if (!ar) continue;
          n0++;
          maxA = Math.max(maxA, Math.abs(ar.a));
          if (JSON.stringify(ar.members) !== JSON.stringify(tp.members) || ar.side !== tp.side || Math.sign(ar.a) !== (tp.side === 'right' ? 1 : -1)) wrongSide++;
          else rockD = Math.max(rockD, ...wps.map((wp, m) => G.polyDist(wp.map(p => M.map(turn(p, ar.a))), ar.polys[m])));
        }
        if (n0 < 6 || maxA < 0.12 || rockD > 1.5 || wrongSide || moved) f(`aimed where it tips, the part rocks: in ${n0}/24 pictures, up to ${maxA.toFixed(3)} rad, ${rockD.toFixed(1)} px from the rules' part turned about its corner, ${wrongSide} the wrong part or side, the tiles moved in ${moved}`);
        else T.info(`${tag} ${C.name.split(':')[0]}: aimed, the part rocks on a loop (in ${n0}/24 pictures, up to ${maxA.toFixed(3)} rad, the outlines within ${rockD.toFixed(2)} px of the rules' part turned about its corner; the tiles still)`);
      }
      // the hint comes from the aimed ghost (it has shown TIPS OVER for well over 0.5 s), before anything falls
      if (C === CASES[0]) {
        const ah = await page.evaluate(() => ({ ev: CS.events.filter(e => e.type === 'tip' && e.id === 'tips').length, box: CS.tipBox(), d: CS.display().hint, off: CS.events.filter(e => e.type === 'off').length }));
        if (ah.ev !== 1 || !ah.box || ah.box.text !== 'Too far out: it would tip the tiles under it.' || !ah.d || ah.d.text !== ah.box.text || ah.off) f(`aimed where it tips, its hint: ${JSON.stringify(ah)}`);
      }
      // let go
      const tiles0 = d.tiles.map(t => ({ i: t.i, poly: t.poly })), lost0 = (await G.state(page)).lost, ev0 = await page.evaluate(() => CS.events.length);
      await input.release(); await G.frame(page);
      const rel = await page.evaluate(() => CS.lastRelease);
      if (!rel || rel.id === sc.rel || rel.key !== gh.key || rel.outcome !== 'off' || rel.reason !== 'TIPS OVER') { f(`the press let go of ${JSON.stringify(rel && { key: rel.key, outcome: rel.outcome, reason: rel.reason })}, the ghost showed ${gh.key}`); break; }
      // the tile let go during the rock (then): where the rules put it on this build, and the joints with it there
      const r2 = then ? R.drop(B, then.piece, then.col) : null, B2 = r2 && r2.outcome === 'fit' ? R.place(B, r2) : null;
      const wpAll = B.tiles.map(tilePoly), J2 = B2 ? joints(B2.tiles.map(tileLat)) : J.filter(jt => jt.j < n);
      if (B2) wpAll.push(tilePoly(B2.tiles[n]));
      const lockedTo = B2 ? J2.filter(jt => jt.j === n && tp.members.includes(jt.i)).map(jt => jt.i) : [];
      if (then && (!B2 || !lockedTo.length)) { f(`the ${C.then} after it is ${r2 && r2.outcome}, locked to ${JSON.stringify(lockedTo)} of the part`); break; }
      let rel2 = null, landK = -1, aimed = false;
      // the rock: watch it frame by frame
      let maxA = 0, rockFrames = 0, marksOn = 0, movedIn = 0, movedOut = 0, marksOff = 0, stages = new Set(), leftAt = -1, gapMax = 0, gapAt = null, bodyMax = 0, rockSetBad = 0, withIt = 0;
      for (let k = 0; k < 120; k++) {
        await G.step(page, 2);
        const q = await G.display(page), fl = q.falling.find(x => x.outcome === 'off' && x.id === rel.id);
        // (then: as soon as the hand has the next tile, let go of it over its place, while the part rocks)
        if (then && !rel2) {
          const s = await G.state(page);
          if (s.phase === 'play' && s.handReady && !s.locked && !s.swapping) {
            if (!aimed) { aimed = true; await input.aim(await page.evaluate(c => CS.colToX(c), then.col), Y); }
            else if (q.hand && q.hand.col === then.col && q.ghost && q.ghost.style === 'fit' && q.ghost.col === r2.pose.col && q.ghost.way === r2.way && q.ghost.y[0] === r2.pose.y[0] && q.ghost.y[1] === r2.pose.y[1]) {
              await input.release(); await G.frame(page);
              rel2 = await page.evaluate(() => CS.lastRelease);
              if (!rel2 || rel2.id === rel.id || rel2.outcome !== 'fit' || rel2.key !== q.ghost.key) { f(`the ${C.then} let go during the rock: ${JSON.stringify(rel2)}`); break; }
            }
          }
        }
        if (rel2 && landK < 0 && (await page.evaluate(id => CS.events.some(e => e.type === 'land' && e.id === id), rel2.id))) landK = k;
        if (fl) stages.add(fl.stage);
        if (!fl && stages.size) { leftAt = k; break; }
        // every whole-edge joint stays closed, in every picture
        const jg = jointGap(q, J2);
        if (jg.worst > gapMax) { gapMax = jg.worst; gapAt = jg.at; }
        if (!fl || fl.stage !== 'rock') continue;
        rockFrames++;
        const rm = q.rockMarks, a = rm ? Math.abs(rm.a) : 0;
        maxA = Math.max(maxA, a);
        if (rm && JSON.stringify(rm.members) === JSON.stringify(tp.members) && rm.part.length === tp.members.length && rm.pivot && rm.plumb) marksOn++;
        if (a > 0.05) {
          // the tiles drawn rocking: the part's, and the tile let go since (from its release: it falls to its place on the
          // part as it rocks)
          const landed = landK >= 0 && q.tiles.some(t => t.i === n), want = tp.members.filter(i => i < n).concat(rel2 ? [n] : []);
          if (!rm || JSON.stringify(rm.rocking) !== JSON.stringify(want)) rockSetBad++;
          if (landed) withIt++;
          bodyMax = Math.max(bodyMax, oneBody(q, want, wpAll));
          for (const t of q.tiles) {
            const t0 = tiles0.find(u => u.i === t.i), dd = t0 ? G.polyDist(t0.poly, t.poly) : 0;
            if (tp.members.includes(t.i)) { if (dd > 2) movedIn++; } else if (t0 && dd > 0.6 && landK < 0) movedOut++;
          }
          // (the marks go with the part: its outlines are the tiles as drawn)
          for (let m = 0; rm && m < tp.members.length; m++) {
            const t = tp.members[m] < n ? q.tiles.find(u => u.i === tp.members[m]) : null;
            if (t && G.polyDist(t.poly, rm.part[m]) > 1.2) marksOff++;
          }
        }
      }
      if (bad) break;
      if (then) await G.wait(page, 0.6);
      const after = await page.evaluate(() => ({ s: CS.state(), d: CS.display(), key: CS.rulesKey() }));
      const back = Math.max(0, ...after.d.tiles.filter(t => t.i < n).map(t => { const t0 = tiles0.find(u => u.i === t.i); return t0 ? G.polyDist(t0.poly, t.poly) : 99; }));
      if (!stages.has('rock') || maxA < 0.12 || marksOn < rockFrames || movedIn === 0 || movedOut > 0 || marksOff > 0) f(`the rock: stages ${[...stages].join(',')}, at most ${maxA.toFixed(3)} rad, the marks on it in ${marksOn}/${rockFrames} frames (${marksOff} off the part), the part's tiles moved in ${movedIn} pictures, the others in ${movedOut}`);
      if (gapMax > 0.75 || bodyMax > 1 || rockSetBad > 0) f(`the rock: a whole-edge joint opened by ${gapMax.toFixed(2)} px${gapAt ? ' (tiles ' + gapAt.i + '-' + gapAt.j + ')' : ''}, the rocking tiles ${bodyMax.toFixed(2)} px from one rigid body, the tiles drawn rocking not the part's in ${rockSetBad} pictures`);
      if (then) {
        const wantKey = R.key(B2);
        if (!rel2 || landK < 0 || withIt < 3 || after.key !== wantKey || after.s.lost !== lost0 + 1) f(`the ${C.then} let go during the rock: ${rel2 ? 'let go' : 'never let go'}, ${landK >= 0 ? 'landed after ' + landK + ' pictures' : 'never landed'}, rocked with the part in ${withIt} pictures, the build ${after.key === wantKey ? 'has it' : 'is not the rules\''}, lost ${lost0} -> ${after.s.lost}`);
      } else if (leftAt < 0 || after.s.lost !== lost0 + 1 || after.key !== sc.key || back > 0.6) f(`after the rock: left the wall ${leftAt >= 0}, lost ${lost0} -> ${after.s.lost}, the build ${after.key === sc.key ? 'unchanged' : 'CHANGED'}, the tiles ${back.toFixed(1)} px from where they were`);
      T.info(`${tag} ${C.name.split(':')[0]}: part ${tp.members.length} tiles (${partD.toFixed(2)} px), corner ${pvD.toFixed(2)} px, plumb ${topD.toFixed(2)} px; the rock ${rockFrames} pictures, up to ${maxA.toFixed(3)} rad, marks on it in ${marksOn}, the part's tiles moved in ${movedIn}, the others in ${movedOut}; ${J2.length} whole-edge joints, the widest drawn ${gapMax.toFixed(2)} px; one body to ${bodyMax.toFixed(2)} px; left the wall after ${leftAt} pictures` +
        (then ? `; the ${C.then} let go during the rock landed after ${landK} pictures, locked to tile ${lockedTo.join(',')}, and rocked with the part in ${withIt}` : ''));
      // the hint: once in all (it came while aiming at the first TIPS OVER)
      for (let k = 0; k < 40 && !(await page.evaluate(() => CS.events.some(e => e.type === 'tip' && e.id === 'tips'))); k++) await G.wait(page, 0.1);
      const hint = await page.evaluate(n => ({ ev: CS.events.filter(e => e.type === 'tip' && e.id === 'tips').length, off: CS.events.slice(n).filter(e => e.type === 'off').map(e => e.reason) }), ev0);
      hintsSeen = hint.ev;
      if (hint.ev !== 1) f(`the TIPS OVER hint came ${hint.ev} times`);
      if (hint.off.join() !== 'TIPS OVER') f(`the off events: ${hint.off.join()}`);
      await G.wait(page, 1.5);
    }
    const what = C.fits ? 'every ghost the rules\' drop; the last tile stays, a white ghost, and landed there'
      : C.then ? `TIPS OVER as the rules have it; the ${C.then} let go during the rock landed on the part and rocked with it, no joint opening`
        : 'every ghost the rules\' drop; TIPS OVER with its part, corner and plumb line as the rules have them; let go, the part rocked as one body, no whole-edge joint opened, and the tile left the wall';
    T.check(!bad && T.n - T.bad === ok0, `${tag}: ${C.name}: ${C.drops.join(' ')}${C.then ? ', then ' + C.then : ''} through real ${size.touch ? 'touch' : 'mouse'}: ${bad ? 'FAILED' : what}`);
  }
  T.check(hintsSeen === 1, `${tag}: "Too far out: it would tip the tiles under it." came once in ${CASES.filter(C => !C.fits).length} TIPS OVER drops`);
  T.check(g.errors.length === 0, `${tag}: no console errors` + (g.errors.length ? ': ' + g.errors.slice(0, 3).join(' / ') : ''));
  await g.context.close();

  // BIG MAGNETS: aimed where it would tip, the magnets pull it to the nearest place it fits (RULES.pull), and it lands
  // there
  const b = await G.open(browser, size, { drive: 1, autostart: 1, seed: 5, big: 1, nohint: 1 }, {});
  try {
    await b.page.waitForFunction(() => window.CS && CS.state().phase === 'play');
    await b.page.evaluate(() => CS.wait(0.6));
    let pulled = 0, n = 0;
    for (const C of TIPS_CASES) {
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
    T.check(pulled === n && n === TIPS_CASES.length, `${tag}: BIG MAGNETS: aimed where it would tip, the magnets pulled it to RULES.pull's place and it landed there: ${pulled}/${n}`);
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
