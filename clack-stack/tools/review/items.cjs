'use strict';
// The intuition panel's items (DESIGN §18.8 G2.2), revision 5c: pictures of a build with ONE tile held just above it and its dotted
// fall lines, and nothing else (no ghost, no outcome, no hatching, no text but a small item number). Three fresh
// judges who know only the photos and a plain description of the tiles answer STAYS, FALLS OFF or UNSURE for each.
//
// Items come in 19 strata (below): revision 5b's 14, and 5 for revision 5c's balance rule (TIPS OVER: a tile that
// meets the tower edge to edge but would make part of the tower tip), each built from minimal pairs whose outcomes
// differ, so each stratum is half STAYS, half FALLS OFF. A pair's first item (the pivot) is of the stratum's kind; its
// partner is the nearest variant with the other outcome, of the stratum's kind too where the stratum allows (a square
// fully on a top that stays has as its partner some other square that falls). For 5b's strata a variant is the same
// build with the hand one step over, or the build with one tile more or less; 5c's strata pair exactly what their
// names say (strictOnly: only partners of the kind):
// - tips-hung: a ▼ hung by one side on a ▲ held by its whole base (stays) against the same ▼ on that ▲ held by half
//   its base, with the tile under its other half left out (tips);
// - tips-light-heavy: a ▲ on a hung ▼'s top (stays, golden case 9) against a square in the same place (tips, 16);
// - tips-stair: a stair of hung triangles one step short of tipping (the hand's tile, the last step that stays)
//   against the same stair with that step in and the hand at the next step, which tips (golden case 14);
// - tips-counter: an overhang (a tile at least half a tile past where its holding edges meet the car) kept by a
//   counterweight (a tile in the part that would tip) or a brace (a tile under it), against the same overhang, at the
//   same place, without that tile;
// - tips-lower: a tile that sits whole on what it lands on (its whole bottom edge on flat tops, or a ▼ in a notch),
//   the parts it sits on holding, which tips a part lower down, against the nearest variant where it stays.
// Pivots come from the exhaustive walk of reachable builds (tools/review/lib.cjs) to --depth tiles, and, for the
// leaning walls, the stairs and the tall stacks on a hung ▼, from walks that only grow those structures (to depth 10);
// smallest and lowest builds first, configurations mixed, with the outcome from rules.js; about half the pairs are
// shown mirrored. The golden cases (§18.9) are added as their own stratum (case 11 can't be shown: the hand never
// holds a square half a tile off).
//
// Triangles in the hand are shown the way up the rules choose (auto-turn, §18.3) everywhere but the "▼ on its point"
// stratum and golden case 5: the hand never shows a ▼ that has no side to hang on (it shows ▲ there), so those force
// the ▼ (key: wayForced). Thin gaps under the build's tiles are left open with a fine dotted outline, as the game draws
// them (§18.2).
//
// Writes sheets of 6 (3 x 2) to --out (default rev5c/panel/sheet-NN.png) and the answer key to --key (default
// rev5c/panel-key/key.json), which must never be shown to the panel.
//   node tools/review/items.cjs [--seed=5] [--depth=6] [--L=64 px per tile] [--out=dir] [--key=file]
//                                [--explore: what each stratum has to offer] [--list: the chosen pairs]
// these keep hundreds of thousands of builds and results: run with a larger heap than Node's default
if (require.main === module && !process.execArgv.some(a => a.startsWith('--max-old-space-size'))) {
  const r = require('child_process').spawnSync(process.execPath, ['--max-old-space-size=10240', __filename].concat(process.argv.slice(2)), { stdio: 'inherit' });
  process.exit(r.status === null ? 1 : r.status);
}
const fs = require('fs');
const path = require('path');
const lib = require('./lib.cjs');
const { CASES } = require('../rules/golden.cjs');
const E = require('../rules/enumerate.cjs');
const G = require('../rules/geom.cjs');

const SCRATCH = '/tmp/claude-0/-home-user-various/eea7fc80-8598-5a7a-a3e6-cdbd34e6e76d/scratchpad/rev5c';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const SEED = +(args.seed || 5), DEPTH = +(args.depth || 6), DEEP = +(args.deep || 10);
const OUT = args.out || path.join(SCRATCH, 'panel'), KEY = args.key || path.join(SCRATCH, 'panel-key', 'key.json');
const R = lib.rules();
const yv = lib.yv;
const HALF = 2;

