#!/usr/bin/env node
'use strict';
// M2 acceptance (DESIGN.md 14), driven only through real mouse / touch / keyboard events
// at positions read from CS.slots() and CS.cam().
//   node clack-stack/tools/feel.cjs            (all checks)
//   node clack-stack/tools/feel.cjs --quick    (fewer honesty releases)
//   node clack-stack/tools/feel.cjs --only=softlock,fuse,hitstop,audio   (just those sections; also mouse,touch,keys,honesty,stale)
// Checks:
//   1. a release exactly at a slot's sx lands PERFECT, 0.18-0.42 s (game time) after release   [mouse, touch tap, touch drag]
//   2. a release at sx + 0.18 L lands GREAT                                                      [mouse, touch tap]
//   3. a release far from every slot logs `miss`                                                 [mouse, touch tap]
//   4. state().handReady is true within 0.2 s (game time) of every release
//   5. keyboard: arrows slide the hand; Space drops; the detent makes a gold-ghost Space a PERFECT;
//      holding M (auto-repeat) toggles mute once
//   6. ghost honesty: 500 seeded random releases, many with two tiles in the air:
//      lastRelease.ghostKey == the landed key, every time; misses land nowhere. (M3: a tile still in the air when
//      the tower crashes is `lost` with it; such releases must coincide with a crash and are counted apart.)
//   7. no soft-locks: a dead end (no square/triangle slot anywhere) TOPPLEs and a new base takes tiles again
//   8. touch: a finger held past the fuse gives exactly one drop; its lift drops nothing
//      mouse: a click just after the fuse let go is spent (no blind second drop); a player's own early click is still held
//   9. ghost honesty inside a PERFECT hit-stop (the drawn ghost follows the hand while game time is frozen)
//  10. audio is running after the first touch / click / key under the default autoplay policy
//  11. the ghost never goes stale for a mouse player: click TAP on the title off-centre (and RESUME after a pause)
//      and press without moving: the drop goes to the ghost that was showing (CS.ghost() before = lastRelease after)
// Exits non-zero on any failure, page error or console error.
const { launch, gamePage, until } = require('./lib.cjs');

const QUICK = process.argv.includes('--quick');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = name => !ONLY.length || ONLY.includes(name);
const HONESTY_N = QUICK ? 120 : 500;
const PER_SESSION = 50;
const results = [];
let failures = 0;
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
}

// (M4: a level can end mid-run: the crown lands and the SMASH sweeps the build away; wait until play resumes on the
// next level's base, so the slot read here is still there when the finger comes down)
async function settle(page) {
  await until(page, () => { const s = CS.state(); return s.phase === 'play' && !s.locked && s.handReady && s.inAir === 0; }, null, 8000);
  // the tower calm again (a level's new base, or a rock after a CLACK), within the fuse
  await until(page, () => { const s = CS.state(); return s.still || s.t >= s.readyAt + 1.0; }, null, 4000).catch(() => {});
  // let the zoom finish easing, so the slot under the finger stays put between reading sx and the tap
  await until(page, () => new Promise(r => { const a = CS.cam().L; requestAnimationFrame(() => requestAnimationFrame(() => r(Math.abs(CS.cam().L - a) < 0.01))); }), null, 8000);
}
async function lastId(page) { return page.evaluate(() => (CS.lastRelease ? CS.lastRelease.id : 0)); }
async function waitRelease(page, prevId) { await until(page, id => CS.lastRelease && CS.lastRelease.id > id, prevId, 4000); return page.evaluate(() => CS.lastRelease); }
async function waitOutcome(page, id) {
  await until(page, i => CS.events.some(e => e.id === i && (e.type === 'land' || e.type === 'miss')), id, 4000);
  return page.evaluate(i => CS.events.find(e => e.id === i && (e.type === 'land' || e.type === 'miss')), id);
}
// slots that chooseSlot picks when the hand is exactly over them, and still picks 0.18 L to either side
// (a hanging slot only when no supported slot is within reach; same-class neighbours at least 0.45 L away)
async function cleanSlots(page) {
  return page.evaluate(() => {
    const st = CS.state(), crown = st.piece === 'crown', sl = CS.slots(), R = st.big ? (crown ? 1.6 : 1.0) : (crown ? 1.2 : 0.6);
    const ok = sl.filter(s => sl.every(o => o === s ||
      (o.supported && !s.supported ? Math.abs(o.x - s.x) > R + 0.3 : o.supported !== s.supported || Math.abs(o.x - s.x) > 0.45)));
    return ok.sort((a, b) => (b.supported - a.supported));
  });
}
async function farX(page) {
  return page.evaluate(() => {
    const sl = CS.slots(), c = CS.cam(), st = CS.state();
    let best = null, bd = -1;
    for (let px = 6; px <= c.W - 6; px += 2) {
      const xw = (px - c.originX) / c.L;
      const d = sl.length ? Math.min(...sl.map(s => Math.abs(s.x - xw))) : 99;
      if (d > bd) { bd = d; best = px; }
    }
    const crown = st.piece === 'crown';
    return { px: best, d: bd, R: st.big ? (crown ? 1.6 : 1.0) : (crown ? 1.2 : 0.6) };
  });
}

