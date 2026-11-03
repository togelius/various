'use strict';
/* One episode: a controller (source text) plays one scenario to completion.
 *
 * The controller sees a small plain-object observation and returns a plain
 * object of held buttons. It never touches the game. Its source is bounded
 * (MAX_CHARS), runs in its own vm context with a per-call timeout, and any
 * throw counts as a crash.
 */
var H = require('./headless.js');
var vm = H.vm;

var MAX_CHARS = 3000;          // hard cap on evolved controller size
var MAX_LINES = 110;
var BUTTONS = ['left', 'right', 'up', 'down', 'punch', 'kick', 'jump'];

/* ---- static feasibility (Talakat: the infeasible are kept, not discarded) */
function feasibility(src) {
  var problems = [];
  if (src.length > MAX_CHARS) problems.push('too long: ' + src.length + ' chars (max ' + MAX_CHARS + ')');
  if (src.split('\n').length > MAX_LINES) problems.push('too many lines (max ' + MAX_LINES + ')');
  if (!/function\s+think\s*\(/.test(src)) problems.push('no function think(o, mem)');
  if (/\b(require|process|eval|Function|import|globalThis|window|constructor|__proto__)\b/.test(src)) problems.push('forbidden identifier');
  try { new vm.Script(src); } catch (e) { problems.push('syntax: ' + e.message); }
  return problems;
}

function compile(src) {
  var ctx = vm.createContext({ Math: { abs: Math.abs, min: Math.min, max: Math.max, sign: Math.sign, floor: Math.floor, round: Math.round, sqrt: Math.sqrt, hypot: Math.hypot, atan2: Math.atan2, PI: Math.PI } });
  vm.runInContext(src, ctx, { timeout: 50 });
  if (typeof ctx.think !== 'function') throw new Error('think is not a function');
  return ctx;
}

/* ---- scenarios: where a run starts. stage/enc/dist/hp/weapon vary. */
function makeScenario(rng, sb) {
  var PC = sb.PC;
  var s = Math.floor(rng() * PC.STAGES.length);
  var n = PC.STAGES[s].encounters.length;
  var k = Math.floor(rng() * n);
  return {
    stage: s, enc: k,
    dist: Math.round(30 + rng() * 260),          // px before the encounter trigger
    hp: [1, 1, 0.75, 0.5][Math.floor(rng() * 4)],
    weapon: rng() < 0.15 ? 'pipe' : null,
    seed: 1 + Math.floor(rng() * 1e9),
    frames: 3000
  };
}

function classify(pose) {
  if (/jab|cross/.test(pose)) return 'basic';
  if (/hook|upper|kick|elbow|spin|knee|runKnee|jumpKick/i.test(pose)) return 'special';
  return 'weapon';
}

function observe(PC, p, st, mem, t) {
  var W = PC.world, es = W.enemies(), i, list = [];
  for (i = 0; i < es.length; i++) {
    var e = es[i], dx = e.x - p.x, dy = e.y - p.y;
    list.push({
      dx: Math.round(dx), dy: Math.round(dy), dist: Math.round(Math.abs(dx) + Math.abs(dy) * 0.8),
      type: e.type, boss: !!e.isBoss, hp: Math.round(e.hp), z: Math.round(e.z), state: e.state,
      attacking: e.state === 'attack', facingMe: (e.facing * dx) < 0, armed: !!e.weapon
    });
  }
  list.sort(function (a, b) { return a.dist - b.dist; });
  var items = [], its = W.items || [];
  for (i = 0; i < its.length; i++) {
    var it = its[i]; if (it.dead) continue;
    var idx = it.x - p.x, idy = it.y - p.y;
    if (Math.abs(idx) < 160) items.push({ dx: Math.round(idx), dy: Math.round(idy), kind: it.kind, key: it.key });
  }
  items.sort(function (a, b) { return Math.abs(a.dx) + Math.abs(a.dy) - Math.abs(b.dx) - Math.abs(b.dy); });
  return {
    t: t,
    me: {
      x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z), hp: Math.round(p.hp), maxHp: p.maxHp,
      facing: p.facing, state: p.state, free: !!p.canAct(), weapon: p.weapon || null, carrying: !!p.carry, grabbing: !!p.grabbing,
      grabbed: p.state === 'held'
    },
    enemies: list.slice(0, 8), enemyCount: es.length, items: items.slice(0, 5),
    screen: { left: Math.round(p.x - W.camX), right: Math.round(W.camX + PC.W - p.x), top: PC.FLOOR_TOP, bottom: PC.FLOOR_BOT, locked: !!PC.stage.locked },
    clock: PC.stage.timeLeft
  };
}

function stageProgress(PC) {
  /* One number that only goes up: pixels of street 'won'. Walking counts;
   * so does killing inside a locked fight (half the span to the next gate). */
  var def = PC.stage.def, encs = def.encounters, x = 0;
  var p = PC.game.players[0];
  if (p) x = p.x;
  if (PC.stage.active) {
    var a = PC.stage.active, i = encs.indexOf(a);
    var next = i + 1 < encs.length ? encs[i + 1].x : def.length;
    var total = a.__total || 1, left = PC.world.enemies().length + PC.stage.pending.length;
    var kf = Math.max(0, Math.min(1, 1 - left / total));
    x = Math.min(x, a.x + 40) ; x = Math.max(x, a.x) + kf * 0.5 * (next - a.x);
  }
  if (PC.stage.cleared) x = Math.max(x, def.length);
  return x;
}

