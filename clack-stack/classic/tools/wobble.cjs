#!/usr/bin/env node
'use strict';
// DESIGN.md 16.1, 16.2 and 15.6: the sway (W, the wobble of revision 2 with one consequence left: it moves the weight),
// the plumb weight, the one way to fall and the crown gamble, driven through real mouse / touch / keyboard input. The
// builds are fixtures (tiles placed with the lattice functions, as flow.cjs's camera checks do; a brace line set where a
// TRUSS would put it) and W is set where a check needs a sway to start from; every drop that matters is a real tap at
// the slot's live position. Every expected value is computed from the game's own CFG (the tuned constants), never
// written in here.
//   node clack-stack/tools/wobble.cjs                 (everything)
//   node clack-stack/tools/wobble.cjs --only=sway,tip   (dw, decay, fuse, sway, weight, tip, gamble, crown, big)
// Checks (τ(Hu, λ) = WOB_TAU · max(1, Hu / WOB_TAU_H) · max(1, λ / WOB_TAU_LAM): the swaying part's settling time;
// cap(λ) = min(WOB_CAP_TOP, WOB_DW_MAX + WOB_CAP_K · max(0, λ − WOB_CAP_L)): the most one CLACK adds, a grade
// g[grade] = WOB_CAP_G of it):
//   dw      every landing on the swaying part adds ΔW = min(cap(λ)·g[grade], a[grade]·max(0, λ − WOB_LAM0)²·(WOB_CUBE
//           for the cube)) to W decayed since the landing before (at the τ of the part it left); a marble square's gear
//           takes W × WOB_GEAR instead; a TRUSS takes it × TRUSS_W: checked on every landing of a balance-greedy player
//           on level 8 (hazards off, the ribbon out of reach); λ, Hu, w and y_b in CS.state() agree with the last
//           landing (reads after a TRUSS, crash or a new level skipped)
//   decay   left alone, W falls as e^(−t/τ(Hu, λ)), less WOB_DRAIN per second (dW/dt = −W/τ − WOB_DRAIN; within 2%)
//   fuse    the fuse never waits for the sway (16.1): with W at 0.95 it drops at its full time (within 2 steps)
//   sway    the part over the brace line sways about SWAY_ANG·W·Hs L at its top (never more) and settles as W does; the
//           braced part under the line stays still; the slots follow the sway (their sx move) and the ghost stays
//           honest: taps at a swaying slot's live centre land on the ghost's slot (lastRelease.ghostKey = the landed
//           key), PERFECT, and so does a hand held still where the slot is at rest (the grade forgives the sway's reach:
//           no timing gamble)
//   weight  the plumb weight hangs at the centre of weight with the sway in it (state().weight.x = the static centre +
//           the sway's move, as the drawing turns the part); it is drawn (its box, and the frame changes as it swings);
//           the ghost weight shows where the weight settles after the aimed drop (the build's centre with the tile on,
//           the tiles in the air counted), and says tip (red) exactly when the drop would tip the tower: a tipping drop
//           crashes, a safe one stands
//   tip     one way to fall (16.1): a sway that carries the weight past a wheel tips the tower: a crash with the weight
//           past the wheel (crash.past); a fast stacker on level 8: every crash is with the weight past a wheel, no tile
//           ever comes off on its own (no 'snap' events, never "SNAP!" or "TOO THIN"); a TRUSS cuts the sway × TRUSS_W
//   gamble  (15.6) at the ribbon the crown drops into the hand and the GO HIGHER chip shows beside the HOLD box (in
//           view, over neither NEXT nor HOLD) with the crown's value; the first crown ever shows the hint once
//           ('crownhint', the prefs remember it; the next crown has none); a mouse click on the chip banks the crown and
//           starts OVERTIME; the HOLD box's badge shows the live multiplier ×(1 + 0.5·⌊top − G⌋) as the build grows;
//           HOLD (Shift) takes the crown back (the badge leaves the HOLD box) and placing it pays 100 × level × that; a
//           touch tap on the chip banks it too; HOLD banks it; a crash in OVERTIME loses it, ties the ribbon up again and
//           says NO CROWN!
//   crown   the choice is the player's: taps already on their way when the crown arrives (a 0.3 s tapper) never place
//           it (nothing goes for CROWN_GRACE s); the fuse never drops it while the chip is up (still there after 3 s)
//   big     BIG MAGNETS: no chip (the crown is simply in the hand), ΔW × WOB_BIG
// Exits non-zero on any failure, page error or console error.
const { launch, gamePage, until } = require('./lib.cjs');

const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = n => !ONLY.length || ONLY.includes(n);
const VIEW = { width: 390, height: 844 };
const TAP_Y = Math.round(VIEW.height * 0.55);
let failures = 0;
const errorsAll = [];
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
}

async function open(browser, params, opts) {
  const g = await gamePage(browser, (opts && opts.view) || VIEW, Object.assign({ mute: 1, nohint: 1, autostart: 1 }, params), Object.assign({ realClock: true }, opts || {}));
  await until(g.page, () => window.CS && CS.state().phase === 'play' && CS.state().handReady, null, 15000);
  // (the Sfx calls)
  await g.page.evaluate(() => { window.__sfx = []; for (const k of ['crash', 'lock']) { const f = Sfx[k]; Sfx[k] = function () { __sfx.push({ k, t: S.gt }); return f.apply(this, arguments); }; } });
  return g;
}
async function close(g) { errorsAll.push(...g.errors); await g.context.close(); }
const frame = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
async function ready(page) { await until(page, () => { const s = CS.state(); return s.phase === 'play' && s.handReady && !s.locked; }, null, 15000); }
// the fixture: tiles placed by slot key with the lattice functions (a brace line where a TRUSS would put it)
function fixture(page, keys, yb) {
  return page.evaluate(([keys, yb]) => {
    const B = S.B, cols = ['blue', 'yellow', 'red', 'green', 'lightblue', 'purple', 'orange'];
    keys.forEach((k, i) => {
      genSlots(B);
      const c = B.cands.find(q => q.key === k);
      if (!c) throw new Error('fixture: no slot ' + k);
      const shape = c.type === 'up' || c.type === 'dn' ? 'tri' : c.type;
      addTile(B, c.pose, { shape, color: cols[i % 7], variant: 0, mass: CFG.MASS[shape], k: CFG.KROT[shape], depth: c.depth, flight: false, landT: -1 });
    });
    if (yb) { B.yb = yb; B.trusses++; lockJoints(B); }
    genSlots(B); recomputeTower(); massProps(B, true, COMMIT); computeGhost();
    return CS.state();
  }, [keys, yb || 0]);
}
// a real tap at slot `key`'s centre, where it is at rest (the middle of its swing: what the hand aims at, 16.2;
// checking the ghost is that slot; a shown ghost's hysteresis cleared if not); waits for its landing; returns { rel, land }
async function tapSlot(page, key, opts) {
  opts = opts || {};
  await ready(page);
  // (the piece the slot is for: a square for a square slot (fixture), unless the crown is in the hand)
  const shape = opts.shape || (key.startsWith('sq') ? 'sq' : key.startsWith('cube') ? 'cube' : 'tri');
  // (a plain square for a square slot: a marble square's gear would steady the sway a check sets up)
  await page.evaluate(sh => { if (!HAND.piece || (HAND.piece.shape !== 'crown' && HAND.piece.shape !== sh)) { HAND.piece = { shape: sh, color: 'blue', variant: 0 }; computeGhost(); } }, shape);
  let x = null;
  for (let k = 0; k < 3; k++) {
    const s = await page.evaluate(key => { const q = CS.slots(true).find(o => o.key === key); return q ? q.rsx : null; }, key);
    if (s === null) throw new Error('tap: no slot ' + key + ' (' + (await page.evaluate(() => CS.slots().map(o => o.key).join(' '))) + ')');
    x = s;
    await page.mouse.move(x, TAP_Y);
    await frame(page);
    const g = await page.evaluate(key => { const gh = CS.ghost(), q = CS.slots(true).find(o => o.key === key); return { ok: !!gh && gh.key === key, sx: q ? q.rsx : null }; }, key);
    if (g.ok) { x = g.sx; break; }
    await page.mouse.move(2, TAP_Y); await frame(page);
  }
  if (opts.before) await page.evaluate(opts.before);
  const id0 = await page.evaluate(key => { const q = CS.slots(true).find(o => o.key === key); window.__tapX = q ? q.rsx : null; return CS.lastRelease ? CS.lastRelease.id : 0; }, key);
  const xs = await page.evaluate(() => window.__tapX);
  if (xs !== null) { x = xs; await page.mouse.move(x, TAP_Y); }
  await page.mouse.down(); await page.mouse.up();
  await until(page, id => CS.lastRelease && CS.lastRelease.id > id, id0, 5000);
  const rel = await page.evaluate(() => CS.lastRelease);
  await until(page, id => CS.events.some(e => (e.type === 'land' || e.type === 'lost') && e.id === id) || CS.state().phase !== 'play', rel.id, 5000).catch(() => {});
  const land = await page.evaluate(id => CS.events.find(e => e.type === 'land' && e.id === id) || null, rel.id);
  return { rel, land };
}
// a lattice key's lowest y (squares a..a+1 at b; triangles from a + b·h)
const H3 = Math.sqrt(3) / 2;
function minY(key) { const m = /^(\w+):(-?\d+),(-?\d+),(-?\d+)$/.exec(key); return +m[3] + +m[4] * H3; }

