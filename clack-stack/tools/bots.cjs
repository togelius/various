#!/usr/bin/env node
'use strict';
// M3 acceptance (DESIGN.md 14): tower dynamics, crash and debris, played by bots through REAL mouse events at
// positions read from CS.slots(). All runs: ?ts=4&level=N&seed=N&autostart=1 (390x844, muted, no hint).
//   node clack-stack/tools/bots.cjs                     (everything, seeds 1-10)
//   node clack-stack/tools/bots.cjs --only=edge,save    (calib, perfect, perfect8, edge, save, tippy)
//   node clack-stack/tools/bots.cjs --seeds=3-5 --verbose
// Checks:
//   calib    CS.calib() reports a bump peak of 0.35 α ± 0.03 on the reference tower (and the other targets)
//   perfect  PerfectBot (level 3, two cars since DESIGN 15.5, the sway of 16.2 off (its swing would tip the bot's 2-wide
//            middle column at 8-10 L: the sway is wobble.cjs's and strategy.cjs's); taps the PERFECT centre of the supported slot that keeps |cₓ| smallest, never on a
//            TIPPY ghost while another slot is safe, HOLD once if none is) reaches 10 L with zero crashes in 10/10 seeds
//            (if the ghost turns TIPPY while it aims, it applies the rule again without that slot). M4: level 3's
//            ribbon is at 6 L, so on the way the crown drops into the hand: the bot HOLDs it (OVERTIME) and builds on;
//            with the crown in the HOLD box, a tile with no safe slot is thrown away at the screen edge (a MISS)
//   perfect8 PerfectBot on one car (level 8, the first one-car level since DESIGN 15.5; hazards, the fuse and the sway
//            off): the M3 guarantee, 10 L with zero crashes in 10/10 seeds
//   edge     EdgeBot (always the rightmost slot; on one car: level 8 with its hazards off, DESIGN 15.5 having put two
//            cars under level 3) crashes within 30 tiles in 10/10 seeds, and every crash is
//            preceded by a tipwarn at least 0.5 s earlier (game time): the last tipwarn before it, i.e. the warning that
//            was up when it went (the tell re-arms below 0.4 α); and every crash with the weight past a wheel (16.1)
//   save     SaveBot (as EdgeBot, level 8 hazards off; rightmost until a tipwarn, then drops on the far side) logs at
//            least one save over the seeds;
//            and every save is honest: nothing in the air, the tower physically leaned >= 0.6 α, and no crash follows
//            within 2 s unless a new tile landed (or a hazard hit) after the save (checked for every save in every run)
//   debris   (in every run) the debris count never goes above 60, no visible piece ever vanishes (the cap only drops
//            pieces that have faded out), and everything a crash threw is asleep 3 s later
//   dyn      (in every run, every 120 Hz step) the flex never bends past 0.35 L, and the top's lateral speed (rock + flex)
//            stays <= 2.8 L/s until the tower is past its tipping angle (past α it is uncapped: reported separately). (The
//            sway of 16.2 is not under the cap: a swaying spot is chosen and graded where it is at rest)
//   tippy    TIPPY is honest: random drops (random slot, random offset within ±0.5 L, so any grade) on level 3 and 7
//            towers (the fuse held: each drop's outcome is read once the tower is still); a drop whose ghost was not
//            TIPPY never ends in a crash (drops followed up before the tower was still are skipped;
//            M7: level 7 has the bump car, and TIPPY looks ahead to a hit inside its horizon, but a crash after a later
//            bump or foot hit is the hazard's and is counted apart). (TIPPY is the ghost weight's red, on every level,
//            16.1; CS.lastRelease.tippy reports it. The look-ahead has the sway in it: a swing that tips the tower is a
//            TIPPY drop too)
//   exact    (with tippy) the look-ahead behind TIPPY, the tip tell and SAVE is the game's own future, step for step:
//            at every release (a click between frames, and the fuse's drop inside a step) CS.lookahead's θ for the
//            next 1.5 s equals the tower's real θ after each step, exactly, up to a crash or the next release, on
//            level 3 and level 7 (the bump car) towers. (The look-ahead once landed every tile a step late when asked
//            between frames: a drop on the edge of tipping could show safe and fall, now and then: a flaky TIPPY run)
//   --trace  prints each PerfectBot decision and the run's releases and events
//   --literal  (report only, never fails) also runs the bare rule of DESIGN 14: no TIPPY veto, no HOLD
// Exits non-zero on any failure, page error or console error.
const { launch, gamePage, until } = require('./lib.cjs');

const argv = process.argv.slice(2);
const ONLY = (argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = n => !ONLY.length || ONLY.includes(n);
const VERBOSE = argv.includes('--verbose') || argv.includes('--trace');
const TRACE = argv.includes('--trace');
const LITERAL = argv.includes('--literal');
const SEEDS = (() => {
  const a = (argv.find(x => x.startsWith('--seeds=')) || '--seeds=1-10').slice(8).split('-').map(Number);
  const out = []; for (let s = a[0]; s <= (a[1] || a[0]); s++) out.push(s); return out;
})();
const VIEW = { width: 390, height: 844 };
// DESIGN 15.5: level 3 stands on two cars (4 L) now. EdgeBot and SaveBot were written for the one-car level 3 (no
// hazards); on a 4 L base a rightmost-slot tower can reach the ribbon without going over. They play on one car again:
// level 8, the first one-car level, with its hazards (the bump car and the foot, M7, tested by hazards.cjs) switched off
// for the level (its fuse is 1.4 s, not 2.0)
const EDGE_LEVEL = 8;
async function noHazards(page) { await page.evaluate(() => { HZ.every = 0; HZ.kind = ''; HZ.warned = false; }); }
const TAP_Y = Math.round(VIEW.height * 0.55);
const MASS = { sq: 1, marble: 1, tri: 0.45, crown: 0.45, cube: 3 };
let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
}
const log = (...a) => { if (VERBOSE) console.log('   ', ...a); };

