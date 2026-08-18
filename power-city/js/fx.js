/* POWER CITY - hit sparks, dust, score pops, screen shake.
 *
 * Everything here is cosmetic and runs even while the world is frozen for a
 * hit-stop, which is the point: the freeze is what sells the punch, and the
 * spark has to be visible during it.
 */
(function (global) {
  'use strict';
  var PC = global.PC || (global.PC = {});
  var Art = PC.art;

  var FX = PC.fx = {
    list: [], shake: 0, shakeX: 0, shakeY: 0, flashT: 0, flashCol: '#ffffff',

    reset: function () { this.list.length = 0; this.shake = 0; this.flashT = 0; },

    add: function (o) { this.list.push(o); return o; },

    /* A starburst plus a few sparks, at the point of contact. Heavy hits get
     * a bigger star and a longer freeze; that difference is most of what a
     * player feels when a combo finisher lands. */
    hit: function (x, y, heavy, color) {
      color = color || (heavy ? '#ffe070' : '#ffffff');
      this.add({ t: 0, life: heavy ? 11 : 8, x: x, y: y, kind: 'star', heavy: heavy, col: color });
      var n = heavy ? 7 : 4;
      for (var i = 0; i < n; i++) {
        var a = PC.rand() * Math.PI * 2, sp = PC.rand.range(0.8, heavy ? 3.4 : 2.2);
        this.add({
          t: 0, life: PC.rand.int(9, 18), kind: 'spark', x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, g: 0.12, col: color
        });
      }
      if (heavy) this.shakeBy(3.2);
    },

    dust: function (x, y, dir, n) {
      for (var i = 0; i < (n || 4); i++) {
        this.add({
          t: 0, life: PC.rand.int(10, 20), kind: 'dust', x: x, y: y,
          vx: dir * PC.rand.range(0.2, 1.1) + PC.rand.range(-0.3, 0.3),
          vy: -PC.rand.range(0.1, 0.5), g: 0.02, col: '#c8c8d8'
        });
      }
    },

    ring: function (x, y, col) {
      this.add({ t: 0, life: 14, kind: 'ring', x: x, y: y, col: col || '#ffffff' });
    },

    pop: function (x, y, text, col) {
      this.add({ t: 0, life: 46, kind: 'pop', x: x, y: y, text: String(text), col: col || '#ffe070' });
    },

    boom: function (x, y) {
      this.add({ t: 0, life: 22, kind: 'boom', x: x, y: y });
      for (var i = 0; i < 14; i++) {
        var a = PC.rand() * Math.PI * 2, sp = PC.rand.range(1, 4);
        this.add({
          t: 0, life: PC.rand.int(12, 26), kind: 'spark', x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, g: 0.14,
          col: PC.rand.pick(['#ffe070', '#ff8a20', '#ffffff'])
        });
      }
      this.shakeBy(6);
      this.flash('#ffb040', 5);
    },

    shakeBy: function (v) { this.shake = Math.max(this.shake, v); },
    flash: function (col, frames) { this.flashCol = col; this.flashT = frames; },

    update: function () {
      var i, p;
      for (i = this.list.length - 1; i >= 0; i--) {
        p = this.list[i];
        p.t++;
        if (p.vx !== undefined) { p.x += p.vx; p.y += p.vy; p.vy += p.g || 0; }
        if (p.kind === 'pop') p.y -= 0.55 * Math.max(0, 1 - p.t / 26);
        if (p.t >= p.life) this.list.splice(i, 1);
      }
      if (this.shake > 0) {
        this.shakeX = (PC.rand() - 0.5) * this.shake * 2;
        this.shakeY = (PC.rand() - 0.5) * this.shake;
        this.shake *= 0.78;
        if (this.shake < 0.25) { this.shake = 0; this.shakeX = 0; this.shakeY = 0; }
      }
      if (this.flashT > 0) this.flashT--;
    },

    draw: function (ctx, camX) {
      var i, p, k;
      for (i = 0; i < this.list.length; i++) {
        p = this.list[i];
        var x = Math.round(p.x - camX), y = Math.round(p.y);
        var f = p.t / p.life;
        if (p.kind === 'star') {
          var r = (p.heavy ? 11 : 7) * (0.45 + f * 0.75);
          ctx.fillStyle = f > 0.55 ? p.col : '#ffffff';
          for (k = 0; k < 4; k++) {
            var a = k * Math.PI / 4 + (p.heavy ? 0.4 : 0);
            var dx = Math.cos(a) * r, dy = Math.sin(a) * r * 0.7;
            ctx.fillRect(Math.round(x - dx), Math.round(y - dy), 2, 2);
            ctx.fillRect(Math.round(x + dx - 2), Math.round(y + dy - 2), 2, 2);
          }
          if (f < 0.6) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x - 3, y - 3, 6, 6);
            ctx.fillStyle = p.col;
            ctx.fillRect(x - 5, y - 1, 10, 2);
            ctx.fillRect(x - 1, y - 5, 2, 10);
          }
        } else if (p.kind === 'spark') {
          ctx.fillStyle = f > 0.7 ? '#8a8a9c' : p.col;
          ctx.fillRect(x, y, 2, 2);
        } else if (p.kind === 'dust') {
          ctx.globalAlpha = 1 - f;
          ctx.fillStyle = p.col;
          ctx.fillRect(x, y, 2, 1);
          ctx.globalAlpha = 1;
        } else if (p.kind === 'ring') {
          ctx.strokeStyle = p.col;
          ctx.globalAlpha = 1 - f;
          var rr = 3 + f * 16;
          ctx.beginPath();
          ctx.ellipse(x + 0.5, y + 0.5, rr, rr * 0.4, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (p.kind === 'boom') {
          var br = 4 + f * 26;
          Art.ellipse(ctx, x, y, br, br * 0.8, f < 0.4 ? '#fff4c0' : (f < 0.7 ? '#ff9a20' : '#883018'));
          if (f > 0.5) {
            ctx.globalAlpha = 1 - (f - 0.5) * 2;
            Art.ellipse(ctx, x, y - f * 8, br * 0.7, br * 0.6, '#4a4a58');
            ctx.globalAlpha = 1;
          }
        } else if (p.kind === 'pop') {
          Art.text(ctx, p.text, x, y, p.col, { align: 'center', shadow: '#301810' });
        }
      }
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
