#!/usr/bin/env node
'use strict';
// DESIGN.md 15.7 acceptance: the strategy bots. The bots play the real game through REAL mouse input at the slot
// positions CS.slots() reports, with the real clock and the real fuse (no CS.setClock), seeds 1-10. Every bot aims
// perfectly: it taps a slot's live centre (and checks the ghost is that slot first); they differ only in policy.
//   node clack-stack/tools/strategy.cjs                         (every test, at bot speed and at human pace, seeds 1-10)
//   node clack-stack/tools/strategy.cjs --only=level8,brace     (tests: level8 level7 level5 level1 big; bots: stack
//                                                                 balance patient brace rhythm nobrace bracer careful
//                                                                 spire brace15 brace4; a name of each kind narrows it)
//   node clack-stack/tools/strategy.cjs --seeds=1-3             (or --seeds=2,5,7)
//   options: --paces=0,0.3 (0: bot speed; R > 0: human pace, a reaction of R s of game time before every act; the
//            default runs both), --jobs=N (games played side by side, default 3 on 4+ cores), --ts=N (game time
//            scale, default 1: real time), --verbose, --trace
//
// The bots (15.7). A slot is "reachable" when the ghost picks it with the hand at its centre (the game's own rule,
// 3.4: supported before hanging, then nearest, then higher): a hanging slot right over a supported one is not offered.
//   StackBot    always the highest reachable slot, as fast as possible
//   BalanceBot  the reachable slot that keeps the centre of mass (with the tiles in the air) most central, as fast as
//               possible (ties: the higher)
//   PatientBot  like StackBot, but waits until W < 0.3 before each drop (StackBot's slot is the top of a one-wide
//               spire: since the review of revision 2 a spire is the slow way up by design, so PatientBot is reported,
//               and CarefulBot, patience on a two-wide tower, carries 15.7's "patience works but costs time")
//   BraceBot    a brace rule a good player can follow (it reads only what the screen shows: the slots, the tiles, W, λ,
//               the piece in the hand and in HOLD):
//                 - wait while W > 0.6
//                 - a triangle in the hand and the gold TRUSS spot open: drop it there (a notch is always completed,
//                   in either order: the down-triangle into the notch, or the second up-triangle beside a hung one)
//                 - a triangle in the hand and a 3-triangle brace's one flat top still narrow above it: widen it (a
//                   down-triangle hung beside the brace row: 15.2's full brace, three flat tops)
//                 - λ >= 2.5 (or a second triangle at hand with nowhere off the band to go: on a two-wide tower it would
//                   only cap a column), a triangle in the hand: build the notch: an up-triangle standing on the top
//                   beside an up-triangle already there, else the first of a pair on a flat top two tiles wide (over
//                   the band: a notch hung out past the base's edge tips the build)
//                 - λ >= 2.5, a square (or the cube) in the hand, a triangle in HOLD and a notch to fill, half a notch
//                   (a lone up-triangle with a free flat edge beside it) or a flat pair spot on the top: swap the
//                   triangle in (HOLD); a lone up-triangle's partner spot is kept free for it
//                 - a triangle in the hand it cannot brace with and no triangle in HOLD: keep it (HOLD); with one in
//                   HOLD already: low, off the band, else on the band's highest top
//                 - otherwise keep the build level and two wide: a square (or the cube) on the lowest supported spot
//                   in a band two tiles wide over the middle of the base (balance-greedy among the lowest; over a narrow
//                   3-triangle brace the squares hanging beside it count too; with nothing in the band, its tops a
//                   notch waiting for its down-triangle: beside the band, balance-greedy, not far out past the base's
//                   edge). (15.7 said balance-greedy; that builds a
//                   one-wide centre spire on the long car's odd width and on a 3-triangle brace's one flat top, the slow
//                   way up since the review of revision 2)
//   SpireBot    one centred column (squares and the cube on the highest, most central supported slot; triangles to
//               HOLD, else low where they keep the balance); drops as soon as the glow is not red (review of
//               revision 2: the one-wide spire must be the slow way up, not the dominant strategy)
//   RandomTapper (BIG MAGNETS) a tap at a uniform x within ±2.5 L of the base centre every 0.7 s game time
// The controls (review of revision 2: the wobble must be beaten by bracing, not by tapping at a steady human pace):
//   RhythmBot      StackBot's slot at a steady 0.6 s from one release to the next (a normal human pace), never
//                  reading W
//   NoBraceBot     BraceBot with the bracing off (no notch is ever built; it still waits while W > 0.6, still keeps
//                  triangles in HOLD and still fills a gold TRUSS spot if one turns up)
//   BraceRhythmBot BraceBot's slot choice at the steady 0.6 s pace, never reading W
//   CarefulBot     BalanceBot's slot, waiting until W < 0.3 before each drop, never bracing (patience on a wide tower)
//   BraceBot λ1.5 / λ4  BraceBot bracing from λ 1.5, or only from λ 4 (when to brace: reported, not a target)
// (Every bot reads W as the screen shows it: with the tiles already let go, state().Wahead, the glow's own measure.
// Read before they land, a bot's second tile was let go on a tower already shaking from its first)
// Tests and targets (over the seeds). Bot speed (pace 0), 15.7 and the controls:
//   level8  (two wide, goal 11 L): share reaching the goal before the clock runs out: BraceBot >= 8/10, StackBot <= 3/10,
//           BalanceBot <= 3/10, CarefulBot >= 4/10 and taking on average >= 35% longer than BraceBot (15.7's
//           PatientBot row, see above); RhythmBot <= 3/10; NoBraceBot on average >= 25% longer than BraceBot (or
//           NoBraceBot <= 6/10), these two over the seeds and as many more (11-20: the comparison's own spread is wide);
//           BraceRhythmBot >= 8/10; SpireBot on average >= 25% longer than BraceBot, or <= 3/10
//   level7  (three wide, goal 10 L): BraceBot >= 9/10; SpireBot >= 25% longer than BraceBot, or <= 3/10
//   level5  (three wide, goal 8 L): BraceBot >= 9/10, StackBot <= 6/10, RhythmBot <= 6/10; SpireBot as on level 7
//   level1  the four 15.7 bots reach the goal 10/10 (the opening stays easy)
//   big     big=1: RandomTapper clears L1 (the SMASH) within 15 s, 10/10
// Human pace (pace R > 0: every act waits R s of game time after the bot first wants it):
//   level8  BraceBot >= 8/10, StackBot <= 3/10, BalanceBot <= 3/10, SpireBot as above; CarefulBot, PatientBot and
//           NoBraceBot are reported, not targets (at a human pace the reactions dominate a wide tower's time: the
//           CarefulBot comparison swung from +24% to +48% on 10 seeds, review 2, a coin toss on its 25% line)
//   level7  BraceBot >= 9/10, SpireBot as above
//   level5  BraceBot >= 9/10, StackBot <= 6/10, SpireBot as above
//   level1  the four 15.7 bots 10/10
// ("On average": the typical time to the goal, the median over all the runs with a run that ended at TIME! counting
// the whole clock it used: it does not swing on which seeds happen to crash, nor on the one run that crashed and
// recovered (a mean did both, review 1). The median over the runs that got there is printed too.) A run ends when the
// ribbon tears (the goal) or at TIME!. The tables: goals, median and mean game time to the goal over the runs that got
// there, the typical time over all (s, from the start), SNAPs (full / with the braced part left standing), crashes (all,
// SNAPs with no TRUSS included), TRUSSes, share of PERFECT landings, tallest. Exits non-zero if a target fails, or on
// any page or console error.
const os = require('os');
const { launch, gamePage, until } = require('./lib.cjs');

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const ONLY = arg('only', '').split(',').filter(Boolean);
const TESTS = ['level8', 'level7', 'level5', 'level1', 'big'];
const BOTS = ['stack', 'balance', 'patient', 'brace', 'rhythm', 'nobrace', 'bracer', 'careful', 'spire', 'brace15', 'brace4'];
const onlyT = ONLY.filter(x => TESTS.includes(x)), onlyB = ONLY.filter(x => BOTS.includes(x));
const bad = ONLY.filter(x => !TESTS.includes(x) && !BOTS.includes(x));
if (bad.length) { console.error('unknown --only name(s): ' + bad.join(', ') + ' (tests: ' + TESTS.join(' ') + '; bots: ' + BOTS.join(' ') + ')'); process.exit(2); }
const wantT = t => !onlyT.length || onlyT.includes(t), wantB = b => !onlyB.length || onlyB.includes(b);
const SEEDS = (() => {
  const s = arg('seeds', '1-10');
  if (s.includes(',')) return s.split(',').map(Number);
  const a = s.split('-').map(Number), out = [];
  for (let k = a[0]; k <= (a[1] || a[0]); k++) out.push(k);
  return out;
})();
const PACES = arg('paces', arg('pace', '0,0.3')).split(',').map(Number);
const EXTRA = SEEDS.map(s => s + Math.max(...SEEDS));      // the extra seeds of the two wide-spread comparisons
const JOBS = Math.max(1, +arg('jobs', Math.max(1, Math.min(3, os.cpus().length - 1))));
const TS = +arg('ts', 1);
const VERBOSE = argv.includes('--verbose') || argv.includes('--trace');
const TRACE = argv.includes('--trace');
const VIEW = { width: 390, height: 844 };
const TAP_Y = Math.round(VIEW.height * 0.55);
const NAME = { stack: 'StackBot', balance: 'BalanceBot', patient: 'PatientBot', brace: 'BraceBot', tapper: 'RandomTapper',
  rhythm: 'RhythmBot', nobrace: 'NoBraceBot', bracer: 'BraceRhythmBot', careful: 'CarefulBot', spire: 'SpireBot', brace15: 'BraceBot λ1.5', brace4: 'BraceBot λ4' };
