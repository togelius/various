/* VANGUARD ZERO in Node, without a browser.
 *
 * The evolution loop needs two things the Playwright harness cannot give it
 * cheaply. Speed: a reactive controller costs almost nothing per frame, so the
 * browser round-trip would dominate. And containment: evolved controllers are
 * LLM-written code, and they have to run where they cannot reach the game they
 * are being scored on - a controller that writes `player.x = goal` would win.
 *
 * So the game's own sources are loaded, unmodified and in index.html order,
 * into a `vm` context whose DOM is a set of stubs. Nothing the game does in
 * update() touches the DOM in a way that matters; drawing goes to canvases
 * that discard everything. Physics, collision, enemies, bosses and the random
 * stream are the real code, so a score here is a score in the game.
 *
 *   const H = require('./headless');
 *   const vz = H.boot();            // { VZ, game, context }
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const ORDER = [
  'js/core.js', 'js/audio.js', 'js/music.js', 'js/art.js', 'js/sprites.js',
  'js/fx.js', 'js/level.js', 'js/entities.js', 'js/enemies.js', 'js/bosses.js',
  'js/levels.js', 'js/game.js'
];

// A 2D context that accepts everything and draws nothing. The few calls whose
// return value the art code uses (pixel buffers, gradients) return real shapes.
function fakeContext(canvas) {
  const pix = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
  const special = {
    canvas,
    createImageData: (w, h) => pix(w | 0, h | 0),
    getImageData: (x, y, w, h) => pix(w | 0, h | 0),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => ({}),
    measureText: () => ({ width: 0 })
  };
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k in special) return special[k];
      if (k in t) return t[k];
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

function fakeCanvas() {
  const c = { width: 1, height: 1, style: {} };
  let ctx = null;
  c.getContext = () => (ctx || (ctx = fakeContext(c)));
  c.getBoundingClientRect = () => ({ width: 0, height: 0, left: 0, top: 0 });
  c.addEventListener = () => {};
  return c;
}

function makeGlobals() {
  const noop = () => {};
  const mem = {};
  const g = {
    console,
    Math, JSON, Date, Object, Array, Number, String, Boolean, Symbol, Map, Set,
    WeakMap, Uint8Array, Uint8ClampedArray, Int16Array, Float32Array, Float64Array,
    Int32Array, Uint16Array, Uint32Array, Error, TypeError, RangeError, Proxy, Reflect,
    parseInt, parseFloat, isNaN, isFinite, Infinity, NaN,
    innerWidth: 960, innerHeight: 540,
    addEventListener: noop, removeEventListener: noop,
    requestAnimationFrame: noop, cancelAnimationFrame: noop,
    setTimeout: noop, clearTimeout: noop,
    navigator: { getGamepads: () => [], userAgent: 'node' },
    localStorage: {
      getItem: k => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: k => { delete mem[k]; }
    },
    document: {
      createElement: () => fakeCanvas(),
      getElementById: () => null,
      addEventListener: noop,
      body: { appendChild: noop, classList: { add: noop, remove: noop, toggle: noop } },
      documentElement: { style: {} }
    }
    // No AudioContext: audio.init() sees none and disables itself.
  };
  return g;
}

/* Boot one independent copy of the game. Each evaluation worker owns one, so
 * state never leaks between controllers being compared. */
function boot() {
  const context = vm.createContext(makeGlobals());
  vm.runInContext('var window = globalThis;', context);
  for (const f of ORDER) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    vm.runInContext(src, context, { filename: f });
  }
  vm.runInContext(`
    VZ.art.buildFont();
    VZ.sprites.build();
    VZ.input.init();
    VZ.audio.enabled = false;
    VZ.game = new VZ.Game();
  `, context);
  const VZ = context.VZ;
  return { VZ, game: VZ.game, context };
}

module.exports = { boot, ROOT };
