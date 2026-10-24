'use strict';
// The rules sandbox renderer (DESIGN §18.8 G2), revision 5d: draws a build from rules.js alone, as plain outlined
// shapes in the tiles' colours on white, with the tile in the hand, its dotted fall line and, optionally, the outcome:
// - stays: the tile where it will sit, its contact segments shining (gold), a ×2 / ×3 chip for several neighbours;
// - falls off, ONLY A POINT: the tile red and dashed where it stops, and red dots at the points it touches;
// - falls off, TIPS OVER (§18.2, §18.4): the tile red and dashed where it stops, the group that would tip (the tiles of
//   rules' tips.members, the new tile among them) drawn whole, as one piece: every tile of it tinted red, one red
//   outline round the outside of the group (the joints inside it only faintly), a red dot at the pivot, and a small
//   plumb line from the group's centre of weight down past the pivot, labelled TIPS OVER.
// A thin gap (under 0.3 tile, e.g. 0.134 or 0.268) between part of a tile's bottom and the flat top below it is left
// OPEN (§18.2): no fill, only a fine dotted outline, so it reads as air, not as a joint or an extra piece.
//
//   const S = require('./tools/sandbox/render.cjs');
//   const png = await S.renderBuild({ drops: ['■1'], hand: '▲1.5', outcome: true, title: '…', caption: '…' });
//   const sheet = await S.renderSheet([spec, spec, …], 3);
//   await S.close();
//
// A spec: { half = 2, drops: ['■1', '▲-0.5', …] or log: [{piece, col, way}], hand: '▲1.5' or {piece, col, way?}
//   (way omitted: the way the rules choose), outcome = true, fits = false (faint marks at every place the hand's tile
//   fits), slivers = true, title, caption, L = px per tile, R = a rules module (default: rules.js through the vm
//   loader) }.
const canon = require('../lib/canon.cjs');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }

// the tiles' colours; red is left out (since revision 5c) because red is what marks a tile that falls off and the
// group that would tip
const COLORS = ['#2F5BEA', '#FFD21F', '#2EBF4F', '#FF7A1A', '#5EC8F2', '#8A4FE0'];
const STROKE = { '#FFD21F': '#D9A800', '#5EC8F2': '#2FA6D6' }; // pale colours get a deeper outline on white
const RED = '#E8323C', GOLD = '#FFC531', INK = '#1E2541', SLIVER = '#4a5068';
// a thin gap, drawn open: no fill, a fine dotted outline (shared with tools/review/lib.cjs)
function gapSVG(pts) { return `<polygon points="${pts}" fill="none" stroke="${SLIVER}" stroke-width="0.9" stroke-dasharray="1.2 2.2" stroke-linejoin="round"/>`; }
const R3 = Math.sqrt(3);
const yOf = (p, q) => (p + q * R3) / 2;
const P = v => ({ x: v[0] / 2, y: yOf(v[1], v[2]) });

