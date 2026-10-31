// SQUARE OFF — the AI (DESIGN §7). A deterministic utility AI in three layers:
//   STRATEGIST   (every 2 s, staggered)  landmark values/scores, squad targets, hysteresis, defense, barks
//   QUARTERMASTER(every 3 s)             recruit mix (counter-shift), Setups on the safest pad, Rally, Dosa, shoo
//   TACTICIAN    (every 0.5 s per squad)  Lanchester engage / hold / retreat, formation, regroup
//   + Crew Call usage (every 1 s when charged).
// Four personalities (hustler, mosh, turtle, opportunist) + 'passive' (campaign squirrels), four difficulties.
// Plays ONLY through SQ.cmd and the read-only query helpers. Own RNG stream per faction. Headless.
//
// Public: SQ.AI.init(match), SQ.AI.tick(match, dt), SQ.AI.debug(match, f) -> brain summary,
//         SQ.AI.PERSONALITIES, SQ.AI.DIFFICULTIES (tunable tables).
// Emits (via match.emit): 'aiBark' {faction, text, lm, kind, x, z, ping?, eta?, squad}
(function (SQ) {
  'use strict';
  const UF = SQ.C.UF;
  const CLS = SQ.C.CLASSES;
  const near = [];

  // ------------------------------------------------------------------ tables
  /** Difficulty (§7.3). react = reaction delay (s); crewDelay = wait after the meter fills; ping = attack telegraph (s). */
  const DIFFICULTIES = {
    // tactEvery: Tactician period in ticks (micro speed); defendT: sendable/attacker power needed to defend;
    // regroup/formation: march discipline; retreatT: Lanchester ratio below which a squad runs;
    // qmEvery: Quartermaster period (ticks); queue: recruits kept queued; reserve: Clout kept back.
    chill: { react: 1.5, counterP: 0.3, engageT: 0.9, noAttack: 90, crewDelay: 30, ping: 5, feint: 0, twoProng: false, shoo: 0.35, retreatT: 0.45, tactEvery: 20, defendT: 1.0, regroup: false, formation: false, qmEvery: 120, queue: 1, reserve: 80 },
    regular: { react: 0.8, counterP: 0.6, engageT: 1.1, noAttack: 0, crewDelay: 0, ping: 0, feint: 0, twoProng: false, shoo: 0.7, retreatT: 0.6, tactEvery: 10, defendT: 0.7, regroup: true, formation: true, qmEvery: 60, queue: 2, reserve: 40 },
    hard: { react: 0.4, counterP: 0.85, engageT: 1.2, noAttack: 0, crewDelay: 0, ping: 0, feint: 0.3, twoProng: true, shoo: 0.9, retreatT: 0.6, tactEvery: 10, defendT: 0.7, regroup: true, formation: true, qmEvery: 50, queue: 3, reserve: 30 },
    legend: { react: 0.25, counterP: 0.95, engageT: 1.2, noAttack: 0, crewDelay: 0, ping: 0, feint: 0.35, twoProng: true, shoo: 1, retreatT: 0.6, tactEvery: 8, defendT: 0.7, regroup: true, formation: true, qmEvery: 40, queue: 3, reserve: 20 },
  };

  /**
   * Personalities (§7.2). mix = ● / ▲ / ■ shares; riskTol scales the threat penalty; squads = role shares;
   * build = Setup priority ('special' = the faction special); minArmy = pop before building beyond the first cart.
   */
  const PERSONALITIES = {
    hustler: {
      mix: [0.4, 0.4, 0.2], riskTol: 1.1, engageMin: 1.3, neutralBonus: 0.45, expandUntil: 4,
      squads: [{ key: 'main', idx: 1, share: 0.55 }, { key: 'raid', idx: 2, share: 0.25 }, { key: 'guard', idx: 3, share: 0.2 }],
      build: ['cart', 'special', 'cart', 'boombox', 'bench'], minArmy: 3, maxSetups: 7,
      perkW: { chess: 2, bobst: 1.2, bigrun: 1, smallrun: 0.8, judson: 0.6 },
    },
    mosh: {
      mix: [0.7, 0.2, 0.1], riskTol: 0.55, engageMin: 0, neutralBonus: 0.2, allCrowdUntil: 120, rushAfter: 120,
      squads: [{ key: 'main', idx: 1, share: 0.75 }, { key: 'raid', idx: 2, share: 0.15 }, { key: 'guard', idx: 3, share: 0.1 }],
      build: ['boombox', 'bench', 'cart'], minArmy: 10, maxSetups: 3,
      perkW: { arch: 1.2, bigrun: 1.5, playground: 1, judson: 1 },
    },
    turtle: {
      mix: [0.25, 0.35, 0.4], riskTol: 1.4, engageMin: 0, neutralBonus: 0, core: 3, pushAt: 375,
      squads: [{ key: 'main', idx: 1, share: 0.5 }, { key: 'raid', idx: 2, share: 0.1 }, { key: 'guard', idx: 3, share: 0.4 }],
      build: ['cart', 'special', 'bench', 'boombox', 'cart'], minArmy: 4, maxSetups: 12, buildAll: true,
      perkW: { garibaldi: 2, playground: 1.5, holley: 1.5, fountain: 1 },
    },
    opportunist: {
      mix: [0.5, 0.4, 0.1], riskTol: 2.0, engageMin: 0, neutralBonus: 0.3, raidBonus: 0.6,
      squads: [{ key: 'main', idx: 1, share: 0.35 }, { key: 'raid', idx: 2, share: 0.25 }, { key: 'raid2', idx: 4, share: 0.25 }, { key: 'guard', idx: 3, share: 0.15 }],
      build: ['cart', 'special', 'boombox'], minArmy: 6, maxSetups: 5,
      perkW: { judson: 1.5, smallrun: 1, bobst: 0.8, holley: 0.8 },
    },
    passive: { mix: [1, 0, 0], riskTol: 1, squads: [], build: [], minArmy: 99, maxSetups: 0, perkW: {} },
  };

  // Class affinity for squad roles (raiders want the fast ●, the main army wants the ■).
  const AFFINITY = {
    main: [0, 0.05, 0.25],
    raid: [0.25, 0.05, -0.3],
    raid2: [0.25, 0.05, -0.3],
    guard: [0, 0.15, 0.05],
  };

  const brains = new WeakMap();

  // ------------------------------------------------------------------ helpers
  function typeOf(st, i) { return SQ.data.unitTypes[st.units.type[i]]; }
  function alive(st, i) { return !(st.units.flags[i] & UF.OVERIT); }
  function d2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
  // Perks the raw Sway number undersells (so the Lanchester estimate doesn't run from fights it would win).
  const PERK_POW = { unsolicitedAdvice: 1.35, saxSplash: 1.15, flinch: 1.05, scrum: 1.08, fetch: 1.05, leashSlow: 1.1, hitTheClock: 1.08, wellActually: 1.05, seenItAll: 1.05, tambourine: 1.05 };
  function effMult(t) {
    if (t._aiPow !== undefined) return t._aiPow;
    let m = t.splash ? 1.12 : 1;
    for (const p of t.perks || []) if (PERK_POW[p]) m *= PERK_POW[p];
    t._aiPow = m;
    return m;
  }
  function pow(st, i) { const t = typeOf(st, i); return st.units.hp[i] * t.sway * (st.units.swayM[i] || 1) * effMult(t); }
  /** Matchup multiplier of class a against a composition (fractions per class). */
  function compMult(a, comp) {
    const C = SQ.data.counter[CLS[a]];
    const tot = comp[0] + comp[1] + comp[2];
    if (tot <= 0) return 1;
    return (C.crowd * comp[0] + C.talker * comp[1] + C.heavy * comp[2]) / tot;
  }
  /** HP-weighted class composition of a list of unit indices. */
  function compOf(st, list) {
    const c = [0, 0, 0];
    for (const i of list) c[st.units.cls[i]] += st.units.hp[i];
    return c;
  }
  /** Lanchester-style ratio: Σ own(Sway·mult·Composure) / Σ enemy(...). */
  function lanchester(st, own, enemies) {
    if (!enemies.length) return Infinity;
    if (!own.length) return 0;
    const oc = compOf(st, own), ec = compOf(st, enemies);
    let op = 0, ep = 0;
    for (const i of own) op += pow(st, i) * compMult(st.units.cls[i], ec);
    for (const j of enemies) ep += pow(st, j) * compMult(st.units.cls[j], oc);
    return ep > 0 ? op / ep : Infinity;
  }
  function lmDist(st, L, x, z) {
    const f = st.nav.flowTo('lm:' + L.id);
    const d = f ? st.nav.distance(f, x, z) : Infinity;
    return d < Infinity ? d : Math.hypot(L.x - x, L.z - z) * 1.4;
  }
  function isEnemy(b, f) { return f !== b.f && f >= 0; }
  function enemyFactions(st, b) { return st.factions.filter((F) => F.idx !== b.f && !F.eliminated); }

  // ------------------------------------------------------------------ init
  function init(match) {
    const st = match.state;
    brains.set(match, st.factions.map((fac) => (fac.ai ? makeBrain(match, fac) : null)));
  }

  function makeBrain(match, fac) {
    const st = match.state;
    const fd = SQ.data.factions[fac.key] || {};
    const persKey = PERSONALITIES[fac.ai.personality] ? fac.ai.personality : (fd.aiPersonality || 'hustler');
    const diffKey = DIFFICULTIES[fac.ai.difficulty] ? fac.ai.difficulty : 'regular';
    const P = PERSONALITIES[persKey], D = DIFFICULTIES[diffKey];
    const b = {
      f: fac.idx, key: fac.key, persKey, diffKey, P, D,
      rng: SQ.util.rngStream(match.seed, 'ai:' + fac.idx + ':' + fac.key),
      squads: P.squads.map((r) => ({
        key: r.key, idx: r.idx, share: r.share, ids: [], target: -1, commitUntil: 0, mode: 'idle', modeUntil: 0,
        holdUntil: 0, alertT: -1, cx: 0, cz: 0, spread: 0, power: 0, n: 0, stuck: 0, feint: null, regrouped: -1, defend: false,
      })),
      role: new Map(), pending: [], lastBark: -99, lastBarkKind: {}, crewFullAt: -1, mix: P.mix.slice(), mixT: -99,
      core: null, defT: {}, per: { enemies: [], own: [] }, noAttackUntil: Math.max(match.rules.noAttacksBefore || 0, D.noAttack || 0),
      rallyT: 0, openingBark: false, stats: { orders: 0, barks: 0, builds: 0, crew: 0, retreats: 0, feints: 0 },
    };
    // Turtle core: the Fountain plus the 2 landmarks closest to home (by walking distance).
    if (P.core) {
      const home = st.lmById[fac.home];
      const lms = st.landmarks.filter((l) => !l.isHome && l.id !== 'fountain')
        .map((l) => ({ l, d: lmDist(st, l, home.x, home.z) })).sort((a, b2) => a.d - b2.d);
      b.core = {};
      if (st.lmById.fountain) b.core.fountain = true;
      for (const e of lms.slice(0, P.core - (b.core.fountain ? 1 : 0))) b.core[e.l.id] = true;
    }
    return b;
  }

  // ------------------------------------------------------------------ tick
  function tick(match, dt) {
    const list = brains.get(match);
    if (!list) return;
    const st = match.state;
    if (st.over) return;
    for (const b of list) {
      if (!b) continue;
      const fac = st.factions[b.f];
      if (!fac || fac.eliminated) continue;
      if (b.persKey === 'passive') continue; // the Squirrel Gang just sits there, judging you
      runPending(match, b);
      const k = st.tick + b.f * 7;
      if (k % 40 === 1) strategist(match, b);
      if (k % (b.D.qmEvery || 60) === 23 % (b.D.qmEvery || 60)) quartermaster(match, b);
      if (k % 20 === 11) crewThink(match, b);
      const te = b.D.tactEvery || 10;
      for (const s of b.squads) if ((st.tick + b.f * 3 + s.idx * 2) % te === 0) tactician(match, b, s);
    }
  }

  function schedule(match, b, delay, fn) {
    b.pending.push({ at: match.state.t + delay, fn });
  }
  function runPending(match, b) {
    if (!b.pending.length) return;
    const t = match.state.t;
    const due = [];
    b.pending = b.pending.filter((p) => { if (p.at <= t + 1e-9) { due.push(p); return false; } return true; });
    for (const p of due) p.fn();
  }

  // ------------------------------------------------------------------ perception
  function perceive(match, b) {
    const st = match.state, u = st.units;
    const enemies = [], own = [];
    for (let i = 0; i < u.n; i++) {
      if (u.flags[i] & UF.OVERIT) continue;
      const f = u.faction[i];
      if (f === b.f) own.push(i);
      else if (SQ.World.isVisible(st, b.f, u.x[i], u.z[i])) enemies.push(i);
    }
    b.per = { enemies, own, t: st.t };
    return b.per;
  }

  function members(st, s) {
    const out = [];
    const keep = [];
    for (const id of s.ids) {
      const i = SQ.World.unitIndex(st, id);
      if (i >= 0 && alive(st, i)) { out.push(i); keep.push(id); }
    }
    s.ids = keep;
    return out;
  }

  function measure(st, s, idx) {
    const u = st.units;
    let cx = 0, cz = 0, p = 0, hp = 0, mhp = 0;
    for (const i of idx) { cx += u.x[i]; cz += u.z[i]; p += pow(st, i); hp += u.hp[i]; mhp += u.maxHp[i]; }
    const n = idx.length;
    if (n) { cx /= n; cz /= n; }
    let spread = 0;
    for (const i of idx) spread = Math.max(spread, Math.hypot(u.x[i] - cx, u.z[i] - cz));
    s.cx = cx; s.cz = cz; s.power = p; s.n = n; s.spread = spread; s.hpFrac = mhp > 0 ? hp / mhp : 1;
  }

  /** Assign new (unknown) own units to squads by role share and class affinity. */
  function syncSquads(match, b) {
    const st = match.state, u = st.units;
    const all = [];
    const counts = {};
    for (const s of b.squads) { members(st, s); counts[s.key] = s.ids.length; }
    const known = new Set();
    for (const s of b.squads) for (const id of s.ids) known.add(id);
    for (let i = 0; i < u.n; i++) {
      if (u.faction[i] !== b.f || (u.flags[i] & (UF.OVERIT | UF.REGULAR))) continue;
      all.push(i);
    }
    const total = all.length;
    const fresh = all.filter((i) => !known.has(u.id[i]));
    if (!fresh.length || !b.squads.length) return;
    const add = {};
    for (const i of fresh) {
      const c = u.cls[i];
      let best = null, bs = -Infinity;
      for (const s of b.squads) {
        const want = s.share * total;
        const sc = (want - counts[s.key]) / Math.max(1, total) + (AFFINITY[s.key] ? AFFINITY[s.key][c] : 0);
        if (sc > bs) { bs = sc; best = s; }
      }
      counts[best.key]++;
      best.ids.push(u.id[i]);
      (add[best.idx] || (add[best.idx] = [])).push(u.id[i]);
    }
    for (const k of Object.keys(add)) SQ.cmd.squad(match, b.f, add[k], +k);
  }

  // ------------------------------------------------------------------ valuation
  function perkW(b, L) { return (b.P.perkW && b.P.perkW[L.id]) || 0; }

  function setupValue(st, L, f) {
    let v = 0;
    for (const pad of L.pads) {
      if (pad.setup < 0) continue;
      const s = st.setupById[pad.setup];
      if (!s) continue;
      const S = SQ.data.setups[s.kind];
      v += (S ? S.cost : 80) / 40 * (s.done ? 1 : 0.6);
    }
    return v;
  }

  function eventBonus(st, L) {
    let v = 0;
    for (const e of st.events) {
      if (e.state === 'done') continue;
      const E = SQ.data.events[e.kind];
      if (!E || !E.aiValue) continue;
      let hit = e.lm === L.id;
      if (!hit && isFinite(e.x)) hit = d2(e.x, e.z, L.x, L.z) <= (L.r + 12) * (L.r + 12);
      if (hit) v += E.aiValue;
    }
    // PEP: a moving truce zone near the landmark is a temporary penalty
    for (const n of st.neutrals) if (n.kind === 'pep' && !n.dead && d2(n.x, n.z, L.x, L.z) < 400) v -= 1.5;
    return v;
  }

  function lmInfo(match, b, per) {
    const st = match.state, u = st.units;
    const anticip = SQ.data.phases[SQ.Economy.phaseAt(Math.min(st.length, st.clock + 25))].id;
    const out = [];
    for (const L of st.landmarks) {
      if (L.isHome) continue;
      const r = SQ.Economy.landmarkRates(st, L, anticip);
      let v = 3 * r.turf + 2 * r.clout + perkW(b, L) + setupValue(st, L, b.f) + eventBonus(st, L);
      if (L.id === 'fountain') v += 4;
      if (L.id === 'bigrun') v += 2; // the Park House next door is "the only bathroom" (running joke, §2.3)
      if (L.aiBonus && L.id !== 'fountain') v += L.aiBonus;
      let ep = 0;
      const ec = [0, 0, 0];
      const R = (L.bound || L.r) + 12;
      for (const j of per.enemies) {
        if (d2(u.x[j], u.z[j], L.x, L.z) > R * R) continue;
        ep += pow(st, j); ec[u.cls[j]] += u.hp[j];
      }
      let op = 0;
      for (const i of per.own) if (d2(u.x[i], u.z[i], L.x, L.z) <= R * R) op += pow(st, i);
      out.push({ L, v, ep, ec, op, own: L.owner === b.f, enemyOwned: L.owner >= 0 && L.owner !== b.f, safe: L.owner === b.f && !L.contested && !L.draining });
    }
    return out;
  }

  /** Largest visible enemy cluster (their "main army"): {x, z, p}. */
  function enemyArmy(st, per) {
    const u = st.units;
    let best = null;
    for (let k = 0; k < per.enemies.length; k += Math.max(1, Math.floor(per.enemies.length / 24))) {
      const j = per.enemies[k];
      let p = 0;
      for (const m of per.enemies) if (d2(u.x[m], u.z[m], u.x[j], u.z[j]) < 400) p += pow(st, m);
      if (!best || p > best.p) best = { x: u.x[j], z: u.z[j], p };
    }
    return best;
  }

  function scoreFor(match, b, s, I, ctx) {
    const st = match.state;
    const L = I.L, P = b.P;
    const role = s.key;
    if (role === 'guard') return guardScore(match, b, s, I, ctx);
    if (I.safe) return -50; // nothing to do there
    if (I.enemyOwned && st.t < b.noAttackUntil) return -Infinity;
    if (b.core && st.clock < P.pushAt && !b.core[L.id] && !(I.own)) return -Infinity; // turtles stay home until Night
    const travel = lmDist(st, L, s.cx, s.cz) / 4.2;
    let sc = I.v * (1 + 0.5 * (I.enemyOwned ? 1 : 0)) / (1 + travel / 30);
    // threat: what is there beyond what this squad can handle
    const threat = Math.max(0, I.ep - 0.75 * s.power) / 300;
    sc -= 1.2 * threat * P.riskTol;
    if (I.own && (L.contested || L.draining)) sc += 3; // help our own
    // personality flavor
    if (L.owner < 0 && P.neutralBonus) sc *= 1 + P.neutralBonus * (st.factions[b.f].held < (P.expandUntil || 99) ? 1 : 0.4);
    if (b.persKey === 'mosh' && role === 'main' && st.t >= P.rushAfter && I.enemyOwned && ctx.rushTarget === L) sc += 12;
    if (b.persKey === 'turtle' && st.clock >= P.pushAt && L.id === 'arch') sc += 4;
    if (P.raidBonus && role !== 'main') {
      if (I.ep <= 0 && (I.enemyOwned || L.owner < 0)) sc *= 1 + P.raidBonus + 0.15 * setupValue(st, L, b.f);
      if (ctx.army && d2(ctx.army.x, ctx.army.z, L.x, L.z) < 45 * 45) sc -= 6; // avoid their main army
    }
    // night: the creepy old elm debuffs non-owners — opportunists hate it
    if (L.id === 'grove' && st.phase === 'night' && I.enemyOwned) sc -= b.persKey === 'opportunist' ? 4 : 1.5;
    // spread out: don't stack two squads on one target unless it's contested
    if (ctx.taken[L.idx] && !(L.contested || L.draining)) sc *= 0.45;
    if (s.target === L.idx && s.stuck > 12) sc *= 0.5;
    return sc;
  }

  function guardScore(match, b, s, I, ctx) {
    const st = match.state;
    const L = I.L;
    const home = st.lmById[st.factions[b.f].home];
    const dh = lmDist(st, L, home.x, home.z);
    if (I.own) {
      let sc = I.v * (1 + Math.min(3, I.ep / 300) + (L.contested || L.draining ? 2 : 0)) / (1 + dh / 70);
      if (b.core && b.core[L.id]) sc *= 1.5;
      return sc;
    }
    if (I.enemyOwned && st.t < b.noAttackUntil) return -Infinity;
    if (dh > 110 && !(b.core && b.core[L.id])) return -Infinity;
    const threat = Math.max(0, I.ep - 0.75 * s.power) / 300;
    return 0.8 * I.v / (1 + dh / 40) - 1.2 * threat * b.P.riskTol;
  }

  // ------------------------------------------------------------------ strategist
  function strategist(match, b) {
    const st = match.state;
    const fac = st.factions[b.f];
    syncSquads(match, b);
    const per = perceive(match, b);
    for (const s of b.squads) measure(st, s, members(st, s));
    const info = lmInfo(match, b, per);
    const byIdx = {};
    for (const I of info) byIdx[I.L.idx] = I;
    const ctx = { taken: {}, army: enemyArmy(st, per), rushTarget: rushTarget(match, b) };

    if (!b.openingBark && st.t > 3) {
      b.openingBark = true;
      const pl = SQ.data.text.personalityBarks[b.persKey];
      if (pl && pl.length) emitBark(match, b, pl[b.rng.int(pl.length)], null, 'personality');
    }

    // 1. Defense: contested / draining owned landmarks.
    defense(match, b, info, ctx);

    // 2. Feints resolve (hard+): after the bluff, swing to the real target.
    for (const s of b.squads) {
      if (s.feint && st.t >= s.feint.until) {
        const real = st.landmarks[s.feint.real];
        s.feint = null;
        if (real && real.owner !== b.f) setTarget(match, b, s, real.idx, 12, true, false);
      }
    }

    // 3. Target assignment with hysteresis (main first, then raiders, then guard).
    const order = b.squads.slice().sort((a, c) => (a.key === 'main' ? 0 : a.key === 'guard' ? 2 : 1) - (c.key === 'main' ? 0 : c.key === 'guard' ? 2 : 1));
    for (const s of order) {
      if (s.target >= 0) ctx.taken[s.target] = (ctx.taken[s.target] || 0) + 1;
    }
    for (const s of order) {
      if (!s.n) { s.target = -1; continue; }
      if (s.defend && st.t < s.commitUntil) continue;
      if (s.feint) continue;
      if (s.mode === 'hold') s.stuck += 2; else s.stuck = Math.max(0, s.stuck - 1);
      if (s.target >= 0) ctx.taken[s.target]--;
      let best = null, bs = -Infinity;
      for (const I of info) {
        const sc = scoreFor(match, b, s, I, ctx);
        if (sc > bs) { bs = sc; best = I; }
      }
      let keep = false;
      if (s.target >= 0 && byIdx[s.target]) {
        const curI = byIdx[s.target];
        const cur = scoreFor(match, b, s, curI, ctx);
        const done = s.key !== 'guard' && curI.safe;
        if (!done && cur > -Infinity) {
          if (st.t < s.commitUntil) keep = true;
          else if (!best || bs < cur + 0.25 * Math.abs(cur)) keep = true;
        }
      }
      if (!keep && best && bs > -Infinity && best.L.idx !== s.target) {
        // Hard+: two-prong raids and feints on committed attacks.
        if (s.key === 'main' && best.enemyOwned && b.D.feint && b.rng() < b.D.feint) {
          const decoy = info.filter((I) => I !== best && !I.safe && I.L.owner !== b.f && scoreFor(match, b, s, I, ctx) > -Infinity)
            .sort((a, c) => d2(a.L.x, a.L.z, best.L.x, best.L.z) - d2(c.L.x, c.L.z, best.L.x, best.L.z))[0];
          if (decoy && d2(decoy.L.x, decoy.L.z, best.L.x, best.L.z) > 50 * 50) {
            setTarget(match, b, s, decoy.L.idx, 15, true, true);
            s.feint = { real: best.L.idx, until: st.t + 7 + b.rng() * 3 };
            b.stats.feints++;
            ctx.taken[decoy.L.idx] = (ctx.taken[decoy.L.idx] || 0) + 1;
            continue;
          }
        }
        setTarget(match, b, s, best.L.idx, 15, false, true);
        if (s.key === 'main' && best.enemyOwned && b.D.twoProng) twoProng(match, b, info, ctx, best);
      }
      if (s.target >= 0) ctx.taken[s.target] = (ctx.taken[s.target] || 0) + 1;
    }
    // squads without members forget their target
    for (const s of b.squads) if (!s.n) s.target = -1;
    void fac;
  }

  function rushTarget(match, b) {
    if (b.persKey !== 'mosh') return null;
    const st = match.state;
    const home = st.lmById[st.factions[b.f].home];
    const victim = st.player >= 0 && st.player !== b.f && !st.factions[st.player].eliminated ? st.player : -1;
    let best = null, bd = Infinity;
    for (const L of st.landmarks) {
      if (L.isHome || L.owner < 0 || L.owner === b.f) continue;
      if (victim >= 0 && L.owner !== victim) continue;
      const d = lmDist(st, L, home.x, home.z);
      if (d < bd) { bd = d; best = L; }
    }
    return best;
  }

  function twoProng(match, b, info, ctx, mainI) {
    const st = match.state;
    const raid = b.squads.find((s) => (s.key === 'raid' || s.key === 'raid2') && s.n >= 2 && !s.defend);
    if (!raid) return;
    let best = null, bs = -Infinity;
    for (const I of info) {
      if (!I.enemyOwned || I === mainI) continue;
      if (d2(I.L.x, I.L.z, mainI.L.x, mainI.L.z) < 50 * 50) continue;
      const sc = I.v / (1 + I.ep / 300) / (1 + lmDist(st, I.L, raid.cx, raid.cz) / 120);
      if (sc > bs) { bs = sc; best = I; }
    }
    if (best && best.L.idx !== raid.target) {
      setTarget(match, b, raid, best.L.idx, 15, true, true);
      ctx.taken[best.L.idx] = (ctx.taken[best.L.idx] || 0) + 1;
    }
  }

  function setTarget(match, b, s, lmIdx, commit, override, barkIt) {
    const st = match.state;
    const L = st.landmarks[lmIdx];
    s.target = lmIdx;
    s.commitUntil = st.t + commit;
    s.mode = 'go';
    s.stuck = 0;
    s.regrouped = -1;
    s.defend = false;
    // Chill telegraphs its attacks: ping first, move a few seconds later.
    const attack = L.owner >= 0 && L.owner !== b.f;
    s.holdUntil = attack && b.D.ping ? st.t + b.D.ping : 0;
    if (barkIt && (attack || (s.key === 'main' && L.owner < 0 && b.rng() < 0.35)) && s.key !== 'guard') {
      barkAttack(match, b, s, L, attack && b.D.ping ? b.D.ping : 0);
    }
    void override;
  }

  function defense(match, b, info, ctx) {
    const st = match.state, u = st.units;
    for (const I of info) {
      const L = I.L;
      if (!I.own || !(L.contested || L.draining) || I.ep <= 0) continue;
      if (st.t - (b.defT[L.idx] || -99) < 8) continue;
      b.defT[L.idx] = st.t;
      // sendable power within 15 s, plus what is already there
      let send = I.op;
      const cand = [];
      let already = null;
      for (const s of b.squads) {
        if (!s.n) continue;
        const tt = lmDist(st, L, s.cx, s.cz) / 4.2;
        if (s.target === L.idx) { if (tt <= 20) { send += s.power; already = s; } continue; }
        if (tt <= 15) { send += s.power; cand.push({ s, tt }); }
      }
      const need = b.D.defendT || 0.7;
      if (already && send >= need * I.ep) { already.defend = true; already.commitUntil = Math.max(already.commitUntil, st.t + 10); bark(match, b, 'defend', L, already); continue; }
      if (send >= need * I.ep && cand.length) {
        cand.sort((a, c) => (a.s.key === 'guard' ? -1 : 0) - (c.s.key === 'guard' ? -1 : 0) || a.tt - c.tt);
        const s = cand[0].s;
        s.target = L.idx; s.commitUntil = st.t + 12; s.mode = 'go'; s.defend = true; s.feint = null; s.holdUntil = 0;
        ctx.taken[L.idx] = (ctx.taken[L.idx] || 0) + 1;
        bark(match, b, 'defend', L, s);
      } else if (!cand.length && send < need * I.ep) {
        // write it off: counter-raid the attacker's weakest landmark
        let attacker = -1;
        for (let f = 0; f < L.weights.length; f++) if (f !== b.f && L.weights[f] > 0) attacker = f;
        if (attacker < 0) continue;
        if (st.t < b.noAttackUntil) continue;
        const raid = b.squads.find((s) => (s.key === 'raid' || s.key === 'raid2') && s.n > 0 && !s.defend) || b.squads.find((s) => s.key === 'main' && s.n > 0);
        if (!raid) continue;
        let best = null, bs = -Infinity;
        for (const J of info) {
          if (J.L.owner !== attacker) continue;
          const sc = J.v / (1 + J.ep / 200) / (1 + lmDist(st, J.L, raid.cx, raid.cz) / 100);
          if (sc > bs) { bs = sc; best = J; }
        }
        if (best && best.L.idx !== raid.target) setTarget(match, b, raid, best.L.idx, 15, true, true);
      }
    }
    void u;
  }

  // ------------------------------------------------------------------ tactician
  function nearbyEnemies(st, b, x, z, r) {
    const u = st.units;
    SQ.World.query(st, x, z, r, near);
    const out = [];
    for (const j of near) {
      if (!isEnemy(b, u.faction[j]) || (u.flags[j] & UF.OVERIT)) continue;
      if (!SQ.World.isVisible(st, b.f, u.x[j], u.z[j])) continue;
      out.push(j);
    }
    return out;
  }
  function nearbyOwn(st, b, x, z, r) {
    const u = st.units;
    SQ.World.query(st, x, z, r, near);
    const out = [];
    for (const j of near) if (u.faction[j] === b.f && !(u.flags[j] & UF.OVERIT)) out.push(j);
    return out;
  }

  function order(match, b, idxs, o) {
    if (!idxs.length) return;
    const u = match.state.units;
    const r = SQ.cmd.order(match, b.f, idxs.map((i) => u.id[i]), o);
    if (r.ok) b.stats.orders++;
    return r;
  }

  function tactician(match, b, s) {
    const st = match.state, u = st.units;
    const idx = members(st, s);
    if (!idx.length) { s.mode = 'idle'; return; }
    measure(st, s, idx);
    const t = st.t;
    if (s.mode === 'retreat') {
      if (t < s.modeUntil) return;
      if (s.hpFrac < 0.7 && t < s.modeUntil + 10 && !nearbyEnemies(st, b, s.cx, s.cz, 18).length) return;
      s.mode = 'go';
    }
    const enemies = nearbyEnemies(st, b, s.cx, s.cz, 24 + Math.min(20, s.spread * 0.6));
    const L = s.target >= 0 ? st.landmarks[s.target] : null;
    if (enemies.length) {
      if (s.alertT < 0) s.alertT = t;
      if (t - s.alertT < b.D.react) return; // reaction delay
      const own = nearbyOwn(st, b, s.cx, s.cz, 30);
      const ratio = lanchester(st, own, enemies);
      const defending = L && L.owner === b.f;
      const engageT = Math.max(b.D.engageT, b.P.engageMin || 0);
      const inOurRing = L && SQ.World.inRing(L, s.cx, s.cz) && (L.owner === b.f || L.capBy === b.f);
      if (ratio < b.D.retreatT && !(defending && ratio > 0.45)) return retreat(match, b, s, idx, enemies);
      let ex = 0, ez = 0;
      for (const j of enemies) { ex += u.x[j]; ez += u.z[j]; }
      ex /= enemies.length; ez /= enemies.length;
      const enemyOnOurs = enemies.some((j) => { for (const Lm of st.landmarks) if (Lm.owner === b.f && SQ.World.inRing(Lm, u.x[j], u.z[j])) return true; return false; });
      const mayAttack = t >= b.noAttackUntil || enemyOnOurs || defending;
      // already in contact: it's fight or flight now, no polite waiting
      const contact = idx.some((i) => u.flags[i] & UF.COMBAT) || enemies.some((j) => d2(u.x[j], u.z[j], s.cx, s.cz) < 100);
      if ((ratio >= engageT || defending || inOurRing || contact) && mayAttack) {
        s.mode = 'fight';
        return engage(match, b, s, idx, ex, ez);
      }
      // not good enough: hold a short distance back and wait for reinforcements
      if (s.mode !== 'hold' || t - s.modeUntil > 6) {
        let hx = s.cx - ex, hz = s.cz - ez;
        const l = Math.hypot(hx, hz) || 1;
        hx = ex + hx / l * 22; hz = ez + hz / l * 22;
        s.mode = 'hold'; s.modeUntil = t;
        order(match, b, idx, { type: 'attackMove', x: hx, z: hz });
      }
      return;
    }
    s.alertT = -1;
    if (!L) return;
    if (t < s.holdUntil) return; // telegraphed attack (Chill): wait out the ping
    // regroup once on long marches when strung out
    const far = lmDist(st, L, s.cx, s.cz);
    const hasHeavy = idx.some((i) => u.cls[i] === 2);
    if (s.mode === 'go' && b.D.regroup && t > 75 && hasHeavy && s.key !== 'raid' && s.key !== 'raid2' && far > 80 && s.spread > 30 && s.regrouped !== s.target && idx.length >= 4) {
      s.regrouped = s.target;
      s.mode = 'regroup'; s.modeUntil = t + 7;
      // the slow ■ set the pace: gather on them, a step toward the target
      let gx = 0, gz = 0, gn = 0;
      for (const i of idx) if (u.cls[i] === 2) { gx += u.x[i]; gz += u.z[i]; gn++; }
      if (!gn) { gx = s.cx; gz = s.cz; gn = 1; }
      gx /= gn; gz /= gn;
      order(match, b, idx, { type: 'attackMove', x: gx + (L.x - gx) * 0.12, z: gz + (L.z - gz) * 0.12 });
      return;
    }
    if (s.mode === 'regroup') {
      if (t < s.modeUntil && s.spread > 12) return;
      s.mode = 'go';
    }
    if (s.mode === 'fight' || s.mode === 'hold') s.mode = 'go';
    const need = [];
    for (const i of idx) {
      const o = u.order[i];
      if (o && o.type === 'take' && o.lm === L.idx) continue;
      need.push(i);
    }
    if (need.length) order(match, b, need, { type: 'take', lm: L.idx });
  }

  /** Attack-move in formation: ■ in front, ▲ 6 m behind, ● on the flanks. */
  function engage(match, b, s, idx, ex, ez) {
    const st = match.state, u = st.units;
    let dx = ex - s.cx, dz = ez - s.cz;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    if (!b.D.formation) { // sloppy: everyone charges the middle
      const all = idx.filter((i) => { const o = u.order[i]; return !(o && o.type === 'attackMove' && d2(o.x, o.z, ex, ez) < 64); });
      order(match, b, all, { type: 'attackMove', x: ex, z: ez });
      return;
    }
    const groups = [[], [], []];
    for (const i of idx) {
      const o = u.order[i];
      // already attack-moving close to this spot: leave them be
      if (o && o.type === 'attackMove' && d2(o.x, o.z, ex, ez) < 64 && u.cls[i] !== 1) continue;
      groups[u.cls[i]].push(i);
    }
    if (groups[2].length) order(match, b, groups[2], { type: 'attackMove', x: ex, z: ez });
    if (groups[1].length) {
      const tx = ex - dx * 6, tz = ez - dz * 6;
      const tal = groups[1].filter((i) => { const o = u.order[i]; return !(o && o.type === 'attackMove' && d2(o.x, o.z, tx, tz) < 36); });
      order(match, b, tal, { type: 'attackMove', x: tx, z: tz });
    }
    if (groups[0].length) {
      const half = Math.ceil(groups[0].length / 2);
      const px = -dz * 5, pz = dx * 5;
      order(match, b, groups[0].slice(0, half), { type: 'attackMove', x: ex + px, z: ez + pz });
      order(match, b, groups[0].slice(half), { type: 'attackMove', x: ex - px, z: ez - pz });
    }
  }

  /** Nearest owned heal source away from the enemy: Playground, Food Cart, Water Bowl, Park House, Home. */
  function healSource(match, b, s, ex, ez) {
    const st = match.state;
    const fac = st.factions[b.f];
    const src = [];
    const home = st.lmById[fac.home];
    src.push({ x: home.x, z: home.z, w: 1 });
    const ph = SQ.data.sites.parkHouse;
    src.push({ x: ph.x, z: ph.z - 3, w: 0.8, bathroom: true }); // over-valued, as is tradition
    for (const L of st.landmarks) {
      if (L.owner !== b.f || L.isHome) continue;
      if (L.perk && (L.perk.id === 'playground' || L.perk.id === 'toddler')) src.push({ x: L.x, z: L.z, w: 0.9 });
      else src.push({ x: L.x, z: L.z, w: 1.25 }); // any owned ring has friendly regulars
    }
    for (const S of st.setups) {
      if (!S.done || S.owner !== b.f) continue;
      if (S.kind === 'cart' || S.kind === 'waterBowl') src.push({ x: S.x, z: S.z, w: 0.85 });
    }
    let best = null, bs = Infinity;
    for (const p of src) {
      const dSelf = Math.hypot(p.x - s.cx, p.z - s.cz);
      const dEnemy = Math.hypot(p.x - ex, p.z - ez);
      if (dEnemy < dSelf * 0.8 && dEnemy < 40) continue; // would run through them
      const sc = dSelf * p.w + Math.max(0, 35 - dEnemy) * 2;
      if (sc < bs) { bs = sc; best = p; }
    }
    return best || src[0];
  }

  function retreat(match, b, s, idx, enemies) {
    const st = match.state, u = st.units;
    let ex = 0, ez = 0;
    for (const j of enemies) { ex += u.x[j]; ez += u.z[j]; }
    ex /= enemies.length; ez /= enemies.length;
    const p = healSource(match, b, s, ex, ez);
    s.mode = 'retreat'; s.modeUntil = st.t + 6;
    b.stats.retreats++;
    order(match, b, idx, { type: 'move', x: p.x, z: p.z });
    if (p.bathroom && b.rng() < 0.5) bark(match, b, 'bathroom', null, s);
    else bark(match, b, 'retreat', null, s);
    // last-ditch: a Crew Call can save a squad that is running
    crewThink(match, b, { save: s, ex, ez });
  }

  // ------------------------------------------------------------------ quartermaster
  function quartermaster(match, b) {
    const st = match.state, u = st.units;
    const fac = st.factions[b.f];
    const per = b.per && st.t - b.per.t < 3 ? b.per : perceive(match, b);
    updateMix(match, b, per);
    // army stats
    const cnt = [0, 0, 0];
    let armyPop = 0;
    for (const i of per.own) {
      if (u.flags[i] & UF.REGULAR) continue;
      cnt[u.cls[i]] += u.cls[i] === 0 ? 0.5 : 1;
      armyPop += typeOf(st, i).pop;
    }
    for (const q of fac.queue) cnt[SQ.C.CLASS_IDX[q.cls]] += 1;
    const queuedPop = fac.queue.reduce((a, q) => a + q.pop, 0);
    const threatened = per.enemies.length && st.landmarks.some((L) => L.owner === b.f && (L.contested || L.draining));
    // building first when rich (never starve an empty army)
    if (!threatened || fac.clout > 260) maybeBuild(match, b, per, armyPop, queuedPop);
    // recruit
    const reserve = armyPop < 6 || threatened ? 0 : (b.D.reserve !== undefined ? b.D.reserve : 40);
    const qMax = fac.clout > 220 ? Math.max(b.D.queue || 2, 2) + 1 : (b.D.queue || 2);
    for (let n = 0; n < 3 && fac.queue.length < qMax; n++) {
      const cls = pickClass(match, b, cnt);
      if (!cls) break;
      const chk = SQ.Economy.canRecruit(st, b.f, cls);
      if (!chk.ok || fac.clout - chk.cost < reserve) {
        // can't afford the ideal: a cheaper filler only if we really have nothing
        if (chk.reason === 'clout' && armyPop < 4 && SQ.Economy.canRecruit(st, b.f, 'crowd').ok) { SQ.cmd.recruit(match, b.f, 'crowd'); cnt[0] += 1; }
        break;
      }
      if (SQ.cmd.recruit(match, b.f, cls).ok) cnt[SQ.C.CLASS_IDX[cls]] += 1;
    }
    maybeRally(match, b, per);
    maybeDosa(match, b, per);
    maybeShoo(match, b);
  }

  function updateMix(match, b, per) {
    const st = match.state, u = st.units;
    if (st.t - b.mixT < 15) return;
    b.mixT = st.t;
    const P = b.P;
    let mix = P.mix.slice();
    if (P.allCrowdUntil && st.t < P.allCrowdUntil) { b.mix = [1, 0, 0]; return; }
    if (per.enemies.length >= 3 && b.rng() < b.D.counterP) {
      const c = [0, 0, 0];
      for (const j of per.enemies) c[u.cls[j]]++;
      const plural = c.indexOf(Math.max(c[0], c[1], c[2]));
      const beater = SQ.C.CLASS_IDX[SQ.data.weakTo[CLS[plural]]];
      const shift = 0.3;
      const others = [0, 1, 2].filter((k) => k !== beater);
      const take = Math.min(shift, others.reduce((a, k) => a + mix[k], 0));
      const tot = others.reduce((a, k) => a + mix[k], 0) || 1;
      for (const k of others) mix[k] -= take * mix[k] / tot;
      mix[beater] += take;
    }
    b.mix = mix;
  }

  function pickClass(match, b, cnt) {
    const tot = cnt[0] + cnt[1] + cnt[2] + 1;
    let best = null, bd = -Infinity;
    for (let c = 0; c < 3; c++) {
      if (b.mix[c] <= 0.001) continue;
      const deficit = b.mix[c] - cnt[c] / tot + b.rng() * 0.05;
      if (deficit > bd) { bd = deficit; best = CLS[c]; }
    }
    return best;
  }

  function maybeBuild(match, b, per, armyPop, queuedPop) {
    const st = match.state, u = st.units;
    const fac = st.factions[b.f];
    const P = b.P;
    const mine = st.setups.filter((S) => S.owner === b.f);
    const rich = fac.clout > 260;
    if (mine.length >= P.maxSetups + (rich ? 4 : 0)) return;
    const special = SQ.data.factions[fac.key] && SQ.data.factions[fac.key].special;
    const hasCart = mine.some((S) => S.kind === 'cart');
    let want = null;
    if (fac.pop + queuedPop >= fac.popCap - 1 && fac.popCap < SQ.data.matchRules.popMax) want = 'bench';
    else if (fac.income < 5 && !hasCart) want = 'cart';
    else if (armyPop >= P.minArmy || rich) {
      // next item from the priority list we don't have enough of yet
      const have = {};
      for (const S of mine) have[S.kind] = (have[S.kind] || 0) + 1;
      const seen = {};
      for (const it of P.build) {
        const id = it === 'special' ? special : it;
        if (!id) continue;
        seen[id] = (seen[id] || 0) + 1;
        if ((have[id] || 0) < seen[id] || P.buildAll) { want = id; break; }
      }
      if (!want && rich) want = ['cart', 'boombox', 'bench', special][b.rng.int(4)] || 'cart';
    }
    if (!want) return;
    const S = SQ.data.setups[want];
    if (!S || fac.clout < S.cost + 40) return;
    // safest owned pad: distance to the nearest visible enemy
    let best = null, bs = -Infinity;
    const enemyHome = enemyFactions(st, b).map((F) => st.lmById[F.home]).filter(Boolean);
    for (const L of st.landmarks) {
      const owned = L.isHome ? L.id === fac.home : L.owner === b.f;
      if (!owned || L.contested || L.draining) continue;
      if (S.special && L.isHome) continue;
      const opts = SQ.Economy.buildOptions(st, b.f, L.id);
      const o = opts.find((x) => x.id === want);
      if (!o || !o.ok) continue;
      let safety = 80;
      for (const j of per.enemies) safety = Math.min(safety, Math.hypot(u.x[j] - L.x, u.z[j] - L.z));
      for (const h of enemyHome) safety = Math.min(safety, Math.hypot(h.x - L.x, h.z - L.z) / 2.5);
      let sc = safety;
      if (b.core && b.core[L.id]) sc += 25;
      if (want === 'boombox' || want === 'bench') sc += L.isHome ? -10 : 5; // fighting buffs belong at the front
      if (want === 'cart' && L.isHome) sc += 15;                              // home carts never flip
      if (sc > bs) { bs = sc; best = L; }
    }
    if (!best) return;
    const r = SQ.cmd.build(match, b.f, best.id, -1, want);
    if (r.ok) b.stats.builds++;
  }

  function maybeRally(match, b, per) {
    const st = match.state, u = st.units;
    if (st.t - b.rallyT < 6) return;
    b.rallyT = st.t;
    const fac = st.factions[b.f];
    const main = b.squads.find((s) => s.key === 'main');
    const T = main && main.target >= 0 ? st.landmarks[main.target] : null;
    let best = st.lmById[fac.home], bs = T ? lmDist(st, T, best.x, best.z) : 0;
    if (T) {
      for (const L of st.landmarks) {
        if (L.isHome || L.owner !== b.f || L.contested || L.draining) continue;
        if (!SQ.Economy.canRally(st, b.f, L.id)) continue;
        let danger = false;
        for (const j of per.enemies) if (d2(u.x[j], u.z[j], L.x, L.z) < 30 * 30) { danger = true; break; }
        if (danger) continue;
        const d = lmDist(st, T, L.x, L.z) + 10;
        if (d < bs) { bs = d; best = L; }
      }
    }
    if (best && best.id !== fac.rally) SQ.cmd.setRally(match, b.f, best.id);
  }

  function maybeDosa(match, b, per) {
    const st = match.state, u = st.units;
    const fac = st.factions[b.f];
    const D = SQ.data.sites.dosa;
    if (fac.dosaCD > 0 || fac.clout < D.cost + 70) return;
    let mine = 0, foes = 0;
    for (const i of per.own) if (d2(u.x[i], u.z[i], D.x, D.z) <= D.radius * D.radius) mine++;
    for (const j of per.enemies) if (d2(u.x[j], u.z[j], D.x, D.z) <= 35 * 35) foes++;
    if (mine >= 4 && foes >= 2) SQ.cmd.buyDosa(match, b.f);
  }

  function maybeShoo(match, b) {
    const st = match.state;
    for (const n of st.neutrals) {
      if (n.kind !== 'squirrel' || n.dead || n.shooed) continue;
      if (n.victim !== undefined && n.victim !== b.f) continue;
      if (b.rng() >= b.D.shoo) continue;
      const id = n.id;
      schedule(match, b, b.D.react + b.rng() * 1.5, () => { SQ.cmd.shoo(match, b.f, id); });
    }
  }

  // ------------------------------------------------------------------ crew call
  function crewThink(match, b, save) {
    const st = match.state, u = st.units;
    const chk = SQ.Abilities.canCrewCall(st, b.f);
    if (!chk.ok) { b.crewFullAt = -1; return; }
    if (b.crewFullAt < 0) b.crewFullAt = st.t;
    const waited = st.t - b.crewFullAt;
    if (waited < b.D.crewDelay + b.D.react && !(save && waited >= b.D.crewDelay)) return;
    const per = b.per && st.t - b.per.t < 2.5 ? b.per : perceive(match, b);
    const minHits = waited > 75 ? 2 : waited > 35 ? 3 : 4;
    const cc = SQ.data.factions[b.key].crewCall;
    let shot = null;
    if (chk.kind === 'groupChat') shot = planGroupChat(match, b, per, waited, save);
    else if (chk.kind === 'zoomies') shot = planZoomies(match, b, per, minHits, save);
    else shot = planPoint(match, b, per, cc.radius || 14, minHits, save, chk.kind);
    if (!shot) return;
    const r = SQ.cmd.crewCall(match, b.f, shot);
    if (r && r.ok) {
      b.stats.crew++;
      b.crewFullAt = -1;
      if (b.rng() < 0.7) bark(match, b, 'crewCall', null, null, shot);
    }
    void u;
  }

  /** Tournament / Drum Circle: the point that catches the most enemies (needs our units nearby to exploit it). */
  function planPoint(match, b, per, R, minHits, save, kind) {
    const st = match.state, u = st.units;
    let best = null, bn = 0;
    const step = Math.max(1, Math.floor(per.enemies.length / 40));
    for (let k = 0; k < per.enemies.length; k += step) {
      const j = per.enemies[k];
      let cx = 0, cz = 0, n = 0;
      for (const m of per.enemies) if (d2(u.x[m], u.z[m], u.x[j], u.z[j]) <= R * R * 0.8) { cx += u.x[m]; cz += u.z[m]; n++; }
      cx /= n; cz /= n;
      let hits = 0;
      for (const m of per.enemies) if (d2(u.x[m], u.z[m], cx, cz) <= R * R) hits++;
      let mine = 0;
      for (const i of per.own) if (d2(u.x[i], u.z[i], cx, cz) <= (R + 14) * (R + 14)) mine++;
      if (!mine) continue;
      let sc = hits;
      // flips a contested capture: enemies sitting in a ring we are fighting over
      for (const L of st.landmarks) if (L.contested && L.weights[b.f] > 0 && d2(L.x, L.z, cx, cz) < R * R) sc += 2;
      if (save && d2(save.ex, save.ez, cx, cz) < (R + 6) * (R + 6)) sc += 2;
      if (kind === 'drumCircle') { // heals our own in the ring too
        for (const i of per.own) if (d2(u.x[i], u.z[i], cx, cz) <= R * R && u.hp[i] < u.maxHp[i] * 0.7) sc += 0.3;
      }
      if (sc > bn) { bn = sc; best = { x: cx, z: cz }; }
    }
    if (best && bn >= (save ? Math.min(2, minHits) : minHits)) return best;
    return null;
  }

  function planZoomies(match, b, per, minHits, save) {
    const st = match.state, u = st.units;
    const cc = SQ.data.factions.pack.crewCall;
    let best = null, bn = 0;
    const step = Math.max(1, Math.floor(per.enemies.length / 30));
    for (let k = 0; k < per.enemies.length; k += step) {
      const j = per.enemies[k];
      let cx = 0, cz = 0, n = 0;
      for (const m of per.enemies) if (d2(u.x[m], u.z[m], u.x[j], u.z[j]) <= 100) { cx += u.x[m]; cz += u.z[m]; n++; }
      cx /= n; cz /= n;
      // run from our nearest unit through the clump
      let ox = null, oz = null, od = Infinity;
      for (const i of per.own) { const dd = d2(u.x[i], u.z[i], cx, cz); if (dd < od) { od = dd; ox = u.x[i]; oz = u.z[i]; } }
      if (ox === null || od > 60 * 60) continue;
      let dx = cx - ox, dz = cz - oz;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      const half = cc.maxLen / 2 - 1;
      const x = cx - dx * half, z = cz - dz * half, x2 = cx + dx * half, z2 = cz + dz * half;
      const lane = cc.hitRadius + (cc.dogs - 1) / 2 * 0.9;
      let hits = 0;
      for (const m of per.enemies) if (SQ.util.segDist2(u.x[m], u.z[m], x, z, x2, z2) <= lane * lane) hits++;
      if (save && d2(save.ex, save.ez, cx, cz) < 400) hits += 1;
      if (hits > bn) { bn = hits; best = { x, z, x2, z2 }; }
    }
    if (best && bn >= (save ? Math.min(2, minHits) : minHits)) return best;
    return null;
  }

  function planGroupChat(match, b, per, waited, save) {
    const st = match.state;
    let best = null, bs = 0;
    const main = b.squads.find((s) => s.key === 'main');
    const T = main && main.target >= 0 ? st.landmarks[main.target] : null;
    for (const L of st.landmarks) {
      const owned = L.isHome ? L.id === st.factions[b.f].home : L.owner === b.f;
      if (!owned) continue;
      let sc = 0;
      if (L.contested || L.draining) sc += 6 + L.weights.reduce((a, w, f) => a + (f !== b.f ? w : 0), 0);
      if (save && Math.hypot(L.x - save.ex, L.z - save.ez) < 40) sc += 3;
      if (waited > 20 && T && !L.isHome) sc += 2 + 60 / (20 + Math.hypot(L.x - T.x, L.z - T.z));
      if (sc > bs) { bs = sc; best = L; }
    }
    if (best && (bs >= 6 || waited > 20 || save)) return { landmarkId: best.id };
    return null;
  }

  // ------------------------------------------------------------------ barks
  function squadUnitName(match, s) {
    const st = match.state;
    if (!s) return null;
    const idx = members(st, s);
    const cnt = {};
    let best = null, bn = 0;
    for (const i of idx) {
      const t = typeOf(st, i);
      const w = (cnt[t.key] = (cnt[t.key] || 0) + (t.cls === 'heavy' ? 2.5 : t.cls === 'talker' ? 1.5 : 1));
      if (w > bn) { bn = w; best = t; }
    }
    return best ? best.name : null;
  }

  function barkAttack(match, b, s, L, ping) {
    const st = match.state;
    let kind = 'attack';
    if (L.id === 'arch' && st.phase === 'night' && b.rng() < 0.5) kind = 'night';
    else if (L.id === 'bigrun' && b.rng() < 0.45) kind = 'bathroom';
    else if (b.persKey !== 'passive' && b.rng() < 0.12) kind = 'taunt';
    bark(match, b, kind, L, s, null, ping);
  }

  function bark(match, b, kind, L, s, at, ping) {
    const st = match.state;
    // one-liners are a character, not a chat log: per-kind cooldowns plus a global gap
    const gap = { attack: 10, night: 20, bathroom: 25, taunt: 40, defend: 10, retreat: 16, crewCall: 20 }[kind] || 8;
    if (st.t - (b.lastBarkKind[kind] === undefined ? -99 : b.lastBarkKind[kind]) < gap) return;
    if (st.t - b.lastBark < (kind === 'defend' ? 0 : 5) && !ping) return;
    const pool = SQ.data.text.barks[kind];
    if (!pool || !pool.length) return;
    const fac = st.factions[b.f];
    const unit = squadUnitName(match, s) || (SQ.data.units[b.key] && SQ.data.units[b.key].crowd.name) || fac.short;
    const text = SQ.data.text.fill(pool[b.rng.int(pool.length)], { UNIT: unit, CREW: fac.name, LM: L ? L.name : 'the park' });
    b.lastBarkKind[kind] = st.t;
    const x = L ? L.x : at ? at.x : s ? s.cx : null;
    const z = L ? L.z : at ? at.z : s ? s.cz : null;
    emitBark(match, b, text, L, kind, x, z, s, ping);
  }

  function emitBark(match, b, text, L, kind, x, z, s, ping) {
    const st = match.state;
    b.lastBark = st.t;
    b.stats.barks++;
    const p = { faction: b.f, text, lm: L ? L.id : null, kind, x: x === undefined ? null : x, z: z === undefined ? null : z, squad: s ? s.idx : null };
    if (ping) { p.ping = true; p.eta = ping; }
    match.emit('aiBark', p);
  }

  // ------------------------------------------------------------------ debug
  function debug(match, f) {
    const list = brains.get(match);
    const b = list && list[f];
    if (!b) return null;
    const st = match.state;
    return {
      personality: b.persKey, difficulty: b.diffKey, mix: b.mix.map((v) => Math.round(v * 100) / 100), core: b.core ? Object.keys(b.core) : null,
      squads: b.squads.map((s) => ({ key: s.key, idx: s.idx, n: s.ids.length, target: s.target >= 0 ? st.landmarks[s.target].id : null, mode: s.mode, defend: s.defend, feint: !!s.feint })),
      stats: Object.assign({}, b.stats),
    };
  }

  SQ.AI = { init, tick, debug, PERSONALITIES, DIFFICULTIES };
})(window.SQ = window.SQ || {});