// each bot as a policy: base (the slot rule), lam (BraceBot's brace trigger), wait (BraceBot waits while W > wait),
// below (waits until W < below before each drop), gap (s of game time from one release to the next: a steady pace),
// sq: 'level' (BraceBot's squares: level and two wide), widen (a spare triangle widens a 3-triangle brace), early (a
// second triangle with nowhere else to go starts a notch whatever λ), red (waits while the glow is red)
const POLICY = {
  stack: { base: 'stack' }, balance: { base: 'balance' }, patient: { base: 'stack', below: 0.3 },
  brace: { base: 'brace', lam: 2.5, wait: 0.6, sq: 'level', widen: 1, early: 1, span: 1.05, side: 1.55 },
  rhythm: { base: 'stack', gap: 0.6 }, nobrace: { base: 'brace', lam: 1e9, wait: 0.6, sq: 'level', widen: 1, span: 1.05, side: 1.55 },
  bracer: { base: 'brace', lam: 2.5, wait: 1e9, gap: 0.6, sq: 'level', widen: 1, early: 1, span: 1.05, side: 1.55 }, careful: { base: 'balance', below: 0.3 },
  brace15: { base: 'brace', lam: 1.5, wait: 0.6, sq: 'level', widen: 1, early: 1, span: 1.05, side: 1.55 }, brace4: { base: 'brace', lam: 4, wait: 0.6, sq: 'level', widen: 1, early: 1, span: 1.05, side: 1.55 },
  spire: { base: 'spire', red: true },
};
// what runs at each pace (the controls that already have a pace of their own run at bot speed only)
const AT = {
  0: { level8: ['stack', 'balance', 'patient', 'brace', 'rhythm', 'nobrace', 'bracer', 'careful', 'spire', 'brace15', 'brace4'],
    level7: ['stack', 'brace', 'spire'], level5: ['stack', 'balance', 'patient', 'brace', 'rhythm', 'spire'], level1: ['stack', 'balance', 'patient', 'brace'] },
  h: { level8: ['stack', 'balance', 'brace', 'nobrace', 'careful', 'patient', 'spire'], level7: ['brace', 'spire'], level5: ['stack', 'brace', 'spire'],
    level1: ['stack', 'balance', 'patient', 'brace'] },
};
// the wide-spread comparison runs over the seeds and as many more: bracing pays (bot speed)
const EXTRA_AT = { 0: ['brace', 'nobrace'], h: [] };

