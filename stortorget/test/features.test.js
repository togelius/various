"use strict";

const test = require("node:test");
const assert = require("assert/strict");
const { Game } = require("../js/engine.js");
const levels = require("../js/levels.js");
const { buildReport } = require("../js/report.js");
const { runPersona } = require("../tools/personas.js");
const { parseArguments } = require("../tools/balance-lab.js");

test("target priorities select first, strongest, and fastest attackers with stable ties", () => {
  const game = new Game();
  const tower = game.buildTower("sq-se", "falafel").tower;
  game.enemies = [
    { id: 1, x: tower.x, y: tower.y, progress: 0.9, maxHp: 34, hp: 34, speed: 18, dead: false, type: "basic" },
    { id: 2, x: tower.x, y: tower.y, progress: 0.5, maxHp: 125, hp: 125, speed: 11.5, dead: false, type: "tank" },
    { id: 3, x: tower.x, y: tower.y, progress: 0.6, maxHp: 25, hp: 25, speed: 29, dead: false, type: "runner" },
  ];
  assert.equal(game.findTarget(tower, 100).id, 1);
  assert.equal(game.setTargetMode(tower.id, "strong"), true);
  assert.equal(game.findTarget(tower, 100).id, 2);
  assert.equal(game.setTargetMode(tower.id, "fast"), true);
  assert.equal(game.findTarget(tower, 100).id, 3);
  assert.equal(game.cycleTargetMode(tower.id), "first");
  assert.equal(game.setTargetMode(tower.id, "sideways"), false);

  const support = game.buildTower("sq-ne", "espresso").tower;
  assert.equal(game.setTargetMode(support.id, "strong"), false);
});

test("landmarks boost only matching towers in their actual map area", () => {
  const game = new Game({ config: { startingMoney: 1000 } });
  const cafe = game.buildTower("lilla-torg", "espresso").tower;
  assertClose(game.getTowerStats(cafe).haste, 0.22);
  assert.ok(game.getLandmarkModifiers(cafe).ids.includes("lilla-torg"));
  assert.ok(game.getTowerLandmarks(cafe).some((landmark) => landmark.name === "Lilla Torg"));

  const outside = game.buildTower("sq-ne", "espresso").tower;
  assertClose(game.getTowerStats(outside).haste, 0.16);
  const windy = game.buildTower("petribron", "vind").tower;
  assertClose(game.getTowerStats(windy).knockback, 6.25);
  const calm = game.buildTower("soder-north", "vind").tower;
  assertClose(game.getTowerStats(calm).knockback, 5);
});

test("Central batches the same scheduled attackers into trains with a visible next arrival", () => {
  const game = new Game();
  game.currentWave = 7;
  game.phase = "intermission";
  game.intermission = 20;
  assert.equal(game.startWave(), true);
  const wave = game.getWave();
  const expected = wave.groups.reduce((sum, group) => sum + group.count, 0);
  assert.equal(game.spawnQueue.length, expected, "Train scheduling must not add attackers");
  const central = game.spawnQueue.filter((item) => item.routeId === "centralen");
  assert.ok(central.every((item) => item.train));
  assert.ok(game.spawnQueue.filter((item) => !item.train).every((item) => item.routeId !== "centralen"));
  const firstBatch = central.filter((item) => item.time === 0);
  assert.equal(firstBatch.length, 3);
  assert.ok(central.some((item) => Math.abs(item.time - 3.6) < 1e-9));
  assert.ok(central.some((item) => item.typeId === "boss" && item.batchSize === 1));

  game.update(0.05);
  const events = game.drainEvents();
  assert.ok(events.some((event) => event.type === "train" && event.count === 3));
  assert.equal(game.enemies.filter((enemy) => enemy.train).length, 3);
  const next = game.getNextTrainArrival();
  assert.ok(next && next.in > 3 && next.in < 3.6);
  assert.ok(next.count > 0);
});

