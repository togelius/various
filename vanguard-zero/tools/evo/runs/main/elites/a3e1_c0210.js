// c0210  cell [3,1]  train 1.000  test 0.956  aggression 0.38  entropy 0.089  via crossover/strong from c0171 + c0144
// intent: run right with full-height hops timed by footing, walls, spikes, enemies and stalls, air-dash wide gaps, tap sparse shots in levels, and in boss arenas keep mid-range facing the boss, hop incoming shots and fire in bursts
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
  const incoming = obs.shots.some(s => Math.abs(s.dy) < 16 && Math.abs(s.dx) < 40 && s.dx * s.vx < 0 && s.warn <= 0);
  const arenaThreat = arena && obs.shots.some(s => Math.abs(s.dy) < 20 && Math.abs(s.dx) < 60 && s.dx * s.vx < 0 && s.warn <= 0);

  if (mem.cool > 0) mem.cool--;
  if (mem.hold > 0) {
    mem.hold--;
    out.jump = true;
    if (mem.hold === 0) mem.cool = 2;
  } else if (me.ground && mem.cool <= 0) {
    if (!arena && f1 <= 0) {
      mem.hold = 32; out.jump = true;
    } else if (!arena && wall) {
      mem.hold = 22; out.jump = true;
    } else if (!arena && hz) {
      mem.hold = 24; out.jump = true;
    } else if ((!arena && near) || incoming || arenaThreat) {
      mem.hold = 14 + (obs.t % 3); out.jump = true;
    }
  } else if (!arena && !me.ground && me.wall !== 0 && me.vy > 0 && mem.cool <= 0) {
    mem.hold = 10; out.jump = true;
  }

  if (!arena && !me.ground && me.vy > -2 && gapWidth(obs) >= 2 && me.dashReady && !mem.back) {
    out.dash = true; out.right = true; out.left = false;
  }

  if (arena) {
    const b = obs.boss;
    if (b) {
      out.right = false; out.left = false;
      if (b.dx > 70) out.right = true;
      else if (b.dx < -70) out.left = true;
      else if (b.dx < 0 && me.facing > 0) out.left = true;
      else if (b.dx >= 0 && me.facing < 0) out.right = true;
    }
    const facingBoss = !b || (b.dx >= 0 ? me.facing > 0 : me.facing < 0);
    out.fire = facingBoss && (obs.t % 8) < 4;
  } else {
    out.fire = (obs.t % 40) < 3;
  }
  return out;
}