// ---- what holds the hand's tile where it stops, beyond lib.describe ----
// For a fitting tile, placed: the holding contacts of the build with it (tools/rules/enumerate.cjs supports(): who
// rests on whom; −1 the car), and from them
// - lean: how many ▼ hung by one side, all leaning the same way, the tile continues as a stair (a ▼ hung on a ▲ that
//   stands whole on a hung ▼'s top counts 2, and so on; a ▲ whole on the top of such a stair counts its ▼s), like the
//   photo's leaning wall (golden case 6): each step half a tile further out;
// - stackH: the height of the structure standing on a ▼ hung by one side (the tiles that lose their way to the car
//   when that ▼ goes), with the tile in it, above that ▼'s top; stackN its tiles; stackAir: that ▼'s point is in the
//   air; stackPlain: that structure is a column of squares with the tile on top;
// - inCar: every tile, the hand's too, lies over the car (x from −2 to 2).
function standingOn(below, k) {
  const n = below.length, ok = new Array(n).fill(false);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < n; i++) if (!ok[i] && i !== k && below[i].some(j => j === -1 || (j !== k && ok[j]))) { ok[i] = true; changed = true; }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (i !== k && !ok[i]) out.push(i);
  return out;
}
const tyOf = lib.typeOf;
// a ▼ held by one side: −1 when it hangs on the left side of a ▲ (it is left of it: the stair leans left), +1 right
function hangDir(T, below, i) {
  if (tyOf(T[i]) !== 'dn' || below[i].length !== 1) return 0;
  return T[below[i][0]].col > T[i].col ? -1 : 1;
}
function leanOf(T, below, i) {
  const memo = new Map();
  // chainD(k, dir): a ▼ hung by one side leaning dir, plus the stair under the ▲ it hangs on
  const chainD = (k, dir) => {
    const key = k + ':' + dir;
    if (memo.has(key)) return memo.get(key);
    let v = 0;
    if (hangDir(T, below, k) === dir) v = 1 + chainU(below[k][0], dir);
    memo.set(key, v);
    return v;
  };
  // chainU(j, dir): a ▲ standing whole on the top of a hung ▼ leaning dir (the same col: each step of the stair is
  // half a tile further out than the one below)
  const chainU = (j, dir) => { let m = 0; for (const k of below[j]) if (k >= 0 && tyOf(T[k]) === 'dn' && T[k].col === T[j].col) m = Math.max(m, chainD(k, dir)); return m; };
  const t = tyOf(T[i]);
  if (t === 'dn') { const dir = hangDir(T, below, i); return dir ? chainD(i, dir) : 0; }
  if (t === 'up') return Math.max(chainU(i, -1), chainU(i, 1));
  return 0;
}
const topY = t => t.piece === 'sq' ? yv(t.y) + 1 : yv(t.y) + lib.H;
function placedInfo(B, res) {
  const T = R.tiles(R.place(B, res)), below = E.supports(T), i = T.length - 1;
  const out = { lean: leanOf(T, below, i), stackH: 0, stackN: 0, stackAir: false, stackPlain: false, inCar: T.every(t => t.col >= -2 * HALF && t.col + 2 <= 2 * HALF) };
  for (let k = 0; k < T.length - 1; k++) {
    if (tyOf(T[k]) !== 'dn' || below[k].length !== 1) continue;
    const dep = standingOn(below, k);
    if (!dep.includes(i)) continue;
    const h = Math.max(...dep.map(j => topY(T[j]))) - topY(T[k]);
    if (h > out.stackH + 1e-9) {
      const P = T[k].col + 1, y = T[k].y;
      const air = !(y[0] === 0 && y[1] === 0) && !T.some((u, j) => j !== k && u.way !== 'up' &&
        (u.piece === 'sq' ? u.y[0] + 2 === y[0] && u.y[1] === y[1] : u.y[0] === y[0] && u.y[1] + 1 === y[1]) && P >= u.col && P <= u.col + 2);
      // a plain column: the tiles on the hung ▼ are squares, but for the hand's tile on top
      const plain = dep.every(j => j === i || T[j].piece === 'sq') && Math.max(...dep.map(j => topY(T[j]))) === topY(T[i]);
      Object.assign(out, { stackH: h, stackN: dep.length, stackAir: air, stackPlain: plain });
    }
  }
  return out;
}
// per build (cached on the node): the longest stair of hung triangles in it, the most tiles standing on one hung ▼
function nodeInfo(node) {
  if (node.info) return node.info;
  const T = node.T || R.tiles(node.B), below = E.supports(T);
  let stair = 0, stack = 0;
  T.forEach((t, i) => {
    stair = Math.max(stair, leanOf(T, below, i));
    if (hangDir(T, below, i)) stack = Math.max(stack, standingOn(below, i).length);
  });
  return (node.info = { stair, stack, inCar: T.every(t => t.col >= -2 * HALF && t.col + 2 <= 2 * HALF) });
}
// what is under the half of a square's or ▲'s bottom that does not hold (when one half holds): 'step' (a lower flat
// top of a square or the car), 'dnTop' (a lower ▼ top), 'slant' (a ▲'s side), 'air' (past the car)
function restKind(d) {
  if (d.type === 'dn' || d.held !== 1) return null;
  const h = d.halves.find(x => !x.at0);
  if (!h || h.kind === 'none') return 'air';
  if (h.slant) return 'slant';
  if (h.low) return h.kind === 'dn' ? 'dnTop' : 'step';
  return 'other';
}
// a square or ▲ that falls off although part of its bottom is within 0.3 of a flat top or an apex below it
function nearOff(d) {
  if (d.type === 'dn' || d.outcome !== 'off') return null;
  let best = null;
  for (const h of d.halves) {
    if (!h.e) continue;
    const hi = lib.cmp(h.e[0], h.e[1]) >= 0 ? h.e[0] : h.e[1];
    const g = yv(lib.sub(d.y0, hi));
    if (g > 1e-9 && g < 0.3 && (best === null || g < best)) best = g;
  }
  return best;
}

// ---- the balance rule (revision 5c): what the hand's tile does to the parts of the tower ----
// T2: the build's tiles with the hand's tile added where it stops (a fit, or a TIPS OVER: it met the tower edge to
// edge); only for those, never for ONLY A POINT
const handTile = res => ({ piece: res.way === null ? 'sq' : 'tri', way: res.way, col: res.pose.col, y: res.pose.y });
// per build (rules.tiles() array), cached: who rests on whom by holding edges (enumerate.cjs supports(), revision 5b's
// relation: no points)
const BELOW = new WeakMap();
function belowOf(T) { let b = BELOW.get(T); if (!b) BELOW.set(T, b = E.supports(T)); return b; }
// how many halves of tile j's bottom (a square or ▲) lie on a flat top at its height: the car, a square's, a ▼'s
function heldHalves(T, j) {
  const t = T[j], y = t.y;
  let n = 0;
  for (const s of [t.col, t.col + 1]) {
    if (y[0] === 0 && y[1] === 0 && s >= -2 * HALF && s < 2 * HALF) { n++; continue; }
    if (T.some((u, k) => k !== j && (u.col === s || u.col + 1 === s) &&
      (u.piece === 'sq' ? u.y[0] + 2 === y[0] && u.y[1] === y[1] : u.way === 'down' && u.y[0] === y[0] && u.y[1] + 1 === y[1]))) n++;
  }
  return n;
}
const hungOne = (T, below, k) => T[k].way === 'down' && below[k].length === 1;
// a stair of hung triangles, each step further out the same way: a ▼ hung by one side (its side on a ▲'s slant) is a
// step; a ▲ standing on that ▼'s top, at its col or half a tile further out, carries the stair on. stairOf: the number
// of hung ▼ in the stair tile i ends (a ▼) or stands on (a ▲), and its direction (+1 right, −1 left)
function stairOf(T, below, i) {
  const memo = new Map();
  const dirOf = k => T[below[k][0]].col > T[k].col ? -1 : 1;
  const chainD = (k, dir) => {
    const key = k + ':' + dir;
    if (memo.has(key)) return memo.get(key);
    let v = 0;
    if (hungOne(T, below, k) && dirOf(k) === dir) v = 1 + chainU(below[k][0], dir);
    memo.set(key, v);
    return v;
  };
  const chainU = (j, dir) => {
    let m = 0;
    for (const k of below[j]) if (k >= 0 && T[k].way === 'down' && [0, dir].includes((T[j].col - T[k].col))) m = Math.max(m, chainD(k, dir));
    return m;
  };
  const t = T[i];
  if (t.way === 'down') { if (!hungOne(T, below, i)) return { n: 0, dir: 0 }; const dir = dirOf(i); return { n: chainD(i, dir), dir }; }
  if (t.way === 'up') { const l = chainU(i, -1), r = chainU(i, 1); return r >= l ? { n: r, dir: r ? 1 : 0 } : { n: l, dir: -1 }; }
  return { n: 0, dir: 0 };
}
// how far tile i's middle lies past where its holding edges, all the way down, meet the car (0 when over them): an
// overhang. Points don't count, so a brace under a ▼'s point doesn't hide the overhang it braces.
function overOf(T, below, i) {
  const memo = new Map();
  const base = k => {
    if (memo.has(k)) return memo.get(k);
    memo.set(k, [Infinity, -Infinity]);
    let lo = Infinity, hi = -Infinity;
    for (const j of below[k]) {
      if (j === -1) { lo = Math.min(lo, Math.max(T[k].col / 2, -HALF)); hi = Math.max(hi, Math.min(T[k].col / 2 + 1, HALF)); }
      else { const b = base(j); lo = Math.min(lo, b[0]); hi = Math.max(hi, b[1]); }
    }
    memo.set(k, [lo, hi]);
    return [lo, hi];
  };
  const [lo, hi] = base(i), cx = T[i].col / 2 + 0.5;
  return isFinite(lo) ? Math.max(0, lo - cx, cx - hi) : 0;
}
// the exact balance of every part with the hand's tile in (tools/rules/geom.cjs, independent of rules.js)
function balanceWith(T, res) { const T2 = T.concat([handTile(res)]); return { T2, n: T.length, bal: G.balanceOf(T2, HALF) }; }
// define d[name] as a getter computed once, when first asked (the balance is too dear to work out for every item)
function lazy(d, name, f) {
  Object.defineProperty(d, name, { configurable: true, enumerable: true, get() { const v = f(); Object.defineProperty(d, name, { value: v, enumerable: true }); return v; } });
}

