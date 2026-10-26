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
      dmg: 7, stun: 14, push: 1.1, stop: 4, sfx: 'swing', chain: 'cross', score: 20
    },
    cross: {
      pose: 'cross', startup: 3, active: 3, recovery: 8, reach: [4, 28], zlo: 14, zhi: 36,
      dmg: 8, stun: 15, push: 1.4, stop: 5, sfx: 'swing', chain: 'hook', score: 30
    },
    hook: {
      pose: 'hook', wind: 'windPunch', startup: 5, active: 4, recovery: 15, reach: [4, 27], zlo: 15, zhi: 40,
      dmg: 14, stun: 18, push: 3.6, knock: true, multi: true, depth: 22, launch: { vx: 4.0, vz: 3.6 }, stop: 8, sfx: 'swingHard', score: 60
    },
    upper: {
      pose: 'upper', wind: 'crouch', startup: 7, active: 4, recovery: 17, reach: [2, 25], zlo: 6, zhi: 44,
      dmg: 13, stun: 22, push: 1.2, knock: true, launch: { vx: 1.4, vz: 5.2 }, stop: 10,
      sfx: 'swingHard', lunge: 1.2, score: 80
    },
    kick: {
      pose: 'kick', wind: 'chamber', startup: 6, active: 6, recovery: 12, reach: [6, 36], zlo: 6, zhi: 30,
      dmg: 8, stun: 16, push: 2.7, stop: 6, sfx: 'swing', gb: true, score: 40
    },
    kickHigh: {
      pose: 'kickHigh', wind: 'chamber', startup: 7, active: 6, recovery: 16, reach: [6, 35], zlo: 18, zhi: 44,
      dmg: 11, stun: 20, push: 2.4, knock: true, stop: 8, sfx: 'swingHard', score: 70
    },
    elbow: {
      pose: 'elbow', back: true, startup: 4, active: 3, recovery: 13, reach: [2, 24], zlo: 12, zhi: 36,
      dmg: 9, stun: 18, push: 2.2, knock: true, stop: 8, sfx: 'swingHard', score: 70
    },
    spin: {
      poses: ['spin0', 'spin1'], wind: 'windSpin', frameT: 5, sweep: true, multi: true, escape: true,
      startup: 2, active: 12, recovery: 18, reach: [0, 43], depth: 32, zlo: 0, zhi: 48,
      dmg: 14, stun: 18, push: 3.6, knock: true, launch: { vx: 4.2, vz: 3.4 }, stop: 7, sfx: 'whoosh', score: 50
    },
    jumpKick: {
      pose: 'jumpKick', air: true, startup: 2, active: 20, recovery: 8, depth: 22, reach: [4, 32], zlo: -4, zhi: 30,
      dmg: 11, stun: 20, push: 2.8, knock: true, stop: 9, sfx: 'swingHard', score: 90
    },
    runKnee: {
      pose: 'knee', startup: 3, active: 8, recovery: 16, reach: [2, 24], zlo: 10, zhi: 36,
      dmg: 11, stun: 20, push: 3.2, knock: true, launch: { vx: 3.6, vz: 3.0 }, stop: 9, sfx: 'swingHard', lunge: 3.4, score: 80
    },
    knee: {
      pose: 'knee', startup: 4, active: 3, recovery: 10, reach: [4, 20], zlo: 10, zhi: 32,
      dmg: 7, stun: 10, push: 0, stop: 6, sfx: 'swing', grabMove: true, score: 40
    },
    batSwing: {
      pose: 'hook', wind: 'windOver', startup: 5, active: 5, recovery: 16, reach: [4, 40], zlo: 10, zhi: 42,
      dmg: 14, stun: 20, push: 3, knock: true, launch: { vx: 3.4, vz: 3.2 }, stop: 10, sfx: 'swingHard', breaks: true, score: 90
    },
    knifeStab: {
      pose: 'jab', startup: 3, active: 4, recovery: 9, reach: [4, 32], zlo: 14, zhi: 34,
      dmg: 10, stun: 14, push: 1.2, stop: 6, sfx: 'swing', spark: '#ff8888', score: 60
    },
    pipeSwing: {
      pose: 'hook', wind: 'windOver', startup: 5, active: 5, recovery: 15, reach: [4, 38], zlo: 10, zhi: 42,
      dmg: 12, stun: 18, push: 2.8, knock: true, launch: { vx: 3.4, vz: 3.2 }, stop: 9, sfx: 'swingHard', breaks: true, score: 80
    }
  };

  var WEAPON_MOVE = { bat: 'batSwing', pipe: 'pipeSwing', chain: 'pipeSwing', knife: 'knifeStab' };

  // ---------------------------------------------------------------- the player
  function Player(index, charKey) {
    PC.Actor.call(this, {
      char: charKey, team: 0, hp: 100, x: 60, y: PC.FLOOR_BOT - 14,
      speed: 2.0, runSpeed: 3.2, mass: 1.2
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
    this.hitChain = 0;
    this.chainT = 0;
    this.power = 100; this.powerHint = 0;
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
    this.power = Math.min(100, this.power + (d === MOVES.spin ? 0 : 8));
    /* The combo chain: every hit inside a rolling window keeps the count
     * climbing and the popups escalating. Getting hit resets it, which is
     * the other half of what the counter is for. */
    this.hitChain++;
    this.chainT = 75;
    if (this.hitChain >= 4) {
      var col = this.hitChain >= 12 ? '#ff4a4a' : (this.hitChain >= 8 ? '#ff8a20' : '#ffe070');
      FX.pop(t.x, t.y - t.hh - 10, this.hitChain + ' HITS', col, 'chain' + this.index);
    }
  };

  Player.prototype.onDeath = function () {
    if (PC.audio) PC.audio.sfx('playerDown');
  };

  /* Everything the player feels about being hit: the chain breaks, a hit
   * from behind flashes a marker so the flanker is found, and the encounter
   * loses its perfect flag. */
  Player.prototype.takeHit = function (h) {
    var rear = h.from && ((h.from.x - this.x) * this.facing < 0);
    var side = h.from ? (M.sign(h.from.x - this.x) || 1) : 1;
    var hp = this.hp;
    PC.Actor.prototype.takeHit.call(this, h);
    if (this.hp >= hp) return;                 // blocked by invulnerability or armor
    this.invuln = Math.max(this.invuln, 16);
    this.hitChain = 0;
    if (PC.stage && PC.stage.active) PC.stage.encHurt = true;
    if (rear) FX.rearHit(this.x, this.y, side);
  };

  // ------------------------------------------------------------------ control
  /* Buttons are read every frame, frozen or not. The world stops for a
   * hit-stop and for the slow-motion KO, and a press in those frames - the
   * very moment players mash for the next hit - used to vanish, because
   * only control() wrote the buffer and control() does not run while the
   * world is stopped. Presses now latch until the player next acts. */
  Player.prototype.readButtons = function () {
    var pr = PC.input.p[this.index].pressed, f = this.fresh || (this.fresh = {});
    // counted, not flagged: two mashed punches inside one freeze are two
    if (pr.punch) f.punch = (f.punch || 0) + 1;
    if (pr.kick) f.kick = (f.kick || 0) + 1;
    if (pr.jump) f.jump = (f.jump || 0) + 1;
  };

  Player.prototype.control = function () {
    // the fight is over and won: stand there with your arms up
    if (this.celebrate) {
      this.setState('win');
      this.vx = 0; this.vy = 0;
      this.fresh = {};
      return;
    }
    var inp = PC.input.p[this.index];
    var held = inp.held;
    var b = this.buffer, k, fresh = this.fresh || {};
    var q = this.queued || (this.queued = {});
    this.fresh = {};
    /* The follow-up queue. A button pressed once an attack has started to
     * land is held through that attack's recovery and comes out the moment
     * the fighter is free - pressing kick as the hook connects is the most
     * natural rhythm in the genre, and a 7-frame buffer against a 15-frame
     * recovery used to eat it. Presses during a wind-up decay as normal, so
     * mashing does not stack up phantom attacks. */
    var following = this.state === 'attack' && this.atk && this.atkT >= this.atk.startup;
    for (k in b) {
      if (this.state !== 'attack') q[k] = false;
      if (b[k] > 0 && !q[k]) b[k]--;
    }
    var pt = this.pressT || (this.pressT = {});
    if (fresh.punch) {
      b.punch = 7; q.punch = following; pt.punch = W.time;
      // a second press is held for the next link of the chain
      this.extraPunch = Math.min(1, fresh.punch - 1);
    }
    if (fresh.kick) { b.kick = 7; q.kick = following; pt.kick = W.time; }
    if (fresh.jump) { b.jump = 7; q.jump = following; pt.jump = W.time; }
    // Holding Attack is the basic combo, including during hit-stop and recovery.
    // Outside reach it lets the stick keep walking instead of punching empty air.
    var target = this.assistTarget();
    if (held.punch && (target || this.carry || this.grabbing || (!this.weapon && Items.nearest(this, 25)))) {
      b.punch = Math.max(b.punch, 2); q.punch = following;
    }
    this.power = Math.min(100, this.power + 0.42);
    if (this.powerHint > 0) this.powerHint--;
    var pressed = fresh;
    if (this.grabCool > 0) this.grabCool--;
    if (this.chainT > 0) { this.chainT--; if (!this.chainT) this.hitChain = 0; }

    if (this.dead) return;

    // Breakout is an explicit escape, usable even while staggered or grabbed.
    // A visible rechargeable meter pays for it; never health or a hidden chord.
    if (b.kick > 0 && this.z <= 1 && this.state !== 'fall' && this.state !== 'down' &&
        this.state !== 'getup' && !(this.state === 'attack' && this.atk === MOVES.spin)) {
      b.kick = 0;
      if (this.power >= 100) {
        this.releaseGrab();
        if (this.carry) Items.drop(this);
        this.power = 0;
        this.invuln = Math.max(this.invuln, 30);
        this.startAttack(MOVES.spin);
        FX.ring(this.x, this.y - 22, '#58e8ef');
        FX.pop(this.x, this.y - this.hh - 12, 'BREAKOUT!', '#58e8ef');
        return;
      }
      this.powerHint = 36;
    }

    /* Caught in a bear hug: mash your way out. Six presses or a couple of
     * seconds, whichever comes first - being held should be frightening, not
     * a place you sit and watch your health go. */
    if (this.state === 'held' && this.grabbedBy) {
      if (pressed.punch || pressed.kick || pressed.jump || (held.punch && this.st % 8 === 0)) this.escapeMash = (this.escapeMash || 0) + 1;
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

    if (this.state === 'attack' || this.state === 'hurt' || this.state === 'fall' ||
      this.state === 'down' || this.state === 'getup' || this.state === 'held') {
      // The only thing you may do mid-move is chain the next punch.
      if (this.state === 'attack' && b.punch > 0 && this.atk && this.atk.chain &&
        !this.chainBroken && this.atkT >= this.atk.startup + this.atk.active) {
        b.punch = 0;
        this.combo++;
        this.comboT = 40;
        this.startAttack(MOVES[this.atk.chain]);
        if (this.extraPunch > 0) { this.extraPunch--; b.punch = 7; q.punch = true; }
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
      // one air attack per jump: it used to be possible to kick twice
      if (!this.airAttacked && (this.st >= 4 || b.punch > 0)) {
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
      this.airAttacked = false;
      this.jumpId = (this.jumpId || 0) + 1;
      this.setState('jump');
      this.vx = (ax || this.facing) * this.speed * 1.2;
      this.vy = ay * this.speed * 0.6;
      if (PC.audio) PC.audio.sfx('jump');
      return;
    }

    // ---- punch button
    if (b.punch > 0) {
      b.punch = 0;
      if (this.carry) { Items.hurl(this); this.setState('throwing'); this.throwT = 10; return; }
      if (target) {
        var aim = PC.input.axis(this.index);
        if (!aim || (target.x - this.x) * aim > 0) this.facing = M.sign(target.x - this.x) || this.facing;
        if (Math.abs(target.y - this.y) <= 26) this.y = M.approach(this.y, target.y, 5);
        if (Math.abs(target.x - this.x) > 35 && Math.abs(target.x - this.x) < 85) this.x += this.facing * 5;
      }
      var pick = Items.nearest(this, 25);
      if (pick && !this.weapon && (pick.kind === 'pickup' || !this.nearFoe(28))) {
        if (Items.take(this, pick)) { this.setState('crouch'); this.crouchT = 10; return; }
      }
      if (this.weapon) { this.startAttack(MOVES[WEAPON_MOVE[this.weapon] || 'batSwing']); this.spendWeapon(); return; }
      var behind = this.foeBehind(26);
      if (behind && !this.nearFoe(26)) { this.startAttack(MOVES.elbow); return; }
      var clinch = this.grabTarget();
      if (clinch && clinch.state === 'dizzy' && this.grabCool <= 0) { this.beginGrab(clinch); this.throwVictim(clinch); return; }
      if (target && target.state === 'guard') { this.startAttack(MOVES.kick); return; }
      this.combo = this.comboT > 0 ? this.combo : 0;
      this.comboT = 40;
      this.startAttack(MOVES.jab);
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
    if (e.bowling) e.bowling = 3;   // a thrown body takes three with it
    PC.freeze(10);
    FX.shakeBy(4);
    if (PC.audio) PC.audio.sfx('throw');
    this.addScore(120);
  };

  // Select only plausible targets. A small lane correction forgives pixel-perfect
  // alignment without reaching across the street or reversing a held direction.
  Player.prototype.assistTarget = function () {
    var es = W.enemies(), best = null, distance = 1e9, ax = PC.input.axis(this.index);
    for (var i = 0; i < es.length; i++) {
      var e = es[i], dx = e.x - this.x, dy = Math.abs(e.y - this.y);
      if (e.state === 'fall' || e.state === 'down' || e.state === 'getup' || e.z > 20) continue;
      if (Math.abs(dx) > 86 || dy > 27 || (ax && dx * ax < -8)) continue;
      var score = Math.abs(dx) + dy * 2 + (dx * this.facing < 0 ? 16 : 0);
      if (score < distance) { best = e; distance = score; }
    }
    return best;
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
    this.power = 100; this.fresh = {}; this.queued = {}; this.buffer = { punch: 0, kick: 0, jump: 0 };
    this.releaseGrab(); this.atk = null;
    this.celebrate = false;
    this.weapon = null; this.weaponItem = null; this.carry = null;
  };

})(typeof window !== 'undefined' ? window : globalThis);
