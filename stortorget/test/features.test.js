"use strict";

const test = require("node:test");
const assert = require("assert/strict");
const { Game } = require("../js/engine.js");
const levels = require("../js/levels.js");
const { buildReport } = require("../js/report.js");
const { runPersona } = require("../tools/personas.js");

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

function assertClose(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} did not equal ${expected}`);
}
