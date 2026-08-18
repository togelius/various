/* POWER CITY - bats, knives, crates, oil drums and the odd roast chicken.
 *
 * One entity type covers all of it. A thing lies on the floor until someone
 * picks it up; then it either swings from a hand (a weapon) or rides overhead
 * (a crate). Thrown, it flies until it meets a body or the ground, and what
 * happens next is a property of the thing, not a special case in the player.
 */
(function (global) {
  'use strict';
  var PC = global.PC || (global.PC = {});
  var M = PC.math, FX = PC.fx, Art = PC.art;
  var W = PC.world;

  // One white copy per canvas, made once and kept.
  var whites = [], whiteOut = [];
  function whiteCopy(cv) {
    var i = whites.indexOf(cv);
    if (i >= 0) return whiteOut[i];
    whites.push(cv);
    whiteOut.push(Art.solid(cv, '#ffffff'));
    return whiteOut[whiteOut.length - 1];
  }

  var Items = PC.items = {

    spawn: function (kind, key, x, y, opts) {
      opts = opts || {};
      var def = kind === 'weapon' ? PC.weapons[key] : (kind === 'prop' ? PC.props[key] : PC.pickups[key]);
      var it = {
        kind: kind, key: key, def: def,
        x: x, y: y, z: opts.z || 0,
        vx: opts.vx || 0, vy: 0, vz: opts.vz || 0,
        held: null, flying: false, spin: 0, spinV: 0,
        hp: kind === 'prop' ? (PC.props[key].hp) : undefined,
        dead: false, life: opts.life || 0, blink: 0, thrower: null
      };
      W.addItem(it);
      return it;
    },

    canvasOf: function (it) {
      if (it.kind === 'weapon') return PC.weapons[it.key].canvas;
      if (it.kind === 'prop') return PC.props[it.key].canvas;
      return PC.pickups[it.key] ? PC.pickups[it.key].canvas : null;
    },

    // ---------------------------------------------------------------- picking
    /* The nearest thing an actor could reasonably bend down and take. */
    nearest: function (a, range) {
      var best = null, bd = range || 18;
      for (var i = 0; i < W.items.length; i++) {
        var it = W.items[i];
        if (it.held || it.dead || it.flying || it.z > 6) continue;
        var d = Math.abs(it.x - a.x) + Math.abs(it.y - a.y) * 0.8;
        if (d < bd) { bd = d; best = it; }
      }
      return best;
    },

    take: function (a, it) {
      if (it.kind === 'pickup') {
        this.consume(a, it);
        return true;
      }
      if (a.weapon || a.carry) return false;
      it.held = a;
      if (it.kind === 'weapon') { a.weapon = it.key; a.ammo = PC.weapons[it.key].ammo; a.weaponItem = it; }
      else { a.carry = it; }
      if (PC.audio) PC.audio.sfx('pickup');
      return true;
    },

    consume: function (a, it) {
      var d = PC.pickups[it.key];
      it.dead = true;
      if (d.heal) {
        a.hp = Math.min(a.maxHp, a.hp + d.heal);
        FX.pop(a.x, a.y - a.hh - 6, 'ENERGY', '#ff6a7a');
        if (PC.audio) PC.audio.sfx('heal');
      }
      if (d.score && a.addScore) a.addScore(d.score);
      FX.ring(it.x, it.y - 6, '#ffe070');
    },

    drop: function (a) {
      var it = a.carry || a.weaponItem;
      if (!it) return;
      it.held = null;
      it.x = a.x + a.facing * 6;
      it.y = a.y;
      it.z = a.carry ? 22 : 6;
      it.vx = a.facing * 0.4; it.vz = 0;
      a.carry = null; a.weapon = null; a.weaponItem = null; a.ammo = 0;
    },

    /* Throwing. A crate arcs, a knife flies flat, and both keep the thrower's
     * id so they cannot hit the hand that threw them. */
    hurl: function (a) {
      var it = a.carry || a.weaponItem;
      if (!it) return false;
      it.held = null;
      it.flying = true;
      it.thrower = a;
      it.x = a.x + a.facing * 10;
      it.y = a.y;
      it.z = a.carry ? 26 : 20;
      if (a.carry) { it.vx = a.facing * 4.2; it.vz = 0.8; it.spinV = a.facing * 0.22; }
      else { it.vx = a.facing * 5.4; it.vz = 0.15; it.spinV = a.facing * 0.5; }
      it.dmg = a.carry ? PC.props[it.key].dmg : (PC.weapons[it.key].dmg + 4);
      a.carry = null;
      if (a.weaponItem === it) { a.weapon = null; a.weaponItem = null; a.ammo = 0; }
      if (PC.audio) PC.audio.sfx('whoosh');
      return true;
    },

    damage: function (it, dmg, dir) {
      if (it.hp === undefined || it.dead) return;
      it.hp -= dmg;
      it.flashT = 4;
      if (it.hp <= 0) this.smash(it, dir);
      else { it.vx = dir * 0.8; it.z = Math.max(it.z, 1); it.vz = 1.2; }
    },

    smash: function (it, dir) {
      it.dead = true;
      if (PC.props[it.key] && PC.props[it.key].explodes) {
        FX.boom(it.x, it.y - 10);
        if (PC.audio) PC.audio.sfx('boom');
        // an oil drum takes the block with it
        for (var i = 0; i < W.actors.length; i++) {
          var t = W.actors[i];
          if (t.removed || t.dead) continue;
          if (Math.abs(t.x - it.x) > 34 || Math.abs(t.y - it.y) > 20) continue;
          t.takeHit({
            dmg: 16, dir: M.sign(t.x - it.x) || 1, knock: true, stun: 20, push: 2,
            x: t.x, y: t.y - 20, heavy: true, from: it.thrower
          });
        }
      } else {
        if (PC.audio) PC.audio.sfx('crash');
        FX.dust(it.x, it.y - 6, dir || 1, 8);
        for (var k = 0; k < 6; k++) {
          FX.add({
            t: 0, life: PC.rand.int(14, 26), kind: 'spark', x: it.x, y: it.y - 8,
            vx: PC.rand.range(-2, 2), vy: -PC.rand.range(0.5, 2), g: 0.16, col: '#b0762e'
          });
        }
        // a smashed crate sometimes had something in it
        if (PC.rand.chance(0.4)) {
          Items.spawn('pickup', PC.rand.chance(0.6) ? 'heart' : 'coin', it.x, it.y, { z: 6 });
        }
      }
    },

    // ---------------------------------------------------------------- stepping
    update: function () {
      for (var i = W.items.length - 1; i >= 0; i--) {
        var it = W.items[i];
        if (it.dead) { W.items.splice(i, 1); continue; }
        if (it.flashT > 0) it.flashT--;
        if (it.held) continue;

        if (it.flying) {
          it.x += it.vx; it.z += it.vz; it.vz -= 0.16; it.spin += it.spinV;
          if (this.flyingHit(it)) continue;
          if (it.z <= 0) {
            it.z = 0; it.flying = false; it.vx = 0; it.spin = 0;
            if (it.hp !== undefined) this.smash(it, M.sign(it.vx) || 1);
            else { FX.dust(it.x, it.y, 1, 3); if (PC.audio) PC.audio.sfx('clank'); }
          }
        } else if (it.z > 0 || it.vz !== 0) {
          it.z += it.vz; it.vz -= 0.26; it.x += it.vx; it.vx *= 0.9;
          if (it.z <= 0) { it.z = 0; it.vz = 0; it.vx = 0; }
        }

        if (it.kind === 'pickup') {
          it.life++;
          if (it.life > 620) it.blink = 1;
          if (it.life > 780) it.dead = true;
        }
        if (it.x < W.minX + 4 || it.x > W.maxX - 4) { it.x = M.clamp(it.x, W.minX + 4, W.maxX - 4); if (it.flying) it.vx = 0; }
      }
    },

    flyingHit: function (it) {
      for (var i = 0; i < W.actors.length; i++) {
        var t = W.actors[i];
        if (t.removed || t.dead || t === it.thrower) continue;
        if (it.thrower && t.team === it.thrower.team) continue;
        if (t.invuln > 0 || t.state === 'down') continue;
        if (Math.abs(t.y - it.y) > 12) continue;
        if (Math.abs(t.x - it.x) > t.hw + 7) continue;
        if (it.z > t.z + t.hh || it.z + 8 < t.z) continue;
        t.takeHit({
          dmg: it.dmg || 12, dir: M.sign(it.vx) || 1, knock: true, stun: 22, push: 2.4,
          x: it.x, y: t.y - t.hh * 0.6, heavy: true, from: it.thrower
        });
        PC.freeze(7);
        FX.hit(it.x, t.y - t.hh * 0.6, true);
        if (PC.audio) PC.audio.sfx('hitHeavy');
        it.flying = false;
        if (it.hp !== undefined) { this.smash(it, M.sign(it.vx)); return true; }
        it.vx = -it.vx * 0.2; it.vz = 1;
        return false;
      }
      return false;
    },

    // ------------------------------------------------------------------ drawing
    drawHeld: function (ctx, a, frame, px, py) {
      var def = PC.weapons[a.weapon];
      if (!def || !def.canvas) return;
      var f = frame;
      var hx = px + a.facing * f.handX, hy = py - f.handY;
      /* The angle is measured in the figure's own (always right-facing)
       * space; the mirror below takes care of the other direction, and
       * measuring it in screen space instead would flip the swing. */
      var ang = Math.atan2(-(f.handY - f.elbowY), f.handX - f.elbowX);
      ctx.save();
      ctx.translate(Math.round(hx), Math.round(hy));
      if (a.facing < 0) ctx.scale(-1, 1);
      ctx.rotate(ang);
      ctx.drawImage(def.canvas, -def.grip[0] - 1, -def.grip[1] - 1);
      ctx.restore();
    },

    drawCarried: function (ctx, a, px, py) {
      var cv = PC.props[a.carry.key].canvas;
      if (!cv) return;
      ctx.drawImage(cv, Math.round(px - cv.width / 2), Math.round(py - 44 * a.scale - cv.height + 6));
    },

    draw: function (ctx, it, camX) {
      var cv = it.kind === 'weapon' ? PC.weapons[it.key].canvas
        : it.kind === 'prop' ? PC.props[it.key].canvas
          : PC.pickups[it.key].canvas;
      if (!cv) return;
      if (it.blink && (W.time >> 2) % 2) return;
      var px = Math.round(it.x - camX), py = Math.round(it.y - it.z);
      if (!it.flying && it.z < 1) Art.shadow(ctx, px, it.y, cv.width * 0.4, 0.3);
      else Art.shadow(ctx, px, it.y, cv.width * 0.3, 0.2);
      var bob = it.kind === 'pickup' ? Math.round(Math.sin(W.time * 0.09) * 1.5) : 0;
      ctx.save();
      ctx.translate(px, py + bob);
      if (it.spin) ctx.rotate(it.spin);
      if (it.flashT > 0 && it.flashT % 2) {
        ctx.drawImage(whiteCopy(cv), -Math.round(cv.width / 2), -cv.height + 2);
      } else {
        ctx.drawImage(cv, -Math.round(cv.width / 2), -cv.height + 2);
      }
      ctx.restore();
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
