/* POWER CITY - the sound board.
 *
 * Two pulse voices, a triangle bass and a noise channel, which is exactly
 * what the machine this game is pretending to be had. No samples: the hits,
 * the coin, the sirens and the songs are all made out of oscillators at
 * runtime, so the whole game stays one folder of text.
 */
(function (global) {
  'use strict';
  var PC = global.PC || (global.PC = {});

  var NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

  function freq(name) {
    var s = String(name).toLowerCase();
    var semi = NOTE[s[0]];
    if (semi === undefined) return 0;
    var i = 1;
    if (s[i] === '#') { semi++; i++; } else if (s[i] === 'b') { semi--; i++; }
    var oct = parseInt(s.slice(i), 10);
    if (isNaN(oct)) oct = 4;
    return 440 * Math.pow(2, ((oct + 1) * 12 + semi - 69) / 12);
  }
  PC.noteFreq = freq;

  var A = PC.audio = {
    ctx: null, ready: false, muted: false, enabled: true,
    musicVol: 0.42, sfxVol: 0.55,
    _song: null, _row: 0, _next: 0, _timer: null, _paused: false, _waves: {},

    init: function () {
      if (this.ctx) return;
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      var c = this.ctx = new AC();

      this.master = c.createGain();
      this.master.gain.value = 0.85;

      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -12;
      this.comp.ratio.value = 8;
      this.comp.attack.value = 0.003;
      this.comp.release.value = 0.15;

      this.musicBus = c.createGain(); this.musicBus.gain.value = this.musicVol;
      this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.sfxVol;

      // A short slap echo: cheap, and it glues the square leads together the
      // way a cabinet speaker in a room does.
      this.delay = c.createDelay(0.6);
      this.delay.delayTime.value = 0.14;
      this.fb = c.createGain(); this.fb.gain.value = 0.22;
      this.echoLP = c.createBiquadFilter();
      this.echoLP.type = 'lowpass'; this.echoLP.frequency.value = 2400;
      this.echoOut = c.createGain(); this.echoOut.gain.value = 0.3;
      this.delay.connect(this.echoLP);
      this.echoLP.connect(this.fb);
      this.fb.connect(this.delay);
      this.echoLP.connect(this.echoOut);
      this.echoOut.connect(this.comp);

      this.musicBus.connect(this.comp);
      this.musicBus.connect(this.delay);
      this.sfxBus.connect(this.comp);
      this.comp.connect(this.master);
      this.master.connect(c.destination);

      // noise, one second of it, looped
      var n = c.sampleRate;
      var buf = c.createBuffer(1, n, n), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this._noise = buf;

      this.ready = true;
      var self = this;
      this._timer = setInterval(function () { self.tick(); }, 24);
    },

    resume: function () {
      if (!this.ctx) this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    toggleMute: function () {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.85;
    },

    setPaused: function (p) {
      this._paused = p;
      if (this.musicBus) this.musicBus.gain.value = p ? this.musicVol * 0.25 : this.musicVol;
    },

    // --------------------------------------------------------------- voices
    pulse: function (duty) {
      var key = 'p' + duty;
      if (this._waves[key]) return this._waves[key];
      // Fourier series for a rectangle of the given duty cycle.
      var n = 24, real = new Float32Array(n), imag = new Float32Array(n);
      for (var k = 1; k < n; k++) {
        real[k] = (2 / (k * Math.PI)) * Math.sin(Math.PI * k * duty);
        imag[k] = 0;
      }
      var w = this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
      this._waves[key] = w;
      return w;
    },

    /* One note. `o` carries the shape: wave, attack/decay, pitch slide,
     * vibrato, and which bus it lands on. */
    note: function (o) {
      if (!this.ready || !this.enabled) return;
      var c = this.ctx, t = o.at || c.currentTime;
      var dur = o.dur || 0.12;
      var bus = o.bus || this.sfxBus;
      var g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(o.vol || 0.2, t + (o.atk || 0.005));
      if (o.sustain) {
        g.gain.setValueAtTime(o.vol || 0.2, t + dur * 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      } else {
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      }
      g.connect(bus);

      var src;
      if (o.noise) {
        src = c.createBufferSource();
        src.buffer = this._noise;
        src.loop = true;
        var f = c.createBiquadFilter();
        f.type = o.filter || 'bandpass';
        f.frequency.setValueAtTime(o.freq || 1200, t);
        if (o.freq2) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.freq2), t + dur);
        f.Q.value = o.q === undefined ? 1.2 : o.q;
        src.connect(f); f.connect(g);
      } else {
        src = c.createOscillator();
        if (o.wave === 'tri') src.type = 'triangle';
        else if (o.wave === 'saw') src.type = 'sawtooth';
        else if (o.wave === 'sine') src.type = 'sine';
        else src.setPeriodicWave(this.pulse(o.duty || 0.5));
        src.frequency.setValueAtTime(o.freq, t);
        if (o.freq2) src.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq2), t + (o.slide || dur));
        if (o.vib) {
          var lfo = c.createOscillator(), la = c.createGain();
          lfo.frequency.value = o.vib;
          la.gain.value = o.vibDepth || 6;
          lfo.connect(la); la.connect(src.frequency);
          lfo.start(t); lfo.stop(t + dur + 0.02);
        }
        src.connect(g);
      }
      src.start(t);
      src.stop(t + dur + 0.03);
      return g;
    },

    // ------------------------------------------------------------------ sfx
    sfx: function (name) {
      if (!this.ready) return;
      var t = this.ctx.currentTime, v = 1;
      switch (name) {
        case 'swing':
          this.note({ noise: true, at: t, dur: 0.07, freq: 2600, freq2: 900, q: 0.9, vol: 0.13 });
          break;
        case 'swingHard':
        case 'whoosh':
          this.note({ noise: true, at: t, dur: 0.14, freq: 1800, freq2: 420, q: 0.8, vol: 0.17 });
          break;
        case 'hit':
          this.note({ noise: true, at: t, dur: 0.09, freq: 1500, freq2: 300, q: 1.4, vol: 0.3 });
          this.note({ at: t, dur: 0.07, freq: 320, freq2: 110, duty: 0.5, vol: 0.16 });
          break;
        case 'hitHeavy':
          this.note({ noise: true, at: t, dur: 0.19, freq: 1100, freq2: 150, q: 1, vol: 0.38 });
          this.note({ at: t, dur: 0.16, freq: 220, freq2: 60, wave: 'tri', vol: 0.32 });
          break;
        case 'thud':
          this.note({ noise: true, at: t, dur: 0.13, freq: 500, freq2: 90, q: 0.7, vol: 0.26 });
          this.note({ at: t, dur: 0.12, freq: 140, freq2: 50, wave: 'tri', vol: 0.24 });
          break;
        case 'crash':
          this.note({ noise: true, at: t, dur: 0.3, freq: 3200, freq2: 500, q: 0.5, vol: 0.26, filter: 'highpass' });
          break;
        case 'clank':
          this.note({ at: t, dur: 0.1, freq: 1400, freq2: 700, duty: 0.25, vol: 0.14 });
          this.note({ noise: true, at: t, dur: 0.08, freq: 4000, q: 0.6, vol: 0.1, filter: 'highpass' });
          break;
        case 'boom':
          this.note({ noise: true, at: t, dur: 0.55, freq: 900, freq2: 60, q: 0.4, vol: 0.5 });
          this.note({ at: t, dur: 0.4, freq: 160, freq2: 30, wave: 'tri', vol: 0.4 });
          break;
        case 'jump':
          this.note({ at: t, dur: 0.13, freq: 300, freq2: 720, duty: 0.25, vol: 0.14 });
          break;
        case 'grab':
          this.note({ at: t, dur: 0.09, freq: 200, freq2: 340, duty: 0.5, vol: 0.16 });
          break;
        case 'throw':
          this.note({ noise: true, at: t, dur: 0.2, freq: 2200, freq2: 300, q: 0.7, vol: 0.2 });
          this.note({ at: t + 0.02, dur: 0.14, freq: 480, freq2: 140, duty: 0.5, vol: 0.16 });
          break;
        case 'escape':
          this.note({ at: t, dur: 0.14, freq: 400, freq2: 900, duty: 0.5, vol: 0.16 });
          break;
        case 'pickup':
          this.note({ at: t, dur: 0.06, freq: freq('e5'), duty: 0.5, vol: 0.16 });
          this.note({ at: t + 0.06, dur: 0.09, freq: freq('b5'), duty: 0.5, vol: 0.16 });
          break;
        case 'heal':
          this.note({ at: t, dur: 0.08, freq: freq('c5'), duty: 0.5, vol: 0.17 });
          this.note({ at: t + 0.08, dur: 0.08, freq: freq('e5'), duty: 0.5, vol: 0.17 });
          this.note({ at: t + 0.16, dur: 0.16, freq: freq('g5'), duty: 0.5, vol: 0.17 });
          break;
        case 'coin':
          this.note({ at: t, dur: 0.07, freq: freq('b5'), duty: 0.25, vol: 0.2 });
          this.note({ at: t + 0.07, dur: 0.22, freq: freq('e6'), duty: 0.25, vol: 0.2 });
          break;
        case 'join':
          this.note({ at: t, dur: 0.09, freq: freq('c4'), duty: 0.5, vol: 0.2 });
          this.note({ at: t + 0.09, dur: 0.09, freq: freq('g4'), duty: 0.5, vol: 0.2 });
          this.note({ at: t + 0.18, dur: 0.2, freq: freq('c5'), duty: 0.5, vol: 0.2 });
          break;
        case 'ko':
          this.note({ at: t, dur: 0.3, freq: 400, freq2: 90, duty: 0.25, vol: 0.22 });
          this.note({ noise: true, at: t, dur: 0.3, freq: 900, freq2: 120, vol: 0.2 });
          break;
        case 'playerDown':
          this.note({ at: t, dur: 0.5, freq: 300, freq2: 60, wave: 'tri', vol: 0.3 });
          this.note({ at: t, dur: 0.45, freq: 320, freq2: 70, duty: 0.5, vol: 0.16 });
          break;
        case 'bossIn':
          this.note({ at: t, dur: 0.7, freq: 90, freq2: 220, wave: 'tri', vol: 0.4 });
          this.note({ noise: true, at: t, dur: 0.7, freq: 200, freq2: 1400, q: 0.8, vol: 0.2 });
          break;
        case 'bossDown':
          for (var i = 0; i < 6; i++) {
            this.note({ noise: true, at: t + i * 0.09, dur: 0.3, freq: 1200 - i * 150, freq2: 80, vol: 0.3 });
          }
          break;
        case 'tick':
          this.note({ at: t, dur: 0.05, freq: freq('a5'), duty: 0.25, vol: 0.14 });
          break;
        case 'tally':
          this.note({ at: t, dur: 0.03, freq: freq('e6'), duty: 0.25, vol: 0.1 });
          break;
        default: v = 0;
      }
      return v;
    },

    // -------------------------------------------------------------- sequencer
    play: function (name) {
      var s = PC.songs && PC.songs[name];
      if (!this.ready) { this._pendingSong = name; return; }
      if (!s) return;
      if (this._songName === name) return;
      this._songName = name;
      this._song = s;
      this._row = 0;
      this._next = this.ctx.currentTime + 0.05;
    },

    stop: function () { this._song = null; this._songName = null; },

    tick: function () {
      if (!this.ready || !this._song) return;
      var s = this._song, c = this.ctx;
      var rowDur = 60 / s.bpm / (s.div || 4);
      var ahead = c.currentTime + 0.12;
      var guard = 0;
      while (this._next < ahead && guard++ < 32) {
        this.playRow(s, this._row, this._next, rowDur);
        this._next += rowDur;
        this._row++;
        var len = s.len || (s.p1 ? s.p1.length : 16);
        if (this._row >= len) {
          if (s.loop === false) { this._song = null; this._songName = null; break; }
          this._row = 0;
        }
      }
    },

    playRow: function (s, row, at, rowDur) {
      var bus = this.musicBus;
      var n;
      // ---- lead
      if (s.p1) {
        n = s.p1[row % s.p1.length];
        if (n && n !== '.' && n !== '-') {
          this.note({
            at: at, dur: rowDur * (s.gate || 0.9), freq: freq(n), duty: s.duty1 || 0.5,
            vol: (s.vol1 || 0.16), bus: bus, atk: 0.004, vib: s.vib || 0, vibDepth: 5
          });
        }
      }
      // ---- harmony
      if (s.p2) {
        n = s.p2[row % s.p2.length];
        if (n && n !== '.' && n !== '-') {
          this.note({
            at: at, dur: rowDur * (s.gate2 || 0.85), freq: freq(n), duty: s.duty2 || 0.25,
            vol: (s.vol2 || 0.1), bus: bus, atk: 0.004
          });
        }
      }
      // ---- bass
      if (s.bass) {
        n = s.bass[row % s.bass.length];
        if (n && n !== '.' && n !== '-') {
          this.note({ at: at, dur: rowDur * 0.95, freq: freq(n), wave: 'tri', vol: s.volB || 0.3, bus: bus, atk: 0.006 });
        }
      }
      // ---- drums
      if (s.drum) {
        var d = s.drum[row % s.drum.length];
        if (d === 'k') this.note({ at: at, dur: 0.13, freq: 150, freq2: 45, wave: 'tri', vol: 0.42, bus: bus });
        else if (d === 's') this.note({ noise: true, at: at, dur: 0.13, freq: 1500, freq2: 700, q: 0.9, vol: 0.24, bus: bus });
        else if (d === 'h') this.note({ noise: true, at: at, dur: 0.045, freq: 7000, q: 0.6, vol: 0.09, bus: bus, filter: 'highpass' });
        else if (d === 'H') this.note({ noise: true, at: at, dur: 0.09, freq: 6000, q: 0.6, vol: 0.13, bus: bus, filter: 'highpass' });
      }
    }
  };

  // The browser will not make a sound until the player touches something.
  function wake() {
    A.resume();
    if (A._pendingSong) { var n = A._pendingSong; A._pendingSong = null; A.play(n); }
  }
  global.addEventListener('keydown', wake, { once: false });
  global.addEventListener('pointerdown', wake, { once: false });

})(typeof window !== 'undefined' ? window : globalThis);
