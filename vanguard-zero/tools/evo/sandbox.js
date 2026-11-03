/* Running an evolved controller, safely and reproducibly, and scoring it.
 *
 * A controller is a small JavaScript program with one entry point,
 * `control(obs, mem)`, returning the buttons to hold this frame. SPEC.md is the
 * contract, and it is the same text the LLM is shown.
 *
 * Containment. Each controller gets its own `vm` context that holds nothing but
 * the JavaScript builtins and a short prelude. The observation crosses the
 * boundary as a JSON string and is parsed inside, so every object the program
 * can touch was made in its own realm and no prototype chain leads back to
 * Node or to the game. The answer crosses back as an integer bitmask. Each
 * frame runs under a timeout, so an infinite loop costs one frame budget and
 * a verdict, not the run. `Math.random` is replaced with a seeded generator so
 * every evaluation is reproducible.
 *
 * Static checks are a second line, and mostly a way of telling the LLM the
 * rules in a form it gets immediate feedback on: the size limit, and a short
 * list of names a controller has no business using.
 */
'use strict';
const vm = require('vm');

const LIMITS = {
  // The size limit on an evolved controller, in characters of source. Over
  // this a controller still runs, but it is infeasible: it can only sit in the
  // archive's infeasible pool, where the repair operator compresses it.
  MAX_CHARS: 4000,
  // Past this it is not even evaluated.
  HARD_MAX_CHARS: 8000,
  // Wall-clock per frame. A real controller needs microseconds.
  FRAME_MS: 25,
  // Fraction of frames allowed to throw before a controller is infeasible.
  MAX_ERROR_RATE: 0.02
};

const FORBIDDEN = [
  'require', 'process', 'import', 'globalThis', 'global', 'window', 'self',
  'eval', 'Function', 'constructor', '__proto__', 'prototype', 'Reflect',
  'Proxy', 'Date', 'setTimeout', 'setInterval', 'WebAssembly', 'Atomics',
  'SharedArrayBuffer', 'VZ'
];

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

/* Everything a controller must satisfy before it is run at all, and the
 * size measurement that decides feasibility. */
