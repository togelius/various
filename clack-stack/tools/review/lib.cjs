'use strict';
// Shared pieces for the human-style review material (DESIGN §18.8 G2 intuition panel and plausibility review),
// revision 5c:
// - the exhaustive walk of reachable builds on the real base (fitting drops only, mirror images merged), like
//   tools/rules/enumerate.cjs but keeping the builds so items and extremes can be picked from them;
// - what lies under a dropped tile at rest, half by half, in exact numbers (for sorting items into strata);
// - how a tile that falls off leaves (fall(), §18.2): it never comes to rest in the wall. It tips a little about the
//   point it touched, then falls out of the wall toward the viewer and lands flat on the rug below the car, drawn
//   foreshortened and fading, clearly out of the wall plane. For TIPS OVER, the part that would tip is drawn tinted
//   and rocked a few degrees toward its pivot (with the pivot dot and the plumb line from its centre of weight), then
//   back, and the new tile falls out of the wall. Placed tiles never move: the rock is only a tell, and every later
//   frame shows the part where it was;
// - sandbox-style drawing (tools/sandbox/render.cjs's look: plain outlined tiles in the tiles' colours on white, the
//   car as a plate with four whole-tile panels and two wheels, the rug in front of it, thin gaps under tiles left open
//   with a fine dotted outline) of arbitrary polygons, so planted defects can be drawn directly, bypassing the rules;
// - a seeded random generator and the headless-browser screenshot.
const canon = require('../lib/canon.cjs');
const { COLORS, sliversOf, topOf, SLIVER, gapSVG, weightCentre } = require('../sandbox/render.cjs');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }

const R3 = Math.sqrt(3), H = R3 / 2;
let RULES = null;
function rules() { return RULES || (RULES = require('../lib/rules-vm.cjs').load()); }

// ---- exact heights: [p, q] means (p + q√3)/2 ----
function sgn(dp, dq) {
  if (dp === 0 && dq === 0) return 0;
  if (dp >= 0 && dq >= 0) return 1;
  if (dp <= 0 && dq <= 0) return -1;
  const l = dp * dp, r = 3 * dq * dq;
  return dp > 0 ? (l > r ? 1 : -1) : (l > r ? -1 : 1);
}
const cmp = (a, b) => sgn(a[0] - b[0], a[1] - b[1]);
const eq = (a, b) => a[0] === b[0] && a[1] === b[1];
const yv = a => (a[0] + a[1] * R3) / 2;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];

// ---- tiles ----
const typeOf = t => t.piece === 'sq' ? 'sq' : t.way === 'up' ? 'up' : 'dn';
// a tile's top over its half j (0 left, 1 right): the heights at the half's two ends
function topOver(type, y, j) {
  const [p, q] = y;
  if (type === 'sq') return [[p + 2, q], [p + 2, q]];
  if (type === 'dn') return [[p, q + 1], [p, q + 1]];
  return j === 0 ? [[p, q], [p, q + 1]] : [[p, q + 1], [p, q]];
}
// a tile's corners in tiles (floats) for type/col with its lowest point at height y (float)
function shape(type, col, y) {
  const x = col / 2;
  if (type === 'sq') return [{ x, y }, { x: x + 1, y }, { x: x + 1, y: y + 1 }, { x, y: y + 1 }];
  if (type === 'dn') return [{ x: x + 0.5, y }, { x: x + 1, y: y + H }, { x, y: y + H }];
  return [{ x, y }, { x: x + 1, y }, { x: x + 0.5, y: y + H }];
}
const polyOf = t => shape(typeOf(t), t.col, yv(t.y));
function fmtTile(t) { return (t.piece === 'sq' ? '■' : t.way === 'down' ? '▼' : '▲') + (t.col / 2); }
function fmtHand(piece, col, way) { return (piece === 'sq' ? '■' : way === 'down' ? '▼' : way === 'up' ? '▲' : '△') + (col / 2); }
const parse = s => canon.parseDrop(s);
function replayStrs(drops, half) { return canon.replay(rules(), half || 2, drops.map(parse)); }
function tryReplay(log, half) { try { return canon.replay(rules(), half || 2, log); } catch (e) { return null; } }

