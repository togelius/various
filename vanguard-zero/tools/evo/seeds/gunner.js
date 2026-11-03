// intent: advance steadily while tapping fire, halting to shoot down any enemy in the way and fighting bosses from mid range
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

function control(obs, mem) {
  const me = obs.me;
  const out = {};
  let dir = 1;

  // Nearest thing worth shooting (flamers cannot be killed).
  let target = null;
  for (const e of obs.enemies) {
    if (e.kind === 'flamer') continue;
    if (Math.abs(e.dy) < 40 && Math.abs(e.dx) < 200) { target = e; break; }
  }
  if (obs.boss) target = obs.boss;

  if (target) {
    const face = target.dx >= 0 ? 1 : -1;
    const range = obs.boss ? 110 : 90;
    if (Math.abs(target.dx) > range) dir = face;          // close in
    else if (Math.abs(target.dx) < range - 40) dir = -face; // too close: back off
    else dir = 0;
    // Must be facing it to hit it: a one-frame tap turns us round.
    if (dir === 0 && me.facing !== face) dir = face;
  }
  if (dir > 0) out.right = true;
  if (dir < 0) out.left = true;

  // Tap fire: press 4 frames, release 4.
  out.fire = (obs.t % 8) < 4;

  if (mem.hold > 0) { mem.hold--; out.jump = true; }
  const ahead = dir || me.facing;
  const wall = solid(obs.tile(ahead, 0)) || solid(obs.tile(ahead, -1));
  const f1 = footing(obs, ahead), f2 = footing(obs, 2 * ahead);
  const danger = dir !== 0 && (f1 <= 0 || f2 < 0 || bad(obs.tile(ahead, 0)));
  const incoming = obs.shots.some(s => Math.abs(s.dy) < 16 && Math.abs(s.dx) < 50 && s.dx * s.vx < 0);
  if (me.ground && !mem.prev && (wall || danger || incoming)) { mem.hold = 16; out.jump = true; }
  if (!me.ground && me.wall !== 0 && me.vy > 0 && !mem.prev) { mem.hold = 10; out.jump = true; }

  mem.prev = !!out.jump;
  return out;
}
