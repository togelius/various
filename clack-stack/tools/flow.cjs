#!/usr/bin/env node
'use strict';
// M4 acceptance (DESIGN.md 14): game flow and scoring, driven only through real mouse / touch / keyboard events
// (CS.setClock is the one test hook used to end a run early, as DESIGN 14 says).
//   node clack-stack/tools/flow.cjs                 (everything)
//   node clack-stack/tools/flow.cjs --only=tapper,order   (title,tapper,order,clock,over,best,pause,mute,crown,rings,
//                                                          crownwait,pending,buzzer,camera,hand,prefs,offline,
//                                                          goalsign,armicon)
//   node clack-stack/tools/flow.cjs --seeds=1-10 --verbose
// Checks:
//   title   a title tap reaches `play` within 1.2 s (game and real time) and the base is parked with a tile in hand
//           by ~1 s; the letters are pokeable (a tap on one stays on the title); BIG MAGNETS toggles, persists, and a
//           run started with it on is BIG; Space right after a mouse click on the toggle starts (the toggle keeps no
//           focus); Space starts; touch starts
//   tapper  RandomTapper (uniform x within ±2.5 L of the base centre, one tap per 0.7 s game time) clears L1 within
//           20 s game time in >= 9/10 seeds, and within 15 s in 10/10 seeds with big=1
//   order   every level logs goal, then crown, then smash, then level, in that order (all runs of this tool)
//   clock   the clock is frozen during every SMASH (it never goes down; the level and crown bonuses only add), the
//           level-complete bonus arrives, and the clock runs again after
//   over    setClock(0.5) reaches `over` within 3 s; the results card shows; a tap on AGAIN during the 0.8 s lockout
//           does nothing; AGAIN after it reaches `play` within 1 s with score 0 and a tile in hand on a parked base
//           within 1 s; Space and R also restart; MENU goes to the title; the pile is pokeable; on wide screens zoomed
//           out to the floor (1920x1080 L15, 1366x1024 L16) TIME!'s cube still smashes the build before the card, with
//           no MISS for the dropped tile and no cube left over in the next run
//   best    clackstack.best holds the higher score of two runs; a big=1 run writes only clackstack.bestBig
//   pause   P, Esc, a hidden tab, the window losing focus (a mouse or keyboard player) and an orientation change all
//           give `paused` with the clock frozen; RESUME (mouse, touch) and P resume; MENU from the pause goes to the
//           title; a touch player's window blur (phones blur on their own now and then) does not pause
//   hand    a keyboard player's hand does not carry into the next run: slid to the right, AGAIN (R) starts with the
//           hand over the middle of the base, and so does MENU then a new game
//   prefs   stored best scores and prefs are type-checked field by field on load: junk (strings, negatives, null,
//           NaN-like, objects, arrays, non-JSON) falls back to each field's default, good fields are kept, and the
//           game boots, draws the title's best-score lid and plays with no errors
//   goalsign on a tall phone and a short one (390x844, 360x740), L1 and L3 built to the goal: the goal's sign is on
//           screen and covers no tile of the build nor its cars (on a short rug band it is laid out compact)
//   armicon the goal's icon on the ribbon is never under the holding arm, the hand low at a level start and moved by
//           the mouse across the screen (1366x1024, 844x390, 390x844; L1 and L3): it moves to the ribbon's other end
//   offline opened with the network down (no font stub), at 390x844 touch and 844x390 mouse: the title, a start and a
//           few drops log no console error or warning (the web font is not asked for); back online it is asked for once
//   mute    M mutes; the setting survives a reload; the HUD mute button toggles it
//   crown   the crown drops into the hand at the goal; a crown MISS gives a fresh crown (OOPS); HOLD on the crown
//           starts OVERTIME (tiles above the ribbon score double); crowning gives +3 s and the bonus
//   rings   rings sit 0.35-0.75 G high, outside the base, 1 on L1-L3 and 2 after; RingBot collects one: +2 s, +50×mult
//   crownwait  a build that tears the ribbon with NO triangle slot left anywhere (L9, a fixture build the bag would
//           not deal in order; the goal-crossing drop and everything after are real clicks): the crown is owed, not
//           put in the hand (no OOPS loop), the hand keeps building, the crown drops in as soon as a landing opens a
//           triangle slot, and crowning it SMASHes to L10; a crown in HOLD stays there while no triangle slot exists
//           (the wobble of DESIGN 15.3 off: the 2-wide fixture would SNAP; wobble.cjs tests the crown with SNAPs)
//   pending a press 0.1 s before the new base parks (after a SMASH, and on the intro roll-in) drops a tile within
//           0.2 s of play resuming
//   buzzer  a crown released with time on the clock that lands after the clock hits 0.0 still crowns: bonus, +3 s,
//           the SMASH and the next level (the run goes on)
//   camera  the SMASH of a tower tall enough to scroll the camera (844x390 L9, 390x844 L13): when the cube hits, the
//           cube and the rug line are on screen; TIME! on a 10 L tower (844x390): on the results card at least half
//           the pile is on screen (it stays pokeable), and AGAIN parks the new cars on the rug in view; past the zoom
//           floor with the goal still far (390x844 L16, 1366x1024 L16) the camera keeps only 2-3 L of air between the
//           build top and the hand's highest line (the base stays in view longer), and with the goal near the ribbon
//           is framed under that line; and as real drops bring the goal near on a 31-row tower (L16, 390x844,
//           844x390, 1366x1024), calm drops and quick ones (the next tile dropped while the one before is still in
//           the air), the ribbon is never drawn, however faintly, through the tile in the hand nor along its bottom
//           edge (it fades out before it reaches it) (that tower with the wobble off: 15.3 would SNAP it on the first drop)
// Exits non-zero on any failure, page error or console error.
const { launch, gamePage, until } = require('./lib.cjs');

const argv = process.argv.slice(2);
const ONLY = (argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = n => !ONLY.length || ONLY.includes(n);
const VERBOSE = argv.includes('--verbose');
const SEEDS = (() => {
  const a = (argv.find(x => x.startsWith('--seeds=')) || '--seeds=1-10').slice(8).split('-').map(Number);
  const out = []; for (let s = a[0]; s <= (a[1] || a[0]); s++) out.push(s); return out;
})();
const VIEW = { width: 390, height: 844 };
let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
}
const log = (...a) => { if (VERBOSE) console.log('   ', ...a); };
const allEvents = [];          // every run's events, for the order check
const allErrors = [];

// game-time helpers
const gt = page => page.evaluate(() => CS.state().t);
async function waitGame(page, dt, timeout) {
  const t0 = await gt(page);
  await until(page, t => CS.state().t >= t, t0 + dt, timeout || 20000);
}
const centre = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
async function ui(page) { return page.evaluate(() => CS.ui()); }
// in-page monitor: (phase, clock) every frame, for the SMASH freeze check; and the moment each phase began
function installMonitor() {
  window.__fm = { smash: [], phases: [], last: null };
  (function loop() {
    try {
      const st = CS.state();
      if (st.phase !== __fm.last) { __fm.phases.push({ phase: st.phase, t: st.t, real: performance.now() }); __fm.last = st.phase; }
      if (st.phase === 'smash') __fm.smash.push({ t: st.t, clock: st.clock, n: CS.events.filter(e => e.type === 'smash').length });
    } catch (e) { /* booting */ }
    requestAnimationFrame(loop);
  })();
}
async function open(browser, params, opts) {
  const g = await gamePage(browser, (opts && opts.view) || VIEW, Object.assign({ mute: 1, nohint: 1 }, params), Object.assign({ realClock: true }, opts || {}));
  await until(g.page, () => !!window.CS, null, 15000);
  await g.page.evaluate(installMonitor);
  return g;
}
async function finish(g) {
  const ev = await g.page.evaluate(() => CS.events.slice());
  allEvents.push({ tag: g.tag || '', ev });
  allErrors.push(...g.errors);
  await g.context.close();
}
// a builder: taps the PERFECT centre of the highest supported slot nearest the middle (squares and triangles; a cube
// goes where it fits); stops when cond() (in page) is true. It looks once what it dropped has landed (a landing can
// change what is in the hand: the crown drops in when the ribbon tears)
async function buildUntil(page, cond, maxTaps) {
  for (let k = 0; k < (maxTaps || 60); k++) {
    if (await page.evaluate(cond)) return true;
    await until(page, () => { const s = CS.state(); return (s.phase === 'play' && s.handReady && !s.locked && s.inAir === 0) || s.phase === 'over'; }, null, 20000);
    if (await page.evaluate(cond)) return true;
    const p = await page.evaluate(() => {
      const st = CS.state(), sl = CS.slots().filter(s => s.supported && !s.tippy);
      sl.sort((a, b) => b.y - a.y || Math.abs(a.x - st.com.x * 0) - Math.abs(b.x));
      return { sl: sl[0] || null, st };
    });
    if (!p.sl) { await page.keyboard.press('Shift'); continue; }
    await page.mouse.move(p.sl.sx, VIEW.height * 0.55); await page.mouse.down(); await page.mouse.up();
    await waitGame(page, 0.25);
  }
  return page.evaluate(cond);
}

