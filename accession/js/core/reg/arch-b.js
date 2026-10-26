// ACCESSION — registry fragment: the kiter, the axis_sniper and the reflector, the glass and
// old_repair modifiers, and the `line` special (BUILD.md §5.5, §8.1), owned by W1-ARCH-B;
// and the causes of shots and of shots a reflector sends back.
//
// The rules behind each clause (js/core/rules/ranged.js, rules/arch/{kiter,axis_sniper,
// reflector}.js, rules/mods/{glass,old_repair}.js):
//   - kiter: keeps KITER_HOLD tiles from you (walking), backs away when you are beside it,
//     and shoots rolled bolts within ROLE_ARTILLERY_RANGE (the disc of "within r"); a bolt
//     hits the first body on its line and stops at glass, so it shoots only when you are the
//     first;
//   - axis_sniper: moves to share your row or column, then marks a `line` beam, unless a
//     reflector stands between; it never strikes;
//   - line: a beam of AXIS_BEAM_RANGE tiles along a row or column, through glass, for its
//     role curve's gross number, resolved at the owner's next action (Specials);
//   - reflector, and a body with the glass modifier: a beam turns back along its line on its
//     tile, and a bolt that meets it comes back into its shooter; nothing behind it is hit.
//     A beam's tiles are fixed when it is marked (Specials.mark), so one marked before the
//     reflector stepped (or was moved) into its line goes on through it, striking it as it
//     strikes everything on those tiles;
//   - glass: shards where it is destroyed, by the one shard rule (Cases.shardTile);
//   - old_repair: damage whose cause comes from its repaired side is doubled.
// Each entry's scenarios are in test/behaviour/<id>.test.js (the line's with the
// axis_sniper's), and its invariants in test/behaviour/arch-b.inv.js.
'use strict';
(() => {
  const R = Registry;
  const tests = id => ['behaviour/' + id + '.test.js'];

  R.define('ARCHETYPES', 'kiter', { icon: null, ranged: true,
    clause: 'Keeps {KITER_HOLD0} to {KITER_HOLD1} tiles from you and shoots within {ROLE_ARTILLERY_RANGE} tiles for {dmg}; its shots hit the first body in their way and stop at glass; backs away when you are beside it.',
    params: { KITER_HOLD0: 'N:KITER_HOLD[0]', KITER_HOLD1: 'N:KITER_HOLD[1]', ROLE_ARTILLERY_RANGE: 'N:ROLE_ARTILLERY_RANGE', dmg: 'role:DMG' },
    covers: ['attacked', 'missed'], ready: 'unit', tests: tests('kiter'), inv: 'arch-b' });
  R.define('ARCHETYPES', 'axis_sniper', { icon: null, ranged: true, special: 'line',
    clause: 'Moves to share your row or column with no reflector between you, then {special}. It never strikes.',
    params: {}, covers: ['telegraphed', 'special'], ready: 'unit', tests: tests('axis_sniper'), inv: 'arch-b' });
  R.define('ARCHETYPES', 'reflector', { icon: null,
    clause: 'Walks one tile at a time; sends beams back along their line, and shots back into whoever fired them, so nothing behind it is hit; a beam marked before it stepped into its line goes on through it; strikes from beside you for only {dmg}.',
    params: { dmg: 'role:DMG' }, covers: ['attacked', 'missed'], ready: 'unit', tests: tests('reflector'), inv: 'arch-b' });

  // A special: its shape, its effect, the §8.10 rows for its gross damage (a role curve),
  // its range and its cadence (null: whenever its archetype chooses).
  R.define('SPECIALS', 'line', { icon: 'special', shape: 'line', effect: 'damage', curve: 'ROLE_ARTILLERY_SPECIAL', range: 'AXIS_BEAM_RANGE', every: null,
    clause: 'aims along it for a turn, with the line shown, then fires a beam up to {AXIS_BEAM_RANGE} tiles that passes through glass, for {gross} before your Padding',
    params: { AXIS_BEAM_RANGE: 'N:AXIS_BEAM_RANGE', gross: 'curve:ROLE_ARTILLERY_SPECIAL' }, covers: ['telegraphed', 'special', 'damaged'], ready: 'unit', tests: tests('axis_sniper'), inv: 'arch-b' });

  // A glass body sends shots back, and a shot it sends back that misses is its `missed`.
  R.define('MODIFIERS', 'glass', { icon: null, clause: 'Leaves shards on or beside the tile where it is destroyed; sends shots back along their line, and beams marked while it is in their way.',
    params: {}, covers: ['missed'], ready: 'unit', tests: tests('glass'), inv: 'arch-b' });
  // The repaired side is a compass side from the species' modParams.old_repair.side.
  R.define('MODIFIERS', 'old_repair', { icon: null, clause: 'Its {side} side is a later repair: blows, shots and beams from that side deal double damage.',
    params: { side: 'mod:side' }, covers: [], ready: 'unit', tests: tests('old_repair'), inv: 'arch-b' });

  // Shots are rolled like blows and carry their range (Combat.attack makes k 'shot' when
  // how.kind is 'shot', with from the last tile the bolt crossed, how.via). A shot a
  // reflector sends back is the reflector's (by), naming who fired it (shooter): rolled with
  // the shooter's Acc against the Eva of the body it comes back into, on the shooter's own
  // stream, with its range (how far it flew before it met the reflector) and from the last
  // tile it crossed coming back (Ranged.shoot). A beam a reflector sends back (sp) is the
  // reflector's on the tiles it reaches only on its way back (Ranged.beamVia), with a beam's
  // numbers: gross, Padding, net and the marked tile x, y it struck.
  const shot = { by: 'uid', at: 'uid', chance: 'int', roll: 'int?', raw: 'int', pad: 'int', floor: 'int?', surprise: 'int?', side: 'str?', how: 'obj', from: 'tile', saved: 'int?', range: 'int' };
  const reflected = { by: 'uid', shooter: 'uid', sp: 'str?', chance: 'int?', roll: 'int?', raw: 'int?', gross: 'int?', pad: 'int', net: 'int?', floor: 'int?', how: 'obj?', range: 'int?', x: 'int?', y: 'int?', from: 'tile', side: 'str?', saved: 'int?' };
  R.defineCause('missed', 'shot', { fields: { by: 'uid', at: 'uid', chance: 'int', roll: 'int', how: 'obj', range: 'int' } });
  R.defineCause('missed', 'reflected', { fields: { by: 'uid', shooter: 'uid', chance: 'int', roll: 'int', how: 'obj', range: 'int' } });
  R.defineCause('damaged', 'shot', { fields: shot });
  R.defineCause('damaged', 'reflected', { fields: reflected });
  R.defineCause('died', 'shot', { fields: shot });
  R.defineCause('died', 'reflected', { fields: reflected });
})();
