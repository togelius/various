/* VANGUARD ZERO - entity base, the player, projectiles and pickups.
 *
 * Positions are the CENTRE of the axis-aligned hitbox. Movement resolves X and
 * Y separately against the tilemap, which keeps corner cases (wall + floor in
 * the same step) from producing sticky collisions.
 */
(function (global) {
  'use strict';
  var VZ = global.VZ || (global.VZ = {});
  var T = VZ.TILE, M = VZ.math, A = VZ.art, FX = VZ.fx, TL = VZ.tiles;

  // ============================================================ ENTITY BASE
  var Entity = VZ.Entity = function (game, x, y, w, h) {
    this.game = game; this.lv = game.level;
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.grounded = false;
    this.wallDir = 0;
    this.dead = false;
    this.remove = false;
    this.hp = 1; this.maxHp = 1;
    this.flash = 0;
    this.gravity = 0.42;
    this.maxFall = 6.8;
    this.type = 'entity';
    this.team = 'neutral';
    this.contactDamage = 0;
    this.hitTimer = 0;
  };

  Entity.prototype.box = function () {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  };
  Entity.prototype.left = function () { return this.x - this.w / 2; };
  Entity.prototype.right = function () { return this.x + this.w / 2; };
  Entity.prototype.top = function () { return this.y - this.h / 2; };
  Entity.prototype.bottom = function () { return this.y + this.h / 2; };

  // Move along X, stopping at solid tiles. Returns true if a wall was hit.
  Entity.prototype.moveX = function (dx) {
    if (!dx) return false;
    var lv = this.lv;
    var step = Math.sign(dx), remain = Math.abs(dx);
    var hit = false;
    while (remain > 0) {
      var d = Math.min(remain, 1) * step;
      remain -= Math.min(remain, 1);
      var nx = this.x + d;
      if (lv.rectSolid(nx - this.w / 2, this.top() + 1, this.w, this.h - 2)) {
        // Snap flush against the tile face.
        if (step > 0) this.x = Math.floor((nx + this.w / 2) / T) * T - this.w / 2 - 0.01;
        else this.x = Math.floor((nx - this.w / 2) / T) * T + T + this.w / 2 + 0.01;
        hit = true;
        break;
      }
      this.x = nx;
    }
    return hit;
  };

  // Move along Y. `dropThrough` lets the player fall through one-way platforms.
  Entity.prototype.moveY = function (dy, dropThrough) {
    if (!dy) return false;
    var lv = this.lv;
    var step = Math.sign(dy), remain = Math.abs(dy);
    var hit = false;
    while (remain > 0) {
      var d = Math.min(remain, 1) * step;
      remain -= Math.min(remain, 1);
      var oldBottom = this.bottom();
      var ny = this.y + d;
      var nTop = ny - this.h / 2, nBottom = ny + this.h / 2;

      if (lv.rectSolid(this.left() + 1, nTop, this.w - 2, this.h)) {
        if (step > 0) this.y = Math.floor(nBottom / T) * T - this.h / 2 - 0.01;
        else this.y = Math.floor(nTop / T) * T + T + this.h / 2 + 0.01;
        hit = true;
        break;
      }
      // One-way platforms: only block a downward move that starts above them.
      if (step > 0 && !dropThrough && this.usePlatforms !== false) {
        var row = Math.floor((nBottom - 0.001) / T);
        var x0 = Math.floor((this.left() + 1) / T), x1 = Math.floor((this.right() - 1) / T);
        var landed = false;
        for (var tx = x0; tx <= x1; tx++) {
          if (lv.at(tx, row) === TL.PLATFORM && oldBottom <= row * T + 1.5) { landed = true; break; }
        }
        if (landed) {
          this.y = row * T - this.h / 2 - 0.01;
          hit = true;
          break;
        }
      }
      this.y = ny;
    }
    return hit;
  };

  Entity.prototype.checkGround = function () {
    var lv = this.lv;
    if (lv.rectSolid(this.left() + 1, this.bottom() + 0.5, this.w - 2, 1)) return true;
    var row = Math.floor((this.bottom() + 0.5) / T);
    var x0 = Math.floor((this.left() + 1) / T), x1 = Math.floor((this.right() - 1) / T);
    for (var tx = x0; tx <= x1; tx++) {
      if (lv.at(tx, row) === TL.PLATFORM &&
          Math.abs(this.bottom() - row * T) < 2) return true;
    }
    return false;
  };

  Entity.prototype.applyGravity = function (scale) {
    this.vy += this.gravity * (scale === undefined ? 1 : scale);
    if (this.vy > this.maxFall) this.vy = this.maxFall;
  };

  Entity.prototype.hurt = function (amount, srcX) {
    if (this.dead || this.invuln > 0) return false;
    this.hp -= amount;
    this.flash = 6;
    if (this.hp <= 0) { this.hp = 0; this.die(); return true; }
    return false;
  };

  Entity.prototype.die = function () { this.dead = true; this.remove = true; };
  Entity.prototype.update = function () {};
  Entity.prototype.draw = function () {};

  // Draw a sprite centred horizontally on the entity with the given foot line.
  Entity.prototype.blit = function (ctx, img, ox, oy, camX, camY, flipped) {
    var dx = Math.round(this.x - camX + ox);
    var dy = Math.round(this.y - camY + oy);
    ctx.drawImage(img, dx, dy);
  };

  // ================================================================= PLAYER
  var P = {
    W: 10, H: 22,
    RUN: 1.95,
    ACCEL: 0.6, AIR_ACCEL: 0.42,
    FRICTION: 0.62, AIR_FRICTION: 0.12,
    GRAVITY: 0.44, APEX_GRAVITY: 0.30, APEX_WINDOW: 1.6,
    MAX_FALL: 6.8,
    JUMP: -7.0, JUMP_CUT: -2.6,
    COYOTE: 7, BUFFER: 9,
    DASH_SPEED: 4.0, DASH_TIME: 20, DASH_COOL: 9,
    SLIDE_SPEED: 1.3,
    WJ_X: 3.4, WJ_Y: -7.3, WJ_LOCK: 9, WJ_COYOTE: 7, WJ_NOCUT: 8, WJ_GRACE: 6,
    IFRAMES: 72,
    CHARGE1: 26, CHARGE2: 70,
    MAX_HP: 16, MAX_ENERGY: 28
  };
  VZ.P = P;

  var WEAPONS = VZ.WEAPONS = [
    { id: 'buster', name: 'BUSTER', color: '#5fe6d8', cost: 0 },
    { id: 'spread', name: 'SPREAD', color: '#ffd24a', cost: 2 },
    { id: 'lance', name: 'LANCE', color: '#ff5a6e', cost: 4 }
  ];

  var Player = VZ.Player = function (game, x, y) {
    Entity.call(this, game, x, y, P.W, P.H);
    this.type = 'player';
    this.team = 'player';
    this.maxHp = P.MAX_HP; this.hp = P.MAX_HP;
    this.energy = P.MAX_ENERGY;
    this.gravity = P.GRAVITY;
    this.maxFall = P.MAX_FALL;

    this.coyote = 0; this.jumpHeld = false;
    this.dashTime = 0; this.dashCool = 0; this.airDash = true;
    this.wallDir = 0; this.wallStick = 0;
    this.wallCoyote = 0; this.lastWall = 0; this.noCut = 0;
    this.ctrlLock = 0;
    this.invuln = 0;
    this.hurtTime = 0;
    this.charge = 0; this.chargeLevel = 0; this.wasCharging = false;
    this.shootTimer = 0; this.fireCool = 0;
    this.animTime = 0; this.runFrame = 0;
    this.weapon = 0;
    this.unlocked = [true, false, false];
    this.deadTimer = 0;
    this.spawnTimer = 30;
    this.prefix = '';
    this.dropThrough = false;
    this.landDust = 0;
    this.landTimer = 0;
    this.warp = 0;
    this.prevVy = 0;
    this.dashGhosts = [];
    this.kills = 0;
  };
  Player.prototype = Object.create(Entity.prototype);
  Player.prototype.constructor = Player;

  // True when every tile under our feet is a one-way platform.
  Player.prototype.onlyPlatformBelow = function () {
    var lv = this.lv;
    if (lv.rectSolid(this.left() + 1, this.bottom() + 0.5, this.w - 2, 1)) return false;
    var row = Math.floor((this.bottom() + 0.5) / T);
    var x0 = Math.floor((this.left() + 1) / T), x1 = Math.floor((this.right() - 1) / T);
    for (var tx = x0; tx <= x1; tx++) if (lv.at(tx, row) === TL.PLATFORM) return true;
    return false;
  };

  Player.prototype.respawn = function (x, y) {
    this.x = x; this.y = y - this.h / 2;
    this.vx = this.vy = 0;
    this.hp = this.maxHp;
    this.dead = false; this.remove = false;
    this.invuln = 60; this.hurtTime = 0; this.deadTimer = 0;
    this.spawnTimer = 26;
    this.dashTime = 0; this.charge = 0; this.chargeLevel = 0;
    this.warp = 0;
    this.dashGhosts.length = 0;
  };

  Player.prototype.update = function () {
    var In = VZ.input, g = this.game;

    if (this.dead) {
      this.deadTimer++;
      return;
    }
    // Teleporting out at stage end: no physics, just rise.
    if (this.warp > 0) {
      this.warp++;
      this.animTime++;
      if (this.warp > 16) this.y -= Math.min(9, (this.warp - 16) * 0.55);
      this.vx = 0; this.vy = 0;
      if (this.warp % 3 === 0) {
        FX.spawn({ x: this.x + VZ.rand.range(-7, 7), y: this.y + VZ.rand.range(-6, 12),
          vx: 0, vy: -VZ.rand.range(1.5, 3.5), g: 0, drag: 1, life: 14, size: 2,
          color: VZ.rand.chance(0.5) ? '#5fe6d8' : '#d6e8ff', glow: true });
      }
      return;
    }
    if (this.spawnTimer > 0) { this.spawnTimer--; this.vy = 0; return; }

    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    if (this.fireCool > 0) this.fireCool--;
    if (this.shootTimer > 0) this.shootTimer--;
    if (this.dashCool > 0) this.dashCool--;
    if (this.ctrlLock > 0) this.ctrlLock--;
    if (this.hurtTime > 0) this.hurtTime--;
    if (this.landTimer > 0) this.landTimer--;
    this.animTime++;

    var canControl = this.hurtTime <= 0 && g.playerControl !== false;
    var ax = canControl && this.ctrlLock <= 0 ? In.axis() : 0;

    // ---------------------------------------------------------------- dash
    if (this.dashTime > 0) {
      this.dashTime--;
      this.vx = this.facing * P.DASH_SPEED;
      if (this.dashTime % 3 === 0) {
        this.dashGhosts.push({ x: this.x, y: this.y, f: this.facing, life: 10, pose: 'dash' });
      }
      if (this.dashTime % 4 === 0) {
        FX.spawn({ x: this.x - this.facing * 5, y: this.y + 8, vx: -this.facing * 0.7,
          vy: -0.25, g: 0.01, drag: 0.9, life: 16, size: 2, color: '#9fd8ff' });
      }
      // Dashing off a ledge keeps the speed but ends the dash state early.
      if (!this.grounded && this.dashTime > 6 && !this.checkGround()) this.dashTime = Math.min(this.dashTime, 6);
    }

    if (this.dashTime === 1 && this.grounded) {
      FX.dust(this.x - this.facing * 4, this.bottom() - 1, -this.facing);
    }
    if (canControl && In.pressed.dash && this.dashCool <= 0 && this.dashTime <= 0) {
      var may = this.grounded || this.airDash;
      if (may) {
        if (ax !== 0) this.facing = ax;
        this.dashTime = P.DASH_TIME;
        this.dashCool = P.DASH_TIME + P.DASH_COOL;
        if (!this.grounded) this.airDash = false;
        this.vy = this.grounded ? this.vy : Math.min(this.vy, 0.5) * 0.2;
        VZ.audio.sfx('dash');
        FX.dust(this.x - this.facing * 4, this.bottom() - 1, -this.facing);
        FX.ring(this.x, this.y + 4, { grow: 2.0, life: 10, color: '#9fd8ff', width: 1, squash: 0.5 });
      }
    }

    // -------------------------------------------------------- horizontal
    if (this.dashTime <= 0) {
      var target = ax * P.RUN;
      var accel = this.grounded ? P.ACCEL : P.AIR_ACCEL;
      if (ax !== 0) {
        this.vx = M.approach(this.vx, target, accel);
        if (this.hurtTime <= 0 && this.ctrlLock <= 0) this.facing = ax;
      } else {
        this.vx = M.approach(this.vx, 0, this.grounded ? P.FRICTION : P.AIR_FRICTION);
      }
    }

    // conveyor drift
    if (this.grounded) {
      var cv = this.lv.conveyorAt(this.left(), this.top(), this.w, this.h);
      if (cv) this.vx += cv * 0.55;
    }

    // ------------------------------------------------------------ gravity
    var slidingNow = false;
    if (this.dashTime <= 0 || this.grounded) {
      // Softer gravity near the apex gives the jump a controllable hang.
      var gs = (Math.abs(this.vy) < P.APEX_WINDOW && !this.grounded) ? P.APEX_GRAVITY / P.GRAVITY : 1;
      if (this.dashTime > 0) gs = 0;
      this.applyGravity(gs);
    } else {
      this.vy = 0;
    }

    // --------------------------------------------------------- wall touch
    var lv = this.lv;
    var touchR = lv.rectSolid(this.right() + 1, this.top() + 3, 1, this.h - 6);
    var touchL = lv.rectSolid(this.left() - 2, this.top() + 3, 1, this.h - 6);
    this.wallDir = 0;
    if (!this.grounded && this.dashTime <= 0) {
      // Contact alone establishes the cling. Demanding a hold *into* the wall
      // is one convention, but in an opposing-wall chimney it turns every kick
      // into a frame-exact direction flip: the kick throws you away from the
      // wall, so the stick is already pointing at the far wall by the time you
      // arrive. Neutral or held-through input has to work. Pushing away is the
      // deliberate way off, and even that keeps a few frames of grace so an
      // early flip does not drop the wall out from under the jump.
      if (touchR && (ax >= 0 || this.wallStick > 0)) this.wallDir = 1;
      else if (touchL && (ax <= 0 || this.wallStick > 0)) this.wallDir = -1;
      if (this.wallDir !== 0 && ax !== -this.wallDir) this.wallStick = P.WJ_GRACE;
      else if (this.wallStick > 0) this.wallStick--;
      if (this.wallDir !== 0 && this.vy > 0) {
        this.vy = Math.min(this.vy, P.SLIDE_SPEED);
        slidingNow = true;
        this.airDash = true;                    // wall contact restores the air dash
        if (this.animTime % 5 === 0) {
          FX.spawn({ x: this.x + this.wallDir * 6, y: this.y + M.lerp(-6, 8, VZ.rand()),
            vx: -this.wallDir * 0.4, vy: -0.5, g: 0.02, drag: 0.92, life: 14, size: 1,
            color: '#cfd8ea' });
        }
      }
    } else { this.wallStick = 0; }
    this.sliding = slidingNow;

    // Wall coyote: kicking off stays available for a few frames after losing
    // contact, which is what makes chimney climbs feel generous instead of
    // pixel-perfect.
    if (this.wallDir !== 0) { this.lastWall = this.wallDir; this.wallCoyote = P.WJ_COYOTE; }
    else if (this.wallCoyote > 0) this.wallCoyote--;
    if (this.noCut > 0) this.noCut--;

    // ------------------------------------------------------------- jump
    if (this.grounded) { this.coyote = P.COYOTE; this.airDash = true; }
    else if (this.coyote > 0) this.coyote--;

    // Down + jump on a one-way platform drops through it.
    this.dropThrough = false;
    if (canControl && this.grounded && In.held.down && In.buffer.jump > 0 &&
        this.onlyPlatformBelow()) {
      In.consume('jump');
      this.dropThrough = true;
      this.y += 2;
      this.vy = 1.2;
      this.grounded = false;
    } else if (canControl && In.buffer.jump > 0) {
      if (this.coyote > 0 && this.dashTime <= 0) {
        In.consume('jump');
        this.vy = P.JUMP;
        this.coyote = 0; this.grounded = false;
        this.jumpHeld = true;
        VZ.audio.sfx('jump');
        FX.dust(this.x, this.bottom() - 1, -this.facing);
      } else if (this.wallDir !== 0 || this.wallCoyote > 0) {
        var wd = this.wallDir || this.lastWall;
        In.consume('jump');
        this.vy = P.WJ_Y;
        this.vx = -wd * P.WJ_X;
        this.facing = -wd;
        this.wallCoyote = 0;
        this.noCut = P.WJ_NOCUT;
        this.ctrlLock = P.WJ_LOCK;
        this.wallStick = 0;
        this.airDash = true;
        this.jumpHeld = true;
        VZ.audio.sfx('jump', { vol: 0.9 });
        VZ.audio.sfx('wall');
        FX.burst(this.x + wd * 5, this.y + 4, 6,
          { speed: 1.6, life: 16, size: 2, color: '#cfd8ea', angle: wd > 0 ? 0 : Math.PI, spread: 1.8 });
      }
    }
    if (In.released.jump && this.vy < P.JUMP_CUT && this.noCut <= 0) this.vy = P.JUMP_CUT;

    // ------------------------------------------------------------- firing
    this.updateWeapons(canControl);

    // ------------------------------------------------------- integrate
    this.prevVy = this.vy;
    var wasGrounded = this.grounded;
    if (this.moveX(this.vx)) {
      this.vx = 0;
      if (this.dashTime > 0 && this.grounded) this.dashTime = 0;
    }
    var hitY = this.moveY(this.vy, this.dropThrough || this.vy < 0);
    if (hitY) {
      if (this.vy > 0) {
        if (!wasGrounded && this.prevVy > 3) {
          VZ.audio.sfx('land', { vol: Math.min(1, this.prevVy / 7) });
          FX.dust(this.x, this.bottom() - 1, 1);
          FX.dust(this.x, this.bottom() - 1, -1);
          this.landTimer = this.prevVy > 5.2 ? 8 : 5;
          if (this.prevVy > 5.6) FX.shake(1.6);
        }
      }
      this.vy = 0;
    }
    this.grounded = this.checkGround() && this.vy >= 0;
    if (this.grounded) this.lv.touchCrumble(this.left(), this.top(), this.w, this.h);

    // ------------------------------------------------------- hazards
    var hz = this.lv.rectHazard(this.left() + 1, this.top() + 2, this.w - 2, this.h - 4);
    if (hz === 'spike') this.takeHit(4, this.x - this.facing * 8, true);
    else if (hz === 'liquid') this.kill('liquid');
    if (this.top() > this.lv.pixelH + 24) this.kill('pit');

    // dash ghosts fade
    for (var i = this.dashGhosts.length - 1; i >= 0; i--) {
      if (--this.dashGhosts[i].life <= 0) this.dashGhosts.splice(i, 1);
    }

    // run animation
    if (this.grounded && Math.abs(this.vx) > 0.4) {
      this.runFrame += Math.abs(this.vx) * 0.115;
      if (this.runFrame >= 6) this.runFrame -= 6;
    } else this.runFrame = 0;
  };

  // ------------------------------------------------------------- weapons
  Player.prototype.updateWeapons = function (canControl) {
    var In = VZ.input;
    if (!canControl) { this.charge = 0; this.chargeLevel = 0; return; }

    if (In.pressed.weapon) this.cycleWeapon();

    var w = WEAPONS[this.weapon];

    if (this.weapon === 0) {
      // Buster: tap to fire, hold to charge.
      if (In.pressed.fire && this.fireCool <= 0) this.fire(0);
      if (In.held.fire) {
        this.charge++;
        var lvl = this.charge >= P.CHARGE2 ? 2 : (this.charge >= P.CHARGE1 ? 1 : 0);
        if (lvl !== this.chargeLevel) {
          this.chargeLevel = lvl;
          if (lvl > 0) VZ.audio.sfx(lvl === 2 ? 'chargeReady' : 'charging');
        }
        if (this.chargeLevel > 0 && this.animTime % 3 === 0) {
          var a = VZ.rand() * Math.PI * 2, r = 14 - this.chargeLevel * 3;
          FX.spawn({
            x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r,
            vx: -Math.cos(a) * 0.9, vy: -Math.sin(a) * 0.9, g: 0, drag: 1,
            life: 12, size: this.chargeLevel === 2 ? 2 : 1,
            color: this.chargeLevel === 2 ? '#ffe9a0' : '#5fe6d8', glow: true
          });
        }
      } else {
        if (this.chargeLevel > 0) this.fire(this.chargeLevel);
        this.charge = 0; this.chargeLevel = 0;
      }
    } else {
      if (In.pressed.fire && this.fireCool <= 0) {
        if (this.energy >= w.cost) this.fireSpecial();
        else { VZ.audio.sfx('deny'); this.game.hud.flashEnergy = 20; }
      }
      this.charge = 0; this.chargeLevel = 0;
    }
  };

  Player.prototype.cycleWeapon = function () {
    var start = this.weapon;
    for (var i = 1; i <= WEAPONS.length; i++) {
      var n = (start + i) % WEAPONS.length;
      if (this.unlocked[n]) {
        this.weapon = n;
        VZ.audio.sfx('menu');
        this.game.hud.weaponPop = 60;
        return;
      }
    }
  };

  Player.prototype.muzzle = function () {
    return { x: this.x + this.facing * 12, y: this.y - 1 + (this.dashTime > 0 ? 3 : 0) };
  };

  Player.prototype.fire = function (level) {
    var m = this.muzzle();
    var shots = this.game.projectiles.filter(function (p) {
      return p.team === 'player' && p.kind === 'buster' && p.level === 0;
    });
    if (level === 0 && shots.length >= 3) return;

    this.shootTimer = 15;
    this.fireCool = level === 0 ? 7 : 16;
    // Tuned against boss HP: a bare buster should be viable but slow, and a
    // full charge should feel like it is worth the 1.2s wind-up.
    var dmg = level === 0 ? 2 : (level === 1 ? 4 : 8);
    var spd = level === 0 ? 5.4 : (level === 1 ? 5.0 : 4.6);
    var pr = new Projectile(this.game, m.x, m.y, this.facing * spd, 0, {
      team: 'player', kind: 'buster', level: level, damage: dmg,
      w: level === 0 ? 6 : (level === 1 ? 11 : 16),
      h: level === 0 ? 6 : (level === 1 ? 10 : 15),
      pierce: level === 2 ? 2 : 0
    });
    this.game.projectiles.push(pr);
    VZ.audio.sfx(level === 0 ? 'shoot' : 'chargeShot');
    if (level > 0) {
      FX.shake(level === 2 ? 2.4 : 1.2);
      FX.ring(m.x, m.y, { grow: 2.4, life: 10, color: '#cffcff', width: 2 });
      this.vx -= this.facing * (level === 2 ? 1.2 : 0.5);   // recoil
    }
    FX.burst(m.x, m.y, level === 0 ? 3 : 8, {
      angle: this.facing > 0 ? 0 : Math.PI, spread: 1.1,
      speed: 1.4 + level, life: 10, size: 1 + level,
      color: level === 2 ? '#ffe9a0' : '#cffcff', glow: true, g: 0
    });
  };

  Player.prototype.fireSpecial = function () {
    var w = WEAPONS[this.weapon], m = this.muzzle();
    this.energy = Math.max(0, this.energy - w.cost);
    this.shootTimer = 16;

    if (w.id === 'spread') {
      this.fireCool = 14;
      for (var i = -1; i <= 1; i++) {
        var ang = i * 0.30;
        this.game.projectiles.push(new Projectile(this.game, m.x, m.y,
          Math.cos(ang) * this.facing * 4.6, Math.sin(ang) * 4.6, {
            team: 'player', kind: 'spread', damage: 2, w: 7, h: 7, color: '#ffd24a',
            life: 90
          }));
      }
      VZ.audio.sfx('shoot', { vol: 1.2 });
      FX.burst(m.x, m.y, 6, { angle: this.facing > 0 ? 0 : Math.PI, spread: 1.4,
        speed: 2, life: 12, size: 2, color: '#ffd24a', glow: true, g: 0 });
    } else if (w.id === 'lance') {
      this.fireCool = 26;
      this.game.projectiles.push(new Projectile(this.game, m.x, m.y,
        this.facing * 6.4, 0, {
          team: 'player', kind: 'lance', damage: 5, w: 22, h: 8, color: '#ff5a6e',
          pierce: 99, life: 70, trail: true
        }));
      VZ.audio.sfx('chargeShot', { vol: 0.9 });
      VZ.audio.sfx('laser', { vol: 0.7 });
      FX.shake(2);
      this.vx -= this.facing * 1.0;
    }
  };

  // ------------------------------------------------------------- damage
  Player.prototype.takeHit = function (amount, srcX, force) {
    if (this.invuln > 0 || this.dead || this.game.playerControl === false) return;
    if (this.dashTime > 0 && !force) { /* dashing does not grant i-frames */ }
    var ds = VZ.DAMAGE_SCALE;
    var scale = ds[Math.min(ds.length - 1, this.game.stageIndex || 0)];
    amount = Math.max(1, Math.round(amount * scale));
    this.hp -= amount;
    this.invuln = P.IFRAMES;
    this.hurtTime = 22;
    this.dashTime = 0;
    this.charge = 0; this.chargeLevel = 0;
    var dir = srcX === undefined ? -this.facing : (this.x < srcX ? -1 : 1);
    this.vx = dir * 2.2;
    this.vy = -2.6;
    this.game.damageTaken += amount;
    VZ.audio.sfx('hurt');
    FX.stop(6);
    FX.shake(4);
    FX.flash('#ff4a5e', 0.24, 0.76);
    FX.burst(this.x, this.y, 10, { speed: 2.2, life: 20, size: 2, color: '#ff8fa0', glow: true });
    if (this.hp <= 0) { this.hp = 0; this.kill('damage'); }
  };

  Player.prototype.kill = function (cause) {
    if (this.dead) return;
    this.dead = true;
    this.hp = 0;
    this.deadTimer = 0;
    this.vx = 0; this.vy = 0;
    VZ.audio.sfx('bigExplode');
    FX.shake(6);
    FX.flash('#ffffff', 0.6);
    FX.explosion(this.x, this.y, 1.6, '#9fd8ff');
    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * Math.PI * 2;
      FX.spawn({ x: this.x, y: this.y, vx: Math.cos(a) * 2.4, vy: Math.sin(a) * 2.4,
        g: 0, drag: 0.99, life: 44, size: 3, color: '#9fd8ff', glow: true });
    }
    this.game.onPlayerDeath(cause);
  };

  Player.prototype.heal = function (n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
    VZ.audio.sfx('health');
  };
  Player.prototype.addEnergy = function (n) {
    this.energy = Math.min(P.MAX_ENERGY, this.energy + n);
    VZ.audio.sfx('pickup');
  };

  // --------------------------------------------------------------- render
  Player.prototype.pose = function () {
    if (this.warp > 0) return { t: 'torso_air', l: 'legs_jump' };
    if (this.hurtTime > 0) return { t: 'torso_hurt', l: 'legs_hurt' };
    if (this.dashTime > 0) return { t: 'torso_dash', l: 'legs_dash' };
    if (this.sliding) return { t: 'torso_wall', l: 'legs_wall', wall: true };
    if (!this.grounded) return { t: 'torso_air', l: this.vy < 0 ? 'legs_jump' : 'legs_fall' };
    // Absorb the impact for a few frames after a drop - reads as weight.
    if (this.landTimer > 0 && Math.abs(this.vx) < 1.2) {
      return { t: 'torso_idle', l: 'legs_kneel', crouch: 1 };
    }
    if (Math.abs(this.vx) > 0.4) return { t: 'torso_run', l: 'legs_run' + (Math.floor(this.runFrame) % 6) };
    return { t: 'torso_idle', l: 'legs_idle', idle: true };
  };

  Player.prototype.draw = function (ctx, camX, camY) {
    if (this.dead) return;
    var g = A.gfx, pfx = this.prefix || '';
    var p = this.pose();
    // While wall sliding the sprite faces away from the wall.
    var face = p.wall ? -this.wallDir : this.facing;
    var flip = face < 0;

    // Blink during invulnerability, but stay solid for the first moments.
    if (this.invuln > 0 && this.invuln < P.IFRAMES - 6 && (this.invuln >> 1) % 2 === 0) return;
    if (this.spawnTimer > 0 && (this.spawnTimer >> 1) % 2 === 0) {
      // materialise effect
    }

    var bob = p.idle ? (Math.floor(Math.sin(this.animTime * 0.06) * 1.4) > 0 ? 1 : 0) : 0;
    if (p.crouch) bob += 2;
    var footY = Math.round(this.bottom() - camY);
    var bx = Math.round(this.x - camX) - 8;

    // dash ghosts
    for (var i = 0; i < this.dashGhosts.length; i++) {
      var gh = this.dashGhosts[i];
      ctx.globalAlpha = (gh.life / 10) * 0.35;
      var gt = g[pfx + 'torso_dash' + (gh.f < 0 ? '_L' : '')];
      var gl = g[pfx + 'legs_dash' + (gh.f < 0 ? '_L' : '')];
      ctx.drawImage(gt, Math.round(gh.x - camX) - 8, Math.round(gh.y + this.h / 2 - camY) - 24);
      ctx.drawImage(gl, Math.round(gh.x - camX) - 8, Math.round(gh.y + this.h / 2 - camY) - 7);
      ctx.globalAlpha = 1;
    }

    var sfx2 = (flip ? '_L' : '');
    var hitSfx = this.flash > 0 ? (flip ? '_WL' : '_W') : sfx2;
    var torso = g[pfx + p.t + hitSfx] || g[pfx + p.t + sfx2];
    var legs = g[pfx + p.l + hitSfx] || g[pfx + p.l + sfx2];

    ctx.drawImage(legs, bx, footY - 7);
    ctx.drawImage(torso, bx, footY - 24 + bob);

    // buster arm overlay when firing or charging
    if (this.shootTimer > 0 || this.chargeLevel > 0) {
      var anchor = VZ.sprites.ARM[p.t] || { x: 9, y: 10 };
      var bimg = g[pfx + 'buster' + (flip ? '_L' : '')];
      var bw = bimg.width;
      var ax = flip ? (16 - anchor.x - bw) : anchor.x;
      ctx.drawImage(bimg, bx + ax, footY - 24 + anchor.y + bob);
    }

    // charge aura
    if (this.chargeLevel > 0) {
      var m = this.muzzle();
      var pulse = 3 + Math.sin(this.animTime * 0.4) * 1.2 + this.chargeLevel * 2.5;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = this.chargeLevel === 2 ? '#ffe9a0' : '#5fe6d8';
      ctx.beginPath();
      ctx.arc(Math.round(m.x - camX), Math.round(m.y - camY), pulse, 0, 7);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(Math.round(m.x - camX), Math.round(m.y - camY), pulse * 0.45, 0, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  };

  // ============================================================ PROJECTILES
  var Projectile = VZ.Projectile = function (game, x, y, vx, vy, o) {
    o = o || {};
    Entity.call(this, game, x, y, o.w || 6, o.h || 4);
    this.type = 'projectile';
    this.vx = vx; this.vy = vy;
    this.team = o.team || 'enemy';
    this.kind = o.kind || 'shot';
    this.level = o.level || 0;
    this.damage = o.damage || 1;
    this.color = o.color || (this.team === 'player' ? '#5fe6d8' : '#ff6a4a');
    this.life = o.life || 200;
    this.pierce = o.pierce || 0;
    this.hitList = [];
    this.gravityOn = o.gravity || 0;
    this.homing = o.homing || 0;
    this.trail = o.trail || false;
    this.wobble = o.wobble || 0;
    this.spin = 0;
    this.age = 0;
    this.destroyable = o.destroyable || false;
    this.onWall = o.onWall || 'die';
  };
  Projectile.prototype = Object.create(Entity.prototype);
  Projectile.prototype.constructor = Projectile;

  Projectile.prototype.update = function () {
    this.age++;
    if (this.gravityOn) this.vy += this.gravityOn;
    if (this.homing) {
      var p = this.game.player;
      if (p && !p.dead) {
        var want = Math.atan2(p.y - this.y, p.x - this.x);
        var cur = Math.atan2(this.vy, this.vx);
        var d = M.wrapPi(want - cur);
        var na = cur + M.clamp(d, -this.homing, this.homing);
        var sp = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
      }
    }
    if (this.wobble) this.vy += Math.sin(this.age * 0.24) * this.wobble;

    if (this.trail && this.age % 2 === 0) {
      FX.spawn({ x: this.x, y: this.y, vx: 0, vy: 0, g: 0, drag: 1, life: 9,
        size: 3, color: this.color, glow: true });
    }

    this.x += this.vx; this.y += this.vy;
    this.spin += 0.3;

    if (this.game.level.rectSolid(this.left(), this.top(), this.w, this.h)) {
      if (this.onWall === 'die') {
        this.burst();
        return;
      }
    }
    if (--this.life <= 0) { this.remove = true; return; }
    var lv = this.game.level;
    if (this.x < -40 || this.x > lv.pixelW + 40 || this.y < -80 || this.y > lv.pixelH + 80) {
      this.remove = true;
    }
  };

  Projectile.prototype.burst = function () {
    this.remove = true;
    var col = this.color;
    FX.burst(this.x, this.y, this.level >= 1 ? 8 : 4, {
      speed: 1.6 + this.level, life: 12, size: 1 + this.level, color: col, glow: true, g: 0.02
    });
    if (this.level === 2) {
      FX.ring(this.x, this.y, { grow: 2.2, life: 10, color: '#cffcff', width: 2 });
      FX.shake(1.2);
    }
  };

  Projectile.prototype.onHit = function (target) {
    if (this.pierce > 0) { this.pierce--; return false; }
    this.burst();
    return true;
  };

  Projectile.prototype.draw = function (ctx, camX, camY) {
    var x = Math.round(this.x - camX), y = Math.round(this.y - camY);
    var w = this.w, h = this.h;
    ctx.save();
    if (this.kind === 'lance') {
      ctx.globalAlpha = 0.5; ctx.fillStyle = this.color;
      ctx.fillRect(x - w / 2 - 3, y - h / 2 - 2, w + 6, h + 4);
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.color;
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - w / 2 + 2, y - 1, w - 4, 2);
    } else if (this.kind === 'buster' && this.level > 0) {
      var pulse = Math.sin(this.age * 0.6) * 1;
      ctx.globalAlpha = 0.4; ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.ellipse(x, y, w / 2 + 3 + pulse, h / 2 + 3 + pulse, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.ellipse(x, y, w / 2, h / 2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(x - Math.sign(this.vx) * 1, y, w / 4, h / 4, 0, 0, 7); ctx.fill();
    } else if (this.kind === 'spread') {
      ctx.fillStyle = this.color;
      ctx.fillRect(x - 3, y - 1, 6, 2);
      ctx.fillRect(x - 1, y - 3, 2, 6);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 1, y - 1, 2, 2);
    } else {
      ctx.globalAlpha = 0.45; ctx.fillStyle = this.color;
      ctx.fillRect(x - w / 2 - 1, y - h / 2 - 1, w + 2, h + 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.color;
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.fillStyle = '#ffe9c8';
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    ctx.restore();
  };

  // ================================================================ PICKUPS
  var Pickup = VZ.Pickup = function (game, x, y, kind) {
    var sz = kind === 'bigHealth' ? 14 : 10;
    Entity.call(this, game, x, y, sz, sz);
    this.type = 'pickup';
    this.kind = kind;
    this.gravity = 0.3;
    this.life = kind === 'drop' ? 420 : 1e9;
    this.bob = VZ.rand() * 6.28;
    this.settled = false;
  };
  Pickup.prototype = Object.create(Entity.prototype);
  Pickup.prototype.constructor = Pickup;

  Pickup.prototype.update = function () {
    if (!this.settled) {
      this.applyGravity();
      if (this.moveY(this.vy)) { this.vy = 0; this.settled = true; }
      this.moveX(this.vx);
      this.vx *= 0.92;
    }
    this.bob += 0.09;
    if (--this.life <= 0) this.remove = true;
    var p = this.game.player;
    if (p && !p.dead && VZ.aabb(this.box(), p.box())) this.collect(p);
  };

  Pickup.prototype.collect = function (p) {
    this.remove = true;
    // Placed pickups do not come back once taken; enemy drops have no def.
    if (this.def) { this.def.dead = true; this.def.live = null; }
    var g = this.game;
    switch (this.kind) {
      case 'health': p.heal(4); FX.popup(this.x, this.y - 8, '+4', '#ff8fa0'); break;
      case 'bigHealth': p.heal(10); FX.popup(this.x, this.y - 8, '+10', '#ff8fa0'); break;
      case 'energy': p.addEnergy(9); FX.popup(this.x, this.y - 8, 'ENERGY', '#5fe6d8'); break;
      case 'life':
        g.lives++; VZ.audio.sfx('checkpoint');
        FX.popup(this.x, this.y - 8, '1UP', '#ffd24a', { scale: 1 });
        break;
    }
    FX.burst(this.x, this.y, 8, { speed: 1.6, life: 16, size: 2, color: '#fff', glow: true, g: 0.05 });
  };

  Pickup.prototype.draw = function (ctx, camX, camY) {
    var img = A.gfx[this.kind === 'energy' ? 'pick_energy'
      : (this.kind === 'life' ? 'pick_life' : 'pick_health')];
    var oy = Math.sin(this.bob) * 1.5;
    var x = Math.round(this.x - camX - img.width / 2);
    var y = Math.round(this.y - camY - img.height / 2 + oy);
    if (this.life < 120 && (this.life >> 2) % 2 === 0) return;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = this.kind === 'energy' ? '#5fe6d8' : (this.kind === 'life' ? '#ffd24a' : '#ff5a6e');
    ctx.beginPath(); ctx.arc(x + img.width / 2, y + img.height / 2, 8, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    if (this.kind === 'bigHealth') {
      ctx.drawImage(img, 0, 0, img.width, img.height, x - 2, y - 2, img.width + 4, img.height + 4);
    } else {
      ctx.drawImage(img, x, y);
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
