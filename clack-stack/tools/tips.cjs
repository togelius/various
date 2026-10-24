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
//  - BIG MAGNETS: the magnets pull a tile aimed where it would tip to the place RULES.pull picks, and it lands there;
//  - props (revision 5e): golden case 19 (a stack on a hung ▼ that would tip right, pressing on the square beside it)
//    stays, as the rules say: the ghost white, with a double bar at the one contact that holds it up (■−1's side on
//    ■0's, as §18.9 has it), drawn where that contact is; it lands, and the double bar flashes there, then goes. The
//    same on the left: 5d's neither-way case (a ▲ on a ■ on a hung ▼, with ■−2 beside them) is now propped by ■−2, and
//    the neither-way case is that build without ■−2;
//  - the prop mark comes exactly when a fit is propped: at every column the hand is aimed at, in every case above and in
//    three games played through real input (found by a steered search: one whose propped parts lean right, one left, one
//    with TIPS OVER parts beside a square that does not prop them), the ghost carries a prop mark if and only if the
//    fit stands only by a prop: the page's own rules with props switched off (5d's balance, built in Node from its RULES
//    block) call it TIPS OVER. Its contacts are the rules' (RULES.props of the build the fit makes, the groups the tile
//    joins), drawn where they are; every fit let go flashes its bars on landing if and only if it was propped.
// No console errors.
//   node clack-stack/tools/tips.cjs [--sizes=390x844,...]
const fs = require('fs');
const G = require('./g3lib.cjs');
const rulesVm = require('./lib/rules-vm.cjs');

