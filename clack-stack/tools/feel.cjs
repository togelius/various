#!/usr/bin/env node
'use strict';
// M2 acceptance (DESIGN.md 14), driven only through real mouse / touch / keyboard events
// at positions read from CS.slots() and CS.cam().
//   node clack-stack/tools/feel.cjs            (all checks)
//   node clack-stack/tools/feel.cjs --quick    (fewer honesty releases)
//   node clack-stack/tools/feel.cjs --only=softlock,fuse,hitstop,audio   (just those sections; also mouse,touch,keys,honesty,stale,streak,pops)
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
//   7. no soft-locks: a dead end (no square/triangle slot anywhere) TOPPLEs and a new base takes tiles again (on one car:
//      level 8, hazards off; DESIGN 15.5 moved the one-car base there from level 3; the wobble off, 15.3: the recipe's
//      narrow build would SNAP first)
//   8. touch: a finger held past the fuse gives exactly one drop; its lift drops nothing
//      mouse: a click just after the fuse let go is spent (no blind second drop); a player's own early click is still held
//   9. ghost honesty inside a PERFECT hit-stop (the drawn ghost follows the hand while game time is frozen)
//  10. audio is running after the first touch / click / key under the default autoplay policy
//  11. the ghost never goes stale for a mouse player: click TAP on the title off-centre (and RESUME after a pause)
//      and press without moving: the drop goes to the ghost that was showing (CS.ghost() before = lastRelease after)
//  12. never a dead piece: a one-car base (level 8, hazards off) capped with two up-triangles has no square slot anywhere; whatever the bag
//      deals, every tile that reaches the hand has a slot (the hand takes a triangle instead of the square), so no
//      MISS is ever forced, then 20 more drops
//  13. a crash or a TOPPLE: the hand flinches up out of the burst (never down into it) and stays up until the new car
//      has parked
//  14. the new base parks clear of the pile: 2.5 s after it has parked (after crashes on one car, the long car and two
//      cars, at 390x844 and 844x390) no piece
//      of the mess shows over the car (its plate and wheels) or within 0.5 L of its ends; the old car has faded
//  15. (with 7) a TOPPLE is told first: every topple comes 0.3-0.6 s after its 'toppletell' (the clack that closed the
//      last slot); through the tell the "NO ROOM!" sign is drawn on screen clear of the tile in the hand and the
//      ribbon's label, the build shivers (its drawn offset changes from frame to frame), the creak is fed at >= 0.6
//      and nothing is released (the sign's letters at least 0.85 of a "+25"'s on a landscape phone too); the TOPPLE!
//      word then pops alone (no landing word left under it), clear of the hand and
//      the tile in it as the hand flinches up
//  16. the PERFECT streak (--only=streak; a bot taps the PERFECT centre of the most central safe slot, 390x844 touch):
//      milestones at 5, 10, 20 (30 if reached) each log one 'streak' event and pop their word ("ON FIRE!",
//      "UNSTOPPABLE!", "MAGNET MASTER!", "LEGENDARY!") with Sfx.streak(tier 1..4); the PERFECT word grows and warms
//      with the streak (bigger and redder at 8+ in a row than at 1); every PERFECT clack passes its streak to Sfx.clack
//      (the ting climbs); the word-pop rules hold all the way (lib wordMonitor); and the landing pops (the milestones,
//      placed as big as they can be first, aside) sit by the landing: most of them placed by the near search, their
//      median centre within 3.5 L of the tile that landed
//  17. a landing-pop soak (--only=pops; 390x844 touch, two seeded games of 160 drops each at a quick human pace: most
//      taps at the PERFECT centre of a central safe slot, some anywhere on a slot, a few anywhere): the word-pop rules
//      hold for every pop (lib wordMonitor: never born over the ghost or the build top, never drawn over the ghost,
//      clear of the HUD and the pops still up); no landing's word covers its own "+N" score pop (at most 1 in 100 more
//      than a quarter of it); a streak milestone is never fitted smaller than the size it was placed at, nor drawn smaller
//      than the median PERFECT; most words placed by the near search; never two landing words drawn over each other
//  18. (with 17) streak milestones on short landscape phones: a PERFECT bot to a streak of 30 at 844x390 and 667x375;
//      every 'streak' event pops its word, on screen and not see-through, at least as big as the median PERFECT of
//      that game (one on the landing that tears the ribbon or crowns, sharing the screen with that announcement: at
//      least 0.9 of it); the word-pop rules hold all the way
// Exits non-zero on any failure, page error or console error.
const { launch, gamePage, until, wordMonitor } = require('./lib.cjs');

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
  await until(page, () => { const s = CS.state(); return s.phase === 'play' && !s.locked && s.handReady && s.inAir === 0 && !s.crownGrace; }, null, 8000);
  // the tower calm again (a level's new base, or a rock after a CLACK), within the fuse
  await until(page, () => { const s = CS.state(); return s.still || s.t >= s.readyAt + 1.0; }, null, 4000).catch(() => {});
  // let the zoom finish easing, so the slot under the finger stays put between reading sx and the tap
  await until(page, () => new Promise(r => { const a = CS.cam().L; requestAnimationFrame(() => requestAnimationFrame(() => r(Math.abs(CS.cam().L - a) < 0.01))); }), null, 8000);
}
async function lastId(page) { return page.evaluate(() => (CS.lastRelease ? CS.lastRelease.id : 0)); }
// DESIGN 15.5: a one-car (2 L) base comes only from level 8, which has the bump car and the foot. The checks built on
// one car (the dead end, the dead piece, the pile) play level 8 with its hazards switched off for the level, so a
// bump or a stomp never decides them
const ONE_CAR = 8;
async function noHazards(page) { await page.evaluate(() => { HZ.every = 0; HZ.kind = ''; HZ.warned = false; }); }
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
        // (nor in the crown's first moments in the hand: CROWN_GRACE drops a press then, 15.6)
        await until(page, () => { const s = CS.state(); return s.phase === 'play' && !s.locked && !s.crownGrace; }, null, 8000);
        if (!quick) await until(page, () => CS.state().handReady, null, 4000);
        const info = await page.evaluate(() => ({ slots: CS.slots(), cam: CS.cam() }));
        let x;
        if (info.slots.length && rand() < 0.75) { const s = info.slots[(rand() * info.slots.length) | 0]; x = s.sx + (rand() - 0.5) * 0.9 * info.cam.L; }
        else x = 4 + rand() * (info.cam.W - 8);
        x = Math.max(1, Math.min(info.cam.W - 1, x));
        const prev = await lastId(page);
        await page.mouse.move(x, 420);
        const tPress = await page.evaluate(() => S.gt);
        let pre;
        if (!quick) pre = await page.evaluate(() => new Promise(r => requestAnimationFrame(() => { const g = CS.ghost(); r(g ? g.key : '-'); })));
        await page.mouse.down(); await page.mouse.up();
        // (a press in the crown's first CROWN_GRACE s in the hand, the crown having come with the landing of the tile
        // that tore the ribbon, is dropped by design (15.6: no tap already on its way places the crown). Not a
        // release, not counted)
        const rel = await waitRelease(page, prev).catch(async e => {
          if (await page.evaluate(t => { const s = CS.state(); return s.crownInHand && s.crownAt >= t - CFG.CROWN_GRACE && s.crownAt <= t + 0.1; }, tPress)) return null;
          throw e;
        });
        if (!rel) continue;
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
  const { page, errors, context } = await gamePage(browser, { width: 390, height: 844 }, { seed: 7, ts: 4, mute: 1, nohint: 1, autostart: 1, level: ONE_CAR });
  try {
    await until(page, () => window.CS && CS.state().handReady);
    await noHazards(page);
    // (DESIGN 15.3: the recipe's narrow build SNAPs long before it closes its last slot (a 1-wide spire of two squares
    // has λ 3 to 5). This check is the dead end's TOPPLE, not the wobble (tools/wobble.cjs): the wobble is off here, a
    // test fixture)
    await page.evaluate(() => { CFG.WOB_A = { perfect: 0, great: 0, clack: 0 }; });
    // when each topple's new base takes drops again (game time)
    await page.evaluate(() => {
      window.__tp = []; let seen = 0;
      (function l() { const st = CS.state(), ev = CS.events;
        for (; seen < ev.length; seen++) if (ev[seen].type === 'topple') __tp.push({ t: ev[seen].t, unlock: null });
        for (const p of __tp) if (p.unlock === null && !st.locked && st.t > p.t) p.unlock = st.t;
        requestAnimationFrame(l); })();
      // 15. the tell, every frame of it: the sign, the shiver, the creak, and no release
      const T = window.__tell = { frames: 0, signFrames: 0, overHand: 0, offScreen: 0, overLabel: 0, dxs: new Set(), creakMax: 0, released: 0, creakNow: 0,
        topFrames: 0, topWords: 0, topOverWord: [], topOverHand: [] };
      const cr = Sfx.creak;
      Sfx.creak = function (v) { T.creakNow = v; return cr.apply(this, arguments); };
      let relId = -1;
      (function m() {
        try {
          const st = CS.state();
          if (st.phase === 'play' && st.tell > 0) {
            T.frames++;
            const tl = CS.tell(), cam = CS.cam(), L = cam.L;
            if (tl) {
              T.signFrames++; T.dxs.add(Math.round(tl.dx * 100));
              const b = tl.box, hx = cam.handX;
              if (b.x0 < hx + 0.6 * L && b.x1 > hx - 0.6 * L && b.y0 < cam.handY + 1.2 * L && b.y1 > cam.handY - 0.8 * L) T.overHand++;
              if (b.x0 < 0 || b.x1 > cam.W || b.y0 < 0 || b.y1 > cam.H) T.offScreen++;
              const lb = CS.ribbon().label;
              if (lb && b.x0 < lb.x1 && b.x1 > lb.x0 && b.y0 < lb.y1 && b.y1 > lb.y0) T.overLabel++;
            }
            if (T.creakNow > T.creakMax) T.creakMax = T.creakNow;
            const id = CS.lastRelease ? CS.lastRelease.id : 0;
            if (relId >= 0 && id !== relId) T.released++;
            relId = id;
          } else relId = -1;
          // the TOPPLE! word, its first 0.35 s: no other landing word still showing under it, clear of the hand and the
          // tile in it (the hand flinching up past it included)
          const tp = CS.events.filter(e => e.type === 'topple').pop();
          if (tp && st.t - tp.t >= 0 && st.t - tp.t < 0.35) {
            T.topFrames++;
            const cam = CS.cam(), L = cam.L, ws = FX.words.filter(w => w.kind === 'word' && w.x1 && S.gt - w.t0 <= w.life);
            const vis = w => { const u = (S.gt - w.t0) / w.life; return (u < 0.6 ? 1 : Math.max(0, 1 - (u - 0.6) / 0.4)) * (w.dim ? 0.25 : 1) > 0.1; };
            const tw = ws.find(w => w.text === 'TOPPLE!');
            if (tw) {
              T.topWords++;
              for (const o of ws) if (o !== tw && vis(o) && o.x0 < tw.x1 && tw.x0 < o.x1 && o.y0 < tw.y1 && tw.y0 < o.y1 && T.topOverWord.length < 4) T.topOverWord.push(o.text + ' at +' + (st.t - tp.t).toFixed(2));
              const hx = cam.handX;
              if (HAND.piece && tw.x0 < hx + 0.6 * L && tw.x1 > hx - 0.6 * L && tw.y0 < cam.handY + 1.2 * L && tw.y1 > cam.handY - 0.8 * L && T.topOverHand.length < 4) T.topOverHand.push('+' + (st.t - tp.t).toFixed(2));
            }
          }
        } catch (e) { /* booting */ }
        requestAnimationFrame(m);
      })();
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
    // 15. the tell before each topple
    const tell = await page.evaluate(() => {
      const ev = CS.events, tp = ev.filter(e => e.type === 'topple');
      const T = window.__tell;
      return { leads: tp.map(t => { const tt = ev.filter(e => e.type === 'toppletell' && e.t <= t.t).pop(); return tt ? +(t.t - tt.t).toFixed(3) : null; }),
        frames: T.frames, signFrames: T.signFrames, overHand: T.overHand, offScreen: T.offScreen, overLabel: T.overLabel, shiver: T.dxs.size, creakMax: +T.creakMax.toFixed(2), released: T.released,
        topFrames: T.topFrames, topWords: T.topWords, topOverWord: T.topOverWord, topOverHand: T.topOverHand };
    });
    check('topple: every TOPPLE is told 0.3-0.6 s ahead (toppletell at the clack that closes the last slot)',
      tell.leads.length >= 1 && tell.leads.every(l => l !== null && l >= 0.3 - 1e-6 && l <= 0.6), `leads ${tell.leads.join(' ')} s`);
    check('topple: through the tell the NO ROOM! sign shows on screen clear of the tile in the hand and the ribbon\'s label, the build shivers, it creaks (>= 0.6), nothing is released',
      tell.frames > 0 && tell.signFrames >= tell.frames - 1 && tell.overHand === 0 && tell.offScreen === 0 && tell.overLabel === 0 && tell.shiver >= Math.min(4, tell.frames) && tell.creakMax >= 0.6 && tell.released === 0,
      JSON.stringify(Object.assign({}, tell, { topFrames: undefined, topWords: undefined, topOverWord: undefined, topOverHand: undefined })));
    check('topple: the TOPPLE! word pops alone (the landing word under it gone) and clear of the hand and the tile in it as the hand flinches up',
      tell.topFrames > 0 && tell.topWords >= tell.topFrames - 2 && tell.topOverWord.length === 0 && tell.topOverHand.length === 0,
      `${tell.topWords}/${tell.topFrames} frames with the word; over a word: ${tell.topOverWord.join(', ') || 'none'}; over the hand: ${tell.topOverHand.join(', ') || 'none'}`);
    check('topple: no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally { await context.close(); }
  // the sign on a landscape phone (the build zoomed small there, the words not): its letters at least 0.85 of a
  // landing's "+25", the plate taller than it
  const sizes = [];
  for (const view of [{ width: 844, height: 390 }, { width: 667, height: 375 }, { width: 390, height: 844 }]) {
    const g = await gamePage(browser, view, { seed: 7, mute: 1, nohint: 1, autostart: 1, level: 3 });
    try {
      await until(g.page, () => window.CS && CS.state().handReady, null, 15000);
      // (a 5-row column, as tall as the dead end's build: the camera zooms out to it)
      await g.page.evaluate(() => {
        for (let a = 0; a < 5; a++) for (const i of [-2, 0]) {
          const c = S.B.cands.find(q => q.key === 'sq:' + i + ',' + a + ',0');
          if (c) { addTile(S.B, c.pose, { shape: 'sq', color: 'blue', variant: 0, mass: 1, k: 1 / 6, depth: c.depth, flight: false, landT: -1 }); genSlots(S.B); }
        }
        recomputeTower(); massProps(S.B, true, COMMIT);
      });
      await g.page.waitForTimeout(1500);
      sizes.push(await g.page.evaluate(() => { tellPlace(); const score = clamp(CAM.W / 15, 20, 36) * 0.72; return { W: CAM.W, H: CAM.H, L: +CAM.L.toFixed(1), fs: TELL.fs, h: Math.round(TELL.h), score: +score.toFixed(1) }; }));
    } finally { await g.context.close(); }
  }
  check('topple: the NO ROOM! sign reads on a phone, landscape too (letters >= 0.85 of a "+25" score pop\'s, the plate taller than it)',
    sizes.every(z => z.fs >= 0.85 * z.score && z.h > z.score), sizes.map(z => `${z.W}x${z.H} (L ${z.L}): ${z.fs} px on a ${z.h} px plate, "+25" ${z.score} px`).join('; '));
}

// 16. the PERFECT streak: milestones, escalation, the climbing ting, and landing pops by the landing (390x844 touch)
async function streakRun(browser) {
  const { page, errors, context } = await gamePage(browser, { width: 390, height: 844 }, { seed: 2, mute: 1, nohint: 1, autostart: 1, level: 1 }, { touch: true });
  try {
    await until(page, () => window.CS && CS.state().handReady && !CS.state().locked);
    await page.evaluate(wordMonitor);
    await page.evaluate(() => {
      const R = window.__sk = { streakCalls: [], clacks: [], words: [] };
      const st = Sfx.streak, cl = Sfx.clack;
      Sfx.streak = function (n) { R.streakCalls.push({ n, t: CS.state().t }); return st.apply(this, arguments); };
      Sfx.clack = function (o) { if (o && o.grade === 'perfect') R.clacks.push({ streak: o.streak, now: CS.state().streak }); return cl.apply(this, arguments); };
      // every landing word, the frame it first shows: its text, size, colour, centre, near flag, and the tile it is for
      const seen = new Set();
      (function f() {
        try {
          const now = CS.state().t;
          for (const w of CS.words()) {
            if (w.kind !== 'word') continue;
            const id = w.text + '@' + (now - w.age).toFixed(4);
            if (seen.has(id)) continue;
            seen.add(id);
            const land = CS.events.filter(e => e.type === 'land').pop(), L = CS.cam().L;
            const tile = land ? CS.tiles().find(t => t.key === land.key) : null;
            R.words.push({ text: w.text, sub: w.sub, size: w.size, color: w.color, near: w.near, streak: CS.state().streak, x: w.x, y: w.y,
              dist: tile ? Math.hypot(w.x - tile.sx, w.y - tile.sy) / L : null, landT: land ? land.t : null, age: w.age });
          }
        } catch (e) { /* booting */ }
        requestAnimationFrame(f);
      })();
    });
    let maxStreak = 0;
    for (let k = 0; k < 140; k++) {
      await until(page, () => { const s = CS.state(); return s.phase === 'over' || (s.phase === 'play' && s.handReady && !s.locked && s.inAir === 0); }, null, 20000);
      if ((await page.evaluate(() => CS.state().phase)) === 'over') break;
      await until(page, () => Math.abs(CS.state().omega) < 0.02 && Math.abs(CS.state().flexV) < 0.1, null, 1500).catch(() => {});
      const info = await page.evaluate(() => ({ st: CS.state(), sl: CS.slots() }));
      maxStreak = Math.max(maxStreak, info.st.streak);
      if (maxStreak >= 30 && info.st.streak === 0) break;
      const ok = info.sl.filter(q => !q.tippy && (q.supported || info.st.piece === 'crown'));
      const pool = ok.length ? ok : info.sl;
      if (!pool.length) { await page.keyboard.press('Shift'); continue; }
      pool.sort((a, b) => Math.abs(a.x) - Math.abs(b.x) + (b.supported - a.supported) * 10);
      const prev = await lastId(page);
      const sx = await page.evaluate(key => (CS.slots().find(q => q.key === key) || {}).sx, pool[0].key);
      if (sx === undefined) continue;
      await page.touchscreen.tap(sx, 420);
      const rel = await waitRelease(page, prev).catch(() => null);
      if (rel) await waitOutcome(page, rel.id).catch(() => {});
      const s2 = await page.evaluate(() => CS.state().streak);
      maxStreak = Math.max(maxStreak, s2);
      if (s2 >= 31) break;
    }
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ ev: CS.events.filter(e => e.type === 'streak'), R: window.__sk, wv: window.__wv, lands: CS.events.filter(e => e.type === 'land').length,
      perfects: CS.events.filter(e => e.type === 'land' && e.grade === 'perfect').length }));
    const want = [5, 10, 20, 30].filter(n => n <= maxStreak), names = { 5: 'ON FIRE!', 10: 'UNSTOPPABLE!', 20: 'MAGNET MASTER!', 30: 'LEGENDARY!' }, tier = { 5: 1, 10: 2, 20: 3, 30: 4 };
    const evN = r.ev.map(e => e.n), firstRun = want.map(n => r.ev.find(e => e.n === n));
    const wordFor = n => r.R.words.find(w => w.text === names[n] && w.sub.startsWith('PERFECT ×' + n));
    check('streak: a bot reaches a PERFECT streak of at least 20', maxStreak >= 20, `best streak ${maxStreak}; ${r.perfects}/${r.lands} landings PERFECT`);
    check('streak: milestones at 5, 10, 20 (30) each log a streak event with their word, tier and fanfare, and pop that word',
      want.length >= 3 && firstRun.every((e, i) => e && e.word === names[want[i]] && e.tier === tier[want[i]]) && evN.every(n => n === 5 || n === 10 || n === 20 || n % 10 === 0) &&
      want.every(n => !!wordFor(n)) && want.every(n => r.R.streakCalls.some(c => c.n === tier[n])),
      `events ${r.ev.map(e => e.n + ':' + e.word).join(', ')}; Sfx.streak tiers ${r.R.streakCalls.map(c => c.n).join(' ')}; words ${want.map(n => (wordFor(n) || {}).text || 'MISSING').join(' / ')}`);
    const perfW = r.R.words.filter(w => w.text === 'PERFECT!');
    const at1 = perfW.filter(w => w.streak === 1), hot = perfW.filter(w => w.streak >= 8);
    const green = c => parseInt(c.slice(1), 16) >> 8 & 255;   // (the green channel falls as gold warms to red-orange)
    check('streak: the PERFECT word grows and warms with the streak (8+ in a row: bigger, redder than the first)',
      at1.length > 0 && hot.length > 0 && Math.min(...hot.map(w => w.size)) > Math.max(...at1.map(w => w.size)) + 0.05 && Math.max(...hot.map(w => green(w.color))) < Math.min(...at1.map(w => green(w.color))) - 20,
      `first: size ${at1.map(w => w.size.toFixed(2)).join(' ')} ${at1.map(w => w.color).join(' ')}; 8+: size ${hot.slice(0, 4).map(w => w.size.toFixed(2)).join(' ')} ${hot.slice(0, 4).map(w => w.color).join(' ')}`);
    const badT = r.R.clacks.filter(c => c.streak !== c.now);
    check('streak: every PERFECT clack passes its streak to the ting (it climbs)', r.R.clacks.length >= 20 && badT.length === 0 && Math.max(...r.R.clacks.map(c => c.streak)) >= 20,
      `${r.R.clacks.length} PERFECT clacks, highest streak passed ${Math.max(0, ...r.R.clacks.map(c => c.streak))}${badT.length ? ', mismatched ' + badT.length : ''}`);
    check('streak: the word-pop rules hold through the run (never over the ghost or the build top, at most 2 alive, clear of the HUD)',
      r.wv.bad.length === 0 && r.wv.maxAlive <= 2 && r.wv.n >= 20, `${r.wv.n} pops, max ${r.wv.maxAlive} alive; ${r.wv.bad.slice(0, 4).join(' | ')}`);
    // (a milestone is placed as big as it can be first, wherever that is: it is not counted here)
    const land = r.R.words.filter(w => w.dist !== null && w.landT !== null && !Object.values(names).includes(w.text));
    const nearN = land.filter(w => w.near).length, dists = land.map(w => w.dist).sort((a, b) => a - b), med = dists.length ? dists[dists.length >> 1] : 99;
    check('streak: on a phone the landing pops (the milestones aside) sit by the landing (most placed by the near search; median within 3.5 L of the tile)',
      land.length >= 20 && nearN >= 0.6 * land.length && med <= 3.5, `${nearN}/${land.length} near, median ${med.toFixed(2)} L, 90th ${dists.length ? dists[Math.floor(dists.length * 0.9)].toFixed(2) : '-'} L`);
    check('streak: no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally { await context.close(); }
}

// 17. the landing-pop soak: per word pop, the score pop it was born with and how big it is drawn (as drawFxTop fits it)
function popSoakMonitor() {
  const M = window.__ps = { words: [], scoreChecked: 0, scoreCovered: [], stacked: 0, stackedEx: [] };
  const seen = new WeakSet(), textW = (px, t) => { ctx.font = font(px); return ctx.measureText(t).width; };
  (function f() {
    try {
      // two landing words drawn over each other this frame (both still showing: alpha over 0.15 as drawFxTop fades it)
      const vis = FX.words.filter(w => w.kind === 'word' && w.x1 && S.gt - w.t0 <= w.life).filter(w => {
        const u = (S.gt - w.t0) / w.life; return (u < 0.6 ? 1 : Math.max(0, 1 - (u - 0.6) / 0.4)) * (w.dim ? 0.25 : 1) > 0.15;
      });
      for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
        const a = vis[i], b = vis[j];
        if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) { M.stacked++; if (M.stackedEx.length < 4) M.stackedEx.push(a.text + ' / ' + b.text + ' at ' + S.gt.toFixed(2)); }
      }
      for (const w of FX.words) {
        if (w.kind !== 'word') continue;
        if (!seen.has(w)) { seen.add(w); w.__r = { text: w.text, near: !!w.near, size: w.size }; M.words.push(w.__r); }
        const r = w.__r;
        if (r.done || S.gt - w.t0 < 0.2 || !w.x1) continue;
        r.done = true;
        const full = Math.max(20, Math.min(36, CAM.W / 15)) * w.size;
        let k = 1;
        { const lw = (w.lines ? Math.max(...w.lines.map(l => textW(full, l))) : textW(full, w.text)) * (w.cx || 1), tw = Math.max(lw, w.sub ? textW(full * 0.55, w.sub) : 0), need = tw * (w.pin || 1.4); if (w.maxW && need > w.maxW) k = Math.max(w.kmin || 0.75, w.maxW / need); }
        r.px = full * k; r.k = k;
        const sp = FX.words.find(q => q.kind === 'score' && q.t0 === w.t0);
        if (!sp) continue;
        M.scoreChecked++;
        const b = Math.max(20, Math.min(36, CAM.W / 15)) * sp.size, u = Math.min(1, (S.gt - sp.t0) / sp.life), tw = textW(b, sp.text);
        const y = sp.y - 30 * (1 - Math.pow(1 - u, 3)), x = Math.max(tw / 2, Math.min(CAM.W - tw / 2, sp.x));
        const ix = Math.max(0, Math.min(x + tw / 2, w.x1) - Math.max(x - tw / 2, w.x0)), iy = Math.max(0, Math.min(y + b / 2, w.y1) - Math.max(y - b / 2, w.y0));
        const c = ix * iy / (tw * b);
        if (c > 0.25) M.scoreCovered.push(w.text + ' over ' + sp.text + ' ' + Math.round(c * 100) + '%');
      }
    } catch (e) { M.err = String(e); }
    requestAnimationFrame(f);
  })();
}
async function popSoakGame(browser, seed, drops) {
  const { page, errors, context } = await gamePage(browser, { width: 390, height: 844 }, { seed, mute: 1, nohint: 1, autostart: 1, level: 3 }, { touch: true });
  try {
    await until(page, () => window.CS && CS.state().handReady && !CS.state().locked, null, 15000);
    await page.evaluate(wordMonitor); await page.evaluate(popSoakMonitor);
    let rnd = seed * 7919 + 3, n = 0, prev = 0;
    const rand = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
    for (let k = 0; k < drops * 3 && n < drops; k++) {
      const ok = await until(page, () => { const s = CS.state(); return s.phase === 'play' && !s.locked && s.handReady && s.inAir === 0; }, null, 15000).then(() => true).catch(() => false);
      if (!ok) continue;
      await page.waitForTimeout(60 + rand() * 220);
      const info = await page.evaluate(() => ({ sl: CS.slots(), cam: CS.cam(), st: CS.state() }));
      if (info.st.phase !== 'play' || info.st.locked || !info.st.handReady) continue;
      const L = info.cam.L, safe = info.sl.filter(q => !q.tippy && q.supported), r = rand();
      let x;
      if (safe.length && r < 0.75) { safe.sort((a, b) => Math.abs(a.x) - Math.abs(b.x) + (b.y - a.y) * 0.3); x = safe[0].sx + (rand() - 0.5) * 0.1 * L; }
      else if (info.sl.length && r < 0.97) x = info.sl[(rand() * info.sl.length) | 0].sx + (rand() - 0.5) * 0.9 * L;
      else x = 4 + rand() * (info.cam.W - 8);
      await page.touchscreen.tap(Math.max(2, Math.min(info.cam.W - 2, x)), Math.min(info.cam.H - 10, info.cam.handY + 3 * L));
      const rel = await waitRelease(page, prev).catch(() => null);
      if (rel) { prev = rel.id; n++; }
    }
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => ({ wv: window.__wv, ps: window.__ps }));
    return { drops: n, wv: r.wv, ps: r.ps, errors };
  } finally { await context.close(); }
}
async function popSoak(browser) {
  const runs = await Promise.all([popSoakGame(browser, 1, 160), popSoakGame(browser, 2, 160)]);
  const bad = [].concat(...runs.map(r => r.wv.bad)), words = [].concat(...runs.map(r => r.ps.words.filter(w => w.done)));
  const nWords = runs.reduce((a, r) => a + r.wv.n, 0), checked = runs.reduce((a, r) => a + r.ps.scoreChecked, 0), covered = [].concat(...runs.map(r => r.ps.scoreCovered));
  const MILE = /^(ON FIRE|UNSTOPPABLE|MAGNET MASTER|LEGENDARY)!$/, miles = words.filter(w => MILE.test(w.text)), perf = words.filter(w => w.text === 'PERFECT!').map(w => w.px).sort((a, b) => a - b);
  const perfMed = perf.length ? perf[perf.length >> 1] : 0, nearN = words.filter(w => w.near).length;
  check('pops: soak, 2 x 160 quick touch drops at 390x844: the word-pop rules hold for every pop (never born over the ghost or the build top, never drawn over the ghost)',
    runs.every(r => r.drops >= 150) && nWords >= 200 && bad.length === 0, `${runs.map(r => r.drops).join(' + ')} drops, ${nWords} word pops; ${bad.slice(0, 5).join(' | ')}`);
  check('pops: no landing\'s word covers its own "+N" score pop (more than a quarter of it: at most 1 in 100)',
    checked >= 150 && covered.length <= Math.floor(checked / 100), `${covered.length} of ${checked} covered; ${covered.slice(0, 4).join(' | ')}`);
  check('pops: a streak milestone is never fitted smaller than the size it was placed at, nor drawn smaller than the median PERFECT',
    miles.length >= 3 && miles.every(w => w.k >= 0.999 && w.px >= perfMed), `${miles.length} milestones at ${miles.map(w => (+w.px).toFixed(1) + (w.near ? 'n' : 'f')).join(' ')} px; median PERFECT ${perfMed.toFixed(1)} px`);
  check('pops: most landing words are placed by the near search', words.length >= 150 && nearN >= 0.6 * words.length, `${nearN}/${words.length} near`);
  const stacked = runs.reduce((a, r) => a + r.ps.stacked, 0);
  check('pops: a quick drop never shows two landing words over each other (the word before gives way at once where the new one pops in)',
    stacked === 0, `${stacked} frames; ${[].concat(...runs.map(r => r.ps.stackedEx)).slice(0, 4).join(' | ')}`);
  const errs = [].concat(...runs.map(r => r.errors));
  check('pops: no page or console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
}

// 18. streak milestones on short landscape phones (--only=pops): a PERFECT bot (taps the PERFECT centre of the most
// central safe slot) to a streak of 30 at 844x390 and 667x375; every 'streak' event pops its word, drawn on screen (not
// see-through over the ghost) at least as big as the median PERFECT of that game (0.9 of it on a landing that also tears
// the ribbon or crowns), whether in clear air, on two lines, condensed, or over the build's body under its top row; the
// word-pop rules hold all the way (lib wordMonitor)
function mileMonitor() {
  const M = window.__mm = { words: [] };
  const seen = new WeakSet(), tw = (px, t) => { ctx.font = font(px); return ctx.measureText(t).width; };
  (function f() {
    try {
      for (const w of FX.words) {
        if (w.kind !== 'word' || seen.has(w) || !w.x1) continue;
        seen.add(w);
        // (as drawFxTop draws it: fitted to its room at its pop-in, never under its kmin)
        const full = Math.max(20, Math.min(36, CAM.W / 15)) * w.size;
        const lw = (w.lines ? Math.max(...w.lines.map(l => tw(full, l))) : tw(full, w.text)) * (w.cx || 1), need = Math.max(lw, w.sub ? tw(full * 0.55, w.sub) : 0) * (w.pin || 1.4);
        const k = w.maxW && need > w.maxW ? Math.max(w.kmin || 0.75, w.maxW / need) : 1;
        M.words.push({ text: w.text, t0: w.t0, px: full * k, near: !!w.near, lines: w.lines ? w.lines.join(' / ') : '', cx: w.cx || 1, dim: !!w.dim,
          on: w.x0 >= -1 && w.x1 <= CAM.W + 1 && w.y0 >= -1 && w.y1 <= CAM.H + 1 });
      }
    } catch (e) { M.err = String(e); }
    requestAnimationFrame(f);
  })();
}
async function mileGame(browser, view, seed) {
  const { page, errors, context } = await gamePage(browser, view, { seed, mute: 1, nohint: 1, autostart: 1, level: 1, ts: 2 }, { touch: true });
  try {
    await until(page, () => window.CS && CS.state().handReady && !CS.state().locked, null, 15000);
    await page.evaluate(wordMonitor); await page.evaluate(mileMonitor);
    let maxStreak = 0;
    for (let k = 0; k < 160 && maxStreak < 30; k++) {
      const ok = await until(page, () => { const s = CS.state(); return s.phase === 'over' || (s.phase === 'play' && s.handReady && !s.locked && s.inAir === 0); }, null, 20000).then(() => true).catch(() => false);
      if (!ok || (await page.evaluate(() => CS.state().phase)) === 'over') break;
      await until(page, () => Math.abs(CS.state().omega) < 0.02 && Math.abs(CS.state().flexV) < 0.1, null, 1500).catch(() => {});
      const info = await page.evaluate(() => ({ st: CS.state(), sl: CS.slots() }));
      const safe = info.sl.filter(q => !q.tippy && (q.supported || info.st.piece === 'crown')), pool = safe.length ? safe : info.sl;
      if (!pool.length) { await page.keyboard.press('Shift'); continue; }
      pool.sort((a, b) => Math.abs(a.x) - Math.abs(b.x) + (b.supported - a.supported) * 10);
      const prev = await lastId(page);
      const sx = await page.evaluate(key => (CS.slots().find(q => q.key === key) || {}).sx, pool[0].key);
      if (sx === undefined) continue;
      await page.touchscreen.tap(sx, Math.round(view.height * 0.5));
      const rel = await waitRelease(page, prev).catch(() => null);
      if (rel) await waitOutcome(page, rel.id).catch(() => {});
      maxStreak = Math.max(maxStreak, await page.evaluate(() => CS.state().streak));
    }
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ ev: CS.events.filter(e => e.type === 'streak'), ann: CS.events.filter(e => e.type === 'goal' || e.type === 'crown').map(e => e.t), mm: window.__mm, wv: window.__wv }));
    return { view, seed, maxStreak, ev: r.ev, ann: r.ann, mm: r.mm, wv: r.wv, errors };
  } finally { await context.close(); }
}
async function mileLandscape(browser) {
  const runs = await Promise.all([mileGame(browser, { width: 844, height: 390 }, 2), mileGame(browser, { width: 667, height: 375 }, 3)]);
  for (const g of runs) {
    const tag = `${g.view.width}x${g.view.height}`, perf = g.mm.words.filter(w => w.text === 'PERFECT!').map(w => w.px).sort((a, b) => a - b);
    const med = perf.length ? perf[perf.length >> 1] : 0;
    // (a milestone on the landing that tears the ribbon or crowns shares the screen with that announcement, placed first
    // in the middle of it: there it may give a tenth of that size back)
    const per = g.ev.map(e => {
      const w = g.mm.words.find(q => q.text === e.word && Math.abs(q.t0 - e.t) < 1e-3), ann = g.ann.some(t => Math.abs(t - e.t) < 1e-3);
      return { n: e.n, word: e.word, w, ann, ok: !!w && w.on && !w.dim && w.px >= (ann ? 0.9 : 1) * med - 0.05 };
    });
    check(`pops: ${tag} landscape phone, PERFECT bot to a streak of 30: every streak milestone pops its word on screen, at least as big as the median PERFECT`,
      g.maxStreak >= 20 && per.length >= 3 && per.every(p => p.ok) && perf.length >= 10,
      `best streak ${g.maxStreak}; median PERFECT ${med.toFixed(1)} px; ${per.map(p => p.n + ' ' + (p.w ? p.w.px.toFixed(1) + 'px' + (p.w.lines ? ' 2 lines' : '') + (p.w.cx < 1 ? ' condensed' : '') + (p.ann ? ' with the goal/crown' : '') + (p.w.near ? ' near' : '') + (p.w.dim ? ' DIM' : '') + (p.w.on ? '' : ' OFF-SCREEN') : 'MISSING')).join(', ')}`);
    check(`pops: ${tag} the word-pop rules hold through the streak (never over the ghost or the build top, at most 2 alive, clear of the HUD)`,
      g.wv.bad.length === 0 && g.wv.maxAlive <= 2 && !g.mm.err, `${g.wv.n} pops; ${g.wv.bad.slice(0, 4).join(' | ')}${g.mm.err ? ' monitor: ' + g.mm.err : ''}`);
    check(`pops: ${tag} no page or console errors`, g.errors.length === 0, g.errors.slice(0, 3).join(' | '));
  }
}