async function gradeTrials(page, input, tag) {
  // input(x, y) performs one real release at screen x
  let perfect = 0, perfectN = 0, great = 0, greatN = 0, timingBad = [], readyBad = [], keyBad = 0, dts = [], readys = [];
  for (let k = 0; k < 8; k++) {
    for (const mode of ['perfect', 'great']) {
      await settle(page);
      const slots = await cleanSlots(page);
      if (!slots.length) continue;
      const s = slots[(k * 5 + (mode === 'great' ? 3 : 0)) % slots.length];
      const L = await page.evaluate(() => CS.cam().L);
      const x = mode === 'perfect' ? s.sx : s.sx + 0.18 * L * (k % 2 ? -1 : 1);
      const prev = await lastId(page);
      await input(x, s.sy);
      const rel = await waitRelease(page, prev);
      const out = await waitOutcome(page, rel.id);
      const ready = await page.evaluate(() => { const st = CS.state(); return { ready: st.handReady, readyAt: st.readyAt }; });
      readys.push(ready.readyAt - rel.t);
      if (ready.readyAt - rel.t > 0.2 + 1e-6) readyBad.push((ready.readyAt - rel.t).toFixed(3));
      if (rel.ghostKey !== s.key || !out || out.key !== s.key) keyBad++;
      if (mode === 'perfect') {
        perfectN++;
        if (out && out.type === 'land' && out.grade === 'perfect') perfect++;
        const dt = out ? out.t - rel.t : -1;
        dts.push(dt);
        if (!(dt >= 0.18 - 1e-6 && dt <= 0.42 + 1e-6)) timingBad.push(dt.toFixed(3));
      } else {
        greatN++;
        if (out && out.type === 'land' && out.grade === 'great') great++;
        else console.log(`  ${tag} GREAT trial ${k}: target ${s.key} sx ${s.sx.toFixed(1)} tapped ${x.toFixed(1)}; released dx ${rel.dx == null ? 'miss' : rel.dx.toFixed(3)} on ${rel.ghostKey}, grade ${out ? out.grade || out.type : '?'}`);
      }
    }
  }
  check(`${tag}: release at sx lands PERFECT`, perfectN > 0 && perfect === perfectN, `${perfect}/${perfectN}`);
  check(`${tag}: PERFECT lands 0.18-0.42 s after release`, perfectN > 0 && timingBad.length === 0, (timingBad.length ? 'bad: ' + timingBad.join(',') + '; ' : '') + `measured ${Math.min(...dts).toFixed(3)}-${Math.max(...dts).toFixed(3)} s`);
  check(`${tag}: release at sx+0.18 L lands GREAT`, greatN > 0 && great === greatN, `${great}/${greatN}`);
  check(`${tag}: the tile lands in the slot that was targeted`, keyBad === 0, keyBad ? keyBad + ' mismatches' : '');
  check(`${tag}: hand ready within 0.2 s of release`, readyBad.length === 0, (readyBad.length ? 'late: ' + readyBad.join(',') + '; ' : '') + `max ${Math.max(...readys).toFixed(3)} s`);
}
async function missTrials(page, input, tag) {
  let miss = 0, n = 0;
  for (let k = 0; k < 3; k++) {
    await settle(page);
    const f = await farX(page);
    if (f.d < f.R + 0.15) continue;
    n++;
    const prev = await lastId(page);
    await input(f.px, 400);
    const rel = await waitRelease(page, prev);
    const out = await waitOutcome(page, rel.id);
    if (out && out.type === 'miss' && rel.ghostKey === null) miss++;
  }
  check(`${tag}: release far from every slot logs miss`, n > 0 && miss === n, `${miss}/${n}`);
}

