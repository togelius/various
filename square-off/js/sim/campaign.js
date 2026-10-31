// SQUARE OFF — campaign runtime "One Day in the Square" (DESIGN §8). Runs the declarative missions in
// js/data/missions.js: tutorial beats (emitted as 'hint' events with resolved targets for js/ui/tutorial.js),
// mission win conditions, stars, context tips, the Mission 1 safety net. Headless; no DOM, no storage.
//
// Public:
//   SQ.Campaign.init(match) / SQ.Campaign.tick(match, dt)     (called by match.js when cfg.missionId is set)
//   SQ.Campaign.matchConfig(missionId, {pick, seed, chill, assist}) -> SQ.Match.create cfg for that mission
//   SQ.Campaign.status(match) -> {missionId, n, title, objective, progress:{value,max,text}, stars:[{id,text,done}], hint}
//   SQ.Campaign.result(match) -> {missionId, won, stars:[bool,bool,bool], count, t, unlock, next} | null (before the end)
//   SQ.Campaign.notify(match, what, data)  UI -> campaign signals: 'selected' (player selected units), 'hintSeen'
//   SQ.Campaign.missions() -> SQ.data.missions;  next(missionId) -> id|null;  shouldOfferChill(losses) -> bool
//   SQ.Campaign.stepDown(difficulty) -> one difficulty easier ("Chill it down?")
// Emits:
//   'hint'       {id, text, target, mission, step, total, pulse?, ttl?, comic?, camera?, tip?}
//                target: {lm, x, z, r} | {ui:'recruit.crowd'|'crew'|...} | {unitCls, unit, x, z} | {neutral, x, z} | {x, z} | null
//                text null = clear the current hint.
//   'missionEnd' {missionId, won, stars:[3 bools], count, starTexts[], t, unlock, next, reason}
(function (SQ) {
  'use strict';
  const UF = SQ.C.UF;
  const runs = new WeakMap();
  const DIFF_ORDER = ['chill', 'regular', 'hard', 'legend'];

  // ------------------------------------------------------------------ config builder
  function stepDown(diff) {
    const k = DIFF_ORDER.indexOf(diff);
    return DIFF_ORDER[Math.max(0, k - 1)] || 'chill';
  }

  /** Build the SQ.Match.create cfg for a mission. opts: {pick (crew for 'pick' missions), seed, chill, assist}. */
  function matchConfig(missionId, opts) {
    opts = opts || {};
    const M = SQ.data.missionById[missionId];
    if (!M) throw new Error('Unknown mission ' + missionId);
    const seed = (opts.seed === undefined ? SQ.util.hash('mission:' + missionId) : opts.seed) >>> 0;
    const playable = SQ.data.factionOrder.slice();
    const player = M.player === 'pick' ? (playable.indexOf(opts.pick) >= 0 ? opts.pick : 'hustle') : M.player;
    const used = [player];
    const rng = SQ.util.rngStream(seed, 'campaign-cfg');
    const players = [{ faction: player, ai: false, assist: opts.assist !== undefined ? !!opts.assist : (opts.chill ? true : undefined) }];
    for (const o of M.opponents) {
      let f = o.faction;
      if (f === 'pick') {
        const left = playable.filter((k) => used.indexOf(k) < 0);
        f = left[rng.int(left.length)] || 'violets';
      }
      used.push(f);
      players.push({ faction: f, ai: { personality: o.personality, difficulty: opts.chill ? stepDown(o.difficulty) : o.difficulty } });
    }
    if (players[0].assist === undefined) delete players[0].assist;
    return { missionId, mapId: M.map, seed, players, events: (M.rules && M.rules.events) || 'normal' };
  }

  // ------------------------------------------------------------------ init
  function init(match) {
    const M = match.mission;
    if (!M) return;
    const st = match.state;
    const r = {
      M, fired: {}, firedAt: {}, fireCount: {}, recruited: { crowd: 0, talker: 0, heavy: 0, any: 0 }, events: {},
      crewUsed: false, selected: false, lastOrderT: 0, lostFight: false, lossLog: [], lostLm: {}, everOwned: {},
      capturedWithSetup: false, pairSeen: {}, current: null, currentAt: 0, lastPulse: 0, ended: false, result: null, safetyT: 0,
      step: 0, total: M.beats.filter((b) => b.target).length,
      enemy: st.factions.findIndex((f) => f.idx !== st.player),
    };
    runs.set(match, r);
    // landmarks the lesson isn't ready for yet: nobody captures them until a beat unlocks them
    for (const id of (M.rules && M.rules.locked) || []) { const L = st.lmById[id]; if (L) L.locked = true; }
    const P = st.player;
    const bus = match.bus;
    bus.on('recruited', (p) => { if (p.faction === P) { r.recruited[p.cls] = (r.recruited[p.cls] || 0) + 1; r.recruited.any++; } });
    bus.on('crewCall', (p) => { if (p.faction === P) r.crewUsed = true; });
    bus.on('eventStart', (p) => { r.events[p.kind] = true; });
    bus.on('ordered', (p) => { if (p.faction === P) { r.selected = true; r.lastOrderT = st.t; } });
    bus.on('capture', (p) => {
      if (p.to === P) {
        r.everOwned[p.lm] = true;
        const check = starCheck(M);
        if (check && check.type === 'captureWithSetup' && (p.setups || []).some((s) => s.kind === check.setup && (!check.enemy || (s.from >= 0 && s.from !== P)))) r.capturedWithSetup = true;
      }
    });
    bus.on('neutral', (p) => { if (p.from === P) r.lostLm[p.lm] = true; });
    bus.on('overIt', (p) => {
      if (p.faction !== P || p.by === P || p.by < 0) return;
      // lost to its counter (● to ■, ▲ to ●, ■ to ▲)? Combat logs it in stats.lostPairs before emitting.
      const weakTo = SQ.data.weakTo[p.cls];
      const key = p.cls + '<' + weakTo;
      const n = (st.factions[P].stats.lostPairs || {})[key] || 0;
      const countered = n > (r.pairSeen[key] || 0);
      r.pairSeen[key] = n;
      if (!countered) return;
      r.lossLog.push({ t: st.t, cls: p.cls });
      while (r.lossLog.length && st.t - r.lossLog[0].t > 12) r.lossLog.shift();
      if (r.lossLog.length >= 3) { r.lostFight = true; r.lostCls = p.cls; r.lostTo = weakTo; r.lossLog.length = 0; }
    });
    bus.on('victory', (p) => { onVictory(match, r, p); });
    // initial ownership counts as "ever owned" (neverLose checks)
    for (const L of st.landmarks) if (L.owner === P) r.everOwned[L.id] = true;
  }

  function starCheck(M) {
    const b = (M.stars || []).find((s) => s.id === 'bonus');
    return b && b.check ? b.check : null;
  }

  // ------------------------------------------------------------------ tick
  function tick(match, dt) {
    const r = runs.get(match);
    if (!r || r.ended) return;
    const st = match.state;
    if (st.over) return;
    const P = st.player;
    const pf = st.factions[P];
    if (!pf) return;
    for (const L of st.landmarks) if (L.owner === P) r.everOwned[L.id] = true;
    // beats
    for (const b of r.M.beats) {
      const max = b.repeat || 1;
      if ((r.fireCount[b.id] || 0) >= max) continue;
      if (b.requires && !r.fired[b.requires]) continue;
      if (!cond(match, r, b.when)) continue;
      if (b.when.lostFight) r.lostFight = false;
      fire(match, r, b);
    }
    // idle re-pulse: the current hint has a target and the player hasn't done anything for 8 s
    if (r.current && r.current.target && st.t - r.currentAt >= 8 && st.t - r.lastOrderT >= 8 && st.t - r.lastPulse >= 8) {
      r.lastPulse = st.t;
      match.emit('hint', Object.assign({}, r.current, { pulse: true, target: resolveTarget(match, r, r.current.rawTarget) }));
    }
    // Mission 1 safety net: you can't run out of dogs
    if (match.rules.cannotLose.indexOf(P) >= 0 && st.t - r.safetyT > 10) {
      r.safetyT = st.t;
      const mine = SQ.Match.unitsOf(st, P).length;
      if (!mine && !pf.queue.length) {
        spawnAt(match, P, 'crowd', 2, st.lmById[pf.home]);
        match.emit('hint', { id: 'safety', text: 'Two more dogs showed up. Dogs always show up.', target: null, mission: r.M.id, tip: true, ttl: 4 });
      }
      if (pf.clout < 40) pf.clout = 40;
    }
    checkWin(match, r);
    void dt;
  }

  function cond(match, r, w) {
    const st = match.state;
    const P = st.player;
    const pf = st.factions[P];
    if (!w) return false;
    if (w.start) return st.t >= 0.3;
    if (w.after) return !!r.fired[w.after] && st.t >= r.firedAt[w.after] + (w.delay || 0);
    if (w.captured) { const L = st.lmById[w.captured]; return !!L && L.owner === P; }
    if (w.owns) return pf.held >= w.owns;
    if (w.recruited) return (r.recruited[w.recruited] || 0) > 0;
    if (w.crewReady) return pf.crew >= SQ.data.crew.max;
    if (w.crewUsed) return r.crewUsed;
    if (w.time !== undefined) return st.t >= w.time;
    if (w.eventStart) return !!r.events[w.eventStart];
    if (w.selected) return r.selected;
    if (w.lostFight) return r.lostFight;
    if (w.idle) return st.t - r.lastOrderT >= w.idle;
    return false;
  }

  function fire(match, r, b) {
    const st = match.state;
    r.fired[b.id] = true;
    r.firedAt[b.id] = st.t;
    r.fireCount[b.id] = (r.fireCount[b.id] || 0) + 1;
    if (b.action) doAction(match, r, b.action, b);
    if (!b.hint) return;
    const tip = !!(b.once || b.repeat || b.tip);
    if (b.target && !tip) r.step++;
    const G = SQ.C.GLYPH;
    const lost = r.lostCls || 'crowd', weak = r.lostTo || SQ.data.weakTo[lost];
    const text = SQ.data.text.fill(b.hint, { LOST: G[lost], WEAK: G[weak], BEATS: G[SQ.data.weakTo[weak]] });
    const p = {
      id: b.id, text, target: resolveTarget(match, r, b.target), rawTarget: b.target || null,
      mission: r.M.id, step: r.step, total: r.total,
    };
    if (tip) { p.tip = true; p.ttl = 4; }
    if (b.action && b.action.comic) p.comic = b.action.comic;
    if (b.action && b.action.camera) {
      p.camera = b.action.camera;
      if (!p.target && b.action.camera === 'lm' && b.when && b.when.captured) p.cameraTarget = resolveTarget(match, r, { lm: b.when.captured });
    }
    if (!tip) { r.current = p; r.currentAt = st.t; r.lastPulse = st.t; }
    const out = Object.assign({}, p);
    delete out.rawTarget;
    match.emit('hint', out);
  }

  function resolveTarget(match, r, t) {
    if (!t) return null;
    const st = match.state, u = st.units;
    if (t.lm) {
      const L = st.lmById[t.lm];
      return L ? { lm: L.id, x: L.x, z: L.z, r: L.r, name: L.name } : { lm: t.lm };
    }
    if (t.ui === 'recruit.counter') {
      const weak = r.lostTo || 'heavy';
      return { ui: 'recruit.' + SQ.data.weakTo[weak], cls: SQ.data.weakTo[weak] };
    }
    if (t.ui) return { ui: t.ui };
    if (t.unitCls) {
      const c = SQ.C.CLASS_IDX[t.unitCls];
      for (let i = 0; i < u.n; i++) {
        if (u.faction[i] === st.player && u.cls[i] === c && !(u.flags[i] & UF.OVERIT)) return { unitCls: t.unitCls, unit: u.id[i], x: u.x[i], z: u.z[i] };
      }
      return { unitCls: t.unitCls };
    }
    if (t.neutral) {
      const n = st.neutrals.find((q) => q.kind === t.neutral && !q.dead);
      return n ? { neutral: n.id, kind: n.kind, x: n.x, z: n.z } : { neutral: null, kind: t.neutral };
    }
    if (isFinite(t.x) && isFinite(t.z)) return { x: t.x, z: t.z };
    return null;
  }

  function doAction(match, r, a, b) {
    const st = match.state;
    const P = st.player;
    const pf = st.factions[P];
    if (a.grantCrew !== undefined) {
      // set just under full so the economy fires its own 'crewReady' next tick
      const v = Math.min(SQ.data.crew.max, a.grantCrew);
      pf.crew = v >= SQ.data.crew.max ? SQ.data.crew.max - 1e-3 : Math.max(pf.crew, v);
    }
    if (a.spawn) {
      const s = a.spawn;
      const f = s.faction === 'player' ? P : (s.factionIdx !== undefined ? s.factionIdx : r.enemy);
      const L = st.lmById[s.lm] || null;
      if (f >= 0 && L) spawnAt(match, f, s.cls || 'crowd', s.n || 1, L, s.from, true);
    }
    if (a.unlock) { const L = st.lmById[a.unlock]; if (L) L.locked = false; }
    if (a.event && SQ.Director && SQ.Director.trigger) SQ.Director.trigger(match, a.event, { lm: a.lm, warn: a.warn });
    void b;
  }

  /** Spawn n units (bodies for squirrels, recruits otherwise) for faction f and send them to landmark L. */
  function spawnAt(match, f, cls, n, L, from, take) {
    const st = match.state;
    const fac = st.factions[f];
    const t = SQ.data.units[fac.key] && SQ.data.units[fac.key][cls];
    if (!t || !L) return [];
    const idxs = [];
    for (let k = 0; k < n; k++) {
      let x, z;
      if (from) { x = from.x + (k % 3) * 1.4; z = from.z + Math.floor(k / 3) * 1.4; }
      else { const slot = SQ.Movement.landmarkSlot(st, L, (L.slotNext = ((L.slotNext || 0) + 1) % 48)); x = slot.x; z = slot.z; }
      idxs.push(SQ.World.spawnUnit(st, f, t.key, x, z, { squad: f === st.player ? 0 : 1 }));
    }
    if (take !== false && !L.isHome) SQ.Movement.applyOrder(st, idxs, { type: 'take', lm: L.idx });
    SQ.World.rebuildHash(st);
    return idxs;
  }

  // ------------------------------------------------------------------ win / stars
  function checkWin(match, r) {
    const st = match.state;
    const P = st.player;
    const pf = st.factions[P];
    const w = r.M.win || { type: 'turf' };
    if (w.requires && !r.fired[w.requires]) return;
    if (w.type === 'hold' && pf.held >= w.count) match.finish(P, 'mission');
    else if (w.type === 'holdTime' && (pf.stats.held[w.lm] || 0) >= w.seconds) match.finish(P, 'mission');
    else if (w.type === 'survive' && st.clock >= st.length) match.finish(P, 'mission');
  }

  function bonusDone(match, r) {
    const st = match.state;
    const P = st.player;
    const pf = st.factions[P];
    const c = starCheck(r.M);
    if (!c) return false;
    switch (c.type) {
      case 'shoo': return (pf.stats.shooed || 0) >= c.count;
      case 'neverLose': return !!r.everOwned[c.lm] && !r.lostLm[c.lm];
      case 'captureWithSetup': return r.capturedWithSetup;
      case 'crewHits': return ((pf.stats.crewHitsBest || {})[c.kind] || 0) >= c.count;
      case 'holdAtEnd': {
        const L = st.lmById[c.lm];
        return !!L && L.owner === P && st.t - (L.heldSince || 0) >= c.seconds;
      }
      default: return false;
    }
  }

  function onVictory(match, r, p) {
    if (r.ended) return;
    r.ended = true;
    const st = match.state;
    const won = p.winner === st.player && st.player >= 0;
    const S = r.M.stars || [];
    const timeStar = S.find((s) => s.id === 'time');
    const stars = [won, !!(won && timeStar && st.t <= timeStar.under), !!(won && bonusDone(match, r))];
    r.result = {
      missionId: r.M.id, won, stars, count: stars.filter(Boolean).length, starTexts: S.map((s) => s.text), t: st.t, reason: p.reason,
      unlock: won ? (r.M.unlock || null) : null, next: next(r.M.id), outro: won ? r.M.outro : null,
    };
    match.emit('missionEnd', r.result);
    if (won) match.emit('hint', { id: 'outro', text: r.M.outro || 'Mission complete.', target: null, mission: r.M.id, tip: false });
  }

  // ------------------------------------------------------------------ queries
  function status(match) {
    const r = runs.get(match);
    if (!r) return null;
    const st = match.state;
    const P = st.player;
    const pf = st.factions[P];
    const w = r.M.win || { type: 'turf' };
    let objective = '', progress = null;
    if (w.type === 'hold') {
      objective = 'Hold ' + w.count + ' landmarks';
      progress = { value: Math.min(w.count, pf.held), max: w.count, text: pf.held + ' / ' + w.count + ' landmarks' };
    } else if (w.type === 'holdTime') {
      const L = st.lmById[w.lm];
      const v = Math.floor(pf.stats.held[w.lm] || 0);
      objective = 'Hold ' + (L ? L.name : w.lm) + ' for ' + w.seconds + ' s in total';
      progress = { value: Math.min(w.seconds, v), max: w.seconds, text: v + ' / ' + w.seconds + ' s' };
    } else if (w.type === 'survive') {
      objective = 'Last until the park closes';
      progress = { value: st.clock, max: st.length, text: SQ.util.fmtClock(st.length - st.clock) + ' left' };
    } else {
      objective = 'Reach ' + st.turfTarget + ' Turf first';
      progress = { value: Math.floor(pf.turf), max: st.turfTarget, text: Math.floor(pf.turf) + ' / ' + st.turfTarget + ' Turf' };
    }
    const S = r.M.stars || [];
    const timeStar = S.find((s) => s.id === 'time');
    const live = r.result ? r.result.stars : [null, timeStar ? st.t <= timeStar.under : null, bonusDone(match, r)];
    return {
      missionId: r.M.id, n: r.M.n, title: r.M.title, teaches: r.M.teaches, objective, progress,
      stars: S.map((s, k) => ({ id: s.id, text: s.text, done: live[k] })),
      hint: r.current ? { id: r.current.id, text: r.current.text, target: resolveTarget(match, r, r.current.rawTarget) } : null,
      step: r.step, total: r.total, ended: r.ended,
    };
  }

  function result(match) { const r = runs.get(match); return r ? r.result : null; }

  function notify(match, what, data) {
    const r = runs.get(match);
    if (!r) return;
    if (what === 'selected') r.selected = true;
    if (what === 'hintSeen' && r.current && (!data || data.id === r.current.id)) r.currentAt = match.state.t;
    if (what === 'activity') r.lastOrderT = match.state.t;
  }

  function missions() { return SQ.data.missions; }
  function next(id) {
    const k = SQ.data.missions.findIndex((m) => m.id === id);
    return k >= 0 && k + 1 < SQ.data.missions.length ? SQ.data.missions[k + 1].id : null;
  }
  function shouldOfferChill(losses) { return losses >= ((SQ.data.campaignRules && SQ.data.campaignRules.chillOfferAfterLosses) || 2); }

  SQ.Campaign = { init, tick, matchConfig, status, result, notify, missions, next, shouldOfferChill, stepDown };
})(window.SQ = window.SQ || {});
