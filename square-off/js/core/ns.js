// SQUARE OFF — core namespace: utilities, seeded RNG, event bus.
// Headless: never touches THREE/document/window beyond attaching SQ.
(function (SQ) {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    function rng() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    rng.state = function () { return a; };
    rng.setState = function (s) { a = s >>> 0; };
    rng.int = function (n) { return Math.floor(rng() * n); };
    rng.range = function (lo, hi) { return lo + (hi - lo) * rng(); };
    rng.pick = function (arr) { return arr.length ? arr[Math.floor(rng() * arr.length)] : undefined; };
    rng.chance = function (p) { return rng() < p; };
    rng.shuffle = function (arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    };
    return rng;
  }

  // 32-bit string/number hash (FNV-1a).
  function hash(input) {
    const s = String(input);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // Integer hash for cheap deterministic per-entity noise.
  function hash2(a, b) {
    let h = Math.imul((a | 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((b | 0) + 0x632BE5AB, 0xC2B2AE35);
    h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12;
    return h >>> 0;
  }

  /** Derive an independent RNG stream from a seed and a salt string. */
  function rngStream(seed, salt) { return mulberry32(hash(String(seed) + ':' + salt)); }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
  function dist(ax, az, bx, bz) { return Math.sqrt(dist2(ax, az, bx, bz)); }

  function pointInPoly(x, z, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) inside = !inside;
    }
    return inside;
  }

  function segDist2(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const L = dx * dx + dz * dz;
    let t = L > 0 ? ((px - ax) * dx + (pz - az) * dz) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + t * dx - px, qz = az + t * dz - pz;
    return qx * qx + qz * qz;
  }

  function fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /** Simple synchronous event emitter. Handlers that throw are isolated. */
  function createBus() {
    const map = Object.create(null);
    return {
      on(name, fn) { (map[name] || (map[name] = [])).push(fn); return fn; },
      off(name, fn) {
        const list = map[name];
        if (!list) return;
        const i = list.indexOf(fn);
        if (i >= 0) list.splice(i, 1);
      },
      once(name, fn) {
        const self = this;
        function w(p) { self.off(name, w); fn(p); }
        return this.on(name, w);
      },
      emit(name, payload) {
        const list = map[name];
        if (list) {
          for (const fn of list.slice()) {
            try { fn(payload, name); } catch (err) { if (typeof console !== 'undefined') console.error('[bus]', name, err); }
          }
        }
        const any = map['*'];
        if (any) for (const fn of any.slice()) { try { fn(payload, name); } catch (err) { if (typeof console !== 'undefined') console.error('[bus*]', name, err); } }
      },
      clear() { for (const k of Object.keys(map)) delete map[k]; },
    };
  }

  SQ.util = { mulberry32, rngStream, hash, hash2, clamp, lerp, dist, dist2, pointInPoly, segDist2, fmtClock, createBus };
  SQ.bus = SQ.bus || createBus();
  SQ.data = SQ.data || {};
})(window.SQ = window.SQ || {});
