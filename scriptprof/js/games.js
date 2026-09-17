/* SCRIPTPROF — seed games. Human-authored examples, the few-shot prior. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ScriptProf = Object.assign(root.ScriptProf || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SOKOBAN = `title Office Hours
author ScriptProf
homepage scriptprof

========
OBJECTS
========

Background
#e8dcc4 #d9cbb0
11111
01111
11101
11111
10111

Desk
DarkBlue
.....
.000.
.0.0.
.000.
.....

Wall
DarkBrown Brown
00010
11111
01000
11111
00010

Player
Black Orange White Blue
.000.
.111.
22222
.333.
.3.3.

Paper
Orange Yellow
00000
0...0
0...0
0...0
00000

=======
LEGEND
=======

. = Background
# = Wall
P = Player
* = Paper
@ = Paper and Desk
O = Desk

================
COLLISIONLAYERS
================

Background
Desk
Player, Wall, Paper

======
RULES
======

[ > Player | Paper ] -> [ > Player | > Paper ]

==============
WINCONDITIONS
==============

All Paper on Desk

=======
LEVELS
=======

message file the papers. do not trap them in a corner.

######
#....#
#.P*.#
#..O.#
#....#
######

message two desks, two papers. order of operations.

#######
#.....#
#.*O*.#
#..P..#
#.O...#
#######
`;

  var PULL = `title Office Hours: Revisions
author ScriptProf

========
OBJECTS
========

Background
#e8dcc4 #d9cbb0
11111
01111
11101
11111
10111

Desk
DarkBlue
.....
.000.
.0.0.
.000.
.....

Wall
DarkBrown Brown
00010
11111
01000
11111
00010

Player
Black Orange White Blue
.000.
.111.
22222
.333.
.3.3.

Paper
Orange Yellow
00000
0...0
0...0
0...0
00000

=======
LEGEND
=======

. = Background
# = Wall
P = Player
* = Paper
@ = Paper and Desk
O = Desk

================
COLLISIONLAYERS
================

Background
Desk
Player, Wall, Paper

======
RULES
======

[ > Player | Paper ] -> [ > Player | > Paper ]
[ < Player | Paper ] -> [ < Player | < Paper ]

==============
WINCONDITIONS
==============

All Paper on Desk

=======
LEVELS
=======

message you can push and pull. the corner is no longer a grave.

######
#....#
#..*.#
#.P#O#
#....#
######
`;

  var MATCH = `title Three Citations
author ScriptProf

========
OBJECTS
========

Background
#e8dcc4
00000
00000
00000
00000
00000

Wall
DarkBrown Brown
00010
11111
01000
11111
00010

Player
Black Orange White Blue
.000.
.111.
22222
.333.
.3.3.

Paper
Orange Yellow
00000
0...0
0...0
0...0
00000

=======
LEGEND
=======

. = Background
# = Wall
P = Player
* = Paper

================
COLLISIONLAYERS
================

Background
Player, Wall, Paper

======
RULES
======

[ > Player | Paper ] -> [ > Player | > Paper ]

late [ Paper | Paper | Paper ] -> [ | | ]

==============
WINCONDITIONS
==============

No Paper

=======
LEVELS
=======

message line up three preprints and they vanish. leave none.

#######
#.....#
#.**..#
#..P*.#
#.....#
#######
`;

  var EXIT = `title The Stairwell
author ScriptProf

========
OBJECTS
========

Background
#e8dcc4
00000
00000
00000
00000
00000

Wall
DarkBrown Brown
00010
11111
01000
11111
00010

Player
Black Orange White Blue
.000.
.111.
22222
.333.
.3.3.

Exit
DarkGreen LightGreen
.....
.000.
.010.
.000.
.....

=======
LEGEND
=======

. = Background
# = Wall
P = Player
O = Exit

================
COLLISIONLAYERS
================

Background
Exit
Player, Wall

======
RULES
======

==============
WINCONDITIONS
==============

Some Player on Exit

=======
LEVELS
=======

message no crates. just get out of 370 Jay Street.

########
#P.#..O#
#.##.###
#......#
#.####.#
#......#
########
`;

  var RAKE = `title The Quad
author ScriptProf

========
OBJECTS
========

Background
#cfc6a8
00000
00000
00000
00000
00000

Wall
DarkBrown
00000
00000
00000
00000
00000

Player
Black Orange
.000.
.111.
.111.
.0.0.
.0.0.

Leaf
LightGreen Green
.....
.000.
.010.
.000.
.....

Raked
DarkBrown LightBrown
01010
10101
01010
10101
01010

=======
LEGEND
=======

. = Leaf
# = Wall
P = Player
R = Raked

================
COLLISIONLAYERS
================

Background
Leaf, Raked
Player, Wall

======
RULES
======

late [ Player Leaf ] -> [ Player Raked ]

==============
WINCONDITIONS
==============

No Leaf

=======
LEVELS
=======

message every tile you stand on is raked. cover the quad. do not miss a corner.

#####
#P..#
#...#
#...#
#####
`;

  var SWAP = `title Desk Swap
author ScriptProf

========
OBJECTS
========

Background
#e8dcc4
00000
00000
00000
00000
00000

Desk
DarkBlue
.....
.000.
.0.0.
.000.
.....

Wall
DarkBrown Brown
00010
11111
01000
11111
00010

Player
Black Orange White Blue
.000.
.111.
22222
.333.
.3.3.

Paper
Orange Yellow
00000
0...0
0...0
0...0
00000

=======
LEGEND
=======

. = Background
# = Wall
P = Player
* = Paper
@ = Paper and Desk
O = Desk

================
COLLISIONLAYERS
================

Background
Desk
Player, Wall, Paper

======
RULES
======

[ > Player | Paper ] -> [ Paper | Player ]

==============
WINCONDITIONS
==============

All Paper on Desk

=======
LEVELS
=======

message you do not push. you trade places with the paper.

######
#....#
#.*P.#
#O#..#
#....#
######
`;

  var SEEDS = [
    {
      id: 'office',
      name: 'Office Hours',
      blurb: 'Sokoban, but the crates are papers and the targets are desks. The classic rewrite: a player walking into a paper gives the paper the same force.',
      source: SOKOBAN
    },
    {
      id: 'revisions',
      name: 'Revisions',
      blurb: 'Push and pull. GAVEL-style recombination: the parent push rule plus a reversed force.',
      source: PULL
    },
    {
      id: 'citations',
      name: 'Three Citations',
      blurb: 'Match-3 papers. A late rule deletes any line of three after movement resolves.',
      source: MATCH
    },
    {
      id: 'stairwell',
      name: 'The Stairwell',
      blurb: 'No rewrite rules at all — PuzzleJAX calls this Blocks. The game is the maze.',
      source: EXIT
    },
    {
      id: 'quad',
      name: 'The Quad',
      blurb: 'A rake: every cell you step on changes. Cover the quad without an extra walkable tile to spare.',
      source: RAKE
    },
    {
      id: 'swap',
      name: 'Desk Swap',
      blurb: 'A mutated Sokoban gene: walking into a paper swaps you with it.',
      source: SWAP
    }
  ];

  return { SEEDS: SEEDS };
});
