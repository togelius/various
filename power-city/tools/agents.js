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
/* Bots get their own random numbers. If a bot's whims came out of PC.rand,
 * one persona's coin flips would change every enemy decision after them and
 * no two personas would ever have faced the same fight. */
var BR = null;

var PERSONAS = {
  masher: { mem: {}, think: function (PC, st, mem, p) {
    mem.d = mem.d || { t: 0, x: 0, y: 0 };
    if (--mem.d.t <= 0) {
      mem.d.x = BR.pick([-1, 0, 0, 1, 1]);
      mem.d.y = BR.pick([-1, 0, 0, 0, 1]);
      mem.d.t = BR.int(8, 40);
    }
    if (mem.d.x < 0) st.held.left = true; else if (mem.d.x > 0) st.held.right = true;
    if (mem.d.y < 0) st.held.up = true; else if (mem.d.y > 0) st.held.down = true;
    if (BR.chance(0.10)) { st.pressed.punch = true; st.held.punch = true; }
    if (BR.chance(0.05)) { st.pressed.kick = true; st.held.kick = true; }
    if (BR.chance(0.025)) { st.pressed.jump = true; st.held.jump = true; }
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

  brawler: { mem: {}, think: function (PC, st, mem, p) { competentThink(PC, st, mem, p, { items: true }); } },

  /* Dominance probe: jump kick everything, never fight on the ground. If
   * this clears the game comfortably, one move is the whole game. */
  jumper: { mem: {}, think: function (PC, st, mem, p) {
    var es = PC.world.enemies(), t = null, bd = 1e9;
    for (var i = 0; i < es.length; i++) {
      var e = es[i]; if (e.state === 'down' || e.state === 'fall') continue;
      var d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y); if (d < bd) { bd = d; t = e; }
    }
    if (p.state === 'held') { if (PC.world.time % 5 === 0) press(st, 'punch'); return; }
    if (!t) { hold(st, 'right'); return; }
    var dx = t.x - p.x, dy = t.y - p.y;
    if (p.z > 0) { if (Math.abs(dx) > 10) hold(st, dx > 0 ? 'right' : 'left'); if (Math.abs(dx) < 34) press(st, 'kick'); return; }
    if (Math.abs(dy) > 5) { hold(st, dy > 0 ? 'down' : 'up'); return; }
    if (Math.abs(dx) > 44) { hold(st, dx > 0 ? 'right' : 'left'); return; }
    if (dx * p.facing < 0) { hold(st, dx > 0 ? 'right' : 'left'); return; }
    if (p.canAct()) { press(st, 'jump'); hold(st, dx > 0 ? 'right' : 'left'); }
  }},

  oldbrawler: { mem: {}, think: function (PC, st, mem, p) { fightThink(PC, st, mem, p, { items: true, aggro: true }); } },

  runner: { mem: {}, think: function (PC, st, mem, p) {
    var es = PC.world.enemies();
    if (!es.length) { st.held.right = true; return; }
    competentThink(PC, st, mem, p, { items: false, hurry: true });
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
  if (adx > 40 && ady < 10 && BR.chance(0.08) && p.canAct() && p.z <= 0) { press(st, 'jump'); return; }

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

/* A competent player, as a person at the cabinet would actually play.
 *
 * It sees the whole screen but answers enemy swings with a human delay:
 * an attack is only something to react to once it has been on screen for
 * REACT frames. That makes the 8-frame thug jab undodgeable on reaction -
 * which is true for people too - so, like people, it wins those exchanges
 * by striking first: a 3-frame jab beats every wind-up in the gang.
 *
 * It keeps the crowd in front. Walking sets facing in this game, so the
 * old brain's habit of walking away from every swing turned its back on
 * the fight; this one slips to another lane instead, which keeps facing.
 * And each move gets used for its job, not at random: the elbow for the
 * one behind you, the spin when they are on both sides, the clinch on a
 * dizzy thug, the jump kick to open on someone walking in alone. */
var REACT = 10;

function competentThink(PC, st, mem, p, opts) {
  var W = PC.world;
  mem.gap = (mem.gap || 0) - 1;            // frames since the last button press
  mem.spinCool = (mem.spinCool || 0) - 1;
  mem.jumpCool = (mem.jumpCool || 0) - 1;
  function tap(a) { if (mem.gap > 0) return false; press(st, a); mem.gap = 4; return true; }

  // ---- held: mash, at a rate a person can manage
  if (p.state === 'held' && p.grabbedBy) { tap('punch'); return; }

  // ---- working a clinch: two knees, then the throw
  if (p.grabbing) {
    if ((p.kneeCount || 0) < 2) tap('punch'); else tap('kick');
    return;
  }

  var es = W.enemies();
  function up(e) { return e.state !== 'down' && e.state !== 'fall' && e.state !== 'getup' && !e.dead; }
  var mid = (PC.FLOOR_TOP + PC.FLOOR_BOT) / 2;
  function slip(fromY) {
    // change lane away from the threat; vertical movement keeps facing
    var goUp = (fromY >= p.y) ? true : false;
    if (p.y < PC.FLOOR_TOP + 10) goUp = false;
    if (p.y > PC.FLOOR_BOT - 10) goUp = true;
    hold(st, goUp ? 'up' : 'down');
  }

  // ---- airborne: steer at the nearest, kick through them
  if (p.z > 0) {
    var at = null, ad = 1e9;
    for (var a = 0; a < es.length; a++) {
      if (!up(es[a])) continue;
      var dd = Math.abs(es[a].x - p.x) + Math.abs(es[a].y - p.y);
      if (dd < ad) { ad = dd; at = es[a]; }
    }
    if (at) {
      if (Math.abs(at.x - p.x) > 10) hold(st, at.x > p.x ? 'right' : 'left');
      if (Math.abs(at.x - p.x) < 34 && Math.abs(at.y - p.y) < 10 && p.state !== 'attack') tap('kick');
    }
    return;
  }

  // ---- read the street
  var front = null, fd = 1e9, rear = null, rd = 1e9, crowdNear = 0, frontNear = 0, rearNear = 0;
  var threat = null;
  for (var i = 0; i < es.length; i++) {
    var e = es[i];
    if (!up(e)) continue;
    var ex = e.x - p.x, ey = e.y - p.y, d = Math.abs(ex) + Math.abs(ey) * 0.8;
    var ahead = ex * p.facing >= 0;
    if (ahead) { if (d < fd) { fd = d; front = e; } }
    else { if (d < rd) { rd = d; rear = e; } }
    if (Math.abs(ex) < 30 && Math.abs(ey) < 10) { crowdNear++; if (ahead) frontNear++; else rearNear++; }
    // a swing I have had time to see, that will reach me
    if (e.atk && e.atkT >= REACT && e.atkT < e.atk.startup + e.atk.active) {
      var reach = (e.atk.reach ? e.atk.reach[1] : 24) * (e.scale || 1);
      var covers = e.atk.sweep ? Math.abs(ex) < reach + 6 : (ex * e.facing < 0 && Math.abs(ex) < reach + 6);
      if (covers && Math.abs(ey) < 13) threat = e;
    }
  }

  if (!p.canAct()) {
    // mid-move: the only decision left is whether to carry on the chain
    if (p.state === 'attack' && p.atk && p.atk.chain && p.atkT >= p.atk.startup + p.atk.active - 1) {
      var tgt = front;
      if (tgt && Math.abs(tgt.x - p.x) < 30 && Math.abs(tgt.y - p.y) < 10 &&
          (tgt.state === 'hurt' || tgt.state === 'dizzy')) tap('punch');
    }
    return;
  }

  // ---- a swing is coming that I can see: strike first if it is in my
  // reach and still winding up, otherwise get off its lane
  if (threat) {
    var tx = threat.x - p.x, rem = threat.atk.startup - threat.atkT;
    var mine = (tx * p.facing > 0) && Math.abs(tx) <= 25 && Math.abs(threat.y - p.y) <= 9;
    if (mine && rem > 3 && !(threat.armorLeft > 0)) { tap('punch'); return; }
    slip(threat.y);
    return;
  }

  // ---- surrounded: the spin is for exactly this
  if (frontNear >= 1 && rearNear >= 1 && crowdNear >= 2 && mem.spinCool <= 0) {
    press(st, 'punch'); press(st, 'kick'); mem.gap = 4; mem.spinCool = 50; return;
  }
  if (crowdNear >= 3 && mem.spinCool <= 0) {
    press(st, 'punch'); press(st, 'kick'); mem.gap = 4; mem.spinCool = 50; return;
  }

  // ---- someone at my back: elbow if the front is clear, else turn to them
  if (rear && Math.abs(rear.x - p.x) < 26 && Math.abs(rear.y - p.y) <= 10) {
    if (!(front && Math.abs(front.x - p.x) < 26 && Math.abs(front.y - p.y) <= 12)) { tap('punch'); return; }
    // both sides close but not crowded enough to spin: face the nearer
    if (rd < fd) { hold(st, rear.x > p.x ? 'right' : 'left'); return; }
  }

  // ---- pick the target: the front side first, it is where I am facing
  var t = front;
  if (!t || (rear && rd < fd - 20)) t = rear;

  // ---- items, when it is safe to bend down
  var nearestFoe = Math.min(fd, rd);
  if (opts.items) {
    var want = null, wd = 1e9;
    for (var k = 0; k < W.items.length; k++) {
      var it = W.items[k];
      if (it.held || it.dead || it.z > 6 || it.flying) continue;
      var idd = Math.abs(it.x - p.x) + Math.abs(it.y - p.y) * 0.8;
      var wantIt = (it.kind === 'pickup' && (it.key !== 'heart' || p.hp < 70)) ||
                   (it.kind === 'weapon' && !p.weapon && !p.carry);
      if (wantIt && idd < wd) { wd = idd; want = it; }
    }
    if (want && (wd < 14 || (wd < 90 && nearestFoe > 60) || (want.kind === 'pickup' && p.hp < 35 && wd < 160))) {
      var ix = want.x - p.x, iy = want.y - p.y;
      if (Math.abs(ix) < 9 && Math.abs(iy) < 7) tap('punch');
      else approach(st, ix, iy, PC);
      return;
    }
  }

  if (!t) { if (!opts.hurry || !es.length) hold(st, 'right'); return; }
  var dx = t.x - p.x, dy = t.y - p.y, adx = Math.abs(dx), ady = Math.abs(dy);
  var armored = t.isBoss || (t.armor || 0) >= 1;

  // ---- a dizzy one: take the clinch
  if (t.state === 'dizzy') {
    if (ady > 5) hold(st, dy > 0 ? 'down' : 'up');
    else if (adx > 12 || dx * p.facing < 0) hold(st, dx > 0 ? 'right' : 'left');
    else tap('punch');
    return;
  }

  // ---- a raised guard: kick through it, or step in and take the clinch
  if (t.state === 'guard') {
    if (ady > 5) { hold(st, dy > 0 ? 'down' : 'up'); return; }
    if (dx * p.facing < 0) { hold(st, dx > 0 ? 'right' : 'left'); return; }
    if (adx <= 13) { tap('punch'); return; }
    if (adx <= 30) { tap('kick'); return; }
    hold(st, dx > 0 ? 'right' : 'left'); return;
  }

  // ---- open on a lone walker-in with a jump kick
  var others = 0;
  for (var o = 0; o < es.length; o++) if (es[o] !== t && up(es[o]) && Math.abs(es[o].x - p.x) < 60) others++;
  if (adx > 30 && adx < 46 && ady < 6 && others === 0 && mem.jumpCool <= 0 && t.state === 'walk') {
    if (dx * p.facing < 0) { hold(st, dx > 0 ? 'right' : 'left'); return; }
    press(st, 'jump'); hold(st, dx > 0 ? 'right' : 'left'); mem.jumpCool = 90; mem.gap = 4; return;
  }

  // ---- line up: same lane first (keeps facing), then close the distance
  if (ady > 6) { hold(st, dy > 0 ? 'down' : 'up'); if (adx > 30) hold(st, dx > 0 ? 'right' : 'left'); return; }
  if (dx * p.facing < 0 || adx > 23) { hold(st, dx > 0 ? 'right' : 'left'); return; }

  // ---- in range and squared up
  if (armored) {
    // armor eats the first hits, so do not trade: hit them while they
    // are recovering or reeling, and step off their lane otherwise
    var open = t.state === 'hurt' || t.state === 'dizzy' ||
      (t.atk && t.atkT >= t.atk.startup + t.atk.active);
    if (open || !t.atk) { tap('punch'); return; }
    slip(t.y);
    return;
  }
  tap('punch');
}

`;

// Installed once per run: instrumentation + bot + sampler.
const BOOT = function (bag) {
  const PC = window.PC;
  const src = bag.src, opts = bag;
  eval(src);
  /* Every run is one seed: the game's generator and the bot's are both set
   * from it, so a run is reproducible and N seeds are N different nights
   * at the cabinet rather than one night N times. */
  const seed = (opts.seed >>> 0) || 1;
  PC.rand = PC.RNG(seed);
  BR = PC.RNG(seed ^ 0x51ED5EED);

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
    return S.moves[k] || (S.moves[k] = { starts: 0, connects: 0, hits: 0, dmg: 0 });
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
    /* 'connects' counts attempts that hit anybody, once each - that is the
     * land rate. 'hits' counts every body struck, so a spin through three
     * thugs is one connect and three hits, and hits/starts can pass 100%
     * without meaning anything about accuracy. */
    if (this.__cur) {
      const b = bucket(this.team === 0 ? 'p' : 'e', this.__cur.n);
      if (!this.__cur.hit) b.connects++;
      this.__cur.hit = true; b.hits++;
    }
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
      if (it.kind === 'weapon') S.items.weapons++;
      else if (it.kind === 'prop') S.items.cratesLifted++;
    }
    return r;
  };
  // food and money are collected by walking over them, so count at consume
  const origConsume = PC.items.consume;
  PC.items.consume = function (a, it) {
    if (a.team === 0) { if (it.key === 'heart') S.items.hearts++; else S.items.coins++; }
    return origConsume.call(this, a, it);
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
    // count each enemy's entry into the dizzy state, once
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      if (e.state === 'dizzy' && e.__wasDizzy !== true) S.dizzyInflicted++;
      e.__wasDizzy = e.state === 'dizzy';
    }
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

    // softlock: the street is clear but nobody can get to the end of it
    if (stg.cleared && g.state === 'play') {
      S.__clearT = (S.__clearT || 0) + 1;
      if (S.__clearT === 3600) S.softlocks.push({ stage: stg.index, kind: 'cleared-but-stuck', frame: S.frames });
    } else S.__clearT = 0;

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

async function main() {
  const out = process.argv[2] || '/tmp/pc-agents';
  const personaArg = process.argv[3] || 'all';
  const stageArg = process.argv[4] === undefined ? 'game' : process.argv[4];
  const maxFrames = parseInt(process.argv[5] || (stageArg === 'game' ? '150000' : '30000'), 10);
  const p2Arg = process.argv[6] || '';          // 'two:walker' -> co-op run
  const twoUp = p2Arg.indexOf('two') === 0;
  const p2Persona = (p2Arg.split(':')[1] || 'walker');
  /* SEEDS=n runs every persona n times from consecutive seeds starting at
   * SEED0, and JOBS=k runs k of them at once, one browser page each. */
  const nSeeds = parseInt(process.env.SEEDS || '1', 10);
  const seed0 = parseInt(process.env.SEED0 || '1', 10);
  const jobsMax = parseInt(process.env.JOBS || String(Math.max(1, Math.min(6, require('os').cpus().length - 1))), 10);
  fs.mkdirSync(out, { recursive: true });

  const personas = personaArg === 'all' ? ['masher', 'walker', 'brawler', 'runner'] : personaArg.split(',');
  const stages = stageArg === 'all' ? ['game', '0', '1', '2', '3'] : stageArg.split(',');
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch();

  const jobs = [];
  for (const persona of personas) for (const stage of stages)
    for (let k = 0; k < nSeeds; k++) jobs.push({ persona, stage, seed: seed0 + k });

  async function runJob(job) {
    const { persona, stage, seed } = job;
    const page = await browser.newPage({ viewport: { width: 420, height: 340 } });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e.stack || e).split('\n').slice(0, 3).join(' | ')));
    await page.goto('file://' + path.join(root, 'index.html'));
    await page.waitForTimeout(500);
    await page.evaluate(BOOT, {
      src: PERSONA_SRC, persona, seed,
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
    stats.seed = seed;
    stats.avgEnemies = +(stats.enemyFrames / Math.max(1, stats.frames)).toFixed(2);
    const file = path.join(out, `${persona}${twoUp ? '-coop' : ''}-s${stage}-seed${seed}-${stats.result}.json`);
    fs.writeFileSync(file, JSON.stringify(stats, null, 1));
    console.log(
      `${persona.padEnd(10)} stage ${String(stage).padEnd(4)} seed ${String(seed).padStart(3)} ${stats.result.padEnd(9)}` +
      ` f=${String(stats.frames).padStart(6)} deaths=${String(stats.deaths).padStart(2)} cont=${stats.continues}` +
      ` taken=${stats.taken.count}(${Math.round(stats.taken.dmg)}) rear=${stats.cheap.fromBehind}` +
      (errs.length ? ' ERRORS: ' + errs[0] : '')
    );
    await page.close();
    job.stats = stats;
  }

  let next = 0;
  async function worker() { while (next < jobs.length) { const j = jobs[next++]; await runJob(j); } }
  await Promise.all(Array.from({ length: Math.min(jobsMax, jobs.length) }, worker));
  await browser.close();

  // ------------------------------------------------------------- the summary
  const med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) / 2)] : 0; };
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const rows = [];
  for (const persona of personas) for (const stage of stages) {
    const runs = jobs.filter(j => j.persona === persona && j.stage === stage && j.stats).map(j => j.stats);
    if (!runs.length) continue;
    const bossSecs = [];
    runs.forEach(r => r.bossFights.forEach(b => bossSecs.push(b.frames / 60)));
    rows.push({
      persona, stage, runs: runs.length,
      cleared: runs.filter(r => r.result === 'ending').length,
      deaths: +mean(runs.map(r => r.deaths)).toFixed(1),
      conts: +mean(runs.map(r => r.continues)).toFixed(1),
      taken: Math.round(mean(runs.map(r => r.taken.dmg))),
      rearPct: Math.round(100 * mean(runs.map(r => r.cheap.fromBehind / Math.max(1, r.taken.count)))),
      minutes: +mean(runs.map(r => r.frames / 3600)).toFixed(1),
      bossMed: Math.round(med(bossSecs)), bossMax: Math.round(Math.max(0, ...bossSecs)),
      errors: runs.reduce((n, r) => n + r.errors.length, 0)
    });
  }
  console.log('\n' + 'summary (means over seeds; boss seconds over every boss fight)');
  console.table(rows);
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(rows, null, 1));
  console.log('done -> ' + out);
}

// Other tools (filmstrip.js) borrow the personas and the instrumentation.
module.exports = { PERSONA_SRC, BOOT, STEP, COLLECT };
if (require.main === module) main();