// the game's sway constants (CFG), and the model they define, mirrored here from DESIGN 16.2 as tuned
const WCFG = page => page.evaluate(() => { const o = {}; for (const k of Object.keys(CFG)) if (/^WOB_|^SWAY_|^TRUSS_W$|^STEP$/.test(k)) o[k] = CFG[k] === Infinity ? 'Inf' : CFG[k]; return o; });
const inf = v => (v === 'Inf' ? Infinity : v);
const tauOf = (C, Hu, lam) => C.WOB_TAU * Math.max(1, Hu / inf(C.WOB_TAU_H)) * Math.max(1, lam / inf(C.WOB_TAU_LAM));
// W after dt s at settling time tau: dW/dt = −W/τ − WOB_DRAIN, floored at 0; and the time it takes to fall from W0 to W1
const decayOf = (C, W, dt, tau) => W <= 0 ? 0 : Math.max(0, (W + C.WOB_DRAIN * tau) * Math.exp(-dt / tau) - C.WOB_DRAIN * tau);
const fallT = (C, W0, W1, tau) => tau * Math.log((W0 + C.WOB_DRAIN * tau) / (W1 + C.WOB_DRAIN * tau));
const capOf = (C, lam) => Math.min(C.WOB_CAP_TOP, C.WOB_DW_MAX + C.WOB_CAP_K * Math.max(0, lam - inf(C.WOB_CAP_L)));
const dWOf = (C, grade, shape, lam, big) => {
  const d = Math.max(0, lam - C.WOB_LAM0), a = C.WOB_A[grade], cap = capOf(C, lam) * C.WOB_CAP_G[grade];
  return Math.min(cap, a * d * d * (shape === 'cube' ? C.WOB_CUBE : 1)) * (big ? C.WOB_BIG : 1);
};
const HGT = { sq: 1, up: H3, dn: H3, cube: 2 };
function maxY(key) { const m = /^(\w+):/.exec(key); return minY(key) + (HGT[m[1]] || 1); }

