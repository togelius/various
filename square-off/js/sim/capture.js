// SQUARE OFF — capture meters, contest, neutralise/flip, flip bonus, Setup flipping, regulars.
// Headless.
(function (SQ) {
  'use strict';
  const W = SQ.World;
  const UF = W.UF;
  const near = [];

  /** Capture rate per second for faction f with total weight w at landmark lm. */
  function captureRate(state, f, w, lm) {
    const C = SQ.data.capture;
    const fac = state.factions[f];
    const fd = SQ.data.factions[fac.key] || {};
    let r = C.base * Math.pow(Math.min(C.maxWeight, w), C.exp);
    r *= fd.captureMult || 1;
    if (fac.behind) r *= SQ.data.matchRules.comeback.captureMult;
    if (state.mods) r *= state.mods.captureMult;
    if (lm) {
      // Chess Table: enemies capture this landmark at x0.6
      for (const pad of lm.pads) {
        if (pad.setup < 0) continue;
        const s = state.setupById[pad.setup];
        if (s && s.kind === 'chessTable' && s.done && lm.owner >= 0 && lm.owner !== f) { r *= SQ.data.setups.chessTable.enemyCapture; break; }
      }
    }
    return r;
  }

  function flip(match, lm, f) {
    const state = match.state;
    const from = lm.prevOwner;
    lm.owner = f;
    lm.meter = 100;
    lm.capBy = f;
    lm.regT = 0;
    lm.heldSince = state.t;
    lm.lastFlip = state.t;
    let withSetups = [];
    for (const pad of lm.pads) {
      if (pad.setup < 0) continue;
      const s = state.setupById[pad.setup];
      if (s) { if (s.owner !== f) withSetups.push({ kind: s.kind, from: s.owner }); s.owner = f; }
    }
    const fac = state.factions[f];
    fac.stats.captures++;
    if (withSetups.length) fac.stats.setupsStolen += withSetups.filter((w) => w.from >= 0 && w.from !== f).length;
    match.addClout(f, SQ.data.capture.flipBonus, 'flip', lm.x, lm.z);
    // rally points of other factions at this landmark revert to home
    for (const other of state.factions) {
      if (other.idx !== f && other.rally === lm.id) other.rally = other.home;
    }
    const fd = SQ.data.factions[fac.key];
    const title = SQ.data.text.fill(lm.title || '{CREW} TAKE {LM}', { CREW: (fd ? fd.short : fac.key).toUpperCase(), LM: lm.name.toUpperCase() });
    match.emit('capture', { lm: lm.id, lmIdx: lm.idx, from: from, to: f, x: lm.x, z: lm.z, title, setups: withSetups });
  }

  function tick(match, dt) {
    const state = match.state, u = state.units;
    const C = SQ.data.capture;
    const nf = state.factions.length;
    for (let i = 0; i < u.n; i++) u.flags[i] &= ~UF.CAPTURING;
    for (const lm of state.landmarks) {
      if (lm.isHome) continue;
      const w = lm.weights;
      if (lm.locked) { for (let f = 0; f < nf; f++) w[f] = 0; lm.contested = false; lm.capturing = -1; continue; }
      for (let f = 0; f < nf; f++) w[f] = 0;
      W.query(state, lm.x, lm.z, lm.bound, near);
      for (let k = 0; k < near.length; k++) {
        const i = near[k];
        if (u.flags[i] & UF.OVERIT) continue;
        if (!W.inRing(lm, u.x[i], u.z[i])) continue;
        w[u.faction[i]] += SQ.data.unitTypes[u.type[i]].weight;
        u.flags[i] |= UF.CAPTURING;
      }
      let present = 0, solo = -1;
      for (let f = 0; f < nf; f++) if (w[f] > 0) { present++; solo = f; }
      const wasContested = lm.contested;
      lm.contested = present >= 2;
      lm.capturing = -1;
      if (lm.contested) {
        lm.attackedT = state.t;
        if (!wasContested || state.t - (lm.contestPing || -99) > C.contestedPing * 4) {
          lm.contestPing = state.t;
          const attackers = [];
          for (let f = 0; f < nf; f++) if (w[f] > 0 && f !== lm.owner) attackers.push(f);
          match.emit('contested', { lm: lm.id, lmIdx: lm.idx, faction: lm.owner, attackers, x: lm.x, z: lm.z });
        }
      } else if (present === 1) {
        const f = solo;
        const rate = captureRate(state, f, w[f], lm);
        if (lm.owner === f) {
          lm.meter = Math.min(100, lm.meter + C.regen * dt);
        } else if (lm.owner >= 0) {
          // drain an enemy landmark to neutral
          lm.capturing = f;
          lm.attackedT = state.t;
          if (!lm.draining || state.t - (lm.drainPing || -99) > C.contestedPing * 4) {
            lm.drainPing = state.t;
            match.emit('underAttack', { lm: lm.id, lmIdx: lm.idx, faction: lm.owner, by: f, x: lm.x, z: lm.z });
          }
          lm.draining = true;
          lm.meter -= rate * dt;
          if (lm.meter <= 0) {
            lm.meter = 0;
            lm.prevOwner = lm.owner;
            const from = lm.owner;
            lm.owner = -1;
            lm.capBy = f;
            lm.draining = false;
            state.factions[from].stats.lostLandmarks++;
            for (const other of state.factions) if (other.rally === lm.id) other.rally = other.home;
            match.emit('neutral', { lm: lm.id, lmIdx: lm.idx, from, by: f, x: lm.x, z: lm.z });
          }
        } else {
          lm.capturing = f;
          if (lm.capBy !== f && lm.meter > 0) {
            lm.meter -= rate * dt;
            if (lm.meter <= 0) { lm.meter = 0; lm.capBy = f; }
          } else {
            lm.capBy = f;
            lm.meter += rate * dt;
            if (lm.meter >= 100) flip(match, lm, f);
          }
        }
      } else {
        // empty ring: owned meters regenerate, neutral progress decays
        if (lm.owner >= 0) lm.meter = Math.min(100, lm.meter + C.regen * dt);
        else if (lm.meter > 0) { lm.meter = Math.max(0, lm.meter - C.regen * dt); if (lm.meter === 0) lm.capBy = -1; }
      }
      if (present !== 1 || lm.owner === solo) lm.draining = false;

      // held-time stats + regulars
      if (lm.owner >= 0) {
        const fac = state.factions[lm.owner];
        fac.stats.held[lm.id] = (fac.stats.held[lm.id] || 0) + dt;
        const streak = state.t - lm.heldSince;
        if (streak > fac.stats.longest.t) { fac.stats.longest.t = streak; fac.stats.longest.lm = lm.id; }
        lm.regT += dt;
        if (lm.regT >= C.regularsEvery) {
          lm.regT = 0;
          let count = 0;
          for (let i = 0; i < u.n; i++) {
            if (u.lm[i] === lm.idx && (u.flags[i] & UF.REGULAR) && u.faction[i] === lm.owner && !(u.flags[i] & UF.OVERIT)) count++;
          }
          if (count < C.regularsMax && fac.pop + 1 <= fac.popCap) spawnRegular(match, lm);
        }
      }
    }
  }

  function spawnRegular(match, lm) {
    const state = match.state, u = state.units;
    const f = lm.owner;
    const fac = state.factions[f];
    const slot = SQ.Movement.landmarkSlot(state, lm, (lm.slotNext = ((lm.slotNext || 0) + 1) % 48));
    // regulars walk in from the nearest edge of the ring
    const i = W.spawnUnit(state, f, fac.key + '.crowd', slot.x, slot.z, { squad: -1, regularOf: lm.idx });
    SQ.Movement.applyOrder(state, [i], { type: 'take', lm: lm.idx });
    u.order[i].arrived = false;
    fac.pop += 1;
    fac.stats.regulars++;
    match.emit('regular', { lm: lm.id, lmIdx: lm.idx, faction: f, id: u.id[i], x: u.x[i], z: u.z[i] });
  }

  SQ.Capture = { tick, captureRate, flip, spawnRegular };
})(window.SQ = window.SQ || {});
