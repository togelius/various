#!/usr/bin/env node
// Audio test: node clack-stack/dev/audio-test.cjs [--report] [--soak=SECONDS]   (~1 min with the default 20 s soak)
//
// Part A, real time (headless Chromium, --autoplay-policy=no-user-gesture-required), audio.js
// loaded as a plain <script> exactly as the game will:
//   API shape; every call is a safe no-op before unlock(); unlock -> 'running'; crash() + smash() in the
//   same task as the first unlock() (the title BOOM) play fully; every function
//   with typical and junk arguments; 40 clacks in 1 s; crash + smash + tally + clacks together
//   (voices <= 24 at every poll, cap exactly 24 under a flood); music layers follow setMult 1..5;
//   every music note starts on the exact 16th-note grid of 120 + 3*(level-1) BPM (capped 150)
//   despite main-thread jank; mute silences the output (analyser on the destination) and makes
//   calls create no nodes; a creak the game stops feeding (pause) fades out by itself; on a slow (phone-like)
//   main thread no source is ever started at a time the audio clock has already passed (the attack would be
//   skipped) and a sound's parts keep their relative timing; a soak (default 20 s, ~a 10-minute session's worth of events) after
//   which nodes created minus nodes garbage-collected stays small and no voices are left.
// Part B, offline (each render gets a fresh module instance on an OfflineAudioContext; sounds
//   start 0.25 s in, after Chromium's compressor has settled), for every sound:
//   peak <= -1 dBFS after the compressor (and inside the safety clipper's linear zone for single
//   sounds), not silent, duration in the specified range, starts from silence, fades to 0 before
//   the end, no DC; a stop-click test renders each sound twice, once with every source's stop()
//   disabled: identical output proves no source is stopped while still audible. Plus: tock pitch
//   per combo, body vs mass, edge runs, PERFECT ting, zzip sweep, whistle glide, crash panning and
//   clatter count, creak curve + heartbeat, music layers / tempo / duck, and the balance as ears and small
//   speakers hear it (A-weighting and a phone-speaker weighting): the x1 groove audible, x5 >= 8 dB under a clack.
// Part C: audio-preview.html loads at 390 px and 1280 px wide, every button is clicked for real, no errors.
// Fails (exit 1) on any check, pageerror or console.error. AUDIO_SHOTS=dir saves preview screenshots.
'use strict';
const fs = require('fs');
const path = require('path');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }

const AUDIO = path.join(__dirname, 'audio.js');
const SRC = fs.readFileSync(AUDIO, 'utf8');
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
    'newBest', 'uiClick', 'haptic', 'music', 'stats'];
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
    Sfx.fuseTick('last'); Sfx.clockTick(5); Sfx.clockTick(2); Sfx.newBest(); Sfx.uiClick(); Sfx.haptic(8); Sfx.haptic([30, 40, 30]);
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
    if (R.music.underDb < 6) fail('music x5 (' + R.music.x5.st400 + ' dB) not >= 6 dB under a clack (' + cl.st50 + ' dB)');
    // ...and as ears (A-weighting) and phone speakers (HP 350 Hz) hear it, where the kick's sub-bass thump
    // counts for little: x1 (kick + shaker, where every miss and crash resets to) must be clearly audible,
    // x5 must still sit >= 8 dB under a GREAT clack, and the kick must not pump the compressor.
    const x1 = R.music.x1, x5 = R.music.x5;
    R.music.balance = { x1UnderClackA: +(cl.a50 - x1.A400).toFixed(1), x1UnderClackPhone: +(cl.ph50 - x1.Ph400).toFixed(1),
      x5UnderClackA: +(cl.a50 - x5.A400).toFixed(1), x5UnderClackPhone: +(cl.ph50 - x5.Ph400).toFixed(1) };
    const B = R.music.balance;
    if (B.x1UnderClackA > 17 || B.x1UnderClackPhone > 17) fail('music x1 (kick + shaker) too quiet: ' + B.x1UnderClackA + ' dB(A) / ' + B.x1UnderClackPhone + ' dB (phone) under a clack, want <= 17');
    if (B.x5UnderClackA < 8 || B.x5UnderClackPhone < 8) fail('music x5 not >= 8 dB under a clack: ' + B.x5UnderClackA + ' dB(A) / ' + B.x5UnderClackPhone + ' dB (phone)');
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

