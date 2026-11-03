// c0182  cell [5,1]  train 0.964  test 0.950  aggression 0.52  entropy 0.096  via tweak/strong from c0085
// intent: run right with full jumps launched at the ledge edge over pits and liquid, hop walls, spikes and enemies, tap fast shots, and in boss fights keep mid distance, hop incoming shots and rapid-fire
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

function landingOk(obs) {
  for (let dx = 3; dx <= 7; dx++) if (footing(obs, dx) > 0) return true;
  return false;
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
  const f1 = footing(obs, 1);
  // only level-hazards ahead trigger early hops; pits/liquid below are jumped from the edge
  const hz = bad(obs.tile(1, 0)) || bad(obs.tile(2, 0)) || bad(obs.tile(3, 0));
  const gw = gapWidth(obs);
  const near = obs.enemies.some(e => e.kind !== 'flamer'
    ? (e.dx > 0 && e.dx < 45 && Math.abs(e.dy) < 30)
    : (e.dx > 0 && e.dx < 45));
  const incoming = obs.shots.some(s => Math.abs(s.dy) < 16 && Math.abs(s.dx) < (arena ? 70 : 40) && s.dx * s.vx < 0 && s.warn <= 0);

  if (mem.cool > 0) mem.cool--;
  if (mem.hold > 0) {
    mem.hold--;
    out.jump = true;
    if (mem.hold === 0) mem.cool = 2;
  } else if (me.ground && mem.cool <= 0) {
    if (arena) {
      if (incoming || near) { mem.hold = 16 + (obs.t % 3); out.jump = true; }
    } else if (f1 <= 0) {
      mem.hold = gw >= 4 ? 46 : 38; out.jump = true;
    } else if (wall) {
      mem.hold = 22; out.jump = true;
    } else if (hz) {
      mem.hold = 26; out.jump = true;
    } else if (near || incoming) {
      mem.hold = 14 + (obs.t % 3); out.jump = true;
    }
  } else if (!arena && !me.ground && me.wall !== 0 && me.vy > 0 && mem.cool <= 0) {
    mem.hold = 10; out.jump = true;
  }

  if (!arena && !me.ground && me.vy > -2 && gw >= 2 && me.dashReady && !mem.back && landingOk(obs)) {
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
    out.fire = facingBoss && (obs.t % 8) < 4;
  } else {
    out.fire = (obs.t % 10) < 4;
  }
  return out;
}
