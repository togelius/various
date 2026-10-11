/* CLACK STACK: the real Sfx module (dev/audio.js). Inlined into index.html between
   SFX:BEGIN / SFX:END at integration. Plain script, exactly one global: const Sfx.

   Everything is synthesised with WebAudio at run time: oscillators, filtered noise, and a
   few 30-80 ms plastic-impact buffers computed in JS (modal synthesis) at unlock. No samples.

   Graph:
     one-shot voices -> sfxBus ---------------------------+
     music steps -> session -> musicBus (0.14) -> duck ---+-> HP 25 Hz (DC / subsonic)
       -> DynamicsCompressor (-12 dB, knee 8, 4:1) -> trim (undo Chromium's auto make-up gain)
       -> safety soft-clip (linear to 0.7, ceiling 0.864 = -1.27 dBFS) -> master (mute) -> out

   Rules every sound follows: every gain envelope starts at 0 and ramps (linear attack,
   exponential decay to -60 dB, linear to exactly 0) and every source is stopped only after
   its envelope reaches 0, so nothing clicks. Each one-shot is a "voice" (one GainNode that
   owns its nodes); at most 24 voices (oldest lowest-priority one is faded out in 12 ms),
   and finished voices are disconnected and dropped so the nodes can be garbage collected.

   Nothing is ever scheduled at a time the audio thread may already have rendered: a source
   started in the past begins with its envelope already decaying (a clipped, smeared attack).
   So a sound is built in two phases: its building blocks create every node first (the slow
   part: 10-250 nodes, several ms on a phone) and queue their scheduling; when the sound is
   complete, go() reads the audio clock and runs the queue at >= now + LAT with one common shift,
   so the parts keep their exact relative timing (the clock is re-checked before each part, in
   case the thread is preempted mid-commit). LAT is one render burst (baseLatency). Music steps
   are never shifted off the 16th grid: a step that can no longer start on time is skipped.

   Pitched material is C major pentatonic, so clacks are always in key with the groove.
   Sfx uses its own seeded RNG and never touches the game's. */
