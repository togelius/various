/* POWER CITY - four stages, and the fights that happen along them.
 *
 * A stage is a strip of street plus a list of encounters. The camera walks
 * forward with the players until it hits the next encounter, then locks: the
 * gang comes in from both sides and nobody moves on until the street is
 * clear. Locking the camera is what turns a scrolling background into an
 * arena, and it is the whole structure of the genre.
 */
(function (global) {
  'use strict';
  var PC = global.PC || (global.PC = {});
  var M = PC.math, W = PC.world, FX = PC.fx, City = PC.city;

  function enc(x, groups, opts) {
    var e = { x: x, groups: groups, boss: false, items: null };
    if (opts) for (var k in opts) e[k] = opts[k];
    return e;
  }

  /* groups: [type, count, side, delay, fewer] - side -1 comes in from behind
   * you, +1 from up ahead. A `fewer` value makes the group reinforcements:
   * they hold until the live count drops that low, then pour in. `noLock`
   * encounters chase you without closing the street; `litter` is what the
   * block drops where there is no fight. */
  PC.STAGES = [
    {
      name: 'SLUM ALLEY', theme: 'alley', length: 1650, time: 99, music: 'stage1',
      intro: 'THEY TOOK YOUR BROTHER. START WHERE THEY LIVE.',
      litter: [['pickup', 'coin', 380], ['pickup', 'heart', 430], ['prop', 'trash', 660], ['pickup', 'coin', 1100]],
      encounters: [
        enc(230, [['punk', 2, 1, 0], ['punk', 1, -1, 90]], { items: [['prop', 'trash', 30]] }),
        enc(500, [['punk', 2, 1, 0], ['rough', 1, -1, 70]], { items: [['prop', 'crate', 60], ['prop', 'crate', 120]] }),
        enc(880, [['batter', 1, 1, 0], ['punk', 2, -1, 60], ['punk', 1, 1, 90, 2]], { items: [['weapon', 'bat', 40]] }),
        enc(1230, [['rough', 2, 1, 0], ['punk', 1, -1, 30]], { noLock: true }),
        enc(1560, [['punk', 2, 1, 0], ['punk', 1, -1, 200, 1]], { boss: 'crusher', bossDelay: 150, items: [['prop', 'trash', 80]] })
      ]
    },
    {
      name: 'DOWNTOWN', theme: 'downtown', length: 1790, time: 99, music: 'stage2',
      intro: 'THEY RUN THIS BLOCK OUT OF THE OLD BAR.',
      litter: [['prop', 'trash', 300], ['pickup', 'coin', 700], ['pickup', 'heart', 760], ['pickup', 'coin', 1150]],
      encounters: [
        enc(240, [['punk', 2, 1, 0], ['rough', 1, 1, 60], ['rough', 1, -1, 50, 2]]),
        enc(520, [['knifer', 2, 1, 0], ['punk', 1, -1, 70], ['knifer', 1, 1, 80, 2]], { items: [['prop', 'trash', 70], ['prop', 'drum', 150]] }),
        enc(740, [['rough', 1, 1, 0], ['punk', 1, -1, 40]], { noLock: true }),
        enc(900, [['batter', 2, 1, 0], ['rough', 1, -1, 80], ['punk', 2, 1, 100, 2]], { items: [['weapon', 'pipe', 30], ['pickup', 'heart', 150]] }),
        enc(1280, [['brute', 1, 1, 0], ['knifer', 1, 1, 40], ['punk', 2, -1, 90], ['knifer', 1, 1, 120, 2]], { items: [['prop', 'crate', 60]] }),
        enc(1660, [['rough', 1, 1, 0], ['batter', 1, -1, 200, 1]], { boss: 'viper', bossDelay: 120, items: [['prop', 'trash', 100], ['prop', 'trash', 180]] })
      ]
    },
    {
      name: 'THE DOCKS', theme: 'docks', length: 1890, time: 99, music: 'stage3',
      intro: 'CONTAINER SIX. THE ONE WITH THE LIGHT ON.',
      litter: [['pickup', 'heart', 820], ['pickup', 'coin', 860], ['prop', 'trash', 1180], ['pickup', 'coin', 1220]],
      encounters: [
        enc(240, [['rough', 2, 1, 0], ['knifer', 1, -1, 50], ['punk', 1, 1, 60, 2]]),
        enc(560, [['batter', 2, 1, 0], ['punk', 2, -1, 60], ['punk', 2, 1, 90, 2]], { items: [['prop', 'crate', 40], ['prop', 'crate', 100], ['prop', 'drum', 160]] }),
        enc(800, [['punk', 2, 1, 0]], { noLock: true }),
        enc(960, [['brute', 2, 1, 0], ['rough', 1, -1, 70], ['rough', 2, 1, 120, 1]], { items: [['weapon', 'bat', 50]] }),
        enc(1380, [['knifer', 2, 1, 0], ['batter', 1, -1, 40], ['rough', 2, 1, 110], ['batter', 1, 1, 140, 2]], { items: [['pickup', 'heart', 140]] }),
        enc(1760, [['punk', 2, -1, 0], ['punk', 2, 1, 150, 1]], { boss: 'jaws', bossDelay: 110, items: [['prop', 'drum', 90]] })
      ]
    },
    {
      name: 'POWER TOWER', theme: 'tower', length: 1730, time: 99, music: 'stage4',
      intro: 'TOP FLOOR. HE IS EXPECTING YOU.',
      litter: [['pickup', 'coin', 300], ['prop', 'trash', 340], ['pickup', 'heart', 720], ['pickup', 'coin', 760]],
      encounters: [
        enc(240, [['rough', 2, 1, 0], ['batter', 1, 1, 60], ['knifer', 1, -1, 100], ['punk', 1, 1, 130, 2]]),
        enc(560, [['brute', 2, 1, 0], ['rough', 2, -1, 70], ['punk', 2, 1, 110, 2]], { items: [['weapon', 'pipe', 40]] }),
        enc(940, [['knifer', 2, 1, 0], ['batter', 2, -1, 60], ['punk', 2, 1, 130], ['punk', 2, -1, 150, 2]], { items: [['prop', 'crate', 50], ['prop', 'drum', 120], ['pickup', 'heart', 150]] }),
        enc(1120, [['rough', 2, 1, 0], ['knifer', 1, -1, 50]], { noLock: true }),
        enc(1320, [['brute', 1, 1, 0], ['rough', 2, 1, 50], ['knifer', 2, -1, 100], ['batter', 1, 1, 140, 2]], { items: [['prop', 'trash', 60], ['prop', 'trash', 140]] }),
        enc(1680, [], { boss: 'power', bossDelay: 60, escort: [['brute', 1, -1, 280]] })
      ]
    }
  ];

  // -------------------------------------------------------------- the runner
  var Stage = PC.stage = {
    def: null, index: 0, theme: null,
    sky: null, facade: null, skyW: 0,
    encIndex: 0, active: null, locked: false, lockX: 0,
    pending: [], cleared: false, arrowT: 0, timeLeft: 99, timeT: 0,
    bossActive: null,
    bossBanner: 0, bossSub: null,

    load: function (index) {
      this.index = M.clamp(index, 0, PC.STAGES.length - 1);
      this.def = PC.STAGES[this.index];
      this.theme = PC.city.THEMES[this.def.theme];
      this.skyW = 560;
      this.sky = PC.city.makeSky(this.theme, this.skyW, PC.FLOOR_TOP - PC.FIELD_Y);
      this.facade = PC.city.build(this.theme, this.def.length + PC.W);
      W.reset();
      W.minX = 0;
      W.maxX = this.def.length + PC.W - 20;
      W.camX = 0;
      this.encIndex = 0;
      this.active = null;
      this.locked = false;
      this.cleared = false;
      this.arrowT = 0;
      this.pending.length = 0;
      this.timeLeft = this.def.time;
      this.timeT = 0;
      this.alarmed = false;
      this.alarmT = 0;
      this.bossActive = null;
      this.bossBanner = 0;
      this.bossSub = null;
      this.front = City.buildFront(this.theme);
      this.clouds = City.makeClouds(this.theme);
      this.ambAcc = 0;
      /* The block has things lying on it where there is no fight: coins
       * on the pavement, a can to kick, dinner behind a window. */
      if (this.def.litter) {
        for (var l = 0; l < this.def.litter.length; l++) {
          var lt = this.def.litter[l];
          PC.items.spawn(lt[0], lt[1], lt[2], PC.rand.range(PC.FLOOR_TOP + 8, PC.FLOOR_BOT - 4));
        }
      }
      this.finishT = 0;
    },

    // ---- encounters
    startEncounter: function (e) {
      this.active = e;
      /* A `noLock` fight chases you down the street without closing it;
      * the arena fights lock the camera and turn the street into a ring. */
      this.locked = !e.noLock;
      this.lockX = W.camX;
      this.pending.length = 0;
      var i, g;
      for (i = 0; i < e.groups.length; i++) {
        g = e.groups[i];
        for (var n = 0; n < g[1]; n++) {
          this.pending.push({ type: g[0], side: g[2], t: (g[3] || 0) + n * 22, fewer: g[4] });
        }
      }
      if (e.escort) {
        for (i = 0; i < e.escort.length; i++) {
          g = e.escort[i];
          for (var m = 0; m < g[1]; m++) this.pending.push({ type: g[0], side: g[2], t: (g[3] || 0) + m * 24, fewer: g[4] });
        }
      }
      if (e.boss) this.pending.push({ type: e.boss, side: 1, t: e.bossDelay || 100, boss: true });
      if (e.items) {
        for (i = 0; i < e.items.length; i++) {
          var it = e.items[i];
          this.pending.push({ item: it, t: it[2] || 0 });
        }
      }
      this.encT = 0;
      this.encHurt = false;
      /* A boss deserves a clock of its own. Arriving at the last fight with
       * nine seconds left is not tension, it is a coin-op tax. */
      if (e.boss) {
        this.timeLeft = Math.max(this.timeLeft, 50);
        if (PC.audio) PC.audio.play('boss');
      }
    },

    spawnOne: function (s) {
      if (s.item) {
        // Crates and weapons are already lying in the street; food and money
        // come down from somewhere off the top of the screen.
        var kind = s.item[0], key = s.item[1];
        var x = W.camX + PC.rand.range(50, PC.W - 50);
        var y = PC.rand.range(PC.FLOOR_TOP + 8, PC.FLOOR_BOT - 4);
        PC.items.spawn(kind, key, x, y, { z: kind === 'pickup' ? 60 : 0 });
        return;
      }
      var side = s.side || (PC.rand.chance(0.5) ? 1 : -1);
      var ex = side > 0 ? W.camX + PC.W + PC.rand.range(6, 24) : W.camX - PC.rand.range(10, 26);
      ex = M.clamp(ex, W.minX + 4, W.maxX - 4);
      var ey = PC.rand.range(PC.FLOOR_TOP + 6, PC.FLOOR_BOT - 4);
      var d = PC.game ? PC.game.difficulty() : { hp: 1, dmg: 1, aggr: 1, players: 1 };
      // Bosses are already sized for the stage they guard; only the gang
      // scales with how far you have come.
      var e = PC.spawnEnemy(s.type, ex, ey, {
        facing: side > 0 ? -1 : 1,
        hpScale: s.boss ? (d.players > 1 ? 1.4 : 1) : d.hp,
        dmgOut: d.dmg, aggrScale: d.aggr
      });
      if (s.boss) {
        this.bossActive = e;
        this.bossBanner = 110;
        this.bossSub = null;
        e.invuln = 40;
        FX.flash('#ffffff', 5);
        FX.shakeBy(5);
        PC.freeze(22);
        if (PC.audio) PC.audio.sfx('bossIn');
      }
      /* Fresh legs get a moment of grace and a marker over the head, so
       * nobody swings in from off the screen. */
      e.spawnGuard = side < 0 ? 70 : 36;
      e.entering = 75;
      FX.dust(ex, ey, -side, 4);
      return e;
    },

    /* The weather each neighbourhood gets: rain on the docks, a drizzle
     * downtown, dust in the alley, embers on the tower. Runs on the FX
     * clock, so the sky keeps falling while the world is frozen for a hit. */
    weather: function () {
      if (!this.theme || !this.theme.ambient) return;
      var amb = this.theme.ambient;
      this.ambAcc += amb.rate;
      while (this.ambAcc >= 1) {
        this.ambAcc--;
        if (amb.kind === 'rain') {
          FX.add({
            t: 0, life: 40, kind: 'rain',
            x: W.camX + PC.fxRand.range(-60, PC.W + 40),
            y: PC.FIELD_Y + PC.fxRand.range(-6, 34),
            vx: -1.5 - PC.fxRand.range(0, 0.6), vy: 4.4 + PC.fxRand.range(0, 0.5), g: 0
          });
        } else if (amb.kind === 'ember') {
          FX.add({
            t: 0, life: PC.fxRand.int(60, 110), kind: 'ember',
            x: W.camX + PC.fxRand.range(0, PC.W),
            y: PC.fxRand.range(PC.FLOOR_TOP - 60, PC.FIELD_BOT - 8),
            vx: PC.fxRand.range(-0.15, 0.3), vy: -PC.fxRand.range(0.2, 0.45), g: 0,
            col: PC.fxRand.pick(['#ff8a20', '#ffd23a', '#ff5f6a'])
          });
        } else {
          FX.add({
            t: 0, life: PC.fxRand.int(80, 150), kind: 'mote',
            x: W.camX + PC.fxRand.range(0, PC.W),
            y: PC.fxRand.range(PC.FIELD_Y + 4, PC.FIELD_BOT - 4),
            vx: PC.fxRand.range(-0.2, 0.3), vy: -PC.fxRand.range(0, 0.08), g: 0
          });
        }
      }
    },

    update: function () {
      if (!this.def) return;
      var i;

      this.weather();

      // ---- countdown
      if (!this.cleared) {
        if (++this.timeT >= 76) {
          this.timeT = 0;
          this.timeLeft--;
          if (this.timeLeft <= 10 && this.timeLeft > 0 && PC.audio) PC.audio.sfx('tick');
          if (this.timeLeft <= 0) {
            /* Out of clock: not a death sentence, a siren. Health drains
             * until the street is clear or you are. */
            this.timeLeft = 0;
            if (!this.alarmed) {
              this.alarmed = true;
              this.alarmT = 0;
              FX.flash('#ff2020', 8);
            }
            if (PC.game) PC.game.clockDrain();
            if (this.alarmed && ++this.alarmT >= 6 && PC.audio) { this.alarmT = 0; PC.audio.sfx('alarm'); }
          }
        }
      }

      // ---- spawn queue. Reinforcements (a `fewer` threshold) hold until the
      // live count drops, so a wave thins before the next one lands.
      if (this.active) {
        this.encT++;
        var alive = W.enemies().length;
        for (i = this.pending.length - 1; i >= 0; i--) {
          var q = this.pending[i];
          var due = this.encT >= q.t &&
            (q.fewer === undefined || q.fewer === null || alive <= q.fewer);
          if (due) {
            this.spawnOne(q);
            this.pending.splice(i, 1);
            alive++;
          }
        }
        if (!this.pending.length && !W.enemies().length) {
          this.active = null;
          this.locked = false;
          this.bossActive = null;
          this.arrowT = 1;
          /* Clearing a fight buys the clock back: the timer is there to keep
           * you moving, not to execute you mid-boss. */
          if (this.alarmed) { this.alarmed = false; if (PC.audio) PC.audio.sfx('heal'); }
          this.timeLeft = Math.min(this.def.time, this.timeLeft + 8);
          /* A fight without a scratch pays a bonus and says so. */
          if (!this.encHurt) {
            var pw = W.livePlayers()[0];
            if (pw) {
              pw.addScore(2000);
              FX.pop(pw.x, pw.y - pw.hh - 14, 'PERFECT', '#4ae06a');
              if (PC.audio) PC.audio.sfx('join');
            }
          }
          if (this.encIndex >= this.def.encounters.length) this.cleared = true;
          else if (PC.audio) PC.audio.play(this.def.music);
        }
      } else {
        var next = this.def.encounters[this.encIndex];
        var lead = 0, ps = W.livePlayers();
        for (i = 0; i < ps.length; i++) lead = Math.max(lead, ps[i].x);
        if (next && lead >= next.x) {
          this.encIndex++;
          this.startEncounter(next);
          this.arrowT = 0;
        }
      }

      if (this.arrowT > 0) this.arrowT++;
      if (this.bossBanner > 0) this.bossBanner--;
      this.updateCamera();

      if (this.cleared && !W.enemies().length) this.finishT++;
    },

    /* The camera trails the party, never reverses, and stops dead at a lock.
     * Players are fenced to the visible strip by Actor.update. */
    updateCamera: function () {
      var ps = W.livePlayers();
      if (!ps.length) return;
      var sum = 0;
      for (var i = 0; i < ps.length; i++) sum += ps[i].x;
      var target = sum / ps.length - PC.W * 0.42;
      var maxCam = this.def.length - 4;
      if (this.locked) maxCam = Math.min(maxCam, this.lockX);
      target = M.clamp(target, 0, maxCam);
      if (target > W.camX) W.camX = M.approach(W.camX, target, 3.2);
      else if (!this.locked && target < W.camX - 40) W.camX = M.approach(W.camX, target, 2);
    },

    atEnd: function () {
      return this.cleared && W.camX >= this.def.length - 6;
    },

    // ------------------------------------------------------------- rendering
    draw: function (ctx) {
      var camX = W.camX;
      // sky, at a third the speed, tiling forever
      var sx = -Math.floor(camX * 0.34) % this.skyW;
      if (sx > 0) sx -= this.skyW;
      var x, t, b;
      for (x = sx; x < PC.W; x += this.skyW) {
        ctx.drawImage(this.sky, Math.round(x), PC.FIELD_Y);
        // aviation beacons pulse on the skyline towers
        if (this.sky.beacons) {
          for (b = 0; b < this.sky.beacons.length; b++) {
            var bc = this.sky.beacons[b];
            var bx2 = Math.round(x + bc[0]), by2 = PC.FIELD_Y + bc[1];
            var pa = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(W.time * 0.06 + bc[0] * 0.7));
            ctx.save();
            ctx.globalAlpha = pa * 0.3;
            ctx.fillStyle = '#ff4a4a';
            ctx.fillRect(bx2 - 2, by2 - 2, 5, 5);
            ctx.globalAlpha = pa;
            ctx.fillRect(bx2, by2, 2, 2);
            ctx.restore();
          }
        }
      }
      if (this.clouds) City.drawClouds(ctx, this.theme, this.clouds, camX, W.time, PC.W, PC.FIELD_Y);
      ctx.drawImage(this.facade, Math.round(-camX), PC.FIELD_Y);
      // the neon landmarks breathe, and once in a while one cuts out
      if (this.theme && this.theme.landmarks) {
        var lm = this.theme.landmarks;
        for (t = 0; t < lm.length; t++) {
          if (lm[t][1] !== 'neon') continue;
          var nx = lm[t][0] - camX;
          if (nx < -96 || nx > PC.W + 16) continue;
          var ph = W.time * 0.13 + lm[t][0];
          ctx.save();
          if (Math.sin(ph * 0.37 + lm[t][0] * 0.11) > 0.962) {
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = '#14081c';
            ctx.fillRect(Math.round(nx) + 3, PC.FIELD_Y + 14, 72, 32);
          } else {
            var a = 0.05 + 0.05 * (0.5 + 0.5 * Math.sin(ph));
            ctx.globalAlpha = a;
            ctx.fillStyle = this.theme.neon;
            ctx.fillRect(Math.round(nx) + 3, PC.FIELD_Y + 13, 72, 34);
            ctx.globalAlpha = a * 1.7;
            ctx.fillRect(Math.round(nx) + 10, PC.FIELD_Y + 17, 58, 26);
          }
          ctx.restore();
        }
      }
    },

    /* A boss walks on to their own title card. Costs two seconds and buys
     * the fight a beginning. */
    drawBanner: function (ctx) {
      if (!this.bossBanner || !this.bossActive) return;
      var t = this.bossBanner;
      var a = Math.min(1, t / 24);
      var y = PC.FIELD_Y + 58;
      ctx.save();
      ctx.globalAlpha = a * 0.72;
      PC.art.rect(ctx, 0, y - 6, PC.W, 30, '#160408');
      ctx.restore();
      PC.art.rect(ctx, 0, y - 7, PC.W, 1, '#e03040');
      PC.art.rect(ctx, 0, y + 24, PC.W, 1, '#e03040');
      var slide = Math.round((1 - Math.min(1, (110 - t) / 14)) * 60);
      PC.art.text(ctx, this.bossActive.name, PC.W / 2 - slide, y, '#ff5f6a',
        { align: 'center', scale: 2, tracking: 3, shadow: '#2a0006', shadowDist: 2 });
      PC.art.text(ctx, this.bossSub || 'GANG BOSS', PC.W / 2 + slide, y + 17, '#ffffff', { align: 'center', tracking: 2 });
    },

    drawArrow: function (ctx) {
      if (!this.arrowT || this.locked) return;
      var t = this.arrowT;
      var bob = Math.sin(t * 0.14) * 3;
      var x = PC.W - 54 + bob, y = PC.FIELD_Y + 26;
      if ((t >> 3) % 2 === 0) return;
      PC.art.text(ctx, 'GO', x - 10, y, '#ffe070', { scale: 2, shadow: '#802000', shadowDist: 2 });
      // a chunky arrow, drawn rather than typed
      var ax = x + 16, ay = y + 4;
      ctx.fillStyle = '#ffe070';
      ctx.fillRect(Math.round(ax), Math.round(ay), 12, 4);
      for (var i = 0; i < 5; i++) ctx.fillRect(Math.round(ax + 11 + i), Math.round(ay - 4 + i), 2, 12 - i * 2);
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
