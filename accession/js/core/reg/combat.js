// ACCESSION — registry fragment: combat, specials and health (BUILD.md §8.1), owned by
// W1-COMBAT. The events of blows and specials, of waiting, resting, sitting, recovering and
// healing; the wake cause `damage` (damage always wakes, straight to hunting); and the
// refusals of sitting.
'use strict';
(() => {
  const R = Registry;
  // Where these rules are tested, and the invariant file that checks them on every step
  // (test/behaviour/combat.inv.js).
  // ready true (W2a-BEHAVIOUR): the scenarios pass joined up, every package's invariants on.
  const tested = more => Object.assign({ ready: true, tests: ['m3-combat.test.js', 'm3-health.test.js', 'behaviour/specials.test.js'], inv: 'combat' }, more);

  // A role's own rule (§5.3): a role adds a part to a Behaviour line, after its archetype's,
  // only when it has a rule of its own. The brute's blow costs COST_ATTACK_HEAVY, not
  // COST_ATTACK (Actors.attackCost, §8.1); the invariant combat_brute_blow checks it.
  R.define('CLAUSES', 'role_brute', { icon: null, clause: 'Each of its blows takes {COST_ATTACK_HEAVY} ticks, not {COST_ATTACK}.',
    params: { COST_ATTACK_HEAVY: 'N:COST_ATTACK_HEAVY', COST_ATTACK: 'N:COST_ATTACK' }, covers: [], ready: true, tests: ['behaviour/role_brute.test.js'], inv: 'combat' });

  // Refusals (§4.2): sit needs a bench under you, and you not seated on it already.
  const refusal = () => tested({ tests: ['m3-combat.test.js', 'm3-health.test.js', 'behaviour/refusals.test.js'] });
  R.define('REFUSALS', 'no_bench', refusal());
  R.define('REFUSALS', 'seated', refusal());

  // Events (§4.3).
  R.defineEvent('attacked', { fields: { by: 'uid', at: 'uid', how: 'obj' } });
  R.defineEvent('missed', { fields: { by: 'uid', at: 'uid' } });
  R.defineEvent('damaged', { fields: { who: 'uid', amount: 'int', hp: 'int' }, record: true });
  R.defineEvent('died', { fields: { who: 'uid' }, record: true });
  R.defineEvent('telegraphed', { fields: { who: 'uid', sp: 'str', tiles: 'tiles' } });
  R.defineEvent('special', { fields: { who: 'uid', sp: 'str', hits: 'uids?', cancelled: 'bool?' }, record: true });
  R.defineEvent('waited', { fields: { who: 'uid', how: 'str' } });
  R.defineEvent('regenerated', { fields: { who: 'uid', hp: 'int' } });
  R.defineEvent('healed', { fields: { who: 'uid', amount: 'int', hp: 'int' } });

  // A blow (§8.1): who struck whom, how (how.kind 'melee' or 'reach'), with the chance, the
  // roll and the damage roll; surprise marks a surprise blow, which has no roll.
  const blow = { by: 'uid', at: 'uid', chance: 'int', roll: 'int?', raw: 'int', pad: 'int', floor: 'int?', surprise: 'int?', side: 'str?', how: 'obj', from: 'tile', saved: 'int?' };
  // A special's resolve (§8.1): no roll, its gross number, your Padding and the net. Every
  // damage cause accepts saved (Combat.hurt marks an invulnerable run's save on whatever
  // cause it is given) and side (old_repair may mark a blow, a shot or a beam from its side);
  // lint-registry checks that each damaged cause does.
  const special = { by: 'uid', sp: 'str', gross: 'int', pad: 'int', net: 'int', x: 'int', y: 'int', from: 'tile', side: 'str?', saved: 'int?' };
  R.defineCause('attacked', 'attack', { fields: { by: 'uid', at: 'uid', dist: 'int', how: 'obj' } });
  R.defineCause('missed', 'attack', { fields: { by: 'uid', at: 'uid', chance: 'int', roll: 'int', how: 'obj' } });
  R.defineCause('damaged', 'attack', { fields: blow });
  R.defineCause('damaged', 'special', { fields: special });
  // A death carries the killing cause, as the damage did.
  R.defineCause('died', 'attack', { fields: blow });
  R.defineCause('died', 'special', { fields: special });
  R.defineCause('telegraphed', 'special', { fields: { by: 'uid', sp: 'str', gross: 'int', every: 'int?' } });
  R.defineCause('special', 'special', { fields: { by: 'uid', sp: 'str' } });
  R.defineCause('special', 'cancel', { fields: { by: 'uid', why: 'str' } });
  R.defineCause('waited', 'action', { fields: { how: 'str' } });
  // Regeneration (§8.1): units is the store when it reached need (REGEN_BELL_MULT times your
  // interval); bench says you sat on a bench.
  R.defineCause('regenerated', 'regen', { fields: { units: 'int', need: 'int', bench: 'bool' } });
  for (const k of ['attack', 'destroyed', 'special']) R.defineCause('noise', k, { fields: { by: 'uid?', item: 'uid?' } });

  R.define('WAKE_CAUSES', 'damage', tested({ mode: 'hunting', creation: false, tests: ['m3-combat.test.js', 'm3-health.test.js', 'behaviour/specials.test.js', 'behaviour/herald.test.js'] }));
  const wake = { by: 'uid?', dist: 'int?', x: 'int?', y: 'int?', from: 'tile?', how: 'str?' };
  R.defineCause('woke', 'damage', { fields: wake });
  R.defineCause('hunting', 'damage', { fields: wake });
})();
