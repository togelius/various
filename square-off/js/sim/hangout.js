// SQUARE OFF — "Hang Out" rules: three persistent groups per side, five equal spots, five minutes.
// "Your crew earns by hanging out somewhere. Opponents have to make it leave." (DESIGN-V2.md)
// Headless and deterministic: fixed 20 Hz steps, no THREE/DOM. Reuses js/sim/nav.js flow fields.
//
// const m = SQ.Hangout.create(cfg);  m.tick() 20x a second;  m.order(side, groupId, target);  m.state
// The classic RTS (SQ.Match / SQ.cmd) is untouched and independent of this file.
(function (SQ) {
  'use strict';
  const DT = 0.05;
  const U = SQ.util;
  const TAU = Math.PI * 2;
  const EPS = 1e-9;
  const tmp = { x: 0, z: 0 };

  function D() { return SQ.data.hangout; }

  // ------------------------------------------------------------------ geometry helpers
  function inSpot(spot, x, z) {
    if (spot.poly) return U.pointInPoly(x, z, spot.poly);
    const dx = x - spot.x, dz = z - spot.z;
    return dx * dx + dz * dz <= spot.r * spot.r;
  }

  /** The spot (index) whose area contains (x, z), or -1. */
  function spotAt(state, x, z) {
    for (const s of state.spots) if (inSpot(s, x, z)) return s.idx;
    return -1;
  }

  /** Nearest group to (x, z) within r m (optionally of one side), or null. Coffee breaks excluded. */
  function groupAt(state, x, z, r, side) {
    let best = null, bd = (r || 6) * (r || 6);
    for (const g of state.groups) {
      if (g.coffee || (side !== undefined && side !== null && g.side !== side)) continue;
      const d = (g.x - x) * (g.x - x) + (g.z - z) * (g.z - z);
      if (d <= bd) { bd = d; best = g; }
    }
    return best;
  }

  // A side's three standing places at a spot face its own entrance, so rivals stand across from each other.
  // Places are chosen in turn (every side's first place, then every side's second, ...) and each one keeps
  // SLOT_SEP m from every place already chosen at that spot, whichever crew it belongs to: two groups never
  // share a standing place (the sim positions, the AI's travel tables and the Park Report all use them).
  const SLOT_SEP = 2.2;
  function computeSlots(nav, spot, entrances, perSide) {
    const nS = entrances.length;
    const R = spot.slotR || 4.5;
    // a side's standing places are ~3.5 m apart (so a crew's groups stand together), facing its entrance
    const spread = Math.min(nS <= 2 ? 0.75 : 0.42, 3.5 / R);
    const out = entrances.map(() => new Array(perSide));
    const placed = [];
    for (let j = 0; j < perSide; j++) {
      for (let s = 0; s < nS; s++) {
        const e = entrances[s];
        const base = Math.atan2(e.x - spot.x, e.z - spot.z) + (spot.rot || 0);
        const a = base + (j === 0 ? 0 : j % 2 ? spread * Math.ceil(j / 2) : -spread * Math.ceil(j / 2));
        const p = snapSlot(nav, spot, a, R, placed);
        out[s][j] = p;
        placed.push(p);
      }
    }
    return out;
  }

  function roomy(nav, x, z, c) { return nav.walkable(x + c, z) && nav.walkable(x - c, z) && nav.walkable(x, z + c) && nav.walkable(x, z - c); }
  // Candidates around the preferred place (angle a, radius R), nearest first; the first that is walkable, inside
  // the spot, has room around it and is far enough from the places already taken wins. The search widens before
  // it gives up, and the last resort is the walkable point nearest the preferred place (never the spot centre,
  // where two crews' fallbacks used to land on the same point).
  function snapSlot(nav, spot, a, R, placed) {
    const cands = [];
    for (let k = 0; k < 40; k++) {   // the original search order first: the measured layout keeps its places
      cands.push({ a: a + ((k & 3) === 1 ? 0.15 : (k & 3) === 2 ? -0.15 : (k & 3) === 3 ? 0.3 : 0), r: Math.max(0, R - (k >> 2) * 0.5) });
    }
    const more = [];
    for (const da of [0, 0.15, -0.15, 0.3, -0.3, 0.45, -0.45, 0.6, -0.6, 0.8, -0.8, 1.05, -1.05, 1.3, -1.3]) {
      for (const dr of [0, -0.75, 0.75, -1.5, 1.5, -2.25, 2.25, -3, 3]) {
        if (R + dr >= 0.8) more.push({ a: a + da, r: R + dr, cost: Math.abs(da) * R + Math.abs(dr) });
      }
    }
    more.sort((p, q) => p.cost - q.cost);
    const all = cands.concat(more);
    const free = (x, z, sep) => { for (const p of placed) if (Math.hypot(p.x - x, p.z - z) < sep) return false; return true; };
    for (const [sep, room] of [[SLOT_SEP, 0.6], [SLOT_SEP, 0.3], [1.6, 0.3]]) {
      for (const c of all) {
        const x = spot.x + Math.sin(c.a) * c.r, z = spot.z + Math.cos(c.a) * c.r;
        if (!nav.walkable(x, z) || !inSpot(spot, x, z) || !roomy(nav, x, z, room) || !free(x, z, sep)) continue;
        return { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 };
      }
    }
    const px = spot.x + Math.sin(a) * R, pz = spot.z + Math.cos(a) * R;
    const p = nav.nearestWalkable(px, pz, 12) || { x: px, z: pz };
    return { x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 };
  }

  function slotKey(p) { return 'ho:' + p.x.toFixed(2) + ',' + p.z.toFixed(2); }

  // Formation offsets for the people in a group (render): local frame, +z forward, metres.
  function formation(n) {
    const out = [];
    for (let k = 0; k < n; k++) {
      const r = k === 0 ? 0.35 : 0.95 * Math.sqrt(k + 0.2);
      const a = k * 2.39996323 + 0.6;
      out.push([Math.round(Math.sin(a) * r * 100) / 100, Math.round(Math.cos(a) * r * 100) / 100]);
    }
    return out;
  }

  function speedMult(nav, x, z) {
    const c = nav.idx(x, z);
    if (c < 0) return 1;
    const k = nav.cost[c];
    return k >= 255 ? 1 : 10 / k;
  }

  // ------------------------------------------------------------------ create
  /**
   * cfg = {
   *   seed: uint32 (1), layout: 'park' | {spots:[ids], entrances:[ids]}, quiet: bool (don't forward to SQ.bus),
   *   players: [{ crew: 'hustle'|'noise'|'violets'|'pack', ai: false | { difficulty: 'easy'|'normal'|'hard', flags? },
   *               entrance?: id, color?, name? }],
   *   scenario?: id in SQ.data.hangout.scenarios or a scenario object (spots, length, groups, holders, ai, goal),
   *   crew?, rival? (scenario shorthands: the player's crew and the rival crew),
   *   length?: s (0 = untimed), rules?: { ...overrides of SQ.data.hangout.rules } (lab only),
   *   spots?: [ids] (subset in play), groups?: [[{slot, at, patience, coffee}], ...] (per side start),
   *   holders?: { spotId: side }, scores?: [points per side], ai?: false (no AI plug-in), geo?: GEO
   * }
   */
  function create(cfg) {
    cfg = Object.assign({}, cfg || {});
    const data = D();
    let scen = cfg.scenario ? (typeof cfg.scenario === 'string' ? data.scenarios[cfg.scenario] : cfg.scenario) : null;
    if (cfg.scenario && !scen) throw new Error('Unknown scenario ' + cfg.scenario);
    if (scen) {
      if (!cfg.players) {
        const pc = cfg.crew || 'hustle';
        const rc = cfg.rival || (pc === 'pack' ? 'violets' : 'pack');
        cfg.players = [{ crew: pc, ai: false }, { crew: rc, ai: scen.ai || { difficulty: 'easy' } }];
      }
      for (const k of ['spots', 'groups', 'holders', 'scores']) if (cfg[k] === undefined && scen[k] !== undefined) cfg[k] = scen[k];
      if (cfg.length === undefined && scen.length !== undefined) cfg.length = scen.length;
    }
    if (!cfg.players) cfg.players = [{ crew: 'hustle', ai: false }, { crew: 'pack', ai: { difficulty: 'normal' } }];
    const seed = (cfg.seed === undefined ? 1 : cfg.seed) >>> 0;
    const rules = Object.assign({}, data.rules, (scen && scen.rules) || {}, cfg.rules || {});
    if (cfg.length !== undefined) rules.length = cfg.length || 0;
    const geo = cfg.geo || (typeof window !== 'undefined' && window.GEO);
    if (!geo) throw new Error('GEO not loaded');
    const nav = SQ.nav.get(geo);
    const layout = typeof cfg.layout === 'object' && cfg.layout ? cfg.layout : data.layouts[cfg.layout || 'park'];
    if (!layout) throw new Error('Unknown layout ' + cfg.layout);
    const nSides = cfg.players.length;
    const perSide = rules.groupsPerSide;

    const entrances = cfg.players.map((p, k) => {
      const id = p.entrance || layout.entrances[k % layout.entrances.length];
      const e = data.entrances[id];
      if (!e) throw new Error('Unknown entrance ' + id);
      return { id: e.id, name: e.name, nick: e.nick || '', x: e.x, z: e.z };
    });

    const spotIds = (cfg.spots || layout.spots).filter((id) => layout.spots.indexOf(id) >= 0 || data.spots[id]);
    const spots = spotIds.map((id, idx) => {
      const d = data.spots[id];
      if (!d) throw new Error('Unknown spot ' + id);
      const s = {
        idx, id, name: d.name, short: d.short || d.name, the: d.the || String(d.name).replace(/^The /, 'the '), x: d.x, z: d.z, r: d.r, poly: d.poly || null, slotR: d.slotR, rot: d.rot || 0,
        holder: -1, settleSide: -1, settle: 0, settling: false, present: new Array(nSides).fill(0), since: new Array(nSides).fill(-1), contested: false, arguing: false,
        heldSince: 0, changes: 0, lastHolder: -1, slots: null,
      };
      s.slots = computeSlots(nav, s, entrances, perSide);
      for (const row of s.slots) for (const p of row) nav.registerField(slotKey(p), p.x, p.z);
      return s;
    });

    const state = {
      mode: 'hangout', t: 0, tick: 0, dt: DT, length: rules.length, timeLeft: rules.length,
      over: false, winner: -1, reason: null, player: -1, layout: layout.id || 'custom',
      scenario: scen ? scen.id || 'custom' : null,
      sides: [], groups: [], spots, history: [], nav,
    };

    cfg.players.forEach((p, k) => {
      const crew = data.crews[p.crew] ? p.crew : 'hustle';
      const fd = SQ.data.factions && SQ.data.factions[crew];
      const isPlayer = !p.ai;
      if (isPlayer && state.player < 0) state.player = k;
      state.sides.push({
        idx: k, crew, name: p.name || (fd ? fd.name : crew), short: fd ? fd.short : crew, color: p.color || (fd ? fd.color : '#888888'),
        isPlayer, ai: p.ai || false, entrance: entrances[k], score: 0, points: 0, earnedTicks: 0, bonus: 0, rate: 0, holding: 0,
        groups: [], stats: makeSideStats(spots.length),
      });
    });

    // groups
    const startCfg = cfg.groups || null;
    for (let k = 0; k < nSides; k++) {
      const side = state.sides[k];
      const list = startCfg ? (startCfg[k] || []) : [0, 1, 2].slice(0, perSide).map((j) => ({ slot: j, at: 'entrance' }));
      for (const gc of list) {
        const j = gc.slot !== undefined ? gc.slot : side.groups.length;
        const meta = data.crews[side.crew].groups[j % data.crews[side.crew].groups.length];
        const g = {
          id: state.groups.length, side: k, slot: j, key: side.crew + '.' + meta.key, name: meta.name, short: meta.short,
          members: meta.members || 5, offsets: formation(meta.members || 5),
          x: 0, z: 0, px: 0, pz: 0, facing: 0, tx: 0, tz: 0, spot: -1, lastSpot: -1, moving: false, at: -1,
          patience: rules.patienceMax, arguing: false, rivals: 0, status: 'idle', earning: false,
          coffee: false, backAt: 0, backIn: 0, leftAt: null, pending: null, cameBack: -1, tiredSaid: false,
          say: null, lastBark: -99, stuckT: 0, bestD: Infinity, fieldKey: null,
          stats: { walked: 0, coffees: 0, heldTicks: 0, argueTicks: 0, idleTicks: 0, run: 0, runSpot: -1, best: 0, bestSpot: -1 },
        };
        state.groups.push(g);
        side.groups.push(g.id);
        const e = entrances[k];
        const p0 = entranceSpot(nav, e, j);
        g.x = g.px = g.tx = p0.x; g.z = g.pz = g.tz = p0.z;
        g.facing = Math.atan2(-13 - e.x, 0 - e.z);
        if (gc.patience !== undefined) g.patience = U.clamp(gc.patience, 0, rules.patienceMax);
        if (gc.at && gc.at !== 'entrance') {
          let si = -1, x = 0, z = 0;
          if (typeof gc.at === 'string') si = spots.findIndex((s) => s.id === gc.at);
          if (si >= 0) { const sl = spots[si].slots[k][j % perSide]; x = sl.x; z = sl.z; } else if (typeof gc.at === 'object') { x = gc.at.x; z = gc.at.z; }
          const w = nav.nearestWalkable(x, z, 10) || { x, z };
          g.x = g.px = g.tx = si >= 0 ? x : w.x; g.z = g.pz = g.tz = si >= 0 ? z : w.z;
          if (si >= 0) { g.spot = g.lastSpot = si; g.fieldKey = slotKey(spots[si].slots[k][j % perSide]); }
          const fs = spots[si >= 0 ? si : 0];
          if (fs) g.facing = Math.atan2(fs.x - g.x, fs.z - g.z);
        }
        if (gc.coffee) { g.coffee = true; g.backAt = gc.coffee; g.backIn = gc.coffee; g.patience = 0; }
      }
    }
    // pre-settled spots and scores
    if (cfg.holders) {
      for (const id of Object.keys(cfg.holders)) {
        const s = spots.find((q) => q.id === id);
        if (s) { s.holder = cfg.holders[id]; s.lastHolder = s.holder; s.heldSince = 0; }
      }
    }
    if (cfg.scores) cfg.scores.forEach((v, k) => { if (state.sides[k]) state.sides[k].bonus = v; });

    const match = {
      cfg, seed, rules, state, nav, scenario: scen,
      bus: U.createBus(), log: [], systems: [], over: false, winner: -1, _inTick: false,
      rngLines: U.rngStream(seed, 'hangout-lines'),
      tick() { return tickMatch(match); },
      emit(name, payload) { match.bus.emit(name, payload); if (!cfg.quiet && SQ.bus) SQ.bus.emit(name, payload); },
      order(side, groupId, target) { return order(match, side, groupId, target); },
      finish(winner, reason) { finish(match, winner, reason); },
      hash() { return stateHash(state); },
      report() { return buildReport(match); },
      summary() { return buildReport(match); },
      eta(groupId, spotIdx) { return eta(match, state.groups[groupId], spotIdx); },
      forceCoffee(groupId) { return forceCoffee(match, groupId); },
    };
    computePresence(state);
    updateSides(match);
    if (SQ.HangoutAI && typeof SQ.HangoutAI.init === 'function' && cfg.ai !== false) {
      try { SQ.HangoutAI.init(match); } catch (e) { if (typeof console !== 'undefined') console.error('[hangout ai]', e); }
    }
    match.emit('matchStart', {
      mode: 'hangout', player: state.player, length: rules.length, scenario: state.scenario,
      sides: state.sides.map((s) => ({ idx: s.idx, crew: s.crew, name: s.name, color: s.color, isPlayer: s.isPlayer, entrance: s.entrance.id })),
      spots: spots.map((s) => ({ id: s.id, idx: s.idx, name: s.name, x: s.x, z: s.z })),
      groups: state.groups.map((g) => ({ id: g.id, side: g.side, name: g.name })),
    });
    return match;
  }

  function entranceSpot(nav, e, j) {
    // side by side, across the direction into the park
    const ix = -13 - e.x, iz = 0 - e.z;
    const L = Math.hypot(ix, iz) || 1;
    const px = -iz / L, pz = ix / L;
    const off = (j === 0 ? 0 : j % 2 ? 2 : -2) * Math.ceil(j / 2);
    const p = nav.nearestWalkable(e.x + px * off + ix / L * 2, e.z + pz * off + iz / L * 2, 10) || { x: e.x, z: e.z };
    return { x: p.x, z: p.z };
  }

  function makeSideStats(nSpots) {
    return {
      heldTicks: new Array(nSpots).fill(0), argueTicks: new Array(nSpots).fill(0), coffees: 0, evictions: 0, twoOnOne: 0,
      withdrawals: 0, mutual: 0, mutualAt: new Array(nSpots).fill(0), settles: 0, spotsLost: 0, maxLead: 0, maxDeficit: 0, orders: 0,
    };
  }

  /**
   * rules.patienceFloor (tutorials only; 0 / undefined everywhere else): arguing never drains a group below this.
   * A number for every crew, or an array per side. The tutorial uses it to hold an argument still until the
   * player has done the thing the lesson is about (send help, walk away), so a lesson never plays itself.
   */
  function floorFor(rules, side) {
    const f = rules.patienceFloor;
    if (!f) return 0;
    return Array.isArray(f) ? (+f[side] || 0) : +f || 0;
  }

  // ------------------------------------------------------------------ commands
  function reject(match, side, cmd, reason) {
    match.emit('cmdRejected', { side, cmd, reason });
    return { ok: false, reason };
  }

  /** Resolve an order target: spot id | spot index | {spot} | {x, z} | 'stop' | 'entrance'. */
  function resolveTarget(match, g, target) {
    const st = match.state, nav = match.nav;
    if (target === 'stop') {
      const si = spotAt(st, g.x, g.z);
      return si >= 0 ? { spot: si } : { spot: -1, x: g.x, z: g.z };
    }
    if (target === 'entrance' || target === 'home') {
      const e = st.sides[g.side].entrance;
      const p = entranceSpot(nav, e, g.slot);
      return { spot: -1, x: p.x, z: p.z };
    }
    if (typeof target === 'number') return Number.isInteger(target) && target >= 0 && target < st.spots.length ? { spot: target } : null;
    if (typeof target === 'string') { const si = st.spots.findIndex((s) => s.id === target); return si >= 0 ? { spot: si } : null; }
    if (target && typeof target === 'object') {
      if (target.spot !== undefined && target.spot !== null) return resolveTarget(match, g, target.spot);
      if (isFinite(target.x) && isFinite(target.z)) {
        const si = spotAt(st, +target.x, +target.z);
        if (si >= 0) return { spot: si };
        const p = nav.nearestWalkable(+target.x, +target.z, 25);
        if (!p) return null;
        return { spot: -1, x: p.x, z: p.z };
      }
    }
    return null;
  }

  /**
   * order(match, side, groupId, target) -> {ok, queued?} | {ok:false, reason}
   * target: spot id ('fountain') | spot index | {spot} | {x, z} (inside a spot = that spot) | 'stop' | 'entrance'.
   * A group on a coffee break takes the order when it is back (queued: true).
   */
  function order(match, side, groupId, target) {
    const st = match.state;
    if (st.over) return reject(match, side, 'order', 'over');
    if (!Number.isInteger(side) || side < 0 || side >= st.sides.length) return reject(match, side, 'order', 'side');
    const g = st.groups[groupId];
    if (!g || g.side !== side) return reject(match, side, 'order', 'group');
    const dest = resolveTarget(match, g, target);
    if (!dest) return reject(match, side, 'order', 'target');
    match.log.push({ tick: st.tick, name: 'order', args: [side, groupId, typeof target === 'object' && target ? Object.assign({}, target) : target], src: match._inTick ? 'ai' : 'ext' });
    st.sides[side].stats.orders++;
    const sp = dest.spot >= 0 ? st.spots[dest.spot] : null;
    if (g.coffee) {
      g.pending = dest;
      match.emit('ordered', { side, group: g.id, spot: sp ? sp.id : null, x: sp ? sp.x : dest.x, z: sp ? sp.z : dest.z, queued: true });
      return { ok: true, queued: true };
    }
    // walking away from an argument with patience left = a withdrawal
    if (g.arguing && g.at >= 0 && dest.spot !== g.at && g.patience > 0) {
      st.sides[side].stats.withdrawals++;
      bark(match, g, 'withdraw', true);
    }
    setDest(match, g, dest);
    match.emit('ordered', { side, group: g.id, spot: sp ? sp.id : null, x: sp ? sp.x : g.tx, z: sp ? sp.z : g.tz, queued: false });
    return { ok: true };
  }

  function setDest(match, g, dest) {
    const st = match.state;
    if (dest.spot >= 0) {
      const s = st.spots[dest.spot];
      const sl = s.slots[g.side][g.slot % s.slots[g.side].length];
      g.spot = dest.spot; g.lastSpot = dest.spot; g.tx = sl.x; g.tz = sl.z; g.fieldKey = slotKey(sl);
    } else {
      g.spot = -1; g.tx = dest.x; g.tz = dest.z; g.fieldKey = null;
    }
    g.moving = Math.hypot(g.tx - g.x, g.tz - g.z) > 0.3;
    g.stuckT = 0; g.bestD = Infinity;
    // presence changes at once: ordering a group away stops its earning this tick
    if (g.at >= 0 && g.spot !== g.at) g.at = -1;
  }

  // ------------------------------------------------------------------ tick
  function tickMatch(match) {
    const st = match.state, rules = match.rules;
    if (st.over) return;
    st.t = Math.round((st.t + DT) * 1e6) / 1e6;
    st.tick++;
    match._inTick = true;
    try {
      if (SQ.HangoutAI && typeof SQ.HangoutAI.tick === 'function' && match.cfg.ai !== false) SQ.HangoutAI.tick(match, DT);
      for (const sys of match.systems) sys(match, DT);
    } finally { match._inTick = false; }
    if (st.over) return;

    // 1. back from coffee
    for (const g of st.groups) {
      if (g.coffee) {
        g.backIn = Math.max(0, g.backAt - st.t);
        if (st.t >= g.backAt - EPS) returnGroup(match, g);
      }
    }
    // 2. walking
    for (const g of st.groups) moveGroup(match, g);
    // 3. who is at which spot
    computePresence(st);
    // 4. arguments drain patience; everyone else recovers
    const prevArguing = st.spots.map((s) => s.arguing);
    for (const s of st.spots) {
      let total = 0, sidesHere = 0;
      for (const n of s.present) { total += n; if (n > 0) sidesHere++; }
      s.contested = sidesHere >= 2;
      s.arguing = sidesHere >= 2;
    }
    for (const g of st.groups) {
      if (g.coffee) { g.arguing = false; g.rivals = 0; continue; }
      if (g.at >= 0) {
        const s = st.spots[g.at];
        let rivals = 0;
        for (let k = 0; k < s.present.length; k++) if (k !== g.side) rivals += s.present[k];
        g.rivals = rivals;
        g.arguing = rivals > 0;
      } else { g.rivals = 0; g.arguing = false; }
      if (g.arguing) {
        let drain = rules.drainPerRival * g.rivals;
        if (rules.settleDrains && st.spots[g.at].holder !== g.side) drain *= 2;
        const fl = floorFor(rules, g.side);
        const next = g.patience - drain * DT;
        g.patience = Math.max(0, fl > 0 ? Math.max(Math.min(g.patience, fl), next) : next);
        if (!g.tiredSaid && g.patience < rules.tiredAt) { g.tiredSaid = true; bark(match, g, 'tired'); }
      } else {
        g.patience = Math.min(rules.patienceMax, g.patience + rules.recoverRate * DT);
        if (g.patience >= rules.tiredAt + 10) g.tiredSaid = false;
      }
    }
    // argument start events (before walkouts so the pair is reported)
    st.spots.forEach((s, i) => {
      if (s.arguing && !prevArguing[i]) {
        const groups = st.groups.filter((g) => g.at === i && !g.coffee);
        match.emit('argueStart', { spot: s.id, spotIdx: i, x: s.x, z: s.z, sides: sidesAt(s), groups: groups.map((g) => g.id), holder: s.holder });
        const speaker = groups.find((g) => g.side === s.holder) || groups[0];
        if (speaker) bark(match, speaker, 'argue', true);
      }
    });
    // 5. out of patience: went for coffee (everyone who hits 0 this tick goes together)
    let out = st.groups.filter((g) => !g.coffee && g.patience <= EPS && g.at >= 0);
    const ties = new Set();
    if (out.length && rules.ties !== 'both') out = resolveTies(match, out, ties);
    if (out.length) wentForCoffee(match, out, ties);
    // 6. spots: holders leave, settling, settled
    for (const s of st.spots) updateSpot(match, s);
    // argument end events
    st.spots.forEach((s, i) => {
      const now = sidesAt(s).length >= 2;
      if (prevArguing[i] && !now) match.emit('argueEnd', { spot: s.id, spotIdx: i, x: s.x, z: s.z, holder: s.holder });
      s.arguing = now; s.contested = now;
    });
    // 7. points
    for (const s of st.spots) {
      if (s.holder >= 0) {
        st.sides[s.holder].earnedTicks++;
        st.sides[s.holder].stats.heldTicks[s.idx]++;
      }
    }
    updateSides(match);
    // 8. stats, statuses, history, events
    for (const g of st.groups) {
      updateStatus(st, g);
      const gs = g.stats;
      if (g.earning) {
        gs.heldTicks++;
        if (gs.runSpot === g.at) gs.run++; else { gs.run = 1; gs.runSpot = g.at; }
        if (gs.run > gs.best) { gs.best = gs.run; gs.bestSpot = g.at; }
      } else { gs.run = 0; gs.runSpot = -1; }
      if (g.arguing) gs.argueTicks++;
      if (g.status === 'idle') gs.idleTicks++;
      // "Still?": back from coffee, arrived where they left, and the rivals are still there
      if (g.cameBack >= 0 && g.at === g.cameBack && !g.moving) {
        const s = st.spots[g.cameBack];
        if (s.holder >= 0 && s.holder !== g.side) bark(match, g, 'still', true);
        g.cameBack = -1;
      }
    }
    for (const s of st.spots) {
      for (let k = 0; k < st.sides.length; k++) {
        if (st.groups.some((g) => g.at === s.idx && g.side === k && g.arguing)) st.sides[k].stats.argueTicks[s.idx]++;
      }
    }
    const lead = st.sides.length === 2 ? st.sides[0].score - st.sides[1].score : 0;
    if (st.sides.length === 2) {
      const a = st.sides[0].stats, b = st.sides[1].stats;
      a.maxLead = Math.max(a.maxLead, lead); a.maxDeficit = Math.max(a.maxDeficit, -lead);
      b.maxLead = Math.max(b.maxLead, -lead); b.maxDeficit = Math.max(b.maxDeficit, lead);
    }
    const every = Math.max(1, Math.round(match.rules.earnEvery / DT));
    if (st.tick % every === 0) {
      const held = st.spots.filter((s) => s.holder >= 0).map((s) => ({ spot: s.id, spotIdx: s.idx, side: s.holder, x: s.x, z: s.z, amount: match.rules.pointsPerSecond * match.rules.earnEvery }));
      match.emit('earning', { t: st.t, spots: held, score: st.sides.map((s) => s.points) });
      match.emit('score', { t: st.t, score: st.sides.map((s) => s.points), rate: st.sides.map((s) => s.rate), timeLeft: st.timeLeft });
    }
    if (st.tick % Math.max(1, Math.round(match.rules.historyEvery / DT)) === 0) {
      st.history.push({ t: st.t, score: st.sides.map((s) => s.points), held: st.sides.map((s) => s.holding) });
    }
    // 9. the clock
    if (match.rules.length > 0) {
      const before = st.timeLeft;
      st.timeLeft = Math.max(0, Math.round((match.rules.length - st.t) * 1e6) / 1e6);
      for (const w of [60, 30, 10]) if (before > w && st.timeLeft <= w) match.emit('clockWarn', { timeLeft: w });
      if (st.t >= match.rules.length - EPS) {
        const top = Math.max(...st.sides.map((s) => s.points));
        const tied = st.sides.filter((s) => s.points === top);
        finish(match, tied.length === 1 ? tied[0].idx : -1, tied.length === 1 ? 'time' : 'draw');
      }
    }
  }

  function sidesAt(s) {
    const out = [];
    for (let k = 0; k < s.present.length; k++) if (s.present[k] > 0) out.push(k);
    return out;
  }

  function computePresence(st) {
    for (const s of st.spots) s.present.fill(0);
    for (const g of st.groups) {
      g.at = -1;
      if (g.coffee || g.spot < 0) continue;
      const s = st.spots[g.spot];
      if (inSpot(s, g.x, g.z)) { g.at = g.spot; s.present[g.side]++; }
    }
    // since[side]: the tick that side's (unbroken) presence at the spot began, -1 when it has nobody there
    for (const s of st.spots) {
      for (let k = 0; k < s.present.length; k++) {
        if (s.present[k] > 0) { if (s.since[k] < 0) s.since[k] = s.holder === k ? -2 : st.tick; } else s.since[k] = -1;
      }
    }
  }

  /**
   * The side that has been at spot s the longest (the holder counts as always there first), or -1 when two
   * sides got there within rules.firstBy seconds of each other (a dead heat: nobody was "first").
   */
  function firstAt(s, sides, firstBy) {
    const gap = Math.round((firstBy || 0) / DT);
    let best = -1, bt = Infinity, second = Infinity;
    for (const k of sides) {
      const t = s.holder === k ? -Infinity : s.since[k];
      if (t < bt) { second = bt; bt = t; best = k; } else if (t < second) second = t;
    }
    return second - bt > gap - 1e-9 && second - bt >= 1 ? best : -1;
  }

  function updateSpot(match, s) {
    const st = match.state, rules = match.rules;
    const here = sidesAt(s);
    if (s.holder >= 0 && s.present[s.holder] === 0) {
      const from = s.holder;
      s.holder = -1;
      st.sides[from].stats.spotsLost++;
      match.emit('spotFree', { spot: s.id, spotIdx: s.idx, side: from, reason: s._coffeeOut === from ? 'coffee' : 'left', x: s.x, z: s.z });
    }
    s._coffeeOut = -1;
    if (s.holder >= 0) { s.settleSide = -1; s.settle = 0; s.settling = false; return; }
    if (here.length === 1) {
      const a = here[0];
      if (s.settleSide !== a) { s.settleSide = a; s.settle = 0; s.settling = false; }
      const ready = st.groups.find((g) => g.at === s.idx && g.side === a && !g.moving);
      if (ready) {
        if (!s.settling) {
          s.settling = true;
          match.emit('settleStart', { spot: s.id, spotIdx: s.idx, side: a, group: ready.id, x: s.x, z: s.z, time: rules.settleTime });
          bark(match, ready, 'settle');
        }
        s.settle = Math.round((s.settle + DT) * 1e6) / 1e6;
        if (s.settle >= rules.settleTime - EPS) {
          s.holder = a; s.settleSide = -1; s.settle = 0; s.settling = false; s.heldSince = st.t;
          if (s.lastHolder !== a) s.changes++;
          s.lastHolder = a;
          st.sides[a].stats.settles++;
          const groups = st.groups.filter((g) => g.at === s.idx && g.side === a).map((g) => g.id);
          match.emit('settled', { spot: s.id, spotIdx: s.idx, side: a, groups, x: s.x, z: s.z });
          bark(match, ready, 'settled');
        }
      }
    } else if (s.settleSide >= 0) {
      s.settleSide = -1; s.settle = 0; s.settling = false;
    }
  }

  // Ties: when everybody at a spot runs out of patience at the same moment, whoever was there first stays
  // (on its last nerve) and only the others go for coffee. ('first', the default; 'holder': only an
  // established occupant wins ties; 'both': everyone leaves - the original baseline.)
  function resolveTies(match, out, ties) {
    const st = match.state, rules = match.rules;
    const keep = new Set();
    for (const s of st.spots) {
      const here = st.groups.filter((g) => g.at === s.idx && !g.coffee);
      const leaving = here.filter((g) => out.indexOf(g) >= 0);
      if (!leaving.length || leaving.length !== here.length) continue;   // someone stays anyway: no tie
      const sides = [...new Set(leaving.map((g) => g.side))];
      if (sides.length < 2) continue;
      const w = rules.ties === 'holder' ? (sides.indexOf(s.holder) >= 0 ? s.holder : -1) : firstAt(s, sides, rules.firstBy);
      if (w < 0) continue;
      for (const g of leaving) if (g.side === w) { keep.add(g); g.patience = 1; }
      if (ties) ties.add(s.idx);
    }
    return keep.size ? out.filter((g) => !keep.has(g)) : out;
  }

  /**
   * Groups out of patience go for coffee. The event says why, for the UI's one-line explanation:
   *   mutual   nobody stayed (a spot nobody held: everyone gave up together)
   *   tie      everyone ran out at the same moment and the crew hanging out there stayed (only the others left)
   *   rivals / mates   rival groups / this crew's groups at the spot as it ran out (two against one: rivals 2, mates 1)
   */
  function wentForCoffee(match, out, ties) {
    const st = match.state, rules = match.rules;
    const bySpot = {};
    for (const g of out) (bySpot[g.at] || (bySpot[g.at] = [])).push(g);
    for (const key of Object.keys(bySpot)) {
      const si = +key, s = st.spots[si], leaving = bySpot[key];
      const leavingSides = [...new Set(leaving.map((g) => g.side))];
      const stayers = st.groups.filter((g) => g.at === si && !g.coffee && leaving.indexOf(g) < 0);
      const staySides = [...new Set(stayers.map((g) => g.side))];
      const mutual = leavingSides.length >= 2 && staySides.length === 0;
      const tie = !!(ties && ties.has(si));
      const holderWas = s.holder;
      const count = s.present.slice();
      if (mutual) for (const k of leavingSides) { st.sides[k].stats.mutual++; st.sides[k].stats.mutualAt[si]++; }
      for (const g of leaving) {
        let rivals = 0;
        for (let k = 0; k < count.length; k++) if (k !== g.side) rivals += count[k];
        const mates = count[g.side];
        // credit the crews that made them leave
        for (const k of staySides) {
          if (k === g.side) continue;
          st.sides[k].stats.evictions++;
          if (rules.evictBonus) st.sides[k].bonus += rules.evictBonus;
          if (stayers.filter((q) => q.side === k).length >= 2) st.sides[k].stats.twoOnOne++;
        }
        if (s.holder === g.side && !stayers.some((q) => q.side === g.side)) s._coffeeOut = g.side;
        const line = pickLine(match, st.sides[g.side].crew, 'coffee');
        g.coffee = true; g.backAt = Math.round((st.t + rules.breakTime) * 1e6) / 1e6; g.backIn = rules.breakTime;
        g.leftAt = { x: g.x, z: g.z, spot: si };
        g.at = -1; g.arguing = false; g.rivals = 0; g.moving = false; g.patience = 0; g.pending = null;
        g.stats.coffees++; st.sides[g.side].stats.coffees++;
        g.say = { text: line, kind: 'coffee', t: st.t };
        s.present[g.side]--;
        match.emit('wentForCoffee', { group: g.id, side: g.side, spot: s.id, spotIdx: si, x: g.x, z: g.z, line, backAt: g.backAt, backIn: rules.breakTime,
          mutual, tie, rivals, mates, holder: holderWas, stayed: staySides });
      }
      if (staySides.length === 1) {
        const winner = stayers.find((q) => q.side === staySides[0]);
        if (winner) bark(match, winner, 'evict', true);
      }
    }
  }

  /** Send a group on a coffee break right now (tutorial beats, lab checks). Returns false if it already is. */
  function forceCoffee(match, groupId) {
    const st = match.state, rules = match.rules, g = st.groups[groupId];
    if (!g || g.coffee || st.over) return false;
    if (g.at >= 0) { g.patience = 0; wentForCoffee(match, [g]); return true; }
    const line = pickLine(match, st.sides[g.side].crew, 'coffee');
    g.coffee = true; g.backAt = Math.round((st.t + rules.breakTime) * 1e6) / 1e6; g.backIn = rules.breakTime;
    g.leftAt = { x: g.x, z: g.z, spot: -1 }; g.arguing = false; g.rivals = 0; g.moving = false; g.patience = 0; g.pending = null;
    g.stats.coffees++; st.sides[g.side].stats.coffees++;
    g.say = { text: line, kind: 'coffee', t: st.t };
    g.status = 'coffee'; g.earning = false;
    match.emit('wentForCoffee', { group: g.id, side: g.side, spot: null, spotIdx: -1, x: g.x, z: g.z, line, backAt: g.backAt, backIn: rules.breakTime,
      mutual: false, tie: false, rivals: 0, mates: 1, holder: -1, stayed: [], forced: true });
    return true;
  }

  function returnGroup(match, g) {
    const st = match.state, rules = match.rules;
    const e = st.sides[g.side].entrance;
    const p = entranceSpot(match.nav, e, g.slot);
    g.coffee = false; g.backIn = 0; g.patience = rules.patienceMax; g.tiredSaid = false;
    g.x = g.px = p.x; g.z = g.pz = p.z; g.leftAt = null;
    let dest = g.pending;
    g.pending = null;
    if (!dest && rules.returnTo === 'last' && g.lastSpot >= 0) dest = { spot: g.lastSpot };
    if (dest) setDest(match, g, dest); else { g.spot = -1; g.tx = g.x; g.tz = g.z; g.moving = false; }
    g.cameBack = g.spot;
    const line = pickLine(match, st.sides[g.side].crew, 'back');
    g.say = { text: line, kind: 'back', t: st.t };
    g.lastBark = st.t;
    match.emit('returned', { group: g.id, side: g.side, x: g.x, z: g.z, entrance: e.id, dest: g.spot >= 0 ? st.spots[g.spot].id : null, line });
  }

  // ------------------------------------------------------------------ movement
  function moveGroup(match, g) {
    g.px = g.x; g.pz = g.z;
    if (g.coffee || !g.moving) return;
    const nav = match.nav, rules = match.rules;
    const dx = g.tx - g.x, dz = g.tz - g.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.3) { g.x = g.tx; g.z = g.tz; g.moving = false; return; }
    let ax, az;
    if (d < 12 && nav.los(g.x, g.z, g.tx, g.tz)) { ax = g.tx; az = g.tz; }
    else {
      const field = g.fieldKey ? (nav.flowTo(g.fieldKey) || nav.registerField(g.fieldKey, g.tx, g.tz)) : nav.fieldTo(g.tx, g.tz);
      let p = nav.step(field, g.x, g.z, 5, tmp);
      if (p && !nav.los(g.x, g.z, p.x, p.z)) p = nav.step(field, g.x, g.z, 1, tmp);
      if (p) { ax = p.x; az = p.z; } else { ax = g.tx; az = g.tz; }
    }
    const sp = rules.speed * speedMult(nav, g.x, g.z) * DT;
    const mx = ax - g.x, mz = az - g.z;
    const md = Math.sqrt(mx * mx + mz * mz);
    if (md < 1e-6) { g.moving = false; return; }
    const step = Math.min(sp, md);
    let nx = g.x + mx / md * step, nz = g.z + mz / md * step;
    if (!nav.walkable(nx, nz)) {
      if (nav.walkable(nx, g.z)) nz = g.z; else if (nav.walkable(g.x, nz)) nx = g.x; else { nx = g.x; nz = g.z; }
    }
    g.stats.walked += Math.hypot(nx - g.x, nz - g.z);
    g.x = nx; g.z = nz;
    let df = Math.atan2(mx, mz) - g.facing;
    while (df > Math.PI) df -= TAU;
    while (df < -Math.PI) df += TAU;
    g.facing += df * 0.3;
    // stuck guard (should not happen on the nav grid): give up after 6 s without progress
    const rem = Math.hypot(g.tx - g.x, g.tz - g.z);
    if (rem < g.bestD - 0.2) { g.bestD = rem; g.stuckT = 0; } else if ((g.stuckT += DT) > 6) { g.moving = false; g.tx = g.x; g.tz = g.z; }
    if (rem < 0.3) { g.x = g.tx; g.z = g.tz; g.moving = false; }
  }

  function updateStatus(st, g) {
    const s = g.at >= 0 ? st.spots[g.at] : null;
    g.earning = !!s && s.holder === g.side && !g.coffee;
    if (g.coffee) g.status = 'coffee';
    else if (g.arguing) g.status = 'arguing';
    else if (g.earning) g.status = 'hanging';
    else if (s && s.settleSide === g.side && !g.moving) g.status = 'settling';
    else if (g.moving) g.status = 'walking';
    else g.status = 'idle';
  }

  function updateSides(match) {
    const st = match.state;
    for (const side of st.sides) { side.rate = 0; side.holding = 0; }
    for (const s of st.spots) if (s.holder >= 0) { st.sides[s.holder].holding++; st.sides[s.holder].rate += match.rules.pointsPerSecond; }
    for (const side of st.sides) {
      side.score = side.earnedTicks * DT * match.rules.pointsPerSecond + side.bonus;
      side.points = Math.floor(side.score + 1e-6);
    }
  }

  // ------------------------------------------------------------------ lines
  function pickLine(match, crew, kind) {
    const c = D().crews[crew];
    let list = c && c.lines[kind];
    if (kind === 'coffee' && SQ.data.text && SQ.data.text.exitLines && match.rngLines() < 0.35) {
      list = SQ.data.text.exitLines.any.concat(SQ.data.text.exitLines[crew] || []);
    }
    if (!list || !list.length) return '';
    return list[Math.floor(match.rngLines() * list.length)];
  }

  function bark(match, g, kind, force) {
    const st = match.state;
    if (!force && st.t - g.lastBark < match.rules.barkGap) return;
    const text = pickLine(match, st.sides[g.side].crew, kind);
    if (!text) return;
    g.lastBark = st.t;
    g.say = { text, kind, t: st.t };
    match.emit('bark', { group: g.id, side: g.side, kind, text, spot: g.at >= 0 ? st.spots[g.at].id : null, x: g.x, z: g.z });
  }

  // ------------------------------------------------------------------ queries
  /** Seconds for group g to walk to its standing place at spot si (from where it is, or from its entrance when on coffee + the break left). */
  function eta(match, g, si) {
    const st = match.state, nav = match.nav;
    const s = st.spots[si];
    const sl = s.slots[g.side][g.slot % s.slots[g.side].length];
    const f = nav.flowTo(slotKey(sl)) || nav.registerField(slotKey(sl), sl.x, sl.z);
    let x = g.x, z = g.z, extra = 0;
    if (g.coffee) { const p = entranceSpot(nav, st.sides[g.side].entrance, g.slot); x = p.x; z = p.z; extra = Math.max(0, g.backAt - st.t); }
    const d = nav.distance(f, x, z);
    return extra + (d < Infinity ? d / match.rules.speed : 999);
  }

  /** Walking seconds between two points via the field toward spot si's standing place for (side, slot). */
  function walkTime(match, x, z, si, side, slot) {
    const s = match.state.spots[si];
    const sl = s.slots[side][(slot || 0) % s.slots[side].length];
    const f = match.nav.flowTo(slotKey(sl)) || match.nav.registerField(slotKey(sl), sl.x, sl.z);
    const d = match.nav.distance(f, x, z);
    return d < Infinity ? d / match.rules.speed : 999;
  }

  // ------------------------------------------------------------------ end, report, hash
  function finish(match, winner, reason) {
    const st = match.state;
    if (st.over) return;
    st.over = true; st.winner = winner; st.reason = reason || 'scenario';
    match.over = true; match.winner = winner;
    st.history.push({ t: st.t, score: st.sides.map((s) => s.points), held: st.sides.map((s) => s.holding) });
    const report = buildReport(match);
    match.emit('matchEnd', { winner, reason: st.reason, score: st.sides.map((s) => s.points), report, playerWon: winner >= 0 && winner === st.player });
  }

  const SMALL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
    'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  /** "eleven seconds", "41 seconds", "a minute", "two and a half minutes". */
  function fmtDur(sec) {
    const s = Math.round(sec);
    if (s < 60) return s === 1 ? 'one second' : (s <= 20 ? SMALL[s] : s) + ' seconds';
    const halves = Math.round(sec / 30);
    const whole = Math.floor(halves / 2), half = halves % 2 === 1;
    const w = whole <= 20 ? SMALL[whole] : String(whole);
    if (whole === 1) return half ? 'a minute and a half' : 'a minute';
    return half ? w + ' and a half minutes' : w + ' minutes';
  }
  function fill(str, vars) { return String(str).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)); }
  function capFirst(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  /** "once", "twice", "three times", "21 times". */
  function timesWord(n) { return n === 1 ? 'once' : n === 2 ? 'twice' : (n <= 20 ? SMALL[n] : String(n)) + ' times'; }
  /** A spot's name in the middle of a sentence: "the Fountain", "the Toddler Playground", "Holley Plaza". */
  function spotThe(sp) { return sp ? (sp.the || String(sp.name || '').replace(/^The /, 'the ')) : 'there'; }

  /** Park Report: what actually happened, as data plus a few observation lines (player's crew first). */
  function buildReport(match) {
    const st = match.state;
    const T = (D().report.lines || []).reduce((o, l) => { o[l.id] = l.text; return o; }, {});
    const sec = (ticks) => ticks * DT;
    const sides = st.sides.map((side) => {
      const s = side.stats;
      return {
        side: side.idx, crew: side.crew, name: side.name, points: side.points, isPlayer: side.isPlayer,
        held: st.spots.reduce((o, sp) => { o[sp.id] = Math.round(sec(s.heldTicks[sp.idx])); return o; }, {}),
        argued: st.spots.reduce((o, sp) => { o[sp.id] = Math.round(sec(s.argueTicks[sp.idx])); return o; }, {}),
        coffees: s.coffees, evictions: s.evictions, twoOnOne: s.twoOnOne, withdrawals: s.withdrawals, mutual: s.mutual,
        mutualAt: st.spots.reduce((o, sp) => { if (s.mutualAt[sp.idx]) o[sp.id] = s.mutualAt[sp.idx]; return o; }, {}),
        settles: s.settles, spotsLost: s.spotsLost, maxLead: Math.round(s.maxLead), maxDeficit: Math.round(s.maxDeficit), orders: s.orders,
      };
    });
    const groups = st.groups.map((g) => ({
      id: g.id, side: g.side, name: g.name, coffees: g.stats.coffees, walked: Math.round(g.stats.walked),
      held: Math.round(sec(g.stats.heldTicks)), argued: Math.round(sec(g.stats.argueTicks)), idle: Math.round(sec(g.stats.idleTicks)),
      longest: Math.round(sec(g.stats.best)), longestSpot: g.stats.bestSpot >= 0 ? st.spots[g.stats.bestSpot].name : null,
      longestSpotIdx: g.stats.bestSpot,
    }));
    // observation lines, most interesting first, for the player's crew (or side 0 when AI-vs-AI)
    const me = st.player >= 0 ? st.player : 0;
    const cand = [];
    const ms = sides[me];
    const add = (score, id, vars) => { if (T[id]) cand.push({ score, id, text: capFirst(fill(T[id], vars)) }); };
    for (const sp of st.spots) {
      const h = ms.held[sp.id], a = ms.argued[sp.id];
      if (a >= 20 && a > h) add(30 + a / 10, 'heldVsArgued', { SPOT: spotThe(sp), T: fmtDur(h), T2: fmtDur(a) });
      if (sp.changes >= 4) add(18 + sp.changes, 'changedHands', { SPOT: spotThe(sp), N: sp.changes });
      const anyone = sides.some((x) => x.held[sp.id] > 0);
      if (!anyone && st.t > 60) add(20, 'neverVisited', { SPOT: spotThe(sp) });
    }
    const mine = groups.filter((g) => g.side === me);
    const coffeeKing = mine.slice().sort((a, b) => b.coffees - a.coffees)[0];
    if (coffeeKing && coffeeKing.coffees >= 3) add(22 + coffeeKing.coffees, 'coffeeKing', { GROUP: coffeeKing.name, N: coffeeKing.coffees });
    const calm = mine.filter((g) => g.coffees === 0);
    if (calm.length === 1 && st.t > 120) add(15, 'neverCoffee', { GROUP: calm[0].name });
    const longest = mine.slice().sort((a, b) => b.longest - a.longest)[0];
    if (longest && longest.longest >= 45) add(16 + longest.longest / 20, 'longest', { GROUP: longest.name, SPOT: spotThe(st.spots[longest.longestSpotIdx]), T: fmtDur(longest.longest) });
    // both crews walking out together: named after the spot(s) where it really happened
    if (ms.mutual >= 1) {
      const at = st.spots.filter((sp) => st.sides[me].stats.mutualAt[sp.idx] > 0)
        .sort((a, b) => st.sides[me].stats.mutualAt[b.idx] - st.sides[me].stats.mutualAt[a.idx] || a.idx - b.idx);
      const top = at[0];
      if (ms.mutual === 1 && top) add(17, 'mutualOne', { SPOT: spotThe(top) });
      else if (at.length === 1) add(26, 'mutual', { N: timesWord(ms.mutual), SPOT: spotThe(top) });
      else if (top) add(25, 'mutualSpots', { N: timesWord(ms.mutual), SPOT: spotThe(top), K: timesWord(st.sides[me].stats.mutualAt[top.idx]) });
    }
    if (ms.evictions >= 2) add(14 + ms.evictions, 'evictions', { N: ms.evictions });
    if (ms.twoOnOne >= 2) add(19, 'twoOnOne', { N: ms.twoOnOne });
    if (ms.withdrawals >= 2) add(18, 'withdrawals', { N: ms.withdrawals });
    const walker = mine.slice().sort((a, b) => b.walked - a.walked)[0];
    if (walker && walker.walked > 300) add(10, 'walked', { GROUP: walker.name, N: walker.walked, B: Math.max(1, Math.round(walker.walked / 80)) });
    const idler = mine.slice().sort((a, b) => b.idle - a.idle)[0];
    if (idler && idler.idle >= 30) add(21, 'idle', { GROUP: idler.name, T: fmtDur(idler.idle) });
    if (st.over && st.sides.length === 2) {
      const other = sides[1 - me];
      const gap = Math.abs(ms.points - other.points);
      if (st.winner === -1) add(40, 'draw', {});
      else if (st.winner === me && ms.maxDeficit >= 25) add(35, 'comeback', { N: ms.maxDeficit });
      else if (st.winner !== me && ms.maxLead >= 25) add(34, 'blownLead', { N: ms.maxLead });
      else if (gap <= 5) add(33, 'photoFinish', { N: gap === 1 ? 'a single point' : (SMALL[gap] || gap) + ' points' });
    }
    cand.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
    return {
      winner: st.winner, reason: st.reason, t: st.t, length: match.rules.length, player: st.player,
      score: st.sides.map((s) => s.points), sides, groups,
      spots: st.spots.map((s) => ({ id: s.id, name: s.name, short: s.short, the: s.the, changes: s.changes })),
      lines: cand.slice(0, 4).map((c) => c.text), lineIds: cand.slice(0, 4).map((c) => c.id),
      history: st.history.slice(),
    };
  }

  function stateHash(state) {
    let h = 0x811c9dc5;
    const mix = (v) => { h ^= v | 0; h = Math.imul(h, 0x01000193); };
    const q = (x) => Math.round(x * 1000);
    mix(state.tick);
    for (const g of state.groups) { mix(q(g.x)); mix(q(g.z)); mix(q(g.patience)); mix(g.coffee ? 1 : 0); mix(g.spot); }
    for (const s of state.spots) { mix(s.holder); mix(s.settleSide); mix(q(s.settle)); }
    for (const s of state.sides) mix(s.earnedTicks);
    return h >>> 0;
  }

  /** Re-run a match from cfg applying the external commands of `log` at their ticks (AI regenerates its own). */
  function replay(cfg, log, ticks) {
    const m = create(Object.assign({}, cfg, { quiet: true }));
    const ext = log.filter((e) => e.src !== 'ai');
    let k = 0;
    for (let n = 0; n < ticks && !m.state.over; n++) {
      while (k < ext.length && ext[k].tick <= m.state.tick) { const e = ext[k++]; order.apply(null, [m].concat(e.args)); }
      m.tick();
    }
    return m;
  }

  // ------------------------------------------------------------------ tutorial goals
  /**
   * checkGoal(match, goal) -> { done, progress 0..1, text }. Goals (SQ.data.hangout.scenarios[*].goal):
   *  camera (UI decides) | points {n} | holdCount {count} | take {spot} | recover | win
   */
  function checkGoal(match, goal) {
    const st = match.state, me = st.player >= 0 ? st.player : 0;
    const side = st.sides[me];
    const res = { done: false, progress: 0, text: goal && goal.text || '' };
    if (!goal) return res;
    switch (goal.type) {
      case 'points': res.progress = Math.min(1, side.points / goal.n); res.done = side.points >= goal.n; break;
      case 'holdCount': res.progress = Math.min(1, side.holding / goal.count); res.done = side.holding >= goal.count; break;
      case 'take': {
        const s = st.spots.find((q) => q.id === goal.spot);
        res.done = !!s && s.holder === me;
        res.progress = s ? (s.holder === me ? 1 : s.settleSide === me ? 0.5 + 0.5 * s.settle / match.rules.settleTime : 0) : 0;
        break;
      }
      case 'recover': {
        const w = side.stats.withdrawals > 0, c = side.stats.coffees > 0;
        res.done = (w && side.groups.every((id) => st.groups[id].patience >= match.rules.patienceMax - 1e-6)) ||
          (c && side.groups.every((id) => !st.groups[id].coffee));
        res.progress = w || c ? 0.5 : 0;
        break;
      }
      case 'win': res.done = st.over && st.winner === me; res.progress = st.over ? 1 : st.t / Math.max(1, match.rules.length); break;
      default: break;
    }
    return res;
  }

  SQ.Hangout = {
    DT, TICK_HZ: 20, create, order, firstAt, replay, spotAt, groupAt, inSpot, eta, walkTime, checkGoal, forceCoffee, fmtDur, stateHash, slotKey,
    STATUSES: ['idle', 'walking', 'settling', 'hanging', 'arguing', 'coffee'],
    EVENTS: ['matchStart', 'ordered', 'cmdRejected', 'settleStart', 'settled', 'spotFree', 'earning', 'score', 'argueStart', 'argueEnd',
      'wentForCoffee', 'returned', 'bark', 'clockWarn', 'matchEnd'],
  };
})(window.SQ = window.SQ || {});