// ---- the exhaustive walk ----
// keys: a build's tiles as type@col,p,q sorted; the mirror form maps col -> −col − 2; the canonical form is the smaller
function keysOf(T) {
  const a = [], b = [];
  for (const t of T) { const k = typeOf(t); a.push(k + '@' + t.col + ',' + t.y); b.push(k + '@' + (-t.col - 2) + ',' + t.y); }
  a.sort(); b.sort();
  const ka = a.join(' '), kb = b.join(' ');
  return { key: ka, ck: ka <= kb ? ka : kb };
}
// every build reachable by fitting drops, to maxDepth tiles; one node per mirror pair (the first found). A node is
// {B, T (tiles), ck (canonical key), key (its own key), log, depth, kids: [{drop, node}]}; a kid node may be stored as
// the mirror image of what the drop made (same ck), so rebuild from log + drop when the exact build matters.
// Under 5b builds grow about ×4.2 a depth (22,865 at depth 6, 96,015 at 7, 396,489 at 8).
function walk(maxDepth, half) {
  const R = rules();
  half = half || 2;
  const root = { B: R.newBuild({ half }), log: [], depth: 0 };
  root.T = R.tiles(root.B); Object.assign(root, keysOf(root.T));
  const nodes = [root], seen = new Map([[root.ck, root]]);
  let frontier = [root];
  for (let d = 1; d <= maxDepth; d++) {
    const next = [];
    for (const n of frontier) {
      n.kids = [];
      for (const [piece, way] of [['sq', undefined], ['tri', 'up'], ['tri', 'down']]) {
        for (const col of R.cols(n.B, piece)) {
          const r = R.drop(n.B, piece, col, way);
          if (r.outcome !== 'fit') continue;
          const B = R.place(n.B, r), T = R.tiles(B), K = keysOf(T), drop = { piece, col, way: way || null };
          let c = seen.get(K.ck);
          if (!c) {
            c = { B, T, ck: K.ck, key: K.key, log: n.log.concat([drop]), depth: d };
            seen.set(K.ck, c); nodes.push(c); next.push(c);
          }
          n.kids.push({ drop, node: c });
        }
      }
    }
    frontier = next;
  }
  return { nodes, seen };
}

// ---- what is under a tile at rest ----
// Per half-tile column s: the topmost thing there (the car or a tile), its top at the column's two ends.
function colTop(T, half, s) {
  let best = null;
  if (s >= -2 * half && s < 2 * half) best = { kind: 'car', idx: -1, e: [[0, 0], [0, 0]] };
  T.forEach((t, i) => {
    if (s !== t.col && s !== t.col + 1) return;
    const e = topOver(typeOf(t), t.y, s - t.col);
    if (!best || cmp([e[0][0] + e[1][0], e[0][1] + e[1][1]], [best.e[0][0] + best.e[1][0], best.e[0][1] + best.e[1][1]]) > 0) best = { kind: typeOf(t), idx: i, e };
  });
  return best || { kind: 'none', idx: -2, e: null };
}
// For a square or ▲ at rest (bottom at y0) or a ▼ (point at y0), per half of the tile (halves[0] left, [1] right): the
// topmost thing below it there, its top at the half's two ends, and how that top meets the tile's bottom:
// flat (a flat top), at0 (a flat top at exactly y0: it holds there), low (a flat top below y0), slant (a ▲ side),
// touch (the top reaches y0 at an end), gap (y0 minus the top's lower end).
function describe(B, piece, col, res) {
  const T = rules().tiles(B), half = B.half;
  const type = piece === 'sq' ? 'sq' : res.way === 'up' ? 'up' : 'dn';
  const y0 = res.pose.y;
  const halves = [0, 1].map(j => {
    const st = colTop(T, half, col + j);
    if (!st.e) return Object.assign(st, { flat: false, at0: false, low: false, slant: false, touch: false, gap: null });
    const [a, b] = st.e;
    const flat = eq(a, b);
    const lo = cmp(a, b) <= 0 ? a : b;
    return Object.assign(st, { flat, at0: flat && eq(a, y0), low: flat && cmp(a, y0) < 0, slant: !flat, touch: eq(a, y0) || eq(b, y0), gap: sub(y0, lo) });
  });
  const out = { type, y0, halves, outcome: res.outcome, reason: res.reason, gap: res.gap };
  out.outside = col < -2 * half || col + 1 >= 2 * half;
  out.height = Math.max(0, ...T.map(t => Math.max(...polyOf(t).map(v => v.y))));
  out.n = T.length;
  out.held = type === 'dn' ? null : halves.filter(h => h.at0).length; // ■/▲: halves of its bottom on a flat top at its height
  out.thin = res.gap && yv(res.gap) < 0.3 ? yv(res.gap) : null;
  if (type === 'dn') {
    const up = c => T.some(t => typeOf(t) === 'up' && t.col === c && eq(t.y, y0));
    out.sideL = up(col - 1); out.sideR = up(col + 1);
    out.sides = (out.sideL ? 1 : 0) + (out.sideR ? 1 : 0);
    // a "V": ▲s just left and right of the hand's column, whatever their heights
    out.vee = T.some(t => typeOf(t) === 'up' && t.col === col - 1) && T.some(t => typeOf(t) === 'up' && t.col === col + 1);
    // its point on a flat top (the car, a square's or a ▼'s top) at exactly its height
    const X = col + 1;
    out.pointFlat = (eq(y0, [0, 0]) && X >= -2 * half && X <= 2 * half) || T.some(t => {
      const tt = typeOf(t);
      if (tt === 'up') return false;
      const top = tt === 'sq' ? [t.y[0] + 2, t.y[1]] : [t.y[0], t.y[1] + 1];
      return eq(top, y0) && X >= t.col && X <= t.col + 2;
    });
  }
  return out;
}

