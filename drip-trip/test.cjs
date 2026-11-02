'use strict';

// Browser regression checks. All hops go through real browser input; only the
// clock is advanced manually so exact landing boundaries are reproducible.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const html = fs.readFileSync(path.join(__dirname, 'index.html'));
const errors = [];
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }

async function state(page) { return page.evaluate(() => dripTest.state()); }
async function advanceToLanding(page) {
  return page.evaluate(() => {
    for (let i = 0; i < 800 && dripTest.state().mode === 'flying'; i++) dripTest.step(1 / 240);
    return dripTest.state();
  });
}
async function jump(page, power, input = 'keyboard') {
  if (input === 'keyboard') await page.keyboard.down('Space');
  else {
    const box = await page.locator('#game').boundingBox();
    await page.mouse.move(box.x + box.width * .45, box.y + box.height * .65);
    await page.mouse.down();
  }
  check((await state(page)).mode === 'charging', `${input} starts charging`);
  const prediction = await page.evaluate(power => {
    dripTest.step(power * 1.18);
    return dripTest.predict(dripTest.state().charge);
  }, power);
  if (input === 'keyboard') await page.keyboard.up('Space');
  else await page.mouse.up();
  check((await state(page)).mode === 'flying', `${input} release launches`);
  return prediction;
}

