'use strict';
// Shared pieces for the human-style review material (DESIGN §18.8 G2 intuition panel and plausibility review):
// - the exhaustive walk of reachable builds on the real base (fitting drops only, mirror images merged), like
//   tools/rules/enumerate.cjs but keeping the builds so items and extremes can be picked from them;
// - what lies under a dropped tile at rest, strip by strip, in exact numbers (for sorting items into strata);
// - sandbox-style drawing (tools/sandbox/render.cjs's look: plain outlined tiles in the tiles' colours on white, the
//   car as a plate with four whole-tile panels and two wheels) of arbitrary polygons, so planted defects can be drawn
//   directly, bypassing the rules;
// - a seeded random generator and the headless-browser screenshot.
const path = require('path');
const canon = require('../lib/canon.cjs');
const { COLORS } = require('../sandbox/render.cjs');
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
// a tile's top over its strip j (0 left, 1 right): the heights at the strip's two ends
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
// For a square or ▲ at rest (bottom at y0) or a ▼ (point at y0), per strip: the topmost thing below it there (the car or a
// tile), its top at the strip's two ends, and how that top meets the tile's bottom.
function stripTop(T, half, s) {
  let best = null;
  if (s >= -2 * half && s < 2 * half) best = { kind: 'car', idx: -1, e: [[0, 0], [0, 0]] };
  T.forEach((t, i) => {
    if (s !== t.col && s !== t.col + 1) return;
    const e = topOver(typeOf(t), t.y, s - t.col);
    if (!best || cmp([e[0][0] + e[1][0], e[0][1] + e[1][1]], [best.e[0][0] + best.e[1][0], best.e[0][1] + best.e[1][1]]) > 0) best = { kind: typeOf(t), idx: i, e, on: t.strips[s - t.col] };
  });
  if (best && best.kind === 'car') best.on = true;
  return best || { kind: 'none', idx: -2, e: null };
}
function describe(B, piece, col, res) {
  const T = rules().tiles(B), half = B.half;
  const type = piece === 'sq' ? 'sq' : res.way === 'up' ? 'up' : 'dn';
  const y0 = res.pose.y;
  const strips = [0, 1].map(j => {
    const st = stripTop(T, half, col + j);
    if (!st.e) return Object.assign(st, { flat: false, at0: false, low: false, slant: false, touch: false, gap: null });
    const [a, b] = st.e;
    const flat = eq(a, b);
    const lo = cmp(a, b) <= 0 ? a : b;
    // for a ▼ the meeting height under strip j is at its inner end (the point) for a flat top
    return Object.assign(st, { flat, at0: flat && eq(a, y0), low: flat && cmp(a, y0) < 0, slant: !flat, touch: eq(a, y0) || eq(b, y0), gap: sub(y0, lo) });
  });
  const out = { type, y0, strips, outcome: res.outcome, reason: res.reason, gap: res.gap, on: res.strips.slice() };
  out.outside = col < -2 * half || col + 1 >= 2 * half;
  out.height = Math.max(0, ...T.map(t => Math.max(...polyOf(t).map(v => v.y))));
  out.n = T.length;
  if (type === 'dn') {
    const up = c => T.some(t => typeOf(t) === 'up' && t.col === c && eq(t.y, y0));
    out.sideL = up(col - 1); out.sideR = up(col + 1);
    out.sides = (out.sideL ? 1 : 0) + (out.sideR ? 1 : 0);
    // a "V": ▲s just left and right of the hand's column, whatever their heights
    out.vee = T.some(t => typeOf(t) === 'up' && t.col === col - 1) && T.some(t => typeOf(t) === 'up' && t.col === col + 1);
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

// ---- drawing ----
const RED = '#E8323C', INK = '#1E2541', GREY = '#7d8597';
const STROKE = { '#FFD21F': '#D9A800', '#5EC8F2': '#2FA6D6' };
const colorOf = i => COLORS[i % COLORS.length];
const strokeOf = c => STROKE[c] || c;
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// the build's top outline at x (car top y = 0 over [−half, half]); null over nothing. polys: arrays of {x, y}
function topAt(poly, x) {
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
// One scene as an SVG <g> plus its pixel size. sc = {
//   half = 2, L (px per tile), view: {x0, x1, y0, y1} in tiles,
//   tiles: [{poly, color, num?, style?: 'solid' | 'dashed' | 'ghost', opacity?}],
//   lines: [{a: {x, y}, b: {x, y}, dotted?, arrow?, color?, width?}], arcs: [{a, b, bend}], grip: {x, y} (the hand),
//   label: small text at the top left, numSize }
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
    else o.push(`<polygon points="${pts(t.poly)}" fill="${c}" fill-opacity="${t.opacity === undefined ? 0.2 : t.opacity}" stroke="${strokeOf(c)}" stroke-width="${sw}" stroke-linejoin="round"${t.style === 'dashed' ? ' stroke-dasharray="6 4"' : ''}/>`);
  }
  for (const l of sc.lines || []) {
    o.push(`<line x1="${X(l.a.x)}" y1="${Y(l.a.y)}" x2="${X(l.b.x)}" y2="${Y(l.b.y)}" stroke="${l.color || GREY}" stroke-width="${l.width || 1.6}"${l.dotted ? ' stroke-dasharray="1.5 5" stroke-linecap="round"' : ''}${l.arrow ? ' marker-end="url(#arrowG)"' : ''}/>`);
  }
  for (const a of sc.arcs || []) {
    const mx = (a.a.x + a.b.x) / 2 + (a.bend ? a.bend.x : 0), my = (a.a.y + a.b.y) / 2 + (a.bend ? a.bend.y : 0.6);
    o.push(`<path d="M${X(a.a.x)},${Y(a.a.y)} Q${X(mx)},${Y(my)} ${X(a.b.x)},${Y(a.b.y)}" fill="none" stroke="${GREY}" stroke-width="1.6" stroke-dasharray="2 5" stroke-linecap="round" marker-end="url(#arrowG)"/>`);
  }
  if (sc.grip) {
    const g = sc.grip;
    o.push(`<rect x="${X(g.x - 0.15)}" y="${Y(g.y + 0.3)}" width="${(0.3 * L).toFixed(1)}" height="${(0.3 * L).toFixed(1)}" rx="${(0.07 * L).toFixed(1)}" fill="#e9eaee" stroke="#6b7080" stroke-width="1.3"/>`);
  }
  const fs = sc.numSize || Math.max(9, Math.min(15, L * 0.3));
  for (const t of sc.tiles || []) {
    if (t.num === undefined || t.num === null) continue;
    const c = centroid(t.poly);
    o.push(`<text x="${X(c.x)}" y="${(+Y(c.y) + fs * 0.36).toFixed(1)}" text-anchor="middle" font-size="${fs.toFixed(1)}" font-weight="700" fill="${INK}" stroke="#fff" stroke-width="2.6" paint-order="stroke">${esc(t.num)}</text>`);
  }
  if (sc.label !== undefined) o.push(`<text x="6" y="16" font-size="13" font-weight="700" fill="#5a6075">${esc(sc.label)}</text>`);
  return { g: o.join(''), W, H: Ht };
}
const DEFS = `<defs><marker id="arrowG" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${GREY}"/></marker></defs>`;
// scenes side by side in one SVG, with a thin divider between them (a filmstrip, or a pair shown apart)
function svgRow(scenes, opts) {
  opts = opts || {};
  const gap = opts.gap === undefined ? 10 : opts.gap;
  const Hmax = Math.max(...scenes.map(s => s.H));
  let x = 0;
  const parts = [];
  scenes.forEach((s, i) => {
    if (i) {
      if (opts.arrows) parts.push(`<path d="M${x + 1},${Hmax / 2 - 6} L${x + gap - 2},${Hmax / 2} L${x + 1},${Hmax / 2 + 6} z" fill="#a3a8b4"/>`);
      else parts.push(`<line x1="${x + gap / 2}" x2="${x + gap / 2}" y1="4" y2="${Hmax - 4}" stroke="#c9ccd3" stroke-width="${opts.divider || 2}"/>`);
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
  keysOf, walk, stripTop, describe, rng, colorOf, strokeOf, esc, topAt, outlineAt, centroid, rotate, shift, FLOOR,
  scene, svgRow, svgOne, shoot, close, RED, INK, GREY, COLORS, canon
};