// ---- seeded randomness ----
function rng(seed) {
  let s = (seed >>> 0) || 1;
  const f = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  f.int = n => Math.floor(f() * n);
  f.pick = a => a[f.int(a.length)];
  f.shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = f.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return f;
}

// ---- geometry in floats (drawing, falls) ----
const RED = '#E8323C', INK = '#1E2541', GREY = '#7d8597';
const STROKE = { '#FFD21F': '#D9A800', '#5EC8F2': '#2FA6D6' };
const colorOf = i => COLORS[i % COLORS.length];
const strokeOf = c => STROKE[c] || c;
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
const topAt = topOf;
function outlineAt(polys, half, x) {
  let best = x >= -half - 1e-12 && x <= half + 1e-12 ? 0 : null;
  for (const p of polys) {
    const xs = p.map(v => v.x);
    if (x <= Math.min(...xs) + 1e-9 || x >= Math.max(...xs) - 1e-9) continue;
    const t = topAt(p, x);
    if (t !== null && (best === null || t > best)) best = t;
  }
  return best;
}
function centroid(poly) { let x = 0, y = 0; for (const v of poly) { x += v.x; y += v.y; } return { x: x / poly.length, y: y / poly.length }; }
function rotate(poly, c, ang) {
  const cs = Math.cos(ang), sn = Math.sin(ang);
  return poly.map(v => ({ x: c.x + (v.x - c.x) * cs - (v.y - c.y) * sn, y: c.y + (v.x - c.x) * sn + (v.y - c.y) * cs }));
}
const shift = (poly, dx, dy) => poly.map(v => ({ x: v.x + dx, y: v.y + dy }));
const FLOOR = -0.62;
// do the insides of two convex polygons overlap by more than eps (separating axes)?
function overlap(Pa, Qa, eps) {
  eps = eps === undefined ? 2e-3 : eps;
  for (const poly of [Pa, Qa]) for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], nx = -(b.y - a.y), ny = b.x - a.x, len = Math.hypot(nx, ny);
    let p0 = Infinity, p1 = -Infinity, q0 = Infinity, q1 = -Infinity;
    for (const v of Pa) { const d = (v.x * nx + v.y * ny) / len; p0 = Math.min(p0, d); p1 = Math.max(p1, d); }
    for (const v of Qa) { const d = (v.x * nx + v.y * ny) / len; q0 = Math.min(q0, d); q1 = Math.max(q1, d); }
    if (p1 <= q0 + eps || q1 <= p0 + eps) return false;
  }
  return true;
}