// ---------------------------------------------------------------- dw: ΔW and its decay on every landing
async function dwCheck(browser) {
  const rows = [], bad = [], st0 = [];
  let C = null;
  for (const seed of [1, 2, 3]) {
    const g = await open(browser, { seed, level: 8, ts: 2 });
    const { page } = g;
    C = await WCFG(page);
    // (hazards off; the ribbon out of reach: the crown and the next level would take the build away mid-check)
    await page.evaluate(() => { HZ.every = 0; HZ.kind = ''; S.G = 99; });
    // a balance-greedy player that waits for W < 0.4 (so it builds tall enough for λ to matter; 60 drops: with the
    // sway's crashes, enough of them are read with nothing in the air)
    for (let k = 0; k < 60; k++) {
      await until(page, () => { const s = CS.state(); return (s.phase === 'play' && s.handReady && !s.locked && s.W < 0.4) || s.phase === 'over'; }, null, 20000).catch(() => {});
      const st = await page.evaluate(() => { CS.setClock(60); return CS.state(); });     // (the clock kept up: no TIME!)
      if (st.phase !== 'play') break;
      // the state's measure agrees with the last landing's (not across a TRUSS, a crash or a new level)
      const last = await page.evaluate(() => { const l = CS.events.filter(e => e.type === 'land').slice(-1)[0] || null; return l && !CS.events.some(e => /^(truss|crash|smash|level|goal|crown|topple)$/.test(e.type) && e.t >= l.t) ? l : null; });
      if (last && st.inAir === 0) st0.push({ lam: st.lam, ev: last.lam, yb: st.yb, evyb: last.yb, Hu: st.Hu, evHu: last.Hu, w: st.w });
      const p = await page.evaluate(() => {
        const st = CS.state(), sl = CS.slots().filter(s => s.supported), m = { sq: 1, marble: 1, tri: 0.45, cube: 3 }[st.piece] || 1, c = st.comAir;
        sl.sort((a, b) => Math.abs((c.M * c.x + m * a.lx) / (c.M + m)) - Math.abs((c.M * c.x + m * b.lx) / (c.M + m)) || b.y - a.y);
        return sl[0] || null;
      });
      if (!p) { await page.keyboard.press('Shift'); await frame(page); continue; }
      await page.mouse.move(p.sx + (k % 5 === 4 ? 0.2 : 0) * (await page.evaluate(() => CS.cam().L)), TAP_Y); await page.mouse.down(); await page.mouse.up();
      await page.waitForTimeout(40);
    }
    await until(page, () => CS.state().inAir === 0, null, 5000).catch(() => {});
    const ev = await page.evaluate(() => CS.events.filter(e => /^(land|truss|crash|start)$/.test(e.type)));
    const trussAt = new Set(ev.filter(e => e.type === 'truss').map(e => e.key + '@' + e.t));
    let prev = null;
    for (const e of ev) {
      if (e.type === 'start' || e.type === 'crash') { prev = { t: e.t, W: 0, Hu: 0, lam: 0 }; continue; }
      if (e.type === 'truss') { if (prev) { prev.Hu = e.Hu; prev.lam = e.lam; } continue; }
      if (prev) {
        const dec = decayOf(C, prev.W, e.t - prev.t, tauOf(C, prev.Hu, prev.lam));
        // (the landing that closes a notch braces the tower: no ΔW, W × TRUSS_W (the landing's own W has it); a marble
        // square's gear steadies it: × WOB_GEAR)
        const truss = trussAt.has(e.key + '@' + e.t), inSeg = minY(e.key) >= e.yb - 1e-6 && !truss;
        const gear = inSeg && e.shape === 'marble';
        // (ΔW at the λ the landing leaves on the part it landed on: lam0, before any brace)
        const dWwant = inSeg && !gear ? dWOf(C, e.grade, e.shape, e.lam0, false) : 0;
        const want = truss ? dec * C.TRUSS_W : gear ? dec * C.WOB_GEAR : Math.min(1, dec + dWwant);
        rows.push({ seed, e, want, dWwant, gear, truss });
        if (Math.abs(e.W - want) > 3e-3 + 2e-3 * want || Math.abs(e.dW - dWwant) > 1e-3 + 2e-3 * dWwant || !!e.gear !== gear) bad.push(`s${seed} t=${e.t} ${e.key} ${e.grade}: W ${e.W} (want ${want.toFixed(4)}), dW ${e.dW} (want ${dWwant.toFixed(4)} at λ ${e.lam0}, Hu ${e.Hu})${gear ? ' gear' : ''}${truss ? ' truss' : ''}`);
      }
      prev = { t: e.t, W: e.W, Hu: e.Hu, lam: e.lam };
    }
    await close(g);
  }
  const pos = rows.filter(r => r.e.dW > 0).length, grades = new Set(rows.filter(r => r.e.dW > 0).map(r => r.e.grade)), capped = rows.filter(r => r.e.dW > 0 && Math.abs(r.e.dW - capOf(C, r.e.lam0) * C.WOB_CAP_G[r.e.grade]) < 1e-3).length;
  check('dw: every landing adds ΔW = min(cap(λ)·g[grade], a[grade]·max(0, λ − λ₀)²(·cube)) to W decayed e^(−Δt/τ(Hu, λ)) (gear × WOB_GEAR, TRUSS × TRUSS_W)', bad.length === 0 && pos >= 20,
    `${rows.length} landings, ${pos} with ΔW > 0 (${capped} at the cap; grades ${[...grades].join(', ')}), ${rows.filter(r => r.gear).length} gears, ${rows.filter(r => r.truss).length} TRUSSes, max W ${Math.max(...rows.map(r => r.e.W)).toFixed(3)}` + (bad.length ? '; BAD: ' + bad.slice(0, 4).join('; ') : ''));
  const mis = st0.filter(s => Math.abs(s.lam - s.ev) > 2e-3 || Math.abs(s.yb - s.evyb) > 1e-3 || Math.abs(s.Hu - s.evHu) > 2e-3 || Math.abs(s.lam - s.Hu / s.w) > 1e-9 || s.w < 1 - 1e-9);
  check('dw: CS.state() λ = Hu / w (w >= 1 L), Hu and y_b agree with the last landing', st0.length >= 10 && mis.length === 0, `${st0.length} reads` + (mis.length ? '; ' + JSON.stringify(mis.slice(0, 2)) : ''));
}

