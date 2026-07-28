/* VANGUARD ZERO - enemy roster.
 *
 * Every grunt telegraphs before it commits to something dangerous, and each
 * one answers a different question: troopers punish standing still, hoppers
 * punish standing under them, shielders punish shooting without thinking,
 * turrets punish crossing open ground.
 */
(function (global) {
  'use strict';
  var VZ = global.VZ || (global.VZ = {});
  var T = VZ.TILE, M = VZ.math, A = VZ.art, FX = VZ.fx, TL = VZ.tiles;
  var Entity = VZ.Entity, Projectile = VZ.Projectile;

  // ================================================================== BASE
  var Enemy = VZ.Enemy = function (game, x, y, w, h) {
    Entity.call(this, game, x, y, w, h);
    this.type = 'enemy';
    this.team = 'enemy';
    this.contactDamage = 2;
    this.score = 100;
    this.dropChance = 0.28;
    this.hitFrom = 'any';       // 'any' | 'back' - which side can be damaged
    this.deathScale = 1;
    this.deathColor = '#ffb347';
    this.anim = VZ.rand.int(0, 60);
    this.active = true;
  };
  Enemy.prototype = Object.create(Entity.prototype);
  Enemy.prototype.constructor = Enemy;

  Enemy.prototype.player = function () { return this.game.player; };

  Enemy.prototype.distToPlayer = function () {
    var p = this.game.player;
    return p ? M.dist(this.x, this.y, p.x, p.y) : 1e9;
  };

  // Returns 'hit' | 'deflect' | 'ignore'
  Enemy.prototype.receive = function (proj) {
    if (this.dead) return 'ignore';
    if (this.shielded && this.shielded(proj)) return 'deflect';
    this.hurtBy(proj.damage, proj.x);
    return 'hit';
  };

  Enemy.prototype.hurtBy = function (amount, srcX) {
    this.hp -= amount;
    this.flash = 5;
    this.hitTimer = 8;
    VZ.audio.sfx('hit');
    FX.stop(2);
    FX.sparks(this.x + (srcX !== undefined ? M.sign(srcX - this.x) * 4 : 0), this.y,
      srcX !== undefined && srcX > this.x ? Math.PI : 0);
    if (this.hp <= 0) this.die();
  };

  Enemy.prototype.die = function () {
    if (this.dead) return;
    this.dead = true; this.remove = true;
    var g = this.game;
    g.score += this.score;
    g.player.kills++;
    VZ.audio.sfx('explode');
    FX.explosion(this.x, this.y, this.deathScale, this.deathColor);
    FX.popup(this.x, this.y - 10, '' + this.score, '#ffd24a');
    if (VZ.rand() < this.dropChance) {
      var roll = VZ.rand();
      var kind = roll < 0.62 ? 'health' : (roll < 0.95 ? 'energy' : 'life');
      var pk = new VZ.Pickup(g, this.x, this.y, kind);
      pk.vy = -1.6; pk.vx = VZ.rand.range(-0.6, 0.6);
      g.pickups.push(pk);
    }
  };

  // Walk with simple ledge/wall awareness. Returns true if it turned around.
  Enemy.prototype.patrolStep = function (speed) {
    var lv = this.lv;
    var ahead = this.x + this.facing * (this.w / 2 + 2);
    var footY = this.bottom() + 2;
    var wall = lv.rectSolid(ahead - 1, this.top() + 2, 2, this.h - 4);
    var ledge = !lv.rectSolid(ahead - 1, footY, 2, 2) &&
                lv.at(Math.floor(ahead / T), Math.floor(footY / T)) !== TL.PLATFORM;
    if (wall || (this.grounded && ledge)) { this.facing *= -1; return true; }
    this.vx = this.facing * speed;
    return false;
  };

  Enemy.prototype.physics = function () {
    this.applyGravity();
    if (this.moveX(this.vx)) this.vx = 0;
    if (this.moveY(this.vy)) this.vy = 0;
    this.grounded = this.checkGround();
    // Nothing survives the lava/void pools, including our own grunts.
    if (this.lv.rectHazard(this.left() + 2, this.y, this.w - 4, this.h / 2) === 'liquid') {
      this.hp = 0; this.die();
    }
  };

  Enemy.prototype.shoot = function (vx, vy, opts) {
    opts = opts || {};
    var pr = new Projectile(this.game, this.x + (opts.ox || 0), this.y + (opts.oy || 0), vx, vy, {
      team: 'enemy', damage: opts.damage || 2, w: opts.w || 6, h: opts.h || 6,
      color: opts.color || '#ff8a4a', life: opts.life || 220,
      gravity: opts.gravity || 0, homing: opts.homing || 0
    });
    this.game.projectiles.push(pr);
    VZ.audio.sfx('shoot', { vol: 0.55 });
    return pr;
  };

  Enemy.prototype.drawSprite = function (ctx, name, camX, camY, oy) {
    var flip = this.facing < 0;
    var key = name + (this.flash > 0 ? (flip ? '_WL' : '_W') : (flip ? '_L' : ''));
    var img = A.gfx[key] || A.gfx[name];
    if (!img) return;
    ctx.drawImage(img,
      Math.round(this.x - camX - img.width / 2),
      Math.round(this.bottom() - camY - img.height + (oy || 0)));
  };

  // =============================================================== TROOPER
  // Patrols, then plants itself and fires a three-round burst.
  var Trooper = VZ.Trooper = function (game, x, y) {
    Enemy.call(this, game, x, y - 8, 12, 16);
    this.hp = this.maxHp = 4;
    this.score = 150;
    this.state = 'patrol';
    this.timer = VZ.rand.int(30, 90);
    this.burst = 0;
    this.facing = VZ.rand.sign();
  };
  Trooper.prototype = Object.create(Enemy.prototype);
  Trooper.prototype.constructor = Trooper;

  Trooper.prototype.update = function () {
    this.anim++;
    if (this.flash > 0) this.flash--;
    var p = this.player();
    var dx = p ? p.x - this.x : 0, dy = p ? p.y - this.y : 999;

    if (this.state === 'patrol') {
      this.patrolStep(0.55);
      this.timer--;
      if (p && Math.abs(dx) < 150 && Math.abs(dy) < 30 && this.timer <= 0) {
        this.facing = M.sign(dx) || this.facing;
        this.state = 'aim'; this.timer = 26; this.burst = 3;
      }
    } else if (this.state === 'aim') {
      this.vx = 0;
      if (--this.timer <= 0) { this.state = 'fire'; this.timer = 0; }
    } else if (this.state === 'fire') {
      this.vx = 0;
      if (this.timer <= 0) {
        this.shoot(this.facing * 2.5, 0, { ox: this.facing * 9, oy: -2, damage: 2, w: 7, h: 5 });
        FX.sparks(this.x + this.facing * 12, this.y - 2, this.facing > 0 ? 0 : Math.PI, '#ffb347');
        this.timer = 12;
        if (--this.burst <= 0) { this.state = 'patrol'; this.timer = 90; }
      } else this.timer--;
    }
    this.physics();
  };

  Trooper.prototype.draw = function (ctx, camX, camY) {
    var f = this.state === 'patrol' ? ((this.anim >> 3) & 1 ? 'trooper_b' : 'trooper_a') : 'trooper_a';
    // Telegraph: the eye glows before the burst.
    this.drawSprite(ctx, f, camX, camY);
    if (this.state === 'aim') {
      ctx.globalAlpha = 0.4 + Math.sin(this.anim * 0.5) * 0.3;
      ctx.fillStyle = '#ff3d3d';
      ctx.fillRect(Math.round(this.x - camX - 4), Math.round(this.top() - camY + 3), 8, 2);
      ctx.globalAlpha = 1;
    }
  };

  // ================================================================= DRONE
  // Hovers, tracks, and dives when it gets a clean line on you.
  var Drone = VZ.Drone = function (game, x, y) {
    Enemy.call(this, game, x, y - 20, 12, 10);
    this.hp = this.maxHp = 3;
    this.score = 120;
    this.homeY = this.y;
    this.state = 'hover';
    this.timer = VZ.rand.int(40, 120);
    this.gravity = 0;
    this.deathColor = '#9fd8ff';
  };
  Drone.prototype = Object.create(Enemy.prototype);
  Drone.prototype.constructor = Drone;

  Drone.prototype.update = function () {
    this.anim++;
    if (this.flash > 0) this.flash--;
    var p = this.player();

    if (this.state === 'hover') {
      if (p) this.vx = M.approach(this.vx, M.sign(p.x - this.x) * 0.6, 0.03);
      this.vy = Math.sin(this.anim * 0.06) * 0.5 + (this.homeY - this.y) * 0.02;
      if (p) this.facing = M.sign(p.x - this.x) || this.facing;
      if (p && --this.timer <= 0 && Math.abs(p.x - this.x) < 26 && p.y > this.y + 10) {
        this.state = 'wind'; this.timer = 22;
      }
    } else if (this.state === 'wind') {
      this.vx *= 0.85; this.vy = -0.35;
      if (--this.timer <= 0) {
        this.state = 'dive';
        var a = p ? Math.atan2(p.y - this.y, p.x - this.x) : Math.PI / 2;
        this.vx = Math.cos(a) * 3.4; this.vy = Math.sin(a) * 3.4;
        VZ.audio.sfx('warn', { vol: 0.6 });
      }
    } else if (this.state === 'dive') {
      this.vy += 0.06;
      if (this.lv.rectSolid(this.left(), this.top() + this.vy, this.w, this.h) ||
          this.lv.rectSolid(this.left() + this.vx, this.top(), this.w, this.h)) {
        this.state = 'recover'; this.timer = 40;
        FX.burst(this.x, this.y, 6, { speed: 1.6, life: 14, size: 2, color: '#9fd8ff' });
        VZ.audio.sfx('land', { vol: 0.5 });
      }
    } else {
      this.vx *= 0.9;
      this.vy = M.approach(this.vy, -1.1, 0.08);
      if (this.y <= this.homeY + 4 || --this.timer <= 0) {
        this.state = 'hover'; this.timer = 90; this.vy = 0;
      }
    }

    if (this.moveX(this.vx) && this.state === 'dive') { this.state = 'recover'; this.timer = 40; }
    if (this.moveY(this.vy) && this.state === 'dive') { this.state = 'recover'; this.timer = 40; }

    if (this.anim % 4 === 0) {
      FX.spawn({ x: this.x, y: this.bottom(), vx: 0, vy: 0.5, g: 0.01, drag: 0.9,
        life: 8, size: 1, color: '#5fe6d8' });
    }
  };

  Drone.prototype.draw = function (ctx, camX, camY) {
    var f = (this.anim >> 2) & 1 ? 'drone_b' : 'drone_a';
    this.drawSprite(ctx, f, camX, camY, 2);
    if (this.state === 'wind') {
      ctx.globalAlpha = 0.5 + Math.sin(this.anim * 0.6) * 0.4;
      ctx.strokeStyle = '#ff3d3d'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(Math.round(this.x - camX), Math.round(this.y - camY), 12, 0, 7);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };

  // ================================================================ HOPPER
  // Crouches, telegraphs, then leaps in a fat arc.
  var Hopper = VZ.Hopper = function (game, x, y) {
    Enemy.call(this, game, x, y - 7, 14, 14);
    this.hp = this.maxHp = 5;
    this.score = 180;
    this.contactDamage = 3;
    this.state = 'wait';
    this.timer = VZ.rand.int(30, 80);
  };
  Hopper.prototype = Object.create(Enemy.prototype);
  Hopper.prototype.constructor = Hopper;

  Hopper.prototype.update = function () {
    this.anim++;
    if (this.flash > 0) this.flash--;
    var p = this.player();

    if (this.grounded) {
      this.vx *= 0.7;
      if (this.state === 'air') {
        this.state = 'wait'; this.timer = 34;
        FX.dust(this.x, this.bottom() - 1, 1); FX.dust(this.x, this.bottom() - 1, -1);
        VZ.audio.sfx('land', { vol: 0.7 });
        FX.shake(1.2);
      }
      if (this.state === 'wait') {
        if (p) this.facing = M.sign(p.x - this.x) || this.facing;
        if (--this.timer <= 0 && p && Math.abs(p.x - this.x) < 190) {
          this.state = 'wind'; this.timer = 26;
        }
      } else if (this.state === 'wind') {
        if (--this.timer <= 0) {
          this.state = 'air';
          var dist = p ? M.clamp(Math.abs(p.x - this.x), 30, 110) : 70;
          this.vx = this.facing * (dist / 40);
          this.vy = -6.2;
          VZ.audio.sfx('jump', { vol: 0.7 });
          FX.dust(this.x, this.bottom() - 1, -this.facing);
        }
      }
    } else this.state = 'air';
    this.physics();
  };

  Hopper.prototype.draw = function (ctx, camX, camY) {
    var name = (this.state === 'air') ? 'hopper_l' : 'hopper_c';
    var squash = this.state === 'wind' ? 1 : 0;
    this.drawSprite(ctx, name, camX, camY, squash);
    if (this.state === 'wind') {
      ctx.globalAlpha = 0.35 + Math.sin(this.anim * 0.7) * 0.3;
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(Math.round(this.x - camX - 8), Math.round(this.top() - camY - 4), 16, 2);
      ctx.globalAlpha = 1;
    }
  };

  // ============================================================== SHIELDER
  // Advances behind a plate. Frontal buster shots ping off; get behind it,
  // hit it from above, or break the guard with a full charge.
  var Shielder = VZ.Shielder = function (game, x, y) {
    Enemy.call(this, game, x, y - 9, 14, 18);
    this.hp = this.maxHp = 6;
    this.score = 250;
    this.contactDamage = 3;
    this.dropChance = 0.4;
    this.facing = -1;
    this.guardStun = 0;
  };
  Shielder.prototype = Object.create(Enemy.prototype);
  Shielder.prototype.constructor = Shielder;

  Shielder.prototype.shielded = function (proj) {
    if (this.guardStun > 0) return false;
    // A level-2 charge or the lance punches straight through the guard.
    if (proj.level === 2 || proj.kind === 'lance') {
      this.guardStun = 90;
      FX.popup(this.x, this.y - 14, 'GUARD BREAK', '#ffd24a');
      VZ.audio.sfx('deflect', { vol: 1.3 });
      return false;
    }
    // Only the front is protected.
    var fromFront = (proj.x - this.x) * this.facing > 0;
    var fromAbove = proj.y < this.top() + 3;
    return fromFront && !fromAbove;
  };

  Shielder.prototype.update = function () {
    this.anim++;
    if (this.flash > 0) this.flash--;
    if (this.guardStun > 0) this.guardStun--;
    var p = this.player();
    if (p) {
      var want = M.sign(p.x - this.x);
      if (want && Math.abs(p.x - this.x) > 18) this.facing = want;
    }
    if (this.guardStun > 0) {
      this.vx *= 0.8;
    } else if (p && Math.abs(p.y - this.y) < 40) {
      var ahead = this.x + this.facing * (this.w / 2 + 3);
      var ledge = !this.lv.rectSolid(ahead - 1, this.bottom() + 2, 2, 2);
      var wall = this.lv.rectSolid(ahead - 1, this.top() + 2, 2, this.h - 4);
      this.vx = (ledge && this.grounded) || wall ? 0 : this.facing * 0.5;
    } else this.vx *= 0.85;
    this.physics();
  };

  Shielder.prototype.draw = function (ctx, camX, camY) {
    var f = Math.abs(this.vx) > 0.1 ? ((this.anim >> 3) & 1 ? 'shielder_b' : 'shielder_a') : 'shielder_a';
    if (this.guardStun > 0 && (this.guardStun >> 1) % 2 === 0) {
      ctx.globalAlpha = 0.75;
    }
    this.drawSprite(ctx, f, camX, camY);
    ctx.globalAlpha = 1;
    if (this.guardStun > 0) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(Math.round(this.x - camX - 8), Math.round(this.top() - camY - 5), 16, 1);
      ctx.globalAlpha = 1;
    }
  };

  // ================================================================ TURRET
  // Fixed emplacement that tracks and fires along a telegraphed line.
  var Turret = VZ.Turret = function (game, x, y, ceiling) {
    Enemy.call(this, game, x, y - (ceiling ? 4 : 6), 14, 12);
    this.hp = this.maxHp = 5;
    this.score = 200;
    this.contactDamage = 2;
    this.ceiling = !!ceiling;
    this.gravity = 0;
    this.angle = ceiling ? Math.PI / 2 : -Math.PI / 2;
    this.state = 'idle';
    this.timer = VZ.rand.int(40, 100);
    this.dropChance = 0.4;
    if (ceiling) this.y = y + 4;
  };
  Turret.prototype = Object.create(Enemy.prototype);
  Turret.prototype.constructor = Turret;

  Turret.prototype.update = function () {
    this.anim++;
    if (this.flash > 0) this.flash--;
    var p = this.player();
    if (!p || p.dead) return;
    var d = this.distToPlayer();
    var want = Math.atan2(p.y - this.y, p.x - this.x);
    // Keep the barrel on the correct side of the mount.
    var lo = this.ceiling ? 0.15 : Math.PI + 0.15;
    var hi = this.ceiling ? Math.PI - 0.15 : Math.PI * 2 - 0.15;
    var norm = (want + Math.PI * 2) % (Math.PI * 2);
    want = M.clamp(norm, lo, hi);
    this.angle += M.wrapPi(want - this.angle) * 0.08;

    if (this.state === 'idle') {
      if (d < 170 && --this.timer <= 0) { this.state = 'lock'; this.timer = 34; }
    } else if (this.state === 'lock') {
      if (--this.timer <= 0) {
        var vx = Math.cos(this.angle) * 3.0, vy = Math.sin(this.angle) * 3.0;
        this.shoot(vx, vy, {
          ox: Math.cos(this.angle) * 11, oy: Math.sin(this.angle) * 11,
          damage: 2, w: 7, h: 7, color: '#ffb347'
        });
        FX.sparks(this.x + Math.cos(this.angle) * 13, this.y + Math.sin(this.angle) * 13, this.angle);
        FX.shake(0.8);
        this.state = 'idle'; this.timer = 78;
      }
    }
  };

  Turret.prototype.draw = function (ctx, camX, camY) {
    var x = Math.round(this.x - camX), y = Math.round(this.y - camY);
    // barrel
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.angle);
    ctx.fillStyle = '#454c60'; ctx.fillRect(0, -4, 14, 8);
    ctx.fillStyle = '#8f97ac'; ctx.fillRect(0, -3, 13, 2);
    ctx.fillStyle = '#170f18'; ctx.fillRect(11, -4, 3, 8);
    ctx.restore();
    var img = A.gfx[this.flash > 0 ? 'turret_W' : 'turret'];
    ctx.drawImage(img, x - img.width / 2, y - img.height / 2);
    if (this.state === 'lock') {
      // laser sight
      ctx.globalAlpha = 0.35 + Math.sin(this.anim * 0.6) * 0.25;
      ctx.strokeStyle = '#ff3d3d'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(this.angle) * 13, y + Math.sin(this.angle) * 13);
      ctx.lineTo(x + Math.cos(this.angle) * 200, y + Math.sin(this.angle) * 200);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };

  // ================================================================ ROLLER
  // A spiked drum that rolls the floor and ricochets off walls.
  var Roller = VZ.Roller = function (game, x, y) {
    Enemy.call(this, game, x, y - 7, 14, 14);
    this.hp = this.maxHp = 6;
    this.score = 160;
    this.contactDamage = 3;
    this.facing = VZ.rand.sign();
    this.rot = 0;
    this.speed = 1.5;
    this.deathColor = '#d05a58';
  };
  Roller.prototype = Object.create(Enemy.prototype);
  Roller.prototype.constructor = Roller;

  Roller.prototype.update = function () {
    this.anim++;
    if (this.flash > 0) this.flash--;
    this.applyGravity();
    this.vx = this.facing * this.speed;
    if (this.moveX(this.vx)) {
      this.facing *= -1;
      FX.sparks(this.x + this.facing * -7, this.y, this.facing > 0 ? Math.PI : 0, '#ffd24a');
      VZ.audio.sfx('wall', { vol: 0.7 });
    }
    if (this.moveY(this.vy)) this.vy = 0;
    this.grounded = this.checkGround();
    // Turn at ledges so it stays on its platform.
    if (this.grounded) {
      var ahead = this.x + this.facing * (this.w / 2 + 3);
      if (!this.lv.rectSolid(ahead - 1, this.bottom() + 2, 2, 3) &&
          this.lv.at(Math.floor(ahead / T), Math.floor((this.bottom() + 2) / T)) !== TL.PLATFORM) {
        this.facing *= -1;
      }
    }
    this.rot += this.facing * 0.16;
    if (this.anim % 6 === 0 && this.grounded) {
      FX.spawn({ x: this.x - this.facing * 6, y: this.bottom() - 1, vx: -this.facing * 0.4,
        vy: -0.3, g: 0.03, drag: 0.9, life: 12, size: 1, color: '#cfd8ea' });
    }
  };

  Roller.prototype.draw = function (ctx, camX, camY) {
    var x = Math.round(this.x - camX), y = Math.round(this.y - camY);
    var r = 7;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(this.rot);
    // spikes
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#8f97ac';
    for (var i = 0; i < 8; i++) {
      ctx.save(); ctx.rotate((i / 8) * Math.PI * 2);
      ctx.beginPath(); ctx.moveTo(-2, -r); ctx.lineTo(2, -r); ctx.lineTo(0, -r - 4); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#963444';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#d05a58';
    ctx.beginPath(); ctx.arc(-1.5, -1.5, r - 3, 0, 7); ctx.fill();
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#170f18';
    ctx.fillRect(-r, -1, r * 2, 2);
    ctx.restore();
  };

  // =============================================================== FLAMER
  // Vent that erupts on a fixed cycle; pure timing hazard, indestructible.
  var Flamer = VZ.Flamer = function (game, x, y) {
    Enemy.call(this, game, x, y - 8, 12, 16);
    this.hp = this.maxHp = 9999;
    this.score = 0;
    this.contactDamage = 0;
    this.gravity = 0;
    this.dropChance = 0;
    this.phase = VZ.rand.int(0, 119);
    this.invincible = true;
  };
  Flamer.prototype = Object.create(Enemy.prototype);
  Flamer.prototype.constructor = Flamer;

  Flamer.prototype.receive = function () { return 'deflect'; };

  Flamer.prototype.update = function () {
    this.anim++;
    var t = (this.anim + this.phase) % 150;
    this.charging = t > 100 && t <= 120;
    this.firing = t > 120;
    this.flameH = this.firing ? M.clamp((t - 120) * 6, 0, 64) : 0;
    if (this.firing && this.anim % 2 === 0) {
      FX.spawn({ x: this.x + VZ.rand.range(-4, 4), y: this.y - this.flameH,
        vx: VZ.rand.range(-0.3, 0.3), vy: -VZ.rand.range(0.4, 1.2), g: -0.02, drag: 0.95,
        life: 16, size: 3, color: VZ.rand.chance(0.5) ? '#ffd166' : '#ff7a1a', glow: true });
    }
    if (t === 121) VZ.audio.sfx('laser', { vol: 0.5 });
    // Damage is applied through a virtual hitbox.
    var p = this.player();
    if (p && this.firing && this.flameH > 8) {
      var box = { x: this.x - 6, y: this.y - this.flameH, w: 12, h: this.flameH };
      if (VZ.aabb(box, p.box())) p.takeHit(3, this.x);
    }
  };

  Flamer.prototype.draw = function (ctx, camX, camY) {
    var x = Math.round(this.x - camX), y = Math.round(this.bottom() - camY);
    ctx.fillStyle = '#454c60'; ctx.fillRect(x - 7, y - 8, 14, 8);
    ctx.fillStyle = '#8f97ac'; ctx.fillRect(x - 6, y - 9, 12, 2);
    ctx.fillStyle = this.charging ? (this.anim % 6 < 3 ? '#ff7a1a' : '#8c2408') : '#2a1a18';
    ctx.fillRect(x - 4, y - 10, 8, 3);
    if (this.firing && this.flameH > 2) {
      var h = this.flameH;
      var g = ctx.createLinearGradient(0, y - h, 0, y - 8);
      g.addColorStop(0, 'rgba(255,240,180,0.15)');
      g.addColorStop(0.4, 'rgba(255,160,40,0.85)');
      g.addColorStop(1, 'rgba(255,230,140,0.95)');
      ctx.fillStyle = g;
      var wob = Math.sin(this.anim * 0.5) * 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 9);
      ctx.lineTo(x - 2 + wob, y - h);
      ctx.lineTo(x + 2 + wob, y - h);
      ctx.lineTo(x + 5, y - 9);
      ctx.closePath(); ctx.fill();
    }
  };

  VZ.ENEMY_FACTORY = {
    trooper: function (g, x, y) { return new Trooper(g, x, y); },
    drone: function (g, x, y) { return new Drone(g, x, y); },
    hopper: function (g, x, y) { return new Hopper(g, x, y); },
    shielder: function (g, x, y) { return new Shielder(g, x, y); },
    turret: function (g, x, y) { return new Turret(g, x, y, false); },
    turretCeil: function (g, x, y) { return new Turret(g, x, y - T, true); },
    roller: function (g, x, y) { return new Roller(g, x, y); },
    flamer: function (g, x, y) { return new Flamer(g, x, y); }
  };

})(typeof window !== 'undefined' ? window : globalThis);
