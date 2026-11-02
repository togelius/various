'use strict';

// Use real browser input and the real simulation. Freeze RAF only for exact
// action timing; the separate live-clock check exercises ordinary rendering.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const errors = [];
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function close(actual, expected, message, tolerance = .001) { check(Math.abs(actual - expected) < tolerance, `${message}: ${actual} vs ${expected}`); }
const state = page => page.evaluate(() => dripTest.state());
const step = (page, dt) => page.evaluate(dt => dripTest.step(dt), dt);
async function reset(page, seed = 1234) { await page.evaluate(seed => dripTest.reset(seed), seed); }
async function settle(page) {
  return page.evaluate(() => {
    let seconds = 0;
    while (dripTest.state().mode === 'flying' && seconds < 4) { dripTest.step(1 / 240); seconds += 1 / 240; }
    return { state: dripTest.state(), seconds };
  });
}
async function powerFor(page, offset = 0) {
  return page.evaluate(offset => {
    const s = dripTest.state(), x = s.platforms[s.current + 1].x + offset;
    let best = null, distance = Infinity;
    for (let i = 0; i <= 2000; i++) {
      const power = i / 2000, hit = dripTest.predict(power);
      if (hit && Math.abs(hit.x - x) < distance) { best = power; distance = Math.abs(hit.x - x); }
    }
    return best;
  }, offset);
}
async function jump(page, power, input = 'keyboard') {
  if (input === 'keyboard') await page.keyboard.down('Space');
  else { const box = await page.locator('#game').boundingBox(); await page.mouse.move(box.x + box.width * .4, box.y + box.height * .7); await page.mouse.down(); }
  check((await state(page)).mode === 'charging', `${input} press charges`);
  await step(page, power * 1.18);
  const hit = await page.evaluate(() => dripTest.predict(dripTest.state().charge));
  if (input === 'keyboard') await page.keyboard.up('Space'); else await page.mouse.up();
  check((await state(page)).mode === 'flying', `${input} release launches`);
  check((await state(page)).dashes === 0 || !(await state(page)).dashUsed, 'Launch release never fires a dash');
  return hit;
}
async function dash(page, input = 'keyboard') {
  if (input === 'keyboard') await page.keyboard.press('Space');
  else { const box = await page.locator('#game').boundingBox(); await page.mouse.click(box.x + box.width * .5, box.y + box.height * .7); }
}

