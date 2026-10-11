#!/usr/bin/env node
// Verifier probes for dev/audio.js (fast, ~15 s): node clack-stack/dev/audio-verify.cjs
//   1. first gesture: unlock() and crash()/smash() in the same task (the game calls unlock() from its input
//      handler and may start the title shove BOOM in that same handler) -> no console.error, sound plays
//   2. creak watchdog: creak(0.85) fed for 1 s, then the game stops calling it (pause overlay: frame() skips
//      step()) -> the creak must fade out by itself instead of droning forever
//   3. no NaN / Infinity / negative times / exp-ramps to 0 for combo 0..200, mass 0.45..3, pan -1..1, edges 1..3
//   4. voice cap <= 24 under 100 clacks at once + crash + smash
//   5. tab hide/show with the groove running: context suspends, resumes, notes stay on one 16th grid
//   6. slow main thread (phone-like: every node creation costs 0.6 ms): no source may be start()ed at a time the
//      audio clock has already passed. A late start skips the envelope's attack (the source begins mid-decay, a few
//      ms after the snap), which softens / smears the clack and can click on noise sources.
'use strict';
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const path = require('path');
const AUDIO = process.env.AUDIO_JS || path.join(__dirname, 'audio.js');

const INSTR = () => {
  const T = window.__T = { bad: [], starts: [], rec: false, slow: false, slowStarts: 0, late: [] };
  for (const name of ['createGain', 'createOscillator', 'createBufferSource', 'createBiquadFilter', 'createStereoPanner']) {
    const o = BaseAudioContext.prototype[name];
    BaseAudioContext.prototype[name] = function () { if (T.slow) { const t = performance.now(); while (performance.now() - t < 0.6) { /* spin */ } } return o.apply(this, arguments); };
  }
  const fin = (x) => typeof x === 'number' && isFinite(x);
  const bad = (s) => { if (T.bad.length < 50) T.bad.push(s); };
  const AP = AudioParam.prototype;
  const wrap = (m, chk) => { const o = AP[m]; AP[m] = function () { chk.apply(this, arguments); return o.apply(this, arguments); }; };
  wrap('setValueAtTime', (v, t) => { if (!fin(v) || !fin(t) || t < 0) bad('setValueAtTime(' + v + ',' + t + ')'); });
  wrap('linearRampToValueAtTime', (v, t) => { if (!fin(v) || !fin(t) || t < 0) bad('linearRamp(' + v + ',' + t + ')'); });
  wrap('exponentialRampToValueAtTime', (v, t) => { if (!fin(v) || v === 0 || !fin(t) || t < 0) bad('expRamp(' + v + ',' + t + ')'); });
  wrap('setTargetAtTime', (v, t, k) => { if (!fin(v) || !fin(t) || t < 0 || !(k > 0)) bad('setTarget(' + v + ',' + t + ',' + k + ')'); });
  const vd = Object.getOwnPropertyDescriptor(AP, 'value');
  Object.defineProperty(AP, 'value', { get: vd.get, set(v) { if (!fin(v)) bad('value=' + v); vd.set.call(this, v); }, configurable: true });
  for (const P of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype]) {
    const st = P.start;
    P.start = function (w) {
      if (w !== undefined && (!fin(w) || w < 0)) bad('start(' + w + ')');
      if (T.rec) T.starts.push(w || 0);
      if (T.slow && w > 0) { T.slowStarts++; const late = this.context.currentTime - w; if (late > 1e-9) T.late.push((T.cur || '?') + ' ' + (late * 1000).toFixed(1) + ' ms'); }
      return st.apply(this, arguments);
    };
  }
  const conn = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dst) {
    const r = conn.apply(this, arguments);
    if (!T.an && dst instanceof AudioDestinationNode && this instanceof GainNode) {
      const a = this.context.createAnalyser(); a.fftSize = 2048; const z = this.context.createGain(); z.gain.value = 0;
      conn.call(this, a); conn.call(a, z); conn.call(z, dst); T.an = a;
    }
    return r;
  };
};

