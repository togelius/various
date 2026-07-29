/* VANGUARD ZERO - the play agent.
 *
 * Navigation is solved, not learned: a distance field plus an exact
 * short-horizon search over input programs. What IS evolved is everything the
 * search cannot model - how close to walk to an enemy, when to wait out a
 * flame vent, how to space a boss - carried in the `params` genome.
 *
 * Also records the telemetry the difficulty report is built from: every death,
 * every point of damage, and time spent, all bucketed by where it happened.
 *
 * Exposes window.AGENT.Pilot.
 */
(function (global) {
  'use strict';
  var AGENT = global.AGENT || (global.AGENT = {});
  var VZ = global.VZ;
  var T = VZ.TILE;

  AGENT.DEFAULTS = {
    wDist: 1.0,          // weight on progress toward the goal
    wTime: 0.55,         // frames are not free
    wSpike: 900,         // taking spike damage to save time is a bad trade
    wEnemy: 260,         // passing through or landing on an enemy
    wShot: 180,          // path crosses a live enemy shot
    enemyMargin: 5,      // slack around an enemy box when testing overlap
    wPit: 120,           // hovering over a pit is risky even if it works out
    wLook2: 1.0,         // weight on the follow-up move in the depth-2 search
    look2Gate: 60,       // depth-1 score below which one move is not enough
    look2Width: 6,       // how many depth-1 candidates get a follow-up search
    wCrumbleEnd: 500,    // resting on a block already counting down
    wCrumbleFresh: 25,   // a fresh one is usually the only way across
    crumbleHaste: 7,     // once standing on one, seconds cost far more
    spikeHaste: 12,      // and getting out of spikes is more urgent still
    wWait: 40,           // idling needs a reason
    stallFull: 90,       // frames of no progress before threats are discounted
    stallRelief: 0.85,   // how far the discount goes at full stall
    devX: 6, devY: 8,    // how far reality may drift before the plan is void
    fireOn: 5, fireOff: 3,
    chargeHold: 0,       // >0: hold fire to charge on approach
    flamerWait: 1,       // wait out a vent that is about to fire
    flamerLook: 46,
    bossMin: 60, bossMax: 120,
    bossWShot: 840,      // dodging in an arena is worth far more than in a
    bossWEnemy: 1320,     // corridor: there is nowhere else to be going
    bossJump: 42,        // jump cadence when the target is airborne
    bossHop: 26,         // hop cadence when something is incoming
    bossIdleJump: 150,
    bossFireOn: 5, bossFireOff: 3,
    bossAlign: 26,       // per-frame reward for time on the firing line
    bossBand: 260,       // reward for holding the working distance
    bossClear: 6,        // slack when predicting the boss body
    bossLook: 46,        // how far ahead a candidate move is evaluated
    bossCommit: 6,       // how much of it is actually executed before replanning
    bossCharge: 2,       // 0 fixed cadence, 1 charge only, 2 charge-and-tap
    retreatHp: 5,        // below this, back off from the boss
    searchJitter: 0
  };

  function snapshot(sim, game) {
    var p = game.player;
    var s = sim.newState(game.level, p.x, p.y);
    s.vx = p.vx; s.vy = p.vy;
    s.grounded = p.grounded; s.facing = p.facing;
    s.dashTime = p.dashTime; s.dashCool = p.dashCool; s.airDash = p.airDash;
    s.coyote = p.coyote; s.ctrlLock = p.ctrlLock;
    s.wallStick = p.wallStick; s.wallDir = p.wallDir;
    s.wallCoyote = p.wallCoyote; s.lastWall = p.lastWall; s.noCut = p.noCut;
    s.sliding = p.sliding;
    s.jumpBuf = VZ.input.buffer.jump;
    s.prevJump = VZ.input.held.jump; s.prevDash = VZ.input.held.dash;
    return s;
  }

  var Pilot = AGENT.Pilot = function (game, params) {
    this.g = game;
    this.p = Object.assign({}, AGENT.DEFAULTS, params || {});
    this.queue = [];
    this.frame = 0;
    this.field = null;
    this.fieldStage = -1;
    this.lastDecision = null;
    this.stuckFrames = 0;
    this.lastX = 0;
    this.bestDist = 1e18;
    this.stallFrames = 0;
    this.tele = {
      deaths: [], damage: [], stageTimes: {}, sectionFrames: {},
      bossAttempts: {}, bossDamage: {}, maxX: {}, cleared: [], notes: []
    };
    this.hook();
  };

  /* Record every hit and death at the position it happened.
   * The prototype is patched once per page, but each run installs itself as
   * the current recorder - otherwise every trial after the first writes its
   * telemetry into the first trial's object and the numbers come out empty. */
  Pilot.prototype.hook = function () {
    var g = this.g;
    AGENT._current = this;
    if (AGENT._hooked) return;
    AGENT._hooked = true;

    var origHit = VZ.Player.prototype.takeHit;
    VZ.Player.prototype.takeHit = function (amount, srcX, force) {
      var before = this.hp;
      origHit.call(this, amount, srcX, force);
      var self = AGENT._current;
      if (self && this === self.g.player && this.hp < before) {
        self.tele.damage.push({
          stage: self.g.stageIndex, x: Math.round(this.x), y: Math.round(this.y),
          amount: before - this.hp, boss: !!(self.g.boss && !self.g.boss.dying),
          section: self.section(this.x)
        });
      }
    };
    var origKill = VZ.Player.prototype.kill;
    VZ.Player.prototype.kill = function (cause) {
      var self = AGENT._current;
      if (self && this === self.g.player && !this.dead) {
        self.tele.deaths.push({
          stage: self.g.stageIndex, x: Math.round(this.x), y: Math.round(this.y),
          cause: cause, boss: !!(self.g.boss && !self.g.boss.dying),
          section: self.section(this.x)
        });
      }
      origKill.call(this, cause);
    };
  };

  // Sections are the 32-tile chunks the stages were authored in, which is also
  // how a designer thinks about them.
  Pilot.prototype.section = function (px) {
    return Math.floor(px / (32 * T));
  };

  Pilot.prototype.ensureField = function () {
    var g = this.g;
    if (this.fieldStage === g.stageIndex && this.field) return;
    var gate = g.level.bossGate;
    var gx = gate ? gate.tx + 2 : g.level.w - 3;
    var gy = gate ? gate.ty : 11;
    this.field = AGENT.plan.buildField(g.level, gx, gy);
    this.fieldStage = g.stageIndex;
  };

  // -------------------------------------------------------------- main tick
  Pilot.prototype.tick = function () {
    var g = this.g;
    this.frame++;
    var inp = {};

    if (g.state === 'results' || g.state === 'gameOver' || g.state === 'ending' ||
        g.state === 'title' || g.state === 'stageIntro') {
      // advance menus
      if (this.frame % 22 < 6) inp.jump = true;
      VZ.input.virtual = inp;
      return;
    }
    if (g.state !== 'play') { VZ.input.virtual = {}; return; }

    var p = g.player;
    if (!p || p.dead || p.warp > 0 || g.playerControl === false) {
      this.queue.length = 0;
      VZ.input.virtual = {};
      return;
    }

    // time accounting per section
    var sec = g.stageIndex + ':' + this.section(p.x);
    this.tele.sectionFrames[sec] = (this.tele.sectionFrames[sec] || 0) + 1;
    var mk = 's' + g.stageIndex;
    this.tele.maxX[mk] = Math.max(this.tele.maxX[mk] || 0, Math.round(p.x));

    if (g.boss && !g.boss.dying) {
      VZ.input.virtual = this.bossTick(p, g.boss);
      return;
    }

    this.ensureField();
    VZ.input.virtual = this.navTick(p);
  };

  // ------------------------------------------------------------ navigation
  Pilot.prototype.navTick = function (p) {
    var inp, prm0 = this.p;
    // A queued program is only valid while reality matches the simulation it
    // came from. Knockback from a hit is the usual way that stops being true,
    // and replaying the rest of a jump from the wrong place is how the agent
    // used to walk itself into pits.
    if (this.queue.length && this.expect && this.expect.length >= 2) {
      var ex = this.expect[0], ey = this.expect[1];
      if (p.hurtTime > 0 || Math.abs(p.x - ex) > prm0.devX || Math.abs(p.y - ey) > prm0.devY) {
        this.queue.length = 0;
        this.expect = null;
        this.aborts = (this.aborts || 0) + 1;
      } else {
        this.expect = this.expect.slice(2);
      }
    }
    if (this.queue.length === 0) this.decide(p);
    inp = this.queue.length ? this.queue.shift() : {};
    inp = Object.assign({}, inp);

    // shooting is free; always be firing
    var c = this.p.fireOn + this.p.fireOff;
    if ((this.frame % c) < this.p.fireOn) inp.fire = true;

    // stuck detector: if we have not moved in a while, clear the plan and
    // allow a wilder choice next time.
    if (Math.abs(p.x - this.lastX) < 0.3) {
      this.stuckFrames++;
      if (this.stuckFrames > 90) {
        this.queue.length = 0;
        this.stuckFrames = 0;
        this.jitterNext = true;
      }
    } else this.stuckFrames = 0;
    this.lastX = p.x;
    return inp;
  };

  // Is the tile under this point a crumbling block?
  Pilot.prototype.crumbleUnder = function (x, y) {
    var lv = this.g.level;
    var ty = Math.floor((y + VZ.P.H / 2 + 1) / T);
    var x0 = Math.floor((x - 5) / T), x1 = Math.floor((x + 5) / T);
    for (var tx = x0; tx <= x1; tx++) {
      if (tx < 0 || tx >= lv.w || ty < 0 || ty >= lv.h) continue;
      if (lv.grid[ty * lv.w + tx] === VZ.tiles.CRUMBLE) return tx + ',' + ty;
    }
    return null;
  };

  /* Is the drop below this point lethal? Scans down for lava before any
   * footing. Crumbling blocks do not count as footing here: they are the
   * whole reason the drop is a question. */
  Pilot.prototype.fatalBelow = function (x, y) {
    var lv = this.g.level, TL = VZ.tiles;
    var tx = Math.floor(x / T);
    var y0 = Math.floor((y + VZ.P.H / 2) / T);
    for (var ty = y0; ty < Math.min(lv.h, y0 + 14); ty++) {
      var id = lv.at(tx, ty);
      if (id === TL.LIQUID) return true;
      if (id === TL.CRUMBLE) continue;
      if (id === TL.PLATFORM || lv.solidAt(tx, ty)) return false;
    }
    return false;
  };

  Pilot.prototype.decide = function (p) {
    var g = this.g, S = AGENT.sim, PL = AGENT.plan, prm = this.p;
    var start = snapshot(S, g);
    var curDist = PL.distAt(this.field, p.x, p.y);
    if (curDist === null) curDist = 1e6;

    /* Crumbling blocks are solid to the collision model right up until they
     * vanish, so a plan made while standing on one is a plan made on a floor
     * that is already counting down. Weight time far higher while we are on
     * one, and refuse to come to rest on another. */
    var standingOn = this.crumbleUnder(p.x, p.y);
    var timeW = prm.wTime;
    if (standingOn !== null) timeW = prm.wTime * prm.crumbleHaste;
    // Standing in spikes costs 4hp every i-frame window, so getting out is
    // worth almost any amount of lost ground.
    var inSpikes = g.level.rectHazard(p.x - 4, p.y - 9, 8, 18) === 'spike';
    if (inSpikes) timeW = Math.max(timeW, prm.wTime * prm.spikeHaste);

    /* Dithering is the failure mode of any short-horizon planner. When every
     * move is bad, the least bad one is usually to not really move - and "not
     * really moving" keeps scoring well forever, so the agent shuffles on the
     * lip of a hazard until something kills it. That is exactly what happened
     * in front of the Void Citadel's spike beds: the dash-jump that clears
     * five tiles was found, priced against a drone hovering past the landing,
     * and rejected in favour of another half-step.
     *
     * So measure progress, not position: track the best cost-to-go actually
     * reached, and once it has not improved for a few seconds start
     * discounting the threat terms. Eventually taking the hit and getting
     * through outscores standing still, which is what a player concludes
     * after the third failed attempt too. */
    var dt = Math.max(1, this.frame - (this._lastDecideFrame || this.frame));
    this._lastDecideFrame = this.frame;
    // A respawn teleports us back to a checkpoint; that is not a stall.
    if (curDist > this.bestDist + 300) { this.bestDist = curDist; this.stallFrames = 0; }
    else if (curDist < this.bestDist - 2) { this.bestDist = curDist; this.stallFrames = 0; }
    else this.stallFrames += dt;
    var press = Math.min(1, this.stallFrames / prm.stallFull);
    var timid = 1 - press * prm.stallRelief;
    var wEnemy = prm.wEnemy * timid, wShot = prm.wShot * timid,
        wSpikeNow = prm.wSpike * timid;

    var enemies = [];
    for (var i = 0; i < g.enemies.length; i++) {
      var e = g.enemies[i];
      if (!e.dead) enemies.push(e);
    }

    var best = null, bestScore = -1e18, cands = [];
    for (var k = 0; k < PL.PRIMS.length; k++) {
      var prim = PL.PRIMS[k];
      var r = PL.rollout(S, start, prim);
      var score;
      if (r.dead) {
        score = -1e6;
      } else {
        var d = PL.distAt(this.field, r.s.body.x, r.s.body.y);
        if (d === null) score = -1e5;
        else score = (curDist - d) * prm.wDist;
        score -= r.s.frames * timeW;
        score -= (r.spikeHits || 0) * wSpikeNow;

        // Threats are scored by predicted box overlap along the whole path,
        // not by radius. A radius punishes clearing an enemy by jumping just
        // as hard as walking into it, which leaves the agent stuck behind
        // shielders forever.
        var ex = r.s.body.x, ey = r.s.body.y;
        var tj = r.traj || [];
        var mg = prm.enemyMargin;
        for (var q = 0; q < enemies.length; q++) {
          var en = enemies[q];
          var ehw = en.w / 2 + mg, ehh = en.h / 2 + mg;
          var hit = 0;
          for (var ti = 0; ti < tj.length; ti += 4) {
            if (Math.abs(en.x - tj[ti]) < ehw + VZ.P.W / 2 &&
                Math.abs(en.y - tj[ti + 1]) < ehh + VZ.P.H / 2) { hit = 1; break; }
          }
          if (!hit && Math.abs(en.x - ex) < ehw + VZ.P.W / 2 &&
              Math.abs(en.y - ey) < ehh + VZ.P.H / 2) hit = 1.4;
          if (hit) score -= wEnemy * hit;
        }
        // and against live shots
        for (var pj = 0; pj < g.projectiles.length; pj++) {
          var pr2 = g.projectiles[pj];
          if (pr2.team !== 'enemy' || pr2.remove) continue;
          for (var tk = 0; tk < tj.length; tk += 8) {
            var fx = pr2.x + pr2.vx * (tk / 2), fy = pr2.y + pr2.vy * (tk / 2);
            if (Math.abs(fx - tj[tk]) < 12 && Math.abs(fy - tj[tk + 1]) < 14) {
              score -= wShot;
              break;
            }
          }
        }
        // ending on the lip of a pit
        if (!this.groundBelow(ex, ey, 3)) score -= prm.wPit;
        /* Keeping a knockback's worth of margin from a lethal drop was tried
         * here and measured badly at every strength: over the Magma Foundry's
         * lava almost every foothold is a brink, so the rule stopped the agent
         * from crossing at all and it died to the flame vents instead (17
         * deaths -> 70). The crossing has no safe version; it is meant not to.
         */
        /* Crumbling blocks, along the whole path rather than just at the end.
         *
         * The simulator borrows the game's own collision, which treats a
         * crumbling block as solid until the frame it actually vanishes - so
         * a rollout will happily walk a plan across a block that has 6 frames
         * of life left and report a clean landing. Over the Magma Foundry's
         * lava that plan is a death, and it was the single biggest killer in
         * the run before this. So price the footing against its remaining
         * life at the moment the plan would be standing on it, and price it
         * as fatal where the drop is. */
        for (var cf = 0; cf < tj.length; cf += 8) {
          var ck2 = this.crumbleUnder(tj[cf], tj[cf + 1]);
          if (ck2 === null) continue;
          var t1 = this.g.level.crumble[ck2];
          var left = (t1 === undefined) ? 44 : t1;
          var atFrame = cf / 2;
          if (atFrame < left - 6) continue;              // still footing then
          score -= this.fatalBelow(tj[cf], tj[cf + 1]) ? prm.wCrumbleEnd
                                                       : prm.wCrumbleFresh;
          break;
        }
        // Coming to rest on one that is already counting down is its own
        // mistake even where the fall is survivable.
        if (r.s.grounded) {
          var ck = this.crumbleUnder(ex, ey);
          if (ck !== null) {
            var t0 = this.g.level.crumble[ck];
            score -= (t0 === undefined) ? prm.wCrumbleFresh : prm.wCrumbleEnd;
          }
        }
        if (prim.name === 'wait') score -= prm.wWait;
        // a vent about to go off where we are headed
        if (prm.flamerWait) {
          for (var v = 0; v < enemies.length; v++) {
            var fl = enemies[v];
            if (fl.flameH === undefined) continue;
            if (Math.abs(fl.x - ex) < prm.flamerLook &&
                (fl.firing || fl.charging) && ey > fl.y - 70) {
              score -= wEnemy * 1.5;
            }
          }
        }
      }
      if (this.jitterNext) score += (Math.random() - 0.5) * 400;
      cands.push({ r: r, score: score, name: prim.name });
      if (score > bestScore) { bestScore = score; best = r; this._pick = prim.name; }
    }
    this.jitterNext = false;
    this._lastCands = cands;

    /* Search one move deeper when one move is not enough to judge by.
     *
     * Two situations need it, and they look the same from here. Over lava the
     * question is not "does this jump land" but "does it land somewhere I can
     * leave again" - a crumbling block scores beautifully at depth one and
     * kills you at depth two, which is how runs kept ending in the Magma
     * Foundry. And in front of a five-tile spike bed there is no good first
     * move at all: every option either eats spikes or gives up ground, so the
     * agent walked in and bled out. Backing up only pays as the first half of
     * back-up-then-dash-jump, and only a two-move search can see that.
     *
     * The scores telescope: depth one already carries (curDist - d1) and its
     * own costs, so adding (d1 - d2) and r2's costs scores the pair against
     * the position we are actually standing in. */
    var badFirstMove = bestScore < prm.look2Gate;
    if (bestScore > -1e5 && (badFirstMove || this.fatalBelow(p.x, p.y))) {
      cands.sort(function (a, b) { return b.score - a.score; });
      var top = cands.slice(0, prm.look2Width), bestTotal = -1e18;
      for (var c = 0; c < top.length; c++) {
        var r1 = top[c].r, cont = -1e6;
        var d1 = PL.distAt(this.field, r1.s.body.x, r1.s.body.y);
        if (d1 === null) d1 = 1e6;
        for (var k2 = 0; k2 < PL.PRIMS.length; k2++) {
          var r2 = PL.rollout(S, r1.s, PL.PRIMS[k2]);
          if (r2.dead) continue;
          var d2 = PL.distAt(this.field, r2.s.body.x, r2.s.body.y);
          if (d2 === null) continue;
          var s2 = (d1 - d2) * prm.wDist - r2.s.frames * timeW -
                   (r2.spikeHits || 0) * wSpikeNow;
          // Landing the follow-up on another countdown block is not an escape.
          if (r2.s.grounded && this.crumbleUnder(r2.s.body.x, r2.s.body.y) !== null) {
            s2 -= prm.wCrumbleFresh;
          }
          if (s2 > cont) cont = s2;
        }
        var total = top[c].score + cont * prm.wLook2;
        if (total > bestTotal) { bestTotal = total; best = r1; bestScore = total; this._pick = top[c].name + '+2'; }
      }
    }

    if (best) {
      this.queue = best.inputs.slice();
      this.expect = best.traj ? best.traj.slice() : null;
      this.lastDecision = { score: bestScore, frames: best.s.frames, pick: this._pick };
    } else {
      this.queue = [{ right: true }];
      this.expect = null;
    }
  };

  /* Is there anything to land on below this point? One-way platforms count -
   * rectSolid alone excludes them, which made every ledge read as a pit. */
  Pilot.prototype.groundBelow = function (x, y, tiles) {
    var lv = this.g.level;
    var x0 = Math.floor((x - 5) / T), x1 = Math.floor((x + 5) / T);
    var y0 = Math.floor((y + VZ.P.H / 2) / T);
    for (var ty = y0; ty <= y0 + tiles; ty++) {
      for (var tx = x0; tx <= x1; tx++) {
        var id = lv.at(tx, ty);
        if (id === VZ.tiles.PLATFORM || lv.solidAt(tx, ty)) return true;
      }
    }
    return false;
  };

  // ------------------------------------------------------------------ boss
  /* Boss arenas are flat, so navigation is trivial and the whole problem is
   * positioning: don't be where a shot is about to be, do be at a height where
   * your own shots connect, and close the distance when the boss is open.
   * Same exact-rollout machinery as navigation, different objective. */
  Pilot.prototype.bossTick = function (p, b) {
    var prm = this.p, g = this.g;
    var key = 's' + g.stageIndex;
    if (!this.tele.bossAttempts[key]) this.tele.bossAttempts[key] = 0;
    if (!this._bossSeen) { this._bossSeen = true; this.tele.bossAttempts[key]++; }

    if (this.queue.length && this.expect && this.expect.length >= 2) {
      if (p.hurtTime > 0 || Math.abs(p.x - this.expect[0]) > prm.devX ||
          Math.abs(p.y - this.expect[1]) > prm.devY) {
        this.queue.length = 0; this.expect = null;
      } else this.expect = this.expect.slice(2);
    }
    if (this.queue.length > prm.bossCommit) this.queue.length = prm.bossCommit;
    if (this.queue.length === 0) this.bossDecide(p, b);

    var inp = this.queue.length ? Object.assign({}, this.queue.shift()) : {};

    // Shots come out along `facing`, which movement sets. Firing while running
    // away sends every shot into the far wall, so nudge the facing toward the
    // boss on frames the movement plan is not already steering.
    var toward = b.x > p.x ? 'right' : 'left';
    var away = b.x > p.x ? 'left' : 'right';
    if (!inp.left && !inp.right && !inp.jump) inp[toward] = true;

    /* "Lined up right now" and "this shot will connect" are different
     * questions. A charged shot crosses the arena at 4.6 px/frame, and
     * Vanguard Prime crosses it faster than that in the other direction - so
     * lead the target: work out when the shot arrives and test the boss's
     * position then, damped because it will not hold that heading forever. */
    var dir = b.x > p.x ? 1 : -1;
    var muzzleX = p.x + dir * 8, shotY = p.y - 1;
    var gap = Math.abs(b.x - muzzleX);
    var closing = Math.max(0.8, 4.6 + (b.x > p.x ? -b.vx : b.vx));
    var tHit = Math.min(60, gap / closing);
    var hitY = b.y + b.vy * tHit * 0.6;
    var aligned = p.facing === dir && gap > 14 && gap < 220 &&
                  Math.abs(shotY - hitY) < b.h / 2 + 7;
    if (prm.bossCharge > 1.5) {
      /* Mixed: charge while there is no shot to take, tap while there is.
       *
       * A bare shot is 2 damage on a 7-frame cooldown; a charged one is 8 for
       * a 70-frame wind-up. On paper the tap wins by 3x - the catch is the
       * three-live-shot cap, which binds at long range where the flight time
       * exceeds the cooldown. So: hold (and charge) whenever the line is not
       * open, which also means the first aligned frame dumps whatever charge
       * has accumulated, then fall into the tap cadence. */
      inp.fire = aligned ? (this.frame % 2 === 0) : true;
    } else if (prm.bossCharge > 0.5) {
      /* Hold for a full charge (4x damage) and spend it the moment the shot
       * will connect.
       *
       * Banking the charge for a high-armour window was tried and measured
       * much worse (Golem kill time 30s -> 58s): the Golem's double-damage
       * stun is too rare to wait for, so every banked 70-frame wind-up is
       * mostly dead time. Fire on sight is the better policy even against
       * plating. */
      if (p.chargeLevel >= 2 && aligned) inp.fire = false;
      else inp.fire = true;
    } else {
      var c = prm.bossFireOn + prm.bossFireOff;
      inp.fire = (this.frame % c) < prm.bossFireOn;
    }
    return inp;
  };

  Pilot.prototype.bossDecide = function (p, b) {
    var g = this.g, S = AGENT.sim, PL = AGENT.plan, prm = this.p;
    var start = snapshot(S, g);

    // The boss is open when it is stunned, venting, or mid-recovery: close in.
    // Windows where the boss is taking extra damage or cannot retaliate.
    var open = (b.stun > 0) || b.state === 'vent';

    /* Look far, commit little.
     *
     * The first version tied both to one number and every setting was a
     * compromise: short horizons reacted fast but could not see a shockwave
     * coming, long ones saw it and then rode a stale plan into it. Making the
     * window depend on the boss's current attack was tried and measured worse
     * on all three. The two knobs are simply independent - roll out deep
     * enough to evaluate the consequence, re-decide before it goes stale. */
    var look = prm.bossLook;
    var wantMin = open ? Math.max(18, prm.bossMin * 0.5) : prm.bossMin;
    var wantMax = open ? prm.bossMax * 0.7 : prm.bossMax;

    var shots = [];
    for (var i = 0; i < g.projectiles.length; i++) {
      var pr = g.projectiles[i];
      if (pr.team !== 'enemy' || pr.remove) continue;
      shots.push(pr);
    }

    var best = null, bestScore = -1e18;
    for (var k = 0; k < PL.PRIMS.length; k++) {
      var prim = PL.PRIMS[k];
      var r = PL.rollout(S, start, prim, look);
      var tj = r.traj || [];
      var score = 0;
      if (r.dead) { score = -1e6; }
      else {
        var ex = r.s.body.x, ey = r.s.body.y;

        /* Incoming fire, extrapolated. Debris that is still showing its
         * warning marker counts too - the marker is the whole point, and
         * ignoring it means standing exactly where the rock lands. */
        for (var q = 0; q < shots.length; q++) {
          var sp = shots[q];
          var delay = sp.warn > 0 ? sp.warn : 0;
          for (var ti = 0; ti < tj.length; ti += 2) {
            var f = ti / 2;
            if (f < delay) {
              // not falling yet, but the column it will occupy is not a
              // place to be standing when it arrives
              continue;
            }
            var af = f - delay;
            var fx = sp.x + sp.vx * af;
            var fy = sp.y + sp.vy * af + 0.5 * (sp.gravityOn || 0) * af * af;
            if (Math.abs(fx - tj[ti]) < sp.w / 2 + VZ.P.W / 2 + 3 &&
                Math.abs(fy - tj[ti + 1]) < sp.h / 2 + VZ.P.H / 2 + 3) {
              score -= prm.bossWShot;
              break;
            }
          }
        }
        /* The boss body, extrapolated. Testing against where it is standing
         * right now is fine for something that hovers, and useless against a
         * rival that crosses 200px mid-rollout - so carry its velocity
         * forward. Damped, because it will not hold that heading forever. */
        for (var t2 = 0; t2 < tj.length; t2 += 4) {
          var ff = t2 / 2;
          var damp = 1 / (1 + ff * 0.02);
          var bx = b.x + b.vx * ff * damp;
          var by = b.y + b.vy * ff * damp;
          if (Math.abs(bx - tj[t2]) < b.w / 2 + VZ.P.W / 2 + prm.bossClear &&
              Math.abs(by - tj[t2 + 1]) < b.h / 2 + VZ.P.H / 2 + prm.bossClear) {
            score -= prm.bossWEnemy;
            break;
          }
        }
        // the beam sweep is a column: never be under it
        if (b.beamOn) {
          for (var t3 = 0; t3 < tj.length; t3 += 4) {
            if (Math.abs(b.x - tj[t3]) < 16 && tj[t3 + 1] > b.y) { score -= 4000; break; }
          }
        }
        // Firing line: shots leave the muzzle throughout the move, not just
        // where it stops - and you cannot come to rest at a jump apex. So
        // reward time on target across the trajectory instead of the endpoint.
        var onTarget = 0;
        for (var t4 = 0; t4 < tj.length; t4 += 2) {
          var my = tj[t4 + 1] - 1;
          if (my > b.y - b.h / 2 - 3 && my < b.y + b.h / 2 + 3) {
            var adt = Math.abs(b.x - tj[t4]);
            if (adt > 14 && adt < 210) onTarget++;
          }
        }
        score += onTarget * prm.bossAlign;

        // stand-off band
        var adx = Math.abs(b.x - ex);
        if (adx < wantMin) score -= (wantMin - adx) * 4;
        else if (adx > wantMax) score -= (adx - wantMax) * 3;
        else score += prm.bossBand;

        if (p.hp <= prm.retreatHp && adx < wantMin * 1.6) score -= 400;
        score -= r.s.frames * 0.8;
        if (prim.name === 'wait') score -= prm.wWait;
      }
      if (score > bestScore) { bestScore = score; best = r; }
    }
    if (best) {
      this.queue = best.inputs.slice();
      this.expect = best.traj ? best.traj.slice() : null;
    } else {
      this.queue = [{}];
      this.expect = null;
    }
  };

  Pilot.prototype.reset = function () {
    this.queue.length = 0;
    this._bossSeen = false;
    this.bestDist = 1e18;
    this.stallFrames = 0;
  };

})(typeof window !== 'undefined' ? window : globalThis);
