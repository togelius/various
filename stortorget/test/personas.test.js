"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { Game } = require("../js/engine.js");
const levels = require("../js/levels.js");
const {
  PERSONAS,
  SCENARIOS,
  runPersona,
  createScenarioLevels,
  createRng,
} = require("../tools/personas.js");

const canonicalSnapshot = JSON.stringify(levels);
const resultCache = new Map();

function resultFor(persona, scenario = "baseline", seed = 7) {
  const key = `${persona}:${scenario}:${seed}`;
  if (!resultCache.has(key)) {
    resultCache.set(key, runPersona(persona, { scenario, seed, decisionLog: true }));
  }
  return resultCache.get(key);
}

test("persona and scenario catalogs expose distinct numeric strategies and content modifiers", () => {
  assert.ok(PERSONAS.length >= 5 && PERSONAS.length <= 6);
  assert.equal(new Set(PERSONAS.map((persona) => persona.id)).size, PERSONAS.length);
  for (const id of ["allrounder", "rookie", "striker", "warden", "architect"]) {
    assert.ok(PERSONAS.some((persona) => persona.id === id), `Missing ${id}`);
  }
  for (const persona of PERSONAS) {
    assert.ok(persona.strategy >= 0 && persona.strategy <= 1);
    assert.ok(persona.reaction >= 0 && persona.reaction <= 1);
    assert.ok(persona.noise >= 0 && persona.noise < 1);
    for (const weight of ["damage", "control", "support", "coverage", "economy", "upgrade", "synergy", "safety"]) {
      assert.ok(Number.isFinite(persona.weights[weight]) && persona.weights[weight] >= 0);
    }
  }
  assert.equal(new Set(PERSONAS.map((persona) => JSON.stringify(persona.weights))).size, PERSONAS.length);
  assert.deepStrictEqual(SCENARIOS.map((scenario) => scenario.id), ["baseline", "fortified", "rush", "lean-start"]);
  assert.ok(SCENARIOS.some((scenario) => scenario.enemyHpScale !== 1));
  assert.ok(SCENARIOS.some((scenario) => scenario.spawnTempo !== 1));
  assert.ok(SCENARIOS.some((scenario) => scenario.startingMoney !== undefined));
});

test("complete persona games and decision streams are deterministic", () => {
  const first = runPersona("rookie", { scenario: "rush", seed: 23, decisionLog: true });
  const replay = runPersona("rookie", { scenario: "rush", seed: 23, decisionLog: true });
  assert.deepStrictEqual(replay, first);
  assert.ok(first.decisions.some((decision) => decision.action === "build"));
  assert.ok(first.simulatedSteps > 0);

  const decisionA = createRng(23, "decision");
  const decisionB = createRng(23, "decision");
  const cosmetic = createRng(23, "cosmetic");
  const decisions = Array.from({ length: 5 }, () => decisionA());
  assert.deepStrictEqual(Array.from({ length: 5 }, () => decisionB()), decisions);
  assert.notDeepStrictEqual(Array.from({ length: 5 }, () => cosmetic()), decisions);
});

test("personas make different build, upgrade, and early-call decisions", () => {
  const results = PERSONAS.map((persona) => resultFor(persona.id));
  const signatures = results.map((result) => result.decisions
    .filter((decision) => decision.action === "build" || decision.action === "upgrade")
    .map((decision) => `${decision.action}:${decision.type}:${decision.padId || decision.towerId}`)
    .join("|"));
  assert.ok(new Set(signatures).size >= 5, "Personas should not collapse into one fixed build order");

  const striker = resultFor("striker");
  const warden = resultFor("warden");
  const rookie = resultFor("rookie");
  assert.ok(striker.earlyBonus > warden.earlyBonus + 30, "Early-call preferences should affect the economy");
  assert.ok(rookie.reachedWave < resultFor("allrounder").reachedWave || rookie.leakDamage > resultFor("allrounder").leakDamage,
    "The rookie should be meaningfully weaker than the competent baseline");

  const padIds = new Set(levels.BUILD_PADS.map((pad) => pad.id));
  for (const result of results) {
    assert.ok(result.towers.length > 0);
    assert.ok(result.towers.every((tower) => padIds.has(tower.padId)));
    assert.equal(Object.values(result.towerCounts).reduce((sum, count) => sum + count, 0), result.towerCount);
  }
});

