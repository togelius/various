#!/usr/bin/env node
'use strict';
// G3 input (DESIGN §18.3, 18.4, 18.8), through real input at 390x844 and 844x390 (a finger) and 1366x1024 (a mouse),
// and by keys at each size. Every drop is checked against what is drawn (CS.display) and against the page's own rules
// replayed in Node (tools/g3lib.cjs pageRules: the RULES block of the page under test):
//  - the hand goes to the column under the pointer, on the held tile's columns (whole tiles for a square, half tiles
//    for a triangle), and is drawn there; a held triangle shows the way the drop takes, turned;
//  - the tiles are drawn where the rules' build puts them, as one rigid tower (the sway and the rock included);
//  - the ghost drawn is the rules' drop at the hand's column (BIG MAGNETS: its pull), drawn where the rules put it:
//    when it fits, its contact segments shine (the rules' shine), the ×2 / ×3 chip counts them, the fall column runs
//    from the hand down to it, a thin gap under it is drawn open (a wider one only at a near miss, its thin end); when it falls off, red and dashed with its reason:
//    ONLY A POINT with red dots on exactly the points it touches, TIPS OVER with the part that tips outlined, a red dot
//    on its corner and a plumb line hanging from the part's centre of weight; the held tile red;
//  - the fit markers drawn are the rules' fits at every column: an outline per square fit, a chevron in each ▼ fit, a
//    caret in each ▲ fit, and nothing else;
//  - a fit that the ghost weight says may take the tower over has an amber ghost and PAST THE WHEEL! by it (and only
//    such a fit); the fall column runs from the held tile down to the ghost;
//  - the press lets go of exactly that drop (the same column and result); a fit lands where its ghost was drawn and
//    the build is the rules' build with it; a tile that falls off never enters the build.
// No console errors anywhere.
//   node clack-stack/tools/input.cjs [--sizes=390x844,...] [--drops=200] [--keys=25] [--big=40]
const G = require('./g3lib.cjs');

const DROPS = +G.argOf('drops', 200), KEYS = +G.argOf('keys', 25), BIG = +G.argOf('big', 40);
const T = G.reporter('input');
const R = G.pageRules();
const HAS_TIPS = R.REASONS.includes('TIPS OVER');
const HYST_PX = 6;              // the hand keeps its column until the pointer is this far past its edge (≤ 1/5 step)

