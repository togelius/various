"use strict";

const { Game } = require("../js/engine.js");
const canonicalLevels = require("../js/levels.js");

const PERSONAS = [
  {
    id: "allrounder",
    name: "Allrounder",
    description: "A competent baseline balancing damage, coverage, upgrades, and economy.",
    strategy: 0.86,
    reaction: 0.78,
    noise: 0.025,
    earlyCall: 0.74,
    purchaseLimit: 4,
    reserve: 10,
    fikaThreshold: 2.6,
    repeatPenalty: 0.12,
    weights: {
      damage: 1,
      control: 0.65,
      support: 0.9,
      coverage: 1,
      economy: 0.45,
      upgrade: 1.05,
      synergy: 0.8,
      safety: 0.8,
    },
    typeWeights: { falafel: 1.08, bulle: 1, glass: 0.85, espresso: 0.9, vind: 0.9 },
  },
  {
    id: "rookie",
    name: "Rookie",
    description: "A noisy, short-horizon player with slow reactions and a panic-prone fika finger.",
    strategy: 0.25,
    reaction: 0.22,
    noise: 0.38,
    earlyCall: 0.44,
    purchaseLimit: 1,
    reserve: 40,
    fikaThreshold: 1.35,
    repeatPenalty: 0.06,
    weights: {
      damage: 0.85,
      control: 0.35,
      support: 0.25,
      coverage: 0.58,
      economy: 0.18,
      upgrade: 0.65,
      synergy: 0.25,
      safety: 0.5,
    },
    typeWeights: { falafel: 1, bulle: 1.08, glass: 0.85, espresso: 0.7, vind: 0.9 },
  },
  {
    id: "striker",
    name: "Striker",
    description: "A damage-focused player who calls waves early and values concentrated upgrades.",
    strategy: 0.78,
    reaction: 0.85,
    noise: 0.055,
    earlyCall: 0.98,
    purchaseLimit: 4,
    reserve: 0,
    fikaThreshold: 3.25,
    repeatPenalty: 0.08,
    weights: {
      damage: 1.55,
      control: 0.25,
      support: 0.35,
      coverage: 0.9,
      economy: 0.3,
      upgrade: 1.15,
      synergy: 0.45,
      safety: 0.35,
    },
    typeWeights: { falafel: 1.18, bulle: 1.22, glass: 0.55, espresso: 0.45, vind: 0.55 },
  },
  {
    id: "warden",
    name: "Warden",
    description: "A cautious controller favouring slows, knockback, safe exits, and late wave calls.",
    strategy: 0.82,
    reaction: 0.72,
    noise: 0.04,
    earlyCall: 0.16,
    purchaseLimit: 4,
    reserve: 25,
    fikaThreshold: 1.9,
    repeatPenalty: 0.24,
    weights: {
      damage: 0.8,
      control: 1.65,
      support: 0.75,
      coverage: 1.12,
      economy: 0.58,
      upgrade: 0.95,
      synergy: 0.9,
      safety: 1.35,
    },
    typeWeights: { falafel: 0.82, bulle: 0.85, glass: 1.35, espresso: 0.8, vind: 1.28 },
  },
  {
    id: "architect",
    name: "Architect",
    description: "A long-horizon builder seeking espresso synergies and efficient upgrades.",
    strategy: 0.95,
    reaction: 0.68,
    noise: 0.02,
    earlyCall: 0.55,
    purchaseLimit: 5,
    reserve: 10,
    fikaThreshold: 2.7,
    repeatPenalty: 0.18,
    weights: {
      damage: 0.82,
      control: 0.72,
      support: 2.15,
      coverage: 1.04,
      economy: 0.55,
      upgrade: 1.7,
      synergy: 1.6,
      safety: 0.75,
    },
    typeWeights: { falafel: 0.92, bulle: 0.95, glass: 0.85, espresso: 1.65, vind: 0.9 },
  },
  {
    id: "sprinter",
    name: "Sprinter",
    description: "A fast but imprecise player who spends freely, rushes waves, and reacts quickly.",
    strategy: 0.58,
    reaction: 0.96,
    noise: 0.16,
    earlyCall: 0.99,
    purchaseLimit: 3,
    reserve: 0,
    fikaThreshold: 1.65,
    repeatPenalty: 0.1,
    weights: {
      damage: 1.15,
      control: 0.5,
      support: 0.4,
      coverage: 0.75,
      economy: 0.05,
      upgrade: 0.7,
      synergy: 0.4,
      safety: 0.25,
    },
    typeWeights: { falafel: 1.05, bulle: 1.15, glass: 0.9, espresso: 0.65, vind: 0.9 },
  },
];

