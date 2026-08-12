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
    wDamage: 90,         // per hp the projected world says this move costs
    wPit: 120,           // hovering over a pit is risky even if it works out
    wWait: 40,           // idling needs a reason
    commitFrames: 90,    // how much of a multi-move plan is executed as one
    /* Depth is what this search needs, not width. Measured on the Void
     * Citadel's spike corridor: 50 nodes / beam 14 died 5 times a run, 120
     * nodes / beam 50 died 4, and 200 nodes / beam 20 died 0.3. Narrow and
     * deep wins, because the plans that matter there are three and four moves
     * long and no amount of breadth at depth one can represent them. */
    searchNodes: 200,    // macro-action expansions per decision
    searchDepth: 6,      // how many moves deep they may go
    searchBeam: 20,      // successors kept per expansion
    worldLook: 150,      // frames of enemy/boss behaviour projected per decision
    worldRadius: 320,    // beyond this nothing can reach us inside the horizon
    wCrumbleEnd: 500,    // resting on a block already counting down
    wCrumbleFresh: 25,   // a fresh one is usually the only way across
    crumbleHaste: 7,     // once standing on one, seconds cost far more
    spikeHaste: 12,      // and getting out of spikes is more urgent still
    devX: 6, devY: 8,    // how far reality may drift before the plan is void
    fireOn: 5, fireOff: 3,
    bossMin: 60, bossMax: 120,
    bossWDamage: 260,    // an arena has nowhere else to be, so a hit costs more
    bossFireOn: 5, bossFireOff: 3,
    bossAlign: 26,       // per-frame reward for time on the firing line
    bossBand: 260,       // reward for holding the working distance
    bossLook: 46,        // how far ahead a candidate move is evaluated
    bossCommit: 6,       // how much of it is actually executed before replanning
    bossCharge: 2,       // 0 fixed cadence, 1 charge only, 2 charge-and-tap
    retreatHp: 5,        // below this, back off from the boss
    /* Reaction latency, in frames. The agent normally plans from the state as
     * it is this instant, which no person can do. Raising this makes it plan
     * from the state as it was N frames ago while still acting now - the same
     * loop delay a human hand-eye path has - and sweeping it is how the
     * difficulty report separates a section that punishes reflexes from one
     * that punishes not knowing the level. */
    latency: 0,
    /* Set to test whether shooting is worth doing at all: the agent plays
     * exactly as it otherwise would, but never pulls the trigger. If the two
     * configurations score the same, the game is not rewarding combat. */
    noShoot: 0,
    /* Dexterity error, after Isaksen et al. by way of Talakat: the agent is
     * forced to repeat its action for a number of frames drawn from a
     * gaussian, and this is that gaussian's standard deviation. A high
     * dexterity player repeats fewer frames. It is a motor-bandwidth limit
     * rather than an information one - unlike `latency` it corrupts execution
     * itself, every frame, rather than only the moments between plans. */
    dexSigma: 0,
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
      bossAttempts: {}, bossDamage: {}, maxX: {}, cleared: [], notes: [],
      actions: {}, pickups: [], kills: 0
    };
    // Its own stream, so clumsiness never perturbs the world being measured.
    this._rng = VZ.RNG(0xd0d0 + ((this.p.dexSigma * 1000) | 0));
    this._holdLeft = 0; this._held = {};
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
    VZ.Player.prototype.takeHit = function (amount, srcX, force, src) {
      var before = this.hp;
      origHit.call(this, amount, srcX, force, src);
      var self = AGENT._current;
      if (self && this === self.g.player && this.hp < before) {
        self.tele.damage.push({
          stage: self.g.stageIndex, x: Math.round(this.x), y: Math.round(this.y),
          amount: before - this.hp, boss: !!(self.g.boss && !self.g.boss.dying),
          src: this.lastHitSrc || 'other', section: self.section(this.x)
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
    /* What engaging actually pays. A drop has no `def` - it came from something
     * the agent shot - while a placed pickup was going to be there either way,
     * so the two have to be counted apart or the reward for fighting is
     * indistinguishable from the reward for walking past a health capsule. */
    var origCollect = VZ.Pickup.prototype.collect;
    VZ.Pickup.prototype.collect = function (p) {
      var self = AGENT._current;
      if (self && p === self.g.player && !this.remove) {
        self.tele.pickups.push({
          stage: self.g.stageIndex, kind: this.kind, drop: !this.def,
          section: self.section(p.x)
        });
      }
      origCollect.call(this, p);
    };
    var origDie = VZ.Enemy.prototype.die;
    VZ.Enemy.prototype.die = function () {
      var self = AGENT._current;
      if (self && !this.dead) self.tele.kills++;
      origDie.call(this);
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

  /* What the agent is allowed to know. At latency 0 this is simply the truth;
   * above it, the observation is held for N frames before the planner sees
   * it, so plans are made for a world that has already moved on. */
  Pilot.prototype.observe = function (p) {
    var cur = {
      x: p.x, y: p.y, hp: p.hp, invuln: p.invuln, hurtTime: p.hurtTime,
      grounded: p.grounded, sim: snapshot(AGENT.sim, this.g)
    };
    var n = this.p.latency | 0;
    if (n <= 0) return cur;
    if (!this._obs) this._obs = [];
    this._obs.push(cur);
    while (this._obs.length > n) this._obs.shift();
    return this._obs[0];
  };

  /* Clumsiness. Whatever the planner asked for is held for a sampled number of
   * frames before the hands are allowed to do anything else.
   *
   * Deliberately drawn from the pilot's own generator, not the game's: the
   * point of the sweep is to compare sections under identical world
   * conditions, and consuming the game's random stream would change the
   * levels being measured.
   */
  Pilot.prototype.fumble = function (inp) {
    var sigma = this.p.dexSigma;
    if (!(sigma > 0)) return inp;
    if (this._holdLeft > 0) { this._holdLeft--; return this._held; }
    this._held = inp;
    // Box-Muller, folded: a repeat length is a magnitude, never negative.
    var u = Math.max(1e-9, this._rng()), v = this._rng();
    var z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    this._holdLeft = Math.round(Math.abs(z) * sigma);
    return inp;
  };

  /* The amount of input a stretch of level demands, after Talakat's `entropy`
   * feature: the information entropy of the first, second and third
   * derivatives of the action sequence. High where the agent is constantly
   * changing direction, stopping while moving, or starting while stopped -
   * and, unlike everything else here, computable from one ordinary run
   * instead of a sweep. */
  Pilot.prototype.recordAction = function (key, inp) {
    var a = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    var st = this.tele.actions[key];
    if (!st) st = this.tele.actions[key] = { d1: {}, d2: {}, d3: {}, a: 0, p1: 0, p2: 0, n: 0 };
    var d1 = a - st.a, d2 = d1 - st.p1, d3 = d2 - st.p2;
    if (st.n > 2) {
      st.d1[d1] = (st.d1[d1] || 0) + 1;
      st.d2[d2] = (st.d2[d2] || 0) + 1;
      st.d3[d3] = (st.d3[d3] || 0) + 1;
    }
    st.a = a; st.p1 = d1; st.p2 = d2; st.n++;
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

    var ob = this.observe(p);
    var out;
    if (g.boss && !g.boss.dying) {
      out = this.bossTick(p, g.boss, ob);
    } else {
      this.ensureField();
      out = this.navTick(ob);
    }
    out = this.fumble(out);
    this.recordAction(sec, out);
    VZ.input.virtual = out;
  };

  // ------------------------------------------------------------ navigation
  Pilot.prototype.navTick = function (p) {
    // `p` here is the observation, not the live player: at latency 0 they are
    // the same object's values, above it the planner is deliberately behind.
    var inp, prm0 = this.p;
    // A queued program is only valid while reality matches the simulation it
    // came from. Knockback from a hit is the usual way that stops being true,
    // and replaying the rest of a jump from the wrong place is how the agent
    // used to walk itself into pits.
    if (this.queue.length && this.expect && this.expect.length >= 2) {
      var ex = this.expect[0], ey = this.expect[1];
      if (p.hurtTime > 0 || Math.abs(p.x - ex) > prm0.devX || Math.abs(p.y - ey) > prm0.devY) {
        this.lastDev = [+(p.x - ex).toFixed(2), +(p.y - ey).toFixed(2), p.hurtTime];
        this.queue.length = 0;
        this.expect = null;
        this.aborts = (this.aborts || 0) + 1;
      } else {
        this.expect = this.expect.slice(2);
      }
    }
    /* No control means no decision worth making. Knockback locks input for 22
     * frames, and planning through it just burns the budget on a state the
     * agent cannot act from - and then throws the plan away next frame anyway
     * because it is still hurt. */
    if (p.hurtTime > 0) { this.queue.length = 0; this.expect = null; return {}; }
    if (this.queue.length === 0) this.decide(p);
    inp = this.queue.length ? this.queue.shift() : {};
    inp = Object.assign({}, inp);

    // shooting is free; always be firing
    if (!this.p.noShoot) {
      var c = this.p.fireOn + this.p.fireOff;
      if ((this.frame % c) < this.p.fireOn) inp.fire = true;
    }

    /* Progress tracking. This used to drive the policy - the threat weights
     * were discounted whenever it stalled - which spent health in exactly the
     * sections the difficulty report was measuring. The search makes that
     * unnecessary, so the number is now only reported: it is a diagnostic
     * readout, not an input. */
    var dNow = AGENT.plan.distAt(this.field, p.x, p.y);
    if (dNow !== null) {
      if (dNow > this.bestDist + 300 || dNow < this.bestDist - 2) {
        this.bestDist = dNow; this.stallFrames = 0;
      } else this.stallFrames++;
    }

    // stuck detector: if we have not moved in a while, clear the plan and
    // allow a wilder choice next time.
    if (Math.abs(p.x - this.lastX) < 0.3) {
      this.stuckFrames++;
      if (this.stuckFrames > 90) {
        this.queue.length = 0;
        this.stuckFrames = 0;
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

  // -------------------------------------------------------- the search
  /* A tiny binary heap. Best-first over macro-actions expands a few hundred
   * nodes per decision and an array sort per pop is the whole cost. */
  function Heap() { this.a = []; }
  Heap.prototype.push = function (n) {
    var a = this.a, i = a.length;
    a.push(n);
    while (i > 0) {
      var par = (i - 1) >> 1;
      if (a[par].f <= a[i].f) break;
      var t = a[i]; a[i] = a[par]; a[par] = t; i = par;
    }
  };
  Heap.prototype.pop = function () {
    var a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      var i = 0;
      for (;;) {
        var l = i * 2 + 1, r = l + 1, m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        var t = a[i]; a[i] = a[m]; a[m] = t; i = m;
      }
    }
    return top;
  };

  /* What a single macro-action costs, in the same units the distance field is
   * denominated in. Everything here is a real consequence of taking the move:
   * time, health, and footing that will not be there later. */
  Pilot.prototype.stepCost = function (r, timeline, startFrame, invuln, timeW) {
    var prm = this.p, cost = 0, tj = r.traj || [];
    cost += r.s.frames * timeW;
    cost += (r.spikeHits || 0) * prm.wSpike;

    // Predicted damage, from the projected world, in the game's own hp.
    var dmg = 0;
    if (timeline && tj.length) {
      dmg = AGENT.world.damageAlong(
        startFrame ? timeline.slice(startFrame) : timeline, tj, invuln);
    }
    cost += dmg * prm.wDamage;

    // Footing that is counting down. The simulator borrows the game's
    // collision, which treats a crumbling block as solid until the frame it
    // vanishes, so a rollout will happily cross one with six frames of life
    // left and report a clean landing.
    for (var cf = 0; cf < tj.length; cf += 8) {
      var ck = this.crumbleUnder(tj[cf], tj[cf + 1]);
      if (ck === null) continue;
      var t1 = this.g.level.crumble[ck];
      var left = (t1 === undefined) ? 44 : t1;
      if (cf / 2 < left - 6) continue;
      cost += this.fatalBelow(tj[cf], tj[cf + 1]) ? prm.wCrumbleEnd : prm.wCrumbleFresh;
      break;
    }
    var ex = r.s.body.x, ey = r.s.body.y;
    if (r.s.grounded) {
      var ck2 = this.crumbleUnder(ex, ey);
      if (ck2 !== null) {
        cost += this.g.level.crumble[ck2] === undefined ? prm.wCrumbleFresh : prm.wCrumbleEnd;
      }
    }
    if (!this.groundBelow(ex, ey, 3)) cost += prm.wPit;
    return { cost: cost, dmg: dmg };
  };

  /* Best-first search over macro-actions, with the distance field as the
   * heuristic and the projected world as the hazard model.
   *
   * This replaces a greedy one-move pick with a depth-two escape hatch. The
   * greedy version had the failure mode every short-horizon planner has: when
   * every move is bad the least bad one is to not really move, and not moving
   * keeps scoring well forever, so it shuffled on the lip of a hazard until
   * something killed it. It needed a patch that discounted danger whenever it
   * stopped making progress - which then spent health in exactly the places
   * the difficulty report was trying to measure, and made those numbers
   * partly circular. A search with time in the path cost walks through the bad
   * patch instead, because standing still accrues cost and going round does
   * not, so the patch is gone and the measurement is honest again.
   */
  function firstNameOf(node) {
    var n = node;
    while (n.parent && n.parent.r) n = n.parent;
    return n.name;
  }

  Pilot.prototype.decide = function (p) {
    var g = this.g, S = AGENT.sim, PL = AGENT.plan, prm = this.p;
    var start = p.sim || snapshot(S, g);

    /* Crumbling blocks are solid to the collision model right up until they
     * vanish, so a plan made while standing on one is a plan made on a floor
     * that is already counting down: weight time far higher while on one. */
    var timeW = prm.wTime;
    if (this.crumbleUnder(p.x, p.y) !== null) timeW = prm.wTime * prm.crumbleHaste;
    // Standing in spikes costs 4hp every i-frame window, so getting out is
    // worth almost any amount of lost ground.
    if (g.level.rectHazard(p.x - 4, p.y - 9, 8, 18) === 'spike') {
      timeW = Math.max(timeW, prm.wTime * prm.spikeHaste);
    }

    var timeline = AGENT.world.project(g, prm.worldLook, prm.worldRadius);

    var heap = new Heap(), seen = {}, expansions = 0;
    if (this.logNodes) this._nodeLog = [];
    var h0 = PL.distAt(this.field, p.x, p.y);
    if (h0 === null) h0 = 1e6;
    heap.push({ s: start, g: 0, f: h0 * prm.wDist, frame: 0,
                invuln: p.invuln || 0, depth: 0, parent: null, r: null, name: null });

    var best = null, bestF = Infinity;

    while (heap.a.length && expansions < prm.searchNodes) {
      var node = heap.pop();
      if (node.depth >= prm.searchDepth) continue;
      if (node.frame >= prm.worldLook - 8) continue;
      expansions++;

      var kids = [];
      for (var k = 0; k < PL.PRIMS.length; k++) {
        var prim = PL.PRIMS[k];
        var r = PL.rollout(S, node.s, prim);
        if (r.dead) continue;
        var hh = PL.distAt(this.field, r.s.body.x, r.s.body.y);
        if (hh === null) continue;

        var sc = this.stepCost(r, timeline, node.frame, node.invuln, timeW);
        var gg = node.g + sc.cost + (prim.name === 'wait' ? prm.wWait : 0);
        var ff = gg + hh * prm.wDist;

        // Two routes that arrive at the same place standing the same way are
        // the same route; keeping both just burns the node budget.
        /* Velocity is part of the state, not a detail: arriving at a tile
         * standing still and arriving at it with a run-up are different
         * positions to jump from, and collapsing them loses the only approach
         * that clears the wide spike beds. */
        var key = ((Math.round(r.s.body.x / 6) * 4096 + Math.round(r.s.body.y / 6)) * 8 +
                   (Math.round(r.s.vx / 2) + 3)) * 2 + (r.s.grounded ? 1 : 0);
        if (seen[key] !== undefined && seen[key] <= ff) continue;
        seen[key] = ff;

        var spent = r.s.frames;
        var kid = {
          s: r.s, g: gg, f: ff, frame: node.frame + spent,
          invuln: sc.dmg > 0 ? VZ.P.IFRAMES : Math.max(0, node.invuln - spent),
          depth: node.depth + 1, parent: node, r: r, name: prim.name
        };
        kids.push(kid);

        /* Judge every node as it is generated, not when it is popped.
         *
         * Popping is in f order, so taking the first popped node would just
         * pick the cheapest single move and call it a search - which is what
         * the greedy version already did. It works here only because the
         * heuristic is not consistent: it is a cost-to-go over an abstracted
         * movement graph and knows nothing about enemies, spikes or crumbling
         * footing, so a deeper node can genuinely come out cheaper than the
         * shallow one it descends from. Those are exactly the plans worth
         * finding - back up four tiles, then dash-jump the spike bed. */
        if (this._nodeLog) {
          this._nodeLog.push({ x: r.s.body.x, y: r.s.body.y, f: ff, g: gg, h: hh,
                               depth: kid.depth, first: firstNameOf(kid), name: prim.name,
                               spikes: r.spikeHits || 0, dmg: sc.dmg });
        }
        if (ff < bestF) { bestF = ff; best = kid; }
      }

      /* Keep the frontier narrow, but not so narrow that it can only go
       * forwards. Fifty primitives per node fills the heap with near-identical
       * shuffles and the budget is gone before the search sees past anything -
       * but sorting purely by f drops every backward move, and backing up is
       * the first half of the only plan that clears a five-tile spike bed.
       * So reserve a slot for the best move in each direction before filling
       * the rest with the globally cheapest. */
      if (kids.length > prm.searchBeam) {
        kids.sort(function (a, c) { return a.f - c.f; });
        var kept = [], buckets = {}, q2;
        for (q2 = 0; q2 < kids.length; q2++) {
          var dx = kids[q2].s.body.x - node.s.body.x;
          var bk = (dx < -8 ? -1 : dx > 8 ? 1 : 0) + ':' + (kids[q2].s.grounded ? 1 : 0);
          if (buckets[bk]) continue;
          buckets[bk] = 1; kids[q2]._kept = 1; kept.push(kids[q2]);
        }
        for (q2 = 0; q2 < kids.length && kept.length < prm.searchBeam; q2++) {
          if (!kids[q2]._kept) { kids[q2]._kept = 1; kept.push(kids[q2]); }
        }
        kids = kept;
      }
      for (var q3 = 0; q3 < kids.length; q3++) heap.push(kids[q3]);
    }

    if (best) {
      /* Execute the whole plan, not just its head.
       *
       * Re-planning after every single move is right when the heuristic is
       * good, and disastrous when it is marginal. The cost-to-go field prices
       * a five-tile spike bed at about what it costs to walk the same distance
       * on flat ground, because the abstract movement graph has an edge that
       * hops it - so "back up, then dash-jump it" is worth roughly nothing per
       * move, and a planner that re-derives its decision from scratch every
       * time will pick the locally cheapest half-step forever. The cycle spans
       * decisions, so no amount of search inside one can see it. Committing to
       * the sequence the search actually found is what makes a multi-move plan
       * mean anything. The deviation check still voids it the moment reality
       * stops matching. */
      var chain = [];
      for (var nd = best; nd && nd.r; nd = nd.parent) chain.push(nd);
      chain.reverse();
      /* Commit less where a mistake is fatal. Committing to a long plan is
       * what makes multi-move ideas possible, and it is also what turns one
       * wrong assumption into a death: over lava the footing is crumbling
       * blocks that the simulator, borrowing the game's collision, believes in
       * until the frame they vanish. So above a lethal drop, take one move at
       * a time and look again. */
      var cap = this.fatalBelow(p.x, p.y) ? 1 : prm.commitFrames;
      var inputs = [], traj = [], used = 0;
      for (var ci = 0; ci < chain.length && used < cap; ci++) {
        var rr2 = chain[ci].r;
        inputs = inputs.concat(rr2.inputs);
        if (rr2.traj) traj = traj.concat(rr2.traj);
        used += rr2.inputs.length;
        /* Stop committing at footing that will not be there. The simulator
         * borrows the game's collision, which treats a crumbling block as
         * solid until the frame it vanishes, so the far half of a plan that
         * rests on one is a plan for a floor that has already gone. Over the
         * Magma Foundry's lava that is the difference between a crossing and
         * a death, and it was the whole cost of committing to long plans. */
        var ez = rr2.s;
        if (ez.grounded && this.crumbleUnder(ez.body.x, ez.body.y) !== null &&
            this.fatalBelow(ez.body.x, ez.body.y)) break;
      }
      this.queue = inputs;
      this.expect = traj;
      this._pick = chain.length ? chain[0].name : null;
      this.lastDecision = { score: -bestF, frames: used, pick: this._pick,
                            depth: chain.length, nodes: expansions };
    } else {
      // Every option ends the run. Take the one that survives longest so the
      // next decision happens as late as possible.
      var fallback = null, longest = -1;
      for (var q = 0; q < PL.PRIMS.length; q++) {
        var rr = PL.rollout(S, start, PL.PRIMS[q]);
        if (rr.s.frames > longest) { longest = rr.s.frames; fallback = rr; }
      }
      this.queue = fallback ? fallback.inputs.slice() : [{ right: true }];
      this.expect = fallback && fallback.traj ? fallback.traj.slice() : null;
      this._pick = 'no way out';
      this.lastDecision = { score: -1e6, frames: longest, pick: 'no way out', depth: 0, nodes: expansions };
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
  Pilot.prototype.bossTick = function (p, b, ob) {
    var prm = this.p, g = this.g;
    ob = ob || p;
    var key = 's' + g.stageIndex;
    if (!this.tele.bossAttempts[key]) this.tele.bossAttempts[key] = 0;
    if (!this._bossSeen) { this._bossSeen = true; this.tele.bossAttempts[key]++; }

    if (this.queue.length && this.expect && this.expect.length >= 2) {
      if (ob.hurtTime > 0 || Math.abs(ob.x - this.expect[0]) > prm.devX ||
          Math.abs(ob.y - this.expect[1]) > prm.devY) {
        this.queue.length = 0; this.expect = null;
      } else this.expect = this.expect.slice(2);
    }
    if (this.queue.length > prm.bossCommit) this.queue.length = prm.bossCommit;
    if (this.queue.length === 0) this.bossDecide(ob, b);

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
    if (prm.noShoot) {
      inp.fire = false;
    } else if (prm.bossCharge > 1.5) {
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
    var start = p.sim || snapshot(S, g);

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

    /* The whole threat model is now the projected world: enemy fire, debris
     * that is still showing its warning marker, the boss body wherever its
     * own attack script is about to put it. Before this it was three separate
     * hand-rolled extrapolations - linear for shots, velocity-damped for the
     * body, a special case for the beam - and each was wrong in its own way
     * against anything that turns. */
    var timeline = AGENT.world.project(g, look + 4, 400);

    var best = null, bestScore = -1e18;
    for (var k = 0; k < PL.PRIMS.length; k++) {
      var prim = PL.PRIMS[k];
      var r = PL.rollout(S, start, prim, look);
      var tj = r.traj || [];
      var score = 0;
      if (r.dead) { score = -1e6; }
      else {
        var ex = r.s.body.x, ey = r.s.body.y;

        score -= AGENT.world.damageAlong(timeline, tj, p.invuln || 0) * prm.bossWDamage;

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
