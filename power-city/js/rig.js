/* POWER CITY - the fighter rig.
 *
 * Hand-drawing twenty-odd animation frames for eight brawlers is a lot of
 * pixels to push, and they never quite agree with each other. Instead every
 * fighter in this game is the same articulated figure - head, torso, two arms,
 * two legs - drawn from a table of poses and a palette. Bake once at boot,
 * blit forever. Change a pose here and everyone in the city learns it.
 *
 * Pose space: x runs forward (the figure always faces +x and is mirrored for
 * the other way), y runs UP from the floor, in pixels, for a 40px fighter.
 */
(function (global) {
  'use strict';
  var PC = global.PC || (global.PC = {});
  var Art = PC.art, C = PC.color;
  var Rig = PC.rig = {};

  // ------------------------------------------------------------------ poses
  // p(hip, chest, head, frontArm, backArm, frontLeg, backLeg)
  // arms: [[elbowX,elbowY],[handX,handY]]   legs: [[kneeX,kneeY],[footX,footY]]
  function p(hip, chest, head, aF, aB, lF, lB, extra) {
    var o = { hip: hip, chest: chest, head: head, aF: aF, aB: aB, lF: lF, lB: lB };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  var POSES = Rig.POSES = {
    // --------------------------------------------------------- standing
    idle: p([0, 19], [0, 30], [1, 35.5],
      [[4, 25], [7, 26]], [[-3, 25], [1, 26]],
      [[3, 10], [5, 0]], [[-3, 10], [-5, 0]]),
    idle2: p([0, 18.5], [0, 29.5], [1, 35],
      [[4, 24.5], [7, 25]], [[-3, 24.5], [1, 25]],
      [[3, 10], [5, 0]], [[-3, 10], [-5, 0]]),

    // --------------------------------------------------------- walking
    walk0: p([0, 18.5], [0, 29.5], [1, 35],
      [[1, 25], [2, 21]], [[-2, 25], [3, 25]],
      [[5, 10], [8, 0]], [[-4, 9], [-7, 0]]),
    walk1: p([0, 19.5], [0, 30.5], [1, 36],
      [[3, 25], [5, 24]], [[-3, 25], [-1, 22]],
      [[2, 11], [3, 2]], [[-3, 10], [-4, 0]]),
    walk2: p([0, 18.5], [0, 29.5], [1, 35],
      [[3, 25], [4, 25]], [[-2, 25], [-3, 21]],
      [[-3, 10], [-6, 0]], [[4, 9], [7, 0]]),
    walk3: p([0, 19.5], [0, 30.5], [1, 36],
      [[3, 25], [5, 22]], [[-3, 25], [-1, 24]],
      [[2, 11], [2, 1]], [[-2, 10], [-3, 0]]),

    // --------------------------------------------------------- running
    run0: p([1, 18], [3, 29], [5, 34.5],
      [[6, 25], [9, 27]], [[-4, 24], [-7, 21]],
      [[7, 11], [11, 1]], [[-5, 8], [-9, 1]]),
    run1: p([1, 19.5], [3, 30], [5, 35.5],
      [[5, 25], [7, 22]], [[-3, 24], [-2, 20]],
      [[4, 13], [3, 5]], [[-4, 9], [-8, 0]]),
    run2: p([1, 18], [3, 29], [5, 34.5],
      [[4, 25], [4, 21]], [[-3, 24], [-1, 27]],
      [[-4, 10], [-8, 1]], [[6, 11], [10, 1]]),
    run3: p([1, 19.5], [3, 30], [5, 35.5],
      [[5, 25], [8, 23]], [[-3, 24], [-3, 20]],
      [[4, 13], [4, 6]], [[-3, 9], [-6, 0]]),

    // --------------------------------------------------------- punching
    jab: p([0, 19], [1, 30], [2, 35.5],
      [[7, 28], [13, 28]], [[-3, 25], [0, 26]],
      [[4, 10], [6, 0]], [[-3, 10], [-6, 0]]),
    cross: p([1, 19], [2, 30], [3, 35.5],
      [[3, 26], [1, 25]], [[6, 28], [15, 29]],
      [[5, 10], [8, 0]], [[-3, 10], [-6, 0]]),
    hook: p([1, 19], [2, 30.5], [3, 36],
      [[8, 32], [13, 31]], [[-4, 26], [-2, 23]],
      [[5, 10], [8, 0]], [[-4, 10], [-7, 0]]),
    upper: p([0, 17], [1, 28.5], [2, 34],
      [[6, 28], [9, 37]], [[-3, 24], [-1, 22]],
      [[4, 9], [6, 0]], [[-3, 9], [-6, 0]]),
    elbow: p([0, 19], [-1, 30], [-2, 35.5],
      [[2, 28], [-4, 30]], [[3, 26], [5, 24]],
      [[3, 10], [5, 0]], [[-4, 10], [-7, 0]]),

    // --------------------------------------------------------- kicking
    kick: p([-1, 19], [-3, 29.5], [-4, 34.5],
      [[1, 26], [4, 23]], [[-6, 26], [-10, 25]],
      [[8, 15], [15, 16]], [[-3, 10], [-5, 0]]),
    kickHigh: p([-2, 19], [-4, 29], [-5, 34],
      [[0, 26], [3, 24]], [[-7, 26], [-11, 26]],
      [[9, 21], [16, 27]], [[-3, 10], [-5, 0]]),
    kickLow: p([-1, 18], [-3, 28.5], [-4, 33.5],
      [[1, 25], [4, 22]], [[-6, 25], [-10, 24]],
      [[8, 10], [15, 6]], [[-3, 9], [-5, 0]]),

    // --------------------------------------------------------- airborne
    jump: p([0, 20], [0, 30.5], [1, 36],
      [[4, 27], [6, 31]], [[-4, 27], [-6, 31]],
      [[5, 13], [8, 8]], [[-4, 13], [-6, 7]]),
    jumpKick: p([0, 19], [-2, 29.5], [-3, 34.5],
      [[1, 26], [3, 22]], [[-5, 26], [-9, 24]],
      [[8, 14], [16, 11]], [[-3, 12], [-6, 8]]),
    knee: p([0, 20], [1, 30.5], [2, 36],
      [[5, 27], [9, 29]], [[-3, 26], [-1, 24]],
      [[7, 20], [5, 12]], [[-3, 11], [-6, 2]]),

    // --------------------------------------------------------- reacting
    hurt: p([-1, 19], [-3, 29.5], [-5, 34.5],
      [[0, 28], [-2, 32]], [[-6, 27], [-10, 30]],
      [[2, 10], [4, 0]], [[-5, 10], [-8, 0]]),
    dizzy: p([-1, 18.5], [-2, 29], [-3, 34],
      [[2, 26], [4, 29]], [[-5, 26], [-8, 28]],
      [[2, 10], [3, 0]], [[-4, 10], [-7, 0]]),
    fall: p([-2, 15], [-8, 21], [-13, 24],
      [[-9, 26], [-14, 28]], [[-11, 22], [-16, 21]],
      [[5, 15], [11, 17]], [[1, 12], [5, 9]]),
    down: p([-3, 4.5], [-10, 5.5], [-16, 6.5],
      [[-13, 3], [-17, 2]], [[-12, 8], [-18, 9]],
      [[4, 4], [9, 2]], [[2, 6], [7, 7]]),
    getup: p([-2, 10], [-3, 19], [-2, 24.5],
      [[-6, 13], [-10, 5]], [[1, 15], [4, 8]],
      [[4, 6], [7, 0]], [[-6, 4], [-9, 1]]),
    crouch: p([-1, 11], [-1, 21], [0, 26.5],
      [[4, 15], [8, 8]], [[-4, 15], [-1, 7]],
      [[4, 6], [7, 0]], [[-4, 6], [-7, 0]]),

    // --------------------------------------------------------- grappling
    grab: p([0, 19], [1, 30], [2, 35.5],
      [[6, 28], [11, 29]], [[4, 27], [10, 27]],
      [[3, 10], [5, 0]], [[-3, 10], [-6, 0]]),
    held: p([0, 19], [-1, 29.5], [-2, 34.5],
      [[-1, 27], [-4, 30]], [[-5, 26], [-8, 29]],
      [[2, 10], [4, 0]], [[-4, 10], [-7, 0]]),
    windup: p([-2, 19], [-4, 30], [-6, 35],
      [[-2, 33], [0, 40]], [[-6, 32], [-5, 39]],
      [[2, 10], [4, 0]], [[-5, 10], [-9, 0]]),
    throwOut: p([2, 18.5], [4, 29], [6, 34],
      [[8, 28], [13, 23]], [[6, 27], [11, 21]],
      [[6, 10], [9, 0]], [[-3, 10], [-6, 0]]),

    // --------------------------------------------------------- spinning
    spin0: p([0, 19], [0, 30], [0, 35.5],
      [[7, 30], [13, 30]], [[-7, 30], [-13, 30]],
      [[6, 13], [11, 9]], [[-3, 10], [-5, 0]]),
    spin1: p([0, 19], [0, 30], [0, 35.5],
      [[-5, 29], [-9, 31]], [[5, 29], [9, 31]],
      [[-6, 13], [-11, 9]], [[3, 10], [5, 0]]),

    // --------------------------------------------------------- flourish
    win: p([0, 19], [0, 30.5], [1, 36],
      [[5, 34], [4, 40]], [[-5, 34], [-4, 40]],
      [[3, 10], [5, 0]], [[-3, 10], [-5, 0]]),
    taunt: p([0, 19], [0, 30], [1, 35.5],
      [[5, 27], [1, 28]], [[-4, 27], [-1, 27]],
      [[3, 10], [5, 0]], [[-3, 10], [-5, 0]]),
    guard: p([-1, 18.5], [-1, 29.5], [0, 35],
      [[3, 27], [4, 32]], [[-3, 27], [-1, 31]],
      [[2, 10], [4, 0]], [[-4, 10], [-7, 0]])
  };

  // ---------------------------------------------------------------- figures
  /* A character is a palette plus a build. `scale` stretches the whole rig,
   * `bulk` only thickens it - which is the difference between a big man and a
   * tall one, and the game has both. */
  Rig.CHARS = {};
  Rig.def = function (key, spec) {
    spec.key = key;
    spec.scale = spec.scale || 1;
    spec.bulk = spec.bulk || 1;
    spec.hair = spec.hair || 'flat';
    Rig.CHARS[key] = spec;
    return spec;
  };

  function shadeAll(pal) {
    var out = {};
    for (var k in pal) out[k] = C.shade(pal[k], -0.32);
    return out;
  }

  /* Draw the figure into ctx with the floor point at (ox, oy). Back limbs
   * first, in a darkened palette - the cheapest depth cue there is, and the
   * one every 8-bit brawler used. */
  function drawFigure(ctx, ch, pose, ox, oy) {
    var pal = ch.pal, back = ch._back || (ch._back = shadeAll(pal));
    var s = ch.scale, b = ch.bulk * ch.scale;
    function X(v) { return ox + v * s; }
    function Y(v) { return oy - v * s; }

    var hip = pose.hip, chest = pose.chest, head = pose.head;
    var shF = [chest[0] + 1.5, chest[1] - 1.5], shB = [chest[0] - 2.5, chest[1] - 1.5];

    function leg(l, hipX, P) {
      Art.limb(ctx, X(hipX), Y(hip[1] - 1), X(l[0][0]), Y(l[0][1]), 7 * b, 5.6 * b, P.pants);
      Art.limb(ctx, X(l[0][0]), Y(l[0][1]), X(l[1][0]), Y(l[1][1]), 5.4 * b, 4.2 * b, P.pantsD);
      // shoe: sits on the floor point and pokes forward
      Art.rect(ctx, X(l[1][0] - 2.2), Y(l[1][1] + 2.4), 6.6 * b, 2.6 * s, P.shoe);
      Art.rect(ctx, X(l[1][0] - 2.2), Y(l[1][1] + 0.4), 6.6 * b, 1 * s, P.shoeD);
    }

    function arm(a, sh, P, sleeve) {
      var upper = sleeve ? P.shirt : P.skin;
      Art.limb(ctx, X(sh[0]), Y(sh[1]), X(a[0][0]), Y(a[0][1]), 5.2 * b, 4 * b, upper);
      Art.limb(ctx, X(a[0][0]), Y(a[0][1]), X(a[1][0]), Y(a[1][1]), 4 * b, 3.4 * b, P.skin);
      Art.ellipse(ctx, X(a[1][0]), Y(a[1][1]), 2.6 * b, 2.5 * b, P.skin);      // fist
      Art.rect(ctx, X(a[1][0] - 2), Y(a[1][1] + 0.6), 4 * b, 1 * s, P.skinD);
    }

    // ---- back half
    leg(pose.lB, hip[0] - 1.5, back);
    arm(pose.aB, shB, back, ch.sleeves);

    // ---- torso
    Art.limb(ctx, X(hip[0]), Y(hip[1] - 2), X(chest[0]), Y(chest[1]), 10 * b, 12 * b, pal.pants);
    Art.limb(ctx, X(hip[0]), Y(hip[1] + 1), X(chest[0]), Y(chest[1]), 10.6 * b, 13 * b, pal.shirt);
    // the rear third sits in its own shade, which is what gives a flat
    // side-on figure any barrel to its chest at all
    Art.limb(ctx, X(hip[0] - 3.4), Y(hip[1] + 1), X(chest[0] - 4), Y(chest[1]), 3.6 * b, 4.6 * b, pal.shirtD);
    // shoulder caps make the silhouette read as a brawler and not a stick
    Art.ellipse(ctx, X(shF[0] + 0.5), Y(shF[1]), 3.6 * b, 3.2 * b, pal.shirt);
    Art.ellipse(ctx, X(shB[0]), Y(shB[1]), 3.2 * b, 3 * b, back.shirt);
    // a vest laces up the front: one seam, two pixels of it
    if (ch.vest) {
      Art.limb(ctx, X(hip[0] + 2.4), Y(hip[1] + 3), X(chest[0] + 3), Y(chest[1] - 1), 1.6 * b, 1.6 * b, pal.trim);
      Art.rect(ctx, X(chest[0] - 1), Y(chest[1] + 1), 5 * b, 1.4 * s, pal.trim);
    }
    Art.limb(ctx, X(hip[0] - 0.2), Y(hip[1] + 1), X(hip[0] + 0.2), Y(hip[1] + 2), 10.8 * b, 10.8 * b, pal.trim);

    // ---- neck + head
    var hx = X(head[0]), hy = Y(head[1]);
    Art.limb(ctx, X(chest[0]), Y(chest[1]), X(head[0]), Y(head[1] - 3), 4.4 * b, 4 * b, pal.skinD);
    Art.ellipse(ctx, hx - 0.3 * s, hy - 0.5 * s, 4.4 * b, 4.8 * s, pal.hair);   // hair mass
    Art.ellipse(ctx, hx + 1.5 * s, hy + 1.1 * s, 3.9 * b, 4.2 * s, pal.skin);   // face
    Art.rect(ctx, hx - 3.4 * s, hy - 0.2 * s, 2.4 * s, 3 * s, pal.hair);        // sideburn
    Art.rect(ctx, hx + 1.6 * s, hy - 0.6 * s, 1.4 * s, 1.8 * s, pal.eye || '#20202e');
    Art.rect(ctx, hx - 0.8 * s, hy - 0.8 * s, 1.2 * s, 1.6 * s, pal.eye || '#20202e');
    Art.rect(ctx, hx + 0.4 * s, hy + 3.4 * s, 3.2 * s, 1 * s, pal.skinD);       // jaw line

    if (ch.hair === 'spiky') {
      for (var i = -2; i <= 2; i++) {
        Art.limb(ctx, hx + i * 2 * s, hy - 3 * s, hx + i * 2.4 * s - 1.5 * s, hy - 7 * s, 3 * s, 1 * s, pal.hair);
      }
    } else if (ch.hair === 'mohawk') {
      Art.limb(ctx, hx - 3 * s, hy - 4 * s, hx + 2 * s, hy - 9 * s, 3 * s, 2 * s, pal.hair);
      Art.rect(ctx, hx - 4 * s, hy - 6 * s, 8 * s, 3 * s, pal.hair);
    } else if (ch.hair === 'pony') {
      Art.limb(ctx, hx - 3 * s, hy - 2 * s, hx - 9 * s, hy + 3 * s, 4 * s, 2 * s, pal.hair);
    } else if (ch.hair === 'bald') {
      Art.ellipse(ctx, hx + 0.5 * s, hy - 0.5 * s, 4.2 * b, 4.4 * s, pal.skin);
      Art.rect(ctx, hx - 4 * s, hy + 1 * s, 3 * s, 3 * s, pal.hair);
    } else if (ch.hair === 'cap') {
      Art.rect(ctx, hx - 5 * s, hy - 4.5 * s, 10 * b, 3 * s, pal.trim);
      Art.rect(ctx, hx + 2 * s, hy - 2.5 * s, 5 * s, 1.4 * s, pal.trim);
    }
    if (ch.band) Art.rect(ctx, hx - 5 * s, hy - 2.2 * s, 10 * b, 1.6 * s, ch.band);

    // ---- front half
    leg(pose.lF, hip[0] + 1.5, pal);
    arm(pose.aF, shF, pal, ch.sleeves);
  }

  // ------------------------------------------------------------------ baking
  /* Every (character, pose) pair is rendered once into its own canvas with a
   * black keyline, and the hand position is recorded so a bat or a knife can
   * be hung off it later without re-deriving the pose. */
  var cache = {};

  function bake(ch, poseName) {
    var pose = POSES[poseName];
    var s = ch.scale;
    var w = Math.ceil(64 * s), h = Math.ceil(56 * s);
    var ox = Math.round(w / 2), oy = h - Math.ceil(6 * s);
    var c = Art.mk(w, h), x = c.getContext('2d');
    drawFigure(x, ch, pose, ox, oy);
    var outlined = Art.outline(c, ch.pal.out || '#0b0b14', 1);
    return {
      canvas: outlined,
      ox: ox + 1, oy: oy + 1,
      handX: pose.aF[1][0] * s, handY: pose.aF[1][1] * s,
      elbowX: pose.aF[0][0] * s, elbowY: pose.aF[0][1] * s,
      headX: pose.head[0] * s, headY: pose.head[1] * s
    };
  }

  Rig.frame = function (charKey, poseName) {
    var k = charKey + '/' + poseName;
    var f = cache[k];
    if (f) return f;
    var ch = Rig.CHARS[charKey];
    if (!ch) throw new Error('no character ' + charKey);
    if (!POSES[poseName]) throw new Error('no pose ' + poseName);
    f = cache[k] = bake(ch, poseName);
    return f;
  };

  Rig.bakeAll = function () {
    for (var k in Rig.CHARS) for (var pn in POSES) Rig.frame(k, pn);
  };

  /* Draw a baked frame with its floor point at (x, y). Mirroring happens at
   * blit time so nothing is stored twice. */
  Rig.draw = function (ctx, frame, x, y, flip, tintCanvas) {
    var cv = tintCanvas || frame.canvas;
    x = Math.round(x); y = Math.round(y);
    if (flip) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.drawImage(cv, -frame.ox, -frame.oy);
      ctx.restore();
    } else {
      ctx.drawImage(cv, x - frame.ox, y - frame.oy);
    }
  };

  // White-hot copy of a frame, for the flash on a connecting hit.
  var flashCache = {};
  Rig.flash = function (charKey, poseName, color) {
    var k = charKey + '/' + poseName + '/' + color;
    if (flashCache[k]) return flashCache[k];
    var f = Rig.frame(charKey, poseName);
    // A tint rather than a fill: the figure still reads as a person mid-flash,
    // which matters when four of them are flashing at once.
    return (flashCache[k] = Art.tint(f.canvas, color, 0.82));
  };

})(typeof window !== 'undefined' ? window : globalThis);
