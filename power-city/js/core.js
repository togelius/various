/* POWER CITY - core: constants, math, RNG, input, pixel screen, loop, storage.
 *
 * Classic scripts (no modules) so the game runs straight off the filesystem
 * with a double-click, and so tools/build-single.py can concatenate it.
 */
(function (global) {
  'use strict';

  var PC = global.PC || (global.PC = {});

  // ------------------------------------------------------------- screen box
  PC.W = 384;
  PC.H = 288;
  PC.FPS = 60;
  PC.DT = 1 / 60;

  /* The cabinet layout. A beat 'em up is a shallow diorama: a backdrop, a
   * band of floor you can walk in, and arcade furniture stacked above and
   * below it. Everything else in the game measures itself against these. */
  PC.HUD_TOP = 64;          // black band at the top ends here
  PC.FIELD_Y = 64;          // backdrop starts
  PC.FIELD_BOT = 256;       // backdrop ends / bottom bar starts
  PC.FLOOR_TOP = 196;       // nearest-to-the-wall footline
  PC.FLOOR_BOT = 246;       // nearest-to-the-camera footline
  PC.FLOOR_H = PC.FLOOR_BOT - PC.FLOOR_TOP;

  // ------------------------------------------------------------------- math
  var M = PC.math = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    sign: function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); },
    approach: function (v, target, step) {
      if (v < target) return Math.min(v + step, target);
      if (v > target) return Math.max(v - step, target);
      return target;
    },
    dist: function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); },
    ease: function (t) { return t * t * (3 - 2 * t); }
  };

  // ---------------------------------------------------------- mulberry32 RNG
  PC.RNG = function (seed) {
    var s = (seed >>> 0) || 0x9e3779b9;
    var r = function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = function (a, b) { return a + r() * (b - a); };
    r.int = function (a, b) { return Math.floor(a + r() * (b - a + 1)); };
    r.pick = function (arr) { return arr[Math.floor(r() * arr.length) % arr.length]; };
    r.chance = function (p) { return r() < p; };
    r.sign = function () { return r() < 0.5 ? -1 : 1; };
    return r;
  };
  PC.rand = PC.RNG(0xC0FFEE01);

  // ------------------------------------------------------------------ input
  /* Two players share one keyboard. The arrow cluster belongs to player one
   * until player two actually joins, at which point it moves over to them -
   * so a solo player can use whichever hand they like, and a second player
   * never has to be told which keys became theirs. */
  var ACTIONS = ['left', 'right', 'up', 'down', 'punch', 'kick', 'jump', 'start'];

  var MAP_P1 = {
    KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
    KeyJ: 'punch', KeyZ: 'punch',
    KeyK: 'kick', KeyX: 'kick',
    KeyL: 'jump', KeyC: 'jump', Space: 'jump',
    Enter: 'start', Digit1: 'start'
  };
  var MAP_ARROWS = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down'
  };
  var MAP_P2 = {
    Comma: 'punch', Period: 'kick', Slash: 'jump',
    Numpad1: 'punch', Numpad2: 'kick', Numpad3: 'jump',
    Numpad0: 'start', Digit2: 'start', ShiftRight: 'jump'
  };
  // 0=A 1=B 2=X 3=Y ... standard mapping
  var MAP_PAD = {
    0: 'jump', 1: 'kick', 2: 'punch', 3: 'jump', 5: 'kick', 7: 'punch',
    9: 'start', 12: 'up', 13: 'down', 14: 'left', 15: 'right'
  };

  function blankState() {
    var s = { held: {}, pressed: {}, released: {}, tapDir: 0, _tapTimer: 0, _tapDir: 0 };
    for (var i = 0; i < ACTIONS.length; i++) {
      s.held[ACTIONS[i]] = false; s.pressed[ACTIONS[i]] = false; s.released[ACTIONS[i]] = false;
    }
    return s;
  }

  var Input = PC.input = {
    p: [blankState(), blankState()],
    coin: false, pause: false, mute: false, fullscreen: false, anyKey: false,
    p2Joined: false,
    touch: null,           // filled in by touch.js: { held: {...} }
    _down: {},             // raw code -> true
    _edge: {},             // raw code pressed this frame
    _latch: {},            // guarantees sub-frame taps are seen
    _globals: {},

    init: function () {
      var self = this;
      global.addEventListener('keydown', function (e) {
        if (e.repeat) { e.preventDefault(); return; }
        if (self._interesting(e.code)) e.preventDefault();
        self._down[e.code] = true; self._latch[e.code] = true;
        self._edge[e.code] = true;
      });
      global.addEventListener('keyup', function (e) {
        if (self._interesting(e.code)) e.preventDefault();
        self._down[e.code] = false;
      });
      global.addEventListener('blur', function () { self._down = {}; });
    },

    _interesting: function (code) {
      return !!(MAP_P1[code] || MAP_P2[code] || MAP_ARROWS[code] ||
        code === 'Digit5' || code === 'Escape' || code === 'KeyP' ||
        code === 'KeyM' || code === 'KeyF' || code === 'Tab');
    },

    // Collapse raw key state into per-player actions once per simulation step.
    poll: function () {
      var i, a, code, st, prev = {};
      var pads = (global.navigator && global.navigator.getGamepads) ? global.navigator.getGamepads() : [];

      for (i = 0; i < 2; i++) {
        st = this.p[i];
        prev[i] = {};
        for (a = 0; a < ACTIONS.length; a++) prev[i][ACTIONS[a]] = st.held[ACTIONS[a]];
        for (a = 0; a < ACTIONS.length; a++) st.held[ACTIONS[a]] = false;
      }

      function set(pl, act) { if (act) Input.p[pl].held[act] = true; }
      function down(c) { return Input._down[c] || Input._latch[c]; }

      for (code in MAP_P1) if (down(code)) set(0, MAP_P1[code]);
      for (code in MAP_P2) if (down(code)) set(1, MAP_P2[code]);
      var arrowsTo = this.p2Joined ? 1 : 0;
      for (code in MAP_ARROWS) if (down(code)) set(arrowsTo, MAP_ARROWS[code]);

      // Gamepads take players in the order the browser lists them.
      var padPlayer = 0;
      for (i = 0; i < pads.length && padPlayer < 2; i++) {
        var pad = pads[i];
        if (!pad || !pad.connected) continue;
        var b, ax;
        for (b in MAP_PAD) if (pad.buttons[b] && pad.buttons[b].pressed) set(padPlayer, MAP_PAD[b]);
        ax = pad.axes[0] || 0;
        if (ax < -0.35) set(padPlayer, 'left'); else if (ax > 0.35) set(padPlayer, 'right');
        ax = pad.axes[1] || 0;
        if (ax < -0.35) set(padPlayer, 'up'); else if (ax > 0.35) set(padPlayer, 'down');
        padPlayer++;
      }

      // Touch overlay always drives whichever player is on screen first.
      if (this.touch) {
        for (a in this.touch.held) if (this.touch.held[a]) set(0, a);
      }

      for (i = 0; i < 2; i++) {
        st = this.p[i];
        for (a = 0; a < ACTIONS.length; a++) {
          var act = ACTIONS[a];
          st.pressed[act] = st.held[act] && !prev[i][act];
          st.released[act] = !st.held[act] && prev[i][act];
        }
        // Double-tap left/right, for the run. Window is 16 frames.
        st.tapDir = 0;
        if (st._tapTimer > 0) st._tapTimer--;
        var dir = st.pressed.left ? -1 : (st.pressed.right ? 1 : 0);
        if (dir) {
          if (st._tapTimer > 0 && st._tapDir === dir) { st.tapDir = dir; st._tapTimer = 0; }
          else { st._tapDir = dir; st._tapTimer = 16; }
        }
      }

      this.coin = !!(this._edge.Digit5 || this._edge.Digit6 || this._edge.KeyR);
      this.pause = !!(this._edge.Escape || this._edge.KeyP);
      this.mute = !!this._edge.KeyM;
      this.fullscreen = !!this._edge.KeyF;
      this.anyKey = false;
      for (code in this._edge) if (this._edge[code]) { this.anyKey = true; break; }

      this._edge = {};
      this._latch = {};
    },

    axis: function (i) { var h = this.p[i].held; return (h.right ? 1 : 0) - (h.left ? 1 : 0); },
    axisY: function (i) { var h = this.p[i].held; return (h.down ? 1 : 0) - (h.up ? 1 : 0); }
  };

  // -------------------------------------------------------------- the screen
  PC.Screen = {
    canvas: null, ctx: null, view: null, vctx: null, scale: 1,

    init: function (viewCanvas) {
      this.view = viewCanvas;
      this.vctx = viewCanvas.getContext('2d', { alpha: false });
      this.canvas = document.createElement('canvas');
      this.canvas.width = PC.W; this.canvas.height = PC.H;
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
      var host = document.getElementById('stage');
      var maxW = global.innerWidth, maxH = global.innerHeight - 54;
      if (host) {
        var r = host.getBoundingClientRect();
        if (r.width > 40 && r.height > 40) { maxW = r.width; maxH = r.height; }
      }
      var s = Math.min(maxW / PC.W, maxH / PC.H);
      // Whole-pixel scales only (down to a half step) so the art stays crisp.
      if (s >= 1) s = Math.floor(s) + (s - Math.floor(s) >= 0.5 ? 0.5 : 0);
      else s = Math.max(s, 0.3);
      this.scale = s;
      var w = Math.round(PC.W * s), h = Math.round(PC.H * s);
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

  // ---------------------------------------------------------------- colours
  PC.color = {
    hex: function (r, g, b) {
      return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
    },
    parse: function (h) {
      h = String(h).replace('#', '');
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

  // -------------------------------------------------------------- game loop
  PC.Loop = function (update, render) {
    var acc = 0, last = 0, running = false, raf = 0;
    var STEP = 1000 / PC.FPS;
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (!last) last = now;
      var delta = now - last; last = now;
      if (delta > 250) delta = STEP;   // tab was hidden: drop the gap
      acc += delta;
      var steps = 0;
      while (acc >= STEP && steps < 5) { update(); acc -= STEP; steps++; }
      if (steps === 5) acc = 0;
      render();
    }
    return {
      start: function () { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); },
      stop: function () { running = false; cancelAnimationFrame(raf); },
      step: function () { update(); render(); }
    };
  };

  // ----------------------------------------------------------------- saving
  PC.save = {
    key: 'power-city-v1',
    read: function () {
      try { return JSON.parse(global.localStorage.getItem(this.key)) || {}; } catch (e) { return {}; }
    },
    write: function (o) {
      try { global.localStorage.setItem(this.key, JSON.stringify(o)); } catch (e) { /* private mode */ }
    },
    merge: function (patch) {
      var d = this.read();
      for (var k in patch) d[k] = patch[k];
      this.write(d); return d;
    }
  };

  PC.pad = function (n, len) {
    var s = String(Math.max(0, Math.floor(n)));
    while (s.length < len) s = '0' + s;
    return s.length > len ? s.slice(-len) : s;
  };

})(typeof window !== 'undefined' ? window : globalThis);
