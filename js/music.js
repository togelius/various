/* VANGUARD ZERO - song data for the tracker in audio.js
 *
 * 4 rows per beat (16th notes). '.' sustains the previous note, '_' cuts it.
 * Channels loop independently by their own length, so a 4-bar drum pattern
 * under an 8-bar melody is written once.
 * Bars are 16 tokens; '|' is ignored and only used to keep bars readable.
 */
(function (global) {
  'use strict';
  var VZ = global.VZ || (global.VZ = {});

  // Common drum patterns (one bar = 16 tokens).
  var BEAT_KS   = 'k . . . | s . . . | k . . k | s . . .';
  var BEAT_KS2  = 'k . . k | s . . . | . . k . | s . . k';
  var BEAT_HARD = 'k . . . | s . . . | k . k . | s . k .';
  var BEAT_DRIVE= 'k . k . | s . . . | k . k . | s . . k';
  var HAT_8     = 'h . h . | h . h . | h . h . | h . h .';
  var HAT_16    = 'h h h h | h h h h | h h h h | h h h H';
  var HAT_OFF   = '. . h . | . . h . | . . h . | . . h H';

  VZ.songs = {

    // ------------------------------------------------------------------ title
    // Slow, wide, a little wistful. Am - F - C - E (harmonic minor cadence).
    title: {
      bpm: 96, rowsPerBeat: 4, loop: 0,
      channels: [
        { inst: 'bell', vol: 0.9, rows:
          'a4 . . . | . . e5 . | . . . . | . . . . |' +
          'c5 . . . | . . a4 . | . . . . | . . . . |' +
          'e5 . . . | . . g5 . | . . . . | e5 . c5 . |' +
          'b4 . . . | . . . . | . . . . | . . . . '
        },
        { inst: 'pad', vol: 1.0, legato: true, rows:
          'a3 . . . . . . . . . . . . . . . |' +
          'f3 . . . . . . . . . . . . . . . |' +
          'c4 . . . . . . . . . . . . . . . |' +
          'e3 . . . . . . . . . . . . . . . '
        },
        { inst: 'pad', vol: 0.8, legato: true, rows:
          'e4 . . . . . . . . . . . . . . . |' +
          'c4 . . . . . . . . . . . . . . . |' +
          'g4 . . . . . . . . . . . . . . . |' +
          'g#4 . . . . . . . . . . . . . . . '
        },
        { inst: 'bass', vol: 0.85, rows:
          'a2 . . . . . a2 . . . . . e2 . . . |' +
          'f2 . . . . . f2 . . . . . c3 . . . |' +
          'c3 . . . . . c3 . . . . . g2 . . . |' +
          'e2 . . . . . e2 . . . . . b2 . . . '
        },
        { inst: 'drums', vol: 0.5, rows: '. . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . h' }
      ]
    },

    // ------------------------------------------------- stage 1: Skyfall Ridge
    // Heroic and airborne. Am - F - C - G.
    stage1: {
      bpm: 152, rowsPerBeat: 4, loop: 0,
      channels: [
        { inst: 'lead', vol: 1.0, rows:
          'a4 . . . | c5 . . . | e5 . . . | d5 . . . |' +   // Am
          'c5 . . . | . . a4 . | f4 . . . | a4 . c5 . |' +   // F
          'e5 . . . | g5 . . . | e5 . . . | c5 . . . |' +   // C
          'd5 . . . | . . . . | b4 . d5 . | g5 . . . |' +   // G
          'a5 . . . | . . g5 . | e5 . . . | c5 . . . |' +   // Am
          'f5 . . . | e5 . . . | c5 . . . | a4 . . . |' +   // F
          'g4 . . . | c5 . . . | e5 . . . | g5 . . . |' +   // C
          'a5 . . . | g5 . . . | d5 . . . | . . . . '       // G
        },
        { inst: 'arp', vol: 1.0, rows:
          'a4 . c5 . | e5 . c5 . | a4 . c5 . | e5 . c5 . |' +
          'f4 . a4 . | c5 . a4 . | f4 . a4 . | c5 . a4 . |' +
          'c4 . e4 . | g4 . e4 . | c4 . e4 . | g4 . e4 . |' +
          'g4 . b4 . | d5 . b4 . | g4 . b4 . | d5 . b4 . '
        },
        { inst: 'bass', vol: 1.0, rows:
          'a2 . a2 . | a2 . e3 . | a2 . a2 . | c3 . e3 . |' +
          'f2 . f2 . | f2 . c3 . | f2 . f2 . | a2 . c3 . |' +
          'c3 . c3 . | c3 . g2 . | c3 . c3 . | e3 . g3 . |' +
          'g2 . g2 . | g2 . d3 . | g2 . g2 . | b2 . d3 . '
        },
        { inst: 'drums', vol: 1.0, rows: BEAT_KS + ' | ' + BEAT_KS + ' | ' + BEAT_KS + ' | ' + BEAT_KS2 },
        { inst: 'drums', vol: 0.85, rows: HAT_8 + ' | ' + HAT_8 + ' | ' + HAT_8 + ' | ' + HAT_16 }
      ]
    },

    // ------------------------------------------------ stage 2: Magma Foundry
    // Heavy industrial gallop. Em - C - D - Em.
    stage2: {
      bpm: 164, rowsPerBeat: 4, loop: 0,
      channels: [
        { inst: 'lead2', vol: 1.0, rows:
          'e5 . . . | g5 . . . | b5 . . a5 | . g5 . . |' +
          'g5 . . . | e5 . . . | c5 . . . | d5 . e5 . |' +
          'd5 . . . | f#5 . . . | a5 . . . | g5 . f#5 . |' +
          'e5 . . . | . . b4 . | e5 . . . | . . . . |' +
          'b5 . . . | a5 . . . | g5 . . . | f#5 . . . |' +
          'e5 . . . | d5 . . . | c5 . . . | b4 . . . |' +
          'a4 . . . | c5 . . . | e5 . . . | g5 . . . |' +
          'f#5 . . . | . . . . | b4 . . . | . . . . '
        },
        { inst: 'organ', vol: 0.85, rows:
          'e4 . . e4 | . . e4 . | b3 . . b3 | . . e4 . |' +
          'c4 . . c4 | . . c4 . | g3 . . g3 | . . c4 . |' +
          'd4 . . d4 | . . d4 . | a3 . . a3 | . . d4 . |' +
          'e4 . . e4 | . . e4 . | b3 . . b3 | . . g4 . '
        },
        { inst: 'bassS', vol: 1.0, rows:
          'e2 e2 . e2 | . e2 e2 . | e2 e2 . e2 | . e2 g2 . |' +
          'c2 c2 . c2 | . c2 c2 . | c2 c2 . c2 | . c2 e2 . |' +
          'd2 d2 . d2 | . d2 d2 . | d2 d2 . d2 | . d2 f#2 . |' +
          'e2 e2 . e2 | . e2 e2 . | e2 e2 . e2 | . g2 a2 b2'
        },
        { inst: 'bass', vol: 0.75, rows:
          'e1 . . . . . . . . . . . . . . . |' +
          'c2 . . . . . . . . . . . . . . . |' +
          'd2 . . . . . . . . . . . . . . . |' +
          'e1 . . . . . . . . . . . . . . . '
        },
        { inst: 'drums', vol: 1.0, rows: BEAT_HARD + ' | ' + BEAT_HARD + ' | ' + BEAT_HARD + ' | ' + BEAT_DRIVE },
        { inst: 'drums', vol: 0.8, rows: HAT_16 + ' | ' + HAT_16 + ' | ' + HAT_16 + ' | ' + 'h h h h | h h h h | t . t . | t t . c' }
      ]
    },

    // ------------------------------------------------- stage 3: Void Citadel
    // Cold and mechanical. Dm - Bb - F - A (D harmonic minor).
    stage3: {
      bpm: 158, rowsPerBeat: 4, loop: 0,
      channels: [
        { inst: 'lead', vol: 0.95, rows:
          'd5 . . . | . . f5 . | a5 . . . | . . . . |' +
          'g5 . . . | f5 . . . | d5 . . . | . . . . |' +
          'c5 . . . | . . e5 . | a5 . . . | g5 . f5 . |' +
          'e5 . . . | . . . . | c#5 . e5 . | a5 . . . |' +
          'a5 . . . | g5 . . . | f5 . . . | e5 . . . |' +
          'd5 . . . | . . a4 . | d5 . f5 . | a5 . . . |' +
          'a#5 . . . | a5 . . . | f5 . . . | d5 . . . |' +
          'c#5 . . . | e5 . . . | a5 . . . | . . . . '
        },
        { inst: 'arp', vol: 1.1, rows:
          'd4 f4 a4 f4 | d4 f4 a4 f4 | d4 f4 a4 d5 | a4 f4 d4 f4 |' +
          'a#3 d4 f4 d4 | a#3 d4 f4 d4 | a#3 d4 f4 a#4 | f4 d4 a#3 d4 |' +
          'c4 f4 a4 f4 | c4 f4 a4 f4 | c4 f4 a4 c5 | a4 f4 c4 f4 |' +
          'a3 c#4 e4 c#4 | a3 c#4 e4 c#4 | a3 c#4 e4 a4 | e4 c#4 a3 c#4'
        },
        { inst: 'bass', vol: 1.0, rows:
          'd2 . . d2 | . d2 . . | d2 . . d2 | . . a2 . |' +
          'a#1 . . a#1 | . a#1 . . | a#1 . . a#1 | . . f2 . |' +
          'f2 . . f2 | . f2 . . | f2 . . f2 | . . c3 . |' +
          'a1 . . a1 | . a1 . . | a1 . . a1 | . . e2 . '
        },
        { inst: 'soft', vol: 0.55, legato: true, rows:
          'd4 . . . . . . . . . . . . . . . |' +
          'a#3 . . . . . . . . . . . . . . . |' +
          'c4 . . . . . . . . . . . . . . . |' +
          'c#4 . . . . . . . . . . . . . . . '
        },
        { inst: 'drums', vol: 1.0, rows: BEAT_KS2 + ' | ' + BEAT_KS2 + ' | ' + BEAT_KS2 + ' | ' + BEAT_HARD },
        { inst: 'drums', vol: 0.75, rows: HAT_OFF + ' | ' + HAT_OFF + ' | ' + HAT_OFF + ' | ' + HAT_16 }
      ]
    },

    // ------------------------------------------------------------ boss theme
    // Relentless. D minor with a phrygian-dominant flat-2 for menace.
    boss: {
      bpm: 178, rowsPerBeat: 4, loop: 0,
      channels: [
        { inst: 'lead2', vol: 1.05, rows:
          'd5 . d5 . | f5 . d5 . | a5 . . . | g5 f5 e5 . |' +
          'd5 . d5 . | f5 . d5 . | a#5 . a5 . | g5 . f5 . |' +
          'e5 . e5 . | g5 . e5 . | a#5 . . . | a5 g5 f5 . |' +
          'e5 . c#5 . | e5 . a5 . | d6 . . . | . . . . '
        },
        { inst: 'lead', vol: 0.5, rows:
          'a4 . a4 . | c5 . a4 . | e5 . . . | d5 c5 a#4 . |' +
          'a4 . a4 . | c5 . a4 . | f5 . e5 . | d5 . c5 . |' +
          'a#4 . a#4 . | e4 . a#4 . | f5 . . . | e5 d5 c5 . |' +
          'a4 . g#4 . | a4 . e5 . | a5 . . . | . . . . '
        },
        { inst: 'bassS', vol: 1.0, rows:
          'd2 d2 . d2 | d2 . d2 . | d2 d2 . d2 | d2 . f2 . |' +
          'd2 d2 . d2 | d2 . d2 . | a#1 a#1 . a#1 | a#1 . c2 . |' +
          'e2 e2 . e2 | e2 . e2 . | e2 e2 . e2 | e2 . g2 . |' +
          'a1 a1 . a1 | a1 . a1 . | a1 a1 . a1 | a1 c2 c#2 d2'
        },
        { inst: 'arp', vol: 0.7, rows:
          'd5 a5 f5 a5 | d5 a5 f5 a5 | d5 a5 f5 a5 | d5 a5 f5 a5 |' +
          'd5 a5 f5 a5 | d5 a5 f5 a5 | a#4 f5 d5 f5 | a#4 f5 d5 f5 |' +
          'e5 b5 g5 b5 | e5 b5 g5 b5 | e5 b5 g5 b5 | e5 b5 g5 b5 |' +
          'a4 e5 c#5 e5 | a4 e5 c#5 e5 | a4 e5 c#5 e5 | a4 e5 a5 e5'
        },
        { inst: 'drums', vol: 1.05, rows: BEAT_DRIVE + ' | ' + BEAT_DRIVE + ' | ' + BEAT_DRIVE + ' | ' + 'k . k . | s . . . | k . k . | s t t c' },
        { inst: 'drums', vol: 0.85, rows: HAT_16 }
      ]
    },

    // ------------------------------------------------------- final boss theme
    // Same lineage as the boss theme, transposed up and pushed harder.
    finalBoss: {
      bpm: 186, rowsPerBeat: 4, loop: 16,
      channels: [
        { inst: 'lead2', vol: 1.1, rows:
          // 4-bar intro (played once, loop point is bar 2)
          'e5 . . . | . . . . | e5 . . . | . . . . |' +
          'e5 . e5 . | g5 . e5 . | b5 . . . | a5 g5 f#5 . |' +
          'e5 . e5 . | g5 . e5 . | c6 . b5 . | a5 . g5 . |' +
          'f#5 . f#5 . | a5 . f#5 . | c6 . . . | b5 a5 g5 . |' +
          'f#5 . d#5 . | f#5 . b5 . | e6 . . . | d6 c6 b5 . |' +
          'c6 . . . | b5 . . . | a5 . . . | g5 . . . |' +
          'f#5 . . . | e5 . . . | d#5 . . . | . . . . |' +
          'e5 . b5 . | e6 . . . | . . . . | . . . . '
        },
        { inst: 'lead', vol: 0.55, rows:
          'b4 . . . | . . . . | b4 . . . | . . . . |' +
          'b4 . b4 . | e5 . b4 . | g5 . . . | f#5 e5 d5 . |' +
          'b4 . b4 . | e5 . b4 . | g5 . f#5 . | e5 . d5 . |' +
          'd5 . d5 . | f#5 . d5 . | a5 . . . | g5 f#5 e5 . |' +
          'd5 . b4 . | d5 . f#5 . | b5 . . . | a5 g5 f#5 . |' +
          'a5 . . . | g5 . . . | f#5 . . . | e5 . . . |' +
          'd5 . . . | b4 . . . | a#4 . . . | . . . . |' +
          'b4 . f#5 . | b5 . . . | . . . . | . . . . '
        },
        { inst: 'bassS', vol: 1.05, rows:
          'e2 e2 e2 e2 | e2 e2 e2 e2 | e2 e2 e2 e2 | e2 e2 e2 e2 |' +
          'e2 e2 . e2 | e2 . e2 . | e2 e2 . e2 | e2 . g2 . |' +
          'e2 e2 . e2 | e2 . e2 . | c2 c2 . c2 | c2 . d2 . |' +
          'd2 d2 . d2 | d2 . d2 . | d2 d2 . d2 | d2 . f#2 . |' +
          'b1 b1 . b1 | b1 . b1 . | b1 b1 . b1 | b1 d2 d#2 e2'
        },
        { inst: 'arp', vol: 0.8, rows:
          'e5 b5 g5 b5 | e5 b5 g5 b5 | e5 b5 g5 b5 | e5 b5 g5 b5 |' +
          'e5 b5 g5 b5 | e5 b5 g5 b5 | e5 b5 g5 b5 | e5 b5 g5 b5 |' +
          'e5 b5 g5 b5 | e5 b5 g5 b5 | c5 g5 e5 g5 | c5 g5 e5 g5 |' +
          'd5 a5 f#5 a5 | d5 a5 f#5 a5 | d5 a5 f#5 a5 | d5 a5 f#5 a5 |' +
          'b4 f#5 d#5 f#5 | b4 f#5 d#5 f#5 | b4 f#5 d#5 f#5 | b4 f#5 b5 f#5'
        },
        { inst: 'drums', vol: 1.1, rows:
          'k . k . | s . . . | k . k . | s . k k |' +
          'k . k . | s . . . | k . k . | s . k k |' +
          'k . k . | s . . . | k . k . | s . k k |' +
          'k . k . | s . . . | k t t . | s t t c'
        },
        { inst: 'drums', vol: 0.9, rows: HAT_16 }
      ]
    },

    // ------------------------------------------------------------- interludes
    stageClear: {
      bpm: 128, rowsPerBeat: 4, loop: 60,
      channels: [
        { inst: 'lead', vol: 1.0, rows:
          'c5 . e5 . | g5 . c6 . | . . . . | b5 . c6 . |' +
          'g5 . . . | . . . . | e5 . g5 . | c6 . . . |' +
          '. . . . | . . . . | . . . . | . . . . |' +
          '. . . . | . . . . | . . . . | . . . . '
        },
        { inst: 'bass', vol: 1.0, rows:
          'c3 . . . | c3 . . . | g2 . . . | g2 . . . |' +
          'c3 . . . | . . . . | c3 . . . | c3 . . . |' +
          '. . . . | . . . . | . . . . | . . . . |' +
          '. . . . | . . . . | . . . . | . . . . '
        },
        { inst: 'drums', vol: 1.0, rows:
          'k . . . | k . . . | s . . . | s . . . |' +
          'k . . . | . . . . | k . . . | c . . . |' +
          '. . . . | . . . . | . . . . | . . . . |' +
          '. . . . | . . . . | . . . . | . . . . '
        }
      ]
    },

    gameOver: {
      bpm: 88, rowsPerBeat: 4, loop: 60,
      channels: [
        { inst: 'soft', vol: 1.0, rows:
          'a4 . . . | . . . . | g4 . . . | . . . . |' +
          'f4 . . . | . . . . | e4 . . . | . . . . |' +
          'd4 . . . | . . . . | . . . . | . . . . |' +
          '. . . . | . . . . | . . . . | . . . . '
        },
        { inst: 'bass', vol: 1.0, rows:
          'a2 . . . | . . . . | e2 . . . | . . . . |' +
          'f2 . . . | . . . . | c2 . . . | . . . . |' +
          'd2 . . . | . . . . | . . . . | . . . . |' +
          '. . . . | . . . . | . . . . | . . . . '
        }
      ]
    },

    // Played over the ending crawl.
    ending: {
      bpm: 104, rowsPerBeat: 4, loop: 0,
      channels: [
        { inst: 'bell', vol: 1.0, rows:
          'c5 . . . | e5 . . . | g5 . . . | . . e5 . |' +
          'f5 . . . | . . . . | e5 . . . | c5 . . . |' +
          'd5 . . . | f5 . . . | a5 . . . | . . f5 . |' +
          'g5 . . . | . . . . | . . . . | . . . . |' +
          'e5 . . . | g5 . . . | c6 . . . | . . b5 . |' +
          'a5 . . . | . . . . | g5 . . . | e5 . . . |' +
          'f5 . . . | e5 . . . | d5 . . . | . . . . |' +
          'c5 . . . | . . . . | . . . . | . . . . '
        },
        { inst: 'pad', vol: 1.0, legato: true, rows:
          'c4 . . . . . . . . . . . . . . . |' +
          'f3 . . . . . . . . . . . . . . . |' +
          'd4 . . . . . . . . . . . . . . . |' +
          'g3 . . . . . . . . . . . . . . . '
        },
        { inst: 'bass', vol: 0.9, rows:
          'c2 . . . . . g2 . . . . . c3 . . . |' +
          'f2 . . . . . c3 . . . . . f2 . . . |' +
          'd2 . . . . . a2 . . . . . d3 . . . |' +
          'g2 . . . . . d3 . . . . . g2 . . . '
        },
        { inst: 'drums', vol: 0.6, rows: 'k . . . | . . h . | s . . . | . . h . ' }
      ]
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