function runEpisode(src, sc, opts) {
  opts = opts || {};
  var sb = H.loadGame(), PC = sb.PC;
  PC.audio.enabled = false;
  PC.rand = PC.RNG(sc.seed); PC.fxRand = PC.RNG(sc.seed ^ 0x5bd1e995);
  var ctx = compile(src), mem = {};

  PC.game.coin(); PC.game.startGame(0);
  PC.stage.load(sc.stage); PC.game.stageIndex = sc.stage;
  var def = PC.stage.def, enc = def.encounters[sc.enc];
  PC.stage.encIndex = sc.enc;                         // the fights before this are 'already won'
  var startX = Math.max(20, enc.x - sc.dist);
  var p = PC.game.players[0];
  p.reviveAt(startX, PC.FLOOR_BOT - 16 - Math.floor(((sc.seed >> 3) % 40)));
  p.hp = Math.round(p.maxHp * sc.hp); p.invuln = 0;
  PC.world.add(p);
  PC.world.camX = Math.max(0, Math.min(def.length - 4, startX - PC.W * 0.42));
  PC.game.lives[0] = 1; PC.game.credits = 0;
  if (sc.weapon) { try { PC.items.spawn('weapon', sc.weapon, startX + 40, p.y); } catch (e) { } }
  PC.game.setState('play'); PC.game.stateT = 200;
  PC.stage.timeLeft = def.time;

  // tag each encounter's size when it starts, for kill-fraction progress
  var origStart = PC.stage.startEncounter;
  PC.stage.startEncounter = function (e) { var r = origStart.call(this, e); e.__total = (PC.world.enemies().length + this.pending.length) || 1; return r; };

  // telemetry
  var T = { attacks: 0, basic: 0, special: 0, weapon: 0, frames: 0, hurt: 0, kills: 0, dealt: 0, crash: null, dist: 0, nearSum: 0, nearN: 0 };
  var origAtk = PC.Actor.prototype.startAttack;
  PC.Actor.prototype.startAttack = function (d) {
    if (this.team === 0) { T.attacks++; T[classify(d.pose || '')]++; }
    return origAtk.call(this, d);
  };
  var lastHp = p.hp;

  var start = stageProgress(PC), best = start;
  var prev = {}, f, done = false, why = 'budget';
  var held = PC.input.p[0];
  var frameNo = 0;
  PC.input.poll = function () {
    for (var pi = 0; pi < 2; pi++) { var s = this.p[pi]; for (var k in s.held) { s.held[k] = false; s.pressed[k] = false; s.released[k] = false; } s.tapDir = 0; }
    this.coin = this.pause = this.mute = this.fullscreen = false; this.anyKey = false;
    var pl = PC.game.players[0];
    if (PC.game.state !== 'play' || !pl || pl.dead) return;
    var out = null;
    try {
      ctx.__o = observe(PC, pl, held, mem, frameNo); ctx.__mem = mem;
      out = vm.runInContext('think(__o, __mem)', ctx, { timeout: 20 });
    } catch (e) { T.crash = String(e && e.message || e).slice(0, 120); return; }
    var st = this.p[0];
    for (var b = 0; b < BUTTONS.length; b++) {
      var name = BUTTONS[b], on = !!(out && out[name]);
      if (on) { st.held[name] = true; if (!prev[name]) st.pressed[name] = true; }
      else if (prev[name]) st.released[name] = true;
      prev[name] = on;
    }
    T.frames++;
    if (pl.hp < lastHp) T.hurt += lastHp - pl.hp; lastHp = pl.hp;
    var es = PC.world.enemies();
    if (es.length && PC.stage.locked) {
      var nd = 1e9; for (var q = 0; q < es.length; q++) nd = Math.min(nd, Math.abs(es[q].x - pl.x) + Math.abs(es[q].y - pl.y));
      T.nearSum += nd; T.nearN++;
    }
  };

  for (f = 0; f < sc.frames; f++) {
    frameNo = f;
    if (T.crash) { why = 'crash'; break; }
    try { PC.game.update(); } catch (e) { T.crash = 'engine: ' + String(e && e.message).slice(0, 100); why = 'engine'; break; }
    var g = PC.game;
    var sp = stageProgress(PC); if (sp > best) best = sp;
    if (g.state === 'over' || (g.state === 'continue')) { why = 'died'; break; }
    if (g.state !== 'play' && g.state !== 'ready' && g.state !== 'clear') { why = g.state; break; }
    if (g.state === 'clear' || PC.stage.cleared && PC.stage.atEnd()) { why = 'cleared'; best = Math.max(best, def.length); break; }
  }
  PC.Actor.prototype.startAttack = origAtk;
  var span = Math.max(60, def.length - start);
  var q = Math.max(0, Math.min(1, (best - start) / span));
  var secs = Math.max(1, T.frames / 60);
  return {
    q: q, why: why, frames: f, start: Math.round(start), best: Math.round(best), crash: T.crash,
    rate: T.attacks / secs, special: T.attacks ? (T.special + T.weapon) / T.attacks : 0,
    near: T.nearN ? T.nearSum / T.nearN : null, hurt: Math.round(T.hurt), attacks: T.attacks,
    sc: sc
  };
}

module.exports = { runEpisode: runEpisode, feasibility: feasibility, makeScenario: makeScenario, MAX_CHARS: MAX_CHARS, MAX_LINES: MAX_LINES, compile: compile };
