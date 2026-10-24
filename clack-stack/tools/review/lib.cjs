'use strict';
// Shared pieces for the human-style review material (DESIGN §18.8 G2 intuition panel and plausibility review),
// revision 5d:
// - the exhaustive walk of reachable builds on the real base (fitting drops only, mirror images merged), like
//   tools/rules/enumerate.cjs but keeping the builds so items and extremes can be picked from them;
// - what lies under a dropped tile at rest, half by half, in exact numbers (for sorting items into strata);
// - how a tile that falls off leaves (fall(), §18.2): it never comes to rest in the wall. It tips a little about the
//   point it touched, then falls out of the wall toward the viewer and lands flat on the rug below the car, drawn
//   foreshortened and fading, clearly out of the wall plane. A tile balanced on a knife-edge (its middle right over the
//   point it touched, or points either side of its middle) tips to the free side: the side where tipping does not push
//   it into a tile it touches (outward, away from the car's middle, when both are free). For TIPS OVER the group that
//   would tip (the piece's whole group, revision 5d: every tile locked to it by a whole edge and everything resting on
//   it) is drawn as one piece, tinted with one red outline round its outside, and rocked a few degrees toward its pivot
//   (with the pivot dot and the plumb line from its centre of weight), then back, and the new tile falls out of the
//   wall. Placed tiles never move: the rock is only a tell, and every later frame shows the group where it was. fall()
//   also says whether the tip is blocked: the tipped tile or the rocked group would push into a tile outside it;
// - sandbox-style drawing (tools/sandbox/render.cjs's look: plain outlined tiles in the tiles' colours on white, the
//   car as a plate with four whole-tile panels and two wheels where the game has them (±1.8 tiles: HALF − WHEEL_IN),
//   the rug in front of it, thin gaps under tiles left open with a fine dotted outline, and a small dotted ring where a
//   corner or point of one tile sits just above another tile's point or corner without touching it (a near miss at a
//   point)) of arbitrary polygons, so planted defects can be drawn directly, bypassing the rules;
// - a seeded random generator and the headless-browser screenshot.
const canon = require('../lib/canon.cjs');
const { COLORS, sliversOf, topOf, SLIVER, gapSVG, weightCentre, outlineOf } = require('../sandbox/render.cjs');
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
const FLOOR = -0.62, WHEEL_IN = 0.2, WHEEL_R = 0.18;
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

