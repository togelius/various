// ACCESSION — registry fragment: the conservator_healer archetype, its special `restore`, and the
// clockwork modifier (BUILD.md §5.1, §5.5, §8.1), owned by ARCH-CLOCKWORK. M4's skeleton made it;
// M4's Wave 0 (W0a) moved here, verbatim from reg/system.js, the placeholders that were its (M2's
// clauses). ARCH-CLOCKWORK built the rest: the rules are in js/core/rules/arch/conservator_healer.js
// and js/core/rules/mods/clockwork.js; the scenarios that prove each clause in
// test/behaviour/{conservator_healer,clockwork}.test.js, and the invariants in
// test/behaviour/arch-d.inv.js.
'use strict';
(() => {
  const R = Registry;
  // ready true: the scenarios pass joined up, every package's invariants on, and clockwork's
  // fail with clockwork switched off.
  const proved = tests => ({ built: 'M4', ready: true, tests, inv: 'arch-d' });
  const HEALER = ['behaviour/conservator_healer.test.js', 'behaviour/clockwork.test.js'], CLOCKWORK = ['behaviour/clockwork.test.js', 'behaviour/conservator_healer.test.js'];

  // The healer (§5.5's Countersigning Clerk; M4 plan D3.13): it keeps CONSERVATOR_KEEP tiles from
  // you by walking (as the kiter's KITER_HOLD is counted), stepping away when you are nearer,
  // never strikes, and restores the ally it sees that has lost the most health. Its interrupt
  // is cut (D3.7: nothing calls off a mark but what calls off any). M2's placeholder ("Stays
  // behind its allies and spends a turn, shown, restoring one; backs away when you come close.")
  // named no distance, no amount and no choice of ally.
  R.define('ARCHETYPES', 'conservator_healer', Object.assign({ icon: null, special: 'restore',
    clause: 'Keeps {CONSERVATOR_KEEP} tiles from you, stepping away when you come nearer, and never strikes; {special}.',
    params: { CONSERVATOR_KEEP: 'N:CONSERVATOR_KEEP' }, covers: [] }, proved(HEALER)));

  // Its restore (§8.1's specials): a mark that deals no damage (effect heal), on the tile of the
  // ally it sees within SIGHT_EXHIBIT that has lost the most health, shown until its next
  // action, when every exhibit standing there regains CONSERVATOR_HEAL_PCT% of its own maximum
  // health, rounded down and never past it ("up to"). Named a restore in sentences (noun); its
  // mark is told as marking "an ally" (marks), the board showing the tile.
  R.define('SPECIALS', 'restore', Object.assign({ icon: 'special', shape: 'restore', effect: 'heal', curve: null, range: 'SIGHT_EXHIBIT', every: null,
    noun: 'restore', marks: 'an ally',
    clause: 'it marks the tile of the ally it sees within {SIGHT_EXHIBIT} tiles that has lost the most health, and at its next action restores up to {CONSERVATOR_HEAL_PCT}% of the maximum health of the exhibit standing there',
    params: { SIGHT_EXHIBIT: 'N:SIGHT_EXHIBIT', CONSERVATOR_HEAL_PCT: 'N:CONSERVATOR_HEAL_PCT' }, covers: ['telegraphed', 'special', 'healed'] }, proved(HEALER)));

  // Clockwork (M4 plan A11, D3.12; R9's "does it if it still can, otherwise waits"): the move
  // it shows is the one it makes, if it still can; else it waits. A station's arrow is its line
  // (D1.10). "else waits", not A11's "otherwise waits": M.11's stations' lines, the longest
  // with clockwork, then take 14 rows of the strip, its budget, not 15 (m4-lines). Rain on
  // clockwork is weather_cases' rule (D1.3), on an exhibit flagged with that module (M.11's
  // gallery station, not the Intro's); its part, set in this clause's slot, is empty (MOD-WEATHER,
  // decided without play: the station's line has no room for it), so no line says anything of
  // rain, and the rain's stop is told on the label of a case that holds rain (reg/mod-weather.js).
  R.define('MODIFIERS', 'clockwork', Object.assign({ icon: null,
    clause: 'Shows its next move as an arrow and makes it if it still can, else waits{module:weather_cases|}; cannot be dazed.',
    params: {}, covers: [] }, proved(CLOCKWORK)));

  // Healing by a restore (§4.3's healed): by the healer whose restore it was.
  R.defineCause('healed', 'restore', { fields: { by: 'uid' }, built: 'M4' });
})();