// world corners of a pose, in the order the game draws its polygon (its screenPoly)
function worldPoly(type, col, y) {
  const x = col / 2, yb = (y[0] + y[1] * G.R3) / 2, h = Math.sqrt(3) / 2;
  if (type === 'sq') return [[x, yb], [x + 1, yb], [x + 1, yb + 1], [x, yb + 1]];
  if (type === 'up') return [[x, yb], [x + 1, yb], [x + 0.5, yb + h]];
  return [[x + 0.5, yb], [x + 1, yb + h], [x, yb + h]];
}
const typeOf = r => r.pose.type === 'down' ? 'dn' : r.pose.type;
const polyOfResult = r => worldPoly(typeOf(r), r.pose.col, r.pose.y);
const tileType = t => t.piece === 'sq' ? 'sq' : t.way === 'down' ? 'dn' : 'up';
// the rules' build of the page's tiles (in placing order, tiles in the air included): each must be a fit there
function replay(tiles) {
  let B = R.newBuild({ half: 2 }), bad = null;
  for (const t of tiles) {
    const r = R.drop(B, t.piece, t.col, t.piece === 'sq' ? undefined : t.way);
    if (r.outcome !== 'fit' || r.pose.y[0] !== t.y[0] || r.pose.y[1] !== t.y[1]) { bad = bad || `${t.piece} ${t.way || ''} at ${t.col}: rules say ${r.outcome} at ${r.pose.y}`; continue; }
    B = R.place(B, r);
  }
  return { B, bad };
}
// one picture: what is drawn, the hand's own idea of its ghost, the page's tiles and build
function scene(page) {
  return page.evaluate(() => ({ d: CS.display(), g: CS.ghost(), s: CS.state(), tiles: CS.tiles(true), key: CS.rulesKey(), L: CS.cam().L,
    rel: CS.lastRelease, colX: (() => { const r = CS.state().colRange, o = {}; for (let c = r[0] - 1; c <= r[1] + 1; c++) o[c] = CS.colToX(c); return o; })() }));
}
// the screen mapping of the tower (from the drawn tiles and the rules' corners; the car top's when none stand) and of
// the car (its top: x −2 … 2 at y 0)
function mappings(sc, B) {
  const car = sc.d.car && G.fitSim([[-2, 0], [2, 0]], sc.d.car.top);
  const W = [], S = [];
  for (const it of sc.d.tiles) {
    const t = sc.tiles[it.i];
    if (!t) continue;
    const wp = worldPoly(tileType(t), t.col, t.y);
    for (let k = 0; k < wp.length; k++) { W.push(wp[k]); S.push(it.poly[k]); }
  }
  // (an affine map: the sway turns the tower, a landing squashes it for a moment, the rock turns it with the car)
  const tower = S.length >= 3 ? G.fitAffine(W, S) : car;
  return { car, tower, rigid: !!tower && tower.resid < 0.5, n: sc.d.tiles.length };
}
const mapAt = (M, p) => (p[1] <= 1e-9 && M.car ? M.car : M.tower).map(p);
// match two lists of items 1-1 by a distance (greedy, nearest first); returns the largest matched distance (Infinity if
// the counts differ)
function match(A, B, dist) {
  if (A.length !== B.length) return Infinity;
  const used = new Set();
  let worst = 0;
  for (const a of A) {
    let bi = -1, bd = Infinity;
    for (let j = 0; j < B.length; j++) if (!used.has(j)) { const d = dist(a, B[j]); if (d < bd) { bd = d; bi = j; } }
    if (bi < 0) return Infinity;
    used.add(bi); worst = Math.max(worst, bd);
  }
  return worst;
}
const segDist = (a, b) => Math.min(Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), Math.hypot(a[2] - b[2], a[3] - b[3])), Math.max(Math.hypot(a[0] - b[2], a[1] - b[3]), Math.hypot(a[2] - b[0], a[3] - b[1])));
const ptDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// the fit markers the rules' fits call for, on the screen
function expectedMarkers(B, piece, M) {
  const out = { outline: [], chevron: [], caret: [] }, h = Math.sqrt(3) / 2;
  for (const r of R.fitsAll(B, piece)) {
    if (r.outcome !== 'fit') continue;
    const ty = typeOf(r), wp = polyOfResult(r);
    if (ty === 'sq') out.outline.push(wp.map(p => M.tower.map(p)));
    else if (ty === 'dn') out.chevron.push(wp.map(p => M.tower.map(p)));
    else {
      // (a caret ∧ in the ▲: its middle, at 0.42 of its height)
      const cx = r.pose.col / 2 + 0.5, cy = (r.pose.y[0] + r.pose.y[1] * G.R3) / 2 + h * 0.42;
      out.caret.push([[cx - 0.13, cy - 0.09], [cx, cy + 0.06], [cx + 0.13, cy - 0.09]].map(p => M.tower.map(p)));
    }
  }
  return out;
}
// the points a tile that falls off touches (ONLY A POINT's red dots): the rules' contact points, and the ends of its
// contact segments where it sits on something (the rules list a corner on an apex beside a tile it meets side by side
// as the end of the side's segment)
function yRange(poly, x) {
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length];
    if (x < Math.min(a[0], b[0]) - 1e-9 || x > Math.max(a[0], b[0]) + 1e-9 || Math.abs(b[0] - a[0]) < 1e-12) continue;
    const y = a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
    lo = Math.min(lo, y); hi = Math.max(hi, y);
  }
  return hi - lo > 1e-6 ? [lo, hi] : null;
}
function restPoints(B, r) {
  const me = polyOfResult(r), others = B.tiles.map(t => worldPoly(t.t, t.c, [2 * t.a, t.b])), out = r.contacts.points.map(G.ptOf);
  const sits = (x, y) => [-1e-4, 1e-4].some(dx => {
    const u = yRange(me, x + dx);
    if (!u || Math.abs(u[0] - y) > 2e-3) return false;
    if (Math.abs(x + dx) < 2 && Math.abs(y) < 2e-3) return true;
    return others.some(o => { const v = yRange(o, x + dx); return v && Math.abs(v[1] - y) < 2e-3; });
  });
  for (const sg of r.contacts.segments) for (const v of sg) {
    const p = G.ptOf(v);
    if (!out.some(q => Math.abs(q[0] - p[0]) < 1e-7 && Math.abs(q[1] - p[1]) < 1e-7) && sits(p[0], p[1])) out.push(p);
  }
  return out;
}
// the part that tips: its tiles' outlines, and its centre of weight (a square weighs 1, a triangle √3/4)
function tipsPart(B, r) {
  const polys = [], cw = [0, 0, 0];
  const tiles = B.tiles.map(t => worldPoly(t.t, t.c, [2 * t.a, t.b]));
  for (const i of r.tips.members) {
    const wp = i < tiles.length ? tiles[i] : polyOfResult(r), w = wp.length === 4 ? 1 : Math.sqrt(3) / 4;
    polys.push(wp);
    cw[0] += w; cw[1] += w * wp.reduce((s, p) => s + p[0], 0) / wp.length; cw[2] += w * wp.reduce((s, p) => s + p[1], 0) / wp.length;
  }
  return { polys, com: [cw[1] / cw[0], cw[2] / cw[0]] };
}

