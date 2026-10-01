#!/usr/bin/env node
'use strict';

// Behavioral probes, not a claim of human playtesting. Requires Node and Playwright;
// no game dependency or generated file is added to the checkout. See README.md here.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { chromium } = require('playwright');

function options(argv) {
  const out = { seeds: [1, 2, 3], personas: ['casual'], seconds: 900, maxDeaths: 12,
    browser: process.env.CHROMIUM_PATH || '/usr/bin/chromium', baseline: false,
    output: null, traceSeconds: 5, source: null };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--help') {
      console.log('Usage: node tools/playtest.cjs [--baseline] [--source FILE] [--seeds 1,2,3] [--personas casual,stationary,runner,practiced] [--seconds 900] [--max-deaths 12] [--browser PATH] [--output FILE] [--trace-seconds 5]');
      process.exit(0);
    }
    if (key === '--baseline') { out.baseline = true; continue; }
    const value = argv[++i];
    if (value === undefined) throw new Error('Missing value for ' + key);
    if (key === '--seeds') out.seeds = value.split(',').map(Number);
    else if (key === '--personas') out.personas = value.split(',');
    else if (key === '--seconds') out.seconds = Number(value);
    else if (key === '--max-deaths') out.maxDeaths = Number(value);
    else if (key === '--trace-seconds') out.traceSeconds = Number(value);
    else if (key === '--browser') out.browser = value;
    else if (key === '--output') out.output = path.resolve(value);
    else if (key === '--source') out.source = path.resolve(value);
    else throw new Error('Unknown option: ' + key);
  }
  if (out.baseline && out.source) throw new Error('Use --baseline or --source, not both.');
  if (!out.seeds.length || out.seeds.some(x => !Number.isSafeInteger(x))) throw new Error('Seeds must be integers.');
  if (!(out.seconds > 0) || !(out.traceSeconds > 0) || !Number.isInteger(out.maxDeaths) || out.maxDeaths < 0) throw new Error('Invalid time/death limit.');
  if (out.personas.some(x => !['casual', 'stationary', 'runner', 'practiced'].includes(x))) throw new Error('Unknown persona.');
  return out;
}

