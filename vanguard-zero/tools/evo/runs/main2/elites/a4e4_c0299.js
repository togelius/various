// c0299  cell [4,4]  train 0.912  test 0.893  aggression 0.40  entropy 0.215  via steer/strong from c0207
// intent: run right with long hops over hazards, firing steady tap shots about every 18 frames, and constantly stutter, reverse and hop on safe ground (and jitter in boss fights) to keep inputs varied
const SOLID = '#cC><|';
function solid(c) { return SOLID.indexOf(c) >= 0; }
function bad(c) { return c === '^' || c === '~'; }

function footing(obs, dx) {
  for (let dy = 1; dy <= 5; dy++) {
    const c = obs.tile(dx, dy);
    if (bad(c)) return 0;
    if (solid(c) || c === '=') return dy;
  }
  return 0;
}

function gapWidth(obs) {
  let w = 0;
  for (let dx = 1; dx <= 9; dx++) {
    if (footing(obs, dx) > 0) break;
    w++;
  }
  return w;
}

function landingOk(obs) {
  for (let dx = 3; dx <= 7; dx++) if (footing(obs, dx) > 0) return true;
  return false;
}

function control(obs, mem) {
  const me = obs.me;
  const out = { right: true };
  if (mem.best === undefined) {
    mem.best = me.x; mem.since = 0; mem.back = 0;
    mem.hold = 0; mem.cool = 0; mem.st = 0;
  }
  if (me.x > mem.best + 2) { mem.best = me.x; mem.since = 0; } else mem.since++;

  const arena = obs.inArena;
  if (!arena) {
    if (mem.since > 100 && mem.back <= 0 && me.ground) { mem.back = 18; mem.since = 0; }
    if (mem.back > 0) { mem.back--; out.right = false; out.left = true; }
  }

  const wall = solid(obs.tile(1, 0)) || solid(obs.tile(1, -1));
  const f1 = footing(obs, 1);
  const hz = bad(obs.tile(1, 0)) || bad(obs.tile(2, 0)) || bad(obs.tile(3, 0));
  const gw = gapWidth(obs);
  let safe = true;
  for (let d = 1; d <= 7; d++) if (footing(obs, d) <= 0 || bad(obs.tile(d, 0))) safe = false;
  const near = obs.enemies.some(e => e.kind !== 'flamer'
    ? (e.dx > 0 && e.dx < 45 && Math.abs(e.dy) < 30)
    : (e.dx > 0 && e.dx < 45));
  const incoming = obs.shots.some(s => Math.abs(s.dy) < 16 && Math.abs(s.dx) < (arena ? 70 : 40) && s.dx * s.vx < 0 && s.warn <= 0);

  if (mem.cool > 0) mem.cool--;
  if (mem.hold > 0) {
    mem.hold--;
    out.jump = true;
    if (mem.hold === 0) mem.cool = 1 + Math.floor(Math.random() * 3);
  } else if (me.ground && mem.cool <= 0) {
    if (arena) {
      if (incoming || near) { mem.hold = 14 + Math.floor(Math.random() * 6); out.jump = true; }
      else if (Math.random() < 0.07) { mem.hold = 3 + Math.floor(Math.random() * 14); out.jump = true; }
    } else if (f1 <= 0) {
      mem.hold = gw >= 4 ? 46 : (gw >= 3 ? 38 : 32); out.jump = true;
    } else if (wall) {
      mem.hold = 22; out.jump = true;
    } else if (hz) {
      mem.hold = 24; out.jump = true;
    } else if (near || incoming) {
      mem.hold = 14 + Math.floor(Math.random() * 4); out.jump = true;
    } else if (safe && Math.random() < 0.11) {
      mem.hold = 3 + Math.floor(Math.random() * 16); out.jump = true;
    }
  } else if (!arena && !me.ground && me.wall !== 0 && me.vy > 0 && mem.cool <= 0) {
    mem.hold = 10; out.jump = true;
  }

  if (!arena && !me.ground && me.vy > -2 && gw >= 2 && me.dashReady && !mem.back && landingOk(obs)) {
    out.dash = true; out.right = true; out.left = false;
  }

  // Input variety: frequent stutters and reversals while on safe ground.
  if (!arena && me.ground && safe && !hz && !wall && !near && !mem.back && mem.hold <= 0 && Math.random() < 0.28) {
    out.right = false;
    if (Math.random() < 0.45) out.left = true;
  }

  if (arena) {
    const b = obs.boss;
    out.right = false; out.left = false;
    if (b) {
      const tw = b.dx >= 0 ? 1 : -1;
      const dist = Math.abs(b.dx);
      let dir = 0;
      if (dist < 70) dir = -tw;
      else if (dist > 110) dir = tw;
      else if (me.facing !== tw) dir = tw;
      else if (Math.random() < 0.2) dir = Math.random() < 0.5 ? tw : -tw;
      if (dir > 0) out.right = true;
      if (dir < 0) out.left = true;
    }
  }

  out.fire = (obs.t % 18) < 9;
  return out;
}
