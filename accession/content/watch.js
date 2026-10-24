// ACCESSION — the Night Watchman (BUILD.md §8.4): a shared species, in no department's pack,
// who comes in at the night watch (ClockRules.spawnWatchman). Its behaviour is the
// night_watchman archetype's (rules/arch/night_watchman.js); its Behaviour line comes from
// the registry (reg/clock.js), and this paragraph is only for reading. It is an exhibit,
// whatever its name: the label never calls it a member of staff (§8.4).
'use strict';
Packs.addShared({
  id: 'night_watchman', sprite: 'night_watchman', archetype: 'night_watchman', role: 'warden', modifiers: [], trigger: 'awake',
  name: 'The Night Watchman',
  tomb: { maker: 'Unrecorded; repaired by the Museum’s workshops', date: 'In the building before the Museum', medium: 'Painted oak and iron; brass lantern; wooden rattle',
    dims: 'H. 1.8 m', credit: 'Found in the porter’s lodge when the Museum took the building' },
  paragraph: 'The figure was standing in the porter’s lodge when the Museum took the building, lantern raised, and no registrar has found who made it. ' +
    'By day it stands in a corner of the entrance hall. Its rattle is worn smooth. The cleaners who come in before dawn say they finish the far galleries ' +
    'first, and that when they hear the rattle they leave by the nearest door.',
});