// This executes in the browser before the game. Rendering, audio hardware and real
// wall time do not determine the scenario. Game timeouts use the same virtual clock.
function installClock(seed) {
  let rng = seed >>> 0, elapsed = 0, nextId = 1, draws = 0;
  const timers = new Map();
  Math.random = () => {
    draws++;
    rng += 0x6D2B79F5;
    let n = Math.imul(rng ^ rng >>> 15, 1 | rng);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
  Object.defineProperty(performance, 'now', { value: () => elapsed });
  window.AudioContext = window.webkitAudioContext = undefined;
  window.setTimeout = (fn, ms = 0, ...args) => {
    if (typeof fn !== 'function') throw new Error('String timer unsupported by playtest.');
    const id = nextId++; timers.set(id, { at: elapsed + Math.max(0, ms), fn, args }); return id;
  };
  window.clearTimeout = id => timers.delete(id);
  // The only interval in the game schedules audio, which is deliberately disabled.
  window.setInterval = () => nextId++;
  window.clearInterval = () => {};
  window.__playtestClock = {
    advance(dt) {
      elapsed += dt * 1000;
      for (const [id, timer] of [...timers]) if (timer.at <= elapsed) {
        timers.delete(id); timer.fn(...timer.args);
      }
    },
    now: () => elapsed / 1000,
    reseed(value) { rng = value >>> 0; draws = 0; },
    randomDraws: () => draws,
  };
}

// Injected at the existing browser-suite seam, inside the shipping game closure.
// Observation may inspect state. The policy only writes keyboard/mouse input;
// game start, PLEASE, movement, collisions, damage and victory use shipping code.
function controller() {
  const profiles = {
    casual: { reaction: .3, turn: 2.6, error: .045, view: 1.05, range: 38, dash: .12 },
    stationary: { reaction: .3, turn: 2.6, error: .045, view: 1.05, range: 38, dash: 0 },
    runner: { reaction: .3, turn: 2.6, error: .045, view: 1.05, range: 38, dash: .12 },
    practiced: { reaction: .14, turn: 4.3, error: .018, view: 1.15, range: 45, dash: .24 },
  };
  const round = n => Math.round(n * 100) / 100;
  const angle = a => Math.atan2(Math.sin(a), Math.cos(a));
  const key = (code, down) => {
    if (!!keys[code] === !!down) return;
    dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code }));
  };
  const mouse = down => {
    if (mouseDown === down) return;
    (down ? cv : window).dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', { button: 0, bubbles: true }));
  };
  const release = () => {
    for (const code of ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyC', 'Space', 'ShiftLeft', 'KeyE']) key(code, false);
    mouse(false);
  };
  window.behavioralPlaytest = {
    run(config) {
      const profile = profiles[config.persona], clock = window.__playtestClock;
      let policySeed = (config.seed ^ 0xA341316C) >>> 0;
      const roll = () => { policySeed ^= policySeed << 13; policySeed ^= policySeed >>> 17; policySeed ^= policySeed << 5; return (policySeed >>> 0) / 4294967296; };
      const result = { seed: config.seed, persona: config.persona, profile, outcome: 'time-limit', deaths: [], events: [], trace: [], shots: [0, 0, 0, 0], maxWave: 0, maxChapter: 0, visibleDecisions: 0, blindDecisions: 0, errors: [] };
      let decisionAt = 0, traceAt = 0, patrol = 1, known = null, moveX = 0, moveZ = 0, aimYaw = P.yaw, aimPitch = 0, firing = false;
      let dash = false, jumping = false, deadAt = null, lastState = state, lastWave = -1, lastChapter = -1, wasClear = false;
      let lastPosition = [P.x, P.z], stuckFor = 0;
      const started = clock.now();
      const event = (kind, data = {}) => result.events.push({ at: round(clock.now() - started), kind, wave, chapter: chapter + 1, ...data });
      // Count actual accepted fire calls. The wrapper delegates unchanged, including
      // cooldowns, ammo costs, misses and weapon switching. It gives the policy no data.
      const originalFire = fire;
      fire = function () {
        const ready = P.cool <= 0 && P.switchT <= 0 && P.ammo[P.w] > 0, weapon = P.w;
        originalFire();
        if (ready) result.shots[weapon]++;
      };
      try {
        clock.reseed(config.seed);
        muted = true;
        dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter' }));
        dispatchEvent(new KeyboardEvent('keyup', { code: 'Enter', key: 'Enter' }));
        for (let frameNumber = 0; frameNumber < Math.ceil(config.seconds * 60); frameNumber++) {
          const dt = 1 / 60, elapsed = clock.now() - started;
          if (![P.x, P.y, P.z, P.hp, P.yaw, P.pitch].every(Number.isFinite)) { result.errors.push('Nonfinite player state'); result.outcome = 'invariant-failure'; break; }
          if (state === 'won') { result.outcome = 'escaped'; break; }
          if (state === 'dead') {
            release();
            if (deadAt === null) {
              deadAt = elapsed; result.deaths.push({ at: round(elapsed), wave, chapter: chapter + 1, cause: deathCause, kills: killCount, position: [round(P.x), round(P.y), round(P.z)] });
              event('death', { cause: deathCause });
            }
            if (result.deaths.length > config.maxDeaths) { result.outcome = 'death-limit'; break; }
            if (elapsed - deadAt > 2) {
              // Exercise the real PLEASE keyboard handler, including its delay.
              for (const letter of 'please') dispatchEvent(new KeyboardEvent('keydown', { code: 'Key' + letter.toUpperCase(), key: letter }));
              for (const letter of 'please') dispatchEvent(new KeyboardEvent('keyup', { code: 'Key' + letter.toUpperCase(), key: letter }));
              event('please', { continues }); deadAt = null; decisionAt = 0; known = null;
            }
          }
          if (state === 'play') {
            if (wave !== lastWave || chapter !== lastChapter) {
              event('progress', { hp: round(P.hp), kills: killCount }); lastWave = wave; lastChapter = chapter;
            }
            if (chapterClear && !wasClear) event('district-clear', { hp: round(P.hp), kills: killCount });
            wasClear = chapterClear;
            result.maxWave = Math.max(result.maxWave, wave); result.maxChapter = Math.max(result.maxChapter, chapter + 1);
            if (elapsed >= decisionAt) {
              decisionAt = elapsed + profile.reaction;
              const displacement = Math.hypot(P.x - lastPosition[0], P.z - lastPosition[1]);
              stuckFor = displacement < .2 && (Math.abs(moveX) + Math.abs(moveZ) > .1) ? stuckFor + profile.reaction : 0;
              lastPosition = [P.x, P.z];
              // Direct coordinates and collision rays are available to this policy:
              // this is bounded state perception, not pixel vision or human discovery.
              known = enemies.filter(e => {
                if (e.dead) return false;
                const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz);
                if (d > profile.range || Math.abs(angle(Math.atan2(-dx, -dz) - P.yaw)) > profile.view) return false;
                const dy = e.y + (e.type === 'spoon' || e.type === 'fork' ? 0 : e.h * .55) - P.y - P.eyeH;
                const length = Math.hypot(dx, dy, dz);
                return rayStatic(P.x, P.y + P.eyeH, P.z, dx / length, dy / length, dz / length, length) >= length - e.r;
              }).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];
              const target = known && { x: known.x, y: known.y + (known.type === 'spoon' || known.type === 'fork' ? 0 : known.h * .55), z: known.z, type: known.type };
              if (target) result.visibleDecisions++; else result.blindDecisions++;
              const center = CHAPTERS[chapter].x, left = center - 24, right = center + 24;
              if (P.x >= right - 2) patrol = -1;
              if (P.x <= left + 2) patrol = 1;
              if (stuckFor > 2) { patrol *= -1; stuckFor = 0; }
              let destination = { x: patrol > 0 ? right : left, z: 17 };
              if (chapterClear) {
                // Known safe route: approach the documented front lane before crossing.
                if (chapter === 4 && P.x >= 297) destination = { x: DRAIN.x, z: DRAIN.z };
                else if (Math.abs(P.z - 17) > 1.5) destination = { x: P.x, z: 17 };
                else destination = { x: chapter < 4 ? CHAPTERS[chapter + 1].x - 24 : DRAIN.x, z: 17 };
              }
              const ndx = destination.x - P.x, ndz = destination.z - P.z, nd = Math.hypot(ndx, ndz);
              moveX = nd > 1 ? ndx / nd : 0; moveZ = nd > 1 ? ndz / nd : 0;
              if (config.persona === 'stationary' && !chapterClear) moveX = moveZ = 0;
              if (clog.alive && config.persona !== 'runner' && config.persona !== 'stationary') {
                // The Clog is not in enemies; a bot that knows the rule fights it with fizz, then ice.
                const dx = clog.x - P.x, dz = clog.z - P.z, d = Math.hypot(dx, dz);
                if (d < 9) { moveX = -dx / d; moveZ = -dz / d; } else if (d > 16) { moveX = dx / d; moveZ = dz / d; } else moveX = moveZ = 0;
                aimYaw = Math.atan2(-dx, -dz) + (roll() * 2 - 1) * profile.error;
                aimPitch = Math.atan2(clog.y - P.y - P.eyeH, d) + (roll() * 2 - 1) * profile.error;
                firing = roll() > .12;
                const weapon = P.ammo[2] > 0 ? 2 : P.ammo[1] > 0 ? 1 : P.ammo[3] > 0 ? 3 : 0;
                if (P.ammo[2] <= 0 && P.ammo[1] <= 0) { const fizz = pickups.find(k => k.type === 'seltzer'); if (fizz) { const fx = fizz.x - P.x, fz = fizz.z - P.z, fd = Math.hypot(fx, fz) || 1; moveX = fx / fd; moveZ = fz / fd; } }
                if (weapon !== P.wNext) dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit' + (weapon + 1), key: String(weapon + 1) }));
              } else if (target && !chapterClear && config.persona !== 'runner') {
                const dx = target.x - P.x, dz = target.z - P.z;
                aimYaw = Math.atan2(-dx, -dz) + (roll() * 2 - 1) * profile.error;
                aimPitch = Math.atan2(target.y - P.y - P.eyeH, Math.hypot(dx, dz)) + (roll() * 2 - 1) * profile.error;
                firing = roll() > .12;
                const close = Math.hypot(dx, dz) < (config.persona === 'practiced' ? 12 : 6);
                const weapon = close && (config.persona === 'practiced' || P.hp < 50) && P.ammo[1] > 0 ? 1 : 0;
                if (weapon !== P.wNext) dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit' + (weapon + 1), key: String(weapon + 1) }));
              } else {
                aimYaw = chapterClear || config.persona === 'runner' ? Math.atan2(-moveX, -moveZ) : P.yaw + .65;
                aimPitch = 0; firing = false;
              }
              dash = !chapterClear && !!target && config.persona !== 'stationary' && roll() < profile.dash;
              jumping = !chapterClear && config.persona !== 'stationary' && (stuckFor > 1 || roll() < .035);
            }
            const yawDelta = clamp(angle(aimYaw - P.yaw), -profile.turn * dt, profile.turn * dt);
            const pitchDelta = clamp(aimPitch - P.pitch, -profile.turn * dt, profile.turn * dt);
            dispatchEvent(new MouseEvent('mousemove', { movementX: -yawDelta / sens, movementY: -pitchDelta / sens }));
            const forward = -Math.sin(P.yaw) * moveX - Math.cos(P.yaw) * moveZ;
            const side = Math.cos(P.yaw) * moveX - Math.sin(P.yaw) * moveZ;
            key('KeyW', forward > .3); key('KeyS', forward < -.3); key('KeyD', side > .3); key('KeyA', side < -.3);
            key('ShiftLeft', dash); key('Space', jumping); key('KeyC', false);
            key('KeyE', chapter === 4 && chapterClear && Math.hypot(P.x - DRAIN.x, P.z - DRAIN.z) < DRAIN.r + .7);
            mouse(firing && Math.abs(angle(aimYaw - P.yaw)) < .18);
          }
          clock.advance(dt);
          tick(dt); hud(dt); zUpdate(dt);
          if (state !== lastState) { event('state', { state }); lastState = state; }
          if (elapsed >= traceAt) {
            traceAt = elapsed + config.traceSeconds;
            result.trace.push({ at: round(elapsed), gameSeconds: round(runTime), state, wave, chapter: chapter + 1, hp: round(P.hp), kills: killCount, remaining: enemies.length + spawnQ.length, position: [round(P.x), round(P.y), round(P.z)], weapon: P.w, firing: mouseDown, target: known ? known.type : null, randomDraws: clock.randomDraws() });
          }
        }
        if (state === 'won') result.outcome = 'escaped';
        result.final = { state, wave, chapter: chapter + 1, hp: round(P.hp), score, kills: killCount, continues, elapsedSeconds: round(clock.now() - started), gameSeconds: round(runTime), position: [round(P.x), round(P.y), round(P.z)] };
        if (typeof kitchenStories !== 'undefined' && kitchenStories) {
          result.incidents = { counts: { ...kitchenStories.counts }, recent: kitchenStories.entries.map(entry => ({ ...entry })) };
        }
        release(); render();
        const error = gl.getError();
        if (error !== gl.NO_ERROR) result.errors.push('Final WebGL error: ' + error);
        if (stack.length) result.errors.push('Unbalanced render stack: ' + stack.length);
        if (!muted) result.errors.push('Game became unmuted');
        if (config.persona !== 'runner' && result.visibleDecisions > 10 && result.shots.every(n => n === 0)) result.errors.push('Combat policy observed targets but never fired: check input wiring.');
        if (config.persona === 'runner' && result.shots.some(n => n > 0)) result.errors.push('Runner unexpectedly fired.');
      } finally { fire = originalFire; }
      return result;
    },
  };
  showScreen('title');
}