// ---------------------------------------------------------------- decay, fuse, sway (level 8, hazards off)
const COL2 = n => { const k = []; for (let a = 0; a < n; a++) k.push('sq:-2,' + a + ',0', 'sq:0,' + a + ',0'); return k; };
async function decayFuseSway(browser) {
  const g = await open(browser, { seed: 4, level: 8, ts: 1 });
  const { page } = g;
  const C = await WCFG(page);
  await page.evaluate(() => { HZ.every = 0; HZ.kind = ''; });
  // a first drop (the fuse starts once the player has dropped something), on a 2-wide 5 L column
  await fixture(page, COL2(5));
  await tapSlot(page, 'sq:-2,5,0');
  await ready(page);
  if (want('decay')) {
    const w0 = await page.evaluate(() => { WOB.W = 0.8; return { t: S.gt, Hu: WOB.Hu, lam: WOB.lam }; });
    await until(page, t => CS.state().t >= t + 1, w0.t, 5000);
    const r = await page.evaluate(t => ({ W: CS.state().W, dt: CS.state().t - t }), w0.t);
    const tau = tauOf(C, w0.Hu, w0.lam), want1 = decayOf(C, 0.8, r.dt, tau);
    check(`decay: W falls as e^(−t / τ(Hu, λ))${C.WOB_DRAIN ? ', less ' + C.WOB_DRAIN + '/s' : ''}`, Math.abs(r.W - want1) <= 0.02 * want1, `W ${r.W.toFixed(4)} after ${r.dt.toFixed(3)} s (want ${want1.toFixed(4)}: τ ${tau.toFixed(3)} s at Hu ${w0.Hu.toFixed(2)}, λ ${w0.lam.toFixed(2)})`);
  }
  if (want('fuse')) {
    // (W 0.6, over revision 2's fuse wait: on this 2-wide 6 L column the swing stays inside the wheels)
    await ready(page);
    const set = await page.evaluate(() => { WOB.W = 0.6; return { t: S.gt, fuseT: HAND.fuseT, fuse: levelInfo(S.level).fuse, id: CS.lastRelease ? CS.lastRelease.id : 0, allTippy: S.allTippy }; });
    await until(page, id => (CS.lastRelease && CS.lastRelease.id > id) || CS.state().phase !== 'play', set.id, 15000).catch(() => {});
    const rel = await page.evaluate(() => CS.lastRelease), want1 = set.t + (set.fuse - set.fuseT);
    check('fuse: the fuse never waits for the sway (16.1): with W at 0.6 it drops at its full time',
      rel && rel.id > set.id && rel.src === 'fuse' && Math.abs(rel.t - want1) <= 2.5 / 120,
      `drop by ${rel && rel.src} at +${rel ? (rel.t - set.t).toFixed(3) : '-'} s (want +${(want1 - set.t).toFixed(3)}: the fuse left)`);
  }
  if (want('sway')) {
    // a brace line at 5 L (fixture): the 6 L of column above it sway, the 5 rows under it stay still
    await close(g);
    const g2 = await open(browser, { seed: 4, level: 8, ts: 1 });
    const p2 = g2.page;
    // (hazards off, and the fuse too (fixture): nothing but the taps here lands on the swaying tower)
    await p2.evaluate(() => { HZ.every = 0; HZ.kind = ''; LEVELS[8].fuse = 1e9; });
    await fixture(p2, COL2(5).concat(['up:-2,5,0', 'up:0,5,0', 'dn:-1,5,0', 'sq:-1,5,1', 'sq:-3,5,1', 'sq:1,5,1', 'sq:-1,6,1', 'sq:-3,6,1', 'sq:1,6,1']), 5 + H3);
    await tapSlot(p2, 'sq:-1,7,1');
    await ready(p2);
    const seg = await p2.evaluate(() => ({ Hu: WOB.Hu, lam: WOB.lam }));
    const Hs = Math.max(1, seg.Hu), A1 = C.SWAY_ANG * Hs;     // (the swing at W = 1, L at the top)
    const tau = tauOf(C, seg.Hu, seg.lam), settleT = fallT(C, 0.9, 0.015 / A1, tau) + 0.4, endT = Math.min(14, settleT + 0.3);
    const samples = await p2.evaluate(endT => new Promise(res => {
      WOB.W = 0.9;
      const out = [], t0 = S.gt, low = CS.tiles().find(t => t.key === 'sq:-2,1,0').key, top = 'sq:-1,7,1';
      (function f() {
        const st = CS.state(), tl = CS.tiles(), a = tl.find(t => t.key === low), b = tl.find(t => t.key === top), sl = CS.slots().sort((u, v) => v.y - u.y)[0];
        out.push({ t: st.t - t0, W: st.W, q: st.sway, qv: st.swayV, wq: WOB.wq, low: a ? a.sx : null, top: b ? b.sx : null, slot: sl ? sl.sx : null, key: sl ? sl.key : null, still: st.still });
        if (st.t - t0 < endT) requestAnimationFrame(f); else res(out);
      })();
    }), endT);
    const L = await p2.evaluate(() => CS.cam().L);
    // (the sway eases toward SWAY_ANG·W·Hs in about WOB_SWAY_T s while W decays: its amplitude follows it a little behind)
    const early = samples.filter(s => s.t < 1.2), late = samples.filter(s => s.t > settleT), mid = samples.filter(s => s.t > 0.4 && s.t < 1.6);
    const qMax = Math.max(...early.map(s => Math.abs(s.q))), wMax = Math.max(...early.map(s => s.W));
    // (the amplitude eases toward SWAY_ANG·W·Hs over WOB_SWAY_T s: compared with W that long before)
    const lagW = t => { let best = samples[0]; for (const s of samples) if (Math.abs(s.t - (t - C.WOB_SWAY_T)) < Math.abs(best.t - (t - C.WOB_SWAY_T))) best = s; return best.W; };
    const track = mid.map(s => ({ q: Math.hypot(s.q, s.qv / s.wq), want: A1 * lagW(s.t) }));
    const lowR = Math.max(...samples.map(s => s.low)) - Math.min(...samples.map(s => s.low));
    const topR = Math.max(...early.map(s => s.top)) - Math.min(...early.map(s => s.top));
    const slotR = Math.max(...early.filter(s => s.key === early[0].key).map(s => s.slot)) - Math.min(...early.filter(s => s.key === early[0].key).map(s => s.slot));
    const tMax = Math.max(...track.map(r => r.q / r.want));
    check(`sway: the part over the brace line sways about SWAY_ANG·W·Hs (${A1.toFixed(2)} L × W) at its top (never more), and settles as W does`, qMax >= 0.6 * A1 * 0.9 && qMax <= A1 * wMax + 0.01 && tMax >= 0.8 && tMax <= 1.2 && late.length > 0 && late.every(s => Math.abs(s.q) < 0.02),
      `max |sway| ${qMax.toFixed(3)} L from W ${wMax.toFixed(2)}; 0.4-1.6 s: its amplitude up to ${tMax.toFixed(2)} × SWAY_ANG·W·Hs; after ${settleT.toFixed(1)} s (τ ${tau.toFixed(2)} s) ${late.length ? Math.max(...late.map(s => Math.abs(s.q))).toFixed(3) : '-'} L`);
    check('sway: the braced part under the brace line stays still; the swaying part and its slots move', lowR < 0.5 && topR > 0.15 * L && slotR > 0.15 * L,
      `under the line ${lowR.toFixed(2)} px, the top tile ${topR.toFixed(1)} px, a slot ${slotR.toFixed(1)} px (L ${L.toFixed(0)} px)`);
    // the ghost stays honest on a swaying target: taps at the live centre of a top slot (the segment kept swaying)
    const res = [];
    // (a layer three wide over the brace line: λ stays about 1, so these drops add next to no sway of their own)
    for (const key of ['sq:-3,7,1', 'sq:1,7,1', 'sq:-1,8,1', 'sq:-3,8,1', 'sq:1,8,1']) {
      await ready(p2);
      await p2.evaluate(() => { WOB.W = 0.8; });
      await p2.waitForTimeout(150);
      const r = await tapSlot(p2, key, { before: () => { WOB.W = Math.min(WOB.W, 0.8); } });
      res.push({ key, ghost: r.rel.ghostKey, land: r.land && r.land.key, grade: r.rel.grade, q: await p2.evaluate(() => CS.state().sway) });
      await p2.evaluate(() => { WOB.W = Math.min(WOB.W, 0.5); });
    }
    const honest = res.filter(r => r.ghost === r.land && r.land), perf = res.filter(r => r.grade === 'perfect');
    check('sway: the ghost stays honest on the swaying part (landed = ghost key) and a tap at a spot\'s rest centre is PERFECT', res.length >= 4 && honest.length === res.length && perf.length === res.length,
      res.map(r => `${r.key}->${r.land} ${r.grade}`).join(', '));
    // a hand held still over the middle of a swaying spot's swing: the ghost stays on that spot as it swings, gold, and
    // the drop is PERFECT (the spot is chosen and graded where it is at rest)
    const still = [];
    for (const key of ['sq:-1,9,1', 'sq:-3,9,1', 'sq:1,9,1']) {
      await ready(p2);
      const x = await p2.evaluate(key => { HAND.piece = { shape: 'sq', color: 'blue', variant: 0 }; WOB.W = 0.85; computeGhost(); const q = CS.slots(true).find(o => o.key === key); return q ? q.rsx : null; }, key);
      await p2.mouse.move(x, TAP_Y);
      const seen = await p2.evaluate(key => new Promise(res => {
        const t0 = S.gt, out = { keys: new Set(), gold: 0, n: 0, off: 0 };
        (function f() {
          const g = CS.ghost(), q = CS.slots(true).find(o => o.key === key);
          out.keys.add(g ? g.key : 'MISS'); out.n++; if (g && g.color === 'gold') out.gold++;
          if (q) out.off = Math.max(out.off, Math.abs(q.sx - q.rsx));
          if (S.gt - t0 < 0.6) requestAnimationFrame(f); else res({ keys: [...out.keys], gold: out.gold, n: out.n, off: out.off });
        })();
      }), key);
      const id0 = await p2.evaluate(() => CS.lastRelease ? CS.lastRelease.id : 0);
      await p2.mouse.down(); await p2.mouse.up();
      await until(p2, id => CS.lastRelease && CS.lastRelease.id > id, id0, 5000).catch(() => {});
      const rel = await p2.evaluate(() => CS.lastRelease);
      still.push({ key, grade: rel && rel.grade, ghost: rel && rel.ghostKey, keys: seen.keys, gold: seen.gold === seen.n, off: seen.off });
      await p2.waitForTimeout(400);
      await p2.evaluate(() => { WOB.W = 0; });
    }
    const pw = await p2.evaluate(() => perfectWin()), swung = still.filter(r => r.off > pw * L);
    check('sway: a hand held still over the middle of a swaying spot\'s swing keeps the ghost on that spot, gold, and drops PERFECT',
      still.length === 3 && still.every(r => r.grade === 'perfect' && r.ghost === r.key && r.keys.length === 1 && r.keys[0] === r.key && r.gold) && swung.length >= 1,
      still.map(r => `${r.key}: ${r.grade}, the spot swinging up to ${r.off.toFixed(1)} px off its rest place, ghost on ${r.keys.join('/')} ${r.gold ? 'gold' : 'not always gold'}`).join('; ') + ` (PERFECT window ${(pw * L).toFixed(1)} px)`);
    await close(g2);
    return;
  }
  await close(g);
}