// ---------------------------------------------------------------- title
async function titleChecks(browser) {
  // 1. a title tap reaches play within 1.2 s; the cars are parked with a tile in hand soon after
  {
    const g = await open(browser, { seed: 5 }); g.tag = 'title';
    const { page } = g;
    await page.waitForTimeout(300);
    const t0 = await gt(page), r0 = Date.now();
    await page.mouse.click(VIEW.width / 2, VIEW.height * 0.45);
    await until(page, () => CS.state().phase === 'play', null, 5000);
    const t1 = await gt(page), r1 = Date.now();
    await until(page, () => { const s = CS.state(); return s.phase === 'play' && !s.locked && s.handReady; }, null, 5000);
    const t2 = await gt(page);
    const shove = await page.evaluate(() => CS.events.filter(e => e.type === 'shove').length);
    check('title: a tap reaches play within 1.2 s', t1 - t0 <= 1.2 && r1 - r0 <= 1500, `game ${(t1 - t0).toFixed(2)} s, real ${((r1 - r0) / 1000).toFixed(2)} s`);
    check('title: the arm shoves the title build; cars parked + tile in hand by ~1 s', shove === 1 && t2 - t0 <= 1.1, `shove ${shove}, ready at +${(t2 - t0).toFixed(2)} s game`);
    const mess = await page.evaluate(() => CS.state().debris);
    check('title: the build bursts into debris (about 30 pieces)', mess >= 25, `${mess} debris pieces`);
    await finish(g);
  }
  // 2. letters are pokeable; BIG MAGNETS toggles and persists; Space starts a BIG run
  {
    const g = await open(browser, { seed: 6 }); g.tag = 'big';
    const { page } = g;
    await page.waitForTimeout(300);
    const box = await page.evaluate(() => { const b = Art.titleLetterBoxes(CAM.titleX, CAM.titleY, CAM.titleW)[2]; return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; });
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(80);
    const poke = await page.evaluate(() => ({ ph: CS.state().phase, wob: S.titleWobble[2] }));
    check('title: a letter is pokeable (it wobbles, the title stays)', poke.ph === 'title' && poke.wob > 0, JSON.stringify(poke));
    const u = await ui(page);
    const c = centre(u.big);
    await page.mouse.click(c.x, c.y);
    await page.waitForTimeout(80);
    const on = await page.evaluate(() => ({ big: CS.state().big, ph: CS.state().phase, pref: JSON.parse(localStorage.getItem('clackstack.prefs') || '{}').big,
      pressed: document.querySelector('#ui .tog').getAttribute('aria-pressed') }));
    check('title: BIG MAGNETS toggle turns it on (and stays on the title)', on.big === true && on.ph === 'title' && on.pref === true && on.pressed === 'true', JSON.stringify(on));
    // straight after the click (no reload): Space starts the BIG run (the clicked toggle keeps no focus to take the key)
    await page.keyboard.press('Space');
    let started = true;
    try { await until(page, () => CS.state().phase === 'play', null, 3000); } catch (e) { started = false; }
    const sp = await page.evaluate(() => ({ ph: CS.state().phase, big: CS.state().big, cars: CS.state().cars, focus: document.activeElement ? document.activeElement.tagName : null }));
    check('title: after a mouse click on BIG MAGNETS, Space starts a BIG run (it does not toggle BIG again)', started && sp.big === true && sp.cars === 2, JSON.stringify(sp));
    await page.reload({ waitUntil: 'load' });
    await until(page, () => !!window.CS);
    await page.evaluate(installMonitor);
    await page.waitForTimeout(200);
    const kept = await page.evaluate(() => ({ ph: CS.state().phase, big: CS.state().big }));
    await page.keyboard.press('Enter');
    await until(page, () => CS.state().phase === 'play', null, 5000);
    const st = await page.evaluate(() => CS.state());
    check('title: BIG MAGNETS persists across a reload; Enter starts a BIG run', kept.ph === 'title' && kept.big === true && st.big === true && st.cars === 2, `title big ${kept.big}; run big ${st.big}, cars ${st.cars}`);
    await finish(g);
  }
  // 3. touch starts too
  {
    const g = await open(browser, { seed: 7 }, { touch: true }); g.tag = 'touch';
    const { page } = g;
    await page.waitForTimeout(300);
    await page.touchscreen.tap(VIEW.width / 2, VIEW.height * 0.5);
    let ok = true;
    try { await until(page, () => CS.state().phase === 'play', null, 3000); } catch (e) { ok = false; }
    check('title: a touch tap starts', ok);
    await finish(g);
  }
}

// ---------------------------------------------------------------- RandomTapper
async function randomTapper(browser, seed, big) {
  const g = await open(browser, Object.assign({ seed, ts: 4, autostart: 1 }, big ? { big: 1 } : {})); g.tag = `tapper ${big ? 'big' : 'normal'} ${seed}`;
  const { page } = g;
  await until(page, () => CS.state().phase === 'play' && CS.state().handReady, null, 10000);
  let rnd = seed * 9973 + (big ? 17 : 3);
  const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  const t0 = await gt(page);
  let taps = 0, cleared = null;
  for (;;) {
    const st = await page.evaluate(() => {
      const s = CS.state(), sm = CS.events.find(e => e.type === 'smash' && e.level === 1);
      return { t: s.t, phase: s.phase, smash: sm ? sm.t : null, cam: CS.cam() };
    });
    if (st.smash !== null) { cleared = st.smash - t0; break; }
    if (st.t - t0 > 40 || st.phase === 'over') break;
    const x = st.cam.originX + (rand() * 5 - 2.5) * st.cam.L;
    await page.mouse.move(x, VIEW.height * 0.55); await page.mouse.down(); await page.mouse.up();
    taps++;
    await until(page, t => CS.state().t >= t, st.t + 0.7, 10000);
  }
  // play on a little into L2 (more events for the order check, and a SMASH for the clock check)
  await waitGame(page, 2.0).catch(() => {});
  const ev = await page.evaluate(() => CS.events.filter(e => /goal|crown|smash|level|crash|miss|topple|ring/.test(e.type)).map(e => e.type + (e.crown ? '(crown)' : '') + '@' + e.t.toFixed(1)));
  log(`tapper ${big ? 'big' : 'normal'} seed ${seed}: ${cleared === null ? 'NOT cleared' : 'cleared in ' + cleared.toFixed(1) + ' s'}, ${taps} taps; ${ev.join(' ')}`);
  const smashClock = await page.evaluate(() => __fm.smash.slice());
  await finish(g);
  return { seed, big, cleared, taps, smashClock };
}

// ---------------------------------------------------------------- over: TIME!, results, AGAIN lockout, pile, MENU
// TIME! on a wide screen zoomed out to the floor (a tall goal): the cube still reaches the build and smashes it before
// the card, the tile the hand lets go of gets no MISS (it just bonks), and the next run starts with no cube left over
async function timeSmashChecks(browser) {
  for (const [view, level] of [[{ width: 1920, height: 1080 }, 15], [{ width: 1366, height: 1024 }, 16]]) {
    const g = await open(browser, { seed: 8, ts: 2, autostart: 1, level }, { view }); g.tag = 'timesmash';
    const { page } = g;
    await until(page, () => CS.state().phase === 'play' && CS.state().handReady);
    await page.evaluate(() => { window.__words = []; (function loop() { try { for (const w of FX.words) if (window.__words.indexOf(w.text) < 0) window.__words.push(w.text); } catch (e) { /* */ } requestAnimationFrame(loop); })(); });
    await buildUntil(page, () => CS.state().tiles >= 5, 12);
    await until(page, () => CS.state().inAir === 0);
    const L = await page.evaluate(() => CS.cam().L);
    await page.evaluate(() => { window.__words.length = 0; CS.setClock(0.01); });
    await until(page, () => CS.state().over && CS.state().over.stage === 'results', null, 8000);
    const st = await page.evaluate(() => ({ smash: CS.events.filter(e => e.type === 'smash' && e.over).map(e => e.t), over: CS.events.filter(e => e.type === 'over').map(e => e.t),
      standing: CS.tiles().length, cube: CUBE.on ? CUBE.stage : 'off', words: window.__words.slice() }));
    const before = st.smash.length === 1 && st.over.length === 1 && st.smash[0] - st.over[0] <= 1.2;
    check(`over: TIME! at ${view.width}x${view.height} L${level} (L ${L.toFixed(0)} px): the cube smashes the build before the card`, before && st.standing === 0 && st.cube !== 'push',
      `smash at +${st.smash.length ? (st.smash[0] - st.over[0]).toFixed(2) : '-'} s, standing ${st.standing}, cube ${st.cube}`);
    check(`over: TIME! at ${view.width}x${view.height}: no MISS feedback for the tile the hand lets go of`, !st.words.includes('MISS') && !st.words.includes('BONK!'), st.words.join(' | '));
    await until(page, () => CS.state().over && CS.state().over.open, null, 5000);
    await page.keyboard.press('Enter');
    await until(page, () => CS.state().phase === 'play' && !CS.state().locked, null, 5000);
    await waitGame(page, 1.0);
    const nx = await page.evaluate(() => ({ cube: CUBE.on ? CUBE.stage : 'off', x: CUBE.x }));
    check(`over: AGAIN at ${view.width}x${view.height}: no cube or arm left over on the rug`, nx.cube === 'off', JSON.stringify(nx));
    await finish(g);
  }
}
async function overChecks(browser) {
  const g = await open(browser, { seed: 9, autostart: 1, level: 4 }); g.tag = 'over';
  const { page } = g;
  await until(page, () => CS.state().phase === 'play' && CS.state().handReady);
  await buildUntil(page, () => CS.state().tiles >= 4, 12);
  await until(page, () => CS.state().inAir === 0);
  const t0 = await gt(page), r0 = Date.now();
  await page.evaluate(() => CS.setClock(0.5));
  await until(page, () => CS.state().phase === 'over', null, 6000);
  const t1 = await gt(page), r1 = Date.now();
  check('over: setClock(0.5) reaches over within 3 s', t1 - t0 <= 3 && r1 - r0 <= 3500, `game ${(t1 - t0).toFixed(2)} s, real ${((r1 - r0) / 1000).toFixed(2)} s`);
  await until(page, () => CS.state().over && CS.state().over.stage === 'results', null, 5000);
  const tc = await gt(page);
  const timeEv = await page.evaluate(() => CS.events.filter(e => e.type === 'over' || (e.type === 'smash' && e.over)).map(e => e.type));
  check('over: TIME!, the cube smashes what stood, the results card after ~1.2 s', timeEv.join(',') === 'over,smash' && tc - t1 >= 1.0 && tc - t1 <= 1.5,
    `${timeEv.join(',')}; card +${(tc - t1).toFixed(2)} s`);
  // a tap on AGAIN during the lockout does nothing
  const u = await ui(page);
  const a = centre(u.again);
  await page.mouse.click(a.x, a.y);
  await page.keyboard.press('Space');
  await page.waitForTimeout(60);
  const lock = await page.evaluate(() => ({ ph: CS.state().phase, open: CS.state().over && CS.state().over.open, t: CS.state().t }));
  check('over: a tap (and Space) during the 0.8 s lockout does nothing', lock.ph === 'over' && !lock.open, JSON.stringify(lock));
  // the pile is pokeable (once it has settled)
  await until(page, () => CS.state().debrisAwake === 0, null, 8000).catch(() => {});
  const poke = await page.evaluate(() => {
    const d = CS.debris().filter(q => !q.fading && q.sleep);
    if (!d.length) return null;
    const p = d[0];
    return { x: p.sx, y: p.sy };             // (its screen centre: the pile lies at depth on the rug in front)
  });
  if (poke) {
    const awake0 = await page.evaluate(() => CS.state().debrisAwake);
    await page.mouse.click(poke.x, poke.y);
    await page.waitForTimeout(30);
    const awake1 = await page.evaluate(() => CS.state().debrisAwake);
    check('over: the pile is pokeable (a tap flicks a piece)', awake1 > awake0, `awake ${awake0} -> ${awake1}`);
  } else check('over: the pile is pokeable (a tap flicks a piece)', false, 'no sleeping debris to poke');
  // AGAIN after the lockout: play within 1 s, score 0, a car parked with a tile in hand within 1 s
  await until(page, () => CS.state().over && CS.state().over.open, null, 5000);
  const ta = await gt(page), ra = Date.now();
  await page.mouse.click(a.x, a.y);
  await until(page, () => CS.state().phase === 'play', null, 3000);
  const tb = await gt(page), rb = Date.now(), sc = await page.evaluate(() => CS.state().score);
  await until(page, () => { const s = CS.state(); return s.phase === 'play' && !s.locked && s.handReady; }, null, 3000);
  const tr = await gt(page);
  check('over: AGAIN after the lockout reaches play within 1 s with score 0', tb - ta <= 1 && rb - ra <= 1500 && sc === 0, `game ${(tb - ta).toFixed(2)} s, score ${sc}`);
  check('over: AGAIN puts a car on the rug with a tile in hand in under 1 s', tr - ta < 1, `+${(tr - ta).toFixed(2)} s`);
  // and on a clean rug: the last run's pile has faded by the time the car is parked
  const left = await page.evaluate(() => DEBRIS.filter(d => d.alpha > 0.05).length);
  check('over: AGAIN starts on a clean rug (the old pile fades as the new cars come)', left === 0, `${left} pieces still showing`);
  // Space restarts too, and R; Esc / MENU go to the title
  await page.evaluate(() => CS.setClock(0.3));
  await until(page, () => CS.state().over && CS.state().over.open, null, 8000);
  await page.keyboard.press('Space');
  let ok = true;
  try { await until(page, () => CS.state().phase === 'play', null, 2000); } catch (e) { ok = false; }
  await page.evaluate(() => CS.setClock(0.3));
  await until(page, () => CS.state().over && CS.state().over.open, null, 8000);
  await page.keyboard.press('r');
  try { await until(page, () => CS.state().phase === 'play', null, 2000); } catch (e) { ok = false; }
  check('over: Space and R restart from the results', ok);
  await page.evaluate(() => CS.setClock(0.3));
  await until(page, () => CS.state().over && CS.state().over.open, null, 8000);
  const m = centre((await ui(page)).menuR);
  await page.mouse.click(m.x, m.y);
  let menu = true;
  try { await until(page, () => CS.state().phase === 'title', null, 2000); } catch (e) { menu = false; }
  check('over: MENU on the results card goes to the title', menu);
  await finish(g);
}

