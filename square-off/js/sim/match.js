// SQUARE OFF — match lifecycle: SQ.Match.create(cfg), fixed 20 Hz tick, clock and phases,
// victory, the SQ.cmd command API (validated + logged for replay), state hash, replay.
// Headless. AI / Director / Campaign plug in through SQ.AI / SQ.Director / SQ.Campaign
// (init(match) and tick(match, dt), both optional) and match.systems.
(function (SQ) {
  'use strict';
  const W = SQ.World;
  const UF = W.UF;
  const DT = 0.05;

  function makeStats() {
    return {
      lost: 0, sentHome: 0, recruited: 0, recruitedCls: { crowd: 0, talker: 0, heavy: 0 }, regulars: 0,
      captures: 0, lostLandmarks: 0, earned: 0, spent: 0, built: 0, setupsStolen: 0,
      crewCalls: 0, crewHitsBest: {}, shooed: 0, dosas: 0, heists: 0,
      reasons: {}, lostByCls: { crowd: 0, talker: 0, heavy: 0 }, lostPairs: {}, swayDealt: 0,
      held: {}, longest: { lm: null, t: 0 }, peakIncome: 0, peakLandmarks: 0,
    };
  }

  function pickLandmarks(map, seed) {
    if (!map.pick) return map.landmarks.slice();
    const rng = SQ.util.rngStream(seed, 'map');
    const always = map.always || [];
    const rest = map.landmarks.filter((id) => always.indexOf(id) < 0);
    rng.shuffle(rest);
    const ids = always.concat(rest.slice(0, map.pick - always.length));
    // keep canonical order for stable indices
    return map.landmarks.filter((id) => ids.indexOf(id) >= 0);
  }

  /**
   * Create a match.
   * cfg: { mapId='whole', seed=1, players: [{ faction, ai: false | {personality, difficulty}, assist?, home? }],
   *        missionId?, turfTarget?, startClock?, length?, events?: 'off'|'calm'|'normal'|'chaos'|'scripted',
   *        quiet?: bool (do not forward events to SQ.bus), geo?: GEO, startUnits?: [{cls, n}], modifiers?: {} }
   */
  function create(cfg) {
    cfg = Object.assign({ mapId: 'whole', seed: 1, players: [{ faction: 'hustle', ai: false }, { faction: 'violets', ai: { personality: 'turtle', difficulty: 'regular' } }] }, cfg || {});
    const mission = cfg.missionId ? SQ.data.missionById[cfg.missionId] : null;
    const mr = (mission && mission.rules) || {};
    const mapId = mission ? (cfg.mapIdForced && cfg.mapId ? cfg.mapId : mission.map) : (cfg.mapId || 'whole');
    const map = SQ.data.maps[mapId] || SQ.data.maps.whole;
    const R = SQ.data.matchRules;
    const geo = cfg.geo || (typeof window !== 'undefined' && window.GEO);
    if (!geo) throw new Error('GEO not loaded');
    const nav = SQ.nav.get(geo);
    const seed = cfg.seed >>> 0;

    const rules = {
      turfTarget: cfg.turfTarget || (mission && mission.turfTarget) || map.turfTarget || 1500,
      startClock: cfg.startClock !== undefined ? cfg.startClock : (mission ? mission.startClock || 0 : 0),
      length: cfg.length || (mission && mission.length) || map.length || R.matchLength,
      events: cfg.events || mr.events || 'normal',
      cannotLose: [],
      assist: mr.assist,
      directorNudge: mr.directorNudge,
      noAttacksBefore: mr.noAttacksBefore || 0,
      modifiers: cfg.modifiers || {},
      mission: mission || null,
    };

    const state = {
      t: 0, tick: 0, dt: DT,
      clock: rules.startClock, phaseIdx: SQ.Economy.phaseAt(rules.startClock), phase: 'afternoon', hour: 16,
      length: rules.length, turfTarget: rules.turfTarget, mapId: map.id, missionId: mission ? mission.id : null,
      factions: [], units: W.createUnits(256), hash: W.createHash(),
      landmarks: [], lmById: {}, setups: [], setupById: {}, setupSeq: 1,
      neutrals: [], events: [], zones: [], effects: [], effectSeq: 1, zoneSeq: 0,
      weather: { rain: false }, freezeUntil: 0, hitStop: 0,
      over: false, winner: -1, reason: null, suddenDeath: false, sdEnd: 0,
      history: [], player: -1, nav: nav,
      mods: Object.assign({ regenMult: 1, incomeMult: 1, captureMult: 1, speedMult: 1, crewMult: 1, costMult: 1 }, cfg.modifiers || {}),
    };
    state.phase = SQ.data.phases[state.phaseIdx].id;

    // landmarks (+ homes in use)
    const lmIds = pickLandmarks(map, seed);
    const nPlayers = cfg.players.length;
    const homeIds = cfg.players.map((p, k) => p.home || map.homes[k % map.homes.length]);
    const allIds = lmIds.concat(homeIds.filter((h, k) => homeIds.indexOf(h) === k));
    for (const id of allIds) {
      const d = SQ.data.landmarkById[id];
      const isHome = id.indexOf('home_') === 0;
      let bound = d.r;
      if (d.poly) { bound = 0; for (const p of d.poly) bound = Math.max(bound, Math.hypot(p[0] - d.x, p[1] - d.z)); }
      const lm = {
        idx: state.landmarks.length, id, name: d.name, nick: d.nick || '', x: d.x, z: d.z, r: d.r, poly: d.poly || null, bound: bound + 0.5,
        isHome, owner: -1, prevOwner: -1, meter: 0, capBy: -1, contested: false, capturing: -1, draining: false,
        weights: new Array(nPlayers).fill(0), clout: d.clout || 0, turf: d.turf || 0, cloutRate: 0, turfRate: 0,
        perk: d.perk || null, phase: d.phase || {}, title: d.title, bonusClout: 0, aiBonus: d.aiBonus || 0,
        pads: (d.pads || []).map((p) => ({ x: p[0], z: p[1], setup: -1 })),
        regT: 0, heldSince: 0, attackedT: -99, slotNext: 0, extra: !!d.extra, corner: d.corner || null,
      };
      state.landmarks.push(lm);
      state.lmById[id] = lm;
      nav.registerField('lm:' + id, d.x, d.z);
    }

    // factions
    cfg.players.forEach((p, k) => {
      const fd = SQ.data.factions[p.faction];
      if (!fd) throw new Error('Unknown faction ' + p.faction);
      const ai = p.ai || false;
      const diff = ai && ai.difficulty;
      const incomeMult = diff === 'chill' ? 0.85 : diff === 'legend' ? 1.15 : 1;
      const isPlayer = !ai;
      const fac = {
        idx: k, key: fd.key, name: fd.name, short: fd.short, color: p.color || fd.color, ai, isPlayer,
        home: homeIds[k], rally: homeIds[k], clout: R.startClout, income: 0, turf: 0, turfRate: 0,
        pop: 0, popCap: R.popBase, crew: SQ.data.crew.start, crewRate: 0, queue: [], held: 0, behind: false,
        eliminated: false, incomeMult, assist: p.assist !== undefined ? !!p.assist : (isPlayer && !!rules.assist),
        dosaCD: 0, crewCooldown: 0, recentOver: {}, stats: makeStats(), sightMult: diff === 'legend' ? 1.3 : 1,
      };
      if (mission) {
        if (isPlayer && mr.playerClout !== undefined) fac.clout = mr.playerClout;
        if (isPlayer && mr.playerCrew !== undefined) fac.crew = mr.playerCrew;
        if (!isPlayer && mr.enemyClout !== undefined) fac.clout = mr.enemyClout;
        if (isPlayer && mr.cannotLose) rules.cannotLose.push(k);
      }
      if (isPlayer && state.player < 0) state.player = k;
      state.factions.push(fac);
      const home = state.lmById[fac.home];
      home.owner = k; home.meter = 100;
    });

    // starting units
    state.factions.forEach((fac, k) => {
      const p = cfg.players[k];
      const home = state.lmById[fac.home];
      let start = p.startUnits || cfg.startUnits || null;
      if (!start && mission) start = fac.isPlayer ? mr.playerStart : null;
      if (!start) start = [{ cls: 'crowd', n: 2 }, { cls: 'talker', n: 1 }];
      const idxs = [];
      for (const s of start) {
        const t = SQ.data.units[fac.key][s.cls];
        for (let r = 0; r < s.n; r++) {
          for (let b = 0; b < t.perRecruit; b++) {
            const slot = SQ.Movement.landmarkSlot(state, home, (home.slotNext = (home.slotNext + 1) % 48));
            idxs.push(W.spawnUnit(state, k, t.key, slot.x, slot.z, { squad: 1 }));
          }
        }
      }
      for (const i of idxs) { state.units.ax[i] = state.units.x[i]; state.units.az[i] = state.units.z[i]; }
      // mission enemy placements
      if (mission && !fac.isPlayer && mr.enemyStart) {
        for (const s of mr.enemyStart) {
          const lm = state.lmById[s.lm];
          if (!lm) continue;
          const ii = [];
          for (let r = 0; r < s.n; r++) {
            const slot = SQ.Movement.landmarkSlot(state, lm, (lm.slotNext = (lm.slotNext + 1) % 48));
            ii.push(W.spawnUnit(state, k, fac.key + '.' + s.cls, slot.x, slot.z, { squad: 1 }));
          }
          SQ.Movement.applyOrder(state, ii, { type: 'take', lm: lm.idx });
        }
      }
    });

    // static neutral sites
    const D = SQ.data.sites.dosa;
    state.neutrals.push({ id: 'dosa', kind: 'dosa', x: D.x, z: D.z, px: D.x, pz: D.z, static: true });
    state.neutrals.push({ id: 'parkHouse', kind: 'parkHouse', x: SQ.data.sites.parkHouse.x, z: SQ.data.sites.parkHouse.z, static: true });

    W.rebuildHash(state);

    const match = {
      cfg, seed, rules, state, nav, mission,
      rng: SQ.util.rngStream(seed, 'sim'),
      bus: SQ.util.createBus(),
      log: [],
      systems: [],
      over: false, winner: -1,
      _inTick: false,
      tick(dt) { return tickMatch(match, dt); },
      emit(name, payload) {
        match.bus.emit(name, payload);
        if (!cfg.quiet && SQ.bus) SQ.bus.emit(name, payload);
      },
      addClout(f, amount, reason, x, z) {
        const fac = state.factions[f];
        if (!fac) return;
        fac.clout = Math.max(0, fac.clout + amount);
        if (amount > 0) fac.stats.earned += amount;
        match.emit('clout', { faction: f, amount, reason, x, z });
      },
      finish(winner, reason) { finish(match, winner, reason); },
      hash() { return stateHash(state); },
      summary() { return summary(match); },
    };
    state.match = undefined; // never store a back-reference in state (keeps it serialisable)

    // plug-ins
    if (SQ.AI && typeof SQ.AI.init === 'function') try { SQ.AI.init(match); } catch (e) { report(e); }
    if (SQ.Director && typeof SQ.Director.init === 'function') try { SQ.Director.init(match); } catch (e) { report(e); }
    if (SQ.Campaign && typeof SQ.Campaign.init === 'function' && mission) try { SQ.Campaign.init(match); } catch (e) { report(e); }
    match.emit('matchStart', { mapId: map.id, missionId: state.missionId, factions: state.factions.map((f) => f.key), player: state.player });
    return match;
  }

  function report(e) { if (typeof console !== 'undefined') console.error('[match plug-in]', e); }

  function tickMatch(match, dt) {
    const state = match.state;
    if (state.over) return;
    dt = DT; // fixed step; callers accumulate real time
    state.t = Math.round((state.t + dt) * 1e6) / 1e6;
    state.tick++;
    state.hitStop = 0;
    if (!state.suddenDeath) state.clock = Math.min(state.length, state.clock + dt);
    updatePhase(match);

    match._inTick = true;
    try {
      if (SQ.Campaign && typeof SQ.Campaign.tick === 'function' && match.mission) SQ.Campaign.tick(match, dt);
      if (SQ.Director && typeof SQ.Director.tick === 'function') SQ.Director.tick(match, dt);
      if (SQ.AI && typeof SQ.AI.tick === 'function' && match.cfg.ai !== false) SQ.AI.tick(match, dt);
      for (const sys of match.systems) sys(match, dt);
    } finally { match._inTick = false; }

    SQ.Abilities.prepass(match, dt);
    SQ.Movement.tick(match, dt);
    W.rebuildHash(state);
    SQ.Combat.tick(match, dt);
    SQ.Abilities.zoneDamage(match, dt);
    SQ.Abilities.effectsTick(match, dt);
    SQ.Capture.tick(match, dt);
    SQ.Economy.tick(match, dt);
    if (state.tick % 20 === 0) assist(match);
    cleanup(match);
    W.rebuildHash(state);
    // stats
    for (const fac of state.factions) {
      if (fac.income > fac.stats.peakIncome) fac.stats.peakIncome = fac.income;
      if (fac.held > fac.stats.peakLandmarks) fac.stats.peakLandmarks = fac.held;
    }
    if (state.tick % Math.round(SQ.data.matchRules.historyEvery / DT) === 0) {
      state.history.push({ t: state.t, clock: state.clock, turf: state.factions.map((f) => Math.round(f.turf)), held: state.factions.map((f) => f.held) });
    }
    checkVictory(match);
  }

  function updatePhase(match) {
    const state = match.state;
    const P = SQ.data.phases;
    const idx = SQ.Economy.phaseAt(state.clock);
    state.hour = SQ.data.matchRules.startHour + state.clock / SQ.data.matchRules.matchLength * SQ.data.matchRules.hoursPerMatch;
    if (idx !== state.phaseIdx) {
      state.phaseIdx = idx;
      state.phase = P[idx].id;
      match.emit('phase', { phase: state.phase, idx, name: P[idx].name });
    }
    const next = P[idx + 1];
    if (next && !state['warned_' + next.id] && state.clock >= next.start - SQ.data.matchRules.phaseWarn) {
      state['warned_' + next.id] = true;
      match.emit('phaseWarn', { phase: next.id, name: next.name, in: Math.max(0, next.start - state.clock) });
    }
    if (!state.warnedClose && state.clock >= state.length - 60 && state.length - state.clock > 0 && state.length <= 600) {
      state.warnedClose = true;
      match.emit('announce', { text: SQ.data.text.announcer.closingSoon, kind: 'closingSoon' });
    }
  }

  // Assist mode: idle squads auto-defend contested owned landmarks within 60 m.
  function assist(match) {
    const state = match.state, u = state.units;
    for (const fac of state.factions) {
      if (!fac.assist || fac.eliminated) continue;
      for (const lm of state.landmarks) {
        if (lm.isHome || lm.owner !== fac.idx) continue;
        if (!(lm.contested || lm.draining)) continue;
        const idle = [];
        for (let i = 0; i < u.n; i++) {
          if (u.faction[i] !== fac.idx || (u.flags[i] & (UF.OVERIT | UF.REGULAR | UF.COMBAT | UF.HOLD))) continue;
          const o = u.order[i];
          if (o) {
            if (!o.arrived) continue;                       // busy with an order
            if (o.type === 'take') {
              if (o.lm === lm.idx) continue;                // already defending here
              const g = state.landmarks[o.lm];
              if (g && (g.contested || g.draining)) continue; // its own post is under attack
            }
          }
          const dx = u.x[i] - lm.x, dz = u.z[i] - lm.z;
          if (dx * dx + dz * dz <= 60 * 60) idle.push(i);
        }
        if (idle.length) {
          SQ.Movement.applyOrder(state, idle, { type: 'take', lm: lm.idx });
          match.emit('assist', { faction: fac.idx, lm: lm.id, n: idle.length });
        }
      }
    }
  }

  function cleanup(match) {
    const state = match.state, u = state.units;
    for (let i = u.n - 1; i >= 0; i--) {
      if ((u.flags[i] & UF.OVERIT) && u.fade[i] >= 1) {
        match.emit('removed', { unit: u.id[i], faction: u.faction[i] });
        W.removeUnit(state, i);
      }
    }
    if (state.neutrals.some((n) => n.dead)) state.neutrals = state.neutrals.filter((n) => !n.dead);
    if (state.events.length > 40) state.events = state.events.filter((e) => e.state !== 'done').concat(state.events.filter((e) => e.state === 'done').slice(-10));
  }

  function aliveUnits(state, f) {
    const u = state.units;
    let n = 0;
    for (let i = 0; i < u.n; i++) if (u.faction[i] === f && !(u.flags[i] & UF.OVERIT)) n++;
    return n;
  }

  function checkVictory(match) {
    const state = match.state;
    if (state.over) return;
    const rules = match.rules;
    const F = state.factions;
    // elimination
    for (const fac of F) {
      if (fac.eliminated) continue;
      if (rules.cannotLose.indexOf(fac.idx) >= 0) continue;
      if (fac.held === 0 && fac.queue.length === 0 && fac.clout < SQ.data.matchRules.eliminationClout && aliveUnits(state, fac.idx) === 0) {
        fac.eliminated = true;
        match.emit('eliminated', { faction: fac.idx });
      }
    }
    const alive = F.filter((f) => !f.eliminated);
    if (alive.length === 1 && F.length > 1) return finish(match, alive[0].idx, 'elimination');
    if (alive.length === 0) return finish(match, -1, 'elimination');
    // mission-specific wins are owned by SQ.Campaign; fall back to a basic check when it is absent
    if (match.mission && !(SQ.Campaign && typeof SQ.Campaign.tick === 'function')) fallbackMissionWin(match);
    if (state.over) return;
    const canWin = (f) => !(match.mission && match.mission.rules && match.mission.rules.cannotLose && !f.isPlayer);
    // turf target
    let best = null;
    for (const f of alive) if (f.turf >= state.turfTarget && canWin(f) && (!best || f.turf > best.turf)) best = f;
    if (best) return finish(match, best.idx, 'turf');
    // sudden death
    if (state.suddenDeath) {
      if (state.t >= state.sdEnd) {
        const ft = state.lmById.fountain;
        if (ft && ft.owner >= 0 && state.sdTied.indexOf(ft.owner) >= 0) return finish(match, ft.owner, 'suddenDeath');
        const tied = state.sdTied.map((k) => F[k]).sort((a, b) => b.held - a.held || b.clout - a.clout || a.idx - b.idx);
        return finish(match, tied[0].idx, 'suddenDeath');
      }
      return;
    }
    // park closes
    if (state.clock >= state.length) {
      const cands = alive.filter(canWin);
      if (!cands.length) return;
      const top = Math.max(...cands.map((f) => Math.floor(f.turf)));
      const tied = cands.filter((f) => Math.floor(f.turf) === top);
      if (tied.length === 1) return finish(match, tied[0].idx, 'clock');
      state.suddenDeath = true;
      state.sdEnd = state.t + SQ.data.matchRules.suddenDeath;
      state.sdTied = tied.map((f) => f.idx);
      match.emit('suddenDeath', { factions: state.sdTied, until: state.sdEnd });
      match.emit('announce', { text: SQ.data.text.announcer.suddenDeath, kind: 'suddenDeath' });
    }
  }

  function fallbackMissionWin(match) {
    const state = match.state;
    const win = match.mission.win || { type: 'turf' };
    const p = state.factions[state.player];
    if (!p) return;
    if (win.type === 'hold' && p.held >= win.count) finish(match, p.idx, 'mission');
    else if (win.type === 'holdTime') {
      const held = p.stats.held[win.lm] || 0;
      if (held >= win.seconds) finish(match, p.idx, 'mission');
    }
  }

  function summary(match) {
    const state = match.state;
    return {
      t: state.t, clock: state.clock, winner: state.winner, reason: state.reason, mapId: state.mapId, missionId: state.missionId,
      player: state.player,
      factions: state.factions.map((f) => ({
        idx: f.idx, key: f.key, name: f.name, color: f.color, ai: f.ai, isPlayer: f.isPlayer,
        turf: Math.round(f.turf), clout: Math.round(f.clout), held: f.held, eliminated: f.eliminated, stats: f.stats,
      })),
      history: state.history.slice(),
    };
  }

  function finish(match, winner, reason) {
    const state = match.state;
    if (state.over) return;
    state.over = true;
    state.winner = winner;
    state.reason = reason;
    match.over = true;
    match.winner = winner;
    state.history.push({ t: state.t, clock: state.clock, turf: state.factions.map((f) => Math.round(f.turf)), held: state.factions.map((f) => f.held) });
    const stats = summary(match);
    match.emit('victory', { winner, reason, stats, playerWon: winner >= 0 && winner === state.player });
  }

  /** Deterministic 32-bit hash of the simulation state. */
  function stateHash(state) {
    let h = 0x811c9dc5;
    const mix = (v) => { h ^= v | 0; h = Math.imul(h, 0x01000193); };
    const q = (x) => Math.round(x * 1000);
    mix(state.tick);
    const u = state.units;
    mix(u.n);
    for (let i = 0; i < u.n; i++) {
      mix(u.id[i]); mix(q(u.x[i])); mix(q(u.z[i])); mix(q(u.hp[i])); mix(u.faction[i]); mix(u.flags[i]); mix(u.target[i]);
    }
    for (const f of state.factions) { mix(q(f.clout)); mix(q(f.turf)); mix(q(f.crew)); mix(f.queue.length); }
    for (const lm of state.landmarks) { mix(lm.owner); mix(q(lm.meter)); mix(lm.capBy); }
    mix(state.setups.length);
    return h >>> 0;
  }

  // ------------------------------------------------------------ commands
  function logCmd(match, name, args) {
    match.log.push({ tick: match.state.tick, name, args: JSON.parse(JSON.stringify(args)), src: match._inTick ? 'ai' : 'ext' });
  }
  function reject(match, f, name, reason) {
    match.emit('cmdRejected', { faction: f, cmd: name, reason });
    return { ok: false, reason };
  }
  function facOk(match, f) {
    const s = match.state;
    return !s.over && Number.isInteger(f) && f >= 0 && f < s.factions.length && !s.factions[f].eliminated;
  }
  function ownUnits(match, f, unitIds) {
    const s = match.state, u = s.units;
    const out = [];
    for (const id of unitIds || []) {
      const i = W.unitIndex(s, id);
      if (i >= 0 && u.faction[i] === f && !(u.flags[i] & UF.OVERIT)) out.push(i);
    }
    return out;
  }

  const cmd = {
    /** order(match, f, unitIds, {type:'move'|'attackMove'|'take'|'attack'|'stop'|'hold', x, z, targetId, lm, queue}) */
    order(match, f, unitIds, o) {
      if (!facOk(match, f)) return reject(match, f, 'order', 'faction');
      o = o || {};
      const s = match.state;
      const idxs = ownUnits(match, f, unitIds);
      if (!idxs.length) return reject(match, f, 'order', 'units');
      const type = o.type || 'attackMove';
      const ord = { type, queue: !!o.queue };
      if (type === 'take') {
        const lmi = W.landmarkIndex(s, o.lm !== undefined ? o.lm : o.targetId);
        if (lmi < 0) return reject(match, f, 'order', 'landmark');
        ord.lm = lmi;
      } else if (type === 'attack') {
        const j = W.unitIndex(s, o.targetId);
        if (j < 0 || s.units.faction[j] === f || (s.units.flags[j] & UF.OVERIT)) return reject(match, f, 'order', 'target');
        ord.targetId = o.targetId;
      } else if (type === 'move' || type === 'attackMove') {
        if (!isFinite(o.x) || !isFinite(o.z)) return reject(match, f, 'order', 'point');
        const p = s.nav.nearestWalkable(+o.x, +o.z, 25);
        if (!p) return reject(match, f, 'order', 'unreachable');
        ord.x = p.x === +o.x ? +o.x : p.x; ord.z = p.z === +o.z ? +o.z : p.z;
      } else if (type !== 'stop' && type !== 'hold') return reject(match, f, 'order', 'type');
      logCmd(match, 'order', [f, unitIds, o]);
      SQ.Movement.applyOrder(s, idxs, ord);
      match.emit('ordered', { faction: f, type, n: idxs.length, x: ord.x, z: ord.z, lm: ord.lm !== undefined ? s.landmarks[ord.lm].id : undefined, targetId: ord.targetId });
      return { ok: true, n: idxs.length };
    },
    recruit(match, f, cls) {
      if (!facOk(match, f)) return reject(match, f, 'recruit', 'faction');
      const chk = SQ.Economy.canRecruit(match.state, f, cls);
      if (!chk.ok) return reject(match, f, 'recruit', chk.reason);
      logCmd(match, 'recruit', [f, cls]);
      return SQ.Economy.recruit(match, f, cls);
    },
    setRally(match, f, landmarkId) {
      if (!facOk(match, f)) return reject(match, f, 'setRally', 'faction');
      const s = match.state;
      const lmi = W.landmarkIndex(s, landmarkId);
      if (lmi < 0) return reject(match, f, 'setRally', 'landmark');
      const lm = s.landmarks[lmi];
      if (!SQ.Economy.canRally(s, f, lm.id)) return reject(match, f, 'setRally', 'notAllowed');
      logCmd(match, 'setRally', [f, landmarkId]);
      s.factions[f].rally = lm.id;
      match.emit('rally', { faction: f, lm: lm.id, x: lm.x, z: lm.z });
      return { ok: true };
    },
    build(match, f, landmarkId, padIdx, setupId) {
      if (!facOk(match, f)) return reject(match, f, 'build', 'faction');
      const s = match.state;
      const lmi = W.landmarkIndex(s, landmarkId);
      if (lmi < 0) return reject(match, f, 'build', 'landmark');
      const before = match.log.length;
      const res = SQ.Economy.build(match, f, s.landmarks[lmi].id, padIdx, setupId);
      if (!res.ok) return reject(match, f, 'build', res.reason);
      match.log.splice(before, 0, { tick: s.tick, name: 'build', args: [f, landmarkId, padIdx, setupId], src: match._inTick ? 'ai' : 'ext' });
      return res;
    },
    crewCall(match, f, p) {
      if (!facOk(match, f)) return reject(match, f, 'crewCall', 'faction');
      const chk = SQ.Abilities.canCrewCall(match.state, f);
      if (!chk.ok) return reject(match, f, 'crewCall', chk.reason);
      const before = match.log.length;
      const res = SQ.Abilities.crewCall(match, f, p || {});
      if (!res.ok) return reject(match, f, 'crewCall', res.reason);
      match.log.splice(before, 0, { tick: match.state.tick, name: 'crewCall', args: JSON.parse(JSON.stringify([f, p || {}])), src: match._inTick ? 'ai' : 'ext' });
      return res;
    },
    squad(match, f, unitIds, squadIdx) {
      if (!facOk(match, f)) return reject(match, f, 'squad', 'faction');
      const sq = squadIdx | 0;
      if (sq < 0 || sq > 5) return reject(match, f, 'squad', 'squad');
      const idxs = ownUnits(match, f, unitIds);
      if (!idxs.length) return reject(match, f, 'squad', 'units');
      logCmd(match, 'squad', [f, unitIds, squadIdx]);
      const u = match.state.units;
      for (const i of idxs) { u.squad[i] = sq; u.flags[i] &= ~UF.REGULAR; u.lm[i] = -1; }
      match.emit('squad', { faction: f, squad: sq, n: idxs.length });
      return { ok: true, n: idxs.length };
    },
    shoo(match, f, neutralId) {
      if (!facOk(match, f)) return reject(match, f, 'shoo', 'faction');
      const res = SQ.Abilities.shoo(match, f, neutralId);
      if (!res.ok) return reject(match, f, 'shoo', res.reason);
      match.log.push({ tick: match.state.tick, name: 'shoo', args: [f, neutralId], src: match._inTick ? 'ai' : 'ext' });
      return res;
    },
    buyDosa(match, f) {
      if (!facOk(match, f)) return reject(match, f, 'buyDosa', 'faction');
      const res = SQ.Abilities.buyDosa(match, f);
      if (!res.ok) return reject(match, f, 'buyDosa', res.reason);
      match.log.push({ tick: match.state.tick, name: 'buyDosa', args: [f], src: match._inTick ? 'ai' : 'ext' });
      return res;
    },
  };

  /**
   * Replay: re-create a match from cfg and apply the external ('ext') commands of `log` at their ticks.
   * AI/director commands are regenerated by the deterministic AI itself. Returns the match after `ticks`.
   */
  function replay(cfg, log, ticks) {
    const m = create(Object.assign({}, cfg, { quiet: true }));
    const ext = log.filter((e) => e.src !== 'ai');
    let k = 0;
    for (let n = 0; n < ticks && !m.state.over; n++) {
      while (k < ext.length && ext[k].tick <= m.state.tick) {
        const e = ext[k++];
        cmd[e.name].apply(null, [m].concat(e.args));
      }
      m.tick(DT);
    }
    return m;
  }

  /** Units of faction f as indices (helper for AI/UI). */
  function unitsOf(state, f, filter) {
    const u = state.units, out = [];
    for (let i = 0; i < u.n; i++) {
      if (u.faction[i] !== f || (u.flags[i] & UF.OVERIT)) continue;
      if (filter && !filter(i)) continue;
      out.push(i);
    }
    return out;
  }

  SQ.Match = { create, replay, DT, TICK_HZ: 20, stateHash, unitsOf, finish };
  SQ.cmd = cmd;
})(window.SQ = window.SQ || {});