// In-page monitor: the largest debris count seen, and for every crash how many of the pieces it threw (and any
// older ones) are still awake 3 s (game time) later.
function installMonitor() {
  window.__mon = { maxDebris: 0, checks: [], pending: [], seen: 0, rel: [], relId: 0 };
  const M = window.__mon;
  (function loop() {
    const st = CS.state(), ev = CS.events, lr = CS.lastRelease;
    if (lr && lr.id > M.relId) { M.relId = lr.id; M.rel.push(lr); }
    if (st.debris > M.maxDebris) M.maxDebris = st.debris;
    for (; M.seen < ev.length; M.seen++) if (ev[M.seen].type === 'crash') M.pending.push(ev[M.seen].t);
    while (M.pending.length && st.t >= M.pending[0] + 3) {
      const t = M.pending.shift();
      const mine = CS.debris().filter(d => d.born <= t + 1 && !d.fading);
      const aw = mine.filter(d => !d.sleep);
      const sl = mine.filter(d => d.sleep && d.sleepT >= 0).sort((a, b) => b.sleepT - a.sleepT)[0];
      const settle = sl ? sl.sleepT - t : 0, slowest = sl ? `${sl.shape}${sl.plowed ? ' (shoved)' : ''} born +${(sl.born - t).toFixed(2)}` : '';
      M.checks.push({ t, at: st.t, awake: aw.length, settle, slowest, what: aw.map(d => `${d.shape}@${d.x.toFixed(2)},${d.y.toFixed(2)} v${d.vx.toFixed(2)},${d.vy.toFixed(2)} w${d.w.toFixed(2)} born ${d.born.toFixed(2)}`).join('; ') });
    }
    requestAnimationFrame(loop);
  })();
}

async function openGame(browser, params) {
  const g = await gamePage(browser, VIEW, Object.assign({ ts: 4, autostart: 1, mute: 1, nohint: 1 }, params));
  await until(g.page, () => window.CS && CS.state().handReady && CS.state().phase === 'play', null, 15000);
  await g.page.evaluate(installMonitor);
  return g;
}
// ready to drop: play phase, a tile in the hand, the base not rolling in
async function waitReady(page, timeout) {
  await until(page, () => { const s = CS.state(); return s.phase === 'play' && s.handReady && !s.locked; }, null, timeout || 20000);
}
async function tapAt(page, x) { await page.mouse.move(x, TAP_Y); await page.mouse.down(); await page.mouse.up(); }
async function lastId(page) { return page.evaluate(() => (CS.lastRelease ? CS.lastRelease.id : 0)); }
async function waitRelease(page, prev) { await until(page, id => CS.lastRelease && CS.lastRelease.id > id, prev, 8000); }
// game-time wait (polls frames)
async function waitGame(page, dt) {
  const t0 = await page.evaluate(() => CS.state().t);
  await until(page, t => CS.state().t >= t, t0 + dt, 20000);
}
// the run's debris/dynamics stats, and every save with what followed it (crashes within 2 s, and landings or hazard
// hits between)
async function monitor(page) {
  return page.evaluate(() => {
    const ev = CS.events, st = CS.state();
    const saves = ev.filter(e => e.type === 'save').map(s => {
      const crash = ev.find(e => e.type === 'crash' && e.t > s.t && e.t <= s.t + 2);
      const landed = crash ? ev.some(e => (e.type === 'land' || e.type === 'bump' || e.type === 'foot') && e.t > s.t && e.t <= crash.t) : false;
      return { t: s.t, inAir: s.inAir, level: s.level, crashAfter: crash ? +(crash.t - s.t).toFixed(3) : null, landedBetween: landed };
    });
    return { maxDebris: __mon.maxDebris, checks: __mon.checks.slice(), dyn: st.dyn, saves };
  });
}
// --trace: the run's releases and events in game-time order
async function traceRun(page, seed) {
  if (!TRACE) return;
  const { rel, ev } = await page.evaluate(() => ({ rel: __mon.rel.slice(), ev: CS.events.filter(e => /land|crash|tipwarn|miss|save|topple|brace|lost/.test(e.type)) }));
  const rows = rel.map(r => ({ t: r.t, s: `release #${r.id} ${r.piece} -> ${r.ghostKey || 'MISS'} ${r.grade} dx ${r.dx === null ? '-' : r.dx.toFixed(3)} src ${r.src}${r.tippy ? ' TIPPY' : ''}` }))
    .concat(ev.map(e => ({ t: e.t, s: `  ${e.type} ${JSON.stringify(Object.assign({}, e, { t: undefined, type: undefined }))}` })))
    .sort((a, b) => a.t - b.t);
  for (const r of rows) console.log(`      s${seed} t=${r.t.toFixed(3)} ${r.s}`);
}

