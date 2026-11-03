// Static + smoke checks for an evolved controller. A controller that fails here is "infeasible" (Talakat's term):
// it is not thrown away but kept in an infeasible pool, from which the LLM is later asked to repair it.
const vm = require('vm');

const LIMITS = { maxChars: 3500, maxLines: 110, libChars: 1800 };
const FORBID = /\b(window|document|globalThis|self|tallOrder|eval|Function|fetch|XMLHttpRequest|import|require|process|constructor|__proto__|prototype|setTimeout|setInterval|while|do|async|await|yield)\b/;

const SAMPLE_OBS = {
  t: 3.2, hp: 80, x: 4, y: 0, z: 20, yaw: -1.57, floor: 0, ground: true, hang: false, carried: false, rider: false, dead: false, climbing: false,
  speed: 3, vy: 0, head: null, goal: { kind: 'stairs', d: 12, b: 0.1 }, aim: { hit: 'wolf', out: null, dir: 0 }, drop: { f: 9, l: 9, r: 9 },
  foes: [{ k: 'wolf', d: 5, b: -0.2, dy: 0, hp: 4, st: 'chase', awake: true, band: true }, { k: 'kitty', d: 2, b: 1, dy: 3.8, hp: 2, st: 'idle', awake: false, band: false }],
  shots: [{ k: 'shell', shootable: true, d: 6, b: 0.3, dy: 2 }], items: [{ k: 'juice', d: 3, b: 0.5, dy: 0 }], inv: [{ k: 'rocket', n: 3 }], sel: 0,
};

function check(code, opts = {}) {
  const maxChars = opts.maxChars || LIMITS.maxChars, lib = opts.lib || '';
  if (typeof code !== 'string' || !code.trim()) return { ok: false, kind: 'empty', reason: 'empty controller' };
  if (code.length > maxChars) return { ok: false, kind: 'size', reason: `controller is ${code.length} characters; the limit is ${maxChars}. Shorten it by ${code.length - maxChars}+ characters` };
  const lines = code.split('\n').length;
  if (lines > LIMITS.maxLines) return { ok: false, kind: 'size', reason: `controller has ${lines} lines; the limit is ${LIMITS.maxLines}` };
  const bad = (lib + '\n' + code).match(FORBID);
  if (bad) return { ok: false, kind: 'forbidden', reason: `uses forbidden word "${bad[0]}" (no while/do loops, no globals, no async)` };
  for (const m of code.matchAll(/\bfor\s*\(([^)]*)\)/g)) if (!/\b(of|in)\b|[<>]/.test(m[1])) return { ok: false, kind: 'forbidden', reason: 'a for loop has no bound: ' + m[0] };
  if (!/function\s+step\s*\(/.test(code)) return { ok: false, kind: 'shape', reason: 'must define `function step(o, m)`' };
  let fn;
  try { fn = new Function('"use strict";\n' + lib + '\n' + code + '\n;return step;'); } catch (e) { return { ok: false, kind: 'syntax', reason: 'syntax error: ' + e.message }; }
  try {
    const sandbox = { Math, JSON, Number, Array, Object, Infinity, NaN, isFinite, isNaN, Boolean, String };
    vm.createContext(sandbox);
    const src = '"use strict";\n' + lib + '\n' + code + '\n;(function(){const m={};let a;for(let i=0;i<3;i++){a=step(' + JSON.stringify(SAMPLE_OBS) + ',m);}return a;})()';
    const out = vm.runInContext(src, sandbox, { timeout: 100 });
    if (!out || typeof out !== 'object') return { ok: false, kind: 'shape', reason: 'step must return an object like {turn, move, fire, jump, use, sel}' };
  } catch (e) { return { ok: false, kind: 'runtime', reason: 'runtime error on a sample observation: ' + String(e.message || e).slice(0, 160) }; }
  return { ok: true };
}
module.exports = { check, LIMITS, FORBID };