const T = G.reporter('tips');
const R = G.pageRules();
const HAS_TIPS = R.REASONS.includes('TIPS OVER');
// revision 5e: the rules name the props (RULES.props); M: the page's own rules with props switched off (a group that
// leans tips, whatever is beside it: 5d's balance), so a fit M calls TIPS OVER stands only by a prop
const HAS_PROPS = typeof R.props === 'function';
const M = HAS_PROPS ? noPropRules() : null;
function noPropRules() {
  const html = fs.readFileSync(G.GAMEFILE, 'utf8'), src = html.slice(html.indexOf(rulesVm.BEGIN) + rulesVm.BEGIN.length, html.indexOf(rulesVm.END));
  const re = /if \(side && !propped\([^)]*\)\) fails\.push/;
  if (!re.test(src)) return null;
  return rulesVm.load({ from: { source: src.replace(re, 'if (side) fails.push'), file: G.GAMEFILE + '#RULES-without-props' } });
}
// what the ghost of drop r (piece at col, on build B) must show of props: the rules' contacts holding up the groups the
// tile joins (RULES.props of the build it makes: those with the new tile's index), once each; null when there are none.
// propped: the props-off rules call the same drop TIPS OVER (the way the rules chose forced)
function propsWant(B, piece, col, r) {
  if (!HAS_PROPS || r.outcome !== 'fit') return { props: null, propped: false };
  const n = B.tiles.length, out = [], seen = new Set();
  for (const g of R.props(R.place(B, r))) if (g.members.includes(n)) for (const p of g.props) {
    const k = JSON.stringify(p.seg);
    if (!seen.has(k)) { seen.add(k); out.push({ tile: p.tile, by: p.by, side: g.side, seg: p.seg }); }
  }
  const m = M ? M.drop(B, piece, col, piece === 'sq' ? undefined : r.way) : null;
  return { props: out.length ? out : null, propped: !!m && m.outcome === 'off' && m.reason === 'TIPS OVER' };
}
// The ghost's prop mark against propsWant: none, or each contact (the same tiles, side and lattice segment) drawn where
// the contact is (its ends through the tower's map M0, within 1.5 px) with its two bars either side of it, about its
// middle and along it. Returns '' or what is wrong
function propMarkErr(gh, want, M0) {
  const pm = gh && gh.props;
  if (!!want.props !== want.propped) return `the rules' props ${JSON.stringify(want.props)} but without props the drop is ${want.propped ? 'TIPS OVER' : 'a fit'}`;
  if (!want.props) return pm || (gh && gh.propped) ? `a prop mark on a fit that is not propped: ${JSON.stringify(pm && pm.items)}` : '';
  if (!pm || !gh.propped) return `no prop mark on a propped fit (the rules: ${JSON.stringify(want.props)})`;
  const items = pm.items.map(i => ({ tile: i.tile, by: i.by, side: i.side, seg: i.seg }));
  if (JSON.stringify(items) !== JSON.stringify(want.props)) return `the prop mark names ${JSON.stringify(items)}, the rules ${JSON.stringify(want.props)}`;
  if (!M0) return 'no map from the lattice to the screen';
  for (let k = 0; k < want.props.length; k++) {
    const a = M0.map(G.ptOf(want.props[k].seg[0])), b = M0.map(G.ptOf(want.props[k].seg[1])), sg = pm.segs[k];
    const da = Math.hypot(sg[0] - a[0], sg[1] - a[1]), db = Math.hypot(sg[2] - b[0], sg[3] - b[1]);
    if (da > 1.5 || db > 1.5) return `prop ${k + 1} drawn ${da.toFixed(1)} / ${db.toFixed(1)} px from its contact`;
    const [b1, b2] = [pm.bars[2 * k], pm.bars[2 * k + 1]], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const bm = [(b1[0][0] + b1[1][0] + b2[0][0] + b2[1][0]) / 4, (b1[0][1] + b1[1][1] + b2[0][1] + b2[1][1]) / 4];
    const along = (bar) => { const ux = bar[1][0] - bar[0][0], uy = bar[1][1] - bar[0][1], vx = b[0] - a[0], vy = b[1] - a[1]; return Math.abs(ux * vy - uy * vx) / (Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1); };
    if (Math.hypot(bm[0] - mid[0], bm[1] - mid[1]) > 1.5 || along(b1) > 0.05 || along(b2) > 0.05) return `prop ${k + 1}'s bars are not about the contact's middle and along it`;
  }
  return '';
}
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
  // (revision 5e: the ▲ tips the ■ under it left, over the hung ▼'s point; until 5d this case also had ■−2 beside them,
  // which now props them: the case below)
  { name: 'neither way fits: ▲ tips, ▼ a point', drops: ['▲-1', '▼-0.5', '■-1', '▲-1.5'] },
  { name: 'golden 17: four triangles locked into one piece, a square half on its top (stays; 5c tipped it)', drops: ['▲0.5', '▼0', '▲0', '▼0.5', '■1'], fits: true },
  { name: 'golden 18: a block of locked tiles on half a square\'s top and a point (5c\'s grip kept it)', drops: G18,
    want: { side: 'right', pivot: [-2, 2, 0], past: 0.014, members: [1, 2, 3, 4, 5, 6, 7] } },
  { name: 'golden 18, then a ▲ let go during the rock, squarely on the part\'s top square', drops: G18, then: '▲-1' },
  // revision 5e (§18.9): the stack ▲−2 ▼−1.5 ■−2 ■−1 ■−1 on the hung ▼ would tip right over the ▼'s point, x −1 on the
  // car; ■−1 (tile 4) presses with its right side on ■0's left (tile 0), from the ▼'s top (y √3/2) to ■0's top (y 1)
  { name: 'golden 19: a stack on a hung ▼ that would tip right, pressing on the square beside it (stays: propped; 5d tipped it)',
    drops: ['■0', '▲-2', '▼-1.5', '■-2', '■-1', '■-1'], fits: true, props: [{ tile: 4, by: 0, side: 'right', seg: [[0, 0, 1], [0, 2, 0]] }] },
  // and its mirror image's kin: the neither-way case above with ■−2 beside it (5d's case): the ▲ and the ■ under it lean
  // left over the hung ▼'s point, and ■−1 (tile 3) presses with its left side on ■−2's right (tile 0), from the ▼'s top
  // up to ■−2's top: propped, so it stays (5d tipped it)
  { name: 'a prop on the left: the neither-way case with a square beside it (stays: propped; 5d tipped it)',
    drops: ['■-2', '▲-1', '▼-0.5', '■-1', '▲-1.5'], fits: true, props: [{ tile: 3, by: 0, side: 'left', seg: [[-2, 0, 1], [-2, 2, 0]] }] },
];
// The prop sweeps (revision 5e): games played through real input, the hand aimed at every column before each drop.
// Found by a steered random search on the page's rules (squares three in four; a propped fit taken when one is
// offered, three times in five; the weight kept within 0.9 of the middle): the first game's propped parts lean right
// (16 propped columns, 5 propped drops), the second's left (13, 6), the third has TIPS OVER parts beside a square on
// the far side of their lean, which does not prop them (2 columns), and one propped drop.
const SWEEPS = [
  { name: 'props leaning right', drops: ['▲-1', '■1', '▼-0.5', '■-2', '■0', '▲0.5', '▼0', '▲-1', '■-2', '■0'], need: { right: 1, flashed: 1 } },
  { name: 'props leaning left', drops: ['▲0', '■-2', '■1', '▼-0.5', '■-1', '■-2', '■-1', '■0', '▲-2.5', '■-1', '■0', '■-1'], need: { left: 1, flashed: 1 } },
  { name: 'TIPS OVER beside a square that does not prop', drops: ['▲0', '■-2', '▼0.5', '■-2', '■-1', '■0', '▲-0.5', '■1', '■1', '■-2', '■-2'], need: { tipsBeside: 1 } },
];
// A TIPS OVER (r: piece's drop on build B) whose part has a square side by side with a square outside it, at another
// height (an upright contact): one that does not prop it, as the rules say it tips
function besideNoProp(B, piece, r) {
  if (r.reason !== 'TIPS OVER' || !r.tips) return false;
  const yv = y => (y[0] + y[1] * G.R3) / 2, T = R.tiles(B).map(t => ({ piece: t.piece, col: t.col, y: yv(t.y) })).concat([{ piece, col: r.pose.col, y: yv(r.pose.y) }]), mem = new Set(r.tips.members);
  for (const i of mem) for (let j = 0; j < T.length; j++) {
    if (mem.has(j) || T[i].piece !== 'sq' || T[j].piece !== 'sq' || Math.abs(T[j].col - T[i].col) !== 2) continue;
    const dy = Math.abs(T[j].y - T[i].y);
    if (dy > 1e-9 && dy < 1 - 1e-9) return true;
  }
  return false;
}
// what each sweep must meet, played out in Node on the page's rules (the browser's counts must be these): the columns
// the hand is aimed at before each drop, how many are propped fits (by the side they lean), other fits, drops that fall
// off (TIPS OVER beside a square that does not prop), the drops and the propped ones among them
function preSweeps() { for (const SW of SWEEPS) {
  const n = { cols: 0, propped: 0, fits: 0, off: 0, tipsBeside: 0, left: 0, right: 0, drops: 0, flashed: 0 };
  let B = HAS_PROPS ? R.newBuild({ half: 2 }) : null, ok = HAS_PROPS;
  for (const s of HAS_PROPS ? SW.drops : []) {
    const dr = parse(s);
    for (const col of R.cols(B, dr.piece)) {
      const r = R.drop(B, dr.piece, col), w = propsWant(B, dr.piece, col, r);
      n.cols++;
      if (r.outcome !== 'fit') { n.off++; if (besideNoProp(B, dr.piece, r)) n.tipsBeside++; } else if (w.props) { n.propped++; n[w.props[0].side]++; } else n.fits++;
    }
    const r = R.drop(B, dr.piece, dr.col);
    if (r.outcome !== 'fit' || (dr.way && r.way !== dr.way)) { ok = false; break; }
    if (propsWant(B, dr.piece, dr.col, r).props) n.flashed++;
    n.drops++;
    B = R.place(B, r);
  }
  SW.pre = n;
  SW.ok = ok && Object.keys(SW.need).every(k => n[k] >= SW.need[k]);
} }
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
  // A fit let go (rel: its release; want: propsWant; B2: the build with it): step until it lands, then its flash: a
  // propped fit's bars flash at its contacts (the same as the ghost's, drawn there) and are gone PROP_FLASH_T s later; a
  // fit that is not propped flashes none. Returns '' or what is wrong
  let flashes = 0;
  const landFlash = async (rel, want, B2) => {
    let landed = false;
    for (let k = 0; k < 240 && !landed; k++) { await G.step(page, 1); landed = await page.evaluate(id => CS.events.some(e => e.type === 'land' && e.id === id), rel.id); }
    if (!landed) return 'it never landed';
    const q = await G.display(page), pf = q.propFlash, ev = await page.evaluate(id => CS.events.find(e => e.type === 'prop' && e.id === id) || null, rel.id);
    const it = pf && pf.items.find(i => i.id === rel.id);
    if (!want.props) return it || ev ? `a fit that is not propped flashed a prop: ${JSON.stringify(it || ev)}` : '';
    if (!it || !ev) return `a propped fit landed with ${it ? '' : 'no flash'}${!it && !ev ? ' and ' : ''}${ev ? '' : 'no prop event'}`;
    const names = it.props.map(p => ({ tile: p.tile, by: p.by, side: p.side, seg: p.seg }));
    if (JSON.stringify(names) !== JSON.stringify(want.props)) return `the flash names ${JSON.stringify(names)}, the rules ${JSON.stringify(want.props)}`;
    let k0 = 0;
    for (const o of pf.items) { if (o === it) break; k0 += o.props.length; }
    const M0 = towerMap(q, B2);
    for (let k = 0; k < want.props.length; k++) {
      const a = M0.map(G.ptOf(want.props[k].seg[0])), b = M0.map(G.ptOf(want.props[k].seg[1])), sg = pf.segs[k0 + k];
      if (!sg || Math.hypot(sg[0] - a[0], sg[1] - a[1]) > 1.5 || Math.hypot(sg[2] - b[0], sg[3] - b[1]) > 1.5) return `the flash's prop ${k + 1} is not drawn at its contact`;
    }
    const life = await page.evaluate(() => CFG.PROP_FLASH_T);
    await G.wait(page, life + 0.05);
    const q2 = await G.display(page);
    if (q2.propFlash && q2.propFlash.items.some(i => i.id === rel.id)) return `the flash is still there ${(life + 0.05).toFixed(2)} s after landing`;
    flashes++;
    return '';
  };
  // the prop mark on the ghost now, for drop r of piece at col on build B (d: the display list)
  let propChecks = 0, propSeen = 0;
  const propCheck = (d, B, piece, col, r) => {
    const want = propsWant(B, piece, col, r);
    propChecks++; if (want.props) propSeen++;
    return { want, err: HAS_PROPS ? propMarkErr(d.ghost, want, towerMap(d, B)) : '' };
  };

  for (const C of CASES.filter(C => HAS_PROPS || !C.props)) {
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
      // (revision 5e) a prop mark exactly when this fit is propped
      const pc = propCheck(d, B, dr.piece, dr.col, r);
      if (pc.err) { f(`drop ${i + 1} (${C.drops[i]}): ${pc.err}`); break; }
      if (!last) {
        if (r.outcome !== 'fit') { f(`drop ${i + 1} (${C.drops[i]}) does not fit: ${r.reason}`); break; }
        await input.release(); await G.frame(page);
        const rel = await page.evaluate(() => CS.lastRelease);
        B = R.place(B, r);
        const fe = HAS_PROPS ? await landFlash(rel, pc.want, B) : '';
        if (fe) { f(`drop ${i + 1} (${C.drops[i]}): ${fe}`); break; }
        await G.wait(page, 0.3);
        continue;
      }
      if (C.fits) {
        // the last tile stays: a white ghost with no reason and no marks, the held tile plain; it lands where the ghost was
        if (r.outcome !== 'fit' || r.tips) { f(`the last tile is ${r.outcome} ${r.reason}, not a fit`); break; }
        if (gh.dashed || gh.color === 'red' || gh.reason || gh.reasonLabel || (gh.marks && (gh.marks.part || []).length)) f(`the ghost is ${gh.color}${gh.dashed ? ' dashed' : ''}, its reason ${gh.reason}, ${gh.marks ? 'with marks' : 'no marks'}`);
        if (d.hand.red) f('the held tile is red');
        if (sc.g.outcome !== 'fit' || sc.g.tips) f('the hand\'s own ghost is not the rules\' fit');
        // (what §18.9 says of its props: golden case 19 stands on one, the square beside it)
        if (C.props && JSON.stringify(pc.want.props) !== JSON.stringify(C.props)) f(`the rules' props ${JSON.stringify(pc.want.props)} are not §18.9's ${JSON.stringify(C.props)}`);
        if (C.props && JSON.stringify((sc.g.props || []).map(p => ({ tile: p.tile, by: p.by, side: p.side, seg: p.seg }))) !== JSON.stringify(pc.want.props)) f(`the hand's own ghost names the props ${JSON.stringify(sc.g.props)}`);
        const lost0 = (await G.state(page)).lost;
        await input.release(); await G.frame(page);
        const rel = await page.evaluate(() => CS.lastRelease);
        if (!rel || rel.id === sc.rel || rel.key !== gh.key || rel.outcome !== 'fit') { f(`the press let go of ${JSON.stringify(rel && { key: rel.key, outcome: rel.outcome })}, the ghost showed ${gh.key}`); break; }
        const B2 = R.place(B, r);
        const fe = HAS_PROPS ? await landFlash(rel, pc.want, B2) : '';
        if (fe) f(fe);
        await G.wait(page, 0.1);
        const after = await page.evaluate(id => ({ s: CS.state(), key: CS.rulesKey(), land: CS.events.find(e => e.type === 'land' && e.id === id) }), rel.id);
        B = B2;
        if (!after.land || after.land.key !== gh.key || after.key !== R.key(B) || after.s.lost !== lost0) f(`it did not land where the ghost was: ${JSON.stringify({ land: after.land && after.land.key, ghost: gh.key, build: after.key === R.key(B), lost: [lost0, after.s.lost] })}`);
        T.info(`${tag} ${C.name.split(':')[0]}: the ${C.drops[i]} stays as the rules say (${C.props ? 'propped: the ghost white with a double bar at ' + C.props.length + ' contact, drawn there; on landing it flashed there, then went' : 'half on the piece\'s top'}), the ghost white, it landed where the ghost was`);
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
        let maxA = 0, rockD = 0, n0 = 0, moved = 0, wrongSide = 0, wrongAt = '';
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
          // (a turn too small to show, under a thousandth of a radian at the ends of the loop, leans no way)
          if (JSON.stringify(ar.members) !== JSON.stringify(tp.members) || ar.side !== tp.side || (Math.abs(ar.a) >= 1e-3 && Math.sign(ar.a) !== (tp.side === 'right' ? 1 : -1))) { wrongSide++; wrongAt = JSON.stringify({ a: ar.a, members: ar.members, side: ar.side }); }
          else rockD = Math.max(rockD, ...wps.map((wp, m) => G.polyDist(wp.map(p => M.map(turn(p, ar.a))), ar.polys[m])));
        }
        if (n0 < 6 || maxA < 0.12 || rockD > 1.5 || wrongSide || moved) f(`aimed where it tips, the part rocks: in ${n0}/24 pictures, up to ${maxA.toFixed(3)} rad, ${rockD.toFixed(1)} px from the rules' part turned about its corner, ${wrongSide} the wrong part or side${wrongAt ? ' (' + wrongAt + ')' : ''}, the tiles moved in ${moved}`);
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
    const what = C.fits ? 'every ghost the rules\' drop; the last tile stays, a white ghost' + (C.props ? ' with a double bar at the rules\' prop contact (as §18.9 says), drawn there; it landed there and the bar flashed, then went' : ', and landed there')
      : C.then ? `TIPS OVER as the rules have it; the ${C.then} let go during the rock landed on the part and rocked with it, no joint opening`
        : 'every ghost the rules\' drop; TIPS OVER with its part, corner and plumb line as the rules have them; let go, the part rocked as one body, no whole-edge joint opened, and the tile left the wall';
    T.check(!bad && T.n - T.bad === ok0, `${tag}: ${C.name}: ${C.drops.join(' ')}${C.then ? ', then ' + C.then : ''} through real ${size.touch ? 'touch' : 'mouse'}: ${bad ? 'FAILED' : what}`);
  }
  T.check(hintsSeen === 1, `${tag}: "Too far out: it would tip the tiles under it." came once in ${CASES.filter(C => !C.fits).length} TIPS OVER drops`);
  // The prop sweeps (revision 5e): before each drop of a game the hand is aimed at every column (a finger or the mouse,
  // the fuse held meanwhile), and the ghost there must carry a prop mark exactly when that fit is propped, at the rules'
  // contacts; then the drop is let go and lands, flashing its props exactly when it was propped
  if (HAS_PROPS) for (const SW of SWEEPS) {
    const drops = SW.drops.map(parse), want0 = SW.pre;
    let B = R.newBuild({ half: 2 }), bad = '';
    const n = { cols: 0, propped: 0, fits: 0, off: 0, tipsBeside: 0, left: 0, right: 0, drops: 0, flashed: 0 }, f0 = flashes;
    await page.evaluate(sh => { CS.clear(); CS.setPiece(sh[0]); CS.setBox(sh.slice(1)); }, drops.map(d => d.piece).concat(['sq', 'sq', 'sq', 'sq']));
    await G.wait(page, 0.4);
    for (let i = 0; i < drops.length && !bad; i++) {
      const dr = drops[i];
      if (!(await ready())) { bad = `drop ${i + 1}: the hand never came back`; break; }
      let last = null;
      // (every column once, counted; then the drop's own column again, to let go there)
      for (const [col, counted] of R.cols(B, dr.piece).map(c => [c, true]).concat([[dr.col, false]])) {
        // (the fuse is held while the hand looks over every column: it would let go of the tile)
        await page.evaluate(() => { HAND.fuseT = 0; HAND.fuseMarks = 0; });
        await aim(col);
        const d = await G.display(page), gh = d.ghost, r = R.drop(B, dr.piece, col);
        if (!d.hand || d.hand.col !== col) { bad = `drop ${i + 1}: the hand is at column ${d.hand && d.hand.col}, aimed at ${col}`; break; }
        if (!gh || gh.col !== r.pose.col || gh.way !== r.way || gh.y[0] !== r.pose.y[0] || gh.y[1] !== r.pose.y[1] || gh.style !== (r.outcome === 'fit' ? 'fit' : 'off')) { bad = `drop ${i + 1} at column ${col}: the ghost ${JSON.stringify(gh && { col: gh.col, way: gh.way, y: gh.y, style: gh.style })} is not the rules' drop (${r.outcome} ${r.way} ${r.pose.col})`; break; }
        const pc = propCheck(d, B, dr.piece, col, r);
        if (pc.err) { bad = `drop ${i + 1} (${SW.drops[i]}) aimed at column ${col}: ${pc.err}`; break; }
        last = gh;
        if (!counted) continue;
        n.cols++;
        if (r.outcome !== 'fit') { n.off++; if (besideNoProp(B, dr.piece, r)) n.tipsBeside++; } else if (pc.want.props) { n.propped++; n[pc.want.props[0].side]++; } else n.fits++;
      }
      if (bad) break;
      // let go where the game goes on (the hand was aimed there last)
      const r = R.drop(B, dr.piece, dr.col), want = propsWant(B, dr.piece, dr.col, r);
      if (r.outcome !== 'fit') { bad = `drop ${i + 1} (${SW.drops[i]}) does not fit: ${r.reason}`; break; }
      await input.release(); await G.frame(page);
      const rel = await page.evaluate(() => CS.lastRelease);
      if (!rel || !last || rel.key !== last.key || rel.outcome !== 'fit') { bad = `drop ${i + 1}: the press let go of ${JSON.stringify(rel && rel.key)}, the ghost showed ${last && last.key}`; break; }
      B = R.place(B, r);
      n.drops++; if (want.props) n.flashed++;
      const fe = await landFlash(rel, want, B);
      if (fe) { bad = `drop ${i + 1} (${SW.drops[i]}): ${fe}`; break; }
      // (the tower settles before the hand looks again: a landing rocks it a little)
      for (let k = 0; k < 30 && !(await G.state(page)).still; k++) await G.wait(page, 0.1);
    }
    if (!bad && (await page.evaluate(() => CS.rulesKey())) !== R.key(B)) bad = 'after the game the page\'s build is not the rules\'';
    const same = JSON.stringify(n) === JSON.stringify(want0);
    T.check(!bad && same && flashes - f0 === n.flashed, `${tag}: props sweep, ${SW.name}: ${SW.drops.join(' ')} through real ${size.touch ? 'touch' : 'mouse'}, every column aimed before each drop: ` +
      (bad ? 'FAILED: ' + bad : `${n.cols} columns, the prop mark on exactly the ${n.propped} propped fits (${n.right} leaning right, ${n.left} left; the props-off rules call each TIPS OVER) and on none of the ${n.fits} other fits or the ${n.off} that fall off (${n.tipsBeside} of them TIPS OVER beside a square that does not prop), at the rules' contacts; ${n.drops} drops let go, ${n.flashed} of them propped, and exactly those flashed on landing, at their contacts` +
        (same ? '' : `; but the game in Node counts ${JSON.stringify(want0)}, here ${JSON.stringify(n)}`)));
  }
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
  if (HAS_PROPS) {
    // (each sweep still tests what it was chosen for, on these rules; and the props-off rules could be built)
    T.check(!!M, 'the page\'s rules with props switched off load (the props-off comparison)');
    preSweeps();
    for (const SW of SWEEPS) T.check(SW.ok, `props sweep ${SW.name}: on the page's rules every drop fits and the game has ${Object.entries(SW.need).map(([k, v]) => k + ' ≥ ' + v).join(', ')}: ${JSON.stringify(SW.pre)}`);
  } else T.info(`rules: no RULES.props (before revision 5e): golden 19 and the prop checks are skipped`);
  const browser = await G.launch();
  try {
    for (const size of G.sizesFrom()) await oneSize(browser, size);
  } finally { await browser.close(); }
  T.done();
})().catch(e => { console.error(e); process.exitCode = 1; });