const SCENARIOS = [
  {
    id: "baseline",
    name: "Baseline",
    description: "The canonical content without modifiers.",
    enemyHpScale: 1,
    spawnTempo: 1,
  },
  {
    id: "fortified",
    name: "Fortified attackers",
    description: "Attackers have 25% more health; spawn timing and funds are unchanged.",
    enemyHpScale: 1.25,
    spawnTempo: 1,
  },
  {
    id: "rush",
    name: "Rush hour",
    description: "Group delays and intervals are 25% shorter, producing a denser attack.",
    enemyHpScale: 1,
    spawnTempo: 0.75,
  },
  {
    id: "lean-start",
    name: "Lean start",
    description: "Only 180 kr are available before wave one instead of 240 kr.",
    enemyHpScale: 1,
    spawnTempo: 1,
    startingMoney: 180,
  },
];

function cloneData(value) {
  if (Array.isArray(value)) return value.map(cloneData);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneData(item)]));
  }
  return value;
}

function resolvePersona(reference = "allrounder") {
  if (reference && typeof reference === "object" && reference.id) return reference;
  const persona = PERSONAS.find((item) => item.id === reference);
  if (!persona) throw new Error(`Unknown persona: ${reference}`);
  return persona;
}

function resolveScenario(reference = "baseline") {
  if (reference && typeof reference === "object" && reference.id) {
    return { enemyHpScale: 1, spawnTempo: 1, ...reference };
  }
  const scenario = SCENARIOS.find((item) => item.id === reference);
  if (!scenario) throw new Error(`Unknown scenario: ${reference}`);
  return scenario;
}

function createScenarioLevels(reference = "baseline", source = canonicalLevels) {
  const scenario = resolveScenario(reference);
  const copy = cloneData(source);
  const hpScale = scenario.enemyHpScale ?? 1;
  const tempo = scenario.spawnTempo ?? 1;
  if (!Number.isFinite(hpScale) || hpScale <= 0 || !Number.isFinite(tempo) || tempo <= 0) {
    throw new Error("Scenario HP scale and spawn tempo must be positive finite numbers");
  }

  for (const wave of copy.WAVES) {
    wave.hpScale *= hpScale;
    for (const group of wave.groups) {
      group.at *= tempo;
      group.every *= tempo;
    }
  }
  if (scenario.startingMoney !== undefined) {
    if (!Number.isFinite(scenario.startingMoney) || scenario.startingMoney < 0) {
      throw new Error("Scenario starting money must be a non-negative finite number");
    }
    copy.CONFIG.startingMoney = scenario.startingMoney;
  }
  return copy;
}

