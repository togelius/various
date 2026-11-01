// ACCESSION — Second Wind, an Attrition perk (BUILD.md §8.7): "Once per department, falling below
// 25% HP heals 25% of max HP over 5 turns; 40% at rank 2." Its rules register here with Perks.add
// (rules/perks.js); its entry and clause are in js/core/reg/perks-b.js and its sentences in
// js/core/text/perks-b.js. The heal over time is the status second_wind
// (js/core/reg/perk-status.js). Owned by PG-PERKS-B.
//
// The rule (PR8, M4 plan D4.7), once a visit (dept.perk.wind, absent until it comes, M4 plan
// A3), after damage to you that you live through (Perks.onLow, which Combat.hurt asks once your
// health has fallen and you still stand; with options.invulnerable, kept at 1, you stand):
//   - It comes when that damage takes you from PERK_SECOND_WIND_BELOW_PCT% of your maximum
//     health or more to below it (100 × health < PERK_SECOND_WIND_BELOW_PCT × maximum, exactly,
//     in integers). Damage that leaves you as low as you were already, or that defeats you,
//     brings nothing.
//   - It records {turn, total}: the turn it came and the health it heals in all,
//     PERK_SECOND_WIND_PCT[rank − 1]% of your maximum health then, rounded down; tells it (the
//     perk event, cause wind, with that total); and puts on second_wind for
//     PERK_SECOND_WIND_TURNS turns (cause perk second_wind), which heals the total a share at
//     each of its turns (reg/perk-status.js). It is healing, not regeneration, so it heals in
//     the night watch and while a Centrepiece hall is sealed, when regeneration stops (§8.1).
// Its charge (Perks.charges): 1 until it comes, then 0 (its uses left this visit).
'use strict';
(() => {
  const ID = 'second_wind';
  const wind = state => state.dept && state.dept.perk && state.dept.perk.wind ? state.dept.perk.wind : null;
  // Is h below PERK_SECOND_WIND_BELOW_PCT% of max?
  const below = (h, max) => 100 * h < N.PERK_SECOND_WIND_BELOW_PCT * max;
  Perks.add(ID, {
    onLow(state, who, before, ev, rank) {
      if (state.over || !who || who.uid !== 'you' || who.gone || who.hp < 1 || wind(state)) return;
      if (!below(who.hp, who.maxHp) || below(before, who.maxHp)) return;
      const total = Int.pct(who.maxHp, N.PERK_SECOND_WIND_PCT[rank - 1]);
      if (!state.dept.perk) state.dept.perk = {};
      state.dept.perk.wind = { turn: state.turn, total };
      Causes.emit(state, ev, 'perk', { id: ID, rank }, { k: 'wind', total });
      Status.apply(state, who, 'second_wind', N.PERK_SECOND_WIND_TURNS, { k: 'perk', id: ID }, ev);
    },
    charge: state => wind(state) ? 0 : 1,
  });
})();