// 12. never a dead piece
async function deadPiece(browser) {
  const { page, errors, context } = await gamePage(browser, { width: 390, height: 844 }, { seed: 3, ts: 2, mute: 1, nohint: 1, autostart: 1, level: ONE_CAR });
  try {
    await until(page, () => window.CS && CS.state().handReady);
    await noHazards(page);
    // every time a tile reaches the hand: does it have a slot? (the HOLD IT! pulse would excuse one: not used here)
    await page.evaluate(() => {
      window.__dead = { ready: 0, dead: [] }; let was = false;
      (function l() {
        try {
          const s = CS.state(), on = s.phase === 'play' && s.handReady && !s.locked;
          if (on && !was) { __dead.ready++; if (!CS.slots().length && !s.allTippy) __dead.dead.push({ t: +s.t.toFixed(2), piece: s.piece, held: s.held }); }
          was = on;
        } catch (e) { /* booting */ }
        requestAnimationFrame(l);
      })();
    });
    const ready = () => until(page, () => { const s = CS.state(); return s.phase === 'play' && s.handReady && s.inAir === 0 && !s.locked; }, null, 8000);
    const tap = async x => { const prev = await lastId(page); await page.mouse.move(x, 500); await page.mouse.down(); await page.mouse.up(); await waitRelease(page, prev).catch(() => {}); };
    // cap the car with two up-triangles (anything else is thrown away off the left edge)
    let capped = false;
    for (let k = 0; k < 60 && !capped; k++) {
      await ready();
      const info = await page.evaluate(() => ({ st: CS.state(), sl: CS.slots(), keys: CS.tiles().map(t => t.key) }));
      if (info.keys.includes('up:-2,0,0') && info.keys.includes('up:0,0,0')) { capped = true; break; }
      const want = info.st.piece === 'tri' ? info.sl.find(q => q.key === 'up:-2,0,0' || q.key === 'up:0,0,0') : null;
      await tap(want ? want.sx : 4);
    }
    const deals0 = await page.evaluate(() => CS.events.filter(e => e.type === 'deal').length);
    // (the bag has 4 triangles in 10 now: a triangle may well come next and fill the notch before any square has met
    // the capped base. Triangles are thrown away off the left edge until a square has come to it, so the re-deal is
    // seen whatever the bag deals)
    for (let k = 0; k < 20; k++) {
      await ready();
      const q = await page.evaluate(() => ({ deals: CS.events.filter(e => e.type === 'deal').length, keys: CS.tiles().map(t => t.key) }));
      if (q.deals > deals0 || !q.keys.includes('up:-2,0,0') || !q.keys.includes('up:0,0,0') || q.keys.length !== 2) break;
      await tap(4);
    }
    // then 20 drops on whatever slot the tile in the hand has (the notch first)
    for (let k = 0; k < 20; k++) {
      await ready();
      const sl = await page.evaluate(() => CS.slots().filter(q => !q.tippy).sort((a, b) => (b.type === 'dn') - (a.type === 'dn') || a.ly - b.ly));
      await tap(sl.length ? sl[0].sx : 4);
    }
    await until(page, () => CS.state().inAir === 0, null, 8000).catch(() => {});
    const r = await page.evaluate(() => ({ dead: __dead.dead, ready: __dead.ready, deals: CS.events.filter(e => e.type === 'deal'), misses: CS.events.filter(e => e.type === 'miss').length }));
    check('dead piece: a tile with no slot never reaches the hand (a capped base deals a triangle instead)', capped && r.dead.length === 0 && r.deals.length >= 1,
      `capped ${capped}; ${r.ready} tiles reached the hand, ${r.dead.length} with no slot ${JSON.stringify(r.dead.slice(0, 4))}; ${r.deals.length} re-deals (${deals0} while capping): ` +
      r.deals.slice(0, 4).map(d => `${d.piece} -> ${d.to} (${d.via})`).join(', '));
    check('dead piece: no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally { await context.close(); }
}

// 13. the hand flinches up during a crash (EdgeBot on level 3) and comes back down once the new car has parked
async function flinch(browser) {
  const { page, errors, context } = await gamePage(browser, { width: 390, height: 844 }, { seed: 2, ts: 1, mute: 1, nohint: 1, autostart: 1, level: 3 });
  try {
    await until(page, () => window.CS && CS.state().handReady);
    await page.evaluate(() => {
      window.__fl = { pre: null, min: 1e9, max: -1e9, parkY: null, after: null };
      (function l() {
        try {
          const s = CS.state(), c = CS.cam(), F = __fl;
          if (s.phase === 'play' && s.crashes === 0) F.pre = c.handY;
          if (s.phase === 'crash') { F.min = Math.min(F.min, c.handY); F.max = Math.max(F.max, c.handY); F.top = c.handTop; F.L = c.L; }
          if (s.crashes > 0 && s.phase === 'play' && F.parkY === null) { F.parkY = c.handY; F.parkT = s.t; }
          if (F.parkT && s.t > F.parkT + 0.8 && F.after === null) F.after = c.handY;
        } catch (e) { /* booting */ }
        requestAnimationFrame(l);
      })();
    });
    for (let k = 0; k < 30; k++) {
      await until(page, () => { const s = CS.state(); return (s.phase === 'play' && s.handReady && !s.locked) || s.crashes > 0; }, null, 8000);
      if (await page.evaluate(() => CS.state().crashes > 0)) break;
      const sl = await page.evaluate(() => CS.slots().sort((a, b) => b.sx - a.sx)[0]);
      const prev = await lastId(page);
      await page.mouse.move(sl ? sl.sx : 4, 500); await page.mouse.down(); await page.mouse.up();
      await waitRelease(page, prev).catch(() => {});
    }
    await until(page, () => window.__fl.after !== null, null, 10000).catch(() => {});
    const F = await page.evaluate(() => window.__fl);
    // during the crash the hand never goes lower than it was (it only rises, to just under the HUD); after the car
    // has parked it comes back down to hover over the new base
    const ok = F.pre !== null && F.max <= F.pre + 1 && F.min <= F.top + 0.6 * F.L + 1 && F.after !== null && F.after > F.min + F.L;
    check('flinch: during a crash the hand goes up out of the burst, never down into it; back down once the new car has parked', ok,
      `hand y before ${F.pre && F.pre.toFixed(0)}, during the crash ${F.min.toFixed(0)}-${F.max.toFixed(0)} (top line ${F.top}), parked ${F.parkY && F.parkY.toFixed(0)}, 0.8 s later ${F.after && F.after.toFixed(0)}`);
    check('flinch: no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally { await context.close(); }
}

// 14. the new base parks clear of the pile (EdgeBot crashes on level 8's one car, level 4's long car, level 1's two cars)
async function pileClear(browser, view) {
  const bad = [], seen = [];
  let errs = [];
  // (one car, the long car, two cars)
  for (const level of [ONE_CAR, 4, 1]) {
    const { page, errors, context } = await gamePage(browser, view, { seed: 4, ts: 2, mute: 1, nohint: 1, autostart: 1, level });
    try {
      await until(page, () => window.CS && CS.state().handReady);
      await noHazards(page);
      for (let crash = 1; crash <= 2; crash++) {
        for (let k = 0; k < 40; k++) {
          await until(page, c => { const s = CS.state(); return (s.phase === 'play' && s.handReady && !s.locked) || s.crashes >= c; }, crash, 8000);
          if (await page.evaluate(c => CS.state().crashes >= c, crash)) break;
          // (squares only: a triangle, held firm now (DESIGN 15.1), is thrown away off the left edge, so the tower
          // goes over the right wheel before it reaches the ribbon)
          const sl = await page.evaluate(() => /tri|crown/.test(CS.state().piece) ? null : CS.slots().sort((a, b) => b.sx - a.sx)[0]);
          const prev = await lastId(page);
          await page.mouse.move(sl ? sl.sx : 4, view.height * 0.5); await page.mouse.down(); await page.mouse.up();
          await waitRelease(page, prev).catch(() => {});
        }
        await until(page, c => CS.state().crashes >= c && CS.state().phase === 'play' && !CS.state().locked, crash, 8000);
        const t0 = await page.evaluate(() => CS.state().t);
        await until(page, t => CS.state().t >= t, t0 + 2.5, 8000);
        // the screen boxes: the parked car (plate top to wheel bottoms, its ends + 0.5 L) against every piece as drawn
        const r = await page.evaluate(() => {
          const L = CAM.L, half = S.B.half, cx = CAM.originX + TW.ox * L;
          const car = { x0: cx - (half + 0.5) * L, x1: cx + (half + 0.5) * L, y0: CAM.baseY - 0.5 * L, y1: CAM.baseY };
          const over = [];
          let n = 0;
          for (const d of DEBRIS) {
            if (d.alpha < 0.3 || !d.sleep) continue;            // (the pile: what lies still; a fresh MISS may be bouncing by)
            n++;
            const sc = 1 + CFG.DEB_Z_SCALE * d.z, Ld = L * sc, fy = CAM.baseY + d.z * L, px = CAM.originX + d.x * L, py = fy - (d.y + 0.5) * Ld;
            const V = d.verts || [-d.r, -d.r, d.r, -d.r, d.r, d.r, -d.r, d.r], c = Math.cos(d.ang), s = Math.sin(d.ang);
            let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
            for (let k = 0; k < V.length; k += 2) {
              const rx = V[k] * c - V[k + 1] * s, ry = V[k] * s + V[k + 1] * c, X = px + rx * Ld, Y = fy + (py - ry * Ld - fy) * d.lay;
              x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
            }
            if (x0 < car.x1 && x1 > car.x0 && y0 < car.y1 && y1 > car.y0) over.push(d.shape + '@' + d.x.toFixed(2) + ',z' + d.z.toFixed(2));
          }
          return { n, over, cars: DEBRIS.filter(d => d.shape === 'car' && d.alpha > 0.05 && d.sleep).length };
        });
        seen.push(`L${level} crash ${crash}: ${r.n} pieces`);
        if (r.over.length || r.cars) bad.push(`L${level} crash ${crash}: ${r.over.length} over the car (${r.over.slice(0, 4).join(' ')}), ${r.cars} old cars showing`);
      }
      errs = errs.concat(errors);
    } finally { await context.close(); }
  }
  check(`pile ${view.width}x${view.height}: the new base parks clear of the mess (nothing over the car or at its ends; old cars faded)`, bad.length === 0,
    (bad.length ? bad.join('; ') : seen.join('; ')));
  check(`pile ${view.width}x${view.height}: no page or console errors`, errs.length === 0, errs.slice(0, 3).join(' | '));
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
    if (want('streak')) await streakRun(browser);
    if (want('pops')) { await popSoak(browser); await mileLandscape(browser); }
    if (want('softlock')) await noSoftLock(browser);
    if (want('fuse')) { await fuseHold(browser); await fuseClick(browser); }
    if (want('hitstop')) await hitStopGhost(browser);
    if (want('stale')) await staleGhost(browser);
    if (want('dead')) await deadPiece(browser);
    if (want('flinch')) await flinch(browser);
    if (want('pile')) for (const view of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) await pileClear(browser, view);
  } finally {
    await browser.close();
  }
  if (want('audio')) await audioUnlock();
  console.log(failures ? `FEEL: ${failures} check(s) failed` : 'FEEL: all checks passed');
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
