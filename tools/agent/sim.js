/* VANGUARD ZERO - forward physics model for the play agent.
 *
 * This mirrors Player.update()'s movement half, frame for frame and in the
 * same order. Collision is NOT duplicated: the sim body is an Object.create of
 * the game's own Entity.prototype and queries the live Level, so moveX/moveY/
 * checkGround are literally the game's routines. Only the velocity and state
 * bookkeeping is restated here, and sim-check.js proves it stays in step.
 *
 * Injected into the page; exposes window.AGENT.sim.
 */
(function (global) {
  'use strict';
  var AGENT = global.AGENT || (global.AGENT = {});
  var VZ = global.VZ;
  var P = VZ.P, M = VZ.math;

  function approach(v, t, s) {
    if (v < t) return Math.min(v + s, t);
    if (v > t) return Math.max(v - s, t);
    return t;
  }

  // ------------------------------------------------------------------ state
  function makeBody(level, x, y) {
    var b = Object.create(VZ.Entity.prototype);
    b.lv = level;
    b.w = P.W; b.h = P.H;
    b.x = x; b.y = y;
    return b;
  }

  function newState(level, x, y) {
    return {
      body: makeBody(level, x, y),
      vx: 0, vy: 0,
      grounded: true, facing: 1,
      dashTime: 0, dashCool: 0, airDash: true,
      coyote: P.COYOTE, ctrlLock: 0,
      wallStick: 0, wallDir: 0, wallCoyote: 0, lastWall: 0, noCut: 0,
      sliding: false,
      jumpBuf: 0, prevJump: false, prevDash: false,
      dead: null, frames: 0
    };
  }

  function cloneState(s) {
    var n = {
      body: makeBody(s.body.lv, s.body.x, s.body.y),
      vx: s.vx, vy: s.vy, grounded: s.grounded, facing: s.facing,
      dashTime: s.dashTime, dashCool: s.dashCool, airDash: s.airDash,
      coyote: s.coyote, ctrlLock: s.ctrlLock,
      wallStick: s.wallStick, wallDir: s.wallDir, wallCoyote: s.wallCoyote,
      lastWall: s.lastWall, noCut: s.noCut, sliding: s.sliding,
      jumpBuf: s.jumpBuf, prevJump: s.prevJump, prevDash: s.prevDash,
      dead: s.dead, frames: s.frames
    };
    return n;
  }

  /* One frame. `inp` = {left,right,jump,dash,down}. Mirrors the game's order:
   * timers -> dash -> horizontal -> conveyor -> gravity -> walls -> jump ->
   * jump-cut -> integrate -> ground -> hazards. */
  function step(s, inp) {
    var b = s.body, lv = b.lv;
    inp = inp || {};
    var jump = !!inp.jump, dash = !!inp.dash;
    var pressedJump = jump && !s.prevJump;
    var releasedJump = !jump && s.prevJump;
    var pressedDash = dash && !s.prevDash;
    s.prevJump = jump; s.prevDash = dash;

    // input buffer (Input.poll: 8 on press, else decay)
    if (pressedJump) s.jumpBuf = 8;
    else if (s.jumpBuf > 0) s.jumpBuf--;

    // --- timers
    if (s.dashCool > 0) s.dashCool--;
    if (s.ctrlLock > 0) s.ctrlLock--;

    var axRaw = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (inp.left && inp.right) axRaw = 0;         // opposing cancel
    var ax = s.ctrlLock <= 0 ? axRaw : 0;

    // --- dash
    if (s.dashTime > 0) {
      s.dashTime--;
      s.vx = s.facing * P.DASH_SPEED;
      if (!s.grounded && s.dashTime > 6 && !b.checkGround()) {
        s.dashTime = Math.min(s.dashTime, 6);
      }
    }
    if (pressedDash && s.dashCool <= 0 && s.dashTime <= 0) {
      if (s.grounded || s.airDash) {
        if (ax !== 0) s.facing = ax;
        s.dashTime = P.DASH_TIME;
        s.dashCool = P.DASH_TIME + P.DASH_COOL;
        if (!s.grounded) s.airDash = false;
        s.vy = s.grounded ? s.vy : Math.min(s.vy, 0.5) * 0.2;
      }
    }

    // --- horizontal
    if (s.dashTime <= 0) {
      if (ax !== 0) {
        s.vx = approach(s.vx, ax * P.RUN, s.grounded ? P.ACCEL : P.AIR_ACCEL);
        if (s.ctrlLock <= 0) s.facing = ax;
      } else {
        s.vx = approach(s.vx, 0, s.grounded ? P.FRICTION : P.AIR_FRICTION);
      }
    }

    // --- conveyor
    if (s.grounded) {
      var cv = lv.conveyorAt(b.left(), b.top(), b.w, b.h);
      if (cv) s.vx += cv * 0.55;
    }

    // --- gravity
    if (s.dashTime <= 0 || s.grounded) {
      var gs = (Math.abs(s.vy) < P.APEX_WINDOW && !s.grounded) ? P.APEX_GRAVITY / P.GRAVITY : 1;
      if (s.dashTime > 0) gs = 0;
      s.vy += P.GRAVITY * gs;
      if (s.vy > P.MAX_FALL) s.vy = P.MAX_FALL;
    } else s.vy = 0;

    // --- wall contact
    var touchR = lv.rectSolid(b.right() + 1, b.top() + 3, 1, b.h - 6);
    var touchL = lv.rectSolid(b.left() - 2, b.top() + 3, 1, b.h - 6);
    s.wallDir = 0;
    s.sliding = false;
    if (!s.grounded && s.dashTime <= 0) {
      if (touchR && (ax > 0 || s.wallStick > 0)) s.wallDir = 1;
      else if (touchL && (ax < 0 || s.wallStick > 0)) s.wallDir = -1;
      if ((touchR && ax > 0) || (touchL && ax < 0)) s.wallStick = 8;
      else if (s.wallStick > 0) s.wallStick--;
      if (s.wallDir !== 0 && s.vy > 0) {
        s.vy = Math.min(s.vy, P.SLIDE_SPEED);
        s.sliding = true;
        s.airDash = true;
      }
    } else s.wallStick = 0;

    if (s.wallDir !== 0) { s.lastWall = s.wallDir; s.wallCoyote = P.WJ_COYOTE; }
    else if (s.wallCoyote > 0) s.wallCoyote--;
    if (s.noCut > 0) s.noCut--;

    // --- jump
    if (s.grounded) { s.coyote = P.COYOTE; s.airDash = true; }
    else if (s.coyote > 0) s.coyote--;

    var dropThrough = false;
    if (s.grounded && inp.down && s.jumpBuf > 0 && onlyPlatformBelow(b)) {
      s.jumpBuf = 0;
      dropThrough = true;
      b.y += 2;
      s.vy = 1.2;
      s.grounded = false;
    } else if (s.jumpBuf > 0) {
      if (s.coyote > 0 && s.dashTime <= 0) {
        s.jumpBuf = 0;
        s.vy = P.JUMP;
        s.coyote = 0; s.grounded = false;
      } else if (s.wallDir !== 0 || s.wallCoyote > 0) {
        var wd = s.wallDir || s.lastWall;
        s.jumpBuf = 0;
        s.vy = P.WJ_Y;
        s.vx = -wd * P.WJ_X;
        s.facing = -wd;
        s.wallCoyote = 0;
        s.noCut = P.WJ_NOCUT;
        s.ctrlLock = P.WJ_LOCK;
        s.wallStick = 0;
        s.airDash = true;
      }
    }
    if (releasedJump && s.vy < P.JUMP_CUT && s.noCut <= 0) s.vy = P.JUMP_CUT;

    // --- integrate
    var wasGrounded = s.grounded;
    if (b.moveX(s.vx)) {
      s.vx = 0;
      if (s.dashTime > 0 && s.grounded) s.dashTime = 0;
    }
    if (b.moveY(s.vy, dropThrough || s.vy < 0)) s.vy = 0;
    s.grounded = b.checkGround() && s.vy >= 0;
    s.frames++;

    // --- terminal conditions (the planner treats these as failure)
    var hz = lv.rectHazard(b.left() + 1, b.top() + 2, b.w - 2, b.h - 4);
    if (hz === 'liquid') s.dead = 'liquid';
    else if (hz === 'spike') s.dead = s.dead || 'spike';
    if (b.top() > lv.pixelH + 24) s.dead = 'pit';
    return s;
  }

  function onlyPlatformBelow(b) {
    var lv = b.lv, T = VZ.TILE;
    if (lv.rectSolid(b.left() + 1, b.bottom() + 0.5, b.w - 2, 1)) return false;
    var row = Math.floor((b.bottom() + 0.5) / T);
    var x0 = Math.floor((b.left() + 1) / T), x1 = Math.floor((b.right() - 1) / T);
    for (var tx = x0; tx <= x1; tx++) if (lv.at(tx, row) === 2) return true;
    return false;
  }

  AGENT.sim = {
    newState: newState,
    cloneState: cloneState,
    step: step,
    P: P
  };

})(typeof window !== 'undefined' ? window : globalThis);