function staticCheck(src) {
  const out = { size: src.length, forbidden: [], errors: [], oversize: 0 };
  const code = stripComments(src);
  for (const w of FORBIDDEN) {
    if (new RegExp('\\b' + w + '\\b').test(code)) out.forbidden.push(w);
  }
  if (!/\bfunction\s+control\s*\(/.test(code)) out.errors.push('no `function control(obs, mem)` found');
  if (src.length > LIMITS.HARD_MAX_CHARS) out.errors.push('over the hard size cap of ' + LIMITS.HARD_MAX_CHARS);
  out.oversize = Math.max(0, src.length - LIMITS.MAX_CHARS);
  out.runnable = out.forbidden.length === 0 && out.errors.length === 0;
  return out;
}

const PRELUDE = `
'use strict';
var __s = 0;
function __rng() {
  __s |= 0; __s = (__s + 0x6D2B79F5) | 0;
  var t = Math.imul(__s ^ (__s >>> 15), 1 | __s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
Math.random = __rng;
var mem = {};
function __reset(seed) { __s = seed | 0; mem = {}; }
function __step(json) {
  var obs = JSON.parse(json);
  var G = obs.tiles;
  obs.tile = function (dx, dy) {
    var c = G.ox + (dx | 0), r = G.oy + (dy | 0);
    if (r < 0) return '.';
    if (r >= G.rows.length) return '.';
    if (c < 0 || c >= G.rows[r].length) return '#';
    return G.rows[r][c];
  };
  var o = control(obs, mem) || {};
  return (o.left ? 1 : 0) | (o.right ? 2 : 0) | (o.up ? 4 : 0) | (o.down ? 8 : 0) |
         (o.jump ? 16 : 0) | (o.fire ? 32 : 0) | (o.dash ? 64 : 0) | (o.weapon ? 128 : 0);
}
`;
const STEP = new vm.Script('__o = __step(__i);', { filename: 'step' });
const nowMs = () => Number(process.hrtime.bigint()) / 1e6;
const BUTTONS = ['left', 'right', 'up', 'down', 'jump', 'fire', 'dash', 'weapon'];

function decode(bits) {
  const o = {};
  for (let i = 0; i < BUTTONS.length; i++) if (bits & (1 << i)) o[BUTTONS[i]] = true;
  return o;
}

class Controller {
  constructor(src) {
    this.ctx = vm.createContext({});
    vm.runInContext(PRELUDE, this.ctx, { timeout: 200 });
    // Top-level code runs once, under the same kind of limit.
    vm.runInContext(src, this.ctx, { filename: 'controller.js', timeout: 200 });
    if (typeof this.ctx.control !== 'function') throw new Error('control is not a function');
  }
  reset(seed) { vm.runInContext('__reset(' + (seed | 0) + ')', this.ctx, { timeout: 50 }); }
  /* No per-call vm timeout here: Node starts a watchdog for each one, and that
   * alone cost 225 of the 350 microseconds a frame took. A slow frame is caught
   * by timing it, and a frame that never returns is caught one level up, where
   * the worker running this evaluation is killed at its deadline (pool.js). */
  step(json) {
    this.ctx.__i = json;
    const t0 = nowMs();
    STEP.runInContext(this.ctx);
    if (nowMs() - t0 > LIMITS.FRAME_MS) throw new Error('frame timed out');
    return this.ctx.__o | 0;
  }
}

// ------------------------------------------------------------- observation
const TILE_CHAR = { 0: '.', 1: '#', 2: '=', 3: '^', 4: '^', 5: '~', 6: 'c', 7: '>', 8: '<', 9: '|', 10: '^', 11: '^' };
const COLS = 25, ROWS = 15, OX = 12, OY = 9;  // 12 tiles either side, 9 up, 5 down
const NEAR = 320;

function kindOf(e) { return (e.def && e.def.kind) || (e.isBoss ? 'boss' : 'enemy'); }

function observe(VZ, g, t) {
  const p = g.player, lv = g.level, T = VZ.TILE;
  const ftx = Math.floor(p.x / T), fty = Math.floor((p.y + p.h / 2 - 1) / T);
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    let s = '';
    const ty = fty - OY + r;
    for (let c = 0; c < COLS; c++) {
      const tx = ftx - OX + c;
      const id = lv.at(tx, ty);
      let ch = TILE_CHAR[id] || '.';
      if (id === 6 && lv.crumble[tx + ',' + ty] > 0) ch = 'C';
      s += ch;
    }
    rows.push(s);
  }
  const enemies = [], shots = [], pickups = [];
  for (const e of g.enemies) {
    if (e.dead) continue;
    const dx = e.x - p.x, dy = e.y - p.y;
    if (Math.abs(dx) > NEAR || Math.abs(dy) > NEAR) continue;
    enemies.push({ dx: Math.round(dx), dy: Math.round(dy), w: e.w, h: e.h,
      vx: +(e.vx || 0).toFixed(2), vy: +(e.vy || 0).toFixed(2), hp: e.hp,
      kind: kindOf(e), facing: e.facing || 0 });
  }
  enemies.sort((a, b) => (a.dx * a.dx + a.dy * a.dy) - (b.dx * b.dx + b.dy * b.dy));
  for (const s of g.projectiles) {
    if (s.team !== 'enemy' || s.remove) continue;
    const dx = s.x - p.x, dy = s.y - p.y;
    if (Math.abs(dx) > NEAR || Math.abs(dy) > NEAR) continue;
    shots.push({ dx: Math.round(dx), dy: Math.round(dy), w: s.w, h: s.h,
      vx: +s.vx.toFixed(2), vy: +s.vy.toFixed(2), warn: s.warn > 0 ? s.warn : 0 });
  }
  shots.sort((a, b) => (a.dx * a.dx + a.dy * a.dy) - (b.dx * b.dx + b.dy * b.dy));
  for (const k of g.pickups) {
    const dx = k.x - p.x, dy = k.y - p.y;
    if (Math.abs(dx) > NEAR || Math.abs(dy) > NEAR) continue;
    pickups.push({ dx: Math.round(dx), dy: Math.round(dy), kind: k.kind });
  }
  const b = g.boss && !g.boss.dying ? g.boss : null;
  const gate = lv.bossGate ? lv.bossGate.x : g.arena.x0;
  return JSON.stringify({
    t,
    stage: g.stageIndex,
    me: {
      x: +p.x.toFixed(1), y: +p.y.toFixed(1), vx: +p.vx.toFixed(2), vy: +p.vy.toFixed(2),
      w: p.w, h: p.h, ground: !!p.grounded, wall: p.wallDir | 0, sliding: !!p.sliding,
      facing: p.facing, hp: p.hp, maxHp: p.maxHp, energy: p.energy,
      dashReady: p.dashCool <= 0 && p.dashTime <= 0 && (p.grounded || p.airDash),
      dashing: p.dashTime > 0, charge: p.chargeLevel | 0,
      hurt: p.hurtTime > 0, invuln: p.invuln > 0, weapon: p.weapon | 0
    },
    goalDx: g.bossStarted ? 0 : Math.round(gate - p.x),
    inArena: !!g.bossStarted,
    tiles: { ox: OX, oy: OY, rows },
    enemies: enemies.slice(0, 12),
    shots: shots.slice(0, 16),
    pickups: pickups.slice(0, 6),
    boss: b ? { dx: Math.round(b.x - p.x), dy: Math.round(b.y - p.y), w: b.w, h: b.h,
                hp: b.hp, maxHp: b.maxHp, state: String(b.state || '') } : null
  });
}