// the checks of one aimed drop, before the press: returns the rules' result (or null when the picture can't be read)
function checkAim(sc, want, tag, stats, big) {
  const { d, s } = sc, piece = s.piece;
  const fail = m => { stats.fails++; T.check(false, `${tag}: ${m}`); };
  const rp = replay(sc.tiles);
  if (rp.bad) fail('the page\'s tiles are not a rules build: ' + rp.bad);
  const B = rp.B;
  if (R.key(B) !== sc.key) fail('the page\'s build is not the rules\' build of its tiles');
  if (s.col !== want) fail(`the hand is at column ${s.col}, the pointer at ${want}`);
  // (drawn as the screen shakes, if it does: a landing's clack shakes it a pixel or two)
  if (!d.hand || d.hand.col !== want || Math.abs(d.hand.x - d.shake.x - sc.colX[want]) > 0.6) fail(`the hand is drawn at ${d.hand && d.hand.x} (column ${d.hand && d.hand.col}), not over column ${want} (${sc.colX[want]})`);
  const r = big ? R.pull(B, piece, want) : R.drop(B, piece, want);
  const g = d.ghost;
  if (!g || !g.poly || !d.hand) { fail('no ghost or no hand drawn'); return null; }
  stats.aims++;
  const fit = r.outcome === 'fit';
  if (g.style !== (fit ? 'fit' : 'off') || g.col !== r.pose.col || g.way !== r.way || g.y[0] !== r.pose.y[0] || g.y[1] !== r.pose.y[1])
    fail(`the ghost (${g.style} ${g.way || ''} col ${g.col} y ${g.y}) is not the rules' drop (${r.outcome} ${r.way || ''} col ${r.pose.col} y ${r.pose.y})`);
  if (sc.g.key !== g.key) fail('the ghost drawn is not the hand\'s ghost');
  if (piece === 'tri' && (d.hand.way !== r.way || d.hand.turning)) fail(`the held triangle shows ${d.hand.way}${d.hand.turning ? ' (turning)' : ''}, the drop takes ${r.way}`);
  if (!!d.hand.red === fit) fail(`the held tile is ${d.hand.red ? 'red' : 'not red'} for a ${r.outcome}`);
  const M = mappings(sc, B);
  if (!M.rigid) { stats.unread++; return r; }
  stats.read++;
  // the tiles drawn where the rules put them (the fit of the mapping itself: one rigid tower)
  if (M.n) stats.tileResid = Math.max(stats.tileResid, M.tower.resid);
  const gd = G.polyDist(g.poly, polyOfResult(r).map(p => M.tower.map(p)));
  stats.ghostDist = Math.max(stats.ghostDist, gd);
  if (gd > 1) fail(`the ghost is drawn ${gd.toFixed(1)} px from where the rules put it`);
  // the fit markers
  const em = expectedMarkers(B, piece, M), dm = { outline: [], chevron: [], caret: [], other: [] };
  for (const m of d.markers) (dm[m.kind] || dm.other).push(m.pts);
  const mo = match(em.outline, dm.outline, G.polyDist);
  const mc = match(em.chevron, dm.chevron, (tri, ch) => G.inPoly(ch[1], tri) && G.inPoly(ch[0], tri) && G.inPoly(ch[2], tri) ? 0 : 99);
  const ma = match(em.caret, dm.caret, (a, b) => Math.max(ptDist(a[0], b[0]), ptDist(a[1], b[1]), ptDist(a[2], b[2])));
  stats.markerDist = Math.max(stats.markerDist, isFinite(mo) ? mo : 0, isFinite(ma) ? ma : 0);
  stats.markers += em.outline.length + em.chevron.length + em.caret.length;
  if (mo > 1 || mc > 1 || ma > 1 || dm.other.length) fail(`fit markers: outlines ${dm.outline.length}/${em.outline.length} (${mo.toFixed(1)} px), chevrons ${dm.chevron.length}/${em.chevron.length}, carets ${dm.caret.length}/${em.caret.length} (${ma.toFixed(1)} px), others ${dm.other.length}`);
  if (fit) {
    stats.fits++;
    const es = r.shine.map(sg => [...M.tower.map(G.ptOf(sg[0])), ...M.tower.map(G.ptOf(sg[1]))]);
    const ms = match(es, g.shine || [], segDist);
    if (ms > 1) fail(`the shine (${(g.shine || []).length} segments) is not the rules' contacts (${es.length}): ${ms.toFixed(1)} px`);
    const chip = r.shine.length >= 2 ? '×' + r.shine.length : null;
    if (g.chip !== chip) fail(`the chip says ${g.chip}, the drop touches ${r.shine.length} neighbours`);
    if (chip) stats.chips++;
    // a thin gap (under 0.3 L) is drawn open; a wider one only at a near miss, its thin end (a slant rising to an apex
    // just under the tile's bottom: the part where it is under 0.3 L, so the apex reads as not touching)
    const gapL = r.gap ? (r.gap[0] + r.gap[1] * G.R3) / 2 : 0, thin = r.gap && gapL < 0.3, drawn = g.ghostGaps ? g.ghostGaps.polys : [];
    const tall = drawn.map(pg => Math.max(...pg.map(q => q[1])) - Math.min(...pg.map(q => q[1]))).filter(hpx => hpx > 0.3 * sc.L + 1.5);
    if (thin ? !drawn.length : (drawn.length && (!r.gap || tall.length))) fail(`the gap: rules ${r.gap}, drawn ${drawn.length}${tall.length ? ' (' + tall.length + ' taller than 0.3 L)' : ''}`);
    if (thin) stats.gaps++; else if (drawn.length) stats.nearEnds++;
    const gx = g.poly.map(p => p[0]), gy = g.poly.map(p => p[1]), gb = { x0: Math.min(...gx), x1: Math.max(...gx), y0: Math.min(...gy) };
    // (from the held tile, its width under the hand, down to the ghost's top, its width there: slanted when the tower
    // sways the ghost sideways)
    if (g.column) {
      if (Math.abs(g.column.x0 - gb.x0) > 0.5 || Math.abs(g.column.x1 - gb.x1) > 0.5 || Math.abs(g.column.y1 - gb.y0) > 0.5 || g.column.y0 < d.hand.y ||
        Math.abs(g.column.hx0 - (d.hand.x - sc.L / 2)) > 1.2 || Math.abs(g.column.hx1 - (d.hand.x + sc.L / 2)) > 1.2) fail('the fall column does not run from the hand down to the ghost: ' + JSON.stringify({ column: g.column, hand: d.hand.x, L: sc.L, ghost: gb }));
      else { stats.columns++; if (Math.abs((g.column.hx0 + g.column.hx1) / 2 - (g.column.x0 + g.column.x1) / 2) > 2) stats.slanted++; }
    }
    else if (gb.y0 - (d.hand.y + (piece === 'sq' ? 1 : 0.87) * sc.L) > 8) fail('no fall column');
    // a drop that may take the tower over (the ghost weight red): said at the ghost, amber with PAST THE WHEEL! by it;
    // THE TOPPER where it tops out: gold with TOPS OUT! by it
    const gwTip = !!(sc.g.weight && sc.g.weight.tip), co = g.callout ? g.callout.text : null;
    if (!!g.warn !== gwTip || (g.color === 'amber') !== gwTip) fail(`the ghost is ${g.color}${g.warn ? ' (warn)' : ''}, the ghost weight ${gwTip ? 'red' : 'white'}`);
    else if (gwTip && co !== 'PAST THE WHEEL!') fail('an amber ghost without PAST THE WHEEL!: ' + co);
    else if (g.tops && (co !== 'TOPS OUT!' || g.color !== 'gold')) fail('THE TOPPER tops out here, the ghost says ' + g.color + ' / ' + co);
    else if (!gwTip && !g.tops && co) fail('a callout by a plain fit: ' + co);
    if (gwTip) stats.warned++;
    if (g.tops) stats.tops++;
  } else {
    stats.offs++;
    if (!g.dashed || g.color !== 'red') fail('the ghost of a tile that falls off is not red and dashed');
    if (g.reason !== r.reason) fail(`the reason drawn is ${g.reason}, the rules say ${r.reason}`);
    stats.reasons[r.reason] = (stats.reasons[r.reason] || 0) + 1;
    const mk = g.marks || { dots: [], part: [] };
    if (r.reason === 'ONLY A POINT') {
      const ep = restPoints(B, r).map(p => mapAt(M, p));
      const md = match(ep, mk.dots || [], ptDist);
      if (md > 1 || !ep.length) fail(`ONLY A POINT: ${(mk.dots || []).length} red dots drawn, the tile touches at ${ep.length} points (${md.toFixed(1)} px)`);
      if (ep.length > r.contacts.points.length) stats.restDots++;
      const ex = () => B.log.map(l => (l.piece === 'sq' ? '■' : l.way === 'down' ? '▼' : '▲') + l.col / 2).join(' ') + ' then ' + (piece === 'sq' ? '■' : r.way === 'down' ? '▼' : '▲') + r.pose.col / 2;
      if (!ep.length) { stats.pointless++; if (stats.exPointless.length < 3) stats.exPointless.push(ex()); }
      if (r.contacts.segments.length) { stats.segOff++; if (stats.exSeg.length < 3) stats.exSeg.push(ex()); }
    } else if (r.reason === 'TIPS OVER') {
      const tp = tipsPart(B, r), ep = tp.polys.map(wp => wp.map(p => M.tower.map(p)));
      const mpart = match(ep, mk.part || [], G.polyDist);
      const pv = mapAt(M, G.ptOf(r.tips.pivot)), dpv = mk.pivot ? ptDist(pv, mk.pivot) : Infinity;
      const top = M.tower.map(tp.com), dtop = mk.plumb ? Math.abs(mk.plumb[0][0] - top[0]) : Infinity;
      if (mpart > 1 || dpv > 1.5 || dtop > 1.5 || !mk.plumb || Math.abs(mk.plumb[0][0] - mk.plumb[1][0]) > 0.2 || mk.plumb[1][1] < pv[1])
        fail(`TIPS OVER marks: the part ${(mk.part || []).length}/${ep.length} (${mpart.toFixed(1)} px), the corner ${dpv.toFixed(1)} px off, the plumb line ${dtop.toFixed(1)} px off its centre of weight or not hanging past the corner`);
      else stats.tipsMarked++;
    }
  }
  return r;
}

