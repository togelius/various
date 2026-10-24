// ACCESSION — ordinary blows: hit chance, damage, Padding, surprise and Reach (BUILD.md §8.1).
// Every roll is drawn from the attacker's own stream, and every result carries its cause.
// Owned by W1-COMBAT after M3's Wave 0; the order inside one blow and inside hurt is fixed here.
'use strict';
const Combat = (() => {
  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  const copy = c => Causes.copy(c, 'over.cause');
  // The kinds of blow canStrike is asked about (it only reads them); a blow made gets its own
  // how, since its cause keeps it.
  const MELEE = { kind: 'melee' }, REACH = { kind: 'reach' };

  // Combat.hits(roll, chance): a d100 roll at or below the chance hits (§8.1). This is the one
  // test of a hit: every blow and shot uses it, and so does the test that the chance shown is
  // the number of faces that hit.
  const hits = (roll, chance) => roll <= chance;
  // Combat.rollHit(rng, chance) → {roll, hit}: one d100 on the stream rng, and whether it hits.
  function rollHit(rng, chance) {
    const roll = rng.d100();
    return { roll, hit: hits(roll, chance) };
  }

  // The chance att hits def (§8.1). how.acc, when given, is the Acc the blow is made with
  // (an instrument's bolt, made with your Acc without the weapon's), else the attacker's.
  function hitChance(att, def, how) {
    let mods = 0;
    if (Status.has(def, 'fixed')) mods += N.HIT_FIXED_TARGET;
    if (Status.has(att, 'dazed')) mods += N.HIT_DAZED_ATTACKER;
    const acc = how && how.acc !== undefined ? how.acc : att.acc;
    return clamp(N.HIT_BASE + N.HIT_PER_POINT * (acc - def.eva) + mods, N.HIT_MIN, N.HIT_MAX);
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
  // A surprise blow's raw damage: the maximum (how.dmax for an instrument's bolt), ×1.5
  // rounded down for a melee blow with a Light weapon.
  function surpriseRaw(att, how) {
    const kind = (how && how.kind) || 'melee', max = how && how.dmax !== undefined ? how.dmax : att.dmax;
    return kind === 'melee' && att.weaponForm === 'light' ? Int.pct(max, N.SURPRISE_LIGHT_PCT) : max;
  }
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

  // A Reach blow's way (§8.1): the direction in which some tile of b's footprint lies exactly
  // REACH_RANGE steps from a's tile, in a straight line (one of the 8 directions), or -1.
  function reachDir(a, b) {
    for (let d = 0; d < 8; d++) if (Actors.covers(b, a.x + Grid.DX[d] * N.REACH_RANGE, a.y + Grid.DY[d] * N.REACH_RANGE)) return d;
    return -1;
  }
  // Is the way of a Reach blow from a in direction d clear? Every tile between a and its
  // target must be one you could walk onto and see through (so not a wall, a closed door or a
  // case) with no actor on it ('blocked' otherwise), and each diagonal step of the way, out of
  // a's tile and into the target's, may not cut past a corner you could not step past ('corner').
  function reachWay(state, a, d) {
    const m = state.dept, dx = Grid.DX[d], dy = Grid.DY[d], diagonal = dx !== 0 && dy !== 0;
    let px = a.x, py = a.y;
    for (let k = 1; k <= N.REACH_RANGE; k++) {
      const qx = px + dx, qy = py + dy;
      if (diagonal && !(Grid.walkable(m, qx, py) && Grid.walkable(m, px, qy))) return 'corner';
      if (k < N.REACH_RANGE && (!Grid.walkable(m, qx, qy) || !Grid.seeThrough(m, qx, qy) || Actors.at(state, qx, qy))) return 'blocked';
      px = qx; py = qy;
    }
    return null;
  }

  // Combat.canStrike(state, att, def, how) → null, or the refusal code for the blow
  // (how = {kind: 'melee' | 'reach' | 'shot', …}). Nothing strikes into or out of an intact
  // case (§8.3): a blow at anything standing on one, an encased exhibit or a mimic in its
  // disguise, is refused exactly as a bump into an empty case is, so nothing leaks.
  //   melee: the footprints touch, and a diagonal blow may not cross a corner;
  //   reach: a Reach weapon (att.reach), and the target exactly REACH_RANGE tiles away in a
  //          straight line over a clear tile between (reachWay); the attacker is one tile;
  //   shot:  only the target and the glass are checked here; a shot's line, range and sight
  //          are the shooter's to check (Ranged.shoot).
  function canStrike(state, att, def, how) {
    if (!def || def.gone || def === att) return 'no_target';
    if (Cases.encased(state, att) || Cases.encased(state, def)) return 'behind_glass';
    const kind = (how && how.kind) || 'melee';
    if (kind === 'shot') return null;
    if (kind === 'reach') {
      if (!att.reach || (att.size || 1) !== 1 || Actors.between(att, def) !== N.REACH_RANGE) return 'out_of_reach';
      const d = reachDir(att, def);
      return d < 0 ? 'out_of_reach' : reachWay(state, att, d);
    }
    if (kind !== 'melee') return 'not_built';
    if (Actors.between(att, def) !== 1) return 'out_of_reach';
    if (!adjacent(state, att, def)) return 'corner';
    return null;
  }
  // Combat.reachTargets(state, a) → [uid]: the actors a could strike with a Reach blow now,
  // in spawn order (none without a Reach weapon). An actor beside a is struck as usual, so it
  // is not among them.
  function reachTargets(state, a) {
    const out = [];
    if (!a.reach) return out;
    for (const b of state.actors) if (b !== a && !b.gone && !canStrike(state, a, b, REACH)) out.push(b.uid);
    return out;
  }
  // The blow you would make at t now, {kind, code}: a melee blow if one is allowed; otherwise,
  // with a Reach weapon, a Reach blow if one is allowed; otherwise the refusal, Reach's for a
  // target REACH_RANGE away and the melee blow's for any other.
  function yourBlow(state, you, t) {
    const melee = canStrike(state, you, t, MELEE);
    if (!melee || !you.reach || melee === 'no_target' || melee === 'behind_glass') return { kind: 'melee', code: melee };
    const reach = canStrike(state, you, t, REACH);
    if (!reach) return { kind: 'reach', code: null };
    return { kind: 'melee', code: Actors.between(you, t) === N.REACH_RANGE ? reach : melee };
  }

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

  // One blow or shot (§8.1), the caller having checked it and paid for it. A Reach blow is a
  // blow like any other, from the attacker's tile; it can surprise, but only a Light weapon's
  // melee blow deals ×1.5 by surprise.
  // how = {kind: 'melee' | 'reach' | 'shot', range?, via?, item?, dmin?, dmax?, acc?}:
  //   range  a shot's distance in tiles (required for a shot);
  //   via    for a shot, the last tile the bolt crossed before the target (where it came from);
  //   item   the instrument that fired it (the Pin-Driver);
  //   dmin, dmax, acc  the damage range and Acc it is made with, if not the attacker's own.
  // Its cause is k 'attack' for a blow, 'shot' for a shot, and 'item' for an instrument's
  // bolt (a shot with how.item, naming the item); a shot's cause carries its range. In order:
  //   1. `attacked` {by, at, how};
  //   2. surprise, or a roll on att's combat stream;
  //   3. on a miss `missed`; on a hit Combat.hurt, with cause.from the tile the blow came from:
  //      the attacker's tile nearest the target, or for a shot how.via;
  //   4. last, a soft noise at the attacker's tile, hit or miss, after every other wake
  //      effect of the blow (§8.2).
  // A line a reflector sends back is not a blow of the reflector's: Ranged.shoot (W1-ARCH-B)
  // makes its cause, {k: 'reflected', by: the reflector, shooter, …, from}, and calls
  // Combat.hurt itself.
  function attack(state, att, def, ev, how) {
    how = how || { kind: 'melee' };
    const shot = how.kind === 'shot';
    if (shot && !Number.isInteger(how.range)) throw new Error(`Combat.attack: ${att.uid}'s shot at ${def.uid} gives no range`);
    const rng = Rng.stream(state, 'combat/' + att.uid);
    const chance = hitChance(att, def, how), from = shot && how.via ? how.via.slice() : fromTile(att, def);
    const dmin = how.dmin !== undefined ? how.dmin : att.dmin, dmax = how.dmax !== undefined ? how.dmax : att.dmax;
    Causes.emit(state, ev, 'attacked', { by: att.uid, at: def.uid, how }, { k: 'attack', by: att.uid, at: def.uid, dist: Actors.between(att, def), how });
    const cause = { k: shot ? (how.item ? 'item' : 'shot') : 'attack', by: att.uid, at: def.uid, chance };
    if (shot) cause.range = how.range;
    if (shot && how.item) cause.item = how.item;
    // A surprise blow always hits, and the target then hunts you (hurt). Against a Centrepiece
    // it rolls its damage, and the hunt it starts is the encounter.
    if (surprised(att, def)) {
      const dmg = Actors.centrepiece(def) ? rng.int(dmin, dmax) : surpriseRaw(att, how);
      cause.surprise = 1;
      Object.assign(cause, { raw: dmg, pad: def.pad, how, from });
      hurt(state, def, net(dmg, def.pad, cause), cause, ev);
    } else {
      const r = rollHit(rng, chance);
      cause.roll = r.roll;
      if (!r.hit) Causes.emit(state, ev, 'missed', { by: att.uid, at: def.uid }, Object.assign(cause, { how }));
      else {
        const raw = rng.int(dmin, dmax);
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
  //   1. the archetype and modifiers adjust it (Archetypes.adjustDamage; old_repair may mark
  //      cause.side on a blow, a shot or a beam);
  //   2. health falls; with options.invulnerable your health stays at 1 or more and the
  //      cause says `saved` (so every damage cause's schema accepts saved and side);
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

  // who is destroyed (§8.1): `died` with the killing cause; its pending mark, if any, is
  // cancelled; its archetype's and modifiers' onDied; a loud noise where an exhibit was
  // destroyed; and its own combat and ai streams are deleted, so state.rng stays small
  // (§3.2). If who is you, the visit is over.
  function die(state, who, cause, ev) {
    who.gone = 1;
    Causes.emit(state, ev, 'died', { who: who.uid }, cause);
    if (who.telegraph) Specials.cancel(state, who, 'died', ev);
    Archetypes.onDied(state, who, cause, ev);
    delete state.rng['combat/' + who.uid];
    delete state.rng['ai/' + who.uid];
    if (who.uid === 'you') state.over = { k: 'died', turn: state.turn, by: cause.by || null, door: null, cause: copy(cause) };
    else Noise.emit(state, who.x, who.y, 'loud', { k: 'destroyed', by: cause.by || null }, ev);
  }

  // Your attack(uid) action (§4.2): a blow at an actor beside you, or with a Reach weapon at one
  // REACH_RANGE tiles away in a straight line (yourBlow). It costs your weapon's blow.
  Actions.define('attack', {
    legal(state) {
      const you = state.actors[0], out = [];
      for (const a of state.actors) if (a !== you && !a.gone && !yourBlow(state, you, a).code) out.push({ a: 'attack', uid: a.uid });
      return out;
    },
    candidates: state => state.actors.map(a => ({ a: 'attack', uid: a.uid })).concat([{ a: 'attack', uid: 'nobody' }, { a: 'attack' }]),
    apply(state, action, ev) {
      const you = state.actors[0], t = typeof action.uid === 'string' ? Actors.byUid(state, action.uid) : null;
      const b = yourBlow(state, you, t);
      if (b.code) return b.code;
      if (b.kind === 'melee') return strike(state, you, t, ev);
      attack(state, you, t, ev, { kind: 'reach' });
      return Actors.attackCost(state, you);
    },
  });

  return { hits, rollHit, hitChance, surprised, netRolls, surpriseRaw, surpriseNet, adjacent, canStrike, reachTargets, strike, attack, hurt, die };
})();
