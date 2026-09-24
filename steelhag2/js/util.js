'use strict';
// Small shared helpers: seeded randomness, 1-D noise, colour maths, canvases.

const TAU = Math.PI * 2;
const VIEW_W = 1280, VIEW_H = 720;

function rng32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed) {
  const r = rng32(seed), p = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) p[i] = r();
  return function (x) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return p[i & 1023] * (1 - u) + p[(i + 1) & 1023] * u;
  };
}

function fbm(n, x, oct = 4) {
  let s = 0, a = 0.5, f = 1, t = 0;
  for (let i = 0; i < oct; i++) { s += a * n(x * f + i * 17.3); t += a; a *= 0.5; f *= 2.03; }
  return s / t;
}

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const gauss = r => (r() + r() + r() - 1.5) / 1.5;

function hex(h) {
  if (Array.isArray(h)) return h;
  h = h.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function mix(a, b, t) { a = hex(a); b = hex(b); return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function css(c, a = 1) { c = hex(c); return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function shade(c, k) { return k >= 0 ? mix(c, [255, 255, 255], k) : mix(c, [0, 0, 0], -k); }
function mono(c, r, amt) { c = hex(c); const d = (r() - 0.5) * amt; return [c[0] + d, c[1] + d, c[2] + d]; }
function jit(c, r, amt) { c = hex(c); return [c[0] + (r() - 0.5) * amt, c[1] + (r() - 0.5) * amt, c[2] + (r() - 0.5) * amt]; }

// In the painting worker there is no document, only OffscreenCanvas.
function makeCanvas(w, h) {
  w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
  if (typeof document === 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Colour at height y from a list of [y, colour] stops.
function stopsAt(stops, y) {
  if (y <= stops[0][0]) return hex(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    if (y <= stops[i][0]) {
      const t = (y - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return mix(stops[i - 1][1], stops[i][1], t);
    }
  }
  return hex(stops[stops.length - 1][1]);
}