let RULES = null;
function rules(spec) { return spec.R || RULES || (RULES = require('../lib/rules-vm.cjs').load()); }

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function parseHand(h) {
  if (!h) return null;
  if (typeof h === 'string') {
    const m = /^([■▲▼△])\s*(-?\d+(?:\.5)?)$/.exec(h.replace('−', '-').trim());
    if (!m) throw new Error('hand: ' + h);
    const col = Math.round(parseFloat(m[2]) * 2);
    return m[1] === '■' ? { piece: 'sq', col } : { piece: 'tri', col, way: m[1] === '▲' ? 'up' : m[1] === '▼' ? 'down' : undefined };
  }
  return h;
}
// a tile's corners (in tiles) for a piece/way/col with its lowest point at y
function shapeAt(piece, way, col, y) {
  const x = col / 2, h = R3 / 2;
  if (piece === 'sq') return [{ x, y }, { x: x + 1, y }, { x: x + 1, y: y + 1 }, { x, y: y + 1 }];
  if (way === 'down') return [{ x: x + 0.5, y }, { x: x + 1, y: y + h }, { x, y: y + h }];
  return [{ x, y }, { x: x + 1, y }, { x: x + 0.5, y: y + h }];
}
// top of a convex polygon at x (null if x is outside it)
function topOf(poly, x) {
  let best = null;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const lo = Math.min(a.x, b.x), hi = Math.max(a.x, b.x);
    if (x < lo - 1e-12 || x > hi + 1e-12) continue;
    const y = Math.abs(b.x - a.x) < 1e-12 ? Math.max(a.y, b.y) : a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
    if (best === null || y > best) best = y;
  }
  return best;
}
// Thin gaps (§18.2): under each half of the flat bottom of a square or ▲ (its bottom at yb from x0 to x0 + 1), the
// topmost thing below it (other polygons whose top over that half is not above yb, and the car top); where that is
// below the bottom by less than `thin` at both ends of the half, the space between is a sliver. Returns polygons.
function sliversUnder(x0, yb, others, half, thin) {
  const out = [], eps = 1e-7, T = thin || 0.3;
  for (let j = 0; j < 2; j++) {
    const xs = x0 + j / 2, xe = xs + 0.5;
    let best = xs >= -half - eps && xe <= half + eps ? [0, 0] : null;
    for (const p of others) {
      const xsP = p.map(v => v.x);
      if (Math.min(...xsP) > xs + eps || Math.max(...xsP) < xe - eps) continue;
      const a = topOf(p, xs + 1e-9), b = topOf(p, xe - 1e-9);
      if (a === null || b === null || (a + b) / 2 > yb + eps) continue;
      if (!best || a + b > best[0] + best[1]) best = [a, b];
    }
    if (!best) continue;
    const d0 = yb - best[0], d1 = yb - best[1];
    if (d0 > 1e-6 && d1 > 1e-6 && d0 < T && d1 < T) out.push([{ x: xs, y: yb }, { x: xe, y: yb }, { x: xe, y: best[1] }, { x: xs, y: best[0] }]);
  }
  return out;
}
// the centre of weight of a part ([{piece, poly}]): squares weigh 1, triangles √3/4 (their areas), each at its centroid
function weightCentre(items) {
  let W = 0, x = 0, y = 0;
  for (const it of items) {
    const w = it.piece === 'sq' ? 1 : R3 / 4, c = it.poly.reduce((a, v) => ({ x: a.x + v.x / it.poly.length, y: a.y + v.y / it.poly.length }), { x: 0, y: 0 });
    W += w; x += w * c.x; y += w * c.y;
  }
  return { x: x / W, y: y / W };
}
// The outline of a set of polygons drawn as one shape: every edge, less the stretches it shares with an edge of another
// polygon of the set. Returns {outer, inner}: segments [{x, y}, {x, y}] of the outside boundary, and of the joints
// inside (each shared stretch once). Floats, for drawing only (lattice points, so a tolerance of 1e-7 is exact enough).
function outlineOf(polys) {
  const E = 1e-7, outer = [], inner = [];
  polys.forEach((P, i) => P.forEach((a, k) => {
    const b = P[(k + 1) % P.length], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy, cover = [];
    polys.forEach((Q, j) => {
      if (j === i) return;
      Q.forEach((c, m) => {
        const d = Q[(m + 1) % Q.length];
        const off = (p) => Math.abs(dx * (p.y - a.y) - dy * (p.x - a.x)) / Math.sqrt(L2);
        if (off(c) > E || off(d) > E) return; // not on this edge's line
        const tc = ((c.x - a.x) * dx + (c.y - a.y) * dy) / L2, td = ((d.x - a.x) * dx + (d.y - a.y) * dy) / L2;
        const lo = Math.max(0, Math.min(tc, td)), hi = Math.min(1, Math.max(tc, td));
        if (hi - lo > E) cover.push([lo, hi, j]);
      });
    });
    cover.sort((u, v) => u[0] - v[0]);
    const at = t => ({ x: a.x + dx * t, y: a.y + dy * t });
    let t = 0;
    for (const [lo, hi, j] of cover) {
      if (lo > t + E) outer.push([at(t), at(lo)]);
      if (j > i) inner.push([at(Math.max(lo, t)), at(hi)]); // each shared stretch once, from the lower-numbered polygon
      t = Math.max(t, hi);
    }
    if (t < 1 - E) outer.push([at(t), at(1)]);
  }));
  return { outer, inner };
}
// the thin gaps under every square and ▲ of a set of polygons ({poly, flat: true when its bottom is a flat edge})
function sliversOf(items, half, thin) {
  const out = [];
  items.forEach((it, i) => {
    if (!it.flat) return;
    const ys = it.poly.map(v => v.y), yb = Math.min(...ys), x0 = Math.min(...it.poly.map(v => v.x));
    out.push(...sliversUnder(x0, yb, items.filter((_, k) => k !== i).map(o => o.poly), half, thin));
  });
  return out;
}

