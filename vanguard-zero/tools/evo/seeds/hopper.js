// intent: bunny-hop forward without stopping, dash across wide gaps, and hold a charged shot to release at whatever is in front
const SOLID = '#cC><|';
function solid(c) { return SOLID.indexOf(c) >= 0; }
function gapWidth(obs) {
  // Columns ahead with no footing in the 5 tiles below.
  let w = 0;
  for (let dx = 1; dx <= 8; dx++) {
    let ground = false;
    for (let dy = 1; dy <= 5; dy++) {
      const c = obs.tile(dx, dy);
      if (solid(c) || c === '=') { ground = true; break; }
    }
    if (ground) break;
    w++;
  }
  return w;
}

function control(obs, mem) {
  const me = obs.me;
  const out = { right: true };

  // Hop: press for 14 frames, release for 2, repeat while on the ground.
  mem.c = (mem.c || 0) + 1;
  if (me.ground && mem.c > 16) mem.c = 0;
  out.jump = mem.c < 14;

  // Wide gap: dash at the top of the hop.
  if (!me.ground && me.vy > -1 && gapWidth(obs) > 3 && me.dashReady) out.dash = true;

  // Wall in the air: kick off it.
  if (!me.ground && me.wall !== 0 && me.vy > 0) out.jump = (obs.t % 3) === 0;

  // Charge, and let go when something is lined up ahead.
  const lined = obs.boss ? Math.abs(obs.boss.dy) < 30 && obs.boss.dx > 0
    : obs.enemies.some(e => e.kind !== 'flamer' && e.dx > 0 && e.dx < 180 && Math.abs(e.dy) < 24);
  out.fire = !(lined && me.charge >= 1);

  // In a boss fight, keep some distance instead of running into it.
  if (obs.boss && obs.boss.dx > 0 && obs.boss.dx < 70) { out.right = false; out.left = true; }
  return out;
}