// ---------------------------------------------------------------- PerfectBot
// DESIGN 14: always taps the PERFECT centre of the supported slot that keeps |cₓ| smallest. Like a player it reads
// the ghost, with one rule on top: it never drops on a TIPPY ghost (the red '!': the look-ahead says this drop, with
// its landing kick, tips the tower over) while another slot is safe, and when every slot for the piece in hand is
// TIPPY it swaps once via HOLD and chooses again. No other vetoes, no throw-aways. It waits for the tower to calm
// down (within the fuse) so the centre it reads is the centre it taps.
async function perfectBot(browser, seed, literal, level) {
  level = level || 3;
  const { page, errors, context } = await openGame(browser, { seed, level });
  // (level 8: the one-car guarantee of M3, the hazards and the fuse held as fixtures: the bot's calm wait runs past
  // the 1.4 s fuse there)
  if (level !== 3) { await noHazards(page); await page.evaluate(lv => { LEVELS[lv].fuse = 1e9; }, level); }
  // (DESIGN 16.2: this checks the rock, tip and crash of M3 for a player who aims perfectly and keeps the centre of
  // mass central. Its most-central rule stacks a 2-wide column up the middle of the 4 L base, λ 4-5 at 8-10 L, which
  // sways until its swing tips it (by design: that is what bracing is for, tools/strategy.cjs). The sway is off here, a
  // test fixture; tools/wobble.cjs and tools/strategy.cjs play it)
  await page.evaluate(() => { CFG.WOB_A = { perfect: 0, great: 0, clack: 0 }; });
  const r = { seed, tiles: 0, top: 0, crashes: 0, topples: 0, perfect: 0, lands: 0, swaps: 0, tippyDrops: 0, dodges: 0, misses: 0, crownHeld: 0, thrown: 0, errors };
  // among the slots that are not TIPPY: the supported one (a hanging one if no supported slot is safe) that keeps
  // |cₓ| smallest; ties: the higher, then by key. CS.slots().tippy = the ghost's TIPPY at the slot's PERFECT centre.
  const pick = avoid => page.evaluate(m => {
    const st = CS.state(), sl = CS.slots().filter(s => m.avoid.indexOf(s.key) < 0), mass = m[st.piece] || 1;
    const after = s => Math.abs((st.M * st.com.x + mass * s.lx) / (st.M + mass));
    const best = list => {
      const sup = list.filter(s => s.supported), pool = sup.length ? sup : list.slice();
      pool.sort((a, b) => after(a) - after(b) || b.ly - a.ly || (a.key < b.key ? -1 : 1));
      return pool[0] || null;
    };
    const literal = best(sl), slot = m.literal ? literal : best(sl.filter(s => !s.tippy));
    return { st, slot, literal, after: slot ? after(slot) : null, dodged: !!(slot && literal && slot.key !== literal.key) };
  }, Object.assign({ literal: !!literal, avoid: avoid || [] }, MASS));
  // move the hand to the slot's PERFECT centre (following it if the tower sways) and read the ghost there
  const aim = async slot => {
    let x = slot.rsx, g = null;
    for (let tries = 0; tries < 3; tries++) {
      await page.mouse.move(x, TAP_Y);
      g = await page.evaluate(key => new Promise(res => requestAnimationFrame(() => {
        const gh = CS.ghost(), s = CS.slots().find(q => q.key === key);
        res({ key: gh && gh.key, gold: !!gh && gh.color === 'gold', tippy: !!gh && !!gh.tippy, sx: s ? s.rsx : null, crown: CS.state().piece === 'crown' });
      })), slot.key);
      if (g.crown) break;
      if (g.key === slot.key && g.gold) break;
      if (g.sx === null) break;
      x = g.sx;
    }
    return g;
  };
  let heldFor = -1;                                                // the release id the last HOLD was spent on
  try {
    for (let k = 0; k < 160; k++) {
      await waitReady(page);
      // calm: the rock at rest and the sway small; a bounded wait in game time (the fuse is 2.0 s on level 3), so a
      // busy machine never lets the fuse drop the tile while the bot is still aiming
      // (at rest: theta back at 0 too, since a tall tower rocking on its base edge has omega ~0 at the end of each
      // swing; up to 1.5 s, 0.5 s inside the level-3 fuse, as an edge landing at 9-10 L rocks for about 1.2 s)
      await until(page, () => { const s = CS.state(); return (s.inAir === 0 && Math.abs(s.theta) < 0.002 && Math.abs(s.omega) < 0.02 && Math.abs(s.flexV) < 0.12) || s.t >= s.readyAt + 1.5; }, null, 8000).catch(() => {});
      let p = await pick();
      const relId = await lastId(page);
      // M4: the crown dropped into the hand at the ribbon: bank it (OVERTIME) and build on toward 10 L
      if (p.st.piece === 'crown' && p.st.held !== 'crown') {
        if (TRACE) console.log(`      s${seed} #${k} HOLD the crown at ${p.st.top.toFixed(2)} L (OVERTIME)`);
        await page.keyboard.press('Shift'); r.crownHeld++; heldFor = relId;
        await page.waitForTimeout(10);
        continue;
      }
      const crownHeld = p.st.held === 'crown';
      if (!p.slot && crownHeld && !literal) {
        // the HOLD box keeps the crown: a tile with no safe slot is thrown away instead
        if (TRACE) console.log(`      s${seed} #${k} throw away ${p.st.piece} (all TIPPY, the crown is held)`);
        await page.mouse.move(3, TAP_Y); await page.mouse.down(); await page.mouse.up(); r.thrown++;
        await waitRelease(page, relId).catch(() => {});
        continue;
      }
      if (!p.slot && heldFor !== relId && !literal) {
        // every slot for this piece is TIPPY (or there is none): HOLD once (one swap per release) and choose again
        if (TRACE) console.log(`      s${seed} #${k} HOLD ${p.st.piece}${p.literal ? ' (all TIPPY; best ' + p.literal.key + ')' : ' (no slot)'}`);
        await page.keyboard.press('Shift'); r.swaps++; heldFor = relId;
        await page.waitForTimeout(10);
        p = await pick();
      }
      if (!p.slot && p.literal) p.slot = p.literal;                   // nothing safe after the swap either: the plain rule
      if (!p.slot) {
        // no slot at all for this piece (a cube with no room) and the swap is spent: the fuse drops it (a MISS)
        if (TRACE) console.log(`      s${seed} #${k} no slot for ${p.st.piece}: waiting for the fuse`);
        await waitRelease(page, relId).catch(() => {});
        continue;
      }
      if (p.dodged) r.dodges++;
      let g = await aim(p.slot);
      // the ghost turned TIPPY while aiming (the tower moved since the pick): the rule again, without that slot
      for (let again = 0, avoid = []; !literal && g && g.tippy && again < 2; again++) {
        avoid.push(p.slot.key);
        const q = await pick(avoid);
        if (!q.slot) break;
        if (TRACE) console.log(`      s${seed} #${k} ${p.slot.key} TIPPY at aim: -> ${q.slot.key}`);
        p = q; g = await aim(p.slot);
      }
      if (g && g.crown) continue;                   // the crown arrived while aiming: bank it first (top of the loop)
      if (g && g.tippy) r.tippyDrops++;
      if (TRACE) console.log(`      s${seed} #${k} ${p.st.piece} (held ${p.st.held}) cx ${p.st.com.x.toFixed(2)} top ${p.st.top.toFixed(2)} -> ${p.slot.key}${p.slot.supported ? '' : ' (hanging)'} cx' ${p.after === null ? '-' : p.after.toFixed(2)}${p.dodged ? ' (not ' + p.literal.key + ': TIPPY)' : ''}${g && g.tippy ? ' TIPPY' : ''}`);
      // the last read, just before the press: a tower still rocking may have carried the slot off its PERFECT centre
      // since the aim; follow it (the TIPPY rule above has had its say)
      let prev = relId;
      for (let again = 0; again < 4; again++) {
        const q = await page.evaluate(key => {
          const gh = CS.ghost(), s = CS.slots().find(o => o.key === key);
          return { key: gh && gh.key, gold: !!gh && gh.color === 'gold', sx: s ? s.rsx : null, id: CS.lastRelease ? CS.lastRelease.id : 0 };
        }, p.slot.key);
        prev = q.id;
        if (!g || g.crown || again === 3 || (q.key === p.slot.key && q.gold) || q.sx === null) break;
        if (TRACE) console.log(`      s${seed} #${k} ${p.slot.key} moved off its centre before the press: aim again`);
        g = await aim(Object.assign({}, p.slot, { rsx: q.sx }));
      }
      if (g && g.crown) continue;
      await page.mouse.down(); await page.mouse.up();
      await waitRelease(page, prev).catch(() => {});
      r.tiles++;
      const st = await page.evaluate(() => CS.state());
      r.top = Math.max(r.top, st.top);
      if (st.crashes > 0) break;
      if (st.top >= 10 - 1e-9) break;
    }
    await until(page, () => CS.state().inAir === 0, null, 5000).catch(() => {});
    await waitGame(page, 1.5).catch(() => {});     // let the last landing's rock play out: a crash after it counts
    const s = await page.evaluate(() => ({ st: CS.state(), ev: CS.events.filter(e => e.type === 'land' || e.type === 'crash' || e.type === 'topple' || e.type === 'miss') }));
    r.top = Math.max(r.top, s.st.top); r.crashes = s.st.crashes;
    r.topples = s.ev.filter(e => e.type === 'topple').length;
    r.misses = s.ev.filter(e => e.type === 'miss').length;
    r.fuse = (await page.evaluate(() => __mon.rel.filter(q => q.src === 'fuse').length));
    const lands = s.ev.filter(e => e.type === 'land');
    r.lands = lands.length; r.perfect = lands.filter(e => e.grade === 'perfect').length;
    r.mon = await monitor(page);
    await traceRun(page, seed);
  } finally { await context.close(); }
  return r;
}

