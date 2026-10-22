'use strict';
// The intuition panel's items (DESIGN §18.8 G2.2): pictures of a build with ONE tile held just above it and its dotted
// fall lines, and nothing else (no ghost, no outcome, no hatching, no text but a small item number). Three fresh
// judges who know only the photos and a plain description of the tiles answer STAYS, FALLS OFF or UNSURE for each.
//
// Items come in strata, each built from minimal pairs (the same build with the hand one step over, or the build with
// one tile more or less) whose outcomes differ, so each stratum is half STAYS, half FALLS OFF. They are picked from the
// exhaustive walk of reachable builds (tools/review/lib.cjs) to --depth tiles, smallest and lowest builds first, with
// the outcome from rules.js; about half the pairs are shown mirrored. The golden cases (§18.9) are added as their own stratum (case 11 can't be shown: the
// hand never holds a square half a tile off). Triangles in the hand are shown the way up the rules choose (auto-turn,
// §18.3), except in the "▼ on its point alone" stratum: auto-turn never shows a ▼ that has no side to hang on, so that
// stratum forces the ▼ (key: wayForced).
//
// Writes sheets of 6 (3 x 2) to --out (default rev5/panel/sheet-NN.png) and the answer key to --key (default
// rev5/panel-key/key.json), which must never be shown to the panel.
//   node tools/review/items.cjs [--seed=5] [--pairs=5 per stratum] [--depth=7] [--out=dir] [--key=file]
//                                [--explore: what each stratum has to offer] [--list: the chosen pairs]
const fs = require('fs');
const path = require('path');
const lib = require('./lib.cjs');
const { CASES } = require('../rules/golden.cjs');

const SCRATCH = '/tmp/claude-0/-home-user-various/eea7fc80-8598-5a7a-a3e6-cdbd34e6e76d/scratchpad/rev5';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const SEED = +(args.seed || 5), PAIRS = +(args.pairs || 5), DEPTH = +(args.depth || 7);
const OUT = args.out || path.join(SCRATCH, 'panel'), KEY = args.key || path.join(SCRATCH, 'panel-key', 'key.json');
const R = lib.rules();
const yv = lib.yv;

// ---- the strata: what the hand's tile meets where it stops ----
const oneAt0 = d => d.strips[0].at0 !== d.strips[1].at0 && (d.strips[0].at0 || d.strips[1].at0);
const other = d => d.strips[0].at0 ? d.strips[1] : d.strips[0];
const g = s => s.gap ? yv(s.gap) : Infinity;
const nearGap = d => d.reason === 'NOT LEVEL' && yv(d.gap) <= 0.27;
const STRATA = [
  { id: 'sq-whole-top', name: 'square on a whole top',
    is: d => d.type === 'sq' && d.strips[0].at0 && d.strips[1].at0 && d.strips[0].idx === d.strips[1].idx },
  { id: 'sq-two-dn-tops', name: 'square across two ▼ tops',
    is: d => d.type === 'sq' && d.strips[0].kind === 'dn' && d.strips[1].kind === 'dn' && d.strips[0].idx !== d.strips[1].idx && !nearGap(d) },
  { id: 'sq-points', name: 'square on points', pivotOnly: true,
    is: d => d.type === 'sq' && d.reason === 'ONLY A POINT' },
  { id: 'sq-edge', name: 'square partly over an edge', pivotOnly: true,
    is: d => d.type === 'sq' && oneAt0(d) && (other(d).kind === 'none' || (other(d).low && g(other(d)) >= 0.85)) },
  { id: 'sq-lower', name: 'square partly over a lower step or slant', pivotOnly: true,
    is: d => d.type === 'sq' && oneAt0(d) && (other(d).slant || (other(d).low && g(other(d)) > 0.27 && g(other(d)) < 0.85)) },
  { id: 'up-half-step', name: '▲ at a half step across two tops',
    is: d => d.type === 'up' && (d.strips[0].at0 || d.strips[0].low) && (d.strips[1].at0 || d.strips[1].low) && d.strips[0].idx !== d.strips[1].idx && !nearGap(d) },
  { id: 'up-edge', name: '▲ partly over an edge', pivotOnly: true,
    is: d => d.type === 'up' && oneAt0(d) && (other(d).kind === 'none' || (other(d).low && g(other(d)) >= 0.85)) },
  { id: 'near-miss', name: 'near miss (gap at most 0.27 tile)', pivotOnly: true,
    is: d => (d.type === 'sq' || d.type === 'up') && nearGap(d) },
  { id: 'up-point', name: '▲ on a point', pivotOnly: true,
    is: d => d.type === 'up' && d.reason === 'ONLY A POINT' },
  { id: 'dn-notch', name: '▼ into a notch',
    is: d => d.type === 'dn' && d.vee },
  { id: 'dn-one-side', name: '▼ by one side',
    is: d => d.type === 'dn' && d.sides === 1 },
  { id: 'dn-point', name: '▼ on its point alone', forced: true,
    is: d => d.type === 'dn' && d.reason === 'NO SIDE' && pointOnFlat(d) },
  { id: 'tri-past-car', name: 'triangle sticking out past the car',
    is: d => (d.type === 'up' || d.type === 'dn') && d.outside },
  { id: 'too-far-out', name: 'TOO FAR OUT', pivotOnly: true,
    is: d => d.reason === 'TOO FAR OUT' }
];
// a ▼ whose point rests on a flat top: under the point (between its strips) a flat top at the point's height
function pointOnFlat(d) { return d.strips.some(s => s.flat && s.at0); }