(async () => {
  const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
  let A = null, B = null;
  try {
    // ---- Part A
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    watch(page, 'A');
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.evaluate(INSTRUMENT);
    await page.addScriptTag({ path: AUDIO });
    A = await page.evaluate(REALTIME, { SOAK });
    await ctx.close();
    // ---- Part B
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    watch(page2, 'B');
    await page2.setContent('<!doctype html><html><body></body></html>');
    B = await page2.evaluate(OFFLINE, { SRC });
    await ctx2.close();
    // ---- Part C: the preview page loads and every control works (real clicks), at phone and desktop width
    for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
      const ctx3 = await browser.newContext({ viewport: vp });
      const page3 = await ctx3.newPage();
      watch(page3, 'C' + vp.width);
      await page3.goto('file://' + path.join(__dirname, 'audio-preview.html'));
      const btns = await page3.$$('button');
      for (const b of btns) { await b.click(); await page3.waitForTimeout(40); }
      await page3.keyboard.press('Space'); await page3.keyboard.press('x');
      await page3.fill('#creak', '0.95'); await page3.dispatchEvent('#creak', 'input'); await page3.waitForTimeout(400);
      await page3.fill('#creak', '0'); await page3.dispatchEvent('#creak', 'input');
      await page3.click('#mStart'); await page3.click('[data-m="5"]'); await page3.waitForTimeout(600); await page3.click('#mStop');
      await page3.waitForTimeout(300);
      const pc = await page3.evaluate(() => ({ stats: document.getElementById('stats').textContent, sw: document.documentElement.scrollWidth, iw: innerWidth }));
      if (!/state running/.test(pc.stats)) fail('preview ' + vp.width + ': audio not running (' + pc.stats + ')');
      if (pc.sw > pc.iw) fail('preview ' + vp.width + ': horizontal scroll (' + pc.sw + ' > ' + pc.iw + ')');
      if (process.env.AUDIO_SHOTS) await page3.screenshot({ path: path.join(process.env.AUDIO_SHOTS, 'audio-preview-' + vp.width + '.png'), fullPage: true });
      await ctx3.close();
    }
  } finally {
    await browser.close();
  }
  for (const f of A.F) fail('realtime: ' + f);
  for (const f of B.F) fail('offline: ' + f);
  for (const e of errors) fail(e);

  const S = B.R.sounds;
  if (REPORT) {
    console.log('sound'.padEnd(16) + ['peak', 'st50', 'st400', 'onset', 'dur40', 'dur60', 'first', 'tail', 'movDC', 'stopΔ'].map((s) => s.padStart(8)).join(''));
    for (const k in S) { const r = S[k]; console.log(k.padEnd(16) + [r.pk, r.st50, r.st400, r.onMs, r.dur40, r.dur60, r.first, r.tail, r.movDc, r.stopDiff].map((s) => String(s).padStart(8)).join('')); }
    console.log('realtime', JSON.stringify(A.info, null, 1));
    const { sounds, ...rest } = B.R; void sounds;
    console.log('offline', JSON.stringify(rest, null, 1));
  }
  const pks = Object.values(S).map((r) => r.pk);
  console.log(`audio-test: ${Object.keys(S).length} sounds rendered offline, loudest single ${Math.max(...pks)} dBFS, crash+smash ${B.R.crashSmashPk} dBFS, ` +
    `40 clacks/s over x5 music ${B.R.rapidPk} dBFS; tock pitches ${B.R.tock.join('')}; music under clack by ${B.R.music.underDb} dB ` +
    `(x1 ${B.R.music.balance.x1UnderClackA} / x5 ${B.R.music.balance.x5UnderClackA} dB(A)); ` +
    `voices max ${A.info.crashSmashMaxVoices} (flood ${A.info.flood}); grid ${A.info.grid120 && A.info.grid120.offGridMs.toFixed(6)} ms` +
    (A.info.slowThread ? `; slow thread: ${A.info.slowThread.late}/${A.info.slowThread.starts} late starts, flam ${A.info.slowThread.flamMs} ms` : '') +
    (A.info.soak ? `; soak ${A.info.soak.seconds}s/${A.info.soak.events} ticks: ${A.info.soak.created} nodes made, ${A.info.soak.alive - A.info.soak.aliveBefore} extra alive after GC, heap ${A.info.soak.heapDeltaKB >= 0 ? '+' : ''}${A.info.soak.heapDeltaKB} KB` : ''));
  if (fails.length) { console.log('FAIL (' + fails.length + ')\n  ' + fails.join('\n  ')); process.exit(1); }
  console.log('PASS');
})().catch((e) => { console.error(e); process.exit(1); });