async function honesty(browser) {
  let releases = 0, lands = 0, misses = 0, lost = 0, lostBad = 0, mismatched = 0, twoInAir = 0, buffered = 0, preGhostDiff = 0, preGhostN = 0, readyLate = 0;
  let first = '';
  const allErrors = [];
  for (let seed = 1; releases < HONESTY_N; seed++) {
    const { page, errors, context } = await gamePage(browser, { width: 390, height: 844 }, { seed, ts: 2, mute: 1, nohint: 1, autostart: 1 });
    try {
      await until(page, () => window.CS && CS.state().handReady);
      let rnd = seed * 7919;
      const rand = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
      const rels = [];
      for (let k = 0; k < PER_SESSION && releases < HONESTY_N; k++) {
        const quick = rand() < 0.5;                 // quick: click before the next tile arrives (buffered -> two in the air)
        // (M4: not while a SMASH or a new base locks releases: a press there is not a release to check)
        await until(page, () => { const s = CS.state(); return s.phase === 'play' && !s.locked; }, null, 8000);
        if (!quick) await until(page, () => CS.state().handReady, null, 4000);
        const info = await page.evaluate(() => ({ slots: CS.slots(), cam: CS.cam() }));
        let x;
        if (info.slots.length && rand() < 0.75) { const s = info.slots[(rand() * info.slots.length) | 0]; x = s.sx + (rand() - 0.5) * 0.9 * info.cam.L; }
        else x = 4 + rand() * (info.cam.W - 8);
        x = Math.max(1, Math.min(info.cam.W - 1, x));
        const prev = await lastId(page);
        await page.mouse.move(x, 420);
        let pre;
        if (!quick) pre = await page.evaluate(() => new Promise(r => requestAnimationFrame(() => { const g = CS.ghost(); r(g ? g.key : '-'); })));
        await page.mouse.down(); await page.mouse.up();
        const rel = await waitRelease(page, prev);
        releases++;
        rels.push(rel);
        if (rel.inAir >= 2) twoInAir++;
        if (quick) buffered++;
        if (pre !== undefined && pre !== '-') { preGhostN++; if (pre !== rel.ghostKey) preGhostDiff++; }
      }
      await until(page, () => CS.state().inAir === 0, null, 5000);
      const outs = await page.evaluate(ids => ids.map(id => CS.events.filter(e => e.id === id && (e.type === 'land' || e.type === 'miss' || e.type === 'lost'))
        .map(e => Object.assign({ crashNow: e.type === 'lost' && CS.events.some(c => c.type === 'crash' && c.t === e.t) }, e))), rels.map(r => r.id));
      rels.forEach((r, k) => {
        const ev = outs[k];
        if (ev.length !== 1) { mismatched++; if (!first) first = `release ${r.id} has ${ev.length} outcomes`; return; }
        const e = ev[0];
        if (e.type === 'lost') { lost++; if (!e.crashNow || e.key !== r.ghostKey) lostBad++; return; }
        if (e.type === 'land') lands++; else misses++;
        const landed = e.type === 'land' ? e.key : null;
        if (landed !== r.ghostKey) { mismatched++; if (!first) first = `release ${r.id}: ghost ${r.ghostKey} landed ${landed}`; }
        if (k > 0 && r.readyAt - rels[k - 1].t > 0.2 + 1e-6) readyLate++;
      });
      allErrors.push(...errors);
    } finally {
      await context.close();
    }
  }
  check(`honesty: ${releases} releases, lastRelease.ghostKey == landed key`, mismatched === 0 && lostBad === 0 && lands + misses + lost === releases,
    `lands ${lands}, misses ${misses}, lost in a crash ${lost}${lostBad ? ' (' + lostBad + ' not at a crash!)' : ''}, mismatches ${mismatched}${first ? ' (' + first + ')' : ''}`);
  check('honesty: many releases with two tiles in the air', twoInAir >= Math.min(100, releases * 0.25), `${twoInAir}/${releases} (${buffered} clicked before the hand was ready)`);
  check('honesty: hand ready within 0.2 s after every release', readyLate === 0, readyLate ? readyLate + ' late' : '');
  check('honesty: ghost shown just before a click == ghost locked at release', preGhostDiff <= Math.ceil(preGhostN * 0.01), `${preGhostN - preGhostDiff}/${preGhostN} identical`);
  check('honesty: no page or console errors', allErrors.length === 0, allErrors.slice(0, 3).join(' | '));
}

