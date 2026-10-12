#!/usr/bin/env node
// Audio test, run on the Sfx module INSIDE index.html:  node clack-stack/tools/audio.cjs [--report] [--soak=SECONDS] [--only=A,B,D]
//
// Part A, real time (headless Chromium, --autoplay-policy=no-user-gesture-required): the game page is loaded and its
// main loop halted (CS.halt()), then its Sfx is driven directly:
//   API shape; every call is a safe no-op before unlock(); unlock -> 'running'; crash() + smash() in the
//   same task as the first unlock() (the title BOOM) play fully; every function
//   with typical and junk arguments; 40 clacks in 1 s; crash + smash + tally + clacks together
//   (voices <= 24 at every poll, cap exactly 24 under a flood); music layers follow setMult 1..5;
//   every music note starts on the exact 16th-note grid of 120 + 3*(level-1) BPM (capped 150)
//   despite main-thread jank; mute silences the output (analyser on the destination) and makes
//   calls create no nodes; a creak the game stops feeding (pause) fades out by itself; on a slow (phone-like)
//   main thread no source is ever started at a time the audio clock has already passed (the attack would be
//   skipped) and a sound's parts keep their relative timing; a soak (default 20 s, ~a 10-minute session's worth of
//   events) after which nodes created minus nodes garbage-collected stays small and no voices are left.
// Part B, offline: the SFX:BEGIN..SFX:END block of index.html runs on an OfflineAudioContext (a fresh module
//   instance per render; sounds start 0.25 s in, after Chromium's compressor has settled), for every sound:
//   peak <= -1 dBFS after the compressor (and inside the safety clipper's linear zone for single
//   sounds), not silent, duration in the specified range, starts from silence, fades to 0 before
//   the end, no DC; a stop-click test renders each sound twice, once with every source's stop()
//   disabled: identical output proves no source is stopped while still audible. Plus: tock pitch
//   per combo, body vs mass, edge runs, PERFECT ting (and its climb with the PERFECT streak: a pentatonic step a PERFECT, an
//   octave up from the 6th), the streak milestone fanfare (longer each tier), zzip sweep, whistle glide, crash panning and
//   clatter count, creak curve + heartbeat, music layers / tempo / duck; one pan law (a clack's total power at
//   pan 0, 0.02 and 0.5 within 0.5 dB); the balance as ears and small speakers hear it, like with like: a
//   pan-0.15 clack's loudest 50 ms at least 6 dB over the x5 groove's loudest 50 ms (A-weighted and phone-weighted),
//   the x1 groove still audible, the "aww" under a clack; and without AudioParam.cancelAndHoldAtTime (Firefox) a
//   second duck during the first one's recovery does not step the music.
// Part D, wiring: the game is played through real input (title shove, drops, a miss, a crash, hazards, the
//   goal and the SMASH, TIME! and the results) with every Sfx call recorded; every sound the design asks for is
//   called at its moment (DESIGN 8 and 10), the creak is fed every frame, the music starts, follows the level
//   and the multiplier and stops.
// Fails (exit 1) on any check, pageerror or console.error.
'use strict';
const fs = require('fs');
const path = require('path');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }

const { gameUrl } = require('./lib.cjs');
const GAME_FILE = path.resolve(process.env.CLACK_GAME || path.join(__dirname, '..', 'index.html'));
// the Sfx module as index.html has it (between the SFX markers)
const SRC = (() => {
  const h = fs.readFileSync(GAME_FILE, 'utf8'), a = h.indexOf('/* ==== SFX:BEGIN ==== */'), b = h.indexOf('/* ==== SFX:END ==== */');
  if (a < 0 || b < a) throw new Error('no SFX:BEGIN / SFX:END block in ' + GAME_FILE);
  return h.slice(a + '/* ==== SFX:BEGIN ==== */'.length, b);
})();
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
const REPORT = process.argv.includes('--report');
const soakArg = process.argv.find((a) => a.startsWith('--soak='));
const SOAK = soakArg ? Math.max(0, +soakArg.slice(7)) : 20;

const fails = [];
const errors = [];
const fail = (s) => fails.push(s);

function watch(page, tag) {
  page.on('pageerror', (e) => errors.push(tag + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(tag + ' console.error: ' + m.text()); });
}

/* ================================================================== Part A: real time */
const INSTRUMENT = () => {
  const T = window.__T = { created: 0, finalized: 0, starts: null, analyser: null, tapping: false, slow: false, slowStarts: 0, lateN: 0, late: [], call: null };
  const fr = new FinalizationRegistry(() => { T.finalized++; });
  for (const name of ['createGain', 'createOscillator', 'createBufferSource', 'createBiquadFilter', 'createStereoPanner',
    'createDynamicsCompressor', 'createWaveShaper']) {
    const orig = BaseAudioContext.prototype[name];
    BaseAudioContext.prototype[name] = function () {
      if (T.slow) { const t = performance.now(); while (performance.now() - t < 0.6) { /* a phone: each node costs 0.6 ms */ } }
      const n = orig.apply(this, arguments); T.created++; fr.register(n, 0); return n;
    };
  }
  for (const P of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype]) {   // buffer sources override start()
    const st = P.start;
    P.start = function (when) {
      if (T.starts) T.starts.push(when || 0);
      if (T.slow && when > 0) {
        T.slowStarts++;
        const late = this.context.currentTime - when;
        if (late > 1e-9 && T.lateN++ < 20) T.late.push((T.call ? T.call.name : 'music') + ' ' + (late * 1000).toFixed(1) + ' ms');
        if (T.call) T.call.w.push(when);
      }
      return st.apply(this, arguments);
    };
  }
  const conn = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dst) {
    const r = conn.apply(this, arguments);
    if (!T.tapping && dst instanceof AudioDestinationNode && this instanceof GainNode) {
      T.tapping = true;
      const a = this.context.createAnalyser(); a.fftSize = 2048;
      const z = this.context.createGain(); z.gain.value = 0;
      conn.call(this, a); conn.call(a, z); conn.call(z, dst);
      T.analyser = a; T.tapping = false;
    }
    return r;
  };
};

