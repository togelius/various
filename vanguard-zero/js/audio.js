/* VANGUARD ZERO - synth, tracker and SFX.
 *
 * Everything is generated with WebAudio primitives; no samples are loaded.
 * The signal chain deliberately mimics the SNES S-DSP: dry voices sum into a
 * feedback delay with a lowpass in the loop, which is what gives 16-bit game
 * music that characteristic wet, slightly muffled tail.
 */
(function (global) {
  'use strict';
  var VZ = global.VZ || (global.VZ = {});

  var NOTE_BASE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

  function noteToFreq(name) {
    // "C4" | "D#5" | "Bb3"
    var s = String(name).toLowerCase();
    var semi = NOTE_BASE[s[0]];
    if (semi === undefined) return 0;
    var i = 1;
    if (s[i] === '#') { semi++; i++; }
    else if (s[i] === 'b') { semi--; i++; }
    var oct = parseInt(s.slice(i), 10);
    if (isNaN(oct)) oct = 4;
    var midi = (oct + 1) * 12 + semi;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  var Audio = VZ.audio = {
    ctx: null,
    ready: false,
    enabled: true,
    musicVol: 0.55,
    sfxVol: 0.7,
    _pulseWaves: {},
    _noiseBuf: null,
    _song: null,
    _nextSong: null,
    _row: 0,
    _nextRowTime: 0,
    _timer: null,
    _chanState: [],
    _muted: false,

    init: function () {
      if (this.ctx) return;
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      var ctx = this.ctx = new AC();

      // --- master chain -----------------------------------------------------
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;

      // Gentle limiter so stacked voices + echo never clip.
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -10;
      this.comp.knee.value = 12;
      this.comp.ratio.value = 6;
      this.comp.attack.value = 0.004;
      this.comp.release.value = 0.16;

      // --- echo unit (the "SNES reverb") ------------------------------------
      this.echoSend = ctx.createGain();
      this.echoSend.gain.value = 1;
      this.delay = ctx.createDelay(1.0);
      this.delay.delayTime.value = 0.135;
      this.fb = ctx.createGain();
      this.fb.gain.value = 0.34;
      this.echoLP = ctx.createBiquadFilter();
      this.echoLP.type = 'lowpass';
      this.echoLP.frequency.value = 2600;
      this.echoHP = ctx.createBiquadFilter();
      this.echoHP.type = 'highpass';
      this.echoHP.frequency.value = 220;
      this.echoOut = ctx.createGain();
      this.echoOut.gain.value = 0.42;

      this.echoSend.connect(this.delay);
      this.delay.connect(this.echoLP);
      this.echoLP.connect(this.echoHP);
      this.echoHP.connect(this.fb);
      this.fb.connect(this.delay);      // feedback loop
      this.echoHP.connect(this.echoOut);
      this.echoOut.connect(this.comp);

      // --- busses -----------------------------------------------------------
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.musicVol;
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = this.sfxVol;

      this.musicBus.connect(this.comp);
      this.musicBus.connect(this.echoSend);
      this.sfxBus.connect(this.comp);
      var sfxEcho = ctx.createGain();
      sfxEcho.gain.value = 0.35;        // SFX get a touch of the same room
      this.sfxBus.connect(sfxEcho);
      sfxEcho.connect(this.echoSend);

      this.comp.connect(this.master);
      this.master.connect(ctx.destination);

      // --- wavetables -------------------------------------------------------
      [0.125, 0.25, 0.5].forEach(function (d) {
        Audio._pulseWaves[d] = Audio._makePulse(d);
      });

      // --- noise ------------------------------------------------------------
      var len = Math.floor(ctx.sampleRate * 0.5);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      // LFSR noise, closer to a real chip than Math.random white noise.
      var reg = 0x7fff;
      for (var i = 0; i < len; i++) {
        var bit = ((reg ^ (reg >> 1)) & 1);
        reg = (reg >> 1) | (bit << 14);
        data[i] = (reg & 1) ? 0.85 : -0.85;
      }
      this._noiseBuf = buf;

      this.ready = true;
    },

    _makePulse: function (duty) {
      var n = 42, real = new Float32Array(n), imag = new Float32Array(n);
      for (var i = 1; i < n; i++) {
        // Fourier coefficients of a rectangular pulse of the given duty cycle.
        imag[i] = (2 / (i * Math.PI)) * Math.sin(Math.PI * i * duty);
      }
      return this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    },

    resume: function () {
      if (!this.ctx) this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    setMusicVol: function (v) {
      this.musicVol = v;
      if (this.musicBus) this.musicBus.gain.value = this._muted ? 0 : v;
    },
    setSfxVol: function (v) {
      this.sfxVol = v;
      if (this.sfxBus) this.sfxBus.gain.value = this._muted ? 0 : v;
    },
    toggleMute: function () {
      this._muted = !this._muted;
      if (this.master) this.master.gain.value = this._muted ? 0 : 0.9;
      return this._muted;
    },

    // ------------------------------------------------------------- one voice
    /* opts: wave 'pulse12'|'pulse25'|'pulse50'|'tri'|'saw'|'sine'|'noise'
     *       freq, time, dur, vol, attack, decay, sustain, release,
     *       vibrato {rate,depth,delay}, slide {to,time}, filter {type,freq,q},
     *       bus (defaults to music) */
    voice: function (o) {
      if (!this.ready || !this.enabled) return null;
      var ctx = this.ctx, t = o.time !== undefined ? o.time : ctx.currentTime;
      var dur = o.dur !== undefined ? o.dur : 0.2;
      var bus = o.bus || this.musicBus;
      var src, gain = ctx.createGain();
      var vol = (o.vol !== undefined ? o.vol : 0.3);

      if (o.wave === 'noise') {
        src = ctx.createBufferSource();
        src.buffer = this._noiseBuf;
        src.loop = true;
        src.playbackRate.value = o.rate !== undefined ? o.rate : 1;
        if (o.rateTo !== undefined) {
          src.playbackRate.exponentialRampToValueAtTime(Math.max(0.01, o.rateTo), t + dur);
        }
      } else {
        src = ctx.createOscillator();
        if (o.wave === 'tri') src.type = 'triangle';
        else if (o.wave === 'saw') src.type = 'sawtooth';
        else if (o.wave === 'sine') src.type = 'sine';
        else if (o.wave === 'square') src.type = 'square';
        else {
          var duty = o.wave === 'pulse12' ? 0.125 : (o.wave === 'pulse25' ? 0.25 : 0.5);
          src.setPeriodicWave(this._pulseWaves[duty]);
        }
        var f = Math.max(1, o.freq || 440);
        src.frequency.setValueAtTime(f, t);
        if (o.slide) {
          src.frequency.exponentialRampToValueAtTime(
            Math.max(1, o.slide.to), t + (o.slide.time || dur));
        }
        if (o.vibrato && o.vibrato.depth) {
          var lfo = ctx.createOscillator();
          var lg = ctx.createGain();
          lfo.frequency.value = o.vibrato.rate || 6;
          lg.gain.setValueAtTime(0, t);
          lg.gain.setValueAtTime(0, t + (o.vibrato.delay || 0));
          lg.gain.linearRampToValueAtTime(o.vibrato.depth, t + (o.vibrato.delay || 0) + 0.09);
          lfo.connect(lg); lg.connect(src.frequency);
          lfo.start(t); lfo.stop(t + dur + 0.4);
        }
      }

      var node = src;
      if (o.filter) {
        var flt = ctx.createBiquadFilter();
        flt.type = o.filter.type || 'lowpass';
        flt.frequency.setValueAtTime(o.filter.freq || 1200, t);
        if (o.filter.to) flt.frequency.exponentialRampToValueAtTime(Math.max(20, o.filter.to), t + dur);
        flt.Q.value = o.filter.q || 1;
        node.connect(flt); node = flt;
      }
      node.connect(gain);
      gain.connect(bus);

      // ADSR
      var a = o.attack !== undefined ? o.attack : 0.005;
      var d = o.decay !== undefined ? o.decay : 0.04;
      var s = o.sustain !== undefined ? o.sustain : 0.7;
      var r = o.release !== undefined ? o.release : 0.06;
      var g = gain.gain;
      g.setValueAtTime(0.0001, t);
      g.linearRampToValueAtTime(vol, t + a);
      g.linearRampToValueAtTime(Math.max(0.0001, vol * s), t + a + d);
      var endHold = Math.max(t + a + d, t + dur);
      g.setValueAtTime(Math.max(0.0001, vol * s), endHold);
      g.exponentialRampToValueAtTime(0.0001, endHold + r);

      src.start(t);
      src.stop(endHold + r + 0.02);
      return { src: src, gain: gain, end: endHold + r };
    },

    // ------------------------------------------------------------------- SFX
    sfx: function (name, opts) {
      if (!this.ready || !this.enabled) return;
      opts = opts || {};
      var t = this.ctx.currentTime + 0.001;
      var bus = this.sfxBus;
      var v = opts.vol !== undefined ? opts.vol : 1;
      var S = this;

      switch (name) {
        case 'shoot':
          S.voice({ wave: 'pulse25', freq: 900, slide: { to: 260, time: 0.09 }, dur: 0.06, vol: 0.16 * v, attack: 0.001, decay: 0.03, sustain: 0.2, release: 0.05, bus: bus });
          S.voice({ wave: 'noise', rate: 2.2, rateTo: 0.7, dur: 0.04, vol: 0.07 * v, attack: 0.001, decay: 0.02, sustain: 0.1, release: 0.04, filter: { type: 'highpass', freq: 1400 }, bus: bus });
          break;
        case 'chargeShot':
          S.voice({ wave: 'saw', freq: 420, slide: { to: 130, time: 0.28 }, dur: 0.24, vol: 0.2 * v, attack: 0.002, decay: 0.1, sustain: 0.5, release: 0.16, filter: { type: 'lowpass', freq: 3400, to: 700, q: 6 }, bus: bus });
          S.voice({ wave: 'pulse12', freq: 840, slide: { to: 200, time: 0.26 }, dur: 0.2, vol: 0.13 * v, attack: 0.002, decay: 0.08, sustain: 0.4, release: 0.14, bus: bus });
          S.voice({ wave: 'noise', rate: 1.4, rateTo: 0.35, dur: 0.18, vol: 0.11 * v, attack: 0.002, decay: 0.1, sustain: 0.3, release: 0.14, filter: { type: 'bandpass', freq: 900, q: 1.2 }, bus: bus });
          break;
        case 'charging':
          S.voice({ wave: 'pulse12', freq: 180, slide: { to: 660, time: 0.5 }, dur: 0.42, vol: 0.05 * v, attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.1, bus: bus });
          break;
        case 'chargeReady':
          S.voice({ wave: 'pulse25', freq: 1180, dur: 0.05, vol: 0.09 * v, attack: 0.002, decay: 0.03, sustain: 0.3, release: 0.05, bus: bus });
          S.voice({ wave: 'pulse25', freq: 1560, time: t + 0.055, dur: 0.06, vol: 0.09 * v, attack: 0.002, decay: 0.03, sustain: 0.3, release: 0.06, bus: bus });
          break;
        case 'jump':
          S.voice({ wave: 'pulse50', freq: 300, slide: { to: 720, time: 0.1 }, dur: 0.07, vol: 0.13 * v, attack: 0.002, decay: 0.05, sustain: 0.4, release: 0.05, bus: bus });
          break;
        case 'dash':
          S.voice({ wave: 'noise', rate: 0.5, rateTo: 2.6, dur: 0.14, vol: 0.15 * v, attack: 0.005, decay: 0.06, sustain: 0.4, release: 0.09, filter: { type: 'bandpass', freq: 700, to: 2600, q: 1.4 }, bus: bus });
          S.voice({ wave: 'pulse12', freq: 220, slide: { to: 520, time: 0.13 }, dur: 0.1, vol: 0.07 * v, attack: 0.004, decay: 0.05, sustain: 0.3, release: 0.07, bus: bus });
          break;
        case 'land':
          S.voice({ wave: 'noise', rate: 0.9, rateTo: 0.3, dur: 0.05, vol: 0.1 * v, attack: 0.001, decay: 0.03, sustain: 0.2, release: 0.05, filter: { type: 'lowpass', freq: 1400 }, bus: bus });
          break;
        case 'wall':
          S.voice({ wave: 'noise', rate: 1.6, rateTo: 1.1, dur: 0.05, vol: 0.06 * v, attack: 0.002, decay: 0.03, sustain: 0.3, release: 0.04, filter: { type: 'highpass', freq: 2200 }, bus: bus });
          break;
        case 'hit':
          S.voice({ wave: 'noise', rate: 1.8, rateTo: 0.6, dur: 0.05, vol: 0.14 * v, attack: 0.001, decay: 0.03, sustain: 0.2, release: 0.05, filter: { type: 'bandpass', freq: 2200, q: 0.9 }, bus: bus });
          S.voice({ wave: 'pulse50', freq: 620, slide: { to: 300, time: 0.06 }, dur: 0.04, vol: 0.08 * v, attack: 0.001, decay: 0.02, sustain: 0.2, release: 0.04, bus: bus });
          break;
        case 'deflect':
          S.voice({ wave: 'pulse25', freq: 1500, slide: { to: 900, time: 0.07 }, dur: 0.05, vol: 0.11 * v, attack: 0.001, decay: 0.03, sustain: 0.2, release: 0.06, bus: bus });
          break;
        case 'explode':
          S.voice({ wave: 'noise', rate: 1.1, rateTo: 0.18, dur: 0.3, vol: 0.26 * v, attack: 0.002, decay: 0.14, sustain: 0.35, release: 0.28, filter: { type: 'lowpass', freq: 2600, to: 260, q: 1.1 }, bus: bus });
          S.voice({ wave: 'tri', freq: 180, slide: { to: 44, time: 0.3 }, dur: 0.24, vol: 0.2 * v, attack: 0.002, decay: 0.1, sustain: 0.4, release: 0.2, bus: bus });
          break;
        case 'bigExplode':
          for (var i = 0; i < 4; i++) {
            S.voice({ wave: 'noise', time: t + i * 0.075, rate: 1.4 - i * 0.2, rateTo: 0.15, dur: 0.4, vol: (0.26 - i * 0.03) * v, attack: 0.003, decay: 0.2, sustain: 0.4, release: 0.4, filter: { type: 'lowpass', freq: 3000 - i * 500, to: 200, q: 1 }, bus: bus });
          }
          S.voice({ wave: 'tri', freq: 130, slide: { to: 28, time: 0.7 }, dur: 0.6, vol: 0.26 * v, attack: 0.004, decay: 0.3, sustain: 0.5, release: 0.4, bus: bus });
          break;
        case 'hurt':
          S.voice({ wave: 'pulse12', freq: 420, slide: { to: 120, time: 0.24 }, dur: 0.2, vol: 0.2 * v, attack: 0.002, decay: 0.1, sustain: 0.4, release: 0.14, bus: bus });
          S.voice({ wave: 'noise', rate: 0.9, rateTo: 0.3, dur: 0.16, vol: 0.11 * v, attack: 0.002, decay: 0.08, sustain: 0.3, release: 0.12, filter: { type: 'lowpass', freq: 1600 }, bus: bus });
          break;
        case 'pickup':
          S.voice({ wave: 'pulse25', freq: 880, dur: 0.05, vol: 0.13 * v, attack: 0.002, decay: 0.03, sustain: 0.4, release: 0.05, bus: bus });
          S.voice({ wave: 'pulse25', freq: 1320, time: t + 0.06, dur: 0.09, vol: 0.13 * v, attack: 0.002, decay: 0.04, sustain: 0.4, release: 0.08, bus: bus });
          break;
        case 'health':
          [660, 880, 1100, 1320].forEach(function (f, i) {
            S.voice({ wave: 'pulse50', freq: f, time: t + i * 0.045, dur: 0.05, vol: 0.1 * v, attack: 0.002, decay: 0.03, sustain: 0.4, release: 0.06, bus: bus });
          });
          break;
        case 'checkpoint':
          [523, 659, 784, 1047].forEach(function (f, i) {
            S.voice({ wave: 'pulse25', freq: f, time: t + i * 0.08, dur: 0.1, vol: 0.13 * v, attack: 0.003, decay: 0.05, sustain: 0.5, release: 0.16, bus: bus });
          });
          break;
        case 'menu':
          S.voice({ wave: 'pulse25', freq: 720, dur: 0.03, vol: 0.1 * v, attack: 0.001, decay: 0.02, sustain: 0.3, release: 0.04, bus: bus });
          break;
        case 'confirm':
          S.voice({ wave: 'pulse25', freq: 620, dur: 0.04, vol: 0.13 * v, attack: 0.002, decay: 0.02, sustain: 0.4, release: 0.05, bus: bus });
          S.voice({ wave: 'pulse25', freq: 930, time: t + 0.05, dur: 0.11, vol: 0.13 * v, attack: 0.002, decay: 0.03, sustain: 0.4, release: 0.1, bus: bus });
          break;
        case 'deny':
          S.voice({ wave: 'pulse12', freq: 260, slide: { to: 150, time: 0.12 }, dur: 0.1, vol: 0.12 * v, attack: 0.002, decay: 0.05, sustain: 0.4, release: 0.08, bus: bus });
          break;
        case 'door':
          S.voice({ wave: 'noise', rate: 0.4, rateTo: 0.9, dur: 0.5, vol: 0.11 * v, attack: 0.08, decay: 0.2, sustain: 0.5, release: 0.2, filter: { type: 'lowpass', freq: 500, to: 1500 }, bus: bus });
          break;
        case 'bossAlarm':
          for (var k = 0; k < 3; k++) {
            S.voice({ wave: 'pulse50', freq: 520, time: t + k * 0.26, slide: { to: 760, time: 0.12 }, dur: 0.12, vol: 0.15 * v, attack: 0.01, decay: 0.05, sustain: 0.6, release: 0.1, bus: bus });
          }
          break;
        case 'laser':
          S.voice({ wave: 'saw', freq: 160, slide: { to: 90, time: 0.4 }, dur: 0.35, vol: 0.13 * v, attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.15, filter: { type: 'bandpass', freq: 1100, q: 3 }, bus: bus });
          break;
        case 'warn':
          S.voice({ wave: 'pulse12', freq: 1400, dur: 0.05, vol: 0.1 * v, attack: 0.001, decay: 0.03, sustain: 0.3, release: 0.04, bus: bus });
          break;
        case 'stomp':
          S.voice({ wave: 'tri', freq: 90, slide: { to: 34, time: 0.24 }, dur: 0.2, vol: 0.28 * v, attack: 0.002, decay: 0.1, sustain: 0.4, release: 0.2, bus: bus });
          S.voice({ wave: 'noise', rate: 0.5, rateTo: 0.15, dur: 0.22, vol: 0.16 * v, attack: 0.002, decay: 0.1, sustain: 0.3, release: 0.2, filter: { type: 'lowpass', freq: 900 }, bus: bus });
          break;
      }
    },

    // --------------------------------------------------------------- tracker
    /* Song format:
     *   { bpm, rowsPerBeat, loop: rowIndex, channels: [
     *       { inst: 'lead', vol: 1, pan: 0, rows: "c4 . e4 . g4 _ . ." }
     *   ] }
     * Row tokens: '.' hold, '_' note-off, or a note name. Tokens are
     * whitespace-separated; '|' is allowed as a bar separator and ignored.
     */
    INSTRUMENTS: {
      lead:   { wave: 'pulse25', vol: 0.20, attack: 0.004, decay: 0.06, sustain: 0.62, release: 0.09, vibrato: { rate: 6.5, depth: 5, delay: 0.14 } },
      lead2:  { wave: 'pulse12', vol: 0.16, attack: 0.003, decay: 0.05, sustain: 0.55, release: 0.08, vibrato: { rate: 7, depth: 4, delay: 0.12 } },
      soft:   { wave: 'pulse50', vol: 0.13, attack: 0.02, decay: 0.09, sustain: 0.6, release: 0.14 },
      bass:   { wave: 'tri', vol: 0.34, attack: 0.004, decay: 0.07, sustain: 0.75, release: 0.06, octave: 0 },
      bassS:  { wave: 'saw', vol: 0.17, attack: 0.004, decay: 0.09, sustain: 0.6, release: 0.06, filter: { type: 'lowpass', freq: 700, q: 3 } },
      arp:    { wave: 'pulse12', vol: 0.10, attack: 0.002, decay: 0.03, sustain: 0.35, release: 0.04 },
      pad:    { wave: 'saw', vol: 0.075, attack: 0.09, decay: 0.2, sustain: 0.75, release: 0.4, filter: { type: 'lowpass', freq: 1500, q: 1 } },
      bell:   { wave: 'sine', vol: 0.17, attack: 0.002, decay: 0.22, sustain: 0.14, release: 0.3 },
      organ:  { wave: 'square', vol: 0.10, attack: 0.01, decay: 0.05, sustain: 0.7, release: 0.1 }
    },

    DRUMS: {
      k: function (t, bus, v) { // kick
        Audio.voice({ wave: 'sine', freq: 150, slide: { to: 44, time: 0.09 }, time: t, dur: 0.1, vol: 0.42 * v, attack: 0.001, decay: 0.06, sustain: 0.25, release: 0.09, bus: bus });
        Audio.voice({ wave: 'noise', rate: 0.6, rateTo: 0.2, time: t, dur: 0.02, vol: 0.1 * v, attack: 0.001, decay: 0.01, sustain: 0.1, release: 0.03, filter: { type: 'lowpass', freq: 900 }, bus: bus });
      },
      s: function (t, bus, v) { // snare
        Audio.voice({ wave: 'noise', rate: 1.5, rateTo: 1.0, time: t, dur: 0.07, vol: 0.24 * v, attack: 0.001, decay: 0.05, sustain: 0.25, release: 0.09, filter: { type: 'bandpass', freq: 1900, q: 0.8 }, bus: bus });
        Audio.voice({ wave: 'tri', freq: 260, slide: { to: 170, time: 0.07 }, time: t, dur: 0.05, vol: 0.13 * v, attack: 0.001, decay: 0.03, sustain: 0.2, release: 0.06, bus: bus });
      },
      h: function (t, bus, v) { // closed hat
        Audio.voice({ wave: 'noise', rate: 2.6, time: t, dur: 0.018, vol: 0.085 * v, attack: 0.001, decay: 0.012, sustain: 0.1, release: 0.03, filter: { type: 'highpass', freq: 6500 }, bus: bus });
      },
      H: function (t, bus, v) { // open hat
        Audio.voice({ wave: 'noise', rate: 2.4, time: t, dur: 0.1, vol: 0.09 * v, attack: 0.001, decay: 0.07, sustain: 0.2, release: 0.11, filter: { type: 'highpass', freq: 5200 }, bus: bus });
      },
      t: function (t, bus, v) { // tom
        Audio.voice({ wave: 'sine', freq: 260, slide: { to: 120, time: 0.14 }, time: t, dur: 0.12, vol: 0.22 * v, attack: 0.001, decay: 0.08, sustain: 0.3, release: 0.1, bus: bus });
      },
      c: function (t, bus, v) { // crash
        Audio.voice({ wave: 'noise', rate: 1.8, rateTo: 1.1, time: t, dur: 0.4, vol: 0.13 * v, attack: 0.002, decay: 0.3, sustain: 0.25, release: 0.4, filter: { type: 'highpass', freq: 3400 }, bus: bus });
      }
    },

    _tokenize: function (str) {
      return String(str).replace(/\|/g, ' ').trim().split(/\s+/);
    },

    playSong: function (song, opts) {
      opts = opts || {};
      if (!this.ready || !this.enabled) return;
      if (this._song === song && !opts.restart) return;
      this.stopSong();
      if (!song) return;
      this._song = song;
      this._row = 0;
      this._chanState = song.channels.map(function (c) {
        return { tokens: Audio._tokenize(c.rows), last: null };
      });
      this._rowLen = 60 / (song.bpm * (song.rowsPerBeat || 4));
      this._nextRowTime = this.ctx.currentTime + 0.06;
      var self = this;
      this._timer = setInterval(function () { self._schedule(); }, 22);
      this._schedule();
    },

    stopSong: function () {
      if (this._timer) { clearInterval(this._timer); this._timer = null; }
      this._song = null;
    },

    // Ramps the music bus down, swaps songs, ramps back up.
    fadeToSong: function (song, seconds) {
      if (!this.ready) return;
      var self = this;
      seconds = seconds || 0.5;
      if (!this._song) { this.playSong(song); return; }
      var g = this.musicBus.gain, now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0.0001, now + seconds);
      setTimeout(function () {
        self.playSong(song, { restart: true });
        var n = self.ctx.currentTime;
        g.cancelScheduledValues(n);
        g.setValueAtTime(0.0001, n);
        g.linearRampToValueAtTime(self._muted ? 0 : self.musicVol, n + seconds * 0.8);
      }, seconds * 1000);
    },

    _schedule: function () {
      var song = this._song;
      if (!song) return;
      var horizon = this.ctx.currentTime + 0.14;
      var guard = 0;
      while (this._nextRowTime < horizon && guard++ < 64) {
        this._playRow(this._row, this._nextRowTime);
        this._nextRowTime += this._rowLen;
        this._row++;
        var len = this._chanState[0] ? this._chanState[0].tokens.length : 0;
        for (var i = 1; i < this._chanState.length; i++) {
          len = Math.max(len, this._chanState[i].tokens.length);
        }
        if (this._row >= len) this._row = song.loop || 0;
      }
    },

    _playRow: function (row, time) {
      var song = this._song;
      for (var ci = 0; ci < song.channels.length; ci++) {
        var ch = song.channels[ci];
        var st = this._chanState[ci];
        var tok = st.tokens[row % st.tokens.length];
        if (!tok || tok === '.') continue;
        if (tok === '_') continue;
        var chVol = ch.vol !== undefined ? ch.vol : 1;

        if (ch.inst === 'drums') {
          var d = this.DRUMS[tok];
          if (d) d(time, this.musicBus, chVol);
          continue;
        }
        var inst = this.INSTRUMENTS[ch.inst] || this.INSTRUMENTS.lead;
        var freq = noteToFreq(tok);
        if (!freq) continue;
        if (ch.octave) freq *= Math.pow(2, ch.octave);

        // Note length: hold until the next non-'.' token (so '.' sustains).
        var len = 1;
        for (var k = row + 1; k < row + 33; k++) {
          var nt = st.tokens[k % st.tokens.length];
          if (nt === '.') len++; else break;
        }
        var dur = len * this._rowLen * (ch.legato ? 0.99 : 0.86);

        this.voice({
          wave: inst.wave, freq: freq, time: time, dur: dur,
          vol: inst.vol * chVol,
          attack: inst.attack, decay: inst.decay, sustain: inst.sustain, release: inst.release,
          vibrato: inst.vibrato, filter: inst.filter,
          bus: this.musicBus
        });
      }
    }
  };

  VZ.noteToFreq = noteToFreq;

})(typeof window !== 'undefined' ? window : globalThis);
