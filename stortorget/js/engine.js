(function (root, factory) {
  const isNode = typeof module === "object" && module.exports;
  const levels = isNode ? require("./levels.js") : root.StortorgetLevels;
  const api = factory(levels);
  if (isNode) {
    module.exports = api;
  } else {
    root.StortorgetEngine = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (levels) {
  "use strict";

  const distanceBetween = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const hash01 = (value) => {
    let x = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  };

  class Game {
    constructor(options = {}) {
      const base = options.levels || levels;
      this.levels = options.mode ? levels.applyMode(base, options.mode) : base;
      this.mode = this.levels.mode || null;
      this.config = { ...this.levels.CONFIG, ...(options.config || {}) };
      this.events = [];
      this.reset();
    }

    reset() {
      this.money = this.config.startingMoney;
      this.health = this.config.startingHealth;
      this.phase = "ready";
      this.currentWave = 0;
      this.waveElapsed = 0;
      this.intermission = 0;
      this.elapsed = 0;
      this.towers = [];
      this.enemies = [];
      this.projectiles = [];
      this.spawnQueue = [];
      this.fikaRemaining = 0;
      this.fikaCooldown = 0;
      this.nextTowerId = 1;
      this.nextEnemyId = 1;
      this.nextProjectileId = 1;
      this.nextPickupId = 1;
      this.pickups = [];
      this.streak = { count: 0, lastKillAt: -Infinity, best: 0 };
      this.fireworksTimer = 0;
      this.fireworksLeft = 0;
      this.gustTimer = 0;
      this.lastTrainAt = null;
      this.activeWaveRecord = null;
      this.history = { kills: [], leaks: [], waves: [] };
      this.endless = false;
      this.endlessWaves = new Map();
      this.stats = {
        kills: 0,
        leaks: 0,
        leakDamage: 0,
        earned: 0,
        spent: 0,
        towersBuilt: 0,
        shots: 0,
        damage: 0,
        knockback: 0,
        fikaUses: 0,
        earlyBonus: 0,
        tips: 0,
        streakBonus: 0,
        bestStreak: 0,
        sentHome: 0,
        homeTolls: 0,
        gusts: 0,
        bossKills: 0,
        bossPhases: 0,
        pickupsDropped: 0,
        pickupsCollected: 0,
        pickupCash: 0,
        damageByType: Object.fromEntries(Object.keys(this.levels.TOWER_TYPES).map((type) => [type, 0])),
        shotsByType: Object.fromEntries(Object.keys(this.levels.TOWER_TYPES).map((type) => [type, 0])),
        spentByType: Object.fromEntries(Object.keys(this.levels.TOWER_TYPES).map((type) => [type, 0])),
      };
      this.events.length = 0;
      return this;
    }

    emit(type, detail = {}) {
      this.events.push({ type, ...detail });
    }

    drainEvents() {
      return this.events.splice(0, this.events.length);
    }

    recordPoint(collection, point) {
      collection.push(point);
      if (collection.length > 2000) collection.splice(0, collection.length - 2000);
    }

    getWave(number = this.currentWave) {
      if (number < 1) return null;
      if (number <= this.levels.WAVES.length) return this.levels.WAVES[number - 1];
      if (!this.endless) return null;
      if (!this.endlessWaves.has(number)) this.endlessWaves.set(number, levels.makeEndlessWave(this.levels, number));
      return this.endlessWaves.get(number);
    }

    get totalWaves() {
      return this.levels.WAVES.length;
    }

    getNextWave() {
      return this.getWave(this.currentWave + 1);
    }

    getRoute(routeId) {
      return this.levels.ROUTES.find((route) => route.id === routeId);
    }

    getLandmarkModifiers(tower) {
      const modifiers = { hasteBonus: 0, knockbackMultiplier: 1, ids: [] };
      for (const landmark of this.levels.LANDMARKS || []) {
        if (!landmark.tower || landmark.tower !== tower.type) continue;
        if (distanceBetween(tower, landmark) > landmark.radius) continue;
        modifiers.ids.push(landmark.id);
        if (landmark.effect === "haste") modifiers.hasteBonus += landmark.amount;
        if (landmark.effect === "knockback") modifiers.knockbackMultiplier *= landmark.amount;
      }
      return modifiers;
    }

    getTowerLandmarks(tower) {
      return (this.levels.LANDMARKS || []).filter((landmark) => landmark.tower === tower.type
        && distanceBetween(tower, landmark) <= landmark.radius);
    }

    getTowerStats(tower) {
      const stats = this.levels.TOWER_TYPES[tower.type].levels[tower.level - 1];
      const modifiers = this.getLandmarkModifiers(tower);
      return {
        ...stats,
        ...(stats.haste ? { haste: stats.haste + modifiers.hasteBonus } : {}),
        ...(stats.knockback ? { knockback: stats.knockback * modifiers.knockbackMultiplier } : {}),
      };
    }

    getFireRateMultiplier(tower) {
      if (this.levels.TOWER_TYPES[tower.type].support) return 1;
      let strongestBoost = 0;
      for (const support of this.towers) {
        const definition = this.levels.TOWER_TYPES[support.type];
        if (!definition.support) continue;
        const stats = this.getTowerStats(support);
        if (distanceBetween(tower, support) <= stats.range) {
          strongestBoost = Math.max(strongestBoost, stats.haste);
        }
      }
      return 1 + strongestBoost;
    }

    getUpgradeCost(tower) {
      const definition = this.levels.TOWER_TYPES[tower.type];
      if (tower.level >= definition.levels.length) return null;
      return definition.levels[tower.level].upgradeCost;
    }

    setTargetMode(towerId, mode) {
      const tower = this.towers.find((item) => item.id === towerId);
      if (!tower || this.levels.TOWER_TYPES[tower.type].support) return false;
      if (!["first", "strong", "fast"].includes(mode)) return false;
      tower.targetMode = mode;
      this.emit("targetMode", { tower, mode });
      return true;
    }

    cycleTargetMode(towerId) {
      const tower = this.towers.find((item) => item.id === towerId);
      if (!tower || this.levels.TOWER_TYPES[tower.type].support) return null;
      const modes = ["first", "strong", "fast"];
      const next = modes[(modes.indexOf(tower.targetMode) + 1) % modes.length];
      this.setTargetMode(towerId, next);
      return next;
    }

    getActiveRoutes() {
      if (this.phase === "wave") return this.getWave()?.routes || [];
      if (this.phase === "ready" || this.phase === "intermission") {
        return this.getNextWave()?.routes || [];
      }
      return [];
    }

    getNextTrainArrival() {
      const next = this.spawnQueue.find((item) => item.train);
      if (!next) return null;
      return { time: next.time, in: Math.max(0, next.time - this.waveElapsed), count: next.batchSize };
    }

    canBuild() {
      return this.phase !== "won" && this.phase !== "lost";
    }

    buildTower(padId, typeId) {
      const pad = this.levels.BUILD_PADS.find((item) => item.id === padId);
      const definition = this.levels.TOWER_TYPES[typeId];
      if (!this.canBuild()) return { ok: false, code: "over", reason: "The game is over" };
      if (!pad || !definition) return { ok: false, code: "site", reason: "Unknown build site" };
      if (this.towers.some((tower) => tower.padId === padId)) {
        return { ok: false, code: "occupied", reason: "That site is occupied" };
      }
      if (this.money < definition.cost) {
        const amount = definition.cost - this.money;
        return { ok: false, code: "funds", amount, reason: `You need ${amount} kr more` };
      }

      const tower = {
        id: this.nextTowerId++,
        padId,
        type: typeId,
        x: pad.x,
        y: pad.y,
        level: 1,
        cooldown: 0,
        targetMode: "first",
        angle: -Math.PI / 2,
        invested: definition.cost,
      };
      this.towers.push(tower);
      this.money -= definition.cost;
      this.stats.spent += definition.cost;
      this.stats.spentByType[typeId] += definition.cost;
      this.stats.towersBuilt += 1;
      this.emit("build", { tower, x: tower.x, y: tower.y });
      return { ok: true, tower };
    }

    upgradeTower(towerId) {
      const tower = this.towers.find((item) => item.id === towerId);
      if (!tower) return { ok: false, code: "select", reason: "Select a defence first" };
      if (!this.canBuild()) return { ok: false, code: "over", reason: "The game is over" };
      const cost = this.getUpgradeCost(tower);
      if (cost === null) return { ok: false, code: "max", reason: "Already at maximum level" };
      if (this.money < cost) {
        return { ok: false, code: "funds", amount: cost - this.money, reason: `You need ${cost - this.money} kr more` };
      }
      tower.level += 1;
      tower.invested += cost;
      this.money -= cost;
      this.stats.spent += cost;
      this.stats.spentByType[tower.type] += cost;
      this.emit("upgrade", { tower, x: tower.x, y: tower.y });
      return { ok: true, tower };
    }

    sellTower(towerId) {
      const index = this.towers.findIndex((item) => item.id === towerId);
      if (index < 0) return { ok: false, code: "select", reason: "Select a defence first" };
      if (!this.canBuild()) return { ok: false, code: "over", reason: "The game is over" };
      const tower = this.towers[index];
      const refund = Math.floor(tower.invested * this.config.sellRefund);
      this.towers.splice(index, 1);
      this.money += refund;
      this.emit("sell", { tower, refund, x: tower.x, y: tower.y });
      return { ok: true, refund };
    }

    startWave() {
      if (this.phase !== "ready" && this.phase !== "intermission") return false;
      const wave = this.getNextWave();
      if (!wave) return false;

      const earlyBonus = this.phase === "intermission" ? Math.max(0, Math.ceil(this.intermission)) : 0;
      if (earlyBonus > 0) {
        this.money += earlyBonus;
        this.stats.earned += earlyBonus;
        this.stats.earlyBonus += earlyBonus;
      }

      this.currentWave += 1;
      this.phase = "wave";
      this.waveElapsed = 0;
      this.intermission = 0;
      this.gustTimer = this.config.gustInterval || 0;
      this.lastTrainAt = null;
      this.spawnQueue = [];
      const trainBatchSize = Math.max(1, this.config.trainBatchSize || 3);
      wave.groups.forEach((group) => {
        for (let index = 0; index < group.count; index += 1) {
          const train = group.route === "centralen";
          const batch = train ? Math.floor(index / trainBatchSize) : index;
          this.spawnQueue.push({
            time: group.at + batch * group.every * (train ? trainBatchSize : 1),
            routeId: group.route,
            typeId: group.type,
            train,
            batchSize: train ? Math.min(trainBatchSize, group.count - batch * trainBatchSize) : 1,
            order: this.spawnQueue.length,
          });
        }
      });
      this.spawnQueue.sort((a, b) => a.time - b.time || a.order - b.order);
      this.activeWaveRecord = {
        wave: this.currentWave,
        name: wave.name,
        startedAt: this.elapsed,
        kills: this.stats.kills,
        leaks: this.stats.leaks,
        leakDamage: this.stats.leakDamage,
        healthStart: this.health,
      };
      this.emit("wave", {
        wave: this.currentWave,
        name: wave.name,
        routes: wave.routes,
        earlyBonus,
        endless: Boolean(wave.endless),
      });
      return true;
    }

    spawnEnemy(item) {
      const definition = this.levels.ENEMY_TYPES[item.typeId];
      const route = this.getRoute(item.routeId);
      const wave = this.getWave();
      const maxHp = Math.round(definition.hp * wave.hpScale);
      const position = levels.pointOnRoute(route, 0);
      const enemy = {
        id: this.nextEnemyId++,
        type: item.typeId,
        routeId: item.routeId,
        distance: 0,
        progress: 0,
        x: position.x,
        y: position.y,
        angle: position.angle,
        hp: maxHp,
        maxHp,
        speed: definition.speed,
        slowTimer: 0,
        slowFactor: 1,
        dead: false,
        train: Boolean(item.train),
        bossPhase: null,
        bossPhaseTriggered: false,
        bossPhaseTimer: 0,
      };
      this.enemies.push(enemy);
      this.emit("spawn", { enemy });
    }

    useFika() {
      if (this.phase !== "wave") return { ok: false, code: "fikaWave", reason: "Fika works during an attack" };
      if (this.fikaCooldown > 0) {
        const seconds = Math.ceil(this.fikaCooldown);
        return { ok: false, code: "fikaCooldown", seconds, reason: `Fika is ready in ${seconds} s` };
      }
      this.fikaRemaining = this.config.fikaDuration;
      this.fikaCooldown = this.config.fikaCooldown;
      this.fireworksTimer = 0;
      this.fireworksLeft = this.config.fikaKind === "fireworks" ? this.config.fireworksVolleys : 0;
      this.stats.fikaUses += 1;
      this.emit("fika", { duration: this.config.fikaDuration, kind: this.config.fikaKind });
      return { ok: true };
    }

    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0 || this.phase === "won" || this.phase === "lost") return;

      this.elapsed += dt;
      this.fikaCooldown = Math.max(0, this.fikaCooldown - dt);
      this.fikaRemaining = Math.max(0, this.fikaRemaining - dt);
      this.updatePickups(dt);

      if (this.phase === "intermission") {
        this.intermission = Math.max(0, this.intermission - dt);
        if (this.intermission === 0) this.startWave();
        return;
      }
      if (this.phase !== "wave") return;

      this.waveElapsed += dt;
      while (this.spawnQueue.length && this.spawnQueue[0].time <= this.waveElapsed + 1e-9) {
        const item = this.spawnQueue.shift();
        if (item.train && this.lastTrainAt !== item.time) {
          this.lastTrainAt = item.time;
          this.emit("train", { routeId: item.routeId, count: item.batchSize, wave: this.currentWave });
        }
        this.spawnEnemy(item);
      }

      this.updateEnemies(dt);
      this.enemies = this.enemies.filter((enemy) => !enemy.dead);
      if (this.phase === "lost") return;

      if (this.fireworksLeft > 0) this.updateFireworks(dt);
      if (this.config.gustInterval) this.updateGust(dt);

      this.updateTowers(dt);
      this.updateProjectiles(dt);
      this.enemies = this.enemies.filter((enemy) => !enemy.dead);
      this.projectiles = this.projectiles.filter((projectile) => !projectile.dead);
      this.checkWaveComplete();
    }

    updatePickups(dt) {
      if (!this.pickups.length) return;
      for (const pickup of this.pickups) pickup.life -= dt;
      const expired = this.pickups.filter((pickup) => pickup.life <= 0);
      if (!expired.length) return;
      this.pickups = this.pickups.filter((pickup) => pickup.life > 0);
      for (const pickup of expired) this.emit("pickupExpired", { pickup });
    }

    collectPickup(pickupId) {
      const pickup = this.pickups.find((item) => item.id === pickupId);
      if (!pickup) return { ok: false, code: "pickup", reason: "Too slow" };
      this.pickups = this.pickups.filter((item) => item !== pickup);
      this.money += pickup.value;
      this.stats.earned += pickup.value;
      this.stats.pickupsCollected += 1;
      this.stats.pickupCash += pickup.value;
      this.emit("pickup", { pickup, value: pickup.value, x: pickup.x, y: pickup.y });
      return { ok: true, value: pickup.value };
    }

    // Happy Hour: volleys of fireworks hit every attacker on the map.
    updateFireworks(dt) {
      const interval = this.config.fikaDuration / this.config.fireworksVolleys;
      this.fireworksTimer -= dt;
      if (this.fireworksTimer > 0) return;
      this.fireworksTimer += interval;
      this.fireworksLeft -= 1;
      const damage = this.config.fireworksDamage * (this.getWave()?.hpScale || 1);
      const targets = this.enemies.filter((enemy) => !enemy.dead);
      this.emit("fireworks", { targets: targets.map((enemy) => ({ x: enemy.x, y: enemy.y })) });
      for (const enemy of targets) this.damageEnemy(enemy, damage, "fika");
    }

    // Skånsk blåst: a regular gust shoves every attacker back along its street.
    updateGust(dt) {
      this.gustTimer -= dt;
      if (this.gustTimer > 0) return;
      this.gustTimer += this.config.gustInterval;
      if (!this.enemies.length) return;
      this.stats.gusts += 1;
      for (const enemy of this.enemies) {
        if (!enemy.dead) this.pushEnemy(enemy, this.config.gustPush, false);
      }
      this.emit("gust", { count: this.enemies.length });
    }

    pushEnemy(enemy, requestedAmount, canSendHome) {
      const definition = this.levels.ENEMY_TYPES[enemy.type];
      const route = this.getRoute(enemy.routeId);
      const amount = Math.min(enemy.distance, requestedAmount * (definition.knockbackFactor ?? 1));
      enemy.distance = Math.max(0, enemy.distance - amount);
      enemy.progress = Math.min(1, enemy.distance / route.length);
      const position = levels.pointOnRoute(route, enemy.distance);
      enemy.x = position.x;
      enemy.y = position.y;
      enemy.angle = position.angle;
      this.stats.knockback += amount;
      if (canSendHome && this.config.goHomeHpRatio && enemy.type !== "boss"
        && enemy.hp <= enemy.maxHp * this.config.goHomeHpRatio) {
        this.sendHome(enemy);
      }
      return amount;
    }

    // A battered Dane blown back by the wind gives up, pays the bridge toll and leaves.
    sendHome(enemy) {
      const definition = this.levels.ENEMY_TYPES[enemy.type];
      const payout = definition.bounty + this.config.homeToll;
      enemy.dead = true;
      this.money += payout;
      this.stats.earned += payout;
      this.stats.homeTolls += this.config.homeToll;
      this.stats.sentHome += 1;
      this.stats.kills += 1;
      this.recordPoint(this.history.kills, {
        x: enemy.x,
        y: enemy.y,
        routeId: enemy.routeId,
        type: enemy.type,
        wave: this.currentWave,
        sourceType: "home",
      });
      this.emit("home", { enemy, payout, x: enemy.x, y: enemy.y });
      this.registerKill(enemy);
    }

    updateBossPhaseTrigger(enemy) {
      if (enemy.type !== "boss" || enemy.bossPhaseTriggered || enemy.hp <= 0 || enemy.hp > enemy.maxHp * 0.5) return;
      enemy.bossPhaseTriggered = true;
      enemy.bossPhase = "telegraph";
      enemy.bossPhaseTimer = 2.2;
      this.stats.bossPhases += 1;
      this.emit("bossTelegraph", { enemy, duration: 2.2, x: enemy.x, y: enemy.y });
    }

    updateBossPhase(enemy, dt) {
      if (!enemy.bossPhase) return 1;
      enemy.bossPhaseTimer -= dt;
      if (enemy.bossPhase === "telegraph") {
        if (enemy.bossPhaseTimer > 0) return 0;
        enemy.bossPhase = "charge";
        enemy.bossPhaseTimer = 4;
        this.emit("bossCharge", { enemy, duration: 4, x: enemy.x, y: enemy.y });
      }
      if (enemy.bossPhase === "charge") {
        if (enemy.bossPhaseTimer > 0) return 2;
        enemy.bossPhase = "recover";
        enemy.bossPhaseTimer = 1.5;
        this.emit("bossRecover", { enemy, duration: 1.5, x: enemy.x, y: enemy.y });
      }
      if (enemy.bossPhase === "recover") {
        if (enemy.bossPhaseTimer > 0) return 0.65;
        enemy.bossPhase = null;
        enemy.bossPhaseTimer = 0;
      }
      return 1;
    }

    updateEnemies(dt) {
      const routeMap = new Map(this.levels.ROUTES.map((route) => [route.id, route]));
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        const definition = this.levels.ENEMY_TYPES[enemy.type];
        enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
        const localSlow = enemy.slowTimer > 0 ? enemy.slowFactor : 1;
        const fikaSlow = this.fikaRemaining > 0 ? this.config.fikaSlowFactor : 1;
        const bossSpeed = this.updateBossPhase(enemy, dt);
        enemy.distance += enemy.speed * localSlow * fikaSlow * bossSpeed * dt;
        const route = routeMap.get(enemy.routeId);
        enemy.progress = Math.min(1, enemy.distance / route.length);

        if (enemy.distance >= route.length) {
          enemy.dead = true;
          this.health = Math.max(0, this.health - definition.leak);
          this.stats.leaks += 1;
          this.stats.leakDamage += definition.leak;
          this.recordPoint(this.history.leaks, {
            x: enemy.x,
            y: enemy.y,
            routeId: enemy.routeId,
            type: enemy.type,
            wave: this.currentWave,
            damage: definition.leak,
          });
          this.emit("leak", {
            enemy,
            damage: definition.leak,
            health: this.health,
            x: this.levels.STATUE.x,
            y: this.levels.STATUE.y,
          });
          if (this.health === 0) {
            this.phase = "lost";
            this.projectiles.length = 0;
            this.finishWaveRecord("lost");
            this.emit("lose", { wave: this.currentWave, stats: { ...this.stats } });
            return;
          }
          continue;
        }

        const position = levels.pointOnRoute(route, enemy.distance);
        enemy.x = position.x;
        enemy.y = position.y;
        enemy.angle = position.angle;
      }
    }

    updateTowers(dt) {
      for (const tower of this.towers) {
        const definition = this.levels.TOWER_TYPES[tower.type];
        if (definition.support) continue;
        const stats = this.getTowerStats(tower);
        tower.cooldown = Math.max(0, tower.cooldown - dt);
        if (tower.cooldown > 0) continue;
        const target = this.findTarget(tower, stats.range);
        if (target) this.fireTower(tower, target, stats);
      }
    }

    findTarget(tower, range) {
      let best = null;
      let bestScore = -Infinity;
      let bestProgress = -Infinity;
      const mode = tower.targetMode || "first";
      for (const enemy of this.enemies) {
        if (enemy.dead || distanceBetween(tower, enemy) > range) continue;
        const score = mode === "strong" ? enemy.maxHp : mode === "fast" ? enemy.speed : enemy.progress;
        if (score > bestScore
          || (score === bestScore && enemy.progress > bestProgress)
          || (score === bestScore && enemy.progress === bestProgress && enemy.id < best?.id)) {
          best = enemy;
          bestScore = score;
          bestProgress = enemy.progress;
        }
      }
      return best;
    }

    fireTower(tower, target, stats) {
      this.projectiles.push({
        id: this.nextProjectileId++,
        type: tower.type,
        towerId: tower.id,
        targetId: target.id,
        x: tower.x,
        y: tower.y,
        lastX: tower.x,
        lastY: tower.y,
        age: 0,
        targetX: target.x,
        targetY: target.y,
        speed: stats.projectileSpeed,
        damage: stats.damage,
        heavyBonus: stats.heavyBonus || 1,
        splash: stats.splash || 0,
        slowFactor: stats.slowFactor || 1,
        slowDuration: stats.slowDuration || 0,
        knockback: stats.knockback || 0,
        dead: false,
      });
      tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
      tower.cooldown = stats.rate / this.getFireRateMultiplier(tower);
      this.stats.shots += 1;
      this.stats.shotsByType[tower.type] += 1;
      this.emit("shot", { tower, target, projectileType: tower.type });
    }

    updateProjectiles(dt) {
      const enemiesById = new Map(this.enemies.map((enemy) => [enemy.id, enemy]));
      for (const projectile of this.projectiles) {
        if (projectile.dead) continue;
        projectile.age += dt;
        projectile.lastX = projectile.x;
        projectile.lastY = projectile.y;
        const target = enemiesById.get(projectile.targetId);
        const targetAlive = target && !target.dead;
        if (targetAlive) {
          projectile.targetX = target.x;
          projectile.targetY = target.y;
        } else if (!projectile.splash) {
          projectile.dead = true;
          continue;
        }

        const dx = projectile.targetX - projectile.x;
        const dy = projectile.targetY - projectile.y;
        const distance = Math.hypot(dx, dy);
        const step = projectile.speed * dt;
        if (distance > step && distance > 1.5) {
          projectile.x += (dx / distance) * step;
          projectile.y += (dy / distance) * step;
          continue;
        }

        projectile.x = projectile.targetX;
        projectile.y = projectile.targetY;
        projectile.dead = true;
        this.impactProjectile(projectile, targetAlive ? target : null);
      }
    }

    impactProjectile(projectile, target) {
      if (projectile.splash) {
        this.emit("explosion", {
          x: projectile.x,
          y: projectile.y,
          radius: projectile.splash,
          projectileType: projectile.type,
        });
        for (const enemy of this.enemies) {
          if (!enemy.dead && distanceBetween(projectile, enemy) <= projectile.splash) {
            this.damageEnemy(enemy, projectile.damage, projectile.type);
          }
        }
        return;
      }

      if (!target || target.dead) return;
      const heavy = target.type === "tank" || target.type === "boss";
      const damage = projectile.damage * (heavy ? projectile.heavyBonus : 1);
      this.damageEnemy(target, damage, projectile.type);
      if (!target.dead && projectile.slowDuration > 0) {
        target.slowFactor = target.slowTimer > 0
          ? Math.min(target.slowFactor, projectile.slowFactor)
          : projectile.slowFactor;
        target.slowTimer = Math.max(target.slowTimer, projectile.slowDuration);
        this.emit("slow", { enemy: target, x: target.x, y: target.y });
      }
      if (!target.dead && projectile.knockback > 0) {
        const amount = this.pushEnemy(target, projectile.knockback, true);
        this.emit("knockback", { enemy: target, amount, x: target.x, y: target.y });
      }
    }

    damageEnemy(enemy, amount, sourceType = null) {
      if (enemy.dead) return false;
      const applied = Math.min(enemy.hp, Math.max(0, amount));
      enemy.hp -= applied;
      this.stats.damage += applied;
      if (sourceType && sourceType in this.stats.damageByType) this.stats.damageByType[sourceType] += applied;
      this.emit("hit", {
        enemy,
        amount: applied,
        sourceType,
        killed: enemy.hp <= 0,
        x: enemy.x,
        y: enemy.y,
      });
      if (enemy.hp > 0) {
        this.updateBossPhaseTrigger(enemy);
        return false;
      }
      enemy.dead = true;
      const definition = this.levels.ENEMY_TYPES[enemy.type];
      // Tips are pseudo-random per attacker so runs stay deterministic.
      const tip = this.config.tipMax
        ? Math.round(definition.bounty * (this.config.tipMin + (this.config.tipMax - this.config.tipMin) * hash01(enemy.id)))
        : 0;
      this.money += definition.bounty + tip;
      this.stats.kills += 1;
      this.stats.earned += definition.bounty + tip;
      this.stats.tips += tip;
      if (enemy.type === "boss") this.stats.bossKills += 1;
      this.recordPoint(this.history.kills, {
        x: enemy.x,
        y: enemy.y,
        routeId: enemy.routeId,
        type: enemy.type,
        wave: this.currentWave,
        sourceType,
      });
      this.emit("kill", {
        enemy,
        bounty: definition.bounty,
        tip,
        sourceType,
        x: enemy.x,
        y: enemy.y,
      });
      this.registerKill(enemy);
      return true;
    }

    registerKill(enemy) {
      const streak = this.streak;
      streak.count = this.elapsed - streak.lastKillAt <= this.config.streakWindow ? streak.count + 1 : 1;
      streak.lastKillAt = this.elapsed;
      streak.best = Math.max(streak.best, streak.count);
      this.stats.bestStreak = Math.max(this.stats.bestStreak, streak.count);
      if (streak.count % this.config.streakStep === 0) {
        const reward = Math.min(this.config.streakCap, streak.count);
        this.money += reward;
        this.stats.earned += reward;
        this.stats.streakBonus += reward;
        this.emit("streak", { count: streak.count, reward, x: enemy.x, y: enemy.y });
      }
      if (this.config.pickupEvery && this.stats.kills % this.config.pickupEvery === 0) {
        const pickup = {
          id: this.nextPickupId++,
          x: enemy.x,
          y: enemy.y,
          value: this.config.pickupValue + this.config.pickupValuePerWave * this.currentWave,
          life: this.config.pickupLife,
          maxLife: this.config.pickupLife,
        };
        this.pickups.push(pickup);
        this.stats.pickupsDropped += 1;
        this.emit("pickupDrop", { pickup });
      }
    }

    finishWaveRecord(outcome) {
      if (!this.activeWaveRecord) return;
      const start = this.activeWaveRecord;
      this.history.waves.push({
        wave: start.wave,
        name: start.name,
        outcome,
        kills: this.stats.kills - start.kills,
        leaks: this.stats.leaks - start.leaks,
        leakDamage: this.stats.leakDamage - start.leakDamage,
        health: this.health,
        healthLost: Math.max(0, start.healthStart - this.health),
        duration: this.elapsed - start.startedAt,
      });
      this.activeWaveRecord = null;
    }

    checkWaveComplete() {
      if (this.phase !== "wave" || this.spawnQueue.length || this.enemies.length) return;
      this.projectiles.length = 0;
      if (this.currentWave >= this.levels.WAVES.length && !this.endless) {
        this.phase = "won";
        this.finishWaveRecord("cleared");
        this.emit("win", { stats: { ...this.stats }, health: this.health });
        return;
      }

      const reward = 30 + this.currentWave * 5;
      this.money += reward;
      this.stats.earned += reward;
      const healed = this.health < this.config.maxHealth;
      this.health = Math.min(this.config.maxHealth, this.health + 1);
      this.phase = "intermission";
      this.intermission = this.config.intermissionSeconds;
      this.finishWaveRecord("cleared");
      this.emit("waveComplete", {
        wave: this.currentWave,
        reward,
        healed,
        nextWave: this.currentWave + 1,
      });
    }

    // After the authored finale, keep going until the square falls.
    continueEndless() {
      if (this.phase !== "won") return false;
      this.endless = true;
      this.phase = "intermission";
      this.intermission = this.config.intermissionSeconds;
      this.health = Math.min(this.config.maxHealth, this.health + 1);
      this.emit("endless", { nextWave: this.currentWave + 1 });
      return true;
    }
  }

  return { Game, createGame: (options) => new Game(options), distanceBetween };
});