// ---- the strata (revision 5c) ----
// pivot(d): the items a pair can start from; like(d): items of the stratum's kind (preferred as partners; defaults to
// pivot). pivotOnly: every pivot has one outcome, so partners are the nearest variants with the other. mix: sub-quotas
// of pairs by configuration, filled first. pool 'lean' / 'stack': pivots also come from the deeper walks. maxH, maxN:
// the tallest and largest build shown (default 3.9 tiles, 7 tiles).
const STRATA = [
  { id: 'sq-whole', name: 'square fully on a top', pivotOnly: true,
    pivot: d => d.type === 'sq' && d.outcome === 'fit' && d.held === 2 && d.halves[0].idx === d.halves[1].idx,
    like: d => d.type === 'sq' },
  { id: 'sq-half', name: 'square held by half an edge (the rest over a lower step, a slant or a lower ▼ top)', pivotOnly: true, pairs: 6,
    pivot: d => d.type === 'sq' && d.outcome === 'fit' && d.held === 1 && d.thin === null,
    like: d => d.type === 'sq',
    mix: [{ id: 'rest over a lower step', n: 2, is: d => restKind(d) === 'step' }, { id: 'rest over a slant', n: 2, is: d => restKind(d) === 'slant' },
      { id: 'rest over a lower ▼ top', n: 2, is: d => restKind(d) === 'dnTop' }] },
  { id: 'sq-points', name: 'square on points only', pivotOnly: true,
    pivot: d => d.type === 'sq' && d.reason === 'ONLY A POINT',
    like: d => d.type === 'sq' },
  { id: 'sq-two-dn', name: 'square across two ▼ tops', pivotOnly: true,
    pivot: d => d.type === 'sq' && d.outcome === 'fit' && d.held === 2 && d.halves.every(h => h.kind === 'dn') && d.halves[0].idx !== d.halves[1].idx,
    like: d => d.type === 'sq' && d.halves.some(h => h.kind === 'dn') },
  { id: 'up-half', name: '▲ held by half an edge (some half past the car\'s end)', pivotOnly: true, pairs: 6,
    pivot: d => d.type === 'up' && d.outcome === 'fit' && d.held === 1 && d.thin === null,
    like: d => d.type === 'up',
    mix: [{ id: 'over the car', n: 4, is: d => !d.outside }, { id: 'half past the car\'s end', n: 2, is: d => d.outside }] },
  { id: 'up-point', name: '▲ on a point', pivotOnly: true,
    pivot: d => d.type === 'up' && d.reason === 'ONLY A POINT',
    like: d => d.type === 'up' },
  { id: 'up-half-step', name: '▲ at a half step across two tops', pivotOnly: true,
    pivot: d => d.type === 'up' && d.outcome === 'fit' && d.held === 2 && d.halves[0].idx !== d.halves[1].idx,
    like: d => d.type === 'up' },
  { id: 'near-miss', name: 'near miss: a thin gap under the other half', pivotOnly: true,
    pivot: d => d.type !== 'dn' && d.outcome === 'fit' && d.thin !== null,
    like: d => d.type !== 'dn' && (d.thin !== null || d.nearOff !== null),
    mix: [{ id: 'gap 0.134', n: 3, is: d => d.thin < 0.2 }, { id: 'gap 0.268', n: 2, is: d => d.thin > 0.2 }] },
  { id: 'dn-notch', name: '▼ into a notch', pivotOnly: true,
    pivot: d => d.type === 'dn' && d.vee && d.outcome === 'fit',
    like: d => d.type === 'dn' || d.type === 'up',
    mix: [{ id: 'held by both sides', n: 4, is: d => d.sides === 2 }, { id: 'a notch of two heights, held by one side', n: 1, is: d => d.sides === 1 }] },
  { id: 'dn-one-side', name: '▼ by one side', pivotOnly: true,
    pivot: d => d.type === 'dn' && d.outcome === 'fit' && d.sides === 1 && !d.vee,
    like: d => d.type !== 'sq',
    mix: [{ id: 'its point on a flat top', n: 3, is: d => d.pointFlat }, { id: 'its point in the air', n: 2, is: d => !d.pointFlat }] },
  { id: 'dn-point', name: '▼ on its point', forced: true, pivotOnly: true,
    pivot: d => d.type === 'dn' && d.reason === 'ONLY A POINT',
    like: d => d.type === 'dn',
    mix: [{ id: 'its point on a flat top', n: 3, is: d => d.pointFlat }, { id: 'its point on a point or a corner', n: 2, is: d => !d.pointFlat }] },
  { id: 'lean-wall', name: 'leaning wall: a stair of hung triangles inside the car span', pivotOnly: true, pool: 'lean', maxH: 4.6, maxN: 10,
    pivot: d => d.outcome === 'fit' && d.type !== 'sq' && d.lean >= 2 && d.inCar,
    like: d => d.type !== 'sq' && d.buildStair >= 1 && d.buildInCar,
    mix: [{ id: 'the next ▼ of the stair', n: 3, is: d => d.type === 'dn' }, { id: 'a ▲ on the stair', n: 2, is: d => d.type === 'up' }] },
  { id: 'hung-stack', name: 'tall stack resting on a hung ▼', pivotOnly: true, pool: 'stack', maxH: 5.6, maxN: 9,
    pivot: d => d.outcome === 'fit' && d.stackPlain && d.stackN >= 3 && d.stackH >= 2.7,
    like: d => d.buildStack >= 2,
    mix: [{ id: 'the hung ▼\'s point on a flat top', n: 3, is: d => !d.stackAir }, { id: 'the hung ▼\'s point in the air', n: 2, is: d => d.stackAir }],
    bonus: d => 1.8 * d.stackH },
  // revision 5c's balance rule (strictOnly: a pivot without a partner of the kind is not used)
  { id: 'tips-hung', name: '▼ hung by one side on a ▲ held by its whole base, against one hung on a ▲ held by half its base', strictOnly: true,
    pivot: d => d.type === 'dn' && d.outcome === 'fit' && d.sides === 1 && !d.vee && d.hostHeld === 2,
    like: d => d.type === 'dn' && d.reason === 'TIPS OVER' && d.sides === 1 && !d.vee && d.hostHeld === 1,
    // the same ▼ at the same place: the build without the tile under the ▲'s other half (a ▲ held by its whole base
    // always has a flat top under the corner the ▼'s point reaches, so the ▼'s point rests there; held by half its base,
    // the half next to the ▼ unheld, the point is in the air)
    partners: it => variants(it).filter(v => samePose(it, v.item)) },
  { id: 'tips-light-heavy', name: 'a light ▲ on a hung ▼\'s top, against a heavy square in the same place', strictOnly: true,
    pivot: d => d.type === 'up' && d.outcome === 'fit' && d.onHung && d.col % 2 === 0,
    like: d => d.type === 'sq' && d.reason === 'TIPS OVER' && d.onHung,
    partners: it => it.col % 2 ? [] : [{ item: evalItem(it.node, 'sq', it.col), how: 'a square instead of the ▲', cost: 1 }],
    mix: [{ id: 'half on the ▼\'s top', n: 3, is: d => d.held === 1 }, { id: 'its whole base on the ▼\'s top', n: 1, is: d => d.held === 2 }] },
  { id: 'tips-stair', name: 'a stair of hung triangles one step short of tipping, against the step that tips', strictOnly: true, pool: 'stair', maxH: 4.6, maxN: 9,
    pivot: d => d.outcome === 'fit' && d.type !== 'sq' && d.stair >= 1 && d.ratioIn > 0,
    like: d => d.reason === 'TIPS OVER' && d.type !== 'sq' && d.stair >= 2,
    partners: it => nextSteps(it),
    mix: [{ id: 'the step that tips is a ▼', n: 3, is: d => d.type === 'up' }, { id: 'the step that tips is a ▲', n: 2, is: d => d.type === 'dn' }],
    bonus: d => 4 * d.ratioIn },
  { id: 'tips-counter', name: 'an overhang a counterweight or a brace keeps, against the same overhang without it', strictOnly: true, pairs: 6,
    pivot: d => d.outcome === 'fit' && d.over >= 0.5,
    like: d => d.reason === 'TIPS OVER' && d.over >= 0.5,
    partners: it => withoutOne(it),
    mix: [{ id: 'kept by a counterweight', n: 3, pairIs: how => /counterweight/.test(how) }, { id: 'kept by a brace', n: 3, pairIs: how => /brace/.test(how) }] },
  { id: 'tips-lower', name: 'a tile that sits whole on what it lands on but tips a part lower down', pairs: 5, strictOnly: true,
    pivot: d => d.reason === 'TIPS OVER' && d.whole && d.lowerOnly,
    like: d => d.outcome === 'fit' && d.whole,
    // the same tile at the same place, with a tile more or less lower down
    partners: it => variants(it).filter(v => samePose(it, v.item)),
    mix: [{ id: 'a square', n: 2, is: d => d.type === 'sq' }, { id: 'a triangle', n: 2, is: d => d.type !== 'sq' }] },
  { id: 'overhang-past', name: 'overhang half past the car', pivotOnly: true,
    pivot: d => d.outside && d.outcome === 'fit' && (d.type === 'dn' || d.y0[0] + d.y0[1] > 0),
    like: d => d.outside,
    mix: [{ id: '▼ hung past the car', n: 2, is: d => d.type === 'dn' }, { id: '▲ half past the car, up on the build', n: 3, is: d => d.type === 'up' }] }
];
// the hand's tile at the same place in both items of a pair (the difference is then only in the build)
function samePose(p, q) { return p.piece === q.piece && p.col === q.col && p.res.way === q.res.way && lib.eq(p.res.pose.y, q.res.pose.y); }
const PAIRS = +(args.pairs || 5);
const pairsOf = S => S.pairs || PAIRS;
const likeOf = S => S.like || S.pivot;

