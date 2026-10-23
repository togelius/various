// ACCESSION — ordinary blows: hit chance, damage, Padding, surprise (BUILD.md §8.1).
// Every roll is drawn from the attacker's own stream, and every result carries its cause.
'use strict';
const Combat = (() => {
  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

  function hitChance(att, def) {
    let mods = 0;
    if (Status.has(def, 'fixed')) mods += N.HIT_FIXED_TARGET;
    if (Status.has(att, 'dazed')) mods += N.HIT_DAZED_ATTACKER;
    return clamp(N.HIT_BASE + N.HIT_PER_POINT * (att.acc - def.eva) + mods, N.HIT_MIN, N.HIT_MAX);
  }

  // Is the defender unaware of the attacker? Only exhibits can be surprised.
  const surprised = (att, def) => def.uid !== 'you' && def.mode !== 'hunting';

  // Resolve one attack. Returns the events; the caller has already paid the cost.
  function attack(state, att, def, ev) {
    const rng = Rng.stream(state, 'combat/' + att.uid);
    const chance = hitChance(att, def);
    const cause = { k: 'attack', by: att.uid, at: def.uid, chance };
    if (surprised(att, def)) {
      let dmg = att.dmax;
      if (att.weaponForm === 'light') dmg = Int.pct(dmg, N.SURPRISE_LIGHT_PCT);
      cause.surprise = 1;
      return hurt(state, def, net(dmg, def.pad, cause), Object.assign(cause, { raw: dmg, pad: def.pad }), ev);
    }
    const roll = rng.d100();
    cause.roll = roll;
    if (roll > chance) { ev.push({ k: 'missed', turn: state.turn, by: att.uid, at: def.uid, cause: copy(cause) }); return; }
    const raw = rng.int(att.dmin, att.dmax);
    hurt(state, def, net(raw, def.pad, cause), Object.assign(cause, { raw, pad: def.pad }), ev);
  }

  // Damage after Padding, at least the minimum; the cause records when the floor applied.
  function net(raw, pad, cause) {
    if (raw - pad < N.DMG_MIN_ON_HIT) { cause.floor = N.DMG_MIN_ON_HIT; return N.DMG_MIN_ON_HIT; }
    return raw - pad;
  }

  function hurt(state, who, amount, cause, ev) {
    who.hp -= amount;
    if (who.hp < 0) who.hp = 0;
    ev.push({ k: 'damaged', turn: state.turn, who: who.uid, amount, hp: who.hp, cause: copy(cause) });
    Causes.record(state, { turn: state.turn, k: 'damaged', who: who.uid, amount, cause });
    if (who.uid !== 'you' && who.mode !== 'hunting') Wake.toHunting(state, who, { k: 'damage', by: cause.by }, ev);
    if (who.hp === 0) die(state, who, cause, ev);
  }

  function die(state, who, cause, ev) {
    who.gone = 1;
    ev.push({ k: 'died', turn: state.turn, who: who.uid, cause: copy(cause) });
    Causes.record(state, { turn: state.turn, k: 'died', who: who.uid, cause });
    if (who.uid === 'you') state.over = { k: 'died', turn: state.turn, by: cause.by || null };
  }

  const copy = c => JSON.parse(JSON.stringify(c));

  return { hitChance, surprised, attack, hurt };
})();