// ---------------------------------------------------------------- weight: the plumb weight and the ghost weight
const MASS = { sq: 1, marble: 1, tri: 0.45, crown: 0.45, cube: 3 };
async function weightCheck(browser) {
  const g = await open(browser, { seed: 13, level: 8, ts: 1 });
  const { page } = g;
  await page.evaluate(() => { HZ.every = 0; HZ.kind = ''; LEVELS[8].fuse = 1e9; });
  // a two-wide 5 L column: the weight is the centre of the tiles as drawn (the sway turning the part), and the car
  await fixture(page, COL2(5));
  const sm = await page.evaluate(() => new Promise(res => {
    WOB.W = 0.7;
    const out = [], t0 = S.gt;
    (function f() {
      const st = CS.state(), c = CS.cam(), L = c.L;
      if (st.theta === 0 && TW.squash === 0) {
        // (each tile at its drawn centre, the car at its own: their mass-weighted mean, world x from the base's centre)
        let M = TW.M - S.B.tiles.reduce((a, t) => a + t.mass, 0), Sx = 0;
        for (const t of CS.tiles()) { const m = { sq: 1, marble: 1, tri: 0.45, crown: 0.45, cube: 3 }[t.shape] || 1; M += m; Sx += m * ((t.sx - c.originX) / L - TW.ox); }
        out.push({ wx: st.weight.x, drawn: Sx / M, q: st.sway, box: CS.weightBox() });
      }
      if (st.t - t0 < 1.5) requestAnimationFrame(f); else res(out);
    })();
  }));
  const err = Math.max(...sm.map(s => Math.abs(s.wx - s.drawn))), qs = sm.map(s => s.q), boxes = sm.filter(s => s.box).map(s => (s.box.x0 + s.box.x1) / 2);
  check('weight: the plumb weight hangs at the centre of weight with the sway in it (the drawn tiles\' centre, to 0.002 L), and it swings with the sway',
    sm.length >= 20 && err < 0.002 && Math.max(...qs) - Math.min(...qs) > 0.3 && boxes.length === sm.length && Math.max(...boxes) - Math.min(...boxes) > 3,
    `${sm.length} frames, worst ${err.toFixed(4)} L; sway ${Math.min(...qs).toFixed(2)}..${Math.max(...qs).toFixed(2)} L; the bob drawn ${boxes.length}/${sm.length} frames, its x over ${(Math.max(...boxes) - Math.min(...boxes)).toFixed(1)} px`);
  // the ghost weight: where it settles after the aimed drop (the tiles in the air counted)
  await page.evaluate(() => { WOB.W = 0; WOB.q = 0; WOB.qv = 0; });
  const gw = [];
  // (the top, and the spot beside each side: one a column, the highest of a bare side's, 16.3)
  for (const key of ['sq:-2,5,0', 'sq:2,4,0', 'sq:-4,4,0']) {
    const x = await page.evaluate(key => { HAND.piece = { shape: 'sq', color: 'blue', variant: 0 }; computeGhost(); const s = CS.slots().find(q => q.key === key); return s ? s.sx : null; }, key);
    if (x === null) continue;
    await page.mouse.move(x, TAP_Y); await frame(page); await frame(page);
    gw.push(await page.evaluate(key => { const st = CS.state(), gh = CS.ghost(), s = CS.slots().find(q => q.key === key), c = st.comAir; return { key, ghost: gh && gh.key, w: gh && gh.weight, want: (c.M * c.x + 1 * s.lx) / (c.M + 1), tippy: s.tippy, shown: st.weight.ghost }; }, key));
  }
  check('weight: the ghost weight shows where the weight settles after the aimed drop (the centre with the tile on it), and says tip as the look-ahead does',
    gw.length === 3 && gw.every(r => r.ghost === r.key && r.w && Math.abs(r.w.settle - r.want) < 1e-9 && r.w.tip === r.tippy && r.shown && r.w.lo <= r.w.settle + 1e-9 && r.w.hi >= r.w.settle - 1e-9),
    gw.map(r => `${r.key}: settle ${r.w ? r.w.settle.toFixed(3) : '-'} (want ${r.want.toFixed(3)}), swing ${r.w ? r.w.lo.toFixed(2) + '..' + r.w.hi.toFixed(2) : '-'}, ${r.w && r.w.tip ? 'TIP' : 'safe'}`).join('; '));
  await close(g);
  // tip honesty: on a one-car spire, a safe drop stands and a drop the ghost weight calls a tip goes over
  const res = [];
  for (const seed of [31, 32]) {
    const g2 = await open(browser, { seed, level: 8, ts: 1 });
    const p2 = g2.page;
    await p2.evaluate(() => { HZ.every = 0; HZ.kind = ''; LEVELS[8].fuse = 1e9; });
    await fixture(p2, COL2(2).concat(['sq:2,1,0', 'sq:2,0,0'].slice(0, 1)));
    for (let k = 0; k < 6; k++) {
      await ready(p2);
      const pick = await p2.evaluate(want => { HAND.piece = { shape: 'sq', color: 'blue', variant: 0 }; computeGhost(); const sl = CS.slots().filter(q => q.tippy === want).sort((a, b) => b.lx - a.lx); return sl[0] ? sl[0].key : null; }, k % 2 === 1);
      if (!pick) continue;
      const r = await tapSlot(p2, pick);
      const t0 = r.rel.t;
      await until(p2, t => CS.state().phase !== 'play' || (CS.state().t > t + 3), t0, 8000).catch(() => {});
      const c = await p2.evaluate(t => CS.events.find(e => e.type === 'crash' && e.t > t) || null, t0);
      res.push({ seed, key: pick, tip: r.rel.tippy, crash: !!c, past: c ? c.past : null });
      if (c) break;
    }
    await close(g2);
  }
  const lies = res.filter(r => r.tip !== r.crash);
  check('weight: a drop the ghost weight calls a tip goes over (with the weight past a wheel), a safe one stands', res.length >= 3 && res.some(r => r.tip) && res.some(r => !r.tip) && lies.length === 0 && res.every(r => !r.crash || r.past),
    res.map(r => `s${r.seed} ${r.key}: ${r.tip ? 'TIP' : 'safe'} -> ${r.crash ? 'crash' + (r.past ? ' (past)' : ' (NOT past)') : 'stood'}`).join('; '));
}

