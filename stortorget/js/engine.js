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

  class Game {
    constructor(options = {}) {
      this.levels = options.levels || levels;
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
      this.stats = {
        kills: 0,
        leaks: 0,
        earned: 0,
        spent: 0,
        towersBuilt: 0,
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

    getWave(number = this.currentWave) {
      return this.levels.WAVES[number - 1] || null;
    }

    getNextWave() {
      return this.getWave(this.currentWave + 1);
    }

    getRoute(routeId) {
      return this.levels.ROUTES.find((route) => route.id === routeId);
    }

    getTowerStats(tower) {
      return this.levels.TOWER_TYPES[tower.type].levels[tower.level - 1];
    }

    getUpgradeCost(tower) {
      const definition = this.levels.TOWER_TYPES[tower.type];
      if (tower.level >= definition.levels.length) return null;
      return definition.levels[tower.level].upgradeCost;
    }

    getActiveRoutes() {
      if (this.phase === "wave") return this.getWave()?.routes || [];
      if (this.phase === "ready" || this.phase === "intermission") {
        return this.getNextWave()?.routes || [];
      }
      return [];
    }

    canBuild() {
      return this.phase !== "won" && this.phase !== "lost";
    }

    buildTower(padId, typeId) {
      const pad = this.levels.BUILD_PADS.find((item) => item.id === padId);
      const definition = this.levels.TOWER_TYPES[typeId];
      if (!this.canBuild()) return { ok: false, reason: "The game is over" };
      if (!pad || !definition) return { ok: false, reason: "Unknown build site" };
      if (this.towers.some((tower) => tower.padId === padId)) {
        return { ok: false, reason: "That site is occupied" };
      }
      if (this.money < definition.cost) {
        return { ok: false, reason: `You need ${definition.cost - this.money} kr more` };
      }

      const tower = {
        id: this.nextTowerId++,
        padId,
        type: typeId,
        x: pad.x,
        y: pad.y,
        level: 1,
        cooldown: 0,
        angle: -Math.PI / 2,
        invested: definition.cost,
      };
      this.towers.push(tower);
      this.money -= definition.cost;
      this.stats.spent += definition.cost;
      this.stats.towersBuilt += 1;
      this.emit("build", { tower, x: tower.x, y: tower.y });
      return { ok: true, tower };
    }

    upgradeTower(towerId) {
      const tower = this.towers.find((item) => item.id === towerId);
      if (!tower) return { ok: false, reason: "Select a defence first" };
      if (!this.canBuild()) return { ok: false, reason: "The game is over" };
      const cost = this.getUpgradeCost(tower);
      if (cost === null) return { ok: false, reason: "Already at maximum level" };
      if (this.money < cost) return { ok: false, reason: `You need ${cost - this.money} kr more` };
      tower.level += 1;
      tower.invested += cost;
      this.money -= cost;
      this.stats.spent += cost;
      this.emit("upgrade", { tower, x: tower.x, y: tower.y });
      return { ok: true, tower };
    }

    sellTower(towerId) {
      const index = this.towers.findIndex((item) => item.id === towerId);
      if (index < 0) return { ok: false, reason: "Select a defence first" };
      if (!this.canBuild()) return { ok: false, reason: "The game is over" };
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
      }

      this.currentWave += 1;
      this.phase = "wave";
      this.waveElapsed = 0;
      this.intermission = 0;
      this.spawnQueue = [];
      wave.groups.forEach((group) => {
        for (let index = 0; index < group.count; index += 1) {
          this.spawnQueue.push({
            time: group.at + index * group.every,
            routeId: group.route,
            typeId: group.type,
            order: this.spawnQueue.length,
          });
        }
      });
      this.spawnQueue.sort((a, b) => a.time - b.time || a.order - b.order);
      this.emit("wave", {
        wave: this.currentWave,
        name: wave.name,
        routes: wave.routes,
        earlyBonus,
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
      };
      this.enemies.push(enemy);
      this.emit("spawn", { enemy });
    }

    useFika() {
      if (this.phase !== "wave") return { ok: false, reason: "Fika works during an attack" };
      if (this.fikaCooldown > 0) {
        return { ok: false, reason: `Fika is ready in ${Math.ceil(this.fikaCooldown)} s` };
      }
      this.fikaRemaining = this.config.fikaDuration;
      this.fikaCooldown = this.config.fikaCooldown;
      this.emit("fika", { duration: this.config.fikaDuration });
      return { ok: true };
    }

    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0 || this.phase === "won" || this.phase === "lost") return;

      this.elapsed += dt;
      this.fikaCooldown = Math.max(0, this.fikaCooldown - dt);
      this.fikaRemaining = Math.max(0, this.fikaRemaining - dt);

      if (this.phase === "intermission") {
        this.intermission = Math.max(0, this.intermission - dt);
        if (this.intermission === 0) this.startWave();
        return;
      }
      if (this.phase !== "wave") return;

      this.waveElapsed += dt;
      while (this.spawnQueue.length && this.spawnQueue[0].time <= this.waveElapsed + 1e-9) {
        this.spawnEnemy(this.spawnQueue.shift());
      }

      this.updateEnemies(dt);
      this.enemies = this.enemies.filter((enemy) => !enemy.dead);
      if (this.phase === "lost") return;

      this.updateTowers(dt);
      this.updateProjectiles(dt);
      this.enemies = this.enemies.filter((enemy) => !enemy.dead);
      this.projectiles = this.projectiles.filter((projectile) => !projectile.dead);
      this.checkWaveComplete();
    }

    updateEnemies(dt) {
      const routeMap = new Map(this.levels.ROUTES.map((route) => [route.id, route]));
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        const definition = this.levels.ENEMY_TYPES[enemy.type];
        enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
        const localSlow = enemy.slowTimer > 0 ? enemy.slowFactor : 1;
        const fikaSlow = this.fikaRemaining > 0 ? this.config.fikaSlowFactor : 1;
        enemy.distance += enemy.speed * localSlow * fikaSlow * dt;
        const route = routeMap.get(enemy.routeId);
        enemy.progress = Math.min(1, enemy.distance / route.length);

        if (enemy.distance >= route.length) {
          enemy.dead = true;
          this.health = Math.max(0, this.health - definition.leak);
          this.stats.leaks += 1;
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
        const stats = this.getTowerStats(tower);
        tower.cooldown = Math.max(0, tower.cooldown - dt);
        if (tower.cooldown > 0) continue;
        const target = this.findTarget(tower, stats.range);
        if (target) this.fireTower(tower, target, stats);
      }
    }

    findTarget(tower, range) {
      let best = null;
      let bestProgress = -Infinity;
      for (const enemy of this.enemies) {
        if (enemy.dead || distanceBetween(tower, enemy) > range) continue;
        if (enemy.progress > bestProgress || (enemy.progress === bestProgress && enemy.id < best?.id)) {
          best = enemy;
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
        targetX: target.x,
        targetY: target.y,
        speed: stats.projectileSpeed,
        damage: stats.damage,
        splash: stats.splash || 0,
        slowFactor: stats.slowFactor || 1,
        slowDuration: stats.slowDuration || 0,
        dead: false,
      });
      tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
      tower.cooldown = stats.rate;
      this.emit("shot", { tower, target, projectileType: tower.type });
    }

    updateProjectiles(dt) {
      const enemiesById = new Map(this.enemies.map((enemy) => [enemy.id, enemy]));
      for (const projectile of this.projectiles) {
        if (projectile.dead) continue;
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
            this.damageEnemy(enemy, projectile.damage);
          }
        }
        return;
      }

      if (!target || target.dead) return;
      this.damageEnemy(target, projectile.damage);
      if (!target.dead && projectile.slowDuration > 0) {
        target.slowFactor = target.slowTimer > 0
          ? Math.min(target.slowFactor, projectile.slowFactor)
          : projectile.slowFactor;
        target.slowTimer = Math.max(target.slowTimer, projectile.slowDuration);
        this.emit("slow", { enemy: target, x: target.x, y: target.y });
      }
    }

    damageEnemy(enemy, amount) {
      if (enemy.dead) return false;
      enemy.hp -= amount;
      if (enemy.hp > 0) return false;
      enemy.dead = true;
      const definition = this.levels.ENEMY_TYPES[enemy.type];
      this.money += definition.bounty;
      this.stats.kills += 1;
      this.stats.earned += definition.bounty;
      this.emit("kill", {
        enemy,
        bounty: definition.bounty,
        x: enemy.x,
        y: enemy.y,
      });
      return true;
    }

    checkWaveComplete() {
      if (this.phase !== "wave" || this.spawnQueue.length || this.enemies.length) return;
      this.projectiles.length = 0;
      if (this.currentWave >= this.levels.WAVES.length) {
        this.phase = "won";
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
      this.emit("waveComplete", {
        wave: this.currentWave,
        reward,
        healed,
        nextWave: this.currentWave + 1,
      });
    }
  }

  return { Game, createGame: (options) => new Game(options), distanceBetween };
});
