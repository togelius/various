'use strict';
/* Load the whole of POWER CITY into a node vm with a stubbed canvas, so a
 * campaign fast-forwards without a browser. One fresh context per episode
 * keeps episodes independent and bit-reproducible. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var JS = path.join(__dirname, '..', 'js');
var ORDER = ['core','art','rig','cast','city','audio','music','fx','actors','items','player','enemies','stages','hud','game'];
var SRC = {};
ORDER.forEach(function (n) { SRC[n] = fs.readFileSync(path.join(JS, n + '.js'), 'utf8'); });

function ctxStub() {
  var h = { get: function (t, k) { if (k === 'canvas') return t.__c; if (k in t) return t[k]; return function () { return ctxStub(); }; }, set: function (t, k, v) { t[k] = v; return true; } };
  return new Proxy({ measureText: function () { return { width: 0 }; }, getImageData: function (x, y, w, hh) { return { data: new Uint8ClampedArray(Math.max(1, w * hh * 4)), width: w, height: hh }; }, createImageData: function (w, hh) { return { data: new Uint8ClampedArray(Math.max(1, w * hh * 4)), width: w, height: hh }; } }, h);
}
function makeSandbox() {
  var s = { console: console, Math: Math, Date: Date, JSON: JSON, Uint8ClampedArray: Uint8ClampedArray, Float32Array: Float32Array, Int32Array: Int32Array, Uint8Array: Uint8Array, Uint32Array: Uint32Array, setInterval: function () { return 0; }, setTimeout: function () { return 0; } };
  s.window = s; s.globalThis = s;
  s.document = {
    createElement: function () { var c = { width: 0, height: 0, style: {}, addEventListener: function () { } }; c.getContext = function () { var x = ctxStub(); x.__c = c; return x; }; return c; },
    getElementById: function () { return null; }, addEventListener: function () { }, readyState: 'complete', body: { appendChild: function () { } }
  };
  s.addEventListener = function () { }; s.requestAnimationFrame = function () { return 0; }; s.cancelAnimationFrame = function () { };
  s.localStorage = { getItem: function () { return null; }, setItem: function () { } };
  s.navigator = { getGamepads: function () { return []; } };
  s.performance = { now: function () { return 0; } };
  return s;
}
function loadGame() {
  var sb = makeSandbox(); vm.createContext(sb);
  ORDER.forEach(function (n) { vm.runInContext(SRC[n], sb, { filename: n + '.js' }); });
  return sb;
}
module.exports = { loadGame: loadGame, vm: vm };
