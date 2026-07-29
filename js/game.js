/* VANGUARD ZERO - game shell: state machine, HUD, menus, transitions. */
(function (global) {
  'use strict';
  var VZ = global.VZ || (global.VZ = {});
  var T = VZ.TILE, M = VZ.math, A = VZ.art, FX = VZ.fx, S = VZ.Screen;

  var RANKS = [
    { key: 'S', color: '#ffd24a' },
    { key: 'A', color: '#5fe6d8' },
    { key: 'B', color: '#8fd6a8' },
    { key: 'C', color: '#cfd8ea' },
    { key: 'D', color: '#d05a58' }
  ];

  var Game = VZ.Game = function () {
    this.state = 'boot';
    this.stateTime = 0;
    this.stageIndex = 0;
    this.level = null;
    this.player = null;
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.camera = null;
    this.lives = 3;
    this.score = 0;
    this.damageTaken = 0;
    this.stageTime = 0;
    this.playerControl = true;
    this.boss = null;
    this.arena = null;
    this.bossStarted = false;
    this.hud = { flashEnergy: 0, weaponPop: 0, bossHitFlash: 0, bossBar: 0, bossFill: 0,
                 msg: null, msgTime: 0 };
    this.combo = 0; this.comboTimer = 0; this.bestCombo = 0;
    this.fade = 1; this.fadeTarget = 0; this.fadeCb = null;
    this.wipe = 0;
    this.menu = { index: 0, page: 'main' };
    this.save = VZ.save.read();
    if (!this.save.best) this.save.best = {};
    if (!this.save.unlocked) this.save.unlocked = 1;
    if (!this.save.highScore) this.save.highScore = 0;
    this.results = null;
    this.endingScroll = 0;
    this.titleTime = 0;
    this.pauseIndex = 0;
    this.paused = false;
    this.showTouch = false;
  };

  // ------------------------------------------------------------------ boot
  Game.prototype.start = function () {
    A.buildFont();
    VZ.sprites.build();
    VZ.input.init();
    this.setState('title');
    this.fade = 1; this.fadeTarget = 0;
    var self = this;
    this.loop = VZ.Loop(function () { self.update(); }, function () { self.render(); });
    this.loop.start();
  };

  Game.prototype.setState = function (s) {
    this.state = s;
    this.stateTime = 0;
    this.menu.index = 0;
    this.menu.parentIndex = 0;
  };

  /* Kill chain: consecutive kills inside a window escalate the multiplier.
   * Returns the multiplier the kill should be scored at. */
  Game.prototype.addCombo = function () {
    this.combo++;
    this.comboTimer = 160;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    return Math.min(5, 1 + Math.floor((this.combo - 1) / 3));
  };

  Game.prototype.message = function (txt, frames) {
    this.hud.msg = txt; this.hud.msgTime = frames || 100;
  };

  // ------------------------------------------------------------ stage load
  Game.prototype.loadStage = function (index, keepProgress) {
    this.stageIndex = index;
    var data = VZ.STAGES[index];
    this.stageData = data;
    this.level = new VZ.Level(data);
    this.camera = new VZ.Camera(this.level);

    var prevWeapons = this.player ? this.player.unlocked.slice() : [true, false, false];
    var prevWeapon = this.player ? this.player.weapon : 0;

    this.player = new VZ.Player(this, this.level.start.x, this.level.start.y - 12);
    this.player.unlocked = keepProgress ? prevWeapons : [true, false, false];
    this.player.weapon = keepProgress && prevWeapons[prevWeapon] ? prevWeapon : 0;
    this.player.y = this.level.start.y - this.player.h / 2;

    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.boss = null;
    this.bossStarted = false;
    this.bossDefeated = false;
    this.damageTaken = 0;
    this.stageTime = 0;
    this.combo = 0; this.comboTimer = 0; this.bestCombo = 0;
    this.playerControl = true;
    this.deathHandled = false;
    this.stageEndTimer = 0;
    this.respawnPoint = { x: this.level.start.x, y: this.level.start.y };
    this.level.openDoors();

    // Pre-place every spawn; they activate as the camera reaches them.
    this.spawnDefs = this.level.spawns.map(function (s) {
      return { kind: s.kind, x: s.x, y: s.y, live: null, dead: false };
    });

    this.arena = {
      x0: data.arena.tx0 * T, y0: data.arena.ty0 * T,
      x1: data.arena.tx1 * T, y1: data.arena.ty1 * T
    };
    FX.reset();
    this.camera.follow(this.player, true);
    VZ.audio.fadeToSong(VZ.songs[data.music], 0.35);
  };

  // --------------------------------------------------------------- update
  Game.prototype.update = function () {
    VZ.input.poll();
    this.stateTime++;

    // fade easing
    this.fade = M.approach(this.fade, this.fadeTarget, 0.045);
    if (this.fadeCb && Math.abs(this.fade - this.fadeTarget) < 0.001) {
      var cb = this.fadeCb; this.fadeCb = null; cb();
    }

    switch (this.state) {
      case 'title': this.updateTitle(); break;
      case 'stageIntro': this.updateStageIntro(); break;
      case 'play': this.updatePlay(); break;
      case 'results': this.updateResults(); break;
      case 'gameOver': this.updateGameOver(); break;
      case 'ending': this.updateEnding(); break;
    }
    if (this.hud.msgTime > 0) this.hud.msgTime--;
    if (this.hud.flashEnergy > 0) this.hud.flashEnergy--;
    if (this.hud.weaponPop > 0) this.hud.weaponPop--;
    if (this.hud.bossHitFlash > 0) this.hud.bossHitFlash--;
  };

  Game.prototype.fadeTo = function (target, cb) {
    this.fadeTarget = target; this.fadeCb = cb || null;
  };

  // ----------------------------------------------------------------- TITLE
  /* The main menu is data-driven so hiding Stage Select before it is unlocked
   * can't desync the cursor from what's on screen. */
  Game.prototype.mainMenu = function () {
    var items = [{ id: 'start', label: 'START GAME' }];
    if (this.save.unlocked > 1) items.push({ id: 'stages', label: 'STAGE SELECT' });
    items.push({ id: 'options', label: 'OPTIONS' });
    items.push({ id: 'controls', label: 'CONTROLS' });
    return items;
  };

  // Opening a submenu remembers where the cursor was so Back can restore it.
  Game.prototype.openPage = function (page) {
    this.menu.parentIndex = this.menu.index;
    this.menu.page = page;
    this.menu.index = 0;
  };
  Game.prototype.closePage = function () {
    this.menu.page = 'main';
    this.menu.index = this.menu.parentIndex || 0;
    VZ.audio.sfx('deny');
  };

  Game.prototype.updateTitle = function () {
    var In = VZ.input;
    this.titleTime++;
    if (this.fade > 0.02) return;

    var page = this.menu.page;
    if (page === 'main') {
      var menu = this.mainMenu();
      var n = menu.length;
      if (this.menu.index >= n) this.menu.index = n - 1;
      if (In.pressed.up) { this.menu.index = (this.menu.index + n - 1) % n; VZ.audio.sfx('menu'); }
      if (In.pressed.down) { this.menu.index = (this.menu.index + 1) % n; VZ.audio.sfx('menu'); }
      if (In.pressed.jump || In.pressed.start) {
        VZ.audio.resume();
        VZ.audio.sfx('confirm');
        var id = menu[this.menu.index].id;
        if (id === 'start') this.beginGame(0);
        else this.openPage(id);
      }
    } else if (page === 'stages') {
      var n = Math.min(VZ.STAGES.length, this.save.unlocked);
      if (In.pressed.up) { this.menu.index = (this.menu.index + n - 1) % n; VZ.audio.sfx('menu'); }
      if (In.pressed.down) { this.menu.index = (this.menu.index + 1) % n; VZ.audio.sfx('menu'); }
      if (In.pressed.jump || In.pressed.start) { VZ.audio.sfx('confirm'); this.beginGame(this.menu.index); }
      if (In.pressed.select || In.pressed.fire) this.closePage();
    } else if (page === 'options') {
      if (In.pressed.up) { this.menu.index = (this.menu.index + 3) % 4; VZ.audio.sfx('menu'); }
      if (In.pressed.down) { this.menu.index = (this.menu.index + 1) % 4; VZ.audio.sfx('menu'); }
      var delta = (In.pressed.right ? 1 : 0) - (In.pressed.left ? 1 : 0);
      if (delta) {
        if (this.menu.index === 0) VZ.audio.setMusicVol(M.clamp(VZ.audio.musicVol + delta * 0.1, 0, 1));
        else if (this.menu.index === 1) VZ.audio.setSfxVol(M.clamp(VZ.audio.sfxVol + delta * 0.1, 0, 1));
        VZ.audio.sfx('menu');
      }
      if (this.menu.index === 2 && (In.pressed.jump || In.pressed.start)) {
        VZ.toggleFullscreen();
        VZ.audio.sfx('confirm');
      }
      if (this.menu.index === 3 && (In.pressed.jump || In.pressed.start)) {
        this.save.best = {}; this.save.highScore = 0; this.save.unlocked = 1;
        VZ.save.write(this.save);
        VZ.audio.sfx('confirm');
        this.message('RECORDS CLEARED', 90);
      }
      if (In.pressed.select || In.pressed.fire) this.closePage();
    } else if (page === 'controls') {
      if (In.pressed.select || In.pressed.jump || In.pressed.fire || In.pressed.start) {
        this.closePage();
      }
    }
  };

  Game.prototype.beginGame = function (stage) {
    var self = this;
    this.lives = 3;
    this.score = 0;
    this.player = null;
    this.fadeTo(1, function () {
      self.loadStage(stage, false);
      // Stage select grants the weapons you would have had by then.
      if (stage >= 1) self.player.unlocked[1] = true;
      if (stage >= 2) self.player.unlocked[2] = true;
      self.setState('stageIntro');
      self.fadeTo(0);
    });
  };

  // ---------------------------------------------------------- STAGE INTRO
  Game.prototype.updateStageIntro = function () {
    if (this.stateTime > 130 || (this.stateTime > 40 && (VZ.input.pressed.jump || VZ.input.pressed.start))) {
      this.setState('play');
      this.message('READY', 60);
    }
  };

  // ------------------------------------------------------------------ PLAY
  Game.prototype.updatePlay = function () {
    var In = VZ.input;

    if (In.pressed.select) {
      this.paused = !this.paused;
      this.pauseIndex = 0;
      VZ.audio.sfx(this.paused ? 'menu' : 'confirm');
      if (this.paused) VZ.audio.setMusicVol(VZ.audio.musicVol * 0.35);
      else VZ.audio.setMusicVol(Math.min(1, VZ.audio.musicVol / 0.35));
    }
    if (this.paused) { this.updatePause(); return; }

    if (FX.hitstop > 0) { FX.hitstop--; return; }

    this.stageTime++;
    this.level.update(this);

    var p = this.player;
    p.update();

    // ------------------------------------------------ enemy streaming
    this.streamEnemies();

    var i, e;
    for (i = this.enemies.length - 1; i >= 0; i--) {
      e = this.enemies[i];
      e.update();
      if (e.remove) { if (e.def) e.def.live = null; this.enemies.splice(i, 1); }
    }
    if (this.boss) {
      this.boss.update();
      if (this.boss.remove) this.boss = null;
    }

    for (i = this.projectiles.length - 1; i >= 0; i--) {
      var pr = this.projectiles[i];
      if (pr.warn > 0) { pr.warn--; if (pr.warn > 0) continue; }
      pr.update();
      if (pr.remove) this.projectiles.splice(i, 1);
    }
    for (i = this.pickups.length - 1; i >= 0; i--) {
      this.pickups[i].update();
      if (this.pickups[i].remove) this.pickups.splice(i, 1);
    }

    this.resolveCollisions();
    this.checkTriggers();
    if (this.comboTimer > 0 && --this.comboTimer === 0) this.combo = 0;

    FX.update();
    this.camera.follow(p, false);

    if (p.dead && p.deadTimer > 92 && !this.deathHandled) {
      this.deathHandled = true;
      this.afterDeath();
    }
    if (this.stageEndTimer > 0) {
      this.stageEndTimer--;
      // Warp out once the wreckage has finished going up.
      if (this.stageEndTimer === 96 && !p.warp) {
        p.warp = 1;
        this.playerControl = false;
        VZ.audio.sfx('checkpoint');
        VZ.audio.sfx('door');
        FX.ring(p.x, p.y, { grow: 3.2, life: 26, color: '#5fe6d8', width: 2 });
      }
      if (this.stageEndTimer === 0) this.finishStage();
    }
  };

  Game.prototype.updatePause = function () {
    var In = VZ.input;
    var items = 3;
    if (In.pressed.up) { this.pauseIndex = (this.pauseIndex + items - 1) % items; VZ.audio.sfx('menu'); }
    if (In.pressed.down) { this.pauseIndex = (this.pauseIndex + 1) % items; VZ.audio.sfx('menu'); }
    if (In.pressed.jump || In.pressed.start) {
      VZ.audio.sfx('confirm');
      var self = this;
      if (this.pauseIndex === 0) {
        this.paused = false;
        VZ.audio.setMusicVol(Math.min(1, VZ.audio.musicVol / 0.35));
      } else if (this.pauseIndex === 1) {
        this.paused = false;
        VZ.audio.setMusicVol(Math.min(1, VZ.audio.musicVol / 0.35));
        this.fadeTo(1, function () {
          self.loadStage(self.stageIndex, true);
          self.setState('stageIntro'); self.fadeTo(0);
        });
      } else {
        this.paused = false;
        VZ.audio.setMusicVol(Math.min(1, VZ.audio.musicVol / 0.35));
        this.fadeTo(1, function () {
          self.setState('title');
          self.menu.page = 'main';
          VZ.audio.fadeToSong(VZ.songs.title, 0.3);
          self.fadeTo(0);
        });
      }
    }
    var d = (In.pressed.right ? 1 : 0) - (In.pressed.left ? 1 : 0);
    if (d && this.pauseIndex === 0) { /* reserved */ }
  };

  // Activate spawns near the camera; retire them once far behind.
  Game.prototype.streamEnemies = function () {
    var cx = this.camera.x, cy = this.camera.y;
    var padIn = 80, padOut = 220;
    for (var i = 0; i < this.spawnDefs.length; i++) {
      var d = this.spawnDefs[i];
      if (d.dead) continue;
      var onX = d.x > cx - padIn && d.x < cx + VZ.W + padIn;
      var onY = d.y > cy - 140 && d.y < cy + VZ.H + 140;
      if (!d.live && onX && onY) {
        if (d.kind === 'health' || d.kind === 'energy' || d.kind === 'life' || d.kind === 'bigHealth') {
          var pk = new VZ.Pickup(this, d.x, d.y - 10, d.kind === 'bigHealth' ? 'bigHealth' : d.kind);
          pk.def = d;
          d.live = pk;
          this.pickups.push(pk);
        } else {
          var f = VZ.ENEMY_FACTORY[d.kind];
          if (!f) continue;
          var en = f(this, d.x, d.y);
          en.def = d;
          d.live = en;
          this.enemies.push(en);
        }
      } else if (d.live && (d.x < cx - padOut || d.x > cx + VZ.W + padOut)) {
        // Off-screen by a wide margin: retire so it resets when revisited.
        var idx = this.enemies.indexOf(d.live);
        if (idx >= 0) { this.enemies.splice(idx, 1); d.live = null; }
        else {
          var pidx = this.pickups.indexOf(d.live);
          if (pidx >= 0) { this.pickups.splice(pidx, 1); d.live = null; }
        }
      }
    }
    // Enemies killed for good.
    for (var j = 0; j < this.spawnDefs.length; j++) {
      var dd = this.spawnDefs[j];
      if (dd.live && dd.live.dead) { dd.live = null; }
    }
  };

  // -------------------------------------------------------------- collisions
  Game.prototype.resolveCollisions = function () {
    var p = this.player, i, j;
    var targets = this.enemies.slice();
    if (this.boss) targets.push(this.boss);

    for (i = this.projectiles.length - 1; i >= 0; i--) {
      var pr = this.projectiles[i];
      // A hit can end the fight, which prunes this list mid-loop.
      if (!pr || pr.remove || pr.warn > 0) continue;
      var pb = pr.box();

      if (pr.team === 'player') {
        for (j = 0; j < targets.length; j++) {
          var t = targets[j];
          if (t.dead || (t.dying && t.isBoss)) continue;
          if (pr.hitList.indexOf(t) >= 0) continue;
          if (!VZ.aabb(pb, t.box())) continue;
          pr.hitList.push(t);
          var res = t.receive ? t.receive(pr) : 'hit';
          if (res === 'deflect') {
            VZ.audio.sfx('deflect');
            FX.sparks(pr.x, pr.y, pr.vx > 0 ? Math.PI : 0, '#cfd8ea');
            pr.remove = true;
            break;
          }
          if (pr.onHit(t)) break;
        }
      } else if (p && !p.dead) {
        if (VZ.aabb(pb, p.box())) {
          p.takeHit(pr.damage, pr.x);
          pr.burst();
        }
      }
    }

    if (!p || p.dead) return;
    var pbox = p.box();
    for (i = 0; i < targets.length; i++) {
      var e = targets[i];
      if (e.dead || e.contactDamage <= 0) continue;
      if (e.isBoss && (e.state === 'intro' || e.dying)) continue;
      if (VZ.aabb(pbox, e.box())) p.takeHit(e.contactDamage, e.x);
    }
  };

  // -------------------------------------------------------------- triggers
  Game.prototype.checkTriggers = function () {
    var p = this.player, lv = this.level;

    // checkpoints
    for (var i = 0; i < lv.checkpoints.length; i++) {
      var c = lv.checkpoints[i];
      if (c.taken) continue;
      if (Math.abs(p.x - c.x) < 14 && Math.abs(p.y - (c.y - 12)) < 26) {
        c.taken = true;
        this.respawnPoint = { x: c.x, y: c.y };
        VZ.audio.sfx('checkpoint');
        FX.popup(c.x, c.y - 34, 'CHECKPOINT', '#5fe6d8', { life: 80 });
        FX.ring(c.x, c.y - 12, { grow: 3.2, life: 22, color: '#5fe6d8', width: 2 });
      }
    }

    // boss gate
    if (lv.bossGate && !this.bossStarted && p.x > lv.bossGate.x + 8) {
      this.startBoss();
    }

  };

  Game.prototype.startBoss = function () {
    this.bossStarted = true;
    var data = this.stageData;
    this.level.shutDoors();
    this.camera.lock = { x0: this.arena.x0, y0: this.arena.y0, x1: this.arena.x1, y1: this.arena.y1 };
    var f = VZ.BOSS_FACTORY[data.boss];
    this.boss = f(this, data.bossSpawn.tx * T + 8, data.bossSpawn.ty * T + 8);
    this.boss.homeY = this.boss.y;
    this.hud.bossBar = 0;
    this.playerControl = false;
    VZ.audio.fadeToSong(VZ.songs[data.boss === 'prime' ? 'finalBoss' : 'boss'], 0.3);
    VZ.audio.sfx('door');
    FX.flash('#ff5a6e', 0.3);
  };

  Game.prototype.onBossReady = function () {
    this.playerControl = true;
  };

  Game.prototype.onBossDying = function () {
    this.playerControl = true;
    // Clear enemy fire in place. Replacing the array here would pull it out
    // from under resolveCollisions, which is what called us - a boss killed by
    // a projectile would then crash on the next index.
    for (var i = this.projectiles.length - 1; i >= 0; i--) {
      if (this.projectiles[i].team !== 'player') this.projectiles.splice(i, 1);
    }
  };

  Game.prototype.onBossDefeated = function (boss) {
    this.bossDefeated = true;
    this.score += boss.score;
    var self = this;
    if (boss.reward) {
      var idx = boss.reward === 'spread' ? 1 : 2;
      if (!this.player.unlocked[idx]) {
        this.player.unlocked[idx] = true;
        this.message('WEAPON ACQUIRED: ' + VZ.WEAPONS[idx].name, 180);
        VZ.audio.sfx('checkpoint');
      }
    }
    this.player.energy = VZ.P.MAX_ENERGY;
    // Frame-based so a pause can't skip past the victory beat.
    this.stageEndTimer = 170;
  };

  Game.prototype.finishStage = function () {
    if (this.state !== 'play') return;
    var stage = this.stageData;
    var timeSec = this.stageTime / 60;
    var self = this;

    // Rank: time against par, then damage, then thoroughness.
    var score = 0;
    if (timeSec <= stage.par) score += 2;
    else if (timeSec <= stage.par * 1.35) score += 1;
    if (this.damageTaken === 0) score += 3;
    else if (this.damageTaken <= 8) score += 2;
    else if (this.damageTaken <= 20) score += 1;
    if (this.player.kills >= 14) score += 1;
    var rankIdx = score >= 6 ? 0 : (score >= 4 ? 1 : (score >= 3 ? 2 : (score >= 1 ? 3 : 4)));

    var timeBonus = Math.max(0, Math.round((stage.par * 1.6 - timeSec) * 40));
    var noHitBonus = this.damageTaken === 0 ? 5000 : 0;
    this.score += timeBonus + noHitBonus;

    this.results = {
      stage: stage, time: this.stageTime, damage: this.damageTaken,
      kills: this.player.kills, chain: this.bestCombo,
      rank: RANKS[rankIdx], rankIdx: rankIdx,
      timeBonus: timeBonus, noHitBonus: noHitBonus, reveal: 0
    };

    var key = 's' + stage.id;
    if (!this.save.best[key] || this.stageTime < this.save.best[key]) {
      this.save.best[key] = this.stageTime;
      this.results.newRecord = true;
    }
    if (this.stageIndex + 1 >= this.save.unlocked) {
      this.save.unlocked = Math.min(VZ.STAGES.length, this.stageIndex + 2);
    }
    if (this.score > this.save.highScore) this.save.highScore = this.score;
    VZ.save.write(this.save);

    this.setState('results');
    VZ.audio.fadeToSong(VZ.songs.stageClear, 0.25);
  };

  Game.prototype.updateResults = function () {
    var r = this.results;
    r.reveal++;
    var In = VZ.input;
    if (r.reveal > 40 && (In.pressed.jump || In.pressed.start || In.pressed.fire)) {
      if (r.reveal < 200) { r.reveal = 200; VZ.audio.sfx('confirm'); return; }
      var self = this;
      this.fadeTo(1, function () {
        if (self.stageIndex + 1 < VZ.STAGES.length) {
          self.loadStage(self.stageIndex + 1, true);
          self.setState('stageIntro');
        } else {
          self.setState('ending');
          self.endingScroll = 0;
          VZ.audio.fadeToSong(VZ.songs.ending, 0.3);
        }
        self.fadeTo(0);
      });
    }
  };

  // ------------------------------------------------------------ death flow
  Game.prototype.onPlayerDeath = function () {
    VZ.audio.stopSong();
  };

  Game.prototype.afterDeath = function () {
    this.lives--;
    var self = this;
    if (this.lives < 0) {
      if (this.score > this.save.highScore) {
        this.save.highScore = this.score;
        VZ.save.write(this.save);
      }
      this.fadeTo(1, function () {
        self.setState('gameOver');
        VZ.audio.fadeToSong(VZ.songs.gameOver, 0.2);
        self.fadeTo(0);
      });
      return;
    }
    this.fadeTo(1, function () {
      // Reset the section: enemies come back, the boss restarts if we were in it.
      self.projectiles.length = 0;
      self.pickups.length = 0;
      self.enemies.length = 0;
      for (var i = 0; i < self.spawnDefs.length; i++) {
        var d = self.spawnDefs[i];
        if (!d.dead) d.live = null;
      }
      if (self.bossStarted && !self.bossDefeated) {
        self.boss = null;
        self.bossStarted = false;
        self.level.openDoors();
        self.camera.lock = null;
        self.playerControl = true;
        // Put the player back at the arena mouth so they can re-enter.
        self.player.respawn(self.arena.x0 - 40, self.arena.y1);
        VZ.audio.fadeToSong(VZ.songs[self.stageData.music], 0.25);
      } else {
        self.player.respawn(self.respawnPoint.x, self.respawnPoint.y);
        VZ.audio.fadeToSong(VZ.songs[self.stageData.music], 0.25);
      }
      FX.reset();
      self.deathHandled = false;
      self.camera.follow(self.player, true);
      self.message('READY', 50);
      self.fadeTo(0);
    });
  };

  Game.prototype.updateGameOver = function () {
    var In = VZ.input;
    if (this.stateTime > 60 && (In.pressed.jump || In.pressed.start)) {
      var self = this;
      VZ.audio.sfx('confirm');
      this.fadeTo(1, function () {
        self.setState('title');
        self.menu.page = 'main';
        VZ.audio.fadeToSong(VZ.songs.title, 0.3);
        self.fadeTo(0);
      });
    }
  };

  Game.prototype.updateEnding = function () {
    this.endingScroll += 0.35;
    var In = VZ.input;
    if (In.held.jump || In.held.fire) this.endingScroll += 1.2;
    if (this.endingScroll > 780 || (this.stateTime > 90 && In.pressed.start)) {
      var self = this;
      this.fadeTo(1, function () {
        self.setState('title');
        self.menu.page = 'main';
        VZ.audio.fadeToSong(VZ.songs.title, 0.3);
        self.fadeTo(0);
      });
    }
  };

  // =========================================================== RENDERING
  Game.prototype.render = function () {
    var ctx = S.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VZ.W, VZ.H);

    switch (this.state) {
      case 'title': this.drawTitle(ctx); break;
      case 'stageIntro': this.drawWorld(ctx); this.drawStageIntro(ctx); break;
      case 'play':
        this.drawWorld(ctx);
        this.drawHUD(ctx);
        this.drawBossIntro(ctx);
        if (this.paused) this.drawPause(ctx);
        break;
      case 'results': this.drawWorld(ctx); this.drawResults(ctx); break;
      case 'gameOver': this.drawGameOver(ctx); break;
      case 'ending': this.drawEnding(ctx); break;
    }

    FX.drawOverlay(ctx);
    if (this.fade > 0.002) {
      ctx.globalAlpha = Math.min(1, this.fade);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, VZ.W, VZ.H);
      ctx.globalAlpha = 1;
    }
    // A faint scanline field ties the whole thing together.
    this.drawScanlines(ctx);
    S.present();
  };

  Game.prototype.drawScanlines = function (ctx) {
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#000';
    for (var y = 0; y < VZ.H; y += 2) ctx.fillRect(0, y, VZ.W, 1);
    ctx.globalAlpha = 1;
  };

  Game.prototype.drawWorld = function (ctx) {
    if (!this.level) return;
    var camX = Math.round(this.camera.x + FX.shakeX);
    var camY = Math.round(this.camera.y + FX.shakeY);

    this.level.drawBackground(ctx, camX, camY);
    this.level.drawTerrain(ctx, camX, camY);

    var i;
    for (i = 0; i < this.pickups.length; i++) this.pickups[i].draw(ctx, camX, camY);
    for (i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.x < camX - 40 || e.x > camX + VZ.W + 40) continue;
      e.draw(ctx, camX, camY);
    }
    if (this.boss) this.boss.draw(ctx, camX, camY);
    if (this.player) {
      if (this.player.warp > 0) this.drawWarpBeam(ctx, camX, camY);
      this.player.draw(ctx, camX, camY);
    }
    for (i = 0; i < this.projectiles.length; i++) {
      var pr = this.projectiles[i];
      if (pr.warn > 0) { this.drawWarning(ctx, pr, camX, camY); continue; }
      pr.draw(ctx, camX, camY);
    }

    FX.draw(ctx, camX, camY);
    this.level.drawAtmosphere(ctx, camX, camY);
    FX.drawTexts(ctx, camX, camY);
  };

  /* Column of light the player rides out on after a boss falls. */
  Game.prototype.drawWarpBeam = function (ctx, camX, camY) {
    var p = this.player;
    var x = Math.round(p.x - camX);
    var t = Math.min(1, p.warp / 16);
    var w = Math.round(M.lerp(2, 13, M.ease(t)));
    ctx.save();
    ctx.globalAlpha = 0.22 * t;
    ctx.fillStyle = '#5fe6d8';
    ctx.fillRect(x - w - 4, 0, (w + 4) * 2, VZ.H);
    ctx.globalAlpha = 0.55 * t;
    ctx.fillStyle = '#9ff4ea';
    ctx.fillRect(x - w, 0, w * 2, VZ.H);
    ctx.globalAlpha = 0.9 * t;
    ctx.fillStyle = '#ffffff';
    var jitter = Math.round(Math.sin(p.warp * 0.8) * 1);
    ctx.fillRect(x - 3 + jitter, 0, 6, VZ.H);
    // travelling bands
    ctx.globalAlpha = 0.5 * t;
    ctx.fillStyle = '#ffffff';
    for (var i = 0; i < 6; i++) {
      var by = (VZ.H - ((p.warp * 7 + i * 40) % (VZ.H + 40)));
      ctx.fillRect(x - w, Math.round(by), w * 2, 2);
    }
    ctx.restore();
  };

  // Incoming-debris marker so ceiling drops are dodgeable.
  Game.prototype.drawWarning = function (ctx, pr, camX, camY) {
    var x = Math.round(pr.x - camX);
    ctx.globalAlpha = 0.4 + Math.sin(pr.warn * 0.5) * 0.3;
    ctx.fillStyle = '#ff5a6e';
    ctx.fillRect(x - 6, Math.round(pr.y - camY), 12, 2);
    A.text(ctx, '!', x, Math.round(pr.y - camY) + 4, { color: '#ff5a6e', align: 'center' });
    ctx.globalAlpha = 1;
  };

  // ------------------------------------------------------------------- HUD
  Game.prototype.drawHUD = function (ctx) {
    var p = this.player;
    if (!p) return;

    // health
    this.bar(ctx, 8, 8, 16, p.hp / p.maxHp, '#ff5a6e', '#ffb0a0', 'HP');
    // weapon energy (only once a sub-weapon exists)
    if (p.unlocked[1] || p.unlocked[2]) {
      var w = VZ.WEAPONS[p.weapon];
      var col = w.color;
      var flash = this.hud.flashEnergy > 0 && (this.hud.flashEnergy >> 1) % 2 === 0;
      this.bar(ctx, 8, 20, 14, p.energy / VZ.P.MAX_ENERGY,
        flash ? '#ffffff' : col, '#ffffff', 'WP');
      A.text(ctx, w.name, 8, 30, { color: this.hud.weaponPop > 0 ? '#ffffff' : col, shadow: '#000' });
    }

    // lives
    var lifeImg = A.gfx.pick_life;
    for (var i = 0; i < Math.min(this.lives, 5); i++) {
      ctx.drawImage(lifeImg, 8 + i * 11, VZ.H - 16);
    }
    if (this.lives > 5) A.text(ctx, 'X' + this.lives, 8 + 5 * 11 + 2, VZ.H - 13, { color: '#ffd24a', shadow: '#000' });

    // score / timer
    A.text(ctx, 'SCORE ' + this.pad(this.score, 7), VZ.W - 8, 8, { color: '#ffffff', shadow: '#000', align: 'right' });
    A.text(ctx, VZ.formatTime(this.stageTime), VZ.W - 8, 18, { color: '#cfd8ea', shadow: '#000', align: 'right' });
    // The stage name yields to the boss bar rather than colliding with it.
    if (!this.boss || this.boss.dying) {
      A.text(ctx, this.stageData.name, VZ.W - 8, VZ.H - 13,
        { color: '#8fa3c4', shadow: '#000', align: 'right' });
    }

    // boss bar
    if (this.boss && !this.boss.dying) {
      if (this.boss.state === 'intro') { this.hud.bossBar = 0; this.hud.bossFill = 0; return; }
      this.hud.bossBar = M.approach(this.hud.bossBar, 1, 0.06);
      this.hud.bossFill = M.approach(this.hud.bossFill || 0, 1, 0.05);
      // Sits below the arena floor line so it never covers the fight.
      var bw = 216, bx = (VZ.W - bw) / 2, by = VZ.H - 12;
      ctx.globalAlpha = this.hud.bossBar;
      A.text(ctx, this.boss.name, VZ.W / 2, by - 10, { color: '#ffffff', shadow: '#000', align: 'center' });
      ctx.fillStyle = '#12142e';
      ctx.fillRect(bx - 2, by - 2, bw + 4, 10);
      ctx.fillStyle = '#2a3348';
      ctx.fillRect(bx, by, bw, 6);
      var frac = Math.max(0, this.boss.hp / this.boss.maxHp) * (this.hud.bossFill || 0);
      var grd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      grd.addColorStop(0, '#ff5a6e'); grd.addColorStop(1, '#ffd24a');
      ctx.fillStyle = this.hud.bossHitFlash > 0 ? '#ffffff' : grd;
      ctx.fillRect(bx, by, Math.round(bw * frac), 6);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(bx, by, Math.round(bw * frac), 2);
      // phase ticks
      ctx.fillStyle = '#12142e';
      ctx.fillRect(bx + Math.round(bw * 0.33), by, 1, 6);
      ctx.fillRect(bx + Math.round(bw * 0.66), by, 1, 6);
      ctx.globalAlpha = 1;
    }

    // kill chain
    if (this.combo > 1 && this.comboTimer > 0) {
      var cm = Math.min(5, 1 + Math.floor((this.combo - 1) / 3));
      var fade = this.comboTimer < 40 ? this.comboTimer / 40 : 1;
      var pop = this.comboTimer > 150 ? 1 + (this.comboTimer - 150) * 0.06 : 1;
      ctx.globalAlpha = fade;
      A.text(ctx, this.combo + ' CHAIN', VZ.W / 2, 8,
        { color: cm >= 3 ? '#ffd24a' : '#5fe6d8', align: 'center', shadow: '#12142e', scale: pop });
      if (cm > 1) {
        A.text(ctx, 'X' + cm, VZ.W / 2, 18,
          { color: '#ffffff', align: 'center', shadow: '#12142e' });
      }
      ctx.globalAlpha = 1;
    }

    // centre message
    if (this.hud.msgTime > 0 && this.hud.msg) {
      var a = this.hud.msgTime > 20 ? 1 : this.hud.msgTime / 20;
      ctx.globalAlpha = a;
      A.text(ctx, this.hud.msg, VZ.W / 2, VZ.H / 2 - 30,
        { color: '#ffffff', shadow: '#12142e', align: 'center', scale: 2 });
      ctx.globalAlpha = 1;
    }
  };

  /* Letterboxed name card while the boss powers up. Runs off the boss's own
   * intro timer so the two can never drift apart. */
  Game.prototype.drawBossIntro = function (ctx) {
    var b = this.boss;
    if (!b || b.state !== 'intro') return;
    var t = b.timer, TT = b.introTime;
    var inT = M.clamp(t / 16, 0, 1);
    var outT = M.clamp((TT - t) / 14, 0, 1);
    var k = M.ease(Math.min(inT, outT));

    var barH = Math.round(34 * k);
    if (barH <= 0) return;

    // letterbox with hazard striping along the inner edge
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, VZ.W, barH);
    ctx.fillRect(0, VZ.H - barH, VZ.W, barH);
    var off = (this.stateTime * 1.4) % 16;
    ctx.fillStyle = '#ffd24a';
    ctx.globalAlpha = 0.85;
    for (var sx = -16; sx < VZ.W + 16; sx += 16) {
      ctx.beginPath();
      ctx.moveTo(sx + off, barH - 3); ctx.lineTo(sx + off + 6, barH - 3);
      ctx.lineTo(sx + off - 2, barH); ctx.lineTo(sx + off - 8, barH);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx - off, VZ.H - barH); ctx.lineTo(sx - off + 6, VZ.H - barH);
      ctx.lineTo(sx - off - 2, VZ.H - barH + 3); ctx.lineTo(sx - off - 8, VZ.H - barH + 3);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // WARNING flasher
    if (t > 8 && t < TT - 14) {
      var blink = (t >> 3) % 2 === 0;
      ctx.globalAlpha = blink ? 1 : 0.25;
      A.text(ctx, 'WARNING', VZ.W / 2, 12, { color: '#ff5a6e', align: 'center', scale: 2, shadow: '#12142e' });
      ctx.globalAlpha = 1;
    }

    // name slides in from the right and settles
    if (t > 20) {
      var slide = M.ease(M.clamp((t - 20) / 26, 0, 1));
      var nx = M.lerp(VZ.W + 100, VZ.W / 2, slide);
      if (t > TT - 20) nx = M.lerp(VZ.W / 2, -100, M.ease(M.clamp((t - (TT - 20)) / 20, 0, 1)));
      ctx.globalAlpha = 1;
      A.text(ctx, b.name, nx, VZ.H - 24, { color: '#ffffff', align: 'center', scale: 2, shadow: '#12142e' });
      A.text(ctx, 'ELIMINATE', nx, VZ.H - 10, { color: '#ff5a6e', align: 'center', shadow: '#12142e' });
    }

    // scan sweep across the boss
    if (t > 26 && t < TT - 20) {
      var sy = ((t - 26) * 5) % (VZ.H - barH * 2) + barH;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#5fe6d8';
      ctx.fillRect(0, Math.round(sy), VZ.W, 1);
      ctx.globalAlpha = 1;
    }
  };

  Game.prototype.bar = function (ctx, x, y, segs, frac, color, hi, label) {
    A.text(ctx, label, x, y, { color: '#cfd8ea', shadow: '#000' });
    var bx = x + 16, seg = 3, gap = 1;
    ctx.fillStyle = '#12142e';
    ctx.fillRect(bx - 1, y - 1, segs * (seg + gap) + 1, 9);
    for (var i = 0; i < segs; i++) {
      var on = (i / segs) < frac - 0.0001;
      ctx.fillStyle = on ? color : '#2a3348';
      ctx.fillRect(bx + i * (seg + gap), y, seg, 7);
      if (on) { ctx.fillStyle = hi; ctx.fillRect(bx + i * (seg + gap), y, seg, 2); }
    }
  };

  Game.prototype.pad = function (n, w) {
    var s = String(Math.floor(n));
    while (s.length < w) s = '0' + s;
    return s;
  };

  // --------------------------------------------------------------- SCREENS
  Game.prototype.drawStageIntro = function (ctx) {
    var t = this.stateTime;
    var d = this.stageData;
    // shutter bars sliding in then out
    var open = t < 24 ? t / 24 : (t > 106 ? 1 - (t - 106) / 24 : 1);
    open = M.clamp(open, 0, 1);
    ctx.globalAlpha = 0.85 * open;
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, VZ.H / 2 - 46 * open, VZ.W, 92 * open);
    ctx.globalAlpha = 1;

    if (t > 20) {
      var a = M.clamp((t - 20) / 18, 0, 1) * (t > 106 ? M.clamp(1 - (t - 106) / 20, 0, 1) : 1);
      ctx.globalAlpha = a;
      A.text(ctx, 'STAGE ' + d.id, VZ.W / 2, VZ.H / 2 - 34, { color: '#5fe6d8', align: 'center', shadow: '#000' });
      A.text(ctx, d.name, VZ.W / 2, VZ.H / 2 - 20, { color: '#ffffff', align: 'center', scale: 2, shadow: '#12142e' });
      A.text(ctx, d.subtitle, VZ.W / 2, VZ.H / 2 + 4, { color: '#8fa3c4', align: 'center' });
      var best = this.save.best['s' + d.id];
      if (best) A.text(ctx, 'BEST ' + VZ.formatTime(best), VZ.W / 2, VZ.H / 2 + 20, { color: '#ffd24a', align: 'center' });
      ctx.globalAlpha = 1;
    }
  };

  Game.prototype.drawTitle = function (ctx) {
    var t = this.titleTime;
    // animated sky backdrop
    var bg = A.buildBackground('sky');
    for (var i = 0; i < bg.length; i++) {
      var L = bg[i], cv = L.canvas;
      var ox = -((t * L.factor * 0.6) % cv.width);
      var oy = Math.round((VZ.H - cv.height) * 0.55 + (L.yOff || 0));
      for (var px = ox; px < VZ.W; px += cv.width) ctx.drawImage(cv, Math.round(px), oy);
    }
    ctx.globalAlpha = 0.45; ctx.fillStyle = '#0a0e1e';
    ctx.fillRect(0, 0, VZ.W, VZ.H); ctx.globalAlpha = 1;

    // logo
    var ly = 34 + Math.sin(t * 0.03) * 2;
    A.text(ctx, 'VANGUARD', VZ.W / 2 + 1, ly + 1, { color: '#12142e', align: 'center', scale: 4 });
    A.text(ctx, 'VANGUARD', VZ.W / 2, ly, { color: '#6f9dfa', align: 'center', scale: 4 });
    A.text(ctx, 'VANGUARD', VZ.W / 2, ly, { color: '#d6e8ff', align: 'center', scale: 4, wave: t * 0.06, waveAmp: 0 });
    A.text(ctx, 'ZERO', VZ.W / 2, ly + 32, { color: '#12142e', align: 'center', scale: 4 });
    A.text(ctx, 'ZERO', VZ.W / 2 - 1, ly + 31, { color: '#ffd24a', align: 'center', scale: 4 });

    // a sliver of light sweeping the logo
    var sweep = ((t * 2.2) % (VZ.W + 120)) - 60;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.16;
    var g = ctx.createLinearGradient(sweep - 26, 0, sweep + 26, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sweep - 26, ly - 4, 52, 66);
    ctx.restore();

    if (this.menu.page === 'main') {
      var items = this.mainMenu();
      var by = 126;
      for (var k = 0; k < items.length; k++) {
        var sel = k === this.menu.index;
        var col = sel ? '#ffd24a' : '#9fb6dd';
        A.text(ctx, items[k].label, VZ.W / 2, by + k * 13, { color: col, align: 'center', shadow: '#12142e' });
        if (sel) {
          var ax = VZ.W / 2 - A.textWidth(items[k].label) / 2 - 12 + Math.sin(t * 0.16) * 2;
          A.text(ctx, '>', ax, by + k * 13, { color: '#ffd24a', shadow: '#12142e' });
        }
      }
      A.text(ctx, 'HI-SCORE ' + this.pad(this.save.highScore, 7), VZ.W / 2, VZ.H - 26,
        { color: '#8fa3c4', align: 'center' });
      A.text(ctx, 'ARROWS MOVE  Z JUMP  X FIRE  C DASH', VZ.W / 2, VZ.H - 14,
        { color: '#5f6f92', align: 'center' });
    } else if (this.menu.page === 'stages') {
      this.panel(ctx, 60, 108, VZ.W - 120, 82);
      A.text(ctx, 'STAGE SELECT', VZ.W / 2, 114, { color: '#5fe6d8', align: 'center' });
      var n = Math.min(VZ.STAGES.length, this.save.unlocked);
      for (var s = 0; s < n; s++) {
        var st = VZ.STAGES[s];
        var sel2 = s === this.menu.index;
        A.text(ctx, (s + 1) + '. ' + st.name, 76, 130 + s * 12,
          { color: sel2 ? '#ffd24a' : '#9fb6dd' });
        var b = this.save.best['s' + st.id];
        A.text(ctx, b ? VZ.formatTime(b) : '--:--.--', VZ.W - 76, 130 + s * 12,
          { color: sel2 ? '#ffd24a' : '#5f6f92', align: 'right' });
      }
      A.text(ctx, 'X BACK', VZ.W / 2, 178, { color: '#5f6f92', align: 'center' });
    } else if (this.menu.page === 'options') {
      this.panel(ctx, 72, 106, VZ.W - 144, 84);
      A.text(ctx, 'OPTIONS', VZ.W / 2, 112, { color: '#5fe6d8', align: 'center' });
      var opts = [
        ['MUSIC', Math.round(VZ.audio.musicVol * 10)],
        ['SOUND', Math.round(VZ.audio.sfxVol * 10)],
        ['FULLSCREEN', null],
        ['CLEAR RECORDS', null]
      ];
      for (var o = 0; o < opts.length; o++) {
        var selo = o === this.menu.index;
        A.text(ctx, opts[o][0], 88, 128 + o * 13, { color: selo ? '#ffd24a' : '#9fb6dd' });
        if (opts[o][1] !== null) {
          var meter = '';
          for (var mm = 0; mm < 10; mm++) meter += mm < opts[o][1] ? '#' : '-';
          A.text(ctx, meter, VZ.W - 88, 128 + o * 13, { color: selo ? '#ffd24a' : '#5f6f92', align: 'right' });
        }
      }
      A.text(ctx, 'X BACK', VZ.W / 2, 176, { color: '#5f6f92', align: 'center' });
    } else if (this.menu.page === 'controls') {
      this.panel(ctx, 46, 92, VZ.W - 92, 108);
      A.text(ctx, 'CONTROLS', VZ.W / 2, 98, { color: '#5fe6d8', align: 'center' });
      var rows = [
        ['MOVE', 'ARROWS / WASD'],
        ['JUMP', 'Z  /  SPACE'],
        ['FIRE  (HOLD TO CHARGE)', 'X'],
        ['DASH', 'C  /  SHIFT'],
        ['SWAP WEAPON', 'V'],
        ['PAUSE', 'ESC'],
        ['FULLSCREEN / MUTE', 'F  /  M'],
        ['WALL JUMP', 'HOLD INTO WALL + JUMP']
      ];
      for (var r = 0; r < rows.length; r++) {
        A.text(ctx, rows[r][0], 58, 112 + r * 11, { color: '#9fb6dd' });
        A.text(ctx, rows[r][1], VZ.W - 58, 112 + r * 11, { color: '#ffd24a', align: 'right' });
      }
      A.text(ctx, 'GAMEPADS ARE SUPPORTED', VZ.W / 2, VZ.H - 12, { color: '#5f6f92', align: 'center' });
    }
  };

  Game.prototype.panel = function (ctx, x, y, w, h) {
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = '#0a0e1e';
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#3a63c8'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = '#5fe6d8';
    ctx.fillRect(x, y, 4, 1); ctx.fillRect(x, y, 1, 4);
    ctx.fillRect(x + w - 4, y + h - 1, 4, 1); ctx.fillRect(x + w - 1, y + h - 4, 1, 4);
  };

  Game.prototype.drawPause = function (ctx) {
    ctx.globalAlpha = 0.6; ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, VZ.W, VZ.H); ctx.globalAlpha = 1;
    this.panel(ctx, 120, 68, 144, 84);
    A.text(ctx, 'PAUSED', VZ.W / 2, 78, { color: '#5fe6d8', align: 'center', scale: 2 });
    var items = ['RESUME', 'RESTART STAGE', 'QUIT TO TITLE'];
    for (var i = 0; i < items.length; i++) {
      var sel = i === this.pauseIndex;
      A.text(ctx, items[i], VZ.W / 2, 104 + i * 14,
        { color: sel ? '#ffd24a' : '#9fb6dd', align: 'center' });
    }
  };

  Game.prototype.drawResults = function (ctx) {
    var r = this.results, t = r.reveal;
    ctx.globalAlpha = 0.72; ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, VZ.W, VZ.H); ctx.globalAlpha = 1;
    this.panel(ctx, 62, 30, VZ.W - 124, 156);

    A.text(ctx, 'STAGE CLEAR', VZ.W / 2, 40, { color: '#5fe6d8', align: 'center', scale: 2 });
    A.text(ctx, r.stage.name, VZ.W / 2, 60, { color: '#9fb6dd', align: 'center' });

    var rows = [
      ['TIME', VZ.formatTime(r.time), 40],
      ['DAMAGE TAKEN', String(r.damage), 58],
      ['ENEMIES DOWN', String(r.kills), 76],
      ['BEST CHAIN', String(r.chain), 94],
      ['TIME BONUS', String(r.timeBonus), 112],
      ['NO-HIT BONUS', String(r.noHitBonus), 130]
    ];
    for (var i = 0; i < rows.length; i++) {
      if (t < rows[i][2]) continue;
      if (t === rows[i][2]) VZ.audio.sfx('menu', { vol: 0.7 });
      A.text(ctx, rows[i][0], 78, 76 + i * 11, { color: '#9fb6dd' });
      A.text(ctx, rows[i][1], VZ.W - 78, 76 + i * 11, { color: '#ffffff', align: 'right' });
    }
    if (t >= 158) {
      var pop = t < 176 ? 3 - (t - 158) / 9 : 2;
      A.text(ctx, 'RANK', VZ.W / 2 - 26, 152, { color: '#9fb6dd', align: 'center' });
      A.text(ctx, r.rank.key, VZ.W / 2 + 16, 145,
        { color: r.rank.color, align: 'center', scale: Math.max(2, pop), shadow: '#12142e' });
      if (t === 158) VZ.audio.sfx(r.rankIdx <= 1 ? 'checkpoint' : 'confirm');
    }
    if (r.newRecord && t >= 170 && (t >> 3) % 2 === 0) {
      A.text(ctx, 'NEW RECORD!', VZ.W / 2, 172, { color: '#ffd24a', align: 'center' });
    }
    if (t > 200 && (t >> 4) % 2 === 0) {
      A.text(ctx, 'PRESS  Z', VZ.W / 2, VZ.H - 16, { color: '#ffffff', align: 'center' });
    }
  };

  Game.prototype.drawGameOver = function (ctx) {
    var t = this.stateTime;
    ctx.fillStyle = '#05070f'; ctx.fillRect(0, 0, VZ.W, VZ.H);

    // slow drifting embers
    for (var i = 0; i < 40; i++) {
      var ex = (i * 61 + Math.sin(i) * 40) % VZ.W;
      var ey = (VZ.H + 40 - ((t * (0.25 + (i % 5) * 0.12) + i * 37) % (VZ.H + 60)));
      ctx.globalAlpha = 0.15 + (i % 4) * 0.12;
      ctx.fillStyle = i % 3 === 0 ? '#ff5a6e' : '#8fa3c4';
      ctx.fillRect(ex | 0, ey | 0, 1, 2);
    }
    ctx.globalAlpha = 1;

    // the wreck, flickering
    var g = A.gfx;
    if (t > 10) {
      var flick = (t >> 2) % 9 !== 0;
      ctx.globalAlpha = flick ? 0.9 : 0.4;
      var px = Math.round(VZ.W / 2) - 8, py = 150;
      ctx.drawImage(g.torso_hurt, px, py - 17);
      ctx.drawImage(g.legs_hurt, px, py);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ff5a6e';
      ctx.fillRect(px - 14, py + 6, 44, 1);
      ctx.globalAlpha = 1;
    }

    var a = M.clamp((t - 6) / 24, 0, 1);
    ctx.globalAlpha = a;
    A.text(ctx, 'GAME OVER', VZ.W / 2, 62,
      { color: '#d05a58', align: 'center', scale: 3, shadow: '#12142e' });
    ctx.globalAlpha = 1;

    if (t > 30) {
      A.text(ctx, this.stageData ? this.stageData.name : '', VZ.W / 2, 94,
        { color: '#5f6f92', align: 'center' });
      A.text(ctx, 'SCORE  ' + this.pad(this.score, 7), VZ.W / 2, 108,
        { color: '#9fb6dd', align: 'center' });
      if (this.score >= this.save.highScore && this.score > 0) {
        A.text(ctx, 'NEW HI-SCORE', VZ.W / 2, 120, { color: '#ffd24a', align: 'center' });
      }
    }
    if (t > 60 && (t >> 4) % 2 === 0) {
      A.text(ctx, 'PRESS  Z', VZ.W / 2, VZ.H - 24, { color: '#ffffff', align: 'center' });
    }
  };

  var ENDING = [
    '', '', '',
    'THE CITADEL FALLS SILENT.',
    '',
    'VANGUARD PRIME WAS BUILT FROM',
    'YOUR OWN SCHEMATICS - THE LAST',
    'THING THE FOUNDRY EVER MADE',
    'BEFORE THE SKY BRIDGE BROKE.',
    '',
    'YOU CARRY THE CORE HOME.',
    '',
    'SOMEWHERE BELOW THE CLOUD SEA,',
    'THE LIGHTS COME BACK ON.',
    '',
    '',
    '- VANGUARD ZERO -',
    '',
    'DESIGN, CODE, ART AND MUSIC',
    'GENERATED IN A SINGLE SITTING.',
    '',
    '',
    'THANKS FOR PLAYING.',
    '', '', ''
  ];

  Game.prototype.drawEnding = function (ctx) {
    ctx.fillStyle = '#05070f'; ctx.fillRect(0, 0, VZ.W, VZ.H);
    // starfield
    var t = this.stateTime;
    for (var i = 0; i < 70; i++) {
      var sx = (i * 37 + t * (0.2 + (i % 5) * 0.08)) % VZ.W;
      var sy = (i * 53) % VZ.H;
      ctx.globalAlpha = 0.25 + (i % 4) * 0.2;
      ctx.fillStyle = '#9fd8ff';
      ctx.fillRect(VZ.W - sx, sy, 1, 1);
    }
    ctx.globalAlpha = 1;
    var y0 = VZ.H - this.endingScroll;
    for (var l = 0; l < ENDING.length; l++) {
      var y = y0 + l * 14;
      if (y < -12 || y > VZ.H) continue;
      var big = ENDING[l].indexOf('VANGUARD ZERO') >= 0;
      A.text(ctx, ENDING[l], VZ.W / 2, y,
        { color: big ? '#ffd24a' : '#cfd8ea', align: 'center', scale: big ? 2 : 1, shadow: '#12142e' });
    }
    A.text(ctx, 'FINAL SCORE ' + this.pad(this.score, 7), VZ.W / 2, VZ.H - 14,
      { color: '#5fe6d8', align: 'center' });
  };

  VZ.toggleFullscreen = function () {
    var el = document.documentElement;
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      } else {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      }
    } catch (e) { /* blocked outside a user gesture; nothing to do */ }
  };

  // ------------------------------------------------------------------ boot
  VZ.boot = function () {
    var canvas = document.getElementById('screen');
    S.init(canvas);
    VZ.audio.init();
    var g = VZ.game = new Game();
    // Browsers gate audio behind a gesture; resume on the first real input.
    var resume = function () { VZ.audio.resume(); };
    global.addEventListener('keydown', resume, { once: true });
    global.addEventListener('keydown', function (e) {
      if (e.code === 'KeyF') { VZ.toggleFullscreen(); e.preventDefault(); }
      if (e.code === 'KeyM') {
        var m = VZ.audio.toggleMute();
        g.message(m ? 'SOUND OFF' : 'SOUND ON', 70);
      }
    });
    global.addEventListener('pointerdown', resume, { once: true });
    g.start();
    VZ.audio.playSong(VZ.songs.title);
    var loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
  };

})(typeof window !== 'undefined' ? window : globalThis);
