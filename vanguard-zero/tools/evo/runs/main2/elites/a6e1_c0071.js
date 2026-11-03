// c0071  cell [6,1]  train 0.834  test 0.854  aggression 0.64  entropy 0.095  via rewrite/fast from c0040
// intent: run right nonstop with steady tap-fire, taking full hops over gaps, liquid, spikes, walls and nearby enemies or shots, air-dashing only over gaps with solid ground past them, and in the boss arena face the boss at mid-range while hopping incoming shots
const SOLID = '#cC><|';
function solid(c) { return SOLID.indexOf(c) >= 0; }
function bad(c) { return c === '^' || c === '~'; }

// Rows down to solid footing in column dx; -1 if a hazard comes first; 0 if none within 5 rows.
function footing(obs, dx) {
  for (let dy = 1; dy <= 5; dy++) {
    const c = obs.tile(dx, dy);
    if (bad(c)) return -1;
    if (solid(c) || c === '=') return dy;
  }
  return 0;
}

// [column of the first gap ahead (99 if none), gap width in columns]
function gap(obs) {
  let d = 0, w = 0;
  for (let dx = 1; dx <= 9; dx++) {
    const ok = footing(obs, dx) > 0;
    if (!d && !ok) d = dx;
    if (d && !ok) w++;
    if (d && ok) break;
  }
  return d ? [d, w] : [99, 0];
}

function control(obs, mem) {
  const me = obs.me, arena = obs.inArena;
  const out = { right: true, fire: (obs.t % 8) < 4 };
  if (mem.best === undefined) {
    mem.best = me.x; mem.since = 0; mem.back = 0;
    mem.hold = 0; mem.pj = false; mem.air = 0;
  }
  if (me.x > mem.best + 2) { mem.best = me.x; mem.since = 0; } else mem.since++;
  if (!arena && mem.since > 100 && mem.back <= 0) { mem.back = 18; mem.since = 0; }
  if (!arena && mem.back > 0) { mem.back--; out.right = false; out.left = true; }

  // Hold a jump through its rise; landing ends the hold.
  if (me.ground) { if (mem.air > 4) mem.hold = 0; mem.air = 0; } else mem.air++;

  const [d, w] = gap(obs);
  const hz = bad(obs.tile(1, 0)) || bad(obs.tile(2, 0)) || footing(obs, 2) < 0 || footing(obs, 3) < 0;
  const wall = solid(obs.tile(1, 0)) || solid(obs.tile(1, -1));
  const landSafe = footing(obs, 2) > 0 && footing(obs, 3) > 0;
  const near = !arena && obs.enemies.some(e => e.dx > 0 && e.dx < 45 && (e.kind === 'flamer' || Math.abs(e.dy) < 30));
  const incoming = obs.shots.some(s => s.warn <= 0 && s.dx * s.vx < 0 && Math.abs(s.dy) < (arena ? 20 : 16) && Math.abs(s.dx) < (arena ? 60 : 40));

  // Jump is edge-triggered: release for one frame between presses.
  let j = false;
  if (mem.hold > 0) { mem.hold--; j = true; }
  else if (!mem.pj) {
    if (me.ground) {
      if (!arena && d <= 2 && w > 0) { mem.hold = 24; j = true; }
      else if (!arena && (wall || hz)) { mem.hold = 20; j = true; }
      else if ((near && landSafe) || incoming) { mem.hold = 16; j = true; }
    } else if (me.wall !== 0 && me.vy > 0) { mem.hold = 3; j = true; } // wall kick
  }
  mem.pj = j;
  if (j) out.jump = true;

  // Air-dash across gaps only when solid ground lies just past them.
  const landOk = [3, 4, 5, 6, 7].some(k => footing(obs, k) > 0);
  if (!arena && !me.ground && me.vy > -2 && me.dashReady && !mem.back && w >= 2 && d <= 6 && landOk) {
    out.dash = true; out.right = true; out.left = false;
  }

  if (arena) {
    out.right = false;
    const b = obs.boss;
    if (b) {
      // Hold mid-range facing the boss; press toward it to turn or close in.
      const tw = b.dx >= 0 ? 1 : -1;
      if (Math.abs(b.dx) > 110 || me.facing !== tw) { out.right = tw > 0; out.left = tw < 0; }
    }
  }
  return out;
}