// ---------------------------------------------------------------- best scores
async function bestChecks(browser) {
  const g = await open(browser, { seed: 10, ts: 2, autostart: 1, level: 4 }); g.tag = 'best';
  const { page } = g;
  await until(page, () => CS.state().phase === 'play' && CS.state().handReady);
  await buildUntil(page, () => CS.state().score >= 150, 20);
  await until(page, () => CS.state().inAir === 0);
  await page.evaluate(() => CS.setClock(0.3));
  await until(page, () => CS.state().over && CS.state().over.open, null, 8000);
  const s1 = await page.evaluate(() => CS.state().score);
  const b1 = await page.evaluate(() => ({ best: JSON.parse(localStorage.getItem('clackstack.best')), big: localStorage.getItem('clackstack.bestBig') }));
  // a second, worse run (no taps)
  await page.keyboard.press('Space');
  await until(page, () => CS.state().phase === 'play' && !CS.state().locked);
  await page.evaluate(() => CS.setClock(0.3));
  await until(page, () => CS.state().over && CS.state().over.open, null, 8000);
  const s2 = await page.evaluate(() => CS.state().score);
  const b2 = await page.evaluate(() => ({ best: JSON.parse(localStorage.getItem('clackstack.best')), big: localStorage.getItem('clackstack.bestBig'), nb: CS.state().over.newBest }));
  check('best: clackstack.best holds the higher score', b1.best && b1.best.score === s1 && b2.best.score === s1 && s2 < s1 && !b2.nb && b1.big === null,
    `run 1 ${s1} -> ${JSON.stringify(b1.best)}; run 2 ${s2} -> ${JSON.stringify(b2.best)}; bestBig ${b2.big}`);
  check('best: the record has score, level, cm, streak', b2.best && ['score', 'level', 'cm', 'streak'].every(k => typeof b2.best[k] === 'number'), JSON.stringify(b2.best));
  await finish(g);
  // a big=1 run writes only clackstack.bestBig
  const h = await open(browser, { seed: 11, ts: 2, autostart: 1, big: 1, level: 4 }); h.tag = 'best big';
  await until(h.page, () => CS.state().phase === 'play' && CS.state().handReady);
  await buildUntil(h.page, () => CS.state().score >= 150, 20);
  await until(h.page, () => CS.state().inAir === 0);
  await h.page.evaluate(() => CS.setClock(0.3));
  await until(h.page, () => CS.state().over && CS.state().over.open, null, 8000);
  const b3 = await h.page.evaluate(() => ({ best: localStorage.getItem('clackstack.best'), big: JSON.parse(localStorage.getItem('clackstack.bestBig')), score: CS.state().score, nb: CS.state().over.newBest }));
  check('best: a big=1 run writes only clackstack.bestBig', b3.best === null && b3.big && b3.big.score === b3.score && b3.nb, JSON.stringify(b3));
  // the title shows it on the tile box (no errors drawing it)
  await h.page.keyboard.press('Escape');
  await until(h.page, () => CS.state().phase === 'title', null, 3000);
  await h.page.waitForTimeout(100);
  await finish(h);
}

// ---------------------------------------------------------------- pause
async function pauseChecks(browser) {
  const g = await open(browser, { seed: 12, autostart: 1 }); g.tag = 'pause';
  const { page } = g;
  await until(page, () => CS.state().phase === 'play' && CS.state().handReady);
  await buildUntil(page, () => CS.state().tiles >= 2, 4);
  const frozen = async () => { const a = await page.evaluate(() => CS.state().clock); await page.waitForTimeout(400); const b = await page.evaluate(() => CS.state().clock); return { a, b, ok: a === b }; };
  const res = [];
  // P
  await page.keyboard.press('p');
  let st = await page.evaluate(() => CS.state().phase), f = await frozen();
  res.push(['P', st === 'paused' && f.ok, `${st}, clock ${f.a} -> ${f.b}`]);
  await page.keyboard.press('p');
  const resumedP = await page.evaluate(() => CS.state().phase);
  // Esc + the RESUME button (mouse)
  await page.keyboard.press('Escape');
  st = await page.evaluate(() => CS.state().phase); f = await frozen();
  res.push(['Esc', st === 'paused' && f.ok, `${st}, clock ${f.a} -> ${f.b}`]);
  let r = centre((await ui(page)).resume);
  await page.mouse.click(r.x, r.y);
  const resumedBtn = await page.evaluate(() => CS.state().phase);
  // a hidden tab
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  st = await page.evaluate(() => CS.state().phase); f = await frozen();
  res.push(['hidden tab', st === 'paused' && f.ok, `${st}, clock ${f.a} -> ${f.b}`]);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  const stillPaused = await page.evaluate(() => CS.state().phase);
  await page.keyboard.press('p');
  // an orientation change
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(150);
  st = await page.evaluate(() => CS.state().phase); f = await frozen();
  res.push(['orientation change', st === 'paused' && f.ok, `${st}, clock ${f.a} -> ${f.b}`]);
  r = centre((await ui(page)).resume);
  const dims = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight }));
  await page.mouse.click(r.x, r.y);
  const resumedRot = await page.evaluate(() => CS.state().phase);
  // the window losing focus: a mouse player (the last input was a click), then a keyboard player
  await page.mouse.move(r.x, r.y);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  st = await page.evaluate(() => CS.state().phase); f = await frozen();
  res.push(['window blur (mouse player)', st === 'paused' && f.ok, `${st}, clock ${f.a} -> ${f.b}`]);
  await page.keyboard.press('p');
  await page.keyboard.press('ArrowLeft');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  st = await page.evaluate(() => CS.state().phase); f = await frozen();
  res.push(['window blur (keyboard player)', st === 'paused' && f.ok, `${st}, clock ${f.a} -> ${f.b}`]);
  await page.keyboard.press('p');
  for (const [k, ok, d] of res) check(`pause: ${k} gives paused with the clock frozen`, ok, d);
  check('pause: P, the RESUME button and P resume (and coming back to the tab stays paused)', resumedP === 'play' && resumedBtn === 'play' && stillPaused === 'paused' && resumedRot === 'play',
    `P ${resumedP}, RESUME ${resumedBtn}, visible again ${stillPaused}, after rotation ${resumedRot}`);
  check('pause: the rotated layout does not scroll', dims.sw <= dims.iw && dims.sh <= dims.ih, JSON.stringify(dims));
  // MENU from the pause
  await page.keyboard.press('p');
  const m = centre((await ui(page)).menu);
  await page.mouse.click(m.x, m.y);
  st = await page.evaluate(() => CS.state().phase);
  check('pause: MENU goes to the title', st === 'title', st);
  await finish(g);
  // touch: the pause button, then RESUME by touch
  const h = await open(browser, { seed: 13, autostart: 1 }, { touch: true }); h.tag = 'pause touch';
  await until(h.page, () => CS.state().phase === 'play' && CS.state().handReady);
  const p = centre((await ui(h.page)).pause);
  await h.page.touchscreen.tap(p.x, p.y);
  const a = await h.page.evaluate(() => CS.state().phase);
  const rr = centre((await ui(h.page)).resume);
  await h.page.touchscreen.tap(rr.x, rr.y);
  const b = await h.page.evaluate(() => CS.state().phase);
  check('pause: touch on the pause button pauses, touch on RESUME resumes', a === 'paused' && b === 'play', `${a} -> ${b}`);
  // a touch player's window blur (a phone's notification shade, a long-press callout) leaves the game running
  await h.page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await h.page.waitForTimeout(100);
  const c = await h.page.evaluate(() => CS.state().phase);
  check('pause: a touch player\'s window blur does not pause (phones blur on their own; a real app switch hides the page)', c === 'play', c);
  await finish(h);
}