const REALTIME = async ({ SOAK }) => {
  const F = [], info = {};
  const fail = (s) => F.push(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const T = window.__T;
  // ---- 1. API shape
  const KEYS = ['unlock', 'setMuted', 'muted', 'clack', 'zzip', 'miss', 'aww', 'poke', 'creak', 'save', 'crash', 'whistle', 'smash',
    'tally', 'ribbon', 'crown', 'ring', 'gear', 'cubeFold', 'boom', 'honk', 'bonk', 'whooo', 'thump', 'fuseTick', 'clockTick',
    'newBest', 'streak', 'uiClick', 'haptic', 'music', 'stats'];
  if (typeof Sfx !== 'object' || !Sfx) { fail('Sfx is not a global object'); return { F, info }; }
  const own = Object.keys(Sfx).sort().join(','), want = KEYS.slice().sort().join(',');
  if (own !== want) fail('Sfx keys differ: ' + own);
  for (const k of KEYS) if (k !== 'muted' && k !== 'music' && typeof Sfx[k] !== 'function') fail('Sfx.' + k + ' is not a function');
  if (typeof Sfx.muted !== 'boolean') fail('Sfx.muted is not a boolean');
  const MK = ['start', 'stop', 'setLevel', 'setMult', 'duck'];
  if (Object.keys(Sfx.music || {}).sort().join(',') !== MK.slice().sort().join(',')) fail('Sfx.music keys differ');
  const sk = Object.keys(Sfx.stats()).sort().join(',');
  if (sk !== 'layers,muted,peakVoices,state,voices') fail('stats() fields: ' + sk);

  const typical = () => {
    Sfx.clack({ combo: 3, mass: 1, pan: 0.2, edges: 2, grade: 'great' }); Sfx.zzip(-0.3); Sfx.miss(0.5); Sfx.aww(); Sfx.poke(0.1);
    Sfx.creak(0.7); Sfx.save(); Sfx.whistle(); Sfx.tally(4); Sfx.ribbon(); Sfx.crown(); Sfx.ring(); Sfx.gear();
    Sfx.cubeFold(2); Sfx.boom(); Sfx.honk(); Sfx.bonk(); Sfx.whooo(0.6); Sfx.thump(); Sfx.fuseTick('half'); Sfx.fuseTick('threeq');
    Sfx.fuseTick('last'); Sfx.clockTick(5); Sfx.clockTick(2); Sfx.newBest(); Sfx.streak(1); Sfx.streak(4); Sfx.uiClick(); Sfx.haptic(8); Sfx.haptic([30, 40, 30]);
    Sfx.clack({ combo: 4, mass: 1, edges: 1, grade: 'perfect', streak: 12 });
    Sfx.crash(12, 0.4); Sfx.smash(); Sfx.creak(0);
    Sfx.music.setLevel(3); Sfx.music.setMult(2); Sfx.music.duck(0.5); Sfx.music.start(); Sfx.music.stop(); Sfx.stats();
  };
  // ---- 2. before unlock: everything is a safe no-op
  const c0 = T.created;
  typical(); Sfx.setMuted(true); Sfx.setMuted(false);
  const s0 = Sfx.stats();
  if (s0.state !== 'none' || s0.voices !== 0 || s0.layers !== 0) fail('before unlock stats should be idle: ' + JSON.stringify(s0));
  if (T.created !== c0) fail('calls before unlock created ' + (T.created - c0) + ' nodes');

  // ---- 3. unlock (builds the graph and synthesises the snap / hit / noise buffers inside the gesture)
  const tU = performance.now();
  Sfx.unlock();
  info.unlockMs = +(performance.now() - tU).toFixed(1);
  if (info.unlockMs > 50) fail('unlock() took ' + info.unlockMs + ' ms');
  // The first gesture: the game calls unlock() from its input handler and may start the title BOOM
  // (crash / smash) in that same handler, before unlock()'s deferred buffer synthesis has run.
  if (Sfx.stats().state === 'running') {
    const v0 = Sfx.stats().voices;
    Sfx.crash(30, 0); Sfx.smash();
    info.firstGestureVoices = Sfx.stats().voices - v0;
    if (info.firstGestureVoices < 3) fail('crash() + smash() in the unlock() task made only ' + info.firstGestureVoices + ' voices (want crash + whistle + smash)');
  } else info.firstGestureVoices = 'skipped (context not running synchronously)';
  for (let i = 0; i < 100 && Sfx.stats().state !== 'running'; i++) await sleep(20);
  info.state = Sfx.stats().state;
  if (info.state !== 'running') { fail('after unlock state is ' + info.state); return { F, info }; }
  Sfx.unlock(); Sfx.unlock();   // repeat calls are cheap and harmless
  await sleep(150);

  // ---- 4. every function, typical and junk arguments
  typical();
  const junk = [undefined, null, NaN, Infinity, -Infinity, -5, 1e9, 'x', {}, []];
  for (const j of junk) {
    Sfx.clack(j); Sfx.clack({ combo: j, mass: j, pan: j, edges: j, grade: j }); Sfx.zzip(j); Sfx.miss(j); Sfx.poke(j); Sfx.creak(j);
    Sfx.crash(j, j); Sfx.tally(j); Sfx.cubeFold(j); Sfx.whooo(j); Sfx.fuseTick(j); Sfx.clockTick(j); Sfx.haptic(j);
    Sfx.music.setLevel(j); Sfx.music.setMult(j); Sfx.music.duck(j); Sfx.setMuted(false);
  }
  Sfx.clack(); Sfx.clack({ combo: -7 }); Sfx.clack({ combo: 1234567, edges: 3, grade: 'perfect', mass: 3 }); Sfx.creak(0);
  if (Sfx.stats().voices > 24) fail('voices > 24 after junk calls');
  await sleep(1800);

  // ---- 5. 40 clacks in 1 s, with zzips, every edge count and grade
  let maxV = 0;
  const poll = setInterval(() => { maxV = Math.max(maxV, Sfx.stats().voices); }, 10);
  for (let i = 0; i < 40; i++) {
    Sfx.zzip((i % 5) / 2 - 1);
    Sfx.clack({ combo: i, mass: [0.45, 1, 3][i % 3], pan: Math.sin(i), edges: 1 + (i % 3), grade: ['perfect', 'great', 'clack'][i % 3] });
    await sleep(25);
  }
  info.burst40MaxVoices = maxV;
  if (maxV > 24) fail('40 clacks/s: voices reached ' + maxV);

  // ---- 6. crash + smash together, with a tally burst and clacks on top
  Sfx.crash(40, -0.4); Sfx.smash(); Sfx.boom(); Sfx.whistle();
  for (let i = 0; i < 30; i++) { Sfx.tally(i); if (i % 3 === 0) Sfx.clack({ combo: i, edges: 3, grade: 'perfect' }); await sleep(12); }
  await sleep(300);
  clearInterval(poll);
  info.crashSmashMaxVoices = maxV;
  if (maxV > 24) fail('crash+smash: voices reached ' + maxV);
  if (Sfx.stats().peakVoices > 24) fail('peakVoices ' + Sfx.stats().peakVoices);
  // flood: 60 long voices at once -> exactly 24 live
  for (let i = 0; i < 60; i++) Sfx.crown();
  info.flood = Sfx.stats().voices;
  if (info.flood !== 24) fail('flood of 60 voices left ' + info.flood + ' live (cap should hold exactly 24)');
  if (Sfx.stats().peakVoices !== 24) fail('peakVoices after flood ' + Sfx.stats().peakVoices);
  await sleep(1600);

  // ---- 7. music: layers follow setMult; notes on the exact grid; tempo by level
  Sfx.music.setMult(1); Sfx.music.setLevel(1);
  Sfx.music.start();
  if (Sfx.stats().layers !== 1) fail('music x1 layers ' + Sfx.stats().layers);
  for (let m = 1; m <= 5; m++) { Sfx.music.setMult(m); if (Sfx.stats().layers !== m) fail('setMult(' + m + ') -> layers ' + Sfx.stats().layers); }
  Sfx.music.setMult(0); if (Sfx.stats().layers !== 1) fail('setMult(0) should clamp to 1');
  Sfx.music.setMult(9); if (Sfx.stats().layers !== 5) fail('setMult(9) should clamp to 5');
  Sfx.music.stop();
  if (Sfx.stats().layers !== 0) fail('layers after stop ' + Sfx.stats().layers);
  await sleep(300);
  const grid = async (level, mult, ms) => {
    Sfx.music.setLevel(level); Sfx.music.setMult(mult);
    T.starts = [];
    Sfx.music.start();
    const t0 = performance.now(), ac = T.analyser.context, clk = [[performance.now(), ac.currentTime]];
    const sampler = setInterval(() => clk.push([performance.now(), ac.currentTime]), 5);
    while (performance.now() - t0 < ms) {   // main-thread jank: 70 ms stalls (< the 100 ms lookahead)
      await sleep(90 + Math.random() * 60);
      const j = performance.now(); while (performance.now() - j < 70) { /* spin */ }
    }
    const starts = T.starts.slice(); T.starts = null;
    clearInterval(sampler);
    let jump = 0;   // audio clock leaping ahead of the wall clock = the audio thread was starved, then caught up
    for (let i = 1; i < clk.length; i++) jump = Math.max(jump, (clk[i][1] - clk[i - 1][1]) - (clk[i][0] - clk[i - 1][0]) / 1000);
    Sfx.music.stop();
    await sleep(250);
    const sd = 60 / Math.min(150, 120 + 3 * (level - 1)) / 4, w0 = Math.min(...starts);
    let off = 0; const steps = new Set();
    for (const w of starts) { const k = Math.round((w - w0) / sd); off = Math.max(off, Math.abs(w - w0 - k * sd)); steps.add(k); }
    const ks = [...steps].sort((a, b) => a - b);
    let gaps = 0; for (let k = 0; k <= ks[ks.length - 1]; k += 2) if (!steps.has(k)) gaps++;   // shaker on every even step
    return { n: starts.length, sd, offGridMs: off * 1000, steps: ks.length, gaps, clockJumpMs: Math.round(jump * 1000) };
  };
  info.grid120 = await grid(1, 5, 2600);
  info.grid150 = await grid(11, 3, 1500);
  info.grid150cap = await grid(40, 1, 1200);
  for (const [k, g] of Object.entries({ grid120: info.grid120, grid150: info.grid150, grid150cap: info.grid150cap })) {
    if (g.offGridMs > 0.001) fail(k + ': a note started ' + g.offGridMs.toFixed(4) + ' ms off the 16th grid');
    // Missing steps are only the scheduler's fault if the audio clock ran smoothly; when the audio thread is
    // starved and its clock leaps ahead, skipping the missed steps (instead of a burst of late notes) is right.
    if (g.gaps && g.clockJumpMs < 60) fail(k + ': ' + g.gaps + ' missing steps (scheduler fell behind)');
    if (g.gaps && g.clockJumpMs >= 60) info[k].note = 'audio clock leapt ' + g.clockJumpMs + ' ms (machine load): steps skipped, as designed';
    if (g.n < 6) fail(k + ': only ' + g.n + ' notes');
  }

  // ---- 8. mute
  const meter = async (ms) => {
    const a = T.analyser, buf = new Float32Array(a.fftSize); let pk = 0; const t0 = performance.now();
    while (performance.now() - t0 < ms) { a.getFloatTimeDomainData(buf); for (let i = 0; i < buf.length; i++) pk = Math.max(pk, Math.abs(buf[i])); await sleep(15); }
    return pk;
  };
  if (!T.analyser) fail('no analyser tap on the destination');
  else {
    Sfx.music.setLevel(1); Sfx.music.setMult(5); Sfx.music.start();
    Sfx.clack({ combo: 2, edges: 2, grade: 'perfect' });
    info.loudPk = await meter(500);
    if (!(info.loudPk > 0.02)) fail('output too quiet before mute: ' + info.loudPk);
    Sfx.setMuted(true);
    if (Sfx.muted !== true || Sfx.stats().muted !== true) fail('muted flag not set');
    await sleep(250);
    const cm = T.created;
    const tm = setInterval(() => { Sfx.clack({ combo: 1 }); Sfx.zzip(0); Sfx.creak(0.95); }, 40);
    Sfx.crash(30, 0); Sfx.smash(); Sfx.ribbon();
    info.mutedPk = await meter(700);
    clearInterval(tm); Sfx.creak(0);
    info.mutedNodes = T.created - cm;
    if (info.mutedPk > 1e-4) fail('muted output peak ' + info.mutedPk);
    if (info.mutedNodes !== 0) fail('calls while muted created ' + info.mutedNodes + ' nodes');
    Sfx.setMuted(false);
    await sleep(150);
    Sfx.clack({ combo: 4 });
    info.unmutedPk = await meter(400);
    if (!(info.unmutedPk > 0.02)) fail('no sound after unmute: ' + info.unmutedPk);
    Sfx.music.stop();
    await sleep(400);
    // ---- 8b. creak watchdog: the game feeds creak() every frame; when it stops (pause overlay, menus,
    //      any phase that skips the update) the creak must fade out by itself, not drone on
    const feed = setInterval(() => Sfx.creak(0.85), 16);
    await sleep(300);
    info.creakFedPk = await meter(300);
    clearInterval(feed);
    await sleep(700);
    info.creakStarvedPk = await meter(300);
    if (!(info.creakFedPk > 0.02)) fail('creak(0.85) not audible: ' + info.creakFedPk);
    if (info.creakStarvedPk > 0.01 * Math.max(info.creakFedPk, 1e-3)) fail('creak still sounding 0.7 s after the last creak() call (peak ' + info.creakStarvedPk + ', fed ' + info.creakFedPk + ')');
    Sfx.creak(0);
  }

  // ---- 8c. slow main thread (phone-like: every node creation costs 0.6 ms, so a clack takes 5-20 ms to build
  //      and a crash ~150 ms, while the audio clock runs on): no source may be start()ed at a time the clock
  //      has already passed (it would begin mid-envelope: a clipped, smeared attack), music steps included,
  //      and the parts of a GREAT clack (snap, tock, octave, body) must still start together (no flam)
  await sleep(300);
  {
    const call = (name, fn) => { T.call = { name, w: [] }; fn(); const c = T.call; T.call = null; return c.w; };
    let flam = 0;
    T.late = []; T.lateN = 0; T.slowStarts = 0; T.slow = true;
    Sfx.music.setLevel(1); Sfx.music.setMult(5); Sfx.music.start();
    for (let i = 0; i < 12; i++) {
      call('zzip', () => Sfx.zzip(0.2)); await sleep(70);
      const w = call('clack', () => Sfx.clack({ combo: i, mass: 1, pan: 0.3, edges: 1, grade: 'great' }));
      if (w.length) flam = Math.max(flam, Math.max(...w) - Math.min(...w));
      call('clack-triple', () => Sfx.clack({ combo: i, mass: 3, pan: -0.3, edges: 3, grade: 'perfect' }));
      await sleep(120);
    }
    call('crash', () => Sfx.crash(30, 0)); await sleep(250);
    call('smash', () => Sfx.smash()); await sleep(250);
    Sfx.music.stop();
    T.slow = false;
    info.slowThread = { starts: T.slowStarts, late: T.lateN, flamMs: +(flam * 1000).toFixed(3) };
    if (T.slowStarts < 200) fail('slow main thread: only ' + T.slowStarts + ' starts recorded');
    if (T.lateN) fail('slow main thread: ' + T.lateN + ' of ' + T.slowStarts + ' sources start()ed in the past (attack skipped), e.g. ' + T.late.slice(0, 6).join(', '));
    if (flam > 1e-6) fail('slow main thread: a GREAT clack\'s parts start ' + info.slowThread.flamMs + ' ms apart (flam)');
    await sleep(800);
  }

  // ---- 9. soak: ~a 10-minute session's events, compressed; then count surviving nodes
  if (SOAK > 0 && typeof gc === 'function') {
    gc(); await sleep(100); gc(); await sleep(100);
    const a0 = T.created - T.finalized, h0 = performance.memory ? performance.memory.usedJSHeapSize : 0;
    Sfx.music.start();
    const t0 = performance.now(); let i = 0, maxS = 0, frame = 0;
    const creakT = setInterval(() => { frame++; Sfx.creak(0.5 + 0.55 * Math.sin(frame / 40)); }, 16);
    while (performance.now() - t0 < SOAK * 1000) {
      Sfx.zzip(0); Sfx.clack({ combo: i, mass: [0.45, 1, 3][i % 3], pan: Math.sin(i), edges: 1 + (i % 3), grade: ['perfect', 'great', 'clack'][i % 4] || 'great' });
      if (i % 20 === 0) Sfx.music.setMult(1 + ((i / 20) % 5)), Sfx.music.setLevel(1 + ((i / 20) % 12));
      if (i % 40 === 10) { Sfx.crash(30, 0); }
      if (i % 40 === 30) { Sfx.smash(); for (let k = 0; k < 10; k++) Sfx.tally(k); }
      if (i % 25 === 5) { Sfx.ring(); Sfx.gear(); Sfx.fuseTick('last'); Sfx.clockTick(3); }
      if (i % 60 === 45) { Sfx.ribbon(); Sfx.crown(); Sfx.cubeFold(i % 5); Sfx.boom(); Sfx.honk(); Sfx.bonk(); Sfx.whooo(0.5); Sfx.thump(); Sfx.save(); Sfx.miss(0); Sfx.aww(); }
      maxS = Math.max(maxS, Sfx.stats().voices);
      i++;
      await sleep(40);
    }
    clearInterval(creakT); Sfx.creak(0);
    Sfx.music.stop();
    await sleep(1500);
    Sfx.creak(0);
    await sleep(700);
    for (let k = 0; k < 4; k++) { gc(); await sleep(150); }
    const h1 = performance.memory ? performance.memory.usedJSHeapSize : 0;
    info.soak = { seconds: SOAK, events: i, maxVoices: maxS, created: T.created, alive: T.created - T.finalized, aliveBefore: a0, voicesAfter: Sfx.stats().voices, heapDeltaKB: Math.round((h1 - h0) / 1024) };
    if (h1 - h0 > 2 * 1024 * 1024) fail('soak: JS heap grew by ' + info.soak.heapDeltaKB + ' KB after GC');
    if (maxS > 24) fail('soak: voices reached ' + maxS);
    if (info.soak.voicesAfter !== 0) fail('soak: ' + info.soak.voicesAfter + ' voices still registered');
    if (info.soak.alive - a0 > 60) fail('soak: ' + (info.soak.alive - a0) + ' more audio nodes alive after GC than before (leak?)');
  } else if (SOAK > 0) fail('gc() unavailable (needs --js-flags=--expose-gc)');
  info.peakVoices = Sfx.stats().peakVoices;
  return { F, info };
};

/* ================================================================== Part B: offline */
const OFFLINE = async ({ SRC }) => {
  const F = [], R = {};
  const fail = (s) => F.push(s);
  const SR = 48000, AT = 0.25;
  const PENTA = []; { const ST = [0, 2, 4, 7, 9]; for (let i = 0; i < 16; i++) PENTA.push(440 * Math.pow(2, (72 + 12 * Math.floor(i / 5) + ST[i % 5] - 69) / 12)); }
  const realResume = OfflineAudioContext.prototype.resume;
  const mk = (secs) => {
    const oc = new OfflineAudioContext(2, Math.ceil(secs * SR), SR);
    Object.defineProperty(oc, 'state', { get: () => 'running', configurable: true });
    oc.resume = () => Promise.resolve();
    const AC0 = window.AudioContext; window.AudioContext = function () { return oc; };
    let S; try { S = new Function(SRC + '\n;return Sfx;')(); S.unlock(); } finally { window.AudioContext = AC0; }
    return { S, oc };
  };
  const q = (t) => Math.round(t * SR / 128) * 128 / SR;
  // events: [[time, fn(S)]]; opts.nostop disables every source's stop() while fn runs
  const render = async (secs, events, nostop) => {
    const { S, oc } = mk(secs);
    await new Promise((r) => setTimeout(r, 0));   // let unlock()'s deferred buffer synthesis finish (deterministic renders)
    const stop0 = AudioScheduledSourceNode.prototype.stop, byQ = new Map();
    for (const [t, fn] of events) { const k = q(t); if (!byQ.has(k)) byQ.set(k, []); byQ.get(k).push(fn); }
    for (const [k, fns] of byQ) {
      oc.suspend(k).then(() => {
        if (nostop) AudioScheduledSourceNode.prototype.stop = function () {};
        try { for (const fn of fns) fn(S, oc); } finally { AudioScheduledSourceNode.prototype.stop = stop0; }
        realResume.call(oc);
      });
    }
    const buf = await oc.startRendering();
    return { L: buf.getChannelData(0), R: buf.getChannelData(1), S };
  };
  const db = (x) => 20 * Math.log10(Math.max(x, 1e-12));
  const peakOf = (L, Rr, i0 = 0, i1 = L.length) => { let p = 0; for (let i = i0; i < i1; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(Rr[i])); if (a > p) p = a; } return p; };
  const rmsOf = (x, i0, i1) => { let s = 0; for (let i = i0; i < i1; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, i1 - i0)); };
  const mono = (L, Rr) => { const m = new Float32Array(L.length); for (let i = 0; i < L.length; i++) m[i] = (L[i] + Rr[i]) / 2; return m; };
  const goertzel = (x, f, i0, i1) => {
    const w = 2 * Math.PI * f / SR, c = 2 * Math.cos(w); let s1 = 0, s2 = 0;
    for (let i = i0; i < i1; i++) { const hann = 0.5 - 0.5 * Math.cos(2 * Math.PI * (i - i0) / (i1 - i0)); const s0 = x[i] * hann + c * s1 - s2; s2 = s1; s1 = s0; }
    return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2)) / (i1 - i0);
  };
  const filt = (x, type, f, qq = 0.707) => {   // RBJ biquad (copy)
    const w = 2 * Math.PI * f / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * qq);
    const b = type === 'lp' ? [(1 - cs) / 2, 1 - cs, (1 - cs) / 2] : [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2];
    const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al, y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) { const y0 = (b[0] * x[i] + b[1] * x1 + b[2] * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = y0; y[i] = y0; }
    return y;
  };
  // A-weighting (IEC 61672 poles, bilinear with prewarping, normalised to 0 dB at 1 kHz) and a phone-speaker
  // weighting (4th-order Butterworth high-pass at 350 Hz): how ears and small speakers hear the balance.
  const fo = (x, type, f) => {
    const K = 2 * SR, w = K * Math.tan(Math.PI * f / SR), d = K + w, a1 = (w - K) / d, b0 = (type === 'hp' ? K : w) / d, b1 = (type === 'hp' ? -K : w) / d;
    const y = new Float32Array(x.length); let x1 = 0, y1 = 0;
    for (let i = 0; i < x.length; i++) { const y0 = b0 * x[i] + b1 * x1 - a1 * y1; x1 = x[i]; y1 = y0; y[i] = y0; }
    return y;
  };
  const aRaw = (x) => fo(fo(fo(fo(fo(fo(x, 'hp', 20.598997), 'hp', 20.598997), 'hp', 107.65265), 'hp', 737.86223), 'lp', 12194.217), 'lp', 12194.217);
  const aNorm = (() => { const s1k = new Float32Array(SR); for (let i = 0; i < SR; i++) s1k[i] = Math.sin(2 * Math.PI * 1000 * i / SR); const y = aRaw(s1k); let a = 0, b = 0; for (let i = SR / 2; i < SR; i++) { a += y[i] * y[i]; b += s1k[i] * s1k[i]; } return Math.sqrt(b / a); })();
  const aW = (x) => { const y = aRaw(x); for (let i = 0; i < y.length; i++) y[i] *= aNorm; return y; };
  const phW = (x) => filt(filt(x, 'hp', 350, 0.5412), 'hp', 350, 1.3066);
  const maxAbs = (x) => { let p = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > p) p = a; } return p; };
  // Welch power spectrum (4096-point Hann, hop 2048) of x[i0..i1): returns per-bin power
  const spectrum = (x, i0, i1) => {
    const N = 4096, P = new Float64Array(N / 2), re = new Float64Array(N), im = new Float64Array(N);
    for (let s = i0; s + N <= i1; s += N / 2) {
      for (let i = 0; i < N; i++) { re[i] = x[s + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); im[i] = 0; }
      for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
      for (let len = 2; len <= N; len <<= 1) {
        const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
        for (let i = 0; i < N; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr; } }
      }
      for (let k = 0; k < N / 2; k++) P[k] += re[k] * re[k] + im[k] * im[k];
    }
    return P;
  };
  const st = (x, w) => { const W = Math.round(w * SR); let acc = 0, best = 0; for (let i = 0; i < x.length; i++) { acc += x[i] * x[i]; if (i >= W) acc -= x[i - W] * x[i - W]; if (acc > best) best = acc; } return Math.sqrt(best / W); };
  const analyse = (L, Rr) => {
    const n = L.length, pk = peakOf(L, Rr), m = mono(L, Rr);
    let on = -1, e60 = -1, e40 = -1, last = -1, sum = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.max(Math.abs(L[i]), Math.abs(Rr[i])); sum += m[i];
      if (a > pk * 1e-3) { if (on < 0) on = i; e60 = i; }
      if (a > pk * 0.01) e40 = i;
      if (a > 1e-7) last = i;
    }
    const first = on >= 0 ? Math.max(Math.abs(L[on]), Math.abs(Rr[on])) / pk : 1;
    const tail = last > 0 ? peakOf(L, Rr, last - Math.round(0.002 * SR), last + 1) / pk : 1;
    const slow = filt(filt(m, 'lp', 10), 'lp', 10); let mdc = 0;   // DC / sub-audio drift: 4th-order 10 Hz low-pass
    for (let i = 0; i < n; i++) mdc = Math.max(mdc, Math.abs(slow[i]));
    return { pk, pkDb: db(pk), st50: db(st(m, 0.05)), st400: db(st(m, 0.4)), on, onMs: (on / SR - AT) * 1000, dur60: (e60 - on) / SR * 1000, dur40: (e40 - on) / SR * 1000,
      first, tail, dc: Math.abs(sum / n) / pk, movDc: mdc / pk, m, a50: db(st(aW(m), 0.05)), ph50: db(st(phW(m), 0.05)) };
  };

  // ------------------------------------------------ every sound: level, duration, onset, tail, DC, stop clicks
  // [name, fn, minDur40, maxDur40 (ms), maxDur60]
  const SOUNDS = [
    ['clack', (S) => S.clack({ combo: 0, mass: 1, pan: 0, edges: 1, grade: 'great' }), 30, 70, 110],
    ['clack-cube-high', (S) => S.clack({ combo: 9, mass: 3, pan: -0.6, edges: 1, grade: 'clack' }), 30, 75, 110],
    ['clack-perfect', (S) => S.clack({ combo: 4, mass: 1, edges: 1, grade: 'perfect' }), 140, 280, 340],
    ['clack-triple', (S) => S.clack({ combo: 9, mass: 0.45, pan: 0.7, edges: 3, grade: 'perfect' }), 140, 280, 340],
    ['zzip', (S) => S.zzip(0), 55, 85, 95],
    ['miss', (S) => S.miss(0.3), 40, 110, 130],
    ['aww', (S) => S.aww(), 400, 700, 750, [100, 150]],
    ['poke', (S) => S.poke(0), 30, 100, 110],
    ['save', (S) => S.save(), 600, 1200, 1300],
    ['crash', (S) => S.crash(30, 0), 750, 1100, 1200],
    ['whistle', (S) => S.whistle(), 620, 800, 820],
    ['smash', (S) => S.smash(), 400, 900, 1000],
    ['tally', (S) => S.tally(7), 15, 60, 70],
    ['ribbon', (S) => S.ribbon(), 900, 1300, 1400],
    ['crown', (S) => S.crown(), 500, 1300, 1400],
    ['ring', (S) => S.ring(), 300, 800, 900],
    ['gear', (S) => S.gear(), 600, 900, 950],
    ['cubeFold', (S) => S.cubeFold(4), 15, 50, 60],
    ['boom', (S) => S.boom(), 200, 500, 600],
    ['honk', (S) => S.honk(), 250, 330, 340],
    ['bonk', (S) => S.bonk(), 60, 220, 260],
    ['whooo1', (S) => S.whooo(1), 950, 1100, 1110, [0, 40]],
    ['whooo2', (S) => S.whooo(2), 1950, 2100, 2110, [0, 40]],
    ['thump', (S) => S.thump(), 150, 400, 450],
    ['fuse-half', (S) => S.fuseTick('half'), 20, 80, 90],
    ['fuse-last', (S) => S.fuseTick('last'), 90, 180, 190],
    ['clock-5', (S) => S.clockTick(5), 20, 100, 110],
    ['clock-1', (S) => S.clockTick(1), 20, 100, 110],
    ['newBest', (S) => S.newBest(), 900, 1600, 1700],
    ['streak-1', (S) => S.streak(1), 500, 1200, 1300],
    ['streak-4', (S) => S.streak(4), 500, 1300, 1400],
    ['clack-perfect-hot', (S) => S.clack({ combo: 4, mass: 1, edges: 1, grade: 'perfect', streak: 30 }), 140, 300, 360],
    ['uiClick', (S) => S.uiClick(), 10, 50, 60],
    ['heartbeat', [[0, (S) => S.creak(0.95)], [0.02, (S) => S.creak(0)], [0.1, (S) => S.creak(0)], [0.3, (S) => S.creak(0)], [0.7, (S) => S.creak(0)], [0.9, (S) => S.creak(0)]], 150, 380, 420],
  ];
  R.sounds = {};
  for (const [name, fn, lo, hi, hi60, onWin] of SOUNDS) {
    const len = name === 'whooo2' ? 3 : 2.25;
    const ev = Array.isArray(fn) ? fn.map(([dt, f]) => [AT + dt, f]) : [[AT, fn]];
    const a = await render(len, ev), a2 = await render(len, ev), b = await render(len, ev, true);
    const A = analyse(a.L, a.R);
    let diff = 0, floor = 0;
    for (let i = 0; i < a.L.length; i++) {
      diff = Math.max(diff, Math.abs(a.L[i] - b.L[i]), Math.abs(a.R[i] - b.R[i]));
      floor = Math.max(floor, Math.abs(a.L[i] - a2.L[i]), Math.abs(a.R[i] - a2.R[i]));
    }
    const r = { pk: +A.pkDb.toFixed(1), st50: +A.st50.toFixed(1), st400: +A.st400.toFixed(1), onMs: +A.onMs.toFixed(1), dur40: Math.round(A.dur40), dur60: Math.round(A.dur60),
      first: +A.first.toFixed(4), tail: +A.tail.toFixed(5), dc: +A.dc.toFixed(5), movDc: +A.movDc.toFixed(4), stopDiff: +db(diff / A.pk).toFixed(0), floor: +db(floor / A.pk).toFixed(0),
      a50: +A.a50.toFixed(1), ph50: +A.ph50.toFixed(1) };
    R.sounds[name] = r;
    if (A.pk > 0.8913) fail(name + ': peak ' + r.pk + ' dBFS > -1');
    if (A.pk > 0.7) fail(name + ': peak ' + r.pk + ' dBFS drives the safety clipper (single sound should stay < -3.1 dBFS)');
    if (A.pkDb < -30) fail(name + ': nearly silent, peak ' + r.pk + ' dBFS');
    if (A.dur40 < lo || A.dur40 > hi) fail(name + ': duration (to -40 dB) ' + r.dur40 + ' ms, want ' + lo + '..' + hi);
    if (A.dur60 > hi60) fail(name + ': tail (to -60 dB) ' + r.dur60 + ' ms, want <= ' + hi60);
    const [on0, on1] = onWin || [0, 20];
    if (A.onMs < on0 || A.onMs > on1) fail(name + ': starts ' + r.onMs + ' ms after the call (want ' + on0 + '..' + on1 + ', incl. 6 ms compressor look-ahead)');
    if (A.first > 0.05) fail(name + ': starts with a step (' + r.first + ' of peak)');
    if (A.tail > 0.01) fail(name + ': ends abruptly (last 2 ms at ' + r.tail + ' of peak)');
    if (A.dc > 2e-3 || A.movDc > 0.01) fail(name + ': DC offset (mean ' + r.dc + ', < 10 Hz drift ' + r.movDc + ' of peak)');
    // Chromium's offline renderer is not bit-exact between identical runs (float-level, <= ~-60 dB re peak),
    // so a stopped-while-audible source must stand out above that run-to-run floor.
    if (diff > Math.max(4 * floor, 1e-3 * A.pk)) fail(name + ': stop click: output changes by ' + r.stopDiff + ' dB re peak when stop() is disabled (run-to-run floor ' + r.floor + ' dB)');
  }

  // ------------------------------------------------ combinations
  {
    const a = await render(2.5, [[AT, (S) => { S.crash(40, 0.3); S.smash(); S.boom(); S.whistle(); S.clack({ combo: 9, mass: 3, edges: 3, grade: 'perfect' }); for (let i = 0; i < 12; i++) S.tally(i); }]]);
    const pk = peakOf(a.L, a.R); R.crashSmashPk = +db(pk).toFixed(2);
    if (pk > 0.8913) fail('crash+smash+boom+clack+tally: peak ' + R.crashSmashPk + ' dBFS > -1');
    // 40 clacks in 1 s on top of x5 music
    const ev = [[AT, (S) => { S.music.setMult(5); S.music.start(); }]];
    for (let i = 0; i < 40; i++) ev.push([AT + 0.2 + i * 0.025, (S) => { S.music.setMult(5); S.zzip(0); S.clack({ combo: i, mass: 3, edges: 3, grade: 'perfect' }); }]);
    for (let t = AT + 0.05; t < 2.4; t += 0.05) ev.push([t, (S) => S.music.setMult(5)]);
    const b = await render(2.5, ev);
    const pk2 = peakOf(b.L, b.R); R.rapidPk = +db(pk2).toFixed(2);
    if (pk2 > 0.8913) fail('40 clacks/s over music: peak ' + R.rapidPk + ' dBFS > -1');
    // a voice cut by the cap fades instead of clicking: same output with stop() disabled
    const cutEv = [[AT, (S) => S.whooo(3)], [AT + 0.5, (S) => { for (let i = 0; i < 24; i++) S.tally(i); R.cutVoices = S.stats().voices; }]];
    const c1 = await render(3.6, cutEv), c2 = await render(3.6, cutEv, true), c3 = await render(3.6, cutEv);
    let d = 0, fl = 0; for (let i = 0; i < c1.L.length; i++) { d = Math.max(d, Math.abs(c1.L[i] - c2.L[i])); fl = Math.max(fl, Math.abs(c1.L[i] - c3.L[i])); }
    R.cutStopDiff = +db(d / peakOf(c1.L, c1.R)).toFixed(0);
    if (R.cutVoices !== 24) fail('cap: ' + R.cutVoices + ' voices after 25 calls');
    if (d > Math.max(4 * fl, 1e-3 * peakOf(c1.L, c1.R))) fail('voice cut clicks: ' + R.cutStopDiff + ' dB');
    // music stop fades instead of clicking
    const mEv = [[AT, (S) => { S.music.setMult(5); S.music.start(); }], [1.4, (S) => S.music.stop()]];
    for (let t = AT + 0.05; t < 1.38; t += 0.05) mEv.push([t, (S) => S.music.setMult(5)]);
    const m1 = await render(2, mEv), m2 = await render(2, mEv, true), m3 = await render(2, mEv);
    let dm = 0, fm = 0; for (let i = 0; i < m1.L.length; i++) { dm = Math.max(dm, Math.abs(m1.L[i] - m2.L[i])); fm = Math.max(fm, Math.abs(m1.L[i] - m3.L[i])); }
    R.musicStopDiff = +db(dm / peakOf(m1.L, m1.R)).toFixed(0);
    if (dm > Math.max(4 * fm, 1e-3 * peakOf(m1.L, m1.R))) fail('music.stop() clicks: ' + R.musicStopDiff + ' dB');
    const after = peakOf(m1.L, m1.R, Math.round((1.4 + 0.1) * SR), m1.L.length);
    if (after > 1e-4) fail('music still audible after stop(): ' + after);
    // mute silences, including a running creak
    const u = await render(1.5, [[AT, (S) => { S.creak(0.9); S.clack({ combo: 1 }); }], [0.5, (S) => S.setMuted(true)], [0.7, (S) => { S.clack({ combo: 2 }); S.crash(20, 0); S.creak(1); }]]);
    R.mutedPk = peakOf(u.L, u.R, Math.round(0.65 * SR), u.L.length);
    if (R.mutedPk > 1e-4) fail('mute: output peak ' + R.mutedPk + ' after setMuted(true)');
  }

  // ------------------------------------------------ the clack, in detail
  {
    R.tock = [];
    for (let c = 0; c < 10; c++) {
      const a = await render(0.6, [[AT, (S) => S.clack({ combo: c + 10 * (c % 3), mass: 1, edges: 1, grade: 'great' })]]);
      const m = mono(a.L, a.R), i0 = Math.round((AT + 0.016) * SR), i1 = Math.round((AT + 0.05) * SR);
      const mags = PENTA.slice(0, 10).map((f) => goertzel(m, f, i0, i1));
      const best = mags.indexOf(Math.max(...mags));
      R.tock.push(best);
      if (best !== c) fail('combo ' + (c + 10 * (c % 3)) + ': strongest pentatonic pitch is index ' + best + ', want ' + c);
    }
    const body = [];
    for (const mass of [0.45, 1, 3]) {
      const a = await render(0.6, [[AT, (S) => S.clack({ combo: 5, mass, edges: 1, grade: 'great' })]]);
      const m = mono(a.L, a.R); body.push(goertzel(m, 140, Math.round((AT + 0.006) * SR), Math.round((AT + 0.07) * SR)));
    }
    R.bodyDb = body.map((x) => +db(x / body[1]).toFixed(1));
    if (!(body[0] < body[1] && body[1] < body[2])) fail('body does not scale with mass: ' + R.bodyDb);
    const edge = async (edges, grade) => { const a = await render(0.8, [[AT, (S) => S.clack({ combo: 2, mass: 1, edges, grade })]]); return mono(a.L, a.R); };
    const e1 = await edge(1, 'great'), e3 = await edge(3, 'great'), p1 = await edge(1, 'perfect');
    const w = (t0, t1) => [Math.round((AT + 0.006 + t0) * SR), Math.round((AT + 0.006 + t1) * SR)];
    const g2 = db(goertzel(e3, PENTA[5], ...w(0.03, 0.06)) / goertzel(e1, PENTA[5], ...w(0.03, 0.06)));
    const g3 = db(goertzel(e3, PENTA[8], ...w(0.058, 0.1)) / goertzel(e1, PENTA[8], ...w(0.058, 0.1)));
    const gt = db(goertzel(p1, 2093, ...w(0.04, 0.2)) / goertzel(e1, 2093, ...w(0.04, 0.2)));
    R.edgeRunDb = [+g2.toFixed(1), +g3.toFixed(1)]; R.tingDb = +gt.toFixed(1);
    if (g2 < 15 || g3 < 15) fail('TRIPLE: extra notes a fifth up at +28/+56 ms missing (' + R.edgeRunDb + ' dB over a single)');
    if (gt < 20) fail('PERFECT ting at 2093 Hz only ' + R.tingDb + ' dB over a GREAT');
    // you can hear your streak: the ting climbs a pentatonic step a PERFECT (C7 D7 E7 G7 A7), an octave up from the 6th
    const TING = [2093, 2093, 2349.3, 2637, 3136, 3520, 4186];
    R.tingClimb = [];
    for (const n of [1, 2, 3, 4, 5, 6, 20]) {
      const a = await render(0.8, [[AT, (S) => S.clack({ combo: 2, mass: 1, edges: 1, grade: 'perfect', streak: n })]]), m = mono(a.L, a.R);
      const want = TING[Math.min(n, 6)], mags = [2093, 2349.3, 2637, 3136, 3520, 4186].map((f) => goertzel(m, f, ...w(0.06, 0.24)));
      const best = [2093, 2349.3, 2637, 3136, 3520, 4186][mags.indexOf(Math.max(...mags))];
      R.tingClimb.push(Math.round(best));
      if (Math.abs(best - want) > 1) fail('streak ' + n + ': the ting rings at ' + Math.round(best) + ' Hz, want ' + want);
    }
  }
  // ------------------------------------------------ a streak milestone's fanfare: a run up into a bell chord, longer and
  // higher each tier, in key (its strongest partials are pentatonic notes)
  {
    R.streakFanfare = [];
    for (const tier of [1, 2, 3, 4]) {
      const a = await render(1.6, [[AT, (S) => S.streak(tier)]]), m = mono(a.L, a.R), A = analyse(a.L, a.R);
      R.streakFanfare.push({ tier, dur40: Math.round(A.dur40), pk: +A.pkDb.toFixed(1) });
    }
    const d = R.streakFanfare.map((x) => x.dur40);
    if (!(d[3] > d[0])) fail('streak fanfare does not grow with the tier: ' + JSON.stringify(R.streakFanfare));
  }

  // ------------------------------------------------ one pan law: a sound's total power does not step with the pan
  // (a clack near the centre; and the quieter mono sounds, which sit under the compressor, across the field: a
  // loud clack hard to one side is compressed a little more, as any one-channel peak is)
  {
    const pw2 = async (fn) => { const a = await render(0.6, [[AT, fn]]); let e = 0; for (let i = 0; i < a.L.length; i++) e += a.L[i] * a.L[i] + a.R[i] * a.R[i]; return e; };
    const cl = (pan) => (S) => S.clack({ combo: 2, mass: 1, pan, edges: 1, grade: 'great' });
    const c0 = await pw2(cl(0)), c1 = await pw2(cl(0.02)), c2 = await pw2(cl(0.1));
    R.panLawDb = { clack: [0, +db(Math.sqrt(c1 / c0)).toFixed(2), +db(Math.sqrt(c2 / c0)).toFixed(2)] };
    if (Math.abs(R.panLawDb.clack[1]) > 0.5 || Math.abs(R.panLawDb.clack[2]) > 0.5) fail('the clack level steps with the pan: ' + R.panLawDb.clack + ' dB at pan 0 / 0.02 / 0.1');
    for (const k of ['zzip', 'miss', 'poke']) {
      const p0 = await pw2((S) => S[k](0)), p1 = await pw2((S) => S[k](0.02)), p5 = await pw2((S) => S[k](0.5));
      R.panLawDb[k] = [0, +db(Math.sqrt(p1 / p0)).toFixed(2), +db(Math.sqrt(p5 / p0)).toFixed(2)];
      if (Math.abs(R.panLawDb[k][1]) > 0.5 || Math.abs(R.panLawDb[k][2]) > 0.5) fail(k + ' level steps with the pan: ' + R.panLawDb[k] + ' dB at pan 0 / 0.02 / 0.5');
    }
  }
  // ------------------------------------------------ without cancelAndHoldAtTime a duck during a duck's recovery does not step
  {
    const ev = [[AT, (S) => { S.music.setLevel(1); S.music.setMult(5); S.music.start(); }]];
    for (let t = AT + 0.05; t < 3.9; t += 0.05) ev.push([t, (S) => S.music.setMult(5)]);
    ev.push([q(AT + 1.0), (S) => S.music.duck(1)], [q(AT + 2.2), (S) => S.music.duck(1)]);
    const withHold = await render(4.2, ev);
    const P = AudioParam.prototype, cah = P.cancelAndHoldAtTime;
    let noHold;
    try { delete P.cancelAndHoldAtTime; noHold = await render(4.2, ev); } finally { P.cancelAndHoldAtTime = cah; }
    // energy per 1 ms around the second duck: the gain may not dip (a snap back to the first ramp's start)
    const e = (x, i) => { let s2 = 0; for (let k = i; k < i + 48; k++) s2 += x.L[k] * x.L[k] + x.R[k] * x.R[k]; return s2; };
    let worst = 1;
    const i0 = Math.round((AT + 2.2 - 0.01) * SR), i1 = Math.round((AT + 2.2 + 0.06) * SR);
    for (let i = i0; i < i1; i += 48) { const a = e(withHold, i), b = e(noHold, i); if (a > 1e-7) worst = Math.min(worst, Math.sqrt(b / a)); }
    R.holdFallbackMinRatio = +worst.toFixed(3);
    if (worst < 0.85) fail('without cancelAndHoldAtTime a second duck steps the music (gain ratio down to ' + R.holdFallbackMinRatio + ')');
  }

  // ------------------------------------------------ zzip rises, whistle glides, crash pans and clatters
  {
    const z = await render(0.6, [[AT, (S) => S.zzip(0)]]), zm = mono(z.L, z.R);
    const cen = (t0, t1) => { const i0 = Math.round((AT + 0.006 + t0) * SR), i1 = Math.round((AT + 0.006 + t1) * SR); let num = 0, den = 0; for (let f = 400; f <= 6000; f += 100) { const g = goertzel(zm, f, i0, i1) ** 2; num += f * g; den += g; } return num / den; };
    R.zzipCentroid = [Math.round(cen(0, 0.03)), Math.round(cen(0.035, 0.07))];
    if (!(R.zzipCentroid[1] > R.zzipCentroid[0] * 1.4)) fail('zzip does not rise: centroid ' + R.zzipCentroid);
    const wh = await render(1.4, [[AT, (S) => S.whistle()]]), wm = mono(wh.L, wh.R);
    const pitch = (t0, t1) => { let bf = 0, bm = 0; const i0 = Math.round((AT + 0.006 + t0) * SR), i1 = Math.round((AT + 0.006 + t1) * SR); for (let f = 200; f <= 1500; f += 5) { const g = goertzel(wm, f, i0, i1); if (g > bm) { bm = g; bf = f; } } return bf; };
    R.whistleHz = [pitch(0.045, 0.075), pitch(0.33, 0.37), pitch(0.62, 0.66)];
    if (Math.abs(R.whistleHz[0] - 1200) > 80 || Math.abs(R.whistleHz[2] - 300) > 40 || !(R.whistleHz[1] < R.whistleHz[0] && R.whistleHz[1] > R.whistleHz[2])) fail('whistle glide ' + R.whistleHz + ' Hz, want 1200 -> 300');
    const side = async (x) => { const a = await render(1.6, [[AT, (S) => S.crash(30, x)]]); const l = filt(a.L, 'hp', 2500), r = filt(a.R, 'hp', 2500); return db(rmsOf(l, 0, l.length) / rmsOf(r, 0, r.length)); };
    R.crashLR = [+(await side(-0.9)).toFixed(1), +(await side(0.9)).toFixed(1)];
    if (!(R.crashLR[0] > 3 && R.crashLR[1] < -3)) fail('crash not panned by x: L/R ' + R.crashLR + ' dB');
    const c = await render(1.6, [[AT, (S) => S.crash(30, 0)]]);
    const hf = filt(mono(c.L, c.R), 'hp', 800); const env = new Float32Array(hf.length); let e = 0;
    for (let i = 0; i < hf.length; i++) { e = Math.max(Math.abs(hf[i]), e * Math.exp(-1 / (0.004 * SR))); env[i] = e; }
    let peaks = 0, lastP = -1e9; const mx = maxAbs(env);
    for (let i = 1; i < env.length - 1; i++) if (env[i] > 0.1 * mx && env[i] >= env[i - 1] && env[i] > env[i + 1] && i - lastP > 0.008 * SR) { peaks++; lastP = i; }
    R.crashHits = peaks;
    if (peaks < 15) fail('crash cascade: only ' + peaks + ' distinct clatter hits');
  }

  // ------------------------------------------------ creak: ((level-0.4)/0.6)^2, heartbeat above 0.9
  {
    const ev = [[AT, (S) => S.creak(0.3)], [0.8, (S) => S.creak(0.7)], [1.6, (S) => S.creak(1)], [2.6, (S) => S.creak(0.2)]];
    for (let t = 0.85; t < 1.6; t += 0.05) ev.push([t, (S) => S.creak(0.7)]);
    for (let t = 1.65; t < 2.6; t += 0.05) ev.push([t, (S) => S.creak(1)]);
    for (let t = 2.65; t < 3.6; t += 0.05) ev.push([t, (S) => S.creak(0.2)]);
    const a = await render(3.8, ev), m = mono(a.L, a.R), hp = filt(filt(m, 'hp', 250), 'hp', 250), lp = filt(filt(m, 'lp', 150), 'lp', 150);
    const r = (x, t0, t1) => rmsOf(x, Math.round(t0 * SR), Math.round(t1 * SR));
    const quiet = r(m, 0.3, 0.78), c7 = r(hp, 1.2, 1.6), c10 = r(hp, 2.1, 2.6), hb7 = r(lp, 1.2, 1.6), hb10 = r(lp, 1.7, 2.6), end = r(m, 3.3, 3.8);
    R.creak = { quietDb: +db(quiet).toFixed(0), at07: +db(c7).toFixed(1), at10: +db(c10).toFixed(1), ratioDb: +db(c10 / c7).toFixed(1), heartbeatDb: +db(hb10 / hb7).toFixed(1), endDb: +db(end).toFixed(0) };
    if (quiet > 1e-4) fail('creak audible at level 0.3');
    if (Math.abs(db(c10 / c7) - 12) > 4) fail('creak level 1.0 vs 0.7 is ' + R.creak.ratioDb + ' dB, want ~12 (volume ((l-0.4)/0.6)^2)');
    if (db(hb10 / hb7) < 10) fail('no heartbeat above 0.9 (' + R.creak.heartbeatDb + ' dB)');
    if (end > 1e-4) fail('creak still audible after level drops');
  }

  // ------------------------------------------------ music: layers, tempo, level under the sfx, duck
  {
    const music = async (mult, level, secs, extra) => {
      const ev = [[AT, (S) => { S.music.setLevel(level); S.music.setMult(mult); S.music.start(); }]];
      for (let t = AT + 0.05; t < secs + AT; t += 0.05) ev.push([t, (S) => S.music.setMult(mult)]);
      if (extra) ev.push(...extra);
      const a = await render(secs + AT + 0.3, ev);
      return { m: mono(a.L, a.R), pk: peakOf(a.L, a.R), L: a.L, R: a.R };
    };
    const t0 = AT + 0.06;   // first step
    // Layers: renders are deterministic per step (noise offsets come from the step number) and the music
    // stays under the compressor threshold, so x(m) - x(m-1) is exactly the layer that x(m) adds.
    const cent = (x) => { const i0 = Math.round(t0 * SR), P = spectrum(x, i0, i0 + Math.round(4 * SR)); let num = 0, den = 0; for (let k = 1; k < P.length; k++) { num += k * SR / 4096 * P[k]; den += P[k]; } return num / den; };
    const WANT = [null, [60, 450], [250, 1300], [600, 3000], [1200, 3600]];   // x2 bass, x3 marimba, x4 clap, x5 sparkle
    const NAMES = [null, 'bass', 'marimba', 'claps', 'sparkle'];
    const mx = [];
    R.music = { layers: {} };
    for (let mult = 1; mult <= 5; mult++) {
      const a = await music(mult, 1, 4.2);
      mx.push(a.m);
      R.music['x' + mult] = { pk: +db(a.pk).toFixed(1), st400: +db(st(a.m, 0.4)).toFixed(1), A400: +db(st(aW(a.m), 0.4)).toFixed(1), Ph400: +db(st(phW(a.m), 0.4)).toFixed(1) };
      if (a.pk > 0.8913) fail('music x' + mult + ' peak > -1 dBFS');
    }
    const i0 = Math.round(t0 * SR), i1 = i0 + Math.round(4 * SR);
    for (let k = 1; k < 5; k++) {
      const d = new Float32Array(mx[k].length); for (let i = 0; i < d.length; i++) d[i] = mx[k][i] - mx[k - 1][i];
      // audibility with a rough loudness weighting (2nd-order high-pass at 300 Hz, as ears and phone speakers hear it)
      const wt = (x) => filt(x, 'hp', 300);
      const rel = db(rmsOf(wt(d), i0, i1) / rmsOf(wt(mx[k - 1]), i0, i1)), c = cent(d);
      R.music.layers[NAMES[k]] = { relDb: +rel.toFixed(1), centroidHz: Math.round(c) };
      if (rel < -12) fail('music x' + (k + 1) + ' (' + NAMES[k] + ') barely audible: ' + rel.toFixed(1) + ' dB (weighted) re x' + k);
      if (c < WANT[k][0] || c > WANT[k][1]) fail('music x' + (k + 1) + ' (' + NAMES[k] + ') centroid ' + Math.round(c) + ' Hz, want ' + WANT[k]);
    }
    { const lo = filt(filt(mx[0], 'lp', 120), 'lp', 120), hi = filt(mx[0], 'hp', 4000);
      R.music.x1KickShakerDb = [+db(rmsOf(lo, i0, i1)).toFixed(1), +db(rmsOf(hi, i0, i1)).toFixed(1)];
      if (rmsOf(lo, i0, i1) < 3e-3 || rmsOf(hi, i0, i1) < 2e-3) fail('music x1 needs an audible kick and shaker: ' + R.music.x1KickShakerDb + ' dBFS RMS'); }
    for (let k = 1; k < 5; k++) if (R.music['x' + (k + 1)].st400 < R.music['x' + k].st400 - 0.5) fail('music gets quieter from x' + k + ' to x' + (k + 1));
    // tempo: kick onsets (low band) every 8 steps
    const kicks = (m) => { const lp = filt(filt(m, 'lp', 100), 'lp', 100); const on = []; let armedK = true; const thr = 0.3 * maxAbs(lp); for (let i = 0; i < lp.length; i++) { const a = Math.abs(lp[i]); if (armedK && a > thr) { on.push(i / SR); armedK = false; } if (!armedK && on.length && i / SR - on[on.length - 1] > 0.3) armedK = true; } return on; };
    const k1 = kicks((await music(1, 1, 4.2)).m), k11 = kicks((await music(1, 11, 4.2)).m);
    const iv = (o) => o.slice(1).map((t, i) => t - o[i]);
    R.music.kick120 = iv(k1).map((x) => +x.toFixed(4)); R.music.kick150 = iv(k11).map((x) => +x.toFixed(4));
    if (!R.music.kick120.length || R.music.kick120.some((x) => Math.abs(x - 1.0) > 0.003)) fail('120 BPM: kicks not every 1.0 s: ' + R.music.kick120);
    if (!R.music.kick150.length || R.music.kick150.some((x) => Math.abs(x - 0.8) > 0.003)) fail('150 BPM: kicks not every 0.8 s: ' + R.music.kick150);
    // music sits under the sfx
    const cl = R.sounds.clack;
    R.music.underDb = +(cl.st50 - R.music.x5.st400).toFixed(1);
    // ...and as ears (A-weighting) and phone speakers (HP 350 Hz) hear it, where the kick's sub-bass thump
    // counts for little: x1 (kick + shaker, where every miss and crash resets to) must be clearly audible,
    // x5 must still sit >= 8 dB under a GREAT clack, and the kick must not pump the compressor.
    const x1 = R.music.x1, x5 = R.music.x5;
    R.music.balance = { x1UnderClackA: +(cl.a50 - x1.A400).toFixed(1), x1UnderClackPhone: +(cl.ph50 - x1.Ph400).toFixed(1),
      x5UnderClackA: +(cl.a50 - x5.A400).toFixed(1), x5UnderClackPhone: +(cl.ph50 - x5.Ph400).toFixed(1) };
    const B = R.music.balance;
    if (B.x1UnderClackA > 17 || B.x1UnderClackPhone > 17) fail('music x1 (kick + shaker) too quiet: ' + B.x1UnderClackA + ' dB(A) / ' + B.x1UnderClackPhone + ' dB (phone) under a clack, want <= 17');
    // like with like: a typical in-game clack (pan 0.15) over the x5 groove's loudest 50 ms, A- and phone-weighted
    {
      const c15 = await render(0.8, [[AT, (S) => S.clack({ combo: 0, mass: 1, pan: 0.15, edges: 1, grade: 'great' })]]);
      const cm = mono(c15.L, c15.R), x5m = mx[4];
      R.music.like = { clackA50: +db(st(aW(cm), 0.05)).toFixed(1), x5A50: +db(st(aW(x5m), 0.05)).toFixed(1),
        clackPh50: +db(st(phW(cm), 0.05)).toFixed(1), x5Ph50: +db(st(phW(x5m), 0.05)).toFixed(1), clackA400: +db(st(aW(cm), 0.4)).toFixed(1) };
      const L = R.music.like;
      L.overA = +(L.clackA50 - L.x5A50).toFixed(1); L.overPhone = +(L.clackPh50 - L.x5Ph50).toFixed(1);
      if (L.overA < 6 || L.overPhone < 6) fail('a pan-0.15 clack is not >= 6 dB over the x5 groove (loudest 50 ms each): ' + L.overA + ' dB(A) / ' + L.overPhone + ' dB (phone)');
      // the aww (misses are frequent for kids) sits under a clack: its loudest 400 ms, A-weighted
      const aw = await render(1.6, [[AT, (S) => S.aww()]]);
      R.awwA400 = +db(st(aW(mono(aw.L, aw.R)), 0.4)).toFixed(1);
      if (R.awwA400 > L.clackA400) fail('the aww (' + R.awwA400 + ' dB(A), 400 ms) is louder than a clack (' + L.clackA400 + ')');
    }
    if (x1.pk > -10) fail('music x1 peaks at ' + x1.pk + ' dBFS: the kick drives the compressor (pumping)');
    // duck(1): 0.3 for 1 s, then back (x1 repeats every 1 s, so equal windows compare like with like)
    const dk = await music(1, 1, 4.6, [[q(t0 + 2.0), (S) => S.music.duck(1)]]);
    const win = (a, b) => rmsOf(dk.m, Math.round((t0 + a) * SR), Math.round((t0 + b) * SR));
    R.music.duckDb = +db(win(2.06, 2.96) / win(1.06, 1.96)).toFixed(1);
    R.music.recoverDb = +db(win(3.45, 4.4) / win(0.45, 1.4)).toFixed(1);
    if (Math.abs(R.music.duckDb - db(0.3)) > 2) fail('duck: music at ' + R.music.duckDb + ' dB, want ' + db(0.3).toFixed(1));
    if (Math.abs(R.music.recoverDb) > 1.5) fail('music did not recover after the duck: ' + R.music.recoverDb + ' dB');
    // crash ducks the music: the kick at +3.0 s (inside a crash at +2.2 s) vs the kick at +1.0 s
    const cr = await music(1, 1, 4.2, [[q(t0 + 2.2), (S) => S.crash(20, 0)]]);
    const lpk = filt(filt(cr.m, 'lp', 90), 'lp', 90);
    const kpk = (t) => peakOf(lpk, lpk, Math.round((t0 + t) * SR), Math.round((t0 + t + 0.08) * SR));
    R.music.crashDuckDb = +db(kpk(3.0) / kpk(1.0)).toFixed(1);
    if (R.music.crashDuckDb > -7) fail('crash does not duck the music: kick at ' + R.music.crashDuckDb + ' dB');
    delete R.music.x5m;
  }
  return { F, R };
};

