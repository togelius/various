/* VANGUARD ZERO - juice layer: particles, shake, hitstop, popups, flashes. */
(function (global) {
  'use strict';
  var VZ = global.VZ || (global.VZ = {});
  var M = VZ.math;

  var FX = VZ.fx = {
    parts: [],
    texts: [],
    rings: [],
    shakeAmt: 0, shakeDecay: 0.86, shakeX: 0, shakeY: 0,
    hitstop: 0,
    flashColor: null, flashAlpha: 0, flashDecay: 0.9,
    tint: null, tintAlpha: 0,
    time: 0,

    reset: function () {
      this.parts.length = 0; this.texts.length = 0; this.rings.length = 0;
      this.shakeAmt = 0; this.hitstop = 0; this.flashAlpha = 0; this.tintAlpha = 0;
    },

    shake: function (amt) { this.shakeAmt = Math.max(this.shakeAmt, amt); },
    stop: function (frames) { this.hitstop = Math.max(this.hitstop, frames); },
    flash: function (color, alpha, decay) {
      this.flashColor = color; this.flashAlpha = alpha;
      this.flashDecay = decay === undefined ? 0.82 : decay;
    },

    // ------------------------------------------------------------- particles
    spawn: function (o) {
      if (this.parts.length > 620) this.parts.shift();
      this.parts.push({
        x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0,
        g: o.g === undefined ? 0.16 : o.g,
        drag: o.drag === undefined ? 1 : o.drag,
        life: o.life || 24, max: o.life || 24,
        size: o.size || 2, shrink: o.shrink !== false,
        color: o.color || '#fff', color2: o.color2 || null,
        glow: !!o.glow, spin: o.spin || 0, rot: o.rot || 0,
        kind: o.kind || 'rect', trail: o.trail || 0, prev: null
      });
    },

    burst: function (x, y, n, opts) {
      opts = opts || {};
      var r = VZ.rand;
      for (var i = 0; i < n; i++) {
        var a = opts.angle !== undefined
          ? opts.angle + (r() - 0.5) * (opts.spread || Math.PI * 2)
          : r() * Math.PI * 2;
        var sp = (opts.speed || 2) * r.range(0.35, 1);
        this.spawn({
          x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.lift || 0),
          g: opts.g, drag: opts.drag === undefined ? 0.94 : opts.drag,
          life: Math.round((opts.life || 22) * r.range(0.6, 1.25)),
          size: opts.size || 2, color: opts.color || '#fff',
          color2: opts.color2, glow: opts.glow, kind: opts.kind
        });
      }
    },

    // Expanding ring - used for shockwaves and charge releases.
    ring: function (x, y, opts) {
      opts = opts || {};
      this.rings.push({
        x: x, y: y, r: opts.r0 || 2, grow: opts.grow || 2.4,
        life: opts.life || 18, max: opts.life || 18,
        color: opts.color || '#fff', width: opts.width || 2,
        squash: opts.squash || 1
      });
    },

    popup: function (x, y, str, color, opts) {
      opts = opts || {};
      this.texts.push({
        x: x, y: y, str: String(str), color: color || '#fff',
        vy: opts.vy === undefined ? -0.55 : opts.vy,
        life: opts.life || 44, max: opts.life || 44,
        scale: opts.scale || 1, shadow: opts.shadow || '#000'
      });
    },

    // ------------------------------------------------ common effect recipes
    explosion: function (x, y, scale, color) {
      scale = scale || 1;
      color = color || '#ffb347';
      this.burst(x, y, Math.round(14 * scale), {
        speed: 2.4 * scale, life: 26, size: 2 + scale, color: color,
        color2: '#fff2c8', glow: true, g: 0.06, drag: 0.9
      });
      this.burst(x, y, Math.round(8 * scale), {
        speed: 1.5 * scale, life: 34, size: 3 * scale, color: '#7a5a4a', g: 0.12, drag: 0.93
      });
      this.ring(x, y, { grow: 2.6 * scale, life: 14, color: '#fff2c8', width: 2 });
      this.shake(3 * scale);
    },

    sparks: function (x, y, dir, color) {
      this.burst(x, y, 6, {
        angle: dir, spread: 1.9, speed: 2.6, life: 14, size: 1,
        color: color || '#ffe9a0', glow: true, g: 0.08, drag: 0.88
      });
    },

    dust: function (x, y, dir) {
      for (var i = 0; i < 4; i++) {
        this.spawn({
          x: x + VZ.rand.range(-3, 3), y: y,
          vx: dir * VZ.rand.range(0.2, 0.9), vy: -VZ.rand.range(0.1, 0.6),
          g: 0.02, drag: 0.9, life: 16 + VZ.rand.int(0, 8), size: 2,
          color: '#cfd8ea'
        });
      }
    },

    // ------------------------------------------------------------------ tick
    update: function () {
      this.time++;
      var i, p;
      for (i = this.parts.length - 1; i >= 0; i--) {
        p = this.parts[i];
        if (p.trail) p.prev = { x: p.x, y: p.y };
        p.x += p.vx; p.y += p.vy;
        p.vy += p.g; p.vx *= p.drag; p.vy *= p.drag;
        p.rot += p.spin;
        if (--p.life <= 0) this.parts.splice(i, 1);
      }
      for (i = this.rings.length - 1; i >= 0; i--) {
        var rg = this.rings[i];
        rg.r += rg.grow;
        rg.grow *= 0.94;
        if (--rg.life <= 0) this.rings.splice(i, 1);
      }
      for (i = this.texts.length - 1; i >= 0; i--) {
        var t = this.texts[i];
        t.y += t.vy; t.vy *= 0.93;
        if (--t.life <= 0) this.texts.splice(i, 1);
      }
      if (this.shakeAmt > 0.05) {
        this.shakeX = (VZ.rand() - 0.5) * 2 * this.shakeAmt;
        this.shakeY = (VZ.rand() - 0.5) * 2 * this.shakeAmt;
        this.shakeAmt *= this.shakeDecay;
      } else { this.shakeAmt = 0; this.shakeX = 0; this.shakeY = 0; }
      if (this.flashAlpha > 0.01) this.flashAlpha *= this.flashDecay;
      else this.flashAlpha = 0;
      if (this.hitstop > 0) this.hitstop--;
    },

    // ---------------------------------------------------------------- render
    draw: function (ctx, camX, camY) {
      var i, p;
      ctx.save();
      for (i = 0; i < this.parts.length; i++) {
        p = this.parts[i];
        var t = p.life / p.max;
        var s = p.shrink ? Math.max(1, Math.round(p.size * t)) : p.size;
        var x = Math.round(p.x - camX), y = Math.round(p.y - camY);
        var col = p.color;
        if (p.color2 && t > 0.55) col = p.color2;
        ctx.globalAlpha = t > 0.35 ? 1 : t / 0.35;
        if (p.glow) {
          ctx.globalAlpha *= 0.4;
          ctx.fillStyle = col;
          ctx.fillRect(x - s, y - s, s * 3, s * 3);
          ctx.globalAlpha = t > 0.35 ? 1 : t / 0.35;
        }
        ctx.fillStyle = col;
        if (p.kind === 'line' && p.prev) {
          ctx.strokeStyle = col; ctx.lineWidth = s;
          ctx.beginPath();
          ctx.moveTo(p.prev.x - camX, p.prev.y - camY);
          ctx.lineTo(x, y); ctx.stroke();
        } else {
          ctx.fillRect(x - (s >> 1), y - (s >> 1), s, s);
        }
      }
      ctx.globalAlpha = 1;

      for (i = 0; i < this.rings.length; i++) {
        var rg = this.rings[i];
        var rt = rg.life / rg.max;
        ctx.globalAlpha = rt;
        ctx.strokeStyle = rg.color;
        ctx.lineWidth = Math.max(1, rg.width * rt);
        ctx.beginPath();
        ctx.ellipse(Math.round(rg.x - camX), Math.round(rg.y - camY),
          rg.r, rg.r * rg.squash, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    },

    drawTexts: function (ctx, camX, camY) {
      for (var i = 0; i < this.texts.length; i++) {
        var t = this.texts[i];
        var a = t.life > t.max * 0.4 ? 1 : t.life / (t.max * 0.4);
        ctx.globalAlpha = a;
        VZ.art.text(ctx, t.str, Math.round(t.x - camX), Math.round(t.y - camY), {
          color: t.color, shadow: t.shadow, align: 'center', scale: t.scale
        });
      }
      ctx.globalAlpha = 1;
    },

    drawOverlay: function (ctx) {
      if (this.flashAlpha > 0.01) {
        ctx.globalAlpha = Math.min(1, this.flashAlpha);
        ctx.fillStyle = this.flashColor || '#fff';
        ctx.fillRect(0, 0, VZ.W, VZ.H);
        ctx.globalAlpha = 1;
      }
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