// ---------------------------------------------------------------- EdgeBot / SaveBot
// EdgeBot: always the rightmost slot (its centre). SaveBot: the same, but right after a tipwarn it drops on the
// far side (the slot that pulls the committed CoM furthest back), as fast as the hand allows.
async function edgeBot(browser, seed, save) {
  const { page, errors, context } = await openGame(browser, { seed, level: EDGE_LEVEL });
  await noHazards(page);
  const r = { seed, drops: 0, crashes: [], saves: 0, counters: 0, errors, firstCrashAt: null };
  const WANT_CRASHES = save ? 3 : 2, MAX_DROPS = save ? 90 : 70;
  try {
    let seenWarn = 0, crashes = 0, dropsSinceCrash = 0;
    while (r.drops < MAX_DROPS) {
      await waitReady(page);
      const info = await page.evaluate(n => {
        const ev = CS.events, warns = ev.filter(e => e.type === 'tipwarn');
        return { st: CS.state(), sl: CS.slots(), warns: warns.length, lastWarn: warns[warns.length - 1] || null, crashes: ev.filter(e => e.type === 'crash').length };
      }, seenWarn);
      if (info.crashes > crashes) {
        // a crash: let it play out (and let the monitor check the pile 3 s later) before building again
        crashes = info.crashes; dropsSinceCrash = 0;
        if (r.firstCrashAt === null) r.firstCrashAt = r.drops;
        if (crashes >= WANT_CRASHES) break;
        const ct = await page.evaluate(() => CS.events.filter(e => e.type === 'crash').pop().t);
        await until(page, t => CS.state().t >= t, ct + 3.2, 20000);
        seenWarn = await page.evaluate(() => CS.events.filter(e => e.type === 'tipwarn').length);
        continue;
      }
      if (!info.sl.length) { await page.keyboard.press('Shift'); await page.waitForTimeout(10); continue; }
      let slot;
      const counter = save && info.warns > seenWarn && info.st.tip >= 0.3;
      if (counter) {
        // far side: pull the committed centre of mass back the other way
        const side = info.lastWarn.side || 1;
        slot = info.sl.slice().sort((a, b) => side * (a.lx - b.lx))[0];
        r.counters++;
        log(`seed ${seed}: counter on ${slot.key} (tip ${info.st.tip.toFixed(2)}, side ${side})`);
      } else {
        slot = info.sl.slice().sort((a, b) => b.sx - a.sx)[0];
      }
      if (info.warns > seenWarn && (!save || info.st.tip < 0.3)) seenWarn = info.warns;
      if (counter) seenWarn = info.warns;
      const prev = await lastId(page);
      await tapAt(page, slot.sx);
      await waitRelease(page, prev).catch(() => {});
      r.drops++; dropsSinceCrash++;
      // SaveBot, after its counterweight: hands off while the tower decides (a save, a crash, or 1.5 s: within the fuse)
      if (counter) await until(page, t => { const s = CS.state(); return s.saves > t.s || s.crashes > t.c || s.t >= t.t + 1.5; },
        { c: info.st.crashes, s: info.st.saves, t: info.st.t }, 15000).catch(() => {});
    }
    await waitGame(page, 3.3).catch(() => {});
    const ev = await page.evaluate(() => CS.events.filter(e => e.type === 'crash' || e.type === 'tipwarn' || e.type === 'save' || e.type === 'topple'));
    for (const c of ev.filter(e => e.type === 'crash')) {
      // the warning that was up when it went: the LAST tipwarn before the crash (the tell re-arms below 0.4, so an
      // earlier one belongs to a swing the tower came back from)
      const warns = ev.filter(e => e.type === 'tipwarn' && e.t <= c.t);
      const last = warns.length ? warns[warns.length - 1].t : null;
      r.crashes.push({ t: c.t, tiles: c.tiles, top: c.top, warnLead: last === null ? null : c.t - last, past: !!c.past });
    }
    r.saves = ev.filter(e => e.type === 'save').length;
    r.topples = ev.filter(e => e.type === 'topple').length;
    r.mon = await monitor(page);
  } finally { await context.close(); }
  return r;
}

