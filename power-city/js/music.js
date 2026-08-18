/* POWER CITY - the songs.
 *
 * Sixteenth-note patterns for two pulse voices, a triangle bass and a noise
 * drum, in the shape a late-eighties brawler soundtrack took: a minor key, a
 * riff that will not let go, and a bass line doing all the work.
 */
(function (global) {
  'use strict';
  var PC = global.PC || (global.PC = {});

  // "a4 . c5 -" -> ['a4','.','c5','-']
  function S(str) { return str.trim().split(/\s+/); }
  // repeat a pattern n times
  function R(str, n) {
    var one = S(str), out = [];
    for (var i = 0; i < n; i++) out = out.concat(one);
    return out;
  }

  var K = 'k . . . s . . . k . k . s . . .';
  var K2 = 'k . h . s . h . k . h . s . h h';
  var K3 = 'k h h h s h k h k h h h s h s h';

  PC.songs = {

    title: {
      bpm: 128, div: 4, duty1: 0.5, duty2: 0.25, vol1: 0.15, vol2: 0.09, volB: 0.3,
      p1: S(`a4 . e5 . a5 . g5 e5 . d5 . c5 . b4 . .
             a4 . e5 . a5 . c6 b5 . a5 . e5 . d5 . .
             f4 . c5 . f5 . e5 c5 . b4 . a4 . g4 . .
             e4 . b4 . e5 . g5 f5 . e5 . d5 . b4 . .`),
      p2: S(`c4 . c4 . e4 . e4 . a3 . a3 . b3 . b3 .
             c4 . c4 . e4 . e4 . a3 . a3 . e4 . e4 .
             f3 . f3 . a3 . a3 . c4 . c4 . d4 . d4 .
             e3 . e3 . g3 . g3 . b3 . b3 . e4 . e4 .`),
      bass: R('a2 . a2 a2 . a2 . a2 f2 . f2 f2 . f2 . f2', 2)
        .concat(R('d2 . d2 d2 . d2 . d2 e2 . e2 e2 . e2 e2 e2', 2)),
      drum: R(K2, 4),
      len: 64
    },

    ready: {
      bpm: 132, div: 4, loop: false, duty1: 0.5, vol1: 0.2, volB: 0.3,
      p1: S('a4 . c5 . e5 . a5 . . . g5 . e5 . c5 . a4 . . . . . . .'),
      bass: S('a2 . . . a2 . . . f2 . . . e2 . . . a2 . . . . . . .'),
      drum: S('k . . . s . . . k . . . s . . . k . k . s . . .'),
      len: 24
    },

    stage1: {
      bpm: 140, div: 4, duty1: 0.5, duty2: 0.125, vol1: 0.15, vol2: 0.085, volB: 0.32, vib: 5.5,
      p1: S(`a4 . a4 c5 . a4 . e5 . d5 c5 . a4 . . .
             a4 . a4 c5 . a4 . e5 . g5 e5 . d5 . c5 .
             f4 . f4 a4 . f4 . c5 . b4 a4 . g4 . . .
             e4 . g4 b4 . e5 . d5 . c5 b4 . a4 . . .`),
      p2: S(`. e4 . . e4 . e4 . . a4 . . a4 . . .
             . e4 . . e4 . e4 . . c5 . . c5 . . .
             . c4 . . c4 . c4 . . f4 . . f4 . . .
             . b3 . . b3 . b3 . . e4 . . e4 . e4 .`),
      bass: R('a2 a2 . a2 . a2 a3 . a2 a2 . a2 . a2 g2 .', 2)
        .concat(R('f2 f2 . f2 . f2 f3 . e2 e2 . e2 . e2 e3 .', 2)),
      drum: R(K3, 4),
      len: 64
    },

    stage2: {
      bpm: 148, div: 4, duty1: 0.25, duty2: 0.5, vol1: 0.15, vol2: 0.08, volB: 0.32,
      p1: S(`d5 . c5 a4 . d5 . f5 . e5 d5 . c5 . a4 .
             d5 . c5 a4 . d5 . a5 . g5 f5 . e5 . d5 .
             c5 . b4 g4 . c5 . e5 . d5 c5 . b4 . g4 .
             a4 . . e5 . d5 . c5 . b4 . a4 . . . .`),
      p2: S(`. a4 . . a4 . . f4 . . f4 . . a4 . .
             . a4 . . a4 . . c5 . . c5 . . a4 . .
             . g4 . . g4 . . e4 . . e4 . . g4 . .
             . e4 . . e4 . . c5 . . a4 . . . . .`),
      bass: R('d2 . d3 d2 . d2 d3 . a2 . a3 a2 . a2 a3 .', 2)
        .concat(R('c2 . c3 c2 . c2 c3 . e2 . e3 e2 . e2 e3 e3', 2)),
      drum: R(K3, 4),
      len: 64
    },

    stage3: {
      bpm: 136, div: 4, duty1: 0.125, duty2: 0.5, vol1: 0.15, vol2: 0.08, volB: 0.34, vib: 4,
      p1: S(`e4 . g4 . b4 . e5 . d5 . b4 . g4 . e4 .
             f4 . a4 . c5 . f5 . e5 . c5 . a4 . f4 .
             g4 . b4 . d5 . g5 . f5 . d5 . b4 . g4 .
             e5 . . d5 . c5 . b4 . a4 . g4 . . . .`),
      p2: S(`. e3 . e3 . b3 . b3 . e4 . e4 . b3 . b3
             . f3 . f3 . c4 . c4 . f4 . f4 . c4 . c4
             . g3 . g3 . d4 . d4 . g4 . g4 . d4 . d4
             . e3 . e3 . b3 . b3 . e4 . e4 . e4 . .`),
      bass: R('e2 . e2 . e2 e2 . e2 e2 . e2 . e2 e2 . d2', 1)
        .concat(R('f2 . f2 . f2 f2 . f2 f2 . f2 . f2 f2 . e2', 1))
        .concat(R('g2 . g2 . g2 g2 . g2 g2 . g2 . g2 g2 . f2', 1))
        .concat(R('e2 . e2 . e2 e2 . e2 b2 . b2 . b2 b2 b2 b2', 1)),
      drum: R(K2, 4),
      len: 64
    },

    stage4: {
      bpm: 156, div: 4, duty1: 0.5, duty2: 0.125, vol1: 0.155, vol2: 0.09, volB: 0.34,
      p1: S(`c5 c5 . c5 . b4 . c5 . e5 . g5 . f5 e5 .
             c5 c5 . c5 . b4 . c5 . a5 . g5 . e5 c5 .
             b4 b4 . b4 . a4 . b4 . d5 . f5 . e5 d5 .
             c5 . e5 . g5 . c6 . b5 . g5 . e5 . c5 .`),
      p2: S(`. g4 . g4 . g4 . g4 . c5 . c5 . c5 . c5
             . g4 . g4 . g4 . g4 . e5 . e5 . e5 . e5
             . f4 . f4 . f4 . f4 . b4 . b4 . b4 . b4
             . g4 . . c5 . . e5 . . g5 . . e5 . .`),
      bass: R('c2 c2 . c2 c3 . c2 . c2 c2 . c2 c3 . c2 .', 2)
        .concat(R('b1 b1 . b1 b2 . b1 . c2 c2 . c2 c3 . g2 g2', 2)),
      drum: R(K3, 4),
      len: 64
    },

    boss: {
      bpm: 168, div: 4, duty1: 0.125, duty2: 0.5, vol1: 0.16, vol2: 0.09, volB: 0.36, vib: 7,
      p1: S(`a4 a4 a4 . c5 . a4 . d5 d5 d5 . c5 . a4 .
             a4 a4 a4 . c5 . e5 . f5 . e5 . d5 . c5 .
             a4 a4 a4 . c5 . a4 . d5 d5 d5 . f5 . e5 .
             a5 . g5 . f5 . e5 . d5 . c5 . b4 . a4 .`),
      p2: S(`e4 . e4 . e4 . e4 . a4 . a4 . a4 . a4 .
             e4 . e4 . e4 . e4 . c5 . c5 . c5 . c5 .
             e4 . e4 . e4 . e4 . a4 . a4 . a4 . a4 .
             c5 . b4 . a4 . g4 . f4 . e4 . d4 . c4 .`),
      bass: R('a1 a1 a2 a1 a1 a1 a2 a1 d2 d2 d3 d2 d2 d2 d3 d2', 2)
        .concat(R('a1 a1 a2 a1 a1 a1 a2 a1 e2 e2 e3 e2 e2 e2 e3 e2', 2)),
      drum: R('k h k h s h k h k h k h s h s h', 4),
      len: 64
    },

    clear: {
      bpm: 128, div: 4, loop: false, duty1: 0.5, vol1: 0.2, volB: 0.32,
      p1: S(`c5 . e5 . g5 . c6 . . g5 . c6 . . . .
             a5 . . g5 . e5 . c5 . . . . . . . .`),
      bass: S(`c3 . . . g2 . . . c3 . . . g2 . . .
               f2 . . . g2 . . . c3 . . . . . . .`),
      drum: S(`k . s . k . s . k . k . s . . .
               k . s . k . s . k . k . s . . .`),
      len: 32
    },

    gameover: {
      bpm: 88, div: 4, loop: false, duty1: 0.5, vol1: 0.18, volB: 0.3,
      p1: S('a4 . . . g4 . . . f4 . . . e4 . . . d4 . . . . . . . a3 . . . . . . .'),
      bass: S('a2 . . . g2 . . . f2 . . . e2 . . . d2 . . . . . . . a1 . . . . . . .'),
      drum: S('k . . . . . . . k . . . . . . . k . . . . . . . k . . . . . . .'),
      len: 32
    },

    ending: {
      bpm: 108, div: 4, duty1: 0.5, duty2: 0.25, vol1: 0.15, vol2: 0.08, volB: 0.3,
      p1: S(`c5 . e5 . g5 . e5 . f5 . a5 . g5 . e5 .
             d5 . f5 . a5 . f5 . e5 . g5 . c6 . . .
             a5 . g5 . e5 . c5 . d5 . e5 . g5 . . .
             c5 . . . . . . . . . . . . . . .`),
      p2: S(`c4 . . e4 . . g4 . f4 . . a4 . . c5 .
             d4 . . f4 . . a4 . e4 . . g4 . . c5 .
             a4 . . c5 . . e5 . d4 . . g4 . . b4 .
             c4 . . e4 . . g4 . . . . . . . . .`),
      bass: R('c2 . c3 . g2 . c3 . f2 . f3 . g2 . g3 .', 2)
        .concat(R('a2 . a3 . e2 . e3 . f2 . g2 . c2 . c3 .', 2)),
      drum: R('k . h . s . h . k . h . s . h .', 4),
      len: 64
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
