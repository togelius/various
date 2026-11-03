// c0305  cell [4,3]  train 0.895  test 0.812  aggression 0.41  entropy 0.150  via steer/strong from c0139
// intent: run right with full jumps over pits, walls and hazards, add random hops and run stutters on safe ground for varied inputs, and tap a shot about every 17 frames in levels and boss fights
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

function gapWidth(obs) {
  let w = 0;
  for (let dx = 1; dx <= 8; dx++) {
    if (footing(obs, dx) > 0) break;
    w++;
  }
  return w;
}

function control(obs, mem) {
  const me = obs.me;
  const out = { right: true };
  if (mem.best === undefined) {
    mem.best = me.x; mem.since = 0; mem.back = 0;
    mem.hold = 0; mem.cool = 0;
  }
  if (me.x > mem.best + 2) { mem.best = me.x; mem.since = 0; } else mem.since++;

  const arena = obs.inArena;
  if (!arena) {
    if (mem.since > 100 && mem.back <= 0) { mem.back = 18; mem.since = 0; }
    if (mem.back > 0) { mem.back--; out.right = false; out.left = true; }
  }

  const wall = solid(obs.tile(1, 0)) || solid(obs.tile(1, -1));
  const f1 = footing(obs, 1), f2 = footing(obs, 2), f3 = footing(obs, 3);
  const hz = bad(obs.tile(1, 0)) || bad(obs.tile(2, 0)) || bad(obs.tile(3, 0)) || f2 < 0 || f3 < 0;
  const near = obs.enemies.some(e => e.kind !== 'flamer'
    ? (e.dx > 0 && e.dx < 45 && Math.abs(e.dy) < 30)
    : (e.dx > 0 && e.dx < 45));
  const incoming = obs.shots.some(s => Math.abs(s.dy) < 16 && Math.abs(s.dx) < (arena ? 70 : 40) && s.dx * s.vx < 0 && s.warn <= 0);

  let safe = !arena && !mem.back && f1 > 0 && f2 > 0 && f3 > 0 && footing(obs, 4) > 0 &&
    !wall && !hz && !near && !incoming;

  if (mem.cool > 0) mem.cool--;
  if (mem.hold > 0) {
    mem.hold--;
    out.jump = true;
    if (mem.hold === 0) mem.cool = 2;
  } else if (me.ground && mem.cool <= 0) {
    if (arena) {
      if (incoming || near) { mem.hold = 16 + (obs.t % 3); out.jump = true; }
    } else if (f1 <= 0) {
      mem.hold = 32; out.jump = true;
    } else if (wall) {
      mem.hold = 22; out.jump = true;
    } else if (hz) {
      mem.hold = 24; out.jump = true;
    } else if (near || incoming) {
      mem.hold = 14 + (obs.t % 3); out.jump = true;
    } else if (safe && Math.random() < 0.04) {
      mem.hold = 5 + Math.floor(Math.random() * 8); out.jump = true;
    }
  } else if (!arena && !me.ground && me.wall !== 0 && me.vy > 0 && mem.cool <= 0) {
    mem.hold = 10; out.jump = true;
  }

  if (safe && me.ground && mem.hold <= 0 && Math.random() < 0.07) {
    out.right = false;
  }

  if (!arena && !me.ground && me.vy > -2 && gapWidth(obs) >= 2 && me.dashReady && !mem.back) {
    out.dash = true; out.right = true; out.left = false;
  }

  if (arena) {
    const b = obs.boss;
    out.right = false; out.left = false;
    let facingBoss = true;
    if (b) {
      const tw = b.dx >= 0 ? 1 : -1;
      const dist = Math.abs(b.dx);
      facingBoss = me.facing === tw;
      let dir = 0;
      if (dist < 70) dir = -tw;
      else if (dist > 110) dir = tw;
      else if (!facingBoss) dir = tw;
      if (dir > 0) out.right = true;
      if (dir < 0) out.left = true;
    }
    out.fire = facingBoss && (obs.t % 17) < 8;
  } else {
    out.fire = (obs.t % 17) < 8;
  }
  return out;
}