// ---- the pool: every hand position over every small build ----
function evalItem(node, piece, col, forced) {
  const way = forced ? 'down' : undefined;
  const res = R.drop(node.B, piece, col, way);
  const d = lib.describe(node.B, piece, col, res);
  // the id is the same for an item and its mirror image
  const mid = lib.keysOf(R.tiles(node.B)).key === node.ck ? piece + col : piece + lib.canon.mirrorCol(col);
  return { node, piece, col, forced: !!forced, res, d, fit: res.outcome === 'fit', id: node.ck + '|' + mid + (forced ? 'F' : '') };
}
function itemsOf(node, forced) {
  const out = [];
  if (forced) { for (const col of R.cols(node.B, 'tri')) out.push(evalItem(node, 'tri', col, true)); return out; }
  for (const col of R.cols(node.B, 'sq')) out.push(evalItem(node, 'sq', col));
  for (const col of R.cols(node.B, 'tri')) out.push(evalItem(node, 'tri', col));
  return out;
}

// a node for exactly this log (not the walk's node, which may be the mirror image)
function nodeOfLog(log) {
  const B = lib.tryReplay(log);
  if (!B) return null;
  const T = R.tiles(B), K = lib.keysOf(T);
  return { B, T, ck: K.ck, key: K.key, log, depth: log.length };
}
// minimal variants of an item with the other outcome: [{item, how, cost}]
function variants(it, W) {
  const out = [], { node, piece, col, forced } = it;
  const step = piece === 'sq' ? 2 : 1;
  const cols = R.cols(node.B, piece);
  for (const dc of [-step, step]) if (cols.includes(col + dc)) out.push({ item: evalItem(node, piece, col + dc, forced), how: 'hand ' + (dc > 0 ? 'right' : 'left') + ' ' + (step / 2) + ' tile', cost: 1 });
  for (let i = 0; i < node.log.length; i++) {
    const n2 = nodeOfLog(node.log.slice(0, i).concat(node.log.slice(i + 1)));
    if (n2) out.push({ item: evalItem(n2, piece, col, forced), how: 'without tile ' + (i + 1) + ' (' + lib.fmtHand(node.log[i].piece, node.log[i].col, node.log[i].way) + ')', cost: 1.1 });
  }
  if (node.kids) for (const k of node.kids) {
    const n2 = nodeOfLog(node.log.concat([k.drop]));
    if (n2) out.push({ item: evalItem(n2, piece, col, forced), how: 'with ' + lib.fmtHand(k.drop.piece, k.drop.col, k.drop.way) + ' added', cost: 1.2 });
  }
  return out.filter(v => v.item.fit !== it.fit);
}