// Everything a picture needs, from the rules: the build's tiles, the hand, the result (or the throw)
function model(spec) {
  const R = rules(spec), half = spec.half || 2;
  const log = spec.log || (spec.drops || []).map(canon.parseDrop);
  const B = canon.replay(R, half, log);
  const tiles = R.tiles(B);
  const hand = parseHand(spec.hand);
  let res = null, err = null;
  if (hand) {
    try { res = R.drop(B, hand.piece, hand.col, hand.piece === 'sq' ? undefined : hand.way); } catch (e) { err = e.message; }
  }
  let fits = [];
  if (spec.fits && hand && !err) fits = R.fitsAll(B, hand.piece).filter(r => r.outcome === 'fit');
  return { R, half, log, B, tiles, hand, res, err, fits };
}

// one picture as an SVG string, with its size
function svgFor(spec) {
  const M = model(spec);
  const L = spec.L || 56, half = M.half, h = R3 / 2;
  const showOutcome = spec.outcome !== false;
  const polys = M.tiles.map(t => shapeAt(t.piece, t.way, t.col, yOf(t.y[0], t.y[1])));
  // the hand: its tile's bottom 1.1 tiles above everything (and above the landing)
  let top = 0;
  for (const p of polys) for (const v of p) top = Math.max(top, v.y);
  let land = null;
  if (M.res) { land = M.res.verts.map(P); for (const v of land) top = Math.max(top, v.y); }
  const hand = M.hand;
  const handWay = hand && hand.piece === 'tri' ? (M.res ? M.res.way : hand.way || 'up') : null;
  const handY = top + (M.err ? 1.75 : 1.1);
  const handPoly = hand ? shapeAt(hand.piece, handWay, hand.col, handY) : null;
  // view box
  let x0 = -half - 0.6, x1 = half + 0.6, y0 = -0.75, y1 = handPoly ? handY + 1.45 : top + 0.6;
  for (const p of polys.concat(handPoly ? [handPoly] : [], land ? [land] : [])) for (const v of p) { x0 = Math.min(x0, v.x - 0.35); x1 = Math.max(x1, v.x + 0.35); }
  if (spec.view) { x0 = spec.view.x0 ?? x0; x1 = spec.view.x1 ?? x1; y1 = spec.view.y1 ?? y1; }
  const W = Math.round((x1 - x0) * L), H = Math.round((y1 - y0) * L);
  const X = x => ((x - x0) * L).toFixed(1), Y = y => ((y1 - y) * L).toFixed(1);
  const pts = poly => poly.map(v => X(v.x) + ',' + Y(v.y)).join(' ');
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, 'DejaVu Sans', sans-serif">`);
  out.push(`<defs><marker id="arrowG" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7d8597"/></marker></defs>`);
  out.push(`<rect width="${W}" height="${H}" fill="#fff"/>`);
  // the floor and the car: a plain plate with four whole-tile panels and two wheels
  out.push(`<line x1="0" x2="${W}" y1="${Y(-0.62)}" y2="${Y(-0.62)}" stroke="#c9ccd3" stroke-width="1.5"/>`);
  out.push(`<rect x="${X(-half)}" y="${Y(0)}" width="${(2 * half * L).toFixed(1)}" height="${(0.36 * L).toFixed(1)}" fill="#f1f2f5" stroke="#6b7080" stroke-width="1.5"/>`);
  for (let i = -half + 1; i < half; i++) out.push(`<line x1="${X(i)}" x2="${X(i)}" y1="${Y(0)}" y2="${Y(-0.36)}" stroke="#a3a8b4" stroke-width="1"/>`);
  for (const wx of [-half + 0.45, half - 0.45]) out.push(`<circle cx="${X(wx)}" cy="${Y(-0.46)}" r="${(0.15 * L).toFixed(1)}" fill="#fff" stroke="#6b7080" stroke-width="1.5"/>`);
  const sliver = poly => gapSVG(pts(poly));
  // the placed tiles, and the thin gaps under them
  M.tiles.forEach((t, i) => {
    const c = COLORS[i % COLORS.length], poly = polys[i];
    out.push(`<polygon points="${pts(poly)}" fill="${c}" fill-opacity="0.2" stroke="${STROKE[c] || c}" stroke-width="2.2" stroke-linejoin="round"/>`);
  });
  if (spec.slivers !== false) for (const s of sliversOf(M.tiles.map((t, i) => ({ poly: polys[i], flat: t.way !== 'down' })), half)) out.push(sliver(s));
  // every place the hand's tile fits (faint): squares an outline, ▲ a bracket along the base, ▼ a chevron on its slant
  for (const f of M.fits) {
    const xs = f.pose.col / 2, yb = yOf(f.pose.y[0], f.pose.y[1]);
    if (f.pose.type === 'sq') out.push(`<polygon points="${pts(shapeAt('sq', null, f.pose.col, yb))}" fill="none" stroke="#7d8597" stroke-width="1.2" stroke-dasharray="2 3"/>`);
    else if (f.pose.type === 'up') out.push(`<polyline points="${X(xs + 0.06)},${Y(yb + 0.1)} ${X(xs + 0.06)},${Y(yb + 0.03)} ${X(xs + 0.94)},${Y(yb + 0.03)} ${X(xs + 0.94)},${Y(yb + 0.1)}" fill="none" stroke="#7d8597" stroke-width="2"/>`);
    else {
      const cx = xs + 0.5, cy = yb + h * 0.55;
      out.push(`<polyline points="${X(cx - 0.12)},${Y(cy + 0.08)} ${X(cx)},${Y(cy - 0.06)} ${X(cx + 0.12)},${Y(cy + 0.08)}" fill="none" stroke="#7d8597" stroke-width="2"/>`);
    }
  }
  const handColor = COLORS[M.tiles.length % COLORS.length];
  // the fall line: the tile's width, dotted, from the hand down to where it stops
  if (hand && !M.err && land) {
    const lx = hand.col / 2, rx = lx + 1;
    const stopL = topOf(land, lx), stopR = topOf(land, rx);
    const yTopL = Math.min(...handPoly.map(v => v.y)), yTopR = yTopL;
    out.push(`<line x1="${X(lx)}" x2="${X(lx)}" y1="${Y(yTopL)}" y2="${Y(stopL)}" stroke="#7d8597" stroke-width="1.6" stroke-dasharray="1.5 5" stroke-linecap="round"/>`);
    out.push(`<line x1="${X(rx)}" x2="${X(rx)}" y1="${Y(yTopR)}" y2="${Y(stopR)}" stroke="#7d8597" stroke-width="1.6" stroke-dasharray="1.5 5" stroke-linecap="round"/>`);
    out.push(`<line x1="${X(lx + 0.5)}" x2="${X(lx + 0.5)}" y1="${Y(yTopL - 0.12)}" y2="${Y(yTopL - 0.42)}" stroke="#7d8597" stroke-width="1.6" marker-end="url(#arrowG)"/>`);
  }
  // the hand and its tile
  if (hand) {
    const hc = M.err ? RED : handColor;
    const top2 = Math.max(...handPoly.map(v => v.y)), cx = hand.col / 2 + 0.5;
    out.push(`<rect x="${X(cx - 0.17)}" y="${Y(top2 + 0.32)}" width="${(0.34 * L).toFixed(1)}" height="${(0.36 * L).toFixed(1)}" rx="${(0.08 * L).toFixed(1)}" fill="#e9eaee" stroke="#6b7080" stroke-width="1.4"/>`);
    out.push(`<polygon points="${pts(handPoly)}" fill="${hc}" fill-opacity="${M.err ? 0.08 : 0.2}" stroke="${STROKE[hc] || hc}" stroke-width="2.2" stroke-linejoin="round"${M.err ? ' stroke-dasharray="7 5"' : ''}/>`);
    if (M.err) {
      // a square can't be aimed half a tile off: the hand snaps to the whole-tile columns either side
      const xL = hand.col / 2, yb = handY;
      out.push(`<line x1="${X(xL + 0.12)}" y1="${Y(yb + 0.12)}" x2="${X(xL + 0.88)}" y2="${Y(yb + 0.88)}" stroke="${RED}" stroke-width="3"/><line x1="${X(xL + 0.88)}" y1="${Y(yb + 0.12)}" x2="${X(xL + 0.12)}" y2="${Y(yb + 0.88)}" stroke="${RED}" stroke-width="3"/>`);
      for (const c of [hand.col - 1, hand.col + 1]) {
        if (c < -2 * half || c > 2 * half - 2) continue;
        out.push(`<polygon points="${pts(shapeAt('sq', null, c, top))}" fill="none" stroke="#7d8597" stroke-width="1.5" stroke-dasharray="3 4"/>`);
      }
      out.push(`<text x="${X(xL + 0.5)}" y="${Y(yb - 0.42)}" text-anchor="middle" font-size="13" font-weight="800" fill="${RED}" stroke="#fff" stroke-width="3" paint-order="stroke">CAN'T AIM HERE</text>`);
    }
  }
  // the outcome
  if (hand && M.res && showOutcome) {
    const r = M.res, poly = shapeAt(hand.piece, r.way, hand.col, yOf(r.pose.y[0], r.pose.y[1]));
    const yb = Math.min(...poly.map(v => v.y)), xL = hand.col / 2;
    if (r.outcome === 'fit') {
      // a thin gap under part of it: left open, a fine dotted outline
      if (r.way !== 'down' && spec.slivers !== false) for (const s of sliversUnder(xL, yb, polys, half)) out.push(sliver(s));
      out.push(`<polygon points="${pts(poly)}" fill="${handColor}" fill-opacity="0.32" stroke="${STROKE[handColor] || handColor}" stroke-width="2.6" stroke-linejoin="round"/>`);
      for (const s of r.shine) {
        const a = P(s[0]), b = P(s[1]);
        out.push(`<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(b.x)}" y2="${Y(b.y)}" stroke="${GOLD}" stroke-width="8" stroke-linecap="round" opacity="0.95"/>` +
          `<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(b.x)}" y2="${Y(b.y)}" stroke="#fff6cc" stroke-width="2.4" stroke-linecap="round"/>`);
      }
      if (r.shine.length >= 2) {
        const top3 = Math.max(...poly.map(v => v.y));
        out.push(`<g transform="translate(${X(xL + 1.05)},${Y(top3 + 0.05)})"><rect x="0" y="-15" width="30" height="20" rx="10" fill="${GOLD}"/><text x="15" y="0" text-anchor="middle" font-size="13" font-weight="700" fill="${INK}">×${r.shine.length}</text></g>`);
      }
    } else if (r.reason === 'TIPS OVER' && r.tips) {
      // TIPS OVER: the group that would tip drawn whole, as one piece (the new tile, red and dashed where it would
      // stop, among it): its tiles tinted, one red outline round its outside, the joints inside it faint; a red dot at
      // the pivot, and a plumb line from the group's centre of weight down past the pivot
      const t = r.tips, n = M.tiles.length, partPolys = t.members.map(i => i === n ? poly : polys[i]);
      const ol = outlineOf(partPolys), line = (sg, extra) => `<line x1="${X(sg[0].x)}" y1="${Y(sg[0].y)}" x2="${X(sg[1].x)}" y2="${Y(sg[1].y)}" ${extra}/>`;
      for (const pp of partPolys) out.push(`<polygon points="${pts(pp)}" fill="${RED}" fill-opacity="0.12" stroke="none"/>`);
      for (const sg of ol.outer) out.push(line(sg, `stroke="${RED}" stroke-opacity="0.25" stroke-width="9" stroke-linecap="round"`));
      for (const sg of ol.inner) out.push(line(sg, `stroke="${RED}" stroke-opacity="0.45" stroke-width="1" stroke-dasharray="2 3"`));
      out.push(`<polygon points="${pts(poly)}" fill="none" stroke="${RED}" stroke-width="1.6" stroke-dasharray="7 5" stroke-linejoin="round"/>`);
      for (const sg of ol.outer) out.push(line(sg, `stroke="${RED}" stroke-width="3" stroke-linecap="round"`));
      const cw = weightCentre(t.members.map(i => i === n ? { piece: hand.piece, poly } : { piece: M.tiles[i].piece, poly: polys[i] }));
      const pv = P(t.pivot), cx = typeof t.com === 'number' ? t.com : cw.x, yBob = Math.min(pv.y, cw.y) - 0.42;
      out.push(`<line x1="${X(cx)}" y1="${Y(cw.y)}" x2="${X(cx)}" y2="${Y(yBob)}" stroke="${RED}" stroke-width="1.6"/>`);
      out.push(`<circle cx="${X(cx)}" cy="${Y(cw.y)}" r="3.2" fill="#fff" stroke="${RED}" stroke-width="1.6"/>`);
      out.push(`<path d="M${X(cx - 0.07)},${Y(yBob)} L${X(cx + 0.07)},${Y(yBob)} L${X(cx)},${Y(yBob - 0.15)} z" fill="${RED}"/>`);
      // a faint level line from the pivot out to the plumb line shows how far past the pivot the weight hangs
      out.push(`<line x1="${X(pv.x)}" y1="${Y(pv.y)}" x2="${X(cx)}" y2="${Y(pv.y)}" stroke="${RED}" stroke-width="1" stroke-dasharray="2 3" opacity="0.8"/>`);
      out.push(`<circle cx="${X(pv.x)}" cy="${Y(pv.y)}" r="6.5" fill="${RED}" stroke="#fff" stroke-width="1.5"/>`);
      const top3 = Math.max(...poly.map(v => v.y));
      const tx = Math.min(Math.max(xL + 0.5, x0 + 1.0), x1 - 1.0);
      out.push(`<text x="${X(tx)}" y="${Y(top3 + 0.14)}" text-anchor="middle" font-size="13" font-weight="800" fill="${RED}" stroke="#fff" stroke-width="3" paint-order="stroke">TIPS OVER</text>`);
    } else {
      out.push(`<polygon points="${pts(poly)}" fill="${RED}" fill-opacity="0.07" stroke="${RED}" stroke-width="2.4" stroke-dasharray="7 5" stroke-linejoin="round"/>`);
      // ONLY A POINT: a red dot at every point it touches (contact points, and the ends of side contacts on its bottom)
      const onBottom = q => r.way !== 'down' && q[1] === r.pose.y[0] && q[2] === r.pose.y[1] && q[0] >= hand.col && q[0] <= hand.col + 2;
      const dots = r.contacts.points.concat([].concat(...r.contacts.segments).filter(onBottom));
      for (const q of dots.filter((q, i, a) => a.findIndex(z => z.join() === q.join()) === i)) {
        const v = P(q);
        out.push(`<circle cx="${X(v.x)}" cy="${Y(v.y)}" r="6.5" fill="${RED}" stroke="#fff" stroke-width="1.5"/>`);
      }
      // the reason, beside the ghost
      const top3 = Math.max(...poly.map(v => v.y));
      const tx = Math.min(Math.max(xL + 0.5, x0 + 1.0), x1 - 1.0);
      out.push(`<text x="${X(tx)}" y="${Y(top3 + 0.14)}" text-anchor="middle" font-size="13" font-weight="800" fill="${RED}" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(r.reason)}</text>`);
    }
  }
  out.push('</svg>');
  return { svg: out.join(''), W, H, M };
}

