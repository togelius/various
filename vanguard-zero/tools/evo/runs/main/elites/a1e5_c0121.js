// c0121  cell [1,5]  train 0.647  test 0.621  aggression 0.13  entropy 0.283  via improve/fast from c0106
// intent: bunny-hop right with randomised hop lengths, take off early and long from any pit within six tiles and dash across it, and tap a shot about every 1.7 seconds
const SOLID = '#cC><|';
function solid(c) { return SOLID.indexOf(c) >= 0; }
function gapWidth(obs) {
  let w = 0;
  for (let dx = 1; dx <= 8; dx++) {
    let ground = false;
    for (let dy = 1; dy <= 5; dy++) {
      const c = obs.tile(dx, dy);
      if (c === '~') break;
      if (solid(c) || c === '=') { ground = true; break; }
    }
    if (ground) break;
    w++;
  }
  return w;
}
function hazard(obs) {
  for (let dx = 1; dx <= 3; dx++) {
    const a = obs.tile(dx, 0), b = obs.tile(dx, 1);
    if (a === '^' || a === '~' || b === '^' || b === '~') return true;
  }
  return false;
}

function control(obs, mem) {
  const me = obs.me;
  const out = { right: true };

  if (mem.h === undefined) { mem.h = 14; mem.r = 2; mem.c = 0; }
  mem.c++;
  const gap = gapWidth(obs);
  if (me.ground && gap > 0 && gap <= 6 && mem.c > mem.h) {
    // pit within reach: take off now with a long hop
    mem.c = 0; mem.r = 1; mem.h = 14 + gap * 2;
  } else if (me.ground && mem.c > mem.h + mem.r) {
    mem.c = 0;
    mem.r = 1 + Math.floor(Math.random() * 4);
    if (hazard(obs)) mem.h = 18;
    else mem.h = 7 + Math.floor(Math.random() * 10);
  }
  out.jump = mem.c < mem.h;

  // dash over wide gaps
  if (!me.ground && gap >= 2 && !me.dashing && me.dashReady) out.dash = true;

  // wall kick
  if (!me.ground && me.wall !== 0 && me.vy > 0) out.jump = (obs.t % 3) === 0;

  // small random stutters for variety
  if (!gap && Math.random() < 0.05) out.right = false;

  // one shot about every 100 frames
  out.fire = (obs.t % 100) < 3;

  // boss: keep some distance
  if (obs.boss && obs.boss.dx > 0 && obs.boss.dx < 80) {
    out.right = false;
    out.left = true;
  }
  return out;
}