function sig(it) {
  const d = it.d, s = d.strips.map(x => x.kind + (x.at0 ? '=' : x.low ? 'v' : x.slant ? '/' : '?')).join(',');
  return d.type + ':' + (d.reason || 'fit') + ':' + s + (d.sides !== undefined ? ':s' + d.sides : '') + (d.outside ? ':out' : '') + (d.reason === 'NOT LEVEL' && yv(d.gap) < 0.3 ? ':g' + yv(d.gap).toFixed(3) : '');
}
const cost = it => it.d.n * 1.0 + it.d.height * 1.4 + (it.node.depth === 0 ? 3 : 0);

function choosePairs(W, pool, poolForced) {
  const used = new Set(), usedBuild = new Map();
  // the golden cases are items of their own: never pick them (or their mirror images) again
  for (const c of CASES) if (!c.throws) {
    const n = nodeOfLog(c.log);
    used.add(evalItem(n, c.lastDrop.piece, c.lastDrop.col).id);
  }
  const out = {};
  // the scarcest strata pick first (by the number of items of their rarer outcome)
  const scarce = S => { const m = (S.forced ? poolForced : pool).filter(it => S.is(it.d)), f = m.filter(it => it.fit).length; return S.pivotOnly ? m.length : Math.min(f, m.length - f); };
  const strata = STRATA.slice().sort((a, b) => scarce(a) - scarce(b));
  for (const S of strata) {
    const src = S.forced ? poolForced : pool;
    let piv = src.filter(it => S.is(it.d));
    const nFit = piv.filter(it => it.fit).length, rareFit = nFit * 2 < piv.length;
    // mix the configurations: round-robin over signatures, cheapest first in each
    const bySig = new Map();
    for (const it of piv.sort((a, b) => cost(a) - cost(b))) { const k = sig(it); if (!bySig.has(k)) bySig.set(k, []); bySig.get(k).push(it); }
    const order = [];
    const lists = [...bySig.values()].sort((a, b) => cost(a[0]) - cost(b[0]));
    // pivots of the rarer and the commoner outcome taken in turn, rarer first (so a mostly-fitting stratum's falls are
    // mostly its own kind of fall), each round-robin over its configurations
    const rr = ls => { const o = []; for (let i = 0; o.length < 4000 && ls.some(l => l.length > i); i++) for (const l of ls) if (l[i]) o.push(l[i]); return o; };
    if (S.pivotOnly) order.push(...rr(lists));
    else {
      const a = rr(lists.filter(l => l[0].fit === rareFit)), b = rr(lists.filter(l => l[0].fit !== rareFit));
      for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i]) order.push(a[i]); if (b[i]) order.push(b[i]); }
    }
    const pairs = [], inStratum = new Map();
    const rareSigs = lists.filter(l => l[0].fit === rareFit).length;
    const sigCount = new Map(), cap = Math.max(2, Math.ceil(PAIRS / Math.max(1, S.pivotOnly ? lists.length : rareSigs || lists.length)));
    for (const p of order) {
      if (pairs.length >= PAIRS) break;
      if (used.has(p.id) || (usedBuild.get(p.node.ck) || 0) >= 4 || (inStratum.get(p.node.ck) || 0) >= 2) continue;
      if (p.d.height > 3.9 || p.d.n > 7) continue;
      if ((sigCount.get(sig(p)) || 0) >= cap) continue;
      let best = null;
      for (const v of variants(p, W)) {
        const q = v.item;
        if (used.has(q.id) || (usedBuild.get(q.node.ck) || 0) >= 4 || (inStratum.get(q.node.ck) || 0) >= 2) continue;
        if (q.d.height > 3.9 || q.d.n > 7) continue;
        let sc = v.cost * 2 + cost(q) * 0.5;
        if (!S.is(q.d)) sc += S.pivotOnly ? 3 : 20;
        if (q.d.type !== p.d.type) sc += 4;
        if (q.forced !== p.forced) continue;
        if (!best || sc < best.sc) best = { q, how: v.how, sc };
      }
      if (!best || best.sc > 40) continue;
      pairs.push({ a: p, b: best.q, how: best.how });
      used.add(p.id); used.add(best.q.id);
      for (const x of [p, best.q]) { usedBuild.set(x.node.ck, (usedBuild.get(x.node.ck) || 0) + 1); inStratum.set(x.node.ck, (inStratum.get(x.node.ck) || 0) + 1); }
      sigCount.set(sig(p), (sigCount.get(sig(p)) || 0) + 1);
    }
    out[S.id] = pairs;
  }
  return out;
}

