/* ANANKE — the levels.
 *
 * Grids: '#' is stone, '.' is open ground. Figures are placed by coordinate,
 * not by glyph, because a figure is never in one place: it is in all the
 * places it could be.
 *
 * Every level carries the solution it was designed around. That is not a
 * cheat sheet — it is the regression test. test/check.js replays each one and
 * refuses to let a level ship unless the stored answer actually makes the
 * outcome necessary within budget.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Ananke = Object.assign(root.Ananke || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var PILGRIM = { name: 'the Pilgrim', short: 'PILGRIM', hue: 38 };
  var HOUND = { name: 'the Hound', short: 'HOUND', hue: 190 };

  function seal(x, y, a, b) { return { x: x, y: y, a: a, b: b == null ? 999 : b }; }

  var LEVELS = [
    {
      id: 'stone',
      name: 'THE STANDING STONE',
      epigraph: 'She may go. She may also stay forever. Both are futures.',
      brief: 'Make her arrival <b>necessary</b>. You cannot push her. You can ' +
             'only forbid the ground she is standing on.',
      hint: 'Sweep along the corridor: forbid each cell one tick after she ' +
            'would be standing on it. Drag across the row to lay the whole sweep at once.',
      w: 7, h: 5,
      grid: [
        '#######',
        '#######',
        '#.....#',
        '#######',
        '#######'
      ],
      T: 6, budget: 4, doubt: 0,
      agents: [Object.assign({ start: [1, 2] }, PILGRIM)],
      shrines: [[5, 2]],
      objectives: [{ type: 'reach', agent: 0, at: [5, 2], by: 6,
                     text: 'the Pilgrim stands at the shrine by the sixth hour' }],
      solution: [seal(1, 2, 1), seal(2, 2, 2), seal(3, 2, 3), seal(4, 2, 4)],

      // The opening board talks you through it. Each beat waits for the thing
      // it just described to actually happen before it says the next one.
      teach: [
        { say: 'That gold disc is not a woman standing in a corridor. It is ' +
               '<b>every place she could be</b> at the hour you are looking ' +
               'at — and at hour zero there is only one. Scrub forward: press ' +
               'the <b>→</b> key a few times, or drag along the hours below.',
          done: function (g) { return g.viewT >= 3; } },

        { say: 'She has spread. By now she could be anywhere in the corridor: ' +
               'she might be at the shrine, or she might have stood still the ' +
               'whole time. The panel calls that <b>MERELY POSSIBLE</b>, and ' +
               'merely possible loses. Go back to <b>hour 0</b> — press ' +
               '<b>←</b>, or click the 0 below.',
          done: function (g) { return g.viewT === 0; } },

        { say: 'You cannot push her. You can only take the ground away. But a ' +
               'prohibition starts at the hour you are looking at, and ' +
               'forbidding her square at hour 0 would mean she was never ' +
               'anywhere at all. So step forward one hour first: <b>hour 1</b>.',
          done: function (g) { return g.viewT === 1; } },

        { say: 'Now click the square she is standing on. You are saying: ' +
               '<i>from the first hour onward, nothing may be here.</i>',
          done: function (g) { return g.seals.some(function (s) { return s.a >= 1; }); } },

        { say: 'She moved — and you never pushed her. You made standing still ' +
               'impossible, and moving was all that was left. Now do that ' +
               'three more times, each one hour later than the last. Faster: ' +
               'hit <b>SWEEP</b> and drag from her square along the corridor.',
          done: function (g) { return g.res.won && !g.res.paradox; } },

        { say: '<b>NECESSARY.</b> Not likely, not nearly — there is no longer ' +
               'a single surviving future in which she fails to arrive. ' +
               'Press <b>LET IT HAPPEN</b> and watch one of them play out.',
          done: null }
      ]
    },

    {
      id: 'ring',
      name: 'THE RING',
      epigraph: 'Two ways around. Necessity admits only one.',
      brief: 'A sweep is expensive. Closing a door is cheap. Do the cheap ' +
             'thing first, then sweep what is left.',
      hint: 'Forbid the mouth of one branch for all time (one cell), then ' +
            'sweep the other branch.',
      w: 7, h: 5,
      grid: [
        '#######',
        '#.....#',
        '#.###.#',
        '#.....#',
        '#######'
      ],
      T: 8, budget: 7, doubt: 0,
      agents: [Object.assign({ start: [1, 2] }, PILGRIM)],
      shrines: [[5, 2]],
      objectives: [{ type: 'reach', agent: 0, at: [5, 2], by: 8,
                     text: 'the Pilgrim stands at the shrine by the eighth hour' }],
      solution: [
        seal(1, 3, 0),
        seal(1, 2, 1), seal(1, 1, 2), seal(2, 1, 3),
        seal(3, 1, 4), seal(4, 1, 5), seal(5, 1, 6)
      ]
    },

    {
      id: 'kennel',
      name: 'THE KENNEL',
      epigraph: 'It has her scent. It need only come within one step — ' +
                'stone is no barrier to wanting.',
      brief: 'Now there are two clouds. They must <b>never</b> touch, in any ' +
             'surviving future. But seal too much and the world becomes ' +
             'impossible, which is also a loss.',
      hint: 'A cloud is small before it spreads. Two cells, placed at the ' +
            'very first hour, are enough to hold something forever.',
      w: 9, h: 7,
      grid: [
        '#########',
        '#.......#',
        '#.......#',
        '#.....#.#',
        '#.....#.#',
        '#.......#',
        '#########'
      ],
      T: 10, budget: 2, doubt: 0,
      agents: [
        Object.assign({ start: [1, 1] }, PILGRIM),
        Object.assign({ start: [7, 4] }, HOUND)
      ],
      shrines: [],
      objectives: [{ type: 'noContact', radius: 1,
                     text: 'the Hound never comes within one step of the Pilgrim' }],
      solution: [seal(7, 2, 0), seal(7, 5, 0)]
    },

    {
      id: 'ford',
      name: 'THE FORD',
      epigraph: 'Arrival and survival are different prohibitions.',
      brief: 'Both at once: she must arrive, and it must never reach her. ' +
             'Hold the Hound cheaply; spend the rest on her road.',
      hint: 'Two seals pin the Hound where it stands. Two close the side ' +
            'turnings off the left wall. Eight sweep her up and across the top.',
      w: 7, h: 7,
      grid: [
        '#######',
        '#.....#',
        '#.###.#',
        '#.....#',
        '#.###.#',
        '#.....#',
        '#######'
      ],
      T: 8, budget: 12, doubt: 0,
      agents: [
        Object.assign({ start: [1, 5] }, PILGRIM),
        Object.assign({ start: [5, 5] }, HOUND)
      ],
      shrines: [[5, 1]],
      objectives: [
        { type: 'reach', agent: 0, at: [5, 1], by: 8,
          text: 'the Pilgrim stands at the shrine by the eighth hour' },
        { type: 'noContact', radius: 1,
          text: 'the Hound never comes within one step of the Pilgrim' }
      ],
      solution: [
        seal(4, 5, 0), seal(5, 4, 0), seal(2, 5, 0), seal(2, 3, 0),
        seal(1, 5, 1), seal(1, 4, 2), seal(1, 3, 3), seal(1, 2, 4),
        seal(1, 1, 5), seal(2, 1, 6), seal(3, 1, 7), seal(4, 1, 8)
      ]
    },

    {
      id: 'doubt',
      name: 'DOUBT',
      epigraph: 'A fate that depends on every one of your prohibitions is not ' +
                'a fate. It is a coincidence.',
      brief: 'One place will forget it was ever forbidden — Ananke chooses ' +
             'which, and chooses the worst. Your necessity must survive that.',
      hint: 'One wall is not a fate. Seal both cuts, the narrow and the wide, ' +
            'so that either alone still holds.',
      w: 11, h: 7,
      grid: [
        '###########',
        '#.....#.#.#',
        '#.......#.#',
        '#.......#.#',
        '#.........#',
        '#.....#...#',
        '###########'
      ],
      T: 12, budget: 5, doubt: 1,
      agents: [
        Object.assign({ start: [1, 1] }, PILGRIM),
        Object.assign({ start: [9, 1] }, HOUND)
      ],
      shrines: [],
      objectives: [{ type: 'noContact', radius: 1,
                     text: 'the Hound never comes within one step of the Pilgrim' }],
      solution: [
        seal(6, 2, 0), seal(6, 3, 0), seal(6, 4, 0),
        seal(8, 4, 0), seal(8, 5, 0)
      ]
    },

    {
      id: 'vow',
      name: 'THE VOW',
      epigraph: 'Everything you have done so far, you have done by keeping ' +
                'things apart.',
      brief: 'This time the meeting must be <b>necessary</b>. There must be ' +
             'no future in which they fail to find each other.',
      hint: 'Sweep them both. The corridor has a middle; leave them nowhere ' +
            'else to be.',
      w: 9, h: 5,
      grid: [
        '#########',
        '#########',
        '#.......#',
        '#########',
        '#########'
      ],
      T: 6, budget: 6, doubt: 0,
      agents: [
        Object.assign({ start: [1, 2] }, PILGRIM),
        Object.assign({ start: [7, 2] }, HOUND)
      ],
      shrines: [],
      objectives: [{ type: 'meet', radius: 1, by: 6,
                     text: 'the Pilgrim and the Hound meet by the sixth hour' }],
      solution: [
        seal(1, 2, 1), seal(2, 2, 2), seal(3, 2, 3),
        seal(7, 2, 1), seal(6, 2, 2), seal(5, 2, 3)
      ]
    },

    {
      id: 'ananke',
      name: 'ANANKE',
      epigraph: 'The shrine was always two steps from the thing that wanted her.',
      brief: 'Everything at once, and the shrine within the Hound\'s reach. ' +
             'Hold it, close the wrong road, and sweep her the long way round.',
      hint: 'Three seals pin the Hound. Two close the turnings off the left ' +
            'wall. Ten sweep her up it and all the way across the top.',
      w: 9, h: 7,
      grid: [
        '#########',
        '#.......#',
        '#.#####.#',
        '#.......#',
        '#.#####.#',
        '#.......#',
        '#########'
      ],
      T: 10, budget: 15, doubt: 0,
      agents: [
        Object.assign({ start: [1, 5] }, PILGRIM),
        Object.assign({ start: [7, 3] }, HOUND)
      ],
      shrines: [[7, 1]],
      objectives: [
        { type: 'reach', agent: 0, at: [7, 1], by: 10,
          text: 'the Pilgrim stands at the shrine by the tenth hour' },
        { type: 'noContact', radius: 1,
          text: 'the Hound never comes within one step of the Pilgrim' }
      ],
      solution: [
        seal(7, 2, 0), seal(7, 4, 0), seal(6, 3, 0),
        seal(2, 5, 0), seal(2, 3, 0),
        seal(1, 5, 1), seal(1, 4, 2), seal(1, 3, 3), seal(1, 2, 4),
        seal(1, 1, 5), seal(2, 1, 6), seal(3, 1, 7), seal(4, 1, 8),
        seal(5, 1, 9), seal(6, 1, 10)
      ]
    }
    ,
    {
      id: 'argument',
      name: 'THE ARGUMENT',
      epigraph: 'Necessity has an opponent, and its weapon is not prohibition. ' +
                'It is possibility.',
      brief: 'Make it necessary, then press on. Ananke will answer by <b>opening ' +
             'a wall</b> that was always thin, and the futures will come back. ' +
             'Hold seals in reserve — you will need them for what it opens.',
      hint: 'Six seals sweep the corridor. Keep the other three back: each ' +
            'door it opens is a pocket she can hide in forever, and each ' +
            'costs exactly one seal to shut.',
      w: 9, h: 5,
      grid: [
        '#########',
        '##~#~#~##',
        '#.......#',
        '###~#~###',
        '#########'
      ],
      T: 8, budget: 9, doubt: 0, ananke: 3,
      agents: [Object.assign({ start: [1, 2] }, PILGRIM)],
      shrines: [[7, 2]],
      objectives: [{ type: 'reach', agent: 0, at: [7, 2], by: 8,
                     text: 'the Pilgrim stands at the shrine by the eighth hour' }],
      solution: [
        seal(1, 2, 1), seal(2, 2, 2), seal(3, 2, 3),
        seal(4, 2, 4), seal(5, 2, 5), seal(6, 2, 6)
      ]
    },

    {
      id: 'lastword',
      name: 'THE LAST WORD',
      epigraph: 'Everything that is shut was once a door.',
      brief: 'The heart of this place is thin stone, all of it. Ananke gets ' +
             'three openings and will spend them where they hurt.',
      hint: 'One seal closes the lower way. Ten sweep her over the top. That ' +
            'leaves three, which is exactly what it will cost you.',
      w: 9, h: 7,
      grid: [
        '#########',
        '#.......#',
        '#.~~~~~.#',
        '#.~~~~~.#',
        '#.~~~~~.#',
        '#.......#',
        '#########'
      ],
      T: 12, budget: 14, doubt: 0, ananke: 3,
      agents: [Object.assign({ start: [1, 3] }, PILGRIM)],
      shrines: [[7, 3]],
      objectives: [{ type: 'reach', agent: 0, at: [7, 3], by: 12,
                     text: 'the Pilgrim stands at the shrine by the twelfth hour' }],
      solution: [
        seal(1, 4, 0),
        seal(1, 3, 1), seal(1, 2, 2), seal(1, 1, 3), seal(2, 1, 4),
        seal(3, 1, 5), seal(4, 1, 6), seal(5, 1, 7), seal(6, 1, 8),
        seal(7, 1, 9), seal(7, 2, 10)
      ]
    }
  ];

  return { LEVELS: LEVELS };
});
