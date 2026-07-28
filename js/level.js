/* VANGUARD ZERO - tilemap, collision, camera and the terrain renderer.
 *
 * Static terrain is baked once into a full-level canvas at load, so drawing a
 * screen costs one blit instead of ~400 tile draws. Only tiles that change
 * (crumbling blocks, conveyors, liquid surfaces, boss doors) are drawn live.
 */
(function (global) {
  'use strict';
  var VZ = global.VZ || (global.VZ = {});
  var T = VZ.TILE, M = VZ.math, A = VZ.art;

  var TL = VZ.tiles = {
    EMPTY: 0, SOLID: 1, PLATFORM: 2, SPIKE_UP: 3, SPIKE_DOWN: 4,
    LIQUID: 5, CRUMBLE: 6, CONV_R: 7, CONV_L: 8, DOOR: 9, SPIKE_L: 10, SPIKE_R: 11
  };

  var LEGEND = {
    '#': TL.SOLID,
    '=': TL.PLATFORM,
    '^': TL.SPIKE_UP,
    'v': TL.SPIKE_DOWN,
    '[': TL.SPIKE_R,   // spikes protruding right from a wall
    ']': TL.SPIKE_L,
    '~': TL.LIQUID,
    'c': TL.CRUMBLE,
    '>': TL.CONV_R,
    '{': TL.CONV_L,
    '|': TL.DOOR
  };

  // Characters that are entity spawns rather than terrain.
  var SPAWNS = {
    'P': 'start', 'K': 'checkpoint', 'X': 'exit', 'B': 'bossgate',
    'T': 'trooper', 'D': 'drone', 'O': 'hopper', 'S': 'shielder',
    'U': 'turret', 'A': 'turretCeil', 'R': 'roller', 'F': 'flamer',
    'H': 'health', 'E': 'energy', '1': 'life', '@': 'bigHealth'
  };

  function isSolidId(id) {
    return id === TL.SOLID || id === TL.CRUMBLE || id === TL.CONV_R ||
           id === TL.CONV_L || id === TL.DOOR;
  }
  function isHazardId(id) {
    return id === TL.SPIKE_UP || id === TL.SPIKE_DOWN ||
           id === TL.SPIKE_L || id === TL.SPIKE_R;
  }

  // ===========================================================================
  var Level = VZ.Level = function (data) {
    this.data = data;
    this.theme = data.theme;
    this.name = data.name;
    this.tileset = A.buildTileset(data.theme);
    this.bg = A.buildBackground(data.theme);

    var rows = data.map;
    this.h = rows.length;
    this.w = 0;
    var y, x;
    for (y = 0; y < this.h; y++) this.w = Math.max(this.w, rows[y].length);

    this.grid = new Uint8Array(this.w * this.h);
    this.spawns = [];
    this.start = { x: 32, y: 32 };
    this.exit = null;
    this.bossGate = null;
    this.checkpoints = [];

    for (y = 0; y < this.h; y++) {
      var row = rows[y];
      for (x = 0; x < row.length; x++) {
        var ch = row[x];
        if (ch === ' ' || ch === '.') continue;
        var tile = LEGEND[ch];
        if (tile !== undefined) { this.grid[y * this.w + x] = tile; continue; }
        var sp = SPAWNS[ch];
        if (!sp) continue;
        var wx = x * T + T / 2, wy = y * T + T;
        if (sp === 'start') { this.start = { x: wx, y: wy }; }
        else if (sp === 'exit') { this.exit = { x: wx, y: wy, tx: x, ty: y }; }
        else if (sp === 'bossgate') { this.bossGate = { x: x * T, y: y * T, tx: x, ty: y }; }
        else if (sp === 'checkpoint') { this.checkpoints.push({ x: wx, y: wy, tx: x, ty: y, taken: false }); }
        else this.spawns.push({ kind: sp, x: wx, y: wy, tx: x, ty: y });
      }
    }

    this.pixelW = this.w * T;
    this.pixelH = this.h * T;

    // Per-tile crumble state (0 = intact, >0 = crumbling timer, -1 = gone).
    this.crumble = {};
    // Boss doors stand open until the fight starts, then seal the arena.
    this.doorsShut = false;

    this.bake();
    this.ambient = [];
    this.time = 0;
  };

  Level.prototype.idx = function (tx, ty) { return ty * this.w + tx; };

  Level.prototype.at = function (tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) {
      // Outside the map: walls on the sides, open above, open below (a pit).
      if (ty >= this.h) return TL.EMPTY;
      if (tx < 0 || tx >= this.w) return TL.SOLID;
      return TL.EMPTY;
    }
    var id = this.grid[ty * this.w + tx];
    if (id === TL.CRUMBLE && this.crumble[tx + ',' + ty] === -1) return TL.EMPTY;
    if (id === TL.DOOR && !this.doorsShut) return TL.EMPTY;
    return id;
  };

  Level.prototype.solidAt = function (tx, ty) { return isSolidId(this.at(tx, ty)); };

  Level.prototype.solidAtPx = function (px, py) {
    return this.solidAt(Math.floor(px / T), Math.floor(py / T));
  };

  // True if any solid tile overlaps the rect.
  Level.prototype.rectSolid = function (x, y, w, h) {
    var x0 = Math.floor(x / T), x1 = Math.floor((x + w - 0.001) / T);
    var y0 = Math.floor(y / T), y1 = Math.floor((y + h - 0.001) / T);
    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) {
        if (this.solidAt(tx, ty)) return true;
      }
    }
    return false;
  };

  // Hazard/liquid queries used by damage checks.
  Level.prototype.rectHazard = function (x, y, w, h) {
    var x0 = Math.floor(x / T), x1 = Math.floor((x + w - 0.001) / T);
    var y0 = Math.floor(y / T), y1 = Math.floor((y + h - 0.001) / T);
    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) {
        var id = this.at(tx, ty);
        if (isHazardId(id)) return 'spike';
        if (id === TL.LIQUID) return 'liquid';
      }
    }
    return null;
  };

  Level.prototype.conveyorAt = function (x, y, w, h) {
    var x0 = Math.floor(x / T), x1 = Math.floor((x + w - 0.001) / T);
    var ty = Math.floor((y + h + 1) / T);
    for (var tx = x0; tx <= x1; tx++) {
      var id = this.at(tx, ty);
      if (id === TL.CONV_R) return 1;
      if (id === TL.CONV_L) return -1;
    }
    return 0;
  };

  // Called when the player stands on a crumbling block.
  Level.prototype.touchCrumble = function (x, y, w, h) {
    var x0 = Math.floor(x / T), x1 = Math.floor((x + w - 0.001) / T);
    var ty = Math.floor((y + h + 1) / T);
    for (var tx = x0; tx <= x1; tx++) {
      if (this.grid[this.idx(tx, ty)] === TL.CRUMBLE) {
        var k = tx + ',' + ty;
        if (this.crumble[k] === undefined) {
          this.crumble[k] = 44;   // frames until it drops away
        }
      }
    }
  };

  Level.prototype.shutDoors = function () { this.doorsShut = true; };
  Level.prototype.openDoors = function () { this.doorsShut = false; };

  // ------------------------------------------------------------------- bake
  Level.prototype.bake = function () {
    var ts = this.tileset, t = ts.theme;
    var c = A.mk(this.pixelW, this.pixelH);
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    var mat = ts.material;

    for (var ty = 0; ty < this.h; ty++) {
      for (var tx = 0; tx < this.w; tx++) {
        var id = this.grid[this.idx(tx, ty)];
        if (id === TL.EMPTY || id === TL.CRUMBLE || id === TL.CONV_R ||
            id === TL.CONV_L || id === TL.DOOR) continue;
        var px = tx * T, py = ty * T;

        if (id === TL.SOLID) {
          // Continuous material sampled by world position.
          x.drawImage(mat, (px % 64), (py % 64), T, T, px, py, T, T);
          var mask = 0;
          if (this.bakeSolid(tx, ty - 1)) mask |= 1;
          if (this.bakeSolid(tx + 1, ty)) mask |= 2;
          if (this.bakeSolid(tx, ty + 1)) mask |= 4;
          if (this.bakeSolid(tx - 1, ty)) mask |= 8;
          x.drawImage(ts.edges[mask], px, py);
          if (mask === 15) {
            // The deeper a tile sits below the surface, the darker it reads.
            var depth = 0;
            while (depth < 5 && this.bakeSolid(tx, ty - 1 - depth)) depth++;
            if (depth > 1) {
              x.globalAlpha = Math.min(0.36, (depth - 1) * 0.11);
              x.fillStyle = t.dark;
              x.fillRect(px, py, T, T);
              x.globalAlpha = 1;
            }
            if (((tx * 7 + ty * 13) % 11) === 0) {
              x.drawImage(ts.details[(tx + ty) % ts.details.length], px, py);
            }
          }
        } else if (id === TL.PLATFORM) {
          x.drawImage(ts.platform, px, py);
        } else if (id === TL.SPIKE_UP) {
          x.drawImage(ts.spike, px, py);
        } else if (id === TL.SPIKE_DOWN) {
          x.drawImage(A.flipV(ts.spike), px, py);
        } else if (id === TL.SPIKE_L || id === TL.SPIKE_R) {
          var rot = A.mk(T, T), rx = rot.getContext('2d');
          rx.translate(T / 2, T / 2);
          rx.rotate(id === TL.SPIKE_R ? -Math.PI / 2 : Math.PI / 2);
          rx.drawImage(ts.spike, -T / 2, -T / 2);
          x.drawImage(rot, px, py);
        } else if (id === TL.LIQUID) {
          // Body only; the animated surface is drawn live.
          var isTop = this.grid[this.idx(tx, ty - 1)] !== TL.LIQUID;
          var g = x.createLinearGradient(0, py, 0, py + T);
          if (this.theme === 'lava') {
            g.addColorStop(0, isTop ? '#ffd166' : '#e2541a');
            g.addColorStop(1, '#8c2408');
          } else if (this.theme === 'void') {
            g.addColorStop(0, isTop ? '#ff6fae' : '#8e2a6a');
            g.addColorStop(1, '#3a1040');
          } else {
            g.addColorStop(0, isTop ? '#8fd8ff' : '#3f7fc0');
            g.addColorStop(1, '#1a3a70');
          }
          x.fillStyle = g; x.fillRect(px, py, T, T);
        }
      }
    }
    this.baked = c;

    // A soft vignette baked into a separate overlay drawn after entities.
    this.liquidTops = [];
    for (var ly = 0; ly < this.h; ly++) {
      for (var lx = 0; lx < this.w; lx++) {
        if (this.grid[this.idx(lx, ly)] === TL.LIQUID &&
            this.grid[this.idx(lx, ly - 1)] !== TL.LIQUID) {
          this.liquidTops.push({ x: lx, y: ly });
        }
      }
    }
  };

  // Neighbour test used only while baking (ignores runtime crumble state).
  Level.prototype.bakeSolid = function (tx, ty) {
    if (tx < 0 || tx >= this.w) return true;   // treat map edges as solid
    if (ty < 0) return true;
    if (ty >= this.h) return false;
    var id = this.grid[this.idx(tx, ty)];
    // Liquid counts as covering, so submerged rock keeps its dark face
    // instead of sprouting a bright capstone under the pool.
    return id === TL.SOLID || id === TL.CRUMBLE || id === TL.LIQUID;
  };

  // ----------------------------------------------------------------- update
  Level.prototype.update = function (game) {
    this.time++;
    var k;
    for (k in this.crumble) {
      var v = this.crumble[k];
      if (v > 0) {
        this.crumble[k] = v - 1;
        if (v === 1) {
          var parts = k.split(',');
          var px = (+parts[0]) * T + T / 2, py = (+parts[1]) * T + T / 2;
          this.crumble[k] = -1;
          VZ.fx.burst(px, py, 10, {
            speed: 1.6, life: 30, size: 3, color: A.THEMES[this.theme].base, g: 0.3, drag: 0.98
          });
          VZ.audio.sfx('land', { vol: 0.7 });
          // Respawn the block after a while so the level stays traversable.
          var self = this;
          setTimeout(function () { if (self.crumble[k] === -1) delete self.crumble[k]; }, 2600);
        }
      }
    }
    this.updateAmbient();
  };

  Level.prototype.updateAmbient = function () {
    var r = VZ.rand;
    if (this.theme === 'lava' && this.time % 3 === 0) {
      this.ambient.push({ x: r.range(0, this.pixelW), y: this.pixelH, vy: -r.range(0.3, 0.9),
        vx: r.range(-0.2, 0.2), life: 150, color: r.chance(0.5) ? '#ff9c3a' : '#ffd166' });
    } else if (this.theme === 'sky' && this.time % 5 === 0) {
      this.ambient.push({ x: r.range(0, this.pixelW), y: -8, vy: r.range(0.25, 0.6),
        vx: r.range(-0.5, -0.1), life: 260, color: '#dfe9ff' });
    } else if (this.theme === 'void' && this.time % 4 === 0) {
      this.ambient.push({ x: r.range(0, this.pixelW), y: r.range(0, this.pixelH), vy: -r.range(0.15, 0.5),
        vx: 0, life: 120, color: r.chance(0.4) ? '#ff6fae' : '#5fe6d8' });
    }
    for (var i = this.ambient.length - 1; i >= 0; i--) {
      var a = this.ambient[i];
      a.x += a.vx; a.y += a.vy;
      if (--a.life <= 0) this.ambient.splice(i, 1);
    }
    if (this.ambient.length > 200) this.ambient.splice(0, this.ambient.length - 200);
  };

  // ----------------------------------------------------------------- render
  Level.prototype.drawBackground = function (ctx, camX, camY) {
    var i;
    for (i = 0; i < this.bg.length; i++) {
      var L = this.bg[i], cv = L.canvas;
      var ox = -(camX * L.factor) % cv.width;
      if (ox > 0) ox -= cv.width;
      var oy = -(camY * L.yFactor) + (L.yOff || 0);
      // Anchor the bottom of the layer near the bottom of the view.
      oy = Math.round(oy + (VZ.H - cv.height) * 0.55);
      for (var px = ox; px < VZ.W; px += cv.width) {
        ctx.drawImage(cv, Math.round(px), Math.round(oy));
      }
    }
  };

  Level.prototype.drawTerrain = function (ctx, camX, camY) {
    ctx.drawImage(this.baked,
      Math.round(camX), Math.round(camY), VZ.W, VZ.H,
      0, 0, VZ.W, VZ.H);

    var t = this.time;
    var tx0 = Math.floor(camX / T) - 1, tx1 = Math.ceil((camX + VZ.W) / T) + 1;
    var ty0 = Math.floor(camY / T) - 1, ty1 = Math.ceil((camY + VZ.H) / T) + 1;
    var ts = this.tileset;

    // --- dynamic tiles ---
    for (var ty = ty0; ty <= ty1; ty++) {
      for (var tx = tx0; tx <= tx1; tx++) {
        if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
        var id = this.grid[this.idx(tx, ty)];
        if (id !== TL.CRUMBLE && id !== TL.CONV_R && id !== TL.CONV_L && id !== TL.DOOR) continue;
        var px = Math.round(tx * T - camX), py = Math.round(ty * T - camY);

        if (id === TL.CRUMBLE) {
          var st = this.crumble[tx + ',' + ty];
          if (st === -1) continue;
          var stage = st === undefined ? 0 : (st > 30 ? 1 : (st > 14 ? 2 : 3));
          var jx = (st !== undefined && st < 30) ? Math.round(Math.sin(t * 1.4) * 1) : 0;
          ctx.drawImage(ts.crumble[stage], px + jx, py);
        } else if (id === TL.CONV_R || id === TL.CONV_L) {
          var dir = id === TL.CONV_R ? 1 : -1;
          var f = Math.floor(t * 0.35 * dir) & 3;
          ctx.drawImage(ts.conveyor[(f + 4) & 3], px, py);
        } else if (id === TL.DOOR) {
          if (!this.doorsShut) continue;
          this.drawDoorTile(ctx, px, py, tx, ty);
        }
      }
    }

    // --- animated liquid surface -------------------------------------
    // Two counter-phased wave bands plus a glow line; enough motion that a
    // large pool reads as molten rather than as a flat orange rectangle.
    var hot = this.theme === 'lava' ? '#ffe6a0' : (this.theme === 'void' ? '#ffb0dd' : '#cfeaff');
    var mid2 = this.theme === 'lava' ? '#ff9a30' : (this.theme === 'void' ? '#ff5aa8' : '#7fc4ff');
    for (var i = 0; i < this.liquidTops.length; i++) {
      var lt = this.liquidTops[i];
      var lx = lt.x * T - camX, ly = lt.y * T - camY;
      if (lx < -T || lx > VZ.W || ly < -T || ly > VZ.H) continue;
      var px2 = Math.round(lx), py2 = Math.round(ly);
      // slow swell + faster ripple, sampled per 4px column so it undulates
      for (var sx = 0; sx < T; sx += 4) {
        var wx = lt.x * T + sx;
        var w1 = Math.sin(t * 0.055 + wx * 0.055) * 1.6;
        var w2 = Math.sin(t * 0.12 - wx * 0.13) * 0.9;
        var yo = Math.round(w1 + w2);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = hot;
        ctx.fillRect(px2 + sx, py2 + yo, 4, 2);
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = mid2;
        ctx.fillRect(px2 + sx, py2 + yo + 2, 4, 3);
        ctx.globalAlpha = 0.18;
        ctx.fillRect(px2 + sx, py2 + yo + 5, 4, 4);
      }
      // occasional bubble breaking the surface
      if (((lt.x * 7 + Math.floor(t / 30)) % 17) === 0) {
        var bt = (t % 30) / 30;
        ctx.globalAlpha = (1 - bt) * 0.8;
        ctx.fillStyle = hot;
        ctx.fillRect(px2 + 6, py2 - Math.round(bt * 7), 3, 3);
      }
      ctx.globalAlpha = 1;
    }

    // --- ambient motes ---
    ctx.save();
    for (var a = 0; a < this.ambient.length; a++) {
      var am = this.ambient[a];
      var ax = Math.round(am.x - camX), ay = Math.round(am.y - camY);
      if (ax < -4 || ax > VZ.W + 4 || ay < -4 || ay > VZ.H + 4) continue;
      ctx.globalAlpha = Math.min(1, am.life / 60) * 0.8;
      ctx.fillStyle = am.color;
      ctx.fillRect(ax, ay, 1, this.theme === 'sky' ? 2 : 1);
    }
    ctx.restore();
  };

  // Sealed boss gate: dark shutter with an energy curtain running down it.
  Level.prototype.drawDoorTile = function (ctx, px, py, tx, ty) {
    var t = A.THEMES[this.theme];
    var C = VZ.color;
    ctx.fillStyle = C.shade(t.dark, -0.25);
    ctx.fillRect(px, py, T, T);
    ctx.fillStyle = C.shade(t.dark, 0.18);
    ctx.fillRect(px + 2, py, T - 4, T);
    // rivets down both jambs
    ctx.fillStyle = C.shade(t.dark, -0.5);
    ctx.fillRect(px, py, 2, T);
    ctx.fillRect(px + T - 2, py, 2, T);
    ctx.fillStyle = C.shade(t.light, 0.1);
    ctx.fillRect(px, py + 4, 1, 2);
    ctx.fillRect(px + T - 1, py + 4, 1, 2);
    // energy curtain
    var scroll = (this.time * 0.7) % 16;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = t.accent;
    ctx.fillRect(px + 3, py + ((scroll) | 0), T - 6, 2);
    ctx.globalAlpha = 0.28;
    ctx.fillRect(px + 3, py + ((scroll + 8) % 16 | 0), T - 6, 1);
    ctx.globalAlpha = 0.16 + Math.sin(this.time * 0.09 + ty) * 0.08;
    ctx.fillRect(px + 3, py, T - 6, T);
    ctx.globalAlpha = 1;
    // chevron
    ctx.fillStyle = C.shade(t.accent, -0.35);
    ctx.fillRect(px + 5, py + 6, 6, 1);
    ctx.fillRect(px + 6, py + 8, 4, 1);
  };

  // Foreground haze/tint for atmosphere, drawn after entities.
  Level.prototype.drawAtmosphere = function (ctx, camX, camY) {
    if (this.theme === 'lava') {
      ctx.globalAlpha = 0.09; ctx.fillStyle = '#ff6a1a';
      ctx.fillRect(0, 0, VZ.W, VZ.H);
    } else if (this.theme === 'void') {
      ctx.globalAlpha = 0.10; ctx.fillStyle = '#2a1050';
      ctx.fillRect(0, 0, VZ.W, VZ.H);
    }
    ctx.globalAlpha = 1;
    // Vignette: pulls the eye to the middle of the screen where the action is.
    if (!this._vig) {
      var v = A.mk(VZ.W, VZ.H), vx = v.getContext('2d');
      var g = vx.createRadialGradient(VZ.W / 2, VZ.H / 2, VZ.H * 0.34,
                                      VZ.W / 2, VZ.H / 2, VZ.W * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.42)');
      vx.fillStyle = g; vx.fillRect(0, 0, VZ.W, VZ.H);
      this._vig = v;
    }
    ctx.drawImage(this._vig, 0, 0);
  };

  // ----------------------------------------------------------------- camera
  var Camera = VZ.Camera = function (level) {
    this.level = level;
    this.x = 0; this.y = 0;
    this.tx = 0; this.ty = 0;
    this.lock = null;         // {x0,y0,x1,y1} bounds in pixels
    this.lookAhead = 0;
  };

  Camera.prototype.follow = function (e, instant) {
    var dzX = 26, dzY = 22;
    var cx = e.x, cy = e.y - 8;
    // Ease the look-ahead so the camera leads a running player.
    var want = (e.facing || 1) * (Math.abs(e.vx) > 1.2 ? 26 : 8);
    this.lookAhead = M.lerp(this.lookAhead, want, 0.06);
    cx += this.lookAhead;

    var tx = cx - VZ.W / 2;
    var ty = cy - VZ.H / 2;

    // Vertical: snap harder when grounded so falls don't drift the view.
    this.tx = tx;
    this.ty = ty;

    var lerpX = instant ? 1 : 0.14;
    var lerpY = instant ? 1 : (e.grounded ? 0.12 : 0.07);
    this.x = M.lerp(this.x, this.tx, lerpX);
    this.y = M.lerp(this.y, this.ty, lerpY);
    this.clamp();
  };

  Camera.prototype.clamp = function () {
    var minX = 0, minY = 0;
    var maxX = Math.max(0, this.level.pixelW - VZ.W);
    var maxY = Math.max(0, this.level.pixelH - VZ.H);
    if (this.lock) {
      minX = this.lock.x0; maxX = Math.max(this.lock.x0, this.lock.x1 - VZ.W);
      minY = this.lock.y0; maxY = Math.max(this.lock.y0, this.lock.y1 - VZ.H);
    }
    this.x = M.clamp(this.x, minX, maxX);
    this.y = M.clamp(this.y, minY, maxY);
  };

})(typeof window !== 'undefined' ? window : globalThis);
