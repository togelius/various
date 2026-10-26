/* POWER CITY - the cabinet: attract, credits, stages, continues, endings.
 *
 * Everything above this file knows how to fight. This one knows what the
 * machine does between fights - which is most of what makes a game feel like
 * an arcade game rather than a physics demo.
 */
(function (global) {
  'use strict';
  var PC = global.PC || (global.PC = {});
  var M = PC.math, Art = PC.art, W = PC.world, FX = PC.fx, Hud = PC.hud;

  var HERO = ['hero1', 'hero2'];

  var G = PC.game = {
    state: 'boot', stateT: 0,
    credits: 0, hiScore: 50000,
    scores: [0, 0], lives: [3, 3],
    players: [null, null],
    stageIndex: 0,
    paused: false,
    continueT: 0,
    respawnT: [0, 0], nextLife: [50000, 50000],
    attractX: 0,
    ended: false,

    // ------------------------------------------------------------------ boot
    boot: function () {
      PC.input.init();
      PC.Screen.init(document.getElementById('screen'));
      PC.bakeThings();
      PC.rig.bakeAll();
      var saved = PC.save.read();
      if (saved.hiScore) this.hiScore = saved.hiScore;
      PC.stage.load(0);
      this.setState('title');
      var loading = document.getElementById('loading');
      if (loading) loading.style.display = 'none';
      this.loop = PC.Loop(function () { G.update(); }, function () { G.render(); });
      this.loop.start();
    },

    setState: function (s) {
      this.state = s;
      this.stateT = 0;
    },

    player: function (i) { return this.players[i]; },

    difficulty: function () {
      var n = this.livePlayerCount();
      var s = PC.stage.index;
      /* The ramp. With the damage multiplier finally reaching the damage
       * enemies deal, this is a real curve: stage one gentle enough to
       * learn on, the city meaner every stage after it. Measured with the
       * agents: the naive bot should start losing lives on stage two, the
       * competent one should feel stage four. */
      return {
        hp: (1 + s * 0.12) * (n > 1 ? 1.28 : 1),
        dmg: 0.75 + s * 0.16,
        aggr: 0.9 + s * 0.08,
        players: n
      };
    },

    livePlayerCount: function () {
      var n = 0;
      for (var i = 0; i < 2; i++) if (this.players[i]) n++;
      return n;
    },

    noteScore: function (i, v) {
      this.scores[i] = v;
      if (v > this.hiScore) this.hiScore = v;
      // An extra life every 50,000, the way the machine used to pay you.
      while (v >= this.nextLife[i]) {
        this.nextLife[i] += 50000;
        this.lives[i]++;
        var p = this.players[i];
        if (p) FX.pop(p.x, p.y - p.hh - 8, '1UP', '#4ae06a');
        if (PC.audio) PC.audio.sfx('join');
      }
    },

    enemyDown: function () { },

    /* The clock ran out. Nobody dies to a number: the siren starts and
     * health drains until the fight is finished or they are. */
    clockDrain: function () {
      for (var i = 0; i < 2; i++) {
        var p = this.players[i];
        if (!p || p.dead) continue;
        p.hp -= 5;
        p.flash = 4;
        if (PC.stage) PC.stage.encHurt = true;
        if (p.hp <= 0) {
          p.hp = 0;
          if (p.grabbedBy) p.grabbedBy.releaseGrab();
          if (p.grabbing) p.releaseGrab();
          if (p.carry) PC.items.drop(p);
          p.knockDown(p.facing, { vx: 2, vz: 3 });
          p.dead = true; p.deathT = 0;
          p.onDeath();
        }
      }
      FX.shakeBy(1);
    },

    // ---------------------------------------------------------------- coins
    coin: function () {
      this.credits = Math.min(99, this.credits + 1);
      if (PC.audio) PC.audio.sfx('coin');
    },

    /* Everything that can start, continue or join a game goes through here,
     * so a mouse, a touch, a gamepad and the 1 key all take the same route
     * and none of them can drift out of step with the state machine. */
    startPressed: function (i) {
      i = i || 0;
      if (this.state === 'title') {
        if (this.credits <= 0) this.coin();
        this.startGame(i);
        return true;
      }
      if (this.state === 'continue') {
        if (this.credits <= 0) this.coin();
        this.doContinue(i);
        return true;
      }
      if ((this.state === 'play' || this.state === 'ready') && !this.players[i]) {
        if (this.credits <= 0) this.coin();
        return this.joinPlayer(i);
      }
      return false;
    },

    joinPlayer: function (i) {
      if (this.players[i] || this.credits <= 0) return false;
      this.credits--;
      var p = new PC.Player(i, HERO[i]);
      p.lives = 3;
      this.lives[i] = 3;
      this.scores[i] = 0;
      var other = this.players[1 - i];
      p.x = other ? other.x - 24 : W.camX + 70;
      p.y = other ? M.clamp(other.y + 10, PC.FLOOR_TOP, PC.FLOOR_BOT) : PC.FLOOR_BOT - 16;
      p.invuln = 90;
      this.players[i] = p;
      W.add(p);
      if (i === 1) PC.input.p2Joined = true;
      if (PC.audio) PC.audio.sfx('join');
      return true;
    },

    startGame: function (firstPlayer) {
      this.scores = [0, 0];
      this.lives = [3, 3];
      this.nextLife = [50000, 50000];
      this.players = [null, null];
      this.respawnT = [0, 0]; this.paused = false;
      this.stageIndex = 0;
      this.ended = false;
      PC.input.p2Joined = false;
      PC.stage.load(0);
      this.joinPlayer(firstPlayer);
      if (firstPlayer === 1) PC.input.p2Joined = true;
      this.setState('ready');
      if (PC.audio) PC.audio.play('ready');
    },

    // --------------------------------------------------------------- updating
    update: function () {
      PC.input.poll();
      if (PC.input.coin) this.coin();
      if (PC.input.mute && PC.audio) PC.audio.toggleMute();
      if (PC.input.fullscreen) this.toggleFullscreen();

      if (PC.input.pause && (this.state === 'play')) {
        this.paused = !this.paused;
        if (PC.audio) PC.audio.setPaused(this.paused);
      }
      if (this.paused) { W.time++; return; }

      this.stateT++;
      var i, p, anyStart = PC.input.p[0].pressed.start, anyStart2 = PC.input.p[1].pressed.start;

      switch (this.state) {
        case 'title':
          this.attractX += 0.4;
          if (anyStart || anyStart2) this.startPressed(anyStart ? 0 : 1);
          break;

        case 'ready':
          if (this.stateT === 1 && PC.audio) PC.audio.play(PC.stage.def.music);
          if (this.stateT > 90) this.setState('play');
          this.tryJoin();
          break;

        case 'play':
          this.tryJoin();
          PC.stage.update();
          W.update();
          this.checkPlayers();
          if (PC.stage.atEnd() && PC.stage.finishT > 40) this.stageClear();
          break;

        case 'clear':
          W.update();
          if (this.stateT > 40 && this.stateT % 3 === 0 && PC.stage.timeLeft > 0) {
            PC.stage.timeLeft--;
            var pl = this.players[0] || this.players[1];
            if (pl) pl.addScore(100);
            if (PC.audio) PC.audio.sfx('tally');
          }
          if (this.stateT > 150) this.nextStage();
          break;

        case 'over':
          W.update();
          if (this.stateT > 90) { this.setState('continue'); this.continueT = 10 * 60; }
          break;

        case 'continue':
          W.update();
          this.continueT--;
          if (anyStart || anyStart2) this.startPressed(anyStart ? 0 : 1);
          if (this.continueT <= 0) {
            this.saveHi();
            this.setState('title');
            PC.stage.load(0);
            if (PC.audio) PC.audio.play('title');
          }
          break;

        case 'ending':
          W.update();
          if (this.stateT > 900 || anyStart) { this.saveHi(); this.setState('title'); PC.stage.load(0); if (PC.audio) PC.audio.play('title'); }
          break;
      }

      if (this.state !== 'play' && this.state !== 'ready') W.time++;
    },

    tryJoin: function () {
      for (var i = 0; i < 2; i++) {
        if (!this.players[i] && PC.input.p[i].pressed.start) this.startPressed(i);
      }
    },

    /* Death, respawn, and the point at which the machine stops being polite.
     * A slot only empties when that player is out of lives, so "both slots
     * empty" is exactly the game-over condition and nothing else needs to
     * agree with it. */
    checkPlayers: function () {
      for (var i = 0; i < 2; i++) {
        var p = this.players[i];
        if (!p || !p.dead) continue;
        if (!p.removed) continue;                 // still falling over
        if (this.respawnT[i] <= 0) { this.respawnT[i] = 70; continue; }
        if (--this.respawnT[i] > 0) continue;
        this.lives[i]--;
        if (this.lives[i] > 0) {
          var x = M.clamp(W.camX + PC.W * 0.3, W.camX + 20, W.camX + PC.W - 20);
          p.reviveAt(x, PC.FLOOR_BOT - 16);
          W.add(p);
          // being sent back out with no clock left is not a life, it is a joke
          if (PC.stage.timeLeft <= 0) PC.stage.timeLeft = 30;
        } else {
          this.players[i] = null;
          if (i === 1) PC.input.p2Joined = false;
        }
      }
      if (!this.players[0] && !this.players[1] && this.state === 'play') {
        this.setState('over');
        if (PC.audio) PC.audio.play('gameover');
      }
    },

    doContinue: function (i) {
      this.credits--;
      this.lives[i] = 3;
      var p = this.players[i];
      if (!p) {
        p = new PC.Player(i, HERO[i]);
        this.players[i] = p;
        if (i === 1) PC.input.p2Joined = true;
      }
      // Put the street back the way it was and re-run the fight you lost.
      for (var k = W.actors.length - 1; k >= 0; k--) if (W.actors[k].team === 1) W.actors.splice(k, 1);
      W.tokenHolders.length = 0;
      p.reviveAt(W.camX + PC.W * 0.3, PC.FLOOR_BOT - 16);
      if (W.actors.indexOf(p) < 0) W.add(p);
      PC.stage.timeLeft = PC.stage.def.time;
      if (PC.stage.active) PC.stage.startEncounter(PC.stage.active);
      this.paused = false;
      this.setState('play');
      if (PC.audio) PC.audio.play(PC.stage.def.music);
    },

    stageClear: function () {
      this.setState('clear');
      for (var i = 0; i < 2; i++) if (this.players[i]) this.players[i].celebrate = true;
      if (PC.audio) PC.audio.play('clear');
    },

    nextStage: function () {
      this.stageIndex++;
      if (this.stageIndex >= PC.STAGES.length) {
        this.ended = true;
        for (var q = 0; q < 2; q++) if (this.players[q]) this.players[q].celebrate = true;
        this.setState('ending');
        if (PC.audio) PC.audio.play('ending');
        return;
      }
      var keep = [];
      for (var i = 0; i < 2; i++) {
        var p = this.players[i];
        if (p) { p.hp = p.maxHp; keep.push(p); }
      }
      PC.stage.load(this.stageIndex);
      for (var k = 0; k < keep.length; k++) {
        keep[k].celebrate = false;
        keep[k].reviveAt(60 + k * 26, PC.FLOOR_BOT - 16 - k * 8);
        W.add(keep[k]);
      }
      this.setState('ready');
    },

    saveHi: function () {
      if (this.hiScore > (PC.save.read().hiScore || 0)) PC.save.merge({ hiScore: this.hiScore });
    },

    toggleFullscreen: function () {
      var el = document.documentElement;
      if (!document.fullscreenElement) { if (el.requestFullscreen) el.requestFullscreen(); }
      else if (document.exitFullscreen) document.exitFullscreen();
    },

    // --------------------------------------------------------------- drawing
    render: function () {
      var ctx = PC.Screen.ctx;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, PC.W, PC.H);

      if (this.state === 'title') this.renderTitle(ctx);
      else this.renderWorld(ctx);

      if (FX.flashT > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.8, FX.flashT / 6);
        ctx.fillStyle = FX.flashCol;
        ctx.fillRect(0, 0, PC.W, PC.H);
        ctx.restore();
      }
      PC.Screen.present();
    },

    renderWorld: function (ctx) {
      var sx = Math.round(FX.shakeX), sy = Math.round(FX.shakeY);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, PC.FIELD_Y, PC.W, PC.FIELD_BOT - PC.FIELD_Y);
      ctx.clip();
      ctx.translate(sx, sy);
      PC.stage.draw(ctx);
      W.drawThreats(ctx);

      // ---- everything in the street, sorted back to front
      var draws = [], i;
      for (i = 0; i < W.actors.length; i++) {
        var a = W.actors[i];
        if (!a.removed) draws.push({ y: a.y, a: a });
      }
      for (i = 0; i < W.items.length; i++) {
        var it = W.items[i];
        if (!it.held && !it.dead) draws.push({ y: it.flying ? it.y + 0.5 : it.y, it: it });
      }
      draws.sort(function (p, q) { return p.y - q.y; });
      for (i = 0; i < draws.length; i++) {
        if (draws[i].a) draws[i].a.draw(ctx, W.camX);
        else PC.items.draw(ctx, draws[i].it, W.camX);
      }

      FX.draw(ctx, W.camX);
      PC.stage.drawArrow(ctx);
      PC.stage.drawBanner(ctx);
      Hud.drawAlerts(ctx, this);
      ctx.restore();

      Hud.drawTop(ctx, this);
      Hud.drawBottom(ctx, this);
      if (PC.stage.bossActive) Hud.drawBoss(ctx);

      this.renderOverlays(ctx);
    },

    renderOverlays: function (ctx) {
      var mid = PC.FIELD_Y + 74;
      var t = this.stateT;
      switch (this.state) {
        case 'ready':
          this.dim(ctx, 0.45);
          Hud.banner(ctx, [
            { t: 'STAGE ' + (PC.stage.index + 1), c: '#4ae06a', scale: 2 },
            { t: PC.stage.def.name, c: '#ffffff', scale: 3 }
          ], mid - 20);
          Art.text(ctx, PC.stage.def.intro, PC.W / 2, mid + 34, '#c8d0e8', { align: 'center' });
          if (t > 110 && (t >> 3) % 2) {
            Art.text(ctx, 'READY', PC.W / 2, mid + 52, '#ffe070', { align: 'center', scale: 2 });
          }
          break;
        case 'clear':
          this.dim(ctx, 0.4);
          Hud.banner(ctx, [{ t: 'STAGE CLEAR', c: '#ffe070', scale: 3 }], mid - 16);
          if (t > 40) {
            Art.text(ctx, 'TIME BONUS  ' + PC.pad(PC.stage.timeLeft * 100, 5), PC.W / 2, mid + 24, '#ffffff', { align: 'center' });
          }
          break;
        case 'over':
          this.dim(ctx, 0.55);
          Hud.banner(ctx, [{ t: 'GAME OVER', c: '#ff4a4a', scale: 3 }], mid - 10);
          break;
        case 'continue':
          this.dim(ctx, 0.6);
          var n = Math.max(0, Math.ceil(this.continueT / 60));
          Hud.banner(ctx, [{ t: 'CONTINUE?', c: '#ffffff', scale: 3 }], mid - 26);
          Art.text(ctx, String(n), PC.W / 2, mid + 10, n <= 3 ? '#ff4a4a' : '#ffe070', { align: 'center', scale: 4 });
          if ((t >> 4) % 2) {
            Art.text(ctx, 'PRESS 1 TO CONTINUE', PC.W / 2, mid + 54, '#4aa8ff', { align: 'center' });
          }
          break;
        case 'ending':
          this.renderEnding(ctx);
          break;
      }
      if (this.paused) {
        this.dim(ctx, 0.6);
        Hud.banner(ctx, [{ t: 'PAUSED', c: '#ffffff', scale: 3 }], mid - 30);
        Art.text(ctx, 'HOLD Z / J: COMBO + PICK UP + THROW', PC.W / 2, mid + 15, '#e3edf8', { align: 'center' });
        Art.text(ctx, 'X / K: BREAKOUT  (WHEN THE BAR IS FULL)', PC.W / 2, mid + 31, '#ffe57a', { align: 'center' });
        Art.text(ctx, 'SPACE / C: JUMP KICK', PC.W / 2, mid + 47, '#e3edf8', { align: 'center' });
        Art.text(ctx, 'ESC TO RESUME', PC.W / 2, mid + 77, '#65e0ec', { align: 'center' });
      }
    },

    dim: function (ctx, a) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#000010';
      ctx.fillRect(0, PC.FIELD_Y, PC.W, PC.FIELD_BOT - PC.FIELD_Y);
      ctx.restore();
    },

    renderEnding: function (ctx) {
      this.dim(ctx, 0.7);
      var lines = [
        'THE TOWER GOES QUIET.',
        '',
        'YOUR BROTHER CAN WALK. JUST ABOUT.',
        'THE GANG IS FINISHED, AND THE BLOCK IS',
        'YOURS AGAIN - FOR TONIGHT, ANYWAY.',
        '',
        'SOMEWHERE DOWNTOWN A NEON SIGN',
        'FLICKERS BACK ON.',
        '',
        'THANK YOU FOR PLAYING'
      ];
      var y = PC.FIELD_Y + 26;
      for (var i = 0; i < lines.length; i++) {
        if (this.stateT < 30 + i * 26) break;
        Art.text(ctx, lines[i], PC.W / 2, y + i * 12, i === lines.length - 1 ? '#ffe070' : '#ffffff', { align: 'center' });
      }
      if (this.stateT > 300) {
        Art.text(ctx, 'FINAL SCORE  ' + PC.pad(Math.max(this.scores[0], this.scores[1]), 6),
          PC.W / 2, PC.FIELD_BOT - 22, '#4ae06a', { align: 'center' });
      }
    },

    // ----------------------------------------------------------------- title
    renderTitle: function (ctx) {
      var t = this.stateT, mid = PC.W / 2;
      W.camX = 0;
      PC.stage.draw(ctx);
      Art.rect(ctx, 0, 0, PC.W, PC.H, 'rgba(6,9,25,0.68)');
      // Offset stripes and an oversized condensed marquee: a 1991 cabinet flyer.
      for (var k = 0; k < 5; k++) {
        Art.rect(ctx, 0, 40 + k * 5, 104 - k * 9, 2, '#bd476b');
        Art.rect(ctx, PC.W - 104 + k * 9, 98 + k * 5, 104, 2, '#3d89a3');
      }
      Art.text(ctx, 'ONE NIGHT. FOUR BLOCKS. YOUR CITY.', mid, 18, '#f2b46f', { align: 'center', tracking: 2 });
      Art.text(ctx, 'POWER', mid + 3, 48, '#8f294d', { align: 'center', scale: 7, tracking: 1 });
      Art.text(ctx, 'POWER', mid, 43, '#ffe2a0', { align: 'center', scale: 7, tracking: 1 });
      Art.text(ctx, 'CITY', mid + 3, 104, '#284e83', { align: 'center', scale: 7, tracking: 4 });
      Art.text(ctx, 'CITY', mid, 99, '#65e0ec', { align: 'center', scale: 7, tracking: 4 });
      PC.rig.draw(ctx, PC.rig.frame('hero1', 'taunt'), 68, 206, false);
      PC.rig.draw(ctx, PC.rig.frame('hero2', 'idle'), PC.W - 68, 206, true);
      Art.text(ctx, 'THE MIDNIGHT RESCUE', mid, 158, '#faf0db', { align: 'center', tracking: 2 });
      Art.rect(ctx, mid - 99, 181, 198, 25, '#ed6187');
      Art.text(ctx, 'ENTER / TAP TO PLAY', mid, 190, '#11162a', { align: 'center' });
      Art.text(ctx, 'HOLD ATTACK. JUMP KICK. BREAK OUT.', mid, 222, '#e3edf8', { align: 'center' });
      Art.text(ctx, 'SOLO OR CO-OP    /    FREE PLAY', mid, 242, '#8299b8', { align: 'center' });
      W.time++; FX.update();
    }
  };

  PC.boot = function () { G.boot(); };

})(typeof window !== 'undefined' ? window : globalThis);