// 7. no soft-locks: a dead end (no square or triangle slot anywhere) must TOPPLE, a new base rolls in, and the build
//    takes tiles again. The bot never sees a settled, unlocked dead build.
//    (M3: the tower rocks and crashes now, so a random walk on one car crashes long before it finds a dead end.
//    The bot follows a short dead-end recipe instead, tapping each slot's live centre: the right shape goes to the
//    next recipe slot, HOLD banks or brings the right shape, anything else is thrown away at the screen edge.)
const DEAD_END = ['up:-2,0,0', 'sq:0,0,0', 'up:0,1,0', 'dn:-1,1,0', 'sq:-1,1,1', 'sq:1,1,1', 'sq:1,2,1', 'up:1,3,1', 'up:-1,2,1', 'dn:-2,2,1', 'up:-2,2,2'];
async function noSoftLock(browser) {
  const { page, errors, context } = await gamePage(browser, { width: 390, height: 844 }, { seed: 7, ts: 4, mute: 1, nohint: 1, autostart: 1, level: 3 });
  try {
    await until(page, () => window.CS && CS.state().handReady);
    // when each topple's new base takes drops again (game time)
    await page.evaluate(() => {
      window.__tp = []; let seen = 0;
      (function l() { const st = CS.state(), ev = CS.events;
        for (; seen < ev.length; seen++) if (ev[seen].type === 'topple') __tp.push({ t: ev[seen].t, unlock: null });
        for (const p of __tp) if (p.unlock === null && !st.locked && st.t > p.t) p.unlock = st.t;
        requestAnimationFrame(l); })();
    });
    const kind = p => (p === 'sq' || p === 'marble' ? 'sq' : p === 'tri' ? 'tri' : 'cube');
    let stuck = 0, drops = 0, maxDebris = 0, step = 0, resets = 0, diverged = 0, thrown = 0;
    for (let k = 0; k < 400; k++) {
      await until(page, () => { const s = CS.state(); return s.handReady && s.inAir === 0 && !s.locked; }, null, 8000);
      let info = await page.evaluate(() => ({ st: CS.state(), sl: CS.slots(), resets: CS.events.filter(e => e.type === 'topple' || e.type === 'crash').length,
        topples: CS.events.filter(e => e.type === 'topple').length,
        landsAfter: (() => { const t = CS.events.filter(e => e.type === 'topple').pop(); return t ? CS.events.filter(e => e.type === 'land' && e.t > t.t).length : 0; })() }));
      maxDebris = Math.max(maxDebris, info.st.debris);
      if (info.st.slotsLeft === 0) stuck++;
      if (info.topples >= 2 && info.landsAfter >= 3) break;
      if (info.resets > resets) { resets = info.resets; step = 0; }      // a new base: start the recipe again
      if (step >= DEAD_END.length) step = 0;
      const need = DEAD_END[step].startsWith('sq') ? 'sq' : 'tri';
      if (kind(info.st.piece) !== need && info.st.held !== null && kind(info.st.held) === need || kind(info.st.piece) !== need && info.st.held === null) {
        await page.keyboard.press('Shift');                         // HOLD brings the right shape, or banks this one
        info = await page.evaluate(() => ({ st: CS.state(), sl: CS.slots() }));
      }
      const target = kind(info.st.piece) === need ? info.sl.find(q => q.key === DEAD_END[step]) : null;
      await until(page, () => Math.abs(CS.state().omega) < 0.03 && Math.abs(CS.state().flexV) < 0.15, null, 400).catch(() => {});
      const x = target ? ((await page.evaluate(key => (CS.slots().find(q => q.key === key) || {}).sx, target.key)) || target.sx) : 4;
      if (!target) thrown++;
      const prev = await lastId(page);
      await page.mouse.move(x, 500); await page.mouse.down(); await page.mouse.up();
      drops++;
      if (target) {
        const rel = await waitRelease(page, prev);
        const out = await waitOutcome(page, rel.id);
        if (out && out.type === 'land' && out.key === target.key) step++;
        else { diverged++; step = DEAD_END.length; }                 // off the recipe: wait for the next reset
      }
    }
    await until(page, () => CS.state().inAir === 0, null, 8000);
    const r = await page.evaluate(() => {
      const ev = CS.events, tp = ev.filter(e => e.type === 'topple');
      return { topples: tp.length, gaps: tp.map((t, i) => {
        const before = ev.filter(e => e.type === 'land' && e.t <= t.t).pop(), after = ev.find(e => e.type === 'land' && e.t > t.t);
        return { fromLand: before ? t.t - before.t : null, unlock: __tp[i] && __tp[i].unlock !== null ? __tp[i].unlock - t.t : null, landed: !!after, tiles: t.tiles, top: t.top };
      }) };
    });
    const okGaps = r.gaps.every(g => g.fromLand !== null && g.fromLand < 0.6 && g.unlock !== null && g.unlock < 1.6 && g.landed);
    check('no soft-lock: dead ends TOPPLE and the new base takes tiles again', r.topples >= 1 && stuck === 0 && okGaps,
      `${drops} drops (${thrown} thrown away, ${diverged} off-recipe), ${r.topples} topples (${r.gaps.map(g => `top ${g.top.toFixed(1)} L, ${g.tiles} tiles, +${g.fromLand.toFixed(2)} s after the last clack, new base ready +${g.unlock === null ? '-' : g.unlock.toFixed(2)} s, ${g.landed ? 'takes tiles' : 'NO TILE LANDED'}`).join('; ')}); settled dead builds seen: ${stuck}`);
    check('topple: debris stays within the 60-piece cap', maxDebris <= 60, `max ${maxDebris}`);
    check('topple: no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally { await context.close(); }
}

// 8. one lift = at most one drop: a finger held past the fuse lets the fuse drop once; the lift then drops nothing
async function fuseHold(browser) {
  const { page, errors, context } = await gamePage(browser, { width: 390, height: 844 }, { seed: 61, ts: 2, mute: 1, nohint: 1, autostart: 1 }, { touch: true });
  try {
    await until(page, () => window.CS && CS.state().handReady);
    const cdp = await context.newCDPSession(page);
    const s1 = (await page.evaluate(() => CS.slots().filter(s => s.supported)))[0];
    await page.touchscreen.tap(s1.sx, 500);                        // the first drop arms the fuse
    await settle(page);
    const id0 = await lastId(page);
    const s2 = (await page.evaluate(() => CS.slots().filter(s => s.supported)))[0];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: s2.sx, y: 500, id: 1 }] });
    await until(page, id => CS.lastRelease && CS.lastRelease.id > id, id0, 6000);   // the fuse fires while the finger is down
    const mid = await page.evaluate(() => ({ id: CS.lastRelease.id, src: CS.lastRelease.src }));
    await until(page, () => CS.state().handReady, null, 4000);   // the next tile is in the hand
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(250);
    const afterLift = await lastId(page);
    await settle(page);
    const s3 = (await page.evaluate(() => CS.slots().filter(s => s.supported)))[0];
    await page.touchscreen.tap(s3.sx, 500);                        // a new touch drops again
    const rel = await waitRelease(page, afterLift);
    check('touch: a finger held past the fuse gives one drop (fuse), and its lift drops nothing',
      mid.id === id0 + 1 && mid.src === 'fuse' && afterLift === mid.id && rel.src === 'touch',
      `hold: ${mid.id - id0} release (${mid.src}); lift: ${afterLift - mid.id}; next tap: ${rel.src}`);
    check('fuse: no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally { await context.close(); }
}

