/* VANGUARD ZERO - core utilities, input, timing, pixel canvas
 * Classic script (no modules) so the game runs straight off the filesystem.
 */
(function (global) {
  'use strict';

  var VZ = global.VZ || (global.VZ = {});

  // ---------------------------------------------------------------- constants
  VZ.W = 384;              // internal render width
  VZ.H = 216;              // internal render height
  VZ.TILE = 16;
  VZ.FPS = 60;
  VZ.DT = 1 / 60;

  // ------------------------------------------------------------------ math
  var M = VZ.math = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    sign: function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); },
    approach: function (v, target, step) {
      if (v < target) return Math.min(v + step, target);
      if (v > target) return Math.max(v - step, target);
      return target;
    },
    dist: function (ax, ay, bx, by) {
      var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy);
    },
    angleTo: function (ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); },
    // smooth 0..1 ease
    ease: function (t) { return t * t * (3 - 2 * t); },
    wrapPi: function (a) {
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    }
  };

  // --------------------------------------------------------- deterministic RNG
  // mulberry32 - small, fast, good enough for effects & procedural art.
  VZ.RNG = function (seed) {
    var s = (seed >>> 0) || 0x9e3779b9;
    var r = function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    /* The whole generator is one 32-bit counter, so a run can be saved and
     * resumed. Nothing in the game needs that; the play agent does. It
     * projects the world forward to decide what to do, and those speculative
     * draws would otherwise consume the live stream and change the future it
     * is trying to predict. */
    r.state = function () { return s; };
    r.setState = function (v) { s = v | 0; };
    r.range = function (a, b) { return a + r() * (b - a); };
    r.int = function (a, b) { return Math.floor(a + r() * (b - a + 1)); };
    r.pick = function (arr) { return arr[Math.floor(r() * arr.length) % arr.length]; };
    r.chance = function (p) { return r() < p; };
    r.sign = function () { return r() < 0.5 ? -1 : 1; };
    return r;
  };
  VZ.rand = VZ.RNG(0x5eed1234);

  /* Difficulty ramp, by stage. Everything routed through Player.takeHit is
   * scaled by this - enemy contact, enemy fire, spikes - so the first stage is
   * somewhere a player can learn what the buttons do without being punished at
   * full rate for not knowing yet. Instant-death hazards (lava, pits) are
   * deliberately not on this scale: they are a different lesson, and the ramp
   * for those is in the level geometry. */
  VZ.DAMAGE_SCALE = [0.5, 0.75, 1];

  // ------------------------------------------------------------------ input
  // Keyboard + gamepad, unified into named actions with pressed/held/released
  // edge detection. Also keeps a short buffer timer per action for jump-buffering.
  var ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'fire', 'dash', 'weapon', 'start', 'select'];

  var KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    KeyZ: 'jump', Space: 'jump', KeyK: 'jump',
    KeyX: 'fire', KeyJ: 'fire',
    KeyC: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash', KeyL: 'dash',
    KeyV: 'weapon', KeyQ: 'weapon', KeyE: 'weapon',
    Enter: 'start', Escape: 'select', KeyP: 'select'
  };

  // Standard gamepad mapping: 0=A 1=B 2=X 3=Y 4=LB 5=RB 6=LT 7=RT 8=back 9=start
  var PADMAP = {
    0: 'jump', 1: 'fire', 2: 'dash', 3: 'weapon',
    5: 'dash', 7: 'dash', 4: 'weapon', 6: 'weapon',
    9: 'start', 8: 'select',
    12: 'up', 13: 'down', 14: 'left', 15: 'right'
  };

  var Input = VZ.input = {
    held: {}, pressed: {}, released: {}, buffer: {},
    anyPressed: false,
    lastDevice: 'keyboard',
    _next: {},
    // A tap shorter than one frame would otherwise be down and up again
    // between two polls and vanish. The latch guarantees every keydown is
    // seen held for at least one poll.
    _latch: {},
    _padIndex: null,

    init: function () {
      var i;
      for (i = 0; i < ACTIONS.length; i++) {
        this.held[ACTIONS[i]] = false;
        this.pressed[ACTIONS[i]] = false;
        this.released[ACTIONS[i]] = false;
        this.buffer[ACTIONS[i]] = 0;
        this._next[ACTIONS[i]] = false;
        this._latch[ACTIONS[i]] = false;
      }
      var self = this;
      global.addEventListener('keydown', function (e) {
        var a = KEYMAP[e.code];
        if (a) { self._next[a] = true; self._latch[a] = true; self.lastDevice = 'keyboard'; }
        // Stop the page from scrolling under the canvas.
        if (a || e.code === 'Tab') e.preventDefault();
      }, { passive: false });
      global.addEventListener('keyup', function (e) {
        var a = KEYMAP[e.code];
        if (a) { self._next[a] = false; e.preventDefault(); }
      }, { passive: false });
      global.addEventListener('blur', function () {
        for (var k in self._next) { self._next[k] = false; self._latch[k] = false; }
      });
      global.addEventListener('gamepadconnected', function (e) {
        self._padIndex = e.gamepad.index;
      });
      global.addEventListener('gamepaddisconnected', function () {
        self._padIndex = null;
      });
    },

    // Virtual (touch) input is merged in by the touch controls layer.
    virtual: {},

    poll: function () {
      var i, a;
      // gamepad merge
      var pads = navigator.getGamepads ? navigator.getGamepads() : [];
      var padState = {};
      var usedPad = false;
      for (i = 0; i < pads.length; i++) {
        var p = pads[i];
        if (!p || !p.connected) continue;
        var b;
        for (b = 0; b < p.buttons.length; b++) {
          if (p.buttons[b] && p.buttons[b].pressed) {
            var act = PADMAP[b];
            if (act) { padState[act] = true; usedPad = true; }
          }
        }
        var ax = p.axes[0] || 0, ay = p.axes[1] || 0;
        if (ax < -0.4) { padState.left = true; usedPad = true; }
        if (ax > 0.4) { padState.right = true; usedPad = true; }
        if (ay < -0.4) { padState.up = true; usedPad = true; }
        if (ay > 0.4) { padState.down = true; usedPad = true; }
        break; // first connected pad only
      }
      if (usedPad) this.lastDevice = 'gamepad';

      this.anyPressed = false;
      for (i = 0; i < ACTIONS.length; i++) {
        a = ACTIONS[i];
        var now = !!(this._next[a] || this._latch[a] || padState[a] || this.virtual[a]);
        this.pressed[a] = now && !this.held[a];
        this.released[a] = !now && this.held[a];
        this.held[a] = now;
        if (this.pressed[a]) { this.buffer[a] = 8; this.anyPressed = true; }
        else if (this.buffer[a] > 0) this.buffer[a]--;
        this._latch[a] = false;
      }
      // Opposing directions cancel (prevents ambiguous state).
      if (this.held.left && this.held.right) { this.held.left = this.held.right = false; }
    },

    consume: function (a) { this.buffer[a] = 0; },
    axis: function () { return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0); },
    axisY: function () { return (this.held.down ? 1 : 0) - (this.held.up ? 1 : 0); }
  };

  // ------------------------------------------------------------- pixel canvas
  // A low-res backing canvas that we scale up with nearest-neighbour, plus a
  // handful of drawing helpers that keep everything snapped to whole pixels.
  VZ.Screen = {
    canvas: null, ctx: null,
    view: null, vctx: null,
    scale: 1,

    init: function (viewCanvas) {
      this.view = viewCanvas;
      this.vctx = viewCanvas.getContext('2d', { alpha: false });
      this.canvas = document.createElement('canvas');
      this.canvas.width = VZ.W; this.canvas.height = VZ.H;
      this.ctx = this.canvas.getContext('2d', { alpha: false });
      this.ctx.imageSmoothingEnabled = false;
      this.vctx.imageSmoothingEnabled = false;
      var self = this;
      global.addEventListener('resize', function () { self.resize(); });
      var host = document.getElementById('stage');
      if (host && global.ResizeObserver) {
        new global.ResizeObserver(function () { self.resize(); }).observe(host);
      }
      this.resize();
    },

    resize: function () {
      // When the page gives us a sized container (an embed, a cabinet bezel),
      // fit to that instead of the whole viewport.
      var host = document.getElementById('stage');
      var maxW = global.innerWidth, maxH = global.innerHeight;
      if (host) {
        var r = host.getBoundingClientRect();
        if (r.width > 40 && r.height > 40) { maxW = r.width; maxH = r.height; }
      }
      // Snap to whole or half pixels, always DOWNWARDS - rounding up would
      // push the canvas outside the space we were given.
      var s = Math.min(maxW / VZ.W, maxH / VZ.H);
      if (s >= 1) s = Math.floor(s) + (s - Math.floor(s) >= 0.5 ? 0.5 : 0);
      else s = Math.max(s, 0.3);
      this.scale = s;
      var w = Math.round(VZ.W * s), h = Math.round(VZ.H * s);
      this.view.width = w; this.view.height = h;
      this.view.style.width = w + 'px';
      this.view.style.height = h + 'px';
      this.vctx.imageSmoothingEnabled = false;
    },

    present: function () {
      this.vctx.imageSmoothingEnabled = false;
      this.vctx.drawImage(this.canvas, 0, 0, this.view.width, this.view.height);
    }
  };

  // ------------------------------------------------------------------ colours
  // Small helpers for palette work / tinting.
  VZ.color = {
    hex: function (r, g, b) {
      return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b))
        .toString(16).slice(1);
    },
    parse: function (h) {
      h = h.replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },
    mix: function (a, b, t) {
      var ca = this.parse(a), cb = this.parse(b);
      return this.hex(M.lerp(ca[0], cb[0], t), M.lerp(ca[1], cb[1], t), M.lerp(ca[2], cb[2], t));
    },
    shade: function (h, amt) {
      var c = this.parse(h);
      if (amt >= 0) return this.hex(M.lerp(c[0], 255, amt), M.lerp(c[1], 255, amt), M.lerp(c[2], 255, amt));
      return this.hex(c[0] * (1 + amt), c[1] * (1 + amt), c[2] * (1 + amt));
    }
  };

  // ---------------------------------------------------------------- game loop
  // Fixed 60Hz simulation with a render pass per animation frame. Accumulator is
  // clamped so a background tab doesn't produce a burst of catch-up steps.
  VZ.Loop = function (update, render) {
    var acc = 0, last = 0, running = false, raf = 0;
    var STEP = 1000 / VZ.FPS;

    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (!last) last = now;
      var delta = now - last;
      last = now;
      if (delta > 250) delta = STEP; // tab was hidden: skip the gap entirely
      acc += delta;
      var steps = 0;
      while (acc >= STEP && steps < 5) { update(); acc -= STEP; steps++; }
      if (steps === 5) acc = 0;
      render(acc / STEP);
    }

    return {
      start: function () { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); },
      stop: function () { running = false; cancelAnimationFrame(raf); }
    };
  };

  // ----------------------------------------------------------------- storage
  VZ.save = {
    key: 'vanguard-zero-v1',
    read: function () {
      try { return JSON.parse(global.localStorage.getItem(this.key)) || {}; }
      catch (e) { return {}; }
    },
    write: function (obj) {
      try { global.localStorage.setItem(this.key, JSON.stringify(obj)); } catch (e) { /* private mode */ }
    },
    merge: function (patch) {
      var d = this.read();
      for (var k in patch) d[k] = patch[k];
      this.write(d);
      return d;
    }
  };

  // ------------------------------------------------------------ misc helpers
  VZ.aabb = function (a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };

  VZ.formatTime = function (frames) {
    var t = frames / 60;
    var m = Math.floor(t / 60);
    var s = Math.floor(t % 60);
    var cs = Math.floor((t * 100) % 100);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + (cs < 10 ? '0' : '') + cs;
  };

})(typeof window !== 'undefined' ? window : globalThis);