test("boss telegraphs once, charges, recovers, and cannot retrigger", () => {
  const game = new Game();
  game.currentWave = 8;
  game.phase = "wave";
  game.spawnQueue = [];
  game.spawnEnemy({ routeId: "centralen", typeId: "boss" });
  const boss = game.enemies[0];
  boss.hp = boss.maxHp * 0.6;
  game.damageEnemy(boss, boss.maxHp * 0.1, "falafel");
  assert.equal(boss.bossPhase, "telegraph");
  assert.equal(game.stats.bossPhases, 1);

  const startDistance = boss.distance;
  game.update(1);
  assert.equal(boss.bossPhase, "telegraph");
  assert.equal(boss.distance, startDistance, "The warning is a damage window, not movement");
  game.update(1.3);
  assert.equal(boss.bossPhase, "charge");
  const chargeStart = boss.distance;
  game.update(1);
  assert.ok(boss.distance > chargeStart + boss.speed * 1.5, "Charge is faster than normal movement");
  game.update(3.1);
  assert.equal(boss.bossPhase, "recover");
  game.update(1.6);
  assert.equal(boss.bossPhase, null);
  game.damageEnemy(boss, 1, "falafel");
  assert.equal(game.stats.bossPhases, 1, "The phase happens once per boss");
});

test("battle report identifies tower value, leak routes, and the hardest wave", () => {
  const game = new Game();
  game.buildTower("soder-north", "falafel");
  game.startWave();
  game.update(0.05);
  const stopped = game.enemies[0];
  game.damageEnemy(stopped, 1e9, "falafel");
  game.spawnEnemy({ routeId: "sodergatan", typeId: "basic" });
  const leaked = game.enemies.find((enemy) => !enemy.dead);
  leaked.distance = game.getRoute(leaked.routeId).length;
  game.update(0.05);
  game.phase = "lost";
  game.finishWaveRecord("lost");

  const report = buildReport(game);
  assert.equal(report.mostDamage.type, "falafel");
  assert.equal(report.bestValue.type, "falafel");
  assert.ok(Number.isFinite(report.bestValue.efficiency) && report.bestValue.efficiency > 0);
  assert.equal(report.topLeakRoute.routeId, "sodergatan");
  assert.equal(report.hardestWave.wave, 1);
  assert.equal(report.hardestWave.outcome, "lost");
  assert.equal(report.killPoints.length, 1);
  assert.equal(report.leakPoints.length, 1);
  assert.equal(report.dominantType, "falafel");
  assert.equal(report.dominantShare, 1);
});

test("personas exercise target priorities in real games", () => {
  const result = runPersona("striker", { seed: 7, decisionLog: true });
  assert.ok(result.decisions.some((decision) => decision.targetMode === "strong"));
  assert.ok(result.outcome === "won" || result.reachedWave >= 4);
});

test("random mode generates deterministic street routes while fixed mode preserves the originals", () => {
  const first = new Game({ routeMode: "random", seed: 42 });
  const second = new Game({ routeMode: "random", seed: 42 });
  const fixed = new Game({ routeMode: "fixed", seed: 42 });
  for (const game of [first, second, fixed]) {
    game.startWave();
    game.update(0.05);
  }
  const enemy = first.enemies[0];
  assert.equal(first.routeMode, "random");
  assert.equal(enemy.route.randomized, true);
  assert.equal(enemy.routeId, "sodergatan");
  assert.equal(enemy.route.entryId, "sodergatan");
  assert.deepEqual(enemy.route.points.at(-1), { x: 244.4, y: 269.5 });
  assert.ok(enemy.route.length <= enemy.route.baseLength * 1.65 + 1e-9);
  assert.ok(enemy.speed >= 18 * 0.8 && enemy.speed <= 18 * 1.15);
  assert.deepEqual(enemy.route.points, second.enemies[0].route.points);
  assert.equal(enemy.speed, second.enemies[0].speed);
  assert.equal(fixed.enemies[0].route.randomized, undefined);
  assert.deepEqual(fixed.enemies[0].route.points, fixed.getRoute("sodergatan").points);
});

