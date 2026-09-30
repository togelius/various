/* POWER CITY - the cabinet furniture.
 *
 * Score, hi-score, timer, lives, health and the credit counter, laid out the
 * way an arcade board would have laid them out: everything the player needs
 * is above and below the picture, never in it.
 */
(function (global) {
  'use strict';
  var PC = global.PC || (global.PC = {});
  var Art = PC.art, C = PC.color, W = PC.world, M = PC.math;

  var Hud = PC.hud = {};

  // A little head, for the lives row. Same palette as the fighter it counts.
  var iconCache = {};
  Hud.icon = function (charKey) {
    if (iconCache[charKey]) return iconCache[charKey];
    var ch = PC.rig.CHARS[charKey], pal = ch.pal;
    var c = Art.mk(11, 11), x = c.getContext('2d');
    Art.ellipse(x, 5, 6, 5, 5.2, pal.hair);
    Art.ellipse(x, 5.5, 7, 4.2, 4.4, pal.skin);
    Art.rect(x, 0, 1, 11, 3, pal.hair);
    Art.rect(x, 3, 5, 1.6, 2, pal.eye || '#20202e');
    Art.rect(x, 7, 5, 1.6, 2, pal.eye || '#20202e');
    Art.rect(x, 4, 9, 3, 1, pal.skinD);
    return (iconCache[charKey] = Art.outline(c, '#0a0a12', 1));
  };

  // ------------------------------------------------------------- health bar
  /* Twelve blocks in a box. Blocks, not a smooth bar: you can count them at a
   * glance mid-fight, which is the only time anybody looks. */
  Hud.bar = function (ctx, x, y, w, h, frac, col, colDim) {
    var segs = 12, i;
    Art.rect(ctx, x - 1, y - 1, w + 2, h + 2, '#101018');
    Art.rect(ctx, x, y, w, h, '#2a2e3c');
    var sw = Math.floor((w - 2) / segs);
    var lit = frac * segs;
    for (i = 0; i < segs; i++) {
      var f = Math.min(1, Math.max(0, lit - i));
      if (f <= 0) { Art.rect(ctx, x + 1 + i * sw, y + 1, sw - 1, h - 2, colDim || '#3a3f52'); continue; }
      Art.rect(ctx, x + 1 + i * sw, y + 1, sw - 1, h - 2, col);
      Art.rect(ctx, x + 1 + i * sw, y + 1, sw - 1, 1, C.shade(col, 0.35));
    }
    Art.rect(ctx, x - 1, y - 1, w + 2, 1, '#585f78');
  };

  // ------------------------------------------------------------- warnings
  /* The three things the cabinet owes the player's eyes: who is coming in
   * from a side they cannot see, who just materialised, and that the clock
   * has turned hostile. */
  Hud.drawAlerts = function (ctx, g) {
    var camX = W.camX;

    // off-screen gang, marked with a chevron at the edge they will enter by
    var es = W.enemies();
    for (var i = 0; i < es.length; i++) {
      var e = es[i];
      if (e.x >= camX - 2 && e.x <= camX + PC.W + 2) {
        // on screen: flag the freshly arrived until their grace is up
        if (e.spawnGuard > 0 && (W.time >> 2) % 2) {
          PC.art.text(ctx, '!', Math.round(e.x - camX), e.y - e.z - e.hh - 14,
            '#ffe070', { align: 'center', scale: 2, shadow: '#802000', shadowDist: 1 });
        }
        continue;
      }
      var dist = e.x < camX ? camX - e.x : e.x - (camX + PC.W);
      if (dist > 130) continue;
      var sy = M.clamp(e.y - e.z - 24, PC.FIELD_Y + 8, PC.FIELD_BOT - 8);
      if ((W.time >> 3) % 2) continue;
      if (e.x < camX) {
        ctx.fillStyle = '#ff5f6a';
        ctx.fillRect(2, Math.round(sy), 6, 2);
        ctx.fillRect(6, Math.round(sy) - 3, 2, 8);
      } else {
        ctx.fillStyle = '#ff5f6a';
        ctx.fillRect(PC.W - 8, Math.round(sy), 6, 2);
        ctx.fillRect(PC.W - 8, Math.round(sy) - 3, 2, 8);
      }
    }

    // the clock is draining health: say so, loudly, in the middle
    if (PC.stage.alarmed && (W.time >> 3) % 2) {
      PC.art.text(ctx, 'HURRY!', PC.W / 2, PC.FIELD_Y + 30, '#ff4a4a',
        { align: 'center', scale: 3, shadow: '#400000', shadowDist: 2, wobble: 1, phase: W.time * 0.3 });
    }

    // caught in a bear hug: the one mechanic the cabinet must shout about
    var ps = W.players();
    for (var q = 0; q < ps.length; q++) {
      var pl = ps[q];
      if (pl.state === 'held' && pl.grabbedBy && (W.time >> 2) % 2) {
        PC.art.text(ctx, 'MASH!', Math.round(pl.x - camX), pl.y - pl.z - pl.hh - 14,
          '#ffe070', { align: 'center', scale: 2, shadow: '#802000', shadowDist: 1 });
      }
    }
  };

  // ------------------------------------------------------------------ top bar
  Hud.drawTop = function (ctx, g) {
    Art.rect(ctx, 0, 0, PC.W, PC.HUD_TOP, '#000000');
    var mid = PC.W / 2;
    var p1 = g.player(0), p2 = g.player(1);

    Art.text(ctx, '1UP', 14, 5, p1 && !p1.dead ? '#ffffff' : '#8a8a9c');
    Art.text(ctx, PC.pad(g.scores[0], 6), 14, 14, '#ffffff');

    Art.text(ctx, 'HI-SCORE', mid, 5, '#ffe070', { align: 'center' });
    Art.text(ctx, PC.pad(g.hiScore, 6), mid, 14, '#ffffff', { align: 'center' });

    Art.text(ctx, '2UP', PC.W - 14, 5, p2 ? '#ffffff' : '#8a8a9c', { align: 'right' });
    if (p2) Art.text(ctx, PC.pad(g.scores[1], 6), PC.W - 14, 14, '#ffffff', { align: 'right' });
    else {
      Art.text(ctx, '000000', PC.W - 14, 14, '#5a6070', { align: 'right' });
      if ((W.time >> 5) % 2) Art.text(ctx, 'INSERT COIN', PC.W - 14, 26, '#4aa8ff', { align: 'right' });
    }

    // lives, as a row of heads
    if (p1) {
      var ic = Hud.icon(p1.char);
      for (var i = 0; i < Math.min(5, g.lives[0]); i++) ctx.drawImage(ic, 13 + i * 13, 22);
      if (g.lives[0] > 5) Art.text(ctx, 'X' + g.lives[0], 13, 24, '#ffffff');
    }
    if (p2) {
      var ic2 = Hud.icon(p2.char);
      for (var j = 0; j < Math.min(5, g.lives[1]); j++) {
        ctx.drawImage(ic2, PC.W - 24 - j * 13, 22);
      }
    }

    // clock
    if (g.state === 'title') return;
    var t = PC.stage.timeLeft;
    Art.text(ctx, 'TIME', mid, 24, t <= 10 ? '#ff4a4a' : '#ff8a3a', { align: 'center' });
    Art.text(ctx, PC.pad(t, 2), mid, 33, t <= 10 && (W.time >> 3) % 2 ? '#ff4a4a' : '#ffffff', { align: 'center' });

    // where we are
    if (PC.stage.def) {
      Art.text(ctx, 'STAGE ' + (PC.stage.index + 1), mid, 45, '#4ae06a', { align: 'center' });
      Art.text(ctx, PC.stage.def.name, mid, 54, '#ffffff', { align: 'center' });
    }
  };

  // --------------------------------------------------------------- bottom bar
  Hud.drawBottom = function (ctx, g) {
    var y0 = PC.FIELD_BOT;
    Art.rect(ctx, 0, y0, PC.W, PC.H - y0, '#000000');
    var p1 = g.player(0), p2 = g.player(1);

    Art.text(ctx, 'PLAYER', 12, y0 + 8, '#ffffff');
    Hud.bar(ctx, 58, y0 + 6, 146, 10, p1 ? p1.hp / p1.maxHp : 0, '#2f6ef0');

    if (p2) {
      Art.text(ctx, 'PLAYER 2', 12, y0 + 21, '#ffffff');
      Hud.bar(ctx, 58, y0 + 19, 146, 10, p2.hp / p2.maxHp, '#e04a3a');
    } else if (g.state === 'play') {
      if ((W.time >> 5) % 2) Art.text(ctx, 'PRESS 2 TO JOIN', 12, y0 + 21, '#4aa8ff');
    }

    Art.text(ctx, 'CREDIT ' + PC.pad(g.credits, 2), PC.W - 12, y0 + 21, '#ffffff', { align: 'right' });

    // The weapon in your hands, named, so you know what you picked up.
    if (p1 && p1.weapon) {
      Art.text(ctx, PC.weapons[p1.weapon].label, PC.W - 12, y0 + 8, '#ffe070', { align: 'right' });
    } else if (p1 && p1.carry) {
      Art.text(ctx, p1.carry.key === 'drum' ? 'DRUM' : 'CRATE', PC.W - 12, y0 + 8, '#ffe070', { align: 'right' });
    }
  };

  // ---------------------------------------------------------------- boss bar
  Hud.drawBoss = function (ctx) {
    var b = PC.stage.bossActive;
    if (!b || b.removed) return;
    var y = PC.FIELD_Y + 5;
    Art.text(ctx, b.name, PC.W / 2, y, '#ff5f6a', { align: 'center', shadow: '#000000' });
    var bx = PC.W / 2 - 66, bw = 132;
    Hud.bar(ctx, bx, y + 9, bw, 7, Math.max(0, b.hp / b.maxHp), '#e03040', '#3a1a20');
    /* Ticks where the fight turns, so the player knows how much is left
     * of each chapter of it. */
    var ph = (b.T && b.T.phases) || [];
    for (var i = 0; i < ph.length; i++) {
      Art.rect(ctx, bx + bw * ph[i].at, y + 9, 1, 7, '#0a0a12');
    }
  };

  // -------------------------------------------------------------- big banners
  Hud.banner = function (ctx, lines, y, opts) {
    opts = opts || {};
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      Art.text(ctx, l.t, PC.W / 2, y + i * (l.scale ? l.scale * 9 + 4 : 13), l.c || '#ffffff', {
        align: 'center', scale: l.scale || 1, shadow: l.shadow || '#000000', shadowDist: (l.scale || 1),
        tracking: l.tracking === undefined ? 1 : l.tracking, wobble: l.wobble, phase: opts.phase
      });
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
