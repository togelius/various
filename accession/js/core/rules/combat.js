// ACCESSION — ordinary blows: hit chance, damage, Padding, surprise (BUILD.md §8.1). Every
// roll is drawn from the attacker's own stream, and every result carries its cause. Owned by
// W1-COMBAT after M3's Wave 0; the order inside one blow and inside hurt is fixed here.
'use strict';
const Combat = (() => {
  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  const copy = c => JSON.parse(JSON.stringify(c));

  function hitChance(att, def) {
    let mods = 0;
    if (Status.has(def, 'fixed')) mods += N.HIT_FIXED_TARGET;
    if (Status.has(att, 'dazed')) mods += N.HIT_DAZED_ATTACKER;
    return clamp(N.HIT_BASE + N.HIT_PER_POINT * (att.acc - def.eva) + mods, N.HIT_MIN, N.HIT_MAX);
  }

  // Surprise (BUILD.md §8.1): an exhibit is caught unawares while asleep or stirring (mode
  // dormant), or awake and it has not seen you since it last woke (`sawYou`, Wake). Hunting,
  // searching, returning and reinstalling exhibits never are, and neither are you.
  const surprised = (att, def) => def.uid !== 'you' && (def.mode === 'dormant' || (def.mode === 'awake' && !def.sawYou));

  // Every roll an attacker could make against a defender, after Padding (BUILD.md §8.1):
  // how many there are, their sum, and the least and most. The odds readout uses these.
  function netRolls(att, def) {
    let n = 0, sum = 0, min = 0, max = 0;
    for (let r = att.dmin; r <= att.dmax; r++) {
      const d = Math.max(N.DMG_MIN_ON_HIT, r - def.pad);
      if (!n || d < min) min = d;
      if (d > max) max = d;
      n++; sum += d;
    }
    return { n, sum, min, max };
  }
  // A surprise blow's raw damage: the maximum, ×1.5 rounded down with a Light weapon.
  function surpriseRaw(att) { return att.weaponForm === 'light' ? Int.pct(att.dmax, N.SURPRISE_LIGHT_PCT) : att.dmax; }
  // What a surprise blow would deal now, after Padding, as { min, max }: one figure, or
  // against a Centrepiece the rolled range, since its surprise blow rolls damage (§8.1).
  function surpriseNet(att, def) {
    if (Actors.centrepiece(def)) { const r = netRolls(att, def); return { min: r.min, max: r.max }; }
    const d = Math.max(N.DMG_MIN_ON_HIT, surpriseRaw(att) - def.pad);
    return { min: d, max: d };
  }

  // Can a reach b with a blow? Some tile of a's footprint is next to some tile of b's
  // (BUILD.md §4.1), and a diagonal blow may not cross a corner you could not step past.
  function adjacent(state, a, b) {
    const m = state.dept, sa = a.size || 1, sb = b.size || 1;
    for (let ay = a.y; ay < a.y + sa; ay++) for (let ax = a.x; ax < a.x + sa; ax++)
      for (let by = b.y; by < b.y + sb; by++) for (let bx = b.x; bx < b.x + sb; bx++) {
        const dx = bx - ax, dy = by - ay;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) continue;
        if (dx === 0 || dy === 0) return true;
        if (Grid.walkable(m, bx, ay) && Grid.walkable(m, ax, by)) return true;
      }
    return false;
  }

  // Combat.canStrike(state, att, def, how) → null, or the refusal code for the blow
  // (how = {kind: 'melee' | 'reach' | 'shot', …}). Nothing strikes into or out of an intact
  // case (§8.3): a blow at anything standing on one, an encased exhibit or a mimic in its
  // disguise, is refused exactly as a bump into an empty case is, so nothing leaks. A melee
  // blow needs the footprints to touch, and a diagonal one may not cross a corner.
  function canStrike(state, att, def, how) {
    if (!def || def.gone || def === att) return 'no_target';
    if (Cases.encased(state, att) || Cases.encased(state, def)) return 'behind_glass';
    const kind = (how && how.kind) || 'melee';
    if (kind !== 'melee') return 'not_built';                 // Reach (W1-COMBAT), shots (W1-ARCH-B)
    if (Actors.between(att, def) !== 1) return 'out_of_reach';
    if (!adjacent(state, att, def)) return 'corner';
    return null;
  }
  // [stub → W1-COMBAT] The uids a Reach weapon could strike now (§8.1).
  function reachTargets(state, a) { return []; }

  // A melee blow from att at def, which canStrike allowed. Returns its cost in ticks.
  function strike(state, att, def, ev) {
    attack(state, att, def, ev, { kind: 'melee' });
    return Actors.attackCost(state, att);
  }

  // The tile of att's footprint nearest def (ties in row-major order): where a blow comes from.
  function fromTile(att, def) {
    let best = null, bd = -1;
    for (const t of Actors.footprint(att)) { const d = Actors.dist(def, t[0], t[1]); if (bd < 0 || d < bd) { best = t; bd = d; } }
    return best;
  }

  // One blow (§8.1), the caller having checked it and paid for it, in this order:
  //   1. `attacked` {by, at, how};
  //   2. surprise, or a roll on att's combat stream;
  //   3. on a miss `missed`; on a hit Combat.hurt, with cause.from the tile the blow came from;
  //   4. last, a soft noise at the attacker's tile, hit or miss, after every other wake
  //      effect of the blow (§8.2).
  function attack(state, att, def, ev, how) {
    how = how || { kind: 'melee' };
    const rng = Rng.stream(state, 'combat/' + att.uid);
    const chance = hitChance(att, def), from = fromTile(att, def);
    Causes.emit(state, ev, 'attacked', { by: att.uid, at: def.uid, how }, { k: 'attack', by: att.uid, at: def.uid, dist: Actors.between(att, def), how });
    const cause = { k: 'attack', by: att.uid, at: def.uid, chance };
    // A surprise blow always hits, and the target then hunts you (hurt). Against a Centrepiece
    // it rolls its damage, and the hunt it starts is the encounter.
    if (surprised(att, def)) {
      const dmg = Actors.centrepiece(def) ? rng.int(att.dmin, att.dmax) : surpriseRaw(att);
      cause.surprise = 1;
      Object.assign(cause, { raw: dmg, pad: def.pad, how, from });
      hurt(state, def, net(dmg, def.pad, cause), cause, ev);
    } else {
      const roll = rng.d100();
      cause.roll = roll;
      if (roll > chance) Causes.emit(state, ev, 'missed', { by: att.uid, at: def.uid }, Object.assign(cause, { how }));
      else {
        const raw = rng.int(att.dmin, att.dmax);
        Object.assign(cause, { raw, pad: def.pad, how, from });
        hurt(state, def, net(raw, def.pad, cause), cause, ev);
      }
    }
    Noise.emit(state, att.x, att.y, 'soft', { k: 'attack', by: att.uid }, ev);
  }

  // Damage after Padding, at least the minimum; the cause records when the floor applied.
  function net(raw, pad, cause) {
    if (raw - pad < N.DMG_MIN_ON_HIT) { cause.floor = N.DMG_MIN_ON_HIT; return N.DMG_MIN_ON_HIT; }
    return raw - pad;
  }

  // Damage to who (§8.1), in this order:
  //   1. the archetype and modifiers adjust it (Archetypes.adjustDamage);
  //   2. health falls; with options.invulnerable your health stays at 1 or more and the
  //      cause says `saved`;
  //   3. `damaged`;
  //   4. an exhibit not already hunting wakes into a hunt (damage, with its distance);
  //   5. its group hears of it (Wake.allyHit);
  //   6. at 0 health it is destroyed (Combat.die); otherwise Archetypes.onDamaged, then the
  //      M4 low-health hook.
  function hurt(state, who, amount, cause, ev) {
    amount = Archetypes.adjustDamage(state, who, amount, cause);
    who.hp -= amount;
    if (who.hp < 0) who.hp = 0;
    if (who.uid === 'you' && who.hp < 1 && state.options && state.options.invulnerable) { who.hp = 1; cause.saved = 1; }
    Causes.emit(state, ev, 'damaged', { who: who.uid, amount, hp: who.hp }, cause);
    if (who.uid !== 'you' && who.mode !== 'hunting') {
      const wake = { k: 'damage' };
      if (cause.by) wake.by = cause.by;
      if (cause.from) wake.dist = Actors.dist(who, cause.from[0], cause.from[1]);
      Wake.toHunting(state, who, wake, ev);
    }
    Wake.allyHit(state, who, cause, ev);
    if (who.hp === 0) die(state, who, cause, ev);
    else { Archetypes.onDamaged(state, who, amount, cause, ev); Health.onLow(state, who, ev); }
  }

  // who is destroyed (§8.1): `died` with the killing cause; its archetype's and modifiers'
  // onDied; a loud noise where an exhibit was destroyed; and its own combat and ai streams
  // are deleted, so state.rng stays small (§3.2). If who is you, the visit is over.
  function die(state, who, cause, ev) {
    who.gone = 1;
    Causes.emit(state, ev, 'died', { who: who.uid }, cause);
    Archetypes.onDied(state, who, cause, ev);
    delete state.rng['combat/' + who.uid];
    delete state.rng['ai/' + who.uid];
    if (who.uid === 'you') state.over = { k: 'died', turn: state.turn, by: cause.by || null, door: null, cause: copy(cause) };
    else Noise.emit(state, who.x, who.y, 'loud', { k: 'destroyed', by: cause.by || null }, ev);
  }

  // Your attack(uid) action (§4.2): a melee blow at an actor canStrike allows.
  Actions.define('attack', {
    legal(state) {
      const you = state.actors[0], out = [];
      for (const a of state.actors) if (a !== you && !a.gone && !canStrike(state, you, a, { kind: 'melee' })) out.push({ a: 'attack', uid: a.uid });
      return out;
    },
    candidates: state => state.actors.map(a => ({ a: 'attack', uid: a.uid })).concat([{ a: 'attack', uid: 'nobody' }, { a: 'attack' }]),
    apply(state, action, ev) {
      const you = state.actors[0], t = typeof action.uid === 'string' ? Actors.byUid(state, action.uid) : null;
      const code = canStrike(state, you, t, { kind: 'melee' });
      return code || strike(state, you, t, ev);
    },
  });

  return { hitChance, surprised, netRolls, surpriseRaw, surpriseNet, adjacent, canStrike, reachTargets, strike, attack, hurt, die };
})();