// ---------------------------------------------------------------- TIPPY honesty
// Random drops with real mouse events; after each one, hands off until the tower is still again or has crashed. The
// ghost's TIPPY at the moment of release (CS.lastRelease.tippy) must predict the crash: never a crash without it.
async function tippyHonesty(browser, seed, drops) {
  const level = seed % 2 ? 3 : 7;
  const { page, errors, context } = await openGame(browser, { seed, level });
  // (the fuse held, a fixture: a drop's outcome is read once the tower is still, and the wobble takes a while to settle
  // (15.3); with the fuse running it would drop the next tile first and the drop would be skipped)
  await page.evaluate(lv => { LEVELS[lv].fuse = 1e9; }, level);
  const r = { seed, level, ok: 0, fn: [], tp: 0, fp: 0, skipped: 0, hazard: 0, errors };
  let rnd = seed * 7919 + 17; const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  try {
    for (let k = 0; k < drops; k++) {
      await until(page, () => { const s = CS.state(); return s.phase === 'play' && s.handReady && !s.locked && s.inAir === 0; }, null, 20000);
      const info = await page.evaluate(() => ({ sl: CS.slots(), L: CS.cam().L, crashes: CS.state().crashes, top: CS.state().top }));
      if (!info.sl.length) { await page.keyboard.press('Shift'); await page.waitForTimeout(20); continue; }
      const s = info.sl[(rand() * info.sl.length) | 0];
      const prev = await lastId(page);
      await page.mouse.move(s.sx + (rand() - 0.5) * info.L, TAP_Y);
      await page.mouse.down(); await page.mouse.up();
      await waitRelease(page, prev).catch(() => {});
      const rel = await page.evaluate(() => CS.lastRelease);
      if (!rel || rel.id <= prev || !rel.ghostKey) continue;
      // hands off: still again, crashed, or the fuse dropped the next tile first (then the outcome is not this drop's)
      const out = await page.evaluate(a => new Promise(res => {
        (function poll() {
          const st = CS.state(), lr = CS.lastRelease;
          if (st.crashes > a.c) return res('crash');
          if (lr && lr.id > a.id) return res('skip');
          if (st.inAir === 0 && st.still && st.t > a.t + 0.5) return res('still');
          if (st.t > a.t + 8) return res('skip');
          requestAnimationFrame(poll);
        })();
      }), { c: info.crashes, id: rel.id, t: rel.t });
      const hz = out === 'crash' ? await page.evaluate(t => CS.events.some(e => (e.type === 'bump' || e.type === 'foot') && e.hit && e.t >= t), rel.t) : false;
      if (out === 'skip') r.skipped++;
      else if (out === 'crash' && !rel.tippy && hz) r.hazard++;      // M7: a bump or a foot hit it after the drop
      else if (out === 'crash' && !rel.tippy) {
        // (what went: the crash, and the landing's wobble, for the record)
        const d = await page.evaluate(id => { const l = CS.events.find(e => e.type === 'land' && e.id === id), c = CS.events.filter(e => e.type === 'crash').pop(); return { l, c }; }, rel.id);
        r.fn.push(`${rel.piece} -> ${rel.ghostKey} ${rel.grade} dx ${rel.dx.toFixed(3)} on a ${info.top.toFixed(1)} L tower (crash ${d.c ? (d.c.snap ? 'SNAP' : 'tip') + ' at +' + (d.c.t - rel.t).toFixed(2) + ' s' : '-'}, landed ${d.l ? d.l.key + ' W ' + d.l.W + ' dW ' + d.l.dW + ' λ ' + d.l.lam : '-'})`);
      }
      else if (out === 'crash') r.tp++;
      else if (rel.tippy) r.fp++;
      else r.ok++;
      if (out === 'crash') await until(page, () => { const s = CS.state(); return s.phase === 'play' && !s.locked; }, null, 20000);
    }
    r.mon = await monitor(page);
  } finally { await context.close(); }
  return r;
}