// ----------------------------------------------------------------- episode
/* Install recorders on the world once: why the player died, and how many shots
 * actually left the gun. They only note what the game already decided; nothing
 * about play changes. Shots are counted at the source because fire is
 * edge-triggered - frames with the button held say nothing about how much a
 * controller shoots, since holding it fires once and then only charges. */
function instrument(VZ) {
  if (VZ.__evoHooked) return;
  VZ.__evoHooked = true;
  const kill = VZ.Player.prototype.kill;
  VZ.Player.prototype.kill = function (cause) {
    // A lethal hit always arrives as 'damage'; what landed it is more useful.
    if (!this.dead) this.deathCause = (cause === 'damage' && this.lastHitSrc) ? this.lastHitSrc : (cause || 'damage');
    return kill.call(this, cause);
  };
  const fire = VZ.Player.prototype.fire, special = VZ.Player.prototype.fireSpecial;
  VZ.Player.prototype.fire = function (level) {
    const before = this.game.projectiles.length;
    const r = fire.call(this, level);
    if (this.game.projectiles.length > before) this.shotsFired = (this.shotsFired || 0) + 1;
    return r;
  };
  VZ.Player.prototype.fireSpecial = function () {
    const before = this.game.projectiles.length;
    const r = special.call(this);
    if (this.game.projectiles.length > before) this.shotsFired = (this.shotsFired || 0) + 1;
    return r;
  };
}

// Sustained buster fire tops out near this: one shot per 7 frames, three on
// screen. Aggression is shots per second against it, capped at 1.
const MAX_SHOTS_PER_SEC = 4;

/* Talakat's entropy feature: the information entropy of the first, second and
 * third derivatives of an action channel. Histograms are pooled across every
 * episode before the entropy is taken, and normalised by the size of the
 * support each derivative could possibly have, so the scale is fixed and
 * comparable between controllers rather than relative to what each happened
 * to do. */
const SUPPORT = { h: [5, 9, 17], j: [3, 5, 9] };
function newHist() { return { h: [{}, {}, {}], j: [{}, {}, {}] }; }
function entropyOf(hist, support) {
  let total = 0; for (const k in hist) total += hist[k];
  if (total < 8) return 0;
  let h = 0;
  for (const k in hist) { const p = hist[k] / total; h -= p * Math.log2(p); }
  return h / Math.log2(support);
}
function entropyFromHist(H) {
  let s = 0;
  for (const ch of ['h', 'j']) for (let d = 0; d < 3; d++) s += entropyOf(H[ch][d], SUPPORT[ch][d]);
  return s / 6;
}

function setupTask(world, task) {
  const { VZ, game: g } = world;
  instrument(VZ);
  if (g.loop) g.loop.stop();
  g.lives = 0; g.score = 0; g.player = null;
  VZ.rand.setState(task.seed);
  g.loadStage(task.stage, false);
  const p = g.player;
  p.unlocked = [true, task.stage >= 1, task.stage >= 2];
  g.setState('play');
  g.fade = 0; g.fadeTarget = 0; g.fadeCb = null;
  p.x = task.x; p.y = task.y; p.vx = 0; p.vy = 0; p.facing = 1;
  g.respawnPoint = { x: task.x, y: task.y };
  g.camera.follow(p, true);
  VZ.input.virtual = {};
}

