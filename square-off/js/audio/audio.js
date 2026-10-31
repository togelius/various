/* SQUARE OFF — procedural audio (DESIGN §9).
 * SQ.audio: context unlock, park ambience bed, SFX synth, positional pan, voice cap,
 * bus wiring. No sample files: every sound is synthesized with WebAudio at runtime.
 * The adaptive music sequencer lives in js/audio/music.js (SQ.audioMusic) and uses the
 * instrument library exposed here as SQ.audio._lib.
 *
 * Coordinates: GEO meters (+x east, +z south, fountain at 0,0).
 * Listener heading: radians, 0 = camera looking north (-z), positive turns toward east (+x).
 */
(function (SQ) {
  'use strict';

  var W = (typeof window !== 'undefined') ? window : null;
  // Playtests must be silent: with ?mute (or ?mute=1), or in any automated browser (Playwright and
  // WebDriver set navigator.webdriver), no AudioContext is ever created, so nothing can make a sound.
  // Keep this. To check that game events trigger sounds in a test, spy on SQ.audio.play instead.
  var SILENT = !!W && (/[?&]mute(=1)?(&|$)/.test((W.location && W.location.search) || '') ||
    !!(W.navigator && W.navigator.webdriver));
  var AC = !SILENT && W && (W.AudioContext || W.webkitAudioContext);

  var CREWS = ['hustle', 'noise', 'violets', 'pack'];
  var MAX_VOICES = 16;          // §9 mixing cap (SFX)
  var MAX_AMB_VOICES = 10;      // ambient one-shots have their own small pool

  var ctx = null, built = false, unlocking = false;
  var masterGain, comp, analyser, sfxBus, musicBus, ambBus, revIn, revOut, convolver;
  var buffers = {}, waves = {}, metal = null;
  var vols = { master: 0.8, sfx: 0.9, music: 0.5, ambience: 0.6 };
  var muted = false, hiddenSuspended = false;
  var L = { x: 0, z: 0, h: 0, height: 70, lastApply: 0 };
  var voices = [], ambVoices = [];
  var cool = {}, nameCount = {};
  var stats = { played: 0, dropped: 0, culled: 0, stolen: 0, peakVoices: 0, errors: 0 };
  var desired = { music: null, musicFaction: null, phase: 'afternoon', intensity: 0.5 };
  var music = null;
  var amb = null;
  var loops = {};
  var schedTimer = null, lastSched = 0;
  var combat = { energy: 0, playerEnergy: 0 };
  var player = null;              // raw faction id of the human player
  var stateProvider = null;
  var game = { held: null, behind: false, nearWin: false };
  var gestureBound = false;

  // ---------------------------------------------------------------- utils
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function chance(p) { return Math.random() < p; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function now() { return ctx ? ctx.currentTime : 0; }

  function G(v, dest) { var g = ctx.createGain(); g.gain.value = v == null ? 1 : v; if (dest) g.connect(dest); return g; }
  function F(type, f, q, dest) {
    var b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f;
    if (q != null) b.Q.value = q;
    if (dest) b.connect(dest);
    return b;
  }
  function O(type, f, t, stop, dest) {
    var o = ctx.createOscillator();
    if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
    o.frequency.setValueAtTime(f, t);
    if (dest) o.connect(dest);
    o.start(t); o.stop(stop);
    return o;
  }
  function N(kind, t, stop, dest, rate) {
    var s = ctx.createBufferSource();
    s.buffer = buffers[kind] || buffers.white; s.loop = true;
    if (rate) s.playbackRate.value = rate;
    if (dest) s.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(stop);
    return s;
  }
  // Percussive envelope on a gain param: silence → peak (attack a) → exp decay over d.
  function perc(g, t, peak, a, d) {
    var p = g.gain || g;
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(Math.max(0.0002, peak), t + a);
    p.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  // Swell envelope: up over a, hold, down over r (all linear, ends at 0).
  function swell(g, t, peak, a, hold, r) {
    var p = g.gain || g;
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(peak, t + a);
    p.setValueAtTime(peak, t + a + hold);
    p.linearRampToValueAtTime(0, t + a + hold + r);
  }
  // Tremolo stage: signal × (1 − depth ± depth·lfo). Connect sources into the returned node.
  function trem(dest, depth, rate, t, stop, type) {
    var g = G(1 - depth, dest), lfo = O(type || 'sine', rate, t, stop, null), lg = G(depth, g.gain);
    lfo.connect(lg);
    return g;
  }
  function makePan(dest) {
    if (ctx.createStereoPanner) { var p = ctx.createStereoPanner(); if (dest) p.connect(dest); return p; }
    var g = G(1, dest); g.pan = { value: 0, setValueAtTime: function () {}, linearRampToValueAtTime: function () {}, setTargetAtTime: function () {} };
    return g;
  }
  function later(fn, ms) { return setTimeout(function () { try { fn(); } catch (e) { stats.errors++; } }, ms); }

  // ------------------------------------------------------- shared resources
  function buildBuffers() {
    var sr = ctx.sampleRate, len = Math.floor(sr * 2.5);
    var white = ctx.createBuffer(1, len, sr), pink = ctx.createBuffer(1, len, sr), brown = ctx.createBuffer(1, len, sr);
    var w = white.getChannelData(0), p = pink.getChannelData(0), b = brown.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (var i = 0; i < len; i++) {
      var x = Math.random() * 2 - 1;
      w[i] = x;
      b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759;
      b2 = 0.96900 * b2 + x * 0.1538520; b3 = 0.86650 * b3 + x * 0.3104856;
      b4 = 0.55000 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.0168980;
      p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11; b6 = x * 0.115926;
      last = (last + 0.02 * x) / 1.02; b[i] = last * 3.5;
    }
    // crossfade loop seam
    var fade = Math.floor(sr * 0.05);
    [w, p, b].forEach(function (d) {
      for (var j = 0; j < fade; j++) { var k = j / fade; d[j] = d[j] * k + d[len - fade + j] * (1 - k); }
    });
    buffers.white = white; buffers.pink = pink; buffers.brown = brown;

    // Reverb impulse: open-air park with building reflections — 2.6 s, darkening tail.
    var rl = Math.floor(sr * 2.6), ir = ctx.createBuffer(2, rl, sr);
    for (var c = 0; c < 2; c++) {
      var d = ir.getChannelData(c), lp = 0;
      for (var n = 0; n < rl; n++) {
        var tt = n / rl, coef = 0.15 + 0.8 * tt;
        lp = lp * coef + (Math.random() * 2 - 1) * (1 - coef);
        var early = (n < sr * 0.09 && Math.random() < 0.004) ? (Math.random() * 2 - 1) * 0.8 : 0; // façade slaps
        d[n] = (lp * 1.6 + early) * Math.pow(1 - tt, 2.4);
      }
    }
    buffers.ir = ir;
  }
  function periodic(amps) {
    var real = new Float32Array(amps.length), imag = new Float32Array(amps.length);
    for (var i = 1; i < amps.length; i++) imag[i] = amps[i];
    return ctx.createPeriodicWave(real, imag);
  }
  function buildWaves() {
    waves.piano = periodic([0, 1, 0.42, 0.26, 0.17, 0.1, 0.07, 0.045, 0.03, 0.02, 0.012]);
    waves.sax = periodic([0, 1, 0.85, 0.62, 0.52, 0.38, 0.3, 0.2, 0.15, 0.1, 0.07, 0.05, 0.035]);
    waves.bass = periodic([0, 1, 0.45, 0.16, 0.08, 0.03]);
    waves.reed = periodic([0, 1, 0.1, 0.55, 0.08, 0.3, 0.05, 0.18, 0.03, 0.1]);
    waves.organ = periodic([0, 1, 0.6, 0.0, 0.3, 0.0, 0.15, 0, 0.08]);
  }
  // Persistent metallic oscillator bank (cymbals, tambourine jingles, bells' shimmer).
  function metalBank() {
    if (metal) return metal;
    metal = F('highpass', 5200, 0.7);
    var fr = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];
    for (var i = 0; i < fr.length; i++) {
      var o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr[i] * 1.73;
      var g = G(0.6); o.connect(g); g.connect(metal); o.start();
    }
    return metal;
  }
  function metalHit(dest, t, peak, decay, hp) {
    var bank = metalBank();
    var g = G(0); var f = F('highpass', hp || 7000, 0.8, g); g.connect(dest);
    bank.connect(f); perc(g, t, peak * 3, 0.002, decay);
    later(function () { try { bank.disconnect(f); } catch (e) { /* already gone */ } }, (t - now() + decay + 0.3) * 1000);
  }

  // ------------------------------------------------------- instrument library
  // All instruments: fn(dest, t, midi, dur, vel) → end time. Shared with music.js.
  var I = {};
  I.piano = function (dest, t, m, dur, vel) {
    vel = vel == null ? 0.7 : vel; dur = Math.max(0.08, dur || 0.5);
    var f = mtof(m), out = G(0, dest);
    var lp = F('lowpass', Math.min(14000, f * (3 + 9 * vel)), 0.6, out);
    lp.frequency.setValueAtTime(Math.min(14000, f * (3 + 9 * vel)), t);
    lp.frequency.setTargetAtTime(Math.max(500, f * 2.2), t + 0.01, 0.35);
    var o1 = O(waves.piano, f, t, t + dur + 1.2, lp); o1.detune.value = -4;
    var o2 = O(waves.piano, f, t, t + dur + 1.2, lp); o2.detune.value = 3.5;
    var tau = clamp(2.4 - (m - 45) * 0.045, 0.35, 2.6);
    var p = out.gain;
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(vel * 0.26, t + 0.004);
    p.setTargetAtTime(vel * 0.11, t + 0.004, 0.08);
    p.setTargetAtTime(0.0001, t + 0.2, tau);
    p.setTargetAtTime(0, t + dur, 0.07);
    if (vel > 0.35) { var hn = G(0, dest), hb = F('bandpass', 2600, 1.2, hn); N('white', t, t + 0.03, hb); perc(hn, t, 0.03 * vel, 0.001, 0.018); }
    return t + dur + 0.5;
  };
  I.epiano = function (dest, t, m, dur, vel) { // mellow tine piano for night trio comping
    vel = vel == null ? 0.6 : vel; dur = Math.max(0.1, dur || 0.6);
    var f = mtof(m), out = G(0, dest);
    var lp = F('lowpass', 2200, 0.5, trem(out, 0.15, 4.6, t, t + dur + 1.5));
    O('sine', f, t, t + dur + 1.5, lp);
    var b = G(0.2 * vel, lp); O('sine', f * 7.02, t, t + 0.3, b); perc(b, t, 0.25 * vel, 0.001, 0.15);
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(vel * 0.3, t + 0.006);
    out.gain.setTargetAtTime(vel * 0.08, t + 0.01, 0.7);
    out.gain.setTargetAtTime(0, t + dur, 0.12);
    return t + dur + 0.6;
  };
  I.sax = function (dest, t, m, dur, vel) {
    vel = vel == null ? 0.7 : vel; dur = Math.max(0.07, dur || 0.4);
    var f = mtof(m), out = G(0, dest);
    var pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1350; pk.gain.value = 5; pk.Q.value = 1.2; pk.connect(out);
    var lp = F('lowpass', f * 2, 1.4, pk);
    lp.frequency.setValueAtTime(f * 2, t);
    lp.frequency.linearRampToValueAtTime(Math.min(5200, f * (4 + 5 * vel)), t + 0.05);
    lp.frequency.setTargetAtTime(Math.min(4200, f * 3 + 700), t + 0.06, 0.18);
    var o = O(waves.sax, f * 0.965, t, t + dur + 0.4, lp);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    var vib = O('sine', rnd(4.8, 5.6), t, t + dur + 0.4, null), vg = G(0, o.frequency);
    vib.connect(vg); vg.gain.setValueAtTime(0, t + 0.12); vg.gain.linearRampToValueAtTime(f * 0.007, t + Math.max(0.2, dur * 0.7));
    var br = G(0, out), bb = F('bandpass', 1900, 0.9, br); N('pink', t, t + dur + 0.3, bb);
    swell(br, t, 0.05 * vel, 0.03, Math.max(0, dur - 0.05), 0.06);
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(vel * 0.2, t + 0.035);
    out.gain.setTargetAtTime(vel * 0.15, t + 0.035, 0.12);
    out.gain.setTargetAtTime(0, t + dur, 0.05);
    return t + dur + 0.3;
  };
  I.trumpet = function (dest, t, m, dur, vel) { // harmon-muted busker trumpet
    vel = vel == null ? 0.7 : vel; dur = Math.max(0.07, dur || 0.4);
    var f = mtof(m), out = G(0, dest);
    var bp = F('bandpass', 1500, 2.2, out);
    var lp = F('lowpass', f * 2, 0.9, bp);
    lp.frequency.setValueAtTime(f * 1.5, t);
    lp.frequency.linearRampToValueAtTime(Math.min(6000, f * 7 * vel + 900), t + 0.04);
    lp.frequency.setTargetAtTime(f * 4 + 400, t + 0.05, 0.15);
    var o = O('sawtooth', f * 0.98, t, t + dur + 0.4, lp);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    var vib = O('sine', 5.5, t, t + dur + 0.4, null), vg = G(0, o.frequency);
    vib.connect(vg); vg.gain.setValueAtTime(0, t + 0.15); vg.gain.linearRampToValueAtTime(f * 0.005, t + Math.max(0.25, dur));
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(vel * 0.42, t + 0.03);
    out.gain.setTargetAtTime(vel * 0.32, t + 0.03, 0.1);
    out.gain.setTargetAtTime(0, t + dur, 0.045);
    return t + dur + 0.3;
  };
  I.vibes = function (dest, t, m, dur, vel) {
    vel = vel == null ? 0.7 : vel; dur = Math.max(0.1, dur || 0.6);
    var f = mtof(m), out = G(0, dest);
    var trem = G(1, out), lfo = O('sine', 5.2, t, t + dur + 2, null), lg = G(0.28, trem.gain); lfo.connect(lg);
    O('sine', f, t, t + dur + 2, trem);
    var h = G(0, trem); O('sine', f * 4.0, t, t + 0.6, h); perc(h, t, 0.28, 0.002, 0.25);
    var h2 = G(0, trem); O('sine', f * 10.1, t, t + 0.2, h2); perc(h2, t, 0.06, 0.001, 0.05);
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(vel * 0.24, t + 0.003);
    out.gain.setTargetAtTime(0.0001, t + 0.005, 0.9);
    out.gain.setTargetAtTime(0, t + dur + 0.25, 0.2);
    return t + dur + 1.2;
  };
  I.whistle = function (dest, t, m, dur, vel) {
    vel = vel == null ? 0.7 : vel; dur = Math.max(0.06, dur || 0.3);
    var f = mtof(m), out = G(0, dest);
    var o = O('sine', f * 0.94, t, t + dur + 0.2, out);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    var vib = O('sine', 5.9, t, t + dur + 0.2, null), vg = G(f * 0.012, o.frequency); vib.connect(vg);
    var br = G(0, out), bb = F('bandpass', f, 6, br); N('white', t, t + dur + 0.2, bb);
    swell(br, t, 0.05 * vel, 0.02, dur * 0.8, 0.05);
    swell(out, t, vel * 0.2, 0.03, Math.max(0, dur - 0.06), 0.06);
    return t + dur + 0.15;
  };
  I.bass = function (dest, t, m, dur, vel) { // upright, plucked
    vel = vel == null ? 0.8 : vel; dur = Math.max(0.08, dur || 0.5);
    var f = mtof(m), out = G(0, dest);
    var lp = F('lowpass', 1200, 1.1, out);
    lp.frequency.setValueAtTime(900 + 900 * vel, t);
    lp.frequency.setTargetAtTime(320 + f, t + 0.005, 0.09);
    O(waves.bass, f, t, t + dur + 0.4, lp);
    var th = G(0, out); O('sine', f * 2, t, t + 0.08, th); perc(th, t, 0.12 * vel, 0.002, 0.05);
    var fn = G(0, out), fb = F('bandpass', 900, 1.5, fn); N('white', t, t + 0.03, fb); perc(fn, t, 0.04 * vel, 0.001, 0.02);
    var p = out.gain;
    p.setValueAtTime(0, t); p.linearRampToValueAtTime(vel * 0.55, t + 0.006);
    p.setTargetAtTime(vel * 0.28, t + 0.006, 0.1);
    p.setTargetAtTime(vel * 0.1, t + 0.25, 0.6);
    p.setTargetAtTime(0, t + dur, 0.045);
    return t + dur + 0.3;
  };
  I.musicBox = function (dest, t, m, dur, vel) {
    vel = vel == null ? 0.7 : vel;
    var f = mtof(m), out = G(0, dest);
    var mo = O('sine', f, t, t + 1.4, out);
    var h = G(0.3, out); O('sine', f * 3.01, t, t + 0.5, h);
    var vib = O('sine', 3.1, t, t + 1.4, null), vg = G(f * 0.004, mo.frequency); vib.connect(vg); // worn speaker warble
    perc(out, t, vel * 0.22, 0.002, 0.9);
    return t + 1.2;
  };
  I.bucketLow = function (dest, t, vel) {
    vel = vel == null ? 0.8 : vel;
    var g = G(0, dest), o = O('sine', 165, t, t + 0.35, g);
    o.frequency.exponentialRampToValueAtTime(64, t + 0.09);
    perc(g, t, 0.75 * vel, 0.002, 0.22);
    var b = G(0, dest), bo = O('triangle', 260, t, t + 0.1, b); bo.frequency.exponentialRampToValueAtTime(120, t + 0.05);
    perc(b, t, 0.18 * vel, 0.001, 0.05);
    var n = G(0, dest), nf = F('lowpass', 700, 0.7, n); N('white', t, t + 0.06, nf); perc(n, t, 0.18 * vel, 0.001, 0.035);
    return t + 0.3;
  };
  I.bucketRim = function (dest, t, vel) {
    vel = vel == null ? 0.8 : vel;
    var n = G(0, dest), nf = F('bandpass', 3100, 1.4, n); N('white', t, t + 0.08, nf); perc(n, t, 0.42 * vel, 0.001, 0.045);
    var b = G(0, dest); O('triangle', 430, t, t + 0.08, b); perc(b, t, 0.2 * vel, 0.001, 0.05);
    var c = G(0, dest), cf = F('bandpass', 1700, 3, c); O('square', 1650, t, t + 0.05, cf); perc(c, t, 0.1 * vel, 0.001, 0.025);
    return t + 0.1;
  };
  I.stick = function (dest, t, vel) {
    vel = vel == null ? 0.5 : vel;
    var n = G(0, dest), nf = F('highpass', 4200, 0.8, n); N('white', t, t + 0.04, nf); perc(n, t, 0.4 * vel, 0.001, 0.016);
    return t + 0.04;
  };
  I.panClang = function (dest, t, vel) {
    vel = vel == null ? 0.6 : vel;
    var g = G(0, dest), bp = F('bandpass', 2500, 1.3, g);
    [587, 893, 1341, 1797].forEach(function (fr) { O('square', fr * rnd(0.99, 1.01), t, t + 0.5, bp); });
    perc(g, t, 0.07 * vel, 0.001, 0.32);
    return t + 0.45;
  };
  I.brush = function (dest, t, vel, len) {
    vel = vel == null ? 0.5 : vel; len = len || 0.22;
    var g = G(0, dest), bp = F('bandpass', 3600, 0.6, g); N('pink', t, t + len + 0.2, bp);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.4 * vel, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025 + len);
    return t + len + 0.1;
  };
  I.kickSoft = function (dest, t, vel) {
    vel = vel == null ? 0.5 : vel;
    var g = G(0, dest), o = O('sine', 96, t, t + 0.3, g); o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
    perc(g, t, 0.5 * vel, 0.003, 0.2);
    return t + 0.25;
  };
  I.ride = function (dest, t, vel) { vel = vel == null ? 0.5 : vel; metalHit(dest, t, 0.11 * vel, 0.75, 6500); I.stick(dest, t, vel * 0.25); return t + 0.8; };
  I.hat = function (dest, t, vel) { vel = vel == null ? 0.5 : vel; metalHit(dest, t, 0.09 * vel, 0.045, 8000); return t + 0.06; };
  I.crash = function (dest, t, vel) {
    vel = vel == null ? 0.6 : vel; metalHit(dest, t, 0.14 * vel, 1.6, 4500);
    var g = G(0, dest), hp = F('highpass', 5000, 0.5, g); N('white', t, t + 1.8, hp); perc(g, t, 0.08 * vel, 0.003, 1.3);
    return t + 1.8;
  };
  I.shaker = function (dest, t, vel) {
    vel = vel == null ? 0.4 : vel;
    var g = G(0, dest), bp = F('bandpass', 7200, 1, g); N('white', t, t + 0.09, bp);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2 * vel, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    return t + 0.09;
  };
  I.tambourine = function (dest, t, vel) { vel = vel == null ? 0.5 : vel; metalHit(dest, t, 0.08 * vel, 0.14, 7500); I.shaker(dest, t, vel * 0.6); return t + 0.2; };
  I.clap = function (dest, t, vel) {
    vel = vel == null ? 0.5 : vel;
    var g = G(0, dest), bp = F('bandpass', 1300, 1.1, g); N('white', t, t + 0.2, bp);
    var p = g.gain; p.setValueAtTime(0, t);
    for (var i = 0; i < 3; i++) { p.setValueAtTime(0.3 * vel, t + i * 0.009); p.setValueAtTime(0.03, t + i * 0.009 + 0.005); }
    p.setValueAtTime(0.25 * vel, t + 0.027); p.exponentialRampToValueAtTime(0.0001, t + 0.13);
    return t + 0.15;
  };
  I.rimshot = function (dest, t, vel) {
    vel = vel == null ? 0.7 : vel;
    var n = G(0, dest), nf = F('bandpass', 1900, 1.1, n); N('white', t, t + 0.12, nf); perc(n, t, 0.45 * vel, 0.001, 0.07);
    var b = G(0, dest); O('triangle', 330, t, t + 0.1, b); perc(b, t, 0.3 * vel, 0.001, 0.06);
    var c = G(0, dest); O('square', 1800, t, t + 0.03, c); perc(c, t, 0.07 * vel, 0.001, 0.012);
    return t + 0.12;
  };
  I.snareGhost = function (dest, t, vel) {
    vel = vel == null ? 0.3 : vel;
    var n = G(0, dest), nf = F('bandpass', 2400, 0.8, n); N('white', t, t + 0.1, nf); perc(n, t, 0.36 * vel, 0.002, 0.06);
    return t + 0.1;
  };
  I.woodblock = function (dest, t, f, vel) {
    vel = vel == null ? 0.6 : vel; f = f || 950;
    var g = G(0, dest), o = O('sine', f * 1.08, t, t + 0.12, g); o.frequency.exponentialRampToValueAtTime(f, t + 0.01);
    perc(g, t, 0.4 * vel, 0.001, 0.06);
    var h = G(0, dest); O('triangle', f * 2.71, t, t + 0.05, h); perc(h, t, 0.1 * vel, 0.001, 0.02);
    var n = G(0, dest), nf = F('bandpass', f * 2, 2, n); N('white', t, t + 0.03, nf); perc(n, t, 0.14 * vel, 0.001, 0.012);
    return t + 0.12;
  };
  I.clockTick = function (dest, t, vel) {
    vel = vel == null ? 0.6 : vel;
    var c = G(0, dest), cf = F('bandpass', 3400, 4, c); O('square', 3300, t, t + 0.02, cf); perc(c, t, 0.25 * vel, 0.0005, 0.01);
    var n = G(0, dest), nf = F('bandpass', 4200, 2, n); N('white', t, t + 0.03, nf); perc(n, t, 0.2 * vel, 0.0005, 0.012);
    return t + 0.04;
  };
  I.slap = function (dest, t, vel, low) { // wooden chess piece / clock button slapped down
    vel = vel == null ? 0.7 : vel;
    var n = G(0, dest), nf = F('bandpass', low ? 650 : 1150, 3.5, n); N('white', t, t + 0.09, nf); perc(n, t, 0.6 * vel, 0.0008, 0.05);
    var g = G(0, dest), o = O('sine', low ? 360 : 760, t, t + 0.1, g); o.frequency.exponentialRampToValueAtTime(low ? 220 : 520, t + 0.04);
    perc(g, t, 0.35 * vel, 0.001, 0.05);
    var c = G(0, dest), cf = F('highpass', 3000, 0.7, c); N('white', t, t + 0.02, cf); perc(c, t, 0.15 * vel, 0.0005, 0.008);
    return t + 0.12;
  };
  // Inharmonic bell. parts: [[ratio, amp, decay], ...]
  I.bell = function (dest, t, f, vel, len, parts) {
    vel = vel == null ? 0.6 : vel; len = len || 2;
    parts = parts || [[0.5, 0.35, 1.2], [1, 1, 1], [1.19, 0.45, 0.7], [1.5, 0.35, 0.6], [2, 0.5, 0.5], [2.74, 0.3, 0.3], [4.07, 0.18, 0.2]];
    for (var i = 0; i < parts.length; i++) {
      var g = G(0, dest);
      O('sine', f * parts[i][0], t, t + len * parts[i][2] + 0.1, g);
      perc(g, t, vel * 0.16 * parts[i][1], 0.002, len * parts[i][2]);
    }
    return t + len + 0.1;
  };
  I.ping = function (dest, t, f, vel) { // phone notification
    vel = vel == null ? 0.6 : vel;
    var g = G(0, dest); O('sine', f, t, t + 0.35, g); perc(g, t, 0.3 * vel, 0.002, 0.22);
    var h = G(0, dest); O('sine', f * 2.005, t, t + 0.2, h); perc(h, t, 0.08 * vel, 0.002, 0.1);
    var k = G(0, dest); O('triangle', f * 3, t, t + 0.05, k); perc(k, t, 0.04 * vel, 0.001, 0.02);
    return t + 0.35;
  };
  I.bark = function (dest, t, size, vel) { // size 0 = yappy small dog, 1 = big woof
    vel = vel == null ? 0.7 : vel; size = clamp(size == null ? 0.5 : size, 0, 1);
    var f0 = lerp(640, 230, size) * rnd(0.9, 1.12), dur = lerp(0.085, 0.19, size) * rnd(0.9, 1.15);
    var env = G(0, dest), mix = G(1, env);
    var o = O('sawtooth', f0 * 0.75, t, t + dur + 0.05, null);
    o.frequency.linearRampToValueAtTime(f0 * 1.25, t + dur * 0.3);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.62, t + dur);
    var f1 = F('bandpass', lerp(1400, 650, size), 3.5, mix), f2 = F('bandpass', lerp(2900, 1700, size), 5, null), f2g = G(0.55, mix);
    f2.connect(f2g); o.connect(f1); o.connect(f2);
    var nz = G(0.5, mix), nf = F('bandpass', lerp(2600, 1300, size), 1.2, nz); N('white', t, t + dur + 0.05, nf);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.55 * vel, t + 0.01);
    env.gain.setTargetAtTime(0.35 * vel, t + 0.012, dur * 0.4);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.03);
    return t + dur + 0.05;
  };
  // Animal-Crossing-style voice syllables per crew.
  var VOWELS = [[730, 1090], [270, 2290], [300, 870], [530, 1840], [660, 1720], [490, 1350], [400, 2000]];
  var VOICE = {
    hustle: { base: 120, spread: 4, syl: 0.105, wave: 'sawtooth', glide: -0.05, gain: 1 },
    noise: { base: 190, spread: 7, syl: 0.085, wave: 'square', glide: 0.04, gain: 0.4 },
    violets: { base: 270, spread: 6, syl: 0.068, wave: 'sawtooth', glide: 0.08, gain: 0.6 },
    pack: { base: 215, spread: 5, syl: 0.08, wave: 'sawtooth', glide: 0.12, gain: 0.65 },
    neutral: { base: 170, spread: 5, syl: 0.09, wave: 'sawtooth', glide: 0 }
  };
  I.voice = function (dest, t, crew, n, vel, pitch) {
    var P = VOICE[crew] || VOICE.neutral; vel = vel == null ? 0.6 : vel; n = n || 3;
    var base = P.base * (pitch || 1);
    vel *= P.gain || 1;
    for (var i = 0; i < n; i++) {
      var st = t + i * P.syl * rnd(0.85, 1.15), len = P.syl * 0.82;
      var f = base * Math.pow(2, Math.round(rnd(-P.spread, P.spread)) / 12) * (i === n - 1 ? 0.92 : 1);
      var env = G(0, dest), v = pick(VOWELS);
      var o = O(P.wave, f, st, st + len + 0.03, null);
      o.frequency.linearRampToValueAtTime(f * (1 + P.glide), st + len);
      var a = F('bandpass', v[0], 5, env), b = F('bandpass', v[1], 7, null), bg = G(0.6, env); b.connect(bg);
      var lp = F('lowpass', 3200, 0.5); lp.connect(a); lp.connect(b); o.connect(lp);
      env.gain.setValueAtTime(0, st);
      env.gain.linearRampToValueAtTime(0.5 * vel, st + 0.012);
      env.gain.setValueAtTime(0.42 * vel, st + len * 0.7);
      env.gain.linearRampToValueAtTime(0, st + len);
    }
    return t + n * P.syl + 0.05;
  };
  I.whoosh = function (dest, t, dur, vel, up) {
    vel = vel == null ? 0.5 : vel; dur = dur || 0.5;
    var g = G(0, dest), bp = F('bandpass', up ? 400 : 2400, 1.4, g); N('pink', t, t + dur + 0.1, bp);
    bp.frequency.exponentialRampToValueAtTime(up ? 2600 : 380, t + dur);
    swell(g, t, 0.35 * vel, dur * 0.6, 0, dur * 0.4);
    return t + dur + 0.1;
  };
  I.thump = function (dest, t, vel, f) {
    vel = vel == null ? 0.7 : vel; f = f || 110;
    var g = G(0, dest), o = O('sine', f, t, t + 0.5, g); o.frequency.exponentialRampToValueAtTime(f * 0.4, t + 0.2);
    perc(g, t, 0.8 * vel, 0.003, 0.35);
    var n = G(0, dest), nf = F('lowpass', 500, 0.7, n); N('brown', t, t + 0.3, nf); perc(n, t, 0.5 * vel, 0.003, 0.2);
    return t + 0.5;
  };

  // ------------------------------------------------------------- positional
  function spatial(x, z, minGain) {
    if (x == null || z == null || isNaN(x) || isNaN(z)) return { pan: 0, gain: 1, lp: 20000, wet: 0.12, d: 0 };
    var dx = x - L.x, dz = z - L.z;
    var ch = Math.cos(L.h), sh = Math.sin(L.h);
    var right = dx * ch + dz * sh;              // +: screen right
    var d = Math.sqrt(dx * dx + dz * dz);
    var ref = 22 + L.height * 0.75;             // zoomed out: hear a wider area
    var gain = 1 / (1 + Math.pow(Math.max(0, d - ref * 0.25) / ref, 1.6));
    if (minGain) gain = Math.max(minGain, gain);
    var pan = d < 1 ? 0 : clamp((right / d) * 0.85 * Math.min(1, d / 10), -0.9, 0.9);
    var lp = clamp(20000 / (1 + d / 70), 1500, 20000);
    return { pan: pan, gain: gain, lp: lp, wet: clamp(0.1 + d / 400, 0.1, 0.5), d: d };
  }

  function makeVoice(bus, sp, vol) {
    var g = G(sp.gain * vol);
    var pan = makePan(bus); pan.pan.value = sp.pan;
    var input = g;
    if (sp.lp < 19000) { var lp = F('lowpass', sp.lp, 0.5, g); input = lp; }
    g.connect(pan);
    var ws = G(sp.wet, revIn); pan.connect(ws);
    return { input: input, gain: g, pan: pan, send: ws, nodes: [g, pan, ws, input] };
  }

  var PRIO_DEFAULT = 2;
  function prune(list, t) { for (var i = list.length - 1; i >= 0; i--) if (list[i].end < t) list.splice(i, 1); }

  // ------------------------------------------------------------- SFX table
  // Each: { fn(input, t, opts) → duration, prio (1 low..5 high), cd (min s between), max (concurrent), bus }
  var SFX = {};
  function def(name, prio, cd, max, fn, bus) { SFX[name] = { fn: fn, prio: prio, cd: cd, max: max, bus: bus || 'sfx' }; }
  function crewOf(o) { return fac(o && o.faction) || 'neutral'; }

  // UI
  def('click', 3, 0.03, 3, function (d, t) { I.woodblock(d, t, rnd(1350, 1450), 0.35); return 0.12; });
  def('select', 3, 0.04, 3, function (d, t, o) { I.woodblock(d, t, (o && o.pitch ? o.pitch : 1) * rnd(900, 960), 0.6); return 0.12; });
  def('send', 3, 0.06, 3, function (d, t) { // skate pop
    var g = G(0, d), o = O('sine', 150, t, t + 0.15, g); o.frequency.exponentialRampToValueAtTime(55, t + 0.08); perc(g, t, 0.5, 0.002, 0.08);
    var n = G(0, d), nf = F('bandpass', 1600, 1.6, n); N('white', t, t + 0.06, nf); perc(n, t, 0.45, 0.001, 0.03);
    I.woodblock(d, t + 0.06, 520, 0.4);
    var r = G(0, d), rf = F('bandpass', 700, 0.8, r); N('pink', t + 0.08, t + 0.35, rf); swell(r, t + 0.08, 0.06, 0.03, 0.1, 0.1);
    return 0.4;
  });
  def('recruit', 3, 0.25, 2, function (d, t) { // "fwee-fwit" whistle
    I.whistle(d, t, 86, 0.12, 0.6); I.whistle(d, t + 0.16, 91, 0.1, 0.65); return 0.35;
  });
  def('coin', 2, 0.25, 2, function (d, t) {
    [2093, 3136].forEach(function (f, i) { var g = G(0, d); O('triangle', f, t + i * 0.05, t + i * 0.05 + 0.3, g); perc(g, t + i * 0.05, 0.18, 0.001, 0.18); });
    return 0.35;
  });
  def('underAttack', 4, 0.6, 1, function (d, t) { // car-horn double tap
    for (var k = 0; k < 2; k++) {
      var st = t + k * 0.2, g = G(0, d), lp = F('lowpass', 2200, 0.8, g);
      O('sawtooth', 415, st, st + 0.15, lp); O('sawtooth', 523, st, st + 0.15, lp);
      g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.14, st + 0.01); g.gain.setValueAtTime(0.14, st + 0.11); g.gain.linearRampToValueAtTime(0, st + 0.13);
    }
    return 0.4;
  });
  def('gained', 4, 0.3, 1, function (d, t) { [72, 76, 79, 84].forEach(function (m, i) { I.vibes(d, t + i * 0.07, m, 0.5, 0.6); }); return 1.4; });
  def('lost', 4, 0.5, 1, function (d, t) { I.vibes(d, t, 74, 0.4, 0.6); I.vibes(d, t + 0.18, 68, 0.9, 0.55); I.bucketLow(d, t + 0.18, 0.4); return 1.6; });
  def('deny', 3, 0.15, 1, function (d, t) {
    [0, 0.11].forEach(function (k) { var g = G(0, d), lp = F('lowpass', 900, 0.7, g); O('triangle', 196, t + k, t + k + 0.12, lp); perc(g, t + k, 0.3, 0.003, 0.08); });
    return 0.3;
  });
  def('build', 3, 0.3, 2, function (d, t) {
    for (var k = 0; k < 3; k++) { var st = t + k * 0.13; I.slap(d, st, 0.7 - k * 0.1, true); I.thump(d, st, 0.25, 140); }
    I.vibes(d, t + 0.45, 79, 0.3, 0.45); I.vibes(d, t + 0.52, 84, 0.5, 0.45);
    return 1.2;
  });
  def('hint', 3, 0.8, 1, function (d, t) { I.vibes(d, t, 81, 0.25, 0.4); I.vibes(d, t + 0.12, 76, 0.5, 0.35); return 1.2; });
  def('toast', 2, 0.4, 1, function (d, t) { I.vibes(d, t, 84, 0.2, 0.3); return 0.8; });
  def('open', 2, 0.05, 2, function (d, t) { I.woodblock(d, t, 1150, 0.3); I.woodblock(d, t + 0.05, 1500, 0.25); return 0.15; });
  def('close', 2, 0.05, 2, function (d, t) { I.woodblock(d, t, 1500, 0.25); I.woodblock(d, t + 0.05, 1150, 0.3); return 0.15; });
  def('pause', 3, 0.2, 1, function (d, t) { I.vibes(d, t, 72, 0.2, 0.35); I.vibes(d, t + 0.08, 67, 0.4, 0.3); return 0.9; });
  def('tick', 3, 0.15, 1, function (d, t) { I.clockTick(d, t, 1.5); return 0.05; });
  def('eventWarn', 4, 1.5, 1, function (d, t) { // park PA chime (original rising figure)
    I.vibes(d, t, 72, 0.25, 0.5); I.vibes(d, t + 0.22, 77, 0.25, 0.5); I.vibes(d, t + 0.44, 81, 0.8, 0.55);
    I.bell(d, t + 0.44, mtof(69), 0.2, 1.6);
    return 2;
  });
  def('phase', 4, 2, 1, function (d, t, o) {
    var ph = normPhase(o && o.phase);
    if (ph === 'night') { I.bell(d, t, mtof(50), 0.5, 3.5); [62, 65, 69, 72].forEach(function (m, i) { I.vibes(d, t + 0.3 + i * 0.18, m, 0.7, 0.35); }); }
    else if (ph === 'golden') { [65, 69, 72, 76, 79].forEach(function (m, i) { I.vibes(d, t + i * 0.12, m, 0.8, 0.4); }); I.crash(d, t + 0.6, 0.15); }
    else { [72, 74, 79, 81].forEach(function (m, i) { I.vibes(d, t + i * 0.09, m, 0.4, 0.4); }); }
    return 3.5;
  });
  def('blip', 2, 0.06, 3, function (d, t, o) { return I.voice(d, t, crewOf(o), (o && o.n) || 3 + ((Math.random() * 3) | 0), 0.55) - t; });
  def('ack', 3, 0.15, 2, function (d, t, o) { return I.voice(d, t, crewOf(o), 2, 0.55, 1.05) - t; });

  // Combat
  // Per crew/class trim so every hit sits at roughly the same loudness (measured, see dev/audio.html).
  var HIT_GAIN = {
    hustle: { crowd: 1.1, talker: 2, heavy: 0.8 }, noise: { crowd: 1.6, talker: 1.6, heavy: 0.35 },
    violets: { crowd: 3.2, talker: 2.8, heavy: 0.5 }, pack: { crowd: 1.2, talker: 0.75, heavy: 1.3 }
  };
  def('hit', 1, 0.045, 6, function (d, t, o) {
    var crew = crewOf(o), cls = normCls(o && o.cls), v = 0.45 * ((o && o.counter) ? 1.15 : 1);
    v *= (HIT_GAIN[crew] && HIT_GAIN[crew][cls]) || 1;
    if (crew === 'hustle') {
      if (cls === 'talker') { I.clockTick(d, t, v); I.slap(d, t + 0.03, v * 0.6); }
      else if (cls === 'heavy') { I.slap(d, t, v, true); I.thump(d, t, v * 0.25, 120); }
      else I.slap(d, t, v * 1.1);
    } else if (crew === 'noise') {
      if (cls === 'talker') I.sax(d, t, pick([58, 60, 63, 65, 67, 70]), 0.09, v * 0.7);
      else if (cls === 'heavy') { I.bucketLow(d, t, v); I.bucketRim(d, t + 0.05, v * 0.5); }
      else I.tambourine(d, t, v * 1.6);
    } else if (crew === 'violets') {
      if (cls === 'talker') I.voice(d, t, 'violets', 2, v * 0.6);
      else if (cls === 'heavy') { I.thump(d, t, v * 0.5, 90); I.voice(d, t, 'violets', 1, v * 0.4, 0.55); }
      else I.ping(d, t, pick([1568, 1760, 2093]), v * 0.22);
    } else if (crew === 'pack') {
      if (cls === 'heavy') I.bark(d, t, 0.9, v * 1.3);
      else if (cls === 'talker') { var g = G(0, d), oo = O('sine', 300, t, t + 0.1, g); oo.frequency.exponentialRampToValueAtTime(90, t + 0.06); perc(g, t, v * 0.6, 0.001, 0.06); I.whoosh(d, t, 0.18, v * 0.4, true); }
      else I.bark(d, t, 0.1, v * 1.4);
    } else { I.slap(d, t, v * 0.5); }
    return 0.3;
  });
  def('crit', 2, 0.12, 2, function (d, t) {
    var g = G(0, d), o = O('triangle', 1200, t, t + 0.12, g); o.frequency.exponentialRampToValueAtTime(2100, t + 0.05); perc(g, t, 0.18, 0.001, 0.08);
    var n = G(0, d), nf = F('highpass', 3000, 0.7, n); N('white', t, t + 0.04, nf); perc(n, t, 0.12, 0.001, 0.02);
    return 0.15;
  });
  def('overIt', 2, 0.1, 3, function (d, t, o) { // shrug-sigh "pfff" + slide-whistle exit
    var n = G(0, d), bp = F('bandpass', 1000, 2, n); N('pink', t, t + 0.5, bp);
    bp.frequency.exponentialRampToValueAtTime(420, t + 0.4); swell(n, t, 0.25, 0.04, 0.12, 0.25);
    var g = G(0, d), sw = O('triangle', 760, t + 0.08, t + 0.55, g); sw.frequency.exponentialRampToValueAtTime(300, t + 0.5);
    swell(g, t + 0.08, 0.09, 0.03, 0.25, 0.15);
    if (chance(0.5)) I.voice(d, t + 0.45, crewOf(o), 2, 0.35, 0.85);
    return 0.8;
  });
  def('contested', 3, 1.0, 1, function (d, t) { I.clockTick(d, t, 0.6); I.woodblock(d, t + 0.09, 1250, 0.4); I.woodblock(d, t + 0.18, 1250, 0.4); return 0.3; });
  def('ooh', 2, 2, 1, function (d, t, o) { // crowd "ooooh"
    var vol = (o && o.volume) || 1;
    for (var i = 0; i < 7; i++) {
      var f = rnd(150, 320), env = G(0, d), a = F('bandpass', 330, 5, env), b = F('bandpass', 850, 6, null), bg = G(0.5, env); b.connect(bg);
      var oo = O('sawtooth', f, t, t + 1.6, null); oo.connect(a); oo.connect(b);
      oo.frequency.linearRampToValueAtTime(f * 1.06, t + 0.4); oo.frequency.linearRampToValueAtTime(f * 0.9, t + 1.4);
      swell(env, t + rnd(0, 0.15), 0.12 * vol, 0.35, 0.3, 0.7);
    }
    return 1.7;
  });
  def('cheer', 3, 1.2, 1, function (d, t, o) { return cheer(d, t, (o && o.volume) || 1, (o && o.len) || 2.2); });

  function cheer(d, t, vol, len) {
    var g = G(0, d), b1 = F('bandpass', 900, 0.8, g), b2 = F('bandpass', 2200, 1.2, g); vol *= 2.2;
    N('pink', t, t + len + 0.3, b1); N('pink', t, t + len + 0.3, b2);
    swell(g, t, 0.22 * vol, 0.25, len * 0.5, len * 0.45);
    for (var i = 0; i < 9; i++) { // "woo!" voices
      var st = t + rnd(0, len * 0.6), f = rnd(260, 520), e = G(0, d), bp = F('bandpass', rnd(700, 1100), 3, e);
      var oo = O('sawtooth', f, st, st + 0.6, bp); oo.frequency.linearRampToValueAtTime(f * 1.5, st + 0.35);
      swell(e, st, 0.05 * vol, 0.08, 0.2, 0.25);
    }
    for (var k = 0; k < 26; k++) I.clap(d, t + rnd(0.05, len), rnd(0.15, 0.35) * vol);
    return len + 0.3;
  }

  // Capture stingers (≈ two bars of a 96 BPM groove)
  var BEAT = 60 / 96;
  var STING = {
    hustle: function (d, t) {
      I.slap(d, t, 1.4); I.clockTick(d, t + 0.02, 1.2); I.rimshot(d, t + BEAT * 0.5, 1.1);
      I.slap(d, t + BEAT * 1.5, 1.1); I.rimshot(d, t + BEAT * 2, 1.2);
      [65, 69, 72, 77].forEach(function (m, i) { I.piano(d, t + BEAT * 2 + i * 0.03, m, BEAT * 1.6, 0.9); });
      I.bell(d, t + BEAT * 2, 1760, 0.25, 1.2, [[1, 1, 1], [2.7, 0.4, 0.4], [5.1, 0.2, 0.2]]);
      return BEAT * 4;
    },
    noise: function (d, t) {
      var lick = [[0, 65, 0.5], [0.5, 68, 0.25], [0.75, 70, 0.5], [1.5, 72, 0.25], [1.75, 70, 0.25], [2, 77, 1.4]];
      lick.forEach(function (n) { I.sax(d, t + n[0] * BEAT, n[1], n[2] * BEAT, 0.8); });
      I.bucketLow(d, t, 0.8); I.bucketRim(d, t + BEAT, 0.7); I.bucketLow(d, t + BEAT * 1.5, 0.6); I.bucketLow(d, t + BEAT * 2, 0.9); I.panClang(d, t + BEAT * 2, 0.8);
      return BEAT * 4;
    },
    violets: function (d, t) {
      cheer(d, t, 0.8, 1.8);
      [1319, 1760, 2093].forEach(function (f, i) { I.ping(d, t + 0.05 + i * 0.09, f, 0.6); });
      I.voice(d, t + 0.4, 'violets', 4, 0.5);
      return 2.2;
    },
    pack: function (d, t) {
      I.bark(d, t, 0.5, 1.2); I.bark(d, t + 0.2, 0.55, 1.2); I.bark(d, t + 0.4, 0.45, 1.3);
      I.whistle(d, t + 0.75, 84, 0.12, 0.9); I.whistle(d, t + 0.9, 88, 0.12, 0.9); I.whistle(d, t + 1.05, 91, 0.35, 1.0);
      return 1.6;
    },
    neutral: function (d, t) { I.vibes(d, t, 72, 0.4, 0.5); I.vibes(d, t + 0.15, 79, 0.6, 0.5); return 1.2; }
  };
  def('capture', 4, 0.6, 2, function (d, t, o) { return (STING[crewOf(o)] || STING.neutral)(d, t); });

  // Crew Call stingers
  var CREWCALL = {
    hustle: function (d, t) { // TOURNAMENT: giant clock slams down, ding
      I.whoosh(d, t, 0.45, 0.6, false);
      I.thump(d, t + 0.45, 1, 80); I.slap(d, t + 0.45, 1, true); I.slap(d, t + 0.46, 0.8);
      I.bell(d, t + 0.5, 1975, 0.7, 2.2, [[1, 1, 1], [2.72, 0.45, 0.45], [5.1, 0.25, 0.25], [8.9, 0.1, 0.1]]);
      for (var k = 0; k < 6; k++) I.clockTick(d, t + 1.0 + k * 0.5, 0.55);
      [53, 60, 65, 69].forEach(function (m) { I.piano(d, t + 0.5, m, 1.2, 0.55); });
      return 4;
    },
    noise: function (d, t) { // DRUM CIRCLE: 12/8 groove from many drummers fading in around you
      var b = 60 / 104 / 3; // triplet eighth
      for (var bar = 0; bar < 3; bar++) {
        var cres = 0.5 + bar * 0.2;
        for (var s = 0; s < 12; s++) {
          var st = t + (bar * 12 + s) * b;
          if (s === 0 || s === 7) I.bucketLow(d, st, cres);
          if (s === 3 || s === 9) I.bucketRim(d, st, cres * 0.8);
          if (s % 2 === 0 && s !== 0) I.stick(d, st, cres * 0.5);
          if ((s === 4 || s === 10) && bar > 0) I.bucketLow(d, st, cres * 0.6);
          if (bar > 1 && (s === 2 || s === 5 || s === 8 || s === 11)) I.shaker(d, st, cres * 0.8);
          if (bar === 2 && s >= 6) I.bucketRim(d, st, 0.5 + s * 0.04);
        }
      }
      I.panClang(d, t + 36 * b, 0.9); I.bucketLow(d, t + 36 * b, 1);
      I.voice(d, t + 0.2, 'noise', 3, 0.6);
      return 36 * b + 0.5;
    },
    violets: function (d, t) { // GROUP CHAT: ping cascade
      I.whoosh(d, t, 0.3, 0.45, true);
      var notes = [1319, 1568, 1760, 2093, 2349, 2637], tt = t + 0.25, gap = 0.16;
      for (var k = 0; k < 16; k++) {
        I.ping(d, tt, pick(notes) * (chance(0.3) ? 0.5 : 1), 0.55 - k * 0.012);
        tt += gap; gap = Math.max(0.04, gap * 0.86);
      }
      I.voice(d, tt, 'violets', 5, 0.45);
      I.voice(d, tt + 0.15, 'violets', 4, 0.35, 1.2);
      return tt - t + 0.6;
    },
    pack: function (d, t) { // ZOOMIES
      I.whoosh(d, t, 0.6, 0.6, true);
      for (var k = 0; k < 10; k++) I.bark(d, t + 0.15 + k * rnd(0.07, 0.12), rnd(0.05, 0.7), 1.0);
      for (var p = 0; p < 30; p++) I.stick(d, t + 0.1 + p * 0.045, rnd(0.5, 0.9)); // paws on pavement
      I.whoosh(d, t + 0.8, 0.5, 0.5, false);
      return 2;
    },
    neutral: function (d, t) { I.whoosh(d, t, 0.5, 0.5, true); I.crash(d, t + 0.5, 0.6); return 2.2; }
  };
  var CC_GAIN = { hustle: 0.75, noise: 0.8, violets: 1.8, pack: 1.8, neutral: 1 };
  def('crewCall', 5, 0.5, 2, function (d, t, o) {
    var c = crewOf(o), g = G(CC_GAIN[c] || 1, d);
    return (CREWCALL[c] || CREWCALL.neutral)(g, t);
  });

  // Faction motifs addressable by name
  def('piece', 2, 0.04, 4, function (d, t) { I.slap(d, t, 0.7); return 0.12; });
  def('clockTick', 2, 0.04, 4, function (d, t) { I.clockTick(d, t, 0.7); return 0.05; });
  def('saxLick', 3, 0.5, 1, function (d, t) { [70, 72, 75, 77, 75, 72].forEach(function (m, i) { I.sax(d, t + i * 0.13, m, 0.12, 0.7); }); return 1; });
  def('bucket', 2, 0.04, 4, function (d, t) { I.bucketLow(d, t, 0.8); return 0.3; });
  def('ping', 2, 0.05, 4, function (d, t) { I.ping(d, t, pick([1568, 1760, 2093]), 0.6); return 0.4; });
  def('chatter', 2, 0.3, 2, function (d, t) { I.voice(d, t, 'violets', 4, 0.5); I.voice(d, t + 0.1, 'violets', 3, 0.35, 1.25); return 0.6; });
  def('bark', 2, 0.08, 3, function (d, t, o) { return I.bark(d, t, (o && o.size != null) ? o.size : rnd(0.2, 0.8), 0.8) - t; });

  // Events & neutrals
  def('pigeons', 2, 0.6, 2, function (d, t) { // flock takes off
    for (var k = 0; k < 7; k++) {
      var st = t + rnd(0, 0.5), g = G(0, d), bp = F('bandpass', rnd(900, 1500), 1.3, trem(g, 0.5, rnd(13, 18), st, st + 0.8, 'square')); N('pink', st, st + 0.8, bp);
      swell(g, st, 0.18, 0.03, 0.2, 0.45);
    }
    return 1.2;
  });
  def('coo', 1, 0.5, 2, function (d, t) { return coo(d, t, 1); }, 'amb');
  def('squirrels', 2, 0.4, 2, function (d, t) { // chitter
    for (var k = 0; k < 14; k++) {
      var st = t + k * 0.045 + (k > 7 ? 0.15 : 0), g = G(0, d), o = O('square', rnd(3200, 4600), st, st + 0.03, null), bp = F('bandpass', 4000, 3, g);
      o.connect(bp); o.frequency.exponentialRampToValueAtTime(2400, st + 0.025); perc(g, st, 0.25, 0.001, 0.02);
    }
    return 0.9;
  });
  def('shoo', 3, 0.15, 2, function (d, t) { I.voice(d, t, 'neutral', 1, 0.6, 1.3); I.whoosh(d, t + 0.05, 0.25, 0.4, true); return 0.4; });
  def('pepWhistle', 3, 1, 1, function (d, t) { // pea whistle, two blasts
    [0, 0.45].forEach(function (k, i) {
      var st = t + k, len = i ? 0.55 : 0.25, g = G(0, d), o = O('sine', 2900, st, st + len + 0.05, g);
      var fm = O('square', 32, st, st + len, null), fg = G(160, o.frequency); fm.connect(fg);
      swell(g, st, 0.12, 0.01, len - 0.03, 0.03);
    });
    return 1.1;
  });
  def('bus', 3, 2, 1, function (d, t) { // air brakes, idle, horn
    var h = G(0, d), hp = F('highpass', 2500, 0.6, h); N('white', t, t + 1.2, hp); perc(h, t, 0.3, 0.005, 0.9);
    var e = G(0, d), lp = F('lowpass', 180, 1, e); O('sawtooth', 42, t, t + 2.5, lp); O('sawtooth', 42.7, t, t + 2.5, lp); swell(e, t, 0.25, 0.3, 1.5, 0.6);
    var hg = G(0, d), hl = F('lowpass', 1400, 0.7, hg); O('sawtooth', 233, t + 1.1, t + 1.6, hl); O('sawtooth', 294, t + 1.1, t + 1.6, hl);
    swell(hg, t + 1.1, 0.12, 0.02, 0.35, 0.05);
    return 2.6;
  });
  def('thunder', 2, 6, 1, function (d, t) {
    var g = G(0, d), lp = F('lowpass', 160, 0.7, trem(g, 0.35, 3.3, t, t + 4.5)); N('brown', t, t + 4.5, lp);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.6, t + 0.4); g.gain.exponentialRampToValueAtTime(0.001, t + 4.2);
    return 4.5;
  });
  def('bells', 4, 4, 1, function (d, t) { // Judson Memorial Church peal
    var tones = [mtof(62), mtof(60), mtof(57), mtof(55)];
    for (var k = 0; k < 8; k++) I.bell(d, t + k * 0.55, tones[k % 4], 0.55, 3.8);
    return 8;
  });
  def('fireworks', 3, 0.3, 4, function (d, t) {
    var g = G(0, d), o = O('sine', 700, t, t + 1.0, g); o.frequency.exponentialRampToValueAtTime(2600, t + 0.9); swell(g, t, 0.05, 0.1, 0.6, 0.2);
    var bt = t + 1.0; I.thump(d, bt, 0.8, 70);
    var n = G(0, d), lp = F('lowpass', 900, 0.5, n); N('pink', bt, bt + 1.2, lp); perc(n, bt, 0.5, 0.005, 0.8);
    for (var k = 0; k < 24; k++) I.stick(d, bt + 0.15 + rnd(0, 1.3), rnd(0.2, 0.6));
    return 2.6;
  });
  def('dosa', 3, 0.5, 1, function (d, t) { // sizzle on the griddle + register
    var g = G(0, d), hp = F('highpass', 3500, 0.5, g); N('white', t, t + 1.5, hp); swell(g, t, 0.1, 0.05, 0.9, 0.5);
    for (var k = 0; k < 18; k++) I.stick(d, t + rnd(0, 1.4), rnd(0.1, 0.3));
    I.bell(d, t + 0.1, 2637, 0.3, 0.6, [[1, 1, 1], [2.4, 0.3, 0.4]]);
    return 1.6;
  });
  def('graduation', 4, 3, 1, function (d, t) {
    cheer(d, t, 1, 3);
    [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79]].forEach(function (ch, i) {
      ch.forEach(function (m) { I.trumpet(d, t + i * 0.42, m, i === 3 ? 1.1 : 0.32, 0.6); });
    });
    return 3.3;
  });
  def('fanfare', 4, 1, 1, function (d, t, o) {
    var c = crewOf(o), ld = c === 'hustle' ? I.piano : c === 'violets' ? I.vibes : c === 'pack' ? I.trumpet : I.sax;
    [[0, 65, 0.3], [0.3, 69, 0.3], [0.6, 72, 0.3], [0.9, 77, 1.2]].forEach(function (n) { ld(d, t + n[0], n[1], n[2], 0.8); });
    I.crash(d, t + 0.9, 0.7); I.bucketLow(d, t + 0.9, 0.9);
    return 2.4;
  });
  def('sadTrombone', 4, 1, 1, function (d, t) {
    [[0, 62, 0.35], [0.4, 61, 0.35], [0.8, 60, 0.35], [1.2, 59, 1.1]].forEach(function (n) { I.trumpet(d, t + n[0], n[1] - 12, n[2], 0.6); });
    return 2.6;
  });

  // Ambient one-shots (amb bus)
  function coo(d, t, vol) {
    var f = rnd(330, 400), env = G(0, d), lp = F('lowpass', 900, 0.7, trem(env, 0.45, rnd(16, 22), t, t + 1.0));
    var o = O('sine', f * 0.85, t, t + 1.0, lp), mod = O('sine', f * 0.5, t, t + 1.0, null), mg = G(f * 0.25, o.frequency); mod.connect(mg);
    o.frequency.linearRampToValueAtTime(f, t + 0.25); o.frequency.linearRampToValueAtTime(f * 0.88, t + 0.8);
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.12 * vol, t + 0.12);
    env.gain.setValueAtTime(0.1 * vol, t + 0.35); env.gain.linearRampToValueAtTime(0.02 * vol, t + 0.45);
    env.gain.linearRampToValueAtTime(0.11 * vol, t + 0.55); env.gain.linearRampToValueAtTime(0, t + 0.95);
    return 1.0;
  }
  def('chirp', 1, 0, 6, function (d, t) { // house sparrow chirps
    var n = 2 + ((Math.random() * 4) | 0);
    for (var k = 0; k < n; k++) {
      var st = t + k * rnd(0.09, 0.16), f = rnd(3600, 5200), g = G(0, d), o = O('sine', f, st, st + 0.08, g);
      o.frequency.exponentialRampToValueAtTime(f * rnd(0.6, 0.8), st + 0.06); perc(g, st, 0.035, 0.004, 0.05);
    }
    return n * 0.16 + 0.1;
  }, 'amb');
  def('robin', 1, 0, 3, function (d, t) { // evening warble
    var n = 4 + ((Math.random() * 4) | 0), st = t;
    for (var k = 0; k < n; k++) {
      var f = rnd(2000, 3200), len = rnd(0.08, 0.16), g = G(0, d), o = O('sine', f, st, st + len + 0.02, g);
      var fm = O('sine', rnd(40, 70), st, st + len, null), fg = G(f * 0.06, o.frequency); fm.connect(fg);
      o.frequency.linearRampToValueAtTime(f * rnd(0.85, 1.2), st + len);
      swell(g, st, 0.05, 0.01, len - 0.03, 0.02); st += len + rnd(0.03, 0.09);
    }
    return st - t + 0.1;
  }, 'amb');
  def('cricket', 1, 0, 6, function (d, t) {
    var f = rnd(4300, 4900), reps = 2 + ((Math.random() * 3) | 0), st = t;
    for (var r = 0; r < reps; r++) {
      for (var p = 0; p < 3; p++) { var g = G(0, d); O('sine', f, st, st + 0.03, g); perc(g, st, 0.035, 0.003, 0.015); st += 0.033; }
      st += rnd(0.25, 0.4);
    }
    return st - t;
  }, 'amb');
  def('carPass', 1, 0, 4, function (d, t, o) {
    var len = (o && o.len) || rnd(2.5, 4.5), truck = o && o.truck;
    var g = G(0, d), bp = F('bandpass', truck ? 260 : rnd(450, 800), 0.8, g); N('pink', t, t + len + 0.2, bp);
    var lo = G(0, d), lp = F('lowpass', 140, 0.7, lo); N('brown', t, t + len + 0.2, lp);
    bp.frequency.setValueAtTime(bp.frequency.value * 1.15, t); bp.frequency.linearRampToValueAtTime(bp.frequency.value * 0.85, t + len); // doppler-ish
    swell(g, t, truck ? 0.35 : 0.22, len * 0.5, 0, len * 0.5);
    swell(lo, t, truck ? 0.5 : 0.25, len * 0.5, 0, len * 0.5);
    return len + 0.2;
  }, 'amb');
  def('horn', 1, 3, 1, function (d, t) {
    var a = rnd(380, 460), b = a * 1.26, k = chance(0.6) ? 2 : 1;
    for (var i = 0; i < k; i++) {
      var st = t + i * rnd(0.18, 0.3), len = rnd(0.12, 0.35), g = G(0, d), lp = F('lowpass', 1500, 0.8, g);
      O('sawtooth', a, st, st + len + 0.02, lp); O('sawtooth', b, st, st + len + 0.02, lp);
      swell(g, st, 0.09, 0.01, len - 0.02, 0.02);
    }
    return 0.9;
  }, 'amb');
  def('siren', 1, 20, 1, function (d, t) {
    var len = rnd(7, 10), g = G(0, d), lp = F('lowpass', 1800, 0.7, g), o = O('triangle', 800, t, t + len, lp);
    var wail = chance(0.6), p = o.frequency;
    if (wail) { for (var s = 0; s < len; s += 3.2) { p.linearRampToValueAtTime(1350, t + s + 1.5); p.linearRampToValueAtTime(760, t + s + 3.2); } }
    else { var lfo = O('triangle', 3.5, t, t + len, null), lg = G(280, p); lfo.connect(lg); p.setValueAtTime(1050, t); }
    p.linearRampToValueAtTime(p.value * 0.94, t + len); // passing by
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + len * 0.45); g.gain.linearRampToValueAtTime(0, t + len);
    return len;
  }, 'amb');
  def('subway', 1, 15, 1, function (d, t) {
    var len = rnd(5, 8), g = G(0, d), lp = F('lowpass', 110, 0.9, g); N('brown', t, t + len, lp);
    var cl = G(0, d), bp = F('bandpass', 260, 2, trem(cl, 0.6, 2.4, t, t + len, 'square')); N('pink', t, t + len, bp); // rail joints
    swell(g, t, 0.4, len * 0.4, len * 0.2, len * 0.4); swell(cl, t, 0.06, len * 0.4, len * 0.2, len * 0.4);
    return len;
  }, 'amb');
  def('dogFar', 1, 2, 2, function (d, t) { var n = 1 + ((Math.random() * 3) | 0), s = rnd(0.2, 0.8); for (var k = 0; k < n; k++) I.bark(d, t + k * rnd(0.22, 0.35), s, 0.45); return n * 0.35 + 0.2; }, 'amb');
  def('kids', 1, 4, 1, function (d, t) { // playground laughter / shriek
    var st = t;
    for (var k = 0; k < 3 + ((Math.random() * 3) | 0); k++) {
      var f = rnd(420, 700), g = G(0, d), bp = F('bandpass', rnd(1200, 2400), 2, g), o = O('sawtooth', f, st, st + 0.2, bp);
      o.frequency.linearRampToValueAtTime(f * rnd(0.8, 1.4), st + 0.15); swell(g, st, 0.05, 0.02, 0.08, 0.06); st += rnd(0.12, 0.2);
    }
    return st - t + 0.2;
  }, 'amb');
  def('skate', 1, 8, 1, function (d, t) { // roll, pop, land
    var r = G(0, d), bp = F('bandpass', 600, 0.9, r); N('pink', t, t + 1.4, bp); swell(r, t, 0.08, 0.3, 0.6, 0.2);
    var st = t + 1.0; I.slap(d, st, 0.45, true); I.slap(d, st + 0.35, 0.6, true);
    return 1.6;
  }, 'amb');
  def('chessFar', 1, 0.5, 3, function (d, t) { I.slap(d, t, rnd(0.3, 0.6)); if (chance(0.6)) I.clockTick(d, t + rnd(0.15, 0.3), 0.5); return 0.4; }, 'amb');
  def('chatterFar', 1, 1, 2, function (d, t) { return I.voice(d, t, pick(['neutral', 'violets', 'hustle']), 3 + ((Math.random() * 4) | 0), 0.3, rnd(0.8, 1.3)) - t; }, 'amb');
  def('laugh', 1, 4, 1, function (d, t) {
    var f = rnd(180, 300), st = t;
    for (var k = 0; k < 4 + ((Math.random() * 3) | 0); k++) {
      var e = G(0, d), bp = F('bandpass', 750, 4, e); O('sawtooth', f * (1 - k * 0.03), st, st + 0.12, bp); swell(e, st, 0.07, 0.01, 0.05, 0.05); st += 0.13;
    }
    return st - t + 0.1;
  }, 'amb');

  // ------------------------------------------------------------- play()
  function play(name, opts) {
    opts = opts || {};
    if (!ctx || !built || ctx.state === 'closed') return false;
    var d = SFX[name];
    if (!d) return false;
    var t = now() + (opts.delay || 0) + 0.005;
    var key = name + (opts.key != null ? ':' + opts.key : '');
    var cd = opts.cooldown != null ? opts.cooldown : d.cd;
    if (cd && cool[key] != null && t - cool[key] < cd) { stats.dropped++; return false; }
    var isAmb = d.bus === 'amb';
    var list = isAmb ? ambVoices : voices, cap = isAmb ? MAX_AMB_VOICES : MAX_VOICES;
    prune(list, now());
    var cnt = 0;
    for (var i = 0; i < list.length; i++) if (list[i].name === name) cnt++;
    if (d.max && cnt >= d.max) { stats.dropped++; return false; }
    var sp = spatial(opts.x, opts.z, opts.minGain);
    var vol = opts.volume == null ? 1 : opts.volume;
    if (sp.gain * vol < 0.03 && d.prio < 4) { stats.culled++; return false; }
    var prio = opts.prio || d.prio || PRIO_DEFAULT;
    if (list.length >= cap) {
      var lo = -1;
      for (var j = 0; j < list.length; j++) if (list[j].prio < prio && (lo < 0 || list[j].prio < list[lo].prio)) lo = j;
      if (lo < 0) { stats.dropped++; return false; }
      var vv = list[lo];
      try { vv.gain.gain.cancelScheduledValues(now()); vv.gain.gain.setTargetAtTime(0, now(), 0.02); } catch (e) { /* ignore */ }
      list.splice(lo, 1); stats.stolen++;
    }
    cool[key] = t;
    var bus = isAmb ? ambBus : (opts.bus === 'music' ? musicBus : sfxBus);
    var v = makeVoice(bus, sp, vol);
    var dur = 0.5;
    try { dur = d.fn(v.input, t, opts) || 0.5; } catch (e) { stats.errors++; if (W && W.console) console.warn('[audio] ' + name, e); }
    if (opts.x2 != null && opts.z2 != null) {
      var sp2 = spatial(opts.x2, opts.z2);
      v.pan.pan.setValueAtTime(sp.pan, t); v.pan.pan.linearRampToValueAtTime(sp2.pan, t + dur);
      v.gain.gain.setValueAtTime(sp.gain * vol, t);
      var mid = spatial((opts.x + opts.x2) / 2, (opts.z + opts.z2) / 2);
      v.gain.gain.linearRampToValueAtTime(mid.gain * vol, t + dur / 2);
      v.gain.gain.linearRampToValueAtTime(sp2.gain * vol, t + dur);
    }
    list.push({ name: name, prio: prio, end: t + dur, gain: v.gain });
    stats.played++;
    if (voices.length > stats.peakVoices) stats.peakVoices = voices.length;
    later(function () { v.nodes.forEach(function (n) { try { n.disconnect(); } catch (e) { /* ignore */ } }); }, (t - now() + dur + 1.5) * 1000);
    return true;
  }

  // ------------------------------------------------------------- ambience bed
  var PHASE_AMB = {
    afternoon: { birds: 1.0, robins: 0.15, crickets: 0, crowd: 0.85, traffic: 1.0, kids: 1, dogs: 1, wind: 0.5, siren: 1, hum: 1 },
    golden: { birds: 0.45, robins: 1.0, crickets: 0.2, crowd: 1.0, traffic: 1.0, kids: 0.3, dogs: 0.6, wind: 0.6, siren: 1, hum: 1 },
    night: { birds: 0, robins: 0.05, crickets: 1.0, crowd: 0.5, traffic: 0.7, kids: 0, dogs: 0.25, wind: 0.8, siren: 1.6, hum: 0.85 }
  };
  function normPhase(p) {
    if (p == null) return 'afternoon';
    if (typeof p === 'number') return ['afternoon', 'golden', 'night'][clamp(p | 0, 0, 2)];
    var s = String(p).toLowerCase();
    if (s.indexOf('night') >= 0) return 'night';
    if (s.indexOf('gold') >= 0 || s.indexOf('dusk') >= 0 || s.indexOf('even') >= 0 || s.indexOf('sunset') >= 0) return 'golden';
    return 'afternoon';
  }

  function buildAmbience() {
    amb = { phase: normPhase(desired.phase), intensity: desired.intensity, rain: 0, next: {}, crowdBands: [] };
    var t = now();
    // City hum: brown noise through a low-pass
    amb.hum = G(0, ambBus); var hl = F('lowpass', 170, 0.6, amb.hum); N('brown', t, t + 1e6, hl);
    var hum2 = G(0.25, amb.hum), hb = F('bandpass', 95, 2, hum2); N('pink', t, t + 1e6, hb);
    // Fountain: band-passed noise ∝ 1/distance to (0,0)
    amb.fount = G(0); amb.fountPan = makePan(ambBus); amb.fount.connect(amb.fountPan);
    var fb = F('bandpass', 1500, 0.45, amb.fount), fh = F('highpass', 350, 0.5, null); fh.connect(fb); N('white', t, t + 1e6, fh);
    var fl = G(0.6, amb.fount), flp = F('lowpass', 700, 0.5, fl); N('pink', t, t + 1e6, flp);
    var splash = G(0.5, null), slfo = O('sine', 0.23, t, t + 1e6, null); slfo.connect(splash); splash.connect(fb.frequency); splash.gain.value = 300;
    // Wind in the trees
    amb.wind = G(0, ambBus); var wb = F('bandpass', 520, 0.7, amb.wind); N('pink', t, t + 1e6, wb);
    amb.leaves = G(0, ambBus); var lh = F('highpass', 3200, 0.5, amb.leaves); N('white', t, t + 1e6, lh);
    // Crowd murmur: vowel-formant bands with syllabic flutter
    amb.crowd = G(0, ambBus);
    [480, 1050, 1750, 2600].forEach(function (f, i) {
      var g = G(0.2, amb.crowd), bp = F('bandpass', f, 3.5, g); N('pink', t, t + 1e6, bp, 0.9 + i * 0.05);
      amb.crowdBands.push({ g: g, bp: bp, base: f });
    });
    // Rain bed for Summer Shower
    amb.rainG = G(0, ambBus); var rh = F('highpass', 800, 0.4, amb.rainG), rl = F('lowpass', 7000, 0.4, null); rl.connect(rh); N('white', t, t + 1e6, rl);
    applyAmbience(true);
  }

  function applyAmbience(immediate) {
    if (!amb || amb.freeze) return;
    var t = now(), P = PHASE_AMB[amb.phase], tc = immediate ? 0.05 : 2.5;
    var zoom = clamp((L.height - 25) / 180, 0, 1); // 0 close, 1 high above
    var dF = Math.sqrt(L.x * L.x + L.z * L.z);
    amb.hum.gain.setTargetAtTime(0.17 * P.hum * (0.7 + 0.5 * zoom), t, tc);
    var fg = clamp(14 / Math.max(14, dF), 0, 1) * (1 - 0.45 * zoom);
    amb.fount.gain.setTargetAtTime(0.2 * fg, t, immediate ? 0.05 : 0.25);
    var fs = spatial(0, 0); amb.fountPan.pan.setTargetAtTime(fs.pan * 0.7, t, 0.2);
    amb.wind.gain.setTargetAtTime(0.18 * P.wind, t, tc);
    amb.leaves.gain.setTargetAtTime(0.015 * P.wind * (1 - 0.5 * zoom), t, tc);
    var crowd = P.crowd * (0.35 + 0.65 * amb.intensity) * (1 - 0.3 * zoom) + 0.25 * clamp(combat.energy / 3, 0, 1);
    amb.crowd.gain.setTargetAtTime(0.9 * crowd, t, immediate ? 0.05 : 1.2);
    amb.rainG.gain.setTargetAtTime(0.1 * amb.rain, t, 1.5);
  }

  function ambTick(t0, t1) {
    if (!amb || amb.freeze) return;
    var P = PHASE_AMB[amb.phase], n = amb.next;
    function due(k, lo, hi) {
      if (n[k] == null) n[k] = t0 + rnd(lo, hi) * 0.5;
      if (n[k] <= t1) { n[k] = t1 + rnd(lo, hi); return true; }
      return false;
    }
    // crowd flutter
    amb.crowdBands.forEach(function (b) {
      if (chance(0.5)) { b.g.gain.setTargetAtTime(rnd(0.04, 0.32), t0, rnd(0.05, 0.2)); b.bp.frequency.setTargetAtTime(b.base * rnd(0.8, 1.25), t0, 0.1); }
    });
    var streetPos = function () {
      var side = (Math.random() * 4) | 0, u = rnd(-170, 170);
      if (side === 0) return { x: u, z: -100, x2: u + (chance(0.5) ? 90 : -90), z2: -100 };   // Washington Sq N
      if (side === 1) return { x: u, z: 98, x2: u + (chance(0.5) ? 90 : -90), z2: 98 };       // Washington Sq S / W 4th
      if (side === 2) return { x: -175, z: u * 0.6, x2: -175, z2: u * 0.6 + (chance(0.5) ? 70 : -70) }; // MacDougal
      return { x: 155, z: u * 0.6, x2: 155, z2: u * 0.6 + (chance(0.5) ? 70 : -70) };       // University Pl / Fifth
    };
    if (due('car', 1.2 / P.traffic, 4.5 / P.traffic)) { var s = streetPos(); s.volume = 0.8; s.truck = chance(0.15); play('carPass', s); }
    if (due('horn', 14, 40)) { var h = streetPos(); h.volume = 0.6; play('horn', h); }
    if (due('siren', 50 / P.siren, 120 / P.siren)) { var sp = streetPos(); sp.volume = 0.7; play('siren', sp); }
    if (due('subway', 25, 55)) play('subway', { x: -210, z: 110, volume: 0.9, minGain: 0.4 });
    if (P.birds > 0 && due('chirp', 0.7 / P.birds, 3 / P.birds)) play('chirp', { x: L.x + rnd(-50, 50), z: L.z + rnd(-50, 50), volume: 0.7 });
    if (P.robins > 0.1 && due('robin', 3 / P.robins, 9 / P.robins)) play('robin', { x: L.x + rnd(-60, 60), z: L.z + rnd(-60, 60), volume: 0.6 });
    if (P.crickets > 0 && due('cricket', 0.3 / P.crickets, 1.2 / P.crickets)) play('cricket', { x: L.x + rnd(-40, 40), z: L.z + rnd(-40, 40), volume: 0.6 });
    if (due('coo', 3, 8)) play('coo', { x: L.x + rnd(-30, 30), z: L.z + rnd(-30, 30), volume: amb.phase === 'night' ? 0.3 : 0.8 });
    if (P.kids > 0 && due('kids', 7 / P.kids, 18 / P.kids)) play('kids', { x: 55, z: -32, volume: 0.8 });
    if (P.dogs > 0 && due('dog', 6 / P.dogs, 16 / P.dogs)) play('dogFar', chance(0.5) ? { x: -60, z: 58, volume: 0.7 } : { x: 28, z: 60, volume: 0.6 });
    if (due('chess', 1.5, 4.5)) play('chessFar', { x: -134 + rnd(-8, 8), z: 49 + rnd(-8, 8), volume: 0.9 });
    if (due('skate', 20, 50)) play('skate', { x: rnd(-15, 15), z: rnd(-50, -30), volume: 0.7 });
    if (due('chat', 2.5 / (0.4 + amb.intensity), 7 / (0.4 + amb.intensity))) play('chatterFar', { x: L.x + rnd(-35, 35), z: L.z + rnd(-35, 35), volume: 0.6 });
    if (due('laugh', 12, 30)) play('laugh', { x: L.x + rnd(-40, 40), z: L.z + rnd(-40, 40), volume: 0.6 });
    if (amb.rain > 0.5 && due('thunder', 9, 20)) play('thunder', { x: rnd(-300, 300), z: rnd(-300, 300), minGain: 0.4, volume: 0.6 });
  }

  // ------------------------------------------------------------- positional loops (event music)
  function startLoop(key, x, z, vol, tick) {
    stopLoop(key);
    if (!ctx || !built) return;
    var g = G(0), lp = F('lowpass', 20000, 0.5, g), pan = makePan(sfxBus); g.connect(pan);
    var ws = G(0.2, revIn); pan.connect(ws);
    var lo = { key: key, x: x, z: z, vol: vol, g: g, lp: lp, pan: pan, ws: ws, tick: tick, st: { next: now() + 0.1 } };
    loops[key] = lo; placeLoop(lo, true);
  }
  function placeLoop(lo, immediate) {
    var sp = spatial(lo.x, lo.z), t = now();
    lo.g.gain.setTargetAtTime(sp.gain * lo.vol, t, immediate ? 0.6 : 0.15);
    lo.pan.pan.setTargetAtTime(sp.pan, t, 0.15);
    lo.lp.frequency.setTargetAtTime(sp.lp, t, 0.15);
  }
  function stopLoop(key) {
    var lo = loops[key]; if (!lo) return;
    delete loops[key];
    try { lo.g.gain.setTargetAtTime(0, now(), 0.5); } catch (e) { /* ignore */ }
    later(function () { [lo.g, lo.lp, lo.pan, lo.ws].forEach(function (n) { try { n.disconnect(); } catch (e) { /* ignore */ } }); }, 4000);
  }
  // The Piano Guy: stride piano, ragtime circle in C, pentatonic right hand.
  function pianoGuyTick(dest, from, to, st) {
    var beat = 60 / 112, prog = [[48, [0, 4, 7]], [45, [0, 4, 7, 10]], [50, [0, 4, 7, 10]], [43, [0, 4, 7, 10]], [48, [0, 4, 7]], [53, [0, 4, 7, 9]], [43, [0, 4, 7, 10]], [48, [0, 4, 7]]];
    var pent = [0, 2, 4, 7, 9];
    st.b = st.b || 0; st.mel = st.mel == null ? 76 : st.mel;
    while (st.next < to) {
      var t = Math.max(st.next, from), bar = Math.floor(st.b / 4) % prog.length, bi = st.b % 4, ch = prog[bar];
      if (bi % 2 === 0) I.piano(dest, t, ch[0] - (bi === 2 ? 5 : 0), beat * 0.9, 0.7);
      else ch[1].forEach(function (iv) { I.piano(dest, t, ch[0] + 12 + iv, beat * 0.5, 0.45); });
      for (var e = 0; e < 2; e++) {
        if (!chance(e === 0 ? 0.85 : 0.55)) continue;
        var tt = t + (e ? beat * 0.6 : 0);
        var step = pick([-2, -1, -1, 1, 1, 2]);
        var idx = pent.indexOf(((st.mel % 12) + 12) % 12);
        if (idx < 0) idx = 0;
        idx += step; var oct = Math.floor(st.mel / 12);
        if (idx < 0) { idx += 5; oct--; } if (idx >= 5) { idx -= 5; oct++; }
        st.mel = clamp(oct * 12 + pent[idx], 67, 88);
        if (bi === 0 && e === 0) { // land on a chord tone
          var best = st.mel, bd = 99;
          ch[1].forEach(function (iv) { for (var o = 5; o < 8; o++) { var m = o * 12 + (ch[0] % 12) + iv; if (Math.abs(m - st.mel) < bd) { bd = Math.abs(m - st.mel); best = m; } } });
          st.mel = best;
        }
        I.piano(dest, tt, st.mel, beat * 0.5, 0.6);
      }
      st.b++; st.next += beat;
    }
  }
  // Ice cream truck: original music-box ditty.
  var ICE = [72, 76, 79, 76, 77, 74, 71, 74, 72, 76, 79, 84, 83, 79, 76, -1, 77, 81, 79, 76, 74, 77, 76, 72, 74, 79, 77, 74, 72, -1, -1, -1];
  function iceTick(dest, from, to, st) {
    var step = 60 / 150 / 2; st.i = st.i || 0;
    while (st.next < to) {
      var m = ICE[st.i % ICE.length];
      if (m > 0) I.musicBox(dest, Math.max(st.next, from), m + (st.detune || 0), step, 0.8);
      st.i++; st.next += step;
    }
  }
  // Pigeon Lady: continuous cooing cloud.
  function pigeonTick(dest, from, to, st) {
    while (st.next < to) { coo(dest, Math.max(st.next, from), rnd(0.5, 1)); st.next += rnd(0.25, 0.7); }
  }
  // Squirrel heist: intermittent chitter.
  function squirrelTick(dest, from, to, st) {
    while (st.next < to) {
      var t = Math.max(st.next, from);
      for (var k = 0; k < 8; k++) { var g = G(0, dest), o = O('square', rnd(3400, 4600), t + k * 0.045, t + k * 0.045 + 0.03, null), bp = F('bandpass', 4000, 3, g); o.connect(bp); perc(g, t + k * 0.045, 0.06, 0.001, 0.02); }
      st.next += rnd(1.5, 4);
    }
  }

  // ------------------------------------------------------------- scheduler
  function schedule() {
    if (!ctx || !built || ctx.state !== 'running') return;
    var t = now(), dt = lastSched ? clamp(t - lastSched, 0, 1) : 0.05; lastSched = t;
    var from = t, to = t + 0.3;
    try { ambTick(from, to); } catch (e) { stats.errors++; }
    for (var k in loops) {
      if (!Object.prototype.hasOwnProperty.call(loops, k)) continue;
      var lo = loops[k];
      try { lo.tick(lo.lp, from, to, lo.st); } catch (e2) { stats.errors++; }
    }
    // combat energy → music intensity & crowd
    combat.energy *= Math.exp(-dt / 5);
    combat.playerEnergy *= Math.exp(-dt / 6);
    if (music) {
      var inten = clamp(0.15 + 0.6 * (1 - Math.exp(-combat.energy / 2.5)) + 0.3 * (1 - Math.exp(-combat.playerEnergy / 2)), 0, 1);
      music.setIntensity(inten);
    }
    if (amb && (!amb.lastApply || t - amb.lastApply > 1.0)) { amb.lastApply = t; applyAmbience(false); }
    if (stateProvider && (!game.lastPoll || t - game.lastPoll > 1.0)) { game.lastPoll = t; try { update(stateProvider()); } catch (e3) { stats.errors++; } }
  }

  // ------------------------------------------------------------- graph & unlock
  function build() {
    if (built) return;
    buildBuffers(); buildWaves();
    masterGain = G(muted ? 0 : vols.master);
    var shelf = F('lowshelf', 120, null); shelf.gain.value = 1.5;
    var air = F('highshelf', 9000, null); air.gain.value = -3;   // keep it gentle on the ears
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.22;
    analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
    masterGain.connect(shelf); shelf.connect(air); air.connect(comp); comp.connect(analyser); analyser.connect(ctx.destination);
    sfxBus = G(vols.sfx, masterGain); musicBus = G(vols.music, masterGain); ambBus = G(vols.ambience, masterGain);
    revIn = G(1); convolver = ctx.createConvolver(); convolver.buffer = buffers.ir; revOut = G(0.55, masterGain);
    var revHP = F('highpass', 180, 0.5, convolver); revIn.connect(revHP); convolver.connect(revOut);
    built = true;
    buildAmbience();
    if (SQ.audioMusic && SQ.audioMusic.create) {
      try { music = SQ.audioMusic.create(ctx, musicBus, A._lib); } catch (e) { stats.errors++; if (W && W.console) console.warn('[audio] music', e); }
    }
    if (music) {
      music.setNight(normPhase(desired.phase) === 'night');
      if (game.held != null) music.setLayers(layersFor(game.held));
      music.setMinor(!!game.behind); music.setNearWin(!!game.nearWin);
      if (desired.music) music.setState(desired.music, desired.musicFaction);
    }
    schedTimer = setInterval(schedule, 50);
  }

  function unlock() {
    if (!AC) return false;
    try {
      if (!ctx) ctx = new AC({ latencyHint: 'interactive' });
      if (!built) build();
      if (ctx.state === 'suspended' && !hiddenSuspended) {
        unlocking = true;
        var p = ctx.resume();
        if (p && p.then) p.then(function () { unlocking = false; }, function () { unlocking = false; });
      }
    } catch (e) { stats.errors++; if (W && W.console) console.warn('[audio] unlock', e); return false; }
    if (ctx.state === 'running') unbindGestures();
    return true;
  }
  var GESTURES = ['pointerdown', 'touchend', 'mousedown', 'keydown', 'click'];
  function onGesture() { unlock(); }
  function bindGestures() {
    if (gestureBound || !W || !W.addEventListener) return;
    gestureBound = true;
    GESTURES.forEach(function (ev) { W.addEventListener(ev, onGesture, true); });
  }
  function unbindGestures() {
    if (!gestureBound || !W) return;
    gestureBound = false;
    GESTURES.forEach(function (ev) { W.removeEventListener(ev, onGesture, true); });
  }
  function onVisibility() {
    if (!ctx || typeof document === 'undefined') return;
    if (document.hidden) { if (ctx.state === 'running') { hiddenSuspended = true; ctx.suspend(); } }
    else if (hiddenSuspended) { hiddenSuspended = false; ctx.resume(); }
  }

  // ------------------------------------------------------------- game-state adapters (defensive)
  function getState() {
    try { if (stateProvider) return stateProvider(); } catch (e) { /* ignore */ }
    return null;
  }
  function normCrew(s) {
    if (s == null) return null;
    s = String(s).toLowerCase();
    if (s.indexOf('hust') >= 0 || s.indexOf('chess') >= 0) return 'hustle';
    if (s.indexOf('nois') >= 0 || s.indexOf('busk') >= 0) return 'noise';
    if (s.indexOf('viol') >= 0 || s.indexOf('nyu') >= 0 || s.indexOf('stud') >= 0) return 'violets';
    if (s.indexOf('pack') >= 0 || s.indexOf('dog') >= 0) return 'pack';
    return null;
  }
  function fac(f) {
    if (f == null) return null;
    if (typeof f === 'object') return normCrew(f.crew || f.kind || f.type || f.id || f.name);
    if (typeof f === 'number') {
      var st = getState(), fo = st && st.factions && st.factions[f];
      if (fo) {
        if (fo.key === 'squirrels' || fo.npc) return null; // Mission 1's Squirrel Gang: neutral sounds, no crew motif
        var c = normCrew(fo.key) || normCrew(fo.crew) || normCrew(fo.kind) || normCrew(fo.type) || normCrew(fo.id) || normCrew(fo.name); if (c) return c;
        return null;
      }
      return CREWS[((f % 4) + 4) % 4];
    }
    var n = normCrew(f);
    if (n) return n;
    var st2 = getState();
    if (st2 && st2.factions) for (var i = 0; i < st2.factions.length; i++) {
      var ff = st2.factions[i]; if (ff && (ff.id === f || ff.name === f)) return normCrew(ff.crew || ff.kind || ff.type) || null;
    }
    return null;
  }
  function normCls(c) {
    if (c == null) return 'crowd';
    if (typeof c === 'number') return ['crowd', 'talker', 'heavy'][c] || 'crowd';
    var s = String(c).toLowerCase();
    if (s.indexOf('talk') >= 0 || s === '▲' || s === 'tri') return 'talker';
    if (s.indexOf('heav') >= 0 || s === '■' || s === 'sq') return 'heavy';
    return 'crowd';
  }
  function sameFaction(a, b) { return a != null && b != null && (a === b || String(a) === String(b)); }
  function isPlayer(f) {
    if (player == null) {
      var st = getState();
      if (st) {
        if (st.player != null) return sameFaction(f, st.player);
        if (st.playerFaction != null) return sameFaction(f, st.playerFaction);
        if (st.factions) for (var i = 0; i < st.factions.length; i++) {
          var ff = st.factions[i]; if (ff && (ff.human || ff.isPlayer || ff.player === true)) return sameFaction(f, ff.id != null ? ff.id : i) || f === i;
        }
      }
      return false;
    }
    return sameFaction(f, player);
  }
  var LM_FALLBACK = [
    ['fount', 0, 0], ['arch', 0, -42], ['chess', -134, 49], ['grove', -136, -48], ['hangman', -136, -48], ['holley', -76, -3],
    ['garib', 58, -6], ['bigrun', -60, 58], ['big', -60, 58], ['play', 55, -32], ['small', 28, 56], ['kempner', 28, 56],
    ['bobst', 104, 60], ['judson', -32, 86], ['toddler', -50, -60], ['hill', -105, 42]
  ];
  function lmInfo(lm) {
    if (lm == null) return null;
    if (typeof lm === 'object' && (lm.x != null || lm.center)) return lmFrom(lm);
    var st = getState(), arr = st && st.landmarks, i, o;
    if (arr) {
      if (typeof lm === 'number' && arr[lm]) return lmFrom(arr[lm]);
      for (i = 0; i < arr.length; i++) { o = arr[i]; if (o && (o.id === lm || o.key === lm)) return lmFrom(o); }
    }
    var data = SQ.data && SQ.data.landmarks;
    if (data) {
      var list = Array.isArray(data) ? data : (data.list || Object.keys(data).map(function (k) { var v = data[k]; if (v && typeof v === 'object' && v.id == null) v.id = k; return v; }));
      if (typeof lm === 'number' && list[lm]) return lmFrom(list[lm]);
      for (i = 0; i < list.length; i++) { o = list[i]; if (o && (o.id === lm || o.key === lm)) return lmFrom(o); }
    }
    var s = String(lm).toLowerCase().replace(/[^a-z]/g, '');
    for (i = 0; i < LM_FALLBACK.length; i++) if (s.indexOf(LM_FALLBACK[i][0]) >= 0) return { x: LM_FALLBACK[i][1], z: LM_FALLBACK[i][2], owner: null };
    return null;
  }
  function lmFrom(o) {
    var x = o.x, z = o.z;
    if (x == null && o.center) { if (Array.isArray(o.center)) { x = o.center[0]; z = o.center[1]; } else { x = o.center.x; z = o.center.z; } }
    if (x == null && o.cx != null) { x = o.cx; z = o.cz; }
    return { x: x, z: z, owner: o.owner != null ? o.owner : (o.faction != null ? o.faction : null), id: o.id };
  }
  function unitInfo(id) {
    var st = getState(), u = st && st.units;
    if (!u || id == null) return null;
    if (typeof id === 'object') return { x: id.x, z: id.z, faction: id.faction, cls: id.cls };
    if (u.x && u.x.length != null && !Array.isArray(u)) {
      return { x: u.x[id], z: u.z ? u.z[id] : undefined, faction: u.faction ? u.faction[id] : undefined, cls: u.cls ? u.cls[id] : undefined };
    }
    var o = Array.isArray(u) ? u[id] : (u[id] || null);
    if (!o && Array.isArray(u)) for (var i = 0; i < u.length; i++) if (u[i] && u[i].id === id) { o = u[i]; break; }
    return o ? { x: o.x, z: o.z, faction: o.faction, cls: o.cls } : null;
  }
  function layersFor(held) { return clamp(Math.floor(held / 2), 0, 3); }

  // Pull landmarks-held / behind / near-win from match state (called ~1 Hz by the scheduler if a provider is set).
  function update(st, playerId) {
    if (playerId != null) player = playerId;
    if (!st) return;
    if (st.phase != null && amb && normPhase(st.phase) !== amb.phase) setAmbience(st.phase);
    var me = player != null ? player : (st.player != null ? st.player : st.playerFaction);
    if (me == null || !st.landmarks) return;
    var held = 0;
    for (var i = 0; i < st.landmarks.length; i++) { var lm = st.landmarks[i]; if (lm && sameFaction(lm.owner != null ? lm.owner : lm.faction, me)) held++; }
    var turf = {}, best = -1, mine = null, target = st.turfTarget || (st.cfg && st.cfg.turfTarget) || 1500;
    (st.factions || []).forEach(function (f, idx) {
      if (!f) return; var id = f.id != null ? f.id : idx, tv = +(f.turf || 0);
      turf[id] = tv; if (tv > best) best = tv; if (sameFaction(id, me) || idx === me) mine = tv;
    });
    var behind = mine != null && best - mine >= 150;
    var nearWin = best >= 0 && target - best <= 200;
    setGameInfo({ held: held, behind: behind, nearWin: nearWin });
  }
  function setGameInfo(o) {
    o = o || {};
    if (o.held != null) game.held = o.held;
    if (o.behind != null) game.behind = !!o.behind;
    if (o.nearWin != null) game.nearWin = !!o.nearWin;
    if (music) {
      if (game.held != null) music.setLayers(layersFor(game.held));
      music.setMinor(game.behind); music.setNearWin(game.nearWin);
    }
  }

  // ------------------------------------------------------------- bus wiring
  var lmHorn = {};
  function vibrate(ms) { try { if (W && W.navigator && W.navigator.vibrate) W.navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  function eventKind(id) {
    var s = String(id == null ? '' : (typeof id === 'object' ? (id.id || id.kind || '') : id)).toLowerCase();
    var kinds = ['piano', 'pigeon', 'squirrel', 'pep', 'tourist', 'bus', 'shower', 'rain', 'ice', 'bell', 'judson', 'grad'];
    for (var i = 0; i < kinds.length; i++) if (s.indexOf(kinds[i]) >= 0) return kinds[i];
    return s;
  }
  function horn(k, lm) {
    var t = now();
    if (!lmHorn[k] || t - lmHorn[k] >= 4) { lmHorn[k] = t; play('underAttack', { x: lm.x, z: lm.z, minGain: 0.7, key: k, cooldown: 4 }); }
  }
  /** Landmark position for an event payload; falls back to the payload's own x/z. */
  function posOf(e) {
    var lm = lmInfo(e.lm);
    if (lm && lm.x != null) return lm;
    return { x: e.x, z: e.z };
  }
  var handlers = {
    capture: function (e) {
      var lm = lmInfo(e.lm) || {}, to = e.to, from = e.from;
      var mineNow = isPlayer(to), lostIt = isPlayer(from) && !mineNow;
      if (to == null || to === -1 || to === '') { // drained to neutral
        if (lostIt) play('lost', { x: lm.x, z: lm.z, minGain: 0.6 });
        return;
      }
      play('capture', { faction: to, x: lm.x, z: lm.z, minGain: mineNow || lostIt ? 0.75 : 0.25, volume: mineNow ? 1 : 0.6, key: 'lm' });
      if (mineNow) { play('gained', { delay: 0.9 }); play('coin', { delay: 1.1 }); vibrate(15); combat.playerEnergy += 0.6; }
      if (lostIt) play('lost', { delay: 0.4, minGain: 0.8 });
      if (game.held != null && (mineNow || lostIt)) setGameInfo({ held: Math.max(0, game.held + (mineNow ? 1 : -1)) });
    },
    contested: function (e) {
      // the sim sends faction = the landmark's owner: the player owns it and attackers are inside
      var lm = posOf(e), k = String(e.lm);
      if (e.faction != null && e.faction !== -1 && isPlayer(e.faction)) horn(k, lm);
      else play('contested', { x: lm.x, z: lm.z, key: k, cooldown: 3, minGain: 0.2 });
      combat.energy += 0.3;
    },
    underAttack: function (e) {
      if (e.faction == null || e.faction === -1 || !isPlayer(e.faction)) return;
      horn(String(e.lm), posOf(e));
      combat.playerEnergy += 0.3;
    },
    neutral: function (e) {
      // drained back to neutral (nobody's) - sting only when it was ours
      if (e.from != null && e.from !== -1 && isPlayer(e.from)) { var lm = posOf(e); play('lost', { x: lm.x, z: lm.z, minGain: 0.6 }); }
    },
    overIt: function (e) {
      var u = unitInfo(e.unit) || {};
      var f = e.faction != null ? e.faction : u.faction;
      play('overIt', { faction: f, x: u.x, z: u.z });
      combat.energy += 0.25;
      if (isPlayer(f)) combat.playerEnergy += 0.35;
      else if (player != null && fac(player) === 'hustle' && chance(0.5)) play('coin', { x: u.x, z: u.z, volume: 0.6 }); // Side Bets
    },
    hit: function (e) {
      var a = unitInfo(e.from) || {}, b = unitInfo(e.to) || {};
      var x = b.x != null ? b.x : a.x, z = b.z != null ? b.z : a.z;
      var crew = e.faction != null ? e.faction : a.faction;
      play('hit', { faction: crew, cls: e.cls != null ? e.cls : a.cls, counter: !!e.counter, x: x, z: z, volume: 0.8 });
      if (e.counter) play('crit', { x: x, z: z, volume: 0.7 });
      combat.energy += e.counter ? 0.06 : 0.04;
      if (isPlayer(a.faction) || isPlayer(b.faction)) combat.playerEnergy += 0.05;
      if (e.counter && combat.energy > 2.5 && chance(0.05)) play('ooh', { x: x, z: z, volume: 0.8 });
    },
    crewCall: function (e) {
      var mine = isPlayer(e.faction);
      var kind = e.kind ? normCrew(e.kind) || kindCrew(e.kind) : null;
      play('crewCall', { faction: kind || e.faction, x: e.x, z: e.z, minGain: mine ? 0.85 : 0.45, prio: 5 });
      play('ooh', { delay: 0.6, volume: 0.7, x: e.x, z: e.z, minGain: 0.3 });
      if (mine) vibrate(15);
      combat.energy += 1; combat.playerEnergy += mine ? 0.8 : 0.4;
    },
    eventWarn: function (e) { var lm = posOf(e); play('eventWarn', { x: lm.x, z: lm.z, minGain: 0.8 }); },
    eventStart: function (e) {
      var k = eventKind(e.kind || e.id), lm = posOf(e), key = 'ev:' + (e.id != null ? (typeof e.id === 'object' ? e.id.id : e.id) : k);
      switch (k) {
        case 'piano': startLoop(key, lm.x != null ? lm.x : 15, lm.z != null ? lm.z : 48, 0.9, pianoGuyTick); break;
        case 'pigeon': play('pigeons', { x: lm.x, z: lm.z, minGain: 0.3 }); startLoop(key, lm.x || 0, lm.z || 0, 0.7, pigeonTick); break;
        case 'squirrel': play('squirrels', { x: lm.x, z: lm.z, minGain: 0.4 }); startLoop(key, lm.x || 0, lm.z || 0, 0.6, squirrelTick); break;
        case 'pep': play('pepWhistle', { x: lm.x, z: lm.z, minGain: 0.4 }); break;
        case 'tourist': case 'bus': play('bus', { x: 0, z: -100, minGain: 0.45 }); break;
        case 'shower': case 'rain': if (amb) { amb.rain = 1; applyAmbience(false); } play('thunder', { minGain: 0.5, volume: 0.6 }); break;
        case 'ice': startLoop(key, lm.x != null ? lm.x : 0, 95, 0.8, iceTick); break;
        case 'bell': case 'judson': play('bells', { x: -32, z: 100, minGain: 0.55 }); break;
        case 'grad': play('graduation', { x: 0, z: -60, minGain: 0.5 }); break;
        default: play('toast');
      }
    },
    eventEnd: function (e) {
      var k = eventKind(e.kind || e.id), key = 'ev:' + (e.id != null ? (typeof e.id === 'object' ? e.id.id : e.id) : k);
      stopLoop(key);
      if ((k === 'shower' || k === 'rain') && amb) { amb.rain = 0; applyAmbience(false); }
    },
    phase: function (e) { setAmbience(e.phase); play('phase', { phase: e.phase }); },
    recruited: function (e) {
      if (player != null && !isPlayer(e.faction)) return;
      play('recruit', { volume: 0.8 });
      if (chance(0.5)) play('ack', { faction: e.faction, delay: 0.3, volume: 0.7 });
    },
    built: function (e) { var lm = lmInfo(e.lm) || {}; play('build', { x: lm.x, z: lm.z, minGain: (lm.owner != null && isPlayer(lm.owner)) ? 0.7 : 0.2 }); },
    hint: function () { play('hint'); },
    aiBark: function (e) {
      var lm = lmInfo(e.lm) || {};
      var n = e.text ? clamp(Math.round(String(e.text).length / 9), 2, 7) : 4;
      play('blip', { faction: e.faction, n: n, x: lm.x, z: lm.z, minGain: 0.45, cooldown: 1.2, volume: 0.8 });
    },
    victory: function (e) {
      var known = player != null || !!getState();
      var won = known ? isPlayer(e.winner) : true;
      setMusic(won ? 'victory' : 'defeat', won ? e.winner : player);
      if (won) {
        play('cheer', { volume: 1, len: 3, minGain: 1 });
        for (var k = 0; k < 6; k++) play('fireworks', { delay: 0.6 + k * 0.7, x: rnd(-20, 20), z: -55, minGain: 0.6, cooldown: 0 });
        vibrate(30);
      } else play('sadTrombone', { delay: 0.2 });
    }
  };
  function kindCrew(k) {
    var s = String(k).toLowerCase();
    if (s.indexOf('tourn') >= 0) return 'hustle';
    if (s.indexOf('drum') >= 0 || s.indexOf('circle') >= 0) return 'noise';
    if (s.indexOf('chat') >= 0 || s.indexOf('group') >= 0) return 'violets';
    if (s.indexOf('zoom') >= 0) return 'pack';
    return null;
  }
  var attached = [];
  function attach(bus, opts) {
    opts = opts || {};
    if (opts.getState) stateProvider = opts.getState;
    else if (opts.match) stateProvider = function () { return opts.match.state; };
    if (opts.player != null) player = opts.player;
    if (!bus || typeof bus.on !== 'function') return function () {};
    var subs = [];
    Object.keys(handlers).forEach(function (name) {
      var fn = function (payload) { try { handlers[name](payload || {}); } catch (e) { stats.errors++; if (W && W.console) console.warn('[audio] bus ' + name, e); } };
      bus.on(name, fn); subs.push([name, fn]);
    });
    var rec = { bus: bus, subs: subs }; attached.push(rec);
    return function detach() {
      subs.forEach(function (s) { try { if (bus.off) bus.off(s[0], s[1]); } catch (e) { /* ignore */ } });
      var i = attached.indexOf(rec); if (i >= 0) attached.splice(i, 1);
    };
  }

  // ------------------------------------------------------------- public API
  function setListener(x, z, heading, height) {
    if (x != null && !isNaN(x)) L.x = x;
    if (z != null && !isNaN(z)) L.z = z;
    if (heading != null && !isNaN(heading)) L.h = heading;
    if (height != null && !isNaN(height)) L.height = height;
    if (!ctx || !built) return;
    var t = now();
    if (t - L.lastApply < 0.05) return;
    L.lastApply = t;
    if (amb) {
      var dF = Math.sqrt(L.x * L.x + L.z * L.z), zoom = clamp((L.height - 25) / 180, 0, 1);
      amb.fount.gain.setTargetAtTime(0.2 * clamp(14 / Math.max(14, dF), 0, 1) * (1 - 0.45 * zoom), t, 0.12);
      amb.fountPan.pan.setTargetAtTime(spatial(0, 0).pan * 0.7, t, 0.12);
    }
    for (var k in loops) if (Object.prototype.hasOwnProperty.call(loops, k)) placeLoop(loops[k], false);
  }
  function setAmbience(phase, intensity) {
    if (phase != null) desired.phase = normPhase(phase);
    if (intensity != null && !isNaN(intensity)) desired.intensity = clamp(intensity, 0, 1);
    if (amb) { amb.phase = desired.phase; amb.intensity = desired.intensity; applyAmbience(false); }
    if (music) music.setNight(desired.phase === 'night');
  }
  function setMusic(state, faction) {
    desired.music = state || null; desired.musicFaction = faction != null ? (fac(faction) || faction) : desired.musicFaction;
    if (music) music.setState(desired.music, desired.musicFaction);
  }
  function setVolumes(o) {
    o = o || {};
    ['master', 'sfx', 'music', 'ambience'].forEach(function (k) { if (o[k] != null && !isNaN(o[k])) vols[k] = clamp(+o[k], 0, 1); });
    if (!built) return;
    var t = now();
    masterGain.gain.setTargetAtTime(muted ? 0 : vols.master, t, 0.05);
    sfxBus.gain.setTargetAtTime(vols.sfx, t, 0.05);
    musicBus.gain.setTargetAtTime(vols.music, t, 0.05);
    ambBus.gain.setTargetAtTime(vols.ambience, t, 0.05);
  }
  function mute(b) {
    muted = b == null ? !muted : !!b;
    if (built) masterGain.gain.setTargetAtTime(muted ? 0 : vols.master, now(), 0.05);
    return muted;
  }
  function init() {
    bindGestures();
    if (W && typeof document !== 'undefined' && !init._vis) { init._vis = true; document.addEventListener('visibilitychange', onVisibility); }
    var active = W && W.navigator && W.navigator.userActivation && W.navigator.userActivation.isActive;
    if (active || ctx) unlock();
    return A;
  }

  var A = SQ.audio = {
    silent: SILENT,   // true for playtests (see top): nothing will ever play
    init: init,
    unlock: unlock,
    setListener: setListener,
    play: play,
    setAmbience: setAmbience,
    setMusic: setMusic,
    setVolumes: setVolumes,
    getVolumes: function () { return { master: vols.master, sfx: vols.sfx, music: vols.music, ambience: vols.ambience }; },
    mute: mute,
    isMuted: function () { return muted; },
    attach: attach,
    setPlayer: function (f) { player = f; },
    setStateProvider: function (fn) { stateProvider = typeof fn === 'function' ? fn : null; },
    update: update,
    setGameInfo: setGameInfo,
    setCombat: function (x) { combat.energy = Math.max(0, +x || 0); },
    startLoop: function (key, kind, x, z) {
      var tick = { piano: pianoGuyTick, ice: iceTick, pigeon: pigeonTick, squirrel: squirrelTick }[kind];
      if (tick) startLoop(key, x, z, 0.8, tick);
    },
    stopLoop: stopLoop,
    names: function () { return Object.keys(SFX); },
    isReady: function () { return !!(ctx && built && ctx.state === 'running'); },
    stats: function () {
      prune(voices, now()); prune(ambVoices, now());
      return {
        state: ctx ? ctx.state : 'none', built: built, voices: voices.length, ambVoices: ambVoices.length,
        loops: Object.keys(loops), played: stats.played, dropped: stats.dropped, culled: stats.culled, stolen: stats.stolen,
        peakVoices: stats.peakVoices, errors: stats.errors, combat: +combat.energy.toFixed(2),
        phase: amb ? amb.phase : desired.phase, rain: amb ? amb.rain : 0, music: music ? music.debug() : null,
        listener: { x: L.x, z: L.z, h: L.h, height: L.height }, game: { held: game.held, behind: game.behind, nearWin: game.nearWin }
      };
    },
    level: function () { // RMS of the master output, for tests/meters
      if (!analyser) return 0;
      var buf = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(buf);
      var s = 0; for (var i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      return Math.sqrt(s / buf.length);
    },
    _ctx: function () { return ctx; },
    _amb: function () { return amb; },
    _bus: handlers,
    _lib: null
  };
  A._lib = {
    inst: I, mtof: mtof, rnd: rnd, pick: pick, clamp: clamp, chance: chance,
    reverb: function () { return revIn; }, sfx: function () { return sfxBus; }, noise: function (k) { return buffers[k]; }, waves: waves,
    metalHit: metalHit, G: G, F: F, O: O, N: N, perc: perc
  };
  A._lm = lmInfo;
})(typeof window !== 'undefined' ? (window.SQ = window.SQ || {}) : (globalThis.SQ = globalThis.SQ || {}));
