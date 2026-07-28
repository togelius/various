/* VANGUARD ZERO - boss fights.
 *
 * Shared contract: every attack has a wind-up the player can read, a committed
 * phase they can punish, and a recovery. Phase changes are announced with a
 * flash + a short invulnerable beat so the pattern shift never feels cheap.
 */
(function (global) {
  'use strict';
  var VZ = global.VZ || (global.VZ = {});
  var T = VZ.TILE, M = VZ.math, A = VZ.art, FX = VZ.fx;
  var Entity = VZ.Entity, Projectile = VZ.Projectile, Player = VZ.Player;

  // ================================================================== BASE
  var Boss = VZ.Boss = function (game, x, y, w, h) {
    Entity.call(this, game, x, y, w, h);
    this.type = 'boss';
    this.team = 'enemy';
    this.isBoss = true;
    this.contactDamage = 4;
    this.phase = 1;
    this.state = 'intro';
    this.timer = 0;
    this.anim = 0;
    this.introTime = 110;
    this.invulnTime = 0;
    this.deathTimer = 0;
    this.dying = false;
    this.armour = 1;          // damage multiplier
    this.score = 3000;
  };
  Boss.prototype = Object.create(Entity.prototype);
  Boss.prototype.constructor = Boss;

  Boss.prototype.receive = function (proj) {
    if (this.dying || this.state === 'intro' || this.invulnTime > 0) {
      FX.sparks(proj.x, proj.y, proj.vx > 0 ? Math.PI : 0, '#cfd8ea');
      VZ.audio.sfx('deflect', { vol: 0.6 });
      return 'deflect';
    }
    this.hurtBy(Math.max(1, Math.round(proj.damage * this.armour)), proj.x);
    return 'hit';
  };

  Boss.prototype.hurtBy = function (amount, srcX) {
    this.hp -= amount;
    this.flash = 5;
    VZ.audio.sfx('hit', { vol: 0.9 });
    FX.stop(3);
    FX.sparks(srcX !== undefined ? M.lerp(srcX, this.x, 0.3) : this.x, this.y,
      srcX > this.x ? Math.PI : 0, '#ffe9a0');
    this.game.hud.bossHitFlash = 6;
    if (this.hp <= 0) { this.hp = 0; this.beginDeath(); return; }
    this.checkPhase();
  };

  Boss.prototype.checkPhase = function () {
    var frac = this.hp / this.maxHp;
    var want = frac <= 0.33 ? 3 : (frac <= 0.66 ? 2 : 1);
    if (want > this.phase && want <= this.maxPhase) {
      this.phase = want;
      this.onPhase(want);
      this.invulnTime = 46;
      this.state = 'phaseshift';
      this.timer = 46;
      FX.flash('#ffffff', 0.5);
      FX.shake(5);
      VZ.audio.sfx('bossAlarm');
      FX.popup(this.x, this.y - this.h / 2 - 12, 'PHASE ' + want, '#ff5a6e', { scale: 1, life: 70 });
    }
  };
  Boss.prototype.onPhase = function () {};
  Boss.prototype.maxPhase = 3;

  Boss.prototype.beginDeath = function () {
    if (this.dying) return;
    this.dying = true;
    this.deathTimer = 150;
    this.vx = 0; this.vy = 0;
    VZ.audio.stopSong();
    VZ.audio.sfx('bigExplode');
    this.game.onBossDying(this);
  };

  Boss.prototype.deathTick = function () {
    this.deathTimer--;
    if (this.deathTimer % 7 === 0) {
      var ex = this.x + VZ.rand.range(-this.w / 2, this.w / 2);
      var ey = this.y + VZ.rand.range(-this.h / 2, this.h / 2);
      FX.explosion(ex, ey, 1.1, '#ffd166');
      VZ.audio.sfx('explode', { vol: 0.8 });
      FX.shake(3);
    }
    if (this.deathTimer <= 0) {
      this.remove = true;
      FX.flash('#ffffff', 0.9, 0.94);
      FX.explosion(this.x, this.y, 3.2, '#fff2c8');
      FX.shake(9);
      VZ.audio.sfx('bigExplode');
      this.game.onBossDefeated(this);
    }
  };

  // Shared intro: hold still, flash, and let the HUD bar fill.
  Boss.prototype.introTick = function () {
    this.timer++;
    if (this.timer === 1) VZ.audio.sfx('bossAlarm');
    if (this.timer >= this.introTime) {
      this.state = 'idle';
      this.timer = 0;
      this.game.onBossReady(this);
    }
    return this.timer < this.introTime;
  };

  Boss.prototype.pickWeighted = function (list) {
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += list[i][1];
    var r = VZ.rand() * total;
    for (i = 0; i < list.length; i++) {
      r -= list[i][1];
      if (r <= 0) return list[i][0];
    }
    return list[0][0];
  };

  // =========================================================== AEGIS DRONE
  // Stage 1. Airborne, keeps its distance, punishes players who stand still.
  var AegisDrone = VZ.AegisDrone = function (game, x, y) {
    Boss.call(this, game, x, y, 40, 26);
    this.name = 'AEGIS DRONE';
    this.maxHp = 64; this.hp = this.maxHp;
    this.gravity = 0;
    // The player's muzzle sits ~11px above their feet, so a hovering boss is
    // only hittable if its box crosses the jump arc. This band is tuned so
    // standing shots miss but jump shots connect.
    this.homeY = game.arena.y1 - 72;
    this.y = this.homeY;
    this.targetX = x; this.targetY = this.homeY;
    this.podAngle = 0;
    this.coreOpen = 0;
    this.beamX = 0; this.beamDir = 1; this.beamOn = false;
    this.maxPhase = 2;
    this.reward = 'spread';
  };
  AegisDrone.prototype = Object.create(Boss.prototype);
  AegisDrone.prototype.constructor = AegisDrone;

  AegisDrone.prototype.onPhase = function () {
    this.armour = 1;
    this.coreOpen = 0;
    this.beamOn = false;
  };

  AegisDrone.prototype.update = function () {
    this.anim++;
    if (this.flash > 0) this.flash--;
    if (this.invulnTime > 0) this.invulnTime--;
    if (this.dying) { this.deathTick(); return; }
    if (this.state === 'intro') { if (this.introTick()) { this.y = this.homeY + Math.sin(this.anim * 0.05) * 4; return; } }

    var p = this.game.player;
    var arena = this.game.arena;
    this.podAngle += 0.08;

    switch (this.state) {
      case 'phaseshift':
        this.vx *= 0.9; this.vy = Math.sin(this.anim * 0.3) * 0.6;
        if (--this.timer <= 0) { this.state = 'idle'; this.timer = 20; }
        break;

      case 'vent': {
        // Cooling cycle after a beam sweep: drops low, core wide open, takes
        // double damage. This is the fight's main scoring window.
        this.timer++;
        this.coreOpen = 1;
        this.armour = 2;
        this.moveToward(this.x, arena.y1 - 20, 1.6);
        if (this.anim % 3 === 0) {
          FX.spawn({ x: this.x + VZ.rand.range(-16, 16), y: this.y + 10,
            vx: VZ.rand.range(-0.3, 0.3), vy: 0.8, g: 0, drag: 0.95, life: 14,
            size: 2, color: '#ffd166', glow: true });
        }
        if (this.timer > 78) {
          this.armour = 1; this.coreOpen = 0;
          this.state = 'idle'; this.timer = 16;
        }
        break;
      }

      case 'idle':
        this.hover(p, arena);
        if (--this.timer <= 0) {
          var opts = this.phase === 1
            ? [['strafe', 3], ['sweep', 2]]
            : [['strafe', 2], ['sweep', 2], ['missiles', 3], ['slam', 2]];
          this.state = this.pickWeighted(opts);
          this.timer = 0;
          this.subTimer = 0;
        }
        break;

      case 'strafe': {
        // Slide across the arena dropping cluster bombs.
        if (this.timer === 0) {
          this.targetX = this.x < (arena.x0 + arena.x1) / 2 ? arena.x1 - 46 : arena.x0 + 46;
          this.targetY = this.homeY + 6;
        }
        this.timer++;
        this.moveToward(this.targetX, this.targetY, this.phase === 1 ? 1.5 : 2.1);
        if (this.timer % (this.phase === 1 ? 34 : 24) === 0) {
          this.dropBomb();
        }
        if (Math.abs(this.x - this.targetX) < 8 || this.timer > 150) {
          this.state = 'idle'; this.timer = this.phase === 1 ? 44 : 26;
        }
        break;
      }

      case 'sweep': {
        this.timer++;
        var chargeT = 52;
        if (this.timer <= chargeT) {
          // rise and lock on, telegraphing with a thin red line
          this.moveToward(M.clamp(p ? p.x : this.x, arena.x0 + 40, arena.x1 - 40),
            arena.y0 + 34, 1.6);
          this.coreOpen = M.clamp((this.timer / chargeT) * 1.2, 0, 1);
          if (this.timer === 1) VZ.audio.sfx('charging');
          if (this.timer === chargeT) VZ.audio.sfx('laser');
        } else {
          this.coreOpen = 1;
          this.beamOn = true;
          var sweepLen = this.phase === 1 ? 96 : 76;
          if (this.timer === chargeT + 1) {
            this.beamDir = (this.x > (arena.x0 + arena.x1) / 2) ? -1 : 1;
            FX.shake(3);
          }
          this.vx = this.beamDir * ((arena.x1 - arena.x0 - 80) / sweepLen);
          this.x += this.vx;
          this.x = M.clamp(this.x, arena.x0 + 26, arena.x1 - 26);
          this.beamDamage();
          if (this.timer > chargeT + sweepLen) {
            this.beamOn = false;
            this.state = 'vent'; this.timer = 0;
            VZ.audio.sfx('door', { vol: 0.7 });
          }
        }
        break;
      }

      case 'missiles': {
        this.timer++;
        this.moveToward(p ? p.x : this.x, this.homeY + 10, 1.2);
        if (this.timer === 30 || this.timer === 44 || this.timer === 58) {
          var n = 3;
          for (var i = 0; i < n; i++) {
            var a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.5;
            var pr = new Projectile(this.game, this.x, this.y + 8,
              Math.cos(a) * 1.6, Math.sin(a) * 1.6, {
                team: 'enemy', damage: 3, w: 7, h: 7, color: '#ff8a4a',
                homing: 0.035, life: 200, gravity: 0.02
              });
            this.game.projectiles.push(pr);
          }
          VZ.audio.sfx('shoot', { vol: 0.8 });
          FX.sparks(this.x, this.y + 10, Math.PI / 2, '#ffb347');
        }
        if (this.timer > 86) { this.state = 'idle'; this.timer = 34; }
        break;
      }

      case 'slam': {
        this.timer++;
        if (this.timer < 34) {
          this.moveToward(p ? p.x : this.x, arena.y0 + 40, 2.2);
          if (this.timer === 33) VZ.audio.sfx('warn');
        } else if (this.timer < 40) {
          this.vy = 0;
        } else if (!this.slammed) {
          this.vy = 9;
          this.y += this.vy;
          if (this.lv.rectSolid(this.left(), this.bottom(), this.w, 4) ||
              this.bottom() > arena.y1 - 18) {
            this.slammed = true;
            this.timer = 0;
            VZ.audio.sfx('stomp');
            FX.shake(7); FX.stop(5);
            FX.ring(this.x, this.bottom(), { grow: 4, life: 20, color: '#ffd166', width: 3, squash: 0.35 });
            for (var s = -1; s <= 1; s += 2) {
              this.game.projectiles.push(new Projectile(this.game, this.x + s * 16, this.bottom() - 6,
                s * 2.6, 0, { team: 'enemy', damage: 3, w: 12, h: 12, color: '#ffd166', life: 120 }));
            }
          }
        } else {
          if (++this.timer > 40) {
            this.slammed = false;
            this.state = 'idle'; this.timer = 30;
          } else {
            this.vy = -2.2; this.y += this.vy;
          }
        }
        break;
      }
    }
    if (this.state !== 'sweep') this.beamOn = false;

    // Hard clamp: no attack pattern may carry it through the arena walls.
    this.x = M.clamp(this.x, arena.x0 + 26, arena.x1 - 26);
    this.y = M.clamp(this.y, arena.y0 + 18, arena.y1 - 20);
  };

  AegisDrone.prototype.hover = function (p, arena) {
    var tx = p ? p.x + M.sign(this.x - p.x) * 60 : this.x;
    this.targetX = M.clamp(tx, arena.x0 + 34, arena.x1 - 34);
    this.targetY = this.homeY + Math.sin(this.anim * 0.045) * 12;
    this.moveToward(this.targetX, this.targetY, 0.9);
  };

  AegisDrone.prototype.moveToward = function (tx, ty, speed) {
    var dx = tx - this.x, dy = ty - this.y;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    this.vx = M.approach(this.vx, (dx / d) * speed, 0.12);
    this.vy = M.approach(this.vy, (dy / d) * speed, 0.12);
    this.x += this.vx; this.y += this.vy;
  };

  AegisDrone.prototype.dropBomb = function () {
    var pr = new Projectile(this.game, this.x, this.y + 12, VZ.rand.range(-0.4, 0.4), 0.8, {
      team: 'enemy', damage: 3, w: 8, h: 8, color: '#ff5a6e', gravity: 0.16, life: 200
    });
    var game = this.game;
    pr.burst = function () {
      this.remove = true;
      FX.explosion(this.x, this.y, 0.8, '#ff8a4a');
      VZ.audio.sfx('explode', { vol: 0.6 });
      for (var i = 0; i < 3; i++) {
        var a = -Math.PI / 2 + (i - 1) * 0.72;
        game.projectiles.push(new Projectile(game, this.x, this.y - 3,
          Math.cos(a) * 2.4, Math.sin(a) * 2.4, {
            team: 'enemy', damage: 2, w: 6, h: 6, color: '#ffb347', gravity: 0.1, life: 90
          }));
      }
    };
    this.game.projectiles.push(pr);
    VZ.audio.sfx('shoot', { vol: 0.6 });
  };

  AegisDrone.prototype.beamDamage = function () {
    var p = this.game.player;
    if (!p || p.dead) return;
    var box = { x: this.x - 5, y: this.y + 10, w: 10, h: this.game.arena.y1 - this.y };
    if (VZ.aabb(box, p.box())) p.takeHit(3, this.x);
    if (this.anim % 2 === 0) {
      FX.spawn({ x: this.x + VZ.rand.range(-4, 4), y: this.y + VZ.rand.range(14, box.h),
        vx: 0, vy: 1.4, g: 0, drag: 1, life: 10, size: 2, color: '#ffe9a0', glow: true });
    }
  };

  AegisDrone.prototype.draw = function (ctx, camX, camY) {
    var x = Math.round(this.x - camX), y = Math.round(this.y - camY);
    var w = this.flash > 0;
    var hull = w ? '#ffffff' : '#5d6b90';
    var hullD = w ? '#ffffff' : '#333c56';
    var hullL = w ? '#ffffff' : '#8fa3c4';
    var edge = w ? '#ffffff' : '#c3d3ef';
    var trim = w ? '#ffffff' : '#ffd24a';

    // ---- beam / telegraph (behind the hull) ------------------------------
    if (this.beamOn) {
      var bh = this.game.arena.y1 - this.y;
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#ff8a4a';
      ctx.fillRect(x - 11, y + 10, 22, bh);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(x - 7, y + 10, 14, bh);
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#fff6d8';
      ctx.fillRect(x - 3 + Math.round(Math.sin(this.anim * 0.9)), y + 10, 6, bh);
      ctx.globalAlpha = 1;
      // scorch pool where it meets the floor
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.ellipse(x, this.game.arena.y1 - camY, 16, 4, 0, 0, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (this.state === 'sweep') {
      ctx.globalAlpha = 0.22 + Math.sin(this.anim * 0.55) * 0.18;
      ctx.strokeStyle = '#ff3d3d'; ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x, y + 12); ctx.lineTo(x, this.game.arena.y1 - camY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // ---- swept fins ------------------------------------------------------
    for (var s = -1; s <= 1; s += 2) {
      ctx.fillStyle = hullD;
      ctx.beginPath();
      ctx.moveTo(x + s * 14, y - 8);
      ctx.lineTo(x + s * 30, y - 2);
      ctx.lineTo(x + s * 30, y + 5);
      ctx.lineTo(x + s * 14, y + 6);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = hullL;
      ctx.fillRect(x + s * 30 - (s > 0 ? 3 : 0), y - 2, 3, 7);
      // pod + thruster
      var py = y + Math.sin(this.podAngle + s) * 1.5;
      ctx.fillStyle = hull;
      ctx.fillRect(x + s * 22 - 5, py - 9, 10, 15);
      ctx.fillStyle = edge;
      ctx.fillRect(x + s * 22 - 5, py - 9, 10, 2);
      ctx.fillStyle = trim;
      ctx.fillRect(x + s * 22 - 3, py - 5, 6, 2);
      ctx.fillStyle = hullD;
      ctx.fillRect(x + s * 22 - 4, py + 2, 8, 4);
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#5fe6d8';
      var fl = 3 + Math.abs(Math.sin(this.anim * 0.35 + s)) * 4;
      ctx.fillRect(x + s * 22 - 2, py + 6, 4, fl);
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x + s * 22 - 3, py + 6, 6, fl * 0.6);
      ctx.globalAlpha = 1;
    }

    // ---- main hull: a flattened hexagon with a heavy chin ----------------
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(x - 20, y - 4); ctx.lineTo(x - 12, y - 13); ctx.lineTo(x + 12, y - 13);
    ctx.lineTo(x + 20, y - 4); ctx.lineTo(x + 15, y + 12); ctx.lineTo(x - 15, y + 12);
    ctx.closePath(); ctx.fill();
    // top highlight and lower shadow give it volume
    ctx.fillStyle = edge;
    ctx.fillRect(x - 12, y - 13, 24, 2);
    ctx.fillStyle = hullL;
    ctx.beginPath();
    ctx.moveTo(x - 20, y - 4); ctx.lineTo(x - 12, y - 11); ctx.lineTo(x - 9, y - 11);
    ctx.lineTo(x - 17, y - 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = hullD;
    ctx.fillRect(x - 15, y + 6, 30, 6);
    // vent slats along the chin
    ctx.fillStyle = w ? '#fff' : '#1e2436';
    for (var i = -2; i <= 2; i++) ctx.fillRect(x + i * 6 - 2, y + 7, 4, 4);
    // shoulder trim
    ctx.fillStyle = trim;
    ctx.fillRect(x - 19, y - 3, 5, 2);
    ctx.fillRect(x + 14, y - 3, 5, 2);

    // ---- core housing + eye ---------------------------------------------
    var open = this.coreOpen;
    ctx.fillStyle = hullD;
    ctx.beginPath(); ctx.arc(x, y - 1, 11, 0, 7); ctx.fill();
    ctx.fillStyle = w ? '#fff' : '#141a2a';
    ctx.beginPath(); ctx.arc(x, y - 1, 9, 0, 7); ctx.fill();

    var core = w ? '#ffffff'
      : (open > 0.4 ? (this.anim % 8 < 4 ? '#fff2c8' : '#ff8a4a') : '#5fe6d8');
    var cr = 4 + open * 4;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(x, y - 1, cr + 4, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(x, y - 1, cr, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x - 1.5, y - 2.5, Math.max(1, cr * 0.35), 0, 7); ctx.fill();
    // iris shutters close over the core when it is not charging
    if (open < 0.5) {
      ctx.fillStyle = hullD;
      ctx.fillRect(x - 9, y - 2, 18, 1);
    }

    // running lights
    ctx.globalAlpha = this.anim % 40 < 20 ? 0.9 : 0.25;
    ctx.fillStyle = '#ff5a6e';
    ctx.fillRect(x - 11, y - 11, 2, 2);
    ctx.fillRect(x + 9, y - 11, 2, 2);
    ctx.globalAlpha = 1;
  };

  // =========================================================== FORGE GOLEM
  // Stage 2. Heavy ground bruiser; the punish window is its post-charge stun.
  var ForgeGolem = VZ.ForgeGolem = function (game, x, y) {
    Boss.call(this, game, x, y, 36, 40);
    this.name = 'FORGE GOLEM';
    this.maxHp = 82; this.hp = this.maxHp;
    this.gravity = 0.5;
    this.armFrame = 0;
    this.stun = 0;
    this.armour = 0.7;         // heavily plated until stunned
    this.maxPhase = 2;
    this.facing = -1;
    this.reward = 'lance';
    this.eye = 0;
  };
  ForgeGolem.prototype = Object.create(Boss.prototype);
  ForgeGolem.prototype.constructor = ForgeGolem;

  ForgeGolem.prototype.onPhase = function () { this.armour = 0.85; };

  ForgeGolem.prototype.update = function () {
    this.anim++;
    if (this.flash > 0) this.flash--;
    if (this.invulnTime > 0) this.invulnTime--;
    if (this.dying) { this.deathTick(); return; }
    if (this.state === 'intro') {
      this.applyGravity(); if (this.moveY(this.vy)) this.vy = 0;
      this.grounded = this.checkGround();
      if (this.introTick()) return;
    }

    var p = this.game.player, arena = this.game.arena;
    if (p && this.state !== 'charge' && this.stun <= 0) {
      var f = M.sign(p.x - this.x);
      if (f) this.facing = f;
    }
    this.armour = this.stun > 0 ? 2.0 : (this.phase === 1 ? 0.7 : 0.85);

    if (this.stun > 0) {
      this.stun--;
      this.vx *= 0.8;
      if (this.anim % 5 === 0) {
        FX.spawn({ x: this.x + VZ.rand.range(-16, 16), y: this.top() + VZ.rand.range(0, 10),
          vx: VZ.rand.range(-0.5, 0.5), vy: -0.8, g: 0.02, drag: 0.95, life: 20, size: 2,
          color: '#ffd166', glow: true });
      }
      if (this.stun === 0) { this.state = 'idle'; this.timer = 20; }
    } else {
      switch (this.state) {
        case 'phaseshift':
          this.vx *= 0.8;
          if (--this.timer <= 0) { this.state = 'idle'; this.timer = 24; }
          break;

        case 'idle':
          this.vx = M.approach(this.vx, this.facing * 0.35, 0.05);
          if (--this.timer <= 0) {
            var opts = this.phase === 1
              ? [['stomp', 3], ['charge', 3], ['wave', 3]]
              : [['stomp', 3], ['charge', 4], ['wave', 3], ['ring', 3]];
            this.state = this.pickWeighted(opts);
            this.timer = 0;
          }
          break;

        case 'stomp':
          this.timer++;
          if (this.timer < 26) { this.vx *= 0.8; this.crouch = 1; }
          else if (this.timer === 26) {
            this.vy = -8.2;
            this.vx = M.sign(p ? p.x - this.x : 1) * 1.6;
            this.crouch = 0;
            VZ.audio.sfx('jump', { vol: 1.2 });
          } else if (this.timer > 26 && this.grounded && this.vy >= 0 && this.timer > 34) {
            this.groundPound();
            this.state = 'idle'; this.timer = 34;
          }
          break;

        case 'charge':
          this.timer++;
          if (this.timer < 34) {
            this.vx *= 0.75;
            if (this.timer % 6 === 0) {
              FX.spawn({ x: this.x + this.facing * 20, y: this.y + VZ.rand.range(-8, 12),
                vx: this.facing * 1.4, vy: 0, g: 0, drag: 1, life: 12, size: 2, color: '#ff7a1a' });
            }
            if (this.timer === 33) VZ.audio.sfx('warn');
          } else {
            this.vx = this.facing * (this.phase === 1 ? 4.2 : 5.2);
            if (this.anim % 3 === 0) FX.dust(this.x, this.bottom() - 1, -this.facing);
            var blocked = this.lv.rectSolid(this.x + this.facing * 22, this.top() + 4, 2, this.h - 8);
            var edge = this.facing > 0 ? this.right() > arena.x1 - 4 : this.left() < arena.x0 + 4;
            if (blocked || edge || this.timer > 34 + 90) {
              this.stun = 100;
              this.vx = 0;
              VZ.audio.sfx('stomp');
              FX.shake(8); FX.stop(6);
              FX.explosion(this.x + this.facing * 18, this.y, 1.4, '#ffb347');
              FX.popup(this.x, this.top() - 10, 'STUNNED', '#ffd24a', { life: 60 });
              this.dropDebris(4);
            }
          }
          break;

        case 'wave':
          this.timer++;
          if (this.timer < 30) { this.vx *= 0.8; }
          else if (this.timer === 30) {
            VZ.audio.sfx('stomp', { vol: 0.9 });
            FX.shake(4);
            for (var s = -1; s <= 1; s += 2) {
              this.spawnWave(s);
            }
          } else if (this.timer > 60) { this.state = 'idle'; this.timer = 26; }
          break;

        case 'ring':
          this.timer++;
          if (this.timer < 34) this.vx *= 0.85;
          else if (this.timer === 34) {
            var n = 9;
            for (var i = 0; i < n; i++) {
              var a = -Math.PI + (i / (n - 1)) * Math.PI;
              this.game.projectiles.push(new Projectile(this.game, this.x, this.y - 6,
                Math.cos(a) * 2.5, Math.sin(a) * 2.5, {
                  team: 'enemy', damage: 3, w: 8, h: 8, color: '#ff7a1a',
                  gravity: 0.07, life: 160
                }));
            }
            VZ.audio.sfx('explode', { vol: 0.9 });
            FX.ring(this.x, this.y - 6, { grow: 3.4, life: 16, color: '#ffd166', width: 2 });
          } else if (this.timer > 70) { this.state = 'idle'; this.timer = 30; }
          break;
      }
    }

    this.applyGravity();
    if (this.moveX(this.vx)) {
      if (this.state === 'charge' && this.timer > 34) { /* handled above */ }
      this.vx = 0;
    }
    if (this.moveY(this.vy)) this.vy = 0;
    var wasG = this.grounded;
    this.grounded = this.checkGround();
    if (this.grounded && !wasG && this.state === 'stomp') {
      this.groundPound();
      this.state = 'idle'; this.timer = 34;
    }
    this.eye = M.lerp(this.eye, this.stun > 0 ? 0 : 1, 0.1);
  };

  ForgeGolem.prototype.groundPound = function () {
    VZ.audio.sfx('stomp');
    FX.shake(8); FX.stop(5);
    FX.ring(this.x, this.bottom(), { grow: 4.5, life: 20, color: '#ffd166', width: 3, squash: 0.3 });
    FX.burst(this.x, this.bottom(), 14, {
      speed: 2.6, life: 22, size: 3, color: '#8a5a48', angle: -Math.PI / 2, spread: 2.6, g: 0.25
    });
    for (var s = -1; s <= 1; s += 2) {
      this.game.projectiles.push(new Projectile(this.game, this.x + s * 20, this.bottom() - 8,
        s * 2.8, 0, { team: 'enemy', damage: 3, w: 14, h: 14, color: '#ffb347', life: 100 }));
    }
    this.dropDebris(this.phase === 1 ? 3 : 5);
  };

  ForgeGolem.prototype.dropDebris = function (n) {
    var arena = this.game.arena;
    for (var i = 0; i < n; i++) {
      var dx = VZ.rand.range(arena.x0 + 20, arena.x1 - 20);
      var pr = new Projectile(this.game, dx, arena.y0 + 6, 0, 0.5, {
        team: 'enemy', damage: 3, w: 10, h: 10, color: '#8a5a48', gravity: 0.22, life: 220
      });
      pr.warn = 34;
      this.game.projectiles.push(pr);
    }
  };

  ForgeGolem.prototype.spawnWave = function (dir) {
    var game = this.game, bx = this.x, by = this.bottom();
    for (var i = 1; i <= 6; i++) {
      (function (i) {
        setTimeout(function () {
          if (game.state !== 'play') return;
          var sx = bx + dir * i * 26;
          game.projectiles.push(new Projectile(game, sx, by - 8, 0, -2.6, {
            team: 'enemy', damage: 3, w: 10, h: 18, color: '#ff7a1a',
            gravity: 0.24, life: 70
          }));
          FX.burst(sx, by, 6, { speed: 1.6, life: 14, size: 2, color: '#ffd166',
            angle: -Math.PI / 2, spread: 1.2, glow: true });
        }, i * 85);
      })(i);
    }
  };

  ForgeGolem.prototype.draw = function (ctx, camX, camY) {
    var x = Math.round(this.x - camX), y = Math.round(this.bottom() - camY);
    var w = this.flash > 0;
    var dark = w ? '#fff' : '#33231f';
    var mid = w ? '#fff' : '#6d4a3c';
    var light = w ? '#fff' : '#a27054';
    var edge = w ? '#fff' : '#c99070';
    var hot = w ? '#fff' : (this.stun > 0 ? '#4a2f26' : '#ff7a1a');
    var crouch = (this.state === 'stomp' && this.timer < 26) ? 5 : 0;
    var lean = (this.state === 'charge' && this.timer > 34) ? this.facing * 3 : 0;
    var sway = this.stun > 0 ? Math.sin(this.anim * 0.22) * 2 : 0;

    // ---- legs: heavy piston columns with splayed feet --------------------
    for (var s = -1; s <= 1; s += 2) {
      var lx = x + s * 11;
      ctx.fillStyle = dark;
      ctx.fillRect(lx - 6, y - 17 + crouch, 12, 17 - crouch);
      ctx.fillStyle = mid;
      ctx.fillRect(lx - 6, y - 17 + crouch, 12, 5);
      ctx.fillStyle = light;
      ctx.fillRect(lx - 5, y - 16 + crouch, 3, 3);
      // piston rod
      ctx.fillStyle = w ? '#fff' : '#8e8b93';
      ctx.fillRect(lx - 2, y - 22 + crouch, 4, 6);
      // foot
      ctx.fillStyle = dark;
      ctx.fillRect(lx - 9, y - 4, 18, 4);
      ctx.fillStyle = mid;
      ctx.fillRect(lx - 9, y - 4, 18, 1);
    }

    var ty = y - 43 + crouch;   // torso top

    // ---- arms behind the torso ------------------------------------------
    var swing = (this.state === 'charge' && this.timer > 34) ? 9
      : (this.state === 'wave' && this.timer > 30 ? -5 : 0);
    for (var a = -1; a <= 1; a += 2) {
      var lead = (a === this.facing);
      var ax = x + a * 22 + (lead ? a * swing : 0) + lean;
      ctx.fillStyle = mid;
      ctx.fillRect(ax - 6, ty + 7, 12, 18);
      ctx.fillStyle = light;
      ctx.fillRect(ax - 6, ty + 7, 12, 4);
      ctx.fillStyle = dark;
      ctx.fillRect(ax - 8, ty + 24, 16, 12);          // fist
      ctx.fillStyle = mid;
      ctx.fillRect(ax - 8, ty + 24, 16, 3);
      ctx.fillStyle = w ? '#fff' : '#8e8b93';          // knuckle plates
      ctx.fillRect(ax - 6, ty + 28, 4, 4);
      ctx.fillRect(ax + 2, ty + 28, 4, 4);
    }

    // ---- torso -----------------------------------------------------------
    ctx.fillStyle = mid;
    ctx.fillRect(x - 18 + lean, ty + 4, 36, 26);
    ctx.fillStyle = light;
    ctx.fillRect(x - 18 + lean, ty + 4, 36, 5);
    ctx.fillStyle = edge;
    ctx.fillRect(x - 18 + lean, ty + 4, 36, 1);
    ctx.fillStyle = dark;
    ctx.fillRect(x - 18 + lean, ty + 26, 36, 4);
    // chest plating seams
    ctx.fillStyle = dark;
    ctx.fillRect(x - 18 + lean, ty + 13, 36, 1);

    // ---- furnace core ----------------------------------------------------
    var glow = this.stun > 0 ? 0.25 : (0.68 + Math.sin(this.anim * 0.14) * 0.32);
    ctx.fillStyle = '#1d120f';
    ctx.fillRect(x - 9 + lean, ty + 10, 18, 15);
    ctx.globalAlpha = glow;
    ctx.fillStyle = hot;
    ctx.fillRect(x - 7 + lean, ty + 12, 14, 11);
    ctx.globalAlpha = Math.min(1, glow * 0.7);
    ctx.fillStyle = '#ffe9a0';
    ctx.fillRect(x - 4 + lean, ty + 15, 8, 5);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1d120f';                          // grate bars
    for (var b = -1; b <= 1; b++) ctx.fillRect(x + b * 6 - 1 + lean, ty + 10, 2, 15);

    // ---- shoulders -------------------------------------------------------
    for (var sh = -1; sh <= 1; sh += 2) {
      ctx.fillStyle = light;
      ctx.fillRect(x + sh * 22 - 8 + lean, ty + 1, 16, 9);
      ctx.fillStyle = edge;
      ctx.fillRect(x + sh * 22 - 8 + lean, ty + 1, 16, 2);
      ctx.fillStyle = '#1d120f';
      ctx.fillRect(x + sh * 22 - 5 + lean, ty + 5, 10, 3);
      if (this.stun <= 0 && this.anim % 44 < 22) {
        ctx.globalAlpha = 0.55; ctx.fillStyle = '#ff7a1a';
        ctx.fillRect(x + sh * 22 - 5 + lean, ty + 1, 10, 4);
        ctx.globalAlpha = 1;
      }
    }

    // ---- head ------------------------------------------------------------
    var hx = x + lean + sway + this.facing * 2;
    ctx.fillStyle = dark;
    ctx.fillRect(hx - 11, ty - 12, 22, 16);
    ctx.fillStyle = mid;
    ctx.fillRect(hx - 10, ty - 11, 20, 5);
    ctx.fillStyle = edge;
    ctx.fillRect(hx - 10, ty - 12, 20, 1);
    // brow
    ctx.fillStyle = '#1d120f';
    ctx.fillRect(hx - 9, ty - 6, 18, 6);
    ctx.fillStyle = w ? '#fff' : (this.stun > 0 ? '#5a3a30' : '#ff3d3d');
    ctx.fillRect(hx - 7, ty - 5, 6, 4);
    ctx.fillRect(hx + 1, ty - 5, 6, 4);
    if (this.stun <= 0) {
      ctx.globalAlpha = 0.4 + Math.sin(this.anim * 0.2) * 0.25;
      ctx.fillStyle = '#ff8a5f';
      ctx.fillRect(hx - 8, ty - 6, 8, 6);
      ctx.fillRect(hx, ty - 6, 8, 6);
      ctx.globalAlpha = 1;
    }
    // exhaust stacks
    ctx.fillStyle = '#1d120f';
    ctx.fillRect(hx - 13, ty - 18, 5, 8);
    ctx.fillRect(hx + 8, ty - 18, 5, 8);
    if (this.stun <= 0 && this.anim % 6 < 3) {
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#8a6a58';
      ctx.fillRect(hx - 13, ty - 24, 5, 6);
      ctx.fillRect(hx + 8, ty - 24, 5, 6);
      ctx.globalAlpha = 1;
    }

    // stun stars
    if (this.stun > 0) {
      for (var st2 = 0; st2 < 3; st2++) {
        var a2 = this.anim * 0.11 + st2 * 2.1;
        ctx.fillStyle = '#ffd24a';
        ctx.fillRect(Math.round(hx + Math.cos(a2) * 14) - 1,
                     Math.round(ty - 20 + Math.sin(a2) * 4) - 1, 3, 3);
      }
    }

    // charge telegraph beam
    if (this.state === 'charge' && this.timer < 34) {
      ctx.globalAlpha = 0.22 + Math.sin(this.anim * 0.6) * 0.16;
      ctx.fillStyle = '#ff3d3d';
      ctx.fillRect(this.facing > 0 ? x + 24 : x - 224, y - 30, 200, 26);
      ctx.globalAlpha = 1;
    }
  };

  // ========================================================= VANGUARD PRIME
  // Stage 3. Uses the player's own kit against them.
  var VanguardPrime = VZ.VanguardPrime = function (game, x, y) {
    Player.call(this, game, x, y);
    this.type = 'boss';
    this.team = 'enemy';
    this.isBoss = true;
    this.name = 'VANGUARD PRIME';
    this.prefix = 'rv_';
    this.maxHp = 76; this.hp = this.maxHp;
    this.contactDamage = 3;
    this.phase = 1; this.maxPhase = 3;
    this.state = 'intro';
    this.timer = 0; this.anim = 0;
    this.introTime = 120;
    this.invulnTime = 0;
    this.dying = false; this.deathTimer = 0;
    this.armour = 1;
    this.score = 5000;
    this.spawnTimer = 0;
    this.invuln = 0;
    this.actionCool = 0;
    this.blades = [];
    this.teleporting = 0;
    this.reward = null;
  };
  VanguardPrime.prototype = Object.create(Player.prototype);
  VanguardPrime.prototype.constructor = VanguardPrime;

  // Reuse the boss damage/phase/death machinery.
  VanguardPrime.prototype.receive = Boss.prototype.receive;
  VanguardPrime.prototype.hurtBy = Boss.prototype.hurtBy;
  VanguardPrime.prototype.checkPhase = Boss.prototype.checkPhase;
  VanguardPrime.prototype.beginDeath = Boss.prototype.beginDeath;
  VanguardPrime.prototype.deathTick = Boss.prototype.deathTick;
  VanguardPrime.prototype.introTick = Boss.prototype.introTick;
  VanguardPrime.prototype.pickWeighted = Boss.prototype.pickWeighted;
  VanguardPrime.prototype.takeHit = function () {};   // only projectiles hurt it

  VanguardPrime.prototype.onPhase = function (n) {
    if (n === 3) {
      FX.popup(this.x, this.y - 26, 'NO MORE HOLDING BACK', '#ff5a6e', { life: 90 });
    }
  };

  VanguardPrime.prototype.update = function () {
    this.anim++;
    this.animTime++;
    if (this.flash > 0) this.flash--;
    if (this.invulnTime > 0) this.invulnTime--;
    if (this.shootTimer > 0) this.shootTimer--;
    if (this.dying) { this.deathTick(); return; }
    if (this.state === 'intro') {
      this.applyGravity();
      if (this.moveY(this.vy)) this.vy = 0;
      this.grounded = this.checkGround();
      if (this.introTick()) return;
      this.state = 'idle'; this.timer = 20;
    }

    var p = this.game.player, arena = this.game.arena;
    if (!p) return;

    if (this.teleporting > 0) {
      this.teleporting--;
      if (this.teleporting === 12) {
        // reappear beside the player
        var side = p.x > (arena.x0 + arena.x1) / 2 ? -1 : 1;
        this.x = M.clamp(p.x + side * 60, arena.x0 + 20, arena.x1 - 20);
        this.y = p.y - 6;
        this.facing = -side;
        FX.burst(this.x, this.y, 14, { speed: 2.4, life: 18, size: 2, color: '#ff5a6e', glow: true });
        VZ.audio.sfx('dash', { vol: 1.1 });
      }
      this.vx = 0; this.vy = 0;
      return;
    }

    // face the player unless committed to a dash
    if (this.dashTime <= 0 && this.state !== 'dashAttack') {
      var f = M.sign(p.x - this.x);
      if (f) this.facing = f;
    }

    if (this.actionCool > 0) this.actionCool--;

    switch (this.state) {
      case 'phaseshift':
        this.vx *= 0.8;
        if (--this.timer <= 0) { this.state = 'idle'; this.timer = 16; }
        break;

      case 'idle': {
        // Keep a fighting distance, then commit to something.
        var dx = p.x - this.x, adx = Math.abs(dx);
        var want = adx < 46 ? -M.sign(dx) * 1.1 : (adx > 110 ? M.sign(dx) * 1.2 : 0);
        this.vx = M.approach(this.vx, want, 0.3);
        if (--this.timer <= 0) {
          var opts = [['shots', 3], ['dashAttack', 3], ['leap', 2]];
          if (this.phase >= 2) opts.push(['charged', 3], ['tripleDash', 3]);
          if (this.phase >= 3) { opts.push(['blades', 4]); opts.push(['teleSlash', 4]); }
          this.state = this.pickWeighted(opts);
          this.timer = 0;
        }
        break;
      }

      case 'shots': {
        this.timer++;
        this.vx *= 0.85;
        var every = this.phase >= 2 ? 9 : 13;
        if (this.timer % every === 0 && this.timer <= every * 3) {
          this.fireAt(p, 5.0, 2);
        }
        if (this.timer > every * 3 + 18) { this.state = 'idle'; this.timer = this.phase >= 2 ? 16 : 28; }
        break;
      }

      case 'charged': {
        this.timer++;
        this.vx *= 0.85;
        this.chargeLevel = this.timer > 20 ? 2 : 1;
        if (this.timer === 54) {
          this.chargeLevel = 0;
          var pr = new Projectile(this.game, this.x + this.facing * 12, this.y - 1,
            this.facing * 4.4, 0, {
              team: 'enemy', damage: 4, w: 16, h: 14, color: '#ff5a6e', pierce: 9, life: 200
            });
          this.game.projectiles.push(pr);
          VZ.audio.sfx('chargeShot');
          FX.shake(2.4);
          this.vx = -this.facing * 1.4;
        }
        if (this.timer > 74) { this.chargeLevel = 0; this.state = 'idle'; this.timer = 22; }
        break;
      }

      case 'dashAttack': {
        this.timer++;
        if (this.timer < 18) { this.vx *= 0.8; }
        else if (this.timer === 18) {
          this.dashTime = 22;
          VZ.audio.sfx('dash');
        }
        if (this.dashTime > 0) {
          this.dashTime--;
          this.vx = this.facing * 4.6;
          if (this.anim % 3 === 0) {
            this.dashGhosts.push({ x: this.x, y: this.y, f: this.facing, life: 10 });
          }
        } else if (this.timer > 18) {
          this.vx *= 0.86;
          if (this.timer > 52) { this.state = 'idle'; this.timer = 18; }
        }
        break;
      }

      case 'tripleDash': {
        this.timer++;
        var slot = Math.floor(this.timer / 26);
        var ph = this.timer % 26;
        if (slot < 3) {
          if (ph === 0) {
            var fdir = M.sign(p.x - this.x) || this.facing;
            this.facing = fdir;
            this.dashTime = 18;
            VZ.audio.sfx('dash', { vol: 0.9 });
          }
          if (this.dashTime > 0) {
            this.dashTime--;
            this.vx = this.facing * 5.0;
            if (this.anim % 2 === 0) this.dashGhosts.push({ x: this.x, y: this.y, f: this.facing, life: 10 });
          } else this.vx *= 0.85;
        } else { this.state = 'idle'; this.timer = 20; }
        break;
      }

      case 'leap': {
        this.timer++;
        if (this.timer < 16) this.vx *= 0.8;
        else if (this.timer === 16) {
          this.vy = -7.4;
          this.vx = M.sign(p.x - this.x) * 2.2;
          VZ.audio.sfx('jump');
        } else if (this.timer > 16) {
          if (this.timer === 34 || this.timer === 42) this.fireAt(p, 4.6, 2);
          if (this.grounded && this.timer > 30) { this.state = 'idle'; this.timer = 18; }
        }
        if (this.timer > 130) { this.state = 'idle'; this.timer = 18; }
        break;
      }

      case 'blades': {
        this.timer++;
        this.vx *= 0.85;
        if (this.timer === 26 || this.timer === 46 || this.timer === 66) {
          // Ground-hugging energy waves in both directions.
          for (var s = -1; s <= 1; s += 2) {
            this.game.projectiles.push(new Projectile(this.game, this.x + s * 10, this.bottom() - 8,
              s * 3.0, 0, {
                team: 'enemy', damage: 3, w: 8, h: 18, color: '#9dff5f', life: 130
              }));
          }
          VZ.audio.sfx('laser', { vol: 0.8 });
          FX.shake(2);
        }
        if (this.timer > 92) { this.state = 'idle'; this.timer = 16; }
        break;
      }

      case 'teleSlash': {
        this.timer++;
        if (this.timer === 1) {
          FX.burst(this.x, this.y, 16, { speed: 2.6, life: 18, size: 2, color: '#ff5a6e', glow: true });
          VZ.audio.sfx('warn');
          this.teleporting = 26;
        } else if (this.timer > 30 && this.timer < 34) {
          this.dashTime = 20;
          this.vx = this.facing * 5.4;
          VZ.audio.sfx('dash', { vol: 1.2 });
        } else if (this.dashTime > 0) {
          this.dashTime--;
          this.vx = this.facing * 5.4;
          if (this.anim % 2 === 0) this.dashGhosts.push({ x: this.x, y: this.y, f: this.facing, life: 12 });
        } else if (this.timer > 40) { this.state = 'idle'; this.timer = 14; }
        break;
      }
    }

    // physics
    if (this.dashTime > 0) this.vy = Math.min(this.vy, 0.6);
    this.applyGravity(this.dashTime > 0 ? 0.2 : 1);
    if (this.moveX(this.vx)) {
      this.vx = 0;
      if (this.dashTime > 0) this.dashTime = 0;
      // bounce off the arena walls with a wall jump, like the player would
      if (!this.grounded && this.phase >= 2) {
        this.vy = -6.2; this.vx = -this.facing * 3.0; this.facing = -this.facing;
        VZ.audio.sfx('wall');
      }
    }
    if (this.moveY(this.vy)) this.vy = 0;
    this.grounded = this.checkGround();
    if (this.grounded && Math.abs(this.vx) > 0.4) {
      this.runFrame += Math.abs(this.vx) * 0.115;
      if (this.runFrame >= 6) this.runFrame -= 6;
    } else this.runFrame = 0;
    this.sliding = false;
    for (var i = this.dashGhosts.length - 1; i >= 0; i--) {
      if (--this.dashGhosts[i].life <= 0) this.dashGhosts.splice(i, 1);
    }
  };

  VanguardPrime.prototype.fireAt = function (p, speed, dmg) {
    var m = { x: this.x + this.facing * 12, y: this.y - 1 };
    var a = Math.atan2(p.y - m.y, p.x - m.x);
    // Only aim within a cone in front so shots stay readable.
    var base = this.facing > 0 ? 0 : Math.PI;
    var d = M.clamp(M.wrapPi(a - base), -0.55, 0.55);
    a = base + d;
    this.game.projectiles.push(new Projectile(this.game, m.x, m.y,
      Math.cos(a) * speed, Math.sin(a) * speed, {
        team: 'enemy', damage: dmg, w: 7, h: 5, color: '#ff8a5f', life: 180
      }));
    this.shootTimer = 12;
    VZ.audio.sfx('shoot', { vol: 0.7 });
    FX.sparks(m.x, m.y, a, '#ffb0a0');
  };

  VanguardPrime.prototype.pose = function () {
    if (this.dashTime > 0) return { t: 'torso_dash', l: 'legs_dash' };
    if (this.state === 'charged') return { t: 'torso_run', l: 'legs_idle' };
    if (!this.grounded) return { t: 'torso_air', l: this.vy < 0 ? 'legs_jump' : 'legs_fall' };
    if (Math.abs(this.vx) > 0.4) return { t: 'torso_run', l: 'legs_run' + (Math.floor(this.runFrame) % 6) };
    return { t: 'torso_idle', l: 'legs_idle', idle: true };
  };

  VanguardPrime.prototype.draw = function (ctx, camX, camY) {
    if (this.teleporting > 0) {
      // dissolve/reform
      var t = this.teleporting > 12 ? (this.teleporting - 12) / 14 : this.teleporting / 12;
      ctx.globalAlpha = 1 - t;
      Player.prototype.draw.call(this, ctx, camX, camY);
      ctx.globalAlpha = 1;
      return;
    }
    if (this.state === 'intro') {
      ctx.globalAlpha = Math.min(1, this.timer / 40);
    }
    Player.prototype.draw.call(this, ctx, camX, camY);
    ctx.globalAlpha = 1;
  };

  VZ.BOSS_FACTORY = {
    aegis: function (g, x, y) { return new AegisDrone(g, x, y); },
    golem: function (g, x, y) { return new ForgeGolem(g, x, y); },
    prime: function (g, x, y) { return new VanguardPrime(g, x, y); }
  };

})(typeof window !== 'undefined' ? window : globalThis);
