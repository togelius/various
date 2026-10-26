// ACCESSION — waiting, resting, sitting and health (BUILD.md §8.1). Owned by W1-COMBAT after
// M3's Wave 0: your maximum health, regeneration by a store of units, healing, and the
// actions wait, rest and sit.
//
// Regeneration (§8.1, turn boundary step 3) is kept as a store, you.regen, so that a rate
// that halves or doubles stays exact on an odd interval:
//   - each turn below full health the store gains Health.rate units: Clock.regenRate
//     (REGEN_BELL_MULT, 2, while the department is open, 1 after the bell, 0 in the night
//     watch or while a hall is sealed), times BENCH_MULT while you sit on a bench;
//   - each time it reaches REGEN_BELL_MULT times your interval (Health.interval) you regain 1
//     health and the store gives up that much, so the open rate is 1 every interval and the
//     bell multiplies the interval by REGEN_BELL_MULT;
//   - at full health the store is empty, so nothing builds up to spend later.
// So at 20 maximum health you regain 1 every 20 turns, 10 on a bench, 40 after the bell and
// 20 on a bench after it; at 30, every 13 turns, or 6.5 on average on a bench.
'use strict';
const Health = (() => {
  // Turns per HP of regeneration (§8.1): max(REGEN_MIN, floor(REGEN_NUM / maxHP)).
  const interval = maxHp => Math.max(N.REGEN_MIN, Int.idiv(N.REGEN_NUM, maxHp));
  // Your maximum health at a grade (§8.1): PLAYER_HP, and HP_PER_GRADE more for each grade above I.
  const maxHp = grade => N.PLAYER_HP + N.HP_PER_GRADE * (grade - N.GRADE_START);

  // Are you sitting on a bench? Sitting is only allowed on one, and anything but waiting and
  // resting gets you up again (Step), so this is whether you are seated where a bench is.
  function onBench(state) {
    const you = state.actors[0];
    return !!you.seated && Grid.ch(state.dept, you.x, you.y) === 'b';
  }
  // Health.rate(state) → the regeneration units you gain a turn now (see above).
  const rate = state => Clock.regenRate(state) * (onBench(state) ? N.BENCH_MULT : 1);

  // Turn boundary step 3 (§8.1): the store gains its units; at REGEN_BELL_MULT times your
  // interval you regain 1 health (regenerated, with the store reached, the units needed and
  // whether you sat on a bench). At full health the store is emptied instead.
  function regenerate(state, ev) {
    const you = state.actors[0];
    if (you.gone) return;
    if (you.hp >= you.maxHp) { you.regen = 0; return; }
    const units = rate(state);
    if (units <= 0) return;
    const need = N.REGEN_BELL_MULT * interval(you.maxHp);
    you.regen += units;
    if (you.regen < need) return;
    const reached = you.regen;
    you.hp++;
    you.regen = you.hp >= you.maxHp ? 0 : reached - need;
    Causes.emit(state, ev, 'regenerated', { who: 'you', hp: you.hp }, { k: 'regen', units: reached, need, bench: onBench(state) });
  }

  // Health.heal(state, who, n, cause, ev) → the health regained: who regains n health, never
  // past its maximum, with healed {who, amount, hp} and the cause given (§4.3: any gain of
  // health but regeneration: Consolidant, restoring, a warden home again). Nothing is
  // regained by an actor that is gone or already whole, and then no event is emitted.
  function heal(state, who, n, cause, ev) {
    if (!Number.isInteger(n) || n < 0) throw new Error(`Health.heal: ${who && who.uid} cannot regain ${n} health`);
    if (!cause || typeof cause.k !== 'string') throw new Error(`Health.heal: healing ${who && who.uid} needs a cause`);
    if (!who || who.gone) return 0;
    const amount = Math.max(0, Math.min(n, who.maxHp - who.hp));
    if (!amount) return 0;
    who.hp += amount;
    Causes.emit(state, ev, 'healed', { who: who.uid, amount, hp: who.hp }, cause);
    return amount;
  }

  // [M4] After health falls and who survives (Second Wind); empty in M3.
  function onLow(state, who, ev) {}

  // wait and rest (§4.2): one turn, always legal (even while fixed, Status.blocks). Rest is a
  // wait under its own name, which the interface repeats; both keep you seated.
  function pause(id) {
    Actions.define(id, {
      legal: () => [{ a: id }],
      candidates: () => [{ a: id }],
      apply(state, action, ev) {
        const you = state.actors[0];
        Causes.emit(state, ev, 'waited', { who: 'you', how: id }, { k: 'action', how: id });
        return Actors.cost(state, you, N.COST_WAIT, 'act');
      },
    });
  }
  pause('wait');
  pause('rest');

  // sit (§4.2): sit down on the bench you stand on, for COST_SIT, if you are not seated
  // already. Seated, you regenerate at BENCH_MULT times the rate until an action other than
  // waiting or resting gets you up (Step).
  const sitCode = state => {
    const you = state.actors[0];
    if (Grid.ch(state.dept, you.x, you.y) !== 'b') return 'no_bench';
    return you.seated ? 'seated' : null;
  };
  Actions.define('sit', {
    legal: state => sitCode(state) ? [] : [{ a: 'sit' }],
    candidates: () => [{ a: 'sit' }],
    apply(state, action, ev) {
      const code = sitCode(state);
      if (code) return code;
      const you = state.actors[0];
      you.seated = true;
      Causes.emit(state, ev, 'waited', { who: 'you', how: 'sit' }, { k: 'action', how: 'sit' });
      return Actors.cost(state, you, N.COST_SIT, 'act');
    },
  });

  return { interval, maxHp, rate, onBench, regenerate, heal, onLow };
})();