// ---------------------------------------------------------------- the hand does not carry over between runs
async function handChecks(browser) {
  const g = await open(browser, { seed: 14, autostart: 1, level: 2 }); g.tag = 'hand';
  const { page } = g;
  await until(page, () => CS.state().phase === 'play' && CS.state().handReady && !CS.state().locked);
  const slide = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(80); };
  const handAt = () => page.evaluate(() => ({ hx: HAND.x, dx: HAND.dx, mid: CS.cam().originX, L: CS.cam().L, ph: CS.state().phase }));
  await slide('ArrowRight', 700);
  const a0 = await handAt();
  await page.evaluate(() => CS.setClock(0.3));
  await until(page, () => CS.state().over && CS.state().over.open, null, 8000);
  await page.keyboard.press('r');
  await until(page, () => CS.state().phase === 'play', null, 3000);
  const a1 = await handAt();
  check('hand: a keyboard player slid right; AGAIN (R) starts the new run with the hand over the middle of the base',
    a0.hx - a0.mid > a0.L && Math.abs(a1.hx - a1.mid) < 1 && Math.abs(a1.dx - a1.mid) < 1, `slid to ${(a0.hx - a0.mid).toFixed(0)} px off the middle; after AGAIN ${(a1.hx - a1.mid).toFixed(1)} px`);
  await until(page, () => CS.state().phase === 'play' && CS.state().handReady && !CS.state().locked, null, 4000);
  await slide('ArrowLeft', 700);
  const b0 = await handAt();
  await page.evaluate(() => CS.setClock(0.3));
  await until(page, () => CS.state().over && CS.state().over.open, null, 8000);
  await page.keyboard.press('Escape');
  await until(page, () => CS.state().phase === 'title', null, 3000);
  await page.waitForTimeout(150);
  await page.keyboard.press('Space');
  await until(page, () => CS.state().phase === 'play', null, 4000);
  const b1 = await handAt();
  check('hand: slid left, then MENU and a new game: the hand starts over the middle of the base',
    b0.mid - b0.hx > b0.L && Math.abs(b1.hx - b1.mid) < 1, `slid to ${(b0.hx - b0.mid).toFixed(0)} px; after MENU + start ${(b1.hx - b1.mid).toFixed(1)} px`);
  await finish(g);
}

// ---------------------------------------------------------------- stored records are type-checked on load
async function prefsChecks(browser) {
  const cases = [
    { name: 'junk fields', best: { score: '9999', level: -3, cm: null, streak: 1e400 }, prefs: { big: 'yes', mute: 1, seenHint: null, played: true },
      wantBest: { score: 0, level: 0, cm: 0, streak: 0 }, wantPrefs: { big: false, mute: false, seenHint: false, played: true } },
    { name: 'good fields kept, bad ones dropped', best: { score: 1234, level: '7', cm: 88.5, streak: { n: 3 }, extra: 5 }, prefs: { big: false, mute: true, seenHint: 'no', played: [] },
      wantBest: { score: 1234, level: 0, cm: 88.5, streak: 0 }, wantPrefs: { big: false, mute: true, seenHint: false, played: false } },
    { name: 'not JSON / an array / null', bestRaw: '{oops', prefsRaw: '[true,true]', bigRaw: 'null',
      wantBest: { score: 0, level: 0, cm: 0, streak: 0 }, wantPrefs: { big: false, mute: false, seenHint: false, played: false } },
  ];
  for (const c of cases) {
    const ctx = await browser.newContext({ viewport: VIEW });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await ctx.addInitScript(c2 => {
      try {
        if (sessionStorage.getItem('seeded')) return;
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('clackstack.best', c2.bestRaw || JSON.stringify(c2.best));
        localStorage.setItem('clackstack.prefs', c2.prefsRaw || JSON.stringify(c2.prefs));
        if (c2.bigRaw) localStorage.setItem('clackstack.bestBig', c2.bigRaw);
      } catch (e) { /* no storage */ }
    }, c);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
    await page.goto(require('./lib.cjs').gameUrl({ mute: 1, nohint: 1, seed: 3 }), { waitUntil: 'load' });
    await until(page, () => window.CS && CS.state().phase === 'title', null, 15000);
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => ({ best: CS.best().normal, big: CS.best().big, prefs: Object.assign({}, PREFS), lid: loadBestCached().lines.join(' | '), bigOn: CS.state().big }));
    // and it plays: start, drop a tile
    await page.keyboard.press('Space');
    await until(page, () => CS.state().phase === 'play' && CS.state().handReady && !CS.state().locked, null, 6000).catch(() => {});
    await page.keyboard.press('Space');
    await page.waitForTimeout(600);
    const played = await page.evaluate(() => CS.events.some(e => e.type === 'land' || e.type === 'miss'));
    const same = (a, b) => Object.keys(b).every(k => a[k] === b[k]) && Object.keys(a).every(k => k in b);
    const okBest = same(r.best, c.wantBest), okPrefs = Object.keys(c.wantPrefs).every(k => r.prefs[k] === c.wantPrefs[k] || (k === 'played' && r.prefs.played === true && c.wantPrefs.played === false));
    check(`prefs: ${c.name}: each stored field type-checked on load (numbers finite and >= 0, booleans boolean), the defaults for the rest; the game plays`,
      okBest && same(r.big, { score: 0, level: 0, cm: 0, streak: 0 }) && okPrefs && r.bigOn === (c.wantPrefs.big === true) && !/NaN|undefined|Infinity/.test(r.lid) && played && errors.length === 0,
      `best ${JSON.stringify(r.best)}, prefs ${JSON.stringify(r.prefs)}, lid "${r.lid}", played ${played}${errors.length ? ', ' + errors[0] : ''}`);
    await ctx.close();
  }
}

// ---------------------------------------------------------------- the goal's sign
// a tall phone and a short one (390x844, 360x740), L1 and L3 built to the goal by real clicks: 0.35 s after the ribbon
// tears, the goal's sign is on screen and covers no standing tile, nor the cars under the build (the rug band under
// them may be short: the sign is then laid out compact to fit there)
async function goalSignChecks(browser) {
  for (const view of [{ width: 390, height: 844 }, { width: 360, height: 740 }]) for (const level of [1, 3]) {
    const g = await open(browser, { seed: 3, autostart: 1, level, ts: 2 }, { view, realClock: false }); g.tag = 'goalsign';
    const { page } = g;
    await until(page, () => CS.state().phase === 'play' && CS.state().handReady && !CS.state().locked, null, 15000);
    // (a builder that takes any slot when no safe one is left: a PERFECT tower can leave only tippy or hanging slots)
    let torn = false;
    for (let k = 0; k < 60 && !torn; k++) {
      await until(page, () => { const s = CS.state(); return s.goalTorn || (s.phase === 'play' && s.handReady && !s.locked && s.inAir === 0); }, null, 20000).catch(() => {});
      const p = await page.evaluate(() => {
        const st = CS.state(), sl = CS.slots(), safe = sl.filter(q => q.supported && !q.tippy), pool = safe.length ? safe : sl;
        pool.sort((a, b) => b.y - a.y || Math.abs(a.x) - Math.abs(b.x));
        return { torn: st.goalTorn, sx: pool.length ? pool[0].sx : null };
      });
      if (p.torn) { torn = true; break; }
      if (p.sx === null) { await page.keyboard.press('Shift'); continue; }
      await page.mouse.click(p.sx, view.height * 0.55);
      await waitGame(page, 0.25);
    }
    const gev = await page.evaluate(() => { const e = CS.events.filter(q => q.type === 'goal').pop(); return e ? e.t : null; });
    let r = null;
    if (torn && gev !== null) {
      await until(page, t => CS.state().t >= t, gev + 0.35, 8000).catch(() => {});
      r = await page.evaluate(() => {
        const sg = CS.words().find(w => w.kind === 'announce' && /^TALLER/.test(w.text)), c = CS.cam(), L = c.L, b = sg && sg.box;
        if (!b) return { sign: null };
        const over = CS.tiles().filter(t => { const e = t.ext; return b.x0 < t.sx + e[2] * L && b.x1 > t.sx - e[0] * L && b.y0 < t.sy + e[3] * L && b.y1 > t.sy - e[1] * L; }).length;
        // the cars: the base's width, from the plate the bottom row stands on down to the wheels on the rug
        const half = S.B ? S.B.half : 1, cx0 = c.originX - (half + 0.1) * L, cx1 = c.originX + (half + 0.1) * L;
        const car = b.x0 < cx1 && b.x1 > cx0 && b.y0 < c.baseY + 0.4 * L && b.y1 > c.baseY;
        return { sign: [b.x0, b.y0, b.x1, b.y1].map(Math.round), on: b.x0 >= 0 && b.x1 <= c.W && b.y0 >= 0 && b.y1 <= c.H, over, car, baseY: Math.round(c.baseY), L: +L.toFixed(1) };
      });
    }
    check(`goal sign: ${view.width}x${view.height} L${level}: the sign is on screen and covers no tile of the build, nor its cars`,
      torn && r && r.sign && r.on && r.over === 0 && !r.car, JSON.stringify({ torn, r }));
    await finish(g);
  }
}

