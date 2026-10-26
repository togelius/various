"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { Game } = require("../js/engine.js");
const levels = require("../js/levels.js");

const STEP = 0.05;

function assertClose(actual, expected, message, epsilon = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    message || `Expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

function advanceUntil(game, predicate, options = {}) {
  const { step = STEP, seconds = 120, events = null } = options;
  let advanced = 0;
  while (!predicate() && advanced < seconds) {
    game.update(step);
    const drained = game.drainEvents();
    if (events) events.push(...drained);
    advanced += step;
  }
  return predicate();
}

function finishFirstWave() {
  const game = new Game();
  const build = game.buildTower("soder-north", "falafel");
  assert.equal(build.ok, true);

  while (game.getUpgradeCost(build.tower) !== null) {
    assert.equal(game.upgradeTower(build.tower.id).ok, true);
  }
  assert.equal(game.startWave(), true);

  const events = [];
  assert.ok(
    advanceUntil(game, () => game.phase === "intermission", { events, seconds: 90 }),
    "The upgraded tower should clear the first wave",
  );
  const completion = events.find((event) => event.type === "waveComplete");
  assert.ok(completion, "Clearing the wave should emit waveComplete");
  assert.equal(completion.wave, 1);
  assert.equal(completion.nextWave, 2);
  assert.equal(game.currentWave, 1);
  assert.equal(game.intermission, game.config.intermissionSeconds);
  return { game, completion };
}

test("routes are continuous, in bounds, and all terminate at the statue", () => {
  assert.ok(levels.ROUTES.length > 0);
  const routeIds = new Set();

  for (const route of levels.ROUTES) {
    assert.equal(typeof route.id, "string");
    assert.ok(route.id.length > 0);
    assert.ok(!routeIds.has(route.id), `Duplicate route ID: ${route.id}`);
    routeIds.add(route.id);
    assert.ok(route.points.length >= 2, `${route.id} needs at least two points`);
    assert.equal(route.segments.length, route.points.length - 1);

    let calculatedLength = 0;
    route.points.forEach((point, index) => {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
      assert.ok(point.x >= 0 && point.x <= levels.MAP.width, `${route.id} x is out of bounds`);
      assert.ok(point.y >= 0 && point.y <= levels.MAP.height, `${route.id} y is out of bounds`);
      if (index === 0) return;

      const previous = route.points[index - 1];
      const segment = route.segments[index - 1];
      const segmentLength = Math.hypot(point.x - previous.x, point.y - previous.y);
      assert.ok(segmentLength > 0, `${route.id} contains a zero-length segment`);
      assertClose(segment.start, calculatedLength, `${route.id} has a gap between segments`);
      assertClose(segment.length, segmentLength, `${route.id} has an incorrect segment length`);
      assert.deepStrictEqual(segment.from, previous);
      assert.deepStrictEqual(segment.to, point);
      calculatedLength += segmentLength;
    });

    assertClose(route.length, calculatedLength, `${route.id} has an incorrect total length`);
    const first = route.points[0];
    const last = route.points[route.points.length - 1];
    assertClose(last.x, levels.STATUE.x, `${route.id} does not end at the statue`);
    assertClose(last.y, levels.STATUE.y, `${route.id} does not end at the statue`);

    const start = levels.pointOnRoute(route, 0);
    const end = levels.pointOnRoute(route, route.length);
    assertClose(start.x, first.x);
    assertClose(start.y, first.y);
    assertClose(end.x, levels.STATUE.x);
    assertClose(end.y, levels.STATUE.y);
    assert.deepStrictEqual(levels.pointOnRoute(route, -1), start);
    assert.deepStrictEqual(levels.pointOnRoute(route, route.length + 1), end);
  }
});

test("build pads have unique IDs and positions within the map", () => {
  assert.ok(levels.BUILD_PADS.length > 0);
  const padIds = new Set();
  const positions = new Set();

  for (const pad of levels.BUILD_PADS) {
    assert.equal(typeof pad.id, "string");
    assert.ok(pad.id.length > 0);
    assert.ok(!padIds.has(pad.id), `Duplicate build pad ID: ${pad.id}`);
    padIds.add(pad.id);
    assert.ok(Number.isFinite(pad.x) && Number.isFinite(pad.y));
    assert.ok(pad.x >= 0 && pad.x <= levels.MAP.width, `${pad.id} x is out of bounds`);
    assert.ok(pad.y >= 0 && pad.y <= levels.MAP.height, `${pad.id} y is out of bounds`);
    const position = `${pad.x},${pad.y}`;
    assert.ok(!positions.has(position), `Two build pads share ${position}`);
    positions.add(position);
  }
});

test("wave references are valid, every route is used, and the finale has one boss", () => {
  assert.ok(levels.WAVES.length > 0);
  const routeIds = new Set(levels.ROUTES.map((route) => route.id));
  const usedRoutes = new Set();
  let bossCount = 0;

  levels.WAVES.forEach((wave, waveIndex) => {
    assert.equal(typeof wave.name, "string");
    assert.ok(wave.name.length > 0);
    assert.ok(Number.isFinite(wave.hpScale) && wave.hpScale > 0);
    assert.ok(Array.isArray(wave.routes) && wave.routes.length > 0);
    assert.equal(new Set(wave.routes).size, wave.routes.length, "A wave lists a route twice");
    wave.routes.forEach((routeId) => assert.ok(routeIds.has(routeId), `Unknown route ${routeId}`));
    assert.ok(Array.isArray(wave.groups) && wave.groups.length > 0);

    const groupRoutes = new Set();
    for (const group of wave.groups) {
      assert.ok(routeIds.has(group.route), `Unknown group route ${group.route}`);
      assert.ok(wave.routes.includes(group.route), `${group.route} is omitted from wave.routes`);
      assert.ok(levels.ENEMY_TYPES[group.type], `Unknown enemy type ${group.type}`);
      assert.ok(Number.isInteger(group.count) && group.count > 0);
      assert.ok(Number.isFinite(group.every) && group.every > 0);
      assert.ok(Number.isFinite(group.at) && group.at >= 0);
      groupRoutes.add(group.route);
      usedRoutes.add(group.route);
      if (group.type === "boss") {
        assert.equal(waveIndex, levels.WAVES.length - 1, "A boss appears before the final wave");
        bossCount += group.count;
      }
    }
    assert.deepStrictEqual([...groupRoutes].sort(), [...wave.routes].sort());
  });

  assert.deepStrictEqual([...usedRoutes].sort(), [...routeIds].sort());
  assert.equal(bossCount, 1, "The game should have exactly one final boss");
});

test("building charges the listed cost and rejects occupied or unaffordable sites", () => {
  Object.keys(levels.TOWER_TYPES).forEach((typeId, index) => {
    const definition = levels.TOWER_TYPES[typeId];
    const pad = levels.BUILD_PADS[index];
    const game = new Game();
    const startingMoney = game.money;
    const result = game.buildTower(pad.id, typeId);

    assert.equal(result.ok, true);
    assert.equal(game.money, startingMoney - definition.cost);
    assert.equal(game.stats.spent, definition.cost);
    assert.equal(game.stats.earned, 0);
    assert.equal(game.stats.towersBuilt, 1);
    assert.equal(game.towers.length, 1);
    assert.equal(result.tower.invested, definition.cost);
    assert.equal(result.tower.level, 1);
    assert.equal(result.tower.x, pad.x);
    assert.equal(result.tower.y, pad.y);
    assert.equal(game.drainEvents().filter((event) => event.type === "build").length, 1);

    const occupied = game.buildTower(pad.id, typeId);
    assert.equal(occupied.ok, false);
    assert.match(occupied.reason, /occupied/i);
    assert.equal(game.money, startingMoney - definition.cost);
    assert.equal(game.stats.spent, definition.cost);
    assert.equal(game.stats.towersBuilt, 1);
    assert.equal(game.towers.length, 1);
    assert.equal(game.events.length, 0, "A rejected build should not emit another build event");

    const poorGame = new Game({ config: { startingMoney: definition.cost - 1 } });
    const insufficient = poorGame.buildTower(pad.id, typeId);
    assert.equal(insufficient.ok, false);
    assert.match(insufficient.reason, /need/i);
    assert.equal(poorGame.money, definition.cost - 1);
    assert.equal(poorGame.stats.spent, 0);
    assert.equal(poorGame.stats.towersBuilt, 0);
    assert.equal(poorGame.towers.length, 0);
    assert.equal(poorGame.events.length, 0);
  });
});

test("upgrades, maximum level, insufficient funds, and selling preserve accounting", () => {
  const typeId = "falafel";
  const definition = levels.TOWER_TYPES[typeId];
  const padId = levels.BUILD_PADS[0].id;
  const game = new Game();
  const startingMoney = game.money;
  const tower = game.buildTower(padId, typeId).tower;
  let invested = definition.cost;

  while (game.getUpgradeCost(tower) !== null) {
    const cost = game.getUpgradeCost(tower);
    assert.ok(Number.isFinite(cost) && cost > 0);
    const previousLevel = tower.level;
    assert.equal(game.upgradeTower(tower.id).ok, true);
    assert.equal(tower.level, previousLevel + 1);
    invested += cost;
    assert.equal(tower.invested, invested);
    assert.equal(game.money, startingMoney - invested);
    assert.equal(game.stats.spent, invested);
  }

  assert.equal(tower.level, definition.levels.length);
  const moneyAtMaximum = game.money;
  const maximum = game.upgradeTower(tower.id);
  assert.equal(maximum.ok, false);
  assert.match(maximum.reason, /maximum/i);
  assert.equal(tower.level, definition.levels.length);
  assert.equal(tower.invested, invested);
  assert.equal(game.money, moneyAtMaximum);
  assert.equal(game.stats.spent, invested);

  game.drainEvents();
  const sale = game.sellTower(tower.id);
  const expectedRefund = Math.floor(invested * game.config.sellRefund);
  assert.equal(sale.ok, true);
  assert.equal(sale.refund, expectedRefund);
  assert.equal(game.money, moneyAtMaximum + expectedRefund);
  assert.equal(game.stats.spent, invested, "Selling should not erase historical spending");
  assert.equal(game.stats.earned, 0, "A sale refund is not wave earnings");
  assert.equal(game.stats.towersBuilt, 1);
  assert.equal(game.towers.length, 0);
  const sellEvents = game.drainEvents().filter((event) => event.type === "sell");
  assert.equal(sellEvents.length, 1);
  assert.equal(sellEvents[0].refund, expectedRefund);

  const poorGame = new Game({ config: { startingMoney: definition.cost } });
  const poorTower = poorGame.buildTower(padId, typeId).tower;
  const rejected = poorGame.upgradeTower(poorTower.id);
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /need/i);
  assert.equal(poorTower.level, 1);
  assert.equal(poorTower.invested, definition.cost);
  assert.equal(poorGame.money, 0);
  assert.equal(poorGame.stats.spent, definition.cost);
});

test("a first-wave tower fires, kills an attacker, and awards its bounty", () => {
  const game = new Game();
  const build = game.buildTower("soder-north", "falafel");
  assert.equal(build.ok, true);
  const moneyAfterBuild = game.money;
  assert.equal(game.startWave(), true);

  const events = [];
  assert.ok(
    advanceUntil(game, () => game.stats.kills > 0, { events, seconds: 60 }),
    "The tower should kill a first-wave attacker",
  );
  const shot = events.find((event) => event.type === "shot");
  const kill = events.find((event) => event.type === "kill");
  assert.ok(shot, "The tower should fire before the kill");
  assert.ok(kill, "The kill should be observable as an event");
  assert.equal(kill.enemy.type, "basic");
  assert.equal(kill.enemy.dead, true);
  const bounty = levels.ENEMY_TYPES[kill.enemy.type].bounty;
  assert.equal(kill.bounty, bounty);
  assert.equal(game.money, moneyAfterBuild + bounty);
  assert.equal(game.stats.kills, 1);
  assert.equal(game.stats.earned, bounty);
  assert.equal(game.stats.leaks, 0);
  assert.equal(game.health, game.config.startingHealth);
});

test("undefended attackers leak health until the game is lost and frozen", () => {
  const game = new Game({ config: { startingHealth: 2, maxHealth: 2 } });
  assert.equal(game.startWave(), true);
  const events = [];
  assert.ok(
    advanceUntil(game, () => game.phase === "lost", {
      events,
      seconds: 90,
      step: 0.1,
    }),
    "The first wave should eventually defeat an undefended statue",
  );

  const leaks = events.filter((event) => event.type === "leak");
  assert.equal(leaks.length, 2);
  assert.deepStrictEqual(leaks.map((event) => event.health), [1, 0]);
  assert.ok(leaks.every((event) => event.damage === levels.ENEMY_TYPES.basic.leak));
  assert.equal(game.health, 0);
  assert.equal(game.stats.leaks, leaks.length);
  assert.equal(game.stats.kills, 0);
  assert.equal(game.money, game.config.startingMoney);
  assert.equal(events.filter((event) => event.type === "lose").length, 1);

  const frozen = {
    elapsed: game.elapsed,
    money: game.money,
    health: game.health,
    stats: { ...game.stats },
  };
  game.update(10);
  assert.equal(game.elapsed, frozen.elapsed);
  assert.equal(game.money, frozen.money);
  assert.equal(game.health, frozen.health);
  assert.deepStrictEqual(game.stats, frozen.stats);
});

test("ice-cream hits apply a slow that actually reduces movement", () => {
  const game = new Game();
  assert.equal(game.buildTower("soder-north", "glass").ok, true);
  assert.equal(game.startWave(), true);
  const events = [];
  assert.ok(
    advanceUntil(game, () => events.some((event) => event.type === "slow"), {
      events,
      seconds: 60,
    }),
    "The ice-cream van should slow a first-wave attacker",
  );

  const slow = events.find((event) => event.type === "slow");
  const enemy = slow.enemy;
  const tower = game.towers[0];
  const towerStats = game.getTowerStats(tower);
  assert.ok(events.some((event) => event.type === "shot"));
  assert.ok(enemy.hp < enemy.maxHp);
  assert.ok(enemy.slowTimer > 0);
  assert.equal(enemy.slowFactor, towerStats.slowFactor);

  const distanceBefore = enemy.distance;
  game.update(STEP);
  assertClose(
    enemy.distance - distanceBefore,
    enemy.speed * towerStats.slowFactor * STEP,
    "The slowed enemy did not move at its slowed speed",
    1e-8,
  );
});

test("fika globally slows attackers, expires, and cannot be reused during cooldown", () => {
  const game = new Game({ config: { fikaDuration: 2, fikaCooldown: 6 } });
  assert.equal(game.useFika().ok, false, "Fika should not work before a wave");
  assert.equal(game.startWave(), true);
  assert.equal(game.useFika().ok, true);
  assert.equal(game.fikaRemaining, game.config.fikaDuration);
  assert.equal(game.fikaCooldown, game.config.fikaCooldown);
  assert.equal(game.useFika().ok, false, "Fika should not reset its own cooldown");

  game.update(0.5);
  const enemy = game.enemies.find((item) => item.id === 1);
  assert.ok(enemy, "The first attacker should have spawned");
  assertClose(
    enemy.distance,
    enemy.speed * game.config.fikaSlowFactor * 0.5,
    "Fika should reduce enemy movement",
    1e-8,
  );
  assertClose(game.fikaRemaining, game.config.fikaDuration - 0.5);
  assertClose(game.fikaCooldown, game.config.fikaCooldown - 0.5);

  assert.ok(advanceUntil(game, () => game.fikaRemaining === 0, { seconds: 3 }));
  assert.ok(game.fikaCooldown > 0);
  assert.equal(game.useFika().ok, false);
  const distanceBefore = enemy.distance;
  game.update(0.1);
  assertClose(
    enemy.distance - distanceBefore,
    enemy.speed * 0.1,
    "Movement should return to normal after fika expires",
    1e-8,
  );

  assert.ok(advanceUntil(game, () => game.fikaCooldown === 0, { seconds: 7, step: 0.1 }));
  assert.equal(game.phase, "wave");
  assert.equal(game.useFika().ok, true, "Fika should be reusable once its cooldown reaches zero");
  assert.equal(game.fikaRemaining, game.config.fikaDuration);
  assert.equal(game.fikaCooldown, game.config.fikaCooldown);
});

test("wave completion auto-advances after intermission without an early bonus", () => {
  const { game } = finishFirstWave();
  const moneyBefore = game.money;
  const earnedBefore = game.stats.earned;

  game.update(game.intermission);
  assert.equal(game.phase, "wave");
  assert.equal(game.currentWave, 2);
  assert.equal(game.intermission, 0);
  assert.equal(game.waveElapsed, 0);
  assert.equal(game.money, moneyBefore);
  assert.equal(game.stats.earned, earnedBefore);
  const wave = game.drainEvents().find((event) => event.type === "wave");
  assert.ok(wave);
  assert.equal(wave.wave, 2);
  assert.equal(wave.earlyBonus, 0);

  game.update(STEP);
  assert.ok(game.enemies.length > 0, "The automatically started wave should spawn attackers");
});

test("starting a wave early awards the rounded-up intermission time once", () => {
  const { game } = finishFirstWave();
  game.update(2.25);
  assert.equal(game.phase, "intermission");
  assert.ok(game.intermission > 0 && game.intermission < game.config.intermissionSeconds);
  const expectedBonus = Math.ceil(game.intermission);
  const moneyBefore = game.money;
  const earnedBefore = game.stats.earned;

  assert.equal(game.startWave(), true);
  assert.equal(game.phase, "wave");
  assert.equal(game.currentWave, 2);
  assert.equal(game.intermission, 0);
  assert.equal(game.money, moneyBefore + expectedBonus);
  assert.equal(game.stats.earned, earnedBefore + expectedBonus);
  const wave = game.drainEvents().find((event) => event.type === "wave");
  assert.ok(wave);
  assert.equal(wave.earlyBonus, expectedBonus);

  const moneyAfter = game.money;
  assert.equal(game.startWave(), false);
  assert.equal(game.money, moneyAfter, "Repeated starts should not duplicate the bonus");
});

function autoplayFullGame() {
  const game = new Game();
  const buildOrder = [
    ["sq-se", "falafel"],
    ["sq-ne", "falafel"],
    ["sq-nw", "falafel"],
    ["sq-sw", "falafel"],
  ];
  let simulated = 0;
  let bossKills = 0;
  let waveStarts = 0;
  let waveCompletions = 0;
  let wins = 0;

  while (game.phase !== "won" && game.phase !== "lost" && simulated < 900) {
    if (game.phase === "ready" || game.phase === "intermission") {
      for (const [padId, typeId] of buildOrder) {
        const occupied = game.towers.some((tower) => tower.padId === padId);
        if (!occupied && game.money >= levels.TOWER_TYPES[typeId].cost) {
          assert.equal(game.buildTower(padId, typeId).ok, true);
        }
      }

      let upgraded = true;
      while (upgraded) {
        upgraded = false;
        for (const tower of game.towers) {
          const cost = game.getUpgradeCost(tower);
          if (cost !== null && game.money >= cost) {
            assert.equal(game.upgradeTower(tower.id).ok, true);
            upgraded = true;
            break;
          }
        }
      }
      assert.equal(game.startWave(), true);
    }

    if (game.phase === "wave" && game.enemies.length > 0 && game.fikaCooldown <= 0) {
      assert.equal(game.useFika().ok, true);
    }
    game.update(STEP);
    simulated += STEP;

    for (const event of game.drainEvents()) {
      if (event.type === "wave") waveStarts += 1;
      if (event.type === "waveComplete") waveCompletions += 1;
      if (event.type === "kill" && event.enemy.type === "boss") bossKills += 1;
      if (event.type === "win") wins += 1;
    }
  }

  return {
    phase: game.phase,
    currentWave: game.currentWave,
    health: game.health,
    money: game.money,
    stats: { ...game.stats },
    towers: game.towers.map((tower) => ({
      padId: tower.padId,
      type: tower.type,
      level: tower.level,
      invested: tower.invested,
    })),
    bossKills,
    waveStarts,
    waveCompletions,
    wins,
    elapsed: Number(game.elapsed.toFixed(6)),
  };
}

test("fixed-policy full-game autoplay is deterministic and defeats the final boss", () => {
  const first = autoplayFullGame();
  assert.equal(first.phase, "won", `Autoplay ended in ${first.phase} on wave ${first.currentWave}`);
  assert.equal(first.currentWave, levels.WAVES.length);
  assert.ok(first.health > 0);
  assert.ok(first.money >= 0);
  assert.equal(first.waveStarts, levels.WAVES.length);
  assert.equal(first.waveCompletions, levels.WAVES.length - 1);
  assert.equal(first.wins, 1);
  assert.equal(first.bossKills, 1);
  const totalEnemies = levels.WAVES.reduce(
    (total, wave) => total + wave.groups.reduce((sum, group) => sum + group.count, 0),
    0,
  );
  assert.equal(first.stats.kills + first.stats.leaks, totalEnemies);

  const replay = autoplayFullGame();
  assert.deepStrictEqual(replay, first, "Identical fixed-step inputs should produce identical games");
});

test("espresso boosts attack rate without firing or stacking multiple auras", () => {
  const game = new Game({ config: { startingMoney: 1000 } });
  const falafel = game.buildTower("sq-se", "falafel").tower;
  const espresso = game.buildTower("sq-ne", "espresso").tower;
  assert.equal(game.buildTower("sq-sw", "espresso").ok, true, "A second overlapping cart is allowed");
  assert.equal(game.getFireRateMultiplier(falafel), 1.16, "Only the strongest equal aura applies");
  assert.equal(game.getFireRateMultiplier(espresso), 1, "Support carts do not boost themselves");

  assert.equal(game.upgradeTower(espresso.id).ok, true);
  assertClose(game.getFireRateMultiplier(falafel), 1.24, "The strongest upgraded aura wins");
  assert.equal(game.startWave(), true);
  const events = [];
  assert.ok(advanceUntil(game, () => events.some((event) => event.type === "shot"), { events, seconds: 30 }));
  assert.ok(game.stats.shotsByType.falafel > 0);
  assert.equal(game.stats.shotsByType.espresso, 0);
  assert.ok(game.projectiles.every((projectile) => projectile.type !== "espresso"));
  assertClose(falafel.cooldown, game.getTowerStats(falafel).rate / 1.24, "Boosted reload uses the aura", 1e-8);
});

test("Öresund wind knocks living attackers backwards and records combat telemetry", () => {
  const game = new Game({ config: { startingMoney: 500 } });
  assert.equal(game.buildTower("soder-north", "vind").ok, true);
  assert.equal(game.startWave(), true);
  const events = [];
  assert.ok(
    advanceUntil(game, () => events.some((event) => event.type === "knockback"), { events, seconds: 40 }),
    "The wind should push an attacker back",
  );
  const knockback = events.find((event) => event.type === "knockback");
  const route = game.getRoute(knockback.enemy.routeId);
  assert.ok(knockback.amount > 0);
  assert.ok(knockback.enemy.distance < route.length);
  assertClose(knockback.enemy.progress, knockback.enemy.distance / route.length);
  const position = levels.pointOnRoute(route, knockback.enemy.distance);
  assertClose(knockback.enemy.x, position.x);
  assertClose(knockback.enemy.y, position.y);
  assert.ok(game.stats.knockback >= knockback.amount);
  assert.ok(game.stats.shotsByType.vind > 0);
  assert.ok(game.stats.damageByType.vind > 0);
  assert.ok(events.some((event) => event.type === "hit" && event.sourceType === "vind"));
});

test("falafel deals its advertised heavy bonus only to tanks and bosses", () => {
  const game = new Game();
  game.currentWave = 4;
  game.phase = "wave";
  game.spawnEnemy({ routeId: "sodergatan", typeId: "tank" });
  const tank = game.enemies[0];
  const startingHp = tank.hp;
  game.impactProjectile({
    type: "falafel",
    damage: 13,
    heavyBonus: 1.5,
    splash: 0,
    slowDuration: 0,
    knockback: 0,
  }, tank);
  assertClose(startingHp - tank.hp, 19.5);
  assertClose(game.stats.damageByType.falafel, 19.5);

  game.enemies.length = 0;
  game.spawnEnemy({ routeId: "sodergatan", typeId: "basic" });
  const basic = game.enemies[0];
  game.impactProjectile({
    type: "falafel",
    damage: 13,
    heavyBonus: 1.5,
    splash: 0,
    slowDuration: 0,
    knockback: 0,
  }, basic);
  assert.equal(basic.hp, basic.maxHp - 13);
});

test("Danish dialogue has broad, non-repetitive rivalry and event vocabulary", () => {
  const allQuips = [];
  for (const definition of Object.values(levels.ENEMY_TYPES)) {
    assert.ok(definition.quips.length >= 12, `${definition.id} needs a varied phrase pool`);
    assert.equal(new Set(definition.quips).size, definition.quips.length, `${definition.id} has duplicate stock quips`);
    for (const text of definition.quips) assert.ok(text.length <= 36, `Speech bubble is too long: ${text}`);
    allQuips.push(...definition.quips);
  }
  assert.ok(new Set(allQuips).size >= 30, "Enemy roles should have a broad shared vocabulary");
  for (const required of [
    "Kamelåså!", "LEGO > IKEA", "Skåne er dansk!", "Roskilde tæller ikke!",
    "1658? Tilfældighed!", "Wienerbrød > kanelboller", "Helsingør > Helsingborg",
    "Havfruen > hesten", "Over Bæltet!", "ABBA? Nej, Aqua!", "Hvor er min cykel?",
  ]) {
    assert.ok(allQuips.includes(required), `Missing rivalry line: ${required}`);
  }
  for (const [event, phrases] of Object.entries(levels.QUIPS)) {
    assert.ok(phrases.length >= 4, `${event} needs multiple event-specific lines`);
    assert.equal(new Set(phrases).size, phrases.length, `${event} has duplicate lines`);
  }
});