const Sfx = (() => {
  'use strict';

  /* ---------------------------------------------------------------- constants */
  const CAP = 24;            // simultaneous one-shot voices
  // Earliest schedule offset (s) from currentTime. The audio thread renders in bursts (a whole device
  // callback, ~baseLatency: 10 ms on desktop Chromium, 10-40 ms on Android), and currentTime jumps by a
  // burst at a time; an event less than one burst ahead can be overtaken by the next burst before it
  // lands. Set from baseLatency at unlock (6 ms where the browser does not report it).
  let LAT = 0.006;
  const MUSIC_VOL = 0.14;    // music bus level: the groove sits well under the sfx
  const DUCK_TO = 0.3;       // music gain while ducked (crash, smash)
  const TRIM = 0.8;          // after the compressor: undoes its automatic make-up gain (~+3.8 dB)
  const CREAK_PK = 1.6;      // creak gain at level 1 (the band-passed saw is quiet by itself)
  const PSTEP = [0, 2, 4, 7, 9];
  const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const pentMidi = (i) => 72 + 12 * Math.floor(i / 5) + PSTEP[((i % 5) + 5) % 5];
  // C5 D5 E5 G5 A5 C6 D6 E6 G6 A6 (index = combo mod 10), continuing up to C8 for edge runs.
  const PENTA = [];
  for (let i = 0; i < 16; i++) PENTA.push(midiHz(pentMidi(i)));

  /* ---------------------------------------------------------------- helpers */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const fin = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(0xC1AC5);
  const pick = (arr) => arr[(rnd() * arr.length) | 0];
  const loud = (f) => Math.pow(f / 523.25, -0.3);   // equal-loudness tilt: high notes a bit softer

  /* ---------------------------------------------------------------- state */
  let ac = null, unlocked = false, muted = false, armed = false, hiddenSusp = false;
  let sfxBus, musicBus, duckG, master, NZ, SNAP = [], HIT = [];
  let duckUntil = 0, lastWhistle = -9;
  const act = [], dead = [], todo = [];   // live voices; voices awaiting disconnect; voices built but not yet scheduled
  let peakVoices = 0, reapTimer = 0;
  const errs = {};

  const ready = () => !!ac && ac.state === 'running';
  const live = () => !muted && ready();

  // Hold a param at its current value from `now` on (so a new ramp starts where it is).
  function hold(p, now) {
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(now);
    else { const v = p.value; p.cancelScheduledValues(now); p.setValueAtTime(v, now); }
  }

  /* ---------------------------------------------------------------- JS-side synthesis of short buffers */
  function biq(x, type, f, q, sr) {   // RBJ biquad, in place
    const w = 2 * Math.PI * f / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
    else { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
    const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const x0 = x[i], y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x0; y2 = y1; y1 = y0; x[i] = y0;
    }
  }
  // Fill a mono buffer, normalise its peak to 1 and fade the last 1.5 ms to exactly 0.
  function synth(dur, fill) {
    const sr = ac.sampleRate, n = Math.max(8, Math.round(dur * sr));
    const b = ac.createBuffer(1, n, sr), d = b.getChannelData(0);
    fill(d, sr);
    let pk = 1e-9;
    for (let i = 0; i < n; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; }
    const fade = Math.round(0.0015 * sr);
    for (let i = 0; i < n; i++) d[i] *= (1 / pk) * (i >= n - fade ? (n - 1 - i) / fade : 1);
    return b;
  }
  function bandNoise(n, r, hp, lp, sr) {
    const z = new Float32Array(n);
    for (let i = 0; i < n; i++) z[i] = r() * 2 - 1;
    biq(z, 'hp', hp, 0.707, sr); biq(z, 'hp', hp, 0.707, sr);
    biq(z, 'lp', lp, 0.707, sr); biq(z, 'lp', lp, 0.707, sr);
    return z;
  }
  // impacts: [[t0, amp]], modes: [[freq, amp, tau]] (damped sines from rest); the noise click decays with tauN.
  // Each mode r^k sin(wk) comes from the exact two-pole recursion s[k] = 2r cos(w) s[k-1] - r^2 s[k-2]
  // (no exp/sin per sample, so unlock() stays fast).
  function impact(d, sr, z, impacts, modes, nAmp, tauN, mAmp) {
    const A = Math.max(2, Math.round(0.00025 * sr));     // 0.25 ms raised-cosine attack: sharp, but no step
    const rN = Math.exp(-1 / (tauN * sr));
    for (const [t0, amp] of impacts) {
      const i0 = Math.round(t0 * sr), n = d.length - i0;
      if (n <= 2) continue;
      const m = new Float64Array(n);
      for (const [f, a, tau] of modes) {
        const r = Math.exp(-1 / (tau * sr)), w = 2 * Math.PI * f / sr, c = 2 * r * Math.cos(w), r2 = r * r;
        let s2 = 0, s1 = r * Math.sin(w);
        m[1] += a * s1;
        for (let k = 2; k < n; k++) { const s0 = c * s1 - r2 * s2; s2 = s1; s1 = s0; m[k] += a * s0; }
      }
      let en = 1;
      for (let k = 0; k < n; k++) {
        const at = k < A ? 0.5 - 0.5 * Math.cos(Math.PI * k / A) : 1;
        d[i0 + k] += amp * at * (nAmp * z[i0 + k] * en + mAmp * m[k]);
        en *= rN;
      }
    }
  }
  // The magnet SNAP: a 4 ms 3-9 kHz noise click, bright plastic plate modes, and a second
  // micro-impact ~4 ms later (the tile seats itself: "tk-tk").
  function mkSnap(seed) {
    return synth(0.034, (d, sr) => {
      const r = mulberry32(seed), j = () => 0.93 + r() * 0.14;
      const z = bandNoise(d.length, r, 3000, 9000, sr);
      impact(d, sr, z, [[0, 1], [0.0036 + r() * 0.0016, 0.4]],
        [[2400 * j(), 1, 0.0072], [3550 * j(), 0.75, 0.005], [4800 * j(), 0.5, 0.0035], [6300 * j(), 0.3, 0.0025]],
        1.6, 0.0009, 0.5);
    });
  }
  // A loose tile clattering on the rug / pile: lower, clunkier, random plate modes.
  function mkHit(seed) {
    return synth(0.08, (d, sr) => {
      const r = mulberry32(seed), base = 650 + r() * 950, z = bandNoise(d.length, r, 1400, 9000, sr);
      const modes = [1, 1.59, 2.14, 2.3, 2.65, 2.92].map((q, k) => [base * q * (0.97 + r() * 0.06), (0.4 + r() * 0.6) / (1 + 0.5 * k), 0.004 + r() * 0.012]);
      const imp = [[0, 1]];
      if (r() < 0.7) imp.push([0.008 + r() * 0.014, 0.25 + r() * 0.3]);
      impact(d, sr, z, imp, modes, 1.0, 0.0015, 0.6);
    });
  }
  function clipCurve() {
    const N = 4097, c = new Float32Array(N), T = 0.7, C = 0.875;
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * 2 - 1, a = Math.abs(x);
      const y = a <= T ? a : T + (C - T) * Math.tanh((a - T) / (C - T));
      c[i] = x < 0 ? -y : y;
    }
    return c;
  }

  /* ---------------------------------------------------------------- graph */
  function build() {
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 25; hp.Q.value = -3;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.15;
    const trim = ac.createGain(); trim.gain.value = TRIM;
    const clip = ac.createWaveShaper(); clip.curve = clipCurve(); clip.oversample = 'none';
    master = ac.createGain(); master.gain.value = muted ? 0 : 1;
    sfxBus = ac.createGain();
    musicBus = ac.createGain(); musicBus.gain.value = MUSIC_VOL;
    duckG = ac.createGain();
    sfxBus.connect(hp); musicBus.connect(duckG); duckG.connect(hp);
    hp.connect(comp); comp.connect(trim); trim.connect(clip); clip.connect(master); master.connect(ac.destination);
    NZ = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);   // 1 s of white noise (xorshift32, seeded)
    const d = NZ.getChannelData(0);
    let x = 0x5EED1234;
    for (let i = 0; i < d.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; d[i] = (x >>> 0) / 2147483648 - 1; }
    SNAP.push(mkSnap(101));       // the very first clack may come in this same gesture
    setTimeout(() => { while (SNAP.length < 4) SNAP.push(mkSnap(101 + SNAP.length * 7)); hits(); }, 0);   // the rest can wait a moment
  }
  // Until that timeout has run (the first gesture: unlock() and the title BOOM in one handler) only
  // SNAP[0] exists, so never index SNAP directly: snapN(i) / pick(SNAP) work with any length >= 1.
  const snapN = (i) => SNAP[i % SNAP.length];
  function hits() { if (!HIT.length) for (let k = 0; k < 6; k++) HIT.push(mkHit(301 + k * 11)); return HIT; }

  /* ---------------------------------------------------------------- voices */
  // A voice's times are provisional (from t0 = now + LAT at creation) until go() schedules it. Every public
  // call ends with flush() (in guard), so a sound is scheduled right after its last node exists.
  function voice(prio, dur, pan) {
    const t = ac.currentTime + LAT;
    reap();
    while (act.length >= CAP) cut(victim());
    const g = ac.createGain();
    const v = { t0: t, end: t + dur, prio, g, nodes: [g], srcs: [], q: [], first: Infinity };
    let out = g;
    pan = clamp(fin(pan, 0), -1, 1);
    if (Math.abs(pan) > 0.01 && ac.createStereoPanner) {
      const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); v.nodes.push(p); out = p;
    }
    out.connect(sfxBus);
    act.push(v); todo.push(v);
    if (act.length > peakVoices) peakVoices = act.length;
    if (!reapTimer) reapTimer = setInterval(reap, 250);
    return v;
  }
  // Queue one part's scheduling: fn(sh) schedules it at its provisional times + sh. t = its earliest time.
  function at(v, t, fn) { if (t < v.first) v.first = t; v.q.push(fn, t); }
  // Schedule a built voice (or music step): read the clock now that every node exists, and shift the whole
  // sound so its earliest part is >= now + LAT. The clock is checked again before each part: if the main
  // thread was preempted mid-commit (OS, CPU throttling) and the clock overtook a part, the shift grows
  // for that part and all after it, so it still starts with its attack. grid: never shift (a music step
  // stays on the 16th grid): return -1 if it is too late to start at all (the caller drops it), and skip
  // any part the clock overtakes. Returns the shift applied to the start of the sound.
  function go(v, grid) {
    const q = v.q;
    if (!q) return 0;
    v.q = null;
    const i = todo.indexOf(v);
    if (i >= 0) todo.splice(i, 1);
    const late = ac.currentTime + LAT - v.first;
    if (late > 0 && grid) return -1;
    const sh0 = late > 0 ? late : 0;
    let sh = sh0;
    for (let k = 0; k < q.length; k += 2) {
      const lk = ac.currentTime + LAT - (q[k + 1] + sh);
      if (lk > 0) { if (grid) continue; sh += lk; }
      q[k](sh);
    }
    v.t0 += sh0; v.end += sh;
    return sh0;
  }
  // ok = false (the sound threw while building): drop the unscheduled voices; reap() disconnects them.
  function flush(ok) {
    while (todo.length) { if (ok) go(todo[0]); else todo.shift().q = null; }
  }
  function victim() {
    let b = null;
    for (const v of act) if (!b || v.prio < b.prio || (v.prio === b.prio && v.t0 < b.t0)) b = v;
    return b;
  }
  function cut(v) {   // fade out from the earliest safe time (a fade that starts in the past would step)
    const T = ac.currentTime + LAT, p = v.g.gain;
    if (v.q) { v.q = null; const i = todo.indexOf(v); if (i >= 0) todo.splice(i, 1); }   // never scheduled: nothing sounds
    try { p.cancelScheduledValues(T); p.setValueAtTime(1, T); p.linearRampToValueAtTime(0, T + 0.012); } catch (e) { /* ignore */ }
    for (const s of v.srcs) { try { s.stop(T + 0.016); } catch (e) { /* not started or already stopped */ } }
    v.end = T + 0.02;
    act.splice(act.indexOf(v), 1);
    dead.push(v);
  }
  function release(v) {
    for (const n of v.nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } }
    v.nodes.length = 0; v.srcs.length = 0;
  }
  function reap() {
    if (!ac) return;
    const now = ac.currentTime;
    for (let i = act.length - 1; i >= 0; i--) if (act[i].end < now) dead.push(act.splice(i, 1)[0]);
    for (let i = dead.length - 1; i >= 0; i--) if (dead[i].end + 0.05 < now) { release(dead[i]); dead.splice(i, 1); }
    if (!act.length && !dead.length && reapTimer) { clearInterval(reapTimer); reapTimer = 0; }
  }

  /* ---------------------------------------------------------------- building blocks */
  // Percussive envelope: 0 -> pk (linear, a) -> -60 dB (exponential, d) -> exactly 0 (4 ms).
  function envP(p, t, a, pk, d) {
    pk = Math.max(pk, 1e-4);
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(pk, t + a);
    p.exponentialRampToValueAtTime(pk * 1e-3, t + a + d);
    p.linearRampToValueAtTime(0, t + a + d + 0.004);
    return t + a + d + 0.004;
  }
  // Sustained envelope: 0 -> pk (a), hold h, linear release r to exactly 0.
  function envH(p, t, a, pk, h, r) {
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(pk, t + a);
    p.setValueAtTime(pk, t + a + h);
    p.linearRampToValueAtTime(0, t + a + h + r);
    return t + a + h + r;
  }
  function own(v, src, nodes, end) {
    v.srcs.push(src); for (const n of nodes) v.nodes.push(n);
    if (end > v.end) v.end = end;
  }
  // Building blocks create their nodes at once and queue their scheduling with at(): times inside the
  // queued function are the provisional ones + sh. o: {f2, glide, det, to, hold}
  function tone(v, type, f, t, a, pk, d, o) {
    o = o || {};
    const os = ac.createOscillator(), g = ac.createGain();
    os.type = type;
    os.connect(g); g.connect(o.to || v.g);
    const len = o.hold != null ? a + o.hold + d : a + d + 0.004;   // envH / envP length
    at(v, t, (sh) => {
      const T = t + sh;
      os.frequency.setValueAtTime(f, T);
      if (o.f2) os.frequency.exponentialRampToValueAtTime(o.f2, T + (o.glide || a + d));
      if (o.det) os.detune.setValueAtTime(o.det, T);
      if (o.hold != null) envH(g.gain, T, a, pk, o.hold, d); else envP(g.gain, T, a, pk, d);
      os.start(T); os.stop(T + len + 0.01);
    });
    own(v, os, [os, g], t + len + 0.012);
  }
  // flt: [[type, freq, Q, freq2, glide]]; o: {to, hold, off, env(gainParam, T) with len (s), fq(freqParam, T)}
  function noise(v, t, a, pk, d, flt, o) {
    o = o || {};
    const s = ac.createBufferSource(); s.buffer = NZ; s.loop = true;
    const nodes = [s], bq = [];
    let head = s;
    for (const f of flt) {
      const b = ac.createBiquadFilter(); b.type = f[0];
      head.connect(b); head = b; nodes.push(b); bq.push(b);
    }
    const g = ac.createGain(); nodes.push(g);
    head.connect(g); g.connect(o.to || v.g);
    const off = o.off != null ? o.off : rnd() * 0.95;
    const len = o.env ? o.len : o.hold != null ? a + o.hold + d : a + d + 0.004;
    at(v, t, (sh) => {
      const T = t + sh;
      for (let i = 0; i < bq.length; i++) {
        const f = flt[i], fr = bq[i].frequency;
        if (f[2] != null) bq[i].Q.setValueAtTime(f[2], T);
        if (o.fq) o.fq(fr, T);
        else {
          fr.setValueAtTime(f[1], T);
          if (f[3]) fr.exponentialRampToValueAtTime(f[3], T + (f[4] || a + d));
        }
      }
      if (o.env) o.env(g.gain, T); else if (o.hold != null) envH(g.gain, T, a, pk, o.hold, d); else envP(g.gain, T, a, pk, d);
      s.start(T, off); s.stop(T + len + 0.01);
    });
    own(v, s, nodes, t + len + 0.012);
  }
  // A pre-synthesised buffer (already starts and ends at 0).
  function play(v, buf, t, rate, pk, to) {
    const s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = buf; s.playbackRate.value = rate; g.gain.value = pk;
    s.connect(g); g.connect(to || v.g);
    at(v, t, (sh) => s.start(t + sh));
    own(v, s, [s, g], t + buf.duration / rate + 0.005);
  }
  function panTo(v, p) {
    if (!ac.createStereoPanner) return v.g;
    const n = ac.createStereoPanner(); n.pan.value = clamp(p, -1, 1); n.connect(v.g); v.nodes.push(n);
    return n;
  }
  // env(depthParam, T): optional depth automation (otherwise a fixed depth)
  function lfo(v, rate, depth, param, t, end, env) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = rate; g.gain.value = depth;
    o.connect(g); g.connect(param);
    at(v, t, (sh) => { if (env) env(g.gain, t + sh); o.start(t + sh); o.stop(end + sh); });
    own(v, o, [o, g], end);
  }
  function marimba(v, f, t, pk, d, to) {
    tone(v, 'sine', f, t, 0.0015, pk, d, { to });
    tone(v, 'sine', f * 4, t, 0.0008, pk * 0.28, d * 0.22, { to });
  }
  function bell(v, f, t, pk, d, to) {
    tone(v, 'sine', f, t, 0.0015, pk, d, { to });
    tone(v, 'sine', f * 2, t, 0.0015, pk * 0.3, d * 0.5, { to });
    tone(v, 'sine', f * 2.76, t, 0.001, pk * 0.12, d * 0.18, { to });
  }
  function wood(v, t, f, pk) {
    tone(v, 'sine', f, t, 0.001, pk, 0.06);
    tone(v, 'sine', f * 2.71, t, 0.0007, pk * 0.35, 0.018);
    noise(v, t, 0.0005, pk * 0.5, 0.006, [['bandpass', f * 1.9, 2]]);
  }
  function clatter(v, t, lv, to, hi) {
    play(v, pick(hits()), t, 0.85 + rnd() * 0.5, 0.42 * lv, to);
    const f = PENTA[(hi ? 3 : 0) + ((rnd() * (hi ? 10 : 12)) | 0)];
    tone(v, 'triangle', f, t, 0.0012, 0.2 * lv * loud(f), 0.035, { to });
  }

  /* ---------------------------------------------------------------- the CLACK */
  function clack(o) {
    if (!live()) return;
    o = o || {};
    const combo = Math.floor(fin(o.combo, 0));
    const idx = ((combo % 10) + 10) % 10;
    const mass = clamp(fin(o.mass, 1), 0, 4);
    const edges = clamp(Math.round(fin(o.edges, 1)), 1, 3);
    const grade = o.grade === 'perfect' || o.grade === 'great' ? o.grade : 'clack';
    const v = voice(0, 0.1, o.pan), t = v.t0;
    const bright = grade === 'clack' ? 0.9 : 1;
    // 1. the snap: magnet + plastic click (+-3% rate jitter so no two are identical)
    play(v, pick(SNAP), t, (grade === 'clack' ? 0.94 : 1) * (1 + (rnd() - 0.5) * 0.06), 0.34 * bright);
    // 2. the tock: triangle on the pentatonic note for this combo, a quick strike bend down
    //    into pitch, +-0.5% human variation (stays in tune with the groove)
    const f = PENTA[idx] * (1 + (rnd() - 0.5) * 0.01), tl = (grade === 'perfect' ? 0.38 : 0.34) * loud(f);
    tone(v, 'triangle', f * 1.015, t, 0.0015, tl, 0.045, { f2: f, glide: 0.008 });
    tone(v, 'sine', f * 2, t, 0.001, tl * 0.22, 0.016);
    // 3. the body: 160 Hz sine, 60 ms, scaled by mass (triangle 0.45 .. cube 3)
    const bl = 0.38 * clamp(Math.sqrt(Math.max(mass, 0.01)), 0.45, 1.6);
    tone(v, 'sine', 160, t, 0.0025, bl, 0.06, { f2: 118, glide: 0.06 });
    // 4. extra edges: 28 ms apart, each a fifth higher (3 pentatonic steps: always in key),
    //    as marimba notes, so a DOUBLE / TRIPLE is a quick little run
    for (let k = 1; k < edges; k++) {
      const tk = t + 0.028 * k, fk = PENTA[idx + 3 * k];
      play(v, pick(SNAP), tk, 1 + 0.07 * k, 0.26);
      marimba(v, fk, tk, 0.26 * loud(fk), 0.15);
    }
    if (grade === 'perfect') ting(v, t + 0.012);
  }
  function ting(v, t) {   // PERFECT: C7 + G7 (2093 / 3136 Hz), 250 ms, with a beating shimmer and two glints
    tone(v, 'sine', 2093, t, 0.002, 0.1, 0.3);
    tone(v, 'sine', 2097.5, t, 0.002, 0.05, 0.26);
    tone(v, 'sine', 3136, t, 0.002, 0.07, 0.25);
    tone(v, 'sine', 2637, t + 0.045, 0.002, 0.035, 0.12);
    tone(v, 'sine', 4186, t + 0.085, 0.002, 0.025, 0.1);
  }

  /* ---------------------------------------------------------------- small sounds */
  function zzip(pan) {   // band-passed noise 800 -> 3000 Hz over 70 ms, swelling into the clack
    if (!live()) return;
    const v = voice(0, 0.1, pan), t = v.t0;
    noise(v, t, 0.055, 0.3, 0.02, [['bandpass', 800, 3, 3000, 0.07], ['highpass', 450, -3]]);
    const buzz = ac.createBiquadFilter(); buzz.type = 'bandpass'; buzz.Q.value = 2;
    buzz.connect(v.g); v.nodes.push(buzz);
    at(v, t, (sh) => { buzz.frequency.setValueAtTime(1200, t + sh); buzz.frequency.exponentialRampToValueAtTime(3200, t + sh + 0.07); });
    tone(v, 'sawtooth', 95, t, 0.05, 0.16, 0.022, { f2: 170, glide: 0.07, to: buzz });
  }
  function miss(pan) {   // dull low-passed tok
    if (!live()) return;
    const v = voice(0, 0.15, pan), t = v.t0;
    noise(v, t, 0.002, 0.22, 0.07, [['lowpass', 700, 0]]);
    tone(v, 'triangle', 200, t, 0.002, 0.2, 0.09, { f2: 120, glide: 0.08 });
    tone(v, 'sine', 95, t, 0.003, 0.16, 0.08, { f2: 70 });
  }
  function aww() {   // a soft two-note "aw-aww" (G4, E4 drooping), sung through two vowel formants
    if (!live()) return;
    const v = voice(0, 0.9, 0), t0 = v.t0 + 0.11;
    const note = (t, f, h, droop) => {
      const len = 0.03 + h + 0.08;
      const o = ac.createOscillator(); o.type = 'sawtooth';
      if (droop) lfo(v, 5.5, 16, o.detune, t, t + len + 0.01);
      const f1 = ac.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 3;
      const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 4;
      const g2 = ac.createGain(); g2.gain.value = 0.6;
      const g = ac.createGain();
      o.connect(f1); o.connect(f2); f2.connect(g2); f1.connect(g); g2.connect(g); g.connect(v.g);
      at(v, t, (sh) => {
        const T = t + sh, end = T + len;
        o.frequency.setValueAtTime(f, T);
        if (droop) { o.frequency.setValueAtTime(f, T + h * 0.45); o.frequency.exponentialRampToValueAtTime(f * 0.944, end); }
        f1.frequency.setValueAtTime(380, T); f1.frequency.exponentialRampToValueAtTime(640, T + 0.08);
        f2.frequency.setValueAtTime(720, T); f2.frequency.exponentialRampToValueAtTime(980, T + 0.08);
        envH(g.gain, T, 0.03, 0.24, h, 0.08);
        o.start(T); o.stop(end + 0.01);
      });
      own(v, o, [o, f1, f2, g2, g], t + len + 0.012);
    };
    note(t0, 392, 0.12, false);
    note(t0 + 0.2, 329.63, 0.26, true);
  }
  function poke(pan) {   // a finger flick: soft tap + a little rising "bwip"
    if (!live()) return;
    const v = voice(0, 0.12, pan), t = v.t0;
    noise(v, t, 0.001, 0.18, 0.03, [['bandpass', 1700, 1.4]]);
    tone(v, 'sine', 520, t + 0.004, 0.003, 0.12, 0.07, { f2: 900, glide: 0.05 });
  }
  function uiClick() {
    if (!live()) return;
    const v = voice(0, 0.06, 0), t = v.t0;
    play(v, pick(SNAP), t, 1.3, 0.12);
    tone(v, 'sine', 1567.98, t, 0.001, 0.05, 0.03);
  }
  function tally(i) {   // rapid tally tick, climbing the pentatonic with i, ping-ponging slightly L/R
    if (!live()) return;
    i = Math.floor(fin(i, 0));
    const v = voice(0, 0.07, (i & 1) ? 0.18 : -0.18), t = v.t0, f = PENTA[((i % 10) + 10) % 10];
    play(v, pick(SNAP), t, 1.12, 0.22);
    tone(v, 'triangle', f, t, 0.0012, 0.2 * loud(f), 0.035);
  }
  function cubeFold(i) {   // 5 hinge clacks, rising C6 D6 E6 G6 A6
    if (!live()) return;
    i = clamp(Math.floor(fin(i, 0)), 0, 4);
    const v = voice(0, 0.07, 0), t = v.t0, f = PENTA[5 + i];
    play(v, pick(SNAP), t, 1.2 + 0.04 * i, i === 4 ? 0.19 : 0.14);
    tone(v, 'triangle', f, t, 0.0012, (i === 4 ? 0.16 : 0.12) * loud(f), 0.03);
  }
  function fuseTick(kind) {
    if (!live()) return;
    const v = voice(0, 0.15, 0), t = v.t0;
    if (kind === 'last') { wood(v, t, 1760, 0.14); wood(v, t + 0.075, 1760, 0.16); }
    else wood(v, t, 1567.98, kind === 'threeq' ? 0.12 : 0.09);
  }
  function clockTick(n) {   // wood-block tick-tock; 3, 2, 1 louder with a little body
    if (!live()) return;
    n = Math.round(fin(n, 5));
    const v = voice(0, 0.12, 0), t = v.t0, f = (n & 1) ? 1046.5 : 783.99, big = n <= 3;
    wood(v, t, f, big ? 0.26 : 0.13);
    if (big) tone(v, 'sine', f / 4, t, 0.002, 0.14, 0.08);
  }
  function bonk() {   // bump car impact: rubbery pitch drop
    if (!live()) return;
    const v = voice(0, 0.3, 0), t = v.t0;
    tone(v, 'triangle', 440, t, 0.002, 0.22, 0.16, { f2: 150, glide: 0.09 });
    tone(v, 'sine', 220, t, 0.002, 0.17, 0.14, { f2: 90, glide: 0.1 });
    play(v, pick(SNAP), t, 0.8, 0.16);
  }
  function honk() {   // beep-beep: two slightly detuned squares on E5 (659 Hz) through a soft low-pass
    if (!live()) return;
    const v = voice(0, 0.4, 0), t = v.t0;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 1;
    lp.connect(v.g); v.nodes.push(lp);
    for (const dt of [0, 0.17]) {
      tone(v, 'square', 659.26, t + dt, 0.006, 0.09, 0.022, { hold: 0.09, to: lp });
      tone(v, 'square', 662.6, t + dt, 0.006, 0.06, 0.022, { hold: 0.09, to: lp });
    }
  }
  function thumpAt(v, t, k) {
    tone(v, 'sine', 95, t, 0.003, 0.55 * k, 0.3, { f2: 44, glide: 0.2 });
    tone(v, 'triangle', 190, t, 0.002, 0.16 * k, 0.09, { f2: 85, glide: 0.08 });
    noise(v, t, 0.002, 0.3 * k, 0.14, [['lowpass', 300, 0]]);
  }
  function thump() {   // the foot lands: 60 Hz-ish thump + a puff of rug fluff
    if (!live()) return;
    const v = voice(1, 0.45, 0), t = v.t0;
    thumpAt(v, t, 1);
    noise(v, t, 0.003, 0.09, 0.07, [['bandpass', 900, 0.7]]);
  }
  function whooo(dur) {   // rising filtered-noise "whooo" for dur seconds (the foot's shadow grows)
    if (!live()) return;
    dur = clamp(fin(dur, 1), 0.2, 3);
    const v = voice(0, dur + 0.15, 0), t = v.t0, len = dur + 0.05;
    const swell = (pk) => (p, T) => {
      const e = T + dur;
      p.setValueAtTime(0, T); p.linearRampToValueAtTime(pk * 0.2, T + dur * 0.5);
      p.linearRampToValueAtTime(pk, e - 0.01); p.linearRampToValueAtTime(0, e + 0.05);
    };
    noise(v, t, 0, 0, 0, [['bandpass', 220, 4.5, 1100, dur]], { env: swell(0.45), len });
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800; lp.connect(v.g); v.nodes.push(lp);
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle';
    lfo(v, 5, 25, o.detune, t, t + dur + 0.07);
    o.connect(g); g.connect(lp);
    at(v, t, (sh) => {
      const T = t + sh;
      o.frequency.setValueAtTime(170, T); o.frequency.exponentialRampToValueAtTime(340, T + dur);
      swell(0.16)(g.gain, T);
      o.start(T); o.stop(T + len + 0.01);
    });
    own(v, o, [o, g], t + len + 0.012);
  }
  function heartbeat(t) {   // lub-dub, above creak level 0.9; returns when it really starts
    const v = voice(0, 0.35, 0);
    for (const [dt, k] of [[0, 1], [0.17, 0.7]]) {
      tone(v, 'sine', 64, t + dt, 0.004, 0.5 * k, 0.16, { f2: 46, glide: 0.12 });
      tone(v, 'triangle', 128, t + dt, 0.003, 0.12 * k, 0.07, { f2: 92, glide: 0.06 });
    }
    return t + go(v);
  }

  /* ---------------------------------------------------------------- creak (continuous) */
  // The game feeds creak() every frame while it runs. When it stops feeding (pause overlay, menu, a
  // phase that skips the update), a watchdog fades the creak out by itself instead of droning on.
  let CR = null, crBeat = 0, crFed = 0;
  const wall = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  function creakWatch() { if (CR && wall() - crFed > 250) creakOff(); }
  function creakOn() {
    const n = [];
    const mk = (node) => { n.push(node); return node; };
    const o = mk(ac.createOscillator()); o.type = 'sawtooth'; o.frequency.value = 55;
    const lf = mk(ac.createOscillator()); lf.frequency.value = 5;
    const lfF = mk(ac.createGain()); lfF.gain.value = 6;     // +-6 Hz pitch wobble
    const lfB = mk(ac.createGain()); lfB.gain.value = 70;    // +-70 Hz band wobble
    const lfA = mk(ac.createGain()); lfA.gain.value = 0.35;  // tremolo 0.3 .. 1.0
    const bp = mk(ac.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 8;
    const bp2 = mk(ac.createBiquadFilter()); bp2.type = 'bandpass'; bp2.frequency.value = 1150; bp2.Q.value = 6;
    const g2 = mk(ac.createGain()); g2.gain.value = 0.35;
    const am = mk(ac.createGain()); am.gain.value = 0.65;
    const g = mk(ac.createGain()); g.gain.value = 0;
    lf.connect(lfF); lfF.connect(o.frequency); lf.connect(lfB); lfB.connect(bp.frequency); lf.connect(lfA); lfA.connect(am.gain);
    o.connect(bp); o.connect(bp2); bp2.connect(g2); bp.connect(am); g2.connect(am); am.connect(g); g.connect(sfxBus);
    o.start(); lf.start();   // at once: silent (gain 0) until creak() ramps the gain up
    CR = { n, o, lf, g, v: 0, quiet: 0, wd: setInterval(creakWatch, 100) };
  }
  function creakOff() {
    const c = CR, T = ac.currentTime + LAT; CR = null;
    clearInterval(c.wd);
    try { hold(c.g.gain, T); c.g.gain.linearRampToValueAtTime(0, T + 0.03); c.o.stop(T + 0.06); c.lf.stop(T + 0.06); } catch (e) { /* ignore */ }
    setTimeout(() => { for (const x of c.n) { try { x.disconnect(); } catch (e) { /* ignore */ } } }, 300);
  }
  function creak(level) {
    if (!ac) return;
    level = fin(level, 0);
    if (level <= 0.4 && !CR) return;   // the per-frame hot path: one compare
    crFed = wall();
    if (!ready()) return;
    const now = ac.currentTime;
    const v = muted || level <= 0.4 ? 0 : Math.pow(Math.min(1, (level - 0.4) / 0.6), 2);
    if (v > 0.002 && !CR) creakOn();
    if (CR) {
      if (Math.abs(v - CR.v) > 0.008 || (v === 0 && CR.v !== 0)) {
        const T = ac.currentTime + LAT;   // read after creakOn() built its nodes
        CR.g.gain.setTargetAtTime(v * CREAK_PK, T, 0.05);
        CR.o.frequency.setTargetAtTime(55 + 25 * v, T, 0.15);
        CR.v = v;
      }
      if (v === 0) { if (!CR.quiet) CR.quiet = now; else if (now - CR.quiet > 0.5) creakOff(); }
      else CR.quiet = 0;
    }
    if (level > 0.9 && !muted && now + 0.08 >= crBeat) crBeat = heartbeat(Math.max(now + LAT, crBeat)) + 0.62;
  }

  /* ---------------------------------------------------------------- big moments */
  function save() {   // wheel slaps down (thump), rising whoosh, C major chord
    if (!live()) return;
    const v = voice(1, 1.2, 0), t = v.t0;
    thumpAt(v, t, 0.8);
    noise(v, t + 0.03, 0.3, 0.22, 0.08, [['bandpass', 350, 1.3, 3800, 0.34]]);
    [523.25, 659.26, 783.99, 1046.5].forEach((f, k) => {
      const tk = t + 0.33 + 0.018 * k;
      tone(v, 'triangle', f, tk, 0.003, 0.1 * loud(f), 0.75);
      tone(v, 'sine', f * 2, tk, 0.002, 0.03, 0.3);
    });
  }
  function whistleAt(t) {   // slide whistle 1200 -> 300 Hz over 0.6 s (after a 50 ms swoop up); t: when (null = now)
    const now = ac.currentTime;
    if (now - lastWhistle < 0.3) return;   // one whistle per crash, even if the game also calls whistle()
    lastWhistle = now;
    const v = voice(2, 0.9, 0);
    if (t == null || t < v.t0) t = v.t0;
    const fr = (p, T) => { p.setValueAtTime(1000, T); p.exponentialRampToValueAtTime(1200, T + 0.05); p.exponentialRampToValueAtTime(300, T + 0.65); };
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine';
    lfo(v, 6.5, 0, o.detune, t, t + 0.75, (p, T) => { p.setValueAtTime(0, T); p.linearRampToValueAtTime(30, T + 0.35); });
    o.connect(g); g.connect(v.g);
    at(v, t, (sh) => {
      const T = t + sh;
      fr(o.frequency, T);
      g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(0.2, T + 0.03);
      g.gain.setValueAtTime(0.2, T + 0.5); g.gain.linearRampToValueAtTime(0, T + 0.74);
      o.start(T); o.stop(T + 0.75);
    });
    own(v, o, [o, g], t + 0.752);
    // breath: narrow band-passed noise that follows the pitch
    noise(v, t, 0.03, 0.05, 0.21, [['bandpass', 1000, 9]], { hold: 0.47, fq: fr });
  }
  function whistle() { if (live()) whistleAt(null); }
  function crash(n, x) {   // un-clack crack now, a slam, 20-40 clatter tocks over 0.8 s, slide whistle
    if (!live()) return;
    n = clamp(Math.round(fin(n, 12)), 1, 200); x = clamp(fin(x, 0), -1, 1);
    duck(1);
    const v = voice(1, 1.2, 0), t = v.t0;
    const P = [];
    for (let k = 0; k < 5; k++) P.push(panTo(v, x + (k - 2) * 0.28));
    const C = P[2];
    play(v, snapN(0), t, 0.72, 0.42, C);
    play(v, snapN(1), t + 0.011, 0.6, 0.3, C);
    noise(v, t, 0.001, 0.3, 0.09, [['bandpass', 1500, 0.8]], { to: C });
    tone(v, 'triangle', 330, t, 0.002, 0.16, 0.08, { f2: 180, glide: 0.08, to: C });
    const ts = t + 0.24;   // the tower slams the rug
    tone(v, 'sine', 85, ts, 0.004, 0.5, 0.32, { f2: 42, glide: 0.25, to: C });
    tone(v, 'triangle', 170, ts, 0.003, 0.16, 0.12, { f2: 80, glide: 0.1, to: C });
    noise(v, ts, 0.003, 0.32, 0.18, [['lowpass', 380, 0]], { to: C });
    const cnt = clamp(Math.round(14 + n * 0.75), 20, 40);
    for (let k = 0; k < cnt; k++) {
      const u = (k + rnd()) / cnt, tk = t + 0.03 + 0.8 * Math.pow(u, 1.35);
      const lv = (0.8 - 0.45 * u) * (0.55 + 0.45 * rnd()), to = pick(P);
      clatter(v, tk, lv, to, false);
      if (rnd() < 0.3) play(v, pick(hits()), tk + 0.03 + rnd() * 0.05, 0.9 + rnd() * 0.4, 0.18 * lv, to);
    }
    go(v);                     // schedule the crash now, so the whistle can follow its real start
    whistleAt(v.t0 + 0.05);
  }
  function smash() {   // the cube shove: crack + noise boom, the tower bursts in a bright wide clatter
    if (!live()) return;
    duck(1.2);
    const v = voice(1, 1, 0), t = v.t0;
    const P = [];
    for (let k = 0; k < 5; k++) P.push(panTo(v, (k - 2) * 0.42));
    play(v, snapN(2), t, 0.7, 0.4, P[2]);
    noise(v, t, 0.004, 0.55, 0.45, [['lowpass', 600, 0, 110, 0.3]], { to: P[2] });
    tone(v, 'sine', 78, t, 0.004, 0.5, 0.45, { f2: 36, glide: 0.35, to: P[2] });
    tone(v, 'triangle', 160, t, 0.003, 0.18, 0.14, { f2: 70, glide: 0.12, to: P[2] });
    for (let k = 0; k < 18; k++) {
      const u = (k + rnd()) / 18, tk = t + 0.02 + 0.55 * Math.pow(u, 1.25);
      clatter(v, tk, (0.85 - 0.4 * u) * (0.6 + 0.4 * rnd()), pick(P), true);
    }
  }
  function boom() {   // the cube lands: 70 Hz sine drop + noise (the game plays clack() with it)
    if (!live()) return;
    const v = voice(1, 0.6, 0), t = v.t0;
    tone(v, 'sine', 72, t, 0.004, 0.6, 0.42, { f2: 38, glide: 0.3 });
    tone(v, 'triangle', 144, t, 0.003, 0.2, 0.12, { f2: 72, glide: 0.1 });
    noise(v, t, 0.003, 0.38, 0.2, [['lowpass', 420, 0, 150, 0.2]]);
    play(v, pick(SNAP), t + 0.004, 0.68, 0.22);
  }
  function ribbon() {   // the tear, then a C-E-G-C' toy fanfare
    if (!live()) return;
    const v = voice(2, 1.3, 0), t = v.t0;
    const am = ac.createGain(); am.gain.value = 0.55; am.connect(v.g); v.nodes.push(am);
    lfo(v, 55, 0.3, am.gain, t, t + 0.22); lfo(v, 37, 0.15, am.gain, t, t + 0.22);
    noise(v, t, 0.004, 0.42, 0.17, [['bandpass', 1800, 0.9, 5000, 0.18], ['lowpass', 9000, -3]], { to: am });
    const notes = [[523.25, 0.2, 0.07], [659.26, 0.31, 0.07], [783.99, 0.42, 0.07], [1046.5, 0.53, 0.42]];
    for (const [f, dt, h] of notes) {
      const tk = t + dt;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
      lp.connect(v.g); v.nodes.push(lp);
      at(v, tk, (sh) => {
        const T = tk + sh, fr = lp.frequency;
        fr.setValueAtTime(700, T); fr.exponentialRampToValueAtTime(3600, T + 0.03); fr.exponentialRampToValueAtTime(1900, T + 0.15);
      });
      const pk = 0.085 * loud(f);
      tone(v, 'sawtooth', f, tk, 0.012, pk, 0.07, { hold: h, det: -7, to: lp });
      tone(v, 'sawtooth', f, tk, 0.012, pk, 0.07, { hold: h, det: 7, to: lp });
      if (dt > 0.5) bell(v, f * 2, tk, 0.07, 0.6);
    }
  }
  function crown() {   // ding-ding (G6, C7) plus a rising shimmer
    if (!live()) return;
    const v = voice(1, 1.2, 0), t = v.t0;
    bell(v, 1567.98, t, 0.16, 0.9);
    bell(v, 2093, t + 0.13, 0.15, 1.0);
    for (let k = 0; k < 10; k++) {
      const f = PENTA[10 + ((rnd() * 5) | 0)];
      tone(v, 'sine', f, t + 0.12 + k * 0.055 + rnd() * 0.02, 0.002, 0.035, 0.14);
    }
    noise(v, t + 0.1, 0.25, 0.03, 0.35, [['highpass', 7000, -3], ['lowpass', 11000, -3]]);
  }
  function ring() {   // two-note bell: E6 then A6 (a rising fourth, both in the pentatonic)
    if (!live()) return;
    const v = voice(0, 0.7, 0), t = v.t0;
    bell(v, 1318.51, t, 0.15, 0.45);
    bell(v, 1760, t + 0.085, 0.16, 0.6);
  }
  function gear() {   // 6 ratchet clicks speeding up, a whirr as it spins twice, a final seat click
    if (!live()) return;
    const v = voice(0, 1, 0), t = v.t0;
    [0, 0.075, 0.135, 0.185, 0.225, 0.258].forEach((dt, k) => {
      play(v, pick(SNAP), t + dt, 1.1 + 0.03 * k, 0.17);
      tone(v, 'sine', 2600, t + dt, 0.0008, 0.05, 0.015);
    });
    const w0 = t + 0.28, w1 = w0 + 0.42;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1300; hp.Q.value = -3;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 2;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 8000; lp.Q.value = -3;
    hp.connect(bp); bp.connect(lp); lp.connect(v.g); v.nodes.push(hp, bp, lp);
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sawtooth';
    o.connect(g); g.connect(hp);
    at(v, w0, (sh) => {
      const A = w0 + sh, B = w1 + sh;
      o.frequency.setValueAtTime(40, A); o.frequency.exponentialRampToValueAtTime(70, A + 0.15); o.frequency.exponentialRampToValueAtTime(32, B);
      g.gain.setValueAtTime(0, A); g.gain.linearRampToValueAtTime(0.5, A + 0.04);
      g.gain.setValueAtTime(0.5, A + 0.2); g.gain.linearRampToValueAtTime(0, B);
      o.start(A); o.stop(B + 0.01);
    });
    own(v, o, [o, g], w1 + 0.012);
    play(v, pick(SNAP), w1 + 0.02, 1.1, 0.22);
  }
  function newBest() {   // pentatonic run up into a bright chord with bells and sparkle
    if (!live()) return;
    const v = voice(2, 1.8, 0), t = v.t0;
    for (let k = 0; k < 9; k++) { const f = PENTA[k]; marimba(v, f, t + k * 0.04, 0.16 * loud(f), 0.16); }
    const tc = t + 0.4;
    [1046.5, 1318.51, 1567.98].forEach((f) => { tone(v, 'triangle', f, tc, 0.004, 0.08 * loud(f), 1.0); });
    bell(v, 2093, tc, 0.1, 1.2);
    for (let k = 0; k < 8; k++) tone(v, 'sine', PENTA[10 + (k % 5)], tc + 0.08 + k * 0.07, 0.002, 0.03, 0.12);
  }

  /* ---------------------------------------------------------------- music: toy-box groove in C pentatonic */
  // 16 steps per bar, 4-bar loop: C | Am | Dsus | G (all chord tones from C D E G A).
  const ROOT = [48, 45, 50, 43];                              // C3 A2 D3 G2
  const CELL = [[64, 67, 72, 76], [64, 69, 72, 76], [62, 67, 69, 74], [62, 67, 74, 79]];
  const BASS = { 0: 0, 3: 12, 6: 7, 8: 0, 11: 12, 14: 7 };   // tresillo bounce: root, octave, fifth
  const MAR = [[0, 1, 2, 3, 2, 1, 2, 1], [3, 2, 1, 2, 0, 2, 1, 2]];
  const M = { want: false, on: false, level: 1, layers: 1, al: 1, step: 0, next: 0, timer: 0, sess: null, pend: [] };
  const bpm = () => Math.min(150, 120 + 3 * (M.level - 1));
  const stepDur = () => 60 / bpm() / 4;

  function mBegin() {
    if (M.on || !ready()) return;
    M.on = true;
    M.sess = ac.createGain();
    const now = ac.currentTime, T = now + LAT;
    M.sess.gain.setValueAtTime(0, T); M.sess.gain.linearRampToValueAtTime(1, T + 0.05);
    M.sess.connect(musicBus);
    M.step = 0; M.next = now + Math.max(0.06, LAT + 0.05); M.al = M.layers;
    M.timer = setInterval(pump, 25);
    pump();
  }
  function mEnd() {
    if (!M.on) return;
    M.on = false; clearInterval(M.timer); M.timer = 0;
    const T = ac.currentTime + LAT, g = M.sess, pend = M.pend;
    M.sess = null; M.pend = [];
    try { hold(g.gain, T); g.gain.linearRampToValueAtTime(0, T + 0.06); } catch (e) { /* ignore */ }
    for (const n of pend) for (const s of n.srcs) { try { s.stop(T + 0.07); } catch (e) { /* ignore */ } }
    setTimeout(() => { for (const n of pend) release(n); try { g.disconnect(); } catch (e) { /* ignore */ } }, 300);
  }
  // Lookahead scheduler: a 25 ms timer schedules every step that starts within the next 100 ms (beyond
  // the LAT minimum lead) at exact audio-clock times (next += stepDur), so it never drifts with timer
  // jitter. A step is never shifted off the grid: one that can no longer start on time is skipped.
  function pump() {
    if (!M.on || !ready()) return;
    const now = ac.currentTime, lo = now + LAT + 0.002;   // earliest safe step time (+2 ms to build it)
    if (M.next < lo) {   // fell behind (throttled timer, resumed context): skip, stay on the grid
      const k = Math.ceil((lo - M.next) / stepDur());
      M.next += k * stepDur(); M.step += k;
    }
    while (M.next < now + LAT + 0.1) {
      if ((M.step & 3) === 0) M.al = M.layers;   // layer changes land on the beat
      if (!muted) mStep(M.step, M.next);
      M.next += stepDur(); M.step++;
    }
    let w = 0;
    for (const n of M.pend) { if (n.end + 0.05 < now) release(n); else M.pend[w++] = n; }
    M.pend.length = w;
  }
  function mStep(s, t) {
    const st = s & 15, bar = (s >> 4) & 3, phrase = (s >> 6) & 1, L = M.al;
    const k = { g: M.sess, nodes: [], srcs: [], end: t, t0: t, q: [], first: Infinity };
    if (st === 0 || st === 8 || (L >= 2 && bar === 3 && st === 14)) kick(k, t, st === 0 ? 1 : 0.85, s);
    // shaker on the eighths, accented on the "and"s; noise offsets come from the step number, not the
    // RNG, so a layer change never alters the others
    if ((st & 1) === 0) noise(k, t, 0.008, (st & 3) === 2 ? 1 : 0.55, 0.085, [['bandpass', 7500, 0.9], ['highpass', 4000, -3]], { to: k.g, off: (s * 0.377) % 0.95 });
    if (L >= 2 && BASS[st] !== undefined) {
      const f = midiHz(ROOT[bar] + BASS[st]);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
      lp.connect(k.g); k.nodes.push(lp);
      at(k, t, (sh) => { lp.frequency.setValueAtTime(1700, t + sh); lp.frequency.exponentialRampToValueAtTime(260, t + sh + 0.14); });
      tone(k, 'sawtooth', f, t, 0.004, 0.34, 0.3, { to: lp });
      tone(k, 'sine', f, t, 0.004, 0.2, 0.3, { to: k.g });
    }
    if (L >= 3 && (st & 1) === 0) {
      const f = midiHz(CELL[bar][MAR[phrase][st >> 1]]);
      marimba(k, f, t, 0.27, 0.45, k.g);
    }
    if (L >= 4 && (st === 4 || st === 12)) clap(k, t, (s * 0.611) % 0.95);
    if (L >= 5) {
      const beatUp = ((st >> 2) & 1) === 0, j = beatUp ? (st & 3) : 3 - (st & 3);
      const f = midiHz(CELL[bar][j] + 24);
      tone(k, 'sine', f, t, 0.002, 0.3 * loud(f), 0.16, { to: k.g });
    }
    if (!k.srcs.length) return;
    if (go(k, true) < 0) { release(k); return; }   // built too late to start on time: drop it, keep the grid
    M.pend.push(k);
  }
  // Toy drum. The 140 -> 48 Hz sine drop is the thump, felt on headphones but inaudible on phone and
  // laptop speakers, so its 2nd and 3rd harmonics glide with it (small speakers still hear the body's
  // pitch), and a triangle + noise knock gives the beater "tok" that reads on any speaker. Levels set
  // so the x1 groove (kick + shaker) is about -39 dB(A) / 400 ms, ~15 dB under a clack, and the
  // kick peaks stay out of the compressor's knee.
  function kick(k, t, a, s) {
    tone(k, 'sine', 140, t, 0.002, 0.65 * a, 0.24, { f2: 48, glide: 0.09, to: k.g });
    tone(k, 'sine', 280, t, 0.002, 0.35 * a, 0.12, { f2: 96, glide: 0.09, to: k.g });
    tone(k, 'sine', 420, t, 0.002, 0.3 * a, 0.08, { f2: 144, glide: 0.09, to: k.g });
    tone(k, 'triangle', 320, t, 0.001, 0.55 * a, 0.065, { f2: 130, glide: 0.035, to: k.g });
    noise(k, t, 0.0008, 0.5 * a, 0.022, [['bandpass', 1600, 1.2]], { to: k.g, off: (s * 0.519) % 0.95 });
  }
  function clap(k, t, off) {   // three micro-bursts and a tail
    noise(k, t, 0, 0, 0, [['highpass', 600, -3], ['bandpass', 1300, 1]], {
      to: k.g,
      off,
      len: 0.191,
      env: (p, T) => {
        const pk = 2.2;
        p.setValueAtTime(0, T);
        for (let i = 0; i < 3; i++) { const ti = T + i * 0.009; p.linearRampToValueAtTime(pk, ti + 0.0008); p.exponentialRampToValueAtTime(pk * 0.12, ti + 0.008); }
        const tt = T + 0.027;
        p.linearRampToValueAtTime(pk, tt + 0.001); p.exponentialRampToValueAtTime(pk * 1e-3, tt + 0.16); p.linearRampToValueAtTime(0, tt + 0.164);
      },
    });
  }
  function duck(sec) {
    if (!ready()) return;
    sec = clamp(fin(sec, 1), 0.05, 5);
    const T = ac.currentTime + LAT, until = T + sec, p = duckG.gain;
    if (until <= duckUntil) return;
    hold(p, T);
    p.linearRampToValueAtTime(DUCK_TO, T + 0.04);
    p.setValueAtTime(DUCK_TO, until);
    p.linearRampToValueAtTime(1, until + 0.4);
    duckUntil = until;
  }

  /* ---------------------------------------------------------------- unlock, mute, visibility */
  function onState() {
    if (!ac) return;
    if (ac.state === 'running') { if (M.want) mBegin(); }
    else if (!hiddenSusp) arm();   // iOS interruption etc.: the next gesture resumes
  }
  function arm() {   // also retry on touchend / click (older iOS only unlocks audio there)
    if (armed || typeof window === 'undefined' || !window.addEventListener) return;
    armed = true;
    const evs = ['touchend', 'pointerup', 'click', 'keyup'];
    const h = () => {
      unlock();
      if (ac && ac.state === 'running') { evs.forEach((e) => window.removeEventListener(e, h, true)); armed = false; }
    };
    evs.forEach((e) => window.addEventListener(e, h, true));
  }
  function onVis() {
    if (!ac) return;
    try {
      if (document.hidden) { if (ac.state === 'running') { hiddenSusp = true; ac.suspend(); } }
      else if (hiddenSusp) { hiddenSusp = false; ac.resume(); }
    } catch (e) { /* ignore */ }
  }
  function unlock() {
    unlocked = true;
    if (!ac) {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return;
      try { ac = new AC({ latencyHint: 'interactive' }); } catch (e) { ac = new AC(); }
      LAT = clamp(fin(ac.baseLatency, 0), 0.006, 0.04);
      build();
      ac.onstatechange = onState;
      if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', onVis);
      // iOS: play one silent sample inside the gesture
      const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, ac.sampleRate);
      s.connect(ac.destination); s.onended = () => { try { s.disconnect(); } catch (e) { /* ignore */ } }; s.start(0);
    }
    if (ac.state !== 'running' && ac.state !== 'closed' && !hiddenSusp) {
      const p = ac.resume();
      if (p && p.then) p.then(onState, () => {});
    }
    if (ac.state === 'running') onState(); else arm();
  }
  function setMuted(b) {
    muted = !!b;
    if (!ac || !master) return;
    const T = ac.currentTime + LAT;
    hold(master.gain, T);
    master.gain.setTargetAtTime(muted ? 0 : 1, T, 0.012);
  }

  /* ---------------------------------------------------------------- public API */
  // Every entry point ends by scheduling the voices it built (flush), after their last node exists.
  const guard = (name, fn) => function () {
    try { const r = fn.apply(null, arguments); flush(true); return r; } catch (e) {
      try { flush(false); } catch (e2) { /* ignore */ }
      if (!errs[name]) { errs[name] = 1; console.error('Sfx.' + name + ' failed: ' + (e && e.message)); }
    }
    return undefined;
  };
  return {
    unlock: guard('unlock', unlock),
    setMuted: guard('setMuted', setMuted),
    get muted() { return muted; },
    clack: guard('clack', clack),
    zzip: guard('zzip', zzip),
    miss: guard('miss', miss),
    aww: guard('aww', aww),
    poke: guard('poke', poke),
    creak: guard('creak', creak),
    save: guard('save', save),
    crash: guard('crash', crash),
    whistle: guard('whistle', whistle),
    smash: guard('smash', smash),
    tally: guard('tally', tally),
    ribbon: guard('ribbon', ribbon),
    crown: guard('crown', crown),
    ring: guard('ring', ring),
    gear: guard('gear', gear),
    cubeFold: guard('cubeFold', cubeFold),
    boom: guard('boom', boom),
    honk: guard('honk', honk),
    bonk: guard('bonk', bonk),
    whooo: guard('whooo', whooo),
    thump: guard('thump', thump),
    fuseTick: guard('fuseTick', fuseTick),
    clockTick: guard('clockTick', clockTick),
    newBest: guard('newBest', newBest),
    uiClick: guard('uiClick', uiClick),
    haptic: guard('haptic', (p) => {
      if (!unlocked || typeof navigator === 'undefined' || !navigator.vibrate) return;
      const ua = navigator.userActivation;
      if (ua && !ua.hasBeenActive) return;   // avoids the browser's "blocked vibrate" intervention
      navigator.vibrate(p);
    }),
    music: {
      start: guard('music.start', () => { M.want = true; mBegin(); }),
      stop: guard('music.stop', () => { M.want = false; mEnd(); }),
      setLevel: guard('music.setLevel', (l) => { M.level = clamp(Math.round(fin(l, 1)), 1, 999); pump(); }),
      setMult: guard('music.setMult', (m) => { M.layers = clamp(Math.round(fin(m, 1)), 1, 5); pump(); }),
      duck: guard('music.duck', duck),
    },
    stats: guard('stats', () => {
      reap();
      return { state: ac ? ac.state : 'none', voices: act.length, peakVoices, layers: M.on ? M.layers : 0, muted };
    }),
  };
})();
