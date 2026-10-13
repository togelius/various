#!/usr/bin/env node
'use strict';
// DESIGN.md 15.3 and 15.6: the wobble, the SNAP and the crown gamble, driven through real mouse / touch / keyboard
// input. The builds are fixtures (tiles placed with the lattice functions, as flow.cjs's camera checks do; a brace line
// set where a TRUSS would put it) and W is set where a check needs a wobble to start from; every drop that matters is
// a real tap at the slot's live position.
//   node clack-stack/tools/wobble.cjs                 (everything)
//   node clack-stack/tools/wobble.cjs --only=snap,gamble   (dw, decay, fuse, sway, snap, full, gamble, big)
// Checks:
//   dw      every landing in the unbraced segment adds ΔW = a[grade]·max(0, λ − 1)²·(1.5 for the cube) to W decayed by
//           e^(−Δt/1 s) since the landing before (a TRUSS takes it × 0.3, a SNAP to 0): checked on every landing of a
//           balance-greedy player on level 8 (hazards off); λ, Hu, w and y_b in CS.state() agree with the land events
//   decay   left alone, W falls as e^(−t/1 s) (within 2%)
//   fuse    while W > 0.5 the fuse waits (state().fuseWait), then runs its full 1.4 s: the fuse drop comes at the time
//           W reaches 0.5 plus what was left of the fuse (within 2 steps); the fuse ring turns amber
//   sway    the segment sways up to about 0.25 L × W at its top and settles; the braced part under the brace line stays
//           still; the slots follow the sway (their sx move) and the ghost stays honest: taps at a swaying slot's live
//           centre land on the ghost's slot (lastRelease.ghostKey = the landed key), PERFECT; the top's lateral speed
//           (flex + rock + sway) stays <= 2.8 L/s; the joints glow (the amber/red pass draws: pixels change)
//   snap    W reaching 1 on a landing in the segment over a TRUSS: 'snap' (full false); every tile on or above the brace
//           line (and nothing under it) becomes debris; no crash; the combo resets; W and the sway go to 0; "SNAP!"
//           pops; play goes on (slots, a tile in the hand); Sfx.snap
//   full    with no TRUSS it is a full crash: 'snap' (full) and 'crash' (snap: true) in the same step, the word SNAP!
//   gamble  (15.6) at the ribbon the crown drops into the hand and the GO HIGHER chip shows on the HOLD box (inside the
//           view, over the box) with the crown's value; the first crown ever shows the one-line hint once ('crownhint',
//           the prefs remember it; the next crown has none); a mouse click on the chip banks the crown and starts
//           OVERTIME; the HOLD box's badge shows the live multiplier ×(1 + 0.5·⌊top − G⌋) as the build grows; HOLD
//           (Shift) takes the crown back and placing it pays 100 × level × that; a touch tap on the chip banks it too;
//           a SNAP in OVERTIME that leaves the top at or above the ribbon keeps the crown (its multiplier falls with
//           the top), one that takes the top under the ribbon loses it and ties the ribbon up again
//   big     BIG MAGNETS: no chip (the crown is simply in the hand), ΔW × 0.4
// Exits non-zero on any failure, page error or console error.
const { launch, gamePage, until } = require('./lib.cjs');

const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = n => !ONLY.length || ONLY.includes(n);
const VIEW = { width: 390, height: 844 };
const TAP_Y = Math.round(VIEW.height * 0.55);
const A = { perfect: 0.09, great: 0.14, clack: 0.20 };
let failures = 0;
const errorsAll = [];
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
}