function hashString(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed, stream = "decision") {
  let state = (Number(seed) ^ hashString(stream)) >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function routeSamples(route, pointOnRoute, spacing = 8) {
  const samples = [];
  for (let distance = 0; distance < route.length; distance += spacing) {
    const point = pointOnRoute(route, distance);
    samples.push({ ...point, distance, progress: distance / route.length, step: spacing });
  }
  const end = pointOnRoute(route, route.length);
  samples.push({ ...end, distance: route.length, progress: 1, step: Math.min(spacing, route.length % spacing || spacing) });
  return samples;
}

function createGeometry(gameLevels) {
  const pointOnRoute = gameLevels.pointOnRoute || canonicalLevels.pointOnRoute;
  const sampledRoutes = new Map(gameLevels.ROUTES.map((route) => [route.id, routeSamples(route, pointOnRoute)]));
  const coverageCache = new Map();

  function coverage(pad, range) {
    const key = `${pad.id}:${range}`;
    if (coverageCache.has(key)) return coverageCache.get(key);
    const byRoute = {};
    for (const route of gameLevels.ROUTES) {
      let exposure = 0;
      let endExposure = 0;
      for (const sample of sampledRoutes.get(route.id)) {
        if (Math.hypot(sample.x - pad.x, sample.y - pad.y) > range) continue;
        exposure += sample.step;
        if (sample.progress >= 0.65) endExposure += sample.step * (0.75 + sample.progress * 0.5);
      }
      byRoute[route.id] = { exposure, endExposure };
    }
    const result = { byRoute };
    coverageCache.set(key, result);
    return result;
  }

  return { coverage };
}

function waveTraits(game) {
  const wave = game.getNextWave();
  if (!wave) return { splash: 0, runners: 0, tanks: 0, bosses: 0 };
  let count = 0;
  let runners = 0;
  let tanks = 0;
  let bosses = 0;
  let spawnSeconds = 0;
  for (const group of wave.groups) {
    count += group.count;
    if (group.type === "runner") runners += group.count;
    if (group.type === "tank") tanks += group.count;
    if (group.type === "boss") bosses += group.count;
    spawnSeconds = Math.max(spawnSeconds, group.at + group.every * Math.max(0, group.count - 1));
  }
  const density = count / Math.max(12, spawnSeconds);
  return {
    splash: Math.min(1, count / 24) * Math.min(1, density / 1.25) * (bosses ? 0.45 : 1),
    runners: count ? runners / count : 0,
    tanks: count ? tanks / count : 0,
    bosses: count ? bosses / count : 0,
  };
}

function planningContext(game, persona, geometry) {
  const routeWeights = Object.fromEntries(game.levels.ROUTES.map((route) => [route.id, 0.012]));
  const horizon = 1 + Math.round(persona.strategy * 3);
  for (let offset = 0; offset < horizon; offset += 1) {
    const wave = game.levels.WAVES[game.currentWave + offset];
    if (!wave) break;
    const weight = offset === 0 ? 1 : (0.42 * persona.strategy) / offset;
    for (const routeId of wave.routes) routeWeights[routeId] += weight;
  }
  return { routeWeights, traits: waveTraits(game), geometry };
}

function exposureValue(coverage, context, safetyWeight) {
  let exposure = 0;
  for (const [routeId, metric] of Object.entries(coverage.byRoute)) {
    const weight = context.routeWeights[routeId] || 0;
    exposure += weight * (metric.exposure + metric.endExposure * safetyWeight * 0.32);
  }
  return exposure / 20;
}

function attackDps(stats) {
  return stats && stats.damage ? stats.damage / stats.rate : 0;
}

function situationalTypeMultiplier(typeId, stats, traits, strategy) {
  let multiplier = 1;
  if (typeId === "bulle" && stats.splash) multiplier += 0.55 * traits.splash;
  if (typeId === "falafel") multiplier += traits.tanks * 0.12 + traits.bosses * 0.18;
  if (typeId === "glass") multiplier += traits.runners * 0.28;
  if (typeId === "vind") multiplier += traits.runners * 0.16 - traits.bosses * 0.35;
  return 1 + (multiplier - 1) * (0.35 + strategy * 0.65);
}

function strongestAuraAt(game, pad) {
  let haste = 0;
  for (const support of game.towers) {
    const definition = game.levels.TOWER_TYPES[support.type];
    if (!definition.support) continue;
    const stats = game.getTowerStats(support);
    if (Math.hypot(support.x - pad.x, support.y - pad.y) <= stats.range) {
      haste = Math.max(haste, stats.haste || 0);
    }
  }
  return haste;
}

function nearbyControlCount(game, pad) {
  return game.towers.filter((tower) => {
    const stats = game.getTowerStats(tower);
    return (stats.slowDuration || stats.knockback) && Math.hypot(tower.x - pad.x, tower.y - pad.y) <= 90;
  }).length;
}

function costAdjusted(rawScore, cost, persona) {
  const efficiency = 1 + (persona.weights.economy * cost) / 160;
  return rawScore / efficiency - persona.weights.economy * cost * 0.035;
}

function scoreBuild(game, pad, typeId, persona, context) {
  const definition = game.levels.TOWER_TYPES[typeId];
  const stats = definition.levels[0];
  const exposure = exposureValue(context.geometry.coverage(pad, stats.range), context, persona.weights.safety);
  const typeWeight = persona.typeWeights[typeId] || 1;
  const situational = situationalTypeMultiplier(typeId, stats, context.traits, persona.strategy);
  const aura = definition.support ? 0 : strongestAuraAt(game, pad);
  let damage = attackDps(stats) * (1 + aura) * exposure * persona.weights.damage;
  let control = 0;
  let support = 0;
  let synergy = aura * attackDps(stats) * exposure * persona.weights.synergy * 0.45;

  if (stats.splash) damage *= 1 + 0.55 * context.traits.splash;
  if (stats.slowDuration) {
    control = exposure * (7 + 12 * (1 - stats.slowFactor)) * (1 + stats.slowDuration / 5) * persona.weights.control;
  }
  if (stats.knockback) {
    control = exposure * (6 + stats.knockback * 0.65) * persona.weights.control;
  }
  const controlOverlap = (stats.slowDuration || stats.knockback) ? nearbyControlCount(game, pad) : 0;
  if (controlOverlap) control /= 1 + controlOverlap * 0.65;
  if (!definition.support && !controlOverlap && nearbyControlCount(game, pad)) {
    synergy += Math.min(2, nearbyControlCount(game, pad)) * attackDps(stats) * exposure * persona.weights.synergy * 0.045;
  }
  if (definition.support) {
    let alliedDps = 0;
    let allies = 0;
    for (const tower of game.towers) {
      if (game.levels.TOWER_TYPES[tower.type].support) continue;
      if (Math.hypot(tower.x - pad.x, tower.y - pad.y) > stats.range) continue;
      alliedDps += attackDps(game.getTowerStats(tower));
      allies += 1;
    }
    const confidence = Math.min(1, allies / 2);
    support = alliedDps * stats.haste * Math.max(3, exposure) * confidence * persona.weights.support;
  }

  const sameType = game.towers.filter((tower) => tower.type === typeId).length;
  const variety = 1 / (1 + sameType * persona.repeatPenalty);
  const raw = (damage + control + support + synergy) * persona.weights.coverage * typeWeight * situational * variety;
  return costAdjusted(raw, definition.cost, persona);
}

function scoreUpgrade(game, tower, persona, context) {
  const cost = game.getUpgradeCost(tower);
  if (cost === null) return -Infinity;
  const definition = game.levels.TOWER_TYPES[tower.type];
  const current = game.getTowerStats(tower);
  const next = definition.levels[tower.level];
  const typeWeight = persona.typeWeights[tower.type] || 1;
  const upgradeWeight = persona.weights.upgrade;
  const currentExposure = exposureValue(context.geometry.coverage(tower, current.range), context, persona.weights.safety);
  const nextExposure = exposureValue(context.geometry.coverage(tower, next.range), context, persona.weights.safety);
  const aura = definition.support ? 0 : strongestAuraAt(game, tower);
  let delta = (attackDps(next) * nextExposure - attackDps(current) * currentExposure)
    * (1 + aura) * persona.weights.damage;

  if (next.splash) delta *= 1 + 0.4 * context.traits.splash;
  if (next.slowDuration) {
    const before = currentExposure * (7 + 12 * (1 - current.slowFactor)) * (1 + current.slowDuration / 5);
    const after = nextExposure * (7 + 12 * (1 - next.slowFactor)) * (1 + next.slowDuration / 5);
    delta += (after - before) * persona.weights.control;
  }
  if (next.knockback) {
    const before = currentExposure * (6 + current.knockback * 0.65);
    const after = nextExposure * (6 + next.knockback * 0.65);
    delta += (after - before) * persona.weights.control;
  }
  if (definition.support) {
    const alliedDps = game.towers.reduce((total, ally) => {
      if (ally.id === tower.id || game.levels.TOWER_TYPES[ally.type].support) return total;
      return total + attackDps(game.getTowerStats(ally));
    }, 0);
    const before = alliedDps * current.haste * Math.max(3, currentExposure);
    const after = alliedDps * next.haste * Math.max(3, nextExposure);
    delta += (after - before) * persona.weights.support * 0.65;
  }

  const raw = Math.max(0, delta) * upgradeWeight * typeWeight * persona.weights.coverage
    + 5 * upgradeWeight;
  return costAdjusted(raw, cost, persona);
}

function availableMoney(game, persona) {
  const reserve = game.towers.length ? persona.reserve : 0;
  return Math.max(0, game.money - reserve);
}

function choosePurchase(game, persona, context, random) {
  const candidates = [];
  const funds = availableMoney(game, persona);
  const occupied = new Set(game.towers.map((tower) => tower.padId));
  for (const pad of game.levels.BUILD_PADS) {
    if (occupied.has(pad.id)) continue;
    for (const [typeId, definition] of Object.entries(game.levels.TOWER_TYPES)) {
      if (definition.cost > funds) continue;
      candidates.push({ action: "build", padId: pad.id, type: typeId, cost: definition.cost, score: scoreBuild(game, pad, typeId, persona, context) });
    }
  }
  for (const tower of game.towers) {
    const cost = game.getUpgradeCost(tower);
    if (cost === null || cost > funds) continue;
    candidates.push({ action: "upgrade", towerId: tower.id, type: tower.type, cost, score: scoreUpgrade(game, tower, persona, context) });
  }

  const error = persona.noise + (1 - persona.strategy) * 0.07;
  for (const candidate of candidates) {
    candidate.utility = candidate.score * (1 + (random() * 2 - 1) * error) + random() * 1e-7;
  }
  candidates.sort((a, b) => b.utility - a.utility
    || a.action.localeCompare(b.action)
    || String(a.padId || a.towerId).localeCompare(String(b.padId || b.towerId))
    || a.type.localeCompare(b.type));
  return candidates[0] || null;
}

function planPurchases(game, persona, random, decisions, includeDecisions) {
  const context = planningContext(game, persona, game.geometry);
  const actionLimit = Math.max(1, persona.purchaseLimit);
  for (let action = 0; action < actionLimit; action += 1) {
    const choice = choosePurchase(game, persona, context, random);
    if (!choice || choice.utility < 4) break;
    let result;
    if (choice.action === "build") {
      result = game.buildTower(choice.padId, choice.type);
    } else {
      result = game.upgradeTower(choice.towerId);
    }
    if (!result.ok) break;
    if (includeDecisions) {
      decisions.push({
        at: Number(game.elapsed.toFixed(3)),
        wave: game.currentWave + 1,
        action: choice.action,
        type: choice.type,
        ...(choice.padId ? { padId: choice.padId } : { towerId: choice.towerId }),
        level: result.tower.level,
        utility: Number(choice.utility.toFixed(3)),
      });
    }
  }
}

function fikaThreat(game) {
  let threat = 0;
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const definition = game.levels.ENEMY_TYPES[enemy.type];
    const remaining = 0.45 + 0.55 * (enemy.hp / enemy.maxHp);
    threat += definition.leak * remaining * (0.22 + enemy.progress * enemy.progress * 1.8);
  }
  if (game.health <= 5) threat *= 1.35;
  return threat;
}