/* ================================================================== Part D: wiring (the game calls its sounds) */
// every Sfx call the game makes, with the game time it was made at (creak: counted, every frame)
const RECORD = () => {
  const R = window.__rec = { calls: [], frames: 0, creak: 0, creakMax: 0, creakPlay: 0 };
  const wrap = (obj, name, key) => {
    const f = obj[key];
    obj[key] = function () {
      if (name === 'creak') { R.creak++; const l = +arguments[0] || 0; if (l > R.creakMax) R.creakMax = l; if (S.phase === 'play') R.creakPlay++; }
      else {
        const a0 = arguments[0];
        R.calls.push({ k: name, t: S.gt, ph: S.phase, a: Array.isArray(a0) ? a0.slice() : a0 && typeof a0 === 'object' ? Object.assign({}, a0) : a0 });
      }
      return f.apply(this, arguments);
    };
  };
  for (const k of Object.keys(Sfx)) { const d = Object.getOwnPropertyDescriptor(Sfx, k); if (d && typeof d.value === 'function') wrap(Sfx, k, k); }
  for (const k of Object.keys(Sfx.music)) wrap(Sfx.music, 'music.' + k, k);
  (function f() { if (S.phase === 'play') R.frames++; requestAnimationFrame(f); })();
};
const VIEWD = { width: 390, height: 844 };
async function dOpen(browser, params, realClock) {
  const ctx = await browser.newContext({ viewport: VIEWD });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await ctx.newPage();
  watch(page, 'D');
  if (!realClock && params.autostart) {
    await page.addInitScript(() => { (function keep() { try { if (window.CS && S.clock < 20 && (S.phase === 'play' || S.phase === 'crash')) CS.setClock(60); } catch (e) { /* booting */ } requestAnimationFrame(keep); })(); });
  }
  await page.goto(gameUrl(Object.assign({ mute: 1, nohint: 1 }, params)), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.CS, null, { timeout: 15000 });
  await page.evaluate(RECORD);
  return { ctx, page };
}
const dUntil = (page, fn, arg, ms) => page.waitForFunction(fn, arg, { polling: 'raf', timeout: ms || 20000 });
const dReady = (page) => dUntil(page, () => { const s = CS.state(); return (s.phase === 'play' && s.handReady && !s.locked && s.inAir === 0) || s.phase === 'over'; });
async function dGame(page, dt) { const t0 = await page.evaluate(() => CS.state().t); await dUntil(page, (t) => CS.state().t >= t, t0 + dt, 60000); }
async function dTap(page, x) { await page.mouse.move(x, VIEWD.height * 0.5); await page.mouse.down(); await page.mouse.up(); }
// a tidy builder: the PERFECT centre of the lowest supported slot nearest the middle (any piece)
async function dBuild(page, n, stop) {
  for (let k = 0; k < n; k++) {
    await dReady(page);
    if (stop && await page.evaluate(stop)) return;
    const p = await page.evaluate(() => {
      const st = CS.state(); if (st.phase !== 'play') return null;
      let sl = CS.slots().filter((s) => s.supported && !s.tippy);
      if (!sl.length) sl = CS.slots().filter((s) => s.supported);
      if (!sl.length) sl = CS.slots();
      sl.sort((a, b) => a.y - b.y || Math.abs(a.x) - Math.abs(b.x));
      return sl[0] || null;
    });
    if (!p) { await dTap(page, 3); await dGame(page, 0.3); continue; }
    await dTap(page, p.sx);
    await dGame(page, 0.25);
  }
}
async function WIRING(browser) {
  const F = [], info = {};
  const fail = (s) => F.push(s);
  const logs = [];
  // ---- D1: title, a level cleared to the SMASH, a miss, a fuse drop, the clock run out, the results, AGAIN
  {
    const { ctx, page } = await dOpen(browser, { seed: 3, ts: 2 }, true);
    await page.waitForTimeout(300);
    const ui = await page.evaluate(() => ({ boxes: Art.titleLetterBoxes(CAM.titleX, CAM.titleY, CAM.titleW).map((b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })), tapY: CAM.tapY }));
    await page.mouse.click(ui.boxes[2].x, ui.boxes[2].y);                    // poke a letter
    await page.waitForTimeout(100);
    await page.mouse.click(VIEWD.width / 2, ui.tapY);                         // TAP: the shove
    await dUntil(page, () => CS.state().phase === 'play' && CS.state().handReady && !CS.state().locked);
    await dBuild(page, 1);
    await dReady(page);
    await dTap(page, 2);                                                      // a MISS at the screen edge
    await dGame(page, 1.2);
    await dReady(page);
    await dGame(page, 3.0);                                                   // hands off: the fuse drops it
    await dBuild(page, 40, () => CS.events.some((e) => e.type === 'smash'));
    await dUntil(page, () => CS.state().phase === 'play' && CS.state().level === 2, null, 30000);
    await page.evaluate(() => CS.setClock(5.6));
    await dUntil(page, () => CS.state().phase === 'over', null, 30000);
    await dUntil(page, () => CS.state().over && CS.state().over.open && window.__rec.calls.some((c) => c.k === 'newBest'), null, 15000).catch(() => {});
    const again = await page.evaluate(() => CS.ui().again);
    await page.mouse.click(again.x + again.w / 2, again.y + again.h / 2);
    await dUntil(page, () => CS.state().phase === 'play', null, 10000).catch(() => {});
    await page.waitForTimeout(200);
    logs.push(await page.evaluate(() => ({ tag: 'D1', end: S.gt, calls: __rec.calls, ev: CS.events.slice(), frames: __rec.frames, creak: __rec.creak, creakPlay: __rec.creakPlay, creakMax: __rec.creakMax })));
    await ctx.close();
  }
  // ---- D2: level 8, hazards (bump car, foot), cubes and marble squares in the bag
  {
    const { ctx, page } = await dOpen(browser, { seed: 36, ts: 4, level: 8, autostart: 1 });
    await dUntil(page, () => CS.state().phase === 'play' && CS.state().handReady);
    await dBuild(page, 14);
    await dGame(page, 22);
    logs.push(await page.evaluate(() => ({ tag: 'D2', end: S.gt, calls: __rec.calls, ev: CS.events.slice(), frames: __rec.frames, creak: __rec.creak, creakPlay: __rec.creakPlay, creakMax: __rec.creakMax })));
    await ctx.close();
  }
  // ---- D3: an EdgeBot on level 3 (one car): the tower tips (the creak) and crashes
  {
    const { ctx, page } = await dOpen(browser, { seed: 1, ts: 4, level: 3, autostart: 1 });
    await dUntil(page, () => CS.state().phase === 'play' && CS.state().handReady);
    for (let k = 0; k < 40; k++) {
      await dUntil(page, () => { const s = CS.state(); return (s.phase === 'play' && s.handReady && !s.locked) || s.crashes > 0; });
      if (await page.evaluate(() => CS.state().crashes > 0)) break;
      const p = await page.evaluate(() => { const sl = CS.slots(); sl.sort((a, b) => b.x - a.x); return sl[0] || null; });
      if (!p) { await dTap(page, 3); continue; }
      await dTap(page, p.sx);
      await dGame(page, 0.3);
    }
    await dGame(page, 1.5);
    logs.push(await page.evaluate(() => ({ tag: 'D3', end: S.gt, calls: __rec.calls, ev: CS.events.slice(), frames: __rec.frames, creak: __rec.creak, creakPlay: __rec.creakPlay, creakMax: __rec.creakMax })));
    await ctx.close();
  }
  // ---- the checks
  const all = [].concat(...logs.map((l) => l.calls));
  const called = (k) => all.some((c) => c.k === k);
  const at = (l, k, t, dt) => l.calls.some((c) => c.k === k && c.t >= t - 5e-4 && c.t <= t + (dt || 5e-4));
  // events -> the sound made in the same step (miss: when the dropped tile hits; level: the music's tempo)
  const MAP = { land: ['clack'], crash: ['crash'], save: ['save'], ring: ['ring'], brace: ['gear'], goal: ['ribbon'], crown: ['crown'], smash: ['smash'],
    bump: ['bonk'], honk: ['honk'], stomp: ['whooo'], foot: ['thump'], level: ['music.setLevel'], shove: ['boom', 'crash'], over: ['whistle', 'music.stop'] };
  const seen = {};
  for (const l of logs) {
    for (const e of l.ev) {
      const m = MAP[e.type];
      // (the aww at most every 2.5 s: a MISS within 2.5 s of the last one's aww gets the tok alone)
      if (e.type === 'miss') { seen.miss = (seen.miss || 0) + 1; if (e.t < l.end - 2 && (!at(l, 'miss', e.t, 2) || !l.calls.some((c) => c.k === 'aww' && c.t >= e.t - 2.5 - 1e-3 && c.t <= e.t + 2))) fail(l.tag + ': a MISS at ' + e.t.toFixed(3) + ' without miss() when the tile hit (and an aww() then, or in the 2.5 s before)'); continue; }
      if (!m) continue;
      seen[e.type] = (seen[e.type] || 0) + 1;
      for (const k of m) if (!at(l, k, e.t)) fail(l.tag + ': ' + e.type + ' at ' + e.t.toFixed(3) + ' without Sfx.' + k + '() in the same step');
    }
    // a landing's clack carries its grade, edges, combo, mass and pan; a zzip for every landing
    const lands = l.ev.filter((e) => e.type === 'land');
    for (const e of lands) {
      const c = l.calls.find((x) => x.k === 'clack' && Math.abs(x.t - e.t) < 5e-4);
      if (c && !(c.a && c.a.grade === e.grade && c.a.edges === Math.min(3, e.edges) && c.a.combo === e.combo && typeof c.a.pan === 'number' && c.a.mass > 0)) fail(l.tag + ': the clack at ' + e.t.toFixed(3) + ' does not carry the landing (' + JSON.stringify(c.a) + ' vs ' + e.grade + '/' + e.edges + '/' + e.combo + ')');
    }
    const zz = l.calls.filter((c) => c.k === 'zzip').length;
    if (zz < lands.length) fail(l.tag + ': ' + zz + ' zzips for ' + lands.length + ' landings');
    // a cube folds with 5 hinge clacks and lands with a BOOM
    for (const e of lands.filter((x) => x.shape === 'cube')) {
      seen.cube = (seen.cube || 0) + 1;
      const folds = l.calls.filter((c) => c.k === 'cubeFold' && c.t <= e.t + 5e-4 && c.t >= e.t - 0.6).map((c) => c.a);
      if (folds.join() !== '0,1,2,3,4') fail(l.tag + ': the cube landing at ' + e.t.toFixed(3) + ' folded with ' + folds.join());
      if (!at(l, 'boom', e.t)) fail(l.tag + ': the cube landing at ' + e.t.toFixed(3) + ' without a boom');
    }
    // the multiplier: every rise is heard (setMult(mult)); a MISS / crash drops it back to 1
    for (const e of lands) if (e.mult > 1 && !l.calls.some((c) => c.k === 'music.setMult' && c.a === e.mult && c.t <= e.t + 5e-4)) fail(l.tag + ': multiplier x' + e.mult + ' at ' + e.t.toFixed(3) + ' never reached the music');
    for (const e of l.ev.filter((x) => x.type === 'miss' || x.type === 'crash')) if (!l.calls.some((c) => c.k === 'music.setMult' && c.a === 1 && Math.abs(c.t - e.t) < 5e-4)) fail(l.tag + ': ' + e.type + ' at ' + e.t.toFixed(3) + ' does not drop the music to x1');
    // the creak is fed every frame of play
    if (l.creakPlay < 0.9 * l.frames) fail(l.tag + ': creak() fed on ' + l.creakPlay + ' of ' + l.frames + ' frames of play');
  }
  const d1 = logs[0], d3 = logs[2];
  if (!(d3.creakMax > 0.5)) fail('D3: the creak never rose (max level ' + d3.creakMax + ') before the crash');
  const kinds = d1.calls.filter((c) => c.k === 'fuseTick').map((c) => c.a);
  for (const k of ['half', 'threeq', 'last']) if (!kinds.includes(k)) fail('D1: no fuseTick(' + k + ') (got ' + kinds.join() + ')');
  const ticks = d1.calls.filter((c) => c.k === 'clockTick').map((c) => c.a);
  if (ticks.join() !== '5,4,3,2,1') fail('D1: clock ticks ' + ticks.join() + ' (want 5,4,3,2,1)');
  const startI = d1.calls.findIndex((c) => c.k === 'music.start'), stopI = d1.calls.findIndex((c) => c.k === 'music.stop');
  if (!(startI >= 0 && stopI > startI)) fail('D1: the music does not start with the run and stop at TIME!');
  if (!d1.calls.some((c, i) => c.k === 'music.start' && i > stopI)) fail('D1: AGAIN does not start the music again');
  // the music ducks under every crash and SMASH while it plays (at TIME! it has already stopped)
  const crashes = all.filter((c) => (c.k === 'crash' || c.k === 'smash') && c.ph !== 'over').length, ducks = all.filter((c) => c.k === 'music.duck').length;
  if (ducks < crashes) fail(ducks + ' music.duck() for ' + crashes + ' crashes and smashes');
  for (const k of ['poke', 'uiClick', 'whistle', 'tally', 'newBest', 'haptic', 'music.setLevel', 'music.setMult', 'music.duck', 'unlock']) if (!called(k)) fail('Sfx.' + k + '() is never called');
  const haps = all.filter((c) => c.k === 'haptic').map((c) => JSON.stringify(c.a));
  if (!haps.includes('20') || !haps.includes('[30,40,30]')) fail('haptics: no vibrate(20) on a PERFECT or [30,40,30] on a crash (got ' + [...new Set(haps)].join(' ') + ')');
  for (const k of ['land', 'miss', 'crash', 'goal', 'crown', 'smash', 'level', 'bump', 'honk', 'stomp', 'foot', 'shove', 'over']) if (!seen[k]) fail('the run never reached a ' + k + ' (the wiring check needs one)');
  info.seen = seen;
  info.calls = {};
  for (const c of all) info.calls[c.k] = (info.calls[c.k] || 0) + 1;
  info.creak = logs.map((l) => l.tag + ' ' + l.creakPlay + '/' + l.frames + ' max ' + l.creakMax.toFixed(2)).join(', ');
  return { F, info };
}

