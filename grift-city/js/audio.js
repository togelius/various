// GRIFT CITY — every sound is synthesised: engine, guns, sirens, a three-station radio.
'use strict';
const AUDIO = (() => {
  let ctx = null, master, sfxBus, musicBus, engineNodes = null, sirenNodes = null, screechNodes = null, ambient = null, noiseBuf = null;
  let muted = false, radioStation = 0, radioTimer = 0, radioNextNote = 0, radioBeat = 0, radioOn = false;
  const STATIONS = ['OFF', 'NEON FM', 'GRIFT BEATS', 'STATIC 91.1'];
  function ensure() {
    if (ctx) return true;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.0; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    buildEngine(); buildSiren(); buildScreech(); buildAmbient();
    return true;
  }
  function resume() { if (ensure() && ctx.state === 'suspended') ctx.resume(); }
  const now = () => ctx.currentTime;
  function noise(dur, vol, filterType = 'bandpass', freq = 1000, q = 1, decay = null, dest = null) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, now()); g.gain.exponentialRampToValueAtTime(0.001, now() + (decay || dur));
    src.connect(f); f.connect(g); g.connect(dest || sfxBus); src.start(); src.stop(now() + dur + 0.05); return { src, f, g };
  }
  function tone(freq, dur, vol, type = 'sine', slideTo = null, dest = null) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, now()); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, now() + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, now()); g.gain.exponentialRampToValueAtTime(0.001, now() + dur);
    o.connect(g); g.connect(dest || sfxBus); o.start(); o.stop(now() + dur + 0.05); return o;
  }
  // Distance attenuation helper for world sounds: vol scaled by distance to the listener.
  let lx = 0, lz = 0; function listener(x, z) { lx = x; lz = z; }
  const att = (x, z, range) => { if (x === undefined) return 1; const d = M.dist(x, z, lx, lz); return M.clamp(1 - d / range, 0, 1) ** 1.5; };

  const SFX = {
    pistol(x, z) { const a = att(x, z, 120); if (a <= 0) return; const v = 0.85 + Math.random() * 0.3; noise(0.25, 0.9 * a, 'bandpass', 1800 * v, 0.6, 0.12); tone(160 * v, 0.12, 0.5 * a, 'square', 60); },
    uzi(x, z) { const a = att(x, z, 120); if (a <= 0) return; const v = 0.9 + Math.random() * 0.2; noise(0.12, 0.6 * a, 'bandpass', 2400 * v, 0.8, 0.07); tone(220 * v, 0.07, 0.35 * a, 'square', 90); },
    rifle(x, z) { const a = att(x, z, 150); if (a <= 0) return; const v = 0.9 + Math.random() * 0.2; noise(0.2, 0.8 * a, 'bandpass', 1500 * v, 0.7, 0.1); tone(130 * v, 0.14, 0.5 * a, 'sawtooth', 50); },
    shotgun(x, z) { const a = att(x, z, 150); if (a <= 0) return; noise(0.45, 1.2 * a, 'lowpass', 1200, 0.5, 0.3); tone(90, 0.25, 0.7 * a, 'square', 40); },
    rocket(x, z) { const a = att(x, z, 150); if (a <= 0) return; noise(0.8, 0.8 * a, 'lowpass', 600, 0.5, 0.7); tone(200, 0.6, 0.4 * a, 'sawtooth', 60); },
    explosion(x, z) { const a = att(x, z, 400); if (a <= 0) return; noise(2.2, 1.6 * a, 'lowpass', 400, 0.3, 1.8); tone(60, 1.2, 1.0 * a, 'sine', 25); noise(0.5, 0.8 * a, 'highpass', 2000, 0.5, 0.3); },
    punch(x, z) { const a = att(x, z, 40); if (a <= 0) return; noise(0.15, 0.7 * a, 'lowpass', 500, 0.5, 0.1); tone(120, 0.1, 0.3 * a, 'sine', 50); },
    hit(x, z) { const a = att(x, z, 60); if (a <= 0) return; noise(0.12, 0.5 * a, 'bandpass', 900, 1, 0.08); },
    crash(x, z, force = 1) { const a = att(x, z, 150) * M.clamp(force, 0.2, 1.5); if (a <= 0) return; noise(0.5, 0.9 * a, 'lowpass', 800, 0.5, 0.35); noise(0.3, 0.5 * a, 'highpass', 3000, 0.5, 0.2); tone(80, 0.3, 0.4 * a, 'sine', 30); },
    bump(x, z) { const a = att(x, z, 80); if (a <= 0) return; noise(0.15, 0.4 * a, 'lowpass', 400, 0.5, 0.1); },
    horn(x, z, len = 0.4) { const a = att(x, z, 150); if (a <= 0) return; tone(420, len, 0.25 * a, 'square'); tone(530, len, 0.2 * a, 'square'); },
    scream(x, z) { const a = att(x, z, 60); if (a <= 0) return; tone(700 + Math.random() * 300, 0.35, 0.15 * a, 'sawtooth', 300); },
    pickup() { tone(880, 0.12, 0.3, 'square'); setTimeout(() => ctx && tone(1320, 0.18, 0.3, 'square'), 90); },
    cash() { tone(1200, 0.08, 0.25, 'square'); setTimeout(() => ctx && tone(1600, 0.12, 0.25, 'square'), 60); },
    door(x, z) { const a = att(x, z, 30); noise(0.12, 0.4 * a, 'lowpass', 900, 0.5, 0.1); },
    missionPass() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => ctx && tone(f, 0.5, 0.3, 'triangle'), i * 120)); },
    missionFail() { [400, 300, 200].forEach((f, i) => setTimeout(() => ctx && tone(f, 0.6, 0.3, 'sawtooth'), i * 250)); },
    wasted() { tone(150, 2.5, 0.4, 'sawtooth', 40); noise(1.5, 0.3, 'lowpass', 300, 0.5, 1.2); },
    busted() { [300, 250, 200, 150].forEach((f, i) => setTimeout(() => ctx && tone(f, 0.5, 0.3, 'square'), i * 200)); },
    star() { tone(600, 0.15, 0.25, 'square'); setTimeout(() => ctx && tone(900, 0.2, 0.25, 'square'), 100); },
    click() { tone(1000, 0.04, 0.15, 'square'); },
    splash(x, z) { const a = att(x, z, 100); noise(0.6, 0.5 * a, 'lowpass', 700, 0.5, 0.5); },
    checkpoint() { tone(700, 0.1, 0.25, 'square'); setTimeout(() => ctx && tone(1050, 0.15, 0.25, 'square'), 80); },
    reload() { noise(0.08, 0.3, 'highpass', 2500, 1, 0.05); setTimeout(() => ctx && noise(0.08, 0.3, 'highpass', 1800, 1, 0.05), 120); },
    phone() { for (let i = 0; i < 3; i++) setTimeout(() => ctx && tone(1400, 0.08, 0.15, 'square'), i * 110); },
    heli(x, z, on) { /* handled by ambient loop */ },
  };
  function play(name, x, z, ...rest) { if (!ctx || muted) return; try { SFX[name](x, z, ...rest); } catch (e) { } }

  // ---- Engine: two oscillators + noise, pitched by rpm.
  function buildEngine() {
    const g = ctx.createGain(); g.gain.value = 0; g.connect(sfxBus);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 60; const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 30;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; f.Q.value = 2;
    const g1 = ctx.createGain(); g1.gain.value = 0.5; const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o1.connect(g1); o2.connect(g2); g1.connect(f); g2.connect(f); f.connect(g); o1.start(); o2.start();
    engineNodes = { g, o1, o2, f };
  }
  function engine(on, rpm, load, kind = 'sedan') { if (!ctx) return; const e = engineNodes; const t = now();
    const K = { sports: 1.35, muscle: 1.15, police: 1.1, hatch: 1.05, taxi: 1, sedan: 1, van: 0.85, pickup: 0.8, swat: 0.75, truck: 0.55, bus: 0.6, bike: 1.7, boat: 0.5 }[kind] || 1;
    e.g.gain.setTargetAtTime(on ? 0.12 + load * 0.1 : 0, t, 0.08);
    const base = (45 + rpm * 160) * K; e.o1.frequency.setTargetAtTime(base, t, 0.06); e.o2.frequency.setTargetAtTime(base * 0.5, t, 0.06); e.f.frequency.setTargetAtTime(300 + rpm * 900 + load * 400, t, 0.08); }
  function buildSiren() {
    const g = ctx.createGain(); g.gain.value = 0; g.connect(sfxBus); const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 700;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; o.connect(f); f.connect(g); o.start(); sirenNodes = { g, o, phase: 0 };
  }
  function siren(vol, dt) { if (!ctx) return; const s = sirenNodes; s.phase += dt; const hi = Math.floor(s.phase / 0.55) % 2; s.o.frequency.setTargetAtTime(hi ? 960 : 640, now(), 0.05); s.g.gain.setTargetAtTime(vol * 0.12, now(), 0.1); }
  function buildScreech() { const g = ctx.createGain(); g.gain.value = 0; g.connect(sfxBus); const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 6; src.connect(f); f.connect(g); src.start(); screechNodes = { g, f }; }
  function screech(vol) { if (!ctx) return; screechNodes.g.gain.setTargetAtTime(vol * 0.25, now(), 0.05); screechNodes.f.frequency.setTargetAtTime(1800 + vol * 800, now(), 0.1); }
  function buildAmbient() {
    const g = ctx.createGain(); g.gain.value = 0.05; g.connect(sfxBus); const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; src.connect(f); f.connect(g); src.start();
    // helicopter rotor: pulsed low noise
    const hg = ctx.createGain(); hg.gain.value = 0; hg.connect(sfxBus); const hs = ctx.createBufferSource(); hs.buffer = noiseBuf; hs.loop = true; const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 220; const lfo = ctx.createOscillator(); lfo.frequency.value = 13; const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(hg.gain); hs.connect(hf); hf.connect(hg); hs.start(); lfo.start();
    const rg = ctx.createGain(); rg.gain.value = 0; rg.connect(sfxBus); const rs = ctx.createBufferSource(); rs.buffer = noiseBuf; rs.loop = true; const rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 3200; rf.Q.value = 0.4; rs.connect(rf); rf.connect(rg); rs.start();
    ambient = { g, hg, rg, f };
  }
  function traffic(v) { if (!ctx) return; ambient.g.gain.setTargetAtTime(0.03 + v * 0.06, now(), 0.8); ambient.f.frequency.setTargetAtTime(150 + v * 120, now(), 0.8); }
  function rain(v, inCar) { if (!ctx) return; ambient.rg.gain.setTargetAtTime(v * (inCar ? 0.05 : 0.14), now(), 0.5); }
  function heliVolume(v) { if (!ctx) return; ambient.hg.gain.setTargetAtTime(v * 0.5, now(), 0.2); }

  // ---- Radio: a tiny step sequencer per station.
  const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10] };
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  function setRadio(st) { radioStation = st; radioOn = st > 0; if (ctx) musicBus.gain.setTargetAtTime(radioOn ? 0.35 : 0, now(), 0.3); radioBeat = 0; }
  function radioTick(dt, inCar) {
    if (!ctx || !radioOn) return;
    musicBus.gain.setTargetAtTime(inCar ? 0.35 : 0.08, now(), 0.5);
    radioTimer += dt; const bpm = radioStation === 1 ? 118 : radioStation === 2 ? 92 : 70; const step = 60 / bpm / 4;
    while (radioTimer >= step) {
      radioTimer -= step; const b = radioBeat++; const bar = Math.floor(b / 16), s = b % 16;
      const PROG = radioStation === 1 ? [45, 41, 48, 43, 45, 41, 50, 52] : radioStation === 2 ? [43, 43, 46, 41, 43, 43, 38, 41] : [45, 48, 43, 41]; const root = PROG[bar % PROG.length]; const lead = SCALES.minor;
      if (radioStation === 1) { // synthwave: driving 8ths bass, arps, four-on-the-floor
        if (s % 2 === 0) tone(midi(root - 12 + (s % 8 === 6 ? 3 : 0)), 0.12, 0.35, 'sawtooth', null, musicBus);
        if (s % 4 === 0) { noise(0.12, 0.6, 'lowpass', 150, 1, 0.1, musicBus); tone(90, 0.12, 0.6, 'sine', 40, musicBus); }
        if (s % 4 === 2) noise(0.06, 0.25, 'highpass', 6000, 1, 0.04, musicBus);
        const arp = lead[(b * 3) % 7] + (b % 4 === 3 ? 12 : 0); tone(midi(root + 12 + arp), 0.2, 0.1, 'square', null, musicBus);
        if (bar % 4 >= 2 && (s === 0 || s === 3 || s === 6 || s === 10 || s === 12)) { const n = lead[(bar * 5 + s * 3) % 7]; tone(midi(root + 24 + n), s === 12 ? 0.9 : 0.35, 0.09, 'triangle', null, musicBus); }
        if (s === 0) { tone(midi(root + 12), 1.6, 0.05, 'sawtooth', null, musicBus); tone(midi(root + 19), 1.6, 0.05, 'sawtooth', null, musicBus); }
      } else if (radioStation === 2) { // hip hop: kick/snare/hat, bass slides
        if (s === 0 || s === 7 || s === 10) { noise(0.15, 0.7, 'lowpass', 120, 1, 0.12, musicBus); tone(70, 0.2, 0.7, 'sine', 35, musicBus); }
        if (s === 4 || s === 12) noise(0.18, 0.5, 'bandpass', 1800, 0.8, 0.15, musicBus);
        if (s % 2 === 0) noise(0.05, 0.2, 'highpass', 8000, 1, 0.03, musicBus);
        if (s === 0 || s === 6 || s === 11) tone(midi(root - 12), 0.4, 0.4, 'triangle', midi(root - 12 + (s === 6 ? 5 : 0)), musicBus);
        if (s === 2 || s === 9 || s === 14) tone(midi(root + 12 + SCALES.dorian[(bar + s) % 7]), 0.3, 0.1, 'square', null, musicBus);
        if (bar % 2 === 1 && (s === 4 || s === 6 || s === 11)) tone(midi(root + 24 + SCALES.dorian[(bar * 3 + s) % 7]), 0.5, 0.07, 'sine', null, musicBus);
      } else { // ambient: slow pads and sparse bells
        if (s === 0) { tone(midi(root), 3.5, 0.15, 'triangle', null, musicBus); tone(midi(root + 7), 3.5, 0.1, 'sine', null, musicBus); tone(midi(root + 15), 3.0, 0.06, 'sine', null, musicBus); }
        if (s === 8 && bar % 2) tone(midi(root + 24 + SCALES.minor[bar % 7]), 1.2, 0.08, 'sine', null, musicBus);
      }
    }
  }
  function toggleMute() { muted = !muted; if (ctx) master.gain.setTargetAtTime(muted ? 0 : 0.8, now(), 0.05); return muted; }
  return { ensure, resume, play, engine, siren, screech, heliVolume, rain, traffic, radioTick, setRadio, get radioStation() { return radioStation; }, STATIONS, toggleMute, get muted() { return muted; }, listener, get ready() { return !!ctx; } };
})();
