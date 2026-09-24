// STÅLHAGEN II — sound. The first game's pad, wind and bells continue; the hum is the threat instrument, rising toward
// charged steel; beeps, footfalls and lamps sit in space through HRTF panners. Everything is synthesised.
'use strict';
const Sound = (() => {
  let ac = null, master, music, sfx, wet, wind, windGain, windFilter, hum, hum2, humGain, humFilter, noiseBuf, listener;
  let indoors=false;
  let muted = false, chapter = 0, chordT = 0, chordI = 0, bellT = 6, humTarget = 0, iceT = 8;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const CHORDS = [
    [[36, 48, 55, 60, 64], [41, 53, 57, 60, 64], [33, 45, 52, 57, 60], [43, 50, 55, 59, 62]],
    [[38, 50, 57, 62, 65], [34, 46, 53, 58, 62], [41, 48, 57, 60, 65], [36, 48, 55, 58, 63]],
  ];
  const WIND = [0.26, 0.16];

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC(); listener = ac.listener;
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.8;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; master.connect(comp); comp.connect(ac.destination);
    music = ac.createGain(); music.gain.value = 0.38; music.connect(master);
    sfx = ac.createGain(); sfx.gain.value = 0.8; sfx.connect(master);
    const len = ac.sampleRate * 3.5, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const conv = ac.createConvolver(); conv.buffer = ir; wet = ac.createGain(); wet.gain.value = 0.55; wet.connect(conv); conv.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0); let last = 0;
    for (let i = 0; i < nd.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; nd[i] = last * 3.5 + w * 0.08; }
    wind = ac.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
    windFilter = ac.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 450; windFilter.Q.value = 0.6;
    windGain = ac.createGain(); windGain.gain.value = 0; wind.connect(windFilter); windFilter.connect(windGain); windGain.connect(master); wind.start();
    hum = ac.createOscillator(); hum.type = 'sine'; hum.frequency.value = 55; hum2 = ac.createOscillator(); hum2.type = 'triangle'; hum2.frequency.value = 110.3;
    humFilter = ac.createBiquadFilter(); humFilter.type = 'lowpass'; humFilter.frequency.value = 300;
    humGain = ac.createGain(); humGain.gain.value = 0; hum.connect(humFilter); hum2.connect(humFilter); humFilter.connect(humGain); humGain.connect(master); hum.start(); hum2.start();
    setChapter(chapter);
  }
  function setChapter(i) { chapter = Math.min(i, CHORDS.length - 1); chordI = 0; chordT = 0; if (!ac) return; windGain.gain.setTargetAtTime(indoors?.015:WIND[chapter], ac.currentTime, 2); playChord(); }
  function playChord() {
    if (!ac) return;
    const t = ac.currentTime, notes = CHORDS[chapter][chordI % 4], dur = 11;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 0.7;
    const g = ac.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(0.05, t + 4); g.gain.setValueAtTime(0.05, t + dur - 2); g.gain.linearRampToValueAtTime(0, t + dur + 3);
    f.connect(g); g.connect(music); g.connect(wet);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.11; lg.gain.value = 200; lfo.connect(lg); lg.connect(f.frequency); lfo.start(t); lfo.stop(t + dur + 3.2);
    notes.forEach((m, j) => { for (const det of [-7, 6]) { const o = ac.createOscillator(); o.type = j === 0 ? 'triangle' : 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det + (Math.random() - 0.5) * 4; const og = ac.createGain(); og.gain.value = j === 0 ? 0.9 : 0.3; o.connect(og); og.connect(f); o.start(t); o.stop(t + dur + 3.2); } });
  }
  function bell() {
    if (!ac) return; const notes = CHORDS[chapter][chordI % 4], m = notes[1 + (Math.random() * (notes.length - 1)) | 0] + (Math.random() < 0.6 ? 24 : 12), t = ac.currentTime;
    for (const [mult, amp] of [[1, 0.045], [2.01, 0.01], [3.98, 0.004]]) { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m) * mult; const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 4); o.connect(g); g.connect(music); g.connect(wet); o.start(t); o.stop(t + 4.1); }
  }
  // a source in space: an HRTF panner that lives for the sound's length
  function panner(x, y, z, ref = 4, roll = 1.2) {
    const p = ac.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = roll; p.maxDistance = 400;
    p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; p.connect(sfx); return p;
  }
  function noise(dur, type, freq, q, amp, when = 0, target = sfx, rate = 1) {
    if (!ac) return; const t = ac.currentTime + when;
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = rate * (1 + Math.random() * 0.2);
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(target); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function tone(freq, dur, type, amp, when = 0, slide = 0, target = sfx, attack = 0.008) {
    if (!ac) return; const t = ac.currentTime + when;
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(target); o.start(t); o.stop(t + dur + 0.05);
  }
  let lx = 0, ly = 0, lz = 0;
  function update(dt, cam, humAmount, onIce) {
    if (!ac || ac.state !== 'running') return;
    chordT += dt; if (chordT > 10) { chordT = 0; chordI++; playChord(); }
    bellT -= dt; if (bellT < 0) { bellT = 6 + Math.random() * 12; bell(); }
    windFilter.frequency.setTargetAtTime(300 + Math.random() * 500, ac.currentTime, 1.5);
    // the hum: 55 Hz far from charged steel, rising toward 110 close to it
    humTarget = clamp(humAmount, 0, 1);
    humGain.gain.setTargetAtTime(humTarget * 0.09, ac.currentTime, 0.4);
    hum.frequency.setTargetAtTime(55 + humTarget * 55, ac.currentTime, 0.8); hum2.frequency.setTargetAtTime(110.3 + humTarget * 110, ac.currentTime, 0.8);
    // the ice sings when you are out on it
    if (onIce) { iceT -= dt; if (iceT < 0) { iceT = 5 + Math.random() * 14; iceSong(cam); } }
    // the listener is the camera
    const fx = cam.tx - cam.x, fy = cam.ty - cam.y, fz = cam.tz - cam.z, fl = Math.hypot(fx, fy, fz) || 1;
    lx = cam.x; ly = cam.y; lz = cam.z;
    if (listener.positionX) { listener.positionX.value = cam.x; listener.positionY.value = cam.y; listener.positionZ.value = cam.z; listener.forwardX.value = fx / fl; listener.forwardY.value = fy / fl; listener.forwardZ.value = fz / fl; listener.upX.value = 0; listener.upY.value = 1; listener.upZ.value = 0; }
    else { listener.setPosition(cam.x, cam.y, cam.z); listener.setOrientation(fx / fl, fy / fl, fz / fl, 0, 1, 0); }
  }
  function iceSong(cam) {
    const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 120, p = panner(cam.x + Math.sin(a) * d, 0, cam.z + Math.cos(a) * d, 20, 0.6);
    const f = 60 + Math.random() * 90; tone(f * 4, 1.4, 'sine', 0.35, 0, 0.35, p, 0.02); tone(f, 2.2, 'sine', 0.3, 0.1, 0.5, p, 0.05); noise(0.5, 'lowpass', 200, 1, 0.5, 0.05, p);
  }
  const S = {
    setIndoor(v){indoors=v;if(ac)windGain.gain.setTargetAtTime(indoors?.015:WIND[chapter],ac.currentTime,.7);},
    init, setChapter, update, get muted() { return muted; },
    toggleMute() { muted = !muted; if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ac.currentTime, 0.05); return muted; },
    step(surface, hurry) {
      const v = hurry ? 1.6 : 1;
      if (surface === 'ice') { noise(0.08, 'bandpass', 1800, 1.5, 0.18 * v); if (Math.random() < 0.3) tone(900 + Math.random() * 600, 0.15, 'sine', 0.02, 0, 0.6); }
      else if (surface === 'wood') noise(0.07, 'bandpass', 420, 2, 0.3 * v);
      else { noise(0.12, 'bandpass', 1400 + Math.random() * 600, 0.8, 0.3 * v); noise(0.05, 'highpass', 4000, 0.5, 0.1 * v); }
    },
    at(kind, x, y, z, v = 1) {
      if (!ac) return; const p = panner(x, y, z);
      switch (kind) {
        case 'beep': tone(1320, 0.09, 'square', 0.12 * v, 0, 0, p); tone(1760, 0.12, 'square', 0.1 * v, 0.1, 0, p); tone(1760, 0.14, 'sine', 0.05 * v, 0.1, 0, wet); break;
        case 'hop': noise(0.1, 'bandpass', 700, 1.5, 0.25 * v, 0, p); break;
        case 'step': noise(0.06, 'bandpass', 500, 2, 0.3 * v, 0, p); tone(120, 0.08, 'sine', 0.15 * v, 0, 0.5, p); break;
        case 'lamp': noise(0.04, 'bandpass', 2500, 3, 0.3, 0, p); tone(60, 0.5, 'sine', 0.2, 0, 1, p); break;
        case 'servo': noise(0.15, 'bandpass', 1400, 4, 0.12 * v, 0, p); break;
        case 'off': tone(880, 0.5, 'sine', 0.2, 0, 0.5, p); tone(110, 1.5, 'sine', 0.2, 0.2, 0.7, p); noise(0.3, 'lowpass', 300, 1, 0.3, 0.1, p); break;
        case 'lift': noise(0.5, 'bandpass', 800, 2, 0.35, 0, p); tone(70, 1.2, 'sine', 0.3, 0, 1.3, p); break;
        case 'arc': noise(.12,'highpass',2400,1,.25*v,0,p);tone(160,.18,'sawtooth',.06*v,0,.45,p);break;
        case 'cut': noise(0.35, 'bandpass', 2600, 1.5, 0.6, 0, p); tone(90, 0.3, 'sawtooth', 0.15, 0, 0.5, p); noise(0.25, 'lowpass', 400, 1, 0.4, 0.05, p); break;
        case 'dark': tone(220, 1.8, 'sine', 0.25, 0, 0.25, p); noise(0.8, 'lowpass', 250, 1, 0.35, 0, p); break;
        case 'rumble': tone(38, 6, 'sine', 0.9 * v, 0, 1.1, p, 0.5); noise(4, 'lowpass', 120, 1, 0.9 * v, 0, p); noise(2.5, 'bandpass', 500, 1, 0.5 * v, 1, p); break;
        case 'crack': noise(0.4, 'bandpass', 900, 2, 0.6, 0, p); tone(180, 0.6, 'sine', 0.3, 0, 0.5, p); tone(700, 0.2, 'square', 0.05, 0, 0.7, p); break;
      }
    },
    tick(v) { noise(0.02, 'highpass', 3500, 1, 0.12 * v); },
    torch(on) { noise(0.03, 'bandpass', 3000, 3, 0.15); if (on) tone(2200, 0.05, 'square', 0.02); },
    shutter() { noise(0.03, 'highpass', 3000, 0.7, 0.4); noise(0.05, 'bandpass', 1800, 2, 0.3, 0.07); tone(2400, 0.04, 'square', 0.02, 0.07); },
    wind_lever() { noise(0.08, 'bandpass', 1200, 4, 0.2); noise(0.08, 'bandpass', 1400, 4, 0.2, 0.1); },
    touch() { [0, 3, 7, 10].forEach((st, i) => tone(mtof(64 + st), 2.8, 'sine', 0.04, i * 0.2, 0, wet || sfx)); tone(mtof(40), 3.2, 'sine', 0.05, 0, 0, wet || sfx); },
    chime() { [0, 4, 7, 12].forEach((s, i) => tone(mtof(72 + s), 1.8, 'sine', 0.05, i * 0.12, 0, wet || sfx)); },
    sit() { noise(0.2, 'lowpass', 500, 1, 0.2); },
    develop() { noise(0.6, 'lowpass', 400, 1, 0.08); },
    tick_menu(v = 0) { tone(v ? 880 : 660, 0.06, 'sine', 0.02); },
    splash() { noise(0.7, 'lowpass', 900, 0.7, 0.6); noise(0.3, 'highpass', 3000, 0.5, 0.2, 0.05); tone(50, 1.5, 'sine', 0.3, 0, 0.5); },
    fall() { tone(300, 0.8, 'sine', 0.05, 0, 0.4); },
  };
  return S;
})();