// 8b. one action = at most one drop with the mouse too. A click that lands just after the fuse let go was meant for
//     the tile the fuse dropped: it must not be queued as a blind drop of the next tile. A player's OWN early click
//     (a second click during the 0.18 s refill after a click) is still held and drops when the tile arrives.
async function fuseClick(browser) {
  // level 4 (G = 7): the fuse drops never tear a ribbon here (M4: the crown and its SMASH would lock releases)
  const { page, errors, context } = await gamePage(browser, { width: 390, height: 844 }, { seed: 4, ts: 2, mute: 1, nohint: 1, autostart: 1, level: 4 });
  try {
    await until(page, () => window.CS && CS.state().handReady);
    // record the hand state at each real mousedown (capture phase, before the game sees it)
    await page.evaluate(() => { window.__downs = []; window.addEventListener('pointerdown', () => window.__downs.push(CS.state().handReady), true); });
    const s1 = (await page.evaluate(() => CS.slots().filter(s => s.supported)))[0];
    await page.mouse.move(s1.sx, 420); await page.mouse.down(); await page.mouse.up();      // the first drop arms the fuse
    await settle(page);
    let spentOk = 0, spentN = 0, lines = [];
    for (let k = 0; k < 3; k++) {
      await settle(page);
      const id0 = await lastId(page);
      await until(page, id => CS.lastRelease && CS.lastRelease.id > id, id0, 8000);     // the fuse lets go
      const fz = await page.evaluate(() => ({ id: CS.lastRelease.id, src: CS.lastRelease.src }));
      const n0 = await page.evaluate(() => window.__downs.length);
      await page.mouse.down(); await page.mouse.up();                                    // the slow player's click
      const wasReady = await page.evaluate(n => window.__downs[n], n0);
      await page.waitForTimeout(450);                                                    // 0.9 s game time: well past refill + PENDING_T
      const after = await lastId(page);
      const st = await page.evaluate(() => ({ ready: CS.state().handReady, ghost: !!CS.ghost() || CS.slots().length === 0 }));
      if (fz.src !== 'fuse' || wasReady !== false) { lines.push(`skip(${fz.src}, ready=${wasReady})`); continue; }
      spentN++;
      if (after === fz.id && st.ready) spentOk++;
      lines.push(`fuse#${fz.id} + click -> ${after - fz.id} extra`);
    }
    check('mouse: a click right after the fuse let go drops nothing (no blind second drop)', spentN > 0 && spentOk === spentN,
      `${spentOk}/${spentN}: ${lines.join('; ')}`);
    // a player's own double click: the second click falls in the refill and is held, then drops (src mouse)
    await settle(page);
    const id1 = await lastId(page);
    const n1 = await page.evaluate(() => window.__downs.length);
    await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(15);
    await page.mouse.down(); await page.mouse.up();
    const second = await page.evaluate(n => window.__downs[n + 1], n1);
    await until(page, id => CS.lastRelease && CS.lastRelease.id >= id + 2, id1, 3000).catch(() => {});
    const rel = await page.evaluate(() => CS.lastRelease);
    check('mouse: a player\'s early click during the refill is still held and drops when the tile arrives',
      rel.id === id1 + 2 && rel.src === 'mouse' && second === false, `${rel.id - id1} release(s), 2nd click handReady=${second}, src ${rel.src}`);
    check('fuse click: no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally { await context.close(); }
}

// 9. the ghost never goes stale: move to another slot inside a PERFECT hit-stop (ts slowed so a real move fits in it);
//    the ghost drawn then is the slot the click locks
async function hitStopGhost(browser) {
  const { page, errors, context } = await gamePage(browser, { width: 390, height: 844 }, { seed: 4, ts: 0.15, mute: 1, nohint: 1, autostart: 1 });
  try {
    await until(page, () => window.CS && CS.state().handReady, null, 20000);
    let n = 0, inside = 0, same = 0;
    const lines = [];
    for (let k = 0; k < 3; k++) {
      await until(page, () => CS.state().handReady && CS.state().inAir === 0, null, 30000);
      const sl = await page.evaluate(() => CS.slots().filter(s => s.supported).sort((a, b) => a.sx - b.sx));
      const prev = await lastId(page);
      await page.mouse.move(sl[0].sx, 300); await page.mouse.down(); await page.mouse.up();          // PERFECT on the leftmost slot
      const rel1 = await waitRelease(page, prev);
      await until(page, id => CS.events.some(e => e.id === id && e.type === 'land'), rel1.id, 30000);
      const sl2 = await page.evaluate(() => CS.slots().filter(s => s.supported).sort((a, b) => a.sx - b.sx));
      await page.mouse.move(sl2[sl2.length - 1].sx, 300);                                              // aim far right during the freeze
      const shown = await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() =>
        r({ hs: FX.hitStop, key: CS.ghost() && CS.ghost().key })))));
      await page.mouse.down(); await page.mouse.up();
      const rel2 = await waitRelease(page, rel1.id);
      n++; if (shown.hs > 0) inside++; if (shown.key === rel2.ghostKey) same++;
      lines.push(`${shown.key}${shown.hs > 0 ? ' (in hit-stop)' : ''} -> ${rel2.ghostKey}`);
    }
    check('ghost honesty in a hit-stop: the ghost shown after a move == the slot the click locks', n > 0 && same === n && inside > 0,
      `${same}/${n} identical, ${inside} inside the freeze: ${lines.join('; ')}`);
    check('hit-stop: no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally { await context.close(); }
}

