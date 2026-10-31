// SQUARE OFF — Clout, pop, recruit queues, Rally point, Setups and build pads, Turf, phases, comeback.
// Headless.
(function (SQ) {
  'use strict';
  const W = SQ.World;
  const UF = W.UF;
  const near = [];

  function phaseAt(clock) {
    const P = SQ.data.phases;
    for (let k = P.length - 1; k >= 0; k--) if (clock >= P[k].start) return k;
    return 0;
  }

  function lmPhaseMult(lm, phaseId, key) {
    const p = lm.phase && lm.phase[phaseId];
    return p && p[key] !== undefined ? p[key] : null;
  }

  /** Current Clout/s and Turf/s of a landmark for its owner (phase-adjusted, before setups). */
  function landmarkRates(state, lm, phaseId) {
    if (lm.isHome) return { clout: 0, turf: 0 };
    const cm = lmPhaseMult(lm, phaseId, 'clout');
    const tv = lmPhaseMult(lm, phaseId, 'turf');
    return { clout: lm.clout * (cm === null ? 1 : cm) + (lm.bonusClout || 0), turf: tv === null ? lm.turf : tv };
  }

  function held(state, f) {
    let n = 0;
    for (const lm of state.landmarks) if (!lm.isHome && lm.owner === f) n++;
    return n;
  }
  function holds(state, f, id) {
    const lm = state.lmById[id];
    return !!lm && lm.owner === f;
  }

  function setupAt(state, lm, kind) {
    for (const pad of lm.pads) {
      if (pad.setup < 0) continue;
      const s = state.setupById[pad.setup];
      if (s && s.done && s.kind === kind) return s;
    }
    return null;
  }

  /** Recruit cost for faction f and class cls, with all discounts. */
  function recruitCost(state, f, cls) {
    const fac = state.factions[f];
    const t = SQ.data.units[fac.key][cls];
    let c = t.cost;
    const L = SQ.data.landmarkById;
    if (cls === 'talker' && holds(state, f, 'chess')) c *= 1 - L.chess.perk.talkerDiscount;
    if (cls === 'crowd' && holds(state, f, 'bigrun')) c *= 1 - L.bigrun.perk.crowdDiscount;
    if (cls === 'crowd') {
      const rl = state.lmById[fac.rally];
      if (rl && !rl.isHome && rl.owner === f && setupAt(state, rl, 'clubFair')) c *= 1 - SQ.data.setups.clubFair.crowdDiscount;
    }
    if (fac.behind) c *= SQ.data.matchRules.comeback.costMult;
    if (state.mods) c *= state.mods.costMult;
    return Math.round(c);
  }

  function recruitTime(state, f, cls) {
    const fac = state.factions[f];
    let t = SQ.data.units[fac.key][cls].recruitTime;
    if (holds(state, f, 'bobst')) t *= 1 - SQ.data.landmarkById.bobst.perk.recruitTime;
    return t;
  }

  function queuedPop(fac) {
    let p = 0;
    for (const q of fac.queue) p += q.pop;
    return p;
  }

  /** Can faction f recruit cls now? -> { ok, reason, cost } */
  function canRecruit(state, f, cls) {
    const fac = state.factions[f];
    if (!fac || fac.eliminated) return { ok: false, reason: 'out' };
    const t = SQ.data.units[fac.key] && SQ.data.units[fac.key][cls];
    if (!t) return { ok: false, reason: 'class' };
    const cost = recruitCost(state, f, cls);
    if (fac.queue.length >= SQ.data.matchRules.queueMax) return { ok: false, reason: 'queue', cost };
    const pop = t.pop * t.perRecruit;
    if (fac.pop + queuedPop(fac) + pop > fac.popCap) return { ok: false, reason: 'pop', cost };
    if (fac.clout < cost) return { ok: false, reason: 'clout', cost };
    return { ok: true, cost };
  }

  function recruit(match, f, cls) {
    const state = match.state;
    const chk = canRecruit(state, f, cls);
    if (!chk.ok) return chk;
    const fac = state.factions[f];
    const t = SQ.data.units[fac.key][cls];
    fac.clout -= chk.cost;
    fac.stats.spent += chk.cost;
    const time = recruitTime(state, f, cls);
    fac.queue.push({ cls, t: time, total: time, pop: t.pop * t.perRecruit, cost: chk.cost });
    match.emit('queued', { faction: f, cls, cost: chk.cost, queue: fac.queue.length });
    return { ok: true, cost: chk.cost };
  }

  /** May faction f rally at landmark id? */
  function canRally(state, f, id) {
    const fac = state.factions[f];
    const lm = state.lmById[id];
    if (!lm) return false;
    if (lm.isHome) return lm.id === fac.home;
    if (lm.owner !== f) return false;
    if (fac.key === 'violets') return true;
    if (setupAt(state, lm, 'clubFair')) return true;
    const home = state.lmById[fac.home];
    return Math.hypot(lm.x - home.x, lm.z - home.z) <= SQ.data.matchRules.rallyRange;
  }

  /** Setups faction f may build at landmark (owned or own home). -> [{id, cost, ok, reason}] */
  function buildOptions(state, f, lmId) {
    const lm = state.lmById[lmId];
    const fac = state.factions[f];
    const out = [];
    if (!lm || !fac) return out;
    const owned = lm.isHome ? lm.id === fac.home : lm.owner === f;
    const special = SQ.data.factions[fac.key] && SQ.data.factions[fac.key].special;
    const hasSpecial = lm.pads.some((p) => p.setup >= 0 && state.setupById[p.setup] && SQ.data.setups[state.setupById[p.setup].kind].special);
    const freePad = lm.pads.findIndex((p) => p.setup < 0);
    for (const id of ['cart', 'boombox', 'bench', special]) {
      if (!id) continue;
      const S = SQ.data.setups[id];
      let reason = null;
      if (!owned) reason = 'notOwned';
      else if (freePad < 0) reason = 'noPad';
      else if (S.special && hasSpecial) reason = 'oneSpecial';
      else if (S.special && lm.isHome) reason = 'notHome';
      else if (fac.clout < S.cost) reason = 'clout';
      out.push({ id, name: S.name, cost: S.cost, ok: !reason, reason, text: S.text });
    }
    return out;
  }

  function build(match, f, lmId, padIdx, setupId) {
    const state = match.state;
    const lm = state.lmById[lmId];
    if (!lm) return { ok: false, reason: 'landmark' };
    const fac = state.factions[f];
    const S = SQ.data.setups[setupId];
    if (!S) return { ok: false, reason: 'setup' };
    if (S.faction && S.faction !== fac.key) return { ok: false, reason: 'faction' };
    if (padIdx === undefined || padIdx === null || padIdx < 0) padIdx = lm.pads.findIndex((p) => p.setup < 0);
    const pad = lm.pads[padIdx];
    if (!pad) return { ok: false, reason: 'pad' };
    const opts = buildOptions(state, f, lm.id);
    const opt = opts.find((o) => o.id === setupId);
    if (!opt) return { ok: false, reason: 'setup' };
    if (pad.setup >= 0) return { ok: false, reason: 'padTaken' };
    if (!opt.ok) return { ok: false, reason: opt.reason };
    fac.clout -= S.cost;
    fac.stats.spent += S.cost;
    const s = { id: state.setupSeq++, kind: setupId, name: S.name, lm: lm.idx, lmId: lm.id, pad: padIdx, owner: f, builtBy: f,
      x: pad.x, z: pad.z, buildLeft: S.buildTime, buildTime: S.buildTime, done: false };
    state.setups.push(s);
    state.setupById[s.id] = s;
    pad.setup = s.id;
    match.emit('buildStart', { lm: lm.id, lmIdx: lm.idx, pad: padIdx, setup: setupId, faction: f, x: s.x, z: s.z });
    return { ok: true, setup: s.id };
  }

  function spawnRecruit(match, f, cls) {
    const state = match.state, u = state.units;
    const fac = state.factions[f];
    let rl = state.lmById[fac.rally];
    if (!rl || !canRally(state, f, rl.id)) { fac.rally = fac.home; rl = state.lmById[fac.home]; }
    const t = SQ.data.units[fac.key][cls];
    const ids = [];
    for (let k = 0; k < t.perRecruit; k++) {
      const slot = SQ.Movement.landmarkSlot(state, rl, (rl.slotNext = ((rl.slotNext || 0) + 1) % 48));
      const i = W.spawnUnit(state, f, t.key, slot.x, slot.z, { squad: 0 });
      ids.push(u.id[i]);
      fac.pop += t.pop;
    }
    fac.stats.recruited += t.perRecruit;
    fac.stats.recruitedCls[cls] += t.perRecruit;
    match.emit('recruited', { faction: f, cls, ids, x: rl.x, z: rl.z, lm: rl.id });
    return ids;
  }

  function tick(match, dt) {
    const state = match.state, u = state.units;
    const R = SQ.data.matchRules;
    const phaseId = SQ.data.phases[state.phaseIdx].id;
    const nf = state.factions.length;
    // landmark rates for this phase
    for (const lm of state.landmarks) {
      const r = landmarkRates(state, lm, phaseId);
      lm.cloutRate = r.clout; lm.turfRate = r.turf;
    }
    // pop + Pass the Hat counts + tip jars
    const pop = new Array(nf).fill(0);
    const hat = new Array(nf).fill(0);
    for (let i = 0; i < u.n; i++) {
      if (u.flags[i] & UF.OVERIT) continue;
      const t = SQ.data.unitTypes[u.type[i]];
      const f = u.faction[i];
      pop[f] += t.pop;
      if (state.factions[f].key === 'noise' && (u.flags[i] & UF.CAPTURING)) {
        // inside one of OUR landmark rings?
        for (const lm of state.landmarks) {
          if (lm.isHome || lm.owner !== f) continue;
          if (W.inRing(lm, u.x[i], u.z[i])) { hat[f]++; break; }
        }
      }
    }
    // turf leader for comeback
    let leaderTurf = 0;
    for (const fac of state.factions) if (!fac.eliminated && fac.turf > leaderTurf) leaderTurf = fac.turf;

    for (let f = 0; f < nf; f++) {
      const fac = state.factions[f];
      if (fac.eliminated) continue;
      fac.pop = pop[f];
      const n = held(state, f);
      fac.held = n;
      let cap = R.popBase + R.popPerLandmark * n;
      let income = 0, turf = 0;
      if (!fac.noHome) income += R.homeClout;
      for (const lm of state.landmarks) {
        if (lm.owner !== f && !(lm.isHome && lm.id === fac.home)) continue;
        if (!lm.isHome) { income += lm.cloutRate; turf += lm.turfRate; if (lm.perk && lm.perk.pop) cap += lm.perk.pop; }
        for (const pad of lm.pads) {
          if (pad.setup < 0) continue;
          const s = state.setupById[pad.setup];
          if (!s || !s.done) continue;
          const S = SQ.data.setups[s.kind];
          if (S.clout) income += S.clout;
          if (S.pop) cap += S.pop;
          if (s.kind === 'tipJar') {
            W.query(state, s.x, s.z, S.radius, near);
            let cnt = 0;
            for (let k = 0; k < near.length; k++) if (!(u.flags[near[k]] & UF.OVERIT)) cnt++;
            income += Math.min(S.cap, cnt * S.perUnit);
          }
        }
      }
      if (fac.key === 'noise') { const P = SQ.data.factions.noise.passive; income += Math.min(P.cap, hat[f] * P.perUnit); }
      income *= fac.incomeMult * (state.mods ? state.mods.incomeMult : 1);
      fac.popCap = Math.min(R.popMax, cap);
      fac.income = income;
      fac.turfRate = state.suddenDeath ? 0 : turf;
      fac.clout += income * dt;
      fac.stats.earned += income * dt;
      fac.turf += fac.turfRate * dt;
      // Crew Call meter
      const CR = SQ.data.crew;
      let crewRate = CR.base + CR.perLandmark * n;
      if (holds(state, f, 'judson')) crewRate *= 1 + SQ.data.landmarkById.judson.perk.crew;
      crewRate *= state.mods ? state.mods.crewMult : 1;
      fac.crewRate = crewRate;
      const wasReady = fac.crew >= CR.max;
      fac.crew = Math.min(CR.max, fac.crew + crewRate * dt);
      if (!wasReady && fac.crew >= CR.max) match.emit('crewReady', { faction: f });
      if (fac.crewCooldown > 0) fac.crewCooldown -= dt;
      if (fac.dosaCD > 0) fac.dosaCD -= dt;
      // comeback
      const behind = leaderTurf - fac.turf >= R.comeback.behind;
      if (behind !== fac.behind) { fac.behind = behind; match.emit('comeback', { faction: f, on: behind }); }
      // recruit queue
      if (fac.queue.length) {
        const q = fac.queue[0];
        q.t -= dt;
        if (q.t <= 0) { fac.queue.shift(); spawnRecruit(match, f, q.cls); }
      }
      // rally sanity
      if (!canRally(state, f, fac.rally)) fac.rally = fac.home;
    }
    // construction
    for (const s of state.setups) {
      if (s.done) continue;
      s.buildLeft -= dt;
      if (s.buildLeft <= 0) {
        s.buildLeft = 0; s.done = true;
        state.factions[s.owner].stats.built++;
        match.emit('built', { lm: s.lmId, lmIdx: s.lm, pad: s.pad, setup: s.kind, faction: s.owner, x: s.x, z: s.z, id: s.id });
      }
    }
  }

  SQ.Economy = { tick, phaseAt, landmarkRates, recruitCost, recruitTime, canRecruit, recruit, canRally, buildOptions, build, spawnRecruit, held, holds, setupAt };
})(window.SQ = window.SQ || {});