// ---------------------------------------------------------------- the look-ahead, step for step
async function lookaheadExact(browser, seed, level, drops) {
  const { page, errors, context } = await openGame(browser, { seed, level, ts: 2 });
  const r = { seed, level, rel: 0, compared: 0, steps: 0, bad: [], ctx: { true: 0, false: 0 }, errors };
  let rnd = seed * 104729 + 7; const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  try {
    await page.evaluate(() => {
      const X = window.__la = { cur: null, done: [] };
      const close = why => { if (X.cur) { X.cur.end = why; X.done.push(X.cur); X.cur = null; } };
      const rel = window.doRelease;
      window.doRelease = function () {
        const ok = rel.apply(this, arguments);
        if (ok && S.flights.length) {
          close('next release');
          const la = CS.lookahead(1.5);
          X.cur = { t: S.gt, rocked: la.rocked, pred: la.theta, real: [], crashes: S.crashes };
        }
        return ok;
      };
      const st = window.step;
      window.step = function () {
        const g0 = S.gt, c0 = S.crashes;
        st.apply(this, arguments);
        if (!X.cur || S.gt === g0) return;
        if (S.crashes !== c0 || S.phase !== 'play') { close('crash or phase'); return; }
        X.cur.real.push(TW.theta);
        if (X.cur.real.length >= X.cur.pred.length) close('horizon');
      };
    });
    for (let k = 0; k < drops; k++) {
      await until(page, () => { const s = CS.state(); return s.phase === 'play' && s.handReady && !s.locked; }, null, 20000);
      const info = await page.evaluate(() => ({ sl: CS.slots(), L: CS.cam().L }));
      if (!info.sl.length) { await page.keyboard.press('Shift'); await page.waitForTimeout(20); continue; }
      const sl = info.sl[(rand() * info.sl.length) | 0];
      await page.mouse.move(sl.sx + (rand() - 0.5) * info.L, TAP_Y);
      await page.mouse.down(); await page.mouse.up();
      // (now and then hands off long enough for the fuse to drop one: a release inside a step)
      await page.waitForTimeout(rand() < 0.35 ? 1100 : 120 + rand() * 200);
    }
    await page.waitForTimeout(600);
    const res = await page.evaluate(() => window.__la.done.concat(window.__la.cur ? [window.__la.cur] : []).map(x => {
      let first = -1;
      for (let i = 0; i < x.real.length; i++) if (x.pred[i] !== x.real[i]) { first = i; break; }
      return { rocked: x.rocked, n: x.real.length, first, end: x.end, d: first >= 0 ? x.pred[first] - x.real[first] : 0 };
    }));
    for (const x of res) {
      r.rel++;
      if (x.n < 30) continue;          // (a release right after another: nothing to compare)
      r.compared++; r.steps += x.n; r.ctx[x.rocked]++;
      if (x.first >= 0) r.bad.push(`step ${x.first}/${x.n} (${x.rocked ? 'between frames' : 'inside a step'}, Δθ ${x.d.toExponential(2)}, ended by ${x.end})`);
    }
  } finally { await context.close(); }
  return r;
}

function dynChecks(name, runs) {
  const dyn = runs.map(r => r.mon && r.mon.dyn).filter(Boolean);
  if (!dyn.length) return;
  const vTop = Math.max(...dyn.map(d => d.vTop)), sMax = Math.max(...dyn.map(d => d.sMax)), vTip = Math.max(...dyn.map(d => d.vTip));
  const n = dyn.reduce((a, d) => a + d.n, 0), nTip = dyn.reduce((a, d) => a + d.nTip, 0);
  check(`${name}: flex |s| <= 0.35 L`, sMax <= 0.35 + 1e-9, `max |s| ${sMax.toFixed(3)} L`);
  check(`${name}: top lateral speed <= 2.8 L/s (until past α)`, vTop <= 2.8 + 1e-6,
    `max ${vTop.toFixed(3)} L/s over ${n} steps; past α (uncapped, gravity takes over): ${nTip} steps, max ${vTip.toFixed(2)} L/s`);
  const pops = dyn.reduce((a, d) => a + d.pops, 0);
  check(`${name}: no visible debris piece ever vanishes (the cap drops only faded ones)`, pops === 0, `${pops} pops`);
  const saves = runs.flatMap(r => (r.mon && r.mon.saves || []).map(s => Object.assign({ seed: r.seed }, s)));
  if (saves.length) {
    const bad = saves.filter(s => s.inAir > 0 || s.level < 0.6 || (s.crashAfter !== null && !s.landedBetween));
    check(`${name}: every SAVE honest (nothing in the air, leaned >= 0.6 α, no crash within 2 s without a new landing)`, bad.length === 0,
      `${saves.length} saves; ${saves.filter(s => s.crashAfter !== null).length} followed by a crash within 2 s` +
      (bad.length ? '; BAD: ' + bad.map(s => `s${s.seed} t=${s.t} inAir ${s.inAir} lean ${s.level} crash +${s.crashAfter}`).join(', ') : ''));
  }
}
function debrisChecks(name, runs) {
  dynChecks(name, runs);
  const maxD = Math.max(0, ...runs.map(r => r.mon ? r.mon.maxDebris : 0));
  const checks = runs.flatMap(r => (r.mon ? r.mon.checks : []).map(c => Object.assign({ seed: r.seed }, c)));
  const bad = checks.filter(c => c.awake > 0);
  check(`${name}: debris count never above 60`, maxD <= 60, `max ${maxD}`);
  const worstC = checks.slice().sort((a, b) => (b.settle || 0) - (a.settle || 0))[0] || { settle: 0, slowest: '' };
  const worst = worstC.settle || 0;
  if (checks.length) check(`${name}: all debris asleep within 3 s of each crash`, bad.length === 0,
    `${checks.length - bad.length}/${checks.length} piles asleep, the slowest after ${worst.toFixed(2)} s (${worstC.slowest})` + (bad.length ? ' (awake: ' + bad.map(c => `seed ${c.seed} t=${c.t.toFixed(2)}: ${c.awake} [${c.what}]`).join(', ') + ')' : ''));
}