function runEpisode(world, ctrl, task) {
  const { VZ, game: g } = world;
  setupTask(world, task);
  ctrl.reset(task.seed);
  const p = g.player, lv = g.level;
  const gate = lv.bossGate ? lv.bossGate.x : g.arena.x0;
  const x0 = p.x;
  let maxX = p.x, lastGain = 0, f = 0, end = 'time';
  let air = 0, live = 0, errors = 0, timeouts = 0, lastErr = '';
  p.shotsFired = 0;
  const H = newHist();
  const prev = { h: [0, 0, 0], j: [0, 0, 0] };
  const hp0 = p.hp;
  // Where it last had its feet down: for a fall, that is where the mistake was.
  let from = { x: p.x, y: p.y };

  for (f = 0; f < task.frames; f++) {
    let bits = 0;
    try {
      bits = ctrl.step(observe(VZ, g, f));
    } catch (e) {
      if (/timed out/i.test(e.message)) { timeouts++; end = 'timeout'; break; }
      errors++; lastErr = String(e.message).slice(0, 160);
    }
    const inp = decode(bits);
    VZ.input.virtual = inp;
    g.update();

    if (g.playerControl !== false && !p.dead) {
      live++;
      if (!p.grounded) air++;
      // derivative chains for the two movement channels
      const vals = { h: (inp.right ? 1 : 0) - (inp.left ? 1 : 0), j: inp.jump ? 1 : 0 };
      for (const ch of ['h', 'j']) {
        const a = vals[ch], st = prev[ch];
        const d1 = a - st[0], d2 = d1 - st[1], d3 = d2 - st[2];
        if (live > 3) { H[ch][0][d1] = (H[ch][0][d1] || 0) + 1; H[ch][1][d2] = (H[ch][1][d2] || 0) + 1; H[ch][2][d3] = (H[ch][2][d3] || 0) + 1; }
        st[0] = a; st[1] = d1; st[2] = d2;
      }
    }
    if (p.x > maxX + 0.5) { maxX = p.x; lastGain = f; }
    if (p.grounded && !p.dead) from = { x: p.x, y: p.y };
    if (p.dead) { end = 'died:' + (p.deathCause || 'damage'); break; }
    if (task.kind === 'boss' && (g.bossDefeated || g.stageEndTimer > 0)) { end = 'won'; break; }
    if (task.kind === 'run' && g.bossStarted) { end = 'reached'; break; }
    // No new ground in 12 seconds outside a boss fight: it is not coming.
    if (!g.bossStarted && f - lastGain > 720) { end = 'stalled'; break; }
  }
  VZ.input.virtual = {};

  let progress;
  if (task.kind === 'boss') {
    if (end === 'won' || g.bossDefeated) progress = 1;
    else if (g.bossStarted && g.boss) progress = Math.max(0, 1 - g.boss.hp / g.boss.maxHp);
    else progress = 0;
  } else {
    progress = end === 'reached' ? 1 : Math.max(0, Math.min(1, (maxX - x0) / (gate - x0)));
  }
  return {
    id: task.id, stage: task.stage, kind: task.kind, x0: Math.round(x0),
    progress, end, frames: f, maxX: Math.round(maxX),
    at: { x: Math.round(p.x), y: Math.round(p.y) },
    from: { x: Math.round(from.x), y: Math.round(from.y) },
    hpLost: Math.max(0, hp0 - Math.max(0, p.hp)),
    shots: p.shotsFired | 0, kills: p.kills | 0,
    air, live, errors, timeouts, lastErr, hist: H
  };
}

/* Evaluate one controller source on a list of tasks. Returns the quality
 * (mean progress), the two behaviour descriptors, the constraint verdict and
 * the per-task detail the LLM gets back as feedback. */
function evaluate(world, src, tasks) {
  const chk = staticCheck(src);
  const res = { check: chk, feasible: false, violation: Infinity, quality: 0, tasks: [] };
  if (!chk.runnable) { res.fatal = chk.forbidden.length ? 'forbidden: ' + chk.forbidden.join(', ') : chk.errors.join('; '); return res; }
  let ctrl;
  try { ctrl = new Controller(src); }
  catch (e) { res.fatal = 'does not compile: ' + String(e.message).slice(0, 200); return res; }

  const H = newHist();
  let shots = 0, live = 0, frames = 0, errors = 0, timeouts = 0, lastErr = '';
  for (const t of tasks) {
    const r = runEpisode(world, ctrl, t);
    res.tasks.push(r);
    shots += r.shots; live += r.live; frames += r.frames; errors += r.errors; timeouts += r.timeouts;
    if (r.lastErr) lastErr = r.lastErr;
    for (const ch of ['h', 'j']) for (let d = 0; d < 3; d++) {
      for (const k in r.hist[ch][d]) H[ch][d][k] = (H[ch][d][k] || 0) + r.hist[ch][d][k];
    }
    delete r.hist;
    if (timeouts) break;    // a controller that hangs once is not worth more wall-clock
  }
  res.quality = res.tasks.reduce((s, r) => s + r.progress, 0) / tasks.length;
  res.shotsPerSec = live ? shots / (live / 60) : 0;
  res.aggression = Math.min(1, res.shotsPerSec / MAX_SHOTS_PER_SEC);
  res.entropy = entropyFromHist(H);
  res.frames = frames;
  res.errorRate = frames ? errors / frames : 0;
  res.timeouts = timeouts;
  res.lastErr = lastErr;
  // Constraint violation, after Talakat's constrained MAP-Elites: zero means
  // feasible; otherwise smaller is closer to feasible.
  res.violation = chk.oversize / LIMITS.MAX_CHARS +
                  Math.max(0, res.errorRate - LIMITS.MAX_ERROR_RATE) * 10 +
                  (timeouts ? 1 : 0);
  res.feasible = res.violation === 0;
  return res;
}

module.exports = { LIMITS, FORBIDDEN, staticCheck, Controller, observe, evaluate, runEpisode, setupTask, decode };
