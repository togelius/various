'use strict';
// Shared pieces for the human-style review material (DESIGN §18.8 G2 intuition panel and plausibility review),
// revision 5b:
// - the exhaustive walk of reachable builds on the real base (fitting drops only, mirror images merged), like
//   tools/rules/enumerate.cjs but keeping the builds so items and extremes can be picked from them;
// - what lies under a dropped tile at rest, half by half, in exact numbers (for sorting items into strata);
// - how a tile that falls off leaves (fall()): it tips about the point it touches, toward the side its middle is on,
//   then only ever moves down (straight down, or down and outward along whatever it slides on), and the picture ends
//   where it would next hit something (it is drawn faded there) or where it leaves the frame; never a landing far away;
// - sandbox-style drawing (tools/sandbox/render.cjs's look: plain outlined tiles in the tiles' colours on white, the
//   car as a plate with four whole-tile panels and two wheels, thin gaps under tiles filled dark) of arbitrary
//   polygons, so planted defects can be drawn directly, bypassing the rules;
// - a seeded random generator and the headless-browser screenshot.
const canon = require('../lib/canon.cjs');
const { COLORS, sliversOf, topOf, SLIVER } = require('../sandbox/render.cjs');
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

// ---- falling off (5b: every fall is ONLY A POINT) ----
// fall(T, half, res): how the tile of an 'off' result leaves. Returns
//   { ok, why, type, rest, dir, pivot, supports, knife, tipped, poses: [poly…] from rest, path: [{x, y}…] (its middle),
//     end: 'hit' (it would next hit something: the last pose is where, drawn faded) | 'out' (it leaves the frame) }
// - Supports: the points of its underside that rest on the top of something below (an apex, a corner, a flat top).
// - It tips about the support nearest its middle on the side its middle is on, toward that side. With its middle
//   right over a single support (a knife-edge), either way is honest: the way with more room is taken (outward on a
//   tie), and knife = true. With supports on both sides of its middle it is balanced: ok = false (not drawable as a
//   fall; such pictures are left out).
// - Tipping: rotation about the pivot, 1.5° a step, to 35° or until it would touch something more. Then it moves only
//   downward: each step straight down, else down and outward at steeper-first slopes (sliding off a point or along a
//   side), turning on slowly as it goes (in all at most 65° for a square, 45° for a triangle, so it never comes to rest
//   looking set down square); it never moves up or back over the build. The first pose from which it can't
//   move down at all is where it would hit something.
function fall(T, half, res, opts) {
  opts = opts || {};
  const type = res.way === null ? 'sq' : res.way === 'up' ? 'up' : 'dn';
  const col = res.pose.col, y0 = yv(res.pose.y);
  const rest = shape(type, col, y0);
  const CAR = [{ x: -half, y: -0.36 }, { x: half, y: -0.36 }, { x: half, y: 0 }, { x: -half, y: 0 }];
  const obst = T.map(polyOf).concat([CAR]);
  const viewBottom = opts.viewBottom === undefined ? -0.8 : opts.viewBottom;
  const blocked = p => obst.some(o => overlap(p, o)) || Math.min(...p.map(v => v.y)) < FLOOR - 1e-6;
  // supports: candidate points on its underside that lie on the top boundary of something below
  const cand = res.contacts.points.concat(...res.contacts.segments).map(q => ({ x: q[0] / 2, y: yv([q[1], q[2]]) }));
  const under = type === 'dn' ? [[rest[2], rest[0]], [rest[0], rest[1]]] : [[rest[0], rest[1]]];
  const onSeg = (p, a, b) => { const cr = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x); return Math.abs(cr) < 1e-9 && p.x >= Math.min(a.x, b.x) - 1e-9 && p.x <= Math.max(a.x, b.x) + 1e-9; };
  const supports = [];
  for (const p of cand) {
    if (!under.some(([a, b]) => onSeg(p, a, b))) continue;
    const below = obst.some(o => { const t = topAt(o, p.x); return t !== null && Math.abs(t - p.y) < 1e-9 && Math.min(...o.map(v => v.y)) < p.y - 1e-9; });
    if (below && !supports.some(s => Math.abs(s.x - p.x) < 1e-9)) supports.push(p);
  }
  const mid = centroid(rest), cx = mid.x, eps = 1e-6;
  const out = { type, rest, supports, knife: false };
  if (!supports.length) return Object.assign(out, { ok: false, why: 'no support found under it' });
  const left = supports.filter(s => s.x < cx - eps), right = supports.filter(s => s.x > cx + eps), at = supports.filter(s => Math.abs(s.x - cx) <= eps);
  if (left.length && right.length) return Object.assign(out, { ok: false, why: 'balanced on points on both sides of its middle' });
  const dirs = [];
  if (at.length) {
    out.knife = true;
    if (!left.length) dirs.push(-1);
    if (!right.length) dirs.push(1);
  } else dirs.push(left.length ? 1 : -1);
  const outward = cx >= 0 ? 1 : -1;
  const sim = dir => {
    // the pivot: the support on the side it tips toward, nearest the middle (with a knife-edge, the one under it)
    const side = dir > 0 ? (at.length ? at : left) : (at.length ? at : right);
    const pivot = side.reduce((a, b) => (dir > 0 ? (b.x > a.x ? b : a) : (b.x < a.x ? b : a)));
    const poses = [rest];
    let cur = rest, tipped = rest;
    let rot = 0; // degrees turned so far
    for (let k = 1; k <= 24; k++) { const p = rotate(rest, pivot, -dir * k * 1.5 * Math.PI / 180); if (blocked(p)) break; cur = p; poses.push(p); rot = k * 1.5; }
    tipped = cur;
    // it keeps turning a little as it falls, but never so far that it would come to rest looking set down square
    // (a square turned 90°, a triangle 60°): at most 65° for a square, 45° for a triangle
    const capRot = type === 'sq' ? 65 : 45;
    let end = 'hit';
    const STEP = 0.035, ANG = [90, 80, 70, 60, 50, 40, 30, 20];
    for (let n = 0; n < 400; n++) {
      if (Math.max(...cur.map(v => v.y)) < viewBottom) { end = 'out'; break; }
      let next = null;
      const c = centroid(cur);
      for (const spin of rot + 1 <= capRot ? [1, 0] : [0]) {
        for (const a of ANG) {
          const r = a * Math.PI / 180, dx = dir * STEP * Math.cos(r), dy = -STEP * Math.sin(r);
          let p = shift(cur, dx, dy);
          if (spin) p = rotate(p, { x: c.x + dx, y: c.y + dy }, -dir * spin * Math.PI / 180);
          if (!blocked(p)) { next = p; next.spun = !!spin; break; }
        }
        if (next) break;
      }
      if (!next) break;
      if (next.spun) rot += 1;
      cur = next; poses.push(cur);
    }
    const path = poses.map(centroid);
    return { dir, pivot, poses, tipped, end, path, drop: mid.y - centroid(cur).y };
  };
  const runs = dirs.map(sim);
  runs.sort((a, b) => (b.drop - a.drop) || (a.dir === outward ? -1 : 1));
  const best = runs[0];
  if (best.poses.length < 3) return Object.assign(out, { ok: false, why: 'it cannot move off its support' });
  return Object.assign(out, { ok: true, why: out.knife ? 'knife-edge: its middle is right over the point; it tips the way with more room' : 'its middle is past the point it rests on' }, best);
}