// ---------------------------------------------------------------- the policies (run in the page, CS hooks only)
function botInit() {
  const B = window.__bot = { swapRel: -1 };
  const GAP_LEAD = 0.15;          // s: a steady-pace bot decides this much before its press is due (the aim takes time)
  const MASS = { sq: 1, marble: 1, tri: 0.45, crown: 0.45, cube: 3 };
  // the ghost's own choice with the hand at x (3.4, without the shown ghost's hysteresis): supported, nearest, higher
  B.reach = (sl, R) => sl.filter(s => {
    let best = null;
    for (const o of sl) {
      if (Math.abs(o.x - s.x) > R) continue;
      if (!best) { best = o; continue; }
      const dO = Math.abs(o.x - s.x), dB = Math.abs(best.x - s.x);
      const better = o.supported !== best.supported ? o.supported : Math.abs(dO - dB) > 1e-9 ? dO < dB : Math.abs(o.y - best.y) > 1e-9 ? o.y > best.y : o.key < best.key;
      if (better) best = o;
    }
    return best === s;
  });
  const lat = key => { const m = /^(\w+):(-?\d+),(-?\d+),(-?\d+)$/.exec(key); return m ? { type: m[1], i: +m[2], a: +m[3], b: +m[4] } : null; };
  B.after = (st, s) => { const m = MASS[st.piece] || 1, c = st.comAir; return Math.abs((c.M * c.x + m * s.lx) / (c.M + m)); };
  const highest = list => list.slice().sort((a, b) => b.y - a.y || Math.abs(a.x) - Math.abs(b.x))[0] || null;
  B.balance = (st, rs) => rs.slice().sort((a, b) => B.after(st, a) - B.after(st, b) || b.y - a.y)[0] || null;
  // what the tiles on screen show: an open notch (two up-triangles side by side on one row, nothing between them), and
  // a flat pair spot (two exposed flat top edges side by side, at the highest flat height of the build)
  B.view = st => {
    // (with the tiles in the air: they are on the screen, falling to their slots)
    const tiles = CS.tiles(true).map(t => Object.assign(lat(t.key) || {}, { key: t.key }));
    const has = new Set(tiles.map(t => t.key));
    let notch = false;
    for (const t of tiles) if (t.type === 'up' && has.has('up:' + (t.i + 2) + ',' + t.a + ',' + t.b) && !has.has('dn:' + (t.i + 1) + ',' + t.a + ',' + t.b)) notch = true;
    const tops = new Map(), bottoms = new Set();
    const put = (i, a, b) => tops.set(i + ',' + a + ',' + b, a + b * Math.sqrt(3) / 2);
    const half = st.baseHalf || 1;
    for (let i = -2 * half; i < 2 * half; i += 2) put(i, 0, 0);
    for (const t of tiles) {
      if (t.type === 'sq') { put(t.i, t.a + 1, t.b); bottoms.add(t.i + ',' + t.a + ',' + t.b); }
      else if (t.type === 'dn') put(t.i, t.a, t.b + 1);
      else if (t.type === 'cube') { put(t.i, t.a + 2, t.b); put(t.i + 2, t.a + 2, t.b); bottoms.add(t.i + ',' + t.a + ',' + t.b); bottoms.add((t.i + 2) + ',' + t.a + ',' + t.b); }
      else if (t.type === 'up') bottoms.add(t.i + ',' + t.a + ',' + t.b);
    }
    let hi = -1;
    const open = [];
    for (const [k, y] of tops) if (!bottoms.has(k)) { open.push([k, y]); if (y > hi) hi = y; }
    const at = new Set(open.filter(([, y]) => y >= hi - 1e-6).map(([k]) => k));
    let pair = false;
    for (const k of at) { const [i, a, b] = k.split(',').map(Number); if (at.has((i + 2) + ',' + a + ',' + b)) pair = true; }
    // a notch half built: an up-triangle with the flat edge beside it on its row still free (its partner's spot)
    const spots = [];
    for (const t of tiles) {
      if (t.type !== 'up') continue;
      for (const d of [-2, 2]) {
        const k = (t.i + d) + ',' + t.a + ',' + t.b;
        if (tops.has(k) && !bottoms.has(k) && !has.has('up:' + (t.i + d) + ',' + t.a + ',' + t.b)) spots.push(k);
      }
    }
    return { notch, pair, half: spots.length > 0, spots, tiles, has };
  };
  // one decision for policy P (POLICY): { act: 'wait' | 'hold' | 'drop' | 'none', slot }
  B.decide = (P) => {
    const st = CS.state();
    if (st.phase !== 'play' || !st.handReady || st.locked || !st.piece) return { act: 'wait', why: 'not ready' };
    const rel = CS.lastRelease ? CS.lastRelease.id : 0, canSwap = B.swapRel !== rel;
    // (a steady pace: the decision a little ahead, so the aim is done when the press is due, playOne)
    if (P.gap && CS.lastRelease && st.t - CS.lastRelease.t < P.gap - GAP_LEAD - 1e-9) return { act: 'wait', why: 'pace' };
    // (W as the screen shows it: the glow counts the tiles already let go, state().Wahead)
    if (P.below !== undefined && st.Wahead >= P.below) return { act: 'wait', why: 'W ' + st.Wahead.toFixed(2) };
    // (the glow as the screen shows it: wait while it pulses red, "one more drop could SNAP it")
    if (P.red && st.glow === 'red') return { act: 'wait', why: 'red' };
    const sl = CS.slots(), rs = B.reach(sl, st.big ? 1.0 : 0.6);
    const none = () => canSwap ? { act: 'hold', why: 'no slot' } : { act: 'none', why: 'no slot, swap spent' };
    if (P.base === 'stack') { const s = highest(rs); return s ? { act: 'drop', slot: s } : none(); }
    if (P.base === 'spire') {
      // one centred column: squares (and the cube) on the highest, most central supported slot; a triangle goes to HOLD
      // (with HOLD full of one: low, on the side that keeps the balance)
      if (st.piece === 'tri') {
        if (st.held !== 'tri' && canSwap) return { act: 'hold', why: 'keep the triangle' };
        const low = rs.slice().sort((a, b) => (a.y - b.y) || B.after(st, a) - B.after(st, b))[0];
        return low ? { act: 'drop', slot: low, why: 'triangle low' } : none();
      }
      const s = rs.filter(q => q.supported).sort((a, b) => (b.y - 1.5 * Math.abs(b.lx)) - (a.y - 1.5 * Math.abs(a.lx)))[0];
      return s ? { act: 'drop', slot: s, why: 'spire' } : none();
    }
    if (P.base === 'balance') { const s = B.balance(st, rs); return s ? { act: 'drop', slot: s } : none(); }
    // BraceBot
    if (st.Wahead > P.wait) return { act: 'wait', why: 'W ' + st.Wahead.toFixed(2) };
    const tri = st.piece === 'tri', heldTri = st.held === 'tri', brace = st.lam >= P.lam, level = P.sq === 'level';
    // (the band of a level build: two tiles wide over the middle of the base, left of it on the long car's odd width;
    // a full brace's three tops all count)
    const c = (Math.round(2 * (st.baseHalf || 1)) % 2) ? -0.5 : 0, inBand = q => Math.abs(q.lx - c) <= 1.05 + (q.type === 'cube' ? 0.5 : 0);
    const v = B.view(st);
    if (tri) {
      const truss = rs.filter(s => s.truss);
      if (truss.length) return { act: 'drop', slot: highest(truss), why: 'TRUSS' };
      // (level builds: widen a 3-triangle brace's one flat top into three, a down-triangle hung beside the brace row's
      // up-triangles (15.2's full brace), while the segment over it is still narrow)
      if (level && P.widen && st.yb > 0 && st.w < 1.5) {
        const wd = rs.filter(s => s.type === 'dn' && s.firm && !s.notch && Math.abs(s.ly + Math.sqrt(3) / 6 - st.yb) < 0.02);
        if (wd.length) return { act: 'drop', slot: wd.sort((a, b) => B.after(st, a) - B.after(st, b))[0], why: 'widen' };
      }
      // (early: a second triangle with nowhere off the band to go starts a notch whatever λ: on a two-wide tower a
      // spare triangle would only cap a column; and a half-built notch is always finished)
      const offBand = rs.filter(q => !inBand(q));
      if (brace || (P.early && (v.half || (heldTri && !offBand.length)))) {
        const all = sl.map(s => Object.assign({ L: lat(s.key) }, s));
        // beside an up-triangle already standing on that row (it makes a notch)
        const mk = rs.filter(s => {
          const p = lat(s.key);
          if (!p || p.type !== 'up' || !s.bottom || (P.span && Math.abs(s.lx - c) > P.span)) return false;
          return (v.has.has('up:' + (p.i - 2) + ',' + p.a + ',' + p.b) && !v.has.has('dn:' + (p.i - 1) + ',' + p.a + ',' + p.b)) ||
            (v.has.has('up:' + (p.i + 2) + ',' + p.a + ',' + p.b) && !v.has.has('dn:' + (p.i + 1) + ',' + p.a + ',' + p.b));
        });
        if (mk.length) return { act: 'drop', slot: highest(mk), why: 'notch' };
        // the first of a pair: a standing up-triangle slot with another standing one beside it, on the top
        const ups = all.filter(s => s.L && s.L.type === 'up' && s.bottom);
        const pairs = rs.filter(s => {
          const p = lat(s.key);
          return p && p.type === 'up' && s.bottom && !(P.span && Math.abs(s.lx - c) > P.span) && ups.some(o => o.L.a === p.a && o.L.b === p.b && Math.abs(o.L.i - p.i) === 2);
        });
        const top = pairs.length ? Math.max(...pairs.map(s => s.y)) : 0;
        const best = pairs.filter(s => s.y >= top - 1e-6).sort((a, b) => B.after(st, a) - B.after(st, b))[0];
        if (best) return { act: 'drop', slot: best, why: 'pair' };
      }
      if (!heldTri && canSwap) return { act: 'hold', why: 'keep the triangle' };
      if (level) {
        // (a spare triangle: low, off the band, where it keeps the balance; else on the band's highest top)
        const low = offBand.slice().sort((a, b) => (a.y - b.y) || B.after(st, a) - B.after(st, b))[0];
        if (low) return { act: 'drop', slot: low, why: 'triangle low' };
        const tops = rs.filter(q => q.type === 'up' && q.bottom && inBand(q)), hi = tops.length ? Math.max(...tops.map(q => q.y)) : 0;
        const t1 = B.balance(st, tops.filter(q => q.y >= hi - 0.05)) || B.balance(st, rs);
        if (t1) return { act: 'drop', slot: t1, why: 'triangle on the top' };
      }
    }
    let pool = rs, kept = false;
    if (!tri && (brace || (P.early && v.half))) {
      if (heldTri && canSwap && (v.notch || v.half || (brace && v.pair))) return { act: 'hold', why: 'swap the triangle in (' + (v.notch ? 'notch' : v.half ? 'half a notch' : 'flat pair') + ')' };
      // (no triangle to hand: keep the spot beside a lone up-triangle free for its partner, if there is anywhere else)
      if (v.half) {
        const keep = rs.filter(q => { const p = lat(q.key); return !(p && p.type === 'sq' && v.spots.includes(p.i + ',' + p.a + ',' + p.b)); });
        if (keep.length) { pool = keep; kept = true; }
      }
    }
    // level: a square (or the cube) on the lowest supported spot in a band two tiles wide over the middle of the base
    // (left of the middle on the long car; a full brace's three tops all count), balance-greedy among the lowest
    if (level && !tri) {
      // (over a 3-triangle brace's one flat top, the squares beside the narrow segment count too: they hang off it
      // and widen it, so it never runs one wide for long)
      const narrow = P.widen && st.yb > 0 && st.w < 1.5;
      const band = pool.filter(q => (q.supported || (narrow && q.type === 'sq')) && (q.type === 'sq' || q.type === 'cube') && inBand(q));
      const lo = band.length ? Math.min(...band.map(q => q.y)) : 0;
      const s1 = B.balance(st, band.filter(q => q.y <= lo + 0.05));
      if (s1) return { act: 'drop', slot: s1, why: 'level' + (kept ? ' (the notch spot kept)' : '') };
    }
    // (level builds, nothing in the band (its tops a notch waiting for its down-triangle): beside the band, near the
    // middle, not far out past the base's edge where it tips the build)
    if (level && !tri && P.side) {
      const near = pool.filter(q => Math.abs(q.lx - c) <= P.side);
      const s3 = B.balance(st, near);
      if (s3) return { act: 'drop', slot: s3, why: 'beside the band' + (kept ? ' (the notch spot kept)' : '') };
    }
    const s = B.balance(st, pool);
    return s ? { act: 'drop', slot: s, why: 'balance' + (kept ? ' (the notch spot kept)' : '') } : none();
  };
}

