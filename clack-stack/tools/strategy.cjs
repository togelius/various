#!/usr/bin/env node
'use strict';
// DESIGN.md 15.7 acceptance: the strategy bots. Four bots play the real game through REAL mouse input at the slot
// positions CS.slots() reports, with the real clock and the real fuse (no CS.setClock), seeds 1-10. Every bot aims
// perfectly: it taps a slot's live centre (and checks the ghost is that slot first); they differ only in policy.
//   node clack-stack/tools/strategy.cjs                         (every test, seeds 1-10)
//   node clack-stack/tools/strategy.cjs --only=level8,brace     (tests: level8 level5 level1 big; bots: stack balance
//                                                                 patient brace; a name of each kind narrows that kind)
//   node clack-stack/tools/strategy.cjs --seeds=1-3             (or --seeds=2,5,7)
//   options: --jobs=N (games played side by side, default 2), --ts=N (game time scale, default 1: real time), --verbose
//
// The bots (15.7). A slot is "reachable" when the ghost picks it with the hand at its centre (the game's own rule,
// 3.4: supported before hanging, then nearest, then higher): a hanging slot right over a supported one is not offered.
//   StackBot    always the highest reachable slot, as fast as possible
//   BalanceBot  the reachable slot that keeps the centre of mass (with the tiles in the air) most central, as fast as
//               possible (ties: the higher)
//   PatientBot  like StackBot, but waits until W < 0.3 before each drop
//   BraceBot    a brace rule a good player can follow (it reads only what the screen shows: the slots, the tiles, W, λ,
//               the piece in the hand and in HOLD):
//                 - wait while W > 0.6 (the fuse waits too while W > 0.5)
//                 - a triangle in the hand and the gold TRUSS spot open: drop it there (a notch is always completed)
//                 - λ >= 2.5 and a triangle in the hand: build the notch: an up-triangle standing on the top beside an
//                   up-triangle already there, else the first of a pair on a flat top two tiles wide
//                 - λ >= 2.5, a square (or the cube) in the hand, a triangle in HOLD and a notch to fill, half a notch
//                   (a lone up-triangle with a free flat edge beside it) or a flat pair spot on the top: swap the
//                   triangle in (HOLD); no triangle in HOLD: the square goes anywhere but the spot beside a lone
//                   up-triangle (balance-greedy over the rest)
//                 - a triangle in the hand it cannot brace with and no triangle in HOLD: keep it (HOLD)
//                 - otherwise balance-greedy (BalanceBot's choice)
//   RandomTapper (BIG MAGNETS) a tap at a uniform x within ±2.5 L of the base centre every 0.7 s game time
// Tests and targets (over the seeds):
//   level8  (two wide, goal 11 L): share reaching the goal before the clock runs out: BraceBot >= 8/10, StackBot <= 3/10,
//           BalanceBot <= 3/10, PatientBot >= 4/10 and on average >= 35% slower than BraceBot
//   level5  (three wide, goal 8 L): BraceBot >= 9/10, StackBot <= 6/10
//   level1  all four bots reach the goal 10/10 (the opening stays easy)
//   big     big=1: RandomTapper clears L1 (the SMASH) within 15 s, 10/10
// A run ends when the ribbon tears (the goal) or at TIME!. The table: goals, mean game time to the goal (s, from the
// start), SNAPs (full / with the braced part left standing), crashes (all, SNAPs with no TRUSS included), TRUSSes,
// share of PERFECT landings, per bot. Exits non-zero if a target fails, or on any page or console error.
const os = require('os');
const { launch, gamePage, until } = require('./lib.cjs');

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const ONLY = arg('only', '').split(',').filter(Boolean);
const TESTS = ['level8', 'level5', 'level1', 'big'], BOTS = ['stack', 'balance', 'patient', 'brace'];
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
const JOBS = Math.max(1, +arg('jobs', Math.max(1, Math.min(2, os.cpus().length - 1))));
const TS = +arg('ts', 1);
const VERBOSE = argv.includes('--verbose') || argv.includes('--trace');
const TRACE = argv.includes('--trace');
const VIEW = { width: 390, height: 844 };
const TAP_Y = Math.round(VIEW.height * 0.55);
const NAME = { stack: 'StackBot', balance: 'BalanceBot', patient: 'PatientBot', brace: 'BraceBot', tapper: 'RandomTapper' };