(async () => {
  const server = http.createServer((request, response) => {
    if (request.url.split('?')[0] !== '/') { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    // Stop automatic time, while preserving native keyboard, mouse, focus and
    // touch event dispatch. The game still uses its unmodified step function.
    await context.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url + '?test=1');
    await page.waitForFunction(() => window.dripTest);

    const route = await page.evaluate(() => {
      let pairs = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const platforms = dripTest.makeRoute(seed);
        if (platforms.length !== 19) return { error: `Seed ${seed}: wrong route length` };
        for (let i = 0; i < 18; i++) {
          const source = platforms[i], target = platforms[i + 1];
          if (!(target.x > source.x && target.width > 30)) return { error: 'Invalid platform geometry' };
          // Both real launch possibilities: a safe landing, or one perfect tile.
          for (const stack of [0, 1]) {
            let safe = false, perfect = false;
            for (let k = 0; k <= 400; k++) {
              const hit = dripTest.crossing({x: source.x, y: source.y - stack * 17 - 15, ...dripTest.velocity(k / 400)}, target);
              if (hit && hit.hit) safe = true;
              if (hit && hit.hit && hit.perfect) perfect = true;
            }
            if (!safe || !perfect) return { error: `Unreachable seed ${seed}, hop ${i + 1}, stack ${stack}` };
            pairs++;
          }
        }
      }
      return { pairs };
    });
    check(!route.error, route.error || 'All generated routes reachable');
    check(route.pairs === 14400, '14,400 generated launch/landing pairs admit safe and perfect jumps');

    // A real mouse hop must cross at the ghost's time, then stack precisely
    // once. Checking either side catches a misleading arc or early collision.
    await page.evaluate(() => dripTest.reset(1234));
    const best = await page.evaluate(() => dripTest.bestPower());
    const hit = await jump(page, best, 'mouse');
    check(hit.hit && hit.perfect, 'Centered ghost predicts a perfect landing');
    await page.evaluate(t => dripTest.step(t - .0001), hit.t);
    let snapshot = await state(page);
    check(snapshot.mode === 'flying' && snapshot.current === 0, 'No landing before the predicted intersection');
    check(Math.abs(snapshot.player.x - hit.x) < .1, 'Live drop reaches the ghost position at its predicted time');
    await page.evaluate(() => dripTest.step(.0002));
    snapshot = await state(page);
    check(snapshot.current === 1 && snapshot.mode === 'ready', 'Landing occurs at the ghost intersection');
    check(snapshot.platforms[1].stack === 1 && snapshot.perfects === 1 && snapshot.streak === 1, 'Perfect landing adds one magnetic tile and one streak step');
    check(snapshot.platforms[1].diamond === false, 'Landing collects the diamond');

    // Pause must freeze the water and cancel an unreleased charge.
    await page.keyboard.down('Space');
    await page.evaluate(() => dripTest.step(.3));
    await page.keyboard.press('KeyP');
    const paused = await state(page);
    check(paused.mode === 'paused', 'Pause key pauses a charging hop');
    await page.evaluate(() => dripTest.step(10));
    check((await state(page)).water === paused.water, 'Pause freezes dampness');
    await page.keyboard.up('Space');
    await page.locator('#resume').click();
    check((await state(page)).mode === 'ready', 'Resume cancels the old charge safely');

    // A deliberate short hop must cost the advertised rescue penalty, retain
    // progress, and leave already-collected items/tiles untouched.
    const beforeMiss = await state(page);
    const short = await jump(page, 0);
    check(short && !short.hit, 'Very short hop is honestly marked as a miss');
    const recovery = await page.evaluate(() => {
      let activeTime = 0;
      while (dripTest.state().mode === 'flying' && activeTime < 4) { dripTest.step(1 / 240); activeTime += 1 / 240; }
      return { state: dripTest.state(), activeTime };
    });
    check(recovery.state.mode === 'recover', 'Miss enters a recoverable rug rescue');
    check(Math.abs(recovery.state.water - (beforeMiss.water - 24 - recovery.activeTime * 1.45)) < .01, 'Miss spends 24 dampness plus elapsed drying');
    await page.evaluate(() => dripTest.step(.7));
    snapshot = await state(page);
    check(snapshot.mode === 'ready' && snapshot.current === beforeMiss.current && snapshot.falls === 1, 'Rescue returns to the last safe tower');
    check(snapshot.player.x === beforeMiss.player.x && snapshot.player.y === beforeMiss.player.y, 'Rescue restores the safe launch position');
    check(snapshot.perfects === beforeMiss.perfects && snapshot.platforms[1].stack === 1 && !snapshot.platforms[1].diamond, 'Rescue cannot duplicate a tile, perfect or diamond');

    // Complete the entire real-input journey. Both checkpoint modals must
    // freeze water; both chosen relics must affect the actual game state.
    await page.evaluate(() => dripTest.reset(20261102));
    for (let hop = 1; hop <= 18; hop++) {
      const power = await page.evaluate(() => dripTest.bestPower());
      const forecast = await jump(page, power);
      check(forecast && forecast.hit && forecast.perfect, `Hop ${hop}: centered trajectory remains reachable`);
      snapshot = await advanceToLanding(page);
      check(snapshot.current === hop, `Hop ${hop}: progress advances once`);
      if (hop === 6 || hop === 12) {
        check(snapshot.mode === 'relic', `Checkpoint ${hop / 6} opens its gift choice`);
        const heldWater = snapshot.water;
        await page.evaluate(() => dripTest.step(5));
        check((await state(page)).water === heldWater, 'Relic selection freezes dampness');
        const edgePower = hop === 6 ? await page.evaluate(() => {
          const s = dripTest.state(), next = s.platforms[s.current + 1];
          for (let i = 0; i <= 1000; i++) {
            const p = i / 1000, prediction = dripTest.predict(p);
            const distance = prediction && Math.abs(prediction.x - next.x);
            if (prediction && !prediction.hit && distance < next.width / 2 + 5) return p;
          }
          return null;
        }) : null;
        await page.locator(hop === 6 ? '#wide' : '#wax').click();
        const gift = await state(page);
        check(gift.mode === 'ready', 'Choosing a gift resumes play');
        check(hop === 6 ? gift.wide === 1 : gift.wax === 1, 'Selected relic is applied');
        if (hop === 6) {
          check(edgePower !== null, 'An edge trajectory exists to test the wider landing zone');
          check(await page.evaluate(power => dripTest.predict(power).hit, edgePower), 'Wider towers turn a previously missed edge trajectory into a safe landing');
        }
        if (hop === 12) {
          await page.evaluate(() => dripTest.setWater(70));
          await page.evaluate(() => dripTest.step(2));
          check(Math.abs((await state(page)).water - 67.97) < .001, 'Waxed coat reduces the real drying rate by 30 percent');
        }
      }
    }
    snapshot = await state(page);
    check(snapshot.mode === 'won' && snapshot.current === 18, 'Eighteenth hop reaches the win state');
    check(snapshot.perfects === 18 && snapshot.falls === 0 && snapshot.wide === 1 && snapshot.wax === 1, 'Full journey applies both gifts without losing progress');
    check(await page.locator('#card').innerText().then(t => t.includes('You made a little')), 'Win screen is visible');
    const winningWater = snapshot.water;
    await page.evaluate(() => dripTest.step(20));
    check((await state(page)).water === winningWater, 'Winning freezes dampness');
    await page.locator('#again').click();
    await page.evaluate(() => { dripTest.setWater(.01); dripTest.step(.1); });
    snapshot = await state(page);
    check(snapshot.mode === 'lost' && snapshot.water === 0, 'Drying to zero loses cleanly');
    check(await page.locator('#again').isVisible(), 'Loss offers a working retry');
    await page.locator('#again').click();
    check((await state(page)).mode === 'ready' && (await state(page)).water === 100, 'Retry restores a fresh run');

    const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await phoneContext.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    const phone = await phoneContext.newPage();
    phone.on('pageerror', error => errors.push(error.message));
    await phone.goto(url + '?test=1');
    await phone.locator('#start').tap();
    const box = await phone.locator('#game').boundingBox();
    const cdp = await phoneContext.newCDPSession(phone);
    const touch = { x: box.x + box.width * .5, y: box.y + box.height * .65 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
    check((await state(phone)).mode === 'charging', 'Phone touch starts a hop');
    await phone.evaluate(() => dripTest.step(dripTest.bestPower() * 1.18));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    check((await state(phone)).mode === 'flying', 'Phone touch release launches');
    const phoneLanding = await advanceToLanding(phone);
    check(phoneLanding.current === 1 && phoneLanding.perfects === 1, 'Phone touch completes a perfect hop');
    check(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Phone layout has no horizontal scroll');
    check(await phone.evaluate(() => getComputedStyle(document.getElementById('game')).touchAction === 'none'), 'Touch interaction cannot pan the game surface');
    await phoneContext.close();

    // The testing interface must not be present in ordinary playable builds.
    await page.goto(url);
    check(await page.evaluate(() => !('dripTest' in window)), 'Production URL does not expose test controls');
    check(errors.length === 0, `No browser exceptions: ${errors.join('; ')}`);
    console.log(`PASS: ${checks} browser checks, ${route.pairs.toLocaleString()} reachable generated jumps, desktop + touch, complete 18-hop journey.`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