(async () => {
  const server = http.createServer((request, response) => {
    if (request.url.split('?')[0] !== '/') { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(fs.readFileSync(path.join(__dirname, 'index.html')));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  try {
    browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']});
    const context = await browser.newContext({ viewport: {width: 1280, height: 900} });
    await context.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(url + '?test=1');
    await page.waitForFunction(() => window.dripTest);
    check((await state(page)).mode === 'title', 'Title waits for the player');

    const routes = await page.evaluate(() => {
      let pairs = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const route = dripTest.makeRoute(seed);
        if (route.length !== 19) return {error: 'Incorrect route length'};
        for (let i = 0; i < 18; i++) {
          const source = route[i], target = route[i + 1];
          if (!(target.x > source.x && target.width > 30)) return {error: 'Invalid route geometry'};
          let safe = false, perfect = false;
          for (let k = 0; k <= 400; k++) {
            const hit = dripTest.crossing({x: source.x, y: source.y - 15, ...dripTest.velocity(k / 400)}, target);
            if (hit?.hit) safe = true;
            if (hit?.hit && hit.perfect) perfect = true;
          }
          if (!safe || !perfect) return {error: `Unreachable normal hop: seed ${seed}, hop ${i + 1}`};
          pairs++;
        }
      }
      return {pairs};
    });
    check(!routes.error, routes.error || 'Every generated hop remains reachable without a paid dash');
    check(routes.pairs === 7200, '7,200 generated hops admit a normal perfect landing');

    // A normal mouse hop conserves water and agrees with the pre-jump ghost.
    await reset(page);
    const hit = await jump(page, await powerFor(page), 'mouse');
    check(hit.hit && hit.perfect, 'Normal arc predicts a perfect landing');
    await step(page, hit.t - .0001);
    let s = await state(page);
    check(s.current === 0 && s.mode === 'flying', 'No collision before the forecast');
    close(s.player.x, hit.x, 'Live drop reaches the forecast position', .1);
    await step(page, .0002); s = await state(page);
    check(s.current === 1 && s.perfects === 1 && s.streak === 1, 'Normal landing receives its reward once');
    check(s.dashes === 0 && !s.platforms[1].diamond, 'Normal hop spends no dash and collects one diamond');

    // The choice is tested as a counterfactual: identical short hop, with and
    // without a second press. Its result changes from rescue to safe landing.
    await reset(page);
    const rescuePower = await powerFor(page, -58.8);
    const shortForecast = await jump(page, rescuePower);
    check(shortForecast && !shortForecast.hit, 'A rescuable short hop is marked MISS before launch');
    const beforeFall = await state(page), noDash = await settle(page);
    check(noDash.state.mode === 'recover' && noDash.state.current === 0 && noDash.state.falls === 1, 'Leaving the same short hop alone misses');
    close(noDash.state.water, beforeFall.water - 24 - noDash.seconds * 1.45, 'Rug rescue costs 24 plus drying');
    await step(page, .7); s = await state(page);
    check(s.mode === 'ready' && s.current === 0 && s.perfects === 0, 'Rescue restores progress without duplicate awards');

    await reset(page);
    await jump(page, rescuePower, 'mouse'); await step(page, .1);
    const preDash = await state(page); await dash(page, 'mouse'); const postDash = await state(page);
    check(postDash.dashUsed && postDash.dashes === 1 && !postDash.dashReady, 'New mouse press consumes the once-per-hop dash');
    close(postDash.water, preDash.water - 5, 'Dash costs exactly five dampness immediately');
    close(postDash.player.x, preDash.player.x, 'Dash activation does not teleport horizontally');
    close(postDash.player.y, preDash.player.y, 'Dash activation does not teleport vertically');
    check(postDash.landing.hit && postDash.landing.perfect, 'Dash revises a missed landing into a perfect forecast');
    await dash(page, 'mouse'); const duplicate = await state(page);
    check(duplicate.dashes === 1 && duplicate.water === postDash.water, 'Repeated mouse press cannot spend or dash twice');
    await step(page, postDash.landing.t - postDash.flightT - .0001); s = await state(page);
    check(s.current === 0 && s.mode === 'flying', 'Dashed trajectory cannot land before its revised forecast');
    close(s.player.x, postDash.landing.x, 'Dashed live drop reaches its revised forecast', .1);
    await step(page, .0002); s = await state(page);
    check(s.current === 1 && s.falls === 0 && s.perfects === 1, 'Same short hop is saved by the paid dash');
    await jump(page, await powerFor(page));
    check((await state(page)).dashReady && !(await state(page)).dashUsed, 'Landing refreshes the next hop’s dash');

    // Holding or repeating an input is distinct from a new press. The arc
    // never purchases a dash, and a held dash cannot charge the next hop.
    await reset(page);
    await page.keyboard.down('Space'); await step(page,rescuePower*1.18);
    const heldCharge=await state(page); await page.keyboard.down('Space');
    check((await state(page)).charge===heldCharge.charge&&(await state(page)).dashes===0,'Repeated held key neither resets charge nor buys a dash');
    await page.keyboard.up('Space'); await step(page,.1);
    check((await state(page)).dashes===0,'A MISS preview and jump release never auto-dash');
    await page.keyboard.down('Space');const heldDash=await state(page);await page.keyboard.down('Space');
    check((await state(page)).dashes===1&&(await state(page)).water===heldDash.water,'Repeated airborne key charges for one dash only');
    await settle(page);await step(page,.3);
    check((await state(page)).mode==='ready','Holding dash through landing does not auto-charge the next hop');
    await page.keyboard.down('Space');check((await state(page)).mode==='ready','Key repeat after landing still needs a fresh press');
    await page.keyboard.up('Space');await page.keyboard.down('Space');
    check((await state(page)).mode==='charging','Fresh key press after landing starts a new charge');await page.keyboard.up('Space');
    await reset(page);await jump(page,rescuePower,'mouse');await step(page,.1);await page.mouse.down();
    const pointerDash=await state(page);await settle(page);await step(page,.3);
    check(pointerDash.dashes===1&&(await state(page)).mode==='ready','Held pointer dash does not auto-charge at landing');
    await page.mouse.up();check((await state(page)).mode==='ready','Releasing the held dash pointer does not jump again');

    // Compare two live trajectories at identical times through the burst.
    await reset(page);
    const continuityPower = await powerFor(page, -58.8), baseline = [];
    await jump(page, continuityPower); await step(page,.1);
    for(const dt of [.07,.07,.05]) { await step(page,dt); baseline.push(await state(page)); }
    await reset(page);await jump(page,continuityPower);await step(page,.1);await dash(page);
    let phase=0;
    for (const [dt, extra] of [[.07,29.4],[.07,58.8],[.05,58.8]]) {
      await step(page, dt);
      const active = await state(page), normal = baseline[phase++];
      close(active.player.x - normal.player.x, extra, 'Horizontal burst advances continuously then stops');
      close(active.player.y, normal.player.y, 'Air dash preserves gravity');
    }

    // A late but still viable dash can land during the burst. Its preview
    // must use only movement available before crossing the tower's top.
    await reset(page);
    const partialHit=await jump(page,await powerFor(page,-29.4));
    await step(page,partialHit.t-.07);await dash(page);
    const partialDash=await state(page);
    check(partialDash.landing.hit&&partialDash.landing.perfect,'Late dash forecast includes only its remaining burst before landing');
    await step(page,.0699);s=await state(page);
    check(s.current===0&&s.mode==='flying','Late dash still waits for the exact landing time');
    close(s.player.x,partialDash.landing.x,'Partial-burst landing matches the revised live forecast',.1);
    await step(page,.0002);check((await state(page)).current===1,'Late dash really lands during the burst');

    // Dashing an already good hop can overshoot: spending water is a choice,
    // rather than an automatic action the aiming arc silently makes for you.
    await reset(page);
    const overshootPower = await powerFor(page, 35);
    const safe = await jump(page, overshootPower);
    check(safe.hit, 'Overshoot example starts as a safe ordinary jump');
    await step(page, .1); await dash(page);
    check(!(await state(page)).landing.hit, 'Unnecessary dash turns the safe jump into an overshoot');
    check((await settle(page)).state.mode === 'recover', 'Overshooting dash really misses in play');

    await reset(page); await jump(page, rescuePower); await step(page, .1);
    await page.evaluate(() => dripTest.setWater(5)); const poor = await state(page); await dash(page); s = await state(page);
    check(s.dashes === 0 && !s.dashUsed && s.water === poor.water, 'Insufficient dampness rejects dash without charging or killing the drop');
    await reset(page); const lateHit = await jump(page, rescuePower); await step(page, lateHit.t + .01);
    const tooLate = await state(page); check(tooLate.mode === 'flying', 'Late rejection tested while still airborne');
    await dash(page); s = await state(page);
    check(s.dashes === 0 && s.water === tooLate.water && !s.dashUsed, 'A dash below landing height is rejected without cost');

    // At a chapter climb, a very weak jump may never reach the next top.
    // A horizontal dash cannot fix that; reject it without spending water.
    const uphillSeed=await page.evaluate(()=>{
      for(let seed=1;seed<=100;seed++){
        const r=dripTest.makeRoute(seed);
        if(!dripTest.crossing({x:r[6].x,y:r[6].y-15,...dripTest.velocity(0)},r[7]))return seed;
      }
    });
    check(uphillSeed!==undefined,'A real generated uphill null-forecast case exists');
    await reset(page,uphillSeed);
    for(let hop=1;hop<=6;hop++){await jump(page,await powerFor(page));check((await settle(page)).state.current===hop,'Reach uphill test using normal gameplay');}
    await page.locator('#wax').click();
    check(await jump(page,0)===null,'Weak uphill hop has no intersection at landing height');
    await step(page,.1);const belowTop=await state(page);await dash(page);s=await state(page);
    check(!belowTop.dashReady&&s.dashes===0&&s.water===belowTop.water,'Dash rejects a jump that can never reach the target height without charging');

    // Pause freezes water and a live dash; releasing a paused charge is safe.
    await reset(page); await jump(page, rescuePower); await step(page,.1); await dash(page);
    await page.keyboard.press('KeyP'); const pausedAir = await state(page); await step(page,10);
    check((await state(page)).water === pausedAir.water && (await state(page)).flightT === pausedAir.flightT, 'Pause freezes airborne dash and dampness');
    await page.locator('#resume').click(); check((await state(page)).mode === 'flying', 'Resume preserves airborne state');
    await reset(page); await page.keyboard.down('Space'); await step(page,.3); await page.keyboard.press('KeyP');
    await page.keyboard.up('Space'); await page.locator('#resume').click();
    check((await state(page)).mode === 'ready' && (await state(page)).dashes === 0, 'Pausing a hold cancels its release without triggering a dash');

    // Complete separate journeys using normal hops and deliberate paid rescue
    // hops. The same goal is possible with either play style.
    for (const useDash of [false, true]) {
      await reset(page, 20261102);
      for (let hop = 1; hop <= 18; hop++) {
        const prediction = await jump(page, await powerFor(page, useDash ? -58.8 : 0));
        if (useDash) { await step(page,.1); await dash(page); }
        else check(prediction.hit && prediction.perfect, `Normal run hop ${hop} is reachable`);
        s = (await settle(page)).state;
        check(s.current === hop, `${useDash?'Dash':'Normal'} run completes hop ${hop}`);
        if (hop === 6 || hop === 12) {
          check(s.mode === 'relic', 'Checkpoint opens its upgrade choice');
          const waitingWater = s.water; await step(page,5);
          check((await state(page)).water === waitingWater, 'Upgrade choice freezes dampness');
          let edge = null;
          if (!useDash && hop === 6) edge = await page.evaluate(() => {
            const s = dripTest.state(), p = s.platforms[s.current + 1];
            for (let i=0;i<=2000;i++) { const q=i/2000,h=dripTest.predict(q); if(h&&!h.hit&&Math.abs(h.x-p.x)<p.width/2+5)return q; }
          });
          await page.locator(!useDash && hop === 6 ? '#wide' : '#wax').click();
          check((await state(page)).mode === 'ready', 'Upgrade selection resumes play');
          if (edge !== null) check(await page.evaluate(q=>dripTest.predict(q).hit,edge), 'Wider-tower upgrade changes the safe landing area');
          if (!useDash && hop === 12) {
            await page.evaluate(() => dripTest.setWater(70)); await step(page,2);
            close((await state(page)).water,67.97,'Wax upgrade reduces actual drying');
          }
        }
      }
      s = await state(page);
      check(s.mode === 'won' && s.current === 18 && s.perfects === 18 && s.falls === 0, `${useDash?'Dash':'Normal'} route finishes the complete game`);
      check(s.dashes === (useDash?18:0), `${useDash?'Dash':'Normal'} run records the actual input decisions`);
      const finishedWater=s.water;await step(page,20);check((await state(page)).water===finishedWater,'Win freezes dampness');
    }
    await page.locator('#again').click();
    await page.evaluate(()=>{dripTest.setWater(.01);dripTest.step(.1);});
    check((await state(page)).mode==='lost','Dampness reaching zero loses');
    await page.locator('#again').click();s=await state(page);
    check(s.mode==='ready'&&s.water===100&&s.dashes===0,'Retry resets water and dash history');

    const phoneContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
    await phoneContext.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
    const phone=await phoneContext.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto(url+'?test=1');
    check(await phone.evaluate(()=>{const b=document.querySelector('#start').getBoundingClientRect(),c=document.querySelector('#card').getBoundingClientRect();return b.top>=c.top&&b.bottom<=c.bottom;}),'Phone start button is fully visible without scrolling the intro');
    await phone.locator('#start').tap();await reset(phone);
    const box=await phone.locator('#game').boundingBox(),cdp=await phoneContext.newCDPSession(phone);
    const touch={x:box.x+box.width*.5,y:box.y+box.height*.65};
    const touchStart=()=>cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});
    const touchEnd=()=>cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await touchStart();check((await state(phone)).mode==='charging','Touch starts charging');
    await step(phone,(await powerFor(phone,-58.8))*1.18);await touchEnd();
    check((await state(phone)).mode==='flying'&&(await state(phone)).dashes===0,'Touch release jumps without dashing');
    await step(phone,.1);const phoneBefore=await state(phone);await touchStart();await touchEnd();s=await state(phone);
    check(s.dashes===1&&s.dashUsed,'A new touch makes one air dash');close(s.water,phoneBefore.water-5,'Touch dash costs five dampness');
    await touchStart();await touchEnd();check((await state(phone)).dashes===1,'Extra touch cannot dash twice');
    s=(await settle(phone)).state;check(s.current===1&&s.perfects===1,'Touch dash saves the short hop');
    await touchStart();await step(phone,.2);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    check((await state(phone)).mode==='ready','Cancelled phone touch abandons charge safely');
    check(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Phone layout has no horizontal scroll');
    check(await phone.evaluate(()=>getComputedStyle(document.getElementById('game')).touchAction==='none'),'Touch gameplay cannot scroll the canvas');
    for(let hop=2;hop<=18;hop++) {
      const useDash=hop%3===0;
      const power=await powerFor(phone,useDash?-58.8:0);
      await touchStart();await step(phone,power*1.18);await touchEnd();
      if(useDash){await step(phone,.1);await touchStart();await touchEnd();}
      s=(await settle(phone)).state;
      check(s.current===hop,`Phone touch journey completes hop ${hop}`);
      if(hop===6||hop===12){await phone.locator('#wax').tap();check((await state(phone)).mode==='ready','Phone tap selects checkpoint gift and resumes');}
    }
    s=await state(phone);
    check(s.mode==='won'&&s.current===18&&s.falls===0&&s.dashes===7,'Complete phone touch journey mixes normal hops with deliberate dash rescues');
    await phoneContext.close();

    // Exercise ordinary RAF/rendering/input, in addition to deterministic
    // simulation checks, so a disconnected frame loop cannot pass the suite.
    const live=await browser.newPage({viewport:{width:1280,height:900}});live.on('pageerror',e=>errors.push(e.message));await live.goto(url+'?test=1');
    await live.locator('#start').click();await reset(live);
    const livePower=await powerFor(live,-58.8);await live.keyboard.down('Space');await live.waitForTimeout(livePower*1180);await live.keyboard.up('Space');
    await live.waitForTimeout(100);await live.keyboard.press('Space');
    await live.waitForFunction(()=>dripTest.state().current===1||dripTest.state().mode==='recover');
    check((await state(live)).current===1&&(await state(live)).dashes===1,'Live rendering clock and real-time dash complete a landing');
    await live.close();
    await page.goto(url);check(await page.evaluate(()=>!('dripTest'in window)),'Ordinary page does not expose test controls');
    check(errors.length===0,`No browser exceptions: ${errors.join('; ')}`);
    console.log(`PASS: ${checks} browser checks; ${routes.pairs.toLocaleString()} normal generated jumps; counterfactual dash rescue, burst physics, cost/rejections, desktop + touch; two desktop and one phone full 18-hop runs.`);
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
