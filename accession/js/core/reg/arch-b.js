// ACCESSION — registry fragment: the kiter, the axis_sniper and the reflector, the glass and
// old_repair modifiers, and the `line` special (BUILD.md §5.5, §8.1), owned by W1-ARCH-B;
// and the causes of shots and of lines a reflector sends back.
'use strict';
(() => {
  const R = Registry;

  R.define('ARCHETYPES', 'kiter', { icon: null, ranged: true,
    clause: 'Keeps {KITER_HOLD0} to {KITER_HOLD1} tiles from you and shoots up to {ROLE_ARTILLERY_RANGE} tiles for {dmg}; its shots stop at glass; backs away when you are beside it.',
    params: { KITER_HOLD0: 'N:KITER_HOLD[0]', KITER_HOLD1: 'N:KITER_HOLD[1]', ROLE_ARTILLERY_RANGE: 'N:ROLE_ARTILLERY_RANGE', dmg: 'role:DMG' },
    covers: ['attacked', 'missed'], ready: false, tests: [], inv: null });
  R.define('ARCHETYPES', 'axis_sniper', { icon: null, ranged: true, special: 'line',
    clause: 'Moves to share your row or column, then {special}. It never strikes from beside you.',
    params: {}, covers: ['telegraphed', 'special'], ready: false, tests: [], inv: null });
  R.define('ARCHETYPES', 'reflector', { icon: null,
    clause: 'Walks one tile at a time; sends beams and shots back along their line, so nothing behind it is hit; strikes from beside you for only {dmg}.',
    params: { dmg: 'role:DMG' }, covers: ['attacked', 'missed'], ready: false, tests: [], inv: null });

  // A special: its shape, its effect, the §8.10 rows for its gross damage (a role curve),
  // its range and its cadence (null: whenever its archetype chooses).
  R.define('SPECIALS', 'line', { icon: 'special', shape: 'line', effect: 'damage', curve: 'ROLE_ARTILLERY_SPECIAL', range: 'AXIS_BEAM_RANGE', every: null,
    clause: 'aims along it for a turn, with the line shown, then fires a beam up to {AXIS_BEAM_RANGE} tiles that passes through glass, for {gross} before your Padding',
    params: { AXIS_BEAM_RANGE: 'N:AXIS_BEAM_RANGE', gross: 'curve:ROLE_ARTILLERY_SPECIAL' }, covers: ['telegraphed', 'special', 'damaged'], ready: false, tests: [], inv: null });

  R.define('MODIFIERS', 'glass', { icon: null, clause: 'Leaves shards on or beside the tile where it is destroyed, and sends beams back along their line.',
    params: {}, covers: [], ready: false, tests: [], inv: null });
  // The repaired side is a compass side from the species' modParams.old_repair.side.
  R.define('MODIFIERS', 'old_repair', { icon: null, clause: 'Its {side} side is a later repair: blows from that side deal double damage.',
    params: { side: 'mod:side' }, covers: [], ready: false, tests: [], inv: null });

  // Shots are rolled like blows and carry their range; a reflected line names the reflector
  // as `by` and who fired it as `shooter`.
  const shot = { by: 'uid', at: 'uid', chance: 'int', roll: 'int?', raw: 'int', pad: 'int', floor: 'int?', surprise: 'int?', side: 'str?', how: 'obj', from: 'tile', saved: 'int?', range: 'int' };
  const reflected = { by: 'uid', shooter: 'uid', sp: 'str?', raw: 'int?', pad: 'int', from: 'tile' };
  R.defineCause('missed', 'shot', { fields: { by: 'uid', at: 'uid', chance: 'int', roll: 'int', how: 'obj', range: 'int' } });
  R.defineCause('damaged', 'shot', { fields: shot });
  R.defineCause('damaged', 'reflected', { fields: reflected });
  R.defineCause('died', 'shot', { fields: shot });
  R.defineCause('died', 'reflected', { fields: reflected });
})();
