// ACCESSION — registry fragment: the perks' statuses, staggered and second_wind (BUILD.md §5.1,
// §8.1, §8.7), owned by PG-PERKS-A, then PG-PERKS-B. M4's skeleton made it; reg/system.js held no
// placeholder of its to move here (M4's Wave 0), so its owner fills it. It loads after
// js/core/rules/status.js (index.html), so that it can give each status its rule with
// Status.define beside its entry.
'use strict';
(() => {
  const R = Registry;

  // staggered (PG-PERKS-A; M4 plan D4.6, PR5: "loses its next action"): its bearer only waits
  // (skipsAction: AI.act asks Status.skips first, so it neither looks for you, nor lets a mark
  // it shows go off at its action, nor acts; a mark it shows waits with it, as §8.1 calls off
  // only a fixed exhibit's, and a line due at a boundary, the chime's, goes off there as ever;
  // Specials.threat counts the wait, so it never warns of a mark that will wait past your next
  // decision). It is put on for STAGGER_TURNS turns, and a status of N turns covers the N
  // turns from its bearer's next decision (§8.1's timing rule, Status.settle); no exhibit's
  // wait takes less than a turn (COST_WAIT, which no speed halves: Actors.cost), so a bearer
  // makes exactly one decision in one such turn, and loses exactly that action, its next.
  // Vanishing Act puts it on at the second rank (rules/perks/vanishing_act.js), and Single
  // File at either (rules/perks/single_file.js), each with the status event's perk cause
  // (reg/perks.js). It is harmful, as fixed is. Its clause continues the clause of what puts
  // it on, as every status's does; its pictogram is keyed by its id (js/view/pictograms.js).
  R.define('STATUSES', 'staggered', { built: 'M4', ready: true, tests: ['behaviour/perks-a.test.js', 'behaviour/perks-b.test.js'], inv: 'perks-a',
    icon: 'staggered', harmful: true, words: 'staggered', clause: 'loses its next action, and only waits instead', params: {}, covers: ['status'] });
  Status.define('staggered', { skipsAction: true });

  // second_wind (PG-PERKS-B; M4 plan D4.7, PR8): Second Wind's heal, put on you for
  // PERK_SECOND_WIND_TURNS turns when the perk comes (rules/perks/second_wind.js), which
  // records the health it heals in all (dept.perk.wind {turn, total}). It heals that total in
  // shares, one for each of its turns, within 1 of one another and adding up to the total, as
  // restoring's do (§8.1): share k (from 0) is idiv(total × (k + 1), T) − idiv(total × k, T).
  // Its effect acts at the boundary of each of its turns that is still to come (Status.effects,
  // boundary step 4), with the healing of every turn it covers up to that one: a status covers
  // the turns from its bearer's next decision (§8.1), so when Second Wind comes after the
  // boundary of the turn your next decision falls in (your next decision mid-turn, after a
  // Heavy blow), that turn's share comes at the next boundary with the next turn's, and no
  // share is lost. Healing is never past your maximum health (Health.heal: what does not fit
  // is not kept, as restoring's), and it is no regeneration, so the night watch and a sealed
  // hall, which stop regeneration (Clock.regenRate), do not stop it. Not harmful: Solvent
  // leaves it on.
  R.define('STATUSES', 'second_wind', { built: 'M4', ready: true, tests: ['behaviour/perks-b.test.js'], inv: 'perks-b',
    icon: 'second_wind', harmful: false, words: 'getting your second wind',
    clause: 'heals a share of what its Second Wind gives at each of its turns, never past its maximum health', params: {}, covers: ['status', 'healed'] });
  const due = (total, k) => Int.idiv(total * Math.min(k, N.PERK_SECOND_WIND_TURNS), N.PERK_SECOND_WIND_TURNS);
  Status.define('second_wind', {
    effect(state, a, s, ev) {
      const w = state.dept && state.dept.perk && state.dept.perk.wind;
      if (!w || a.uid !== 'you') return;
      const from = Number.isInteger(s.from) ? s.from : state.turn, first = Math.max(from, w.turn + 1);
      if (state.turn < first) return;
      const before = state.turn === first ? 0 : state.turn - from, n = due(w.total, state.turn - from + 1) - due(w.total, before);
      if (n > 0) Health.heal(state, a, n, { k: 'second_wind' }, ev);
    },
  });
  // Its heal (healed, cause second_wind): you regained a share of Second Wind's healing.
  R.defineCause('healed', 'second_wind', { fields: {}, built: 'M4' });
})();
