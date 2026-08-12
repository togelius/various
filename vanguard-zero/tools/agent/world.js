/* VANGUARD ZERO - forward model of everything that is not the player.
 *
 * The player sim (sim.js) borrows the game's collision; this borrows the
 * game's *behaviour*. Enemies, bosses and projectiles are cloned into a
 * sandbox and advanced with their own real update() methods, in the order the
 * game runs them, so a turret's cadence, a hopper's arc, a flame vent's cycle
 * and a boss's attack script are all exactly right rather than linearly
 * extrapolated.
 *
 * Three things have to be contained for that to be safe:
 *
 *   - Particles and sound. Enemy code calls FX.* and VZ.audio.sfx directly, so
 *     speculation would spray the screen and the speakers. Both are silenced
 *     for the duration. FX is aliased into the game modules by reference at
 *     load, so the methods are swapped on the object rather than the object
 *     being replaced.
 *   - The random stream. Attack selection draws from VZ.rand, and a planner
 *     that draws from the live generator changes the future it is trying to
 *     predict. The state is saved and restored around every projection.
 *   - The game itself. Enemies reach for this.game.projectiles, .arena, .hud
 *     and a handful of callbacks; they get a stand-in that owns its own
 *     projectile list and does nothing on the callbacks.
 *
 * What comes out is a timeline: for each of the next N frames, the exact
 * hitboxes that could hurt the player, in the game's own damage terms. Scoring
 * a candidate path against it uses the same rule resolveCollisions uses.
 *
 * The projection is made once per decision, not once per candidate, with the
 * player pinned where it stands. Enemies that react to the player inside a
 * 0.7s horizon are therefore modelled as reacting to where it is now. That is
 * the one deliberate approximation left.
 *
 * Exposes window.AGENT.world.
 */