// ---------------------------------------------------------------- one game
async function playOne(browser, test, bot, seed, pace) {
  const level = test === 'big' ? 1 : +test.slice(5);
  const params = Object.assign({ seed, level, ts: TS, autostart: 1, mute: 1, nohint: 1 }, test === 'big' ? { big: 1 } : {});
  const { page, errors, context } = await gamePage(browser, VIEW, params, { realClock: true });
  const r = { test, bot, seed, pace, goal: false, tGoal: null, smash: null, drops: 0, holds: 0, waits: 0, errors, end: '', trace: [] };
  const P = POLICY[bot];
  try {
    await until(page, () => window.CS && CS.state().phase === 'play' && CS.state().handReady, null, 20000);
    await page.evaluate(botInit);
    const t0 = await page.evaluate(() => { const e = CS.events.find(x => x.type === 'start'); return e ? e.t : CS.state().t; });
    if (bot === 'tapper') {
      // RandomTapper (BIG MAGNETS): until the level-1 SMASH, or 40 s
      let rnd = seed * 9973 + 17;
      const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
      for (;;) {
        const s = await page.evaluate(() => { const st = CS.state(), sm = CS.events.find(e => e.type === 'smash' && e.level === 1); return { t: st.t, phase: st.phase, smash: sm ? sm.t : null, cam: CS.cam() }; });
        if (s.smash !== null) { r.smash = s.smash - t0; r.end = 'smash'; break; }
        if (s.t - t0 > 40 || s.phase === 'over') { r.end = s.phase === 'over' ? 'TIME' : '40 s'; break; }
        await page.mouse.move(s.cam.originX + (rand() * 5 - 2.5) * s.cam.L, TAP_Y); await page.mouse.down(); await page.mouse.up();
        r.drops++;
        await until(page, t => CS.state().t >= t, s.t + 0.7, 15000);
      }
    } else {
      // (human pace: an act waits `react` s of game time after the bot first wants it, and is decided again then; a
      // policy with a steady pace of its own (gap) runs as it is)
      const react = P.gap ? 0 : pace;
      for (let guard = 0; guard < 4000; guard++) {
        // the next decision: wait in the page until the hand is ready and the policy acts (or the run is over)
        const d = await page.evaluate(([P, react]) => new Promise(res => {
          const p0 = performance.now();
          let want = -1;
          (function poll() {
            const st = CS.state(), g = CS.events.find(e => e.type === 'goal');
            if (g) return res({ act: 'goal', t: g.t });
            if (st.phase === 'over') return res({ act: 'over', t: st.t });
            const x = window.__bot.decide(P);
            if (x.act === 'wait') want = -1;
            else if (react > 0 && want < 0) want = st.t;
            if ((x.act !== 'wait' && (react <= 0 || st.t >= want + react - 1e-9)) || performance.now() - p0 > 4000) return res(Object.assign(x, { W: st.W, lam: st.lam, piece: st.piece, held: st.held }));
            requestAnimationFrame(poll);
          })();
        }), [P, react]);
        if (TRACE && d.act !== 'wait') r.trace.push(`${d.act} ${d.slot ? d.slot.key : ''} ${d.why || ''} W ${d.W !== undefined ? d.W.toFixed(2) : '-'} λ ${d.lam !== undefined ? d.lam.toFixed(2) : '-'} piece ${d.piece || ''}/${d.held || ''}`);
        if (d.act === 'goal') { r.goal = true; r.tGoal = d.t - t0; r.end = 'goal'; break; }
        if (d.act === 'over') { r.end = 'TIME'; r.tEnd = d.t - t0; break; }
        if (d.act === 'wait') { r.waits++; continue; }
        if (d.act === 'none') { await page.waitForTimeout(30); continue; }
        if (d.act === 'hold') {
          await page.evaluate(() => { window.__bot.swapRel = CS.lastRelease ? CS.lastRelease.id : 0; });
          await page.keyboard.press('Shift'); r.holds++;
          await page.evaluate(() => new Promise(res => requestAnimationFrame(() => res())));
          continue;
        }
        // drop: the hand to the slot's live centre; the ghost must be that slot (else clear the shown ghost's
        // hysteresis and aim again), then press where the slot is now
        const key = d.slot.key;
        let x = d.slot.sx;
        for (let k = 0; k < 3; k++) {
          await page.mouse.move(x, TAP_Y);
          const g = await page.evaluate(key => new Promise(res => requestAnimationFrame(() => {
            const gh = CS.ghost(), s = CS.slots().find(q => q.key === key);
            res({ ok: !!gh && gh.key === key, sx: s ? s.sx : null });
          })), key);
          if (g.sx === null) break;
          x = g.sx;
          if (g.ok) break;
          await page.mouse.move(2, TAP_Y);
          await page.evaluate(() => new Promise(res => requestAnimationFrame(() => res())));
        }
        // (a steady pace: the press waits for its moment, gap s of game time after the last release)
        if (P.gap) await page.evaluate(gap => new Promise(res => { (function f() { const lr = CS.lastRelease; if (!lr || CS.state().t >= lr.t + gap - 1e-9 || CS.state().phase !== 'play') return res(); requestAnimationFrame(f); })(); }), P.gap);
        const now = await page.evaluate(key => { const s = CS.slots().find(q => q.key === key); return { sx: s ? s.sx : null, id: CS.lastRelease ? CS.lastRelease.id : 0 }; }, key);
        if (now.sx !== null) { x = now.sx; await page.mouse.move(x, TAP_Y); }
        await page.mouse.down(); await page.mouse.up();
        r.drops++;
        await until(page, id => (CS.lastRelease && CS.lastRelease.id > id) || CS.state().phase !== 'play', now.id, 3000).catch(() => {});
      }
    }
    const s = await page.evaluate(() => {
      const ev = CS.events, lands = ev.filter(e => e.type === 'land');
      return { snapsFull: ev.filter(e => e.type === 'snap' && e.full).length, snapsPart: ev.filter(e => e.type === 'snap' && !e.full).length,
        crashes: ev.filter(e => e.type === 'crash').length, tipCrashes: ev.filter(e => e.type === 'crash' && !e.snap).length,
        trusses: ev.filter(e => e.type === 'truss').reduce((a, e) => a + (e.n || 1), 0), topples: ev.filter(e => e.type === 'topple').length,
        lands: lands.length, perfect: lands.filter(e => e.grade === 'perfect').length, misses: ev.filter(e => e.type === 'miss').length,
        top: CS.state().tallest, maxW: lands.reduce((a, e) => Math.max(a, e.W || 0), 0),
        glowShort: ev.filter(e => e.type === 'snap' && !(e.glowFor >= 0.3)).length };
    });
    Object.assign(r, s);
    if (TRACE) r.events = await page.evaluate(() => CS.events.filter(e => /land|snap|crash|truss|goal|topple|miss/.test(e.type)).map(e => e.t.toFixed(2) + ' ' + e.type + ' ' +
      (e.type === 'land' ? e.key + ' ' + e.grade + ' W ' + e.W + ' dW ' + e.dW + ' λ ' + e.lam + ' yb ' + e.yb.toFixed(2) : JSON.stringify(Object.assign({}, e, { t: undefined, type: undefined })))));
  } catch (e) {
    r.errors.push('tool: ' + (e && e.message ? e.message.split('\n')[0] : e));
  } finally { await context.close(); }
  if (VERBOSE) console.log(`  ${test} ${NAME[bot]} pace ${pace} seed ${seed}: ${r.end}${r.tGoal !== null ? ' in ' + r.tGoal.toFixed(1) + ' s' : r.smash !== null ? ' in ' + r.smash.toFixed(1) + ' s' : ''}; ` +
    `${r.drops} drops, ${r.holds} holds, tallest ${(r.top || 0).toFixed(1)} L, snaps ${r.snapsFull}/${r.snapsPart}, crashes ${r.crashes}, trusses ${r.trusses}, PERFECT ${r.perfect}/${r.lands}`);
  if (TRACE) { for (const l of r.trace) console.log('     > ' + l); for (const l of r.events || []) console.log('     | ' + l); }
  return r;
}