async function main() {
  const opts = options(process.argv.slice(2)), gameDir = path.resolve(__dirname, '..');
  const repository = path.resolve(gameDir, '..');
  const source = opts.baseline ? (await promisify(execFile)('git', ['show', 'HEAD:absorb-this/index.html'], { cwd: repository, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })).stdout : fs.readFileSync(opts.source || path.join(gameDir, 'index.html'), 'utf8');
  const boot = "showScreen('title');\nrequestAnimationFrame(frame);";
  const pointerStart = source.indexOf('function grabPointer() {'), pointerEnd = source.indexOf("$('scr').addEventListener('click', e => {", pointerStart);
  if (!source.includes(boot) || pointerStart < 0 || pointerEnd < 0) throw new Error('Shipping test seams changed; update the behavioral runner.');
  let instrumented = source.slice(0, pointerStart) + 'function grabPointer() { locked = true; lockAt = -1000; }\n' + source.slice(pointerEnd);
  instrumented = instrumented.replace(boot, '(' + controller.toString() + ')();');
  // The served document has the same origin semantics as a normal local game.
  const server = http.createServer((req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(instrumented);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  let browser;
  const report = { source: opts.baseline ? 'git HEAD' : opts.source || 'working tree', sourceSha256: crypto.createHash('sha256').update(source).digest('hex'), harnessSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'), options: opts,
    limitations: ['Bounded privileged state perception, not pixel vision or a human participant.', 'Known front-lane navigation; does not test discovering the route or controls.', 'Fixed 60 Hz shipping tick, HUD and commentator update; renders only the final frame.', 'Rendering RNG consumption, audio and wall-clock timing are excluded; seeded traces are reproducible only within this harness.', 'Virtual game timeouts; audio-only interval disabled; no speech comprehension, touch usability or real-time performance claim.', 'No teleports, health overrides, enemy deletion, direct damage, wave skips or victory calls.'], runs: [] };
  try {
    browser = await chromium.launch({ executablePath: opts.browser, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--num-raster-threads=1'] });
    for (const persona of opts.personas) for (const seed of opts.seeds) {
      const context = await browser.newContext({ viewport: { width: 1024, height: 640 } });
      await context.addInitScript(installClock, seed);
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      await page.route('https://**', route => route.abort());
      await page.goto(`http://127.0.0.1:${server.address().port}/?scale=0.5`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const run = await page.evaluate(config => window.behavioralPlaytest.run(config), { persona, seed, seconds: opts.seconds, maxDeaths: opts.maxDeaths, traceSeconds: opts.traceSeconds });
      run.errors.push(...errors); report.runs.push(run);
      console.log(JSON.stringify({ persona, seed, outcome: run.outcome, deaths: run.deaths.length, ...run.final, errors: run.errors }));
      await context.close();
      if (opts.output) { fs.mkdirSync(path.dirname(opts.output), { recursive: true }); fs.writeFileSync(opts.output, JSON.stringify(report, null, 2) + '\n'); }
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  if (report.runs.some(run => run.errors.length)) process.exitCode = 1;
}
main().catch(error => { console.error(error.stack || String(error)); process.exitCode = 1; });
