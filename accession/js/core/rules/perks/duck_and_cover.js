// ACCESSION — Duck and Cover, an Artillery perk (BUILD.md §8.7): "When a special resolves and
// misses you, your next action costs 50 ticks less; at rank 2 your next attack is also a surprise
// attack." Its rules register here with Perks.add (rules/perks.js); its entry and clause are in
// js/core/reg/perks-timing.js and its sentences in js/core/text/perks-timing.js. Owned by
// PG-PERKS-TIMING.
//
// The rule (M4 plan A6, D4.3; the PROGRESS map's PR2), exactly:
//   - A miss: a special whose mark covered your tile when it was marked (Specials.atYou: a
//     damage special, so never a call, a summons or a restore) goes off with you on none of
//     its tiles (Perks.onResolve's struckYou false), while the visit goes on. A special that
//     goes off with no mark on your tile gives nothing, wherever you stand.
//   - At either rank a miss leaves the discount waiting (dept.perk.duck), and the log says so
//     (perk, cause duck). Your next action that takes time (Perks.adjust: one whose cost is a
//     turn or more, a wait, a view and an opening among them) then costs PERK_DUCK_AND_COVER
//     ticks less, and spends it. An action that takes no time (a read, a choice) or a step
//     Close the Distance made free (added before this perk, so it frees the step before the
//     discount is asked: m4-skeleton's order) keeps it waiting. Several misses before you
//     spend it leave one discount, not several.
//   - At the second rank a miss also leaves a surprise waiting (dept.perk.sure; perk, cause
//     sure): your next blow or shot (an `attacked` event of yours) at anything but the Night
//     Watchman, which is never caught by surprise (§8.4), is a surprise attack whatever its
//     target is doing (Perks.surprise, which Combat.surprised asks with the state, the odds
//     readout and the Attack button among them), and spends it; against a Centrepiece it hits
//     for certain and rolls its damage, as every surprise blow on one does (§8.1). A blow or
//     shot at the Night Watchman neither surprises it nor spends the surprise.
// Each part lasts until it is spent or the visit ends. The parts are absent until a miss first
// writes them (§4.1), and Perks.charges reads them (charge).
'use strict';
(() => {
  const ID = 'duck_and_cover';
  // dept.perk, the perks' parts (shared with the other perks, so only this perk's keys are
  // written or removed here), or null while no perk has written it.
  const part = state => state.dept.perk || null;
  const waits = (state, k) => { const p = part(state); return !!p && p[k] === true; };
  const spend = (state, k) => { const p = part(state); if (p && Object.prototype.hasOwnProperty.call(p, k)) delete p[k]; };
  function arm(state, k) {
    if (!state.dept.perk) state.dept.perk = {};
    state.dept.perk[k] = true;
  }
  const watchman = a => !!a && a.arch === 'night_watchman';
  // The first blow or shot of yours among an action's events (its `attacked`), or null.
  function yourAttack(ev) {
    for (const e of ev) if (e.k === 'attacked' && e.by === 'you') return e;
    return null;
  }
  const off = state => !!(state.options && Options.off(state, ID));

  Perks.add(ID, {
    onResolve(state, a, tel, struckYou, ev, rank) {
      const you = state.actors[0];
      if (!tel || !tel.atYou || struckYou || state.over || !you || you.gone) return;
      if (!waits(state, 'duck')) {
        arm(state, 'duck');
        Causes.emit(state, ev, 'perk', { id: ID, rank }, { k: 'duck', who: a.uid });
      }
      if (rank >= 2 && !waits(state, 'sure')) {
        arm(state, 'sure');
        Causes.emit(state, ev, 'perk', { id: ID, rank }, { k: 'sure', who: a.uid });
      }
    },
    adjust(state, action, r, ev, rank) {
      const hit = waits(state, 'sure') ? yourAttack(ev) : null;
      if (hit) { const t = Actors.byUid(state, hit.at); if (!watchman(t)) spend(state, 'sure'); }
      if (r < N.TICKS_PER_TURN || !waits(state, 'duck')) return null;
      spend(state, 'duck');
      return { r: r - N.PERK_DUCK_AND_COVER, why: ID };
    },
    surprise: (state, att, def, rank) => rank >= 2 && !!att && att.uid === 'you' && !!def && def.uid !== 'you' && !watchman(def) && waits(state, 'sure'),
    // What waits, as plain data: {ticks, surprise}, ticks the discount waiting (0 if none) and
    // surprise whether a surprise attack waits; null while neither does.
    charge(state, rank) {
      if (off(state)) return null;
      const ticks = waits(state, 'duck') ? N.PERK_DUCK_AND_COVER : 0, surprise = rank >= 2 && waits(state, 'sure');
      return ticks || surprise ? { ticks, surprise } : null;
    },
  });
})();
