"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { Game } = require("../js/engine.js");
const levels = require("../js/levels.js");
const { runPersona } = require("../tools/personas.js");

function step(game, seconds, dt = 0.05) {
  const events = [];
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) {
    game.update(dt);
    events.push(...game.drainEvents());
  }
  return events;
}

function spawnWave(game, seconds = 3) {
  assert.equal(game.startWave(), true);
  step(game, seconds);
  const alive = game.enemies.filter((enemy) => !enemy.dead);
  assert.ok(alive.length > 0, "The wave should have spawned attackers");
  return alive;
}

test("modes rescale towers and Danes without touching the canonical content", () => {
  const canonicalCost = levels.TOWER_TYPES.falafel.cost;
  const american = levels.applyMode(levels, "american");
  const skanska = levels.applyMode(levels, "skanska");

  assert.equal(american.mode, "american");
  assert.equal(american.TOWER_TYPES.falafel.cost, 70);
  assert.equal(american.TOWER_TYPES.falafel.name, "Freedom fry truck");
  assert.ok(american.TOWER_TYPES.bulle.levels[0].splash > levels.TOWER_TYPES.bulle.levels[0].splash);
  assert.ok(american.ENEMY_TYPES.basic.hp > levels.ENEMY_TYPES.basic.hp);
  assert.equal(american.CONFIG.fikaKind, "fireworks");

  assert.equal(skanska.TOWER_TYPES.falafel.cost, canonicalCost);
  assert.equal(skanska.TOWER_TYPES.bulle.name, "Spiddekagakastaren");
  assert.ok(skanska.TOWER_TYPES.vind.levels[2].knockback > levels.TOWER_TYPES.vind.levels[2].knockback);
  assert.equal(skanska.WAVES[0].name, "Dom första ålahuena");
  assert.equal(skanska.CONFIG.fikaDuration, 7);

  assert.equal(levels.TOWER_TYPES.falafel.cost, canonicalCost, "applyMode must not mutate the shared levels");
  assert.equal(levels.CONFIG.fikaKind, "slow");
  assert.equal(levels.applyMode(levels, "unknown"), levels);
  assert.equal(new Game().mode, null);
});

test("American kills pay a deterministic tip on top of the bounty", () => {
  const game = new Game({ mode: "american" });
  const [enemy] = spawnWave(game, 0.1);
  const before = game.money;
  game.damageEnemy(enemy, 1e9, "falafel");
  const kill = game.drainEvents().find((event) => event.type === "kill");
  const bounty = game.levels.ENEMY_TYPES[enemy.type].bounty;
  assert.ok(kill.tip >= Math.round(bounty * game.config.tipMin) && kill.tip <= Math.round(bounty * game.config.tipMax));
  assert.equal(game.money, before + bounty + kill.tip);
  assert.equal(game.stats.tips, kill.tip);

  const twin = new Game({ mode: "american" });
  const [twinEnemy] = spawnWave(twin, 0.1);
  twin.damageEnemy(twinEnemy, 1e9, "falafel");
  assert.equal(twin.stats.tips, kill.tip, "Tips are a pure function of the attacker");
});

test("Happy Hour fires volleys that damage every attacker without slowing them", () => {
  const game = new Game({ mode: "american" });
  const attackers = spawnWave(game, 4);
  const health = new Map(attackers.map((enemy) => [enemy.id, enemy.hp]));
  assert.equal(game.useFika().ok, true);
  const events = step(game, game.config.fikaDuration + 0.2);
  const volleys = events.filter((event) => event.type === "fireworks");
  assert.equal(volleys.length, game.config.fireworksVolleys);
  for (const enemy of attackers) {
    assert.ok(enemy.dead || enemy.hp < health.get(enemy.id), "Every attacker present should be hit");
  }
  assert.equal(game.config.fikaSlowFactor, 1);
});

test("Skånsk blåst pushes everyone back and blows battered Danes home for a toll", () => {
  const game = new Game({ mode: "skanska" });
  const attackers = spawnWave(game, 6);
  const distances = new Map(attackers.map((enemy) => [enemy.id, enemy.distance]));
  const events = step(game, game.config.gustInterval - 5.9, 0.05);
  const gust = events.find((event) => event.type === "gust");
  assert.ok(gust, "A gust should blow once the interval has passed");
  const pushedBack = attackers.filter((enemy) => enemy.distance < distances.get(enemy.id) + enemy.speed * 9.2);
  assert.ok(pushedBack.length > 0);

  const victim = game.enemies.find((enemy) => !enemy.dead);
  victim.hp = victim.maxHp * 0.3;
  victim.distance = Math.max(victim.distance, 20);
  const before = game.money;
  game.impactProjectile({ damage: 1, heavyBonus: 1, splash: 0, slowDuration: 0, knockback: 5, type: "vind" }, victim);
  const home = game.drainEvents().find((event) => event.type === "home");
  assert.ok(home, "A weakened Dane hit by wind should go home");
  assert.equal(victim.dead, true);
  assert.equal(home.payout, game.levels.ENEMY_TYPES[victim.type].bounty + game.config.homeToll);
  assert.ok(game.money >= before + home.payout);
  assert.equal(game.stats.sentHome, 1);

  const healthy = game.enemies.find((enemy) => !enemy.dead);
  game.impactProjectile({ damage: 1, heavyBonus: 1, splash: 0, slowDuration: 0, knockback: 5, type: "vind" }, healthy);
  assert.equal(healthy.dead, false, "Healthy Danes are only pushed");
});