(async () => {
  const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
  let A = null, B = null, D = null;
  try {
    // ---- Part A: the game page, its loop halted, its Sfx driven directly
    if (want('A')) {
      const ctx = await browser.newContext();
      await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
      const page = await ctx.newPage();
      watch(page, 'A');
      await page.addInitScript(INSTRUMENT);
      await page.goto(gameUrl({ nohint: 1, seed: 1 }), { waitUntil: 'load' });
      await page.waitForFunction(() => !!window.CS, null, { timeout: 15000 });
      await page.evaluate(() => CS.halt());
      A = await page.evaluate(REALTIME, { SOAK });
      await ctx.close();
    }
    // ---- Part B: the SFX block of index.html, offline
    if (want('B')) {
      const ctx2 = await browser.newContext();
      const page2 = await ctx2.newPage();
      watch(page2, 'B');
      await page2.setContent('<!doctype html><html><body></body></html>');
      B = await page2.evaluate(OFFLINE, { SRC });
      await ctx2.close();
    }
    // ---- Part D: the game calls its sounds at their moments
    if (want('D')) D = await WIRING(browser);
  } finally {
    await browser.close();
  }
  if (A) for (const f of A.F) fail('realtime: ' + f);
  if (B) for (const f of B.F) fail('offline: ' + f);
  if (D) for (const f of D.F) fail('wiring: ' + f);
  for (const e of errors) fail(e);

  if (REPORT) {
    if (B) {
      const S = B.R.sounds;
      console.log('sound'.padEnd(16) + ['peak', 'st50', 'st400', 'onset', 'dur40', 'dur60', 'first', 'tail', 'movDC', 'stopΔ'].map((s) => s.padStart(8)).join(''));
      for (const k in S) { const r = S[k]; console.log(k.padEnd(16) + [r.pk, r.st50, r.st400, r.onMs, r.dur40, r.dur60, r.first, r.tail, r.movDc, r.stopDiff].map((s) => String(s).padStart(8)).join('')); }
      const { sounds, ...rest } = B.R; void sounds;
      console.log('offline', JSON.stringify(rest, null, 1));
    }
    if (A) console.log('realtime', JSON.stringify(A.info, null, 1));
    if (D) console.log('wiring', JSON.stringify(D.info, null, 1));
  }
  if (B) {
    const S = B.R.sounds, pks = Object.values(S).map((r) => r.pk);
    console.log(`offline: ${Object.keys(S).length} sounds, loudest single ${Math.max(...pks)} dBFS, crash+smash ${B.R.crashSmashPk} dBFS, ` +
      `40 clacks/s over x5 music ${B.R.rapidPk} dBFS; tock pitches ${B.R.tock.join('')}; pan law ${JSON.stringify(B.R.panLawDb)} dB; ` +
      `clack over x5 (50 ms, pan 0.15) ${B.R.music.like.overA} dB(A) / ${B.R.music.like.overPhone} dB (phone); aww ${B.R.awwA400} dB(A) vs clack ${B.R.music.like.clackA400}; ` +
      `x1 under a clack ${B.R.music.balance.x1UnderClackA} dB(A); hold fallback ratio ${B.R.holdFallbackMinRatio}; ting by streak 1-6,20 ${B.R.tingClimb.join(' ')} Hz; ` +
      `streak fanfares ${JSON.stringify(B.R.streakFanfare)}`);
  }
  if (A) console.log(`realtime: voices max ${A.info.crashSmashMaxVoices} (flood ${A.info.flood}); grid ${A.info.grid120 && A.info.grid120.offGridMs.toFixed(6)} ms` +
    (A.info.slowThread ? `; slow thread: ${A.info.slowThread.late}/${A.info.slowThread.starts} late starts, flam ${A.info.slowThread.flamMs} ms` : '') +
    (A.info.soak ? `; soak ${A.info.soak.seconds}s/${A.info.soak.events} ticks: ${A.info.soak.created} nodes made, ${A.info.soak.alive - A.info.soak.aliveBefore} extra alive after GC, heap ${A.info.soak.heapDeltaKB >= 0 ? '+' : ''}${A.info.soak.heapDeltaKB} KB` : ''));
  if (D) console.log(`wiring: events heard ${JSON.stringify(D.info.seen)}; creak fed ${D.info.creak}`);
  if (fails.length) { console.log('FAIL (' + fails.length + ')\n  ' + fails.join('\n  ')); process.exit(1); }
  console.log('PASS');
})().catch((e) => { console.error(e); process.exit(1); });
