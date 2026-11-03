// c0105  cell [5,3]  train 0.923  test 0.861  aggression 0.60  entropy 0.180  via tweak/fast from c0073
// intent: run right nonstop with varied hops and wall kicks, committing to full-height jumps and a dash over gaps and hazards, while tap-firing rapidly at whatever is ahead and backing off when stuck
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

  if (!obs.inArena) {
    if (mem.since > 90 && mem.back <= 0) { mem.back = 20; mem.since = 0; }
    if (mem.back > 0) { mem.back--; out.right = false; out.left = true; }
  }

  const wall = solid(obs.tile(1, 0)) || solid(obs.tile(1, -1));
  const f1 = footing(obs, 1), f2 = footing(obs, 2);
  const hz = bad(obs.tile(1, 0)) || bad(obs.tile(2, 0)) || bad(obs.tile(3, 0)) || f2 < 0 || footing(obs, 3) < 0;
  const danger = f1 <= 0 || hz;
  const safe = footing(obs, 3) > 0 && footing(obs, 4) > 0 && footing(obs, 5) > 0 && footing(obs, 6) > 0;
  const near = obs.enemies.some(e => e.kind !== 'flamer'
    ? (e.dx > 0 && e.dx < 50 && Math.abs(e.dy) < 30)
    : (e.dx > 0 && e.dx < 50));

  if (mem.cool > 0) mem.cool--;
  if (mem.hold > 0) {
    mem.hold--;
    out.jump = true;
    if (mem.hold === 0) mem.cool = 2;
  } else if (me.ground && (mem.cool <= 0 || f1 <= 0)) {
    if (f1 <= 0) {
      mem.hold = 30; out.jump = true;
    } else if (wall) {
      mem.hold = 20; out.jump = true;
    } else if (hz) {
      mem.hold = 22; out.jump = true;
    } else if (near || (safe && Math.random() < 0.04)) {
      mem.hold = 7 + Math.floor(Math.random() * 12); out.jump = true;
    }
  } else if (!me.ground && me.wall !== 0 && me.vy > 0 && mem.cool <= 0) {
    mem.hold = 10; out.jump = true;
  }

  if (!me.ground && me.vy > -2 && gapWidth(obs) >= 2 && me.dashReady && !mem.back) {
    out.dash = true; out.right = true; out.left = false;
  }

  // Input variety: brief stutters when safe.
  if (me.ground && safe && !danger && !wall && f1 > 0 && f2 > 0 && !near && Math.random() < 0.07) {
    out.right = false;
    if (Math.random() < 0.3) out.left = true;
  }

  // Rapid tap fire.
  out.fire = (obs.t % 8) < 4;

  if (obs.boss && obs.boss.dx > 0 && obs.boss.dx < 60) { out.right = false; out.left = true; }
  return out;
}
