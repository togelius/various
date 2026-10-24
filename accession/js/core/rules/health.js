// ACCESSION — waiting, resting, sitting and health (BUILD.md §8.1). W0c moves M2's wait and
// regeneration here; W1-COMBAT owns the file after M3's Wave 0 and builds rest, sit, healing
// and the regeneration accumulator.
'use strict';
const Health = (() => {
  // Turns per HP of regeneration (§8.1): max(REGEN_MIN, floor(REGEN_NUM / maxHP)).
  const interval = maxHp => Math.max(N.REGEN_MIN, Int.idiv(N.REGEN_NUM, maxHp));

  // Turn boundary step 3 (§8.1). M2's rule, until W1-COMBAT's accumulator (D2.7): below full
  // health you regain 1 HP on every turn that is a multiple of your interval; the cause
  // counts one unit a turn, so it shows the interval reached.
  function regenerate(state, ev) {
    const you = state.actors[0];
    if (you.gone || you.hp >= you.maxHp) return;
    const every = interval(you.maxHp);
    if (state.turn % every === 0) {
      you.hp++;
      Causes.emit(state, ev, 'regenerated', { who: 'you', hp: you.hp }, { k: 'regen', units: every, need: every, bench: false });
    }
  }

  // [stub → W1-COMBAT] Your maximum health at a grade (§8.1); 0 until built, and nothing calls it yet.
  const maxHp = grade => 0;
  // [stub → W1-COMBAT] Healing that is not regeneration (healed, §4.3); does nothing yet.
  function heal(state, who, n, cause, ev) { return 0; }
  // [M4] After health falls and who survives (Second Wind); empty in M3.
  function onLow(state, who, ev) {}

  // wait (§4.2): one turn, always legal.
  Actions.define('wait', {
    legal: () => [{ a: 'wait' }],
    candidates: () => [{ a: 'wait' }],
    apply(state, action, ev) {
      const you = state.actors[0];
      Causes.emit(state, ev, 'waited', { who: 'you', how: 'wait' }, { k: 'action', how: 'wait' });
      return Actors.cost(state, you, N.COST_WAIT, 'act');
    },
  });
  // [stub → W1-COMBAT] rest (a repeated wait) and sit (on a bench, COST_SIT): never legal yet.
  for (const id of ['rest', 'sit']) Actions.define(id, { legal: () => [], candidates: () => [{ a: id }], apply: () => 'not_built' });

  return { interval, regenerate, maxHp, heal, onLow };
})();