// 11. a mouse that clicks TAP (or RESUME) off-centre and then presses without moving drops into the ghost it saw
async function staleGhost(browser) {
  const { page, errors, context } = await gamePage(browser, { width: 844, height: 390 }, { seed: 12, mute: 1, nohint: 1 }, { realClock: true });
  try {
    await page.waitForTimeout(300);
    const tap = await page.evaluate(() => ({ y: CAM.tapY }));
    await page.mouse.click(515, tap.y);
    await until(page, () => CS.state().phase === 'play' && CS.state().handReady && !CS.state().locked, null, 5000);
    await page.waitForTimeout(150);
    const a = await page.evaluate(() => ({ g: CS.ghost(), hx: CS.cam().handX }));
    const id0 = await lastId(page);
    await page.mouse.down(); await page.mouse.up();
    const ra = await waitRelease(page, id0);
    check('stale: after the title tap at x 515 (off-centre, over a slot), a press without moving drops into the ghost shown', ra.ghostKey === (a.g && a.g.key) && Math.abs(a.hx - 515) < 1 && !!(a.g && a.g.key),
      `hand at ${a.hx.toFixed(0)}, ghost ${a.g && a.g.key}, dropped into ${ra.ghostKey}`);
    // pause, then RESUME clicked near its left end, then a press without moving
    await until(page, () => CS.state().handReady && CS.state().inAir === 0, null, 4000);
    await page.keyboard.press('p');
    await until(page, () => CS.state().phase === 'paused', null, 2000);
    const r = await page.evaluate(() => CS.ui().resume);
    const rx = r.x + 18;
    await page.mouse.move(rx, r.y + r.h / 2);
    await page.mouse.down(); await page.mouse.up();
    await until(page, () => CS.state().phase === 'play' && CS.state().handReady, null, 3000);
    await page.waitForTimeout(150);
    const b = await page.evaluate(() => ({ g: CS.ghost(), hx: CS.cam().handX }));
    const id1 = await lastId(page);
    await page.mouse.down(); await page.mouse.up();
    const rb = await waitRelease(page, id1);
    check('stale: after RESUME clicked at its left end, a press without moving drops into the ghost shown', rb.ghostKey === (b.g && b.g.key) && Math.abs(b.hx - rx) < 1,
      `hand at ${b.hx.toFixed(0)} (resume clicked at ${rx.toFixed(0)}), ghost ${b.g && b.g.key}, dropped into ${rb.ghostKey}`);
    check('stale: no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally { await context.close(); }
}

// 10. audio starts on the FIRST gesture of each kind under Chromium's default autoplay policy
//     (a touch pointerdown is not a user activation; the lift is)
async function audioUnlock() {
  const { pw } = require('./lib.cjs');
  const browser = await pw.chromium.launch();     // default autoplay policy, unlike launch()
  try {
    for (const mode of ['touch', 'mouse', 'keys']) {
      const { page, errors, context } = await gamePage(browser, { width: 390, height: 844 }, { seed: 2, nohint: 1, mute: 1 }, { touch: mode === 'touch' });
      try {
        await page.waitForTimeout(200);
        if (mode === 'touch') await page.touchscreen.tap(195, 600);
        else if (mode === 'mouse') await page.mouse.click(195, 600);
        else await page.keyboard.press('Space');
        let st = 'none';
        try { await until(page, () => CS.audio().state === 'running', null, 1500); st = 'running'; } catch (e) { st = await page.evaluate(() => CS.audio().state); }
        // (M4: the tap starts the title shove; play follows within 1.2 s)
        await until(page, () => CS.state().phase === 'play', null, 1500).catch(() => {});
        const phase = await page.evaluate(() => CS.state().phase);
        check(`audio: running after the first ${mode} gesture (default autoplay policy)`, st === 'running' && phase === 'play' && errors.length === 0,
          `${st}, ${phase}${errors.length ? ', ' + errors[0] : ''}`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}

(async () => {
  const browser = await launch();
  try {
    // mouse, portrait (longest falls)
    if (want('mouse')) {
      const { page, errors, context } = await gamePage(browser, { width: 390, height: 844 }, { seed: 11, mute: 1, nohint: 1, autostart: 1 });
      await until(page, () => window.CS && CS.state().handReady);
      const mouse = async x => { await page.mouse.move(x, 420); await page.mouse.down(); await page.mouse.up(); };
      await gradeTrials(page, mouse, 'mouse 390x844');
      await missTrials(page, mouse, 'mouse 390x844');
      check('mouse: no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
      await context.close();
    }
    // touch, landscape phone: taps, plus one finger-down-far-away / drag / lift
    if (want('touch')) {
      const { page, errors, context } = await gamePage(browser, { width: 844, height: 390 }, { seed: 12, mute: 1, nohint: 1, autostart: 1 }, { touch: true });
      await until(page, () => window.CS && CS.state().handReady);
      const tap = async x => { await page.touchscreen.tap(x, 300); };
      await gradeTrials(page, tap, 'touch 844x390');
      await missTrials(page, tap, 'touch 844x390');
      // drag: finger down at the far left, slide to a slot, lift -> PERFECT there
      const cdp = await context.newCDPSession(page);
      let dragOk = 0, dragN = 0;
      for (let k = 0; k < 3; k++) {
        await settle(page);
        const slots = await cleanSlots(page);
        if (!slots.length) continue;
        const s = slots[k % slots.length];
        dragN++;
        const prev = await lastId(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 20, y: 330 }] });
        for (let j = 1; j <= 6; j++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 20 + (s.sx - 20) * j / 6, y: 330 - j * 10 }] });
          await page.waitForTimeout(16);
        }
        const mid = await page.evaluate(() => CS.lastRelease ? CS.lastRelease.id : 0);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        const rel = await waitRelease(page, prev);
        const out = await waitOutcome(page, rel.id);
        if (mid === prev && out && out.type === 'land' && out.grade === 'perfect' && out.key === s.key) dragOk++;
      }
      check('touch: finger down anywhere, drag, lift drops a PERFECT where lifted', dragN > 0 && dragOk === dragN, `${dragOk}/${dragN}`);
      // a cancelled touch never drops
      {
        await settle(page);
        const prev = await lastId(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 330 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        await page.waitForTimeout(300);
        check('touch: touchcancel never drops', (await lastId(page)) === prev);
      }
      check('touch: no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
      await context.close();
    }
    // keyboard: slide, detent, space
    if (want('keys')) {
      const { page, errors, context } = await gamePage(browser, { width: 1366, height: 1024 }, { seed: 13, mute: 1, nohint: 1, autostart: 1 });
      await until(page, () => window.CS && CS.state().handReady);
      await page.mouse.move(10, 500);               // park the hand at the far left
      await page.waitForTimeout(50);
      const x0 = await page.evaluate(() => HAND.x);
      await page.keyboard.down('ArrowRight'); await page.waitForTimeout(250); await page.keyboard.up('ArrowRight');
      const x1 = await page.evaluate(() => HAND.x);
      const L = await page.evaluate(() => CS.cam().L);
      check('keys: ArrowRight slides the hand (~10 L/s)', x1 - x0 > 1.2 * L && x1 - x0 < 3.2 * L, `${((x1 - x0) / L).toFixed(2)} L in 0.25 s`);
      // detent: slide right from the far left; Space as soon as the ghost turns gold -> PERFECT
      let detOk = 0, detN = 0;
      for (let k = 0; k < 4; k++) {
        await settle(page);
        await page.mouse.move(5 + k, 500);
        await page.waitForTimeout(40);
        const prev = await lastId(page);
        await page.keyboard.down('ArrowRight');
        try { await until(page, () => { const g = CS.ghost(); return g && g.color === 'gold' && g.supported; }, null, 3000); } catch (e) { await page.keyboard.up('ArrowRight'); continue; }
        detN++;
        await page.keyboard.press('Space');
        await page.keyboard.up('ArrowRight');
        const rel = await waitRelease(page, prev);
        const out = await waitOutcome(page, rel.id);
        if (out && out.type === 'land' && out.grade === 'perfect' && rel.src === 'key') detOk++;
      }
      check('keys: detent holds the hand in the PERFECT window; Space lands PERFECT', detN > 0 && detOk === detN, `${detOk}/${detN}`);
      // holding M: the first keydown toggles mute, the auto-repeats do nothing
      {
        const m0 = await page.evaluate(() => CS.audio().muted);
        for (let j = 0; j < 4; j++) { await page.keyboard.down('m'); await page.waitForTimeout(20); }   // 1 press + 3 auto-repeats
        await page.keyboard.up('m');
        const m1 = await page.evaluate(() => CS.audio().muted);
        let pref = null;
        try { pref = await page.evaluate(() => JSON.parse(localStorage.getItem('clackstack.prefs')).mute); } catch (e) { /* file:// storage may be off */ }
        await page.keyboard.press('m');
        const m2 = await page.evaluate(() => CS.audio().muted);
        check('keys: holding M toggles mute once (auto-repeat ignored); a new press toggles back',
          m1 === !m0 && m2 === m0 && (pref === null || pref === m1), `muted ${m0} -> held ${m1} (prefs ${pref}) -> pressed ${m2}`);
      }
      check('keys: no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
      await context.close();
    }
    if (want('honesty')) await honesty(browser);
    if (want('softlock')) await noSoftLock(browser);
    if (want('fuse')) { await fuseHold(browser); await fuseClick(browser); }
    if (want('hitstop')) await hitStopGhost(browser);
    if (want('stale')) await staleGhost(browser);
  } finally {
    await browser.close();
  }
  if (want('audio')) await audioUnlock();
  console.log(failures ? `FEEL: ${failures} check(s) failed` : 'FEEL: all checks passed');
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