test("quick kills build a streak that pays every fifth kill and lapses after the window", () => {
  const game = new Game({ config: { startingMoney: 0 } });
  const attackers = spawnWave(game, 12);
  assert.ok(attackers.length >= 6);
  const streakEvents = [];
  for (const enemy of attackers.slice(0, 5)) {
    game.damageEnemy(enemy, 1e9, "falafel");
    streakEvents.push(...game.drainEvents().filter((event) => event.type === "streak"));
  }
  assert.equal(streakEvents.length, 1);
  assert.equal(streakEvents[0].count, 5);
  assert.equal(game.stats.streakBonus, 5);

  step(game, game.config.streakWindow + 0.1);
  const next = game.enemies.find((enemy) => !enemy.dead);
  game.damageEnemy(next, 1e9, "falafel");
  assert.equal(game.streak.count, 1, "A pause longer than the window resets the streak");
  assert.equal(game.streak.best, 5);
});

test("golden pickups drop on schedule, expire, and pay only once", () => {
  const game = new Game({ config: { pickupEvery: 2 } });
  const attackers = spawnWave(game, 6);
  game.damageEnemy(attackers[0], 1e9, "falafel");
  game.damageEnemy(attackers[1], 1e9, "falafel");
  assert.equal(game.pickups.length, 1);
  const pickup = game.pickups[0];
  assert.equal(pickup.value, game.config.pickupValue + game.config.pickupValuePerWave * game.currentWave);

  const before = game.money;
  assert.equal(game.collectPickup(pickup.id).ok, true);
  assert.equal(game.money, before + pickup.value);
  assert.equal(game.collectPickup(pickup.id).ok, false);

  game.damageEnemy(attackers[2], 1e9, "falafel");
  game.damageEnemy(attackers[3], 1e9, "falafel");
  assert.equal(game.pickups.length, 1);
  const events = step(game, game.config.pickupLife + 0.1);
  assert.equal(game.pickups.length, 0);
  assert.ok(events.some((event) => event.type === "pickupExpired"));
  assert.equal(game.stats.pickupsCollected, 1);
});

test("endless mode continues after victory with ever-tougher generated waves", () => {
  const game = new Game({ mode: "skanska" });
  assert.equal(game.continueEndless(), false, "Endless only unlocks after the finale");
  game.currentWave = game.totalWaves;
  game.phase = "won";
  assert.equal(game.getNextWave(), null);
  assert.equal(game.continueEndless(), true);
  assert.equal(game.phase, "intermission");

  const routeIds = new Set(game.levels.ROUTES.map((route) => route.id));
  let previous = game.getWave(game.totalWaves).hpScale;
  for (let number = game.totalWaves + 1; number <= game.totalWaves + 6; number += 1) {
    const wave = game.getWave(number);
    assert.equal(wave.endless, true);
    assert.ok(wave.hpScale > previous);
    previous = wave.hpScale;
    for (const group of wave.groups) {
      assert.ok(routeIds.has(group.route));
      assert.ok(game.levels.ENEMY_TYPES[group.type]);
      assert.ok(group.count > 0 && group.every > 0);
    }
    assert.equal(wave.groups.some((group) => group.type === "boss"), (number - game.totalWaves) % 3 === 0);
  }
  assert.match(game.getWave(game.totalWaves + 1).name, /^Bron e öppen/);

  assert.equal(game.startWave(), true);
  assert.equal(game.currentWave, game.totalWaves + 1);
  step(game, 400, 0.1);
  assert.equal(game.phase, "lost", "An undefended endless run eventually falls");
});

test("a competent player can win in both modes", () => {
  for (const mode of ["american", "skanska"]) {
    const result = runPersona("allrounder", { mode, seed: 7 });
    assert.equal(result.mode, mode);
    assert.equal(result.outcome, "won", `${mode} should be winnable`);
  }
});
