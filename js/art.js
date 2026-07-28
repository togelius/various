/* VANGUARD ZERO - art pipeline.
 *
 * Nothing is loaded from disk. Sprites are decoded from character grids,
 * terrain is synthesised per theme (a continuous material texture plus
 * bitmask edge overlays), and backgrounds are drawn into wide, horizontally
 * tiling canvases for the parallax scroller.
 */
(function (global) {
  'use strict';
  var VZ = global.VZ || (global.VZ = {});
  var C = VZ.color;

  var Art = VZ.art = { gfx: {}, tilesets: {}, backgrounds: {} };

  function mk(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return c;
  }
  Art.mk = mk;

  // -------------------------------------------------------------- sprite art
  /* rows: array of equal-length strings; each char indexes `pal`.
   * '.' and ' ' are transparent. */
  Art.sprite = function (rows, pal) {
    var h = rows.length, w = 0, i, j;
    for (i = 0; i < h; i++) w = Math.max(w, rows[i].length);
    var c = mk(w, h), x = c.getContext('2d');
    var img = x.createImageData(w, h);
    var d = img.data;
    var cache = {};
    for (i = 0; i < h; i++) {
      var row = rows[i];
      for (j = 0; j < row.length; j++) {
        var ch = row[j];
        if (ch === '.' || ch === ' ') continue;
        var col = pal[ch];
        if (!col) continue;
        var rgb = cache[ch] || (cache[ch] = C.parse(col));
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

  Art.flipV = function (src) {
    var c = mk(src.width, src.height), x = c.getContext('2d');
    x.translate(0, src.height); x.scale(1, -1);
    x.drawImage(src, 0, 0);
    return c;
  };

  // Solid-colour stamp of a sprite - used for hit flashes and silhouettes.
  Art.solid = function (src, color) {
    var c = mk(src.width, src.height), x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return c;
  };

  // Blend a sprite toward a colour (palette-swap-ish recolouring).
  Art.tint = function (src, color, amount) {
    var c = mk(src.width, src.height), x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.globalAlpha = amount;
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return c;
  };

  // Per-channel hue rotation for enemy variants: maps every pixel through a fn.
  Art.remap = function (src, fn) {
    var c = mk(src.width, src.height), x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    var img = x.getImageData(0, 0, c.width, c.height), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      var o = fn(d[i], d[i + 1], d[i + 2]);
      d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2];
    }
    x.putImageData(img, 0, 0);
    return c;
  };

  // 1px outline in `color` around the opaque pixels of `src`.
  Art.outline = function (src, color) {
    var c = mk(src.width + 2, src.height + 2), x = c.getContext('2d');
    var sil = Art.solid(src, color);
    var offs = [[0, 1], [2, 1], [1, 0], [1, 2], [0, 0], [2, 0], [0, 2], [2, 2]];
    for (var i = 0; i < offs.length; i++) x.drawImage(sil, offs[i][0], offs[i][1]);
    x.drawImage(src, 1, 1);
    return c;
  };

  // ---------------------------------------------------------------- the font
  // 5x7 uppercase bitmap font. Each glyph is 7 rows of 5 bits.
  var FONT = {
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
    'W': '10001,10001,10001,10101,10101,11011,10001',
    'X': '10001,10001,01010,00100,01010,10001,10001',
    'Y': '10001,10001,01010,00100,00100,00100,00100',
    'Z': '11111,00001,00010,00100,01000,10000,11111',
    '0': '01110,10001,10011,10101,11001,10001,01110',
    '1': '00100,01100,00100,00100,00100,00100,01110',
    '2': '01110,10001,00001,00010,00100,01000,11111',
    '3': '11110,00001,00001,01110,00001,00001,11110',
    '4': '00010,00110,01010,10010,11111,00010,00010',
    '5': '11111,10000,11110,00001,00001,10001,01110',
    '6': '00110,01000,10000,11110,10001,10001,01110',
    '7': '11111,00001,00010,00100,01000,01000,01000',
    '8': '01110,10001,10001,01110,10001,10001,01110',
    '9': '01110,10001,10001,01111,00001,00010,01100',
    ' ': '00000,00000,00000,00000,00000,00000,00000',
    '.': '00000,00000,00000,00000,00000,01100,01100',
    ',': '00000,00000,00000,00000,01100,01100,01000',
    ':': '00000,01100,01100,00000,01100,01100,00000',
    '-': '00000,00000,00000,11111,00000,00000,00000',
    '_': '00000,00000,00000,00000,00000,00000,11111',
    '!': '00100,00100,00100,00100,00100,00000,00100',
    '?': '01110,10001,00001,00110,00100,00000,00100',
    '/': '00001,00010,00010,00100,01000,01000,10000',
    '%': '11001,11010,00010,00100,01000,01011,10011',
    '+': '00000,00100,00100,11111,00100,00100,00000',
    '*': '00000,10101,01110,11111,01110,10101,00000',
    '(': '00010,00100,01000,01000,01000,00100,00010',
    ')': '01000,00100,00010,00010,00010,00100,01000',
    "'": '00100,00100,00000,00000,00000,00000,00000',
    '"': '01010,01010,00000,00000,00000,00000,00000',
    '<': '00010,00100,01000,10000,01000,00100,00010',
    '>': '01000,00100,00010,00001,00010,00100,01000',
    '=': '00000,00000,11111,00000,11111,00000,00000',
    '#': '01010,11111,01010,01010,01010,11111,01010',
    '@': '01110,10001,10111,10101,10111,10000,01110',
    '♥': '01010,11111,11111,11111,01110,00100,00000'  // heart
  };

  Art.font = { glyphs: {}, W: 5, H: 7 };

  Art.buildFont = function () {
    for (var ch in FONT) {
      var rows = FONT[ch].split(',');
      Art.font.glyphs[ch] = rows;
    }
  };

  Art.textWidth = function (str, spacing) {
    spacing = spacing === undefined ? 1 : spacing;
    return str.length * (Art.font.W + spacing) - spacing;
  };

  /* Draws pixel text. opts: {color, shadow, spacing, scale, align, wave} */
  Art.text = function (ctx, str, x, y, opts) {
    opts = opts || {};
    str = String(str).toUpperCase();
    var sp = opts.spacing === undefined ? 1 : opts.spacing;
    var sc = opts.scale || 1;
    var col = opts.color || '#ffffff';
    var adv = (Art.font.W + sp) * sc;
    if (opts.align === 'center') x -= (Art.textWidth(str, sp) * sc) / 2;
    else if (opts.align === 'right') x -= Art.textWidth(str, sp) * sc;
    x = Math.round(x); y = Math.round(y);

    for (var pass = (opts.shadow ? 0 : 1); pass < 2; pass++) {
      ctx.fillStyle = pass === 0 ? opts.shadow : col;
      var ox = pass === 0 ? sc : 0, oy = pass === 0 ? sc : 0;
      for (var i = 0; i < str.length; i++) {
        var g = Art.font.glyphs[str[i]];
        if (!g) continue;
        var wob = opts.wave ? Math.round(Math.sin((opts.wave + i * 0.5)) * (opts.waveAmp || 1)) * sc : 0;
        for (var r = 0; r < g.length; r++) {
          var rowStr = g[r];
          var runStart = -1;
          for (var cc = 0; cc <= rowStr.length; cc++) {
            var on = rowStr[cc] === '1';
            if (on && runStart < 0) runStart = cc;
            if (!on && runStart >= 0) {
              ctx.fillRect(x + i * adv + runStart * sc + ox,
                           y + r * sc + oy + wob, (cc - runStart) * sc, sc);
              runStart = -1;
            }
          }
        }
      }
    }
    return Art.textWidth(str, sp) * sc;
  };

  // ------------------------------------------------------------- tile themes
  Art.THEMES = {
    sky: {
      name: 'SKYFALL RIDGE',
      base: '#41506e', dark: '#1d2438', light: '#6d80a5', accent: '#c9d8ef',
      top: '#84e0a6', topDark: '#3a8f61',      // mossy capstone
      grain: 0.16, deco: 'moss',
      hazard: '#e05a3a',
      fog: '#9fb6dd'
    },
    lava: {
      name: 'MAGMA FOUNDRY',
      base: '#48302c', dark: '#1c1210', light: '#7a4c3c', accent: '#e0a768',
      top: '#9a97a4', topDark: '#43404b',      // riveted steel plate
      grain: 0.2, deco: 'rivet',
      hazard: '#ff7a1a',
      fog: '#7a3a28'
    },
    void: {
      name: 'VOID CITADEL',
      base: '#2e2946', dark: '#120f22', light: '#4d456f', accent: '#a794e0',
      top: '#64ece0', topDark: '#238090',      // energy conduit
      grain: 0.14, deco: 'circuit',
      hazard: '#ff3d7f',
      fog: '#2a2245'
    }
  };

  /* Material texture: a 64x64 canvas of dithered rock/metal that tiles.
   * Sampled by world position so terrain never visibly repeats per-tile. */
  function buildMaterial(t, seed) {
    var S = 64, c = mk(S, S), x = c.getContext('2d');
    var rnd = VZ.RNG(seed);
    x.fillStyle = t.base;
    x.fillRect(0, 0, S, S);

    // Value noise blobs for large-scale variation.
    var i, j;
    for (i = 0; i < 90; i++) {
      var bx = rnd.int(0, S - 1), by = rnd.int(0, S - 1);
      var r = rnd.int(2, 7);
      var up = rnd.chance(0.5);
      x.fillStyle = up ? t.light : t.dark;
      x.globalAlpha = 0.10 + rnd() * 0.14;
      x.beginPath(); x.arc(bx, by, r, 0, 7); x.fill();
      // wrap-around copies keep the texture seamless
      if (bx < r) { x.beginPath(); x.arc(bx + S, by, r, 0, 7); x.fill(); }
      if (bx > S - r) { x.beginPath(); x.arc(bx - S, by, r, 0, 7); x.fill(); }
      if (by < r) { x.beginPath(); x.arc(bx, by + S, r, 0, 7); x.fill(); }
      if (by > S - r) { x.beginPath(); x.arc(bx, by - S, r, 0, 7); x.fill(); }
    }
    x.globalAlpha = 1;

    // Per-pixel dither grain for that limited-palette look.
    var img = x.getImageData(0, 0, S, S), d = img.data;
    for (i = 0; i < S * S; i++) {
      var n = (rnd() - 0.5) * 255 * t.grain;
      var o = i * 4;
      d[o] = Math.max(0, Math.min(255, d[o] + n));
      d[o + 1] = Math.max(0, Math.min(255, d[o + 1] + n));
      d[o + 2] = Math.max(0, Math.min(255, d[o + 2] + n));
    }
    x.putImageData(img, 0, 0);

    // Cracks / seams.
    x.strokeStyle = t.dark; x.globalAlpha = 0.5; x.lineWidth = 1;
    for (i = 0; i < 10; i++) {
      var px = rnd.int(0, S), py = rnd.int(0, S);
      x.beginPath(); x.moveTo(px + 0.5, py + 0.5);
      for (j = 0; j < 5; j++) {
        px += rnd.int(-4, 4); py += rnd.int(1, 5);
        x.lineTo(px + 0.5, py + 0.5);
      }
      x.stroke();
    }
    x.globalAlpha = 1;
    return c;
  }

  /* Edge overlays for a 4-bit neighbour mask.
   * bit0 = solid above, bit1 = solid right, bit2 = solid below, bit3 = solid left.
   * We draw highlights/shadows only on the *open* sides. */
  function buildEdges(t, seed) {
    var T = VZ.TILE, list = [];
    var rnd = VZ.RNG(seed);
    for (var mask = 0; mask < 16; mask++) {
      var c = mk(T, T), x = c.getContext('2d');
      var openUp = !(mask & 1), openRight = !(mask & 2),
          openDown = !(mask & 4), openLeft = !(mask & 8);

      if (openUp) {
        // Capstone: a bright 3px band with a ragged 1px lip.
        x.fillStyle = t.top;
        x.fillRect(0, 0, T, 3);
        x.fillStyle = t.topDark;
        x.fillRect(0, 3, T, 1);
        x.fillStyle = t.top;
        for (var i = 0; i < T; i += 2) if (rnd.chance(0.55)) x.fillRect(i, 3, 2, 1);
        x.fillStyle = C.shade(t.top, 0.35);
        for (var k = 0; k < T; k += 3) if (rnd.chance(0.5)) x.fillRect(k, 0, 2, 1);
      } else {
        x.fillStyle = t.light;
        x.globalAlpha = 0.10; x.fillRect(0, 0, T, 1); x.globalAlpha = 1;
      }

      if (openLeft) {
        x.fillStyle = t.light; x.globalAlpha = 0.35;
        x.fillRect(0, openUp ? 4 : 0, 1, T);
        x.globalAlpha = 1;
        x.fillStyle = t.dark; x.globalAlpha = 0.25;
        x.fillRect(1, openUp ? 4 : 0, 1, T);
        x.globalAlpha = 1;
      }
      if (openRight) {
        x.fillStyle = t.dark; x.globalAlpha = 0.45;
        x.fillRect(T - 2, openUp ? 4 : 0, 2, T);
        x.globalAlpha = 1;
      }
      if (openDown) {
        x.fillStyle = t.dark; x.globalAlpha = 0.55;
        x.fillRect(0, T - 3, T, 3);
        x.globalAlpha = 1;
        // stalactite drips
        x.fillStyle = t.dark; x.globalAlpha = 0.4;
        for (var d2 = 1; d2 < T; d2 += 4) if (rnd.chance(0.4)) x.fillRect(d2, T - 5, 2, 2);
        x.globalAlpha = 1;
      }

      // Theme decoration on the exposed face.
      if (t.deco === 'rivet' && openUp) {
        x.fillStyle = C.shade(t.top, 0.5);
        x.fillRect(2, 1, 1, 1); x.fillRect(T - 3, 1, 1, 1);
      } else if (t.deco === 'circuit' && openUp) {
        x.fillStyle = C.shade(t.top, 0.55);
        x.fillRect(3, 1, 4, 1); x.fillRect(T - 7, 1, 4, 1);
      } else if (t.deco === 'moss' && openUp) {
        x.fillStyle = C.shade(t.top, 0.3);
        for (var g = 0; g < T; g += 5) if (rnd.chance(0.6)) x.fillRect(g + 1, -1, 1, 2);
      }
      list.push(c);
    }
    return list;
  }

  // Solid-but-interior decorations (sparse, adds detail to big rock masses).
  function buildDetails(t, seed) {
    var T = VZ.TILE, out = [], rnd = VZ.RNG(seed);
    for (var v = 0; v < 4; v++) {
      var c = mk(T, T), x = c.getContext('2d');
      if (t.deco === 'rivet') {
        x.fillStyle = C.shade(t.base, -0.35);
        x.fillRect(3, 3, 2, 2); x.fillRect(T - 5, 3, 2, 2);
        x.fillRect(3, T - 5, 2, 2); x.fillRect(T - 5, T - 5, 2, 2);
        x.fillStyle = C.shade(t.base, 0.25);
        x.fillRect(3, 3, 1, 1); x.fillRect(T - 5, 3, 1, 1);
        x.fillRect(3, T - 5, 1, 1); x.fillRect(T - 5, T - 5, 1, 1);
      } else if (t.deco === 'circuit') {
        x.strokeStyle = C.shade(t.base, 0.3); x.lineWidth = 1;
        x.beginPath();
        x.moveTo(1.5, 4.5); x.lineTo(6.5, 4.5); x.lineTo(6.5, 11.5); x.lineTo(14.5, 11.5);
        x.stroke();
        x.fillStyle = t.accent;
        x.fillRect(6, 4, 2, 2);
      } else {
        x.fillStyle = C.shade(t.base, -0.28);
        for (var i = 0; i < 5; i++) x.fillRect(rnd.int(1, T - 3), rnd.int(1, T - 3), rnd.int(1, 3), 1);
      }
      out.push(c);
    }
    return out;
  }

  Art.buildTileset = function (key) {
    if (Art.tilesets[key]) return Art.tilesets[key];
    var t = Art.THEMES[key];
    var seed = key.charCodeAt(0) * 7919 + key.length * 104729;
    var ts = {
      theme: t,
      material: buildMaterial(t, seed),
      edges: buildEdges(t, seed + 17),
      details: buildDetails(t, seed + 91),
      platform: buildPlatform(t),
      spike: buildSpike(t),
      crumble: buildCrumble(t),
      conveyor: buildConveyor(t),
      ice: null
    };
    Art.tilesets[key] = ts;
    return ts;
  };

  // One-way platform: a thin ledge you can jump up through.
  function buildPlatform(t) {
    var T = VZ.TILE, c = mk(T, T), x = c.getContext('2d');
    x.fillStyle = t.topDark; x.fillRect(0, 0, T, 5);
    x.fillStyle = t.top; x.fillRect(0, 0, T, 2);
    x.fillStyle = C.shade(t.topDark, -0.4); x.fillRect(0, 5, T, 1);
    x.fillStyle = C.shade(t.top, 0.4);
    x.fillRect(1, 0, 3, 1); x.fillRect(T - 6, 0, 4, 1);
    x.fillStyle = C.shade(t.topDark, -0.25);
    x.fillRect(2, 2, 2, 3); x.fillRect(T - 4, 2, 2, 3);
    return c;
  }

  function buildSpike(t) {
    var T = VZ.TILE, c = mk(T, T), x = c.getContext('2d');
    x.fillStyle = C.shade(t.dark, 0.1);
    x.fillRect(0, T - 4, T, 4);
    var cols = [C.shade(t.accent, 0.35), t.accent, C.shade(t.accent, -0.35)];
    for (var s = 0; s < 2; s++) {
      var bx = s * 8;
      for (var r = 0; r < 12; r++) {
        var half = Math.max(1, Math.round((r / 11) * 3.5));
        var y = T - 4 - (11 - r);
        x.fillStyle = cols[1];
        x.fillRect(bx + 4 - half, y, half * 2, 1);
        x.fillStyle = cols[0];
        x.fillRect(bx + 4 - half, y, 1, 1);
        x.fillStyle = cols[2];
        x.fillRect(bx + 4 + half - 1, y, 1, 1);
      }
    }
    x.fillStyle = C.shade(t.dark, -0.2); x.fillRect(0, T - 1, T, 1);
    return c;
  }

  // Crumbling block, 4 stages of decay.
  function buildCrumble(t) {
    var T = VZ.TILE, out = [], rnd = VZ.RNG(4242);
    for (var s = 0; s < 4; s++) {
      var c = mk(T, T), x = c.getContext('2d');
      x.fillStyle = C.shade(t.base, 0.12);
      x.fillRect(0, 0, T, T);
      x.fillStyle = C.shade(t.base, 0.3); x.fillRect(0, 0, T, 2);
      x.fillStyle = C.shade(t.base, -0.4); x.fillRect(0, T - 2, T, 2);
      x.fillStyle = C.shade(t.base, -0.3);
      x.fillRect(0, 0, 1, T); x.fillRect(T - 1, 0, 1, T);
      // cracks widen with damage
      x.strokeStyle = C.shade(t.base, -0.55); x.lineWidth = 1;
      for (var i = 0; i < s * 3; i++) {
        var px = rnd.int(1, T - 2), py = rnd.int(1, T - 2);
        x.beginPath(); x.moveTo(px + 0.5, py + 0.5);
        x.lineTo(px + rnd.int(-4, 4) + 0.5, py + rnd.int(-4, 4) + 0.5);
        x.stroke();
      }
      if (s >= 2) {
        x.clearRect(rnd.int(0, 12), rnd.int(0, 12), 3, 3);
      }
      out.push(c);
    }
    return out;
  }

  function buildConveyor(t) {
    var T = VZ.TILE, frames = [];
    for (var f = 0; f < 4; f++) {
      var c = mk(T, T), x = c.getContext('2d');
      x.fillStyle = C.shade(t.dark, 0.18); x.fillRect(0, 0, T, T);
      x.fillStyle = C.shade(t.base, -0.1); x.fillRect(0, 2, T, T - 4);
      x.fillStyle = C.shade(t.base, 0.28);
      for (var i = -4; i < T; i += 4) {
        x.fillRect((i + f) % (T + 4) - 2, 0, 2, 2);
        x.fillRect((i + f) % (T + 4) - 2, T - 2, 2, 2);
      }
      x.fillStyle = t.accent;
      x.globalAlpha = 0.5;
      x.fillRect(0, T / 2 - 1, T, 2);
      x.globalAlpha = 1;
      frames.push(c);
    }
    return frames;
  }

  // ----------------------------------------------------------- backgrounds
  // Each layer is a wide canvas that repeats horizontally at its own rate.
  function skyGradient(x, w, h, stops) {
    var g = x.createLinearGradient(0, 0, 0, h);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }

  function ridgeLine(x, w, h, baseY, amp, color, seed, steps) {
    var rnd = VZ.RNG(seed);
    x.fillStyle = color;
    x.beginPath(); x.moveTo(0, h);
    var pts = [];
    var n = steps || 12;
    for (var i = 0; i <= n; i++) pts.push(baseY + (rnd() - 0.5) * amp);
    pts[n] = pts[0]; // seamless wrap
    for (var j = 0; j <= n; j++) {
      x.lineTo((j / n) * w, pts[j]);
    }
    x.lineTo(w, h); x.closePath(); x.fill();
  }

  Art.buildBackground = function (key) {
    if (Art.backgrounds[key]) return Art.backgrounds[key];
    var layers;
    if (key === 'sky') layers = buildSkyBG();
    else if (key === 'lava') layers = buildLavaBG();
    else layers = buildVoidBG();
    Art.backgrounds[key] = layers;
    return layers;
  };

  function buildSkyBG() {
    var W = 512, H = 240, i;
    // -- layer 0: sky, sun, stars ------------------------------------------
    // Value plan: dark at the top, a warm band at the horizon, then a cool
    // haze below it so pits read as depth rather than as a stripe of colour.
    var c0 = mk(W, H), x0 = c0.getContext('2d');
    skyGradient(x0, W, H, [
      [0, '#0e1637'], [0.22, '#1d2c5e'], [0.42, '#39508f'],
      [0.58, '#6d7bb0'], [0.66, '#c98f79'], [0.72, '#e8b98c'],
      [0.80, '#8f9ec4'], [1, '#4c5c86']
    ]);
    // sun low over the horizon
    var sx = 372, sy = 152;
    for (i = 8; i >= 0; i--) {
      x0.globalAlpha = 0.05;
      x0.fillStyle = '#ffdca8';
      x0.beginPath(); x0.arc(sx, sy, 16 + i * 11, 0, 7); x0.fill();
    }
    x0.globalAlpha = 1;
    x0.fillStyle = '#ffeccb';
    x0.beginPath(); x0.arc(sx, sy, 17, 0, 7); x0.fill();
    // Scanline bands across the lower half of the disc - a very 16-bit sunset.
    // Clipped to the disc so the cut never bleeds into the glow around it.
    x0.save();
    x0.beginPath(); x0.arc(sx, sy, 17, 0, 7); x0.clip();
    x0.globalCompositeOperation = 'destination-out';
    for (var b = 0; b < 7; b++) x0.fillRect(sx - 20, sy + 3 + b * 4, 40, 1 + (b > 3 ? 1 : 0));
    x0.restore();
    var rnd = VZ.RNG(1234);
    for (var st = 0; st < 90; st++) {
      var yy = rnd.range(0, 96);
      x0.globalAlpha = Math.max(0, 0.95 - yy / 100);
      x0.fillStyle = rnd.chance(0.2) ? '#bcd6ff' : '#ffffff';
      x0.fillRect(rnd.int(0, W), yy | 0, 1, 1);
    }
    x0.globalAlpha = 1;

    // -- layer 1: far peaks (hazy, lighter than the sky = distance) --------
    var c1 = mk(W, H), x1 = c1.getContext('2d');
    ridgeLine(x1, W, H, 126, 52, '#7d8db8', 77, 15);
    ridgeLine(x1, W, H, 150, 34, '#63739e', 78, 11);
    x1.globalCompositeOperation = 'destination-in';
    var fade = x1.createLinearGradient(0, 100, 0, 210);
    fade.addColorStop(0, 'rgba(0,0,0,0.85)');
    fade.addColorStop(1, 'rgba(0,0,0,0.15)');
    x1.fillStyle = fade; x1.fillRect(0, 0, W, H);
    x1.globalCompositeOperation = 'source-over';

    // -- layer 2: nearer ridge, darker -------------------------------------
    var c2 = mk(W, H), x2 = c2.getContext('2d');
    ridgeLine(x2, W, H, 168, 40, '#3c4870', 311, 9);
    ridgeLine(x2, W, H, 190, 22, '#2a3357', 312, 7);

    // -- layer 3: floating ruins -------------------------------------------
    var c3 = mk(W, H), x3 = c3.getContext('2d');
    var r3 = VZ.RNG(3131);
    for (var is = 0; is < 5; is++) {
      var ix = r3.range(20, W - 70), iy = r3.range(52, 132);
      var iw = r3.int(26, 58);
      x3.fillStyle = '#4a5678';
      x3.fillRect(ix, iy, iw, 6);
      x3.fillStyle = '#6fbc8c';
      x3.fillRect(ix + 1, iy - 2, iw - 2, 3);
      x3.fillStyle = '#333d5b';
      for (var d = 0; d < 12; d++) {
        var ww = Math.max(2, iw - 2 - d * (iw / 14));
        x3.fillRect(ix + (iw - ww) / 2, iy + 6 + d, ww, 1);
      }
      if (r3.chance(0.7)) {
        x3.fillStyle = '#7987ad';
        x3.fillRect(ix + iw / 2 - 2, iy - 12, 4, 12);
        x3.fillStyle = '#98a6cc';
        x3.fillRect(ix + iw / 2 - 3, iy - 14, 6, 2);
      }
    }

    // -- layer 4: low cloud bank -------------------------------------------
    // Flat, wide and faint, and kept to the bottom third so it never fights
    // with the sprites for attention.
    var c4 = mk(W, H), x4 = c4.getContext('2d');
    var r4 = VZ.RNG(99);
    for (var cl = 0; cl < 22; cl++) {
      var cxp = r4.range(0, W), cyp = r4.range(178, 226);
      var cw = r4.range(30, 78), chh = r4.range(3, 7);
      x4.globalAlpha = r4.range(0.13, 0.3);
      x4.fillStyle = cyp > 205 ? '#c3d2ee' : '#9fb0d6';
      for (var seg = 0; seg < 3; seg++) {
        var sw = cw * (1 - seg * 0.26);
        x4.beginPath();
        x4.ellipse(cxp, cyp - seg * chh * 0.7, sw / 2, chh, 0, 0, Math.PI * 2);
        x4.fill();
        if (cxp < cw) { x4.beginPath(); x4.ellipse(cxp + W, cyp - seg * chh * 0.7, sw / 2, chh, 0, 0, 7); x4.fill(); }
        if (cxp > W - cw) { x4.beginPath(); x4.ellipse(cxp - W, cyp - seg * chh * 0.7, sw / 2, chh, 0, 0, 7); x4.fill(); }
      }
    }
    x4.globalAlpha = 1;

    return [
      { canvas: c0, factor: 0.03, yFactor: 0.02, yOff: -14 },
      { canvas: c1, factor: 0.10, yFactor: 0.05, yOff: -12 },
      { canvas: c3, factor: 0.17, yFactor: 0.08, yOff: -8 },
      { canvas: c2, factor: 0.26, yFactor: 0.11, yOff: -4 },
      { canvas: c4, factor: 0.40, yFactor: 0.16, yOff: 0 }
    ];
  }

  function buildLavaBG() {
    var W = 512, H = 240;
    var c0 = mk(W, H), x0 = c0.getContext('2d');
    skyGradient(x0, W, H, [
      [0, '#160a0c'], [0.4, '#2a1013'], [0.72, '#5c1c14'], [0.88, '#a8341a'], [1, '#f08a2a']
    ]);
    // heat shimmer bands
    x0.globalAlpha = 0.06; x0.fillStyle = '#ffb347';
    for (var i = 0; i < 30; i++) x0.fillRect(0, 190 + (i % 8) * 3, W, 1);
    x0.globalAlpha = 1;

    // layer 1: silhouetted machinery
    var c1 = mk(W, H), x1 = c1.getContext('2d');
    var r1 = VZ.RNG(555);
    x1.fillStyle = '#1e0f10';
    for (var t = 0; t < 16; t++) {
      var tx = t * 34 + r1.int(-6, 6), tw = r1.int(16, 34), th = r1.int(40, 110);
      x1.fillRect(tx, H - 40 - th, tw, th + 40);
      // chimney
      if (r1.chance(0.5)) x1.fillRect(tx + tw / 2 - 3, H - 60 - th, 6, 24);
    }
    // glowing windows
    for (var wI = 0; wI < 70; wI++) {
      x1.fillStyle = r1.chance(0.5) ? '#ff8c1a' : '#ffc247';
      x1.globalAlpha = r1.range(0.35, 0.95);
      x1.fillRect(r1.int(0, W), r1.int(H - 150, H - 40), 2, 3);
    }
    x1.globalAlpha = 1;

    // layer 2: foreground pipes & gantries
    var c2 = mk(W, H), x2 = c2.getContext('2d');
    var r2 = VZ.RNG(8181);
    x2.fillStyle = '#2c1718';
    for (var p = 0; p < 6; p++) {
      var py = r2.int(20, 140);
      x2.fillRect(0, py, W, 7);
      x2.fillStyle = '#3d2020';
      for (var b = 0; b < W; b += 40) x2.fillRect(b, py - 3, 6, 13);
      x2.fillStyle = '#2c1718';
    }
    // hanging chains
    x2.fillStyle = '#241313';
    for (var ch = 0; ch < 10; ch++) {
      var cx = r2.int(0, W), cl = r2.int(20, 70);
      for (var l = 0; l < cl; l += 4) x2.fillRect(cx, l + 30, 2, 3);
    }

    // layer 3: lava glow pool at the bottom
    var c3 = mk(W, H), x3 = c3.getContext('2d');
    var g3 = x3.createLinearGradient(0, H - 70, 0, H);
    g3.addColorStop(0, 'rgba(255,120,20,0)');
    g3.addColorStop(1, 'rgba(255,170,40,0.55)');
    x3.fillStyle = g3; x3.fillRect(0, H - 70, W, 70);

    return [
      { canvas: c0, factor: 0.03, yFactor: 0.02, yOff: -10 },
      { canvas: c1, factor: 0.14, yFactor: 0.07, yOff: -8 },
      { canvas: c3, factor: 0.2, yFactor: 0.08, yOff: 0 },
      { canvas: c2, factor: 0.34, yFactor: 0.15, yOff: -20 }
    ];
  }

  function buildVoidBG() {
    var W = 512, H = 240;
    var c0 = mk(W, H), x0 = c0.getContext('2d');
    skyGradient(x0, W, H, [
      [0, '#05030f'], [0.45, '#0d0a24'], [0.8, '#1c1440'], [1, '#2b1d55']
    ]);
    var r0 = VZ.RNG(2020);
    for (var s = 0; s < 220; s++) {
      var b = r0.range(0.25, 1);
      x0.globalAlpha = b;
      x0.fillStyle = r0.chance(0.15) ? '#9fd8ff' : '#ffffff';
      x0.fillRect(r0.int(0, W), r0.int(0, H - 40), 1, 1);
    }
    x0.globalAlpha = 1;
    // ringed planet
    x0.fillStyle = '#3a2f6e';
    x0.beginPath(); x0.arc(120, 66, 30, 0, 7); x0.fill();
    x0.fillStyle = '#4b3d8c';
    x0.beginPath(); x0.arc(112, 58, 24, 0, 7); x0.fill();
    x0.strokeStyle = '#6b5ab8'; x0.lineWidth = 2;
    x0.save(); x0.translate(120, 66); x0.rotate(-0.35); x0.scale(1, 0.24);
    x0.beginPath(); x0.arc(0, 0, 46, 0, 7); x0.stroke();
    x0.restore();

    // layer 1: distant spires
    var c1 = mk(W, H), x1 = c1.getContext('2d');
    var r1 = VZ.RNG(6060);
    for (var t = 0; t < 22; t++) {
      var tx = t * 24 + r1.int(-5, 5), tw = r1.int(10, 24), th = r1.int(50, 150);
      x1.fillStyle = '#151033';
      x1.fillRect(tx, H - 30 - th, tw, th + 30);
      x1.fillStyle = '#241a52';
      x1.fillRect(tx, H - 30 - th, 2, th + 30);
      // spire tip
      x1.fillStyle = '#151033';
      x1.beginPath();
      x1.moveTo(tx, H - 30 - th); x1.lineTo(tx + tw / 2, H - 30 - th - r1.int(6, 20));
      x1.lineTo(tx + tw, H - 30 - th); x1.fill();
      // neon strip
      x1.fillStyle = r1.chance(0.5) ? '#5fe6d8' : '#ff3d7f';
      x1.globalAlpha = 0.75;
      x1.fillRect(tx + tw - 3, H - 26 - th, 1, th);
      x1.globalAlpha = 1;
    }

    // layer 2: near towers with lit windows
    var c2 = mk(W, H), x2 = c2.getContext('2d');
    var r2 = VZ.RNG(717);
    for (var n = 0; n < 10; n++) {
      var nx = n * 52 + r2.int(-8, 8), nw = r2.int(26, 44), nh = r2.int(70, 170);
      x2.fillStyle = '#0b0820';
      x2.fillRect(nx, H - nh, nw, nh);
      x2.fillStyle = '#171136';
      x2.fillRect(nx, H - nh, nw, 3);
      for (var wy = H - nh + 8; wy < H - 8; wy += 9) {
        for (var wx = nx + 4; wx < nx + nw - 4; wx += 7) {
          if (r2.chance(0.4)) {
            x2.fillStyle = r2.chance(0.3) ? '#ff3d7f' : '#5fe6d8';
            x2.globalAlpha = r2.range(0.3, 0.9);
            x2.fillRect(wx, wy, 3, 4);
          }
        }
      }
      x2.globalAlpha = 1;
    }

    // layer 3: energy grid haze
    var c3 = mk(W, H), x3 = c3.getContext('2d');
    x3.strokeStyle = 'rgba(95,230,216,0.10)'; x3.lineWidth = 1;
    for (var gx = 0; gx < W; gx += 32) {
      x3.beginPath(); x3.moveTo(gx + 0.5, 0); x3.lineTo(gx + 0.5, H); x3.stroke();
    }
    for (var gy = 0; gy < H; gy += 32) {
      x3.beginPath(); x3.moveTo(0, gy + 0.5); x3.lineTo(W, gy + 0.5); x3.stroke();
    }

    return [
      { canvas: c0, factor: 0.02, yFactor: 0.01, yOff: -8 },
      { canvas: c3, factor: 0.1, yFactor: 0.05, yOff: 0 },
      { canvas: c1, factor: 0.18, yFactor: 0.08, yOff: -6 },
      { canvas: c2, factor: 0.34, yFactor: 0.14, yOff: -4 }
    ];
  }

})(typeof window !== 'undefined' ? window : globalThis);