// ---------------------------------------------------------------- the runs, a few at a time
async function runAll(browser, jobs) {
  const out = new Array(jobs.length);
  let next = 0;
  const worker = async () => { for (;;) { const k = next++; if (k >= jobs.length) return; const j = jobs[k]; out[k] = await playOne(browser, j.test, j.bot, j.seed, j.pace); out[k].extra = !!j.extra; } };
  await Promise.all(Array.from({ length: Math.min(JOBS, jobs.length) }, worker));
  return out;
}

let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
}
const pad = (s, n) => String(s).padEnd(n), lpad = (s, n) => String(s).padStart(n);
const median = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length & 1 ? b[m] : (b[m - 1] + b[m]) / 2; };
function table(title, rows) {
  console.log('\n' + title);
  console.log(pad('bot', 15) + lpad('goal', 7) + lpad('median', 9) + lpad('mean', 9) + lpad('typical', 9) + lpad('snaps f/p', 11) + lpad('crashes', 9) + lpad('trusses', 9) + lpad('PERFECT', 9) + lpad('tallest', 9));
  for (const [bot, rs] of rows) {
    const ok = rs.filter(r => r.goal || r.smash !== null), times = ok.map(r => r.goal ? r.tGoal : r.smash);
    const mean = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null, med = median(times), avg = stats(rs).avg;
    const sum = k => rs.reduce((a, r) => a + (r[k] || 0), 0);
    const lands = sum('lands');
    console.log(pad(NAME[bot], 15) + lpad(ok.length + '/' + rs.length, 7) + lpad(med === null ? '-' : med.toFixed(1) + ' s', 9) + lpad(mean === null ? '-' : mean.toFixed(1) + ' s', 9) + lpad(avg === null || bot === 'tapper' ? '-' : avg.toFixed(1) + ' s', 9) +
      lpad(sum('snapsFull') + '/' + sum('snapsPart'), 11) + lpad(sum('crashes'), 9) + lpad(sum('trusses'), 9) +
      lpad(lands ? Math.round(100 * sum('perfect') / lands) + '%' : '-', 9) + lpad((rs.reduce((a, r) => a + (r.top || 0), 0) / rs.length).toFixed(1) + ' L', 9));
  }
}
// (avg: the typical time to the goal over every run, a run that ended at TIME! counting the whole clock it used: the
// median of those times, so neither the one run that crashed and recovered nor which seeds happen to crash swings it;
// med: the median over the runs that got there; mean: their mean)
const stats = rs => {
  const ok = rs.filter(r => r.goal), t = ok.map(r => r.tGoal), all = rs.map(r => r.goal ? r.tGoal : r.tEnd).filter(x => typeof x === 'number');
  return { n: ok.length, of: rs.length, mean: t.length ? t.reduce((a, b) => a + b, 0) / t.length : null, med: median(t), avg: all.length === rs.length ? median(all) : null };
};

