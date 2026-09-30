/* POWER CITY - the gang, and the four people at the top of it.
 *
 * The rule that makes a brawler fair: only two of them may be attacking at
 * once. Everyone else circles, shuffles into a free lane, or waits at arm's
 * length looking menacing. Take the token system out and eight thugs all
 * punch you on the same frame, which is not difficulty, it is arithmetic.
 */
(function (global) {
  'use strict';
  var PC = global.PC || (global.PC = {});
  var M = PC.math, FX = PC.fx, W = PC.world, Items = PC.items;

  // ---------------------------------------------------------- attack tokens
  /* The rule that makes a brawler fair: only a few of them may be swinging
   * at once. Everyone else circles, shuffles into a free lane, or waits at
   * arm's length looking menacing. But the cap has to grow with the crowd,
   * or eight thugs turn into a queue. */
  W.tokens = 2;
  W.tokenCount = function () {
    var n = 2, alive = 0;
    for (var i = 0; i < this.actors.length; i++) {
      var a = this.actors[i];
      if (a.team === 1 && !a.removed && !a.dead) alive++;
    }
    if (alive >= 4) n++;
    if (PC.stage && PC.stage.index >= 2) n++;
    if (PC.game && PC.game.livePlayerCount && PC.game.livePlayerCount() > 1) n++;
    return n;
  };
  W.tokenHolders = [];
  W.claimToken = function (e) {
    var i = this.tokenHolders.indexOf(e);
    if (i >= 0) return true;
    for (i = this.tokenHolders.length - 1; i >= 0; i--) {
      var h = this.tokenHolders[i];
      if (h.removed || h.dead || (h.state !== 'attack' && h.tokenT-- <= 0)) this.tokenHolders.splice(i, 1);
    }
    if (this.tokenHolders.length >= this.tokenCount()) return false;
    e.tokenT = 70;
    this.tokenHolders.push(e);
    return true;
  };
  W.dropToken = function (e) {
    var i = this.tokenHolders.indexOf(e);
    if (i >= 0) this.tokenHolders.splice(i, 1);
  };

  // ------------------------------------------------------------ enemy moves
  var EM = PC.ENEMY_MOVES = {
    jab: { pose: 'jab', startup: 8, active: 3, recovery: 16, reach: [4, 24], zlo: 14, zhi: 36, dmg: 5, stun: 12, push: 1.2, stop: 4, sfx: 'swing' },
    hook: { pose: 'hook', startup: 11, active: 4, recovery: 22, reach: [4, 26], zlo: 14, zhi: 40, dmg: 8, stun: 16, push: 2, knock: true, stop: 7, sfx: 'swingHard' },
    kick: { pose: 'kick', startup: 12, active: 4, recovery: 22, reach: [6, 32], zlo: 6, zhi: 30, dmg: 7, stun: 15, push: 2.4, stop: 6, sfx: 'swing' },
    jumpKick: { pose: 'jumpKick', air: true, startup: 2, active: 24, recovery: 4, reach: [4, 30], zlo: -4, zhi: 30, dmg: 9, stun: 18, push: 2.6, knock: true, stop: 8, sfx: 'swingHard' },
    batSwing: { pose: 'hook', startup: 14, active: 5, recovery: 24, reach: [4, 40], zlo: 10, zhi: 42, dmg: 11, stun: 18, push: 2.6, knock: true, stop: 8, sfx: 'swingHard', breaks: true },
    knifeStab: { pose: 'jab', startup: 9, active: 4, recovery: 18, reach: [4, 32], zlo: 14, zhi: 34, dmg: 8, stun: 14, push: 1.4, stop: 6, sfx: 'swing', spark: '#ff8888' },
    slam: { pose: 'hook', startup: 16, active: 5, recovery: 30, reach: [4, 32], zlo: 4, zhi: 44, dmg: 14, stun: 24, push: 3.4, knock: true, stop: 11, sfx: 'swingHard' },
    charge: { pose: 'knee', startup: 6, active: 30, recovery: 26, reach: [2, 26], zlo: 8, zhi: 40, dmg: 13, stun: 22, push: 3.6, knock: true, stop: 10, sfx: 'swingHard', lunge: 4.2 },
    pound: { pose: 'upper', startup: 10, active: 8, recovery: 34, sweep: true, multi: true, reach: [0, 40], zlo: 0, zhi: 20, dmg: 12, stun: 22, push: 3, knock: true, stop: 10, sfx: 'boom' },
    chainSweep: { poses: ['spin0', 'spin1'], frameT: 6, sweep: true, multi: true, startup: 12, active: 22, recovery: 26, reach: [0, 38], zlo: 8, zhi: 40, dmg: 10, stun: 20, push: 3, knock: true, stop: 8, sfx: 'whoosh' },
    upper: { pose: 'upper', startup: 12, active: 4, recovery: 26, reach: [2, 24], zlo: 6, zhi: 44, dmg: 12, stun: 22, knock: true, launch: { vx: 1.4, vz: 5 }, stop: 10, sfx: 'swingHard' },
    spin: { poses: ['spin0', 'spin1'], frameT: 5, sweep: true, multi: true, startup: 8, active: 18, recovery: 22, reach: [0, 30], zlo: 10, zhi: 40, dmg: 9, stun: 18, push: 2.6, knock: true, stop: 7, sfx: 'whoosh' }
  };

  // ------------------------------------------------------------- enemy types
  var TYPES = PC.ENEMY_TYPES = {
    punk: {
      char: 'punk', hp: 24, speed: 1.05, score: 200, standoff: 18,
      moves: ['jab', 'jab', 'hook', 'kick'], aggr: 0.7, downTime: 32
    },
    rough: {
      char: 'rough', hp: 24, speed: 1.35, score: 300, standoff: 20,
      moves: ['jab', 'kick', 'kick'], aggr: 0.85, jumpy: 0.3, downTime: 28
    },
    knifer: {
      char: 'knifer', hp: 24, speed: 1.2, score: 400, standoff: 22, weapon: 'knife',
      moves: ['knifeStab', 'knifeStab', 'kick'], aggr: 0.75, thrower: 0.25, downTime: 30
    },
    batter: {
      char: 'batter', hp: 34, speed: 1.0, score: 400, standoff: 26, weapon: 'bat',
      moves: ['batSwing', 'batSwing', 'kick'], aggr: 0.7, downTime: 34
    },
    brute: {
      char: 'brute', hp: 64, speed: 0.9, score: 700, standoff: 20, mass: 2.2, armor: 2,
      knockRes: 0.55, moves: ['slam', 'hook', 'hook'], aggr: 0.6, grabber: 0.35, downTime: 40
    }
  };

  var BOSSES = PC.BOSS_TYPES = {
    crusher: {
      char: 'boss_crusher', hp: 120, speed: 0.9, score: 5000, standoff: 24, mass: 3.4,
      armor: 2, knockRes: 0.7, boss: true, downTime: 36,
      moves: ['slam', 'hook', 'hook'], aggr: 0.7, grabber: 0.3,
      phases: [
        { at: 0.55, speedMul: 1.2, addMoves: ['charge'], name: 'CRUSHER SEES RED' },
        { at: 0.25, speedMul: 1.25, aggrMul: 1.2, addMoves: ['pound'], name: 'CRUSHER SEES RED' }
      ]
    },
    viper: {
      char: 'boss_viper', hp: 100, speed: 1.3, score: 6000, standoff: 26, mass: 1.4,
      armor: 1, knockRes: 0.35, boss: true, weapon: 'chain', downTime: 30,
      moves: ['kick', 'jab', 'chainSweep'], aggr: 0.9, jumpy: 0.25, retreat: 0.12,
      phases: [
        { at: 0.5, speedMul: 1.15, addMoves: ['jumpKick'], name: 'VIPER UNSPOOLS' },
        { at: 0.22, speedMul: 1.25, aggrMul: 1.15, addMoves: ['upper'], name: 'VIPER UNSPOOLS' }
      ]
    },
    jaws: {
      char: 'boss_jaws', hp: 130, speed: 1.15, score: 7000, standoff: 26, mass: 2.4,
      armor: 1, knockRes: 0.45, boss: true, downTime: 34,
      moves: ['spin', 'hook', 'kick'], aggr: 0.85, grabber: 0.25,
      phases: [
        { at: 0.55, speedMul: 1.15, addMoves: ['charge'], name: 'JAWS LOSES IT' },
        { at: 0.25, speedMul: 1.25, addMoves: ['slam'], name: 'JAWS LOSES IT' }
      ]
    },
    power: {
      char: 'boss_power', hp: 150, speed: 1.3, score: 12000, standoff: 24, mass: 2,
      armor: 1, knockRes: 0.5, boss: true, downTime: 30,
      moves: ['jab', 'hook', 'spin', 'upper'], aggr: 0.9, jumpy: 0.2, retreat: 0.15,
      phases: [
        { at: 0.66, speedMul: 1.15, addMoves: ['charge'], name: 'MR. POWER LOSES PATIENCE' },
        { at: 0.33, speedMul: 1.3, aggrMul: 1.2, addMoves: ['slam'], name: 'MR. POWER LOSES PATIENCE' }
      ]
    }
  };

  // ---------------------------------------------------------------- the enemy
  function Enemy(typeKey, spec) {
    var t = TYPES[typeKey] || BOSSES[typeKey];
    if (!t) throw new Error('unknown enemy ' + typeKey);
    spec = spec || {};
    PC.Actor.call(this, {
      char: t.char, team: 1, hp: Math.round(t.hp * (spec.hpScale || 1)),
      x: spec.x || 0, y: spec.y || PC.FLOOR_BOT - 20,
      speed: t.speed, mass: t.mass || 1, score: t.score,
      armor: t.armor || 0, knockRes: t.knockRes || 0
    });
    this.type = typeKey;
    /* The type table is shared by every instance; give this one its own
     * moves list so phases can add to it without leaking into the next. */
    this.T = {};
    for (var k in t) this.T[k] = t[k];
    this.T.moves = t.moves.slice();
    this.isBoss = !!t.boss;
    this.phaseIndex = 0;
    this.baseSpeed = this.speed;
    this.baseAggr = (t.aggr || 0.5) * (spec.aggrScale || 1);
    this.aggr = this.baseAggr;
    this.downTime = t.downTime || 44;
    this.think = 0;
    this.intent = 'approach';
    this.lane = 0;
    this.tokenT = 0;
    this.dmgScale = 1;
    this.facing = spec.facing || -1;
    this.spawnFade = 0;
    this.spawnGuard = 0;
    this.atkCool = 0;
    this.roarT = 0;
    if (t.weapon) {
      var it = Items.spawn('weapon', t.weapon, this.x, this.y);
      Items.take(this, it);
    }
    if (this.isBoss) { this.tag = t.tagName || (PC.rig.CHARS[t.char] || {}).name; this.tagCol = '#ff5f6a'; }
  }
  Enemy.prototype = Object.create(PC.Actor.prototype);
  Enemy.prototype.constructor = Enemy;
  PC.Enemy = Enemy;

  Enemy.prototype.onDeath = function (killer) {
    W.dropToken(this);
    if (killer && killer.addScore) killer.addScore(this.score);
    FX.pop(this.x, this.y - this.hh - 4, this.score, '#ffe070');
    if (this.weaponItem) { Items.drop(this); }
    if (PC.audio) PC.audio.sfx(this.isBoss ? 'bossDown' : 'ko');
    if (PC.game) PC.game.enemyDown(this);
    if (this.isBoss) { FX.shakeBy(7); FX.flash('#ffffff', 6); }
  };

  Enemy.prototype.onKnockdown = function () { W.dropToken(this); };

  // ------------------------------------------------------------------- brain
  Enemy.prototype.control = function () {
    if (this.dead) return;
    /* Phase changes: the fight turns halfway, loudly, and on purpose. */
    if (this.isBoss && this.T.phases) {
      while (this.phaseIndex < this.T.phases.length &&
        this.hp / this.maxHp <= this.T.phases[this.phaseIndex].at) {
        this.enterPhase(this.T.phases[this.phaseIndex]);
        this.phaseIndex++;
      }
    }
    if (this.spawnGuard > 0) this.spawnGuard--;
    /* Mid-roar: the taunt pose plays out and nothing else does. */
    if (this.roarT > 0) {
      this.roarT--;
      this.vx = 0; this.vy = 0;
      this.setState('taunt');
      return;
    }
    if (this.state === 'held') { this.vx = 0; return; }
    if (this.hold > 0) { this.hold--; this.vx *= 0.7; this.vy *= 0.7; this.setState('idle'); return; }
    if (!this.canAct()) return;
    if (this.z > 0) return;

    var p = W.nearestPlayer(this.x, this.y);
    if (!p) { this.setState('idle'); this.vx *= 0.8; this.vy *= 0.8; return; }

    var dx = p.x - this.x, dy = p.y - this.y;
    var adx = Math.abs(dx);
    this.facing = dx === 0 ? this.facing : M.sign(dx);

    if (--this.think <= 0) this.decide(p, adx, dy);

    var t = this.T;
    var standoff = t.standoff;
    var speed = this.speed;

    switch (this.intent) {
      case 'approach': {
        var wantX = p.x - this.facing * standoff * 0.86;
        var wantY = p.y + this.lane;
        var mx = M.clamp((wantX - this.x) * 0.1, -1, 1);
        var my = M.clamp((wantY - this.y) * 0.1, -1, 1);
        if (Math.abs(wantX - this.x) < 2) mx = 0;
        if (Math.abs(wantY - this.y) < 2) my = 0;
        this.vx = mx * speed;
        this.vy = my * speed * 0.66;
        this.setState((mx || my) ? 'walk' : 'idle');
        if (adx < standoff + 6 && Math.abs(dy) < 11) this.tryAttack(p, adx);
        break;
      }
      case 'wait': {
        // hold just outside your reach, drifting in your lane, briefly
        var backX = p.x - this.facing * (standoff + 8);
        this.vx = M.clamp((backX - this.x) * 0.05, -1, 1) * speed * 0.7;
        this.vy = M.clamp((p.y + this.lane - this.y) * 0.06, -1, 1) * speed * 0.5;
        this.setState(Math.abs(this.vx) + Math.abs(this.vy) > 0.15 ? 'walk' : 'idle');
        break;
      }
      case 'flank': {
        var fx = p.x + this.facing * standoff;   // cross to the other side
        this.vx = M.clamp((fx - this.x) * 0.12, -1, 1) * speed;
        this.vy = M.clamp((p.y + this.lane - this.y) * 0.1, -1, 1) * speed * 0.7;
        this.setState('walk');
        break;
      }
      case 'retreat': {
        this.vx = -this.facing * speed * 0.85;
        this.vy = M.clamp(this.lane, -1, 1) * speed * 0.4;
        this.setState('walk');
        break;
      }
      case 'grab': {
        var gx = p.x - this.facing * 12;
        this.vx = M.clamp((gx - this.x) * 0.15, -1, 1) * speed * 1.15;
        this.vy = M.clamp((p.y - this.y) * 0.12, -1, 1) * speed * 0.8;
        this.setState('walk');
        if (adx < 15 && Math.abs(dy) < 8 && !p.invuln && p.state !== 'down' && p.state !== 'fall') {
          this.doGrab(p);
        }
        break;
      }
    }
  };

  /* A boss at half health is a different fight: faster, meaner, and new
   * moves on the table. The world stops for the roar so the player sees
   * the turn happen. */
  Enemy.prototype.enterPhase = function (ph) {
    var i;
    for (i = 0; i < (ph.addMoves || []).length; i++) {
      if (this.T.moves.indexOf(ph.addMoves[i]) < 0) this.T.moves.push(ph.addMoves[i]);
    }
    if (ph.speedMul) this.speed = this.baseSpeed * ph.speedMul;
    if (ph.aggrMul) this.aggr = Math.min(1, this.baseAggr * ph.aggrMul);
    this.atk = null;
    this.roarT = 40;
    this.invuln = 46;
    FX.shakeBy(6);
    FX.flash('#ffd0d0', 4);
    PC.freeze(20);
    FX.pop(this.x, this.y - this.hh - 18, '!!', '#ff5f6a');
    if (PC.audio) PC.audio.sfx('roar');
    if (PC.stage) { PC.stage.bossBanner = 100; PC.stage.bossSub = ph.name; }
  };

  Enemy.prototype.decide = function (p, adx, dy) {
    var t = this.T, r = PC.rand;
    this.think = r.int(14, 32);
    this.lane = r.range(-13, 13);

    if (t.grabber && r.chance(t.grabber) && adx < 60) { this.intent = 'grab'; this.think = 50; return; }
    if (t.thrower && this.weapon && r.chance(t.thrower) && adx > 40 && adx < 150) {
      Items.hurl(this);
      this.setState('throwing'); this.hold = 22;
      this.intent = 'approach';
      return;
    }
    if (t.jumpy && r.chance(t.jumpy) && adx > 34 && adx < 90) {
      this.vz = 4.4; this.z = 0.1;
      this.setState('jump');
      this.vx = this.facing * this.speed * 2;
      this.startAttack(EM.jumpKick);
      this.intent = 'approach';
      return;
    }
    if (t.retreat && r.chance(t.retreat) && adx < 30) { this.intent = 'retreat'; this.think = r.int(12, 24); return; }

    /* The gang presses: approach is the default, a short shuffle the rest of
     * the time. Nobody orbits a fight for half a minute again. */
    if (r.chance(this.aggr)) this.intent = 'approach';
    else this.intent = r.chance(0.25) ? 'flank' : 'wait';
  };

  Enemy.prototype.tryAttack = function (p, adx) {
    /* Nobody swings at a fighter on the floor - they square up and wait,
     * which reads as menace instead of cruelty. */
    if (p.state === 'down' || p.state === 'fall' || p.state === 'getup') return;
    if (this.spawnGuard > 0) return;
    if (this.atkCool > 0) { this.atkCool--; return; }
    var name = PC.rand.pick(this.T.moves);
    var mv = EM[name];
    if (!mv) return;
    if (adx > (mv.reach[1] - 4)) return;
    if (!W.claimToken(this)) return;
    this.startAttack(mv);
    this.atkCool = PC.rand.int(8, 22);
    this.think = mv.startup + mv.active + mv.recovery + 8;
  };

  Enemy.prototype.doGrab = function (p) {
    if (this.spawnGuard > 0 || p.invuln > 0 || p.grabbedBy) return;
    this.grabbing = p;
    p.grabbedBy = this;
    p.setState('held');
    p.atk = null;
    p.escapeMash = 0;
    this.setState('grab');
    this.grabT = 0;
    this.squeezeT = 26;
    this.intent = 'approach';
    if (PC.audio) PC.audio.sfx('grab');
  };

  /* Held by a brute: it squeezes on a timer, and you get out by mashing.
   * Runs from the enemy side so the player's own control loop stays simple. */
  var baseUpdate = PC.Actor.prototype.update;
  Enemy.prototype.update = function () {
    if (this.grabbing && !this.dead) {
      var v = this.grabbing;
      this.setState('grab');
      if (--this.squeezeT <= 0) {
        this.squeezeT = 30;
        v.takeHit({
          dmg: 6, from: this, knock: false, stun: 6, push: 0, dir: this.facing,
          x: v.x, y: v.y - 24, heavy: false
        });
        if (v.grabbedBy === this && !v.dead) { v.setState('held'); v.grabbedBy = this; }
        FX.hit(v.x, v.y - 24, false);
        PC.freeze(4);
        if (PC.audio) PC.audio.sfx('hit');
      }
      if (v.dead || this.grabT > 150) {
        // toss them clear when done
        var dir = this.facing;
        this.releaseGrab();
        if (!v.dead) {
          v.takeHit({
            dmg: 8, from: this, knock: true, stun: 20, push: 3, dir: dir,
            x: v.x, y: v.y - 24, heavy: true, launch: { vx: 4, vz: 3.2 }
          });
        }
        this.hold = 24;
      }
    }
    baseUpdate.call(this);
  };

  // --------------------------------------------------------------- spawning
  PC.spawnEnemy = function (typeKey, x, y, opts) {
    var e = new Enemy(typeKey, { x: x, y: y, facing: opts && opts.facing, hpScale: opts && opts.hpScale });
    if (opts && opts.aggrScale) e.aggr *= opts.aggrScale;
    if (opts && opts.dmgScale) e.dmgScale = opts.dmgScale;
    W.add(e);
    return e;
  };

})(typeof window !== 'undefined' ? window : globalThis);