function verdict(M) {
  if (M.err) return { text: 'IMPOSSIBLE (throws)', color: RED };
  if (!M.res) return { text: '', color: INK };
  return M.res.outcome === 'fit' ? { text: 'STAYS', color: '#1d8f3a' } : { text: 'FALLS OFF: ' + M.res.reason, color: RED };
}
function cellHTML(spec, opts) {
  const { svg, W, M } = svgFor(spec);
  const v = verdict(M);
  const showVerdict = spec.outcome !== false && opts.verdict !== false;
  return `<div class="cell" style="width:${Math.max(W, opts.minW || 0) + 22}px">` +
    (spec.title ? `<div class="title">${esc(spec.title)}</div>` : '') +
    (spec.sub ? `<div class="sub">${esc(spec.sub)}</div>` : '') +
    `<div class="pic">${svg}</div>` +
    (showVerdict && v.text ? `<div class="verdict" style="color:${v.color}">${esc(v.text)}</div>` : '') +
    (spec.caption ? `<div class="cap">${esc(spec.caption)}</div>` : '') + '</div>';
}
const CSS = `*{box-sizing:border-box}body{margin:0;background:#fff;font-family:system-ui,'DejaVu Sans',sans-serif;color:${INK}}
#root{display:inline-block;padding:18px;background:#fff}
.head{font-size:22px;font-weight:800;margin:2px 4px 4px}.headsub{font-size:13px;color:#4a5068;margin:0 4px 14px;max-width:1100px;line-height:1.35}
.grid{display:grid;gap:14px 14px;align-items:end}
.cell{border:1px solid #dfe2e8;border-radius:10px;padding:10px 10px 10px;background:#fff;display:flex;flex-direction:column;align-items:center;height:100%}
.title{font-size:14px;font-weight:700;align-self:flex-start;margin-bottom:2px}.sub{font-size:11.5px;color:#5a6075;align-self:flex-start;margin-bottom:4px;font-family:'DejaVu Sans Mono',monospace}
.pic{margin-top:auto}.verdict{font-size:14px;font-weight:800;margin-top:4px;letter-spacing:.02em}
.cap{font-size:13px;line-height:1.3;margin-top:4px;text-align:center;max-width:100%}`;

