// intent: run right without ever shooting, jumping over walls, gaps and spikes, and backing off to retry when stuck
const SOLID = '#cC><|';
function solid(c) { return SOLID.indexOf(c) >= 0; }
function bad(c) { return c === '^' || c === '~'; }

// Tiles down to footing in column dx: >0 found ground, 0 none (a pit), -1 hazard first.
function footing(obs, dx) {
  for (let dy = 1; dy <= 5; dy++) {
    const c = obs.tile(dx, dy);
    if (bad(c)) return -1;
    if (solid(c) || c === '=') return dy;
  }
  return 0;
}

function control(obs, mem) {
  const me = obs.me;
  const out = { right: true };
  if (mem.best === undefined) { mem.best = me.x; mem.since = 0; mem.back = 0; }
  if (me.x > mem.best + 2) { mem.best = me.x; mem.since = 0; } else mem.since++;

  // Stuck for over a second: back up briefly, then come at it again.
  if (mem.since > 70 && mem.back <= 0) { mem.back = 24; mem.since = 0; }
  if (mem.back > 0) { mem.back--; out.right = false; out.left = true; }

  if (mem.hold > 0) { mem.hold--; out.jump = true; }

  const wall = solid(obs.tile(1, 0)) || solid(obs.tile(1, -1));
  const f1 = footing(obs, 1), f2 = footing(obs, 2);
  const danger = f1 <= 0 || f2 < 0 || bad(obs.tile(1, 0));

  if (me.ground && !mem.prev && (wall || danger)) { mem.hold = 16; out.jump = true; }
  // Clinging and falling: kick off.
  if (!me.ground && me.wall !== 0 && me.vy > 0 && !mem.prev) { mem.hold = 10; out.jump = true; }

  mem.prev = !!out.jump;
  return out;
}