// ---------------------------------------------------------------- tip: one way to fall
async function tipCheck(browser) {
  // a sway alone carries the weight past a wheel: a one-car tower, a one-wide column on its left, W 1, no drops
  const g = await open(browser, { seed: 17, level: 8, ts: 1 });
  const { page } = g;
  await page.evaluate(() => { HZ.every = 0; HZ.kind = ''; LEVELS[8].fuse = 1e9; });
  await fixture(page, COL2(2).concat(['sq:-2,2,0', 'sq:-2,3,0', 'sq:-2,4,0', 'sq:-2,5,0', 'sq:-2,6,0']));
  const a0 = await page.evaluate(() => { const s = CS.state(); WOB.W = 1; return { x: s.weight.x, wheel: s.weight.wheel, t: s.t, lands: CS.events.filter(e => e.type === 'land').length }; });
  await until(page, t => CS.state().phase !== 'play' || CS.state().t > t + 4, a0.t, 10000).catch(() => {});
  const a1 = await page.evaluate(() => ({ crash: CS.events.find(e => e.type === 'crash') || null, lands: CS.events.filter(e => e.type === 'land').length }));
  check('tip: a sway alone carries the weight past a wheel and the tower goes over that way (crash with the weight past the wheel, no tile dropped)',
    !!a1.crash && a1.crash.past && a1.lands === a0.lands && Math.abs(a0.x) < a0.wheel,
    `at rest the weight at ${a0.x.toFixed(2)} (wheels ±${a0.wheel}); crash ${a1.crash ? 'weight ' + a1.crash.weight + ' / wheel ' + a1.crash.wheel + ', sway ' + a1.crash.sway : 'none'}`);
  await close(g);
  // a TRUSS cuts the sway: the notch filled on a swaying 2-wide column takes W × TRUSS_W and moves the brace line up
  const g2 = await open(browser, { seed: 18, level: 8, ts: 1 });
  const p2 = g2.page;
  await p2.evaluate(() => { HZ.every = 0; HZ.kind = ''; LEVELS[8].fuse = 1e9; });
  await fixture(p2, COL2(4).concat(['up:-2,4,0', 'up:0,4,0']));
  const C = await WCFG(p2);
  const seg = await p2.evaluate(() => ({ Hu: WOB.Hu, lam: WOB.lam }));
  const r = await tapSlot(p2, 'dn:-1,4,0', { shape: 'tri', before: () => { WOB.W = 0.5; window.__tset = S.gt; } });
  const tr = await p2.evaluate(() => CS.events.find(e => e.type === 'truss') || null), tset = await p2.evaluate(() => window.__tset);
  // (W settles from 0.5 while the triangle falls, at the τ of the part it lands on, then the TRUSS cuts it)
  const want = r.land ? decayOf(C, 0.5, r.land.t - tset, tauOf(C, seg.Hu, seg.lam)) * C.TRUSS_W : 0;
  check('tip: a TRUSS cuts the sway × TRUSS_W and raises the brace line', !!tr && !!r.land && Math.abs(r.land.W - want) < 0.01 && tr.yb > 4,
    `land W ${r.land ? r.land.W : '-'} (want ${want.toFixed(4)}: 0.5 settled over the fall, × ${C.TRUSS_W}), brace line ${tr ? tr.yb.toFixed(3) : '-'}`);
  await close(g2);
  // a fast stacker on level 8: it falls, and only ever by the weight going past a wheel; nothing comes off on its own
  const crashes = [], words = new Set();
  let snaps = 0;
  for (const seed of [21, 22, 23]) {
    const g3 = await open(browser, { seed, level: 8, ts: 2 });
    const p3 = g3.page;
    await p3.evaluate(() => { HZ.every = 0; HZ.kind = ''; S.G = 99; window.__words = new Set(); (function f() { for (const w of CS.words()) { __words.add(w.text); if (w.sub) __words.add(w.sub); } requestAnimationFrame(f); })(); });
    for (let k = 0; k < 60; k++) {
      await until(p3, () => { const s = CS.state(); return (s.phase === 'play' && s.handReady && !s.locked) || s.phase === 'over'; }, null, 20000).catch(() => {});
      const p = await p3.evaluate(() => { CS.setClock(60); const sl = CS.slots(true); sl.sort((a, b) => b.y - a.y || Math.abs(a.x) - Math.abs(b.x)); return sl[0] || null; });
      if (!p) { await p3.keyboard.press('Shift'); await frame(p3); continue; }
      await p3.mouse.move(p.sx, TAP_Y); await p3.mouse.down(); await p3.mouse.up();
      await p3.waitForTimeout(20);
      if ((await p3.evaluate(() => CS.events.filter(e => e.type === 'crash').length)) >= 3) break;
    }
    await p3.waitForTimeout(300);
    const ev = await p3.evaluate(() => ({ crash: CS.events.filter(e => e.type === 'crash'), snap: CS.events.filter(e => e.type === 'snap').length, words: [...__words] }));
    crashes.push(...ev.crash.map(e => Object.assign({ seed }, e))); snaps += ev.snap; ev.words.forEach(w => words.add(w));
    await close(g3);
  }
  const bad = crashes.filter(e => !e.past), stale = [...words].filter(w => /SNAP|TOO THIN/.test(w));
  check('tip: a fast stacker on level 8 falls, every time with the weight past a wheel; no tile comes off on its own (no SNAP), and no word says otherwise',
    crashes.length >= 3 && bad.length === 0 && snaps === 0 && stale.length === 0,
    `${crashes.length} crashes (${crashes.map(e => e.top.toFixed(1) + ' L, weight ' + e.weight.toFixed(2)).join('; ')}), ${bad.length} not past, ${snaps} snaps, stale words ${stale.join(' ') || 'none'}`);
}

