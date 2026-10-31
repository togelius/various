// SQUARE OFF — world state: struct-of-arrays units, spatial hash, landmarks, setups, zones.
// Headless. See js/core/contracts.js for the state shape consumed by render/UI.
(function (SQ) {
  'use strict';

  const UF = { OVERIT: 1, FROZEN: 2, SLOWED: 4, REGULAR: 8, ANIMAL: 16, COMBAT: 32, HOLD: 64, BUFFED: 128, HEALING: 256, CAPTURING: 512, CREW: 1024, FLEE: 2048, SHELTER: 4096, NEUTRAL: 8192, MOVING: 16384, TRUCE: 32768 };
  const ANIM = { IDLE: 0, WALK: 1, ATTACK: 2, OVERIT: 3, SIT: 4, FLINCH: 5, CHEER: 6 };
  const CLS = ['crowd', 'talker', 'heavy'];
  const CLS_IDX = { crowd: 0, talker: 1, heavy: 2 };

  // Typed per-unit fields (kept dense; removal swaps the last unit into the hole).
  const F64 = ['x', 'z', 'px', 'pz', 'hp', 'maxHp', 'facing', 'fade', 'hitT', 'cd', 'combatT', 'slowT', 'slow', 'frozenT', 'flinchT',
    'speedBuffT', 'speedBuff', 'swayBuffT', 'swayBuff', 'moved', 'scrumCD', 'stickyT', 'retargetT', 'overT', 'ax', 'az', 'gx', 'gz',
    'spdM', 'swayM', 'defM', 'healR', 'rangeM', 'stuckT', 'bestD'];
  const I32 = ['id', 'target', 'lastHitTarget', 'hits', 'lm', 'born', 'attacker'];
  const U8 = ['cls', 'type', 'anim', 'advice'];
  const I8 = ['faction', 'squad'];
  const U16 = ['flags'];
  const OBJ = ['order'];

  function createUnits(cap) {
    const u = { n: 0, cap: cap, nextId: 1, index: new Map() };
    for (const k of F64) u[k] = new Float64Array(cap);
    for (const k of I32) u[k] = new Int32Array(cap);
    for (const k of U8) u[k] = new Uint8Array(cap);
    for (const k of I8) u[k] = new Int8Array(cap);
    for (const k of U16) u[k] = new Uint16Array(cap);
    for (const k of OBJ) u[k] = new Array(cap).fill(null);
    return u;
  }

  function grow(u) {
    const cap = u.cap * 2;
    const g = (Arr, k) => { const a = new Arr(cap); a.set(u[k]); u[k] = a; };
    for (const k of F64) g(Float64Array, k);
    for (const k of I32) g(Int32Array, k);
    for (const k of U8) g(Uint8Array, k);
    for (const k of I8) g(Int8Array, k);
    for (const k of U16) g(Uint16Array, k);
    for (const k of OBJ) { const a = new Array(cap).fill(null); for (let i = 0; i < u.n; i++) a[i] = u[k][i]; u[k] = a; }
    u.cap = cap;
  }

  /**
   * Spawn a unit. typeKey: 'pack.crowd' etc. Returns its index (ids are in units.id[i]).
   * opts: { squad, regularOf (landmark idx), crew (bool) }
   */
  function spawnUnit(state, factionIdx, typeKey, x, z, opts) {
    opts = opts || {};
    const u = state.units;
    if (u.n >= u.cap) grow(u);
    const t = SQ.data.unitTypeByKey[typeKey];
    if (!t) throw new Error('Unknown unit type ' + typeKey);
    const fac = state.factions[factionIdx];
    const fd = SQ.data.factions[fac.key] || {};
    const i = u.n++;
    for (const k of F64) u[k][i] = 0;
    for (const k of I32) u[k][i] = 0;
    for (const k of U8) u[k][i] = 0;
    const id = u.nextId++;
    u.id[i] = id;
    u.index.set(id, i);
    // nudge onto walkable ground
    const nav = state.nav;
    if (nav && !nav.walkable(x, z)) {
      const p = nav.nearestWalkable(x, z, 20);
      if (p) { x = p.x; z = p.z; }
    }
    u.x[i] = u.px[i] = u.ax[i] = u.gx[i] = x;
    u.z[i] = u.pz[i] = u.az[i] = u.gz[i] = z;
    u.maxHp[i] = u.hp[i] = t.hp * (fd.hpMult || 1);
    u.cls[i] = CLS_IDX[t.cls];
    u.type[i] = t.idx;
    u.faction[i] = factionIdx;
    u.squad[i] = opts.squad !== undefined ? opts.squad : 0;
    u.anim[i] = ANIM.IDLE;
    let flags = 0;
    if (t.perks && t.perks.indexOf('animal') >= 0) flags |= UF.ANIMAL;
    if (t.neutral) flags |= UF.NEUTRAL;
    if (opts.regularOf !== undefined && opts.regularOf >= 0) flags |= UF.REGULAR;
    if (opts.crew) flags |= UF.CREW;
    u.flags[i] = flags;
    u.target[i] = -1;
    u.attacker[i] = -1;
    u.lastHitTarget[i] = -1;
    u.lm[i] = opts.regularOf !== undefined ? opts.regularOf : -1;
    u.born[i] = state.tick;
    u.cd[i] = 0.2 + (SQ.util.hash2(id, 7) % 1000) / 1000 * t.hitInterval; // stagger first hits
    u.combatT[i] = 99;
    u.retargetT[i] = (id % 5) * 0.05;
    u.facing[i] = 0;
    u.order[i] = null;
    u.spdM[i] = u.swayM[i] = u.defM[i] = u.rangeM[i] = 1;
    u.bestD[i] = Infinity;
    return i;
  }

  /** Remove the unit at index i (swap-remove). */
  function removeUnit(state, i) {
    const u = state.units;
    const last = u.n - 1;
    u.index.delete(u.id[i]);
    if (i !== last) {
      for (const k of F64) u[k][i] = u[k][last];
      for (const k of I32) u[k][i] = u[k][last];
      for (const k of U8) u[k][i] = u[k][last];
      for (const k of I8) u[k][i] = u[k][last];
      for (const k of U16) u[k][i] = u[k][last];
      for (const k of OBJ) u[k][i] = u[k][last];
      u.index.set(u.id[i], i);
    }
    u.order[last] = null;
    u.n = last;
  }

  function unitIndex(state, id) {
    const i = state.units.index.get(id);
    return i === undefined ? -1 : i;
  }

  function unitType(state, i) { return SQ.data.unitTypes[state.units.type[i]]; }

  // ------------------------------------------------------------ spatial hash
  const HASH = { x0: -260, z0: -200, cell: 6, w: 87, h: 67 };
  function createHash() {
    return { head: new Int32Array(HASH.w * HASH.h), next: new Int32Array(1024), cellOf: new Int32Array(1024) };
  }
  function hashCell(x, z) {
    let i = Math.floor((x - HASH.x0) / HASH.cell), j = Math.floor((z - HASH.z0) / HASH.cell);
    if (i < 0) i = 0; else if (i >= HASH.w) i = HASH.w - 1;
    if (j < 0) j = 0; else if (j >= HASH.h) j = HASH.h - 1;
    return j * HASH.w + i;
  }
  /** Rebuild the spatial hash (call once per tick after movement). */
  function rebuildHash(state) {
    const h = state.hash, u = state.units;
    if (h.next.length < u.cap) { h.next = new Int32Array(u.cap); h.cellOf = new Int32Array(u.cap); }
    h.head.fill(-1);
    for (let i = u.n - 1; i >= 0; i--) {
      const c = hashCell(u.x[i], u.z[i]);
      h.cellOf[i] = c;
      h.next[i] = h.head[c];
      h.head[c] = i;
    }
  }
  /**
   * Unit indices within r of (x,z), in deterministic order. Writes into `out` (array) and returns it.
   * Includes Over It units; callers filter by flags.
   */
  function query(state, x, z, r, out) {
    out = out || [];
    out.length = 0;
    const h = state.hash, u = state.units;
    const r2 = r * r;
    const i0 = Math.max(0, Math.floor((x - r - HASH.x0) / HASH.cell)), i1 = Math.min(HASH.w - 1, Math.floor((x + r - HASH.x0) / HASH.cell));
    const j0 = Math.max(0, Math.floor((z - r - HASH.z0) / HASH.cell)), j1 = Math.min(HASH.h - 1, Math.floor((z + r - HASH.z0) / HASH.cell));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        for (let k = h.head[j * HASH.w + i]; k >= 0; k = h.next[k]) {
          if (k >= u.n) continue;
          const dx = u.x[k] - x, dz = u.z[k] - z;
          if (dx * dx + dz * dz <= r2) out.push(k);
        }
      }
    }
    return out;
  }

  // ------------------------------------------------------------ landmarks
  function inRing(lm, x, z) {
    if (lm.poly) return SQ.util.pointInPoly(x, z, lm.poly);
    const dx = x - lm.x, dz = z - lm.z;
    return dx * dx + dz * dz <= lm.r * lm.r;
  }

  function landmarkIndex(state, idOrIdx) {
    if (typeof idOrIdx === 'number') return idOrIdx >= 0 && idOrIdx < state.landmarks.length ? idOrIdx : -1;
    if (typeof idOrIdx === 'string') {
      const l = state.lmById[idOrIdx];
      return l ? l.idx : -1;
    }
    return -1;
  }

  // ------------------------------------------------------------ zones
  /**
   * Add a modifier zone (used by the Director and Crew Calls).
   * zone: { kind, x, z, r, until, faction (-1 any), who: 'all'|'allies'|'enemies', factionKey?,
   *         speed?, sway?, regen?, dps?, noAttack?, range?, heal? }
   */
  function addZone(state, zone) {
    const z = Object.assign({ id: 'z' + (state.zoneSeq = (state.zoneSeq || 0) + 1), faction: -1, who: 'all', until: Infinity }, zone);
    state.zones.push(z);
    return z;
  }
  function removeZone(state, id) {
    const k = state.zones.findIndex((z) => z.id === id);
    if (k >= 0) state.zones.splice(k, 1);
  }
  /** Whether zone z applies to a unit of faction f (index) with faction key fk. */
  function zoneApplies(z, f, fk) {
    if (z.factionKey && z.factionKey !== fk) return false;
    if (z.who === 'allies') return z.faction === f;
    if (z.who === 'enemies') return z.faction >= 0 && z.faction !== f;
    return true;
  }

  /**
   * Visibility helper (AI fog and optional UI fog): own unit within sight (25 m), own landmark rings,
   * Fountain vision 60 m, Arch reveals the north half.
   */
  function isVisible(state, f, x, z) {
    const sight = SQ.data.combat.sight * ((state.factions[f] && state.factions[f].sightMult) || 1);
    const near = query(state, x, z, sight, state._visTmp || (state._visTmp = []));
    const u = state.units;
    for (let k = 0; k < near.length; k++) if (u.faction[near[k]] === f && !(u.flags[near[k]] & UF.OVERIT)) return true;
    for (const lm of state.landmarks) {
      if (lm.owner !== f) continue;
      const vr = lm.perk && lm.perk.vision ? lm.perk.vision : lm.r + 10;
      if ((x - lm.x) * (x - lm.x) + (z - lm.z) * (z - lm.z) <= vr * vr) return true;
      if (lm.perk && lm.perk.revealNorth && z < 0) return true;
    }
    return false;
  }

  SQ.World = {
    UF, ANIM, CLS, CLS_IDX, HASH,
    createUnits, spawnUnit, removeUnit, unitIndex, unitType,
    createHash, rebuildHash, query,
    inRing, landmarkIndex,
    addZone, removeZone, zoneApplies,
    isVisible,
  };
})(window.SQ = window.SQ || {});
