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
      return {
        hp: (1 + s * 0.16) * (n > 1 ? 1.28 : 1),
        dmg: 0.7 + s * 0.14,
        aggr: 0.85 + s * 0.07,
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

    timeUp: function () {
      for (var i = 0; i < 2; i++) {
        var p = this.players[i];
        if (!p || p.dead) continue;
        p.invuln = 0;
        p.takeHit({ dmg: 999, dir: -p.facing, knock: true, x: p.x, y: p.y - 20, stun: 20, push: 2 });
      }
      PC.stage.timeLeft = 0;
    },

    // ---------------------------------------------------------------- coins
    coin: function () {
      this.credits = Math.min(99, this.credits + 1);
      if (PC.audio) PC.audio.sfx('coin');
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
          if (anyStart || anyStart2) {
            if (this.credits <= 0) this.coin();
            this.startGame(anyStart ? 0 : 1);
          }
          break;

        case 'ready':
          if (this.stateT === 1 && PC.audio) PC.audio.play(PC.stage.def.music);
          if (this.stateT > 150) this.setState('play');
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
          if (this.stateT > 260) this.nextStage();
          break;

        case 'over':
          W.update();
          if (this.stateT > 90) { this.setState('continue'); this.continueT = 10 * 60; }
          break;

        case 'continue':
          W.update();
          this.continueT--;
          if ((anyStart || anyStart2) && this.credits > 0) {
            this.doContinue(anyStart ? 0 : 1);
          } else if (anyStart || anyStart2) {
            this.coin();
          }
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
        if (!this.players[i] && PC.input.p[i].pressed.start) {
          if (this.credits <= 0) this.coin();
          this.joinPlayer(i);
        }
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
        Hud.banner(ctx, [{ t: 'PAUSED', c: '#ffffff', scale: 3 }], mid - 10);
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
      var t = this.stateT;
      // the city rolls past behind the logo
      W.camX = this.attractX % Math.max(1, (PC.stage.def.length - PC.W));
      PC.stage.draw(ctx);
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#04040e';
      ctx.fillRect(0, PC.FIELD_Y, PC.W, PC.FIELD_BOT - PC.FIELD_Y);
      ctx.restore();
      Art.rect(ctx, 0, 0, PC.W, PC.HUD_TOP, '#000000');
      Art.rect(ctx, 0, PC.FIELD_BOT, PC.W, PC.H - PC.FIELD_BOT, '#000000');

      // a band behind the writing so the brickwork never eats it
      Art.rect(ctx, 0, PC.FIELD_BOT - 48, PC.W, 48, 'rgba(4,4,14,0.84)');
      var mid = PC.W / 2, ly = PC.FIELD_Y + 18;
      // logo: a heavy shadow, a red plate, a white face
      Art.text(ctx, 'POWER', mid + 2, ly + 3, '#3a0a12', { align: 'center', scale: 5, tracking: 2 });
      Art.text(ctx, 'POWER', mid, ly, '#e02030', { align: 'center', scale: 5, tracking: 2 });
      Art.text(ctx, 'POWER', mid, ly - 2, '#ff9a40', { align: 'center', scale: 5, tracking: 2 });
      Art.text(ctx, 'CITY', mid + 2, ly + 42, '#0a1a3a', { align: 'center', scale: 5, tracking: 2 });
      Art.text(ctx, 'CITY', mid, ly + 39, '#2f6ef0', { align: 'center', scale: 5, tracking: 2 });
      Art.text(ctx, 'CITY', mid, ly + 37, '#7fd8f0', { align: 'center', scale: 5, tracking: 2 });
      Art.text(ctx, 'A NIGHT ON THE TOWN', mid, ly + 78, '#ffffff', { align: 'center', tracking: 2, shadow: '#000000' });

      if ((t >> 4) % 2) {
        Art.text(ctx, this.credits > 0 ? 'PRESS 1 PLAYER START' : 'INSERT COIN  (PRESS 5)',
          mid, PC.FIELD_BOT - 40, this.credits > 0 ? '#ffe070' : '#4aa8ff', { align: 'center' });
      }
      Art.text(ctx, '1 OR 2 PLAYERS', mid, PC.FIELD_BOT - 26, '#c8d0e8', { align: 'center' });
      Art.text(ctx, '(C) 1988 POWER CITY WORKS', mid, PC.FIELD_BOT - 12, '#6a7290', { align: 'center' });

      Hud.drawTop(ctx, this);
      Hud.drawBottom(ctx, this);
      // the empty half of the marquee earns its keep by teaching the moves
      var hints = [
        'PUNCH THREE TIMES FOR A KNOCKDOWN',
        'PUNCH AND KICK TOGETHER TO SPIN',
        'GET CLOSE AND PUNCH TO GRAB',
        'KICK OUT OF A GRAB TO THROW THEM',
        'DOUBLE-TAP TO RUN, THEN PUNCH',
        'PICK UP BATS, PIPES AND CRATES',
        'JUMP, THEN KICK, ON THE WAY DOWN'
      ];
      Art.text(ctx, 'HOW TO PLAY', mid, 27, '#ff8a3a', { align: 'center' });
      Art.text(ctx, hints[Math.floor(t / 170) % hints.length], mid, 40, '#ffffff', { align: 'center' });

      W.time++;
      FX.update();
    }
  };

  PC.boot = function () { G.boot(); };

})(typeof window !== 'undefined' ? window : globalThis);