// ---- drawing one item ----
const L = +(args.L || 60);
const VIEW_X = [-3.25, 3.25];
function itemScene(spec, y1, label) {
  // spec: {log, piece, col, way, half}
  const half = 2;
  const B = lib.tryReplay(spec.log);
  const T = R.tiles(B);
  const res = R.drop(B, spec.piece, spec.col, spec.piece === 'sq' ? undefined : spec.way || undefined);
  const type = spec.piece === 'sq' ? 'sq' : res.way === 'up' ? 'up' : 'dn';
  const polys = T.map(lib.polyOf);
  const rest = yv(res.pose.y);
  const handY = rest + 0.62;
  const hp = lib.shape(type, spec.col, handY);
  const tiles = T.map((t, i) => ({ poly: polys[i], color: lib.colorOf(i) }));
  tiles.push({ poly: hp, color: lib.colorOf(T.length) });
  const lx = spec.col / 2, rx = lx + 1;
  const lines = [];
  for (const [x, inward] of [[lx, 1e-6], [rx, -1e-6]]) {
    const yTop = type === 'dn' ? handY + lib.H : handY;
    const o = lib.outlineAt(polys, half, x + inward);
    lines.push({ a: { x, y: yTop - 0.04 }, b: { x, y: o === null ? lib.FLOOR : o }, dotted: true });
  }
  lines.push({ a: { x: lx + 0.5, y: handY - 0.08 }, b: { x: lx + 0.5, y: handY - 0.34 }, arrow: true });
  const top = Math.max(...hp.map(v => v.y));
  return { scene: lib.scene({ half, L, view: { x0: VIEW_X[0], x1: VIEW_X[1], y0: -0.8, y1 }, tiles, lines, grip: { x: lx + 0.5, y: top }, label }), need: top + 0.42, res };
}
function needY(spec) {
  const B = lib.tryReplay(spec.log), res = R.drop(B, spec.piece, spec.col, spec.piece === 'sq' ? undefined : spec.way || undefined);
  const type = spec.piece === 'sq' ? 'sq' : res.way === 'up' ? 'up' : 'dn';
  return yv(res.pose.y) + 0.62 + (type === 'sq' ? 1 : lib.H) + 0.42;
}