// ---------------------------------------------------------------- the policies (run in the page, CS hooks only)
function botInit() {
  const B = window.__bot = { swapRel: -1 };
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
    const tiles = CS.tiles().map(t => Object.assign(lat(t.key) || {}, { key: t.key }));
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
  // one decision: { act: 'wait' | 'hold' | 'drop' | 'none', slot }
  B.decide = (policy) => {
    const st = CS.state();
    if (st.phase !== 'play' || !st.handReady || st.locked || !st.piece) return { act: 'wait', why: 'not ready' };
    const rel = CS.lastRelease ? CS.lastRelease.id : 0, canSwap = B.swapRel !== rel;
    const sl = CS.slots(), rs = B.reach(sl, st.big ? 1.0 : 0.6);
    const none = () => canSwap ? { act: 'hold', why: 'no slot' } : { act: 'none', why: 'no slot, swap spent' };
    if (policy === 'stack' || policy === 'patient') {
      if (policy === 'patient' && st.W >= 0.3) return { act: 'wait', why: 'W ' + st.W.toFixed(2) };
      const s = highest(rs);
      return s ? { act: 'drop', slot: s } : none();
    }
    if (policy === 'balance') { const s = B.balance(st, rs); return s ? { act: 'drop', slot: s } : none(); }
    // BraceBot
    if (st.W > 0.6) return { act: 'wait', why: 'W ' + st.W.toFixed(2) };
    const tri = st.piece === 'tri', heldTri = st.held === 'tri', brace = st.lam >= 2.5;
    if (tri) {
      const truss = rs.filter(s => s.truss);
      if (truss.length) return { act: 'drop', slot: highest(truss), why: 'TRUSS' };
      if (brace) {
        const v = B.view(st), all = sl.map(s => Object.assign({ L: lat(s.key) }, s));
        // beside an up-triangle already standing on that row (it makes a notch)
        const mk = rs.filter(s => {
          const p = lat(s.key);
          if (!p || p.type !== 'up' || !s.bottom) return false;
          return (v.has.has('up:' + (p.i - 2) + ',' + p.a + ',' + p.b) && !v.has.has('dn:' + (p.i - 1) + ',' + p.a + ',' + p.b)) ||
            (v.has.has('up:' + (p.i + 2) + ',' + p.a + ',' + p.b) && !v.has.has('dn:' + (p.i + 1) + ',' + p.a + ',' + p.b));
        });
        if (mk.length) return { act: 'drop', slot: highest(mk), why: 'notch' };
        // the first of a pair: a standing up-triangle slot with another standing one beside it, on the top
        const ups = all.filter(s => s.L && s.L.type === 'up' && s.bottom);
        const pairs = rs.filter(s => {
          const p = lat(s.key);
          return p && p.type === 'up' && s.bottom && ups.some(o => o.L.a === p.a && o.L.b === p.b && Math.abs(o.L.i - p.i) === 2);
        });
        const top = pairs.length ? Math.max(...pairs.map(s => s.y)) : 0;
        const best = pairs.filter(s => s.y >= top - 1e-6).sort((a, b) => B.after(st, a) - B.after(st, b))[0];
        if (best) return { act: 'drop', slot: best, why: 'pair' };
      }
      if (!heldTri && canSwap) return { act: 'hold', why: 'keep the triangle' };
    } else if (brace) {
      const v = B.view(st);
      if (heldTri && canSwap && (v.notch || v.half || v.pair)) return { act: 'hold', why: 'swap the triangle in (' + (v.notch ? 'notch' : v.half ? 'half a notch' : 'flat pair') + ')' };
      // (no triangle to hand: keep the spot beside a lone up-triangle free for its partner, if there is anywhere else)
      if (v.half) {
        const keep = rs.filter(q => { const p = lat(q.key); return !(p && p.type === 'sq' && v.spots.includes(p.i + ',' + p.a + ',' + p.b)); });
        const s2 = B.balance(st, keep);
        if (s2) return { act: 'drop', slot: s2, why: 'balance (the notch spot kept)' };
      }
    }
    const s = B.balance(st, rs);
    return s ? { act: 'drop', slot: s, why: 'balance' } : none();
  };
}

