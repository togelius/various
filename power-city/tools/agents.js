/* POWER CITY - game-testing agents.
 *
 * Put bots of several dispositions at the controls, fast-forward the whole
 * game, and record everything that happens: every hit, every whiff, every
 * second spent lying on the floor. The point is to find out what the game
 * is actually like to play before deciding what to fix.
 *
 * usage: node tools/agents.js <outdir> [persona] [stage] [maxFrames]
 *   persona: masher | walker | brawler | runner | all   (default all)
 *   stage:   0-3 for a single-stage run, or 'game' for the whole campaign
 *
 * Needs playwright on NODE_PATH, e.g.
 *   NODE_PATH=../gigaman/node_modules node tools/agents.js /tmp/pc-agents
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// The personas: masher (a child at the cabinet), walker (the baseline bot
// from sim.js), brawler (a competent player who uses the whole move list),
// runner (a speedrunner: only fights when the camera is locked).
const PERSONA_SRC = `
var PERSONAS = {
  masher: { mem: {}, think: function (PC, st, mem, p) {
    mem.d = mem.d || { t: 0, x: 0, y: 0 };
    if (--mem.d.t <= 0) {
      mem.d.x = PC.rand.pick([-1, 0, 0, 1, 1]);
      mem.d.y = PC.rand.pick([-1, 0, 0, 0, 1]);
      mem.d.t = PC.rand.int(8, 40);
    }
    if (mem.d.x < 0) st.held.left = true; else if (mem.d.x > 0) st.held.right = true;
    if (mem.d.y < 0) st.held.up = true; else if (mem.d.y > 0) st.held.down = true;
    if (PC.rand.chance(0.10)) { st.pressed.punch = true; st.held.punch = true; }
    if (PC.rand.chance(0.05)) { st.pressed.kick = true; st.held.kick = true; }
    if (PC.rand.chance(0.025)) { st.pressed.jump = true; st.held.jump = true; }
  }},

  walker: { mem: {}, think: function (PC, st, mem, p) {
    var W = PC.world, es = W.enemies();
    var t = null, bd = 1e9;
    for (var i = 0; i < es.length; i++) {
      var e = es[i];
      var d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
      if (d < bd) { bd = d; t = e; }
    }
    if (!t) { st.held.right = true; return; }
    var dx = t.x - p.x, dy = t.y - p.y;
    if (Math.abs(dy) > 5) { if (dy > 0) st.held.down = true; else st.held.up = true; }
    if (Math.abs(dx) > 20) { if (dx > 0) st.held.right = true; else st.held.left = true; }
    if (Math.abs(dx) < 28 && Math.abs(dy) < 12) {
      mem.pt = (mem.pt || 0) + 1;
      if (mem.pt % 9 === 0) { st.pressed.punch = true; st.held.punch = true; }
      if (mem.pt % 47 === 0) { st.pressed.kick = true; st.held.kick = true; }
    }
    if (p.hp < 25 && W.time % 120 < 40) { st.held.right = false; st.held.left = true; }
  }},

  brawler: { mem: {}, think: function (PC, st, mem, p) { fightThink(PC, st, mem, p, { items: true, aggro: true }); } },

  runner: { mem: {}, think: function (PC, st, mem, p) {
    var locked = PC.stage.locked;
    var es = PC.world.enemies();
    if (!locked && !es.length) { st.held.right = true; mem.lastFight = 0; return; }
    if (!es.length) { st.held.right = true; return; }
    fightThink(PC, st, mem, p, { items: false, aggro: true, hurry: true });
  }}
};

function press(st, a) { st.pressed[a] = true; st.held[a] = true; }
function hold(st, a) { st.held[a] = true; }
function approach(st, dx, dy, PC) {
  if (dx > 2) hold(st, 'right'); else if (dx < -2) hold(st, 'left');
  if (dy > 3) hold(st, 'down'); else if (dy < -3) hold(st, 'up');
}

/* The shared brain of the competent players. */
function fightThink(PC, st, mem, p, opts) {
  var W = PC.world, M = PC.math;

  // ---- held by an enemy: mash out immediately
  if (p.state === 'held' && p.grabbedBy) { press(st, 'punch'); return; }

  // ---- working a clinch: knee twice, then throw
  if (p.grabbing) {
    if ((p.kneeCount || 0) < 2) press(st, 'punch'); else press(st, 'kick');
    return;
  }

  var es = W.enemies();

  // ---- pick a target: nearest standing enemy, dizzy ones are a bonus
  var t = null, bd = 1e9;
  for (var i = 0; i < es.length; i++) {
    var e = es[i];
    if (e.state === 'down') continue;
    if (e.state === 'fall' && e.z > 8) continue;
    var d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * 0.8;
    if (e.state === 'dizzy') d -= 30;
    if (d < bd) { bd = d; t = e; }
  }
  if (!t) { if (!opts.hurry) hold(st, 'right'); return; }

  // ---- rear awareness: a human turns to a flanker they can see coming
  var rearT = null, rd = 36;
  for (var r = 0; r < es.length; r++) {
    var er = es[r];
    if (er.state === 'down' || er.state === 'fall') continue;
    if ((er.x - p.x) * p.facing >= 0) continue;
    var dr = Math.abs(er.x - p.x) + Math.abs(er.y - p.y) * 0.8;
    if (dr < rd) { rd = dr; rearT = er; }
  }
  if (rearT && (bd > 22 || rearT.state === 'dizzy')) t = rearT;

  var dx = t.x - p.x, dy = t.y - p.y, adx = Math.abs(dx), ady = Math.abs(dy);

  // ---- threat scan: any enemy mid-swing whose reach covers us
  var threat = null;
  for (var j = 0; j < es.length; j++) {
    var e2 = es[j];
    if (!e2.atk) continue;
    var reach = e2.atk.reach ? e2.atk.reach[1] : 20;
    var inFlight = e2.atkT < e2.atk.startup + e2.atk.active;
    if (inFlight && Math.abs(e2.x - p.x) < reach + 6 && Math.abs(e2.y - p.y) < 14) threat = e2;
  }
  if (threat && p.canAct() && p.z <= 0) {
    // step out of the swing, prefer going away in x and changing lane in y
    if (p.x >= threat.x) hold(st, 'right'); else hold(st, 'left');
    if (p.y > (PC.FLOOR_TOP + PC.FLOOR_BOT) / 2) hold(st, 'up'); else hold(st, 'down');
    return;
  }

  // ---- items: food when hurt, a weapon when empty-handed
  if (opts.items) {
    var want = null;
    for (var k = 0; k < W.items.length; k++) {
      var it = W.items[k];
      if (it.held || it.dead || it.z > 8) continue;
      var dd = Math.abs(it.x - p.x) + Math.abs(it.y - p.y) * 0.7;
      if (it.kind === 'pickup' && p.hp < 80 && dd < 100 && (!want || dd < want.d)) want = { it: it, d: dd };
      if (it.kind === 'weapon' && !p.weapon && !p.carry && dd < 80 && (!want || dd < want.d)) want = { it: it, d: dd };
    }
    if (want && (!t || bd > 26)) {
      var ix = want.it.x - p.x, iy = want.it.y - p.y;
      if (Math.abs(ix) < 10 && Math.abs(iy) < 8) press(st, 'punch');
      else approach(st, ix, iy, PC);
      return;
    }
  }

  // ---- hurt and outnumbered: heal if you can, keep your feet otherwise.
  // Backing into a corner is how good players die; keep facing the crowd.
  var standing = 0;
  for (var s = 0; s < es.length; s++) if (es[s].state !== 'down' && es[s].state !== 'fall') standing++;
  if (p.hp < 32 && opts.items) {
    var food = null, fd = 1e9;
    for (var f = 0; f < W.items.length; f++) {
      var fi = W.items[f];
      if (fi.held || fi.dead || fi.kind !== 'pickup' || fi.z > 8) continue;
      var fdd = Math.abs(fi.x - p.x) + Math.abs(fi.y - p.y) * 0.7;
      if (fdd < fd) { fd = fdd; food = fi; }
    }
    if (food && fd < 200) {
      var fx2 = food.x - p.x, fy2 = food.y - p.y;
      if (Math.abs(fx2) < 10 && Math.abs(fy2) < 8) press(st, 'punch');
      else approach(st, fx2, fy2, PC);
      return;
    }
  }

  // ---- airborne: steer at the target, kick on the way through
  if (p.z > 0) {
    if (adx > 12) { if (dx > 0) hold(st, 'right'); else hold(st, 'left'); }
    if (adx < 30 && ady < 10) press(st, 'punch');
    return;
  }

  // ---- dizzy target: walk in and take the clinch
  if (t.state === 'dizzy') {
    if (ady > 6) { if (dy > 0) hold(st, 'down'); else hold(st, 'up'); }
    else if (adx > 8) { if (dx > 0) hold(st, 'right'); else hold(st, 'left'); }
    else press(st, 'punch');
    return;
  }

  // ---- occasionally open with a jump kick from far out
  if (adx > 40 && ady < 10 && PC.rand.chance(0.08) && p.canAct() && p.z <= 0) { press(st, 'jump'); return; }

  // ---- ground fight. Approach along a lane offset from the target, so
  // straight pokes whiff, then square up to strike.
  if (mem.cool > 0) mem.cool--;
  var big = t.isBoss || (t.T && (t.T.armor || 0) >= 2);
  if (adx > 16) {
    var laneOff = (p.y > (PC.FLOOR_TOP + PC.FLOOR_BOT) / 2) ? -14 : 14;
    var wantY = adx > 30 ? t.y + laneOff : t.y;
    if (Math.abs(wantY - p.y) > 4) { if (wantY > p.y) hold(st, 'down'); else hold(st, 'up'); }
    if (dx > 0) hold(st, 'right'); else hold(st, 'left');
  } else if (adx >= 5 && ady <= 9 && (mem.cool || 0) <= 0 && p.canAct()) {
    var near = 0;
    for (var n = 0; n < es.length; n++) {
      var e3 = es[n];
      if (Math.abs(e3.x - p.x) < 28 && Math.abs(e3.y - p.y) < 10 && e3.state !== 'down') near++;
    }
    if (near >= 3 && !big) { press(st, 'punch'); press(st, 'kick'); mem.cool = 34; }
    else { press(st, 'punch'); mem.cool = big ? 7 : 5; }
  } else if (adx >= 5 && ady <= 9 && p.canAct() && t.atk &&
      t.atkT >= t.atk.startup + t.atk.active) {
    // the target is mid-recovery: free damage, no cooldown
    press(st, 'punch');
  } else if (adx < 5 && ady <= 9 && (mem.cool || 0) <= 0 && p.canAct()) {
    // point blank: jab anyway, and slip to the side to keep facing
    press(st, 'punch');
    if (p.y > (PC.FLOOR_TOP + PC.FLOOR_BOT) / 2) hold(st, 'up'); else hold(st, 'down');
    mem.cool = 6;
  } else if (ady > 9) {
    approach(st, 0, dy, PC);
  }
}
`;

// Installed once per run: instrumentation + bot + sampler.
const BOOT = function (bag) {
  const PC = window.PC;
  const src = bag.src, opts = bag;
  eval(src);

  // ------------------------------------------------------------ the ledger
  const S = window.__stats = {
    persona: opts.persona, stage: opts.startStage, frames: 0,
    result: 'running',
    score: 0, kills: 0, deaths: 0, continues: 0, livesLost: 0, timeouts: 0,
    dealt: { count: 0, dmg: 0 }, taken: { count: 0, dmg: 0 }, takenByMove: {},
    cheap: {
      whileDown: 0, whileFall: 0, whileGetup: 0, whileHurt: 0, whileHeld: 0, whileAttack: 0,
      postGetup: 0, offscreen: 0, fromBehind: 0, knockdowns: 0
    },
    knockdownsDealt: 0, dizzyInflicted: 0, grabsMade: 0, grabsTaken: 0, knees: 0, throws: 0, escapes: 0,
    items: { hearts: 0, coins: 0, weapons: 0, swings: 0, weaponHits: 0, cratesLifted: 0, cratesThrown: 0, smashed: 0, drums: 0 },
    moves: {},                       // key 'p:jab' -> {starts,hits,dmg,whiff}
    killsBy: {}, lastHit: null,
    pStates: {}, eStates: {},
    encounters: [], bossFights: [],
    hitstop: 0, tokenSat: 0, downtime: 0, playFrames: 0, stageFrames: [0, 0, 0, 0],
    hpTimeline: [], deathsAt: [], softlocks: [],
    maxEnemies: 0, avgEnemies: 0, enemyFrames: 0
  };

  const moveName = new Map();
  [PC.MOVES, PC.ENEMY_MOVES].forEach(T => { for (const k in T) moveName.set(T[k], k); });
  function bucket(side, n) {
    const k = side + ':' + n;
    return S.moves[k] || (S.moves[k] = { starts: 0, hits: 0, dmg: 0 });
  }

  // ------------------------------------------------------- method wrapping
  const origStart = PC.Actor.prototype.startAttack;
  PC.Actor.prototype.startAttack = function (def) {
    const n = moveName.get(def) || '?';
    if (this.team === 0) { bucket('p', n).starts++; if (def.grabMove) S.knees++; }
    else bucket('e', n).starts++;
    this.__cur = { n, hit: false };
    return origStart.call(this, def);
  };

  const origLand = PC.Actor.prototype.land;
  PC.Actor.prototype.land = function (t, d) {
    if (this.__cur) { this.__cur.hit = true; bucket(this.team === 0 ? 'p' : 'e', this.__cur.n).hits++; }
    if (this.team === 1 && t.state === 'dizzy') S.dizzyInflicted++;
    return origLand.call(this, t, d);
  };

  const origTake = PC.Actor.prototype.takeHit;
  PC.Actor.prototype.takeHit = function (h) {
    const victim = this, from = h.from;
    const vs = victim.state, hpBefore = victim.hp, vf = victim.facing;
    const r = origTake.call(this, h);
    /* Only a hit that moved the needle counts. takeHit is also called on
     * invulnerable or armored targets, where it politely does nothing. */
    if (victim.hp >= hpBefore) {
      if (victim.team === 0) S.cheap.blocked = (S.cheap.blocked || 0) + 1;
      return r;
    }
    if (victim.team === 0) {
      S.taken.count++; S.taken.dmg += hpBefore - victim.hp;
      if (vs === 'down') S.cheap.whileDown++;
      else if (vs === 'getup') S.cheap.whileGetup++;
      else if (vs === 'fall') S.cheap.whileFall++;
      else if (vs === 'hurt') S.cheap.whileHurt++;
      else if (vs === 'held') S.cheap.whileHeld++;
      else if (vs === 'attack') S.cheap.whileAttack++;
      const dpg = PC.world.time - victim.__getupEnd;
      if (victim.__getupEnd && dpg >= 0 && dpg < 30) {
        S.cheap.postGetup++;
        (S.pgLog = S.pgLog || []).push({
          diff: dpg, inv: victim.invuln, st: vs,
          from: from && (from.type || from.char), hp: Math.round(victim.hp),
          x: Math.round(victim.x), cam: Math.round(PC.world.camX)
        });
      }
      if (from && (from.x < PC.world.camX - 6 || from.x > PC.world.camX + PC.W + 6)) S.cheap.offscreen++;
      if (from && ((from.x - victim.x) * vf < 0)) S.cheap.fromBehind++;
      if (h.knock) S.cheap.knockAttempts = (S.cheap.knockAttempts || 0) + 1;
      S.lastHit = {
        t: PC.world.time, stage: PC.stage.index, enc: PC.stage.encIndex,
        from: from ? (from.type || from.char) : '?', dmg: Math.round((hpBefore - victim.hp) * 10) / 10,
        state: vs, hp: Math.round(victim.hp)
      };
      if (from && from.__cur) S.takenByMove[from.__cur.n] = (S.takenByMove[from.__cur.n] || 0) + 1;
    } else {
      S.dealt.count++; S.dealt.dmg += hpBefore - victim.hp;
      if (from && from.__cur) bucket('p', from.__cur.n).dmg += hpBefore - victim.hp;
      if (h.knock) S.knockdownsDealt++;
    }
    return r;
  };

  const origKnock = PC.Actor.prototype.knockDown;
  PC.Actor.prototype.knockDown = function (dir, launch) {
    if (this.team === 0) S.cheap.knockdowns++;
    return origKnock.call(this, dir, launch);
  };

  const origPDie = PC.Player.prototype.onDeath;
  PC.Player.prototype.onDeath = function (from) {
    S.deaths++;
    S.deathsAt.push({ stage: PC.stage.index, enc: PC.stage.encIndex, cause: S.lastHit });
    return origPDie.call(this, from);
  };

  const origEDie = PC.Enemy.prototype.onDeath;
  PC.Enemy.prototype.onDeath = function (killer) {
    S.kills++;
    S.killsBy[this.type] = (S.killsBy[this.type] || 0) + 1;
    return origEDie.call(this, killer);
  };

  const origGrab = PC.Player.prototype.beginGrab;
  PC.Player.prototype.beginGrab = function (e) {
    S.grabsMade++;
    return origGrab.call(this, e);
  };
  const origThrow = PC.Player.prototype.throwVictim;
  PC.Player.prototype.throwVictim = function (e) {
    S.throws++;
    return origThrow.call(this, e);
  };
  const origEnemyGrab = PC.Enemy.prototype.doGrab;
  PC.Enemy.prototype.doGrab = function (p) {
    S.grabsTaken++;
    return origEnemyGrab.call(this, p);
  };
  const origEscape = null; // escape is inline in control; detected via sampler (held->idle)

  const origTakeItem = PC.items.take;
  PC.items.take = function (a, it) {
    const r = origTakeItem.call(this, a, it);
    if (r && a.team === 0) {
      if (it.kind === 'pickup') { if (it.key === 'heart') S.items.hearts++; else S.items.coins++; }
      else if (it.kind === 'weapon') S.items.weapons++;
      else if (it.kind === 'prop') S.items.cratesLifted++;
    }
    return r;
  };
  const origHurl = PC.items.hurl;
  PC.items.hurl = function (a) {
    if (a.team === 0) { if (a.carry) S.items.cratesThrown++; else if (a.weaponItem) S.items.swings++; }
    return origHurl.call(this, a);
  };

  const origCont = PC.game.doContinue;
  PC.game.doContinue = function (i) { S.continues++; return origCont.call(this, i); };

  // ------------------------------------------------------------- the bot
  const bot = PERSONAS[opts.persona];
  bot.mem = {};
  const bot2 = opts.p2 ? PERSONAS[opts.p2Persona || 'walker'] : null;
  if (bot2) bot2.mem = {};
  PC.input.poll = function () {
    const g = PC.game;
    for (const pi of [0, 1]) {
      const st = this.p[pi];
      for (const a of ['left', 'right', 'up', 'down', 'punch', 'kick', 'jump', 'start']) {
        st.held[a] = false; st.pressed[a] = false; st.released[a] = false;
      }
      st.tapDir = 0;
    }
    this.coin = this.pause = this.mute = this.fullscreen = false; this.anyKey = false;

    if (g.state === 'title' || g.state === 'continue') {
      if (g.stateT % 90 === 60) { this.p[0].pressed.start = true; this.p[0].held.start = true; }
      return;
    }
    if (g.state !== 'play' && g.state !== 'ready') return;
    const p = g.players[0];
    if (p && !p.dead) bot.think(PC, this.p[0], bot.mem, p);
    if (bot2) {
      const p2 = g.players[1];
      if (!p2 && g.state === 'play' && g.stateT % 90 === 30 && g.credits >= 0) {
        g.credits++;
        g.joinPlayer(1);
      }
      if (p2 && !p2.dead) bot2.think(PC, this.p[1], bot2.mem, p2);
    }
  };

  // ------------------------------------------------------------- the game
  PC.audio.enabled = false;
  PC.game.loop.stop();
  if (opts.startStage === 'game') {
    PC.game.coin(); PC.game.startGame(0);
    if (opts.p2) { PC.game.credits++; PC.game.joinPlayer(1); }
  } else {
    PC.game.coin(); PC.game.startGame(0);
    const s = opts.startStage;
    PC.game.stageIndex = s;
    PC.stage.load(s);
    const p = PC.game.players[0];
    p.reviveAt(60, PC.FLOOR_BOT - 16); PC.world.add(p);
    if (opts.p2) {
      PC.game.players[1] = null;
      PC.input.p2Joined = false;
      PC.game.credits++;
      PC.game.joinPlayer(1);
      const p2 = PC.game.players[1];
      if (p2) { p2.reviveAt(90, PC.FLOOR_BOT - 16); PC.world.add(p2); }
    }
    PC.game.setState('play');
    PC.game.stateT = 200;
  }

  window.__sample = function () {
    const g = PC.game, W = PC.world, stg = PC.stage;
    S.frames++;
    if (g.state === 'play') {
      S.playFrames++;
      if (stg.index >= 0 && stg.index < 4) S.stageFrames[stg.index]++;
    }
    if (W.hitstop > 0) S.hitstop++;
    const tokCount = W.tokenCount ? W.tokenCount() : W.tokens;
    if (W.tokenHolders.length >= tokCount) S.tokenSat++;

    const p = g.players[0];
    if (p) {
      if (p.dead) S.pStates.dead = (S.pStates.dead || 0) + 1;
      else {
        S.pStates[p.state] = (S.pStates[p.state] || 0) + 1;
        if (S.__pv === 'getup' && p.state !== 'getup') p.__getupEnd = W.time;
        if (S.__pv === 'held' && p.state !== 'held' && p.grabbedBy) S.escapes++;
        S.__pv = p.state;
        if (S.frames % 45 === 0) S.hpTimeline.push({ t: S.frames, hp: Math.round(p.hp), stage: stg.index });
      }
      if (S.__lives === undefined) S.__lives = g.lives[0];
      if (g.lives[0] < S.__lives) { S.livesLost += S.__lives - g.lives[0]; S.__lives = g.lives[0]; }
      if (g.lives[0] > S.__lives) S.__lives = g.lives[0];
    }

    const es = W.enemies();
    S.enemyFrames += es.length;
    if (es.length > S.maxEnemies) S.maxEnemies = es.length;
    for (let i = 0; i < es.length; i++) S.eStates[es.state] = 0; // placeholder, replaced below
    for (let i = 0; i < es.length; i++) S.eStates[es[i].state] = (S.eStates[es[i].state] || 0) + 1;

    // downtime: nothing to do within a screen of the player
    if (p && !p.dead) {
      let near = 1e9;
      for (let i = 0; i < es.length; i++) near = Math.min(near, Math.abs(es[i].x - p.x) + Math.abs(es[i].y - p.y));
      if (near > 90) S.downtime++;
    }

    // encounter tracking
    if (stg.locked && !S.__enc) {
      S.__enc = {
        stage: stg.index, enc: stg.encIndex - 1, startFrame: S.frames,
        enemies: 0, hpStart: p ? Math.round(p.hp) : 0, deaths: S.deaths, kills: S.kills,
        boss: stg.pending.some(q => q.boss) || !!stg.bossActive
      };
      S.__encSoftlockT = 0;
    }
    if (S.__enc) {
      S.__enc.enemies = Math.max(S.__enc.enemies, es.length);
      S.__encSoftlockT++;
      // softlock: a lock that runs absurdly long with nothing to fight
      if (S.__encSoftlockT === 3600 && !es.length && !stg.pending.length) {
        S.softlocks.push({ stage: stg.index, enc: S.__enc.enc, kind: 'empty-lock', frame: S.frames });
      }
    }
    if (!stg.locked && S.__enc) {
      S.__enc.frames = S.frames - S.__enc.startFrame;
      S.__enc.hpEnd = p ? Math.round(p.hp) : 0;
      S.__enc.deaths = S.deaths - S.__enc.deaths;
      S.__enc.kills = S.kills - S.__enc.kills;
      S.encounters.push(S.__enc);
      S.__enc = null;
    }

    if (stg.bossActive && !S.__boss) {
      S.__boss = { name: stg.bossActive.type, startFrame: S.frames, hpStart: Math.round(stg.bossActive.hp) };
    }
    if (!stg.bossActive && S.__boss) {
      S.__boss.frames = S.frames - S.__boss.startFrame;
      S.__boss.hpEnd = 0;
      S.bossFights.push(S.__boss); S.__boss = null;
    }

    if (stg.timeLeft === 0 && !S.__to) { S.__to = true; S.timeouts++; }
    if (stg.timeLeft > 0) S.__to = false;

    // end conditions
    if (g.state === 'ending' && S.result === 'running') S.result = 'ending';
    if (g.state === 'title' && S.frames > 300) S.result = 'gameover';
    S.score = g.scores[0];
  };
};

// Runs n frames; returns progress markers.
const STEP = function (n) {
  for (let i = 0; i < n; i++) {
    PC.game.update();
    window.__sample();
    if (window.__stats.result !== 'running') return { i, result: window.__stats.result };
  }
  return { i: n, result: 'running' };
};

const COLLECT = function () {
  const S = window.__stats;
  if (S.__enc) {
    S.__enc.frames = S.frames - S.__enc.startFrame;
    S.__enc.hpEnd = S.game ? 0 : S.__enc.hpEnd;
    S.encounters.push(S.__enc);
  }
  if (S.__boss) {
    S.__boss.frames = S.frames - S.__boss.startFrame;
    S.bossFights.push(S.__boss);
  }
  S.avgEnemies = S.frames ? +(S.enemyFrames / S.frames).toFixed(2) : 0;
  delete S.__pv; delete S.__enc; delete S.__boss; delete S.__to; delete S.__lives;
  return S;
};

(async () => {
  const out = process.argv[2] || '/tmp/pc-agents';
  const personaArg = process.argv[3] || 'all';
  const stageArg = process.argv[4] === undefined ? 'game' : process.argv[4];
  const maxFrames = parseInt(process.argv[5] || (stageArg === 'game' ? '150000' : '30000'), 10);
  const p2Arg = process.argv[6] || '';          // 'two:walker' -> co-op run
  const twoUp = p2Arg.indexOf('two') === 0;
  const p2Persona = (p2Arg.split(':')[1] || 'walker');
  fs.mkdirSync(out, { recursive: true });

  const personas = personaArg === 'all' ? ['masher', 'walker', 'brawler', 'runner'] : [personaArg];
  const stages = stageArg === 'all' ? ['game', '0', '1', '2', '3'] : [stageArg];
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch();

  for (const persona of personas) {
    for (const stage of stages) {
      const page = await browser.newPage({ viewport: { width: 420, height: 340 } });
      const errs = [];
      page.on('pageerror', e => errs.push(String(e.stack || e).split('\n').slice(0, 3).join(' | ')));
      await page.goto('file://' + path.join(root, 'index.html'));
      await page.waitForTimeout(700);
      await page.evaluate(BOOT, {
        src: PERSONA_SRC, persona,
        startStage: stage === 'game' ? 'game' : parseInt(stage, 10),
        p2: twoUp, p2Persona
      });

      const chunk = 4000;
      for (let done = 0; done < maxFrames; done += chunk) {
        const r = await page.evaluate(STEP, Math.min(chunk, maxFrames - done));
        if (r.result !== 'running') break;
      }
      const stats = await page.evaluate(COLLECT);
      stats.errors = errs;
      stats.avgEnemies = +(stats.enemyFrames / Math.max(1, stats.frames)).toFixed(2);

      const file = path.join(out, `${persona}${twoUp ? '-coop' : ''}-s${stage}-${stats.result}.json`);
      fs.writeFileSync(file, JSON.stringify(stats, null, 1));
      const enc = stats.encounters;
      console.log(
        `${persona.padEnd(8)} stage ${String(stage).padEnd(4)} ${stats.result.padEnd(10)}` +
        ` f=${String(stats.frames).padStart(6)} kills=${String(stats.kills).padStart(3)}` +
        ` deaths=${stats.deaths} taken=${stats.taken.count}(${Math.round(stats.taken.dmg)})` +
        ` dealt=${stats.dealt.count}(${Math.round(stats.dealt.dmg)})` +
        ` cheapDown=${stats.cheap.whileDown} cont=${stats.continues}` +
        ` encs=${enc.length}` + (errs.length ? ' ERRORS: ' + errs[0] : '')
      );
      await page.close();
    }
  }
  await browser.close();
  console.log('done -> ' + out);
})();