// ---- falling off (revision 5c) ----
// fall(T, half, res): how the tile of an 'off' result leaves. Returns
//   { ok, type, rest, reason, pivot: {x, y}, dir (±1: the side it tips or the part leans to), knife, two (it rests on
//     points either side of its middle),
//     tipped: the tile turned TIP° about the point it touched (ONLY A POINT), or, for TIPS OVER, with the part rocked,
//     out: the tile on its way out of the wall toward the viewer (lower, a little bigger, turned further, fading),
//     rug: the tile lying flat on the rug below the car (foreshortened), path: its middle at rest, tipped, out, on the rug,
//     tips: for TIPS OVER { members, part: [{i, poly, piece}] (the new tile's i is T.length), rocked: [poly], com: {x, y},
//       side } }
// The point it touched (ONLY A POINT): of the points of its underside resting on the top of something below (an apex,
// a corner, a flat top), the nearest to its middle on the side its middle is on; it tips toward that side. With its
// middle right over the point, or with points either side of it (golden case 3), it tips outward, away from the car's
// middle (knife = true): a tilt this small shows only that it does not hold, not where it goes.
const TIP = 12, ROCK = 5, RUG_Y = -1.18, RUG_SQUASH = 0.3;
function fall(T, half, res) {
  const type = res.way === null ? 'sq' : res.way === 'up' ? 'up' : 'dn';
  const col = res.pose.col, y0 = yv(res.pose.y);
  const rest = shape(type, col, y0), mid = centroid(rest), polys = T.map(polyOf);
  const outward = mid.x >= 0 ? 1 : -1;
  const out = { ok: true, type, rest, reason: res.reason, knife: false, tips: null };
  let pivot, dir, tipped;
  if (res.reason === 'TIPS OVER' && res.tips) {
    const t = res.tips, n = T.length;
    dir = t.side === 'right' ? 1 : -1;
    pivot = { x: t.pivot[0] / 2, y: yv([t.pivot[1], t.pivot[2]]) };
    const part = t.members.map(i => ({ i, poly: i === n ? rest : polys[i], piece: i === n ? (type === 'sq' ? 'sq' : 'tri') : T[i].piece }));
    const rocked = part.map(p => rotate(p.poly, pivot, -dir * ROCK * Math.PI / 180));
    const cw = weightCentre(part);
    out.tips = { members: t.members, part, rocked, com: { x: t.com, y: cw.y }, side: t.side };
    tipped = rocked[part.findIndex(p => p.i === n)];
  } else {
    // its underside, and the points on it that rest on the top of something below
    const cand = res.contacts.points.concat(...res.contacts.segments).map(q => ({ x: q[0] / 2, y: yv([q[1], q[2]]) }));
    const under = type === 'dn' ? [[rest[2], rest[0]], [rest[0], rest[1]]] : [[rest[0], rest[1]]];
    const onSeg = (p, a, b) => { const cr = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x); return Math.abs(cr) < 1e-9 && p.x >= Math.min(a.x, b.x) - 1e-9 && p.x <= Math.max(a.x, b.x) + 1e-9; };
    const obst = polys.concat([[{ x: -half, y: -0.36 }, { x: half, y: -0.36 }, { x: half, y: 0 }, { x: -half, y: 0 }]]);
    const sup = [];
    for (const p of cand) {
      if (!under.some(([a, b]) => onSeg(p, a, b))) continue;
      if (obst.some(o => { const t = topAt(o, p.x); return t !== null && Math.abs(t - p.y) < 1e-9 && Math.min(...o.map(v => v.y)) < p.y - 1e-9; }) && !sup.some(q => Math.abs(q.x - p.x) < 1e-9)) sup.push(p);
    }
    const eps = 1e-6, left = sup.filter(p => p.x < mid.x - eps), right = sup.filter(p => p.x > mid.x + eps), at = sup.filter(p => Math.abs(p.x - mid.x) <= eps);
    if (!sup.length) { pivot = { x: mid.x, y: Math.min(...rest.map(v => v.y)) }; dir = outward; out.knife = true; }
    else if (at.length || (left.length && right.length)) { out.knife = true; out.two = !!(left.length && right.length); dir = outward; pivot = at.length ? at[0] : (dir > 0 ? right : left).reduce((a, b) => Math.abs(b.x - mid.x) < Math.abs(a.x - mid.x) ? b : a); }
    else { dir = left.length ? 1 : -1; pivot = (left.length ? left : right).reduce((a, b) => Math.abs(b.x - mid.x) < Math.abs(a.x - mid.x) ? b : a); }
    tipped = rotate(rest, pivot, -dir * TIP * Math.PI / 180);
  }
  // out of the wall: toward the viewer (a little bigger), down past the car's top, turned further, fading
  const ct = centroid(tipped), outC = { x: ct.x + dir * 0.3, y: Math.max(RUG_Y + 0.6, ct.y - 0.7) };
  const outPose = rotate(tipped.map(v => ({ x: outC.x + (v.x - ct.x) * 1.22, y: outC.y + (v.y - ct.y) * 1.22 })), outC, -dir * 14 * Math.PI / 180);
  // on the rug, below the car: the tile lying flat, seen from the front, so foreshortened; a little bigger again
  const rugC = { x: Math.max(-half - 0.4, Math.min(half + 0.4, pivot.x + dir * 0.55)), y: RUG_Y };
  const flat = shape(type, 0, 0), fc = centroid(flat);
  const rug = flat.map(v => ({ x: rugC.x + (v.x - fc.x) * 1.2, y: rugC.y + (v.y - fc.y) * 1.2 * RUG_SQUASH }));
  return Object.assign(out, { pivot, dir, tipped, out: outPose, rug, path: [mid, centroid(tipped), outC, rugC] });
}

