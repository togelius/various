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
    // ---- towers, standing on the horizon (from the top floor, only the
    // far ones still reach above eye level, and not by much)
    var beacons = [];
    var bx = 0, tall = theme.below ? [0.06, 0.34] : [0.3, 0.92];
    while (bx < w) {
      var bw = r.int(12, 26), bh = r.int(Math.floor(hor * tall[0]), Math.floor(hor * tall[1]));
      var col = C.mix(theme.tower, bot, r.range(0, 0.3));
      Art.rect(x, bx, hor - bh, bw, bh, col);
      if (r.chance(0.3)) Art.rect(x, bx + Math.floor(bw / 2) - 1, hor - bh - r.int(4, 10), 2, 10, col);
      if (r.chance(0.22)) {
        var ty = hor - bh - r.int(6, 12);
        Art.rect(x, bx + Math.floor(bw / 2) - 1, ty, 2, 2, '#ff4a4a');
        beacons.push([bx + Math.floor(bw / 2), ty]);
      }
      for (j = hor - bh + 3; j < hor - 2; j += 5) {
        for (i = bx + 2; i < bx + bw - 3; i += 4) {
          if (r.chance(0.4)) Art.rect(x, i, j, 2, 3, r.chance(0.18) ? '#f8e070' : theme.lit);
        }
      }
      bx += bw + r.int(0, 3);
    }
    // ---- whatever lies below the horizon, for gaps that reach the ground
    if (theme.below) {
      cityBelow(x, theme, r, w, h, hor);
    } else if (theme.water) {
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
    c.beacons = beacons;
    return c;
  };

  /* The city at night seen from the top floor: blocks of roofs in rows
   * that grow taller and further apart as they come toward the glass, the
   * streets between them strung with sodium lamps and traffic. Rows only -
   * the sky tiles sideways and scrolls at parallax, so nothing here may
   * converge on a vanishing point. */
  function cityBelow(x, t, r, w, h, hor) {
    var glow = C.mix(t.sky[1], t.lit, 0.32), deep = C.shade(t.sky[0], -0.3);
    var j, i, k;
    for (j = hor; j < h; j++) Art.rect(x, 0, j, w, 1, C.mix(glow, deep, Math.min(1, (j - hor) / ((h - hor) * 0.55))));
    var y = hor + 1, gap = 2, row = 0;
    while (y < h) {
      var bandH = Math.round(2 + row * 1.6);
      var roof = C.mix(C.shade(t.tower, 0.08), deep, Math.min(1, row / 9));
      // the street: a line of lamps, and the odd car's head- and tail-lights
      var lamp = row < 3 ? C.mix(t.lit, glow, 0.35) : t.lit;
      for (i = r.int(0, 3); i < w; i += Math.max(3, 9 - row)) Art.rect(x, i, y, 1, 1, lamp);
      for (k = 0; k < w / (40 - row * 2); k++) {
        var cx = r.int(0, w - 3);
        Art.rect(x, cx, y + (gap > 2 ? 1 : 0), row > 3 ? 2 : 1, 1, r.chance(0.5) ? '#fff4d0' : '#ff3a3a');
      }
      y += gap;
      // the blocks: roofs with their street-facing windows lit below
      for (i = r.int(-12, 0); i < w; ) {
        var bw2 = r.int(8 + row * 2, 18 + row * 4), bh2 = Math.min(h - y, bandH + r.int(0, row));
        Art.rect(x, i, y, bw2 - 1, bh2, roof);
        Art.rect(x, i, y, bw2 - 1, 1, C.shade(roof, 0.25));                 // the parapet catches the glow
        for (j = y + 2; j < y + bh2 - 1; j += row > 4 ? 3 : 2) {
          for (k = i + 1; k < i + bw2 - 2; k += row > 4 ? 3 : 2) {
            if (r.chance(0.22)) Art.rect(x, k, j, 1, 1, r.chance(0.2) ? '#f8e8b0' : C.mix(t.lit, roof, 0.3));
          }
        }
        if (row > 3 && r.chance(0.15)) Art.rect(x, i + 2, y + 1, 1, 1, '#ff4a4a');  // a roof beacon below us
        i += bw2 + (row > 5 ? 1 : 0);
      }
      y += bh2Max(bandH, row);
      gap = Math.min(5, 2 + (row >> 1));
      row++;
    }
  }
  function bh2Max(bandH, row) { return bandH + Math.round(row * 0.7); }

  // -------------------------------------------------------- facade modules
  /* Every module paints into the wall strip (0..FIELD_H) starting at x, and
   * returns nothing; the composer knows each module's width up front. */
  var MOD = {};

  /* Brick, laid on one grid for the whole street. Each module used to
   * restart the coursing at its own left edge and paint past its right,
   * so the bond broke wherever two modules met. Now every brick sits on
   * the global grid, clipped to its module, with near-black mortar and a
   * lit top and shaded bottom on every brick - the reference wall reads as
   * texture because the mortar is dark, and so does this one. */
  function brick(x, ctx, w, t, r) {
    var base = t.brick;
    var mortar = C.shade(base, -0.62);
    var tones = [base, C.shade(base, 0.07), C.shade(base, -0.07), C.mix(base, t.brickAlt || base, 0.5)];
    var bw = 12, bh = 6;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, 0, w, FIELD_H); ctx.clip();
    Art.rect(ctx, x, 0, w, FIELD_H, mortar);
    for (var j = 0, row = 0; j < FIELD_H; j += bh, row++) {
      var off = (row % 2) ? bw / 2 : 0;
      var first = Math.floor((x - off) / bw) * bw + off;
      for (var px = first; px < x + w; px += bw) {
        // a brick's tone comes from where it is, not from the module's dice,
        // so the same wall looks the same however it was assembled
        var hsh = ((px * 73856093) ^ (row * 19349663) ^ (t.seed || 1)) >>> 0;
        var face = tones[hsh % 4];
        if (hsh % 23 === 0) face = C.shade(base, -0.2);                 // a stained one
        Art.rect(ctx, px + 1, j + 1, bw - 1, bh - 1, face);
        Art.rect(ctx, px + 1, j + 1, bw - 1, 1, C.shade(face, 0.2));    // lit top edge
        Art.rect(ctx, px + 1, j + bh - 1, bw - 1, 1, C.shade(face, -0.2)); // shaded underside
      }
    }
    // a wash of grime toward the ground, in dither so it stays crisp
    var grime = C.shade(base, -0.45);
    // (every other row higher up is a quarter-density fade, then half)
    for (var k = 0; k < 18; k++) {
      if (k < 9 && k % 2) continue;
      Art.dither(ctx, x, FIELD_H - 26 + k, w, 1, grime, k >> 1);
    }
    ctx.restore();
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
        Art.graffiti(ctx, tw[i], sx + sw / 2 + (i % 2 ? 4 : -3), sy + 12 + i * 20, gc,
          { phase: i * 1.7, seed: Math.round(x) + i });
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

  MOD.metalWall = {
    w: 56,
    paint: function (ctx, x, t, r) {
      var base = t.metal || '#5a6472', dark = C.shade(base, -0.3), light = C.shade(base, 0.16);
      Art.rect(ctx, x, 0, 56, FIELD_H, base);
      for (var i = 0; i < 56; i += 4) {
        Art.rect(ctx, x + i, 0, 1, FIELD_H, dark);
        Art.rect(ctx, x + i + 2, 0, 1, FIELD_H, light);
      }
      Art.rect(ctx, x, 0, 56, 4, C.shade(base, 0.3));
      Art.rect(ctx, x, 26, 56, 3, dark);
      Art.rect(ctx, x, FIELD_H - 16, 56, 3, dark);
      // rust creeping up from the ground
      for (var k = 0; k < 22; k++) Art.dither(ctx, x, FIELD_H - 20 + k, 56, 1, t.rust || '#6a4630', k % 2);
      if (r.chance(0.45)) {
        var wx = x + 10, wy = 34;
        Art.rect(ctx, wx - 2, wy - 2, 34, 24, dark);
        Art.rect(ctx, wx, wy, 30, 20, '#12202c');
        Art.hatch(ctx, wx, wy, 30, 20, 10, C.shade(base, -0.1), 'v');
        Art.limb(ctx, wx + 2, wy + 17, wx + 20, wy + 3, 2, 2, 'rgba(200,230,255,0.12)');
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

  // ---- the penthouse: black marble, gold trim, and the city through glass
  var GOLD = '#d8a840', GOLD_HI = '#f8dc80', GOLD_LO = '#7a5418';
  var STEEL = '#0c0a12';

  /* Black marble, veined. The veins are seeded from the module's x so a
   * panel always looks the same. */
  function marble(ctx, x, y, w, h, t) {
    var base = t.marble || '#1e1a28';
    Art.rect(ctx, x, y, w, h, base);
    var r = PC.RNG(Math.round(x) * 131 + y + 7);
    var vein = C.shade(base, 0.32), vein2 = C.shade(base, 0.14);
    for (var v = 0; v < Math.max(1, w / 18); v++) {
      var vx = x + r.range(0, w), vy = y + r.range(0, h * 0.3);
      var dx = r.range(-0.7, 0.7);
      for (var k = 0; k < h * 0.9; k++) {
        vx += dx + r.range(-0.6, 0.6);
        if (vx < x || vx >= x + w) break;
        Art.rect(ctx, Math.floor(vx), Math.floor(vy + k), 1, 1, k % 7 < 5 ? vein2 : vein);
        if (r.chance(0.04)) dx = r.range(-0.8, 0.8);
      }
    }
  }
  // a gold band: lit top, body, shadow under
  function trim(ctx, x, y, w) {
    Art.rect(ctx, x, y, w, 1, GOLD_HI);
    Art.rect(ctx, x, y + 1, w, 1, GOLD);
    Art.rect(ctx, x, y + 2, w, 1, GOLD_LO);
  }
  // the ceiling and skirting every penthouse module shares, so they line up
  function frameTopBottom(ctx, x, w, t) {
    marble(ctx, x, 0, w, 11, t);
    trim(ctx, x, 11, w);
    marble(ctx, x, FIELD_H - 9, w, 9, t);
    trim(ctx, x, FIELD_H - 10, w);
  }

  /* Floor-to-ceiling glass. The panes are left empty, so the skyline (and
   * the city far below it) shows straight through at parallax. */
  MOD.pane = {
    w: 64,
    paint: function (ctx, x, t, r) {
      var top = 14, bot = FIELD_H - 10;
      frameTopBottom(ctx, x, 64, t);
      // steel mullions with a gold bead down the lit edge
      Art.rect(ctx, x, top, 3, bot - top, STEEL);
      Art.rect(ctx, x + 2, top, 1, bot - top, GOLD_LO);
      Art.rect(ctx, x + 31, top, 2, bot - top, STEEL);
      Art.rect(ctx, x + 61, top, 3, bot - top, STEEL);
      Art.rect(ctx, x + 61, top, 1, bot - top, GOLD_LO);
      // the brass guard rail at hip height
      Art.rect(ctx, x, bot - 26, 64, 2, GOLD);
      Art.rect(ctx, x, bot - 26, 64, 1, GOLD_HI);
      Art.rect(ctx, x, bot - 24, 64, 1, GOLD_LO);
      for (var p = x + 10; p < x + 60; p += 21) Art.rect(ctx, p, bot - 24, 1, 24, GOLD_LO);
      // reflections on the glass: two hard diagonal glints, sparse
      ctx.save();
      ctx.globalAlpha = 0.16;
      for (var g = 0; g < 2; g++) {
        var gx = x + 6 + g * 31 + ((Math.round(x) >> 3) % 9);
        for (var k = 0; k < 22; k++) {
          Art.rect(ctx, gx + k, top + 30 - k, g ? 1 : 2, 1, '#e0e8ff');
          if (k % 3 === 0) Art.rect(ctx, gx + k + 5, top + 33 - k, 1, 1, '#e0e8ff');
        }
      }
      ctx.restore();
    }
  };

  /* A black marble column, gold at the capital and the foot. */
  MOD.column = {
    w: 24,
    paint: function (ctx, x, t, r) {
      frameTopBottom(ctx, x, 24, t);
      marble(ctx, x + 3, 14, 18, FIELD_H - 24, t);
      Art.rect(ctx, x + 6, 14, 2, FIELD_H - 24, C.shade(t.marble || '#1e1a28', 0.28));   // the lit flute
      Art.rect(ctx, x + 18, 14, 3, FIELD_H - 24, C.shade(t.marble || '#1e1a28', -0.4));  // the turned side
      Art.rect(ctx, x, 14, 24, 4, GOLD); Art.rect(ctx, x, 14, 24, 1, GOLD_HI); Art.rect(ctx, x + 1, 18, 22, 1, GOLD_LO);
      Art.rect(ctx, x, FIELD_H - 16, 24, 6, GOLD); Art.rect(ctx, x, FIELD_H - 16, 24, 1, GOLD_HI);
      Art.rect(ctx, x + 2, FIELD_H - 13, 20, 1, GOLD_LO);
    }
  };

  /* Bare marble, with a sconce throwing its light up the wall. */
  MOD.marble = {
    w: 44,
    paint: function (ctx, x, t, r) {
      marble(ctx, x, 0, 44, FIELD_H, t);
      frameTopBottom(ctx, x, 44, t);
      // inset panel
      Art.rect(ctx, x + 5, 22, 34, 1, GOLD_LO); Art.rect(ctx, x + 5, FIELD_H - 20, 34, 1, GOLD_LO);
      Art.rect(ctx, x + 5, 22, 1, FIELD_H - 41, GOLD_LO); Art.rect(ctx, x + 38, 22, 1, FIELD_H - 41, GOLD_LO);
      // the sconce and its fan of light, in dither so it stays hard
      var sx = x + 22, sy = 58;
      for (var k = 0; k < 14; k++) {
        var half = 2 + Math.floor(k * 0.7);
        Art.dither(ctx, sx - half, sy - 2 - k, half * 2, 1, k < 6 ? '#8a6a48' : '#4a3c3c', k);
      }
      Art.rect(ctx, sx - 4, sy - 2, 8, 2, GOLD_HI);
      Art.rect(ctx, sx - 3, sy, 6, 3, GOLD);
      Art.rect(ctx, sx - 1, sy + 3, 2, 3, GOLD_LO);
    }
  };

  /* The lift you came up in: brass doors, the floor dial stopped at 88. */
  MOD.elevator = {
    w: 56,
    paint: function (ctx, x, t, r) {
      marble(ctx, x, 0, 56, FIELD_H, t);
      frameTopBottom(ctx, x, 56, t);
      var dx = x + 8, dy = 36, dw = 40, dh = FIELD_H - 10 - dy;
      Art.rect(ctx, dx - 3, dy - 3, dw + 6, dh + 3, GOLD_LO);
      Art.rect(ctx, dx - 2, dy - 2, dw + 4, dh + 2, GOLD);
      Art.rect(ctx, dx, dy, dw, dh, '#a07a38');
      for (var i = 0; i < dw; i += 4) Art.rect(ctx, dx + i, dy, 1, dh, '#8a6630');  // brushed brass
      Art.rect(ctx, dx + 2, dy, 3, dh, '#c89a50');
      Art.rect(ctx, dx + dw / 2 + 2, dy, 3, dh, '#c89a50');
      Art.rect(ctx, dx + dw / 2 - 1, dy, 2, dh, '#3a2810');                          // the seam
      // the dial above
      Art.ellipse(ctx, x + 28, 25, 9, 6, GOLD);
      Art.ellipse(ctx, x + 28, 25, 7, 4.5, '#140c08');
      Art.text(ctx, '88', x + 28, 22, '#ff5a3a', { align: 'center', scale: 1, tracking: 1 });
      Art.rect(ctx, x + 47, 70, 4, 9, GOLD_LO); Art.rect(ctx, x + 48, 72, 2, 2, '#ff5a3a');  // call button
    }
  };

  /* Mr Power, in oils, lit from below. Bald, sure of himself, red tie. */
  MOD.portrait = {
    w: 72,
    paint: function (ctx, x, t, r) {
      marble(ctx, x, 0, 72, FIELD_H, t);
      frameTopBottom(ctx, x, 72, t);
      var px = x + 14, py = 22, pw = 44, ph = 56;
      Art.rect(ctx, px - 4, py - 4, pw + 8, ph + 8, GOLD_LO);
      Art.rect(ctx, px - 3, py - 3, pw + 6, ph + 6, GOLD);
      Art.rect(ctx, px - 3, py - 3, pw + 6, 1, GOLD_HI);
      Art.rect(ctx, px - 1, py - 1, pw + 2, ph + 2, GOLD_LO);
      Art.rect(ctx, px, py, pw, ph, '#3a0c18');
      for (var j = 0; j < ph; j += 2) Art.dither(ctx, px, py + j, pw, 1, '#4a1420', j);   // the canvas weave
      var cx = px + pw / 2;
      ctx.save();
      ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
      // shoulders and suit
      Art.ellipse(ctx, cx, py + ph + 4, 21, 18, '#14141c');
      Art.limb(ctx, cx - 5, py + 38, cx, py + 50, 3, 1, '#e8e4dc');
      Art.limb(ctx, cx + 5, py + 38, cx, py + 50, 3, 1, '#e8e4dc');
      Art.limb(ctx, cx, py + 40, cx, py + ph - 1, 2, 3, '#c8203a');                    // the tie
      // the head: bald, heavy-browed, the light from below
      Art.ellipse(ctx, cx, py + 25, 10, 12, '#b07850');
      Art.ellipse(ctx, cx - 2, py + 20, 6, 6, '#d09468');
      Art.rect(ctx, cx - 7, py + 23, 5, 2, '#2a1410'); Art.rect(ctx, cx + 2, py + 23, 5, 2, '#2a1410');
      Art.rect(ctx, cx - 5, py + 26, 2, 1, '#f0e0c0'); Art.rect(ctx, cx + 3, py + 26, 2, 1, '#f0e0c0');
      Art.rect(ctx, cx - 4, py + 32, 8, 1, '#5a2418');
      Art.rect(ctx, cx - 10, py + 25, 2, 4, '#8a5838'); Art.rect(ctx, cx + 8, py + 25, 2, 4, '#8a5838');
      ctx.restore();
      // a brass plate
      Art.rect(ctx, cx - 12, py + ph + 8, 24, 6, GOLD);
      Art.rect(ctx, cx - 11, py + ph + 10, 22, 1, GOLD_LO);
      // picture lights
      Art.rect(ctx, px + 4, py - 9, pw - 8, 3, GOLD);
      Art.rect(ctx, px + 4, py - 9, pw - 8, 1, GOLD_HI);
    }
  };

  /* The name on the building, inside it too. Gold letters, a red bar. */
  MOD.logo = {
    w: 104,
    paint: function (ctx, x, t, r) {
      marble(ctx, x, 0, 104, FIELD_H, t);
      frameTopBottom(ctx, x, 104, t);
      var cx = x + 52;
      Art.rect(ctx, x + 8, 26, 88, 40, STEEL);
      Art.rect(ctx, x + 8, 26, 88, 1, GOLD_LO); Art.rect(ctx, x + 8, 65, 88, 1, GOLD_LO);
      Art.text(ctx, 'POWER', cx + 1, 33, GOLD_LO, { align: 'center', scale: 2, tracking: 2 });
      Art.text(ctx, 'POWER', cx, 32, GOLD, { align: 'center', scale: 2, tracking: 2 });
      Art.rect(ctx, x + 14, 50, 76, 3, t.neon || '#c8203a');
      Art.text(ctx, 'INDUSTRIES', cx, 56, '#c8c0b0', { align: 'center', scale: 1, tracking: 1 });
      // twin uplights at the foot of the wall
      for (var s = 0; s < 2; s++) {
        var lx = x + 20 + s * 64;
        for (var k = 0; k < 18; k++) {
          var half = 1 + Math.floor(k * 0.45);
          Art.dither(ctx, lx - half, FIELD_H - 14 - k, half * 2, 1, k < 8 ? '#6a5040' : '#3a2e34', k);
        }
        Art.rect(ctx, lx - 3, FIELD_H - 14, 6, 3, GOLD);
      }
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
    if (t.planks) {
      // a wharf is boards, not paving: seams run away from the camera
      Art.rect(ctx, x0, y, w, 48, slab);
      for (i = 0; i < w; i += 13) {
        Art.rect(ctx, x0 + i, y, 1, 48, slabD);
        Art.rect(ctx, x0 + i + 1, y, 1, 48, C.shade(slab, 0.1));
      }
      for (i = 1; i < bands.length; i++) {
        Art.rect(ctx, x0, y + bands[i], w, 1, C.shade(slab, -0.12));
        for (j = ((i * 17) % 40); j < w; j += 40) Art.rect(ctx, x0 + j, y + bands[i] - 1, 2, 2, slabD);
      }
    }

    if (t.polish) {
      /* Polished black marble in big square-ish slabs, the joints in gold
       * leaf. The reflections of the room are laid on after, in build(). */
      Art.rect(ctx, x0, y, w, 48, slab);
      for (i = 0; i < bands.length; i++) {
        var by = y + bands[i], bh = (i + 1 < bands.length ? bands[i + 1] : 48) - bands[i];
        var step2 = 26 + i * 8;
        for (j = -((i * 13) % step2); j < w; j += step2) {
          // every other slab a shade lighter: a checkerboard, receding
          if (((j + i * 13) / step2 | 0) % 2 === i % 2) Art.rect(ctx, x0 + j, by, step2, bh, C.shade(slab, 0.1));
          Art.rect(ctx, x0 + j, by, 1, bh, C.shade(GOLD_LO, -0.25));
        }
        if (i) Art.rect(ctx, x0, by, w, 1, C.shade(GOLD_LO, -0.15));
      }
      // the edge of the floor: a gold nosing, then the dark beyond it
      trim(ctx, x0, y + 48, w);
      Art.rect(ctx, x0, y + 51, w, 9, STEEL);
      for (j = 6; j < w; j += 24) Art.rect(ctx, x0 + j, y + 55, 2, 1, GOLD_LO);
      return;
    }
    // curb + road
    Art.rect(ctx, x0, y + 48, w, 3, C.shade(slab, 0.3));
    Art.rect(ctx, x0, y + 51, w, 9, t.road || '#3a3f4c');
    Art.rect(ctx, x0, y + 51, w, 1, '#22262f');
    for (j = 0; j < w; j += 26) Art.rect(ctx, x0 + j, y + 55, 12, 2, '#c8b840');
    if (t.wet) {
      /* Puddles, in pixels: a dark pool on the near slabs with the neon
       * broken across it in a few hard dashes. (Translucent pink boxes
       * used to stand in for this, and read as stains.) */
      var pr = PC.RNG((t.seed || 1) * 97);
      for (j = pr.int(20, 60); j < w; j += pr.int(120, 220)) {
        var pw = pr.int(16, 30), py = y + pr.int(30, 40);
        Art.ellipse(ctx, x0 + j, py, pw / 2, 2.4, C.shade(slab, -0.32));
        Art.rect(ctx, x0 + j - pw / 2 + 4, py - 1, pw - 8, 1, C.shade(slab, -0.45));
        Art.rect(ctx, x0 + j - 4, py, 3, 1, t.neon || '#ff5fa8');
        Art.rect(ctx, x0 + j + 2, py + 1, 4, 1, C.mix(t.neon || '#ff5fa8', slab, 0.5));
      }
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
    var marks = [];                  // where each module actually landed
    while (pos < width && guard++ < 400) {
      var name = null;
      if (forced.length && pos >= forced[0][0]) name = forced.shift()[1];
      if (!name) name = r.pick(seq);
      var m = MOD[name];
      if (!m) continue;
      if (pos + m.w > width) { m = MOD[theme.filler || 'wall']; name = theme.filler || 'wall'; }
      m.paint(x, pos, theme, r);
      marks.push([pos, name]);
      pos += m.w;
    }
    City.paintFloor(x, 0, width, theme, r);
    if (theme.polish) reflect(c, x, width);
    c.marks = marks;
    return c;
  };

  /* The room, mirrored in the floor: the foot of the wall flipped under
   * itself, dimmed, and broken into the scanlines a polished floor shows. */
  function reflect(c, ctx, width) {
    var fy = FIELD_H, depth = 40;
    var tmp = Art.mk(width, depth), tx = tmp.getContext('2d');
    tx.save(); tx.scale(1, -1);
    tx.drawImage(c, 0, fy - depth, width, depth, 0, -depth, width, depth);
    tx.restore();
    // fade with distance from the wall, a row at a time
    tx.globalCompositeOperation = 'destination-out';
    for (var j = 0; j < depth; j++) {
      tx.globalAlpha = Math.min(1, 0.45 + j / depth * 0.75);
      if (j % 3 === 2) tx.globalAlpha = Math.min(1, tx.globalAlpha + 0.25);
      tx.fillRect(0, j, width, 1);
    }
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.drawImage(tmp, 0, fy);
    ctx.restore();
  }

  // --------------------------------------------------------------- themes
  City.THEMES = {
    alley: {
      seed: 11,
      brick: '#7a3a2c', floor: '#6e6a66', road: '#33302e',
      sky: ['#0a0a1e', '#241634'], tower: '#181430', lit: '#e8a63a',
      neon: '#ff8a3a', neon2: '#ffd23a', signTop: 'PAWN', signBot: 'OPEN 24H',
      tag: 'SLUM', tagColor: '#e05a3a', fence: '#4a5a7a',
      modules: ['wall', 'windows', 'escape', 'pipe', 'poster', 'crates', 'door', 'alley', 'windows', 'escape'],
      landmarks: [[130, 'escape'], [420, 'alley'], [700, 'neon']],
      ambient: { kind: 'mote', rate: 0.5 }
    },
    downtown: {
      seed: 22,
      brick: '#2f8c8c', floor: '#9aa0ac', road: '#3a3f4c', wet: true,
      sky: ['#050a24', '#101a4a'], tower: '#0e1430', lit: '#f0c840',
      neon: '#ff5fa8', neon2: '#ffd23a', signTop: 'BAR', signBot: 'STARLIGHT', signStar: true,
      tag: 'POWER CITY', tagColor: '#e83cc0', fence: '#3a5fd8',
      modules: ['wall', 'windows', 'door', 'fence', 'shutter', 'neon', 'pipe', 'poster', 'windows'],
      landmarks: [[60, 'neon'], [180, 'fence'], [330, 'shutter'], [620, 'fence'], [900, 'neon']],
      ambient: { kind: 'rain', rate: 0.9 }
    },
    docks: {
      seed: 33,
      brick: '#4a5566', floor: '#7a6a52', road: '#2a3a48',
      sky: ['#040a18', '#0e2a3c'], tower: '#0a1424', lit: '#7fd8f0', moon: [120, 26], water: '#123044',
      neon: '#3ad8c8', neon2: '#f0f0a0', signTop: 'DOCK', signBot: 'NO ENTRY',
      tag: 'JAWS', tagColor: '#f0a030', fence: '#5f7a8a',
      metal: '#5a6472', rust: '#6a4630', planks: true,
      modules: ['container', 'crates', 'metalWall', 'container', 'crane', 'fence', 'metalWall', 'container'],
      landmarks: [[150, 'crane'], [430, 'container'], [760, 'crane']],
      ambient: { kind: 'rain', rate: 3.2 }
    },
    tower: {
      seed: 44,
      brick: '#3a3f5c', floor: '#16141e', marble: '#1e1a28', polish: true,
      sky: ['#06061a', '#3a1440'], tower: '#14102a', lit: '#f0a040', below: true,
      neon: '#c8203a', neon2: '#ffffff',
      tag: 'MR POWER', tagColor: '#ff2a5a', fence: '#8a5fd8',
      modules: ['pane', 'column', 'pane', 'pane', 'column', 'marble', 'column', 'pane', 'pane'],
      landmarks: [[16, 'elevator'], [600, 'portrait'], [1180, 'portrait'], [1640, 'logo']],
      filler: 'column', front: 'penthouse',
      ambient: { kind: 'mote', rate: 0.35 }
    }
  };

  // ------------------------------------------------------ the living parts
  /* Night clouds drift through the gaps in the skyline, slower than the
   * camera, so the sky reads as weather and not wallpaper. */
  City.makeClouds = function (theme, n) {
    var r = PC.RNG((theme.seed || 1) * 7 + 3);
    var out = [];
    for (var i = 0; i < (n || 7); i++) {
      out.push({
        x: r.range(0, 1600), y: r.range(3, 42), w: r.range(26, 64),
        h: r.range(4, 9), sp: r.range(0.05, 0.14), a: r.range(0.45, 0.8)
      });
    }
    return out;
  };

  /* Drawn in pixels, not alpha: a solid core and a dithered fringe, so a
   * cloud has an edge you could count and the towers still show through
   * where it thins. */
  function cloudBlob(ctx, cx, cy, rx, ry, core, edge) {
    for (var j = -Math.ceil(ry); j <= Math.ceil(ry); j++) {
      var f = 1 - (j * j) / (ry * ry);
      if (f <= 0) continue;
      var half = Math.round(rx * Math.sqrt(f)), inner = Math.round(half * 0.72);
      Art.dither(ctx, cx - half, cy + j, half * 2, 1, edge, (cx + j) & 1);
      if (Math.abs(j) < ry * 0.62) Art.rect(ctx, cx - inner, cy + j, inner * 2, 1, core);
    }
  }

  City.drawClouds = function (ctx, theme, clouds, camX, time, w, top) {
    var base = C.mix(theme.sky[1], '#a8b0d8', 0.2);
    var core = C.mix(theme.sky[0], base, 0.75), under = C.shade(core, -0.25);
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      var cx = (c.x + time * c.sp - camX * 0.42) % 1600;
      if (cx < 0) cx += 1600;
      cx = Math.round(cx - 90);
      if (cx > w + 90) continue;
      var cy = Math.round(top + c.y);
      cloudBlob(ctx, cx, cy, c.w / 2, c.h, core, base);
      cloudBlob(ctx, cx + Math.round(c.w * 0.32), cy + 1, c.w / 3, c.h * 0.8, core, base);
      Art.rect(ctx, cx - Math.round(c.w * 0.3), cy + Math.round(c.h * 0.6), Math.round(c.w * 0.75), 1, under);
    }
  };

  /* The near lane, in silhouette: lamp posts, hydrants and signs passing
   * faster than the camera - the one depth cue a flat street cannot fake.
   * Sparse and thin on purpose: a post should flirt with the fighters, not
   * hide them. */
  City.buildFront = function (theme) {
    var c = Art.mk(640, 30), x = c.getContext('2d');
    var r = PC.RNG((theme.seed || 1) * 31 + 5);
    var ink = '#07070e';
    var px = r.range(30, 140);
    if (theme.front === 'penthouse') {
      // the top floor's near lane: velvet ropes on brass posts, and palms
      while (px < 600) {
        if (r.chance(0.6)) {
          for (var q = 0; q < 2; q++) {
            var qx = px + q * 34;
            Art.rect(x, qx, 8, 3, 18, ink);
            Art.rect(x, qx - 1, 6, 5, 3, ink);
            Art.rect(x, qx, 6, 2, 1, '#8a6a30');       // the brass catches light
            Art.rect(x, qx - 3, 25, 9, 2, ink);
          }
          for (var k = 0; k <= 30; k++) {
            var sag = Math.round(Math.sin(k / 30 * Math.PI) * 5);
            Art.rect(x, px + 3 + k, 9 + sag, 1, 2, '#3a0814');
          }
        } else {
          // an urn on a plinth
          Art.rect(x, px - 5, 16, 11, 11, ink);
          Art.rect(x, px - 6, 15, 13, 2, ink);
          Art.ellipse(x, px + 0.5, 9, 5.5, 5, ink);
          Art.rect(x, px - 2, 1, 6, 4, ink);
          Art.rect(x, px - 4, 0, 10, 2, ink);
          Art.rect(x, px - 1, 13, 4, 2, ink);
          Art.rect(x, px + 3, 6, 1, 4, '#8a6a30');       // the gilt catches light
        }
        px += r.range(170, 300);
      }
      Art.rect(x, 0, 26, 640, 4, ink);
      return c;
    }
    while (px < 600) {
      var kind = r();
      if (kind < 0.45) {
        Art.rect(x, px, 4, 26, ink);            // lamp post
        Art.rect(x, px + 2, 18, 3, ink);         // arm
        Art.rect(x, px + 14, 7, 5, ink);         // head
        Art.rect(x, px + 17, 2, 2, '#ffd070');   // the light itself
      } else if (kind < 0.78) {
        Art.rect(x, px, 20, 4, ink);            // hydrant: base
        Art.rect(x, px + 3, 4, 18, ink);         // body
        Art.rect(x, px - 1, 8, 4, ink);          // side nut
        Art.ellipse(x, px + 8, 3, 7, 3, ink);    // cap
      } else {
        Art.rect(x, px + 1, 3, 26, ink);         // street sign
        Art.rect(x, px - 5, 15, 13, ink);
      }
      px += r.range(170, 330);
    }
    Art.rect(x, 0, 26, 640, 4, ink);             // the curb edge
    return c;
  };

  /* (There was a mood coat here: a 5% tint over the street and a soft
   * gradient vignette over everything. Pixel art gets its mood from the
   * palette it is painted in, and smooth gradients over hard pixels are
   * what made the picture read as soft - a fifth of all neighbouring pixel
   * pairs were near-duplicates. The palettes below carry the mood now.) */

})(typeof window !== 'undefined' ? window : globalThis);
