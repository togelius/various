// Controllers are source code (function think(o, m) { ... return action }) written by an LLM, so before one touches the
// game it is checked and run in a context of its own:
//   - a hard size limit (characters and lines, comments included),
//   - static bans: unbounded loops, eval, Function, process, require, import, globalThis, async, getters on the prototype chain ...
//   - a compile + smoke test on canned observations,
//   - at run time: its own vm context, a time limit per call, and only JSON crossing the boundary.
// Like Tall Order's validator this keeps honest LLM output from hanging a worker; it is NOT a security boundary. Do not
// run controllers you do not trust.
'use strict';
const vm = require('node:vm');

const LIMITS = { maxChars: 4000, maxLines: 120, thinkMs: 60, initMs: 100 };

const BANNED = [
  [/\bwhile\b/, 'while loops are not allowed (use a bounded for loop)'],
  [/\bdo\b\s*\{/, 'do-while loops are not allowed'],
  [/\beval\b/, 'eval is not allowed'], [/\bFunction\b/, 'Function is not allowed'], [/\bconstructor\b/, 'constructor is not allowed'], [/__proto__|\bprototype\b/, 'prototype access is not allowed'],
  [/\b(process|require|import|globalThis|global|window|document|module|exports|setTimeout|setInterval|Buffer|fetch|XMLHttpRequest|WebAssembly|Reflect|Proxy|Symbol|SharedArrayBuffer|Atomics)\b/, 'forbidden global'],
  [/\b(async|await|yield)\b/, 'async code is not allowed'], [/\bDate\b|\bperformance\b/, 'Date and performance are not available (use o.t for time)'],
];

// strip comments and string literals so the bans only look at code
function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, '""');
}

// canned observations for the smoke test: foot with a goal, car with a goal, nothing to see, dialogue up
function smokeObs() {
  const me = { x: 100, z: 100, h: 0.5, mode: 'foot', spd: 0, hp: 100, armor: 0, wanted: 0, money: 500, alive: true, weapon: 'fist', ammo: 99, fire: false };
  const base = { t: 0, hour: 12, rain: 0, me, ui: { dialogue: false, shop: false, retry: false, choice: null }, mission: { name: null, next: 'REPO MAN', done: 1, timer: -1, text: '' },
    goal: { x: 300, z: 200, d: 223, f: 150, r: -160, b: -0.8, kind: 'place' }, gps: { d: 260, b: -0.6, b2: -0.3, b3: 0, wd: 12 }, rays: [20, 20, 20, 20, 20, 20, 20],
    cars: [{ f: 5, r: 3, d: 6, b: 0.5, spd: 0, vf: 0, kind: 'parked', len: 4.6, wid: 2, free: true, goal: false }], peds: [{ f: 8, r: -2, d: 8, b: -0.2, kind: 'civ', hostile: false, down: false, goal: false }], enter: { d: 3, b: 0.4, free: true, goal: false } };
  const clone = o => JSON.parse(JSON.stringify(o));
  const car = clone(base); car.me.mode = 'car'; car.me.spd = 8; car.car = { spd: 8, lat: 0.2, hp: 0.9, len: 4.6, wid: 2, type: 'sedan', burning: false, air: false, yaw: 0.1 }; car.enter = null;
  const none = clone(base); none.goal = null; none.gps = null; none.cars = []; none.peds = []; none.enter = null;
  const dlg = clone(base); dlg.ui.dialogue = true; const dead = clone(base); dead.me.alive = false; dead.goal = null; dead.gps = null;
  const choice = clone(base); choice.ui.choice = ['Take the deal', 'Walk away'];
  return [base, car, none, dlg, dead, choice];
}

// returns { ok: true } or { ok: false, reason }
function validate(code, limits = LIMITS) {
  if (typeof code !== 'string' || !code.trim()) return { ok: false, reason: 'empty controller' };
  if (code.length > limits.maxChars) return { ok: false, reason: `too long: ${code.length} characters (limit ${limits.maxChars})`, tooLong: true };
  const lines = code.split('\n').length; if (lines > limits.maxLines) return { ok: false, reason: `too long: ${lines} lines (limit ${limits.maxLines})`, tooLong: true };
  const bare = codeOnly(code);
  for (const [re, why] of BANNED) if (re.test(bare)) return { ok: false, reason: why };
  if (!/function\s+think\s*\(/.test(bare) && !/\bthink\s*=/.test(bare)) return { ok: false, reason: 'no function think(o, m) defined' };
  let c; try { c = new Controller(code, 1, limits); } catch (e) { return { ok: false, reason: 'does not compile: ' + String(e.message).slice(0, 160) }; }
  for (const o of smokeObs()) { const r = c.step(o); if (r.error) return { ok: false, reason: 'throws on a plain observation: ' + r.error }; }
  return { ok: true, chars: code.length, lines };
}

class Controller {
  constructor(code, seed, limits = LIMITS) {
    this.limits = limits; this.errors = 0; this.firstError = null; this.calls = 0; this.slow = 0;
    this.ctx = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
    vm.runInContext('(() => { let s = ' + ((seed >>> 0) ^ 0xA5A5A5A5) + ' >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();', this.ctx);
    vm.runInContext(code, this.ctx, { timeout: limits.initMs, filename: 'controller.js' });
    if (vm.runInContext('typeof think', this.ctx) !== 'function') throw new Error('think is not a function');
    vm.runInContext('var __m = {};', this.ctx);
    this.script = new vm.Script('__r = JSON.stringify(think(JSON.parse(__in), __m)) || "{}";', { filename: 'step.js' });
  }
  // obs: a plain object. returns the action object ({} on any failure), with .error set when the call threw or timed out
  step(obs) {
    this.calls++;
    try {
      this.ctx.__in = JSON.stringify(obs);
      const t0 = process.hrtime.bigint();
      this.script.runInContext(this.ctx, { timeout: this.limits.thinkMs });
      if (Number(process.hrtime.bigint() - t0) / 1e6 > this.limits.thinkMs * 0.5) this.slow++;
      const a = JSON.parse(this.ctx.__r); return a && typeof a === 'object' && !Array.isArray(a) ? a : {};
    } catch (e) {
      this.errors++; const msg = /timed out/i.test(String(e.message)) ? 'timed out (over ' + this.limits.thinkMs + ' ms in one call)' : String(e.message).slice(0, 140);
      if (!this.firstError) this.firstError = msg; return { error: msg };
    }
  }
}

module.exports = { LIMITS, validate, Controller, codeOnly };
