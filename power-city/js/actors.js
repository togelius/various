/* POWER CITY - actors, the fight system, and the things lying in the street.
 *
 * The world is two and a half dimensions: `x` runs along the street, `y` is
 * how far up the pavement you are standing (a smaller y is further away), and
 * `z` is height off the ground. Everything sorts by y, collides in x/y, and
 * only jumps in z.
 *
 * A hit connects when the attacker's active frames overlap the target in all
 * three, and then the whole world stops for a few frames. That freeze is the
 * punch: take it out and the game feels like it is made of paper.
 */
(function (global) {
  'use strict';
  var PC = global.PC || (global.PC = {});
  var M = PC.math, Rig = PC.rig, FX = PC.fx;

  var GRAV = 0.30;
  var DEPTH_TOL = 11;

  // --------------------------------------------------------------- the world
  var W = PC.world = {
    actors: [], items: [], shots: [],
    camX: 0, lockX: 0, maxX: 2400, minX: 0,
    hitstop: 0, slowmo: 0, time: 0,
    theme: null, sky: null, facade: null,

    reset: function () {
      this.actors.length = 0; this.items.length = 0; this.shots.length = 0;
      this.camX = 0; this.hitstop = 0; this.time = 0;
      FX.reset();
    },

    add: function (a) { this.actors.push(a); return a; },
    addItem: function (it) { this.items.push(it); return it; },

    players: function () {
      var out = [];
      for (var i = 0; i < this.actors.length; i++) {
        if (this.actors[i].team === 0 && !this.actors[i].removed) out.push(this.actors[i]);
      }
      return out;
    },

    livePlayers: function () {
      var out = this.players(), r = [];
      for (var i = 0; i < out.length; i++) if (!out[i].dead) r.push(out[i]);
      return r;
    },

    enemies: function () {
      var out = [];
      for (var i = 0; i < this.actors.length; i++) {
        var a = this.actors[i];
        if (a.team === 1 && !a.removed && !a.dead) out.push(a);
      }
      return out;
    },

    // Nearest live player to a point - what every enemy brain asks for.
    nearestPlayer: function (x, y) {
      var ps = this.livePlayers(), best = null, bd = 1e9;
      for (var i = 0; i < ps.length; i++) {
        var d = Math.abs(ps[i].x - x) + Math.abs(ps[i].y - y) * 0.5;
        if (d < bd) { bd = d; best = ps[i]; }
      }
      return best;
    }
  };

  PC.freeze = function (frames) { if (frames > W.hitstop) W.hitstop = frames; };

  // ---------------------------------------------------------------- the actor
  function Actor(spec) {
    this.char = spec.char;
    this.team = spec.team || 0;
    this.x = spec.x || 0;
    this.y = spec.y || PC.FLOOR_BOT - 10;
    this.z = spec.z || 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.facing = spec.facing || 1;
    this.maxHp = spec.hp || 40;
    this.hp = this.maxHp;
    this.speed = spec.speed || 1.4;
    this.runSpeed = spec.runSpeed || 2.7;
    this.scale = (Rig.CHARS[this.char] || {}).scale || 1;
    this.hh = 40 * this.scale;          // hurt height
    this.hw = 7 * this.scale;           // half body width for pushing
    this.hd = 5;                        // half depth
    this.mass = spec.mass || 1;
    this.state = 'idle'; this.st = 0;
    this.anim = 0;
    this.atk = null; this.atkT = 0; this.hitList = null;
    this.combo = 0; this.comboT = 0;
    this.invuln = 0; this.flash = 0;
    this.dead = false; this.removed = false;
    this.deathT = 0;
    this.weapon = null; this.ammo = 0;
    this.carry = null;                  // a crate or drum held overhead
    this.grabbing = null; this.grabbedBy = null; this.grabT = 0;
    this.stunned = 0;
    this.score = spec.score || 100;
    this.name = spec.name || (Rig.CHARS[this.char] || {}).name || '?';
    this.armor = spec.armor || 0;       // hits absorbed without flinching
    this.armorLeft = this.armor;
    this.knockRes = spec.knockRes || 0; // 0..1, resistance to being knocked down
    this.blink = 0;
    this.aiTimer = 0;
    this.token = false;
  }
  PC.Actor = Actor;

  Actor.prototype.isBusy = function () {
    return this.state === 'attack' || this.state === 'hurt' || this.state === 'fall' ||
      this.state === 'down' || this.state === 'getup' || this.state === 'held' ||
      this.state === 'throwing' || this.state === 'dizzy';
  };

  Actor.prototype.canAct = function () {
    return !this.dead && !this.isBusy() && this.state !== 'jump';
  };

  Actor.prototype.setState = function (s) {
    if (this.state === s) return;
    this.state = s; this.st = 0;
  };

  // ------------------------------------------------------------------ attacks
  Actor.prototype.startAttack = function (def) {
    this.atk = def;
    this.atkT = 0;
    this.hitList = {};
    this.setState('attack');
    this.vx = 0;
    if (def.lunge) this.vx = this.facing * def.lunge;
    if (def.sfx && PC.audio) PC.audio.sfx(def.sfx);
  };

  Actor.prototype.attackPose = function () {
    var d = this.atk;
    if (!d) return 'idle';
    if (this.atkT < d.startup) return d.wind || d.pose;
    if (this.atkT < d.startup + d.active) {
      if (d.poses) return d.poses[Math.floor((this.atkT - d.startup) / (d.frameT || 4)) % d.poses.length];
      return d.pose;
    }
    return d.rec || d.pose;
  };

  // Where the fist/foot is right now, in world space - used for sparks.
  Actor.prototype.strikePoint = function () {
    var d = this.atk || {};
    var reach = d.reach ? d.reach[1] : 18;
    var dir = d.back ? -this.facing : this.facing;
    return {
      x: this.x + dir * (reach - 5),
      y: this.y - this.z - (d.zhi !== undefined ? (d.zlo + d.zhi) / 2 : 22) * this.scale
    };
  };

  Actor.prototype.hurtBox = function () {
    var lowProfile = (this.state === 'down' || (this.state === 'fall' && this.z <= 0.5));
    return {
      x0: this.x - this.hw - 2, x1: this.x + this.hw + 2,
      z0: this.z, z1: this.z + (lowProfile ? 12 : this.hh)
    };
  };

  /* Resolve one active attack against everyone who is not on its side. */
  Actor.prototype.resolveHits = function () {
    var d = this.atk;
    if (!d) return;
    if (this.atkT < d.startup || this.atkT >= d.startup + d.active) return;
    var near = d.reach[0], far = d.reach[1];
    // `back` swings behind you (the elbow), `sweep` reaches both ways (the
    // spin kick); everything else comes out of the front.
    var dir = d.back ? -this.facing : this.facing;
    var ax0, ax1;
    if (d.sweep) { ax0 = this.x - far; ax1 = this.x + far; }
    else if (dir > 0) { ax0 = this.x + near; ax1 = this.x + far; }
    else { ax0 = this.x - far; ax1 = this.x - near; }
    var az0 = this.z + (d.zlo === undefined ? 6 : d.zlo) * this.scale;
    var az1 = this.z + (d.zhi === undefined ? 34 : d.zhi) * this.scale;
    var i, t, hb;

    for (i = 0; i < W.actors.length; i++) {
      t = W.actors[i];
      if (t === this || t.removed || t.dead) continue;
      if (t.team === this.team && !d.friendly) continue;
      if (this.hitList[t._id === undefined ? (t._id = ++uid) : t._id]) continue;
      if (t.invuln > 0) continue;
      if (Math.abs(t.y - this.y) > (d.depth || DEPTH_TOL)) continue;
      hb = t.hurtBox();
      if (hb.x1 < ax0 || hb.x0 > ax1) continue;
      if (hb.z1 < az0 || hb.z0 > az1) continue;
      this.hitList[t._id] = true;
      this.land(t, d);
      if (!d.multi) break;
    }

    // Weapons and crates also smash the scenery lying around.
    if (d.breaks) {
      for (i = 0; i < W.items.length; i++) {
        var it = W.items[i];
        if (it.held || it.hp === undefined || it.dead) continue;
        if (Math.abs(it.y - this.y) > 14) continue;
        if (it.x < ax0 - 6 || it.x > ax1 + 6) continue;
        PC.items.damage(it, 1, this.facing);
      }
    }
  };

  var uid = 0;

  Actor.prototype.land = function (t, d) {
    var pt = this.strikePoint();
    var cx = M.clamp(pt.x, Math.min(this.x, t.x) - 6, Math.max(this.x, t.x) + 6);
    var cy = t.y - t.z - M.clamp((d.zhi === undefined ? 30 : d.zhi) * this.scale, 8, t.hh) * 0.75;
    var heavy = !!d.knock || d.dmg >= 12;

    t.takeHit({
      dmg: d.dmg, from: this, knock: d.knock, stun: d.stun || 14,
      push: d.push === undefined ? 1.6 : d.push, launch: d.launch,
      dir: this.facing, x: cx, y: cy, heavy: heavy
    });

    PC.freeze(d.stop || (heavy ? 7 : 4));
    FX.hit(cx, cy, heavy, d.spark);
    if (PC.audio) PC.audio.sfx(heavy ? 'hitHeavy' : 'hit');
    if (this.onHitLanded) this.onHitLanded(t, d);
  };

  Actor.prototype.takeHit = function (h) {
    if (this.dead || this.invuln > 0) return;
    var dmg = h.dmg * (this.dmgScale || 1);
    this.hp -= dmg;
    this.flash = 5;
    this.stunned = 0;

    if (this.grabbedBy) { this.grabbedBy.releaseGrab(); }
    if (this.grabbing) this.releaseGrab();
    if (this.carry) { PC.items.drop(this); }

    if (this.hp <= 0) {
      this.hp = 0;
      this.knockDown(h.dir, h.launch || { vx: 3.4, vz: 3.6 });
      this.dead = true;
      this.deathT = 0;
      if (this.onDeath) this.onDeath(h.from);
      return;
    }

    // Big enemies shrug off a couple of hits before they react at all.
    if (this.armorLeft > 0 && !h.knock) {
      this.armorLeft--;
      this.x += h.dir * 0.6;
      return;
    }
    this.armorLeft = this.armor;

    /* Four quick hits and the head goes. A dizzy enemy is stars, no guard,
     * and an open invitation to grab - which is how a beat 'em up teaches
     * you that its clinch exists. */
    this.recentHits = (W.time - (this.hitClock || -999) < 75) ? (this.recentHits || 0) + 1 : 1;
    this.hitClock = W.time;
    if (this.team === 1 && !this.isBoss && this.recentHits >= 4 && !h.knock) {
      this.recentHits = 0;
      this.atk = null;
      this.stunned = 1;
      this.dizzyT = 110;
      this.setState('dizzy');
      this.vx = h.dir * h.push * 0.6;
      if (W.dropToken) W.dropToken(this);
      return;
    }

    var knocked = h.knock && PC.rand() >= this.knockRes;
    if (knocked || this.z > 2) {
      this.knockDown(h.dir, h.launch || { vx: 2.9, vz: 3.4 });
    } else {
      this.atk = null;
      this.setState('hurt');
      this.hurtT = h.stun;
      this.vx = h.dir * h.push;
      this.facing = -h.dir;
      if (this.onHurt) this.onHurt(h);
    }
  };

  Actor.prototype.knockDown = function (dir, launch) {
    this.atk = null;
    this.setState('fall');
    this.vx = dir * launch.vx;
    this.vz = launch.vz;
    this.z = Math.max(this.z, 0.1);
    this.facing = -dir;
    this.bounced = false;
    if (this.onKnockdown) this.onKnockdown();
  };

  Actor.prototype.releaseGrab = function () {
    if (this.grabbing) {
      this.grabbing.grabbedBy = null;
      if (this.grabbing.state === 'held') this.grabbing.setState('idle');
      this.grabbing = null;
    }
    if (this.grabbedBy) {
      this.grabbedBy.grabbing = null;
      this.grabbedBy = null;
      if (this.state === 'held') this.setState('idle');
    }
    this.grabT = 0;
  };

  // ----------------------------------------------------------------- stepping
  Actor.prototype.update = function () {
    var i;
    if (this.flash > 0) this.flash--;
    if (this.invuln > 0) this.invuln--;
    if (this.comboT > 0) { this.comboT--; if (!this.comboT) this.combo = 0; }
    this.st++;
    this.anim++;

    if (this.dead) { this.updateDead(); return; }

    if (this.control) this.control();

    switch (this.state) {
      case 'attack':
        this.atkT++;
        this.resolveHits();
        this.vx *= 0.82;
        this.vy *= 0.7;
        if (this.atk && this.atkT >= this.atk.startup + this.atk.active + this.atk.recovery) {
          var nxt = this.atk.chain;
          this.atk = null;
          this.setState(this.z > 0 ? 'jump' : 'idle');
          if (nxt && this.onChainEnd) this.onChainEnd(nxt);
        }
        break;
      case 'hurt':
        this.vx *= 0.86; this.vy *= 0.8;
        if (--this.hurtT <= 0) this.setState('idle');
        break;
      case 'fall':
        this.vx *= 0.985;
        break;
      case 'down':
        this.vx *= 0.8;
        if (this.st > (this.downTime || 44)) { this.setState('getup'); this.invuln = 34; }
        break;
      case 'getup':
        this.vx *= 0.7;
        if (this.st > 22) { this.setState('idle'); this.invuln = 12; }
        break;
      case 'dizzy':
        this.vx *= 0.86; this.vy *= 0.8;
        if (--this.dizzyT <= 0) { this.stunned = 0; this.setState('idle'); }
        break;
      case 'held':
        this.vx = 0; this.vy = 0;
        break;
      default:
        break;
    }

    // ---- physics
    if (this.state === 'held' && this.grabbedBy) {
      var g = this.grabbedBy;
      this.x = g.x + g.facing * (11 * g.scale);
      this.y = g.y;
      this.facing = -g.facing;
      this.z = 0;
    } else {
      this.x += this.vx;
      this.y += this.vy;
      if (this.z > 0 || this.vz !== 0) {
        this.z += this.vz;
        this.vz -= GRAV;
        if (this.z <= 0) {
          this.z = 0;
          this.onLand();
        }
      }
    }

    // ---- bounds
    this.y = M.clamp(this.y, PC.FLOOR_TOP, PC.FLOOR_BOT);
    var lo = W.minX + 6, hi = W.maxX - 6;
    if (this.team === 0) { lo = Math.max(lo, W.camX + 8); hi = Math.min(hi, W.camX + PC.W - 8); }
    this.x = M.clamp(this.x, lo, hi);

    if (this.grabbing) {
      this.grabT++;
      if (this.grabbing.dead || this.grabT > 190) this.releaseGrab();
    }
  };

  Actor.prototype.onLand = function () {
    this.vz = 0;
    if (this.state === 'fall') {
      if (!this.bounced && Math.abs(this.vx) > 1.2) {
        this.bounced = true;
        this.vz = 1.5;
        this.z = 0.1;
        FX.dust(this.x, this.y, -M.sign(this.vx), 5);
        if (PC.audio) PC.audio.sfx('thud');
        return;
      }
      this.setState('down');
      this.vz = 0;
      FX.dust(this.x, this.y, -M.sign(this.vx), 4);
      if (PC.audio) PC.audio.sfx('thud');
      FX.shakeBy(2);
    } else if (this.state === 'jump' || this.state === 'attack') {
      if (this.state === 'attack' && this.atk && this.atk.air) this.atk = null;
      this.setState('idle');
      FX.dust(this.x, this.y, this.facing, 2);
    }
  };

  Actor.prototype.updateDead = function () {
    this.deathT++;
    // fall, lie there, then flicker out
    if (this.state === 'fall') {
      this.x += this.vx; this.vx *= 0.985;
      this.z += this.vz; this.vz -= GRAV;
      if (this.z <= 0) { this.z = 0; this.setState('down'); FX.dust(this.x, this.y, -M.sign(this.vx), 5); }
    } else {
      this.vx *= 0.8;
      this.x += this.vx;
    }
    if (this.deathT > 62) this.blink = 1;
    if (this.deathT > 96) this.removed = true;
  };

  // --------------------------------------------------------------- animation
  Actor.prototype.pose = function () {
    if (this.carry && (this.state === 'idle' || this.state === 'walk' || this.state === 'run')) return 'windup';
    switch (this.state) {
      case 'idle': return (this.anim % 48 < 24) ? 'idle' : 'idle2';
      case 'walk': return ['walk0', 'walk1', 'walk2', 'walk3'][Math.floor(this.anim / 7) % 4];
      case 'run': return ['run0', 'run1', 'run2', 'run3'][Math.floor(this.anim / 5) % 4];
      case 'attack': return this.attackPose();
      case 'hurt': return 'hurt';
      case 'dizzy': return 'dizzy';
      case 'fall': return this.z > 0.5 ? 'fall' : 'down';
      case 'down': return 'down';
      case 'getup': return 'getup';
      case 'jump': return 'jump';
      case 'grab': return 'grab';
      case 'held': return 'held';
      case 'throwing': return 'throwOut';
      case 'crouch': return 'crouch';
      case 'win': return 'win';
      default: return 'idle';
    }
  };

  Actor.prototype.draw = function (ctx, camX) {
    if (this.removed) return;
    if (this.blink && (this.deathT >> 1) % 2) return;
    var px = this.x - camX, py = this.y - this.z;
    var f;
    try { f = Rig.frame(this.char, this.pose()); }
    catch (e) { f = Rig.frame(this.char, 'idle'); }

    // shadow, always on the floor no matter how high the body is
    var sr = 8 * this.scale * (1 - Math.min(0.45, this.z / 90));
    PC.art.shadow(ctx, px, this.y, sr, 0.34 - Math.min(0.18, this.z / 260));

    var flipped = this.facing < 0;
    if (this.flash > 0 && (this.flash % 2)) {
      Rig.draw(ctx, f, px, py, flipped, Rig.flash(this.char, this.pose(), '#ffffff'));
    } else if (this.invuln > 0 && (this.anim >> 1) % 2 && this.team === 0 && this.state !== 'getup') {
      ctx.globalAlpha = 0.55;
      Rig.draw(ctx, f, px, py, flipped);
      ctx.globalAlpha = 1;
    } else {
      Rig.draw(ctx, f, px, py, flipped);
    }

    if (this.weapon) PC.items.drawHeld(ctx, this, f, px, py);
    if (this.carry) PC.items.drawCarried(ctx, this, px, py);
    if (this.stunned > 0) this.drawStars(ctx, px, py);
  };

  Actor.prototype.drawStars = function (ctx, px, py) {
    var n = 3;
    for (var i = 0; i < n; i++) {
      var a = this.anim * 0.11 + i * (Math.PI * 2 / n);
      var sx = px + Math.cos(a) * 9, sy = py - 44 * this.scale + Math.sin(a) * 3;
      PC.art.text(ctx, '★', sx - 2, sy, i % 2 ? '#ffe070' : '#ffffff');
    }
  };

  // ------------------------------------------------------- pushing each other
  W.separate = function () {
    var a, b, i, j, dx, dy, ov;
    for (i = 0; i < this.actors.length; i++) {
      a = this.actors[i];
      if (a.removed || a.state === 'held' || a.z > 6) continue;
      for (j = i + 1; j < this.actors.length; j++) {
        b = this.actors[j];
        if (b.removed || b.state === 'held' || b.z > 6) continue;
        if (a.dead && b.dead) continue;
        if (a.state === 'down' || b.state === 'down') continue;
        if (a.grabbing === b || b.grabbing === a) continue;
        dy = b.y - a.y;
        if (Math.abs(dy) > a.hd + b.hd) continue;
        dx = b.x - a.x;
        ov = (a.hw + b.hw) - Math.abs(dx);
        if (ov <= 0) continue;
        var push = ov * 0.24;
        var ma = b.mass / (a.mass + b.mass), mb = a.mass / (a.mass + b.mass);
        var s = dx === 0 ? (i % 2 ? 1 : -1) : M.sign(dx);
        a.x -= s * push * ma * 2;
        b.x += s * push * mb * 2;
      }
    }
  };

  // ------------------------------------------------------------------ stepping
  W.update = function () {
    var i;
    this.time++;
    if (this.hitstop > 0) {
      this.hitstop--;
      FX.update();
      return;
    }
    for (i = 0; i < this.actors.length; i++) this.actors[i].update();
    PC.items.update();
    this.separate();
    for (i = this.actors.length - 1; i >= 0; i--) if (this.actors[i].removed) this.actors.splice(i, 1);
    FX.update();
  };

})(typeof window !== 'undefined' ? window : globalThis);