// ---------------------------------------------------------------- the ribbon's icon and the arm
// the goal's icon on the ribbon is never under the holding arm: at a level start (the hand low, the arm stretched) with
// the hand moved by the mouse across the screen, at 1366x1024, 844x390 and 390x844, L1 and L3
async function armIconChecks(browser) {
  for (const view of [{ width: 1366, height: 1024 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
    const bad = [];
    let n = 0;
    for (const level of [1, 3]) {
      const g = await open(browser, { seed: 4, autostart: 1, level }, { view, realClock: false }); g.tag = 'armicon';
      const { page } = g;
      await until(page, () => CS.state().phase === 'play' && CS.state().handReady && !CS.state().locked, null, 15000);
      for (const fx of [0.08, 0.15, 0.25, 0.35, 0.5, 0.65, 0.85]) {
        await page.mouse.move(Math.round(view.width * fx), Math.round(view.height * 0.55));
        await waitGame(page, 0.45);
        const r = await page.evaluate(() => {
          const rb = CS.ribbon(), a = CS.arm();
          if (!rb.on || !rb.icon || !a.ok || rb.a < 0.5) return null;
          const seg = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0; return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
          const ic = rb.icon, fore = seg(ic.x, ic.y, a.wx, a.wy, a.ex, a.ey) - a.rf, up = seg(ic.x, ic.y, a.ex, a.ey, a.sx, a.sy) - a.ru;
          return { gap: Math.round(Math.min(fore, up) - ic.r), icon: [ic.x, ic.y].map(Math.round), elbow: [a.ex, a.ey].map(Math.round) };
        });
        if (!r) continue;
        n++;
        if (r.gap < 0 && bad.length < 4) bad.push(`L${level} hand at ${Math.round(fx * 100)}%: icon ${r.icon} elbow ${r.elbow} (${r.gap} px)`);
      }
      await finish(g);
    }
    check(`arm: ${view.width}x${view.height}: the goal's icon on the ribbon is never under the holding arm (hand low at a level start, moved across the screen)`,
      n >= 4 && bad.length === 0, `${n} poses; ${bad.join(' | ') || 'icon clear in all'}`);
  }
}

// ---------------------------------------------------------------- offline
// opened offline (no font stub: the network is simply down), the page asks for nothing it cannot have: no console
// error or warning, no page error, at 390x844 touch and 844x390 mouse, through the title and a few drops; back online,
// it asks for the web font once
async function offlineChecks(browser) {
  for (const [view, touch] of [[{ width: 390, height: 844 }, true], [{ width: 844, height: 390 }, false]]) {
    const ctx = await browser.newContext({ viewport: view, hasTouch: touch, isMobile: touch });
    const fontReqs = [];
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, route => { fontReqs.push(route.request().url()); route.fulfill({ status: 200, contentType: 'text/css', body: '' }); });
    await ctx.setOffline(true);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push('console.' + m.type() + ': ' + m.text()); });
    await page.goto(require('./lib.cjs').gameUrl({ mute: 1, nohint: 1, seed: 4 }), { waitUntil: 'load' });
    await until(page, () => window.CS && CS.state().phase === 'title', null, 15000);
    await page.waitForTimeout(300);
    if (touch) await page.touchscreen.tap(view.width / 2, view.height * 0.55); else await page.mouse.click(view.width / 2, view.height * 0.55);
    await until(page, () => CS.state().phase === 'play' && CS.state().handReady && !CS.state().locked, null, 8000).catch(() => {});
    for (let k = 0; k < 3; k++) {
      const sl = await page.evaluate(() => { const a = CS.slots().filter(q => q.supported); return a.length ? a[0].sx : null; });
      if (sl === null) break;
      if (touch) await page.touchscreen.tap(sl, view.height * 0.6); else await page.mouse.click(sl, view.height * 0.6);
      await page.waitForTimeout(500);
    }
    const offReqs = fontReqs.length, played = await page.evaluate(() => CS.events.some(e => e.type === 'land'));
    await ctx.setOffline(false);
    await page.waitForTimeout(500);
    check(`offline: ${view.width}x${view.height} ${touch ? 'touch' : 'mouse'}: opened offline, the page plays with no console error or warning and asks for no web font; back online it asks for it once`,
      errors.length === 0 && played && offReqs === 0 && fontReqs.length === 1,
      `font requests offline ${offReqs}, after ${fontReqs.length}; played ${played}${errors.length ? '; ' + errors.slice(0, 2).join(' | ') : ''}`);
    await ctx.close();
  }
}

// ---------------------------------------------------------------- mute
async function muteChecks(browser) {
  const g = await gamePage(browser, VIEW, { seed: 14, autostart: 1, nohint: 1 }, { realClock: true }); g.tag = 'mute';
  const { page } = g;
  await until(page, () => window.CS && CS.state().phase === 'play');
  const m0 = await page.evaluate(() => CS.audio().muted);
  await page.keyboard.press('m');
  const m1 = await page.evaluate(() => CS.audio().muted);
  await page.reload({ waitUntil: 'load' });
  await until(page, () => window.CS && CS.state().phase === 'play');
  const m2 = await page.evaluate(() => CS.audio().muted);
  const b = centre((await ui(page)).mute);
  await page.mouse.click(b.x, b.y);
  const m3 = await page.evaluate(() => CS.audio().muted);
  check('mute: M mutes, it survives a reload, the HUD button toggles it back', m0 === false && m1 === true && m2 === true && m3 === false, `${m0} -> M ${m1} -> reload ${m2} -> button ${m3}`);
  await finish(g);
}

// ---------------------------------------------------------------- crown, OOPS, OVERTIME
async function crownChecks(browser) {
  const g = await open(browser, { seed: 15, ts: 2, autostart: 1 }); g.tag = 'crown';
  const { page } = g;
  await until(page, () => CS.state().phase === 'play' && CS.state().handReady);
  await buildUntil(page, () => CS.state().crownInHand, 40);
  const st0 = await page.evaluate(() => ({ st: CS.state(), goal: CS.events.filter(e => e.type === 'goal').length, slots: CS.slots() }));
  check('crown: the ribbon tears and the crown drops into the hand', st0.st.crownInHand && st0.goal === 1 && st0.st.goalTorn, `goal events ${st0.goal}, crown in hand ${st0.st.crownInHand}`);
  check('crown: only triangle slots reaching the ribbon are offered', st0.slots.length > 0 && st0.slots.every(s => (s.type === 'up' || s.type === 'dn') && s.ly + (s.type === 'up' ? 2 : 1) * 0.866 / 3 >= st0.st.goal - 1e-6),
    st0.slots.map(s => s.key).join(' '));
  // a crown MISS: OOPS, a fresh crown
  await until(page, () => CS.state().inAir === 0 && CS.state().handReady);
  const far = await page.evaluate(() => { const sl = CS.slots(), c = CS.cam(); let best = 4, bd = -1; for (let px = 6; px < c.W - 6; px += 2) { const xw = (px - c.originX) / c.L, d = Math.min(...sl.map(s => Math.abs(s.x - xw))); if (d > bd) { bd = d; best = px; } } return { px: best, d: bd }; });
  if (far.d > 1.45) {
    await page.mouse.move(far.px, VIEW.height * 0.55); await page.mouse.down(); await page.mouse.up();
    await until(page, () => CS.state().handReady, null, 3000);
    await waitGame(page, 0.6);
    const m = await page.evaluate(() => ({ miss: CS.events.filter(e => e.type === 'miss' && e.crown).length, inHand: CS.state().crownInHand, combo: CS.state().combo }));
    check('crown: a crown MISS gives a fresh crown (OOPS) and resets the combo', m.miss === 1 && m.inHand && m.combo === 0, JSON.stringify(m));
  } else console.log(`     (crown MISS skipped: no spot ${far.d.toFixed(2)} L from every crown slot)`);
  // HOLD the crown: OVERTIME; a tile landing above the ribbon scores double
  await until(page, () => { const s = CS.state(); return s.phase === 'play' && s.handReady && !s.locked; });
  await page.keyboard.press('Shift');
  const ot = await page.evaluate(() => ({ ot: CS.state().overtime, held: CS.state().held, ev: CS.events.filter(e => e.type === 'overtime').length }));
  check('crown: HOLD on the crown starts OVERTIME', ot.ot && ot.held === 'crown' && ot.ev === 1, JSON.stringify(ot));
  const n0 = await page.evaluate(() => CS.events.filter(e => e.type === 'land').length);
  await buildUntil(page, () => CS.events.some(e => e.type === 'land' && e.ot), 8);
  const otl = await page.evaluate(() => CS.events.filter(e => e.type === 'land' && e.ot).slice(-1)[0] || null);
  // (pm: the multiplier the landing scored at; mult: after its own combo step)
  const exp = otl ? { perfect: 25, great: 15, clack: 10 }[otl.grade] * Math.min(3, otl.edges) * otl.pm * 2 : null;
  check('crown: in OVERTIME a tile landing above the ribbon scores double', otl && otl.pts === exp, otl ? `${otl.grade} ×${otl.edges} edges ×${otl.pm}: ${otl.pts} (want ${exp})` : 'no overtime landing');
  // swap the crown back and place it: CROWN bonus with k, +3 s, then the SMASH
  await until(page, () => { const s = CS.state(); return s.phase === 'play' && s.handReady && !s.locked; });
  await page.keyboard.press('Shift');
  const back = await page.evaluate(() => CS.state().crownInHand);
  const sl = await page.evaluate(() => CS.slots().sort((a, b) => b.y - a.y));
  if (back && sl.length) { await page.mouse.move(sl[0].sx, VIEW.height * 0.55); await page.mouse.down(); await page.mouse.up(); }
  await until(page, () => CS.events.some(e => e.type === 'crown'), null, 4000).catch(() => {});
  const cr = await page.evaluate(() => ({ e: CS.events.find(e => e.type === 'crown'), clock: CS.state().clock, ph: CS.state().phase }));
  const k = cr.e ? cr.e.k : -1;
  check('crown: crowning pays 100 × level × (1 + 0.5 k), +3 s, then the SMASH', back && cr.e && cr.e.pts === Math.round(100 * 1 * (1 + 0.5 * k)) && Math.abs(cr.e.clock - cr.e.clock0 - 3) < 1e-6 && cr.ph === 'smash',
    cr.e ? `k ${k}, ${cr.e.pts} pts, clock ${cr.e.clock0.toFixed(2)} -> ${cr.e.clock.toFixed(2)}, ${cr.ph}` : 'no crown');
  await until(page, () => CS.state().phase === 'play', null, 5000);
  const lv = await page.evaluate(() => CS.state());
  check('crown: the next level begins (L2, the cube in the bag, goal 5 L)', lv.level === 2 && lv.goal === 5 && !lv.goalTorn && !lv.overtime, `level ${lv.level}, G ${lv.goal}`);
  await finish(g);
}

