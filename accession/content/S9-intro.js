// ACCESSION — S.9's Intro stamp, "The Lamp Corridor" (design/samples.md §3.4; BUILD.md §5.2,
// §5.5): the pack's `intro` part, {map, legend, stretch, cut, invariants}, which the generator
// writes into every S.9 plan's Intro (layout version 3) and population reads for its exhibits.
// It teaches the signature module only, unobserved_motion: one Grazer, the teaching instance,
// on its plinth beyond a partition, and two Hoppers by the way out to tempt you into turning
// your back on it.
//
//   col 0         1–7         8          9–14
//   the entrance  vestibule   partition  the corridor
//
// - The vestibule (columns 1–7) is the safe zone: every tile of it is within SAFE_ZONE walking
//   tiles of the entrance, and the partition, wall to wall with its one door on the entrance row
//   (the cut, column 8), hides it from everything east of it while the door is shut. Every tile
//   east of the partition is at walk 9 or more, so no exhibit's waking ring reaches the safe zone.
// - The Grazer (S9.1) stands on its plinth (11, three rows north of the entrance row), at walk 13.
//   Staggered columns (10 and 12, one row north of the entrance row; 10, three rows south) stand
//   between it and the way east: you can see it from some tiles of that way and not from others,
//   so walking past it loses sight of it unless you route to keep it in view. They are columns,
//   not plinths, because only a column blocks sight in the slice (a plinth is seen through,
//   Grid.TILES); the Grazer's own plinth and the columns are the court's free-standing blockers,
//   four pillar loops (the court needs at least two here, D-SPIKE: without them 10.8% of its
//   first layout attempts fail).
// - The two Hoppers (S9.6) wait at walk 13 by the onward openings, east and south-east, where the
//   column at 12 hides the Grazer from them: turning to fight them turns your back on it.
// - The entrance row east of the cut holds nothing opaque (the vista; the noOpaque line), and the
//   tiles against the walls from column 12 on are floor, so the onward openings can be made there.
// - Rows 0 and 10 stretch to the Intro's height (5 or 6 rows each side of the entrance in the
//   court, so row 10 stands once or twice); no exhibit stands on a stretch row (Populate.check
//   refuses one). Row 0 is plain. Row 10 is low cabinets (f) in the vestibule, so in the court
//   no tile of the safe zone lies against the Intro's south wall: the band room beyond that
//   wall runs the length of the court, and the Brooder may guard a case on its north wall,
//   whose tether (TETHER_RANGE, which needs no sight) would otherwise reach the vestibule's
//   last row through the wall, in 89 of 700 S.9 departments (D-PACKS).
// - near('g', 3): every walk from the entrance to an onward opening passes within 3 tiles of the
//   Grazer (it passes the door), which LV4 checks on every plan.
// The floor lamp of the sample is left out: the slice has no light (§5.5).
// Owned by D-STAMPS (then D-PACKS, which added the south cabinets).
'use strict';
Packs.part('S9', 'intro', {
  map: [
    '#.......|......',
    '#.......|......',
    '#.......|..g...',
    '#.......|......',
    '#.......|.o.o..',
    'E.......+......',
    '#.......|......',
    '#.......|....h.',
    '#.......|.o....',
    '#.......|....h.',
    '#fffffff|......',
  ],
  legend: {
    g: { tile: 'p', sp: 'S9.1' },
    h: { sp: 'S9.6' },
  },
  stretch: [0, 10],
  cut: '+',
  invariants: [{ near: 'g', k: 3 }],
});
