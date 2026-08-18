/* POWER CITY - the player character and everything the buttons do.
 *
 * Two buttons and a jump, and out of them: a three-hit combo that ends in a
 * knockdown, a kick, an uppercut, a back elbow for whoever crept up behind
 * you, a running knee, a jump kick, a spin kick that clears a crowd, and a
 * clinch you can knee or throw out of. Beat 'em ups live or die on how much
 * vocabulary two buttons can carry.
 */
(function (global) {
  'use strict';
  var PC = global.PC || (global.PC = {});
  var M = PC.math, FX = PC.fx, W = PC.world, Items = PC.items;

  var MOVES = PC.MOVES = {
    jab: {
      pose: 'jab', startup: 3, active: 3, recovery: 7, reach: [4, 25], zlo: 14, zhi: 36,
      dmg: 5, stun: 12, push: 1.1, stop: 4, sfx: 'swing', chain: 'cross', score: 20
    },
    cross: {
      pose: 'cross', startup: 3, active: 3, recovery: 8, reach: [4, 28], zlo: 14, zhi: 36,
      dmg: 6, stun: 13, push: 1.4, stop: 5, sfx: 'swing', chain: 'hook', score: 30
    },
    hook: {
      pose: 'hook', startup: 5, active: 4, recovery: 15, reach: [4, 27], zlo: 15, zhi: 40,
      dmg: 10, stun: 18, push: 2.2, knock: true, stop: 9, sfx: 'swingHard', score: 60
    },
    upper: {
      pose: 'upper', wind: 'crouch', startup: 7, active: 4, recovery: 18, reach: [2, 23], zlo: 6, zhi: 44,
      dmg: 12, stun: 22, push: 1.2, knock: true, launch: { vx: 1.4, vz: 5.2 }, stop: 10,
      sfx: 'swingHard', score: 80
    },
    kick: {
      pose: 'kick', startup: 6, active: 4, recovery: 14, reach: [6, 34], zlo: 6, zhi: 30,
      dmg: 8, stun: 16, push: 2.7, stop: 6, sfx: 'swing', score: 40
    },
    kickHigh: {
      pose: 'kickHigh', startup: 8, active: 4, recovery: 17, reach: [6, 35], zlo: 18, zhi: 44,
      dmg: 11, stun: 20, push: 2.4, knock: true, stop: 8, sfx: 'swingHard', score: 70
    },
    elbow: {
      pose: 'elbow', back: true, startup: 4, active: 3, recovery: 13, reach: [2, 24], zlo: 12, zhi: 36,
      dmg: 9, stun: 18, push: 2.2, knock: true, stop: 8, sfx: 'swingHard', score: 70
    },
    spin: {
      poses: ['spin0', 'spin1'], frameT: 5, sweep: true, multi: true,
      startup: 4, active: 20, recovery: 18, reach: [0, 30], zlo: 10, zhi: 40,
      dmg: 7, stun: 18, push: 2.6, knock: true, stop: 6, sfx: 'whoosh', score: 50
    },
    jumpKick: {
      pose: 'jumpKick', air: true, startup: 2, active: 22, recovery: 4, reach: [4, 32], zlo: -4, zhi: 30,
      dmg: 12, stun: 20, push: 2.8, knock: true, stop: 9, sfx: 'swingHard', score: 90
    },
    runKnee: {
      pose: 'knee', startup: 3, active: 8, recovery: 16, reach: [2, 24], zlo: 10, zhi: 36,
      dmg: 11, stun: 20, push: 3.2, knock: true, stop: 9, sfx: 'swingHard', lunge: 3.4, score: 80
    },
    knee: {
      pose: 'knee', startup: 4, active: 3, recovery: 10, reach: [4, 20], zlo: 10, zhi: 32,
      dmg: 7, stun: 10, push: 0, stop: 6, sfx: 'swing', grabMove: true, score: 40
    },
    batSwing: {
      pose: 'hook', startup: 5, active: 5, recovery: 16, reach: [4, 40], zlo: 10, zhi: 42,
      dmg: 14, stun: 20, push: 3, knock: true, stop: 10, sfx: 'swingHard', breaks: true, score: 90
    },
    knifeStab: {
      pose: 'jab', startup: 3, active: 4, recovery: 9, reach: [4, 32], zlo: 14, zhi: 34,
      dmg: 10, stun: 14, push: 1.2, stop: 6, sfx: 'swing', spark: '#ff8888', score: 60
    },
    pipeSwing: {
      pose: 'hook', startup: 5, active: 5, recovery: 15, reach: [4, 38], zlo: 10, zhi: 42,
      dmg: 12, stun: 18, push: 2.8, knock: true, stop: 9, sfx: 'swingHard', breaks: true, score: 80
    }
  };

  var WEAPON_MOVE = { bat: 'batSwing', pipe: 'pipeSwing', chain: 'pipeSwing', knife: 'knifeStab' };

  // ---------------------------------------------------------------- the player
  function Player(index, charKey) {
    PC.Actor.call(this, {
      char: charKey, team: 0, hp: 100, x: 60, y: PC.FLOOR_BOT - 14,
      speed: 1.45, runSpeed: 2.85, mass: 1.2
    });
    this.index = index;
    this.lives = 3;
    this.score = 0;
    this.credits = 0;
    this.joined = false;
    this.runT = 0;
    this.buffer = { punch: 0, kick: 0, jump: 0 };
    this.grabCool = 0;
    this.kneeCount = 0;
    this.downTime = 30;
    this.dmgScale = 1;
    this.respawnT = 0;
    this.hitsLanded = 0;
  }
  Player.prototype = Object.create(PC.Actor.prototype);
  Player.prototype.constructor = Player;
  PC.Player = Player;

  Player.prototype.addScore = function (n) {
    this.score += n;
    if (PC.game) PC.game.noteScore(this.index, this.score);
  };

  Player.prototype.onHitLanded = function (t, d) {
    this.addScore(d.score || 20);
    this.hitsLanded++;
  };

  Player.prototype.onDeath = function () {
    if (PC.audio) PC.audio.sfx('playerDown');
  };

  // ------------------------------------------------------------------ control
  Player.prototype.control = function () {
    // the fight is over and won: stand there with your arms up
    if (this.celebrate) {
      this.setState('win');
      this.vx = 0; this.vy = 0;
      return;
    }
    var inp = PC.input.p[this.index];
    var held = inp.held, pressed = inp.pressed;
    var b = this.buffer, k;
    for (k in b) if (b[k] > 0) b[k]--;
    if (pressed.punch) b.punch = 7;
    if (pressed.kick) b.kick = 7;
    if (pressed.jump) b.jump = 7;
    if (this.grabCool > 0) this.grabCool--;

    if (this.dead) return;

    /* Caught in a bear hug: mash your way out. Six presses or a couple of
     * seconds, whichever comes first - being held should be frightening, not
     * a place you sit and watch your health go. */
    if (this.state === 'held' && this.grabbedBy) {
      if (pressed.punch || pressed.kick || pressed.jump) this.escapeMash = (this.escapeMash || 0) + 1;
      if (PC.input.axis(this.index) === -this.facing && this.st % 8 === 0) this.escapeMash = (this.escapeMash || 0) + 1;
      if ((this.escapeMash || 0) >= 6) {
        var g = this.grabbedBy;
        this.releaseGrab();
        if (g) { g.hold = 20; g.setState('idle'); }
        this.invuln = 26;
        FX.dust(this.x, this.y, this.facing, 4);
        if (PC.audio) PC.audio.sfx('escape');
      }
      return;
    }

    // ---- grappling takes over the whole button map while it lasts
    if (this.grabbing) { this.grabControl(b, held); return; }

    // ---- the spin kick is both buttons at once. The window is two frames,
    // not the whole buffer, or every fast punch-then-kick becomes a spin.
    if (b.punch >= 5 && b.kick >= 5 && this.canAct() && this.z <= 0) {
      b.punch = b.kick = 0;
      this.startAttack(MOVES.spin);
      return;
    }

    if (this.state === 'attack' || this.state === 'hurt' || this.state === 'fall' ||
      this.state === 'down' || this.state === 'getup' || this.state === 'held') {
      // The only thing you may do mid-move is chain the next punch.
      if (this.state === 'attack' && b.punch > 0 && this.atk && this.atk.chain &&
        this.atkT >= this.atk.startup + this.atk.active) {
        b.punch = 0;
        this.combo++;
        this.comboT = 40;
        this.startAttack(MOVES[this.atk.chain]);
      }
      return;
    }

    // recovery frames from a throw or a pick-up: nothing to do but finish
    if (this.state === 'throwing' || this.state === 'crouch') {
      var key = this.state === 'throwing' ? 'throwT' : 'crouchT';
      this.vx *= 0.7; this.vy *= 0.7;
      if (--this[key] <= 0) this.setState('idle');
      return;
    }

    var ax = PC.input.axis(this.index), ay = PC.input.axisY(this.index);

    // ---- airborne
    if (this.z > 0 || this.state === 'jump') {
      if (ax) { this.vx = M.approach(this.vx, ax * this.speed * 1.15, 0.22); this.facing = ax; }
      if ((b.punch > 0 || b.kick > 0)) {
        b.punch = b.kick = 0;
        this.startAttack(MOVES.jumpKick);
        this.vx = this.facing * Math.max(1.6, Math.abs(this.vx));
      }
      return;
    }

    // ---- jump
    if (b.jump > 0) {
      b.jump = 0;
      this.vz = 4.7;
      this.z = 0.1;
      this.setState('jump');
      this.vx = ax * this.speed * 1.2;
      this.vy = ay * this.speed * 0.6;
      if (PC.audio) PC.audio.sfx('jump');
      return;
    }

    // ---- punch button
    if (b.punch > 0) {
      b.punch = 0;
      if (this.carry) { Items.hurl(this); this.setState('throwing'); this.throwT = 10; return; }
      var pick = Items.nearest(this, 16);
      if (pick && !this.weapon && (pick.kind === 'pickup' || !this.nearFoe(28))) {
        if (Items.take(this, pick)) { this.setState('crouch'); this.crouchT = 10; return; }
      }
      if (this.weapon) { this.startAttack(MOVES[WEAPON_MOVE[this.weapon] || 'batSwing']); this.spendWeapon(); return; }
      var behind = this.foeBehind(26);
      if (behind && !this.nearFoe(26)) { this.startAttack(MOVES.elbow); return; }
      if (ay < 0) { this.startAttack(MOVES.upper); return; }
      var clinch = this.grabTarget();
      if (clinch && this.grabCool <= 0 && this.combo === 0) { this.beginGrab(clinch); return; }
      if (this.runT > 6) { this.startAttack(MOVES.runKnee); this.runT = 0; return; }
      this.combo = this.comboT > 0 ? this.combo : 0;
      this.comboT = 40;
      this.startAttack(MOVES.jab);
      return;
    }

    // ---- kick button
    if (b.kick > 0) {
      b.kick = 0;
      if (this.carry) { Items.hurl(this); this.setState('throwing'); this.throwT = 10; return; }
      if (this.weapon) {
        // A weapon you throw is a weapon you no longer have.
        Items.hurl(this);
        this.setState('throwing'); this.throwT = 10;
        return;
      }
      if (ay < 0) { this.startAttack(MOVES.kickHigh); return; }
      this.startAttack(MOVES.kick);
      return;
    }

    // ---- moving
    // double-tap to run, and keep running while the stick stays over
    if (inp.tapDir && inp.tapDir === ax) this.runT = 1;
    if (this.runT > 0) {
      if (ax !== M.sign(this.vx || ax) || !ax) this.runT = 0;
      else this.runT++;
    }
    var running = this.runT > 0;
    var sp = running ? this.runSpeed : this.speed;

    if (ax || ay) {
      var dx = ax * sp, dy = ay * sp * 0.62;
      if (ax && ay) { dx *= 0.85; dy *= 0.85; }
      this.vx = dx; this.vy = dy;
      if (ax) this.facing = ax;
      this.setState(running ? 'run' : 'walk');
      if (running && this.anim % 8 === 0) FX.dust(this.x - this.facing * 6, this.y, -this.facing, 1);
    } else {
      this.vx *= 0.5; this.vy *= 0.5;
      this.setState('idle');
      this.runT = 0;
    }
  };

  Player.prototype.spendWeapon = function () {
    if (!this.weapon) return;
    this.ammo--;
    if (this.ammo <= 0) {
      // it breaks in your hands on the last swing
      var it = this.weaponItem;
      this.weapon = null; this.weaponItem = null;
      if (it) { it.dead = true; FX.dust(this.x + this.facing * 12, this.y - 20, this.facing, 5); }
    }
  };

  // ------------------------------------------------------------------ clinch
  Player.prototype.grabTarget = function () {
    var es = W.enemies(), best = null, bd = 15;
    for (var i = 0; i < es.length; i++) {
      var e = es[i];
      if (e.state === 'down' || e.state === 'fall' || e.z > 6 || e.noGrab) continue;
      if (Math.abs(e.y - this.y) > 10) continue;
      var dx = (e.x - this.x) * this.facing;
      // a dizzy one can be taken from a step further out
      var range = e.state === 'dizzy' ? bd + 8 : bd;
      if (dx < -4 || dx > range) continue;
      bd = dx; best = e;
    }
    return best;
  };

  Player.prototype.beginGrab = function (e) {
    this.grabbing = e;
    e.grabbedBy = this;
    e.setState('held');
    e.atk = null;
    this.setState('grab');
    this.grabT = 0;
    this.kneeCount = 0;
    if (PC.audio) PC.audio.sfx('grab');
  };

  Player.prototype.grabControl = function (b, held) {
    var e = this.grabbing;
    if (!e || e.dead || e.removed) { this.releaseGrab(); return; }
    this.setState('grab');
    this.vx = 0; this.vy = 0;

    if (b.kick > 0) {
      b.kick = 0;
      this.throwVictim(e);
      return;
    }
    if (b.punch > 0) {
      b.punch = 0;
      this.kneeCount++;
      var d = MOVES.knee;
      e.takeHit({
        dmg: d.dmg, from: this, knock: false, stun: 8, push: 0, dir: this.facing,
        x: e.x, y: e.y - 22, heavy: false
      });
      // knees do not free them - the third one does
      if (e.grabbedBy !== this) { e.grabbedBy = this; e.setState('held'); }
      PC.freeze(5);
      FX.hit(e.x, e.y - 22, false);
      if (PC.audio) PC.audio.sfx('hit');
      this.addScore(d.score);
      this.grabT = 0;
      if (this.kneeCount >= 3 || e.dead) this.throwVictim(e);
      return;
    }
    // pull away to let go
    if (PC.input.axis(this.index) === -this.facing) { this.releaseGrab(); this.grabCool = 24; }
  };

  Player.prototype.throwVictim = function (e) {
    var dir = this.facing;
    this.releaseGrab();
    this.setState('throwing');
    this.throwT = 16;
    this.grabCool = 26;
    e.x = this.x + dir * 14;
    e.z = 14;
    e.takeHit({
      dmg: 16, from: this, knock: true, stun: 24, push: 3, dir: dir,
      x: e.x, y: e.y - 24, heavy: true, launch: { vx: 4.4, vz: 3.4 }
    });
    e.thrownBy = this;
    e.isThrown = true;
    PC.freeze(10);
    FX.shakeBy(4);
    if (PC.audio) PC.audio.sfx('throw');
    this.addScore(120);
  };

  // ------------------------------------------------------------------ helpers
  Player.prototype.nearFoe = function (range) {
    var es = W.enemies();
    for (var i = 0; i < es.length; i++) {
      var e = es[i];
      if (Math.abs(e.y - this.y) > 12) continue;
      if ((e.x - this.x) * this.facing > 0 && Math.abs(e.x - this.x) < range) return e;
    }
    return null;
  };

  Player.prototype.foeBehind = function (range) {
    var es = W.enemies();
    for (var i = 0; i < es.length; i++) {
      var e = es[i];
      if (Math.abs(e.y - this.y) > 12) continue;
      if (e.state === 'down' || e.state === 'fall') continue;
      if ((e.x - this.x) * this.facing < 0 && Math.abs(e.x - this.x) < range) return e;
    }
    return null;
  };

  // ------------------------------------------------------------------ lifespan
  Player.prototype.reviveAt = function (x, y) {
    this.hp = this.maxHp;
    this.dead = false; this.removed = false; this.blink = 0; this.deathT = 0;
    this.x = x; this.y = y; this.z = 0;
    this.vx = this.vy = this.vz = 0;
    this.state = 'idle'; this.st = 0;
    this.invuln = 110;
    this.combo = 0; this.runT = 0;
    this.celebrate = false;
    this.weapon = null; this.weaponItem = null; this.carry = null;
  };

})(typeof window !== 'undefined' ? window : globalThis);