test("overlapping early calls preserve wave ownership and pay completion rewards once", () => {
  const game = new Game();
  game.startWave();
  game.update(0.05);
  const first = game.enemies[0];
  game.spawnQueue = [];
  game.update(0.05);
  assert.equal(game.canStartWave(), true);
  const moneyBefore = game.money;
  assert.equal(game.startWave(), true);
  assert.equal(game.currentWave, 2);
  assert.equal(game.stats.overlapCalls, 1);
  assert.equal(game.stats.earlyBonus, 10);
  assert.equal(game.money, moneyBefore + 10);
  assert.ok(game.enemies.includes(first), "The old wave must remain on the map");
  assert.equal(game.waveStates.size, 2);

  game.damageEnemy(first, 1e9, "falafel");
  game.update(0.05);
  assert.ok(game.history.waves.some((wave) => wave.wave === 1 && wave.outcome === "cleared"));
  assert.equal(game.phase, "wave", "The second wave remains active after the first is rewarded");
  assert.equal(game.history.waves.filter((wave) => wave.wave === 1).length, 1);

  game.spawnQueue = [];
  for (const enemy of [...game.enemies]) game.damageEnemy(enemy, 1e9, "falafel");
  game.update(0.05);
  assert.equal(game.history.waves.filter((wave) => wave.wave === 2).length, 1);
  assert.equal(game.history.waves.length, 2);
  assert.equal(game.phase, "intermission");
});

test("armour resists splash while Shatter rewards slow plus mortar without changing single-target damage", () => {
  const game = new Game();
  game.currentWave = 4;
  game.phase = "wave";
  game.spawnQueue = [];
  game.spawnEnemy({ routeId: "djaknegatan", typeId: "armored" });
  const enemy = game.enemies[0];
  const projectile = { type: "bulle", damage: 40, splash: 20, x: enemy.x, y: enemy.y };
  game.impactProjectile(projectile, enemy);
  assertClose(enemy.maxHp - enemy.hp, 18, 1e-9, "Armour reduces the base splash to 45%");
  enemy.slowTimer = 1;
  game.impactProjectile(projectile, enemy);
  assertClose(enemy.maxHp - enemy.hp, 40.5, 1e-9, "Shatter adds 25% to the reduced splash");
  assertClose(game.stats.shatterDamage, 4.5);
  assert.ok(game.drainEvents().some((event) => event.type === "shatter"));

  const singleTargetHp = enemy.hp;
  game.impactProjectile({ type: "falafel", damage: 10, heavyBonus: 1, splash: 0, slowDuration: 0, knockback: 0 }, enemy);
  assertClose(singleTargetHp - enemy.hp, 10, 1e-9, "Single-target hits ignore splash resistance");
});

test("Dannebrog bearers speed nearby allies without stacking or buffing themselves", () => {
  const game = new Game();
  game.currentWave = 5;
  game.phase = "wave";
  game.spawnEnemy({ routeId: "lillatorg", typeId: "banner" });
  game.spawnEnemy({ routeId: "lillatorg", typeId: "basic" });
  const [banner, ally] = game.enemies;
  ally.x = banner.x + 20;
  ally.y = banner.y;
  assertClose(game.getBannerBoost(ally), 1.22);
  assertClose(game.getBannerBoost(banner), 1);
  banner.x += 100;
  assertClose(game.getBannerBoost(ally), 1);
});

test("aggressive personas make bounded overlap calls and random runs replay by route seed", () => {
  const aggressive = runPersona("striker", { seed: 7, decisionLog: true });
  assert.ok(aggressive.decisions.some((decision) => decision.action === "overlap-call"));
  assert.equal(aggressive.outcome, "won");
  const first = runPersona("allrounder", { routeMode: "random", routeSeed: 123, seed: 7 });
  const replay = runPersona("allrounder", { routeMode: "random", routeSeed: 123, seed: 7 });
  assert.deepEqual(replay, first);
  assert.equal(first.routeMode, "random");
  assert.equal(first.routeSeed, 123);
});

test("random routes remain viable under both editions", () => {
  for (const mode of ["american", "skanska"]) {
    const result = runPersona("allrounder", { mode, routeMode: "random", routeSeed: 42, seed: 7 });
    assert.equal(result.outcome, "won", `${mode} should clear a random-route run`);
    assert.equal(result.routeMode, "random");
    assert.equal(result.routeSeed, 42);
  }
});

test("balance CLI separates route generation from decision seeds", () => {
  const options = parseArguments(["--routes", "random", "--route-seed", "123", "--seed", "7", "--deep"]);
  assert.equal(options.routes, "random");
  assert.equal(options.routeSeed, 123);
  assert.equal(options.seed, 7);
  assert.equal(options.deep, true);
  assert.throws(() => parseArguments(["--routes", "random-ish"]), /fixed or random/);
});

function assertClose(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} did not equal ${expected}`);
}
