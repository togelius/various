// SQUARE OFF — passives, auras, zones, landmark perks, the four Crew Calls, the Dosa cart.
// Headless. Runs before movement/combat each tick and fills per-unit multipliers:
// units.spdM / swayM / defM / rangeM / healR / advice and the TRUCE / SHELTER flags.
(function (SQ) {
  'use strict';
  const W = SQ.World;
  const UF = W.UF;
  const near = [];

  function prepass(match, dt) {
    const state = match.state, u = state.units, nav = state.nav;
    const n = u.n;
    const night = SQ.data.phases[state.phaseIdx].id === 'night';
    const rain = state.weather && state.weather.rain;
    const shower = SQ.data.events.shower;
    const C = SQ.data.combat;
    const sites = SQ.data.sites;
    for (let i = 0; i < n; i++) {
      u.spdM[i] = 1; u.swayM[i] = 1; u.defM[i] = 1; u.rangeM[i] = 1; u.healR[i] = 0; u.advice[i] = 0;
      u.flags[i] &= ~(UF.TRUCE | UF.SHELTER | UF.BUFFED);
    }
    // Kibitzer advice (Hustle crowd within 2 m of an enemy) and Tambourine aura (Noise crowd, allies within 6 m)
    for (let i = 0; i < n; i++) {
      if (u.flags[i] & UF.OVERIT) continue;
      const t = SQ.data.unitTypes[u.type[i]];
      if (!t.perks || !t.perks.length) continue;
      if (t.perks.indexOf('unsolicitedAdvice') >= 0) {
        W.query(state, u.x[i], u.z[i], C.advice.radius, near);
        for (let k = 0; k < near.length; k++) {
          const j = near[k];
          if (u.faction[j] !== u.faction[i] && !(u.flags[j] & UF.OVERIT) && u.advice[j] < 255) u.advice[j]++;
        }
      } else if (t.perks.indexOf('tambourine') >= 0) {
        W.query(state, u.x[i], u.z[i], C.tambourine.radius, near);
        for (let k = 0; k < near.length; k++) {
          const j = near[k];
          if (j !== i && u.faction[j] === u.faction[i]) u.spdM[j] = Math.max(u.spdM[j], 1 + C.tambourine.speed);
        }
      }
    }
    // Landmarks, setups, sites, zones
    const L = state.landmarks;
    const holleyOwners = [];
    for (const lm of L) if (lm.id === 'holley' && lm.owner >= 0) holleyOwners.push(lm.owner);
    const setups = state.setups;
    const zones = state.zones;
    for (let i = 0; i < n; i++) {
      if (u.flags[i] & UF.OVERIT) continue;
      const f = u.faction[i];
      const fk = state.factions[f].key;
      const t = SQ.data.unitTypes[u.type[i]];
      const x = u.x[i], z = u.z[i];
      let sway = 1, def = 1, heal = 0, spd = 1, range = 1;
      for (let h = 0; h < holleyOwners.length; h++) if (holleyOwners[h] === f) heal += 1;
      for (let k = 0; k < L.length; k++) {
        const lm = L[k];
        if (lm.isHome) continue;
        const dx = x - lm.x, dz = z - lm.z;
        const d2 = dx * dx + dz * dz;
        const pid = lm.perk && lm.perk.id;
        if (pid === 'grove') {
          if (night && lm.owner >= 0 && lm.owner !== f && d2 <= lm.perk.radius * lm.perk.radius) sway *= 1 + lm.perk.nightSway;
          continue;
        }
        if (lm.owner !== f) continue;
        if (d2 > (lm.bound * lm.bound)) continue;
        if (!W.inRing(lm, x, z)) continue;
        if (pid === 'arch') sway *= 1 + lm.perk.sway;
        else if (pid === 'garibaldi') def *= 1 + lm.perk.defend;
        else if (pid === 'playground' || pid === 'toddler') heal += lm.perk.regen;
        else if (pid === 'playhills' && t.cls === 'talker') range *= (t.range + lm.perk.range) / t.range;
      }
      // fountain basin: anyone wading regenerates
      if (nav.terrainAt(x, z) === SQ.nav.T.WATER) heal += SQ.data.landmarkById.fountain.perk.waterRegen;
      // setups (owned by the unit's faction)
      for (let k = 0; k < setups.length; k++) {
        const s = setups[k];
        if (!s.done || s.owner !== f) continue;
        const dx = x - s.x, dz = z - s.z;
        const d2 = dx * dx + dz * dz;
        const S = SQ.data.setups[s.kind];
        if (s.kind === 'cart' && d2 <= S.healRadius * S.healRadius) heal += S.heal;
        else if (s.kind === 'boombox' && d2 <= S.radius * S.radius) sway *= 1 + S.sway;
        else if (s.kind === 'bench' && t.cls === 'heavy' && d2 <= S.radius * S.radius) def *= 1 + S.heavyHp;
        else if (s.kind === 'waterBowl' && d2 <= S.radius * S.radius) { heal += S.heal; sway *= 1 + S.sway; }
      }
      // Park House: the only bathroom heals everyone near its north door
      {
        const ph = sites.parkHouse;
        const dx = x - ph.x, dz = z - ph.z;
        if (dx * dx + dz * dz <= ph.radius * ph.radius) heal += ph.heal;
      }
      // zones (events and Crew Calls)
      for (let k = 0; k < zones.length; k++) {
        const zn = zones[k];
        const dx = x - zn.x, dz = z - zn.z;
        if (dx * dx + dz * dz > zn.r * zn.r) continue;
        if (!W.zoneApplies(zn, f, fk)) continue;
        let m = 1;
        if (zn.animalScatter && (u.flags[i] & UF.ANIMAL)) m = 0.5; // Pack scatters pigeon clouds: half effect
        if (zn.speed) spd *= 1 + (zn.speed - 1) * m;
        if (zn.sway) sway *= 1 + (zn.sway - 1) * m;
        if (zn.regen) heal += zn.regen;
        if (zn.heal) heal += zn.heal;
        if (zn.range) range *= zn.range;
        if (zn.noAttack) u.flags[i] |= UF.TRUCE;
      }
      // rain shelter: under the Arch or near tree trunks
      if (rain) {
        const a = shower.archShelter;
        if ((x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1) || nav.sheltered(x, z)) { sway *= 1 + shower.shelterSway; u.flags[i] |= UF.SHELTER; }
      }
      if (sway > 1.001 || u.swayBuffT[i] > 0 || u.speedBuffT[i] > 0) u.flags[i] |= UF.BUFFED;
      u.swayM[i] = sway; u.defM[i] = def; u.healR[i] = heal; u.spdM[i] *= spd; u.rangeM[i] = range;
    }
  }

  // ---------------------------------------------------------- zone damage
  function zoneDamage(match, dt) {
    const state = match.state, u = state.units;
    for (const zn of state.zones) {
      if (!zn.dps) continue;
      W.query(state, zn.x, zn.z, zn.r, near);
      const victims = near.slice();
      for (const i of victims) {
        if (u.flags[i] & UF.OVERIT) continue;
        if (!W.zoneApplies(zn, u.faction[i], state.factions[u.faction[i]].key)) continue;
        if (zn.hitSet) zn.hitSet[u.id[i]] = 1;
        SQ.Combat.damage(match, i, zn.dps * dt * u.defM[i], zn.faction, zn.kind);
      }
    }
    // expire zones
    for (let k = state.zones.length - 1; k >= 0; k--) {
      if (state.zones[k].until <= state.t) {
        const zn = state.zones[k];
        state.zones.splice(k, 1);
        if (zn.hitSet) {
          const hits = Object.keys(zn.hitSet).length;
          const fac = state.factions[zn.faction];
          if (fac) fac.stats.crewHitsBest[zn.kind] = Math.max(fac.stats.crewHitsBest[zn.kind] || 0, hits);
          match.emit('crewEnd', { faction: zn.faction, kind: zn.kind, hits });
        }
      }
    }
  }

  // ---------------------------------------------------------- crew calls
  function canCrewCall(state, f) {
    const fac = state.factions[f];
    if (!fac || fac.eliminated) return { ok: false, reason: 'out' };
    const cc = SQ.data.factions[fac.key].crewCall;
    if (!cc || cc.target === 'none') return { ok: false, reason: 'none' };
    if (fac.crew < SQ.data.crew.max) return { ok: false, reason: 'charging' };
    return { ok: true, kind: cc.id, target: cc.target };
  }

  /** Fire faction f's Crew Call. p: {x, z, x2, z2, landmarkId}. */
  function crewCall(match, f, p) {
    const state = match.state, u = state.units;
    const chk = canCrewCall(state, f);
    if (!chk.ok) return chk;
    p = p || {};
    const fac = state.factions[f];
    const cc = SQ.data.factions[fac.key].crewCall;
    let x = +p.x, z = +p.z;
    let result = null;
    if (cc.id === 'tournament') {
      if (!isFinite(x) || !isFinite(z)) return { ok: false, reason: 'target' };
      W.query(state, x, z, cc.radius, near);
      const ids = [];
      for (const i of near.slice()) {
        if (u.faction[i] === f || (u.flags[i] & UF.OVERIT)) continue;
        u.frozenT[i] = Math.max(u.frozenT[i], cc.duration);
        u.flags[i] |= UF.FROZEN;
        u.target[i] = -1;
        ids.push(u.id[i]);
      }
      state.effects.push({ id: state.effectSeq++, kind: 'tournament', faction: f, x, z, r: cc.radius, t0: state.t, t1: state.t + cc.duration, ids });
      fac.stats.crewHitsBest.tournament = Math.max(fac.stats.crewHitsBest.tournament || 0, ids.length);
      result = { ok: true, hits: ids.length };
    } else if (cc.id === 'drumCircle') {
      if (!isFinite(x) || !isFinite(z)) return { ok: false, reason: 'target' };
      const t1 = state.t + cc.duration;
      const hitSet = {};
      W.addZone(state, { kind: 'drumCircle', x, z, r: cc.radius, until: t1, faction: f, who: 'allies', heal: cc.heal });
      W.addZone(state, { kind: 'drumCircle', x, z, r: cc.radius, until: t1, faction: f, who: 'enemies', dps: cc.dps, speed: cc.slow, hitSet });
      state.effects.push({ id: state.effectSeq++, kind: 'drumCircle', faction: f, x, z, r: cc.radius, t0: state.t, t1 });
      result = { ok: true };
    } else if (cc.id === 'groupChat') {
      let lm = p.landmarkId !== undefined ? state.lmById[p.landmarkId] || state.landmarks[p.landmarkId] : null;
      if (!lm && isFinite(x)) {
        let best = null, bd = Infinity;
        for (const l of state.landmarks) {
          const owned = l.isHome ? l.id === fac.home : l.owner === f;
          if (!owned) continue;
          const d = Math.hypot(l.x - x, l.z - z);
          if (d < bd) { bd = d; best = l; }
        }
        if (best && bd <= best.r + 25) lm = best;
      }
      if (!lm) return { ok: false, reason: 'target' };
      const owned = lm.isHome ? lm.id === fac.home : lm.owner === f;
      if (!owned) return { ok: false, reason: 'notOwned' };
      x = lm.x; z = lm.z;
      const idxs = [];
      const ids = [];
      for (let k = 0; k < cc.count; k++) {
        const slot = SQ.Movement.landmarkSlot(state, lm, (lm.slotNext = ((lm.slotNext || 0) + 1) % 48));
        const i = W.spawnUnit(state, f, fac.key + '.crowd', slot.x, slot.z, { squad: 0, crew: true });
        idxs.push(i); ids.push(u.id[i]);
      }
      SQ.Movement.applyOrder(state, idxs, { type: 'take', lm: lm.idx });
      state.effects.push({ id: state.effectSeq++, kind: 'groupChat', faction: f, x, z, r: lm.r, t0: state.t, t1: state.t + 3, ids, lm: lm.id });
      fac.stats.recruited += ids.length;
      result = { ok: true, ids };
    } else if (cc.id === 'zoomies') {
      if (!isFinite(x) || !isFinite(z)) return { ok: false, reason: 'target' };
      let x2 = +p.x2, z2 = +p.z2;
      if (!isFinite(x2) || !isFinite(z2)) { x2 = x + 1; z2 = z; }
      let dx = x2 - x, dz = z2 - z;
      let L = Math.hypot(dx, dz);
      if (L < 4) { // a tap: run 30 m away from the nearest own unit through the point
        dx = dx || 1; dz = dz || 0; const l0 = Math.hypot(dx, dz); dx /= l0; dz /= l0;
        x -= dx * 15; z -= dz * 15; x2 = x + dx * 30; z2 = z + dz * 30; L = 30;
      } else if (L > cc.maxLen) { x2 = x + dx / L * cc.maxLen; z2 = z + dz / L * cc.maxLen; L = cc.maxLen; }
      const dur = L / cc.dogSpeed;
      const eff = { id: state.effectSeq++, kind: 'zoomies', faction: f, x, z, x2, z2, r: cc.hitRadius, t0: state.t, t1: state.t + dur + 0.6,
        dogs: [], hit: {}, len: L, dur };
      for (let k = 0; k < cc.dogs; k++) {
        const lane = (k - (cc.dogs - 1) / 2) * 0.9;
        eff.dogs.push({ lane, delay: (k % 3) * 0.08 + Math.floor(k / 3) * 0.05, x, z });
      }
      state.effects.push(eff);
      // speed buff for own units near the line
      for (let i = 0; i < u.n; i++) {
        if (u.faction[i] !== f || (u.flags[i] & UF.OVERIT)) continue;
        if (SQ.util.segDist2(u.x[i], u.z[i], x, z, x2, z2) <= cc.buffRadius * cc.buffRadius) {
          u.speedBuffT[i] = cc.buffTime; u.speedBuff[i] = cc.buffSpeed;
        }
      }
      result = { ok: true };
    }
    if (!result || !result.ok) return result || { ok: false, reason: 'kind' };
    fac.crew = 0;
    fac.stats.crewCalls++;
    match.emit('crewCall', { faction: f, kind: cc.id, x, z, x2: p.x2, z2: p.z2, r: cc.radius || cc.hitRadius || 0, lm: p.landmarkId });
    return result;
  }

  function effectsTick(match, dt) {
    const state = match.state, u = state.units;
    for (let k = state.effects.length - 1; k >= 0; k--) {
      const e = state.effects[k];
      if (e.kind === 'zoomies') {
        const cc = SQ.data.factions.pack.crewCall;
        const dx = (e.x2 - e.x) / e.len, dz = (e.z2 - e.z) / e.len;
        const px = -dz, pz = dx;
        let hits = 0;
        for (const dog of e.dogs) {
          const s = Math.max(0, Math.min(e.len, (state.t - e.t0 - dog.delay) * cc.dogSpeed));
          dog.x = e.x + dx * s + px * dog.lane;
          dog.z = e.z + dz * s + pz * dog.lane;
          dog.s = s / e.len;
          if (s <= 0 || s >= e.len) continue;
          W.query(state, dog.x, dog.z, cc.hitRadius, near);
          for (const i of near.slice()) {
            if (u.faction[i] === e.faction || (u.flags[i] & UF.OVERIT) || e.hit[u.id[i]]) continue;
            e.hit[u.id[i]] = 1;
            hits++;
            // knock sideways off the line (and a little forward)
            const side = (u.x[i] - dog.x) * px + (u.z[i] - dog.z) * pz >= 0 ? 1 : -1;
            SQ.Movement.knock(state, i, px * side + dx * 0.5, pz * side + dz * 0.5, cc.knock);
            match.emit('hit', { from: -1, to: u.id[i], counter: true, dmg: cc.damage, x: dog.x, z: dog.z, tx: u.x[i], tz: u.z[i], faction: e.faction, cls: 'crowd', glyph: 'woof', kind: 'zoomies' });
            SQ.Combat.damage(match, i, cc.damage * u.defM[i], e.faction, 'zoomies');
          }
        }
        if (hits) {
          const fac = state.factions[e.faction];
          const total = Object.keys(e.hit).length;
          fac.stats.crewHitsBest.zoomies = Math.max(fac.stats.crewHitsBest.zoomies || 0, total);
          state.hitStop = 2; // render: 2-frame hit-stop
        }
      }
      if (e.t1 <= state.t) state.effects.splice(k, 1);
    }
  }

  // ---------------------------------------------------------- dosa cart
  function buyDosa(match, f) {
    const state = match.state, u = state.units;
    const fac = state.factions[f];
    const D = SQ.data.sites.dosa;
    if (!fac || fac.eliminated) return { ok: false, reason: 'out' };
    if (fac.dosaCD > 0) return { ok: false, reason: 'cooldown' };
    if (fac.clout < D.cost) return { ok: false, reason: 'clout' };
    W.query(state, D.x, D.z, D.radius, near);
    const mine = near.filter((i) => u.faction[i] === f && !(u.flags[i] & UF.OVERIT));
    if (!mine.length) return { ok: false, reason: 'noUnits' };
    fac.clout -= D.cost;
    fac.stats.spent += D.cost;
    fac.dosaCD = D.cooldown;
    for (const i of mine) { u.swayBuffT[i] = D.time; u.swayBuff[i] = D.sway; }
    fac.stats.dosas++;
    match.emit('dosa', { faction: f, x: D.x, z: D.z, n: mine.length });
    return { ok: true, n: mine.length };
  }

  /** Shoo a squirrel neutral (state.neutrals entry with kind 'squirrel'). */
  function shoo(match, f, neutralId) {
    const state = match.state;
    const fac = state.factions[f];
    if (!fac) return { ok: false, reason: 'faction' };
    const nt = state.neutrals.find((q) => q.id === neutralId);
    if (!nt || nt.dead || nt.shooed) return { ok: false, reason: 'gone' };
    if (nt.kind !== 'squirrel') return { ok: false, reason: 'notSquirrel' };
    nt.shooed = true;
    nt.fleeT = state.t;
    nt.dead = true;
    const amt = (SQ.data.events.squirrelHeist && SQ.data.events.squirrelHeist.shoo) || 5;
    match.addClout(f, amt, 'shoo', nt.x, nt.z);
    fac.stats.shooed++;
    match.emit('shoo', { faction: f, id: neutralId, x: nt.x, z: nt.z, amount: amt });
    return { ok: true };
  }

  SQ.Abilities = { prepass, zoneDamage, effectsTick, canCrewCall, crewCall, buyDosa, shoo };
})(window.SQ = window.SQ || {});