// ---------------------------------------------------------------- rings
async function ringChecks(browser) {
  // placement on a few levels
  const bad = [];
  for (const level of [1, 3, 4, 7, 12]) {
    const g = await open(browser, { seed: 16 + level, autostart: 1, level }); g.tag = 'rings ' + level;
    await until(g.page, () => CS.state().phase === 'play');
    const st = await g.page.evaluate(() => CS.state());
    const want = level <= 3 ? 1 : 2, half = st.baseHalf;      // (DESIGN 15.5: 2 L on L1-L3, the 1.5 L long car on L4-L7, 1 L from L8)
    if (st.rings.length !== want) bad.push(`L${level}: ${st.rings.length} rings`);
    for (const r of st.rings) if (r.y < 0.35 * st.goal - 1e-6 || r.y > 0.75 * st.goal + 1e-6 || Math.abs(r.x) < half + 0.7 || Math.abs(r.x) > half + 2 + 1e-6) bad.push(`L${level}: ring at ${r.x.toFixed(2)},${r.y.toFixed(2)}`);
    if (st.rings.length === 2 && Math.sign(st.rings[0].x) === Math.sign(st.rings[1].x)) bad.push(`L${level}: both rings on one side`);
    await finish(g);
  }
  check('rings: 1 on L1-L3 and 2 after, 0.35-0.75 G high, 1-2 L outside the base, two on opposite sides', bad.length === 0, bad.join('; '));
  // RingBot (L3): a 2-wide trunk to the ring's height on the two columns at the base's edge on the ring's side (both
  // columns of a one-car base; DESIGN 15.5 put two cars, 4 L, under level 3), then squares hung out toward it
  const g = await open(browser, { seed: 21, ts: 2, autostart: 1, level: 3 }); g.tag = 'ringbot';
  const { page } = g;
  await until(page, () => CS.state().phase === 'play' && CS.state().handReady);
  let got = null;
  for (let k = 0; k < 60 && !got; k++) {
    await until(page, () => { const s = CS.state(); return (s.phase === 'play' && s.handReady && !s.locked) || s.phase === 'over'; }, null, 20000);
    const p = await page.evaluate(() => {
      const st = CS.state(), ring = st.rings.find(r => !r.got), sl = CS.slots();
      if (!ring || st.phase !== 'play') return { done: true };
      const side = Math.sign(ring.x);
      const inside = s => s.type === 'sq' && Math.abs(ring.x - s.lx) <= 0.65 && Math.abs(ring.y - s.ly) <= 0.65;
      const hit = sl.find(inside);
      if (hit) return { slot: hit, why: 'ring' };
      if (st.piece !== 'sq' && st.piece !== 'marble') return { throw: true };
      // the trunk: the lowest square on the two edge columns over the car; then a hanging square on the ring's row
      const row = Math.floor(ring.y), c1 = side * (st.baseHalf - 0.5), c2 = side * (st.baseHalf - 1.5);
      const trunk = sl.filter(s => s.type === 'sq' && s.supported && (Math.abs(s.lx - c1) < 0.1 || Math.abs(s.lx - c2) < 0.1) && s.ly < row + 0.6).sort((a, b) => a.ly - b.ly)[0];
      if (trunk) return { slot: trunk, why: 'trunk' };
      const hang = sl.filter(s => s.type === 'sq' && Math.abs(s.ly - (row + 0.5)) < 0.01 && Math.sign(s.lx) === side).sort((a, b) => Math.abs(a.lx - ring.x) - Math.abs(b.lx - ring.x))[0];
      if (hang) return { slot: hang, why: 'hang' };
      const any = sl.filter(s => s.type === 'sq' && s.supported && Math.sign(s.lx) === -side).sort((a, b) => a.ly - b.ly)[0];
      return any ? { slot: any, why: 'counter' } : { throw: true };
    });
    if (p.done) break;
    if (p.throw) { await page.mouse.move(4, VIEW.height * 0.55); await page.mouse.down(); await page.mouse.up(); await waitGame(page, 0.3); continue; }
    await until(page, () => Math.abs(CS.state().omega) < 0.05, null, 2000).catch(() => {});
    const sx = await page.evaluate(key => (CS.slots().find(s => s.key === key) || {}).sx, p.slot.key);
    await page.mouse.move(sx || p.slot.sx, VIEW.height * 0.55); await page.mouse.down(); await page.mouse.up();
    await waitGame(page, 0.5);
    const r = await page.evaluate(() => CS.events.find(e => e.type === 'ring'));
    if (r) got = r;
  }
  // the +2 s flies from the ring into the clock and counts when it gets there (a 'clock' event from the ring, ~0.4 s on)
  let add = null;
  if (got) {
    await waitGame(page, 0.6);
    add = await page.evaluate(t => CS.events.find(e => e.type === 'clock' && e.src === 'ring' && e.t >= t - 1e-9), got.t);
  }
  check('rings: RingBot collects a ring: +2 s on the clock (flown in within 0.5 s), +50 × mult',
    !!got && got.pts === 50 * got.mult && !!add && Math.abs(add.clock - add.clock0 - 2) < 1e-6 && add.t - got.t <= 0.5,
    got ? `ring at ${got.x.toFixed(2)},${got.y} by ${got.key}: +${got.pts} (×${got.mult}); ` + (add ? `clock ${add.clock0.toFixed(2)} -> ${add.clock.toFixed(2)} ${(add.t - got.t).toFixed(2)} s later` : 'no time added') : 'no ring collected');
  await finish(g);
}

// ---------------------------------------------------------------- order and clock (over every run)
// ---------------------------------------------------------------- crown with no triangle slot (no OOPS loop)
// the fixture: a build (found by a random search over reachable builds) whose goal-crossing triangle covers the last
// triangle slot; only a hanging square on the rug-left stays open
const LOCK_KEYS = ['up:0,0,0', 'sq:-2,0,0', 'up:-2,1,0', 'dn:-1,1,0', 'sq:-1,1,1', 'up:-1,2,1', 'dn:-2,2,1', 'cube:-2,2,2', 'up:0,4,2',
  'sq:-2,4,2', 'sq:-2,5,2', 'sq:-2,6,2', 'cube:-2,7,2', 'sq:-2,9,2', 'up:0,9,2', 'sq:-2,10,2'];
async function lockFixture(page) {
  return page.evaluate(keys => {
    const B = S.B, cols = Art.TILE_COLORS;
    for (const k of keys) {
      genSlots(B);
      const c = B.cands.find(q => q.key === k);
      if (!c) return { fail: k };
      const shape = c.type === 'sq' ? 'sq' : c.type === 'cube' ? 'cube' : 'tri';
      addTile(B, c.pose, { depth: c.depth, shape, color: cols[k.length % 7], variant: 0, mass: CFG.MASS[shape], k: CFG.KROT[shape], landT: -1 });
    }
    genSlots(B); recomputeTower(); massProps(B, true, COMMIT);
    HAND.piece = { shape: 'tri', color: 'blue', variant: 0 };
    S.clock = 60;
    return { top: S.top, G: S.G, slots: CS.slots().map(s => s.key) };
  }, LOCK_KEYS);
}
// (DESIGN 15.3: a 2-wide fixture tower 11-35 L tall is far past where the wobble SNAPs it on the next real drop. The
// checks that build one test the crown, the ribbon and the camera, not the wobble (tools/wobble.cjs): it is off there,
// a test fixture)
async function noWobble(page) { await page.evaluate(() => { CFG.WOB_A = { perfect: 0, great: 0, clack: 0 }; }); }
async function crownWaitChecks(browser) {
  const g = await open(browser, { seed: 1, autostart: 1, level: 9, ts: 2 }); g.tag = 'crownwait';
  const { page } = g;
  await until(page, () => CS.state().phase === 'play' && CS.state().handReady && !CS.state().locked);
  await noWobble(page);
  const fx = await lockFixture(page);
  if (fx.fail || fx.slots.join() !== 'up:-2,11,2') { check('crownwait: fixture build', false, JSON.stringify(fx)); await finish(g); return; }
  await waitGame(page, 0.3);
  const sl = await page.evaluate(() => CS.slots().find(s => s.key === 'up:-2,11,2'));
  await page.mouse.move(sl.sx, VIEW.height * 0.55); await page.mouse.down(); await page.mouse.up();
  await until(page, () => CS.events.some(e => e.type === 'goal'), null, 4000).catch(() => {});
  await waitGame(page, 0.3);
  const a = await page.evaluate(() => { const s = CS.state(); return { goal: CS.events.filter(e => e.type === 'goal').length, owed: s.crownOwed, inHand: s.crownInHand, piece: s.piece,
    slots: CS.slots().map(q => q.key), cands: S.B.cands.map(c => c.key), wait: CS.events.filter(e => e.type === 'crownwait').length }; });
  check('crownwait: the ribbon tears with no triangle slot left: the crown is owed, a normal tile stays in the hand', a.goal === 1 && a.owed && !a.inHand && a.piece !== 'crown' && a.wait === 1,
    JSON.stringify(a));
  // the HOLD box keeps a crown while no triangle slot exists (fixture: the crown banked, as in OVERTIME)
  const hold = await page.evaluate(() => {
    const keep = { held: S.held, ot: S.overtime, owed: S.crownOwed, piece: HAND.piece };
    S.held = makeCrown(); S.overtime = true; S.crownOwed = false; HAND.swapUsed = false;
    return keep;
  });
  await until(page, () => CS.state().handReady && !CS.state().locked, null, 4000);
  await page.keyboard.press('Shift');
  const h = await page.evaluate(() => ({ held: CS.state().held, inHand: CS.state().crownInHand }));
  check('crownwait: a crown in HOLD stays there while no triangle slot exists (Shift bonks)', h.held === 'crown' && !h.inHand, JSON.stringify(h));
  await page.evaluate(k => { S.held = k.held; S.overtime = k.ot; S.crownOwed = k.owed; }, hold);
  // a kid just keeps building: squares (and the cube) go on the open slot, anything else is thrown off to the side
  let given = null, taps = 0;
  for (let k = 0; k < 30 && !given; k++) {
    await until(page, () => { const s = CS.state(); return s.phase !== 'play' || (s.handReady && !s.locked && s.inAir === 0); }, null, 8000);
    const p = await page.evaluate(() => { const s = CS.state(); return { inHand: s.crownInHand, piece: s.piece, ph: s.phase, slots: CS.slots() }; });
    if (p.ph !== 'play') break;
    if (p.inHand) { given = p; break; }
    const tgt = p.slots[0];
    const x = tgt ? tgt.sx : 4;
    await page.mouse.move(x, VIEW.height * 0.55); await page.mouse.down(); await page.mouse.up(); taps++;
    await waitGame(page, 0.5);
  }
  const b = await page.evaluate(() => ({ crownMiss: CS.events.filter(e => e.type === 'miss' && e.crown).length, owed: CS.state().crownOwed, slots: CS.slots().map(s => s.key + (s.supported ? '' : '~')) }));
  check('crownwait: the crown drops into the hand once a landing opens a triangle slot (no crown MISS on the way)', !!given && taps >= 1 && given.slots.length > 0 && b.crownMiss === 0 && !b.owed,
    `${taps} taps; crown misses ${b.crownMiss}; crown slots ${b.slots.join(' ')}`);
  const c = given ? await page.evaluate(() => CS.slots().sort((p, q) => q.y - p.y)[0] || null) : null;
  if (c) {
    await page.mouse.move(c.sx, VIEW.height * 0.55); await page.mouse.down(); await page.mouse.up();
    await until(page, () => CS.events.some(e => e.type === 'level'), null, 6000).catch(() => {});
    const e = await page.evaluate(() => ({ crown: CS.events.filter(e => e.type === 'crown').length, smash: CS.events.filter(e => e.type === 'smash').length, level: CS.state().level,
      crownMiss: CS.events.filter(e => e.type === 'miss' && e.crown).length }));
    check('crownwait: crowning it SMASHes on to L10', e.crown === 1 && e.smash === 1 && e.level === 10 && e.crownMiss === 0, JSON.stringify(e));
  }
  await finish(g);
}