async function segment(browser, size, mode, n, seed) {
  const big = mode === 'big', keys = mode === 'keys';
  const tag0 = `${size.name} ${mode}`;
  const params = { drive: 1, autostart: 1, nohint: 1, seed };
  if (big) params.big = 1;
  const { context, page, errors, input } = await G.open(browser, size, params);
  await page.waitForFunction(() => window.CS && CS.state().phase === 'play');
  await G.wait(page, 0.6);
  const rnd = G.rng(seed * 7 + 3), Y = size.h * 0.55;
  if (mode === 'pointer') {
    // the hand's hold: past a column's edge by less than the hold it stays, by more it moves on; both shapes
    const res = [];
    for (const sh of ['sq', 'tri']) {
      await page.evaluate(sh => CS.setPiece(sh), sh);
      const L = await page.evaluate(() => CS.cam().L), stepPx = (sh === 'sq' ? 1 : 0.5) * L, m = Math.min(HYST_PX, 0.2 * stepPx);
      const c0 = sh === 'sq' ? -2 : -1, c1 = c0 + (sh === 'sq' ? 2 : 1), x0 = await page.evaluate(c => CS.colToX(c), c0), edge = x0 + stepPx / 2;
      await input.aim(x0, Y); await G.frame(page);
      const a = (await G.state(page)).col;
      await input.aim(edge + m - 1.5, Y); await G.frame(page);
      const b = (await G.state(page)).col;
      await input.aim(edge + m + 1.5, Y); await G.frame(page);
      const c = (await G.state(page)).col;
      await input.aim(x0 + stepPx, Y); await input.aim(edge - m + 1.5, Y); await G.frame(page);
      const d2 = (await G.state(page)).col;
      await input.aim(edge - m - 1.5, Y); await G.frame(page);
      const e = (await G.state(page)).col;
      res.push({ sh, ok: a === c0 && b === c0 && c === c1 && d2 === c1 && e === c0, cols: [a, b, c, d2, e], m });
    }
    T.check(res.every(r => r.ok), `${tag0}: the hand holds its column until the pointer is ${res.map(r => r.m.toFixed(1)).join(' / ')} px past its edge (■ / ▲), then moves on, either way: ${res.map(r => r.sh + ' ' + r.cols.join(',')).join('; ')}`);
    // a still pointer and a zooming camera: the hand keeps its column, and letting go without moving lets go there
    {
      await page.evaluate(() => { CS.clear(); CS.setPiece('sq'); });
      await G.wait(page, 0.3);
      // (column −2, toward its outer edge: as the camera zooms out that spot runs out over column −4)
      const L0 = await page.evaluate(() => CS.cam().L), x = await page.evaluate(c => CS.colToX(c), -2);
      await input.aim(x - 0.4 * L0, Y); await G.frame(page);
      const b = []; for (let r = 0; r < 16; r++) b.push('■-2', '■-1');
      await page.evaluate(b => CS.build(b), b);
      await G.wait(page, 1.5);
      const before = await page.evaluate(() => ({ col: CS.display().hand.col, L: CS.cam().L, id: CS.lastRelease ? CS.lastRelease.id : 0 }));
      await input.release(); await G.frame(page);
      const rel = await page.evaluate(() => CS.lastRelease);
      T.check(rel && rel.id !== before.id && rel.handCol === before.col && before.col === -2, `${tag0}: the camera zoomed (${L0.toFixed(0)} -> ${before.L.toFixed(0)} px a tile) under a still pointer: the hand kept column ${before.col} and letting go there let go of column ${rel && rel.handCol}`);
      await G.wait(page, 1);
      await page.evaluate(() => CS.clear());
      await G.wait(page, 0.6);
    }
    await input.cancel();
  }
  const stats = { drops: 0, aims: 0, read: 0, unread: 0, fits: 0, offs: 0, chips: 0, gaps: 0, nearEnds: 0, columns: 0, slanted: 0, warned: 0, tops: 0, markers: 0, reasons: {}, tipsMarked: 0, pointless: 0, segOff: 0, restDots: 0, exPointless: [], exSeg: [],
    released: 0, same: 0, landed: 0, landedOk: 0, offOut: 0, runs: 1, fails: 0, tileResid: 0, ghostDist: 0, markerDist: 0, fuse: 0 };
  const pend = [];
  let guard = 0;
  while (stats.drops < n && guard++ < n * 30 && stats.fails < 25) {
    const s = await G.state(page);
    if (s.phase === 'over') {
      if (!s.over.open) { await G.wait(page, 0.25); continue; }
      const d = await G.display(page), again = d.buttons.find(b => b.name === 'again');
      if (!again || again.disabled) { await G.wait(page, 0.1); continue; }
      await input.tap((again.box.x0 + again.box.x1) / 2, (again.box.y0 + again.box.y1) / 2);
      await G.frame(page); await G.wait(page, 1.2);
      stats.runs++;
      continue;
    }
    if (s.phase !== 'play' || !s.handReady || s.locked || s.swapping) { await G.wait(page, 0.1); continue; }
    const idBefore = await page.evaluate(() => CS.lastRelease ? CS.lastRelease.id : 0);
    // where to aim: anywhere the hand reaches, a fit, or a place it falls off
    const [lo, hi] = s.colRange, stp = s.piece === 'sq' ? 2 : 1, cols = [];
    for (let c = lo; c <= hi; c += stp) cols.push(c);
    const drops = await page.evaluate(() => CS.drops(false).map(d => ({ col: d.handCol, outcome: d.outcome })));
    const fitC = drops.filter(d => d.outcome === 'fit').map(d => d.col), offC = drops.filter(d => d.outcome !== 'fit').map(d => d.col);
    const u = rnd(), pool = u < 0.45 || !fitC.length ? (u < 0.75 && offC.length ? offC : cols) : fitC;
    const want = pool[Math.floor(rnd() * pool.length)];
    // (anywhere in the column's reach: from its middle to past its edges by the hand's hold, which a pointer coming
    // from the next column must pass to take it)
    const L = await page.evaluate(() => CS.cam().L), zone = (stp === 2 ? 0.5 : 0.25) * L - Math.min(HYST_PX, 0.2 * stp / 2 * L) - 1;
    if (keys) {
      let guard2 = 0;
      while ((await G.state(page)).col !== want && guard2++ < 12) await input.key((await G.state(page)).col > want ? 'ArrowLeft' : 'ArrowRight');
    } else {
      const x0 = await page.evaluate(c => CS.colToX(c), want);
      // anywhere in the column's reach (past the ends of the range: further out still)
      let x = x0 + (rnd() * 2 - 1) * zone;
      if (want === lo && rnd() < 0.3) x = x0 - zone - rnd() * L;
      if (want === hi && rnd() < 0.3) x = x0 + zone + rnd() * L;
      await input.aim(Math.max(1, Math.min(size.w - 1, x)), Y);
    }
    await G.frame(page);
    // (the hand eases over in ~40 ms and a triangle turns in 80 ms; a landing's hit-stop can hold the turn a moment)
    await G.step(page, 11);
    for (let i = 0; i < 6 && (await page.evaluate(() => { const h = CS.display().hand; return !!(h && h.turning); })); i++) await G.step(page, 2);
    const sc = await scene(page);
    if ((sc.rel ? sc.rel.id : 0) !== idBefore) { stats.fuse++; continue; }
    if (sc.s.phase !== 'play' || !sc.s.handReady) continue;
    const r = checkAim(sc, want, `${tag0} drop ${stats.drops + 1} (${sc.s.piece} at ${want})`, stats, big);
    stats.drops++;
    const id0 = sc.rel ? sc.rel.id : 0, key0 = sc.key;
    if (keys) await input.key(rnd() < 0.5 ? 'Space' : 'ArrowDown'); else await input.release();
    await G.frame(page);
    const rel = await page.evaluate(() => CS.lastRelease);
    if (!rel || rel.id === id0) { T.check(false, `${tag0}: the press let nothing go`); stats.fails++; continue; }
    stats.released++;
    if (rel.key === sc.g.key && rel.handCol === want && (!r || (rel.outcome === r.outcome && rel.col === r.pose.col))) stats.same++;
    else { T.check(false, `${tag0}: the press let go of ${rel.key} from column ${rel.handCol}, the ghost showed ${sc.g.key} at ${want}`); stats.fails++; }
    if (rel.outcome === 'fit') pend.push({ id: rel.id, key: rel.key }); else pend.push({ id: rel.id, off: true, key0 });
    // then the next drop at once (a tile in the air), soon, or later
    const v = rnd();
    await G.wait(page, v < 0.3 ? 0 : v < 0.8 ? 0.1 + 0.4 * rnd() : 0.8);
  }
  await G.wait(page, 1.5);
  const ev = await page.evaluate(() => CS.events.filter(e => e.type === 'land' || e.type === 'off').map(e => ({ type: e.type, id: e.id, key: e.key })));
  for (const p of pend) {
    const e = ev.find(q => q.id === p.id);
    if (p.off) { if (!e || e.type === 'off') stats.offOut++; continue; }
    if (!e) continue;                 // (lost with a crash, or the run ended)
    stats.landed++;
    if (e.type === 'land' && e.key === p.key) stats.landedOk++;
  }
  const offsLeft = pend.filter(p => p.off).length;
  T.check(stats.drops >= n && stats.fails === 0, `${tag0}: ${stats.drops} drops through real ${keys ? 'keys' : size.touch ? 'touch' : 'mouse'}${big ? ' (BIG MAGNETS: the ghost is the pull)' : ''} over ${stats.runs} run(s): every ghost, marker set, reason and mark as the rules have it`);
  T.info(`read ${stats.read} pictures (${stats.unread} not mapped: the tower not one rigid body); ${stats.fits} fits (${stats.chips} with a chip, ${stats.gaps} with an open gap, ${stats.nearEnds} with a near miss's thin end open, ${stats.columns} fall columns, ${stats.slanted} of them slanted, ${stats.warned} amber with PAST THE WHEEL!${stats.tops ? ', ' + stats.tops + ' THE TOPPER topping out' : ''}), ${stats.offs} falling off (${Object.entries(stats.reasons).map(([k, v]) => v + ' ' + k).join(', ')}${stats.tipsMarked ? ', ' + stats.tipsMarked + ' TIPS OVER marked' : ''}); ${stats.markers} markers matched; tiles within ${stats.tileResid.toFixed(2)} px of the rules, ghosts ${stats.ghostDist.toFixed(2)} px, markers ${stats.markerDist.toFixed(2)} px`);
  if (stats.restDots) T.info(`(${stats.restDots} ONLY A POINT ghosts dotted where a corner sits on something at the end of a side contact)`);
  if (stats.pointless || stats.segOff) T.info(`(${stats.pointless} ONLY A POINT drops touched no point${stats.exPointless.length ? ': ' + stats.exPointless.join(' | ') : ''}; ${stats.segOff} touched along a segment too${stats.exSeg.length ? ': ' + stats.exSeg.join(' | ') : ''})`);
  T.check(stats.released === stats.drops && stats.same === stats.released, `${tag0}: each press let go of the drop its ghost showed: ${stats.same}/${stats.released}${stats.fuse ? ' (' + stats.fuse + ' left by the fuse first, not counted)' : ''}`);
  T.check(stats.landed >= Math.min(20, n / 4) && stats.landedOk === stats.landed, `${tag0}: a fit landed where its ghost was: ${stats.landedOk}/${stats.landed} (the rest went with a crash or the run's end)`);
  T.check(stats.offOut === offsLeft, `${tag0}: a tile that fell off never entered the build: ${stats.offOut}/${offsLeft}`);
  T.check(errors.length === 0, `${tag0}: no console errors` + (errors.length ? ': ' + errors.slice(0, 3).join(' / ') : ''));
  await context.close();
  return stats;
}

(async () => {
  const browser = await G.launch();
  try {
    console.log(`rules: ${R.REASONS.join(', ')}${HAS_TIPS ? '' : ' (no TIPS OVER in these rules: its marks are not reached)'}`);
    let seed = 40;
    for (const size of G.sizesFrom()) {
      const t0 = Date.now();
      await segment(browser, size, 'pointer', DROPS, ++seed);
      if (KEYS) await segment(browser, size, 'keys', KEYS, ++seed);
      if (BIG) await segment(browser, size, 'big', BIG, ++seed);
      T.info(`${size.name}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    }
  } finally { await browser.close(); }
  T.done();
})().catch(e => { console.error(e); process.exitCode = 1; });