// ---- drawing ----
// One scene as an SVG <g> plus its pixel size. sc = {
//   half = 2, L (px per tile), view: {x0, x1, y0, y1} in tiles,
//   tiles: [{poly, color, num?, style?: 'solid' | 'dashed' | 'ghost' | 'faded' | 'tint' (red, the part that would
//     tip) | 'out' (leaving the wall toward the viewer) | 'rug' (lying on the rug, out of play), opacity?}],
//   slivers: [poly] (thin gaps, left open; see buildSlivers), paths: [[{x, y}…]] (dotted, a fall's track),
//   rug: true (draw the rug in front of the car), dots: [{x, y}] (red: a pivot), plumb: {x, y, y1} (a plumb line from
//   (x, y) down to y1),
//   lines: [{a: {x, y}, b: {x, y}, dotted?, arrow?, color?, width?}], grip: {x, y} (the hand),
//   label: small text at the top left, tag: a big letter at the top left (a pair's 'A' / 'B'), numSize }
function scene(sc) {
  const half = sc.half || 2, L = sc.L, v = sc.view;
  const W = Math.round((v.x1 - v.x0) * L), Ht = Math.round((v.y1 - v.y0) * L);
  const X = x => ((x - v.x0) * L).toFixed(1), Y = y => ((v.y1 - y) * L).toFixed(1);
  const pts = poly => poly.map(p => X(p.x) + ',' + Y(p.y)).join(' ');
  const sw = Math.max(1.4, Math.min(2.2, L / 26));
  const o = [];
  o.push(`<rect width="${W}" height="${Ht}" fill="#fff"/>`);
  if (sc.rug && v.y0 < FLOOR) o.push(`<rect x="0" y="${Y(FLOOR)}" width="${W}" height="${((FLOOR - v.y0) * L).toFixed(1)}" fill="#f4efe4"/>`);
  o.push(`<line x1="0" x2="${W}" y1="${Y(FLOOR)}" y2="${Y(FLOOR)}" stroke="#c9ccd3" stroke-width="1.5"/>`);
  o.push(`<rect x="${X(-half)}" y="${Y(0)}" width="${(2 * half * L).toFixed(1)}" height="${(0.36 * L).toFixed(1)}" fill="#f1f2f5" stroke="#6b7080" stroke-width="1.5"/>`);
  for (let i = -half + 1; i < half; i++) o.push(`<line x1="${X(i)}" x2="${X(i)}" y1="${Y(0)}" y2="${Y(-0.36)}" stroke="#a3a8b4" stroke-width="1"/>`);
  for (const wx of [-half + 0.45, half - 0.45]) o.push(`<circle cx="${X(wx)}" cy="${Y(-0.46)}" r="${(0.15 * L).toFixed(1)}" fill="#fff" stroke="#6b7080" stroke-width="1.5"/>`);
  // tiles leaving the wall toward the viewer are drawn last (after every number), in front of everything
  const front = (sc.tiles || []).filter(t => t.style === 'out');
  for (const t of (sc.tiles || []).filter(t => t.style !== 'out')) {
    const c = t.color || INK;
    if (t.style === 'ghost') o.push(`<polygon points="${pts(t.poly)}" fill="none" stroke="${GREY}" stroke-width="${sw * 0.8}" stroke-dasharray="5 4" stroke-linejoin="round"/>`);
    else if (t.style === 'faded') o.push(`<polygon points="${pts(t.poly)}" fill="${c}" fill-opacity="0.07" stroke="${strokeOf(c)}" stroke-opacity="0.35" stroke-width="${sw}" stroke-dasharray="3 3" stroke-linejoin="round"/>`);
    else if (t.style === 'tint') o.push(`<polygon points="${pts(t.poly)}" fill="${RED}" fill-opacity="0.16" stroke="${RED}" stroke-width="${sw * 1.25}" stroke-linejoin="round"/>`);
    else if (t.style === 'rug') o.push(`<polygon points="${pts(t.poly)}" fill="${c}" fill-opacity="0.12" stroke="${strokeOf(c)}" stroke-opacity="0.4" stroke-width="${sw * 0.9}" stroke-linejoin="round"/>`);
    else o.push(`<polygon points="${pts(t.poly)}" fill="${c}" fill-opacity="${t.opacity === undefined ? 0.2 : t.opacity}" stroke="${strokeOf(c)}" stroke-width="${sw}" stroke-linejoin="round"${t.style === 'dashed' ? ' stroke-dasharray="6 4"' : ''}/>`);
  }
  for (const s of sc.slivers || []) o.push(gapSVG(pts(s)));
  if (sc.plumb) {
    const p = sc.plumb;
    o.push(`<line x1="${X(p.x)}" y1="${Y(p.y)}" x2="${X(p.x)}" y2="${Y(p.y1)}" stroke="${RED}" stroke-width="1.5"/><circle cx="${X(p.x)}" cy="${Y(p.y)}" r="2.8" fill="#fff" stroke="${RED}" stroke-width="1.4"/><path d="M${X(p.x - 0.06)},${Y(p.y1)} L${X(p.x + 0.06)},${Y(p.y1)} L${X(p.x)},${Y(p.y1 - 0.13)} z" fill="${RED}"/>`);
  }
  for (const d of sc.dots || []) o.push(`<circle cx="${X(d.x)}" cy="${Y(d.y)}" r="${Math.max(3.5, Math.min(6, L * 0.11)).toFixed(1)}" fill="${RED}" stroke="#fff" stroke-width="1.3"/>`);
  for (const pth of sc.paths || []) if (pth.length > 1) o.push(`<polyline points="${pts(pth)}" fill="none" stroke="${GREY}" stroke-width="1.6" stroke-dasharray="1.5 4" stroke-linecap="round"/>`);
  for (const l of sc.lines || []) {
    o.push(`<line x1="${X(l.a.x)}" y1="${Y(l.a.y)}" x2="${X(l.b.x)}" y2="${Y(l.b.y)}" stroke="${l.color || GREY}" stroke-width="${l.width || 1.6}"${l.dotted ? ' stroke-dasharray="1.5 5" stroke-linecap="round"' : ''}${l.arrow ? ' marker-end="url(#arrowG)"' : ''}/>`);
  }
  if (sc.grip) {
    const g = sc.grip;
    o.push(`<rect x="${X(g.x - 0.15)}" y="${Y(g.y + 0.3)}" width="${(0.3 * L).toFixed(1)}" height="${(0.3 * L).toFixed(1)}" rx="${(0.07 * L).toFixed(1)}" fill="#e9eaee" stroke="#6b7080" stroke-width="1.3"/>`);
  }
  const fs = sc.numSize || Math.max(9, Math.min(15, L * 0.3));
  const numberOf = t => {
    if (t.num === undefined || t.num === null) return;
    const c = centroid(t.poly);
    const fsz = t.style === 'rug' ? fs * 0.8 : fs;
    o.push(`<text x="${X(c.x)}" y="${(+Y(c.y) + fsz * 0.36).toFixed(1)}" text-anchor="middle" font-size="${fsz.toFixed(1)}" font-weight="700" fill="${INK}"${t.style === 'faded' || t.style === 'rug' || t.style === 'out' ? ' fill-opacity="0.5"' : ''} stroke="#fff" stroke-width="2.6" paint-order="stroke">${esc(t.num)}</text>`);
  };
  for (const t of (sc.tiles || []).filter(t => t.style !== 'out')) numberOf(t);
  for (const t of front) {
    // in front of the wall: a soft shadow on the wall behind it, and an opaque face that hides what is behind it
    const c = t.color || INK;
    o.push(`<polygon points="${pts(t.poly.map(v => ({ x: v.x + 0.08, y: v.y - 0.08 })))}" fill="#1E2541" fill-opacity="0.13" stroke="none"/>`);
    o.push(`<polygon points="${pts(t.poly)}" fill="#fff" fill-opacity="0.92" stroke="none"/>`);
    o.push(`<polygon points="${pts(t.poly)}" fill="${c}" fill-opacity="0.22" stroke="${strokeOf(c)}" stroke-opacity="0.75" stroke-width="${sw}" stroke-dasharray="5 3" stroke-linejoin="round"/>`);
    numberOf(t);
  }
  if (sc.label !== undefined) o.push(`<text x="6" y="16" font-size="13" font-weight="700" fill="#5a6075">${esc(sc.label)}</text>`);
  if (sc.tag !== undefined) o.push(`<rect x="4" y="4" width="30" height="30" rx="6" fill="${INK}"/><text x="19" y="26" text-anchor="middle" font-size="21" font-weight="800" fill="#fff">${esc(sc.tag)}</text>`);
  return { g: o.join(''), W, H: Ht };
}
// the thin gaps under the squares and ▲ of a build's tiles (rules.tiles()), as polygons for scene({slivers}): drawn open
function buildSlivers(T, half) { return sliversOf(T.map(t => ({ poly: polyOf(t), flat: t.way !== 'down' })), half || 2); }
const DEFS = `<defs><marker id="arrowG" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${GREY}"/></marker></defs>`;
// scenes side by side in one SVG, with a divider between them (a filmstrip with arrows, or a pair shown apart)
function svgRow(scenes, opts) {
  opts = opts || {};
  const gap = opts.gap === undefined ? 10 : opts.gap;
  const Hmax = Math.max(...scenes.map(s => s.H));
  let x = 0;
  const parts = [];
  scenes.forEach((s, i) => {
    if (i) {
      if (opts.arrows) parts.push(`<path d="M${x + 1},${Hmax / 2 - 6} L${x + gap - 2},${Hmax / 2} L${x + 1},${Hmax / 2 + 6} z" fill="#a3a8b4"/>`);
      else parts.push(`<line x1="${x + gap / 2}" x2="${x + gap / 2}" y1="0" y2="${Hmax}" stroke="#c9ccd3" stroke-width="${opts.divider || 2}"/>`);
      x += gap;
    }
    parts.push(`<g transform="translate(${x},${Hmax - s.H})">${s.g}</g>`);
    x += s.W;
  });
  const lab = opts.label !== undefined ? `<text x="6" y="16" font-size="13" font-weight="700" fill="#5a6075">${esc(opts.label)}</text>` : '';
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${Hmax}" viewBox="0 0 ${x} ${Hmax}" font-family="system-ui, 'DejaVu Sans', sans-serif">${DEFS}<rect width="${x}" height="${Hmax}" fill="#fff"/>${parts.join('')}${lab}</svg>`, W: x, H: Hmax };
}
function svgOne(s) { return svgRow([s]); }

// ---- screenshots ----
let browser = null;
async function getBrowser() { if (!browser) browser = await pw.chromium.launch(); return browser; }
async function shoot(bodyHTML, css, dpr) {
  const b = await getBrowser();
  const page = await b.newPage({ deviceScaleFactor: dpr || 2, viewport: { width: 1000, height: 800 } });
  try {
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#fff;font-family:system-ui,'DejaVu Sans',sans-serif;color:${INK}}#root{display:inline-block;padding:12px;background:#fff}${css || ''}</style></head><body><div id="root">${bodyHTML}</div></body></html>`);
    return await page.locator('#root').screenshot({ type: 'png' });
  } finally { await page.close(); }
}
async function close() { if (browser) { const b = browser; browser = null; await b.close(); } }

module.exports = {
  R3, H, rules, sgn, cmp, eq, yv, sub, typeOf, topOver, shape, polyOf, fmtTile, fmtHand, parse, replayStrs, tryReplay,
  keysOf, walk, colTop, describe, rng, colorOf, strokeOf, esc, topAt, outlineAt, centroid, rotate, shift, overlap, FLOOR,
  fall, RUG_Y, scene, buildSlivers, svgRow, svgOne, shoot, close, RED, INK, GREY, COLORS, canon, weightCentre
};