// ---------------------------------------------------------------- a press held over the new base's roll-in
async function pressBeforePark(page, view) {
  // slow the game right down near the end of the roll-in so the press lands 0.1 s (game) before the base parks
  await until(page, () => S.rollT0 >= 0 && S.gt >= S.lockUntil - 0.3 && S.lockUntil < 1e9, null, 10000);
  await page.evaluate(() => { PARAM.ts = 0.25; });
  await until(page, () => S.gt >= S.lockUntil - 0.1, null, 8000);
  const before = await page.evaluate(() => ({ id: CS.lastRelease ? CS.lastRelease.id : 0, left: S.lockUntil - S.gt, park: S.lockUntil, ph: S.phase, ready: HAND.ready }));
  const x = await page.evaluate(() => CS.cam().originX);
  await page.mouse.move(x, view.height * 0.55); await page.mouse.down(); await page.mouse.up();
  const pend = await page.evaluate(() => !!HAND.pending);
  await until(page, p => S.gt >= p + 0.3, before.park, 10000);
  await page.evaluate(() => { PARAM.ts = 2; });
  const after = await page.evaluate(() => ({ id: CS.lastRelease ? CS.lastRelease.id : 0, t: CS.lastRelease ? CS.lastRelease.t : null, ph: S.phase }));
  return { before, pend, released: after.id > before.id, at: after.t !== null ? +(after.t - before.park).toFixed(3) : null, left: +before.left.toFixed(3) };
}
async function pendingChecks(browser) {
  // the intro roll-in (title tap)
  {
    const g = await open(browser, { seed: 2 }); g.tag = 'pending intro';
    const { page } = g;
    await page.waitForTimeout(300);
    await page.mouse.click(VIEW.width / 2, VIEW.height * 0.45);
    const r = await pressBeforePark(page, VIEW);
    check('pending: a press 0.1 s before the intro base parks drops within 0.2 s of play', r.pend && r.released && r.at !== null && r.at <= 0.2, JSON.stringify(r));
    await finish(g);
  }
  // after a SMASH (L1, built to the crown and crowned through real clicks)
  {
    const g = await open(browser, { seed: 3, ts: 2, autostart: 1 }); g.tag = 'pending smash';
    const { page } = g;
    await until(page, () => CS.state().phase === 'play' && CS.state().handReady);
    await buildUntil(page, () => CS.state().crownInHand, 40);
    for (let k = 0; k < 6; k++) {
      if (await page.evaluate(() => CS.state().phase === 'smash' || CS.state().crownFlying)) break;
      await until(page, () => { const s = CS.state(); return (s.phase === 'play' && s.handReady && !s.locked && s.inAir === 0) || s.phase === 'smash'; }, null, 8000);
      const c = await page.evaluate(() => CS.state().crownInHand ? CS.slots().sort((a, b) => b.y - a.y)[0] || null : null);
      if (c) { await page.mouse.move(c.sx, VIEW.height * 0.55); await page.mouse.down(); await page.mouse.up(); }
      await waitGame(page, 0.3);
    }
    await until(page, () => CS.state().phase === 'smash', null, 8000).catch(() => {});
    const ph = await page.evaluate(() => CS.state().phase);
    if (ph !== 'smash') { check('pending: reached a SMASH', false, ph); await finish(g); return; }
    const r = await pressBeforePark(page, VIEW);
    check('pending: a press 0.1 s before the post-SMASH base parks drops within 0.2 s of play', r.pend && r.released && r.at !== null && r.at <= 0.2, JSON.stringify(r));
    await finish(g);
  }
}

// ---------------------------------------------------------------- a buzzer-beater crown
async function buzzerChecks(browser) {
  const g = await open(browser, { seed: 6, ts: 2, autostart: 1, level: 1 }); g.tag = 'buzzer';
  const { page } = g;
  await until(page, () => CS.state().phase === 'play' && CS.state().handReady);
  await buildUntil(page, () => CS.state().crownInHand, 40);
  await until(page, () => { const s = CS.state(); return s.phase === 'play' && s.handReady && !s.locked && s.inAir === 0; }, null, 8000);
  const c = await page.evaluate(() => CS.slots().sort((a, b) => b.y - a.y)[0] || null);
  if (!c) { check('buzzer: crown slot', false, 'none'); await finish(g); return; }
  await page.mouse.move(c.sx, VIEW.height * 0.55); await page.mouse.down(); await page.mouse.up();
  // the clock runs out while the crown is still in the air
  const flying = await page.evaluate(() => { const f = S.crownFlying; if (f) CS.setClock(0.01); return f; });
  await until(page, () => CS.events.some(e => e.type === 'crown' || e.type === 'over'), null, 5000).catch(() => {});
  const e = await page.evaluate(() => ({ crown: CS.events.find(e => e.type === 'crown') || null, over: CS.events.filter(e => e.type === 'over').length, ph: CS.state().phase }));
  check('buzzer: a crown in the air when the clock hits 0.0 lands, crowns (+3 s) and SMASHes', flying && !!e.crown && e.crown.clock0 === 0 && e.crown.clock === 3 && e.over === 0 && e.ph === 'smash',
    JSON.stringify({ flying, crown: e.crown && { clock0: e.crown.clock0, clock: e.crown.clock, pts: e.crown.pts }, over: e.over, ph: e.ph }));
  await until(page, () => CS.state().phase === 'play' || CS.state().phase === 'over', null, 6000).catch(() => {});
  const n = await page.evaluate(() => ({ ph: CS.state().phase, level: CS.state().level, clock: CS.state().clock }));
  check('buzzer: the run goes on at L2 with the level bonus on the clock', n.ph === 'play' && n.level === 2 && n.clock > 10, JSON.stringify(n));
  await finish(g);
}

function orderCheck() {
  const bad = [];
  let levels = 0;
  for (const run of allEvents) {
    let expect = 'goal', lv = null;
    for (const e of run.ev) {
      if (e.type === 'start') { expect = 'goal'; lv = e.level; continue; }
      if (!/^(goal|crown|smash|level|crash|topple)$/.test(e.type) || e.over) continue;
      if (e.type === 'crash' || e.type === 'topple') { if (expect === 'crown') expect = 'goal'; continue; }
      if (e.type === 'goal') { if (expect !== 'goal') bad.push(`${run.tag}: goal while expecting ${expect} @${e.t}`); expect = 'crown'; }
      else if (e.type === 'crown') { if (expect !== 'crown') bad.push(`${run.tag}: crown while expecting ${expect} @${e.t}`); expect = 'smash'; }
      else if (e.type === 'smash') { if (expect !== 'smash') bad.push(`${run.tag}: smash while expecting ${expect} @${e.t}`); expect = 'level'; }
      else if (e.type === 'level') { if (expect !== 'level' || (lv !== null && e.level !== lv + 1)) bad.push(`${run.tag}: level ${e.level} while expecting ${expect} @${e.t}`); expect = 'goal'; lv = e.level; levels++; }
    }
  }
  check('order: every level logs goal, then crown, then smash, then level', bad.length === 0 && levels >= 10, `${levels} levels completed over all runs` + (bad.length ? '; ' + bad.slice(0, 4).join('; ') : ''));
}

