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
  var M = PC.math, W = PC.world, FX = PC.fx;

  function enc(x, groups, opts) {
    var e = { x: x, groups: groups, boss: false, items: null };
    if (opts) for (var k in opts) e[k] = opts[k];
    return e;
  }

  /* groups: [type, count, side, delay] - side -1 comes in from behind you,
   * +1 from up ahead, 0 means already standing there. */
  PC.STAGES = [
    {
      name: 'SLUM ALLEY', theme: 'alley', length: 1760, time: 99, music: 'stage1',
      intro: 'THE GANG TOOK MARIAN.  START WHERE THEY LIVE.',
      encounters: [
        enc(230, [['punk', 2, 1, 0]]),
        enc(500, [['punk', 2, 1, 0], ['rough', 1, -1, 90]], { items: [['prop', 'crate', 60], ['prop', 'crate', 120]] }),
        enc(880, [['rough', 2, 1, 0], ['punk', 1, -1, 60]], { items: [['weapon', 'bat', 40]] }),
        enc(1230, [['punk', 2, 1, 0], ['batter', 1, 1, 70], ['rough', 1, -1, 120]]),
        enc(1560, [['brute', 1, 1, 0], ['punk', 2, -1, 80]], { boss: 'crusher', bossDelay: 150 })
      ]
    },
    {
      name: 'DOWNTOWN', theme: 'downtown', length: 1900, time: 99, music: 'stage2',
      intro: 'THEY RUN THE BLOCK FROM THE OLD BAR.',
      encounters: [
        enc(240, [['punk', 2, 1, 0], ['rough', 1, 1, 60]]),
        enc(520, [['knifer', 2, 1, 0], ['punk', 1, -1, 70]], { items: [['prop', 'drum', 70]] }),
        enc(900, [['batter', 2, 1, 0], ['rough', 2, -1, 80]], { items: [['weapon', 'pipe', 30], ['pickup', 'heart', 150]] }),
        enc(1280, [['brute', 1, 1, 0], ['knifer', 1, 1, 40], ['punk', 2, -1, 90]]),
        enc(1660, [['rough', 2, 1, 0]], { boss: 'viper', bossDelay: 120 })
      ]
    },
    {
      name: 'THE DOCKS', theme: 'docks', length: 2000, time: 99, music: 'stage3',
      intro: 'CONTAINER SIX. THE ONE WITH THE LIGHT ON.',
      encounters: [
        enc(240, [['rough', 2, 1, 0], ['knifer', 1, -1, 50]]),
        enc(560, [['batter', 2, 1, 0], ['punk', 2, -1, 60]], { items: [['prop', 'crate', 40], ['prop', 'crate', 100], ['prop', 'drum', 160]] }),
        enc(960, [['brute', 2, 1, 0], ['rough', 1, -1, 70]], { items: [['weapon', 'bat', 50]] }),
        enc(1380, [['knifer', 2, 1, 0], ['batter', 1, -1, 40], ['rough', 2, 1, 110]], { items: [['pickup', 'heart', 140]] }),
        enc(1760, [['punk', 2, -1, 0]], { boss: 'jaws', bossDelay: 110 })
      ]
    },
    {
      name: 'POWER TOWER', theme: 'tower', length: 1840, time: 99, music: 'stage4',
      intro: 'TOP FLOOR. HE IS EXPECTING YOU.',
      encounters: [
        enc(240, [['rough', 2, 1, 0], ['batter', 1, 1, 60], ['knifer', 1, -1, 100]]),
        enc(560, [['brute', 2, 1, 0], ['rough', 2, -1, 70]], { items: [['weapon', 'pipe', 40]] }),
        enc(940, [['knifer', 2, 1, 0], ['batter', 2, -1, 60], ['punk', 2, 1, 130]], { items: [['pickup', 'heart', 120]] }),
        enc(1320, [['brute', 1, 1, 0], ['rough', 2, 1, 50], ['knifer', 2, -1, 100]], { items: [['prop', 'drum', 60]] }),
        enc(1680, [], { boss: 'power', bossDelay: 60, escort: [['brute', 1, -1, 260]] })
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
      this.bossActive = null;
      this.bossBanner = 0;
      this.finishT = 0;
    },

    // ---- encounters
    startEncounter: function (e) {
      this.active = e;
      this.locked = true;
      this.lockX = W.camX;
      this.pending.length = 0;
      var i, g;
      for (i = 0; i < e.groups.length; i++) {
        g = e.groups[i];
        for (var n = 0; n < g[1]; n++) {
          this.pending.push({ type: g[0], side: g[2], t: (g[3] || 0) + n * 22 });
        }
      }
      if (e.escort) {
        for (i = 0; i < e.escort.length; i++) {
          g = e.escort[i];
          for (var m = 0; m < g[1]; m++) this.pending.push({ type: g[0], side: g[2], t: (g[3] || 0) + m * 24 });
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
      if (e.boss && PC.audio) PC.audio.play('boss');
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
      var ex = side > 0 ? W.camX + PC.W + PC.rand.range(10, 40) : W.camX - PC.rand.range(14, 44);
      ex = M.clamp(ex, W.minX + 4, W.maxX - 4);
      var ey = PC.rand.range(PC.FLOOR_TOP + 6, PC.FLOOR_BOT - 4);
      var d = PC.game ? PC.game.difficulty() : { hp: 1, dmg: 1, aggr: 1 };
      var e = PC.spawnEnemy(s.type, ex, ey, {
        facing: side > 0 ? -1 : 1, hpScale: d.hp, dmgScale: d.dmg, aggrScale: d.aggr
      });
      if (s.boss) {
        this.bossActive = e;
        this.bossBanner = 110;
        e.invuln = 40;
        FX.flash('#ffffff', 5);
        FX.shakeBy(5);
        PC.freeze(22);
        if (PC.audio) PC.audio.sfx('bossIn');
      }
      return e;
    },

    update: function () {
      if (!this.def) return;
      var i;

      // ---- countdown
      if (!this.cleared) {
        if (++this.timeT >= 72) {
          this.timeT = 0;
          this.timeLeft--;
          if (this.timeLeft <= 10 && this.timeLeft > 0 && PC.audio) PC.audio.sfx('tick');
          if (this.timeLeft <= 0) { this.timeLeft = 0; if (PC.game) PC.game.timeUp(); }
        }
      }

      // ---- spawn queue
      if (this.active) {
        this.encT++;
        for (i = this.pending.length - 1; i >= 0; i--) {
          if (this.encT >= this.pending[i].t) {
            this.spawnOne(this.pending[i]);
            this.pending.splice(i, 1);
          }
        }
        if (!this.pending.length && !W.enemies().length) {
          this.active = null;
          this.locked = false;
          this.bossActive = null;
          this.arrowT = 1;
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
      for (var x = sx; x < PC.W; x += this.skyW) {
        ctx.drawImage(this.sky, Math.round(x), PC.FIELD_Y);
      }
      ctx.drawImage(this.facade, Math.round(-camX), PC.FIELD_Y);
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
      PC.art.text(ctx, 'GANG BOSS', PC.W / 2 + slide, y + 17, '#ffffff', { align: 'center', tracking: 2 });
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
