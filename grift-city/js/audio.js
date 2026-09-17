// GRIFT CITY — every sound is synthesised, but not with a beeper: layered noise and oscillators through filters,
// envelopes with real attacks, a convolution reverb and a compressor on the mix, an engine with gears and an exhaust
// pulse, a siren that wails, footsteps, birds by the parks, gulls by the water, and a radio with pads, bass and drums.
'use strict';
const AUDIO = (() => {
  let ctx = null, master, comp, sfxBus, musicBus, revBus, engineNodes = null, sirenNodes = null, screechNodes = null, ambient = null, noiseBuf = null, analyser = null;
  let muted = false, radioStation = 0, radioTimer = 0, radioBeat = 0, radioOn = false, birdT = 3, gullT = 5;
  const STATIONS = ['OFF', 'NEON FM', 'GRIFT BEATS', 'STATIC 91.1'];
  function ensure() {
    if (ctx) return true;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; comp.connect(master); master.connect(ctx.destination);
    analyser = ctx.createAnalyser(); analyser.fftSize = 1024; master.connect(analyser);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.0; const mHi = ctx.createBiquadFilter(); mHi.type = 'highpass'; mHi.frequency.value = 110; const mLo = ctx.createBiquadFilter(); mLo.type = 'lowpass'; mLo.frequency.value = 7000; musicBus.connect(mHi); mHi.connect(mLo); mLo.connect(comp); // a car radio has no sub and no air
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // reverb: a stereo impulse of decaying noise, fed from a send on the sound bus
    const irLen = Math.floor(ctx.sampleRate * 1.7); const ir = ctx.createBuffer(2, irLen, ctx.sampleRate); for (let ch = 0; ch < 2; ch++) { const o = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < irLen; i++) { const t = i / irLen; const w = (Math.random() * 2 - 1); lp += (w - lp) * 0.25; o[i] = lp * Math.pow(1 - t, 2.6) * (i < 200 ? i / 200 : 1); } }
    const conv = ctx.createConvolver(); conv.buffer = ir; revBus = ctx.createGain(); revBus.gain.value = 0.22; sfxBus.connect(revBus); revBus.connect(conv); conv.connect(comp);
    const mrev = ctx.createGain(); mrev.gain.value = 0.12; mLo.connect(mrev); mrev.connect(conv);
    buildEngine(); buildSiren(); buildScreech(); buildAmbient();
    return true;
  }
  function resume() { if (ensure() && ctx.state === 'suspended') ctx.resume(); }
  const now = () => ctx.currentTime;
  // an envelope with a real attack: linear up, exponential down
  function env(g, vol, attack, decay, t0 = now()) { g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay); }
  function noise(dur, vol, filterType = 'bandpass', freq = 1000, q = 1, decay = null, dest = null, attack = 0.004, sweepTo = null) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.setValueAtTime(freq, now()); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, now() + dur); f.Q.value = q;
    const g = ctx.createGain(); env(g, vol, attack, decay || dur);
    src.connect(f); f.connect(g); g.connect(dest || sfxBus); src.start(); src.stop(now() + attack + (decay || dur) + 0.05); return { src, f, g };
  }
  function tone(freq, dur, vol, type = 'sine', slideTo = null, dest = null, attack = 0.005, detune = 0) {
    const o = ctx.createOscillator(); o.type = type; o.detune.value = detune; o.frequency.setValueAtTime(freq, now()); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, now() + dur);
    const g = ctx.createGain(); env(g, vol, attack, dur);
    o.connect(g); g.connect(dest || sfxBus); o.start(); o.stop(now() + attack + dur + 0.05); return o;
  }
  // a bell: a sine with two decaying partials, for the interface
  function bell(freq, dur, vol, dest = null) { tone(freq, dur, vol, 'sine', null, dest, 0.003); tone(freq * 2.5, dur * 0.45, vol * 0.25, 'sine', null, dest, 0.002); tone(freq * 4.1, dur * 0.25, vol * 0.1, 'sine', null, dest, 0.002); }
  const later = (ms, f) => setTimeout(() => { if (ctx && !muted) f(); }, ms);
  // Distance attenuation helper for world sounds: vol scaled by distance to the listener.
  let lx = 0, lz = 0; function listener(x, z) { lx = x; lz = z; }
  const att = (x, z, range) => { if (x === undefined) return 1; const d = M.dist(x, z, lx, lz); return M.clamp(1 - d / range, 0, 1) ** 1.5; };
  // a gunshot in four layers: the crack, the body, the thump under it, and the tail the street gives back
  function shot(a, body, crack, thump, tail, tailFreq = 500) {
    noise(0.012, crack * a, 'highpass', 3000, 0.7, 0.012, null, 0.001);
    noise(0.22, body * a, 'bandpass', 520 + Math.random() * 120, 0.6, 0.14, null, 0.002);
    tone(95, 0.16, thump * a, 'sine', 38, null, 0.002);
    noise(0.7, tail * a, 'lowpass', tailFreq, 0.5, 0.55, null, 0.02);
  }

  const SFX = {
    flap(x, z) { const a = att(x, z, 45); if (a <= 0) return; noise(0.22, 0.25 * a, 'bandpass', 700, 0.7, 0.05); noise(0.16, 0.18 * a, 'bandpass', 1100, 0.7, 0.04); },
    pistol(x, z) { const a = att(x, z, 140); if (a <= 0) return; shot(a, 0.9, 0.7, 0.55, 0.3); },
    uzi(x, z) { const a = att(x, z, 130); if (a <= 0) return; noise(0.01, 0.5 * a, 'highpass', 3500, 0.7, 0.01, null, 0.001); noise(0.1, 0.55 * a, 'bandpass', 900 + Math.random() * 200, 0.7, 0.07, null, 0.002); tone(120, 0.07, 0.3 * a, 'sine', 50, null, 0.002); },
    rifle(x, z) { const a = att(x, z, 170); if (a <= 0) return; shot(a, 1.0, 0.8, 0.6, 0.45, 420); },
    shotgun(x, z) { const a = att(x, z, 170); if (a <= 0) return; noise(0.015, 0.7 * a, 'highpass', 2500, 0.7, 0.015, null, 0.001); noise(0.35, 1.2 * a, 'lowpass', 900, 0.5, 0.25, null, 0.003); tone(70, 0.28, 0.8 * a, 'sine', 30, null, 0.002); noise(1.0, 0.5 * a, 'lowpass', 350, 0.5, 0.8, null, 0.03); },
    rocket(x, z) { const a = att(x, z, 170); if (a <= 0) return; noise(0.9, 0.8 * a, 'bandpass', 300, 0.8, 0.8, null, 0.02, 1800); tone(180, 0.5, 0.35 * a, 'sawtooth', 60, null, 0.01); noise(0.4, 0.5 * a, 'lowpass', 300, 0.5, 0.35, null, 0.005); },
    explosion(x, z) { const a = att(x, z, 420); if (a <= 0) return; tone(55, 1.6, 1.0 * a, 'sine', 22, null, 0.004); noise(2.6, 1.5 * a, 'lowpass', 380, 0.4, 2.2, null, 0.01); noise(0.35, 0.7 * a, 'highpass', 1800, 0.5, 0.25, null, 0.002); for (let k = 0; k < 7; k++) later(120 + k * 90 + Math.random() * 60, () => noise(0.05, 0.25 * a, 'bandpass', 700 + Math.random() * 1500, 2, 0.04)); },
    punch(x, z) { const a = att(x, z, 40); if (a <= 0) return; noise(0.1, 0.6 * a, 'lowpass', 320, 0.7, 0.08, null, 0.002); tone(110, 0.12, 0.35 * a, 'sine', 45, null, 0.002); },
    hit(x, z) { const a = att(x, z, 60); if (a <= 0) return; noise(0.1, 0.45 * a, 'bandpass', 700, 1.2, 0.07, null, 0.002); tone(180, 0.06, 0.15 * a, 'sine', 90); },
    crash(x, z, force = 1) { const a = att(x, z, 160) * M.clamp(force, 0.2, 1.5); if (a <= 0) return; noise(0.45, 0.8 * a, 'lowpass', 700, 0.6, 0.3, null, 0.003); noise(0.25, 0.45 * a, 'bandpass', 1400, 2.5, 0.2, null, 0.002); tone(75, 0.3, 0.45 * a, 'sine', 28, null, 0.003); for (let k = 0; k < 3; k++) later(80 + k * 70, () => noise(0.06, 0.2 * a, 'bandpass', 1800 + Math.random() * 900, 3, 0.05)); },
    bump(x, z) { const a = att(x, z, 80); if (a <= 0) return; noise(0.12, 0.35 * a, 'lowpass', 380, 0.6, 0.1, null, 0.003); },
    horn(x, z, len = 0.4) { const a = att(x, z, 150); if (a <= 0) return; const dest = hornBus(); tone(415, len, 0.35 * a, 'sawtooth', null, dest, 0.02, 4); tone(415, len, 0.25 * a, 'sawtooth', null, dest, 0.02, -6); tone(520, len, 0.22 * a, 'sawtooth', null, dest, 0.02, 3); },
    scream(x, z) { const a = att(x, z, 60); if (a <= 0) return; const dest = hornBus(1600); tone(650 + Math.random() * 250, 0.4, 0.18 * a, 'sawtooth', 380, dest, 0.03); },
    pickup() { bell(880, 0.25, 0.22); later(90, () => bell(1320, 0.35, 0.2)); },
    cash() { bell(1180, 0.14, 0.18); later(70, () => bell(1570, 0.2, 0.18)); },
    door(x, z) { const a = att(x, z, 30); noise(0.06, 0.35 * a, 'lowpass', 700, 0.7, 0.05, null, 0.002); later(70, () => noise(0.05, 0.25 * a, 'bandpass', 1500, 2, 0.04)); },
    missionPass() { [523, 659, 784].forEach((f, i) => later(i * 110, () => { tone(f, 1.6, 0.14, 'triangle', null, null, 0.02); tone(f, 1.6, 0.08, 'sine', null, null, 0.02, 6); })); later(360, () => bell(1046, 1.8, 0.2)); },
    missionFail() { [392, 311, 233].forEach((f, i) => later(i * 260, () => { const dest = hornBus(900); tone(f, 0.7, 0.2, 'sawtooth', null, dest, 0.02, 5); tone(f, 0.7, 0.2, 'sawtooth', null, dest, 0.02, -5); })); },
    wasted() { tone(110, 3.0, 0.35, 'sine', 38, null, 0.05); tone(110, 3.0, 0.12, 'sawtooth', 38, hornBus(500), 0.05, 7); noise(2.0, 0.25, 'lowpass', 260, 0.6, 1.8, null, 0.1); },
    busted() { [330, 262, 220, 165].forEach((f, i) => later(i * 210, () => { const dest = hornBus(1100); tone(f, 0.5, 0.2, 'square', null, dest, 0.01); tone(f * 1.5, 0.5, 0.08, 'square', null, dest, 0.01); })); },
    star() { bell(660, 0.18, 0.18); later(100, () => bell(990, 0.25, 0.18)); },
    click() { noise(0.02, 0.18, 'bandpass', 2200, 3, 0.02, null, 0.001); tone(900, 0.03, 0.06, 'sine'); },
    splash(x, z) { const a = att(x, z, 100); noise(0.5, 0.5 * a, 'lowpass', 900, 0.6, 0.45, null, 0.005); for (let k = 0; k < 4; k++) later(60 + k * 90, () => tone(400 + Math.random() * 600, 0.08, 0.06 * a, 'sine', 900)); },
    checkpoint() { bell(740, 0.15, 0.18); later(80, () => bell(1110, 0.25, 0.18)); },
    reload() { noise(0.05, 0.3, 'bandpass', 3200, 4, 0.04, null, 0.001); later(110, () => noise(0.05, 0.3, 'bandpass', 2400, 4, 0.04, null, 0.001)); later(220, () => noise(0.04, 0.2, 'bandpass', 4000, 4, 0.03, null, 0.001)); },
    phone() { for (let i = 0; i < 3; i++) later(i * 120, () => { tone(1320, 0.08, 0.1, 'sine'); tone(1760, 0.08, 0.06, 'sine'); }); },
    step(x, z, hard = true) { const a = att(x, z, 25); if (a <= 0) return; noise(0.06, (hard ? 0.16 : 0.1) * a, 'lowpass', hard ? 420 + Math.random() * 120 : 260, 0.8, 0.05, null, 0.002); },
    chirp(x, z) { const a = att(x, z, 60); if (a <= 0) return; const f = 2800 + Math.random() * 1400; tone(f, 0.07, 0.05 * a, 'sine', f * 1.35, null, 0.005); later(110, () => tone(f * 1.1, 0.06, 0.04 * a, 'sine', f * 0.85, null, 0.005)); },
    gull(x, z) { const a = att(x, z, 90); if (a <= 0) return; const dest = hornBus(2400); tone(1100 + Math.random() * 300, 0.32, 0.07 * a, 'sawtooth', 700, dest, 0.03); later(260, () => tone(950, 0.2, 0.05 * a, 'sawtooth', 620, dest, 0.02)); },
    heli(x, z, on) { /* handled by ambient loop */ },
  };
  // a lowpassed bus for the harsher waveforms (horns, screams, fail stings) so they stop sounding like a chip
  const hornBuses = {}; function hornBus(cut = 1300) { if (hornBuses[cut]) return hornBuses[cut]; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; f.Q.value = 0.7; f.connect(sfxBus); hornBuses[cut] = f; return f; }
  function play(name, x, z, ...rest) { if (!ctx || muted) return; try { SFX[name](x, z, ...rest); } catch (e) { } }

  // ---- Engine: two detuned saws and a sub through a soft clipper and a resonant lowpass, plus an exhaust noise pulsed at the firing rate.
  function buildEngine() {
    const g = ctx.createGain(); g.gain.value = 0; g.connect(sfxBus);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 60; const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 60.4; const o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = 30;
    const shaper = ctx.createWaveShaper(); const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 127.5 - 1; curve[i] = Math.tanh(x * 2.2); } shaper.curve = curve;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; f.Q.value = 3;
    const g1 = ctx.createGain(); g1.gain.value = 0.35; const g2 = ctx.createGain(); g2.gain.value = 0.3; const g3 = ctx.createGain(); g3.gain.value = 0.4;
    o1.connect(g1); o2.connect(g2); o3.connect(g3); g1.connect(shaper); g2.connect(shaper); g3.connect(shaper); shaper.connect(f); f.connect(g); o1.start(); o2.start(); o3.start();
    // exhaust: bandpassed noise whose volume follows an LFO at the firing rate
    const ns = ctx.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true; const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 180; nf.Q.value = 1.2; const ng = ctx.createGain(); ng.gain.value = 0.0; const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 30; const lg = ctx.createGain(); lg.gain.value = 0.5; const base = ctx.createGain(); base.gain.value = 0.5; lfo.connect(lg); lg.connect(ng.gain); ns.connect(nf); nf.connect(ng); ng.connect(g); ns.start(); lfo.start();
    engineNodes = { g, o1, o2, o3, f, ng, nf, lfo };
  }
  function engine(on, rpm, load, kind = 'sedan') { if (!ctx) return; const e = engineNodes; const t = now();
    const K = { sports: 1.35, muscle: 1.15, police: 1.1, hatch: 1.05, taxi: 1, sedan: 1, van: 0.85, pickup: 0.8, swat: 0.75, truck: 0.55, bus: 0.6, bike: 1.7, boat: 0.5, ferry: 0.35 }[kind] || 1;
    // gears: the note climbs through each gear and drops into the next
    const gears = kind === 'truck' || kind === 'bus' ? 5 : kind === 'boat' || kind === 'ferry' ? 1 : 4; const x = M.clamp(rpm, 0, 1) * gears; const frac = rpm < 0.03 ? 0 : (x - Math.floor(Math.min(gears - 0.001, x))); const r = 0.18 + frac * 0.82 * (rpm < 0.03 ? 0 : 1);
    e.g.gain.setTargetAtTime(on ? 0.1 + load * 0.09 : 0, t, 0.08);
    const base = (38 + r * 150) * K; e.o1.frequency.setTargetAtTime(base, t, 0.05); e.o2.frequency.setTargetAtTime(base * 1.007, t, 0.05); e.o3.frequency.setTargetAtTime(base * 0.5, t, 0.05); e.lfo.frequency.setTargetAtTime(base * 0.5, t, 0.05);
    e.f.frequency.setTargetAtTime(240 + r * 1100 + load * 500, t, 0.08); e.ng.gain.setTargetAtTime(0.25 + load * 0.35, t, 0.1); e.nf.frequency.setTargetAtTime(140 + r * 260, t, 0.1); }
  function buildSiren() {
    const g = ctx.createGain(); g.gain.value = 0; g.connect(sfxBus); const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 700; const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 700; const g2 = ctx.createGain(); g2.gain.value = 0.35;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400; f.Q.value = 0.8; o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); o.start(); o2.start(); sirenNodes = { g, o, o2, phase: 0 };
  }
  function siren(vol, dt, pitch = 1) { if (!ctx) return; const s = sirenNodes; s.phase += dt; const w = 0.5 + 0.5 * Math.sin(s.phase / 1.15 * M.TAU); const f = (620 + 360 * Math.pow(w, 1.4)) * pitch; s.o.frequency.setTargetAtTime(f, now(), 0.03); s.o2.frequency.setTargetAtTime(f * 1.003, now(), 0.03); s.g.gain.setTargetAtTime(vol * 0.11, now(), 0.1); }
  function buildScreech() { const g = ctx.createGain(); g.gain.value = 0; g.connect(sfxBus); const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 8; const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 3300; f2.Q.value = 10; const g2 = ctx.createGain(); g2.gain.value = 0.5; src.connect(f); f.connect(g); src.connect(f2); f2.connect(g2); g2.connect(g); src.start(); screechNodes = { g, f }; }
  function screech(vol) { if (!ctx) return; screechNodes.g.gain.setTargetAtTime(vol * 0.22, now(), 0.05); screechNodes.f.frequency.setTargetAtTime(1700 + vol * 900, now(), 0.1); }
  function buildAmbient() {
    const g = ctx.createGain(); g.gain.value = 0.05; g.connect(sfxBus); const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; src.connect(f); f.connect(g); src.start();
    // wind: a slow-breathing band of air
    const wg = ctx.createGain(); wg.gain.value = 0.02; wg.connect(sfxBus); const ws = ctx.createBufferSource(); ws.buffer = noiseBuf; ws.loop = true; const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 520; wf.Q.value = 0.5; const wl = ctx.createOscillator(); wl.frequency.value = 0.08; const wlg = ctx.createGain(); wlg.gain.value = 0.012; wl.connect(wlg); wlg.connect(wg.gain); ws.connect(wf); wf.connect(wg); ws.start(); wl.start();
    // helicopter rotor: pulsed low noise
    const hg = ctx.createGain(); hg.gain.value = 0; hg.connect(sfxBus); const hs = ctx.createBufferSource(); hs.buffer = noiseBuf; hs.loop = true; const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 220; const lfo = ctx.createOscillator(); lfo.frequency.value = 13; const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(hg.gain); hs.connect(hf); hf.connect(hg); hs.start(); lfo.start();
    const rg = ctx.createGain(); rg.gain.value = 0; rg.connect(sfxBus); const rs = ctx.createBufferSource(); rs.buffer = noiseBuf; rs.loop = true; const rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 3200; rf.Q.value = 0.4; rs.connect(rf); rf.connect(rg); rs.start();
    ambient = { g, hg, rg, f, wg };
  }
  function traffic(v) { if (!ctx) return; ambient.g.gain.setTargetAtTime(0.03 + v * 0.06, now(), 0.8); ambient.f.frequency.setTargetAtTime(150 + v * 120, now(), 0.8); }
  function rain(v, inCar) { if (!ctx) return; ambient.rg.gain.setTargetAtTime(v * (inCar ? 0.05 : 0.14), now(), 0.5); ambient.wg.gain.setTargetAtTime(0.02 + v * 0.03, now(), 1); }
  function heliVolume(v) { if (!ctx) return; ambient.hg.gain.setTargetAtTime(v * 0.5, now(), 0.2); }
  // the small sounds of a place: birds by the parks, gulls by the water
  function ambientTick(dt, near) { if (!ctx || muted) return; birdT -= dt; gullT -= dt; if (near.park && birdT <= 0) { birdT = 1.5 + Math.random() * 4; play('chirp', near.park.x, near.park.z); } if (near.water && gullT <= 0) { gullT = 4 + Math.random() * 8; play('gull', near.water.x, near.water.z); } }

  // ---- Radio: three stations from a step sequencer with proper voices.
  const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10] };
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  function pad(freq, dur, vol) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(500, now()); f.frequency.linearRampToValueAtTime(1600, now() + dur * 0.4); f.frequency.exponentialRampToValueAtTime(400, now() + dur); f.Q.value = 1.5; f.connect(musicBus); tone(freq, dur, vol, 'sawtooth', null, f, dur * 0.25, 8); tone(freq, dur, vol, 'sawtooth', null, f, dur * 0.25, -8); tone(freq * 0.5, dur, vol * 0.7, 'triangle', null, f, dur * 0.25); }
  function bass(freq, dur, vol, slideTo = null) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, now()); f.frequency.exponentialRampToValueAtTime(250, now() + dur); f.connect(musicBus); tone(freq, dur, vol, 'sawtooth', slideTo, f, 0.006); tone(freq, dur, vol * 0.8, 'sine', slideTo, musicBus, 0.006); }
  function lead(freq, dur, vol, type = 'triangle') { const o = tone(freq, dur, vol, type, null, musicBus, 0.01); const v = ctx.createOscillator(); v.frequency.value = 5.5; const vg = ctx.createGain(); vg.gain.value = freq * 0.006; v.connect(vg); vg.connect(o.frequency); v.start(); v.stop(now() + dur + 0.1); }
  function epiano(freq, dur, vol) { tone(freq, dur, vol, 'sine', null, musicBus, 0.004); tone(freq * 2, dur * 0.5, vol * 0.35, 'sine', null, musicBus, 0.004); tone(freq * 3.01, dur * 0.2, vol * 0.12, 'sine', null, musicBus, 0.002); }
  function kick(vol) { tone(150, 0.14, vol, 'sine', 42, musicBus, 0.001); noise(0.02, vol * 0.4, 'lowpass', 900, 0.7, 0.02, musicBus, 0.001); }
  function snare(vol) { noise(0.16, vol, 'bandpass', 1900, 0.9, 0.13, musicBus, 0.001); tone(190, 0.08, vol * 0.5, 'triangle', 120, musicBus, 0.001); }
  function hat(vol, open = false) { noise(open ? 0.22 : 0.04, vol, 'highpass', 7500, 0.8, open ? 0.2 : 0.03, musicBus, 0.001); }
  function setRadio(st) { radioStation = st; radioOn = st > 0; if (ctx) musicBus.gain.setTargetAtTime(radioOn ? 0.35 : 0, now(), 0.3); radioBeat = 0; }
  function radioTick(dt, inCar) {
    if (!ctx || !radioOn) return;
    musicBus.gain.setTargetAtTime(inCar ? 0.35 : 0.08, now(), 0.5);
    radioTimer += dt; const bpm = radioStation === 1 ? 118 : radioStation === 2 ? 92 : 68; const step = 60 / bpm / 4;
    while (radioTimer >= step) {
      radioTimer -= step; const b = radioBeat++; const bar = Math.floor(b / 16), s = b % 16;
      const PROG = radioStation === 1 ? [45, 41, 48, 43, 45, 41, 50, 52] : radioStation === 2 ? [43, 43, 46, 41, 43, 43, 38, 41] : [45, 48, 43, 41]; const root = PROG[bar % PROG.length]; const sc = SCALES.minor;
      if (radioStation === 1) { // synthwave: pads on the chord, driving bass, four on the floor, an arpeggio and a lead every other phrase
        if (s === 0) { pad(midi(root + 12), 3.8, 0.06); pad(midi(root + 15), 3.8, 0.05); pad(midi(root + 19), 3.8, 0.05); }
        if (s % 2 === 0) bass(midi(root - 12 + (s % 8 === 6 ? 3 : 0)), 0.16, 0.3);
        if (s % 4 === 0) kick(0.6); if (s % 4 === 2) hat(0.16, s === 14); if (s === 4 || s === 12) snare(0.3);
        const arp = sc[(b * 3) % 7] + (b % 4 === 3 ? 12 : 0); tone(midi(root + 24 + arp), 0.18, 0.06, 'square', null, musicBus, 0.003);
        if (bar % 4 >= 2 && (s === 0 || s === 3 || s === 6 || s === 10 || s === 12)) lead(midi(root + 24 + sc[(bar * 5 + s * 3) % 7]), s === 12 ? 0.9 : 0.35, 0.09);
      } else if (radioStation === 2) { // hip hop: a heavy kit, sliding bass, electric piano stabs
        if (s === 0 || s === 7 || s === 10) kick(0.8); if (s === 4 || s === 12) snare(0.5); if (s % 2 === 0) hat(0.12, s === 10);
        if (s === 0 || s === 6 || s === 11) bass(midi(root - 12), 0.42, 0.35, midi(root - 12 + (s === 6 ? 5 : 0)));
        if (s === 2 || s === 9) { epiano(midi(root + 12), 0.5, 0.09); epiano(midi(root + 15), 0.5, 0.07); epiano(midi(root + 19), 0.5, 0.07); }
        if (bar % 2 === 1 && (s === 4 || s === 6 || s === 11)) lead(midi(root + 24 + SCALES.dorian[(bar * 3 + s) % 7]), 0.5, 0.07, 'sine');
      } else { // ambient: slow pads that open and close, sparse bells
        if (s === 0) { pad(midi(root), 4.2, 0.09); pad(midi(root + 7), 4.2, 0.06); if (bar % 2) pad(midi(root + 15), 4.2, 0.05); }
        if (s === 8 && bar % 2) bell(midi(root + 24 + sc[bar % 7]), 1.6, 0.07, musicBus); if (s === 13 && bar % 4 === 3) bell(midi(root + 31), 1.2, 0.05, musicBus);
      }
    }
  }
  function toggleMute() { muted = !muted; if (ctx) master.gain.setTargetAtTime(muted ? 0 : 0.8, now(), 0.05); return muted; }
  // for the test harness: the loudest sample on the mix over the last analyser window
  function peak() { if (!analyser) return 0; const d = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(d); let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); return m; }
  return { ensure, resume, play, engine, siren, screech, heliVolume, rain, traffic, ambientTick, radioTick, setRadio, get radioStation() { return radioStation; }, STATIONS, toggleMute, get muted() { return muted; }, listener, peak, get ready() { return !!ctx; } };
})();