// ---------------------------------------------------------------- one game
async function playOne(browser, test, bot, seed) {
  const level = test === 'big' ? 1 : +test.slice(5);
  const params = Object.assign({ seed, level, ts: TS, autostart: 1, mute: 1, nohint: 1 }, test === 'big' ? { big: 1 } : {});
  const { page, errors, context } = await gamePage(browser, VIEW, params, { realClock: true });
  const r = { test, bot, seed, goal: false, tGoal: null, smash: null, drops: 0, holds: 0, waits: 0, errors, end: '', trace: [] };
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
      for (let guard = 0; guard < 4000; guard++) {
        // the next decision: wait in the page until the hand is ready and the policy acts (or the run is over)
        const d = await page.evaluate(policy => new Promise(res => {
          const t0 = performance.now();
          (function poll() {
            const st = CS.state(), g = CS.events.find(e => e.type === 'goal');
            if (g) return res({ act: 'goal', t: g.t });
            if (st.phase === 'over') return res({ act: 'over' });
            const x = window.__bot.decide(policy);
            if (x.act !== 'wait' || performance.now() - t0 > 4000) return res(Object.assign(x, { W: st.W, lam: st.lam, piece: st.piece, held: st.held }));
            requestAnimationFrame(poll);
          })();
        }), bot);
        if (TRACE && d.act !== 'wait') r.trace.push(`${d.act} ${d.slot ? d.slot.key : ''} ${d.why || ''} W ${d.W !== undefined ? d.W.toFixed(2) : '-'} λ ${d.lam !== undefined ? d.lam.toFixed(2) : '-'} piece ${d.piece || ''}/${d.held || ''}`);
        if (d.act === 'goal') { r.goal = true; r.tGoal = d.t - t0; r.end = 'goal'; break; }
        if (d.act === 'over') { r.end = 'TIME'; break; }
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
        top: CS.state().tallest, maxW: lands.reduce((a, e) => Math.max(a, e.W || 0), 0) };
    });
    Object.assign(r, s);
    if (TRACE) r.events = await page.evaluate(() => CS.events.filter(e => /land|snap|crash|truss|goal|topple|miss/.test(e.type)).map(e => e.t.toFixed(2) + ' ' + e.type + ' ' +
      (e.type === 'land' ? e.key + ' ' + e.grade + ' W ' + e.W + ' dW ' + e.dW + ' λ ' + e.lam + ' yb ' + e.yb.toFixed(2) : JSON.stringify(Object.assign({}, e, { t: undefined, type: undefined })))));
  } catch (e) {
    r.errors.push('tool: ' + (e && e.message ? e.message.split('\n')[0] : e));
  } finally { await context.close(); }
  if (VERBOSE) console.log(`  ${test} ${NAME[bot]} seed ${seed}: ${r.end}${r.tGoal !== null ? ' in ' + r.tGoal.toFixed(1) + ' s' : r.smash !== null ? ' in ' + r.smash.toFixed(1) + ' s' : ''}; ` +
    `${r.drops} drops, ${r.holds} holds, tallest ${(r.top || 0).toFixed(1)} L, snaps ${r.snapsFull}/${r.snapsPart}, crashes ${r.crashes}, trusses ${r.trusses}, PERFECT ${r.perfect}/${r.lands}`);
  if (TRACE) { for (const l of r.trace) console.log('     > ' + l); for (const l of r.events || []) console.log('     | ' + l); }
  return r;
}

// ---------------------------------------------------------------- the runs, a few at a time
async function runAll(browser, jobs) {
  const out = new Array(jobs.length);
  let next = 0;
  const worker = async () => { for (;;) { const k = next++; if (k >= jobs.length) return; const j = jobs[k]; out[k] = await playOne(browser, j.test, j.bot, j.seed); } };
  await Promise.all(Array.from({ length: Math.min(JOBS, jobs.length) }, worker));
  return out;
}

let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
}
const pad = (s, n) => String(s).padEnd(n), lpad = (s, n) => String(s).padStart(n);
function table(title, rows) {
  console.log('\n' + title);
  console.log(pad('bot', 13) + lpad('goal', 7) + lpad('mean time', 11) + lpad('snaps f/p', 11) + lpad('crashes', 9) + lpad('trusses', 9) + lpad('PERFECT', 9) + lpad('tallest', 9));
  for (const [bot, rs] of rows) {
    const ok = rs.filter(r => r.goal || r.smash !== null), times = ok.map(r => r.goal ? r.tGoal : r.smash);
    const mean = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
    const sum = k => rs.reduce((a, r) => a + (r[k] || 0), 0);
    const lands = sum('lands');
    console.log(pad(NAME[bot], 13) + lpad(ok.length + '/' + rs.length, 7) + lpad(mean === null ? '-' : mean.toFixed(1) + ' s', 11) +
      lpad(sum('snapsFull') + '/' + sum('snapsPart'), 11) + lpad(sum('crashes'), 9) + lpad(sum('trusses'), 9) +
      lpad(lands ? Math.round(100 * sum('perfect') / lands) + '%' : '-', 9) + lpad((rs.reduce((a, r) => a + (r.top || 0), 0) / rs.length).toFixed(1) + ' L', 9));
  }
}
const stats = rs => { const ok = rs.filter(r => r.goal); const t = ok.map(r => r.tGoal); return { n: ok.length, of: rs.length, mean: t.length ? t.reduce((a, b) => a + b, 0) / t.length : null }; };

