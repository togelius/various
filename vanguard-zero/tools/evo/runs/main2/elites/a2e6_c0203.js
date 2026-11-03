// c0203  cell [2,6]  train 0.826  test 0.854  aggression 0.26  entropy 0.301  via improve/fast from main:c0397
// intent: run right with random hops, stutters and air wobbles, tapping one shot about every 0.7 seconds at whatever is ahead
const SOLID = '#cC><|';
function solid(c) { return SOLID.indexOf(c) >= 0; }
function bad(c) { return c === '^' || c === '~'; }

function footing(obs, dx) {
  for (let dy = 1; dy <= 5; dy++) {
    const c = obs.tile(dx, dy);
    if (bad(c)) return -1;
    if (solid(c) || c === '=') return dy;
  }
  return 0;
}

function gapAhead(obs, k) {
  for (let dx = 1; dx <= k; dx++) {
    if (footing(obs, dx) <= 0 || bad(obs.tile(dx, 0))) return true;
  }
  return false;
}

function control(obs, mem) {
  const me = obs.me;
  const out = { right: true };
  if (mem.best === undefined) {
    mem.best = me.x; mem.since = 0; mem.back = 0;
    mem.hold = 0; mem.cool = 0; mem.nf = 20;
  }
  if (me.x > mem.best + 2) { mem.best = me.x; mem.since = 0; } else mem.since++;

  if (!obs.inArena) {
    if (mem.since > 80 && mem.back <= 0) { mem.back = 20; mem.since = 0; }
    if (mem.back > 0) { mem.back--; out.right = false; out.left = true; }
  }

  const wall = solid(obs.tile(1, 0)) || solid(obs.tile(1, -1));
  const f1 = footing(obs, 1), f2 = footing(obs, 2);
  const danger = f1 <= 0 || f2 < 0 || bad(obs.tile(1, 0));
  const near = obs.enemies.some(e => e.dx > 0 && e.dx < 55 && Math.abs(e.dy) < 30);

  if (mem.cool > 0) mem.cool--;
  if (mem.hold > 0) {
    mem.hold--;
    out.jump = mem.hold > 0; // release on the last held frame so the next press is a fresh edge
    if (mem.hold === 0) mem.cool = 2;
    if (me.ground && f1 <= 0) out.right = false; // never walk off a gap while a hop is still held
  } else if (me.ground && f1 <= 0) {
    // Standing at a gap edge: jump now, even during the post-jump cooldown.
    mem.hold = 32; out.jump = true; mem.cool = 0;
    if (me.dashReady && !mem.back) out.dash = true;
  } else if (me.ground && mem.cool <= 0) {
    if (wall || danger) {
      mem.hold = 20; out.jump = true;
    } else if (gapAhead(obs, 2) && me.dashReady && !mem.back) {
      mem.hold = 24; out.jump = true; out.dash = true;
    } else if (!gapAhead(obs, 7) && (near || Math.random() < 0.05)) {
      mem.hold = 6 + Math.floor(Math.random() * 10); out.jump = true;
    }
  } else if (!me.ground && me.wall !== 0 && me.vy > 0 && mem.cool <= 0) {
    mem.hold = 10; out.jump = true;
  }

  if (!me.ground && me.vy > -2 && me.dashReady && gapAhead(obs, 4)) out.dash = true;

  // Input variety: stutters on safe ground, small air wobbles over solid ground.
  if (me.ground && !danger && !wall && f1 > 0 && Math.random() < 0.12) {
    out.right = false;
    if (Math.random() < 0.3) out.left = true;
  }
  if (!me.ground && !gapAhead(obs, 3) && Math.random() < 0.1) out.right = false;

  // One press-and-release about every 43 frames (roughly 1.4 shots/s).
  mem.nf--;
  if (mem.nf <= 0) {
    out.fire = true;
    mem.nf = 38 + Math.floor(Math.random() * 12);
  }

  if (obs.boss && obs.boss.dx > 0 && obs.boss.dx < 60) { out.right = false; out.left = true; }
  return out;
}
