// c0009  cell [3,3]  train 0.942  test 0.926  aggression 0.36  entropy 0.186  via tweak/strong from main:c0228
// intent: run right with full-height jumps timed over every gap, pit and hazard, air-dash across gaps, wall kicks, and jittered stutters only on clear ground, firing tap shots in levels and rapid tap at the boss while facing it
const SOLID = '#cC><|';
function solid(c) { return SOLID.indexOf(c) >= 0; }
function bad(c) { return c === '^' || c === '~'; }

// Depth of footing in column dx: 1..5 if solid ground, -1 if a hazard comes first, 0 if none.
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
    mem.hold = 0; mem.cool = 0; mem.f = 0; mem.stut = 0;
  }
  if (me.x > mem.best + 2) { mem.best = me.x; mem.since = 0; } else mem.since++;

  if (!obs.inArena) {
    if (mem.since > 100 && mem.back <= 0) { mem.back = 18; mem.since = 0; }
    if (mem.back > 0) { mem.back--; out.right = false; out.left = true; }
  }

  const wall = solid(obs.tile(1, 0)) || solid(obs.tile(1, -1));
  const f1 = footing(obs, 1), f2 = footing(obs, 2), f3 = footing(obs, 3);
  const hz = bad(obs.tile(1, 0)) || bad(obs.tile(2, 0)) || bad(obs.tile(3, 0)) || f2 < 0 || f3 < 0;
  const danger = f1 <= 0 || hz;
  const clear = [2, 3, 4, 5, 6].every(d => footing(obs, d) > 0);
  const near = obs.enemies.some(e => e.kind !== 'flamer'
    ? (e.dx > 0 && e.dx < 45 && Math.abs(e.dy) < 30)
    : (e.dx > 0 && e.dx < 45));
  const incoming = obs.shots.some(s => Math.abs(s.dy) < 16 && Math.abs(s.dx) < 40 && s.dx * s.vx < 0 && s.warn <= 0);

  // Jumps: full-height jumps over hazards; jitter only where ground is clear.
  if (mem.cool > 0) mem.cool--;
  if (mem.hold > 0) {
    mem.hold--;
    out.jump = true;
    if (mem.hold === 0) mem.cool = 2;
  } else if (me.ground && mem.cool <= 0) {
    if (f1 <= 0) {
      mem.hold = 30; out.jump = true;
    } else if (wall) {
      mem.hold = 22; out.jump = true;
    } else if (hz && f2 >= 0 && f3 >= 0) {
      mem.hold = 24; out.jump = true;
    } else if (near || incoming) {
      mem.hold = 14 + (obs.t % 3); out.jump = true;
    } else if (clear && Math.random() < 0.04) {
      mem.hold = 14 + Math.floor(Math.random() * 8); out.jump = true;
    }
  } else if (!me.ground && me.wall !== 0 && me.vy > 0 && mem.cool <= 0) {
    mem.hold = 10; out.jump = true;
  }

  // Input variety: short stutters only when no gap lies within six tiles.
  if (me.ground && clear && !danger && !wall && mem.stut <= 0 && Math.random() < 0.1) {
    mem.stut = 3 + Math.floor(Math.random() * 6);
  }
  if (mem.stut > 0 && (!me.ground || !clear || danger || wall || mem.hold > 0)) mem.stut = 0;
  if (mem.stut > 0) {
    mem.stut--;
    out.right = false;
    if (Math.random() < 0.25) out.left = true;
  }

  // Air dash across gaps.
  if (!me.ground && me.vy > -2 && gapWidth(obs) >= 2 && me.dashReady && !mem.back) {
    out.dash = true; out.right = true; out.left = false;
  }

  // Fire: rapid tap at the boss while facing it; steady taps in levels.
  if (obs.inArena) {
    const b = obs.boss;
    const facingBoss = !b || (b.dx >= 0 ? me.facing > 0 : me.facing < 0);
    out.fire = facingBoss && (obs.t % 8) < 4;
  } else if (mem.f <= 0) {
    out.fire = true;
    mem.f = 22 + Math.floor(Math.random() * 6);
  } else {
    mem.f--;
  }

  if (obs.boss && obs.boss.dx > 0 && obs.boss.dx < 60) { out.right = false; out.left = true; }
  return out;
}