(async () => {
  const browser = await launch();
  try {
    if (want('calib')) {
      const { page, errors, context } = await openGame(browser, { seed: 1, level: 3 });
      const c = await page.evaluate(() => CS.calib());
      await context.close();
      const p = c.peaks;
      check('calib: bump peak 0.35 α ± 0.03 on the reference tower', c.calibrated && Math.abs(c.bumpPeak - 0.35) <= 0.03, `bump ${c.bumpPeak} α`);
      check('calib: CLACK 0.45 α, foot 0.5 α, PERFECT ≤ 0.10 α', Math.abs(p.clack - 0.45) <= 0.03 && Math.abs(p.foot - 0.5) <= 0.03 && p.perfect <= 0.10,
        `clack ${p.clack}, foot ${p.foot}, perfect ${p.perfect}; GREAT ${p.great} (target 0.25), CLACK flex ${p.clackFlex} L; K ${c.K.toFixed(1)}, Kf ${c.Kf.toFixed(3)}; ${c.ms} ms`);
      check('calib: no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    }
    if (want('perfect')) {
      const runs = [];
      for (const seed of SEEDS) {
        const r = await perfectBot(browser, seed);
        runs.push(r);
        log(`perfect seed ${seed}: top ${r.top.toFixed(2)} L in ${r.tiles} drops, ${r.perfect}/${r.lands} PERFECT, crashes ${r.crashes}, topples ${r.topples}, TIPPY dodged ${r.dodges}, HOLD swaps ${r.swaps}, TIPPY drops ${r.tippyDrops}, misses ${r.misses} (${r.thrown} thrown away), fuse drops ${r.fuse}, crown held ${r.crownHeld}`);
      }
      const ok = runs.filter(r => r.top >= 10 - 1e-9 && r.crashes === 0);
      check(`PerfectBot: reaches 10 L with zero crashes (level 3, ts=4)`, ok.length === runs.length,
        `${ok.length}/${runs.length}: ` + runs.map(r => `s${r.seed} ${r.top.toFixed(1)}L/${r.tiles}t${r.crashes ? ' CRASH' : ''}${r.topples ? ' topple' : ''}`).join(', '));
      const pr = runs.reduce((a, r) => a + r.perfect, 0), ln = runs.reduce((a, r) => a + r.lands, 0);
      console.log(`     (PERFECT on ${pr}/${ln} landings)`);
      debrisChecks('PerfectBot', runs);
      const errs = runs.flatMap(r => r.errors);
      check('PerfectBot: no page or console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    }
    if (want('perfect8')) {
      // the M3 guarantee on one car (the first one-car level since DESIGN 15.5 is 8): perfect, balance-greedy play
      // reaches 10 L with no crash (hazards, the fuse and the wobble off: the rock, tip and crash of M3 alone)
      const runs = [];
      for (const seed of SEEDS) {
        const r = await perfectBot(browser, seed, false, 8);
        runs.push(r);
        log(`perfect8 seed ${seed}: top ${r.top.toFixed(2)} L in ${r.tiles} drops, ${r.perfect}/${r.lands} PERFECT, crashes ${r.crashes}, topples ${r.topples}, TIPPY dodged ${r.dodges}, HOLD swaps ${r.swaps}, misses ${r.misses}`);
      }
      const ok = runs.filter(r => r.top >= 10 - 1e-9 && r.crashes === 0);
      check(`PerfectBot: reaches 10 L with zero crashes on one car (level 8, hazards, fuse and sway off, ts=4)`, ok.length === runs.length,
        `${ok.length}/${runs.length}: ` + runs.map(r => `s${r.seed} ${r.top.toFixed(1)}L/${r.tiles}t${r.crashes ? ' CRASH' : ''}${r.topples ? ' topple' : ''}`).join(', '));
      debrisChecks('PerfectBot (one car)', runs);
      const errs = runs.flatMap(r => r.errors);
      check('PerfectBot (one car): no page or console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    }
    if (LITERAL) {
      // report only: the bare rule of DESIGN 14 (no TIPPY veto, no HOLD) paints itself into corners the lattice
      // cannot get out of (both columns capped by triangle apexes, every supported slot on one side)
      const runs = [];
      for (const seed of SEEDS) { const r = await perfectBot(browser, seed, true); runs.push(r); log(`literal seed ${seed}: top ${r.top.toFixed(2)} L, ${r.tiles} drops, crashes ${r.crashes}`); }
      const ok = runs.filter(r => r.top >= 10 - 1e-9 && r.crashes === 0);
      console.log(`INFO literal PerfectBot (no TIPPY veto, no HOLD): ${ok.length}/${runs.length} reach 10 L with zero crashes: ` +
        runs.map(r => `s${r.seed} ${r.top.toFixed(1)}L${r.crashes ? ' CRASH' : ''}`).join(', '));
    }
    if (want('edge')) {
      const runs = [];
      for (const seed of SEEDS) {
        const r = await edgeBot(browser, seed, false);
        runs.push(r);
        log(`edge seed ${seed}: first crash after ${r.firstCrashAt} drops; crashes ${r.crashes.map(c => `${c.tiles} tiles top ${c.top.toFixed(1)} warned ${c.warnLead === null ? '-' : c.warnLead.toFixed(2) + ' s'} before`).join('; ')}`);
      }
      const within = runs.filter(r => r.firstCrashAt !== null && r.firstCrashAt <= 30);
      check('EdgeBot: crashes within 30 tiles', within.length === runs.length,
        `${within.length}/${runs.length}: ` + runs.map(r => `s${r.seed}:${r.firstCrashAt === null ? 'none' : r.firstCrashAt}`).join(' '));
      // (one way to fall, DESIGN 16.1: every crash is a tip, with the weight past a wheel)
      const all = runs.flatMap(r => r.crashes.map(c => Object.assign({ seed: r.seed }, c)));
      const warned = all.filter(c => c.warnLead !== null && c.warnLead >= 0.5 - 1e-6);
      check('EdgeBot: every crash (tipping over) preceded by tipwarn >= 0.5 s earlier, with the weight past a wheel', all.length > 0 && warned.length === all.length && all.every(c => c.past),
        `${warned.length}/${all.length}; leads ${all.map(c => c.warnLead === null ? 'none' : c.warnLead.toFixed(2)).join(' ')}; past ${all.filter(c => c.past).length}/${all.length}`);
      debrisChecks('EdgeBot', runs);
      const errs = runs.flatMap(r => r.errors);
      check('EdgeBot: no page or console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    }
    if (want('save')) {
      const runs = [];
      for (const seed of SEEDS) {
        const r = await edgeBot(browser, seed, true);
        runs.push(r);
        log(`save seed ${seed}: ${r.drops} drops, ${r.counters} counters, saves ${r.saves}, crashes ${r.crashes.length}`);
      }
      const saves = runs.reduce((a, r) => a + r.saves, 0);
      check('SaveBot: at least one save across the seeds', saves >= 1, `${saves} saves (` + runs.map(r => `s${r.seed}:${r.saves}`).join(' ') + `), ${runs.reduce((a, r) => a + r.counters, 0)} counterweights`);
      debrisChecks('SaveBot', runs);
      const errs = runs.flatMap(r => r.errors);
      check('SaveBot: no page or console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    }
    if (want('tippy')) {
      const runs = [];
      for (const seed of SEEDS) {
        const r = await tippyHonesty(browser, seed, 14);
        runs.push(r);
        log(`tippy seed ${seed} (level ${r.level}): safe ${r.ok}, TIPPY and crashed ${r.tp}, TIPPY but stood ${r.fp}, NOT TIPPY and crashed ${r.fn.length}, hazard crashes ${r.hazard}, skipped ${r.skipped}`);
      }
      const sum = k => runs.reduce((a, r) => a + (Array.isArray(r[k]) ? r[k].length : r[k]), 0);
      const fn = runs.flatMap(r => r.fn.map(x => `s${r.seed}: ${x}`));
      check('TIPPY: a drop whose ghost was not TIPPY never crashes the tower', fn.length === 0 && sum('ok') + sum('tp') >= 60,
        `${sum('ok')} safe drops stood, ${sum('tp')} TIPPY drops crashed, ${sum('fp')} TIPPY drops stood, ${fn.length} un-TIPPY drops crashed, ${sum('hazard')} crashed by a later bump/foot, ${sum('skipped')} skipped` + (fn.length ? ' (' + fn.slice(0, 4).join('; ') + ')' : ''));
      dynChecks('TIPPY runs', runs);
      const errs = runs.flatMap(r => r.errors);
      check('TIPPY: no page or console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
      // the look-ahead is the game's own future, step for step
      const ex = [];
      for (const [seed, level] of [[3, 3], [4, 7], [5, 3], [6, 7]]) { const x = await lookaheadExact(browser, seed, level, 18); ex.push(x); log(`lookahead seed ${seed} L${level}: ${x.compared}/${x.rel} releases compared over ${x.steps} steps, ${x.bad.length} diverged`); }
      const bad = ex.flatMap(x => x.bad.map(b => `s${x.seed} L${x.level} ${b}`)), comp = ex.reduce((a, x) => a + x.compared, 0);
      const between = ex.reduce((a, x) => a + x.ctx.true, 0), inside = ex.reduce((a, x) => a + x.ctx.false, 0);
      check('TIPPY: the look-ahead equals the real tower step for step (θ exactly) after every release, between frames and inside a step',
        bad.length === 0 && comp >= 40 && between >= 20 && inside >= 3,
        `${comp} releases compared over ${ex.reduce((a, x) => a + x.steps, 0)} steps (${between} clicked between frames, ${inside} dropped by the fuse inside a step)` + (bad.length ? '; DIVERGED: ' + bad.slice(0, 4).join('; ') : ''));
      const errs2 = ex.flatMap(x => x.errors);
      check('TIPPY: look-ahead runs: no page or console errors', errs2.length === 0, errs2.slice(0, 3).join(' | '));
    }
  } finally {
    await browser.close();
  }
  console.log(failures ? `BOTS: ${failures} check(s) failed` : 'BOTS: all checks passed');
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