const RUN = async () => {
  const F = [], info = {}, T = window.__T, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const meter = async (ms) => { const b = new Float32Array(2048); let pk = 0; const t0 = performance.now(); while (performance.now() - t0 < ms) { T.an.getFloatTimeDomainData(b); for (let i = 0; i < b.length; i++) pk = Math.max(pk, Math.abs(b[i])); await sleep(10); } return pk; };
  // 1. first gesture
  Sfx.unlock(); Sfx.crash(30, 0); Sfx.smash();
  info.firstGestureVoices = Sfx.stats().voices;
  info.firstGesturePk = await meter(500);
  if (info.firstGestureVoices < 3) F.push('first gesture: crash()+smash() right after unlock() registered only ' + info.firstGestureVoices + ' voices (crash = crack voice + whistle voice, smash = 1)');
  await sleep(1500);
  // 2. creak watchdog
  for (let i = 0; i < 60; i++) { Sfx.creak(0.85); await sleep(16); }
  info.creakFed = await meter(150);
  await sleep(1000);
  info.creakAfter1sNoCalls = await meter(300);
  if (!(info.creakFed > 0.02)) F.push('creak(0.85) not audible: ' + info.creakFed);
  if (info.creakAfter1sNoCalls > 0.01 * Math.max(info.creakFed, 1e-3)) F.push('creak still sounding 1 s after the last creak() call (peak ' + info.creakAfter1sNoCalls.toFixed(3) + ', fed ' + info.creakFed.toFixed(3) + '): a paused game leaves it droning');
  Sfx.creak(0); await sleep(700); Sfx.creak(0); await sleep(200);
  // 3. parameter sweep
  for (let combo = 0; combo <= 200; combo++) for (const mass of [0.45, 1, 1.5, 3]) for (const pan of [-1, 0, 0.004, 1]) for (const edges of [1, 2, 3]) {
    if (combo > 30 && combo % 9) continue;
    Sfx.clack({ combo, mass, pan, edges, grade: ['perfect', 'great', 'clack'][combo % 3] });
  }
  for (let i = 0; i <= 200; i++) Sfx.tally(i);
  for (const n of [1, 12, 40, 200]) for (const x of [-1, 0, 1]) Sfx.crash(n, x);
  for (let l = 0; l <= 1.2; l += 0.01) Sfx.creak(l);
  Sfx.creak(0);
  for (let l = 1; l <= 40; l++) Sfx.music.setLevel(l);
  if (T.bad.length) F.push('bad AudioParam / start values: ' + T.bad.slice(0, 5).join('; '));
  await sleep(2500);
  // 4. cap
  for (let i = 0; i < 100; i++) Sfx.clack({ combo: i, mass: 3, pan: Math.sin(i), edges: 3, grade: 'perfect' });
  Sfx.crash(40, 0); Sfx.smash();
  info.capVoices = Sfx.stats().voices; info.peakVoices = Sfx.stats().peakVoices;
  if (info.capVoices > 24 || info.peakVoices > 24) F.push('voice cap: ' + info.capVoices + ' live, peak ' + info.peakVoices);
  await sleep(1500);
  // 5. visibility
  const setHidden = (h) => { Object.defineProperty(document, 'hidden', { get: () => h, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); };
  Sfx.music.setLevel(1); Sfx.music.setMult(3); T.starts = []; T.rec = true; Sfx.music.start();
  await sleep(1000); setHidden(true); await sleep(300);
  info.hidden = Sfx.stats().state;
  const nh = T.starts.length; await sleep(800); info.startsWhileHidden = T.starts.length - nh;
  setHidden(false); for (let i = 0; i < 50 && Sfx.stats().state !== 'running'; i++) await sleep(20);
  info.shown = Sfx.stats().state;
  const ns = T.starts.length; await sleep(1000); info.startsAfterShow = T.starts.length - ns;
  T.rec = false; Sfx.music.stop();
  const w0 = Math.min(...T.starts); let off = 0; for (const w of T.starts) { const k = Math.round((w - w0) / 0.125); off = Math.max(off, Math.abs(w - w0 - k * 0.125)); }
  info.offGridMs = off * 1000;
  if (info.hidden !== 'suspended' || info.shown !== 'running' || info.startsWhileHidden || !info.startsAfterShow || off > 1e-6) F.push('visibility: ' + JSON.stringify({ hidden: info.hidden, shown: info.shown, startsWhileHidden: info.startsWhileHidden, startsAfterShow: info.startsAfterShow, offGridMs: info.offGridMs }));
  // 6. slow main thread: no late starts
  await sleep(600);
  T.slow = true;
  for (let i = 0; i < 10; i++) {
    T.cur = 'zzip'; Sfx.zzip(0); await sleep(70);
    T.cur = 'clack'; Sfx.clack({ combo: i, edges: 1 + (i % 3), grade: i % 2 ? 'perfect' : 'great', mass: 1, pan: 0.3 }); await sleep(150);
  }
  T.cur = 'crash'; Sfx.crash(30, 0); await sleep(300); T.cur = 'smash'; Sfx.smash(); await sleep(300);
  T.slow = false; T.cur = null;
  info.slowStarts = T.slowStarts; info.lateStarts = T.late.length;
  if (T.late.length) F.push('slow main thread: ' + T.late.length + ' of ' + T.slowStarts + ' sources start()ed in the past (attack skipped), e.g. ' + T.late.slice(0, 6).join(', '));
  return { F, info };
};

(async () => {
  const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  let R;
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.evaluate(INSTR);
    await page.addScriptTag({ path: AUDIO });
    R = await page.evaluate(RUN);
  } finally { await browser.close(); }
  const fails = R.F.concat(errors);
  console.log('audio-verify', JSON.stringify(R.info));
  if (fails.length) { console.log('FAIL (' + fails.length + ')\n  ' + fails.join('\n  ')); process.exit(1); }
  console.log('PASS');
})().catch((e) => { console.error(e); process.exit(1); });