// ---------------------------------------------------------------- the crown gamble (level 1: two cars, goal 4 L)
const ROWS4 = n => { const k = []; for (let a = 0; a < n; a++) for (const i of [-4, -2, 0, 2]) k.push('sq:' + i + ',' + a + ',0'); return k; };
async function gambleCheck(browser) {
  // the first crown ever: no nohint here (the lesson goes after the first clack), fresh prefs
  const g = await open(browser, { seed: 9, level: 1, ts: 1, nohint: 0 });
  const { page } = g;
  const yb = 4 + H3;
  // 4 rows, a brace over the middle two (y_b 4.87, over the 4 L ribbon), a column of two on it
  await fixture(page, ROWS4(4).concat(['up:-2,4,0', 'up:0,4,0', 'dn:-1,4,0', 'sq:-1,4,1', 'sq:-1,5,1']), yb);
  // a real drop tears the ribbon (the build already stands past it): the crown drops into the hand
  await tapSlot(page, 'sq:2,4,0');
  await until(page, () => CS.state().crownInHand && CS.state().handReady, null, 5000).catch(() => {});
  await frame(page); await frame(page);
  const a = await page.evaluate(() => ({ st: CS.state(), ui: CS.ui(), ev: CS.events.filter(e => e.type === 'crownhint').length, prefs: JSON.parse(localStorage.getItem('clackstack.prefs') || '{}') }));
  const chip = a.ui.goHigher, hold = a.ui.hold, next = a.ui.next, inView = chip && chip.x >= 0 && chip.y >= 0 && chip.x + chip.w <= VIEW.width && chip.y + chip.h <= VIEW.height;
  const over = (r) => chip && r && chip.x < r.x + r.w && r.x < chip.x + chip.w && chip.y < r.y + r.h && r.y < chip.y + chip.h;
  const near = chip && Math.max(hold.x - (chip.x + chip.w), chip.x - (hold.x + hold.w), 0) < 80 && Math.max(hold.y - (chip.y + chip.h), chip.y - (hold.y + hold.h), 0) < 40;
  const k0 = Math.floor(a.st.top - a.st.goal + 1e-9);
  check('gamble: at the ribbon the crown is in the hand and the GO HIGHER chip shows beside the HOLD box (in view, over neither NEXT nor HOLD) with the crown\'s value',
    a.st.crownInHand && a.st.goHigher && inView && near && !over(next) && !over(hold) && a.st.crownValue === Math.round(100 * a.st.level * (1 + 0.5 * k0)),
    `chip ${chip ? [chip.x, chip.y, chip.w, chip.h].map(Math.round).join(',') : '-'}, HOLD ${[hold.x, hold.y, hold.w, hold.h].map(Math.round).join(',')}, NEXT ${[next.x, next.y, next.w, next.h].map(Math.round).join(',')}; value ${a.st.crownValue} (top ${a.st.top.toFixed(2)}, k ${k0})`);
  check('gamble: the first crown ever shows the one-line hint, once, and the prefs remember it', a.ev === 1 && !!a.ui.crownHint && a.prefs.seenCrownHint === true,
    `crownhint events ${a.ev}, hint ${a.ui.crownHint ? 'drawn' : 'not drawn'}, prefs ${JSON.stringify(a.prefs)}`);
  // a mouse click on the chip banks the crown: OVERTIME
  await page.mouse.move(chip.x + chip.w / 2, chip.y + chip.h / 2); await page.mouse.down(); await page.mouse.up();
  await frame(page);
  const b = await page.evaluate(() => ({ st: CS.state(), ev: CS.events.filter(e => e.type === 'overtime').length, ui: CS.ui() }));
  check('gamble: a click on the chip banks the crown and starts OVERTIME (the chip gives way to the multiplier badge)', b.st.overtime && b.st.held === 'crown' && !b.st.crownInHand && b.ev === 1 && !b.ui.goHigher && b.st.crownChip === 'ot',
    `overtime ${b.st.overtime}, held ${b.st.held}, piece ${b.st.piece}, badge ${b.st.crownChip}`);
  // build up the column: the live multiplier follows the top
  const mults = [];
  for (const key of ['sq:-1,6,1', 'sq:-1,7,1']) {
    await tapSlot(page, key, { before: () => { WOB.W = 0; } });
    await page.waitForTimeout(60);
    const s = await page.evaluate(() => CS.state());
    mults.push({ top: s.top, mult: s.crownMult, want: 1 + 0.5 * Math.floor(s.top - s.goal + 1e-9) });
  }
  check('gamble: the HOLD box shows the live multiplier ×(1 + 0.5 per whole L of the top over the ribbon)', mults.every(m => Math.abs(m.mult - m.want) < 1e-9) && mults[mults.length - 1].mult >= 2,
    mults.map(m => `top ${m.top.toFixed(2)}: ×${m.mult}`).join(', '));
  // HOLD takes the crown back; placing it pays 100 × level × the multiplier, then the SMASH
  await ready(page);
  await page.keyboard.press('Shift');
  await frame(page);
  const kNow = await page.evaluate(() => ({ crown: CS.state().crownInHand, mult: CS.state().crownMult, value: CS.state().crownValue, chip: CS.state().crownChip }));
  const key = await page.evaluate(() => { const sl = CS.slots().sort((a, b) => b.y - a.y); return sl[0] ? sl[0].key : null; });
  if (key) await tapSlot(page, key);
  await until(page, () => CS.events.some(e => e.type === 'crown'), null, 4000).catch(() => {});
  const cr = await page.evaluate(() => CS.events.find(e => e.type === 'crown') || null);
  check('gamble: HOLD takes the crown back (its badge leaves the HOLD box); placing it pays 100 × level × the multiplier shown', kNow.crown && kNow.chip === '' && !!cr && cr.pts === kNow.value && Math.abs(1 + 0.5 * cr.k - kNow.mult) < 1e-9,
    `in hand ${kNow.crown}, badge '${kNow.chip}', ×${kNow.mult} = ${kNow.value}; crown ${cr ? cr.pts + ' (k ' + cr.k + ')' : '-'}`);
  // level 2: the next crown has no hint
  await until(page, () => CS.state().phase === 'play' && CS.state().level === 2 && CS.state().handReady && !CS.state().locked, null, 8000);
  await fixture(page, ROWS4(5));
  await tapSlot(page, (await page.evaluate(() => CS.slots().filter(s => s.supported).sort((a, b) => a.y - b.y)[0].key)));
  await until(page, () => CS.state().crownInHand, null, 5000).catch(() => {});
  const d = await page.evaluate(() => ({ ev: CS.events.filter(e => e.type === 'crownhint').length, st: CS.state() }));
  check('gamble: the next crown shows no hint (the chip only)', d.ev === 1 && d.st.goHigher, `crownhint events ${d.ev}, chip ${d.st.goHigher}`);
  // a crash in OVERTIME loses the crown and ties the ribbon up again
  await close(g);
  const g2 = await open(browser, { seed: 10, level: 1, ts: 1 });
  const p2 = g2.page;
  await fixture(p2, ROWS4(2).concat(['up:-2,2,0', 'up:0,2,0', 'dn:-1,2,0', 'sq:-1,2,1']), 2 + H3);
  await tapSlot(p2, 'sq:-1,3,1', { before: () => { WOB.W = 0; } });                 // top 4.87: the ribbon tears
  await until(p2, () => CS.state().crownInHand && CS.state().handReady, null, 5000).catch(() => {});
  await p2.evaluate(() => new Promise(r => setTimeout(r, 450)));                      // (past CROWN_GRACE)
  await p2.keyboard.press('Shift');                                                   // HOLD banks it too
  const ot = await p2.evaluate(() => ({ ot: CS.state().overtime, chip: CS.state().crownChip }));
  // (the crash: the tower shoved past its tipping angle over the right wheel, as a big bump would)
  await p2.evaluate(() => { TW.theta = Math.max(0, TW.alphaSide) + 0.05; TW.omega = 0.7; });
  await until(p2, () => CS.events.some(e => e.type === 'crash'), null, 5000).catch(() => {});
  await p2.waitForTimeout(150);
  const e = await p2.evaluate(() => ({ st: CS.state(), cr: CS.events.filter(x => x.type === 'crash'), w: CS.words().find(w => w.sub === 'NO CROWN!') || null }));
  check('gamble: HOLD (Shift) banks the crown too; a crash in OVERTIME loses the crown, ties the ribbon up and says NO CROWN!',
    ot.ot && ot.chip === 'ot' && e.cr.length === 1 && e.cr[0].past && e.st.held === null && !e.st.overtime && !e.st.goalTorn && !!e.w,
    `overtime ${ot.ot} (badge ${ot.chip}); crashes ${e.cr.length}${e.cr[0] ? ' (weight ' + e.cr[0].weight + ')' : ''}, held ${e.st.held}, goalTorn ${e.st.goalTorn}; "${e.w ? e.w.text + ' / ' + e.w.sub : '-'}"`);
  await close(g2);
  // a touch tap on the chip banks the crown
  const g3 = await gamePage(browser, VIEW, { seed: 11, level: 1, ts: 1, autostart: 1, mute: 1, nohint: 1 }, { realClock: true, touch: true });
  const p3 = g3.page;
  await until(p3, () => window.CS && CS.state().phase === 'play' && CS.state().handReady, null, 15000);
  await fixture(p3, ROWS4(3).concat(['sq:-2,3,0', 'sq:0,3,0', 'sq:-4,3,0']));
  const s3 = await p3.evaluate(() => { HAND.piece = { shape: 'sq', color: 'blue', variant: 0 }; return CS.slots().find(s => s.key === 'sq:2,3,0'); });
  await p3.touchscreen.tap(s3.sx, TAP_Y);
  await until(p3, () => CS.state().crownInHand && CS.state().handReady, null, 5000).catch(() => {});
  await frame(p3); await frame(p3);
  await until(p3, () => !CS.state().crownGrace, null, 3000).catch(() => {});
  const ch = await p3.evaluate(() => CS.ui().goHigher || null);
  if (ch) await p3.touchscreen.tap(ch.x + ch.w / 2, ch.y + ch.h / 2);
  await frame(p3);
  const t3 = await p3.evaluate(() => ({ ot: CS.state().overtime, held: CS.state().held, miss: CS.events.filter(e => e.type === 'miss').length }));
  check('gamble: a touch tap on the chip banks the crown (no drop)', !!ch && t3.ot && t3.held === 'crown' && t3.miss === 0, JSON.stringify(t3));
  errorsAll.push(...g3.errors); await g3.context.close();
}
// ---------------------------------------------------------------- crown: the choice is the player's
async function crownCheck(browser) {
  // a tapper at a steady 0.3 s (a tap already on its way when the ribbon tears): the crown is never placed in the
  // CROWN_GRACE after it arrives
  const g = await open(browser, { seed: 15, level: 1, ts: 1 });
  const { page } = g;
  const grace = await page.evaluate(() => CFG.CROWN_GRACE);
  await fixture(page, ROWS4(3));
  const r = await page.evaluate(() => new Promise(res => {
    let next = S.rt;
    const out = { taps: 0 };
    window.__rels = [];
    const dr = doRelease; doRelease = function (src) { const pc = HAND.piece ? HAND.piece.shape : null, ok = dr(src); if (ok) __rels.push({ t: S.gt, piece: pc, src }); return ok; };
    (function f() {
      const st = CS.state();
      if (CS.events.some(e => e.type === 'crown') || st.t > 30) {
        const goal = CS.events.find(e => e.type === 'goal');
        const rel = (window.__rels || []).find(x => x.piece === 'crown');
        return res(Object.assign(out, { goal: goal ? goal.t : null, crownRel: rel ? rel.t : null, crownAt: st.crownAt }));
      }
      if (S.rt >= next) {
        next = S.rt + 0.3;
        // the hand over the build's middle top slot, a tap
        const sl = CS.slots().filter(s => s.supported).sort((a, b) => b.y - a.y)[0];
        if (sl) { onPointerMove({ pointerType: 'mouse', clientX: sl.sx, clientY: 464 }); onPointerDown({ pointerType: 'mouse', clientX: sl.sx, clientY: 464, button: 0, cancelable: false, preventDefault() {} }); onPointerUp({ pointerType: 'mouse', clientX: sl.sx, clientY: 464, button: 0, cancelable: false, preventDefault() {} }); out.taps++; }
      }
      requestAnimationFrame(f);
    })();
  }));
  const giveAt = r.crownAt;
  check(`crown: taps already on their way when the crown arrives never place it in its first ${grace} s (a 0.3 s tapper)`,
    r.goal !== null && r.crownRel !== null && r.crownRel - giveAt >= grace - 1e-9,
    `goal at ${r.goal !== null ? r.goal.toFixed(2) : '-'}, crown in the hand at ${giveAt.toFixed(2)}, placed at ${r.crownRel !== null ? r.crownRel.toFixed(2) : '-'} (+${r.crownRel !== null ? (r.crownRel - giveAt).toFixed(2) : '-'} s) after ${r.taps} taps`);
  await close(g);
  // hands off with the crown in the hand and the chip up: the fuse never drops it
  const g2 = await open(browser, { seed: 16, level: 1, ts: 1 });
  const p2 = g2.page;
  await fixture(p2, ROWS4(3).concat(['sq:-2,3,0', 'sq:0,3,0', 'sq:-4,3,0']));
  await tapSlot(p2, 'sq:2,3,0');
  await until(p2, () => CS.state().crownInHand && CS.state().handReady, null, 5000).catch(() => {});
  const t0 = await p2.evaluate(() => CS.state().t);
  await p2.mouse.move(VIEW.width - 4, 30);           // the hand pulled up into the HUD strip (where the chip is)
  await until(p2, t => CS.state().t >= t + 3, t0, 8000);
  const h = await p2.evaluate(() => ({ st: CS.state(), miss: CS.events.filter(e => e.type === 'miss').length, fuse: LEVELS[1].fuse }));
  check('crown: hands off with the crown in the hand and the chip up: still there after 3 s (the fuse never drops it), no OOPS',
    h.st.crownInHand && h.st.goHigher && h.miss === 0, `crown ${h.st.crownInHand}, chip ${h.st.goHigher}, misses ${h.miss} (fuse ${h.fuse} s)`);
  await close(g2);
}
async function bigCheck(browser) {
  const g = await open(browser, { seed: 12, level: 1, ts: 1, big: 1 });
  const { page } = g;
  await fixture(page, ROWS4(3).concat(['sq:-2,3,0', 'sq:0,3,0', 'sq:-4,3,0']));
  await tapSlot(page, 'sq:2,3,0');
  await until(page, () => CS.state().crownInHand && CS.state().handReady, null, 5000).catch(() => {});
  await frame(page); await frame(page);
  const a = await page.evaluate(() => ({ st: CS.state(), ui: CS.ui(), hint: CS.events.filter(e => e.type === 'crownhint').length }));
  check('big: BIG MAGNETS has no GO HIGHER chip and no hint (the crown is simply in the hand)', a.st.crownInHand && !a.st.goHigher && !a.ui.goHigher && a.hint === 0, `crown ${a.st.crownInHand}, chip ${a.st.goHigher}`);
  const C = await WCFG(page);
  const dw = await page.evaluate(() => [wobDelta('perfect', 'sq', 2.5), wobDelta('clack', 'cube', 3), wobDelta('great', 'sq', 9)]);
  const wantB = [dWOf(C, 'perfect', 'sq', 2.5, true), dWOf(C, 'clack', 'cube', 3, true), dWOf(C, 'great', 'sq', 9, true)];
  check(`big: ΔW × ${C.WOB_BIG}`, dw.every((x, i) => Math.abs(x - wantB[i]) < 1e-9) && Math.abs(wantB[2] - capOf(C, 9) * C.WOB_CAP_G.great * C.WOB_BIG) < 1e-9,
    dw.map(x => x.toFixed(4)).join(', ') + ' (want ' + wantB.map(x => x.toFixed(4)).join(', ') + ')');
  await close(g);
}

(async () => {
  const browser = await launch();
  try {
    if (want('dw')) await dwCheck(browser);
    if (want('decay') || want('fuse') || want('sway')) await decayFuseSway(browser);
    if (want('weight')) await weightCheck(browser);
    if (want('tip')) await tipCheck(browser);
    if (want('gamble')) await gambleCheck(browser);
    if (want('crown')) await crownCheck(browser);
    if (want('big')) await bigCheck(browser);
  } finally { await browser.close(); }
  check('no page or console errors', errorsAll.length === 0, errorsAll.slice(0, 3).join(' | '));
  console.log(failures ? `WOBBLE (sway): ${failures} check(s) failed` : 'WOBBLE (sway): all checks passed');
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