async function open(browser, params, opts) {
  const g = await gamePage(browser, (opts && opts.view) || VIEW, Object.assign({ mute: 1, nohint: 1, autostart: 1 }, params), Object.assign({ realClock: true }, opts || {}));
  await until(g.page, () => window.CS && CS.state().phase === 'play' && CS.state().handReady, null, 15000);
  // (the Sfx calls, for the SNAP's sound)
  await g.page.evaluate(() => { window.__sfx = []; for (const k of ['snap', 'crash', 'lock']) { const f = Sfx[k]; Sfx[k] = function () { __sfx.push({ k, t: S.gt }); return f.apply(this, arguments); }; } });
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
// a real tap at slot `key`'s live centre (checking the ghost is that slot; a shown ghost's hysteresis cleared if not);
// waits for its landing; returns { rel, land }
async function tapSlot(page, key, opts) {
  opts = opts || {};
  await ready(page);
  // (the piece the slot is for: a square for a square slot (fixture), unless the crown is in the hand)
  const shape = opts.shape || (key.startsWith('sq') ? 'sq' : key.startsWith('cube') ? 'cube' : 'tri');
  await page.evaluate(sh => { if (!HAND.piece || (HAND.piece.shape !== 'crown' && HAND.piece.shape !== sh && !(sh === 'sq' && HAND.piece.shape === 'marble'))) { HAND.piece = { shape: sh, color: 'blue', variant: 0 }; computeGhost(); } }, shape);
  let x = null;
  for (let k = 0; k < 3; k++) {
    const s = await page.evaluate(key => { const q = CS.slots().find(o => o.key === key); return q ? q.sx : null; }, key);
    if (s === null) throw new Error('tap: no slot ' + key + ' (' + (await page.evaluate(() => CS.slots().map(o => o.key).join(' '))) + ')');
    x = s;
    await page.mouse.move(x, TAP_Y);
    await frame(page);
    const g = await page.evaluate(key => { const gh = CS.ghost(), q = CS.slots().find(o => o.key === key); return { ok: !!gh && gh.key === key, sx: q ? q.sx : null }; }, key);
    if (g.ok) { x = g.sx; break; }
    await page.mouse.move(2, TAP_Y); await frame(page);
  }
  if (opts.before) await page.evaluate(opts.before);
  const id0 = await page.evaluate(key => { const q = CS.slots().find(o => o.key === key); window.__tapX = q ? q.sx : null; return CS.lastRelease ? CS.lastRelease.id : 0; }, key);
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

// ---------------------------------------------------------------- dw: ΔW and its decay on every landing
async function dwCheck(browser) {
  const rows = [], bad = [], st0 = [];
  for (const seed of [1, 2, 3]) {
    const g = await open(browser, { seed, level: 8, ts: 2 });
    const { page } = g;
    await page.evaluate(() => { HZ.every = 0; HZ.kind = ''; });
    // a balance-greedy player that waits for W < 0.4 (so it builds tall enough for λ to matter)
    for (let k = 0; k < 45; k++) {
      await until(page, () => { const s = CS.state(); return (s.phase === 'play' && s.handReady && !s.locked && s.W < 0.4) || s.phase === 'over'; }, null, 20000).catch(() => {});
      const st = await page.evaluate(() => CS.state());
      if (st.phase !== 'play') break;
      // the state's measure agrees with the last landing's
      const last = await page.evaluate(() => { const l = CS.events.filter(e => e.type === 'land').slice(-1)[0] || null; return l && !CS.events.some(e => (e.type === 'truss' || e.type === 'snap' || e.type === 'crash') && e.t >= l.t) ? l : null; });
      if (last && st.inAir === 0) st0.push({ lam: st.lam, ev: last.lam, yb: st.yb, evyb: last.yb, Hu: st.Hu, w: st.w });
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
    const ev = await page.evaluate(() => CS.events.filter(e => /^(land|truss|snap|crash|start)$/.test(e.type)));
    const trussAt = new Set(ev.filter(e => e.type === 'truss').map(e => e.key + '@' + e.t));
    let prev = null;
    for (const e of ev) {
      if (e.type === 'start' || e.type === 'crash' || e.type === 'snap') { prev = { t: e.t, W: 0 }; continue; }
      if (e.type === 'truss') { if (prev) prev.W *= 0.3; continue; }
      if (prev) {
        const dec = prev.W * Math.exp(-(e.t - prev.t)), want = Math.min(1, dec + e.dW);
        // (the landing that closes a notch braces the tower: no ΔW, the TRUSS takes W × 0.3 after it)
        const inSeg = minY(e.key) >= e.yb - 1e-6 && !trussAt.has(e.key + '@' + e.t);
        const dWwant = inSeg ? A[e.grade] * Math.max(0, e.lam - 1) ** 2 * (e.shape === 'cube' ? 1.5 : 1) : 0;
        rows.push({ seed, e, want, dWwant });
        if (Math.abs(e.W - want) > 2e-3 + 1e-3 * want || Math.abs(e.dW - dWwant) > 1e-3 + 2e-3 * dWwant) bad.push(`s${seed} t=${e.t} ${e.key} ${e.grade}: W ${e.W} (want ${want.toFixed(4)}), dW ${e.dW} (want ${dWwant.toFixed(4)} at λ ${e.lam})`);
      }
      prev = { t: e.t, W: e.W };
    }
    await close(g);
  }
  const pos = rows.filter(r => r.e.dW > 0).length, grades = new Set(rows.filter(r => r.e.dW > 0).map(r => r.e.grade));
  check('dw: every landing adds ΔW = a[grade]·max(0, λ − 1)²(·1.5 cube) to W decayed e^(−Δt) (× 0.3 at a TRUSS, 0 after a SNAP)', bad.length === 0 && pos >= 20,
    `${rows.length} landings, ${pos} with ΔW > 0 (grades ${[...grades].join(', ')}), max W ${Math.max(...rows.map(r => r.e.W)).toFixed(3)}` + (bad.length ? '; BAD: ' + bad.slice(0, 4).join('; ') : ''));
  const mis = st0.filter(s => Math.abs(s.lam - s.ev) > 2e-3 || Math.abs(s.yb - s.evyb) > 1e-3 || Math.abs(s.lam - s.Hu / s.w) > 1e-9 || s.w < 1 - 1e-9);
  check('dw: CS.state() λ = Hu / w (w >= 1 L) and y_b agree with the last landing', st0.length >= 10 && mis.length === 0, `${st0.length} reads` + (mis.length ? '; ' + JSON.stringify(mis.slice(0, 2)) : ''));
}

// ---------------------------------------------------------------- decay, fuse, sway (level 8, hazards off)
const COL2 = n => { const k = []; for (let a = 0; a < n; a++) k.push('sq:-2,' + a + ',0', 'sq:0,' + a + ',0'); return k; };
async function decayFuseSway(browser) {
  const g = await open(browser, { seed: 4, level: 8, ts: 1 });
  const { page } = g;
  await page.evaluate(() => { HZ.every = 0; HZ.kind = ''; });
  // a first drop (the fuse starts once the player has dropped something), on a 2-wide 5 L column
  await fixture(page, COL2(5));
  await tapSlot(page, 'sq:-2,5,0');
  await ready(page);
  if (want('decay')) {
    const w0 = await page.evaluate(() => { WOB.W = 0.8; return { t: S.gt }; });
    await until(page, t => CS.state().t >= t + 1, w0.t, 5000);
    const r = await page.evaluate(t => ({ W: CS.state().W, dt: CS.state().t - t }), w0.t);
    const want1 = 0.8 * Math.exp(-r.dt);
    check('decay: W falls as e^(−t / 1 s)', Math.abs(r.W - want1) <= 0.02 * want1, `W ${r.W.toFixed(4)} after ${r.dt.toFixed(3)} s (want ${want1.toFixed(4)})`);
  }
  if (want('fuse')) {
    await ready(page);
    const set = await page.evaluate(() => { WOB.W = 0.95; return { t: S.gt, fuseT: HAND.fuseT, fuse: levelInfo(S.level).fuse, id: CS.lastRelease ? CS.lastRelease.id : 0 }; });
    await until(page, t => CS.state().t >= t + 0.3, set.t, 5000);
    const mid = await page.evaluate(() => ({ wait: CS.state().fuseWait, W: CS.state().W, fuseT: HAND.fuseT }));
    await until(page, id => CS.lastRelease && CS.lastRelease.id > id, set.id, 8000).catch(() => {});
    const rel = await page.evaluate(() => CS.lastRelease);
    const half = Math.log(0.95 / 0.5), want1 = set.t + half + (set.fuse - set.fuseT);
    check('fuse: waits while W > 0.5 (fuseWait), then runs its full time: the fuse drop comes when W reaches 0.5 + the fuse left',
      mid.wait && Math.abs(mid.fuseT - set.fuseT) < 1e-9 && rel && rel.src === 'fuse' && Math.abs(rel.t - want1) <= 2.5 / 120,
      `fuseWait ${mid.wait} at W ${mid.W.toFixed(2)} (fuse held at ${mid.fuseT.toFixed(3)} s); drop by ${rel && rel.src} at +${rel ? (rel.t - set.t).toFixed(3) : '-'} s (want +${(want1 - set.t).toFixed(3)})`);
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
    const samples = await p2.evaluate(() => new Promise(res => {
      WOB.W = 0.9;
      const out = [], t0 = S.gt, low = CS.tiles().find(t => t.key === 'sq:-2,1,0').key, top = 'sq:-1,7,1';
      (function f() {
        const st = CS.state(), tl = CS.tiles(), a = tl.find(t => t.key === low), b = tl.find(t => t.key === top), sl = CS.slots().sort((u, v) => v.y - u.y)[0];
        out.push({ t: st.t - t0, W: st.W, q: st.sway, qv: st.swayV, low: a ? a.sx : null, top: b ? b.sx : null, slot: sl ? sl.sx : null, key: sl ? sl.key : null, still: st.still });
        if (st.t - t0 < 3.5) requestAnimationFrame(f); else res(out);
      })();
    }));
    const L = await p2.evaluate(() => CS.cam().L);
    // (the sway eases toward 0.25 L × W in about 0.1 s while W decays: its amplitude follows 0.25·W a little behind)
    const early = samples.filter(s => s.t < 1.2), late = samples.filter(s => s.t > 3.2), mid = samples.filter(s => s.t > 0.4 && s.t < 1.6);
    const qMax = Math.max(...early.map(s => Math.abs(s.q))), wMax = Math.max(...early.map(s => s.W));
    const track = mid.map(s => ({ q: Math.abs(s.q), want: 0.25 * s.W }));
    const lowR = Math.max(...samples.map(s => s.low)) - Math.min(...samples.map(s => s.low));
    const topR = Math.max(...early.map(s => s.top)) - Math.min(...early.map(s => s.top));
    const slotR = Math.max(...early.filter(s => s.key === early[0].key).map(s => s.slot)) - Math.min(...early.filter(s => s.key === early[0].key).map(s => s.slot));
    const tMax = Math.max(...track.map(r => r.q / r.want));
    check('sway: the segment sways about 0.25 L × W at its top (never more), and settles', qMax >= 0.6 * 0.25 * 0.9 && qMax <= 0.25 * wMax + 0.01 && tMax >= 0.8 && tMax <= 1.2 && late.every(s => Math.abs(s.q) < 0.02),
      `max |sway| ${qMax.toFixed(3)} L from W ${wMax.toFixed(2)}; 0.4-1.6 s: peaks up to ${tMax.toFixed(2)} × 0.25·W; after 3.2 s ${Math.max(...late.map(s => Math.abs(s.q))).toFixed(3)} L`);
    check('sway: the braced part under the brace line stays still; the segment and its slots move', lowR < 0.5 && topR > 0.15 * L && slotR > 0.15 * L,
      `under the line ${lowR.toFixed(2)} px, the top tile ${topR.toFixed(1)} px, a slot ${slotR.toFixed(1)} px (L ${L.toFixed(0)} px)`);
    // the joints glow amber / red (W 0.9: red): the drawn frame changes where the joints are when the glow is on vs off
    const shotOn = await p2.evaluate(() => { WOB.W = 0.95; return true; }).then(() => p2.screenshot({ clip: { x: 0, y: 0, width: VIEW.width, height: VIEW.height } }));
    const shotOff = await p2.evaluate(() => { WOB.W = 0; WOB.q = 0; WOB.qv = 0; return true; }).then(async () => { await frame(p2); await frame(p2); return p2.screenshot({ clip: { x: 0, y: 0, width: VIEW.width, height: VIEW.height } }); });
    check('sway: the segment\'s joints glow (the frame differs with W 0.95 and W 0)', !shotOn.equals(shotOff), `${shotOn.length} / ${shotOff.length} bytes`);
    // the ghost stays honest on a swaying target: taps at the live centre of a top slot (the segment kept swaying)
    const res = [];
    // (a layer three wide over the brace line: λ stays about 1, so these drops add next to no wobble of their own)
    for (const key of ['sq:-3,7,1', 'sq:1,7,1', 'sq:-1,8,1', 'sq:-3,8,1', 'sq:1,8,1']) {
      await ready(p2);
      await p2.evaluate(() => { WOB.W = 0.8; });
      await p2.waitForTimeout(150);
      const r = await tapSlot(p2, key, { before: () => { WOB.W = Math.min(WOB.W, 0.8); } });
      res.push({ key, ghost: r.rel.ghostKey, land: r.land && r.land.key, grade: r.rel.grade, q: await p2.evaluate(() => CS.state().sway) });
      await p2.evaluate(() => { WOB.W = Math.min(WOB.W, 0.5); });
    }
    const honest = res.filter(r => r.ghost === r.land && r.land), perf = res.filter(r => r.grade === 'perfect');
    check('sway: the ghost stays honest on the swaying segment (landed = ghost key) and a tap at the live centre is PERFECT', res.length >= 4 && honest.length === res.length && perf.length >= res.length - 1,
      res.map(r => `${r.key}->${r.land} ${r.grade}`).join(', '));
    const dyn = await p2.evaluate(() => CS.state().dyn);
    check('sway: the top\'s lateral speed (flex + rock + sway) stays <= 2.8 L/s', dyn.vTop <= 2.8 + 1e-6, `max ${dyn.vTop.toFixed(3)} L/s`);
    await close(g2);
    return;
  }
  await close(g);
}

// ---------------------------------------------------------------- snap: over a TRUSS the segment goes, the brace stays
async function snapCheck(browser) {
  const g = await open(browser, { seed: 6, level: 8, ts: 1 });
  const { page } = g;
  await page.evaluate(() => { HZ.every = 0; HZ.kind = ''; });
  const yb = 3 + H3;
  await fixture(page, COL2(3).concat(['up:-2,3,0', 'up:0,3,0', 'dn:-1,3,0', 'sq:-1,3,1', 'sq:-1,4,1']), yb);
  // build a little combo first (real drops on the side, under the line: no ΔW), then W 0.999 and a drop on the top
  await tapSlot(page, 'sq:-4,2,0'); await tapSlot(page, 'sq:2,2,0');
  const before = await page.evaluate(() => ({ st: CS.state(), tiles: CS.tiles().map(t => t.key), debris: CS.state().debris }));
  const r = await tapSlot(page, 'sq:-1,5,1', { before: () => { WOB.W = 0.999; } });
  await page.waitForTimeout(450);          // (the segment lets go top first over 0.12 s, after the SNAP's hit-stop)
  const after = await page.evaluate(() => ({ st: CS.state(), tiles: CS.tiles().map(t => t.key), ev: CS.events.filter(e => e.type === 'snap' || e.type === 'crash'), words: CS.words().map(w => w.text), sfx: __sfx.slice(), slots: CS.slots().length }));
  const sn = after.ev.find(e => e.type === 'snap');
  const off = before.tiles.filter(k => minY(k) >= yb - 1e-6).concat([r.rel.ghostKey]), stay = before.tiles.filter(k => minY(k) < yb - 1e-6);
  const gone = off.every(k => !after.tiles.includes(k)), kept = stay.every(k => after.tiles.includes(k)) && after.tiles.length === stay.length;
  check('snap: W reaching 1 over a TRUSS snaps the segment off (every tile on or above the brace line), the braced part stands',
    !!sn && sn.full === false && gone && kept && !after.ev.some(e => e.type === 'crash') && after.st.phase === 'play',
    `snap ${JSON.stringify(sn)}; ${off.length} off, ${stay.length} kept, standing now ${after.tiles.length}`);
  check('snap: the segment flies off as debris; the combo resets; W and the sway go to 0; play goes on',
    after.st.debris >= before.debris + off.length && after.st.combo === 0 && before.st.combo > 0 && after.st.W === 0 && after.st.sway === 0 && after.slots > 0 && Math.abs(after.st.top - Math.max(...stay.map(k => minY(k) + (k.startsWith('sq') ? 1 : H3)))) < 1e-6,
    `debris ${before.debris} -> ${after.st.debris}, combo ${before.st.combo} -> ${after.st.combo}, W ${after.st.W}, top ${after.st.top.toFixed(3)}, slots ${after.slots}`);
  check('snap: "SNAP!" pops and Sfx.snap() plays in the same step', after.words.includes('SNAP!') && after.sfx.some(c => c.k === 'snap' && sn && Math.abs(c.t - sn.t) < 1e-3), `words ${after.words.join(' | ')}; sfx ${after.sfx.map(c => c.k).join(' ')}`);
  // and after it the hand drops again
  const r2 = await tapSlot(page, (await page.evaluate(() => CS.slots().filter(s => s.supported).sort((a, b) => b.y - a.y)[0].key)));
  check('snap: a tile drops and lands on the braced part after it', !!r2.land, r2.land ? r2.land.key : 'no landing');
  await close(g);
}
async function fullCheck(browser) {
  const g = await open(browser, { seed: 7, level: 8, ts: 1 });
  const { page } = g;
  await page.evaluate(() => { HZ.every = 0; HZ.kind = ''; });
  // (2 wide, 6 L with the tile: λ 3, ΔW 0.36 for a PERFECT: more than W loses in the 0.25 s the tile falls)
  await fixture(page, COL2(5));
  await tapSlot(page, 'sq:-2,5,0', { before: () => { WOB.W = 0.999; } });
  await page.waitForTimeout(100);
  const r = await page.evaluate(() => ({ ev: CS.events.filter(e => e.type === 'snap' || e.type === 'crash'), st: CS.state(), word: CR.word, sfx: __sfx.map(c => c.k) }));
  const sn = r.ev.find(e => e.type === 'snap'), cr = r.ev.find(e => e.type === 'crash');
  check('full: with no TRUSS a SNAP is a full crash (snap full, crash snap: true, the same step, "SNAP!")',
    !!sn && sn.full && !!cr && cr.snap === true && Math.abs(cr.t - sn.t) < 1e-9 && r.st.phase === 'crash' && r.word === 'SNAP!' && r.sfx.includes('snap') && r.sfx.includes('crash'),
    `${JSON.stringify(sn)} / ${JSON.stringify(cr)}; phase ${r.st.phase}, word ${r.word}, sfx ${r.sfx.join(' ')}`);
  await close(g);
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
  const chip = a.ui.goHigher, hold = a.ui.hold, inView = chip && chip.x >= 0 && chip.y >= 0 && chip.x + chip.w <= VIEW.width && chip.y + chip.h <= VIEW.height;
  const overBox = chip && hold && chip.x < hold.x + hold.w && hold.x < chip.x + chip.w && chip.y < hold.y + hold.h && hold.y < chip.y + chip.h;
  const k0 = Math.floor(a.st.top - a.st.goal + 1e-9);
  check('gamble: at the ribbon the crown is in the hand and the GO HIGHER chip shows on the HOLD box, in view, with the crown\'s value',
    a.st.crownInHand && a.st.goHigher && inView && overBox && a.st.crownValue === Math.round(100 * a.st.level * (1 + 0.5 * k0)),
    `chip ${chip ? [chip.x, chip.y, chip.w, chip.h].map(Math.round).join(',') : '-'}, HOLD ${[hold.x, hold.y, hold.w, hold.h].map(Math.round).join(',')}; value ${a.st.crownValue} (top ${a.st.top.toFixed(2)}, k ${k0})`);
  check('gamble: the first crown ever shows the one-line hint, once, and the prefs remember it', a.ev === 1 && !!a.ui.crownHint && a.prefs.seenCrownHint === true,
    `crownhint events ${a.ev}, hint ${a.ui.crownHint ? 'drawn' : 'not drawn'}, prefs ${JSON.stringify(a.prefs)}`);
  // a mouse click on the chip banks the crown: OVERTIME
  await page.mouse.move(chip.x + chip.w / 2, chip.y + chip.h / 2); await page.mouse.down(); await page.mouse.up();
  await frame(page);
  const b = await page.evaluate(() => ({ st: CS.state(), ev: CS.events.filter(e => e.type === 'overtime').length, ui: CS.ui() }));
  check('gamble: a click on the chip banks the crown and starts OVERTIME (the chip gives way to the multiplier badge)', b.st.overtime && b.st.held === 'crown' && !b.st.crownInHand && b.ev === 1 && !b.ui.goHigher,
    `overtime ${b.st.overtime}, held ${b.st.held}, piece ${b.st.piece}`);
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
  // a SNAP in OVERTIME that leaves the top over the ribbon: the crown is kept, its multiplier falls with the top
  await tapSlot(page, 'sq:-1,8,1', { before: () => { WOB.W = 0.999; } });
  await page.waitForTimeout(120);
  const c = await page.evaluate(() => ({ st: CS.state(), sn: CS.events.filter(e => e.type === 'snap').slice(-1)[0] }));
  check('gamble: a SNAP in OVERTIME leaving the top at or over the ribbon keeps the crown, its multiplier falls with the top',
    !!c.sn && !c.sn.full && c.st.held === 'crown' && c.st.overtime && c.st.goalTorn && c.st.top >= c.st.goal && Math.abs(c.st.crownMult - (1 + 0.5 * Math.floor(c.st.top - c.st.goal + 1e-9))) < 1e-9,
    `snap ${!!c.sn}, held ${c.st.held}, top ${c.st.top.toFixed(2)}, ×${c.st.crownMult}`);
  // HOLD takes the crown back; placing it pays 100 × level × the multiplier, then the SMASH
  await ready(page);
  await page.keyboard.press('Shift');
  await frame(page);
  const kNow = await page.evaluate(() => ({ crown: CS.state().crownInHand, mult: CS.state().crownMult, value: CS.state().crownValue }));
  const key = await page.evaluate(() => { const sl = CS.slots().sort((a, b) => b.y - a.y); return sl[0] ? sl[0].key : null; });
  if (key) await tapSlot(page, key);
  await until(page, () => CS.events.some(e => e.type === 'crown'), null, 4000).catch(() => {});
  const cr = await page.evaluate(() => CS.events.find(e => e.type === 'crown') || null);
  check('gamble: HOLD takes the crown back; placing it pays 100 × level × the multiplier shown', kNow.crown && !!cr && cr.pts === kNow.value && Math.abs(1 + 0.5 * cr.k - kNow.mult) < 1e-9,
    `in hand ${kNow.crown}, ×${kNow.mult} = ${kNow.value}; crown ${cr ? cr.pts + ' (k ' + cr.k + ')' : '-'}`);
  // level 2: the next crown has no hint
  await until(page, () => CS.state().phase === 'play' && CS.state().level === 2 && CS.state().handReady && !CS.state().locked, null, 8000);
  await fixture(page, ROWS4(5));
  await tapSlot(page, (await page.evaluate(() => CS.slots().filter(s => s.supported).sort((a, b) => a.y - b.y)[0].key)));
  await until(page, () => CS.state().crownInHand, null, 5000).catch(() => {});
  const d = await page.evaluate(() => ({ ev: CS.events.filter(e => e.type === 'crownhint').length, st: CS.state() }));
  check('gamble: the next crown shows no hint (the chip only)', d.ev === 1 && d.st.goHigher, `crownhint events ${d.ev}, chip ${d.st.goHigher}`);
  // a SNAP in OVERTIME that takes the top under the ribbon loses the crown and ties the ribbon up again (level 2: G 5)
  await close(g);
  const g2 = await open(browser, { seed: 10, level: 1, ts: 1 });
  const p2 = g2.page;
  await fixture(p2, ROWS4(2).concat(['up:-2,2,0', 'up:0,2,0', 'dn:-1,2,0', 'sq:-1,2,1']), 2 + H3);
  await tapSlot(p2, 'sq:-1,3,1', { before: () => { WOB.W = 0; } });                 // top 4.87: the ribbon tears
  await until(p2, () => CS.state().crownInHand && CS.state().handReady, null, 5000).catch(() => {});
  await p2.keyboard.press('Shift');                                                   // HOLD banks it too
  const ot = await p2.evaluate(() => CS.state().overtime);
  await tapSlot(p2, 'sq:-1,4,1', { before: () => { WOB.W = 0.999; } });
  await p2.waitForTimeout(120);
  const e = await p2.evaluate(() => ({ st: CS.state(), sn: CS.events.filter(x => x.type === 'snap').length }));
  check('gamble: HOLD (Shift) banks the crown too; a SNAP in OVERTIME taking the top under the ribbon loses the crown and ties the ribbon up',
    ot && e.sn === 1 && e.st.held === null && !e.st.overtime && !e.st.goalTorn && e.st.top < e.st.goal,
    `overtime ${ot}; snaps ${e.sn}, held ${e.st.held}, goalTorn ${e.st.goalTorn}, top ${e.st.top.toFixed(2)}`);
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
  const ch = await p3.evaluate(() => CS.ui().goHigher || null);
  if (ch) await p3.touchscreen.tap(ch.x + ch.w / 2, ch.y + ch.h / 2);
  await frame(p3);
  const t3 = await p3.evaluate(() => ({ ot: CS.state().overtime, held: CS.state().held, miss: CS.events.filter(e => e.type === 'miss').length }));
  check('gamble: a touch tap on the chip banks the crown (no drop)', !!ch && t3.ot && t3.held === 'crown' && t3.miss === 0, JSON.stringify(t3));
  errorsAll.push(...g3.errors); await g3.context.close();
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
  const dw = await page.evaluate(() => [wobDelta('perfect', 'sq', 3), wobDelta('clack', 'cube', 3)]);
  check('big: ΔW × 0.4', Math.abs(dw[0] - 0.36 * 0.4) < 1e-9 && Math.abs(dw[1] - 0.2 * 4 * 1.5 * 0.4) < 1e-9, dw.map(x => x.toFixed(4)).join(', '));
  await close(g);
}

(async () => {
  const browser = await launch();
  try {
    if (want('dw')) await dwCheck(browser);
    if (want('decay') || want('fuse') || want('sway')) await decayFuseSway(browser);
    if (want('snap')) await snapCheck(browser);
    if (want('full')) await fullCheck(browser);
    if (want('gamble')) await gambleCheck(browser);
    if (want('big')) await bigCheck(browser);
  } finally { await browser.close(); }
  check('no page or console errors', errorsAll.length === 0, errorsAll.slice(0, 3).join(' | '));
  console.log(failures ? `WOBBLE: ${failures} check(s) failed` : 'WOBBLE: all checks passed');
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