let browser = null;
async function getBrowser() { if (!browser) browser = await pw.chromium.launch(); return browser; }
async function shoot(html, dpr) {
  const b = await getBrowser();
  const page = await b.newPage({ deviceScaleFactor: dpr || 2, viewport: { width: 800, height: 600 } });
  try {
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div id="root">${html}</div></body></html>`);
    return await page.locator('#root').screenshot({ type: 'png' });
  } finally { await page.close(); }
}
// one picture -> PNG Buffer
async function renderBuild(spec, opts) {
  opts = opts || {};
  return shoot(cellHTML(spec, opts).replace('class="cell"', 'class="cell" style="border:none"'), opts.dpr);
}
// a sheet of pictures in `cols` columns, each with its title, verdict and caption -> PNG Buffer
async function renderSheet(items, cols, opts) {
  opts = opts || {};
  cols = cols || 3;
  const sized = items.map(s => svgFor(s).W);
  const minW = Math.max(...sized);
  const cells = items.map(s => cellHTML(s, { minW, verdict: opts.verdict }));
  const head = opts.title ? `<div class="head">${esc(opts.title)}</div>` + (opts.subtitle ? `<div class="headsub">${esc(opts.subtitle)}</div>` : '') : '';
  return shoot(head + `<div class="grid" style="grid-template-columns:repeat(${cols}, ${minW + 22}px)">${cells.join('')}</div>`, opts.dpr);
}
async function close() { if (browser) { const b = browser; browser = null; await b.close(); } }

module.exports = { renderBuild, renderSheet, svgFor, model, close, COLORS, sliversUnder, sliversOf, topOf, SLIVER, gapSVG, weightCentre, outlineOf };

// node tools/sandbox/render.cjs '<spec JSON or [specs]>' out.png [cols]
if (require.main === module) {
  const [json, outPath, cols] = process.argv.slice(2);
  if (!json || !outPath) { console.error("usage: node tools/sandbox/render.cjs '<spec JSON or [specs]>' out.png [cols]"); process.exit(2); }
  const spec = JSON.parse(json.trim().startsWith('{') || json.trim().startsWith('[') ? json : require('fs').readFileSync(json, 'utf8'));
  (Array.isArray(spec) ? renderSheet(spec, +cols || 3) : renderBuild(spec)).then(async png => {
    require('fs').writeFileSync(outPath, png);
    console.log('wrote ' + outPath);
    await close();
  }).catch(async e => { console.error(e); await close(); process.exit(1); });
}
