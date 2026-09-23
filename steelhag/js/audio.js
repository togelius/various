'use strict';
// Wind, a slow analogue pad, sparse bells, and small foley. All synthesized.

const Sound = (() => {
  let ac = null, master, music, sfx, wet, wind, windGain, windFilter, hum, humGain, noiseBuf;
  let muted = false, chapter = 0, chordT = 0, chordI = 0, bellT = 4, voices = [];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  const CHORDS = [
    [[45, 52, 57, 60, 64], [41, 48, 57, 60, 64], [36, 48, 55, 59, 64], [43, 50, 55, 59, 62]],
    [[38, 50, 57, 62, 66], [43, 50, 59, 62, 66], [40, 52, 59, 64, 67], [45, 52, 57, 61, 64]],
    [[40, 47, 52, 55, 59], [36, 48, 52, 55, 59], [38, 50, 54, 57, 62], [35, 47, 50, 54, 59]],
    [[36, 43, 48, 51, 58], [32, 44, 48, 51, 55], [34, 41, 46, 50, 53], [31, 43, 47, 50, 55]],
    [[41, 53, 57, 60, 65], [38, 50, 57, 62, 65], [46, 53, 58, 62, 65], [48, 55, 60, 64, 67]],
  ];
  const WIND = [0.32, 0.12, 0.2, 0.22, 0.16];
  const HUM = [0, 0, 0.02, 0.09, 0.05];

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.8;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ac.destination);
    music = ac.createGain(); music.gain.value = 0.42; music.connect(master);
    sfx = ac.createGain(); sfx.gain.value = 0.7; sfx.connect(master);
    // reverb
    const len = ac.sampleRate * 3.5, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const conv = ac.createConvolver(); conv.buffer = ir;
    wet = ac.createGain(); wet.gain.value = 0.6; wet.connect(conv); conv.connect(master);
    // noise
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0); let last = 0;
    for (let i = 0; i < nd.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; nd[i] = last * 3.5 + w * 0.08; }
    wind = ac.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
    windFilter = ac.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 500; windFilter.Q.value = 0.6;
    windGain = ac.createGain(); windGain.gain.value = 0;
    wind.connect(windFilter); windFilter.connect(windGain); windGain.connect(master); wind.start();
    hum = ac.createOscillator(); hum.type = 'sine'; hum.frequency.value = 55;
    const hum2 = ac.createOscillator(); hum2.type = 'triangle'; hum2.frequency.value = 110.4;
    humGain = ac.createGain(); humGain.gain.value = 0;
    hum.connect(humGain); hum2.connect(humGain); humGain.connect(master); hum.start(); hum2.start();
    setChapter(chapter);
  }

  function setChapter(i) {
    chapter = i; chordI = 0; chordT = 0;
    if (!ac) return;
    const t = ac.currentTime;
    windGain.gain.setTargetAtTime(WIND[i], t, 2);
    humGain.gain.setTargetAtTime(HUM[i], t, 3);
    playChord();
  }

  function playChord() {
    if (!ac) return;
    const t = ac.currentTime, notes = CHORDS[chapter][chordI % 4], dur = 10;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = chapter === 3 ? 520 : 820; f.Q.value = 0.7;
    const g = ac.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.055, t + 3.5); g.gain.setValueAtTime(0.055, t + dur - 2); g.gain.linearRampToValueAtTime(0, t + dur + 3);
    f.connect(g); g.connect(music); g.connect(wet);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 220;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start(t); lfo.stop(t + dur + 3.2);
    notes.forEach((m, j) => {
      for (const det of [-7, 6]) {
        const o = ac.createOscillator(); o.type = j === 0 ? 'triangle' : 'sawtooth';
        o.frequency.value = mtof(m); o.detune.value = det + (Math.random() - 0.5) * 4;
        const og = ac.createGain(); og.gain.value = j === 0 ? 0.9 : 0.35;
        o.connect(og); og.connect(f); o.start(t); o.stop(t + dur + 3.2);
      }
    });
  }

  function bell() {
    if (!ac) return;
    const notes = CHORDS[chapter][chordI % 4], m = notes[1 + (Math.random() * (notes.length - 1)) | 0] + (Math.random() < 0.6 ? 24 : 12);
    const t = ac.currentTime;
    for (const [mult, amp] of [[1, 0.05], [2.01, 0.012], [3.98, 0.005]]) {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m) * mult;
      const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
      o.connect(g); g.connect(music); g.connect(wet); o.start(t); o.stop(t + 4.1);
    }
  }

  function update(dt) {
    if (!ac || ac.state !== 'running') return;
    chordT += dt;
    if (chordT > 9) { chordT = 0; chordI++; playChord(); }
    bellT -= dt;
    if (bellT < 0) { bellT = 3 + Math.random() * 7; bell(); }
    windFilter.frequency.setTargetAtTime(350 + Math.random() * 500, ac.currentTime, 1.5);
  }

  function noise(dur, type, freq, q, amp, when = 0, target = sfx) {
    if (!ac) return;
    const t = ac.currentTime + when;
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 1 + Math.random() * 0.3;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(target); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function tone(freq, dur, type, amp, when = 0, slide = 0, target = sfx) {
    if (!ac) return;
    const t = ac.currentTime + when;
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(target); o.start(t); o.stop(t + dur + 0.05);
  }

  const S = {
    init, setChapter, update,
    get muted() { return muted; },
    toggleMute() { muted = !muted; if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ac.currentTime, 0.05); return muted; },
    step(surface) {
      switch (surface) {
        case 'snow': noise(0.12, 'bandpass', 1400 + Math.random() * 600, 0.8, 0.35); noise(0.05, 'highpass', 4000, 0.5, 0.12); break;
        case 'grass': noise(0.09, 'highpass', 2500, 0.5, 0.12); break;
        case 'marsh': noise(0.16, 'lowpass', 700, 1, 0.3); break;
        case 'metal': noise(0.06, 'bandpass', 900, 3, 0.25); tone(260 + Math.random() * 80, 0.12, 'triangle', 0.03); break;
        case 'wood': noise(0.07, 'bandpass', 420, 2, 0.35); break;
        case 'soft': noise(0.1, 'lowpass', 600, 1, 0.2); break;
        default: noise(0.07, 'bandpass', 1200, 1.2, 0.2);
      }
    },
    jump() { noise(0.14, 'bandpass', 900, 0.6, 0.1); },
    land(surface) { S.step(surface); noise(0.14, 'lowpass', 400, 1, 0.25); },
    beep(v = 1) { tone(1320, 0.09, 'square', 0.035 * v, 0, 0, sfx); tone(1760, 0.12, 'square', 0.03 * v, 0.1); if (wet) tone(1760, 0.12, 'sine', 0.02 * v, 0.1, 0, wet); },
    shutter() { noise(0.03, 'highpass', 3000, 0.7, 0.4); noise(0.05, 'bandpass', 1800, 2, 0.3, 0.07); tone(2400, 0.04, 'square', 0.02, 0.07); },
    quiet(e) {
      // Replies are deliberately quieter than footsteps and never loop.
      switch (e.kind) {
        case 'radio':
          noise(0.5, 'bandpass', 900 + e.channel * 600, 2, 0.07);
          if (e.channel === 0) tone(146, 1.4, 'sine', 0.025, 0.15);
          if (e.channel === 1) [392, 440, 330].forEach((f, i) => tone(f, 0.45, 'sine', 0.018, 0.3 + i * 0.4));
          if (e.channel === 2) [0, 0.24, 0.6].forEach(d => tone(880, 0.12, 'sine', 0.024, d));
          break;
        case 'birds':
          if (!e.gentle) tone(1240, 0.35, 'sine', 0.025, 0, 1.35);
          [0.6, 1, 1.8].forEach((d, i) => tone(2200 + i * 170, 0.16, 'sine', 0.017, d, 0.78));
          break;
        case 'flutter': noise(0.3, 'highpass', 1800, 0.6, 0.035); break;
        case 'water': noise(0.13, 'highpass', 1800, 0.6, 0.035); break;
        case 'drop': noise(0.13, 'lowpass', 1600, 1, 0.055); tone(720, 0.09, 'sine', 0.025, 0, 0.6); break;
        case 'bell':
          [523, 1049, 1564].forEach((f, i) => tone(f, 2.8 - i * 0.5, 'sine', 0.035 / (i + 1), 0, 0, wet || sfx));
          break;
        case 'answer':
          (e.bell ? [262, 525] : [660, 660, 880]).forEach((f, i) => tone(f, e.bell ? 3 : 0.3, 'sine', 0.018 / (i + 1), i * 0.28, 0, wet || sfx));
          break;
        case 'signal': noise(0.08, 'bandpass', 600, 1, 0.06); if (e.on) tone(110, 1.7, 'sine', 0.025, 0.2); break;
        case 'stones': tone(330, 2, 'sine', 0.018, 0, 1.5, wet || sfx); break;
      }
    },
    splash() { noise(0.6, 'lowpass', 1200, 0.7, 0.5); noise(0.3, 'highpass', 3000, 0.5, 0.2, 0.05); },
    zap() { noise(0.35, 'bandpass', 2600, 1.5, 0.5); tone(90, 0.3, 'sawtooth', 0.12, 0, 0.5); },
    crackle() { noise(0.05 + Math.random() * 0.05, 'bandpass', 3000 + Math.random() * 2000, 2, 0.06); },
    fall() { tone(300, 0.8, 'sine', 0.05, 0, 0.4); },
    chime() { [0, 4, 7, 12].forEach((s, i) => tone(mtof(72 + s), 1.8, 'sine', 0.05, i * 0.12, 0, wet || sfx)); },
    rise(seconds) {
      if (!ac) return;
      const t = ac.currentTime;
      humGain.gain.setTargetAtTime(0.16, t, seconds / 3);
      hum.frequency.setTargetAtTime(110, t, seconds / 2);
      windGain.gain.setTargetAtTime(0.05, t, 2);
    },
    endHum() { if (!ac) return; humGain.gain.setTargetAtTime(0, ac.currentTime, 1.5); hum.frequency.setTargetAtTime(55, ac.currentTime, 2); },
  };
  return S;
})();
