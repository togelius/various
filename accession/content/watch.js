// ACCESSION — the Night Watchman (BUILD.md §8.4): a shared species, in no department's pack,
// who enters at the night watch. W0e registers its rules-facing fields; W1-CLOCK writes its
// label (tombstone and paragraph) and its behaviour (rules/arch/night_watchman.js).
'use strict';
Packs.addShared({
  id: 'night_watchman', sprite: 'night_watchman', archetype: 'night_watchman', role: 'warden', modifiers: [], trigger: 'awake',
  name: 'The Night Watchman', tomb: null, paragraph: '',
});
