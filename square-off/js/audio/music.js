/* SQUARE OFF — adaptive busker-band sequencer (DESIGN §9).
 * SQ.audioMusic.create(ctx, outNode, lib) → sequencer. Created by js/audio/audio.js once the
 * AudioContext is unlocked; game code talks to it through SQ.audio.setMusic(...).
 *
 * The band: bucket drums by day (brushed jazz kit at Night and in menus), upright bass,
 * piano comping, and a lead voice chosen by the player's crew (Hustle: piano, Noise: tenor sax,
 * Violets: vibraphone, Pack: muted trumpet). 96 BPM, swung, F major pentatonic.
 * Layers: drums, +bass, +keys, +lead (one per 2 landmarks held). +8 BPM near the Turf target,
 * minor variant while behind, intensity (combat) drives drum density, fills and lead activity.
 */
(function (SQ) {
  'use strict';

  var PC = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
  var CHORD = { maj7: [0, 4, 7, 11], '6': [0, 4, 7, 9], m7: [0, 3, 7, 10], '7': [0, 4, 7, 10], m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9], m6: [0, 3, 7, 9] };
  var VOICE = { maj7: [4, 7, 11, 14], '6': [4, 7, 9, 14], m7: [3, 7, 10, 14], '7': [4, 9, 10, 14], m7b5: [3, 6, 10, 12], dim7: [3, 6, 9, 12], m6: [3, 7, 9, 14] };
  function P(s) { return s.split(' ').map(function (c) { var m = /^([A-G]b?)(.*)$/.exec(c); return { root: PC[m[1]], q: m[2] }; }); }
  var PROG = {
    calmA: P('Fmaj7 Dm7 Gm7 C7 Am7 D7 Gm7 C7'),
    calmB: P('F6 F7 Bb6 Bdim7 F6 D7 Gm7 C7'),
    minor: P('Dm7 Dm7 Gm7 A7 Dm7 Bbmaj7 Em7b5 A7'),
    night: P('Gm7 C7 Fmaj7 D7 Gm7 C7 Am7 D7'),
    menu: P('Fmaj7 Bb7 Am7 D7 Gm7 C7 F6 C7'),
    victory: P('F6 Bb6 C7 F6'),
    defeat: P('Dm7 Bbmaj7 Gm6 A7')
  };
  var PENT = [5, 7, 9, 0, 2];          // F major pentatonic == D minor pentatonic
  var BLUE = 8;                        // Ab: the blue note over D minor
  var LEADS = {
    hustle: { inst: 'piano', lo: 67, hi: 86, vel: 0.62, gain: 0.4 },
    noise: { inst: 'sax', lo: 58, hi: 77, vel: 0.7, gain: 0.85 },
    violets: { inst: 'vibes', lo: 65, hi: 86, vel: 0.7, gain: 0.48 },
    pack: { inst: 'trumpet', lo: 60, hi: 79, vel: 0.62, gain: 1.3 }
  };
  // Scripted 4-bar phrases: [beat from section start, midi, beats]
  var VICTORY_LINE = [[0, 65, 0.5], [0.5, 69, 0.5], [1, 72, 0.5], [1.5, 77, 2.5], [4, 74, 0.5], [4.5, 77, 0.5], [5, 79, 1.5], [6.5, 77, 0.5], [7, 74, 1],
    [8, 76, 0.5], [8.5, 79, 0.5], [9, 82, 0.5], [9.5, 79, 0.5], [10, 76, 1], [11, 72, 1], [12, 77, 3.5]];
  var DEFEAT_LINE = [[0, 69, 1.5], [1.5, 67, 0.5], [2, 65, 2], [4, 62, 1], [5, 65, 1], [6, 64, 2], [8, 62, 1.5], [9.5, 60, 0.5], [10, 58, 2], [12, 61, 1], [13, 57, 3]];

  function create(ctx, out, lib) {
    var I = lib.inst, rnd = lib.rnd, pick = lib.pick, clamp = lib.clamp, chance = lib.chance;
    var master = ctx.createGain(); master.gain.value = 0; master.connect(out);
    var send = ctx.createGain(); send.gain.value = 0.22; master.connect(send);
    try { send.connect(lib.reverb()); } catch (e) { /* no reverb */ }
    function layer(v) { var g = ctx.createGain(); g.gain.value = v; g.connect(master); return g; }
    var LG = { drums: layer(0.85), bass: layer(0), keys: layer(0), lead: layer(0) };
    var LEVEL = { drums: 0.85, bass: 0.32, keys: 0.5, lead: 0.62 };

    var S = {
      state: 'off', faction: null, intensity: 0.2, target: 0.2, layers: 2, layersSet: false,
      minor: false, night: false, nearWin: false,
      pending: null, section: null, secBar: 0, nextBar: 0, bar: 0, tempo: 96,
      phrase: null, prevRhythm: null, bassPrev: 41, leadPrev: 69, timer: null, on: { drums: true, bass: false, keys: false, lead: false }
    };

    function sectionFor(state) {
      var night = S.night, minor = S.minor;
      switch (state) {
        case 'menu': return { name: 'menu', prog: PROG.menu, drums: 'brush', tempo: 92, keys: 'piano', layers: 3, maxI: 0.35, bass: 'walk', leadFaction: S.faction || 'hustle' };
        case 'tense': return { name: 'tense', prog: PROG.minor, drums: night ? 'brush' : 'bucket', tempo: 100, keys: night ? 'epiano' : 'piano', layersAdd: 1, minI: 0.55, bass: 'walk' };
        case 'victory': return { name: 'victory', prog: PROG.victory, drums: 'bucket', tempo: 112, keys: 'piano', layers: 3, fixedI: 0.85, bass: 'walk', line: VICTORY_LINE, bars: 4, then: 'celebrate' };
        case 'celebrate': return { name: 'celebrate', prog: PROG.calmA, alt: PROG.calmB, drums: 'bucket', tempo: 104, keys: 'piano', layers: 3, fixedI: 0.6, bass: 'walk' };
        case 'defeat': return { name: 'defeat', prog: PROG.defeat, drums: 'brush', tempo: 72, keys: 'epiano', layers: 3, fixedI: 0.1, bass: 'two', line: DEFEAT_LINE, bars: 4, then: 'blues' };
        case 'blues': return { name: 'blues', prog: PROG.minor, drums: 'brush', tempo: 72, keys: 'epiano', layers: 2, fixedI: 0.12, bass: 'walk' };
        default: // calm
          if (minor) return { name: 'calm-minor', prog: PROG.minor, drums: night ? 'brush' : 'bucket', tempo: 96, keys: night ? 'epiano' : 'piano', bass: 'auto' };
          if (night) return { name: 'calm-night', prog: PROG.night, drums: 'brush', tempo: 96, keys: 'epiano', bass: 'walk' };
          return { name: 'calm', prog: PROG.calmA, alt: PROG.calmB, drums: 'bucket', tempo: 96, keys: 'piano', bass: 'auto' };
      }
    }

    // ----------------------------------------------------------- timing
    function swingPos(frac, s8, s16) {
      var a, b, l;
      if (frac < 0.5) { a = 0; b = s8; l = frac / 0.5; } else { a = s8; b = 1; l = (frac - 0.5) / 0.5; }
      if (Math.abs(l - 0.5) < 1e-6) l = s16;
      return a + (b - a) * l;
    }
    function timeOf(t0, spb, beat, s8, s16) { var whole = Math.floor(beat); return t0 + (whole + swingPos(beat - whole, s8, s16)) * spb; }

    // ----------------------------------------------------------- harmony helpers
    function chordAt(sec, barInSec) {
      var prog = sec.prog;
      if (sec.alt && Math.floor(barInSec / prog.length) % 2 === 1) prog = sec.alt;
      return prog[barInSec % prog.length];
    }
    function nearest(pc, ref, lo, hi) {
      var best = null, bd = 1e9;
      for (var m = lo; m <= hi; m++) if (((m % 12) + 12) % 12 === pc) { var d = Math.abs(m - ref); if (d < bd) { bd = d; best = m; } }
      return best == null ? ref : best;
    }
    function chordTones(ch) { return CHORD[ch.q].map(function (iv) { return (ch.root + iv) % 12; }); }
    function scaleNotes(lo, hi, minor) {
      var pcs = PENT.slice(); var out2 = [];
      for (var m = lo; m <= hi; m++) { var pc = m % 12; if (pcs.indexOf(pc) >= 0 || (minor && pc === BLUE && chance(0.5))) out2.push(m); }
      return out2;
    }

    // ----------------------------------------------------------- drums
    var BUCKET = [
      { c: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0], r: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0] },
      { c: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], r: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1] },
      { c: [1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0], r: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1] }
    ];
    function drumsBucket(dst, at, inten, bar) {
      var pat = BUCKET[inten < 0.35 ? 0 : inten < 0.7 ? 1 : 2];
      var fill = bar % 4 === 3 && inten > 0.3, bigFill = bar % 8 === 7 && inten > 0.55;
      if (bar % 8 === 0 && inten > 0.5) { I.panClang(dst, at(0), 0.7); }
      for (var s = 0; s < 16; s++) {
        var b = s / 4;
        if ((fill && s >= 12) || (bigFill && s >= 8)) {
          var k = s - (bigFill ? 8 : 12), vv = 0.45 + k * 0.06;
          if (s % 2 === 0) I.bucketLow(dst, at(b), vv); else I.bucketRim(dst, at(b), vv);
          continue;
        }
        if (pat.c[s]) I.bucketLow(dst, at(b), s % 8 === 0 ? 0.85 : 0.65);
        if (pat.r[s]) I.bucketRim(dst, at(b), s % 8 === 4 ? 0.75 : 0.5);
        if (!pat.c[s] && !pat.r[s]) {
          var tickV = s % 2 === 0 ? 0.55 : 0.3;
          if (s % 2 === 0 || inten > 0.3) I.stick(dst, at(b), tickV * (0.6 + 0.6 * inten));
        }
        if (inten > 0.42 && !S.night) I.shaker(dst, at(b), s % 2 === 0 ? 0.5 : 0.3);
        if (inten > 0.65 && s % 4 === 2) I.panClang(dst, at(b), 0.35);
      }
    }
    function drumsBrush(dst, at, inten, bar) {
      for (var beat = 0; beat < 4; beat++) {
        I.ride(dst, at(beat), beat % 2 ? 0.6 : 0.45);
        if (beat % 2 === 1) { I.ride(dst, at(beat + 0.5), 0.35); I.brush(dst, at(beat), 0.55, 0.25); I.hat(dst, at(beat), 0.45); }
        I.kickSoft(dst, at(beat), 0.16 + 0.15 * inten);
        if (inten > 0.45) { if (chance(0.3)) I.snareGhost(dst, at(beat + 0.5), 0.3 + 0.3 * inten); if (chance(0.15)) I.snareGhost(dst, at(beat), 0.25); }
      }
      // continuous swirl
      I.brush(dst, at(0), 0.18, 1.6); I.brush(dst, at(2), 0.18, 1.6);
      if (bar % 4 === 3 && inten > 0.25) for (var k = 0; k < 3; k++) I.snareGhost(dst, at(3) + k * (60 / S.tempo) / 3, 0.35 + k * 0.12);
      if (bar % 8 === 0 && inten > 0.6) I.crash(dst, at(0), 0.4);
    }

    // ----------------------------------------------------------- bass
    function bassBar(dst, at, spb, ch, next, mode, inten) {
      var lo = 36, hi = 52, root = nearest(ch.root, S.bassPrev, lo, hi);
      var tones = CHORD[ch.q];
      var useWalk = mode === 'walk' || (mode === 'auto' && inten >= 0.35);
      if (!useWalk) {
        var fifth = nearest((ch.root + tones[2]) % 12, root + 5, lo, hi);
        I.bass(dst, at(0), root, spb * 1.7, 0.85);
        I.bass(dst, at(2), fifth, spb * 1.4, 0.7);
        if (chance(0.45)) { var nr = nearest(next.root, fifth, lo, hi); I.bass(dst, at(3.5), nr + pick([-1, 1]), spb * 0.4, 0.55); }
        S.bassPrev = fifth; return;
      }
      var n1 = nearest((ch.root + tones[pick([1, 2])]) % 12, root + 3, lo, hi);
      var n2 = nearest((ch.root + tones[pick([2, 3, 1])]) % 12, n1 + pick([-3, 3]), lo, hi);
      var nextRoot = nearest(next.root, n2, lo, hi);
      var n3 = nextRoot + pick([-1, 1, 1, -2, 2]);
      if (n3 === n2) n3 = nextRoot - 1;
      var line = [root, n1, n2, n3];
      for (var b = 0; b < 4; b++) I.bass(dst, at(b), line[b], spb * 0.92, b === 0 ? 0.9 : 0.72);
      if (inten > 0.6 && chance(0.35)) I.bass(dst, at(2.5), line[2], spb * 0.3, 0.45); // skip note
      S.bassPrev = n3;
    }

    // ----------------------------------------------------------- keys (comping)
    var COMP = [
      [[0, 1.6], [2, 1.6]],                           // half notes (calm)
      [[0, 0.7], [1.5, 0.45]],                        // Charleston
      [[1, 0.5], [2.5, 0.5]],                         // off-beat stabs
      [[0, 0.5], [1.5, 0.4], [3.5, 0.35, 'next']],    // with anticipation
      [[0, 0.35], [1.5, 0.35], [2.5, 0.35], [3.5, 0.3, 'next']] // busy
    ];
    function voicing(ch) {
      var v = VOICE[ch.q], base = ch.root;
      while (base + v[0] < 51) base += 12;
      while (base + v[0] > 62) base -= 12;
      return v.map(function (iv) { return base + iv; });
    }
    function keysBar(dst, at, spb, ch, next, inst, inten, night) {
      var choices = inten < 0.25 ? [0, 1] : inten < 0.55 ? [1, 2, 3] : [2, 3, 4];
      if (night) choices = choices.concat([0, 1]);
      var pat = COMP[pick(choices)], fn = I[inst] || I.piano;
      pat.forEach(function (ev) {
        var notes = voicing(ev[2] === 'next' ? next : ch), t = at(ev[0]);
        notes.forEach(function (m, i) { fn(dst, t + i * rnd(0.002, 0.012), m, ev[1] * spb, rnd(0.4, 0.55)); });
      });
    }

    // ----------------------------------------------------------- lead
    function genPhrase(sec, barInSec, inten, leadInfo) {
      var notes = [], isCall = Math.floor(barInSec / 2) % 2 === 0;
      if (!isCall && S.prevRhythm && chance(0.8)) {
        var rh = S.prevRhythm.slice();
        if (rh.length > 2 && chance(0.4)) rh.splice((Math.random() * (rh.length - 1)) | 0, 1);
        notes = rh.map(function (r) { return { s: r.s, l: r.l }; });
      } else {
        var density = 0.28 + 0.45 * inten, s = chance(0.4) ? 1 : 0;
        while (s < 14) {
          if (chance(density)) { var l = pick([1, 1, 1, 2, 2, 3]); l = Math.min(l, 14 - s); notes.push({ s: s, l: l }); s += l; }
          else s++;
        }
        S.prevRhythm = notes.map(function (r) { return { s: r.s, l: r.l }; });
      }
      if (!notes.length) return notes;
      var minor = sec.prog === PROG.minor || sec.prog === PROG.defeat;
      var scale = scaleNotes(leadInfo.lo, leadInfo.hi, minor);
      var idx = 0, bd = 1e9;
      scale.forEach(function (m, i) { var d = Math.abs(m - S.leadPrev); if (d < bd) { bd = d; idx = i; } });
      notes.forEach(function (n, i) {
        idx = clamp(idx + pick([-2, -1, -1, 1, 1, 2, chance(0.15) ? 3 : -1]), 0, scale.length - 1);
        var m = scale[idx];
        var ch = chordAt(sec, barInSec + (n.s >= 8 ? 1 : 0));
        if (n.s % 4 === 0 || i === notes.length - 1) { // strong beats & phrase ends land on chord tones
          var tones = chordTones(ch), best = m, d2 = 1e9;
          for (var mm = leadInfo.lo; mm <= leadInfo.hi; mm++) if (tones.indexOf(mm % 12) >= 0 && Math.abs(mm - m) < d2) { d2 = Math.abs(mm - m); best = mm; }
          m = best;
        }
        if (!isCall && i === notes.length - 1) { var root = nearest(ch.root, m, leadInfo.lo, leadInfo.hi); m = root; n.l = Math.max(n.l, 2); }
        n.m = m; n.v = leadInfo.vel * (n.s % 2 ? 1.08 : 0.95) * rnd(0.9, 1.05);
        S.leadPrev = m;
      });
      return notes;
    }

    // ----------------------------------------------------------- bar scheduler
    function scheduleBar(t0) {
      if (S.pending) {
        var p = S.pending; S.pending = null;
        S.section = sectionFor(p); S.secBar = 0; S.phrase = null; S.prevRhythm = null;
      } else if (S.section && S.section.bars && S.secBar >= S.section.bars) {
        S.section = sectionFor(S.section.then); S.secBar = 0;
      } else if (S.section && S.secBar % 4 === 0 && ['calm', 'calm-minor', 'calm-night', 'tense'].indexOf(S.section.name) >= 0) {
        var fresh = sectionFor(S.state); // pick up minor/night flips at phrase boundaries
        if (fresh.name !== S.section.name) { S.section = fresh; S.secBar = 0; }
      }
      var sec = S.section; if (!sec) return 4 * 60 / S.tempo;
      // intensity (smoothed per bar)
      var tgt = sec.fixedI != null ? sec.fixedI : S.target;
      if (sec.minI != null) tgt = Math.max(tgt, sec.minI);
      if (sec.maxI != null) tgt = Math.min(tgt, sec.maxI);
      S.intensity += (tgt - S.intensity) * 0.5;
      var inten = S.intensity;
      var tempo = sec.tempo + (S.nearWin && !sec.fixedI && sec.name !== 'menu' ? 8 : 0) + (inten > 0.75 && !sec.fixedI ? 2 : 0);
      S.tempo = tempo;
      var spb = 60 / tempo;
      var s8 = sec.drums === 'brush' ? 0.65 : 0.6, s16 = sec.drums === 'brush' ? 0.5 : 0.55;
      var at = function (beat) { return timeOf(t0, spb, beat, s8, s16); };
      var ch = chordAt(sec, S.secBar), next = chordAt(sec, S.secBar + 1);
      var layers = sec.layers != null ? sec.layers : clamp(S.layers + (sec.layersAdd || 0), 0, 3);
      setLayer('drums', true, t0); setLayer('bass', layers >= 1, t0); setLayer('keys', layers >= 2, t0); setLayer('lead', layers >= 3, t0);

      if (sec.drums === 'brush') drumsBrush(LG.drums, at, inten, S.secBar); else drumsBucket(LG.drums, at, inten, S.secBar);
      if (layers >= 1) bassBar(LG.bass, at, spb, ch, next, sec.bass, inten);
      if (layers >= 2) keysBar(LG.keys, at, spb, ch, next, sec.keys, inten, sec.drums === 'brush');
      var lf = LEADS[sec.leadFaction || S.faction] || LEADS.noise;
      var leadFn = I[lf.inst] || I.sax;
      LG.lead.gain.setTargetAtTime(LEVEL.lead * lf.gain * (S.on.lead ? 1 : 0), t0, 0.5);
      if (sec.line) {
        var shift = (sec.name === 'defeat' && (lf.inst === 'vibes' || lf.inst === 'piano')) ? 12 : 0;
        sec.line.forEach(function (n) {
          if (n[0] >= S.secBar * 4 && n[0] < S.secBar * 4 + 4) leadFn(LG.lead, at(n[0] - S.secBar * 4), n[1] + shift, n[2] * spb * 0.95, lf.vel + 0.1);
        });
        if (S.secBar === 0 && sec.name === 'victory') I.crash(LG.drums, at(0), 0.6);
        if (S.secBar === 3 && sec.name === 'victory') I.crash(LG.drums, at(0), 0.8);
      } else if (layers >= 3) {
        if (S.secBar % 2 === 0) {
          var rest = inten < 0.3 ? 0.35 : inten < 0.6 ? 0.15 : 0.05;
          S.phrase = chance(rest) ? [] : genPhrase(sec, S.secBar, inten, lf);
        }
        var half = (S.secBar % 2) * 8;
        (S.phrase || []).forEach(function (n) {
          if (n.s >= half && n.s < half + 8) {
            var b = (n.s - half) / 2;
            leadFn(LG.lead, at(b), n.m, n.l * 0.5 * spb * 0.92, n.v);
          }
        });
      }
      S.secBar++; S.bar++;
      return 4 * spb;
    }
    function setLayer(name, on, t) {
      if (S.on[name] === on) return;
      S.on[name] = on;
      LG[name].gain.setTargetAtTime(on ? LEVEL[name] : 0, t, on ? 1.2 : 0.6);
    }

    function tick() {
      if (ctx.state !== 'running' || S.state === 'off') return;
      var t = ctx.currentTime;
      if (S.nextBar < t - 0.05) S.nextBar = t + 0.08; // fell behind (tab throttled): resync
      var guard = 0;
      while (S.nextBar < t + 0.3 && guard++ < 4) {
        try { S.nextBar += scheduleBar(S.nextBar); } catch (e) { S.nextBar += 2; if (typeof console !== 'undefined') console.warn('[music]', e); }
      }
    }

    var api = {
      setState: function (state, faction) {
        var st = state ? String(state).toLowerCase() : 'off';
        if (['menu', 'calm', 'tense', 'victory', 'defeat'].indexOf(st) < 0) st = 'off';
        if (faction != null) S.faction = LEADS[faction] ? faction : S.faction;
        if (st === S.state && st !== 'victory' && st !== 'defeat') return;
        var wasOff = S.state === 'off';
        S.state = st;
        var t = ctx.currentTime;
        if (st === 'off') { master.gain.setTargetAtTime(0, t, 0.6); return; }
        S.pending = st;
        master.gain.cancelScheduledValues(t);
        master.gain.setTargetAtTime(1, t, wasOff ? 0.4 : 0.1);
        if (wasOff) { S.nextBar = t + 0.1; S.secBar = 0; }
        else if (st === 'victory' || st === 'defeat') { // cut in on the next beat, not the next bar
          var spb = 60 / S.tempo, beatsAhead = Math.max(0, Math.ceil((t + 0.1 - (S.nextBar - 4 * spb)) / spb));
          var nb = S.nextBar - 4 * spb + beatsAhead * spb;
          if (nb > t + 0.05 && nb < S.nextBar) S.nextBar = nb;
        }
        if (!S.timer) S.timer = setInterval(tick, 40);
        tick();
      },
      setIntensity: function (x) { S.target = clamp(+x || 0, 0, 1); },
      setLayers: function (n) { S.layers = clamp(n | 0, 0, 3); S.layersSet = true; },
      setMinor: function (b) { S.minor = !!b; },
      setNight: function (b) { S.night = !!b; },
      setNearWin: function (b) { S.nearWin = !!b; },
      stop: function () { api.setState('off'); if (S.timer) { clearInterval(S.timer); S.timer = null; } },
      debug: function () {
        return {
          state: S.state, section: S.section ? S.section.name : null, bar: S.bar, tempo: S.tempo,
          intensity: +S.intensity.toFixed(2), layers: S.layers, on: { drums: S.on.drums, bass: S.on.bass, keys: S.on.keys, lead: S.on.lead },
          minor: S.minor, night: S.night, nearWin: S.nearWin, faction: S.faction
        };
      }
    };
    return api;
  }

  SQ.audioMusic = { create: create, PROG: PROG };
})(typeof window !== 'undefined' ? (window.SQ = window.SQ || {}) : (globalThis.SQ = globalThis.SQ || {}));