function summarizeTowers(game) {
  const towerCounts = Object.fromEntries(Object.keys(game.levels.TOWER_TYPES).map((type) => [type, 0]));
  const towerTypes = Object.fromEntries(Object.keys(game.levels.TOWER_TYPES).map((type) => [type, {
    count: 0,
    totalLevels: 0,
    levels: [],
    invested: 0,
  }]));
  const towers = game.towers.map((tower) => {
    towerCounts[tower.type] += 1;
    const aggregate = towerTypes[tower.type];
    aggregate.count += 1;
    aggregate.totalLevels += tower.level;
    aggregate.levels.push(tower.level);
    aggregate.invested += tower.invested;
    return { padId: tower.padId, type: tower.type, level: tower.level, invested: tower.invested };
  });
  return { towers, towerCounts, towerTypes, towerCount: towers.length };
}

function runPersona(personaReference = "allrounder", options = {}) {
  if (personaReference && typeof personaReference === "object" && !personaReference.weights) {
    options = personaReference;
    personaReference = options.persona || "allrounder";
  }
  const persona = resolvePersona(personaReference);
  const scenario = resolveScenario(options.scenario || "baseline");
  const seed = Number.isInteger(options.seed) ? options.seed : 7;
  const step = options.step ?? 0.1;
  const maxSeconds = options.maxSeconds ?? 900;
  if (!Number.isFinite(step) || step <= 0 || step > 1) throw new Error("step must be in (0, 1]");
  if (!Number.isFinite(maxSeconds) || maxSeconds <= 0) throw new Error("maxSeconds must be positive");

  const decisionRandom = createRng(seed, `decision:${persona.id}`);
  const cosmeticRandom = createRng(seed, `cosmetic:${persona.id}`);
  const flair = ["circle", "diamond", "triangle", "square"][Math.floor(cosmeticRandom() * 4)];
  const gameLevels = options.levels ? cloneData(options.levels) : createScenarioLevels(scenario);
  const game = new Game({ levels: gameLevels, mode: options.mode || null });
  game.geometry = createGeometry(gameLevels);

  const includeDecisions = Boolean(options.decisionLog || options.includeDecisions);
  const decisions = [];
  const perWave = [];
  const reactionDelay = 2.2 - persona.reaction * 1.9;
  const maxSteps = Math.ceil(maxSeconds / step);
  let plannedPhase = null;
  let nextEarlyThink = 0;
  let desiredWait = 0;
  let nextFikaThink = 0;
  let activeWave = null;
  let steps = 0;

  function finishWave(outcome) {
    if (!activeWave) return;
    perWave.push({
      wave: activeWave.wave,
      name: activeWave.name,
      outcome,
      earlyBonus: activeWave.earlyBonus,
      kills: game.stats.kills - activeWave.kills,
      leaks: game.stats.leaks - activeWave.leaks,
      leakDamage: game.stats.leakDamage - activeWave.leakDamage,
      health: game.health,
      money: game.money,
      duration: Number((game.elapsed - activeWave.startedAt).toFixed(3)),
      towers: game.towers.length,
    });
    activeWave = null;
  }

  function processEvents() {
    for (const event of game.drainEvents()) {
      if (event.type === "wave") {
        activeWave = {
          wave: event.wave,
          name: event.name,
          earlyBonus: event.earlyBonus,
          startedAt: game.elapsed,
          kills: game.stats.kills,
          leaks: game.stats.leaks,
          leakDamage: game.stats.leakDamage,
        };
        nextFikaThink = game.elapsed + reactionDelay;
      } else if (event.type === "waveComplete") {
        finishWave("cleared");
      } else if (event.type === "lose") {
        finishWave("lost");
      } else if (event.type === "win") {
        finishWave("cleared");
      }
    }
  }

  function startWave(early) {
    const expectedBonus = early ? Math.max(0, Math.ceil(game.intermission)) : 0;
    if (!game.startWave()) return false;
    if (includeDecisions) {
      decisions.push({
        at: Number(game.elapsed.toFixed(3)),
        wave: game.currentWave,
        action: early ? "early-call" : "start",
        earlyBonus: expectedBonus,
      });
    }
    plannedPhase = null;
    return true;
  }

  while (game.phase !== "won" && game.phase !== "lost" && steps < maxSteps) {
    if (game.phase === "ready" || game.phase === "intermission") {
      const phaseKey = `${game.phase}:${game.currentWave}`;
      if (plannedPhase !== phaseKey) {
        planPurchases(game, persona, decisionRandom, decisions, includeDecisions);
        plannedPhase = phaseKey;
        nextEarlyThink = game.elapsed;
        const earlyNoise = (decisionRandom() * 2 - 1) * persona.noise * 2;
        desiredWait = Math.max(0, Math.min(game.config.intermissionSeconds,
          (1 - persona.earlyCall + earlyNoise) * game.config.intermissionSeconds));
      }

      if (game.phase === "ready") {
        startWave(false);
      } else if (game.elapsed >= nextEarlyThink) {
        const waited = game.config.intermissionSeconds - game.intermission;
        if (waited + 1e-9 >= desiredWait) {
          startWave(true);
        } else {
          nextEarlyThink = game.elapsed + reactionDelay;
        }
      }
    } else if (game.phase === "wave" && game.elapsed >= nextFikaThink) {
      if (game.fikaCooldown <= 0 && game.enemies.length && fikaThreat(game) >= persona.fikaThreshold) {
        const result = game.useFika();
        if (result.ok && includeDecisions) {
          decisions.push({
            at: Number(game.elapsed.toFixed(3)),
            wave: game.currentWave,
            action: "fika",
            threat: Number(fikaThreat(game).toFixed(3)),
          });
        }
      }
      nextFikaThink = game.elapsed + reactionDelay;
    }

    if (game.phase === "won" || game.phase === "lost") break;
    game.update(step);
    steps += 1;
    processEvents();
  }

  if (activeWave) finishWave(game.phase === "won" ? "cleared" : game.phase === "lost" ? "lost" : "timeout");
  game.drainEvents();
  const outcome = game.phase === "won" || game.phase === "lost" ? game.phase : "timeout";
  const maxFireRateMultiplier = game.towers.reduce((maximum, tower) => Math.max(maximum, game.getFireRateMultiplier(tower)), 1);
  const supportedTowers = game.towers.filter((tower) => game.getFireRateMultiplier(tower) > 1).length;

  return {
    persona: persona.id,
    scenario: options.levels && !options.scenario ? "custom" : scenario.id,
    mode: game.mode || "classic",
    seed,
    flair,
    outcome,
    reachedWave: game.currentWave,
    wavesCompleted: perWave.filter((wave) => wave.outcome === "cleared").length,
    health: game.health,
    maxHealth: game.config.maxHealth,
    kills: game.stats.kills,
    leaks: game.stats.leaks,
    leakDamage: game.stats.leakDamage,
    money: game.money,
    earned: game.stats.earned,
    spent: game.stats.spent,
    elapsed: Number(game.elapsed.toFixed(6)),
    fikaUses: game.stats.fikaUses,
    earlyBonus: game.stats.earlyBonus,
    tips: game.stats.tips,
    streakBonus: game.stats.streakBonus,
    sentHome: game.stats.sentHome,
    homeTolls: game.stats.homeTolls,
    gusts: game.stats.gusts,
    damage: game.stats.damage,
    shots: game.stats.shots,
    knockback: game.stats.knockback,
    maxFireRateMultiplier,
    supportedTowers,
    damageByType: { ...game.stats.damageByType },
    shotsByType: { ...game.stats.shotsByType },
    spentByType: { ...game.stats.spentByType },
    ...summarizeTowers(game),
    perWave,
    simulatedSteps: steps,
    ...(includeDecisions ? { decisions } : {}),
  };
}

module.exports = {
  PERSONAS,
  SCENARIOS,
  runPersona,
  createScenarioLevels,
  cloneData,
  createRng,
};