// ---- the pool: every hand position over every small build ----
function describeItem(B, piece, col, res) {
  const d = lib.describe(B, piece, col, res);
  d.col = col;
  d.nearOff = nearOff(d);
  d.rest = restKind(d);
  Object.assign(d, { lean: 0, stackH: 0, stackN: 0, stackAir: false, stackPlain: false, inCar: false });
  if (res.outcome === 'fit') Object.assign(d, placedInfo(B, res));
  // revision 5c: what holds what it lands on, and what it does to the parts of the tower
  const T = R.tiles(B), below = belowOf(T);
  d.whole = d.type === 'dn' ? d.sides === 2 : d.held === 2;
  d.hostHeld = null; d.pointTouch = null; d.onHung = false;
  if (d.type === 'dn' && d.sides === 1) {
    const j = T.findIndex(t => t.way === 'up' && lib.eq(t.y, d.y0) && Math.abs(t.col - col) === 1);
    d.hostHeld = heldHalves(T, j);
    // its point on something below (a top, an apex, a corner), the ▲ it hangs on aside
    const polys = T.filter((t, k) => k !== j).map(lib.polyOf), X = col / 2 + 0.5, y = yv(d.y0);
    d.pointTouch = [X - 1e-6, X + 1e-6].some(x => { const o = lib.outlineAt(polys, HALF, x); return o !== null && Math.abs(o - y) < 1e-6; });
  }
  if (d.type !== 'dn') d.onHung = d.halves.some(h => h.at0 && h.kind === 'dn' && hungOne(T, below, h.idx));
  d.stair = 0; d.stairDir = 0; d.over = 0; d.handBelow = [];
  if (res.outcome === 'fit' || res.reason === 'TIPS OVER') {
    const T2 = T.concat([handTile(res)]), below2 = E.supports(T2), n = T.length, st = stairOf(T2, below2, n);
    Object.assign(d, { stair: st.n, stairDir: st.dir, over: overOf(T2, below2, n), handBelow: below2[n] });
    // fits: how near the parts with the hand's tile in are to tipping (lean ÷ grip, the largest)
    if (res.outcome === 'fit') lazy(d, 'ratioIn', () => { const { bal } = balanceWith(T, res); return Math.max(0, ...bal.parts.filter(p => p.members.includes(n)).map(p => p.ratio)); });
    else {
      d.ratioIn = null;
      // TIPS OVER: the part that tips is lower down than what the tile lands on, and the parts of what it lands on hold
      lazy(d, 'lowerOnly', () => {
        const { bal } = balanceWith(T, res), on = bal.rests[n].map(r => r.j);
        return !on.includes(res.tips.base) && on.every(j => j < 0 || !bal.parts[j].tips);
      });
    }
  } else d.ratioIn = null;
  if (res.reason !== 'TIPS OVER') d.lowerOnly = false;
  return d;
}
function evalItem(node, piece, col, forced) {
  const way = forced ? 'down' : undefined;
  const res = R.drop(node.B, piece, col, way);
  const d = describeItem(node.B, piece, col, res);
  const ni = nodeInfo(node);
  d.buildStair = ni.stair; d.buildStack = ni.stack; d.buildInCar = ni.inCar && col >= -2 * HALF && col + 2 <= 2 * HALF;
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
const DROPS = [['sq', undefined], ['tri', 'up'], ['tri', 'down']];
// the builds one fitting drop bigger (computed when first needed)
function kidsOf(node) {
  if (node.kidsAll) return node.kidsAll;
  const out = [];
  for (const [piece, way] of DROPS) for (const col of R.cols(node.B, piece)) {
    const r = R.drop(node.B, piece, col, way);
    if (r.outcome === 'fit') out.push({ piece, col, way: way || null });
  }
  return (node.kidsAll = out);
}
// minimal variants of an item with the other outcome: [{item, how, cost}]
function variants(it) {
  const out = [], { node, piece, col, forced } = it;
  const step = piece === 'sq' ? 2 : 1;
  const cols = R.cols(node.B, piece);
  for (const dc of [-step, step]) if (cols.includes(col + dc)) out.push({ item: evalItem(node, piece, col + dc, forced), how: 'hand ' + (dc > 0 ? 'right' : 'left') + ' ' + (step / 2) + ' tile', cost: 1 });
  for (let i = 0; i < node.log.length; i++) {
    const n2 = nodeOfLog(node.log.slice(0, i).concat(node.log.slice(i + 1)));
    if (n2) out.push({ item: evalItem(n2, piece, col, forced), how: 'without tile ' + (i + 1) + ' (' + lib.fmtHand(node.log[i].piece, node.log[i].col, node.log[i].way) + ')', cost: 1.1 });
  }
  for (const k of kidsOf(node)) {
    const n2 = nodeOfLog(node.log.concat([k]));
    if (n2) out.push({ item: evalItem(n2, piece, col, forced), how: 'with ' + lib.fmtHand(k.piece, k.col, k.way) + ' added', cost: 1.2 });
  }
  return out.filter(v => v.item.fit !== it.fit);
}

// revision 5c's partners. The build with the pivot's tile placed, as a node:
function nodeAfter(node, res, piece) {
  const B = R.place(node.B, res), T = R.tiles(B), K = lib.keysOf(T);
  return { B, T, ck: K.ck, key: K.key, log: node.log.concat([{ piece, col: res.pose.col, way: res.way }]), depth: node.depth + 1 };
}
// tips-stair: with the pivot's step in, the next step of the same stair (standing on it, leaning the same way), which
// tips with the pivot's tile in the part that tips
function nextSteps(it) {
  if (!it.fit || !it.d.stair) return [];
  const n2 = nodeAfter(it.node, it.res, it.piece), k = it.node.T.length, out = [];
  for (const q of itemsOf(n2)) {
    if (q.res.reason !== 'TIPS OVER' || !q.res.tips.members.includes(k) || !q.d.handBelow.includes(k)) continue;
    if (q.d.stairDir !== it.d.stairDir || q.d.stair < Math.max(2, it.d.stair)) continue;
    out.push({ item: q, how: 'one step further: with ' + lib.fmtHand(it.piece, it.col, it.res.way) + ' added and the hand at ' + lib.fmtHand(q.piece, q.col, q.res.way), cost: 1.2 });
  }
  return out;
}
// tips-counter: the same build without one tile, every other tile where it was and the hand's tile at the same place,
// where it tips. The tile left out is a counterweight when it is in the part that tips without it, else a brace.
function withoutOne(it) {
  if (!it.fit) return [];
  const { node, piece, col, forced } = it, T = node.T || R.tiles(node.B), out = [];
  let bal = null;
  for (let i = 0; i < node.log.length; i++) {
    const n2 = nodeOfLog(node.log.slice(0, i).concat(node.log.slice(i + 1)));
    if (!n2 || n2.key !== lib.keysOf(T.filter((t, k) => k !== i)).key) continue;
    const q = evalItem(n2, piece, col, forced);
    if (q.res.reason !== 'TIPS OVER' || q.res.way !== it.res.way || !lib.eq(q.res.pose.y, it.res.pose.y)) continue;
    bal = bal || balanceWith(T, it.res).bal;
    const b = q.res.tips.base, bo = b === n2.T.length ? T.length : b < i ? b : b + 1;
    const role = bal.parts[bo].members.includes(i) ? 'counterweight' : 'brace';
    out.push({ item: q, how: 'without tile ' + (i + 1) + ' (' + lib.fmtHand(node.log[i].piece, node.log[i].col, node.log[i].way) + '), the ' + role, cost: 1.1 });
  }
  return out;
}

// ---- deeper walks that only grow a leaning wall, a stair or a stack on a hung ▼ ----
// From the small builds, keep adding fitting drops that grow the structure, to DEEP tiles, at most `cap` builds a depth.
function growWalk(seeds, grows, cap, rs) {
  const seen = new Set(seeds.map(n => n.ck)), out = [];
  let frontier = seeds.slice();
  while (frontier.length) {
    let next = [];
    for (const n of frontier) {
      if (n.depth >= DEEP) continue;
      for (const [piece, way] of DROPS) for (const col of R.cols(n.B, piece)) {
        const r = R.drop(n.B, piece, col, way);
        if (r.outcome !== 'fit' || !grows(n.B, r)) continue;
        const B = R.place(n.B, r), T = R.tiles(B), K = lib.keysOf(T);
        if (seen.has(K.ck)) continue;
        seen.add(K.ck);
        const c = { B, T, ck: K.ck, key: K.key, log: n.log.concat([{ piece, col, way: way || null }]), depth: n.depth + 1 };
        out.push(c); next.push(c);
      }
    }
    if (next.length > cap) next = rs.shuffle(next).slice(0, cap);
    frontier = next;
  }
  return out;
}
const GROW = {
  // a stair of hung triangles over the car: the new tile continues a stair (or starts one: a ▼ hung by one side)
  lean: (B, r) => { const p = placedInfo(B, r); return p.inCar && r.way !== null && p.lean >= 1; },
  // a stack on a hung ▼: the new tile stands on a ▼ hung by one side
  stack: (B, r) => placedInfo(B, r).stackN >= 1,
  // a stair of hung triangles anywhere (from the car's end too): the new tile is a step of one
  stair: (B, r) => { const T = R.tiles(B), T2 = T.concat([handTile(r)]); return stairOf(T2, E.supports(T2), T.length).n >= 1; }
};
function seedsFor(kind, nodes) {
  return nodes.filter(n => {
    const T = n.T, below = E.supports(T);
    if (kind === 'lean') return T.every(t => t.col >= -2 * HALF && t.col + 2 <= 2 * HALF) && T.some((t, i) => hangDir(T, below, i) !== 0);
    return T.some((t, i) => hangDir(T, below, i) !== 0);
  });
}

function sig(it) {
  const d = it.d, s = d.halves.map(x => x.kind + (x.at0 ? '=' : x.low ? 'v' : x.slant ? '/' : '?')).join(',');
  return d.type + ':' + (d.reason || 'fit') + ':' + s + (d.sides !== undefined ? ':s' + d.sides + (d.pointFlat ? 'f' : 'a') : '') + (d.outside ? ':out' : '') + (d.thin !== null ? ':g' + d.thin.toFixed(3) : '') +
    (d.lean ? ':L' + d.lean : '') + (d.stackN ? ':S' + d.stackN + (d.stackAir ? 'a' : '') : '');
}
const cost = it => it.d.n * 1.0 + it.d.height * 1.4 + (it.node.depth === 0 ? 3 : 0);
// how a tile that falls off touches: 'mid' (one point under its middle), 'end' (one point at an end of its bottom),
// 'two' (points at both ends), 'dn' (a ▼ on its point), or for TIPS OVER its piece and the part's size and side; a tile
// that stays: its configuration
function touchKind(it) {
  const d = it.d, res = it.res;
  if (res.outcome === 'fit') return 'fit:' + sig(it);
  if (res.reason === 'TIPS OVER') return 'tips:' + d.type + ':' + res.tips.members.length + res.tips.side;
  if (d.type === 'dn') return 'dn';
  const x0 = it.col, xs = res.contacts.points.filter(q => q[1] === d.y0[0] && q[2] === d.y0[1]).map(q => q[0] - x0);
  if (xs.length >= 2) return 'two';
  return xs.length === 1 && xs[0] === 1 ? 'mid' : 'end';
}

function choosePairs(pools) {
  const used = new Set(), usedBuild = new Map();
  // the golden cases are items of their own: never pick them (or their mirror images) again
  for (const c of CASES) if (!c.throws) {
    const n = nodeOfLog(c.log);
    used.add(evalItem(n, c.lastDrop.piece, c.lastDrop.col).id);
    if (c.lastDrop.piece === 'tri') used.add(evalItem(n, 'tri', c.lastDrop.col, true).id);
  }
  const out = {};
  const srcOf = S => S.forced ? pools.forced : S.pool ? pools.main.concat(pools[S.pool]) : pools.main;
  // the scarcest strata pick first
  const strata = STRATA.slice().sort((a, b) => srcOf(a).filter(it => a.pivot(it.d)).length - srcOf(b).filter(it => b.pivot(it.d)).length);
  for (const S of strata) {
    const maxH = S.maxH || 3.9, maxN = S.maxN || 7;
    const like = likeOf(S), bonus = S.bonus || (() => 0);
    const all = srcOf(S).filter(it => S.pivot(it.d) && it.d.height <= maxH && it.d.n <= maxN);
    const pairs = [], inStratum = new Map(), sigCount = new Map(), partnerKind = new Map();
    // pivots round-robin over their configurations, cheapest first in each
    const ordered = piv => {
      const bySig = new Map();
      for (const it of piv.slice().sort((a, b) => (cost(a) - bonus(a.d)) - (cost(b) - bonus(b.d)))) { const k = sig(it); if (!bySig.has(k)) bySig.set(k, []); bySig.get(k).push(it); }
      const lists = [...bySig.values()].sort((a, b) => (cost(a[0]) - bonus(a[0].d)) - (cost(b[0]) - bonus(b[0].d)));
      const o = [];
      for (let i = 0; o.length < 6000 && lists.some(l => l.length > i); i++) for (const l of lists) if (l[i]) o.push(l[i]);
      return { o, nSig: lists.length };
    };
    // strict: only partners of the stratum's kind whose way of touching is not used up yet (one fall on a point under
    // its middle, two of any other kind); the relaxed pass after it takes the nearest partner
    const gen = S.partners || variants;
    const take = (piv, want, mixId, strict, pairIs) => {
      const { o, nSig } = ordered(piv);
      const cap = Math.max(1, Math.ceil(want / Math.max(1, nSig)));
      let got = 0;
      for (const p of o) {
        if (got >= want || pairs.length >= pairsOf(S)) break;
        if (used.has(p.id) || (usedBuild.get(p.node.ck) || 0) >= 4 || (inStratum.get(p.node.ck) || 0) >= 2) continue;
        if ((sigCount.get(sig(p)) || 0) >= cap) continue;
        let best = null;
        for (const v of gen(p)) {
          const q = v.item;
          if (q.fit === p.fit || (pairIs && !pairIs(v.how))) continue;
          if (used.has(q.id) || (usedBuild.get(q.node.ck) || 0) >= 4 || (inStratum.get(q.node.ck) || 0) >= 2) continue;
          if (q.d.height > maxH || q.d.n > maxN) continue;
          if (q.forced !== p.forced) continue;
          const tk = touchKind(q);
          // (strictOnly strata take every partner of their kind, preferring kinds not used yet)
          if (strict && (!like(q.d) || (!S.strictOnly && (partnerKind.get(tk) || 0) >= (tk === 'mid' ? 1 : 2)))) continue;
          let sc = v.cost * 2 + cost(q) * 0.5;
          if (!like(q.d)) sc += 6;
          if (q.d.type !== p.d.type) sc += 3;
          // falls (or stays) of many kinds, not the same one again and again, and not mostly a tile set on a point under
          // its middle (revision 4's triangle on a triangle's point, the plainest fall)
          sc += 2 * (partnerKind.get(tk) || 0) + (tk === 'mid' ? 1 : 0);
          if (S.pairCost) sc += S.pairCost(p, q);
          if (!best || sc < best.sc) best = { q, how: v.how, sc };
        }
        if (!best || best.sc > 40) continue;
        pairs.push({ a: p, b: best.q, how: best.how, mix: mixId || null });
        used.add(p.id); used.add(best.q.id);
        for (const x of [p, best.q]) { usedBuild.set(x.node.ck, (usedBuild.get(x.node.ck) || 0) + 1); inStratum.set(x.node.ck, (inStratum.get(x.node.ck) || 0) + 1); }
        sigCount.set(sig(p), (sigCount.get(sig(p)) || 0) + 1);
        partnerKind.set(touchKind(best.q), (partnerKind.get(touchKind(best.q)) || 0) + 1);
        got++;
      }
      return got;
    };
    for (const m of S.mix || []) {
      const piv = m.is ? all.filter(it => m.is(it.d)) : all;
      let got = take(piv, m.n, m.id, true, m.pairIs);
      if (got < m.n && !S.strictOnly) got += take(piv, m.n - got, m.id, false, m.pairIs);
      if (got < m.n) { sigCount.clear(); got += take(piv, m.n - got, m.id, true, m.pairIs); }
      if (got < m.n) console.log(`!! ${S.id}: only ${got} of ${m.n} pairs "${m.id}"`);
    }
    if (pairs.length < pairsOf(S)) take(all, pairsOf(S) - pairs.length, null, true);
    if (pairs.length < pairsOf(S) && !S.strictOnly) take(all, pairsOf(S) - pairs.length, null, false);
    if (pairs.length < pairsOf(S)) { sigCount.clear(); take(all, pairsOf(S) - pairs.length, null, !!S.strictOnly); }
    out[S.id] = pairs;
  }
  return out;
}

// ---- drawing one item ----
const L = +(args.L || 64);
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
  return { scene: lib.scene({ half, L, view: { x0: VIEW_X[0], x1: VIEW_X[1], y0: -0.8, y1 }, tiles, lines, grip: { x: lx + 0.5, y: top }, label, slivers: lib.buildSlivers(T, half) }), need: top + 0.42, res };
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
  const pools = { main: [], forced: [], lean: [], stack: [], stair: [] };
  for (const n of small) { for (const it of itemsOf(n)) pools.main.push(it); for (const it of itemsOf(n, true)) pools.forced.push(it); }
  console.log(`walk: ${W.nodes.length} builds to depth ${DEPTH}, ${pools.main.length} hand positions (+${pools.forced.length} forced ▼) in ${Date.now() - t0} ms`);
  // the deeper walks: only the items that could be pivots of their strata are kept
  const rg = lib.rng(SEED * 13 + 3);
  for (const kind of ['lean', 'stack', 'stair']) {
    const Ss = STRATA.filter(s => s.pool === kind);
    const seeds = seedsFor(kind, small.filter(n => n.depth >= 2));
    const grown = growWalk(seeds, GROW[kind], { lean: 1500, stack: 600, stair: 800 }[kind], rg).filter(n => n.depth > DEPTH);
    for (const n of grown) for (const it of itemsOf(n)) if (Ss.some(S => S.pivot(it.d))) pools[kind].push(it);
    console.log(`${kind}: ${seeds.length} seeds, ${grown.length} builds deeper than ${DEPTH} (to ${DEEP}), ${pools[kind].length} pivots (${Date.now() - t0} ms)`);
  }
  if (args.explore) {
    for (const S of STRATA) {
      const src = S.forced ? pools.forced : S.pool ? pools.main.concat(pools[S.pool]) : pools.main;
      const m = src.filter(it => S.pivot(it.d) && it.d.height <= (S.maxH || 3.9) && it.d.n <= (S.maxN || 7));
      const fit = m.filter(x => x.fit).length;
      const sigs = new Map();
      for (const it of m) sigs.set(sig(it), (sigs.get(sig(it)) || 0) + 1);
      console.log(`${S.id}: ${m.length} pivots (${fit} fit, ${m.length - fit} off), ${sigs.size} configurations` + (S.mix ? '; ' + S.mix.map(x => x.id + ' ' + (x.is ? m.filter(it => x.is(it.d)).length : '(by partner)')).join(', ') : ''));
      for (const [k, v] of [...sigs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log('   ' + v + '  ' + k);
    }
    console.log('near misses that fall off (in the walk): ' + pools.main.filter(it => it.d.nearOff !== null).length);
  }
  const chosen = choosePairs(pools);
  if (args.list) for (const S of STRATA) {
    console.log('== ' + S.id);
    for (const p of chosen[S.id]) for (const [it, tag] of [[p.a, 'A ' + (p.mix || '')], [p.b, 'B ' + p.how]]) {
      console.log(`  ${tag.slice(0, 34).padEnd(34)} ${it.node.log.map(e => lib.fmtHand(e.piece, e.col, e.way)).join(' ').padEnd(50)} hand ${lib.fmtHand(it.piece, it.col, it.res.way)} -> ${it.res.outcome} ${it.res.gap ? yv(it.res.gap).toFixed(3) : ''}  [${sig(it)}]${like(S, it) ? '' : ' (not of the kind)'}`);
    }
  }
  function like(S, it) { return likeOf(S)(it.d) || S.pivot(it.d); }
  // the items: pairs per stratum, then the golden cases
  const items = [];
  let pairNo = 0;
  const rr = lib.rng(SEED * 7 + 1);
  for (const S of STRATA) {
    const ps = chosen[S.id];
    if (ps.length < pairsOf(S)) console.log(`!! ${S.id}: only ${ps.length} of ${pairsOf(S)} pairs`);
    for (const p of ps) {
      pairNo++;
      // show about half the pairs mirrored, so the builds are not all on one side
      const mirror = rr() < 0.5;
      for (const [it, role] of [[p.a, 'pivot'], [p.b, 'partner']]) {
        let log = it.node.log, col = it.col;
        if (mirror) { log = lib.canon.mirrorLog(log); col = lib.canon.mirrorCol(col); }
        items.push({ stratum: S.id, stratumName: S.name, pair: 'P' + pairNo, role, mix: role === 'pivot' ? p.mix : null, ofKind: role === 'pivot' || like(S, it), how: role === 'partner' ? p.how : null,
          log, piece: it.piece, col, way: it.forced ? 'down' : undefined, mirrored: mirror });
      }
    }
  }
  for (const c of CASES) {
    if (c.throws) continue;
    const d = c.lastDrop;
    // the hand turns a triangle itself (§18.3); a golden case whose way it would not show (case 5's ▼ on its point)
    // is shown forced, as the dn-point stratum is
    const auto = R.drop(lib.tryReplay(c.log), d.piece, d.col);
    const forced = d.piece === 'tri' && auto.way !== d.way;
    items.push({ stratum: 'golden', stratumName: 'golden case ' + c.n, pair: null, role: null, golden: c.n, log: c.log, piece: d.piece, col: d.col, way: forced ? d.way : undefined });
  }
  // outcomes from the rules (auto-turn unless forced), checked against the pick; wayForced only where the hand itself
  // would show the other way
  for (const it of items) {
    const B = lib.tryReplay(it.log);
    if (!B) throw new Error('item build does not replay: ' + it.log.map(e => lib.fmtHand(e.piece, e.col, e.way)).join(' '));
    const res = R.drop(B, it.piece, it.col, it.piece === 'sq' ? undefined : it.way);
    it.res = res;
    it.d = describeItem(B, it.piece, it.col, res);
    it.wayForced = it.piece === 'tri' && R.drop(B, 'tri', it.col).way !== res.way;
    if (it.golden) {
      const c = CASES[it.golden - 1];
      if (res.outcome !== c.expect.outcome || res.reason !== c.expect.reason) throw new Error('golden ' + it.golden + ' shown result differs: ' + res.outcome + ' ' + res.reason);
    }
    if (it.role === 'pivot') {
      const S = STRATA.find(s => s.id === it.stratum);
      if (!S.pivot(it.d)) throw new Error('pivot of ' + it.stratum + ' is not of its kind after mirroring: ' + it.log.map(e => lib.fmtHand(e.piece, e.col, e.way)).join(' '));
    }
  }
  for (let i = 0; i < items.length; i++) if (items[i].pair && items[i].role === 'pivot') {
    const a = items[i], b = items[i + 1];
    if (a.res.outcome === b.res.outcome) throw new Error('pair ' + a.pair + ' has one outcome');
  }
  // shuffle; the two items of a pair never on one sheet
  const rs = lib.rng(SEED * 31 + 7);
  const order = rs.shuffle(items.slice());
  const sheetOf = i => Math.floor(i / 6);
  for (let round = 0; round < 400; round++) {
    let bad = 0;
    for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) {
      if (!order[i].pair || order[i].pair !== order[j].pair || sheetOf(i) !== sheetOf(j)) continue;
      bad++;
      const k = rs.int(order.length);
      if (sheetOf(k) !== sheetOf(j)) [order[j], order[k]] = [order[k], order[j]];
    }
    if (!bad) break;
  }
  for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) if (order[i].pair && order[i].pair === order[j].pair && sheetOf(i) === sheetOf(j)) throw new Error('pair ' + order[i].pair + ' on one sheet');
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
    const hx = lib.fmtHand(x.piece, x.col, x.res.way), hy = lib.fmtHand(y.piece, y.col, y.res.way);
    if (x.col !== y.col) parts.push('hand at x ' + y.col / 2 + ' instead of ' + x.col / 2);
    if (hx.charAt(0) !== hy.charAt(0)) parts.push('a ' + hy.charAt(0) + ' in the hand instead of a ' + hx.charAt(0));
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
    what: 'Answer key for the CLACK STACK revision 5c intuition panel (DESIGN §18.8 G2.2). Never show this to the panel.',
    seed: SEED, made: new Date().toISOString(), sheets: files.map(f => path.basename(f)), panelDir: OUT,
    rules: 'outcome from clack-stack/rules.js drop(); "expected" is what the panel should answer if the rules match intuition',
    drawing: `${L} CSS px per tile at device scale 1.5 (${(L * 1.5).toFixed(0)} px per tile in the PNG; a 0.134-tile gap is ${(0.134 * L * 1.5).toFixed(1)} px); the held tile is drawn 0.62 tile above where it stops, with dotted lines down from its two ends to what is under them`,
    pairs: 'A pair is the same build with the hand one step over, or the build with one tile more or less; its two items have different outcomes and are never on one sheet. The pivot is of the stratum\'s kind; ofKind says whether the partner is too.',
    wayForced: 'true where the hand would show the triangle the other way up (the "▼ on its point" stratum and golden case 5 only: the hand never shows a ▼ that is only a point, SPEC §6). Every other triangle is shown the way the rules choose (SPEC §6: the way that fits; if neither fits, the way that tips over if exactly one does, else ▲)',
    reasons: 'FALLS OFF has two reasons: ONLY A POINT (it does not meet the tower edge to edge) and TIPS OVER (it does, but with it some part of the tower would lean past what holds it by more than the magnets\' grip; tips names that part\'s lowest tile, its size, its side and the corner it would tip over, in tiles)',
    strata: {},
    items: order.map(it => ({
      n: it.n, sheet: it.sheet, stratum: it.stratum, stratumName: it.stratumName, mix: it.mix || null, pair: it.pair, pairRole: it.role, ofKind: it.pair ? it.ofKind : true, partner: it.partnerN || null,
      pairChange: it.change || null,
      golden: it.golden || null,
      expected: it.res.outcome === 'fit' ? 'STAYS' : 'FALLS OFF', outcome: it.res.outcome, reason: it.res.reason,
      hand: lib.fmtHand(it.piece, it.col, it.res.way), piece: it.piece, way: it.res.way, wayForced: !!it.wayForced, col: it.col, x: it.col / 2,
      build: fmtLog(it.log), gap: it.res.gap ? { pq: it.res.gap, tiles: +yv(it.res.gap).toFixed(3) } : null, held: it.d.held, rest: it.d.rest,
      sides: it.d.sides === undefined ? null : it.d.sides, pointFlat: it.d.pointFlat === undefined ? null : it.d.pointFlat,
      nearOff: it.d.nearOff === null ? null : +it.d.nearOff.toFixed(3), outside: it.d.outside,
      lean: it.d.lean || null, stack: it.d.stackN ? { tiles: it.d.stackN, height: +it.d.stackH.toFixed(3), pointInAir: it.d.stackAir } : null,
      // revision 5c: what tips (the part's lowest tile as it is drawn, its size and side, and the corner it tips over)
      tips: it.res.tips ? { base: it.res.tips.base === it.log.length ? 'the hand\'s tile' : 'tile ' + (it.res.tips.base + 1) + ' (' + lib.fmtHand(it.log[it.res.tips.base].piece, it.log[it.res.tips.base].col, it.log[it.res.tips.base].way) + ')',
        tiles: it.res.tips.members.length, side: it.res.tips.side, pivot: [it.res.tips.pivot[0] / 2, +yv([it.res.tips.pivot[1], it.res.tips.pivot[2]]).toFixed(3)] } : null,
      stair: it.d.stair || null, overhang: it.d.over ? +it.d.over.toFixed(3) : null, hostHeld: it.d.hostHeld, wholeSeat: it.d.whole
    }))
  };
  for (const it of order) {
    const k = it.stratum, s = key.strata[k] || (key.strata[k] = { name: it.stratum === 'golden' ? 'golden cases (§18.9; case 11 throws and is not shown)' : it.stratumName, items: 0, stays: 0, fallsOff: 0, partnersOfKind: 0, reasons: {} });
    s.items++; if (it.res.outcome === 'fit') s.stays++; else { s.fallsOff++; s.reasons[it.res.reason] = (s.reasons[it.res.reason] || 0) + 1; }
    if (it.role === 'partner' && it.ofKind) s.partnersOfKind++;
  }
  key.total = order.length;
  fs.mkdirSync(path.dirname(KEY), { recursive: true });
  fs.writeFileSync(KEY, JSON.stringify(key, null, 1));
  for (const k in key.strata) { const s = key.strata[k]; console.log(`${k.padEnd(16)} ${String(s.items).padStart(3)} items: ${s.stays} stay, ${s.fallsOff} fall off ${JSON.stringify(s.reasons)}${k === 'golden' ? '' : ', partners of the kind ' + s.partnersOfKind}`); }
  console.log(`${order.length} items on ${files.length} sheets in ${OUT}; key ${KEY} (${Date.now() - t0} ms)`);
}
if (require.main === module) main().catch(async e => { console.error(e); await lib.close(); process.exit(1); });
module.exports = { STRATA };