async function main() {
  const t0 = Date.now();
  const W = lib.walk(DEPTH);
  const small = W.nodes.filter(n => n.depth <= DEPTH);
  const pool = [], poolForced = [];
  for (const n of small) { for (const it of itemsOf(n)) pool.push(it); for (const it of itemsOf(n, true)) poolForced.push(it); }
  console.log(`walk: ${W.nodes.length} builds to depth ${DEPTH}, ${pool.length} hand positions (+${poolForced.length} forced ▼) in ${Date.now() - t0} ms`);
  if (args.explore) {
    for (const S of STRATA) {
      const src = S.forced ? poolForced : pool, m = src.filter(it => S.is(it.d));
      const fit = m.filter(x => x.fit).length;
      const sigs = new Map();
      for (const it of m) sigs.set(sig(it), (sigs.get(sig(it)) || 0) + 1);
      console.log(`${S.id}: ${m.length} (${fit} fit, ${m.length - fit} off), ${sigs.size} configurations`);
      for (const [k, v] of [...sigs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log('   ' + v + '  ' + k);
    }
  }
  const chosen = choosePairs(W, pool, poolForced);
  if (args.list) for (const S of STRATA) {
    console.log('== ' + S.id);
    for (const p of chosen[S.id]) for (const [it, tag] of [[p.a, 'A'], [p.b, 'B ' + p.how]]) {
      console.log(`  ${tag.padEnd(28)} ${it.node.log.map(e => lib.fmtHand(e.piece, e.col, e.way)).join(' ').padEnd(44)} hand ${lib.fmtHand(it.piece, it.col, it.res.way)} -> ${it.res.outcome} ${it.res.reason || ''} ${it.res.gap ? yv(it.res.gap).toFixed(3) : ''}  [${sig(it)}]`);
    }
  }
  // the items: pairs per stratum, then the golden cases
  const items = [];
  let pairNo = 0;
  const rr = lib.rng(SEED * 7 + 1);
  for (const S of STRATA) {
    const ps = chosen[S.id];
    if (ps.length < 4) console.log(`!! ${S.id}: only ${ps.length} pairs`);
    for (const p of ps) {
      pairNo++;
      // show about half the pairs mirrored, so the builds are not all on one side
      const mirror = rr() < 0.5;
      for (const [it, role] of [[p.a, 'pivot'], [p.b, 'partner']]) {
        let log = it.node.log, col = it.col;
        if (mirror) { log = lib.canon.mirrorLog(log); col = lib.canon.mirrorCol(col); }
        items.push({ stratum: S.id, stratumName: S.name, pair: 'P' + pairNo, role, log, piece: it.piece, col, way: it.forced ? 'down' : undefined, wayForced: it.forced });
      }
    }
  }
  for (const c of CASES) {
    if (c.throws) continue;
    const d = c.lastDrop;
    items.push({ stratum: 'golden', stratumName: 'golden case ' + c.n, pair: null, role: null, golden: c.n, log: c.log, piece: d.piece, col: d.col, way: undefined, wayForced: false });
  }
  // outcomes from the rules (auto-turn unless forced), checked against the pick
  for (const it of items) {
    const B = lib.tryReplay(it.log);
    if (!B) throw new Error('item build does not replay: ' + it.log.map(e => lib.fmtHand(e.piece, e.col, e.way)).join(' '));
    const res = R.drop(B, it.piece, it.col, it.piece === 'sq' ? undefined : it.way);
    it.res = res;
    it.d = lib.describe(B, it.piece, it.col, res);
    if (it.golden) {
      const c = CASES[it.golden - 1];
      if (res.outcome !== c.expect.outcome || res.reason !== c.expect.reason) throw new Error('golden ' + it.golden + ' auto-turn result differs: ' + res.outcome + ' ' + res.reason);
    }
  }
  for (let i = 0; i < items.length; i++) if (items[i].pair && items[i].role === 'pivot') {
    const a = items[i], b = items[i + 1];
    if (a.res.outcome === b.res.outcome) throw new Error('pair ' + a.pair + ' has one outcome');
  }
  // shuffle; the two items of a pair never on one sheet
  const rs = lib.rng(SEED * 31 + 7);
  let order = rs.shuffle(items.slice());
  const sheetOf = i => Math.floor(i / 6);
  for (let round = 0; round < 200; round++) {
    let bad = 0;
    for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) {
      if (!order[i].pair || order[i].pair !== order[j].pair || sheetOf(i) !== sheetOf(j)) continue;
      bad++;
      const k = rs.int(order.length);
      if (sheetOf(k) !== sheetOf(j)) [order[j], order[k]] = [order[k], order[j]];
    }
    if (!bad) break;
  }
  order.forEach((it, i) => { it.n = i + 1; it.sheet = sheetOf(i) + 1; });
  // what changes between the two items of a pair, from the items as shown (after any mirroring)
  const byPair = new Map();
  for (const it of order) if (it.pair) { if (!byPair.has(it.pair)) byPair.set(it.pair, []); byPair.get(it.pair).push(it); }
  const minus = (x, y) => { const r = x.slice(); for (const k of y) { const i = r.indexOf(k); if (i >= 0) r.splice(i, 1); } return r; };
  const strs = it => it.log.map(e => lib.fmtHand(e.piece, e.col, e.way));
  // how item y differs from item x
  function change(x, y) {
    const parts = [], add = minus(strs(y), strs(x)), rem = minus(strs(x), strs(y));
    if (add.length) parts.push('with ' + add.join(' ') + ' added');
    if (rem.length) parts.push('without ' + rem.join(' '));
    if (x.col !== y.col) parts.push('hand at x ' + y.col / 2 + ' instead of ' + x.col / 2);
    return 'item ' + y.n + ' is this ' + (parts.join(', ') || 'same build and hand') + ' (' + (y.res.outcome === 'fit' ? 'STAYS' : 'FALLS OFF') + ')';
  }
  for (const [, [a, b]] of byPair) { a.partnerN = b.n; b.partnerN = a.n; a.change = change(a, b); b.change = change(b, a); }
  // render
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (/^sheet-\d+\.png$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  const nSheets = Math.ceil(order.length / 6), files = [];
  const CSS = `.grid{display:grid;grid-template-columns:repeat(3,auto);gap:12px}.cell{border:1px solid #dfe2e8;border-radius:8px;padding:4px;line-height:0}`;
  for (let s = 0; s < nSheets; s++) {
    const six = order.slice(s * 6, s * 6 + 6);
    const y1 = Math.max(3.1, ...six.map(needY));
    const cells = six.map(it => {
      const sc = itemScene(it, y1, String(it.n)).scene;
      return `<div class="cell">${lib.svgOne(sc).svg}</div>`;
    });
    const png = await lib.shoot(`<div class="grid">${cells.join('')}</div>`, CSS, 1.5);
    const f = path.join(OUT, 'sheet-' + String(s + 1).padStart(2, '0') + '.png');
    fs.writeFileSync(f, png);
    files.push(f);
  }
  await lib.close();
  // the key
  const fmtLog = log => log.map(e => lib.fmtHand(e.piece, e.col, e.way));
  const key = {
    what: 'Answer key for the CLACK STACK revision 5 intuition panel (DESIGN §18.8 G2.2). Never show this to the panel.',
    seed: SEED, made: new Date().toISOString(), sheets: files.map(f => path.basename(f)), panelDir: OUT,
    rules: 'outcome from clack-stack/rules.js drop(); "expected" is what the panel should answer if the rules match intuition',
    strata: {},
    items: order.map(it => ({
      n: it.n, sheet: it.sheet, stratum: it.stratum, stratumName: it.stratumName, pair: it.pair, pairRole: it.role, partner: it.partnerN || null,
      pairChange: it.change || null,
      golden: it.golden || null,
      expected: it.res.outcome === 'fit' ? 'STAYS' : 'FALLS OFF', outcome: it.res.outcome, reason: it.res.reason,
      gap: it.res.gap ? { pq: it.res.gap, tiles: +yv(it.res.gap).toFixed(3) } : null,
      hand: lib.fmtHand(it.piece, it.col, it.res.way), piece: it.piece, way: it.res.way, wayForced: !!it.wayForced, col: it.col, x: it.col / 2,
      build: fmtLog(it.log), strips: it.res.strips
    }))
  };
  for (const it of order) {
    const k = it.stratum, s = key.strata[k] || (key.strata[k] = { name: it.stratum === 'golden' ? 'golden cases (§18.9)' : it.stratumName, items: 0, stays: 0, fallsOff: 0, reasons: {} });
    s.items++; if (it.res.outcome === 'fit') s.stays++; else { s.fallsOff++; s.reasons[it.res.reason] = (s.reasons[it.res.reason] || 0) + 1; }
  }
  key.total = order.length;
  fs.mkdirSync(path.dirname(KEY), { recursive: true });
  fs.writeFileSync(KEY, JSON.stringify(key, null, 1));
  for (const k in key.strata) { const s = key.strata[k]; console.log(`${k.padEnd(16)} ${String(s.items).padStart(3)} items: ${s.stays} stay, ${s.fallsOff} fall off ${JSON.stringify(s.reasons)}`); }
  console.log(`${order.length} items on ${files.length} sheets in ${OUT}; key ${KEY} (${Date.now() - t0} ms)`);
}
if (require.main === module) main().catch(async e => { console.error(e); await lib.close(); process.exit(1); });
module.exports = { STRATA };