// ---------------------------------------------------------------- the camera at the SMASH and at TIME! on a tall tower
// (fixture: a 2-wide column of squares n L tall, built with the lattice functions; the drops that matter are real)
async function columnFixture(page, n) {
  return page.evaluate((n) => {
    for (let a = 0; a < n; a++) for (const i of [-2, 0]) {
      const c = S.B.cands.find(q => q.key === 'sq:' + i + ',' + a + ',0');
      if (!c) return false;
      addTile(S.B, c.pose, { shape: 'sq', color: a % 2 ? 'blue' : 'yellow', variant: 0, mass: 1, k: 1 / 6, depth: c.depth, flight: false, landT: -1 });
      genSlots(S.B);
    }
    recomputeTower(); massProps(S.B, true, COMMIT); S.clock = 60;
    return true;
  }, n);
}
async function cameraChecks(browser) {
  for (const [w, h, level] of [[844, 390, 9], [390, 844, 13]]) {
    const view = { width: w, height: h };
    const g = await open(browser, { seed: 5, autostart: 1, level, big: 1 }, { view }); g.tag = 'smashcam';
    const { page } = g;
    await until(page, () => CS.state().phase === 'play' && CS.state().handReady && !CS.state().locked);
    const ok = await columnFixture(page, (await page.evaluate(() => S.G)));
    await page.evaluate(() => checkGoal());
    await waitGame(page, 1.2);
    // the camera's view on the frame the cube hits
    await page.evaluate(() => {
      window.__hit = null;
      (function f() {
        try { if (!window.__hit && CS.events.some(e => e.type === 'smash')) window.__hit = { cubeY: CUBE.on ? CAM.baseY - (CUBE.y + 0.5) * CAM.L : null, rugY: CAM.baseY, H: CAM.H, camY: CAM.camY }; } catch (e) { }
        if (!window.__hit) requestAnimationFrame(f);
      })();
    });
    const pre = await page.evaluate(() => ({ camY: CAM.camY, crown: CS.state().crownInHand }));
    const sl = await page.evaluate(() => CS.slots().sort((a, b) => b.y - a.y)[0] || null);
    if (sl) { await page.mouse.move(sl.sx, h * 0.3); await page.mouse.down(); await page.mouse.up(); }
    await until(page, () => !!window.__hit, null, 6000).catch(() => {});
    const r = await page.evaluate(() => window.__hit);
    check(`camera: ${w}x${h} L${level}: when the SMASH cube hits a tower that had scrolled the camera, the cube and the rug are on screen`,
      ok && pre.crown && pre.camY > 20 && !!r && r.cubeY !== null && r.cubeY >= 0 && r.cubeY <= r.H && r.rugY <= r.H,
      JSON.stringify({ scrolledBefore: +pre.camY.toFixed(0), hit: r && { cubeY: r.cubeY && +r.cubeY.toFixed(0), rugY: +r.rugY.toFixed(0), H: r.H, camY: +r.camY.toFixed(0) } }));
    await finish(g);
  }
  {
    const view = { width: 844, height: 390 };
    const g = await open(browser, { seed: 5, autostart: 1, level: 9, big: 1, ts: 2 }, { view }); g.tag = 'overcam';
    const { page } = g;
    await until(page, () => CS.state().phase === 'play' && CS.state().handReady && !CS.state().locked);
    await columnFixture(page, 10);
    await waitGame(page, 1.0);
    const camY = await page.evaluate(() => CAM.camY);
    await page.evaluate(() => CS.setClock(0.05));
    await until(page, () => CS.state().over && CS.state().over.open, null, 8000).catch(() => {});
    await waitGame(page, 0.6);
    const r = await page.evaluate(() => {
      const on = CS.debris().filter(d => d.sy >= 0 && d.sy <= CAM.H && d.sx >= 0 && d.sx <= CAM.W).length;
      return { on, n: DEBRIS.length, rugY: CAM.baseY, H: CAM.H };
    });
    check('camera: TIME! on a 10 L tower (844x390): on the results card the rug and at least half the pile are on screen',
      camY > 20 && r.n > 0 && r.on >= r.n / 2 && r.rugY <= r.H, JSON.stringify(Object.assign({ scrolledBefore: +camY.toFixed(0) }, r)));
    const a = (await ui(page)).again;
    await page.mouse.click(a.x + a.w / 2, a.y + a.h / 2);
    await until(page, () => CS.state().phase === 'play', null, 4000).catch(() => {});
    const p = await page.evaluate(() => ({ ph: CS.state().phase, rugY: CAM.baseY, H: CAM.H }));
    check('camera: AGAIN after it: the new cars roll in on the rug in view', p.ph === 'play' && p.rugY <= p.H, JSON.stringify(p));
    await finish(g);
  }
  // past the zoom floor, the goal far: 2-3 L of air over the build top (to the hand's highest line); the goal near:
  // the ribbon framed under that line
  for (const view of [{ width: 390, height: 844 }, { width: 1366, height: 1024 }]) {
    const g = await open(browser, { seed: 5, autostart: 1, level: 16, big: 1 }, { view }); g.tag = 'aircam';
    const { page } = g;
    await until(page, () => CS.state().phase === 'play' && CS.state().handReady && !CS.state().locked);
    const air = async (rows) => {
      await page.evaluate((rows) => {
        for (let a = 0; a < rows; a++) for (const i of [-2, 0]) {
          const c = S.B.cands.find(q => q.key === 'sq:' + i + ',' + a + ',0');
          if (!c) continue;
          addTile(S.B, c.pose, { shape: 'sq', color: a % 2 ? 'blue' : 'yellow', variant: 0, mass: 1, k: 1 / 6, depth: c.depth, flight: false, landT: -1 });
          genSlots(S.B);
        }
        recomputeTower(); massProps(S.B, true, COMMIT); S.clock = 60;
      }, rows);
      await waitGame(page, 1.5);
      return page.evaluate(() => {
        const c = CS.cam(), st = CS.state(), topY = c.baseY - (st.top + 0.5) * c.L;
        return { L: +c.L.toFixed(1), camY: +c.camY.toFixed(0), top: +st.top.toFixed(1), G: st.goal, air: +((topY - c.handTop) / c.L).toFixed(2), ribY: +(c.baseY - (st.goal + 0.5) * c.L).toFixed(0), handTop: c.handTop, gauge: gaugeOn() };
      });
    };
    const far = await air(await page.evaluate(() => Math.ceil(S.G - 8)));
    const near = await air(await page.evaluate(() => Math.ceil(S.G - 2)));
    check(`camera: ${view.width}x${view.height} L16 past the zoom floor: 2-3 L of air over the build with the goal far, the ribbon framed when near`,
      far.gauge && far.camY > 0 && far.air >= 2 && far.air <= 3 && near.top >= near.G - 3.2 && near.ribY >= near.handTop - 2 && near.ribY <= view.height,
      `far ${JSON.stringify(far)}; near ${JSON.stringify(near)}`);
    await finish(g);
  }
  // the goal coming near past the zoom floor: a 31-row tower (G 35), then real drops on the top; every frame with a
  // tile showing in the hand, the ribbon is never drawn through it (handY + 0.1 L .. its bottom - 0.1 L) or along its
  // bottom edge (within 0.12 L of it), however faint. Calm drops (each tile at rest first), and quick ones (the next
  // tile dropped the moment it is in the hand, the one before still in the air)
  for (const quick of [false, true]) for (const view of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1366, height: 1024 }]) {
    const g = await open(browser, { seed: 5, autostart: 1, level: 16, big: 1 }, { view }); g.tag = 'ribnear';
    const { page } = g;
    await until(page, () => CS.state().phase === 'play' && CS.state().handReady && !CS.state().locked);
    await noWobble(page);
    await page.evaluate(() => {
      for (let a = 0; a < 31; a++) for (const i of [-2, 0]) {
        const c = S.B.cands.find(q => q.key === 'sq:' + i + ',' + a + ',0');
        if (!c) continue;
        addTile(S.B, c.pose, { shape: 'sq', color: a % 2 ? 'blue' : 'yellow', variant: 0, mass: 1, k: 1 / 6, depth: c.depth, flight: false, landT: -1 });
        genSlots(S.B);
      }
      recomputeTower(); massProps(S.B, true, COMMIT); S.clock = 60;
      const R = window.__rib = { frames: 0, through: [], edge: [], inAir: 0 };
      (function f() {
        try {
          if ((S.phase === 'play' || S.phase === 'crash') && HAND.piece && heldAlpha() > 0.3 && HAND.piece.shape !== 'crown') {
            const L = CAM.L, rb = CS.ribbon();
            if (rb.on && rb.a > 0.01) {
              R.frames++;
              if (S.flights.length) R.inAir++;
              const d = (rb.y - CAM.handY) / L, bot = heldTileBottom(HAND.piece.shape), o = { t: +S.gt.toFixed(2), d: +d.toFixed(2), a: +rb.a.toFixed(2), air: S.flights.length };
              if (d > 0.1 && d < bot - 0.1) { if (R.through.length < 6) R.through.push(o); }
              else if (d >= bot - 0.1 && d <= bot + 0.12) { if (R.edge.length < 6) R.edge.push(o); }
            }
          }
        } catch (e) { R.err = String(e); }
        requestAnimationFrame(f);
      })();
    });
    await waitGame(page, 1.5);
    let drops = 0;
    const top0 = await page.evaluate(() => S.top);
    for (let k = 0; k < (quick ? 6 : 4); k++) {
      if (quick) await until(page, () => { const s = CS.state(); return s.phase === 'play' && s.handReady && !s.locked; }, null, 10000);
      else {
        await until(page, () => { const s = CS.state(); return s.phase === 'play' && s.handReady && !s.locked && s.inAir === 0; }, null, 10000);
        await waitGame(page, 0.7);
      }
      // (quick: the slot on top of the column, or of the tile still falling onto it)
      const pick = () => page.evaluate(() => { const sl = CS.slots().filter(q => q.type === 'sq' && (q.supported || S.flights.length)); sl.sort((a, b) => b.y - a.y || Math.abs(a.x) - Math.abs(b.x)); return { sl: sl[0] || null, piece: CS.state().piece }; });
      let s = await pick();
      if (!s.sl || (s.piece !== 'sq' && s.piece !== 'marble')) { await page.keyboard.press('Shift'); await waitGame(page, 0.1); s = await pick(); }
      if (!s.sl || (s.piece !== 'sq' && s.piece !== 'marble')) continue;
      await page.mouse.click(s.sl.sx, view.height * 0.6);
      drops++;
      await waitGame(page, quick ? 0.05 : 1.5);
    }
    await waitGame(page, 1.5);
    const r = await page.evaluate(() => ({ R: window.__rib, top: S.top, G: S.G, near: goalNear(S.top) }));
    check(`camera: ${view.width}x${view.height} the goal coming near past the zoom floor (${quick ? 'quick drops, a tile still in the air' : 'calm drops'}): the ribbon is never drawn through the tile in the hand nor along its bottom edge`,
      drops >= 3 && r.top > top0 && r.near && r.R.frames > 60 && r.R.through.length === 0 && r.R.edge.length === 0 && !r.R.err && (!quick || r.R.inAir > 0),
      `${drops} drops, top ${top0} -> ${r.top} (goal ${r.G}), ${r.R.frames} frames (${r.R.inAir} with a tile in the air): through ${JSON.stringify(r.R.through)}, at its edge ${JSON.stringify(r.R.edge)}${r.R.err ? ' ' + r.R.err : ''}`);
    await finish(g);
  }
}

(async () => {
  const browser = await launch();
  try {
    if (want('title')) await titleChecks(browser);
    if (want('tapper') || want('order') || want('clock')) {
      const normal = [], big = [];
      for (const seed of SEEDS) normal.push(await randomTapper(browser, seed, false));
      for (const seed of SEEDS) big.push(await randomTapper(browser, seed, true));
      const okN = normal.filter(r => r.cleared !== null && r.cleared <= 20), okB = big.filter(r => r.cleared !== null && r.cleared <= 15);
      const fmt = rs => rs.map(r => `s${r.seed}:${r.cleared === null ? '-' : r.cleared.toFixed(1)}`).join(' ');
      if (want('tapper')) {
        check('RandomTapper: clears L1 within 20 s game time in >= 9/10 seeds (normal)', okN.length >= Math.ceil(normal.length * 0.9), `${okN.length}/${normal.length}: ${fmt(normal)}`);
        check('RandomTapper: clears L1 within 15 s game time in 10/10 seeds (big=1)', okB.length === big.length, `${okB.length}/${big.length}: ${fmt(big)}`);
      }
      // the clock during each SMASH: never goes down; and it ran down again after
      const runs = normal.concat(big).filter(r => r.smashClock.length);
      let down = 0, worst = 0, n = 0;
      for (const r of runs) {
        const s = r.smashClock;
        for (let i = 1; i < s.length; i++) { if (s[i].t - s[i - 1].t > 0.5) continue; const d = s[i - 1].clock - s[i].clock; if (d > 1e-9) { down++; worst = Math.max(worst, d); } n++; }
      }
      if (want('clock')) check('clock: frozen during every SMASH (never counts down; the bonuses only add)', runs.length >= 5 && down === 0, `${runs.length} smashes, ${n} frames, ${down} down-ticks (worst ${worst.toFixed(3)} s)`);
    }
    if (want('over')) { await overChecks(browser); await timeSmashChecks(browser); }
    if (want('best')) await bestChecks(browser);
    if (want('pause')) await pauseChecks(browser);
    if (want('mute')) await muteChecks(browser);
    if (want('crown')) await crownChecks(browser);
    if (want('rings')) await ringChecks(browser);
    if (want('crownwait')) await crownWaitChecks(browser);
    if (want('pending')) await pendingChecks(browser);
    if (want('buzzer')) await buzzerChecks(browser);
    if (want('camera')) await cameraChecks(browser);
    if (want('hand')) await handChecks(browser);
    if (want('prefs')) await prefsChecks(browser);
    if (want('offline')) await offlineChecks(browser);
    if (want('goalsign')) await goalSignChecks(browser);
    if (want('armicon')) await armIconChecks(browser);
    if (want('order') || want('tapper')) orderCheck();
    check('flow: no page or console errors', allErrors.length === 0, allErrors.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
  }
  console.log(failures ? `FLOW: ${failures} check(s) failed` : 'FLOW: all checks passed');
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