// ---- drawing ----
// One scene as an SVG <g> plus its pixel size. sc = {
//   half = 2, L (px per tile), view: {x0, x1, y0, y1} in tiles,
//   tiles: [{poly, color, num?, style?: 'solid' | 'dashed' | 'ghost' | 'faded', opacity?}],
//   slivers: [poly] (thin gaps, filled dark; see buildSlivers), paths: [[{x, y}…]] (dotted, a fall's track),
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
  o.push(`<line x1="0" x2="${W}" y1="${Y(FLOOR)}" y2="${Y(FLOOR)}" stroke="#c9ccd3" stroke-width="1.5"/>`);
  o.push(`<rect x="${X(-half)}" y="${Y(0)}" width="${(2 * half * L).toFixed(1)}" height="${(0.36 * L).toFixed(1)}" fill="#f1f2f5" stroke="#6b7080" stroke-width="1.5"/>`);
  for (let i = -half + 1; i < half; i++) o.push(`<line x1="${X(i)}" x2="${X(i)}" y1="${Y(0)}" y2="${Y(-0.36)}" stroke="#a3a8b4" stroke-width="1"/>`);
  for (const wx of [-half + 0.45, half - 0.45]) o.push(`<circle cx="${X(wx)}" cy="${Y(-0.46)}" r="${(0.15 * L).toFixed(1)}" fill="#fff" stroke="#6b7080" stroke-width="1.5"/>`);
  for (const t of sc.tiles || []) {
    const c = t.color || INK;
    if (t.style === 'ghost') o.push(`<polygon points="${pts(t.poly)}" fill="none" stroke="${GREY}" stroke-width="${sw * 0.8}" stroke-dasharray="5 4" stroke-linejoin="round"/>`);
    else if (t.style === 'faded') o.push(`<polygon points="${pts(t.poly)}" fill="${c}" fill-opacity="0.07" stroke="${strokeOf(c)}" stroke-opacity="0.35" stroke-width="${sw}" stroke-dasharray="3 3" stroke-linejoin="round"/>`);
    else o.push(`<polygon points="${pts(t.poly)}" fill="${c}" fill-opacity="${t.opacity === undefined ? 0.2 : t.opacity}" stroke="${strokeOf(c)}" stroke-width="${sw}" stroke-linejoin="round"${t.style === 'dashed' ? ' stroke-dasharray="6 4"' : ''}/>`);
  }
  for (const s of sc.slivers || []) o.push(`<polygon points="${pts(s)}" fill="${SLIVER}" fill-opacity="0.88" stroke="${SLIVER}" stroke-width="0.8" stroke-linejoin="round"/>`);
  for (const pth of sc.paths || []) if (pth.length > 1) o.push(`<polyline points="${pts(pth)}" fill="none" stroke="${GREY}" stroke-width="1.6" stroke-dasharray="1.5 4" stroke-linecap="round"/>`);
  for (const l of sc.lines || []) {
    o.push(`<line x1="${X(l.a.x)}" y1="${Y(l.a.y)}" x2="${X(l.b.x)}" y2="${Y(l.b.y)}" stroke="${l.color || GREY}" stroke-width="${l.width || 1.6}"${l.dotted ? ' stroke-dasharray="1.5 5" stroke-linecap="round"' : ''}${l.arrow ? ' marker-end="url(#arrowG)"' : ''}/>`);
  }
  if (sc.grip) {
    const g = sc.grip;
    o.push(`<rect x="${X(g.x - 0.15)}" y="${Y(g.y + 0.3)}" width="${(0.3 * L).toFixed(1)}" height="${(0.3 * L).toFixed(1)}" rx="${(0.07 * L).toFixed(1)}" fill="#e9eaee" stroke="#6b7080" stroke-width="1.3"/>`);
  }
  const fs = sc.numSize || Math.max(9, Math.min(15, L * 0.3));
  for (const t of sc.tiles || []) {
    if (t.num === undefined || t.num === null) continue;
    const c = centroid(t.poly);
    o.push(`<text x="${X(c.x)}" y="${(+Y(c.y) + fs * 0.36).toFixed(1)}" text-anchor="middle" font-size="${fs.toFixed(1)}" font-weight="700" fill="${INK}"${t.style === 'faded' ? ' fill-opacity="0.45"' : ''} stroke="#fff" stroke-width="2.6" paint-order="stroke">${esc(t.num)}</text>`);
  }
  if (sc.label !== undefined) o.push(`<text x="6" y="16" font-size="13" font-weight="700" fill="#5a6075">${esc(sc.label)}</text>`);
  if (sc.tag !== undefined) o.push(`<rect x="4" y="4" width="30" height="30" rx="6" fill="${INK}"/><text x="19" y="26" text-anchor="middle" font-size="21" font-weight="800" fill="#fff">${esc(sc.tag)}</text>`);
  return { g: o.join(''), W, H: Ht };
}
// the thin gaps under the squares and ▲ of a build's tiles (rules.tiles()), as polygons for scene({slivers})
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
  fall, scene, buildSlivers, svgRow, svgOne, shoot, close, RED, INK, GREY, COLORS, canon
};