(async () => {
  const browser = await launch();
  const t0 = Date.now();
  const res = {};
  try {
    const jobs = [];
    for (const pace of PACES) {
      const at = AT[pace > 0 ? 'h' : 0];
      for (const test of ['level8', 'level7', 'level5', 'level1']) if (wantT(test)) for (const bot of at[test]) if (wantB(bot)) for (const seed of SEEDS) jobs.push({ test, bot, seed, pace });
      // (the wide-spread comparison over twice the seeds: does bracing pay (bot speed))
      if (wantT('level8')) for (const bot of EXTRA_AT[pace > 0 ? 'h' : 0]) if (wantB(bot)) for (const seed of EXTRA) jobs.push({ test: 'level8', bot, seed, pace, extra: true });
    }
    if (wantT('big') && !onlyB.length) for (const seed of SEEDS) jobs.push({ test: 'big', bot: 'tapper', seed, pace: 0 });
    console.log(`strategy: ${jobs.length} games (seeds ${SEEDS.join(',')}, paces ${PACES.join(', ')}), ${JOBS} at a time, ts ${TS}`);
    const out = await runAll(browser, jobs);
    for (const r of out) { const k = r.test + '@' + r.pace + (r.extra ? '+' : ''); (res[k] = res[k] || {}); (res[k][r.bot] = res[k][r.bot] || []).push(r); }
  } finally { await browser.close(); }

  const titles = { level8: 'level=8: one car (2 L wide), goal 11 L, fuse 1.4 s, bump car + foot', level7: 'level=7: the long car (3 L wide), goal 10 L, fuse 1.5 s, bump car',
    level5: 'level=5: the long car (3 L wide), goal 8 L, fuse 1.7 s, bump car',
    level1: 'level=1: two cars (4 L wide), goal 4 L, fuse 2.4 s', big: 'big=1, level 1: RandomTapper' };
  for (const pace of PACES) for (const test of ['level8', 'level7', 'level5', 'level1', 'big']) {
    const k = test + '@' + pace;
    if (res[k]) table(titles[test] + ` (${pace > 0 ? 'human pace: ' + pace + ' s reaction' : 'bot speed'}; seeds ${SEEDS.join(',')}, ts ${TS})`, Object.entries(res[k]));
  }
  console.log('');
  const n = SEEDS.length, frac = (k, d) => Math.round(k * n / d * 1e9) / 1e9;   // the targets scale with the seed count
  const fmt = s => `${s.n}/${s.of}${s.med !== null ? ', median ' + s.med.toFixed(1) + ' s' : ''}${s.avg !== null ? ', typical ' + s.avg.toFixed(1) + ' s' : ''}`;
  const slower = (a, b, k) => a && b && a.avg !== null && b.avg !== null && a.avg >= k * b.avg;
  const ratio = (a, b) => a && b && a.avg !== null && b.avg !== null ? ` (typical +${Math.round(100 * (a.avg / b.avg - 1))}%${a.med !== null && b.med !== null ? ', median of the goals ' + (a.med >= b.med ? '+' : '') + Math.round(100 * (a.med / b.med - 1)) + '%' : ''})` : '';
  for (const pace of PACES) {
    const tag = pace > 0 ? `[pace ${pace}] ` : '';
    const g = (test, bot) => { const k = test + '@' + pace; return res[k] && res[k][bot] ? stats(res[k][bot]) : null; };
    // (a comparison over the seeds and the extra ones, when they ran)
    const both = (test, bot) => (res[test + '@' + pace] && res[test + '@' + pace][bot] || []).concat((res[test + '@' + pace + '+'] || {})[bot] || []);
    const b8 = g('level8', 'brace'), s8 = g('level8', 'stack'), a8 = g('level8', 'balance'), p8 = g('level8', 'patient');
    const r8 = g('level8', 'rhythm'), nb8 = g('level8', 'nobrace'), br8 = g('level8', 'bracer'), c8 = g('level8', 'careful');
    if (b8) check(tag + 'level=8: BraceBot reaches the goal >= 8/10', b8.n >= frac(8, 10), fmt(b8));
    if (s8) check(tag + 'level=8: StackBot <= 3/10', s8.n <= frac(3, 10), fmt(s8));
    if (a8) check(tag + 'level=8: BalanceBot <= 3/10', a8.n <= frac(3, 10), fmt(a8));
    if (p8) console.log(`INFO ${tag}level=8: PatientBot (StackBot's one-wide spire, waiting for W < 0.3) ${fmt(p8)}${ratio(p8, b8)}`);
    if (pace === 0) {
      if (c8 && b8) {
        check(tag + 'level=8: CarefulBot (patience on a two-wide tower, never bracing) >= 4/10', c8.n >= frac(4, 10), fmt(c8));
        check(tag + 'level=8: CarefulBot takes on average >= 35% longer than BraceBot', slower(c8, b8, 1.35), `CarefulBot ${fmt(c8)}, BraceBot ${fmt(b8)}${ratio(c8, b8)}`);
      }
      if (r8) check(tag + 'level=8: RhythmBot (stacking straight up at a steady 0.6 s, never bracing) <= 3/10', r8.n <= frac(3, 10), fmt(r8));
      if (br8) check(tag + 'level=8: BraceRhythmBot (bracing at the steady 0.6 s, never reading W) >= 8/10', br8.n >= frac(8, 10), fmt(br8));
      if (nb8 && b8) {
        const nb = stats(both('level8', 'nobrace')), bb = stats(both('level8', 'brace')), m = both('level8', 'brace').length;
        check(tag + `level=8: NoBraceBot takes on average >= 25% longer than BraceBot, or NoBraceBot <= 60% (bracing pays; over ${m} seeds)`, slower(nb, bb, 1.25) || nb.n <= 0.6 * nb.of + 1e-9, `NoBraceBot ${fmt(nb)}, BraceBot ${fmt(bb)}${ratio(nb, bb)}`);
      }
    } else {
      if (nb8 && b8) console.log(`INFO ${tag}level=8: NoBraceBot ${fmt(nb8)}, BraceBot ${fmt(b8)}${ratio(nb8, b8)}`);
      if (c8 && b8) console.log(`INFO ${tag}level=8: CarefulBot (patience on a two-wide tower) ${fmt(c8)}, BraceBot ${fmt(b8)}${ratio(c8, b8)}`);
    }
    // (when to brace matters: the same BraceBot bracing from λ 1.5 or only from λ 4, reported)
    const e15 = g('level8', 'brace15'), e4 = g('level8', 'brace4');
    if (b8 && (e15 || e4)) console.log(`INFO ${tag}level=8: the brace trigger: λ 1.5 ${e15 ? fmt(e15) : '-'}; λ 2.5 ${fmt(b8)}; λ 4 ${e4 ? fmt(e4) : '-'}`);
    // (the one-wide spire is the slow way up on every base: 25% slower than BraceBot, or it mostly fails)
    for (const test of ['level8', 'level7', 'level5']) {
      const sp = g(test, 'spire'), bb = g(test, 'brace');
      if (sp && bb) check(tag + `${test.replace('level', 'level=')}: SpireBot (one centred column, dropping when the glow is not red) takes on average >= 25% longer than BraceBot, or <= 3/10`,
        slower(sp, bb, 1.25) || sp.n <= frac(3, 10), `SpireBot ${fmt(sp)}, BraceBot ${fmt(bb)}${ratio(sp, bb)}`);
    }
    const b7 = g('level7', 'brace');
    if (b7) check(tag + 'level=7: BraceBot reaches the goal >= 9/10', b7.n >= frac(9, 10), fmt(b7));
    const b5 = g('level5', 'brace'), s5 = g('level5', 'stack'), r5 = g('level5', 'rhythm');
    if (b5) check(tag + 'level=5: BraceBot reaches the goal >= 9/10', b5.n >= frac(9, 10), fmt(b5));
    if (s5) check(tag + 'level=5: StackBot <= 6/10', s5.n <= frac(6, 10), fmt(s5));
    if (r5) check(tag + 'level=5: RhythmBot <= 6/10', r5.n <= frac(6, 10), fmt(r5));
    for (const bot of ['stack', 'balance', 'patient', 'brace']) { const x = g('level1', bot); if (x) check(tag + `level=1: ${NAME[bot]} reaches the goal ${n}/${n}`, x.n === x.of, fmt(x)); }
  }
  if (res['big@0']) {
    const rs = res['big@0'].tapper, ok = rs.filter(r => r.smash !== null && r.smash <= 15 + 1e-9);
    check(`BIG MAGNETS: RandomTapper clears L1 within 15 s, ${n}/${n}`, ok.length === rs.length,
      `${ok.length}/${rs.length}: ` + rs.map(r => `s${r.seed} ${r.smash === null ? r.end : r.smash.toFixed(1) + ' s'}`).join(', '));
  }
  // the wobble's warning: every SNAP came after at least 0.3 s of the glow (15.3)
  const all = Object.values(res).flatMap(t => Object.values(t).flat());
  const snaps = all.reduce((a, r) => a + (r.snapsFull || 0) + (r.snapsPart || 0), 0), short = all.reduce((a, r) => a + (r.glowShort || 0), 0);
  check('every SNAP was told by the glow for >= 0.3 s first', short === 0, `${snaps} SNAPs, ${short} with less`);
  const errs = all.flatMap(r => r.errors.map(e => `${r.test} ${NAME[r.bot]} s${r.seed}: ${e}`));
  check('no page, console or tool errors', errs.length === 0, errs.slice(0, 4).join(' | '));
  console.log(`\nSTRATEGY: ${failures ? failures + ' target(s) failed' : 'all targets met'} (${((Date.now() - t0) / 60000).toFixed(1)} min)`);
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
