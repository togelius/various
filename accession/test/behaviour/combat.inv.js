// ACCESSION — the invariants of blows, specials and health (BUILD.md §8.1; §5.3, check 1),
// checked after every step of every monkey, soak, scenario and bot run. Each is checked once
// a step, over that step's events, the state before it (pre, a clone) and after it (post).
// The registry's combat entries name this file (inv: 'combat').
'use strict';
module.exports = C => {
  const { N, Causes, Combat, Specials, Cases, Archetypes, Registry, Health, Grid } = C;
  const KINDS = ['attacked', 'missed', 'damaged', 'died', 'telegraphed', 'special', 'waited', 'regenerated', 'healed'];
  const ROLLED = ['attack', 'shot', 'item'];
  const isInt = v => Number.isInteger(v);
  const byUid = (state, uid) => state.actors.find(a => a.uid === uid) || null;
  const floor = (raw, pad) => Math.max(N.DMG_MIN_ON_HIT, raw - pad);

  // Does the defender's archetype or a modifier change damage given to it (adjustDamage)? It
  // is asked with a probe amount, on the state before the step: a hook that changes the probe
  // adjusts (mote_swarm, old_repair from its side); one that leaves it alone does not. A blow
  // whose cause marks the side it came from (old_repair) counts as adjusted, whatever the
  // probe says, since the defender may have moved during the step.
  const PROBE = 1000003;
  function adjusted(pre, post, uid, cause) {
    if (cause.side !== undefined && cause.side !== null) return true;
    const who = byUid(pre, uid) || byUid(post, uid);
    if (!who || who.uid === 'you') return false;
    try { return Archetypes.adjustDamage(pre, who, PROBE, JSON.parse(JSON.stringify(cause))) !== PROBE; } catch (e) { return true; }
  }

  return [
    {
      // Every event of these rules has its cause, and its fields and its cause's fields are
      // exactly those its schema names (§3.4).
      id: 'combat_causes',
      check(pre, events) {
        for (const e of events) {
          if (!KINDS.includes(e.k)) continue;
          const bad = Causes.check(e);
          if (bad) return `${e.k} at tick ${e.tick}: ${bad}`;
        }
        return null;
      },
    },
    {
      // A blow or shot hits exactly when its d100 roll is at or below its chance (§8.1), and
      // the chance lies within HIT_MIN and HIT_MAX; a surprise blow has no roll and always hits.
      id: 'combat_roll',
      check(pre, events) {
        for (const e of events) {
          if ((e.k !== 'damaged' && e.k !== 'missed') || !e.cause || !ROLLED.includes(e.cause.k)) continue;
          const c = e.cause;
          if (!isInt(c.chance) || c.chance < N.HIT_MIN || c.chance > N.HIT_MAX) return `${e.k} by ${c.by}: chance ${c.chance} is outside ${N.HIT_MIN}–${N.HIT_MAX}`;
          if (c.surprise) {
            if (e.k === 'missed') return `a surprise blow by ${c.by} missed`;
            if (c.roll !== undefined) return `a surprise blow by ${c.by} rolled ${c.roll}`;
            continue;
          }
          if (!isInt(c.roll) || c.roll < 1 || c.roll > 100) return `${e.k} by ${c.by}: roll ${c.roll} is not a d100 face`;
          if (Combat.hits(c.roll, c.chance) !== (e.k === 'damaged')) return `${e.k} by ${c.by}: rolled ${c.roll} against ${c.chance}%`;
        }
        return null;
      },
    },
    {
      // Damage is max(DMG_MIN_ON_HIT, raw − Padding) for a blow or shot and Specials.net(gross,
      // Padding) for a special, through the Padding the defender had when the step began (your
      // stats change only when your action is done), unless its archetype or a modifier adjusts
      // it; the floor is marked exactly when it applied.
      id: 'combat_damage',
      check(pre, events, post) {
        for (const e of events) {
          if (e.k !== 'damaged' || !e.cause) continue;
          const c = e.cause, before = byUid(pre, e.who);
          if (!isInt(e.amount) || e.amount < 0) return `${e.who} took ${e.amount} damage`;
          if (before && isInt(c.pad) && c.pad !== before.pad) return `${e.who} was struck through Padding ${c.pad}, but had ${before.pad} when the step began`;
          let net = null;
          if (c.k === 'special') {
            if (c.net !== Specials.net(c.gross, c.pad)) return `${c.by}'s ${c.sp} gave net ${c.net} for gross ${c.gross} through Padding ${c.pad}`;
            net = c.net;
          } else if (ROLLED.includes(c.k)) {
            if (!isInt(c.raw) || !isInt(c.pad)) return `${c.k} damage to ${e.who} has raw ${c.raw} and Padding ${c.pad}`;
            net = floor(c.raw, c.pad);
            if ((c.raw - c.pad < N.DMG_MIN_ON_HIT) !== (c.floor === N.DMG_MIN_ON_HIT)) return `${c.raw} − ${c.pad} Padding, with the floor marked ${c.floor}`;
          } else continue;
          if (e.amount !== net && !adjusted(pre, post, e.who, c)) return `${e.who} took ${e.amount}, not ${net}, with nothing to adjust it`;
        }
        return null;
      },
    },
    {
      // A special strikes each actor on its tiles once (§8.1), and its special event lists
      // exactly those it struck, in order.
      id: 'combat_special_once',
      check(pre, events) {
        const struck = {};
        for (const e of events) {
          if (e.k === 'damaged' && e.cause && e.cause.k === 'special') {
            const key = `${e.cause.by}@${e.tick}`;
            const list = struck[key] || (struck[key] = []);
            if (list.includes(e.who)) return `${e.cause.by}'s ${e.cause.sp} struck ${e.who} twice`;
            list.push(e.who);
          }
          if (e.k === 'special' && !e.cancelled && Array.isArray(e.hits)) {
            const got = struck[`${e.who}@${e.tick}`] || [];
            if (JSON.stringify(got) !== JSON.stringify(e.hits)) return `${e.who}'s ${e.sp} lists ${JSON.stringify(e.hits)} but struck ${JSON.stringify(got)}`;
          }
        }
        return null;
      },
    },
    {
      // Criterion 3 (§11 M3): what a special deals you is the number its mark showed on your
      // tile the moment before the step (Specials.marks, which the view model draws).
      id: 'combat_special_shown',
      check(pre, events) {
        let marks = null;
        for (const e of events) {
          if (e.k !== 'damaged' || e.who !== 'you' || !e.cause || e.cause.k !== 'special') continue;
          marks = marks || Specials.marks(pre);
          const c = e.cause, m = marks.find(k => k.kind === 'telegraph' && k.by === c.by && k.x === c.x && k.y === c.y);
          if (!m) return `${c.by}'s ${c.sp} struck you at ${c.x},${c.y}, which no mark showed`;
          if (m.dmg !== e.amount) return `${c.by}'s ${c.sp} showed ${m.dmg} at ${c.x},${c.y} and dealt ${e.amount}`;
        }
        return null;
      },
    },
    {
      // Nothing strikes into or out of an intact case (§8.3): no blow or shot is made by or at
      // an actor in one, and only a beam's special strikes one. A case only ever stops being
      // intact, so an actor in one after the step was in it throughout.
      id: 'combat_glass',
      check(pre, events, post) {
        const inCase = uid => { const a = byUid(post, uid); return !!a && Cases.encased(post, a); };
        for (const e of events) {
          if (e.k === 'attacked' && (inCase(e.by) || inCase(e.at))) return `${e.by} attacked ${e.at} with glass between`;
          if (e.k === 'damaged' && e.cause && e.cause.k === 'special' && inCase(e.who)) {
            const S = Registry.SPECIALS[e.cause.sp];
            if (!S || S.shape !== 'line') return `${e.cause.by}'s ${e.cause.sp} struck ${e.who} inside its case`;
          }
        }
        return null;
      },
    },
    {
      // The order inside one blow (§8.1, §8.2): attacked, then its hit or miss, and last its
      // soft noise from the attacker, after every other wake effect of the blow. (A shot's
      // flight, and what a reflector sends back, are the shooter's rules, Ranged.shoot; only
      // melee and Reach blows are checked here.)
      id: 'combat_blow_order',
      check(pre, events) {
        for (let i = 0; i < events.length; i++) {
          const e = events[i];
          if (e.k !== 'attacked' || !e.how || (e.how.kind !== 'melee' && e.how.kind !== 'reach')) continue;
          let result = -1, noise = -1;
          for (let j = i + 1; j < events.length; j++) {
            const f = events[j];
            if (result < 0 && (f.k === 'missed' || f.k === 'damaged') && f.cause && f.cause.by === e.by && (f.at === e.at || f.who === e.at)) result = j;
            if (f.k === 'noise' && f.cause && f.cause.k === 'attack' && f.cause.by === e.by) { noise = j; break; }
          }
          if (result < 0) return `${e.by}'s blow at ${e.at} neither hit nor missed`;
          if (noise < 0 || noise < result) return `${e.by}'s blow at ${e.at} made no soft noise after it landed`;
          if (events[noise].cls !== 'soft') return `${e.by}'s blow made a ${events[noise].cls} noise`;
        }
        return null;
      },
    },
    {
      // Health (§8.1): you never have more than your maximum; the regeneration store is a whole
      // number of units, never below 0; each regeneration is 1 health, below your maximum,
      // when the store reached twice your interval; and you sit only on a bench.
      id: 'combat_health',
      check(pre, events, post) {
        const you = post.actors[0], before = pre.actors[0];
        if (you.hp > you.maxHp && before.hp <= before.maxHp) return `you have ${you.hp} health, past your maximum ${you.maxHp}`;
        if (!isInt(you.regen) || you.regen < 0) return `the regeneration store is ${you.regen}`;
        if (you.seated && Grid.ch(post.dept, you.x, you.y) !== 'b') return `you are seated at ${you.x},${you.y}, which is not a bench`;
        let last = null;
        for (const e of events) {
          if (e.k !== 'regenerated') continue;
          if (last === e.turn) return `you regenerated twice on turn ${e.turn}`;
          last = e.turn;
          const c = e.cause;
          if (c.need !== 2 * Health.interval(you.maxHp) || c.units < c.need) return `you regenerated with ${c.units} of ${c.need} units at maximum health ${you.maxHp}`;
          if (e.hp > you.maxHp) return `you regenerated to ${e.hp}, past your maximum ${you.maxHp}`;
        }
        return null;
      },
    },
  ];
};
