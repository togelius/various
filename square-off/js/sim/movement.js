// SQUARE OFF — orders, steering, flow-field following, separation, terrain speed, knockback.
// Headless.
(function (SQ) {
  'use strict';
  const W = SQ.World;
  const UF = W.UF, ANIM = W.ANIM;
  const GOLDEN = 2.39996323;
  const tmpPt = { x: 0, z: 0 };
  const near = [];

  /** Deterministic arrival slot k inside a landmark ring (walkable, inside polygon, reachable). */
  function landmarkSlot(state, lm, k) {
    const nav = state.nav;
    const field = nav.flowTo('lm:' + lm.id);
    const maxR = lm.poly ? 7 : Math.min(lm.r * 0.75, 11);
    for (let tries = 0; tries < 60; tries++) {
      const kk = k + tries * 7;
      const rad = Math.min(maxR, 1.35 * Math.sqrt(kk + 0.5));
      const ang = kk * GOLDEN + lm.idx;
      const x = (field ? field.tx : lm.x) + Math.cos(ang) * rad;
      const z = (field ? field.tz : lm.z) + Math.sin(ang) * rad;
      if (!nav.walkable(x, z)) continue;
      if (!W.inRing(lm, x, z)) continue;
      if (field && !(nav.distance(field, x, z) < Infinity)) continue;
      return { x, z };
    }
    return field ? { x: field.tx, z: field.tz } : { x: lm.x, z: lm.z };
  }

  /** Sunflower formation offsets around a ground point, snapped to walkable cells. */
  function groundSlot(state, x, z, k, field) {
    const nav = state.nav;
    for (let tries = 0; tries < 40; tries++) {
      const kk = k + tries * 5;
      const rad = kk === 0 ? 0 : 1.3 * Math.sqrt(kk + 0.3);
      const ang = kk * GOLDEN;
      const px = x + Math.cos(ang) * rad, pz = z + Math.sin(ang) * rad;
      if (!nav.walkable(px, pz)) continue;
      if (field && !(nav.distance(field, px, pz) < Infinity)) continue;
      return { x: px, z: pz };
    }
    const p = nav.nearestWalkable(x, z, 20);
    return p ? { x: p.x, z: p.z } : { x, z };
  }

  /**
   * Give an order to a list of unit indices (already validated). order:
   *  { type: 'move'|'attackMove'|'take'|'attack'|'stop'|'hold', x, z, lm (idx), targetId, queue }
   */
  function applyOrder(state, idxs, order) {
    const u = state.units, nav = state.nav;
    if (order.queue) {
      for (const i of idxs) {
        const cur = u.order[i];
        if (cur && !cur.arrived && cur.type !== 'hold' && cur.type !== 'stop') {
          cur.queue = cur.queue || [];
          cur.queue.push(Object.assign({}, order, { queue: false, _group: idxs.length }));
        } else {
          applyOrder(state, [i], Object.assign({}, order, { queue: false }));
        }
      }
      return;
    }
    // Sort by class so heavies take the first (central/front) slots, talkers the outer ones.
    const sorted = idxs.slice().sort((a, b) => {
      const ca = u.cls[a] === 2 ? 0 : u.cls[a] === 0 ? 1 : 2;
      const cb = u.cls[b] === 2 ? 0 : u.cls[b] === 0 ? 1 : 2;
      return ca - cb || u.id[a] - u.id[b];
    });
    let field = null, lm = null;
    if (order.type === 'take') {
      lm = state.landmarks[order.lm];
      field = nav.flowTo('lm:' + lm.id);
    } else if (order.type === 'move' || order.type === 'attackMove') {
      field = nav.fieldTo(order.x, order.z);
    }
    for (let k = 0; k < sorted.length; k++) {
      const i = sorted[k];
      const o = { type: order.type, x: order.x, z: order.z, lm: order.lm === undefined ? -1 : order.lm, targetId: order.targetId === undefined ? -1 : order.targetId,
        field: field, arrived: false, queue: [], t0: state.t };
      u.flags[i] &= ~UF.HOLD;
      if (order.type === 'stop') {
        u.order[i] = null;
        u.ax[i] = u.gx[i] = u.x[i]; u.az[i] = u.gz[i] = u.z[i];
        u.target[i] = -1;
        continue;
      }
      if (order.type === 'hold') {
        u.order[i] = o; o.arrived = true;
        u.flags[i] |= UF.HOLD;
        u.ax[i] = u.gx[i] = u.x[i]; u.az[i] = u.gz[i] = u.z[i];
        continue;
      }
      if (order.type === 'take') {
        const slot = landmarkSlot(state, lm, (lm.slotNext = ((lm.slotNext || 0) + 1) % 48));
        o.x = slot.x; o.z = slot.z;
      } else if (order.type === 'move' || order.type === 'attackMove') {
        const slot = groundSlot(state, order.x, order.z, k, field);
        o.x = slot.x; o.z = slot.z;
      } else if (order.type === 'attack') {
        u.target[i] = order.targetId;
        u.stickyT[i] = 2;
      }
      u.gx[i] = o.x; u.gz[i] = o.z;
      u.stuckT[i] = 0; u.bestD[i] = Infinity;
      if (order.type !== 'attack' && order.type !== 'attackMove') u.target[i] = order.type === 'move' ? -1 : u.target[i];
      u.order[i] = o;
    }
  }

  function arrive(state, i) {
    const u = state.units;
    const o = u.order[i];
    if (!o) return;
    if (o.queue && o.queue.length) {
      const next = o.queue.shift();
      const rest = o.queue;
      applyOrder(state, [i], next);
      if (u.order[i]) u.order[i].queue = rest;
      return;
    }
    u.ax[i] = state.nav.walkable(u.gx[i], u.gz[i]) ? u.gx[i] : u.x[i];
    u.az[i] = state.nav.walkable(u.gx[i], u.gz[i]) ? u.gz[i] : u.z[i];
    if (o.type === 'take') { o.arrived = true; return; }
    u.order[i] = null;
  }

  /** Knock unit i along (dx,dz) by `dist` meters, stopping at walls. Respects "Seen It All". */
  function knock(state, i, dx, dz, dist) {
    const u = state.units;
    const t = SQ.data.unitTypes[u.type[i]];
    if (t.perks && t.perks.indexOf('seenItAll') >= 0) return false;
    if (u.flags[i] & UF.OVERIT) return false;
    const L = Math.sqrt(dx * dx + dz * dz);
    if (L < 1e-6) return false;
    dx /= L; dz /= L;
    const nav = state.nav;
    let moved = 0;
    for (let s = 0; s < dist; s += 0.25) {
      const nx = u.x[i] + dx * 0.25, nz = u.z[i] + dz * 0.25;
      if (!nav.walkable(nx, nz)) break;
      u.x[i] = nx; u.z[i] = nz; moved += 0.25;
    }
    return moved > 0;
  }

  function unitSpeed(state, i, t) {
    const u = state.units;
    let s = t.speed * u.spdM[i] * (state.mods ? state.mods.speedMult : 1);
    const fk = state.factions[u.faction[i]].key;
    const fd = SQ.data.factions[fk];
    s *= state.nav.speedAt(u.x[i], u.z[i], fd && fd.lawnPenalty === false);
    if (u.slowT[i] > 0 && !(t.perks && t.perks.indexOf('seenItAll') >= 0)) s *= 1 - u.slow[i];
    if (u.speedBuffT[i] > 0) s *= 1 + u.speedBuff[i];
    return s;
  }

  function tick(match, dt) {
    const state = match.state, u = state.units, nav = state.nav;
    const n = u.n;
    const pauseAll = state.t < state.freezeUntil;
    const exitField = nav.exitField;
    for (let i = 0; i < n; i++) { u.px[i] = u.x[i]; u.pz[i] = u.z[i]; }
    for (let i = 0; i < n; i++) {
      const t = SQ.data.unitTypes[u.type[i]];
      const flags = u.flags[i];
      let aimX = NaN, aimZ = NaN, speed = 0, stopDist = 0.15, field = null, goalX = NaN, goalZ = NaN;
      u.flags[i] &= ~UF.MOVING;

      if (flags & UF.OVERIT) {
        u.overT[i] += dt;
        speed = t.speed * SQ.data.combat.overItSpeed;
        let p = nav.step(exitField, u.x[i], u.z[i], 4, tmpPt);
        if (p && !nav.los(u.x[i], u.z[i], p.x, p.z)) p = nav.step(exitField, u.x[i], u.z[i], 1, tmpPt);
        const dExit = nav.distance(exitField, u.x[i], u.z[i]);
        if (p && dExit > 0.5) { aimX = p.x; aimZ = p.z; } else if (u.overT[i] > 1.2) u.fade[i] = Math.min(1, u.fade[i] + dt * 1.2);
        if (u.overT[i] > 18) u.fade[i] = Math.min(1, u.fade[i] + dt);
        u.anim[i] = ANIM.OVERIT;
        if (!isNaN(aimX)) moveToward(state, i, aimX, aimZ, speed, dt, 0.05, false);
        continue;
      }
      if (pauseAll || u.frozenT[i] > 0 || u.flinchT[i] > 0) {
        u.anim[i] = u.frozenT[i] > 0 ? ANIM.SIT : u.flinchT[i] > 0 ? ANIM.FLINCH : ANIM.IDLE;
        continue;
      }
      const o = u.order[i];
      speed = unitSpeed(state, i, t);
      const range = t.range * u.rangeM[i];

      // 1. engaged target?
      const tgt = u.target[i] >= 0 ? W.unitIndex(state, u.target[i]) : -1;
      let engaged = false;
      if (tgt >= 0 && !(o && o.type === 'move')) {
        engaged = true;
        const dx = u.x[tgt] - u.x[i], dz = u.z[tgt] - u.z[i];
        const d = Math.sqrt(dx * dx + dz * dz);
        const holdAt = t.cls === 'talker' ? range * SQ.data.combat.talkerHoldFrac : Math.max(0.6, range * 0.85);
        if (o && o.type === 'hold') {
          // hold: never chase
        } else if (d > holdAt) {
          // chase: straight only when close, in clear sight and making progress; otherwise follow a
          // flow field (through gates) toward the target, re-pathed as it moves (fields cache per 2 m)
          if (d < u.bestD[i] - 0.25) { u.bestD[i] = d; u.stuckT[i] = 0; } else u.stuckT[i] += dt;
          if (d < 12 && u.stuckT[i] < 1 && nav.los(u.x[i], u.z[i], u.x[tgt], u.z[tgt])) { aimX = u.x[tgt]; aimZ = u.z[tgt]; }
          else {
            field = nav.fieldTo(u.x[tgt], u.z[tgt]); goalX = u.x[tgt]; goalZ = u.z[tgt];
            if (u.stuckT[i] > 4) u.bestD[i] = Infinity, u.stuckT[i] = 0;
          }
          stopDist = holdAt;
        } else if (t.cls === 'talker') {
          // back off when an enemy crowd closes in
          W.query(state, u.x[i], u.z[i], SQ.data.combat.talkerBackoffDist, near);
          let ax = 0, az = 0, cnt = 0;
          for (let k = 0; k < near.length; k++) {
            const j = near[k];
            if (u.faction[j] === u.faction[i] || (u.flags[j] & UF.OVERIT) || u.cls[j] !== 0) continue;
            ax += u.x[i] - u.x[j]; az += u.z[i] - u.z[j]; cnt++;
          }
          if (cnt) {
            const L = Math.sqrt(ax * ax + az * az) || 1;
            aimX = u.x[i] + ax / L * SQ.data.combat.talkerBackoff;
            aimZ = u.z[i] + az / L * SQ.data.combat.talkerBackoff;
            stopDist = 0.3;
          }
        }
      }
      // 2. order destination
      if (!engaged && o && !o.arrived && o.type !== 'attack') {
        goalX = u.gx[i]; goalZ = u.gz[i];
        field = o.field;
        const dx = goalX - u.x[i], dz = goalZ - u.z[i];
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < 0.9) { arrive(state, i); continue; }
        if (d < u.bestD[i] - 0.25) { u.bestD[i] = d; u.stuckT[i] = 0; } else u.stuckT[i] += dt;
        if ((u.stuckT[i] > 2.5 && d < 7) || u.stuckT[i] > 8) { arrive(state, i); continue; }
        u.flags[i] |= UF.MOVING;
        stopDist = 0.1;
      } else if (!engaged && o && o.type === 'attack') {
        // target gone
        u.order[i] = null; u.ax[i] = u.x[i]; u.az[i] = u.z[i];
      } else if (!engaged) {
        // idle / guarding: drift back to the anchor
        const dx = u.ax[i] - u.x[i], dz = u.az[i] - u.z[i];
        const d2 = dx * dx + dz * dz;
        if (d2 > 2.5 * 2.5) {
          goalX = u.ax[i]; goalZ = u.az[i];
          if (d2 > 12 * 12 || !nav.los(u.x[i], u.z[i], goalX, goalZ)) field = nav.fieldTo(goalX, goalZ);
          stopDist = 0.8;
        }
      }
      if (!isNaN(goalX) && isNaN(aimX)) {
        const dx = goalX - u.x[i], dz = goalZ - u.z[i];
        const d2 = dx * dx + dz * dz;
        if (field && !(d2 < 144 && nav.los(u.x[i], u.z[i], goalX, goalZ))) {
          let p = nav.step(field, u.x[i], u.z[i], 5, tmpPt);
          // the look-ahead point must be in straight line of sight, else take one cell at a time
          if (p && !nav.los(u.x[i], u.z[i], p.x, p.z)) p = nav.step(field, u.x[i], u.z[i], 1, tmpPt);
          // a look-ahead waypoint is not the goal: never "arrive" short of it (a chase's stop
          // distance belongs to the target, and would otherwise freeze units a cell from home)
          if (p) { aimX = p.x; aimZ = p.z; stopDist = Math.min(stopDist, 0.05); } else { aimX = goalX; aimZ = goalZ; }
        } else { aimX = goalX; aimZ = goalZ; }
      }
      let moved = 0;
      if (!isNaN(aimX)) moved = moveToward(state, i, aimX, aimZ, speed, dt, stopDist, true);
      else moved = separate(state, i, dt);
      u.moved[i] += moved;
      if (moved > 0.02 * dt * 20) u.anim[i] = ANIM.WALK;
      else if (u.hitT[i] < 0.6) u.anim[i] = ANIM.ATTACK;
      else u.anim[i] = (u.flags[i] & UF.CAPTURING) ? ANIM.CHEER : ANIM.IDLE;
    }
  }

  // Move unit i toward (tx,tz) with separation and wall sliding. Returns distance moved.
  function moveToward(state, i, tx, tz, speed, dt, stopDist, separation) {
    const u = state.units, nav = state.nav;
    let dx = tx - u.x[i], dz = tz - u.z[i];
    const d = Math.sqrt(dx * dx + dz * dz);
    let vx = 0, vz = 0;
    if (d > stopDist) {
      const step = Math.min(speed, (d - stopDist) / dt + 0.0001);
      vx = dx / d * step; vz = dz / d * step;
    }
    if (separation) {
      const s = sepVector(state, i);
      vx += s.x; vz += s.z;
    }
    return slide(state, i, vx * dt, vz * dt, d > stopDist ? Math.atan2(dx, dz) : NaN);
  }

  function separate(state, i, dt) {
    const s = sepVector(state, i);
    if (s.x === 0 && s.z === 0) return 0;
    return slide(state, i, s.x * dt, s.z * dt, NaN);
  }

  const sepOut = { x: 0, z: 0 };
  function sepVector(state, i) {
    const u = state.units;
    const R = SQ.data.combat.separation;
    W.query(state, u.x[i], u.z[i], R, near);
    let sx = 0, sz = 0;
    for (let k = 0; k < near.length; k++) {
      const j = near[k];
      if (j === i || (u.flags[j] & UF.OVERIT)) continue;
      let dx = u.x[i] - u.x[j], dz = u.z[i] - u.z[j];
      let d = Math.sqrt(dx * dx + dz * dz);
      if (d < 1e-4) { // deterministic tie-break
        const a = (u.id[i] * 2.39996) % 6.2832; dx = Math.cos(a); dz = Math.sin(a); d = 1;
      }
      const push = (R - Math.min(R, d)) / R;
      // heavier units get pushed less
      const wSelf = u.cls[i] === 2 ? 0.5 : 1;
      sx += dx / d * push * 2.2 * wSelf; sz += dz / d * push * 2.2 * wSelf;
    }
    const L = Math.sqrt(sx * sx + sz * sz);
    if (L > 2.5) { sx *= 2.5 / L; sz *= 2.5 / L; }
    sepOut.x = sx; sepOut.z = sz;
    return sepOut;
  }

  function slide(state, i, mx, mz, face) {
    const u = state.units, nav = state.nav;
    if (mx === 0 && mz === 0) return 0;
    const x = u.x[i], z = u.z[i];
    let nx = x + mx, nz = z + mz;
    if (!nav.walkable(nx, nz)) {
      if (nav.walkable(x + mx, z)) { nz = z; }
      else if (nav.walkable(x, z + mz)) { nx = x; }
      else return 0;
    }
    u.x[i] = nx; u.z[i] = nz;
    if (!isNaN(face)) {
      // ease facing
      let df = face - u.facing[i];
      while (df > Math.PI) df -= 2 * Math.PI;
      while (df < -Math.PI) df += 2 * Math.PI;
      u.facing[i] += df * 0.35;
    }
    const ddx = nx - x, ddz = nz - z;
    return Math.sqrt(ddx * ddx + ddz * ddz);
  }

  SQ.Movement = { tick, applyOrder, arrive, knock, landmarkSlot, groundSlot, unitSpeed };
})(window.SQ = window.SQ || {});
