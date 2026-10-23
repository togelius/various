// ACCESSION — the M0 test room: two rooms, a door, a column and three training exhibits
// with depth-1 fodder numbers (BUILD.md §8.10). Not a department.
'use strict';
const TestRoom = (() => {
  const fodder = () => Roles.stats('fodder', 1);
  const spec = {
    acc: 'T0', depth: 1,
    map: [
      '################',
      '#......#.......#',
      '#..o...#...o...#',
      '#......+.......#',
      '#..v...#.......#',
      '#......#..v....#',
      '################',
    ],
    you: [2, 3],
    exhibits: [
      { sp: 'training_dummy', at: [5, 1], mode: 'hunting', stats: fodder() },
      { sp: 'training_dummy', at: [12, 5], mode: 'hunting', stats: fodder() },
      { sp: 'training_dummy', at: [9, 1], mode: 'dormant', stats: fodder() },
    ],
  };
  return { spec, create: seed => Setup.room(seed, spec) };
})();
