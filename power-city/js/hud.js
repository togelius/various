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
    var stage = PC.stage;
    if (stage.coachT > 0 && stage.coach && !stage.bossBanner && !stage.bossActive) {
      var cw = Art.textWidth(stage.coach, 1, 1) + 20;
      Art.rect(ctx, (PC.W - cw) / 2, PC.FIELD_Y + 7, cw, 19, '#101a2a');
      Art.rect(ctx, (PC.W - cw) / 2, PC.FIELD_Y + 7, 3, 19, '#ffe57a');
      Art.text(ctx, stage.coach, PC.W / 2, PC.FIELD_Y + 13, '#fff1c9', { align: 'center' });
    }

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
        PC.art.text(ctx, 'HOLD ATTACK!', Math.round(pl.x - camX), pl.y - pl.z - pl.hh - 14,
          '#ffe070', { align: 'center', scale: 2, shadow: '#802000', shadowDist: 1 });
      }
    }
  };

  // Compact health and escape meters sit together, close to the fight.
  Hud.drawTop = function (ctx, g) {
    Art.rect(ctx, 0, 0, PC.W, PC.HUD_TOP, '#0a101e');
    Art.rect(ctx, 0, PC.HUD_TOP - 1, PC.W, 1, '#40506a');
    var cols = ['#55d8ed', '#ff6682'];
    for (var i = 0; i < 2; i++) {
      var p = g.player(i), x = i ? PC.W - 153 : 10;
      if (!p) {
        if (i) {
          Art.text(ctx, '2 / PAD 2: JOIN', x + 138, 8, '#8495b1', { align: 'right' });
          Art.text(ctx, 'BRING A FRIEND', x + 138, 20, '#526078', { align: 'right' });
        }
        continue;
      }
      Art.text(ctx, p.name, x, 4, cols[i]);
      Art.text(ctx, 'x' + g.lives[i], x + 138, 4, '#fff1c9', { align: 'right' });
      Hud.bar(ctx, x, 15, 140, 7, p.hp / p.maxHp, cols[i], '#252e41');
      Art.rect(ctx, x, 26, 40, 3, '#25364a');
      Art.rect(ctx, x, 26, Math.round(40 * p.power / 100), 3, p.power >= 100 ? '#ffe57a' : cols[i]);
      Art.text(ctx, p.power >= 100 ? 'BREAKOUT READY' : 'RECHARGING', x + 45, 25,
        p.powerHint > 0 ? '#ff866e' : p.power >= 100 ? '#ffe57a' : '#6f819e', { tracking: 0 });
    }
    Art.text(ctx, PC.pad(g.scores[0] + g.scores[1], 6), PC.W / 2, 5, '#fff1c9', { align: 'center' });
    Art.text(ctx, 'BLOCK ' + (PC.stage.index + 1) + ' / 4', PC.W / 2, 17, '#8495b1', { align: 'center', tracking: 0 });
    // The route is the objective, not an unexplained ticking threat.
    for (var n = 0; n < 4; n++) Art.rect(ctx, PC.W / 2 - 20 + n * 12, 28, 8, 2,
      n <= PC.stage.index ? '#ef638c' : '#354056');
  };

  Hud.drawBottom = function (ctx, g) {
    Art.rect(ctx, 0, PC.FIELD_BOT, PC.W, PC.H - PC.FIELD_BOT, '#0a101e');
    Art.rect(ctx, 0, PC.FIELD_BOT, PC.W, 1, '#40506a');
    var mode = PC.input.device || 'keys';
    Art.text(ctx, mode === 'pad' ? 'HOLD X: ATTACK' : mode === 'touch' ? 'HOLD ATTACK' : 'HOLD Z: ATTACK', 12, PC.FIELD_BOT + 6, '#e3edf8', { tracking: 0 });
    Art.text(ctx, mode === 'pad' ? 'B: BREAKOUT' : mode === 'touch' ? 'BREAKOUT' : 'X: BREAKOUT', 168, PC.FIELD_BOT + 6, '#ffe57a', { tracking: 0 });
    Art.text(ctx, mode === 'pad' ? 'A: JUMP KICK' : mode === 'touch' ? 'JUMP KICK' : 'SPACE: JUMP KICK', 319, PC.FIELD_BOT + 6, '#e3edf8', { tracking: 0 });
  };

  // ---------------------------------------------------------------- boss bar
  Hud.drawBoss = function (ctx) {
    var b = PC.stage.bossActive;
    if (!b || b.removed) return;
    var y = PC.FIELD_Y + 5;
    Art.text(ctx, b.name, PC.W / 2, y, '#ff5f6a', { align: 'center', shadow: '#000000' });
    var bx = PC.W / 2 - 66, bw = 132;
    Hud.bar(ctx, bx, y + 9, bw, 7, Math.max(0, b.hp / b.maxHp), '#e03040', '#3a1a20');
    Art.text(ctx, 'DODGE OR BREAKOUT. PUNISH THE RECOVERY.', PC.W / 2, y + 20, '#e6b786', { align: 'center', tracking: 0 });
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