(function (global) {
  'use strict';
  var AGENT = global.AGENT || (global.AGENT = {});
  var VZ = global.VZ;
  var FX = VZ.fx;

  var NOOP = function () {};
  var FX_METHODS = ['spawn', 'burst', 'sparks', 'dust', 'ring', 'rings', 'explosion',
                    'shake', 'stop', 'flash', 'popup', 'squash', 'hitstop', 'tint'];

  /* Silence the world. Returns the restore. */
  function muzzle() {
    var savedFx = {}, savedSfx = VZ.audio.sfx, savedRand = null;
    for (var i = 0; i < FX_METHODS.length; i++) {
      var m = FX_METHODS[i];
      if (typeof FX[m] === 'function') { savedFx[m] = FX[m]; FX[m] = NOOP; }
    }
    VZ.audio.sfx = NOOP;
    if (VZ.rand.state) savedRand = VZ.rand.state();
    return function () {
      for (var k in savedFx) FX[k] = savedFx[k];
      VZ.audio.sfx = savedSfx;
      if (savedRand !== null && VZ.rand.setState) VZ.rand.setState(savedRand);
    };
  }

  /* A shallow clone that keeps the prototype, so update() is the real one.
   * Arrays are copied because several enemies push into their own (blades,
   * dash ghosts, segment trails) and we must not grow the live ones. */
  function clone(e, G) {
    var c = Object.create(Object.getPrototypeOf(e));
    for (var k in e) {
      if (!Object.prototype.hasOwnProperty.call(e, k)) continue;
      var v = e[k];
      c[k] = Array.isArray(v) ? v.slice() : v;
    }
    c.game = G;
    c.lv = G.level;
    return c;
  }

  // Everything an enemy reaches for through this.game.
  function sandbox(game, ghost) {
    return {
      level: game.level,
      arena: game.arena,
      player: ghost,
      projectiles: [],
      enemies: [],
      boss: null,
      playerControl: true,
      damageTaken: 0,
      hud: { flashEnergy: 0, weaponPop: 0 },
      onPlayerDeath: NOOP, onBossReady: NOOP,
      onBossDying: NOOP, onBossDefeated: NOOP
    };
  }

  /* Project the world forward.
   *
   * `frames` is how far, `radius` how far away an entity may be and still be
   * worth simulating - something 400px off cannot reach the player inside the
   * horizon, and skipping it is most of the cost.
   *
   * Returns an array of length frames+1; entry f is the list of hazard boxes
   * live on frame f, each {x, y, w, h, dmg} in the game's own box() terms.
   */
  function project(game, frames, radius) {
    var p = game.player;
    if (!p) return [];
    var restore = muzzle();
    var out = [];
    try {
      var ghost = Object.create(VZ.Entity.prototype);
      ghost.game = game; ghost.lv = game.level;
      ghost.x = p.x; ghost.y = p.y; ghost.w = p.w; ghost.h = p.h;
      ghost.dead = false; ghost.hp = p.hp; ghost.maxHp = p.maxHp;
      ghost.facing = p.facing; ghost.vx = 0; ghost.vy = 0;
      ghost.invuln = 0; ghost.dashTime = 0;
      ghost.takeHit = NOOP; ghost.kill = NOOP;

      var G = sandbox(game, ghost);
      var i;
      for (i = 0; i < game.enemies.length; i++) {
        var e = game.enemies[i];
        if (e.dead || e.remove) continue;
        if (Math.abs(e.x - p.x) > radius || Math.abs(e.y - p.y) > radius) continue;
        G.enemies.push(clone(e, G));
      }
      if (game.boss && !game.boss.remove) G.boss = clone(game.boss, G);
      for (i = 0; i < game.projectiles.length; i++) {
        var pr = game.projectiles[i];
        if (pr.remove || pr.team === 'player') continue;
        var c = clone(pr, G);
        c.hitList = [];
        G.projectiles.push(c);
      }

      for (var f = 0; f <= frames; f++) {
        out.push(collect(G));
        if (f === frames) break;
        stepWorld(G);
      }
    } finally {
      restore();
    }
    return out;
  }

  // The same order updatePlay runs in, minus everything that cannot hurt us.
  function stepWorld(G) {
    var i;
    for (i = G.enemies.length - 1; i >= 0; i--) {
      var e = G.enemies[i];
      try { e.update(); } catch (err) { e.remove = true; }
      if (e.remove) G.enemies.splice(i, 1);
    }
    if (G.boss) {
      try { G.boss.update(); } catch (err) { G.boss = null; }
      if (G.boss && G.boss.remove) G.boss = null;
    }
    for (i = G.projectiles.length - 1; i >= 0; i--) {
      var pr = G.projectiles[i];
      if (pr.warn > 0) { pr.warn--; if (pr.warn > 0) continue; }
      try { pr.update(); } catch (err) { pr.remove = true; }
      if (pr.remove) G.projectiles.splice(i, 1);
    }
  }

  /* Exactly what resolveCollisions would test the player against: live enemy
   * fire, and bodies that deal contact damage. */
  function collect(G) {
    var boxes = [], i;
    for (i = 0; i < G.projectiles.length; i++) {
      var pr = G.projectiles[i];
      if (pr.remove || pr.warn > 0) continue;
      var b = pr.box();
      boxes.push({ x: b.x, y: b.y, w: b.w, h: b.h, dmg: pr.damage || 1 });
    }
    var targets = G.enemies;
    for (i = 0; i < targets.length; i++) {
      var e = targets[i];
      if (e.dead || !(e.contactDamage > 0)) continue;
      var eb = e.box();
      boxes.push({ x: eb.x, y: eb.y, w: eb.w, h: eb.h, dmg: e.contactDamage });
    }
    var bs = G.boss;
    if (bs && !bs.dead && bs.contactDamage > 0 && !bs.dying && bs.state !== 'intro') {
      var bb = bs.box();
      boxes.push({ x: bb.x, y: bb.y, w: bb.w, h: bb.h, dmg: bs.contactDamage });
    }
    return boxes;
  }

  /* Score a trajectory against a timeline and return predicted hp lost.
   *
   * i-frames are the reason this is not just a count of overlaps: one hit buys
   * 72 frames of immunity, so brushing three enemies in a row costs exactly as
   * much as brushing one. A planner that does not know that will refuse routes
   * that are in fact free.
   */
  function damageAlong(timeline, traj, invulnAt0) {
    if (!timeline.length) return 0;
    var W = VZ.P.W, H = VZ.P.H, IFR = VZ.P.IFRAMES;
    var total = 0, invuln = invulnAt0 || 0;
    var n = Math.min(timeline.length, traj.length >> 1);
    for (var f = 0; f < n; f++) {
      if (invuln > 0) { invuln--; continue; }
      var px = traj[f * 2], py = traj[f * 2 + 1];
      var x0 = px - W / 2, y0 = py - H / 2;
      var boxes = timeline[f];
      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i];
        if (x0 < b.x + b.w && x0 + W > b.x && y0 < b.y + b.h && y0 + H > b.y) {
          total += b.dmg;
          invuln = IFR;
          break;
        }
      }
    }
    return total;
  }

  AGENT.world = { project: project, damageAlong: damageAlong };

})(typeof window !== 'undefined' ? window : globalThis);