// ---- falling off (revision 5d) ----
// fall(T, half, res): how the tile of an 'off' result leaves. Returns
//   { ok, type, rest, reason, pivot: {x, y}, dir (±1: the side it tips or the group leans to), knife, two (it rests on
//     points either side of its middle), blocked (turning toward its side by up to CAUGHT° (20) about its pivot would
//     push the tile, or the group, into a tile outside it: a real tile would lean on that tile or come to rest crooked
//     on it, as in the near-catch; such falls are kept out of the pictures where possible),
//     tipped: the tile turned TIP° about the point it touched (ONLY A POINT), or, for TIPS OVER, with the group rocked,
//     out: the tile on its way out of the wall toward the viewer (lower, a little bigger, turned further, fading),
//     rug: the tile lying flat on the rug below the car (foreshortened), path: its middle at rest, tipped, out, on the rug,
//     tips: for TIPS OVER { members, part: [{i, poly, piece}] (the new tile's i is T.length), rocked: [poly], com: {x, y},
//       side } }
// The point it touched (ONLY A POINT): of the points of its underside resting on the top of something below (an apex,
// a corner, a flat top), the nearest to its middle on the side its middle is on; it tips toward that side. With its
// middle right over the point, or with points either side of it (golden case 3), it is on a knife-edge (knife = true)
// and tips to the free side: the side where turning it does not push it into a tile it touches (G21A of round 3 tipped
// into the side of the square beside it); outward, away from the car's middle, when both sides are free.
// For TIPS OVER the group is rules' tips.members: the whole group of the piece SPEC §5c reports (revision 5d), the new
// tile among it, so the picture shows every tile joined to it by a whole edge tipping with it.
const TIP = 12, ROCK = 5, RUG_Y = -1.18, RUG_SQUASH = 0.3;
const carPoly = half => [{ x: -half, y: -0.36 }, { x: half, y: -0.36 }, { x: half, y: 0 }, { x: -half, y: 0 }];
const CAUGHT = 20;
// do the polygons, turned together about pivot toward dir by any angle up to CAUGHT°, push into an obstacle?
function caught(polys, pivot, dir, obst, skip) {
  for (let deg = 1; deg <= CAUGHT; deg += 1) if (polys.some(P => pushesInto(rotate(P, pivot, -dir * deg * Math.PI / 180), obst, skip))) return true;
  return false;
}
// does polygon P (turned) push into any of the obstacles, those listed in skip aside?
function pushesInto(P, obst, skip) { return obst.some((o, k) => !(skip && skip.has(k)) && overlap(P, o, 2e-3)); }
function fall(T, half, res) {
  const type = res.way === null ? 'sq' : res.way === 'up' ? 'up' : 'dn';
  const col = res.pose.col, y0 = yv(res.pose.y);
  const rest = shape(type, col, y0), mid = centroid(rest), polys = T.map(polyOf);
  const outward = mid.x >= 0 ? 1 : -1;
  const obst = polys.concat([carPoly(half)]);
  const out = { ok: true, type, rest, reason: res.reason, knife: false, blocked: false, tips: null };
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
    // blocked: turning toward its side by up to CAUGHT° pushes the group into a tile outside it (it would lean on that
    // tile, or come to rest crooked on it, round 3's G47B and G32A)
    const skip = new Set(t.members.filter(i => i < n));
    out.blocked = caught(part.map(p => p.poly), pivot, dir, obst, skip);
  } else {
    // its underside, and the points on it that rest on the top of something below
    const cand = res.contacts.points.concat(...res.contacts.segments).map(q => ({ x: q[0] / 2, y: yv([q[1], q[2]]) }));
    const under = type === 'dn' ? [[rest[2], rest[0]], [rest[0], rest[1]]] : [[rest[0], rest[1]]];
    const onSeg = (p, a, b) => { const cr = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x); return Math.abs(cr) < 1e-9 && p.x >= Math.min(a.x, b.x) - 1e-9 && p.x <= Math.max(a.x, b.x) + 1e-9; };
    const sup = [];
    for (const p of cand) {
      if (!under.some(([a, b]) => onSeg(p, a, b))) continue;
      if (obst.some(o => { const t = topAt(o, p.x); return t !== null && Math.abs(t - p.y) < 1e-9 && Math.min(...o.map(v => v.y)) < p.y - 1e-9; }) && !sup.some(q => Math.abs(q.x - p.x) < 1e-9)) sup.push(p);
    }
    const eps = 1e-6, left = sup.filter(p => p.x < mid.x - eps), right = sup.filter(p => p.x > mid.x + eps), at = sup.filter(p => Math.abs(p.x - mid.x) <= eps);
    const nearest = ps => ps.reduce((a, b) => Math.abs(b.x - mid.x) < Math.abs(a.x - mid.x) ? b : a);
    const turn = (pv, d, deg) => rotate(rest, pv, -d * deg * Math.PI / 180);
    if (!sup.length || at.length || (left.length && right.length)) {
      // a knife-edge: it tips to the free side (outward first)
      out.knife = true; out.two = !!(left.length && right.length);
      const pivotFor = d => !sup.length ? { x: mid.x, y: Math.min(...rest.map(v => v.y)) } : at.length ? at[0] : nearest(d > 0 ? right : left);
      const free = [outward, -outward].filter(d => !pushesInto(turn(pivotFor(d), d, TIP), obst));
      dir = free.length ? free[0] : outward;
      out.blocked = !free.length;
      pivot = pivotFor(dir);
    } else {
      dir = left.length ? 1 : -1; pivot = nearest(left.length ? left : right);
    }
    // blocked: turning about the point by up to CAUGHT° pushes it into a tile (the near-catch rests about 8° crooked)
    out.blocked = out.blocked || caught([rest], pivot, dir, obst);
    tipped = turn(pivot, dir, TIP);
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
//   tiles: [{poly, color, num?, style?: 'solid' | 'dashed' | 'ghost' | 'faded' | 'tint' (red: a tile of the group that
//     would tip) | 'tintGhost' (the dropped tile where it touched, in that group) | 'out' (leaving the wall toward the
//     viewer) | 'rug' (lying on the rug, out of play), opacity?}],
//   groups: [[poly…]] (a group that would tip, drawn as one piece: one red outline round it, its joints faint),
//   slivers: [poly] (thin gaps, left open; see buildSlivers), pointGaps: [{x, y0, y1}] (near misses at a point: a
//     dotted ring; see buildPointGaps), paths: [[{x, y}…]] (dotted, a fall's track),
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
  // the wheels where the game has them: WHEEL_IN = 0.2 tile in from each end of the car (index.html CFG), on the floor
  for (const wx of [-half + WHEEL_IN, half - WHEEL_IN]) o.push(`<circle cx="${X(wx)}" cy="${Y(FLOOR + WHEEL_R)}" r="${(WHEEL_R * L).toFixed(1)}" fill="#fff" stroke="#6b7080" stroke-width="1.5"/>`);
  // tiles leaving the wall toward the viewer are drawn last (after every number), in front of everything
  const front = (sc.tiles || []).filter(t => t.style === 'out');
  for (const t of (sc.tiles || []).filter(t => t.style !== 'out')) {
    const c = t.color || INK;
    if (t.style === 'ghost') o.push(`<polygon points="${pts(t.poly)}" fill="none" stroke="${GREY}" stroke-width="${sw * 0.8}" stroke-dasharray="5 4" stroke-linejoin="round"/>`);
    else if (t.style === 'faded') o.push(`<polygon points="${pts(t.poly)}" fill="${c}" fill-opacity="0.07" stroke="${strokeOf(c)}" stroke-opacity="0.35" stroke-width="${sw}" stroke-dasharray="3 3" stroke-linejoin="round"/>`);
    // a tile of a group that would tip: tinted; the group's one red outline is drawn round all of it below
    else if (t.style === 'tint') o.push(`<polygon points="${pts(t.poly)}" fill="${RED}" fill-opacity="0.16" stroke="none"/>`);
    // the dropped tile where it touched, as part of a group that would tip: tinted, its own outline grey and dashed
    else if (t.style === 'tintGhost') o.push(`<polygon points="${pts(t.poly)}" fill="${RED}" fill-opacity="0.10" stroke="${GREY}" stroke-width="${sw * 0.8}" stroke-dasharray="5 4" stroke-linejoin="round"/>`);
    else if (t.style === 'rug') o.push(`<polygon points="${pts(t.poly)}" fill="${c}" fill-opacity="0.12" stroke="${strokeOf(c)}" stroke-opacity="0.4" stroke-width="${sw * 0.9}" stroke-linejoin="round"/>`);
    else o.push(`<polygon points="${pts(t.poly)}" fill="${c}" fill-opacity="${t.opacity === undefined ? 0.2 : t.opacity}" stroke="${strokeOf(c)}" stroke-width="${sw}" stroke-linejoin="round"${t.style === 'dashed' ? ' stroke-dasharray="6 4"' : ''}/>`);
  }
  // a group that would tip, drawn as one piece: one red outline round its outside, the joints inside it faint
  for (const gp of sc.groups || []) {
    const ol = outlineOf(gp), seg = (sg, extra) => `<line x1="${X(sg[0].x)}" y1="${Y(sg[0].y)}" x2="${X(sg[1].x)}" y2="${Y(sg[1].y)}" ${extra}/>`;
    for (const sg of ol.inner) o.push(seg(sg, `stroke="${RED}" stroke-opacity="0.55" stroke-width="1.1" stroke-dasharray="2 3"`));
    for (const sg of ol.outer) o.push(seg(sg, `stroke="${RED}" stroke-width="${(sw * 1.35).toFixed(2)}" stroke-linecap="round"`));
  }
  for (const s of sc.slivers || []) o.push(gapSVG(pts(s)));
  // near misses at a point: a small dotted ring round the thin gap between a corner or point and the tile just below
  for (const g of sc.pointGaps || []) {
    const r = Math.max(7, 0.13 * L);
    o.push(`<circle cx="${X(g.x)}" cy="${Y((g.y0 + g.y1) / 2)}" r="${r.toFixed(1)}" fill="none" stroke="${SLIVER}" stroke-width="1.3" stroke-dasharray="1.6 2.4" stroke-linecap="round"/>`);
  }
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
// Near misses at a point (revision 5d's gallery fix): a corner or point of one tile right above another tile's point,
// corner or top, or a tile's flat bottom right above another tile's point or corner, less than `thin` (0.3) tile apart
// and not touching, with nothing between: 0.134 above an apex (golden case 13's near-catch, G21B and G32A of round 3)
// and the like. A flat bottom over a flat top is a thin gap drawn by buildSlivers, not one of these. polys: floats.
// Returns [{x, y0 (the lower point), y1 (the upper)}].
function pointGaps(polys, half, thin) {
  thin = thin || 0.3;
  const E = 1e-7, d = 0.03, out = [];
  // the lowest and highest boundary of P on the vertical line at x, or null
  const span = (P, x) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      if (x < Math.min(a.x, b.x) - E || x > Math.max(a.x, b.x) + E) continue;
      if (Math.abs(b.x - a.x) < E) { lo = Math.min(lo, a.y, b.y); hi = Math.max(hi, a.y, b.y); continue; }
      const y = a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
      lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    return lo === Infinity ? null : [lo, hi];
  };
  const onCar = x => x >= -half - E && x <= half + E;
  // the top of what is below height y at x (the car top, or the highest upper boundary not above y), or null
  const below = (x, y, skip) => {
    let best = onCar(x) ? 0 : null;
    polys.forEach((Q, k) => { if (k === skip) return; const sp = span(Q, x); if (sp && sp[1] <= y + E && (best === null || sp[1] > best)) best = sp[1]; });
    return best;
  };
  // the bottom of what is above height y at x, or null
  const above = (x, y, skip) => {
    let best = null;
    polys.forEach((Q, k) => { if (k === skip) return; const sp = span(Q, x); if (sp && sp[0] >= y - E && (best === null || sp[0] < best)) best = sp[0]; });
    return best;
  };
  const add = (x, y0, y1) => { if (!out.some(g => Math.abs(g.x - x) < 1e-6 && Math.abs(g.y1 - y1) < 1e-6)) out.push({ x, y0, y1 }); };
  // the gap from upper boundary point (x, yU) of tile i down to what is below, beside x by dx (null where i does not reach)
  const gapDown = (i, x) => { const sp = span(polys[i], x); if (!sp) return null; const b = below(x, sp[0] + E, i); return b === null ? null : sp[0] - b; };
  const gapUp = (j, x) => { const sp = span(polys[j], x); if (!sp) return null; const a = above(x, sp[1] - E, j); return a === null ? null : a - sp[1]; };
  // a near miss at a point: a gap in (0, thin) at x that is the least near x and grows on every side the tiles reach
  // (where it stays the same on a side, a flat bottom lies over a flat top: a sliver, not a point)
  const isPoint = (g, gL, gR) => g > E && g < thin && [gL, gR].every(h => h === null || h > g + 1e-6) && (gL !== null || gR !== null);
  polys.forEach((P, i) => P.forEach(v => {
    // a corner or point of P on its underside, over something
    const sp = span(P, v.x);
    if (sp && Math.abs(sp[0] - v.y) < E) {
      const g = gapDown(i, v.x);
      if (g !== null && isPoint(g, gapDown(i, v.x - d), gapDown(i, v.x + d))) add(v.x, v.y - g, v.y);
    }
    // a point or corner of P on its top, under something
    if (sp && Math.abs(sp[1] - v.y) < E) {
      const g = gapUp(i, v.x);
      if (g !== null && isPoint(g, gapUp(i, v.x - d), gapUp(i, v.x + d))) add(v.x, v.y, v.y + g);
    }
  }));
  return out;
}
function buildPointGaps(T, half, extra) { return pointGaps(T.map(polyOf).concat(extra || []), half || 2); }
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
  fall, RUG_Y, scene, buildSlivers, pointGaps, buildPointGaps, svgRow, svgOne, shoot, close, RED, INK, GREY, COLORS, canon,
  weightCentre, outlineOf, WHEEL_IN
};
