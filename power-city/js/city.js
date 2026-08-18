/* POWER CITY - the city itself.
 *
 * Backgrounds are composed, not drawn: a seeded walk along the stage lays
 * down facade modules - brick, shutters, neon, chain-link - each of which
 * knows how to paint itself. Panels that should show sky (an alley mouth, a
 * fence) simply leave their pixels transparent, and the parallax skyline
 * behind shows through. Same trick the arcade original used, minus the ROM.
 */
(function (global) {
  'use strict';
  var PC = global.PC || (global.PC = {});
  var Art = PC.art, C = PC.color;
  var City = PC.city = {};

  var FIELD_H = PC.FLOOR_TOP - PC.FIELD_Y;      // wall height, 132px
  var FLOOR_H = PC.FIELD_BOT - PC.FLOOR_TOP;    // street height, 60px

  // ------------------------------------------------------------- the skyline
  /* One wide, horizontally tiling canvas per theme: night sky, stars, and a
   * ragged block of towers with windows lit at random. */
  City.makeSky = function (theme, w, h) {
    var c = Art.mk(w, h), x = c.getContext('2d');
    var r = PC.RNG(theme.seed || 7);
    var top = theme.sky[0], bot = theme.sky[1];
    /* The horizon sits level with the top of the street-level fences, so a
     * gap anywhere in the facade shows towers and not just empty gradient. */
    var hor = Math.round(h * 0.47);
    var i, j;
    for (j = 0; j < hor; j++) Art.rect(x, 0, j, w, 1, C.mix(top, bot, j / hor));
    for (i = 0; i < w * hor / 700; i++) {
      Art.rect(x, r.int(0, w - 1), r.int(0, hor - 6), 1, 1, r.chance(0.25) ? '#ffffff' : '#b8c8f0');
    }
    if (theme.moon) {
      Art.ellipse(x, theme.moon[0], theme.moon[1], 11, 11, '#f0ecd0');
      Art.ellipse(x, theme.moon[0] + 4, theme.moon[1] - 2, 9, 9, C.mix(top, bot, 0.25));
    }
    // ---- towers, standing on the horizon
    var bx = 0;
    while (bx < w) {
      var bw = r.int(12, 26), bh = r.int(Math.floor(hor * 0.3), Math.floor(hor * 0.92));
      var col = C.mix(theme.tower, bot, r.range(0, 0.3));
      Art.rect(x, bx, hor - bh, bw, bh, col);
      if (r.chance(0.3)) Art.rect(x, bx + Math.floor(bw / 2) - 1, hor - bh - r.int(4, 10), 2, 10, col);
      if (r.chance(0.22)) Art.rect(x, bx + Math.floor(bw / 2) - 1, hor - bh - r.int(6, 12), 2, 2, '#ff4a4a');
      for (j = hor - bh + 3; j < hor - 2; j += 5) {
        for (i = bx + 2; i < bx + bw - 3; i += 4) {
          if (r.chance(0.4)) Art.rect(x, i, j, 2, 3, r.chance(0.18) ? '#f8e070' : theme.lit);
        }
      }
      bx += bw + r.int(0, 3);
    }
    // ---- whatever lies below the horizon, for gaps that reach the ground
    if (theme.water) {
      for (j = hor; j < h; j++) {
        Art.rect(x, 0, j, w, 1, C.mix(theme.water, C.shade(theme.water, -0.5), (j - hor) / (h - hor)));
      }
      // broken reflections of the lit skyline
      for (i = 0; i < w / 3; i++) {
        var rx = r.int(0, w - 1), ry = hor + r.int(1, h - hor - 2);
        Art.rect(x, rx, ry, r.int(2, 5), 1, r.chance(0.3) ? theme.lit : C.shade(theme.water, 0.22));
      }
      Art.rect(x, 0, hor, w, 1, C.shade(theme.water, 0.35));
    } else {
      Art.rect(x, 0, hor, w, h - hor, theme.behind || C.shade(theme.sky[1], -0.55));
      // a haze of low roofs so the ground gaps are not a flat block
      for (i = 0; i < w; i += r.int(9, 22)) {
        var rh = r.int(3, 12);
        Art.rect(x, i, hor, r.int(8, 20), rh, C.shade(theme.behind || theme.sky[1], -0.35));
      }
    }
    return c;
  };

  // -------------------------------------------------------- facade modules
  /* Every module paints into the wall strip (0..FIELD_H) starting at x, and
   * returns nothing; the composer knows each module's width up front. */
  var MOD = {};

  function brick(x, ctx, w, t, r) {
    var base = t.brick, dark = C.shade(base, -0.3), light = C.shade(base, 0.18);
    Art.rect(ctx, x, 0, w, FIELD_H, dark);
    var bw = 12, bh = 6, row = 0;
    for (var j = 0; j < FIELD_H; j += bh, row++) {
      var off = (row % 2) ? bw / 2 : 0;
      for (var i = -bw; i < w + bw; i += bw) {
        var px = x + i + off;
        Art.rect(ctx, px + 1, j + 1, bw - 1, bh - 1, r.chance(0.13) ? C.mix(base, light, 0.6) : base);
      }
    }
    // a wash of grime toward the ground
    for (var k = 0; k < 18; k++) Art.dither(ctx, x, FIELD_H - 26 + k, w, 1, dark, k % 2);
  }

  MOD.wall = { w: 48, paint: function (ctx, x, t, r) { brick(x, ctx, 48, t, r); } };

  MOD.windows = {
    w: 48,
    paint: function (ctx, x, t, r) {
      brick(x, ctx, 48, t, r);
      for (var i = 0; i < 2; i++) {
        var wx = x + 6 + i * 24, wy = 14 + (i % 2) * 4;
        Art.rect(ctx, wx - 2, wy - 2, 22, 30, C.shade(t.brick, -0.45));
        Art.rect(ctx, wx, wy, 18, 26, r.chance(0.45) ? t.lit : '#101a2e');
        Art.rect(ctx, wx + 8, wy, 2, 26, C.shade(t.brick, -0.5));
        Art.rect(ctx, wx, wy + 12, 18, 2, C.shade(t.brick, -0.5));
        // a slash of reflected light across the glass
        Art.limb(ctx, wx + 2, wy + 22, wx + 14, wy + 4, 2, 2, 'rgba(255,255,255,0.16)');
        Art.rect(ctx, wx - 3, wy + 28, 24, 3, C.shade(t.brick, 0.25));
      }
    }
  };

  MOD.door = {
    w: 40,
    paint: function (ctx, x, t, r) {
      brick(x, ctx, 40, t, r);
      var dw = 24, dh = 54, dx = x + 8, dy = FIELD_H - dh;
      Art.rect(ctx, dx - 3, dy - 3, dw + 6, dh + 3, C.shade(t.brick, -0.5));
      Art.rect(ctx, dx, dy, dw, dh, '#8a8fa0');
      Art.rect(ctx, dx, dy, dw, 2, '#b4bacd');
      Art.rect(ctx, dx + dw - 3, dy, 3, dh, '#5f6474');
      Art.rect(ctx, dx + 4, dy + 6, 12, 10, '#2a3040');
      Art.limb(ctx, dx + 5, dy + 15, dx + 14, dy + 7, 1.6, 1.6, '#c8ccd8');
      Art.rect(ctx, dx + 4, dy + 24, 14, 12, '#6f7484');
      Art.rect(ctx, dx + 3, dy + 30, 3, 3, '#3a4050');
    }
  };

  MOD.neon = {
    w: 80,
    paint: function (ctx, x, t, r) {
      brick(x, ctx, 80, t, r);
      var sx = x + 6, sy = 16, sw = 68, sh = 30;
      Art.rect(ctx, sx, sy, sw, sh, '#1a1020');
      Art.rect(ctx, sx + 1, sy + 1, sw - 2, sh - 2, '#2a1430');
      // tube border
      var neon = t.neon || '#ff5fa8';
      Art.rect(ctx, sx + 2, sy + 2, sw - 4, 1, neon);
      Art.rect(ctx, sx + 2, sy + sh - 3, sw - 4, 1, neon);
      Art.rect(ctx, sx + 2, sy + 2, 1, sh - 4, neon);
      Art.rect(ctx, sx + sw - 3, sy + 2, 1, sh - 4, neon);
      var l1 = t.signTop || 'BAR', l2 = t.signBot || 'STARLIGHT';
      Art.text(ctx, l1, sx + sw / 2 - (t.signStar ? 6 : 0), sy + 7, neon, { align: 'center', scale: 1, tracking: 2 });
      if (t.signStar) Art.text(ctx, '★', sx + sw / 2 + 12, sy + 7, t.neon2 || '#ffd23a');
      Art.text(ctx, l2, sx + sw / 2, sy + 18, t.neon2 || neon, { align: 'center', scale: 1, tracking: 1 });
      // glow spill on the brick
      ctx.save(); ctx.globalAlpha = 0.10; ctx.fillStyle = neon;
      ctx.fillRect(Math.round(sx - 5), sy - 4, sw + 10, sh + 9);
      ctx.restore();
    }
  };

  MOD.shutter = {
    w: 84,
    paint: function (ctx, x, t, r) {
      brick(x, ctx, 84, t, r);
      var sx = x + 8, sw = 68, sh = 74, sy = FIELD_H - sh;
      Art.rect(ctx, sx - 3, sy - 5, sw + 6, sh + 5, C.shade(t.brick, -0.5));
      Art.rect(ctx, sx, sy, sw, sh, '#9096a4');
      for (var j = 0; j < sh; j += 4) {
        Art.rect(ctx, sx, sy + j, sw, 1, '#6c7180');
        Art.rect(ctx, sx, sy + j + 2, sw, 1, '#b0b6c4');
      }
      Art.rect(ctx, sx, sy - 4, sw, 5, '#5f6474');
      Art.rect(ctx, sx, sy + sh - 4, sw, 4, '#4a4f5e');
      // graffiti - the tag the stage is named for
      var tag = t.tag || 'POWER CITY', tw = tag.split(' ');
      var gc = t.tagColor || '#c840e0';
      for (var i = 0; i < tw.length; i++) {
        Art.text(ctx, tw[i], sx + sw / 2 + (i % 2 ? 3 : -3), sy + 16 + i * 16, gc,
          { align: 'center', scale: 2, tracking: 0, wobble: 2, phase: i * 1.7, shadow: C.shade(gc, -0.55), shadowDist: 2 });
      }
    }
  };

  MOD.fence = {
    w: 96, gap: true,
    paint: function (ctx, x, t, r) {
      // the sky shows through: leave the upper panel empty, wire it over later
      var pw = 96, ph = 62;
      Art.rect(ctx, x, ph, pw, FIELD_H - ph, C.shade(t.brick, -0.55));
      // low wall under the fence
      brickBand(ctx, x, ph, pw, FIELD_H - ph, t, r);
      // posts + chain link over the open part
      Art.rect(ctx, x, 0, 3, ph, '#6c7180');
      Art.rect(ctx, x + pw - 3, 0, 3, ph, '#6c7180');
      Art.rect(ctx, x, 0, pw, 3, '#6c7180');
      Art.rect(ctx, x, ph - 3, pw, 4, '#6c7180');
      var wire = t.fence || '#3a5fd8';
      ctx.save();
      ctx.beginPath(); ctx.rect(x + 3, 3, pw - 6, ph - 6); ctx.clip();
      for (var i = -ph; i < pw; i += 8) {
        Art.limb(ctx, x + i, 3, x + i + ph, ph - 3, 1, 1, wire);
        Art.limb(ctx, x + i + ph, 3, x + i, ph - 3, 1, 1, C.shade(wire, -0.3));
      }
      ctx.restore();
      // KEEP OUT plate
      var kx = x + pw / 2 - 20, ky = 22;
      Art.rect(ctx, kx, ky, 40, 22, '#c8a038');
      Art.rect(ctx, kx + 1, ky + 1, 38, 20, '#e8c258');
      Art.rect(ctx, kx + 3, ky + 3, 34, 16, '#3a2c10');
      Art.text(ctx, 'KEEP', kx + 20, ky + 5, '#f0d878', { align: 'center' });
      Art.text(ctx, 'OUT', kx + 20, ky + 12, '#f0d878', { align: 'center' });
    }
  };

  function brickBand(ctx, x, y, w, h, t, r) {
    var base = C.shade(t.brick, -0.15), dark = C.shade(base, -0.35);
    Art.rect(ctx, x, y, w, h, dark);
    for (var j = y; j < y + h; j += 6) {
      var off = ((j - y) / 6 % 2) ? 6 : 0;
      for (var i = -12; i < w + 12; i += 12) Art.rect(ctx, x + i + off + 1, j + 1, 11, 5, base);
    }
  }

  MOD.alley = {
    w: 40, gap: true,
    paint: function (ctx, x, t, r) {
      // a black slot between buildings, with a bin and a stripe of skyline
      Art.rect(ctx, x + 6, 0, 28, FIELD_H, 'rgba(0,0,0,0)');
      Art.rect(ctx, x, 0, 6, FIELD_H, C.shade(t.brick, -0.55));
      Art.rect(ctx, x + 34, 0, 6, FIELD_H, C.shade(t.brick, -0.55));
      Art.rect(ctx, x + 6, FIELD_H - 40, 28, 40, '#0d0f18');
      Art.rect(ctx, x + 10, FIELD_H - 20, 18, 20, '#2a3448');
      Art.rect(ctx, x + 10, FIELD_H - 22, 18, 3, '#3e4a62');
    }
  };

  MOD.escape = {
    w: 56,
    paint: function (ctx, x, t, r) {
      brick(x, ctx, 56, t, r);
      var m = '#3a4054', ml = '#59617a';
      for (var lv = 0; lv < 2; lv++) {
        var y = 22 + lv * 44;
        Art.rect(ctx, x + 4, y, 48, 2, ml);
        Art.hatch(ctx, x + 4, y - 10, 48, 10, 5, m, 'v');
        Art.rect(ctx, x + 4, y - 10, 48, 1, m);
        // the stair run down to the next landing
        for (var s = 0; s < 9; s++) Art.rect(ctx, x + 8 + s * 4, y + 2 + s * 4, 6, 2, ml);
      }
      Art.rect(ctx, x + 50, 0, 3, FIELD_H, C.shade(t.brick, -0.5));
    }
  };

  MOD.pipe = {
    w: 16,
    paint: function (ctx, x, t, r) {
      brick(x, ctx, 16, t, r);
      Art.rect(ctx, x + 5, 0, 5, FIELD_H, '#5a6070');
      Art.rect(ctx, x + 5, 0, 2, FIELD_H, '#8a90a0');
      for (var j = 14; j < FIELD_H; j += 34) Art.rect(ctx, x + 3, j, 9, 3, '#3f4554');
    }
  };

  MOD.poster = {
    w: 32,
    paint: function (ctx, x, t, r) {
      brick(x, ctx, 32, t, r);
      var px = x + 6, py = 24;
      Art.rect(ctx, px, py, 20, 28, '#e8e4d8');
      Art.rect(ctx, px + 1, py + 1, 18, 26, r.pick(['#d84a3a', '#3a6ad8', '#d8a83a']));
      Art.rect(ctx, px + 3, py + 4, 14, 10, '#f0ece0');
      Art.rect(ctx, px + 3, py + 17, 14, 2, '#f0ece0');
      Art.rect(ctx, px + 3, py + 21, 9, 2, '#f0ece0');
    }
  };

  MOD.crates = {
    w: 44,
    paint: function (ctx, x, t, r) {
      brick(x, ctx, 44, t, r);
      var stack = [[4, 0, 20, 18], [26, 0, 16, 14], [8, 18, 18, 16]];
      for (var i = 0; i < stack.length; i++) {
        var s = stack[i], sx = x + s[0], sy = FIELD_H - s[3] - s[1];
        Art.rect(ctx, sx, sy, s[2], s[3], '#8a5c2c');
        Art.rect(ctx, sx + 1, sy + 1, s[2] - 2, s[3] - 2, '#b0762e');
        Art.limb(ctx, sx + 1, sy + s[3] - 2, sx + s[2] - 2, sy + 1, 1.6, 1.6, '#7a4e22');
      }
    }
  };

  MOD.container = {
    w: 68,
    paint: function (ctx, x, t, r) {
      Art.rect(ctx, x, 0, 68, FIELD_H, 'rgba(0,0,0,0)');
      var col = r.pick(['#c05028', '#2f7f9a', '#3f8c46', '#b8a030']);
      var h = 62, y = FIELD_H - h;
      Art.rect(ctx, x + 2, y, 64, h, C.shade(col, -0.35));
      Art.rect(ctx, x + 3, y + 1, 62, h - 2, col);
      Art.hatch(ctx, x + 5, y + 3, 58, h - 6, 5, C.shade(col, -0.22), 'v');
      Art.rect(ctx, x + 2, y, 64, 4, C.shade(col, 0.2));
      Art.rect(ctx, x + 2, y + h - 5, 64, 5, C.shade(col, -0.45));
      Art.text(ctx, 'PCX', x + 34, y + 26, C.shade(col, 0.55), { align: 'center', scale: 2, tracking: 1 });
      // a second one, stacked and set back
      if (r.chance(0.5)) {
        var c2 = C.shade(r.pick(['#c05028', '#2f7f9a', '#b8a030']), -0.1);
        Art.rect(ctx, x + 10, y - 44, 54, 42, C.shade(c2, -0.3));
        Art.rect(ctx, x + 11, y - 43, 52, 40, c2);
        Art.hatch(ctx, x + 13, y - 41, 48, 36, 5, C.shade(c2, -0.2), 'v');
      }
    }
  };

  MOD.crane = {
    w: 80, gap: true,
    paint: function (ctx, x, t, r) {
      var m = '#c8a830', md = '#8a6f18';
      ctx.save(); ctx.beginPath(); ctx.rect(x, 0, 80, FIELD_H); ctx.clip();
      Art.limb(ctx, x + 20, FIELD_H, x + 20, 8, 7, 5, md);
      Art.limb(ctx, x + 22, 8, x + 22, FIELD_H, 3, 2, m);
      Art.rect(ctx, x + 6, 6, 68, 5, md);
      Art.rect(ctx, x + 6, 6, 68, 2, m);
      for (var i = 0; i < 8; i++) Art.limb(ctx, x + 8 + i * 8, 6, x + 14 + i * 8, 11, 1.4, 1.4, md);
      Art.limb(ctx, x + 62, 11, x + 62, 40, 1, 1, '#9aa0b0');
      Art.rect(ctx, x + 56, 40, 13, 9, '#4a5060');
      Art.rect(ctx, x + 12, 12, 18, 14, '#3a4050');
      Art.rect(ctx, x + 14, 14, 12, 8, '#7fd8f0');
      ctx.restore();
    }
  };

  MOD.glassWall = {
    w: 64,
    paint: function (ctx, x, t, r) {
      Art.rect(ctx, x, 0, 64, FIELD_H, '#1a2038');
      for (var j = 4; j < FIELD_H - 8; j += 18) {
        for (var i = 4; i < 60; i += 15) {
          var roll = r();
          // mostly dark glass, a few offices still working
          var col = roll < 0.16 ? C.mix(t.lit, '#ffe0b0', 0.3)
            : roll < 0.34 ? C.mix(t.lit, '#101830', 0.55)
              : roll < 0.5 ? '#182042' : '#0f1526';
          Art.rect(ctx, x + i, j, 12, 14, col);
          if (roll < 0.34) Art.limb(ctx, x + i + 1, j + 12, x + i + 9, j + 2, 2, 2, 'rgba(255,255,255,0.13)');
        }
      }
      Art.hatch(ctx, x, 0, 64, FIELD_H, 18, '#39415e', 'h');
      Art.hatch(ctx, x, 0, 64, FIELD_H, 15, '#39415e', 'v');
      Art.rect(ctx, x, FIELD_H - 10, 64, 10, '#2c3350');
    }
  };

  MOD.pillar = {
    w: 34,
    paint: function (ctx, x, t, r) {
      Art.rect(ctx, x, 0, 34, FIELD_H, '#2a3048');
      Art.rect(ctx, x + 4, 0, 26, FIELD_H, '#4a5270');
      Art.rect(ctx, x + 6, 0, 6, FIELD_H, '#5f688a');
      Art.rect(ctx, x + 24, 0, 4, FIELD_H, '#333a54');
      Art.rect(ctx, x + 2, FIELD_H - 12, 30, 12, '#5f688a');
      Art.rect(ctx, x + 2, 0, 30, 10, '#5f688a');
    }
  };

  City.MOD = MOD;

  // -------------------------------------------------------------- the floor
  City.paintFloor = function (ctx, x0, w, t, r) {
    var y = PC.FLOOR_TOP - PC.FIELD_Y;  // in wall-canvas coordinates
    var h = FLOOR_H;
    var slab = t.floor || '#9aa0ac', slabD = C.shade(slab, -0.25), slabL = C.shade(slab, 0.18);
    Art.rect(ctx, x0, y, w, h, slab);
    // The pavement recedes: bands get taller toward the camera, which is the
    // only perspective cue a flat beat 'em up floor ever needs.
    var bands = [0, 4, 10, 18, 30, 44], i, j;
    for (i = 1; i < bands.length; i++) {
      Art.rect(ctx, x0, y + bands[i], w, 1, slabD);
      Art.rect(ctx, x0, y + bands[i] + 1, w, 1, slabL);
    }
    // slab joints, spaced wider as they come forward
    for (i = 0; i < bands.length - 1; i++) {
      var step = 22 + i * 6, off = (i * 9) % step;
      for (j = -step; j < w + step; j += step) {
        Art.rect(ctx, x0 + j + off, y + bands[i], 1, bands[i + 1] - bands[i], slabD);
      }
    }
    // curb + road
    Art.rect(ctx, x0, y + 48, w, 3, C.shade(slab, 0.3));
    Art.rect(ctx, x0, y + 51, w, 9, t.road || '#3a3f4c');
    Art.rect(ctx, x0, y + 51, w, 1, '#22262f');
    for (j = 0; j < w; j += 26) Art.rect(ctx, x0 + j, y + 55, 12, 2, '#c8b840');
    if (t.wet) {
      // a slick of reflected neon on the near pavement
      ctx.save(); ctx.globalAlpha = 0.09; ctx.fillStyle = t.neon || '#ff5fa8';
      for (j = 0; j < w; j += 83) ctx.fillRect(x0 + j, y + 33, 30, 14);
      ctx.restore();
    }
  };

  // ------------------------------------------------------------- composing
  /* Lay modules end to end until the stage is wide enough. `must` entries are
   * dropped in at fixed points first so a stage always has its landmark. */
  City.build = function (theme, width) {
    var c = Art.mk(width, PC.FIELD_BOT - PC.FIELD_Y);
    var x = c.getContext('2d');
    var r = PC.RNG(theme.seed || 1);
    var pos = 0, guard = 0;
    var seq = theme.modules;
    var forced = (theme.landmarks || []).slice();
    while (pos < width && guard++ < 400) {
      var name = null;
      if (forced.length && pos >= forced[0][0]) name = forced.shift()[1];
      if (!name) name = r.pick(seq);
      var m = MOD[name];
      if (!m) continue;
      if (pos + m.w > width) m = MOD[theme.filler || 'wall'];
      m.paint(x, pos, theme, r);
      pos += m.w;
    }
    City.paintFloor(x, 0, width, theme, r);
    return c;
  };

  // --------------------------------------------------------------- themes
  City.THEMES = {
    alley: {
      seed: 11,
      brick: '#7a3a2c', floor: '#6e6a66', road: '#33302e',
      sky: ['#0a0a1e', '#241634'], tower: '#181430', lit: '#e8a63a',
      neon: '#ff8a3a', neon2: '#ffd23a', signTop: 'PAWN', signBot: 'OPEN 24H',
      tag: 'SLUM', tagColor: '#e05a3a', fence: '#4a5a7a',
      modules: ['wall', 'windows', 'escape', 'pipe', 'poster', 'crates', 'door', 'alley', 'windows', 'escape'],
      landmarks: [[130, 'escape'], [420, 'alley'], [700, 'neon']]
    },
    downtown: {
      seed: 22,
      brick: '#2f8c8c', floor: '#9aa0ac', road: '#3a3f4c', wet: true,
      sky: ['#050a24', '#101a4a'], tower: '#0e1430', lit: '#f0c840',
      neon: '#ff5fa8', neon2: '#ffd23a', signTop: 'BAR', signBot: 'STARLIGHT', signStar: true,
      tag: 'POWER CITY', tagColor: '#c840e0', fence: '#3a5fd8',
      modules: ['wall', 'windows', 'door', 'fence', 'shutter', 'neon', 'pipe', 'poster', 'windows'],
      landmarks: [[60, 'neon'], [180, 'fence'], [330, 'shutter'], [620, 'fence'], [900, 'neon']]
    },
    docks: {
      seed: 33,
      brick: '#4a5566', floor: '#7a6a52', road: '#2a3a48',
      sky: ['#040a18', '#0e2a3c'], tower: '#0a1424', lit: '#7fd8f0', moon: [120, 26], water: '#123044',
      neon: '#3ad8c8', neon2: '#f0f0a0', signTop: 'DOCK', signBot: 'NO ENTRY',
      tag: 'JAWS', tagColor: '#f0a030', fence: '#5f7a8a',
      modules: ['container', 'crates', 'wall', 'container', 'crane', 'fence', 'container', 'pipe'],
      landmarks: [[150, 'crane'], [430, 'container'], [760, 'crane']]
    },
    tower: {
      seed: 44,
      brick: '#3a3f5c', floor: '#5a5f7a', road: '#2a2e42',
      sky: ['#08081a', '#2a1040'], tower: '#12162e', lit: '#ff5f8a',
      neon: '#ff2a5a', neon2: '#ffffff', signTop: 'POWER', signBot: 'TOWER',
      tag: 'MR POWER', tagColor: '#ff2a5a', fence: '#8a5fd8',
      modules: ['glassWall', 'pillar', 'glassWall', 'neon', 'pillar', 'glassWall'],
      landmarks: [[100, 'neon'], [500, 'neon']]
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