(async () => {
  const browser = await launch();
  const t0 = Date.now();
  const res = {};
  try {
    const jobs = [];
    for (const test of ['level8', 'level5', 'level1']) if (wantT(test)) for (const bot of BOTS) if (wantB(bot)) for (const seed of SEEDS) jobs.push({ test, bot, seed });
    if (wantT('big') && !onlyB.length) for (const seed of SEEDS) jobs.push({ test: 'big', bot: 'tapper', seed });
    console.log(`strategy: ${jobs.length} games (seeds ${SEEDS.join(',')}), ${JOBS} at a time, ts ${TS}`);
    const out = await runAll(browser, jobs);
    for (const r of out) { const k = r.test; (res[k] = res[k] || {}); (res[k][r.bot] = res[k][r.bot] || []).push(r); }
  } finally { await browser.close(); }

  const titles = { level8: 'level=8: one car (2 L wide), goal 11 L, fuse 1.4 s, bump car + foot', level5: 'level=5: the long car (3 L wide), goal 8 L, fuse 1.7 s, bump car',
    level1: 'level=1: two cars (4 L wide), goal 4 L, fuse 2.4 s', big: 'big=1, level 1: RandomTapper' };
  for (const test of ['level8', 'level5', 'level1', 'big']) if (res[test]) table(titles[test] + ` (seeds ${SEEDS.join(',')}, ts ${TS})`, Object.entries(res[test]));
  console.log('');
  const n = SEEDS.length, frac = (k, d) => Math.round(k * n / d * 1e9) / 1e9;   // the targets scale with the seed count
  const g = (test, bot) => res[test] && res[test][bot] ? stats(res[test][bot]) : null;
  const fmt = s => `${s.n}/${s.of}${s.mean !== null ? ', mean ' + s.mean.toFixed(1) + ' s' : ''}`;
  if (res.level8) {
    const b = g('level8', 'brace'), s = g('level8', 'stack'), a = g('level8', 'balance'), p = g('level8', 'patient');
    if (b) check('level=8: BraceBot reaches the goal >= 8/10', b.n >= frac(8, 10), fmt(b));
    if (s) check('level=8: StackBot <= 3/10', s.n <= frac(3, 10), fmt(s));
    if (a) check('level=8: BalanceBot <= 3/10', a.n <= frac(3, 10), fmt(a));
    if (p) check('level=8: PatientBot >= 4/10', p.n >= frac(4, 10), fmt(p));
    if (p && b) check('level=8: PatientBot takes on average >= 35% longer than BraceBot', p.mean !== null && b.mean !== null && p.mean >= 1.35 * b.mean,
      `PatientBot ${p.mean === null ? '-' : p.mean.toFixed(1) + ' s'}, BraceBot ${b.mean === null ? '-' : b.mean.toFixed(1) + ' s'}` + (p.mean !== null && b.mean !== null ? ` (+${Math.round(100 * (p.mean / b.mean - 1))}%)` : ''));
  }
  if (res.level5) {
    const b = g('level5', 'brace'), s = g('level5', 'stack');
    if (b) check('level=5: BraceBot reaches the goal >= 9/10', b.n >= frac(9, 10), fmt(b));
    if (s) check('level=5: StackBot <= 6/10', s.n <= frac(6, 10), fmt(s));
  }
  if (res.level1) for (const bot of BOTS) { const x = g('level1', bot); if (x) check(`level=1: ${NAME[bot]} reaches the goal ${n}/${n}`, x.n === x.of, fmt(x)); }
  if (res.big) {
    const rs = res.big.tapper, ok = rs.filter(r => r.smash !== null && r.smash <= 15 + 1e-9);
    check(`BIG MAGNETS: RandomTapper clears L1 within 15 s, ${n}/${n}`, ok.length === rs.length,
      `${ok.length}/${rs.length}: ` + rs.map(r => `s${r.seed} ${r.smash === null ? r.end : r.smash.toFixed(1) + ' s'}`).join(', '));
  }
  const errs = Object.values(res).flatMap(t => Object.values(t).flat()).flatMap(r => r.errors.map(e => `${r.test} ${NAME[r.bot]} s${r.seed}: ${e}`));
  check('no page, console or tool errors', errs.length === 0, errs.slice(0, 4).join(' | '));
  console.log(`\nSTRATEGY: ${failures ? failures + ' target(s) failed' : 'all targets met'} (${((Date.now() - t0) / 60000).toFixed(1)} min)`);
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
