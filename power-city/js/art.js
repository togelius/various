/* POWER CITY - art primitives.
 *
 * Nothing is loaded from disk. Every pixel in the game is drawn here or by
 * something that calls in here: the arcade font, the chunky limb shapes the
 * fighters are built from, and the outline pass that gives every sprite the
 * hard black keyline that 8-bit brawlers all had.
 */
(function (global) {
  'use strict';
  var PC = global.PC || (global.PC = {});
  var Art = PC.art = {};

  function mk(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return c;
  }
  Art.mk = mk;

  // ------------------------------------------------------------------- font
  /* A 5x7 arcade face. Rows are bit strings, which is a format you can read
   * and fix by eye - the whole point when the letters are seven pixels tall. */
  var GLYPHS = {
    'A': '01110,10001,10001,11111,10001,10001,10001',
    'B': '11110,10001,10001,11110,10001,10001,11110',
    'C': '01110,10001,10000,10000,10000,10001,01110',
    'D': '11110,10001,10001,10001,10001,10001,11110',
    'E': '11111,10000,10000,11110,10000,10000,11111',
    'F': '11111,10000,10000,11110,10000,10000,10000',
    'G': '01110,10001,10000,10111,10001,10001,01111',
    'H': '10001,10001,10001,11111,10001,10001,10001',
    'I': '11111,00100,00100,00100,00100,00100,11111',
    'J': '00111,00010,00010,00010,00010,10010,01100',
    'K': '10001,10010,10100,11000,10100,10010,10001',
    'L': '10000,10000,10000,10000,10000,10000,11111',
    'M': '10001,11011,10101,10101,10001,10001,10001',
    'N': '10001,11001,10101,10011,10001,10001,10001',
    'O': '01110,10001,10001,10001,10001,10001,01110',
    'P': '11110,10001,10001,11110,10000,10000,10000',
    'Q': '01110,10001,10001,10001,10101,10010,01101',
    'R': '11110,10001,10001,11110,10100,10010,10001',
    'S': '01111,10000,10000,01110,00001,00001,11110',
    'T': '11111,00100,00100,00100,00100,00100,00100',
    'U': '10001,10001,10001,10001,10001,10001,01110',
    'V': '10001,10001,10001,10001,10001,01010,00100',
    'W': '10001,10001,10001,10101,10101,11011,01010',
    'X': '10001,10001,01010,00100,01010,10001,10001',
    'Y': '10001,10001,01010,00100,00100,00100,00100',
    'Z': '11111,00001,00010,00100,01000,10000,11111',
    '0': '01110,10001,10011,10101,11001,10001,01110',
    '1': '00100,01100,00100,00100,00100,00100,01110',
    '2': '01110,10001,00001,00010,00100,01000,11111',
    '3': '11111,00010,00100,00010,00001,10001,01110',
    '4': '00010,00110,01010,10010,11111,00010,00010',
    '5': '11111,10000,11110,00001,00001,10001,01110',
    '6': '00110,01000,10000,11110,10001,10001,01110',
    '7': '11111,00001,00010,00100,01000,01000,01000',
    '8': '01110,10001,10001,01110,10001,10001,01110',
    '9': '01110,10001,10001,01111,00001,00010,01100',
    '.': '00000,00000,00000,00000,00000,01100,01100',
    ',': '00000,00000,00000,00000,01100,01100,11000',
    '-': '00000,00000,00000,11111,00000,00000,00000',
    '_': '00000,00000,00000,00000,00000,00000,11111',
    '!': '00100,00100,00100,00100,00100,00000,00100',
    '?': '01110,10001,00001,00010,00100,00000,00100',
    ':': '00000,01100,01100,00000,01100,01100,00000',
    ';': '00000,01100,01100,00000,01100,01100,11000',
    "'": '00100,00100,01000,00000,00000,00000,00000',
    '"': '01010,01010,01010,00000,00000,00000,00000',
    '(': '00010,00100,01000,01000,01000,00100,00010',
    ')': '01000,00100,00010,00010,00010,00100,01000',
    '/': '00001,00001,00010,00100,01000,10000,10000',
    '+': '00000,00100,00100,11111,00100,00100,00000',
    '=': '00000,00000,11111,00000,11111,00000,00000',
    '*': '00000,10101,01110,11111,01110,10101,00000',
    '%': '11001,11011,00010,00100,01000,11011,10011',
    '&': '01100,10010,10100,01000,10101,10010,01101',
    '#': '01010,11111,01010,01010,01010,11111,01010',
    '<': '00001,00010,00100,01000,00100,00010,00001',
    '>': '10000,01000,00100,00010,00100,01000,10000',
    '^': '00100,01110,11011,10001,00000,00000,00000',
    '$': '00100,01111,10100,01110,00101,11110,00100',
    '★': '00100,00100,11111,01110,01110,01010,10001',
    '→': '00000,00100,00010,11111,00010,00100,00000',
    '●': '00000,01110,11111,11111,11111,01110,00000'
  };

  Art.FONT_W = 5; Art.FONT_H = 7; Art.FONT_SP = 1;

  var glyphIndex = {}, glyphOrder = [], gi = 0;
  for (var gk in GLYPHS) { glyphIndex[gk] = gi++; glyphOrder.push(gk); }

  var atlasCache = {};
  function atlas(color) {
    var a = atlasCache[color];
    if (a) return a;
    var n = glyphOrder.length;
    var c = mk(n * Art.FONT_W, Art.FONT_H), x = c.getContext('2d');
    var img = x.createImageData(c.width, c.height), d = img.data;
    var rgb = PC.color.parse(color);
    for (var g = 0; g < n; g++) {
      var rows = GLYPHS[glyphOrder[g]].split(',');
      for (var r = 0; r < rows.length; r++) {
        for (var i = 0; i < rows[r].length; i++) {
          if (rows[r][i] !== '1') continue;
          var o = (r * c.width + g * Art.FONT_W + i) * 4;
          d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
        }
      }
    }
    x.putImageData(img, 0, 0);
    atlasCache[color] = c;
    return c;
  }

  Art.textWidth = function (str, scale, tracking) {
    scale = scale || 1;
    tracking = tracking === undefined ? Art.FONT_SP : tracking;
    var n = String(str).length;
    return n <= 0 ? 0 : (n * (Art.FONT_W + tracking) - tracking) * scale;
  };

  /* opts: { scale, tracking, shadow, align: 'left'|'center'|'right', wobble } */
  Art.text = function (ctx, str, x, y, color, opts) {
    opts = opts || {};
    str = String(str).toUpperCase();
    var scale = opts.scale || 1;
    var tracking = opts.tracking === undefined ? Art.FONT_SP : opts.tracking;
    var w = Art.textWidth(str, scale, tracking);
    if (opts.align === 'center') x = Math.round(x - w / 2);
    else if (opts.align === 'right') x = Math.round(x - w);
    x = Math.round(x); y = Math.round(y);

    if (opts.shadow) {
      var sd = opts.shadowDist || scale;
      Art.text(ctx, str, x + sd, y + sd, opts.shadow, {
        scale: scale, tracking: tracking, wobble: opts.wobble, phase: opts.phase
      });
    }
    var at = atlas(color);
    var step = (Art.FONT_W + tracking) * scale;
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if (ch === ' ') continue;
      var idx = glyphIndex[ch];
      if (idx === undefined) idx = glyphIndex['?'];
      var dy = 0;
      if (opts.wobble) dy = Math.round(Math.sin((opts.phase || 0) + i * 0.6) * opts.wobble);
      ctx.drawImage(at, idx * Art.FONT_W, 0, Art.FONT_W, Art.FONT_H,
        x + i * step, y + dy, Art.FONT_W * scale, Art.FONT_H * scale);
    }
    return w;
  };

  // ------------------------------------------------------- sprite from rows
  Art.sprite = function (rows, pal) {
    var h = rows.length, w = 0, i, j;
    for (i = 0; i < h; i++) w = Math.max(w, rows[i].length);
    var c = mk(w, h), x = c.getContext('2d');
    var img = x.createImageData(w, h), d = img.data, cache = {};
    for (i = 0; i < h; i++) {
      var row = rows[i];
      for (j = 0; j < row.length; j++) {
        var ch = row[j];
        if (ch === '.' || ch === ' ') continue;
        var col = pal[ch];
        if (!col) continue;
        var rgb = cache[ch] || (cache[ch] = PC.color.parse(col));
        var o = (i * w + j) * 4;
        d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  };

  Art.flipH = function (src) {
    var c = mk(src.width, src.height), x = c.getContext('2d');
    x.translate(src.width, 0); x.scale(-1, 1);
    x.drawImage(src, 0, 0);
    return c;
  };

  Art.solid = function (src, color) {
    var c = mk(src.width, src.height), x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return c;
  };

  Art.tint = function (src, color, amount) {
    var c = mk(src.width, src.height), x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.globalAlpha = amount;
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return c;
  };

  /* Grow a 1px keyline around everything opaque in `src`, returning a new
   * canvas one pixel larger on every side. Cheaper and far more reliable than
   * outlining each limb by hand, and it never leaves a seam where two body
   * parts overlap. */
  Art.outline = function (src, color, pad) {
    pad = pad || 1;
    var c = mk(src.width + pad * 2, src.height + pad * 2), x = c.getContext('2d');
    var sil = Art.solid(src, color || '#000');
    var dx, dy;
    for (dy = -pad; dy <= pad; dy++) {
      for (dx = -pad; dx <= pad; dx++) {
        if (!dx && !dy) continue;
        x.drawImage(sil, pad + dx, pad + dy);
      }
    }
    x.drawImage(src, pad, pad);
    return c;
  };

  // Crop to the tight bounding box of opaque pixels; returns {canvas,ox,oy}.
  Art.trim = function (src) {
    var x = src.getContext('2d');
    var d = x.getImageData(0, 0, src.width, src.height).data;
    var minX = src.width, minY = src.height, maxX = -1, maxY = -1;
    for (var j = 0; j < src.height; j++) {
      for (var i = 0; i < src.width; i++) {
        if (d[(j * src.width + i) * 4 + 3] < 8) continue;
        if (i < minX) minX = i; if (i > maxX) maxX = i;
        if (j < minY) minY = j; if (j > maxY) maxY = j;
      }
    }
    if (maxX < 0) return { canvas: mk(1, 1), ox: 0, oy: 0 };
    var w = maxX - minX + 1, h = maxY - minY + 1;
    var c = mk(w, h);
    c.getContext('2d').drawImage(src, -minX, -minY);
    return { canvas: c, ox: minX, oy: minY };
  };

  // ------------------------------------------------- chunky drawing helpers
  // All of these snap to whole pixels; nothing in this game is ever anti-aliased.
  Art.rect = function (ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  };

  // Pixel-perfect filled ellipse (Bresenham-ish, row by row).
  Art.ellipse = function (ctx, cx, cy, rx, ry, color) {
    ctx.fillStyle = color;
    rx = Math.max(0.5, rx); ry = Math.max(0.5, ry);
    var y0 = Math.round(cy - ry), y1 = Math.round(cy + ry);
    for (var y = y0; y <= y1; y++) {
      var t = (y + 0.5 - cy) / ry;
      if (t * t >= 1) continue;
      var half = rx * Math.sqrt(1 - t * t);
      var xa = Math.round(cx - half), xb = Math.round(cx + half);
      if (xb <= xa) xb = xa + 1;
      ctx.fillRect(xa, y, xb - xa, 1);
    }
  };

  /* A tapered limb: a segment swept by a width that lerps end to end. Drawn
   * as a stack of short spans so it stays blocky instead of turning into a
   * smooth vector stroke. */
  Art.limb = function (ctx, x0, y0, x1, y1, w0, w1, color) {
    var dx = x1 - x0, dy = y1 - y0;
    var len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    var steps = Math.ceil(len) + 1;
    ctx.fillStyle = color;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var px = x0 + dx * t, py = y0 + dy * t;
      var w = w0 + (w1 - w0) * t;
      var half = w / 2;
      if (Math.abs(dy) > Math.abs(dx)) {
        ctx.fillRect(Math.round(px - half), Math.round(py), Math.max(1, Math.round(w)), 1);
      } else {
        ctx.fillRect(Math.round(px), Math.round(py - half), 1, Math.max(1, Math.round(w)));
      }
    }
  };

  // Repeating vertical/horizontal hatch used for fences, grates, shutters.
  Art.hatch = function (ctx, x, y, w, h, step, color, dir) {
    ctx.fillStyle = color;
    var i;
    if (dir !== 'h') for (i = 0; i < w; i += step) ctx.fillRect(Math.round(x + i), Math.round(y), 1, Math.round(h));
    if (dir !== 'v') for (i = 0; i < h; i += step) ctx.fillRect(Math.round(x), Math.round(y + i), Math.round(w), 1);
  };

  // A 50% checker between two colours - the poor man's gradient, and exactly
  // how a real 8-bit background would fake a shade it did not have.
  Art.dither = function (ctx, x, y, w, h, color, phase) {
    ctx.fillStyle = color;
    phase = phase || 0;
    for (var j = 0; j < h; j++) {
      for (var i = (j + phase) % 2; i < w; i += 2) ctx.fillRect(Math.round(x + i), Math.round(y + j), 1, 1);
    }
  };

  Art.shadow = function (ctx, cx, cy, rx, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 0.35 : alpha;
    Art.ellipse(ctx, cx, cy, rx, Math.max(1.5, rx * 0.36), '#000000');
    ctx.restore();
  };

})(typeof window !== 'undefined' ? window : globalThis);