test("scenario generation clones prepared content and leaves canonical levels immutable", () => {
  for (const scenario of SCENARIOS) {
    const copy = createScenarioLevels(scenario.id);
    assert.notStrictEqual(copy, levels);
    assert.notStrictEqual(copy.WAVES, levels.WAVES);
    assert.notStrictEqual(copy.ROUTES, levels.ROUTES);
    assert.notStrictEqual(copy.BUILD_PADS, levels.BUILD_PADS);
    copy.WAVES.forEach((wave, waveIndex) => {
      assert.ok(Math.abs(wave.hpScale - levels.WAVES[waveIndex].hpScale * scenario.enemyHpScale) < 1e-9);
      wave.groups.forEach((group, groupIndex) => {
        const original = levels.WAVES[waveIndex].groups[groupIndex];
        assert.ok(Math.abs(group.at - original.at * scenario.spawnTempo) < 1e-9);
        assert.ok(Math.abs(group.every - original.every * scenario.spawnTempo) < 1e-9);
      });
    });
    copy.ROUTES.forEach((route) => {
      assert.ok(route.length > 0);
      assert.equal(route.segments.length, route.points.length - 1);
    });
    if (scenario.startingMoney !== undefined) assert.equal(copy.CONFIG.startingMoney, scenario.startingMoney);
  }

  createScenarioLevels("rush").WAVES[0].groups[0].count = 999;
  assert.equal(levels.WAVES[0].groups[0].count, 8);
  resultFor("architect", "fortified");
  assert.equal(JSON.stringify(levels), canonicalSnapshot, "Simulation must not mutate canonical content");
});

test("custom cloned levels work in the engine and through runPersona", () => {
  const custom = createScenarioLevels({
    id: "custom-check",
    enemyHpScale: 1.1,
    spawnTempo: 0.9,
    startingMoney: 210,
  });
  const game = new Game({ levels: custom });
  assert.equal(game.money, 210);
  assert.equal(game.buildTower("soder-north", "falafel").ok, true);
  assert.equal(game.startWave(), true);
  for (let index = 0; index < 20; index += 1) game.update(0.1);
  assert.ok(game.enemies.length > 0);
  assert.ok(game.enemies.every((enemy) => Number.isFinite(enemy.x) && Number.isFinite(enemy.y)));

  const result = runPersona("allrounder", { levels: custom, seed: 7 });
  assert.equal(result.scenario, "custom");
  assert.ok(result.reachedWave >= 4);
  assert.equal(JSON.stringify(levels), canonicalSnapshot);
});

test("competent baseline play is viable and every default scenario has a clearable opening", () => {
  for (const persona of ["allrounder", "striker", "architect"]) {
    const result = resultFor(persona);
    assert.equal(result.outcome, "won", `${persona} should be viable on baseline content`);
    assert.equal(result.reachedWave, levels.WAVES.length);
    assert.ok(result.health > 0);
  }
  for (const scenario of SCENARIOS) {
    const result = resultFor("allrounder", scenario.id);
    assert.ok(result.perWave.length > 0, `${scenario.id} did not start a wave`);
    assert.equal(result.perWave[0].outcome, "cleared", `${scenario.id} has an impossible baseline opening`);
    assert.ok(result.perWave[0].kills > 0);
    assert.ok(result.reachedWave >= 4, `${scenario.id} should allow meaningful progress`);
  }

  const rookie = resultFor("rookie");
  assert.ok(rookie.reachedWave >= 4, "A rookie should make meaningful progress, not necessarily win");
  assert.ok(rookie.kills >= 20);
});

test("architect and warden exercise espresso support and vind knockback in real games", () => {
  const architect = resultFor("architect");
  assert.ok(architect.spentByType.espresso > 0);
  assert.ok(architect.towerCounts.espresso > 0);
  assert.ok(architect.supportedTowers > 0, "Espresso should actually cover an attacking ally");
  assert.ok(architect.maxFireRateMultiplier > 1);
  assert.equal(architect.shotsByType.espresso, 0, "Support carts should not fire");

  const warden = resultFor("warden");
  assert.ok(warden.spentByType.vind > 0);
  assert.ok(warden.shotsByType.vind > 0);
  assert.ok(warden.damageByType.vind > 0);
  assert.ok(warden.knockback > 0, "Wind should move at least one living attacker backwards");
});

test("rich telemetry reconciles and the simulation guard stops incomplete games", () => {
  const result = resultFor("allrounder");
  assert.equal(result.perWave.reduce((sum, wave) => sum + wave.kills, 0), result.kills);
  assert.equal(result.perWave.reduce((sum, wave) => sum + wave.leaks, 0), result.leaks);
  assert.equal(Object.values(result.damageByType).reduce((sum, value) => sum + value, 0), result.damage);
  assert.equal(Object.values(result.shotsByType).reduce((sum, value) => sum + value, 0), result.shots);
  assert.equal(Object.values(result.spentByType).reduce((sum, value) => sum + value, 0), result.spent);
  assert.equal(result.fikaUses, result.decisions.filter((decision) => decision.action === "fika").length);

  const stopped = runPersona("allrounder", { maxSeconds: 0.2, seed: 7 });
  assert.equal(stopped.outcome, "timeout");
  assert.ok(stopped.simulatedSteps <= 2);
  assert.ok(stopped.elapsed <= 0.2000001);
  assert.throws(() => runPersona("allrounder", { step: 0 }), /step/);
});
