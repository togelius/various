// SQUARE OFF — targeting, Sway, counters, splash, unit perks on hit, Over It, Grudge, regen.
// Headless.
(function (SQ) {
  'use strict';
  const W = SQ.World;
  const UF = W.UF, ANIM = W.ANIM, CLS = W.CLS;
  const near = [], near2 = [];

  function has(t, perk) { return t.perks && t.perks.indexOf(perk) >= 0; }

  /** Counter multiplier attacker type -> defender type (neutrals take x1.0). */
  function counterMult(ta, td) {
    if (td.neutral || ta.neutral) return 1;
    return SQ.data.counter[ta.cls][td.cls];
  }

  /** Effective Sway (damage/s) of unit i against unit j, including all multipliers. */
  function swayAgainst(state, i, j) {
    const u = state.units;
    const ta = SQ.data.unitTypes[u.type[i]], td = SQ.data.unitTypes[u.type[j]];
    let s = ta.sway * counterMult(ta, td) * u.swayM[i];
    if (has(ta, 'wellActually') && td.cls === 'talker') s *= 1 + SQ.data.combat.wellActually;
    const adv = Math.min(SQ.data.combat.advice.max, u.advice[i] * SQ.data.combat.advice.per);
    s *= 1 - adv;
    if (u.swayBuffT[i] > 0) s *= 1 + u.swayBuff[i];
    return s;
  }

  function validEnemy(state, i, j) {
    const u = state.units;
    return j >= 0 && j < u.n && u.faction[j] !== u.faction[i] && !(u.flags[j] & UF.OVERIT);
  }

  function acquire(state, i, t, range) {
    const u = state.units, nav = state.nav;
    const o = u.order[i];
    const hold = o && o.type === 'hold';
    const acq = hold ? range + 0.5 : range + SQ.data.combat.acquireExtra;
    W.query(state, u.x[i], u.z[i], acq, near);
    const beats = SQ.data.beats[t.cls];
    let best = -1, bestTier = 9, bestHp = Infinity, bestId = 0;
    const leash = SQ.data.combat.leash;
    const idle = !o || o.arrived;
    const melee = t.range < 3;
    for (let k = 0; k < near.length; k++) {
      const j = near[k];
      if (!validEnemy(state, i, j)) continue;
      if (idle && !hold) {
        const lx = u.x[j] - u.ax[i], lz = u.z[j] - u.az[i];
        if (lx * lx + lz * lz > leash * leash) continue;
      }
      if (melee && !nav.los(u.x[i], u.z[i], u.x[j], u.z[j])) continue;
      const tj = SQ.data.unitTypes[u.type[j]];
      const tier = tj.cls === beats ? 0 : 1;
      const hp = u.hp[j];
      if (tier < bestTier || (tier === bestTier && (hp < bestHp - 1e-9 || (Math.abs(hp - bestHp) <= 1e-9 && u.id[j] < bestId)))) {
        best = j; bestTier = tier; bestHp = hp; bestId = u.id[j];
      }
    }
    if (best < 0 && !hold && u.attacker[i] >= 0 && u.combatT[i] < 2) {
      // retaliate against whoever is hitting us from beyond acquire range (within sight)
      const j = W.unitIndex(state, u.attacker[i]);
      if (j >= 0 && validEnemy(state, i, j)) {
        const dx = u.x[j] - u.x[i], dz = u.z[j] - u.z[i];
        const sight = SQ.data.combat.sight;
        const lx = u.x[j] - u.ax[i], lz = u.z[j] - u.az[i];
        if (dx * dx + dz * dz <= sight * sight && (!idle || lx * lx + lz * lz <= (leash + 10) * (leash + 10)) &&
            (!melee || nav.los(u.x[i], u.z[i], u.x[j], u.z[j]))) best = j;
      }
    }
    return best;
  }

  /** Send unit i Over It. byFaction: faction index credited (-1 for none). */
  function overIt(match, i, byFaction, reason, byCls) {
    const state = match.state, u = state.units;
    if (u.flags[i] & UF.OVERIT) return;
    const t = SQ.data.unitTypes[u.type[i]];
    const f = u.faction[i];
    const fac = state.factions[f];
    u.flags[i] = (u.flags[i] | UF.OVERIT) & ~(UF.FROZEN | UF.COMBAT | UF.MOVING | UF.CAPTURING | UF.HOLD);
    u.hp[i] = 0;
    u.anim[i] = ANIM.OVERIT;
    u.target[i] = -1;
    u.order[i] = null;
    u.overT[i] = 0;
    u.frozenT[i] = 0;
    u.flinchT[i] = 0;
    const TX = SQ.data.text;
    const pool = (TX.exitLines[fac.key] || []).concat(match.rng() < 0.55 ? TX.exitLines.any : []);
    const line = pool.length ? pool[Math.floor(match.rng() * pool.length)] : TX.exitLines.any[0];
    // Grudge
    if (!t.neutral || fac.key !== 'squirrels') {
      const refund = t.unitCost * SQ.data.combat.grudge;
      if (!(u.flags[i] & UF.REGULAR) && !(u.flags[i] & UF.CREW)) match.addClout(f, refund, 'grudge', u.x[i], u.z[i]);
    }
    fac.stats.lost++;
    const rk = TX.exitReasons[Math.floor(match.rng() * TX.exitReasons.length)];
    fac.stats.reasons[rk] = (fac.stats.reasons[rk] || 0) + 1;
    fac.stats.lostByCls[t.cls]++;
    if (byCls) { const key = t.cls + '<' + byCls; fac.stats.lostPairs[key] = (fac.stats.lostPairs[key] || 0) + 1; }
    if (byFaction >= 0 && byFaction !== f) {
      const by = state.factions[byFaction];
      by.stats.sentHome++;
      by.crew = Math.min(SQ.data.crew.max, by.crew + SQ.data.crew.perOverIt);
    }
    // Side Bets: any Hustle faction (not the victim) with a unit within 20 m
    const sb = SQ.data.factions.hustle.passive;
    for (let fi = 0; fi < state.factions.length; fi++) {
      if (fi === f || state.factions[fi].key !== 'hustle') continue;
      W.query(state, u.x[i], u.z[i], sb.radius, near2);
      for (let k = 0; k < near2.length; k++) {
        const j = near2[k];
        if (u.faction[j] === fi && !(u.flags[j] & UF.OVERIT)) { match.addClout(fi, sb.clout, 'sideBets', u.x[i], u.z[i]); break; }
      }
    }
    match.emit('overIt', { unit: u.id[i], faction: f, line, x: u.x[i], z: u.z[i], cls: t.cls, type: t.key, by: byFaction, reason: reason || 'sway' });
    // Squad wipe: 3+ members of a squad went Over It within 20 s and none remain
    const sq = u.squad[i];
    if (sq >= 0) {
      const rec = fac.recentOver[sq] || (fac.recentOver[sq] = []);
      rec.push(state.t);
      while (rec.length && state.t - rec[0] > 20) rec.shift();
      if (rec.length >= 3) {
        let alive = 0;
        for (let k = 0; k < u.n; k++) if (u.faction[k] === f && u.squad[k] === sq && !(u.flags[k] & UF.OVERIT)) { alive++; break; }
        if (!alive) {
          const word = (SQ.data.text.wipeWords || {})[fac.key] || 'SCHOOLED!';
          match.emit('squadWiped', { faction: f, squad: sq, word, x: u.x[i], z: u.z[i], by: byFaction });
          rec.length = 0;
        }
      }
    }
  }

  function damage(match, j, amount, byFaction, reason, byCls) {
    const state = match.state, u = state.units;
    if (u.flags[j] & UF.OVERIT) return;
    u.hp[j] -= amount / u.defM[j];
    u.combatT[j] = 0;
    const tj = SQ.data.unitTypes[u.type[j]];
    if (u.hp[j] <= 0) overIt(match, j, byFaction, reason, byCls);
    else if (tj.fleeAt && u.hp[j] < u.maxHp[j] * tj.fleeAt) overIt(match, j, byFaction, 'fled', byCls);
  }

  function hit(match, i, j, t) {
    const state = match.state, u = state.units, C = SQ.data.combat;
    const tj = SQ.data.unitTypes[u.type[j]];
    const f = u.faction[i];
    const mult = counterMult(t, tj);
    const dmg = swayAgainst(state, i, j) * t.hitInterval;
    const counter = mult > 1.01;
    u.attacker[j] = u.id[i];
    u.hitT[i] = 0;
    u.combatT[i] = 0;
    u.facing[i] = Math.atan2(u.x[j] - u.x[i], u.z[j] - u.z[i]);
    const jx = u.x[j], jz = u.z[j];
    const jid = u.id[j];
    match.emit('hit', { from: u.id[i], to: jid, counter, weak: mult < 0.99, dmg, x: u.x[i], z: u.z[i], tx: jx, tz: jz, faction: f, cls: t.cls, glyph: t.glyph, type: t.key });
    state.factions[f].stats.swayDealt += dmg;
    // perks that act on the primary target (before damage so knock/pull happens even on a finishing blow)
    if (has(t, 'hitTheClock') && u.lastHitTarget[i] !== jid) {
      u.lastHitTarget[i] = jid;
      if (!has(tj, 'seenItAll')) { u.slowT[j] = Math.max(u.slowT[j], C.hitClock.time); u.slow[j] = Math.max(u.slowT[j] > 0 ? u.slow[j] : 0, C.hitClock.slow); }
    }
    if (has(t, 'leashSlow') && !has(tj, 'seenItAll')) { u.slowT[j] = Math.max(u.slowT[j], C.leashSlow.time); u.slow[j] = Math.max(u.slow[j], C.leashSlow.slow); }
    if (has(t, 'flinch') && match.rng() < C.flinch.chance) u.flinchT[j] = Math.max(u.flinchT[j], C.flinch.time);
    if (has(t, 'fetch') && tj.cls !== 'heavy') {
      u.hits[i]++;
      if (u.hits[i] % C.fetch.every === 0) SQ.Movement.knock(state, j, u.x[i] - jx, u.z[i] - jz, Math.min(C.fetch.pull, Math.max(0, Math.hypot(u.x[i] - jx, u.z[i] - jz) - 1)));
    }
    const scrum = has(t, 'scrum') && u.moved[i] >= C.scrum.run && u.scrumCD[i] <= 0;
    damage(match, j, dmg, f, 'sway', t.cls);
    // splash (heavies around the target; Sax around the target)
    const splash = t.splash || t.targetSplash;
    if (splash > 0) {
      W.query(state, jx, jz, splash, near2);
      for (let k = 0; k < near2.length; k++) {
        const m = near2[k];
        if (m === j || !validEnemy(state, i, m)) continue;
        const sd = swayAgainst(state, i, m) * t.hitInterval * (t.splash ? SQ.data.combat.splashFrac : SQ.data.combat.targetSplashFrac);
        damage(match, m, sd, f, 'splash', t.cls);
        if (has(t, 'leashSlow')) { const tm = SQ.data.unitTypes[u.type[m]]; if (!has(tm, 'seenItAll')) { u.slowT[m] = Math.max(u.slowT[m], C.leashSlow.time); u.slow[m] = Math.max(u.slow[m], C.leashSlow.slow); } }
      }
    }
    if (scrum) {
      u.scrumCD[i] = C.scrum.cooldown;
      W.query(state, u.x[i], u.z[i], (t.splash || 3) + 1, near2);
      const victims = near2.slice();
      for (const m of victims) {
        if (!validEnemy(state, i, m)) continue;
        SQ.Movement.knock(state, m, u.x[m] - u.x[i], u.z[m] - u.z[i], C.scrum.knock);
      }
      match.emit('knock', { faction: f, x: u.x[i], z: u.z[i], kind: 'scrum' });
    }
    u.moved[i] = 0;
  }

  function tick(match, dt) {
    const state = match.state, u = state.units, C = SQ.data.combat;
    const pauseAll = state.t < state.freezeUntil;
    const rain = state.weather && state.weather.rain;
    for (let i = 0; i < u.n; i++) {
      // timers
      u.hitT[i] += dt;
      u.combatT[i] += dt;
      if (u.slowT[i] > 0) { u.slowT[i] -= dt; if (u.slowT[i] <= 0) u.slow[i] = 0; }
      if (u.frozenT[i] > 0) { u.frozenT[i] -= dt; if (u.frozenT[i] <= 0) u.flags[i] &= ~UF.FROZEN; }
      if (u.flinchT[i] > 0) u.flinchT[i] -= dt;
      if (u.speedBuffT[i] > 0) u.speedBuffT[i] -= dt;
      if (u.swayBuffT[i] > 0) u.swayBuffT[i] -= dt;
      if (u.scrumCD[i] > 0) u.scrumCD[i] -= dt;
      if (u.stickyT[i] > 0) u.stickyT[i] -= dt;
      u.retargetT[i] -= dt;
      u.cd[i] -= dt;
      if (u.slowT[i] > 0) u.flags[i] |= UF.SLOWED; else u.flags[i] &= ~UF.SLOWED;
    }
    for (let i = 0; i < u.n; i++) {
      const flags = u.flags[i];
      if (flags & UF.OVERIT) continue;
      const t = SQ.data.unitTypes[u.type[i]];
      let range = t.range * u.rangeM[i];
      if (rain && t.cls === 'talker') range *= (SQ.data.events.shower.talkerRange || 0.7);
      const o = u.order[i];
      // target selection
      let tgt = u.target[i] >= 0 ? W.unitIndex(state, u.target[i]) : -1;
      if (tgt >= 0 && !validEnemy(state, i, tgt)) { tgt = -1; u.target[i] = -1; }
      if (o && o.type === 'attack') {
        const fj = W.unitIndex(state, o.targetId);
        if (fj >= 0 && validEnemy(state, i, fj)) { tgt = fj; u.target[i] = o.targetId; }
        else { u.order[i] = null; u.ax[i] = u.x[i]; u.az[i] = u.z[i]; tgt = -1; u.target[i] = -1; }
      } else if (o && o.type === 'move') {
        tgt = -1; u.target[i] = -1;
      } else if (u.retargetT[i] <= 0) {
        u.retargetT[i] = C.retargetEvery;
        const acq = (o && o.type === 'hold') ? range + 0.5 : range + C.acquireExtra;
        let keep = false;
        if (tgt >= 0 && u.stickyT[i] > 0) {
          const dx = u.x[tgt] - u.x[i], dz = u.z[tgt] - u.z[i];
          keep = dx * dx + dz * dz <= (acq * 1.25) * (acq * 1.25);
        }
        if (!keep) {
          const nb = acquire(state, i, t, range);
          if (nb !== tgt) { tgt = nb; u.target[i] = nb >= 0 ? u.id[nb] : -1; if (nb >= 0) u.stickyT[i] = C.stickyTime; }
        }
        // idle leash: drop targets that drag us too far from the anchor
        if (tgt >= 0 && (!o || o.arrived) && !(o && o.type === 'hold')) {
          const lx = u.x[i] - u.ax[i], lz = u.z[i] - u.az[i];
          if (lx * lx + lz * lz > (C.leash + 4) * (C.leash + 4)) { tgt = -1; u.target[i] = -1; }
        }
      }
      if (tgt >= 0) u.flags[i] |= UF.COMBAT; else if (u.combatT[i] > 1.5) u.flags[i] &= ~UF.COMBAT;
      // attack
      if (tgt >= 0 && !pauseAll && u.frozenT[i] <= 0 && u.flinchT[i] <= 0 && !(u.flags[i] & UF.TRUCE) && u.cd[i] <= 0) {
        const dx = u.x[tgt] - u.x[i], dz = u.z[tgt] - u.z[i];
        const reach = range + 0.6; // body radii
        if (dx * dx + dz * dz <= reach * reach && !(u.flags[tgt] & UF.TRUCE)) {
          u.cd[i] = t.hitInterval;
          hit(match, i, tgt, t);
        }
      }
    }
    // regen and healing
    for (let i = 0; i < u.n; i++) {
      if (u.flags[i] & UF.OVERIT) continue;
      let heal = u.healR[i];
      if (u.combatT[i] >= C.regenDelay) heal += C.regen;
      heal *= state.mods ? state.mods.regenMult : 1;
      if (heal > 0 && u.hp[i] < u.maxHp[i]) {
        u.hp[i] = Math.min(u.maxHp[i], u.hp[i] + heal * dt);
        u.flags[i] |= UF.HEALING;
      } else u.flags[i] &= ~UF.HEALING;
    }
  }

  SQ.Combat = { tick, overIt, damage, counterMult, swayAgainst, acquire };
})(window.SQ = window.SQ || {});
